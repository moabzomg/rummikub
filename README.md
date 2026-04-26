# Rummikub

Full-featured Rummikub game built with React + Vite.

## Local dev

```bash
npm install
npm run dev
```

## Deploy to Vercel

```bash
# Push to GitHub first
git init
git add .
git commit -m "init"
gh repo create rummikub --public --source=. --push

# Then import at vercel.com/new
# Framework: Vite  |  Build: npm run build  |  Output: dist
```

Or with Vercel CLI:
```bash
npm i -g vercel
vercel
```
