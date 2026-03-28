import { useState, useRef, useEffect } from 'react';
import ConfigPanel from './config/ConfigPanel';
import HUD from './visuals/HUD';
import { PoseTracker } from './tracking/PoseTracker';
import { DribbleDetector } from './tracking/DribbleDetector';
import { RhythmEngine } from './tracking/RhythmEngine';
import { BeatGrid } from './music/BeatGrid';
import { AdaptiveMusicEngine } from './music/AdaptiveMusicEngine';
import { BeatScorer } from './scoring/BeatScorer';
import { SkeletonRenderer } from './visuals/SkeletonRenderer';
import { BeatIndicator } from './visuals/BeatIndicator';
import { AudioDribbleDetector } from './tracking/AudioDetector';
import { SensorFusion } from './tracking/SensorFusion';
import { TrackGenerator } from './music/TrackGenerator';
import { GeminiLiveClassifier } from './ai/GeminiLiveClassifier';
import './index.css';

function App() {
  const [appState, setAppState] = useState('config'); // config, generating, countdown, active, error
  const [config, setConfig] = useState({
    genre: 'hip-hop',
    energy: 7,
    tempo_range: { min: 90, max: 130 },
    mood: 'upbeat',
    instruments: ['drums', 'bass'],
    duration_seconds: 90
  });

  const [stats, setStats] = useState({ score: 0, bpm: 0, combo: 0, maxCombo: 0, rating: null, energy: 5 });
  const [errorMessage, setErrorMessage] = useState("");
  const [mediaStream, setMediaStream] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const reqRef = useRef(null);

  // High-performance singletons initialized only when needed
  const enginesRef = useRef(null);

  const initializeEngines = async () => {
    if (enginesRef.current) return;
    
    // Lazy-load tracking models only once
    const poseTracker = new PoseTracker();
    const dribbleDetector = new DribbleDetector();
    const audioDetector = new AudioDribbleDetector();
    const rhythmEngine = new RhythmEngine();
    const beatGrid = new BeatGrid();
    const musicEngine = new AdaptiveMusicEngine();
    
    enginesRef.current = {
      poseTracker, dribbleDetector, audioDetector, rhythmEngine, beatGrid, musicEngine,
      beatScorer: new BeatScorer(beatGrid),
      trackGen: new TrackGenerator(),
      geminiLive: new GeminiLiveClassifier(import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY)
    };

    console.log("Engines categorized and ready.");
  };

  // Setup webcam preview early
  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: true 
        });
        setMediaStream(stream);
      } catch (err) {
        console.error("Failed to access camera/mic:", err);
      }
    }
    setupCamera();
  }, []);

  // Ensure any active videoRef instances always get the stream when re-rendered
  useEffect(() => {
    if (videoRef.current && mediaStream && videoRef.current.srcObject !== mediaStream) {
      videoRef.current.srcObject = mediaStream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current.play().catch(e => console.warn("Video autoplay blocked", e));
      };
    }
  });

  const handleQuit = () => {
    const engines = enginesRef.current;
    if (engines) engines.musicEngine.stopAll();
    setAppState('config');
    setStats({ score: 0, bpm: 0, combo: 0, maxCombo: 0, rating: null, energy: config.energy });
  };

  const handleStart = async (newConfig) => {
    setConfig(newConfig);
    setAppState('generating');
    
    await initializeEngines();
    const engines = enginesRef.current;

    const targetBPM = Math.round((newConfig.tempo_range.min + newConfig.tempo_range.max) / 2);

    try {
      await engines.poseTracker.initialize();
      await engines.musicEngine.initialize();
      await engines.geminiLive.connect();
      
      engines.audioDetector.init(mediaStream);
      
      if (!newConfig.testMode) {
        const trackUrl = await engines.trackGen.generateTrack(targetBPM, newConfig);
        await engines.musicEngine.loadTrack(targetBPM, trackUrl);
        engines.musicEngine.playTrack(targetBPM);
      } else {
        console.log("[Test Mode] Bypassing music generation.");
      }
      
      setAppState('countdown');
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || "Unknown error generating Lyria track.");
      setAppState('error');
    }
  };

  useEffect(() => {
    if (appState === 'countdown') {
      setTimeout(() => setAppState('active'), 3000); // 3-second countdown
    }
  }, [appState]);

  // Main game loop fixes the freeze!
  useEffect(() => {
    if (appState === 'active') {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const video = videoRef.current;
      const engines = enginesRef.current;
      
      if (!canvas || !ctx || !video || !engines) return;

      const skeletonRenderer = new SkeletonRenderer(canvas);
      const beatIndicator = new BeatIndicator(canvas, engines.beatGrid);

      const targetBPM = Math.round((config.tempo_range.min + config.tempo_range.max) / 2);
      engines.beatGrid.initialize(targetBPM, performance.now());
      setStats(s => ({ ...s, bpm: targetBPM, energy: config.energy }));

      let currentStats = { score: 0, bpm: targetBPM, combo: 0, maxCombo: 0, rating: null, energy: config.energy };

      const renderLoop = (timestamp) => {
        try {
          if (video.readyState >= 2) { 
            // 1. Clear & Background
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.scale(-1, 1);
            ctx.translate(-canvas.width, 0);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            ctx.restore();

            // 2. Tracking: Pose
            const landmarks = engines.poseTracker.processFrame(video, timestamp);
            
            // 3. Fusion Logic
            let visEvent = { detected: false, timestamp };
            if (landmarks) {
              visEvent = engines.dribbleDetector.processFrame(landmarks, timestamp);
            }
            
            const audEvent = engines.audioDetector.detect(timestamp);
            const fused = SensorFusion.fuseDribbleSignals(visEvent, audEvent);
            
            if (fused.detected) {
              const rhythm = engines.rhythmEngine.onDribble(fused.timestamp);
              const scoreResult = engines.beatScorer.scoreDribble(fused.timestamp);
              
              skeletonRenderer.setScoreColor(scoreResult.rating);
              engines.musicEngine.playHitSFX(scoreResult.rating);
              beatIndicator.addSplash(scoreResult.rating);
              if (rhythm) engines.musicEngine.updateTempo(Math.round(rhythm.bpm));
              
              currentStats = {
                 score: scoreResult.totalScore,
                 combo: scoreResult.combo,
                 maxCombo: scoreResult.maxCombo,
                 rating: scoreResult.rating,
                 bpm: rhythm ? Math.round(rhythm.bpm) : currentStats.bpm,
                 energy: config.energy
              };
              
              setStats({...currentStats});
              
              setTimeout(() => {
                setStats(s => s.rating === scoreResult.rating ? {...s, rating: null} : s);
              }, 500);
            }

            // 4. Rendering
            if (landmarks) {
              skeletonRenderer.render(landmarks);
              engines.geminiLive.maybeSendFrame(canvas, timestamp);
            }
          }
        } catch (err) {
          console.error("Render catch loop error:", err);
        }

        beatIndicator.render(performance.now());
        reqRef.current = requestAnimationFrame(renderLoop);
      };

      reqRef.current = requestAnimationFrame(renderLoop);
      return () => cancelAnimationFrame(reqRef.current);
    }
  }, [appState, config]);

  return (
    <div className="app-container" style={{ width: '100%', height: '100%', padding: '2rem', boxSizing: 'border-box' }}>
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '40vw', height: '40vw', background: 'radial-gradient(circle, rgba(0,255,204,0.1) 0%, rgba(0,0,0,0) 70%)', zIndex: -1 }}></div>
      
      {appState === 'config' && <ConfigPanel initialConfig={config} onStart={handleStart} mediaStream={mediaStream} />}

      {appState === 'generating' && (
        <div className="glass-panel" style={{ height: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="loader" style={{ width: '64px', height: '64px', borderRadius: '50%', border: '4px solid var(--panel-border)', borderTopColor: 'var(--accent-color)', animation: 'spin 1s linear infinite' }}></div>
          <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
          <h2>Generating Lyria 3 Track...</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Hold tight, this may take up to 30 seconds for audio inference.</p>
        </div>
      )}

      {appState === 'error' && (
        <div className="glass-panel" style={{ height: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{ color: '#FF4444' }}>Lyria Generation Failed</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', textAlign: 'center' }}>{errorMessage}</p>
          <button style={{ marginTop: '2rem' }} onClick={() => setAppState('config')}>Go Back</button>
        </div>
      )}

      {appState === 'countdown' && (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <h1 style={{ fontSize: '8rem', color: 'var(--accent-color)', textShadow: '0 0 32px var(--accent-color)' }}>GET READY</h1>
        </div>
      )}

      {appState === 'active' && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', padding: '2rem', paddingTop: '8rem' }}>
          <button 
            onClick={handleQuit}
            className="glass-panel"
            style={{ 
              position: 'fixed', top: '2rem', left: '2rem', padding: '0.8rem 1.5rem', 
              color: '#ff4444', border: '1px solid rgba(255, 68, 68, 0.3)', 
              cursor: 'pointer', fontWeight: 600, zIndex: 100 
            }}
          >
            QUIT SESSION
          </button>
          <HUD {...stats} />
          <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }}></video>
          <canvas ref={canvasRef} width={1280} height={720} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '16px', border: '1px solid var(--panel-border)' }}></canvas>
        </div>
      )}
    </div>
  );
}

export default App;
