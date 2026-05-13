import React, { useCallback, useEffect, useRef, useState } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import About from './components/About'
import Links from './components/Links'
import GameShelf from './components/GameShelf'
import DiscordCard from './components/DiscordCard'
import Comments from './components/Comments'
import Splash from './components/Splash'
import Fireflies from './components/Fireflies'
import CodeWaves from './components/CodeWaves'
import Snowfall from './components/Snowfall'
import CommandPalette from './components/CommandPalette'
import ModalPortal from './components/ModalPortal'

const KONAMI_VOLUME_STORAGE_KEY = 'daivr_konami_volume'
const DEFAULT_KONAMI_VOLUME_PERCENT = 8
const LOFI_VOLUME_STORAGE_KEY = 'daivr_lofi_volume'
const DEFAULT_LOFI_VOLUME_PERCENT = 20
const MATRIX_RAIN_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+-/<>=?[]{}'
const SECTION_ROUTES = ['#home', '#about', '#links', '#discord', '#games', '#comments']
const LOFI_TRACKS = [
  {
    id: 'DkbPMHFumss',
    title: 'Arcade LoFi',
    subtitle: 'background signal',
  },
  {
    id: 'jfKfPfyJRdk',
    title: 'Study Radio',
    subtitle: 'beats to code to',
  },
  {
    id: '4xDzrJKXOOY',
    title: 'Synthwave Radio',
    subtitle: 'night drive mode',
  },
]

const clampVolumePercent = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return DEFAULT_KONAMI_VOLUME_PERCENT
  if (num < 0) return 0
  if (num > 100) return 100
  return Math.round(num)
}

const clampLofiVolumePercent = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return DEFAULT_LOFI_VOLUME_PERCENT
  if (num < 0) return 0
  if (num > 100) return 100
  return Math.round(num)
}

const clampIndex = (value, max) => {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > max) return max
  return value
}

const isInteractiveTarget = (target) => {
  if (!target || typeof target.closest !== 'function') return false
  return Boolean(
    target.closest('input, textarea, select, button, a, [contenteditable="true"]'),
  )
}

const canScrollPanel = (panel, deltaY) => {
  if (!panel || Math.abs(deltaY) < 4) return false
  const maxScroll = panel.scrollHeight - panel.clientHeight
  if (maxScroll <= 2) return false
  if (deltaY > 0) return panel.scrollTop < maxScroll - 2
  return panel.scrollTop > 2
}

const formatLeaderboardTime = (value) => {
  const ms = Number(value)
  if (!Number.isFinite(ms) || ms < 0) return '--'
  const totalTenths = Math.floor(ms / 100)
  const totalSeconds = Math.floor(totalTenths / 10)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const tenths = totalTenths % 10

  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`
  }

  return `${seconds}.${tenths}s`
}

function KonamiGameOverlay({ open, activeGame, me, onClose }) {
  const [isMounted, setIsMounted] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [internalGame, setInternalGame] = useState(null)
  const [gameVolume, setGameVolume] = useState(DEFAULT_KONAMI_VOLUME_PERCENT)
  const [leaderboardOpen, setLeaderboardOpen] = useState(false)
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [leaderboardError, setLeaderboardError] = useState('')
  const [driveMadLeaderboard, setDriveMadLeaderboard] = useState([])
  const [myDriveMadScore, setMyDriveMadScore] = useState(null)
  const [driveMadRestore, setDriveMadRestore] = useState(null)
  const [driveMadResetting, setDriveMadResetting] = useState(false)
  const [driveMadResetConfirmOpen, setDriveMadResetConfirmOpen] = useState(false)
  const [driveMadSaveStatus, setDriveMadSaveStatus] = useState({
    kind: 'idle',
    message: '',
  })
  const iframeRef = useRef(null)
  const normalizedVolume = clampVolumePercent(gameVolume) / 100
  const targetVolumeRef = useRef(normalizedVolume)
  const volumeBootstrappedRef = useRef(false)
  const leaderboardOpenedOnceRef = useRef(false)

  useEffect(() => {
    if (open && activeGame) {
      setInternalGame(activeGame)
      setIsMounted(true)
      const rAF = requestAnimationFrame(() => {
        setIsVisible(true)
      })
      return () => cancelAnimationFrame(rAF)
    }

    if (!open && isMounted) {
      setIsVisible(false)
      const timeout = setTimeout(() => {
        setIsMounted(false)
        setInternalGame(null)
      }, 260)
      return () => clearTimeout(timeout)
    }
  }, [open, activeGame, isMounted])

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(KONAMI_VOLUME_STORAGE_KEY)
      if (stored !== null) {
        setGameVolume(clampVolumePercent(stored))
      }
    } catch (err) {
      console.error('Error loading Konami volume', err)
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(
        KONAMI_VOLUME_STORAGE_KEY,
        String(clampVolumePercent(gameVolume)),
      )
    } catch (err) {
      console.error('Error saving Konami volume', err)
    }
  }, [gameVolume])

  useEffect(() => {
    targetVolumeRef.current = normalizedVolume
  }, [normalizedVolume])

  const sendVolumeMessage = useCallback((volume, options = {}) => {
    const frame = iframeRef.current
    if (!frame || !frame.contentWindow) return
    const nextVolume = Math.max(0, Math.min(1, Number(volume) || 0))
    const fadeMs = Math.max(0, Math.round(Number(options.fadeMs) || 0))

    frame.contentWindow.postMessage(
      {
        type: 'daivr:set-volume',
        volume: nextVolume,
        fadeMs,
      },
      '*',
    )
  }, [])

  const bootstrapVolume = useCallback(() => {
    sendVolumeMessage(0, { fadeMs: 0 })
    sendVolumeMessage(targetVolumeRef.current, { fadeMs: 1200 })
    volumeBootstrappedRef.current = true
  }, [sendVolumeMessage])

  useEffect(() => {
    if (!open || !internalGame) {
      volumeBootstrappedRef.current = false
      return
    }

    sendVolumeMessage(0, { fadeMs: 0 })

    const bootFallback = setTimeout(() => {
      if (volumeBootstrappedRef.current) return
      bootstrapVolume()
    }, 220)

    const sync = setInterval(() => {
      sendVolumeMessage(targetVolumeRef.current, { fadeMs: 0 })
    }, 1000)

    return () => {
      clearTimeout(bootFallback)
      clearInterval(sync)
      volumeBootstrappedRef.current = false
    }
  }, [open, internalGame, sendVolumeMessage, bootstrapVolume])

  useEffect(() => {
    if (!open || !internalGame || !volumeBootstrappedRef.current) return
    sendVolumeMessage(normalizedVolume, { fadeMs: 260 })
  }, [open, internalGame, normalizedVolume, sendVolumeMessage])

  const loadDriveMadLeaderboard = useCallback(async (options = {}) => {
    const silent = Boolean(options.silent)
    if (!silent) setLeaderboardLoading(true)
    setLeaderboardError('')

    try {
      const [leaderboardRes, myScoreRes] = await Promise.all([
        fetch('/api/drive-mad/leaderboard?limit=10', {
          credentials: 'include',
        }),
        fetch('/api/drive-mad/me', {
          credentials: 'include',
        }),
      ])

      if (!leaderboardRes.ok) {
        throw new Error('leaderboard-error')
      }

      const leaderboardData = await leaderboardRes.json()
      const myScoreData = myScoreRes.ok ? await myScoreRes.json() : { score: null }

      setDriveMadLeaderboard(leaderboardData.leaderboard || [])
      setMyDriveMadScore(myScoreData.score || null)
    } catch (err) {
      console.error('Error loading Drive Mad leaderboard', err)
      setLeaderboardError('No se pudo cargar el top 10.')
    } finally {
      if (!silent) setLeaderboardLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open || internalGame !== 'drive' || !me?.id) {
      setDriveMadRestore(null)
      return undefined
    }

    let cancelled = false

    const loadRestorePoint = async () => {
      try {
        const res = await fetch('/api/drive-mad/me', {
          credentials: 'include',
        })
        const data = res.ok ? await res.json() : { score: null }
        const score = data.score
        const highestLevel = Number(score?.highestLevel) || 0
        const baseTimeMs = Number(score?.bestTimeMs)

        if (!cancelled) {
          setDriveMadRestore(
            highestLevel > 0
              ? {
                  // The leaderboard stores completed levels, so restore to the next playable level.
                  level: highestLevel + 1,
                  baseTimeMs: Number.isFinite(baseTimeMs) ? Math.max(0, Math.round(baseTimeMs)) : 0,
                }
              : null,
          )
        }
      } catch (err) {
        if (!cancelled) setDriveMadRestore(null)
      }
    }

    loadRestorePoint()

    return () => {
      cancelled = true
    }
  }, [open, internalGame, me?.id])

  const handleResetDriveMadScore = useCallback(async () => {
    if (!me?.id || driveMadResetting) return

    setDriveMadResetting(true)
      setDriveMadSaveStatus({
        kind: 'saving',
        message: 'reiniciando puntaje',
      })

    try {
      const res = await fetch('/api/drive-mad/me', {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || 'reset-failed')
      }

      setMyDriveMadScore(null)
      setDriveMadRestore(null)
      setDriveMadLeaderboard(data.leaderboard || [])
      setDriveMadSaveStatus({
        kind: 'saved',
        message: 'puntaje reiniciado',
      })
      setDriveMadResetConfirmOpen(false)

      iframeRef.current?.contentWindow?.postMessage(
        { type: 'daivr:drive-mad-reset-score' },
        window.location.origin,
      )
    } catch (err) {
      console.error('Error resetting Drive Mad score', err)
      setDriveMadSaveStatus({
        kind: 'error',
        message: 'no se pudo reiniciar',
      })
    } finally {
      setDriveMadResetting(false)
    }
  }, [driveMadResetting, me?.id])

  const openDriveMadResetConfirm = useCallback(() => {
    if (!me?.id || driveMadResetting) return
    setDriveMadResetConfirmOpen(true)
  }, [driveMadResetting, me?.id])

  const closeDriveMadResetConfirm = useCallback(() => {
    if (driveMadResetting) return
    setDriveMadResetConfirmOpen(false)
  }, [driveMadResetting])

  useEffect(() => {
    if (!open || internalGame !== 'drive') {
      setLeaderboardOpen(false)
      setDriveMadResetConfirmOpen(false)
      setDriveMadSaveStatus({
        kind: 'idle',
        message: '',
      })
      leaderboardOpenedOnceRef.current = false
    }
  }, [open, internalGame])

  useEffect(() => {
    if (!open || internalGame !== 'drive' || !leaderboardOpen) return
    const isFirstOpen = !leaderboardOpenedOnceRef.current
    leaderboardOpenedOnceRef.current = true

    loadDriveMadLeaderboard({ silent: !isFirstOpen })

    const sync = setInterval(() => {
      loadDriveMadLeaderboard({ silent: true })
    }, 3000)

    return () => clearInterval(sync)
  }, [open, internalGame, leaderboardOpen, loadDriveMadLeaderboard])

  useEffect(() => {
    if (leaderboardOpen) return
    setDriveMadSaveStatus({
      kind: 'idle',
      message: '',
    })
  }, [leaderboardOpen])

  useEffect(() => {
    if (!open || internalGame !== 'drive') return undefined

    const handleScoreUpdate = (event) => {
      if (event.origin !== window.location.origin) return
      const data = event.data || {}

      if (!me?.id && typeof data.type === 'string' && data.type.startsWith('daivr:drive-mad-score-')) {
        if (!leaderboardOpen) return
        setDriveMadSaveStatus({
          kind: 'error',
          message: 'inicia sesión con Discord para guardar',
        })
        return
      }

      if (data.type === 'daivr:drive-mad-score-saving') {
        if (!leaderboardOpen) return
        setDriveMadSaveStatus({
          kind: 'saving',
          message: `guardando niv. ${data.level || '?'}`,
        })
        return
      }

      if (data.type === 'daivr:drive-mad-score-error') {
        if (!leaderboardOpen) return
        const message =
          data.status === 401
            ? 'inicia sesión con Discord para guardar'
            : data.error === 'network-error'
              ? 'error de red al guardar'
              : 'no se pudo guardar el progreso'

        setDriveMadSaveStatus({
          kind: 'error',
          message,
        })
        return
      }

      if (data.type !== 'daivr:drive-mad-score-updated') return

      if (data.score) {
        setMyDriveMadScore(data.score)
        if (leaderboardOpen) {
          setDriveMadSaveStatus({
            kind: 'saved',
            message: `guardado niv. ${data.score.highestLevel}`,
          })
        }
      }

      if (leaderboardOpen) {
        loadDriveMadLeaderboard({ silent: true })
      }
    }

    window.addEventListener('message', handleScoreUpdate)
    return () => window.removeEventListener('message', handleScoreUpdate)
  }, [open, internalGame, leaderboardOpen, loadDriveMadLeaderboard, me?.id])

  const handleCloseClick = () => {
    if (onClose) onClose()
  }

  const handleVolumeChange = (event) => {
    setGameVolume(clampVolumePercent(event.target.value))
  }

  const handleFrameLoad = useCallback(() => {
    bootstrapVolume()
  }, [bootstrapVolume])

  if (!isMounted || !internalGame) return null

  const isDriveMad = internalGame === 'drive'
  const discordId = me?.id ? String(me.id) : null

  const basePath =
    internalGame === 'cube' ? '/the-cube/index.html' : '/drive-mad/index.html'

  const queryParams = new URLSearchParams()
  if (discordId) queryParams.set('discordId', discordId)
  if (isDriveMad && driveMadRestore?.level > 1) {
    queryParams.set('restoreLevel', String(driveMadRestore.level))
    queryParams.set('restoreBaseTimeMs', String(driveMadRestore.baseTimeMs || 0))
  }

  const src = queryParams.toString()
    ? `${basePath}?${queryParams.toString()}`
    : basePath

  const title =
    internalGame === 'cube'
      ? 'Konami mode - The Cube'
      : 'Konami mode - Drive Mad'

  const subtitle =
    internalGame === 'cube'
      ? 'Konami unlocked. You earned a quick puzzle break.'
      : 'Konami unlocked. You earned a quick driving break.'

  return (
    <>
      <div
        className={`konami-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div
        className={`konami-window relative mx-2 h-[88dvh] w-full max-w-5xl overflow-hidden rounded-[26px] border border-slate-700/80 bg-slate-900/90 shadow-[0_0_60px_rgba(15,23,42,0.9)] transform-gpu transition-all duration-300 sm:mx-4 sm:h-[82vh] sm:rounded-[32px] ${
          isVisible
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 translate-y-4 scale-95'
        }`}
      >
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.22),transparent_60%),radial-gradient(circle_at_bottom_right,rgba(244,114,182,0.22),transparent_60%)]" />
        <div className="relative z-10 flex h-full flex-col">
          <header className="flex items-start justify-between gap-3 px-3 pb-2 pt-3 sm:px-5 sm:pt-4">
            <div className="flex min-w-0 flex-1">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/80 px-3 py-1 text-xs font-medium text-slate-200 shadow-[0_0_18px_rgba(15,23,42,0.9)]">
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
                <span>{title}</span>
              </div>
            </div>

            {isDriveMad && (
              <button
                type="button"
                onClick={() => setLeaderboardOpen((prev) => !prev)}
                className={`konami-leaderboard-toggle inline-flex h-9 items-center justify-center rounded-full border border-slate-700/70 bg-slate-900/80 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300 transition-colors hover:border-slate-500 hover:bg-slate-800 hover:text-slate-50 ${
                  leaderboardOpen ? 'is-active' : ''
                }`}
                aria-label="Mostrar top 10 de Drive Mad"
                aria-pressed={leaderboardOpen}
              >
                top 10
              </button>
            )}

            <button
              type="button"
              onClick={handleCloseClick}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700/70 bg-slate-900/80 text-sm text-slate-300 transition-colors hover:border-slate-500 hover:bg-slate-800 hover:text-slate-50"
              aria-label="Cerrar juego secreto"
            >
              x
            </button>
          </header>

          <div className="flex flex-1 flex-col px-2 pb-3 sm:px-4 sm:pb-4">
            <div className="relative flex-1 overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-950/80">
              <iframe
                ref={iframeRef}
                title={title}
                src={src}
                className="h-full w-full"
                loading="lazy"
                allow="autoplay; fullscreen"
                onLoad={handleFrameLoad}
              />
              {isDriveMad && leaderboardOpen && (
                <div
                  className="drive-leaderboard-panel"
                  role="dialog"
                  aria-label="Drive Mad leaderboard"
                >
                  <div className="drive-leaderboard-header">
                    <div>
                      <span>ranking.sys</span>
                      <strong>Top 10 de Drive Mad</strong>
                    </div>
                    <button
                      type="button"
                      onClick={loadDriveMadLeaderboard}
                      disabled={leaderboardLoading}
                    >
                      act.
                    </button>
                  </div>

                  {myDriveMadScore && (
                    <div className="drive-leaderboard-self">
                      <div className="drive-leaderboard-self-copy">
                        <span>tu puesto</span>
                        <strong>
                          #{myDriveMadScore.rank} / niv. {myDriveMadScore.highestLevel} /{' '}
                          total {formatLeaderboardTime(myDriveMadScore.bestTimeMs)}
                        </strong>
                      </div>
                        <button
                        type="button"
                        onClick={openDriveMadResetConfirm}
                        disabled={driveMadResetting}
                      >
                        reiniciar
                      </button>
                    </div>
                  )}

                  {!me && !driveMadSaveStatus.message && (
                    <p className="drive-leaderboard-status is-error">
                      inicia sesión con Discord para guardar tu partida
                    </p>
                  )}

                  {driveMadSaveStatus.message && (
                    <p className={`drive-leaderboard-save is-${driveMadSaveStatus.kind}`}>
                      {driveMadSaveStatus.message}
                    </p>
                  )}

                  {leaderboardLoading && (
                    <p className="drive-leaderboard-status">cargando puntajes...</p>
                  )}

                  {!leaderboardLoading && leaderboardError && (
                    <p className="drive-leaderboard-status is-error">
                      {leaderboardError}
                    </p>
                  )}

                  {!leaderboardLoading && !leaderboardError && driveMadLeaderboard.length === 0 && (
                    <p className="drive-leaderboard-status">todavía no hay puntajes</p>
                  )}

                  {!leaderboardLoading && !leaderboardError && driveMadLeaderboard.length > 0 && (
                    <ol className="drive-leaderboard-list">
                      {driveMadLeaderboard.map((score) => (
                        <li key={score.discordId} className="drive-leaderboard-row">
                          <span className="drive-leaderboard-rank">
                            {String(score.rank).padStart(2, '0')}
                          </span>
                          <img
                            src={score.avatarUrl}
                            alt=""
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.src =
                                'https://cdn.discordapp.com/embed/avatars/0.png'
                            }}
                          />
                          <span className="drive-leaderboard-player">
                            {score.username}
                          </span>
                          <span className="drive-leaderboard-level">
                            niv. {score.highestLevel}
                          </span>
                          <span className="drive-leaderboard-time">
                            total {formatLeaderboardTime(score.bestTimeMs)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </div>
            <p className="mt-2 text-center text-[0.70rem] text-slate-400">
              {subtitle}
            </p>
            <div className="mt-2 flex justify-center">
              <label className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-950/70 px-3 py-1.5 text-[10px] text-slate-300">
                <span className="uppercase tracking-[0.16em] text-slate-400">
                  game volume
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={gameVolume}
                  onChange={handleVolumeChange}
                  className="h-1.5 w-28 accent-sky-400 sm:w-36"
                  aria-label="Ajustar volumen del minijuego"
                />
                <span className="w-9 text-right text-[11px] font-semibold text-slate-100">
                  {gameVolume}%
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>
      </div>

      {driveMadResetConfirmOpen && (
        <ModalPortal>
          <div className="modal-backdrop drive-reset-backdrop" onClick={closeDriveMadResetConfirm}>
            <div
              className="modal-card modal-md drive-reset-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="drive-reset-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-header">
                <div>
                  <h3 className="modal-title" id="drive-reset-title">
                    ¿Reiniciar partida de Drive Mad?
                  </h3>
                  <p className="modal-text">
                    Esto borrará tu puntaje del ranking y tu progreso guardado.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeDriveMadResetConfirm}
                  className="modal-close"
                  aria-label="Close reset confirmation"
                  disabled={driveMadResetting}
                >
                  x
                </button>
              </div>

              <div className="modal-panel drive-reset-warning">
                <span className="drive-reset-icon" aria-hidden="true">
                  !
                </span>
                <div>
                  <strong>Tu progreso del juego volverá al nivel 1.</strong>
                  <p>
                    Se borrará tu partida guardada de Drive Mad en este navegador,
                    el juego se recargará y tu entrada del top 10 será eliminada
                    para que puedas empezar un intento nuevo.
                  </p>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={closeDriveMadResetConfirm}
                  className="modal-btn-cancel"
                  disabled={driveMadResetting}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleResetDriveMadScore}
                  className="modal-btn-danger"
                  disabled={driveMadResetting}
                >
                  {driveMadResetting ? 'Reiniciando...' : 'Reiniciar al nivel 1'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  )
}
function ControlIcon({ type }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  }

  const paths = {
    play: <polygon points="7 5 19 12 7 19 7 5" fill="currentColor" stroke="none" />,
    pause: (
      <>
        <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
        <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
      </>
    ),
    previous: (
      <>
        <path d="M19 5L9 12l10 7V5z" fill="currentColor" stroke="none" />
        <path d="M5 5v14" />
      </>
    ),
    next: (
      <>
        <path d="M5 5l10 7-10 7V5z" fill="currentColor" stroke="none" />
        <path d="M19 5v14" />
      </>
    ),
    volume: (
      <>
        <path d="M4 10v4h4l5 4V6L8 10H4z" />
        <path d="M16 9.5a4 4 0 010 5" />
        <path d="M18.5 7a7 7 0 010 10" />
      </>
    ),
    mute: (
      <>
        <path d="M4 10v4h4l5 4V6L8 10H4z" />
        <path d="M18 9l-5 6" />
        <path d="M13 9l5 6" />
      </>
    ),
    close: (
      <>
        <path d="M6 6l12 12" />
        <path d="M18 6L6 18" />
      </>
    ),
  }

  return <svg {...common}>{paths[type]}</svg>
}

function MusicControlButton({
  visible,
  open,
  muted,
  gameMuted,
  paused,
  volume,
  track,
  trackIndex,
  trackCount,
  onOpenChange,
  onToggleMute,
  onTogglePlay,
  onVolumeChange,
  onNext,
  onPrevious,
}) {
  const shellRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event) => {
      if (shellRef.current && !shellRef.current.contains(event.target)) {
        onOpenChange(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onOpenChange(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onOpenChange])

  useEffect(() => {
    if (!visible) onOpenChange(false)
  }, [visible, onOpenChange])

  if (!visible) return null

  const effectiveMuted = muted || gameMuted || volume === 0
  const statusLabel = gameMuted
    ? 'GAME'
    : effectiveMuted
      ? 'MUTE'
      : paused
        ? 'PAUS'
        : 'ON'

  return (
    <div ref={shellRef} className="music-control-shell fixed bottom-5 right-5 z-50">
      {open && (
        <div className="music-control-panel" role="dialog" aria-label="Lo-fi music controls">
          <div className="music-control-panel-top">
            <div>
              <p className="music-control-kicker">audio://lofi</p>
              <p className="music-control-title">{track.title}</p>
              <p className="music-control-subtitle">{track.subtitle}</p>
            </div>
            <button
              type="button"
              className="music-control-close"
              onClick={() => onOpenChange(false)}
              aria-label="Close music controls"
            >
              <ControlIcon type="close" />
            </button>
          </div>

          <div className="music-control-screen">
            <span className="music-control-scanline" aria-hidden="true" />
            <div className="music-control-screen-copy">
              <span className="music-control-track-index">
                {String(trackIndex + 1).padStart(2, '0')} / {String(trackCount).padStart(2, '0')}
              </span>
              <span className="music-control-track-name">{paused ? 'paused' : 'streaming'}</span>
            </div>
            <span
              className={`music-control-bars ${paused ? 'is-paused' : ''}`}
              aria-hidden="true"
            >
              {[0.38, 0.72, 0.52, 0.9, 0.64, 1, 0.46, 0.78, 0.56].map(
                (level, index) => (
                  <span
                    key={index}
                    style={{
                      '--level': level,
                      '--delay': `${index * -0.11}s`,
                    }}
                  />
                ),
              )}
            </span>
          </div>

          <div className="music-control-actions">
            <button
              type="button"
              className="music-control-icon-button"
              onClick={onPrevious}
              aria-label="Previous lo-fi track"
            >
              <ControlIcon type="previous" />
            </button>
            <button
              type="button"
              className="music-control-icon-button music-control-play"
              onClick={onTogglePlay}
              aria-label={paused ? 'Play lo-fi music' : 'Pause lo-fi music'}
            >
              <ControlIcon type={paused ? 'play' : 'pause'} />
            </button>
            <button
              type="button"
              className="music-control-icon-button"
              onClick={onNext}
              aria-label="Next lo-fi track"
            >
              <ControlIcon type="next" />
            </button>
          </div>

          <div className="music-control-volume">
            <button
              type="button"
              className={`music-control-icon-button music-control-mute ${effectiveMuted ? 'is-muted' : ''}`}
              onClick={onToggleMute}
              aria-label={effectiveMuted ? 'Unmute lo-fi music' : 'Mute lo-fi music'}
            >
              <ControlIcon type={effectiveMuted ? 'mute' : 'volume'} />
            </button>
            <label className="music-control-slider-label">
              <span>volume</span>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(event) => onVolumeChange(event.target.value)}
                aria-label="Lo-fi volume"
              />
            </label>
            <span className="music-control-volume-value">
              {String(volume).padStart(2, '0')}%
            </span>
          </div>

          <div className="music-control-deck-footer" aria-hidden="true">
            <span>track.cache</span>
            <span>{gameMuted ? 'game-muted' : effectiveMuted ? 'muted' : paused ? 'paused' : 'signal.ok'}</span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={`arc-toggle arc-toggle-lofi ${effectiveMuted || paused ? 'arc-toggle-off' : 'arc-toggle-on'} rounded-full p-[2px] bg-gradient-to-r from-sky-500/60 via-cyan-400/60 to-fuchsia-500/60 shadow-[0_12px_40px_rgba(8,47,73,0.85)] transition-transform duration-200 hover:translate-y-0.5 active:scale-[0.97]`}
        aria-label={open ? 'Close lo-fi music controls' : 'Open lo-fi music controls'}
        aria-expanded={open}
      >
        <div className="arc-toggle-inner flex items-center gap-2 rounded-full bg-slate-950/90 px-3 py-2 border border-slate-700/80">
          <span className="arc-toggle-led arc-toggle-vinyl" aria-hidden="true">
            <span className="arc-toggle-vinyl-disc">
              <span className="arc-toggle-vinyl-label" />
              <span className="arc-toggle-vinyl-tick" />
            </span>
          </span>
          <span className="arc-toggle-label uppercase tracking-[0.22em] text-[9px] text-slate-400">
            LOFI
          </span>
          <span className="arc-toggle-value text-[11px] font-semibold text-slate-100">
            <span className="arc-toggle-glyph" aria-hidden="true">
              {gameMuted ? '▾' : effectiveMuted ? '✕' : paused ? '❙❙' : '▶'}
            </span>
            {statusLabel}
          </span>
        </div>
      </button>
    </div>
  )
}


function ChristmasToggleButton({ visible, enabled, saving, onToggle }) {
  if (!visible) return null

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={saving}
      className={`arc-toggle arc-toggle-xmas ${enabled ? 'arc-toggle-on' : 'arc-toggle-off'} fixed bottom-[4.75rem] right-5 z-40 rounded-full p-[2px] bg-gradient-to-r from-rose-500/70 via-red-500/60 to-emerald-500/70 shadow-[0_14px_44px_rgba(15,23,42,0.9)] transition-transform duration-200 hover:translate-y-0.5 active:scale-[0.97] disabled:opacity-70 disabled:cursor-not-allowed`}
      aria-label={enabled ? 'Disable Christmas theme' : 'Enable Christmas theme'}
      title={enabled ? 'Christmas theme: ON' : 'Christmas theme: OFF'}
    >
      <div className="arc-toggle-inner flex items-center gap-2 rounded-full bg-slate-950/90 px-3 py-2 border border-slate-700/80">
        <span className="arc-toggle-led relative flex h-5 w-5 items-center justify-center">
          {enabled && (
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400/25 animate-ping" />
          )}
          <span
            className={`relative inline-flex h-3 w-3 rounded-full ${
              enabled
                ? 'bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.95)]'
                : 'bg-slate-400 shadow-[0_0_10px_rgba(148,163,184,0.9)]'
            }`}
          />
        </span>
        <span className="arc-toggle-label uppercase tracking-[0.22em] text-[9px] text-slate-400">
          XMAS
        </span>
        <span className="arc-toggle-value text-[11px] font-semibold text-slate-100">
          {saving ? '...' : enabled ? 'ON' : 'OFF'}
        </span>
      </div>
    </button>
  )
}

function ArcadeVisualEffects({ visible }) {
  const auraRef = useRef(null)

  useEffect(() => {
    const aura = auraRef.current
    if (!aura || !visible) return undefined

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    if (prefersReducedMotion) return undefined

    let frame = 0
    let nextX = window.innerWidth / 2
    let nextY = window.innerHeight / 2

    const moveAura = () => {
      frame = 0
      aura.style.setProperty('--cursor-x', `${nextX}px`)
      aura.style.setProperty('--cursor-y', `${nextY}px`)
      aura.classList.add('is-visible')
    }

    const handlePointerMove = (event) => {
      if (event.pointerType && event.pointerType !== 'mouse') return
      nextX = event.clientX
      nextY = event.clientY
      if (!frame) frame = requestAnimationFrame(moveAura)
    }

    const hideAura = () => {
      aura.classList.remove('is-visible')
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerleave', hideAura)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerleave', hideAura)
    }
  }, [visible])

  useEffect(() => {
    if (!visible) return undefined

    let scrollTimeout = 0
    const markScrolling = () => {
      document.documentElement.classList.add('is-scrolling')
      window.clearTimeout(scrollTimeout)
      scrollTimeout = window.setTimeout(() => {
        document.documentElement.classList.remove('is-scrolling')
      }, 180)
    }

    window.addEventListener('scroll', markScrolling, { passive: true })

    return () => {
      window.clearTimeout(scrollTimeout)
      window.removeEventListener('scroll', markScrolling)
      document.documentElement.classList.remove('is-scrolling')
    }
  }, [visible])

  useEffect(() => {
    if (!visible) return undefined

    const revealSelector = [
      '.hero-card',
      '.bento-card',
      '.section-card',
      '.link-card',
      '.gallery-tile',
    ].join(',')
    const tracked = new WeakSet()

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      {
        rootMargin: '0px 0px -8% 0px',
        threshold: 0.14,
      },
    )

    const registerReveals = () => {
      const nodes = Array.from(document.querySelectorAll(revealSelector))
      nodes.forEach((node, index) => {
        if (tracked.has(node)) return
        tracked.add(node)
        node.classList.add('reveal-ready')
        node.style.setProperty('--reveal-delay', `${(index % 5) * 55}ms`)
        observer.observe(node)
      })
    }

    let registerFrame = 0
    const scheduleRegisterReveals = () => {
      if (registerFrame) return
      registerFrame = requestAnimationFrame(() => {
        registerFrame = 0
        registerReveals()
      })
    }

    registerReveals()

    const mutationObserver = new MutationObserver(scheduleRegisterReveals)
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    })

    return () => {
      if (registerFrame) cancelAnimationFrame(registerFrame)
      mutationObserver.disconnect()
      observer.disconnect()
    }
  }, [visible])

  return (
    <>
      <div
        ref={auraRef}
        className={`cursor-aura ${visible ? '' : 'is-hidden'}`}
        aria-hidden="true"
      />
      <div
        className={`crt-overlay ${visible ? 'is-visible' : 'is-hidden'}`}
        aria-hidden="true"
      />
      <div
        className={`signal-sweep ${visible ? 'is-visible' : 'is-hidden'}`}
        aria-hidden="true"
      />
    </>
  )
}

function SecretTerminalRain({ ending = false }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d', { alpha: true })
    if (!canvas || !ctx) return undefined

    let frame = 0
    let lastTime = performance.now()
    let width = 0
    let height = 0
    let columns = []

    const resetColumn = (column, startAbove = true) => {
      column.y = startAbove
        ? -Math.random() * height * 0.7
        : Math.random() * height
      column.speed = 2.2 + Math.random() * 3.8
      column.size = width < 640 ? 13 + Math.random() * 4 : 12 + Math.random() * 6
      column.trail = 12 + Math.floor(Math.random() * (width < 640 ? 8 : 15))
      column.alpha = 0.35 + Math.random() * 0.48
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const gap = width < 640 ? 18 : 16
      const count = Math.ceil(width / gap) + 2
      columns = Array.from({ length: count }, (_, index) => {
        const column = {
          x: index * gap + (Math.random() - 0.5) * gap,
          y: 0,
          speed: 0,
          size: 0,
          trail: 0,
          alpha: 0,
        }
        resetColumn(column, false)
        return column
      })
    }

    const drawGlyph = (glyph, x, y, index, column) => {
      const trailFade = Math.max(0.08, 1 - index / column.trail)
      const isHead = index < 2
      ctx.fillStyle = isHead
        ? `rgba(236, 255, 238, ${0.86 * column.alpha})`
        : `rgba(57, 255, 20, ${trailFade * column.alpha})`
      ctx.shadowColor = isHead
        ? 'rgba(236, 255, 238, 0.75)'
        : 'rgba(57, 255, 20, 0.58)'
      ctx.shadowBlur = isHead ? 13 : 7
      ctx.fillText(glyph, x, y)
    }

    const tick = (time) => {
      const delta = Math.min(2.2, (time - lastTime) / 16.67)
      lastTime = time

      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = 'rgba(1, 6, 14, 0.17)'
      ctx.fillRect(0, 0, width, height)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'

      columns.forEach((column) => {
        column.y += column.speed * delta
        ctx.font = `900 ${column.size}px "JetBrains Mono", Consolas, monospace`

        for (let index = 0; index < column.trail; index += 1) {
          const y = column.y - index * column.size * 1.18
          if (y < -column.size || y > height + column.size) continue

          const charIndex =
            (Math.floor(Math.random() * MATRIX_RAIN_CHARS.length) + index) %
            MATRIX_RAIN_CHARS.length
          drawGlyph(MATRIX_RAIN_CHARS[charIndex], column.x, y, index, column)
        }

        if (column.y - column.trail * column.size > height + 60) {
          resetColumn(column)
        }
      })

      ctx.shadowBlur = 0
      frame = requestAnimationFrame(tick)
    }

    resize()
    frame = requestAnimationFrame(tick)
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div
      className={`secret-terminal-rain ${ending ? 'is-ending' : ''}`}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="secret-terminal-rain-canvas" />
    </div>
  )
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true)
  const [playAudio, setPlayAudio] = useState(false)
  const [audioMuted, setAudioMuted] = useState(false)
  const [audioPaused, setAudioPaused] = useState(false)
  const [audioVolume, setAudioVolume] = useState(DEFAULT_LOFI_VOLUME_PERCENT)
  const [audioTrackIndex, setAudioTrackIndex] = useState(0)
  const [audioControlsOpen, setAudioControlsOpen] = useState(false)
  const [visitCount, setVisitCount] = useState(null)
  const [visitError, setVisitError] = useState(false)
  const [me, setMe] = useState(null)
  const [christmasEnabled, setChristmasEnabled] = useState(false)
  const [christmasSaving, setChristmasSaving] = useState(false)
  const [showGameOverlay, setShowGameOverlay] = useState(false)
  const [activeGame, setActiveGame] = useState(null)
  const [secretPulse, setSecretPulse] = useState(false)
  const [secretEffect, setSecretEffect] = useState('vibe')
  const [secretToast, setSecretToast] = useState({
    title: 'sudo vibe accepted',
    detail: 'neon link established',
  })
  const [secretEnding, setSecretEnding] = useState(false)
  const [isSectionDeckMode] = useState(false)
  const [activeSectionIndex, setActiveSectionIndex] = useState(() => {
    if (typeof window === 'undefined') return 0
    const hashIndex = SECTION_ROUTES.indexOf(window.location.hash)
    return hashIndex >= 0 ? hashIndex : 0
  })
  const [previousSectionIndex, setPreviousSectionIndex] = useState(null)
  const [sectionDirection, setSectionDirection] = useState('forward')
  const konamiIndexRef = useRef(0)
  const secretPulseTimeoutRef = useRef(0)
  const secretEndTimeoutRef = useRef(0)
  const sectionTransitionTimeoutRef = useRef(0)
  const sectionWheelLockRef = useRef(false)
  const activeSectionIndexRef = useRef(activeSectionIndex)
  const sectionPanelRefs = useRef([])
  const touchStartYRef = useRef(null)
  const touchStartXRef = useRef(null)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LOFI_VOLUME_STORAGE_KEY)
      if (stored !== null) {
        setAudioVolume(clampLofiVolumePercent(stored))
      }
    } catch (err) {
      console.error('Error loading lo-fi volume', err)
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(
        LOFI_VOLUME_STORAGE_KEY,
        String(clampLofiVolumePercent(audioVolume)),
      )
    } catch (err) {
      console.error('Error saving lo-fi volume', err)
    }
  }, [audioVolume])

  useEffect(() => {
    const hitVisit = async () => {
      try {
        const res = await fetch('/api/visits/hit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        if (!res.ok) throw new Error('visit-failed')
        const data = await res.json()
        if (typeof data.count === 'number') {
          setVisitCount(data.count)
        }
      } catch (err) {
        console.error('Error registrando visita', err)
        setVisitError(true)
      }
    }

    hitVisit()
  }, [])

  useEffect(() => {
    const loadMe = async () => {
      try {
        // Important for local + Render:
        // - local: Vite proxy -> backend (cookies are same-site)
        // - prod: same-origin or behind proxy; credentials ensures cookie is sent
        const res = await fetch('/api/me', { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()

        // /api/me can return:
        //   { user: { ... } }
        //   { user: { ... }, ...userFields } (compat)
        //   { ...userFields } (older)
        const user = data?.user ?? (data?.id ? data : null)
        setMe(user)
      } catch (err) {
        console.error('Error cargando /api/me', err)
      }
    }

    loadMe()
  }, [])
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/site-settings')
        if (!res.ok) return
        const data = await res.json()
        setChristmasEnabled(!!data.christmasEnabled)
      } catch (err) {
        console.error('Error cargando /api/site-settings', err)
      }
    }

    loadSettings()
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('theme-xmas', !!christmasEnabled)
    return () => root.classList.remove('theme-xmas')
  }, [christmasEnabled])

  useEffect(() => {
    return () => {
      window.clearTimeout(secretPulseTimeoutRef.current)
      window.clearTimeout(secretEndTimeoutRef.current)
      window.clearTimeout(sectionTransitionTimeoutRef.current)
    }
  }, [])


  useEffect(() => {
    const KONAMI_SEQUENCE = [
      'ArrowUp',
      'ArrowUp',
      'ArrowDown',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'ArrowLeft',
      'ArrowRight',
      'b',
      'a',
    ]

    const normalize = (k) => (typeof k === 'string' ? k.toLowerCase() : k)

    const handleKeyDown = (event) => {
      if (showSplash) return

      const key = event.key
      const currentIndex = konamiIndexRef.current
      const expectedKey = KONAMI_SEQUENCE[currentIndex]

      const isMatch = normalize(key) === normalize(expectedKey)

      if (isMatch) {
        const nextIndex = currentIndex + 1
        if (nextIndex === KONAMI_SEQUENCE.length) {
          konamiIndexRef.current = 0
          const games = ['cube', 'drive']
          const randomGame = games[Math.floor(Math.random() * games.length)]
          setActiveGame(randomGame)
          setShowGameOverlay(true)
        } else {
          konamiIndexRef.current = nextIndex
        }
      } else {
        konamiIndexRef.current =
          normalize(key) === normalize(KONAMI_SEQUENCE[0]) ? 1 : 0
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showSplash])

  const handleEnter = () => {
    setShowSplash(false)
    setTimeout(() => {
      setPlayAudio(true)
    }, 450)
  }

  const toggleChristmasTheme = async () => {
    if (!me || !me.isAdmin || christmasSaving) return
    const next = !christmasEnabled
    setChristmasEnabled(next) // optimistic
    setChristmasSaving(true)
    try {
      const res = await fetch('/api/site-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ christmasEnabled: next }),
      })
      if (!res.ok) throw new Error('save-failed')
      const data = await res.json()
      setChristmasEnabled(!!data.christmasEnabled)
    } catch (err) {
      console.error('Error guardando christmasEnabled', err)
      setChristmasEnabled((prev) => !prev) // revert
    } finally {
      setChristmasSaving(false)
    }
  }

  const currentAudioTrack =
    LOFI_TRACKS[audioTrackIndex] || LOFI_TRACKS[0]
  const effectiveAudioMuted = audioMuted || showGameOverlay || audioVolume === 0
  const setNextAudioTrack = () => {
    setAudioTrackIndex((prev) => (prev + 1) % LOFI_TRACKS.length)
    setAudioPaused(false)
  }
  const setPreviousAudioTrack = () => {
    setAudioTrackIndex((prev) =>
      (prev - 1 + LOFI_TRACKS.length) % LOFI_TRACKS.length,
    )
    setAudioPaused(false)
  }
  const handleLofiVolumeChange = (value) => {
    const next = clampLofiVolumePercent(value)
    setAudioVolume(next)
    if (next > 0) setAudioMuted(false)
  }
  const toggleLofiMute = () => {
    if (audioVolume === 0) {
      setAudioVolume(DEFAULT_LOFI_VOLUME_PERCENT)
      setAudioMuted(false)
      return
    }
    setAudioMuted((prev) => !prev)
  }

  const toggleLofiPlay = () => {
    setPlayAudio(true)
    setAudioPaused((prev) => !prev)
  }

  const goToSectionIndex = useCallback((targetIndex) => {
    const nextIndex = clampIndex(targetIndex, SECTION_ROUTES.length - 1)
    const currentIndex = activeSectionIndexRef.current
    if (nextIndex === currentIndex) return

    activeSectionIndexRef.current = nextIndex
    setPreviousSectionIndex(currentIndex)
    setSectionDirection(nextIndex > currentIndex ? 'forward' : 'backward')
    setActiveSectionIndex(nextIndex)

    requestAnimationFrame(() => {
      const nextPanel = sectionPanelRefs.current[nextIndex]
      if (nextPanel) nextPanel.scrollTop = 0
    })

    window.clearTimeout(sectionTransitionTimeoutRef.current)
    sectionTransitionTimeoutRef.current = window.setTimeout(() => {
      setPreviousSectionIndex(null)
    }, 780)
  }, [])

  const scrollToSection = useCallback(
    (href) => {
      const nextIndex = SECTION_ROUTES.indexOf(href)
      if (nextIndex < 0) return
      if (!isSectionDeckMode) {
        const section = document.querySelector(href)
        if (!section) return
        section.scrollIntoView({ behavior: 'smooth', block: 'start' })
        window.history.replaceState(null, '', href)
        return
      }
      goToSectionIndex(nextIndex)
    },
    [goToSectionIndex, isSectionDeckMode],
  )

  useEffect(() => {
    if (!isSectionDeckMode) return

    const href = SECTION_ROUTES[activeSectionIndex] || SECTION_ROUTES[0]
    window.history.replaceState(null, '', href)
    window.dispatchEvent(
      new CustomEvent('daivr:active-section', {
        detail: { href, index: activeSectionIndex },
      }),
    )
  }, [activeSectionIndex, isSectionDeckMode])

  useEffect(() => {
    if (!isSectionDeckMode) return undefined

    const handleSectionNavigate = (event) => {
      const href = event.detail?.href
      const nextIndex = SECTION_ROUTES.indexOf(href)
      if (nextIndex >= 0) goToSectionIndex(nextIndex)
    }

    window.addEventListener('daivr:navigate-section', handleSectionNavigate)
    return () =>
      window.removeEventListener('daivr:navigate-section', handleSectionNavigate)
  }, [goToSectionIndex, isSectionDeckMode])

  useEffect(() => {
    if (!isSectionDeckMode || showSplash || showGameOverlay) return undefined

    const handleKeyDown = (event) => {
      if (event.defaultPrevented || isInteractiveTarget(event.target)) return

      const currentIndex = activeSectionIndexRef.current
      if (['ArrowDown', 'PageDown', ' '].includes(event.key)) {
        event.preventDefault()
        goToSectionIndex(currentIndex + 1)
      }

      if (['ArrowUp', 'PageUp'].includes(event.key)) {
        event.preventDefault()
        goToSectionIndex(currentIndex - 1)
      }

      if (event.key === 'Home') {
        event.preventDefault()
        goToSectionIndex(0)
      }

      if (event.key === 'End') {
        event.preventDefault()
        goToSectionIndex(SECTION_ROUTES.length - 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goToSectionIndex, isSectionDeckMode, showGameOverlay, showSplash])

  const handleDeckWheel = useCallback(
    (event) => {
      if (!isSectionDeckMode || showSplash || showGameOverlay) return
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return

      const currentIndex = activeSectionIndexRef.current
      const activePanel = sectionPanelRefs.current[currentIndex]
      if (canScrollPanel(activePanel, event.deltaY)) return

      event.preventDefault()
      if (sectionWheelLockRef.current) return

      sectionWheelLockRef.current = true
      goToSectionIndex(currentIndex + (event.deltaY > 0 ? 1 : -1))
      window.setTimeout(() => {
        sectionWheelLockRef.current = false
      }, 760)
    },
    [goToSectionIndex, isSectionDeckMode, showGameOverlay, showSplash],
  )

  const handleDeckTouchStart = useCallback((event) => {
    const touch = event.touches?.[0]
    if (!touch) return
    touchStartYRef.current = touch.clientY
    touchStartXRef.current = touch.clientX
  }, [])

  const handleDeckTouchEnd = useCallback(
    (event) => {
      if (!isSectionDeckMode || showSplash || showGameOverlay) return
      const touch = event.changedTouches?.[0]
      if (!touch || touchStartYRef.current === null) return

      const deltaY = touchStartYRef.current - touch.clientY
      const deltaX = (touchStartXRef.current ?? touch.clientX) - touch.clientX
      touchStartYRef.current = null
      touchStartXRef.current = null

      if (Math.abs(deltaY) < 44 || Math.abs(deltaY) <= Math.abs(deltaX)) return

      const currentIndex = activeSectionIndexRef.current
      const activePanel = sectionPanelRefs.current[currentIndex]
      if (canScrollPanel(activePanel, deltaY)) return

      goToSectionIndex(currentIndex + (deltaY > 0 ? 1 : -1))
    },
    [goToSectionIndex, isSectionDeckMode, showGameOverlay, showSplash],
  )

  const triggerSecretTerminal = useCallback((options = {}) => {
    const {
      effect = 'vibe',
      title = 'sudo vibe accepted',
      detail = 'neon link established',
      duration = 4200,
    } = options

    window.clearTimeout(secretPulseTimeoutRef.current)
    window.clearTimeout(secretEndTimeoutRef.current)
    setSecretEffect(effect)
    setSecretToast({ title, detail })
    setSecretEnding(false)
    setSecretPulse(false)

    requestAnimationFrame(() => {
      setSecretPulse(true)
    })

    const exitMs = Math.min(620, Math.max(260, Math.floor(duration * 0.2)))
    const activeMs = Math.max(0, duration - exitMs)

    secretPulseTimeoutRef.current = window.setTimeout(() => {
      setSecretEnding(true)
    }, activeMs)

    secretEndTimeoutRef.current = window.setTimeout(() => {
      setSecretPulse(false)
      setSecretEnding(false)
    }, duration)
  }, [])

  const launchSecretGame = (game) => {
    const nextGame = game === 'cube' ? 'cube' : 'drive'
    const isCube = nextGame === 'cube'

    triggerSecretTerminal({
      effect: 'game',
      title: `sudo ${isCube ? 'cube' : 'drive'} accepted`,
      detail: `${isCube ? 'The Cube' : 'Drive Mad'} booting`,
      duration: 3600,
    })

    setAudioControlsOpen(false)
    setActiveGame(nextGame)
    setShowGameOverlay(true)
  }

  const launchRandomSecretGame = () => {
    const games = ['cube', 'drive']
    launchSecretGame(games[Math.floor(Math.random() * games.length)])
  }

  const secretCommands = [
    {
      id: 'secret-vibe',
      label: 'sudo vibe',
      detail: 'pulse the neon layer',
      icon: '!!',
      aliases: ['vibe', 'vive', 'neon', 'pulse'],
      keywords: ['secret', 'effect', 'visual'],
      action: () =>
        triggerSecretTerminal({
          effect: 'vibe',
          title: 'sudo vibe accepted',
          detail: 'neon link established',
        }),
    },
    {
      id: 'secret-cube',
      label: 'sudo cube',
      detail: 'open The Cube minigame',
      icon: 'CB',
      aliases: ['cube', 'the cube', 'minigame cube'],
      keywords: ['secret', 'konami', 'game'],
      action: () => launchSecretGame('cube'),
    },
    {
      id: 'secret-drive',
      label: 'sudo drive',
      detail: 'open Drive Mad minigame',
      icon: 'DR',
      aliases: ['drive', 'drive mad', 'car game'],
      keywords: ['secret', 'konami', 'game'],
      action: () => launchSecretGame('drive'),
    },
    {
      id: 'secret-konami',
      label: 'sudo konami',
      detail: 'launch a random minigame',
      icon: 'K0',
      aliases: ['konami', 'random game', 'minigame'],
      keywords: ['secret', 'cube', 'drive'],
      action: launchRandomSecretGame,
    },
    {
      id: 'secret-overclock',
      label: 'sudo overclock',
      detail: 'boost music and CRT intensity',
      icon: 'OC',
      aliases: ['overclock', 'boost', 'turbo'],
      keywords: ['secret', 'audio', 'effect'],
      action: () => {
        setPlayAudio(true)
        setAudioMuted(false)
        setAudioPaused(false)
        setAudioVolume((prev) => Math.max(prev, 32))
        triggerSecretTerminal({
          effect: 'overclock',
          title: 'sudo overclock accepted',
          detail: 'render loop boosted for a few seconds',
        })
      },
    },
    {
      id: 'secret-matrix',
      label: 'sudo matrix',
      detail: 'drop a terminal rain overlay',
      icon: 'MX',
      aliases: ['matrix', 'rain', 'terminal rain'],
      keywords: ['secret', 'visual', 'effect'],
      action: () =>
        triggerSecretTerminal({
          effect: 'matrix',
          title: 'sudo matrix accepted',
          detail: 'terminal rain injected',
          duration: 5200,
        }),
    },
    {
      id: 'secret-lofi',
      label: 'sudo lofi',
      detail: 'open the deck and start music',
      icon: 'LF',
      aliases: ['lofi', 'music', 'radio'],
      keywords: ['secret', 'audio', 'deck'],
      action: () => {
        setPlayAudio(true)
        setAudioMuted(false)
        setAudioPaused(false)
        setAudioControlsOpen(true)
        setNextAudioTrack()
        triggerSecretTerminal({
          effect: 'lofi',
          title: 'sudo lofi accepted',
          detail: 'audio deck patched into signal',
        })
      },
    },
    {
      id: 'secret-help',
      label: 'help secrets',
      detail: 'show hidden terminal commands',
      icon: '??',
      aliases: ['secrets', 'secret help', 'sudo help', 'help'],
      keywords: ['secret', 'commands'],
      action: () =>
        triggerSecretTerminal({
          effect: 'scan',
          title: 'secret commands',
          detail: 'sudo cube / sudo drive / sudo konami / sudo overclock / sudo matrix / sudo lofi',
          duration: 6000,
        }),
    },
  ]

  const paletteCommands = [
    {
      id: 'route-home',
      label: 'Go home',
      detail: 'profile terminal',
      category: 'route',
      icon: '00',
      keywords: ['inicio', 'hero', 'login', 'profile'],
      action: () => scrollToSection('#home'),
    },
    {
      id: 'route-about',
      label: 'Open about',
      detail: 'about.md',
      category: 'route',
      icon: '01',
      keywords: ['bio', 'readme', 'profile'],
      action: () => scrollToSection('#about'),
    },
    {
      id: 'route-links',
      label: 'Open links',
      detail: 'links.sh',
      category: 'route',
      icon: '02',
      keywords: ['discord', 'github', 'steam', 'twitch'],
      action: () => scrollToSection('#links'),
    },
    {
      id: 'route-discord',
      label: 'Open Discord',
      detail: 'live presence card',
      category: 'route',
      icon: '03',
      keywords: ['presence', 'activity', 'status'],
      action: () => scrollToSection('#discord'),
    },
    {
      id: 'route-games',
      label: 'Open game shelf',
      detail: 'favorite games',
      category: 'route',
      icon: '04',
      keywords: ['games', 'shelf', 'favorites', 'nier', 'automata'],
      action: () => scrollToSection('#games'),
    },
    {
      id: 'route-comments',
      label: 'Open comments',
      detail: 'guestbook stream',
      category: 'route',
      icon: '05',
      keywords: ['messages', 'guestbook'],
      action: () => scrollToSection('#comments'),
    },
    {
      id: 'audio-panel',
      label: 'Toggle audio deck',
      detail: audioControlsOpen ? 'close LoFi controls' : 'open LoFi controls',
      category: 'audio',
      icon: 'AU',
      keywords: ['music', 'lofi', 'controls', 'panel'],
      action: () => setAudioControlsOpen((prev) => !prev),
    },
    {
      id: 'audio-play',
      label: audioPaused ? 'Play LoFi' : 'Pause LoFi',
      detail: currentAudioTrack.title,
      category: 'audio',
      icon: audioPaused ? 'PL' : 'PA',
      keywords: ['music', 'lofi', 'play', 'pause'],
      action: toggleLofiPlay,
    },
    {
      id: 'audio-next',
      label: 'Next LoFi track',
      detail: currentAudioTrack.subtitle,
      category: 'audio',
      icon: 'NX',
      keywords: ['music', 'lofi', 'next', 'track'],
      action: setNextAudioTrack,
    },
    {
      id: 'audio-mute',
      label: effectiveAudioMuted ? 'Unmute LoFi' : 'Mute LoFi',
      detail: `volume ${String(audioVolume).padStart(2, '0')}%`,
      category: 'audio',
      icon: effectiveAudioMuted ? 'UN' : 'MT',
      keywords: ['music', 'lofi', 'mute', 'volume'],
      action: toggleLofiMute,
    },
    ...(me && me.isAdmin
      ? [
          {
            id: 'theme-xmas',
            label: christmasEnabled ? 'Disable Xmas mode' : 'Enable Xmas mode',
            detail: christmasSaving ? 'saving settings' : 'admin theme switch',
            category: 'admin',
            icon: 'XM',
            keywords: ['christmas', 'xmas', 'snow', 'theme'],
            action: toggleChristmasTheme,
          },
        ]
      : []),
  ]

  const deckSections = [
    { href: '#home', label: 'home', node: <Hero startTyping={!showSplash} /> },
    { href: '#about', label: 'about', node: <About /> },
    { href: '#links', label: 'links', node: <Links /> },
    { href: '#discord', label: 'discord', node: <DiscordCard /> },
    { href: '#games', label: 'games', node: <GameShelf /> },
    { href: '#comments', label: 'comments', node: <Comments /> },
  ]

  const secretShellClass = secretPulse
    ? `secret-terminal-active secret-terminal-${secretEffect} ${
        secretEnding ? 'secret-terminal-ending' : ''
      }`
    : ''
  const appShellClass = [
    'app-shell',
    isSectionDeckMode ? 'is-section-deck-mode' : '',
    secretShellClass,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={appShellClass}>
      <div className="app-bg" aria-hidden="true">
        <span className="app-horizon-stabilizer" />
      </div>
      <ArcadeVisualEffects visible={!showSplash} />
      <BackgroundAudio
        play={playAudio}
        muted={effectiveAudioMuted}
        paused={audioPaused}
        volume={showGameOverlay ? 0 : audioVolume}
        track={currentAudioTrack}
      />
      {christmasEnabled ? <Snowfall /> : <Fireflies />}
      {!christmasEnabled && <CodeWaves />}
      <KonamiGameOverlay
        open={showGameOverlay}
        activeGame={activeGame}
        me={me}
        onClose={() => setShowGameOverlay(false)}
      />
      <MusicControlButton
        visible={!showSplash}
        open={audioControlsOpen}
        muted={effectiveAudioMuted}
        gameMuted={showGameOverlay}
        paused={audioPaused}
        volume={audioVolume}
        track={currentAudioTrack}
        trackIndex={audioTrackIndex}
        trackCount={LOFI_TRACKS.length}
        onOpenChange={setAudioControlsOpen}
        onToggleMute={toggleLofiMute}
        onTogglePlay={toggleLofiPlay}
        onVolumeChange={handleLofiVolumeChange}
        onNext={setNextAudioTrack}
        onPrevious={setPreviousAudioTrack}
      />
      <ChristmasToggleButton
        visible={!showSplash && !!(me && me.isAdmin)}
        enabled={christmasEnabled}
        saving={christmasSaving}
        onToggle={toggleChristmasTheme}
      />
      <CommandPalette
        enabled={!showSplash && !showGameOverlay}
        commands={paletteCommands}
        secretCommands={secretCommands}
      />
      {secretPulse && secretEffect === 'matrix' && (
        <SecretTerminalRain ending={secretEnding} />
      )}
      {secretPulse && (
        <div
          className={`secret-terminal-toast ${secretEnding ? 'is-ending' : ''}`}
          role="status"
          aria-live="polite"
        >
          <span>{secretToast.title}</span>
          <strong>{secretToast.detail}</strong>
        </div>
      )}
      {showSplash && <Splash onEnter={handleEnter} />}
      <Navbar />
      <main className={`app-main ${isSectionDeckMode ? 'section-deck-main' : ''}`}>
        {isSectionDeckMode ? (
          <div
            className="section-deck"
            onWheel={handleDeckWheel}
            onTouchStart={handleDeckTouchStart}
            onTouchEnd={handleDeckTouchEnd}
          >
            {deckSections.map((section, index) => {
              const isActive = index === activeSectionIndex
              const isLeaving = index === previousSectionIndex
              const itemClass = [
                'section-deck-item',
                isActive ? 'is-active' : '',
                isLeaving ? 'is-leaving' : '',
                sectionDirection === 'forward' ? 'is-forward' : 'is-backward',
              ]
                .filter(Boolean)
                .join(' ')

              return (
                <div
                  key={section.href}
                  ref={(node) => {
                    if (node) sectionPanelRefs.current[index] = node
                  }}
                  className={itemClass}
                  aria-hidden={!isActive}
                >
                  {section.node}
                </div>
              )
            })}

            <div className="section-deck-hud" aria-label="Section navigation">
              <div className="section-deck-counter" aria-hidden="true">
                <span>{String(activeSectionIndex).padStart(2, '0')}</span>
                <strong>{deckSections[activeSectionIndex]?.label}</strong>
              </div>
              <div className="section-deck-dots">
                {deckSections.map((section, index) => (
                  <button
                    key={section.href}
                    type="button"
                    className={index === activeSectionIndex ? 'is-active' : ''}
                    onClick={() => goToSectionIndex(index)}
                    aria-label={`Open ${section.label} section`}
                    aria-current={index === activeSectionIndex ? 'step' : undefined}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <Hero startTyping={!showSplash} />
            <div className="space-y-10">
              <About />
              <Links />
              <DiscordCard />
              <GameShelf />
              <Comments />
            </div>
          </>
        )}
      </main>
      <footer className="app-footer">
        <div className="footer-shell mx-auto max-w-6xl">
          <div className="footer-grid">
            <p className="footer-build">
              <span className="footer-tok-comment">{'//'}</span>{' '}
              built with{' '}
              <span className="inline-block footer-heart">{'\u2764'}</span>
              {', caffeine '}
              <span className="footer-tok-op">{'&&'}</span>{' '}
              <span className="footer-tok-fn">console</span>
              <span className="footer-tok-punct">.</span>
              <span className="footer-tok-fn">log</span>
              <span className="footer-tok-punct">(</span>
              <span className="footer-tok-str">'caos'</span>
              <span className="footer-tok-punct">)</span>{' '}
              <span className="footer-tok-comment">{'\u00B7 ' + new Date().getFullYear()}</span>
            </p>

            <div className="footer-status-stack">
              <div className="footer-pill footer-pill-status">
                <span className="footer-pill-led footer-pill-led-cyan" aria-hidden="true">
                  <span className="footer-pill-led-core" />
                  <span className="footer-pill-led-ping" />
                </span>
                <span className="footer-pill-label">system_status</span>
                <span className="footer-pill-value">nominal</span>
              </div>
              <div className="footer-pill footer-pill-players">
                <span className="footer-pill-led footer-pill-led-green" aria-hidden="true">
                  <span className="footer-pill-led-core" />
                  <span className="footer-pill-led-ping" />
                </span>
                <span className="footer-pill-label">players_online</span>
                <span className="footer-pill-value tabular-nums">
                  {visitError
                    ? '\u2014'
                    : visitCount === null
                    ? '...'
                    : visitCount.toLocaleString('en-US')}
                </span>
              </div>
            </div>
          </div>

          <div className="footer-prompt" aria-hidden="true">
            <span className="footer-prompt-user">guest</span>
            <span className="footer-prompt-at">@</span>
            <span className="footer-prompt-host">{me?.username || 'daivr'}</span>
            <span className="footer-prompt-colon">:</span>
            <span className="footer-prompt-path">~$</span>
            <span className="footer-prompt-cmd">session.end()</span>
            <span className="footer-prompt-caret" />
          </div>
        </div>
      </footer>
    </div>
  )
}

function BackgroundAudio({ play, muted, paused, volume, track }) {
  const iframeRef = useRef(null)
  const trackId = track?.id || LOFI_TRACKS[0].id

  useEffect(() => {
    if (!play) return

    const sendPlayerState = () => {
      const iframe = iframeRef.current
      if (!iframe || !iframe.contentWindow) return

      try {
        const msg = (func, args = []) =>
          iframe.contentWindow.postMessage(
            JSON.stringify({
              event: 'command',
              func,
              args,
            }),
            '*',
          )

        const nextVolume = muted ? 0 : clampLofiVolumePercent(volume)

        if (muted || nextVolume === 0) {
          msg('mute')
          msg('setVolume', [0])
        } else {
          msg('unMute')
          msg('setVolume', [nextVolume])
        }

        msg(paused ? 'pauseVideo' : 'playVideo')
      } catch {
        // ignore
      }
    }

    const onMessage = (event) => {
      if (!event || !event.data) return
      try {
        const data =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (data && data.event === 'onReady') {
          sendPlayerState()
        }
      } catch {
        // ignore
      }
    }

    window.addEventListener('message', onMessage)

    const quick = setTimeout(sendPlayerState, 200)
    const interval = setInterval(sendPlayerState, 1500)

    return () => {
      clearTimeout(quick)
      clearInterval(interval)
      window.removeEventListener('message', onMessage)
    }
  }, [play, muted, paused, volume, trackId])

  if (!play) return null

  const origin =
    typeof window !== 'undefined'
      ? `&origin=${encodeURIComponent(window.location.origin)}`
      : ''

  return (
    <iframe
      key={trackId}
      ref={iframeRef}
      className="pointer-events-none fixed inset-0 h-0 w-0 opacity-0"
      src={`https://www.youtube.com/embed/${trackId}?autoplay=1&loop=1&playlist=${trackId}&enablejsapi=1&mute=1&playsinline=1${origin}`}
      title="Background music"
      allow="autoplay; encrypted-media"
    />
  )
}
