import React, { useRef, useState, useMemo } from 'react';
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
  const lassoRef = useRef({ active: false, anchor: null, lassoIds: new Set(), sweepInterval: null });
  const rackRef = useRef(null);
  const [lassoSelectedIds, setLassoSelectedIds] = useState(new Set());

  // sortHand now returns { tiles, playableCount, sets }
  const handKey = useMemo(() => hand.map(t => t.id).sort().join(','), [hand]);
  const { tiles: sorted, playableCount, sets: playableSets } = useMemo(
    () => sortHand(hand, sortMode),
    [handKey, sortMode] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const playable = sorted.slice(0, playableCount);
  const rest = sorted.slice(playableCount);

  // For suggestion strip — use sets directly from sortHand (already best combo, no recompute)
  const allSets = useMemo(() => findAllSets(sorted), [handKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const sortedSuggestions = useMemo(() =>
    [...allSets]
      .sort((a, b) => b.length - a.length || b.reduce((s, t) => s + tileVal(t), 0) - a.reduce((s, t) => s + tileVal(t), 0))
      .slice(0, 8),
  [allSets]);

  // ── LASSO ──
  const clearLasso = () => {
    clearInterval(lassoRef.current.sweepInterval);
    if (rackRef.current) {
      rackRef.current.querySelectorAll('.lasso').forEach(el => el.classList.remove('lasso'));
    }
    lassoRef.current = { active: false, anchor: null, lassoIds: new Set(), sweepInterval: null };
    longPressActiveRef.current = false;
    setLassoSelectedIds(new Set());
  };

  const startLasso = (tile) => {
    if (!isHuman) return;
    clearTimeout(longPressRef.current);

    longPressRef.current = setTimeout(() => {
      longPressActiveRef.current = true;

      // Find which playable set this tile belongs to
      const owningSet = playableSets.find(s => s.some(t => t.id === tile.id));
      // Only lasso that specific set — not all linkable tiles
      const lassoGroup = owningSet
        ? owningSet.filter(t => t.id !== tile.id)  // rest of the same set
        : [];                                        // tile not in any set — no lasso

      const ids = new Set([tile.id, ...lassoGroup.map(t => t.id)]);
      lassoRef.current = { active: true, anchor: tile, lassoIds: ids, sweepInterval: null };

      // Animate: raise anchor immediately, then sweep group members
      setLassoSelectedIds(new Set([tile.id]));
      const anchorEl = rackRef.current && rackRef.current.querySelector(`[data-id="${tile.id}"]`);
      if (anchorEl) anchorEl.classList.add('lasso');

      let i = 0;
      const sweep = setInterval(() => {
        if (i >= lassoGroup.length) {
          clearInterval(sweep);
          setLassoSelectedIds(new Set(ids));
          return;
        }
        const t = lassoGroup[i];
        const el = rackRef.current && rackRef.current.querySelector(`[data-id="${t.id}"]`);
        if (el) el.classList.add('lasso');
        setLassoSelectedIds(prev => new Set([...prev, t.id]));
        i++;
      }, 100);
      lassoRef.current.sweepInterval = sweep;
    }, 400);
  };

  const endLasso = () => {
    clearTimeout(longPressRef.current);
    if (!longPressActiveRef.current) return;
    longPressActiveRef.current = false;
    lassoRef.current.active = false;
    // Keep lasso selection raised — click to dismiss
  };

  const handleClickWithLasso = (e, tile, src, si) => {
    if (lassoRef.current.lassoIds.has(tile.id)) {
      clearLasso();
      return;
    }
    onTileClick && onTileClick(e, tile, src, si);
  };

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
        onPointerLeave={() => { clearTimeout(longPressRef.current); if (!longPressActiveRef.current) return; }}
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
      {isHuman && sortedSuggestions.length > 0 && (
        <div className="sugg-strip">
          {sortedSuggestions.map((set, idx) => {
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
