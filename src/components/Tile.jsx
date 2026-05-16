import React, { useRef } from 'react';
import { useDrag } from './DragContext';

const COLOR_STYLES = {
  black: { color: '#1a1a1a' },
  blue:  { color: '#1565c0' },
  orange:{ color: '#e65100' },
  red:   { color: '#c62828' },
  joker: { color: '#8e24aa' },
};

// DRAG_THRESHOLD: pixels moved before drag starts (not a tap)
const DRAG_THRESHOLD = 6;

export default function Tile({
  tile,
  hidden     = false,
  selected   = false,
  isNew      = false,
  draggable  = false,
  onClick,
  small      = false,
  style      = {},
  source     = 'hand',
  sourceSetIdx,
  // Optional: if provided, dragging this tile will drag the whole group
  groupTiles,
}) {
  const dragCtx = useDrag();
  const downPos  = useRef(null);
  const dragging = useRef(false);

  if (!tile) return null;

  const sizeClass = small ? 'tile tile-small' : 'tile';

  if (hidden) return <div className={`${sizeClass} tile-hidden`} style={style} />;

  const colorStyle = COLOR_STYLES[tile.color] || COLOR_STYLES.black;

  const handlePointerDown = (e) => {
    if (!draggable) return;
    e.stopPropagation();
    downPos.current  = { x: e.clientX, y: e.clientY };
    dragging.current = false;
    // Capture so we get move/up even if pointer leaves tile
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!draggable || !downPos.current || dragging.current) return;
    const dx = e.clientX - downPos.current.x;
    const dy = e.clientY - downPos.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
      dragging.current = true;
      // Release capture so pointer events reach underlying elements (drop zones)
      e.currentTarget.releasePointerCapture(e.pointerId);
      const tiles = groupTiles || [tile];
      dragCtx?.startDrag(tiles, source, sourceSetIdx, e.clientX, e.clientY);
    }
  };

  const handlePointerUp = (e) => {
    if (!dragging.current) {
      onClick?.(e);
    }
    downPos.current  = null;
    dragging.current = false;
  };

  const handlePointerCancel = () => {
    downPos.current  = null;
    dragging.current = false;
  };

  // Hide the original tile while it's being dragged as ghost
  const isBeingDragged = dragCtx?.drag?.tiles?.some(t => t.id === tile.id);

  return (
    <div
      className={`${sizeClass} ${selected ? 'tile-selected' : ''} ${isNew ? 'tile-new' : ''} ${draggable ? 'tile-draggable' : ''}`}
      style={{
        ...colorStyle,
        ...style,
        touchAction: draggable ? 'none' : 'auto',
        // Fade source tile(s) while dragging — don't fully hide so layout stays stable
        opacity: isBeingDragged ? 0.25 : 1,
        transition: 'opacity 0.1s',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {tile.isJoker
        ? <span className="tile-joker-icon">☺</span>
        : <span className="tile-number">{tile.number}</span>
      }
    </div>
  );
}
