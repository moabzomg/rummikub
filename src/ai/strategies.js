import { sortHand, isValidSet, isValidBoard, handValue, tileValue, findInitialMeld, findValidSetsFromHand, COLORS } from '../game/tiles.js'

export const AI_STRATEGIES = {
  aggressive: {
    name: 'Aggressive',
    fullName: 'Aggressive Attacker',
    emoji: '⚔️',
    color: '#e74c3c',
    description: 'Places as many tiles as possible each turn. Maximises tile count played.',
  },
  defensive: {
    name: 'Defensive',
    fullName: 'Defensive Holder',
    emoji: '🛡️',
    color: '#27ae60',
    description: 'Conserves high-value tiles, draws when unsure, avoids risk.',
  },
  balanced: {
    name: 'Balanced',
    fullName: 'Balanced Strategist',
    emoji: '⚖️',
    color: '#2980b9',
    description: 'Mix of offence and defence. Adapts based on hand size.',
  },
  speed: {
    name: 'Speed Run',
    fullName: 'Speed Runner',
    emoji: '⚡',
    color: '#f39c12',
    description: 'Prioritises emptying hand ASAP. Goes for low-value sets first.',
  },
}

// Main AI play function — returns { newBoard, newHand } or null (draw)
export function aiPlay(state, playerIdx) {
  const player = state.players[playerIdx]
  const strategy = player.strategy || 'balanced'
  const hand = state.hands[playerIdx]
  const board = state.board
  const hasMeld = state.hasInitialMeld[playerIdx]

  if (!hasMeld) {
    return aiInitialMeld(hand, board, strategy)
  }

  return aiRegularPlay(hand, board, strategy)
}

function aiInitialMeld(hand, board, strategy) {
  const meld = findInitialMeld(hand)
  if (!meld) return null // draw

  const usedIds = new Set(meld.flat().map(t => t.id))
  const newHand = sortHand(hand.filter(t => !usedIds.has(t.id)))
  const newBoard = [...board, ...meld]
  return { newBoard, newHand }
}

function aiRegularPlay(hand, board, strategy) {
  switch (strategy) {
    case 'aggressive': return aggressivePlay(hand, board)
    case 'defensive':  return defensivePlay(hand, board)
    case 'speed':      return speedPlay(hand, board)
    default:           return balancedPlay(hand, board)
  }
}

// ─── Aggressive: Place as many tiles as possible ──────────────────────────────
function aggressivePlay(hand, board) {
  // Try extending existing board sets with hand tiles
  let bestResult = null
  let bestPlaced = 0

  const attempts = generateBoardMoves(hand, board, 50)
  for (const { newBoard, newHand } of attempts) {
    const placed = hand.length - newHand.length
    if (placed > bestPlaced) {
      bestPlaced = placed
      bestResult = { newBoard, newHand }
    }
  }

  // Also try placing new sets from hand alone
  const newSets = findValidSetsFromHand(hand)
  for (const set of newSets) {
    const ids = new Set(set.map(t => t.id))
    const newHand = sortHand(hand.filter(t => !ids.has(t.id)))
    const newBoard = [...board, set]
    const placed = set.length
    if (placed > bestPlaced) {
      bestPlaced = placed
      bestResult = { newBoard, newHand }
    }
  }

  return bestResult && bestPlaced > 0 ? bestResult : null
}

// ─── Defensive: Only play when clearly beneficial ────────────────────────────
function defensivePlay(hand, board) {
  // Only play high-value sets, prefer keeping jokers
  const newSets = findValidSetsFromHand(hand.filter(t => !t.isJoker))
  const highValueSets = newSets.filter(s => handValue(s) >= 20)

  if (highValueSets.length === 0) return null

  // Play the highest value set
  const best = highValueSets.sort((a, b) => handValue(b) - handValue(a))[0]
  const ids = new Set(best.map(t => t.id))
  const newHand = sortHand(hand.filter(t => !ids.has(t.id)))
  const newBoard = [...board, best]
  return { newBoard, newHand }
}

// ─── Speed: Empty hand ASAP, prefer low-count sets ──────────────────────────
function speedPlay(hand, board) {
  // Try to play as many sets as possible
  let result = aggressivePlay(hand, board)
  if (result) return result

  // Fallback: play any valid set
  const sets = findValidSetsFromHand(hand)
  if (sets.length === 0) return null
  // Pick smallest set (fastest to empty)
  const smallest = sets.sort((a, b) => a.length - b.length)[0]
  const ids = new Set(smallest.map(t => t.id))
  const newHand = sortHand(hand.filter(t => !ids.has(t.id)))
  return { newBoard: [...board, smallest], newHand }
}

// ─── Balanced: Adaptive based on hand size ───────────────────────────────────
function balancedPlay(hand, board) {
  if (hand.length > 10) {
    // Aggressive when many tiles
    return aggressivePlay(hand, board)
  } else if (hand.length <= 5) {
    // Speed run to finish
    return speedPlay(hand, board)
  } else {
    // Moderate: play if we can place 2+ tiles
    const sets = findValidSetsFromHand(hand)
    const goodSets = sets.filter(s => s.length >= 3)
    if (goodSets.length === 0) return null
    const best = goodSets.sort((a, b) => b.length - a.length)[0]
    const ids = new Set(best.map(t => t.id))
    const newHand = sortHand(hand.filter(t => !ids.has(t.id)))
    return { newBoard: [...board, best], newHand }
  }
}

// ─── Board manipulation: extend existing sets ────────────────────────────────
function generateBoardMoves(hand, board, maxAttempts) {
  const results = []
  if (board.length === 0) return results

  // Try adding each hand tile to each board set
  for (const tile of hand) {
    for (let si = 0; si < board.length; si++) {
      const set = board[si]
      // Try appending
      const extended = [...set, tile]
      if (isValidSet(extended)) {
        const newBoard = board.map((s, i) => i === si ? extended : s)
        const newHand = sortHand(hand.filter(t => t.id !== tile.id))
        results.push({ newBoard, newHand })
        if (results.length >= maxAttempts) return results
      }
      // Try prepending
      const prepended = [tile, ...set]
      if (isValidSet(prepended)) {
        const newBoard = board.map((s, i) => i === si ? prepended : s)
        const newHand = sortHand(hand.filter(t => t.id !== tile.id))
        results.push({ newBoard, newHand })
        if (results.length >= maxAttempts) return results
      }
    }
  }
  return results
}
