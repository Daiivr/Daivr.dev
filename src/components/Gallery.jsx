import React, { useEffect, useState } from 'react'
import axios from 'axios'

const OWNER_ID = '271701484922601472'

export default function Gallery() {
  const [files, setFiles] = useState([])
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [me, setMe] = useState(null)
  const [loadingMe, setLoadingMe] = useState(true)

  // modal de previsualización (ver imagen grande)
  const [previewFile, setPreviewFile] = useState(null)


  // modal para renombrar antes de subir
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState(null)
  const [uploadName, setUploadName] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')
  const [showUploadModal, setShowUploadModal] = useState(false)

  const isOwner = me && me.id === OWNER_ID

  const load = async () => {
    try {
      const [filesRes, meRes] = await Promise.all([
        axios.get('/api/gallery'),
        axios.get('/api/me'),
      ])
      setFiles(filesRes.data.files ?? [])
      setMe(meRes.data.user ?? null)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingMe(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    if (uploadName.trim()) {
      formData.append('displayName', uploadName.trim())
    }
    if (uploadDescription.trim()) {
      formData.append('description', uploadDescription.trim())
    }

    try {
      setUploading(true)
      const res = await axios.post('/api/gallery', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      const uploaded = res.data.file
      // si el backend soporta displayName/description, los usará; si no, los guardamos en memoria
      if (uploadName.trim()) {
        uploaded.displayName = uploadName.trim()
      }
      if (uploadDescription.trim()) {
        uploaded.description = uploadDescription.trim()
      }
      setFiles((prev) => [uploaded, ...prev])
      setFile(null)
      setUploadName('')
      setUploadDescription('')
      if (uploadPreviewUrl) {
        URL.revokeObjectURL(uploadPreviewUrl)
        setUploadPreviewUrl(null)
      }
      setShowUploadModal(false)
    } catch (err) {
      console.error(err)
      alert(err.response?.data?.error ?? 'Error subiendo imagen')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (filename) => {
    if (!window.confirm('¿Seguro que quieres borrar esta imagen?')) return
    try {
      await axios.delete(`/api/gallery/${encodeURIComponent(filename)}`)
      setFiles((prev) => prev.filter((f) => f.filename !== filename))
      if (previewFile && previewFile.filename === filename) {
        setPreviewFile(null)
      }
    } catch (e) {
      console.error(e)
      alert(e.response?.data?.error ?? 'Error borrando imagen')
    }
  }

  const openPreview = (f) => {
    setPreviewFile(f)
  }

  const closePreview = () => {
    setPreviewFile(null)
  }

  const handleChooseFile = (event) => {
    const selected = event.target.files?.[0]
    if (!selected) {
      setFile(null)
      setUploadName('')
      setUploadDescription('')
      if (uploadPreviewUrl) {
        URL.revokeObjectURL(uploadPreviewUrl)
        setUploadPreviewUrl(null)
      }
      setShowUploadModal(false)
      return
    }

    // crear URL local para vista previa
    if (uploadPreviewUrl) {
      URL.revokeObjectURL(uploadPreviewUrl)
    }
    const url = URL.createObjectURL(selected)
    setUploadPreviewUrl(url)
    setFile(selected)

    // nombre base sin extensión
    const baseName = selected.name.replace(/\.[^/.]+$/, '')
    setUploadName(baseName)
    setShowUploadModal(true)

    // limpiar valor del input para permitir volver a elegir la misma imagen si se cancela
    event.target.value = ''
  }

  const cancelUploadModal = () => {
    setShowUploadModal(false)
    setFile(null)
    setUploadName('')
    setUploadDescription('')
    if (uploadPreviewUrl) {
      URL.revokeObjectURL(uploadPreviewUrl)
      setUploadPreviewUrl(null)
    }
  }

  const confirmUploadModal = () => {
    // solo cerramos el modal; el botón "Subir" usará file + uploadName
    setShowUploadModal(false)
  }

  const displayLabel = (fileObj) =>
    fileObj.displayName || fileObj.originalName || fileObj.filename

  return (
    <section id="gallery" className="mx-auto max-w-6xl px-4 py-8">
      <div className="section-card">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Galería</h2>
            <p className="mt-1 text-xs text-slate-400">
              Mi pequeña vitrina de imágenes.
            </p>
          </div>
        </header>

        <div className="mt-4 space-y-4">
          {loadingMe && <p className="text-xs text-slate-500">Cargando…</p>}

          {isOwner && (
            <form onSubmit={handleUpload} className="space-y-2 rounded-2xl bg-slate-950/40 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-dashed border-slate-700/80 bg-slate-900/60 px-3 py-1 text-[11px] text-slate-200 hover:border-sky-500/80 hover:text-sky-300">
                    <span>Elegir imagen…</span>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleChooseFile}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={!file || uploading}
                    className="rounded-xl bg-sky-500/90 px-4 py-1.5 text-[11px] font-semibold text-slate-950 shadow-[0_0_25px_rgba(56,189,248,0.65)] transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700/70"
                  >
                    {uploading ? 'Subiendo…' : 'Subir'}
                  </button>
                  {file && (
                    <span className="text-[10px] text-slate-400">
                      {uploadName || file.name} · {(file.size / 1024).toFixed(0)}kb
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500">
                  Máx. 10MB por archivo. Se guardan en tu servidor local en la carpeta{' '}
                  <code className="rounded bg-slate-900/80 px-1">/uploads</code>.
                </p>
              </div>
            </form>
          )}

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {files.map((f) => {
              const label = displayLabel(f)
              return (
                <figure
                  key={f.filename}
                  className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-[0_18px_50px_rgba(15,23,42,0.9)] transition-transform hover:-translate-y-1 hover:border-sky-500/80"
                >
                  <button
                    type="button"
                    onClick={() => openPreview(f)}
                    className="block w-full focus:outline-none"
                  >
                    <img
                      src={f.url}
                      alt={label}
                      className="h-40 w-full object-cover sm:h-44"
                    />
                  </button>
                  <figcaption className="flex items-center justify-between px-3 py-1.5 text-[10px] text-slate-400">
                    <span className="truncate">{label}</span>
                    <span>{((f.size ?? (f.sizeKB != null ? f.sizeKB * 1024 : 0)) / 1024).toFixed(0)}kb</span>
                  </figcaption>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => handleDelete(f.filename)}
                      className="absolute right-2 top-2 rounded-full bg-slate-900/90 px-2 py-1 text-[10px] text-slate-200 opacity-0 shadow-lg shadow-slate-900/60 transition-opacity group-hover:opacity-100"
                    >
                      Borrar
                    </button>
                  )}
                </figure>
              )
            })}

            {files.length === 0 && (
              <p className="text-xs text-slate-500">
                Aún no hay imágenes. {isOwner ? 'Sube la primera ✨' : 'El dueño aún no ha subido nada.'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Modal de vista previa grande */}
      {previewFile && (
        <div className="modal-backdrop" onClick={closePreview}>
          <div
            className="modal-card max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-title mb-3">Vista previa</h3>
            <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/60">
              <img
                src={previewFile.url}
                alt={displayLabel(previewFile)}
                className="max-h-[70vh] w-full object-contain bg-slate-950"
              />
            </div>
            <div className="mt-3 flex items-start justify-between gap-4 text-[11px] text-slate-400">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-slate-200">
                  {displayLabel(previewFile)}
                </div>
                {previewFile.description && (
                  <p className="mt-1 whitespace-pre-wrap text-slate-400">
                    {previewFile.description}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 text-right">
                {previewFile.createdAt && (
                  <span className="text-[10px] text-slate-500">
                    Subida el {new Date(previewFile.createdAt).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'short',
                      day: '2-digit',
                    })}
                  </span>
                )}
                <span>{(previewFile.size / 1024).toFixed(0)}kb</span>
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                onClick={closePreview}
                className="modal-btn-cancel"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para renombrar antes de subir */}
      {showUploadModal && file && (
        <div className="modal-backdrop" onClick={cancelUploadModal}>
          <div
            className="modal-card max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-title mb-2">Preparar imagen</h3>
            <p className="modal-text mb-3">
              Revisa la vista previa y ajusta el nombre con el que aparecerá en tu galería.
            </p>
            {uploadPreviewUrl && (
              <div className="mb-3 overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/60">
                <img
                  src={uploadPreviewUrl}
                  alt={uploadName || file.name}
                  className="max-h-64 w-full object-contain bg-slate-950"
                />
              </div>
            )}
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="block text-[11px] font-medium text-slate-300">
                  Nombre para mostrar
                </label>
                <input
                  type="text"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  className="modal-input"
                  maxLength={120}
                  placeholder="Ej. Camden Park, avatar VRChat, etc."
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-medium text-slate-300">
                  Descripción (opcional)
                </label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  className="modal-input comment-textarea min-h-[72px] resize-none"
                  maxLength={400}
                  placeholder="Cuenta un poquito de la imagen, contexto, créditos, etc."
                />
              </div>

              <p className="text-[10px] text-slate-500">
                Solo cambia cómo se muestra en la web. El archivo original se mantiene en tu carpeta{' '}
                <code className="rounded bg-slate-900/80 px-1">/uploads</code>.
              </p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                onClick={cancelUploadModal}
                className="modal-btn-cancel"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmUploadModal}
                className="modal-btn-save"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
