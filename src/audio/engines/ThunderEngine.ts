/**
 * ThunderEngine — Low-frequency bursts with reverb roll.
 *
 * Generates thunder by: short burst of low-frequency noise → shaped
 * by attack/decay envelope → processed through delay feedback for
 * realistic thunder roll. Random timing with configurable frequency.
 *
 * Parameters:
 * - frequency: storms per minute / time between strikes (0-1)
 * - distance: reverb length + high-cut (0-1)
 * - intensity: burst volume (0-1)
 * - rumble: sub-bass emphasis (0-1)
 */

import { AudioEngine } from '../AudioEngine'
import type { EngineInfo, EngineType } from '../../types/audio'

export class ThunderEngine extends AudioEngine {
  // Scheduling
  private thunderInterval: ReturnType<typeof setTimeout> | null = null
  private thunderGain: GainNode | null = null

  // Ambient storm bed — very quiet low rumble
  private stormBedSource: AudioBufferSourceNode | null = null
  private stormBedFilter: BiquadFilterNode | null = null
  private stormBedGain: GainNode | null = null
  private stormBedLfo: OscillatorNode | null = null
  private stormBedLfoGain: GainNode | null = null

  constructor() {
    super()

    this.registerParam({
      name: 'frequency',
      label: 'Frequency',
      value: 0.3,
      defaultValue: 0.3,
      unit: '%',
      color: '#b4a0ff',
    })
    this.registerParam({
      name: 'distance',
      label: 'Distance',
      value: 0.5,
      defaultValue: 0.5,
      unit: '%',
      color: '#4a9eff',
    })
    this.registerParam({
      name: 'intensity',
      label: 'Intensity',
      value: 0.6,
      defaultValue: 0.6,
      unit: '%',
      color: '#ff6b4a',
    })
    this.registerParam({
      name: 'rumble',
      label: 'Rumble',
      value: 0.4,
      defaultValue: 0.4,
      unit: '%',
      color: '#f59e0b',
    })
  }

  getInfo(): EngineInfo {
    return {
      type: 'thunder' as EngineType,
      name: 'Thunder',
      description: 'Low-frequency bursts with reverb roll',
      category: 'atmospheric',
      icon: '⛈',
      defaultParams: { frequency: 0.3, distance: 0.5, intensity: 0.6, rumble: 0.4 },
    }
  }

  protected setup(): void {
    // Thunder output
    this.thunderGain = this.ctx.createGain()
    this.thunderGain.gain.value = 0.7
    this.thunderGain.connect(this.output)

    // Ambient storm bed — very quiet low rumble between strikes
    const bufSize = this.ctx.sampleRate * 2
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) {
      d[i] = Math.random() * 2 - 1
    }

    this.stormBedSource = this.ctx.createBufferSource()
    this.stormBedSource.buffer = buf
    this.stormBedSource.loop = true

    this.stormBedFilter = this.ctx.createBiquadFilter()
    this.stormBedFilter.type = 'lowpass'
    this.stormBedFilter.frequency.value = 120
    this.stormBedFilter.Q.value = 1

    this.stormBedGain = this.ctx.createGain()
    this.stormBedGain.gain.value = 0.06

    this.stormBedLfo = this.ctx.createOscillator()
    this.stormBedLfo.type = 'sine'
    this.stormBedLfo.frequency.value = 0.05

    this.stormBedLfoGain = this.ctx.createGain()
    this.stormBedLfoGain.gain.value = 0.03

    this.stormBedLfo.connect(this.stormBedLfoGain)
    this.stormBedLfoGain.connect(this.stormBedGain.gain)

    this.stormBedSource.connect(this.stormBedFilter)
    this.stormBedFilter.connect(this.stormBedGain)
    this.stormBedGain.connect(this.output)

    this.stormBedSource.start()
    this.stormBedLfo.start()

    // Schedule first thunder
    this.scheduleThunder()
  }

  private scheduleThunder(): void {
    if (!this.isRunning) return

    const freq = this.getParameter('frequency')
    // Higher frequency = shorter intervals
    const minInterval = 2000  // 2 seconds minimum
    const maxInterval = 20000 // 20 seconds maximum
    const interval = maxInterval - freq * (maxInterval - minInterval)
    const jitter = interval * 0.5

    this.thunderInterval = setTimeout(() => {
      this.createThunderStrike()
      this.scheduleThunder()
    }, interval + Math.random() * jitter)
  }

  private createThunderStrike(): void {
    if (!this.thunderGain) return

    const now = this.ctx.currentTime
    const distance = this.getParameter('distance')
    const intensity = this.getParameter('intensity')
    const rumble = this.getParameter('rumble')

    // Create noise burst for the initial crack
    const burstSize = Math.floor(this.ctx.sampleRate * 0.3)
    const burstBuf = this.ctx.createBuffer(2, burstSize, this.ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = burstBuf.getChannelData(ch)
      for (let i = 0; i < burstSize; i++) {
        d[i] = Math.random() * 2 - 1
      }
    }

    const burstSource = this.ctx.createBufferSource()
    burstSource.buffer = burstBuf

    // Shape the burst — fast attack, long decay
    const attackTime = 0.01 + distance * 0.05
    const decayTime = 0.5 + distance * 2.5 // Farther = longer roll
    const burstGain = this.ctx.createGain()
    burstGain.gain.setValueAtTime(0, now)
    burstGain.gain.linearRampToValueAtTime(intensity * 0.8, now + attackTime)
    burstGain.gain.exponentialRampToValueAtTime(0.001, now + attackTime + decayTime)

    // Low-pass filter — distance darkens the sound
    const lpFilter = this.ctx.createBiquadFilter()
    lpFilter.type = 'lowpass'
    lpFilter.frequency.value = this.scaleExp(1 - distance, 200, 3000)
    lpFilter.Q.value = 0.7

    // Rumble — sub-bass oscillator burst
    const rumbleOsc = this.ctx.createOscillator()
    rumbleOsc.type = 'sine'
    rumbleOsc.frequency.value = 25 + Math.random() * 15

    const rumbleGain = this.ctx.createGain()
    rumbleGain.gain.setValueAtTime(0, now)
    rumbleGain.gain.linearRampToValueAtTime(rumble * 0.4 * intensity, now + attackTime)
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + attackTime + decayTime * 1.3)

    // Delay feedback for thunder roll / echo
    const delay1 = this.ctx.createDelay(1.0)
    delay1.delayTime.value = 0.1 + distance * 0.3

    const delay2 = this.ctx.createDelay(1.0)
    delay2.delayTime.value = 0.2 + distance * 0.4

    const feedbackGain = this.ctx.createGain()
    feedbackGain.gain.value = 0.25 + distance * 0.2

    const feedbackFilter = this.ctx.createBiquadFilter()
    feedbackFilter.type = 'lowpass'
    feedbackFilter.frequency.value = 800

    // Pre-delay randomized stereo
    const pan = this.ctx.createStereoPanner()
    pan.pan.value = (Math.random() - 0.5) * 0.6

    // Wire burst: source → lpFilter → burstGain → pan → thunderGain
    burstSource.connect(lpFilter)
    lpFilter.connect(burstGain)
    burstGain.connect(pan)
    pan.connect(this.thunderGain)

    // Wire delay: burstGain → delay1 → feedbackFilter → feedbackGain → delay2 → thunderGain
    burstGain.connect(delay1)
    delay1.connect(feedbackFilter)
    feedbackFilter.connect(feedbackGain)
    feedbackGain.connect(delay2)
    delay2.connect(feedbackGain) // feedback loop
    delay2.connect(this.thunderGain)

    // Wire rumble: rumbleOsc → rumbleGain → thunderGain
    rumbleOsc.connect(rumbleGain)
    rumbleGain.connect(this.thunderGain)

    // Start
    burstSource.start(now)
    burstSource.stop(now + attackTime + decayTime + 0.1)
    rumbleOsc.start(now)
    rumbleOsc.stop(now + attackTime + decayTime * 1.3 + 0.1)

    // Cleanup
    const cleanupTime = (attackTime + decayTime * 2 + 1) * 1000
    setTimeout(() => {
      burstSource.disconnect()
      burstGain.disconnect()
      lpFilter.disconnect()
      delay1.disconnect()
      delay2.disconnect()
      feedbackGain.disconnect()
      feedbackFilter.disconnect()
      pan.disconnect()
      rumbleOsc.disconnect()
      rumbleGain.disconnect()
    }, cleanupTime)
  }

  protected applyParameter(name: string, _value: number): void {
    const now = this.ctx.currentTime

    switch (name) {
      case 'intensity':
        // Applied on next strike
        break
      case 'distance':
        // Applied on next strike
        break
      case 'rumble':
        // Applied on next strike
        break
      case 'frequency':
        // Reschedule with new frequency
        if (this.thunderInterval) {
          clearTimeout(this.thunderInterval)
        }
        this.scheduleThunder()
        break
    }

    // Adjust storm bed based on overall params
    this.stormBedGain?.gain.setTargetAtTime(
      0.03 + this.getParameter('intensity') * 0.05,
      now,
      0.5
    )
  }

  protected cleanup(): void {
    if (this.thunderInterval) { clearTimeout(this.thunderInterval); this.thunderInterval = null }

    try { this.stormBedSource?.stop() } catch { /* */ }
    try { this.stormBedLfo?.stop() } catch { /* */ }

    this.thunderGain?.disconnect()
    this.stormBedSource?.disconnect()
    this.stormBedFilter?.disconnect()
    this.stormBedGain?.disconnect()
    this.stormBedLfo?.disconnect()
    this.stormBedLfoGain?.disconnect()

    this.thunderGain = null
    this.stormBedSource = null
    this.stormBedFilter = null
    this.stormBedGain = null
    this.stormBedLfo = null
    this.stormBedLfoGain = null
  }
}

export default ThunderEngine
