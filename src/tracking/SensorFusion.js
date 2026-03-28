import { DETECTION_CONFIG } from '../utils/constants.js';

export class SensorFusion {
  constructor() {
    this.maxWindow = DETECTION_CONFIG.MAX_SYNC_WINDOW_MS;
    this.pendingVisual = null;
    this.pendingAudio = null;
    this.lastEmitTime = 0;
  }

  process(visualResult, audioResult, timestamp) {
    if (visualResult.detected) {
      this.pendingVisual = { ...visualResult, arrivalTime: timestamp };
    }
    if (audioResult.detected) {
      this.pendingAudio = { ...audioResult, arrivalTime: timestamp };
    }

    // Suppress any event that arrives too soon after the last emit
    const cooldown = DETECTION_CONFIG.COOLDOWN_MS;

    // Try fusion first — if both sensors fired within the window, emit immediately
    if (this.pendingVisual && this.pendingAudio) {
      const timeDiff = Math.abs(this.pendingVisual.timestamp - this.pendingAudio.timestamp);
      if (timeDiff <= this.maxWindow) {
        if (timestamp - this.lastEmitTime < cooldown) {
          this.pendingVisual = null;
          this.pendingAudio = null;
          return { detected: false };
        }
        const result = {
          detected: true,
          confidence: 0.95,
          timestamp: this.pendingVisual.timestamp,
          source: 'fused',
          hand: this.pendingVisual.hand,
          intensity: this.pendingVisual.intensity,
          wristScreenX: this.pendingVisual.wristScreenX,
          wristScreenY: this.pendingVisual.wristScreenY
        };
        this.pendingVisual = null;
        this.pendingAudio = null;
        this.lastEmitTime = timestamp;
        return result;
      }
    }

    // Visual-only: emit immediately — peak-velocity detection is already
    // well-timed to the impact moment.
    if (this.pendingVisual && !audioResult.detected) {
      if (timestamp - this.lastEmitTime < cooldown) {
        this.pendingVisual = null;
        return { detected: false };
      }
      const result = {
        detected: true,
        confidence: 0.7,
        timestamp: this.pendingVisual.timestamp,
        source: 'visual',
        hand: this.pendingVisual.hand,
        intensity: this.pendingVisual.intensity,
        wristScreenX: this.pendingVisual.wristScreenX,
        wristScreenY: this.pendingVisual.wristScreenY
      };
      this.pendingVisual = null;
      // Also discard any pending audio — it's the same physical dribble
      this.pendingAudio = null;
      this.lastEmitTime = timestamp;
      return result;
    }

    // Audio-only: discard — speakers/music cause too many false positives.
    // Audio is only useful for confirming visual detections (fused path above).
    if (this.pendingAudio && !this.pendingVisual) {
      const age = timestamp - this.pendingAudio.arrivalTime;
      if (age > this.maxWindow) {
        this.pendingAudio = null;
      }
    }

    return { detected: false };
  }
}
