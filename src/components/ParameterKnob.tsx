/**
 * ParameterKnob — SVG-based rotary control for engine parameters.
 *
 * Features: arc indicator, vertical drag to adjust (mouse + touch),
 * momentum/inertia on release, double-click reset, glow effect, hover tooltip.
 */

import { useState, useRef, useCallback, useEffect } from 'react'

interface ParameterKnobProps {
  name: string
  label: string
  value: number // 0-1
  defaultValue?: number
  color?: string
  size?: number
  onChange: (value: number) => void
}

export function ParameterKnob({
  label,
  value,
  defaultValue = 0.5,
  color = '#4af0c0',
  size = 48,
  onChange,
}: ParameterKnobProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const dragStartY = useRef(0)
  const dragStartValue = useRef(0)
  const velocityRef = useRef(0)
  const lastY = useRef(0)
  const lastTime = useRef(0)
  const momentumRaf = useRef<number>(0)

  const radius = (size - 8) / 2
  const cx = size / 2
  const cy = size / 2
  const strokeWidth = 3

  // Arc from 135° to 405° (270° sweep)
  const startAngle = 135
  const endAngle = 405
  const sweep = endAngle - startAngle
  const valueAngle = startAngle + value * sweep

  const polarToCartesian = (angle: number, r: number) => {
    const rad = ((angle - 90) * Math.PI) / 180
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    }
  }

  const describeArc = (start: number, end: number, r: number) => {
    const s = polarToCartesian(start, r)
    const e = polarToCartesian(end, r)
    const largeArc = end - start > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`
  }

  const clampValue = (v: number) => Math.max(0, Math.min(1, v))

  // Shared drag logic
  const handleDragStart = useCallback(
    (clientY: number) => {
      cancelAnimationFrame(momentumRaf.current)
      setIsDragging(true)
      dragStartY.current = clientY
      dragStartValue.current = value
      lastY.current = clientY
      lastTime.current = performance.now()
      velocityRef.current = 0
    },
    [value]
  )

  const handleDragMove = useCallback(
    (clientY: number, fine: boolean) => {
      const deltaY = dragStartY.current - clientY
      const sensitivity = fine ? 0.001 : 0.005
      const newValue = clampValue(dragStartValue.current + deltaY * sensitivity)

      // Track velocity for momentum
      const now = performance.now()
      const dt = now - lastTime.current
      if (dt > 0) {
        const dy = lastY.current - clientY
        velocityRef.current = (dy / dt) * sensitivity * 16 // velocity per frame
      }
      lastY.current = clientY
      lastTime.current = now

      onChange(newValue)
    },
    [onChange]
  )

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)

    // Apply momentum — gentle coast after release
    const applyMomentum = () => {
      const vel = velocityRef.current
      if (Math.abs(vel) < 0.0005) return // below threshold, stop

      const currentVal = clampValue(value + vel)
      velocityRef.current *= 0.88 // damping
      onChange(currentVal)
      momentumRaf.current = requestAnimationFrame(applyMomentum)
    }

    if (Math.abs(velocityRef.current) > 0.001) {
      momentumRaf.current = requestAnimationFrame(applyMomentum)
    }
  }, [value, onChange])

  // Mouse handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      handleDragStart(e.clientY)

      const handleMouseMove = (e: MouseEvent) => {
        handleDragMove(e.clientY, e.shiftKey)
      }

      const handleMouseUp = () => {
        handleDragEnd()
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [handleDragStart, handleDragMove, handleDragEnd]
  )

  // Touch handlers
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return
      e.preventDefault()
      handleDragStart(e.touches[0].clientY)

      const handleTouchMove = (e: TouchEvent) => {
        if (e.touches.length !== 1) return
        e.preventDefault()
        handleDragMove(e.touches[0].clientY, false)
      }

      const handleTouchEnd = () => {
        handleDragEnd()
        window.removeEventListener('touchmove', handleTouchMove)
        window.removeEventListener('touchend', handleTouchEnd)
        window.removeEventListener('touchcancel', handleTouchEnd)
      }

      window.addEventListener('touchmove', handleTouchMove, { passive: false })
      window.addEventListener('touchend', handleTouchEnd)
      window.addEventListener('touchcancel', handleTouchEnd)
    },
    [handleDragStart, handleDragMove, handleDragEnd]
  )

  // Cleanup momentum on unmount
  useEffect(() => {
    return () => cancelAnimationFrame(momentumRaf.current)
  }, [])

  const handleDoubleClick = useCallback(() => {
    onChange(defaultValue)
  }, [defaultValue, onChange])

  const displayValue = Math.round(value * 100)
  const indicatorPos = polarToCartesian(valueAngle, radius - 6)

  return (
    <div
      className="flex flex-col items-center gap-1"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <svg
        width={size}
        height={size}
        className="cursor-pointer select-none touch-none"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onDoubleClick={handleDoubleClick}
      >
        {/* Track arc */}
        <path
          d={describeArc(startAngle, endAngle, radius)}
          fill="none"
          stroke="var(--color-surface-2)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Value arc */}
        {value > 0.01 && (
          <path
            d={describeArc(startAngle, valueAngle, radius)}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{
              filter: isDragging || isHovered ? `drop-shadow(0 0 4px ${color})` : 'none',
              transition: isDragging ? 'none' : 'filter 0.2s ease',
            }}
          />
        )}
        {/* Indicator dot */}
        <circle
          cx={indicatorPos.x}
          cy={indicatorPos.y}
          r={isDragging ? 3 : 2.5}
          fill={color}
          style={{
            filter: isDragging ? `drop-shadow(0 0 6px ${color})` : 'none',
            transition: 'r 120ms ease',
          }}
        />
        {/* Center value text */}
        <text
          x={cx}
          y={cy + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={isDragging ? color : 'var(--color-text)'}
          fontSize={size < 48 ? 9 : 11}
          fontWeight={isDragging ? 600 : 500}
          className="select-none"
          style={{
            transition: 'fill 150ms ease',
          }}
        >
          {displayValue}
        </text>
      </svg>
      <span className={`text-[10px] font-medium truncate max-w-full transition-colors duration-150 ${
        isDragging ? 'text-text' : 'text-text-muted'
      }`}>
        {label}
      </span>
    </div>
  )
}

export default ParameterKnob
