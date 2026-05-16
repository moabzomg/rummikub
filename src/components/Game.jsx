import React, { useState, useEffect, useCallback, useRef } from 'react';
import Board from './Board';
import HandRack from './HandRack';
import HintPanel from './HintPanel';
import Tile from './Tile';
import {
  createInitialState,
  computeAIMove,
  canMakeInitialMeld,
  isValidBoard,
  calculateHandValue,
  sortHand,
  isValidSet,
  computeHint,
} from '../utils/gameEngine';

const AVATAR_COLORS = ['#4a90d9', '#9b59b6', '#e67e22', '#27ae60'];
const AVATAR_ICONS = ['🧑', '👩', '🧔', '👨'];

export default function Game({ config, onBackToMenu }) {
  const [state, setState] = useState(() => {
    const s = createInitialState([config.playerName, ...config.aiNames]);
    return { ...s, aiSpeed: config.aiSpeed, debugMode: config.debugMode };
  });

  // Working board state (during player's turn, before confirm)
  const [workingBoard, setWorkingBoard] = useState(null);
  const [workingHand, setWorkingHand] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showHint, setShowHint] = useState(false);
  const [gameLog, setGameLog] = useState([]);
  const [animatingAI, setAnimatingAI] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [roundScores, setRoundScores] = useState(null);
  const [sortByColor, setSortByColor] = useState(true);
  const [debugMode, setDebugMode] = useState(config.debugMode);
  const [newlyPlayedIds, setNewlyPlayedIds] = useState(new Set()); // tiles just placed by AI
  const aiTimerRef = useRef(null);

  const isHumanTurn = state.currentPlayer === 0 && state.phase === 'playing';
  const currentBoard = isHumanTurn && workingBoard !== null ? workingBoard : state.board;
  const currentHand = isHumanTurn && workingHand !== null ? workingHand : (state.players[0]?.hand || []);

  const addLog = useCallback((msg) => {
    setGameLog(prev => [...prev.slice(-20), msg]);
  }, []);

  // ── Human actions ─────────────────────────────────────────
  const initWorkingState = useCallback(() => {
    if (workingBoard === null) {
      setWorkingBoard([...state.board.map(s => [...s])]);
      setWorkingHand([...state.players[0].hand]);
    }
  }, [workingBoard, state.board, state.players]);

  const handleTileSelect = useCallback((tile) => {
    initWorkingState();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(tile.id)) next.delete(tile.id);
      else next.add(tile.id);
      return next;
    });
  }, [initWorkingState]);

  const handleDropToSet = useCallback((tileId, source, setIdx) => {
    // Pre-meld: cannot touch board tiles, and cannot extend existing board sets
    if (!state.players[0].hasMelded) {
      if (source === 'board') {
        addLog('❌ You cannot touch board tiles before your initial meld!');
        return;
      }
      // Block dropping onto any set that contains original board tiles
      const originalBoardTileIds = new Set(state.board.flat().map(t => t.id));
      const targetSet = (workingBoard || state.board)[setIdx] || [];
      if (targetSet.some(t => originalBoardTileIds.has(t.id))) {
        addLog('❌ Initial meld: you cannot extend existing board sets!');
        return;
      }
    }
    initWorkingState();

    let tile = null;
    let newHand = [...(workingHand || state.players[0].hand)];
    let newBoard = [...(workingBoard || state.board).map(s => [...s])];

    if (source === 'hand') {
      const idx = newHand.findIndex(t => t.id === tileId);
      if (idx === -1) return;
      tile = newHand[idx];
      newHand = newHand.filter(t => t.id !== tileId);
      setWorkingHand(newHand);
    } else if (source === 'board') {
      for (let si = 0; si < newBoard.length; si++) {
        const ti = newBoard[si].findIndex(t => t.id === tileId);
        if (ti !== -1) {
          tile = newBoard[si][ti];
          newBoard[si] = newBoard[si].filter(t => t.id !== tileId);
          if (newBoard[si].length === 0) newBoard.splice(si, 1);
          // Adjust target setIdx if a preceding set was removed
          break;
        }
      }
    }

    if (!tile) return;
    // Find the target set by the (possibly updated) board; setIdx may refer to old indices
    const targetBoard = newBoard.map((s, i) => i === setIdx ? [...s, tile] : s);
    setWorkingBoard(targetBoard);
  }, [initWorkingState, workingHand, workingBoard, state.board, state.players, addLog]);

  const handleDropToNew = useCallback((tileId, source) => {
    // Pre-meld: block dragging existing board tiles
    if (!state.players[0].hasMelded && source === 'board') {
      addLog('❌ You cannot touch board tiles before your initial meld!');
      return;
    }
    initWorkingState();

    let tile = null;
    let newHand = [...(workingHand || state.players[0].hand)];
    let newBoard = [...(workingBoard || state.board).map(s => [...s])];

    if (source === 'hand') {
      const idx = newHand.findIndex(t => t.id === tileId);
      if (idx === -1) return;
      tile = newHand[idx];
      newHand = newHand.filter(t => t.id !== tileId);
      setWorkingHand(newHand);
    } else if (source === 'board') {
      for (let si = 0; si < newBoard.length; si++) {
        const ti = newBoard[si].findIndex(t => t.id === tileId);
        if (ti !== -1) {
          tile = newBoard[si][ti];
          newBoard[si] = newBoard[si].filter(t => t.id !== tileId);
          if (newBoard[si].length === 0) newBoard.splice(si, 1);
          break;
        }
      }
    }

    if (!tile) return;
    newBoard.push([tile]);
    setWorkingBoard(newBoard);
  }, [initWorkingState, workingHand, workingBoard, state.board, state.players, addLog]);

  const handleBoardTileClick = useCallback((tile, setIdx) => {
    // Pre-meld players cannot pick up existing board tiles
    if (!state.players[0].hasMelded) {
      const originalBoardTileIds = new Set(state.board.flat().map(t => t.id));
      if (originalBoardTileIds.has(tile.id)) {
        addLog('❌ You cannot touch board tiles before your initial meld!');
        return;
      }
    }
    // Move tile to hand (pick up from board)
    initWorkingState();
    const newBoard = (workingBoard || state.board.map(s => [...s])).map(
      (s, i) => i === setIdx ? s.filter(t => t.id !== tile.id) : s
    ).filter(s => s.length > 0);
    const newHand = [...(workingHand || state.players[0].hand), tile];
    setWorkingBoard(newBoard);
    setWorkingHand(newHand);
  }, [initWorkingState, workingBoard, workingHand, state.board, state.players, addLog]);

  // Play selected hand tiles to new set on board
  const handlePlaySelected = useCallback(() => {
    if (selectedIds.size < 3) return;
    initWorkingState();
    const hand = workingHand || [...state.players[0].hand];
    const tilesToPlay = hand.filter(t => selectedIds.has(t.id));
    if (tilesToPlay.length < 3) return;

    const newHand = hand.filter(t => !selectedIds.has(t.id));
    const newBoard = [...(workingBoard || state.board.map(s => [...s])), tilesToPlay];
    setWorkingHand(newHand);
    setWorkingBoard(newBoard);
    setSelectedIds(new Set());
  }, [selectedIds, initWorkingState, workingHand, workingBoard, state.players, state.board]);

  const handleConfirm = useCallback(() => {
    if (!workingBoard) return;

    const player = state.players[0];
    const hand = workingHand || player.hand;
    const originalHandIds = new Set(player.hand.map(t => t.id));

    // Validate board
    if (!isValidBoard(workingBoard)) {
      addLog('❌ Board has invalid sets — fix before confirming!');
      return;
    }

    // Check if any tiles actually played from hand
    const currentHandIds = new Set(hand.map(t => t.id));
    const playedFromHand = player.hand.filter(t => !currentHandIds.has(t.id));

    if (playedFromHand.length === 0) {
      addLog('❌ You must play at least one tile from your hand!');
      return;
    }

    // Initial meld rules: player may ONLY play tiles from their own hand.
    // They cannot touch, split, or extend any existing board sets.
    if (!player.hasMelded) {
      // Every tile currently on the board that was NOT in the player's original hand
      // must still be in exactly the same sets as before (board tiles untouched).
      const originalBoardTileIds = new Set(state.board.flat().map(t => t.id));

      // Check that every pre-existing board tile is still on the board
      for (const tileId of originalBoardTileIds) {
        const stillOnBoard = workingBoard.flat().some(t => t.id === tileId);
        if (!stillOnBoard) {
          addLog('❌ Initial meld: you cannot move or use existing board tiles!');
          return;
        }
      }

      // All sets on the working board that contain any hand tile must consist
      // ENTIRELY of hand tiles (no mixing with board tiles).
      const playedFromHandIds = new Set(playedFromHand.map(t => t.id));
      for (const set of workingBoard) {
        const hasHandTile = set.some(t => playedFromHandIds.has(t.id));
        const hasBoardTile = set.some(t => originalBoardTileIds.has(t.id));
        if (hasHandTile && hasBoardTile) {
          addLog('❌ Initial meld: your tiles must form independent sets, not extend board sets!');
          return;
        }
      }

      // Calculate value of sets made entirely from hand tiles
      const handValue = workingBoard
        .filter(set => set.every(t => playedFromHandIds.has(t.id)))
        .reduce((s, set) => s + set.reduce((sv, t) => sv + (t.isJoker ? 30 : t.number), 0), 0);

      if (handValue < 30) {
        addLog(`❌ Initial meld must be ≥30 pts (yours: ${handValue}). Use hand tiles only!`);
        return;
      }
    }

    // Check if won
    const won = hand.length === 0;

    setState(prev => {
      const newPlayers = prev.players.map((p, i) => {
        if (i !== 0) return p;
        return { ...p, hand, hasMelded: true };
      });

      if (won) {
        // Calculate scores
        const handValues = newPlayers.slice(1).map(p => calculateHandValue(p.hand));
        const totalWon = handValues.reduce((a, b) => a + b, 0);
        const finalPlayers = newPlayers.map((p, i) => ({
          ...p,
          roundScore: i === 0 ? totalWon : -calculateHandValue(p.hand),
          score: p.score + (i === 0 ? totalWon : -calculateHandValue(p.hand)),
        }));
        return { ...prev, players: finalPlayers, board: workingBoard, phase: 'roundOver' };
      }

      return {
        ...prev,
        players: newPlayers,
        board: workingBoard,
        currentPlayer: (prev.currentPlayer + 1) % prev.players.length,
        lastDraw: false,
      };
    });

    setWorkingBoard(null);
    setWorkingHand(null);
    setSelectedIds(new Set());
    if (!won) addLog(`✅ ${player.name} played ${playedFromHand.length} tile(s)`);
  }, [workingBoard, workingHand, state.players, addLog]);

  const handleDrawTile = useCallback(() => {
    if (!isHumanTurn) return;
    if (state.pool.length === 0) {
      addLog('🎱 Pool is empty!');
      // End turn without drawing
      setState(prev => ({
        ...prev,
        currentPlayer: (prev.currentPlayer + 1) % prev.players.length,
        lastDraw: false,
      }));
      return;
    }

    setState(prev => {
      const [drawn, ...newPool] = prev.pool;
      const newPlayers = prev.players.map((p, i) =>
        i === 0 ? { ...p, hand: [...p.hand, drawn] } : p
      );
      addLog(`${prev.players[0].name} drew a tile`);
      return {
        ...prev,
        players: newPlayers,
        pool: newPool,
        currentPlayer: (prev.currentPlayer + 1) % prev.players.length,
        lastDraw: false,
      };
    });

    setWorkingBoard(null);
    setWorkingHand(null);
    setSelectedIds(new Set());
  }, [isHumanTurn, state.pool, addLog]);

  const handleUndo = useCallback(() => {
    setWorkingBoard(null);
    setWorkingHand(null);
    setSelectedIds(new Set());
  }, []);

  // ── AI Turn ───────────────────────────────────────────────
  useEffect(() => {
    if (state.phase !== 'playing') return;
    if (state.currentPlayer === 0) return;
    if (animatingAI) return;

    const player = state.players[state.currentPlayer];
    if (!player) return;

    setAnimatingAI(true);

    aiTimerRef.current = setTimeout(() => {
      const result = computeAIMove(player.hand, state.board, player.hasMelded, 3);

      setState(prev => {
        if (prev.currentPlayer !== state.currentPlayer) return prev;

        const currentAI = prev.players[prev.currentPlayer];

        if (result) {
          addLog(`🤖 ${currentAI.name} played ${result.tilesPlayed.length} tile(s)`);
          const won = result.newHand.length === 0;

          const newPlayers = prev.players.map((p, i) => {
            if (i !== prev.currentPlayer) return p;
            return { ...p, hand: result.newHand, hasMelded: true };
          });

          // Mark the newly placed tile IDs so Board can animate them in
          const playedIds = new Set(result.tilesPlayed.map(t => t.id));
          setNewlyPlayedIds(playedIds);
          setTimeout(() => setNewlyPlayedIds(new Set()), 800);

          if (won) {
            const handValues = newPlayers.map((p, i) =>
              i === prev.currentPlayer ? 0 : calculateHandValue(p.hand)
            );
            const totalWon = handValues.reduce((a, b) => a + b, 0);
            const finalPlayers = newPlayers.map((p, i) => ({
              ...p,
              roundScore: i === prev.currentPlayer ? totalWon : -calculateHandValue(p.hand),
              score: p.score + (i === prev.currentPlayer ? totalWon : -calculateHandValue(p.hand)),
            }));
            addLog(`🏆 ${currentAI.name} wins the round!`);
            return { ...prev, players: finalPlayers, board: result.newBoard, phase: 'roundOver' };
          }

          return {
            ...prev,
            players: newPlayers,
            board: result.newBoard,
            currentPlayer: (prev.currentPlayer + 1) % prev.players.length,
          };
        } else {
          // Draw tile
          if (prev.pool.length > 0) {
            const [drawn, ...newPool] = prev.pool;
            addLog(`🤖 ${currentAI.name} drew a tile`);
            const newPlayers = prev.players.map((p, i) =>
              i === prev.currentPlayer ? { ...p, hand: [...p.hand, drawn] } : p
            );
            return {
              ...prev,
              players: newPlayers,
              pool: newPool,
              currentPlayer: (prev.currentPlayer + 1) % prev.players.length,
            };
          } else {
            addLog(`🤖 ${currentAI.name} passes (pool empty)`);
            return {
              ...prev,
              currentPlayer: (prev.currentPlayer + 1) % prev.players.length,
            };
          }
        }
      });

      setAnimatingAI(false);
    }, state.aiSpeed);

    return () => clearTimeout(aiTimerRef.current);
  }, [state.currentPlayer, state.phase, state.players, state.board, state.pool, state.aiSpeed, animatingAI, addLog]);

  // ── Round over → game over check ─────────────────────────
  useEffect(() => {
    if (state.phase === 'roundOver') {
      setShowGameOver(true);
    }
  }, [state.phase]);

  const handleNextRound = useCallback(() => {
    setShowGameOver(false);
    setState(prev => {
      const { createInitialState: _, ...rest } = prev;
      const newState = createInitialState(prev.players.map(p => p.name));
      return {
        ...newState,
        players: newState.players.map((p, i) => ({
          ...p,
          isHuman: i === 0,
          score: prev.players[i]?.score || 0,
        })),
        aiSpeed: prev.aiSpeed,
        debugMode: prev.debugMode,
        round: prev.round + 1,
      };
    });
    setWorkingBoard(null);
    setWorkingHand(null);
    setSelectedIds(new Set());
    setGameLog([]);
  }, []);

  // ── Render ────────────────────────────────────────────────
  const human = state.players[0];
  const aiPlayers = state.players.slice(1);
  const boardValid = !workingBoard || isValidBoard(workingBoard.filter(s => s.length > 0));

  return (
    <div className="game-container">
      {/* Header */}
      <div className="game-header">
        <button className="header-btn" onClick={onBackToMenu}>‹ Menu</button>
        <div className="game-logo-small">Rummikub</div>
        <div className="header-right">
          <span className="pool-count">🎱 {state.pool.length}</span>
          <button
            className={`header-btn ${debugMode ? 'active' : ''}`}
            onClick={() => setDebugMode(d => !d)}
          >
            {debugMode ? '🔍 Debug ON' : '🔍 Debug'}
          </button>
        </div>
      </div>

      <div className="game-body">
        {/* Left sidebar - opponents */}
        <div className="sidebar-left">
          {aiPlayers.map((ai, idx) => (
            <div
              key={ai.id}
              className={`player-card ${state.currentPlayer === ai.id ? 'player-card-active' : ''}`}
            >
              <div className="player-avatar" style={{ background: AVATAR_COLORS[idx + 1] }}>
                {AVATAR_ICONS[idx + 1]}
                {state.currentPlayer === ai.id && (
                  <div className="player-turn-ring" />
                )}
              </div>
              <div className="player-info">
                <div className="player-name">{ai.name}</div>
                <div className="player-tiles-count">🀱 {ai.hand.length}</div>
              </div>
              {/* AI hand - hidden or shown in debug mode */}
              <div className="ai-hand-preview">
                <HandRack
                  hand={ai.hand}
                  hidden={!debugMode}
                  small={true}
                  isCurrentPlayer={false}
                  sortByColor={sortByColor}
                />
              </div>
            </div>
          ))}

          {/* Scores */}
          <div className="scores-panel">
            <div className="scores-title">Scores</div>
            {state.players.map(p => (
              <div key={p.id} className="score-row">
                <span className="score-name">{p.name}</span>
                <span className="score-val">{p.score}</span>
              </div>
            ))}
          </div>

          {/* Game log */}
          <div className="game-log">
            {gameLog.slice(-8).map((msg, i) => (
              <div key={i} className="log-entry">{msg}</div>
            ))}
          </div>
        </div>

        {/* Main area */}
        <div className="main-area">
          {/* Board */}
          {isHumanTurn && !human?.hasMelded && state.board.length > 0 && (
            <div className="premeld-notice">
              🔒 Initial meld — you may only play new sets from your hand (≥30 pts). Board tiles are locked.
            </div>
          )}
          <Board
            sets={currentBoard}
            selectedIds={selectedIds}
            newlyPlayedIds={newlyPlayedIds}
            isInteractive={isHumanTurn}
            preMeld={isHumanTurn && !human?.hasMelded}
            originalBoardSize={state.board.length}
            onTileClick={handleBoardTileClick}
            onDropToSet={handleDropToSet}
            onDropToNew={handleDropToNew}
            onDragStartBoardTile={() => {}}
          />
        </div>

        {/* Right sidebar */}
        <div className="sidebar-right">
          <div className="round-badge">Round {state.round}</div>

          {/* Action buttons */}
          {isHumanTurn && (
            <div className="action-panel">
              {selectedIds.size >= 3 && (
                <button className="action-btn btn-play" onClick={handlePlaySelected}>
                  ▶ Play Selected ({selectedIds.size})
                </button>
              )}
              <button
                className={`action-btn btn-confirm ${!workingBoard ? 'disabled' : boardValid ? 'btn-confirm-ready' : 'btn-confirm-invalid'}`}
                onClick={handleConfirm}
                disabled={!workingBoard}
              >
                ✓ Confirm
              </button>
              <button className="action-btn btn-undo" onClick={handleUndo} disabled={!workingBoard}>
                ↺ Undo
              </button>
              <button className="action-btn btn-draw" onClick={handleDrawTile}>
                + Draw
              </button>
              <button className="action-btn btn-hint" onClick={() => setShowHint(h => !h)}>
                💡 Hint
              </button>
              <button
                className="action-btn btn-sort"
                onClick={() => setSortByColor(s => !s)}
              >
                {sortByColor ? '🎨 By Color' : '🔢 By Number'}
              </button>
            </div>
          )}

          {!isHumanTurn && (
            <div className="ai-thinking">
              <div className="ai-thinking-dot" />
              <div className="ai-thinking-dot" />
              <div className="ai-thinking-dot" />
              <span>{state.players[state.currentPlayer]?.name} is thinking…</span>
            </div>
          )}

          {/* Current player indicator */}
          <div className="current-turn-indicator">
            {isHumanTurn ? (
              <span className="your-turn">Your Turn</span>
            ) : (
              <span>{state.players[state.currentPlayer]?.name}'s Turn</span>
            )}
          </div>
        </div>
      </div>

      {/* Human player rack */}
      <div className="player-rack-area">
        <div className="player-rack-header">
          <div className="player-avatar player-avatar-self" style={{ background: AVATAR_COLORS[0] }}>
            {AVATAR_ICONS[0]}
            {isHumanTurn && <div className="player-turn-ring" />}
          </div>
          <div>
            <div className="player-name">{human?.name}</div>
            <div className="player-tiles-count">🀱 {(workingHand || human?.hand || []).length} tiles</div>
          </div>
          {human?.hasMelded && <span className="melded-badge">Melded ✓</span>}
        </div>
        <HandRack
          hand={workingHand || human?.hand || []}
          selectedIds={selectedIds}
          onSelect={handleTileSelect}
          onDragStart={() => {}}
          isCurrentPlayer={isHumanTurn}
          hidden={false}
          sortByColor={sortByColor}
        />
      </div>

      {/* Hint panel */}
      {showHint && (
        <HintPanel
          hint={computeHint(currentHand, state.board, human?.hasMelded)}
          onClose={() => setShowHint(false)}
        />
      )}

      {/* Game Over / Round Over overlay */}
      {showGameOver && (
        <div className="overlay">
          <div className="gameover-card">
            <div className="gameover-title">
              {state.phase === 'roundOver' ? 'Round Over!' : 'Game Over!'}
            </div>
            <div className="gameover-scores">
              {[...state.players]
                .sort((a, b) => b.score - a.score)
                .map((p, rank) => (
                  <div key={p.id} className={`gameover-row ${rank === 0 ? 'gameover-winner' : ''}`}>
                    <span className="gameover-rank">
                      {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `${rank + 1}.`}
                    </span>
                    <span className="gameover-pname">{p.name}</span>
                    <span className="gameover-score">{p.score > 0 ? '+' : ''}{p.score}</span>
                  </div>
                ))}
            </div>
            <div className="gameover-actions">
              <button className="gameover-btn btn-play-again" onClick={handleNextRound}>
                ▶ Next Round
              </button>
              <button className="gameover-btn btn-menu" onClick={onBackToMenu}>
                ↩ Main Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
