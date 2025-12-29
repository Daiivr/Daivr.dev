import React, { useEffect, useRef, useState } from 'react'
import SidebarTrafficLight from './SidebarTrafficLight'

const navLinks = [
  { href: '#home', label: 'Home' },
  { href: '#about', label: 'Sobre mí' },
  { href: '#links', label: 'Links' },
  { href: '#discord', label: 'Discord' },
  { href: '#gallery', label: 'Galería' },
  { href: '#comments', label: 'Comentarios' },
]

function getSectionOffsets() {
  return navLinks
    .map((l) => {
      const el = document.querySelector(l.href)
      if (!el) return null
      const top = el.getBoundingClientRect().top + window.scrollY
      return { href: l.href, top }
    })
    .filter(Boolean)
}

export default function Navbar() {
  const [active, setActive] = useState('#home')
  const isClickScrolling = useRef(false)

  useEffect(() => {
    const updateActive = () => {
      if (isClickScrolling.current) return

      const y = window.scrollY + 140 // offset (sticky/mobile + breathing room)
      const sections = getSectionOffsets()
      if (!sections.length) return

      let current = sections[0].href
      for (const s of sections) {
        if (y >= s.top) current = s.href
      }
      setActive(current)
    }

    updateActive()
    window.addEventListener('scroll', updateActive, { passive: true })
    window.addEventListener('resize', updateActive)

    return () => {
      window.removeEventListener('scroll', updateActive)
      window.removeEventListener('resize', updateActive)
    }
  }, [])

  const handleClick = (href) => (e) => {
    e.preventDefault()
    const el = document.querySelector(href)
    if (!el) return

    isClickScrolling.current = true
    setActive(href)

    el.scrollIntoView({ behavior: 'smooth', block: 'start' })

    window.setTimeout(() => {
      isClickScrolling.current = false
    }, 700)
  }

  const LinkItem = ({ link, vertical = false }) => {
    const isActive = active === link.href

    return (
      <a
        href={link.href}
        onClick={handleClick(link.href)}
        className={
          vertical
            ? `nav-pill w-full justify-start ${isActive ? 'is-active' : ''}`
            : `nav-tab ${isActive ? 'is-active' : ''}`
        }
      >
        <span className="relative z-10">{link.label}</span>
        {isActive && <span className="nav-glow" aria-hidden="true" />}
      </a>
    )
  }

  return (
    <>
      {/* Mobile / small screens */}
      <nav className="lg:hidden sticky top-0 z-40 app-topbar">
        <div className="mx-auto max-w-6xl px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <a
              href="#home"
              onClick={handleClick('#home')}
              className="inline-flex items-center gap-2"
            >
              <span className="brand-orb" aria-hidden="true" />
              <span className="text-sm font-semibold tracking-tight">
                daivr.dev
              </span>
            </a>

            <div className="nav-rail">
              {navLinks.map((l) => (
                <LinkItem key={l.href} link={l} />
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex app-nav">
        <a
          href="#home"
          onClick={handleClick('#home')}
          className="flex items-center gap-3 px-2 py-2"
        >
          <span className="brand-orb brand-orb-lg" aria-hidden="true" />
          <div className="leading-tight">
            <div className="text-[12px] uppercase tracking-[0.22em] text-slate-400">
              Portfolio
            </div>
            <div className="text-base font-semibold tracking-tight">
              daivr.dev
            </div>
          </div>
        </a>

        <div className="mt-2 flex flex-col gap-2">
          {navLinks.map((l) => (
            <LinkItem key={l.href} link={l} vertical />
          ))}
        </div>

        <div className="mt-6 -ml-4 flex justify-start">
          <SidebarTrafficLight />
        </div>

        <div className="mt-auto px-2 pt-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              Un rincón bonito para lo que construyo, juego y rompo… y luego
              arreglo mejor. ✨
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="mini-chip">React</span>
              <span className="mini-chip">Node</span>
              <span className="mini-chip">C#</span>
              <span className="mini-chip">SysBot</span>
            </div>
          </div>
        </div>

        <div className="sidebar-credit">
          <span className="sidebar-credit-pill">© {new Date().getFullYear()} · Made by Dai</span>
        </div>

      </aside>
    </>
  )
}
