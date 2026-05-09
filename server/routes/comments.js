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
const USER_STYLES_FILE = path.join(DATA_DIR, 'comment-user-styles.json')

const DEFAULT_USERNAME_STYLE_ID = 'default'
const USERNAME_STYLE_IDS = new Set([
  DEFAULT_USERNAME_STYLE_ID,
  'neon-cyan',
  'synthwave',
  'solar-flare',
  'toxic-lime',
  'galaxy-shift',
  'ice-glitch',
  'prism-run',
  'candy-core',
  'void-pulse',
  'emerald-matrix',
  'golden-hour',
  'blood-moon',
  'ocean-byte',
  'holo-lux',
  'admin-aura',
])

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
    if (!fs.existsSync(USER_STYLES_FILE)) {
      fs.writeFileSync(USER_STYLES_FILE, JSON.stringify({}, null, 2), 'utf8')
    }
  } catch (err) {
    console.error('Error creando storage de comentarios', err)
  }
}

function sanitizeUsernameStyleId(styleId) {
  const value = String(styleId || DEFAULT_USERNAME_STYLE_ID).trim()
  return USERNAME_STYLE_IDS.has(value) ? value : null
}

function normalizeUsernameStyleId(styleId) {
  return sanitizeUsernameStyleId(styleId) || DEFAULT_USERNAME_STYLE_ID
}

function readUserStyles() {
  ensureStorage()
  try {
    const raw = fs.readFileSync(USER_STYLES_FILE, 'utf8')
    const data = raw ? JSON.parse(raw) : {}
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {}

    return Object.entries(data).reduce((acc, [userId, styleId]) => {
      const normalized = sanitizeUsernameStyleId(styleId)
      if (userId && normalized && normalized !== DEFAULT_USERNAME_STYLE_ID) {
        acc[String(userId)] = normalized
      }
      return acc
    }, {})
  } catch (e) {
    console.error('Error leyendo comment-user-styles.json', e)
    return {}
  }
}

function writeUserStyles(styles) {
  ensureStorage()
  try {
    fs.writeFileSync(USER_STYLES_FILE, JSON.stringify(styles || {}, null, 2), 'utf8')
  } catch (e) {
    console.error('Error escribiendo comment-user-styles.json', e)
  }
}

function getAuthorStyleId(author, styles) {
  if (!author?.id) return DEFAULT_USERNAME_STYLE_ID
  const userStyle = styles?.[String(author.id)]
  return normalizeUsernameStyleId(userStyle || author.nameStyleId)
}

function sortComments(list) {
  return [...list].sort((a, b) => {
    // Pinneados primero, después por fecha desc
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
    return new Date(b.createdAt) - new Date(a.createdAt)
  })
}

function readComments() {
  ensureStorage()
  try {
    const raw = fs.readFileSync(FILE, 'utf8')
    const data = raw ? JSON.parse(raw) : []
    if (!Array.isArray(data)) return []
    // Aseguramos shape consistente para replies / reactions / pinned
    return data.map((c) => {
      let reactions = {}
      if (Array.isArray(c.reactions)) {
        // Migración: shape antigua era ["😀", "❤️"]
        c.reactions.forEach((emoji) => {
          if (typeof emoji === 'string') reactions[emoji] = []
        })
      } else if (c.reactions && typeof c.reactions === 'object') {
        Object.entries(c.reactions).forEach(([emoji, users]) => {
          if (typeof emoji !== 'string') return
          if (!Array.isArray(users)) return
          reactions[emoji] = users.map((u) => String(u)).filter(Boolean)
        })
      }
      return {
        ...c,
        replies: Array.isArray(c.replies) ? c.replies : [],
        reactions,
        pinned: !!c.pinned,
      }
    })
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

function withAdminFlags(comment, styles = readUserStyles()) {
  if (!comment) return comment

  const withAuthor = comment.author
    ? {
        ...comment.author,
        isAdmin: ADMIN_IDS.includes(String(comment.author.id)),
        nameStyleId: getAuthorStyleId(comment.author, styles),
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
          nameStyleId: getAuthorStyleId(r.author, styles),
        },
      }
    }),
  }
}

async function withAvatars(comment, styles = readUserStyles()) {
  const hydrated = withAdminFlags(comment, styles)
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

function getUserStyleId(user, styles = readUserStyles()) {
  if (!user?.id) return DEFAULT_USERNAME_STYLE_ID
  return normalizeUsernameStyleId(styles[String(user.id)])
}

async function hydrateCommentsList(list, styles = readUserStyles()) {
  const raw = sortComments(list)
  return Promise.all(raw.map((c) => withAvatars(c, styles)))
}


// GET all
router.get('/', async (req, res) => {
  try {
    const styles = readUserStyles()
    const comments = await hydrateCommentsList(readComments(), styles)
    res.json({ comments })
  } catch (e) {
    console.error('Error sirviendo comentarios', e)
    res.status(500).json({ error: 'Error cargando comentarios' })
  }
})

router.get('/me/style', (req, res) => {
  const user = getUserFromRequest(req)
  if (!user) return res.json({ styleId: DEFAULT_USERNAME_STYLE_ID })

  const styles = readUserStyles()
  res.json({ styleId: getUserStyleId(user, styles) })
})

router.patch('/me/style', async (req, res) => {
  const user = getUserFromRequest(req)
  if (!user) {
    return res.status(401).json({ error: 'Debes iniciar sesión con Discord' })
  }

  const requestedStyleId = sanitizeUsernameStyleId(req.body?.styleId)
  if (!requestedStyleId) {
    return res.status(400).json({ error: 'Estilo de nombre inválido' })
  }

  const userId = String(user.id)
  const styles = readUserStyles()
  if (requestedStyleId === DEFAULT_USERNAME_STYLE_ID) {
    delete styles[userId]
  } else {
    styles[userId] = requestedStyleId
  }
  writeUserStyles(styles)

  const comments = readComments()
  let updatedCount = 0

  const syncAuthorStyle = (author) => {
    if (!author || String(author.id) !== userId) return
    if (requestedStyleId === DEFAULT_USERNAME_STYLE_ID) {
      delete author.nameStyleId
    } else {
      author.nameStyleId = requestedStyleId
    }
    updatedCount += 1
  }

  comments.forEach((comment) => {
    syncAuthorStyle(comment.author)
    const replies = Array.isArray(comment.replies) ? comment.replies : []
    replies.forEach((reply) => syncAuthorStyle(reply.author))
  })

  writeComments(comments)

  res.json({
    styleId: requestedStyleId,
    updatedCount,
    user: {
      ...user,
      nameStyleId: requestedStyleId,
    },
    comments: await hydrateCommentsList(comments, styles),
  })
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
  const styles = readUserStyles()
  const nameStyleId = getUserStyleId(user, styles)
  const trimmed = text.trim().slice(0, 1000)

  const comment = {
    id: Date.now(),
    text: trimmed,
    createdAt: new Date().toISOString(),
    author: {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      nameStyleId,
      // Este flag solo se usa al almacenar; en las respuestas se recalcula desde ADMIN_IDS
      isAdmin: ADMIN_IDS.includes(String(user.id)),
    },
    replies: [],
  }

  comments.push(comment)
  writeComments(comments)

  res.json({ comment: await withAvatars(comment, styles) })
})

// PUT edit (only author)
router.put('/:id', async (req, res) => {
  const user = getUserFromRequest(req)
  if (!user)
    return res.status(401).json({ error: 'Debes iniciar sesión con Discord' })

  const id = String(req.params.id)
  const { text } = req.body || {}

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Comentario vacío' })
  }

  const comments = readComments()
  const index = comments.findIndex((c) => String(c.id) === id)

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

  const id = String(req.params.id)
  const comments = readComments()
  const index = comments.findIndex((c) => String(c.id) === id)

  if (index === -1) {
    return res.status(404).json({ error: 'Comentario no encontrado' })
  }

  const comment = comments[index]
  const isAuthor = String(comment.author.id) === String(user.id)
  const isAdmin = !!user.isAdmin || ADMIN_IDS.includes(String(user.id))

  if (!isAuthor && !isAdmin) {
    return res.status(403).json({ error: 'No tienes permiso para eliminar' })
  }

  const remaining = comments.filter((c) => String(c.id) !== id)
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

  const id = String(req.params.id)
  const comments = readComments()
  const index = comments.findIndex((c) => String(c.id) === id)

  if (index === -1) {
    return res.status(404).json({ error: 'Comentario no encontrado' })
  }

  const trimmed = text.trim().slice(0, 1000)
  const baseComment = comments[index]
  const styles = readUserStyles()
  const nameStyleId = getUserStyleId(user, styles)

  const replies = Array.isArray(baseComment.replies) ? baseComment.replies : []

  const reply = {
    id: Date.now(),
    text: trimmed,
    createdAt: new Date().toISOString(),
    author: {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      nameStyleId,
      isAdmin: true,
    },
  }

  replies.push(reply)
  baseComment.replies = replies
  comments[index] = baseComment
  writeComments(comments)

  res.json({ comment: await withAvatars(baseComment, styles) })
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

  const commentId = String(req.params.commentId)
  const replyId = String(req.params.replyId)

  const comments = readComments()
  const index = comments.findIndex((c) => String(c.id) === commentId)
  if (index === -1) {
    return res.status(404).json({ error: 'Comentario no encontrado' })
  }

  const baseComment = comments[index]
  const replies = Array.isArray(baseComment.replies) ? baseComment.replies : []
  const replyIndex = replies.findIndex((r) => String(r.id) === replyId)

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

// POST toggle reaction (cualquier usuario logueado)
router.post('/:id/reactions', async (req, res) => {
  const user = getUserFromRequest(req)
  if (!user)
    return res.status(401).json({ error: 'Debes iniciar sesión con Discord' })

  const { emoji } = req.body || {}
  if (!emoji || typeof emoji !== 'string' || emoji.length > 16) {
    return res.status(400).json({ error: 'Emoji inválido' })
  }

  const id = String(req.params.id)
  const comments = readComments()
  const index = comments.findIndex((c) => String(c.id) === id)
  if (index === -1) {
    return res.status(404).json({ error: 'Comentario no encontrado' })
  }

  const userId = String(user.id)
  const comment = comments[index]
  const reactions =
    comment.reactions && typeof comment.reactions === 'object'
      ? { ...comment.reactions }
      : {}
  const current = Array.isArray(reactions[emoji]) ? [...reactions[emoji]] : []
  const userIndex = current.indexOf(userId)

  if (userIndex >= 0) {
    current.splice(userIndex, 1)
  } else {
    current.push(userId)
  }

  if (current.length === 0) {
    delete reactions[emoji]
  } else {
    reactions[emoji] = current
  }

  comment.reactions = reactions
  comments[index] = comment
  writeComments(comments)

  res.json({ comment: await withAvatars(comment) })
})

// POST toggle pin (admin only)
router.post('/:id/pin', async (req, res) => {
  const user = getUserFromRequest(req)
  if (!user)
    return res.status(401).json({ error: 'Debes iniciar sesión con Discord' })

  const isAdmin = !!user.isAdmin || ADMIN_IDS.includes(String(user.id))
  if (!isAdmin) {
    return res.status(403).json({ error: 'Solo el admin puede fijar comentarios' })
  }

  const id = String(req.params.id)
  const comments = readComments()
  const index = comments.findIndex((c) => String(c.id) === id)
  if (index === -1) {
    return res.status(404).json({ error: 'Comentario no encontrado' })
  }

  const comment = comments[index]
  comment.pinned = !comment.pinned
  comments[index] = comment
  writeComments(comments)

  res.json({ comment: await withAvatars(comment) })
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

  const commentId = String(req.params.commentId)
  const replyId = String(req.params.replyId)

  const comments = readComments()
  const index = comments.findIndex((c) => String(c.id) === commentId)
  if (index === -1) {
    return res.status(404).json({ error: 'Comentario no encontrado' })
  }

  const baseComment = comments[index]
  const replies = Array.isArray(baseComment.replies) ? baseComment.replies : []
  const filteredReplies = replies.filter((r) => String(r.id) !== replyId)

  baseComment.replies = filteredReplies
  comments[index] = baseComment
  writeComments(comments)

  res.json({ comment: await withAvatars(baseComment) })
})

module.exports = { router }
