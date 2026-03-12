# Ambient Forge

A procedural ambient soundscape generator built entirely with Web Audio API. Layer multiple sound engines, tweak their parameters in real-time, and drift away.

**No samples. No downloads. Pure synthesis.**

## Sound Engines

| Engine | Category | What it does |
|--------|----------|-------------|
| Rain | Nature | Filtered noise with randomized droplet bursts |
| Wind | Nature | Layered bandpass noise with gusting dynamics |
| Ocean | Nature | Rolling wave cycles with surf and undertow |
| Forest | Nature | Layered birdsong, rustling, and ambient woodland |
| Fire | Atmospheric | Crackling noise with ember pops and roar |
| Thunder | Atmospheric | Deep rumble with random lightning cracks |
| Space Drone | Synthetic | Detuned oscillators with slow LFO sweeps |
| White Noise | Synthetic | Tunable white/pink/brown noise generator |
| City | Urban | Traffic hum, distant sirens, urban ambience |
| Binaural Beats | Therapeutic | Brainwave entrainment (Delta/Theta/Alpha/Beta/Gamma) |
| Singing Bowls | Therapeutic | Resonant harmonic tones with natural decay |

## Features

- **11 procedural sound engines** across 5 categories
- **Reactive visualizers** — waveform, frequency bars, spectrogram, and a nebula particle system
- **14 factory presets** including brainwave entrainment scenes
- **Auto-evolve mode** — parameters drift naturally over time at configurable speeds
- **Sleep timer** with gradual volume fade-out
- **Scene sharing** via URL — copy a link that recreates your exact soundscape
- **Shuffle/randomize** — instant random soundscape generation
- **Full mixer** — per-layer volume, pan, mute, solo, and parameter knobs
- **Zero dependencies on audio files** — everything is synthesized in real-time

## Tech Stack

React 19 + TypeScript + Vite 7 + Tailwind CSS 4 + Zustand + Web Audio API

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## License

MIT
