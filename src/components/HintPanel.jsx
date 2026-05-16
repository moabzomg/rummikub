import React from 'react';

export default function HintPanel({ hint, onClose }) {
  const renderHintBody = () => {
    if (!hint) return <p className="hint-unavailable">Calculating hint…</p>;

    if (hint.type === 'no-meld' || hint.type === 'draw') {
      return <p className="hint-unavailable">{hint.message}</p>;
    }

    const label = hint.type === 'initial'
      ? `Initial meld — ${hint.value} pts`
      : `Play suggestion — ${hint.value} pts`;

    return (
      <div>
        <p className="hint-label">{label}</p>
        {hint.sets.map((set, i) => (
          <div key={i} className="hint-set">
            {set.map(tile => (
              <span
                key={tile.id}
                className={`hint-tile hint-tile-${tile.color}`}
              >
                {tile.isJoker ? '☺' : tile.number}
              </span>
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="hint-panel">
      <div className="hint-header">
        <span>💡 Hint</span>
        <button className="hint-close" onClick={onClose}>✕</button>
      </div>
      <div className="hint-body">
        {renderHintBody()}
      </div>
    </div>
  );
}
