import React, { useEffect, useRef, useState } from 'react'

/**
 * Fireflies background
 * - Luciérnagas que aparecen, se mueven y desaparecen con fade suave
 * - Huyen del mouse cuando este se acerca
 * - Colores tomados del degradado de fondo (cyan / rosa) para encajar con el tema
 */

let FIREFLY_ID = 0

function createFirefly(viewport, now) {
  const w = viewport.w || window.innerWidth || 0
  const h = viewport.h || window.innerHeight || 0

  // vida más larga para que el fade se note (ms)
  const life = 24000 + Math.random() * 18000 // 24–42s

  return {
    id: `firefly-${FIREFLY_ID++}`,
    x: Math.random() * w,
    y: Math.random() * h,
    // movimiento lento y suave
    // movimiento más lento y flotante
    vx: (Math.random() - 0.3) * 0.2,
    vy: (Math.random() - 0.3) * 0.2,
    size: 1.2 + Math.random() * 1.8,
    life,
    createdAt: now,
    // parpadeo suave (se usa en CSS)
    flicker: 7 + Math.random() * 4,
    delay: Math.random() * -8,
    alpha: 0,
    progress: 0,
  }
}

function updateFireflies(prev, { timestamp, dtFactor, viewport, mouse, count }) {
  const maxSpeed = 0.10
  const wanderStrength = 0.004 // qué tanto cambian de dirección
  const mouseRadius = 120
  const mouseRadiusSq = mouseRadius * mouseRadius
  const repelStrength = 0.06

  const updated = []

  for (const f of prev) {
    const age = timestamp - f.createdAt

    // si ya terminó su vida lo dejamos ir (se repondrá luego)
    if (age >= f.life) {
      continue
    }

    let progress = age / f.life
    if (progress < 0) progress = 0
    if (progress > 1) progress = 1

    // fade in / fade out muy suave según la vida
    let alpha
    if (progress < 0.25) {
      // 0 → 0.25 de la vida: aparecer
      alpha = progress / 0.25
    } else if (progress > 0.75) {
      // 0.75 → 1: desaparecer
      alpha = (1 - progress) / 0.25
    } else {
      alpha = 1
    }

    let { x, y, vx, vy } = f

    // repulsión del mouse
    if (mouse.x != null && mouse.y != null) {
      const dx = x - mouse.x
      const dy = y - mouse.y
      const distSq = dx * dx + dy * dy

      if (distSq > 0.0001 && distSq < mouseRadiusSq) {
        const dist = Math.sqrt(distSq)
        const force = (mouseRadiusSq - distSq) / mouseRadiusSq
        vx += (dx / dist) * force * repelStrength
        vy += (dy / dist) * force * repelStrength
      }
    }

    // pequeño movimiento aleatorio para que no sigan una línea recta
    vx += (Math.random() - 0.5) * wanderStrength
    vy += (Math.random() - 0.5) * wanderStrength

    // limitar velocidad máxima
    const speed = Math.hypot(vx, vy)
    if (speed > maxSpeed) {
      vx = (vx / speed) * maxSpeed
      vy = (vy / speed) * maxSpeed
    }

    // aplicar movimiento (dtFactor hace que se vean suaves aunque baje el FPS)
    const speedScale = 15 // velocidad global más lenta
    x += vx * dtFactor * speedScale
    y += vy * dtFactor * speedScale

    const w = viewport.w || window.innerWidth || 0
    const h = viewport.h || window.innerHeight || 0

    // envolver bordes para que nunca desaparezcan por salirse de pantalla
    const margin = 40
    if (x < -margin) x = w + margin
    else if (x > w + margin) x = -margin
    if (y < -margin) y = h + margin
    else if (y > h + margin) y = -margin

    updated.push({
      ...f,
      x,
      y,
      vx,
      vy,
      alpha,
      progress,
    })
  }

  // crear nuevas para mantener siempre el mismo número
  const missing = Math.max(0, count - updated.length)
  const now = timestamp
  for (let i = 0; i < missing; i++) {
    updated.push(createFirefly(viewport, now))
  }

  return updated
}

export default function Fireflies() {
  const [fireflies, setFireflies] = useState([])
  const mouseRef = useRef({ x: null, y: null })
  const viewportRef = useRef({ w: 0, h: 0 })
  const lastTimeRef = useRef(null)

  const NUM_FIREFLIES = 34

  useEffect(() => {
    const updateViewport = () => {
      viewportRef.current = {
        w: window.innerWidth,
        h: window.innerHeight,
      }
    }

    updateViewport()

    const handleMouseMove = (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }

    const handleMouseLeave = () => {
      mouseRef.current = { x: null, y: null }
    }

    window.addEventListener('resize', updateViewport)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseleave', handleMouseLeave)

    const now = (typeof performance !== 'undefined' && performance.now)
      ? performance.now()
      : Date.now()

    // iniciar con un grupo de luciérnagas ya activas
    setFireflies(() => {
      const initial = []
      for (let i = 0; i < NUM_FIREFLIES; i++) {
        // damos un "offset" a createdAt para que no todas estén en el mismo punto del fade
        const offsetNow = now - Math.random() * 8000
        initial.push(createFirefly(viewportRef.current, offsetNow))
      }
      return initial
    })

    let rafId

    const tick = (timestamp) => {
      if (lastTimeRef.current == null) {
        lastTimeRef.current = timestamp
      }
      const dt = timestamp - lastTimeRef.current
      lastTimeRef.current = timestamp

      // normalizar dt a algo razonable por si hay lag
      const dtFactor = Math.min(Math.max(dt / 16.67, 0.4), 2.2)

      setFireflies((prev) =>
        updateFireflies(prev, {
          timestamp,
          dtFactor,
          viewport: viewportRef.current,
          mouse: mouseRef.current,
          count: NUM_FIREFLIES,
        }),
      )

      rafId = window.requestAnimationFrame(tick)
    }

    rafId = window.requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('resize', updateViewport)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
      if (rafId) {
        window.cancelAnimationFrame(rafId)
      }
    }
  }, [])

  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden="true"
    >
      {fireflies.map((f) => (
        <div
          key={f.id}
          className="firefly"
          style={{
            left: `${f.x}px`,
            top: `${f.y}px`,
            width: `${f.size * 4}px`,
            height: `${f.size * 4}px`,
            // alpha controlado en JS para que aparezcan / desaparezcan con fade suave
            opacity: f.alpha,
            animationDuration: `${f.flicker}s`,
            animationDelay: `${f.delay}s`,
          }}
        />
      ))}
    </div>
  )
}
