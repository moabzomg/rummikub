import { useState, useCallback } from "react";
import {
  createDeck,
  isValidBoard,
  isValidSet,
  initialMeldValue,
  handValue,
  computeAIMove,
  tileValue,
} from "../game/logic.js";

const INITIAL_HAND_SIZE = 14;

function dealHands(deck, numPlayers) {
  const hands = Array.from({ length: numPlayers }, () => []);
  let di = 0;
  for (let i = 0; i < INITIAL_HAND_SIZE * numPlayers; i++) {
    hands[i % numPlayers].push(deck[di++]);
  }
  return { hands, remaining: deck.slice(di) };
}

export function useGameState() {
  const [screen, setScreen] = useState("menu"); // menu | setup | game | gameover
  const [gameMode, setGameMode] = useState(null); // '1v1-ai' | '2p' | '3p' | '4p'
  const [players, setPlayers] = useState([]);
  const [board, setBoard] = useState([]); // array of sets (each set = array of tiles)
  const [pool, setPool] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [selected, setSelected] = useState([]); // tile ids selected from hand
  const [stagingBoard, setStagingBoard] = useState(null); // null = not in editing mode
  const [message, setMessage] = useState("");
  const [log, setLog] = useState([]);
  const [winner, setWinner] = useState(null);
  const [aiThinking, setAiThinking] = useState(false);

  const addLog = useCallback((msg) => {
    setLog((prev) => [...prev.slice(-20), msg]);
  }, []);

  const startGame = useCallback((mode, playerNames) => {
    const deck = createDeck();
    const numPlayers = playerNames.length;

    // 👇 Fill in default names
    const finalNames = playerNames.map((name, i) =>
      name && name.trim() !== "" ? name : `Player ${i + 1}`,
    );

    const { hands, remaining } = dealHands(deck, numPlayers);

    const newPlayers = finalNames.map((name, i) => ({
      id: i,
      name,
      isAI: name === "AI",
      hand: hands[i],
      hasInitialMeld: false,
      score: 0,
    }));

    setPlayers(newPlayers);
    setPool(remaining);
    setBoard([]);
    setCurrentPlayer(0);
    setSelected([]);
    setStagingBoard(null);
    setMessage(`${newPlayers[0].name}'s turn`);
    setLog([`Game started! ${newPlayers[0].name} goes first.`]);
    setWinner(null);
    setGameMode(mode);
    setScreen("game");
  }, []);

  const toggleSelectTile = useCallback((tileId) => {
    setSelected((prev) =>
      prev.includes(tileId)
        ? prev.filter((id) => id !== tileId)
        : [...prev, tileId],
    );
  }, []);

  const drawTile = useCallback(() => {
    setPlayers((prev) => {
      const updated = [...prev];
      const player = { ...updated[currentPlayer] };

      if (pool.length === 0) {
        setMessage("Pool is empty! Skipping turn.");
        addLog(`${player.name} skipped (pool empty).`);
      } else {
        const [drawn, ...rest] = pool;
        setPool(rest);
        player.hand = [...player.hand, drawn];
        addLog(`${player.name} drew a tile.`);
      }

      updated[currentPlayer] = player;
      return updated;
    });
    setSelected([]);
    setStagingBoard(null);
    nextTurn();
  }, [currentPlayer, pool, addLog]);

  const playTiles = useCallback(() => {
    if (selected.length === 0 && stagingBoard === null) return;

    const player = players[currentPlayer];
    const hand = player.hand;
    const selectedTiles = hand.filter((t) => selected.includes(t.id));

    // Build proposed new set from selected tiles
    const newSet = selectedTiles;

    if (!isValidSet(newSet)) {
      setMessage("❌ That is not a valid set (need run or group of 3+)");
      return;
    }

    if (!player.hasInitialMeld) {
      const val = initialMeldValue([newSet]);
      if (val < 30) {
        setMessage(
          `❌ Initial meld must total at least 30 points (yours: ${val})`,
        );
        return;
      }
    }

    // Remove from hand, add to board
    setPlayers((prev) => {
      const updated = [...prev];
      const p = { ...updated[currentPlayer] };
      p.hand = p.hand.filter((t) => !selected.includes(t.id));
      p.hasInitialMeld = true;
      updated[currentPlayer] = p;

      // Check win
      if (p.hand.length === 0) {
        setWinner(p);
        setScreen("gameover");
        addLog(`🏆 ${p.name} wins!`);
      }

      return updated;
    });

    setBoard((prev) => [...prev, newSet]);
    addLog(`${player.name} played a set of ${newSet.length} tiles.`);
    setSelected([]);
    setMessage(`${player.name} played! Ending turn...`);

    if (players[currentPlayer].hand.length - selectedTiles.length === 0) return; // win handled above
    nextTurn();
  }, [selected, players, currentPlayer, addLog, stagingBoard]);

  const nextTurn = useCallback(() => {
    setCurrentPlayer((prev) => {
      const next = (prev + 1) % players.length;
      const nextPlayer = players[next];
      setMessage(`${nextPlayer?.name}'s turn`);

      if (nextPlayer?.isAI) {
        setAiThinking(true);
        setTimeout(() => {
          doAITurn(next);
          setAiThinking(false);
        }, 1200);
      }

      return next;
    });
  }, [players]);
  const [sortMode, setSortMode] = useState("color");
  const doAITurn = useCallback(
    (playerIdx) => {
      setPlayers((prev) => {
        const updated = [...prev];
        const player = { ...updated[playerIdx] };
        const move = computeAIMove(player.hand, board, player.hasInitialMeld);

        if (move.type === "draw") {
          if (pool.length > 0) {
            const [drawn, ...rest] = pool;
            setPool(rest);
            player.hand = [...player.hand, drawn];
            addLog(`AI drew a tile. (${player.hand.length} in hand)`);
          } else {
            addLog("AI skipped (pool empty).");
          }
        } else {
          // Play sets
          const playedIds = new Set();
          const newSets = [...board];

          for (const set of move.sets) {
            newSets.push(set);
            set.forEach((t) => playedIds.add(t.id));
          }

          // Additions to existing sets
          if (move.additions) {
            for (const addition of move.additions) {
              if (!playedIds.has(addition.tile.id)) {
                if (addition.position === "end") {
                  newSets[addition.setIndex] = [
                    ...newSets[addition.setIndex],
                    addition.tile,
                  ];
                } else {
                  newSets[addition.setIndex] = [
                    addition.tile,
                    ...newSets[addition.setIndex],
                  ];
                }
                playedIds.add(addition.tile.id);
              }
            }
          }

          player.hand = player.hand.filter((t) => !playedIds.has(t.id));
          player.hasInitialMeld = true;
          setBoard(newSets);
          addLog(
            `AI played ${playedIds.size} tile(s). (${player.hand.length} left)`,
          );

          if (player.hand.length === 0) {
            setWinner(player);
            setScreen("gameover");
            addLog("🏆 AI wins!");
          }
        }

        updated[playerIdx] = player;
        return updated;
      });

      setCurrentPlayer((prev) => {
        const next = (prev + 1) % players.length;
        setMessage(`${players[next]?.name}'s turn`);
        return next;
      });
    },
    [board, pool, players, addLog],
  );

  return {
    screen,
    setScreen,
    gameMode,
    players,
    currentPlayer,
    board,
    setBoard,
    pool,
    selected,
    toggleSelectTile,
    setSelected,
    stagingBoard,
    setStagingBoard,
    message,
    setMessage,
    log,
    winner,
    aiThinking,
    startGame,
    drawTile,
    playTiles,
    nextTurn,
    sortMode,
    setSortMode,
  };
}
