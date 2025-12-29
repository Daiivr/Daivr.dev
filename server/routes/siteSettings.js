const express = require('express')
const fs = require('fs')
const path = require('path')
const { getUserFromRequest } = require('../utils/session')

const router = express.Router()

// Directorio de almacenamiento persistente (Render: /var/data recomendado)
const DATA_DIR =
  process.env.THEME_DATA_DIR ||
  process.env.VISITS_DATA_DIR ||
  process.env.DATA_DIR ||
  path.join(__dirname, '..', '..', 'data')

const FILE = path.join(DATA_DIR, 'site-settings.json')

function ensureStorage() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    if (!fs.existsSync(FILE)) {
      fs.writeFileSync(FILE, JSON.stringify({ christmasEnabled: false }, null, 2), 'utf8')
    }
  } catch (err) {
    console.error('Error preparando site-settings.json', err)
  }
}

function readSettings() {
  ensureStorage()
  try {
    const raw = fs.readFileSync(FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return {
      christmasEnabled: !!parsed.christmasEnabled,
    }
  } catch (err) {
    console.error('Error leyendo site-settings.json', err)
    return { christmasEnabled: false }
  }
}

function writeSettings(next) {
  ensureStorage()
  try {
    fs.writeFileSync(FILE, JSON.stringify(next, null, 2), 'utf8')
    return true
  } catch (err) {
    console.error('Error escribiendo site-settings.json', err)
    return false
  }
}

// Público: el site necesita saber si está ON u OFF
router.get('/', (req, res) => {
  res.json(readSettings())
})

// Solo admin: cambiar settings
router.post('/', (req, res) => {
  const me = getUserFromRequest(req)
  if (!me || !me.isAdmin) {
    return res.status(403).json({ error: 'forbidden' })
  }

  const current = readSettings()
  const christmasEnabled = typeof req.body?.christmasEnabled === 'boolean'
    ? req.body.christmasEnabled
    : current.christmasEnabled

  const next = { ...current, christmasEnabled }

  const ok = writeSettings(next)
  if (!ok) return res.status(500).json({ error: 'write-failed' })

  res.json(next)
})

module.exports = { router }
