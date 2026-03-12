/**
 * CityEngine — Urban ambient soundscape.
 *
 * Layers of filtered noise for traffic hum, random event triggers
 * for horns/sirens, and a constant low rumble for urban bass.
 *
 * Parameters:
 * - traffic: steady traffic drone level (0-1)
 * - distance: how far away — affects filtering (0-1)
 * - bustle: random urban events frequency (0-1)
 * - nightMode: crossfade day→night character (0-1)
 */

import { AudioEngine } from '../AudioEngine'
import type { EngineInfo, EngineType } from '../../types/audio'

export class CityEngine extends AudioEngine {
  // Traffic drone — filtered noise bed
  private trafficSource: AudioBufferSourceNode | null = null
  private trafficFilter: BiquadFilterNode | null = null
  private trafficGain: GainNode | null = null

  // Urban rumble — very low sub-bass
  private rumbleOsc: OscillatorNode | null = null
  private rumbleGain: GainNode | null = null
  private rumbleLfo: OscillatorNode | null = null
  private rumbleLfoGain: GainNode | null = null

  // Distance filter
  private distanceFilter: BiquadFilterNode | null = null

  // Bustle — random urban events
  private bustleInterval: ReturnType<typeof setTimeout> | null = null
  private bustleGain: GainNode | null = null

  // Second traffic layer (slightly different character)
  private traffic2Source: AudioBufferSourceNode | null = null
  private traffic2Filter: BiquadFilterNode | null = null
  private traffic2Gain: GainNode | null = null

  constructor() {
    super()

    this.registerParam({
      name: 'traffic',
      label: 'Traffic',
      value: 0.5,
      defaultValue: 0.5,
      unit: '%',
      color: '#f59e0b',
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
      name: 'bustle',
      label: 'Bustle',
      value: 0.4,
      defaultValue: 0.4,
      unit: '%',
      color: '#ff6b4a',
    })
    this.registerParam({
      name: 'nightMode',
      label: 'Night Mode',
      value: 0,
      defaultValue: 0,
      unit: '%',
      color: '#b4a0ff',
    })
  }

  getInfo(): EngineInfo {
    return {
      type: 'city' as EngineType,
      name: 'City',
      description: 'Urban soundscape with traffic and distant sounds',
      category: 'urban',
      icon: '🏙',
      defaultParams: { traffic: 0.5, distance: 0.5, bustle: 0.4, nightMode: 0 },
    }
  }

  protected setup(): void {
    const nightMode = this.getParameter('nightMode')
    const distance = this.getParameter('distance')

    // ── Traffic noise bed ──
    const bufSize = this.ctx.sampleRate * 4
    const buf = this.ctx.createBuffer(2, bufSize, this.ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch)
      // Brown-ish noise (integrated white noise) for traffic-like rumble
      let prev = 0
      for (let i = 0; i < bufSize; i++) {
        const white = Math.random() * 2 - 1
        prev = (prev + 0.02 * white) / 1.02
        d[i] = prev * 3.5
      }
    }

    this.trafficSource = this.ctx.createBufferSource()
    this.trafficSource.buffer = buf
    this.trafficSource.loop = true

    this.trafficFilter = this.ctx.createBiquadFilter()
    this.trafficFilter.type = 'bandpass'
    this.trafficFilter.frequency.value = this.scaleExp(1 - nightMode * 0.5, 200, 1200)
    this.trafficFilter.Q.value = 0.5

    this.trafficGain = this.ctx.createGain()
    this.trafficGain.gain.value = this.getParameter('traffic') * 0.4

    // ── Second traffic layer — higher frequency content ──
    this.traffic2Source = this.ctx.createBufferSource()
    this.traffic2Source.buffer = buf
    this.traffic2Source.loop = true

    this.traffic2Filter = this.ctx.createBiquadFilter()
    this.traffic2Filter.type = 'bandpass'
    this.traffic2Filter.frequency.value = 2000
    this.traffic2Filter.Q.value = 0.4

    this.traffic2Gain = this.ctx.createGain()
    // Day: more high-freq (tires, engines), Night: quieter
    this.traffic2Gain.gain.value = this.getParameter('traffic') * 0.15 * (1 - nightMode * 0.7)

    // ── Urban rumble — sub-bass fundamental ──
    this.rumbleOsc = this.ctx.createOscillator()
    this.rumbleOsc.type = 'sine'
    this.rumbleOsc.frequency.value = 40

    this.rumbleGain = this.ctx.createGain()
    this.rumbleGain.gain.value = 0

    this.rumbleLfo = this.ctx.createOscillator()
    this.rumbleLfo.type = 'sine'
    this.rumbleLfo.frequency.value = 0.08

    this.rumbleLfoGain = this.ctx.createGain()
    this.rumbleLfoGain.gain.value = this.getParameter('traffic') * 0.1

    this.rumbleLfo.connect(this.rumbleLfoGain)
    this.rumbleLfoGain.connect(this.rumbleGain.gain)

    // ── Distance filter ──
    this.distanceFilter = this.ctx.createBiquadFilter()
    this.distanceFilter.type = 'lowpass'
    this.distanceFilter.frequency.value = this.scaleExp(1 - distance, 600, 10000)
    this.distanceFilter.Q.value = 0.4

    // ── Bustle output ──
    this.bustleGain = this.ctx.createGain()
    this.bustleGain.gain.value = 0.35

    // ── Traffic breathing LFO ──
    const breathLfo = this.ctx.createOscillator()
    breathLfo.type = 'sine'
    breathLfo.frequency.value = 0.04 + Math.random() * 0.03
    const breathGain = this.ctx.createGain()
    breathGain.gain.value = 0.06
    breathLfo.connect(breathGain)
    breathGain.connect(this.trafficGain.gain)
    breathLfo.start()

    // ── Wire everything ──
    // Traffic: source → filter → trafficGain → distanceFilter → output
    this.trafficSource.connect(this.trafficFilter)
    this.trafficFilter.connect(this.trafficGain)
    this.trafficGain.connect(this.distanceFilter)

    // Traffic2: source → filter → gain → distanceFilter
    this.traffic2Source.connect(this.traffic2Filter)
    this.traffic2Filter.connect(this.traffic2Gain)
    this.traffic2Gain.connect(this.distanceFilter)

    // Distance filter → output
    this.distanceFilter.connect(this.output)

    // Rumble → output
    this.rumbleOsc.connect(this.rumbleGain)
    this.rumbleGain.connect(this.output)

    // Bustle → distanceFilter → output
    this.bustleGain.connect(this.distanceFilter)

    // Start
    this.trafficSource.start()
    this.traffic2Source.start()
    this.rumbleOsc.start()
    this.rumbleLfo.start()

    // Schedule urban events
    this.scheduleBustle()
  }

  private scheduleBustle(): void {
    const trigger = () => {
      if (!this.isRunning || !this.bustleGain) return

      const bustle = this.getParameter('bustle')
      const nightMode = this.getParameter('nightMode')

      // Less activity at night
      const effectiveBustle = bustle * (1 - nightMode * 0.6)

      const minInterval = 800
      const maxInterval = 6000
      const interval = maxInterval - effectiveBustle * (maxInterval - minInterval)

      if (Math.random() < effectiveBustle + 0.15) {
        this.createUrbanEvent()
      }

      this.bustleInterval = setTimeout(
        trigger,
        interval + Math.random() * interval * 0.5
      )
    }
    trigger()
  }

  private createUrbanEvent(): void {
    if (!this.bustleGain) return

    const now = this.ctx.currentTime
    const nightMode = this.getParameter('nightMode')
    const distance = this.getParameter('distance')

    // Pick a random event type
    const eventType = Math.random()

    if (eventType < 0.35) {
      // Distant horn / honk — short pitched tone
      this.createHorn(now, distance, nightMode)
    } else if (eventType < 0.55) {
      // Siren — sweeping oscillator (rarer at night)
      if (nightMode < 0.7 || Math.random() < 0.3) {
        this.createSiren(now, distance)
      }
    } else if (eventType < 0.75) {
      // Rumble pass — low sweep (truck/bus)
      this.createRumblePass(now, distance)
    } else {
      // Ambient clatter — short noise burst
      this.createClatter(now, distance, nightMode)
    }
  }

  private createHorn(now: number, distance: number, nightMode: number): void {
    if (!this.bustleGain) return

    const osc = this.ctx.createOscillator()
    osc.type = 'square'
    // Car horns are typically 300-500 Hz
    osc.frequency.value = 300 + Math.random() * 200

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = this.scaleExp(1 - distance * 0.5, 800, 4000)
    filter.Q.value = 1

    const gain = this.ctx.createGain()
    const vol = (0.05 + Math.random() * 0.08) * (1 - nightMode * 0.5)
    const duration = 0.1 + Math.random() * 0.3

    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(vol, now + 0.01)
    gain.gain.setValueAtTime(vol, now + duration)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration + 0.05)

    const pan = this.ctx.createStereoPanner()
    pan.pan.value = (Math.random() - 0.5) * 1.4

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(pan)
    pan.connect(this.bustleGain)

    osc.start(now)
    osc.stop(now + duration + 0.1)

    osc.onended = () => {
      osc.disconnect()
      filter.disconnect()
      gain.disconnect()
      pan.disconnect()
    }
  }

  private createSiren(now: number, distance: number): void {
    if (!this.bustleGain) return

    const osc = this.ctx.createOscillator()
    osc.type = 'sine'

    // Siren sweeps between two frequencies
    const lowFreq = 600 + Math.random() * 200
    const highFreq = lowFreq + 300 + Math.random() * 400
    const sweepDuration = 0.8 + Math.random() * 0.5
    const cycles = Math.floor(2 + Math.random() * 3)
    const totalDuration = sweepDuration * cycles

    // Create frequency sweep
    for (let i = 0; i < cycles; i++) {
      const t = now + i * sweepDuration
      osc.frequency.setValueAtTime(lowFreq, t)
      osc.frequency.linearRampToValueAtTime(highFreq, t + sweepDuration * 0.5)
      osc.frequency.linearRampToValueAtTime(lowFreq, t + sweepDuration)
    }

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = this.scaleExp(1 - distance * 0.6, 1000, 6000)

    const gain = this.ctx.createGain()
    const vol = (0.02 + Math.random() * 0.04) * (1 - distance * 0.5)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(vol, now + 0.3)
    gain.gain.setValueAtTime(vol, now + totalDuration - 0.5)
    gain.gain.exponentialRampToValueAtTime(0.001, now + totalDuration)

    const pan = this.ctx.createStereoPanner()
    // Sirens pan across stereo field (Doppler-ish)
    pan.pan.setValueAtTime(-0.6 + Math.random() * 0.3, now)
    pan.pan.linearRampToValueAtTime(0.6 - Math.random() * 0.3, now + totalDuration)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(pan)
    pan.connect(this.bustleGain)

    osc.start(now)
    osc.stop(now + totalDuration + 0.1)

    osc.onended = () => {
      osc.disconnect()
      filter.disconnect()
      gain.disconnect()
      pan.disconnect()
    }
  }

  private createRumblePass(now: number, distance: number): void {
    if (!this.bustleGain) return

    // Low rumble that sweeps through (bus/truck passing)
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 50 + Math.random() * 30

    const bufSize = Math.floor(this.ctx.sampleRate * 0.5)
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate)
    const d = buf.getChannelData(0)
    let prev = 0
    for (let i = 0; i < bufSize; i++) {
      prev = (prev + 0.02 * (Math.random() * 2 - 1)) / 1.02
      d[i] = prev * 3
    }

    const noiseSrc = this.ctx.createBufferSource()
    noiseSrc.buffer = buf

    const noiseFilter = this.ctx.createBiquadFilter()
    noiseFilter.type = 'lowpass'
    noiseFilter.frequency.value = 200 + Math.random() * 200

    const totalDuration = 1.5 + Math.random() * 2
    const vol = 0.06 * (1 - distance * 0.6)

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(vol, now + totalDuration * 0.3)
    gain.gain.linearRampToValueAtTime(vol * 0.8, now + totalDuration * 0.6)
    gain.gain.exponentialRampToValueAtTime(0.001, now + totalDuration)

    const pan = this.ctx.createStereoPanner()
    pan.pan.setValueAtTime(-0.8, now)
    pan.pan.linearRampToValueAtTime(0.8, now + totalDuration)

    osc.connect(gain)
    noiseSrc.connect(noiseFilter)
    noiseFilter.connect(gain)
    gain.connect(pan)
    pan.connect(this.bustleGain)

    osc.start(now)
    osc.stop(now + totalDuration + 0.1)
    noiseSrc.start(now)
    noiseSrc.stop(now + totalDuration + 0.1)

    const cleanup = () => {
      osc.disconnect()
      noiseSrc.disconnect()
      noiseFilter.disconnect()
      gain.disconnect()
      pan.disconnect()
    }
    setTimeout(cleanup, (totalDuration + 0.5) * 1000)
  }

  private createClatter(now: number, distance: number, nightMode: number): void {
    if (!this.bustleGain) return

    // Short noise burst — footsteps, door, etc.
    const bufSize = Math.floor(this.ctx.sampleRate * (0.01 + Math.random() * 0.04))
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) {
      d[i] = (Math.random() * 2 - 1) * (1 - i / bufSize)
    }

    const src = this.ctx.createBufferSource()
    src.buffer = buf

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1000 + Math.random() * 3000
    filter.Q.value = 1.5

    const vol = (0.03 + Math.random() * 0.06) * (1 - nightMode * 0.4) * (1 - distance * 0.5)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(vol, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05 + Math.random() * 0.1)

    const pan = this.ctx.createStereoPanner()
    pan.pan.value = (Math.random() - 0.5) * 1.6

    src.connect(filter)
    filter.connect(gain)
    gain.connect(pan)
    pan.connect(this.bustleGain)

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
      case 'traffic':
        this.trafficGain?.gain.setTargetAtTime(value * 0.4, now, 0.2)
        this.traffic2Gain?.gain.setTargetAtTime(
          value * 0.15 * (1 - this.getParameter('nightMode') * 0.7),
          now, 0.2
        )
        this.rumbleLfoGain?.gain.setTargetAtTime(value * 0.1, now, 0.3)
        break

      case 'distance':
        this.distanceFilter?.frequency.setTargetAtTime(
          this.scaleExp(1 - value, 600, 10000), now, 0.3
        )
        break

      case 'nightMode':
        // Shift traffic character — lower freq, quieter high end
        this.trafficFilter?.frequency.setTargetAtTime(
          this.scaleExp(1 - value * 0.5, 200, 1200), now, 0.5
        )
        this.traffic2Gain?.gain.setTargetAtTime(
          this.getParameter('traffic') * 0.15 * (1 - value * 0.7),
          now, 0.3
        )
        break

      // bustle is read on-the-fly in scheduleBustle
    }
  }

  protected cleanup(): void {
    if (this.bustleInterval) { clearTimeout(this.bustleInterval); this.bustleInterval = null }

    try { this.trafficSource?.stop() } catch { /* */ }
    try { this.traffic2Source?.stop() } catch { /* */ }
    try { this.rumbleOsc?.stop() } catch { /* */ }
    try { this.rumbleLfo?.stop() } catch { /* */ }

    this.trafficSource?.disconnect()
    this.trafficFilter?.disconnect()
    this.trafficGain?.disconnect()
    this.traffic2Source?.disconnect()
    this.traffic2Filter?.disconnect()
    this.traffic2Gain?.disconnect()
    this.rumbleOsc?.disconnect()
    this.rumbleGain?.disconnect()
    this.rumbleLfo?.disconnect()
    this.rumbleLfoGain?.disconnect()
    this.distanceFilter?.disconnect()
    this.bustleGain?.disconnect()

    this.trafficSource = null
    this.trafficFilter = null
    this.trafficGain = null
    this.traffic2Source = null
    this.traffic2Filter = null
    this.traffic2Gain = null
    this.rumbleOsc = null
    this.rumbleGain = null
    this.rumbleLfo = null
    this.rumbleLfoGain = null
    this.distanceFilter = null
    this.bustleGain = null
  }
}

export default CityEngine
