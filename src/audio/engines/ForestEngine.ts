/**
 * ForestEngine — FM-synthesized birds with rustling leaves.
 *
 * Combines FM-synthesized bird chirps (random pitch/timing) with
 * filtered noise for leaf rustling.
 *
 * Parameters:
 * - density: bird call frequency (0-1)
 * - variety: number of distinct chirp patterns (0-1)
 * - rustling: leaf noise level (0-1)
 * - canopy: filter character — dense forest vs sparse (0-1)
 * - timeOfDay: affects chirp patterns (0-1, 0=dawn chorus, 1=quiet night)
 */

import { AudioEngine } from '../AudioEngine'
import type { EngineInfo, EngineType } from '../../types/audio'

interface ChirpPattern {
  baseFreq: number
  freqSweep: number // Hz range of the chirp sweep
  duration: number  // seconds
  repeats: number   // how many notes in the call
  gap: number       // gap between notes in the call
}

export class ForestEngine extends AudioEngine {
  // Rustling layer
  private rustleSource: AudioBufferSourceNode | null = null
  private rustleFilter: BiquadFilterNode | null = null
  private rustleGain: GainNode | null = null
  private rustleLfo: OscillatorNode | null = null
  private rustleLfoGain: GainNode | null = null

  // Canopy filter
  private canopyFilter: BiquadFilterNode | null = null

  // Bird chirp scheduling
  private birdInterval: ReturnType<typeof setTimeout> | null = null
  private birdGain: GainNode | null = null

  // Chirp patterns library
  private chirpPatterns: ChirpPattern[] = []

  constructor() {
    super()

    this.registerParam({
      name: 'density',
      label: 'Density',
      value: 0.4,
      defaultValue: 0.4,
      unit: '%',
      color: '#7acc4a',
    })
    this.registerParam({
      name: 'variety',
      label: 'Variety',
      value: 0.5,
      defaultValue: 0.5,
      unit: '%',
      color: '#7acc4a',
    })
    this.registerParam({
      name: 'rustling',
      label: 'Rustling',
      value: 0.4,
      defaultValue: 0.4,
      unit: '%',
      color: '#4af0c0',
    })
    this.registerParam({
      name: 'canopy',
      label: 'Canopy',
      value: 0.5,
      defaultValue: 0.5,
      unit: '%',
      color: '#4a9eff',
    })
    this.registerParam({
      name: 'timeOfDay',
      label: 'Time of Day',
      value: 0.3,
      defaultValue: 0.3,
      unit: '%',
      color: '#f59e0b',
    })
  }

  getInfo(): EngineInfo {
    return {
      type: 'forest' as EngineType,
      name: 'Forest',
      description: 'FM-synthesized birds with rustling leaves',
      category: 'nature',
      icon: '🌲',
      defaultParams: { density: 0.4, variety: 0.5, rustling: 0.4, canopy: 0.5, timeOfDay: 0.3 },
    }
  }

  private generateChirpPatterns(): void {
    const variety = this.getParameter('variety')
    const numPatterns = Math.floor(this.scale(variety, 2, 8))

    this.chirpPatterns = []
    for (let i = 0; i < numPatterns; i++) {
      this.chirpPatterns.push({
        baseFreq: 2000 + Math.random() * 4000,
        freqSweep: 200 + Math.random() * 1500,
        duration: 0.05 + Math.random() * 0.15,
        repeats: Math.floor(1 + Math.random() * 5),
        gap: 0.04 + Math.random() * 0.12,
      })
    }
  }

  protected setup(): void {
    this.generateChirpPatterns()

    // Rustling — filtered noise with slow modulation
    const bufferSize = this.ctx.sampleRate * 2
    const buffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = buffer.getChannelData(ch)
      for (let i = 0; i < bufferSize; i++) {
        d[i] = Math.random() * 2 - 1
      }
    }

    this.rustleSource = this.ctx.createBufferSource()
    this.rustleSource.buffer = buffer
    this.rustleSource.loop = true

    // High-pass to make it sound like leaves, not wind
    this.rustleFilter = this.ctx.createBiquadFilter()
    this.rustleFilter.type = 'bandpass'
    this.rustleFilter.frequency.value = 4000
    this.rustleFilter.Q.value = 0.3

    this.rustleGain = this.ctx.createGain()
    this.rustleGain.gain.value = this.getParameter('rustling') * 0.15

    // Rustling LFO — gentle amplitude modulation
    this.rustleLfo = this.ctx.createOscillator()
    this.rustleLfo.type = 'sine'
    this.rustleLfo.frequency.value = 0.15 + Math.random() * 0.1

    this.rustleLfoGain = this.ctx.createGain()
    this.rustleLfoGain.gain.value = 0.04

    this.rustleLfo.connect(this.rustleLfoGain)
    this.rustleLfoGain.connect(this.rustleGain.gain)

    // Canopy filter — affects overall frequency character
    this.canopyFilter = this.ctx.createBiquadFilter()
    this.canopyFilter.type = 'lowpass'
    const canopy = this.getParameter('canopy')
    this.canopyFilter.frequency.value = this.scaleExp(1 - canopy, 2000, 12000)
    this.canopyFilter.Q.value = 0.5

    // Bird output
    this.birdGain = this.ctx.createGain()
    this.birdGain.gain.value = 0.25

    // Wire: rustle → rustleFilter → rustleGain → canopyFilter → output
    this.rustleSource.connect(this.rustleFilter)
    this.rustleFilter.connect(this.rustleGain)
    this.rustleGain.connect(this.canopyFilter)
    this.canopyFilter.connect(this.output)

    // Birds → canopyFilter → output
    this.birdGain.connect(this.canopyFilter)

    // Start
    this.rustleSource.start()
    this.rustleLfo.start()
    this.startBirds()
  }

  private startBirds(): void {
    const scheduleBird = () => {
      if (!this.isRunning || !this.birdGain) return

      const density = this.getParameter('density')
      const timeOfDay = this.getParameter('timeOfDay')

      // Time of day affects density: dawn (0) = most active, night (1) = quiet
      const effectiveDensity = density * (1 - timeOfDay * 0.8)

      // Interval between bird calls
      const minInterval = 200
      const maxInterval = 4000
      const interval = maxInterval - effectiveDensity * (maxInterval - minInterval)

      if (Math.random() < effectiveDensity + 0.1) {
        this.createChirp()
      }

      this.birdInterval = setTimeout(
        scheduleBird,
        interval + Math.random() * interval * 0.6
      )
    }
    scheduleBird()
  }

  private createChirp(): void {
    if (!this.birdGain || this.chirpPatterns.length === 0) return

    const pattern = this.chirpPatterns[Math.floor(Math.random() * this.chirpPatterns.length)]
    const now = this.ctx.currentTime
    const timeOfDay = this.getParameter('timeOfDay')

    // Stereo placement
    const pan = this.ctx.createStereoPanner()
    pan.pan.value = (Math.random() - 0.5) * 1.6
    pan.connect(this.birdGain)

    // Volume varies — closer birds louder
    const distGain = this.ctx.createGain()
    const birdVolume = (0.1 + Math.random() * 0.25) * (1 - timeOfDay * 0.5)
    distGain.gain.value = birdVolume
    distGain.connect(pan)

    // Create each note in the call
    for (let r = 0; r < pattern.repeats; r++) {
      const noteStart = now + r * (pattern.duration + pattern.gap)
      this.createSingleNote(pattern, noteStart, distGain)
    }

    // Cleanup after all notes finish
    const totalDuration = pattern.repeats * (pattern.duration + pattern.gap) + 0.5
    setTimeout(() => {
      pan.disconnect()
      distGain.disconnect()
    }, totalDuration * 1000)
  }

  private createSingleNote(
    pattern: ChirpPattern,
    startTime: number,
    destination: AudioNode
  ): void {
    // FM synthesis: carrier + modulator for bird-like timbre
    const carrier = this.ctx.createOscillator()
    const modulator = this.ctx.createOscillator()
    const modGain = this.ctx.createGain()
    const noteGain = this.ctx.createGain()

    carrier.type = 'sine'
    modulator.type = 'sine'

    // Frequency sweep (ascending or descending chirp)
    const sweepDir = Math.random() > 0.5 ? 1 : -1
    const startFreq = pattern.baseFreq
    const endFreq = startFreq + pattern.freqSweep * sweepDir

    carrier.frequency.setValueAtTime(startFreq, startTime)
    carrier.frequency.exponentialRampToValueAtTime(
      Math.max(100, endFreq),
      startTime + pattern.duration
    )

    // FM modulator — adds harmonic richness
    modulator.frequency.setValueAtTime(startFreq * 2.01, startTime)
    modGain.gain.value = startFreq * 0.3

    // Envelope: quick attack, short sustain, fast release
    noteGain.gain.setValueAtTime(0, startTime)
    noteGain.gain.linearRampToValueAtTime(0.8, startTime + 0.005)
    noteGain.gain.setValueAtTime(0.8, startTime + pattern.duration * 0.6)
    noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + pattern.duration)

    // Wire: modulator → modGain → carrier.frequency
    modulator.connect(modGain)
    modGain.connect(carrier.frequency)
    carrier.connect(noteGain)
    noteGain.connect(destination)

    carrier.start(startTime)
    carrier.stop(startTime + pattern.duration + 0.01)
    modulator.start(startTime)
    modulator.stop(startTime + pattern.duration + 0.01)

    carrier.onended = () => {
      carrier.disconnect()
      modulator.disconnect()
      modGain.disconnect()
      noteGain.disconnect()
    }
  }

  protected applyParameter(name: string, value: number): void {
    const now = this.ctx.currentTime

    switch (name) {
      case 'rustling':
        this.rustleGain?.gain.setTargetAtTime(value * 0.15, now, 0.1)
        break
      case 'canopy':
        this.canopyFilter?.frequency.setTargetAtTime(
          this.scaleExp(1 - value, 2000, 12000), now, 0.3
        )
        break
      case 'variety':
        this.generateChirpPatterns()
        break
      // density and timeOfDay are read on-the-fly in scheduleBird
    }
  }

  protected cleanup(): void {
    if (this.birdInterval) { clearTimeout(this.birdInterval); this.birdInterval = null }

    try { this.rustleSource?.stop() } catch { /* */ }
    try { this.rustleLfo?.stop() } catch { /* */ }

    this.rustleSource?.disconnect()
    this.rustleFilter?.disconnect()
    this.rustleGain?.disconnect()
    this.rustleLfo?.disconnect()
    this.rustleLfoGain?.disconnect()
    this.canopyFilter?.disconnect()
    this.birdGain?.disconnect()

    this.rustleSource = null
    this.rustleFilter = null
    this.rustleGain = null
    this.rustleLfo = null
    this.rustleLfoGain = null
    this.canopyFilter = null
    this.birdGain = null
    this.chirpPatterns = []
  }
}

export default ForestEngine
