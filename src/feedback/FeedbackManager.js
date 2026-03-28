import { PulseRing } from './PulseRing';
import { HarmonyEngine } from './HarmonyEngine';
import { HarmonyMeter } from './HarmonyMeter';
import { ParticleSystem } from './ParticleSystem';
import { HUD } from './HUD';

// FeedbackManager.js
// Central hub for all visual and audio feedback layers.

export class FeedbackManager {
  constructor({ canvas, containerElement }) {
    this.canvas = canvas;
    this.container = containerElement;
    
    // Layer 1: Peripheral Pulse (CSS Overlay)
    this.pulseRing = new PulseRing(containerElement);
    
    // Layer 2: Audio Harmony & Meter (Filter + Progress Bar)
    this.harmonyEngine = new HarmonyEngine();
    this.harmonyMeter = new HarmonyMeter(canvas);
    
    // Layer 3: Particle System (Hit confirmation)
    this.particles = new ParticleSystem(canvas);
    
    // Performance & Sync Stats (HUD Labels)
    this.hud = new HUD(canvas);
    
    this.stats = {
      score: 0,
      combo: 0,
      multiplier: 1,
      bpm: 120,
      rating: null,
      ratingTime: 0
    };
  }

  // Called when the music session starts
  startTrack(bpm, gainNode) {
    this.stats.bpm = bpm;
    this.pulseRing.startPulsing(bpm);
    this.harmonyEngine.startTrack(gainNode);
  }

  // Called by the mediator on ogni scored dribble
  onDribbleScored(scoreResult, wristScreenPosition) {
    // scoreResult = { rating, points, combo, multiplier, totalScore, offsetMs }
    
    this.stats.score = scoreResult.totalScore;
    this.stats.combo = scoreResult.combo;
    this.stats.multiplier = scoreResult.multiplier;
    this.stats.rating = scoreResult.rating;
    this.stats.ratingTime = performance.now();
    
    // Dispatch to all layers
    this.pulseRing.triggerScoredPulse(scoreResult.rating);
    this.harmonyEngine.onScore(scoreResult.rating);
    
    if (wristScreenPosition) {
      this.particles.emit(
        wristScreenPosition.x, 
        wristScreenPosition.y, 
        scoreResult.rating
      );
    }
  }

  // Called whenever the music engine updates the bpm
  updateBPM(newBPM) {
    this.stats.bpm = newBPM;
    this.pulseRing.updateBPM(newBPM);
  }

  // Called every frame in the main requestAnimationFrame loop
  renderFrame(landmarks) {
    // 1. Update & Draw Particles (Layer 3)
    this.particles.update();
    
    // 2. Draw Harmony Meter (Layer 2)
    this.harmonyMeter.render(this.harmonyEngine.getHarmonyLevel());
    
    // 3. Draw HUD (Stats & Rating text)
    const ratingAge = performance.now() - this.stats.ratingTime;
    this.hud.render({
      score: this.stats.score,
      combo: this.stats.combo,
      multiplier: this.stats.multiplier,
      bpm: this.stats.bpm,
      rating: this.stats.rating,
      ratingAge: ratingAge
    });
  }

  destroy() {
    this.pulseRing.destroy();
    this.harmonyEngine.destroy();
  }
}
