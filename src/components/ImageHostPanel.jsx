import React, { useCallback, useEffect, useMemo, useState } from 'react'
import ModalPortal from './ModalPortal'

const TABS = [
  {
    id: 'config',
    label: 'broadcast',
    index: '01',
    summary: 'embed + auth',
    heading: 'Broadcast lab',
    detail: 'Shape the public card and watch its Discord output in real time.',
  },
  {
    id: 'sharex',
    label: 'uplink',
    index: '02',
    summary: 'ShareX route',
    heading: 'Uploader uplink',
    detail: 'Install the ShareX cartridge and inspect the upload contract.',
  },
  {
    id: 'gallery',
    label: 'vault',
    index: '03',
    summary: 'public vault',
    heading: 'Asset vault',
    detail: 'Review every capture and its public display surface.',
  },
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
const SAMPLE_CODE_SEED = 'x2sRd9QwZa7LmNp4KvT8YcFhJ'

function normalizeCodeLength(value) {
  return Math.max(3, Math.min(25, Number(value) || 5))
}

function getSampleCode(settings) {
  return SAMPLE_CODE_SEED.slice(0, normalizeCodeLength(settings?.fileNameLength))
}

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
  const code = getSampleCode(settings)
  return {
    filename,
    filesize: formatBytes(SAMPLE_FILESIZE_BYTES),
    code,
    url: `https://daivr.dev/i/${code}`,
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
  const footer = applyTemplate(settings?.footer || '', ctx)
  const timeLabel = currentTimeLabel()
  const username = me?.username || 'Dai'
  const avatarUrl = me?.avatarUrl
  const siteIconUrl = settings?.siteIconUrl || avatarUrl || '/favicon.png'

  const showSite = notAnonymous && Boolean(siteName)
  const showAuthor = notAnonymous && Boolean(author)
  const showTimestamp = Boolean(settings?.showTimestamp)
  const showFooter = notAnonymous && (Boolean(footer) || showTimestamp)

  return (
    <div
      className="imagehost-broadcast"
      style={{ '--preview-accent': color, '--preview-image': `url("${previewImage}")` }}
    >
      <div className="imagehost-broadcast-bar">
        <span className="imagehost-broadcast-signal">
          <i aria-hidden="true" />
          output.preview
        </span>
        <span className="imagehost-broadcast-metrics">
          <code>OG: ON</code>
          <code>IMG: 200</code>
          <code>DISCORD</code>
        </span>
      </div>
      <div className="imagehost-broadcast-screen">
        <div className="imagehost-broadcast-corners" aria-hidden="true" />
        <div className="discord-preview" aria-label="Discord embed preview">
          <div className="discord-preview-channel">
            <span># share-feed</span>
            <strong>embed transmission simulator</strong>
          </div>
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
                <span className="discord-preview-bot">APP</span>
                <time className="discord-preview-time">{timeLabel}</time>
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
                        {siteIconUrl && (
                          <img src={siteIconUrl} alt="" className="discord-preview-embed-author-icon" />
                        )}
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
                        <span className="discord-preview-embed-author-label">by</span>
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
                    {showFooter && (
                      <div className="discord-preview-embed-footer">
                        {footer && <span>{footer}</span>}
                        {footer && showTimestamp && (
                          <span className="discord-preview-embed-footer-sep">•</span>
                        )}
                        {showTimestamp && <time>{timeLabel}</time>}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="imagehost-broadcast-footer">
        <span>public route</span>
        <code>{ctx.url}</code>
        <strong>{showEmbed ? 'READY' : 'DISABLED'}</strong>
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
  const [liveStatus, setLiveStatus] = useState('idle')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deletingCode, setDeletingCode] = useState(null)

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

  const fetchGallery = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setGalleryLoading(true)
      setGalleryError('')
    }
    try {
      const res = await fetch('/api/imagehost/gallery', {
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'gallery-failed')
      setGallery(data.images || [])
      setGalleryError('')
    } catch (err) {
      console.error('Error loading imagehost gallery', err)
      if (!silent) setGalleryError('No se pudo cargar la galería.')
    } finally {
      if (!silent) setGalleryLoading(false)
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

    const mergeImage = (image) => {
      if (!image?.code) return
      setGallery((prev) => [
        image,
        ...prev.filter((item) => item.code !== image.code),
      ])
      setGalleryError('')
    }

    const pollId = window.setInterval(() => {
      fetchGallery({ silent: true })
    }, 15000)

    if (!('EventSource' in window)) {
      setLiveStatus('fallback')
      return () => {
        window.clearInterval(pollId)
        setLiveStatus('idle')
      }
    }

    setLiveStatus('connecting')
    const source = new EventSource('/api/imagehost/events', {
      withCredentials: true,
    })

    source.onopen = () => setLiveStatus('live')
    source.onerror = () => setLiveStatus('reconnecting')
    source.addEventListener('ready', () => setLiveStatus('live'))
    source.addEventListener('image-uploaded', (event) => {
      try {
        const data = JSON.parse(event.data || '{}')
        mergeImage(data.image)
        setLiveStatus('live')
      } catch (err) {
        console.error('Error parsing imagehost event', err)
      }
    })
    source.addEventListener('image-deleted', (event) => {
      try {
        const data = JSON.parse(event.data || '{}')
        if (data.code) {
          setGallery((prev) => prev.filter((img) => img.code !== data.code))
        }
        setLiveStatus('live')
      } catch (err) {
        console.error('Error parsing imagehost delete event', err)
      }
    })

    return () => {
      source.close()
      window.clearInterval(pollId)
      setLiveStatus('idle')
    }
  }, [open, fetchGallery])

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

  const requestDelete = useCallback((img) => {
    if (!img?.code) return
    setConfirmDelete({
      code: img.code,
      name: img.originalName || `${img.code}.png`,
    })
  }, [])

  const cancelDelete = useCallback(() => {
    if (deletingCode) return
    setConfirmDelete(null)
  }, [deletingCode])

  const performDelete = useCallback(async () => {
    const target = confirmDelete
    if (!target?.code || deletingCode) return
    setDeletingCode(target.code)
    setGalleryError('')
    try {
      const res = await fetch(`/api/imagehost/${encodeURIComponent(target.code)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('delete-failed')
      setGallery((prev) => prev.filter((g) => g.code !== target.code))
      setConfirmDelete(null)
    } catch (err) {
      console.error('Error deleting image', err)
      setGalleryError(`no se pudo borrar /${target.code}.`)
      setConfirmDelete(null)
    } finally {
      setDeletingCode(null)
    }
  }, [confirmDelete, deletingCode])

  useEffect(() => {
    if (!confirmDelete) return undefined
    const handleKey = (event) => {
      if (event.key === 'Escape') cancelDelete()
      if (event.key === 'Enter') performDelete()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [confirmDelete, cancelDelete, performDelete])

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

  const sampleCtx = useMemo(() => buildSampleCtx(settings), [settings])

  const liveLabel = useMemo(() => {
    if (liveStatus === 'live') return 'live sync'
    if (liveStatus === 'connecting') return 'connecting'
    if (liveStatus === 'reconnecting') return 'reconnecting'
    if (liveStatus === 'fallback') return 'polling'
    return 'offline'
  }, [liveStatus])

  const galleryBytes = useMemo(
    () => gallery.reduce((total, img) => total + (Number(img.size) || 0), 0),
    [gallery],
  )

  const activeTabMeta = useMemo(
    () => TABS.find((item) => item.id === tab) || TABS[0],
    [tab],
  )

  const publicHost = typeof window !== 'undefined'
    ? window.location.host
    : 'daivr.dev'

  if (!open) return null

  return (
    <ModalPortal>
      <div className="modal-backdrop imagehost-backdrop">
        <div
          className="modal-card imagehost-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="imagehost-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="imagehost-workstation">
            <aside className="imagehost-rail">
              <div className="imagehost-rail-brand">
                <span>CAPTURE OS</span>
                <h3 className="modal-title" id="imagehost-title">
                  <strong aria-hidden="true">/i</strong>
                  imagehost
                  <small>.daivr.dev</small>
                </h3>
                <p>private media console</p>
              </div>

              <nav className="imagehost-tabs imagehost-rail-tabs" role="tablist">
                {TABS.map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    role="tab"
                    aria-selected={tab === t.id}
                    className={`imagehost-tab ${tab === t.id ? 'is-active' : ''}`}
                  >
                    <span className="imagehost-tab-index" aria-hidden="true">
                      {t.index}
                    </span>
                    <span className="imagehost-tab-copy">
                      <strong>{t.label}</strong>
                      <em>{t.summary}</em>
                    </span>
                  </button>
                ))}
              </nav>

              <div className="imagehost-rail-monitor" aria-label="ImageHost status">
                <span className="imagehost-rail-label">telemetry</span>
                <span className={`imagehost-live-chip is-${liveStatus}`}>
                  <span aria-hidden="true" />
                  {liveLabel}
                </span>
                <div>
                  <em>vault</em>
                  <strong>{gallery.length} files</strong>
                </div>
                <div>
                  <em>storage</em>
                  <strong>{formatBytes(galleryBytes)}</strong>
                </div>
                <div>
                  <em>host</em>
                  <strong>{publicHost}</strong>
                </div>
              </div>
            </aside>

            <section className="imagehost-desk">
              <div className="imagehost-desk-header">
                <div className="imagehost-desk-title">
                  <span>workspace / {activeTabMeta.label}</span>
                  <h4>{activeTabMeta.heading}</h4>
                  <p>{activeTabMeta.detail}</p>
                </div>
                <div className="imagehost-header-tools">
                  {settings && tab === 'config' && (
                    <div className="imagehost-save-dock">
                      <span className={`imagehost-save-status is-${saveStatus.kind}`}>
                        {saveStatus.message || 'unsaved buffer'}
                      </span>
                      <button
                        type="button"
                        onClick={saveSettings}
                        disabled={saving}
                        className="imagehost-btn-save"
                      >
                        {saving ? 'saving' : 'commit'}
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="imagehost-close-btn"
                    aria-label="Cerrar modal"
                  >
                    <span>exit</span>
                    <strong>x</strong>
                  </button>
                </div>
              </div>

              <div className="imagehost-desk-readouts" aria-hidden="true">
                <span><em>mode</em><strong>{activeTabMeta.summary}</strong></span>
                <span><em>route</em><strong>/i/{sampleCtx.code}</strong></span>
                <span><em>renderer</em><strong>og + raw</strong></span>
                <div className="imagehost-commandline">
                  <code>imagehost.open('{tab}')</code>
                  <i />
                </div>
              </div>

              <div className="imagehost-screen">
                {loading && !settings && (
                  <div className="imagehost-loading">booting capture console...</div>
                )}

          {settings && tab === 'config' && (
            <div className="imagehost-body imagehost-config-body">
              <div className="imagehost-cockpit">
                <section className="imagehost-section imagehost-section-preview imagehost-preview-panel">
                  <header className="imagehost-section-header">
                    <span className="imagehost-section-kicker">broadcast.monitor</span>
                    <span className="imagehost-section-meta">
                      salida real del link en Discord
                    </span>
                  </header>
                  <div className="imagehost-preview-stage">
                    <DiscordEmbedPreview
                      settings={settings}
                      previewImage={previewImage}
                      me={me}
                    />
                  </div>
                </section>

                <aside className="imagehost-side-stack">
                  <section className="imagehost-section imagehost-vault-panel">
                    <header className="imagehost-section-header">
                      <span className="imagehost-section-kicker">auth.secret</span>
                      <span className="imagehost-section-meta">
                        ShareX token
                      </span>
                    </header>
                    <div className="imagehost-secret-row">
                      <div
                        className={`imagehost-secret-card ${secretVisible ? 'is-visible' : ''}`}
                        tabIndex={0}
                        aria-label="ShareX auth secret. Hover or focus to reveal."
                      >
                        <span className="imagehost-secret-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" width="16" height="16">
                            <circle cx="7.5" cy="14.5" r="3.5" />
                            <path d="M10 12l8-8M15 7l2 2M13 9l2 2" />
                          </svg>
                        </span>
                        <code className="imagehost-secret-value">
                          {settings.secret || '—'}
                        </code>
                        <button
                          type="button"
                          onClick={copySecret}
                          className="imagehost-secret-copy"
                          aria-label="Copiar secret"
                          title={secretCopied ? 'copiado' : 'copiar secret'}
                        >
                          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                            <rect x="9" y="9" width="10" height="10" rx="2" />
                            <path d="M5 15V7a2 2 0 0 1 2-2h8" />
                          </svg>
                        </button>
                      </div>
                      <div className="imagehost-secret-actions">
                        <button
                          type="button"
                          onClick={() => setSecretVisible((v) => !v)}
                          className="imagehost-mini-btn"
                        >
                          {secretVisible ? 'blur' : 'pin'}
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
                    <div className="imagehost-vault-stats">
                      <span>
                        <em>token</em>
                        <strong>{settings.secret ? 'armed' : 'missing'}</strong>
                      </span>
                      <span>
                        <em>code</em>
                        <strong>{normalizeCodeLength(settings.fileNameLength)} chars</strong>
                      </span>
                      <span>
                        <em>sample</em>
                        <strong>/{sampleCtx.code}</strong>
                      </span>
                    </div>
                  </section>

                  <section className="imagehost-section imagehost-flags-panel">
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
                  <div className="imagehost-settings-grid">
                  <section className="imagehost-section imagehost-template-panel">
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

                    <div className="imagehost-field">
                      <label htmlFor="ih-footer">custom footer</label>
                      <input
                        id="ih-footer"
                        type="text"
                        value={settings.footer || ''}
                        onChange={(e) => updateField('footer', e.target.value)}
                        placeholder="optional footer text"
                        maxLength={100}
                      />
                    </div>

                    <div className="imagehost-tuning-grid">
                      <div className="imagehost-field imagehost-tune-card imagehost-color-tune">
                        <div className="imagehost-tune-label">
                          <label htmlFor="ih-color">
                            <span aria-hidden="true">$</span> embed color
                          </label>
                          <code>accent.hex</code>
                        </div>
                        <div
                          className="imagehost-control imagehost-color-control imagehost-tune-surface"
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
                          <span className="imagehost-color-beam" aria-hidden="true" />
                        </div>
                      </div>

                      <div className="imagehost-field imagehost-tune-card imagehost-length-tune">
                        <div className="imagehost-tune-label">
                          <label htmlFor="ih-fnlen">
                            <span aria-hidden="true">$</span> file name length
                          </label>
                          <code>code.size</code>
                        </div>
                        <div
                          className="imagehost-control imagehost-length-control imagehost-tune-surface"
                          style={{
                            '--p': `${((normalizeCodeLength(settings.fileNameLength) - 3) / (25 - 3)) * 100}%`,
                          }}
                        >
                          <button
                            type="button"
                            className="imagehost-stepper"
                            onClick={() =>
                              updateField(
                                'fileNameLength',
                                normalizeCodeLength(settings.fileNameLength - 1),
                              )
                            }
                            aria-label="Decrease file name length"
                          >
                            -
                          </button>
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
                          <button
                            type="button"
                            className="imagehost-stepper"
                            onClick={() =>
                              updateField(
                                'fileNameLength',
                                normalizeCodeLength(settings.fileNameLength + 1),
                              )
                            }
                            aria-label="Increase file name length"
                          >
                            +
                          </button>
                          <span className="imagehost-length-readout">
                            <strong>{normalizeCodeLength(settings.fileNameLength)}</strong>
                            <code>/i/{sampleCtx.code}</code>
                          </span>
                        </div>
                        <div className="imagehost-length-ticks" aria-hidden="true">
                          {[3, 8, 14, 20, 25].map((tick) => (
                            <span key={tick}>{tick}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="imagehost-section imagehost-site-panel">
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
                        <label htmlFor="ih-site-icon">site icon url</label>
                        <input
                          id="ih-site-icon"
                          type="url"
                          value={settings.siteIconUrl || ''}
                          onChange={(e) => updateField('siteIconUrl', e.target.value)}
                          placeholder="https://daivr.dev/favicon.png"
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

                  <section className="imagehost-section imagehost-webhook-panel">
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
                  </div>
                </aside>
              </div>
            </div>
          )}

          {settings && tab === 'sharex' && (
            <div className="imagehost-body imagehost-sharex-body">
              <section className="imagehost-section imagehost-sxcu-hero">
                <header className="imagehost-section-header">
                  <span className="imagehost-section-kicker">sharex.setup</span>
                  <span className="imagehost-section-meta">3 pasos · una sola vez</span>
                </header>

                <div className="imagehost-sxcu-topline">
                  <div className="imagehost-sxcu-file">
                    <span className="imagehost-sxcu-icon" aria-hidden="true">
                      <img src="/imagehost/sharex-logo.png" alt="" />
                    </span>
                    <div className="imagehost-sxcu-file-copy">
                      <strong>{settings.siteName || 'daivr.dev'}.sxcu</strong>
                      <span>ShareX custom uploader profile</span>
                      <em>ready to import</em>
                    </div>
                  </div>
                  <span className="imagehost-sxcu-route">
                    POST /api/imagehost/upload
                  </span>
                </div>

                <div className="imagehost-flow" aria-hidden="true">
                  <span>download</span>
                  <span>import</span>
                  <span>select</span>
                </div>

                <ol className="imagehost-steps">
                  <li>
                    <strong>01</strong>
                    <span className="imagehost-step-copy">
                      Descargá el archivo de configuración <code>.sxcu</code>.
                    </span>
                  </li>
                  <li>
                    <strong>02</strong>
                    <span className="imagehost-step-copy">
                      Doble click sobre él → ShareX lo importa como destino.
                    </span>
                  </li>
                  <li>
                    <strong>03</strong>
                    <span className="imagehost-step-copy">
                      En ShareX: <code>Destinations</code> → <code>Image uploader</code> → seleccioná{' '}
                      <code>{settings.siteName || 'daivr.dev'}</code>.
                    </span>
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
                <div className="imagehost-sxcu-note">
                  <span aria-hidden="true">AUTH</span>
                  <strong>el token viaja en header, no en la URL pública</strong>
                </div>
              </section>

              <section className="imagehost-section imagehost-endpoint-panel">
                <header className="imagehost-section-header">
                  <span className="imagehost-section-kicker">endpoint</span>
                  <span className="imagehost-section-meta">request contract</span>
                </header>
                <div className="imagehost-endpoint-shell" aria-label="Upload request example">
                  <div className="imagehost-shell-bar">
                    <span aria-hidden="true" />
                    <span aria-hidden="true" />
                    <span aria-hidden="true" />
                    <strong>upload.request</strong>
                  </div>
                  <code>
                    curl -X POST -H "Authorization: Bearer &lt;secret&gt;" -F "file=@screenshot.png" /api/imagehost/upload
                  </code>
                </div>
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
                <div className="imagehost-response-grid" aria-label="Response preview">
                  <span>
                    <em>url</em>
                    <strong>/i/{sampleCtx.code}</strong>
                  </span>
                  <span>
                    <em>raw</em>
                    <strong>/i/{sampleCtx.code}/raw</strong>
                  </span>
                  <span>
                    <em>delete</em>
                    <strong>tokenized</strong>
                  </span>
                </div>
              </section>
            </div>
          )}

          {confirmDelete && (
            <div
              className="imagehost-confirm-overlay"
              onClick={cancelDelete}
              role="presentation"
            >
              <div
                className="imagehost-confirm-card"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="imagehost-confirm-title"
                aria-describedby="imagehost-confirm-desc"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="imagehost-confirm-head">
                  <span className="imagehost-confirm-kicker">
                    <span aria-hidden="true">$</span> rm --force
                  </span>
                  <span className="imagehost-confirm-target">
                    /i/{confirmDelete.code}
                  </span>
                </div>
                <h4 className="imagehost-confirm-title" id="imagehost-confirm-title">
                  borrar imagen?
                </h4>
                <p className="imagehost-confirm-desc" id="imagehost-confirm-desc">
                  vas a borrar <code>{confirmDelete.name}</code>. esta acción no
                  se puede deshacer.
                </p>
                <div className="imagehost-confirm-actions">
                  <button
                    type="button"
                    className="imagehost-mini-btn"
                    onClick={cancelDelete}
                    disabled={Boolean(deletingCode)}
                  >
                    cancel
                  </button>
                  <button
                    type="button"
                    className="imagehost-mini-btn is-danger imagehost-confirm-go"
                    onClick={performDelete}
                    disabled={Boolean(deletingCode)}
                    autoFocus
                  >
                    {deletingCode ? 'borrando…' : 'sí, borrar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'gallery' && (
            <div className="imagehost-body imagehost-gallery-body">
              <section className="imagehost-section imagehost-gallery-panel">
                <header className="imagehost-library-header">
                  <div className="imagehost-library-heading">
                    <span className="imagehost-section-kicker">asset.library</span>
                    <h5>Captured media</h5>
                    <p>Public links ready for ShareX and Discord delivery.</p>
                  </div>
                  <div className="imagehost-library-stats" aria-label="Vault totals">
                    <span>
                      <em>assets</em>
                      <strong>{gallery.length}</strong>
                    </span>
                    <span>
                      <em>storage</em>
                      <strong>{formatBytes(galleryBytes)}</strong>
                    </span>
                    <span className={`is-${liveStatus}`}>
                      <em>sync</em>
                      <strong><i aria-hidden="true" />{liveLabel}</strong>
                    </span>
                  </div>
                </header>

                <div className="imagehost-gallery-scroll">
                  {galleryLoading && (
                    <p className="imagehost-empty">cargando...</p>
                  )}
                  {galleryError && (
                    <p className="imagehost-empty is-error">{galleryError}</p>
                  )}
                  {!galleryLoading && !galleryError && gallery.length === 0 && (
                    <div className="imagehost-empty imagehost-empty-gallery">
                      <span className="imagehost-empty-glyph" aria-hidden="true">/i</span>
                      <strong>vault empty</strong>
                      <span>no hay imágenes todavía. usá ShareX para subir.</span>
                    </div>
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
                            aria-label={`Open preview page for ${img.originalName}`}
                          >
                            <img src={img.rawUrl} alt={img.originalName} loading="lazy" />
                            <span className="imagehost-gallery-code">/i/{img.code}</span>
                            <span className="imagehost-gallery-open">open page</span>
                          </a>
                          <div className="imagehost-gallery-meta">
                            <strong title={img.originalName}>{img.originalName}</strong>
                            <code>GET /i/{img.code}</code>
                            <div className="imagehost-gallery-facts">
                              <span><em>size</em>{formatBytes(img.size)}</span>
                              <span><em>uploaded</em>{formatDateShort(img.uploadedAt)}</span>
                            </div>
                          </div>
                          <div className="imagehost-gallery-actions">
                            <button
                              type="button"
                              className="imagehost-mini-btn"
                              onClick={() => copyToClipboard(img.url)}
                            >
                              copy link
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
                              onClick={() => requestDelete(img)}
                              disabled={deletingCode === img.code}
                            >
                              {deletingCode === img.code ? 'borrando…' : 'delete'}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </div>
          )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
