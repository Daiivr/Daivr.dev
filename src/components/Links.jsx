import React, { useEffect, useState } from 'react'
import axios from 'axios'

export default function Links() {
  const [links, setLinks] = useState([])
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)

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
      <div className="section-card">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-100">Links rápidos</h2>
          <span className="text-[10px] uppercase tracking-wide text-slate-400">
            click · explora · regresa
          </span>
        </div>

        {/* Form para agregar link – solo admin */}
        {isAdmin && (
          <form
            onSubmit={handleAddLink}
            className="mt-4 grid gap-2 rounded-2xl border border-slate-800/70 bg-slate-950/50 p-3 text-xs md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.7fr)_minmax(0,1.4fr)_auto]"
          >
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Nombre del link"
              className="rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-1 text-[11px] text-slate-100"
            />
            <input
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder="https://..."
              className="rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-1 text-[11px] text-slate-100"
            />
            <input
              value={iconUrl}
              onChange={(e) => setIconUrl(e.target.value)}
              placeholder="URL del icono (opcional)"
              className="rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-1 text-[11px] text-slate-100"
            />
            <button
              type="submit"
              className="rounded-full bg-sky-500 px-3 py-1 text-[11px] font-semibold text-slate-900"
            >
              Agregar
            </button>
          </form>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {loading && (
            <p className="text-[11px] text-slate-500">Cargando links…</p>
          )}

          {!loading && links.length === 0 && (
            <p className="text-[11px] text-slate-500">
              Aún no hay links guardados ✨
            </p>
          )}

          {links.map((link, index) => (
            <div
              key={link.id}
              className="link-card group relative flex items-center justify-between overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/70 px-4 py-3 text-sm hover:scale-[1.02] hover:shadow-xl transition-all duration-300"
              draggable={isAdmin}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
            >
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="relative flex flex-1 items-center gap-3"
              >
                {link.iconUrl && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-900/90 border border-slate-700 shadow-inner">
                    <img
                      src={link.iconUrl}
                      alt={link.label}
                      className="h-6 w-6 rounded-xl object-cover icon-anim"
                    />
                  </div>
                )}

                <div>
                  <p className="font-medium text-slate-100">{link.label}</p>
                </div>
              </a>

              {isAdmin && (
                <div className="flex items-center gap-2 ml-3">
                  <button
                    type="button"
                    onClick={() => openEditModal(link)}
                    className="px-2 py-1 text-xs rounded-lg bg-sky-500/80 text-slate-900 shadow-sm"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(link.id)}
                    className="px-2 py-1 text-xs rounded-lg bg-rose-500/80 text-slate-50 shadow-sm"
                  >
                    🗑
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modal de edición */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3 className="text-lg font-semibold mb-4 text-slate-100">
              Editar link
            </h3>

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

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="modal-btn-cancel"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="modal-btn-save"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
