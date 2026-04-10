// ─── Rummikub Tile Engine ─────────────────────────────────────────────────────
export const COLORS = ['red', 'blue', 'yellow', 'black']
export const COLOR_HEX  = { red:'#d63031', blue:'#0984e3', yellow:'#e17055', black:'#2d3436' }
export const COLOR_NAME = { red:'Red', blue:'Blue', yellow:'Orange', black:'Black' }
export const COLOR_LIGHT = { red:'#ff7675', blue:'#74b9ff', yellow:'#fab1a0', black:'#636e72' }

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
  const a=[...arr]
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a
}

// ─── Validation ───────────────────────────────────────────────────────────────
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

// ─── Auto-sort a set into proper sequence ────────────────────────────────────
// Groups: sorted by color order; Runs: sorted numerically with jokers filled in
export function sortSet(tiles) {
  if (!tiles || tiles.length === 0) return tiles
  const nj = tiles.filter(t => !t.isJoker)
  const jokers = tiles.filter(t => t.isJoker)
  if (!nj.length) return tiles

  // Detect group vs run
  const allSameNum = nj.every(t => t.num === nj[0].num)
  if (allSameNum) {
    // Group: sort by COLORS order
    return [...nj.sort((a,b) => COLORS.indexOf(a.color) - COLORS.indexOf(b.color)), ...jokers]
  }
  // Run: sort numerically, place jokers in gaps
  const nums = nj.sort((a,b) => a.num - b.num)
  const result = []
  let ji = 0
  for (let i = 0; i < nums.length; i++) {
    if (i > 0) {
      // Fill gaps with jokers
      const gap = nums[i].num - nums[i-1].num - 1
      for (let g = 0; g < gap && ji < jokers.length; g++, ji++) {
        result.push(jokers[ji])
      }
    }
    result.push(nums[i])
  }
  // Append remaining jokers at end (beginning or end of run)
  while (ji < jokers.length) { result.push(jokers[ji++]) }
  return result
}

// ─── Sorting hand ─────────────────────────────────────────────────────────────
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

// ─── Set finding ──────────────────────────────────────────────────────────────
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
    if (ids.size === sets[i].length+sets[j].length && handValue([...sets[i],...sets[j]])>=30)
      return [sets[i],sets[j]]
  }
  return null
}

export function suggestPlayableSets(hand) {
  const all = findValidSetsFromHand(hand)
  const seen = new Set()
  const unique = []
  for (const s of all) {
    const key = s.map(t=>t.id).sort().join(',')
    if (!seen.has(key)) { seen.add(key); unique.push(s) }
  }
  return unique.sort((a,b) => a.length - b.length)
}

// ─── Drop analysis: where can a tile go on the board? ────────────────────────
export function findDropTargets(tile, board) {
  // Returns array of { setIdx, position:'start'|'end'|'new', score, label }
  const targets = []
  for (let si = 0; si < board.length; si++) {
    const set = board[si]
    // Try appending
    const withEnd = sortSet([...set, tile])
    if (isValidSet(withEnd)) {
      targets.push({ setIdx: si, position: 'end', score: tileValue(tile), label: `Add to end of set ${si+1}` })
    }
    // Try prepending
    const withStart = sortSet([tile, ...set])
    if (isValidSet(withStart)) {
      targets.push({ setIdx: si, position: 'start', score: tileValue(tile), label: `Add to start of set ${si+1}` })
    }
  }
  // Can also start a new set (just note it)
  return targets
}

// ─── One-click insert: find the best place to insert a tile ──────────────────
export function findBestInsert(tile, board, hand) {
  // First try board extensions
  const targets = findDropTargets(tile, board)
  if (targets.length > 0) {
    return { type: 'extend', target: targets[0], targets }
  }
  // Then check if it can form a new set with hand tiles
  const mates = hand.filter(h => h.id !== tile.id)
  const sets = findValidSetsFromHand([tile, ...mates])
  const withTile = sets.filter(s => s.some(t => t.id === tile.id))
  if (withTile.length > 0) {
    return { type: 'new-set', sets: withTile.slice(0, 3) }
  }
  return { type: 'none' }
}
