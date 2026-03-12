/**
 * ParticleVisualizer — Reactive nebula particle system.
 *
 * Floating orbs and particles react to audio frequency data:
 * - Bass energy drives large, slow-moving central orbs (deep purple/blue)
 * - Mid frequencies control medium swirling particles (teal/green)
 * - High frequencies spawn tiny shimmering sparks (white/cyan)
 * - Nearby particles form constellation-style connections
 * - Overall energy creates a pulsing background glow
 *
 * Designed to be beautiful even with low-energy ambient sounds.
 */

import { useEffect, useRef, useCallback } from 'react'
import { AudioContextManager } from '../audio/AudioContextManager'

interface ParticleVisualizerProps {
  isPlaying: boolean
  height?: number
}

// ── Particle type ──

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  baseRadius: number
  radius: number
  hue: number
  saturation: number
  lightness: number
  alpha: number
  band: 'bass' | 'mid' | 'high'
  phase: number
  orbitRadius: number
  orbitSpeed: number
  orbitAngle: number
  life: number
  pulseSpeed: number
}

const PARTICLE_COUNT = 70
const CONNECTION_DISTANCE = 90
const CONNECTION_ALPHA = 0.18

/** Create initial particle pool */
function createParticles(w: number, h: number): Particle[] {
  const particles: Particle[] = []
  const cx = w / 2
  const cy = h / 2

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const band = i < 12 ? 'bass' : i < 40 ? 'mid' : 'high'

    let baseRadius: number
    let hue: number
    let saturation: number
    let lightness: number
    let orbitRadius: number
    let orbitSpeed: number

    switch (band) {
      case 'bass':
        baseRadius = 6 + Math.random() * 10
        hue = 250 + Math.random() * 50       // purple/blue
        saturation = 65 + Math.random() * 25
        lightness = 50 + Math.random() * 20
        orbitRadius = 20 + Math.random() * w * 0.15
        orbitSpeed = 0.003 + Math.random() * 0.004
        break
      case 'mid':
        baseRadius = 3 + Math.random() * 5
        hue = 155 + Math.random() * 45       // teal/green
        saturation = 65 + Math.random() * 25
        lightness = 50 + Math.random() * 25
        orbitRadius = w * 0.08 + Math.random() * w * 0.28
        orbitSpeed = 0.004 + Math.random() * 0.008
        break
      case 'high':
        baseRadius = 1.5 + Math.random() * 3
        hue = 175 + Math.random() * 35       // cyan/white
        saturation = 40 + Math.random() * 40
        lightness = 70 + Math.random() * 25
        orbitRadius = w * 0.1 + Math.random() * w * 0.4
        orbitSpeed = 0.006 + Math.random() * 0.012
        break
    }

    const angle = Math.random() * Math.PI * 2
    particles.push({
      x: cx + Math.cos(angle) * orbitRadius,
      y: cy + Math.sin(angle) * orbitRadius,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      baseRadius,
      radius: baseRadius,
      hue,
      saturation,
      lightness,
      alpha: 0.5 + Math.random() * 0.5,  // higher base alpha
      band,
      phase: Math.random() * Math.PI * 2,
      orbitRadius,
      orbitSpeed: orbitSpeed * (Math.random() > 0.5 ? 1 : -1),
      orbitAngle: angle,
      life: 0.7 + Math.random() * 0.3,  // higher base life
      pulseSpeed: 0.5 + Math.random() * 2,
    })
  }

  return particles
}

/** Extract frequency band energies from analyser data */
function getBandEnergies(dataArray: Uint8Array, bufferLength: number) {
  let sub = 0
  for (let i = 0; i < 4; i++) sub += dataArray[i]
  sub = sub / (4 * 255)

  let bass = 0
  for (let i = 3; i < 12; i++) bass += dataArray[i]
  bass = bass / (9 * 255)

  let lowMid = 0
  for (let i = 12; i < 24; i++) lowMid += dataArray[i]
  lowMid = lowMid / (12 * 255)

  let mid = 0
  for (let i = 24; i < 93; i++) mid += dataArray[i]
  mid = mid / (69 * 255)

  let highMid = 0
  for (let i = 93; i < Math.min(bufferLength, 280); i++) highMid += dataArray[i]
  highMid = highMid / (Math.min(bufferLength, 280) - 93 || 1) / 255

  let high = 0
  const maxBin = Math.min(bufferLength, 930)
  for (let i = Math.min(280, bufferLength); i < maxBin; i++) high += dataArray[i]
  high = high / ((maxBin - Math.min(280, bufferLength)) || 1) / 255

  const energy = sub * 0.25 + bass * 0.25 + lowMid * 0.15 + mid * 0.15 + highMid * 0.1 + high * 0.1

  return { sub, bass, lowMid, mid, highMid, high, energy }
}

export function ParticleVisualizer({
  isPlaying,
  height = 160,
}: ParticleVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)
  const particlesRef = useRef<Particle[]>([])
  const timeRef = useRef(0)
  const smoothedEnergyRef = useRef(0)
  const dimensionsRef = useRef({ w: 0, h: 0 })

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr

    dimensionsRef.current = { w, h }

    if (w === 0 || h === 0) {
      animFrameRef.current = requestAnimationFrame(draw)
      return
    }

    const manager = AudioContextManager.getInstance()

    let bands = { sub: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, high: 0, energy: 0 }

    if (manager.isInitialized()) {
      const analyser = manager.getAnalyser()
      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      analyser.getByteFrequencyData(dataArray)
      bands = getBandEnergies(dataArray, bufferLength)
    }

    // Smooth overall energy
    smoothedEnergyRef.current += (bands.energy - smoothedEnergyRef.current) * 0.06

    const time = timeRef.current
    timeRef.current += 1
    const cx = w / 2
    const cy = h / 2
    const particles = particlesRef.current

    // ── Clear with very gentle trailing fade (long motion trails) ──
    ctx.fillStyle = 'rgba(8, 8, 18, 0.08)'
    ctx.fillRect(0, 0, w, h)

    // ── Ambient background glow (always visible, pulses with energy) ──
    const baseGlowAlpha = 0.03 + smoothedEnergyRef.current * 0.12
    const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.55)
    bgGrad.addColorStop(0, `hsla(260, 50%, 25%, ${baseGlowAlpha})`)
    bgGrad.addColorStop(0.4, `hsla(200, 40%, 15%, ${baseGlowAlpha * 0.6})`)
    bgGrad.addColorStop(0.7, `hsla(180, 30%, 10%, ${baseGlowAlpha * 0.3})`)
    bgGrad.addColorStop(1, 'transparent')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, w, h)

    // ── Update & draw particles ──
    for (const p of particles) {
      let bandEnergy: number
      switch (p.band) {
        case 'bass':
          bandEnergy = Math.max(bands.sub, bands.bass)
          break
        case 'mid':
          bandEnergy = Math.max(bands.lowMid, bands.mid)
          break
        case 'high':
          bandEnergy = Math.max(bands.highMid, bands.high)
          break
      }

      // Orbit motion — always moving, faster with energy
      p.orbitAngle += p.orbitSpeed * (1 + bandEnergy * 3)
      const aspectRatio = h / w
      const targetX = cx + Math.cos(p.orbitAngle) * p.orbitRadius
      const targetY = cy + Math.sin(p.orbitAngle) * (p.orbitRadius * aspectRatio)

      // Gentle drift toward orbit position
      p.x += (targetX - p.x) * 0.03 + p.vx
      p.y += (targetY - p.y) * 0.03 + p.vy

      // Subtle noise drift
      p.vx += (Math.random() - 0.5) * 0.03
      p.vy += (Math.random() - 0.5) * 0.03
      p.vx *= 0.97
      p.vy *= 0.97

      // Pulse radius — always pulsing, amplified by audio
      const pulse = Math.sin(time * 0.025 * p.pulseSpeed + p.phase)
      const audioPulse = bandEnergy * 4
      p.radius = p.baseRadius * (1 + pulse * 0.25 + audioPulse)

      // Breathing alpha — always breathing, boosted by audio
      const breathe = 0.6 + Math.sin(time * 0.018 + p.phase) * 0.25
      const alphaBoost = bandEnergy * 1.5
      const currentAlpha = Math.min(1, p.alpha * breathe * p.life + alphaBoost)

      // Lightness boost with energy
      const currentLightness = Math.min(95, p.lightness + bandEnergy * 30)

      // ── Draw particle ──
      if (p.radius > 0.3 && currentAlpha > 0.01) {
        // Outer glow halo
        const glowSize = p.radius * (2.5 + bandEnergy * 5)

        if (glowSize > 1) {
          const glow = ctx.createRadialGradient(
            p.x, p.y, 0,
            p.x, p.y, glowSize
          )
          glow.addColorStop(0, `hsla(${p.hue}, ${p.saturation}%, ${currentLightness}%, ${currentAlpha * 0.5})`)
          glow.addColorStop(0.3, `hsla(${p.hue}, ${p.saturation}%, ${currentLightness - 5}%, ${currentAlpha * 0.25})`)
          glow.addColorStop(0.6, `hsla(${p.hue}, ${p.saturation - 10}%, ${currentLightness - 15}%, ${currentAlpha * 0.08})`)
          glow.addColorStop(1, 'transparent')

          ctx.fillStyle = glow
          ctx.beginPath()
          ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2)
          ctx.fill()
        }

        // Bright core
        const coreAlpha = Math.min(1, currentAlpha * 0.95)
        ctx.fillStyle = `hsla(${p.hue}, ${Math.max(0, p.saturation - 15)}%, ${Math.min(95, currentLightness + 20)}%, ${coreAlpha})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, Math.max(0.8, p.radius * 0.4), 0, Math.PI * 2)
        ctx.fill()

        // Hot center point for bass/mid particles
        if (p.band !== 'high' && p.radius > 3) {
          ctx.fillStyle = `hsla(${p.hue + 20}, 30%, 95%, ${coreAlpha * 0.7})`
          ctx.beginPath()
          ctx.arc(p.x, p.y, Math.max(0.5, p.radius * 0.15), 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    // ── Draw connections between nearby bass/mid particles ──
    ctx.lineWidth = 0.6
    const connectionEnergyBoost = 1 + smoothedEnergyRef.current * 5
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i]
      if (a.band === 'high') continue

      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j]
        if (b.band === 'high') continue

        const dx = a.x - b.x
        const dy = a.y - b.y
        const distSq = dx * dx + dy * dy

        if (distSq < CONNECTION_DISTANCE * CONNECTION_DISTANCE) {
          const dist = Math.sqrt(distSq)
          const alpha = (1 - dist / CONNECTION_DISTANCE) * CONNECTION_ALPHA * connectionEnergyBoost

          if (alpha > 0.008) {
            const midHue = (a.hue + b.hue) / 2
            ctx.strokeStyle = `hsla(${midHue}, 50%, 65%, ${Math.min(0.4, alpha)})`
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }
    }

    // ── Occasional spark flash on bass/mid transients ──
    const combinedBass = (bands.sub + bands.bass) / 2
    if (combinedBass > 0.35 && Math.random() < 0.15) {
      const sparkX = cx + (Math.random() - 0.5) * w * 0.5
      const sparkY = cy + (Math.random() - 0.5) * h * 0.5
      const sparkRadius = 8 + combinedBass * 25

      const sparkGrad = ctx.createRadialGradient(
        sparkX, sparkY, 0,
        sparkX, sparkY, sparkRadius
      )
      sparkGrad.addColorStop(0, `hsla(180, 80%, 85%, ${0.15 + combinedBass * 0.2})`)
      sparkGrad.addColorStop(0.4, `hsla(200, 70%, 60%, ${0.06 + combinedBass * 0.08})`)
      sparkGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = sparkGrad
      ctx.beginPath()
      ctx.arc(sparkX, sparkY, sparkRadius, 0, Math.PI * 2)
      ctx.fill()
    }

    animFrameRef.current = requestAnimationFrame(draw)
  }, [])

  // ── Canvas resize ──
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect
        if (width === 0) return
        const dpr = window.devicePixelRatio || 1
        canvas.width = width * dpr
        canvas.height = height * dpr
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.scale(dpr, dpr)
        }
        particlesRef.current = createParticles(width, height)
        dimensionsRef.current = { w: width, h: height }
      }
    })
    resizeObserver.observe(canvas.parentElement || canvas)

    return () => resizeObserver.disconnect()
  }, [height])

  // ── Animation loop ──
  useEffect(() => {
    if (isPlaying) {
      const { w, h } = dimensionsRef.current
      if (particlesRef.current.length === 0 && w > 0) {
        particlesRef.current = createParticles(w, h)
      }
      timeRef.current = 0
      smoothedEnergyRef.current = 0
      animFrameRef.current = requestAnimationFrame(draw)
    }
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [isPlaying, draw])

  return (
    <div className="w-full overflow-hidden rounded-xl" style={{ height }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: 'block' }}
      />
    </div>
  )
}

export default ParticleVisualizer
