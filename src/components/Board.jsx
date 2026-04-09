import React from 'react';
import Tile from './Tile.jsx';
import { isValidSet } from '../game/logic.js';

const styles = {
  board: {
    background: 'var(--bg-table)',
    borderRadius: '12px',
    padding: '16px',
    minHeight: '160px',
    border: '1px solid rgba(255,255,255,0.06)',
    overflowX: 'auto',
  },
  header: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: '11px',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    marginBottom: '12px',
  },
  setsWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
  },
  setGroup: {
    display: 'flex',
    gap: '4px',
    padding: '8px',
    background: 'rgba(0,0,0,0.2)',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  invalidSet: {
    border: '1px solid rgba(232,64,64,0.5)',
    background: 'rgba(232,64,64,0.08)',
  },
  emptyMsg: {
    color: 'rgba(255,255,255,0.15)',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: '30px',
    fontSize: '13px',
  },
};

export default function Board({ sets }) {
  if (!sets || sets.length === 0) {
    return (
      <div style={styles.board}>
        <div style={styles.header}>TABLE</div>
        <div style={styles.emptyMsg}>No sets played yet — be the first!</div>
      </div>
    );
  }

  return (
    <div style={styles.board}>
      <div style={styles.header}>TABLE — {sets.length} set{sets.length !== 1 ? 's' : ''}</div>
      <div style={styles.setsWrap}>
        {sets.map((set, i) => {
          const valid = isValidSet(set);
          return (
            <div key={i} style={{ ...styles.setGroup, ...(!valid ? styles.invalidSet : {}) }}>
              {set.map(tile => (
                <Tile key={tile.id} tile={tile} small />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
