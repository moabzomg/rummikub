import { useState, useEffect, useRef, useCallback } from 'react'
import { AI_STRATEGIES, aiPlay } from './ai/strategies.js'
import { initGame, drawTile, commitPlay, advanceTurn } from './game/engine.js'
import { sortHand, isValidSet, isValidBoard, COLOR_HEX, handValue } from './game/tiles.js'

// ─── Tile Component ───────────────────────────────────────────────────────────
function Tile({ tile, selected, onClick, onBoard, small }) {
  if (!tile) return null
  if (tile.isJoker) {
    return (
      <div
        className={`tile joker joker-tile${selected ? ' selected' : ''}${onBoard ? ' on-board' : ''}`}
        onClick={onClick}
        title="Joker"
      >
        <span className="t-num">★</span>
      </div>
    )
  }
  return (
    <div
      className={`tile ${tile.color}${selected ? ' selected' : ''}${onBoard ? ' on-board' : ''}`}
      onClick={onClick}
      title={`${tile.color} ${tile.num}`}
    >
      <span className="t-num">{tile.num}</span>
      <div className="t-dot" style={{ background: COLOR_HEX[tile.color] }} />
    </div>
  )
}

// ─── Board Set ────────────────────────────────────────────────────────────────
function BoardSet({ tiles, setIdx, valid, onTileClick }) {
  return (
    <div className={`board-set ${valid ? 'valid-set' : 'invalid-set'}`}>
      {tiles.map((t, i) => (
        <Tile key={t.id} tile={t} onBoard onClick={() => onTileClick && onTileClick(setIdx, i)} />
      ))}
    </div>
  )
}

// ─── Setup Screen ─────────────────────────────────────────────────────────────
function SetupScreen({ onStart }) {
  const [players, setPlayers] = useState([
    { name: 'Player 1', type: 'human', strategy: 'balanced' },
    { name: 'Attacker',  type: 'ai',    strategy: 'aggressive' },
    { name: 'Defender',  type: 'ai',    strategy: 'defensive' },
    { name: 'Speedster', type: 'ai',    strategy: 'speed' },
  ])

  const update = (i, field, val) =>
    setPlayers(prev => prev.map((p, j) => j === i ? { ...p, [field]: val } : p))

  const stratKeys = Object.keys(AI_STRATEGIES)

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-logo">Rummi<span>kub</span></div>
        <div className="setup-tagline">THE CLASSIC TILE-RUMMY GAME</div>

        <div className="setup-section">
          <div className="setup-label">Players (2–4)</div>
          <div className="players-list">
            {players.map((p, i) => (
              <div key={i} className="player-row">
                <div className="player-num">{i + 1}</div>
                <input
                  className="player-name-input"
                  value={p.name}
                  onChange={e => update(i, 'name', e.target.value)}
                  placeholder={`Player ${i + 1}`}
                  maxLength={16}
                />
                <div className="type-toggle">
                  <button className={`type-btn${p.type === 'human' ? ' active' : ''}`} onClick={() => update(i, 'type', 'human')}>👤 Human</button>
                  <button className={`type-btn${p.type === 'ai' ? ' active' : ''}`} onClick={() => update(i, 'type', 'ai')}>🤖 AI</button>
                </div>
                {p.type === 'ai' && (
                  <select className="strat-select" value={p.strategy} onChange={e => update(i, 'strategy', e.target.value)}>
                    {stratKeys.map(k => (
                      <option key={k} value={k}>{AI_STRATEGIES[k].emoji} {AI_STRATEGIES[k].name}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="setup-section">
          <div className="setup-label">AI Strategy Guide</div>
          <div className="strategy-grid">
            {stratKeys.map(k => {
              const s = AI_STRATEGIES[k]
              return (
                <div key={k} className="strat-card">
                  <div className="strat-card-header">{s.emoji} {s.fullName}</div>
                  <div className="strat-card-desc">{s.description}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="setup-section" style={{marginBottom:0}}>
          <div className="setup-label">Rules Reminder</div>
          <div style={{fontSize:'0.68rem',color:'var(--ink2)',lineHeight:1.6}}>
            • Deal 14 tiles each. First meld must score ≥ 30 points from your hand only.<br/>
            • Valid sets: <strong>Groups</strong> (3–4 same number, different colours) or <strong>Runs</strong> (3+ consecutive, same colour).<br/>
            • You may rearrange any tiles on the board as long as all sets remain valid.<br/>
            • If you can't play, draw a tile and pass. First to empty their hand wins!
          </div>
        </div>

        <div style={{marginTop:'22px'}}>
          <button
            className="btn btn-primary"
            style={{width:'100%',padding:'12px',fontSize:'0.85rem'}}
            onClick={() => onStart(players.filter(p => p.name.trim()))}
          >
            Start Game →
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Win Overlay ──────────────────────────────────────────────────────────────
function WinOverlay({ state, onNewGame }) {
  const { winner, players, scores, hands } = state
  const winnerName = players[winner]?.name || '?'

  return (
    <div className="overlay">
      <div className="win-card">
        <div className="win-emoji">🏆</div>
        <div className="win-title">{winnerName} Wins!</div>
        <div className="win-sub">
          {players[winner]?.type === 'ai'
            ? `The ${AI_STRATEGIES[players[winner].strategy]?.fullName} AI dominates the table.`
            : `Brilliant play! The board is yours.`}
        </div>
        <div className="win-scores">
          {players.map((p, i) => (
            <div key={i} className={`win-score${i === winner ? ' winner' : ''}`}>
              <div className="win-score-name">{p.name}</div>
              <div className="win-score-val">{i === winner ? '+' : ''}{scores[i] || 0}</div>
            </div>
          ))}
        </div>
        <button className="btn btn-primary" onClick={onNewGame} style={{padding:'10px 32px'}}>
          Play Again
        </button>
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState('setup')
  const [state, setState] = useState(null)
  const [selectedTiles, setSelectedTiles] = useState([]) // {tileId, source:'hand'|'board', setIdx?, tileIdx?}[]
  const [pendingBoard, setPendingBoard] = useState(null)  // board during human turn
  const [pendingHand, setPendingHand] = useState(null)
  const [error, setError] = useState(null)
  const [aiThinking, setAiThinking] = useState(false)
  const logRef = useRef(null)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [state?.log])

  const startGame = useCallback((players) => {
    const g = initGame(players)
    setState(g)
    setPendingBoard(null)
    setPendingHand(null)
    setSelectedTiles([])
    setError(null)
    setScreen('game')
  }, [])

  // AI auto-play
  useEffect(() => {
    if (!state || state.phase !== 'play') return
    const cur = state.players[state.currentPlayer]
    if (cur?.type !== 'ai') return

    setAiThinking(true)
    const delay = 800 + Math.random() * 600

    const t = setTimeout(() => {
      setState(prev => {
        if (!prev || prev.players[prev.currentPlayer]?.type !== 'ai') return prev
        const result = aiPlay(prev, prev.currentPlayer)
        if (!result) {
          // AI draws
          return drawTile(prev, prev.currentPlayer)
        }
        const { newBoard, newHand } = result
        return commitPlay(prev, newBoard, newHand, prev.currentPlayer)
      })
      setAiThinking(false)
    }, delay)

    return () => { clearTimeout(t); setAiThinking(false) }
  }, [state?.currentPlayer, state?.phase])

  // Human turn board/hand init
  useEffect(() => {
    if (!state || state.phase !== 'play') return
    const cur = state.players[state.currentPlayer]
    if (cur?.type !== 'human') return
    setPendingBoard(state.board.map(s => [...s]))
    setPendingHand(sortHand([...state.hands[state.currentPlayer]]))
    setSelectedTiles([])
    setError(null)
  }, [state?.currentPlayer, state?.phase])

  const board = pendingBoard || state?.board || []
  const currentHand = (state?.players[state?.currentPlayer]?.type === 'human' ? pendingHand : null)
    || state?.hands[state?.currentPlayer] || []
  const isHumanTurn = state?.phase === 'play' && state.players[state.currentPlayer]?.type === 'human'
  const boardChanged = pendingBoard && JSON.stringify(pendingBoard) !== JSON.stringify(state?.board)

  // Tile selection from hand
  const handleHandTileClick = (tile) => {
    if (!isHumanTurn) return
    setError(null)
    const alreadySelected = selectedTiles.find(s => s.tileId === tile.id && s.source === 'hand')

    if (alreadySelected) {
      setSelectedTiles(prev => prev.filter(s => !(s.tileId === tile.id && s.source === 'hand')))
    } else {
      setSelectedTiles(prev => [...prev, { tileId: tile.id, source: 'hand' }])
    }
  }

  // Place selected hand tiles as a new set on the board
  const handlePlaceAsSet = () => {
    if (!isHumanTurn) return
    const handSelected = selectedTiles.filter(s => s.source === 'hand')
    if (handSelected.length < 3) { setError('Select at least 3 tiles to form a set.'); return }

    const ids = new Set(handSelected.map(s => s.tileId))
    const tiles = (pendingHand || state.hands[state.currentPlayer]).filter(t => ids.has(t.id))

    if (!isValidSet(tiles)) { setError('Selected tiles do not form a valid set (group or run).'); return }

    const newHand = sortHand((pendingHand || []).filter(t => !ids.has(t.id)))
    const newBoard = [...(pendingBoard || []), tiles]
    setPendingBoard(newBoard)
    setPendingHand(newHand)
    setSelectedTiles([])
    setError(null)
  }

  // Reset pending changes
  const handleReset = () => {
    setPendingBoard(state.board.map(s => [...s]))
    setPendingHand(sortHand([...state.hands[state.currentPlayer]]))
    setSelectedTiles([])
    setError(null)
  }

  // Commit human play
  const handleConfirm = () => {
    if (!isHumanTurn) return
    const result = commitPlay(state, pendingBoard, pendingHand, state.currentPlayer)
    if (result.error) { setError(result.error); return }
    setState(result)
    setError(null)
  }

  // Draw tile
  const handleDraw = () => {
    if (!isHumanTurn) return
    setState(prev => drawTile(prev, prev.currentPlayer))
    setError(null)
  }

  if (screen === 'setup') return <SetupScreen onStart={startGame} />

  const currentPlayer = state?.players[state?.currentPlayer]
  const boardValid = isValidBoard(board)

  return (
    <div className="app">
      {state?.phase === 'finished' && <WinOverlay state={state} onNewGame={() => setScreen('setup')} />}

      {/* Header */}
      <div className="header">
        <h1>Rummi<span>kub</span></h1>
        <div className="header-right">
          {aiThinking && (
            <div className="ai-thinking">
              🤖 {currentPlayer?.name} thinking
              <span className="thinking-dots"><span>.</span><span>.</span><span>.</span></span>
            </div>
          )}
          <button className="btn btn-sm" onClick={() => setScreen('setup')}>⚙ New Setup</button>
        </div>
      </div>

      {/* Scores */}
      <div className="scores-bar">
        {state?.players.map((p, i) => (
          <div key={i} className={`score-card${i === state.currentPlayer ? ' active' : ''}`}>
            <div className="sc-label">{p.type === 'ai' ? `AI · ${AI_STRATEGIES[p.strategy]?.emoji}` : 'Human'}</div>
            <div className="sc-name">{p.name}</div>
            <div className="sc-tiles">{state.hands[i]?.length} tiles</div>
            {state.hasInitialMeld[i] && <div className="sc-meld">✓ Melded</div>}
          </div>
        ))}
      </div>

      {/* Main area */}
      <div className="main-area">
        {/* Board */}
        <div className="board-panel">
          <div className="board-label">
            Board · {board.flat().length} tiles · {board.length} sets
            {boardChanged && (boardValid
              ? <span style={{color:'var(--green)',marginLeft:'8px'}}>✓ Valid</span>
              : <span style={{color:'var(--red)',marginLeft:'8px'}}>✗ Invalid</span>)}
          </div>
          <div className={`board${boardChanged ? (boardValid ? ' valid' : ' invalid') : ''}`}>
            {board.length === 0 ? (
              <div className="board-empty">
                <div className="board-empty-icon">🀱</div>
                <div>Board is empty</div>
                <div style={{fontSize:'0.6rem',color:'var(--ink3)'}}>Play sets here to begin</div>
              </div>
            ) : (
              <div className="board-sets">
                {board.map((set, si) => (
                  <BoardSet
                    key={si}
                    tiles={set}
                    setIdx={si}
                    valid={isValidSet(set)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Error/info */}
          {error && <div className="banner banner-error">⚠ {error}</div>}

          {/* Human actions */}
          {isHumanTurn && (
            <div className="actions-area">
              <button
                className="btn btn-gold"
                disabled={selectedTiles.filter(s => s.source === 'hand').length < 3}
                onClick={handlePlaceAsSet}
              >
                Place as Set
              </button>
              <button
                className="btn btn-success"
                disabled={!boardChanged || !boardValid}
                onClick={handleConfirm}
              >
                ✓ Confirm Play
              </button>
              <button
                className="btn"
                disabled={!boardChanged}
                onClick={handleReset}
              >
                ↺ Reset
              </button>
              <button
                className="btn btn-danger"
                disabled={boardChanged}
                onClick={handleDraw}
              >
                Draw & Pass
              </button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="sidebar">
          {/* Pool */}
          <div className="sidebar-panel">
            <div className="panel-title">Pool</div>
            <div className="pool-info">
              <div className="pool-count">{state?.pool?.length || 0}</div>
              <div className="pool-label">tiles remaining</div>
            </div>
          </div>

          {/* Log */}
          <div className="sidebar-panel log-panel">
            <div className="panel-title">Game Log</div>
            <div className="log-entries" ref={logRef}>
              {state?.log?.slice(-30).map((entry, i) => (
                <div key={i} className="log-entry">{entry}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Player Hand */}
      {state && (
        <div className="hand-area">
          <div className="hand-header">
            <div className="hand-title">
              {isHumanTurn ? `Your Hand` : `${currentPlayer?.name}'s Hand`}
              {!isHumanTurn && currentPlayer?.type === 'ai' && (
                <span style={{fontSize:'0.7rem',fontFamily:'DM Mono',fontWeight:400,marginLeft:'8px',color:'var(--ink3)'}}>
                  {AI_STRATEGIES[currentPlayer.strategy]?.emoji} {AI_STRATEGIES[currentPlayer.strategy]?.name}
                </span>
              )}
            </div>
            <div className="hand-count">
              {isHumanTurn ? pendingHand?.length : state.hands[state.currentPlayer]?.length} tiles
              {isHumanTurn && !state.hasInitialMeld[state.currentPlayer] && (
                <span style={{color:'var(--gold)',marginLeft:'8px',fontSize:'0.65rem'}}>
                  (Initial meld ≥30 pts needed)
                </span>
              )}
            </div>
          </div>
          <div className="hand-tiles">
            {(isHumanTurn ? pendingHand : state.hands[state.currentPlayer])?.map(tile => (
              <Tile
                key={tile.id}
                tile={tile}
                selected={isHumanTurn && selectedTiles.some(s => s.tileId === tile.id && s.source === 'hand')}
                onClick={() => handleHandTileClick(tile)}
              />
            ))}
          </div>
          {isHumanTurn && selectedTiles.filter(s => s.source === 'hand').length > 0 && (
            <div className="selected-info">
              {selectedTiles.filter(s => s.source === 'hand').length} tiles selected
              · Value: {handValue(
                (pendingHand || []).filter(t => selectedTiles.find(s => s.tileId === t.id && s.source === 'hand'))
              )} pts
              <button className="btn btn-sm" style={{marginLeft:'10px'}} onClick={() => setSelectedTiles([])}>Clear</button>
            </div>
          )}
          {isHumanTurn && (
            <div className="hand-hint">
              Click tiles to select · Select 3+ to place as a set · Confirm when board is valid
            </div>
          )}
        </div>
      )}
    </div>
  )
}
