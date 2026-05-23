import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ModalPortal from './ModalPortal'

const TRADEDEX_REPO = 'https://github.com/Daiivr/TradeDex'
const TRADEDEX_RELEASE_PAGE = 'https://github.com/Daiivr/TradeDex/releases/latest'
const TRADEDEX_REPO_API = 'https://api.github.com/repos/Daiivr/TradeDex'
const TRADEDEX_LOGO = '/projects/tradedex.png'
const TRADEDEX_LOGO_FALLBACK = 'https://opengraph.githubassets.com/1/Daiivr/TradeDex'
const SCAN_ENDPOINT = '/api/tradedex/scan'
const POLL_INTERVAL_MS = 1500

const STAGES = [
  { id: 'init', label: 'init scanner' },
  { id: 'downloading', label: 'pulling asset' },
  { id: 'hashing', label: 'sha-256' },
  { id: 'querying', label: 'querying virustotal' },
  { id: 'submitting', label: 'uploading sample' },
  { id: 'analyzing', label: 'awaiting verdict' },
  { id: 'done', label: 'report ready' },
]
const STAGE_INDEX = STAGES.reduce((acc, s, i) => ((acc[s.id] = i), acc), {})

const formatBytes = (bytes) => {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let value = n
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

const shortHash = (hash) => {
  if (!hash || typeof hash !== 'string') return ''
  if (hash.length <= 16) return hash
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`
}

export default function About() {
  const [modalOpen, setModalOpen] = useState(false)
  const [scan, setScan] = useState(null)
  const [scanError, setScanError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [repoStats, setRepoStats] = useState(null)
  const pollTimerRef = useRef(0)

  // Fetch repo stats (stars, forks, open issues) on mount + every 5 min.
  useEffect(() => {
    let cancelled = false

    const loadStats = () => {
      fetch(TRADEDEX_REPO_API, {
        headers: { Accept: 'application/vnd.github+json' },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled || !data) return
          setRepoStats({
            stars: data.stargazers_count ?? 0,
            forks: data.forks_count ?? 0,
            issues: data.open_issues_count ?? 0,
          })
        })
        .catch(() => {})
    }

    loadStats()
    const interval = window.setInterval(loadStats, 5 * 60 * 1000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  const openModal = useCallback((event) => {
    event.preventDefault()
    setModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setModalOpen(false)
  }, [])

  // Poll the scan endpoint while the modal is open and status isn't terminal.
  useEffect(() => {
    if (!modalOpen) return undefined
    let cancelled = false

    const tick = async () => {
      try {
        const res = await fetch(SCAN_ENDPOINT, { credentials: 'include' })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setScanError(data?.message || 'No se pudo escanear el release.')
          return
        }
        setScan(data)
        setScanError('')
        if (data.status !== 'done' && data.status !== 'error') {
          pollTimerRef.current = window.setTimeout(tick, POLL_INTERVAL_MS)
        }
      } catch (err) {
        if (cancelled) return
        console.error('Error polling TradeDex scan', err)
        setScanError('No se pudo contactar el scanner.')
        pollTimerRef.current = window.setTimeout(tick, POLL_INTERVAL_MS * 2)
      }
    }

    tick()
    return () => {
      cancelled = true
      window.clearTimeout(pollTimerRef.current)
    }
  }, [modalOpen])

  useEffect(() => {
    if (!modalOpen) return undefined
    const handleKey = (event) => {
      if (event.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [modalOpen, closeModal])

  const stageId = scan?.stage || (scan?.status === 'done' ? 'done' : 'init')
  const stageIndex = STAGE_INDEX[stageId] ?? 0
  const isDone = scan?.status === 'done'
  const isErrored = scan?.status === 'error'
  const downloadProgress = Math.max(0, Math.min(1, Number(scan?.progress) || 0))

  const verdict = scan?.vt?.verdict
  const stats = scan?.vt?.stats
  const isMalicious = verdict === 'malicious'
  const isSuspicious = verdict === 'suspicious'
  const isClean = verdict === 'clean'
  const notScanned = scan?.vt?.status === 'not-scanned'

  const verdictMeta = useMemo(() => {
    if (!scan) return null
    if (isErrored) {
      return { tone: 'danger', label: 'scanner.fail', detail: scan.error || 'unknown error' }
    }
    if (!isDone) {
      return { tone: 'pending', label: 'scanning...', detail: 'gate locked' }
    }
    if (notScanned) {
      const reason = scan?.vt?.reason
      return {
        tone: 'warn',
        label: 'unknown · not scanned',
        detail:
          reason === 'file-too-large'
            ? 'binary excede límite de VT free tier'
            : 'hash desconocido para VirusTotal',
      }
    }
    if (isMalicious) {
      return { tone: 'danger', label: 'flagged · malicious', detail: 'gate bloqueada' }
    }
    if (isSuspicious) {
      return { tone: 'warn', label: 'suspicious', detail: 'verifica con cuidado' }
    }
    if (isClean) {
      return { tone: 'safe', label: 'verified · clean', detail: 'gate desbloqueada' }
    }
    return { tone: 'pending', label: 'esperando verdict', detail: '' }
  }, [scan, isErrored, isDone, notScanned, isMalicious, isSuspicious, isClean])

  const canDownload = isDone && !isMalicious && !isErrored && !!scan?.asset?.downloadUrl

  const handleDownload = () => {
    if (!canDownload || downloading) return
    setDownloading(true)
    const link = document.createElement('a')
    link.href = scan.asset.downloadUrl
    link.rel = 'noreferrer'
    if (scan.asset.name) link.download = scan.asset.name
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => setDownloading(false), 900)
  }

  return (
    <section id="about" className="section-shell">
      <div className="about-stack">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          {/* Sobre mí */}
          <div className="section-card about-card">
            <div className="about-card-header">
              <div>
                <h2 className="section-title">about.md</h2>
                <p className="about-card-subtitle">
                  <span className="dot" /> readme · 2 paragraphs · utf-8
                </p>
              </div>
              <span className="about-card-status">
                <span aria-hidden="true" />
                active
              </span>
            </div>

            <div className="about-copy-panel">
              <p>
                Soy <span>Dai</span>: dev full-stack basada en Alaska, con un café
                frío al lado y demasiadas pestañas abiertas. Construyo bots de
                Discord, herramientas SysBot y webs mimadas; me gusta romper cosas
                con código y luego dejarlas mejor que como las encontré.
              </p>
              <p>
                EN/ES. Grindo XP en Visual Studio entre anime y lo-fi, casi siempre
                perdida en Fallout, Minecraft, VRChat o DBD. Esta página es mi hub:
                proyectos, links, screenshots y presencia de Discord en vivo.
              </p>
            </div>

            <div className="about-signal-grid" aria-label="About quick facts">
              <div className="about-signal-card">
                <span>focus</span>
                <strong>bots + tools</strong>
              </div>
              <div className="about-signal-card">
                <span>runtime</span>
                <strong>night build</strong>
              </div>
              <div className="about-signal-card">
                <span>mode</span>
                <strong>lo-fi loop</strong>
              </div>
            </div>

            <div className="about-footer-panel">
              <div className="about-footer-top">
                <span>session.trace</span>
                <span>stable</span>
              </div>
            </div>
          </div>

          {/* Mini ficha */}
          <div className="section-card profile-card">
            <div className="profile-card-header">
              <div>
                <h3 className="section-title">profile.json</h3>
                <p className="profile-card-subtitle">identity · stack · active projects</p>
              </div>
              <span className="profile-status-pill">
                <span aria-hidden="true" />
                live
              </span>
            </div>

            <dl className="profile-grid">
              <div className="profile-field">
                <dt>location</dt>
                <dd>
                  Alaska
                  <span>snow + <span className="rgb-text">RGB</span></span>
                </dd>
              </div>

              <div className="profile-field">
                <dt>role</dt>
                <dd>
                  Developer
                  <span>bots · games · tools</span>
                </dd>
              </div>

              <div className="profile-field">
                <dt>stack</dt>
                <dd>
                  TS · React · C#
                  <span>Unity · Node</span>
                </dd>
              </div>

              <div className="profile-field">
                <dt>mood</dt>
                <dd>
                  Grinding XP
                  <span>03:00 build window</span>
                </dd>
              </div>
            </dl>

            <div className="profile-projects">
              <div className="profile-projects-top">
                <span>projects</span>
                <span>3 pinned</span>
              </div>
              <div className="profile-project-list">
                <span className="profile-project-chip">DaiBot</span>
                <a
                  href="https://github.com/Daiivr/PokeNexo"
                  target="_blank"
                  rel="noreferrer"
                  className="profile-project-chip"
                >
                  PokeNexo
                </a>
                <span className="profile-project-chip">Emoji Bank</span>
              </div>
            </div>
          </div>
        </div>

        {/* Proyectos actuales */}
        <div className="section-card current-projects-card">
          <div className="current-projects-header">
            <div>
              <h2 className="section-title">current-projects.sh</h2>
              <p className="current-projects-subtitle">
                <span className="dot" /> now shipping · 1 active · realtime build
              </p>
            </div>
            <span className="current-projects-status">
              <span aria-hidden="true" />
              building
            </span>
          </div>

          <div className="current-projects-grid">
            <button
              type="button"
              onClick={openModal}
              className="current-project"
              aria-label="Open TradeDex options"
            >
              <div className="current-project-media">
                <span className="current-project-grid" aria-hidden="true" />
                <span className="current-project-glow" aria-hidden="true" />
                <img
                  className="current-project-logo"
                  src={TRADEDEX_LOGO}
                  alt="TradeDex logo"
                  loading="lazy"
                  onError={(event) => {
                    if (event.currentTarget.dataset.fallback) return
                    event.currentTarget.dataset.fallback = '1'
                    event.currentTarget.src = TRADEDEX_LOGO_FALLBACK
                  }}
                />
                <span className="current-project-tag">[ 01 ]</span>
                <span className="current-project-scan" aria-hidden="true" />
                <span className="current-project-corner current-project-corner-tl" aria-hidden="true" />
                <span className="current-project-corner current-project-corner-tr" aria-hidden="true" />
                <span className="current-project-corner current-project-corner-bl" aria-hidden="true" />
                <span className="current-project-corner current-project-corner-br" aria-hidden="true" />

                <div className="current-project-repo-stats" aria-label="GitHub stats">
                  <div className="current-project-repo-stat">
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
                      <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
                      <path fillRule="evenodd" d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0ZM1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0Z" />
                    </svg>
                    <span className="current-project-repo-num">
                      {repoStats ? repoStats.issues : '—'}
                    </span>
                    <span className="current-project-repo-label">issues</span>
                  </div>
                  <div className="current-project-repo-stat">
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.79L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.192L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
                    </svg>
                    <span className="current-project-repo-num">
                      {repoStats ? repoStats.stars : '—'}
                    </span>
                    <span className="current-project-repo-label">stars</span>
                  </div>
                  <div className="current-project-repo-stat">
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 4 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z" />
                    </svg>
                    <span className="current-project-repo-num">
                      {repoStats ? repoStats.forks : '—'}
                    </span>
                    <span className="current-project-repo-label">forks</span>
                  </div>
                </div>
              </div>

              <div className="current-project-body">
                <div className="current-project-meta">
                  <span>./project</span>
                  <span>open-source · main</span>
                </div>

                <h3 className="current-project-title">
                  Trade<span>Dex</span>
                </h3>

                <p className="current-project-desc">
                  Bot de Discord open-source montado sobre SysBot.NET para
                  intercambiar Pokémon entre Switches: trades batch, huevos,
                  mystery mons, eventos y equipos HOME-ready en SV, SWSH, BDSP,
                  PLA, LGPE y PLZA, con cola, panel web y legalización por PKHeX.
                </p>

                <div className="current-project-stack" aria-label="Tech stack">
                  <span>C#</span>
                  <span>.NET</span>
                  <span>SysBot.NET</span>
                  <span>Discord.NET</span>
                  <span>PKHeX</span>
                </div>

                <div className="current-project-footer">
                  <span className="current-project-cta">
                    <span aria-hidden="true">$</span> view options
                  </span>
                  <span className="current-project-arrow" aria-hidden="true">→</span>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <ModalPortal>
          <div className="modal-backdrop tradedex-modal-backdrop" onClick={closeModal}>
            <div
              className={`modal-card tradedex-modal tradedex-modal-tone-${verdictMeta?.tone || 'pending'}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="tradedex-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-header">
                <div>
                  <h3 className="modal-title" id="tradedex-modal-title">
                    TradeDex // safe download gate
                  </h3>
                  <p className="modal-text">
                    El binario se hashea en el server y se valida contra VirusTotal
                    antes de habilitar la descarga. Si el verdict no es limpio, la
                    gate queda cerrada.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="modal-close"
                  aria-label="Cerrar"
                >
                  x
                </button>
              </div>

              <div className="tradedex-body">
                {/* Horizontal stepper */}
                <div className="tradedex-pipeline">
                  <div className="tradedex-pipeline-header">
                    <span>scanner.pipeline</span>
                    <span>
                      {isErrored ? 'error' : isDone ? 'completed' : 'running'}
                    </span>
                  </div>
                  <ol className="tradedex-stepper">
                    {STAGES
                      .filter((s) => s.id !== 'submitting' || stageId === 'submitting' || scan?.vt?.submitted)
                      .filter((s) => s.id !== 'analyzing' || stageId === 'analyzing' || scan?.vt?.submitted)
                      .map((s) => {
                        const idx = STAGE_INDEX[s.id]
                        let state = 'pending'
                        if (isErrored && idx === stageIndex) state = 'error'
                        else if (idx < stageIndex || (isDone && idx <= stageIndex)) state = 'done'
                        else if (idx === stageIndex) state = 'active'
                        return (
                          <li key={s.id} className={`tradedex-step is-${state}`}>
                            <span className="tradedex-step-dot" aria-hidden="true">
                              <span className="tradedex-step-dot-inner" />
                            </span>
                            <span className="tradedex-step-label">{s.label}</span>
                            {s.id === 'downloading' && state === 'active' && (
                              <span className="tradedex-step-progress">
                                {Math.round(downloadProgress * 100)}%
                              </span>
                            )}
                          </li>
                        )
                      })}
                  </ol>
                </div>

                {/* Hero verdict with integrated stats */}
                <div className={`tradedex-verdict tradedex-verdict-hero tone-${verdictMeta?.tone || 'pending'}`}>
                  <div className="tradedex-verdict-left">
                    <span className="tradedex-verdict-led" aria-hidden="true" />
                    <div className="tradedex-verdict-text">
                      <span className="tradedex-verdict-kicker">vt.gate</span>
                      <strong className="tradedex-verdict-label">
                        {verdictMeta?.label || 'inicializando'}
                      </strong>
                      {verdictMeta?.detail && (
                        <span className="tradedex-verdict-detail">{verdictMeta.detail}</span>
                      )}
                    </div>
                  </div>

                  <div className="tradedex-verdict-chips">
                    <div className="tradedex-chip is-malicious">
                      <span>malicious</span>
                      <strong>{stats ? stats.malicious : '·'}</strong>
                    </div>
                    <div className="tradedex-chip is-suspicious">
                      <span>suspicious</span>
                      <strong>{stats ? stats.suspicious : '·'}</strong>
                    </div>
                    <div className="tradedex-chip is-harmless">
                      <span>harmless</span>
                      <strong>{stats ? stats.harmless + stats.undetected : '·'}</strong>
                    </div>
                    <div className="tradedex-chip is-total">
                      <span>engines</span>
                      <strong>{stats ? stats.total : '·'}</strong>
                    </div>
                    {scan?.vt?.permalink && (
                      <a
                        className="tradedex-verdict-link"
                        href={scan.vt.permalink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        full report ↗
                      </a>
                    )}
                  </div>
                </div>

                {/* Release info as horizontal row */}
                <div className="tradedex-release-strip">
                  <div className="tradedex-release-cell">
                    <span className="tradedex-release-label">release.tag</span>
                    <span className="tradedex-release-value">{scan?.tag || '...'}</span>
                  </div>
                  <div className="tradedex-release-cell tradedex-release-cell-wide">
                    <span className="tradedex-release-label">asset</span>
                    <span className="tradedex-release-value tradedex-release-asset">
                      {scan?.asset?.name || '...'}
                    </span>
                  </div>
                  <div className="tradedex-release-cell">
                    <span className="tradedex-release-label">size</span>
                    <span className="tradedex-release-value">
                      {scan?.asset?.size ? formatBytes(scan.asset.size) : '—'}
                    </span>
                  </div>
                  <div className="tradedex-release-cell tradedex-release-cell-wide">
                    <span className="tradedex-release-label">sha-256</span>
                    <span className="tradedex-release-value tradedex-release-hash">
                      {scan?.sha256
                        ? <code title={scan.sha256}>{shortHash(scan.sha256)}</code>
                        : <span className="tradedex-pulse">computando...</span>}
                    </span>
                  </div>
                </div>

                {scanError && (
                  <p className="tradedex-release-error">{scanError}</p>
                )}

                {/* Actions */}
                <div className="tradedex-modal-options">
                <a
                  href={TRADEDEX_REPO}
                  target="_blank"
                  rel="noreferrer"
                  className="tradedex-option"
                  onClick={closeModal}
                >
                  <span className="tradedex-option-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                      <path d="M12 .5C5.73.5.5 5.74.5 12.02c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55v-1.93c-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18.92-.26 1.91-.39 2.89-.39.98 0 1.97.13 2.89.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.41-5.25 5.69.42.36.79 1.07.79 2.16v3.2c0 .31.21.66.79.55C20.21 21.4 23.5 17.1 23.5 12.02 23.5 5.74 18.27.5 12 .5z" />
                    </svg>
                  </span>
                  <span className="tradedex-option-body">
                    <span className="tradedex-option-kicker">github.com</span>
                    <span className="tradedex-option-title">Ver repositorio</span>
                    <span className="tradedex-option-desc">
                      Abre Daiivr/TradeDex — código, issues, releases y docs.
                    </span>
                  </span>
                  <span className="tradedex-option-arrow" aria-hidden="true">↗</span>
                </a>

                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={!canDownload || downloading}
                  className="tradedex-option tradedex-option-primary"
                >
                  <span className="tradedex-option-icon" aria-hidden="true">
                    {canDownload ? (
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3v12" />
                        <path d="M6 11l6 6 6-6" />
                        <path d="M5 21h14" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="4" y="10" width="16" height="11" rx="2" />
                        <path d="M8 10V7a4 4 0 018 0v3" />
                      </svg>
                    )}
                  </span>
                  <span className="tradedex-option-body">
                    <span className="tradedex-option-kicker">
                      {isErrored
                        ? 'scanner offline'
                        : !isDone
                          ? 'gate locked · scanning'
                          : isMalicious
                            ? 'gate locked · flagged'
                            : notScanned
                              ? 'gate · unknown sample'
                              : `release · ${scan?.tag || 'latest'}`}
                    </span>
                    <span className="tradedex-option-title">
                      {downloading
                        ? 'iniciando descarga...'
                        : canDownload
                          ? 'Descargar último release'
                          : isMalicious
                            ? 'Bloqueado por VirusTotal'
                            : notScanned
                              ? 'Descarga sin verificar bloqueada'
                              : 'Descarga bloqueada'}
                    </span>
                    <span className="tradedex-option-desc">
                      {canDownload && scan?.asset
                        ? `${scan.asset.name} · ${formatBytes(scan.asset.size)}`
                        : isMalicious
                          ? `${stats?.malicious || 0}/${stats?.total || '?'} engines lo marcan como malicioso.`
                          : !isDone
                            ? 'Esperando verdict del pipeline antes de habilitar.'
                            : notScanned
                              ? 'Abre el reporte de VT y vuelve a intentar.'
                              : 'No disponible.'}
                    </span>
                  </span>
                  <span className="tradedex-option-arrow" aria-hidden="true">
                    {canDownload ? '↓' : '✕'}
                  </span>
                </button>
                </div>
              </div>

              <div className="modal-actions">
                {(isMalicious || notScanned || isErrored) && (
                  <a
                    href={TRADEDEX_RELEASE_PAGE}
                    target="_blank"
                    rel="noreferrer"
                    className="modal-btn-cancel tradedex-bypass-link"
                  >
                    abrir releases en github
                  </a>
                )}
                <button
                  type="button"
                  onClick={closeModal}
                  className="modal-btn-cancel"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </section>
  )
}
