/**
 * FrequencyBars — Animated frequency band bars with glow.
 *
 * Renders a set of vertical bars representing frequency energy bands,
 * with smooth animations and a bioluminescent glow effect.
 */

import { useEffect, useRef, useCallback } from 'react'
import { AudioContextManager } from '../audio/AudioContextManager'

interface FrequencyBarsProps {
  isPlaying: boolean
  height?: number
  barCount?: number
}

export function FrequencyBars({
  isPlaying,
  height = 100,
  barCount = 48,
}: FrequencyBarsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)
  const smoothedRef = useRef<Float32Array>(new Float32Array(barCount))

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const manager = AudioContextManager.getInstance()
    if (!manager.isInitialized()) {
      animFrameRef.current = requestAnimationFrame(draw)
      return
    }

    const analyser = manager.getAnalyser()
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    analyser.getByteFrequencyData(dataArray)

    const w = canvas.width
    const h = canvas.height
    const smoothed = smoothedRef.current

    // Clear
    ctx.clearRect(0, 0, w, h)

    const barWidth = (w / barCount) * 0.7
    const gap = (w / barCount) * 0.3

    for (let i = 0; i < barCount; i++) {
      // Map bar index to frequency bin (logarithmic scale for perceptual accuracy)
      const logMin = Math.log(1)
      const logMax = Math.log(bufferLength * 0.7)
      const logPos = logMin + (i / barCount) * (logMax - logMin)
      const binIndex = Math.min(Math.floor(Math.exp(logPos)), bufferLength - 1)

      // Average a few nearby bins for smoother look
      let sum = 0
      const range = Math.max(1, Math.floor(binIndex * 0.1))
      for (let j = Math.max(0, binIndex - range); j <= Math.min(bufferLength - 1, binIndex + range); j++) {
        sum += dataArray[j]
      }
      const rawValue = sum / (range * 2 + 1) / 255

      // Smooth with decay (bars fall slowly)
      smoothed[i] = Math.max(rawValue, smoothed[i] * 0.92)
      const value = smoothed[i]

      const barHeight = value * h * 0.9
      const x = i * (barWidth + gap) + gap / 2
      const y = h - barHeight

      // Color gradient: teal → glow → bright
      const hue = 160 - value * 30 // 160 (teal) to 130 (green)
      const sat = 70 + value * 30
      const light = 40 + value * 30

      // Bar glow
      ctx.shadowColor = `hsl(${hue}, ${sat}%, ${light}%)`
      ctx.shadowBlur = value * 12

      // Gradient fill
      const gradient = ctx.createLinearGradient(x, y, x, h)
      gradient.addColorStop(0, `hsla(${hue}, ${sat}%, ${light + 10}%, 0.9)`)
      gradient.addColorStop(1, `hsla(${hue}, ${sat}%, ${light - 10}%, 0.4)`)

      ctx.fillStyle = gradient
      ctx.beginPath()
      // Rounded top
      const radius = Math.min(barWidth / 2, 3)
      ctx.moveTo(x + radius, y)
      ctx.lineTo(x + barWidth - radius, y)
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius)
      ctx.lineTo(x + barWidth, h)
      ctx.lineTo(x, h)
      ctx.lineTo(x, y + radius)
      ctx.quadraticCurveTo(x, y, x + radius, y)
      ctx.fill()

      ctx.shadowBlur = 0
    }

    // Subtle reflection at the bottom
    ctx.globalAlpha = 0.08
    ctx.scale(1, -1)
    ctx.translate(0, -h * 2)
    // We skip the reflection draw for performance — just the bars are enough
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = 1

    animFrameRef.current = requestAnimationFrame(draw)
  }, [barCount])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect
        const dpr = window.devicePixelRatio
        canvas.width = width * dpr
        canvas.height = height * dpr
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.scale(dpr, dpr)
        }
      }
    })
    resizeObserver.observe(canvas.parentElement || canvas)

    return () => resizeObserver.disconnect()
  }, [height])

  useEffect(() => {
    if (isPlaying) {
      smoothedRef.current = new Float32Array(barCount)
      animFrameRef.current = requestAnimationFrame(draw)
    }
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [isPlaying, draw, barCount])

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

export default FrequencyBars
