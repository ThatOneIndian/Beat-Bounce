import * as Tone from 'tone';

export class AdaptiveMusicEngine {
  constructor() {
    this.tracks = new Map();       // Map<baseBPM, Tone.Player>
    this.currentSource = null;
    this.currentBPM = null;
    this.targetBPM = null;
    
    // Master volume node
    this.gainNode = new Tone.Volume(-10).toDestination();
    this.isInitialized = false;

    // SFX Only
    this.sfxSynth = null;
  }

  async initialize() {
    if (this.isInitialized) return;
    await Tone.start();

    // Hit sound effect poly synth (the "Ding")
    this.sfxSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle8" },
      envelope: {
        attack: 0.005,
        decay: 0.2,
        sustain: 0,
        release: 0.1
      }
    }).toDestination();
    this.sfxSynth.volume.value = -3;

    Tone.Transport.start();

    this.isInitialized = true;
    console.log("Tone.js initialized (No fallbacks allowed)");
  }

  playHitSFX(rating) {
    if (!this.isInitialized || rating === 'miss') return;
    if (rating === 'perfect') this.sfxSynth.triggerAttackRelease("C5", "16n");
    else if (rating === 'great') this.sfxSynth.triggerAttackRelease("A4", "16n");
    else if (rating === 'good') this.sfxSynth.triggerAttackRelease("F4", "16n");
  }

  // Load a generated track buffer and assign it a base BPM
  async loadTrack(bpm, urlOrBuffer) {
    return new Promise((resolve) => {
      const player = new Tone.Player({
        url: urlOrBuffer,
        loop: true,
        autostart: false,
        onload: () => {
          this.tracks.set(bpm, player);
          resolve();
        }
      });
    });
  }

  playTrack(bpm) {
    Tone.Transport.bpm.value = bpm;
    const bufferData = this.findNearestTrack(bpm);
    if (!bufferData) {
      console.error("CRITICAL: No true Lyria track loaded. Refusing to play fallback.");
      return;
    }
    
    const { baseBPM, player } = bufferData;

    if (this.currentSource && this.currentSource !== player) {
      // Crossfade: ramp old source down
      this.currentSource.volume.rampTo(-60, 2); // fade out over 2 seconds
      
      // Stop old source after crossfade
      const oldSource = this.currentSource;
      setTimeout(() => {
        try { oldSource.stop(); } catch (e) {}
      }, 2500);
    }
    
    // Fine-tune with playbackRate (safe within ±15%)
    const rate = bpm / baseBPM;
    player.playbackRate = Math.max(0.85, Math.min(1.15, rate));
    
    // Fade in new source
    player.volume.value = -60;
    player.connect(this.gainNode);
    player.start();
    player.volume.rampTo(0, 2);
    
    this.currentSource = player;
    this.currentBPM = bpm;
  }

  findNearestTrack(targetBPM) {
    let nearest = null;
    let nearestDiff = Infinity;
    
    for (const [bpm, player] of this.tracks.entries()) {
      const diff = Math.abs(bpm - targetBPM);
      if (diff < nearestDiff) {
        nearestDiff = diff;
        nearest = { baseBPM: bpm, player: player };
      }
    }
    
    return nearest;
  }

  // Called by rhythm engine when user BPM changes
  updateTempo(userBPM) {
    if (!this.currentSource) return;
    this.targetBPM = userBPM;
    
    const currentRate = this.currentSource.playbackRate;
    const effectiveBPM = this.currentBPM * currentRate;
    const diff = Math.abs(effectiveBPM - userBPM);
    
    if (diff < 3) return;  // close enough, don't adjust
    
    Tone.Transport.bpm.rampTo(userBPM, 1);
    
    // Can we handle it with playbackRate alone?
    const nearest = this.findNearestTrack(userBPM);
    if (!nearest) {
      this.currentBPM = userBPM;
      return;
    }

    const neededRate = userBPM / nearest.baseBPM;
    
    if (neededRate > 0.85 && neededRate < 1.15) {
      // Yes — just adjust playbackRate (smooth, no audible artifacts)
      // Note: Tone.js doesn't natively ramp playbackRate easily on Player,
      // but we can set it directly.
      this.currentSource.playbackRate = neededRate;
      this.currentBPM = nearest.baseBPM; // Update base reference
    } else {
      // Need to switch to a different base track
      this.playTrack(userBPM);
    }
  }

  stopAll() {
    if (this.currentSource) {
      this.currentSource.volume.rampTo(-60, 2);
      setTimeout(() => {
        this.tracks.forEach(player => player.stop());
      }, 2000);
    }
  }
}
