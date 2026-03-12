/**
 * Evolver — Organic parameter drift system.
 *
 * Uses smooth random walks (Brownian motion with momentum) to slowly
 * evolve engine parameters over time. Each parameter gets its own
 * drift velocity and target, creating natural-feeling movement.
 *
 * The result: soundscapes that are constantly alive and never loop.
 */

import { useMixerStore } from '../stores/mixerStore'

interface ParamDriftState {
  velocity: number    // Current drift speed (-1 to 1)
  target: number      // Where this param is "heading"
  momentum: number    // How quickly it changes direction
}

interface LayerDriftState {
  params: Map<string, ParamDriftState>
}

/** How aggressively parameters drift */
export type EvolveSpeed = 'glacial' | 'slow' | 'medium' | 'fast'

const speedConfig: Record<EvolveSpeed, {
  tickMs: number        // How often we nudge (ms)
  stepSize: number      // Max change per tick (0-1 scale)
  targetShift: number   // How often target changes
  momentum: number      // Velocity damping (0-1, higher = more momentum)
}> = {
  glacial: { tickMs: 3000, stepSize: 0.003, targetShift: 0.01, momentum: 0.97 },
  slow:    { tickMs: 2000, stepSize: 0.006, targetShift: 0.02, momentum: 0.95 },
  medium:  { tickMs: 1200, stepSize: 0.012, targetShift: 0.04, momentum: 0.92 },
  fast:    { tickMs: 700,  stepSize: 0.025, targetShift: 0.08, momentum: 0.88 },
}

export class Evolver {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private driftStates: Map<string, LayerDriftState> = new Map()
  private speed: EvolveSpeed = 'slow'
  private _isRunning = false

  get isRunning(): boolean {
    return this._isRunning
  }

  setSpeed(speed: EvolveSpeed): void {
    this.speed = speed
    // Restart with new tick rate if running
    if (this._isRunning) {
      this.stop()
      this.start()
    }
  }

  getSpeed(): EvolveSpeed {
    return this.speed
  }

  start(): void {
    if (this._isRunning) return
    this._isRunning = true

    // Initialize drift states for all current layers
    this.syncDriftStates()

    const config = speedConfig[this.speed]
    this.intervalId = setInterval(() => this.tick(), config.tickMs)
  }

  stop(): void {
    this._isRunning = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /**
   * Sync drift states to match current mixer layers.
   * Creates new states for new layers, removes stale ones.
   */
  private syncDriftStates(): void {
    const { layers } = useMixerStore.getState()
    const currentIds = new Set(layers.map((l) => l.id))

    // Remove stale layers
    for (const id of this.driftStates.keys()) {
      if (!currentIds.has(id)) {
        this.driftStates.delete(id)
      }
    }

    // Add new layers
    for (const layer of layers) {
      if (!this.driftStates.has(layer.id)) {
        const paramMap = new Map<string, ParamDriftState>()
        for (const [paramName, value] of Object.entries(layer.params)) {
          paramMap.set(paramName, {
            velocity: (Math.random() - 0.5) * 0.01,
            target: Math.max(0.05, Math.min(0.95, value + (Math.random() - 0.5) * 0.3)),
            momentum: 0.9 + Math.random() * 0.08,
          })
        }
        this.driftStates.set(layer.id, { params: paramMap })
      }
    }
  }

  /**
   * One evolution tick — nudge all parameters slightly.
   */
  private tick(): void {
    if (!this._isRunning) return

    const store = useMixerStore.getState()
    const config = speedConfig[this.speed]

    // Re-sync in case layers changed
    this.syncDriftStates()

    for (const layer of store.layers) {
      if (layer.muted) continue // Don't evolve muted layers

      const driftState = this.driftStates.get(layer.id)
      if (!driftState) continue

      for (const [paramName, drift] of driftState.params.entries()) {
        const currentValue = layer.params[paramName]
        if (currentValue === undefined) continue

        // Randomly shift target occasionally
        if (Math.random() < config.targetShift) {
          drift.target = Math.max(0.05, Math.min(0.95,
            drift.target + (Math.random() - 0.5) * 0.4
          ))
        }

        // Accelerate toward target
        const direction = drift.target - currentValue
        const force = direction * 0.1

        // Update velocity with momentum + force + tiny random jitter
        drift.velocity = drift.velocity * config.momentum
          + force * (1 - config.momentum)
          + (Math.random() - 0.5) * config.stepSize * 0.3

        // Clamp velocity
        drift.velocity = Math.max(-config.stepSize, Math.min(config.stepSize, drift.velocity))

        // Apply
        const newValue = Math.max(0, Math.min(1, currentValue + drift.velocity))

        // Only update if the change is meaningful (avoid excessive re-renders)
        if (Math.abs(newValue - currentValue) > 0.001) {
          store.setLayerParam(layer.id, paramName, newValue)
        }
      }
    }
  }

  dispose(): void {
    this.stop()
    this.driftStates.clear()
  }
}

// Singleton
let evolverInstance: Evolver | null = null

export function getEvolver(): Evolver {
  if (!evolverInstance) {
    evolverInstance = new Evolver()
  }
  return evolverInstance
}

export default Evolver
