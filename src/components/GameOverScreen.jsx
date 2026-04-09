import React from 'react';
import { handValue } from '../game/logic.js';

const styles = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-dark)',
    padding: '24px',
  },
  trophy: {
    fontSize: '72px',
    marginBottom: '16px',
    filter: 'drop-shadow(0 0 30px rgba(212,168,67,0.5))',
  },
  title: {
    fontFamily: "'Playfair Display', serif",
    fontSize: '48px',
    fontWeight: 900,
    color: 'var(--accent-gold)',
    marginBottom: '8px',
  },
  winner: {
    fontSize: '20px',
    color: 'var(--text-primary)',
    marginBottom: '40px',
  },
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '28px',
    width: '100%',
    maxWidth: '400px',
    marginBottom: '24px',
  },
  scoreLabel: {
    color: 'var(--text-secondary)',
    fontSize: '11px',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    marginBottom: '14px',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderBottom: '1px solid var(--border)',
    fontSize: '14px',
  },
  playAgainBtn: {
    padding: '14px 32px',
    background: 'var(--accent-gold)',
    color: '#1a1200',
    fontSize: '15px',
    fontWeight: 700,
    fontFamily: "'DM Mono', monospace",
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    marginRight: '12px',
  },
  menuBtn: {
    padding: '14px 24px',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    fontFamily: "'DM Mono', monospace",
    borderRadius: '10px',
    border: '1px solid var(--border)',
    cursor: 'pointer',
  },
};

export default function GameOverScreen({ winner, players, onPlayAgain, onMenu }) {
  const sorted = [...players].sort((a, b) => handValue(a.hand) - handValue(b.hand));

  return (
    <div style={styles.root}>
      <div style={styles.trophy}>🏆</div>
      <h1 style={styles.title}>Game Over!</h1>
      <p style={styles.winner}>{winner?.name} wins!</p>

      <div style={styles.card}>
        <div style={styles.scoreLabel}>Final Scores (tiles remaining)</div>
        {sorted.map(p => (
          <div key={p.id} style={styles.row}>
            <span>
              {p.id === winner?.id ? '👑 ' : ''}{p.isAI ? '🤖 ' : ''}{p.name}
            </span>
            <span style={{ color: handValue(p.hand) === 0 ? '#4ade80' : 'var(--text-primary)' }}>
              {handValue(p.hand) === 0 ? '0 pts ✓' : `${handValue(p.hand)} pts`}
            </span>
          </div>
        ))}
      </div>

      <div>
        <button style={styles.playAgainBtn} onClick={onPlayAgain}>Play Again</button>
        <button style={styles.menuBtn} onClick={onMenu}>Main Menu</button>
      </div>
    </div>
  );
}
