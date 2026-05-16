// ============================================================
// RUMMIKUB GAME ENGINE
// ============================================================

export const COLORS = ['black', 'blue', 'orange', 'red'];
export const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

// ── Tile factory ────────────────────────────────────────────
let _uid = 0;
const uid = () => ++_uid;

export function makeTile(number, color, isJoker = false) {
  return { id: uid(), number, color, isJoker };
}

// ── Pool creation ────────────────────────────────────────────
export function createPool() {
  const tiles = [];
  for (let set = 0; set < 2; set++) {
    for (const color of COLORS) {
      for (const num of NUMBERS) {
        tiles.push(makeTile(num, color));
      }
    }
  }
  // 2 jokers
  tiles.push(makeTile(0, 'joker', true));
  tiles.push(makeTile(0, 'joker', true));
  return tiles;
}

// ── Shuffle ─────────────────────────────────────────────────
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Deal ────────────────────────────────────────────────────
export function dealHands(pool, numPlayers, tilesEach = 14) {
  const shuffled = shuffle(pool);
  const hands = [];
  let idx = 0;
  for (let p = 0; p < numPlayers; p++) {
    hands.push(shuffled.slice(idx, idx + tilesEach));
    idx += tilesEach;
  }
  return { hands, remaining: shuffled.slice(idx) };
}

// ── Validation ──────────────────────────────────────────────
export function isValidRun(tiles) {
  if (tiles.length < 3) return false;
  const nonJokers = tiles.filter(t => !t.isJoker);
  if (nonJokers.length === 0) return false;

  const color = nonJokers[0].color;
  if (nonJokers.some(t => t.color !== color)) return false;

  // Assign values to jokers based on position
  let nums = [];
  let jokerCount = tiles.filter(t => t.isJoker).length;
  let nonJokerNums = nonJokers.map(t => t.number).sort((a, b) => a - b);

  if (nonJokerNums.length === 0) return jokerCount >= 3;

  const min = nonJokerNums[0];
  const max = nonJokerNums[nonJokerNums.length - 1];
  const span = max - min + 1;
  if (span > 13) return false;
  if (span > tiles.length) return false;

  // Check gaps can be filled by jokers
  let gapsNeeded = 0;
  for (let i = 1; i < nonJokerNums.length; i++) {
    const gap = nonJokerNums[i] - nonJokerNums[i - 1] - 1;
    if (gap < 0) return false; // duplicate
    gapsNeeded += gap;
  }
  // jokers needed = gapsNeeded + extra positions (extend run)
  const extraPositions = tiles.length - nonJokerNums.length - gapsNeeded;
  if (extraPositions < 0) return false;
  if (gapsNeeded > jokerCount) return false;
  if (min < 1 || max > 13) return false;
  // Check that the run fits within 1-13 with jokers filling gaps or extending at ends
  // Try placing jokers at the start (left extension)
  const tentativeMaxLeft = min + tiles.length - 1;
  // Try placing jokers at the end (right extension)
  const tentativeMinRight = max - tiles.length + 1;

  const fitsLeft = tentativeMaxLeft <= 13 && min >= 1;
  const fitsRight = tentativeMinRight >= 1 && max <= 13;

  if (!fitsLeft && !fitsRight) return false;
  return true;
}

export function isValidGroup(tiles) {
  if (tiles.length < 3 || tiles.length > 4) return false;
  const nonJokers = tiles.filter(t => !t.isJoker);
  if (nonJokers.length === 0) return true; // all jokers - 3+ jokers
  const num = nonJokers[0].number;
  if (nonJokers.some(t => t.number !== num)) return false;
  const colors = nonJokers.map(t => t.color);
  return new Set(colors).size === colors.length;
}

export function isValidSet(tiles) {
  return isValidGroup(tiles) || isValidRun(tiles);
}

export function tileSetValue(tiles) {
  return tiles.reduce((sum, t) => sum + (t.isJoker ? 30 : t.number), 0);
}

export function isValidBoard(sets) {
  return sets.every(s => isValidSet(s));
}

// ── Sort hand ────────────────────────────────────────────────
export function sortHand(tiles, byColor = true) {
  if (byColor) {
    const order = { black: 0, blue: 1, orange: 2, red: 3, joker: 4 };
    return [...tiles].sort((a, b) => {
      if (a.isJoker) return 1;
      if (b.isJoker) return -1;
      const co = order[a.color] - order[b.color];
      return co !== 0 ? co : a.number - b.number;
    });
  } else {
    return [...tiles].sort((a, b) => {
      if (a.isJoker) return 1;
      if (b.isJoker) return -1;
      return a.number !== b.number ? a.number - b.number : a.color.localeCompare(b.color);
    });
  }
}

// ── Find valid sets in a hand ────────────────────────────────
export function findSetsInHand(hand) {
  const sets = [];
  const n = hand.length;

  // Check all combinations of 3-4 tiles
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        const trio = [hand[i], hand[j], hand[k]];
        if (isValidSet(trio)) sets.push(trio);
        for (let l = k + 1; l < n; l++) {
          const quad = [hand[i], hand[j], hand[k], hand[l]];
          if (isValidSet(quad)) sets.push(quad);
        }
      }
    }
  }
  return sets;
}

// ── Initial meld check (≥30 pts, hand tiles only) ────────────
export function canMakeInitialMeld(hand) {
  const sets = findSetsInHand(hand);
  if (sets.length === 0) return null;

  // Try all combinations of non-overlapping sets with ≥30 pts
  const best = findBestMeld(sets, hand, 30);
  return best;
}

function findBestMeld(sets, hand, minPts) {
  // BFS/DFS to find combination of non-overlapping sets with highest value ≥ minPts
  let bestResult = null;
  let bestVal = minPts - 1;

  function dfs(remaining, chosen, usedIds) {
    const val = chosen.reduce((s, set) => s + tileSetValue(set), 0);
    if (val > bestVal) {
      bestVal = val;
      bestResult = [...chosen];
    }
    for (let i = remaining; i < sets.length; i++) {
      const set = sets[i];
      if (set.some(t => usedIds.has(t.id))) continue;
      const newUsed = new Set([...usedIds, ...set.map(t => t.id)]);
      dfs(i + 1, [...chosen, set], newUsed);
    }
  }

  dfs(0, [], new Set());
  return bestVal >= minPts ? bestResult : null;
}

// ── AI move computation ──────────────────────────────────────
// Returns { newBoard, tilesPlayed } or null if no move
export function computeAIMove(hand, board, hasMelded, strength = 3) {
  if (!hasMelded) {
    const meld = canMakeInitialMeld(hand);
    if (meld) {
      const played = meld.flat();
      const remainingHand = hand.filter(t => !played.find(p => p.id === t.id));
      const newBoard = [...board, ...meld];
      return { newBoard, tilesPlayed: played, newHand: remainingHand, type: 'initial' };
    }
    return null;
  }

  // Post-meld: try to play as many tiles as possible
  return computePostMeldMove(hand, board, strength);
}

function computePostMeldMove(hand, board, strength) {
  // Strategy: try extensions first, then new sets, then board rearrangements
  const moves = [];

  // 1. Try extending board runs/groups with hand tiles
  const extensions = findExtensions(hand, board);
  if (extensions.length > 0) {
    moves.push(...extensions);
  }

  // 2. Try forming new sets from hand
  const newSets = findSetsInHand(hand);
  if (newSets.length > 0) {
    // Play best combination of sets
    const bestCombo = findBestMeld(newSets, hand, 1);
    if (bestCombo) {
      const played = bestCombo.flat();
      const newHand = hand.filter(t => !played.find(p => p.id === t.id));
      const newBoard = [...board, ...bestCombo];
      moves.push({ newBoard, tilesPlayed: played, newHand, score: played.length });
    }
  }

  // 3. Board extractions (take tiles from board to form new groups)
  if (strength >= 3) {
    const extractions = findBoardExtractions(hand, board);
    moves.push(...extractions);
  }

  if (moves.length === 0) return null;

  // Pick best move (most tiles played)
  moves.sort((a, b) => b.tilesPlayed.length - a.tilesPlayed.length);
  return moves[0];
}

function findExtensions(hand, board) {
  const results = [];
  board.forEach((set, setIdx) => {
    if (!isValidRun(set) && !isValidGroup(set)) return;

    if (isValidRun(set)) {
      // Try appending/prepending to run
      const nonJokers = set.filter(t => !t.isJoker);
      const color = nonJokers[0]?.color;
      const nums = set.map((t, i) => {
        if (t.isJoker) return null;
        return t.number;
      }).filter(Boolean);
      const minNum = Math.min(...nums);
      const maxNum = Math.max(...nums);

      hand.forEach(tile => {
        if (tile.isJoker || tile.color !== color) return;
        if (tile.number === minNum - 1 && minNum - 1 >= 1) {
          const newSet = [tile, ...set];
          if (isValidRun(newSet)) {
            const newBoard = board.map((s, i) => i === setIdx ? newSet : s);
            const newHand = hand.filter(t => t.id !== tile.id);
            results.push({ newBoard, tilesPlayed: [tile], newHand, score: 1 });
          }
        }
        if (tile.number === maxNum + 1 && maxNum + 1 <= 13) {
          const newSet = [...set, tile];
          if (isValidRun(newSet)) {
            const newBoard = board.map((s, i) => i === setIdx ? newSet : s);
            const newHand = hand.filter(t => t.id !== tile.id);
            results.push({ newBoard, tilesPlayed: [tile], newHand, score: 1 });
          }
        }
      });
    }

    if (isValidGroup(set) && set.length === 3) {
      // Try adding 4th tile to group
      const num = set.filter(t => !t.isJoker)[0]?.number;
      const existingColors = new Set(set.filter(t => !t.isJoker).map(t => t.color));
      hand.forEach(tile => {
        if (tile.isJoker || tile.number !== num) return;
        if (!existingColors.has(tile.color)) {
          const newSet = [...set, tile];
          if (isValidGroup(newSet)) {
            const newBoard = board.map((s, i) => i === setIdx ? newSet : s);
            const newHand = hand.filter(t => t.id !== tile.id);
            results.push({ newBoard, tilesPlayed: [tile], newHand, score: 1 });
          }
        }
      });
    }
  });
  return results;
}

// Take end tiles from board runs to form new groups
export function findBoardExtractions(hand, board) {
  const results = [];

  // Find all "extractable" end tiles from runs (if run stays valid with ≥3 tiles)
  const extractable = [];
  board.forEach((set, setIdx) => {
    if (!isValidRun(set) || set.length <= 3) return;
    // Can take from start or end
    ['start', 'end'].forEach(pos => {
      const tile = pos === 'start' ? set[0] : set[set.length - 1];
      const remaining = pos === 'start' ? set.slice(1) : set.slice(0, -1);
      if (isValidRun(remaining)) {
        extractable.push({ tile, setIdx, pos, remaining });
      }
    });
  });

  // Try combining extracted tiles with hand tiles to form new groups
  extractable.forEach(({ tile, setIdx, pos, remaining }) => {
    if (tile.isJoker) return;
    const sameNum = hand.filter(t => !t.isJoker && t.number === tile.number && t.color !== tile.color);
    if (sameNum.length >= 2) {
      const newGroup = [tile, ...sameNum.slice(0, 2)];
      if (isValidGroup(newGroup)) {
        const newBoard = board.map((s, i) => i === setIdx ? remaining : s);
        newBoard.push(newGroup);
        const tilesPlayed = sameNum.slice(0, 2);
        const newHand = hand.filter(t => !tilesPlayed.find(p => p.id === t.id));
        results.push({ newBoard, tilesPlayed, newHand, score: tilesPlayed.length });
      }
    }
  });

  return results;
}

// ── Score calculation ────────────────────────────────────────
export function calculateHandValue(hand) {
  return hand.reduce((sum, t) => sum + (t.isJoker ? 30 : t.number), 0);
}

// ── Initial game state ────────────────────────────────────────
export function createInitialState(playerNames) {
  const pool = createPool();
  const { hands, remaining } = dealHands(pool, playerNames.length);

  const players = playerNames.map((name, i) => ({
    id: i,
    name,
    isHuman: i === 0,
    hand: hands[i],
    hasMelded: false,
    score: 0,
    roundScore: 0,
  }));

  return {
    players,
    pool: remaining,
    board: [], // array of tile arrays (sets)
    currentPlayer: 0,
    phase: 'playing', // 'playing' | 'roundOver' | 'gameOver'
    lastDraw: false,
    log: [],
    round: 1,
    sortByColor: true,
    debugMode: false,
    aiSpeed: 1500, // ms between AI actions
  };
}

// ── Stubs for future features ────────────────────────────────
export function computeHint(hand, board, hasMelded) {
  if (!hasMelded) {
    const meld = canMakeInitialMeld(hand);
    if (meld) {
      const value = meld.flat().reduce((s, t) => s + (t.isJoker ? 30 : t.number), 0);
      return { type: 'initial', sets: meld, value };
    }
    return { type: 'no-meld', message: 'No initial meld available (need ≥30 pts). Draw a tile.' };
  }

  // Post-meld: suggest best available play
  const newSets = findSetsInHand(hand);
  const bestCombo = newSets.length > 0 ? findBestMeld(newSets, hand, 1) : null;
  if (bestCombo) {
    const value = bestCombo.flat().reduce((s, t) => s + (t.isJoker ? 30 : t.number), 0);
    return { type: 'play', sets: bestCombo, value };
  }
  return { type: 'draw', message: 'No playable sets found. Consider drawing a tile.' };
}

export function runSimulation(_gameState, _iterations) {
  // TODO: Monte Carlo simulation for statistics
  return null;
}

export function computeStrategicMove(_hand, _board, _hasMelded, _depth) {
  // TODO: deeper lookahead AI with configurable strength
  return null;
}
