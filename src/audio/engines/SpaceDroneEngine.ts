/**
 * SpaceDroneEngine — Deep ambient pads from detuned oscillators.
 *
 * Multiple detuned oscillators with slow LFO modulation on pitch,
 * filter cutoff, and amplitude to create evolving ambient textures.
 *
 * Parameters:
 * - depth: fundamental frequency (0-1)
 * - shimmer: high-frequency overtone mix (0-1)
 * - drift: detuning amount between oscillators (0-1)
 * - warmth: low-pass filter cutoff (0-1)
 * - evolution: LFO complexity (0-1)
 */

import { AudioEngine } from '../AudioEngine'
import type { EngineInfo, EngineType } from '../../types/audio'

interface OscVoice {
  osc: OscillatorNode
  gain: GainNode
}

export class SpaceDroneEngine extends AudioEngine {
  private voices: OscVoice[] = []
  private mainFilter: BiquadFilterNode | null = null
  private filterLfo: OscillatorNode | null = null
  private filterLfoGain: GainNode | null = null
  private ampLfo: OscillatorNode | null = null
  private ampLfoGain: GainNode | null = null
  private dryGain: GainNode | null = null
  private shimmerFilter: BiquadFilterNode | null = null
  private shimmerGain: GainNode | null = null
  private subOsc: OscillatorNode | null = null
  private subGain: GainNode | null = null

  private readonly NUM_VOICES = 6

  constructor() {
    super()

    this.registerParam({
      name: 'depth',
      label: 'Depth',
      value: 0.3,
      defaultValue: 0.3,
      unit: 'Hz',
      color: '#b4a0ff',
    })
    this.registerParam({
      name: 'shimmer',
      label: 'Shimmer',
      value: 0.4,
      defaultValue: 0.4,
      unit: '%',
      color: '#4af0c0',
    })
    this.registerParam({
      name: 'drift',
      label: 'Drift',
      value: 0.5,
      defaultValue: 0.5,
      unit: '%',
      color: '#4a9eff',
    })
    this.registerParam({
      name: 'warmth',
      label: 'Warmth',
      value: 0.5,
      defaultValue: 0.5,
      unit: '%',
      color: '#ff6b4a',
    })
    this.registerParam({
      name: 'evolution',
      label: 'Evolution',
      value: 0.5,
      defaultValue: 0.5,
      unit: '%',
      color: '#7acc4a',
    })
  }

  getInfo(): EngineInfo {
    return {
      type: 'space-drone' as EngineType,
      name: 'Space Drone',
      description: 'Deep evolving ambient pads from detuned oscillators',
      category: 'synthetic',
      icon: '🌌',
      defaultParams: {
        depth: 0.3,
        shimmer: 0.4,
        drift: 0.5,
        warmth: 0.5,
        evolution: 0.5,
      },
    }
  }

  protected setup(): void {
    const baseFreq = this.scaleExp(this.getParameter('depth'), 30, 200)
    const driftAmount = this.scale(this.getParameter('drift'), 0.5, 8)

    // Create multiple detuned voices
    const voiceMix = this.ctx.createGain()
    voiceMix.gain.value = 0.15 // Keep it quiet — many voices sum up

    for (let i = 0; i < this.NUM_VOICES; i++) {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      // Alternate between sawtooth and sine for texture
      osc.type = i % 3 === 0 ? 'sawtooth' : i % 3 === 1 ? 'sine' : 'triangle'

      // Detune each voice differently
      const detuneOffset = (i - this.NUM_VOICES / 2) * driftAmount
      osc.frequency.value = baseFreq
      osc.detune.value = detuneOffset * 100 // cents

      // Individual voice gain (varies to add movement)
      gain.gain.value = 0.5 + Math.random() * 0.3

      // Each voice gets its own slow pitch LFO for organic drift
      const voiceLfo = this.ctx.createOscillator()
      const voiceLfoGain = this.ctx.createGain()
      voiceLfo.type = 'sine'
      voiceLfo.frequency.value = 0.02 + Math.random() * 0.06
      voiceLfoGain.gain.value = driftAmount * 2
      voiceLfo.connect(voiceLfoGain)
      voiceLfoGain.connect(osc.detune)
      voiceLfo.start()

      osc.connect(gain)
      gain.connect(voiceMix)

      osc.start()
      this.voices.push({ osc, gain })
    }

    // Main low-pass filter for warmth
    this.mainFilter = this.ctx.createBiquadFilter()
    this.mainFilter.type = 'lowpass'
    this.mainFilter.frequency.value = this.scaleExp(this.getParameter('warmth'), 200, 4000)
    this.mainFilter.Q.value = 1.5

    // Filter LFO — slow sweep
    const evoRate = this.scale(this.getParameter('evolution'), 0.01, 0.15)
    this.filterLfo = this.ctx.createOscillator()
    this.filterLfo.type = 'sine'
    this.filterLfo.frequency.value = evoRate

    this.filterLfoGain = this.ctx.createGain()
    this.filterLfoGain.gain.value = this.scale(this.getParameter('evolution'), 200, 2000)

    this.filterLfo.connect(this.filterLfoGain)
    this.filterLfoGain.connect(this.mainFilter.frequency)

    // Amplitude LFO — gentle breathing
    this.ampLfo = this.ctx.createOscillator()
    this.ampLfo.type = 'sine'
    this.ampLfo.frequency.value = evoRate * 0.7 // Slightly different rate for complexity

    this.ampLfoGain = this.ctx.createGain()
    this.ampLfoGain.gain.value = 0.15

    this.dryGain = this.ctx.createGain()
    this.dryGain.gain.value = 0.8

    this.ampLfo.connect(this.ampLfoGain)
    this.ampLfoGain.connect(this.dryGain.gain)

    // Shimmer — high-pass filtered layer
    this.shimmerFilter = this.ctx.createBiquadFilter()
    this.shimmerFilter.type = 'highpass'
    this.shimmerFilter.frequency.value = 2000
    this.shimmerFilter.Q.value = 1

    this.shimmerGain = this.ctx.createGain()
    this.shimmerGain.gain.value = this.getParameter('shimmer') * 0.3

    // Sub oscillator for ultra-low presence
    this.subOsc = this.ctx.createOscillator()
    this.subOsc.type = 'sine'
    this.subOsc.frequency.value = baseFreq * 0.5

    this.subGain = this.ctx.createGain()
    this.subGain.gain.value = 0.2

    // Signal chain:
    // voices → mainFilter → dryGain → output
    // voices → shimmerFilter → shimmerGain → output
    // subOsc → subGain → output
    voiceMix.connect(this.mainFilter)
    this.mainFilter.connect(this.dryGain)
    this.dryGain.connect(this.output)

    voiceMix.connect(this.shimmerFilter)
    this.shimmerFilter.connect(this.shimmerGain)
    this.shimmerGain.connect(this.output)

    this.subOsc.connect(this.subGain)
    this.subGain.connect(this.output)

    // Start LFOs and sub
    this.filterLfo.start()
    this.ampLfo.start()
    this.subOsc.start()
  }

  protected applyParameter(name: string, value: number): void {
    const now = this.ctx.currentTime

    switch (name) {
      case 'depth': {
        const newFreq = this.scaleExp(value, 30, 200)
        this.voices.forEach(v => {
          v.osc.frequency.setTargetAtTime(newFreq, now, 0.5)
        })
        this.subOsc?.frequency.setTargetAtTime(newFreq * 0.5, now, 0.5)
        break
      }

      case 'shimmer':
        this.shimmerGain?.gain.setTargetAtTime(value * 0.3, now, 0.2)
        break

      case 'drift': {
        const driftAmt = this.scale(value, 0.5, 8)
        this.voices.forEach((v, i) => {
          const detuneOffset = (i - this.NUM_VOICES / 2) * driftAmt * 100
          v.osc.detune.setTargetAtTime(detuneOffset, now, 0.5)
        })
        break
      }

      case 'warmth':
        this.mainFilter?.frequency.setTargetAtTime(
          this.scaleExp(value, 200, 4000),
          now,
          0.3
        )
        break

      case 'evolution': {
        const rate = this.scale(value, 0.01, 0.15)
        this.filterLfo?.frequency.setTargetAtTime(rate, now, 0.5)
        this.ampLfo?.frequency.setTargetAtTime(rate * 0.7, now, 0.5)
        this.filterLfoGain?.gain.setTargetAtTime(
          this.scale(value, 200, 2000),
          now,
          0.5
        )
        break
      }
    }
  }

  protected cleanup(): void {
    this.voices.forEach(v => {
      try { v.osc.stop() } catch { /* */ }
      v.osc.disconnect()
      v.gain.disconnect()
    })
    this.voices = []

    try { this.filterLfo?.stop() } catch { /* */ }
    try { this.ampLfo?.stop() } catch { /* */ }
    try { this.subOsc?.stop() } catch { /* */ }

    this.mainFilter?.disconnect()
    this.filterLfo?.disconnect()
    this.filterLfoGain?.disconnect()
    this.ampLfo?.disconnect()
    this.ampLfoGain?.disconnect()
    this.dryGain?.disconnect()
    this.shimmerFilter?.disconnect()
    this.shimmerGain?.disconnect()
    this.subOsc?.disconnect()
    this.subGain?.disconnect()

    this.mainFilter = null
    this.filterLfo = null
    this.filterLfoGain = null
    this.ampLfo = null
    this.ampLfoGain = null
    this.dryGain = null
    this.shimmerFilter = null
    this.shimmerGain = null
    this.subOsc = null
    this.subGain = null
  }
}

export default SpaceDroneEngine
