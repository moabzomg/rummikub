// ─── Rummikub Tile Engine ────────────────────────────────────────────────────
// Standard Rummikub: 106 tiles = 2 sets of 1-13 in 4 colours + 2 jokers

export const COLORS = ['red', 'blue', 'yellow', 'black']
export const COLOR_HEX = { red: '#e74c3c', blue: '#2980b9', yellow: '#f39c12', black: '#2c2c2c' }
export const COLOR_LIGHT = { red: '#ff6b6b', blue: '#5dade2', yellow: '#f7dc6f', black: '#7f8c8d' }

let _nextId = 0

export function buildPool() {
  const tiles = []
  for (let set = 0; set < 2; set++) {
    for (const color of COLORS) {
      for (let num = 1; num <= 13; num++) {
        tiles.push({ id: _nextId++, num, color, isJoker: false })
      }
    }
    // 1 joker per set
    tiles.push({ id: _nextId++, num: null, color: null, isJoker: true })
  }
  return shuffle(tiles)
}

export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Set Validation ──────────────────────────────────────────────────────────

// A valid group: 3-4 tiles, same number, different colors, no duplicate colors
export function isGroup(tiles) {
  if (tiles.length < 3 || tiles.length > 4) return false
  const nonJokers = tiles.filter(t => !t.isJoker)
  const jokers = tiles.filter(t => t.isJoker)
  if (nonJokers.length === 0) return false
  const num = nonJokers[0].num
  if (!nonJokers.every(t => t.num === num)) return false
  const colors = nonJokers.map(t => t.color)
  const uniqueColors = new Set(colors)
  if (uniqueColors.size !== nonJokers.length) return false // duplicate colors
  return true
}

// A valid run: 3+ tiles, same color, consecutive numbers
export function isRun(tiles) {
  if (tiles.length < 3) return false
  const nonJokers = tiles.filter(t => !t.isJoker)
  const jokers = tiles.filter(t => t.isJoker)
  if (nonJokers.length === 0) return false
  const color = nonJokers[0].color
  if (!nonJokers.every(t => t.color === color)) return false

  // Place jokers and check consecutive sequence
  const nums = tiles.map(t => t.isJoker ? null : t.num)
  return canFormConsecutive(nums)
}

function canFormConsecutive(nums) {
  // Try all possible joker placements
  const jokerCount = nums.filter(n => n === null).length
  const realNums = nums.filter(n => n !== null).sort((a, b) => a - b)

  if (realNums.length === 0) return false

  const min = realNums[0]
  const max = realNums[realNums.length - 1]
  const span = max - min + 1

  if (span > 13) return false // can't exceed 13
  if (span > realNums.length + jokerCount) return false // not enough jokers
  if (nums.length < 3) return false

  // Check no duplicates in real nums
  if (new Set(realNums).size !== realNums.length) return false

  return true
}

export function isValidSet(tiles) {
  return isGroup(tiles) || isRun(tiles)
}

export function isValidBoard(sets) {
  return sets.every(s => isValidSet(s))
}

// Sum of tile values for scoring
export function tileValue(tile) {
  if (tile.isJoker) return 30
  return tile.num
}

export function handValue(tiles) {
  return tiles.reduce((s, t) => s + tileValue(t), 0)
}

// Sort hand: by color then number
export function sortHand(hand) {
  return [...hand].sort((a, b) => {
    if (a.isJoker) return 1
    if (b.isJoker) return -1
    const ci = COLORS.indexOf(a.color) - COLORS.indexOf(b.color)
    if (ci !== 0) return ci
    return a.num - b.num
  })
}

// ─── Move Finding ─────────────────────────────────────────────────────────────

// Find all valid sets of 3+ tiles from a hand
export function findValidSetsFromHand(hand) {
  const results = []
  findSetsRecursive(hand, [], results, 3)
  return results
}

function findSetsRecursive(remaining, current, results, minLen) {
  if (current.length >= minLen && isValidSet(current)) {
    results.push([...current])
  }
  if (current.length >= 13) return // max run length

  for (let i = 0; i < remaining.length; i++) {
    const next = remaining[i]
    const newCurrent = [...current, next]
    // Early pruning
    if (newCurrent.length >= 2) {
      const nonJ = newCurrent.filter(t => !t.isJoker)
      if (nonJ.length >= 2) {
        const sameNum = nonJ.every(t => t.num === nonJ[0].num)
        const sameColor = nonJ.every(t => t.color === nonJ[0].color)
        if (!sameNum && !sameColor) continue // Can't be either group or run
      }
    }
    findSetsRecursive(remaining.slice(i + 1), newCurrent, results, minLen)
  }
}

// Find best initial meld (must sum to ≥30)
export function findInitialMeld(hand) {
  const sets = findValidSetsFromHand(hand)
  // Try combinations of sets that sum to ≥30 and use distinct tiles
  const valid30 = sets.filter(s => handValue(s) >= 30)
  if (valid30.length > 0) {
    // Return best single set ≥30
    return [valid30.sort((a, b) => handValue(b) - handValue(a))[0]]
  }

  // Try combinations of 2 sets
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      const combined = [...sets[i], ...sets[j]]
      const ids = new Set(combined.map(t => t.id))
      if (ids.size === combined.length) { // no overlap
        const val = handValue(combined)
        if (val >= 30) return [sets[i], sets[j]]
      }
    }
  }
  return null
}
