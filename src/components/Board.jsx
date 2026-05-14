import React, { useCallback } from 'react';
import Tile from './Tile';
import { isValid, isRun } from '../utils/gameEngine';

export default function Board({ board, prevBoardIds, aiMovedIds, isHuman, hasMeld, originalBoardLen, lastPlayedSets, debugMode, onDropOnSet, onDropNewSet, onTileClick, onTileDblClick, onDragStart, onDragEnd }) {
  const getSetLabel = useCallback((set) => {
    if (!isValid(set)) return 'invalid';
    return isRun(set) ? 'run' : 'group';
  }, []);

  const highlightInsert = useCallback((setDiv, clientX) => {
    const inserts = setDiv.querySelectorAll('.drop-insert');
    let best = null, bestDist = Infinity;
    inserts.forEach(ins => {
      const r = ins.getBoundingClientRect();
      const dist = Math.abs(clientX - (r.left + r.width/2));
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
      if (clientX < r.left + r.width/2) pos = Math.min(pos, i);
    });
    return pos;
  }, []);

  return (
    <div className="board-area" id="board-area"
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); if (e.target === e.currentTarget || e.target.id === 'board-sets') onDropNewSet(); }}
    >
      <div className="board-sets" id="board-sets">
        {board.map((set, si) => {
          const hasNewTile = set.some(t => !prevBoardIds.has(t.id));
          const isAiNew = hasNewTile && aiMovedIds.size > 0;
          const isLastPlayed = lastPlayedSets && lastPlayedSets.has(si);
          // Before meld: all original board sets are locked (by index, not content)
          const isLocked = isHuman && !hasMeld && si < (originalBoardLen ?? prevBoardIds.size);

          const cls = ['bset'];
          if (!isValid(set)) cls.push('invalid');
          if (isAiNew) cls.push('ai-new');
          if (isLastPlayed) cls.push('last-played');
          if (isLocked) cls.push('locked');

          return (
            <div key={si} className={cls.join(' ')}
              onDragOver={e => { if (!isHuman || isLocked) return; e.preventDefault(); e.currentTarget.classList.add('drop-target'); highlightInsert(e.currentTarget, e.clientX); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) { e.currentTarget.classList.remove('drop-target'); e.currentTarget.querySelectorAll('.drop-insert').forEach(i => i.classList.remove('vis')); } }}
              onDrop={e => { if (isLocked) return; e.preventDefault(); e.currentTarget.classList.remove('drop-target'); const pos = getInsertPos(e.currentTarget, set, e.clientX); onDropOnSet(si, pos); e.currentTarget.querySelectorAll('.drop-insert').forEach(i => i.classList.remove('vis')); }}
            >
              <div className="bset-lbl">{getSetLabel(set)}</div>
              <div className="drop-insert" />
              {set.map((tile, ti) => (
                <React.Fragment key={tile.id}>
                  <Tile tile={tile} src="board" si={si} ti={ti}
                    isHuman={isHuman && !isLocked}
                    aiPlaced={aiMovedIds.has(tile.id)}
                    debugMode={debugMode}
                    onClickTile={onTileClick}
                    onDblClickTile={isLocked ? undefined : onTileDblClick}
                    onDragStart={isLocked ? undefined : onDragStart}
                    onDragEnd={onDragEnd}
                  />
                  <div className="drop-insert" />
                </React.Fragment>
              ))}
            </div>
          );
        })}
        <div className="new-set-zone"
          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
          onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
          onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); onDropNewSet(); }}
        >+ New Set</div>
      </div>
    </div>
  );
}
