import { useState, useRef, useEffect } from 'react';
import ConfigPanel from './config/ConfigPanel';
import { PoseTracker } from './tracking/PoseTracker';
import { DribbleDetector } from './tracking/DribbleDetector';
import { RhythmEngine } from './tracking/RhythmEngine';
import { AdaptiveMusicEngine } from './music/AdaptiveMusicEngine';
import { TrackGenerator } from './music/TrackGenerator';
import { BallTracker } from './tracking/BallTracker';
import { SkeletonRenderer } from './visuals/SkeletonRenderer';
import './index.css';

function App() {
  const [appState, setAppState] = useState('config'); // config, generating, countdown, active, summary
  const [config, setConfig] = useState({
    genre: 'hip-hop',
    energy: 7,
    tempo_range: { min: 90, max: 130 },
    mood: 'upbeat',
    instruments: ['drums', 'bass'],
    duration_seconds: 90
  });
  
  // Real-time Game State
  const [score, setScore] = useState(0);
  const [liveBpm, setLiveBpm] = useState('--');
  const [combo, setCombo] = useState(0);
  const [generatingStatus, setGeneratingStatus] = useState('Initializing AI...');
  const [mediaStream, setMediaStream] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // Persistence for Engines
  const poseTracker = useRef(new PoseTracker());
  const dribbleDetector = useRef(new DribbleDetector());
  const rhythmEngine = useRef(new RhythmEngine());
  const musicEngine = useRef(new AdaptiveMusicEngine());
  const ballTracker = useRef(new BallTracker());
  const trackGenerator = useRef(new TrackGenerator());
  const skeletonRenderer = useRef(null);
  const requestRef = useRef();
  
  // Setup webcam preview
  useEffect(() => {
    let stream = null;
    async function setupCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 1280, height: 720 },
          audio: false // audio not needed for tracking
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setMediaStream(stream);
      } catch (err) {
        console.error("Failed to access camera:", err);
      }
    }
    setupCamera();
    
    // Cleanup stream on unmount
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [appState]); // Re-attach when state changes as video element might remount

  const handleStart = async (newConfig) => {
    setConfig(newConfig);
    setAppState('generating');
    
    try {
      // Initialize engines early to handle browser security (Tone.js needs user gesture)
      await musicEngine.current.initialize();
      await poseTracker.current.initialize();
      await ballTracker.current.initialize();
      
      const targetBPM = (newConfig.tempo_range.min + newConfig.tempo_range.max) / 2;
      const buffer = await trackGenerator.current.generateTrack(targetBPM, newConfig);

      if (buffer) {
        // Load real Lyria track
        await musicEngine.current.loadTrack(targetBPM, buffer);
      } else {
        // Fallback to Metronome if Lyria fails or is filtered
        console.warn("Lyria generation failed or filtered, using metronome.");
        musicEngine.current.startMetronome(newConfig.tempo_range.min, newConfig);
      }

      setAppState('countdown');
    } catch (err) {
      console.error("Critical failure during session startup:", err);
      // Ensure we still proceed to config or error state instead of hanging
      setAppState('config');
      alert("Failed to start session. Check your internet and API key.");
    }
  };

  // Cycle through generation status messages
  useEffect(() => {
    if (appState !== 'generating') return;
    
    const messages = [
      "Slicing rhythmic beats...",
      "Baking 90s basslines...",
      "Mastering drum textures...",
      "Synthesizing atmosphere...",
      "Finalizing composition...",
      "Polishing audio grit..."
    ];
    let idx = 0;
    
    const interval = setInterval(() => {
      idx = (idx + 1) % messages.length;
      setGeneratingStatus(messages[idx]);
    }, 4000);
    
    return () => clearInterval(interval);
  }, [appState]);

  useEffect(() => {
    if (appState === 'countdown') {
      setTimeout(() => {
        setAppState('active');
      }, 3000); 
    }
  }, [appState]);

  // Main Motion Engine Loop
  const engineLoop = (timestamp) => {
    if (appState !== 'active') return;

    if (videoRef.current && canvasRef.current) {
        const landmarks = poseTracker.current.processFrame(videoRef.current, timestamp);
        const ballPos = ballTracker.current.processFrame(videoRef.current, timestamp);
        
        if (landmarks || ballPos) {
            // Draw skeleton
            if (skeletonRenderer.current) {
                // No clearRect needed because drawImage covers the whole frame
                skeletonRenderer.current.render(videoRef.current, landmarks, ballPos);
            }

            // Detect Dribbles
            const result = dribbleDetector.current.processFrame(landmarks, ballPos, timestamp);
            if (result.detected) {
                const bpmInfo = rhythmEngine.current.onDribble(timestamp);
                if (bpmInfo) {
                    setLiveBpm(bpmInfo.bpm);
                    musicEngine.current.updateTempo(bpmInfo.bpm);
                    
                    // Simple scoring logic for now
                    setScore(prev => prev + 10);
                    setCombo(prev => prev + 1);
                }
            }
        }
    }
    
    requestRef.current = requestAnimationFrame(engineLoop);
  };

  useEffect(() => {
    if (appState === 'active') {
        if (canvasRef.current) {
            skeletonRenderer.current = new SkeletonRenderer(canvasRef.current);
        }
        requestRef.current = requestAnimationFrame(engineLoop);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [appState]);

  const handleQuit = () => {
    musicEngine.current.stopAll();
    setAppState('config');
    setScore(0);
    setLiveBpm('--');
    setCombo(0);
  };

  return (
    <div className="app-container" style={{ width: '100%', height: '100%', padding: '2rem', boxSizing: 'border-box' }}>
      
      {/* Background glow effects */}
      <div style={{
        position: 'absolute', top: '-10%', left: '-10%', width: '40vw', height: '40vw',
        background: 'radial-gradient(circle, rgba(0,255,204,0.1) 0%, rgba(0,0,0,0) 70%)',
        zIndex: -1
      }}></div>
      
      {appState === 'config' && (
        <ConfigPanel 
          initialConfig={config} 
          onStart={handleStart} 
          mediaStream={mediaStream} 
        />
      )}

      {appState === 'generating' && (
        <div className="glass-panel" style={{ height: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
          <div className="loader" style={{
            width: '64px', height: '64px', borderRadius: '50%', border: '4px solid var(--panel-border)', borderTopColor: 'var(--accent-color)', animation: 'spin 1.5s linear infinite'
          }}></div>
          <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ margin: 0, color: 'var(--text-color)', letterSpacing: '1px' }}>COMPOSING SESSION</h2>
            <p style={{ color: 'var(--accent-color)', marginTop: '0.8rem', opacity: 0.8, fontFamily: 'monospace', fontSize: '1.1rem' }}>
              {generatingStatus}
            </p>
          </div>
        </div>
      )}

      {appState === 'countdown' && (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <h1 style={{ fontSize: '8rem', color: 'var(--accent-color)', textShadow: '0 0 32px var(--accent-color)' }}>
            GET READY
          </h1>
        </div>
      )}

      {(appState === 'active' || appState === 'countdown' || appState === 'generating') && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: -1, opacity: 0.1 }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ borderRadius: '16px', border: '2px solid #fff' }}></video>
        </div>
      )}

      {appState === 'active' && (
        <div className="active-session" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
             <button
               onClick={handleQuit}
               className="glass-panel"
               style={{
                 padding: '0.5rem 1rem',
                 background: 'rgba(255, 68, 68, 0.1)',
                 border: '1px solid rgba(255, 68, 68, 0.3)',
                 color: '#ff4444',
                 borderRadius: '8px',
                 cursor: 'pointer',
                 fontWeight: 600,
                 fontSize: '0.8rem',
                 textTransform: 'uppercase'
               }}
             >
               Quit Session
             </button>
             <div className="glass-panel" style={{ padding: '1rem 2rem' }}>
                <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Score</h3>
                <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>{score}</div>
             </div>
             <div className="glass-panel" style={{ padding: '1rem 2rem', textAlign: 'center' }}>
                <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>BPM</h3>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--accent-color)' }}>{liveBpm}</div>
             </div>
             <div className="glass-panel" style={{ padding: '1rem 2rem', textAlign: 'right' }}>
                <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Combo</h3>
                <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>{combo || '--'}</div>
             </div>
          </header>

          <div style={{ flex: 1, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }}></video>
            <canvas ref={canvasRef} width={1280} height={720} style={{
              width: '100%', maxHeight: '60vh', objectFit: 'contain',
              borderRadius: '16px', border: '1px solid var(--panel-border)'
            }}></canvas>
          </div>

          <div className="glass-panel" style={{ marginTop: '2rem', height: '80px', position: 'relative', overflow: 'hidden' }}>
             {/* Beat indicator bar placeholder */}
             <div style={{ position: 'absolute', left: '20%', top: 0, bottom: 0, width: '4px', background: 'rgba(255,255,255,0.8)', boxShadow: '0 0 12px #fff' }}></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
