/**
 * Core type definitions for Ambient Forge audio system.
 */

// ── Engine Parameter ──

export interface EngineParameter {
  /** Internal name (e.g., "intensity", "speed") */
  name: string
  /** Display label (e.g., "Intensity", "Wind Speed") */
  label: string
  /** Normalized value 0-1 */
  value: number
  /** Default normalized value */
  defaultValue: number
  /** Minimum raw value (for display) */
  min?: number
  /** Maximum raw value (for display) */
  max?: number
  /** Unit label (e.g., "Hz", "%", "dB") */
  unit?: string
  /** Accent color for this parameter's knob */
  color?: string
}

// ── Engine Metadata ──

export type EngineCategory = 'nature' | 'atmospheric' | 'synthetic' | 'urban' | 'therapeutic'

export interface EngineInfo {
  /** Unique engine type key */
  type: EngineType
  /** Display name */
  name: string
  /** Short description */
  description: string
  /** Category for picker grouping */
  category: EngineCategory
  /** Icon name or emoji */
  icon: string
  /** Default parameter values */
  defaultParams: Record<string, number>
}

// ── Engine Types ──

export type EngineType =
  | 'rain'
  | 'wind'
  | 'space-drone'
  | 'fire'
  | 'ocean'
  | 'forest'
  | 'thunder'
  | 'city'
  | 'binaural'
  | 'whitenoise'
  | 'singing-bowl'

// ── Layer ──

export interface Layer {
  /** Unique layer instance ID */
  id: string
  /** Engine type for this layer */
  engineType: EngineType
  /** Display name (defaults to engine name, user can rename) */
  name: string
  /** Volume 0-1 */
  volume: number
  /** Pan -1 (left) to 1 (right) */
  pan: number
  /** Muted state */
  muted: boolean
  /** Soloed state */
  soloed: boolean
  /** Current parameter values (name → normalized 0-1) */
  params: Record<string, number>
}

// ── Scene / Preset ──

export interface Scene {
  /** Unique scene ID */
  id: string
  /** Scene display name */
  name: string
  /** Layers in this scene */
  layers: Omit<Layer, 'id'>[]
  /** Master volume */
  masterVolume: number
  /** When the scene was created */
  createdAt: string
  /** Whether this is a built-in factory preset */
  isFactory?: boolean
  /** Tags for organizing */
  tags?: string[]
}

// ── Mixer State ──

export interface MixerState {
  /** Active layers */
  layers: Layer[]
  /** Master volume 0-1 */
  masterVolume: number
  /** Is audio playing */
  isPlaying: boolean
  /** Currently loaded scene ID (null if unsaved) */
  currentSceneId: string | null
  /** Has the state changed since last save */
  isDirty: boolean
}

// ── Analyser Data ──

export interface AnalyserData {
  /** Time-domain waveform data (oscilloscope) */
  waveform: Float32Array
  /** Frequency data (spectrum) */
  frequency: Float32Array
  /** RMS energy level 0-1 */
  energy: number
  /** Dominant frequency band energies */
  bands: {
    sub: number    // 20-60 Hz
    bass: number   // 60-250 Hz
    low: number    // 250-500 Hz
    mid: number    // 500-2000 Hz
    high: number   // 2000-6000 Hz
    air: number    // 6000-20000 Hz
  }
}

// ── Timer ──

export interface TimerState {
  /** Is timer active */
  active: boolean
  /** Total duration in seconds */
  duration: number
  /** Remaining time in seconds */
  remaining: number
  /** Is currently fading out */
  isFading: boolean
}
