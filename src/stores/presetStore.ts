/**
 * presetStore — Zustand store for scene presets.
 *
 * Manages saving/loading scenes, factory presets, and localStorage persistence.
 */

import { create } from 'zustand'
import { useMixerStore } from './mixerStore'
import type { Scene, EngineType } from '../types/audio'

const STORAGE_KEY = 'ambient-forge-presets'

interface PresetStore {
  scenes: Scene[]
  loaded: boolean

  // Actions
  loadPresets: () => void
  saveScene: (name: string, tags?: string[]) => void
  loadScene: (sceneId: string) => void
  deleteScene: (sceneId: string) => void
  exportScene: (sceneId: string) => string | null
  importScene: (json: string) => boolean
}

/** Factory presets — built-in scenes */
const factoryPresets: Scene[] = [
  {
    id: 'factory-rainy-night',
    name: 'Rainy Night',
    masterVolume: 0.8,
    isFactory: true,
    tags: ['calm', 'sleep'],
    createdAt: '2026-01-01T00:00:00.000Z',
    layers: [
      {
        engineType: 'rain' as EngineType,
        name: 'Rain',
        volume: 0.7,
        pan: 0,
        muted: false,
        soloed: false,
        params: { intensity: 0.6, heaviness: 0.4, surface: 0.3, dampness: 0.4 },
      },
      {
        engineType: 'wind' as EngineType,
        name: 'Wind',
        volume: 0.35,
        pan: 0.1,
        muted: false,
        soloed: false,
        params: { speed: 0.3, gustiness: 0.4, direction: 0.6, howl: 0.1 },
      },
    ],
  },
  {
    id: 'factory-deep-space',
    name: 'Deep Space',
    masterVolume: 0.75,
    isFactory: true,
    tags: ['focus', 'ambient'],
    createdAt: '2026-01-01T00:00:00.000Z',
    layers: [
      {
        engineType: 'space-drone' as EngineType,
        name: 'Space Drone',
        volume: 0.65,
        pan: 0,
        muted: false,
        soloed: false,
        params: { depth: 0.25, shimmer: 0.5, drift: 0.6, warmth: 0.6, evolution: 0.5 },
      },
    ],
  },
  {
    id: 'factory-campfire',
    name: 'Campfire Evening',
    masterVolume: 0.8,
    isFactory: true,
    tags: ['calm', 'nature'],
    createdAt: '2026-01-01T00:00:00.000Z',
    layers: [
      {
        engineType: 'fire' as EngineType,
        name: 'Campfire',
        volume: 0.7,
        pan: 0,
        muted: false,
        soloed: false,
        params: { intensity: 0.5, crackle: 0.6, warmth: 0.6, pop: 0.3, size: 0.4 },
      },
      {
        engineType: 'forest' as EngineType,
        name: 'Night Forest',
        volume: 0.3,
        pan: 0,
        muted: false,
        soloed: false,
        params: { density: 0.15, variety: 0.4, rustling: 0.3, canopy: 0.6, timeOfDay: 0.8 },
      },
    ],
  },
  {
    id: 'factory-coastal-dawn',
    name: 'Coastal Dawn',
    masterVolume: 0.8,
    isFactory: true,
    tags: ['nature', 'calm'],
    createdAt: '2026-01-01T00:00:00.000Z',
    layers: [
      {
        engineType: 'ocean' as EngineType,
        name: 'Ocean',
        volume: 0.65,
        pan: 0,
        muted: false,
        soloed: false,
        params: { tempo: 0.35, power: 0.5, foam: 0.4, distance: 0.4, undertow: 0.3 },
      },
      {
        engineType: 'wind' as EngineType,
        name: 'Sea Breeze',
        volume: 0.25,
        pan: -0.2,
        muted: false,
        soloed: false,
        params: { speed: 0.25, gustiness: 0.3, direction: 0.7, howl: 0 },
      },
      {
        engineType: 'forest' as EngineType,
        name: 'Seabirds',
        volume: 0.15,
        pan: 0.3,
        muted: false,
        soloed: false,
        params: { density: 0.2, variety: 0.3, rustling: 0.1, canopy: 0.2, timeOfDay: 0.2 },
      },
    ],
  },
  {
    id: 'factory-thunderstorm',
    name: 'Thunderstorm',
    masterVolume: 0.85,
    isFactory: true,
    tags: ['intense', 'dramatic'],
    createdAt: '2026-01-01T00:00:00.000Z',
    layers: [
      {
        engineType: 'rain' as EngineType,
        name: 'Heavy Rain',
        volume: 0.8,
        pan: 0,
        muted: false,
        soloed: false,
        params: { intensity: 0.8, heaviness: 0.6, surface: 0.4, dampness: 0.5 },
      },
      {
        engineType: 'wind' as EngineType,
        name: 'Storm Wind',
        volume: 0.5,
        pan: 0,
        muted: false,
        soloed: false,
        params: { speed: 0.7, gustiness: 0.8, direction: 0.5, howl: 0.4 },
      },
      {
        engineType: 'thunder' as EngineType,
        name: 'Thunder',
        volume: 0.7,
        pan: 0,
        muted: false,
        soloed: false,
        params: { frequency: 0.5, distance: 0.3, intensity: 0.7, rumble: 0.5 },
      },
    ],
  },
  {
    id: 'factory-city-night',
    name: 'City Night',
    masterVolume: 0.75,
    isFactory: true,
    tags: ['urban', 'calm'],
    createdAt: '2026-01-01T00:00:00.000Z',
    layers: [
      {
        engineType: 'city' as EngineType,
        name: 'City',
        volume: 0.6,
        pan: 0,
        muted: false,
        soloed: false,
        params: { traffic: 0.4, distance: 0.5, bustle: 0.3, nightMode: 0.8 },
      },
      {
        engineType: 'rain' as EngineType,
        name: 'Light Rain',
        volume: 0.3,
        pan: 0,
        muted: false,
        soloed: false,
        params: { intensity: 0.3, heaviness: 0.3, surface: 0.4, dampness: 0.5 },
      },
    ],
  },
  {
    id: 'factory-meditation',
    name: 'Meditation Garden',
    masterVolume: 0.7,
    isFactory: true,
    tags: ['calm', 'focus', 'meditation'],
    createdAt: '2026-01-01T00:00:00.000Z',
    layers: [
      {
        engineType: 'space-drone' as EngineType,
        name: 'Om Drone',
        volume: 0.4,
        pan: 0,
        muted: false,
        soloed: false,
        params: { depth: 0.2, shimmer: 0.3, drift: 0.3, warmth: 0.7, evolution: 0.3 },
      },
      {
        engineType: 'forest' as EngineType,
        name: 'Garden',
        volume: 0.25,
        pan: 0,
        muted: false,
        soloed: false,
        params: { density: 0.2, variety: 0.6, rustling: 0.2, canopy: 0.4, timeOfDay: 0.3 },
      },
      {
        engineType: 'rain' as EngineType,
        name: 'Gentle Rain',
        volume: 0.2,
        pan: 0,
        muted: false,
        soloed: false,
        params: { intensity: 0.2, heaviness: 0.3, surface: 0.5, dampness: 0.6 },
      },
    ],
  },
  // ── Therapeutic / Brainwave Presets ──
  {
    id: 'factory-deep-focus',
    name: 'Deep Focus',
    masterVolume: 0.7,
    isFactory: true,
    tags: ['focus', 'productivity', 'therapeutic'],
    createdAt: '2026-01-01T00:00:00.000Z',
    layers: [
      {
        engineType: 'binaural' as EngineType,
        name: 'Beta Waves',
        volume: 0.55,
        pan: 0,
        muted: false,
        soloed: false,
        // mode 0.7 = Beta range (~18 Hz) for active concentration
        params: { mode: 0.7, carrier: 0.35, depth: 0.6, warmth: 0.4, isochronal: 0.15 },
      },
      {
        engineType: 'rain' as EngineType,
        name: 'Soft Rain',
        volume: 0.3,
        pan: 0,
        muted: false,
        soloed: false,
        params: { intensity: 0.25, heaviness: 0.3, surface: 0.4, dampness: 0.5 },
      },
    ],
  },
  {
    id: 'factory-deep-sleep',
    name: 'Deep Sleep',
    masterVolume: 0.65,
    isFactory: true,
    tags: ['sleep', 'therapeutic', 'delta'],
    createdAt: '2026-01-01T00:00:00.000Z',
    layers: [
      {
        engineType: 'binaural' as EngineType,
        name: 'Delta Waves',
        volume: 0.5,
        pan: 0,
        muted: false,
        soloed: false,
        // mode 0.05 = deep Delta (~1 Hz) for restorative sleep
        params: { mode: 0.05, carrier: 0.2, depth: 0.7, warmth: 0.7, isochronal: 0.0 },
      },
      {
        engineType: 'ocean' as EngineType,
        name: 'Gentle Waves',
        volume: 0.35,
        pan: 0,
        muted: false,
        soloed: false,
        params: { tempo: 0.25, power: 0.3, foam: 0.2, distance: 0.6, undertow: 0.2 },
      },
    ],
  },
  {
    id: 'factory-theta-meditation',
    name: 'Theta Meditation',
    masterVolume: 0.65,
    isFactory: true,
    tags: ['meditation', 'therapeutic', 'theta'],
    createdAt: '2026-01-01T00:00:00.000Z',
    layers: [
      {
        engineType: 'binaural' as EngineType,
        name: 'Theta Waves',
        volume: 0.5,
        pan: 0,
        muted: false,
        soloed: false,
        // mode 0.25 = Theta range (~6 Hz) for deep meditation
        params: { mode: 0.25, carrier: 0.25, depth: 0.65, warmth: 0.6, isochronal: 0.0 },
      },
      {
        engineType: 'space-drone' as EngineType,
        name: 'Ambient Pad',
        volume: 0.3,
        pan: 0,
        muted: false,
        soloed: false,
        params: { depth: 0.15, shimmer: 0.3, drift: 0.3, warmth: 0.8, evolution: 0.2 },
      },
    ],
  },
  {
    id: 'factory-calm-alpha',
    name: 'Calm & Centered',
    masterVolume: 0.7,
    isFactory: true,
    tags: ['calm', 'relaxation', 'therapeutic', 'alpha'],
    createdAt: '2026-01-01T00:00:00.000Z',
    layers: [
      {
        engineType: 'binaural' as EngineType,
        name: 'Alpha Waves',
        volume: 0.5,
        pan: 0,
        muted: false,
        soloed: false,
        // mode 0.5 = Alpha range (~10 Hz) for calm alertness
        params: { mode: 0.5, carrier: 0.3, depth: 0.6, warmth: 0.55, isochronal: 0.1 },
      },
      {
        engineType: 'forest' as EngineType,
        name: 'Forest',
        volume: 0.25,
        pan: 0,
        muted: false,
        soloed: false,
        params: { density: 0.25, variety: 0.5, rustling: 0.3, canopy: 0.5, timeOfDay: 0.3 },
      },
    ],
  },
  {
    id: 'factory-bowl-meditation',
    name: 'Temple Bells',
    masterVolume: 0.65,
    isFactory: true,
    tags: ['meditation', 'therapeutic', 'bells'],
    createdAt: '2026-01-01T00:00:00.000Z',
    layers: [
      {
        engineType: 'singing-bowl' as EngineType,
        name: 'Singing Bowls',
        volume: 0.6,
        pan: 0,
        muted: false,
        soloed: false,
        params: { pitch: 0.25, decay: 0.7, density: 0.25, shimmer: 0.5, resonance: 0.5 },
      },
      {
        engineType: 'binaural' as EngineType,
        name: 'Theta Waves',
        volume: 0.35,
        pan: 0,
        muted: false,
        soloed: false,
        params: { mode: 0.25, carrier: 0.2, depth: 0.5, warmth: 0.7, isochronal: 0.0 },
      },
    ],
  },
  {
    id: 'factory-pink-noise-focus',
    name: 'Pink Noise Focus',
    masterVolume: 0.7,
    isFactory: true,
    tags: ['focus', 'noise', 'productivity'],
    createdAt: '2026-01-01T00:00:00.000Z',
    layers: [
      {
        engineType: 'whitenoise' as EngineType,
        name: 'Pink Noise',
        volume: 0.55,
        pan: 0,
        muted: false,
        soloed: false,
        // color 0.5 = pink noise, wide filter, gentle movement
        params: { color: 0.5, filter: 0.5, width: 0.8, stereo: 0.5, movement: 0.15 },
      },
    ],
  },
  {
    id: 'factory-brown-noise-sleep',
    name: 'Brown Noise Cocoon',
    masterVolume: 0.6,
    isFactory: true,
    tags: ['sleep', 'noise', 'deep'],
    createdAt: '2026-01-01T00:00:00.000Z',
    layers: [
      {
        engineType: 'whitenoise' as EngineType,
        name: 'Brown Noise',
        volume: 0.6,
        pan: 0,
        muted: false,
        soloed: false,
        // color 0.85 = deep brown, warm filter
        params: { color: 0.85, filter: 0.35, width: 0.6, stereo: 0.3, movement: 0.1 },
      },
      {
        engineType: 'binaural' as EngineType,
        name: 'Delta Waves',
        volume: 0.3,
        pan: 0,
        muted: false,
        soloed: false,
        params: { mode: 0.05, carrier: 0.15, depth: 0.5, warmth: 0.8, isochronal: 0.0 },
      },
    ],
  },
]

export const usePresetStore = create<PresetStore>((set, get) => ({
  scenes: [],
  loaded: false,

  loadPresets: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      const userScenes: Scene[] = stored ? JSON.parse(stored) : []
      set({ scenes: [...factoryPresets, ...userScenes], loaded: true })
    } catch {
      set({ scenes: [...factoryPresets], loaded: true })
    }
  },

  saveScene: (name: string, tags?: string[]) => {
    const mixer = useMixerStore.getState()
    const scene: Scene = {
      id: `scene-${Date.now()}`,
      name,
      masterVolume: mixer.masterVolume,
      createdAt: new Date().toISOString(),
      tags,
      layers: mixer.layers.map((l) => ({
        engineType: l.engineType,
        name: l.name,
        volume: l.volume,
        pan: l.pan,
        muted: l.muted,
        soloed: l.soloed,
        params: { ...l.params },
      })),
    }

    const { scenes } = get()
    const userScenes = scenes.filter((s) => !s.isFactory)
    const newUserScenes = [...userScenes, scene]

    // Persist user scenes to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newUserScenes))
    } catch {
      // localStorage full or unavailable
    }

    set({ scenes: [...factoryPresets, ...newUserScenes] })
  },

  loadScene: (sceneId: string) => {
    const { scenes } = get()
    const scene = scenes.find((s) => s.id === sceneId)
    if (!scene) return

    const mixer = useMixerStore.getState()

    // Clear current layers
    mixer.clearAllLayers()

    // Set master volume
    mixer.setMasterVolume(scene.masterVolume)

    // Add layers from scene
    scene.layers.forEach((layerDef) => {
      mixer.addLayer(layerDef.engineType, layerDef.name)

      // Get the just-added layer
      const layers = useMixerStore.getState().layers
      const newLayer = layers[layers.length - 1]
      if (!newLayer) return

      // Apply params
      Object.entries(layerDef.params).forEach(([paramName, value]) => {
        mixer.setLayerParam(newLayer.id, paramName, value)
      })

      // Apply volume, pan, mute, solo
      mixer.setLayerVolume(newLayer.id, layerDef.volume)
      mixer.setLayerPan(newLayer.id, layerDef.pan)
      if (layerDef.muted) mixer.toggleLayerMute(newLayer.id)
      if (layerDef.soloed) mixer.toggleLayerSolo(newLayer.id)
    })
  },

  deleteScene: (sceneId: string) => {
    const { scenes } = get()
    const scene = scenes.find((s) => s.id === sceneId)
    if (!scene || scene.isFactory) return // Can't delete factory presets

    const newScenes = scenes.filter((s) => s.id !== sceneId)
    const userScenes = newScenes.filter((s) => !s.isFactory)

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userScenes))
    } catch { /* */ }

    set({ scenes: newScenes })
  },

  exportScene: (sceneId: string) => {
    const { scenes } = get()
    const scene = scenes.find((s) => s.id === sceneId)
    if (!scene) return null
    return JSON.stringify(scene, null, 2)
  },

  importScene: (json: string) => {
    try {
      const scene = JSON.parse(json) as Scene
      if (!scene.id || !scene.name || !scene.layers) return false

      // Give it a new ID to avoid conflicts
      scene.id = `imported-${Date.now()}`
      scene.isFactory = false

      const { scenes } = get()
      const userScenes = scenes.filter((s) => !s.isFactory)
      const newUserScenes = [...userScenes, scene]

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newUserScenes))
      } catch { /* */ }

      set({ scenes: [...factoryPresets, ...newUserScenes] })
      return true
    } catch {
      return false
    }
  },
}))

export default usePresetStore
