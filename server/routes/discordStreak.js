const express = require('express')
const fs = require('fs')
const path = require('path')
const axios = require('axios')

const router = express.Router()

const LOCAL_DATA_DIR = path.join(__dirname, '..', '..', 'data')
const RENDER_DATA_DIR = '/var/data'

function getRenderDataDir() {
  try {
    return fs.existsSync(RENDER_DATA_DIR) && fs.statSync(RENDER_DATA_DIR).isDirectory()
      ? RENDER_DATA_DIR
      : null
  } catch {
    return null
  }
}

const DATA_DIR =
  process.env.STREAK_DATA_DIR ||
  process.env.GAME_DATA_DIR ||
  process.env.DATA_DIR ||
  process.env.COMMENTS_DATA_DIR ||
  getRenderDataDir() ||
  LOCAL_DATA_DIR

const FILE = path.join(DATA_DIR, 'discord-streak.json')
const LEGACY_FILE = path.join(LOCAL_DATA_DIR, 'discord-streak.json')

const DISCORD_ID = process.env.DISCORD_USER_ID || '271701484922601472'
const POLL_MS = Number(process.env.STREAK_POLL_MS) || 60_000

function ensureStorage() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    if (!fs.existsSync(FILE)) {
      if (path.resolve(FILE) !== path.resolve(LEGACY_FILE) && fs.existsSync(LEGACY_FILE)) {
        fs.copyFileSync(LEGACY_FILE, FILE)
      } else {
        fs.writeFileSync(
          FILE,
          JSON.stringify({ currentGame: null, games: {} }, null, 2),
          'utf8'
        )
      }
    }
  } catch (err) {
    console.error('Error creando storage de streak', err)
  }
}

function emptyState() {
  return { currentGame: null, games: {} }
}

function normalizeGameRecord(record) {
  if (!record || typeof record !== 'object') {
    return { streak: 0, lastDay: null }
  }

  return {
    streak: Number.isFinite(record.streak) ? record.streak : 0,
    lastDay: typeof record.lastDay === 'string' ? record.lastDay : null,
  }
}

function normalizeState(data) {
  if (!data || typeof data !== 'object') return emptyState()

  if (data.games && typeof data.games === 'object' && !Array.isArray(data.games)) {
    const games = Object.entries(data.games).reduce((acc, [gameName, record]) => {
      if (typeof gameName === 'string' && gameName.trim()) {
        acc[gameName] = normalizeGameRecord(record)
      }
      return acc
    }, {})

    return {
      currentGame:
        typeof data.currentGame === 'string' && data.currentGame.trim()
          ? data.currentGame
          : null,
      games,
    }
  }

  // Legacy format: { game, streak, lastDay }
  if (typeof data.game === 'string' && data.game.trim()) {
    return {
      currentGame: data.game,
      games: {
        [data.game]: normalizeGameRecord(data),
      },
    }
  }

  return emptyState()
}

function readState() {
  ensureStorage()
  try {
    const raw = fs.readFileSync(FILE, 'utf8')
    const data = raw ? JSON.parse(raw) : null
    return normalizeState(data)
  } catch (e) {
    console.error('Error leyendo discord-streak.json', e)
    return emptyState()
  }
}

function writeState(state) {
  ensureStorage()
  try {
    fs.writeFileSync(FILE, JSON.stringify(state, null, 2), 'utf8')
  } catch (e) {
    console.error('Error escribiendo discord-streak.json', e)
  }
}

// "YYYY-MM-DD" en zona local
function todayKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function daysBetween(a, b) {
  if (!a || !b) return Infinity
  const da = new Date(`${a}T00:00:00`)
  const db = new Date(`${b}T00:00:00`)
  return Math.round((db - da) / 86_400_000)
}

function getGameRecord(state, gameName) {
  return normalizeGameRecord(state.games?.[gameName])
}

// Marca un día de juego para ese juego sin tocar los streaks de otros juegos
function applyGameDay(state, gameName, today) {
  const current = getGameRecord(state, gameName)
  const gap = daysBetween(current.lastDay, today)

  const nextRecord =
    gap === 0
      ? current
      : {
          streak: gap === 1 ? current.streak + 1 : 1,
          lastDay: today,
        }

  return {
    ...state,
    currentGame: gameName,
    games: {
      ...state.games,
      [gameName]: nextRecord,
    },
  }
}

// El streak sigue "vivo" si jugaste hoy o ayer
function isStreakAlive(state, today = todayKey()) {
  if (!state || !state.lastDay) return false
  const gap = daysBetween(state.lastDay, today)
  return gap <= 1
}

async function pollLanyardOnce() {
  try {
    const res = await axios.get(
      `https://api.lanyard.rest/v1/users/${DISCORD_ID}`,
      { timeout: 8000 }
    )
    const data = res.data?.data
    if (!data) return

    const activities = Array.isArray(data.activities) ? data.activities : []
    const main = activities.find((a) => a && a.type === 0)
    if (!main || !main.name) return

    const today = todayKey()
    const state = readState()
    const next = applyGameDay(state, main.name, today)
    const previous = getGameRecord(state, main.name)
    const current = getGameRecord(next, main.name)

    if (
      next.currentGame !== state.currentGame ||
      current.streak !== previous.streak ||
      current.lastDay !== previous.lastDay
    ) {
      writeState(next)
    }
  } catch (err) {
    // silencioso — Lanyard puede dar 404 si no está suscrito al user
    if (err.response?.status !== 404) {
      console.error('Streak poll error:', err.message || err)
    }
  }
}

let pollHandle = null
function startPoller() {
  if (pollHandle) return
  // primer poll inmediato + intervalo
  pollLanyardOnce()
  pollHandle = setInterval(pollLanyardOnce, POLL_MS)
  if (typeof pollHandle.unref === 'function') pollHandle.unref()
}

router.get('/', (req, res) => {
  const state = readState()
  const today = todayKey()
  const game = state.currentGame
  const current = game ? getGameRecord(state, game) : normalizeGameRecord()
  const alive = isStreakAlive(current, today)
  res.json({
    game,
    streak: alive ? current.streak : 0,
    lastDay: current.lastDay,
    alive,
  })
})

module.exports = { router, startPoller }
