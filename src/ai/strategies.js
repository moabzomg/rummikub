import { sortHand, isValidSet, handValue, findInitialMeld, findValidSetsFromHand } from '../game/tiles.js'

export const AI_STRATEGIES = {
  aggressive: {
    name: 'Aggressive', fullName: 'Aggressive Attacker', emoji: '⚔️',
    color: '#d63031',
    description: 'Places as many tiles as possible each turn. Extends board runs and groups relentlessly.',
    play: aggressivePlay,
  },
  defensive: {
    name: 'Defensive', fullName: 'Defensive Holder', emoji: '🛡️',
    color: '#00b894',
    description: 'Only plays high-value sets. Holds jokers, avoids exposing weak tiles.',
    play: defensivePlay,
  },
  balanced: {
    name: 'Balanced', fullName: 'Balanced Strategist', emoji: '⚖️',
    color: '#0984e3',
    description: 'Adapts strategy based on hand size and game stage. Best all-rounder.',
    play: balancedPlay,
  },
  speed: {
    name: 'Speed Run', fullName: 'Speed Runner', emoji: '⚡',
    color: '#e17055',
    description: 'Prioritises emptying hand. Plays smallest valid sets first to reduce tile count fast.',
    play: speedPlay,
  },
}

export function aiPlay(state, playerIdx) {
  const hand = state.hands[playerIdx]
  const board = state.board
  const hasMeld = state.hasInitialMeld[playerIdx]
  const strat = state.players[playerIdx].strategy || 'balanced'

  if (!hasMeld) {
    const meld = findInitialMeld(hand)
    if (!meld) return null
    const used = new Set(meld.flat().map(t=>t.id))
    return { newBoard: [...board, ...meld], newHand: sortHand(hand.filter(t=>!used.has(t.id))) }
  }
  return AI_STRATEGIES[strat]?.play(hand, board) || null
}

function aggressivePlay(hand, board) {
  let best = null, bestPlaced = 0
  // Try extending board sets
  const ext = tryExtensions(hand, board)
  for (const r of ext) { const p = hand.length - r.newHand.length; if (p > bestPlaced) { bestPlaced=p; best=r } }
  // Try new sets from hand
  const sets = findValidSetsFromHand(hand)
  for (const s of sets) {
    const ids = new Set(s.map(t=>t.id))
    const nh = sortHand(hand.filter(t=>!ids.has(t.id)))
    if (s.length > bestPlaced) { bestPlaced=s.length; best={newBoard:[...board,s],newHand:nh} }
  }
  // Try playing multiple sets
  if (sets.length > 1) {
    const combo = tryMultipleSets(hand, board, sets)
    if (combo && hand.length-combo.newHand.length > bestPlaced) best = combo
  }
  return best
}

function defensivePlay(hand, board) {
  const safe = hand.filter(t => !t.isJoker)
  const sets = findValidSetsFromHand(safe).filter(s => handValue(s) >= 18)
  if (!sets.length) return null
  const best = sets.sort((a,b) => handValue(b)-handValue(a))[0]
  const ids = new Set(best.map(t=>t.id))
  return { newBoard:[...board,best], newHand:sortHand(hand.filter(t=>!ids.has(t.id))) }
}

function balancedPlay(hand, board) {
  if (hand.length > 10) return aggressivePlay(hand, board)
  if (hand.length <= 5) return speedPlay(hand, board)
  const sets = findValidSetsFromHand(hand).filter(s => s.length >= 3)
  if (!sets.length) return null
  const best = sets.sort((a,b) => b.length - a.length)[0]
  const ids = new Set(best.map(t=>t.id))
  return { newBoard:[...board,best], newHand:sortHand(hand.filter(t=>!ids.has(t.id))) }
}

function speedPlay(hand, board) {
  const r = aggressivePlay(hand, board); if (r) return r
  const sets = findValidSetsFromHand(hand)
  if (!sets.length) return null
  const s = sets.sort((a,b)=>a.length-b.length)[0]
  const ids = new Set(s.map(t=>t.id))
  return { newBoard:[...board,s], newHand:sortHand(hand.filter(t=>!ids.has(t.id))) }
}

function tryExtensions(hand, board) {
  const results = []
  for (const tile of hand) {
    for (let si=0;si<board.length;si++) {
      const set = board[si]
      for (const attempt of [[...set,tile],[tile,...set]]) {
        if (isValidSet(attempt)) {
          const nb = board.map((s,i)=>i===si?attempt:s)
          results.push({ newBoard:nb, newHand:sortHand(hand.filter(t=>t.id!==tile.id)) })
        }
      }
    }
  }
  return results
}

function tryMultipleSets(hand, board, sets) {
  // Try playing 2 non-overlapping sets
  for (let i=0;i<sets.length;i++) for(let j=i+1;j<sets.length;j++) {
    const ids = new Set([...sets[i],...sets[j]].map(t=>t.id))
    if (ids.size === sets[i].length+sets[j].length) {
      const nh = sortHand(hand.filter(t=>!ids.has(t.id)))
      return { newBoard:[...board,sets[i],sets[j]], newHand:nh }
    }
  }
  return null
}
