import React, { useEffect, useRef } from 'react'

/**
 * Snowfall canvas (lightweight)
 * - Se desactiva si el usuario tiene prefers-reduced-motion
 * - pointer-events: none
 */
export default function Snowfall() {
  const canvasRef = useRef(null)
  const rafRef = useRef(0)
  const flakesRef = useRef([])

  useEffect(() => {
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
      canvas.width = Math.floor(window.innerWidth * dpr)
      canvas.height = Math.floor(window.innerHeight * dpr)
      canvas.style.width = window.innerWidth + 'px'
      canvas.style.height = window.innerHeight + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()

    const rand = (a, b) => a + Math.random() * (b - a)

    const makeFlake = () => {
      const r = rand(0.8, 3.2)
      return {
        x: rand(0, window.innerWidth),
        y: rand(-window.innerHeight, 0),
        r,
        // Slower + softer fall (less distracting)
        // These velocities are treated as "per ~frame" and scaled by dt below.
        vy: rand(0.18, 0.75) + r * 0.035,
        vx: rand(-0.10, 0.10),
        drift: rand(0.00055, 0.0018),
        phase: rand(0, Math.PI * 2),
        alpha: rand(0.35, 0.95),
      }
    }

    const targetCount = Math.min(160, Math.max(70, Math.floor(window.innerWidth / 10)))
    flakesRef.current = Array.from({ length: targetCount }, makeFlake)

    let last = performance.now()

    const tick = (now) => {
      const dt = Math.min(32, now - last)
      last = now

      // Convert ms -> ~frames (assumes ~60fps)
      const t = dt / 16.6667

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

      // Slight glow
      ctx.save()
      ctx.shadowBlur = 10
      ctx.shadowColor = 'rgba(255,255,255,0.35)'

      const flakes = flakesRef.current
      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i]
        f.phase += f.drift * dt
        f.x += f.vx * t + Math.sin(f.phase) * 0.22
        f.y += f.vy * t

        if (f.y - f.r > window.innerHeight + 12) {
          flakes[i] = makeFlake()
          flakes[i].y = -12
          continue
        }

        if (f.x < -12) f.x = window.innerWidth + 12
        if (f.x > window.innerWidth + 12) f.x = -12

        ctx.beginPath()
        ctx.fillStyle = `rgba(255,255,255,${f.alpha})`
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.restore()
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-10"
      aria-hidden="true"
    />
  )
}
