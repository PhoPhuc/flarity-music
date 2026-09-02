<div align="center">

# Flarity Music

**Desktop music player built for sound quality, speed, and offline freedom.**

[![Release](https://img.shields.io/badge/Release-v1.1.7-FA243C?style=for-the-badge)](https://github.com/PhoPhuc/flarity-music/releases/tag/v1.1.7)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-06B6D4?style=for-the-badge)](https://github.com/PhoPhuc/flarity-music/releases)
[![Rust](https://img.shields.io/badge/Backend-Rust%20Tauri%20v2-orange?style=for-the-badge&logo=rust)](https://tauri.app)
[![React](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite%208-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

[**Download**](https://github.com/PhoPhuc/flarity-music/releases/tag/v1.1.7) · [**Features**](#features) · [**Benchmarks**](#benchmarks) · [**Build from Source**](#build-from-source)

</div>

---

## About

Flarity Music is a desktop music player that plays local audio files with Hi-Res lossless support, translates lyrics using multiple AI providers, and keeps resource usage low.

It's built with **Rust (Tauri v2)** on the backend and **React 19** on the frontend. No Electron. The result is a ~6 MB installer that uses around **400 MB RAM** and starts in under half a second.

No ads. No accounts. No telemetry. Your music stays on your machine.

---

## Features

### AI Lyrics Translation

Translate lyrics in real time using the AI provider of your choice:

| Provider | Models |
|---|---|
| Google Translate | Free, no API key needed |
| Google Gemini | gemini-3.5-flash-lite (default), gemini-3.7-flash, gemini-2.0-flash, and more |
| Anthropic Claude | claude-3-7-sonnet, claude-3-5-sonnet, claude-3-5-haiku |
| OpenAI | gpt-4o, gpt-4o-mini, o3-mini |
| OpenRouter | Access to Claude, Gemini, DeepSeek, Llama, and others |
| Custom Endpoint | Any OpenAI-compatible API (Ollama, LM Studio, etc.) |

Translations appear as subtitle text below each lyric line. You can pick from 4 display styles (Apple Music, Spotify, Cinema, Neon Glow) and adjust the size and color.

Manual translation is the default. Auto-translate on open can be enabled in Settings.

### Audio Engine

- **Formats**: FLAC (up to 24-bit/192kHz), ALAC, WAV, DSD, MP3, AAC, OGG, OPUS, M4A
- **10-band equalizer** with presets (Vocal Boost, Bass Heavy, Acoustic, Electronic, Rock, R&B, Flat)
- **Spatial audio**: Bass booster, reverb, stereo widener
- **Loudness normalization** (EBU R128) — no more volume jumps between tracks
- **Gapless playback** and configurable crossfade

### Visual Design

- Dark glassmorphism UI
- 4 live background visualizers: Fluid Canvas, Waveform, Particle Cloud, Glass Blur — each reacts to audio in real time
- Full-screen lyric mode with auto-hiding cursor

### Downloads & YouTube

- Stream and browse tracks from YouTube Music without an account
- Download tracks with automatic metadata tagging and cover art
- 1080p music video player with Picture-in-Picture support

### Charts & Statistics

- Listening stats with top tracks and top artists ranked by play time
- Export chart snapshots as shareable images (OLED-black poster with album art and artist avatars)

---

## Benchmarks

Measured on the same Windows machine, playing the same track, after 5 minutes of idle playback.

| | Flarity Music | Spotify Desktop | Apple Music (Windows) |
|---|:---:|:---:|:---:|
| **RAM usage** | ~400 MB | ~950 MB – 1.4 GB | ~800 MB – 1.2 GB |
| **Startup time** | ~0.35s | ~2.8s | ~3.2s |
| **Installer size** | ~6 MB | ~280 MB | ~180 MB |
| **Max audio quality** | FLAC 24-bit/192kHz | OGG 320kbps | ALAC Lossless (paid) |
| **Offline downloads** | DRM-free MP3/FLAC | DRM-encrypted cache | DRM-encrypted cache |
| **Ads** | None | Yes (free tier) | No (subscription required) |
| **Telemetry** | None | Yes | Yes |
| **Price** | Free (MIT) | \$10.99 – \$16.99/mo | \$10.99/mo |

---

## Downloads

Latest release: [**v1.1.7**](https://github.com/PhoPhuc/flarity-music/releases/tag/v1.1.7)

### Windows (x64)
| File | Description |
|---|---|
| [`Flarity-Music-1.1.7-x64-setup.exe`](https://github.com/PhoPhuc/flarity-music/releases/download/v1.1.7/Flarity-Music-1.1.7-x64-setup.exe) | Installer (NSIS) |
| [`Flarity-Music-1.1.7-portable-x64.zip`](https://github.com/PhoPhuc/flarity-music/releases/download/v1.1.7/Flarity-Music-1.1.7-portable-x64.zip) | Portable ZIP — extract and run |
| [`Flarity-Music-1.1.7-x64.msi`](https://github.com/PhoPhuc/flarity-music/releases/download/v1.1.7/Flarity-Music-1.1.7-x64.msi) | MSI installer |

### macOS (Universal — Apple Silicon & Intel)
Universal `.dmg` available via [GitHub Actions](https://github.com/PhoPhuc/flarity-music/actions) or build from source.

---

## Build from Source

### Requirements
- Node.js 18+ and npm
- Rust toolchain (cargo, rustc 1.80+)

### Steps

```bash
git clone https://github.com/PhoPhuc/flarity-music.git
cd flarity-music
npm install

# Development
npm run dev

# Production build (Windows)
npm run dist
# Output: release/

# Production build (macOS Universal)
npm run build:macos
```

---

## Project Structure

```
flarity-music/
├── src/                        # React 19 + TypeScript frontend
│   ├── components/             # UI components
│   ├── context/                # Global state (PlayerContext)
│   ├── services/               # AI translation, update checker
│   ├── utils/                  # Audio DSP, LRC parser, Tauri bridge
│   └── App.tsx
├── src-tauri/                  # Rust backend (Tauri v2)
│   ├── src/                    # IPC commands, file scanner
│   ├── tauri.conf.json
│   └── Cargo.toml
├── scripts/                    # Build & packaging scripts
├── public/                     # Static assets
└── package.json
```

---

## Contributors

- **[PhoPhuc](https://github.com/PhoPhuc)** — Creator
- **[Antigravity](https://deepmind.google/technologies/gemini/)** — AI Pair Programmer (Google DeepMind)

## License

MIT — see [LICENSE](LICENSE) for details.
