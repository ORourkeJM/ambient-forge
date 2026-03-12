/**
 * SleepTimer — Countdown timer that fades out and stops playback.
 *
 * Shows a dropdown of preset durations, a countdown display,
 * and auto-fades the master volume to 0 in the last 30 seconds.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useMixerStore } from '../stores/mixerStore'
import { AudioContextManager } from '../audio/AudioContextManager'

const FADE_DURATION = 30 // seconds

const presetMinutes = [5, 10, 15, 20, 30, 45, 60, 90, 120]

export function SleepTimer() {
  const [isOpen, setIsOpen] = useState(false)
  const [active, setActive] = useState(false)
  const [remaining, setRemaining] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0)
  const [isFading, setIsFading] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const endTimeRef = useRef<number>(0)
  const originalVolumeRef = useRef<number>(0.8)

  const { isPlaying, masterVolume } = useMixerStore()

  const startTimer = useCallback((minutes: number) => {
    const seconds = minutes * 60
    endTimeRef.current = Date.now() + seconds * 1000
    originalVolumeRef.current = useMixerStore.getState().masterVolume

    setTotalDuration(seconds)
    setRemaining(seconds)
    setActive(true)
    setIsFading(false)
    setIsOpen(false)
  }, [])

  const cancelTimer = useCallback(() => {
    setActive(false)
    setRemaining(0)
    setIsFading(false)

    // Restore volume if we were fading
    const store = useMixerStore.getState()
    store.setMasterVolume(originalVolumeRef.current)
  }, [])

  // Timer tick
  useEffect(() => {
    if (!active) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      const now = Date.now()
      const left = Math.max(0, Math.ceil((endTimeRef.current - now) / 1000))
      setRemaining(left)

      // Start fading in the last FADE_DURATION seconds
      if (left <= FADE_DURATION && left > 0 && !isFading) {
        setIsFading(true)
      }

      if (left <= FADE_DURATION && left > 0) {
        // Gradual fade
        const fadeProgress = 1 - left / FADE_DURATION
        const newVolume = originalVolumeRef.current * (1 - fadeProgress)
        AudioContextManager.getInstance().setMasterVolume(Math.max(0, newVolume))
      }

      if (left === 0) {
        // Time's up — stop playback
        AudioContextManager.getInstance().setMasterVolume(0)
        const mixer = useMixerStore.getState()
        if (mixer.isPlaying) {
          mixer.togglePlay()
        }
        setActive(false)
        setIsFading(false)
      }
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [active, isFading])

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const progress = totalDuration > 0 ? (totalDuration - remaining) / totalDuration : 0

  if (!isPlaying && !active) return null

  return (
    <div className="relative">
      {/* Timer button / display */}
      <button
        onClick={() => active ? cancelTimer() : setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all border ${
          active
            ? isFading
              ? 'bg-ember/10 border-ember/30 text-ember'
              : 'bg-glow/10 border-glow/30 text-glow'
            : 'bg-surface hover:bg-surface-2 border-border hover:border-border-bright text-text-muted hover:text-text'
        }`}
      >
        {/* Moon icon */}
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>

        {active ? (
          <span className="tabular-nums font-mono">
            {formatTime(remaining)}
          </span>
        ) : (
          <span>Sleep</span>
        )}

        {/* Progress ring when active */}
        {active && (
          <svg className="w-4 h-4 -rotate-90" viewBox="0 0 16 16">
            <circle
              cx="8" cy="8" r="6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeOpacity="0.2"
            />
            <circle
              cx="8" cy="8" r="6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray={`${progress * 37.7} 37.7`}
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && !active && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute bottom-full mb-2 right-0 z-50 bg-deep border border-border rounded-xl p-2 shadow-xl min-w-[140px]">
            <p className="text-[10px] text-text-dim uppercase tracking-widest px-2 py-1 mb-1">
              Sleep Timer
            </p>
            {presetMinutes.map((mins) => (
              <button
                key={mins}
                onClick={() => startTimer(mins)}
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-text-muted hover:text-text hover:bg-surface transition-all"
              >
                <span>{mins < 60 ? `${mins} min` : `${mins / 60} hr${mins > 60 ? 's' : ''}`}</span>
                <span className="text-text-dim text-[10px]">
                  {formatTime(mins * 60)}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default SleepTimer
