import React, { useState } from 'react';
import Setup from './components/Setup';
import Game from './components/Game';
import './styles/main.css';

export default function App() {
  const [phase, setPhase] = useState('setup');
  const [players, setPlayers] = useState(null);

  const handleStart = (ps) => {
    setPlayers(ps);
    setPhase('game');
  };

  const handleReturnToMenu = () => {
    setPlayers(null);
    setPhase('setup');
  };

  if (phase === 'game' && players) {
    return <Game setupPlayers={players} onReturnToMenu={handleReturnToMenu} />;
  }
  return <Setup onStart={handleStart} />;
}
