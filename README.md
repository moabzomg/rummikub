# Rummikub — React App

A full-featured Rummikub tile game built with React.

## Features

- 🎮 1–4 players (human or AI)
- 🎨 Sort hand by colour or number
- ↔️ Playable tiles shown left, separated from others
- 💡 Smart hint system — shows all possible moves, best strategy first (click to apply)
- 🤖 AI plays fast and visibly; you can see the board while AI moves
- 🃏 Joker wildcard — place anywhere, AI knows how to free jokers and use them
- ✂️ Set splitting — insert a tile to split a long run into two valid sets
- 🖱️ Drag & drop with animated ghost tile
- 📦 Double-click tile to auto-place; double-click board tile to return to hand
- 🟡 Long-press to lasso-select tiles left-to-right
- 🔴 Last-turn highlight when pool empties
- 🐛 Debug mode — reveals all tiles in AI hands
- ↩️ Board tiles placed this turn can be returned to hand

## Getting Started

```bash
npm install
npm start
```

## Deploy to Vercel

1. Push to GitHub
2. Connect repo in [vercel.com](https://vercel.com)
3. Vercel auto-detects Create React App and deploys

Or use Vercel CLI:
```bash
npm i -g vercel
vercel
```

## Project Structure

```
src/
  components/
    Game.jsx       — main game orchestrator
    Board.jsx      — board rendering + drag/drop
    HandRack.jsx   — player hand + suggestions
    HintPanel.jsx  — hint/move panel
    Setup.jsx      — player setup screen
    Tile.jsx       — individual tile component
  utils/
    gameEngine.js  — all game logic (validation, AI, hints)
  styles/
    main.css       — all styles
  App.jsx
  index.js
```
