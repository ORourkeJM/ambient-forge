/**
 * OceanEngine — Rhythmic filtered noise with foam spray.
 *
 * Uses filtered noise with a rhythmic amplitude envelope controlled
 * by a slow LFO to simulate wave crests and troughs. Layered with
 * high-frequency foam/spray noise on the crest peak.
 *
 * Parameters:
 * - tempo: wave frequency (0-1)
 * - power: wave amplitude (0-1)
 * - foam: high-freq spray amount (0-1)
 * - distance: overall filtering — close vs far shore (0-1)
 * - undertow: low-frequency sub-bass pull (0-1)
 */

import { AudioEngine } from '../AudioEngine'
import type { EngineInfo, EngineType } from '../../types/audio'

export class OceanEngine extends AudioEngine {
  // Main wave noise
  private noiseSource: AudioBufferSourceNode | null = null
  private waveFilter: BiquadFilterNode | null = null
  private waveGain: GainNode | null = null
  private distanceFilter: BiquadFilterNode | null = null

  // Wave amplitude LFO
  private waveLfo: OscillatorNode | null = null
  private waveLfoGain: GainNode | null = null

  // Foam layer
  private foamSource: AudioBufferSourceNode | null = null
  private foamFilter: BiquadFilterNode | null = null
  private foamGain: GainNode | null = null
  private foamLfoGain: GainNode | null = null

  // Undertow — sub bass
  private undertowOsc: OscillatorNode | null = null
  private undertowGain: GainNode | null = null
  private undertowLfo: OscillatorNode | null = null
  private undertowLfoGain: GainNode | null = null

  // Second wave layer for more natural feel
  private noise2Source: AudioBufferSourceNode | null = null
  private wave2Filter: BiquadFilterNode | null = null
  private wave2Gain: GainNode | null = null
  private wave2Lfo: OscillatorNode | null = null
  private wave2LfoGain: GainNode | null = null

  constructor() {
    super()

    this.registerParam({
      name: 'tempo',
      label: 'Tempo',
      value: 0.4,
      defaultValue: 0.4,
      unit: '%',
      color: '#4a9eff',
    })
    this.registerParam({
      name: 'power',
      label: 'Power',
      value: 0.5,
      defaultValue: 0.5,
      unit: '%',
      color: '#4a9eff',
    })
    this.registerParam({
      name: 'foam',
      label: 'Foam',
      value: 0.3,
      defaultValue: 0.3,
      unit: '%',
      color: '#e2e4f0',
    })
    this.registerParam({
      name: 'distance',
      label: 'Distance',
      value: 0.5,
      defaultValue: 0.5,
      unit: '%',
      color: '#4af0c0',
    })
    this.registerParam({
      name: 'undertow',
      label: 'Undertow',
      value: 0.3,
      defaultValue: 0.3,
      unit: '%',
      color: '#b4a0ff',
    })
  }

  getInfo(): EngineInfo {
    return {
      type: 'ocean' as EngineType,
      name: 'Ocean Waves',
      description: 'Rhythmic filtered noise with foam spray',
      category: 'nature',
      icon: '🌊',
      defaultParams: { tempo: 0.4, power: 0.5, foam: 0.3, distance: 0.5, undertow: 0.3 },
    }
  }

  protected setup(): void {
    // Create noise buffers
    const bufferSize = this.ctx.sampleRate * 4
    const buffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = buffer.getChannelData(ch)
      for (let i = 0; i < bufferSize; i++) {
        d[i] = Math.random() * 2 - 1
      }
    }

    const tempoVal = this.getParameter('tempo')
    const waveRate = this.scale(tempoVal, 0.06, 0.25)

    // ── Primary wave layer ──
    this.noiseSource = this.ctx.createBufferSource()
    this.noiseSource.buffer = buffer
    this.noiseSource.loop = true

    this.waveFilter = this.ctx.createBiquadFilter()
    this.waveFilter.type = 'lowpass'
    this.waveFilter.frequency.value = 1200
    this.waveFilter.Q.value = 0.6

    this.distanceFilter = this.ctx.createBiquadFilter()
    this.distanceFilter.type = 'lowpass'
    const dist = this.getParameter('distance')
    this.distanceFilter.frequency.value = this.scaleExp(1 - dist, 600, 8000)
    this.distanceFilter.Q.value = 0.5

    this.waveGain = this.ctx.createGain()
    this.waveGain.gain.value = 0.3

    // Wave amplitude LFO — this creates the rhythmic crest/trough
    this.waveLfo = this.ctx.createOscillator()
    this.waveLfo.type = 'sine'
    this.waveLfo.frequency.value = waveRate

    this.waveLfoGain = this.ctx.createGain()
    this.waveLfoGain.gain.value = this.getParameter('power') * 0.35

    this.waveLfo.connect(this.waveLfoGain)
    this.waveLfoGain.connect(this.waveGain.gain)

    // Wire primary wave
    this.noiseSource.connect(this.waveFilter)
    this.waveFilter.connect(this.distanceFilter)
    this.distanceFilter.connect(this.waveGain)
    this.waveGain.connect(this.output)

    // ── Second wave layer (slightly different rate for natural overlap) ──
    this.noise2Source = this.ctx.createBufferSource()
    this.noise2Source.buffer = buffer
    this.noise2Source.loop = true

    this.wave2Filter = this.ctx.createBiquadFilter()
    this.wave2Filter.type = 'lowpass'
    this.wave2Filter.frequency.value = 800
    this.wave2Filter.Q.value = 0.4

    this.wave2Gain = this.ctx.createGain()
    this.wave2Gain.gain.value = 0.15

    this.wave2Lfo = this.ctx.createOscillator()
    this.wave2Lfo.type = 'sine'
    this.wave2Lfo.frequency.value = waveRate * 0.7 // Slightly slower for overlap

    this.wave2LfoGain = this.ctx.createGain()
    this.wave2LfoGain.gain.value = this.getParameter('power') * 0.2

    this.wave2Lfo.connect(this.wave2LfoGain)
    this.wave2LfoGain.connect(this.wave2Gain.gain)

    this.noise2Source.connect(this.wave2Filter)
    this.wave2Filter.connect(this.wave2Gain)
    this.wave2Gain.connect(this.output)

    // ── Foam layer — high-frequency spray on crests ──
    this.foamSource = this.ctx.createBufferSource()
    this.foamSource.buffer = buffer
    this.foamSource.loop = true

    this.foamFilter = this.ctx.createBiquadFilter()
    this.foamFilter.type = 'highpass'
    this.foamFilter.frequency.value = 3000
    this.foamFilter.Q.value = 0.5

    this.foamGain = this.ctx.createGain()
    this.foamGain.gain.value = 0 // Modulated by LFO

    this.foamLfoGain = this.ctx.createGain()
    this.foamLfoGain.gain.value = this.getParameter('foam') * 0.2

    // Use same wave LFO to sync foam with wave crests
    this.waveLfo.connect(this.foamLfoGain)
    this.foamLfoGain.connect(this.foamGain.gain)

    this.foamSource.connect(this.foamFilter)
    this.foamFilter.connect(this.foamGain)
    this.foamGain.connect(this.output)

    // ── Undertow — sub bass oscillator ──
    this.undertowOsc = this.ctx.createOscillator()
    this.undertowOsc.type = 'sine'
    this.undertowOsc.frequency.value = 35

    this.undertowGain = this.ctx.createGain()
    this.undertowGain.gain.value = 0

    this.undertowLfo = this.ctx.createOscillator()
    this.undertowLfo.type = 'sine'
    this.undertowLfo.frequency.value = waveRate * 0.5

    this.undertowLfoGain = this.ctx.createGain()
    this.undertowLfoGain.gain.value = this.getParameter('undertow') * 0.15

    this.undertowLfo.connect(this.undertowLfoGain)
    this.undertowLfoGain.connect(this.undertowGain.gain)

    this.undertowOsc.connect(this.undertowGain)
    this.undertowGain.connect(this.output)

    // Start everything
    this.noiseSource.start()
    this.noise2Source.start()
    this.foamSource.start()
    this.waveLfo.start()
    this.wave2Lfo.start()
    this.undertowOsc.start()
    this.undertowLfo.start()
  }

  protected applyParameter(name: string, value: number): void {
    const now = this.ctx.currentTime

    switch (name) {
      case 'tempo': {
        const rate = this.scale(value, 0.06, 0.25)
        this.waveLfo?.frequency.setTargetAtTime(rate, now, 0.5)
        this.wave2Lfo?.frequency.setTargetAtTime(rate * 0.7, now, 0.5)
        this.undertowLfo?.frequency.setTargetAtTime(rate * 0.5, now, 0.5)
        break
      }
      case 'power':
        this.waveLfoGain?.gain.setTargetAtTime(value * 0.35, now, 0.2)
        this.wave2LfoGain?.gain.setTargetAtTime(value * 0.2, now, 0.2)
        break
      case 'foam':
        this.foamLfoGain?.gain.setTargetAtTime(value * 0.2, now, 0.2)
        break
      case 'distance': {
        this.distanceFilter?.frequency.setTargetAtTime(
          this.scaleExp(1 - value, 600, 8000), now, 0.3
        )
        break
      }
      case 'undertow':
        this.undertowLfoGain?.gain.setTargetAtTime(value * 0.15, now, 0.2)
        break
    }
  }

  protected cleanup(): void {
    try { this.noiseSource?.stop() } catch { /* */ }
    try { this.noise2Source?.stop() } catch { /* */ }
    try { this.foamSource?.stop() } catch { /* */ }
    try { this.waveLfo?.stop() } catch { /* */ }
    try { this.wave2Lfo?.stop() } catch { /* */ }
    try { this.undertowOsc?.stop() } catch { /* */ }
    try { this.undertowLfo?.stop() } catch { /* */ }

    this.noiseSource?.disconnect()
    this.waveFilter?.disconnect()
    this.waveGain?.disconnect()
    this.distanceFilter?.disconnect()
    this.waveLfo?.disconnect()
    this.waveLfoGain?.disconnect()
    this.noise2Source?.disconnect()
    this.wave2Filter?.disconnect()
    this.wave2Gain?.disconnect()
    this.wave2Lfo?.disconnect()
    this.wave2LfoGain?.disconnect()
    this.foamSource?.disconnect()
    this.foamFilter?.disconnect()
    this.foamGain?.disconnect()
    this.foamLfoGain?.disconnect()
    this.undertowOsc?.disconnect()
    this.undertowGain?.disconnect()
    this.undertowLfo?.disconnect()
    this.undertowLfoGain?.disconnect()

    this.noiseSource = null
    this.waveFilter = null
    this.waveGain = null
    this.distanceFilter = null
    this.waveLfo = null
    this.waveLfoGain = null
    this.noise2Source = null
    this.wave2Filter = null
    this.wave2Gain = null
    this.wave2Lfo = null
    this.wave2LfoGain = null
    this.foamSource = null
    this.foamFilter = null
    this.foamGain = null
    this.foamLfoGain = null
    this.undertowOsc = null
    this.undertowGain = null
    this.undertowLfo = null
    this.undertowLfoGain = null
  }
}

export default OceanEngine
