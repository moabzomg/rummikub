import React from 'react';
import { useGameState } from './game/useGameState.js';
import MenuScreen from './components/MenuScreen.jsx';
import GameScreen from './components/GameScreen.jsx';
import GameOverScreen from './components/GameOverScreen.jsx';

export default function App() {
  const game = useGameState();

  if (game.screen === 'menu') {
    return <MenuScreen onStart={game.startGame} />;
  }

  if (game.screen === 'game') {
    return (
      <GameScreen
        players={game.players}
        currentPlayer={game.currentPlayer}
        board={game.board}
        pool={game.pool}
        selected={game.selected}
        toggleSelectTile={game.toggleSelectTile}
        setSelected={game.setSelected}
        message={game.message}
        log={game.log}
        aiThinking={game.aiThinking}
        playTiles={game.playTiles}
        drawTile={game.drawTile}
        setScreen={game.setScreen}
      />
    );
  }

  if (game.screen === 'gameover') {
    return (
      <GameOverScreen
        winner={game.winner}
        players={game.players}
        onPlayAgain={() => game.setScreen('menu')}
        onMenu={() => game.setScreen('menu')}
      />
    );
  }

  return null;
}
