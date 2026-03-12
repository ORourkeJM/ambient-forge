/**
 * AudioContextManager — Singleton manager for the Web Audio API context.
 *
 * Handles creation, suspension/resumption, and provides shared nodes:
 * - Master gain (volume control)
 * - Analyser (FFT data for visualizations)
 * - Dynamics compressor (prevent clipping)
 */

let instance: AudioContextManager | null = null

export class AudioContextManager {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private analyser: AnalyserNode | null = null
  private compressor: DynamicsCompressorNode | null = null
  private initialized = false

  static getInstance(): AudioContextManager {
    if (!instance) {
      instance = new AudioContextManager()
    }
    return instance
  }

  /**
   * Initialize the AudioContext. Must be called from a user gesture handler.
   */
  async init(): Promise<void> {
    if (this.initialized && this.ctx) return

    this.ctx = new AudioContext({ sampleRate: 44100 })

    // Create shared nodes
    this.compressor = this.ctx.createDynamicsCompressor()
    this.compressor.threshold.value = -6
    this.compressor.knee.value = 10
    this.compressor.ratio.value = 4
    this.compressor.attack.value = 0.005
    this.compressor.release.value = 0.1

    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = 0.8

    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 2048
    this.analyser.smoothingTimeConstant = 0.8

    // Signal chain: engines → compressor → masterGain → analyser → destination
    this.compressor.connect(this.masterGain)
    this.masterGain.connect(this.analyser)
    this.analyser.connect(this.ctx.destination)

    this.initialized = true

    // Handle page visibility — suspend when hidden to save resources
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return
      if (document.hidden) {
        // Don't suspend — user might want ambient sound while in another tab
        // Only suspend if explicitly paused
      }
    })
  }

  /**
   * Get the AudioContext (throws if not initialized).
   */
  getContext(): AudioContext {
    if (!this.ctx) throw new Error('AudioContext not initialized. Call init() first.')
    return this.ctx
  }

  /**
   * Get the compressor node — engines connect here.
   */
  getDestination(): AudioNode {
    if (!this.compressor) throw new Error('AudioContext not initialized.')
    return this.compressor
  }

  /**
   * Get the master gain node for volume control.
   */
  getMasterGain(): GainNode {
    if (!this.masterGain) throw new Error('AudioContext not initialized.')
    return this.masterGain
  }

  /**
   * Get the analyser node for visualization data.
   */
  getAnalyser(): AnalyserNode {
    if (!this.analyser) throw new Error('AudioContext not initialized.')
    return this.analyser
  }

  /**
   * Set master volume (0-1).
   */
  setMasterVolume(volume: number): void {
    if (!this.masterGain || !this.ctx) return
    const clamped = Math.max(0, Math.min(1, volume))
    this.masterGain.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.02)
  }

  /**
   * Resume the AudioContext (play).
   */
  async resume(): Promise<void> {
    if (!this.ctx) return
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume()
    }
  }

  /**
   * Suspend the AudioContext (pause).
   */
  async suspend(): Promise<void> {
    if (!this.ctx) return
    if (this.ctx.state === 'running') {
      await this.ctx.suspend()
    }
  }

  /**
   * Get the current AudioContext state.
   */
  getState(): AudioContextState | 'uninitialized' {
    if (!this.ctx) return 'uninitialized'
    return this.ctx.state
  }

  /**
   * Get current time from the AudioContext.
   */
  getCurrentTime(): number {
    if (!this.ctx) return 0
    return this.ctx.currentTime
  }

  /**
   * Check if initialized.
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Fade master volume to a target over a duration (for sleep timer).
   */
  fadeMasterTo(target: number, durationSeconds: number): void {
    if (!this.masterGain || !this.ctx) return
    const clamped = Math.max(0, Math.min(1, target))
    this.masterGain.gain.linearRampToValueAtTime(
      clamped,
      this.ctx.currentTime + durationSeconds
    )
  }

  /**
   * Get FFT frequency data as Float32Array.
   */
  getFrequencyData(): Float32Array {
    if (!this.analyser) return new Float32Array(0)
    const data = new Float32Array(this.analyser.frequencyBinCount)
    this.analyser.getFloatFrequencyData(data)
    return data
  }

  /**
   * Get time-domain waveform data as Float32Array.
   */
  getWaveformData(): Float32Array {
    if (!this.analyser) return new Float32Array(0)
    const data = new Float32Array(this.analyser.frequencyBinCount)
    this.analyser.getFloatTimeDomainData(data)
    return data
  }
}

export default AudioContextManager
