# Yama Game

A browser-based card game built with React + Vite.

## Overview

Yama Game is a 4-player trick-taking card game played with a standard 52-card deck. Players sit at four seats (South, East, North, West) and compete in two teams: **S+N** (home) vs **E+W** (away). The first team to win **7 tricks** in a round wins that round.

### Game Features

- **Trump system** — A declarer chooses the trump suit each round; trump cards beat all other suits
- **Signals** — Players can signal their partner:
  - 💪 **Feste** — Play the same suit again at its lowest value; partner will win the next trick of that suit
  - 🔄 **Gedreht** — Last card of this suit; partner may now lead trump to pull out opposing trumps
- **Personas** — Named player personas: Yama, Parn, Aaron, Grace, Denny, Philipp, Batu, Rafa, Max, David, Luca
- **Declarer rotation** — If the declarer's team wins, the same declarer picks trump next round; if they lose, the next player clockwise becomes declarer

## Tech Stack

- [React 19](https://react.dev/)
- [Vite 6](https://vite.dev/)
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
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
