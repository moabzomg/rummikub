import React, { useRef, useEffect } from 'react';
import Tile from './Tile';
import { isValidSet } from '../utils/gameEngine';
import { useDrag } from './DragContext';

export default function Board({
  sets,
  selectedIds,
  newlyPlayedIds,
  onTileClick,
  onDropToSet,
  onDropToNew,
  onDragStartBoardTile,
  isInteractive,
  preMeld = false,
  originalBoardSize = 0,
}) {
  const dragCtx = useDrag();
  const setZoneRefs = useRef([]);
  const newSetZoneRef = useRef(null);
  const boardRef = useRef(null);

  // Register pointer drop zones and wire the drop handler
  useEffect(() => {
    if (!dragCtx || !isInteractive) return;

    setZoneRefs.current.forEach((el, idx) => {
      if (el) dragCtx.registerDropZone(el, 'set', idx);
    });
    if (newSetZoneRef.current) dragCtx.registerDropZone(newSetZoneRef.current, 'new', -1);
    if (boardRef.current)      dragCtx.registerDropZone(boardRef.current, 'board', -1);

    dragCtx.setOnDrop((dragData, zone) => {
      const { tile, source } = dragData;
      if (zone.type === 'set') {
        onDropToSet?.(tile.id, source, zone.setIdx);
      } else {
        onDropToNew?.(tile.id, source);
      }
    });

    return () => {
      setZoneRefs.current.forEach(el => { if (el) dragCtx.unregisterDropZone(el); });
      if (newSetZoneRef.current) dragCtx.unregisterDropZone(newSetZoneRef.current);
      if (boardRef.current)      dragCtx.unregisterDropZone(boardRef.current);
    };
  });   // re-runs each render so refs stay current

  // HTML5 drag fallback (desktop)
  const handleDragOver = e => e.preventDefault();

  const handleSetDrop = (e, setIdx) => {
    e.preventDefault(); e.stopPropagation();
    const tileId = parseInt(e.dataTransfer.getData('tileId'));
    const source = e.dataTransfer.getData('source');
    if (tileId) onDropToSet?.(tileId, source, setIdx);
  };

  const handleBoardDrop = e => {
    e.preventDefault();
    const tileId = parseInt(e.dataTransfer.getData('tileId'));
    const source = e.dataTransfer.getData('source');
    if (tileId && e.target === e.currentTarget) onDropToNew?.(tileId, source);
  };

  return (
    <div
      ref={boardRef}
      className="board"
      onDragOver={handleDragOver}
      onDrop={handleBoardDrop}
    >
      {sets.length === 0 && (
        <div className="board-empty">Drop tiles here to start a set</div>
      )}
      <div className="board-sets">
        {sets.map((set, setIdx) => {
          const valid = isValidSet(set);
          const isLockedSet = preMeld && setIdx < originalBoardSize;
          return (
            <div
              key={setIdx}
              ref={el => { setZoneRefs.current[setIdx] = el; }}
              className={`board-set ${valid ? 'set-valid' : 'set-invalid'} ${isLockedSet ? 'set-locked' : ''}`}
              onDragOver={handleDragOver}
              onDrop={e => handleSetDrop(e, setIdx)}
            >
              {set.map(tile => (
                <Tile
                  key={tile.id}
                  tile={tile}
                  selected={selectedIds?.has(tile.id)}
                  isNew={newlyPlayedIds?.has(tile.id)}
                  draggable={isInteractive && !isLockedSet}
                  source="board"
                  sourceSetIdx={setIdx}
                  onClick={() => isInteractive && !isLockedSet && onTileClick?.(tile, setIdx)}
                  onDragStart={e => {
                    if (isLockedSet) { e.preventDefault(); return; }
                    e.dataTransfer.setData('tileId', String(tile.id));
                    e.dataTransfer.setData('source', 'board');
                    e.dataTransfer.setData('sourceSetIdx', String(setIdx));
                    onDragStartBoardTile?.(tile, setIdx);
                  }}
                />
              ))}
              {isLockedSet && <span className="set-lock-icon">🔒</span>}
            </div>
          );
        })}

        {isInteractive && (
          <div
            ref={newSetZoneRef}
            className="board-set board-set-new"
            onDragOver={handleDragOver}
            onDrop={e => {
              e.preventDefault(); e.stopPropagation();
              const tileId = parseInt(e.dataTransfer.getData('tileId'));
              const source = e.dataTransfer.getData('source');
              if (tileId) onDropToNew?.(tileId, source);
            }}
          >
            <span className="board-set-new-label">+ New Set</span>
          </div>
        )}
      </div>
    </div>
  );
}
