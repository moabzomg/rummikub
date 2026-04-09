# 🎲 Rummikub

A fully playable Rummikub game built with React + Vite. Supports 1–4 players with an AI opponent option.

## Features

- 🤖 **AI opponent** with strategic play (groups, runs, initial meld detection)
- 👥 **2–4 player local multiplayer**
- ✅ **Full rule enforcement** — valid sets, initial meld ≥ 30 pts, jokers
- 🎨 **Dark, polished UI** with tile animations
- 📱 **Responsive** layout

## Rules Summary

- **Runs**: 3+ tiles of the same color in consecutive order
- **Groups**: 3–4 tiles of the same number in different colors
- **Initial meld**: Your first play must total ≥ 30 points
- **Jokers**: Wild tiles worth 30 points
- **Win**: First player to empty their hand wins

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Deploy to Vercel

### Option A — Vercel CLI
```bash
npm install -g vercel
vercel
```

### Option B — GitHub + Vercel Dashboard
1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project
3. Import your GitHub repo
4. Framework: **Vite** (auto-detected)
5. Click **Deploy** — done!

No environment variables needed.

## Project Structure

```
src/
├── game/
│   ├── logic.js          # Tile factory, set validation, AI logic
│   └── useGameState.js   # All game state via React hooks
├── components/
│   ├── Tile.jsx           # Individual tile rendering
│   ├── Board.jsx          # Table / played sets
│   ├── PlayerHand.jsx     # Player's rack of tiles
│   ├── MenuScreen.jsx     # Game mode & name setup
│   ├── GameScreen.jsx     # Main game UI
│   └── GameOverScreen.jsx # Winner + scores
└── App.jsx               # Router / screen manager
```

## Tech Stack

- **React 18** + **Vite 5**
- Zero external UI libraries — pure CSS-in-JS
- Google Fonts (Playfair Display + DM Mono)
