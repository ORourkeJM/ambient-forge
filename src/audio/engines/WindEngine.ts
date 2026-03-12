/**
 * WindEngine — Modulated bandpass noise for natural wind.
 *
 * Uses bandpass-filtered noise with slow LFO modulation on the center
 * frequency to create natural-sounding wind gusts.
 *
 * Parameters:
 * - speed: LFO rate + filter Q (0-1)
 * - gustiness: LFO depth (0-1)
 * - direction: stereo panning modulation (0-1)
 * - howl: high-frequency resonant peak (0-1)
 */

import { AudioEngine } from '../AudioEngine'
import type { EngineInfo, EngineType } from '../../types/audio'

export class WindEngine extends AudioEngine {
  // Core noise
  private noiseSource: AudioBufferSourceNode | null = null
  private noiseGain: GainNode | null = null

  // Main bandpass
  private bandpass: BiquadFilterNode | null = null

  // LFO for frequency modulation
  private lfo: OscillatorNode | null = null
  private lfoGain: GainNode | null = null

  // Second LFO for amplitude (gusts)
  private gustLfo: OscillatorNode | null = null
  private gustGain: GainNode | null = null

  // Howl — high resonant peak
  private howlFilter: BiquadFilterNode | null = null
  private howlGain: GainNode | null = null

  // Stereo movement
  private panLfo: OscillatorNode | null = null
  private panLfoGain: GainNode | null = null

  constructor() {
    super()

    this.registerParam({
      name: 'speed',
      label: 'Speed',
      value: 0.4,
      defaultValue: 0.4,
      unit: '%',
      color: '#4af0c0',
    })
    this.registerParam({
      name: 'gustiness',
      label: 'Gustiness',
      value: 0.5,
      defaultValue: 0.5,
      unit: '%',
      color: '#4af0c0',
    })
    this.registerParam({
      name: 'direction',
      label: 'Direction',
      value: 0.5,
      defaultValue: 0.5,
      unit: '%',
      color: '#b4a0ff',
    })
    this.registerParam({
      name: 'howl',
      label: 'Howl',
      value: 0.2,
      defaultValue: 0.2,
      unit: '%',
      color: '#ff6b4a',
    })
  }

  getInfo(): EngineInfo {
    return {
      type: 'wind' as EngineType,
      name: 'Wind',
      description: 'Modulated bandpass noise with natural gusting',
      category: 'nature',
      icon: '💨',
      defaultParams: {
        speed: 0.4,
        gustiness: 0.5,
        direction: 0.5,
        howl: 0.2,
      },
    }
  }

  protected setup(): void {
    // White noise buffer
    const bufferSize = this.ctx.sampleRate * 2
    const buffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1
      }
    }

    this.noiseSource = this.ctx.createBufferSource()
    this.noiseSource.buffer = buffer
    this.noiseSource.loop = true

    // Main bandpass filter — center frequency modulated by LFO
    this.bandpass = this.ctx.createBiquadFilter()
    this.bandpass.type = 'bandpass'
    this.bandpass.frequency.value = 600
    this.bandpass.Q.value = this.scale(this.getParameter('speed'), 0.5, 3)

    // Frequency LFO — slow modulation of the bandpass center
    this.lfo = this.ctx.createOscillator()
    this.lfo.type = 'sine'
    this.lfo.frequency.value = this.scale(this.getParameter('speed'), 0.05, 0.4)

    this.lfoGain = this.ctx.createGain()
    this.lfoGain.gain.value = this.scale(this.getParameter('gustiness'), 100, 800)

    this.lfo.connect(this.lfoGain)
    this.lfoGain.connect(this.bandpass.frequency)

    // Gust LFO — amplitude modulation for wind gusts
    this.gustLfo = this.ctx.createOscillator()
    this.gustLfo.type = 'sine'
    this.gustLfo.frequency.value = this.scale(this.getParameter('speed'), 0.08, 0.3)

    this.gustGain = this.ctx.createGain()
    this.gustGain.gain.value = this.scale(this.getParameter('gustiness'), 0.1, 0.5)

    this.noiseGain = this.ctx.createGain()
    this.noiseGain.gain.value = 0.7

    // Connect gust LFO to noise gain
    this.gustLfo.connect(this.gustGain)
    this.gustGain.connect(this.noiseGain.gain)

    // Howl — high resonant peak
    this.howlFilter = this.ctx.createBiquadFilter()
    this.howlFilter.type = 'peaking'
    this.howlFilter.frequency.value = 2500
    this.howlFilter.Q.value = 8
    this.howlFilter.gain.value = this.scale(this.getParameter('howl'), 0, 15)

    this.howlGain = this.ctx.createGain()
    this.howlGain.gain.value = this.getParameter('howl') * 0.4

    // Stereo panning LFO
    this.panLfo = this.ctx.createOscillator()
    this.panLfo.type = 'sine'
    this.panLfo.frequency.value = 0.07

    this.panLfoGain = this.ctx.createGain()
    this.panLfoGain.gain.value = this.scale(this.getParameter('direction'), 0, 0.8)

    this.panLfo.connect(this.panLfoGain)
    this.panLfoGain.connect(this.panNode.pan)

    // Signal chain:
    // noise → bandpass → noiseGain → output (main wind)
    // noise → howlFilter → howlGain → output (howl layer)
    this.noiseSource.connect(this.bandpass)
    this.bandpass.connect(this.noiseGain)
    this.noiseGain.connect(this.output)

    // Howl layer
    this.noiseSource.connect(this.howlFilter)
    this.howlFilter.connect(this.howlGain)
    this.howlGain.connect(this.output)

    // Start everything
    this.noiseSource.start()
    this.lfo.start()
    this.gustLfo.start()
    this.panLfo.start()
  }

  protected applyParameter(name: string, value: number): void {
    const now = this.ctx.currentTime

    switch (name) {
      case 'speed':
        this.lfo?.frequency.setTargetAtTime(
          this.scale(value, 0.05, 0.4),
          now,
          0.2
        )
        this.gustLfo?.frequency.setTargetAtTime(
          this.scale(value, 0.08, 0.3),
          now,
          0.2
        )
        this.bandpass?.Q.setTargetAtTime(
          this.scale(value, 0.5, 3),
          now,
          0.1
        )
        break

      case 'gustiness':
        this.lfoGain?.gain.setTargetAtTime(
          this.scale(value, 100, 800),
          now,
          0.2
        )
        this.gustGain?.gain.setTargetAtTime(
          this.scale(value, 0.1, 0.5),
          now,
          0.2
        )
        break

      case 'direction':
        this.panLfoGain?.gain.setTargetAtTime(
          this.scale(value, 0, 0.8),
          now,
          0.2
        )
        break

      case 'howl':
        this.howlFilter?.gain.setTargetAtTime(
          this.scale(value, 0, 15),
          now,
          0.1
        )
        this.howlGain?.gain.setTargetAtTime(value * 0.4, now, 0.1)
        break
    }
  }

  protected cleanup(): void {
    try { this.noiseSource?.stop() } catch { /* already stopped */ }
    try { this.lfo?.stop() } catch { /* */ }
    try { this.gustLfo?.stop() } catch { /* */ }
    try { this.panLfo?.stop() } catch { /* */ }

    this.noiseSource?.disconnect()
    this.noiseGain?.disconnect()
    this.bandpass?.disconnect()
    this.lfo?.disconnect()
    this.lfoGain?.disconnect()
    this.gustLfo?.disconnect()
    this.gustGain?.disconnect()
    this.howlFilter?.disconnect()
    this.howlGain?.disconnect()
    this.panLfo?.disconnect()
    this.panLfoGain?.disconnect()

    this.noiseSource = null
    this.noiseGain = null
    this.bandpass = null
    this.lfo = null
    this.lfoGain = null
    this.gustLfo = null
    this.gustGain = null
    this.howlFilter = null
    this.howlGain = null
    this.panLfo = null
    this.panLfoGain = null
  }
}

export default WindEngine
