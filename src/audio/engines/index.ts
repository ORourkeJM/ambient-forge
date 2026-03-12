/**
 * Engine registry — maps engine types to their constructors and metadata.
 */

import { RainEngine } from './RainEngine'
import { WindEngine } from './WindEngine'
import { SpaceDroneEngine } from './SpaceDroneEngine'
import { FireEngine } from './FireEngine'
import { OceanEngine } from './OceanEngine'
import { ForestEngine } from './ForestEngine'
import { ThunderEngine } from './ThunderEngine'
import { CityEngine } from './CityEngine'
import { BrainwaveEngine } from './BrainwaveEngine'
import { WhiteNoiseEngine } from './WhiteNoiseEngine'
import { SingingBowlEngine } from './SingingBowlEngine'
import type { AudioEngine } from '../AudioEngine'
import type { EngineInfo, EngineType } from '../../types/audio'

type EngineConstructor = new () => AudioEngine

/** Map of engine types to their constructors */
export const engineRegistry: Record<EngineType, EngineConstructor> = {
  rain: RainEngine,
  wind: WindEngine,
  'space-drone': SpaceDroneEngine,
  fire: FireEngine,
  ocean: OceanEngine,
  forest: ForestEngine,
  thunder: ThunderEngine,
  city: CityEngine,
  binaural: BrainwaveEngine,
  whitenoise: WhiteNoiseEngine,
  'singing-bowl': SingingBowlEngine,
}

/** Create an engine instance by type */
export function createEngine(type: EngineType): AudioEngine {
  const Constructor = engineRegistry[type]
  if (!Constructor) {
    throw new Error(`Unknown engine type: ${type}`)
  }
  return new Constructor()
}

/** Get metadata for all available engines */
export function getAvailableEngines(): EngineInfo[] {
  return [
    {
      type: 'rain',
      name: 'Rain',
      description: 'Filtered noise rain bed with random droplet impulses',
      category: 'nature',
      icon: '🌧',
      defaultParams: { intensity: 0.5, heaviness: 0.4, surface: 0.3, dampness: 0.3 },
    },
    {
      type: 'wind',
      name: 'Wind',
      description: 'Modulated bandpass noise with natural gusting',
      category: 'nature',
      icon: '💨',
      defaultParams: { speed: 0.4, gustiness: 0.5, direction: 0.5, howl: 0.2 },
    },
    {
      type: 'space-drone',
      name: 'Space Drone',
      description: 'Deep evolving ambient pads from detuned oscillators',
      category: 'synthetic',
      icon: '🌌',
      defaultParams: { depth: 0.3, shimmer: 0.4, drift: 0.5, warmth: 0.5, evolution: 0.5 },
    },
    {
      type: 'fire',
      name: 'Fire',
      description: 'Granular crackling with warm roar',
      category: 'nature',
      icon: '🔥',
      defaultParams: { intensity: 0.5, crackle: 0.5, warmth: 0.5, pop: 0.3, size: 0.5 },
    },
    {
      type: 'ocean',
      name: 'Ocean Waves',
      description: 'Rhythmic filtered noise with foam spray',
      category: 'nature',
      icon: '🌊',
      defaultParams: { tempo: 0.4, power: 0.5, foam: 0.3, distance: 0.5, undertow: 0.3 },
    },
    {
      type: 'forest',
      name: 'Forest',
      description: 'FM-synthesized birds with rustling leaves',
      category: 'nature',
      icon: '🌲',
      defaultParams: { density: 0.4, variety: 0.5, rustling: 0.4, canopy: 0.5, timeOfDay: 0.3 },
    },
    {
      type: 'thunder',
      name: 'Thunder',
      description: 'Low-frequency bursts with reverb roll',
      category: 'atmospheric',
      icon: '⛈',
      defaultParams: { frequency: 0.2, distance: 0.5, intensity: 0.6, rumble: 0.4 },
    },
    {
      type: 'city',
      name: 'City',
      description: 'Urban soundscape with traffic and distant sounds',
      category: 'urban',
      icon: '🏙',
      defaultParams: { traffic: 0.5, distance: 0.5, bustle: 0.4, nightMode: 0 },
    },
    {
      type: 'binaural',
      name: 'Brainwave',
      description: 'Binaural beats & isochronal tones for focus, calm, and sleep',
      category: 'therapeutic',
      icon: '🧠',
      defaultParams: { mode: 0.4, carrier: 0.3, depth: 0.6, warmth: 0.5, isochronal: 0.0 },
    },
    {
      type: 'whitenoise',
      name: 'Noise',
      description: 'White, pink, and brown noise with sweepable filters',
      category: 'synthetic',
      icon: '📡',
      defaultParams: { color: 0.5, filter: 0.5, width: 0.7, stereo: 0.4, movement: 0.2 },
    },
    {
      type: 'singing-bowl',
      name: 'Singing Bowl',
      description: 'Resonant Tibetan bowl strikes with shimmering overtones',
      category: 'therapeutic',
      icon: '🔔',
      defaultParams: { pitch: 0.3, decay: 0.6, density: 0.3, shimmer: 0.4, resonance: 0.4 },
    },
  ]
}

/** Engines that are fully implemented and ready to use */
export const implementedEngines: EngineType[] = [
  'rain',
  'wind',
  'space-drone',
  'fire',
  'ocean',
  'forest',
  'thunder',
  'city',
  'binaural',
  'whitenoise',
  'singing-bowl',
]

export { RainEngine } from './RainEngine'
export { WindEngine } from './WindEngine'
export { SpaceDroneEngine } from './SpaceDroneEngine'
export { FireEngine } from './FireEngine'
export { OceanEngine } from './OceanEngine'
export { ForestEngine } from './ForestEngine'
export { ThunderEngine } from './ThunderEngine'
export { CityEngine } from './CityEngine'
export { BrainwaveEngine } from './BrainwaveEngine'
export { WhiteNoiseEngine } from './WhiteNoiseEngine'
export { SingingBowlEngine } from './SingingBowlEngine'
