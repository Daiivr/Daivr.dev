const express = require('express')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const axios = require('axios')
const FormData = require('form-data')

const router = express.Router()

const VT_API_KEY = process.env.VIRUSTOTAL_API_KEY || process.env.VT_API_KEY || null
const VT_BASE = 'https://www.virustotal.com/api/v3'
const VT_UPLOAD_LIMIT_BYTES = 32 * 1024 * 1024 // free tier file upload cap

const GITHUB_REPO = process.env.TRADEDEX_REPO || 'Daiivr/TradeDex'
const GITHUB_RELEASE_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`

const DATA_DIR =
  process.env.TRADEDEX_DATA_DIR ||
  path.join(__dirname, '..', '..', 'data')
const CACHE_FILE = path.join(DATA_DIR, 'tradedex-scan.json')

const RELEASE_CACHE_TTL_MS = 5 * 60 * 1000 // re-resolve GitHub release every 5 min
let releaseCache = { fetchedAt: 0, data: null }

// in-flight scans keyed by tag — keeps state across polls without redoing work
const inflight = new Map()

// retain successful state for fast polls; drop errored state quickly so users can retry
const DONE_STATE_TTL_MS = 10 * 60 * 1000
const ERROR_STATE_TTL_MS = 15 * 1000

// retry helper for transient upstream failures (GitHub release CDN often 502s briefly)
async function withRetry(fn, { retries = 3, baseDelayMs = 800, label = 'request' } = {}) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn(attempt)
    } catch (err) {
      lastErr = err
      const status = err?.response?.status
      const code = err?.code
      const transient =
        (status >= 500 && status < 600) ||
        code === 'ECONNRESET' ||
        code === 'ETIMEDOUT' ||
        code === 'EAI_AGAIN' ||
        code === 'ENOTFOUND' ||
        code === 'ECONNABORTED'
      if (!transient || attempt === retries) throw lastErr
      const wait = baseDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 250)
      console.warn(`[tradedex] ${label} failed (${status || code}), retrying in ${wait}ms`)
      await new Promise((r) => setTimeout(r, wait))
    }
  }
  throw lastErr
}

function friendlyAxiosError(err, fallback) {
  const status = err?.response?.status
  if (status) return `upstream ${status} — ${fallback}`
  if (err?.code) return `${err.code} — ${fallback}`
  return err?.message || fallback
}

function ensureStorage() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    if (!fs.existsSync(CACHE_FILE)) {
      fs.writeFileSync(CACHE_FILE, JSON.stringify({ scans: {} }, null, 2), 'utf8')
    }
  } catch (err) {
    console.error('Error creando storage de tradedex-scan', err)
  }
}

function readCache() {
  ensureStorage()
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf8')
    if (!raw) return { scans: {} }
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object' || !data.scans) return { scans: {} }
    return data
  } catch (err) {
    console.error('Error leyendo tradedex-scan.json', err)
    return { scans: {} }
  }
}

function writeCache(data) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf8')
  } catch (err) {
    console.error('Error escribiendo tradedex-scan.json', err)
  }
}

async function resolveLatestRelease() {
  const now = Date.now()
  if (releaseCache.data && now - releaseCache.fetchedAt < RELEASE_CACHE_TTL_MS) {
    return releaseCache.data
  }

  const headers = { Accept: 'application/vnd.github+json' }
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }

  const res = await withRetry(
    () => axios.get(GITHUB_RELEASE_API, { headers, timeout: 15000 }),
    { label: 'github release lookup' },
  )
  const release = res.data || {}
  const assets = Array.isArray(release.assets) ? release.assets : []

  const preferred = assets.find((a) => /\.(exe|msi)$/i.test(a?.name || ''))
    || assets.find((a) => /\.(zip|7z|rar|tar\.gz|appimage|dmg)$/i.test(a?.name || ''))
    || assets[0]
    || null

  const resolved = {
    tag: release.tag_name || release.name || 'unknown',
    name: release.name || release.tag_name || 'unknown',
    htmlUrl: release.html_url || null,
    publishedAt: release.published_at || null,
    asset: preferred
      ? {
          name: preferred.name,
          size: preferred.size,
          contentType: preferred.content_type,
          downloadUrl: preferred.browser_download_url,
        }
      : null,
    zipballUrl: release.zipball_url || null,
  }

  releaseCache = { fetchedAt: now, data: resolved }
  return resolved
}

function snapshotState(state) {
  if (!state) return null
  // strip nothing sensitive — but freeze a shallow copy to avoid mutation across polls
  return {
    tag: state.tag,
    asset: state.asset,
    status: state.status,
    stage: state.stage,
    progress: state.progress,
    sha256: state.sha256,
    vt: state.vt,
    error: state.error,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    fromCache: !!state.fromCache,
  }
}

async function downloadAndHash(url, state) {
  state.status = 'scanning'
  state.stage = 'downloading'
  state.progress = 0

  const resp = await withRetry(
    () =>
      axios.get(url, {
        responseType: 'stream',
        timeout: 0,
        maxRedirects: 5,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }),
    { label: 'asset download' },
  )

  const total = Number(resp.headers['content-length']) || state.asset?.size || 0
  const hash = crypto.createHash('sha256')
  const chunks = []
  let received = 0
  let bufferTotal = 0
  const canBufferForUpload = total > 0 && total <= VT_UPLOAD_LIMIT_BYTES

  await new Promise((resolve, reject) => {
    resp.data.on('data', (chunk) => {
      hash.update(chunk)
      received += chunk.length
      if (canBufferForUpload) {
        chunks.push(chunk)
        bufferTotal += chunk.length
      }
      if (total > 0) {
        state.progress = Math.min(1, received / total)
      }
    })
    resp.data.on('end', resolve)
    resp.data.on('error', reject)
  })

  state.stage = 'hashing'
  const digest = hash.digest('hex')
  state.sha256 = digest
  state.progress = 1

  return {
    sha256: digest,
    buffer: canBufferForUpload ? Buffer.concat(chunks, bufferTotal) : null,
    totalBytes: received,
  }
}

function summariseStats(stats) {
  if (!stats) return null
  const malicious = Number(stats.malicious || 0)
  const suspicious = Number(stats.suspicious || 0)
  const undetected = Number(stats.undetected || 0)
  const harmless = Number(stats.harmless || 0)
  const timeout = Number(stats.timeout || 0)
  const failure = Number(stats.failure || 0)
  const total = malicious + suspicious + undetected + harmless + timeout + failure
  let verdict = 'clean'
  if (malicious > 0) verdict = 'malicious'
  else if (suspicious > 0) verdict = 'suspicious'
  return { malicious, suspicious, undetected, harmless, timeout, failure, total, verdict }
}

async function queryVirusTotalByHash(sha256) {
  try {
    const res = await withRetry(
      () =>
        axios.get(`${VT_BASE}/files/${sha256}`, {
          headers: { 'x-apikey': VT_API_KEY },
          timeout: 20000,
          validateStatus: (s) => s === 200 || s === 404,
        }),
      { label: 'vt hash lookup' },
    )
    if (res.status === 404) return { found: false }
    const attrs = res.data?.data?.attributes || {}
    const summary = summariseStats(attrs.last_analysis_stats)
    return {
      found: true,
      summary,
      scanDate: attrs.last_analysis_date || null,
      meaningfulName: attrs.meaningful_name || null,
      reputation: typeof attrs.reputation === 'number' ? attrs.reputation : null,
      permalink: `https://www.virustotal.com/gui/file/${sha256}`,
    }
  } catch (err) {
    if (err.response?.status === 401 || err.response?.status === 403) {
      throw new Error('vt-auth-failed')
    }
    throw err
  }
}

async function submitFileToVirusTotal(buffer, filename) {
  const form = new FormData()
  form.append('file', buffer, { filename })
  const res = await axios.post(`${VT_BASE}/files`, form, {
    headers: {
      ...form.getHeaders(),
      'x-apikey': VT_API_KEY,
    },
    timeout: 120000,
    maxBodyLength: Infinity,
  })
  return res.data?.data?.id || null
}

async function pollAnalysis(analysisId, state) {
  state.stage = 'analyzing'
  const start = Date.now()
  const maxMs = 4 * 60 * 1000 // 4 minutes hard cap

  while (Date.now() - start < maxMs) {
    const res = await withRetry(
      () =>
        axios.get(`${VT_BASE}/analyses/${analysisId}`, {
          headers: { 'x-apikey': VT_API_KEY },
          timeout: 20000,
        }),
      { label: 'vt analysis poll', retries: 2 },
    )
    const attrs = res.data?.data?.attributes || {}
    const status = attrs.status
    if (status === 'completed') {
      return summariseStats(attrs.stats)
    }
    await new Promise((r) => setTimeout(r, 4000))
  }
  throw new Error('vt-analysis-timeout')
}

async function runScan(state, cache) {
  try {
    const { sha256, buffer } = await downloadAndHash(state.asset.downloadUrl, state)

    state.stage = 'querying'
    const lookup = await queryVirusTotalByHash(sha256)

    if (lookup.found) {
      state.vt = {
        status: 'scanned',
        stats: lookup.summary,
        verdict: lookup.summary.verdict,
        scanDate: lookup.scanDate,
        permalink: lookup.permalink,
        submitted: false,
      }
    } else if (buffer && buffer.length <= VT_UPLOAD_LIMIT_BYTES) {
      state.stage = 'submitting'
      const analysisId = await submitFileToVirusTotal(buffer, state.asset.name)
      const summary = await pollAnalysis(analysisId, state)
      state.vt = {
        status: 'scanned',
        stats: summary,
        verdict: summary.verdict,
        scanDate: Math.floor(Date.now() / 1000),
        permalink: `https://www.virustotal.com/gui/file/${sha256}`,
        submitted: true,
      }
    } else {
      state.vt = {
        status: 'not-scanned',
        reason: buffer
          ? 'unknown-hash'
          : 'file-too-large',
        permalink: `https://www.virustotal.com/gui/file/${sha256}`,
        sizeLimitBytes: VT_UPLOAD_LIMIT_BYTES,
      }
    }

    state.status = 'done'
    state.stage = 'done'
    state.finishedAt = Date.now()

    cache.scans[state.tag] = {
      tag: state.tag,
      asset: state.asset,
      sha256: state.sha256,
      vt: state.vt,
      scannedAt: state.finishedAt,
    }
    writeCache(cache)
  } catch (err) {
    const stageLabel = state.stage || 'unknown'
    console.error(`TradeDex scan error at stage=${stageLabel}`, err.message || err)
    state.status = 'error'
    state.errorStage = stageLabel
    state.stage = 'error'
    state.error = friendlyAxiosError(err, `${stageLabel} failed`)
    state.finishedAt = Date.now()
  }
}

function startScan(release) {
  const tag = release.tag
  if (inflight.has(tag)) return inflight.get(tag)

  const state = {
    tag,
    asset: release.asset,
    status: 'pending',
    stage: 'init',
    progress: 0,
    sha256: null,
    vt: null,
    error: null,
    startedAt: Date.now(),
    finishedAt: null,
  }
  inflight.set(tag, state)

  // fire and forget
  const cache = readCache()
  runScan(state, cache).finally(() => {
    // Drop errored state quickly so the next request can retry. Successful state
    // stays around longer for fast polls but eventually expires to avoid leaks.
    const ttl = state.status === 'error' ? ERROR_STATE_TTL_MS : DONE_STATE_TTL_MS
    setTimeout(() => {
      if (inflight.get(tag) === state) inflight.delete(tag)
    }, ttl)
  })

  return state
}

router.get('/scan', async (req, res) => {
  if (!VT_API_KEY) {
    return res.status(500).json({
      error: 'missing-vt-key',
      message: 'Falta configurar VIRUSTOTAL_API_KEY en el servidor.',
    })
  }

  try {
    const release = await resolveLatestRelease()
    if (!release || !release.asset || !release.asset.downloadUrl) {
      return res.status(502).json({
        error: 'no-release-asset',
        message: 'El último release no tiene assets descargables.',
        release,
      })
    }

    const cache = readCache()
    const cached = cache.scans[release.tag]

    if (cached && cached.sha256 && cached.vt) {
      return res.json({
        tag: release.tag,
        releaseUrl: release.htmlUrl,
        publishedAt: release.publishedAt,
        asset: release.asset,
        status: 'done',
        stage: 'done',
        progress: 1,
        sha256: cached.sha256,
        vt: cached.vt,
        scannedAt: cached.scannedAt,
        fromCache: true,
      })
    }

    // Already scanning? return its current state without re-starting.
    // But if the previous attempt errored, kick off a fresh one — transient
    // upstream failures (GitHub CDN 502s, VT timeouts) shouldn't lock the gate.
    let state = inflight.get(release.tag)
    if (state && state.status === 'error') {
      inflight.delete(release.tag)
      state = null
    }
    if (!state) state = startScan(release)

    return res.json({
      tag: release.tag,
      releaseUrl: release.htmlUrl,
      publishedAt: release.publishedAt,
      asset: release.asset,
      ...snapshotState(state),
    })
  } catch (err) {
    console.error('Error en /api/tradedex/scan', err.message || err)
    return res.status(500).json({
      error: 'scan-route-error',
      message: err.message || 'Unknown error',
    })
  }
})

// Read-only summary used by the projects card. Returns latest release + cached
// scan result if one exists. Never kicks off a scan — that stays gated behind
// the modal's /scan poll to avoid spending VT quota on every page load.
router.get('/info', async (req, res) => {
  try {
    const release = await resolveLatestRelease()
    const cache = readCache()
    const cached = release ? cache.scans[release.tag] : null

    let scanSummary = null
    if (cached && cached.vt) {
      const stats = cached.vt.stats || null
      scanSummary = {
        status: cached.vt.status || 'scanned',
        verdict: cached.vt.verdict || null,
        stats: stats
          ? {
              total: stats.total,
              clean: (stats.harmless || 0) + (stats.undetected || 0),
              malicious: stats.malicious || 0,
              suspicious: stats.suspicious || 0,
            }
          : null,
        scannedAt: cached.scannedAt || null,
      }
    }

    return res.json({
      tag: release?.tag || null,
      releaseUrl: release?.htmlUrl || null,
      publishedAt: release?.publishedAt || null,
      asset: release?.asset || null,
      scan: scanSummary,
    })
  } catch (err) {
    console.error('Error en /api/tradedex/info', err.message || err)
    return res.status(502).json({
      error: 'info-route-error',
      message: err.message || 'Unknown error',
    })
  }
})

module.exports = { router }
