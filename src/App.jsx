import { useState, useEffect, useRef, useCallback } from 'react'
import { AI_STRATEGIES, aiPlay } from './ai/strategies.js'
import { initGame, drawTile, commitPlay, advanceTurn, setSortMode } from './game/engine.js'
import { sortHand, isValidSet, isValidBoard, handValue, tileValue, suggestPlayableSets, COLOR_HEX, COLOR_NAME, COLORS } from './game/tiles.js'

// ─────────────────────────────────────────────────────────────────────────────
// Joker SVG — star-burst wildcard
// ─────────────────────────────────────────────────────────────────────────────
function JokerStar({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <defs>
        <radialGradient id="jg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffe066" />
          <stop offset="60%" stopColor="#ffd700" />
          <stop offset="100%" stopColor="#cc9900" />
        </radialGradient>
        <filter id="jglow">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* Outer 8-point star */}
      <polygon filter="url(#jglow)"
        points="50,5 61,35 93,35 68,57 78,90 50,70 22,90 32,57 7,35 39,35"
        fill="url(#jg)" stroke="#aa7700" strokeWidth="1.5" />
      {/* Inner circle */}
      <circle cx="50" cy="50" r="14" fill="#fff8d0" stroke="#cc9900" strokeWidth="1.5" />
      {/* J letter */}
      <text x="50" y="57" textAnchor="middle" fontSize="16" fontWeight="900"
        fontFamily="Playfair Display,serif" fill="#8b6914">J</text>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tile component — authentic ivory Rummikub tile look
// ─────────────────────────────────────────────────────────────────────────────
function Tile({ tile, selected, onClick, inBoard }) {
  if (!tile) return null
  const cls = [
    'tile',
    tile.isJoker ? 'joker' : tile.color,
    selected ? 'sel' : '',
    inBoard ? 'in-board' : '',
  ].filter(Boolean).join(' ')

  if (tile.isJoker) {
    return (
      <div className={cls} onClick={onClick} title="Joker — wild card">
        <div className="joker-star"><JokerStar size={inBoard ? 22 : 28} /></div>
        <div className="joker-lbl">JOKER</div>
      </div>
    )
  }

  return (
    <div className={cls} onClick={onClick} title={`${COLOR_NAME[tile.color]} ${tile.num}`}>
      <span className="t-corner tl">{tile.num}</span>
      <span className="t-num">{tile.num}</span>
      <span className="t-corner br">{tile.num}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Board Set
// ─────────────────────────────────────────────────────────────────────────────
function BoardSet({ tiles, valid }) {
  const type = valid ? (tiles.filter(t => !t.isJoker).every((t,_,a) => t.num === a[0].num) ? 'GROUP' : 'RUN') : '⚠'
  return (
    <div className={`bset ${valid ? 'ok' : 'inv'}`}>
      <div className="bset-type">{type}</div>
      {tiles.map(t => <Tile key={t.id} tile={t} inBoard />)}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Suggested sets strip
// ─────────────────────────────────────────────────────────────────────────────
function SuggestionStrip({ hand, usedIds, onPlaySet }) {
  const suggestions = suggestPlayableSets(hand).slice(0, 8) // show up to 8

  return (
    <div className="suggestions">
      <div className="sugg-lbl">READY</div>
      <div className="sugg-sets">
        {suggestions.length === 0 && (
          <div className="sugg-empty">No playable sets yet</div>
        )}
        {suggestions.map((set, i) => {
          const isUsed = set.some(t => usedIds.has(t.id))
          const val = handValue(set)
          return (
            <div
              key={i}
              className={`sugg-set${isUsed ? ' used' : ''}`}
              onClick={() => !isUsed && onPlaySet(set)}
              title={isUsed ? 'Tiles already placed' : `Click to place (${val} pts)`}
            >
              <div className="sugg-val">{val}pts</div>
              {set.map(t => <Tile key={t.id} tile={t} inBoard />)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup Screen
// ─────────────────────────────────────────────────────────────────────────────
function SetupScreen({ onStart }) {
  const [count, setCount] = useState(4)
  const [players, setPlayers] = useState([
    { name: 'Player 1', type: 'human', strategy: 'balanced' },
    { name: 'Attacker',  type: 'ai',   strategy: 'aggressive' },
    { name: 'Defender',  type: 'ai',   strategy: 'defensive' },
    { name: 'Speedster', type: 'ai',   strategy: 'speed' },
  ])

  const upd = (i, f, v) => setPlayers(prev => prev.map((p, j) => j === i ? { ...p, [f]: v } : p))
  const stratKeys = Object.keys(AI_STRATEGIES)

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-logo">Rummi<em>kub</em></div>
        <div className="setup-tag">The Classic Tile-Rummy Game</div>

        <div className="setup-sec">
          <div className="setup-lbl">Number of Players</div>
          <div className="p-count">
            {[2,3,4].map(n => (
              <button key={n} className={`p-count-btn${count===n?' act':''}`} onClick={() => setCount(n)}>
                {n} Players
              </button>
            ))}
          </div>

          <div className="player-rows">
            {players.slice(0, count).map((p, i) => (
              <div key={i} className="player-row">
                <div className="p-num">{i + 1}</div>
                <input className="p-name-input" value={p.name} maxLength={14}
                  onChange={e => upd(i, 'name', e.target.value)} placeholder={`Player ${i+1}`} />
                <div className="type-tog">
                  <button className={`type-btn${p.type==='human'?' act':''}`} onClick={() => upd(i, 'type', 'human')}>👤 Human</button>
                  <button className={`type-btn${p.type==='ai'?' act':''}`} onClick={() => upd(i, 'type', 'ai')}>🤖 AI</button>
                </div>
                {p.type === 'ai' && (
                  <select className="strat-sel" value={p.strategy} onChange={e => upd(i, 'strategy', e.target.value)}>
                    {stratKeys.map(k => <option key={k} value={k}>{AI_STRATEGIES[k].emoji} {AI_STRATEGIES[k].name}</option>)}
                  </select>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="setup-sec">
          <div className="setup-lbl">AI Strategy Guide</div>
          <div className="strat-grid">
            {stratKeys.map(k => (
              <div key={k} className="strat-c">
                <div className="strat-h">{AI_STRATEGIES[k].emoji} {AI_STRATEGIES[k].fullName}</div>
                <div className="strat-d">{AI_STRATEGIES[k].description}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="setup-sec" style={{marginBottom:0,fontSize:'.68rem',color:'var(--ink2)',lineHeight:1.65}}>
          <div className="setup-lbl">Rules</div>
          🃏 Deal 14 tiles each &nbsp;·&nbsp; First play must score <strong>≥30 pts</strong> from your hand only<br/>
          ✅ Valid sets: <strong>Groups</strong> (3–4 same number, diff colours) or <strong>Runs</strong> (3+ consecutive, same colour)<br/>
          🔄 Rearrange any board tiles freely — all sets must stay valid to confirm<br/>
          🎯 If pool empties, each player gets <strong>one final turn</strong>, then lowest hand value wins
        </div>

        <button className="btn btn-primary"
          style={{width:'100%',padding:'12px',fontSize:'.82rem',marginTop:'22px'}}
          onClick={() => onStart(players.slice(0, count))}>
          Start Game →
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Win Overlay
// ─────────────────────────────────────────────────────────────────────────────
function WinOverlay({ state, onNewGame }) {
  const { winner, players, scores, hands } = state
  const w = players[winner]
  return (
    <div className="overlay">
      <div className="win-card">
        <div className="win-icon">🏆</div>
        <div className="win-title">{w.name} Wins!</div>
        <div className="win-sub">
          {w.type === 'ai'
            ? `The ${AI_STRATEGIES[w.strategy]?.fullName} AI conquers the rack.`
            : `Brilliant play! Hand cleared.`}
        </div>
        <div className="win-scores">
          {players.map((p, i) => (
            <div key={i} className={`ws${i===winner?' winner':''}`}>
              <div className="ws-name">{p.name}</div>
              <div className="ws-val">{scores[i] > 0 ? '+' : ''}{scores[i]}</div>
              <div className="ws-hand">{hands[i].length} tiles left</div>
            </div>
          ))}
        </div>
        <button className="btn btn-primary" onClick={onNewGame} style={{padding:'10px 32px'}}>Play Again</button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState('setup')
  const [state, setState] = useState(null)
  // Human turn working state
  const [pendingBoard, setPendingBoard] = useState(null)
  const [pendingHand, setPendingHand] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [error, setError] = useState(null)
  const [aiThinking, setAiThinking] = useState(false)
  const logRef = useRef(null)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [state?.log])

  // ── Start game ──
  const startGame = useCallback((players) => {
    const g = initGame(players)
    setState(g)
    setScreen('game')
    setPendingBoard(null)
    setPendingHand(null)
    setSelectedIds(new Set())
    setError(null)
  }, [])

  // ── AI auto-play ──
  useEffect(() => {
    if (!state || state.phase !== 'play') return
    const cur = state.players[state.currentPlayer]
    if (cur?.type !== 'ai') return

    setAiThinking(true)
    const t = setTimeout(() => {
      setState(prev => {
        if (!prev || prev.players[prev.currentPlayer]?.type !== 'ai') return prev
        const result = aiPlay(prev, prev.currentPlayer)
        return result
          ? commitPlay(prev, result.newBoard, result.newHand, prev.currentPlayer)
          : drawTile(prev, prev.currentPlayer)
      })
      setAiThinking(false)
    }, 700 + Math.random() * 500)
    return () => { clearTimeout(t); setAiThinking(false) }
  }, [state?.currentPlayer, state?.phase])

  // ── Init human turn working state ──
  useEffect(() => {
    if (!state || state.phase !== 'play') return
    const cur = state.players[state.currentPlayer]
    if (cur?.type !== 'human') return
    const mode = state.sortMode[state.currentPlayer] || 'color'
    setPendingBoard(state.board.map(s => [...s]))
    setPendingHand(sortHand([...state.hands[state.currentPlayer]], mode))
    setSelectedIds(new Set())
    setError(null)
  }, [state?.currentPlayer, state?.phase])

  // ── Sort toggle ──
  const handleSort = (mode) => {
    if (!state) return
    const newState = setSortMode(state, state.currentPlayer, mode)
    setState(newState)
    const sorted = sortHand(pendingHand || [], mode)
    setPendingHand(sorted)
  }

  // ── Hand tile click ──
  const handleTileClick = (tile) => {
    if (!isHumanTurn) return
    setError(null)
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(tile.id) ? next.delete(tile.id) : next.add(tile.id)
      return next
    })
  }

  // ── Place selected as new set ──
  const handlePlaceSelected = () => {
    if (!isHumanTurn) return
    const tiles = (pendingHand || []).filter(t => selectedIds.has(t.id))
    if (tiles.length < 3) { setError('Select at least 3 tiles to form a set.'); return }
    if (!isValidSet(tiles)) { setError('Selected tiles don\'t form a valid set. Check it\'s a proper group or run.'); return }
    const ids = new Set(tiles.map(t => t.id))
    const newHand = sortHand((pendingHand || []).filter(t => !ids.has(t.id)), state.sortMode[state.currentPlayer] || 'color')
    const newBoard = [...(pendingBoard || []), tiles]
    setPendingHand(newHand)
    setPendingBoard(newBoard)
    setSelectedIds(new Set())
    setError(null)
  }

  // ── Play a suggested set (one-click) ──
  const handlePlaySuggestion = (set) => {
    if (!isHumanTurn) return
    const usedOnBoard = set.some(t => (pendingBoard || []).flat().find(b => b.id === t.id))
    if (usedOnBoard) return
    const ids = new Set(set.map(t => t.id))
    const newHand = sortHand((pendingHand || []).filter(t => !ids.has(t.id)), state.sortMode[state.currentPlayer] || 'color')
    const newBoard = [...(pendingBoard || []), set]
    setPendingHand(newHand)
    setPendingBoard(newBoard)
    setSelectedIds(new Set())
    setError(null)
  }

  // ── Reset ──
  const handleReset = () => {
    const mode = state.sortMode[state.currentPlayer] || 'color'
    setPendingBoard(state.board.map(s => [...s]))
    setPendingHand(sortHand([...state.hands[state.currentPlayer]], mode))
    setSelectedIds(new Set())
    setError(null)
  }

  // ── Confirm play ──
  const handleConfirm = () => {
    if (!isHumanTurn) return
    const result = commitPlay(state, pendingBoard, pendingHand, state.currentPlayer)
    if (result.error) { setError(result.error); return }
    setState(result)
    setError(null)
  }

  // ── Draw & pass ──
  const handleDraw = () => {
    if (!isHumanTurn) return
    setState(prev => drawTile(prev, prev.currentPlayer))
    setError(null)
  }

  if (screen === 'setup') return <SetupScreen onStart={startGame} />

  const isHumanTurn = state?.phase === 'play' && state.players[state.currentPlayer]?.type === 'human'
  const cur = state?.players[state?.currentPlayer]
  const board = pendingBoard || state?.board || []
  const displayHand = isHumanTurn ? (pendingHand || []) : (state?.hands[state?.currentPlayer] || [])
  const boardChanged = isHumanTurn && pendingBoard && JSON.stringify(pendingBoard) !== JSON.stringify(state.board)
  const boardValid = isValidBoard(board)
  const sortMode = state?.sortMode[state?.currentPlayer] || 'color'

  // Tiles currently placed on pending board (to grey out suggestions)
  const pendingBoardIds = new Set((pendingBoard || []).flat().map(t => t.id))
  const origHandIds = new Set((state?.hands[state?.currentPlayer] || []).map(t => t.id))
  // IDs from hand that are now on pending board
  const placedIds = new Set([...pendingBoardIds].filter(id => origHandIds.has(id)))

  // For suggestion strip, filter hand to tiles not yet placed
  const handForSuggestions = (pendingHand || []).filter(t => !placedIds.has(t.id))

  const selectedTiles = displayHand.filter(t => selectedIds.has(t.id))
  const selValue = selectedTiles.reduce((s, t) => s + tileValue(t), 0)

  return (
    <div className="app">
      {state?.phase === 'finished' && <WinOverlay state={state} onNewGame={() => setScreen('setup')} />}

      {/* Header */}
      <div className="hdr">
        <div className="hdr-title">Rummi<em>kub</em></div>
        <div className="hdr-right">
          {aiThinking && (
            <div className="thinking">
              🤖 {cur?.name} thinking
              <span className="dots"><span>.</span><span>.</span><span>.</span></span>
            </div>
          )}
          <button className="btn btn-sm" onClick={() => setScreen('setup')}>⚙ New Game</button>
        </div>
      </div>

      {/* Scores */}
      <div className="scores">
        {state?.players.map((p, i) => (
          <div key={i} className={`sc${i === state.currentPlayer ? ' cur' : ''}`}>
            <div className="sc-top">
              <div className="sc-name">{p.name}</div>
              <div className="sc-badge">
                {p.type === 'ai' ? `${AI_STRATEGIES[p.strategy]?.emoji} AI` : '👤'}
              </div>
            </div>
            <div className="sc-sub">
              <span>{state.hands[i]?.length} tiles</span>
              {state.hasInitialMeld[i] && <span className="meld-check">✓ melded</span>}
              {state.finalRound && <span style={{color:'var(--red)',fontWeight:600}}>FINAL</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Main */}
      <div className="main">
        {/* Board */}
        <div className="board-wrap">
          <div className="board-bar">
            <div className="board-lbl">
              Board · {board.flat().length} tiles in {board.length} sets
              {boardChanged && (
                boardValid
                  ? <span style={{color:'var(--green)',marginLeft:8}}>✓ valid</span>
                  : <span style={{color:'var(--red)',marginLeft:8}}>✗ invalid</span>
              )}
            </div>
          </div>

          <div className={`board${boardChanged ? (boardValid ? ' valid' : ' invalid') : ''}`}>
            {board.length === 0 ? (
              <div className="board-empty">
                <div className="board-empty-icon">🀱</div>
                <div>Board is empty</div>
                <div style={{fontSize:'.6rem'}}>Place sets here to begin</div>
              </div>
            ) : (
              <div className="board-sets">
                {board.map((set, si) => (
                  <BoardSet key={si} tiles={set} valid={isValidSet(set)} />
                ))}
              </div>
            )}
          </div>

          {error && <div className="banner b-err">⚠ {error}</div>}
          {state?.finalRound && !error && (
            <div className="banner b-warn">⏰ Final round — pool is empty. Each player gets one last turn!</div>
          )}

          {/* Human actions */}
          {isHumanTurn && (
            <div className="actions">
              <button className="btn btn-primary"
                disabled={selectedIds.size < 3}
                onClick={handlePlaceSelected}>
                Place Selected ({selectedIds.size})
              </button>
              <button className="btn btn-green"
                disabled={!boardChanged || !boardValid}
                onClick={handleConfirm}>
                ✓ Confirm Play
              </button>
              <button className="btn"
                disabled={!boardChanged}
                onClick={handleReset}>
                ↺ Reset Turn
              </button>
              <button className="btn btn-red"
                disabled={boardChanged}
                onClick={handleDraw}>
                {state.pool.length === 0 ? 'Pass Turn' : 'Draw & Pass'}
              </button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="sidebar">
          <div className="panel">
            <div className="panel-lbl">Pool</div>
            <div className="pool-big">
              <div className="pool-num">{state?.pool?.length ?? 0}</div>
              <div className="pool-sub">{state?.pool?.length === 0 ? 'EMPTY — FINAL ROUND' : 'tiles remaining'}</div>
            </div>
          </div>

          <div className="panel log-panel">
            <div className="panel-lbl">Game Log</div>
            <div className="log-scroll" ref={logRef}>
              {state?.log?.slice(-40).map((e, i) => (
                <div key={i} className={`log-e${e.includes('Final round') || e.includes('final') ? ' final' : ''}`}>{e}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Hand area */}
      {state && (
        <div className="hand-area">
          <div className="hand-top">
            <div className="hand-name">
              {isHumanTurn ? 'Your Hand' : `${cur?.name}'s Hand`}
            </div>
            <div className="hand-meta">
              {displayHand.length} tiles &nbsp;·&nbsp;
              Value: <strong>{handValue(displayHand)} pts</strong>
              {!state.hasInitialMeld[state.currentPlayer] && (
                <span style={{marginLeft:8,color:'var(--gold)'}}>· Initial meld ≥30 pts needed</span>
              )}
            </div>

            {isHumanTurn && (
              <div className="sort-btns">
                <button className={`sort-btn${sortMode==='color'?' act':''}`} onClick={() => handleSort('color')}>🎨 Colour</button>
                <button className={`sort-btn${sortMode==='number'?' act':''}`} onClick={() => handleSort('number')}>🔢 Number</button>
              </div>
            )}
          </div>

          <div className="hand-layout">
            {/* Suggested playable sets — shown above with gap */}
            {isHumanTurn && (
              <SuggestionStrip
                hand={handForSuggestions}
                usedIds={placedIds}
                onPlaySet={handlePlaySuggestion}
              />
            )}

            {/* Divider */}
            {isHumanTurn && <div className="hand-divider" />}

            {/* Tile rack */}
            <div className="hand-rack">
              {displayHand.map(tile => (
                <Tile
                  key={tile.id}
                  tile={tile}
                  selected={isHumanTurn && selectedIds.has(tile.id)}
                  onClick={() => handleTileClick(tile)}
                />
              ))}
            </div>

            {isHumanTurn && selectedIds.size > 0 && (
              <div className="sel-info">
                {selectedIds.size} selected · {selValue} pts
                <button className="btn btn-sm" onClick={() => setSelectedIds(new Set())}>Clear</button>
              </div>
            )}
            {isHumanTurn && (
              <div className="hand-hint">
                Click tiles to select · Click a <em>Ready set</em> above to place it instantly · Confirm when board is valid
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
