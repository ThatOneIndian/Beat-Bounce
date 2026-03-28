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
      perfect: +5,
      great:   +3,
      good:    +1,
      miss:    -18,       // misses punish hard — 2 misses tanks the harmony
      'too late': -18,
      'too early': -18
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

    // Rising is slow (earn it), Falling is FAST (feel the loss immediately)
    const rate = this.targetHarmony > this.harmonyLevel ? 0.06 : 0.25;
    this.harmonyLevel += (this.targetHarmony - this.harmonyLevel) * rate;
    
    this.applyHarmony();
  }

  applyHarmony() {
    const h = this.harmonyLevel;
    
    // Map harmony 0-100 to filter frequency 250Hz-20000Hz (log-ish scale)
    // More extreme range — at 0 the music sounds like it's underwater/dying
    let filterFreq;
    if (h < 20) {
      filterFreq = 250 + (h / 20) * 350;            // 250-600 Hz (SUFFOCATED)
    } else if (h < 40) {
      filterFreq = 600 + ((h - 20) / 20) * 1400;    // 600-2000 Hz (MUFFLED)
    } else if (h < 65) {
      filterFreq = 2000 + ((h - 40) / 25) * 4000;   // 2000-6000 Hz (BUILDING)
    } else if (h < 85) {
      filterFreq = 6000 + ((h - 65) / 20) * 8000;   // 6000-14000 Hz (BRIGHT)
    } else {
      filterFreq = 14000 + ((h - 85) / 15) * 6000;  // 14000-20000 Hz (EUPHORIC)
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
