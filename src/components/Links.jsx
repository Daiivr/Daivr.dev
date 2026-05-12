import React, { useEffect, useState } from 'react'
import axios from 'axios'
import ModalPortal from './ModalPortal'

export default function Links() {
  const [links, setLinks] = useState([])
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)

  // confirm modal (salir a página externa)
  const [showExternalConfirm, setShowExternalConfirm] = useState(false)
  const [pendingExternal, setPendingExternal] = useState(null)
  const [copiedExternal, setCopiedExternal] = useState(false)

  // nuevo link
  const [label, setLabel] = useState('')
  const [href, setHref] = useState('')
  const [iconUrl, setIconUrl] = useState('')

  // modal edición
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editLabel, setEditLabel] = useState('')
  const [editHref, setEditHref] = useState('')
  const [editIconUrl, setEditIconUrl] = useState('')

  // drag & drop
  const [dragIndex, setDragIndex] = useState(null)

  const isAdmin = !!(me && me.isAdmin)

  useEffect(() => {
    const load = async () => {
      try {
        const [linksRes, meRes] = await Promise.all([
          axios.get('/api/links'),
          axios.get('/api/me'),
        ])
        setLinks(linksRes.data.links ?? [])
        setMe(meRes.data.user ?? null)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const normalizeHref = (rawHref) => {
    const h = (rawHref ?? '').trim()
    if (!h) return ''
    // internal anchors / relative paths (no confirm)
    if (h.startsWith('#') || h.startsWith('/')) return h
    // already has scheme (http/https/mailto/etc)
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(h)) return h
    // no scheme -> assume https
    return `https://${h}`
  }

  const isExternalHref = (hrefNormalized) => {
    if (!hrefNormalized) return false
    if (hrefNormalized.startsWith('#') || hrefNormalized.startsWith('/')) return false
    return true
  }

  const getHostLabel = (hrefNormalized) => {
    try {
      const url = new URL(hrefNormalized)
      return (url.hostname || hrefNormalized).replace(/^www\./, '')
    } catch {
      return hrefNormalized
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0]
    }
  }

  const getLinkMetaLabel = (hrefNormalized) => {
    if (!hrefNormalized) return 'route'
    if (hrefNormalized.startsWith('#')) return 'anchor'
    if (hrefNormalized.startsWith('/')) return 'local'
    return getHostLabel(hrefNormalized)
  }

  const openExternalConfirm = (e, link) => {
    const safeHref = normalizeHref(link.href)
    if (!isExternalHref(safeHref)) return
    e.preventDefault()
    e.stopPropagation()
    setPendingExternal({ ...link, safeHref })
    setShowExternalConfirm(true)
  }

  const closeExternalConfirm = () => {
    setShowExternalConfirm(false)
    setPendingExternal(null)
    setCopiedExternal(false)
  }

  const continueToExternal = () => {
    if (!pendingExternal?.safeHref) return
    const url = pendingExternal.safeHref
    closeExternalConfirm()
    // abrir nueva pestaña (seguro)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const copyExternalLink = async () => {
    const text = pendingExternal?.safeHref
    if (!text) return
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const el = document.createElement('textarea')
        el.value = text
        el.setAttribute('readonly', '')
        el.style.position = 'fixed'
        el.style.opacity = '0'
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
      }

      setCopiedExternal(true)
      window.clearTimeout(copyExternalLink._t)
      copyExternalLink._t = window.setTimeout(() => setCopiedExternal(false), 1400)
    } catch {
      // ignore
    }
  }

  const handleAddLink = async (e) => {
    e.preventDefault()
    if (!label.trim() || !href.trim()) return
    try {
      const res = await axios.post('/api/links', {
        label,
        href,
        iconUrl: iconUrl || '',
      })
      setLinks((prev) => [...prev, res.data.link])
      setLabel('')
      setHref('')
      setIconUrl('')
    } catch (err) {
      console.error(err)
      alert('Error agregando link')
    }
  }

  const openEditModal = (link) => {
    setEditingId(link.id)
    setEditLabel(link.label)
    setEditHref(link.href)
    setEditIconUrl(link.iconUrl || '')
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingId(null)
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    try {
      await axios.put(`/api/links/${editingId}`, {
        label: editLabel,
        href: editHref,
        iconUrl: editIconUrl,
      })

      setLinks((prev) =>
        prev.map((l) =>
          l.id === editingId
            ? { ...l, label: editLabel, href: editHref, iconUrl: editIconUrl }
            : l
        )
      )

      closeModal()
    } catch (err) {
      console.error(err)
      alert('Error guardando cambios')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este link?')) return
    try {
      await axios.delete(`/api/links/${id}`)
      setLinks((prev) => prev.filter((l) => l.id !== id))
    } catch (err) {
      console.error(err)
      alert('Error eliminando link')
    }
  }

  // drag & drop helpers
  const handleDragStart = (index) => {
    if (!isAdmin) return
    setDragIndex(index)
  }

  const handleDragOver = (e, index) => {
    if (!isAdmin) return
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return

    setLinks((prev) => {
      const arr = [...prev]
      const item = arr.splice(dragIndex, 1)[0]
      arr.splice(index, 0, item)
      return arr
    })
    setDragIndex(index)
  }

  const handleDragEnd = () => {
    if (!isAdmin) return
    setDragIndex(null)
    // aquí podríamos guardar el nuevo orden en el backend si lo necesitas
  }

  return (
    <section id="links" className="section-shell">
      <div className="section-card links-panel">
        <div className="links-panel-header">
          <div>
            <h2 className="section-title">links.sh</h2>
            <p className="links-panel-subtitle">verified destinations · launch safely</p>
          </div>
          <div className="links-panel-status" aria-hidden="true">
            <span>./run</span>
            <span>external</span>
            <span>new_tab</span>
          </div>
        </div>

        {/* Form para agregar link – solo admin */}
        {isAdmin && (
          <form onSubmit={handleAddLink} className="links-composer">
            <div className="links-composer-top" aria-hidden="true">
              <span>add.link</span>
              <span>admin // root</span>
            </div>

            <div className="links-composer-fields">
              <label className="links-input-frame">
                <span className="links-input-prompt" aria-hidden="true">&gt;</span>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Nombre del link"
                  className="links-composer-input"
                />
                <span className="links-input-corners" aria-hidden="true" />
              </label>
              <label className="links-input-frame">
                <span className="links-input-prompt" aria-hidden="true">$</span>
                <input
                  value={href}
                  onChange={(e) => setHref(e.target.value)}
                  placeholder="https://..."
                  className="links-composer-input"
                />
                <span className="links-input-corners" aria-hidden="true" />
              </label>
              <label className="links-input-frame">
                <span className="links-input-prompt" aria-hidden="true">@</span>
                <input
                  value={iconUrl}
                  onChange={(e) => setIconUrl(e.target.value)}
                  placeholder="URL del icono (opcional)"
                  className="links-composer-input"
                />
                <span className="links-input-corners" aria-hidden="true" />
              </label>
            </div>

            <div className="links-composer-actions">
              <button type="submit" className="links-composer-submit">
                <span aria-hidden="true">+</span> Agregar
              </button>
            </div>
          </form>
        )}

        <div className="links-grid">
          {loading && (
            <p className="text-[11px] text-slate-500">Cargando links…</p>
          )}

          {!loading && links.length === 0 && (
            <p className="text-[11px] text-slate-500">
              {'// no links · array is empty'}
            </p>
          )}

          {links.map((link, index) => {
            const safeHref = normalizeHref(link.href)
            const isExternal = isExternalHref(safeHref)
            const metaLabel = getLinkMetaLabel(safeHref)

            return (
            <div
              key={link.id}
              className="link-card group"
              draggable={isAdmin}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
            >
              <a
                href={safeHref}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noreferrer' : undefined}
                className="link-tile-anchor"
                onClick={(e) => openExternalConfirm(e, link)}
              >
                <span className="link-tile-index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>

                <span className="link-tile-icon">
                  {link.iconUrl ? (
                    <img
                      src={link.iconUrl}
                      alt={link.label}
                      className="icon-anim"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span aria-hidden="true">{isExternal ? '↗' : '#'}</span>
                  )}
                </span>

                <span className="link-tile-copy">
                  <span className="link-tile-title">{link.label}</span>
                  <span className="link-tile-meta">{metaLabel}</span>
                </span>

                <span className="link-tile-action" aria-hidden="true">
                  {isExternal ? 'open' : 'go'}
                </span>
              </a>

              {isAdmin && (
                <div className="link-admin-actions">
                  <button
                    type="button"
                    onClick={() => openEditModal(link)}
                    className="comment-action-btn is-edit"
                    aria-label="Editar link"
                    title="Editar"
                  >
                    <span aria-hidden="true">✏️</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(link.id)}
                    className="comment-action-btn is-delete"
                    aria-label="Eliminar link"
                    title="Eliminar"
                  >
                    <span aria-hidden="true">🗑</span>
                  </button>
                </div>
              )}
            </div>
            )
          })}
        </div>
      </div>

      {/* Modal de edición */}
      {showModal && (
        <ModalPortal>
          <div className="modal-backdrop" onClick={closeModal}>
            <div className="modal-card modal-md link-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Editar link</h3>
                <p className="modal-text">Actualiza el nombre, URL e ícono del botón.</p>
              </div>
              <button type="button" onClick={closeModal} className="modal-close" aria-label="Cerrar">
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                className="modal-input"
                placeholder="Nombre"
              />
              <input
                value={editHref}
                onChange={(e) => setEditHref(e.target.value)}
                className="modal-input"
                placeholder="URL"
              />
              <input
                value={editIconUrl}
                onChange={(e) => setEditIconUrl(e.target.value)}
                className="modal-input"
                placeholder="Icon URL"
              />
            </div>

            <div className="modal-actions">
              <button type="button" onClick={closeModal} className="modal-btn-cancel">
                Cancelar
              </button>
              <button type="button" onClick={handleSaveEdit} className="modal-btn-save">
                Guardar
              </button>
            </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Confirmación: salir a página externa */}
      {showExternalConfirm && pendingExternal && (
        <ModalPortal>
          <div className="modal-backdrop" onClick={closeExternalConfirm}>
            <div className="modal-card modal-sm link-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Abrir {pendingExternal.label}</h3>
                <p className="modal-text">
                  Se abrirá <span className="font-semibold text-slate-200">{getHostLabel(pendingExternal.safeHref)}</span> en una nueva pestaña.
                </p>
              </div>
              <button
                type="button"
                onClick={closeExternalConfirm}
                className="modal-close"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="modal-panel link-confirm-panel">
              <div className="link-confirm-identity">
                <div className="link-confirm-main">
                  {pendingExternal.iconUrl ? (
                    <div className="link-confirm-icon">
                      <img
                        src={pendingExternal.iconUrl}
                        alt={pendingExternal.label}
                        className="link-confirm-icon-img"
                      />
                    </div>
                  ) : (
                    <div className="link-confirm-icon">
                      <span aria-hidden="true">#</span>
                    </div>
                  )}

                  <div className="link-confirm-copyblock">
                    <p>
                      {pendingExternal.label}
                    </p>
                    <span>
                      {getHostLabel(pendingExternal.safeHref)}
                    </span>
                  </div>
                </div>

                <span className="link-confirm-pill">
                  NUEVA PESTAÑA
                </span>
              </div>

              <div className="link-confirm-url-row">
                <div className="link-confirm-url">
                  {pendingExternal.safeHref}
                </div>
                <button
                  type="button"
                  onClick={copyExternalLink}
                  className="link-confirm-copy"
                  aria-label="Copiar enlace"
                  title="Copiar"
                >
                  {copiedExternal ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" onClick={closeExternalConfirm} className="modal-btn-cancel">
                Cancelar
              </button>
              <button type="button" onClick={continueToExternal} className="modal-btn-save">
                Abrir
              </button>
            </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </section>
  )
}
