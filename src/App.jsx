import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { AI_STRATEGIES, aiPlay, computeHints } from './ai/strategies.js'
import { initGame, drawTile, commitPlay, setSortMode } from './game/engine.js'
import { sortHand, isValidSet, isValidBoard, handValue, tileValue, suggestPlayableSets, COLOR_HEX, COLOR_NAME } from './game/tiles.js'

// ─── Joker SVG ────────────────────────────────────────────────────────────────
function JokerStar({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <defs>
        <radialGradient id="jg2"><stop offset="0%" stopColor="#ffe066"/><stop offset="100%" stopColor="#cc9900"/></radialGradient>
      </defs>
      <polygon points="50,5 61,35 93,35 68,57 78,90 50,70 22,90 32,57 7,35 39,35" fill="url(#jg2)" stroke="#aa7700" strokeWidth="1.5"/>
      <circle cx="50" cy="50" r="14" fill="#fff8d0" stroke="#cc9900" strokeWidth="1.5"/>
      <text x="50" y="57" textAnchor="middle" fontSize="16" fontWeight="900" fontFamily="serif" fill="#8b6914">J</text>
    </svg>
  )
}

// ─── Tile ─────────────────────────────────────────────────────────────────────
function Tile({ tile, selected, onClick, inBoard, small }) {
  if (!tile) return null
  const s = small || inBoard
  const cls = ['tile', tile.isJoker ? 'joker' : tile.color, selected ? 'sel' : '', inBoard ? 'in-board' : ''].filter(Boolean).join(' ')
  if (tile.isJoker) return (
    <div className={cls} onClick={onClick} title="Joker">
      <div className="joker-star"><JokerStar size={s ? 18 : 28}/></div>
      {!s && <div className="joker-lbl">JOKER</div>}
    </div>
  )
  return (
    <div className={cls} onClick={onClick} title={`${COLOR_NAME[tile.color]} ${tile.num}`}>
      {!inBoard && <span className="t-corner tl">{tile.num}</span>}
      <span className="t-num">{tile.num}</span>
      {!inBoard && <span className="t-corner br">{tile.num}</span>}
    </div>
  )
}

function BoardSet({ tiles, valid }) {
  const type = valid ? (tiles.filter(t => !t.isJoker).every((t,_,a) => t.num === a[0].num) ? 'GROUP' : 'RUN') : '⚠'
  return (
    <div className={`bset ${valid ? 'ok' : 'inv'}`}>
      <div className="bset-type">{type}</div>
      {tiles.map(t => <Tile key={t.id} tile={t} inBoard/>)}
    </div>
  )
}

// ─── Mini bar chart ────────────────────────────────────────────────────────────
function BarChart({ data, labels, colors, title, unit = '' }) {
  const max = Math.max(...data.map(Math.abs), 1)
  return (
    <div className="chart-block">
      {title && <div className="chart-title">{title}</div>}
      <div className="bar-chart">
        {data.map((v, i) => (
          <div key={i} className="bar-col">
            <div className="bar-val">{v > 0 ? '+' : ''}{v}{unit}</div>
            <div className="bar-wrap">
              <div className="bar" style={{
                height: `${Math.abs(v) / max * 100}%`,
                background: colors[i],
                opacity: v < 0 ? 0.5 : 1,
              }}/>
            </div>
            <div className="bar-lbl" style={{color: colors[i]}}>{labels[i]}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Line sparkline (score over turns) ───────────────────────────────────────
function Sparkline({ history, colors, labels, width = 300, height = 80 }) {
  if (!history || history.length < 2) return null
  const n = history[0].length
  const allVals = history.flat()
  const mn = Math.min(...allVals), mx = Math.max(...allVals, 1)
  const range = mx - mn || 1

  const px = (i) => (i / (history.length - 1)) * width
  const py = (v) => height - ((v - mn) / range) * (height - 10) - 5

  return (
    <div className="chart-block">
      <div className="chart-title">Score progression</div>
      <svg width={width} height={height} style={{display:'block',overflow:'visible'}}>
        {Array.from({length: n}, (_, pi) => {
          const pts = history.map((snap, ti) => `${px(ti)},${py(snap[pi] ?? 0)}`).join(' ')
          return <polyline key={pi} points={pts} fill="none" stroke={colors[pi]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85"/>
        })}
        {/* Legend */}
        {labels.map((l, i) => (
          <g key={i}>
            <rect x={4 + i * 80} y={height - 14} width={10} height={4} fill={colors[i]} rx="2"/>
            <text x={18 + i * 80} y={height - 8} fontSize="9" fill={colors[i]}>{l}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

// ─── Simulation Stats Dashboard ───────────────────────────────────────────────
function SimDashboard({ result, players, onNewSim, onBack }) {
  if (!result) return null
  const { stats, scores, winner, hands, log } = result
  const pnames = players.map(p => p.name)
  const colors = ['#d63031','#0984e3','#00b894','#e17055']

  return (
    <div className="sim-dashboard">
      <div className="sim-header">
        <div className="sim-title">🎮 Simulation Complete</div>
        <div className="sim-winner">🏆 {pnames[winner]} wins!</div>
        <div className="sim-sub">{stats.turns} turns · {stats.tilesDrawn.reduce((a,b)=>a+b,0)} tiles drawn total</div>
      </div>

      <div className="sim-grid">
        {/* Score chart */}
        <BarChart title="Final Scores" data={scores} labels={pnames} colors={colors} unit=" pts" />

        {/* Tiles drawn per player */}
        <BarChart title="Tiles Drawn" data={stats.tilesDrawn} labels={pnames} colors={colors} />

        {/* Tiles played */}
        <BarChart title="Tiles Played" data={stats.tilesPlayed} labels={pnames} colors={colors} />

        {/* Sets played */}
        <BarChart title="Sets Placed" data={stats.setsPlayed} labels={pnames} colors={colors} />

        {/* Turns per player */}
        <BarChart title="Turns Taken" data={stats.turnsPerPlayer} labels={pnames} colors={colors} />

        {/* Tiles left */}
        <BarChart title="Tiles Remaining" data={hands.map(h=>h.length)} labels={pnames} colors={colors} />
      </div>

      {/* Score progression sparkline */}
      <div className="sim-sparkline">
        <Sparkline history={stats.scoreHistory} colors={colors} labels={pnames} width={560} height={100}/>
      </div>

      {/* Game summary stats table */}
      <div className="sim-table-wrap">
        <table className="sim-table">
          <thead><tr><th>Player</th><th>Strategy</th><th>Score</th><th>Tiles Left</th><th>Tiles Played</th><th>Sets Placed</th><th>Draws</th></tr></thead>
          <tbody>
            {players.map((p,i) => (
              <tr key={i} className={i === winner ? 'winner-row' : ''}>
                <td>{i===winner?'🏆 ':''}{p.name}</td>
                <td>{p.type==='ai' ? `${AI_STRATEGIES[p.strategy]?.emoji} ${AI_STRATEGIES[p.strategy]?.name}` : '👤 Human'}</td>
                <td style={{color: scores[i]>=0?'var(--green)':'var(--red)',fontWeight:700}}>{scores[i]>0?'+':''}{scores[i]}</td>
                <td>{hands[i].length}</td>
                <td>{stats.tilesPlayed[i]}</td>
                <td>{stats.setsPlayed[i]}</td>
                <td>{stats.drawsPerPlayer[i]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Game log accordion */}
      <details className="sim-log-wrap">
        <summary className="sim-log-toggle">View full game log ({log.length} events)</summary>
        <div className="sim-log">
          {log.map((e, i) => <div key={i} className="sim-log-e">{e}</div>)}
        </div>
      </details>

      <div className="sim-actions">
        <button className="btn btn-primary" onClick={onNewSim}>Run Again</button>
        <button className="btn" onClick={onBack}>← Back to Setup</button>
      </div>
    </div>
  )
}

// ─── AI Turn screen (blurred / hidden for 1-human games) ─────────────────────
function AITurnScreen({ player, onReveal }) {
  return (
    <div className="ai-turn-screen">
      <div className="ai-turn-card">
        <div className="ai-turn-icon">🤖</div>
        <div className="ai-turn-name">{player?.name}'s Turn</div>
        <div className="ai-turn-sub">{AI_STRATEGIES[player?.strategy]?.emoji} {AI_STRATEGIES[player?.strategy]?.fullName}</div>
        <div className="ai-turn-thinking">
          <span className="dot"/><span className="dot"/><span className="dot"/>
        </div>
        <div className="ai-turn-hint">Pass the device when done</div>
      </div>
    </div>
  )
}

// ─── Hint panel ───────────────────────────────────────────────────────────────
function HintPanel({ hand, board, hasMeld, onPlaySuggestion }) {
  const [open, setOpen] = useState(true)
  const hints = useMemo(() => computeHints(hand, board, hasMeld), [hand.map(t=>t.id).join(), board.length, hasMeld])

  const iconMap = { initial:'🎯', 'no-meld':'❌', play:'✅', extend:'🔗', stuck:'⚠️', draw:'🃏', rearrange:'🔄' }

  return (
    <div className="hint-panel">
      <div className="hint-hdr">
        <span>💡 Hints & Smart Moves</span>
        <button className="hint-toggle" onClick={() => setOpen(o => !o)}>{open ? '▲' : '▼'}</button>
      </div>
      {open && (
        <div className="hint-body">
          {hints.length === 0 && <div className="hint-empty">Analysing your hand…</div>}
          {hints.map((h, i) => (
            <div key={i} className={`hint-item ${h.type} ${h.isSmartHint ? 'smart' : ''}`}>
              <div className="hint-item-hdr">
                <span className="hint-ico">{iconMap[h.type] || '•'}</span>
                <strong>{h.title}</strong>
              </div>
              <div className="hint-desc">{h.desc}</div>
              {h.sets && h.sets.length > 0 && (
                <div className="hint-sets">
                  {h.sets.map((set, si) => (
                    <div key={si} className="hint-set" onClick={() => onPlaySuggestion(set)} title="Click to play">
                      {set.map(t => <Tile key={t.id} tile={t} inBoard small/>)}
                      <span className="hint-set-val">{handValue(set)}pts ▶</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Multiplayer join link panel ─────────────────────────────────────────────
function MultiplayerPanel({ players, currentPlayerIdx, gameId }) {
  const baseUrl = window.location.origin + window.location.pathname
  const [copied, setCopied] = useState(null)

  const copy = (url, idx) => {
    navigator.clipboard.writeText(url).catch(() => {})
    setCopied(idx)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="mp-panel">
      <div className="mp-title">🔗 Multiplayer Links</div>
      <div className="mp-sub">Share each link with the respective player — they can only see their own hand</div>
      {players.filter(p => p.type === 'human').map((p, i) => {
        const pi = players.indexOf(p)
        const url = `${baseUrl}?game=${gameId}&player=${pi}`
        const isCurrent = pi === currentPlayerIdx
        return (
          <div key={i} className={`mp-player-row ${isCurrent ? 'cur' : ''}`}>
            <div className="mp-player-name">{p.name} {isCurrent ? '← current turn' : ''}</div>
            <div className="mp-url-row">
              <input className="mp-url" readOnly value={url} onClick={e => e.target.select()}/>
              <button className="btn btn-sm" onClick={() => copy(url, pi)}>
                {copied === pi ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )
      })}
      <div className="mp-note">Each link shows only that player's tiles. Others see tile counts only.</div>
    </div>
  )
}

// ─── Setup screen ─────────────────────────────────────────────────────────────
function SetupScreen({ onStart, onSimulate }) {
  const [count, setCount] = useState(4)
  const [simMode, setSimMode] = useState(false)
  const [simRuns, setSimRuns] = useState(1)
  const [players, setPlayers] = useState([
    { name: 'Player 1', type: 'human', strategy: 'balanced' },
    { name: 'Attacker',  type: 'ai',   strategy: 'aggressive' },
    { name: 'Defender',  type: 'ai',   strategy: 'defensive' },
    { name: 'Speedster', type: 'ai',   strategy: 'speed' },
  ])

  const upd = (i, f, v) => setPlayers(prev => prev.map((p, j) => j === i ? { ...p, [f]: v } : p))
  const stratKeys = Object.keys(AI_STRATEGIES)
  const activePlayers = players.slice(0, count)
  const hasHuman = activePlayers.some(p => p.type === 'human')
  const allAI = !hasHuman

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-logo">Rummi<em>kub</em></div>
        <div className="setup-tag">The Classic Tile-Rummy Game</div>

        <div className="setup-sec">
          <div className="setup-lbl">Players</div>
          <div className="p-count">
            {[2,3,4].map(n => <button key={n} className={`p-count-btn${count===n?' act':''}`} onClick={()=>setCount(n)}>{n} Players</button>)}
          </div>
          <div className="player-rows">
            {activePlayers.map((p, i) => (
              <div key={i} className="player-row">
                <div className="p-num">{i+1}</div>
                <input className="p-name-input" value={p.name} maxLength={14} onChange={e=>upd(i,'name',e.target.value)} placeholder={`Player ${i+1}`}/>
                <div className="type-tog">
                  <button className={`type-btn${p.type==='human'?' act':''}`} onClick={()=>upd(i,'type','human')}>👤</button>
                  <button className={`type-btn${p.type==='ai'?' act':''}`} onClick={()=>upd(i,'type','ai')}>🤖</button>
                </div>
                {p.type === 'ai' && (
                  <select className="strat-sel" value={p.strategy} onChange={e=>upd(i,'strategy',e.target.value)}>
                    {stratKeys.map(k=><option key={k} value={k}>{AI_STRATEGIES[k].emoji} {AI_STRATEGIES[k].name}</option>)}
                  </select>
                )}
              </div>
            ))}
          </div>
        </div>

        {allAI && (
          <div className="setup-sec sim-option">
            <div className="setup-lbl">Simulation Mode (All AI)</div>
            <div className="sim-toggle-row">
              <label className="sim-check">
                <input type="checkbox" checked={simMode} onChange={e=>setSimMode(e.target.checked)}/>
                <span>Skip animation — instant results with full statistics</span>
              </label>
            </div>
            {simMode && (
              <div className="sim-runs-row">
                <span style={{fontSize:'.75rem'}}>Simulations:</span>
                {[1,5,10,50].map(n=><button key={n} className={`p-count-btn${simRuns===n?' act':''}`} onClick={()=>setSimRuns(n)}>{n}×</button>)}
              </div>
            )}
          </div>
        )}

        <div className="setup-sec">
          <div className="setup-lbl">AI Strategies</div>
          <div className="strat-grid">
            {stratKeys.map(k=>(
              <div key={k} className="strat-c">
                <div className="strat-h">{AI_STRATEGIES[k].emoji} {AI_STRATEGIES[k].fullName}</div>
                <div className="strat-d">{AI_STRATEGIES[k].description}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{fontSize:'.67rem',color:'var(--ink2)',lineHeight:1.6,marginBottom:16}}>
          🃏 Deal 14 tiles · First meld ≥30 pts from hand · Groups (3-4 same num, diff colour) or Runs (3+ same colour consecutive) · Pool empty → one final turn each
        </div>

        {allAI && simMode
          ? <button className="btn btn-primary" style={{width:'100%',padding:'12px'}} onClick={()=>onSimulate(activePlayers, simRuns)}>
              ▶ Run {simRuns} Simulation{simRuns>1?'s':''}
            </button>
          : <button className="btn btn-primary" style={{width:'100%',padding:'12px'}} onClick={()=>onStart(activePlayers)}>
              Start Game →
            </button>
        }
      </div>
    </div>
  )
}

// ─── Win overlay ──────────────────────────────────────────────────────────────
function WinOverlay({ state, onNewGame }) {
  const { winner, players, scores, hands } = state
  return (
    <div className="overlay">
      <div className="win-card">
        <div className="win-icon">🏆</div>
        <div className="win-title">{players[winner]?.name} Wins!</div>
        <div className="win-sub">{players[winner]?.type==='ai'?`${AI_STRATEGIES[players[winner].strategy]?.fullName} AI dominates.`:'Brilliant play!'}</div>
        <div className="win-scores">
          {players.map((p,i)=>(
            <div key={i} className={`ws${i===winner?' winner':''}`}>
              <div className="ws-name">{p.name}</div>
              <div className="ws-val">{scores[i]>0?'+':''}{scores[i]}</div>
              <div className="ws-hand">{hands[i].length} left</div>
            </div>
          ))}
        </div>
        <button className="btn btn-primary" onClick={onNewGame} style={{padding:'10px 32px'}}>Play Again</button>
      </div>
    </div>
  )
}

// ─── Run simulation synchronously ─────────────────────────────────────────────
function runSim(players) {
  let state = initGame(players, true)
  let maxTurns = 500 // safety
  while (state.phase === 'play' && maxTurns-- > 0) {
    const p = state.currentPlayer
    if (state.players[p].type === 'ai') {
      const result = aiPlay(state, p)
      if (result) {
        state = commitPlay(state, result.newBoard, result.newHand, p)
        if (state.error) state = drawTile(state, p) // fallback
      } else {
        state = drawTile(state, p)
      }
    } else {
      // Human in sim — treat as balanced AI
      const fakePlayers = state.players.map((pl, i) => i===p ? {...pl, type:'ai', strategy:'balanced'} : pl)
      const fakeState = {...state, players: fakePlayers}
      const result = aiPlay(fakeState, p)
      if (result) state = commitPlay(state, result.newBoard, result.newHand, p)
      else state = drawTile(state, p)
    }
  }
  if (state.phase !== 'finished') {
    // Force end if safety limit
    let winner = 0
    let minVal = Infinity
    state.hands.forEach((h, i) => { const v = handValue(h); if (v < minVal) { minVal = v; winner = i } })
    const scores = state.hands.map((h,i) => i===winner ? state.hands.reduce((s,hh,j)=>j!==i?s+handValue(hh):s,0) : -handValue(h))
    state = {...state, phase:'finished', winner, scores}
  }
  return state
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState('setup')
  const [state, setState] = useState(null)
  const [simResults, setSimResults] = useState(null)
  const [simPlayers, setSimPlayers] = useState(null)
  const [pendingBoard, setPendingBoard] = useState(null)
  const [pendingHand, setPendingHand] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [error, setError] = useState(null)
  const [showAITurn, setShowAITurn] = useState(false)
  const [showMultiplayer, setShowMultiplayer] = useState(false)
  const logRef = useRef(null)
  const gameId = useRef(Math.random().toString(36).slice(2, 8))

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [state?.log])

  const startGame = useCallback((players) => {
    const g = initGame(players)
    setState(g)
    setPendingBoard(null); setPendingHand(null); setSelectedIds(new Set()); setError(null)
    setShowAITurn(false)
    setScreen('game')
  }, [])

  const handleSimulate = useCallback((players, runs) => {
    // Run simulation(s) synchronously
    const results = []
    for (let i = 0; i < runs; i++) results.push(runSim(players))
    // If multiple runs, aggregate
    if (runs === 1) {
      setSimResults(results[0])
      setSimPlayers(players)
    } else {
      // Aggregate stats across runs
      const agg = results[0] // use last for board/hands
      const aggStats = {
        turns: Math.round(results.reduce((s, r) => s + r.stats.turns, 0) / runs),
        tilesDrawn: players.map((_, i) => Math.round(results.reduce((s, r) => s + r.stats.tilesDrawn[i], 0) / runs)),
        tilesPlayed: players.map((_, i) => Math.round(results.reduce((s, r) => s + r.stats.tilesPlayed[i], 0) / runs)),
        setsPlayed: players.map((_, i) => Math.round(results.reduce((s, r) => s + r.stats.setsPlayed[i], 0) / runs)),
        turnsPerPlayer: players.map((_, i) => Math.round(results.reduce((s, r) => s + r.stats.turnsPerPlayer[i], 0) / runs)),
        drawsPerPlayer: players.map((_, i) => Math.round(results.reduce((s, r) => s + r.stats.drawsPerPlayer[i], 0) / runs)),
        scoreHistory: agg.stats.scoreHistory,
        wins: players.map((_, i) => results.filter(r => r.winner === i).length),
      }
      const avgScores = players.map((_, i) => Math.round(results.reduce((s, r) => s + r.scores[i], 0) / runs))
      setSimResults({ ...agg, scores: avgScores, stats: aggStats, multiRun: runs })
      setSimPlayers(players)
    }
    setScreen('sim')
  }, [])

  // Determine if we have exactly 1 human player
  const humanCount = state ? state.players.filter(p => p.type === 'human').length : 0
  const oneHuman = humanCount === 1
  const isHumanTurn = state?.phase === 'play' && state.players[state.currentPlayer]?.type === 'human'
  const isAITurn = state?.phase === 'play' && state.players[state.currentPlayer]?.type === 'ai'

  // AI auto-play — fast, no delay for all-AI, small delay for mixed
  useEffect(() => {
    if (!state || state.phase !== 'play') return
    const cur = state.players[state.currentPlayer]
    if (cur?.type !== 'ai') return

    // In 1-human mode, show AI turn blocker briefly then auto-play
    const delay = oneHuman ? 800 : 50
    const t = setTimeout(() => {
      setState(prev => {
        if (!prev || prev.players[prev.currentPlayer]?.type !== 'ai') return prev
        const result = aiPlay(prev, prev.currentPlayer)
        if (result) {
          const next = commitPlay(prev, result.newBoard, result.newHand, prev.currentPlayer)
          return next.error ? drawTile(prev, prev.currentPlayer) : next
        }
        return drawTile(prev, prev.currentPlayer)
      })
      setShowAITurn(false)
    }, delay)

    if (oneHuman && isAITurn) setShowAITurn(true)
    return () => clearTimeout(t)
  }, [state?.currentPlayer, state?.phase, oneHuman])

  // Init human pending state
  useEffect(() => {
    if (!state || state.phase !== 'play') return
    const cur = state.players[state.currentPlayer]
    if (cur?.type !== 'human') return
    setShowAITurn(false)
    const mode = state.sortMode[state.currentPlayer] || 'color'
    setPendingBoard(state.board.map(s => [...s]))
    setPendingHand(sortHand([...state.hands[state.currentPlayer]], mode))
    setSelectedIds(new Set())
    setError(null)
  }, [state?.currentPlayer, state?.phase])

  const handleSort = (mode) => {
    if (!state) return
    setState(prev => setSortMode(prev, prev.currentPlayer, mode))
    setPendingHand(sortHand(pendingHand || [], mode))
  }

  const handleTileClick = (tile) => {
    if (!isHumanTurn) return
    setError(null)
    setSelectedIds(prev => { const n = new Set(prev); n.has(tile.id) ? n.delete(tile.id) : n.add(tile.id); return n })
  }

  const handlePlaceSelected = () => {
    const tiles = (pendingHand || []).filter(t => selectedIds.has(t.id))
    if (tiles.length < 3) { setError('Select at least 3 tiles to form a set.'); return }
    if (!isValidSet(tiles)) { setError("Selected tiles don't form a valid set."); return }
    const ids = new Set(tiles.map(t => t.id))
    const newHand = sortHand((pendingHand || []).filter(t => !ids.has(t.id)), state.sortMode[state.currentPlayer])
    setPendingHand(newHand); setPendingBoard(prev => [...(prev || []), tiles])
    setSelectedIds(new Set()); setError(null)
  }

  const handlePlaySuggestion = (set) => {
    const ids = new Set(set.map(t => t.id))
    const newHand = sortHand((pendingHand || []).filter(t => !ids.has(t.id)), state.sortMode[state.currentPlayer])
    setPendingHand(newHand); setPendingBoard(prev => [...(prev || []), set])
    setSelectedIds(new Set()); setError(null)
  }

  const handleReset = () => {
    const mode = state.sortMode[state.currentPlayer] || 'color'
    setPendingBoard(state.board.map(s => [...s]))
    setPendingHand(sortHand([...state.hands[state.currentPlayer]], mode))
    setSelectedIds(new Set()); setError(null)
  }

  const handleConfirm = () => {
    const result = commitPlay(state, pendingBoard, pendingHand, state.currentPlayer)
    if (result.error) { setError(result.error); return }
    setState(result); setError(null)
  }

  const handleDraw = () => { setState(prev => drawTile(prev, prev.currentPlayer)); setError(null) }

  if (screen === 'setup') return <SetupScreen onStart={startGame} onSimulate={handleSimulate} />
  if (screen === 'sim') return (
    <SimDashboard result={simResults} players={simPlayers}
      onNewSim={() => handleSimulate(simPlayers, simResults?.multiRun || 1)}
      onBack={() => setScreen('setup')} />
  )

  const cur = state?.players[state?.currentPlayer]
  const board = pendingBoard || state?.board || []
  const displayHand = isHumanTurn ? (pendingHand || []) : (state?.hands[state?.currentPlayer] || [])
  const boardChanged = isHumanTurn && pendingBoard && JSON.stringify(pendingBoard) !== JSON.stringify(state.board)
  const boardValid = isValidBoard(board)
  const sortMode = state?.sortMode[state?.currentPlayer] || 'color'
  const pendingBoardIds = new Set((pendingBoard || []).flat().map(t => t.id))
  const origHandIds = new Set((state?.hands[state?.currentPlayer] || []).map(t => t.id))
  const placedIds = new Set([...pendingBoardIds].filter(id => origHandIds.has(id)))
  const handForSuggestions = (pendingHand || []).filter(t => !placedIds.has(t.id))
  const selectedTiles = displayHand.filter(t => selectedIds.has(t.id))
  const selVal = selectedTiles.reduce((s, t) => s + tileValue(t), 0)

  return (
    <div className="app">
      {state?.phase === 'finished' && <WinOverlay state={state} onNewGame={() => setScreen('setup')} />}
      {showAITurn && oneHuman && <AITurnScreen player={cur} />}

      {/* Header */}
      <div className="hdr">
        <div className="hdr-title">Rummi<em>kub</em></div>
        <div className="hdr-right">
          {humanCount >= 2 && (
            <button className="btn btn-sm" onClick={() => setShowMultiplayer(m => !m)}>🔗 Links</button>
          )}
          <button className="btn btn-sm" onClick={() => setScreen('setup')}>⚙ New</button>
        </div>
      </div>

      {showMultiplayer && humanCount >= 2 && (
        <MultiplayerPanel players={state.players} currentPlayerIdx={state.currentPlayer} gameId={gameId.current} />
      )}

      {/* Scores */}
      <div className="scores">
        {state?.players.map((p, i) => (
          <div key={i} className={`sc${i===state.currentPlayer?' cur':''}`}>
            <div className="sc-top">
              <div className="sc-name">{p.name}</div>
              <div className="sc-badge">{p.type==='ai'?`${AI_STRATEGIES[p.strategy]?.emoji} AI`:'👤'}</div>
            </div>
            <div className="sc-sub">
              <span>{state.hands[i]?.length} tiles</span>
              {state.hasInitialMeld[i] && <span className="meld-check">✓</span>}
              {state.finalRound && <span style={{color:'var(--red)'}}>FINAL</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Main */}
      <div className="main">
        <div className="board-wrap">
          <div className="board-bar">
            <div className="board-lbl">Board · {board.flat().length} tiles, {board.length} sets
              {boardChanged && (boardValid?<span style={{color:'var(--green)',marginLeft:8}}>✓ valid</span>:<span style={{color:'var(--red)',marginLeft:8}}>✗ invalid</span>)}
            </div>
          </div>
          <div className={`board${boardChanged?(boardValid?' valid':' invalid'):''}`}>
            {board.length===0?<div className="board-empty"><div className="board-empty-icon">🀱</div><div>Board is empty</div></div>
              :<div className="board-sets">{board.map((set,si)=><BoardSet key={si} tiles={set} valid={isValidSet(set)}/>)}</div>}
          </div>
          {error && <div className="banner b-err">⚠ {error}</div>}
          {state?.finalRound && !error && <div className="banner b-warn">⏰ Final round!</div>}
          {isHumanTurn && (
            <div className="actions">
              <button className="btn btn-primary" disabled={selectedIds.size<3} onClick={handlePlaceSelected}>Place ({selectedIds.size})</button>
              <button className="btn btn-green" disabled={!boardChanged||!boardValid} onClick={handleConfirm}>✓ Confirm</button>
              <button className="btn" disabled={!boardChanged} onClick={handleReset}>↺ Reset</button>
              <button className="btn btn-red" disabled={boardChanged} onClick={handleDraw}>{state.pool.length===0?'Pass':'Draw & Pass'}</button>
            </div>
          )}
          {/* Hints — only for human turn */}
          {isHumanTurn && (
            <HintPanel hand={handForSuggestions} board={state.board} hasMeld={state.hasInitialMeld[state.currentPlayer]} onPlaySuggestion={handlePlaySuggestion}/>
          )}
        </div>

        <div className="sidebar">
          <div className="panel">
            <div className="panel-lbl">Pool</div>
            <div className="pool-big"><div className="pool-num">{state?.pool?.length??0}</div><div className="pool-sub">{state?.pool?.length===0?'EMPTY':' tiles'}</div></div>
          </div>
          <div className="panel log-panel">
            <div className="panel-lbl">Game Log</div>
            <div className="log-scroll" ref={logRef}>
              {state?.log?.slice(-40).map((e,i)=><div key={i} className={`log-e${e.includes('Final')||e.includes('🏆')?' final':''}`}>{e}</div>)}
            </div>
          </div>
        </div>
      </div>

      {/* Hand — hidden during AI turn in 1-human mode */}
      {state && !showAITurn && (
        <div className="hand-area">
          <div className="hand-top">
            <div className="hand-name">{isHumanTurn?'Your Hand':`${cur?.name}'s Hand`}</div>
            <div className="hand-meta">
              {displayHand.length} tiles · <strong>{handValue(displayHand)} pts</strong>
              {!state.hasInitialMeld[state.currentPlayer]&&<span style={{color:'var(--gold)',marginLeft:8}}>· Need ≥30 initial</span>}
            </div>
            {isHumanTurn && (
              <div className="sort-btns">
                <button className={`sort-btn${sortMode==='color'?' act':''}`} onClick={()=>handleSort('color')}>🎨</button>
                <button className={`sort-btn${sortMode==='number'?' act':''}`} onClick={()=>handleSort('number')}>🔢</button>
              </div>
            )}
          </div>
          <div className="hand-layout">
            {isHumanTurn && (
              <div className="suggestions">
                <div className="sugg-lbl">READY</div>
                <div className="sugg-sets">
                  {suggestPlayableSets(handForSuggestions).slice(0,8).map((set,i)=>{
                    const used=set.some(t=>placedIds.has(t.id))
                    return (
                      <div key={i} className={`sugg-set${used?' used':''}`} onClick={()=>!used&&handlePlaySuggestion(set)}>
                        <div className="sugg-val">{handValue(set)}pts</div>
                        {set.map(t=><Tile key={t.id} tile={t} inBoard/>)}
                      </div>
                    )
                  })}
                  {suggestPlayableSets(handForSuggestions).length===0&&<div className="sugg-empty">No playable sets yet</div>}
                </div>
              </div>
            )}
            {isHumanTurn && <div className="hand-divider"/>}
            <div className="hand-rack">
              {displayHand.map(tile=>(
                <Tile key={tile.id} tile={tile} selected={isHumanTurn&&selectedIds.has(tile.id)} onClick={()=>handleTileClick(tile)}/>
              ))}
            </div>
            {isHumanTurn&&selectedIds.size>0&&(
              <div className="sel-info">{selectedIds.size} selected · {selVal} pts
                <button className="btn btn-sm" onClick={()=>setSelectedIds(new Set())}>Clear</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
