import React, { useRef, useCallback } from 'react';
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
  onSortChange,
}) {
  const longPressRef = useRef(null);
  const longPressActiveRef = useRef(false);
  const lassoRef = useRef({ active: false, startTile: null });
  const rackRef = useRef(null);

  const sorted = sortHand(hand, sortMode);
  const allSets = findAllSets(sorted);
  const playableIds = new Set(allSets.flat().map(t => t.id));
  const playable = sorted.filter(t => playableIds.has(t.id));
  const rest = sorted.filter(t => !playableIds.has(t.id));

  const handleLongPressStart = useCallback((tile) => {
    if (!isHuman) return;
    longPressRef.current = setTimeout(() => {
      longPressActiveRef.current = true;
      lassoRef.current = { active: true, startTile: tile };
      // Sweep through right
      const idx = sorted.findIndex(t => t.id === tile.id);
      let i = idx + 1;
      const sweep = setInterval(() => {
        if (!lassoRef.current.active || i >= sorted.length) {
          clearInterval(sweep);
          return;
        }
        const el = rackRef.current?.querySelector(`[data-id="${sorted[i].id}"]`);
        if (el) {
          el.classList.add('lasso', 'selected');
        }
        i++;
      }, 120);
    }, 400);
  }, [isHuman, sorted]);

  const handleLongPressEnd = useCallback(() => {
    clearTimeout(longPressRef.current);
    longPressActiveRef.current = false;
    lassoRef.current = { active: false, startTile: null };
  }, []);

  const renderTile = (tile, i) => (
    <div key={tile.id} style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
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

  // Suggestion strip
  const sortedSets = allSets
    .sort((a, b) => b.length - a.length || b.reduce((s,t)=>s+tileVal(t),0) - a.reduce((s,t)=>s+tileVal(t),0))
    .slice(0, 10);

  return (
    <div className="bottom">
      {/* Suggestion strip */}
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
                    {t.isJoker ? '★' : t.num}
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
        {playable.length > 0 && rest.length > 0 && (
          <div className="hand-sep" />
        )}
        {rest.map((tile, i) => renderTile(tile, playable.length + i))}
      </div>
    </div>
  );
}
