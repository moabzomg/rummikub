import { buildPool, sortHand, isValidSet, isValidBoard, handValue, findInitialMeld, tileValue } from './tiles.js'

export const INITIAL_HAND_SIZE = 14

export function initGame(players) {
  const pool = buildPool()
  const hands = players.map(() => [])
  for (let i = 0; i < INITIAL_HAND_SIZE; i++)
    for (let p = 0; p < players.length; p++)
      if (pool.length > 0) hands[p].push(pool.pop())
  return {
    pool,
    players,
    hands: hands.map(h => sortHand(h, 'color')),
    board: [],
    currentPlayer: 0,
    phase: 'play',       // play | final-round | finished
    finalRound: false,   // true when pool runs out — everyone gets one last turn
    finalStartPlayer: -1,// who triggered final round
    winner: null,
    hasInitialMeld: players.map(() => false),
    log: [`Game started! ${players[0].name}'s turn.`],
    scores: players.map(() => 0),
    sortMode: players.map(() => 'color'), // per-player sort preference
  }
}

export function setSortMode(state, playerIdx, mode) {
  const newModes = state.sortMode.map((m,i) => i===playerIdx ? mode : m)
  const newHand = sortHand(state.hands[playerIdx], mode)
  const newHands = state.hands.map((h,i) => i===playerIdx ? newHand : h)
  return { ...state, sortMode: newModes, hands: newHands }
}

// ─── Draw / pass ──────────────────────────────────────────────────────────────
export function drawTile(state, playerIdx) {
  const name = state.players[playerIdx].name
  if (state.pool.length === 0) {
    // Pool empty — trigger final round if not already
    if (!state.finalRound) {
      const log = [...state.log, `Pool is empty! Final round begins — each player gets one last turn.`]
      const next = (playerIdx + 1) % state.players.length
      return { ...state, finalRound: true, finalStartPlayer: next, currentPlayer: next, log }
    }
    return advanceTurn({ ...state, log: [...state.log, `${name} passed (pool empty).`] }, playerIdx)
  }
  const tile = state.pool[state.pool.length - 1]
  const newPool = state.pool.slice(0, -1)
  const mode = state.sortMode[playerIdx] || 'color'
  const newHand = sortHand([...state.hands[playerIdx], tile], mode)
  const newHands = state.hands.map((h,i) => i===playerIdx ? newHand : h)
  return advanceTurn({
    ...state,
    pool: newPool,
    hands: newHands,
    log: [...state.log, `${name} drew a tile (${newPool.length} left).`],
  }, playerIdx)
}

export function advanceTurn(state, fromPlayer) {
  const n = state.players.length
  const next = (state.currentPlayer + 1) % n

  // Check win: empty hand
  for (let i = 0; i < state.hands.length; i++) {
    if (state.hands[i].length === 0) {
      return endGame(state, i)
    }
  }

  // Final round logic: end when we've gone around back to finalStartPlayer
  if (state.finalRound) {
    if (next === state.finalStartPlayer) {
      // Everyone played — find winner by lowest hand value
      return endGame(state, null)
    }
  }

  return { ...state, currentPlayer: next }
}

function endGame(state, explicitWinner) {
  let winner = explicitWinner
  if (winner === null) {
    // Lowest hand value wins
    let minVal = Infinity
    state.hands.forEach((h, i) => { const v = handValue(h); if (v < minVal) { minVal = v; winner = i } })
  }
  const scores = calcScores(state, winner)
  return {
    ...state,
    phase: 'finished',
    winner,
    scores,
    log: [...state.log, `🏆 ${state.players[winner].name} wins!`],
  }
}

function calcScores(state, winner) {
  const total = state.hands.reduce((s, h, i) => i !== winner ? s + handValue(h) : s, 0)
  return state.hands.map((h, i) => i === winner ? total : -handValue(h))
}

// ─── Commit a human play ──────────────────────────────────────────────────────
export function commitPlay(state, newBoard, newHand, playerIdx) {
  if (!isValidBoard(newBoard)) return { ...state, error: 'Invalid board — check all sets are valid groups or runs!' }

  const prevHand = state.hands[playerIdx]
  const prevBoard = state.board
  const prevBoardIds = new Set(prevBoard.flat().map(t => t.id))
  const newBoardIds = new Set(newBoard.flat().map(t => t.id))
  const prevHandIds = new Set(prevHand.map(t => t.id))
  const newHandIds = new Set(newHand.map(t => t.id))

  const placedFromHand = [...newBoardIds].filter(id => !prevBoardIds.has(id) && prevHandIds.has(id))
  const takenFromBoard = [...prevBoardIds].filter(id => !newBoardIds.has(id) && newHandIds.has(id))

  if (takenFromBoard.length > 0) return { ...state, error: 'Cannot take tiles from the board into your hand!' }
  if (placedFromHand.length === 0) return { ...state, error: 'You must place at least one tile from your hand!' }

  if (!state.hasInitialMeld[playerIdx]) {
    const placedTiles = prevHand.filter(t => !newHand.find(h => h.id === t.id))
    const val = handValue(placedTiles)
    if (val < 30) return { ...state, error: `Initial meld needs ≥30 points — yours is ${val}.` }
    if (placedFromHand.some(id => prevBoardIds.has(id))) return { ...state, error: 'Initial meld must only use tiles from your hand!' }
  }

  const newHasMeld = state.hasInitialMeld.map((v,i) => i===playerIdx ? true : v)
  const newHands = state.hands.map((h,i) => i===playerIdx ? newHand : h)
  const name = state.players[playerIdx].name

  return advanceTurn({
    ...state,
    board: newBoard,
    hands: newHands,
    hasInitialMeld: newHasMeld,
    error: null,
    log: [...state.log, `${name} played ${placedFromHand.length} tile${placedFromHand.length!==1?'s':''}.`],
  }, playerIdx)
}
