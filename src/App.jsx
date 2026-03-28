import { useState, useRef, useEffect } from 'react';
import ConfigPanel from './config/ConfigPanel';
import HUD from './visuals/HUD';
import { PoseTracker } from './tracking/PoseTracker';
import { DribbleDetector } from './tracking/DribbleDetector';
import { RhythmEngine } from './tracking/RhythmEngine';
import { BeatGrid } from './music/BeatGrid';
import { LayeredMusicEngine } from './music/LayeredMusicEngine';
import { BeatScorer } from './scoring/BeatScorer';
import { SkeletonRenderer } from './visuals/SkeletonRenderer';
import { BeatIndicator } from './visuals/BeatIndicator';
import { AudioDribbleDetector } from './tracking/AudioDetector';
import { SensorFusion } from './tracking/SensorFusion';
import { TrackGenerator } from './music/TrackGenerator';
import { GeminiLiveClassifier } from './ai/GeminiLiveClassifier';
import { FeedbackManager } from './feedback/FeedbackManager';
import { DIFFICULTY } from './utils/constants';
import * as Tone from 'tone';
import './index.css';

function App() {
  const [appState, setAppState] = useState('config'); // config, generating, countdown, active, results, error
  const [config, setConfig] = useState({
    genre: 'hip-hop',
    energy: 7,
    tempo_range: { min: 90, max: 130 },
    mood: 'upbeat',
    instruments: ['drums', 'bass'],
    duration_seconds: 90,
    difficulty: 'normal'
  });

  const [stats, setStats] = useState({ score: 0, bpm: 0, combo: 0, maxCombo: 0, rating: null, energy: 5, meter: 50 });
  const [errorMessage, setErrorMessage] = useState("");
  const [genStatus, setGenStatus] = useState("Initializing...");
  const [mediaStream, setMediaStream] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [finalResults, setFinalResults] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const feedbackContainerRef = useRef(null);
  const reqRef = useRef(null);

  // High-performance singletons initialized only when needed
  const enginesRef = useRef(null);
  const feedbackManagerRef = useRef(null);
  const gameTimerRef = useRef(null);
  const gameStartTimeRef = useRef(null);

  const initializeEngines = async () => {
    if (enginesRef.current) return;

    const poseTracker = new PoseTracker();
    const dribbleDetector = new DribbleDetector();
    const audioDetector = new AudioDribbleDetector();
    const rhythmEngine = new RhythmEngine();
    const beatGrid = new BeatGrid();
    const musicEngine = new LayeredMusicEngine();
    const sensorFusion = new SensorFusion();

    enginesRef.current = {
      poseTracker, dribbleDetector, audioDetector, rhythmEngine, beatGrid, musicEngine,
      sensorFusion,
      beatScorer: new BeatScorer(beatGrid),
      trackGen: new TrackGenerator(import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_LYRIA_API_KEY || import.meta.env.GEMINI_API_KEY),
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
    if (gameTimerRef.current) {
      clearInterval(gameTimerRef.current);
      gameTimerRef.current = null;
    }
    setAppState('config');
    setGenStatus("Initializing...");
    setFinalResults(null);
    setStats({ score: 0, bpm: 0, combo: 0, maxCombo: 0, rating: null, energy: config.energy, meter: 50 });
  };

  const handleGameOver = () => {
    const engines = enginesRef.current;
    if (!engines) return;

    const scorerStats = engines.beatScorer.getStats();
    const accuracy = parseFloat(scorerStats.accuracy) || 0;
    const total = scorerStats.totalDribbles || 1;
    const { perfect } = scorerStats.hitCounts;

    // Weighted grade: 50% accuracy, 25% perfect ratio, 25% combo factor
    const perfectRatio = (perfect / total) * 100;
    const comboFactor = Math.min(100, (scorerStats.maxCombo / total) * 100);
    const gradeScore = accuracy * 0.5 + perfectRatio * 0.25 + comboFactor * 0.25;

    const d = DIFFICULTY[config.difficulty] || DIFFICULTY.normal;
    const t = d.gradeThresholds;
    let grade, gradeColor;
    if (gradeScore >= t.S) { grade = 'S'; gradeColor = '#FFD700'; }
    else if (gradeScore >= t.A) { grade = 'A'; gradeColor = '#00FFCC'; }
    else if (gradeScore >= t.B) { grade = 'B'; gradeColor = '#00BFFF'; }
    else if (gradeScore >= t.C) { grade = 'C'; gradeColor = '#FFA500'; }
    else if (gradeScore >= t.D) { grade = 'D'; gradeColor = '#FF6347'; }
    else { grade = 'F'; gradeColor = '#FF4444'; }

    setFinalResults({ ...scorerStats, grade, gradeColor, duration: config.duration_seconds });

    engines.musicEngine.stopAll();
    if (feedbackManagerRef.current) {
      feedbackManagerRef.current.destroy();
      feedbackManagerRef.current = null;
    }
    if (gameTimerRef.current) {
      clearInterval(gameTimerRef.current);
      gameTimerRef.current = null;
    }
    setAppState('results');
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
      await Tone.start();
      console.log("Audio Context Unlocked");

      setGenStatus("Initializing MediaPipe Pose (Lite)...");
      await engines.poseTracker.initialize();

      setGenStatus("Setting up Audio Harmony Engine...");
      await engines.musicEngine.initialize(newConfig.genre);

      setGenStatus("Connecting to Gemini Live...");
      await engines.geminiLive.connect();

      engines.beatScorer.reset();
      engines.beatScorer.setDifficulty(newConfig.difficulty || 'normal');
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

      Tone.Transport.start();
      setAppState('countdown');
    } catch (err) {
      console.error("[Startup Error]", err);
      setErrorMessage(err.message || "Unknown error generating Lyria track.");
      setAppState('error');
    }
  };

  useEffect(() => {
    if (appState === 'countdown') {
      setTimeout(() => setAppState('active'), 3000);
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

      const feedbackManager = new FeedbackManager({ canvas, containerElement: container });
      feedbackManagerRef.current = feedbackManager;

      const targetBPM = Math.round((config.tempo_range.min + config.tempo_range.max) / 2);
      engines.beatGrid.initialize(targetBPM, performance.now());
      setStats(s => ({ ...s, bpm: targetBPM, energy: config.energy }));

      let performanceMeter = 50;
      let lastCheckedBeatIndex = 0; // track which beats we've checked for misses
      let currentStats = { score: 0, bpm: targetBPM, combo: 0, maxCombo: 0, rating: null, energy: config.energy, meter: 50 };

      feedbackManager.startTrack(targetBPM, engines.musicEngine.gainNode);

      // Game timer
      const durationMs = config.duration_seconds * 1000;
      gameStartTimeRef.current = performance.now();
      setTimeLeft(config.duration_seconds);

      gameTimerRef.current = setInterval(() => {
        const elapsed = performance.now() - gameStartTimeRef.current;
        const remaining = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));
        setTimeLeft(remaining);
        if (remaining <= 0) {
          clearInterval(gameTimerRef.current);
          gameTimerRef.current = null;
          handleGameOver();
        }
      }, 250);

      const renderLoop = (timestamp) => {
        try {
          const audioTime = engines.musicEngine.getAudioTime();

          if (video.readyState >= 2) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.scale(-1, 1);
            ctx.translate(-canvas.width, 0);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            ctx.restore();

            const landmarks = engines.poseTracker.processFrame(video, timestamp);

            engines.beatGrid.regenerate(timestamp);

            let visEvent = { detected: false, timestamp };
            if (landmarks) {
              visEvent = engines.dribbleDetector.processFrame(landmarks, timestamp);
            }

            // Check for missed beats — decay meter when beats pass without a dribble
            const beatInterval = 60000 / engines.beatGrid.bpm;
            const missWindow = beatInterval * 0.6; // beat is "missed" after 60% of interval passes
            const passedBeats = engines.beatGrid.beats.filter(b => b < timestamp - missWindow);
            const newMisses = passedBeats.length - lastCheckedBeatIndex;
            if (newMisses > 0) {
              lastCheckedBeatIndex = passedBeats.length;
              performanceMeter = Math.max(0, performanceMeter - (newMisses * 4));
              if (engines.musicEngine.setPerformanceLevel) {
                const meterCombo = performanceMeter >= 75 ? 15 : performanceMeter >= 50 ? 8 : performanceMeter >= 25 ? 3 : 0;
                engines.musicEngine.setPerformanceLevel(meterCombo);
              }
              currentStats = { ...currentStats, meter: performanceMeter };
              setStats({ ...currentStats });
            }

            const audEvent = engines.audioDetector.detect(timestamp);
            const fused = engines.sensorFusion.process(visEvent, audEvent, timestamp);

            if (fused.detected) {
              const rhythm = engines.rhythmEngine.onDribble(fused.timestamp);
              const scoreResult = engines.beatScorer.scoreDribble(fused.timestamp);

              // Update performance meter
              if (scoreResult.rating === 'perfect') performanceMeter += 8;
              else if (scoreResult.rating === 'great') performanceMeter += 5;
              else if (scoreResult.rating === 'good') performanceMeter += 2;
              else performanceMeter -= 12;
              performanceMeter = Math.max(0, Math.min(100, performanceMeter));

              // Integrated feedback (from main)
              const wristHand = fused.hand || 'right';
              const wristPos = landmarks ? {
                x: (1 - landmarks[wristHand === 'left' ? 15 : 16].x) * canvas.width,
                y: landmarks[wristHand === 'left' ? 15 : 16].y * canvas.height
              } : null;

              feedbackManager.onDribbleScored(scoreResult, wristPos);
              skeletonRenderer.flashRating(scoreResult.rating);
              engines.musicEngine.playHitSFX(scoreResult.rating);

              // Music layers tied to meter
              const meterCombo = performanceMeter >= 75 ? 15 : performanceMeter >= 50 ? 8 : performanceMeter >= 25 ? 3 : 0;
              if (engines.musicEngine.setPerformanceLevel) {
                engines.musicEngine.setPerformanceLevel(meterCombo);
              }

              if (rhythm) {
                const roundedBPM = Math.round(rhythm.bpm);
                engines.beatGrid.updateBPM(roundedBPM);
                engines.musicEngine.updateTempo(roundedBPM);
                feedbackManager.updateBPM(roundedBPM);
              }

              beatIndicator.addSplash(scoreResult.rating);

              currentStats = {
                score: scoreResult.totalScore,
                combo: scoreResult.combo,
                maxCombo: scoreResult.maxCombo,
                rating: scoreResult.rating,
                bpm: rhythm ? Math.round(rhythm.bpm) : currentStats.bpm,
                energy: config.energy,
                meter: performanceMeter
              };

              setStats({...currentStats});

              setTimeout(() => {
                setStats(s => s.rating === scoreResult.rating ? {...s, rating: null} : s);
              }, 500);
            }

            if (landmarks) {
              skeletonRenderer.render(landmarks);
              engines.geminiLive.maybeSendFrame(canvas, timestamp);
            }

            beatIndicator.render(timestamp);
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
        if (gameTimerRef.current) {
          clearInterval(gameTimerRef.current);
          gameTimerRef.current = null;
        }
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

      {appState === 'results' && finalResults && (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ maxWidth: '520px', width: '100%', textAlign: 'center', padding: '3rem' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: '0.5rem' }}>SESSION COMPLETE</p>

            {/* Grade */}
            <div style={{
              fontSize: '7rem', fontWeight: 800, lineHeight: 1,
              color: finalResults.gradeColor,
              textShadow: `0 0 40px ${finalResults.gradeColor}60`,
              margin: '0.5rem 0 1.5rem'
            }}>
              {finalResults.grade}
            </div>

            {/* Score */}
            <div style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '2rem' }}>
              {finalResults.totalScore.toLocaleString()}
              <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>pts</span>
            </div>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem', textAlign: 'left' }}>
              <div className="glass-panel" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>ACCURACY</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{finalResults.accuracy}%</div>
              </div>
              <div className="glass-panel" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>MAX COMBO</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{finalResults.maxCombo}x</div>
              </div>
              <div className="glass-panel" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>TOTAL DRIBBLES</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{finalResults.totalDribbles}</div>
              </div>
              <div className="glass-panel" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>DURATION</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                  {finalResults.duration >= 60 ? `${Math.floor(finalResults.duration / 60)}m ${finalResults.duration % 60}s` : `${finalResults.duration}s`}
                </div>
              </div>
            </div>

            {/* Hit breakdown */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginBottom: '2rem', fontSize: '0.85rem' }}>
              <span><span style={{ color: '#FFD700', fontWeight: 700 }}>{finalResults.hitCounts.perfect}</span> Perfect</span>
              <span><span style={{ color: '#00BFFF', fontWeight: 700 }}>{finalResults.hitCounts.great}</span> Great</span>
              <span><span style={{ color: '#00FF00', fontWeight: 700 }}>{finalResults.hitCounts.good}</span> Good</span>
              <span><span style={{ color: '#FF4444', fontWeight: 700 }}>{finalResults.hitCounts.miss}</span> Miss</span>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                className="btn-primary"
                style={{ flex: 1, height: '52px', fontSize: '1.1rem' }}
                onClick={() => { setFinalResults(null); handleStart({ ...config, testMode: false }); }}
              >
                Play Again
              </button>
              <button
                className="glass-panel"
                style={{ flex: 1, height: '52px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 600, border: '1px solid var(--panel-border)' }}
                onClick={handleQuit}
              >
                Change Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {appState === 'results' && finalResults && (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ maxWidth: '520px', width: '100%', textAlign: 'center', padding: '3rem' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: '0.5rem' }}>SESSION COMPLETE</p>
            <div style={{
              fontSize: '7rem', fontWeight: 800, lineHeight: 1,
              color: finalResults.gradeColor,
              textShadow: `0 0 40px ${finalResults.gradeColor}60`,
              margin: '0.5rem 0 1.5rem'
            }}>
              {finalResults.grade}
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '2rem' }}>
              {finalResults.totalScore.toLocaleString()}
              <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>pts</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem', textAlign: 'left' }}>
              <div className="glass-panel" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>ACCURACY</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{finalResults.accuracy}%</div>
              </div>
              <div className="glass-panel" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>MAX COMBO</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{finalResults.maxCombo}x</div>
              </div>
              <div className="glass-panel" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>TOTAL DRIBBLES</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{finalResults.totalDribbles}</div>
              </div>
              <div className="glass-panel" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>DURATION</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                  {finalResults.duration >= 60 ? `${Math.floor(finalResults.duration / 60)}m ${finalResults.duration % 60}s` : `${finalResults.duration}s`}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginBottom: '2rem', fontSize: '0.85rem' }}>
              <span><span style={{ color: '#FFD700', fontWeight: 700 }}>{finalResults.hitCounts.perfect}</span> Perfect</span>
              <span><span style={{ color: '#00BFFF', fontWeight: 700 }}>{finalResults.hitCounts.great}</span> Great</span>
              <span><span style={{ color: '#00FF00', fontWeight: 700 }}>{finalResults.hitCounts.good}</span> Good</span>
              <span><span style={{ color: '#FF4444', fontWeight: 700 }}>{finalResults.hitCounts.miss}</span> Miss</span>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn-primary" style={{ flex: 1, height: '52px', fontSize: '1.1rem' }}
                onClick={() => { setFinalResults(null); handleStart({ ...config, testMode: false }); }}>
                Play Again
              </button>
              <button className="glass-panel" style={{ flex: 1, height: '52px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 600, border: '1px solid var(--panel-border)' }}
                onClick={handleQuit}>
                Change Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {appState === 'active' && (
        <div
          ref={feedbackContainerRef}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', background: '#000' }}
        >
          <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }}></video>
          <canvas ref={canvasRef} width={1280} height={720} style={{ width: '100%', height: '100%', objectFit: 'cover' }}></canvas>
          <HUD {...stats} timeLeft={timeLeft} onQuit={handleQuit} />
        </div>
      )}
    </div>
  );
}

export default App;
