import React from 'react';

const COLOR_MAP = {
  red: '#e84040',
  blue: '#4a90e2',
  black: '#2a2a3a',
  orange: '#f0832a',
  joker: '#9b59b6',
};

const TEXT_COLOR = {
  red: '#e84040',
  blue: '#4a90e2',
  black: '#1a1a2e',
  orange: '#f0832a',
  joker: '#9b59b6',
};

export default function Tile({ tile, selected, onClick, small, faceDown }) {
  if (!tile) return null;

  const style = {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: small ? '38px' : 'var(--tile-w)',
    height: small ? '50px' : 'var(--tile-h)',
    background: faceDown ? '#2a2d3e' : selected ? 'var(--tile-selected)' : 'var(--tile-bg)',
    border: selected
      ? '2px solid var(--accent-gold)'
      : faceDown
      ? '1.5px solid #3a3d50'
      : '1.5px solid #ccc',
    borderRadius: '6px',
    cursor: onClick ? 'pointer' : 'default',
    userSelect: 'none',
    transition: 'all 0.15s ease',
    transform: selected ? 'translateY(-6px)' : 'none',
    boxShadow: selected
      ? '0 6px 16px rgba(212,168,67,0.4)'
      : '0 2px 4px rgba(0,0,0,0.3)',
    flexShrink: 0,
  };

  const numStyle = {
    fontSize: small ? '14px' : '20px',
    fontWeight: '700',
    fontFamily: "'Playfair Display', serif",
    color: faceDown ? 'transparent' : TEXT_COLOR[tile.color] || '#333',
    lineHeight: 1,
  };

  const dotStyle = {
    width: small ? '4px' : '5px',
    height: small ? '4px' : '5px',
    borderRadius: '50%',
    background: faceDown ? 'transparent' : COLOR_MAP[tile.color] || '#333',
    marginTop: '2px',
  };

  return (
    <div style={style} onClick={onClick} title={tile.isJoker ? 'Joker' : `${tile.number} ${tile.color}`}>
      {faceDown ? (
        <span style={{ fontSize: small ? '16px' : '22px' }}>🂠</span>
      ) : tile.isJoker ? (
        <span style={{ fontSize: small ? '16px' : '22px' }}>★</span>
      ) : (
        <>
          <span style={numStyle}>{tile.number}</span>
          <div style={dotStyle} />
        </>
      )}
    </div>
  );
}
