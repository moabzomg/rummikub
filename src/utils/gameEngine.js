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
// Places jokers at their correct inferred positions within the set.
export function sortSet(tiles) {
  const norm = tiles.filter(t=>!t.isJoker);
  const jokers = tiles.filter(t=>t.isJoker);
  if (!norm.length) return tiles;
  const cols = [...new Set(norm.map(t=>t.color))];
  const nums = [...new Set(norm.map(t=>t.num))];

  // Detect: group = single unique number, run = single colour (or will be after joker fill)
  const isGroupSet = nums.length === 1;

  // ── RUN: assign jokers to gap positions ──
  if (!isGroupSet && cols.length === 1) {
    const sorted = [...norm].sort((a,b)=>a.num-b.num);
    const minNum = sorted[0].num;
    const maxNum = sorted[sorted.length-1].num;
    const totalLen = tiles.length; // norm + jokers must fill a contiguous run

    // Determine the run's actual start: the run spans totalLen consecutive values.
    // We try to find start such that all norm tiles fit in [start, start+totalLen-1]
    // and jokers fill the gaps. Prefer start = minNum if jokers cover the head gaps,
    // otherwise extend left.
    let runStart = minNum;
    const jokerCount = jokers.length;
    // How many jokers would be needed to reach minNum from start?
    // Gaps before minNum = minNum - runStart (0 if runStart===minNum)
    // Total span from runStart = totalLen → runEnd = runStart + totalLen - 1
    // Check if maxNum fits: maxNum <= runEnd
    // And gaps filled by jokers = totalLen - norm.length = jokerCount ✓ (always true if isRun passed)
    // Find the best start: if we can place jokers at beginning, do so.
    // Strategy: runStart = minNum if extra jokers go at end, else shift left.
    const gapsInMiddle = (maxNum - minNum + 1) - norm.length;
    const jokersForHead = jokerCount - gapsInMiddle;
    // Prefer trailing jokers (higher end) unless that exceeds 13, then push left
    const runEndIfTrailing = maxNum + jokersForHead;
    if (jokersForHead > 0 && runEndIfTrailing > 13) {
      runStart = Math.max(1, minNum - jokersForHead);
    } else {
      runStart = minNum; // surplus jokers trail at end
    }

    // Build a slot array for [runStart .. runStart+totalLen-1]
    const slots = [];
    for (let n = runStart; n < runStart + totalLen; n++) slots.push(n);

    // Fill slots: place norm tiles, jokers fill the rest in order
    const out = [];
    let ji = 0;
    for (const n of slots) {
      const normTile = norm.find(t => t.num === n);
      if (normTile) {
        out.push(normTile);
      } else {
        if (ji < jokers.length) out.push(jokers[ji++]);
      }
    }
    return out;
  }

  // ── GROUP: joker takes the missing color slot ──
  // In a group all tiles share the same number; place joker in color order
  const presentColors = new Set(norm.map(t=>t.color));
  const missingColors = COLORS.filter(c=>!presentColors.has(c));
  // Build sorted list of all color slots occupied by this group
  const colorSlots = [...norm].sort((a,b)=>(COLOR_ORDER[a.color]||0)-(COLOR_ORDER[b.color]||0));
  // Insert jokers into missing color positions in color order
  let ji = 0;
  const result = [];
  let ni = 0;
  for (const c of COLORS) {
    if (presentColors.has(c)) {
      result.push(colorSlots[ni++]);
    } else if (ji < jokers.length && missingColors.includes(c)) {
      result.push(jokers[ji++]);
    }
  }
  // If any norm tiles weren't placed (shouldn't happen), append them
  while (ni < colorSlots.length) result.push(colorSlots[ni++]);
  while (ji < jokers.length) result.push(jokers[ji++]);
  return result;
}

// ── SORT HAND ──
// Returns { tiles: Tile[], playableCount: number, sets: Tile[][] }
// Playable sets come first (each set kept together), then remaining tiles sorted by mode.
export function sortHand(hand, mode) {
  const combo = bestCombination(hand);
  const setGroups = combo.sets; // each element is one valid set (no tile appears twice across sets)
  const usedIds = new Set(setGroups.flat().map(t=>t.id));
  const remaining = hand.filter(t=>!usedIds.has(t.id));

  // Sort each set internally into correct order
  const sortedGroups = setGroups.map(s => sortSet(s));
  const playableFlat = sortedGroups.flat();

  // Sort remaining tiles by user preference
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

  return {
    tiles: [...playableFlat, ...sortedRest],
    playableCount: playableFlat.length,
    sets: sortedGroups,        // each set as its own array, in display order
  };
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
// Bounded: cap tiles considered at 16 to prevent exponential blowup
export function findAllSets(tiles) {
  const capped = tiles.slice(0, 16);
  const result = [];
  // Build runs: group by color, find consecutive number sequences
  const byColor = {};
  for (const t of capped) {
    if (t.isJoker) continue;
    if (!byColor[t.color]) byColor[t.color] = [];
    byColor[t.color].push(t);
  }
  const jokers = capped.filter(t => t.isJoker);

  // Generate runs for each color
  for (const [, colorTiles] of Object.entries(byColor)) {
    const sorted = [...colorTiles].sort((a,b) => a.num - b.num);
    // Try all windows of 3+ consecutive tiles (with joker fills)
    for (let start = 0; start < sorted.length; start++) {
      let run = [sorted[start]];
      let ji = 0; // jokers used
      for (let end = start+1; end < sorted.length; end++) {
        const prev = run[run.length - 1];
        const gap = sorted[end].num - (prev.isJoker ? sorted[end].num - 1 : prev.num) - 1;
        if (gap < 0) continue; // duplicate number — skip
        if (gap > jokers.length - ji) break; // too many gaps
        // Fill gap with jokers
        for (let g = 0; g < gap; g++) run.push(jokers[ji++]);
        run.push(sorted[end]);
        if (run.length >= 3) result.push([...run]);
        if (run.length >= 13) break;
      }
      // Also try joker at start
      if (jokers.length > 0) {
        // joker prefix: ★, sorted[start], sorted[start+1]...
        for (let end = start; end < sorted.length - 1; end++) {
          const r2 = [jokers[0], sorted[end], sorted[end+1]];
          if (sorted[end+1].num === sorted[end].num + 1 && r2.length >= 3 && isRun(r2)) result.push([...r2]);
        }
      }
    }
  }

  // Generate groups: tiles with same number, different colors (3-4 tiles)
  const byNum = {};
  for (const t of capped) {
    if (t.isJoker) continue;
    if (!byNum[t.num]) byNum[t.num] = [];
    byNum[t.num].push(t);
  }
  for (const [, numTiles] of Object.entries(byNum)) {
    const unique = [];
    const seenC = new Set();
    for (const t of numTiles) { if (!seenC.has(t.color)) { seenC.add(t.color); unique.push(t); } }
    if (unique.length >= 3) {
      result.push(unique.slice(0, 3));
      if (unique.length >= 4) result.push(unique.slice(0, 4));
    }
    // With joker
    if (jokers.length > 0 && unique.length >= 2) {
      const withJ = [...unique.slice(0, 2), jokers[0]];
      if (isGroup(withJ)) result.push(withJ);
      if (unique.length >= 3) {
        const withJ2 = [...unique.slice(0, 3), jokers[0]];
        if (isGroup(withJ2)) result.push(withJ2);
      }
    }
  }

  // Dedup by sorted id key
  const seen = new Set();
  return result.filter(s => {
    const k = s.map(t=>t.id).sort().join(',');
    if (seen.has(k)) return false; seen.add(k); return true;
  });
}

// ── BEST COMBINATION ──
// Greedy + limited backtrack: fast enough for 14-tile hands
export function bestCombination(tiles) {
  const allSets = findAllSets(tiles);
  if (!allSets.length) return {sets:[], count:0, value:0};

  // Sort sets: longer first, then higher value
  const sorted = [...allSets].sort((a,b) =>
    b.length !== a.length ? b.length - a.length
    : b.reduce((s,t)=>s+tileVal(t),0) - a.reduce((s,t)=>s+tileVal(t),0)
  );

  let bestSets=[], bestCount=0, bestValue=0;
  const LIMIT = 2000; // max iterations to prevent freeze
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
  return {sets:bestSets, count:bestCount, value:bestValue};
}

// ── BOARD EXTENSIONS ──
export function findExtensions(hand, board) {
  const results = [];
  for (let si=0;si<board.length;si++) {
    const set = board[si];
    for (const t of hand) {
      if (isValid([t,...set])) results.push({si, pos:'start', tile:t, val:tileVal(t)});
      if (isValid([...set,t])) results.push({si, pos:'end', tile:t, val:tileVal(t)});
      if (isRun(set) && !t.isJoker) {
        for (let i=1;i<set.length;i++) {
          const trial=[...set.slice(0,i),t,...set.slice(i)];
          if (isValid(trial)) results.push({si, pos:'insert', insertAt:i, tile:t, val:tileVal(t)});
        }
      }
      // Joker can be placed anywhere in a run or as wildcard in group
      if (t.isJoker) {
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
export function findSplitInserts(tile, set) {
  const results = [];
  if (!isRun(set)) return results;
  const norm = set.filter(t=>!t.isJoker);
  const cols = [...new Set(norm.map(t=>t.color))];
  if (cols.length !== 1) return results;
  // Joker can be used as wildcard for splitting
  if (!tile.isJoker && tile.color !== cols[0]) return results;
  for (let i=0;i<=set.length;i++) {
    const trial = [...set.slice(0,i), tile, ...set.slice(i)];
    for (let s=1;s<trial.length-1;s++) {
      const tileIdx = trial.indexOf(tile, 0);
      if (tileIdx < 0) continue;
      const left = trial.slice(0,s+1);
      const right = trial.slice(s);
      if (!left.some(t=>t.id===tile.id)) continue;
      if (!right.some(t=>t.id===tile.id)) continue;
      if (left.length>=3 && right.length>=3 && isValid(left) && isValid(right)) {
        results.push({insertPos:i, splitPos:s, left:sortSet(left), right:sortSet(right)});
      }
    }
  }
  return results;
}

// ── SMART HINTS ──
export function computeHints(hand, board, hasMeld) {
  const hints = [];
  const allUsedIds = new Set();

  // 1) Best pure hand combo — emit MELD ALL + each individual set
  const combo = bestCombination(hand);
  if (combo.count > 0) {
    const canMeld = !hasMeld && combo.value >= 30;

    if (combo.sets.length > 0 && (hasMeld || canMeld)) {
      // BEST / MELD ALL hint
      hints.push({
        type: hasMeld ? 'play' : 'initial',
        label: hasMeld ? 'BEST' : 'MELD',
        desc: `Play all ${combo.count} tiles across ${combo.sets.length} set(s) — ${combo.value} pts`,
        sets: combo.sets, exts:[], splits:[],
        value: combo.value, count: combo.count, applicable: true,
        isMultiSet: combo.sets.length > 1,
      });
      combo.sets.flat().forEach(t=>allUsedIds.add(t.id));

      // Also emit each individual set as its own one-click hint
      if (combo.sets.length > 1) {
        for (const s of combo.sets) {
          const sv = s.reduce((acc,t)=>acc+tileVal(t),0);
          hints.push({
            type: hasMeld ? 'play' : 'initial',
            label: hasMeld ? 'SET' : 'SET',
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
      desc:'No valid sets in hand yet — try extending the board',
      sets:[], exts:[], splits:[], value:0, count:0, applicable:false
    });
  }

  if (hasMeld) {
    // 2) Board extensions
    const exts = findExtensions(hand, board);
    const byTile = {};
    for (const e of exts) {
      const k = e.tile.id;
      if (!byTile[k]) byTile[k]=[];
      byTile[k].push(e);
    }
    for (const [, es] of Object.entries(byTile)) {
      const t = es[0].tile;
      if (allUsedIds.has(t.id)) continue;
      hints.push({
        type:'extend', label:'EXTEND',
        desc:`${t.isJoker?'★':t.num} (${t.isJoker?'joker':t.color}) → extend ${es.length} set(s)`,
        sets:[], exts:es, splits:[], value:tileVal(t), count:1, applicable:true, tile:t
      });
    }

    // 3) Joker liberation
    const jreps = findJokerReplacements(hand, board);
    for (const rep of jreps) {
      if (allUsedIds.has(rep.handTile.id)) continue;
      hints.push({
        type:'joker-lib', label:'JOKER',
        desc:`Replace ★ in set ${rep.si+1} with ${rep.handTile.num}(${rep.handTile.color}) — free the joker!`,
        sets:[], exts:[], splits:[], jrep:rep, value:tileVal(rep.handTile)+30, count:1, applicable:true
      });
    }

    // 4) Split hints
    for (let si=0;si<board.length;si++) {
      const set = board[si];
      for (const ht of hand) {
        if (allUsedIds.has(ht.id)) continue;
        const splits = findSplitInserts(ht, set);
        for (const sp of splits) {
          hints.push({
            type:'split', label:'SPLIT',
            desc:`Insert ${ht.isJoker?'★':ht.num}(${ht.isJoker?'joker':ht.color}) to split set ${si+1} into 2 valid sets`,
            sets:[], exts:[], splits:[{si, ...sp, tile:ht}], value:tileVal(ht), count:1, applicable:true, tile:ht
          });
        }
      }
    }
  }

  if (hints.filter(h=>h.applicable).length === 0) {
    hints.push({
      type:'draw', label:'DRAW',
      desc:'No playable moves — draw a tile from the pool',
      sets:[], exts:[], splits:[], value:0, count:0, applicable:false
    });
  }

  const typePri = {initial:0,play:0,extend:1,'joker-lib':2,split:3,'no-meld':4,draw:5};
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

  // Step 1: Replace jokers on board
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

  // Step 2: Extend board sets
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

  // Step 3: Play best combo from hand
  const combo = bestCombination(h);
  if (combo.count > 0) {
    const v = combo.value;
    if (!hasMeld && v < 30) {
      // Can't meld yet
    } else {
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

  if (hint.sets.length>0) {
    const ids=new Set(hint.sets.flat().map(t=>t.id));
    hand=hand.filter(t=>!ids.has(t.id));
    hint.sets.forEach(s=>board.push(sortSet(s)));
  }
  if (hint.exts&&hint.exts.length>0) {
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
  if (hint.splits&&hint.splits.length>0) {
    const sp=hint.splits[0];
    const {si,left,right,tile}=sp;
    hand=hand.filter(t=>t.id!==tile.id);
    board.splice(si,1,left,right);
  }

  return {hand, board};
}
