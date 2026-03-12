/**
 * SingingBowlEngine — Tibetan singing bowl / bell tones.
 *
 * Generates resonant metallic tones using additive synthesis with
 * inharmonic partials (characteristic of metal bowls/bells).
 * Random strikes trigger with natural exponential decay envelopes.
 *
 * The bowl sound comes from multiple partials at non-integer frequency
 * ratios — unlike strings (1x, 2x, 3x), metal bowls produce partials
 * at ratios like 1:2.71:5.40 which gives them their distinctive shimmer.
 *
 * Parameters:
 * - pitch:     Fundamental frequency of the bowl
 * - decay:     How long each strike rings out
 * - density:   How often strikes occur
 * - shimmer:   High partial brightness
 * - resonance: Sympathetic resonance / reverb tail
 */

import { AudioEngine } from '../AudioEngine'
import type { EngineInfo, EngineType } from '../../types/audio'

/** Partial frequency ratios for a singing bowl (inharmonic) */
const BOWL_PARTIALS = [
  { ratio: 1.0,    gain: 1.0  },   // Fundamental
  { ratio: 2.71,   gain: 0.6  },   // First overtone
  { ratio: 5.40,   gain: 0.35 },   // Second overtone
  { ratio: 8.93,   gain: 0.15 },   // Third overtone
  { ratio: 13.34,  gain: 0.08 },   // Fourth overtone (shimmer)
  { ratio: 18.64,  gain: 0.04 },   // Fifth overtone (air)
]

interface ActiveStrike {
  oscillators: OscillatorNode[]
  gains: GainNode[]
  masterGain: GainNode
  endTime: number
}

export class SingingBowlEngine extends AudioEngine {
  private activeStrikes: ActiveStrike[] = []
  private strikeTimer: ReturnType<typeof setTimeout> | null = null
  private reverbNode: ConvolverNode | null = null
  private reverbGain: GainNode | null = null
  private dryGain: GainNode | null = null
  private masterBowlGain: GainNode | null = null

  constructor() {
    super()

    this.registerParam({
      name: 'pitch',
      label: 'Pitch',
      value: 0.3,          // Low-medium bowl
      defaultValue: 0.3,
      unit: 'Hz',
      color: '#b4a0ff',    // mist purple
    })
    this.registerParam({
      name: 'decay',
      label: 'Decay',
      value: 0.6,          // Medium-long ring
      defaultValue: 0.6,
      unit: 's',
      color: '#4af0c0',    // glow teal
    })
    this.registerParam({
      name: 'density',
      label: 'Density',
      value: 0.3,          // Occasional strikes
      defaultValue: 0.3,
      unit: '%',
      color: '#4a9eff',    // frost blue
    })
    this.registerParam({
      name: 'shimmer',
      label: 'Shimmer',
      value: 0.4,
      defaultValue: 0.4,
      unit: '%',
      color: '#ff6b4a',    // ember orange
    })
    this.registerParam({
      name: 'resonance',
      label: 'Resonance',
      value: 0.4,
      defaultValue: 0.4,
      unit: '%',
      color: '#7acc4a',    // moss green
    })
  }

  getInfo(): EngineInfo {
    return {
      type: 'singing-bowl' as EngineType,
      name: 'Singing Bowl',
      description: 'Resonant Tibetan bowl strikes with shimmering overtones',
      category: 'therapeutic',
      icon: '🔔',
      defaultParams: {
        pitch: 0.3,
        decay: 0.6,
        density: 0.3,
        shimmer: 0.4,
        resonance: 0.4,
      },
    }
  }

  /**
   * Create a simple reverb impulse response.
   * Uses filtered noise decay to simulate room reverb.
   */
  private createReverbIR(): AudioBuffer {
    const sampleRate = this.ctx.sampleRate
    const length = sampleRate * 3 // 3 second reverb tail
    const buffer = this.ctx.createBuffer(2, length, sampleRate)

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        // Exponentially decaying white noise
        const t = i / sampleRate
        data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 2.5)
      }
    }

    return buffer
  }

  protected setup(): void {
    const resonanceValue = this.getParameter('resonance')

    // ── Master output gain ──
    this.masterBowlGain = this.ctx.createGain()
    this.masterBowlGain.gain.value = 0.3 // Bowls are loud, keep it controlled

    // ── Reverb (convolution) ──
    this.reverbNode = this.ctx.createConvolver()
    this.reverbNode.buffer = this.createReverbIR()

    this.reverbGain = this.ctx.createGain()
    this.reverbGain.gain.value = resonanceValue * 0.5

    this.dryGain = this.ctx.createGain()
    this.dryGain.gain.value = 0.7

    // Signal chain: masterBowlGain → dryGain → output
    //                                → reverbNode → reverbGain → output
    this.masterBowlGain.connect(this.dryGain)
    this.dryGain.connect(this.output)

    this.masterBowlGain.connect(this.reverbNode)
    this.reverbNode.connect(this.reverbGain)
    this.reverbGain.connect(this.output)

    // ── Start strike scheduling ──
    this.scheduleStrike()
  }

  /**
   * Trigger a single bowl strike.
   */
  private triggerStrike(): void {
    if (!this.isRunning || !this.masterBowlGain) return

    const now = this.ctx.currentTime
    const fundamental = this.scaleExp(this.getParameter('pitch'), 110, 880)
    const decayTime = this.scale(this.getParameter('decay'), 1.5, 8)
    const shimmerValue = this.getParameter('shimmer')

    // Slight random pitch variation per strike (±2%)
    const pitchVariation = 1 + (Math.random() - 0.5) * 0.04
    const baseFreq = fundamental * pitchVariation

    // Random pan for each strike
    const pan = (Math.random() - 0.5) * 0.6
    const panNode = this.ctx.createStereoPanner()
    panNode.pan.value = pan

    const strikeGain = this.ctx.createGain()
    strikeGain.gain.value = 0

    const oscillators: OscillatorNode[] = []
    const gains: GainNode[] = []

    // Create each partial
    for (const partial of BOWL_PARTIALS) {
      const osc = this.ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = baseFreq * partial.ratio

      // High partials controlled by shimmer parameter
      const isHighPartial = partial.ratio > 5
      const partialGain = this.ctx.createGain()
      const baseGain = partial.gain
      const shimmerMult = isHighPartial ? shimmerValue : 1.0
      partialGain.gain.value = baseGain * shimmerMult

      // Each partial has its own decay (higher partials decay faster)
      const partialDecayTime = decayTime / (1 + (partial.ratio - 1) * 0.15)

      osc.connect(partialGain)
      partialGain.connect(strikeGain)

      // Envelope: fast attack, exponential decay
      partialGain.gain.setValueAtTime(baseGain * shimmerMult, now)
      partialGain.gain.exponentialRampToValueAtTime(
        0.001,
        now + partialDecayTime
      )

      osc.start(now)
      osc.stop(now + partialDecayTime + 0.1)

      oscillators.push(osc)
      gains.push(partialGain)
    }

    // Strike envelope: fast attack, natural decay
    const attackTime = 0.003 // 3ms — percussive
    const strikeLevel = 0.5 + Math.random() * 0.5 // Random velocity
    strikeGain.gain.setValueAtTime(0, now)
    strikeGain.gain.linearRampToValueAtTime(strikeLevel, now + attackTime)
    strikeGain.gain.exponentialRampToValueAtTime(0.001, now + decayTime)

    // Connect to output chain
    strikeGain.connect(panNode)
    panNode.connect(this.masterBowlGain)

    // Track for cleanup
    const endTime = now + decayTime + 0.5
    const strike: ActiveStrike = {
      oscillators,
      gains,
      masterGain: strikeGain,
      endTime,
    }
    this.activeStrikes.push(strike)

    // Auto-cleanup after decay
    setTimeout(() => {
      oscillators.forEach(osc => {
        try { osc.disconnect() } catch { /* */ }
      })
      gains.forEach(g => g.disconnect())
      strikeGain.disconnect()
      panNode.disconnect()
      this.activeStrikes = this.activeStrikes.filter(s => s !== strike)
    }, (decayTime + 1) * 1000)
  }

  /**
   * Schedule the next strike based on density.
   */
  private scheduleStrike(): void {
    if (!this.isRunning) return

    this.triggerStrike()

    // Next strike interval based on density
    const density = this.getParameter('density')
    const minInterval = 1.5  // seconds
    const maxInterval = 12   // seconds
    const interval = this.scale(1 - density, minInterval, maxInterval)

    // Add some randomness (±30%)
    const randomInterval = interval * (0.7 + Math.random() * 0.6)

    this.strikeTimer = setTimeout(
      () => this.scheduleStrike(),
      randomInterval * 1000
    )
  }

  protected applyParameter(name: string, value: number): void {
    const now = this.ctx.currentTime

    switch (name) {
      case 'resonance':
        this.reverbGain?.gain.setTargetAtTime(value * 0.5, now, 0.2)
        break

      // pitch, decay, density, shimmer are read at strike time
      // so they take effect on the next strike automatically
    }
  }

  protected cleanup(): void {
    // Cancel scheduled strike
    if (this.strikeTimer) {
      clearTimeout(this.strikeTimer)
      this.strikeTimer = null
    }

    // Stop all active oscillators
    for (const strike of this.activeStrikes) {
      strike.oscillators.forEach(osc => {
        try { osc.stop() } catch { /* */ }
        osc.disconnect()
      })
      strike.gains.forEach(g => g.disconnect())
      strike.masterGain.disconnect()
    }
    this.activeStrikes = []

    // Disconnect infrastructure
    this.masterBowlGain?.disconnect()
    this.reverbNode?.disconnect()
    this.reverbGain?.disconnect()
    this.dryGain?.disconnect()

    this.masterBowlGain = null
    this.reverbNode = null
    this.reverbGain = null
    this.dryGain = null
  }
}

export default SingingBowlEngine
