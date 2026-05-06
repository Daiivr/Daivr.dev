const express = require('express')
const fs = require('fs')
const path = require('path')
const axios = require('axios')

const router = express.Router()

const DATA_DIR =
  process.env.STREAK_DATA_DIR ||
  process.env.COMMENTS_DATA_DIR ||
  path.join(__dirname, '..', '..', 'data')

const FILE = path.join(DATA_DIR, 'discord-streak.json')

const DISCORD_ID = process.env.DISCORD_USER_ID || '271701484922601472'
const POLL_MS = Number(process.env.STREAK_POLL_MS) || 60_000

function ensureStorage() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    if (!fs.existsSync(FILE)) {
      fs.writeFileSync(
        FILE,
        JSON.stringify({ game: null, streak: 0, lastDay: null }, null, 2),
        'utf8'
      )
    }
  } catch (err) {
    console.error('Error creando storage de streak', err)
  }
}

function readState() {
  ensureStorage()
  try {
    const raw = fs.readFileSync(FILE, 'utf8')
    const data = raw ? JSON.parse(raw) : null
    if (!data || typeof data !== 'object') {
      return { game: null, streak: 0, lastDay: null }
    }
    return {
      game: typeof data.game === 'string' ? data.game : null,
      streak: Number.isFinite(data.streak) ? data.streak : 0,
      lastDay: typeof data.lastDay === 'string' ? data.lastDay : null,
    }
  } catch (e) {
    console.error('Error leyendo discord-streak.json', e)
    return { game: null, streak: 0, lastDay: null }
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

// Marca un día de juego con el juego dado y devuelve el nuevo estado
function applyGameDay(state, gameName, today) {
  const sameGame = state.game === gameName
  const gap = daysBetween(state.lastDay, today)

  if (sameGame && gap === 0) return state // ya contado hoy
  if (sameGame && gap === 1) {
    return { game: gameName, streak: state.streak + 1, lastDay: today }
  }
  // juego nuevo, o gap > 1, o sin lastDay
  return { game: gameName, streak: 1, lastDay: today }
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

    if (
      next.game !== state.game ||
      next.streak !== state.streak ||
      next.lastDay !== state.lastDay
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
  const alive = isStreakAlive(state, today)
  res.json({
    game: state.game,
    streak: alive ? state.streak : 0,
    lastDay: state.lastDay,
    alive,
  })
})

module.exports = { router, startPoller }
