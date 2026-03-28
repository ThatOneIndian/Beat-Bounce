export default function HUD({ score, bpm, combo, maxCombo, rating, energy }) {
  const isSynced = bpm > 0 && Math.round(bpm) >= 90; // Logic for sync glow
  
  return (
    <div className="active-session" style={{ display: 'flex', flexDirection: 'column', position: 'absolute', top: 0, left: 0, right: 0, padding: '2rem', zIndex: 10, pointerEvents: 'none' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
         <div className="glass-panel" style={{ padding: '1rem 2rem', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '2px' }}>Score</h3>
            <div style={{ fontSize: '3rem', fontWeight: 900 }}>{score.toLocaleString()}</div>
         </div>
         
         <div className="glass-panel" style={{ 
           padding: '1rem 2rem', textAlign: 'center', 
           boxShadow: isSynced ? '0 0 40px rgba(255, 215, 0, 0.2)' : 'none',
           borderColor: isSynced ? 'rgba(255, 215, 0, 0.4)' : 'rgba(255,255,255,0.1)'
         }}>
            <h3 style={{ margin: 0, color: isSynced ? '#FFD700' : 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '2px' }}>
              {isSynced ? '✨ IN SYNC ✨' : 'Current BPM'}
            </h3>
            <div style={{ fontSize: '3.5rem', fontWeight: 900, color: isSynced ? '#FFD700' : 'var(--accent-color)' }}>
              {bpm > 0 ? Math.round(bpm) : '--'}
            </div>
         </div>
 
         <div className="glass-panel" style={{ padding: '1rem 2rem', textAlign: 'right', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '2px' }}>Combo</h3>
            <div style={{ fontSize: '3rem', fontWeight: 900, color: combo > 10 ? '#FFD700' : '#fff' }}>
              {combo > 0 ? `${combo}x` : '--'}
            </div>
         </div>
      </header>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
        <div className="glass-panel" style={{ padding: '0.5rem 1.5rem', display: 'flex', gap: '15px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 800, letterSpacing: '1px' }}>ENERGY</span>
            <div style={{ width: '150px', height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ width: `${(energy/10)*100}%`, height: '100%', background: 'linear-gradient(90deg, #00FFCC, #00BFFF)', boxShadow: '0 0 10px #00FFCC' }}></div>
            </div>
            <span style={{ fontWeight: 800, fontSize: '1.2rem' }}>{energy}</span>
        </div>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
             Flick wrist downward on the beat
        </p>
      </div>
    </div>
  );
}
