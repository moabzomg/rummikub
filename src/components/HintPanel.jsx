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
          const allT = [
            ...hint.sets.flat(),
            ...(hint.jrep ? [hint.jrep.handTile] : []),
            ...(hint.tile && !hint.sets.flat().some(t => t.id === hint.tile?.id) ? [hint.tile] : []),
          ];

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
                {allT.slice(0, 14).map((t, i) => (
                  <div key={i} className={'mt c-' + t.color}>
                    {t.isJoker ? '★' : t.num}
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
