import { buildPool, sortHand, isValidSet, isValidBoard, handValue, findInitialMeld, tileValue, findValidSetsFromHand } from './tiles.js'

export const INITIAL_HAND_SIZE = 14

export function initGame(players, simMode = false) {
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
    phase: 'play',
    finalRound: false,
    finalStartPlayer: -1,
    winner: null,
    hasInitialMeld: players.map(() => false),
    log: [`Game started! ${players[0].name}'s turn.`],
    scores: players.map(() => 0),
    sortMode: players.map(() => 'color'),
    simMode,
    // Stats tracking
    stats: {
      turns: 0,
      tilesDrawn: players.map(() => 0),
      tilesPlayed: players.map(() => 0),
      setsPlayed: players.map(() => 0),
      scoreHistory: [players.map(() => 0)], // snapshot per turn
      turnsPerPlayer: players.map(() => 0),
      drawsPerPlayer: players.map(() => 0),
    }
  }
}

export function setSortMode(state, playerIdx, mode) {
  const newModes = state.sortMode.map((m, i) => i === playerIdx ? mode : m)
  const newHand = sortHand(state.hands[playerIdx], mode)
  const newHands = state.hands.map((h, i) => i === playerIdx ? newHand : h)
  return { ...state, sortMode: newModes, hands: newHands }
}

export function drawTile(state, playerIdx) {
  const name = state.players[playerIdx].name
  const stats = { ...state.stats }

  if (state.pool.length === 0) {
    if (!state.finalRound) {
      const next = (playerIdx + 1) % state.players.length
      return {
        ...state, stats,
        finalRound: true, finalStartPlayer: next, currentPlayer: next,
        log: [...state.log, `Pool empty! Final round — one last turn each.`]
      }
    }
    stats.turnsPerPlayer = stats.turnsPerPlayer.map((v, i) => i === playerIdx ? v + 1 : v)
    stats.drawsPerPlayer = stats.drawsPerPlayer.map((v, i) => i === playerIdx ? v + 1 : v)
    return advanceTurn({ ...state, stats, log: [...state.log, `${name} passed (pool empty).`] }, playerIdx)
  }

  const tile = state.pool[state.pool.length - 1]
  const newPool = state.pool.slice(0, -1)
  const mode = state.sortMode[playerIdx] || 'color'
  const newHand = sortHand([...state.hands[playerIdx], tile], mode)
  const newHands = state.hands.map((h, i) => i === playerIdx ? newHand : h)

  stats.tilesDrawn = stats.tilesDrawn.map((v, i) => i === playerIdx ? v + 1 : v)
  stats.turnsPerPlayer = stats.turnsPerPlayer.map((v, i) => i === playerIdx ? v + 1 : v)
  stats.drawsPerPlayer = stats.drawsPerPlayer.map((v, i) => i === playerIdx ? v + 1 : v)

  return advanceTurn({ ...state, pool: newPool, hands: newHands, stats,
    log: [...state.log, `${name} drew (${newPool.length} left).`] }, playerIdx)
}

export function advanceTurn(state, fromPlayer) {
  const n = state.players.length
  const next = (state.currentPlayer + 1) % n

  for (let i = 0; i < state.hands.length; i++) {
    if (state.hands[i].length === 0) return endGame(state, i)
  }

  if (state.finalRound && next === state.finalStartPlayer) {
    return endGame(state, null)
  }

  const stats = { ...state.stats, turns: state.stats.turns + 1 }
  stats.scoreHistory = [...stats.scoreHistory, [...state.scores]]
  return { ...state, stats, currentPlayer: next }
}

function endGame(state, explicitWinner) {
  let winner = explicitWinner
  if (winner === null) {
    let minVal = Infinity
    state.hands.forEach((h, i) => { const v = handValue(h); if (v < minVal) { minVal = v; winner = i } })
  }
  const scores = calcScores(state, winner)
  const stats = { ...state.stats }
  stats.scoreHistory = [...stats.scoreHistory, scores]
  return { ...state, phase: 'finished', winner, scores, stats,
    log: [...state.log, `🏆 ${state.players[winner].name} wins!`] }
}

function calcScores(state, winner) {
  const total = state.hands.reduce((s, h, i) => i !== winner ? s + handValue(h) : s, 0)
  return state.hands.map((h, i) => i === winner ? total : -handValue(h))
}

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

  const newHasMeld = state.hasInitialMeld.map((v, i) => i === playerIdx ? true : v)
  const newHands = state.hands.map((h, i) => i === playerIdx ? newHand : h)
  const name = state.players[playerIdx].name
  const placed = placedFromHand.length

  const stats = { ...state.stats }
  stats.tilesPlayed = stats.tilesPlayed.map((v, i) => i === playerIdx ? v + placed : v)
  stats.setsPlayed = stats.setsPlayed.map((v, i) => {
    if (i !== playerIdx) return v
    const addedSets = newBoard.length - prevBoard.length
    return v + addedSets
  })
  stats.turnsPerPlayer = stats.turnsPerPlayer.map((v, i) => i === playerIdx ? v + 1 : v)

  return advanceTurn({
    ...state, board: newBoard, hands: newHands, hasInitialMeld: newHasMeld, stats, error: null,
    log: [...state.log, `${name} played ${placed} tile${placed !== 1 ? 's' : ''}.`],
  }, playerIdx)
}

// ─── Run a full simulation synchronously ──────────────────────────────────────
export function runSimulation(players) {
  const { aiPlay } = require ? (() => { throw 0 })() : { aiPlay: null } // handled caller-side
  return null // caller handles this
}
