import React, { useEffect, useState } from 'react'
import axios from 'axios'

const formatDisplayName = (name) => (name ? String(name).replace(/#0$/, '') : '')

export default function Splash({ onEnter }) {
  const [closing, setClosing] = useState(false)
  const [phase, setPhase] = useState('loading') // 'loading' | 'welcome'
  const [me, setMe] = useState(null)
  const [cardVisible, setCardVisible] = useState(false)

  // fase de loading -> pantalla de bienvenida
  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase('welcome')
    }, 2200)

    return () => clearTimeout(timer)
  }, [])

  // obtener usuario de Discord (si está logueado)
  useEffect(() => {
    let cancelled = false

    const loadMe = async () => {
      try {
        const res = await axios.get('/api/me')
        if (!cancelled) {
          setMe(res.data?.user ?? null)
        }
      } catch (err) {
        console.error('Error al cargar /api/me', err)
      }
    }

    loadMe()

    return () => {
      cancelled = true
    }
  }, [])

  // animación suave al aparecer el splash (tarjeta)
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setCardVisible(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  const handleClick = () => {
    if (closing || phase === 'loading') return
    setClosing(true)
    if (typeof onEnter === 'function') {
      onEnter()
    }
  }

  const overlayClasses =
    'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-2xl transition-opacity duration-500 ' +
    (closing ? 'opacity-0 pointer-events-none' : 'opacity-100')

  const cardBase =
    'relative mx-4 w-full max-w-xl overflow-hidden rounded-3xl border border-fuchsia-500/40 bg-slate-900/80 shadow-[0_0_140px_rgba(236,72,153,0.45)] transition-all duration-700 ease-[cubic-bezier(0.22,0.61,0.36,1)]'
  const cardState = cardVisible
    ? ' opacity-100 translate-y-0 scale-100'
    : ' opacity-0 translate-y-4 scale-95'

  const rawName =
    (me && (me.displayName || me.global_name || me.username)) || 'daivr.dev'
  const displayName = formatDisplayName(rawName)

  return (
    <div className={overlayClasses}>
      <div className={cardBase + cardState}>
        {/* Glow orbs */}
        <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-fuchsia-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 right-0 h-44 w-44 rounded-full bg-sky-400/25 blur-3xl" />

        {/* Animated grid */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(244,114,182,0.22),_transparent_60%),radial-gradient(circle_at_bottom,_rgba(56,189,248,0.18),_transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(to_right,rgba(148,163,184,0.2)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.2)_1px,transparent_1px)] [background-size:28px_28px]" />

        <div className="relative px-6 py-7 sm:px-8 sm:py-9">
          <div className="mb-4 flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-slate-400/70">
            <span>daivr.dev</span>
            <span className="flex items-center gap-1">
              <span className="splash-status-dot h-[6px] w-[6px] rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
              <span className="leading-none">{phase === 'loading' ? 'booting' : 'online'}</span>
            </span>
          </div>


          <div className="relative h-44 sm:h-52">
            <LoadingContent phase={phase} />
            <WelcomeContent
              phase={phase}
              onEnter={handleClick}
              displayName={displayName}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function LoadingContent({ phase }) {
  const baseClasses =
    'absolute inset-0 flex flex-col items-center justify-center gap-5 transition-all duration-700 ease-out'
  const visible = phase === 'loading'

  return (
    <div
      className={
        baseClasses +
        ' ' +
        (visible
          ? 'opacity-100 translate-y-0 scale-100'
          : 'pointer-events-none opacity-0 -translate-y-3 scale-95')
      }
    >
      <div className="relative h-24 w-28 splash-eq-wrapper">
        {/* Outer soft glow */}
        <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-r from-fuchsia-500/35 via-sky-400/30 to-emerald-300/30 blur-2xl" />
        {/* Card base */}
        <div className="absolute inset-[3px] rounded-3xl border border-slate-800/80 bg-slate-950/95 shadow-[0_0_40px_rgba(15,23,42,1)]" />
        {/* Content */}
        <div className="relative z-10 flex h-full flex-col justify-between px-4 py-3">
          {/* Top row */}
          <div className="flex items-center justify-between text-[0.6rem] uppercase tracking-[0.18em] text-slate-400/90">
            <span>Lofi mix</span>
            <span className="flex items-center gap-[3px]">
              <span className="splash-eq-dot" />
              <span className="splash-eq-dot" style={{ animationDelay: '0.16s' }} />
              <span className="splash-eq-dot" style={{ animationDelay: '0.32s' }} />
            </span>
          </div>

          {/* Equalizer */}
          <div className="flex flex-1 items-center justify-center gap-[4px]">
            <LoaderBar delay="0s" height="h-7" />
            <LoaderBar delay="0.12s" height="h-10" />
            <LoaderBar delay="0.24s" height="h-6" />
            <LoaderBar delay="0.36s" height="h-9" />
            <LoaderBar delay="0.48s" height="h-7" />
          </div>

          {/* Progress stripe */}
          <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-slate-800/90">
            <div className="splash-eq-progress h-full w-1/2 rounded-full bg-gradient-to-r from-fuchsia-500 via-sky-400 to-emerald-300" />
          </div>
        </div>
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-fuchsia-200/90">
        cargando universo
      </p>
      <p className="max-w-xs text-center text-sm text-slate-200/90">
        Preparando lofi, bots, commits nocturnos y vibes cozy…
      </p>
    </div>
  )
}

function LoaderBar({ delay, height }) {
  return (
    <span
      className={
        'splash-eq-bar inline-block w-[5px] rounded-full bg-gradient-to-t from-fuchsia-500 via-sky-400 to-emerald-300 ' +
        height
      }
      style={{ animationDelay: delay }}
    />
  )
}

function WelcomeContent({ phase, onEnter, displayName }) {
  const baseClasses =
    'absolute inset-0 flex flex-col items-center justify-center text-center transition-all duration-700 ease-out'
  const visible = phase === 'welcome'

  return (
    <div
      className={
        baseClasses +
        ' ' +
        (visible
          ? 'opacity-100 translate-y-0'
          : 'pointer-events-none opacity-0 translate-y-3')
      }
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-fuchsia-300/90">
        bienvenido a mi
      </p>
      <h1 className="mt-4 text-2xl font-semibold sm:text-3xl">
        <span className="bg-gradient-to-r from-fuchsia-300 via-rose-300 to-sky-300 bg-clip-text text-transparent">
          {displayName}
        </span>
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-200/95">
        Mi pequeño rincón de internet para{' '}
        <span className="font-medium text-fuchsia-200">bots, proyectos</span> y
        capturas de aventuras digitales. Ponte cómodo ✨
      </p>
      <p className="mt-2 text-[11px] text-slate-400">
        Haz click para entrar y deja que el soundtrack de fondo haga el resto.
      </p>
      <button
        type="button"
        onClick={onEnter}
        className="mt-6 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 via-rose-500 to-sky-500 px-7 py-2.5 text-sm font-medium text-slate-950 shadow-[0_0_26px_rgba(236,72,153,0.9)] transition hover:brightness-110 hover:shadow-[0_0_38px_rgba(236,72,153,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300/80"
      >
        Entrar
      </button>
    </div>
  )
}
