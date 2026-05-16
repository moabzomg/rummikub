import React, { useState } from 'react';

const AI_NAMES = ['Ethan', 'Connie', 'Morgan', 'Alex', 'Jordan', 'Casey'];

export default function Setup({ onStart }) {
  const [playerName, setPlayerName] = useState('bjnss');
  const [numAI, setNumAI] = useState(3);
  const [aiSpeed, setAiSpeed] = useState(1200);
  const [debugMode, setDebugMode] = useState(false);

  const handleStart = () => {
    const aiNames = AI_NAMES.slice(0, numAI);
    onStart({
      playerName: playerName.trim() || 'Player',
      aiNames,
      aiSpeed,
      debugMode,
    });
  };

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-logo">
          <div className="setup-logo-the">The Original</div>
          <div className="setup-logo-name">Rummikub</div>
        </div>

        <div className="setup-field">
          <label>Your Name</label>
          <input
            className="setup-input"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            maxLength={12}
            placeholder="Your name"
          />
        </div>

        <div className="setup-field">
          <label>Opponents</label>
          <div className="setup-radio-group">
            {[1, 2, 3].map(n => (
              <button
                key={n}
                className={`setup-radio-btn ${numAI === n ? 'active' : ''}`}
                onClick={() => setNumAI(n)}
              >
                {n} AI
              </button>
            ))}
          </div>
        </div>

        <div className="setup-field">
          <label>AI Speed</label>
          <div className="setup-slider-row">
            <span className="setup-slider-label">Fast</span>
            <input
              type="range"
              min={400}
              max={3000}
              step={200}
              value={aiSpeed}
              onChange={e => setAiSpeed(Number(e.target.value))}
              className="setup-slider"
            />
            <span className="setup-slider-label">Slow</span>
          </div>
        </div>

        <div className="setup-field setup-field-row">
          <label>Debug Mode (show AI tiles)</label>
          <div
            className={`setup-toggle ${debugMode ? 'active' : ''}`}
            onClick={() => setDebugMode(d => !d)}
          >
            <div className="setup-toggle-knob" />
          </div>
        </div>

        <button className="setup-start-btn" onClick={handleStart}>
          Start Game
        </button>
      </div>
    </div>
  );
}
