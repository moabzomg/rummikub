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
  for (let i=tiles.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [tiles[i],tiles[j]]=[tiles[j],tiles[i]];
  }
  return tiles;
}

export function tileVal(t) { return t.isJoker ? 30 : t.num; }
export function handVal(h) { return h.reduce((s,t)=>s+tileVal(t),0); }

// ── VALIDATION ──
export function isRun(tiles) {
  if (tiles.length < 3) return false;
  const norm = tiles.filter(t=>!t.isJoker);
  if (!norm.length) return false;
  const colors = [...new Set(norm.map(t=>t.color))];
  if (colors.length !== 1) return false;
  const nums = norm.map(t=>t.num).sort((a,b)=>a-b);
  const min=nums[0], max=nums[nums.length-1];
  if (max-min+1 > 13) return false;
  const seen=new Set();
  for (const n of nums) { if(seen.has(n)) return false; seen.add(n); }
  const jokers = tiles.length - norm.length;
  const gaps = (max-min+1) - norm.length;
  return jokers >= gaps;
}

export function isGroup(tiles) {
  if (tiles.length < 3 || tiles.length > 4) return false;
  const norm = tiles.filter(t=>!t.isJoker);
  if (!norm.length) return false;
  const nums = [...new Set(norm.map(t=>t.num))];
  if (nums.length !== 1) return false;
  const cols = norm.map(t=>t.color);
  return new Set(cols).size === cols.length;
}

export function isValid(tiles) { return tiles.length>=3 && (isRun(tiles)||isGroup(tiles)); }
export function isValidBoard(sets) { return sets.every(s=>isValid(s)); }

// ── SORT SET ──
export function sortSet(tiles) {
  const norm = tiles.filter(t=>!t.isJoker);
  const jokers = tiles.filter(t=>t.isJoker);
  if (!norm.length) return tiles;
  const cols = [...new Set(norm.map(t=>t.color))];
  const nums = [...new Set(norm.map(t=>t.num))];
  const isGroupSet = nums.length === 1;

  if (!isGroupSet && cols.length === 1) {
    const sorted = [...norm].sort((a,b)=>a.num-b.num);
    const minNum = sorted[0].num;
    const maxNum = sorted[sorted.length-1].num;
    const totalLen = tiles.length;
    const jokerCount = jokers.length;
    const gapsInMiddle = (maxNum - minNum + 1) - norm.length;
    const jokersForHead = jokerCount - gapsInMiddle;
    const runEndIfTrailing = maxNum + jokersForHead;
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

  // GROUP
  const presentColors = new Set(norm.map(t=>t.color));
  const missingColors = COLORS.filter(c=>!presentColors.has(c));
  const colorSlots = [...norm].sort((a,b)=>(COLOR_ORDER[a.color]||0)-(COLOR_ORDER[b.color]||0));
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

// ── SORT HAND ──
export function sortHand(hand, mode) {
  const safeHand = (hand || []).filter(t => t && t.id !== undefined);
  const combo = bestCombination(safeHand);
  const setGroups = combo.sets.map(s => s.filter(t => t && t.id !== undefined));
  const usedIds = new Set(setGroups.flat().map(t=>t.id));
  const remaining = hand.filter(t=>!usedIds.has(t.id));
  const sortedGroups = setGroups.map(s => sortSet(s));
  const playableFlat = sortedGroups.flat();
  const sortedRest = [...remaining].sort((a,b) => {
    if (a.isJoker && b.isJoker) return 0;
    if (a.isJoker) return 1;
    if (b.isJoker) return -1;
    if (mode === 'color') {
      const cd = (COLOR_ORDER[a.color]||0)-(COLOR_ORDER[b.color]||0);
      return cd !== 0 ? cd : a.num-b.num;
    }
    return a.num !== b.num ? a.num-b.num : (COLOR_ORDER[a.color]||0)-(COLOR_ORDER[b.color]||0);
  });
  return { tiles: [...playableFlat, ...sortedRest], playableCount: playableFlat.length, sets: sortedGroups };
}

// ── JOKER INFERENCE ──
export function inferJokerValue(set, jokerIdx) {
  const norm = set.filter(t=>!t.isJoker);
  if (!norm.length) return null;
  const cols = [...new Set(norm.map(t=>t.color))];
  if (cols.length === 1) {
    const nonJokerTiles = set.filter(t=>!t.isJoker).sort((a,b)=>a.num-b.num);
    const min = nonJokerTiles[0].num;
    const fullRange = [];
    for (let n=min;n<=min+set.length-1;n++) fullRange.push(n);
    const usedNums = new Set(nonJokerTiles.map(t=>t.num));
    const gaps = fullRange.filter(n=>!usedNums.has(n));
    const jokerIdxs = set.map((t,i)=>t.isJoker?i:-1).filter(i=>i>=0);
    const ji2 = jokerIdxs.indexOf(jokerIdx);
    return gaps[ji2] !== undefined ? gaps[ji2] : null;
  } else {
    return norm[0].num;
  }
}

export function inferJokerColor(set, jokerIdx) {
  const norm = set.filter(t=>!t.isJoker);
  if (!norm.length) return null;
  const cols = [...new Set(norm.map(t=>t.color))];
  if (cols.length === 1) return cols[0];
  return null;
}

// ── JOKER REPLACEMENTS ──
// Returns all ways a hand tile can replace a joker on the board,
// with the joker freed for reuse in a new set.
export function findJokerReplacements(hand, board) {
  const results = [];
  for (let si=0;si<board.length;si++) {
    const set = board[si];
    const jokerIdxs = set.map((t,i)=>t.isJoker?i:-1).filter(i=>i>=0);
    for (const ji of jokerIdxs) {
      const jokerNum = inferJokerValue(set, ji);
      const jokerColor = inferJokerColor(set, ji);
      if (jokerNum === null) continue;
      for (const ht of hand) {
        if (ht.isJoker) continue;
        if (ht.num === jokerNum && (jokerColor === null || ht.color === jokerColor)) {
          const newSet = [...set];
          newSet[ji] = ht;
          if (isValid(newSet)) {
            results.push({si, ji, handTile:ht, joker:set[ji]});
          }
        }
      }
    }
  }
  return results;
}

// ── SET FINDER ──
// Safe version: never produces undefined tiles, correctly handles jokers
export function findAllSets(tiles) {
  const capped = tiles.filter(t => t && t.id !== undefined).slice(0, 16);
  const result = [];
  const jokers = capped.filter(t => t.isJoker);
  const normals = capped.filter(t => !t.isJoker);

  // ── RUNS: group normals by color, find consecutive windows ──
  const byColor = {};
  for (const t of normals) {
    if (!byColor[t.color]) byColor[t.color] = [];
    byColor[t.color].push(t);
  }

  for (const colorTiles of Object.values(byColor)) {
    // Sort and deduplicate by number (keep first occurrence)
    const sorted = [];
    const seenN = new Set();
    for (const t of [...colorTiles].sort((a,b) => a.num - b.num)) {
      if (!seenN.has(t.num)) { seenN.add(t.num); sorted.push(t); }
    }

    // Sliding window: try every starting tile, extend with gap-filling jokers
    for (let s = 0; s < sorted.length; s++) {
      const run = [sorted[s]];
      let jokersUsed = 0;
      let lastNum = sorted[s].num;

      for (let e = s + 1; e < sorted.length; e++) {
        const gap = sorted[e].num - lastNum - 1; // gaps between lastNum and next tile
        if (gap < 0) continue; // duplicate num (shouldn't happen after dedup)
        if (jokersUsed + gap > jokers.length) break; // not enough jokers to fill
        // Fill gap with jokers
        for (let g = 0; g < gap; g++) {
          run.push(jokers[jokersUsed]);
          jokersUsed++;
        }
        run.push(sorted[e]);
        lastNum = sorted[e].num;
        if (run.length >= 3) result.push([...run]);
        if (run.length >= 13) break;
      }

      // Also try: joker at the START of a run (★, sorted[s], sorted[s+1], ...)
      if (jokers.length > 0 && s + 1 < sorted.length) {
        const gap01 = sorted[s+1] ? sorted[s+1].num - sorted[s].num - 1 : 99;
        if (gap01 === 0) {
          // ★ prepended, rest is consecutive
          const r = [jokers[0], sorted[s], sorted[s+1]];
          if (isRun(r)) result.push(r);
          // extend further
          for (let e = s + 2; e < sorted.length; e++) {
            const ext = [...r, sorted[e]];
            if (isRun(ext)) result.push(ext); else break;
          }
        }
      }
    }
  }

  // ── GROUPS: tiles with same number, different colors ──
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
    // Groups with joker filling missing color slot
    if (jokers.length > 0) {
      if (unique.length === 2) {
        const g = [...unique, jokers[0]];
        if (isGroup(g)) result.push(g);
      } else if (unique.length === 3) {
        const g = [...unique, jokers[0]];
        if (isGroup(g)) result.push(g);
      }
    }
  }

  // ── DEDUPLICATE by sorted tile ids ──
  const seen = new Set();
  return result.filter(s => {
    if (!s || s.some(t => !t || t.id === undefined)) return false; // safety guard
    const k = s.map(t => t.id).sort().join(',');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ── BEST COMBINATION ──
export function bestCombination(tiles) {
  const safeTiles = (tiles || []).filter(t => t && t.id !== undefined);
  const allSets = findAllSets(safeTiles);
  if (!allSets.length) return {sets:[], count:0, value:0};
  const sorted = [...allSets].sort((a,b) =>
    b.length !== a.length ? b.length - a.length
    : b.reduce((s,t)=>s+tileVal(t),0) - a.reduce((s,t)=>s+tileVal(t),0)
  );
  let bestSets=[], bestCount=0, bestValue=0;
  const LIMIT = 2000;
  let iters = 0;
  function bt(idx, chosen, usedIds) {
    if (++iters > LIMIT) return;
    const c = usedIds.size;
    const v = chosen.flat().reduce((s,t)=>s+tileVal(t),0);
    if (c > bestCount || (c===bestCount && v>bestValue)) {
      bestCount=c; bestValue=v; bestSets=chosen.map(s=>[...s]);
    }
    for (let i=idx; i<sorted.length; i++) {
      if (iters > LIMIT) break;
      const set = sorted[i];
      if (set.some(t=>usedIds.has(t.id))) continue;
      const nu = new Set([...usedIds,...set.map(t=>t.id)]);
      bt(i+1,[...chosen,set],nu);
    }
  }
  bt(0,[],new Set());
  // Final safety: strip any undefined tiles from returned sets
  const cleanSets = bestSets.map(s => s.filter(t => t && t.id !== undefined)).filter(s => s.length >= 3);
  return {sets:cleanSets, count:cleanSets.flat().length, value:cleanSets.flat().reduce((s,t)=>s+tileVal(t),0)};
}

// ── BOARD EXTENSIONS ──
export function findExtensions(hand, board) {
  const results = [];
  for (let si=0;si<board.length;si++) {
    const set = board[si];
    for (const t of hand) {
      if (isValid([t,...set])) results.push({si, pos:'start', tile:t, val:tileVal(t)});
      if (isValid([...set,t])) results.push({si, pos:'end', tile:t, val:tileVal(t)});
      if (isRun(set)) {
        for (let i=1;i<set.length;i++) {
          const trial=[...set.slice(0,i),t,...set.slice(i)];
          if (isValid(trial)) results.push({si, pos:'insert', insertAt:i, tile:t, val:tileVal(t)});
        }
      }
    }
  }
  return results;
}

// ── SPLIT SETS ──
// Returns ways to insert a hand tile into a board set to produce two valid sets.
export function findSplitInserts(tile, set, setIdx) {
  const results = [];
  if (set.length < 6) return results; // need at least 3+3 after split
  if (!isRun(set) && !isGroup(set)) return results;

  if (isRun(set)) {
    const norm = set.filter(t=>!t.isJoker);
    const cols = [...new Set(norm.map(t=>t.color))];
    if (cols.length !== 1) return results;
    if (!tile.isJoker && tile.color !== cols[0]) return results;

    // Try inserting the tile at every position, then splitting at every cut
    for (let insertAt = 0; insertAt <= set.length; insertAt++) {
      const trial = [...set.slice(0,insertAt), tile, ...set.slice(insertAt)];
      for (let cut = 2; cut < trial.length - 2; cut++) {
        const left = trial.slice(0, cut + 1);
        const right = trial.slice(cut);
        // tile must appear in exactly one part (or can appear in both only if it's joker bridging)
        const tileInLeft = left.some(t=>t.id===tile.id);
        const tileInRight = right.some(t=>t.id===tile.id);
        if (!tileInLeft && !tileInRight) continue;
        if (tileInLeft && tileInRight) continue; // same tile can't be in both
        if (left.length>=3 && right.length>=3 && isValid(left) && isValid(right)) {
          results.push({ si: setIdx, insertAt, cut, left: sortSet(left), right: sortSet(right), tile });
        }
      }
    }
  }

  if (isGroup(set) && set.length === 4) {
    // Split 4-group: remove one tile and insert hand tile to form two 3-groups
    // (only possible if tile has same number and a new colour not in set)
    if (!tile.isJoker) {
      const norm = set.filter(t=>!t.isJoker);
      const num = norm[0].num;
      if (tile.num === num) {
        const presentColors = new Set(norm.map(t=>t.color));
        if (!presentColors.has(tile.color)) {
          // Can't actually split a 4-group into 3+3 by insertion; skip
        }
      }
    }
  }

  // Dedup
  const seen = new Set();
  return results.filter(r => {
    const k = r.left.map(t=>t.id).join(',')+'|'+r.right.map(t=>t.id).join(',');
    if (seen.has(k)) return false; seen.add(k); return true;
  });
}

// ── SMART HINTS ──
export function computeHints(hand, board, hasMeld) {
  const hints = [];
  const allUsedIds = new Set();

  // 1) Best pure hand combo
  const combo = bestCombination(hand);
  if (combo.count > 0) {
    const canMeld = !hasMeld && combo.value >= 30;
    if (combo.sets.length > 0 && (hasMeld || canMeld)) {
      hints.push({
        type: hasMeld ? 'play' : 'initial',
        label: hasMeld ? 'BEST' : 'MELD',
        desc: `Play all ${combo.count} tiles across ${combo.sets.length} set(s) — ${combo.value} pts`,
        sets: combo.sets, exts:[], splits:[],
        value: combo.value, count: combo.count, applicable: true,
        isMultiSet: combo.sets.length > 1,
      });
      combo.sets.flat().forEach(t=>allUsedIds.add(t.id));
      if (combo.sets.length > 1) {
        for (const s of combo.sets) {
          const sv = s.reduce((acc,t)=>acc+tileVal(t),0);
          hints.push({
            type: hasMeld ? 'play' : 'initial',
            label: 'SET',
            desc: `Play ${s.length} tiles — ${sv} pts`,
            sets: [s], exts:[], splits:[],
            value: sv, count: s.length, applicable: true,
          });
        }
      }
    } else if (!hasMeld && !canMeld) {
      hints.push({
        type:'no-meld', label:'NO MELD',
        desc:`Best combo is ${combo.value} pts — need ${30-combo.value} more for initial meld`,
        sets: combo.sets, exts:[], splits:[],
        value: combo.value, count: combo.count, applicable: false
      });
    }
  } else if (!hand.every(t=>t.isJoker)) {
    hints.push({
      type:'no-meld', label:'NO MELD',
      desc:'No valid sets in hand yet',
      sets:[], exts:[], splits:[], value:0, count:0, applicable:false
    });
  }

  if (hasMeld) {
    // 2) Joker liberation (replace joker on board with hand tile, free joker)
    const jreps = findJokerReplacements(hand, board);
    for (const rep of jreps) {
      if (allUsedIds.has(rep.handTile.id)) continue;
      hints.push({
        type:'joker-lib', label:'JOKER',
        desc:`Replace ★ in set ${rep.si+1} with ${rep.handTile.num}(${rep.handTile.color}) — free the joker!`,
        sets:[], exts:[], splits:[], jrep:rep, value:tileVal(rep.handTile)+30, count:1, applicable:true
      });
    }

    // 3) Split board sets to insert a hand tile
    for (let si=0;si<board.length;si++) {
      const set = board[si];
      for (const ht of hand) {
        if (allUsedIds.has(ht.id)) continue;
        const splits = findSplitInserts(ht, set, si);
        for (const sp of splits) {
          hints.push({
            type:'split', label:'SPLIT',
            desc:`Insert ${ht.isJoker?'★':ht.num}(${ht.isJoker?'joker':ht.color}) to split set ${si+1}`,
            sets:[], exts:[], splits:[sp], value:tileVal(ht), count:1, applicable:true, tile:ht
          });
        }
      }
    }

    // 4) Extend board sets
    const exts = findExtensions(hand, board);
    const byTile = {};
    for (const e of exts) {
      if (!byTile[e.tile.id]) byTile[e.tile.id]=[];
      byTile[e.tile.id].push(e);
    }
    for (const [, es] of Object.entries(byTile)) {
      const t = es[0].tile;
      if (allUsedIds.has(t.id)) continue;
      hints.push({
        type:'extend', label:'EXTEND',
        desc:`${t.isJoker?'★':t.num}(${t.isJoker?'joker':t.color}) → extend set`,
        sets:[], exts:es, splits:[], value:tileVal(t), count:1, applicable:true, tile:t
      });
    }
  }

  if (hints.filter(h=>h.applicable).length === 0) {
    hints.push({
      type:'draw', label:'DRAW',
      desc:'No playable moves — draw a tile from the pool',
      sets:[], exts:[], splits:[], value:0, count:0, applicable:false
    });
  }

  const typePri = {initial:0,play:0,'joker-lib':1,split:2,extend:3,'no-meld':4,draw:5};
  return hints.sort((a,b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (b.value !== a.value) return b.value - a.value;
    return (typePri[a.type]||9) - (typePri[b.type]||9);
  });
}

// ── AI PLAY ──
export function aiPlayTurn(hand, board, hasMeld) {
  let h = [...hand];
  let b = board.map(s=>[...s]);
  let moved = false;

  // Step 1: Replace jokers on board with hand tiles, freeing jokers for new sets
  let improved = true;
  while (improved) {
    improved = false;
    const reps = findJokerReplacements(h, b);
    if (reps.length > 0) {
      const rep = reps[0];
      b[rep.si][rep.ji] = rep.handTile;
      h = h.filter(t=>t.id !== rep.handTile.id);
      h.push(rep.joker);
      improved = true; moved = true;
    }
  }

  // Step 2: Try splitting board sets to place hand tiles
  improved = true;
  while (improved) {
    improved = false;
    for (const ht of h) {
      let found = false;
      for (let si=0; si<b.length; si++) {
        const splits = findSplitInserts(ht, b[si], si);
        if (splits.length > 0) {
          const sp = splits[0];
          h = h.filter(t=>t.id !== ht.id);
          b.splice(si, 1, sp.left, sp.right);
          improved = true; moved = true; found = true;
          break;
        }
      }
      if (found) break;
    }
  }

  // Step 3: Extend board sets with hand tiles
  improved = true;
  while (improved) {
    improved = false;
    const exts = findExtensions(h, b);
    if (exts.length > 0) {
      const ext = exts[0];
      h = h.filter(t=>t.id !== ext.tile.id);
      if (ext.pos === 'start') b[ext.si] = sortSet([ext.tile,...b[ext.si]]);
      else if (ext.pos === 'end') b[ext.si] = sortSet([...b[ext.si],ext.tile]);
      else b[ext.si] = sortSet([...b[ext.si].slice(0,ext.insertAt),ext.tile,...b[ext.si].slice(ext.insertAt)]);
      improved = true; moved = true;
    }
  }

  // Step 4: Play best combo from hand
  const combo = bestCombination(h);
  if (combo.count > 0) {
    const v = combo.value;
    if (hasMeld || v >= 30) {
      const usedIds = new Set(combo.sets.flat().map(t=>t.id));
      h = h.filter(t=>!usedIds.has(t.id));
      for (const set of combo.sets) b.push(sortSet(set));
      moved = true;
      const meldAchieved = !hasMeld && v >= 30;
      return {newHand:h, newBoard:b, moved:true, meldAchieved};
    }
  }

  return {newHand:h, newBoard:b, moved, meldAchieved:false};
}

// ── APPLY HINT ──
export function applyHint(hint, pendingHand, pendingBoard) {
  let hand = [...pendingHand];
  let board = pendingBoard.map(s=>[...s]);

  if (hint.sets && hint.sets.length>0) {
    const ids=new Set(hint.sets.flat().map(t=>t.id));
    hand=hand.filter(t=>!ids.has(t.id));
    hint.sets.forEach(s=>board.push(sortSet(s)));
  }
  if (hint.exts && hint.exts.length>0) {
    const ext=hint.exts[0];
    hand=hand.filter(t=>t.id!==ext.tile.id);
    if (ext.pos==='start') board[ext.si]=sortSet([ext.tile,...board[ext.si]]);
    else if (ext.pos==='end') board[ext.si]=sortSet([...board[ext.si],ext.tile]);
    else board[ext.si]=sortSet([...board[ext.si].slice(0,ext.insertAt),ext.tile,...board[ext.si].slice(ext.insertAt)]);
  }
  if (hint.jrep) {
    const {si,ji,handTile,joker}=hint.jrep;
    board[si][ji]=handTile;
    hand=hand.filter(t=>t.id!==handTile.id);
    hand.push(joker);
  }
  if (hint.splits && hint.splits.length>0) {
    const sp=hint.splits[0];
    const {si,left,right,tile}=sp;
    hand=hand.filter(t=>t.id!==tile.id);
    board.splice(si,1,left,right);
  }

  return {hand, board};
}
