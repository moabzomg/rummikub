import React from 'react';

export default function HintPanel({ hints, onApply, onClose }) {
  if (!hints) return null;

  return (
    <div className="hint-panel vis">
      <div className="hint-hdr">
        <div className="hint-title">💡 BEST MOVES</div>
        <button className="hint-close" onClick={onClose}>✕</button>
      </div>
      <div className="hint-moves">
        {hints.map((hint, idx) => {
          const isBest = idx === 0 && hint.applicable;

          // Build tile list with strict dedup by id — no tile should appear twice
          const seen = new Set();
          const allT = [];
          const addTile = (t) => {
            if (!t || seen.has(t.id)) return;
            seen.add(t.id);
            allT.push(t);
          };

          hint.sets.flat().forEach(addTile);
          if (hint.jrep) addTile(hint.jrep.handTile);
          if (hint.tile) addTile(hint.tile);
          if (hint.splits) hint.splits.forEach(sp => addTile(sp.tile));
          if (hint.exts) hint.exts.forEach(e => addTile(e.tile));

          return (
            <div
              key={idx}
              className={['hint-move', isBest ? 'best' : '', !hint.applicable ? 'not-applicable' : ''].filter(Boolean).join(' ')}
              onClick={() => hint.applicable && onApply(hint)}
            >
              <div className={'hm-badge' + (['draw','no-meld'].includes(hint.type) ? ' draw' : '')}>
                {hint.label}
              </div>
              <div className="hm-desc">{hint.desc}</div>
              <div className="hm-tiles">
                {allT.slice(0, 14).map((t) => (
                  <div key={t.id} className={'mt c-' + t.color}>
                    {t.isJoker ? '\u2605' : t.num}
                  </div>
                ))}
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
