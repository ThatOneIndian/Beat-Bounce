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

    // High-impact Dribble SFX (The "Satisfying Ding")
    this.sfxSynth = new Tone.MetalSynth({
      harmonicity: 10,
      resonance: 50,
      modulationIndex: 32,
      envelope: {
        attack: 0.001,
        decay: 0.1,
        release: 0.05
      },
      volume: -6
    }).toDestination();

    this.isInitialized = true;
    console.log("AdaptiveMusicEngine: Crystalline SFX ready.");
  }

  playHitSFX(rating) {
    if (!this.isInitialized || rating === 'miss') return;
    
    // Satisfying "Metal Hit" pitch variations based on accuracy
    let freq = "C6";
    if (rating === 'great') freq = "A5";
    else if (rating === 'good') freq = "E5";
    
    this.sfxSynth.triggerAttackRelease(freq, "16n");
  }

  // Load a generated track buffer and assign it a base BPM
  async loadTrack(bpm, urlOrBuffer) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Audio track loading timed out (15s). The generated buffer may be invalid."));
      }, 15000);

      const player = new Tone.Player({
        url: urlOrBuffer,
        loop: true,
        autostart: false,
        onload: () => {
          clearTimeout(timeout);
          this.tracks.set(bpm, player);
          resolve();
        },
        onerror: (err) => {
          clearTimeout(timeout);
          console.error("Tone.Player failed to load buffer:", err);
          reject(new Error(`Failed to decode audio track: ${err}`));
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

  // Called by rhythm engine when user BPM changes.
  // Only adjusts playbackRate — never restarts the track.
  updateTempo(userBPM) {
    if (!this.currentSource) return;
    this.targetBPM = userBPM;

    const nearest = this.findNearestTrack(userBPM);
    if (!nearest) return;

    const neededRate = userBPM / nearest.baseBPM;
    // Clamp rate to avoid extreme pitch shifts, but never restart
    const clampedRate = Math.max(0.8, Math.min(1.2, neededRate));

    const currentRate = this.currentSource.playbackRate;
    if (Math.abs(clampedRate - currentRate) < 0.02) return; // close enough

    this.currentSource.playbackRate = clampedRate;
    Tone.Transport.bpm.rampTo(userBPM, 1);
  }

  getAudioTime() {
    return Tone.Transport.seconds;
  }

  getBPM() {
    return Tone.Transport.bpm.value;
  }

  stopAll() {
    if (this.currentSource) {
      this.currentSource.volume.rampTo(-60, 2);
      setTimeout(() => {
        this.tracks.forEach(player => player.stop());
        Tone.Transport.stop();
        Tone.Transport.cancel();
      }, 2000);
    }
  }
}
