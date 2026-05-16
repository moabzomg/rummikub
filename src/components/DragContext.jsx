import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

const DragCtx = createContext(null);
export function useDrag() { return useContext(DragCtx); }

const COLOR_STYLES = {
  black: { color: '#1a1a1a' },
  blue:  { color: '#1565c0' },
  orange:{ color: '#e65100' },
  red:   { color: '#c62828' },
  joker: { color: '#8e24aa' },
};

function DragGhost({ drag }) {
  if (!drag) return null;
  const { tiles, x, y } = drag;

  return (
    <>
      {tiles.map((tile, i) => {
        const cs = COLOR_STYLES[tile.color] || COLOR_STYLES.black;
        return (
          <div key={tile.id} style={{
            position:   'fixed',
            left:       x - 22 + i * 30,
            top:        y - 28,
            width:      44,
            height:     56,
            background: 'var(--tile-bg, #f5f0e8)',
            borderRadius: 6,
            border:     '2px solid var(--accent-gold, #f5c518)',
            boxShadow:  '0 8px 24px rgba(0,0,0,0.5)',
            display:    'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents:  'none',
            zIndex:     9999 - i,
            opacity:    0.93,
            transform:  `rotate(${i === 0 ? -3 : 0}deg) scale(${1.08 - i * 0.02})`,
            ...cs,
          }}>
            <span style={{ fontFamily: 'Nunito, sans-serif', fontSize: 22, fontWeight: 900, lineHeight: 1 }}>
              {tile.isJoker ? '☺' : tile.number}
            </span>
          </div>
        );
      })}
    </>
  );
}

export function DragProvider({ children }) {
  const [drag, setDrag]   = useState(null);
  const dragRef           = useRef(null);
  // Each drop zone: { el, onDrop(dragData) }
  const zonesRef          = useRef([]);

  // Register a drop zone with its own handler
  const registerDropZone = useCallback((el, onDrop) => {
    if (!el) return;
    zonesRef.current = zonesRef.current.filter(z => z.el !== el);
    zonesRef.current.push({ el, onDrop });
  }, []);

  const unregisterDropZone = useCallback((el) => {
    zonesRef.current = zonesRef.current.filter(z => z.el !== el);
  }, []);

  // tiles: Tile | Tile[]
  const startDrag = useCallback((tiles, source, sourceSetIdx, x, y) => {
    const arr = Array.isArray(tiles) ? tiles : [tiles];
    dragRef.current = { tiles: arr, source, sourceSetIdx };
    setDrag({ tiles: arr, source, sourceSetIdx, x, y });
  }, []);

  useEffect(() => {
    const getXY = (e) => {
      if (e.touches?.length)         return [e.touches[0].clientX, e.touches[0].clientY];
      if (e.changedTouches?.length)  return [e.changedTouches[0].clientX, e.changedTouches[0].clientY];
      return [e.clientX, e.clientY];
    };

    const onMove = (e) => {
      if (!dragRef.current) return;
      const [x, y] = getXY(e);
      setDrag(prev => prev ? { ...prev, x, y } : null);
    };

    const onUp = (e) => {
      if (!dragRef.current) return;
      const [x, y] = getXY(e);

      // Find smallest zone that contains the pointer (most specific)
      let best = null, bestArea = Infinity;
      for (const zone of zonesRef.current) {
        const r = zone.el.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          const area = r.width * r.height;
          if (area < bestArea) { bestArea = area; best = zone; }
        }
      }

      if (best) best.onDrop(dragRef.current);

      dragRef.current = null;
      setDrag(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
    window.addEventListener('touchmove',   onMove, { passive: true });
    window.addEventListener('touchend',    onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onUp);
      window.removeEventListener('touchmove',   onMove);
      window.removeEventListener('touchend',    onUp);
    };
  }, []);

  return (
    <DragCtx.Provider value={{ drag, startDrag, registerDropZone, unregisterDropZone }}>
      {children}
      <DragGhost drag={drag} />
    </DragCtx.Provider>
  );
}
