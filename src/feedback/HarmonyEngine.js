import * as Tone from 'tone';

// HarmonyEngine.js
// Logic for musical richness based on accuracy trends.
// Using Tone.js as the driver.

export class HarmonyEngine {
  constructor() {
    this.harmonyLevel = 50;  // start at middle
    this.targetHarmony = 50;

    // Master filter for the "Muffled vs Open" effect
    // Created but NOT pre-connected — we wire it into the chain in startTrack
    this.masterFilter = new Tone.Filter({
      type: 'lowpass',
      frequency: 20000,
      Q: 0.8
    });

    // Asymmetry is intentional (Slow to build, fast to lose)
    this.smoothingInterval = null;
  }

  // Called when the music session starts.
  // Accepts the gainNode from the music engine so we can insert the filter
  // in the chain: player → gainNode → filter → destination
  startTrack(gainNode) {
    if (gainNode) {
      try {
        gainNode.disconnect();
        gainNode.connect(this.masterFilter);
        this.masterFilter.toDestination();
      } catch (e) {
        console.warn("HarmonyEngine: Could not insert filter, falling back.", e);
        // If wiring fails, just connect gain straight to destination
        gainNode.toDestination();
      }
    }

    if (this.smoothingInterval) clearInterval(this.smoothingInterval);
    this.smoothingInterval = setInterval(() => this.smoothUpdate(), 50);
  }

  // Called on every scored dribble
  onScore(rating) {
    const deltas = {
      perfect: +6,    // 5-6 hits to gain a layer
      great:   +4,
      good:    +2,
      miss:    -12    // 2-3 misses to lose a layer
    };
    
    const delta = deltas[rating] || 0;
    this.targetHarmony = Math.max(0, Math.min(100, this.targetHarmony + delta));
  }

  // Smooth interpolation toward target
  smoothUpdate() {
    if (Math.abs(this.harmonyLevel - this.targetHarmony) < 0.2) {
      this.harmonyLevel = this.targetHarmony;
      return;
    }
    
    // Rising is slow (build tension), Falling is fast (loose flow)
    const rate = this.targetHarmony > this.harmonyLevel ? 0.08 : 0.15;
    this.harmonyLevel += (this.targetHarmony - this.harmonyLevel) * rate;
    
    this.applyHarmony();
  }

  applyHarmony() {
    const h = this.harmonyLevel;
    
    // Map harmony 0-100 to filter frequency 600Hz-20000Hz (log-ish scale)
    let filterFreq;
    if (h < 25) {
      filterFreq = 600 + (h / 25) * 400;          // 600-1000 Hz (BARE)
    } else if (h < 50) {
      filterFreq = 1000 + ((h - 25) / 25) * 2000;  // 1000-3000 Hz (THIN)
    } else if (h < 70) {
      filterFreq = 3000 + ((h - 50) / 20) * 5000;  // 3000-8000 Hz (BUILDING)
    } else {
      filterFreq = 8000 + ((h - 70) / 30) * 12000;  // 8000-20000 Hz (FULL/EUPHORIC)
    }
    
    // Standard Tone.js scheduling
    this.masterFilter.frequency.rampTo(filterFreq, 0.1);
  }

  getHarmonyLevel() {
    return this.harmonyLevel;
  }

  destroy() {
    if (this.smoothingInterval) clearInterval(this.smoothingInterval);
    this.masterFilter.dispose();
  }
}
