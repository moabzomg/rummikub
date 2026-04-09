import { buildPool, sortHand, isValidSet, isValidBoard, handValue, findInitialMeld, findValidSetsFromHand, tileValue } from './tiles.js'

export const INITIAL_HAND_SIZE = 14

export function initGame(players) {
  // players: [{ name, type:'human'|'ai', strategy:'aggressive'|'defensive'|'balanced'|'speed' }]
  const pool = buildPool()
  const hands = players.map(() => [])

  for (let i = 0; i < INITIAL_HAND_SIZE; i++) {
    for (let p = 0; p < players.length; p++) {
      if (pool.length > 0) hands[p].push(pool.pop())
    }
  }

  return {
    pool,
    players,
    hands: hands.map(sortHand),
    board: [],        // array of sets (each set = array of tiles)
    currentPlayer: 0,
    phase: 'play',   // play | finished
    winner: null,
    hasInitialMeld: players.map(() => false), // tracks 30-point initial meld
    turnHistory: [],
    log: [`Game started! ${players[0].name}'s turn.`],
    scores: players.map(() => 0),
    pendingBoard: null,  // board state during player's turn before confirm
    pendingHand: null,
    turnPassed: false,
  }
}

// Draw a tile from pool
export function drawTile(state, playerIdx) {
  if (state.pool.length === 0) {
    return advanceTurn({ ...state, log: [...state.log, 'Pool empty — skipping turn.'] })
  }
  const tile = state.pool[state.pool.length - 1]
  const newPool = state.pool.slice(0, -1)
  const newHand = sortHand([...state.hands[playerIdx], tile])
  const newHands = state.hands.map((h, i) => i === playerIdx ? newHand : h)
  const name = state.players[playerIdx].name
  return advanceTurn({
    ...state,
    pool: newPool,
    hands: newHands,
    log: [...state.log, `${name} drew a tile. (${newPool.length} left in pool)`],
  })
}

export function advanceTurn(state) {
  const next = (state.currentPlayer + 1) % state.players.length
  // Check if game over (someone has empty hand)
  for (let i = 0; i < state.hands.length; i++) {
    if (state.hands[i].length === 0) {
      const scores = calcScores(state)
      return {
        ...state,
        phase: 'finished',
        winner: i,
        scores,
        log: [...state.log, `🏆 ${state.players[i].name} wins!`],
      }
    }
  }
  return {
    ...state,
    currentPlayer: next,
    pendingBoard: null,
    pendingHand: null,
  }
}

function calcScores(state) {
  // Winner gets sum of all other hands (negative for others)
  return state.hands.map((h, i) => {
    const val = handValue(h)
    return i === state.winner ? state.hands.reduce((s, hh, j) => j !== i ? s + handValue(hh) : s, 0) : -val
  })
}

// Validate and commit a board play
export function commitPlay(state, newBoard, newHand, playerIdx) {
  if (!isValidBoard(newBoard)) {
    return { ...state, error: 'Invalid board — sets must be valid groups or runs!' }
  }

  const p = state.players[playerIdx]
  const prevHand = state.hands[playerIdx]
  const prevBoard = state.board

  // Count tiles placed from hand vs taken from board
  const prevBoardIds = new Set(prevBoard.flat().map(t => t.id))
  const newBoardIds = new Set(newBoard.flat().map(t => t.id))
  const prevHandIds = new Set(prevHand.map(t => t.id))
  const newHandIds = new Set(newHand.map(t => t.id))

  // Tiles added to board from hand
  const placedFromHand = [...newBoardIds].filter(id => !prevBoardIds.has(id) && prevHandIds.has(id))
  // Tiles removed from board to hand (not allowed!)
  const takenFromBoard = [...prevBoardIds].filter(id => !newBoardIds.has(id) && newHandIds.has(id))

  if (takenFromBoard.length > 0) {
    return { ...state, error: 'Cannot take tiles from the board into your hand!' }
  }

  if (placedFromHand.length === 0) {
    return { ...state, error: 'You must place at least one tile!' }
  }

  // Check initial meld: first play must sum ≥30 from hand only
  if (!state.hasInitialMeld[playerIdx]) {
    const placedTiles = prevHand.filter(t => !newHand.find(h => h.id === t.id))
    const placedValue = handValue(placedTiles)
    if (placedValue < 30) {
      return { ...state, error: `Initial meld must score at least 30 points! (You placed ${placedValue})` }
    }
    // Initial meld: cannot use existing board tiles
    const usedBoardTile = placedFromHand.some(id => prevBoardIds.has(id))
    if (usedBoardTile) {
      return { ...state, error: 'Initial meld must use tiles from your hand only!' }
    }
  }

  const newHasMeld = state.hasInitialMeld.map((v, i) => i === playerIdx ? true : v)
  const newHands = state.hands.map((h, i) => i === playerIdx ? newHand : h)

  const name = p.name
  const tilesPlaced = placedFromHand.length

  let newState = {
    ...state,
    board: newBoard,
    hands: newHands,
    hasInitialMeld: newHasMeld,
    error: null,
    log: [...state.log, `${name} placed ${tilesPlaced} tile${tilesPlaced !== 1 ? 's' : ''}.`],
  }

  return advanceTurn(newState)
}
