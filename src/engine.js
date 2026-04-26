// ═══════════════════════════════════════════════
// RUMMIKUB ENGINE
// ═══════════════════════════════════════════════

export const COLORS = ['red','blue','orange','black']
export const COLOR_ORDER = { red:0, blue:1, orange:2, black:3 }

export function buildPool() {
  let id = 0
  const tiles = []
  for (let copy = 0; copy < 2; copy++)
    for (const color of COLORS)
      for (let n = 1; n <= 13; n++)
        tiles.push({ id: id++, color, num: n, isJoker: false })
  tiles.push({ id: id++, color: 'joker', num: 0, isJoker: true })
  tiles.push({ id: id++, color: 'joker', num: 0, isJoker: true })
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]]
  }
  return tiles
}

export const tileVal = t => t.isJoker ? 30 : t.num
export const handVal = h => h.reduce((s, t) => s + tileVal(t), 0)

// ── Validation ──────────────────────────────────
export function isRun(tiles) {
  if (tiles.length < 3) return false
  const norm = tiles.filter(t => !t.isJoker)
  if (!norm.length) return false
  const colors = [...new Set(norm.map(t => t.color))]
  if (colors.length !== 1) return false
  const nums = norm.map(t => t.num).sort((a, b) => a - b)
  const seen = new Set()
  for (const n of nums) { if (seen.has(n)) return false; seen.add(n) }
  const min = nums[0], max = nums[nums.length - 1]
  if (max - min + 1 > 13) return false
  const jokers = tiles.length - norm.length
  const gaps = (max - min + 1) - norm.length
  return jokers >= gaps
}

export function isGroup(tiles) {
  if (tiles.length < 3 || tiles.length > 4) return false
  const norm = tiles.filter(t => !t.isJoker)
  if (!norm.length) return false
  const nums = [...new Set(norm.map(t => t.num))]
  if (nums.length !== 1) return false
  const cols = norm.map(t => t.color)
  return new Set(cols).size === cols.length
}

export const isValid = tiles => tiles.length >= 3 && (isRun(tiles) || isGroup(tiles))
export const isValidBoard = sets => sets.every(s => isValid(s))

// ── Sort set ────────────────────────────────────
export function sortSet(tiles) {
  const norm = tiles.filter(t => !t.isJoker)
  const jokers = tiles.filter(t => t.isJoker)
  if (!norm.length) return tiles
  const cols = [...new Set(norm.map(t => t.color))]
  if (cols.length === 1) {
    const sorted = [...norm].sort((a, b) => a.num - b.num)
    const out = []
    let ji = 0
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0) {
        const gap = sorted[i].num - sorted[i - 1].num - 1
        for (let g = 0; g < gap && ji < jokers.length; g++, ji++) out.push(jokers[ji])
      }
      out.push(sorted[i])
    }
    while (ji < jokers.length) out.push(jokers[ji++])
    return out
  }
  return [...norm].sort((a, b) => (COLOR_ORDER[a.color] || 0) - (COLOR_ORDER[b.color] || 0)).concat(jokers)
}

// ── Sort hand ───────────────────────────────────
export function sortHand(hand, mode) {
  const sorted = [...hand].sort((a, b) => {
    if (a.isJoker && b.isJoker) return 0
    if (a.isJoker) return 1
    if (b.isJoker) return -1
    if (mode === 'color') {
      const cd = (COLOR_ORDER[a.color] || 0) - (COLOR_ORDER[b.color] || 0)
      return cd !== 0 ? cd : a.num - b.num
    }
    return a.num !== b.num ? a.num - b.num : (COLOR_ORDER[a.color] || 0) - (COLOR_ORDER[b.color] || 0)
  })
  return sorted
}

// ── Joker inference ─────────────────────────────
export function inferJokerNum(set, jokerIdx) {
  const norm = set.filter(t => !t.isJoker).sort((a, b) => a.num - b.num)
  const jokerIdxs = set.map((t, i) => t.isJoker ? i : -1).filter(i => i >= 0)
  const cols = [...new Set(norm.map(t => t.color))]
  if (cols.length === 1) {
    // run — find gaps
    if (!norm.length) return null
    const min = norm[0].num
    const fullRange = Array.from({ length: set.length }, (_, i) => min + i)
    const usedNums = new Set(norm.map(t => t.num))
    const gaps = fullRange.filter(n => !usedNums.has(n))
    const ji = jokerIdxs.indexOf(jokerIdx)
    return gaps[ji] !== undefined ? gaps[ji] : null
  }
  // group
  return norm.length ? norm[0].num : null
}

export function inferJokerColor(set, jokerIdx) {
  const norm = set.filter(t => !t.isJoker)
  const cols = [...new Set(norm.map(t => t.color))]
  if (cols.length === 1) return cols[0] // run
  return null // group — any missing color
}

// ── Joker liberation ────────────────────────────
export function findJokerReplacements(hand, board) {
  const results = []
  for (let si = 0; si < board.length; si++) {
    const set = board[si]
    const jokerIdxs = set.map((t, i) => t.isJoker ? i : -1).filter(i => i >= 0)
    for (const ji of jokerIdxs) {
      const jNum = inferJokerNum(set, ji)
      const jCol = inferJokerColor(set, ji)
      if (jNum === null) continue
      for (const ht of hand) {
        if (ht.isJoker) continue
        if (ht.num !== jNum) continue
        // for run: color must match; for group: color must not already be in set
        const norm = set.filter(t => !t.isJoker)
        const usedCols = new Set(norm.map(t => t.color))
        const irun = isRun(set.filter(t => !t.isJoker).concat([{ num: 0, color: norm[0]?.color || 'red', isJoker: false }]))
        const runSet = norm.length > 0 && new Set(norm.map(t => t.color)).size === 1
        if (runSet && ht.color !== norm[0].color) continue
        if (!runSet && usedCols.has(ht.color)) continue
        const newSet = [...set]; newSet[ji] = ht
        if (isValid(newSet)) {
          results.push({ si, ji, handTile: ht, joker: set[ji] })
        }
      }
    }
  }
  return results
}

// ── Set splitting ────────────────────────────────
// Find where inserting `tile` into `set` allows splitting into 2 valid sets
export function findSplitInserts(tile, set, si) {
  const results = []
  if (!isRun(set) || tile.isJoker) return results
  const norm = set.filter(t => !t.isJoker)
  const runColor = [...new Set(norm.map(t => t.color))]
  if (runColor.length !== 1 || tile.color !== runColor[0]) return results

  // Insert tile at each position, then try all splits
  for (let ins = 0; ins <= set.length; ins++) {
    const trial = [...set.slice(0, ins), tile, ...set.slice(ins)]
    for (let sp = 1; sp < trial.length; sp++) {
      const left = trial.slice(0, sp)
      const right = trial.slice(sp)
      // tile must appear in both halves OR the tile bridges (appears in both)
      const tileInLeft = left.some(t => t.id === tile.id)
      const tileInRight = right.some(t => t.id === tile.id)
      if (!tileInLeft || !tileInRight) continue
      if (left.length >= 3 && right.length >= 3 && isValid(left) && isValid(right)) {
        results.push({ si, insertPos: ins, splitPos: sp, left: sortSet(left), right: sortSet(right), tile })
      }
    }
  }
  return results
}

// ── Board extensions ─────────────────────────────
export function findExtensions(hand, board) {
  const results = []
  for (let si = 0; si < board.length; si++) {
    const set = board[si]
    for (const t of hand) {
      if (isValid([t, ...set])) results.push({ si, pos: 'start', tile: t, val: tileVal(t) })
      if (isValid([...set, t])) results.push({ si, pos: 'end', tile: t, val: tileVal(t) })
    }
  }
  return results
}

// ── Find all valid sets from tiles ──────────────
export function findAllSets(tiles) {
  const result = []
  const n = tiles.length
  function bt(start, cur) {
    if (cur.length >= 3 && isValid(cur)) result.push([...cur])
    if (cur.length >= 13) return
    if (isGroup(cur) && cur.length >= 4) return
    for (let i = start; i < n; i++) bt(i + 1, [...cur, tiles[i]])
  }
  bt(0, [])
  const seen = new Set()
  return result.filter(s => {
    const k = s.map(t => t.id).sort().join(',')
    if (seen.has(k)) return false; seen.add(k); return true
  })
}

// ── Best combination (max tiles, then value) ─────
export function bestCombination(tiles) {
  const allSets = findAllSets(tiles)
  if (!allSets.length) return { sets: [], count: 0, value: 0 }
  let bestSets = [], bestCount = 0, bestValue = 0
  function bt(idx, chosen, usedIds) {
    const c = usedIds.size
    const v = chosen.flat().reduce((s, t) => s + tileVal(t), 0)
    if (c > bestCount || (c === bestCount && v > bestValue)) {
      bestCount = c; bestValue = v; bestSets = chosen.map(s => [...s])
    }
    for (let i = idx; i < allSets.length; i++) {
      const set = allSets[i]
      if (set.some(t => usedIds.has(t.id))) continue
      const nu = new Set([...usedIds, ...set.map(t => t.id)])
      bt(i + 1, [...chosen, set], nu)
    }
  }
  bt(0, [], new Set())
  return { sets: bestSets, count: bestCount, value: bestValue }
}

// ── Linkable tiles: which hand+board tiles connect to a given tile ──
// Returns Set of tile ids that are "linkable" to the selection
export function findLinkableTiles(selectedIds, allTiles) {
  if (!selectedIds.size) return new Set()
  const selected = allTiles.filter(t => selectedIds.has(t.id))
  const candidates = allTiles.filter(t => !selectedIds.has(t.id))
  const linked = new Set()

  for (const cand of candidates) {
    // Try adding candidate to selected group — does it form or extend a valid set?
    const group = [...selected, cand]
    if (isValid(group)) { linked.add(cand.id); continue }
    // Try as pair that could grow into a set
    for (const sel of selected) {
      if (isValid([sel, cand, ...selected.filter(x => x.id !== sel.id)])) {
        linked.add(cand.id); break
      }
    }
    // Same number different color (group potential)
    if (!cand.isJoker && selected.some(s => !s.isJoker && s.num === cand.num && s.color !== cand.color)) {
      linked.add(cand.id)
    }
    // Same color adjacent number (run potential)
    if (!cand.isJoker && selected.some(s =>
      !s.isJoker && s.color === cand.color && Math.abs(s.num - cand.num) <= 2
    )) {
      linked.add(cand.id)
    }
    // Joker links to everything
    if (cand.isJoker) linked.add(cand.id)
    if (!cand.isJoker && selected.some(s => s.isJoker)) linked.add(cand.id)
  }
  return linked
}

// ── Compute hints ────────────────────────────────
export function computeHints(hand, board, hasMeld) {
  const hints = []

  // 1. Best pure hand combo
  const combo = bestCombination(hand)
  if (combo.count > 0) {
    const canMeld = !hasMeld && combo.value >= 30
    const applicable = hasMeld || canMeld
    hints.push({
      type: applicable ? (hasMeld ? 'play' : 'initial') : 'no-meld',
      label: hasMeld ? 'BEST' : (canMeld ? 'MELD' : 'NO MELD'),
      desc: `Play ${combo.count} tiles from hand (${combo.value} pts)${!hasMeld && !canMeld ? ` — need ${30 - combo.value} more` : ''}`,
      sets: combo.sets, exts: [], splits: [], jrep: null,
      value: combo.value, count: combo.count, applicable
    })
  }

  if (hasMeld) {
    // 2. Board extensions
    const exts = findExtensions(hand, board)
    const byTile = {}
    for (const e of exts) {
      if (!byTile[e.tile.id]) byTile[e.tile.id] = []
      byTile[e.tile.id].push(e)
    }
    for (const [, es] of Object.entries(byTile)) {
      const t = es[0].tile
      hints.push({
        type: 'extend', label: 'EXTEND',
        desc: `${t.isJoker ? '★' : t.num} (${t.color}) → extend ${es.length} board set(s)`,
        sets: [], exts: es, splits: [], jrep: null,
        value: tileVal(t), count: 1, applicable: true, tile: t
      })
    }

    // 3. Joker liberation
    const jreps = findJokerReplacements(hand, board)
    for (const rep of jreps) {
      hints.push({
        type: 'joker-lib', label: 'FREE ★',
        desc: `Replace ★ in set ${rep.si + 1} with ${rep.handTile.num} (${rep.handTile.color}) — free the joker!`,
        sets: [], exts: [], splits: [], jrep: rep,
        value: tileVal(rep.handTile) + 30, count: 1, applicable: true
      })
    }

    // 4. Splits
    for (let si = 0; si < board.length; si++) {
      for (const ht of hand) {
        const splits = findSplitInserts(ht, board[si], si)
        for (const sp of splits) {
          hints.push({
            type: 'split', label: 'SPLIT',
            desc: `Insert ${ht.num} (${ht.color}) → split set ${si + 1} into 2 runs`,
            sets: [], exts: [], splits: [sp], jrep: null,
            value: tileVal(ht), count: 1, applicable: true, tile: ht
          })
        }
      }
    }
  }

  if (!hints.some(h => h.applicable)) {
    hints.push({
      type: 'draw', label: 'DRAW',
      desc: 'No playable moves — draw a tile',
      sets: [], exts: [], splits: [], jrep: null,
      value: 0, count: 0, applicable: false
    })
  }

  // Sort: most tiles first → value → type priority
  const pri = { initial: 0, play: 0, extend: 1, 'joker-lib': 2, split: 3, 'no-meld': 4, draw: 5 }
  return hints.sort((a, b) =>
    b.count - a.count || b.value - a.value || (pri[a.type] || 9) - (pri[b.type] || 9)
  )
}

// ── AI play ──────────────────────────────────────
export function aiPlayTurn(hand, board, hasMeld) {
  let h = [...hand]
  let b = board.map(s => [...s])
  const log = []

  // Step 1: liberate jokers
  let improved = true
  while (improved) {
    improved = false
    const reps = findJokerReplacements(h, b)
    if (reps.length) {
      const rep = reps[0]
      b[rep.si][rep.ji] = rep.handTile
      h = h.filter(t => t.id !== rep.handTile.id)
      h.push(rep.joker)
      improved = true
      log.push(`Freed joker: replaced with ${rep.handTile.num}(${rep.handTile.color})`)
    }
  }

  // Step 2: extend board
  improved = true
  while (improved) {
    improved = false
    const exts = findExtensions(h, b)
    if (exts.length) {
      const ext = exts[0]
      h = h.filter(t => t.id !== ext.tile.id)
      if (ext.pos === 'start') b[ext.si] = sortSet([ext.tile, ...b[ext.si]])
      else b[ext.si] = sortSet([...b[ext.si], ext.tile])
      improved = true
      log.push(`Extended set ${ext.si} with ${ext.tile.num}(${ext.tile.color})`)
    }
  }

  // Step 3: play new sets
  const combo = bestCombination(h)
  const meldAchieved = !hasMeld && combo.value >= 30
  if (combo.count > 0 && (hasMeld || meldAchieved)) {
    const usedIds = new Set(combo.sets.flat().map(t => t.id))
    h = h.filter(t => !usedIds.has(t.id))
    for (const set of combo.sets) b.push(sortSet(set))
    log.push(`Played ${combo.count} tiles (${combo.value}pts)${meldAchieved ? ' MELD!' : ''}`)
    return { newHand: h, newBoard: b, moved: true, meldAchieved, log }
  }

  const moved = hand.length !== h.length
  return { newHand: h, newBoard: b, moved, meldAchieved: false, log }
}

// ── Debug: verify tile count ──────────────────────
export function verifyTileCount(hands, board, pool) {
  const inHands = hands.reduce((s, h) => s + h.length, 0)
  const onBoard = board.flat().length
  const inPool = pool.length
  const total = inHands + onBoard + inPool
  const expected = 106
  return { inHands, onBoard, inPool, total, ok: total === expected, expected }
}
