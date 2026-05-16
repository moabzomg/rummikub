import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

const DragCtx = createContext(null);

export function useDrag() {
  return useContext(DragCtx);
}

// The ghost tile that follows the pointer
function DragGhost({ drag }) {
  if (!drag) return null;
  const { tile, x, y } = drag;

  const COLOR_STYLES = {
    black: { color: '#1a1a1a' },
    blue: { color: '#1565c0' },
    orange: { color: '#e65100' },
    red: { color: '#c62828' },
    joker: { color: '#8e24aa' },
  };
  const colorStyle = COLOR_STYLES[tile.color] || COLOR_STYLES.black;

  return (
    <div
      style={{
        position: 'fixed',
        left: x - 22,
        top: y - 28,
        width: 44,
        height: 56,
        background: 'var(--tile-bg)',
        borderRadius: 6,
        border: '2px solid var(--accent-gold)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 9999,
        opacity: 0.92,
        transform: 'rotate(-4deg) scale(1.1)',
        ...colorStyle,
      }}
    >
      <span style={{ fontFamily: 'Nunito, sans-serif', fontSize: 22, fontWeight: 900, lineHeight: 1 }}>
        {tile.isJoker ? '☺' : tile.number}
      </span>
    </div>
  );
}

export function DragProvider({ children }) {
  const [drag, setDrag] = useState(null); // { tile, source, sourceSetIdx, x, y }
  const dragRef = useRef(null);
  const dropZonesRef = useRef([]); // [{ el, type, setIdx }]

  const registerDropZone = useCallback((el, type, setIdx) => {
    if (!el) return;
    dropZonesRef.current = dropZonesRef.current.filter(z => z.el !== el);
    dropZonesRef.current.push({ el, type, setIdx });
  }, []);

  const unregisterDropZone = useCallback((el) => {
    dropZonesRef.current = dropZonesRef.current.filter(z => z.el !== el);
  }, []);

  // Called by Tile's onPointerDown
  const startDrag = useCallback((tile, source, sourceSetIdx, x, y) => {
    dragRef.current = { tile, source, sourceSetIdx };
    setDrag({ tile, source, sourceSetIdx, x, y });
  }, []);

  const onDropRef = useRef(null); // set by Board/HandRack via context

  const setOnDrop = useCallback((fn) => {
    onDropRef.current = fn;
  }, []);

  useEffect(() => {
    const onPointerMove = (e) => {
      if (!dragRef.current) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      setDrag(prev => prev ? { ...prev, x: clientX, y: clientY } : null);
    };

    const onPointerUp = (e) => {
      if (!dragRef.current) return;
      const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

      // Find which drop zone we're over
      let matched = null;
      for (const zone of dropZonesRef.current) {
        const rect = zone.el.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right &&
            clientY >= rect.top && clientY <= rect.bottom) {
          matched = zone;
        }
      }

      if (matched && onDropRef.current) {
        onDropRef.current(dragRef.current, matched);
      }

      dragRef.current = null;
      setDrag(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
    };
  }, []);

  return (
    <DragCtx.Provider value={{ drag, startDrag, registerDropZone, unregisterDropZone, setOnDrop }}>
      {children}
      <DragGhost drag={drag} />
    </DragCtx.Provider>
  );
}
