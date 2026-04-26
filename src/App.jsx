import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  buildPool, sortHand, sortSet, isValid, isValidBoard, isRun, isGroup,
  tileVal, handVal, findAllSets, bestCombination, findExtensions,
  findJokerReplacements, findSplitInserts, findLinkableTiles,
  computeHints, aiPlayTurn, verifyTileCount
} from './engine.js'

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── Setup Screen ─────────────────────────────────────────────
function SetupScreen({ onStart }) {
  const [players, setPlayers] = useState([
    { name: 'You', type: 'human' },
    { name: 'AI Aria', type: 'ai' },
  ])

  const update = (i, key, val) => setPlayers(ps => ps.map((p, pi) => pi === i ? { ...p, [key]: val } : p))
  const add = () => players.length < 4 && setPlayers(ps => [...ps, { name: `AI ${['Bolt','Cruz','Dune'][ps.length - 2]}`, type: 'ai' }])
  const remove = i => setPlayers(ps => ps.filter((_, pi) => pi !== i))

  return (
    <div className="setup">
      <div className="logo">Rummikub</div>
      <div className="logo-sub">Tile Strategy Game</div>
      <div className="setup-card">
        <h3>Players</h3>
        <div className="player-rows">
          {players.map((p, i) => (
            <div className="player-row" key={i}>
              <div className="p-num">{i + 1}</div>
              <input className="p-name" value={p.name} onChange={e => update(i, 'name', e.target.value)} placeholder={`Player ${i + 1}`} />
              <div className="type-btns">
                <button className={`tbtn${p.type === 'human' ? ' on' : ''}`} onClick={() => update(i, 'type', 'human')}>Human</button>
                <button className={`tbtn${p.type === 'ai' ? ' on' : ''}`} onClick={() => update(i, 'type', 'ai')}>AI</button>
              </div>
              {players.length > 2 && <button className="btn" style={{ padding: '3px 7px', fontSize: '10px' }} onClick={() => remove(i)}>✕</button>}
            </div>
          ))}
        </div>
        {players.length < 4 && <button className="add-p" onClick={add}>+ Add Player (max 4)</button>}
        <button className="start-btn" onClick={() => onStart(players)}>DEAL TILES</button>
      </div>
    </div>
  )
}

// ── Tile component ───────────────────────────────────────────
function Tile({ tile, src, selected, linkable, notLinkable, isBoard, onMouseDown, onDragStart, onDragEnd, onDoubleClick, extraClass = '' }) {
  const cls = [
    'tile',
    `c-${tile.color}`,
    isBoard ? 'in-board' : '',
    selected ? 'selected' : '',
    linkable ? (isBoard ? 'linkable-board' : 'linkable') : '',
    notLinkable ? 'not-linkable' : '',
    extraClass,
  ].filter(Boolean).join(' ')

  return (
    <div
      className={cls}
      data-id={tile.id}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDoubleClick={onDoubleClick}
      onMouseDown={onMouseDown}
    >
      <span>{tile.isJoker ? '★' : tile.num}</span>
    </div>
  )
}

// ── Mini tile ────────────────────────────────────────────────
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
          const allTiles = [
            ...h.sets.flat(),
            ...(h.jrep ? [h.jrep.handTile] : []),
            ...(h.tile && !h.sets.flat().some(t => t.id === h.tile?.id) ? [h.tile] : []),
          ]
          return (
            <div
              key={i}
              className={`hint-move${i === 0 ? ' best' : ''}${!h.applicable ? ' not-applicable' : ''}`}
              onClick={() => h.applicable && onApply(h)}
            >
              <div className={`hm-badge${!h.applicable ? ' dim' : ''}`}>{h.label}</div>
              <div className="hm-desc">{h.desc}</div>
              <div className="hm-tiles">{allTiles.slice(0, 12).map((t, j) => <MT key={j} tile={t} />)}</div>
              {h.value > 0 && <div className="hm-pts">{h.value}p</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Debug Panel ──────────────────────────────────────────────
function DebugPanel({ logs }) {
  return (
    <div className="debug-panel vis">
      <h4>🐛 Debug</h4>
      {logs.slice().reverse().map((l, i) => (
        <div key={i} className={`dl ${l.type}`}>{l.msg}</div>
      ))}
    </div>
  )
}

// ── Toast ────────────────────────────────────────────────────
function Toast({ msg, type }) {
  if (!msg) return null
  return <div className={`toast ${type}`}>{msg}</div>
}

// ── Board Set ────────────────────────────────────────────────
function BoardSet({ set, si, onDrop, onDragOver, onDragLeave, isHuman, onTileDragStart, onTileDragEnd, onTileDblClick, linkableIds, prevBoardIds }) {
  const valid = isValid(set)
  const lbl = valid ? (isRun(set) ? 'run' : 'group') : '⚠ invalid'
  const hasNew = set.some(t => !prevBoardIds.has(t.id))
  const cls = ['bset', !valid ? 'invalid' : '', hasNew ? 'ai-new' : ''].filter(Boolean).join(' ')

  return (
    <div
      className={cls}
      onDragOver={e => { e.preventDefault(); onDragOver(si, e) }}
      onDragLeave={() => onDragLeave(si)}
      onDrop={e => { e.preventDefault(); onDrop(si, e) }}
    >
      <div className="bset-lbl">{lbl}</div>
      {set.map((tile, ti) => (
        <Tile
          key={tile.id}
          tile={tile}
          src="board"
          isBoard
          linkable={linkableIds.has(tile.id)}
          onDragStart={e => isHuman && onTileDragStart(e, tile, 'board', si)}
          onDragEnd={onTileDragEnd}
          onDoubleClick={() => isHuman && onTileDblClick(tile, si)}
        />
      ))}
    </div>
  )
}

// ── Main Game ────────────────────────────────────────────────
function GameScreen({ players: initPlayers }) {
  // ── State ──
  const [G, setG] = useState(() => {
    const pool = buildPool()
    const hands = initPlayers.map(() => { const h = []; for (let i = 0; i < 14; i++) h.push(pool.pop()); return h })
    return {
      pool, players: initPlayers, hands,
      board: [], hasMeld: initPlayers.map(() => false),
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
  const [bounceId, setBounceId] = useState(null)
  const [dropTargetSi, setDropTargetSi] = useState(null)

  const dragRef = useRef({ tile: null, src: null, srcSi: null })
  const longPressRef = useRef({ timer: null, active: false, startTile: null })
  const toastTimerRef = useRef(null)

  const dbg = useCallback((msg, type = 'info') => {
    if (!debugMode) return
    setDebugLogs(l => [{ msg, type, ts: Date.now() }, ...l].slice(0, 60))
  }, [debugMode])

  const showToast = useCallback((msg, type = 'error') => {
    setToast({ msg, type })
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 3000)
  }, [])

  // derived
  const board = G.pendingBoard ?? G.board
  const hand = G.pendingHand ?? G.hands[G.currentPlayer]
  const hasMeld = G.hasMeld[G.currentPlayer]
  const isHuman = G.players[G.currentPlayer].type === 'human'
  const prevBoardIds = new Set(G.board.flat().map(t => t.id))

  // linkable tiles (for lasso/hold highlight)
  const linkableIds = selectedIds.size > 0
    ? findLinkableTiles(selectedIds, hand, board)
    : new Set()

  // sorted hand + split playable/non-playable
  const sortedHand = sortHand(hand, sortMode)
  const allSets = findAllSets(sortedHand)
  const playableIds = new Set(allSets.flat().map(t => t.id))
  const playable = sortedHand.filter(t => playableIds.has(t.id))
  const rest = sortedHand.filter(t => !playableIds.has(t.id))

  // ── AI trigger ──────────────────────────────────────────────
  useEffect(() => {
    if (!isHuman && !aiRunning && G.phase !== 'end') {
      runAI()
    }
  }, [G.currentPlayer])

  async function runAI() {
    setAiRunning(true)
    const pi = G.currentPlayer
    await sleep(700)

    setG(prev => {
      const h = [...prev.hands[pi]]
      const b = prev.board.map(s => [...s])
      const result = aiPlayTurn(h, b, prev.hasMeld[pi])
      if (debugMode) {
        result.log.forEach(m => setDebugLogs(l => [{ msg: `AI: ${m}`, type: 'ok', ts: Date.now() }, ...l].slice(0, 60)))
        const v = verifyTileCount([...prev.hands.map((hh, i) => i === pi ? result.newHand : hh)], result.newBoard, prev.pool)
        setDebugLogs(l => [{ msg: `Tiles: ${v.total}/${v.expected} ${v.ok ? '✓' : '✗'}`, type: v.ok ? 'ok' : 'err', ts: Date.now() }, ...l].slice(0, 60))
      }

      if (!result.moved) {
        // draw
        const newPool = [...prev.pool]
        const newHands = prev.hands.map((hh, i) => i === pi ? [...hh] : hh)
        if (newPool.length > 0) newHands[pi] = [...newHands[pi], newPool.pop()]
        const phase = newPool.length === 0 && prev.phase !== 'final' ? 'final' : prev.phase
        const finalRoundStart = phase === 'final' && prev.phase !== 'final' ? pi : prev.finalRoundStart
        const next = (pi + 1) % prev.players.length
        return {
          ...prev, pool: newPool, hands: newHands,
          phase, finalRoundStart,
          currentPlayer: next,
          pendingBoard: null, pendingHand: null,
          aiMovedIds: new Set(),
        }
      }

      if (result.newHand.length === 0) {
        // win
        setTimeout(() => endGame(pi, result), 300)
        return prev
      }

      const prevIds = new Set(prev.board.flat().map(t => t.id))
      const moved = new Set(result.newBoard.flat().filter(t => !prevIds.has(t.id)).map(t => t.id))
      const newHasMeld = [...prev.hasMeld]
      if (result.meldAchieved) newHasMeld[pi] = true
      const newHands = prev.hands.map((hh, i) => i === pi ? result.newHand : hh)
      const next = (pi + 1) % prev.players.length
      const phase = prev.phase === 'final' && next === prev.finalRoundStart ? 'end' : prev.phase

      return {
        ...prev, board: result.newBoard, hands: newHands, hasMeld: newHasMeld,
        currentPlayer: next, pendingBoard: null, pendingHand: null,
        phase, aiMovedIds: moved,
      }
    })
    setAiRunning(false)
    setSelectedIds(new Set())
  }

  function endGame(winnerIdx, result) {
    setG(prev => {
      const newHasMeld = [...prev.hasMeld]
      if (result?.meldAchieved && winnerIdx >= 0) newHasMeld[winnerIdx] = true
      const newHands = winnerIdx >= 0
        ? prev.hands.map((hh, i) => i === winnerIdx ? [] : hh)
        : prev.hands
      const scores = prev.players.map((p, i) => ({ name: p.name, val: handVal(newHands[i]), cnt: newHands[i].length }))
      let wi = winnerIdx
      if (wi < 0) { const min = Math.min(...scores.map(s => s.val)); wi = scores.findIndex(s => s.val === min) }
      setWinner({ name: prev.players[wi].name, scores })
      return { ...prev, phase: 'end', hands: newHands, hasMeld: newHasMeld }
    })
  }

  // ── Drag handlers ────────────────────────────────────────────
  function onTileDragStart(e, tile, src, si) {
    dragRef.current = { tile, src, srcSi: si ?? null }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('id', String(tile.id))
    const ghost = e.currentTarget.cloneNode(true)
    ghost.style.cssText = `position:fixed;top:-200px;opacity:.9;pointer-events:none;`
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 21, 27)
    setTimeout(() => { ghost.remove(); e.currentTarget.classList.add('dragging') }, 0)
  }

  function onTileDragEnd(e) {
    e.currentTarget.classList.remove('dragging')
    setDropTargetSi(null)
  }

  function ensurePending(prev) {
    return {
      pendingBoard: prev.pendingBoard ?? prev.board.map(s => [...s]),
      pendingHand: prev.pendingHand ?? [...prev.hands[prev.currentPlayer]],
    }
  }

  function handleDropOnSet(si, e) {
    const { tile, src, srcSi } = dragRef.current
    if (!tile) return
    setDropTargetSi(null)
    setG(prev => {
      const { pendingBoard, pendingHand } = ensurePending(prev)
      let tsi = si
      if (src === 'hand') {
        const idx = pendingHand.findIndex(t => t.id === tile.id)
        if (idx >= 0) pendingHand.splice(idx, 1)
        setSelectedIds(s => { const n = new Set(s); n.delete(tile.id); return n })
      } else if (src === 'board' && srcSi !== null) {
        const idx = pendingBoard[srcSi].findIndex(t => t.id === tile.id)
        if (idx >= 0) pendingBoard[srcSi].splice(idx, 1)
        if (pendingBoard[srcSi].length === 0) { pendingBoard.splice(srcSi, 1); if (tsi > srcSi) tsi-- }
      }
      if (tsi < pendingBoard.length) {
        pendingBoard[tsi] = sortSet([...pendingBoard[tsi], tile])
      } else {
        pendingBoard.push([tile])
      }
      dragRef.current = { tile: null, src: null, srcSi: null }
      setBounceId(tile.id); setTimeout(() => setBounceId(null), 350)
      return { ...prev, pendingBoard, pendingHand }
    })
  }

  function handleDropNewSet() {
    const { tile, src, srcSi } = dragRef.current
    if (!tile) return
    setG(prev => {
      const { pendingBoard, pendingHand } = ensurePending(prev)
      if (src === 'hand') {
        const idx = pendingHand.findIndex(t => t.id === tile.id)
        if (idx >= 0) pendingHand.splice(idx, 1)
        setSelectedIds(s => { const n = new Set(s); n.delete(tile.id); return n })
      } else if (src === 'board' && srcSi !== null) {
        const idx = pendingBoard[srcSi].findIndex(t => t.id === tile.id)
        if (idx >= 0) pendingBoard[srcSi].splice(idx, 1)
        if (pendingBoard[srcSi].length === 0) pendingBoard.splice(srcSi, 1)
      }
      pendingBoard.push([tile])
      dragRef.current = { tile: null, src: null, srcSi: null }
      return { ...prev, pendingBoard, pendingHand }
    })
  }

  // ── Click / double-click ─────────────────────────────────────
  function handleTileClick(e, tile) {
    e.stopPropagation()
    setSelectedIds(prev => {
      const n = new Set(prev)
      n.has(tile.id) ? n.delete(tile.id) : n.add(tile.id)
      return n
    })
  }

  function handleTileDblClick(e, tile) {
    e.stopPropagation(); e.preventDefault()
    autoPlace(tile)
  }

  function autoPlace(tile) {
    setG(prev => {
      const { pendingBoard, pendingHand } = ensurePending(prev)
      // Try board extension
      const exts = findExtensions([tile], pendingBoard)
      if (exts.length) {
        const ext = exts[0]
        const idx = pendingHand.findIndex(t => t.id === tile.id); if (idx >= 0) pendingHand.splice(idx, 1)
        if (ext.pos === 'start') pendingBoard[ext.si] = sortSet([tile, ...pendingBoard[ext.si]])
        else pendingBoard[ext.si] = sortSet([...pendingBoard[ext.si], tile])
        setSelectedIds(s => { const n = new Set(s); n.delete(tile.id); return n })
        setBounceId(tile.id); setTimeout(() => setBounceId(null), 350)
        return { ...prev, pendingBoard, pendingHand }
      }
      // Try new set with selected tiles
      const pool = [...new Set([tile.id, ...selectedIds])].map(id => pendingHand.find(t => t.id === id)).filter(Boolean)
      const sets = findAllSets(pool).filter(s => s.some(t => t.id === tile.id)).sort((a, b) => b.length - a.length)
      if (sets.length) {
        const best = sets[0]
        const ids = new Set(best.map(t => t.id))
        ids.forEach(id => { const i = pendingHand.findIndex(t => t.id === id); if (i >= 0) pendingHand.splice(i, 1) })
        pendingBoard.push(sortSet(best))
        setSelectedIds(s => { const n = new Set(s); ids.forEach(id => n.delete(id)); return n })
        return { ...prev, pendingBoard, pendingHand }
      }
      showToast('No valid placement — select more tiles first', 'info')
      return prev
    })
  }

  function returnToHand(tile, si) {
    if (prevBoardIds.has(tile.id)) { showToast('Cannot return original board tiles to hand'); return }
    setG(prev => {
      const { pendingBoard, pendingHand } = ensurePending(prev)
      const idx = pendingBoard[si].findIndex(t => t.id === tile.id)
      if (idx >= 0) pendingBoard[si].splice(idx, 1)
      if (pendingBoard[si].length === 0) pendingBoard.splice(si, 1)
      pendingHand.push(tile)
      return { ...prev, pendingBoard, pendingHand }
    })
  }

  // ── Long press (lasso) ───────────────────────────────────────
  function startLongPress(tile) {
    longPressRef.current.timer = setTimeout(() => {
      longPressRef.current.active = true
      longPressRef.current.startTile = tile
      // Start with this tile selected
      setSelectedIds(new Set([tile.id]))
      // Sweep
      const sorted = sortHand(hand, sortMode)
      const startIdx = sorted.findIndex(t => t.id === tile.id)
      const allTiles = [...hand, ...board.flat()]
      let i = startIdx + 1
      const iv = setInterval(() => {
        if (!longPressRef.current.active || i >= sorted.length) { clearInterval(iv); return }
        const t = sorted[i]
        setSelectedIds(prev => {
          // Only add if linkable to current selection
          const linked = findLinkableTiles(prev, allTiles, board)
          if (linked.has(t.id) || prev.size === 0) {
            const n = new Set(prev); n.add(t.id); return n
          }
          return prev
        })
        i++
      }, 130)
      longPressRef.current.interval = iv
    }, 400)
  }

  function endLongPress() {
    clearTimeout(longPressRef.current.timer)
    clearInterval(longPressRef.current.interval)
    longPressRef.current.active = false
  }

  // ── Confirm / Reset / Draw ───────────────────────────────────
  function handleConfirm() {
    const pi = G.currentPlayer
    const nb = G.pendingBoard ?? G.board
    const nh = G.pendingHand ?? G.hands[pi]

    if (!isValidBoard(nb)) { showToast('Board has invalid sets!'); return }

    const prevIds = new Set(G.board.flat().map(t => t.id))
    const newIds = new Set(nb.flat().map(t => t.id))
    const placed = [...newIds].filter(id => !prevIds.has(id))
    if (placed.length === 0) { showToast('Place at least one tile, or Draw & Pass'); return }

    const newHandIds = new Set(nh.map(t => t.id))
    if ([...prevIds].some(id => !newIds.has(id) && newHandIds.has(id))) {
      showToast('Cannot take board tiles back to hand!'); return
    }

    let newHasMeld = [...G.hasMeld]
    if (!newHasMeld[pi]) {
      const placedTiles = G.hands[pi].filter(t => placed.includes(t.id))
      const v = placedTiles.reduce((s, t) => s + tileVal(t), 0)
      if (v < 30) { showToast(`Initial meld needs 30+ pts. You placed ${v} pts.`); return }
      newHasMeld[pi] = true
    }

    setG(prev => {
      const newHands = prev.hands.map((h, i) => i === pi ? nh : h)
      if (nh.length === 0) { setTimeout(() => endGame(pi, null), 100); return prev }
      const next = (pi + 1) % prev.players.length
      const phase = prev.phase === 'final' && next === prev.finalRoundStart ? 'end' : prev.phase
      if (debugMode) {
        const v = verifyTileCount(newHands, nb, prev.pool)
        setDebugLogs(l => [{ msg: `Confirm: tiles ${v.total}/${v.expected} ${v.ok ? '✓' : '✗ ERROR'}`, type: v.ok ? 'ok' : 'err', ts: Date.now() }, ...l])
      }
      return { ...prev, board: nb, hands: newHands, hasMeld: newHasMeld, currentPlayer: next, pendingBoard: null, pendingHand: null, phase, aiMovedIds: new Set() }
    })
    setSelectedIds(new Set())
    setShowHint(false)
  }

  function handleReset() {
    setG(prev => ({ ...prev, pendingBoard: null, pendingHand: null }))
    setSelectedIds(new Set())
  }

  function handleDraw() {
    const pi = G.currentPlayer
    setG(prev => {
      const newPool = [...prev.pool]
      const newHands = prev.hands.map((h, i) => i === pi ? [...h] : h)
      if (newPool.length > 0) newHands[pi] = [...newHands[pi], newPool.pop()]
      const phase = newPool.length === 0 && prev.phase !== 'final' ? 'final' : prev.phase
      const finalRoundStart = phase === 'final' && prev.phase !== 'final' ? pi : prev.finalRoundStart
      const next = (pi + 1) % prev.players.length
      if (debugMode) {
        const v = verifyTileCount(newHands, prev.board, newPool)
        setDebugLogs(l => [{ msg: `Draw: tiles ${v.total}/${v.expected} ${v.ok ? '✓' : '✗'}`, type: v.ok ? 'ok' : 'err', ts: Date.now() }, ...l])
      }
      return { ...prev, pool: newPool, hands: newHands, phase, finalRoundStart, currentPlayer: next, pendingBoard: null, pendingHand: null, aiMovedIds: new Set() }
    })
    setSelectedIds(new Set())
    setShowHint(false)
  }

  // ── Hint ─────────────────────────────────────────────────────
  function handleHint() {
    const h = computeHints(hand, board, hasMeld)
    setHints(h)
    setShowHint(true)
  }

  function applyHint(hint) {
    setG(prev => {
      const { pendingBoard, pendingHand } = ensurePending(prev)

      if (hint.sets.length > 0) {
        const ids = new Set(hint.sets.flat().map(t => t.id))
        ids.forEach(id => { const i = pendingHand.findIndex(t => t.id === id); if (i >= 0) pendingHand.splice(i, 1) })
        hint.sets.forEach(s => pendingBoard.push(sortSet(s)))
        setSelectedIds(s => { const n = new Set(s); ids.forEach(id => n.delete(id)); return n })
      }
      if (hint.exts?.length > 0) {
        const ext = hint.exts[0]
        const i = pendingHand.findIndex(t => t.id === ext.tile.id); if (i >= 0) pendingHand.splice(i, 1)
        if (ext.pos === 'start') pendingBoard[ext.si] = sortSet([ext.tile, ...pendingBoard[ext.si]])
        else pendingBoard[ext.si] = sortSet([...pendingBoard[ext.si], ext.tile])
        setSelectedIds(s => { const n = new Set(s); n.delete(ext.tile.id); return n })
      }
      if (hint.jrep) {
        const { si, ji, handTile, joker } = hint.jrep
        pendingBoard[si][ji] = handTile
        const i = pendingHand.findIndex(t => t.id === handTile.id); if (i >= 0) pendingHand.splice(i, 1)
        pendingHand.push(joker)
        setSelectedIds(s => { const n = new Set(s); n.delete(handTile.id); return n })
      }
      if (hint.splits?.length > 0) {
        const sp = hint.splits[0]
        const i = pendingHand.findIndex(t => t.id === sp.tile.id); if (i >= 0) pendingHand.splice(i, 1)
        pendingBoard.splice(sp.si, 1, sp.left, sp.right)
        setSelectedIds(s => { const n = new Set(s); n.delete(sp.tile.id); return n })
      }
      return { ...prev, pendingBoard, pendingHand }
    })
    setShowHint(false)
  }

  function playSuggestion(set) {
    setG(prev => {
      const { pendingBoard, pendingHand } = ensurePending(prev)
      const ids = new Set(set.map(t => t.id))
      ids.forEach(id => { const i = pendingHand.findIndex(t => t.id === id); if (i >= 0) pendingHand.splice(i, 1) })
      pendingBoard.push(sortSet(set))
      setSelectedIds(s => { const n = new Set(s); ids.forEach(id => n.delete(id)); return n })
      return { ...prev, pendingBoard, pendingHand }
    })
  }

  // Suggestions (quick sets)
  const suggs = findAllSets(hand).sort((a, b) => b.length - a.length || b.reduce((s, t) => s + tileVal(t), 0) - a.reduce((s, t) => s + tileVal(t), 0)).slice(0, 10)

  // ── Render ────────────────────────────────────────────────────
  if (winner) {
    return (
      <div className="win-screen vis">
        <div className="win-title">🏆 WINNER!</div>
        <div className="win-sub">{winner.name} wins!</div>
        <div className="score-tbl">
          {[...winner.scores].sort((a, b) => a.val - b.val).map((s, i) => (
            <div className="score-row" key={i}>
              <span className="sr-pos">{i + 1}.</span>
              <span>{s.name}</span>
              <span>{s.cnt} tiles</span>
              <span style={{ color: i === 0 ? '#f4c430' : 'rgba(255,255,255,.5)' }}>-{s.val}pts</span>
            </div>
          ))}
        </div>
        <button className="btn" style={{ marginTop: 14, padding: '10px 28px', fontSize: 14 }} onClick={() => window.location.reload()}>Play Again</button>
      </div>
    )
  }

  return (
    <div className="game">
      {/* Header */}
      <div className="g-header">
        <div className="g-logo">R</div>
        <div className="ptabs">
          {G.players.map((p, i) => (
            <div key={i} className={`ptab${i === G.currentPlayer ? ' cur' : ''}${G.phase === 'final' ? ' last' : ''}`}>
              {p.name}<span className="tc">{G.hands[i].length}🀫</span>
              {!G.hasMeld[i] && <span style={{ color: '#f07070', fontSize: 8, marginLeft: 2 }}>no meld</span>}
            </div>
          ))}
        </div>
        <div className="pool-info">Pool: {G.pool.length}</div>
        <button className={`debug-toggle${debugMode ? ' on' : ''}`} onClick={() => setDebugMode(d => !d)}>DEBUG</button>
      </div>

      {/* Board */}
      <div
        className="board-area"
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); if (e.target === e.currentTarget || e.target.classList.contains('board-sets')) handleDropNewSet() }}
        onClick={() => setShowHint(false)}
      >
        <div className={`lt-banner${G.phase === 'final' ? ' vis' : ''}`}>⚠ LAST TURN — Pool empty!</div>
        <div className="board-sets">
          {board.map((set, si) => (
            <BoardSet
              key={si} set={set} si={si}
              onDrop={handleDropOnSet}
              onDragOver={(si) => setDropTargetSi(si)}
              onDragLeave={() => setDropTargetSi(null)}
              isHuman={isHuman}
              onTileDragStart={onTileDragStart}
              onTileDragEnd={onTileDragEnd}
              onTileDblClick={returnToHand}
              linkableIds={linkableIds}
              prevBoardIds={prevBoardIds}
            />
          ))}
          <div
            className="new-set-zone"
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over') }}
            onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
            onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); handleDropNewSet() }}
          >+ New Set</div>
        </div>
      </div>

      {/* Bottom */}
      <div className="bottom">
        <div className="action-bar">
          <div className="turn-info">{G.players[G.currentPlayer].name}'s Turn</div>
          <div className="sort-ctrl">
            <button className={`sort-btn${sortMode === 'color' ? ' on' : ''}`} onClick={() => setSortMode('color')}>🎨 Color</button>
            <button className={`sort-btn${sortMode === 'num' ? ' on' : ''}`} onClick={() => setSortMode('num')}>🔢 Number</button>
          </div>
          <button className="btn btn-gold" disabled={!isHuman} onClick={handleHint}>💡 Hint</button>
          <button className="btn" disabled={!isHuman} onClick={handleReset}>↺ Reset</button>
          <button className="btn btn-red" disabled={!isHuman} onClick={handleDraw}>Draw</button>
          <button className="btn btn-green" disabled={!isHuman} onClick={handleConfirm}>✓ Confirm</button>
        </div>

        <div className="hand-lbl">{isHuman ? 'Your Tiles' : `${G.players[G.currentPlayer].name}'s Tiles`}</div>

        {/* Suggestions */}
        {isHuman && (
          <div className="sugg-strip">
            {suggs.map((set, i) => {
              const v = set.reduce((s, t) => s + tileVal(t), 0)
              const can = hasMeld || v >= 30
              return (
                <div key={i} className={`sugg-set${can ? '' : ' dimmed'}`} onClick={() => can && playSuggestion(set)}>
                  {set.map((t, j) => <MT key={j} tile={t} />)}
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', marginLeft: 3 }}>{v}p</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Hand rack */}
        <div className="hand-rack">
          {playable.map(tile => (
            <Tile
              key={tile.id}
              tile={tile}
              src="hand"
              selected={selectedIds.has(tile.id)}
              linkable={!selectedIds.has(tile.id) && linkableIds.has(tile.id)}
              notLinkable={selectedIds.size > 0 && !selectedIds.has(tile.id) && !linkableIds.has(tile.id)}
              extraClass={tile.id === bounceId ? 'bounce' : ''}
              onDragStart={e => isHuman && onTileDragStart(e, tile, 'hand', undefined)}
              onDragEnd={onTileDragEnd}
              onDoubleClick={e => isHuman && handleTileDblClick(e, tile)}
              onMouseDown={e => { if (isHuman && e.button === 0) { handleTileClick(e, tile); startLongPress(tile) } }}
            />
          ))}
          {playable.length > 0 && rest.length > 0 && <div className="hand-sep" />}
          {rest.map(tile => (
            <Tile
              key={tile.id}
              tile={tile}
              src="hand"
              selected={selectedIds.has(tile.id)}
              linkable={!selectedIds.has(tile.id) && linkableIds.has(tile.id)}
              notLinkable={selectedIds.size > 0 && !selectedIds.has(tile.id) && !linkableIds.has(tile.id)}
              extraClass={tile.id === bounceId ? 'bounce' : ''}
              onDragStart={e => isHuman && onTileDragStart(e, tile, 'hand', undefined)}
              onDragEnd={onTileDragEnd}
              onDoubleClick={e => isHuman && handleTileDblClick(e, tile)}
              onMouseDown={e => { if (isHuman && e.button === 0) { handleTileClick(e, tile); startLongPress(tile) } }}
            />
          ))}
        </div>
      </div>

      {/* Overlays */}
      {aiRunning && (
        <div className="ai-overlay vis">
          <div className="ai-name">{G.players[G.currentPlayer].name} thinking…</div>
          <div className="ai-spin" />
        </div>
      )}
      {showHint && <HintPanel hints={hints} onClose={() => setShowHint(false)} onApply={applyHint} />}
      {toast && <Toast msg={toast.msg} type={toast.type} />}
      {debugMode && <DebugPanel logs={debugLogs} />}
    </div>
  )
}

// ── Root App ──────────────────────────────────────────────────
export default function App() {
  const [players, setPlayers] = useState(null)
  if (!players) return <SetupScreen onStart={setPlayers} />
  return <GameScreen players={players} />
}
