import React, { useEffect, useState } from 'react'
import peachCard from '../assets/dai-peach-card.png'

const DISCORD_ID = import.meta.env.VITE_DISCORD_ID || '271701484922601472'

const TAGLINE_TEXT =
  'SysBot enjoyer · VRChat lover · wanderer de Fallout.\nProgramo bots y automatizaciones para juegos y vivo rotando entre VRChat, Minecraft, ARK y otros mundos digitales con lofi y anime de fondo. 🎮🌙✨';

const STATUS_MAP = {
  online: {
    label: 'En línea',
    chipClass: 'bg-emerald-500/20 text-emerald-200',
    dotClass: 'bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.85)]',
  },
  idle: {
    label: 'Ausente',
    chipClass: 'bg-amber-400/15 text-amber-200',
    dotClass: 'bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.85)]',
  },
  dnd: {
    label: 'No molestar',
    chipClass: 'bg-rose-500/20 text-rose-200',
    dotClass: 'bg-rose-500 shadow-[0_0_16px_rgba(244,63,94,0.95)]',
  },
  offline: {
    label: 'Offline',
    chipClass: 'bg-slate-600/25 text-slate-300',
    dotClass: 'bg-slate-500 shadow-[0_0_10px_rgba(148,163,184,0.75)]',
  },
}


const RANDOM_CHARS = 'asdfghjklqwertyuiopzxcvbnm1234567890?!';

function buildTypingFrames(text) {
  const frames = []
  let current = ''

  // Separar el texto en tokens (palabras + espacios/newlines)
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

  // Elegir algunas palabras aleatorias donde cometer errores
  const candidateWordIndexes = tokens
    .map((tok, idx) => ({ tok, idx }))
    .filter(
      (t) =>
        t.tok !== ' ' &&
        t.tok !== '\n' &&
        t.tok.length > 3 // palabras un poco largas
    )
    .map((t) => t.idx)

  const maxMistakes = 3
  const mistakesCount = Math.min(
    maxMistakes,
    Math.max(0, candidateWordIndexes.length > 0 ? 2 : 0)
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
    if (word.length <= 2) {
      return word.split('').reverse().join('')
    }

    let result = word
    let attempts = 0

    while (result === word && attempts < 5) {
      const chars = word.split('')
      const swaps = Math.min(2, Math.max(1, Math.floor(word.length / 3)))

      for (let s = 0; s < swaps; s++) {
        const i = Math.floor(Math.random() * chars.length)
        let j = Math.floor(Math.random() * chars.length)
        if (j === i) {
          j = (j + 1) % chars.length
        }
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

    // si es un espacio o salto de línea, solo escribimos normal
    if (token === ' ' || token === '\n') {
      typeToken(token)
      continue
    }

    if (mistakeIndexes.has(i)) {
      // escribir una palabra equivocada completa
      const wrong = makeMistake(token)
      typeToken(wrong)

      // retroceder palabra equivocada (backspace)
      for (let j = 0; j < wrong.length; j++) {
        current = current.slice(0, -1)
        frames.push(current)
      }

      // ahora escribir la palabra correcta
      typeToken(token)
    } else {
      // escribir palabra normal
      typeToken(token)
    }
  }

  if (frames.length === 0) frames.push('')
  return frames
}

export default function Hero({ startTyping }) {
  const [presence, setPresence] = useState(null)
  const [tagline, setTagline] = useState('')
  const [hasTyped, setHasTyped] = useState(false)


  useEffect(() => {
    const fetchPresence = async () => {
      try {
        const res = await fetch(`https://api.lanyard.rest/v1/users/${DISCORD_ID}`)
        const json = await res.json()
        if (json?.success && json.data?.discord_status) {
          setPresence(json.data.discord_status)
        } else {
          setPresence(null)
        }
      } catch (err) {
        console.error(err)
        setPresence(null)
      }
    }

    fetchPresence()
    const id = setInterval(fetchPresence, 15000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!startTyping || hasTyped) return

    const frames = buildTypingFrames(TAGLINE_TEXT)
    let step = 0

    const interval = setInterval(() => {
      setTagline(frames[step])
      step += 1

      if (step >= frames.length) {
        clearInterval(interval)
        setHasTyped(true)
      }
    }, 60)

    return () => clearInterval(interval)
  }, [startTyping, hasTyped])


  const statusKey = presence && STATUS_MAP[presence] ? presence : 'offline'
  const status = STATUS_MAP[statusKey]

  return (
    <section className="section-shell pt-10" id="about">
      <div className="section-card">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:items-center">
          {/* Texto principal */}
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
              Hola, soy
            </p>
            <h1 className="text-3xl font-semibold sm:text-4xl md:text-5xl">
              <span className="bg-gradient-to-r from-sky-400 via-emerald-300 to-fuchsia-400 bg-clip-text text-transparent">
                Dai
              </span>
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-slate-300 font-mono">
              <span>{tagline}</span>
              {!hasTyped && startTyping && (
                <span className="ml-[2px] inline-block h-4 w-[2px] align-middle bg-slate-100/70 animate-pulse" />
              )}
            </p>

            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="tag-chip">Full-stack dev</span>
			  <span className="tag-chip">Sysbot</span>
              <span className="tag-chip">Discord bots</span>
              <span className="tag-chip">Fallout &amp; Minecraft</span>
            </div>
          </div>

          {/* Tarjeta Peach / Discord */}
          <div className="relative">
            <div className="absolute -inset-6 blur-3xl opacity-60 bg-[conic-gradient(from_180deg_at_50%_50%,#22c55e_0deg,#38bdf8_90deg,#a855f7_180deg,#ec4899_270deg,#22c55e_360deg)]" />

            <div className="relative overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-950/80 shadow-[0_24px_80px_rgba(15,23,42,0.95)]">
              {/* Fondo degradado */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(56,189,248,0.35),transparent_55%),radial-gradient(circle_at_100%_0%,rgba(236,72,153,0.35),transparent_55%),radial-gradient(circle_at_0%_100%,rgba(52,211,153,0.35),transparent_55%)] opacity-80" />

              {/* Imagen principal */}
              <div className="relative flex flex-col">
                <div className="relative flex items-center justify-center pt-6">
                  <img
                    src={peachCard}
                    alt="Dai / avatar"
                    className="relative z-10 max-h-64 w-auto drop-shadow-[0_0_40px_rgba(15,23,42,0.95)]"
                  />
                  {/* Orbe de estado */}
                  <div className="absolute right-6 top-6 h-4 w-4 rounded-full bg-slate-900/80 shadow-inner">
                    <div className={`status-orb-inner ${status.dotClass}`} />
                  </div>
                </div>

                {/* Footer de la tarjeta */}
                <div className="relative mt-4 border-t border-slate-800/70 bg-slate-950/80 px-5 py-4">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-semibold text-slate-100">Dai</p>
                      <p className="text-[11px] text-slate-300">
                        Construyendo cosas y rompiéndolas otra vez ✨
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-medium ${status.chipClass}`}
                    >
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${status.dotClass}`}
                      />
                      {status.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
