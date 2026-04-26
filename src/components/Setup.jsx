import React, { useState } from 'react';

const DEFAULT_PLAYERS = [
  { name: 'You', type: 'human' },
  { name: 'AI Aria', type: 'ai' },
];

export default function Setup({ onStart }) {
  const [players, setPlayers] = useState(DEFAULT_PLAYERS);

  const updateName = (i, name) => {
    setPlayers(prev => prev.map((p, idx) => idx === i ? { ...p, name } : p));
  };

  const updateType = (i, type) => {
    setPlayers(prev => prev.map((p, idx) => idx === i ? { ...p, type } : p));
  };

  const addPlayer = () => {
    if (players.length >= 4) return;
    const names = ['Bolt', 'Cruz', 'Dune'];
    setPlayers(prev => [...prev, { name: `AI ${names[prev.length - 2]}`, type: 'ai' }]);
  };

  const removePlayer = (i) => {
    setPlayers(prev => prev.filter((_, idx) => idx !== i));
  };

  return (
    <div className="setup">
      <div className="logo">Rummikub</div>
      <div className="logo-sub">Tile Strategy Game</div>
      <div className="setup-card">
        <h3>Players</h3>
        <div className="player-rows">
          {players.map((p, i) => (
            <div key={i} className="player-row">
              <div className="p-num">{i + 1}</div>
              <input
                className="p-name"
                value={p.name}
                onChange={e => updateName(i, e.target.value)}
                placeholder={`Player ${i + 1}`}
              />
              <div className="type-btns">
                <button
                  className={`tbtn${p.type === 'human' ? ' on' : ''}`}
                  onClick={() => updateType(i, 'human')}
                >Human</button>
                <button
                  className={`tbtn${p.type === 'ai' ? ' on' : ''}`}
                  onClick={() => updateType(i, 'ai')}
                >AI</button>
              </div>
              {players.length > 2 && (
                <button
                  className="btn"
                  style={{ padding: '3px 7px', fontSize: '10px' }}
                  onClick={() => removePlayer(i)}
                >✕</button>
              )}
            </div>
          ))}
        </div>

        {players.length < 4 && (
          <button className="add-p" onClick={addPlayer}>
            + Add Player (max 4)
          </button>
        )}

        <button className="start-btn" onClick={() => onStart(players.map(p => ({ ...p })))}>
          DEAL TILES
        </button>
      </div>
    </div>
  );
}
