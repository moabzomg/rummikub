import React from 'react';
import Tile from './Tile';
import { isValidSet } from '../utils/gameEngine';

export default function Board({
  sets,
  selectedIds,
  onTileClick,
  onDropToSet,
  onDropToNew,
  onDragStartBoardTile,
  isInteractive,
}) {
  const handleSetDragOver = e => e.preventDefault();

  const handleSetDrop = (e, setIdx) => {
    e.preventDefault();
    e.stopPropagation();
    const tileId = parseInt(e.dataTransfer.getData('tileId'));
    const source = e.dataTransfer.getData('source');
    onDropToSet?.(tileId, source, setIdx);
  };

  const handleBoardDrop = e => {
    e.preventDefault();
    const tileId = parseInt(e.dataTransfer.getData('tileId'));
    const source = e.dataTransfer.getData('source');
    // Only drop to new set if not dropped on existing set
    if (e.target === e.currentTarget) {
      onDropToNew?.(tileId, source);
    }
  };

  return (
    <div
      className="board"
      onDragOver={handleSetDragOver}
      onDrop={handleBoardDrop}
    >
      {sets.length === 0 && (
        <div className="board-empty">Drop tiles here to start a set</div>
      )}
      <div className="board-sets">
        {sets.map((set, setIdx) => {
          const valid = isValidSet(set);
          return (
            <div
              key={setIdx}
              className={`board-set ${valid ? 'set-valid' : 'set-invalid'}`}
              onDragOver={handleSetDragOver}
              onDrop={e => handleSetDrop(e, setIdx)}
            >
              {set.map(tile => (
                <Tile
                  key={tile.id}
                  tile={tile}
                  selected={selectedIds?.has(tile.id)}
                  draggable={isInteractive}
                  onClick={() => isInteractive && onTileClick?.(tile, setIdx)}
                  onDragStart={e => {
                    e.dataTransfer.setData('tileId', String(tile.id));
                    e.dataTransfer.setData('source', 'board');
                    e.dataTransfer.setData('sourceSetIdx', String(setIdx));
                    onDragStartBoardTile?.(tile, setIdx);
                  }}
                />
              ))}
            </div>
          );
        })}
        {/* Drop zone for new set */}
        {isInteractive && (
          <div
            className="board-set board-set-new"
            onDragOver={handleSetDragOver}
            onDrop={e => { e.preventDefault(); e.stopPropagation(); const tileId = parseInt(e.dataTransfer.getData('tileId')); const source = e.dataTransfer.getData('source'); onDropToNew?.(tileId, source); }}
          >
            <span className="board-set-new-label">+ New Set</span>
          </div>
        )}
      </div>
    </div>
  );
}
