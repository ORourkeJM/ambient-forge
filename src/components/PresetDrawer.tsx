/**
 * PresetDrawer — Side panel for browsing, loading, and saving presets.
 */

import { useState, useEffect } from 'react'
import { usePresetStore } from '../stores/presetStore'
import { useMixerStore } from '../stores/mixerStore'

interface PresetDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export function PresetDrawer({ isOpen, onClose }: PresetDrawerProps) {
  const { scenes, loaded, loadPresets, loadScene, saveScene, deleteScene } = usePresetStore()
  const { layers } = useMixerStore()
  const [saveName, setSaveName] = useState('')
  const [showSaveForm, setShowSaveForm] = useState(false)

  useEffect(() => {
    if (!loaded) loadPresets()
  }, [loaded, loadPresets])

  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const factoryScenes = scenes.filter((s) => s.isFactory)
  const userScenes = scenes.filter((s) => !s.isFactory)

  const handleSave = () => {
    if (!saveName.trim()) return
    saveScene(saveName.trim())
    setSaveName('')
    setShowSaveForm(false)
  }

  const handleLoad = async (sceneId: string) => {
    const mixer = useMixerStore.getState()
    if (!mixer.isInitialized) {
      await mixer.init()
    }
    loadScene(sceneId)
    // Auto-play after loading
    if (!mixer.isPlaying) {
      await mixer.togglePlay()
    }
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Drawer */}
      <div className="relative w-full max-w-sm bg-deep border-l border-border overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-deep/90 backdrop-blur-md border-b border-border px-5 py-4 flex items-center justify-between z-10">
          <h2 className="text-base font-bold text-text">Presets</h2>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-text transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Save current */}
          {layers.length > 0 && (
            <div>
              {showSaveForm ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    placeholder="Scene name..."
                    autoFocus
                    className="flex-1 px-3 py-2 rounded-lg bg-surface border border-border text-sm text-text placeholder-text-dim focus:outline-none focus:border-glow/50"
                  />
                  <button
                    onClick={handleSave}
                    disabled={!saveName.trim()}
                    className="px-3 py-2 rounded-lg bg-glow/10 text-glow text-sm font-semibold hover:bg-glow/20 transition-all disabled:opacity-30"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setShowSaveForm(false)}
                    className="px-2 py-2 rounded-lg text-text-dim hover:text-text transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSaveForm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface hover:bg-surface-2 border border-border hover:border-glow/30 text-sm font-medium text-text-muted hover:text-glow transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Save Current Scene
                </button>
              )}
            </div>
          )}

          {/* Factory Presets */}
          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-text-dim mb-3">
              Built-in Scenes
            </h3>
            <div className="space-y-2">
              {factoryScenes.map((scene) => (
                <button
                  key={scene.id}
                  onClick={() => handleLoad(scene.id)}
                  className="w-full flex items-start gap-3 p-3 rounded-xl bg-surface hover:bg-surface-2 text-left transition-all group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-text group-hover:text-glow transition-colors">
                      {scene.name}
                    </div>
                    <div className="text-[11px] text-text-muted mt-0.5">
                      {scene.layers.length} layer{scene.layers.length !== 1 ? 's' : ''}
                      {' · '}
                      {scene.layers.map((l) => l.name).join(', ')}
                    </div>
                    {scene.tags && (
                      <div className="flex gap-1 mt-1.5">
                        {scene.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[9px] px-1.5 py-0.5 rounded-full bg-surface-2 text-text-dim"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-text-dim group-hover:text-glow transition-colors mt-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  </svg>
                </button>
              ))}
            </div>
          </div>

          {/* User Presets */}
          {userScenes.length > 0 && (
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-text-dim mb-3">
                Your Scenes
              </h3>
              <div className="space-y-2">
                {userScenes.map((scene) => (
                  <div
                    key={scene.id}
                    className="flex items-center gap-2 p-3 rounded-xl bg-surface hover:bg-surface-2 transition-all group"
                  >
                    <button
                      onClick={() => handleLoad(scene.id)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="text-sm font-semibold text-text group-hover:text-glow transition-colors">
                        {scene.name}
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5">
                        {scene.layers.length} layer{scene.layers.length !== 1 ? 's' : ''}
                        {' · '}
                        {new Date(scene.createdAt).toLocaleDateString()}
                      </div>
                    </button>
                    <button
                      onClick={() => deleteScene(scene.id)}
                      className="p-1.5 rounded-lg text-text-dim hover:text-ember hover:bg-ember/10 transition-all opacity-0 group-hover:opacity-100"
                      title="Delete scene"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PresetDrawer
