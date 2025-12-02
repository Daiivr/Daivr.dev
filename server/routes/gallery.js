const express = require('express')
const path = require('path')
const fs = require('fs')
const multer = require('multer')
const { getUserFromRequest } = require('../utils/session')

const router = express.Router()
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads')
const OWNER_ID = '271701484922601472'

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

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
  const entries = fs.readdirSync(UPLOAD_DIR)
  return entries
    .filter((f) => !f.startsWith('.'))
    .map((filename) => {
      const fullPath = path.join(UPLOAD_DIR, filename)
      const stat = fs.statSync(fullPath)
      return {
        filename,
        url: '/uploads/' + filename,
        sizeKB: Math.round(stat.size / 1024),
      }
    })
    .sort((a, b) => b.filename.localeCompare(a.filename))
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
  res.status(201).json({
    file: {
      filename: req.file.filename,
      url: '/uploads/' + req.file.filename,
      sizeKB: Math.round(stat.size / 1024),
      originalName: req.file.originalname,
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

  fs.unlinkSync(target)
  return res.json({ ok: true })
})

module.exports = { router }
