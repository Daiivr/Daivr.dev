import React, { useState } from 'react'

export default function Splash({ onEnter }) {
  const [closing, setClosing] = useState(false)

  const handleClick = () => {
    if (closing) return
    setClosing(true)
    if (typeof onEnter === 'function') {
      onEnter()
    }
  }


  const overlayClasses =
    'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl transition-opacity duration-500 ' +
    (closing ? 'opacity-0' : 'opacity-100')

  return (
    <div className={overlayClasses}>
      <div
        className="relative w-full max-w-lg cursor-pointer rounded-[2rem] bg-gradient-to-br from-sky-500/40 via-fuchsia-500/40 to-violet-500/30 p-[1px] shadow-[0_32px_120px_rgba(15,23,42,0.95)]"
        onClick={handleClick}
      >
        <div className="rounded-[1.9rem] bg-slate-950/95 px-8 py-10 text-center">
          <div className="absolute right-6 top-6 h-3 w-3 rounded-full bg-fuchsia-500 shadow-[0_0_18px_rgba(236,72,153,0.9)]" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-300">
            Bienvenido
          </h2>
          <p className="mt-3 text-xl font-semibold text-slate-50">
            a mi pequeño rincón de Internet
          </p>
          <p className="mt-4 text-sm text-slate-300 leading-relaxed">
            Aquí guardo mis bots, proyectos, screenshots y un poquito de caos cozy.{' '}
            <span className="text-fuchsia-300">Ponte cómodo.</span>
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Haz click para entrar y deja que la música haga el resto. ✨
          </p>
          <button
            type="button"
            onClick={handleClick}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-fuchsia-500 px-6 py-2 text-sm font-semibold text-slate-950 shadow-[0_14px_60px_rgba(236,72,153,0.7)] transition hover:bg-fuchsia-400"
          >
            Entrar
          </button>
        </div>
      </div>
    </div>
  )
}