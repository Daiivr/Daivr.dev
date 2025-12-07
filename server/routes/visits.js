const express = require('express')
const fs = require('fs')
const path = require('path')

const router = express.Router()

// Directorio de almacenamiento (permite override por env para hosting)
const DATA_DIR =
  process.env.VISITS_DATA_DIR || path.join(__dirname, '..', '..', 'data')

const FILE = path.join(DATA_DIR, 'visits.json')

function ensureStorage() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    if (!fs.existsSync(FILE)) {
      const initial = { count: 0 }
      fs.writeFileSync(FILE, JSON.stringify(initial, null, 2), 'utf8')
    }
  } catch (err) {
    console.error('Error creando storage de visitas', err)
  }
}

function readVisits() {
  ensureStorage()
  try {
    const raw = fs.readFileSync(FILE, 'utf8')
    if (!raw) return { count: 0 }
    const data = JSON.parse(raw)
    if (typeof data.count !== 'number' || data.count < 0) {
      return { count: 0 }
    }
    return data
  } catch (err) {
    console.error('Error leyendo visits.json', err)
    return { count: 0 }
  }
}

function writeVisits(data) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8')
  } catch (err) {
    console.error('Error escribiendo visits.json', err)
  }
}

// Devuelve solo el contador actual (sin incrementarlo)
router.get('/', (req, res) => {
  const data = readVisits()
  res.json({ count: data.count })
})

// Marca una visita nueva e incrementa el contador
router.post('/hit', (req, res) => {
  const data = readVisits()
  data.count += 1
  writeVisits(data)
  res.json({ count: data.count })
})

module.exports = { router }
