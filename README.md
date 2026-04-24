# Rummikub

A full-featured browser Rummikub game. No build step required — pure HTML/CSS/JS.

## Deploy to Vercel

```bash
# Option 1: Vercel CLI
npm i -g vercel
vercel

# Option 2: Drag & drop the folder at vercel.com/new
```

## Deploy to GitHub + Vercel

```bash
git init
git add .
git commit -m "Initial Rummikub v2"
gh repo create rummikub --public --push --source=.
# Then connect repo at vercel.com/new → Import Git Repository
```

## Features

- **Hand sorting**: Color or Number, playable sets left, separator line
- **Hint system**: One-click, exhaustive search, shows all moves sorted by tiles placed
  - Joker liberation (replace joker on board with hand tile to free it)
  - Set splitting (insert tile to split run into two valid runs)
  - Board extensions
  - Best combination of new sets
- **AI**: Smart — frees jokers, extends board, plays best combos
- **Animations**: AI tile drop animations visible to human player
- **Drag & drop**: With insert position indicator, drag to return tiles
- **Double-click board tile**: Returns to hand (if placed this turn)
- **Long press**: Lasso-select tiles left-to-right
- **Debug mode**: Click DEBUG in header — validates tile counts, logs AI moves
- **Last turn highlight**: Red pulse on tabs when pool is empty
- **Set splitting**: Click hint or drag to split runs with an inserted tile
