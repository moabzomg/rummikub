import React, { useState } from 'react';

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-dark)',
    padding: '24px',
  },
  title: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 'clamp(48px, 8vw, 80px)',
    fontWeight: 900,
    color: 'var(--accent-gold)',
    letterSpacing: '-2px',
    textShadow: '0 0 40px rgba(212,168,67,0.3)',
    marginBottom: '8px',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    marginBottom: '48px',
    fontSize: '13px',
    letterSpacing: '3px',
    textTransform: 'uppercase',
  },
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '36px',
    width: '100%',
    maxWidth: '440px',
  },
  modeBtn: {
    width: '100%',
    padding: '16px 20px',
    marginBottom: '12px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    color: 'var(--text-primary)',
    fontSize: '14px',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    transition: 'all 0.2s',
  },
  modeBtnActive: {
    borderColor: 'var(--accent-gold)',
    background: 'rgba(212,168,67,0.08)',
  },
  icon: {
    fontSize: '24px',
    width: '32px',
    textAlign: 'center',
  },
  label: {
    fontWeight: 500,
    marginBottom: '2px',
  },
  desc: {
    color: 'var(--text-secondary)',
    fontSize: '12px',
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    background: 'var(--bg-dark)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontFamily: "'DM Mono', monospace",
    fontSize: '14px',
    marginBottom: '10px',
    outline: 'none',
  },
  startBtn: {
    width: '100%',
    padding: '14px',
    marginTop: '8px',
    background: 'var(--accent-gold)',
    color: '#1a1200',
    fontSize: '15px',
    fontWeight: 700,
    fontFamily: "'DM Mono', monospace",
    borderRadius: '10px',
    letterSpacing: '1px',
    transition: 'opacity 0.2s',
  },
  sectionLabel: {
    color: 'var(--text-secondary)',
    fontSize: '11px',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    marginBottom: '12px',
    marginTop: '24px',
  },
};

const MODES = [
  { id: '1v1-ai', icon: '🤖', label: '1 Player vs AI', desc: 'You vs computer opponent' },
  { id: '2p', icon: '👥', label: '2 Players', desc: 'Local multiplayer, 2 humans' },
  { id: '3p', icon: '👥', label: '3 Players', desc: 'Local multiplayer, 3 humans' },
  { id: '4p', icon: '👥', label: '4 Players', desc: 'Local multiplayer, 4 humans' },
];

const PLAYER_COUNTS = { '1v1-ai': 2, '2p': 2, '3p': 3, '4p': 4 };
const AI_SLOTS = { '1v1-ai': [1] };

export default function MenuScreen({ onStart }) {
  const [mode, setMode] = useState(null);
  const [names, setNames] = useState(['', '', '', '']);

  const count = mode ? PLAYER_COUNTS[mode] : 0;
  const aiSlots = AI_SLOTS[mode] || [];

  const handleStart = () => {
    if (!mode) return;
    const playerNames = Array.from({ length: count }, (_, i) =>
      aiSlots.includes(i) ? 'AI' : (names[i].trim() || `Player ${i + 1}`)
    );
    onStart(mode, playerNames);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>RUMMIKUB</h1>
      <p style={styles.subtitle}>The Classic Tile Game</p>

      <div style={styles.card}>
        <div style={styles.sectionLabel}>Game Mode</div>
        {MODES.map(m => (
          <button
            key={m.id}
            style={{ ...styles.modeBtn, ...(mode === m.id ? styles.modeBtnActive : {}) }}
            onClick={() => setMode(m.id)}
          >
            <span style={styles.icon}>{m.icon}</span>
            <div>
              <div style={styles.label}>{m.label}</div>
              <div style={styles.desc}>{m.desc}</div>
            </div>
          </button>
        ))}

        {mode && (
          <>
            <div style={styles.sectionLabel}>Player Names</div>
            {Array.from({ length: count }, (_, i) => (
              aiSlots.includes(i) ? (
                <div key={i} style={{ ...styles.input, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                  🤖 AI Opponent
                </div>
              ) : (
                <input
                  key={i}
                  style={styles.input}
                  placeholder={`Player ${i + 1} name`}
                  value={names[i]}
                  onChange={e => {
                    const n = [...names];
                    n[i] = e.target.value;
                    setNames(n);
                  }}
                />
              )
            ))}

            <button style={styles.startBtn} onClick={handleStart}>
              START GAME →
            </button>
          </>
        )}
      </div>
    </div>
  );
}
