/**
 * EnginePicker — Modal for selecting which engine to add as a new layer.
 */

import { useEffect, useRef } from 'react'
import { getAvailableEngines, implementedEngines } from '../audio/engines'
import type { EngineType, EngineCategory } from '../types/audio'

interface EnginePickerProps {
  isOpen: boolean
  onSelect: (type: EngineType) => void
  onClose: () => void
}

const categoryLabels: Record<EngineCategory, string> = {
  nature: '🌿 Nature',
  atmospheric: '⚡ Atmospheric',
  synthetic: '✨ Synthetic',
  urban: '🏙 Urban',
  therapeutic: '🧠 Therapeutic',
}

const categoryOrder: EngineCategory[] = ['nature', 'atmospheric', 'synthetic', 'urban', 'therapeutic']

export function EnginePicker({ isOpen, onSelect, onClose }: EnginePickerProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const engines = getAvailableEngines()

  // Group by category
  const grouped = categoryOrder
    .map((cat) => ({
      category: cat,
      label: categoryLabels[cat],
      engines: engines.filter((e) => e.category === cat),
    }))
    .filter((g) => g.engines.length > 0)

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div className="glass rounded-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-text">Add Sound Layer</h2>
            <p className="text-xs text-text-muted mt-0.5">Choose an engine to add to your soundscape</p>
          </div>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-text transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Engine grid by category */}
        <div className="p-4 space-y-5">
          {grouped.map((group) => (
            <div key={group.category}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 px-1">
                {group.label}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {group.engines.map((engine) => {
                  const isImplemented = implementedEngines.includes(engine.type)
                  return (
                    <button
                      key={engine.type}
                      onClick={() => {
                        if (isImplemented) {
                          onSelect(engine.type)
                          onClose()
                        }
                      }}
                      disabled={!isImplemented}
                      className={`
                        flex items-start gap-3 p-3 rounded-xl text-left transition-all
                        ${isImplemented
                          ? 'bg-surface hover:bg-surface-2 hover:ring-1 hover:ring-glow/20 cursor-pointer'
                          : 'bg-surface/40 opacity-40 cursor-not-allowed'}
                      `}
                    >
                      <span className="text-2xl flex-shrink-0 mt-0.5">{engine.icon}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-text flex items-center gap-1.5">
                          {engine.name}
                          {!isImplemented && (
                            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-surface-2 text-text-dim">
                              Soon
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-text-muted leading-tight mt-0.5">
                          {engine.description}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default EnginePicker
