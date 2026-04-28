import React, { useCallback } from 'react';
import Tile from './Tile';
import { isValid, isRun } from '../utils/gameEngine';

export default function Board({
  board,
  prevBoardIds,
  aiMovedIds,
  isHuman,
  hasMeld,
  lastPlayedSets,
  debugMode,
  onDropOnSet,
  onDropNewSet,
  onTileClick,
  onTileDblClick,
  onDragStart,
  onDragEnd,
}) {
  const getSetLabel = useCallback((set) => {
    if (!isValid(set)) return 'invalid';
    return isRun(set) ? 'run' : 'group';
  }, []);

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
      <div className="board-sets" id="board-sets">
        {board.map((set, si) => {
          const isOriginalSet = si < prevBoardIds.size || [...set].every(t => prevBoardIds.has(t.id));
          const hasNewTile = set.some(t => !prevBoardIds.has(t.id));
          const isAiNew = hasNewTile && aiMovedIds.size > 0;
          const isLastPlayed = lastPlayedSets && lastPlayedSets.has(si);
          // Before meld, existing board sets are locked (can't drop into them)
          const isLocked = isHuman && !hasMeld && set.every(t => prevBoardIds.has(t.id));

          const cls = ['bset'];
          if (!isValid(set)) cls.push('invalid');
          if (isAiNew) cls.push('ai-new');
          if (isLastPlayed) cls.push('last-played');
          if (isLocked) cls.push('locked');

          return (
            <div
              key={si}
              className={cls.join(' ')}
              style={isLocked ? { opacity: 0.7, cursor: 'not-allowed' } : {}}
              onDragOver={e => {
                if (!isHuman || isLocked) return;
                e.preventDefault();
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
                if (isLocked) return;
                e.preventDefault();
                e.currentTarget.classList.remove('drop-target');
                const pos = getInsertPos(e.currentTarget, set, e.clientX);
                onDropOnSet(si, pos);
                e.currentTarget.querySelectorAll('.drop-insert').forEach(i => i.classList.remove('vis'));
              }}
            >
              <div className="bset-lbl">{getSetLabel(set)}</div>
              <div className="drop-insert" data-si={si} data-pos={0} />
              {set.map((tile, ti) => (
                <React.Fragment key={tile.id}>
                  <Tile
                    tile={tile}
                    src="board"
                    si={si}
                    ti={ti}
                    isHuman={isHuman && !isLocked}
                    aiPlaced={aiMovedIds.has(tile.id)}
                    debugMode={debugMode}
                    onClickTile={onTileClick}
                    onDblClickTile={isLocked ? undefined : onTileDblClick}
                    onDragStart={isLocked ? undefined : onDragStart}
                    onDragEnd={onDragEnd}
                  />
                  <div className="drop-insert" data-si={si} data-pos={ti + 1} />
                </React.Fragment>
              ))}
              {isLocked && (
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '6px',
                  background: 'rgba(0,0,0,.18)', cursor: 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }} title="Meld first to use board tiles">
                </div>
              )}
            </div>
          );
        })}

        <div
          className="new-set-zone"
          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
          onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
          onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); onDropNewSet(); }}
        >
          + New Set
        </div>
      </div>
    </div>
  );
}
