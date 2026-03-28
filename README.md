# BeatBounce

A real-time basketball dribble-to-music rhythm game. Dribble a basketball in front of your webcam and the app tracks your movements, scores your timing against a beat grid, and generates adaptive music that responds to your performance — like Guitar Hero, but with a basketball.

## Features

### Pose Tracking & Dribble Detection
- **MediaPipe Pose Landmarker** tracks 33 body landmarks in real time via webcam
- **Visual dribble detection** using wrist velocity tracking (downward motion detection)
- **Audio dribble detection** via microphone to pick up ball-bounce sounds
- **Sensor fusion** combines visual + audio signals for high-confidence dribble events, discarding audio-only false positives
- Full **skeleton overlay** rendered on the video feed

### Adaptive Music System
- **Layered synthesized music** (Tone.js) with 4 layers: Drums, Bass, Chords, Lead
- Layers unlock progressively as the performance meter rises (25%, 50%, 75%)
- **Google Lyria 3 API** generates an AI ambient backing track matching the selected genre
- Music intensity and layering adapt in real time to player performance
- Genre profiles: Hip-Hop, EDM, Lo-Fi, Pop with tailored instrument sounds and patterns

### Guitar Hero-Style Scoring
- **Beat grid** generates target beats at the current BPM
- Timing windows: Perfect, Great, Good, Miss (configurable by difficulty)
- **Combo multiplier** system — consecutive hits increase your multiplier (up to 4x)
- **Performance meter** (0–100) — gains on hits, decays on misses and idle periods
- Miss penalties: score deduction, combo reset, error sound effect, shake animation
- Three difficulty presets: Easy, Normal, Hard (affect timing windows and grade thresholds)
- Final grade: S / A / B / C / D / F based on accuracy percentage

### Visual Feedback
- **Diamond needle gauge** (bottom-right) showing performance meter with 5 zones: Failing, Bad, OK, Great, On Fire
- Fire particle effects when meter hits 80+
- Floating rating popups (Perfect!, Great!, Good!, Miss, Too Late, Too Early)
- Layer indicator pills showing which music layers are active
- Floating pill-style HUD: Score, BPM, Combo, Time remaining, Quit button
- Fullscreen camera feed with skeleton overlay (no black borders)
- Results screen with final stats, grade, and accuracy breakdown

### AI Features
- **Gemini Live Classifier** — real-time video analysis of dribble style via WebSocket (classifies style, energy, pattern)
- **Voice Assistant** (config page) — talk to Gemini to configure music settings by voice (e.g., "make it sound like John Summit")
- **Lyria 3 Integration** — AI-generated ambient music matching the selected genre

### Configuration
- Genre selection (Hip-Hop, EDM, Lo-Fi, Pop)
- Energy level (1–10)
- Tempo range (BPM min/max)
- Mood (upbeat, chill, intense, dark)
- Instrument selection (drums, bass, synth, strings, keys, guitar)
- Session duration (30s – 5min)
- Difficulty (Easy, Normal, Hard)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8 |
| Pose Tracking | MediaPipe Tasks Vision (`@mediapipe/tasks-vision`) |
| Audio Synthesis | Tone.js 15 |
| AI Music Generation | Google Lyria 3 API |
| AI Classification | Google Gemini 2.0 Flash Live (WebSocket) |
| Voice Assistant | Google Gemini Live API (audio streaming) |
| Routing | React Router DOM 7 |

## Getting Started

### Prerequisites
- Node.js 18+
- A webcam and microphone
- Google AI API key (for Lyria music generation and Gemini features)

### Setup

```bash
# Clone the repo
git clone https://github.com/ThatOneIndian/Muse-Tiles.git
cd Muse-Tiles  # repo name, project is BeatBounce

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
# Add your Google AI API key:
# VITE_GEMINI_API_KEY=your_key_here

# Start development server
npm run dev
```

The app will open at `http://localhost:5173`.

### Usage

1. **Configure** — Select genre, energy, tempo, instruments, difficulty, and session duration. Optionally use the voice assistant mic button to configure by speaking.
2. **Start Session** — The app generates a Lyria ambient track and initializes the beat grid.
3. **Play** — Dribble a basketball in front of your webcam. Hit beats on time to build your combo and climb the performance meter. The music layers build up as you improve.
4. **Results** — When time runs out, see your final score, grade, accuracy breakdown, and max combo.

## Architecture

### System Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Browser (Client)                           │
│                                                                     │
│  ┌──────────┐    ┌──────────────────────────────────────────────┐   │
│  │  Config   │───▶│              App.jsx (Game Loop)             │   │
│  │  Panel    │    │  requestAnimationFrame @ ~60fps              │   │
│  └──────────┘    │                                              │   │
│       │          │  1. Capture video frame                      │   │
│       ▼          │  2. Run pose detection                       │   │
│  ┌──────────┐    │  3. Detect dribbles (visual + audio)         │   │
│  │  Voice   │    │  4. Fuse sensor signals                      │   │
│  │Assistant │    │  5. Score timing against beat grid            │   │
│  │ (Gemini) │    │  6. Update meter, combo, score               │   │
│  └──────────┘    │  7. Adjust music layers                      │   │
│                  │  8. Render skeleton + feedback + HUD          │   │
│                  └──────────────────────────────────────────────┘   │
│                       │              │              │                │
│              ┌────────┘      ┌───────┘      ┌──────┘                │
│              ▼               ▼              ▼                       │
│     ┌────────────┐   ┌────────────┐  ┌───────────┐                 │
│     │  Tracking   │   │   Music    │  │  Visuals  │                 │
│     │  Pipeline   │   │  System    │  │  & HUD    │                 │
│     └────────────┘   └────────────┘  └───────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
  ┌─────────────┐    ┌──────────────┐
  │  MediaPipe   │    │ Google APIs  │
  │  (WASM/GPU)  │    │ Lyria 3     │
  │  Pose Model  │    │ Gemini Live │
  └─────────────┘    └──────────────┘
```

### Data Flow

```
Webcam Frame ──▶ PoseTracker ──▶ 33 Landmarks
                                      │
                        ┌─────────────┼──────────────┐
                        ▼             ▼              ▼
                DribbleDetector  SkeletonRenderer  GeminiLive
                (wrist velocity)  (canvas overlay)  Classifier
                        │                           (style analysis)
                        ▼
Microphone ──▶ AudioDetector
                        │
                        ▼
                  SensorFusion ──────▶ Fused Dribble Event
                  (visual + audio)           │
                                             ▼
                                    ┌────────────────┐
                                    │   BeatScorer    │
                                    │ (timing judge)  │
                                    └───────┬────────┘
                                            │
                              ┌─────────────┼──────────────┐
                              ▼             ▼              ▼
                     Performance     LayeredMusic      HUD / Visual
                       Meter          Engine            Feedback
                     (0–100)        (layer unlock)    (rating popup)
```

### Tracking Pipeline

The tracking system uses two independent sensors fused into a single signal:

1. **Visual Detection** (`PoseTracker` → `DribbleDetector` → `VelocityTracker`)
   - MediaPipe Pose Landmarker runs on each video frame (GPU-accelerated WASM)
   - Extracts wrist landmark positions (indices 15, 16) per frame
   - VelocityTracker computes downward velocity of both wrists
   - A dribble fires when velocity exceeds `MIN_VELOCITY_THRESHOLD` (0.0015 normalized Y/ms) and the wrist is moving downward

2. **Audio Detection** (`AudioDetector`)
   - Web Audio API captures microphone input via `AnalyserNode`
   - Monitors amplitude spikes above a dynamic threshold (3x noise floor)
   - Used only to *confirm* visual detections, never emitted standalone (prevents speaker music false positives)

3. **Sensor Fusion** (`SensorFusion`)
   - If visual + audio fire within 80ms of each other → fused event (confidence 0.95)
   - Visual-only events emit immediately (confidence 0.7)
   - Audio-only events are discarded
   - 200ms cooldown between all events to prevent double-triggers

### Music System

The music system operates in two layers:

1. **Synthesized Layers** (`LayeredMusicEngine` via Tone.js)
   - 4 independent layers: **Drums** (always on), **Bass** (meter 25+), **Chords** (meter 50+), **Lead** (meter 75+)
   - Each genre (hip-hop, edm, lo-fi, pop) has distinct instrument presets, patterns, and effects
   - Layers fade in/out based on the performance meter via `setPerformanceLevel()`
   - BPM updates in real time from `RhythmEngine` analysis of dribble tempo
   - Includes hit SFX (per rating tier) and miss SFX (sawtooth buzz)

2. **AI-Generated Ambient Track** (`TrackGenerator` → Google Lyria 3 API)
   - Generates a genre-matched backing track at session start
   - Plays as a background layer underneath the synthesized music
   - Prompt is built from the user's config (genre, mood, energy, instruments, tempo)

### Scoring System

```
Dribble Event ──▶ BeatGrid.getNearestBeat(timestamp)
                         │
                         ▼
                   Offset (ms from nearest beat)
                         │
            ┌────────────┼────────────┬──────────────┐
            ▼            ▼            ▼              ▼
     |offset| ≤ 60  ≤ 120ms     ≤ 200ms         > 200ms
       PERFECT       GREAT        GOOD         MISS/TOO LATE
      +100 pts     +60 pts      +30 pts     -25 pts penalty
      meter +6     meter +3     meter +1      meter -15
      combo++      combo++      combo++      combo reset
```

- **Combo multiplier**: 1x → 2x (5 hits) → 3x (10 hits) → 4x (20 hits)
- **Idle decay**: If no dribble lands within `beatInterval + 70%` of a beat window, each missed beat costs 8 meter points and 25 score points
- **Timing windows** scale with difficulty (Easy is more forgiving, Hard is tighter)
- **Final grade**: Weighted formula — 50% accuracy + 25% perfect ratio + 25% combo factor → S/A/B/C/D/F

### Application States

```
config ──▶ generating ──▶ countdown ──▶ active ──▶ results
  ▲                                        │         │
  └────────────────────────────────────────┘─────────┘
                    (quit / change settings)
```

| State | What Happens |
|-------|-------------|
| `config` | User configures genre, energy, tempo, difficulty, duration. Camera preview active. |
| `generating` | Engines initialize: Tone.js audio context, MediaPipe model, Lyria track generation (~20s). |
| `countdown` | 3-second "GET READY" screen before gameplay begins. |
| `active` | Main game loop runs at 60fps. Pose tracking, dribble detection, scoring, music, and HUD all active. |
| `results` | Session complete. Shows grade, score, accuracy, hit breakdown, max combo. Play again or change settings. |

## Project Structure

```
src/
├── ai/                  # AI integrations
│   ├── GeminiLiveClassifier.js   # Real-time dribble style classification
│   └── VoiceAssistant.js         # Voice-controlled config via Gemini
├── config/
│   └── ConfigPanel.jsx           # Pre-session configuration UI
├── feedback/            # Visual feedback systems
│   ├── FeedbackManager.js        # Manages on-screen feedback
│   ├── HarmonyEngine.js          # Harmony analysis
│   ├── HarmonyMeter.js           # Harmony visualization
│   ├── ParticleSystem.js         # Particle effects
│   └── PulseRing.js              # Beat pulse ring effect
├── music/               # Music generation & playback
│   ├── AdaptiveMusicEngine.js    # Adapts music to performance
│   ├── BeatGrid.js               # Beat timing grid
│   ├── LayeredMusicEngine.js     # 4-layer Tone.js synthesizer
│   └── TrackGenerator.js         # Lyria API track generation
├── scoring/
│   └── BeatScorer.js             # Timing judgment & scoring logic
├── tracking/            # Input detection
│   ├── AudioDetector.js          # Mic-based bounce detection
│   ├── DribbleDetector.js        # Visual dribble detection
│   ├── PoseTracker.js            # MediaPipe pose tracking
│   ├── RhythmEngine.js           # Rhythm analysis
│   ├── SensorFusion.js           # Combines visual + audio signals
│   └── VelocityTracker.js        # Wrist velocity tracking
├── utils/
│   └── constants.js              # Landmark indices, thresholds, difficulty presets
├── visuals/             # Rendering
│   ├── BeatIndicator.js          # On-screen beat target indicator
│   ├── HUD.jsx                   # Main game HUD (pills, gauge, ratings)
│   └── SkeletonRenderer.js       # Pose skeleton overlay
├── App.jsx              # Main application component & game loop
├── main.jsx             # Entry point
└── index.css            # Global styles
```

## Scripts

```bash
npm run dev      # Start dev server with HMR
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## License

MIT
