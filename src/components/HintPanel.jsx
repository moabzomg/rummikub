import React from 'react';

const BADGE_COLORS = {
  'MELD': '#f4c430',
  'BEST': '#22c87a',
  'SET':  'rgba(34,200,122,.6)',
  'EXTEND': '#1a6fe8',
  'JOKER': '#9b59b6',
  'SPLIT': '#e87a1a',
  'NO MELD': 'rgba(255,255,255,.25)',
  'DRAW': 'rgba(255,255,255,.15)',
};

export default function HintPanel({ hints, onApply, onClose }) {
  if (!hints || !hints.length) return null;

  return (
    <div className="hint-panel vis">
      <div className="hint-hdr">
        <div className="hint-title">💡 BEST MOVES</div>
        <button className="hint-close" onClick={onClose}>✕</button>
      </div>
      <div className="hint-moves">
        {hints.map((hint, idx) => {
          const isBest = idx === 0 && hint.applicable;

          // Build tile list per-set so each set is visually grouped
          const tilesBySet = [];
          // Each entry in hint.sets is one set — keep them grouped
          for (const set of hint.sets) {
            const seen = new Set();
            const setTiles = [];
            for (const t of set) {
              if (!seen.has(t.id)) { seen.add(t.id); setTiles.push(t); }
            }
            if (setTiles.length) tilesBySet.push(setTiles);
          }
          // Single tiles from extends/joker/split
          const extraTiles = [];
          const seenExtra = new Set(hint.sets.flat().map(t => t.id));
          const addExtra = (t) => { if (t && !seenExtra.has(t.id)) { seenExtra.add(t.id); extraTiles.push(t); } };
          if (hint.jrep) addExtra(hint.jrep.handTile);
          if (hint.tile) addExtra(hint.tile);
          if (hint.splits) hint.splits.forEach(sp => addExtra(sp.tile));
          if (hint.exts) hint.exts.forEach(e => addExtra(e.tile));

          const badgeBg = BADGE_COLORS[hint.label] || 'rgba(255,255,255,.2)';
          const badgeColor = ['MELD','BEST'].includes(hint.label) ? '#000' : '#fff';

          return (
            <div
              key={idx}
              className={['hint-move', isBest ? 'best' : '', !hint.applicable ? 'not-applicable' : ''].filter(Boolean).join(' ')}
              onClick={() => hint.applicable && onApply(hint)}
            >
              <div className="hm-badge" style={{ background: badgeBg, color: badgeColor }}>
                {hint.label}
              </div>
              <div style={{ flex: 1 }}>
                <div className="hm-desc">{hint.desc}</div>
                {/* Render each set as a separated group of mini-tiles */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '5px', alignItems: 'center' }}>
                  {tilesBySet.map((setTiles, si) => (
                    <React.Fragment key={si}>
                      {si > 0 && <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,.2)', flexShrink: 0 }} />}
                      <div style={{ display: 'flex', gap: '2px' }}>
                        {setTiles.map(t => (
                          <div key={t.id} className={'mt c-' + t.color}>
                            {t.isJoker ? '\u2605' : t.num}
                          </div>
                        ))}
                      </div>
                    </React.Fragment>
                  ))}
                  {extraTiles.map(t => (
                    <div key={t.id} className={'mt c-' + t.color}>
                      {t.isJoker ? '\u2605' : t.num}
                    </div>
                  ))}
                </div>
              </div>
              {hint.value > 0 && (
                <div className="hm-pts">{hint.value}p</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
