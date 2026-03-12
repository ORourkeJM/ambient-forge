/**
 * WaveformVisualizer — Canvas-based audio-reactive visualization.
 *
 * Renders a soft glowing waveform or spectrum display using AnalyserNode data.
 */

import { useEffect, useRef, useCallback } from 'react'
import { AudioContextManager } from '../audio/AudioContextManager'

interface WaveformVisualizerProps {
  isPlaying: boolean
  color?: string
  height?: number
}

export function WaveformVisualizer({
  isPlaying,
  color = '#4af0c0',
  height = 120,
}: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)

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
    const dataArray = new Float32Array(bufferLength)
    analyser.getFloatTimeDomainData(dataArray)

    const width = canvas.width
    const h = canvas.height

    // Clear
    ctx.clearRect(0, 0, width, h)

    // Parse color for glow effect
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.shadowColor = color
    ctx.shadowBlur = 8

    // Draw waveform
    ctx.beginPath()
    const sliceWidth = width / bufferLength
    let x = 0

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i]
      const y = (v + 1) / 2 * h

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
      x += sliceWidth
    }

    ctx.stroke()

    // Draw a subtle center line
    ctx.shadowBlur = 0
    ctx.strokeStyle = `${color}15`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, h / 2)
    ctx.lineTo(width, h / 2)
    ctx.stroke()

    animFrameRef.current = requestAnimationFrame(draw)
  }, [color])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Size canvas to container
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect
        canvas.width = width * window.devicePixelRatio
        canvas.height = height * window.devicePixelRatio
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
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

export default WaveformVisualizer
