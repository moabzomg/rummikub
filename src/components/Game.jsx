/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Board from './Board';
import HandRack from './HandRack';
import HintPanel from './HintPanel';
import {
  buildPool, sortSet, sortHand, tileVal, handVal,
  isValidBoard, findAllSets, findExtensions,
  computeHints, applyHint, aiPlayTurn,
} from '../utils/gameEngine';

const sleep = ms => new Promise(r => setTimeout(r, ms));

function initGame(players) {
  const pool = buildPool();
  const hands = players.map(() => {
    const h = [];
    for (let i = 0; i < 14; i++) h.push(pool.pop());
    return h;
  });
  return {
    pool, players, hands,
    board: [],
    hasMeld: players.map(() => false),
    currentPlayer: 0,
    phase: 'play',
    finalRoundStart: -1,
    consecutivePasses: 0,
    pendingBoard: null,
    pendingHand: null,
    aiMoveLog: [],
    lastPlayedSets: new Set(),
  };
}

export default function Game({ setupPlayers, onReturnToMenu }) {
  const [G, setG] = useState(null);
  const [sortMode, setSortMode] = useState('color');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [hintPanelOpen, setHintPanelOpen] = useState(false);
  const [hints, setHints] = useState([]);
  const [toast, setToast] = useState(null);
  const [debugMode, setDebugMode] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [aiLabel, setAiLabel] = useState('');
  const [aiSpeed, setAiSpeed] = useState(300);
  const [gameOver, setGameOver] = useState(null);
  const [roundScores, setRoundScores] = useState(null);

  const toastTimerRef = useRef(null);
  const aiRef = useRef(false);
  const gRef = useRef(null);
  const aiSpeedRef = useRef(300);

  useEffect(() => { gRef.current = G; }, [G]);
  useEffect(() => { aiSpeedRef.current = aiSpeed; }, [aiSpeed]);

  useEffect(() => {
    const g = initGame(setupPlayers);
    setG(g); gRef.current = g;
  }, [setupPlayers]);

  const showToast = useCallback((msg, type = 'error') => {
    setToast({ msg, type });
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const ensurePending = useCallback((g) => {
    const ng = { ...g };
    if (!ng.pendingBoard) ng.pendingBoard = ng.board.map(s => [...s]);
    if (!ng.pendingHand) ng.pendingHand = [...ng.hands[ng.currentPlayer]];
    return ng;
  }, []);

  // Refs for mutually-recursive turn functions
  const endGameRef = useRef(null);
  const advanceTurnRef = useRef(null);
  const runAITurnRef = useRef(null);

  endGameRef.current = (g, winnerIdx) => {
    const handVals = g.players.map((_, i) => handVal(g.hands[i]));
    let wi = winnerIdx;
    if (wi < 0) {
      const min = Math.min(...handVals);
      wi = handVals.findIndex(v => v === min);
    }
    const winnerVal = handVals[wi];
    const winnerGain = handVals.reduce((s, v, i) => i !== wi ? s + v : s, 0) - winnerVal;
    const scores = g.players.map((p, i) => ({
      name: p.name,
      roundDelta: i === wi ? winnerGain : (winnerVal - handVals[i]),
      handVal: handVals[i],
      cnt: g.hands[i].length,
      isWinner: i === wi,
    }));
    setRoundScores(prev => {
      const base = prev || g.players.map(() => 0);
      return base.map((v, i) => v + scores[i].roundDelta);
    });
    setGameOver({ winner: g.players[wi], scores });
  };

  advanceTurnRef.current = (g) => {
    const n = g.players.length;
    const next = (g.currentPlayer + 1) % n;
    const passes = (g.consecutivePasses || 0) + 1;
    if (g.phase === 'final') {
      if (passes >= n || next === g.finalRoundStart) {
        endGameRef.current(g, -1);
        return;
      }
    }
    const ng = {
      ...g,
      currentPlayer: next,
      pendingBoard: null,
      pendingHand: null,
      aiMoveLog: [],
      lastPlayedSets: new Set(),
      consecutivePasses: g.phase === 'final' ? passes : 0,
    };
    setG(ng); gRef.current = ng;
    setSelectedIds(new Set());
    setHintPanelOpen(false);
  };

  runAITurnRef.current = async (g, pi) => {
    if (aiRef.current) return;
    aiRef.current = true;
    setAiRunning(true);
    setAiLabel(`${g.players[pi].name} thinking…`);
    await sleep(aiSpeedRef.current || 300);

    const hand = [...g.hands[pi]];
    const board = g.board.map(s => [...s]);
    const hasMeld = g.hasMeld[pi];
    const result = aiPlayTurn(hand, board, hasMeld);

    if (!result.moved) {
      const ng = { ...g };
      if (ng.pool.length > 0) {
        ng.hands = ng.hands.map((h, i) => i === pi ? [...h, ng.pool[ng.pool.length-1]] : h);
        ng.pool = ng.pool.slice(0, -1);
      }
      if (ng.pool.length === 0 && ng.phase !== 'final') {
        ng.phase = 'final'; ng.finalRoundStart = pi;
      }
      ng.aiMoveLog = [];
      aiRef.current = false; setAiRunning(false);
      advanceTurnRef.current(ng);
      return;
    }

    if (result.meldAchieved) {
      g = { ...g, hasMeld: g.hasMeld.map((m, i) => i === pi ? true : m) };
    }

    const prevIds = new Set(g.board.flat().map(t => t.id));
    const placed = result.newBoard.flat().filter(t => !prevIds.has(t.id));
    const newBoardIds = new Set(placed.map(t => t.id));
    const lastPlayedSets = new Set(
      result.newBoard.map((set, si) => set.some(t => newBoardIds.has(t.id)) ? si : -1).filter(i => i >= 0)
    );

    const ng = {
      ...g,
      hands: g.hands.map((h, i) => i === pi ? result.newHand : h),
      board: result.newBoard,
      aiMoveLog: placed.map(t => t.id),
      lastPlayedSets,
      hasMeld: g.hasMeld.map((m, i) => (i === pi && result.meldAchieved) ? true : m),
      consecutivePasses: 0,
    };

    setG(ng); gRef.current = ng;
    setAiLabel(`${g.players[pi].name} played ${placed.length} tile${placed.length !== 1 ? 's' : ''}`);

    for (const t of placed) {
      await sleep(Math.max(30, (aiSpeedRef.current || 300) / 4));
      const el = document.querySelector(`[data-id="${t.id}"]`);
      if (el) { el.classList.add('ai-drop'); setTimeout(() => el.classList.remove('ai-drop'), 400); }
    }
    await sleep(100 + placed.length * 30);

    if (result.newHand.length === 0) {
      aiRef.current = false; setAiRunning(false);
      endGameRef.current(ng, pi); return;
    }
    aiRef.current = false; setAiRunning(false);
    advanceTurnRef.current(ng);
  };

  const runAITurn = useCallback((g, pi) => runAITurnRef.current(g, pi), []);
  const advanceTurn = useCallback((g) => advanceTurnRef.current(g), []);
  const endGame = useCallback((g, wi) => endGameRef.current(g, wi), []);

  useEffect(() => {
    if (!G || aiRef.current) return;
    const pi = G.currentPlayer;
    if (G.players[pi].type === 'ai' && G.phase !== 'end') {
      runAITurn(G, pi);
    }
  }, [G, runAITurn]);

  // ── DRAG ──
  const dragStateRef = useRef({ active:false, tile:null, src:null, srcSi:null, ghost:null });

  const handleDragStart = useCallback((e, tile, src, si) => {
    const g = gRef.current;
    if (g) {
      const pi = g.currentPlayer;
      if (!g.hasMeld[pi] && src === 'board') { e.preventDefault(); return; }
    }
    dragStateRef.current = { active:true, tile, src, srcSi: si ?? null, ghost:null };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('id', String(tile.id));
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:fixed;top:-100px;width:42px;height:54px;font-size:17px;font-weight:700;display:flex;align-items:center;justify-content:center;border-radius:4px;box-shadow:0 8px 20px rgba(0,0,0,.5);pointer-events:none;z-index:9999';
    ghost.style.background = tile.isJoker ? 'linear-gradient(135deg,#1a1a2e,#2e1a60)' : '#fefcf6';
    ghost.style.color = tile.isJoker ? '#f4c430' : tile.color==='red'?'#e03030':tile.color==='blue'?'#2060e0':tile.color==='orange'?'#e87a18':'#111';
    ghost.textContent = tile.isJoker ? '☺' : tile.num;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 21, 27);
    dragStateRef.current.ghost = ghost;
    requestAnimationFrame(() => { const el = document.querySelector(`[data-id="${tile.id}"]`); if (el) el.classList.add('dragging'); });
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragStateRef.current.ghost) { dragStateRef.current.ghost.remove(); dragStateRef.current.ghost = null; }
    document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
    document.querySelectorAll('.drop-insert.vis').forEach(el => el.classList.remove('vis'));
    dragStateRef.current.active = false;
  }, []);

  const handleDropOnSet = useCallback((targetSi, insertPos) => {
    const ds = dragStateRef.current;
    if (!ds.tile) return;
    const g = gRef.current;
    if (!g) return;
    const pi = g.currentPlayer;
    const hasMeld = g.hasMeld[pi];
    if (!hasMeld && targetSi < g.board.length) {
      showToast('You must complete your initial meld first!'); dragStateRef.current.tile = null; return;
    }
    let ng = ensurePending(g);
    const tile = ds.tile;
    const src = ds.src;
    let srcSi = ds.srcSi;

    if (src === 'hand') {
      ng.pendingHand = ng.pendingHand.filter(t => t.id !== tile.id);
      setSelectedIds(prev => { const s = new Set(prev); s.delete(tile.id); return s; });
    } else if (src === 'board' && srcSi !== null) {
      ng.pendingBoard[srcSi] = ng.pendingBoard[srcSi].filter(t => t.id !== tile.id);
      if (ng.pendingBoard[srcSi].length === 0) {
        ng.pendingBoard.splice(srcSi, 1);
        if (targetSi > srcSi) targetSi--;
      }
    }

    if (targetSi < ng.pendingBoard.length) {
      const set = ng.pendingBoard[targetSi];
      const pos = Math.min(insertPos !== undefined ? insertPos : set.length, set.length);
      // Preserve user's manual order — don't auto-sort
      ng.pendingBoard[targetSi] = [...set.slice(0, pos), tile, ...set.slice(pos)];
    } else {
      ng.pendingBoard.push([tile]);
    }

    dragStateRef.current.tile = null;
    setG({ ...ng }); gRef.current = { ...ng };
    setTimeout(() => { const el = document.querySelector(`[data-id="${tile.id}"]`); if (el) { el.classList.add('bounce'); setTimeout(() => el.classList.remove('bounce'), 350); } }, 40);
  }, [ensurePending, showToast]);

  const handleDropNewSet = useCallback(() => {
    const ds = dragStateRef.current;
    if (!ds.tile) return;
    const g = gRef.current;
    if (!g) return;
    let ng = ensurePending(g);
    const tile = ds.tile;
    const src = ds.src;
    const srcSi = ds.srcSi;
    if (src === 'hand') {
      ng.pendingHand = ng.pendingHand.filter(t => t.id !== tile.id);
      setSelectedIds(prev => { const s = new Set(prev); s.delete(tile.id); return s; });
    } else if (src === 'board' && srcSi !== null) {
      ng.pendingBoard[srcSi] = ng.pendingBoard[srcSi].filter(t => t.id !== tile.id);
      if (ng.pendingBoard[srcSi].length === 0) ng.pendingBoard.splice(srcSi, 1);
    }
    ng.pendingBoard.push([tile]);
    dragStateRef.current.tile = null;
    setG({ ...ng }); gRef.current = { ...ng };
  }, [ensurePending]);

  // ── TILE INTERACTIONS ──
  const handleTileClick = useCallback((e, tile, src) => {
    e.stopPropagation();
    const g = gRef.current;
    if (!g) return;
    const pi = g.currentPlayer;
    if (g.players[pi].type !== 'human') return;
    if (src === 'board') return;
    setSelectedIds(prev => { const s = new Set(prev); s.has(tile.id) ? s.delete(tile.id) : s.add(tile.id); return s; });
  }, []);

  const returnTileToHand = useCallback((tile, si, g) => {
    const prevIds = new Set(g.board.flat().map(t => t.id));
    if (prevIds.has(tile.id)) { showToast('Cannot return original board tiles to hand'); return; }
    let ng = ensurePending(g);
    ng.pendingBoard[si] = ng.pendingBoard[si].filter(t => t.id !== tile.id);
    if (ng.pendingBoard[si].length === 0) ng.pendingBoard.splice(si, 1);
    ng.pendingHand = [...ng.pendingHand, tile];
    setG({ ...ng }); gRef.current = { ...ng };
  }, [ensurePending, showToast]);

  const autoPlaceTile = useCallback((tile, g) => {
    let ng = ensurePending(g);
    const hand = ng.pendingHand;
    const board = ng.pendingBoard;
    const pi2 = g.currentPlayer;
    const hasMeld2 = g.hasMeld[pi2];

    if (hasMeld2) {
      const exts = findExtensions([tile], board);
      if (exts.length > 0) {
        const ext = exts[0];
        ng.pendingHand = hand.filter(t => t.id !== tile.id);
        if (ext.pos === 'start') board[ext.si] = sortSet([tile, ...board[ext.si]]);
        else if (ext.pos === 'end') board[ext.si] = sortSet([...board[ext.si], tile]);
        else board[ext.si] = sortSet([...board[ext.si].slice(0, ext.insertAt), tile, ...board[ext.si].slice(ext.insertAt)]);
        setSelectedIds(prev => { const s = new Set(prev); s.delete(tile.id); return s; });
        setG({ ...ng }); gRef.current = { ...ng };
        setTimeout(() => { const el = document.querySelector(`[data-id="${tile.id}"]`); if (el) { el.classList.add('bounce'); setTimeout(() => el.classList.remove('bounce'), 350); } }, 40);
        return;
      }
    }

    const selTiles = [...selectedIds].map(id => hand.find(t => t.id === id)).filter(Boolean);
    const pool = [...new Set([tile, ...selTiles])];
    const sets = findAllSets(pool);
    const best = sets.filter(s => s.some(t => t.id === tile.id)).sort((a,b) => b.length - a.length)[0];
    if (best) {
      const ids = new Set(best.map(t => t.id));
      ng.pendingHand = hand.filter(t => !ids.has(t.id));
      ng.pendingBoard = [...board, sortSet(best)];
      setSelectedIds(prev => { const s = new Set(prev); ids.forEach(id => s.delete(id)); return s; });
      setG({ ...ng }); gRef.current = { ...ng };
      return;
    }
    showToast('No valid placement — select more tiles first', 'info');
  }, [ensurePending, selectedIds, showToast]);

  const handleTileDblClick = useCallback((e, tile, src, si) => {
    e.stopPropagation(); e.preventDefault();
    const g = gRef.current;
    if (!g) return;
    const pi = g.currentPlayer;
    if (g.players[pi].type !== 'human') return;
    if (src === 'board') returnTileToHand(tile, si, g);
    else autoPlaceTile(tile, g);
  }, [returnTileToHand, autoPlaceTile]);

  // ── HINT ──
  const handleShowHint = useCallback(() => {
    const g = gRef.current;
    if (!g) return;
    const pi = g.currentPlayer;
    const hand = g.pendingHand || g.hands[pi];
    const board = g.pendingBoard || g.board;
    const hasMeld = g.hasMeld[pi];
    const h = computeHints(hand, board, hasMeld);
    setHints(h);
    setHintPanelOpen(true);
  }, []);

  const handleApplyHint = useCallback((hint) => {
    const g = gRef.current;
    if (!g) return;
    let ng = ensurePending(g);
    const { hand, board } = applyHint(hint, ng.pendingHand, ng.pendingBoard);
    ng.pendingHand = hand;
    ng.pendingBoard = board;
    setSelectedIds(new Set());
    setG({ ...ng }); gRef.current = { ...ng };
    setHintPanelOpen(false);
  }, [ensurePending]);

  // ── SUGGESTION ──
  const handlePlaySuggestion = useCallback((set) => {
    const g = gRef.current;
    if (!g) return;
    let ng = ensurePending(g);
    const ids = new Set(set.map(t => t.id));
    ng.pendingHand = ng.pendingHand.filter(t => !ids.has(t.id));
    ng.pendingBoard = [...ng.pendingBoard, sortSet(set)];
    setSelectedIds(prev => { const s = new Set(prev); ids.forEach(id => s.delete(id)); return s; });
    setG({ ...ng }); gRef.current = { ...ng };
  }, [ensurePending]);

  // ── CONFIRM ──
  const handleConfirm = useCallback(() => {
    const g = gRef.current;
    if (!g) return;
    const pi = g.currentPlayer;
    let ng = ensurePending(g);
    const nb = ng.pendingBoard;
    const nh = ng.pendingHand;

    if (!isValidBoard(nb)) { showToast('Board has invalid sets — fix before confirming!'); return; }

    const prevBoardIds = new Set(g.board.flat().map(t => t.id));
    const newBoardIds = new Set(nb.flat().map(t => t.id));
    const placed = [...newBoardIds].filter(id => !prevBoardIds.has(id));
    if (placed.length === 0) { showToast('Place at least one tile, or Draw & Pass'); return; }

    const newHandIds = new Set(nh.map(t => t.id));
    const takenFromBoard = [...prevBoardIds].filter(id => !newBoardIds.has(id) && newHandIds.has(id));
    if (takenFromBoard.length > 0) { showToast('Cannot take original board tiles back to hand!'); return; }

    if (!g.hasMeld[pi]) {
      const originalBoardLen = g.board.length;
      for (let si = 0; si < nb.length; si++) {
        const set = nb[si];
        const hasNew = set.some(t => !prevBoardIds.has(t.id));
        const hasOld = set.some(t => prevBoardIds.has(t.id));
        if ((hasNew && hasOld) || (si < originalBoardLen && hasNew)) {
          showToast('Initial meld must use only your own tiles!'); return;
        }
      }
      const placedTiles = g.hands[pi].filter(t => placed.includes(t.id));
      const v = placedTiles.reduce((s, t) => s + tileVal(t), 0);
      if (v < 30) { showToast(`Initial meld needs 30+ pts. You placed ${v} pts.`); return; }
    }

    const newG = {
      ...ng,
      board: nb,
      hands: ng.hands.map((h, i) => i === pi ? nh : h),
      hasMeld: ng.hasMeld.map((m, i) => i === pi ? true : m),
      pendingBoard: null, pendingHand: null, aiMoveLog: [],
      consecutivePasses: 0,
    };

    if (nh.length === 0) { endGame(newG, pi); return; }
    setSelectedIds(new Set()); setHintPanelOpen(false);
    advanceTurn(newG);
  }, [ensurePending, showToast, endGame, advanceTurn]);

  const handleReset = useCallback(() => {
    setG(prev => { const ng = { ...prev, pendingBoard:null, pendingHand:null }; gRef.current = ng; return ng; });
    setSelectedIds(new Set());
  }, []);

  const handleDraw = useCallback(() => {
    const g = gRef.current;
    if (!g) return;
    const pi = g.currentPlayer;
    let ng = { ...g, pendingBoard:null, pendingHand:null };
    if (ng.pool.length > 0) {
      ng.hands = ng.hands.map((h, i) => i === pi ? [...h, ng.pool[ng.pool.length-1]] : h);
      ng.pool = ng.pool.slice(0, -1);
      showToast(`Drew a tile. Pool: ${ng.pool.length}`, 'info');
    } else {
      showToast('Pool is empty!', 'info');
    }
    if (ng.pool.length === 0 && ng.phase !== 'final') { ng.phase = 'final'; ng.finalRoundStart = pi; }
    setSelectedIds(new Set()); setHintPanelOpen(false);
    advanceTurn(ng);
  }, [showToast, advanceTurn]);

  if (!G) return null;

  const pi = G.currentPlayer;
  const isHuman = G.players[pi].type === 'human';
  const board = G.pendingBoard || G.board;

  const humanIdx = G.players.findIndex(p => p.type === 'human');
  const hand = humanIdx >= 0
    ? (humanIdx === pi ? (G.pendingHand || G.hands[humanIdx]) : G.hands[humanIdx])
    : [];

  const prevBoardIds = new Set(G.board.flat().map(t => t.id));
  const aiMovedIds = new Set(G.aiMoveLog || []);

  return (
    <div className="game">
      {/* Header */}
      <div className="g-header">
        <div className="g-logo">R</div>
        <div className="ptabs">
          {G.players.map((p, i) => (
            <div key={i} className={['ptab', i===G.currentPlayer?'cur':'', G.phase==='final'?'last-turn':''].filter(Boolean).join(' ')}>
              <span className="ptab-name">{p.name}</span>
              <span className="ptab-count">{G.hands[i].length}</span>
              {!G.hasMeld[i] && <span className="ptab-nomeld">no meld</span>}
              {debugMode && p.type === 'ai' && (
                <span style={{fontSize:'8px',color:'#aaa',marginLeft:'3px'}}>
                  [{G.hands[i].map(t => t.isJoker?'☺':`${t.num}${t.color[0].toUpperCase()}`).join(' ')}]
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="pool-info">Pool: {G.pool.length}</div>
        <button className={`debug-toggle${debugMode?' on':''}`} onClick={() => setDebugMode(d => !d)}>DEBUG</button>
      </div>

      {/* AI overlay */}
      {aiRunning && (
        <div className="ai-overlay vis">
          <div className="ai-spin" />
          <div className="ai-name">{aiLabel}</div>
        </div>
      )}

      {G.phase === 'final' && (
        <div style={{position:'absolute',top:'50px',left:'50%',transform:'translateX(-50%)',background:'rgba(224,48,48,.88)',color:'#fff',padding:'4px 14px',borderRadius:'20px',fontSize:'11px',fontWeight:600,letterSpacing:'1px',zIndex:50}}>
          ⚠ Last Turn — Pool empty!
        </div>
      )}

      {/* Board */}
      <Board
        board={board} prevBoardIds={prevBoardIds} aiMovedIds={aiMovedIds}
        isHuman={isHuman} hasMeld={humanIdx>=0?G.hasMeld[humanIdx]:true}
        lastPlayedSets={G.lastPlayedSets} debugMode={debugMode}
        onDropOnSet={handleDropOnSet} onDropNewSet={handleDropNewSet}
        onTileClick={handleTileClick} onTileDblClick={handleTileDblClick}
        onDragStart={handleDragStart} onDragEnd={handleDragEnd}
      />

      {/* Bottom */}
      <div className="bottom">
        <div className="action-bar">
          <div className="turn-info">{G.players[pi].name}'s Turn</div>
          <div className="sort-ctrl">
            <button className={`sort-btn${sortMode==='color'?' on':''}`} onClick={() => setSortMode('color')}>🎨 Color</button>
            <button className={`sort-btn${sortMode==='num'?' on':''}`} onClick={() => setSortMode('num')}>🔢 Num</button>
          </div>
          <button className="btn btn-gold" onClick={handleShowHint} disabled={!isHuman}>💡 Hint</button>
          <button className="btn" onClick={handleReset} disabled={!isHuman}>↺</button>
          <label style={{display:'flex',alignItems:'center',gap:'4px',fontSize:'10px',color:'rgba(255,255,255,.45)',flexShrink:0}}>
            🤖
            <input type="range" min="50" max="1500" step="50" value={aiSpeed}
              onChange={e => setAiSpeed(Number(e.target.value))}
              style={{width:'60px',accentColor:'var(--gold)'}} />
          </label>
          <button className="btn btn-red" onClick={handleDraw} disabled={!isHuman}>Draw</button>
          <button className="btn btn-green" onClick={handleConfirm} disabled={!isHuman}>✓ OK</button>
        </div>

        <HandRack
          hand={hand} sortMode={sortMode} selectedIds={selectedIds}
          hasMeld={humanIdx>=0?G.hasMeld[humanIdx]:false}
          isHuman={humanIdx===pi} debugMode={debugMode}
          onTileClick={handleTileClick} onTileDblClick={handleTileDblClick}
          onDragStart={handleDragStart} onDragEnd={handleDragEnd}
          onPlaySuggestion={handlePlaySuggestion}
        />

        {/* Debug: AI hands */}
        {debugMode && G.players.map((p, i) => {
          if (p.type !== 'ai') return null;
          let aiSorted = G.hands[i];
          try { const r = sortHand(G.hands[i], 'color'); aiSorted = r.tiles || G.hands[i]; } catch {}
          return (
            <div key={i} style={{padding:'4px 10px 6px'}}>
              <div className="hand-lbl" style={{color:'rgba(255,165,0,.7)'}}>
                {p.name} ({G.hands[i].length} tiles) — debug
              </div>
              <div className="hand-rack" style={{opacity:.78,pointerEvents:'none',minHeight:'44px'}}>
                {(aiSorted||G.hands[i]).map(tile => tile && (
                  <div key={tile.id} className={'tile in-board c-'+tile.color} style={{cursor:'default'}}>
                    {tile.isJoker ? <div className="joker-face">☺</div> : <div className="t-num">{tile.num}</div>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Hint panel */}
      {hintPanelOpen && (
        <div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:200,background:'rgba(5,12,28,.97)',borderTop:'2px solid var(--gold)',maxHeight:'45vh',overflow:'auto'}}>
          <HintPanel hints={hints} onApply={handleApplyHint} onClose={() => setHintPanelOpen(false)} />
        </div>
      )}

      {/* Toast */}
      {toast && <div className={`toast vis ${toast.type||'error'}`}>{toast.msg}</div>}

      {/* Win screen */}
      {gameOver && (
        <div className="win-screen vis">
          <div className="win-title">🏆 {gameOver.winner.name} Wins!</div>
          <div className="win-sub">Round Result</div>
          <div className="score-tbl">
            {[...gameOver.scores].map((s, i) => (
              <div key={i} className="score-row">
                <span className="sr-pos">{s.isWinner?'🥇':`${i+1}.`}</span>
                <span>{s.name}</span>
                <span style={{fontSize:'10px',color:'rgba(255,255,255,.4)'}}>{s.cnt} tiles</span>
                <span style={{color:s.isWinner?'#f4c430':'#f08080',fontWeight:600}}>
                  {s.isWinner&&s.roundDelta>=0?'+':''}{s.roundDelta}pts
                </span>
              </div>
            ))}
          </div>
          {roundScores && (
            <div className="score-tbl" style={{marginTop:'8px'}}>
              <div style={{fontSize:'9px',letterSpacing:'2px',color:'rgba(255,255,255,.35)',marginBottom:'5px'}}>TOTAL</div>
              {G.players.map((p, i) => (
                <div key={i} className="score-row">
                  <span style={{width:'22px',color:'var(--gold)'}}>{i+1}.</span>
                  <span>{p.name}</span>
                  <span style={{color:roundScores[i]>=0?'#22c87a':'#f08080',fontWeight:600}}>
                    {roundScores[i]>0?'+':''}{roundScores[i]}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div style={{display:'flex',gap:'10px',marginTop:'14px'}}>
            <button className="btn btn-green" style={{padding:'10px 22px',fontSize:'13px'}}
              onClick={() => {
                const g = initGame(gRef.current.players);
                setG(g); gRef.current = g;
                setGameOver(null); setSelectedIds(new Set()); setHintPanelOpen(false);
              }}>Next Round</button>
            <button className="btn" style={{padding:'10px 22px',fontSize:'13px'}}
              onClick={() => { setRoundScores(null); onReturnToMenu(); }}>Main Menu</button>
          </div>
        </div>
      )}
    </div>
  );
}
