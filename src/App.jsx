import React, { useState, useEffect, useRef } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import About from './components/About'
import Links from './components/Links'
import Gallery from './components/Gallery'
import DiscordCard from './components/DiscordCard'
import Comments from './components/Comments'
import Splash from './components/Splash'

export default function App() {
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === 'undefined') return true
    return !window.localStorage.getItem('splashSeen')
  })
  const [playAudio, setPlayAudio] = useState(false)

  const handleEnter = () => {
    setPlayAudio(true)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('splashSeen', '1')
    }
    setTimeout(() => {
      setShowSplash(false)
    }, 450)
  }

  return (
    <div className="min-h-screen text-slate-50">
      <BackgroundAudio play={playAudio} />
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
      <footer className="border-t border-slate-800/60 bg-slate-950/80 py-4 text-center text-[11px] text-slate-500">
        Hecho con{' '}
        <span className="inline-block footer-heart">❤️</span>, café y un poco de caos ·{' '}
        {new Date().getFullYear()}
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

