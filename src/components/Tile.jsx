import React, { useRef, useCallback } from 'react';

export default function Tile({
  tile,
  src,             // 'hand' | 'board'
  si,              // set index (board only)
  ti,              // tile index
  selected,
  highlighted,
  aiPlaced,
  isHuman,
  debugMode,
  onClickTile,
  onDblClickTile,
  onDragStart,
  onDragEnd,
  showColor,       // show color label
}) {
  const longPressRef = useRef(null);
  const longPressActiveRef = useRef(false);

  const cls = ['tile', 'c-' + tile.color];
  if (src === 'board') cls.push('in-board');
  if (selected) cls.push('selected');
  if (highlighted) cls.push('hint-highlight');
  if (aiPlaced) cls.push('ai-placed');
  if (!isHuman) cls.push('no-cursor');

  const handlePointerDown = useCallback((e) => {
    if (!isHuman || src !== 'hand') return;
    longPressActiveRef.current = false;
    longPressRef.current = setTimeout(() => {
      longPressActiveRef.current = true;
    }, 380);
  }, [isHuman, src]);

  const handlePointerUp = useCallback(() => {
    clearTimeout(longPressRef.current);
    longPressActiveRef.current = false;
  }, []);

  const handleClick = useCallback((e) => {
    if (!isHuman) return;
    if (longPressActiveRef.current) return;
    onClickTile && onClickTile(e, tile, src, si);
  }, [isHuman, onClickTile, tile, src, si]);

  const handleDblClick = useCallback((e) => {
    if (!isHuman) return;
    e.preventDefault();
    onDblClickTile && onDblClickTile(e, tile, src, si);
  }, [isHuman, onDblClickTile, tile, src, si]);

  const handleDragStart = useCallback((e) => {
    if (!isHuman) return;
    onDragStart && onDragStart(e, tile, src, si);
  }, [isHuman, onDragStart, tile, src, si]);

  const handleDragEnd = useCallback((e) => {
    onDragEnd && onDragEnd(e);
  }, [onDragEnd]);

  // Debug: show color for AI tiles
  const showColorLabel = debugMode && src === 'hand';

  return (
    <div
      className={cls.join(' ')}
      data-id={tile.id}
      data-src={src}
      data-si={si}
      data-ti={ti}
      draggable={isHuman}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onClick={handleClick}
      onDoubleClick={handleDblClick}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      title={src === 'board' ? 'Double-click to return to hand' : undefined}
      style={{ cursor: isHuman ? 'grab' : 'default' }}
    >
      <div className="t-num">{tile.isJoker ? '★' : tile.num}</div>
      {showColorLabel && !tile.isJoker && (
        <div className="t-color">{tile.color[0].toUpperCase()}</div>
      )}
    </div>
  );
}
