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
const clampVolumePercent = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return DEFAULT_KONAMI_VOLUME_PERCENT
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
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div
        className={`relative mx-2 h-[88dvh] w-full max-w-5xl overflow-hidden rounded-[26px] border border-slate-700/80 bg-slate-900/90 shadow-[0_0_60px_rgba(15,23,42,0.9)] transform-gpu transition-all duration-300 sm:mx-4 sm:h-[82vh] sm:rounded-[32px] ${
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
function AudioToggleButton({ visible, muted, onToggle }) {
  if (!visible) return null

  return (
    <button
      type="button"
      onClick={onToggle}
      className="fixed bottom-5 right-5 z-40 rounded-full p-[2px] bg-gradient-to-r from-sky-500/60 via-cyan-400/60 to-fuchsia-500/60 shadow-[0_12px_40px_rgba(8,47,73,0.85)] transition-transform duration-200 hover:translate-y-0.5 active:scale-[0.97]"
      aria-label={muted ? 'Activate lo-fi music' : 'Mute lo-fi music'}
    >
      <div className="flex items-center gap-2 rounded-full bg-slate-950/90 px-3 py-2 border border-slate-700/80">
        <span className="relative flex h-5 w-5 items-center justify-center">
          {!muted && (
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400/30 animate-ping" />
          )}
          <span
            className={`relative inline-flex h-3 w-3 rounded-full ${
              muted
                ? 'bg-slate-400 shadow-[0_0_10px_rgba(148,163,184,0.9)]'
                : 'bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.95)]'
            }`}
          />
        </span>
        <span className="uppercase tracking-[0.22em] text-[9px] text-slate-400">
          LOFI
        </span>
        <span className="text-[11px] font-semibold text-slate-100">
          {muted ? 'OFF' : 'ON'}
        </span>
      </div>
    </button>
  )
}


function ChristmasToggleButton({ visible, enabled, saving, onToggle }) {
  if (!visible) return null

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={saving}
      className="fixed bottom-[4.75rem] right-5 z-40 rounded-full p-[2px] bg-gradient-to-r from-rose-500/70 via-red-500/60 to-emerald-500/70 shadow-[0_14px_44px_rgba(15,23,42,0.9)] transition-transform duration-200 hover:translate-y-0.5 active:scale-[0.97] disabled:opacity-70 disabled:cursor-not-allowed"
      aria-label={enabled ? 'Disable Christmas theme' : 'Enable Christmas theme'}
      title={enabled ? 'Christmas theme: ON' : 'Christmas theme: OFF'}
    >
      <div className="flex items-center gap-2 rounded-full bg-slate-950/90 px-3 py-2 border border-slate-700/80">
        <span className="relative flex h-5 w-5 items-center justify-center">
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
        <span className="uppercase tracking-[0.22em] text-[9px] text-slate-400">
          XMAS
        </span>
        <span className="text-[11px] font-semibold text-slate-100">
          {saving ? '...' : enabled ? 'ON' : 'OFF'}
        </span>
      </div>
    </button>
  )
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true)
  const [playAudio, setPlayAudio] = useState(false)
  const [audioMuted, setAudioMuted] = useState(false)
  const [visitCount, setVisitCount] = useState(null)
  const [visitError, setVisitError] = useState(false)
  const [me, setMe] = useState(null)
  const [christmasEnabled, setChristmasEnabled] = useState(false)
  const [christmasSaving, setChristmasSaving] = useState(false)
  const [showGameOverlay, setShowGameOverlay] = useState(false)
  const [activeGame, setActiveGame] = useState(null)
  const konamiIndexRef = useRef(0)

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

  const effectiveAudioMuted = audioMuted || showGameOverlay

  return (
    <div className="app-shell">
      <div className="app-bg" aria-hidden="true" />
      <BackgroundAudio play={playAudio} muted={effectiveAudioMuted} />
      {christmasEnabled ? <Snowfall /> : <Fireflies />}
      <KonamiGameOverlay
        open={showGameOverlay}
        activeGame={activeGame}
        me={me}
        onClose={() => setShowGameOverlay(false)}
      />
      <AudioToggleButton
        visible={!showSplash}
        muted={effectiveAudioMuted}
        onToggle={() => setAudioMuted((prev) => !prev)}
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
            Hecho con{' '}
            <span className="inline-block footer-heart">{'\u2764\uFE0F'}</span>,
            {' cafe y un poco de caos \u00B7 '}
            {new Date().getFullYear()}
          </p>

          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/90 px-3 py-1 text-[11px] font-medium text-slate-200 shadow-[0_12px_40px_rgba(15,23,42,0.9)]">
            <span className="relative flex h-5 w-5 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/30" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.85)]" />
            </span>
            <span className="uppercase tracking-[0.16em] text-[9px] text-slate-400">
              Visitors
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

function BackgroundAudio({ play, muted }) {
  const iframeRef = useRef(null)

  useEffect(() => {
    if (!play) return

    const onMessage = (event) => {
      if (!event || !event.data) return
      try {
        const data = JSON.parse(event.data)
        if (data && data.event === 'onReady') {
          const iframe = iframeRef.current
          if (!iframe || !iframe.contentWindow) return
          const msg = (func, args = []) =>
            iframe.contentWindow.postMessage(
              JSON.stringify({
                event: 'command',
                func,
                args,
              }),
              '*',
            )

          if (muted) {
            msg('mute')
            msg('setVolume', [0])
          } else {
            msg('unMute')
            msg('setVolume', [20])
          }
        }
      } catch {
        // ignore
      }
    }

    window.addEventListener('message', onMessage)

    const sendVolume = () => {
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

        if (muted) {
          msg('mute')
          msg('setVolume', [0])
        } else {
          msg('unMute')
          msg('setVolume', [20])
        }
      } catch {
        // ignore
      }
    }

    const quick = setTimeout(sendVolume, 200)
    const interval = setInterval(sendVolume, 1500)

    return () => {
      clearTimeout(quick)
      clearInterval(interval)
      window.removeEventListener('message', onMessage)
    }
  }, [play, muted])

  if (!play) return null

  return (
    <iframe
      ref={iframeRef}
      className="pointer-events-none fixed inset-0 h-0 w-0 opacity-0"
      src="https://www.youtube.com/embed/DkbPMHFumss?autoplay=1&loop=1&playlist=DkbPMHFumss&enablejsapi=1&mute=1"
      title="Background music"
      allow="autoplay; encrypted-media"
    />
  )
}
