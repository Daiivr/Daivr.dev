const express = require('express')
const fs = require('fs')
const path = require('path')
const { getUserFromRequest } = require('../utils/session')
const { getDiscordAvatarUrl } = require('../utils/discordAvatar')

const router = express.Router()

// Directorio de almacenamiento (usa el disco persistente si está configurado)
const DATA_DIR =
  process.env.COMMENTS_DATA_DIR || path.join(__dirname, '..', '..', 'data')

const FILE = path.join(DATA_DIR, 'comments.json')

// IDs de admins leídos desde .env: ADMIN_IDS=id1,id2
const ADMIN_IDS = (process.env.ADMIN_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

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
    const data = raw ? JSON.parse(raw) : []
    if (!Array.isArray(data)) return []
    // Aseguramos que siempre exista replies como array
    return data.map((c) => ({
      ...c,
      replies: Array.isArray(c.replies) ? c.replies : [],
    }))
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

function withAdminFlags(comment) {
  if (!comment) return comment

  const withAuthor = comment.author
    ? {
        ...comment.author,
        isAdmin: ADMIN_IDS.includes(String(comment.author.id)),
      }
    : comment.author

  const replies = Array.isArray(comment.replies) ? comment.replies : []

  return {
    ...comment,
    author: withAuthor,
    replies: replies.map((r) => {
      if (!r.author) return r
      return {
        ...r,
        author: {
          ...r.author,
          isAdmin: ADMIN_IDS.includes(String(r.author.id)),
        },
      }
    }),
  }
}

async function withAvatars(comment) {
  const hydrated = withAdminFlags(comment)
  const token = process.env.DISCORD_BOT_TOKEN

  // Si hay Bot Token, resolvemos el avatar actual. Si no, dejamos el guardado
  // y nos aseguramos de que exista un fallback para evitar img rota.
  if (hydrated?.author?.id) {
    if (token) hydrated.author.avatarUrl = await getDiscordAvatarUrl(hydrated.author.id, 64)
    if (!hydrated.author.avatarUrl) {
      hydrated.author.avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png'
    }
  }

  const replies = Array.isArray(hydrated.replies) ? hydrated.replies : []
  hydrated.replies = await Promise.all(
    replies.map(async (r) => {
      if (!r) return r
      if (!r.author?.id) return r

      const next = { ...r, author: { ...r.author } }
      if (token) next.author.avatarUrl = await getDiscordAvatarUrl(next.author.id, 64)
      if (!next.author.avatarUrl) {
        next.author.avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png'
      }
      return next
    })
  )

  return hydrated
}


// GET all
router.get('/', async (req, res) => {
  try {
    const raw = readComments().sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    )

    const comments = await Promise.all(raw.map((c) => withAvatars(c)))
    res.json({ comments })
  } catch (e) {
    console.error('Error sirviendo comentarios', e)
    res.status(500).json({ error: 'Error cargando comentarios' })
  }
})


// POST new (requires auth)
router.post('/', async (req, res) => {
  const user = getUserFromRequest(req)
  if (!user)
    return res.status(401).json({ error: 'Debes iniciar sesión con Discord' })

  const { text } = req.body || {}
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Comentario vacío' })
  }

  const comments = readComments()
  const trimmed = text.trim().slice(0, 1000)

  const comment = {
    id: Date.now(),
    text: trimmed,
    createdAt: new Date().toISOString(),
    author: {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      // Este flag solo se usa al almacenar; en las respuestas se recalcula desde ADMIN_IDS
      isAdmin: ADMIN_IDS.includes(String(user.id)),
    },
    replies: [],
  }

  comments.push(comment)
  writeComments(comments)

  res.json({ comment: await withAvatars(comment) })
})

// PUT edit (only author)
router.put('/:id', async (req, res) => {
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

  if (!isAuthor) {
    return res.status(403).json({ error: 'No tienes permiso para editar' })
  }

  comment.text = text.trim().slice(0, 1000)
  comment.updatedAt = new Date().toISOString()
  comments[index] = comment
  writeComments(comments)

  res.json({ comment: await withAvatars(comment) })
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
  const isAdmin = !!user.isAdmin || ADMIN_IDS.includes(String(user.id))

  if (!isAuthor && !isAdmin) {
    return res.status(403).json({ error: 'No tienes permiso para eliminar' })
  }

  const remaining = comments.filter((c) => c.id !== id)
  writeComments(remaining)

  res.json({ success: true })
})

// POST reply (solo admin puede responder)
router.post('/:id/replies', async (req, res) => {
  const user = getUserFromRequest(req)
  if (!user)
    return res.status(401).json({ error: 'Debes iniciar sesión con Discord' })

  const isAdmin = !!user.isAdmin || ADMIN_IDS.includes(String(user.id))
  if (!isAdmin) {
    return res
      .status(403)
      .json({ error: 'Solo el admin puede responder a los comentarios' })
  }

  const { text } = req.body || {}
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Respuesta vacía' })
  }

  const id = Number(req.params.id)
  const comments = readComments()
  const index = comments.findIndex((c) => c.id === id)

  if (index === -1) {
    return res.status(404).json({ error: 'Comentario no encontrado' })
  }

  const trimmed = text.trim().slice(0, 1000)
  const baseComment = comments[index]

  const replies = Array.isArray(baseComment.replies) ? baseComment.replies : []

  const reply = {
    id: Date.now(),
    text: trimmed,
    createdAt: new Date().toISOString(),
    author: {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      isAdmin: true,
    },
  }

  replies.push(reply)
  baseComment.replies = replies
  comments[index] = baseComment
  writeComments(comments)

  res.json({ comment: await withAvatars(baseComment) })
})

// PUT reply (editar respuesta del admin)
router.put('/:commentId/replies/:replyId', async (req, res) => {
  const user = getUserFromRequest(req)
  if (!user)
    return res.status(401).json({ error: 'Debes iniciar sesión con Discord' })

  const isAdmin = !!user.isAdmin || ADMIN_IDS.includes(String(user.id))
  if (!isAdmin) {
    return res
      .status(403)
      .json({ error: 'Solo el admin puede editar respuestas' })
  }

  const { text } = req.body || {}
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Respuesta vacía' })
  }

  const commentId = Number(req.params.commentId)
  const replyId = Number(req.params.replyId)

  const comments = readComments()
  const index = comments.findIndex((c) => c.id === commentId)
  if (index === -1) {
    return res.status(404).json({ error: 'Comentario no encontrado' })
  }

  const baseComment = comments[index]
  const replies = Array.isArray(baseComment.replies) ? baseComment.replies : []
  const replyIndex = replies.findIndex((r) => r.id === replyId)

  if (replyIndex === -1) {
    return res.status(404).json({ error: 'Respuesta no encontrada' })
  }

  replies[replyIndex].text = text.trim().slice(0, 1000)
  replies[replyIndex].updatedAt = new Date().toISOString()

  baseComment.replies = replies
  comments[index] = baseComment
  writeComments(comments)

  res.json({ comment: await withAvatars(baseComment) })
})

// DELETE reply (eliminar respuesta del admin)
router.delete('/:commentId/replies/:replyId', async (req, res) => {
  const user = getUserFromRequest(req)
  if (!user)
    return res.status(401).json({ error: 'Debes iniciar sesión con Discord' })

  const isAdmin = !!user.isAdmin || ADMIN_IDS.includes(String(user.id))
  if (!isAdmin) {
    return res
      .status(403)
      .json({ error: 'Solo el admin puede eliminar respuestas' })
  }

  const commentId = Number(req.params.commentId)
  const replyId = Number(req.params.replyId)

  const comments = readComments()
  const index = comments.findIndex((c) => c.id === commentId)
  if (index === -1) {
    return res.status(404).json({ error: 'Comentario no encontrado' })
  }

  const baseComment = comments[index]
  const replies = Array.isArray(baseComment.replies) ? baseComment.replies : []
  const filteredReplies = replies.filter((r) => r.id !== replyId)

  baseComment.replies = filteredReplies
  comments[index] = baseComment
  writeComments(comments)

  res.json({ comment: await withAvatars(baseComment) })
})

module.exports = { router }
