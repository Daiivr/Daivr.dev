import React, { useCallback, useEffect, useMemo, useState } from 'react'
import ModalPortal from './ModalPortal'

const TABS = [
  { id: 'config', label: 'config.toml' },
  { id: 'sharex', label: 'sharex.sxcu' },
  { id: 'gallery', label: 'gallery.sh' },
]

const formatBytes = (bytes) => {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i += 1
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

const formatDateShort = (iso) => {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (_) {
    return iso
  }
}

const SAMPLE_FILENAME = 'screenshot.png'
const SAMPLE_FILESIZE_BYTES = 1024 * 1024 + 245 * 1024 // 1.24 MB
const SAMPLE_CODE = 'x2sRd'

function applyTemplate(template, ctx) {
  if (!template) return ''
  return String(template).replace(/\{(\w+)\}/g, (m, key) =>
    ctx[key] == null ? m : String(ctx[key]),
  )
}

function buildSampleCtx(settings) {
  const filename = settings?.showExtension
    ? SAMPLE_FILENAME
    : SAMPLE_FILENAME.replace(/\.[^.]+$/, '')
  return {
    filename,
    filesize: formatBytes(SAMPLE_FILESIZE_BYTES),
    code: SAMPLE_CODE,
    url: `https://daivr.dev/i/${SAMPLE_CODE}`,
  }
}

function currentTimeLabel() {
  const d = new Date()
  let h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `Today at ${h}:${String(m).padStart(2, '0')} ${ampm}`
}

function DiscordEmbedPreview({ settings, previewImage, me }) {
  const ctx = buildSampleCtx(settings)
  const title = applyTemplate(settings?.title || '{filename} | {filesize}', ctx)
  const description = applyTemplate(settings?.description || '', ctx)
  const color = settings?.embedColor || '#00ffe5'
  const showEmbed = settings?.embed !== false
  const notAnonymous = !settings?.anonymous
  const siteName = settings?.siteName || ''
  const siteUrl = settings?.siteNameUrl || ''
  const author = settings?.author || ''
  const authorUrl = settings?.authorUrl || ''
  const username = me?.username || 'Dai'
  const avatarUrl = me?.avatarUrl

  const showAuthor = notAnonymous && Boolean(author)
  const showSite = notAnonymous && Boolean(siteName)
  const showTimestamp = Boolean(settings?.showTimestamp)
  const showFooter = showSite || showTimestamp

  return (
    <div className="discord-preview" aria-label="Discord embed preview">
      <div className="discord-preview-msg">
        <div className="discord-preview-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" />
          ) : (
            <div className="discord-preview-avatar-fallback">{username[0]?.toUpperCase() || 'D'}</div>
          )}
        </div>
        <div className="discord-preview-content">
          <div className="discord-preview-meta">
            <strong className="discord-preview-name">{username}</strong>
            <time className="discord-preview-time">{currentTimeLabel()}</time>
          </div>
          <a
            href={ctx.url}
            target="_blank"
            rel="noreferrer"
            className="discord-preview-url"
            onClick={(e) => e.preventDefault()}
          >
            {ctx.url}
          </a>

          {showEmbed && (
            <div
              className="discord-preview-embed"
              style={{ '--embed-color': color }}
            >
              <div className="discord-preview-embed-body">
                {showSite && (
                  <div className="discord-preview-embed-site">
                    {siteUrl ? (
                      <a
                        href={siteUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.preventDefault()}
                      >
                        {siteName}
                      </a>
                    ) : (
                      <span>{siteName}</span>
                    )}
                  </div>
                )}
                {showAuthor && (
                  <div className="discord-preview-embed-author">
                    {avatarUrl && (
                      <img src={avatarUrl} alt="" className="discord-preview-embed-author-icon" />
                    )}
                    {authorUrl ? (
                      <a
                        href={authorUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.preventDefault()}
                      >
                        {author}
                      </a>
                    ) : (
                      <span>{author}</span>
                    )}
                  </div>
                )}
                {title && (
                  <div className="discord-preview-embed-title">{title}</div>
                )}
                {description && (
                  <div className="discord-preview-embed-desc">{description}</div>
                )}
                {previewImage && (
                  <div className="discord-preview-embed-image">
                    <img src={previewImage} alt="" />
                  </div>
                )}
                {showTimestamp && (
                  <div className="discord-preview-embed-footer">
                    <time>{currentTimeLabel()}</time>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ImageHostPanel({ open, onClose, me }) {
  const [tab, setTab] = useState('config')
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState({ kind: 'idle', message: '' })
  const [secretVisible, setSecretVisible] = useState(false)
  const [secretCopied, setSecretCopied] = useState(false)
  const [rotateConfirm, setRotateConfirm] = useState(false)
  const [gallery, setGallery] = useState([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [galleryError, setGalleryError] = useState('')

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/imagehost/settings', {
        credentials: 'include',
      })
      const data = await res.json()
      if (res.ok && data.settings) setSettings(data.settings)
    } catch (err) {
      console.error('Error loading imagehost settings', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchGallery = useCallback(async () => {
    setGalleryLoading(true)
    setGalleryError('')
    try {
      const res = await fetch('/api/imagehost/gallery', {
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'gallery-failed')
      setGallery(data.images || [])
    } catch (err) {
      console.error('Error loading imagehost gallery', err)
      setGalleryError('No se pudo cargar la galería.')
    } finally {
      setGalleryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    fetchSettings()
    // Always load gallery so the config preview has a real sample image to show.
    fetchGallery()
  }, [open, fetchSettings, fetchGallery])

  useEffect(() => {
    if (!open) return undefined
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const updateField = useCallback((key, value) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
    setSaveStatus({ kind: 'idle', message: '' })
  }, [])

  const saveSettings = useCallback(async () => {
    if (!settings || saving) return
    setSaving(true)
    setSaveStatus({ kind: 'saving', message: 'guardando...' })
    try {
      const res = await fetch('/api/imagehost/settings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'save-failed')
      setSettings(data.settings)
      setSaveStatus({ kind: 'saved', message: 'guardado' })
      window.setTimeout(() => {
        setSaveStatus({ kind: 'idle', message: '' })
      }, 1800)
    } catch (err) {
      console.error('Error saving imagehost settings', err)
      setSaveStatus({ kind: 'error', message: 'error al guardar' })
    } finally {
      setSaving(false)
    }
  }, [settings, saving])

  const rotateSecret = useCallback(async () => {
    if (!rotateConfirm) {
      setRotateConfirm(true)
      window.setTimeout(() => setRotateConfirm(false), 4000)
      return
    }
    try {
      const res = await fetch('/api/imagehost/secret/rotate', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error('rotate-failed')
      setSettings((prev) => (prev ? { ...prev, secret: data.secret } : prev))
      setRotateConfirm(false)
      setSaveStatus({ kind: 'saved', message: 'secret rotado' })
      window.setTimeout(() => setSaveStatus({ kind: 'idle', message: '' }), 1800)
    } catch (err) {
      console.error('Error rotating secret', err)
      setSaveStatus({ kind: 'error', message: 'rotate failed' })
    }
  }, [rotateConfirm])

  const copySecret = useCallback(async () => {
    if (!settings?.secret) return
    try {
      await navigator.clipboard.writeText(settings.secret)
      setSecretCopied(true)
      window.setTimeout(() => setSecretCopied(false), 1500)
    } catch (_) {
      // ignore
    }
  }, [settings?.secret])

  const downloadSxcu = useCallback(() => {
    // Server already serves it as attachment.
    window.location.href = '/api/imagehost/sxcu'
  }, [])

  const deleteImage = useCallback(async (code) => {
    if (!code) return
    if (!window.confirm(`Borrar imagen ${code}? esta acción no se puede deshacer.`)) return
    try {
      const res = await fetch(`/api/imagehost/${encodeURIComponent(code)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('delete-failed')
      setGallery((prev) => prev.filter((g) => g.code !== code))
    } catch (err) {
      console.error('Error deleting image', err)
      window.alert('No se pudo borrar la imagen.')
    }
  }, [])

  const copyToClipboard = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (_) {
      // ignore
    }
  }, [])

  const previewImage = useMemo(() => {
    if (gallery && gallery.length > 0) return gallery[0].rawUrl
    return 'https://opengraph.githubassets.com/1/Daiivr/TradeDex'
  }, [gallery])

  const maskedSecret = useMemo(() => {
    const s = settings?.secret || ''
    if (!s) return ''
    if (secretVisible) return s
    return s.slice(0, 6) + '·'.repeat(Math.max(8, s.length - 10)) + s.slice(-4)
  }, [settings?.secret, secretVisible])

  if (!open) return null

  return (
    <ModalPortal>
      <div className="modal-backdrop imagehost-backdrop" onClick={onClose}>
        <div
          className="modal-card imagehost-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="imagehost-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="modal-header imagehost-header">
            <div>
              <h3 className="modal-title" id="imagehost-title">
                imagehost.daivr.dev
              </h3>
              <p className="modal-text">
                Panel de admin para configurar ShareX, gestionar la galería y
                rotar el secret. Solo vos podés ver esto.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="modal-close"
              aria-label="Cerrar"
            >
              x
            </button>
          </div>

          <nav className="imagehost-tabs" role="tablist">
            {TABS.map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => setTab(t.id)}
                role="tab"
                aria-selected={tab === t.id}
                className={`imagehost-tab ${tab === t.id ? 'is-active' : ''}`}
              >
                <span aria-hidden="true">$</span> {t.label}
              </button>
            ))}
          </nav>

          {loading && !settings && (
            <div className="imagehost-loading">cargando settings...</div>
          )}

          {settings && tab === 'config' && (
            <div className="imagehost-body">
              <section className="imagehost-section">
                <header className="imagehost-section-header">
                  <span className="imagehost-section-kicker">auth.secret</span>
                  <span className="imagehost-section-meta">
                    rotalo si se filtra · ShareX usa este token
                  </span>
                </header>
                <div className="imagehost-secret-row">
                  <code className="imagehost-secret">{maskedSecret || '—'}</code>
                  <div className="imagehost-secret-actions">
                    <button
                      type="button"
                      onClick={() => setSecretVisible((v) => !v)}
                      className="imagehost-mini-btn"
                    >
                      {secretVisible ? 'ocultar' : 'ver'}
                    </button>
                    <button
                      type="button"
                      onClick={copySecret}
                      className="imagehost-mini-btn"
                    >
                      {secretCopied ? '✓ copiado' : 'copiar'}
                    </button>
                    <button
                      type="button"
                      onClick={rotateSecret}
                      className={`imagehost-mini-btn ${rotateConfirm ? 'is-danger-confirm' : 'is-danger'}`}
                    >
                      {rotateConfirm ? 'confirmar?' : 'rotate'}
                    </button>
                  </div>
                </div>
              </section>

              <section className="imagehost-section imagehost-section-preview">
                <header className="imagehost-section-header">
                  <span className="imagehost-section-kicker">preview.discord</span>
                  <span className="imagehost-section-meta">
                    live · cómo se ve cuando lo pegás en un canal
                  </span>
                </header>
                <DiscordEmbedPreview
                  settings={settings}
                  previewImage={previewImage}
                  me={me}
                />
              </section>

              <section className="imagehost-section">
                <header className="imagehost-section-header">
                  <span className="imagehost-section-kicker">embed.tpl</span>
                  <span className="imagehost-section-meta">
                    variables: {'{filename}'} · {'{filesize}'} · {'{code}'}
                  </span>
                </header>

                <div className="imagehost-field">
                  <label htmlFor="ih-title">title</label>
                  <input
                    id="ih-title"
                    type="text"
                    value={settings.title || ''}
                    onChange={(e) => updateField('title', e.target.value)}
                    placeholder="{filename} | {filesize}"
                    maxLength={100}
                  />
                </div>

                <div className="imagehost-field">
                  <label htmlFor="ih-description">description</label>
                  <textarea
                    id="ih-description"
                    value={settings.description || ''}
                    onChange={(e) => updateField('description', e.target.value)}
                    placeholder="opcional — sale debajo del título en el embed de Discord"
                    rows={2}
                    maxLength={250}
                  />
                </div>

                <div className="imagehost-grid-2">
                  <div className="imagehost-field">
                    <label htmlFor="ih-color">embed color</label>
                    <div
                      className="imagehost-control"
                      style={{ '--swatch-color': settings.embedColor || '#00ffe5' }}
                    >
                      <label
                        className="imagehost-color-swatch"
                        aria-label="Open color picker"
                      >
                        <input
                          id="ih-color"
                          type="color"
                          value={settings.embedColor || '#00ffe5'}
                          onChange={(e) => updateField('embedColor', e.target.value)}
                        />
                      </label>
                      <input
                        type="text"
                        className="imagehost-color-hex"
                        value={(settings.embedColor || '#00ffe5').toUpperCase()}
                        onChange={(e) => {
                          const v = e.target.value.trim()
                          if (/^#?[0-9a-fA-F]{0,6}$/.test(v)) {
                            updateField(
                              'embedColor',
                              v.startsWith('#') ? v : `#${v}`,
                            )
                          }
                        }}
                        maxLength={7}
                        spellCheck="false"
                      />
                    </div>
                  </div>

                  <div className="imagehost-field">
                    <label htmlFor="ih-fnlen">file name length</label>
                    <div
                      className="imagehost-control"
                      style={{
                        '--p': `${(((Number(settings.fileNameLength) || 5) - 3) / (25 - 3)) * 100}%`,
                      }}
                    >
                      <input
                        id="ih-fnlen"
                        type="range"
                        min="3"
                        max="25"
                        value={settings.fileNameLength || 5}
                        onChange={(e) =>
                          updateField('fileNameLength', Number(e.target.value))
                        }
                        className="imagehost-slider"
                      />
                      <span className="imagehost-control-value">
                        {settings.fileNameLength || 5}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="imagehost-section">
                <header className="imagehost-section-header">
                  <span className="imagehost-section-kicker">site.meta</span>
                  <span className="imagehost-section-meta">opcional</span>
                </header>

                <div className="imagehost-grid-2">
                  <div className="imagehost-field">
                    <label htmlFor="ih-site">site name</label>
                    <input
                      id="ih-site"
                      type="text"
                      value={settings.siteName || ''}
                      onChange={(e) => updateField('siteName', e.target.value)}
                      placeholder="daivr.dev"
                      maxLength={50}
                    />
                  </div>
                  <div className="imagehost-field">
                    <label htmlFor="ih-site-url">site name url</label>
                    <input
                      id="ih-site-url"
                      type="url"
                      value={settings.siteNameUrl || ''}
                      onChange={(e) => updateField('siteNameUrl', e.target.value)}
                      placeholder="https://daivr.dev"
                      maxLength={250}
                    />
                  </div>
                  <div className="imagehost-field">
                    <label htmlFor="ih-author">author</label>
                    <input
                      id="ih-author"
                      type="text"
                      value={settings.author || ''}
                      onChange={(e) => updateField('author', e.target.value)}
                      placeholder="Dai"
                      maxLength={50}
                    />
                  </div>
                  <div className="imagehost-field">
                    <label htmlFor="ih-author-url">author url</label>
                    <input
                      id="ih-author-url"
                      type="url"
                      value={settings.authorUrl || ''}
                      onChange={(e) => updateField('authorUrl', e.target.value)}
                      placeholder="https://daivr.dev"
                      maxLength={250}
                    />
                  </div>
                </div>
              </section>

              <section className="imagehost-section">
                <header className="imagehost-section-header">
                  <span className="imagehost-section-kicker">webhook.discord</span>
                  <span className="imagehost-section-meta">
                    notifica cada upload — opcional
                  </span>
                </header>
                <div className="imagehost-field">
                  <input
                    type="url"
                    value={settings.discordWebhook || ''}
                    onChange={(e) => updateField('discordWebhook', e.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                    maxLength={250}
                  />
                </div>
              </section>

              <section className="imagehost-section">
                <header className="imagehost-section-header">
                  <span className="imagehost-section-kicker">flags</span>
                </header>
                <div className="imagehost-toggles">
                  {[
                    { key: 'embed', label: 'embed', desc: 'incluir meta tags OG en la página pública' },
                    { key: 'showTimestamp', label: 'timestamp', desc: 'mostrar timestamp en el embed de Discord' },
                    { key: 'showExtension', label: 'extension', desc: 'mostrar extensión en el {filename}' },
                    { key: 'anonymous', label: 'anonymous', desc: 'ocultar autor/footer en el embed' },
                  ].map((flag) => (
                    <label key={flag.key} className="imagehost-toggle">
                      <input
                        type="checkbox"
                        checked={Boolean(settings[flag.key])}
                        onChange={(e) => updateField(flag.key, e.target.checked)}
                      />
                      <span className="imagehost-toggle-swatch" aria-hidden="true" />
                      <span className="imagehost-toggle-text">
                        <strong>{flag.label}</strong>
                        <span>{flag.desc}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </section>

              <div className="imagehost-actions">
                <span className={`imagehost-save-status is-${saveStatus.kind}`}>
                  {saveStatus.message}
                </span>
                <button
                  type="button"
                  onClick={saveSettings}
                  disabled={saving}
                  className="imagehost-btn-save"
                >
                  {saving ? 'guardando...' : 'save config'}
                </button>
              </div>
            </div>
          )}

          {settings && tab === 'sharex' && (
            <div className="imagehost-body">
              <section className="imagehost-section">
                <header className="imagehost-section-header">
                  <span className="imagehost-section-kicker">sharex.setup</span>
                  <span className="imagehost-section-meta">3 pasos · una sola vez</span>
                </header>

                <ol className="imagehost-steps">
                  <li>
                    <strong>1.</strong> Descargá el archivo de configuración
                    <code>.sxcu</code>.
                  </li>
                  <li>
                    <strong>2.</strong> Doble click sobre él → ShareX lo importa
                    como destino.
                  </li>
                  <li>
                    <strong>3.</strong> En ShareX: <code>Destinations</code> →
                    <code>Image uploader</code> → seleccioná{' '}
                    <code>{settings.siteName || 'daivr.dev'}</code>.
                  </li>
                </ol>

                <div className="imagehost-sxcu-actions">
                  <button
                    type="button"
                    className="imagehost-btn-save"
                    onClick={downloadSxcu}
                  >
                    descargar .sxcu
                  </button>
                  <a
                    href="https://getsharex.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="imagehost-btn-link"
                  >
                    obtener ShareX ↗
                  </a>
                </div>
              </section>

              <section className="imagehost-section">
                <header className="imagehost-section-header">
                  <span className="imagehost-section-kicker">endpoint</span>
                </header>
                <div className="imagehost-kv">
                  <div>
                    <span>method</span>
                    <code>POST</code>
                  </div>
                  <div>
                    <span>url</span>
                    <code>
                      {(window?.location?.origin || 'https://daivr.dev') +
                        '/api/imagehost/upload'}
                    </code>
                  </div>
                  <div>
                    <span>auth</span>
                    <code>Authorization: Bearer {'<secret>'}</code>
                  </div>
                  <div>
                    <span>field</span>
                    <code>file (multipart/form-data)</code>
                  </div>
                  <div>
                    <span>returns</span>
                    <code>{'{ url, rawUrl, deletionUrl }'}</code>
                  </div>
                </div>
              </section>
            </div>
          )}

          {tab === 'gallery' && (
            <div className="imagehost-body">
              <section className="imagehost-section">
                <header className="imagehost-section-header">
                  <span className="imagehost-section-kicker">gallery</span>
                  <span className="imagehost-section-meta">
                    {gallery.length} item{gallery.length === 1 ? '' : 's'}
                  </span>
                </header>

                {galleryLoading && (
                  <p className="imagehost-empty">cargando...</p>
                )}
                {galleryError && (
                  <p className="imagehost-empty is-error">{galleryError}</p>
                )}
                {!galleryLoading && !galleryError && gallery.length === 0 && (
                  <p className="imagehost-empty">
                    no hay imágenes todavía. usá ShareX para subir.
                  </p>
                )}

                {gallery.length > 0 && (
                  <ul className="imagehost-gallery">
                    {gallery.map((img) => (
                      <li key={img.code} className="imagehost-gallery-item">
                        <a
                          href={img.url}
                          target="_blank"
                          rel="noreferrer"
                          className="imagehost-gallery-thumb"
                        >
                          <img src={img.rawUrl} alt={img.originalName} loading="lazy" />
                          <span className="imagehost-gallery-code">/{img.code}</span>
                        </a>
                        <div className="imagehost-gallery-meta">
                          <span title={img.originalName}>{img.originalName}</span>
                          <span>{formatBytes(img.size)} · {formatDateShort(img.uploadedAt)}</span>
                        </div>
                        <div className="imagehost-gallery-actions">
                          <button
                            type="button"
                            className="imagehost-mini-btn"
                            onClick={() => copyToClipboard(img.url)}
                          >
                            copy url
                          </button>
                          <a
                            className="imagehost-mini-btn"
                            href={img.rawUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            raw
                          </a>
                          <button
                            type="button"
                            className="imagehost-mini-btn is-danger"
                            onClick={() => deleteImage(img.code)}
                          >
                            delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  )
}
