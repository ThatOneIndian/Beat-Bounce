import { useState, useRef, useEffect } from 'react';
import ConfigPanel from './config/ConfigPanel';
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
import { FeedbackManager } from './feedback/FeedbackManager';
import * as Tone from 'tone';
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
  const [genStatus, setGenStatus] = useState("Initializing...");
  const [mediaStream, setMediaStream] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const feedbackContainerRef = useRef(null);
  const reqRef = useRef(null);

  // High-performance singletons initialized only when needed
  const enginesRef = useRef(null);
  const feedbackManagerRef = useRef(null);

  const initializeEngines = async () => {
    if (enginesRef.current) return;
    
    // Lazy-load tracking models only once
    const poseTracker = new PoseTracker();
    const dribbleDetector = new DribbleDetector();
    const audioDetector = new AudioDribbleDetector();
    const rhythmEngine = new RhythmEngine();
    const beatGrid = new BeatGrid();
    const musicEngine = new AdaptiveMusicEngine();
    
    const sensorFusion = new SensorFusion();
    
    enginesRef.current = {
      poseTracker, dribbleDetector, audioDetector, rhythmEngine, beatGrid, musicEngine,
      sensorFusion,
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
    if (feedbackManagerRef.current) {
      feedbackManagerRef.current.destroy();
      feedbackManagerRef.current = null;
    }
    setAppState('config');
    setGenStatus("Initializing...");
    setStats({ score: 0, bpm: 0, combo: 0, maxCombo: 0, rating: null, energy: config.energy });
  };

  const handleStart = async (newConfig) => {
    setConfig(newConfig);
    setAppState('generating');
    setGenStatus("Warming up engines...");
    
    try {
      await initializeEngines();
      const engines = enginesRef.current;

      const targetBPM = Math.round((newConfig.tempo_range.min + newConfig.tempo_range.max) / 2);

      setGenStatus("Unlocking Audio Context...");
      await Tone.start(); // Unlock AudioContext on user interaction
      console.log("Audio Context Unlocked");

      setGenStatus("Initializing MediaPipe Pose (Lite)...");
      await engines.poseTracker.initialize();
      
      setGenStatus("Setting up Audio Harmony Engine...");
      await engines.musicEngine.initialize();
      
      setGenStatus("Connecting to Gemini Live...");
      await engines.geminiLive.connect();
      
      engines.audioDetector.init(mediaStream);
      
      if (!newConfig.testMode) {
        setGenStatus("Requesting Lyria 3 Generation (this can take 20s)...");
        const trackUrl = await engines.trackGen.generateTrack(targetBPM, newConfig);
        
        setGenStatus("Decoding & Buffering Audio Assets...");
        await engines.musicEngine.loadTrack(targetBPM, trackUrl);
        
        setGenStatus("Finalizing Audio Playback...");
        engines.musicEngine.playTrack(targetBPM);
      } else {
        console.log("[Test Mode] Bypassing music generation.");
      }
      
      Tone.Transport.start(); // Start the master clock
      setAppState('countdown');
    } catch (err) {
      console.error("[Startup Error]", err);
      setErrorMessage(err.message || "Unknown error generating Lyria track.");
      setAppState('error');
    }
  };

  useEffect(() => {
    if (appState === 'countdown') {
      setTimeout(() => setAppState('active'), 3000); // 3-second countdown
    }
  }, [appState]);

  // Main game loop
  useEffect(() => {
    if (appState === 'active') {
      const canvas = canvasRef.current;
      const container = feedbackContainerRef.current;
      const ctx = canvas?.getContext('2d');
      const video = videoRef.current;
      const engines = enginesRef.current;
      
      if (!canvas || !ctx || !video || !engines || !container) return;

      const skeletonRenderer = new SkeletonRenderer(canvas);
      const beatIndicator = new BeatIndicator(canvas, engines.beatGrid);

      // Initialize the integrated feedback orchestration
      const feedbackManager = new FeedbackManager({ canvas, containerElement: container });
      feedbackManagerRef.current = feedbackManager;
      
      const targetBPM = Math.round((config.tempo_range.min + config.tempo_range.max) / 2);
      engines.beatGrid.initialize(targetBPM, performance.now());
      
      // Start the feedback systems — pass the gainNode so HarmonyEngine can
      // insert its filter in the chain without disconnecting the player
      feedbackManager.startTrack(targetBPM, engines.musicEngine.gainNode);

      const renderLoop = (timestamp) => {
        try {
          const audioTime = engines.musicEngine.getAudioTime();
          
          if (video.readyState >= 2) { 
            // 1. Draw Camera Frame as Background
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.scale(-1, 1);
            ctx.translate(-canvas.width, 0);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            ctx.restore();

            // 2. Pose Tracking
            const landmarks = engines.poseTracker.processFrame(video, timestamp);
            
            // 3. Sync Rhythms (use performance.now() ms — same clock as dribble timestamps)
            engines.beatGrid.regenerate(timestamp);

            // 4. Dribble Detection & Feedback Dispatch
            let visEvent = { detected: false, timestamp };
            if (landmarks) {
              visEvent = engines.dribbleDetector.processFrame(landmarks, timestamp);
            }
            
            const audEvent = engines.audioDetector.detect(timestamp);
            const fused = engines.sensorFusion.process(visEvent, audEvent, timestamp);
            
            if (fused.detected) {
              const audioNowMs = audioTime * 1000;
              const rhythm = engines.rhythmEngine.onDribble(fused.timestamp);
              const scoreResult = engines.beatScorer.scoreDribble(fused.timestamp);
              
              // NEW: Integrated Feedback
              const wristHand = fused.hand || 'right';
              const wristPos = landmarks ? {
                x: (1 - landmarks[wristHand === 'left' ? 15 : 16].x) * canvas.width,
                y: landmarks[wristHand === 'left' ? 15 : 16].y * canvas.height
              } : null;

              feedbackManager.onDribbleScored(scoreResult, wristPos);
              skeletonRenderer.flashRating(scoreResult.rating);
              engines.musicEngine.playHitSFX(scoreResult.rating);
              
              if (rhythm) {
                const roundedBPM = Math.round(rhythm.bpm);
                engines.beatGrid.updateBPM(roundedBPM);
                engines.musicEngine.updateTempo(roundedBPM);
                feedbackManager.updateBPM(roundedBPM);
              }

              beatIndicator.addSplash(scoreResult.rating);
            }

            // 5. Render Layers
            if (landmarks) {
              skeletonRenderer.render(landmarks);
              engines.geminiLive.maybeSendFrame(canvas, timestamp);
            }

            // 6. Beat Overlay (the "dribble on cue" highway)
            beatIndicator.render(timestamp);

            // Integrated HUD, Meter, Particles Render
            feedbackManager.renderFrame(landmarks);
          }
        } catch (err) {
          console.error("Render Loop Error:", err);
        }

        reqRef.current = requestAnimationFrame(renderLoop);
      };

      reqRef.current = requestAnimationFrame(renderLoop);
      return () => {
        cancelAnimationFrame(reqRef.current);
        if (feedbackManagerRef.current) {
          feedbackManagerRef.current.destroy();
          feedbackManagerRef.current = null;
        }
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
          <h2 style={{ marginTop: '2rem' }}>{genStatus}</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>Hold tight, this may take up to 30 seconds for audio inference.</p>
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
        <div 
          ref={feedbackContainerRef}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', padding: '2rem', paddingTop: '4rem' }}
        >
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
          
          <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }}></video>
          <canvas 
            ref={canvasRef} 
            width={1280} height={720} 
            style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '24px', border: '1px solid var(--panel-border)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}
          ></canvas>
        </div>
      )}
    </div>
  );
}

export default App;
