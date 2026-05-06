import React, { useEffect, useRef } from 'react'

const PALETTE = [
  {
    core: 'rgba(0, 255, 229, 0.95)',
    halo: 'rgba(0, 255, 229, 0.34)',
    trail: 'rgba(0, 255, 229, 0.26)',
  },
  {
    core: 'rgba(255, 43, 214, 0.95)',
    halo: 'rgba(255, 43, 214, 0.30)',
    trail: 'rgba(255, 43, 214, 0.24)',
  },
  {
    core: 'rgba(255, 182, 39, 0.9)',
    halo: 'rgba(255, 182, 39, 0.24)',
    trail: 'rgba(255, 182, 39, 0.20)',
  },
]

function createFirefly(width, height, now) {
  const color = PALETTE[Math.floor(Math.random() * PALETTE.length)]
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.45) * 0.12,
    vy: (Math.random() - 0.45) * 0.12,
    size: 1.3 + Math.random() * 2.1,
    life: 26000 + Math.random() * 18000,
    createdAt: now - Math.random() * 12000,
    flickerOffset: Math.random() * Math.PI * 2,
    trailLength: 16 + Math.random() * 30,
    color,
  }
}

export default function Fireflies() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (motionQuery?.matches) return undefined

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return undefined

    const fireflies = []
    const mouse = { x: null, y: null }
    const viewport = { width: 0, height: 0, dpr: 1, count: 0 }
    let rafId = 0
    let lastFrame = performance.now()
    let lastDraw = 0
    let scrollingUntil = 0

    const computeCount = () => {
      const width = window.innerWidth || 1024
      if (width < 420) return 10
      if (width < 768) return 16
      return 24
    }

    const resize = () => {
      viewport.width = window.innerWidth || 1
      viewport.height = window.innerHeight || 1
      viewport.dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      viewport.count = computeCount()

      canvas.width = Math.ceil(viewport.width * viewport.dpr)
      canvas.height = Math.ceil(viewport.height * viewport.dpr)
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`
      ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0)

      const now = performance.now()
      while (fireflies.length < viewport.count) {
        fireflies.push(createFirefly(viewport.width, viewport.height, now))
      }
      fireflies.length = viewport.count
    }

    const handlePointerMove = (event) => {
      mouse.x = event.clientX
      mouse.y = event.clientY
    }

    const clearMouse = () => {
      mouse.x = null
      mouse.y = null
    }

    const markScrolling = () => {
      scrollingUntil = performance.now() + 180
    }

    const updateFirefly = (firefly, now, dtFactor) => {
      const age = now - firefly.createdAt
      if (age >= firefly.life) {
        Object.assign(firefly, createFirefly(viewport.width, viewport.height, now))
      }

      const progress = Math.min(Math.max((now - firefly.createdAt) / firefly.life, 0), 1)
      let alpha = 1
      if (progress < 0.25) alpha = progress / 0.25
      if (progress > 0.75) alpha = (1 - progress) / 0.25

      if (mouse.x != null && mouse.y != null) {
        const dx = firefly.x - mouse.x
        const dy = firefly.y - mouse.y
        const distSq = dx * dx + dy * dy
        const radiusSq = 120 * 120
        if (distSq > 0.001 && distSq < radiusSq) {
          const dist = Math.sqrt(distSq)
          const force = (radiusSq - distSq) / radiusSq
          firefly.vx += (dx / dist) * force * 0.035
          firefly.vy += (dy / dist) * force * 0.035
        }
      }

      firefly.vx += (Math.random() - 0.5) * 0.0025
      firefly.vy += (Math.random() - 0.5) * 0.0025

      const speed = Math.hypot(firefly.vx, firefly.vy)
      if (speed > 0.085) {
        firefly.vx = (firefly.vx / speed) * 0.085
        firefly.vy = (firefly.vy / speed) * 0.085
      }

      firefly.x += firefly.vx * dtFactor * 15
      firefly.y += firefly.vy * dtFactor * 15

      const margin = 42
      if (firefly.x < -margin) firefly.x = viewport.width + margin
      else if (firefly.x > viewport.width + margin) firefly.x = -margin
      if (firefly.y < -margin) firefly.y = viewport.height + margin
      else if (firefly.y > viewport.height + margin) firefly.y = -margin

      return alpha
    }

    const drawFirefly = (firefly, alpha, now) => {
      const flicker = 0.72 + Math.sin(now / 850 + firefly.flickerOffset) * 0.18
      const opacity = Math.max(0, alpha * flicker)
      const radius = firefly.size * 2.5
      const angle = Math.atan2(firefly.vy, firefly.vx)
      const trailX = Math.cos(angle) * firefly.trailLength
      const trailY = Math.sin(angle) * firefly.trailLength

      const trail = ctx.createLinearGradient(
        firefly.x - trailX,
        firefly.y - trailY,
        firefly.x,
        firefly.y,
      )
      trail.addColorStop(0, 'rgba(0, 0, 0, 0)')
      trail.addColorStop(1, firefly.color.trail)
      ctx.globalAlpha = opacity * 0.6
      ctx.strokeStyle = trail
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(firefly.x - trailX, firefly.y - trailY)
      ctx.lineTo(firefly.x, firefly.y)
      ctx.stroke()

      const glow = ctx.createRadialGradient(
        firefly.x,
        firefly.y,
        0,
        firefly.x,
        firefly.y,
        radius * 5,
      )
      glow.addColorStop(0, firefly.color.core)
      glow.addColorStop(0.22, firefly.color.halo)
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.globalAlpha = opacity
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(firefly.x, firefly.y, radius * 5, 0, Math.PI * 2)
      ctx.fill()

      ctx.globalAlpha = opacity
      ctx.fillStyle = firefly.color.core
      ctx.beginPath()
      ctx.arc(firefly.x, firefly.y, Math.max(1, radius * 0.45), 0, Math.PI * 2)
      ctx.fill()
    }

    const tick = (now) => {
      const dt = now - lastFrame
      lastFrame = now

      const targetFrameMs = now < scrollingUntil ? 1000 / 12 : 1000 / 24
      if (now - lastDraw >= targetFrameMs) {
        const dtFactor = Math.min(Math.max(dt / 16.67, 0.4), 2.2)
        ctx.clearRect(0, 0, viewport.width, viewport.height)
        ctx.globalCompositeOperation = 'lighter'

        for (const firefly of fireflies) {
          const alpha = updateFirefly(firefly, now, dtFactor)
          drawFirefly(firefly, alpha, now)
        }

        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = 'source-over'
        lastDraw = now
      }

      rafId = requestAnimationFrame(tick)
    }

    resize()
    rafId = requestAnimationFrame(tick)

    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerleave', clearMouse)
    window.addEventListener('scroll', markScrolling, { passive: true })

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerleave', clearMouse)
      window.removeEventListener('scroll', markScrolling)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="firefly-canvas pointer-events-none fixed inset-0 -z-10"
      aria-hidden="true"
    />
  )
}
