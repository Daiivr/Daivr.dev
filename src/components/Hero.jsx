import React, { useEffect, useMemo, useRef, useState } from 'react'
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

const clampStat = (value, min, max) => Math.min(max, Math.max(min, value))

const createHudStats = () => ({
  ping: 20 + Math.round(Math.random() * 14),
  fps: 132 + Math.round(Math.random() * 24),
  cpu: 28 + Math.round(Math.random() * 20),
  memory: 41 + Math.round(Math.random() * 18),
  signal: 72 + Math.round(Math.random() * 18),
})

const getTelemetryLoad = (sample, previous) => {
  const cpu = Number(sample.cpu) || 0
  const memory = Number(sample.memory) || 0
  const signal = Number(sample.signal) || 0
  const ping = Number(sample.ping) || 0
  const fps = Number(sample.fps) || 0

  // Realistic monitor line: mostly CPU/MEM, with small environment influence.
  // No artificial impulse here; the graph should show the metric over time.
  const base =
    cpu * 0.52 +
    memory * 0.38 +
    signal * 0.06 +
    clampStat((fps - 112) * 0.38, 0, 24) * 0.04 -
    clampStat(ping - 26, 0, 26) * 0.08

  return clampStat(base, 8, 98)
}

const buildGraphSeries = (history, width = 260, height = 58) => {
  const samples = history.length ? history : [createHudStats()]
  const maxIndex = Math.max(1, samples.length - 1)

  return samples
    .map((sample, index) => {
      const normalized = getTelemetryLoad(sample, samples[index - 1]) / 100
      const x = (index / maxIndex) * width
      const y = height - normalized * (height - 8) - 4
      return { x, y }
    })
}

const buildGraphPath = (points) => {
  if (!points.length) return ''
  if (points.length === 1) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
  }

  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`

  for (let index = 0; index < points.length - 1; index++) {
    const p0 = points[index - 1] || points[index]
    const p1 = points[index]
    const p2 = points[index + 1]
    const p3 = points[index + 2] || p2

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }

  return path
}

const buildGraphFillPath = (linePath, width = 260, height = 58) =>
  `${linePath} L ${width} ${height} L 0 ${height} Z`

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
  const [hudStats, setHudStats] = useState(() => createHudStats())
  const [smoothHudStats, setSmoothHudStats] = useState(() => hudStats)
  const [hudHistory, setHudHistory] = useState(() =>
    Array.from({ length: 24 }, () => createHudStats()),
  )
  const heroCardRef = useRef(null)
  const targetHudRef = useRef(hudStats)
  const smoothHudRef = useRef(hudStats)

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

  useEffect(() => {
    if (!startTyping) return undefined

    const interval = setInterval(() => {
      setHudStats((prev) => ({
        ping: Math.round(clampStat(prev.ping + (Math.random() * 8 - 4), 16, 48)),
        fps: Math.round(clampStat(prev.fps + (Math.random() * 12 - 5), 118, 164)),
        cpu: Math.round(clampStat(prev.cpu + (Math.random() * 12 - 5), 18, 74)),
        memory: Math.round(clampStat(prev.memory + (Math.random() * 10 - 4), 32, 80)),
        signal: Math.round(clampStat(prev.signal + (Math.random() * 8 - 3), 62, 98)),
      }))
    }, 2200)

    return () => clearInterval(interval)
  }, [startTyping])

  useEffect(() => {
    targetHudRef.current = hudStats
  }, [hudStats])

  useEffect(() => {
    if (!startTyping) return undefined

    let rafId
    let lastFrame = performance.now()
    let lastRender = 0
    let lastGraphSample = 0

    const tick = (now) => {
      const dt = Math.min(now - lastFrame, 80)
      lastFrame = now

      const current = smoothHudRef.current
      const target = targetHudRef.current
      const ease = 1 - Math.pow(0.03, dt / 1000)

      const next = {
        ping: current.ping + (target.ping - current.ping) * ease,
        fps: current.fps + (target.fps - current.fps) * ease,
        cpu: current.cpu + (target.cpu - current.cpu) * ease,
        memory: current.memory + (target.memory - current.memory) * ease,
        signal: current.signal + (target.signal - current.signal) * ease,
      }
      smoothHudRef.current = next

      if (now - lastRender > 80) {
        setSmoothHudStats(next)
        lastRender = now
      }

      if (now - lastGraphSample > 850) {
        setHudHistory((prev) => [...prev.slice(-23), next])
        lastGraphSample = now
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [startTyping])

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

  const displayStats = useMemo(
    () => ({
      ping: Math.round(smoothHudStats.ping),
      fps: Math.round(smoothHudStats.fps),
      cpu: Math.round(smoothHudStats.cpu),
      memory: Math.round(smoothHudStats.memory),
      signal: Math.round(smoothHudStats.signal),
    }),
    [smoothHudStats],
  )
  const graphSeries = useMemo(() => buildGraphSeries(hudHistory), [hudHistory])
  const graphPath = useMemo(() => buildGraphPath(graphSeries), [graphSeries])
  const graphFillPath = useMemo(
    () => buildGraphFillPath(graphPath),
    [graphPath],
  )
  const telemetryDelta = useMemo(() => {
    const previous = hudHistory[hudHistory.length - 2] || smoothHudStats
    const currentLoad = getTelemetryLoad(smoothHudStats, previous)
    const previousLoad = getTelemetryLoad(previous, hudHistory[hudHistory.length - 3])
    return Math.round(currentLoad - previousLoad)
  }, [hudHistory, smoothHudStats])

  // Keep presence for the status dot; chips are curated.
  const handleHeroPointerMove = (event) => {
    const card = heroCardRef.current
    if (!card || event.pointerType === 'touch') return

    const rect = card.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height
    const tiltY = (x - 0.5) * 8
    const tiltX = (0.5 - y) * 7

    card.style.setProperty('--hero-tilt-x', `${tiltX.toFixed(2)}deg`)
    card.style.setProperty('--hero-tilt-y', `${tiltY.toFixed(2)}deg`)
    card.style.setProperty('--hero-glow-x', `${(x * 100).toFixed(1)}%`)
    card.style.setProperty('--hero-glow-y', `${(y * 100).toFixed(1)}%`)
  }

  const resetHeroParallax = () => {
    const card = heroCardRef.current
    if (!card) return
    card.style.setProperty('--hero-tilt-x', '0deg')
    card.style.setProperty('--hero-tilt-y', '0deg')
    card.style.setProperty('--hero-glow-x', '50%')
    card.style.setProperty('--hero-glow-y', '50%')
  }

  return (
    <section id="home" className="section-shell">
      <div className="hero-grid">
        {/* Profile panel */}
        <div
          ref={heroCardRef}
          className="hero-card"
          onPointerMove={handleHeroPointerMove}
          onPointerLeave={resetHeroParallax}
        >
          <div className="hero-card-bg" aria-hidden="true" />

          {/* Split layout: text up top, meta down below */}
          <div className="hero-card-content relative z-10 flex h-full min-h-[clamp(420px,60vh,560px)] flex-col">
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
                <div className="terminal-micro-row mt-3" aria-hidden="true">
                  <span>{`ping:${displayStats.ping}ms`}</span>
                  <span>signal:live</span>
                  <span>xp:+12</span>
                </div>
              </div>
            </div>

            {/* Typed text: centered in the big top box */}
            <div className="flex flex-1 items-center justify-center px-3 sm:px-6">
              <div className="hero-center-stack w-full max-w-[48ch]">
                <p className="hero-tagline mt-0 text-center">
                  <span>{tagline || (startTyping ? '' : TAGLINE_TEXT)}</span>
                  {!hasTyped && startTyping && (
                    <span className="ml-[2px] inline-block h-4 w-[2px] align-middle bg-slate-100/70 animate-pulse" />
                  )}
                </p>

                <div className="hero-system-panel" aria-hidden="true">
                  <div className="hero-system-panel-top">
                    <span>sys.monitor</span>
                    <span>{displayStats.ping < 34 ? 'stable' : 'spike'}</span>
                  </div>
                  <div className="hero-meter-row">
                    <span>cpu</span>
                    <span className="hero-meter-track">
                      <span style={{ '--meter': `${smoothHudStats.cpu}%` }} />
                    </span>
                    <span>{displayStats.cpu}%</span>
                  </div>
                  <div className="hero-meter-row">
                    <span>mem</span>
                    <span className="hero-meter-track">
                      <span style={{ '--meter': `${smoothHudStats.memory}%` }} />
                    </span>
                    <span>{displayStats.memory}%</span>
                  </div>
                  <div className="hero-telemetry-graph">
                    <svg
                      viewBox="0 0 260 58"
                      role="img"
                      aria-label="Live system telemetry graph"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient id="heroGraphLine" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#00ffe5" />
                          <stop offset="54%" stopColor="#ff2bd6" />
                          <stop offset="100%" stopColor="#ffb627" />
                        </linearGradient>
                        <linearGradient id="heroGraphFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#00ffe5" stopOpacity="0.26" />
                          <stop offset="62%" stopColor="#ff2bd6" stopOpacity="0.10" />
                          <stop offset="100%" stopColor="#06080f" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <g className="hero-graph-grid">
                        <path d="M0 14 H260 M0 29 H260 M0 44 H260" />
                        <path d="M32 0 V58 M97 0 V58 M162 0 V58 M227 0 V58" />
                      </g>
                      <path
                        className="hero-graph-fill"
                        d={graphFillPath}
                      />
                      <path
                        className="hero-graph-line hero-graph-line-ghost"
                        d={graphPath}
                      />
                      <path
                        className="hero-graph-line"
                        d={graphPath}
                      />
                    </svg>
                    <div className="hero-telemetry-footer" aria-hidden="true">
                      <span>packets:{displayStats.fps + displayStats.signal}</span>
                      <span>{`delta:${telemetryDelta >= 0 ? '+' : ''}${telemetryDelta}%`}</span>
                      <span>jitter:{Math.max(1, Math.round(displayStats.ping / 6))}ms</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* “Everything else” goes to the bottom area */}
            <div className="mt-auto border-t border-white/10 pt-4">
              <div className="hero-console-strip" aria-hidden="true">
                <span>{`render:${displayStats.fps}fps`}</span>
                <span>boot.ok</span>
                <span>mood:night-run</span>
              </div>
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
            <div className="terminal-readout-grid" aria-hidden="true">
              <span>queue:03</span>
              <span>jobs:online</span>
              <span>{`net:${displayStats.signal}%`}</span>
            </div>
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
            <div className="terminal-readout-grid terminal-readout-grid-compact" aria-hidden="true">
              <span>deps:cached</span>
              <span>latency:low</span>
            </div>
          </div>

          <VibeCard />
        </div>
      </div>
    </section>
  )
}

function VibeCard() {
  return (
    <div className="bento-card vibe-card">
      <img
        src={peachCard}
        alt=""
        className="vibe-bg"
        loading="lazy"
      />
      <div className="relative z-10">
        <p className="bento-kicker">// vibe.cfg</p>
        <p className="bento-title">CRT glow · neon · lo-fi loops</p>
        <p className="bento-text">
          Estética terminal, pixel art y RGB suave. Como si tu IDE
          viviera dentro de una arcade.
        </p>
        <div className="terminal-readout-grid terminal-readout-grid-compact" aria-hidden="true">
          <span>crt:on</span>
          <span>lofi:loop</span>
        </div>
      </div>
    </div>
  )
}
