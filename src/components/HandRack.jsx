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
  const longPressRef = useRef(null);
  const longPressActiveRef = useRef(false);
  // Single lasso state — only ONE set raised at a time
  const lassoRef = useRef({ lassoIds: new Set(), set: null, sweepInterval: null });
  const rackRef = useRef(null);
  const [lassoIds, setLassoIds] = useState(new Set());

  const handKey = useMemo(() => hand.map(t => t.id).sort().join(','), [hand]);
  const { tiles: sorted, playableCount, sets: playableSets } = useMemo(
    () => sortHand(hand, sortMode),
    [handKey, sortMode] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const playable = sorted.slice(0, playableCount);
  const rest = sorted.slice(playableCount);

  const allSets = useMemo(() => findAllSets(sorted), [handKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const sortedSuggestions = useMemo(() =>
    [...allSets]
      .sort((a, b) => b.length - a.length || b.reduce((s, t) => s + tileVal(t), 0) - a.reduce((s, t) => s + tileVal(t), 0))
      .slice(0, 8),
  [allSets]);

  // ── LASSO helpers ──
  const clearLasso = useCallback(() => {
    clearInterval(lassoRef.current.sweepInterval);
    lassoRef.current = { lassoIds: new Set(), set: null, sweepInterval: null };
    longPressActiveRef.current = false;
    setLassoIds(new Set());
  }, []);

  const startLasso = useCallback((tile) => {
    if (!isHuman) return;
    clearTimeout(longPressRef.current);

    longPressRef.current = setTimeout(() => {
      // Always clear any previous lasso first — only ONE set at a time
      clearInterval(lassoRef.current.sweepInterval);
      setLassoIds(new Set());

      longPressActiveRef.current = true;

      // Find the specific playable set this tile belongs to
      const owningSet = playableSets.find(s => s.some(t => t.id === tile.id));
      if (!owningSet) {
        // Tile not in any set — no lasso
        longPressActiveRef.current = false;
        return;
      }

      // Build the lasso group in display order (anchor first, rest follow)
      const restOfSet = owningSet.filter(t => t.id !== tile.id);
      const ids = new Set([tile.id, ...restOfSet.map(t => t.id)]);
      lassoRef.current = { lassoIds: ids, set: owningSet, sweepInterval: null };

      // Raise anchor tile immediately
      setLassoIds(new Set([tile.id]));

      // Sweep remaining tiles of the set with animation
      let i = 0;
      const sweep = setInterval(() => {
        if (i >= restOfSet.length) {
          clearInterval(sweep);
          setLassoIds(new Set(ids));
          return;
        }
        setLassoIds(prev => new Set([...prev, restOfSet[i].id]));
        i++;
      }, 90);
      lassoRef.current.sweepInterval = sweep;
    }, 400);
  }, [isHuman, playableSets]);

  const endLasso = useCallback(() => {
    clearTimeout(longPressRef.current);
    // Don't clear lasso on pointer-up — keep raised until click or drag
  }, []);

  // Click on a lassoed tile: play the whole set, then clear lasso
  // Click on a non-lassoed tile: normal click (clear lasso first)
  const handleClick = useCallback((e, tile, src, si) => {
    const inLasso = lassoRef.current.lassoIds.has(tile.id);
    if (inLasso && lassoRef.current.set) {
      // One-click play: pass the lasso set to onPlaySuggestion
      const setToPlay = lassoRef.current.set;
      const v = setToPlay.reduce((s, t) => s + tileVal(t), 0);
      const canPlay = hasMeld || v >= 30;
      clearLasso();
      if (canPlay) {
        onPlaySuggestion && onPlaySuggestion(setToPlay);
      }
      return;
    }
    // Clicking outside lasso clears it first
    if (lassoRef.current.lassoIds.size > 0) {
      clearLasso();
      return;
    }
    onTileClick && onTileClick(e, tile, src, si);
  }, [hasMeld, clearLasso, onPlaySuggestion, onTileClick]);

  // Drag start on a lassoed tile: play the whole set (drag = commit the group)
  const handleDragStart = useCallback((e, tile, src, si) => {
    if (lassoRef.current.lassoIds.has(tile.id) && lassoRef.current.set) {
      // Treat drag on lasso group as playing the whole set
      const setToPlay = lassoRef.current.set;
      const v = setToPlay.reduce((s, t) => s + tileVal(t), 0);
      const canPlay = hasMeld || v >= 30;
      clearLasso();
      if (canPlay) {
        e.preventDefault(); // cancel the drag
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
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          transition: 'transform 0.15s ease',
          transform: isRaised ? 'translateY(-12px)' : 'translateY(0)',
          cursor: isRaised ? 'pointer' : undefined,
        }}
        onPointerDown={() => startLasso(tile)}
        onPointerUp={endLasso}
        onPointerLeave={() => clearTimeout(longPressRef.current)}
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
