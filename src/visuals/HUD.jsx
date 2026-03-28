import React from 'react';

export default function HUD({ score, bpm, combo, maxCombo, rating, energy }) {
  // Add a quick animation trigger class based on rating
  
  return (
    <div className="active-session" style={{ display: 'flex', flexDirection: 'column', position: 'absolute', top: 0, left: 0, right: 0, padding: '2rem', zIndex: 10, pointerEvents: 'none' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
         <div className="glass-panel" style={{ padding: '1rem 2rem' }}>
            <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Score</h3>
            <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>{score.toLocaleString()}</div>
         </div>
         
         <div className="glass-panel" style={{ padding: '1rem 2rem', textAlign: 'center' }}>
            <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Current BPM</h3>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--accent-color)' }}>
              {bpm > 0 ? Math.round(bpm) : '--'}
            </div>
         </div>

         <div className="glass-panel" style={{ padding: '1rem 2rem', textAlign: 'right' }}>
            <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Combo</h3>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: combo > 10 ? '#FFD700' : '#fff' }}>
              {combo > 0 ? `${combo}x` : '--'}
            </div>
         </div>
      </header>
      
      {/* Sub-header for AI interpretations */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '1rem', zIndex: 10 }}>
        <div className="glass-panel" style={{ padding: '0.5rem 1.5rem', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>ENERGY</span>
            <div style={{ width: '100px', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${(energy/10)*100}%`, height: '100%', background: 'var(--accent-color)' }}></div>
            </div>
            <span style={{ fontWeight: 600, minWidth: '40px' }}>{energy}/10</span>
        </div>
      </div>
      
      {/* Floating Rating text if recently scored */}
      {rating && (
        <div style={{ 
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', 
          fontSize: '4.5rem', fontWeight: 900, textTransform: 'uppercase', 
          color: rating === 'perfect' ? '#FFD700' : rating === 'great' ? '#00BFFF' : rating === 'good' ? '#00FF00' : '#FF0000',
          textShadow: '0px 0px 30px rgba(0,0,0,0.6)', pointerEvents: 'none', zIndex: 20,
          animation: 'splashPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards'
        }}>
          <div style={{ fontSize: '1.5rem', opacity: 0.8, textAlign: 'center' }}>DRIBBLE DETECTED</div>
          <div style={{ textAlign: 'center' }}>{rating}!</div>
          <style>{`
            @keyframes splashPop {
              0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
              50% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
              100% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
