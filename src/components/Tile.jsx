import React, { useRef } from 'react';
import { useDrag } from './DragContext';

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
  isNew = false,
  draggable = false,
  onDragStart,   // kept for HTML5 compat
  onClick,
  small = false,
  style = {},
  source = 'hand',
  sourceSetIdx,
}) {
  const dragCtx = useDrag();
  const pointerDownPos = useRef(null);
  const isDragging = useRef(false);

  if (!tile) return null;

  const sizeClass = small ? 'tile tile-small' : 'tile';

  if (hidden) {
    return <div className={`${sizeClass} tile-hidden`} style={style} />;
  }

  const colorStyle = COLOR_STYLES[tile.color] || COLOR_STYLES.black;

  const handlePointerDown = (e) => {
    if (!draggable) return;
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
    isDragging.current = false;
  };

  const handlePointerMove = (e) => {
    if (!draggable || !pointerDownPos.current) return;
    const dx = e.clientX - pointerDownPos.current.x;
    const dy = e.clientY - pointerDownPos.current.y;
    if (!isDragging.current && Math.sqrt(dx*dx + dy*dy) > 6) {
      isDragging.current = true;
      e.target.releasePointerCapture?.(e.pointerId);
      dragCtx?.startDrag(tile, source, sourceSetIdx, e.clientX, e.clientY);
    }
  };

  const handlePointerUp = () => {
    if (!isDragging.current && pointerDownPos.current) {
      // It was a tap/click, not a drag
    }
    pointerDownPos.current = null;
    isDragging.current = false;
  };

  const handleClick = (e) => {
    if (!isDragging.current) onClick?.(e);
  };

  return (
    <div
      className={`${sizeClass} ${selected ? 'tile-selected' : ''} ${isNew ? 'tile-new' : ''} ${draggable ? 'tile-draggable' : ''}`}
      style={{ ...colorStyle, ...style, touchAction: draggable ? 'none' : 'auto' }}
      draggable={draggable}
      onDragStart={onDragStart}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={handleClick}
    >
      {tile.isJoker ? (
        <span className="tile-joker-icon">☺</span>
      ) : (
        <span className="tile-number">{tile.number}</span>
      )}
    </div>
  );
}
