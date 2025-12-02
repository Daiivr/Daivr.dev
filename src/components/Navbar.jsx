import React, { useEffect, useRef, useState } from 'react'

const navLinks = [
  { href: '#about', label: 'Sobre mí' },
  { href: '#links', label: 'Links' },
  { href: '#discord', label: 'Discord Live' },
  { href: '#gallery', label: 'Galería' },
  { href: '#comments', label: 'Comentarios' },
]

export default function Navbar() {
  const [active, setActive] = useState('#about')
  const isClickScrolling = useRef(false)

  // Detectar sección activa al hacer scroll
  useEffect(() => {
    const handleScroll = () => {
      if (isClickScrolling.current) return

      const offset = 140
      let current = navLinks[0].href

      for (const link of navLinks) {
        const el = document.querySelector(link.href)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (rect.top - offset <= 0) {
          current = link.href
        }
      }

      setActive(current)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll)
    window.addEventListener('resize', handleScroll)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [])

  const handleClick = (e, href) => {
    e.preventDefault()
    const el = document.querySelector(href)
    if (!el) return

    isClickScrolling.current = true
    setActive(href)

    const y = el.getBoundingClientRect().top + window.scrollY - 90
    window.scrollTo({ top: y, behavior: 'smooth' })

    window.setTimeout(() => {
      isClickScrolling.current = false
    }, 700)
  }

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-800/60 bg-slate-950/90 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        {/* Logo + nombre */}
        <div className="flex items-center gap-2">
          <div className="relative h-8 w-8 md:h-9 md:w-9 shrink-0">
            {/* Orb exterior con aura */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-sky-400 via-fuchsia-500 to-violet-500 opacity-80 blur-[3px]" />
            {/* Centro */}
            <div className="absolute inset-[3px] flex items-center justify-center rounded-full bg-slate-950">
              <div className="h-3.5 w-3.5 animate-pulse rounded-full bg-sky-400 shadow-[0_0_18px_rgba(56,189,248,0.85)]" />
            </div>
          </div>
          <span className="truncate text-sm font-semibold tracking-tight text-slate-100">
            dai<span className="text-sky-400">.dev</span>
          </span>
        </div>

        {/* Links */}
        <div className="w-full sm:w-auto">
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-slate-900/80 p-0.5 text-[0.75rem] sm:text-xs scrollbar-thin scrollbar-thumb-slate-700/70 scrollbar-track-transparent">
            {navLinks.map((link) => {
              const isActive = active === link.href
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleClick(e, link.href)}
                  className={
                    'relative rounded-full px-3 py-1 font-medium transition-colors ' +
                    (isActive
                      ? 'bg-slate-800/95 text-sky-300 shadow-[0_0_16px_rgba(56,189,248,0.7)]'
                      : 'text-slate-300 hover:text-sky-300 hover:bg-slate-800/70')
                  }
                >
                  {link.label}
                  {isActive && (
                    <span className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-sky-400/70 via-cyan-300/80 to-fuchsia-400/70 blur-[8px] opacity-70" />
                  )}
                </a>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}
