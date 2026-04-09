// ─── Tile Factory ────────────────────────────────────────────────────────────
export const COLORS = ['red', 'blue', 'black', 'orange'];
export const NUMBERS = Array.from({ length: 13 }, (_, i) => i + 1);

let _id = 0;
function makeTile(color, number, isJoker = false) {
  return { id: _id++, color, number, isJoker };
}

export function createDeck() {
  _id = 0;
  const tiles = [];
  for (let copy = 0; copy < 2; copy++) {
    for (const color of COLORS) {
      for (const number of NUMBERS) {
        tiles.push(makeTile(color, number));
      }
    }
  }
  // 2 jokers
  tiles.push(makeTile('joker', 0, true));
  tiles.push(makeTile('joker', 0, true));
  return shuffle(tiles);
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Set Validation ───────────────────────────────────────────────────────────
// A valid set is either a Run or a Group of 3+ tiles.
// Run: same color, consecutive numbers (jokers fill gaps)
// Group: same number, different colors (jokers fill in)

export function isValidSet(tiles) {
  if (!tiles || tiles.length < 3) return false;
  return isRun(tiles) || isGroup(tiles);
}

function isRun(tiles) {
  const jokers = tiles.filter(t => t.isJoker).length;
  const reals = tiles.filter(t => !t.isJoker);
  if (reals.length === 0) return false;

  // All same color
  const color = reals[0].color;
  if (!reals.every(t => t.color === color)) return false;

  const nums = reals.map(t => t.number).sort((a, b) => a - b);
  // No duplicates
  if (new Set(nums).size !== nums.length) return false;

  const min = nums[0];
  const max = nums[nums.length - 1];
  const range = max - min + 1;
  const gaps = range - nums.length;
  return gaps <= jokers && range === tiles.length;
}

function isGroup(tiles) {
  const jokers = tiles.filter(t => t.isJoker).length;
  const reals = tiles.filter(t => !t.isJoker);
  if (reals.length === 0) return false;

  // All same number
  const num = reals[0].number;
  if (!reals.every(t => t.number === num)) return false;

  // All different colors
  const colors = reals.map(t => t.color);
  if (new Set(colors).size !== colors.length) return false;

  return tiles.length >= 3 && tiles.length <= 4;
}

export function isValidBoard(sets) {
  return sets.every(set => isValidSet(set));
}

export function tileValue(tile) {
  if (tile.isJoker) return 30;
  return tile.number;
}

export function handValue(tiles) {
  return tiles.reduce((sum, t) => sum + tileValue(t), 0);
}

// ─── Initial Meld ─────────────────────────────────────────────────────────────
export function initialMeldValue(sets) {
  return sets.reduce((sum, set) => sum + set.reduce((s, t) => s + tileValue(t), 0), 0);
}

// ─── AI Logic ────────────────────────────────────────────────────────────────
// AI strategy: find best sets to play, prioritise initial meld >= 30
export function computeAIMove(hand, boardSets, hasInitialMeld) {
  // Try to find valid sets from hand
  const sets = findBestSets(hand);

  if (!hasInitialMeld) {
    // Need sets totalling >= 30
    const meldSets = findInitialMeld(hand);
    if (meldSets) {
      return { type: 'play', sets: meldSets };
    }
    return { type: 'draw' };
  }

  if (sets.length > 0) {
    // Also try adding to existing board sets
    const additions = findAdditions(hand, boardSets);
    return { type: 'play', sets, additions };
  }

  return { type: 'draw' };
}

function findBestSets(hand) {
  const found = [];
  const used = new Set();

  // Try groups first (easier to spot)
  for (const num of NUMBERS) {
    const byNum = hand.filter(t => !t.isJoker && t.number === num && !used.has(t.id));
    if (byNum.length >= 3) {
      // Pick up to 4 unique colors
      const colorMap = {};
      for (const t of byNum) {
        if (!colorMap[t.color]) colorMap[t.color] = t;
      }
      const group = Object.values(colorMap).slice(0, 4);
      if (group.length >= 3) {
        found.push(group);
        group.forEach(t => used.add(t.id));
      }
    }
  }

  // Try runs
  for (const color of COLORS) {
    const byColor = hand
      .filter(t => !t.isJoker && t.color === color && !used.has(t.id))
      .sort((a, b) => a.number - b.number);

    const run = longestRun(byColor, hand.filter(t => t.isJoker && !used.has(t.id)));
    if (run && run.length >= 3) {
      found.push(run);
      run.forEach(t => used.add(t.id));
    }
  }

  return found;
}

function longestRun(sorted, jokers) {
  if (sorted.length === 0) return null;
  let best = null;

  for (let start = 0; start < sorted.length; start++) {
    let run = [sorted[start]];
    let jokersLeft = jokers.length;
    let prev = sorted[start].number;

    for (let i = start + 1; i < sorted.length; i++) {
      const gap = sorted[i].number - prev - 1;
      if (gap <= jokersLeft) {
        // Fill with jokers
        const used = Math.min(gap, jokersLeft);
        for (let g = 0; g < used; g++) {
          run.push(jokers[jokers.length - jokersLeft + g]);
        }
        jokersLeft -= used;
        run.push(sorted[i]);
        prev = sorted[i].number;
      } else {
        break;
      }
    }

    if (run.length >= 3 && (!best || run.length > best.length)) {
      best = run;
    }
  }
  return best;
}

function findInitialMeld(hand) {
  const allSets = findBestSets(hand);
  if (allSets.length === 0) return null;

  // Try combinations totalling >= 30
  for (let mask = (1 << allSets.length) - 1; mask > 0; mask--) {
    const combo = [];
    for (let i = 0; i < allSets.length; i++) {
      if (mask & (1 << i)) combo.push(allSets[i]);
    }
    const val = initialMeldValue(combo);
    if (val >= 30) return combo;
  }
  return null;
}

function findAdditions(hand, boardSets) {
  const additions = [];
  for (let si = 0; si < boardSets.length; si++) {
    const set = boardSets[si];
    for (const tile of hand) {
      // Try appending to a run
      const extended = [...set, tile];
      if (isValidSet(extended)) {
        additions.push({ setIndex: si, tile, position: 'end' });
      }
      const prepended = [tile, ...set];
      if (isValidSet(prepended)) {
        additions.push({ setIndex: si, tile, position: 'start' });
      }
    }
  }
  return additions;
}
