# Yama Game

A 4-player trick-taking card game built with React + Vite — playable in the browser or as a native desktop app (macOS / Windows).

## Overview

Yama Game is a 4-player trick-taking card game played with a standard 52-card deck. Players sit at four seats (South, East, North, West) and compete in two teams: **S+N** (home) vs **E+W** (away). The first team to win **7 tricks** in a round wins that round.

### Game Features

- **Trump system** — A declarer chooses the trump suit each round; trump cards beat all other suits
- **Signals** — Players can signal their partner:
  - 💪 **Feste** — Play the same suit again at its lowest value; partner will win the next trick of that suit
  - 🔄 **Gedreht** — Last card of this suit; partner may now lead trump to pull out opposing trumps
- **Card animations** — Cards fly into the center from each seat's direction; Feste plays with an elastic bounce + flash, Gedreht spins 810° (lands sideways)
- **Personas** — Named player personas: Yama, Parn, Aaron, Grace, Denny, Philipp, Batu, Rafa, Max, David, Luca
- **Declarer rotation** — If the declarer's team wins, the same declarer picks trump next round; if they lose, the next player clockwise becomes declarer

## Tech Stack

- [React 19](https://react.dev/)
- [Vite 6](https://vite.dev/)
- [Electron 36](https://www.electronjs.org/) (desktop packaging)
- [lucide-react](https://lucide.dev/)

## Getting Started

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start local dev server |
| `npm run build` | Build for production (web) |
| `npm run preview` | Preview production build |
| `npm run electron:build:mac` | Build macOS `.dmg` installer (run on Mac) |
| `npm run electron:build:win` | Build Windows `.exe` installer (run on Windows) |

## Desktop App

The game can be packaged as a native desktop executable using Electron.

### Build locally

```bash
# macOS (produces release/Yama Game-x.x.x.dmg for x64 + arm64)
npm run electron:build:mac

# Windows (produces release/Yama Game Setup x.x.x.exe)
npm run electron:build:win
```

### CI builds (GitHub Actions)

Every push to `main` automatically builds both platforms in parallel via `.github/workflows/build.yml`. Download the artifacts from the **Actions** tab on GitHub:

- **Yama-Game-macOS** → `.dmg` (drag-and-drop installer)
- **Yama-Game-Windows** → `.exe` (NSIS installer)

## Project Structure

```
yama-game/
├── electron/
│   └── main.cjs          # Electron main process
├── .github/workflows/
│   └── build.yml         # CI: builds Mac + Windows executables
├── src/
│   ├── main.jsx          # React root
│   └── YamaGame.jsx      # All game logic and UI
├── index.html
└── vite.config.js
```

