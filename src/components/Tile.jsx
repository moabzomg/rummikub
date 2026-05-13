import React, { useCallback } from 'react';

export default function Tile({ tile, src, si, ti, selected, highlighted, aiPlaced, isHuman, debugMode, onClickTile, onDblClickTile, onDragStart, onDragEnd }) {
  const cls = ['tile', 'c-' + tile.color];
  if (src === 'board') cls.push('in-board');
  if (selected) cls.push('selected');
  if (highlighted) cls.push('hint-highlight');
  if (aiPlaced) cls.push('ai-placed');

  const handleClick = useCallback((e) => {
    if (!isHuman) return;
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

  const handleDragEnd = useCallback((e) => { onDragEnd && onDragEnd(e); }, [onDragEnd]);

  return (
    <div
      className={cls.join(' ')}
      data-id={tile.id} data-src={src} data-si={si} data-ti={ti}
      draggable={!!isHuman}
      onClick={handleClick} onDoubleClick={handleDblClick}
      onDragStart={handleDragStart} onDragEnd={handleDragEnd}
      title={src === 'board' && isHuman ? 'Double-click to return to hand' : undefined}
      style={{ cursor: isHuman ? 'grab' : 'default' }}
    >
      {tile.isJoker
        ? <div className="joker-face">☺</div>
        : <div className="t-num">{tile.num}</div>
      }
      {debugMode && src === 'hand' && !tile.isJoker && (
        <div className="t-color">{tile.color[0].toUpperCase()}</div>
      )}
    </div>
  );
}
