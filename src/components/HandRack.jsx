import React, { useRef } from 'react';
import Tile from './Tile';
import { sortHand, findAllSets, tileVal } from '../utils/gameEngine';

export default function HandRack({
  hand,
  sortMode,
  selectedIds,
  hasMeld,
  isHuman,
  debugMode,
  onTileClick,
  onTileDblClick,
  onDragStart,
  onDragEnd,
  onPlaySuggestion,
}) {
  const longPressRef = useRef(null);
  const longPressActiveRef = useRef(false);
  const lassoRef = useRef({ active: false });
  const rackRef = useRef(null);

  const sorted = sortHand(hand, sortMode);
  const allSets = findAllSets(sorted);
  const playableIds = new Set(allSets.flat().map(t => t.id));
  const playable = sorted.filter(t => playableIds.has(t.id));
  const rest = sorted.filter(t => !playableIds.has(t.id));

  // Long-press lasso: wired to each tile's pointer events
  const startLasso = (tile) => {
    if (!isHuman) return;
    longPressRef.current = setTimeout(() => {
      longPressActiveRef.current = true;
      lassoRef.current = { active: true };
      const idx = sorted.findIndex(t => t.id === tile.id);
      let i = idx + 1;
      const sweep = setInterval(() => {
        if (!lassoRef.current.active || i >= sorted.length) { clearInterval(sweep); return; }
        const el = rackRef.current && rackRef.current.querySelector(`[data-id="${sorted[i].id}"]`);
        if (el) el.classList.add('lasso');
        i++;
      }, 120);
    }, 400);
  };

  const endLasso = () => {
    clearTimeout(longPressRef.current);
    longPressActiveRef.current = false;
    lassoRef.current = { active: false };
  };

  const sortedSets = [...allSets]
    .sort((a, b) => b.length - a.length || b.reduce((s, t) => s + tileVal(t), 0) - a.reduce((s, t) => s + tileVal(t), 0))
    .slice(0, 10);

  const renderTile = (tile, i) => (
    <div
      key={tile.id}
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}
      onPointerDown={() => startLasso(tile)}
      onPointerUp={endLasso}
      onPointerLeave={endLasso}
    >
      <Tile
        tile={tile}
        src="hand"
        ti={i}
        selected={selectedIds.has(tile.id)}
        isHuman={isHuman}
        debugMode={debugMode}
        onClickTile={onTileClick}
        onDblClickTile={onTileDblClick}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      />
    </div>
  );

  return (
    <div>
      {isHuman && sortedSets.length > 0 && (
        <div className="sugg-strip">
          {sortedSets.map((set, idx) => {
            const v = set.reduce((s, t) => s + tileVal(t), 0);
            const canPlay = hasMeld || v >= 30;
            return (
              <div
                key={idx}
                className={'sugg-set' + (canPlay ? '' : ' dimmed')}
                onClick={() => canPlay && onPlaySuggestion(set)}
              >
                {set.map(t => (
                  <div key={t.id} className={'mt c-' + t.color}>
                    {t.isJoker ? '\u2605' : t.num}
                  </div>
                ))}
                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,.4)', marginLeft: '3px' }}>{v}p</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="hand-lbl">{isHuman ? 'Your Tiles' : 'Hand'}</div>
      <div className="hand-rack" ref={rackRef}>
        {playable.map((tile, i) => renderTile(tile, i))}
        {playable.length > 0 && rest.length > 0 && <div className="hand-sep" />}
        {rest.map((tile, i) => renderTile(tile, playable.length + i))}
      </div>
    </div>
  );
}
