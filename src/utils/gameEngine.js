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

export function tileVal(t) { return t && t.isJoker ? 30 : (t ? t.num : 0); }
export function handVal(h) { return (h||[]).reduce((s,t)=>s+tileVal(t),0); }

// ── VALIDATION ──
export function isRun(tiles) {
  if (!tiles || tiles.length < 3) return false;
  const norm = tiles.filter(t=>t&&!t.isJoker);
  if (!norm.length) return false;
  const colors = [...new Set(norm.map(t=>t.color))];
  if (colors.length !== 1) return false;
  const nums = norm.map(t=>t.num).sort((a,b)=>a-b);
  const min=nums[0], max=nums[nums.length-1];
  if (max-min+1 > 13) return false;
  const seen=new Set();
  for (const n of nums) { if(seen.has(n)) return false; seen.add(n); }
  const jokers = tiles.length - norm.length;
  return jokers >= (max-min+1) - norm.length;
}

export function isGroup(tiles) {
  if (!tiles || tiles.length < 3 || tiles.length > 4) return false;
  const norm = tiles.filter(t=>t&&!t.isJoker);
  if (!norm.length) return false;
  const nums = [...new Set(norm.map(t=>t.num))];
  if (nums.length !== 1) return false;
  const cols = norm.map(t=>t.color);
  return new Set(cols).size === cols.length;
}

export function isValid(tiles) { return tiles&&tiles.length>=3&&(isRun(tiles)||isGroup(tiles)); }
export function isValidBoard(sets) { return (sets||[]).every(s=>isValid(s)); }

// ── SORT SET ──
export function sortSet(tiles) {
  const safe = (tiles||[]).filter(t=>t&&t.id!==undefined);
  const norm = safe.filter(t=>!t.isJoker);
  const jokers = safe.filter(t=>t.isJoker);
  if (!norm.length) return safe;
  const cols = [...new Set(norm.map(t=>t.color))];
  const nums = [...new Set(norm.map(t=>t.num))];
  const isGroupSet = nums.length === 1;

  if (!isGroupSet && cols.length === 1) {
    const sorted = [...norm].sort((a,b)=>a.num-b.num);
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

  // GROUP: place joker in its inferred color slot
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

// ── FIND ALL SETS (safe, crash-proof) ──
export function findAllSets(tiles) {
  const capped = (tiles||[]).filter(t=>t&&t.id!==undefined).slice(0,16);
  const result = [];
  const jokers = capped.filter(t=>t.isJoker);
  const normals = capped.filter(t=>!t.isJoker);

  // RUNS by color
  const byColor = {};
  for (const t of normals) {
    if (!byColor[t.color]) byColor[t.color] = [];
    byColor[t.color].push(t);
  }
  for (const colorTiles of Object.values(byColor)) {
    const sorted = [];
    const seenN = new Set();
    for (const t of [...colorTiles].sort((a,b)=>a.num-b.num)) {
      if (!seenN.has(t.num)) { seenN.add(t.num); sorted.push(t); }
    }
    for (let s = 0; s < sorted.length; s++) {
      const run = [sorted[s]];
      let jUsed = 0, lastNum = sorted[s].num;
      for (let e = s+1; e < sorted.length; e++) {
        const gap = sorted[e].num - lastNum - 1;
        if (gap < 0) continue;
        if (jUsed + gap > jokers.length) break;
        for (let g=0; g<gap; g++) { if (jokers[jUsed]) run.push(jokers[jUsed++]); }
        run.push(sorted[e]);
        lastNum = sorted[e].num;
        if (run.length >= 3) result.push([...run]);
        if (run.length >= 13) break;
      }
      // joker at start
      if (jokers.length > 0 && s+1 < sorted.length && sorted[s+1].num === sorted[s].num+1) {
        const r = [jokers[0], sorted[s], sorted[s+1]];
        if (isRun(r)) {
          result.push(r);
          for (let e=s+2; e<sorted.length; e++) {
            const ext=[...r,sorted[e]]; if(isRun(ext)) result.push([...ext]); else break;
          }
        }
      }
      // joker at end (standalone 2-tile + joker)
      if (jokers.length > 0 && s+1 < sorted.length && sorted[s+1].num === sorted[s].num+1) {
        const r = [sorted[s], sorted[s+1], jokers[0]];
        if (isRun(r) && !result.some(x=>x.map(t=>t.id).sort().join()===r.map(t=>t.id).sort().join())) result.push(r);
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
    for (const t of numTiles) { if (!seenC.has(t.color)) { seenC.add(t.color); unique.push(t); } }
    if (unique.length >= 3) {
      result.push(unique.slice(0,3));
      if (unique.length >= 4) result.push(unique.slice(0,4));
    }
    if (jokers.length > 0) {
      if (unique.length === 2) { const g=[...unique,jokers[0]]; if(isGroup(g)) result.push(g); }
      if (unique.length === 3) { const g=[...unique,jokers[0]]; if(isGroup(g)) result.push(g); }
    }
  }

  // Dedup and safety filter: no set with duplicate tile IDs, no undefined tiles
  const seen = new Set();
  return result.filter(s => {
    if (!s||s.some(t=>!t||t.id===undefined)) return false;
    // Reject sets where same tile appears more than once
    const tileIds = s.map(t=>t.id);
    if (new Set(tileIds).size !== tileIds.length) return false;
    const k = tileIds.sort().join(',');
    if (seen.has(k)) return false; seen.add(k); return true;
  });
}

// ── BEST COMBINATION ──
export function bestCombination(tiles) {
  const safeTiles = (tiles||[]).filter(t=>t&&t.id!==undefined);
  const allSets = findAllSets(safeTiles);
  if (!allSets.length) return {sets:[],count:0,value:0};
  const sorted = [...allSets].sort((a,b)=>
    b.length!==a.length ? b.length-a.length
    : b.reduce((s,t)=>s+tileVal(t),0)-a.reduce((s,t)=>s+tileVal(t),0)
  );
  let bestSets=[],bestCount=0,bestValue=0;
  const LIMIT=2000; let iters=0;
  function bt(idx,chosen,usedIds) {
    if(++iters>LIMIT) return;
    const c=usedIds.size, v=chosen.flat().reduce((s,t)=>s+tileVal(t),0);
    if(c>bestCount||(c===bestCount&&v>bestValue)){bestCount=c;bestValue=v;bestSets=chosen.map(s=>[...s]);}
    for(let i=idx;i<sorted.length;i++){
      if(iters>LIMIT) break;
      const set=sorted[i];
      if(set.some(t=>usedIds.has(t.id))) continue;
      const nu=new Set([...usedIds,...set.map(t=>t.id)]);
      bt(i+1,[...chosen,set],nu);
    }
  }
  bt(0,[],new Set());
  const cleanSets=bestSets.map(s=>s.filter(t=>t&&t.id!==undefined)).filter(s=>s.length>=3);
  return {sets:cleanSets,count:cleanSets.flat().length,value:cleanSets.flat().reduce((s,t)=>s+tileVal(t),0)};
}

// ── SORT HAND ──
// Returns { tiles, playableCount, sets }
// Sets are grouped first in display order, remaining sorted by mode.
export function sortHand(hand, mode) {
  const safeHand=(hand||[]).filter(t=>t&&t.id!==undefined);
  const combo=bestCombination(safeHand);
  const setGroups=combo.sets.map(s=>s.filter(t=>t&&t.id!==undefined));
  const usedIds=new Set(setGroups.flat().map(t=>t.id));
  const remaining=safeHand.filter(t=>!usedIds.has(t.id));
  const sortedGroups=setGroups.map(s=>sortSet(s));
  const playableFlat=sortedGroups.flat();
  const sortedRest=[...remaining].sort((a,b)=>{
    if(a.isJoker&&b.isJoker) return 0;
    if(a.isJoker) return 1; if(b.isJoker) return -1;
    if(mode==='color'){const cd=(COLOR_ORDER[a.color]||0)-(COLOR_ORDER[b.color]||0);return cd!==0?cd:a.num-b.num;}
    return a.num!==b.num?a.num-b.num:(COLOR_ORDER[a.color]||0)-(COLOR_ORDER[b.color]||0);
  });
  return {tiles:[...playableFlat,...sortedRest],playableCount:playableFlat.length,sets:sortedGroups};
}

// ── JOKER INFERENCE ──
export function inferJokerValue(set, jokerIdx) {
  const norm=set.filter(t=>!t.isJoker);
  if(!norm.length) return null;
  const cols=[...new Set(norm.map(t=>t.color))];
  if(cols.length===1){
    const nj=norm.sort((a,b)=>a.num-b.num);
    const min=nj[0].num;
    const fullRange=[]; for(let n=min;n<=min+set.length-1;n++) fullRange.push(n);
    const usedNums=new Set(nj.map(t=>t.num));
    const gaps=fullRange.filter(n=>!usedNums.has(n));
    const jokerIdxs=set.map((t,i)=>t.isJoker?i:-1).filter(i=>i>=0);
    const ji2=jokerIdxs.indexOf(jokerIdx);
    return gaps[ji2]!==undefined?gaps[ji2]:null;
  }
  return norm[0].num;
}

export function inferJokerColor(set) {
  const norm=set.filter(t=>!t.isJoker);
  if(!norm.length) return null;
  const cols=[...new Set(norm.map(t=>t.color))];
  return cols.length===1?cols[0]:null;
}

// ── JOKER REPLACEMENTS ──
export function findJokerReplacements(hand, board) {
  const results=[];
  for(let si=0;si<board.length;si++){
    const set=board[si];
    const jokerIdxs=set.map((t,i)=>t.isJoker?i:-1).filter(i=>i>=0);
    for(const ji of jokerIdxs){
      const jokerNum=inferJokerValue(set,ji);
      const jokerColor=inferJokerColor(set);
      if(jokerNum===null) continue;
      for(const ht of hand){
        if(ht.isJoker) continue;
        if(ht.num===jokerNum&&(jokerColor===null||ht.color===jokerColor)){
          const newSet=[...set]; newSet[ji]=ht;
          if(isValid(newSet)) results.push({si,ji,handTile:ht,joker:set[ji]});
        }
      }
    }
  }
  return results;
}

// ── BOARD EXTENSIONS ──
export function findExtensions(hand, board) {
  const results=[];
  for(let si=0;si<board.length;si++){
    const set=board[si];
    for(const t of hand){
      if(isValid([t,...set])) results.push({si,pos:'start',tile:t,val:tileVal(t)});
      if(isValid([...set,t])) results.push({si,pos:'end',tile:t,val:tileVal(t)});
      if(isRun(set)||isGroup(set)){
        for(let i=1;i<set.length;i++){
          const trial=[...set.slice(0,i),t,...set.slice(i)];
          if(isValid(trial)) results.push({si,pos:'insert',insertAt:i,tile:t,val:tileVal(t)});
        }
      }
    }
  }
  return results;
}

// ── SPLIT SETS ──
export function findSplitInserts(tile, set, setIdx) {
  const results=[];
  if(!set||set.length<6) return results;
  if(!isRun(set)&&!isGroup(set)) return results;
  if(isRun(set)){
    const norm=set.filter(t=>!t.isJoker);
    const cols=[...new Set(norm.map(t=>t.color))];
    if(cols.length!==1) return results;
    if(!tile.isJoker&&tile.color!==cols[0]) return results;
    for(let insertAt=0;insertAt<=set.length;insertAt++){
      const trial=[...set.slice(0,insertAt),tile,...set.slice(insertAt)];
      for(let cut=2;cut<trial.length-2;cut++){
        const left=trial.slice(0,cut+1), right=trial.slice(cut);
        const tileInLeft=left.some(t=>t.id===tile.id);
        const tileInRight=right.some(t=>t.id===tile.id);
        if(tileInLeft===tileInRight) continue;
        if(left.length>=3&&right.length>=3&&isValid(left)&&isValid(right)){
          results.push({si:setIdx,insertAt,cut,left:sortSet(left),right:sortSet(right),tile});
        }
      }
    }
  }
  const seen=new Set();
  return results.filter(r=>{
    const k=r.left.map(t=>t.id).join(',')+'|'+r.right.map(t=>t.id).join(',');
    if(seen.has(k)) return false; seen.add(k); return true;
  });
}

// ── APPLY ONE MOVE STEP TO STATE ──
  return {h:nh,b:nb};
}

// Find board tiles that can replace a joker, freeing that joker
// The board tile must come from a set that remains valid without it,
// OR the board tile is placed in a new valid position
function findBoardJokerReplacements(board) {
  const results=[];
  for(let si=0;si<board.length;si++){
    const set=board[si];
    const jokerIdxs=set.map((t,i)=>t.isJoker?i:-1).filter(i=>i>=0);
    for(const ji of jokerIdxs){
      const jokerNum=inferJokerValue(set,ji);
      const jokerColor=inferJokerColor(set);
      if(jokerNum===null) continue;
      // Look for a board tile in another set that matches this joker slot
      for(let bsi=0;bsi<board.length;bsi++){
        if(bsi===si) continue;
        const bset=board[bsi];
        for(let bti=0;bti<bset.length;bti++){
          const bt=bset[bti];
          if(bt.isJoker) continue;
          if(bt.num!==jokerNum) continue;
          if(jokerColor!==null&&bt.color!==jokerColor) continue;
          // Check if the source set remains valid after removal
          const remaining=bset.filter((_,i)=>i!==bti);
          if(remaining.length<3||!isValid(remaining)) continue;
          // Check if the target set becomes valid with this tile
          const newTargetSet=[...set];
          newTargetSet[ji]=bt;
          if(!isValid(newTargetSet)) continue;
          results.push({si,ji,boardTile:bt,joker:set[ji],boardTileSi:bsi});
        }
      }
    }
  }
  return results;
}

// ── COMPUTE FULL MOVE SEQUENCE with lookahead ──
// Uses BFS/greedy search to find best sequence of moves.
export function computeMoveSequence(hand, board, hasMeld) {
  let h=[...hand], b=board.map(s=>[...s]);
  const steps=[];

  const runOnePass=(h,b)=>{
    let changed=false;

    // A) Direct joker liberation (hand tile replaces board joker)
    const reps=findJokerReplacements(h,b);
    if(reps.length>0){
      const rep=reps[0];
      b[rep.si][rep.ji]=rep.handTile;
      h=h.filter(t=>t.id!==rep.handTile.id);
      h.push(rep.joker);
      steps.push({type:'joker-lib',si:rep.si,ji:rep.ji,handTile:rep.handTile,joker:rep.joker,
        desc:`Replace ★ in set ${rep.si+1}`});
      return {h,b,changed:true};
    }

    // B) Board-to-board joker liberation (move board tile to free a joker)
    const breps=findBoardJokerReplacements(b);
    if(breps.length>0){
      const brep=breps[0];
      b[brep.si][brep.ji]=brep.boardTile;
      // Remove boardTile from its source set
      b[brep.boardTileSi]=b[brep.boardTileSi].filter(t=>t.id!==brep.boardTile.id);
      if(b[brep.boardTileSi].length===0) b.splice(brep.boardTileSi,1);
      else b[brep.boardTileSi]=sortSet(b[brep.boardTileSi]);
      h.push(brep.joker);
      steps.push({type:'board-joker-lib',desc:`Free ★ using board tile ${brep.boardTile.num}`,
        si:brep.si,joker:brep.joker});
      return {h,b,changed:true};
    }

    // C) Splits
    for(const ht of h){
      for(let si=0;si<b.length;si++){
        const splits=findSplitInserts(ht,b[si],si);
        if(splits.length>0){
          const sp=splits[0];
          h=h.filter(t=>t.id!==ht.id);
          b.splice(si,1,sp.left,sp.right);
          steps.push({type:'split',tile:ht,si,sp,desc:`Split set`});
          return {h,b,changed:true};
        }
      }
    }

    // D) Extend board sets
    const exts=findExtensions(h,b);
    if(exts.length>0){
      // Pick extension that uses highest-value tile
      const ext=exts.sort((a,z)=>z.val-a.val)[0];
      h=h.filter(t=>t.id!==ext.tile.id);
      if(ext.pos==='start') b[ext.si]=sortSet([ext.tile,...b[ext.si]]);
      else if(ext.pos==='end') b[ext.si]=sortSet([...b[ext.si],ext.tile]);
      else b[ext.si]=sortSet([...b[ext.si].slice(0,ext.insertAt),ext.tile,...b[ext.si].slice(ext.insertAt)]);
      steps.push({type:'extend',ext,desc:`Extend with ${ext.tile.isJoker?'★':ext.tile.num}`});
      return {h,b,changed:true};
    }

    return {h,b,changed:false};
  };

  // Run passes until no more moves
  let iters=0;
  let res={h,b,changed:true};
  while(res.changed&&iters++<30){
    res=runOnePass(res.h,res.b);
    h=res.h; b=res.b;
  }

  // E) New sets from hand (after board manipulation is exhausted)
  const combo=bestCombination(h);
  if(combo.count>0){
    const v=combo.value;
    if(hasMeld||v>=30){
      for(const set of combo.sets){
        h=h.filter(t=>!set.some(s=>s.id===t.id));
        b.push(sortSet(set));
        steps.push({type:'new-set',set,desc:`Play new set`});
      }
    }
  }

  // F) After playing new sets, try again (freed jokers may enable more)
  res={h,b,changed:true}; iters=0;
  while(res.changed&&iters++<20){
    res=runOnePass(res.h,res.b);
    h=res.h; b=res.b;
  }

  return {steps, newHand:h, newBoard:b, moved:steps.length>0};
}

// ── SMART HINTS ──
export function computeHints(hand, board, hasMeld) {
  const hints=[];
  const allUsedIds=new Set();

  // 1) Full best-move sequence (plays as many tiles as possible)
  const seq=computeMoveSequence(hand,board,hasMeld);
  const seqTiles=[...hand].filter(t=>!seq.newHand.some(h=>h.id===t.id));
  if(seqTiles.length>0){
    const seqVal=seqTiles.reduce((s,t)=>s+tileVal(t),0);
    // Collect all sets played in sequence
    const prevIds=new Set(board.flat().map(t=>t.id));
    const newSets=seq.newBoard.filter(s=>s.some(t=>!prevIds.has(t.id)));
    hints.push({
      type:hasMeld?'play':'initial',
      label:hasMeld?'BEST':'MELD',
      desc:`Play ${seqTiles.length} tile${seqTiles.length!==1?'s':''} — ${seqVal} pts`,
      sets:newSets.length?newSets:[],
      exts:[],splits:[],
      value:seqVal,count:seqTiles.length,applicable:hasMeld||seqVal>=30,
      isBestSequence:true,
      newHand:seq.newHand,newBoard:seq.newBoard,
    });
    seqTiles.forEach(t=>allUsedIds.add(t.id));
  }

  // 2) Individual sets from hand
  const combo=bestCombination(hand);
  if(combo.sets.length>1){
    for(const s of combo.sets){
      const sv=s.reduce((acc,t)=>acc+tileVal(t),0);
      hints.push({
        type:hasMeld?'play':'initial',label:'SET',
        desc:`Play ${s.length} tiles — ${sv} pts`,
        sets:[s],exts:[],splits:[],value:sv,count:s.length,
        applicable:hasMeld||sv>=30,
      });
    }
  } else if(combo.sets.length===1&&!seqTiles.length){
    // Only show individual if no sequence covers it
    const s=combo.sets[0];
    const sv=s.reduce((acc,t)=>acc+tileVal(t),0);
    const canMeld=!hasMeld&&sv>=30;
    if(hasMeld||canMeld){
      hints.push({
        type:hasMeld?'play':'initial',label:hasMeld?'PLAY':'MELD',
        desc:`Play ${s.length} tiles — ${sv} pts`,
        sets:[s],exts:[],splits:[],value:sv,count:s.length,applicable:true,
      });
      s.forEach(t=>allUsedIds.add(t.id));
    } else if(!hasMeld&&!canMeld){
      hints.push({
        type:'no-meld',label:'NO MELD',
        desc:`Best is ${sv} pts — need ${30-sv} more to meld`,
        sets:[s],exts:[],splits:[],value:sv,count:s.length,applicable:false,
      });
    }
  }

  if(hasMeld){
    // 3) Joker liberation
    const jreps=findJokerReplacements(hand,board);
    for(const rep of jreps){
      if(allUsedIds.has(rep.handTile.id)) continue;
      hints.push({
        type:'joker-lib',label:'JOKER',
        desc:`Replace ★ in set ${rep.si+1} with ${rep.handTile.num}(${rep.handTile.color}) — free joker!`,
        sets:[],exts:[],splits:[],jrep:rep,
        value:tileVal(rep.handTile)+30,count:1,applicable:true,
      });
    }

    // 4) Splits
    for(let si=0;si<board.length;si++){
      for(const ht of hand){
        if(allUsedIds.has(ht.id)) continue;
        const splits=findSplitInserts(ht,board[si],si);
        for(const sp of splits){
          hints.push({
            type:'split',label:'SPLIT',
            desc:`Insert ${ht.isJoker?'★':ht.num}(${ht.isJoker?'joker':ht.color}) to split set ${si+1}`,
            sets:[],exts:[],splits:[sp],value:tileVal(ht),count:1,applicable:true,tile:ht,
          });
        }
      }
    }

    // 5) Extensions
    const exts=findExtensions(hand,board);
    const byTile={};
    for(const e of exts){
      if(!byTile[e.tile.id]) byTile[e.tile.id]=[];
      byTile[e.tile.id].push(e);
    }
    for(const es of Object.values(byTile)){
      const t=es[0].tile;
      if(allUsedIds.has(t.id)) continue;
      hints.push({
        type:'extend',label:'EXTEND',
        desc:`${t.isJoker?'★':t.num}(${t.isJoker?'joker':t.color}) → extend set`,
        sets:[],exts:es,splits:[],value:tileVal(t),count:1,applicable:true,tile:t,
      });
    }
  }

  if(!combo.count&&!hand.every(t=>t.isJoker)&&!seqTiles.length){
    hints.push({type:'no-meld',label:'NO MELD',desc:'No valid sets yet',sets:[],exts:[],splits:[],value:0,count:0,applicable:false});
  }
  if(hints.filter(h=>h.applicable).length===0){
    hints.push({type:'draw',label:'DRAW',desc:'No playable moves — draw a tile',sets:[],exts:[],splits:[],value:0,count:0,applicable:false});
  }

  const typePri={initial:0,play:0,'joker-lib':1,split:2,extend:3,'no-meld':4,draw:5};
  return hints.sort((a,b)=>{
    if(b.count!==a.count) return b.count-a.count;
    if(b.value!==a.value) return b.value-a.value;
    return (typePri[a.type]||9)-(typePri[b.type]||9);
  });
}

// ── AI PLAY ──
export function aiPlayTurn(hand, board, hasMeld) {
  const seq=computeMoveSequence(hand,board,hasMeld);
  if(seq.moved){
    const meldAchieved=!hasMeld&&seq.newHand.length<hand.length;
    return {newHand:seq.newHand,newBoard:seq.newBoard,moved:true,meldAchieved};
  }
  return {newHand:hand,newBoard:board,moved:false,meldAchieved:false};
}

// ── APPLY HINT ──
export function applyHint(hint, pendingHand, pendingBoard) {
  // If hint has precomputed newHand/newBoard (best sequence), use directly
  if(hint.newHand&&hint.newBoard){
    return {hand:hint.newHand,board:hint.newBoard};
  }
  let hand=[...pendingHand];
  let board=pendingBoard.map(s=>[...s]);
  if(hint.sets&&hint.sets.length>0){
    const ids=new Set(hint.sets.flat().map(t=>t.id));
    hand=hand.filter(t=>!ids.has(t.id));
    hint.sets.forEach(s=>board.push(sortSet(s)));
  }
  if(hint.exts&&hint.exts.length>0){
    const ext=hint.exts[0];
    hand=hand.filter(t=>t.id!==ext.tile.id);
    if(ext.pos==='start') board[ext.si]=sortSet([ext.tile,...board[ext.si]]);
    else if(ext.pos==='end') board[ext.si]=sortSet([...board[ext.si],ext.tile]);
    else board[ext.si]=sortSet([...board[ext.si].slice(0,ext.insertAt),ext.tile,...board[ext.si].slice(ext.insertAt)]);
  }
  if(hint.jrep){
    const{si,ji,handTile,joker}=hint.jrep;
    board[si][ji]=handTile;
    hand=hand.filter(t=>t.id!==handTile.id);
    hand.push(joker);
  }
  if(hint.splits&&hint.splits.length>0){
    const sp=hint.splits[0];
    const{si,left,right,tile}=sp;
    hand=hand.filter(t=>t.id!==tile.id);
    board.splice(si,1,left,right);
  }
  return {hand,board};
}
