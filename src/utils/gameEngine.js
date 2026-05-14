// v2 build 20260513-091045
// ── CONSTANTS ──
export const COLORS = ['red','blue','orange','black'];
export const COLOR_ORDER = {red:0,blue:1,orange:2,black:3};

// ── BUILD POOL ──
export function buildPool() {
  let id = 0;
  const tiles = [];
  for (let copy = 0; copy < 2; copy++)
    for (const c of COLORS)
      for (let n = 1; n <= 13; n++)
        tiles.push({id:id++, color:c, num:n, isJoker:false});
  tiles.push({id:id++, color:'joker', num:0, isJoker:true});
  tiles.push({id:id++, color:'joker', num:0, isJoker:true});
  for (let i = tiles.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}

export function tileVal(t) { return (t && t.isJoker) ? 30 : (t ? t.num : 0); }
export function handVal(h) { return (h||[]).reduce((s,t) => s + tileVal(t), 0); }

// ── VALIDATION ──
export function isRun(tiles) {
  if (!tiles || tiles.length < 3) return false;
  const norm = tiles.filter(t => t && !t.isJoker);
  if (!norm.length) return false;
  const colors = [...new Set(norm.map(t => t.color))];
  if (colors.length !== 1) return false;
  const nums = norm.map(t => t.num).sort((a,b) => a-b);
  const min = nums[0], max = nums[nums.length-1];
  if (max - min + 1 > 13) return false;
  const seen = new Set();
  for (const n of nums) { if (seen.has(n)) return false; seen.add(n); }
  const jokers = tiles.length - norm.length;
  return jokers >= (max - min + 1) - norm.length;
}

export function isGroup(tiles) {
  if (!tiles || tiles.length < 3 || tiles.length > 4) return false;
  const norm = tiles.filter(t => t && !t.isJoker);
  if (!norm.length) return false;
  const nums = [...new Set(norm.map(t => t.num))];
  if (nums.length !== 1) return false;
  const cols = norm.map(t => t.color);
  return new Set(cols).size === cols.length;
}

export function isValid(tiles) {
  return !!(tiles && tiles.length >= 3 && (isRun(tiles) || isGroup(tiles)));
}
export function isValidBoard(sets) {
  return (sets||[]).every(s => isValid(s));
}

// ── SORT SET ──
export function sortSet(tiles) {
  const safe = (tiles||[]).filter(t => t && t.id !== undefined);
  const norm = safe.filter(t => !t.isJoker);
  const jokers = safe.filter(t => t.isJoker);
  if (!norm.length) return safe;
  const cols = [...new Set(norm.map(t => t.color))];
  const nums = [...new Set(norm.map(t => t.num))];
  const isGroupSet = nums.length === 1;

  if (!isGroupSet && cols.length === 1) {
    const sorted = [...norm].sort((a,b) => a.num - b.num);
    const minNum = sorted[0].num;
    const maxNum = sorted[sorted.length-1].num;
    const totalLen = safe.length;
    const jokerCount = jokers.length;
    const gapsInMiddle = (maxNum - minNum + 1) - norm.length;
    const jokersForHead = jokerCount - gapsInMiddle;
    const runEndIfTrailing = maxNum + Math.max(0, jokersForHead);
    let runStart;
    if (jokersForHead > 0 && runEndIfTrailing > 13) {
      runStart = Math.max(1, minNum - jokersForHead);
    } else {
      runStart = minNum;
    }
    const slots = [];
    for (let n = runStart; n < runStart + totalLen; n++) slots.push(n);
    const out = [];
    let ji = 0;
    for (const n of slots) {
      const normTile = norm.find(t => t.num === n);
      if (normTile) out.push(normTile);
      else if (ji < jokers.length) out.push(jokers[ji++]);
    }
    return out;
  }

  // GROUP: place joker in colour slot
  const presentColors = new Set(norm.map(t => t.color));
  const missingColors = COLORS.filter(c => !presentColors.has(c));
  const colorSlots = [...norm].sort((a,b) => (COLOR_ORDER[a.color]||0) - (COLOR_ORDER[b.color]||0));
  let ji = 0, ni = 0;
  const result = [];
  for (const c of COLORS) {
    if (presentColors.has(c)) result.push(colorSlots[ni++]);
    else if (ji < jokers.length && missingColors.includes(c)) result.push(jokers[ji++]);
  }
  while (ni < colorSlots.length) result.push(colorSlots[ni++]);
  while (ji < jokers.length) result.push(jokers[ji++]);
  return result;
}

// ── FIND ALL SETS (safe, crash-proof) ──
export function findAllSets(tiles) {
  const capped = (tiles||[]).filter(t => t && t.id !== undefined).slice(0, 16);
  const result = [];
  const jokers = capped.filter(t => t.isJoker);
  const normals = capped.filter(t => !t.isJoker);

  // RUNS by colour
  const byColor = {};
  for (const t of normals) {
    if (!byColor[t.color]) byColor[t.color] = [];
    byColor[t.color].push(t);
  }
  for (const colorTiles of Object.values(byColor)) {
    const sorted = [];
    const seenN = new Set();
    for (const t of [...colorTiles].sort((a,b) => a.num - b.num)) {
      if (!seenN.has(t.num)) { seenN.add(t.num); sorted.push(t); }
    }
    for (let s = 0; s < sorted.length; s++) {
      const run = [sorted[s]];
      let jUsed = 0, lastNum = sorted[s].num;
      for (let e = s+1; e < sorted.length; e++) {
        const gap = sorted[e].num - lastNum - 1;
        if (gap < 0) continue;
        if (jUsed + gap > jokers.length) break;
        for (let g = 0; g < gap; g++) {
          if (jokers[jUsed]) run.push(jokers[jUsed++]);
        }
        run.push(sorted[e]);
        lastNum = sorted[e].num;
        if (run.length >= 3) result.push([...run]);
        if (run.length >= 13) break;
      }
      // joker at start of consecutive pair
      if (jokers.length > 0 && s+1 < sorted.length && sorted[s+1].num === sorted[s].num+1) {
        const r = [jokers[0], sorted[s], sorted[s+1]];
        if (isRun(r)) {
          result.push(r);
          for (let e = s+2; e < sorted.length; e++) {
            const ext = [...r, sorted[e]];
            if (isRun(ext)) result.push([...ext]); else break;
          }
        }
      }
    }
  }

  // GROUPS by number
  const byNum = {};
  for (const t of normals) {
    if (!byNum[t.num]) byNum[t.num] = [];
    byNum[t.num].push(t);
  }
  for (const numTiles of Object.values(byNum)) {
    const unique = [];
    const seenC = new Set();
    for (const t of numTiles) {
      if (!seenC.has(t.color)) { seenC.add(t.color); unique.push(t); }
    }
    if (unique.length >= 3) {
      result.push(unique.slice(0, 3));
      if (unique.length >= 4) result.push(unique.slice(0, 4));
    }
    if (jokers.length > 0) {
      if (unique.length === 2) { const g = [...unique, jokers[0]]; if (isGroup(g)) result.push(g); }
      if (unique.length === 3) { const g = [...unique, jokers[0]]; if (isGroup(g)) result.push(g); }
    }
  }

  // Dedup: no duplicate tile IDs within a set, no duplicate sets
  const seen = new Set();
  return result.filter(s => {
    if (!s || s.some(t => !t || t.id === undefined)) return false;
    const tileIds = s.map(t => t.id);
    if (new Set(tileIds).size !== tileIds.length) return false; // same tile twice
    const k = tileIds.sort().join(',');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ── BEST COMBINATION ──
export function bestCombination(tiles) {
  const safeTiles = (tiles||[]).filter(t => t && t.id !== undefined);
  const allSets = findAllSets(safeTiles);
  if (!allSets.length) return {sets:[], count:0, value:0};
  const sorted = [...allSets].sort((a,b) =>
    b.length !== a.length ? b.length - a.length
    : b.reduce((s,t) => s+tileVal(t), 0) - a.reduce((s,t) => s+tileVal(t), 0)
  );
  let bestSets = [], bestCount = 0, bestValue = 0;
  const LIMIT = 2000; let iters = 0;
  function bt(idx, chosen, usedIds) {
    if (++iters > LIMIT) return;
    const c = usedIds.size;
    const v = chosen.flat().reduce((s,t) => s + tileVal(t), 0);
    if (c > bestCount || (c === bestCount && v > bestValue)) {
      bestCount = c; bestValue = v; bestSets = chosen.map(s => [...s]);
    }
    for (let i = idx; i < sorted.length; i++) {
      if (iters > LIMIT) break;
      const set = sorted[i];
      if (set.some(t => usedIds.has(t.id))) continue;
      const nu = new Set([...usedIds, ...set.map(t => t.id)]);
      bt(i+1, [...chosen, set], nu);
    }
  }
  bt(0, [], new Set());
  const cleanSets = bestSets
    .map(s => s.filter(t => t && t.id !== undefined))
    .filter(s => s.length >= 3);
  return {
    sets: cleanSets,
    count: cleanSets.flat().length,
    value: cleanSets.flat().reduce((s,t) => s + tileVal(t), 0),
  };
}

// ── SORT HAND ──
export function sortHand(hand, mode) {
  const safeHand = (hand||[]).filter(t => t && t.id !== undefined);
  const combo = bestCombination(safeHand);
  const setGroups = combo.sets.map(s => s.filter(t => t && t.id !== undefined));
  const usedIds = new Set(setGroups.flat().map(t => t.id));
  const remaining = safeHand.filter(t => !usedIds.has(t.id));
  const sortedGroups = setGroups.map(s => sortSet(s));
  const playableFlat = sortedGroups.flat();
  const sortedRest = [...remaining].sort((a,b) => {
    if (a.isJoker && b.isJoker) return 0;
    if (a.isJoker) return 1; if (b.isJoker) return -1;
    if (mode === 'color') {
      const cd = (COLOR_ORDER[a.color]||0) - (COLOR_ORDER[b.color]||0);
      return cd !== 0 ? cd : a.num - b.num;
    }
    return a.num !== b.num ? a.num - b.num : (COLOR_ORDER[a.color]||0) - (COLOR_ORDER[b.color]||0);
  });
  return {
    tiles: [...playableFlat, ...sortedRest],
    playableCount: playableFlat.length,
    sets: sortedGroups,
  };
}

// ── JOKER INFERENCE ──
export function inferJokerValue(set, jokerIdx) {
  const norm = set.filter(t => !t.isJoker);
  if (!norm.length) return null;
  const cols = [...new Set(norm.map(t => t.color))];
  if (cols.length === 1) {
    const nj = [...norm].sort((a,b) => a.num - b.num);
    const min = nj[0].num;
    const fullRange = [];
    for (let n = min; n <= min + set.length - 1; n++) fullRange.push(n);
    const usedNums = new Set(nj.map(t => t.num));
    const gaps = fullRange.filter(n => !usedNums.has(n));
    const jokerIdxs = set.map((t,i) => t.isJoker ? i : -1).filter(i => i >= 0);
    const ji2 = jokerIdxs.indexOf(jokerIdx);
    return gaps[ji2] !== undefined ? gaps[ji2] : null;
  }
  return norm[0].num;
}

export function inferJokerColor(set) {
  const norm = set.filter(t => !t.isJoker);
  if (!norm.length) return null;
  const cols = [...new Set(norm.map(t => t.color))];
  return cols.length === 1 ? cols[0] : null;
}

// ── JOKER REPLACEMENTS (hand tile → board joker) ──
export function findJokerReplacements(hand, board) {
  const results = [];
  for (let si = 0; si < board.length; si++) {
    const set = board[si];
    const jokerIdxs = set.map((t,i) => t.isJoker ? i : -1).filter(i => i >= 0);
    for (const ji of jokerIdxs) {
      const jokerNum = inferJokerValue(set, ji);
      const jokerColor = inferJokerColor(set);
      if (jokerNum === null) continue;
      for (const ht of hand) {
        if (ht.isJoker) continue;
        if (ht.num === jokerNum && (jokerColor === null || ht.color === jokerColor)) {
          const newSet = [...set]; newSet[ji] = ht;
          if (isValid(newSet)) results.push({si, ji, handTile:ht, joker:set[ji]});
        }
      }
    }
  }
  return results;
}

// ── BOARD JOKER LIBERATION ──
// Strategy 1: Replace a board joker with a normal tile from another board set,
//   keeping both sets valid.
// Strategy 2: Extract a joker from a board set where the remaining tiles can be
//   extended by a tile from another set (chain reorganisation).
// Strategy 3: Simply remove a joker from a set that would remain valid without it
//   (e.g. set has extra tiles beyond minimum).
function findBoardJokerReplacements(board) {
  const results = [];

  for (let si = 0; si < board.length; si++) {
    const set = board[si];
    const jokerIdxs = set.map((t,i) => t.isJoker ? i : -1).filter(i => i >= 0);
    if (!jokerIdxs.length) continue;

    for (const ji of jokerIdxs) {
      const jokerNum = inferJokerValue(set, ji);
      const jokerColor = inferJokerColor(set);

      // Strategy 1: another board set has a tile that can slot in here
      for (let bsi = 0; bsi < board.length; bsi++) {
        if (bsi === si) continue;
        const bset = board[bsi];
        for (let bti = 0; bti < bset.length; bti++) {
          const bt = bset[bti];
          if (bt.isJoker) continue;
          if (jokerNum !== null && bt.num !== jokerNum) continue;
          if (jokerColor !== null && bt.color !== jokerColor) continue;
          // Source set must stay valid after removal
          const remaining = bset.filter((_,i) => i !== bti);
          if (remaining.length < 3 || !isValid(remaining)) continue;
          // Target set becomes valid with this tile
          const newTargetSet = [...set]; newTargetSet[ji] = bt;
          if (!isValid(newTargetSet)) continue;
          results.push({type:'board-swap', si, ji, boardTile:bt, joker:set[ji], boardTileSi:bsi});
        }
      }

      // Strategy 2: extract joker from this set if remaining tiles can be
      // rescued by appending/prepending a tile from another set.
      // e.g. 1,2,★,★ → remove one ★, patch the gap with a 3 from elsewhere
      const withoutJoker = set.filter((_,i) => i !== ji);
      // Try extending withoutJoker with each board tile to make it valid
      for (let bsi = 0; bsi < board.length; bsi++) {
        if (bsi === si) continue;
        const bset = board[bsi];
        for (let bti = 0; bti < bset.length; bti++) {
          const bt = bset[bti];
          if (bt.isJoker) continue;
          const remaining = bset.filter((_,i) => i !== bti);
          if (remaining.length < 3 || !isValid(remaining)) continue;
          // Can we patch withoutJoker + bt to make a valid set?
          const patched = sortSet([...withoutJoker, bt]);
          if (patched.length >= 3 && isValid(patched)) {
            results.push({type:'extract-patch', si, ji, joker:set[ji], patchTile:bt, patchTileSi:bsi, patched});
          }
        }
      }

      // Strategy 3: the set has ≥4 tiles and remains valid with the joker simply removed
      const withoutJ = set.filter((_,i) => i !== ji);
      if (withoutJ.length >= 3 && isValid(withoutJ)) {
        results.push({type:'extract-direct', si, ji, joker:set[ji]});
      }
    }
  }

  // Deduplicate by joker id
  const seen = new Set();
  return results.filter(r => {
    const k = `${r.si}-${r.ji}-${r.type}`;
    if (seen.has(k)) return false; seen.add(k); return true;
  });
}

// ── BOARD EXTENSIONS ──
export function findExtensions(hand, board) {
  const results = [];
  for (let si = 0; si < board.length; si++) {
    const set = board[si];
    for (const t of hand) {
      if (isValid([t, ...set])) results.push({si, pos:'start', tile:t, val:tileVal(t)});
      if (isValid([...set, t])) results.push({si, pos:'end', tile:t, val:tileVal(t)});
      if (isRun(set) || isGroup(set)) {
        for (let i = 1; i < set.length; i++) {
          const trial = [...set.slice(0,i), t, ...set.slice(i)];
          if (isValid(trial)) results.push({si, pos:'insert', insertAt:i, tile:t, val:tileVal(t)});
        }
      }
    }
  }
  return results;
}

// ── SPLIT SETS ──
export function findSplitInserts(tile, set, setIdx) {
  const results = [];
  if (!set || set.length < 6) return results;
  if (!isRun(set) && !isGroup(set)) return results;
  if (isRun(set)) {
    const norm = set.filter(t => !t.isJoker);
    const cols = [...new Set(norm.map(t => t.color))];
    if (cols.length !== 1) return results;
    if (!tile.isJoker && tile.color !== cols[0]) return results;
    for (let insertAt = 0; insertAt <= set.length; insertAt++) {
      const trial = [...set.slice(0,insertAt), tile, ...set.slice(insertAt)];
      for (let cut = 2; cut < trial.length - 2; cut++) {
        const left = trial.slice(0, cut+1);
        const right = trial.slice(cut);
        const tileInLeft = left.some(t => t.id === tile.id);
        const tileInRight = right.some(t => t.id === tile.id);
        if (tileInLeft === tileInRight) continue;
        if (left.length >= 3 && right.length >= 3 && isValid(left) && isValid(right)) {
          results.push({si:setIdx, insertAt, cut, left:sortSet(left), right:sortSet(right), tile});
        }
      }
    }
  }
  const seen = new Set();
  return results.filter(r => {
    const k = r.left.map(t => t.id).join(',') + '|' + r.right.map(t => t.id).join(',');
    if (seen.has(k)) return false; seen.add(k); return true;
  });
}

// ── MOVE SEQUENCE ENGINE (lookahead) ──
// ── BOARD TILE EXTRACTION ──
// Find board tiles that can be removed from their set (leaving it still valid)
// and combined with hand tiles to form a new valid set.
// e.g. board has 9,10,11,12,13 (orange). Remove 13 → 9,10,11,12 still valid.
// Hand has 13black, 13blue → new group 13orange+13black+13blue.
function findBoardExtractions(hand, board) {
  const results = [];

  // Build a list of extractable board tiles (tile, its setIdx, remaining set stays valid)
  const extractable = [];
  for (let si = 0; si < board.length; si++) {
    const set = board[si];
    for (let ti = 0; ti < set.length; ti++) {
      const tile = set[ti];
      if (tile.isJoker) continue;
      const remaining = set.filter((_,i) => i !== ti);
      if (remaining.length < 3 || !isValid(remaining)) continue;
      extractable.push({tile, si, ti, remaining});
    }
  }

  if (!extractable.length) return results;

  // For each combination of hand tiles + extractable board tiles,
  // check if they can form a valid set.
  // Limit: try groups (same number, different colors) and short runs.

  const handNorm = hand.filter(t => !t.isJoker);

  // Strategy A: form a group using hand tiles + board tiles
  // Group needs 3-4 tiles with same number, different colors
  const allNorm = [
    ...handNorm.map(t => ({...t, fromHand:true})),
    ...extractable.map(e => ({...e.tile, fromHand:false, si:e.si, remaining:e.remaining})),
  ];

  const byNum = {};
  for (const t of allNorm) {
    if (!byNum[t.num]) byNum[t.num] = [];
    byNum[t.num].push(t);
  }

  for (const [, tiles] of Object.entries(byNum)) {
    // Deduplicate by color (take first of each color)
    const byColor = {};
    for (const t of tiles) {
      if (!byColor[t.color]) byColor[t.color] = t;
    }
    const unique = Object.values(byColor);
    if (unique.length < 3) continue;

    // Must have at least one hand tile (otherwise it's a pure board rearrangement)
    const handPart = unique.filter(t => t.fromHand);
    if (!handPart.length) continue;

    // Try all 3-tile and 4-tile combos
    for (let size = 3; size <= Math.min(4, unique.length); size++) {
      // Pick all combos of `size` from unique
      const combos = [];
      const pick = (start, chosen) => {
        if (chosen.length === size) { combos.push([...chosen]); return; }
        for (let i = start; i < unique.length; i++) pick(i+1, [...chosen, unique[i]]);
      };
      pick(0, []);

      for (const combo of combos) {
        if (!combo.some(t => t.fromHand)) continue; // need at least one hand tile
        const tileObjs = combo.map(t => ({id:t.id, color:t.color, num:t.num, isJoker:false}));
        if (!isGroup(tileObjs)) continue;

        // Collect board extractions needed
        const boardExtracts = combo.filter(t => !t.fromHand);
        const handTiles = combo.filter(t => t.fromHand);

        // Verify all board extractions are from different sets (or same set only if tile count allows)
        const siCounts = {};
        let valid = true;
        for (const be of boardExtracts) {
          siCounts[be.si] = (siCounts[be.si] || 0) + 1;
          // Check the remaining set after removing this tile
          const srcSet = board[be.si];
          const rem = srcSet.filter(t => t.id !== be.id);
          if (rem.length < 3 || !isValid(rem)) { valid = false; break; }
        }
        if (!valid) continue;

        results.push({
          type: 'extract-group',
          newSet: sortSet(tileObjs),
          boardExtracts: boardExtracts.map(be => ({tile:be, si:be.si})),
          handTiles: handTiles.map(t => ({id:t.id, color:t.color, num:t.num, isJoker:false})),
          value: tileObjs.reduce((s,t) => s + t.num, 0),
          desc: `Form ${tileObjs[0].num}-group from board+hand`,
        });
      }
    }
  }

  // Deduplicate
  const seen = new Set();
  return results.filter(r => {
    const k = r.newSet.map(t=>t.id).sort().join(',');
    if (seen.has(k)) return false; seen.add(k); return true;
  }).sort((a,z) => z.value - a.value);
}

function runOnePass(h, b, steps) {
  // A) Hand tile replaces board joker
  const reps = findJokerReplacements(h, b);
  if (reps.length > 0) {
    const rep = reps[0];
    b = b.map(s => [...s]);
    b[rep.si][rep.ji] = rep.handTile;
    h = h.filter(t => t.id !== rep.handTile.id);
    h = [...h, rep.joker];
    steps.push({type:'joker-lib', desc:`Free ★ in set ${rep.si+1}`});
    return {h, b, changed:true};
  }

  // B) Board reorganisation to free a joker
  const breps = findBoardJokerReplacements(b);
  if (breps.length > 0) {
    // Prefer extract-direct (simplest), then board-swap, then extract-patch
    const order = ['extract-direct', 'board-swap', 'extract-patch'];
    const brep = breps.sort((a,z) => order.indexOf(a.type) - order.indexOf(z.type))[0];
    b = b.map(s => [...s]);

    if (brep.type === 'board-swap') {
      // Swap a board tile into joker slot; original tile's set shrinks
      b[brep.si][brep.ji] = brep.boardTile;
      b[brep.boardTileSi] = b[brep.boardTileSi].filter(t => t.id !== brep.boardTile.id);
      if (b[brep.boardTileSi].length === 0) b.splice(brep.boardTileSi, 1);
      else b[brep.boardTileSi] = sortSet(b[brep.boardTileSi]);
      h = [...h, brep.joker];
    } else if (brep.type === 'extract-patch') {
      // Remove joker from set, patch remaining tiles with a tile from another set
      b[brep.si] = sortSet(brep.patched);
      b[brep.patchTileSi] = b[brep.patchTileSi].filter(t => t.id !== brep.patchTile.id);
      if (b[brep.patchTileSi].length === 0) b.splice(brep.patchTileSi, 1);
      else b[brep.patchTileSi] = sortSet(b[brep.patchTileSi]);
      h = [...h, brep.joker];
    } else {
      // extract-direct: set stays valid without the joker
      b[brep.si] = sortSet(b[brep.si].filter((_,i) => i !== brep.ji));
      h = [...h, brep.joker];
    }

    steps.push({type:'board-joker-lib', desc:'Reorganise board to free ★'});
    return {h, b, changed:true};
  }

  // C) Split a board set with a hand tile
  for (const ht of h) {
    for (let si = 0; si < b.length; si++) {
      const splits = findSplitInserts(ht, b[si], si);
      if (splits.length > 0) {
        const sp = splits[0];
        h = h.filter(t => t.id !== ht.id);
        b = b.map(s => [...s]);
        b.splice(si, 1, sp.left, sp.right);
        steps.push({type:'split', desc:'Split set'});
        return {h, b, changed:true};
      }
    }
  }

  // D) Extend a board set with a hand tile
  const exts = findExtensions(h, b);
  if (exts.length > 0) {
    const ext = [...exts].sort((a,z) => z.val - a.val)[0];
    h = h.filter(t => t.id !== ext.tile.id);
    b = b.map(s => [...s]);
    if (ext.pos === 'start') b[ext.si] = sortSet([ext.tile, ...b[ext.si]]);
    else if (ext.pos === 'end') b[ext.si] = sortSet([...b[ext.si], ext.tile]);
    else b[ext.si] = sortSet([...b[ext.si].slice(0,ext.insertAt), ext.tile, ...b[ext.si].slice(ext.insertAt)]);
    steps.push({type:'extend', desc:`Extend with ${ext.tile.isJoker?'★':ext.tile.num}`});
    return {h, b, changed:true};
  }

  // E) Extract board tiles + hand tiles to form new group
  if (h.length > 0) {
    const extractions = findBoardExtractions(h, b);
    if (extractions.length > 0) {
      const ex = extractions[0];
      b = b.map(s => [...s]);
      // Remove extracted tiles from their board sets
      const removedSis = new Set();
      for (const {tile, si} of ex.boardExtracts) {
        b[si] = b[si].filter(t => t.id !== tile.id);
        removedSis.add(si);
      }
      // Sort modified sets; remove empty ones
      for (const si of [...removedSis].sort((a,z) => z-a)) {
        if (b[si].length === 0) b.splice(si, 1);
        else b[si] = sortSet(b[si]);
      }
      // Remove hand tiles used
      const usedHandIds = new Set(ex.handTiles.map(t => t.id));
      h = h.filter(t => !usedHandIds.has(t.id));
      // Add new set to board
      b.push(ex.newSet);
      steps.push({type:'extract-group', desc:ex.desc});
      return {h, b, changed:true};
    }
  }

  return {h, b, changed:false};
}

export function computeMoveSequence(hand, board, hasMeld) {
  let h = [...(hand||[])];
  let b = (board||[]).map(s => [...s]);
  const steps = [];

  // Phase 1: board manipulation + extensions (only after initial meld)
  if (hasMeld) {
    let iters = 0;
    let changed = true;
    while (changed && iters++ < 40) {
      const res = runOnePass(h, b, steps);
      h = res.h; b = res.b; changed = res.changed;
    }
  }

  // Phase 2: play best hand combo
  const combo = bestCombination(h);
  if (combo.count > 0 && (hasMeld || combo.value >= 30)) {
    for (const set of combo.sets) {
      h = h.filter(t => !set.some(s => s.id === t.id));
      b = [...b, sortSet(set)];
      steps.push({type:'new-set', desc:`Play ${set.length}-tile set`});
    }

    // Phase 3: try again after playing new sets (only post-meld)
    if (hasMeld) {
      iters = 0; changed = true;
      while (changed && iters++ < 20) {
        const res = runOnePass(h, b, steps);
        h = res.h; b = res.b; changed = res.changed;
      }
    }
  }

  return {steps, newHand:h, newBoard:b, moved:steps.length > 0};
}

// ── SMART HINTS ──
export function computeHints(hand, board, hasMeld) {
  const hints = [];
  const allUsedIds = new Set();

  // 1) Full best-move sequence
  const seq = computeMoveSequence(hand, board, hasMeld);
  const prevBoardIds = new Set((board||[]).flat().map(t => t.id));
  const seqTiles = (hand||[]).filter(t => !seq.newHand.some(h => h.id === t.id));
  if (seqTiles.length > 0) {
    const seqVal = seqTiles.reduce((s,t) => s + tileVal(t), 0);
    const newSets = seq.newBoard.filter(s => s.some(t => !prevBoardIds.has(t.id)));
    hints.push({
      type: hasMeld ? 'play' : 'initial',
      label: hasMeld ? 'BEST' : 'MELD',
      desc: `Play ${seqTiles.length} tile${seqTiles.length!==1?'s':''} — ${seqVal} pts`,
      sets: newSets.length ? newSets : [],
      exts:[], splits:[],
      value: seqVal, count: seqTiles.length,
      applicable: hasMeld || seqVal >= 30,
      isBestSequence: true,
      newHand: seq.newHand, newBoard: seq.newBoard,
    });
    seqTiles.forEach(t => allUsedIds.add(t.id));
  }

  // 2) Individual sets from best combo (if multiple)
  const combo = bestCombination(hand);
  if (combo.sets.length > 1) {
    for (const s of combo.sets) {
      const sv = s.reduce((acc,t) => acc + tileVal(t), 0);
      hints.push({
        type: hasMeld ? 'play' : 'initial', label: 'SET',
        desc: `Play ${s.length} tiles — ${sv} pts`,
        sets: [s], exts:[], splits:[],
        value: sv, count: s.length,
        applicable: hasMeld || sv >= 30,
      });
    }
  } else if (combo.sets.length === 1 && !seqTiles.length) {
    const s = combo.sets[0];
    const sv = s.reduce((acc,t) => acc + tileVal(t), 0);
    const canMeld = !hasMeld && sv >= 30;
    if (hasMeld || canMeld) {
      hints.push({
        type: hasMeld ? 'play' : 'initial', label: hasMeld ? 'PLAY' : 'MELD',
        desc: `Play ${s.length} tiles — ${sv} pts`,
        sets: [s], exts:[], splits:[],
        value: sv, count: s.length, applicable: true,
      });
      s.forEach(t => allUsedIds.add(t.id));
    } else if (!hasMeld) {
      hints.push({
        type:'no-meld', label:'NO MELD',
        desc:`Best is ${sv} pts — need ${30-sv} more`,
        sets:[s], exts:[], splits:[],
        value:sv, count:s.length, applicable:false,
      });
    }
  }

  if (hasMeld) {
    // 3) Joker liberation
    const jreps = findJokerReplacements(hand, board);
    for (const rep of jreps) {
      if (allUsedIds.has(rep.handTile.id)) continue;
      hints.push({
        type:'joker-lib', label:'JOKER',
        desc:`Replace ★ in set ${rep.si+1} with ${rep.handTile.num}(${rep.handTile.color})`,
        sets:[], exts:[], splits:[], jrep:rep,
        value:tileVal(rep.handTile)+30, count:1, applicable:true,
      });
    }

    // 4) Splits
    for (let si = 0; si < (board||[]).length; si++) {
      for (const ht of hand) {
        if (allUsedIds.has(ht.id)) continue;
        const splits = findSplitInserts(ht, board[si], si);
        for (const sp of splits) {
          hints.push({
            type:'split', label:'SPLIT',
            desc:`Insert ${ht.isJoker?'★':ht.num}(${ht.isJoker?'joker':ht.color}) to split set ${si+1}`,
            sets:[], exts:[], splits:[sp], value:tileVal(ht), count:1, applicable:true, tile:ht,
          });
        }
      }
    }

    // 5) Extensions
    const exts = findExtensions(hand, board);
    const byTile = {};
    for (const e of exts) {
      if (!byTile[e.tile.id]) byTile[e.tile.id] = [];
      byTile[e.tile.id].push(e);
    }
    for (const es of Object.values(byTile)) {
      const t = es[0].tile;
      if (allUsedIds.has(t.id)) continue;
      hints.push({
        type:'extend', label:'EXTEND',
        desc:`${t.isJoker?'★':t.num}(${t.isJoker?'joker':t.color}) → extend`,
        sets:[], exts:es, splits:[], value:tileVal(t), count:1, applicable:true, tile:t,
      });
    }

    // 6) Board+hand extractions (e.g. take 13s from runs to form a group)
    const extractions = findBoardExtractions(hand, board);
    for (const ex of extractions.slice(0, 3)) {
      const handIds = new Set(ex.handTiles.map(t => t.id));
      if (ex.handTiles.some(t => allUsedIds.has(t.id))) continue;
      hints.push({
        type:'extract-group', label:'COMBINE',
        desc:ex.desc,
        sets:[ex.newSet], exts:[], splits:[],
        value:ex.value, count:ex.newSet.length, applicable:true,
        boardExtracts:ex.boardExtracts, handTiles:ex.handTiles,
      });
    }
  }

  if (!hints.filter(h => h.applicable).length) {
    if (!combo.count && !hand.every(t => t.isJoker)) {
      hints.push({type:'no-meld', label:'NO MELD', desc:'No valid sets yet', sets:[], exts:[], splits:[], value:0, count:0, applicable:false});
    }
    hints.push({type:'draw', label:'DRAW', desc:'Draw a tile from pool', sets:[], exts:[], splits:[], value:0, count:0, applicable:false});
  }

  const typePri = {initial:0, play:0, 'joker-lib':1, split:2, extend:3, 'no-meld':4, draw:5};
  return hints.sort((a,b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (b.value !== a.value) return b.value - a.value;
    return (typePri[a.type]||9) - (typePri[b.type]||9);
  });
}

// ── AI PLAY ──
export function aiPlayTurn(hand, board, hasMeld) {
  const seq = computeMoveSequence(hand, board, hasMeld);
  if (seq.moved) {
    const meldAchieved = !hasMeld && seq.newHand.length < hand.length;
    return {newHand:seq.newHand, newBoard:seq.newBoard, moved:true, meldAchieved};
  }
  return {newHand:hand, newBoard:board, moved:false, meldAchieved:false};
}

// ── APPLY HINT ──
export function applyHint(hint, pendingHand, pendingBoard) {
  if (hint.newHand && hint.newBoard) {
    return {hand: hint.newHand, board: hint.newBoard};
  }
  let hand = [...pendingHand];
  let board = pendingBoard.map(s => [...s]);
  if (hint.sets && hint.sets.length > 0) {
    const ids = new Set(hint.sets.flat().map(t => t.id));
    hand = hand.filter(t => !ids.has(t.id));
    hint.sets.forEach(s => board.push(sortSet(s)));
  }
  if (hint.exts && hint.exts.length > 0) {
    const ext = hint.exts[0];
    hand = hand.filter(t => t.id !== ext.tile.id);
    if (ext.pos === 'start') board[ext.si] = sortSet([ext.tile, ...board[ext.si]]);
    else if (ext.pos === 'end') board[ext.si] = sortSet([...board[ext.si], ext.tile]);
    else board[ext.si] = sortSet([...board[ext.si].slice(0,ext.insertAt), ext.tile, ...board[ext.si].slice(ext.insertAt)]);
  }
  if (hint.jrep) {
    const {si, ji, handTile, joker} = hint.jrep;
    board[si][ji] = handTile;
    hand = hand.filter(t => t.id !== handTile.id);
    hand.push(joker);
  }
  if (hint.splits && hint.splits.length > 0) {
    const sp = hint.splits[0];
    const {si, left, right, tile} = sp;
    hand = hand.filter(t => t.id !== tile.id);
    board.splice(si, 1, left, right);
  }
  if (hint.boardExtracts && hint.boardExtracts.length > 0) {
    // Extract tiles from board sets and hand to form a new set
    const handIds = new Set((hint.handTiles||[]).map(t => t.id));
    hand = hand.filter(t => !handIds.has(t.id));
    // Remove board tiles - process in reverse index order to avoid shifting
    const bySi = {};
    for (const {tile, si} of hint.boardExtracts) {
      if (!bySi[si]) bySi[si] = [];
      bySi[si].push(tile.id);
    }
    for (const [siStr, ids] of Object.entries(bySi)) {
      const si = Number(siStr);
      const idSet = new Set(ids);
      board[si] = board[si].filter(t => !idSet.has(t.id));
    }
    // Remove empty sets (in reverse order)
    for (let i = board.length - 1; i >= 0; i--) {
      if (board[i].length === 0) board.splice(i, 1);
      else if (board[i].length < 3) board[i] = sortSet(board[i]); // keep but may be invalid
    }
    // Add the new combined set
    if (hint.sets && hint.sets.length > 0) {
      // Already in hint.sets from computeHints
    } else {
      board.push(sortSet([...(hint.handTiles||[]), ...(hint.boardExtracts||[]).map(e => e.tile)]));
    }
  }
  return {hand, board};
}
