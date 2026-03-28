import { DETECTION_CONFIG } from '../utils/constants.js';

export class AudioDribbleDetector {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;

    this.smoothedEnergy = 0;
    this.threshold = DETECTION_CONFIG.MIN_AUDIO_THRESHOLD;
    this.noiseFloor = 0;
    this.calibrated = false;
    this.calibrationFrames = 0;
    this.calibrationSum = 0;

    this.lastTrigger = 0;
    this.isInitialized = false;
  }

  async init(stream) {
    if (this.isInitialized) return;
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(this.bufferLength);
      
      const source = this.audioContext.createMediaStreamSource(stream);
      source.connect(this.analyser);
      this.isInitialized = true;
    } catch (e) {
      console.error("Failed to init AudioDribbleDetector:", e);
    }
  }

  detect(timestamp) {
    if (!this.isInitialized || !this.analyser) return { detected: false };

    this.analyser.getByteTimeDomainData(this.dataArray);
    
    let sumOfSquares = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      const normalized = (this.dataArray[i] - 128) / 128;
      sumOfSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumOfSquares / this.dataArray.length);

    if (!this.calibrated) {
      this.calibrationSum += rms;
      this.calibrationFrames++;
      if (this.calibrationFrames >= 30) {
        this.noiseFloor = this.calibrationSum / this.calibrationFrames;
        this.threshold = Math.max(
          this.noiseFloor * DETECTION_CONFIG.AUDIO_THRESHOLD_MULTIPLIER,
          DETECTION_CONFIG.MIN_AUDIO_THRESHOLD
        );
        this.calibrated = true;
        console.log(`Audio calibrated. Noise Floor: ${this.noiseFloor.toFixed(4)}, Threshold: ${this.threshold.toFixed(4)}`);
      }
      return { detected: false };
    }

    this.smoothedEnergy = this.smoothedEnergy * 0.9 + rms * 0.1;
    const energyDelta = rms - this.smoothedEnergy;

    if (energyDelta > this.threshold && (timestamp - this.lastTrigger) > 150) {
      this.lastTrigger = timestamp;
      return {
        detected: true,
        energy: rms,
        delta: energyDelta,
        timestamp: timestamp
      };
    }
    
    return { detected: false };
  }

  recalibrate() {
    this.calibrated = false;
    this.calibrationFrames = 0;
    this.calibrationSum = 0;
    this.smoothedEnergy = 0;
  }
}
