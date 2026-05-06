import React, { useEffect, useState } from 'react'
import axios from 'axios'
import ModalPortal from './ModalPortal'

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
  const downloadName = (fileObj) =>
    fileObj.originalName || fileObj.filename || displayLabel(fileObj)
  const totalSizeKb = files.reduce(
    (sum, f) => sum + ((f.size ?? (f.sizeKB != null ? f.sizeKB * 1024 : 0)) / 1024),
    0,
  )

  return (
    <section id="gallery" className="mx-auto max-w-6xl px-4 py-8">
      <div className="section-card gallery-panel">
        <header className="gallery-panel-header">
          <div>
            <h2 className="section-title">Galería</h2>
            <p className="gallery-panel-subtitle">curated captures · local media vault</p>
          </div>
          <div className="gallery-panel-stats" aria-hidden="true">
            <span>{files.length} files</span>
            <span>{totalSizeKb >= 1024 ? `${(totalSizeKb / 1024).toFixed(1)}mb` : `${totalSizeKb.toFixed(0)}kb`}</span>
            <span>preview:on</span>
          </div>
        </header>

        <div className="gallery-panel-body">
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

          <div className="gallery-grid">
            {files.map((f, index) => {
              const label = displayLabel(f)
              const sizeKb = ((f.size ?? (f.sizeKB != null ? f.sizeKB * 1024 : 0)) / 1024)
              const extension =
                (f.filename || '').split('.').pop()?.slice(0, 4).toUpperCase() || 'IMG'
              return (
                <figure
                  key={f.filename}
                  className="gallery-tile group"
                >
                  <button
                    type="button"
                    onClick={() => openPreview(f)}
                    className="gallery-media-button"
                  >
                    <img
                      src={f.url}
                      alt={label}
                      className="gallery-image"
                      loading="lazy"
                      decoding="async"
                    />
                  </button>
                  <div className="gallery-hud" aria-hidden="true">
                    <span>{`IMG_${String(index + 1).padStart(2, '0')}`}</span>
                    <span>{extension}</span>
                  </div>
                  <span className="gallery-corner gallery-corner-tl" aria-hidden="true" />
                  <span className="gallery-corner gallery-corner-br" aria-hidden="true" />
                  <figcaption className="gallery-caption">
                    <span>{label}</span>
                    <span>{sizeKb.toFixed(0)}kb</span>
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
        <ModalPortal>
          <div className="modal-backdrop" onClick={closePreview}>
            <div
              className="modal-card modal-fit gallery-preview-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div>
                  <h3 className="modal-title">Vista previa</h3>
                </div>
                <button
                  type="button"
                  onClick={closePreview}
                  className="modal-close"
                  aria-label="Cerrar"
                >
                  ✕
                </button>
              </div>

              {/*
                Ajuste: este modal se “encoge” al tamaño real de la imagen (con límites de viewport)
                para evitar los espacios laterales cuando la imagen es vertical.
              */}
              <div className="gallery-preview-wrap">
                <div className="gallery-preview-inner">
                  <div className="modal-panel gallery-preview-stage">
                    <img
                      src={previewFile.url}
                      alt={displayLabel(previewFile)}
                      className="gallery-preview-image"
                    />
                  </div>

                  <div className="gallery-preview-meta">
                    <div className="gallery-preview-name">
                      <div>
                        {displayLabel(previewFile)}
                      </div>
                      {previewFile.description && (
                        <p>
                          {previewFile.description}
                        </p>
                      )}
                    </div>
                    <div className="gallery-preview-details">
                      {previewFile.createdAt && (
                        <span>
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
                </div>
              </div>
              <div className="modal-actions gallery-preview-actions">
                <a
                  href={previewFile.url}
                  download={downloadName(previewFile)}
                  className="modal-btn-save gallery-download-btn"
                >
                  <svg
                    className="gallery-download-icon"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path
                      d="M10 3.5v8.1m0 0 3.2-3.2M10 11.6 6.8 8.4M4.5 13.2v1.9c0 .8.6 1.4 1.4 1.4h8.2c.8 0 1.4-.6 1.4-1.4v-1.9"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                  Descargar
                </a>
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
        </ModalPortal>
      )}

      {/* Modal para renombrar antes de subir */}
      {showUploadModal && file && (
        <ModalPortal>
          <div className="modal-backdrop" onClick={cancelUploadModal}>
            <div
              className="modal-card modal-lg gallery-upload-modal"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Preparar imagen</h3>
                <p className="modal-text">
                  Revisa la vista previa y ajusta el nombre con el que aparecerá en tu galería.
                </p>
              </div>
              <button
                type="button"
                onClick={cancelUploadModal}
                className="modal-close"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            {uploadPreviewUrl && (
              <div className="modal-panel mb-3 overflow-hidden rounded-2xl">
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
        </ModalPortal>
      )}
    </section>
  )
}
