/**
 * BrainwaveEngine — Binaural beats & isochronal tones for brainwave entrainment.
 *
 * Based on neuroscience research into brainwave frequency bands:
 *
 *   Delta  (0.5–4 Hz)  — Deep sleep, healing, restoration
 *   Theta  (4–8 Hz)    — Meditation, creativity, deep relaxation
 *   Alpha  (8–12 Hz)   — Calm focus, relaxation, mindfulness
 *   Beta   (14–30 Hz)  — Active focus, concentration, alertness
 *   Gamma  (30–44 Hz)  — Peak focus, flow state, learning
 *
 * How it works:
 * Two sine oscillators play slightly different frequencies — one per ear.
 * The brain perceives the difference as a rhythmic "beat" at the gap
 * frequency and gradually entrains (synchronizes) to it.
 *
 * Example: Left ear 200 Hz + Right ear 206 Hz → brain perceives 6 Hz theta.
 *
 * The isochronal parameter adds amplitude pulsing at the beat frequency,
 * which works through speakers (binaural requires headphones).
 *
 * A warm pad tone underneath provides sonic comfort and masks the clinical
 * feel of pure sine waves.
 *
 * Parameters:
 * - mode:       Brainwave band — Delta → Theta → Alpha → Beta → Gamma
 * - carrier:    Base tone frequency (100–432 Hz)
 * - depth:      Binaural beat intensity / stereo separation
 * - warmth:     Low-pass filter softness
 * - isochronal: Rhythmic amplitude pulsing strength (speaker-friendly)
 */

import { AudioEngine } from '../AudioEngine'
import type { EngineInfo, EngineType } from '../../types/audio'

/** Brainwave band definitions */
interface BrainwaveBand {
  name: string
  minHz: number
  maxHz: number
}

const BANDS: BrainwaveBand[] = [
  { name: 'Delta',  minHz: 0.5, maxHz: 4   },
  { name: 'Theta',  minHz: 4,   maxHz: 8   },
  { name: 'Alpha',  minHz: 8,   maxHz: 12  },
  { name: 'Beta',   minHz: 14,  maxHz: 30  },
  { name: 'Gamma',  minHz: 30,  maxHz: 44  },
]

export class BrainwaveEngine extends AudioEngine {
  // Core binaural pair
  private leftOsc: OscillatorNode | null = null
  private rightOsc: OscillatorNode | null = null
  private leftGain: GainNode | null = null
  private rightGain: GainNode | null = null
  private merger: ChannelMergerNode | null = null

  // Filtering
  private mainFilter: BiquadFilterNode | null = null

  // Isochronal pulse (amplitude modulation)
  private isoLfo: OscillatorNode | null = null
  private isoLfoGain: GainNode | null = null
  private isoMix: GainNode | null = null  // wet path (pulsed)
  private dryMix: GainNode | null = null  // dry path (steady)

  // Comfort pad (soft harmonic bed underneath)
  private padOsc: OscillatorNode | null = null
  private padOsc2: OscillatorNode | null = null
  private padGain: GainNode | null = null
  private padFilter: BiquadFilterNode | null = null

  // Subtle sub-bass presence
  private subOsc: OscillatorNode | null = null
  private subGain: GainNode | null = null

  constructor() {
    super()

    this.registerParam({
      name: 'mode',
      label: 'Mode',
      value: 0.4,          // Default: Alpha (calm focus)
      defaultValue: 0.4,
      unit: '',
      color: '#b4a0ff',    // mist purple — cognitive/mental
    })
    this.registerParam({
      name: 'carrier',
      label: 'Carrier',
      value: 0.3,          // ~150 Hz
      defaultValue: 0.3,
      unit: 'Hz',
      color: '#4a9eff',    // frost blue
    })
    this.registerParam({
      name: 'depth',
      label: 'Depth',
      value: 0.6,
      defaultValue: 0.6,
      unit: '%',
      color: '#4af0c0',    // glow teal
    })
    this.registerParam({
      name: 'warmth',
      label: 'Warmth',
      value: 0.5,
      defaultValue: 0.5,
      unit: '%',
      color: '#ff6b4a',    // ember orange
    })
    this.registerParam({
      name: 'isochronal',
      label: 'Pulse',
      value: 0.0,          // Off by default (pure binaural)
      defaultValue: 0.0,
      unit: '%',
      color: '#7acc4a',    // moss green
    })
  }

  getInfo(): EngineInfo {
    return {
      type: 'binaural' as EngineType,
      name: 'Brainwave',
      description: 'Binaural beats & isochronal tones for focus, calm, and sleep',
      category: 'therapeutic',
      icon: '🧠',
      defaultParams: {
        mode: 0.4,
        carrier: 0.3,
        depth: 0.6,
        warmth: 0.5,
        isochronal: 0.0,
      },
    }
  }

  /**
   * Map the 0-1 mode value to a beat frequency (Hz).
   * Continuous — slide through all bands smoothly.
   */
  private getBeatFrequency(modeValue: number): number {
    // Map 0-1 to band index + position within band
    const scaled = modeValue * (BANDS.length - 1)
    const bandIndex = Math.min(Math.floor(scaled), BANDS.length - 1)
    const bandFrac = scaled - bandIndex

    const band = BANDS[bandIndex]
    const nextBand = BANDS[Math.min(bandIndex + 1, BANDS.length - 1)]

    // Interpolate between current band center and next band center
    const currentFreq = band.minHz + bandFrac * (band.maxHz - band.minHz)
    const nextFreq = nextBand.minHz

    // Smooth transition between bands
    if (bandFrac > 0.8 && bandIndex < BANDS.length - 1) {
      const crossfade = (bandFrac - 0.8) / 0.2
      return currentFreq * (1 - crossfade) + nextFreq * crossfade
    }
    return currentFreq
  }

  /**
   * Get the carrier frequency from the normalized parameter.
   * Range: 100 Hz to 432 Hz (432 Hz is the "natural tuning" frequency
   * some research associates with relaxation).
   */
  private getCarrierFrequency(carrierValue: number): number {
    return this.scaleExp(carrierValue, 100, 432)
  }

  protected setup(): void {
    const carrierFreq = this.getCarrierFrequency(this.getParameter('carrier'))
    const beatFreq = this.getBeatFrequency(this.getParameter('mode'))
    const depthValue = this.getParameter('depth')
    const warmthValue = this.getParameter('warmth')
    const isoValue = this.getParameter('isochronal')

    // ── Binaural Pair ──
    // Left ear: carrier frequency
    this.leftOsc = this.ctx.createOscillator()
    this.leftOsc.type = 'sine'
    this.leftOsc.frequency.value = carrierFreq

    this.leftGain = this.ctx.createGain()
    this.leftGain.gain.value = 0.5

    // Right ear: carrier + beat frequency
    this.rightOsc = this.ctx.createOscillator()
    this.rightOsc.type = 'sine'
    this.rightOsc.frequency.value = carrierFreq + beatFreq

    this.rightGain = this.ctx.createGain()
    this.rightGain.gain.value = 0.5

    // Merge into true stereo (left → ch0, right → ch1)
    this.merger = this.ctx.createChannelMerger(2)
    this.leftOsc.connect(this.leftGain)
    this.leftGain.connect(this.merger, 0, 0)   // left channel
    this.rightOsc.connect(this.rightGain)
    this.rightGain.connect(this.merger, 0, 1)   // right channel

    // ── Warmth Filter ──
    // Low-pass to soften the tone (processes stereo correctly)
    this.mainFilter = this.ctx.createBiquadFilter()
    this.mainFilter.type = 'lowpass'
    this.mainFilter.frequency.value = this.scaleExp(warmthValue, 300, 8000)
    this.mainFilter.Q.value = 0.7 // Gentle slope, no resonance

    this.merger.connect(this.mainFilter)

    // ── Isochronal Pulse (Amplitude Modulation) ──
    // LFO oscillates the gain at the beat frequency
    // This works through speakers — no headphones needed
    this.isoLfo = this.ctx.createOscillator()
    this.isoLfo.type = 'sine'
    this.isoLfo.frequency.value = beatFreq

    this.isoLfoGain = this.ctx.createGain()
    // Depth of AM modulation (0 = no pulse, 0.5 = full on/off)
    this.isoLfoGain.gain.value = isoValue * 0.5

    // Wet path: pulsed signal
    this.isoMix = this.ctx.createGain()
    this.isoMix.gain.value = 0.5 // base level for AM

    // Connect LFO to modulate the wet gain
    this.isoLfo.connect(this.isoLfoGain)
    this.isoLfoGain.connect(this.isoMix.gain)

    // Dry path: steady binaural signal
    this.dryMix = this.ctx.createGain()
    this.dryMix.gain.value = 1.0 - isoValue

    // Route filtered signal through both paths
    this.mainFilter.connect(this.isoMix)
    this.mainFilter.connect(this.dryMix)

    this.isoMix.gain.value = isoValue > 0.01 ? 0.5 : 0
    this.isoMix.connect(this.output)
    this.dryMix.connect(this.output)

    // ── Comfort Pad ──
    // Soft detuned pad for warmth (avoids clinical feel of pure sines)
    this.padOsc = this.ctx.createOscillator()
    this.padOsc.type = 'sine'
    this.padOsc.frequency.value = carrierFreq * 0.5 // One octave below
    this.padOsc.detune.value = -5 // Slightly detuned for width

    this.padOsc2 = this.ctx.createOscillator()
    this.padOsc2.type = 'triangle'
    this.padOsc2.frequency.value = carrierFreq * 0.5
    this.padOsc2.detune.value = 5

    this.padFilter = this.ctx.createBiquadFilter()
    this.padFilter.type = 'lowpass'
    this.padFilter.frequency.value = this.scaleExp(warmthValue, 200, 2000)
    this.padFilter.Q.value = 0.5

    this.padGain = this.ctx.createGain()
    this.padGain.gain.value = depthValue * 0.12 // Very subtle bed

    this.padOsc.connect(this.padFilter)
    this.padOsc2.connect(this.padFilter)
    this.padFilter.connect(this.padGain)
    this.padGain.connect(this.output)

    // ── Sub Bass ──
    // Ultra-low sine for physical presence (felt, not heard)
    this.subOsc = this.ctx.createOscillator()
    this.subOsc.type = 'sine'
    this.subOsc.frequency.value = carrierFreq * 0.25

    this.subGain = this.ctx.createGain()
    this.subGain.gain.value = depthValue * 0.08

    this.subOsc.connect(this.subGain)
    this.subGain.connect(this.output)

    // ── Start Everything ──
    const now = this.ctx.currentTime
    this.leftOsc.start(now)
    this.rightOsc.start(now)
    this.isoLfo.start(now)
    this.padOsc.start(now)
    this.padOsc2.start(now)
    this.subOsc.start(now)
  }

  protected applyParameter(name: string, value: number): void {
    const now = this.ctx.currentTime
    const smooth = 0.3 // Smooth transition time constant

    switch (name) {
      case 'mode': {
        const beatFreq = this.getBeatFrequency(value)
        const carrierFreq = this.getCarrierFrequency(this.getParameter('carrier'))

        // Update right oscillator to new beat frequency
        this.rightOsc?.frequency.setTargetAtTime(
          carrierFreq + beatFreq,
          now,
          smooth
        )

        // Update isochronal LFO to match new beat
        this.isoLfo?.frequency.setTargetAtTime(beatFreq, now, smooth)
        break
      }

      case 'carrier': {
        const newCarrier = this.getCarrierFrequency(value)
        const beatFreq = this.getBeatFrequency(this.getParameter('mode'))

        // Update both oscillators
        this.leftOsc?.frequency.setTargetAtTime(newCarrier, now, smooth)
        this.rightOsc?.frequency.setTargetAtTime(
          newCarrier + beatFreq,
          now,
          smooth
        )

        // Update pad and sub
        this.padOsc?.frequency.setTargetAtTime(newCarrier * 0.5, now, smooth)
        this.padOsc2?.frequency.setTargetAtTime(newCarrier * 0.5, now, smooth)
        this.subOsc?.frequency.setTargetAtTime(newCarrier * 0.25, now, smooth)
        break
      }

      case 'depth': {
        // Controls binaural signal strength and pad presence
        this.leftGain?.gain.setTargetAtTime(
          this.scale(value, 0.2, 0.7),
          now,
          0.1
        )
        this.rightGain?.gain.setTargetAtTime(
          this.scale(value, 0.2, 0.7),
          now,
          0.1
        )
        this.padGain?.gain.setTargetAtTime(value * 0.12, now, 0.2)
        this.subGain?.gain.setTargetAtTime(value * 0.08, now, 0.2)
        break
      }

      case 'warmth': {
        // Adjusts low-pass filter cutoff
        this.mainFilter?.frequency.setTargetAtTime(
          this.scaleExp(value, 300, 8000),
          now,
          smooth
        )
        this.padFilter?.frequency.setTargetAtTime(
          this.scaleExp(value, 200, 2000),
          now,
          smooth
        )
        break
      }

      case 'isochronal': {
        // Crossfade between dry (binaural) and wet (pulsed) signals
        const isoAmount = value
        this.dryMix?.gain.setTargetAtTime(1.0 - isoAmount, now, 0.1)
        this.isoMix?.gain.setTargetAtTime(
          isoAmount > 0.01 ? 0.5 : 0,
          now,
          0.1
        )
        this.isoLfoGain?.gain.setTargetAtTime(isoAmount * 0.5, now, 0.1)
        break
      }
    }
  }

  protected cleanup(): void {
    // Stop all oscillators
    const oscs = [
      this.leftOsc, this.rightOsc, this.isoLfo,
      this.padOsc, this.padOsc2, this.subOsc,
    ]
    for (const osc of oscs) {
      try { osc?.stop() } catch { /* already stopped */ }
      osc?.disconnect()
    }

    // Disconnect all nodes
    const nodes = [
      this.leftGain, this.rightGain, this.merger,
      this.mainFilter, this.isoLfoGain, this.isoMix,
      this.dryMix, this.padFilter, this.padGain,
      this.subGain,
    ]
    for (const node of nodes) {
      node?.disconnect()
    }

    // Null everything
    this.leftOsc = null
    this.rightOsc = null
    this.leftGain = null
    this.rightGain = null
    this.merger = null
    this.mainFilter = null
    this.isoLfo = null
    this.isoLfoGain = null
    this.isoMix = null
    this.dryMix = null
    this.padOsc = null
    this.padOsc2 = null
    this.padFilter = null
    this.padGain = null
    this.subOsc = null
    this.subGain = null
  }
}

export default BrainwaveEngine
