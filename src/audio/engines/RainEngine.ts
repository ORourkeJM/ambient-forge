/**
 * RainEngine — Procedural rain synthesis.
 *
 * Uses filtered white noise for the constant rain bed, with random
 * impulse triggers for individual droplet sounds.
 *
 * Parameters:
 * - intensity: controls droplet density + noise volume (0-1)
 * - heaviness: low-pass filter cutoff (0-1)
 * - surface: resonant frequency simulating different surfaces (0-1)
 * - dampness: reverb wet/dry mix via delay feedback (0-1)
 */

import { AudioEngine } from '../AudioEngine'
import type { EngineInfo, EngineType } from '../../types/audio'

export class RainEngine extends AudioEngine {
  // Internal nodes
  private noiseSource: AudioBufferSourceNode | null = null
  private noiseGain: GainNode | null = null
  private lowpass: BiquadFilterNode | null = null
  private highpass: BiquadFilterNode | null = null
  private surfaceFilter: BiquadFilterNode | null = null
  private delayNode: DelayNode | null = null
  private delayFeedback: GainNode | null = null
  private delayWet: GainNode | null = null

  // Droplet scheduling
  private dropletInterval: ReturnType<typeof setInterval> | null = null
  private dropletGain: GainNode | null = null

  constructor() {
    super()

    // Register parameters
    this.registerParam({
      name: 'intensity',
      label: 'Intensity',
      value: 0.5,
      defaultValue: 0.5,
      unit: '%',
      color: '#4a9eff',
    })
    this.registerParam({
      name: 'heaviness',
      label: 'Heaviness',
      value: 0.4,
      defaultValue: 0.4,
      unit: '%',
      color: '#4a9eff',
    })
    this.registerParam({
      name: 'surface',
      label: 'Surface',
      value: 0.3,
      defaultValue: 0.3,
      unit: '%',
      color: '#b4a0ff',
    })
    this.registerParam({
      name: 'dampness',
      label: 'Dampness',
      value: 0.3,
      defaultValue: 0.3,
      unit: '%',
      color: '#4af0c0',
    })
  }

  getInfo(): EngineInfo {
    return {
      type: 'rain' as EngineType,
      name: 'Rain',
      description: 'Filtered noise rain bed with random droplet impulses',
      category: 'nature',
      icon: '🌧',
      defaultParams: {
        intensity: 0.5,
        heaviness: 0.4,
        surface: 0.3,
        dampness: 0.3,
      },
    }
  }

  protected setup(): void {
    // Create noise buffer (2 seconds of white noise)
    const bufferSize = this.ctx.sampleRate * 2
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }

    // Noise source (looping)
    this.noiseSource = this.ctx.createBufferSource()
    this.noiseSource.buffer = buffer
    this.noiseSource.loop = true

    // Noise level
    this.noiseGain = this.ctx.createGain()
    this.noiseGain.gain.value = this.getParameter('intensity') * 0.6

    // Low-pass filter (heaviness)
    this.lowpass = this.ctx.createBiquadFilter()
    this.lowpass.type = 'lowpass'
    this.lowpass.frequency.value = this.scaleExp(this.getParameter('heaviness'), 800, 8000)
    this.lowpass.Q.value = 0.7

    // High-pass to remove sub-bass rumble
    this.highpass = this.ctx.createBiquadFilter()
    this.highpass.type = 'highpass'
    this.highpass.frequency.value = 200
    this.highpass.Q.value = 0.5

    // Surface resonance filter
    this.surfaceFilter = this.ctx.createBiquadFilter()
    this.surfaceFilter.type = 'peaking'
    this.surfaceFilter.frequency.value = this.scaleExp(this.getParameter('surface'), 1000, 6000)
    this.surfaceFilter.Q.value = 2
    this.surfaceFilter.gain.value = 4

    // Delay for dampness/space
    this.delayNode = this.ctx.createDelay(0.5)
    this.delayNode.delayTime.value = 0.08
    this.delayFeedback = this.ctx.createGain()
    this.delayFeedback.gain.value = this.getParameter('dampness') * 0.5
    this.delayWet = this.ctx.createGain()
    this.delayWet.gain.value = this.getParameter('dampness') * 0.4

    // Droplet gain
    this.dropletGain = this.ctx.createGain()
    this.dropletGain.gain.value = 0.3

    // Wire up: noise → highpass → lowpass → surfaceFilter → noiseGain → output
    this.noiseSource.connect(this.highpass)
    this.highpass.connect(this.lowpass)
    this.lowpass.connect(this.surfaceFilter)
    this.surfaceFilter.connect(this.noiseGain)
    this.noiseGain.connect(this.output)

    // Delay feedback loop
    this.noiseGain.connect(this.delayNode)
    this.delayNode.connect(this.delayFeedback)
    this.delayFeedback.connect(this.delayNode)
    this.delayNode.connect(this.delayWet)
    this.delayWet.connect(this.output)

    // Droplets → output
    this.dropletGain.connect(this.output)

    // Start
    this.noiseSource.start()
    this.startDroplets()
  }

  private startDroplets(): void {
    const scheduleDroplet = () => {
      if (!this.isRunning || !this.dropletGain) return

      const intensity = this.getParameter('intensity')
      // Droplet interval: high intensity = more frequent
      const minInterval = 20
      const maxInterval = 300
      const interval = maxInterval - intensity * (maxInterval - minInterval)

      // Create a single droplet
      this.createDroplet()

      // Schedule next
      this.dropletInterval = setTimeout(scheduleDroplet, interval + Math.random() * interval * 0.5)
    }

    scheduleDroplet()
  }

  private createDroplet(): void {
    if (!this.dropletGain) return

    const now = this.ctx.currentTime

    // Short filtered noise burst for each droplet
    const osc = this.ctx.createOscillator()
    const dropGain = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()

    // Random pitch for variety
    const baseFreq = this.scaleExp(this.getParameter('surface'), 2000, 8000)
    osc.frequency.value = baseFreq + Math.random() * 2000
    osc.type = 'sine'

    // Very short envelope
    const attackTime = 0.001
    const decayTime = 0.01 + Math.random() * 0.03
    dropGain.gain.setValueAtTime(0, now)
    dropGain.gain.linearRampToValueAtTime(
      0.1 + Math.random() * 0.15 * this.getParameter('intensity'),
      now + attackTime
    )
    dropGain.gain.exponentialRampToValueAtTime(0.001, now + attackTime + decayTime)

    filter.type = 'bandpass'
    filter.frequency.value = osc.frequency.value
    filter.Q.value = 10

    // Random pan for spatial spread
    const pan = this.ctx.createStereoPanner()
    pan.pan.value = Math.random() * 2 - 1

    osc.connect(filter)
    filter.connect(dropGain)
    dropGain.connect(pan)
    pan.connect(this.dropletGain)

    osc.start(now)
    osc.stop(now + attackTime + decayTime + 0.01)

    // Cleanup
    osc.onended = () => {
      osc.disconnect()
      filter.disconnect()
      dropGain.disconnect()
      pan.disconnect()
    }
  }

  protected applyParameter(name: string, value: number): void {
    const now = this.ctx.currentTime

    switch (name) {
      case 'intensity':
        this.noiseGain?.gain.setTargetAtTime(value * 0.6, now, 0.1)
        break

      case 'heaviness':
        this.lowpass?.frequency.setTargetAtTime(
          this.scaleExp(value, 800, 8000),
          now,
          0.1
        )
        break

      case 'surface':
        this.surfaceFilter?.frequency.setTargetAtTime(
          this.scaleExp(value, 1000, 6000),
          now,
          0.1
        )
        break

      case 'dampness':
        this.delayFeedback?.gain.setTargetAtTime(value * 0.5, now, 0.1)
        this.delayWet?.gain.setTargetAtTime(value * 0.4, now, 0.1)
        break
    }
  }

  protected cleanup(): void {
    if (this.dropletInterval) {
      clearTimeout(this.dropletInterval)
      this.dropletInterval = null
    }

    try {
      this.noiseSource?.stop()
    } catch {
      // already stopped
    }

    this.noiseSource?.disconnect()
    this.noiseGain?.disconnect()
    this.lowpass?.disconnect()
    this.highpass?.disconnect()
    this.surfaceFilter?.disconnect()
    this.delayNode?.disconnect()
    this.delayFeedback?.disconnect()
    this.delayWet?.disconnect()
    this.dropletGain?.disconnect()

    this.noiseSource = null
    this.noiseGain = null
    this.lowpass = null
    this.highpass = null
    this.surfaceFilter = null
    this.delayNode = null
    this.delayFeedback = null
    this.delayWet = null
    this.dropletGain = null
  }
}

export default RainEngine
