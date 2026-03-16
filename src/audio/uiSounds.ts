/**
 * uiSounds.ts — Subtle Web Audio feedback for UI interactions.
 *
 * An ambient audio app should sound alive even at the UI level.
 * All sounds use Web Audio API oscillators — zero file deps, ~0 bytes.
 *
 * Rules:
 * - Master gain: 0.06 (barely audible — this is atmosphere, not notification)
 * - Duration: 30-120ms (percussive ticks, not tones)
 * - Only on meaningful actions: play, add, remove, toggle, shuffle
 * - Never on hover, scroll, or parameter drag (too frequent)
 * - Respects user's system audio — no AudioContext until first interaction
 */

class UISoundEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private muted = false

  private init() {
    if (this.ctx) return
    this.ctx = new AudioContext()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.06
    this.master.connect(this.ctx.destination)
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gain = 1.0,
    delay = 0
  ) {
    if (this.muted) return
    this.init()
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    const startTime = ctx.currentTime + delay

    osc.type = type
    osc.frequency.value = freq

    // Envelope: fast attack, exponential release
    env.gain.setValueAtTime(0, startTime)
    env.gain.linearRampToValueAtTime(gain, startTime + 0.008)
    env.gain.exponentialRampToValueAtTime(0.001, startTime + duration)

    osc.connect(env)
    env.connect(this.master!)
    osc.start(startTime)
    osc.stop(startTime + duration)
  }

  /** Play/resume — bright tick */
  play() {
    this.tone(1100, 0.05, 'sine', 0.8)
  }

  /** Pause — softer, lower tick */
  pause() {
    this.tone(660, 0.06, 'sine', 0.5)
  }

  /** Add layer — rising interval (warm) */
  addLayer() {
    this.tone(440, 0.07, 'sine', 0.7)
    this.tone(660, 0.08, 'sine', 0.6, 0.06)
  }

  /** Remove layer — falling interval */
  removeLayer() {
    this.tone(660, 0.06, 'sine', 0.5)
    this.tone(380, 0.08, 'sine', 0.4, 0.05)
  }

  /** Toggle on (evolve, solo) — quick bright double-tap */
  toggleOn() {
    this.tone(880, 0.04, 'sine', 0.6)
    this.tone(1100, 0.05, 'sine', 0.5, 0.04)
  }

  /** Toggle off — single soft drop */
  toggleOff() {
    this.tone(660, 0.05, 'sine', 0.4)
  }

  /** Shuffle/randomize — playful three-note cascade */
  shuffle() {
    this.tone(523, 0.05, 'sine', 0.5)
    this.tone(659, 0.05, 'sine', 0.5, 0.05)
    this.tone(784, 0.06, 'sine', 0.6, 0.1)
  }

  /** Mute — dull thud */
  mute() {
    this.tone(220, 0.06, 'triangle', 0.5)
  }

  /** Generic soft click */
  click() {
    this.tone(1200, 0.03, 'square', 0.3)
  }

  /** Preset loaded — warm chord-like cascade */
  presetLoad() {
    this.tone(440, 0.08, 'sine', 0.5)
    this.tone(554, 0.08, 'sine', 0.4, 0.06)
    this.tone(659, 0.09, 'sine', 0.5, 0.12)
  }

  /** Share copied — bright confirmation */
  shareCopied() {
    this.tone(880, 0.04, 'sine', 0.6)
    this.tone(1320, 0.06, 'sine', 0.5, 0.04)
  }

  setMuted(muted: boolean) {
    this.muted = muted
  }

  isMuted() {
    return this.muted
  }
}

/** Singleton instance */
export const uiSounds = new UISoundEngine()
