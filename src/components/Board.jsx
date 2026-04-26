import React, { useCallback, useRef } from 'react';
import Tile from './Tile';
import { isValid, isRun } from '../utils/gameEngine';

export default function Board({
  board,
  prevBoardIds,
  aiMovedIds,
  isHuman,
  lastPlayedSets,
  debugMode,
  onDropOnSet,
  onDropNewSet,
  onTileClick,
  onTileDblClick,
  onDragStart,
  onDragEnd,
  dragState,
}) {
  const dragOverSetRef = useRef(null);
  const insertLineRefs = useRef({});

  const getSetLabel = (set) => {
    if (!isValid(set)) return '⚠ invalid';
    return isRun(set) ? 'run' : 'group';
  };

  const highlightInsert = useCallback((setDiv, clientX) => {
    const inserts = setDiv.querySelectorAll('.drop-insert');
    let best = null, bestDist = Infinity;
    inserts.forEach(ins => {
      const r = ins.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const dist = Math.abs(clientX - cx);
      if (dist < bestDist) { bestDist = dist; best = ins; }
    });
    inserts.forEach(i => i.classList.remove('vis'));
    if (best) best.classList.add('vis');
  }, []);

  const getInsertPos = useCallback((setDiv, set, clientX) => {
    const tiles = setDiv.querySelectorAll('.tile');
    let pos = set.length;
    tiles.forEach((tel, i) => {
      const r = tel.getBoundingClientRect();
      if (clientX < r.left + r.width / 2) { pos = Math.min(pos, i); }
    });
    return pos;
  }, []);

  return (
    <div
      className="board-area"
      id="board-area"
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        e.preventDefault();
        if (e.target === e.currentTarget || e.target.id === 'board-sets') {
          onDropNewSet();
        }
      }}
    >
      <div className="last-turn-banner" id="lt-banner" style={{ display: 'none' }} />

      <div className="board-sets" id="board-sets">
        {board.map((set, si) => {
          const hasNewTile = set.some(t => !prevBoardIds.has(t.id));
          const isAiNew = hasNewTile && aiMovedIds.size > 0;
          const isLastPlayed = lastPlayedSets && lastPlayedSets.has(si);

          const cls = ['bset'];
          if (!isValid(set)) cls.push('invalid');
          if (isAiNew) cls.push('ai-new');
          if (isLastPlayed) cls.push('last-played');

          return (
            <div
              key={si}
              className={cls.join(' ')}
              onDragOver={e => {
                e.preventDefault();
                if (!isHuman) return;
                e.currentTarget.classList.add('drop-target');
                highlightInsert(e.currentTarget, e.clientX);
              }}
              onDragLeave={e => {
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  e.currentTarget.classList.remove('drop-target');
                  e.currentTarget.querySelectorAll('.drop-insert').forEach(i => i.classList.remove('vis'));
                }
              }}
              onDrop={e => {
                e.preventDefault();
                e.currentTarget.classList.remove('drop-target');
                const pos = getInsertPos(e.currentTarget, set, e.clientX);
                onDropOnSet(si, pos);
                e.currentTarget.querySelectorAll('.drop-insert').forEach(i => i.classList.remove('vis'));
              }}
            >
              <div className="bset-lbl">{getSetLabel(set)}</div>

              {/* Before first tile */}
              <div className="drop-insert" data-si={si} data-pos={0} />

              {set.map((tile, ti) => (
                <React.Fragment key={tile.id}>
                  <Tile
                    tile={tile}
                    src="board"
                    si={si}
                    ti={ti}
                    isHuman={isHuman}
                    aiPlaced={aiMovedIds.has(tile.id)}
                    debugMode={debugMode}
                    onClickTile={onTileClick}
                    onDblClickTile={onTileDblClick}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                  />
                  <div className="drop-insert" data-si={si} data-pos={ti + 1} />
                </React.Fragment>
              ))}
            </div>
          );
        })}

        <div
          className="new-set-zone"
          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
          onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
          onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); onDropNewSet(); }}
          onClick={() => {}}
        >
          + New Set
        </div>
      </div>
    </div>
  );
}
