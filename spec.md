# MuseMotion — Technical Specification v2

## Hackathon: LA Google DeepMind Hackathon (GLITCH @ UCLA)

---

## 1. Product Overview

### One-liner
An AI-powered app that watches you dribble a basketball, generates music that adapts to your rhythm, and scores you when you hit the beat.

### Core Experience
The user dribbles a basketball in front of their webcam. The app detects the rhythm of their dribbles using computer vision, generates music that matches their tempo and energy, and then scores them on how well they stay in sync with the generated beat. The music meets you halfway — then challenges you to keep up.

### Demo Scenario (60 seconds)
1. User opens app → sees camera preview with skeleton tracking active
2. User selects genre (hip-hop), energy (high), tempo range (90-130 BPM) from UI
3. Lyria generates a base track from the config
4. User starts dribbling — MediaPipe detects dribble rhythm
5. Music tempo adapts to match their dribble BPM
6. Beat grid locks in → scoring mode activates
7. Screen shows skeleton overlay, score counter, combo multiplier, beat indicator
8. Gemini Live detects dribble style (crossover, between legs) and layers in different sounds
9. User changes pace → music follows → the whole room feels it

---

## 2. System Architecture

### High-Level Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                        INPUT LAYER                              │
│  ┌──────────────────┐         ┌──────────────────┐             │
│  │  Webcam Feed      │         │  UI Config Panel  │             │
│  │  (30fps video)    │         │  (Genre, Energy,  │             │
│  │                   │         │   Tempo, Mood)    │             │
│  └──────┬───────────┘         └──────┬───────────┘             │
│         │                            │                          │
└─────────┼────────────────────────────┼──────────────────────────┘
          │                            │
          ▼                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     PROCESSING LAYER                            │
│  ┌──────────────────┐         ┌──────────────────┐             │
│  │  MediaPipe Pose   │         │  Gemini Live       │             │
│  │  (Client-side)    │         │  (Cloud, parallel)  │             │
│  │  33 body landmarks│         │  Style + context    │             │
│  │  @ 30fps, <33ms   │         │  @ 1fps, ~1-3s     │             │
│  └──────┬───────────┘         └──────┬───────────┘             │
│         │                            │                          │
└─────────┼────────────────────────────┼──────────────────────────┘
          │                            │
          ▼                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ANALYSIS LAYER                             │
│  ┌──────────────────┐         ┌──────────────────┐             │
│  │  Dribble Detector │         │  Creative          │             │
│  │  + Rhythm Engine  │         │  Interpreter        │             │
│  │  (client-side)    │         │  (from Gemini)      │             │
│  └──────┬───────────┘         └──────┬───────────┘             │
│         │                            │                          │
└─────────┼────────────────────────────┼──────────────────────────┘
          │                            │
          ▼                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GENERATION LAYER                             │
│              ┌──────────────────────┐                          │
│              │  Lyria Music Engine   │                          │
│              │  + Web Audio API      │                          │
│              └──────────┬───────────┘                          │
│                         │                                       │
└─────────────────────────┼───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FEEDBACK LAYER                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐               │
│  │ Beat Scorer │  │ Visual HUD │  │ Beat Bar   │               │
│  └────────────┘  └────────────┘  └────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

### Critical Architecture Constraint: Gemini Live @ 1 FPS
**Gemini Live API processes video at 1 frame per second.** Google's own docs state this makes it unsuitable for analyzing fast-changing video like high-speed sports. This means:
- Gemini Live CANNOT be used for dribble timing detection (too slow)
- Gemini Live CAN be used for style classification (doesn't need frame-level precision)
- ALL rhythm-critical detection MUST happen client-side via MediaPipe

This constraint is why the architecture splits into two parallel paths: a fast client-side path (MediaPipe, ~33ms) for rhythm, and a slow cloud path (Gemini Live, ~1-3s) for creative interpretation.

---

## 3. Setup Phase — UI Configuration

### 3.1 Config Panel (replaces voice input)

No voice input. The user configures their track through a quick UI panel. This is faster, more reliable, and removes a failure point from the demo.

**UI Layout:**
```
┌─────────────────────────────────────────────────────┐
│                   MuseMotion                        │
│                                                     │
│  ┌─── Camera Preview ────────────────────────┐     │
│  │                                            │     │
│  │     (live webcam with skeleton overlay)     │     │
│  │     (proves tracking works before start)    │     │
│  │                                            │     │
│  └────────────────────────────────────────────┘     │
│                                                     │
│  GENRE        ○ Hip-Hop  ● EDM  ○ Lo-Fi  ○ Pop    │
│                                                     │
│  ENERGY       ──────●────────────  [7/10]           │
│                                                     │
│  TEMPO RANGE  ──●────────●───────  [90-130 BPM]    │
│                                                     │
│  MOOD         ○ Aggressive  ● Upbeat  ○ Chill      │
│                                                     │
│  INSTRUMENT   ☑ Drums  ☑ Bass  ☐ Synth  ☐ Keys    │
│  FOCUS                                              │
│                                                     │
│          [ 🏀 Generate & Start ]                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Config JSON output (sent to Lyria):**
```json
{
  "genre": "edm",
  "energy": 7,
  "tempo_range": { "min": 90, "max": 130 },
  "mood": "upbeat",
  "instruments": ["drums", "bass"],
  "duration_seconds": 90
}
```

**Why UI over voice:**
- Zero latency — no waiting for speech-to-text processing
- Deterministic — voice recognition can mishear "lo-fi" as "low five"
- Demo-safe — works in a noisy hackathon venue
- Faster iteration — user can tweak settings and re-generate instantly

### 3.2 Track Generation Pipeline

1. User clicks "Generate & Start"
2. Config JSON → Lyria API
3. Lyria generates base track (5-10 second wait, show loading animation)
4. **Simultaneously pre-generate tempo variations** (see Section 6.2)
5. Extract beat grid from generated track using onset detection
6. Transition to active session with countdown: 3... 2... 1... DRIBBLE!

---

## 4. Video Input & Dribble Detection (DETAILED)

This is the most critical component. Everything downstream depends on accurate, low-latency dribble detection from the webcam feed.

### 4.1 How Computer Vision Detects a Basketball Dribble

A basketball dribble has a very specific motion signature that's detectable through body pose tracking WITHOUT needing to track the ball itself. This is important — tracking the ball (object detection) would require a separate ML model (like YOLO), adding complexity and latency. Instead, we track the BODY and infer the dribble from hand/wrist motion.

**The physics of a dribble from a pose-tracking perspective:**

When a player dribbles a basketball:
1. The wrist/hand moves DOWNWARD rapidly (pushing the ball toward the ground)
2. The wrist velocity peaks at the moment of ball release
3. The wrist briefly pauses or reverses direction at the bottom of the push
4. The wrist moves UPWARD as the ball returns (the hand follows the ball up)
5. The wrist reaches the top of its arc → brief pause
6. Cycle repeats

This creates a **periodic oscillation in the Y-coordinate of the wrist landmark** that looks like a sine wave. Each complete down-up cycle = one dribble. The frequency of this oscillation = the dribble BPM.

```
Wrist Y Position Over Time (lower Y = higher on screen)

     ╭─╮     ╭─╮     ╭─╮     ╭─╮
    ╱   ╲   ╱   ╲   ╱   ╲   ╱   ╲      ← hand at top (ball in hand)
   ╱     ╲ ╱     ╲ ╱     ╲ ╱     ╲
  ╱       ╳       ╳       ╳       ╲
──────────────────────────────────────   ← midpoint
          ╲       ╱╲      ╱╲
           ╲     ╱  ╲    ╱  ╲
            ╲   ╱    ╲  ╱    ╲
             ╰─╯      ╰─╯     ╰─╯      ← hand at bottom (ball pushed down)
                  
   ↑         ↑         ↑         ↑
   Dribble   Dribble   Dribble   Dribble
   Event     Event     Event     Event
   
   |←——————→|
    ~500ms at 120 BPM
```

### 4.2 MediaPipe Pose: Which Landmarks to Track

MediaPipe Pose outputs 33 body landmarks. For dribble detection, we only need a subset:

```
MediaPipe Landmark Indices (relevant for basketball):

       0 (nose)
      / \
    11   12        (shoulders)
    |     |
    13   14        (elbows)
    |     |
    15   16        (wrists)     ← PRIMARY tracking targets
    |     |
    17   18        (pinkies)
    19   20        (index fingers)
    21   22        (thumbs)
    
    23   24        (hips)       ← used for body center reference
    |     |
    25   26        (knees)      ← used for stance detection
```

**Primary landmarks:**
- `LEFT_WRIST (15)` and `RIGHT_WRIST (16)` — the main dribble motion signal
- `LEFT_INDEX (19)` and `RIGHT_INDEX (20)` — backup/refinement (fingertips lead the push)

**Secondary landmarks (for context):**
- `LEFT_SHOULDER (11)` and `RIGHT_SHOULDER (12)` — reference frame for relative motion
- `LEFT_HIP (23)` and `RIGHT_HIP (24)` — body center, helps normalize for camera angle
- `LEFT_ELBOW (13)` and `RIGHT_ELBOW (14)` — arm extension detection (crossover vs standard)

### 4.3 Dribble Detection Algorithm (Detailed)

The dribble detector runs EVERY FRAME (30fps). Here's the complete pipeline:

#### Step 1: Extract Wrist Position
```javascript
// MediaPipe gives normalized coordinates [0, 1]
// Convert to pixel space for velocity calculation
function extractWristData(landmarks, frameWidth, frameHeight) {
  return {
    left: {
      x: landmarks[15].x * frameWidth,
      y: landmarks[15].y * frameHeight,
      z: landmarks[15].z,  // depth — useful for crossover detection
      visibility: landmarks[15].visibility
    },
    right: {
      x: landmarks[16].x * frameWidth,
      y: landmarks[16].y * frameHeight,
      z: landmarks[16].z,
      visibility: landmarks[16].visibility
    }
  };
}
```

#### Step 2: Compute Velocity (First Derivative of Position)
```javascript
// Velocity = change in position / change in time
// We use Y-velocity because dribbling is primarily vertical motion

class VelocityTracker {
  constructor() {
    this.history = [];  // ring buffer of {y, timestamp} entries
    this.maxHistory = 5; // smoothing window
  }

  update(y, timestamp) {
    this.history.push({ y, timestamp });
    if (this.history.length > this.maxHistory) this.history.shift();
    
    if (this.history.length < 2) return 0;
    
    // Use weighted average of recent velocity samples for smoothing
    let totalVelocity = 0;
    let totalWeight = 0;
    
    for (let i = 1; i < this.history.length; i++) {
      const dy = this.history[i].y - this.history[i - 1].y;
      const dt = this.history[i].timestamp - this.history[i - 1].timestamp;
      if (dt === 0) continue;
      
      const velocity = dy / dt;  // pixels per millisecond
      const weight = i;  // recent samples weighted more
      totalVelocity += velocity * weight;
      totalWeight += weight;
    }
    
    return totalWeight > 0 ? totalVelocity / totalWeight : 0;
  }
}
```

#### Step 3: Detect Dribble Events via Zero-Crossing of Velocity
```javascript
// A dribble event occurs when the wrist transitions from moving DOWN 
// (positive Y velocity, since Y increases downward in screen coords)
// to moving UP (negative Y velocity).
// This is the moment the ball bounces — the "impact" point.

class DribbleDetector {
  constructor() {
    this.leftTracker = new VelocityTracker();
    this.rightTracker = new VelocityTracker();
    
    this.prevLeftVelocity = 0;
    this.prevRightVelocity = 0;
    
    this.lastDribbleTime = 0;
    this.MIN_DRIBBLE_INTERVAL = 200;  // ms — prevents double-triggers
    this.MIN_VELOCITY_THRESHOLD = 0.3; // pixels/ms — filters out noise
    
    // Which hand is dribbling (auto-detected)
    this.dominantHand = null;
    this.leftDribbleCount = 0;
    this.rightDribbleCount = 0;
  }

  processFrme(landmarks, frameWidth, frameHeight, timestamp) {
    const wrists = extractWristData(landmarks, frameWidth, frameHeight);
    
    const leftVelocity = this.leftTracker.update(wrists.left.y, timestamp);
    const rightVelocity = this.rightTracker.update(wrists.right.y, timestamp);
    
    let dribbleDetected = false;
    let dribbleHand = null;
    
    // Check left wrist for zero-crossing (downward → upward)
    if (this.prevLeftVelocity > this.MIN_VELOCITY_THRESHOLD && leftVelocity <= 0) {
      if (timestamp - this.lastDribbleTime > this.MIN_DRIBBLE_INTERVAL) {
        dribbleDetected = true;
        dribbleHand = 'left';
        this.leftDribbleCount++;
      }
    }
    
    // Check right wrist for zero-crossing
    if (this.prevRightVelocity > this.MIN_VELOCITY_THRESHOLD && rightVelocity <= 0) {
      if (timestamp - this.lastDribbleTime > this.MIN_DRIBBLE_INTERVAL) {
        dribbleDetected = true;
        dribbleHand = 'right';
        this.rightDribbleCount++;
      }
    }
    
    if (dribbleDetected) {
      this.lastDribbleTime = timestamp;
      
      // Auto-detect dominant hand after 10 dribbles
      if (this.leftDribbleCount + this.rightDribbleCount > 10) {
        this.dominantHand = this.leftDribbleCount > this.rightDribbleCount 
          ? 'left' : 'right';
      }
    }
    
    this.prevLeftVelocity = leftVelocity;
    this.prevRightVelocity = rightVelocity;
    
    return {
      detected: dribbleDetected,
      hand: dribbleHand,
      timestamp: timestamp,
      velocityMagnitude: dribbleHand === 'left' 
        ? Math.abs(this.prevLeftVelocity) 
        : Math.abs(this.prevRightVelocity),
      wristPositions: wrists
    };
  }
}
```

#### Step 4: Extract Rhythm (BPM from Dribble Intervals)
```javascript
class RhythmEngine {
  constructor() {
    this.dribbleTimestamps = [];   // circular buffer
    this.MAX_HISTORY = 20;
    this.currentBPM = 0;
    this.bpmStable = false;        // true after sufficient samples
    this.bpmHistory = [];          // for smoothing BPM transitions
    this.MAX_BPM_HISTORY = 8;
  }

  onDribble(timestamp) {
    this.dribbleTimestamps.push(timestamp);
    if (this.dribbleTimestamps.length > this.MAX_HISTORY) {
      this.dribbleTimestamps.shift();
    }

    if (this.dribbleTimestamps.length < 4) {
      this.bpmStable = false;
      return null;
    }

    // Calculate inter-dribble intervals
    const intervals = [];
    for (let i = 1; i < this.dribbleTimestamps.length; i++) {
      intervals.push(this.dribbleTimestamps[i] - this.dribbleTimestamps[i - 1]);
    }

    // Outlier rejection: remove intervals that deviate > 40% from median
    const sorted = [...intervals].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const filtered = intervals.filter(
      i => Math.abs(i - median) / median < 0.4
    );

    if (filtered.length < 3) return null;

    // Exponential weighted moving average (recent intervals matter more)
    const alpha = 0.3;  // smoothing factor
    let ewma = filtered[0];
    for (let i = 1; i < filtered.length; i++) {
      ewma = alpha * filtered[i] + (1 - alpha) * ewma;
    }

    const rawBPM = 60000 / ewma;

    // Smooth BPM transitions to prevent jitter
    this.bpmHistory.push(rawBPM);
    if (this.bpmHistory.length > this.MAX_BPM_HISTORY) {
      this.bpmHistory.shift();
    }

    // Weighted average of BPM history
    const weights = this.bpmHistory.map((_, i) => Math.pow(2, i));
    const weightSum = weights.reduce((a, b) => a + b, 0);
    this.currentBPM = this.bpmHistory.reduce(
      (sum, bpm, i) => sum + bpm * weights[i], 0
    ) / weightSum;

    // Clamp to reasonable basketball dribble range
    this.currentBPM = Math.max(60, Math.min(200, this.currentBPM));

    // Mark stable after 6+ consistent readings
    const variance = this.calculateVariance(this.bpmHistory);
    this.bpmStable = this.bpmHistory.length >= 6 && variance < 100;

    return {
      bpm: Math.round(this.currentBPM),
      stable: this.bpmStable,
      confidence: Math.min(1, this.bpmHistory.length / 8),
      intervalMs: ewma
    };
  }

  calculateVariance(arr) {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
  }
}
```

### 4.4 Handling Edge Cases in Dribble Detection

**Problem: Camera angle variation**
- Users won't always be perfectly side-on to the camera
- Frontal view compresses the Y-axis motion of a dribble
- Solution: Use the Z-coordinate from MediaPipe (depth estimate) as a secondary signal. In a frontal view, the dribble motion shows up more in Z (toward/away from camera) than Y
- Combine Y and Z velocity: `effectiveVelocity = sqrt(vy² + vz²)`

**Problem: Walking/stepping while dribbling**
- Whole-body vertical motion (bouncing while walking) creates false positives
- Solution: Normalize wrist position RELATIVE to the shoulder on the same side
- `relativeWristY = wrist.y - shoulder.y`
- This isolates arm motion from whole-body motion

```javascript
function getRelativeWristY(landmarks, hand) {
  const wristIdx = hand === 'left' ? 15 : 16;
  const shoulderIdx = hand === 'left' ? 11 : 12;
  
  return landmarks[wristIdx].y - landmarks[shoulderIdx].y;
}
```

**Problem: Crossover dribbles create irregular timing**
- A crossover switches the ball between hands mid-rhythm
- The interval between hand switches may differ from the base dribble interval
- Solution: Track BOTH wrists independently and merge events into a single timeline
- A crossover is detected when: left dribble → right dribble (or vice versa) within 1.5x the average interval

**Problem: Behind-the-back / between-the-legs dribbles**
- These moves temporarily occlude the wrist from the camera
- MediaPipe landmark visibility drops below threshold
- Solution: If visibility < 0.5 for a wrist, fall back to elbow tracking for that hand (elbows are rarely occluded). The elbow Y-velocity during a behind-the-back move still shows the same periodic pattern, just with less amplitude

```javascript
function getBestTrackingPoint(landmarks, hand) {
  const wristIdx = hand === 'left' ? 15 : 16;
  const elbowIdx = hand === 'left' ? 13 : 14;
  
  if (landmarks[wristIdx].visibility > 0.5) {
    return { 
      y: landmarks[wristIdx].y, 
      source: 'wrist',
      confidence: landmarks[wristIdx].visibility
    };
  } else {
    return { 
      y: landmarks[elbowIdx].y, 
      source: 'elbow',
      confidence: landmarks[elbowIdx].visibility * 0.7  // lower confidence
    };
  }
}
```

**Problem: Multiple people in frame**
- MediaPipe Pose (single-person mode) tracks the most prominent person
- If someone walks behind the dribbler, it can jump to the new person
- Solution: Use MediaPipe's `min_tracking_confidence` set high (0.8) so it sticks to the initial person. If tracking is lost, re-detect but don't count the interruption as a dribble

### 4.5 Audio-Based Dribble Detection (Backup / Fusion)

The ball hitting the floor creates a sharp acoustic transient that's detectable from the microphone. This serves as a SECONDARY confirmation signal to improve accuracy.

```javascript
class AudioDribbleDetector {
  constructor() {
    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    this.bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);
    
    this.prevEnergy = 0;
    this.threshold = 0.6;  // calibrate during warmup
    this.lastTrigger = 0;
  }

  async init() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = this.audioContext.createMediaStreamSource(stream);
    source.connect(this.analyser);
  }

  detect(timestamp) {
    this.analyser.getByteTimeDomainData(this.dataArray);
    
    // Calculate short-term energy (RMS)
    let sum = 0;
    for (let i = 0; i < this.bufferLength; i++) {
      const normalized = (this.dataArray[i] - 128) / 128;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / this.bufferLength);
    
    // Detect transient: sudden energy spike
    const energyDelta = rms - this.prevEnergy;
    this.prevEnergy = rms * 0.7 + this.prevEnergy * 0.3;  // smooth
    
    if (energyDelta > this.threshold && timestamp - this.lastTrigger > 150) {
      this.lastTrigger = timestamp;
      return { detected: true, energy: rms, timestamp };
    }
    
    return { detected: false };
  }
}
```

**Sensor fusion: combining visual and audio detection:**
```javascript
function fuseDribbleSignals(visualEvent, audioEvent, toleranceMs = 80) {
  // Case 1: Both signals agree within tolerance → high confidence dribble
  if (visualEvent.detected && audioEvent.detected) {
    const timeDiff = Math.abs(visualEvent.timestamp - audioEvent.timestamp);
    if (timeDiff < toleranceMs) {
      return { 
        detected: true, 
        confidence: 0.95,
        timestamp: (visualEvent.timestamp + audioEvent.timestamp) / 2,
        source: 'fused'
      };
    }
  }
  
  // Case 2: Only visual → medium confidence
  if (visualEvent.detected) {
    return { 
      detected: true, 
      confidence: 0.7,
      timestamp: visualEvent.timestamp,
      source: 'visual'
    };
  }
  
  // Case 3: Only audio → lower confidence (could be footstep, etc.)
  if (audioEvent.detected) {
    return { 
      detected: true, 
      confidence: 0.4,
      timestamp: audioEvent.timestamp,
      source: 'audio'
    };
  }
  
  return { detected: false };
}
```

### 4.6 Complete Per-Frame Pipeline

```
EVERY FRAME (~33ms at 30fps):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 1. CAPTURE
    └── Webcam frame captured
    
 2. POSE ESTIMATION (MediaPipe, client-side, ~10-15ms)
    ├── Input: RGB frame
    ├── Output: 33 landmark coordinates (x, y, z, visibility)
    └── Runs on GPU via WebGL backend
    
 3. LANDMARK EXTRACTION (~0.1ms)
    ├── Extract wrist positions (landmarks 15, 16)
    ├── Extract shoulder positions (landmarks 11, 12) for normalization
    ├── Check visibility scores → fall back to elbows if wrists occluded
    └── Compute relative wrist Y: wrist.y - shoulder.y
    
 4. VELOCITY COMPUTATION (~0.1ms)
    ├── Compute Y-velocity from position history (weighted avg, 5-frame window)
    ├── Compute Z-velocity for frontal camera angles
    └── Compute effective velocity: sqrt(vy² + vz²)
    
 5. DRIBBLE EVENT DETECTION (~0.1ms)
    ├── Check for velocity zero-crossing (positive → negative = bounce)
    ├── Apply minimum velocity threshold (filters hand gestures, noise)
    ├── Apply minimum interval debounce (200ms = max 300 BPM)
    ├── Record which hand triggered the event
    └── Output: { detected: bool, hand: str, timestamp: ms, magnitude: float }
    
 6. AUDIO DETECTION (parallel, ~0.5ms)
    ├── Analyze mic input for transient spikes (ball bounce sound)
    └── Output: { detected: bool, energy: float, timestamp: ms }
    
 7. SENSOR FUSION (~0.1ms)
    ├── Compare visual and audio timestamps
    ├── If both agree within 80ms → high confidence event
    ├── If only visual → medium confidence
    └── If only audio → low confidence (might be footstep)
    
 8. IF DRIBBLE EVENT DETECTED:
    │
    ├── 8a. RHYTHM ENGINE UPDATE (~0.1ms)
    │   ├── Add timestamp to dribble history buffer
    │   ├── Calculate inter-dribble intervals
    │   ├── Reject outliers (>40% deviation from median)
    │   ├── Compute EWMA of intervals → raw BPM
    │   ├── Smooth BPM via weighted history
    │   ├── Assess stability (variance < threshold)
    │   └── Output: { bpm: int, stable: bool, confidence: float }
    │
    ├── 8b. BEAT SCORING (~0.1ms)
    │   ├── Compare dribble timestamp against beat grid
    │   ├── Find nearest beat marker
    │   ├── Calculate offset (ms)
    │   ├── Assign rating: perfect(±50ms)/great(±100ms)/good(±150ms)/miss
    │   ├── Update combo counter
    │   └── Output: { score: int, rating: str, combo: int, multiplier: int }
    │
    └── 8c. MUSIC ENGINE UPDATE (~1ms)
        ├── If BPM changed > 3 from current: adjust playbackRate
        ├── If BPM changed > 15 from current: crossfade to nearest tempo track
        └── Recalculate beat grid for new tempo

 9. RENDER (~5ms)
    ├── Draw skeleton overlay on canvas (colored by last score rating)
    ├── Draw beat indicator bar (scrolling beat markers)
    ├── Update HUD (score, combo, BPM)
    └── If perfect/great hit: trigger particle effect

10. GEMINI LIVE (parallel, async, every ~1 second)
    ├── Send current frame to Gemini Live WebSocket
    ├── Receive classification update (if any)
    └── Update instrument palette based on classification

TOTAL PER-FRAME BUDGET: ~16-20ms (leaves headroom for 30fps)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 5. Gemini Live — Creative Layer (NOT Timing Layer)

### 5.1 What Gemini Live Does (and Does NOT Do)

**DOES (creative interpretation, latency-tolerant):**
- Classifies the overall dribble STYLE every 1-3 seconds
- Detects energy/intensity level
- Recognizes dribble patterns (steady pace vs freestyle vs drills)
- Detects transitions (player switching from stationary to moving)

**DOES NOT (these are all handled client-side):**
- Detect individual dribble events
- Measure dribble timing or rhythm
- Score timing accuracy
- Track BPM

### 5.2 Gemini Live Integration

```javascript
// Gemini Live WebSocket connection
// Send frames at ~1fps (matching Gemini's processing rate)

class GeminiLiveClassifier {
  constructor(apiKey) {
    this.ws = null;
    this.apiKey = apiKey;
    this.currentClassification = {
      style: 'standard',
      energy: 5,
      pattern: 'steady',
      confidence: 0
    };
    this.frameInterval = 1000; // send 1 frame per second
    this.lastFrameSent = 0;
  }

  async connect() {
    // WebSocket connection to Gemini Live API
    this.ws = new WebSocket(
      `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${this.apiKey}`
    );

    this.ws.onopen = () => {
      // Send setup message with system prompt
      this.ws.send(JSON.stringify({
        setup: {
          model: "models/gemini-2.0-flash-live-preview-04-09",
          generationConfig: {
            responseModalities: ["TEXT"],
            temperature: 0.1  // low temperature for consistent classifications
          },
          systemInstruction: {
            parts: [{
              text: `You are a basketball dribble analyzer. You receive video frames 
              of a person dribbling a basketball. Respond ONLY with a JSON object 
              classifying what you observe. Do not include any other text.

              Output format:
              {
                "style": "standard" | "crossover" | "between_legs" | "behind_back" | "spin" | "hesitation",
                "energy": <1-10>,
                "pattern": "steady" | "accelerating" | "decelerating" | "freestyle" | "stationary",
                "hand": "left" | "right" | "alternating",
                "confidence": <0.0-1.0>
              }
              
              Only update fields you can observe. If unsure, keep previous values.
              "style" = the specific dribble move visible in the CURRENT frame.
              "energy" = how intensely the player is moving (1=standing still, 10=full sprint dribble).
              "pattern" = the overall rhythm pattern over the last few seconds.`
            }]
          }
        }
      }));
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // Extract text response and parse JSON classification
      if (data.serverContent?.modelTurn?.parts) {
        const text = data.serverContent.modelTurn.parts
          .filter(p => p.text)
          .map(p => p.text)
          .join('');
        
        try {
          const classification = JSON.parse(text);
          this.currentClassification = {
            ...this.currentClassification,
            ...classification
          };
        } catch (e) {
          // Gemini sometimes returns partial JSON — ignore
        }
      }
    };
  }

  maybeSendFrame(canvas, timestamp) {
    if (timestamp - this.lastFrameSent < this.frameInterval) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.lastFrameSent = timestamp;

    // Capture frame from canvas, compress to JPEG, send as base64
    const frameData = canvas.toDataURL('image/jpeg', 0.5);  // low quality = faster
    const base64 = frameData.split(',')[1];

    this.ws.send(JSON.stringify({
      realtimeInput: {
        mediaChunks: [{
          mimeType: "image/jpeg",
          data: base64
        }]
      }
    }));
  }

  getClassification() {
    return this.currentClassification;
  }
}
```

### 5.3 Gesture-to-Sound Mapping

Gemini's style classification drives instrument layer switching:

| Dribble Style | Sound Layer | Description |
|---------------|-------------|-------------|
| `standard` | Base drums + hi-hat | Clean, steady percussion |
| `crossover` | Snare accent + vinyl scratch | Sharp, punctuating hit |
| `between_legs` | Sub-bass drop | Deep, impactful low-end |
| `behind_back` | Synth flourish + reverb | Atmospheric swell |
| `spin` | Cymbal crash + filter sweep | Dramatic, wide sound |
| `hesitation` | Stutter/glitch effect | Rhythmic interruption |

Energy level (1-10) controls:
- Master filter cutoff (low energy = muffled, high = bright/sharp)
- Reverb wet/dry mix (low energy = more reverb/spacious, high = tight/dry)
- Compression ratio (high energy = more compressed/loud)
- Additional percussion layers (energy > 7 = add toms/claps)

---

## 6. Lyria Music Engine

### 6.1 Track Generation from UI Config

```javascript
async function generateTrack(config) {
  // Convert UI config to Lyria-compatible prompt/parameters
  // (Exact format TBD — depends on hackathon API access)
  
  const lyriaPrompt = buildLyriaPrompt(config);
  
  const response = await fetch(LYRIA_API_ENDPOINT, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${API_KEY}` },
    body: JSON.stringify({
      prompt: lyriaPrompt,
      duration_seconds: config.duration_seconds || 90,
      // ... other Lyria params
    })
  });
  
  const audioBlob = await response.blob();
  return audioBlob;
}

function buildLyriaPrompt(config) {
  // Construct a descriptive prompt from UI selections
  const parts = [];
  
  parts.push(`${config.genre} instrumental track`);
  
  if (config.energy >= 7) parts.push('high energy, driving rhythm');
  else if (config.energy >= 4) parts.push('moderate energy, steady groove');
  else parts.push('low energy, ambient, atmospheric');
  
  parts.push(`${config.mood} mood`);
  parts.push(`tempo around ${Math.round((config.tempo_range.min + config.tempo_range.max) / 2)} BPM`);
  
  if (config.instruments.length > 0) {
    parts.push(`featuring ${config.instruments.join(', ')}`);
  }
  
  parts.push('suitable for rhythmic physical activity');
  parts.push('strong clear beat for timing');
  
  return parts.join(', ');
}
```

### 6.2 Tempo Adaptation Strategy

**The core problem:** Lyria almost certainly generates a fixed-tempo track. The user's dribble BPM won't match exactly.

**Solution: Multi-track + playbackRate fine-tuning**

```javascript
class AdaptiveMusicEngine {
  constructor(audioContext) {
    this.ctx = audioContext;
    this.tracks = new Map();       // Map<baseBPM, AudioBuffer>
    this.currentSource = null;
    this.currentBPM = null;
    this.targetBPM = null;
    this.gainNode = this.ctx.createGain();
    this.gainNode.connect(this.ctx.destination);
  }

  // During setup: generate multiple tempo variations
  async generateTempoVariations(config) {
    const baseTempo = Math.round(
      (config.tempo_range.min + config.tempo_range.max) / 2
    );
    
    // Generate tracks at 4 tempo points spanning the user's range
    const tempos = [
      config.tempo_range.min,
      baseTempo - 10,
      baseTempo + 10,
      config.tempo_range.max
    ];
    
    // Generate in parallel for speed
    const promises = tempos.map(async (bpm) => {
      const modifiedConfig = { ...config, tempo_range: { min: bpm, max: bpm } };
      const audioBlob = await generateTrack(modifiedConfig);
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.tracks.set(bpm, audioBuffer);
    });
    
    await Promise.all(promises);
    
    // Start with the middle tempo
    this.currentBPM = baseTempo;
    this.playTrack(baseTempo);
  }

  playTrack(bpm) {
    const buffer = this.findNearestTrack(bpm);
    
    if (this.currentSource) {
      // Crossfade: ramp old source down, new source up
      const oldGain = this.ctx.createGain();
      oldGain.gain.setValueAtTime(1, this.ctx.currentTime);
      oldGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 2);
      this.currentSource.disconnect();
      this.currentSource.connect(oldGain);
      oldGain.connect(this.ctx.destination);
      
      // Stop old source after crossfade
      setTimeout(() => {
        try { this.currentSource.stop(); } catch (e) {}
      }, 2500);
    }
    
    const source = this.ctx.createBufferSource();
    source.buffer = buffer.audioBuffer;
    source.loop = true;
    
    // Fine-tune with playbackRate (safe within ±15%)
    const rate = bpm / buffer.baseBPM;
    source.playbackRate.value = Math.max(0.85, Math.min(1.15, rate));
    
    const newGain = this.ctx.createGain();
    newGain.gain.setValueAtTime(0, this.ctx.currentTime);
    newGain.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 2);
    
    source.connect(newGain);
    newGain.connect(this.gainNode);
    source.start(0);
    
    this.currentSource = source;
    this.currentBPM = bpm;
  }

  findNearestTrack(targetBPM) {
    let nearest = null;
    let nearestDiff = Infinity;
    
    for (const [bpm, buffer] of this.tracks) {
      const diff = Math.abs(bpm - targetBPM);
      if (diff < nearestDiff) {
        nearestDiff = diff;
        nearest = { baseBPM: bpm, audioBuffer: buffer };
      }
    }
    
    return nearest;
  }

  // Called by rhythm engine when user BPM changes
  updateTempo(userBPM) {
    this.targetBPM = userBPM;
    
    const currentRate = this.currentSource?.playbackRate.value || 1;
    const effectiveBPM = this.currentBPM * currentRate;
    const diff = Math.abs(effectiveBPM - userBPM);
    
    if (diff < 3) return;  // close enough, don't adjust
    
    // Can we handle it with playbackRate alone?
    const nearest = this.findNearestTrack(userBPM);
    const neededRate = userBPM / nearest.baseBPM;
    
    if (neededRate > 0.85 && neededRate < 1.15) {
      // Yes — just adjust playbackRate (smooth, no audible artifacts)
      this.currentSource.playbackRate.linearRampToValueAtTime(
        neededRate,
        this.ctx.currentTime + 1  // ramp over 1 second
      );
    } else {
      // Need to switch to a different base track
      this.playTrack(userBPM);
    }
  }
}
```

### 6.3 Beat Grid Management

```javascript
class BeatGrid {
  constructor() {
    this.bpm = 120;
    this.beats = [];         // array of absolute timestamps (ms)
    this.startTime = null;
    this.lookAheadMs = 3000; // pre-compute 3 seconds of beats ahead
  }

  initialize(bpm, startTime) {
    this.bpm = bpm;
    this.startTime = startTime;
    this.regenerate();
  }

  regenerate() {
    const intervalMs = 60000 / this.bpm;
    this.beats = [];
    
    const now = performance.now();
    // Find the nearest beat to "now" and build forward
    const elapsed = now - this.startTime;
    const beatsSinceStart = Math.floor(elapsed / intervalMs);
    const nextBeatTime = this.startTime + (beatsSinceStart + 1) * intervalMs;
    
    // Generate beats from now to lookAhead
    for (let t = nextBeatTime; t < now + this.lookAheadMs; t += intervalMs) {
      this.beats.push(t);
    }
  }

  updateBPM(newBPM) {
    if (Math.abs(newBPM - this.bpm) < 2) return;  // ignore tiny changes
    
    // Smooth transition: don't snap, interpolate over 4 beats
    const oldInterval = 60000 / this.bpm;
    const newInterval = 60000 / newBPM;
    
    this.bpm = newBPM;
    
    // Rebuild the grid from the last confirmed beat
    const now = performance.now();
    const lastBeat = this.beats.filter(b => b <= now).pop() || now;
    
    this.beats = this.beats.filter(b => b <= now);
    
    // Gradually interpolate interval over 4 beats
    let currentInterval = oldInterval;
    const step = (newInterval - oldInterval) / 4;
    let nextBeat = lastBeat;
    
    for (let i = 0; i < 20; i++) {
      if (i < 4) {
        currentInterval += step;
      } else {
        currentInterval = newInterval;
      }
      nextBeat += currentInterval;
      this.beats.push(nextBeat);
    }
  }

  // Get the nearest beat to a given timestamp
  getNearestBeat(timestamp) {
    let nearest = this.beats[0];
    let minDiff = Math.abs(timestamp - nearest);
    
    for (const beat of this.beats) {
      const diff = Math.abs(timestamp - beat);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = beat;
      }
    }
    
    return { beatTime: nearest, offsetMs: timestamp - nearest };
  }

  // Get upcoming beats for the beat indicator bar
  getUpcomingBeats(currentTime, count = 8) {
    return this.beats
      .filter(b => b > currentTime)
      .slice(0, count)
      .map(b => ({ time: b, relativeMs: b - currentTime }));
  }
}
```

---

## 7. Beat Scoring System

### 7.1 Scoring Windows

| Window | Threshold | Points | Visual | Sound |
|--------|-----------|--------|--------|-------|
| Perfect | ±50ms | 100 | Gold burst + screen flash | Bright chime |
| Great | ±100ms | 75 | Blue burst | Soft chime |
| Good | ±150ms | 50 | Green pulse | Subtle click |
| Miss | >150ms | 0 | Red skeleton flash | None |

### 7.2 Scoring Implementation

```javascript
class BeatScorer {
  constructor(beatGrid) {
    this.beatGrid = beatGrid;
    this.totalScore = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.multiplier = 1;
    this.hitCounts = { perfect: 0, great: 0, good: 0, miss: 0 };
    this.totalDribbles = 0;
  }

  scoreDribble(dribbleTimestamp) {
    this.totalDribbles++;
    const { beatTime, offsetMs } = this.beatGrid.getNearestBeat(dribbleTimestamp);
    const absOffset = Math.abs(offsetMs);

    let result;

    if (absOffset <= 50) {
      result = { rating: 'perfect', basePoints: 100 };
      this.combo++;
      this.hitCounts.perfect++;
    } else if (absOffset <= 100) {
      result = { rating: 'great', basePoints: 75 };
      this.combo++;
      this.hitCounts.great++;
    } else if (absOffset <= 150) {
      result = { rating: 'good', basePoints: 50 };
      this.combo++;
      this.hitCounts.good++;
    } else {
      result = { rating: 'miss', basePoints: 0 };
      this.combo = 0;
      this.multiplier = 1;
      this.hitCounts.miss++;
    }

    // Update multiplier based on combo
    if (this.combo >= 50) this.multiplier = 8;
    else if (this.combo >= 20) this.multiplier = 4;
    else if (this.combo >= 10) this.multiplier = 2;
    else if (this.combo >= 5) this.multiplier = 1.5;
    else this.multiplier = 1;

    const points = Math.round(result.basePoints * this.multiplier);
    this.totalScore += points;
    this.maxCombo = Math.max(this.maxCombo, this.combo);

    return {
      ...result,
      points,
      offsetMs,
      combo: this.combo,
      multiplier: this.multiplier,
      totalScore: this.totalScore
    };
  }

  getStats() {
    return {
      totalScore: this.totalScore,
      maxCombo: this.maxCombo,
      totalDribbles: this.totalDribbles,
      accuracy: this.totalDribbles > 0
        ? ((this.hitCounts.perfect + this.hitCounts.great) / this.totalDribbles * 100).toFixed(1)
        : 0,
      hitCounts: { ...this.hitCounts }
    };
  }
}
```

---

## 8. Visual Feedback Layer

### 8.1 HUD Layout

```
┌────────────────────────────────────────────────────────┐
│  SCORE: 12,450          BPM: 112       COMBO: 23x(4x) │
│                                                         │
│                                                         │
│              ┌──── Skeleton Overlay ────┐               │
│              │   (colored by score)     │               │
│              │                          │               │
│              │   Green = on beat        │               │
│              │   Gold = perfect         │               │
│              │   Red = miss             │               │
│              │                          │               │
│              └──────────────────────────┘               │
│                                                         │
│  STYLE: crossover              ENERGY: ████████░░ 8/10  │
│                                                         │
│  ◇ · · · ◆ · · · ◇ · · · ◆ · · · ◇ · · · ◆           │
│  ← beat indicator bar (◆ = beat, scroll left to right)  │
└────────────────────────────────────────────────────────┘
```

### 8.2 Beat Indicator Bar

The beat indicator bar is the "note highway" — scrolling markers that show the user when to dribble.

```javascript
class BeatIndicator {
  constructor(canvas, beatGrid) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.beatGrid = beatGrid;
    this.barWidth = canvas.width;
    this.barHeight = 40;
    this.barY = canvas.height - 50;
    this.lookAheadMs = 2000;  // show 2 seconds of upcoming beats
  }

  render(currentTime) {
    const ctx = this.ctx;
    
    // Draw bar background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, this.barY, this.barWidth, this.barHeight);
    
    // Draw center line (the "hit zone")
    const centerX = this.barWidth * 0.2;  // hit zone at 20% from left
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, this.barY);
    ctx.lineTo(centerX, this.barY + this.barHeight);
    ctx.stroke();
    
    // Draw upcoming beat markers scrolling from right to left
    const upcomingBeats = this.beatGrid.getUpcomingBeats(currentTime, 10);
    
    for (const beat of upcomingBeats) {
      // Map time to X position
      const progress = beat.relativeMs / this.lookAheadMs;
      const x = centerX + (progress * (this.barWidth - centerX));
      
      if (x < 0 || x > this.barWidth) continue;
      
      // Beat marker
      const size = 8;
      ctx.fillStyle = progress < 0.1 
        ? '#FFD700'  // gold when close
        : 'rgba(255, 255, 255, 0.6)';
      
      ctx.beginPath();
      // Diamond shape
      ctx.moveTo(x, this.barY + this.barHeight / 2 - size);
      ctx.lineTo(x + size, this.barY + this.barHeight / 2);
      ctx.lineTo(x, this.barY + this.barHeight / 2 + size);
      ctx.lineTo(x - size, this.barY + this.barHeight / 2);
      ctx.closePath();
      ctx.fill();
    }
  }
}
```

---

## 9. User Flow (Complete)

```
APP OPEN
  │
  ▼
[Camera + Mic Permission Request]
  │
  ▼
[Config Screen]
  ├── Camera preview (live skeleton overlay — proves tracking works)
  ├── Genre selector: Hip-Hop | EDM | Lo-Fi | Pop | Rock | Jazz
  ├── Energy slider: 1-10
  ├── Tempo range: dual-handle slider (60-200 BPM)
  ├── Mood selector: Aggressive | Upbeat | Chill | Dark | Playful
  ├── Instrument focus: multi-select checkboxes
  ├── [ 🏀 Generate & Start ] button
  │
  ▼
[Generating Your Track...]
  ├── Lyria generates base track from UI config
  ├── Pre-generate tempo variations in parallel (3-4 tracks)
  ├── Extract beat grid via onset detection
  ├── ~8-15 seconds, show progress animation
  │
  ▼
[Countdown: 3... 2... 1... DRIBBLE!]
  │
  ▼
[Active Session]
  │
  ├── PHASE 1: WARMUP (0-5 seconds)
  │   ├── Music plays at generated tempo
  │   ├── MediaPipe tracks wrist motion, building rhythm profile
  │   ├── Audio dribble detector calibrates threshold
  │   ├── No scoring — "Finding your rhythm..." overlay
  │   ├── Dominant hand auto-detected
  │   ├── Gemini Live stream starts classifying
  │   └── BPM readout shown but grayed out (stabilizing)
  │
  ├── PHASE 2: ADAPTIVE (5-15 seconds)
  │   ├── BPM stabilizes → music tempo starts converging to user BPM
  │   ├── Beat grid recalculates with smooth interpolation (over 4 beats)
  │   ├── playbackRate adjusts (or crossfade if large tempo gap)
  │   ├── Scoring begins — soft mode (no combo yet)
  │   ├── Beat indicator bar appears
  │   ├── Gemini Live classifications start driving instrument layers
  │   └── "Locked in!" flash when BPM variance drops below threshold
  │
  ├── PHASE 3: LOCKED IN (15+ seconds)
  │   ├── Full scoring with combo multiplier active
  │   ├── Visual effects at full intensity
  │   ├── Instrument layers respond to Gemini style classifications
  │   ├── Energy level adjustments affect sound processing
  │   ├── If user changes pace significantly → music follows within 2-3 seconds
  │   └── Particle effects on perfect hits, screen flash on combo milestones
  │
  ▼
[Session End]
  ├── Triggered by: user presses stop, or 90 second max
  ├── Music fades out over 2 seconds
  │
  ▼
[Score Summary Screen]
  ├── Total score with grade (S / A / B / C / D)
  ├── Max combo
  ├── Hit breakdown: X perfect, Y great, Z good, W miss
  ├── Accuracy percentage
  ├── Average BPM
  ├── Dribble style breakdown (from Gemini data)
  ├── [ Play Again ] [ Change Style ] buttons
  └── (Stretch: screenshot export for sharing)
```

---

## 10. Tech Stack

### Frontend
| Technology | Purpose | Critical? |
|-----------|---------|-----------|
| React (or vanilla JS + Vite) | UI framework | Yes |
| MediaPipe Pose (@mediapipe/tasks-vision) | Body tracking, 33 landmarks @ 30fps | Yes — core |
| Web Audio API | Playback, crossfade, effects, timing clock | Yes — core |
| Canvas API | Skeleton overlay, particles, HUD, beat bar | Yes |
| WebSocket (native) | Gemini Live connection | Stretch |

### Backend / APIs
| Technology | Purpose | Critical? |
|-----------|---------|-----------|
| Lyria API | Music generation | Yes — core |
| Gemini Live API | Style classification (1fps) | Stretch |
| No backend needed | Client-side only app (API keys in env) | — |

### Key NPM Packages
```json
{
  "dependencies": {
    "@mediapipe/tasks-vision": "latest",
    "tone": "latest"
  },
  "devDependencies": {
    "vite": "latest"
  }
}
```

---

## 11. File Structure

```
musemotion/
├── index.html
├── vite.config.js
├── src/
│   ├── main.js                     # App entry, state machine
│   ├── config/
│   │   ├── ConfigPanel.js          # UI config component
│   │   └── configSchema.js         # Default values, validation
│   ├── tracking/
│   │   ├── PoseTracker.js          # MediaPipe Pose wrapper
│   │   ├── DribbleDetector.js      # Wrist velocity → dribble events
│   │   ├── AudioDetector.js        # Mic-based bounce detection
│   │   ├── SensorFusion.js         # Combine visual + audio signals
│   │   └── RhythmEngine.js         # Dribble timestamps → BPM
│   ├── music/
│   │   ├── AdaptiveMusicEngine.js  # Multi-track playback + crossfade
│   │   ├── BeatGrid.js             # Beat timestamp management
│   │   ├── InstrumentLayers.js     # Sound layers for style changes
│   │   └── TrackGenerator.js       # Config → Lyria API → audio
│   ├── ai/
│   │   └── GeminiLiveClassifier.js # WebSocket stream, style classification
│   ├── scoring/
│   │   ├── BeatScorer.js           # Dribble timestamp vs beat grid
│   │   └── SessionStats.js         # Aggregate stats for summary
│   ├── visuals/
│   │   ├── SkeletonRenderer.js     # Pose overlay, colored by score
│   │   ├── BeatIndicator.js        # Scrolling beat bar
│   │   ├── HUD.js                  # Score, combo, BPM display
│   │   ├── ParticleSystem.js       # Hit effect particles
│   │   └── SummaryScreen.js        # End-of-session stats
│   └── utils/
│       ├── constants.js            # Landmark indices, scoring thresholds
│       ├── math.js                 # EWMA, variance, peak detection
│       └── timing.js               # High-precision timing utilities
├── assets/
│   └── sounds/
│       ├── perfect.wav
│       ├── great.wav
│       ├── good.wav
│       └── combo-milestone.wav
├── styles/
│   └── main.css
└── package.json
```

---

## 12. Critical Technical Risks & Mitigations

### Risk 1: Lyria can't adjust tempo in real-time
- **Likelihood:** High
- **Impact:** High — core feature breaks
- **Mitigation:** Pre-generate tracks at multiple tempos, crossfade + playbackRate
- **Fallback:** Single track, playbackRate only (sounds ok within ±15%)

### Risk 2: Dribble detection false positives (hand gestures, body sway)
- **Likelihood:** Medium
- **Impact:** Medium — bad scoring
- **Mitigation:** 
  - Shoulder-relative normalization (filters whole-body motion)
  - Minimum velocity threshold (filters small gestures)
  - 200ms debounce (prevents double-triggers)
  - Audio fusion (visual + mic confirms real dribbles)
- **Fallback:** Audio-only dribble detection if visual is too noisy

### Risk 3: Gemini Live adds no value / classifications are wrong
- **Likelihood:** Medium (1fps is coarse for basketball)
- **Impact:** Low — Gemini is a stretch goal, not core
- **Mitigation:** Pre-map a default instrument set that sounds good without Gemini
- **Fallback:** Skip Gemini entirely, hard-code instrument layers

### Risk 4: Web Audio API timing precision
- **Likelihood:** Low
- **Impact:** High — scoring feels wrong
- **Mitigation:** Use `AudioContext.currentTime` and `performance.now()` for all timing. NEVER use `Date.now()` or `setTimeout` for audio-critical paths
- **Tip:** `performance.now()` gives sub-millisecond precision

### Risk 5: Lyria API not available / different than expected at hackathon
- **Likelihood:** Medium
- **Impact:** Critical — no music generation
- **Mitigation:** Prepare 4-5 pre-made tracks at different BPMs as a cold fallback
- **Fallback:** Use free royalty-free loops from Freesound as the base track

### Risk 6: MediaPipe + Canvas + Audio causes frame drops on hackathon laptop
- **Likelihood:** Medium
- **Impact:** Medium — laggy experience
- **Mitigation:** 
  - MediaPipe model complexity = 0 (fastest, slightly less accurate)
  - Skip skeleton rendering every other frame
  - Reduce canvas resolution (render at 480p, display at full size)
- **Fallback:** Audio-only dribble detection (no skeleton overlay)

---

## 13. Hackathon Day-of Execution Plan

### Hour 0-1: Environment + API Validation
- [ ] Set up Vite project, install MediaPipe
- [ ] **Validate Lyria API** — generate ONE track from a text prompt. If this doesn't work, everything else is moot
- [ ] Validate Gemini Live WebSocket connection — send one frame, get one response
- [ ] Confirm MediaPipe Pose runs in browser at 30fps
- [ ] Pre-record fallback demo video on phone (just in case)

### Hour 1-3: Core Dribble Detection Pipeline
- [ ] MediaPipe pose tracking in browser with skeleton overlay
- [ ] Wrist velocity tracking + zero-crossing dribble detection
- [ ] Rhythm engine: dribble timestamps → BPM calculation
- [ ] Display live BPM on screen
- [ ] TEST: actually dribble a basketball and verify detection accuracy
- [ ] Tune thresholds (velocity, debounce interval) based on real testing

### Hour 3-5: Music Engine
- [ ] UI config panel (genre, energy, tempo, mood)
- [ ] Config → Lyria track generation
- [ ] Audio playback with playbackRate adjustment
- [ ] Beat grid from generated track
- [ ] Music tempo follows user BPM

### Hour 5-7: Scoring + Visuals
- [ ] Beat scoring (compare dribble timestamps to beat grid)
- [ ] Score + combo HUD overlay
- [ ] Beat indicator bar
- [ ] Skeleton color changes based on score
- [ ] Particle effects on perfect hits

### Hour 7-8: Gemini Live Integration (if time)
- [ ] Gemini Live WebSocket stream
- [ ] Style classification → instrument layer switching
- [ ] Energy level → sound processing effects

### Hour 8-9: Polish
- [ ] Session summary screen
- [ ] Countdown animation
- [ ] Loading states
- [ ] Error handling (camera denied, API failure)
- [ ] Audio dribble detector as backup signal

### Hour 9-10: Demo Prep
- [ ] **RECORD BACKUP DEMO VIDEO** — non-negotiable
- [ ] Write and rehearse 60-second demo script
- [ ] Test full flow end-to-end 3 times
- [ ] Prepare fallback: if live demo fails, play recorded video
- [ ] Clear browser cache, close unnecessary tabs

---

## 14. API Reference (Placeholder — Validate Day-Of)

### Lyria API
```
TBD — Check hackathon documentation for exact endpoints.

Key questions to validate in Hour 0-1:
1. What endpoint? What auth method?
2. What input format? (JSON config? text prompt? both?)
3. What output format? (WAV? MP3? streaming?)
4. Can you request a specific BPM?
5. Can you generate multiple tracks in parallel?
6. What are the rate limits?
7. Average generation time for a 90-second track?
```

### Gemini Live API
```
WebSocket: wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=API_KEY

Input: JPEG frames at 1fps (base64 encoded)
Output: Text (JSON classification)
Processing: 1 frame per second on server side
Session limit: 10 minutes

Model: gemini-2.0-flash-live-preview-04-09
```

### MediaPipe Pose (client-side, no API needed)
```
Package: @mediapipe/tasks-vision
Model: pose_landmarker (lite or full)
Landmarks: 33 body keypoints
Input: video frame (from getUserMedia)
Output: normalized x, y, z coordinates + visibility per landmark
Latency: ~10-15ms per frame (GPU backend)
```

---

## 15. Pre-Hackathon Checklist

- [ ] Install Node.js, npm, Vite on hackathon laptop
- [ ] Create project skeleton with file structure above
- [ ] Test MediaPipe Pose in browser locally (just skeleton overlay, no music)
- [ ] Download 4-5 royalty-free backing tracks at different BPMs as Lyria fallback
- [ ] Download hit sound effects (perfect.wav, great.wav, etc.)
- [ ] Get API keys for Gemini + Lyria (if available pre-hackathon)
- [ ] Bring a basketball to the hackathon
- [ ] Identify a space with ~6 feet of clearance for dribbling during demo
- [ ] Test webcam at the venue if possible (lighting, angle)
- [ ] Prepare 60-second pitch: "MuseMotion turns your basketball dribble into music"