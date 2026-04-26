import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  buildPool, sortHand, sortSet, isValid, isValidBoard, isRun,
  tileVal, handVal, findAllSets, findExtensions,
  findJokerReplacements, findLinkableTiles,
  computeHints, aiPlayTurn, verifyTileCount
} from './engine.js'

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── Setup ────────────────────────────────────────────────────
function SetupScreen({ onStart }) {
  const [players, setPlayers] = useState([
    { name: 'You', type: 'human' },
    { name: 'AI Aria', type: 'ai' },
  ])
  const upd = (i, k, v) => setPlayers(ps => ps.map((p, pi) => pi === i ? { ...p, [k]: v } : p))
  const add = () => players.length < 4 && setPlayers(ps => [...ps, { name: `AI ${['Bolt','Cruz','Dune'][ps.length-2]}`, type: 'ai' }])
  const rem = i => setPlayers(ps => ps.filter((_, pi) => pi !== i))
  return (
    <div className="setup">
      <div className="logo">Rummikub</div>
      <div className="logo-sub">Tile Strategy Game</div>
      <div className="setup-card">
        <h3>Players</h3>
        <div className="player-rows">
          {players.map((p, i) => (
            <div className="player-row" key={i}>
              <div className="p-num">{i+1}</div>
              <input className="p-name" value={p.name} onChange={e => upd(i,'name',e.target.value)} placeholder={`Player ${i+1}`} />
              <div className="type-btns">
                <button className={`tbtn${p.type==='human'?' on':''}`} onClick={() => upd(i,'type','human')}>Human</button>
                <button className={`tbtn${p.type==='ai'?' on':''}`} onClick={() => upd(i,'type','ai')}>AI</button>
              </div>
              {players.length > 2 && <button className="btn" style={{padding:'3px 7px',fontSize:'10px'}} onClick={() => rem(i)}>✕</button>}
            </div>
          ))}
        </div>
        {players.length < 4 && <button className="add-p" onClick={add}>+ Add Player</button>}
        <button className="start-btn" onClick={() => onStart(players)}>DEAL TILES</button>
      </div>
    </div>
  )
}

// ── Tile ─────────────────────────────────────────────────────
function Tile({ tile, selected, linkable, notLinkable, isBoard, bounce, aiDrop,
                onMouseDown, onMouseUp, onDragStart, onDragEnd, onDoubleClick }) {
  const cls = ['tile', `c-${tile.color}`,
    isBoard ? 'in-board' : '',
    selected ? 'selected' : '',
    linkable ? (isBoard ? 'linkable-board' : 'linkable') : '',
    notLinkable ? 'not-linkable' : '',
    bounce ? 'bounce' : '',
    aiDrop ? 'ai-drop' : '',
  ].filter(Boolean).join(' ')
  return (
    <div className={cls} draggable
      onDragStart={onDragStart} onDragEnd={onDragEnd}
      onDoubleClick={onDoubleClick} onMouseDown={onMouseDown} onMouseUp={onMouseUp}>
      {tile.isJoker ? '★' : tile.num}
    </div>
  )
}

function MT({ tile }) {
  return <div className={`mt c-${tile.color}`}>{tile.isJoker ? '★' : tile.num}</div>
}

// ── Hint Panel ───────────────────────────────────────────────
function HintPanel({ hints, onClose, onApply }) {
  return (
    <div className="hint-panel vis">
      <div className="hint-hdr">
        <div className="hint-title">💡 BEST MOVES</div>
        <button className="hint-close" onClick={onClose}>✕</button>
      </div>
      <div className="hint-moves">
        {hints.map((h, i) => {
          const allTiles = [...h.sets.flat(),
            ...(h.jrep ? [h.jrep.handTile] : []),
            ...(h.tile && !h.sets.flat().some(t => t.id === h.tile?.id) ? [h.tile] : []),
          ]
          return (
            <div key={i}
              className={`hint-move${i===0?' best':''}${!h.applicable?' not-applicable':''}`}
              onClick={() => h.applicable && onApply(h)}>
              <div className={`hm-badge${!h.applicable?' dim':''}`}>{h.label}</div>
              <div className="hm-desc">{h.desc}</div>
              <div className="hm-tiles">{allTiles.slice(0,12).map((t,j) => <MT key={j} tile={t}/>)}</div>
              {h.value > 0 && <div className="hm-pts">{h.value}p</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Debug Panel ──────────────────────────────────────────────
function DebugPanel({ G, logs }) {
  return (
    <div className="debug-panel vis">
      <h4>🐛 Debug Mode</h4>

      {/* All player hands */}
      <div style={{marginBottom:8}}>
        {G.players.map((p, pi) => (
          <div key={pi} style={{marginBottom:6}}>
            <div style={{color:'#ffd96b',fontSize:10,marginBottom:3,letterSpacing:1}}>
              {p.name} ({G.hands[pi].length} tiles{G.hasMeld[pi]?'':', no meld'})
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:2}}>
              {sortHand(G.hands[pi],'color').map(t => (
                <div key={t.id} className={`mt c-${t.color}`} style={{opacity: pi===G.currentPlayer?1:0.75}}>
                  {t.isJoker?'★':t.num}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Pool count */}
      <div style={{color:'rgba(255,255,255,.5)',fontSize:10,marginBottom:6}}>
        Pool: {G.pool.length} · Board tiles: {G.board.flat().length}
      </div>

      {/* Log */}
      <div style={{borderTop:'1px solid rgba(255,255,255,.1)',paddingTop:6}}>
        {logs.slice(0,30).map((l,i) => (
          <div key={i} className={`dl ${l.type}`}>{l.msg}</div>
        ))}
      </div>
    </div>
  )
}

// ── Toast ────────────────────────────────────────────────────
function Toast({ msg, type }) {
  return msg ? <div className={`toast ${type}`}>{msg}</div> : null
}

// ── Board Set ────────────────────────────────────────────────
function BoardSet({ set, si, isHuman, onDrop, onTileDragStart, onTileDragEnd,
                    onTileDblClick, linkableIds, prevBoardIds, aiMovedIds }) {
  const [over, setOver] = useState(false)
  const valid = isValid(set)
  const lbl = valid ? (isRun(set) ? 'run' : 'group') : '⚠ invalid'
  const hasNew = set.some(t => !prevBoardIds.has(t.id))
  const cls = ['bset', !valid?'invalid':'', hasNew?'ai-new':'', over?'drop-target':''].filter(Boolean).join(' ')
  return (
    <div className={cls}
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); onDrop(si) }}>
      <div className="bset-lbl">{lbl}</div>
      {set.map(tile => (
        <Tile key={tile.id} tile={tile} isBoard
          linkable={linkableIds.has(tile.id)}
          aiDrop={aiMovedIds.has(tile.id)}
          onDragStart={e => isHuman && onTileDragStart(e, tile, 'board', si)}
          onDragEnd={onTileDragEnd}
          onDoubleClick={() => isHuman && onTileDblClick(tile, si)}
        />
      ))}
    </div>
  )
}

// ── Game Screen ───────────────────────────────────────────────
function GameScreen({ players: initPlayers }) {
  const [G, setG] = useState(() => {
    const pool = buildPool()
    const hands = initPlayers.map(() => { const h=[]; for(let i=0;i<14;i++) h.push(pool.pop()); return h })
    return {
      pool, players: initPlayers, hands,
      board: [], hasMeld: initPlayers.map(()=>false),
      currentPlayer: 0, phase: 'play', finalRoundStart: -1,
      pendingBoard: null, pendingHand: null,
      aiMovedIds: new Set(),
    }
  })

  const [sortMode, setSortMode] = useState('color')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showHint, setShowHint] = useState(false)
  const [hints, setHints] = useState([])
  const [toast, setToast] = useState(null)
  const [winner, setWinner] = useState(null)
  const [debugMode, setDebugMode] = useState(false)
  const [debugLogs, setDebugLogs] = useState([])
  const [aiRunning, setAiRunning] = useState(false)
  const [bounceIds, setBounceIds] = useState(new Set())

  const dragRef = useRef({ tile:null, src:null, srcSi:null })
  const longRef = useRef({ timer:null, interval:null, active:false })
  const toastTimer = useRef(null)
  const aiRunningRef = useRef(false)

  const addLog = (msg, type='info') => setDebugLogs(l => [{msg,type,ts:Date.now()},...l].slice(0,60))

  const showToast = (msg, type='error') => {
    setToast({msg,type})
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  // ── Derived (memoized to avoid re-running findAllSets every render) ──
  const board = G.pendingBoard ?? G.board
  const hand  = G.pendingHand  ?? G.hands[G.currentPlayer]
  const hasMeld = G.hasMeld[G.currentPlayer]
  const isHuman = G.players[G.currentPlayer].type === 'human'
  const prevBoardIds = useMemo(() => new Set(G.board.flat().map(t=>t.id)), [G.board])

  // findAllSets is expensive — memoize on hand identity
  const handKey = hand.map(t=>t.id).join(',')
  const allSets = useMemo(() => findAllSets(hand), [handKey])
  const playableIds = useMemo(() => new Set(allSets.flat().map(t=>t.id)), [allSets])

  const sortedHand = useMemo(() => sortHand(hand, sortMode), [handKey, sortMode])
  const playable = useMemo(() => sortedHand.filter(t => playableIds.has(t.id)), [sortedHand, playableIds])
  const rest     = useMemo(() => sortedHand.filter(t => !playableIds.has(t.id)), [sortedHand, playableIds])

  const allHandAndBoard = useMemo(() => [...hand, ...board.flat()], [handKey, board])
  const linkableIds = useMemo(() =>
    selectedIds.size > 0 ? findLinkableTiles(selectedIds, allHandAndBoard) : new Set(),
    [selectedIds, allHandAndBoard]
  )

  const suggs = useMemo(() =>
    allSets.sort((a,b) => b.length-a.length || b.reduce((s,t)=>s+tileVal(t),0)-a.reduce((s,t)=>s+tileVal(t),0)).slice(0,10),
    [allSets]
  )

  // ── AI trigger ───────────────────────────────────────────────
  useEffect(() => {
    if (!isHuman && !aiRunningRef.current && G.phase !== 'end') {
      runAI()
    }
  }, [G.currentPlayer, G.phase])

  async function runAI() {
    if (aiRunningRef.current) return
    aiRunningRef.current = true
    setAiRunning(true)
    await sleep(800)

    setG(prev => {
      const pi = prev.currentPlayer
      const h = [...prev.hands[pi]]
      const b = prev.board.map(s=>[...s])
      const result = aiPlayTurn(h, b, prev.hasMeld[pi])

      if (debugMode) {
        result.log.forEach(m => addLog(`AI ${prev.players[pi].name}: ${m}`, 'ok'))
        const v = verifyTileCount(prev.hands.map((hh,i) => i===pi ? result.newHand : hh), result.newBoard, prev.pool)
        addLog(`Tiles: ${v.total}/${v.expected} ${v.ok?'✓':'✗ ERROR'}`, v.ok?'ok':'err')
      }

      const doAdvance = (state, newPool, newHands, newBoard, newHasMeld, moved) => {
        const n = state.players.length
        const next = (pi + 1) % n
        const phase = state.phase === 'final' && next === state.finalRoundStart ? 'end' : state.phase
        return {
          ...state, pool: newPool, hands: newHands, board: newBoard,
          hasMeld: newHasMeld, currentPlayer: next,
          pendingBoard: null, pendingHand: null,
          phase, aiMovedIds: moved ?? new Set(),
        }
      }

      if (!result.moved) {
        const newPool = [...prev.pool]
        const newHands = prev.hands.map((hh,i) => i===pi ? [...hh] : hh)
        if (newPool.length > 0) newHands[pi] = [...newHands[pi], newPool.pop()]
        const phase = newPool.length===0 && prev.phase!=='final' ? 'final' : prev.phase
        const frs = phase==='final' && prev.phase!=='final' ? pi : prev.finalRoundStart
        return doAdvance({...prev, phase, finalRoundStart:frs}, newPool, newHands, prev.board, prev.hasMeld, new Set())
      }

      if (result.newHand.length === 0) {
        setTimeout(() => {
          const scores = prev.players.map((p,i) => ({name:p.name, val:handVal(i===pi?[]:prev.hands[i]), cnt:i===pi?0:prev.hands[i].length}))
          setWinner({name:prev.players[pi].name, scores})
        }, 400)
        return prev
      }

      const prevIds = new Set(prev.board.flat().map(t=>t.id))
      const moved = new Set(result.newBoard.flat().filter(t=>!prevIds.has(t.id)).map(t=>t.id))
      const newHasMeld = [...prev.hasMeld]
      if (result.meldAchieved) newHasMeld[pi] = true
      const newHands = prev.hands.map((hh,i) => i===pi ? result.newHand : hh)
      return doAdvance(prev, prev.pool, newHands, result.newBoard, newHasMeld, moved)
    })

    aiRunningRef.current = false
    setAiRunning(false)
    setSelectedIds(new Set())
  }

  // ── Drag ─────────────────────────────────────────────────────
  function onTileDragStart(e, tile, src, si) {
    dragRef.current = {tile, src, srcSi: si??null}
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('id', String(tile.id))
    const ghost = e.currentTarget.cloneNode(true)
    ghost.style.cssText = 'position:fixed;top:-200px;pointer-events:none;'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 21, 27)
    setTimeout(() => { ghost.remove(); e.currentTarget.classList.add('dragging') }, 0)
  }
  function onTileDragEnd(e) { e.currentTarget.classList.remove('dragging') }

  function ep(prev) {
    return {
      pendingBoard: prev.pendingBoard ?? prev.board.map(s=>[...s]),
      pendingHand:  prev.pendingHand  ?? [...prev.hands[prev.currentPlayer]],
    }
  }

  function bounce(id) {
    setBounceIds(s => { const n=new Set(s); n.add(id); return n })
    setTimeout(() => setBounceIds(s => { const n=new Set(s); n.delete(id); return n }), 350)
  }

  function handleDropOnSet(si) {
    const {tile, src, srcSi} = dragRef.current
    if (!tile) return
    setG(prev => {
      const {pendingBoard:pb, pendingHand:ph} = ep(prev)
      let tsi = si
      if (src==='hand') {
        const idx=ph.findIndex(t=>t.id===tile.id); if(idx>=0) ph.splice(idx,1)
        setSelectedIds(s=>{const n=new Set(s);n.delete(tile.id);return n})
      } else if (src==='board' && srcSi!==null) {
        const idx=pb[srcSi].findIndex(t=>t.id===tile.id); if(idx>=0) pb[srcSi].splice(idx,1)
        if(pb[srcSi].length===0){pb.splice(srcSi,1);if(tsi>srcSi)tsi--}
      }
      if (tsi < pb.length) pb[tsi]=sortSet([...pb[tsi],tile])
      else pb.push([tile])
      dragRef.current={tile:null,src:null,srcSi:null}
      bounce(tile.id)
      return {...prev, pendingBoard:pb, pendingHand:ph}
    })
  }

  function handleDropNewSet() {
    const {tile, src, srcSi} = dragRef.current
    if (!tile) return
    setG(prev => {
      const {pendingBoard:pb, pendingHand:ph} = ep(prev)
      if (src==='hand') {
        const idx=ph.findIndex(t=>t.id===tile.id); if(idx>=0) ph.splice(idx,1)
        setSelectedIds(s=>{const n=new Set(s);n.delete(tile.id);return n})
      } else if (src==='board' && srcSi!==null) {
        const idx=pb[srcSi].findIndex(t=>t.id===tile.id); if(idx>=0) pb[srcSi].splice(idx,1)
        if(pb[srcSi].length===0) pb.splice(srcSi,1)
      }
      pb.push([tile])
      dragRef.current={tile:null,src:null,srcSi:null}
      return {...prev, pendingBoard:pb, pendingHand:ph}
    })
  }

  // ── Click / dbl-click ────────────────────────────────────────
  function handleTileMouseDown(e, tile) {
    if (e.button !== 0) return
    e.stopPropagation()
    // toggle selection immediately
    setSelectedIds(prev => {
      const n = new Set(prev)
      n.has(tile.id) ? n.delete(tile.id) : n.add(tile.id)
      return n
    })
    // long press — lasso linkable tiles
    longRef.current.timer = setTimeout(() => {
      longRef.current.active = true
      let i = sortedHand.findIndex(t => t.id === tile.id) + 1
      longRef.current.interval = setInterval(() => {
        if (!longRef.current.active || i >= sortedHand.length) {
          clearInterval(longRef.current.interval); return
        }
        const t = sortedHand[i]
        setSelectedIds(prev => {
          // only add if linkable to current selection
          const linked = findLinkableTiles(prev, [...sortedHand, ...board.flat()])
          if (linked.has(t.id)) { const n=new Set(prev); n.add(t.id); return n }
          return prev
        })
        i++
      }, 130)
    }, 420)
  }

  function handleTileMouseUp() {
    clearTimeout(longRef.current.timer)
    clearInterval(longRef.current.interval)
    longRef.current.active = false
  }

  function handleTileDblClick(e, tile) {
    e.stopPropagation(); e.preventDefault()
    clearTimeout(longRef.current.timer)
    clearInterval(longRef.current.interval)
    autoPlace(tile)
  }

  function autoPlace(tile) {
    setG(prev => {
      const {pendingBoard:pb, pendingHand:ph} = ep(prev)
      // board extension
      const exts = findExtensions([tile], pb)
      if (exts.length) {
        const ext = exts[0]
        const idx=ph.findIndex(t=>t.id===tile.id); if(idx>=0) ph.splice(idx,1)
        if (ext.pos==='start') pb[ext.si]=sortSet([tile,...pb[ext.si]])
        else pb[ext.si]=sortSet([...pb[ext.si],tile])
        setSelectedIds(s=>{const n=new Set(s);n.delete(tile.id);return n})
        bounce(tile.id)
        return {...prev, pendingBoard:pb, pendingHand:ph}
      }
      // new set with selected
      const pool=[...new Set([tile.id,...selectedIds])].map(id=>ph.find(t=>t.id===id)).filter(Boolean)
      const sets=findAllSets(pool).filter(s=>s.some(t=>t.id===tile.id)).sort((a,b)=>b.length-a.length)
      if (sets.length) {
        const best=sets[0]
        const ids=new Set(best.map(t=>t.id))
        ids.forEach(id=>{const i=ph.findIndex(t=>t.id===id);if(i>=0)ph.splice(i,1)})
        pb.push(sortSet(best))
        setSelectedIds(s=>{const n=new Set(s);ids.forEach(id=>n.delete(id));return n})
        return {...prev, pendingBoard:pb, pendingHand:ph}
      }
      showToast('No valid placement — select more tiles first','info')
      return prev
    })
  }

  function returnToHand(tile, si) {
    if (prevBoardIds.has(tile.id)) { showToast('Cannot return original board tiles to hand'); return }
    setG(prev => {
      const {pendingBoard:pb, pendingHand:ph} = ep(prev)
      const idx=pb[si].findIndex(t=>t.id===tile.id); if(idx>=0) pb[si].splice(idx,1)
      if(pb[si].length===0) pb.splice(si,1)
      ph.push(tile)
      return {...prev, pendingBoard:pb, pendingHand:ph}
    })
  }

  // ── Confirm / Reset / Draw ───────────────────────────────────
  function handleConfirm() {
    const pi = G.currentPlayer
    const nb = G.pendingBoard ?? G.board
    const nh = G.pendingHand ?? G.hands[pi]
    if (!isValidBoard(nb)) { showToast('Board has invalid sets!'); return }
    const prevIds = new Set(G.board.flat().map(t=>t.id))
    const newIds  = new Set(nb.flat().map(t=>t.id))
    const placed  = [...newIds].filter(id=>!prevIds.has(id))
    if (!placed.length) { showToast('Place at least one tile, or Draw'); return }
    const nhIds = new Set(nh.map(t=>t.id))
    if ([...prevIds].some(id=>!newIds.has(id)&&nhIds.has(id))) { showToast('Cannot take board tiles back to hand!'); return }
    const newHasMeld = [...G.hasMeld]
    if (!newHasMeld[pi]) {
      const v=G.hands[pi].filter(t=>placed.includes(t.id)).reduce((s,t)=>s+tileVal(t),0)
      if (v<30) { showToast(`Initial meld needs 30+ pts. You placed ${v} pts.`); return }
      newHasMeld[pi]=true
    }
    if (nh.length===0) {
      const scores=G.players.map((p,i)=>({name:p.name,val:handVal(i===pi?[]:G.hands[i]),cnt:i===pi?0:G.hands[i].length}))
      setWinner({name:G.players[pi].name,scores}); return
    }
    setG(prev => {
      const newHands=prev.hands.map((h,i)=>i===pi?nh:h)
      const next=(pi+1)%prev.players.length
      const phase=prev.phase==='final'&&next===prev.finalRoundStart?'end':prev.phase
      if (debugMode) {
        const v=verifyTileCount(newHands,nb,prev.pool)
        addLog(`Confirm: ${v.total}/${v.expected} ${v.ok?'✓':'✗'}`,v.ok?'ok':'err')
      }
      return {...prev,board:nb,hands:newHands,hasMeld:newHasMeld,currentPlayer:next,pendingBoard:null,pendingHand:null,phase,aiMovedIds:new Set()}
    })
    setSelectedIds(new Set()); setShowHint(false)
  }

  function handleReset() {
    setG(prev=>({...prev,pendingBoard:null,pendingHand:null}))
    setSelectedIds(new Set())
  }

  function handleDraw() {
    const pi=G.currentPlayer
    setG(prev=>{
      const newPool=[...prev.pool]
      const newHands=prev.hands.map((h,i)=>i===pi?[...h]:h)
      if(newPool.length>0) newHands[pi]=[...newHands[pi],newPool.pop()]
      const phase=newPool.length===0&&prev.phase!=='final'?'final':prev.phase
      const frs=phase==='final'&&prev.phase!=='final'?pi:prev.finalRoundStart
      const next=(pi+1)%prev.players.length
      const ph2=phase==='final'&&next===frs?'end':phase
      if(debugMode){const v=verifyTileCount(newHands,prev.board,newPool);addLog(`Draw: ${v.total}/${v.expected} ${v.ok?'✓':'✗'}`,v.ok?'ok':'err')}
      return {...prev,pool:newPool,hands:newHands,phase:ph2,finalRoundStart:frs,currentPlayer:next,pendingBoard:null,pendingHand:null,aiMovedIds:new Set()}
    })
    setSelectedIds(new Set()); setShowHint(false)
  }

  // ── Hint ─────────────────────────────────────────────────────
  function handleHint() {
    setHints(computeHints(hand, board, hasMeld))
    setShowHint(true)
  }

  function applyHint(hint) {
    setG(prev=>{
      const {pendingBoard:pb,pendingHand:ph}=ep(prev)
      const rmHand=id=>{const i=ph.findIndex(t=>t.id===id);if(i>=0)ph.splice(i,1)}
      if(hint.sets.length){
        const ids=new Set(hint.sets.flat().map(t=>t.id))
        ids.forEach(rmHand); hint.sets.forEach(s=>pb.push(sortSet(s)))
        setSelectedIds(s=>{const n=new Set(s);ids.forEach(id=>n.delete(id));return n})
      }
      if(hint.exts?.length){
        const ext=hint.exts[0]; rmHand(ext.tile.id)
        if(ext.pos==='start') pb[ext.si]=sortSet([ext.tile,...pb[ext.si]])
        else pb[ext.si]=sortSet([...pb[ext.si],ext.tile])
        setSelectedIds(s=>{const n=new Set(s);n.delete(ext.tile.id);return n})
      }
      if(hint.jrep){
        const{si,ji,handTile,joker}=hint.jrep
        pb[si][ji]=handTile; rmHand(handTile.id); ph.push(joker)
        setSelectedIds(s=>{const n=new Set(s);n.delete(handTile.id);return n})
      }
      if(hint.splits?.length){
        const sp=hint.splits[0]; rmHand(sp.tile.id)
        pb.splice(sp.si,1,sp.left,sp.right)
        setSelectedIds(s=>{const n=new Set(s);n.delete(sp.tile.id);return n})
      }
      return {...prev,pendingBoard:pb,pendingHand:ph}
    })
    setShowHint(false)
  }

  function playSugg(set) {
    setG(prev=>{
      const {pendingBoard:pb,pendingHand:ph}=ep(prev)
      const ids=new Set(set.map(t=>t.id))
      ids.forEach(id=>{const i=ph.findIndex(t=>t.id===id);if(i>=0)ph.splice(i,1)})
      pb.push(sortSet(set))
      setSelectedIds(s=>{const n=new Set(s);ids.forEach(id=>n.delete(id));return n})
      return {...prev,pendingBoard:pb,pendingHand:ph}
    })
  }

  // ── Win screen ───────────────────────────────────────────────
  if (winner) return (
    <div className="win-screen vis">
      <div className="win-title">🏆 WINNER!</div>
      <div className="win-sub">{winner.name} wins!</div>
      <div className="score-tbl">
        {[...winner.scores].sort((a,b)=>a.val-b.val).map((s,i)=>(
          <div className="score-row" key={i}>
            <span className="sr-pos">{i+1}.</span>
            <span>{s.name}</span>
            <span>{s.cnt} tiles</span>
            <span style={{color:i===0?'#f4c430':'rgba(255,255,255,.5)'}}>-{s.val}pts</span>
          </div>
        ))}
      </div>
      <button className="btn" style={{marginTop:14,padding:'10px 28px',fontSize:14}} onClick={()=>window.location.reload()}>Play Again</button>
    </div>
  )

  // ── Main render ───────────────────────────────────────────────
  return (
    <div className="game">
      {/* Header */}
      <div className="g-header">
        <div className="g-logo">R</div>
        <div className="ptabs">
          {G.players.map((p,i)=>(
            <div key={i} className={`ptab${i===G.currentPlayer?' cur':''}${G.phase==='final'?' last':''}`}>
              {p.name}<span className="tc">{G.hands[i].length}🀫</span>
              {!G.hasMeld[i]&&<span style={{color:'#f07070',fontSize:8,marginLeft:2}}>no meld</span>}
            </div>
          ))}
        </div>
        <div className="pool-info">Pool: {G.pool.length}</div>
        <button className={`debug-toggle${debugMode?' on':''}`} onClick={()=>setDebugMode(d=>!d)}>DEBUG</button>
      </div>

      {/* Board */}
      <div className="board-area"
        onDragOver={e=>e.preventDefault()}
        onDrop={e=>{e.preventDefault();if(e.target===e.currentTarget||e.target.classList.contains('board-sets'))handleDropNewSet()}}
        onClick={()=>setShowHint(false)}>
        <div className={`lt-banner${G.phase==='final'?' vis':''}`}>⚠ LAST TURN — Pool empty!</div>
        <div className="board-sets">
          {board.map((set,si)=>(
            <BoardSet key={si} set={set} si={si} isHuman={isHuman}
              onDrop={handleDropOnSet}
              onTileDragStart={onTileDragStart} onTileDragEnd={onTileDragEnd}
              onTileDblClick={returnToHand}
              linkableIds={linkableIds} prevBoardIds={prevBoardIds} aiMovedIds={G.aiMovedIds}
            />
          ))}
          <div className="new-set-zone"
            onDragOver={e=>{e.preventDefault();e.currentTarget.classList.add('drag-over')}}
            onDragLeave={e=>e.currentTarget.classList.remove('drag-over')}
            onDrop={e=>{e.preventDefault();e.currentTarget.classList.remove('drag-over');handleDropNewSet()}}>
            + New Set
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="bottom">
        <div className="action-bar">
          <div className="turn-info">{G.players[G.currentPlayer].name}'s Turn</div>
          <div className="sort-ctrl">
            <button className={`sort-btn${sortMode==='color'?' on':''}`} onClick={()=>setSortMode('color')}>🎨 Color</button>
            <button className={`sort-btn${sortMode==='num'?' on':''}`} onClick={()=>setSortMode('num')}>🔢 Number</button>
          </div>
          <button className="btn btn-gold" disabled={!isHuman} onClick={handleHint}>💡 Hint</button>
          <button className="btn" disabled={!isHuman} onClick={handleReset}>↺ Reset</button>
          <button className="btn btn-red" disabled={!isHuman} onClick={handleDraw}>Draw</button>
          <button className="btn btn-green" disabled={!isHuman} onClick={handleConfirm}>✓ Confirm</button>
        </div>

        <div className="hand-lbl">{isHuman?'Your Tiles':`${G.players[G.currentPlayer].name}'s Tiles`}</div>

        {isHuman && (
          <div className="sugg-strip">
            {suggs.map((set,i)=>{
              const v=set.reduce((s,t)=>s+tileVal(t),0)
              const can=hasMeld||v>=30
              return(
                <div key={i} className={`sugg-set${can?'':' dimmed'}`} onClick={()=>can&&playSugg(set)}>
                  {set.map((t,j)=><MT key={j} tile={t}/>)}
                  <span style={{fontSize:9,color:'rgba(255,255,255,.4)',marginLeft:3}}>{v}p</span>
                </div>
              )
            })}
          </div>
        )}

        <div className="hand-rack">
          {playable.map(tile=>(
            <Tile key={tile.id} tile={tile}
              selected={selectedIds.has(tile.id)}
              linkable={!selectedIds.has(tile.id)&&linkableIds.has(tile.id)}
              notLinkable={selectedIds.size>0&&!selectedIds.has(tile.id)&&!linkableIds.has(tile.id)}
              bounce={bounceIds.has(tile.id)}
              onDragStart={e=>isHuman&&onTileDragStart(e,tile,'hand',undefined)}
              onDragEnd={onTileDragEnd}
              onDoubleClick={e=>isHuman&&handleTileDblClick(e,tile)}
              onMouseDown={e=>isHuman&&handleTileMouseDown(e,tile)}
              onMouseUp={handleTileMouseUp}
            />
          ))}
          {playable.length>0&&rest.length>0&&<div className="hand-sep"/>}
          {rest.map(tile=>(
            <Tile key={tile.id} tile={tile}
              selected={selectedIds.has(tile.id)}
              linkable={!selectedIds.has(tile.id)&&linkableIds.has(tile.id)}
              notLinkable={selectedIds.size>0&&!selectedIds.has(tile.id)&&!linkableIds.has(tile.id)}
              bounce={bounceIds.has(tile.id)}
              onDragStart={e=>isHuman&&onTileDragStart(e,tile,'hand',undefined)}
              onDragEnd={onTileDragEnd}
              onDoubleClick={e=>isHuman&&handleTileDblClick(e,tile)}
              onMouseDown={e=>isHuman&&handleTileMouseDown(e,tile)}
              onMouseUp={handleTileMouseUp}
            />
          ))}
        </div>
      </div>

      {/* Overlays */}
      {aiRunning&&(
        <div className="ai-overlay vis">
          <div className="ai-name">{G.players[G.currentPlayer].name} thinking…</div>
          <div className="ai-spin"/>
        </div>
      )}
      {showHint&&<HintPanel hints={hints} onClose={()=>setShowHint(false)} onApply={applyHint}/>}
      {toast&&<Toast msg={toast.msg} type={toast.type}/>}
      {debugMode&&<DebugPanel G={G} logs={debugLogs}/>}
    </div>
  )
}

export default function App() {
  const [players, setPlayers] = useState(null)
  return players ? <GameScreen players={players}/> : <SetupScreen onStart={setPlayers}/>
}
