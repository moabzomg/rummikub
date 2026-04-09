import React from 'react';
import Tile from './Tile.jsx';
import { handValue } from '../game/logic.js';

const styles = {
  wrap: {
    background: 'var(--bg-card)',
    borderRadius: '12px',
    padding: '14px',
    border: '1px solid var(--border)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  name: {
    fontWeight: 600,
    fontSize: '13px',
  },
  meta: {
    color: 'var(--text-secondary)',
    fontSize: '12px',
  },
  tilesWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '5px',
  },
  badge: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '20px',
    padding: '2px 10px',
    fontSize: '11px',
    color: 'var(--text-secondary)',
  },
  meldBadge: {
    background: 'rgba(212,168,67,0.15)',
    border: '1px solid var(--accent-gold-dim)',
    borderRadius: '20px',
    padding: '2px 10px',
    fontSize: '11px',
    color: 'var(--accent-gold)',
  },
  activeIndicator: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#4ade80',
    boxShadow: '0 0 8px rgba(74,222,128,0.6)',
    display: 'inline-block',
    marginRight: '6px',
  },
};

export default function PlayerHand({
  player,
  isActive,
  selected,
  onTileClick,
  hideHand,
}) {
  const value = handValue(player.hand);

  return (
    <div style={{
      ...styles.wrap,
      ...(isActive ? { border: '1px solid rgba(212,168,67,0.4)', boxShadow: '0 0 16px rgba(212,168,67,0.1)' } : {}),
    }}>
      <div style={styles.header}>
        <div style={styles.name}>
          {isActive && <span style={styles.activeIndicator} />}
          {player.isAI ? '🤖 ' : ''}{player.name}
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={styles.badge}>{player.hand.length} tiles</span>
          <span style={styles.badge}>{value} pts</span>
          {player.hasInitialMeld && <span style={styles.meldBadge}>✓ melded</span>}
        </div>
      </div>

      <div style={styles.tilesWrap}>
        {player.hand.map(tile => (
          <Tile
            key={tile.id}
            tile={tile}
            selected={selected?.includes(tile.id)}
            onClick={isActive && onTileClick && !player.isAI ? () => onTileClick(tile.id) : undefined}
            faceDown={hideHand}
          />
        ))}
      </div>
    </div>
  );
}
