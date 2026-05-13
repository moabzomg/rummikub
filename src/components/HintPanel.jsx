import React from 'react';

const BADGE_COLORS = { MELD:'#f4c430', BEST:'#22c87a', SET:'rgba(34,200,122,.6)', EXTEND:'#1a6fe8', JOKER:'#9b59b6', SPLIT:'#e87a1a', 'NO MELD':'rgba(255,255,255,.25)', DRAW:'rgba(255,255,255,.15)' };

export default function HintPanel({ hints, onApply, onClose }) {
  if (!hints || !hints.length) return null;
  return (
    <div className="hint-panel">
      <div className="hint-hdr">
        <div className="hint-title">💡 BEST MOVES</div>
        <button className="hint-close" onClick={onClose}>✕</button>
      </div>
      <div className="hint-moves">
        {hints.map((hint, idx) => {
          const isBest = idx === 0 && hint.applicable;
          const seen = new Set();
          const allT = [];
          const addTile = (t) => { if (t && !seen.has(t.id)) { seen.add(t.id); allT.push(t); } };
          hint.sets.flat().forEach(addTile);
          if (hint.jrep) addTile(hint.jrep.handTile);
          if (hint.tile) addTile(hint.tile);
          if (hint.splits) hint.splits.forEach(sp => addTile(sp.tile));
          if (hint.exts) hint.exts.forEach(e => addTile(e.tile));

          const badgeBg = BADGE_COLORS[hint.label] || 'rgba(255,255,255,.2)';
          const badgeColor = ['MELD','BEST'].includes(hint.label) ? '#000' : '#fff';

          // Group sets visually
          const tilesBySet = hint.sets.map(set => {
            const setSeen = new Set();
            return set.filter(t => { if (setSeen.has(t.id)) return false; setSeen.add(t.id); return true; });
          }).filter(s => s.length > 0);

          return (
            <div key={idx} className={['hint-move', isBest?'best':'', !hint.applicable?'not-applicable':''].filter(Boolean).join(' ')}
              onClick={() => hint.applicable && onApply(hint)}>
              <div className="hm-badge" style={{background:badgeBg, color:badgeColor}}>{hint.label}</div>
              <div style={{flex:1}}>
                <div className="hm-desc">{hint.desc}</div>
                <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginTop:'4px',alignItems:'center'}}>
                  {tilesBySet.map((setTiles, si) => (
                    <React.Fragment key={si}>
                      {si > 0 && <div style={{width:'1px',height:'28px',background:'rgba(255,255,255,.2)',flexShrink:0}} />}
                      <div style={{display:'flex',gap:'2px'}}>
                        {setTiles.map(t => (
                          <div key={t.id} className={'mt c-'+t.color}>{t.isJoker ? '☺' : t.num}</div>
                        ))}
                      </div>
                    </React.Fragment>
                  ))}
                  {/* Extra tiles not in sets */}
                  {allT.filter(t => !hint.sets.flat().some(s => s.id === t.id)).map(t => (
                    <div key={t.id} className={'mt c-'+t.color}>{t.isJoker ? '☺' : t.num}</div>
                  ))}
                </div>
              </div>
              {hint.value > 0 && <div className="hm-pts">{hint.value}p</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
