/**
 * AudioEngine — Abstract base class for all sound engines.
 *
 * Each engine creates its own internal AudioNode graph and connects
 * to the AudioContextManager's destination (compressor).
 */

import { AudioContextManager } from './AudioContextManager'
import type { EngineParameter, EngineInfo } from '../types/audio'

export abstract class AudioEngine {
  protected ctx: AudioContext
  protected manager: AudioContextManager
  protected output: GainNode
  protected panNode: StereoPannerNode
  protected isRunning = false
  protected params: Map<string, EngineParameter> = new Map()

  constructor() {
    this.manager = AudioContextManager.getInstance()
    this.ctx = this.manager.getContext()

    // Each engine gets its own output gain + pan
    this.output = this.ctx.createGain()
    this.output.gain.value = 0 // Start silent, fade in on start

    this.panNode = this.ctx.createStereoPanner()
    this.panNode.pan.value = 0

    // Chain: engine internals → output gain → pan → destination
    this.output.connect(this.panNode)
    this.panNode.connect(this.manager.getDestination())
  }

  /**
   * Get the engine's metadata (name, category, description, etc.)
   */
  abstract getInfo(): EngineInfo

  /**
   * Initialize internal audio nodes. Called once before first start.
   */
  protected abstract setup(): void

  /**
   * Start the engine (begin producing sound).
   */
  start(): void {
    if (this.isRunning) return
    this.setup()
    this.isRunning = true
    // Fade in over 500ms
    this.output.gain.setTargetAtTime(1, this.ctx.currentTime, 0.15)
  }

  /**
   * Stop the engine (fade out and disconnect).
   */
  stop(): void {
    if (!this.isRunning) return
    // Fade out over 500ms
    this.output.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15)
    this.isRunning = false
    // Cleanup after fade
    setTimeout(() => this.cleanup(), 800)
  }

  /**
   * Clean up internal nodes after stopping.
   */
  protected abstract cleanup(): void

  /**
   * Set a parameter by name (value normalized 0-1).
   */
  setParameter(name: string, value: number): void {
    const clamped = Math.max(0, Math.min(1, value))
    const param = this.params.get(name)
    if (param) {
      param.value = clamped
      this.params.set(name, param)
      this.applyParameter(name, clamped)
    }
  }

  /**
   * Apply a parameter change to internal audio nodes.
   */
  protected abstract applyParameter(name: string, value: number): void

  /**
   * Get all parameters with current values.
   */
  getParameters(): EngineParameter[] {
    return Array.from(this.params.values())
  }

  /**
   * Get a specific parameter value.
   */
  getParameter(name: string): number {
    return this.params.get(name)?.value ?? 0
  }

  /**
   * Set volume (0-1). Applied to the output gain.
   */
  setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume))
    this.output.gain.setTargetAtTime(
      this.isRunning ? clamped : 0,
      this.ctx.currentTime,
      0.02
    )
  }

  /**
   * Set stereo pan (-1 left, 0 center, 1 right).
   */
  setPan(pan: number): void {
    const clamped = Math.max(-1, Math.min(1, pan))
    this.panNode.pan.setTargetAtTime(clamped, this.ctx.currentTime, 0.02)
  }

  /**
   * Mute/unmute the engine.
   */
  setMuted(muted: boolean): void {
    if (muted) {
      this.output.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02)
    } else if (this.isRunning) {
      this.output.gain.setTargetAtTime(1, this.ctx.currentTime, 0.02)
    }
  }

  /**
   * Get the output node for connecting to external effects.
   */
  getOutput(): GainNode {
    return this.output
  }

  /**
   * Is this engine currently running?
   */
  getIsRunning(): boolean {
    return this.isRunning
  }

  /**
   * Dispose of this engine entirely.
   */
  dispose(): void {
    this.stop()
    setTimeout(() => {
      this.output.disconnect()
      this.panNode.disconnect()
    }, 1000)
  }

  /**
   * Register a parameter (call in subclass constructor).
   */
  protected registerParam(param: EngineParameter): void {
    this.params.set(param.name, param)
  }

  /**
   * Helper: scale a 0-1 value to a min-max range.
   */
  protected scale(normalized: number, min: number, max: number): number {
    return min + normalized * (max - min)
  }

  /**
   * Helper: scale a 0-1 value exponentially (better for frequency/gain).
   */
  protected scaleExp(normalized: number, min: number, max: number): number {
    return min * Math.pow(max / min, normalized)
  }
}

export default AudioEngine
