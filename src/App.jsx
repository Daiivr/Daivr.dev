import React, { useState, useEffect, useRef } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import About from './components/About'
import Links from './components/Links'
import Gallery from './components/Gallery'
import DiscordCard from './components/DiscordCard'
import Comments from './components/Comments'
import Splash from './components/Splash'
import Fireflies from './components/Fireflies'

function KonamiGameOverlay({ open, activeGame, me, onClose }) {
  const [isMounted, setIsMounted] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [internalGame, setInternalGame] = useState(null)

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

  if (!isMounted || !internalGame) return null

  const discordId = me?.id ? String(me.id) : null

  // Para The Cube seguimos usando la versión local con soporte de discordId.
  // Para Drive Mad usamos la versión avanzada alojada en gamecollections.me
  const basePath =
    internalGame === 'cube'
      ? '/the-cube/index.html'
      : 'https://gamecollections.me/game/3kh0-assets-main/drive-mad/'

  const src =
    internalGame === 'cube' && discordId
      ? `${basePath}?discordId=${encodeURIComponent(discordId)}`
      : basePath

  const title =
    internalGame === 'cube'
      ? 'Konami mode • The Cube'
      : 'Konami mode • Drive Mad'

  const subtitle =
    internalGame === 'cube'
      ? 'Usaste el código Konami en daivr.dev, así que te ganaste un break para jugar con el cubo ✨'
      : 'Usaste el código Konami en daivr.dev, así que te ganaste un break para jugar un rato a manejar 🚗✨'

  const handleCloseClick = () => {
    if (onClose) onClose()
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div
        className={`relative w-full max-w-5xl h-[80vh] rounded-[32px] border border-slate-700/80 bg-slate-900/90 shadow-[0_0_60px_rgba(15,23,42,0.9)] overflow-hidden transform-gpu transition-all duration-300 ${
          isVisible
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 translate-y-4 scale-95'
        }`}
      >
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.22),transparent_60%),radial-gradient(circle_at_bottom_right,rgba(244,114,182,0.22),transparent_60%)]" />
        <div className="relative z-10 flex h-full flex-col">
          <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/80 px-3 py-1 text-xs font-medium text-slate-200 shadow-[0_0_18px_rgba(15,23,42,0.9)]">
              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
              <span>{title}</span>
            </div>
            <button
              type="button"
              onClick={handleCloseClick}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700/70 bg-slate-900/80 text-slate-300 text-sm hover:bg-slate-800 hover:text-slate-50 hover:border-slate-500 transition-colors"
              aria-label="Cerrar juego secreto"
            >
              ✕
            </button>
          </header>
          <div className="px-4 pb-4 flex-1 flex flex-col">
            <div className="relative flex-1 overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-950/80">
              <iframe
                title={title}
                src={src}
                className="h-full w-full"
                loading="lazy"
              />
            </div>
            <p className="mt-2 text-[0.70rem] text-slate-400 text-center">
              {subtitle}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true)
  const [playAudio, setPlayAudio] = useState(false)
  const [visitCount, setVisitCount] = useState(null)
  const [visitError, setVisitError] = useState(false)
  const [me, setMe] = useState(null)
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
        const res = await fetch('/api/me')
        if (!res.ok) return
        const data = await res.json()
        if (data && data.id) {
          setMe(data)
        }
      } catch (err) {
        console.error('Error cargando /api/me', err)
      }
    }

    loadMe()
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

  return (
    <div className="min-h-screen text-slate-50">
      <BackgroundAudio play={playAudio} />
      <Fireflies />
      <KonamiGameOverlay
        open={showGameOverlay}
        activeGame={activeGame}
        me={me}
        onClose={() => setShowGameOverlay(false)}
      />
      {showSplash && <Splash onEnter={handleEnter} />}
      <Navbar />
      <main className="pb-16 space-y-4">
        <Hero startTyping={!showSplash} />
        <div className="section-shell space-y-8">
          <About />
          <Links />
          <DiscordCard />
          <Gallery />
          <Comments />
        </div>
      </main>
      <footer className="border-t border-slate-800/60 bg-slate-950/80 py-4 px-4 text-[11px] text-slate-500">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 sm:flex-row sm:justify-between sm:gap-3">
          <p className="text-center sm:text-left">
            Hecho con{' '}
            <span className="inline-block footer-heart">❤️</span>, café y un
            poco de caos · {new Date().getFullYear()}
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
                ? '—'
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

function BackgroundAudio({ play }) {
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
          iframe.contentWindow.postMessage(
            JSON.stringify({
              event: 'command',
              func: 'setVolume',
              args: [20],
            }),
            '*',
          )
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

        msg('setVolume', [20])
        msg('unMute')
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
  }, [play])

  if (!play) return null

  return (
    <iframe
      ref={iframeRef}
      className="pointer-events-none fixed inset-0 h-0 w-0 opacity-0"
      src="https://www.youtube.com/embed/d9TQuRux3VQ?start=10&autoplay=1&loop=1&playlist=d9TQuRux3VQ&enablejsapi=1&mute=1"
      title="Música de fondo"
      allow="autoplay; encrypted-media"
    />
  )
}
