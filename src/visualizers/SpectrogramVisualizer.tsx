/**
 * SpectrogramVisualizer — Canvas-based frequency spectrum display.
 *
 * Renders a scrolling spectrogram (time × frequency × amplitude)
 * with a beautiful color gradient from deep void to glow.
 */

import { useEffect, useRef, useCallback } from 'react'
import { AudioContextManager } from '../audio/AudioContextManager'

interface SpectrogramVisualizerProps {
  isPlaying: boolean
  height?: number
}

export function SpectrogramVisualizer({
  isPlaying,
  height = 140,
}: SpectrogramVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)
  const imageDataRef = useRef<ImageData | null>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
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

    // Shift existing image 1px left (scrolling effect)
    if (imageDataRef.current) {
      ctx.putImageData(imageDataRef.current, -1, 0)
    }

    // Draw new column on the right
    const columnWidth = 1
    const x = w - columnWidth

    // Only use the lower ~60% of frequency bins (most interesting for ambient)
    const usableBins = Math.floor(bufferLength * 0.6)

    for (let i = 0; i < h; i++) {
      // Map pixel row to frequency bin (low at bottom, high at top)
      const binIndex = Math.floor(((h - i) / h) * usableBins)
      const value = dataArray[binIndex] / 255

      // Color mapping: dark → deep blue → teal → glow green → bright
      const r = Math.floor(value * value * 40 + value * 15)
      const g = Math.floor(value * value * 200 + value * 40)
      const b = Math.floor(value * value * 140 + value * 60)
      const a = Math.floor(value * 220 + 35)

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`
      ctx.fillRect(x, i, columnWidth, 1)
    }

    // Save current image for scrolling
    imageDataRef.current = ctx.getImageData(0, 0, w, h)

    // Subtle glow overlay on the right edge
    const gradient = ctx.createLinearGradient(w - 20, 0, w, 0)
    gradient.addColorStop(0, 'rgba(74, 240, 192, 0)')
    gradient.addColorStop(1, 'rgba(74, 240, 192, 0.03)')
    ctx.fillStyle = gradient
    ctx.fillRect(w - 20, 0, 20, h)

    animFrameRef.current = requestAnimationFrame(draw)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect
        const dpr = window.devicePixelRatio
        canvas.width = width * dpr
        canvas.height = height * dpr
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (ctx) {
          ctx.scale(dpr, dpr)
          // Reset image data on resize
          imageDataRef.current = null
        }
      }
    })
    resizeObserver.observe(canvas.parentElement || canvas)

    return () => resizeObserver.disconnect()
  }, [height])

  useEffect(() => {
    if (isPlaying) {
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

export default SpectrogramVisualizer
