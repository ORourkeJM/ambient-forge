/**
 * App.tsx — Ambient Forge main application.
 *
 * A procedural ambient soundscape generator. Layer engines,
 * tweak parameters, and drift away.
 */

import { useState, useCallback, useEffect } from 'react'
import { useMixerStore } from './stores/mixerStore'
import { usePresetStore } from './stores/presetStore'
import { TransportBar } from './components/TransportBar'
import { ChannelStrip } from './components/ChannelStrip'
import { EnginePicker } from './components/EnginePicker'
import { PresetDrawer } from './components/PresetDrawer'
import { SleepTimer } from './components/SleepTimer'
import { VisualizerSwitcher } from './visualizers/VisualizerSwitcher'
import { getAvailableEngines } from './audio/engines'
import { buildShareUrl, getSceneFromUrl, clearSceneFromUrl } from './lib/sceneUrl'
import { uiSounds } from './audio/uiSounds'
import type { EngineType } from './types/audio'
import './index.css'

function App() {
  const [showPicker, setShowPicker] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const { layers, isPlaying, isInitialized, _engines, addLayer, init, masterVolume } = useMixerStore()
  const { loadPresets, loaded: presetsLoaded, loadScene } = usePresetStore()

  const availableEngines = getAvailableEngines()

  // Load presets on mount
  useEffect(() => {
    if (!presetsLoaded) loadPresets()
  }, [presetsLoaded, loadPresets])

  // Load scene from URL hash on mount
  useEffect(() => {
    const scene = getSceneFromUrl()
    if (!scene || scene.layers.length === 0) return

    const loadSharedScene = async () => {
      if (!useMixerStore.getState().isInitialized) {
        await useMixerStore.getState().init()
      }

      const mixer = useMixerStore.getState()
      mixer.clearAllLayers()
      mixer.setMasterVolume(scene.masterVolume)

      for (const layerDef of scene.layers) {
        mixer.addLayer(layerDef.engineType, layerDef.name)
        const currentLayers = useMixerStore.getState().layers
        const newLayer = currentLayers[currentLayers.length - 1]
        if (!newLayer) continue

        Object.entries(layerDef.params).forEach(([paramName, value]) => {
          mixer.setLayerParam(newLayer.id, paramName, value)
        })
        mixer.setLayerVolume(newLayer.id, layerDef.volume)
        mixer.setLayerPan(newLayer.id, layerDef.pan)
      }

      // Auto-play
      if (!useMixerStore.getState().isPlaying) {
        await useMixerStore.getState().togglePlay()
      }

      // Clear the hash so refreshing doesn't re-load
      clearSceneFromUrl()
    }

    loadSharedScene()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Copy a shareable URL to the clipboard */
  const handleShare = useCallback(async () => {
    if (layers.length === 0) return

    const scene = {
      masterVolume,
      layers: layers.map((l) => ({
        engineType: l.engineType,
        name: l.name,
        volume: l.volume,
        pan: l.pan,
        params: { ...l.params },
      })),
    }

    const url = buildShareUrl(scene)

    try {
      await navigator.clipboard.writeText(url)
      uiSounds.shareCopied()
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } catch {
      // Fallback: select a prompt
      window.prompt('Copy this URL to share your soundscape:', url)
    }
  }, [layers, masterVolume])

  const handleAddLayer = useCallback(
    async (type: EngineType) => {
      if (!isInitialized) {
        await init()
      }
      addLayer(type)
    },
    [isInitialized, init, addLayer]
  )

  const handleLoadFactoryPreset = useCallback(
    async (presetId: string) => {
      uiSounds.presetLoad()
      if (!isInitialized) await init()
      loadScene(presetId)
      const mixer = useMixerStore.getState()
      if (!mixer.isPlaying) await mixer.togglePlay()
    },
    [isInitialized, init, loadScene]
  )

  const getEngineParams = (layerId: string) => {
    const engine = _engines.get(layerId)
    return engine?.getParameters() ?? []
  }

  const getEngineIcon = (type: EngineType): string => {
    return availableEngines.find((e) => e.type === type)?.icon ?? '🎵'
  }

  return (
    <div className="min-h-screen bg-void flex flex-col">
      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500 ${
            isPlaying
              ? 'bg-glow/15 shadow-[0_0_20px_rgba(74,240,192,0.2)]'
              : 'bg-glow/10'
          }`}>
            <span className={`text-glow text-lg transition-all duration-500 ${
              isPlaying ? 'animate-ambient-pulse' : ''
            }`}>⚡</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-text tracking-tight">Ambient Forge</h1>
            <p className="text-[10px] text-text-dim uppercase tracking-widest">Procedural Soundscapes</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Sleep timer */}
          <SleepTimer />

          {/* Presets button */}
          <button
            onClick={() => setShowPresets(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-2 text-xs text-text-muted hover:text-text transition-all border border-border hover:border-border-bright"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Presets
          </button>

          {/* Share button */}
          {layers.length > 0 && (
            <button
              onClick={handleShare}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all border ${
                shareCopied
                  ? 'bg-glow/15 text-glow border-glow/30'
                  : 'bg-surface hover:bg-surface-2 text-text-muted hover:text-text border-border hover:border-border-bright'
              }`}
            >
              {shareCopied ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share
                </>
              )}
            </button>
          )}

          {/* Keyboard hints */}
          <div className="text-[10px] text-text-dim hidden lg:flex items-center gap-2">
            {[
              { key: 'Space', label: 'play' },
              { key: 'N', label: 'add' },
              { key: 'E', label: 'evolve' },
              { key: 'R', label: 'shuffle' },
            ].map(({ key, label }) => (
              <div key={key}>
                <kbd className="px-1.5 py-0.5 rounded bg-surface text-text-muted border border-border text-[9px] font-mono">
                  {key}
                </kbd>
                {' '}{label}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-6 pb-6 flex flex-col gap-4">
        {/* Transport */}
        <TransportBar onAddLayer={() => setShowPicker(true)} />

        {/* Visualization */}
        <VisualizerSwitcher isPlaying={isPlaying} />

        {/* Mixer — Channel strips */}
        {layers.length > 0 ? (
          <div>
            {/* Layer count header */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs text-text-dim uppercase tracking-widest">
                Mixer — {layers.length} layer{layers.length !== 1 ? 's' : ''}
              </h2>
              <button
                onClick={() => setShowPicker(true)}
                className="text-[10px] text-glow/60 hover:text-glow transition-all"
              >
                + Add Layer
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {layers.map((layer) => (
                <ChannelStrip
                  key={layer.id}
                  layer={layer}
                  engineParams={getEngineParams(layer.id).map((p) => ({
                    name: p.name,
                    label: p.label,
                    value: p.value,
                    defaultValue: p.defaultValue,
                    color: p.color,
                  }))}
                  engineIcon={getEngineIcon(layer.engineType)}
                />
              ))}
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 rounded-2xl bg-surface/50 flex items-center justify-center mx-auto mb-5 animate-slow-drift">
                <span className="text-4xl">🌌</span>
              </div>
              <h2 className="text-xl font-bold text-text mb-2">Your soundscape is empty</h2>
              <p className="text-sm text-text-muted mb-6 leading-relaxed">
                Add sound layers to begin crafting your ambient environment.
                Layer rain over wind, mix in space drones — the possibilities are endless.
              </p>
              <button
                onClick={() => setShowPicker(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-glow/10 text-glow hover:bg-glow/20 transition-all text-sm font-semibold glow-box"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Your First Layer
              </button>

              {/* Quick start presets */}
              <div className="mt-8">
                <p className="text-[10px] text-text-dim uppercase tracking-widest mb-3">Quick Start Scenes</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[
                    { id: 'factory-rainy-night', label: '🌧 Rainy Night' },
                    { id: 'factory-deep-space', label: '🌌 Deep Space' },
                    { id: 'factory-campfire', label: '🔥 Campfire Evening' },
                    { id: 'factory-coastal-dawn', label: '🌊 Coastal Dawn' },
                    { id: 'factory-thunderstorm', label: '⛈ Thunderstorm' },
                    { id: 'factory-meditation', label: '🧘 Meditation Garden' },
                    { id: 'factory-city-night', label: '🏙 City Night' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handleLoadFactoryPreset(preset.id)}
                      className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-2 text-xs text-text-muted hover:text-text transition-all border border-border hover:border-border-bright"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Therapeutic / Brainwave presets */}
              <div className="mt-4">
                <p className="text-[10px] text-text-dim uppercase tracking-widest mb-3">
                  🧠 Brainwave Entrainment <span className="text-mist/60">(headphones recommended)</span>
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[
                    { id: 'factory-deep-focus', label: '🎯 Deep Focus (Beta)' },
                    { id: 'factory-calm-alpha', label: '🍃 Calm (Alpha)' },
                    { id: 'factory-theta-meditation', label: '🔮 Meditation (Theta)' },
                    { id: 'factory-deep-sleep', label: '😴 Deep Sleep (Delta)' },
                    { id: 'factory-bowl-meditation', label: '🔔 Temple Bells' },
                    { id: 'factory-pink-noise-focus', label: '📡 Pink Noise' },
                    { id: 'factory-brown-noise-sleep', label: '🌑 Brown Noise' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handleLoadFactoryPreset(preset.id)}
                      className="px-3 py-1.5 rounded-lg bg-mist/5 hover:bg-mist/15 text-xs text-mist/70 hover:text-mist transition-all border border-mist/20 hover:border-mist/40"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Engine Picker Modal */}
      <EnginePicker
        isOpen={showPicker}
        onSelect={handleAddLayer}
        onClose={() => setShowPicker(false)}
      />

      {/* Preset Drawer */}
      <PresetDrawer
        isOpen={showPresets}
        onClose={() => setShowPresets(false)}
      />

      {/* Global keyboard shortcuts */}
      <KeyboardShortcuts onAddLayer={() => setShowPicker(true)} />

      {/* Footer credit */}
      <footer className="px-6 py-3 flex items-center justify-center gap-1.5 text-[10px] text-text-dim/40">
        <span>Crafted by</span>
        <span className="text-mist/50 font-medium tracking-wide">Loom</span>
        <span className="text-text-dim/20">·</span>
        <span>2025</span>
      </footer>
    </div>
  )
}

/** Global keyboard shortcuts handler */
function KeyboardShortcuts({ onAddLayer }: { onAddLayer: () => void }) {
  const { togglePlay, isInitialized, init, toggleEvolve, randomizeScene } = useMixerStore()

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Don't capture if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.code) {
        case 'Space':
          e.preventDefault()
          if (!isInitialized) await init()
          togglePlay()
          break
        case 'KeyN':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            onAddLayer()
          }
          break
        case 'KeyE':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            toggleEvolve()
          }
          break
        case 'KeyR':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            randomizeScene()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlay, isInitialized, init, onAddLayer, toggleEvolve, randomizeScene])

  return null
}

export default App
