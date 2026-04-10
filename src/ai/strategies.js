import { sortHand, isValidSet, handValue, findInitialMeld, findValidSetsFromHand, tileValue, COLORS } from '../game/tiles.js'

export const AI_STRATEGIES = {
  aggressive: {
    name: 'Aggressive', fullName: 'Aggressive Attacker', emoji: '⚔️', color: '#d63031',
    description: 'Places as many tiles as possible each turn.',
    play: aggressivePlay,
  },
  defensive: {
    name: 'Defensive', fullName: 'Defensive Holder', emoji: '🛡️', color: '#00b894',
    description: 'Only plays high-value sets. Holds jokers.',
    play: defensivePlay,
  },
  balanced: {
    name: 'Balanced', fullName: 'Balanced Strategist', emoji: '⚖️', color: '#0984e3',
    description: 'Adapts strategy based on hand size and game stage.',
    play: balancedPlay,
  },
  speed: {
    name: 'Speed Run', fullName: 'Speed Runner', emoji: '⚡', color: '#e17055',
    description: 'Empties hand ASAP. Plays smallest valid sets first.',
    play: speedPlay,
  },
}

// Full AI turn: returns { newBoard, newHand } or null (draw)
export function aiPlay(state, playerIdx) {
  const hand = state.hands[playerIdx]
  const board = state.board
  const hasMeld = state.hasInitialMeld[playerIdx]
  const strat = state.players[playerIdx].strategy || 'balanced'

  if (!hasMeld) {
    const meld = findInitialMeld(hand)
    if (!meld) return null
    const used = new Set(meld.flat().map(t => t.id))
    return { newBoard: [...board, ...meld], newHand: sortHand(hand.filter(t => !used.has(t.id))) }
  }
  return AI_STRATEGIES[strat]?.play(hand, board) ?? null
}

// ─── Synchronous full-game simulation (no delays) ─────────────────────────────
export function simulateGame(players) {
  const { initGame, drawTile, commitPlay } = require('./engine.js') // ESM workaround
  return null
}

function aggressivePlay(hand, board) {
  let best = null, bestPlaced = 0

  // 1. Try extending existing board sets
  for (const tile of hand) {
    for (let si = 0; si < board.length; si++) {
      for (const attempt of [[...board[si], tile], [tile, ...board[si]]]) {
        if (isValidSet(attempt)) {
          const nb = board.map((s, i) => i === si ? attempt : s)
          const nh = sortHand(hand.filter(t => t.id !== tile.id))
          if (1 > bestPlaced) { bestPlaced = 1; best = { newBoard: nb, newHand: nh } }
          // Chain: try placing more tiles from new hand
          const chain = aggressivePlay(nh, nb)
          if (chain) { const placed = hand.length - chain.newHand.length; if (placed > bestPlaced) { bestPlaced = placed; best = chain } }
        }
      }
    }
  }

  // 2. Try new sets from hand
  const sets = findValidSetsFromHand(hand)
  // Try combos of multiple sets
  const bestCombo = findBestSetCombo(hand, board, sets)
  if (bestCombo && bestCombo.placed > bestPlaced) { bestPlaced = bestCombo.placed; best = bestCombo.result }

  return best
}

function findBestSetCombo(hand, board, sets) {
  let best = null, bestPlaced = 0
  for (const s of sets) {
    const ids = new Set(s.map(t => t.id))
    const nh = sortHand(hand.filter(t => !ids.has(t.id)))
    const nb = [...board, s]
    const placed = s.length
    if (placed > bestPlaced) { bestPlaced = placed; best = { result: { newBoard: nb, newHand: nh }, placed } }
    // Try a second set from remaining
    const sets2 = findValidSetsFromHand(nh)
    for (const s2 of sets2) {
      const ids2 = new Set(s2.map(t => t.id))
      if ([...ids2].some(id => ids.has(id))) continue
      const nh2 = sortHand(nh.filter(t => !ids2.has(t.id)))
      const nb2 = [...nb, s2]
      const p2 = s.length + s2.length
      if (p2 > bestPlaced) { bestPlaced = p2; best = { result: { newBoard: nb2, newHand: nh2 }, placed: p2 } }
    }
  }
  return best
}

function defensivePlay(hand, board) {
  const safe = hand.filter(t => !t.isJoker)
  const sets = findValidSetsFromHand(safe).filter(s => handValue(s) >= 18)
  if (!sets.length) return null
  const best = sets.sort((a, b) => handValue(b) - handValue(a))[0]
  const ids = new Set(best.map(t => t.id))
  return { newBoard: [...board, best], newHand: sortHand(hand.filter(t => !ids.has(t.id))) }
}

function balancedPlay(hand, board) {
  if (hand.length > 10) return aggressivePlay(hand, board)
  if (hand.length <= 5) return speedPlay(hand, board)
  const sets = findValidSetsFromHand(hand)
  if (!sets.length) return null
  const best = sets.sort((a, b) => b.length - a.length)[0]
  const ids = new Set(best.map(t => t.id))
  return { newBoard: [...board, best], newHand: sortHand(hand.filter(t => !ids.has(t.id))) }
}

function speedPlay(hand, board) {
  const r = aggressivePlay(hand, board)
  if (r) return r
  const sets = findValidSetsFromHand(hand)
  if (!sets.length) return null
  const s = sets.sort((a, b) => a.length - b.length)[0]
  const ids = new Set(s.map(t => t.id))
  return { newBoard: [...board, s], newHand: sortHand(hand.filter(t => !ids.has(t.id))) }
}

// ─── Hint engine for human player ────────────────────────────────────────────
export function computeHints(hand, board, hasMeld) {
  const hints = []

  if (!hasMeld) {
    // Initial meld hints
    const meld = findInitialMeld(hand)
    if (meld) {
      const val = handValue(meld.flat())
      hints.push({ type: 'initial', priority: 10, title: `Initial meld available! (${val} pts)`,
        desc: `You can place your first meld of ${val} points. Click the sets below to play.`, sets: meld })
    } else {
      const sets = findValidSetsFromHand(hand)
      const best = sets.sort((a, b) => handValue(b) - handValue(a))
      const topVal = best.slice(0, 3).reduce((s, st) => s + handValue(st), 0)
      hints.push({ type: 'no-meld', priority: 8, title: `Can't meld yet — need ≥30 pts`,
        desc: `Your best sets total ${topVal} pts. Draw to build toward your initial meld.` })
    }
    return hints
  }

  // Regular play hints
  const sets = findValidSetsFromHand(hand)
  if (!sets.length && board.length === 0) {
    hints.push({ type: 'draw', priority: 9, title: 'No playable sets', desc: 'None of your tiles can form a valid set yet. Draw a tile.' })
    return hints
  }

  // Board extensions
  const extensions = findBoardExtensions(hand, board)
  if (extensions.length > 0) {
    hints.push({ type: 'extend', priority: 9, title: `Extend board sets (${extensions.length} options)`,
      desc: `You can add tiles to existing board sets: ${extensions.slice(0,3).map(e => `add ${e.tile.num}${e.tile.color[0].toUpperCase()} to set #${e.setIdx+1}`).join(', ')}.`,
      extensions })
  }

  // Best from-hand sets
  if (sets.length > 0) {
    const best3 = sets.sort((a, b) => handValue(b) - handValue(a)).slice(0, 4)
    hints.push({ type: 'play', priority: 8, title: `${sets.length} playable set${sets.length>1?'s':''} in your hand`,
      desc: `Best: ${best3.map(s => describeSet(s)).join(' · ')}`, sets: best3 })
  }

  // Tiles that CAN'T be played
  const playableTileIds = new Set(sets.flat().map(t => t.id))
  const extTileIds = new Set(extensions.map(e => e.tile.id))
  const unplayable = hand.filter(t => !playableTileIds.has(t.id) && !extTileIds.has(t.id))
  if (unplayable.length > 0 && hand.length > 4) {
    hints.push({ type: 'stuck', priority: 5, title: `${unplayable.length} tile${unplayable.length>1?'s':''} can't be placed yet`,
      desc: `${unplayable.map(t => t.isJoker ? 'Joker' : `${t.num}${t.color[0].toUpperCase()}`).slice(0,6).join(', ')} — wait for more tiles or rearrange the board.` })
  }

  // Smart rearrangement hint
  if (board.length > 0 && unplayable.length > 0) {
    const rearrangeHint = findRearrangement(hand, board)
    if (rearrangeHint) {
      hints.push({ type: 'rearrange', priority: 7, title: 'Smart board rearrangement possible!',
        desc: rearrangeHint, isSmartHint: true })
    }
  }

  // If nothing playable at all
  if (sets.length === 0 && extensions.length === 0) {
    hints.push({ type: 'draw', priority: 10, title: 'Nothing to play — draw a tile',
      desc: 'None of your tiles can be placed on the board in any configuration. Your best move is to draw.' })
  }

  return hints.sort((a, b) => b.priority - a.priority)
}

function findBoardExtensions(hand, board) {
  const exts = []
  for (const tile of hand) {
    for (let si = 0; si < board.length; si++) {
      const set = board[si]
      if (isValidSet([...set, tile]) || isValidSet([tile, ...set])) {
        exts.push({ tile, setIdx: si })
      }
    }
  }
  return exts
}

function findRearrangement(hand, board) {
  // Try splitting board sets and adding hand tiles
  for (const tile of hand) {
    for (let si = 0; si < board.length; si++) {
      const set = board[si]
      if (set.length > 3) {
        // Try splitting at each point
        for (let split = 3; split < set.length - 2; split++) {
          const part1 = set.slice(0, split)
          const part2 = set.slice(split)
          if (isValidSet([...part1, tile]) && isValidSet(part2)) {
            return `Split set #${si+1} and add ${tile.isJoker?'Joker':`${tile.num}${tile.color[0].toUpperCase()}`} to it`
          }
          if (isValidSet(part1) && isValidSet([tile, ...part2])) {
            return `Split set #${si+1} and prepend ${tile.isJoker?'Joker':`${tile.num}${tile.color[0].toUpperCase()}`}`
          }
        }
      }
    }
  }
  return null
}

function describeSet(set) {
  if (!set.length) return ''
  const nj = set.filter(t => !t.isJoker)
  if (!nj.length) return 'Joker set'
  const isGroup = nj.every(t => t.num === nj[0].num)
  if (isGroup) return `Group of ${nj[0].num}s (${handValue(set)} pts)`
  return `Run ${nj[0].color} ${nj.map(t=>t.num).sort((a,b)=>a-b).join('-')} (${handValue(set)} pts)`
}
