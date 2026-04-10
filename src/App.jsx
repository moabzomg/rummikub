import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { AI_STRATEGIES, aiPlay, computeHints } from './ai/strategies.js'
import { initGame, drawTile, commitPlay, setSortMode } from './game/engine.js'
import {
  sortHand, sortSet, isValidSet, isValidBoard, handValue, tileValue,
  suggestPlayableSets, findDropTargets, findBestInsert,
  COLOR_HEX, COLOR_LIGHT, COLOR_NAME, COLORS
} from './game/tiles.js'

// ─── Joker SVG ────────────────────────────────────────────────────────────────
function JokerStar({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <defs>
        <radialGradient id="jg2">
          <stop offset="0%" stopColor="#ffe066"/>
          <stop offset="100%" stopColor="#cc9900"/>
        </radialGradient>
      </defs>
      <polygon points="50,5 61,35 93,35 68,57 78,90 50,70 22,90 32,57 7,35 39,35"
        fill="url(#jg2)" stroke="#aa7700" strokeWidth="1.5"/>
      <circle cx="50" cy="50" r="14" fill="#fff8d0" stroke="#cc9900" strokeWidth="1.5"/>
      <text x="50" y="57" textAnchor="middle" fontSize="16" fontWeight="900" fontFamily="serif" fill="#8b6914">J</text>
    </svg>
  )
}

// ─── Tile ─────────────────────────────────────────────────────────────────────
function Tile({
  tile, selected, onClick, inBoard, small,
  draggable, onDragStart, onDragEnd,
  dropHighlight, dropLabel,
  dimmed, ghost,
}) {
  if (!tile) return null
  const s = small || inBoard
  const cls = [
    'tile',
    tile.isJoker ? 'joker' : tile.color,
    selected   ? 'sel'       : '',
    inBoard    ? 'in-board'  : '',
    dimmed     ? 'dimmed'    : '',
    ghost      ? 'ghost'     : '',
    dropHighlight ? 'drop-hi' : '',
  ].filter(Boolean).join(' ')

  if (tile.isJoker) return (
    <div className={cls} onClick={onClick}
      draggable={draggable} onDragStart={onDragStart} onDragEnd={onDragEnd}
      title="Joker — wild card">
      <div className="joker-star"><JokerStar size={s ? 18 : 24}/></div>
      {!s && <div className="joker-lbl">JOKER</div>}
      {dropHighlight && dropLabel && <div className="drop-label">{dropLabel}</div>}
    </div>
  )
  return (
    <div className={cls} onClick={onClick}
      draggable={draggable} onDragStart={onDragStart} onDragEnd={onDragEnd}
      title={`${COLOR_NAME[tile.color]} ${tile.num}`}>
      {!inBoard && <span className="t-corner tl">{tile.num}</span>}
      <span className="t-num">{tile.num}</span>
      {!inBoard && <span className="t-corner br">{tile.num}</span>}
      {dropHighlight && dropLabel && <div className="drop-label">{dropLabel}</div>}
    </div>
  )
}

// ─── Drop zone indicator ──────────────────────────────────────────────────────
function DropZone({ active, label, onDrop, onDragOver }) {
  return (
    <div
      className={`drop-zone${active ? ' active' : ''}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      {active ? <span className="drop-zone-label">{label || 'Drop here'}</span> : null}
    </div>
  )
}

// ─── Board Set with drag-drop support ────────────────────────────────────────
function BoardSet({ tiles, valid, setIdx, dragState, onDropOnSet, onDragOverSet }) {
  const nj = tiles.filter(t => !t.isJoker)
  const type = valid
    ? (nj.length > 0 && nj.every((t,_,a) => t.num === a[0].num) ? 'GROUP' : 'RUN')
    : '⚠'

  const isHighlighted = dragState?.dropTargets?.some(dt => dt.setIdx === setIdx)

  return (
    <div
      className={`bset ${valid ? 'ok' : 'inv'}${isHighlighted ? ' drop-target' : ''}`}
      onDrop={e => { e.preventDefault(); onDropOnSet(setIdx) }}
      onDragOver={e => { e.preventDefault(); onDragOverSet(setIdx) }}
    >
      <div className="bset-type">{type}</div>
      {isHighlighted && (
        <div className="bset-drop-hint">
          {dragState.dropTargets.filter(dt => dt.setIdx === setIdx).map((dt, i) => (
            <span key={i} className="bset-drop-tag">{dt.label}</span>
          ))}
        </div>
      )}
      {tiles.map(t => (
        <Tile key={t.id} tile={t} inBoard/>
      ))}
    </div>
  )
}

// ─── New Set drop zone (empty board area) ─────────────────────────────────────
function NewSetDropZone({ dragState, onDrop }) {
  const active = dragState?.dragging && dragState?.dropTargets?.length === 0
  return (
    <div
      className={`new-set-drop${active ? ' active' : ''}`}
      onDrop={e => { e.preventDefault(); onDrop() }}
      onDragOver={e => e.preventDefault()}
    >
      {active ? '+ Drop to start new set' : null}
    </div>
  )
}

// ─── Bar chart ────────────────────────────────────────────────────────────────
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
              <div className="bar" style={{ height:`${Math.abs(v)/max*100}%`, background:colors[i], opacity:v<0?0.5:1 }}/>
            </div>
            <div className="bar-lbl" style={{color:colors[i]}}>{labels[i]}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Sparkline({ history, colors, labels, width=300, height=80 }) {
  if (!history || history.length < 2) return null
  const n = history[0].length
  const allVals = history.flat()
  const mn = Math.min(...allVals), mx = Math.max(...allVals, 1)
  const range = mx - mn || 1
  const px = i => (i / (history.length - 1)) * width
  const py = v => height - ((v - mn) / range) * (height - 10) - 5
  return (
    <div className="chart-block">
      <div className="chart-title">Score progression</div>
      <svg width={width} height={height} style={{display:'block',overflow:'visible'}}>
        {Array.from({length:n},(_,pi) => (
          <polyline key={pi}
            points={history.map((snap,ti)=>`${px(ti)},${py(snap[pi]??0)}`).join(' ')}
            fill="none" stroke={colors[pi]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85"/>
        ))}
        {labels.map((l,i)=>(
          <g key={i}>
            <rect x={4+i*80} y={height-14} width={10} height={4} fill={colors[i]} rx="2"/>
            <text x={18+i*80} y={height-8} fontSize="9" fill={colors[i]}>{l}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

// ─── Sim Dashboard ────────────────────────────────────────────────────────────
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
        <div className="sim-sub">{stats.turns} turns · {stats.tilesDrawn.reduce((a,b)=>a+b,0)} tiles drawn total
          {result.multiRun ? ` · Average of ${result.multiRun} games` : ''}
        </div>
      </div>
      <div className="sim-grid">
        <BarChart title="Final Scores"   data={scores}                  labels={pnames} colors={colors} unit=" pts"/>
        <BarChart title="Tiles Drawn"    data={stats.tilesDrawn}        labels={pnames} colors={colors}/>
        <BarChart title="Tiles Played"   data={stats.tilesPlayed}       labels={pnames} colors={colors}/>
        <BarChart title="Sets Placed"    data={stats.setsPlayed}        labels={pnames} colors={colors}/>
        <BarChart title="Turns Taken"    data={stats.turnsPerPlayer}    labels={pnames} colors={colors}/>
        <BarChart title="Tiles Left"     data={hands.map(h=>h.length)} labels={pnames} colors={colors}/>
      </div>
      <div className="sim-sparkline">
        <Sparkline history={stats.scoreHistory} colors={colors} labels={pnames} width={560} height={100}/>
      </div>
      <div className="sim-table-wrap">
        <table className="sim-table">
          <thead><tr><th>Player</th><th>Strategy</th><th>Score</th><th>Left</th><th>Played</th><th>Sets</th><th>Draws</th></tr></thead>
          <tbody>
            {players.map((p,i) => (
              <tr key={i} className={i===winner?'winner-row':''}>
                <td>{i===winner?'🏆 ':''}{p.name}</td>
                <td>{p.type==='ai'?`${AI_STRATEGIES[p.strategy]?.emoji} ${AI_STRATEGIES[p.strategy]?.name}`:'👤 Human'}</td>
                <td style={{color:scores[i]>=0?'var(--green)':'var(--red)',fontWeight:700}}>{scores[i]>0?'+':''}{scores[i]}</td>
                <td>{hands[i].length}</td>
                <td>{stats.tilesPlayed[i]}</td>
                <td>{stats.setsPlayed[i]}</td>
                <td>{stats.drawsPerPlayer[i]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="sim-log-wrap">
        <summary className="sim-log-toggle">Game log ({log.length} events)</summary>
        <div className="sim-log">{log.map((e,i)=><div key={i} className="sim-log-e">{e}</div>)}</div>
      </details>
      <div className="sim-actions">
        <button className="btn btn-primary" onClick={onNewSim}>Run Again</button>
        <button className="btn" onClick={onBack}>← Back</button>
      </div>
    </div>
  )
}

// ─── AI Turn Screen ───────────────────────────────────────────────────────────
function AITurnScreen({ player }) {
  return (
    <div className="ai-turn-screen">
      <div className="ai-turn-card">
        <div className="ai-turn-icon">🤖</div>
        <div className="ai-turn-name">{player?.name}'s Turn</div>
        <div className="ai-turn-sub">{AI_STRATEGIES[player?.strategy]?.emoji} {AI_STRATEGIES[player?.strategy]?.fullName}</div>
        <div className="ai-turn-thinking"><span className="dot"/><span className="dot"/><span className="dot"/></div>
        <div className="ai-turn-hint">Pass the device when done</div>
      </div>
    </div>
  )
}

// ─── Hint panel (with drag-drop awareness) ────────────────────────────────────
function HintPanel({ hand, board, hasMeld, dragState, onPlaySuggestion }) {
  const [open, setOpen] = useState(true)
  const hints = useMemo(() => computeHints(hand, board, hasMeld), [
    hand.map(t=>t.id).join(), board.length, hasMeld
  ])

  // Extra drag hint when dragging
  const dragTile = dragState?.dragTile
  const dragHints = useMemo(() => {
    if (!dragTile || !board) return []
    const targets = findDropTargets(dragTile, board)
    const insert  = findBestInsert(dragTile, board, hand)
    return { targets, insert }
  }, [dragTile?.id, board.length, hand.length])

  const iconMap = { initial:'🎯','no-meld':'❌',play:'✅',extend:'🔗',stuck:'⚠️',draw:'🃏',rearrange:'🔄' }

  return (
    <div className="hint-panel">
      <div className="hint-hdr">
        <span>💡 {dragTile ? `Dragging ${dragTile.isJoker?'Joker':`${COLOR_NAME[dragTile.color]} ${dragTile.num}`}` : 'Hints & Smart Moves'}</span>
        <button className="hint-toggle" onClick={()=>setOpen(o=>!o)}>{open?'▲':'▼'}</button>
      </div>
      {open && (
        <div className="hint-body">
          {/* Drag-specific hints */}
          {dragTile && (
            <div className="hint-item extend">
              <div className="hint-item-hdr"><span className="hint-ico">🎯</span><strong>Drop options for this tile</strong></div>
              {dragHints.targets?.length > 0
                ? <div className="hint-desc">
                    {dragHints.targets.map((t,i)=>(
                      <div key={i} className="drag-hint-row">📍 Set #{t.setIdx+1}: {t.label}</div>
                    ))}
                  </div>
                : <div className="hint-desc" style={{color:'var(--red)'}}>⚠ No existing board set accepts this tile</div>
              }
              {dragHints.insert?.type === 'new-set' && (
                <div className="hint-desc" style={{marginTop:4}}>
                  💡 Can form new set with: {dragHints.insert.sets[0]?.map(t=>t.isJoker?'J':`${t.num}${t.color[0].toUpperCase()}`).join('-')}
                </div>
              )}
              {dragHints.insert?.type === 'none' && dragHints.targets?.length === 0 && (
                <div className="hint-desc" style={{color:'var(--red)',fontWeight:600}}>
                  ❌ This tile cannot be placed anywhere on the board right now
                </div>
              )}
            </div>
          )}

          {!dragTile && (
            <>
              {hints.length === 0 && <div className="hint-empty">Analysing…</div>}
              {hints.map((h,i) => (
                <div key={i} className={`hint-item ${h.type}${h.isSmartHint?' smart':''}`}>
                  <div className="hint-item-hdr">
                    <span className="hint-ico">{iconMap[h.type]||'•'}</span>
                    <strong>{h.title}</strong>
                  </div>
                  <div className="hint-desc">{h.desc}</div>
                  {h.sets?.length > 0 && (
                    <div className="hint-sets">
                      {h.sets.map((set,si) => (
                        <div key={si} className="hint-set" onClick={()=>onPlaySuggestion(set)}>
                          {set.map(t=><Tile key={t.id} tile={t} inBoard small/>)}
                          <span className="hint-set-val">{handValue(set)}pts ▶</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Multiplayer link panel ───────────────────────────────────────────────────
function MultiplayerPanel({ players, currentPlayerIdx, gameId }) {
  const baseUrl = window.location.origin + window.location.pathname
  const [copied, setCopied] = useState(null)
  const copy = (url, idx) => {
    navigator.clipboard.writeText(url).catch(()=>{})
    setCopied(idx); setTimeout(()=>setCopied(null), 2000)
  }
  return (
    <div className="mp-panel">
      <div className="mp-title">🔗 Multiplayer Links</div>
      <div className="mp-sub">Share each link — players only see their own tiles</div>
      {players.filter(p=>p.type==='human').map((p,i) => {
        const pi = players.indexOf(p)
        const url = `${baseUrl}?game=${gameId}&player=${pi}`
        return (
          <div key={i} className={`mp-player-row${pi===currentPlayerIdx?' cur':''}`}>
            <div className="mp-player-name">{p.name}{pi===currentPlayerIdx?' ← current':''}</div>
            <div className="mp-url-row">
              <input className="mp-url" readOnly value={url} onClick={e=>e.target.select()}/>
              <button className="btn btn-sm" onClick={()=>copy(url,pi)}>{copied===pi?'✓':'Copy'}</button>
            </div>
          </div>
        )
      })}
      <div className="mp-note">Other players see tile counts only — not the actual tiles.</div>
    </div>
  )
}

// ─── Setup screen ─────────────────────────────────────────────────────────────
function SetupScreen({ onStart, onSimulate }) {
  const [count, setCount] = useState(4)
  const [simMode, setSimMode] = useState(false)
  const [simRuns, setSimRuns] = useState(1)
  const [players, setPlayers] = useState([
    { name:'Player 1', type:'human',  strategy:'balanced'   },
    { name:'Attacker', type:'ai',     strategy:'aggressive' },
    { name:'Defender', type:'ai',     strategy:'defensive'  },
    { name:'Speedster',type:'ai',     strategy:'speed'      },
  ])
  const upd = (i,f,v) => setPlayers(prev=>prev.map((p,j)=>j===i?{...p,[f]:v}:p))
  const stratKeys = Object.keys(AI_STRATEGIES)
  const active = players.slice(0, count)
  const allAI = !active.some(p=>p.type==='human')

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-logo">Rummi<em>kub</em></div>
        <div className="setup-tag">The Classic Tile-Rummy Game</div>

        <div className="setup-sec">
          <div className="setup-lbl">Players</div>
          <div className="p-count">
            {[2,3,4].map(n=><button key={n} className={`p-count-btn${count===n?' act':''}`} onClick={()=>setCount(n)}>{n}</button>)}
          </div>
          <div className="player-rows">
            {active.map((p,i)=>(
              <div key={i} className="player-row">
                <div className="p-num">{i+1}</div>
                <input className="p-name-input" value={p.name} maxLength={14} onChange={e=>upd(i,'name',e.target.value)} placeholder={`Player ${i+1}`}/>
                <div className="type-tog">
                  <button className={`type-btn${p.type==='human'?' act':''}`} onClick={()=>upd(i,'type','human')}>👤</button>
                  <button className={`type-btn${p.type==='ai'?' act':''}`} onClick={()=>upd(i,'type','ai')}>🤖</button>
                </div>
                {p.type==='ai' && (
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
            <div className="setup-lbl">Simulation Mode</div>
            <label className="sim-check">
              <input type="checkbox" checked={simMode} onChange={e=>setSimMode(e.target.checked)}/>
              <span>Instant results + statistics dashboard</span>
            </label>
            {simMode && (
              <div className="sim-runs-row" style={{marginTop:8}}>
                <span style={{fontSize:'.75rem'}}>Runs:</span>
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

        <div style={{fontSize:'.66rem',color:'var(--ink2)',lineHeight:1.65,marginBottom:16}}>
          🃏 14 tiles each · First meld ≥30 pts · Groups (3–4 same num, diff colour) or Runs (3+ same colour consecutive) · Pool empty → one final turn each · <strong>Drag tiles onto board</strong> or click hints
        </div>

        {allAI && simMode
          ? <button className="btn btn-primary" style={{width:'100%',padding:'12px'}} onClick={()=>onSimulate(active,simRuns)}>▶ Simulate {simRuns}×</button>
          : <button className="btn btn-primary" style={{width:'100%',padding:'12px'}} onClick={()=>onStart(active)}>Start Game →</button>
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

// ─── Run simulation ───────────────────────────────────────────────────────────
function runSim(players) {
  let state = initGame(players, true)
  let safety = 600
  while (state.phase === 'play' && safety-- > 0) {
    const p = state.currentPlayer
    const fakePlayers = state.players.map((pl,i) => i===p&&pl.type==='human' ? {...pl,type:'ai',strategy:'balanced'} : pl)
    const fs = {...state, players:fakePlayers}
    const result = aiPlay(fs, p)
    if (result) {
      const next = commitPlay(state, result.newBoard, result.newHand, p)
      state = next.error ? drawTile(state, p) : next
    } else {
      state = drawTile(state, p)
    }
  }
  if (state.phase !== 'finished') {
    let winner = 0, minVal = Infinity
    state.hands.forEach((h,i)=>{const v=handValue(h);if(v<minVal){minVal=v;winner=i}})
    const scores = state.hands.map((h,i)=>i===winner?state.hands.reduce((s,hh,j)=>j!==i?s+handValue(hh):s,0):-handValue(h))
    state = {...state,phase:'finished',winner,scores}
  }
  return state
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]             = useState('setup')
  const [state, setState]               = useState(null)
  const [simResults, setSimResults]     = useState(null)
  const [simPlayers, setSimPlayers]     = useState(null)
  const [pendingBoard, setPendingBoard] = useState(null)
  const [pendingHand, setPendingHand]   = useState(null)
  const [selectedIds, setSelectedIds]   = useState(new Set())
  const [error, setError]               = useState(null)
  const [showAITurn, setShowAITurn]     = useState(false)
  const [showMP, setShowMP]             = useState(false)
  // Drag state
  const [dragState, setDragState]       = useState(null)
  // { dragging, dragTile, dragSource:'hand'|'board', dragSetIdx, dropTargets }
  const logRef  = useRef(null)
  const gameId  = useRef(Math.random().toString(36).slice(2,8))

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [state?.log])

  const startGame = useCallback(players => {
    setState(initGame(players))
    setPendingBoard(null); setPendingHand(null)
    setSelectedIds(new Set()); setError(null)
    setShowAITurn(false); setDragState(null)
    setScreen('game')
  }, [])

  const handleSimulate = useCallback((players, runs) => {
    const results = Array.from({length:runs}, ()=>runSim(players))
    if (runs === 1) {
      setSimResults(results[0])
    } else {
      const r0 = results[0]
      const avg = arr => Math.round(arr.reduce((s,x)=>s+x,0)/arr.length)
      const agg = {
        turns: avg(results.map(r=>r.stats.turns)),
        tilesDrawn:    players.map((_,i)=>avg(results.map(r=>r.stats.tilesDrawn[i]))),
        tilesPlayed:   players.map((_,i)=>avg(results.map(r=>r.stats.tilesPlayed[i]))),
        setsPlayed:    players.map((_,i)=>avg(results.map(r=>r.stats.setsPlayed[i]))),
        turnsPerPlayer:players.map((_,i)=>avg(results.map(r=>r.stats.turnsPerPlayer[i]))),
        drawsPerPlayer:players.map((_,i)=>avg(results.map(r=>r.stats.drawsPerPlayer[i]))),
        scoreHistory:  r0.stats.scoreHistory,
      }
      setSimResults({...r0, scores:players.map((_,i)=>avg(results.map(r=>r.scores[i]))), stats:agg, multiRun:runs})
    }
    setSimPlayers(players)
    setScreen('sim')
  }, [])

  // ── AI auto-play ──
  const humanCount = state ? state.players.filter(p=>p.type==='human').length : 0
  const oneHuman   = humanCount === 1

  useEffect(() => {
    if (!state || state.phase !== 'play') return
    const cur = state.players[state.currentPlayer]
    if (cur?.type !== 'ai') return
    const delay = oneHuman ? 800 : 40
    if (oneHuman) setShowAITurn(true)
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
    return () => { clearTimeout(t); setShowAITurn(false) }
  }, [state?.currentPlayer, state?.phase, oneHuman])

  // ── Init human pending state ──
  const isHumanTurn = state?.phase==='play' && state.players[state.currentPlayer]?.type==='human'
  useEffect(() => {
    if (!isHumanTurn) return
    setShowAITurn(false)
    const mode = state.sortMode[state.currentPlayer] || 'color'
    setPendingBoard(state.board.map(s=>[...s]))
    setPendingHand(sortHand([...state.hands[state.currentPlayer]], mode))
    setSelectedIds(new Set()); setError(null); setDragState(null)
  }, [state?.currentPlayer, state?.phase])

  // ── Sort ──
  const handleSort = mode => {
    if (!state) return
    setState(prev => setSortMode(prev, prev.currentPlayer, mode))
    setPendingHand(sortHand(pendingHand||[], mode))
  }

  // ── Click tile to select ──
  const handleTileClick = tile => {
    if (!isHumanTurn) return
    setError(null)
    setSelectedIds(prev => { const n=new Set(prev); n.has(tile.id)?n.delete(tile.id):n.add(tile.id); return n })
  }

  // ── Place selected as new set ──
  const handlePlaceSelected = () => {
    const tiles = (pendingHand||[]).filter(t=>selectedIds.has(t.id))
    if (tiles.length < 3) { setError('Select at least 3 tiles.'); return }
    if (!isValidSet(tiles)) { setError("Selected tiles don't form a valid set."); return }
    const ids = new Set(tiles.map(t=>t.id))
    const mode = state.sortMode[state.currentPlayer]
    setPendingHand(sortHand((pendingHand||[]).filter(t=>!ids.has(t.id)), mode))
    setPendingBoard(prev=>[...(prev||[]), sortSet(tiles)])
    setSelectedIds(new Set()); setError(null)
  }

  // ── One-click play suggestion ──
  const handlePlaySuggestion = set => {
    const ids = new Set(set.map(t=>t.id))
    const mode = state.sortMode[state.currentPlayer]
    setPendingHand(sortHand((pendingHand||[]).filter(t=>!ids.has(t.id)), mode))
    setPendingBoard(prev=>[...(prev||[]), sortSet(set)])
    setSelectedIds(new Set()); setError(null)
  }

  // ── One-click insert: best place for a single tile ──
  const handleInsertTile = tile => {
    if (!isHumanTurn) return
    const board = pendingBoard || []
    const hand  = (pendingHand||[]).filter(t=>t.id!==tile.id)
    const best  = findBestInsert(tile, board, pendingHand||[])
    if (best.type === 'extend') {
      const { setIdx, position } = best.target
      const newSet = sortSet(position==='end'
        ? [...board[setIdx], tile]
        : [tile, ...board[setIdx]])
      const mode = state.sortMode[state.currentPlayer]
      setPendingBoard(board.map((s,i)=>i===setIdx?newSet:s))
      setPendingHand(sortHand(hand, mode))
      setError(null)
    } else if (best.type === 'new-set') {
      // Highlight suggestion — user sees hint panel
      setError(`No direct board extension. Check hints for set options.`)
    } else {
      setError(`This tile cannot be placed anywhere on the board right now.`)
    }
  }

  // ── Drag handlers ──
  const handleDragStart = (e, tile, source, setIdx=null) => {
    if (!isHumanTurn) { e.preventDefault(); return }
    const targets = findDropTargets(tile, pendingBoard||[])
    setDragState({ dragging:true, dragTile:tile, dragSource:source, dragSetIdx:setIdx, dropTargets:targets })
    e.dataTransfer.effectAllowed = 'move'
    // Store tile id in transfer
    e.dataTransfer.setData('tileId', String(tile.id))
    e.dataTransfer.setData('source', source)
    if (setIdx !== null) e.dataTransfer.setData('setIdx', String(setIdx))
  }

  const handleDragEnd = () => setDragState(null)

  const handleDropOnSet = (targetSetIdx) => {
    if (!dragState?.dragTile) return
    const tile      = dragState.dragTile
    const source    = dragState.dragSource
    const srcSetIdx = dragState.dragSetIdx
    const board     = pendingBoard ? [...pendingBoard] : []
    const mode      = state.sortMode[state.currentPlayer]

    let newBoard = board
    let newHand  = pendingHand ? [...pendingHand] : []

    // Remove tile from source
    if (source === 'hand') {
      newHand = newHand.filter(t=>t.id!==tile.id)
    } else if (source === 'board' && srcSetIdx !== null) {
      const srcSet = board[srcSetIdx].filter(t=>t.id!==tile.id)
      if (srcSet.length > 0) {
        newBoard = board.map((s,i)=>i===srcSetIdx?srcSet:s)
      } else {
        newBoard = board.filter((_,i)=>i!==srcSetIdx)
        if (targetSetIdx > srcSetIdx) targetSetIdx--
      }
    }

    // Add to target set and re-sort
    const targetSet = newBoard[targetSetIdx]
    if (!targetSet) { setDragState(null); return }
    const newSet = sortSet([...targetSet, tile])
    newBoard = newBoard.map((s,i)=>i===targetSetIdx?newSet:s)

    setPendingBoard(newBoard)
    setPendingHand(sortHand(newHand, mode))
    setDragState(null); setError(null)
  }

  const handleDropNewSet = () => {
    if (!dragState?.dragTile) return
    const tile      = dragState.dragTile
    const source    = dragState.dragSource
    const srcSetIdx = dragState.dragSetIdx
    const board     = pendingBoard ? [...pendingBoard] : []
    const mode      = state.sortMode[state.currentPlayer]

    let newBoard = board
    let newHand  = pendingHand ? [...pendingHand] : []

    if (source === 'hand') {
      newHand = newHand.filter(t=>t.id!==tile.id)
    } else if (source === 'board' && srcSetIdx !== null) {
      const srcSet = board[srcSetIdx].filter(t=>t.id!==tile.id)
      newBoard = srcSet.length>0
        ? board.map((s,i)=>i===srcSetIdx?srcSet:s)
        : board.filter((_,i)=>i!==srcSetIdx)
    }

    // Start a new "set" with just this tile (incomplete — shown as invalid)
    newBoard = [...newBoard, [tile]]
    setPendingBoard(newBoard)
    setPendingHand(sortHand(newHand, mode))
    setDragState(null); setError(null)
  }

  // Drop from hand onto empty board area = new single-tile staging
  const handleDropOnBoard = e => {
    e.preventDefault()
    handleDropNewSet()
  }

  const handleReset = () => {
    const mode = state.sortMode[state.currentPlayer]||'color'
    setPendingBoard(state.board.map(s=>[...s]))
    setPendingHand(sortHand([...state.hands[state.currentPlayer]],mode))
    setSelectedIds(new Set()); setError(null); setDragState(null)
  }

  const handleConfirm = () => {
    const result = commitPlay(state, pendingBoard, pendingHand, state.currentPlayer)
    if (result.error) { setError(result.error); return }
    setState(result); setError(null); setDragState(null)
  }

  const handleDraw = () => { setState(prev=>drawTile(prev,prev.currentPlayer)); setError(null) }

  if (screen==='setup') return <SetupScreen onStart={startGame} onSimulate={handleSimulate}/>
  if (screen==='sim')   return <SimDashboard result={simResults} players={simPlayers} onNewSim={()=>handleSimulate(simPlayers,simResults?.multiRun||1)} onBack={()=>setScreen('setup')}/>

  const cur        = state?.players[state?.currentPlayer]
  const board      = pendingBoard || state?.board || []
  const displayHand= isHumanTurn ? (pendingHand||[]) : (state?.hands[state?.currentPlayer]||[])
  const boardChanged= isHumanTurn && pendingBoard && JSON.stringify(pendingBoard)!==JSON.stringify(state.board)
  const boardValid  = isValidBoard(board)
  const sortMode    = state?.sortMode[state?.currentPlayer]||'color'
  const pendingBoardIds = new Set((pendingBoard||[]).flat().map(t=>t.id))
  const origHandIds     = new Set((state?.hands[state?.currentPlayer]||[]).map(t=>t.id))
  const placedIds       = new Set([...pendingBoardIds].filter(id=>origHandIds.has(id)))
  const handForSuggs    = (pendingHand||[]).filter(t=>!placedIds.has(t.id))
  const selVal          = displayHand.filter(t=>selectedIds.has(t.id)).reduce((s,t)=>s+tileValue(t),0)

  return (
    <div className="app">
      {state?.phase==='finished' && <WinOverlay state={state} onNewGame={()=>setScreen('setup')}/>}
      {showAITurn && oneHuman && <AITurnScreen player={cur}/>}

      {/* Header */}
      <div className="hdr">
        <div className="hdr-title">Rummi<em>kub</em></div>
        <div className="hdr-right">
          {humanCount>=2 && <button className="btn btn-sm" onClick={()=>setShowMP(m=>!m)}>🔗</button>}
          <button className="btn btn-sm" onClick={()=>setScreen('setup')}>⚙ New</button>
        </div>
      </div>

      {showMP && humanCount>=2 && <MultiplayerPanel players={state.players} currentPlayerIdx={state.currentPlayer} gameId={gameId.current}/>}

      {/* Scores */}
      <div className="scores">
        {state?.players.map((p,i)=>(
          <div key={i} className={`sc${i===state.currentPlayer?' cur':''}`}>
            <div className="sc-top">
              <div className="sc-name">{p.name}</div>
              <div className="sc-badge">{p.type==='ai'?`${AI_STRATEGIES[p.strategy]?.emoji} AI`:'👤'}</div>
            </div>
            <div className="sc-sub">
              <span>{state.hands[i]?.length} tiles</span>
              {state.hasInitialMeld[i]&&<span className="meld-check">✓</span>}
              {state.finalRound&&<span style={{color:'var(--red)'}}>FINAL</span>}
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
              Board · {board.flat().length} tiles, {board.length} sets
              {boardChanged&&(boardValid
                ?<span style={{color:'var(--green)',marginLeft:8}}>✓ valid</span>
                :<span style={{color:'var(--red)',marginLeft:8}}>✗ invalid</span>)}
            </div>
            {dragState?.dragging && (
              <div className="drag-status">
                Dragging {dragState.dragTile?.isJoker?'Joker':`${dragState.dragTile?.num}`} ·
                {dragState.dropTargets?.length>0
                  ? <span style={{color:'var(--green)'}}> {dragState.dropTargets.length} drop{dragState.dropTargets.length>1?'s':''} available</span>
                  : <span style={{color:'var(--red)'}}> no board slots</span>}
              </div>
            )}
          </div>

          <div
            className={`board${boardChanged?(boardValid?' valid':' invalid'):''}${dragState?.dragging?' drag-active':''}`}
            onDrop={handleDropOnBoard}
            onDragOver={e=>e.preventDefault()}
          >
            {board.length===0 ? (
              <div className="board-empty">
                <div className="board-empty-icon">🀱</div>
                <div>Board is empty</div>
                <div style={{fontSize:'.6rem',marginTop:4}}>Drag tiles here or use hints below</div>
              </div>
            ) : (
              <div className="board-sets">
                {board.map((set,si)=>(
                  <BoardSet key={si} tiles={set} valid={isValidSet(set)} setIdx={si}
                    dragState={isHumanTurn?dragState:null}
                    onDropOnSet={handleDropOnSet}
                    onDragOverSet={si2=>{}}
                  />
                ))}
                {/* New set drop zone at end */}
                {isHumanTurn && dragState?.dragging && (
                  <NewSetDropZone dragState={dragState} onDrop={handleDropNewSet}/>
                )}
              </div>
            )}
          </div>

          {error && <div className="banner b-err">⚠ {error}</div>}
          {state?.finalRound&&!error&&<div className="banner b-warn">⏰ Final round — one last turn!</div>}

          {isHumanTurn && (
            <div className="actions">
              <button className="btn btn-primary" disabled={selectedIds.size<3} onClick={handlePlaceSelected}>
                Place ({selectedIds.size})
              </button>
              <button className="btn btn-green"   disabled={!boardChanged||!boardValid} onClick={handleConfirm}>✓ Confirm</button>
              <button className="btn"             disabled={!boardChanged} onClick={handleReset}>↺ Reset</button>
              <button className="btn btn-red"     disabled={boardChanged} onClick={handleDraw}>
                {state.pool.length===0?'Pass':'Draw & Pass'}
              </button>
            </div>
          )}

          {isHumanTurn && (
            <HintPanel hand={handForSuggs} board={state.board} hasMeld={state.hasInitialMeld[state.currentPlayer]}
              dragState={dragState} onPlaySuggestion={handlePlaySuggestion}/>
          )}
        </div>

        {/* Sidebar */}
        <div className="sidebar">
          <div className="panel">
            <div className="panel-lbl">Pool</div>
            <div className="pool-big">
              <div className="pool-num">{state?.pool?.length??0}</div>
              <div className="pool-sub">{state?.pool?.length===0?'EMPTY':' tiles'}</div>
            </div>
          </div>
          <div className="panel log-panel">
            <div className="panel-lbl">Game Log</div>
            <div className="log-scroll" ref={logRef}>
              {state?.log?.slice(-40).map((e,i)=>(
                <div key={i} className={`log-e${e.includes('Final')||e.includes('🏆')?' final':''}`}>{e}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Hand area */}
      {state && !showAITurn && (
        <div className="hand-area">
          <div className="hand-top">
            <div className="hand-name">{isHumanTurn?'Your Hand':`${cur?.name}'s Hand`}</div>
            <div className="hand-meta">
              {displayHand.length} tiles · <strong>{handValue(displayHand)} pts</strong>
              {!state.hasInitialMeld[state.currentPlayer]&&<span style={{color:'var(--gold)',marginLeft:8}}>· Need ≥30 initial</span>}
            </div>
            {isHumanTurn&&(
              <div className="sort-btns">
                <button className={`sort-btn${sortMode==='color'?' act':''}`} onClick={()=>handleSort('color')}>🎨 Colour</button>
                <button className={`sort-btn${sortMode==='number'?' act':''}`} onClick={()=>handleSort('number')}>🔢 Number</button>
              </div>
            )}
          </div>

          <div className="hand-layout">
            {isHumanTurn&&(
              <div className="suggestions">
                <div className="sugg-lbl">READY SETS</div>
                <div className="sugg-sets">
                  {suggestPlayableSets(handForSuggs).slice(0,8).map((set,i)=>{
                    const used=set.some(t=>placedIds.has(t.id))
                    return (
                      <div key={i} className={`sugg-set${used?' used':''}`}
                        onClick={()=>!used&&handlePlaySuggestion(set)}
                        title={used?'Tiles already placed':`Click to place (${handValue(set)} pts)`}>
                        <div className="sugg-val">{handValue(set)}pts</div>
                        {set.map(t=><Tile key={t.id} tile={t} inBoard/>)}
                      </div>
                    )
                  })}
                  {suggestPlayableSets(handForSuggs).length===0&&<div className="sugg-empty">No playable sets yet</div>}
                </div>
              </div>
            )}
            {isHumanTurn&&<div className="hand-divider"/>}

            <div className="hand-rack">
              {displayHand.map(tile=>{
                const isDragging = dragState?.dragTile?.id===tile.id
                const targets = isHumanTurn ? findDropTargets(tile, pendingBoard||[]) : []
                const hasTarget = targets.length > 0
                return (
                  <div key={tile.id} className="tile-wrapper" title={isHumanTurn&&!hasTarget?'No board slots for this tile yet':''}
                    onDoubleClick={()=>isHumanTurn&&handleInsertTile(tile)}>
                    <Tile tile={tile}
                      selected={isHumanTurn&&selectedIds.has(tile.id)}
                      onClick={()=>handleTileClick(tile)}
                      draggable={isHumanTurn}
                      onDragStart={e=>handleDragStart(e,tile,'hand')}
                      onDragEnd={handleDragEnd}
                      ghost={isDragging}
                      dimmed={isHumanTurn && dragState?.dragging && !isDragging && !hasTarget && board.length>0}
                    />
                    {isHumanTurn && !dragState?.dragging && targets.length>0 && (
                      <div className="tile-can-drop" title={`Can extend ${targets.length} board set${targets.length>1?'s':''}`}>+{targets.length}</div>
                    )}
                    {isHumanTurn && !dragState?.dragging && targets.length===0 && board.length>0 && (
                      <div className="tile-no-drop" title="No board extension available">–</div>
                    )}
                  </div>
                )
              })}
            </div>

            {isHumanTurn&&selectedIds.size>0&&(
              <div className="sel-info">
                {selectedIds.size} selected · {selVal} pts
                <button className="btn btn-sm" onClick={()=>setSelectedIds(new Set())}>Clear</button>
              </div>
            )}
            {isHumanTurn&&(
              <div className="hand-hint">
                <strong>Drag</strong> tiles onto board sets · <strong>Double-click</strong> to auto-insert · <strong>Click</strong> to select then Place · Check hints above
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
