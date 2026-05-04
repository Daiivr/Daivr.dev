import React, { useEffect, useMemo, useState } from 'react'
import peachCard from '../assets/dai-peach-card.png'

const DISCORD_ID = import.meta.env.VITE_DISCORD_ID || '271701484922601472'

const TAGLINE_TEXT =
  '> whoami\n' +
  'full-stack dev · bot wrangler · night-shift player.\n' +
  'building Discord bots, SysBot tooling y mundos en VRChat, Fallout y Minecraft.'

const STATUS_LABEL = {
  online: 'online',
  idle: 'idle',
  dnd: 'dnd',
  offline: 'offline',
}

const HERO_TAGS = ['full-stack', 'sysbot', 'discord-bots', 'game-dev']

function buildTypingFrames(text) {
  const frames = []
  let current = ''

  // Separate into tokens (words + spaces/newlines)
  const tokens = []
  let buffer = ''

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === ' ' || ch === '\n') {
      if (buffer) {
        tokens.push(buffer)
        buffer = ''
      }
      tokens.push(ch)
    } else {
      buffer += ch
    }
  }
  if (buffer) tokens.push(buffer)

  // Choose a few words to “mess up” (and then fix)
  const candidateWordIndexes = tokens
    .map((tok, idx) => ({ tok, idx }))
    .filter((t) => t.tok !== ' ' && t.tok !== '\n' && t.tok.length > 4)
    .map((t) => t.idx)

  const maxMistakes = 3
  const mistakesCount = Math.min(
    maxMistakes,
    Math.max(0, candidateWordIndexes.length > 0 ? 2 : 0),
  )

  const mistakeIndexes = new Set()
  while (mistakeIndexes.size < mistakesCount && candidateWordIndexes.length) {
    const rnd = Math.floor(Math.random() * candidateWordIndexes.length)
    const [picked] = candidateWordIndexes.splice(rnd, 1)
    mistakeIndexes.add(picked)
  }

  function typeToken(token) {
    for (let i = 0; i < token.length; i++) {
      current += token[i]
      frames.push(current)
    }
  }

  function makeMistake(word) {
    // simple swap-based typo
    if (word.length <= 3) return word

    let result = word
    let attempts = 0

    while (result === word && attempts < 6) {
      const chars = word.split('')
      const swaps = Math.min(2, Math.max(1, Math.floor(word.length / 4)))

      for (let s = 0; s < swaps; s++) {
        const i = Math.floor(Math.random() * chars.length)
        let j = Math.floor(Math.random() * chars.length)
        if (j === i) j = (j + 1) % chars.length
        const tmp = chars[i]
        chars[i] = chars[j]
        chars[j] = tmp
      }

      result = chars.join('')
      attempts++
    }

    return result
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    // spaces / newlines
    if (token === ' ' || token === '\n') {
      typeToken(token)
      continue
    }

    if (mistakeIndexes.has(i)) {
      const wrong = makeMistake(token)
      typeToken(wrong)

      // backspace wrong word
      for (let j = 0; j < wrong.length; j++) {
        current = current.slice(0, -1)
        frames.push(current)
      }

      // type correct word
      typeToken(token)
    } else {
      typeToken(token)
    }
  }

  if (frames.length === 0) frames.push('')
  return frames
}

export default function Hero({ startTyping }) {
  const [me, setMe] = useState(null)
  const [tagline, setTagline] = useState('')
  const [hasTyped, setHasTyped] = useState(false)

  // Lanyard presence
  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const res = await fetch(`https://api.lanyard.rest/v1/users/${DISCORD_ID}`)
        const data = await res.json()
        if (mounted) setMe(data?.data || null)
      } catch {
        // ignore
      }
    }

    load()
    const interval = setInterval(load, 25_000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const typingFrames = useMemo(() => buildTypingFrames(TAGLINE_TEXT), [])

  // Type-in tagline with “mistakes”
  useEffect(() => {
    if (!startTyping || hasTyped) return

    let step = 0
    setTagline('')

    // Slower typing for a calmer vibe
    const id = setInterval(() => {
      setTagline(typingFrames[step] || '')
      step += 1

      if (step >= typingFrames.length) {
        clearInterval(id)
        setHasTyped(true)
      }
    }, 60)

    return () => clearInterval(id)
  }, [startTyping, hasTyped, typingFrames])

  const user = me?.discord_user
  const statusKey = me?.discord_status || 'offline'
  const statusLabel = STATUS_LABEL[statusKey] || 'Offline'

  const avatarUrl = useMemo(() => {
    if (user?.id && user?.avatar) {
      return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`
    }
    return peachCard
  }, [user?.id, user?.avatar])

  const displayName =
    user?.global_name || user?.display_name || user?.username || 'Dai'

  // Keep presence for the status dot; chips are curated.

  return (
    <section id="home" className="section-shell">
      <div className="hero-grid">
        {/* Profile panel */}
        <div className="hero-card">
          <div className="hero-card-bg" aria-hidden="true" />

          {/* Split layout: text up top, meta down below */}
          <div className="relative z-10 flex min-h-[clamp(420px,60vh,560px)] flex-col">
            <div className="flex items-start gap-4">
              <div className="hero-avatar-wrap">
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-16 w-16 rounded-2xl object-cover"
                  loading="lazy"
                />
                <span
                  className={`hero-status-dot status-${statusKey}`}
                  aria-hidden="true"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="section-kicker">~/personal $ login</p>

                <h1 className="hero-title">
                  <span className="bg-gradient-to-r from-sky-300 via-fuchsia-300 to-amber-200 bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(56,189,248,0.16)]">
                    {displayName}
                  </span>
                </h1>
                <p className="code-meta mt-2"><span className="dot" />status: {statusLabel}</p>
              </div>
            </div>

            {/* Typed text: centered in the big top box */}
            <div className="flex flex-1 items-center justify-center px-3 sm:px-6">
              <p className="hero-tagline mt-0 max-w-[44ch] text-center">
                <span>{tagline || (startTyping ? '' : TAGLINE_TEXT)}</span>
                {!hasTyped && startTyping && (
                  <span className="ml-[2px] inline-block h-4 w-[2px] align-middle bg-slate-100/70 animate-pulse" />
                )}
              </p>
            </div>

            {/* “Everything else” goes to the bottom area */}
            <div className="mt-auto border-t border-white/10 pt-4">
              <div className="hero-meta-grid" aria-label="Tags">
                {HERO_TAGS.map((t) => (
                  <span key={t} className="chip">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bento side */}
        <div className="hero-bento">
          <div className="bento-card">
            <p className="bento-kicker">// now_running</p>
            <p className="bento-title">Bots de Discord & herramientas SysBot</p>
            <p className="bento-text">
              Embeds limpios, automatizaciones para juegos y side-projects que
              empiezan en 200 LoC y terminan en repos enteros.
            </p>
          </div>

          <div className="bento-card">
            <p className="bento-kicker">// stack.json</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="mini-chip">React</span>
              <span className="mini-chip">Tailwind</span>
              <span className="mini-chip">Node</span>
              <span className="mini-chip">C#</span>
              <span className="mini-chip">PKHeX</span>
              <span className="mini-chip">SysBot</span>
            </div>
          </div>

          <div className="bento-card bento-media vibe-card">
            <img
              src={peachCard}
              alt=""
              className="vibe-bg vibe-bg-cover absolute inset-0 h-full w-full object-cover opacity-[0.35]"
              loading="lazy"
            />

            <div className="relative z-10">
              <p className="bento-kicker">// vibe.cfg</p>
              <p className="bento-title">CRT glow · neon · lo-fi loops</p>
              <p className="bento-text">
                Estética terminal, pixel art y RGB suave. Como si tu IDE
                viviera dentro de una arcade.
              </p>
            </div>
            <div className="bento-sheen" aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  )
}
