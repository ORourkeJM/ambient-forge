/**
 * ChannelStrip — A single mixer channel for one active layer.
 *
 * Shows: engine name/icon, volume fader, pan, mute/solo, parameters, remove.
 */

import { useState } from 'react'
import { useMixerStore } from '../stores/mixerStore'
import { uiSounds } from '../audio/uiSounds'
import { ParameterKnob } from './ParameterKnob'
import type { Layer } from '../types/audio'

interface ChannelStripProps {
  layer: Layer
  engineParams: { name: string; label: string; value: number; defaultValue: number; color?: string }[]
  engineIcon: string
}

/** Get a contextual sublabel for certain engine types */
function getEngineSublabel(layer: Layer): string | null {
  if (layer.engineType === 'binaural') {
    const mode = layer.params.mode ?? 0.4
    if (mode < 0.15) return 'Delta · Deep Sleep'
    if (mode < 0.35) return 'Theta · Meditation'
    if (mode < 0.55) return 'Alpha · Calm Focus'
    if (mode < 0.75) return 'Beta · Concentration'
    return 'Gamma · Peak Focus'
  }
  if (layer.engineType === 'whitenoise') {
    const color = layer.params.color ?? 0.5
    if (color < 0.2) return 'White Noise'
    if (color < 0.6) return 'Pink Noise'
    return 'Brown Noise'
  }
  if (layer.engineType === 'singing-bowl') {
    const pitch = layer.params.pitch ?? 0.3
    if (pitch < 0.3) return 'Deep Bowl'
    if (pitch < 0.6) return 'Medium Bowl'
    return 'High Bowl'
  }
  return null
}

export function ChannelStrip({ layer, engineParams, engineIcon }: ChannelStripProps) {
  const [showParams, setShowParams] = useState(true)
  const {
    setLayerVolume,
    setLayerPan,
    toggleLayerMute,
    toggleLayerSolo,
    setLayerParam,
    removeLayer,
  } = useMixerStore()

  const sublabel = getEngineSublabel(layer)

  const handleRemove = () => {
    uiSounds.removeLayer()
    removeLayer(layer.id)
  }

  const handleMuteToggle = () => {
    uiSounds.mute()
    toggleLayerMute(layer.id)
  }

  const handleSoloToggle = () => {
    if (layer.soloed) {
      uiSounds.toggleOff()
    } else {
      uiSounds.toggleOn()
    }
    toggleLayerSolo(layer.id)
  }

  return (
    <div
      className={`
        glass rounded-xl p-4 transition-all duration-300 animate-layer-in
        ${layer.muted ? 'opacity-50' : ''}
        ${layer.soloed ? 'ring-1 ring-glow/40' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg flex-shrink-0">{engineIcon}</span>
          <div className="min-w-0">
            <span className="text-sm font-semibold text-text block truncate">{layer.name}</span>
            {sublabel && (
              <span className="text-[10px] text-mist/70 block">{sublabel}</span>
            )}
          </div>
        </div>
        <button
          onClick={handleRemove}
          className="text-text-dim hover:text-ember transition-colors p-1 rounded"
          title="Remove layer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Volume fader */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Volume</span>
          <span className="text-[10px] font-mono text-text-muted">{Math.round(layer.volume * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={layer.volume}
          onChange={(e) => setLayerVolume(layer.id, parseFloat(e.target.value))}
          className="w-full"
          style={{
            accentColor: 'var(--color-glow)',
          }}
        />
      </div>

      {/* Pan */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Pan</span>
          <span className="text-[10px] font-mono text-text-muted">
            {layer.pan < -0.05 ? `L${Math.round(Math.abs(layer.pan) * 100)}` :
             layer.pan > 0.05 ? `R${Math.round(layer.pan * 100)}` : 'C'}
          </span>
        </div>
        <input
          type="range"
          min={-1}
          max={1}
          step={0.01}
          value={layer.pan}
          onChange={(e) => setLayerPan(layer.id, parseFloat(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Mute / Solo */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={handleMuteToggle}
          className={`
            flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
            ${layer.muted
              ? 'bg-ember/20 text-ember border border-ember/30'
              : 'bg-surface-2 text-text-muted hover:bg-surface-3 border border-transparent'}
          `}
        >
          {layer.muted ? 'Muted' : 'Mute'}
        </button>
        <button
          onClick={handleSoloToggle}
          className={`
            flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
            ${layer.soloed
              ? 'bg-glow/20 text-glow border border-glow/30'
              : 'bg-surface-2 text-text-muted hover:bg-surface-3 border border-transparent'}
          `}
        >
          Solo
        </button>
      </div>

      {/* Parameters toggle */}
      <button
        onClick={() => setShowParams(!showParams)}
        className="flex items-center gap-1.5 text-[10px] font-medium text-text-dim hover:text-text-muted transition-colors mb-2 uppercase tracking-wider"
      >
        <svg
          className={`w-3 h-3 transition-transform ${showParams ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        Parameters
      </button>

      {/* Parameters grid */}
      {showParams && (
        <div className="grid grid-cols-2 gap-3 pt-1">
          {engineParams.map((param) => (
            <ParameterKnob
              key={param.name}
              name={param.name}
              label={param.label}
              value={layer.params[param.name] ?? param.value}
              defaultValue={param.defaultValue}
              color={param.color}
              size={52}
              onChange={(v) => setLayerParam(layer.id, param.name, v)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default ChannelStrip
