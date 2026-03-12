/**
 * sceneUrl — Encode/decode mixer scenes to/from shareable URL hashes.
 *
 * Format: Base64-encoded JSON with compact keys:
 * {
 *   v: masterVolume (0-100 integer),
 *   l: [{
 *     e: engineType,
 *     n: name,
 *     v: volume (0-100),
 *     p: pan (-100 to 100),
 *     k: { paramName: value(0-100) }
 *   }, ...]
 * }
 *
 * URL: https://example.com/#scene=<base64>
 */

import type { EngineType } from '../types/audio'

/** Compact layer representation */
interface CompactLayer {
  e: string   // engineType
  n: string   // name
  v: number   // volume 0-100
  p: number   // pan -100 to 100
  k: Record<string, number> // params (values 0-100)
}

/** Compact scene representation */
interface CompactScene {
  v: number           // master volume 0-100
  l: CompactLayer[]   // layers
}

/** Layer data for encoding (matches the mixerStore layer shape) */
export interface ShareableLayer {
  engineType: EngineType
  name: string
  volume: number      // 0-1
  pan: number         // -1 to 1
  params: Record<string, number> // 0-1 values
}

/** Full scene data for encoding */
export interface ShareableScene {
  masterVolume: number
  layers: ShareableLayer[]
}

/**
 * Encode a mixer scene into a URL-safe hash string.
 */
export function encodeScene(scene: ShareableScene): string {
  const compact: CompactScene = {
    v: Math.round(scene.masterVolume * 100),
    l: scene.layers.map((layer) => ({
      e: layer.engineType,
      n: layer.name,
      v: Math.round(layer.volume * 100),
      p: Math.round(layer.pan * 100),
      k: Object.fromEntries(
        Object.entries(layer.params).map(([key, val]) => [key, Math.round(val * 100)])
      ),
    })),
  }

  const json = JSON.stringify(compact)
  // Use btoa for base64, then make URL-safe
  const base64 = btoa(json)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  return base64
}

/**
 * Decode a URL hash string back into a scene definition.
 * Returns null if the hash is invalid.
 */
export function decodeScene(hash: string): ShareableScene | null {
  try {
    // Restore standard base64 from URL-safe variant
    let base64 = hash.replace(/-/g, '+').replace(/_/g, '/')
    // Add padding if needed
    while (base64.length % 4 !== 0) base64 += '='

    const json = atob(base64)
    const compact: CompactScene = JSON.parse(json)

    // Validate structure
    if (typeof compact.v !== 'number' || !Array.isArray(compact.l)) {
      return null
    }

    return {
      masterVolume: compact.v / 100,
      layers: compact.l.map((cl) => ({
        engineType: cl.e as EngineType,
        name: cl.n || cl.e,
        volume: cl.v / 100,
        pan: cl.p / 100,
        params: Object.fromEntries(
          Object.entries(cl.k).map(([key, val]) => [key, val / 100])
        ),
      })),
    }
  } catch {
    return null
  }
}

/**
 * Build a full shareable URL from a scene.
 */
export function buildShareUrl(scene: ShareableScene): string {
  const hash = encodeScene(scene)
  const base = window.location.origin + window.location.pathname
  return `${base}#scene=${hash}`
}

/**
 * Try to extract a scene from the current URL hash.
 * Returns null if no scene is encoded in the URL.
 */
export function getSceneFromUrl(): ShareableScene | null {
  const hash = window.location.hash
  if (!hash.startsWith('#scene=')) return null
  const encoded = hash.slice('#scene='.length)
  return decodeScene(encoded)
}

/**
 * Clear the scene hash from the URL without triggering navigation.
 */
export function clearSceneFromUrl(): void {
  history.replaceState(null, '', window.location.pathname)
}
