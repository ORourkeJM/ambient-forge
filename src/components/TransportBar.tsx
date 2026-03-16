/**
 * TransportBar — Top control bar with play/pause, evolve, randomize, master volume, add layer.
 */

import { useState, useRef } from 'react'
import { useMixerStore } from '../stores/mixerStore'
import { uiSounds } from '../audio/uiSounds'
import type { EvolveSpeed } from '../audio/Evolver'

interface TransportBarProps {
  onAddLayer: () => void
}

const evolveSpeedLabels: Record<EvolveSpeed, string> = {
  glacial: 'Glacial',
  slow: 'Slow',
  medium: 'Medium',
  fast: 'Fast',
}

const evolveSpeeds: EvolveSpeed[] = ['glacial', 'slow', 'medium', 'fast']

export function TransportBar({ onAddLayer }: TransportBarProps) {
  const {
    isPlaying,
    masterVolume,
    isInitialized,
    togglePlay,
    setMasterVolume,
    layers,
    isEvolving,
    evolveSpeed,
    toggleEvolve,
    setEvolveSpeed,
    randomizeScene,
  } = useMixerStore()

  const [playRing, setPlayRing] = useState(false)
  const playRingTimeout = useRef<ReturnType<typeof setTimeout>>()

  const handlePlay = async () => {
    // Fire play ring animation
    clearTimeout(playRingTimeout.current)
    setPlayRing(true)
    playRingTimeout.current = setTimeout(() => setPlayRing(false), 600)

    // UI sound
    if (isPlaying) {
      uiSounds.pause()
    } else {
      uiSounds.play()
    }

    await togglePlay()
  }

  const handleEvolveToggle = () => {
    if (isEvolving) {
      uiSounds.toggleOff()
    } else {
      uiSounds.toggleOn()
    }
    toggleEvolve()
  }

  const handleShuffle = () => {
    uiSounds.shuffle()
    randomizeScene()
  }

  const handleAddLayer = () => {
    uiSounds.click()
    onAddLayer()
  }

  return (
    <div className="glass rounded-2xl px-6 py-4 flex items-center gap-4 flex-wrap">
      {/* Play / Pause */}
      <button
        onClick={handlePlay}
        className={`
          w-12 h-12 rounded-full flex items-center justify-center transition-all flex-shrink-0
          ${playRing ? 'animate-play-ring' : ''}
          ${isPlaying
            ? 'bg-glow/20 text-glow hover:bg-glow/30 glow-box'
            : 'bg-surface-2 text-text-muted hover:bg-surface-3 hover:text-text'}
        `}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Status */}
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-semibold text-text">
          {isPlaying ? 'Playing' : isInitialized ? 'Paused' : 'Ready'}
          {isEvolving && isPlaying && (
            <span className="ml-1.5 text-mist animate-ambient-pulse">· Evolving</span>
          )}
        </span>
        <span className="text-[10px] text-text-muted">
          {layers.length} layer{layers.length !== 1 ? 's' : ''} active
        </span>
      </div>

      {/* Evolve + Randomize cluster */}
      <div className="flex items-center gap-2 ml-auto sm:ml-0">
        {/* Evolve toggle */}
        <button
          onClick={handleEvolveToggle}
          className={`
            flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all
            ${isEvolving
              ? 'bg-mist/15 text-mist border border-mist/30 shadow-[0_0_12px_rgba(180,160,255,0.15)]'
              : 'bg-surface-2 text-text-muted hover:bg-surface-3 hover:text-text border border-transparent'}
          `}
          title={isEvolving ? 'Stop evolving' : 'Auto-evolve parameters'}
        >
          {/* DNA / infinity-like icon */}
          <svg className={`w-3.5 h-3.5 ${isEvolving ? 'animate-spin-slow' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Evolve
        </button>

        {/* Speed selector (only when evolving) */}
        {isEvolving && (
          <div className="flex rounded-lg bg-surface-2 p-0.5 gap-0.5">
            {evolveSpeeds.map((speed) => (
              <button
                key={speed}
                onClick={() => setEvolveSpeed(speed)}
                className={`
                  px-2 py-1 rounded-md text-[10px] font-medium transition-all
                  ${evolveSpeed === speed
                    ? 'bg-mist/20 text-mist'
                    : 'text-text-dim hover:text-text-muted'}
                `}
                title={evolveSpeedLabels[speed]}
              >
                {evolveSpeedLabels[speed]}
              </button>
            ))}
          </div>
        )}

        {/* Randomize */}
        <button
          onClick={handleShuffle}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-surface-2 text-text-muted hover:bg-surface-3 hover:text-text transition-all border border-transparent hover:border-border-bright"
          title="Generate a random soundscape"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          Shuffle
        </button>
      </div>

      {/* Spacer */}
      <div className="flex-1 hidden sm:block" />

      {/* Master Volume */}
      <div className="flex items-center gap-3">
        <svg className="w-4 h-4 text-text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M6.5 8H4a1 1 0 00-1 1v6a1 1 0 001 1h2.5l4.5 4V4l-4.5 4z" />
        </svg>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={masterVolume}
          onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
          className="w-28"
        />
        <span className="text-[10px] font-mono text-text-muted w-8 text-right">
          {Math.round(masterVolume * 100)}%
        </span>
      </div>

      {/* Add Layer button */}
      <button
        onClick={handleAddLayer}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-glow/10 text-glow hover:bg-glow/20 transition-all text-sm font-semibold flex-shrink-0"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add Layer
      </button>
    </div>
  )
}

export default TransportBar
