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
              notAnonymous && settings.siteName
                ? {
                    name: settings.siteName,
                    url: settings.siteNameUrl || undefined,
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
  const rawUrl = `${baseUrl}/i/${record.code}/raw`
  const siteName = settings.siteName || 'daivr.dev'
  const notAnonymous = !settings.anonymous
  const author = notAnonymous ? settings.author || '' : ''
  const authorUrl = notAnonymous ? settings.authorUrl || '' : ''
  const publishedAt = settings.showTimestamp ? record.uploadedAt : ''
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
</style>
</head>
<body>
  <main class="frame">
    <div class="head">
      <span class="kicker">&gt; ${escapeHtml(siteName)}</span>
      <span class="meta">${escapeHtml(ctx.filesize)} · ${escapeHtml(record.code)}${publishedAt ? ` · ${escapeHtml(new Date(publishedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }))}` : ''}</span>
    </div>
    <div class="img-wrap">
      <img src="${escapeHtml(rawUrl)}" alt="${escapeHtml(record.originalName)}" />
    </div>
    <div class="foot">
      <span class="title">${escapeHtml(title)}</span>
      <a href="${escapeHtml(rawUrl)}" target="_blank" rel="noreferrer">open raw ↗</a>
    </div>
  </main>
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
