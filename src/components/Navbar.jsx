import React, { useEffect, useRef, useState } from 'react'
import SidebarTrafficLight from './SidebarTrafficLight'

const navLinks = [
  { href: '#home', label: 'home', code: '00' },
  { href: '#about', label: 'about', code: '01' },
  { href: '#links', label: 'links', code: '02' },
  { href: '#discord', label: 'discord', code: '03' },
  { href: '#games', label: 'games', code: '04' },
  { href: '#comments', label: 'comments', code: '05' },
]

function BrandLogo({ large = false }) {
  return (
    <span
      className={`brand-logo${large ? ' brand-logo-lg' : ''}`}
      aria-hidden="true"
    >
      <span className="brand-logo-leds">
        <i />
        <i />
        <i />
      </span>
      <span className="brand-logo-mark">D</span>
      <span className="brand-logo-cursor" />
      <span className="brand-logo-scan" />
    </span>
  )
}

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
  const [active, setActive] = useState(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    return navLinks.some((link) => link.href === hash) ? hash : '#home'
  })
  const [routeIndicator, setRouteIndicator] = useState({ top: 0, height: 0 })
  const isClickScrolling = useRef(false)
  const navStackRef = useRef(null)
  const navPillRefs = useRef({})

  useEffect(() => {
    const updateActive = () => {
      if (document.querySelector('.section-deck')) return
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

  useEffect(() => {
    const handleActiveSection = (event) => {
      const href = event.detail?.href
      if (href && navLinks.some((link) => link.href === href)) {
        setActive(href)
      }
    }

    window.addEventListener('daivr:active-section', handleActiveSection)
    return () =>
      window.removeEventListener('daivr:active-section', handleActiveSection)
  }, [])

  useEffect(() => {
    const updateIndicator = () => {
      const stack = navStackRef.current
      const item = navPillRefs.current[active]
      if (!stack || !item) return

      setRouteIndicator({
        top: item.offsetTop,
        height: item.offsetHeight,
      })
    }

    updateIndicator()
    window.addEventListener('resize', updateIndicator)
    return () => window.removeEventListener('resize', updateIndicator)
  }, [active])

  const handleClick = (href) => (e) => {
    e.preventDefault()

    if (document.querySelector('.section-deck')) {
      setActive(href)
      window.dispatchEvent(
        new CustomEvent('daivr:navigate-section', {
          detail: { href },
        }),
      )
      return
    }

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
        ref={
          vertical
            ? (node) => {
                if (node) navPillRefs.current[link.href] = node
              }
            : undefined
        }
        onClick={handleClick(link.href)}
        className={
          vertical
            ? `nav-pill w-full justify-start ${isActive ? 'is-active' : ''}`
            : `nav-tab ${isActive ? 'is-active' : ''}`
        }
      >
        {vertical && <span className="nav-index" aria-hidden="true">{link.code}</span>}
        <span className="nav-dot" aria-hidden="true" />
        <span className="nav-label">{link.label}</span>
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
              <BrandLogo />
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
        <a href="#home" onClick={handleClick('#home')} className="sidebar-brand">
          <BrandLogo large />
          <div className="sidebar-brand-copy">
            <div className="sidebar-brand-kicker">
              ~/portfolio
            </div>
            <div className="sidebar-brand-title">
              daivr.dev
            </div>
          </div>
        </a>

        <div className="sidebar-status-panel" aria-hidden="true">
          <span>route.sys</span>
          <strong>online</strong>
        </div>

        <div className="sidebar-nav-panel">
          <div className="sidebar-nav-top" aria-hidden="true">
            <span>routes</span>
            <span>{String(navLinks.length).padStart(2, '0')}</span>
          </div>
          <div ref={navStackRef} className="nav-stack">
            <span
              className="nav-route-indicator"
              style={{
                transform: `translateY(${routeIndicator.top}px)`,
                height: `${routeIndicator.height}px`,
              }}
              aria-hidden="true"
            />
            {navLinks.map((l) => (
              <LinkItem key={l.href} link={l} vertical />
            ))}
          </div>
        </div>

        <div className="sidebar-art-dock">
          <div className="sidebar-art-label" aria-hidden="true">
            <span>signal.obj</span>
            <span>idle</span>
          </div>
          <SidebarTrafficLight />
        </div>

        <div className="sidebar-credit">
          <span className="sidebar-credit-pill">
            © {new Date().getFullYear()} · Made by Dai
          </span>
        </div>

      </aside>
    </>
  )
}
