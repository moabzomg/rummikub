import React, { useState } from 'react';
import Setup from './components/Setup';
import Game from './components/Game';
import { DragProvider } from './components/DragContext';
import './styles/main.css';

export default function App() {
  const [config, setConfig] = useState(null);

  const handleStart = (cfg) => setConfig(cfg);
  const handleBackToMenu = () => setConfig(null);

  return (
    <DragProvider>
      {!config
        ? <Setup onStart={handleStart} />
        : <Game key={JSON.stringify(config)} config={config} onBackToMenu={handleBackToMenu} />
      }
    </DragProvider>
  );
}
