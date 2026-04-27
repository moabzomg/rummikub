import React, { useRef, useState } from 'react';
import Tile from './Tile';
import { sortHand, findAllSets, tileVal } from '../utils/gameEngine';

// Find tiles that can link with anchor to form a run or group
function findLinkable(anchor, allTiles) {
  if (anchor.isJoker) return allTiles.filter(t => t.id !== anchor.id);
  const linked = new Set();

  for (const candidate of allTiles) {
    if (candidate.id === anchor.id) continue;
    // Test group: same number, different colour
    if (!candidate.isJoker && candidate.num === anchor.num && candidate.color !== anchor.color) {
      linked.add(candidate.id);
      continue;
    }
    // Test run: same colour (or joker), adjacent/near number
    if (candidate.isJoker || candidate.color === anchor.color) {
      const diff = candidate.isJoker ? 1 : Math.abs(candidate.num - anchor.num);
      if (diff >= 1 && diff <= 4) linked.add(candidate.id); // within run-building distance
    }
  }
  return allTiles.filter(t => linked.has(t.id));
}

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
  const lassoRef = useRef({ active: false, anchor: null, lassoIds: new Set() });
  const rackRef = useRef(null);
  // Local lasso selection state — lifted tiles (raised visually)
  const [lassoSelectedIds, setLassoSelectedIds] = useState(new Set());

  const sorted = sortHand(hand, sortMode);
  const allSets = findAllSets(sorted);
  const playableIds = new Set(allSets.flat().map(t => t.id));
  const playable = sorted.filter(t => playableIds.has(t.id));
  const rest = sorted.filter(t => !playableIds.has(t.id));

  const clearLasso = () => {
    // Remove lasso classes from DOM
    if (rackRef.current) {
      rackRef.current.querySelectorAll('.lasso').forEach(el => el.classList.remove('lasso'));
    }
    lassoRef.current = { active: false, anchor: null, lassoIds: new Set() };
    longPressActiveRef.current = false;
    setLassoSelectedIds(new Set());
  };

  const startLasso = (tile) => {
    if (!isHuman) return;
    clearTimeout(longPressRef.current);
    longPressRef.current = setTimeout(() => {
      longPressActiveRef.current = true;
      const linkable = findLinkable(tile, sorted);
      lassoRef.current = { active: true, anchor: tile, lassoIds: new Set() };

      // Sweep through linkable tiles one by one with animation
      let i = 0;
      const sweep = setInterval(() => {
        if (!lassoRef.current.active || i >= linkable.length) {
          clearInterval(sweep);
          // Finalize lasso selection
          const ids = new Set([tile.id, ...linkable.map(t => t.id)]);
          lassoRef.current.lassoIds = ids;
          setLassoSelectedIds(new Set(ids));
          return;
        }
        const t = linkable[i];
        const el = rackRef.current && rackRef.current.querySelector(`[data-id="${t.id}"]`);
        if (el) el.classList.add('lasso');
        i++;
      }, 100);

      // Also immediately raise the anchor tile
      const anchorEl = rackRef.current && rackRef.current.querySelector(`[data-id="${tile.id}"]`);
      if (anchorEl) anchorEl.classList.add('lasso');
    }, 400);
  };

  const endLasso = () => {
    clearTimeout(longPressRef.current);
    if (!longPressActiveRef.current) {
      // Short press — not a lasso, don't clear selection
      return;
    }
    // Keep lasso selection visible after release
    longPressActiveRef.current = false;
    lassoRef.current.active = false;
  };

  // Clicking a tile clears lasso selection if it's part of the lasso group
  const handleClickWithLasso = (e, tile, src, si) => {
    if (lassoRef.current.lassoIds.has(tile.id)) {
      // Click returns tile to original position (clears lasso)
      clearLasso();
      return;
    }
    onTileClick && onTileClick(e, tile, src, si);
  };

  const sortedSets = [...allSets]
    .sort((a, b) => b.length - a.length || b.reduce((s, t) => s + tileVal(t), 0) - a.reduce((s, t) => s + tileVal(t), 0))
    .slice(0, 10);

  const renderTile = (tile, i) => {
    const isLassoRaised = lassoSelectedIds.has(tile.id);
    return (
      <div
        key={tile.id}
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          transition: 'transform 0.18s ease',
          transform: isLassoRaised ? 'translateY(-10px)' : 'translateY(0)',
        }}
        onPointerDown={() => startLasso(tile)}
        onPointerUp={endLasso}
        onPointerLeave={() => { clearTimeout(longPressRef.current); longPressActiveRef.current = false; }}
      >
        <Tile
          tile={tile}
          src="hand"
          ti={i}
          selected={selectedIds.has(tile.id) || isLassoRaised}
          isHuman={isHuman}
          debugMode={debugMode}
          onClickTile={handleClickWithLasso}
          onDblClickTile={onTileDblClick}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      </div>
    );
  };

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
