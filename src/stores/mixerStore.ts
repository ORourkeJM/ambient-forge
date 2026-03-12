/**
 * mixerStore — Zustand store for the audio mixer.
 *
 * Manages active layers, engine lifecycle, and audio transport.
 */

import { create } from 'zustand'
import { AudioContextManager } from '../audio/AudioContextManager'
import { createEngine, implementedEngines, getAvailableEngines } from '../audio/engines'
import { getEvolver } from '../audio/Evolver'
import type { EvolveSpeed } from '../audio/Evolver'
import type { AudioEngine } from '../audio/AudioEngine'
import type { Layer, EngineType } from '../types/audio'

interface MixerStore {
  // State
  layers: Layer[]
  masterVolume: number
  isPlaying: boolean
  isInitialized: boolean
  currentSceneId: string | null
  isDirty: boolean
  isEvolving: boolean
  evolveSpeed: EvolveSpeed

  // Engine instances (not serialized)
  _engines: Map<string, AudioEngine>

  // Actions
  init: () => Promise<void>
  togglePlay: () => Promise<void>
  addLayer: (engineType: EngineType, name?: string) => void
  removeLayer: (layerId: string) => void
  setLayerVolume: (layerId: string, volume: number) => void
  setLayerPan: (layerId: string, pan: number) => void
  toggleLayerMute: (layerId: string) => void
  toggleLayerSolo: (layerId: string) => void
  setLayerParam: (layerId: string, paramName: string, value: number) => void
  setMasterVolume: (volume: number) => void
  clearAllLayers: () => void
  toggleEvolve: () => void
  setEvolveSpeed: (speed: EvolveSpeed) => void
  randomizeScene: () => Promise<void>
}

let layerIdCounter = 0

export const useMixerStore = create<MixerStore>((set, get) => ({
  layers: [],
  masterVolume: 0.8,
  isPlaying: false,
  isInitialized: false,
  currentSceneId: null,
  isDirty: false,
  isEvolving: false,
  evolveSpeed: 'slow' as EvolveSpeed,
  _engines: new Map(),

  init: async () => {
    const manager = AudioContextManager.getInstance()
    await manager.init()
    set({ isInitialized: true })
  },

  togglePlay: async () => {
    const { isPlaying, isInitialized, _engines } = get()
    if (!isInitialized) {
      await get().init()
    }

    const manager = AudioContextManager.getInstance()

    if (isPlaying) {
      // Pause
      await manager.suspend()
      set({ isPlaying: false })
    } else {
      // Play
      await manager.resume()
      // Start any engines that aren't running
      _engines.forEach((engine) => {
        if (!engine.getIsRunning()) {
          engine.start()
        }
      })
      set({ isPlaying: true })
    }
  },

  addLayer: (engineType: EngineType, name?: string) => {
    const { isInitialized, isPlaying, _engines, layers } = get()

    if (!isInitialized) return

    const engine = createEngine(engineType)
    const info = engine.getInfo()
    const params: Record<string, number> = {}
    engine.getParameters().forEach((p) => {
      params[p.name] = p.value
    })

    const layerId = `layer-${++layerIdCounter}-${Date.now()}`

    const layer: Layer = {
      id: layerId,
      engineType,
      name: name || info.name,
      volume: 0.7,
      pan: 0,
      muted: false,
      soloed: false,
      params,
    }

    engine.setVolume(0.7)

    if (isPlaying) {
      engine.start()
    }

    _engines.set(layerId, engine)
    set({
      layers: [...layers, layer],
      isDirty: true,
    })
  },

  removeLayer: (layerId: string) => {
    const { _engines, layers } = get()
    const engine = _engines.get(layerId)
    if (engine) {
      engine.dispose()
      _engines.delete(layerId)
    }
    set({
      layers: layers.filter((l) => l.id !== layerId),
      isDirty: true,
    })
  },

  setLayerVolume: (layerId: string, volume: number) => {
    const { _engines, layers } = get()
    const engine = _engines.get(layerId)
    const layer = layers.find((l) => l.id === layerId)

    if (engine && layer && !layer.muted) {
      engine.setVolume(volume)
    }

    set({
      layers: layers.map((l) =>
        l.id === layerId ? { ...l, volume } : l
      ),
      isDirty: true,
    })
  },

  setLayerPan: (layerId: string, pan: number) => {
    const { _engines, layers } = get()
    const engine = _engines.get(layerId)
    engine?.setPan(pan)

    set({
      layers: layers.map((l) =>
        l.id === layerId ? { ...l, pan } : l
      ),
      isDirty: true,
    })
  },

  toggleLayerMute: (layerId: string) => {
    const { _engines, layers } = get()
    const layer = layers.find((l) => l.id === layerId)
    if (!layer) return

    const newMuted = !layer.muted
    const engine = _engines.get(layerId)
    engine?.setMuted(newMuted)

    set({
      layers: layers.map((l) =>
        l.id === layerId ? { ...l, muted: newMuted } : l
      ),
      isDirty: true,
    })
  },

  toggleLayerSolo: (layerId: string) => {
    const { _engines, layers } = get()
    const layer = layers.find((l) => l.id === layerId)
    if (!layer) return

    const newSoloed = !layer.soloed
    const newLayers = layers.map((l) =>
      l.id === layerId ? { ...l, soloed: newSoloed } : l
    )

    // Apply solo logic: if any layer is soloed, mute all non-soloed layers
    const anySoloed = newLayers.some((l) => l.soloed)

    newLayers.forEach((l) => {
      const engine = _engines.get(l.id)
      if (!engine) return

      if (anySoloed) {
        engine.setMuted(!l.soloed || l.muted)
      } else {
        engine.setMuted(l.muted)
      }
    })

    set({ layers: newLayers, isDirty: true })
  },

  setLayerParam: (layerId: string, paramName: string, value: number) => {
    const { _engines, layers } = get()
    const engine = _engines.get(layerId)
    engine?.setParameter(paramName, value)

    set({
      layers: layers.map((l) =>
        l.id === layerId
          ? { ...l, params: { ...l.params, [paramName]: value } }
          : l
      ),
      isDirty: true,
    })
  },

  setMasterVolume: (volume: number) => {
    AudioContextManager.getInstance().setMasterVolume(volume)
    set({ masterVolume: volume, isDirty: true })
  },

  clearAllLayers: () => {
    const { _engines } = get()
    _engines.forEach((engine) => engine.dispose())
    _engines.clear()
    set({ layers: [], isDirty: true })
  },

  toggleEvolve: () => {
    const { isEvolving, evolveSpeed } = get()
    const evolver = getEvolver()

    if (isEvolving) {
      evolver.stop()
      set({ isEvolving: false })
    } else {
      evolver.setSpeed(evolveSpeed)
      evolver.start()
      set({ isEvolving: true })
    }
  },

  setEvolveSpeed: (speed: EvolveSpeed) => {
    const evolver = getEvolver()
    evolver.setSpeed(speed)
    set({ evolveSpeed: speed })
  },

  randomizeScene: async () => {
    const { isInitialized, isPlaying } = get()

    if (!isInitialized) {
      await get().init()
    }

    // Clear current scene
    get().clearAllLayers()

    // Pick 2-4 random engines
    const available = implementedEngines.slice()
    const count = 2 + Math.floor(Math.random() * 3) // 2-4 layers
    const chosen: EngineType[] = []

    for (let i = 0; i < count && available.length > 0; i++) {
      const idx = Math.floor(Math.random() * available.length)
      chosen.push(available[idx])
      available.splice(idx, 1) // Don't pick same engine twice
    }

    // Get engine metadata for names
    const allEngines = getAvailableEngines()

    // Add layers with randomized parameters
    for (const engineType of chosen) {
      const info = allEngines.find((e) => e.type === engineType)
      get().addLayer(engineType, info?.name)

      // Get the just-added layer
      const layers = get().layers
      const newLayer = layers[layers.length - 1]
      if (!newLayer) continue

      // Randomize parameters within reasonable range (0.1-0.9)
      for (const paramName of Object.keys(newLayer.params)) {
        const randomValue = 0.1 + Math.random() * 0.8
        get().setLayerParam(newLayer.id, paramName, randomValue)
      }

      // Randomize volume (0.3-0.8) and pan
      get().setLayerVolume(newLayer.id, 0.3 + Math.random() * 0.5)
      get().setLayerPan(newLayer.id, (Math.random() - 0.5) * 0.6)
    }

    // Auto-play if not already
    if (!isPlaying) {
      await get().togglePlay()
    }

    set({ isDirty: true })
  },
}))

export default useMixerStore
