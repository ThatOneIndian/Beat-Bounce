export class RhythmEngine {
  constructor() {
    this.timestamps = [];
    this.MAX_HISTORY = 20;

    this.currentBPM = 0;
    this.bpmHistory = [];
    this.MAX_BPM_HISTORY = 10;
    this.isStable = false;

    this.MIN_BPM = 50;
    this.MAX_BPM = 220;
  }

  onDribble(timestamp) {
    this.timestamps.push(timestamp);
    if (this.timestamps.length > this.MAX_HISTORY) {
      this.timestamps.shift();
    }

    if (this.timestamps.length < 4) return null;

    const intervals = [];
    for (let i = 1; i < this.timestamps.length; i++) {
      intervals.push(this.timestamps[i] - this.timestamps[i - 1]);
    }

    const sorted = [...intervals].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    // Filter outliers (crossovers, pauses, double-triggers)
    const filtered = intervals.filter(v => Math.abs(v - median) / median < 0.4);
    if (filtered.length < 3) return null;

    // Weighted average of clean intervals (EWMA)
    const alpha = 0.25;
    let ewma = filtered[0];
    for (let i = 1; i < filtered.length; i++) {
      ewma = alpha * filtered[i] + (1 - alpha) * ewma;
    }

    const rawBPM = 60000 / ewma;
    if (rawBPM < this.MIN_BPM || rawBPM > this.MAX_BPM) return null;

    this.bpmHistory.push(rawBPM);
    if (this.bpmHistory.length > this.MAX_BPM_HISTORY) {
      this.bpmHistory.shift();
    }

    // Clamp to reasonable basketball dribble range
    this.currentBPM = Math.max(60, Math.min(200, rawBPM));

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
    if (arr.length === 0) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
  }
}
