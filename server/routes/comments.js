const express = require('express')
const fs = require('fs')
const path = require('path')
const { getUserFromRequest } = require('../utils/session')

const router = express.Router()

// Usar disco persistente si está configurado, si no, caer en /data local (útil en dev)
const DATA_DIR =
  process.env.COMMENTS_DATA_DIR ||
  path.join(__dirname, '..', '..', 'data')

const FILE = path.join(DATA_DIR, 'comments.json')

// IDs de admins (separados por coma en la env var)
const ADMIN_IDS = (process.env.ADMIN_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

// Aseguramos que la carpeta y el archivo existan
function ensureStorage() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    if (!fs.existsSync(FILE)) {
      fs.writeFileSync(FILE, JSON.stringify([], null, 2), 'utf8')
    }
  } catch (err) {
    console.error('Error creando storage de comentarios', err)
  }
}

function readComments() {
  ensureStorage()
  try {
    const raw = fs.readFileSync(FILE, 'utf8')
    const data = JSON.parse(raw || '[]')
    if (!Array.isArray(data)) return []
    return data
  } catch (e) {
    console.error('Error leyendo comments.json', e)
    return []
  }
}

function writeComments(list) {
  ensureStorage()
  try {
    fs.writeFileSync(FILE, JSON.stringify(list, null, 2), 'utf8')
  } catch (e) {
    console.error('Error escribiendo comments.json', e)
  }
}

// GET all
router.get('/', (req, res) => {
  const comments = readComments()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((c) => ({
      ...c,
      author: {
        ...c.author,
        isAdmin:
          c.author?.isAdmin ||
          ADMIN_IDS.includes(String(c.author?.id || '')),
      },
    }))

  res.json({ comments })
})

// POST new (requires auth)
router.post('/', (req, res) => {
  const user = getUserFromRequest(req)
  if (!user)
    return res.status(401).json({ error: 'Debes iniciar sesión con Discord' })

  const { text } = req.body || {}
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Comentario vacío' })
  }

  const comments = readComments()
  const comment = {
    id: Date.now(),
    text: text.trim().slice(0, 2000),
    createdAt: new Date().toISOString(),
    author: {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      isAdmin: ADMIN_IDS.includes(String(user.id)),
    },
  }
  comments.push(comment)
  writeComments(comments)
  res.json({ comment })
})

// PUT update (author or admin)
router.put('/:id', (req, res) => {
  const user = getUserFromRequest(req)
  if (!user)
    return res.status(401).json({ error: 'Debes iniciar sesión con Discord' })

  const id = Number(req.params.id)
  const { text } = req.body || {}
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Comentario vacío' })
  }

  const comments = readComments()
  const index = comments.findIndex((c) => c.id === id)

  if (index === -1) {
    return res.status(404).json({ error: 'Comentario no encontrado' })
  }

  const comment = comments[index]
  const isAuthor = String(comment.author.id) === String(user.id)
  const isAdmin = ADMIN_IDS.includes(String(user.id))

  if (!isAuthor && !isAdmin) {
    return res.status(403).json({ error: 'No tienes permiso para editar' })
  }

  comment.text = text.trim().slice(0, 2000)
  comment.updatedAt = new Date().toISOString()
  comments[index] = comment
  writeComments(comments)
  res.json({ comment })
})

// DELETE comment (author or admin)
router.delete('/:id', (req, res) => {
  const user = getUserFromRequest(req)
  if (!user)
    return res.status(401).json({ error: 'Debes iniciar sesión con Discord' })

  const id = Number(req.params.id)
  const comments = readComments()
  const index = comments.findIndex((c) => c.id === id)

  if (index === -1) {
    return res.status(404).json({ error: 'Comentario no encontrado' })
  }

  const comment = comments[index]
  const isAuthor = String(comment.author.id) === String(user.id)
  const isAdmin = ADMIN_IDS.includes(String(user.id))

  if (!isAuthor && !isAdmin) {
    return res.status(403).json({ error: 'No tienes permiso para eliminar' })
  }

  const remaining = comments.filter((c) => c.id !== id)
  writeComments(remaining)
  res.json({ success: true })
})

module.exports = { router }
