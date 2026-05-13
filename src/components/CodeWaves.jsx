import { useMemo } from 'react'

const SNIPPETS = [
  '// init.run()',
  'const sunset = true',
  '{ neon: 0x00ffe5 }',
  'console.log("vibes")',
  'return [synth]',
  'await dream()',
  '<sun.render />',
  'fn pulse() {}',
  '0x39ff14',
  'let wave = new Wave()',
  '// → horizon',
  'export { lofi }',
  'if (night) glow()',
  '~/synth.exe',
  'this.bend(0xff2bd6)',
  'i += 0x01',
  'while (dream)',
  'sun.set(magenta)',
  '// dai.vibes',
  'ctx.beginPath()',
  'await wave.cast()',
  'for (let n of stars)',
  'return synthwave',
  'palette.cycle()',
  'grid.scroll(--)',
  'def vibe(): pass',
  '// TODO: chill',
  'neon.fill(#ff2bd6)',
  'use std::night',
  'sun.angle = π',
  'try { listen() }',
  '0b0101_1010',
  'shader.compile()',
  '// 88 mph',
  'os.dream("lofi")',
  'class Synth {}',
  'self.glow += 1',
  'pixel(0xff,0x2b,0xd6)',
  '// signal: ok',
  'fetch("/horizon")',
  'mat4.rotate(grid)',
  'router.push("/sun")',
  'audio.gain = 0.2',
  'BPM = 84',
  'return { ok: 1 }',
  'use crate::wave',
  '// reticulating',
  '/^[a-z]+$/',
  'await delay(840)',
  'const { lofi } = sys',
  'ship_it()',
  '// boot.seq → 0xA1',
  'render(<Sunset />)',
  'sleep(16ms)',
  '// 808 → bass',
  'GLSL: gl_FragColor',
  'queue.push("vibe")',
  'this.scene.fog()',
  'kernel.idle = false',
  '0xCAFEBABE',
  'sync()',
  'export default sun',
  '// retro.exe loaded',
  'tween.to(midnight)',
  '@keyframes drift',
  'malloc(neon)',
  'while (true) glow()',
  'const grid = ∞',
  '// session: alive',
  'rgb(255, 43, 214)',
  'use synthwave::*',
  'await pixel.flush()',
  'self.dream(true)',
  'echo "vibes" >> /tmp',
  '// chill = chill + 1',
  'cargo run --neon',
  'export const lofi = 1',
  'sun.fade(0.42)',
  'router.match("/dream")',
  'pulse(0xff2bd6, 84)',
  'event.stopGravity()',
  '// 80s flashback',
  'ctx.fillStyle = "#fc1"',
  'return await waveform',
  'i32 sine = sin(t)',
  'subscribe(stars)',
  '/* keep dreaming */',
  'await audio.play()',
  '// neon.runtime',
  '#define VIBE 0xFF',
  'globalThis.cool = true',
  'arr.flatMap(stars)',
  '// rgb cycling',
  'midi.note(0x42)',
  'return ok(())',
  '// signal stable',
  'glow ?? "🌒"',
  'requestFrame(loop)',
  'cosmos.update(dt)',
  'fn drift() -> Wave',
  'mix(magenta, cyan)',
  '// 4:33 AM',
  'engine.tick(0x10)',
  'this.cast(neon)',
  '// vector field',
  'while (pulse--) {}',
  '#shader vec3',
  '// reticulating splines',
  'gpu.draw(stars)',
  '// /dev/null',
  'sun.beat(BPM)',
  'fn render_horizon()',
  'await sleep(80)',
  '0xDEADBEEF',
  '// looping forever',
  'crt.scanline++',
  'export { wave }',
  'fn pulse() -> u8',
  'console.warn("ok")',
  '// ✦ static.ok',
  'observable.from(sun)',
  'palette.shift()',
  '// frame: 0x4f5',
  'while (n != ∞)',
  'wave.amplitude = .8',
  'shader.uniform("u_t")',
  '// trace: clean',
  'cluster.boot()',
  '// neon.lattice',
  'self.angle += 0.01',
]

const COLORS = ['cyan', 'magenta', 'amber']
const COUNT = 60

function rand(min, max) {
  return Math.random() * (max - min) + min
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export default function CodeWaves() {
  const waves = useMemo(() => {
    return Array.from({ length: COUNT }, (_, i) => {
      const side = i % 2 === 0 ? 'left' : 'right'
      const startX = side === 'left' ? rand(4, 30) : rand(70, 96)
      const driftX = (side === 'left' ? -1 : 1) * rand(60, 180)
      const driftY = -rand(180, 380)
      return {
        id: `cw-${i}`,
        text: pick(SNIPPETS),
        color: pick(COLORS),
        startX,
        driftX,
        driftY,
        delay: rand(0, 16),
        duration: rand(14, 22),
        size: rand(10, 12.5),
      }
    })
  }, [])

  return (
    <div className="code-waves" aria-hidden="true">
      {waves.map((w) => (
        <span
          key={w.id}
          className={`code-wave code-wave-${w.color}`}
          style={{
            left: `${w.startX}%`,
            fontSize: `${w.size}px`,
            '--drift-x': `${w.driftX}px`,
            '--drift-y': `${w.driftY}px`,
            animationDelay: `${w.delay}s`,
            animationDuration: `${w.duration}s`,
          }}
        >
          {w.text}
        </span>
      ))}
    </div>
  )
}
