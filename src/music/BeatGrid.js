export class BeatGrid {
  constructor() {
    this.bpm = 120;
    this.beats = [];         // array of absolute timestamps (ms)
    this.startTime = null;
    this.lookAheadMs = 3000; // pre-compute 3 seconds of beats ahead
  }

  initialize(bpm, audioStartTime) {
    this.bpm = bpm;
    this.startTime = audioStartTime || 0;
    this.regenerate(this.startTime);
  }

  regenerate(nowMs) {
    const intervalMs = 60000 / this.bpm;
    const maxTime = nowMs + this.lookAheadMs;

    // Filter out old beats that are well past the screen left edge (-1s buffer)
    this.beats = this.beats.filter(b => b > nowMs - 1000);

    // If no beats, start from current time
    let lastBeat = this.beats.length > 0 ? this.beats[this.beats.length - 1] : nowMs;

    // Fill up to lookAheadMs
    while (lastBeat < maxTime) {
      lastBeat += intervalMs;
      this.beats.push(lastBeat);
    }
  }

  updateBPM(newBPM) {
    if (Math.abs(newBPM - this.bpm) < 2) return;  // ignore tiny changes

    const oldIntervalMs = 60000 / this.bpm;
    const newIntervalMs = 60000 / newBPM;

    this.bpm = newBPM;

    // Rebuild the grid from the last confirmed beat
    const now = performance.now();
    const lastBeat = this.beats.filter(b => b <= now).pop() || now;

    this.beats = this.beats.filter(b => b <= now);

    // Gradually interpolate interval over 4 beats
    let currentInterval = oldIntervalMs;
    const step = (newIntervalMs - oldIntervalMs) / 4;
    let nextBeat = lastBeat;

    for (let i = 0; i < 20; i++) {
      if (i < 4) {
        currentInterval += step;
      } else {
        currentInterval = newIntervalMs;
      }
      nextBeat += currentInterval;
      this.beats.push(nextBeat);
    }
  }

  // Get the nearest beat to a given timestamp
  getNearestBeat(timestamp) {
    if (this.beats.length === 0) return { beatTime: 0, offsetMs: 1000 };

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

  // Get upcoming beats for the beat indicator bar (all times in ms)
  getUpcomingBeats(nowMs, count = 8) {
    return this.beats
      .filter(b => b > nowMs)
      .slice(0, count)
      .map(b => ({ time: b, relativeMs: b - nowMs }));
  }
}
