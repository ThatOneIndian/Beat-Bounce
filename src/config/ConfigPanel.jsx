import { useState, useRef, useEffect } from 'react';

function ConfigPanel({ initialConfig, onStart, mediaStream }) {
  const [config, setConfig] = useState(initialConfig);
  const localVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && mediaStream) {
      localVideoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);

  const updateConfig = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const toggleInstrument = (inst) => {
    setConfig(prev => {
      const isSelected = prev.instruments.includes(inst);
      return {
        ...prev,
        instruments: isSelected 
          ? prev.instruments.filter(i => i !== inst)
          : [...prev.instruments, inst]
      };
    });
  };

  return (
    <div style={{ display: 'flex', gap: '2rem', height: 'calc(100vh - 4rem)' }}>
      {/* Left side: Camera Preview */}
      <div className="glass-panel" style={{ flex: '1', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ marginBottom: '1rem', color: 'var(--accent-color)' }}>MuseMotion</h2>
        <div style={{ 
          flex: 1, 
          background: '#000', 
          borderRadius: '12px', 
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}>
          {/* We mirror the video source from the App.jsx here to avoid requesting permissions twice */}
          <video 
            ref={localVideoRef} 
            autoPlay 
            playsInline 
            muted 
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
          ></video>
          <div style={{ position: 'absolute', bottom: 16, left: 16, display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#0f0', boxShadow: '0 0 8px #0f0' }}></div>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Tracking Active</span>
          </div>
        </div>
      </div>

      {/* Right side: Configuration */}
      <div className="glass-panel" style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '2rem', overflowY: 'auto' }}>
        
        {/* Genre */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>GENRE</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {['hip-hop', 'edm', 'lo-fi', 'pop'].map(g => (
              <button 
                key={g} 
                onClick={() => updateConfig('genre', g)}
                style={{
                  background: config.genre === g ? 'var(--accent-color)' : 'transparent',
                  color: config.genre === g ? '#000' : '#fff',
                  border: `1px solid ${config.genre === g ? 'var(--accent-color)' : 'var(--panel-border)'}`,
                  padding: '6px 16px', borderRadius: '20px', cursor: 'pointer', fontWeight: 600,
                  transition: 'all 0.2s'
                }}
              >
                {g.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Energy */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>ENERGY</label>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{config.energy}/10</span>
          </div>
          <input 
            type="range" min="1" max="10" 
            value={config.energy}
            onChange={(e) => updateConfig('energy', parseInt(e.target.value))}
            className="input-range"
          />
        </div>

        {/* Tempo */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>TEMPO (BPM)</label>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{config.tempo_range.min} - {config.tempo_range.max}</span>
          </div>
          {/* Fallback to text inputs for dual range */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
             <input 
               type="number" value={config.tempo_range.min} 
               onChange={e => updateConfig('tempo_range', {...config.tempo_range, min: parseInt(e.target.value)})}
               style={{ width: '80px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px', borderRadius: '6px' }}
             />
             <span>to</span>
             <input 
               type="number" value={config.tempo_range.max} 
               onChange={e => updateConfig('tempo_range', {...config.tempo_range, max: parseInt(e.target.value)})}
               style={{ width: '80px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px', borderRadius: '6px' }}
             />
          </div>
        </div>

        {/* Mood */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>MOOD</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {['aggressive', 'upbeat', 'chill'].map(m => (
              <button 
                key={m} 
                onClick={() => updateConfig('mood', m)}
                style={{
                  background: config.mood === m ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                  color: '#fff',
                  border: '1px solid var(--panel-border)',
                  padding: '6px 16px', borderRadius: '20px', cursor: 'pointer', fontWeight: 600,
                  transition: 'all 0.2s'
                }}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>DURATION</label>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              {config.duration_seconds >= 60
                ? `${Math.floor(config.duration_seconds / 60)}m ${config.duration_seconds % 60 ? config.duration_seconds % 60 + 's' : ''}`
                : `${config.duration_seconds}s`}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[30, 60, 90, 120, 180].map(s => (
              <button
                key={s}
                onClick={() => updateConfig('duration_seconds', s)}
                style={{
                  background: config.duration_seconds === s ? 'var(--accent-color)' : 'transparent',
                  color: config.duration_seconds === s ? '#000' : '#fff',
                  border: `1px solid ${config.duration_seconds === s ? 'var(--accent-color)' : 'var(--panel-border)'}`,
                  padding: '6px 16px', borderRadius: '20px', cursor: 'pointer', fontWeight: 600,
                  transition: 'all 0.2s'
                }}
              >
                {s >= 60 ? `${s / 60}m` : `${s}s`}
              </button>
            ))}
          </div>
        </div>

        {/* Instruments */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>INSTRUMENT FOCUS</label>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {['drums', 'bass', 'synth', 'keys'].map(inst => (
              <label key={inst} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={config.instruments.includes(inst)}
                  onChange={() => toggleInstrument(inst)}
                  style={{ accentColor: 'var(--accent-color)', width: '16px', height: '16px' }}
                />
                {inst.charAt(0).toUpperCase() + inst.slice(1)}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: '1rem', display: 'flex', gap: '1rem' }}>
          <button 
            className="btn-primary" 
            style={{ flex: 1, height: '56px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
            onClick={() => onStart({ ...config, testMode: false })}
          >
            <span style={{ fontSize: '1.5rem' }}>🏀</span> Generate & Start
          </button>
          
          <button 
            className="glass-panel" 
            style={{ width: '80px', height: '56px', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.2)' }}
            onClick={() => onStart({ ...config, testMode: true })}
            title="Test Video & Tracking Only"
          >
            📹
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfigPanel;
