/**
 * FireEngine — Granular crackling with warm roar.
 *
 * Uses rapid short noise bursts (granular synthesis) for crackling,
 * with a low filtered noise bed for the fire roar.
 *
 * Parameters:
 * - intensity: burst rate + roar volume (0-1)
 * - crackle: high-frequency burst content (0-1)
 * - warmth: low-frequency roar level (0-1)
 * - pop: occasional loud burst probability (0-1)
 * - size: frequency range — campfire vs bonfire vs inferno (0-1)
 */

import { AudioEngine } from '../AudioEngine'
import type { EngineInfo, EngineType } from '../../types/audio'

export class FireEngine extends AudioEngine {
  // Roar layer — low filtered noise
  private roarSource: AudioBufferSourceNode | null = null
  private roarFilter: BiquadFilterNode | null = null
  private roarGain: GainNode | null = null

  // Crackle scheduling
  private crackleInterval: ReturnType<typeof setTimeout> | null = null
  private crackleGain: GainNode | null = null

  // Pop scheduling
  private popInterval: ReturnType<typeof setTimeout> | null = null
  private popGain: GainNode | null = null

  // Warmth — mid body
  private bodyFilter: BiquadFilterNode | null = null
  private bodyGain: GainNode | null = null

  constructor() {
    super()

    this.registerParam({
      name: 'intensity',
      label: 'Intensity',
      value: 0.5,
      defaultValue: 0.5,
      unit: '%',
      color: '#ff6b4a',
    })
    this.registerParam({
      name: 'crackle',
      label: 'Crackle',
      value: 0.5,
      defaultValue: 0.5,
      unit: '%',
      color: '#ff8a70',
    })
    this.registerParam({
      name: 'warmth',
      label: 'Warmth',
      value: 0.5,
      defaultValue: 0.5,
      unit: '%',
      color: '#f59e0b',
    })
    this.registerParam({
      name: 'pop',
      label: 'Pop',
      value: 0.3,
      defaultValue: 0.3,
      unit: '%',
      color: '#ff6b4a',
    })
    this.registerParam({
      name: 'size',
      label: 'Size',
      value: 0.5,
      defaultValue: 0.5,
      unit: '%',
      color: '#b4a0ff',
    })
  }

  getInfo(): EngineInfo {
    return {
      type: 'fire' as EngineType,
      name: 'Fire',
      description: 'Granular crackling with warm roar',
      category: 'nature',
      icon: '🔥',
      defaultParams: { intensity: 0.5, crackle: 0.5, warmth: 0.5, pop: 0.3, size: 0.5 },
    }
  }

  protected setup(): void {
    // White noise buffer for roar
    const bufferSize = this.ctx.sampleRate * 2
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }

    // Roar — low-pass filtered noise
    this.roarSource = this.ctx.createBufferSource()
    this.roarSource.buffer = buffer
    this.roarSource.loop = true

    this.roarFilter = this.ctx.createBiquadFilter()
    this.roarFilter.type = 'lowpass'
    const sizeVal = this.getParameter('size')
    this.roarFilter.frequency.value = this.scaleExp(sizeVal, 150, 600)
    this.roarFilter.Q.value = 1.5

    this.roarGain = this.ctx.createGain()
    this.roarGain.gain.value = this.getParameter('warmth') * 0.4

    // Body — mid-range warmth
    this.bodyFilter = this.ctx.createBiquadFilter()
    this.bodyFilter.type = 'bandpass'
    this.bodyFilter.frequency.value = this.scaleExp(sizeVal, 300, 1200)
    this.bodyFilter.Q.value = 0.8

    this.bodyGain = this.ctx.createGain()
    this.bodyGain.gain.value = this.getParameter('intensity') * 0.25

    // Crackle output
    this.crackleGain = this.ctx.createGain()
    this.crackleGain.gain.value = this.getParameter('crackle') * 0.5

    // Pop output
    this.popGain = this.ctx.createGain()
    this.popGain.gain.value = 0.6

    // Wire: roar → roarFilter → roarGain → output
    this.roarSource.connect(this.roarFilter)
    this.roarFilter.connect(this.roarGain)
    this.roarGain.connect(this.output)

    // Body layer: same source → bodyFilter → bodyGain → output
    this.roarSource.connect(this.bodyFilter)
    this.bodyFilter.connect(this.bodyGain)
    this.bodyGain.connect(this.output)

    // Crackle + pop → output
    this.crackleGain.connect(this.output)
    this.popGain.connect(this.output)

    // Add a subtle LFO to roar for organic breathing
    const roarLfo = this.ctx.createOscillator()
    roarLfo.type = 'sine'
    roarLfo.frequency.value = 0.3 + Math.random() * 0.2
    const roarLfoGain = this.ctx.createGain()
    roarLfoGain.gain.value = 0.08
    roarLfo.connect(roarLfoGain)
    roarLfoGain.connect(this.roarGain.gain)
    roarLfo.start()

    this.roarSource.start()
    this.startCrackles()
    this.startPops()
  }

  private startCrackles(): void {
    const scheduleCrackle = () => {
      if (!this.isRunning || !this.crackleGain) return

      const intensity = this.getParameter('intensity')
      const crackle = this.getParameter('crackle')
      // Higher intensity = more frequent crackles
      const minInterval = 10
      const maxInterval = 120
      const interval = maxInterval - intensity * (maxInterval - minInterval)

      this.createCrackle(crackle)

      this.crackleInterval = setTimeout(
        scheduleCrackle,
        interval + Math.random() * interval * 0.8
      )
    }
    scheduleCrackle()
  }

  private createCrackle(crackleAmount: number): void {
    if (!this.crackleGain) return

    const now = this.ctx.currentTime
    const sizeVal = this.getParameter('size')

    // Very short noise burst
    const bufSize = Math.floor(this.ctx.sampleRate * (0.002 + Math.random() * 0.008))
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) {
      // Decaying burst
      d[i] = (Math.random() * 2 - 1) * (1 - i / bufSize)
    }

    const src = this.ctx.createBufferSource()
    src.buffer = buf

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = this.scaleExp(crackleAmount, 1000, 6000)

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.15 + Math.random() * 0.2, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.01 + Math.random() * 0.02)

    // Random stereo position
    const pan = this.ctx.createStereoPanner()
    pan.pan.value = (Math.random() - 0.5) * 1.2

    // Add resonance based on size
    const resonance = this.ctx.createBiquadFilter()
    resonance.type = 'peaking'
    resonance.frequency.value = this.scaleExp(sizeVal, 500, 3000)
    resonance.Q.value = 4
    resonance.gain.value = 6

    src.connect(filter)
    filter.connect(resonance)
    resonance.connect(gain)
    gain.connect(pan)
    pan.connect(this.crackleGain)

    src.start(now)
    src.onended = () => {
      src.disconnect()
      filter.disconnect()
      resonance.disconnect()
      gain.disconnect()
      pan.disconnect()
    }
  }

  private startPops(): void {
    const schedulePop = () => {
      if (!this.isRunning || !this.popGain) return

      const popProb = this.getParameter('pop')
      // Pops are less frequent
      const interval = 500 + Math.random() * 2000

      if (Math.random() < popProb) {
        this.createPop()
      }

      this.popInterval = setTimeout(schedulePop, interval)
    }
    schedulePop()
  }

  private createPop(): void {
    if (!this.popGain) return

    const now = this.ctx.currentTime
    const sizeVal = this.getParameter('size')

    // Louder, lower burst for pop
    const bufSize = Math.floor(this.ctx.sampleRate * 0.015)
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 2)
    }

    const src = this.ctx.createBufferSource()
    src.buffer = buf

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = this.scaleExp(sizeVal, 200, 1500)
    filter.Q.value = 2

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.3 + Math.random() * 0.3, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05 + Math.random() * 0.05)

    const pan = this.ctx.createStereoPanner()
    pan.pan.value = (Math.random() - 0.5) * 0.8

    src.connect(filter)
    filter.connect(gain)
    gain.connect(pan)
    pan.connect(this.popGain)

    src.start(now)
    src.onended = () => {
      src.disconnect()
      filter.disconnect()
      gain.disconnect()
      pan.disconnect()
    }
  }

  protected applyParameter(name: string, value: number): void {
    const now = this.ctx.currentTime

    switch (name) {
      case 'intensity':
        this.bodyGain?.gain.setTargetAtTime(value * 0.25, now, 0.1)
        break
      case 'crackle':
        this.crackleGain?.gain.setTargetAtTime(value * 0.5, now, 0.1)
        break
      case 'warmth':
        this.roarGain?.gain.setTargetAtTime(value * 0.4, now, 0.1)
        break
      case 'size':
        this.roarFilter?.frequency.setTargetAtTime(
          this.scaleExp(value, 150, 600), now, 0.2
        )
        this.bodyFilter?.frequency.setTargetAtTime(
          this.scaleExp(value, 300, 1200), now, 0.2
        )
        break
      // pop is read on-the-fly in schedulePop
    }
  }

  protected cleanup(): void {
    if (this.crackleInterval) { clearTimeout(this.crackleInterval); this.crackleInterval = null }
    if (this.popInterval) { clearTimeout(this.popInterval); this.popInterval = null }

    try { this.roarSource?.stop() } catch { /* */ }

    this.roarSource?.disconnect()
    this.roarFilter?.disconnect()
    this.roarGain?.disconnect()
    this.bodyFilter?.disconnect()
    this.bodyGain?.disconnect()
    this.crackleGain?.disconnect()
    this.popGain?.disconnect()

    this.roarSource = null
    this.roarFilter = null
    this.roarGain = null
    this.bodyFilter = null
    this.bodyGain = null
    this.crackleGain = null
    this.popGain = null
  }
}

export default FireEngine
