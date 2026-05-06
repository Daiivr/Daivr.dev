import React, { useCallback, useEffect, useRef, useState } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import About from './components/About'
import Links from './components/Links'
import Gallery from './components/Gallery'
import DiscordCard from './components/DiscordCard'
import Comments from './components/Comments'
import Splash from './components/Splash'
import Fireflies from './components/Fireflies'
import Snowfall from './components/Snowfall'

const KONAMI_VOLUME_STORAGE_KEY = 'daivr_konami_volume'
const DEFAULT_KONAMI_VOLUME_PERCENT = 8
const LOFI_VOLUME_STORAGE_KEY = 'daivr_lofi_volume'
const DEFAULT_LOFI_VOLUME_PERCENT = 20
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

function KonamiGameOverlay({ open, activeGame, me, onClose }) {
  const [isMounted, setIsMounted] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [internalGame, setInternalGame] = useState(null)
  const [gameVolume, setGameVolume] = useState(DEFAULT_KONAMI_VOLUME_PERCENT)
  const iframeRef = useRef(null)
  const normalizedVolume = clampVolumePercent(gameVolume) / 100
  const targetVolumeRef = useRef(normalizedVolume)
  const volumeBootstrappedRef = useRef(false)

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

  const discordId = me?.id ? String(me.id) : null

  const basePath =
    internalGame === 'cube' ? '/the-cube/index.html' : '/drive-mad/index.html'

  const queryParams = new URLSearchParams()
  if (discordId) queryParams.set('discordId', discordId)

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
            <span className="music-control-track-index">
              {String(trackIndex + 1).padStart(2, '0')} / {String(trackCount).padStart(2, '0')}
            </span>
            <span className="music-control-track-name">{paused ? 'paused' : 'streaming'}</span>
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
          <span className="arc-toggle-led relative flex h-5 w-5 items-center justify-center">
            {!effectiveMuted && !paused && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400/30 animate-ping" />
            )}
            <span
              className={`relative inline-flex h-3 w-3 rounded-full ${
                effectiveMuted || paused
                  ? 'bg-slate-400 shadow-[0_0_10px_rgba(148,163,184,0.9)]'
                  : 'bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.95)]'
              }`}
            />
          </span>
          <span className="arc-toggle-label uppercase tracking-[0.22em] text-[9px] text-slate-400">
            LOFI
          </span>
          <span className="arc-toggle-value text-[11px] font-semibold text-slate-100">
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
  const konamiIndexRef = useRef(0)

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

  return (
    <div className="app-shell">
      <div className="app-bg" aria-hidden="true" />
      <ArcadeVisualEffects visible={!showSplash} />
      <BackgroundAudio
        play={playAudio}
        muted={effectiveAudioMuted}
        paused={audioPaused}
        volume={showGameOverlay ? 0 : audioVolume}
        track={currentAudioTrack}
      />
      {christmasEnabled ? <Snowfall /> : <Fireflies />}
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
        onTogglePlay={() => setAudioPaused((prev) => !prev)}
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
      {showSplash && <Splash onEnter={handleEnter} />}
      <Navbar />
      <main className="app-main">
        <Hero startTyping={!showSplash} />
        <div className="space-y-10">
          <About />
          <Links />
          <DiscordCard />
          <Gallery />
          <Comments />
        </div>
      </main>
      <footer className="app-footer">
        <div className="footer-shell mx-auto flex max-w-6xl flex-col items-center gap-2 sm:flex-row sm:justify-between sm:gap-3">
          <p className="text-center sm:text-left">
            {'// built with '}
            <span className="inline-block footer-heart">{'\u2764'}</span>
            {", caffeine && console.log('caos') \u00B7 "}
            {new Date().getFullYear()}
          </p>

          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/90 px-3 py-1 text-[11px] font-medium text-slate-200 shadow-[0_12px_40px_rgba(15,23,42,0.9)]">
            <span className="relative flex h-5 w-5 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/30" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.85)]" />
            </span>
            <span className="uppercase tracking-[0.16em] text-[9px] text-slate-400">
              players_online
            </span>
            <span className="tabular-nums text-[11px] text-slate-50">
              {visitError
                ? '\u2014'
                : visitCount === null
                ? '...'
                : visitCount.toLocaleString('en-US')}
            </span>
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
