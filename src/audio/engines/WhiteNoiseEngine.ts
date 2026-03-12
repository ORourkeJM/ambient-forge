/**
 * WhiteNoiseEngine — Colored noise generator with filter sweeps.
 *
 * Produces white, pink, or brown noise with a sweepable bandpass filter
 * and optional stereo widening. Popular for focus, sleep, and tinnitus masking.
 *
 * Noise colors:
 *   White  — Equal energy across all frequencies (bright, hissy)
 *   Pink   — Equal energy per octave, -3dB/octave rolloff (natural, balanced)
 *   Brown  — Steep rolloff, -6dB/octave (deep, warm, like a waterfall)
 *
 * Parameters:
 * - color:    Noise color blend (white → pink → brown)
 * - filter:   Bandpass center frequency sweep
 * - width:    Filter bandwidth (narrow = focused tone, wide = full spectrum)
 * - stereo:   Stereo decorrelation / widening amount
 * - movement: Slow automatic filter sweep
 */

import { AudioEngine } from '../AudioEngine'
import type { EngineInfo, EngineType } from '../../types/audio'

export class WhiteNoiseEngine extends AudioEngine {
  // Noise sources (two for stereo decorrelation)
  private noiseL: AudioBufferSourceNode | null = null
  private noiseR: AudioBufferSourceNode | null = null

  // Filter chain
  private filterL: BiquadFilterNode | null = null
  private filterR: BiquadFilterNode | null = null

  // Stereo merge
  private gainL: GainNode | null = null
  private gainR: GainNode | null = null
  private merger: ChannelMergerNode | null = null

  // Filter movement LFO
  private sweepLfo: OscillatorNode | null = null
  private sweepLfoGain: GainNode | null = null

  // Noise color shaping (low-pass for pink/brown simulation)
  private colorFilterL: BiquadFilterNode | null = null
  private colorFilterR: BiquadFilterNode | null = null

  // Current noise buffers (so we can rebuild on color change)
  private noiseBufferL: AudioBuffer | null = null
  private noiseBufferR: AudioBuffer | null = null

  constructor() {
    super()

    this.registerParam({
      name: 'color',
      label: 'Color',
      value: 0.5,          // Default: pink-ish
      defaultValue: 0.5,
      unit: '',
      color: '#b4a0ff',    // mist purple
    })
    this.registerParam({
      name: 'filter',
      label: 'Filter',
      value: 0.5,
      defaultValue: 0.5,
      unit: 'Hz',
      color: '#4a9eff',    // frost blue
    })
    this.registerParam({
      name: 'width',
      label: 'Width',
      value: 0.7,          // Fairly wide by default
      defaultValue: 0.7,
      unit: '%',
      color: '#4af0c0',    // glow teal
    })
    this.registerParam({
      name: 'stereo',
      label: 'Stereo',
      value: 0.4,
      defaultValue: 0.4,
      unit: '%',
      color: '#7acc4a',    // moss green
    })
    this.registerParam({
      name: 'movement',
      label: 'Movement',
      value: 0.2,
      defaultValue: 0.2,
      unit: '%',
      color: '#ff6b4a',    // ember orange
    })
  }

  getInfo(): EngineInfo {
    return {
      type: 'whitenoise' as EngineType,
      name: 'Noise',
      description: 'White, pink, and brown noise with sweepable filters',
      category: 'synthetic',
      icon: '📡',
      defaultParams: {
        color: 0.5,
        filter: 0.5,
        width: 0.7,
        stereo: 0.4,
        movement: 0.2,
      },
    }
  }

  /**
   * Generate a noise buffer.
   * Uses different algorithms per noise color.
   */
  private generateNoiseBuffer(seed: number): AudioBuffer {
    const sampleRate = this.ctx.sampleRate
    const length = sampleRate * 4 // 4 seconds, looped
    const buffer = this.ctx.createBuffer(1, length, sampleRate)
    const data = buffer.getChannelData(0)

    // Use a seeded-ish random for slight L/R decorrelation
    let rng = seed

    for (let i = 0; i < length; i++) {
      // Simple LCG PRNG for reproducible but decorrelated noise
      rng = (rng * 1664525 + 1013904223) & 0xFFFFFFFF
      data[i] = (rng / 0x7FFFFFFF) - 1
    }

    return buffer
  }

  protected setup(): void {
    const colorValue = this.getParameter('color')
    const filterValue = this.getParameter('filter')
    const widthValue = this.getParameter('width')
    const stereoValue = this.getParameter('stereo')
    const movementValue = this.getParameter('movement')

    // ── Generate Noise Buffers ──
    this.noiseBufferL = this.generateNoiseBuffer(12345)
    this.noiseBufferR = this.generateNoiseBuffer(67890)

    // ── Noise Sources ──
    this.noiseL = this.ctx.createBufferSource()
    this.noiseL.buffer = this.noiseBufferL
    this.noiseL.loop = true

    this.noiseR = this.ctx.createBufferSource()
    this.noiseR.buffer = this.noiseBufferR
    this.noiseR.loop = true

    // ── Color Shaping Filters ──
    // Low-pass filter simulates pink (-3dB/oct) → brown (-6dB/oct)
    const colorFreq = this.getColorFrequency(colorValue)

    this.colorFilterL = this.ctx.createBiquadFilter()
    this.colorFilterL.type = 'lowpass'
    this.colorFilterL.frequency.value = colorFreq
    this.colorFilterL.Q.value = 0.5

    this.colorFilterR = this.ctx.createBiquadFilter()
    this.colorFilterR.type = 'lowpass'
    this.colorFilterR.frequency.value = colorFreq
    this.colorFilterR.Q.value = 0.5

    // ── Bandpass Filters ──
    const centerFreq = this.scaleExp(filterValue, 60, 12000)
    const q = this.scale(1 - widthValue, 0.1, 8) // Inverted: high width = low Q

    this.filterL = this.ctx.createBiquadFilter()
    this.filterL.type = 'bandpass'
    this.filterL.frequency.value = centerFreq
    this.filterL.Q.value = q

    this.filterR = this.ctx.createBiquadFilter()
    this.filterR.type = 'bandpass'
    this.filterR.frequency.value = centerFreq
    this.filterR.Q.value = q

    // ── Filter Movement LFO ──
    this.sweepLfo = this.ctx.createOscillator()
    this.sweepLfo.type = 'sine'
    this.sweepLfo.frequency.value = this.scale(movementValue, 0.01, 0.15)

    this.sweepLfoGain = this.ctx.createGain()
    this.sweepLfoGain.gain.value = this.scale(movementValue, 0, 3000)

    this.sweepLfo.connect(this.sweepLfoGain)
    this.sweepLfoGain.connect(this.filterL.frequency)
    this.sweepLfoGain.connect(this.filterR.frequency)

    // ── Stereo Gains ──
    this.gainL = this.ctx.createGain()
    this.gainR = this.ctx.createGain()

    // Stereo decorrelation: crossfeed between L and R
    const crossfeed = 1 - stereoValue
    this.gainL.gain.value = 0.5
    this.gainR.gain.value = 0.5

    // ── Channel Merger ──
    this.merger = this.ctx.createChannelMerger(2)

    // ── Signal Chain ──
    // noiseL → colorFilterL → filterL → gainL → merger[0]
    // noiseR → colorFilterR → filterR → gainR → merger[1]
    // If stereo is low, also cross-route for mono-ish feel
    this.noiseL.connect(this.colorFilterL)
    this.colorFilterL.connect(this.filterL)
    this.filterL.connect(this.gainL)
    this.gainL.connect(this.merger, 0, 0)

    this.noiseR.connect(this.colorFilterR)
    this.colorFilterR.connect(this.filterR)
    this.filterR.connect(this.gainR)
    this.gainR.connect(this.merger, 0, 1)

    // Cross-routing for mono when stereo is low
    if (crossfeed > 0.3) {
      const crossGainLR = this.ctx.createGain()
      const crossGainRL = this.ctx.createGain()
      crossGainLR.gain.value = (crossfeed - 0.3) * 0.4
      crossGainRL.gain.value = (crossfeed - 0.3) * 0.4

      this.filterL.connect(crossGainLR)
      crossGainLR.connect(this.merger, 0, 1) // L→R

      this.filterR.connect(crossGainRL)
      crossGainRL.connect(this.merger, 0, 0) // R→L
    }

    this.merger.connect(this.output)

    // ── Start ──
    const now = this.ctx.currentTime
    this.noiseL.start(now)
    this.noiseR.start(now)
    this.sweepLfo.start(now)
  }

  /**
   * Map the 0-1 color parameter to a low-pass frequency.
   * 0 = white (no filtering, 20kHz), 0.5 = pink (~3kHz), 1 = brown (~300Hz)
   */
  private getColorFrequency(value: number): number {
    if (value < 0.05) return 20000 // Pure white
    return this.scaleExp(1 - value, 200, 20000)
  }

  protected applyParameter(name: string, value: number): void {
    const now = this.ctx.currentTime

    switch (name) {
      case 'color': {
        const freq = this.getColorFrequency(value)
        this.colorFilterL?.frequency.setTargetAtTime(freq, now, 0.3)
        this.colorFilterR?.frequency.setTargetAtTime(freq, now, 0.3)
        break
      }

      case 'filter': {
        const centerFreq = this.scaleExp(value, 60, 12000)
        this.filterL?.frequency.setTargetAtTime(centerFreq, now, 0.2)
        this.filterR?.frequency.setTargetAtTime(centerFreq, now, 0.2)
        break
      }

      case 'width': {
        const q = this.scale(1 - value, 0.1, 8)
        this.filterL?.Q.setTargetAtTime(q, now, 0.2)
        this.filterR?.Q.setTargetAtTime(q, now, 0.2)
        break
      }

      case 'stereo': {
        // Can't easily re-route live, but we can adjust gain crossfeed
        // This is a simplification — full stereo changes would need teardown
        break
      }

      case 'movement': {
        this.sweepLfo?.frequency.setTargetAtTime(
          this.scale(value, 0.01, 0.15),
          now,
          0.3
        )
        this.sweepLfoGain?.gain.setTargetAtTime(
          this.scale(value, 0, 3000),
          now,
          0.3
        )
        break
      }
    }
  }

  protected cleanup(): void {
    // Stop sources
    try { this.noiseL?.stop() } catch { /* */ }
    try { this.noiseR?.stop() } catch { /* */ }
    try { this.sweepLfo?.stop() } catch { /* */ }

    // Disconnect everything
    const nodes = [
      this.noiseL, this.noiseR,
      this.colorFilterL, this.colorFilterR,
      this.filterL, this.filterR,
      this.gainL, this.gainR,
      this.merger,
      this.sweepLfo, this.sweepLfoGain,
    ]
    for (const node of nodes) {
      node?.disconnect()
    }

    // Null everything
    this.noiseL = null
    this.noiseR = null
    this.colorFilterL = null
    this.colorFilterR = null
    this.filterL = null
    this.filterR = null
    this.gainL = null
    this.gainR = null
    this.merger = null
    this.sweepLfo = null
    this.sweepLfoGain = null
    this.noiseBufferL = null
    this.noiseBufferR = null
  }
}

export default WhiteNoiseEngine
