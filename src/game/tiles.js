// ─── Rummikub Tile Engine ─────────────────────────────────────────────────────
export const COLORS = ['red', 'blue', 'yellow', 'black']
export const COLOR_HEX  = { red:'#d63031', blue:'#0984e3', yellow:'#e17055', black:'#2d3436' }
export const COLOR_NAME = { red:'Red', blue:'Blue', yellow:'Orange', black:'Black' }

let _id = 0
export function buildPool() {
  _id = 0
  const t = []
  for (let s = 0; s < 2; s++) {
    for (const c of COLORS) for (let n = 1; n <= 13; n++) t.push({ id:_id++, num:n, color:c, isJoker:false })
    t.push({ id:_id++, num:null, color:null, isJoker:true })
  }
  return shuffle(t)
}

export function shuffle(arr) {
  const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a
}

// ─── Validation ────────────────────────────────────────────────────────────────
export function isGroup(tiles) {
  if (tiles.length < 3 || tiles.length > 4) return false
  const nj = tiles.filter(t => !t.isJoker)
  if (!nj.length) return false
  const num = nj[0].num
  if (!nj.every(t => t.num === num)) return false
  const cols = nj.map(t => t.color)
  return new Set(cols).size === nj.length
}

export function isRun(tiles) {
  if (tiles.length < 3) return false
  const nj = tiles.filter(t => !t.isJoker)
  if (!nj.length) return false
  const col = nj[0].color
  if (!nj.every(t => t.color === col)) return false
  const jokers = tiles.filter(t => t.isJoker).length
  const nums = nj.map(t => t.num).sort((a,b)=>a-b)
  if (new Set(nums).size !== nums.length) return false
  const span = nums[nums.length-1] - nums[0] + 1
  if (span > 13) return false
  return span <= nums.length + jokers && tiles.length >= 3
}

export function isValidSet(tiles) { return !!(tiles && tiles.length >= 3 && (isGroup(tiles) || isRun(tiles))) }
export function isValidBoard(sets) { return sets.every(s => isValidSet(s)) }
export function tileValue(t) { return t.isJoker ? 30 : t.num }
export function handValue(tiles) { return tiles.reduce((s,t)=>s+tileValue(t),0) }

// ─── Sorting ───────────────────────────────────────────────────────────────────
export function sortByColor(hand) {
  return [...hand].sort((a,b) => {
    if (a.isJoker) return 1; if (b.isJoker) return -1
    const ci = COLORS.indexOf(a.color) - COLORS.indexOf(b.color)
    return ci !== 0 ? ci : a.num - b.num
  })
}
export function sortByNumber(hand) {
  return [...hand].sort((a,b) => {
    if (a.isJoker) return 1; if (b.isJoker) return -1
    return a.num !== b.num ? a.num - b.num : COLORS.indexOf(a.color) - COLORS.indexOf(b.color)
  })
}
export function sortHand(hand, mode='color') {
  return mode === 'number' ? sortByNumber(hand) : sortByColor(hand)
}

// ─── Set finding ───────────────────────────────────────────────────────────────
export function findValidSetsFromHand(hand) {
  const results = []
  function recurse(remaining, current) {
    if (current.length >= 3 && isValidSet(current)) results.push([...current])
    if (current.length >= 13) return
    for (let i = 0; i < remaining.length; i++) {
      const next = remaining[i]; const nc = [...current, next]
      const nj = nc.filter(t=>!t.isJoker)
      if (nj.length >= 2) {
        const sn = nj.every(t=>t.num===nj[0].num), sc = nj.every(t=>t.color===nj[0].color)
        if (!sn && !sc) continue
      }
      recurse(remaining.slice(i+1), nc)
    }
  }
  recurse(hand, [])
  return results
}

export function findInitialMeld(hand) {
  const sets = findValidSetsFromHand(hand)
  const v30 = sets.filter(s => handValue(s) >= 30)
  if (v30.length) return [v30.sort((a,b)=>handValue(b)-handValue(a))[0]]
  for (let i=0;i<sets.length;i++) for(let j=i+1;j<sets.length;j++) {
    const ids = new Set([...sets[i],...sets[j]].map(t=>t.id))
    if (ids.size === sets[i].length+sets[j].length && handValue([...sets[i],...sets[j]])>=30) return [sets[i],sets[j]]
  }
  return null
}

// ─── Suggest playable sets of exactly min 3 ──────────────────────────────────
export function suggestPlayableSets(hand) {
  const all = findValidSetsFromHand(hand)
  // Deduplicate by tile id sets
  const seen = new Set()
  const unique = []
  for (const s of all) {
    const key = s.map(t=>t.id).sort().join(',')
    if (!seen.has(key)) { seen.add(key); unique.push(s) }
  }
  // Group by size=3 first, then larger
  return unique.sort((a,b) => a.length - b.length)
}
