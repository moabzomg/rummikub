import React from 'react';
import Board from './Board.jsx';
import PlayerHand from './PlayerHand.jsx';
import Tile from './Tile.jsx';
import { isValidSet, initialMeldValue } from '../game/logic.js';

const btn = (extra = {}) => ({
  padding: '10px 18px',
  borderRadius: '8px',
  fontSize: '13px',
  fontFamily: "'DM Mono', monospace",
  fontWeight: 600,
  cursor: 'pointer',
  border: 'none',
  transition: 'opacity 0.15s',
  ...extra,
});

const styles = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-dark)',
  },
  topBar: {
    padding: '12px 20px',
    background: 'var(--bg-card)',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  logo: {
    fontFamily: "'Playfair Display', serif",
    fontWeight: 900,
    fontSize: '20px',
    color: 'var(--accent-gold)',
    letterSpacing: '-1px',
  },
  msgBox: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '7px 14px',
    color: 'var(--text-primary)',
    fontSize: '13px',
    flex: 1,
    textAlign: 'center',
    maxWidth: '400px',
  },
  poolBadge: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '7px 12px',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
  },
  main: {
    flex: 1,
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    overflowY: 'auto',
  },
  twoCol: {
    display: 'flex',
    gap: '14px',
    alignItems: 'flex-start',
  },
  boardWrap: {
    flex: 1,
    minWidth: 0,
  },
  logBox: {
    width: '200px',
    flexShrink: 0,
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '12px',
    fontSize: '11px',
    color: 'var(--text-secondary)',
    maxHeight: '220px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  logEntry: {
    padding: '4px 0',
    borderBottom: '1px solid var(--border)',
    lineHeight: 1.4,
  },
  actionBar: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    padding: '12px 20px',
    background: 'var(--bg-card)',
    borderTop: '1px solid var(--border)',
    flexWrap: 'wrap',
  },
  selPreview: {
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
    flex: 1,
    overflowX: 'auto',
    minHeight: '50px',
  },
  validLabel: {
    fontSize: '11px',
    padding: '3px 8px',
    borderRadius: '4px',
    background: 'rgba(74,222,128,0.15)',
    color: '#4ade80',
    border: '1px solid rgba(74,222,128,0.3)',
    flexShrink: 0,
  },
  invalidLabel: {
    fontSize: '11px',
    padding: '3px 8px',
    borderRadius: '4px',
    background: 'rgba(232,64,64,0.1)',
    color: '#e84040',
    border: '1px solid rgba(232,64,64,0.2)',
    flexShrink: 0,
  },
  aiOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    backdropFilter: 'blur(2px)',
  },
  aiBox: {
    background: 'var(--bg-card)',
    border: '1px solid var(--accent-gold-dim)',
    borderRadius: '16px',
    padding: '32px 48px',
    textAlign: 'center',
    fontSize: '15px',
    color: 'var(--text-primary)',
  },
};

export default function GameScreen({
  players, currentPlayer, board, pool, selected,
  toggleSelectTile, message, log, aiThinking,
  playTiles, drawTile, setSelected, setScreen,
}) {
  const cp = players[currentPlayer];
  if (!cp) return null;

  const selectedTiles = cp.hand.filter(t => selected.includes(t.id));
  const setValid = selectedTiles.length >= 3 && isValidSet(selectedTiles);
  const meldVal = setValid ? initialMeldValue([selectedTiles]) : 0;

  return (
    <div style={styles.root}>
      {/* Top bar */}
      <div style={styles.topBar}>
        <div style={styles.logo}>RUMMIKUB</div>
        <div style={styles.msgBox}>{message}</div>
        <div style={styles.poolBadge}>🎱 Pool: {pool.length}</div>
        <button
          style={btn({ background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' })}
          onClick={() => setScreen('menu')}
        >
          ✕ Quit
        </button>
      </div>

      <div style={styles.main}>
        {/* Board + Log */}
        <div style={styles.twoCol}>
          <div style={styles.boardWrap}>
            <Board sets={board} />
          </div>
          <div style={styles.logBox}>
            <div style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>Log</div>
            {[...log].reverse().map((entry, i) => (
              <div key={i} style={styles.logEntry}>{entry}</div>
            ))}
          </div>
        </div>

        {/* All player hands */}
        {players.map((player, i) => (
          <PlayerHand
            key={player.id}
            player={player}
            isActive={i === currentPlayer}
            selected={i === currentPlayer ? selected : []}
            onTileClick={i === currentPlayer ? toggleSelectTile : null}
            hideHand={player.isAI}
          />
        ))}
      </div>

      {/* Action bar */}
      <div style={styles.actionBar}>
        <div style={styles.selPreview}>
          {selectedTiles.length === 0 && (
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
              {cp.isAI ? 'AI is playing...' : 'Click tiles from your hand to select them'}
            </span>
          )}
          {selectedTiles.map(t => <Tile key={t.id} tile={t} small />)}
          {selectedTiles.length >= 3 && (
            <span style={setValid ? styles.validLabel : styles.invalidLabel}>
              {setValid ? `✓ Valid set${!cp.hasInitialMeld ? ` · ${meldVal}pts` : ''}` : '✗ Invalid'}
            </span>
          )}
          {!cp.hasInitialMeld && setValid && meldVal < 30 && (
            <span style={styles.invalidLabel}>Need ≥30 pts for first meld</span>
          )}
        </div>

        {!cp.isAI && (
          <>
            <button
              style={btn({ background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' })}
              onClick={() => setSelected([])}
              disabled={selected.length === 0}
            >
              Clear
            </button>
            <button
              style={btn({
                background: setValid && (cp.hasInitialMeld || meldVal >= 30) ? '#4ade80' : 'var(--bg-surface)',
                color: setValid && (cp.hasInitialMeld || meldVal >= 30) ? '#0f2a1a' : 'var(--text-muted)',
                border: '1px solid var(--border)',
              })}
              onClick={playTiles}
              disabled={!setValid || (!cp.hasInitialMeld && meldVal < 30)}
            >
              ▶ Play Set
            </button>
            <button
              style={btn({ background: 'var(--accent-gold)', color: '#1a1200' })}
              onClick={drawTile}
            >
              Draw & End Turn
            </button>
          </>
        )}
      </div>

      {/* AI thinking overlay */}
      {aiThinking && (
        <div style={styles.aiOverlay}>
          <div style={styles.aiBox}>
            🤖 AI is thinking...
          </div>
        </div>
      )}
    </div>
  );
}
