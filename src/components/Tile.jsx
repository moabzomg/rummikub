import React from 'react';

const COLOR_STYLES = {
  black: { color: '#1a1a1a' },
  blue: { color: '#1565c0' },
  orange: { color: '#e65100' },
  red: { color: '#c62828' },
  joker: { color: '#8e24aa' },
};

export default function Tile({
  tile,
  hidden = false,
  selected = false,
  draggable = false,
  onDragStart,
  onClick,
  small = false,
  style = {},
}) {
  if (!tile) return null;

  const sizeClass = small ? 'tile tile-small' : 'tile';

  if (hidden) {
    return (
      <div
        className={`${sizeClass} tile-hidden`}
        style={style}
      />
    );
  }

  const colorStyle = COLOR_STYLES[tile.color] || COLOR_STYLES.black;

  return (
    <div
      className={`${sizeClass} ${selected ? 'tile-selected' : ''} ${draggable ? 'tile-draggable' : ''}`}
      style={{ ...colorStyle, ...style }}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
    >
      {tile.isJoker ? (
        <span className="tile-joker-icon">☺</span>
      ) : (
        <span className="tile-number">{tile.number}</span>
      )}
    </div>
  );
}
