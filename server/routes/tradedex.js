const express = require('express')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const axios = require('axios')
const FormData = require('form-data')

const router = express.Router()

const VT_API_KEY = process.env.VIRUSTOTAL_API_KEY || process.env.VT_API_KEY || null
const VT_BASE = 'https://www.virustotal.com/api/v3'
// VirusTotal's standard /files endpoint accepts up to 32 MB. For larger binaries
// (TradeDex releases routinely run 60+ MB) we fetch a one-time signed URL from
// /files/upload_url which accepts up to 650 MB on the free tier.
const VT_DIRECT_UPLOAD_LIMIT = 32 * 1024 * 1024
const VT_LARGE_UPLOAD_LIMIT = 650 * 1024 * 1024

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
  // Buffer the whole file if it could possibly be uploaded to VT (either via the
  // direct 32 MB endpoint or the large-file 650 MB upload-URL flow).
  const canBufferForUpload = total > 0 && total <= VT_LARGE_UPLOAD_LIMIT

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

async function getLargeUploadUrl() {
  const res = await withRetry(
    () =>
      axios.get(`${VT_BASE}/files/upload_url`, {
        headers: { 'x-apikey': VT_API_KEY },
        timeout: 20000,
      }),
    { label: 'vt upload-url' },
  )
  const url = res.data?.data
  if (!url || typeof url !== 'string') {
    throw new Error('vt-upload-url-missing')
  }
  return url
}

async function submitFileToVirusTotal(buffer, filename) {
  const size = buffer.length
  // For files >32 MB we route through a one-time upload URL from VT; the URL is
  // host-specific but still requires the x-apikey header for authentication.
  const target =
    size > VT_DIRECT_UPLOAD_LIMIT ? await getLargeUploadUrl() : `${VT_BASE}/files`

  const form = new FormData()
  form.append('file', buffer, { filename })
  const headers = { ...form.getHeaders(), 'x-apikey': VT_API_KEY }

  const res = await withRetry(
    () =>
      axios.post(target, form, {
        headers,
        timeout: 5 * 60 * 1000, // large uploads take a while
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }),
    { label: 'vt file upload', retries: 2 },
  )
  return res.data?.data?.id || null
}

// Free-tier VT analyses for fresh uploads typically finish in 2–8 minutes but
// occasionally sit in the queue for 10+ min. We poll for up to maxMs; if the
// analysis still isn't done we return null and let the caller persist a
// "pending" state that the next request can resume.
async function pollAnalysis(analysisId, state, { maxMs = 10 * 60 * 1000 } = {}) {
  state.stage = 'analyzing'
  const start = Date.now()

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
  return null // still queued — caller should persist pending state
}

// Quick one-shot check used when resuming a previously-pending analysis from
// the cache. Doesn't block — returns null if not yet done.
async function checkAnalysisOnce(analysisId) {
  try {
    const res = await withRetry(
      () =>
        axios.get(`${VT_BASE}/analyses/${analysisId}`, {
          headers: { 'x-apikey': VT_API_KEY },
          timeout: 20000,
        }),
      { label: 'vt analysis resume', retries: 1 },
    )
    const attrs = res.data?.data?.attributes || {}
    if (attrs.status === 'completed') return summariseStats(attrs.stats)
    return null
  } catch (err) {
    console.warn('[tradedex] resume check failed', err.message || err)
    return null
  }
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
    } else if (buffer && buffer.length <= VT_LARGE_UPLOAD_LIMIT) {
      state.stage = 'submitting'
      const analysisId = await submitFileToVirusTotal(buffer, state.asset.name)
      let summary = await pollAnalysis(analysisId, state)

      // If the analysis didn't finish in time, try one more hash lookup — VT
      // often has the file indexed in the regular hash database before the
      // analysis API flips to "completed".
      if (!summary) {
        const recheck = await queryVirusTotalByHash(sha256).catch(() => null)
        if (recheck?.found && recheck.summary) {
          summary = recheck.summary
        }
      }

      if (summary) {
        state.vt = {
          status: 'scanned',
          stats: summary,
          verdict: summary.verdict,
          scanDate: Math.floor(Date.now() / 1000),
          permalink: `https://www.virustotal.com/gui/file/${sha256}`,
          submitted: true,
        }
      } else {
        // Still queued. Persist enough state to resume on the next request
        // instead of re-uploading the whole file.
        state.vt = {
          status: 'pending',
          analysisId,
          permalink: `https://www.virustotal.com/gui/file/${sha256}`,
          submitted: true,
          queuedAt: Math.floor(Date.now() / 1000),
        }
      }
    } else {
      state.vt = {
        status: 'not-scanned',
        reason: 'file-too-large',
        permalink: `https://www.virustotal.com/gui/file/${sha256}`,
        sizeLimitBytes: VT_LARGE_UPLOAD_LIMIT,
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
      // If the cached scan is still pending (analysis was queued past our poll
      // window), try to resolve it now via a quick re-check. If it's done,
      // upgrade the cache to the final verdict. If not, fall through and return
      // the pending state so the UI can keep waiting.
      if (cached.vt.status === 'pending' && cached.vt.analysisId) {
        const summary = await checkAnalysisOnce(cached.vt.analysisId)
        if (summary) {
          cached.vt = {
            status: 'scanned',
            stats: summary,
            verdict: summary.verdict,
            scanDate: Math.floor(Date.now() / 1000),
            permalink: cached.vt.permalink,
            submitted: true,
          }
          cached.scannedAt = Date.now()
          cache.scans[release.tag] = cached
          writeCache(cache)
        } else {
          // Sometimes VT indexes the hash before the analysis API flips —
          // try the hash endpoint as a secondary resolution path.
          const recheck = await queryVirusTotalByHash(cached.sha256).catch(() => null)
          if (recheck?.found && recheck.summary) {
            cached.vt = {
              status: 'scanned',
              stats: recheck.summary,
              verdict: recheck.summary.verdict,
              scanDate: recheck.scanDate || Math.floor(Date.now() / 1000),
              permalink: cached.vt.permalink,
              submitted: true,
            }
            cached.scannedAt = Date.now()
            cache.scans[release.tag] = cached
            writeCache(cache)
          }
        }
      }

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

    // Already scanning? return its current state without re-starting. Errored
    // state expires from inflight after ERROR_STATE_TTL_MS so the next poll
    // after that window will naturally start a fresh scan — that gives the UI
    // time to surface the failure instead of looping silently.
    let state = inflight.get(release.tag)
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

    // Opportunistically resolve pending analyses so the card eventually shows
    // the real verdict without anyone having to open the modal.
    if (cached?.vt?.status === 'pending' && cached.vt.analysisId) {
      const summary = await checkAnalysisOnce(cached.vt.analysisId)
      if (summary) {
        cached.vt = {
          status: 'scanned',
          stats: summary,
          verdict: summary.verdict,
          scanDate: Math.floor(Date.now() / 1000),
          permalink: cached.vt.permalink,
          submitted: true,
        }
        cached.scannedAt = Date.now()
        cache.scans[release.tag] = cached
        writeCache(cache)
      }
    }

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
