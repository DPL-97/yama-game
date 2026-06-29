# CLAUDE.md

This file provides guidance for AI coding assistants working in this repository.

## Project Overview

Yama Game is a single-page React application — a 4-player trick-taking card game with trump suits, team play, and partner signalling. The entire game logic and UI live in `src/YamaGame.jsx`.

## Tech Stack

- **React 19** with hooks (no class components)
- **Vite 6** for bundling and dev server
- **lucide-react** for icons
- No CSS framework — all styles are inline via JavaScript objects using the `COLORS` constant

## Dev Commands

```bash
npm run dev       # start dev server at http://localhost:5173
npm run build     # production build → dist/
npm run preview   # serve the production build locally
```

## Project Structure

```
yama-game/
├── index.html          # HTML entry point
├── vite.config.js      # Vite config (React plugin)
├── package.json
├── src/
│   ├── main.jsx        # React root mount
│   └── YamaGame.jsx    # All game logic and UI (single component file)
```

## Key Constants & Architecture (YamaGame.jsx)

| Constant | Purpose |
|---|---|
| `SUIT_KEYS` | `["SP","HE","DI","CL"]` — suit identifiers |
| `SUIT_INFO` | Display metadata per suit (symbol, name, color) |
| `RANK_LABEL` | Maps numeric rank (2–14) to display string |
| `SEATS` | `["S","E","N","W"]` — clockwise seating order |
| `PERSONAS` | List of named player personas |
| `TARGET_TRICKS` | `7` — tricks needed to win a round |
| `COLORS` | Centralised colour palette for inline styles |
| `SIGNALS` | `feste` and `gedreht` — partner communication signals |

### Game Rules Summary

- 4 players, 2 teams: **S+N** (home) vs **E+W** (away)
- Standard 52-card deck; cards ranked 2–14 (Ace = 14 in trick-taking, 1 in the initial draw)
- A **declarer** picks the trump suit each round
- First team to 7 tricks wins the round
- Declarer rotation: same declarer if their team wins; next clockwise player if they lose
- Suit following is enforced — must follow lead suit if able

## Notes

- UI labels and game terminology are in **German** (Pik, Herz, Karo, Kreuz, Feste, Gedreht)
- `esbuild` install scripts are approved via `allowScripts` in `package.json`
