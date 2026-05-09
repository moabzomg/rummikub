/* eslint-disable react-hooks/exhaustive-deps */
import React, { useRef, useState, useMemo, useCallback } from 'react';
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
  const longPressRef    = useRef(null);
  const longPressFired  = useRef(false);
  const lassoRef        = useRef({ lassoIds: new Set(), set: null, sweepInterval: null });
  const rackRef         = useRef(null);
  const [lassoIds, setLassoIds] = useState(new Set());

  const handKey = useMemo(() => hand.map(t => t.id).sort().join(','), [hand]);

  const { tiles: sorted, playableCount, sets: playableSets } = useMemo(
    () => sortHand(hand, sortMode),
    [handKey, sortMode]
  );

  const playable = sorted.slice(0, playableCount);
  const rest     = sorted.slice(playableCount);

  const allSets = useMemo(() => findAllSets(sorted), [handKey]);
  const sortedSuggestions = useMemo(() =>
    [...allSets]
      .sort((a, b) => b.length - a.length ||
        b.reduce((s,t)=>s+tileVal(t),0) - a.reduce((s,t)=>s+tileVal(t),0))
      .slice(0, 8),
  [allSets]);

  // ── LASSO ──
  const clearLasso = useCallback(() => {
    clearInterval(lassoRef.current.sweepInterval);
    lassoRef.current = { lassoIds: new Set(), set: null, sweepInterval: null };
    longPressFired.current = false;
    setLassoIds(new Set());
  }, []);

  const startLasso = useCallback((tile) => {
    if (!isHuman) return;
    clearTimeout(longPressRef.current);
    longPressFired.current = false;

    longPressRef.current = setTimeout(() => {
      longPressFired.current = true;
      // Clear any existing lasso first
      clearInterval(lassoRef.current.sweepInterval);
      setLassoIds(new Set());

      const owningSet = playableSets.find(s => s.some(t => t.id === tile.id));
      if (!owningSet) { longPressFired.current = false; return; }

      const restOfSet = owningSet.filter(t => t.id !== tile.id);
      const ids = new Set([tile.id, ...restOfSet.map(t => t.id)]);
      lassoRef.current = { lassoIds: ids, set: owningSet, sweepInterval: null };

      // Raise anchor immediately
      setLassoIds(new Set([tile.id]));

      let i = 0;
      const sweep = setInterval(() => {
        if (i >= restOfSet.length) { clearInterval(sweep); setLassoIds(new Set(ids)); return; }
        setLassoIds(prev => new Set([...prev, restOfSet[i].id]));
        i++;
      }, 90);
      lassoRef.current.sweepInterval = sweep;
    }, 380);
  }, [isHuman, playableSets]);

  // On pointer up / leave — if long press NOT fired, clear timer (don't lasso)
  // If lasso IS active, keep it raised until click/drag
  const cancelIfNotFired = useCallback(() => {
    clearTimeout(longPressRef.current);
    if (!longPressFired.current) {
      clearLasso(); // didn't hold long enough — reset
    }
    // if fired, keep lasso raised
  }, [clearLasso]);

  // Click on lassoed tile → play the set; click elsewhere → clear lasso
  const handleClick = useCallback((e, tile, src, si) => {
    const inLasso = lassoRef.current.lassoIds.has(tile.id);
    if (inLasso && lassoRef.current.set) {
      const setToPlay = lassoRef.current.set;
      const v = setToPlay.reduce((s, t) => s + tileVal(t), 0);
      const canPlay = hasMeld || v >= 30;
      clearLasso();
      if (canPlay) onPlaySuggestion && onPlaySuggestion(setToPlay);
      return;
    }
    if (lassoRef.current.lassoIds.size > 0) { clearLasso(); return; }
    onTileClick && onTileClick(e, tile, src, si);
  }, [hasMeld, clearLasso, onPlaySuggestion, onTileClick]);

  // Drag on a lassoed tile → drag the whole set as a ghost, play it on drop
  const handleDragStart = useCallback((e, tile, src, si) => {
    if (lassoRef.current.lassoIds.has(tile.id) && lassoRef.current.set) {
      const setToPlay = lassoRef.current.set;
      const v = setToPlay.reduce((s, t) => s + tileVal(t), 0);
      const canPlay = hasMeld || v >= 30;
      clearLasso();
      if (canPlay) {
        // Cancel native drag; play immediately
        e.preventDefault();
        onPlaySuggestion && onPlaySuggestion(setToPlay);
      } else {
        e.preventDefault();
      }
      return;
    }
    onDragStart && onDragStart(e, tile, src, si);
  }, [hasMeld, clearLasso, onPlaySuggestion, onDragStart]);

  const renderTile = (tile, i) => {
    const isRaised = lassoIds.has(tile.id);
    return (
      <div
        key={tile.id}
        style={{
          display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
          transition: 'transform 0.15s ease',
          transform: isRaised ? 'translateY(-12px)' : 'translateY(0)',
          cursor: isRaised ? 'pointer' : undefined,
        }}
        onPointerDown={() => startLasso(tile)}
        onPointerUp={cancelIfNotFired}
        onPointerLeave={() => { clearTimeout(longPressRef.current); if (!longPressFired.current) clearLasso(); }}
      >
        <Tile
          tile={tile}
          src="hand"
          ti={i}
          selected={selectedIds.has(tile.id) || isRaised}
          isHuman={isHuman}
          debugMode={debugMode}
          onClickTile={handleClick}
          onDblClickTile={onTileDblClick}
          onDragStart={handleDragStart}
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
                    {t.isJoker ? '☺' : t.num}
                  </div>
                ))}
                <span style={{ fontSize: '9px', color: 'rgba(0,0,0,.35)', marginLeft: '3px' }}>{v}p</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="hand-wrap">
        <div className="hand-lbl">{isHuman ? 'Your Tiles' : 'Hand'}</div>
        <div className="hand-rack" ref={rackRef}>
          {playable.map((tile, i) => renderTile(tile, i))}
          {playable.length > 0 && rest.length > 0 && <div className="hand-sep" />}
          {rest.map((tile, i) => renderTile(tile, playable.length + i))}
        </div>
      </div>
    </div>
  );
}
