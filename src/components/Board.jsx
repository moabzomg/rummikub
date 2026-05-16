import React, { useRef, useEffect, useCallback } from 'react';
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
  onDropGroupToHand,
  isInteractive,
  preMeld = false,
  originalBoardSize = 0,
}) {
  const dragCtx      = useDrag();
  const setZoneRefs  = useRef([]);
  const newZoneRef   = useRef(null);
  const boardRef     = useRef(null);

  // Re-register every render so callbacks and setIdx are always fresh
  useEffect(() => {
    if (!dragCtx || !isInteractive) return;

    // Per-set zones
    setZoneRefs.current.forEach((el, idx) => {
      if (!el) return;
      dragCtx.registerDropZone(el, (dragData) => {
        const { tiles, source } = dragData;
        if (tiles.length === 1) {
          onDropToSet?.(tiles[0].id, source, idx);
        } else {
          // group dropped onto a set — treat as new set
          onDropToNew?.(tiles[0].id, source);
        }
      });
    });

    // New-set zone
    if (newZoneRef.current) {
      dragCtx.registerDropZone(newZoneRef.current, (dragData) => {
        const { tiles, source } = dragData;
        if (tiles.length === 1) {
          onDropToNew?.(tiles[0].id, source);
        } else {
          onDropGroupToHand?.(tiles, source, dragData.sourceSetIdx);
        }
      });
    }

    // Whole board as fallback new-set zone (larger area)
    if (boardRef.current) {
      dragCtx.registerDropZone(boardRef.current, (dragData) => {
        const { tiles, source } = dragData;
        if (tiles.length === 1) {
          onDropToNew?.(tiles[0].id, source);
        }
        // groups on board background = no-op (they'd go to hand via hand rack zone)
      });
    }

    return () => {
      setZoneRefs.current.forEach(el => { if (el) dragCtx.unregisterDropZone(el); });
      if (newZoneRef.current)  dragCtx.unregisterDropZone(newZoneRef.current);
      if (boardRef.current)    dragCtx.unregisterDropZone(boardRef.current);
    };
  });

  return (
    <div ref={boardRef} className="board">
      {sets.length === 0 && (
        <div className="board-empty">Drop tiles here to start a set</div>
      )}
      <div className="board-sets">
        {sets.map((set, setIdx) => {
          const valid       = isValidSet(set);
          const isLockedSet = preMeld && setIdx < originalBoardSize;

          return (
            <div
              key={setIdx}
              ref={el => { setZoneRefs.current[setIdx] = el; }}
              className={`board-set ${valid ? 'set-valid' : 'set-invalid'} ${isLockedSet ? 'set-locked' : ''}`}
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
                  groupTiles={isInteractive && !isLockedSet ? set : undefined}
                  onClick={() => isInteractive && !isLockedSet && onTileClick?.(tile, setIdx)}
                />
              ))}
              {isLockedSet && <span className="set-lock-icon">🔒</span>}
            </div>
          );
        })}

        {isInteractive && (
          <div
            ref={newZoneRef}
            className="board-set board-set-new"
          >
            <span className="board-set-new-label">+ New Set</span>
          </div>
        )}
      </div>
    </div>
  );
}
