/**
 * VisualizerSwitcher — Toggles between visualization modes.
 *
 * Modes: Waveform, Spectrogram, Frequency Bars, or hidden.
 */

import { useState } from 'react'
import { WaveformVisualizer } from './WaveformVisualizer'
import { SpectrogramVisualizer } from './SpectrogramVisualizer'
import { FrequencyBars } from './FrequencyBars'
import { ParticleVisualizer } from './ParticleVisualizer'

type VisualizerMode = 'waveform' | 'spectrogram' | 'bars' | 'particles' | 'off'

interface VisualizerSwitcherProps {
  isPlaying: boolean
}

const modes: { id: VisualizerMode; label: string; icon: string }[] = [
  { id: 'waveform', label: 'Wave', icon: '〰️' },
  { id: 'bars', label: 'Bars', icon: '📊' },
  { id: 'spectrogram', label: 'Spectro', icon: '🌈' },
  { id: 'particles', label: 'Nebula', icon: '✨' },
  { id: 'off', label: 'Off', icon: '⊘' },
]

export function VisualizerSwitcher({ isPlaying }: VisualizerSwitcherProps) {
  const [mode, setMode] = useState<VisualizerMode>('particles')

  if (!isPlaying) return null

  return (
    <div className="space-y-2">
      {/* Visualizer display */}
      <div className="rounded-xl overflow-hidden bg-abyss/50 relative">
        {mode === 'waveform' && <WaveformVisualizer isPlaying={isPlaying} />}
        {mode === 'spectrogram' && <SpectrogramVisualizer isPlaying={isPlaying} />}
        {mode === 'bars' && <FrequencyBars isPlaying={isPlaying} />}
        {mode === 'particles' && <ParticleVisualizer isPlaying={isPlaying} />}
        {mode === 'off' && (
          <div className="h-[100px] flex items-center justify-center text-text-dim text-xs">
            Visualizer hidden
          </div>
        )}

        {/* Mode switcher — overlaid top-right */}
        <div className="absolute top-2 right-2 flex gap-1 bg-void/60 backdrop-blur-sm rounded-lg p-0.5">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`px-2 py-1 rounded-md text-[10px] transition-all ${
                mode === m.id
                  ? 'bg-surface-2 text-glow'
                  : 'text-text-dim hover:text-text-muted'
              }`}
              title={m.label}
            >
              {m.icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default VisualizerSwitcher
