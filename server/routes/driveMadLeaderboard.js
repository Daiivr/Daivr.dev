const express = require('express')
const fs = require('fs')
const path = require('path')
const { getUserFromRequest } = require('../utils/session')

const router = express.Router()

const DATA_DIR =
  process.env.DRIVE_MAD_DATA_DIR ||
  process.env.GAME_DATA_DIR ||
  path.join(__dirname, '..', '..', 'data')

const FILE = path.join(DATA_DIR, 'drive-mad-leaderboard.json')
const MAX_LEVEL = 10000
const MAX_TIME_MS = 24 * 60 * 60 * 1000

function ensureStorage() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    if (!fs.existsSync(FILE)) {
      fs.writeFileSync(FILE, JSON.stringify({ scores: [] }, null, 2), 'utf8')
    }
  } catch (err) {
    console.error('Error creando storage de Drive Mad leaderboard', err)
  }
}

function readData() {
  ensureStorage()
  try {
    const raw = fs.readFileSync(FILE, 'utf8')
    const parsed = raw ? JSON.parse(raw) : { scores: [] }
    if (Array.isArray(parsed)) return { scores: parsed }
    if (!parsed || !Array.isArray(parsed.scores)) return { scores: [] }
    return parsed
  } catch (err) {
    console.error('Error leyendo drive-mad-leaderboard.json', err)
    return { scores: [] }
  }
}

function writeData(data) {
  ensureStorage()
  try {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8')
  } catch (err) {
    console.error('Error escribiendo drive-mad-leaderboard.json', err)
  }
}

function clampPositiveInteger(value, fallback = null, max = MAX_LEVEL) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  const next = Math.floor(number)
  if (next < 1) return fallback
  return Math.min(next, max)
}

function clampTimeMs(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  if (number < 0) return null
  return Math.min(Math.round(number), MAX_TIME_MS)
}

function sortScores(scores) {
  return [...scores].sort((a, b) => {
    const levelDiff = (b.highestLevel || 0) - (a.highestLevel || 0)
    if (levelDiff !== 0) return levelDiff

    const aTime = Number.isFinite(a.bestTimeMs)
      ? a.bestTimeMs
      : Number.MAX_SAFE_INTEGER
    const bTime = Number.isFinite(b.bestTimeMs)
      ? b.bestTimeMs
      : Number.MAX_SAFE_INTEGER
    if (aTime !== bTime) return aTime - bTime

    return new Date(a.updatedAt || 0).getTime() - new Date(b.updatedAt || 0).getTime()
  })
}

function publicScore(score, index = 0) {
  return {
    rank: index + 1,
    discordId: String(score.discordId || ''),
    username: score.username || 'Discord user',
    avatarUrl: score.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png',
    highestLevel: score.highestLevel || 0,
    bestTimeMs: Number.isFinite(score.bestTimeMs) ? score.bestTimeMs : null,
    updatedAt: score.updatedAt || null,
    lastSeenAt: score.lastSeenAt || null,
  }
}

function leaderboardResponse(limit = 10) {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50)
  const data = readData()
  const leaderboard = sortScores(data.scores)
    .slice(0, safeLimit)
    .map((score, index) => publicScore(score, index))
  return { leaderboard }
}

router.get('/leaderboard', (req, res) => {
  res.json(leaderboardResponse(req.query.limit))
})

router.get('/me', (req, res) => {
  const user = getUserFromRequest(req)
  if (!user) return res.json({ score: null })

  const data = readData()
  const scores = sortScores(data.scores)
  const index = scores.findIndex((score) => String(score.discordId) === String(user.id))
  if (index === -1) return res.json({ score: null })

  res.json({ score: publicScore(scores[index], index) })
})

router.post('/progress', (req, res) => {
  const user = getUserFromRequest(req)
  if (!user) {
    return res.status(401).json({ error: 'Debes iniciar sesion con Discord' })
  }

  const body = req.body || {}
  const eventName = String(body.event || '').slice(0, 40)
  const requestedDiscordId = body.discordId ? String(body.discordId) : null
  if (requestedDiscordId && requestedDiscordId !== String(user.id)) {
    return res.status(403).json({ error: 'Discord ID no coincide con la sesion' })
  }

  if (eventName !== 'level-complete' || body.completed !== true) {
    const data = readData()
    const scores = sortScores(Array.isArray(data.scores) ? data.scores : [])
    const userId = String(user.id)
    const index = scores.findIndex((score) => String(score.discordId) === userId)

    return res.status(202).json({
      ignored: true,
      reason: 'completion-required',
      score: index >= 0 ? publicScore(scores[index], index) : null,
      ...leaderboardResponse(10),
    })
  }

  const levelFromBody = clampPositiveInteger(body.level)
  const levelFromIndex =
    body.levelIndex === undefined
      ? null
      : clampPositiveInteger(Number(body.levelIndex) + 1)
  const highestLevel = levelFromBody || levelFromIndex
  if (!highestLevel) {
    return res.status(400).json({ error: 'Nivel invalido' })
  }

  const bestTimeMs = clampTimeMs(
    body.reachedAtMs ?? body.timeMs ?? body.elapsedMs ?? body.playTimeMs,
  )
  if (bestTimeMs === null) {
    return res.status(400).json({ error: 'Tiempo invalido' })
  }

  const now = new Date().toISOString()
  const data = readData()
  const scores = Array.isArray(data.scores) ? data.scores : []
  const userId = String(user.id)
  const index = scores.findIndex((score) => String(score.discordId) === userId)
  const current =
    index >= 0
      ? scores[index]
      : {
          discordId: userId,
          createdAt: now,
          submissions: 0,
        }

  const currentLevel = clampPositiveInteger(current.highestLevel, 0) || 0
  const currentTime = Number.isFinite(current.bestTimeMs)
    ? current.bestTimeMs
    : Number.MAX_SAFE_INTEGER
  const isBetter =
    highestLevel > currentLevel ||
    (highestLevel === currentLevel && bestTimeMs < currentTime)

  const next = {
    ...current,
    discordId: userId,
    username: user.username || current.username || 'Discord user',
    avatarUrl:
      user.avatarUrl ||
      current.avatarUrl ||
      'https://cdn.discordapp.com/embed/avatars/0.png',
    highestLevel: isBetter ? highestLevel : currentLevel,
    bestTimeMs: isBetter ? bestTimeMs : current.bestTimeMs,
    bestSessionId: isBetter ? String(body.sessionId || '') : current.bestSessionId,
    bestEvent: isBetter ? eventName : current.bestEvent,
    updatedAt: isBetter ? now : current.updatedAt || now,
    lastSeenAt: now,
    lastLevel: highestLevel,
    lastTimeMs: bestTimeMs,
    submissions: (Number(current.submissions) || 0) + 1,
  }

  if (index >= 0) scores[index] = next
  else scores.push(next)

  writeData({ ...data, scores })

  const sorted = sortScores(scores)
  const rank = sorted.findIndex((score) => String(score.discordId) === userId)
  res.json({
    score: publicScore(next, rank >= 0 ? rank : 0),
    ...leaderboardResponse(10),
  })
})

module.exports = { router }
