const express = require('express')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const multer = require('multer')
const axios = require('axios')

const { getUserFromRequest } = require('../utils/session')

const router = express.Router()

// ---- Storage paths ----
const DATA_DIR =
  process.env.IMAGEHOST_DATA_DIR ||
  process.env.DATA_DIR ||
  path.join(__dirname, '..', '..', 'data')
const UPLOAD_DIR =
  process.env.IMAGEHOST_UPLOAD_DIR ||
  path.join(
    process.env.GALLERY_UPLOAD_DIR ||
      path.join(__dirname, '..', '..', 'uploads'),
    'imagehost',
  )

const SETTINGS_FILE = path.join(DATA_DIR, 'imagehost-settings.json')
const IMAGES_FILE = path.join(DATA_DIR, 'imagehost-images.json')

// ---- Constants ----
const SHORT_CODE_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789' // skip 0/O/1/l/I
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024 // 25 MB per upload
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
])

const DEFAULT_SETTINGS = {
  secret: null, // generated on first read
  title: '{filename} | {filesize}',
  description: '',
  embedColor: '#00ffe5',
  siteName: 'daivr.dev',
  siteNameUrl: 'https://daivr.dev',
  siteIconUrl: '',
  author: '',
  authorUrl: '',
  footer: '',
  discordWebhook: '',
  fileNameLength: 5,
  embed: true,
  showTimestamp: false,
  showExtension: false,
  anonymous: false,
}

const eventClients = new Set()

function sendEvent(res, event, payload) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(payload || {})}\n\n`)
}

function broadcastEvent(event, payload) {
  for (const res of eventClients) {
    try {
      sendEvent(res, event, payload)
    } catch (_) {
      eventClients.delete(res)
    }
  }
}

// ---- Bootstrap ----
function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({}, null, 2), 'utf8')
  }
  if (!fs.existsSync(IMAGES_FILE)) {
    fs.writeFileSync(IMAGES_FILE, JSON.stringify({ images: [] }, null, 2), 'utf8')
  }
}
ensureStorage()

// ---- Storage helpers ----
function readSettings() {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf8')
    const data = raw ? JSON.parse(raw) : {}
    const merged = { ...DEFAULT_SETTINGS, ...data }
    merged.fileNameLength = Math.max(3, Math.min(25, Number(merged.fileNameLength) || 5))
    // Generate a secret on first run if missing
    if (!merged.secret) {
      merged.secret = crypto.randomBytes(24).toString('base64url')
      writeSettings(merged)
    }
    return merged
  } catch (err) {
    console.error('Error reading imagehost settings', err)
    const seeded = {
      ...DEFAULT_SETTINGS,
      secret: crypto.randomBytes(24).toString('base64url'),
    }
    writeSettings(seeded)
    return seeded
  }
}

function writeSettings(data) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf8')
  } catch (err) {
    console.error('Error writing imagehost settings', err)
  }
}

function readImages() {
  try {
    const raw = fs.readFileSync(IMAGES_FILE, 'utf8')
    const data = raw ? JSON.parse(raw) : { images: [] }
    if (!data || !Array.isArray(data.images)) return { images: [] }
    return data
  } catch (err) {
    console.error('Error reading imagehost images', err)
    return { images: [] }
  }
}

function writeImages(data) {
  try {
    fs.writeFileSync(IMAGES_FILE, JSON.stringify(data, null, 2), 'utf8')
  } catch (err) {
    console.error('Error writing imagehost images', err)
  }
}

// ---- Helpers ----
function makeShortCode(length, existingCodes) {
  const len = Math.max(3, Math.min(25, Number(length) || 5))
  for (let attempt = 0; attempt < 25; attempt += 1) {
    let code = ''
    const bytes = crypto.randomBytes(len)
    for (let i = 0; i < len; i += 1) {
      code += SHORT_CODE_ALPHABET[bytes[i] % SHORT_CODE_ALPHABET.length]
    }
    if (!existingCodes.has(code)) return code
  }
  // fallback — longer code
  return crypto.randomBytes(8).toString('base64url').slice(0, len + 4)
}

function sanitizeName(name) {
  return String(name || 'image')
    .replace(/[^a-z0-9_.-]+/gi, '_')
    .slice(0, 80)
}

function publicBaseUrl(req) {
  const explicit = process.env.IMAGEHOST_PUBLIC_URL || process.env.PUBLIC_URL
  if (explicit) return explicit.replace(/\/+$/, '')
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https'
  const host = req.headers['x-forwarded-host'] || req.get('host')
  return `${proto}://${host}`
}

function imageRecordToPayload(record, baseUrl) {
  return {
    code: record.code,
    url: `${baseUrl}/i/${record.code}`,
    rawUrl: `${baseUrl}/i/${record.code}/raw`,
    deletionUrl: `${baseUrl}/api/imagehost/${record.code}?token=${record.deletionToken}`,
    filename: record.filename,
    originalName: record.originalName,
    size: record.size,
    mimeType: record.mimeType,
    uploadedAt: record.uploadedAt,
    views: record.views || 0,
  }
}

function normalizeColorInt(color) {
  const hex = String(color || '#00ffe5').replace('#', '').trim()
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return 0x00ffe5
  return parseInt(hex, 16)
}

function applyTemplate(template, ctx) {
  if (!template) return ''
  return String(template).replace(/\{(\w+)\}/g, (m, key) => {
    if (ctx[key] == null) return m
    return String(ctx[key])
  })
}

function formatBytes(bytes) {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i += 1
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 2)} ${units[i]}`
}

async function fireWebhook(webhookUrl, payload) {
  if (!webhookUrl) return
  try {
    await axios.post(webhookUrl, payload, {
      timeout: 8000,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('imagehost webhook failed', err.message || err)
  }
}

// ---- Middleware ----
function adminOnly(req, res, next) {
  const user = getUserFromRequest(req)
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: 'admin-only' })
  }
  req.user = user
  next()
}

function secretAuth(req, res, next) {
  const settings = readSettings()
  // Accept secret from header (Bearer or raw) or query. Body is not parsed
  // before this runs (multer hasn't fired yet), so don't look there.
  let provided =
    req.headers['authorization'] ||
    req.headers['x-imagehost-secret'] ||
    req.query.secret ||
    ''
  provided = String(provided).replace(/^Bearer\s+/i, '').trim()
  if (!provided || provided !== settings.secret) {
    return res.status(401).json({ error: 'invalid-secret' })
  }
  next()
}

// ---- Multer ----
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      // temporary name; we'll rename after we have the short code
      const ext = path.extname(file.originalname || '').toLowerCase()
      const tmp = `_tmp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`
      cb(null, tmp)
    },
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(String(file.mimetype || '').toLowerCase())) {
      return cb(new Error('mime-not-allowed'))
    }
    cb(null, true)
  },
})

// =========================================================================
// PUBLIC ENDPOINTS
// =========================================================================

// ShareX upload — POST /api/imagehost/upload
// Order matters: validate secret BEFORE multer writes anything to disk.
router.post(
  '/upload',
  secretAuth,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        if (err.message === 'mime-not-allowed') {
          return res.status(400).json({ error: 'unsupported-mime' })
        }
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'file-too-large', maxBytes: MAX_UPLOAD_BYTES })
        }
        console.error('imagehost upload error', err)
        return res.status(500).json({ error: 'upload-error' })
      }
      next()
    })
  },
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'no-file' })
    }

    const settings = readSettings()
    const db = readImages()
    const existing = new Set(db.images.map((i) => i.code))

    const code = makeShortCode(settings.fileNameLength, existing)
    const ext = path.extname(req.file.originalname || '').toLowerCase() || ''
    const filename = `${code}${ext}`
    const newPath = path.join(UPLOAD_DIR, filename)

    try {
      fs.renameSync(req.file.path, newPath)
    } catch (err) {
      console.error('Failed to finalize upload', err)
      try {
        fs.unlinkSync(req.file.path)
      } catch (_) {
        // ignore
      }
      return res.status(500).json({ error: 'finalize-error' })
    }

    const record = {
      code,
      filename,
      originalName: sanitizeName(req.file.originalname),
      size: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date().toISOString(),
      deletionToken: crypto.randomBytes(16).toString('base64url'),
      views: 0,
    }
    db.images.unshift(record)
    writeImages(db)

    const baseUrl = publicBaseUrl(req)
    const payload = imageRecordToPayload(record, baseUrl)
    broadcastEvent('image-uploaded', { image: payload })

    // Fire webhook (no await — non-blocking from caller's perspective)
    if (settings.discordWebhook) {
      const siteIconUrl = settings.siteIconUrl || `${baseUrl}/favicon.png`
      const ctx = {
        filename: record.originalName,
        filesize: formatBytes(record.size),
        code: record.code,
        url: payload.url,
      }
      const notAnonymous = !settings.anonymous
      const embedAuthor = notAnonymous ? settings.author || '' : ''
      fireWebhook(settings.discordWebhook, {
        username: settings.siteName || 'daivr.dev',
        embeds: [
          {
            title: applyTemplate(settings.title, ctx),
            description: applyTemplate(settings.description, ctx) || undefined,
            url: payload.url,
            color: normalizeColorInt(settings.embedColor),
            image: { url: payload.rawUrl },
            timestamp: settings.showTimestamp ? new Date().toISOString() : undefined,
            author:
              embedAuthor
                ? {
                    name: embedAuthor,
                    url: settings.authorUrl || undefined,
                    icon_url: siteIconUrl,
                  }
                : undefined,
            footer:
              notAnonymous && settings.footer
                ? { text: applyTemplate(settings.footer, ctx) }
                : undefined,
          },
        ],
      })
    }

    // ShareX expects either JSON we parse, or a single URL string.
    // We return both shapes via headers + JSON, ShareX uses ResponseURL/JSON parser.
    return res.json({
      ...payload,
      // legacy field name some configs expect
      link: payload.url,
    })
  },
)

// Public image landing page is registered as a top-level handler in server/index.js
// because Express SPA fallback intercepts it otherwise.

// Direct raw image bytes — GET /api/imagehost/raw/:code  (used by /i/:code/raw shim)
router.get('/raw/:code', (req, res) => {
  const code = sanitizeName(req.params.code)
  const db = readImages()
  const record = db.images.find((i) => i.code === code)
  if (!record) return res.status(404).json({ error: 'not-found' })

  const filePath = path.join(UPLOAD_DIR, record.filename)
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'file-missing' })
  }

  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  res.setHeader('Content-Type', record.mimeType || 'application/octet-stream')
  res.sendFile(filePath)
})

// =========================================================================
// ADMIN ENDPOINTS
// =========================================================================

router.get('/settings', adminOnly, (req, res) => {
  const settings = readSettings()
  res.json({ settings })
})

router.post('/settings', adminOnly, (req, res) => {
  const incoming = req.body || {}
  const current = readSettings()
  // Whitelist editable fields
  const editable = [
    'title',
    'description',
    'embedColor',
    'siteName',
    'siteNameUrl',
    'siteIconUrl',
    'author',
    'authorUrl',
    'footer',
    'discordWebhook',
    'fileNameLength',
    'embed',
    'showTimestamp',
    'showExtension',
    'anonymous',
  ]
  for (const key of editable) {
    if (incoming[key] === undefined) continue
    if (key === 'fileNameLength') {
      const n = Math.max(3, Math.min(25, Number(incoming[key]) || 5))
      current[key] = n
    } else if (typeof DEFAULT_SETTINGS[key] === 'boolean') {
      current[key] = Boolean(incoming[key])
    } else {
      current[key] = String(incoming[key] || '').slice(0, 500)
    }
  }
  writeSettings(current)
  res.json({ settings: current })
})

router.post('/secret/rotate', adminOnly, (req, res) => {
  const current = readSettings()
  current.secret = crypto.randomBytes(24).toString('base64url')
  writeSettings(current)
  res.json({ secret: current.secret })
})

router.get('/events', adminOnly, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  eventClients.add(res)
  sendEvent(res, 'ready', { ok: true })

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n')
    } catch (_) {
      eventClients.delete(res)
      clearInterval(heartbeat)
    }
  }, 25000)

  req.on('close', () => {
    eventClients.delete(res)
    clearInterval(heartbeat)
  })
})

router.get('/gallery', adminOnly, (req, res) => {
  const db = readImages()
  const baseUrl = publicBaseUrl(req)
  res.json({
    images: db.images.map((r) => imageRecordToPayload(r, baseUrl)),
  })
})

router.delete('/:code', (req, res) => {
  const code = sanitizeName(req.params.code)
  const db = readImages()
  const idx = db.images.findIndex((i) => i.code === code)
  if (idx < 0) return res.status(404).json({ error: 'not-found' })

  const record = db.images[idx]
  const user = getUserFromRequest(req)
  const tokenMatches =
    req.query.token && String(req.query.token) === record.deletionToken
  if (!(user && user.isAdmin) && !tokenMatches) {
    return res.status(403).json({ error: 'forbidden' })
  }

  // remove file
  try {
    const fp = path.join(UPLOAD_DIR, record.filename)
    if (fs.existsSync(fp)) fs.unlinkSync(fp)
  } catch (err) {
    console.error('Error removing imagehost file', err)
  }

  db.images.splice(idx, 1)
  writeImages(db)
  broadcastEvent('image-deleted', { code })
  res.json({ ok: true })
})

// ShareX config download — GET /api/imagehost/sxcu
router.get('/sxcu', adminOnly, (req, res) => {
  const settings = readSettings()
  const baseUrl = publicBaseUrl(req)
  const sxcu = {
    Version: '15.0.0',
    Name: settings.siteName || 'daivr.dev',
    DestinationType: 'ImageUploader, FileUploader',
    RequestMethod: 'POST',
    RequestURL: `${baseUrl}/api/imagehost/upload`,
    Headers: {
      Authorization: `Bearer ${settings.secret}`,
    },
    Body: 'MultipartFormData',
    FileFormName: 'file',
    URL: '{json:url}',
    DeletionURL: '{json:deletionUrl}',
    ErrorMessage: '{json:error}',
  }
  res.setHeader('Content-Type', 'application/octet-stream')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${(settings.siteName || 'daivr').replace(/[^a-z0-9_.-]+/gi, '_')}.sxcu"`,
  )
  res.send(JSON.stringify(sxcu, null, 2))
})

// =========================================================================
// PUBLIC LANDING PAGE — used by /i/:code (registered at server top-level)
// =========================================================================

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function renderLandingPage(record, settings, baseUrl) {
  const ctx = {
    filename: record.originalName,
    filesize: formatBytes(record.size),
    code: record.code,
    url: `${baseUrl}/i/${record.code}`,
  }
  const title = applyTemplate(settings.title || '{filename} | {filesize}', ctx)
  const description = applyTemplate(settings.description || '', ctx)
  const color = settings.embedColor || '#00ffe5'
  const accent = /^#[0-9a-fA-F]{6}$/.test(String(color).trim())
    ? String(color).trim()
    : '#00ffe5'
  const rawUrl = `${baseUrl}/i/${record.code}/raw`
  const siteName = settings.siteName || 'daivr.dev'
  const notAnonymous = !settings.anonymous
  const author = notAnonymous ? settings.author || '' : ''
  const authorUrl = notAnonymous ? settings.authorUrl || '' : ''
  const publishedAt = settings.showTimestamp ? record.uploadedAt : ''
  const publishedLabel = publishedAt
    ? new Date(publishedAt).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : ''
  const viewCount = Number(record.views || 0)
  const ogType = publishedAt || author ? 'article' : 'website'
  const imageAlt = `${record.originalName} on ${siteName}`
  const embedEnabled = settings.embed !== false

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="theme-color" content="${escapeHtml(color)}" />
${description ? `<meta name="description" content="${escapeHtml(description)}" />` : ''}
${embedEnabled ? `<meta property="og:type" content="${escapeHtml(ogType)}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${escapeHtml(rawUrl)}" />
<meta property="og:image:secure_url" content="${escapeHtml(rawUrl)}" />
<meta property="og:image:type" content="${escapeHtml(record.mimeType || 'image/png')}" />
<meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />
<meta property="og:url" content="${escapeHtml(ctx.url)}" />
<meta property="og:site_name" content="${escapeHtml(siteName)}" />
${publishedAt ? `<meta property="article:published_time" content="${escapeHtml(publishedAt)}" />
<meta property="article:modified_time" content="${escapeHtml(publishedAt)}" />
<meta property="og:updated_time" content="${escapeHtml(publishedAt)}" />
<meta name="date" content="${escapeHtml(publishedAt)}" />` : ''}
${author ? `<meta name="author" content="${escapeHtml(author)}" />` : ''}
${author ? `<meta property="article:author" content="${escapeHtml(authorUrl || author)}" />` : ''}
${author && authorUrl ? `<link rel="author" href="${escapeHtml(authorUrl)}" />` : ''}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(rawUrl)}" />
<meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}" />` : ''}
<style>
  :root {
    color-scheme: dark;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    min-height: 100%;
    background: #02040a;
    font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
    color: rgba(220, 231, 255, 0.94);
  }
  body {
    background:
      radial-gradient(circle at top left, rgba(0, 255, 229, 0.08), transparent 58%),
      radial-gradient(circle at bottom right, rgba(255, 43, 214, 0.08), transparent 58%),
      #02040a;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    background:
      repeating-linear-gradient(to bottom, transparent 0 2px, rgba(255,255,255,0.018) 2px 3px),
      linear-gradient(rgba(0,255,229,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,255,229,0.04) 1px, transparent 1px);
    background-size: auto, 42px 42px, 42px 42px;
    opacity: 0.6;
  }
  .frame {
    position: relative;
    max-width: min(94vw, 1100px);
    width: 100%;
    border-radius: 12px;
    border: 1px solid rgba(0, 255, 229, 0.22);
    background:
      radial-gradient(420px 220px at 0% 0%, rgba(0, 255, 229, 0.08), transparent 65%),
      rgba(3, 8, 18, 0.78);
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.022),
      0 22px 70px -28px rgba(0, 255, 229, 0.4),
      0 28px 90px -36px rgba(255, 43, 214, 0.3);
    padding: 16px;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
    padding: 0 4px 12px;
    border-bottom: 1px dashed rgba(0, 255, 229, 0.18);
    font-size: 0.7rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .head .kicker { color: #ff2bd6; text-shadow: 0 0 6px rgba(255, 43, 214, 0.35); }
  .head .meta { color: rgba(160, 175, 200, 0.75); }
  .img-wrap {
    position: relative;
    border-radius: 8px;
    border: 1px solid rgba(0, 255, 229, 0.18);
    background: rgba(1, 6, 16, 0.75);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 200px;
  }
  .img-wrap img {
    display: block;
    max-width: 100%;
    max-height: 80vh;
    object-fit: contain;
  }
  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 12px;
    padding: 0 4px;
    font-size: 0.66rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(160, 175, 200, 0.75);
  }
  .foot a {
    color: #00ffe5;
    text-decoration: none;
    text-shadow: 0 0 6px rgba(0, 255, 229, 0.4);
  }
  .foot a:hover { text-decoration: underline; }
  .title {
    color: #00ffe5;
    text-shadow: 0 0 8px rgba(0, 255, 229, 0.4);
  }
  .frame {
    overflow: hidden;
    max-width: min(92vw, 1120px);
    padding: 0;
    border-color: rgba(0, 255, 229, 0.38);
    background:
      radial-gradient(780px 300px at 0% 0%, rgba(0, 255, 229, 0.12), transparent 64%),
      radial-gradient(720px 320px at 100% 10%, rgba(255, 43, 214, 0.11), transparent 66%),
      linear-gradient(rgba(255, 255, 255, 0.018) 1px, transparent 1px) 0 0 / 14px 14px,
      linear-gradient(90deg, rgba(255, 255, 255, 0.012) 1px, transparent 1px) 0 0 / 14px 14px,
      rgba(2, 7, 17, 0.9);
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.035),
      inset 0 1px 0 rgba(255, 255, 255, 0.09),
      0 34px 110px -46px rgba(0, 255, 229, 0.5),
      0 28px 90px -52px rgba(255, 43, 214, 0.38);
  }
  .frame::before {
    content: '';
    display: block;
    height: 32px;
    border-bottom: 1px solid rgba(0, 255, 229, 0.2);
    background:
      linear-gradient(90deg, #ff5f57 0 5px, transparent 5px 14px, #ffbd2e 14px 19px, transparent 19px 28px, #28c840 28px 33px, transparent 33px),
      linear-gradient(90deg, rgba(0, 255, 229, 0.18), transparent 42%, rgba(255, 43, 214, 0.2));
    background-position: 14px 13px, 0 0;
    background-repeat: no-repeat;
  }
  .frame::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 76px;
    pointer-events: none;
    background: linear-gradient(0deg, rgba(0, 255, 229, 0.12), transparent);
    opacity: 0.8;
  }
  .head {
    margin: 0;
    padding: 18px 20px 15px;
    border-bottom: 1px dashed rgba(0, 255, 229, 0.22);
    background:
      linear-gradient(90deg, rgba(0, 255, 229, 0.055), transparent 42%, rgba(255, 43, 214, 0.055)),
      rgba(1, 6, 16, 0.22);
  }
  .head .kicker {
    color: #ff2bd6;
    text-shadow: 0 0 10px rgba(255, 43, 214, 0.48);
  }
  .head .meta {
    max-width: 58%;
    overflow: hidden;
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .img-wrap {
    height: min(68dvh, 620px);
    margin: 16px 16px 0;
    border-radius: 10px;
    border-color: rgba(0, 255, 229, 0.28);
    background:
      radial-gradient(500px 220px at 18% 0%, rgba(0, 255, 229, 0.08), transparent 66%),
      radial-gradient(460px 240px at 100% 100%, rgba(255, 43, 214, 0.08), transparent 70%),
      rgba(1, 6, 16, 0.78);
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.024),
      inset 0 -32px 80px rgba(0, 255, 229, 0.055);
  }
  .img-wrap::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      linear-gradient(rgba(255, 255, 255, 0.018) 1px, transparent 1px) 0 0 / 12px 12px,
      linear-gradient(90deg, rgba(255, 255, 255, 0.012) 1px, transparent 1px) 0 0 / 12px 12px;
    opacity: 0.6;
  }
  .img-wrap img {
    position: relative;
    z-index: 1;
    max-height: calc(100% - 28px);
    border-radius: 6px;
    box-shadow: 0 20px 58px rgba(0, 0, 0, 0.34);
  }
  .foot {
    position: relative;
    z-index: 1;
    margin: 0;
    padding: 16px 20px 18px;
    background:
      linear-gradient(90deg, rgba(0, 255, 229, 0.05), transparent 42%, rgba(255, 43, 214, 0.045));
  }
  .title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .foot a {
    flex: 0 0 auto;
    border-radius: 5px;
    border: 1px solid rgba(0, 255, 229, 0.28);
    padding: 7px 10px;
    background: rgba(0, 255, 229, 0.055);
    font-weight: 900;
  }
  .foot a:hover {
    border-color: rgba(0, 255, 229, 0.58);
    box-shadow: 0 0 18px rgba(0, 255, 229, 0.16);
    text-decoration: none;
  }
  @media (max-width: 720px) {
    body { padding: 10px; }
    .frame { max-width: 100%; border-radius: 10px; }
    .head {
      align-items: flex-start;
      flex-direction: column;
      gap: 7px;
      padding: 14px;
    }
    .head .meta {
      max-width: 100%;
      text-align: left;
      white-space: normal;
    }
    .img-wrap {
      height: min(58dvh, 520px);
      margin: 12px 12px 0;
      min-height: 220px;
    }
    .foot {
      align-items: stretch;
      flex-direction: column;
      padding: 13px 14px 15px;
    }
    .title {
      white-space: normal;
      overflow-wrap: anywhere;
    }
    .foot a {
      text-align: center;
    }
  }
  .viewer {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 280px;
    gap: 14px;
    padding: 16px;
  }
  .viewer .img-wrap {
    height: min(66dvh, 610px);
    margin: 0;
  }
  .info-panel {
    display: grid;
    align-content: space-between;
    gap: 14px;
    min-width: 0;
    border-radius: 10px;
    border: 1px solid rgba(255, 43, 214, 0.23);
    background:
      radial-gradient(280px 150px at 0% 0%, rgba(255, 43, 214, 0.13), transparent 70%),
      radial-gradient(260px 160px at 100% 100%, rgba(0, 255, 229, 0.09), transparent 72%),
      rgba(1, 6, 16, 0.66);
    padding: 16px;
  }
  .info-eyebrow {
    color: #ff2bd6;
    font-size: 0.56rem;
    font-weight: 900;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    text-shadow: 0 0 9px rgba(255, 43, 214, 0.42);
  }
  .info-panel h1 {
    margin: 10px 0 0;
    color: rgba(236, 245, 255, 0.94);
    font-size: clamp(1.1rem, 2.2vw, 1.55rem);
    line-height: 1.18;
    overflow-wrap: anywhere;
  }
  .info-panel h1 span {
    color: #00ffe5;
    text-shadow: 0 0 10px rgba(0, 255, 229, 0.42);
  }
  .info-grid {
    display: grid;
    gap: 8px;
    margin: 0;
  }
  .info-grid div {
    min-width: 0;
    border-radius: 8px;
    border: 1px solid rgba(0, 255, 229, 0.15);
    background: rgba(0, 0, 0, 0.28);
    padding: 9px;
  }
  .info-grid dt {
    color: rgba(160, 175, 200, 0.64);
    font-size: 0.5rem;
    font-weight: 900;
    letter-spacing: 0.15em;
    text-transform: uppercase;
  }
  .info-grid dd {
    min-width: 0;
    margin: 4px 0 0;
    overflow: hidden;
    color: rgba(236, 245, 255, 0.9);
    font-size: 0.67rem;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .raw-button {
    display: inline-flex;
    min-height: 40px;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    border: 1px solid rgba(0, 255, 229, 0.42);
    background:
      linear-gradient(180deg, rgba(0, 255, 229, 0.14), rgba(0, 255, 229, 0.035)),
      rgba(0, 0, 0, 0.22);
    color: #00ffe5;
    font-size: 0.64rem;
    font-weight: 900;
    letter-spacing: 0.14em;
    text-decoration: none;
    text-shadow: 0 0 8px rgba(0, 255, 229, 0.42);
    text-transform: uppercase;
  }
  .raw-button:hover {
    box-shadow: 0 0 24px rgba(0, 255, 229, 0.18);
  }
  .foot {
    border-top: 1px dashed rgba(0, 255, 229, 0.18);
  }
  @media (max-width: 900px) {
    .viewer {
      grid-template-columns: 1fr;
    }
    .info-panel {
      align-content: start;
    }
    .viewer .img-wrap {
      height: min(54dvh, 520px);
      min-height: 220px;
    }
  }
  /* Image packet viewer v2 */
  body {
    justify-content: center;
    padding: clamp(14px, 4vw, 42px);
    background:
      radial-gradient(900px 520px at 0% 0%, rgba(0, 255, 229, 0.13), transparent 62%),
      radial-gradient(820px 560px at 100% 12%, rgba(255, 43, 214, 0.12), transparent 66%),
      linear-gradient(180deg, #030712, #01030a 72%, #02040a);
  }
  .frame {
    --cyan: #00ffe5;
    --pink: #ff2bd6;
    --green: #39ff8a;
    --line: rgba(0, 255, 229, 0.24);
    --panel: rgba(1, 7, 18, 0.76);
    width: min(94vw, 1160px);
    max-width: min(94vw, 1160px);
    border-radius: 16px;
    isolation: isolate;
  }
  .frame::before {
    height: 36px;
    background:
      linear-gradient(90deg, #ff5f57 0 5px, transparent 5px 14px, #ffbd2e 14px 19px, transparent 19px 28px, #28c840 28px 33px, transparent 33px),
      linear-gradient(90deg, rgba(0, 255, 229, 0.23), transparent 46%, color-mix(in srgb, var(--accent) 28%, #ff2bd6) 100%);
    background-position: 16px 15px, 0 0;
    background-repeat: no-repeat;
  }
  .head {
    align-items: center;
    padding: 18px 20px 14px;
  }
  .head .kicker {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    color: rgba(236, 245, 255, 0.9);
  }
  .head .kicker::before {
    content: '>';
    color: var(--pink);
  }
  .head .kicker strong {
    color: var(--cyan);
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    text-transform: lowercase;
    text-shadow: 0 0 13px rgba(0, 255, 229, 0.45);
  }
  .head .meta {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    color: rgba(165, 181, 214, 0.82);
  }
  .head .meta span {
    display: inline-flex;
    align-items: center;
    min-height: 22px;
    border-radius: 999px;
    border: 1px solid rgba(0, 255, 229, 0.16);
    background: rgba(0, 0, 0, 0.22);
    padding: 0 8px;
  }
  .viewer {
    grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
    gap: 16px;
    padding: 16px;
  }
  .media-shell,
  .info-panel {
    position: relative;
    overflow: hidden;
    border: 1px solid var(--line);
    background:
      radial-gradient(620px 260px at 0% 0%, rgba(0, 255, 229, 0.09), transparent 68%),
      linear-gradient(rgba(255, 255, 255, 0.018) 1px, transparent 1px) 0 0 / 12px 12px,
      var(--panel);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.024);
  }
  .media-shell {
    display: grid;
    gap: 12px;
    min-width: 0;
    border-radius: 12px;
    padding: 14px;
  }
  .media-shell::before {
    content: '';
    position: absolute;
    inset: -22%;
    z-index: -1;
    background-image: var(--packet-image);
    background-position: center;
    background-size: cover;
    filter: blur(34px) saturate(1.05);
    opacity: 0.18;
    transform: scale(1.08);
  }
  .media-topline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: rgba(160, 175, 200, 0.74);
    font-size: 0.56rem;
    font-weight: 900;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }
  .media-topline strong {
    color: var(--cyan);
    text-shadow: 0 0 9px rgba(0, 255, 229, 0.36);
  }
  .media-topline span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .img-wrap {
    height: min(68dvh, 650px);
    margin: 0;
    border-radius: 10px;
    background:
      radial-gradient(640px 260px at 50% 0%, rgba(0, 255, 229, 0.08), transparent 72%),
      rgba(0, 0, 0, 0.28);
  }
  .img-wrap img {
    max-height: calc(100% - 24px);
    border-radius: 8px;
    object-fit: contain;
  }
  .info-panel {
    align-content: stretch;
    gap: 16px;
    border-radius: 12px;
    border-color: rgba(255, 43, 214, 0.3);
    padding: 18px;
  }
  .packet-badge {
    display: inline-flex;
    width: fit-content;
    align-items: center;
    gap: 8px;
    border-radius: 999px;
    border: 1px solid rgba(57, 255, 138, 0.32);
    background: rgba(57, 255, 138, 0.08);
    color: var(--green);
    font-size: 0.55rem;
    font-weight: 900;
    letter-spacing: 0.14em;
    padding: 6px 9px;
    text-transform: uppercase;
  }
  .packet-badge::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    box-shadow: 0 0 10px currentColor;
  }
  .info-panel h1 {
    margin: 14px 0 8px;
    color: rgba(236, 245, 255, 0.96);
    font-size: clamp(1rem, 1.6vw, 1.34rem);
    line-height: 1.24;
  }
  .info-panel h1 span {
    color: var(--cyan);
  }
  .info-subtitle {
    margin: 0;
    color: rgba(160, 175, 200, 0.78);
    font-size: 0.68rem;
    line-height: 1.55;
    overflow-wrap: anywhere;
  }
  .info-grid {
    gap: 9px;
  }
  .info-grid div {
    border-color: rgba(0, 255, 229, 0.2);
    background:
      linear-gradient(90deg, rgba(0, 255, 229, 0.05), transparent 60%),
      rgba(0, 0, 0, 0.28);
    padding: 10px;
  }
  .info-grid dd {
    font-size: 0.7rem;
  }
  .primary-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .raw-button,
  .copy-button {
    min-height: 44px;
    border-radius: 9px;
  }
  .copy-button {
    border: 1px solid rgba(255, 43, 214, 0.34);
    background:
      linear-gradient(180deg, rgba(255, 43, 214, 0.12), rgba(255, 43, 214, 0.035)),
      rgba(0, 0, 0, 0.22);
    color: #ff76ea;
    cursor: pointer;
    font: inherit;
    font-size: 0.64rem;
    font-weight: 900;
    letter-spacing: 0.14em;
    text-shadow: 0 0 8px rgba(255, 43, 214, 0.32);
    text-transform: uppercase;
  }
  .raw-button:hover,
  .copy-button:hover {
    transform: translateY(-1px);
  }
  .foot {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 14px 20px 18px;
  }
  .title {
    display: inline-flex;
    min-width: 0;
    gap: 8px;
    color: rgba(0, 255, 229, 0.9);
  }
  .title small {
    color: rgba(160, 175, 200, 0.72);
    font-size: inherit;
  }
  @media (max-width: 940px) {
    body {
      padding: 12px;
    }
    .viewer {
      grid-template-columns: 1fr;
    }
    .info-panel {
      grid-template-columns: minmax(0, 1fr);
    }
    .img-wrap {
      height: min(56dvh, 560px);
    }
  }
  @media (max-width: 620px) {
    body {
      padding: 0;
    }
    .frame {
      width: 100%;
      max-width: 100%;
      min-height: 100dvh;
      border-radius: 0;
    }
    .head {
      align-items: flex-start;
      flex-direction: column;
    }
    .head .meta {
      flex-wrap: wrap;
      max-width: 100%;
      text-align: left;
    }
    .viewer {
      padding: 10px;
    }
    .media-shell,
    .info-panel {
      padding: 11px;
      border-radius: 10px;
    }
    .media-topline {
      align-items: flex-start;
      flex-direction: column;
      gap: 6px;
    }
    .img-wrap {
      height: min(50dvh, 460px);
      min-height: 240px;
    }
    .primary-actions,
    .foot {
      grid-template-columns: 1fr;
    }
    .foot a {
      text-align: center;
    }
  }

  /* Image packet viewer v3: arcade/code composition */
  body {
    padding: clamp(18px, 3vw, 34px);
    background:
      radial-gradient(840px 520px at 0% 0%, rgba(0, 255, 229, 0.12), transparent 62%),
      radial-gradient(760px 500px at 100% 8%, rgba(255, 43, 214, 0.11), transparent 66%),
      linear-gradient(180deg, #040816 0%, #02040b 58%, #010208 100%);
  }
  body::before {
    background:
      repeating-linear-gradient(to bottom, transparent 0 2px, rgba(255,255,255,0.02) 2px 3px),
      linear-gradient(rgba(0,255,229,0.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,255,229,0.03) 1px, transparent 1px);
    background-size: auto, 28px 28px, 28px 28px;
    opacity: 0.54;
  }
  .frame {
    --cyan: #00ffe5;
    --pink: #ff2bd6;
    --green: #39ff8a;
    --amber: #ffb627;
    --line: rgba(0, 255, 229, 0.25);
    --panel: rgba(1, 7, 18, 0.82);
    width: min(94vw, 1160px);
    max-width: min(94vw, 1160px);
    border-radius: 11px;
    border-color: rgba(0, 255, 229, 0.34);
    background:
      linear-gradient(90deg, rgba(0, 255, 229, 0.08), transparent 32%, transparent 68%, rgba(255, 43, 214, 0.08)),
      linear-gradient(rgba(255, 255, 255, 0.018) 1px, transparent 1px) 0 0 / 12px 12px,
      linear-gradient(90deg, rgba(255, 255, 255, 0.012) 1px, transparent 1px) 0 0 / 12px 12px,
      rgba(2, 7, 18, 0.92);
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.03),
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 34px 105px -48px rgba(0, 255, 229, 0.5),
      0 30px 92px -54px rgba(255, 43, 214, 0.34);
  }
  .frame::before {
    height: 31px;
    border-bottom: 1px solid rgba(0, 255, 229, 0.22);
    background:
      linear-gradient(90deg, #ff5f57 0 5px, transparent 5px 14px, #ffbd2e 14px 19px, transparent 19px 28px, #28c840 28px 33px, transparent 33px),
      linear-gradient(90deg, rgba(0, 255, 229, 0.16), transparent 44%, rgba(255, 43, 214, 0.18));
    background-position: 15px 13px, 0 0;
    background-repeat: no-repeat;
  }
  .frame::after {
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--cyan), var(--accent), var(--pink), transparent);
    opacity: 0.7;
  }
  .head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 16px;
    padding: 15px 18px 13px;
    border-bottom: 1px dashed rgba(0, 255, 229, 0.2);
    background:
      linear-gradient(90deg, rgba(0, 255, 229, 0.045), transparent 44%, rgba(255, 43, 214, 0.045));
  }
  .head .kicker {
    gap: 8px;
    color: rgba(236, 245, 255, 0.9);
    text-shadow: none;
  }
  .head .kicker strong {
    color: var(--cyan);
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    text-transform: lowercase;
    text-shadow: 0 0 11px rgba(0, 255, 229, 0.48);
  }
  .head .meta {
    gap: 7px;
    max-width: none;
    overflow: visible;
    text-align: left;
    white-space: nowrap;
  }
  .head .meta span {
    min-height: 23px;
    border-radius: 5px;
    border-color: rgba(0, 255, 229, 0.22);
    background:
      linear-gradient(180deg, rgba(0, 255, 229, 0.06), rgba(0, 0, 0, 0.22)),
      rgba(1, 5, 13, 0.58);
    color: rgba(174, 190, 224, 0.86);
  }
  .viewer {
    grid-template-columns: minmax(0, 1fr) minmax(286px, 318px);
    align-items: start;
    gap: 14px;
    padding: 14px 16px 12px;
  }
  .media-shell,
  .info-panel {
    border-radius: 8px;
    border-color: var(--line);
    background:
      radial-gradient(520px 240px at 0% 0%, rgba(0, 255, 229, 0.09), transparent 68%),
      linear-gradient(rgba(255, 255, 255, 0.016) 1px, transparent 1px) 0 0 / 12px 12px,
      rgba(1, 7, 18, 0.78);
  }
  .media-shell {
    display: grid;
    gap: 10px;
    min-width: 0;
    padding: 12px;
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.025),
      inset 0 -36px 90px rgba(0, 255, 229, 0.035);
  }
  .media-shell::before {
    display: none;
  }
  .media-shell::after {
    content: '';
    position: absolute;
    inset: 10px;
    pointer-events: none;
    border-radius: 6px;
    background:
      linear-gradient(90deg, var(--cyan) 0 20px, transparent 20px) top left / 58px 1px no-repeat,
      linear-gradient(var(--cyan) 0 20px, transparent 20px) top left / 1px 58px no-repeat,
      linear-gradient(270deg, var(--pink) 0 20px, transparent 20px) bottom right / 58px 1px no-repeat,
      linear-gradient(0deg, var(--pink) 0 20px, transparent 20px) bottom right / 1px 58px no-repeat;
    opacity: 0.8;
  }
  .media-topline {
    min-height: 24px;
    padding: 0 2px 8px;
    border-bottom: 1px dashed rgba(0, 255, 229, 0.16);
    color: rgba(144, 160, 194, 0.84);
    font-size: 0.54rem;
  }
  .media-topline strong {
    color: var(--cyan);
  }
  .img-wrap {
    height: min(64dvh, 620px);
    min-height: 360px;
    margin: 0;
    border-radius: 7px;
    border-color: rgba(0, 255, 229, 0.22);
    background:
      radial-gradient(500px 220px at 50% 0%, rgba(0, 255, 229, 0.08), transparent 72%),
      rgba(0, 0, 0, 0.34);
  }
  .img-wrap img {
    max-width: calc(100% - 28px);
    max-height: calc(100% - 28px);
    border-radius: 6px;
    box-shadow: 0 18px 52px rgba(0, 0, 0, 0.32);
  }
  .info-panel {
    display: grid;
    align-content: start;
    gap: 12px;
    border-color: rgba(255, 43, 214, 0.28);
    padding: 13px;
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.025),
      inset 24px 0 70px rgba(255, 43, 214, 0.035);
  }
  .info-panel > div:first-child {
    min-width: 0;
  }
  .packet-badge {
    min-height: 24px;
    border-radius: 5px;
    padding: 0 8px;
    font-size: 0.52rem;
  }
  .info-eyebrow {
    display: inline-flex;
    margin-left: 8px;
    color: var(--pink);
    font-size: 0.52rem;
    font-weight: 900;
    letter-spacing: 0.17em;
    text-transform: uppercase;
  }
  .packet-command {
    display: grid;
    gap: 4px;
    min-width: 0;
    border-radius: 7px;
    border: 1px solid rgba(0, 255, 229, 0.18);
    background:
      linear-gradient(90deg, rgba(0, 255, 229, 0.075), transparent 62%),
      rgba(0, 0, 0, 0.3);
    padding: 9px 10px;
  }
  .packet-command span,
  .packet-command code {
    overflow: hidden;
    font-family: inherit;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .packet-command span {
    color: rgba(160, 175, 200, 0.76);
    font-size: 0.54rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .packet-command code {
    color: var(--cyan);
    font-size: 0.72rem;
    font-weight: 900;
    text-shadow: 0 0 8px rgba(0, 255, 229, 0.36);
  }
  .info-panel h1 {
    margin: 10px 0 6px;
    color: rgba(240, 246, 255, 0.96);
    font-size: clamp(1rem, 1.45vw, 1.25rem);
    line-height: 1.22;
  }
  .info-panel h1 span {
    display: inline;
    color: var(--cyan);
  }
  .info-subtitle {
    max-width: 100%;
    margin: 0;
    color: rgba(158, 175, 207, 0.74);
    font-size: 0.63rem;
    line-height: 1.45;
  }
  .info-grid {
    align-content: start;
    gap: 7px;
    margin: 0;
  }
  .info-grid div {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr);
    align-items: center;
    min-height: 34px;
    border-radius: 6px;
    border-color: rgba(0, 255, 229, 0.17);
    background:
      linear-gradient(90deg, rgba(0, 255, 229, 0.04), transparent 70%),
      rgba(0, 0, 0, 0.28);
    padding: 7px 8px;
  }
  .info-grid dt {
    color: rgba(255, 43, 214, 0.78);
    font-size: 0.49rem;
  }
  .info-grid dd {
    margin: 0;
    color: rgba(229, 239, 255, 0.9);
    font-size: 0.63rem;
  }
  .primary-actions {
    grid-template-columns: 1fr 1fr;
    gap: 9px;
  }
  .raw-button,
  .copy-button {
    min-height: 42px;
    border-radius: 7px;
    font-size: 0.58rem;
  }
  .copy-button {
    border-color: rgba(255, 43, 214, 0.34);
    background:
      linear-gradient(180deg, rgba(255, 43, 214, 0.12), rgba(255, 43, 214, 0.035)),
      rgba(0, 0, 0, 0.22);
    color: #ff76ea;
  }
  .foot {
    min-height: 48px;
    padding: 12px 18px 14px;
    border-top: 1px dashed rgba(0, 255, 229, 0.18);
  }
  .title {
    color: var(--cyan);
    font-size: 0.62rem;
  }
  .title small {
    color: rgba(160, 175, 200, 0.7);
  }
  .foot a {
    min-height: 31px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
  }
  @media (max-width: 920px) {
    body {
      padding: 10px;
    }
    .viewer {
      grid-template-columns: 1fr;
    }
    .info-panel {
      grid-template-rows: auto auto auto auto;
    }
    .img-wrap {
      height: min(56dvh, 560px);
      min-height: 260px;
    }
  }
  @media (max-width: 620px) {
    body {
      padding: 0;
    }
    .frame {
      width: 100%;
      max-width: 100%;
      min-height: 100dvh;
      border-radius: 0;
    }
    .head {
      grid-template-columns: 1fr;
      gap: 8px;
      padding: 13px;
    }
    .head .meta {
      flex-wrap: wrap;
      max-width: 100%;
    }
    .viewer {
      padding: 10px;
    }
    .media-shell,
    .info-panel {
      padding: 10px;
    }
    .media-topline {
      align-items: flex-start;
      flex-direction: column;
      gap: 4px;
    }
    .img-wrap {
      height: min(48dvh, 430px);
      min-height: 220px;
    }
    .info-eyebrow {
      display: block;
      margin: 7px 0 0;
    }
    .info-grid div {
      grid-template-columns: 1fr;
      gap: 4px;
    }
    .primary-actions,
    .foot {
      grid-template-columns: 1fr;
    }
    .foot {
      align-items: stretch;
    }
    .foot a {
      width: 100%;
    }
  }

  /* Public packet viewer: arcade capture terminal */
  .frame {
    width: min(96vw, 1320px);
    max-width: min(96vw, 1320px);
    padding: 0;
    overflow: hidden;
  }
  .head {
    min-height: 76px;
    margin: 0;
    padding: 18px 20px;
    border-bottom-style: solid;
  }
  .head-brand {
    display: grid;
    gap: 6px;
  }
  .head-label {
    display: inline-flex;
    width: fit-content;
    align-items: center;
    gap: 7px;
    color: var(--green);
    font-size: 0.5rem;
    font-weight: 900;
    letter-spacing: 0.23em;
  }
  .head-label::before {
    content: '';
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
    box-shadow: 0 0 11px currentColor;
  }
  .head-brand .kicker {
    gap: 8px;
  }
  .head-brand .kicker::before {
    content: '/i';
    display: inline-flex;
    height: 24px;
    align-items: center;
    border-radius: 5px;
    border: 1px solid rgba(0, 255, 229, 0.36);
    background: rgba(0, 255, 229, 0.09);
    color: var(--pink);
    padding: 0 7px;
    text-shadow: 0 0 9px rgba(255, 43, 214, 0.4);
  }
  .head-brand small {
    color: rgba(139, 155, 188, 0.78);
    font-size: 0.52rem;
    font-weight: 850;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }
  .viewer {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr) minmax(278px, 306px);
    align-items: stretch;
    gap: 12px;
    padding: 12px;
  }
  .route-rail {
    display: grid;
    grid-template-rows: auto 1fr auto;
    align-items: start;
    justify-items: center;
    gap: 12px;
    min-height: 100%;
    border-radius: 8px;
    border: 1px solid rgba(0, 255, 229, 0.2);
    background:
      linear-gradient(180deg, rgba(0, 255, 229, 0.085), transparent 44%, rgba(255, 43, 214, 0.06)),
      rgba(0, 0, 0, 0.28);
    padding: 12px 7px;
  }
  .route-rail strong {
    display: inline-flex;
    width: 39px;
    height: 39px;
    align-items: center;
    justify-content: center;
    border-radius: 7px;
    border: 1px solid rgba(0, 255, 229, 0.34);
    color: var(--cyan);
    font-size: 0.65rem;
    text-shadow: 0 0 9px rgba(0, 255, 229, 0.42);
  }
  .route-rail span {
    align-self: center;
    color: rgba(139, 155, 188, 0.7);
    font-size: 0.49rem;
    font-weight: 900;
    letter-spacing: 0.23em;
    text-transform: uppercase;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
  }
  .route-rail i {
    display: block;
    width: 1px;
    height: 42px;
    background: linear-gradient(var(--cyan), var(--pink));
    box-shadow: 0 0 10px var(--cyan);
  }
  .media-shell {
    gap: 9px;
    padding: 10px;
    border-color: rgba(0, 255, 229, 0.32);
  }
  .media-shell::after {
    inset: 47px 18px 46px;
    z-index: 2;
  }
  .media-topline {
    min-height: 34px;
    padding: 0 9px 9px;
  }
  .media-readout {
    display: flex;
    gap: 7px;
    padding: 0 2px;
  }
  .media-readout span {
    display: inline-flex;
    min-height: 24px;
    align-items: center;
    border-radius: 5px;
    border: 1px solid rgba(0, 255, 229, 0.17);
    background: rgba(0, 0, 0, 0.34);
    color: rgba(145, 162, 196, 0.84);
    font-size: 0.49rem;
    font-weight: 900;
    letter-spacing: 0.14em;
    padding: 0 8px;
    text-transform: uppercase;
  }
  .media-readout span:first-child {
    border-color: rgba(57, 255, 138, 0.25);
    color: var(--green);
  }
  .img-wrap {
    height: min(68dvh, 700px);
    min-height: 440px;
    border-color: rgba(0, 255, 229, 0.26);
    background:
      radial-gradient(560px 320px at 50% 3%, rgba(0, 255, 229, 0.1), transparent 67%),
      radial-gradient(420px 240px at 100% 100%, rgba(255, 43, 214, 0.07), transparent 68%),
      rgba(0, 0, 0, 0.4);
  }
  .img-wrap img {
    max-width: calc(100% - 42px);
    max-height: calc(100% - 42px);
    z-index: 1;
    box-shadow: 0 24px 68px rgba(0, 0, 0, 0.44);
  }
  .viewport-tag {
    position: absolute;
    right: 18px;
    bottom: 15px;
    z-index: 3;
    border-radius: 5px;
    border: 1px solid rgba(0, 255, 229, 0.3);
    background: rgba(1, 6, 16, 0.88);
    color: var(--cyan);
    font-size: 0.49rem;
    font-weight: 900;
    letter-spacing: 0.16em;
    padding: 6px 8px;
  }
  .media-bottom {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 12px;
    align-items: center;
    min-height: 34px;
    border-top: 1px dashed rgba(0, 255, 229, 0.16);
    padding: 8px 4px 0;
    color: rgba(139, 155, 188, 0.72);
    font-size: 0.5rem;
    font-weight: 900;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .media-bottom code {
    overflow: hidden;
    color: rgba(203, 255, 248, 0.86);
    font: inherit;
    letter-spacing: 0.04em;
    text-overflow: ellipsis;
    text-transform: none;
    white-space: nowrap;
  }
  .info-panel {
    gap: 11px;
    border-color: rgba(255, 43, 214, 0.33);
    padding: 12px;
  }
  .inspector-label {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
    color: rgba(139, 155, 188, 0.76);
    font-size: 0.5rem;
    font-weight: 900;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }
  .inspector-label strong {
    color: var(--pink);
  }
  .info-panel h1 {
    font-size: clamp(1.04rem, 1.6vw, 1.34rem);
  }
  .primary-actions {
    margin-top: auto;
  }
  .foot {
    border-top-style: solid;
    background:
      linear-gradient(90deg, rgba(0, 255, 229, 0.04), transparent 48%, rgba(255, 43, 214, 0.04));
  }
  @media (max-width: 1080px) {
    .viewer {
      grid-template-columns: minmax(0, 1fr) minmax(264px, 298px);
    }
    .route-rail {
      display: none;
    }
    .img-wrap {
      min-height: 360px;
    }
  }
  @media (max-width: 840px) {
    .viewer {
      grid-template-columns: 1fr;
    }
    .img-wrap {
      height: min(58dvh, 580px);
      min-height: 280px;
    }
  }
  @media (max-width: 620px) {
    .head {
      padding: 14px 12px;
    }
    .media-shell::after {
      inset: 73px 15px 42px;
    }
    .media-readout {
      flex-wrap: wrap;
    }
    .img-wrap {
      min-height: 220px;
    }
    .viewport-tag {
      right: 12px;
      bottom: 11px;
    }
  }
</style>
</head>
<body>
  <main class="frame" style="--accent: ${escapeHtml(accent)}; --packet-image: url('${escapeHtml(rawUrl)}');">
    <div class="head">
      <div class="head-brand">
        <span class="head-label">public asset online</span>
        <span class="kicker"><strong>${escapeHtml(siteName)}</strong></span>
        <small>capture packet / read-only viewport</small>
      </div>
      <span class="meta">
        <span>${escapeHtml(ctx.filesize)}</span>
        <span>${escapeHtml(record.code)}</span>
        ${publishedLabel ? `<span>${escapeHtml(publishedLabel)}</span>` : ''}
      </span>
    </div>
    <section class="viewer">
      <aside class="route-rail" aria-hidden="true">
        <strong>/i</strong>
        <span>asset viewport</span>
        <i></i>
      </aside>
      <div class="media-shell">
        <div class="media-topline">
          <strong>/i/${escapeHtml(record.code)}</strong>
          <span>${escapeHtml(record.mimeType || 'image')} / ${escapeHtml(record.originalName)}</span>
        </div>
        <div class="media-readout" aria-hidden="true">
          <span>decoded</span>
          <span>raw render</span>
          <span>fit containment</span>
        </div>
        <div class="img-wrap">
          <img src="${escapeHtml(rawUrl)}" alt="${escapeHtml(record.originalName)}" />
          <span class="viewport-tag">RAW / 100%</span>
        </div>
        <div class="media-bottom">
          <span>source</span>
          <code>${escapeHtml(rawUrl)}</code>
        </div>
      </div>
      <aside class="info-panel">
        <div>
          <div class="inspector-label">
            <strong>packet.inspect</strong>
            <span>read only</span>
          </div>
          <span class="packet-badge">asset clean</span>
          <h1>${escapeHtml(record.originalName)} <span>/ ${escapeHtml(record.code)}</span></h1>
          <p class="info-subtitle">${escapeHtml(title)}</p>
        </div>
        <div class="packet-command">
          <span>$ imagehost open --code</span>
          <code>/i/${escapeHtml(record.code)}</code>
        </div>
        <dl class="info-grid">
          <div>
            <dt>file</dt>
            <dd>${escapeHtml(record.originalName)}</dd>
          </div>
          <div>
            <dt>size</dt>
            <dd>${escapeHtml(ctx.filesize)}</dd>
          </div>
          <div>
            <dt>mime</dt>
            <dd>${escapeHtml(record.mimeType || 'image')}</dd>
          </div>
          <div>
            <dt>route</dt>
            <dd>GET /i/${escapeHtml(record.code)}/raw</dd>
          </div>
          <div>
            <dt>views</dt>
            <dd>${escapeHtml(String(viewCount))}</dd>
          </div>
        </dl>
        <div class="primary-actions">
          <a class="raw-button" href="${escapeHtml(rawUrl)}" target="_blank" rel="noreferrer">raw</a>
          <button class="copy-button" type="button" data-copy="${escapeHtml(ctx.url)}">copy</button>
        </div>
      </aside>
    </section>
    <div class="foot">
      <span class="title">${escapeHtml(record.originalName)} <small>| ${escapeHtml(ctx.filesize)}</small></span>
      <a href="${escapeHtml(rawUrl)}" target="_blank" rel="noreferrer">open raw ↗</a>
    </div>
  </main>
  <script>
    document.querySelector('[data-copy]')?.addEventListener('click', async (event) => {
      const button = event.currentTarget
      try {
        await navigator.clipboard.writeText(button.dataset.copy)
        button.textContent = 'copied'
        setTimeout(() => { button.textContent = 'copy link' }, 1300)
      } catch (_) {
        button.textContent = 'copy failed'
        setTimeout(() => { button.textContent = 'copy link' }, 1300)
      }
    })
  </script>
</body>
</html>`
}

function handleLandingRequest(req, res, mode) {
  const code = sanitizeName(req.params.code || '').replace(/\..+$/, '')
  if (!code) return res.status(404).send('Not found')

  const db = readImages()
  const record = db.images.find((i) => i.code === code)
  if (!record) return res.status(404).send('Not found')

  const filePath = path.join(UPLOAD_DIR, record.filename)
  if (!fs.existsSync(filePath)) return res.status(404).send('File missing')

  if (mode === 'raw') {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.setHeader('Content-Type', record.mimeType || 'application/octet-stream')
    return res.sendFile(filePath)
  }

  // Increment view counter (best effort)
  record.views = (record.views || 0) + 1
  writeImages(db)

  const settings = readSettings()
  const baseUrl = publicBaseUrl(req)

  // If the requester is Discordbot or another OG crawler, return the image
  // directly so it shows the full-size embed without the wrapper page.
  // (Discord does parse OG meta tags too, so HTML is fine — but this is
  // a common pattern. We just render the page for both.)
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(renderLandingPage(record, settings, baseUrl))
}

module.exports = {
  router,
  handleLandingRequest,
}
