import React, { useEffect, useRef, useState } from 'react'
import axios from 'axios'

const MAX_COMMENT_LENGTH = 2000
const COMMENTS_PER_PAGE = 6
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
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)

  // edición inline
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [replyingToId, setReplyingToId] = useState(null)
  const [replyText, setReplyText] = useState('')


  // confirmación de borrado
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)

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

  const handleNewChange = (e) => {
    const value = e.target.value.slice(0, MAX_COMMENT_LENGTH)
    const el = textareaRef.current
    let nearBottom = false

    if (el) {
      const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      nearBottom = distanceToBottom < 40
    }

    setText(value)

    if (el && nearBottom) {
      setTimeout(() => {
        el.scrollTop = el.scrollHeight
      }, 0)
    }
  }

  const send = async (e) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    if (trimmed.length > MAX_COMMENT_LENGTH) {
      alert(`El comentario es demasiado largo (máximo ${MAX_COMMENT_LENGTH} caracteres).`)
      return
    }
    try {
      const res = await axios.post('/api/comments', { text: trimmed })
      setText('')
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

  const remainingNew = MAX_COMMENT_LENGTH - text.length
  const remainingEdit = MAX_COMMENT_LENGTH - editText.length

  return (
    <section id="comments" className="mx-auto max-w-6xl px-4 py-8">
      <div className="section-card">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Comentarios</h2>
            <p className="mt-1 text-xs text-slate-400">
              Deja un mensajito si estás conectado con tu cuenta de Discord.
            </p>
          </div>
          <div className="text-xs">
            {me ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-full bg-slate-900/80 px-3 py-1">
                  <img
                    src={me.avatarUrl}
                    className="h-5 w-5 rounded-full"
                    alt={formatUsername(me.username)}
                  />
                  <span className="text-slate-100">
                    {formatUsername(me.username)}
                  </span>
                  {isAdmin && (
                    <span className="rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold text-slate-900">
                      Admin
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-full bg-slate-700 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-600"
                >
                  Cerrar sesión
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={login}
                className="rounded-full bg-sky-500 px-3 py-1 text-[11px] font-semibold text-slate-900"
              >
                Conectarse con Discord
              </button>
            )}
          </div>
        </div>

        {me && (

<form onSubmit={send} className="mt-4 flex flex-col gap-2">
  <div className="relative w-full">
    <textarea
      ref={textareaRef}
      value={text}
      onChange={handleNewChange}
      rows={3}
      placeholder="Escribe algo bonito (o un shitpost controlado)…"
      className="comment-textarea w-full rounded-2xl border border-slate-800/80 bg-slate-950/60 px-3 pt-3 pb-14 pr-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
    />
    <div className="pointer-events-none absolute inset-x-3 bottom-2 flex items-center justify-end text-[11px] text-slate-400">
      <div className="mr-auto h-px w-full max-w-[calc(100%-11rem)] bg-gradient-to-r from-slate-600/40 via-slate-500/50 to-transparent" />
      <div className="flex items-center gap-2 rounded-full bg-slate-900/95 px-3 py-1 shadow-[0_0_0_1px_rgba(15,23,42,0.9)]">
        <span className="text-[10px] text-slate-300">
          {text.length}/{MAX_COMMENT_LENGTH} caracteres
        </span>
        {remainingNew <= 50 && (
          <span className={remainingNew < 0 ? 'text-rose-300' : 'text-amber-200'}>
            {remainingNew < 0
              ? 'Has superado el límite.'
              : `Te quedan ${remainingNew} caracteres.`}
          </span>
        )}
      </div>
    </div>
  </div>
  <div className="mt-2 flex justify-end">
    <button
      type="submit"
      className="rounded-full bg-fuchsia-500 px-3 py-1 text-[11px] font-semibold text-slate-900"
    >
      Enviar
    </button>
  </div>
</form>
        )}

        <div className="mt-5 space-y-3">
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
                className="flex gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/60 px-3 py-2 text-xs"
              >
                <img
                  src={c.author.avatarUrl}
                  className="mt-1 h-7 w-7 rounded-full"
                  alt={formatUsername(c.author.username)}
                />
                <div className="flex-1">
                  <header className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-100">
                        {formatUsername(c.author.username)}
                      </span>
                      {isAuthorAdmin && (
                        <span className="rounded-full border border-fuchsia-400/70 bg-fuchsia-500/10 px-2 py-[2px] text-[9px] font-semibold uppercase tracking-wide text-fuchsia-200 shadow-sm shadow-fuchsia-500/30">
                          Admin
                        </span>
                      )}
                    </span>
                    <span>·</span>
                    <span className="relative inline-flex items-center group">
                      <span className="cursor-default">
                        {formatDiscordTimestamp(c.createdAt)}
                      </span>
                      {fullDateLabel && (
                        <span className="pointer-events-none absolute left-1/2 bottom-full z-20 mb-1 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-xl border border-slate-700/80 bg-slate-950/95 px-2.5 py-1 text-[10px] text-slate-100 shadow-lg shadow-sky-500/20 opacity-0 transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100">
                          {fullDateLabel}
                        </span>
                      )}
                    </span>
                    {c.updatedAt && c.updatedAt !== c.createdAt && (
                      <span className="text-[10px] text-slate-500">
                        {' · editado'}
                      </span>
                    )}
                    {(canEdit || canDelete) && (
                      <div className="ml-auto flex items-center gap-1">
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
                    <p className="mt-1 text-slate-200 whitespace-pre-wrap">
                      {c.text}
                    </p>
                  )}

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

                        return (
                          <div
                            key={r.id}
                            className="flex gap-2 text-[11px] text-slate-200"
                          >
                            <img
                              src={r.author?.avatarUrl}
                              alt={formatUsername(r.author?.username)}
                              className="mt-0.5 h-5 w-5 rounded-full"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-1">
                                <span className="font-medium text-slate-100">
                                  {formatUsername(r.author?.username)}
                                </span>
                                {r.author?.isAdmin && (
                                  <span className="rounded-full bg-amber-500/90 px-2 py-0.5 text-[9px] font-semibold text-slate-900">
                                    Admin
                                  </span>
                                )}
                                {r.createdAt && (
                                  <span
                                    className="group relative cursor-default text-[10px] text-slate-500"
                                    title={replyFullDate}
                                  >
                                    {formatDiscordTimestamp(r.createdAt)}
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 whitespace-pre-wrap text-slate-200">
                                {r.text}
                              </p>
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
                        <div className="flex gap-2">
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

      {confirmDeleteId && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3 className="modal-title">¿Eliminar este comentario?</h3>
            <p className="modal-text">
              Esta acción no se puede deshacer. El comentario desaparecerá para todos.
            </p>
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
      )}
    </section>
  )
}