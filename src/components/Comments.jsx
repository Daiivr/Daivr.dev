import React, { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import ModalPortal from './ModalPortal'

const MAX_COMMENT_LENGTH = 2000
const COMMENTS_PER_PAGE = 6

const REACTION_PRESETS = ['😀', '😂', '😍', '😢', '😡', '❤️', '👍', '👎', '🎉', '🔥', '💀', '✨']

const TENOR_API_KEY = import.meta.env.VITE_TENOR_API_KEY
const TENOR_CLIENT_KEY = 'daivr-dev-comments'
const TENOR_LIMIT = 48

const GIF_LINE_REGEX =
  /^(https?:\/\/(?:media|c)\.tenor\.com\/\S+|https?:\/\/tenor\.com\/view\/\S+)/i

// Markdown inline: **bold**, *italic*, `code`. Code wins (no nesting inside it).
const MD_PATTERNS = [
  { regex: /`([^`\n]+)`/, tag: 'code', cls: 'md-code' },
  { regex: /\*\*([^*\n]+)\*\*/, tag: 'strong', cls: 'md-strong' },
  { regex: /\*([^*\n]+)\*/, tag: 'em', cls: 'md-em' },
]

const renderInlineMarkdown = (text, keyPrefix = 'md') => {
  if (!text) return null
  const out = []
  let remaining = String(text)
  let n = 0

  while (remaining.length) {
    let earliest = null
    for (const p of MD_PATTERNS) {
      const m = remaining.match(p.regex)
      if (m && (earliest === null || m.index < earliest.match.index)) {
        earliest = { ...p, match: m }
      }
    }
    if (!earliest) {
      out.push(remaining)
      break
    }
    const before = remaining.slice(0, earliest.match.index)
    if (before) out.push(before)

    const inner = earliest.match[1]
    const k = `${keyPrefix}-${n++}`
    if (earliest.tag === 'code') {
      out.push(
        <code key={k} className={earliest.cls}>
          {inner}
        </code>
      )
    } else if (earliest.tag === 'strong') {
      out.push(
        <strong key={k} className={earliest.cls}>
          {renderInlineMarkdown(inner, k)}
        </strong>
      )
    } else {
      out.push(
        <em key={k} className={earliest.cls}>
          {renderInlineMarkdown(inner, k)}
        </em>
      )
    }
    remaining = remaining.slice(earliest.match.index + earliest.match[0].length)
  }
  return out
}

const renderTextWithGifs = (text) => {
  if (!text) return null
  const lines = String(text).split(/\r?\n/)
  return lines.map((line, index) => {
    const trimmed = line.trim()
    if (GIF_LINE_REGEX.test(trimmed)) {
      return (
        <div key={index} className="mt-2 flex justify-start">
          <img
            src={trimmed}
            alt="GIF"
            loading="lazy"
            className="max-w-full h-auto rounded-xl border border-slate-700/80"
          />
        </div>
      )
    }
    return (
      <span key={index}>
        {index > 0 && <br />}
        {renderInlineMarkdown(line, `md-${index}`)}
      </span>
    )
  })
}
const formatUsername = (name) => (name ? String(name).replace(/#0$/, '') : '')

const formatDiscordTimestamp = (iso) => {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()

  const sameDay = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()

  const timeStr = date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (sameDay) return `hoy a las ${timeStr}`
  if (isYesterday) return `ayer a las ${timeStr}`

  const dateStr = date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })

  return `${dateStr} ${timeStr}`
}


export default function Comments() {
  const [comments, setComments] = useState([])
  const [page, setPage] = useState(1)
  const [me, setMe] = useState(null)
  const [text, setText] = useState('') // texto completo (incluye URLs de GIF)
  const [newTextInput, setNewTextInput] = useState('') // lo que se ve en el textarea
  const [newGifUrls, setNewGifUrls] = useState([])
  const [loading, setLoading] = useState(true)

  // edición inline
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [replyingToId, setReplyingToId] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [editingReplyId, setEditingReplyId] = useState(null)
  const [replyEditText, setReplyEditText] = useState('')

  // confirmación de borrado
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // picker de reacciones (admin)
  const [reactionPickerId, setReactionPickerId] = useState(null)

  // GIF picker (Tenor)
  const [gifPickerOpen, setGifPickerOpen] = useState(false)
  const [gifPickerMode, setGifPickerMode] = useState('new') // 'new' | 'reply'
  const [gifPickerCommentId, setGifPickerCommentId] = useState(null)
  const [gifQuery, setGifQuery] = useState('')
  const [gifResults, setGifResults] = useState([])
  const [gifLoading, setGifLoading] = useState(false)
  const [gifError, setGifError] = useState('')


  const isAdmin = !!(me && me.isAdmin)

  const load = async () => {
    try {
      const [cRes, meRes] = await Promise.all([
        axios.get('/api/comments'),
        axios.get('/api/me'),
      ])
      setComments(cRes.data.comments ?? [])
      setMe(meRes.data.user ?? null)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 5000) // refresco cada 5s
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (reactionPickerId === null) return
    const onDocClick = (event) => {
      if (!event.target.closest?.('.reaction-picker-wrapper')) {
        setReactionPickerId(null)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [reactionPickerId])


  const totalPages = Math.max(1, Math.ceil((comments?.length ?? 0) / COMMENTS_PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * COMMENTS_PER_PAGE
  const visibleComments = comments.slice(startIndex, startIndex + COMMENTS_PER_PAGE)

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const textareaRef = useRef(null)


  const openGifPickerForNew = () => {
    setGifPickerMode('new')
    setGifPickerCommentId(null)
    setGifPickerOpen(true)
  }

  const openGifPickerForReply = (commentId) => {
    setGifPickerMode('reply')
    setGifPickerCommentId(commentId)
    setGifPickerOpen(true)
  }

  const closeGifPicker = () => {
    setGifPickerOpen(false)
    setGifQuery('')
    setGifResults([])
    setGifError('')
  }

  const fetchGifs = async (query) => {
    if (!TENOR_API_KEY) {
      setGifError(
        'Falta configurar la API key de Tenor (VITE_TENOR_API_KEY) en las variables de entorno.'
      )
      setGifResults([])
      return
    }

    const q = query?.trim()
    if (!q) return

    setGifLoading(true)
    setGifError('')
    try {
      const res = await axios.get('/api/tenor-search', {
        params: { q },
      })

      const gifs = res.data?.gifs ?? []
      if (!gifs.length) {
        setGifResults([])
        setGifError('No se encontraron GIFs para esa búsqueda.')
      } else {
        setGifResults(gifs)
      }
    } catch (error) {
      console.error('Error Tenor cliente:', error?.response || error)
      setGifError('No se pudieron cargar los GIFs. Intenta de nuevo.')
      setGifResults([])
    } finally {
      setGifLoading(false)
    }
  }

  const handleGifSearchSubmit = (event) => {
    event.preventDefault()
    fetchGifs(gifQuery)
  }

  
const handleGifSelect = (url) => {
    if (!url) return

    if (gifPickerMode === 'new') {
      // Solo permitimos 1 GIF en la vista previa y en el comentario final.
      const updated = [url]
      setNewGifUrls(updated)

      setText(() => {
        const base = newTextInput
        const gifsPart = updated.length
          ? base
            ? `\n${updated[0]}`
            : updated[0]
          : ''
        return `${base}${gifsPart}`
      })
    } else if (gifPickerMode === 'reply' && gifPickerCommentId) {
      if (replyingToId === gifPickerCommentId) {
        setReplyText((prev) => {
          if (!prev) return url
          const trimmed = prev.trimEnd()
          return trimmed ? `${trimmed}\n${url}` : url
        })
      }
    }

    closeGifPicker()
  }


  const handleRemovePreviewGif = () => {
    // Quitamos el GIF de la vista previa y del texto que se enviará
    setNewGifUrls([])
    setText(newTextInput || '')
  }

  const handleNewChange = (e) => {
    const value = e.target.value.slice(0, MAX_COMMENT_LENGTH)
    const el = textareaRef.current
    let nearBottom = false

    if (el) {
      const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      nearBottom = distanceToBottom < 40
    }

    setNewTextInput(value)
    setText(() => {
      const gifsPart =
        newGifUrls.length > 0
          ? value
            ? `\n${newGifUrls.join('\n')}`
            : newGifUrls.join('\n')
          : ''
      return `${value}${gifsPart}`
    })

    if (el && nearBottom) {
      setTimeout(() => {
        el.scrollTop = el.scrollHeight
      }, 0)
    }
  }

  
  const send = async (e) => {
    e.preventDefault()

    const visibleTrimmed = newTextInput.trim()
    const hasGifs = newGifUrls.length > 0

    // No texto y sin GIFs: no enviamos nada
    if (!visibleTrimmed && !hasGifs) return

    // El límite de caracteres solo aplica al texto visible (no a los links de GIF)
    if (visibleTrimmed.length > MAX_COMMENT_LENGTH) {
      alert(`El comentario es demasiado largo (máximo ${MAX_COMMENT_LENGTH} caracteres).`)
      return
    }

    // Construimos el payload que realmente se guarda (texto + URLs de GIF)
    let payloadText = visibleTrimmed
    if (hasGifs) {
      payloadText = visibleTrimmed
        ? `${visibleTrimmed}\n${newGifUrls.join('\n')}`
        : newGifUrls.join('\n')
    }

    try {
      const res = await axios.post('/api/comments', { text: payloadText })
      setText('')
      setNewTextInput('')
      setNewGifUrls([])
      setComments((prev) => [res.data.comment, ...prev])
    } catch (e) {
      console.error(e)
      alert(e.response?.data?.error ?? 'Error enviando comentario')
    }
  }

  const login = () => {
    window.location.href = '/auth/discord/login'
  }

  const logout = () => {
    window.location.href = '/auth/discord/logout'
  }

  const startEdit = (comment) => {
    setEditingId(comment.id)
    setEditText(comment.text)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditText('')
  }

  const saveEdit = async () => {
    if (!editingId) return
    const trimmed = editText.trim()
    if (!trimmed) return
    if (trimmed.length > MAX_COMMENT_LENGTH) {
      alert(`El comentario editado es demasiado largo (máximo ${MAX_COMMENT_LENGTH} caracteres).`)
      return
    }
    try {
      const res = await axios.put(`/api/comments/${editingId}`, {
        text: trimmed,
      })
      const updated = res.data.comment
      setComments((prev) =>
        prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
      )
      cancelEdit()
    } catch (e) {
      console.error(e)
      alert(e.response?.data?.error ?? 'Error editando comentario')
    }
  }

  const openDeleteConfirm = (id) => {
    setConfirmDeleteId(id)
  }

  const closeDeleteConfirm = () => {
    setConfirmDeleteId(null)
    setDeleting(false)
  }

  const confirmDelete = async () => {
    if (!confirmDeleteId) return
    try {
      setDeleting(true)
      await axios.delete(`/api/comments/${confirmDeleteId}`)
      setComments((prev) => prev.filter((c) => c.id !== confirmDeleteId))
      closeDeleteConfirm()
    } catch (e) {
      console.error(e)
      alert(e.response?.data?.error ?? 'Error eliminando comentario')
      setDeleting(false)
    }
  }

  const sendReply = async (commentId) => {
    const trimmed = replyText.trim()
    if (!trimmed) return
    if (trimmed.length > MAX_COMMENT_LENGTH) {
      alert(`La respuesta es demasiado larga (máximo ${MAX_COMMENT_LENGTH} caracteres).`)
      return
    }
    try {
      const res = await axios.post(`/api/comments/${commentId}/replies`, {
        text: trimmed,
      })
      const updated = res.data.comment
      if (updated) {
        setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      }
      setReplyText('')
      setReplyingToId(null)
    } catch (e) {
      console.error(e)
      alert(e.response?.data?.error ?? 'Error enviando respuesta')
    }
  }

  const startEditReply = (reply) => {
    setEditingReplyId(reply.id)
    setReplyEditText(reply.text)
  }

  const cancelEditReply = () => {
    setEditingReplyId(null)
    setReplyEditText('')
  }

  const saveEditReply = async (commentId) => {
    if (!editingReplyId) return
    const trimmed = replyEditText.trim()
    if (!trimmed) return
    if (trimmed.length > MAX_COMMENT_LENGTH) {
      alert(`La respuesta editada es demasiado larga (máximo ${MAX_COMMENT_LENGTH} caracteres).`)
      return
    }
    try {
      const res = await axios.put(
        `/api/comments/${commentId}/replies/${editingReplyId}`,
        { text: trimmed }
      )
      const updated = res.data.comment
      if (updated) {
        setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      }
      setEditingReplyId(null)
      setReplyEditText('')
    } catch (e) {
      console.error(e)
      alert(e.response?.data?.error ?? 'Error editando respuesta')
    }
  }

  const toggleReaction = async (commentId, emoji) => {
    if (!me || !emoji) return
    try {
      const res = await axios.post(`/api/comments/${commentId}/reactions`, { emoji })
      const updated = res.data.comment
      if (updated) {
        setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      }
      setReactionPickerId(null)
    } catch (e) {
      console.error(e)
      alert(e.response?.data?.error ?? 'Error añadiendo reacción')
    }
  }

  const togglePin = async (commentId) => {
    if (!isAdmin) return
    try {
      const res = await axios.post(`/api/comments/${commentId}/pin`)
      const updated = res.data.comment
      if (updated) {
        setComments((prev) => {
          const next = prev.map((c) => (c.id === updated.id ? updated : c))
          // Reordenar: pinneados arriba, después por fecha desc
          return [...next].sort((a, b) => {
            if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
            return new Date(b.createdAt) - new Date(a.createdAt)
          })
        })
      }
    } catch (e) {
      console.error(e)
      alert(e.response?.data?.error ?? 'Error fijando comentario')
    }
  }

  const deleteReply = async (commentId, replyId) => {
    const ok = window.confirm('¿Eliminar esta respuesta?')
    if (!ok) return
    try {
      const res = await axios.delete(
        `/api/comments/${commentId}/replies/${replyId}`
      )
      const updated = res.data.comment
      if (updated) {
        setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      }
    } catch (e) {
      console.error(e)
      alert(e.response?.data?.error ?? 'Error eliminando respuesta')
    }
  }

  const remainingNew = MAX_COMMENT_LENGTH - newTextInput.length
  const remainingEdit = MAX_COMMENT_LENGTH - editText.length

  return (
    <section id="comments" className="mx-auto max-w-6xl px-4 py-8">
      <div className="section-card comments-panel">
        <div className="comments-panel-header">
          <div>
            <h2 className="section-title">Comentarios</h2>
            <p className="comments-panel-subtitle">discord-auth messages · guestbook stream</p>
            <div className="comments-meta">
              <span className="comments-count-pill">
                {comments.length} {comments.length === 1 ? 'comentario' : 'comentarios'}
              </span>
              <span
                className="comments-live-pill"
                aria-label="Live: auto-refresca cada 5 segundos"
                tabIndex="0"
              >
                <span className="comments-live-dot" aria-hidden="true" />
                LIVE
                <span className="comments-live-tooltip" role="tooltip">
                  <span>live sync</span>
                  <strong>Auto-refresca cada 5s</strong>
                </span>
              </span>
            </div>
          </div>
          <div className="comments-auth-zone">
            {me ? (
              <div className="comments-userbar">
                <div className="comments-user-pill">
                  <img
                    src={me.avatarUrl}
                    onError={(e) => (e.currentTarget.src = 'https://cdn.discordapp.com/embed/avatars/0.png')}
                    alt={formatUsername(me.username)}
                  />
                  <span>
                    {formatUsername(me.username)}
                  </span>
                  {isAdmin && (
                    <span className="comments-admin-pill">
                      Admin
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="comments-secondary-btn"
                >
                  Cerrar sesión
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={login}
                className="comments-login-btn"
              >
                Conectarse con Discord
              </button>
            )}
          </div>
        </div>

        {me && (
          <form onSubmit={send} className="comments-composer">
            <div className="comments-composer-top" aria-hidden="true">
              <span>compose.msg</span>
              <span>discord-auth</span>
            </div>

            <div className="comments-input-frame">
              <span className="comments-input-prompt" aria-hidden="true">
                &gt;
              </span>
              <textarea
                ref={textareaRef}
                value={newTextInput}
                onChange={handleNewChange}
                rows={3}
                placeholder="Escribe algo bonito (o un shitpost controlado)..."
                className="comment-textarea comments-composer-textarea"
              />
              <span className="comments-input-corners" aria-hidden="true" />
              <div className="comments-composer-meter" aria-hidden="true">
                <span
                  style={{
                    '--chars-used': `${Math.min(
                      100,
                      (newTextInput.length / MAX_COMMENT_LENGTH) * 100,
                    )}%`,
                  }}
                />
              </div>
              <div className="comments-composer-count">
                <span>
                  {newTextInput.length}/{MAX_COMMENT_LENGTH}
                </span>
                <strong>chars</strong>
                {remainingNew <= 50 && (
                  <em className={remainingNew < 0 ? 'is-danger' : 'is-warn'}>
                    {remainingNew < 0
                      ? 'limite excedido'
                      : `${remainingNew} restantes`}
                  </em>
                )}
              </div>
            </div>

            {newGifUrls.length > 0 && (
              <div className="comments-gif-preview">
                <p className="comments-gif-preview-label">gif.preview</p>
                <div className="comments-gif-preview-shell">
                  <button
                    type="button"
                    onClick={handleRemovePreviewGif}
                    className="comments-gif-remove"
                    aria-label="Quitar GIF"
                  >
                    x
                  </button>
                  <img
                    src={newGifUrls[0]}
                    alt="GIF de vista previa"
                    className="comments-gif-preview-image"
                  />
                </div>
              </div>
            )}

            <div className="comments-composer-actions">
              <button
                type="button"
                onClick={openGifPickerForNew}
                className="comments-composer-gif-btn"
              >
                <span aria-hidden="true" />
                GIF
              </button>
              <button
                type="submit"
                className="comments-composer-send-btn"
              >
                Enviar
              </button>
            </div>
          </form>
        )}

        <div className="comments-stream">
          {loading && (
            <p className="text-[11px] text-slate-500">Cargando comentarios…</p>
          )}

          {!loading && comments.length === 0 && (
            <p className="text-[11px] text-slate-500">
              Nadie ha dicho nada todavía. Sé el primero ✨
            </p>
          )}

          {visibleComments.map((c) => {
            const replies = Array.isArray(c.replies) ? c.replies : []
            const isReplying = replyingToId === c.id
            const isAuthor = me && String(c.author.id) === String(me.id)
            const canDelete = isAuthor || isAdmin
            const canEdit = isAuthor
            const isEditing = editingId === c.id
            const isAuthorAdmin = !!c.author?.isAdmin
            const createdDate = c.createdAt ? new Date(c.createdAt) : null
            const fullDateLabel =
              createdDate && !Number.isNaN(createdDate.getTime())
                ? createdDate.toLocaleString('es-ES', {
                    dateStyle: 'full',
                    timeStyle: 'short',
                  })
                : ''

            return (
              <article
                key={c.id}
                className={`comment-card${c.pinned ? ' is-pinned' : ''}`}
              >
                {c.pinned && (
                  <span className="comment-pin-badge" aria-label="Comentario fijado">
                    📌 PINNED
                  </span>
                )}
                <img
                  src={c.author.avatarUrl}
                    onError={(e) => (e.currentTarget.src = 'https://cdn.discordapp.com/embed/avatars/0.png')}
                  className="comment-avatar"
                  alt={formatUsername(c.author.username)}
                  loading="lazy"
                  decoding="async"
                />
                <div className="comment-content">
                  <header className="comment-header">
                    <span className="comment-author-line">
                      <span className="comment-author">
                        {formatUsername(c.author.username)}
                      </span>
                      {isAuthorAdmin && (
                        <span className="comment-admin-badge">
                          Admin
                        </span>
                      )}
                    </span>
                    <span className="comment-time group">
                      <span className="cursor-default">
                        {formatDiscordTimestamp(c.createdAt)}
                      </span>
                      {fullDateLabel && (
                        <span className="comment-date-tooltip">
                          {fullDateLabel}
                        </span>
                      )}
                    </span>
                    {c.updatedAt && c.updatedAt !== c.createdAt && (
                      <span className="text-[10px] text-slate-500">
                        {' · editado'}
                      </span>
                    )}
                    {(canEdit || canDelete || isAdmin) && (
                      <div className="comment-actions">
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => togglePin(c.id)}
                            className={`rounded-full px-2 py-1 text-[10px] transition ${
                              c.pinned
                                ? 'bg-amber-400/90 text-slate-900 hover:bg-amber-300'
                                : 'bg-slate-800 text-slate-200 hover:bg-amber-400/80 hover:text-slate-900'
                            }`}
                            title={c.pinned ? 'Quitar fijado' : 'Fijar arriba'}
                          >
                            📌
                          </button>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => startEdit(c)}
                            className="rounded-full bg-slate-800 px-2 py-1 text-[10px] text-slate-200 hover:bg-sky-500/80 hover:text-slate-900 transition"
                          >
                            ✏️
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => openDeleteConfirm(c.id)}
                            className="rounded-full bg-slate-800 px-2 py-1 text-[10px] text-slate-200 hover:bg-rose-500/80 hover:text-slate-900 transition"
                          >
                            🗑
                          </button>
                        )}
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            if (replyingToId === c.id) {
                              setReplyingToId(null)
                              setReplyText('')
                            } else {
                              setReplyingToId(c.id)
                              setReplyText('')
                            }
                          }}
                          className="rounded-full bg-emerald-600/80 px-3 py-0.5 text-[10px] text-slate-50 hover:bg-emerald-500 transition"
                        >
                          Responder
                        </button>
                      )}
                      </div>
                    )}
                  </header>

                  {!isEditing && (
                    <div className="comment-body">
                      {renderTextWithGifs(c.text)}
                    </div>
                  )}

                  {!isEditing && (() => {
                    const reactionMap =
                      c.reactions && typeof c.reactions === 'object' && !Array.isArray(c.reactions)
                        ? c.reactions
                        : {}
                    const entries = Object.entries(reactionMap).filter(
                      ([, ids]) => Array.isArray(ids) && ids.length > 0
                    )
                    const myId = me ? String(me.id) : null
                    if (entries.length === 0 && !me) return null

                    return (
                      <div className="comment-reactions">
                        {entries.map(([emoji, ids]) => {
                          const isHeart = emoji === '❤️'
                          const mine = !!myId && ids.includes(myId)
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => toggleReaction(c.id, emoji)}
                              disabled={!me}
                              className={`reaction-chip${isHeart ? ' is-heart' : ''}${mine ? ' is-mine' : ''}`}
                              title={
                                !me
                                  ? 'Inicia sesión para reaccionar'
                                  : mine
                                  ? 'Quitar mi reacción'
                                  : 'Reaccionar'
                              }
                            >
                              <span className="reaction-emoji">{emoji}</span>
                              <span className="reaction-count">{ids.length}</span>
                            </button>
                          )
                        })}
                        {me && (
                          <div className="reaction-picker-wrapper">
                            <button
                              type="button"
                              onClick={() =>
                                setReactionPickerId((prev) => (prev === c.id ? null : c.id))
                              }
                              className="reaction-add-btn"
                              aria-label="Añadir reacción"
                            >
                              <span aria-hidden="true">+</span>
                              <span className="reaction-add-icon" aria-hidden="true">☺</span>
                            </button>
                            {reactionPickerId === c.id && (
                              <div className="reaction-picker" role="menu">
                                {REACTION_PRESETS.map((emoji) => {
                                  const active = !!myId && (reactionMap[emoji] ?? []).includes(myId)
                                  return (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={() => toggleReaction(c.id, emoji)}
                                      className={`reaction-picker-item ${active ? 'is-active' : ''}`}
                                    >
                                      {emoji}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {isEditing && (
                    <div className="mt-2 space-y-2">
                      <textarea
                        value={editText}
                        onChange={(e) =>
                          setEditText(e.target.value.slice(0, MAX_COMMENT_LENGTH))
                        }
                        rows={3}
                        className="comment-textarea w-full rounded-2xl border border-slate-800/80 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
                      />
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>
                          {editText.length}/{MAX_COMMENT_LENGTH} caracteres
                        </span>
                        {remainingEdit <= 50 && (
                          <span
                            className={
                              remainingEdit < 0 ? 'text-rose-400' : 'text-amber-300'
                            }
                          >
                            {remainingEdit < 0
                              ? 'Has superado el límite.'
                              : `Te quedan ${remainingEdit} caracteres.`}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="rounded-full bg-slate-800 px-3 py-1 text-[10px] text-slate-200 hover:bg-slate-700"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={saveEdit}
                          className="rounded-full bg-sky-500 px-3 py-1 text-[10px] font-semibold text-slate-900 hover:bg-sky-400"
                        >
                          Guardar
                        </button>
                      </div>
                    </div>
                  )}
                  {replies.length > 0 && (
                    <div className="mt-3 space-y-2 border-l border-slate-800/80 pl-3">
                      {replies.map((r) => {
                        const replyDate = r.createdAt ? new Date(r.createdAt) : null
                        const replyFullDate =
                          replyDate && !Number.isNaN(replyDate.getTime())
                            ? replyDate.toLocaleString('es-ES', {
                                dateStyle: 'full',
                                timeStyle: 'short',
                              })
                            : ''

                        const isEditingReply = editingReplyId === r.id

                        return (
                          <div
                            key={r.id}
                            className="flex gap-2 text-[11px] text-slate-200"
                          >
                            <img
                              src={r.author?.avatarUrl}
                    onError={(e) => (e.currentTarget.src = 'https://cdn.discordapp.com/embed/avatars/0.png')}
                              alt={formatUsername(r.author?.username)}
                              className="mt-0.5 h-5 w-5 rounded-full"
                              loading="lazy"
                              decoding="async"
                            />
                            <div className="flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-1">
                                  <span className="font-medium text-slate-100">
                                    {formatUsername(r.author?.username)}
                                  </span>
                                  {r.author?.isAdmin && (
                                    <span className="rounded-full border border-emerald-400/70 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-200 shadow-sm shadow-emerald-500/30">
                                      Admin
                                    </span>
                                  )}
                                  {r.createdAt && (
                                    <span className="relative inline-flex items-center group">
                                      <span className="cursor-default text-[10px] text-slate-500">
                                        {formatDiscordTimestamp(r.createdAt)}
                                      </span>
                                      {replyFullDate && (
                                        <span className="pointer-events-none absolute left-1/2 bottom-full z-20 mb-1 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-xl border border-slate-700/80 bg-slate-950/95 px-3 py-1 text-[10px] text-slate-100 shadow-lg shadow-sky-500/20 opacity-0 transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100">
                                          {replyFullDate}
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </div>
                                {isAdmin && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => startEditReply(r)}
                                      className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-200 hover:bg-slate-700"
                                    >
                                      Editar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteReply(c.id, r.id)}
                                      className="rounded-full bg-rose-600/80 px-2 py-0.5 text-[10px] text-slate-50 hover:bg-rose-500"
                                    >
                                      Eliminar
                                    </button>
                                  </div>
                                )}
                              </div>
                              {isEditingReply ? (
                                <div className="mt-1 space-y-1">
                                  <textarea
                                    value={replyEditText}
                                    onChange={(e) =>
                                      setReplyEditText(
                                        e.target.value.slice(0, MAX_COMMENT_LENGTH)
                                      )
                                    }
                                    rows={2}
                                    className="comment-textarea w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                                    placeholder="Edita la respuesta…"
                                  />
                                  <div className="flex items-center justify-end gap-2 text-[10px] text-slate-400">
                                    <button
                                      type="button"
                                      onClick={cancelEditReply}
                                      className="rounded-full bg-slate-800 px-3 py-1 hover:bg-slate-700"
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => saveEditReply(c.id)}
                                      className="rounded-full bg-sky-500 px-3 py-1 font-semibold text-slate-900 hover:bg-sky-400"
                                    >
                                      Guardar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-0.5 text-slate-200 text-[12px]">
                                  {renderTextWithGifs(r.text)}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {isAdmin && isReplying && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        sendReply(c.id)
                      }}
                      className="mt-3 space-y-1"
                    >
                      <textarea
                        value={replyText}
                        onChange={(e) =>
                          setReplyText(e.target.value.slice(0, MAX_COMMENT_LENGTH))
                        }
                        rows={2}
                        className="comment-textarea w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                        placeholder="Escribe una respuesta como admin…"
                      />
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>
                          {replyText.length}/{MAX_COMMENT_LENGTH} caracteres
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openGifPickerForReply(c.id)}
                            className="rounded-full border border-slate-600/70 bg-slate-900/80 px-3 py-1 text-[10px] text-slate-200 transition hover:border-emerald-400 hover:text-emerald-200"
                          >
                            GIF
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingToId(null)
                              setReplyText('')
                            }}
                            className="rounded-full bg-slate-800 px-3 py-1 text-[10px] text-slate-200 hover:bg-slate-700"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            className="rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-semibold text-slate-900 hover:bg-emerald-400"
                          >
                            Responder
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              </article>

            )
          })}

          {comments.length > COMMENTS_PER_PAGE && (
            <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500">
              <span className="px-2">
                Página {currentPage} de {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-full border border-slate-700/70 bg-slate-900/60 px-3 py-1 text-[11px] text-slate-200 shadow-sm shadow-slate-900/60 transition hover:bg-slate-800/80 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-full border border-slate-700/70 bg-slate-900/60 px-3 py-1 text-[11px] text-slate-200 shadow-sm shadow-slate-900/60 transition hover:bg-slate-800/80 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      

      {gifPickerOpen && (
        <ModalPortal>
          <div className="modal-backdrop" onClick={closeGifPicker}>
            <div
              className="modal-card modal-xl gif-picker-modal"
              onClick={(event) => event.stopPropagation()}
            >
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Elige un GIF</h3>
                <p className="modal-text">
                  Busca un GIF y haz click en él para insertarlo en tu comentario.
                </p>
              </div>
              <button
                type="button"
                onClick={closeGifPicker}
                className="modal-close"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGifSearchSubmit} className="mt-3 flex gap-2">
              <input
                type="text"
                value={gifQuery}
                onChange={(event) => setGifQuery(event.target.value)}
                placeholder='Escribe algo como "No lo sé Rick"…'
                className="modal-input"
              />
              <button type="submit" className="modal-btn-save">
                Buscar
              </button>
            </form>

            {!TENOR_API_KEY && (
              <p className="mt-4 text-[11px] text-amber-300">
                Falta configurar <code>VITE_TENOR_API_KEY</code> en las variables de entorno para
                poder buscar GIFs de Tenor.
              </p>
            )}

            {TENOR_API_KEY && (
              <div className="modal-panel mt-4 rounded-2xl p-3 comment-textarea max-h-80 overflow-y-auto">
                {gifLoading && (
                  <p className="text-[11px] text-slate-400">Cargando GIFs…</p>
                )}

                {!gifLoading && gifError && (
                  <p className="text-[11px] text-rose-300">{gifError}</p>
                )}

                {!gifLoading && !gifError && gifResults.length === 0 && (
                  <p className="text-[11px] text-slate-500">
                    Escribe algo arriba y presiona "Buscar" para ver GIFs.
                  </p>
                )}

                {!gifLoading && gifResults.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                    {gifResults.map((url, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleGifSelect(url)}
                        className="group block overflow-hidden rounded-xl border border-slate-700/70 bg-slate-900/80 hover:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/70 focus:ring-offset-2 focus:ring-offset-slate-950"
                      >
                        <img
                          src={url}
                          alt="GIF"
                          loading="lazy"
                          className="h-24 w-full object-cover transition-transform duration-150 group-hover:scale-105"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="modal-actions">
              <button type="button" onClick={closeGifPicker} className="modal-btn-cancel">
                Cerrar
              </button>
            </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {confirmDeleteId && (
        <ModalPortal>
          <div className="modal-backdrop" onClick={closeDeleteConfirm}>
            <div className="modal-card modal-sm danger-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">¿Eliminar este comentario?</h3>
                <p className="modal-text">
                  Esta acción no se puede deshacer. El comentario desaparecerá para todos.
                </p>
              </div>
              <button
                type="button"
                onClick={closeDeleteConfirm}
                className="modal-close"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                disabled={deleting}
                className="modal-btn-cancel"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="modal-btn-danger"
              >
                {deleting ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </section>
  )
}
