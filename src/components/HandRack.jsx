import React, { useRef, useEffect } from 'react';
import Tile from './Tile';
import { sortHand } from '../utils/gameEngine';
import { useDrag } from './DragContext';

// Split sorted tiles into visual groups by consecutive color+number or same number
function groupHand(tiles, byColor) {
  if (tiles.length === 0) return [];
  const groups = [[tiles[0]]];
  for (let i = 1; i < tiles.length; i++) {
    const prev = tiles[i - 1];
    const curr = tiles[i];
    let sameGroup = false;
    if (!curr.isJoker && !prev.isJoker) {
      if (byColor) {
        sameGroup = curr.color === prev.color && curr.number === prev.number + 1;
      } else {
        sameGroup = curr.number === prev.number;
      }
    }
    if (sameGroup) {
      groups[groups.length - 1].push(curr);
    } else {
      groups.push([curr]);
    }
  }
  return groups;
}

export default function HandRack({
  hand,
  selectedIds,
  onSelect,
  isCurrentPlayer,
  hidden      = false,
  small       = false,
  sortByColor = true,
  onDropToHand,
}) {
  const dragCtx = useDrag();
  const rackRef = useRef(null);

  useEffect(() => {
    if (!dragCtx || !rackRef.current) return;
    dragCtx.registerDropZone(rackRef.current, (dragData) => {
      if (dragData.source === 'board') {
        onDropToHand?.(dragData.tiles, dragData.source, dragData.sourceSetIdx);
      }
    });
    return () => { if (rackRef.current) dragCtx.unregisterDropZone(rackRef.current); };
  });

  const sorted = sortHand(hand, sortByColor);
  const groups = groupHand(sorted, sortByColor);

  return (
    <div ref={rackRef} className={`hand-rack ${small ? 'hand-rack-small' : ''}`}>
      {groups.map((group, gi) => (
        <React.Fragment key={gi}>
          {gi > 0 && <div className="hand-rack-gap" />}
          {group.map(tile => (
            <Tile
              key={tile.id}
              tile={tile}
              hidden={hidden}
              selected={selectedIds?.has(tile.id)}
              draggable={isCurrentPlayer && !hidden}
              small={small}
              source="hand"
              onClick={() => isCurrentPlayer && !hidden && onSelect?.(tile)}
            />
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}
