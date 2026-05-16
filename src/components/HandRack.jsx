import React, { useState } from 'react';
import Tile from './Tile';
import { sortHand } from '../utils/gameEngine';

export default function HandRack({
  hand,
  selectedIds,
  onSelect,
  onDragStart,
  isCurrentPlayer,
  hidden = false,
  small = false,
  sortByColor = true,
}) {
  const sorted = sortHand(hand, sortByColor);

  return (
    <div className={`hand-rack ${small ? 'hand-rack-small' : ''}`}>
      {sorted.map(tile => (
        <Tile
          key={tile.id}
          tile={tile}
          hidden={hidden}
          selected={selectedIds?.has(tile.id)}
          draggable={isCurrentPlayer && !hidden}
          small={small}
          onClick={() => isCurrentPlayer && !hidden && onSelect?.(tile)}
          onDragStart={e => {
            e.dataTransfer.setData('tileId', String(tile.id));
            e.dataTransfer.setData('source', 'hand');
            onDragStart?.(tile);
          }}
        />
      ))}
    </div>
  );
}
