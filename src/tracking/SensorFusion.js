import { DETECTION_CONFIG } from '../utils/constants.js';

export class SensorFusion {
  constructor() {
    this.maxWindow = DETECTION_CONFIG.MAX_SYNC_WINDOW_MS;
    this.pendingVisual = null;
    this.pendingAudio = null;
  }

  process(visualResult, audioResult, timestamp) {
    if (visualResult.detected) {
      this.pendingVisual = { ...visualResult, arrivalTime: timestamp };
    }
    if (audioResult.detected) {
      this.pendingAudio = { ...audioResult, arrivalTime: timestamp };
    }

    // Try fusion first — if both sensors fired within the window, emit immediately
    if (this.pendingVisual && this.pendingAudio) {
      const timeDiff = Math.abs(this.pendingVisual.timestamp - this.pendingAudio.timestamp);
      if (timeDiff <= this.maxWindow) {
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
        return result;
      }
    }

    // Visual-only: emit immediately — visual detection has its own zero-crossing
    // logic so it's already well-timed. Waiting adds unnecessary latency.
    if (this.pendingVisual && !audioResult.detected) {
      const age = timestamp - this.pendingVisual.arrivalTime;
      // Give audio 1 frame (~16ms) to catch up, then emit
      if (age >= 16) {
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
        return result;
      }
    }

    // Audio-only: wait a bit longer since audio alone is less reliable
    if (this.pendingAudio && !this.pendingVisual) {
      const age = timestamp - this.pendingAudio.arrivalTime;
      if (age > this.maxWindow) {
        const result = {
          detected: true,
          confidence: 0.35,
          timestamp: this.pendingAudio.timestamp,
          source: 'audio',
          hand: null,
          intensity: 0.5,
          wristScreenX: 0,
          wristScreenY: 0
        };
        this.pendingAudio = null;
        return result;
      }
    }

    return { detected: false };
  }
}
