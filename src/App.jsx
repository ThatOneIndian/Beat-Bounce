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

// Keep instances outside React state to avoid re-renders disrupting the tight loop
let staticEngines = {
  poseTracker: new PoseTracker(),
  dribbleDetector: new DribbleDetector(),
  audioDetector: new AudioDribbleDetector(),
  rhythmEngine: new RhythmEngine(),
  beatGrid: new BeatGrid(),
  musicEngine: new AdaptiveMusicEngine()
};
staticEngines.beatScorer = new BeatScorer(staticEngines.beatGrid);
staticEngines.trackGen = new TrackGenerator(import.meta.env.VITE_LYRIA_API_KEY || import.meta.env.LYRIA_API_KEY || import.meta.env.GEMINI_API_KEY);
staticEngines.geminiLive = new GeminiLiveClassifier(import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY);

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

  // Setup webcam preview early
  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: true 
        });
        setMediaStream(stream);
        staticEngines.audioDetector.init(stream);
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
        videoRef.current.play().catch(e => console.warn("Video autplay blocked", e));
      };
    }
  });

  const handleStart = async (newConfig) => {
    setConfig(newConfig);
    setAppState('generating');
    
    await staticEngines.poseTracker.initialize();
    await staticEngines.musicEngine.initialize();
    await staticEngines.geminiLive.connect();
    
    const targetBPM = Math.round((newConfig.tempo_range.min + newConfig.tempo_range.max) / 2);
    
    try {
      const trackUrl = await staticEngines.trackGen.generateTrack(targetBPM, newConfig);
      await staticEngines.musicEngine.loadTrack(targetBPM, trackUrl);
      staticEngines.musicEngine.playTrack(targetBPM);
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
      
      if (!canvas || !ctx || !video) return;

      const skeletonRenderer = new SkeletonRenderer(canvas);
      const beatIndicator = new BeatIndicator(canvas, staticEngines.beatGrid);

      const targetBPM = Math.round((config.tempo_range.min + config.tempo_range.max) / 2);
      staticEngines.beatGrid.initialize(targetBPM, performance.now());
      setStats(s => ({ ...s, bpm: targetBPM, energy: config.energy }));

      let currentStats = { score: 0, bpm: targetBPM, combo: 0, maxCombo: 0, rating: null, energy: config.energy };

      const renderLoop = (timestamp) => {
        // Only attempt to draw or parse if the video element has loaded frames
        if (video.readyState >= 2) { // HAVE_CURRENT_DATA or higher
          // Draw video background
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.save();
          ctx.scale(-1, 1);
          ctx.translate(-canvas.width, 0);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          ctx.restore();

          // Tracker processing
          const landmarks = staticEngines.poseTracker.processFrame(video, timestamp);
          if (landmarks) {
            const visEvent = staticEngines.dribbleDetector.processFrame(landmarks, timestamp);
            const audEvent = staticEngines.audioDetector.detect(timestamp);
            
            const fused = SensorFusion.fuseDribbleSignals(visEvent, audEvent);
            
            if (fused.detected) {
              const rhythm = staticEngines.rhythmEngine.onDribble(fused.timestamp);
              const scoreResult = staticEngines.beatScorer.scoreDribble(fused.timestamp);
              
              skeletonRenderer.setScoreColor(scoreResult.rating);
              staticEngines.musicEngine.playHitSFX(scoreResult.rating);
              beatIndicator.addSplash(scoreResult.rating);
              if (rhythm) staticEngines.musicEngine.updateTempo(Math.round(rhythm.bpm));
              
              currentStats = {
                 score: scoreResult.totalScore,
                 combo: scoreResult.combo,
                 maxCombo: scoreResult.maxCombo,
                 rating: scoreResult.rating,
                 bpm: rhythm ? Math.round(rhythm.bpm) : currentStats.bpm,
                 energy: config.energy
              };
              
              // Push update to React
              setStats({...currentStats});
              
              setTimeout(() => {
                setStats(s => s.rating === scoreResult.rating ? {...s, rating: null} : s);
              }, 500);
            }
            skeletonRenderer.render(landmarks);
            
            // Stream compressed frame to Gemini once per second
            staticEngines.geminiLive.maybeSendFrame(canvas, timestamp);
          } else {
             // In case landmarks are temporarily lost, clear the old skeleton but keep drawing background
             skeletonRenderer.render([]);
          }
        }

        // Draw Beat highway
        beatIndicator.render(performance.now());
        reqRef.current = requestAnimationFrame(renderLoop);
      };

      reqRef.current = requestAnimationFrame(renderLoop);

      return () => {
        cancelAnimationFrame(reqRef.current);
      };
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
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', padding: '2rem', paddingTop: '8rem' }}>
          <HUD {...stats} />
          <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }}></video>
          <canvas ref={canvasRef} width={1280} height={720} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '16px', border: '1px solid var(--panel-border)' }}></canvas>
        </div>
      )}
    </div>
  );
}

export default App;
