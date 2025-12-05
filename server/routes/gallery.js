const express = require('express')
const path = require('path')
const fs = require('fs')
const multer = require('multer')
const { getUserFromRequest } = require('../utils/session')

const router = express.Router()

// Directorio de subidas (usa disco persistente si está configurado)
const UPLOAD_DIR =
  process.env.GALLERY_UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads')

// Archivo de metadatos para nombres bonitos, fechas, etc.
const META_FILE = path.join(UPLOAD_DIR, 'gallery-meta.json')

// Solo el dueño puede subir / borrar
const OWNER_ID = '271701484922601472'

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })
if (!fs.existsSync(META_FILE)) fs.writeFileSync(META_FILE, JSON.stringify([], null, 2), 'utf8')

function readMeta() {
  try {
    if (!fs.existsSync(META_FILE)) {
      return []
    }
    const raw = fs.readFileSync(META_FILE, 'utf8')
    const data = raw ? JSON.parse(raw) : []
    if (!Array.isArray(data)) return []
    return data
  } catch (e) {
    console.error('Error leyendo gallery-meta.json', e)
    return []
  }
}

function writeMeta(list) {
  try {
    fs.writeFileSync(META_FILE, JSON.stringify(list, null, 2), 'utf8')
  } catch (e) {
    console.error('Error escribiendo gallery-meta.json', e)
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]+/gi, '_')
    const name = base + '_' + Date.now() + ext.toLowerCase()
    cb(null, name)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
})

function listFiles() {
  if (!fs.existsSync(UPLOAD_DIR)) return []

  const meta = readMeta()
  const entries = fs.readdirSync(UPLOAD_DIR)
  const metaName = path.basename(META_FILE)

  return entries
    .filter((f) => !f.startsWith('.') && f !== metaName)
    .map((filename) => {
      const fullPath = path.join(UPLOAD_DIR, filename)
      const stat = fs.statSync(fullPath)

      const metaEntry = meta.find((m) => m.filename === filename) || {}

      const size = stat.size
      const createdAt =
        metaEntry.createdAt ||
        (stat.birthtime instanceof Date && !Number.isNaN(stat.birthtime.getTime())
          ? stat.birthtime.toISOString()
          : new Date().toISOString())

      const originalName = metaEntry.originalName || filename
      const displayName =
        metaEntry.displayName || metaEntry.originalName || originalName || filename

      const description = metaEntry.description || ''
      return {
        filename,
        url: '/uploads/' + filename,
        size,
        sizeKB: Math.round(size / 1024),
        originalName,
        displayName,
        description,
        createdAt,
      }
    })
    .sort((a, b) => {
      // ordena por fecha de creación descendente
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
}

router.get('/', (req, res) => {
  const files = listFiles()
  res.json({ files })
})

router.post('/', upload.single('file'), (req, res) => {
  const user = getUserFromRequest(req)
  if (!user || user.id !== OWNER_ID) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
    return res.status(403).json({ error: 'Solo el dueño puede subir imágenes.' })
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No se envió archivo.' })
  }

  const stat = fs.statSync(req.file.path)

  const rawDisplayName = (req.body.displayName || '').toString().trim()
  const rawDescription = (req.body.description || '').toString().trim()
  const originalName = path.basename(req.file.originalname)
  const displayName = rawDisplayName || originalName
  const description = rawDescription || ''
  const createdAt = new Date().toISOString()

  // Guardar metadatos
  const meta = readMeta()
  meta.push({
    filename: req.file.filename,
    originalName,
    displayName,
    description,
    createdAt,
  })
  writeMeta(meta)

  res.status(201).json({
    file: {
      filename: req.file.filename,
      url: '/uploads/' + req.file.filename,
      size: stat.size,
      sizeKB: Math.round(stat.size / 1024),
      originalName,
      displayName,
      description,
      createdAt,
    },
  })
})

router.delete('/:filename', (req, res) => {
  const user = getUserFromRequest(req)
  if (!user || user.id !== OWNER_ID) {
    return res.status(403).json({ error: 'Solo el dueño puede borrar imágenes.' })
  }

  const safeName = path.basename(req.params.filename)
  const target = path.join(UPLOAD_DIR, safeName)

  if (!fs.existsSync(target)) {
    return res.status(404).json({ error: 'Archivo no encontrado.' })
  }

  // Borrar archivo físico
  fs.unlinkSync(target)

  // Borrar metadatos
  const meta = readMeta()
  const remaining = meta.filter((m) => m.filename !== safeName)
  writeMeta(remaining)

  return res.json({ ok: true })
})

module.exports = { router }
