import React from 'react';

const ZONES = [
  { label: 'FAILING', color: '#FF2222', angle: -72 },
  { label: 'BAD',     color: '#FF8800', angle: -36 },
  { label: 'OK',      color: '#00BFFF', angle: 0 },
  { label: 'GREAT',   color: '#00FF88', angle: 36 },
  { label: 'ON FIRE', color: '#FFD700', angle: 72 },
];

function getZone(value) {
  if (value >= 80) return ZONES[4];
  if (value >= 60) return ZONES[3];
  if (value >= 40) return ZONES[2];
  if (value >= 20) return ZONES[1];
  return ZONES[0];
}

// Map meter 0-100 to needle angle -90 to +90 degrees
function meterToAngle(meter) {
  return ((meter / 100) * 180) - 90;
}

const LAYER_LABELS = ['DRUMS', 'BASS', 'SYNTH', 'LEAD'];

export default function HUD({ score, bpm, combo, maxCombo, rating, energy, meter = 50 }) {
  const zone = getZone(meter);
  const needleAngle = meterToAngle(meter);
  const isOnFire = meter >= 80;

  const activeLayers = [true, meter >= 25, meter >= 50, meter >= 75];

  return (
    <>
      <style>{`
        @keyframes needle-glow-pulse {
          0%, 100% { filter: drop-shadow(0 0 6px ${zone.color}80); }
          50% { filter: drop-shadow(0 0 14px ${zone.color}) drop-shadow(0 0 28px ${zone.color}60); }
        }
        @keyframes fire-particles {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-20px) scale(0.3); }
        }
        @keyframes diamond-pulse {
          0%, 100% { transform: translate(-50%, -50%) rotate(45deg) scale(1); }
          50% { transform: translate(-50%, -50%) rotate(45deg) scale(1.15); }
        }
        @keyframes label-glow {
          0%, 100% { text-shadow: 0 0 8px ${zone.color}80; }
          50% { text-shadow: 0 0 16px ${zone.color}, 0 0 32px ${zone.color}60; }
        }
        @keyframes rating-pop {
          0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
          30% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 0.85; }
        }
      `}</style>

      <div className="active-session" style={{ display: 'flex', flexDirection: 'column', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, padding: '2rem', zIndex: 10, pointerEvents: 'none' }}>
        {/* Top stats */}
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

        {/* ── DIAMOND NEEDLE METER ── */}
        <div style={{
          position: 'absolute',
          right: '1.5rem',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '200px',
          height: '260px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          {/* Gauge */}
          <div style={{ position: 'relative', width: '200px', height: '120px', overflow: 'hidden' }}>
            {/* SVG Arc Gauge */}
            <svg viewBox="0 0 200 120" style={{ width: '100%', height: '100%' }}>
              {/* Background arc segments */}
              {ZONES.map((z, i) => {
                const startAngle = -90 + (i * 36);
                const endAngle = startAngle + 36;
                const startRad = (startAngle * Math.PI) / 180;
                const endRad = (endAngle * Math.PI) / 180;
                const r = 80;
                const cx = 100, cy = 105;
                const x1 = cx + r * Math.cos(startRad);
                const y1 = cy + r * Math.sin(startRad);
                const x2 = cx + r * Math.cos(endRad);
                const y2 = cy + r * Math.sin(endRad);
                const isActive = meter >= i * 20;
                return (
                  <path
                    key={i}
                    d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
                    fill="none"
                    stroke={isActive ? z.color : 'rgba(255,255,255,0.08)'}
                    strokeWidth={isActive ? 10 : 6}
                    strokeLinecap="round"
                    style={{
                      filter: isActive ? `drop-shadow(0 0 4px ${z.color}80)` : 'none',
                      transition: 'all 0.3s ease',
                    }}
                  />
                );
              })}

              {/* Tick marks */}
              {[0, 20, 40, 60, 80, 100].map((tick) => {
                const angle = ((tick / 100) * 180 - 90) * Math.PI / 180;
                const cx = 100, cy = 105, r1 = 66, r2 = 72;
                return (
                  <line
                    key={tick}
                    x1={cx + r1 * Math.cos(angle)}
                    y1={cy + r1 * Math.sin(angle)}
                    x2={cx + r2 * Math.cos(angle)}
                    y2={cy + r2 * Math.sin(angle)}
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                );
              })}

              {/* Needle */}
              <g style={{
                transform: `rotate(${needleAngle}deg)`,
                transformOrigin: '100px 105px',
                transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}>
                {/* Needle shadow */}
                <line
                  x1="100" y1="105" x2="100" y2="30"
                  stroke="rgba(0,0,0,0.3)" strokeWidth="4" strokeLinecap="round"
                />
                {/* Needle body */}
                <line
                  x1="100" y1="105" x2="100" y2="32"
                  stroke={zone.color} strokeWidth="3" strokeLinecap="round"
                  style={{
                    filter: `drop-shadow(0 0 6px ${zone.color}80)`,
                    animation: isOnFire ? 'needle-glow-pulse 0.8s ease infinite' : 'none',
                  }}
                />
                {/* Needle tip — diamond shape */}
                <polygon
                  points="100,26 96,32 100,38 104,32"
                  fill={zone.color}
                  style={{ filter: `drop-shadow(0 0 4px ${zone.color})` }}
                />
              </g>

              {/* Center pivot */}
              <circle cx="100" cy="105" r="8" fill="#1a1a2e" stroke={zone.color} strokeWidth="2"
                style={{ filter: `drop-shadow(0 0 6px ${zone.color}60)` }}
              />
              <circle cx="100" cy="105" r="3" fill={zone.color} />
            </svg>

            {/* Fire particles when on fire */}
            {isOnFire && Array.from({ length: 6 }, (_, i) => (
              <div key={i} style={{
                position: 'absolute',
                bottom: '10px',
                left: `${40 + Math.random() * 60}%`,
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                background: '#FFD700',
                animation: `fire-particles ${0.6 + Math.random() * 0.8}s ease-out infinite`,
                animationDelay: `${i * 0.15}s`,
              }} />
            ))}
          </div>

          {/* Diamond with number */}
          <div style={{ position: 'relative', marginTop: '-10px' }}>
            <div style={{
              width: '52px',
              height: '52px',
              background: `linear-gradient(135deg, ${zone.color}30, ${zone.color}10)`,
              border: `2px solid ${zone.color}`,
              borderRadius: '4px',
              transform: 'translate(-50%, -50%) rotate(45deg)',
              position: 'absolute',
              left: '50%',
              top: '50%',
              boxShadow: `0 0 15px ${zone.color}40, inset 0 0 15px ${zone.color}15`,
              animation: isOnFire ? 'diamond-pulse 1s ease infinite' : 'none',
              transition: 'border-color 0.5s ease, box-shadow 0.5s ease',
            }} />
            <div style={{
              position: 'relative',
              width: '52px',
              height: '52px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
            }}>
              <span style={{
                fontSize: '1.5rem',
                fontWeight: 900,
                color: '#fff',
                textShadow: `0 0 10px ${zone.color}, 0 2px 6px rgba(0,0,0,0.8)`,
              }}>
                {Math.round(meter)}
              </span>
            </div>
          </div>

          {/* Status label */}
          <div style={{
            marginTop: '22px',
            fontSize: '0.85rem',
            fontWeight: 900,
            letterSpacing: '0.2em',
            color: zone.color,
            textTransform: 'uppercase',
            animation: isOnFire ? 'label-glow 0.6s ease infinite' : 'none',
            textShadow: `0 0 8px ${zone.color}60`,
          }}>
            {zone.label}
          </div>

          {/* Layer indicators */}
          <div style={{
            display: 'flex',
            gap: '6px',
            marginTop: '10px',
          }}>
            {LAYER_LABELS.map((label, i) => {
              const active = activeLayers[i];
              return (
                <div key={label} style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.55rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: active ? zone.color : 'rgba(255,255,255,0.25)',
                  background: active ? `${zone.color}15` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${active ? zone.color + '40' : 'rgba(255,255,255,0.06)'}`,
                  transition: 'all 0.5s ease',
                  textShadow: active ? `0 0 6px ${zone.color}60` : 'none',
                }}>
                  {label}
                </div>
              );
            })}
          </div>
        </div>

        {/* Floating Rating */}
        {rating && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            fontSize: '4.5rem', fontWeight: 900, textTransform: 'uppercase',
            color: rating === 'perfect' ? '#FFD700' : rating === 'great' ? '#00BFFF' : rating === 'good' ? '#00FF88' : '#FF2222',
            textShadow: `0 0 30px ${rating === 'perfect' ? '#FFD700' : rating === 'great' ? '#00BFFF' : rating === 'good' ? '#00FF88' : '#FF2222'}80`,
            pointerEvents: 'none', zIndex: 20,
            animation: 'rating-pop 0.4s ease forwards',
          }}>
            {rating}!
          </div>
        )}
      </div>
    </>
  );
}
