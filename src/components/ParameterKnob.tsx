/**
 * ParameterKnob — SVG-based rotary control for engine parameters.
 *
 * Features: arc indicator, vertical drag to adjust, double-click reset,
 * glow effect, hover tooltip.
 */

import { useState, useRef, useCallback } from 'react'

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

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsDragging(true)
      dragStartY.current = e.clientY
      dragStartValue.current = value

      const handleMouseMove = (e: MouseEvent) => {
        const deltaY = dragStartY.current - e.clientY
        const sensitivity = e.shiftKey ? 0.001 : 0.005
        const newValue = Math.max(0, Math.min(1, dragStartValue.current + deltaY * sensitivity))
        onChange(newValue)
      }

      const handleMouseUp = () => {
        setIsDragging(false)
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [value, onChange]
  )

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
        className="cursor-pointer select-none"
        onMouseDown={handleMouseDown}
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
          r={2.5}
          fill={color}
          style={{
            filter: isDragging ? `drop-shadow(0 0 6px ${color})` : 'none',
          }}
        />
        {/* Center value text */}
        <text
          x={cx}
          y={cy + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--color-text)"
          fontSize={size < 48 ? 9 : 11}
          fontWeight={500}
          className="select-none"
        >
          {displayValue}
        </text>
      </svg>
      <span className="text-[10px] font-medium text-text-muted truncate max-w-full">
        {label}
      </span>
    </div>
  )
}

export default ParameterKnob
