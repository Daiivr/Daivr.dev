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

export default function App() {
  const [showSplash, setShowSplash] = useState(true)
  const [playAudio, setPlayAudio] = useState(false)
  const [visitCount, setVisitCount] = useState(null)
  const [visitError, setVisitError] = useState(false)

  // Marca una visita cuando se monta la app
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

  const handleEnter = () => {
    setPlayAudio(true)
    setTimeout(() => {
      setShowSplash(false)
    }, 450)
  }

  return (
    <div className="min-h-screen text-slate-50">
      <BackgroundAudio play={playAudio} />
      <Fireflies />
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
            <span className="inline-block footer-heart">❤️</span>, café y un poco de caos ·{' '}
            {new Date().getFullYear()}
          </p>

          {/* Pill de visitas */}
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/80 px-3 py-1 text-[10px] font-medium text-slate-200 shadow-[0_12px_40px_rgba(15,23,42,0.9)]">
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

        msg('setVolume', [20]) // volumen bajito
        msg('unMute')
      } catch {
        // ignore
      }
    }

    // Intento inicial rápido
    const quick = setTimeout(sendVolume, 200)
    // Refuerzos posteriores por si el player tarda en inicializar
    const interval = setInterval(sendVolume, 1500)

    return () => {
      clearTimeout(quick)
      clearInterval(interval)
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

