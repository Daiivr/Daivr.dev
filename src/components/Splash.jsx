import React, { useEffect, useState } from 'react'
import axios from 'axios'

const formatDisplayName = (name) => (name ? String(name).replace(/#0$/, '') : '')
const DISCORD_FALLBACK_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png'

const INTRO_TAGS = ['bots', 'projects', 'night-coding', 'pixel-vibes']
const BOOT_STATS = ['sysbot:ready', 'discord:live', 'lofi:on']

export default function Splash({ onEnter }) {
  const [closing, setClosing] = useState(false)
  const [phase, setPhase] = useState('loading')
  const [me, setMe] = useState(null)
  const [cardVisible, setCardVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase('welcome')
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadMe = async () => {
      try {
        const res = await axios.get('/api/me')
        if (!cancelled) setMe(res.data?.user ?? null)
      } catch (err) {
        console.error('Error loading /api/me', err)
      }
    }

    loadMe()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setCardVisible(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  const handleEnter = () => {
    if (closing || phase !== 'welcome') return
    setClosing(true)
    if (typeof onEnter === 'function') onEnter()
  }

  const overlayClasses =
    'modal-backdrop transition-opacity duration-500 ' +
    (closing ? 'opacity-0 pointer-events-none' : 'opacity-100')

  const cardBase =
    'modal-card modal-xl splash-card transition-all duration-700 ease-[cubic-bezier(0.22,0.61,0.36,1)]'
  const cardState = cardVisible
    ? ' opacity-100 translate-y-0 scale-100'
    : ' opacity-0 translate-y-4 scale-95'

  const rawName =
    (me && (me.displayName || me.global_name || me.username)) || 'daivr.dev'
  const displayName = formatDisplayName(rawName)

  return (
    <div className={overlayClasses}>
      <div className={cardBase + cardState}>
        <div className="splash-shell">
          <div className="splash-aurora" aria-hidden="true" />
          <div className="splash-grid-mask" aria-hidden="true" />

          <div className="relative z-10">
            <header className="splash-topbar">
              <span className="splash-brand">daivr.dev</span>
              <span className="splash-live-pill">
                <span className="splash-status-dot h-[6px] w-[6px] rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
                <span>{phase === 'loading' ? 'booting' : 'online'}</span>
              </span>
            </header>

            <div className="splash-display">
              <span className="splash-corner splash-corner-tl" aria-hidden="true" />
              <span className="splash-corner splash-corner-br" aria-hidden="true" />
              <div className="splash-stage">
                <LoadingContent
                  phase={phase}
                  avatarUrl={me?.avatarUrl || null}
                  isLoggedIn={Boolean(me?.id)}
                  displayName={displayName}
                />
                <WelcomeContent
                  phase={phase}
                  onEnter={handleEnter}
                  displayName={displayName}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LoadingContent({ phase, avatarUrl, isLoggedIn, displayName }) {
  const baseClasses = 'splash-phase splash-phase-loading'
  const visible = phase === 'loading'

  return (
    <section
      className={
        baseClasses +
        ' ' +
        (visible
          ? 'opacity-100 translate-y-0 scale-100'
          : 'pointer-events-none opacity-0 -translate-y-3 scale-95')
      }
    >
      <div className="splash-loader-orb">
        <span className="splash-loader-ring" />
        <span className="splash-loader-core">
          {isLoggedIn ? (
            <img
              src={avatarUrl || DISCORD_FALLBACK_AVATAR}
              alt={displayName || 'Discord avatar'}
              className="h-full w-full rounded-full object-cover"
              onError={(event) => {
                event.currentTarget.src = DISCORD_FALLBACK_AVATAR
              }}
            />
          ) : (
            'd'
          )}
        </span>
      </div>

      <div className="splash-loader-bars" aria-hidden="true">
        <LoaderBar delay="0s" height="h-9" />
        <LoaderBar delay="0.1s" height="h-12" />
        <LoaderBar delay="0.2s" height="h-8" />
        <LoaderBar delay="0.3s" height="h-11" />
        <LoaderBar delay="0.4s" height="h-7" />
      </div>

      <p className="splash-loader-title">./boot --init</p>
      <p className="splash-loader-copy">
        loading profile · comments · hidden game mode...
      </p>
    </section>
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
  const baseClasses = 'splash-phase splash-phase-welcome'
  const visible = phase === 'welcome'

  return (
    <section
      className={
        baseClasses +
        ' ' +
        (visible
          ? 'opacity-100 translate-y-0'
          : 'pointer-events-none opacity-0 translate-y-3')
      }
    >
      <div className="splash-title-block">
        <p className="splash-kicker">~/personal $ launch</p>
        <h1 className="splash-title">
          <span className="bg-gradient-to-r from-fuchsia-300 via-rose-300 to-sky-300 bg-clip-text text-transparent">
            {displayName}
          </span>
        </h1>
        <p className="splash-copy">
          Personal hub for projects, links and a live discord feed.
        </p>
      </div>

      <div className="splash-tags">
        {INTRO_TAGS.map((tag) => (
          <span key={tag} className="splash-tag">
            {tag}
          </span>
        ))}
      </div>

      <div className="splash-actions">
        <button
          type="button"
          onClick={onEnter}
          className="modal-btn-save splash-enter-btn"
        >
          ./enter
        </button>
        <p className="splash-hint">
          {'// tip: try the konami code once inside.'}
        </p>
      </div>

      <div className="splash-boot-strip" aria-hidden="true">
        {BOOT_STATS.map((stat) => (
          <span key={stat}>{stat}</span>
        ))}
      </div>
    </section>
  )
}
