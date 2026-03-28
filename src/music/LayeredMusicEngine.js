import * as Tone from 'tone';

/**
 * Layered music engine with genre-specific presets.
 * Each genre has dramatically different sounds, patterns, and feel.
 *
 * Layer 0: Drums — kick + snare/clap + hats (always on)
 * Layer 1: Bass (meter 25+)
 * Layer 2: Chords/Pads (meter 50+)
 * Layer 3: Lead/Melody (meter 75+)
 */

const LAYER_THRESHOLDS = [
  { on: 0, off: 0 },
  { on: 3, off: 1 },
  { on: 8, off: 5 },
  { on: 15, off: 10 },
];

export class LayeredMusicEngine {
  constructor() {
    this.isInitialized = false;
    this.isPlaying = false;
    this.performanceLevel = 0;
    this.genre = null;

    this.masterGain = null;
    this.limiter = null;
    this.layerVolumes = [];

    // Drums
    this.kick = null;
    this.snare = null;
    this.hihat = null;
    this.openHat = null;

    // Instruments
    this.bass = null;
    this.chordSynth = null;
    this.leadSynth = null;
    this.sfxSynth = null;

    // Sequences
    this.drumSeq = null;
    this.bassSeq = null;
    this.chordPart = null;
    this.leadSeq = null;

    // Effects
    this.chordReverb = null;
    this.chordAutoFilter = null;
    this.leadDelay = null;
    this.bassDistortion = null;

    // Ambient
    this.ambientPlayer = null;
    this.ambientVolume = null;
  }

  async initialize(genre = 'edm') {
    if (this.isInitialized) {
      if (this.genre === genre) return;
      this._disposeAudio();
    }

    await Tone.start();
    this.genre = genre;

    this.limiter = new Tone.Limiter(-1).toDestination();
    this.masterGain = new Tone.Volume(-6).connect(this.limiter);

    this.layerVolumes = [];
    for (let i = 0; i < 4; i++) {
      const vol = new Tone.Volume(i === 0 ? 0 : -Infinity).connect(this.masterGain);
      this.layerVolumes.push(vol);
    }

    // Build genre-specific layers
    const builder = GENRE_BUILDERS[genre] || GENRE_BUILDERS['edm'];
    builder.call(this);
    this._buildSFX();

    this.isInitialized = true;
    console.log(`[LayeredMusic] Built ${genre} preset`);
  }

  // ── Hit SFX (shared) ──

  _buildSFX() {
    this.sfxSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 },
    }).toDestination();
    this.sfxSynth.volume.value = -5;
  }

  // ── Playback control ──

  start(bpm = 120) {
    if (!this.isInitialized || this.isPlaying) return;

    Tone.Transport.bpm.value = bpm;
    Tone.Transport.swing = this.genre === 'lo-fi' ? 0.3 : this.genre === 'hip-hop' ? 0.15 : 0;

    this.drumSeq.start(0);
    this.bassSeq.start(0);
    this.chordPart.start(0);
    this.leadSeq.start(0);

    this.performanceLevel = 0;
    this.layerVolumes[0].volume.value = 0;
    for (let i = 1; i < 4; i++) {
      this.layerVolumes[i].volume.value = -Infinity;
    }

    Tone.Transport.start();
    this.isPlaying = true;
    setTimeout(() => {
      console.log('[LayeredMusic] Started. Genre:', this.genre, 'BPM:', Tone.Transport.bpm.value, 'State:', Tone.Transport.state);
    }, 200);
  }

  stop() {
    if (!this.isPlaying) return;
    this.masterGain.volume.rampTo(-60, 2);
    setTimeout(() => {
      this.drumSeq?.stop();
      this.bassSeq?.stop();
      this.chordPart?.stop();
      this.leadSeq?.stop();
      Tone.Transport.stop();
      this.masterGain.volume.value = -6;
      this.isPlaying = false;
    }, 2200);
  }

  // ── Performance layers ──

  setPerformanceLevel(combo) {
    if (!this.isPlaying) return;

    let newLevel = 0;
    for (let i = 1; i < LAYER_THRESHOLDS.length; i++) {
      if (combo >= LAYER_THRESHOLDS[i].on) newLevel = i;
      else break;
    }

    if (newLevel < this.performanceLevel) {
      let dropTo = this.performanceLevel;
      while (dropTo > 0 && combo < LAYER_THRESHOLDS[dropTo].off) dropTo--;
      newLevel = dropTo;
    }

    if (newLevel === this.performanceLevel) return;

    const fadeTime = 1.5;
    for (let i = this.performanceLevel + 1; i <= newLevel; i++) {
      this.layerVolumes[i].volume.rampTo(0, fadeTime);
    }
    for (let i = this.performanceLevel; i > newLevel; i--) {
      this.layerVolumes[i].volume.rampTo(-Infinity, fadeTime);
    }
    this.performanceLevel = newLevel;
  }

  updateBPM(newBPM) {
    if (!this.isPlaying) return;
    if (Math.abs(Tone.Transport.bpm.value - newBPM) < 3) return;
    Tone.Transport.bpm.rampTo(newBPM, 1);
  }

  playHitSFX(rating) {
    if (!this.isInitialized || rating === 'miss') return;
    if (rating === 'perfect') this.sfxSynth.triggerAttackRelease('C5', '16n');
    else if (rating === 'great') this.sfxSynth.triggerAttackRelease('A4', '16n');
    else if (rating === 'good') this.sfxSynth.triggerAttackRelease('F4', '16n');
  }

  // ── Lyria ambient ──

  async loadAmbient(urlOrBuffer, baseBPM) {
    this.ambientVolume = new Tone.Volume(-20).connect(this.masterGain);
    const reverb = new Tone.Reverb({ decay: 4, wet: 0.6 }).connect(this.ambientVolume);
    this.ambientPlayer = new Tone.Player({
      url: urlOrBuffer, loop: true, autostart: false,
      onload: () => {
        if (this.isPlaying) {
          this.ambientPlayer.start();
          this.ambientVolume.volume.rampTo(-14, 4);
        }
      },
    }).connect(reverb);
    this._ambientBaseBPM = baseBPM;
  }

  updateAmbientTempo(newBPM) {
    if (!this.ambientPlayer || !this._ambientBaseBPM) return;
    const rate = newBPM / this._ambientBaseBPM;
    this.ambientPlayer.playbackRate = Math.max(0.85, Math.min(1.15, rate));
  }

  // ── Cleanup ──

  _disposeAudio() {
    if (this.isPlaying) {
      this.drumSeq?.stop();
      this.bassSeq?.stop();
      this.chordPart?.stop();
      this.leadSeq?.stop();
      Tone.Transport.stop();
      this.isPlaying = false;
    }
    [this.kick, this.snare, this.hihat, this.openHat, this.bass,
     this.chordSynth, this.leadSynth, this.sfxSynth, this.ambientPlayer
    ].forEach(n => n?.dispose());
    [this.chordReverb, this.chordAutoFilter, this.leadDelay, this.bassDistortion,
     this.ambientVolume, this.masterGain, this.limiter
    ].forEach(n => n?.dispose());
    this.layerVolumes.forEach(v => v?.dispose());
    this.layerVolumes = [];
    this.isInitialized = false;
  }

  dispose() { this._disposeAudio(); }

  // Compatibility methods for AdaptiveMusicEngine API
  async loadTrack(bpm, trackUrl) {
    return this.loadAmbient(trackUrl, bpm);
  }

  playTrack(bpm) {
    if (!this.isPlaying) this.start(bpm);
  }

  stopAll() {
    this.stop();
  }

  updateTempo(newBPM) {
    this.updateBPM(newBPM);
    this.updateAmbientTempo(newBPM);
  }

  getAudioTime() {
    return Tone.now();
  }

  get gainNode() {
    return this.masterGain;
  }
}


// ═══════════════════════════════════════════════════════
// GENRE BUILDERS — each one wires up completely different
// synths, patterns, effects, and musical content
// ═══════════════════════════════════════════════════════

const GENRE_BUILDERS = {

  // ─── EDM / Tech House (John Summit) ───
  'edm': function () {
    const drumVol = this.layerVolumes[0];

    // Punchy house kick — tight, thumpy
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.05, octaves: 6,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.08 },
    }).connect(drumVol);
    this.kick.volume.value = 3;

    // Clap on 2 and 4 — layered noise burst
    this.snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 },
    }).connect(drumVol);
    this.snare.volume.value = -6;

    // Closed hat — crispy, short
    this.hihat = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 },
    }).connect(drumVol);
    this.hihat.volume.value = -12;

    // Open hat — every 2 bars for variation
    this.openHat = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.25, sustain: 0.05, release: 0.1 },
    }).connect(drumVol);
    this.openHat.volume.value = -14;

    // Full drum pattern — 16 steps per bar, 2 bars
    // K=kick, C=clap, H=closed hat, O=open hat
    // Beat:  1 . . . 2 . . . 3 . . . 4 . . .  | 1 . . . 2 . . . 3 . . . 4 . . .
    const drumPattern = [
      'K','.','H','.', 'C','H','.','H', 'K','.','H','K', 'C','H','.','H',
      'K','.','H','.', 'C','H','.','H', 'K','.','H','K', 'C','H','.','O',
    ];

    this.drumSeq = new Tone.Sequence((time, step) => {
      if (step === 'K') this.kick.triggerAttackRelease('C1', '8n', time);
      else if (step === 'C') this.snare.triggerAttackRelease('16n', time, 0.7);
      else if (step === 'H') this.hihat.triggerAttackRelease('32n', time, 0.5);
      else if (step === 'O') this.openHat.triggerAttackRelease('8n', time, 0.4);
    }, drumPattern, '16n');

    // Bass — rolling tech house saw bass with filter sweep
    this.bassDistortion = new Tone.Distortion({ distortion: 0.15, wet: 0.3 }).connect(this.layerVolumes[1]);
    this.bass = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter: { Q: 4, type: 'lowpass', rolloff: -24 },
      filterEnvelope: { attack: 0.03, decay: 0.15, sustain: 0.3, baseFrequency: 250, octaves: 3 },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0.5, release: 0.15 },
    }).connect(this.bassDistortion);
    this.bass.volume.value = -2;

    // Bouncy rolling bassline
    const bassPattern = [
      'G1', null, 'G2', null, null, 'G1', null, 'G2',
      'G1', null, null, 'G2', null, 'G1', 'G2', null,
      'A1', null, 'A2', null, null, 'A1', null, 'A2',
      'A1', null, null, 'A2', null, 'A1', 'A2', null,
    ];
    this.bassSeq = new Tone.Sequence((time, note) => {
      if (note) this.bass.triggerAttackRelease(note, '16n', time);
    }, bassPattern, '16n');

    // Chords — short stabs with reverb tail (tech house signature)
    this.chordReverb = new Tone.Reverb({ decay: 2, wet: 0.35 }).connect(this.layerVolumes[2]);
    this.chordAutoFilter = new Tone.AutoFilter({
      frequency: '2n', depth: 0.5, baseFrequency: 600, octaves: 2.5,
    }).connect(this.chordReverb);
    this.chordAutoFilter.start();

    this.chordSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.005, decay: 0.12, sustain: 0.1, release: 0.3 },
    }).connect(this.chordAutoFilter);
    this.chordSynth.volume.value = -10;

    // Stabby offbeat chords — classic house
    this.chordPart = new Tone.Part((time, value) => {
      this.chordSynth.triggerAttackRelease(value.chord, '16n', time, 0.6);
    }, [
      { time: '0:0:2', chord: ['G3', 'B3', 'D4'] },
      { time: '0:1:2', chord: ['G3', 'B3', 'D4'] },
      { time: '0:2:2', chord: ['G3', 'B3', 'D4'] },
      { time: '0:3:2', chord: ['G3', 'B3', 'D4'] },
      { time: '1:0:2', chord: ['A3', 'C4', 'E4'] },
      { time: '1:1:2', chord: ['A3', 'C4', 'E4'] },
      { time: '1:2:2', chord: ['A3', 'C4', 'E4'] },
      { time: '1:3:2', chord: ['A3', 'C4', 'E4'] },
      { time: '2:0:2', chord: ['F3', 'A3', 'C4'] },
      { time: '2:1:2', chord: ['F3', 'A3', 'C4'] },
      { time: '2:2:2', chord: ['F3', 'A3', 'C4'] },
      { time: '2:3:2', chord: ['F3', 'A3', 'C4'] },
      { time: '3:0:2', chord: ['E3', 'G3', 'B3'] },
      { time: '3:1:2', chord: ['E3', 'G3', 'B3'] },
      { time: '3:2:2', chord: ['E3', 'G3', 'B3'] },
      { time: '3:3:2', chord: ['E3', 'G3', 'B3'] },
    ]);
    this.chordPart.loop = true;
    this.chordPart.loopEnd = '4m';

    // Lead — plucky synth stab with delay
    this.leadDelay = new Tone.PingPongDelay({
      delayTime: '8n', feedback: 0.3, wet: 0.3,
    }).connect(this.layerVolumes[3]);
    this.leadSynth = new Tone.Synth({
      oscillator: { type: 'pulse', width: 0.3 },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0.15, release: 0.08 },
    }).connect(this.leadDelay);
    this.leadSynth.volume.value = -8;

    this.leadSeq = new Tone.Sequence((time, note) => {
      if (note) this.leadSynth.triggerAttackRelease(note, '16n', time, 0.7);
    }, [
      'G4', null, 'B4', null, 'D5', null, 'B4', null,
      'A4', null, 'C5', null, 'E5', null, 'C5', null,
      'F4', null, 'A4', null, 'C5', null, 'A4', null,
      'E4', null, 'G4', null, 'B4', null, null, null,
    ], '16n');
  },

  // ─── HIP-HOP / Trap ───
  'hip-hop': function () {
    const drumVol = this.layerVolumes[0];

    // Heavy 808 kick — long sustain, deep sub
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.08, octaves: 8,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.6, sustain: 0.1, release: 0.3 },
    }).connect(drumVol);
    this.kick.volume.value = 4;

    // Trap snare — sharp, cracking
    this.snare = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.08 },
    }).connect(drumVol);
    this.snare.volume.value = -4;

    // Trap hi-hats — very short, metallic
    this.hihat = new Tone.MetalSynth({
      frequency: 400, envelope: { attack: 0.001, decay: 0.04, release: 0.01 },
      harmonicity: 5.1, modulationIndex: 16, resonance: 8000, octaves: 0.5,
    }).connect(drumVol);
    this.hihat.volume.value = -16;

    this.openHat = new Tone.MetalSynth({
      frequency: 400, envelope: { attack: 0.001, decay: 0.2, release: 0.08 },
      harmonicity: 5.1, modulationIndex: 16, resonance: 8000, octaves: 0.5,
    }).connect(drumVol);
    this.openHat.volume.value = -18;

    // Trap drum pattern — 808 bounce with hat rolls
    // Beat:  1 . . . 2 . . . 3 . . . 4 . . .  | bar 2
    const drumPattern = [
      'K','H','H','H', 'S','H','H','HH', 'K','H','K','H', 'S','H','HH','HH',
      'K','H','H','H', 'S','H','H','HH', '.','H','K','H', 'S','HH','HH','O',
    ];

    this.drumSeq = new Tone.Sequence((time, step) => {
      if (step === 'K') this.kick.triggerAttackRelease('C1', '4n', time);
      else if (step === 'S') this.snare.triggerAttackRelease('8n', time, 0.8);
      else if (step === 'H') this.hihat.triggerAttackRelease('32n', time, 0.35);
      else if (step === 'HH') this.hihat.triggerAttackRelease('32n', time, 0.55); // louder hat
      else if (step === 'O') this.openHat.triggerAttackRelease('8n', time, 0.3);
    }, drumPattern, '16n');

    // 808 sub bass — deep sine, long notes, slides
    this.bass = new Tone.MonoSynth({
      oscillator: { type: 'sine' },
      filter: { Q: 1, type: 'lowpass', rolloff: -12 },
      filterEnvelope: { attack: 0.01, decay: 0.5, sustain: 0.9, baseFrequency: 60, octaves: 1 },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.5 },
    }).connect(this.layerVolumes[1]);
    this.bass.volume.value = 0;

    // Long 808 bass notes with slides
    this.bassSeq = new Tone.Sequence((time, note) => {
      if (note) this.bass.triggerAttackRelease(note, '4n', time);
    }, [
      'E1', null, null, null, null, null, null, null,
      'G1', null, null, null, null, null, null, null,
      'A1', null, null, null, null, null, null, null,
      'G1', null, null, null, 'E1', null, null, null,
    ], '16n');

    // Dark pads — moody, sustained
    this.chordReverb = new Tone.Reverb({ decay: 5, wet: 0.6 }).connect(this.layerVolumes[2]);
    this.chordAutoFilter = new Tone.AutoFilter({
      frequency: '1m', depth: 0.3, baseFrequency: 200, octaves: 2,
    }).connect(this.chordReverb);
    this.chordAutoFilter.start();

    this.chordSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.5, decay: 1, sustain: 0.7, release: 2 },
    }).connect(this.chordAutoFilter);
    this.chordSynth.volume.value = -12;

    // Slow dark chords
    this.chordPart = new Tone.Part((time, value) => {
      this.chordSynth.triggerAttackRelease(value.chord, '1m', time, 0.4);
    }, [
      { time: '0:0:0', chord: ['E3', 'G3', 'B3', 'D4'] },
      { time: '2:0:0', chord: ['C3', 'E3', 'G3', 'B3'] },
    ]);
    this.chordPart.loop = true;
    this.chordPart.loopEnd = '4m';

    // Lead — dark bell / pluck melody
    this.leadDelay = new Tone.PingPongDelay({
      delayTime: '4n.', feedback: 0.4, wet: 0.35,
    }).connect(this.layerVolumes[3]);
    this.leadSynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.5 },
    }).connect(this.leadDelay);
    this.leadSynth.volume.value = -6;

    this.leadSeq = new Tone.Sequence((time, note) => {
      if (note) this.leadSynth.triggerAttackRelease(note, '8n', time, 0.5);
    }, [
      'E4', null, null, 'G4', null, null, 'B4', null,
      null, null, 'A4', null, 'G4', null, null, null,
      'E4', null, null, null, 'D4', null, 'E4', null,
      null, null, null, null, null, null, null, null,
    ], '16n');
  },

  // ─── LO-FI ───
  'lo-fi': function () {
    const drumVol = this.layerVolumes[0];

    // Soft, muffled kick — warm and round
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.15, octaves: 3,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.15 },
    }).connect(drumVol);
    this.kick.volume.value = 0;

    // Soft brushy snare — like a finger snap
    this.snare = new Tone.NoiseSynth({
      noise: { type: 'brown' },
      envelope: { attack: 0.005, decay: 0.12, sustain: 0, release: 0.04 },
    }).connect(drumVol);
    this.snare.volume.value = -8;

    // Soft closed hat
    this.hihat = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.002, decay: 0.05, sustain: 0, release: 0.02 },
    }).connect(drumVol);
    this.hihat.volume.value = -18;

    this.openHat = this.hihat; // reuse, lo-fi keeps it minimal

    // Laid-back lo-fi groove — sparse, swung (Transport.swing handles feel)
    const drumPattern = [
      'K', '.', 'H', '.', 'S', '.', 'H', '.',
      '.', '.', 'K', '.', 'S', '.', 'H', '.',
    ];

    this.drumSeq = new Tone.Sequence((time, step) => {
      if (step === 'K') this.kick.triggerAttackRelease('C1', '8n', time);
      else if (step === 'S') this.snare.triggerAttackRelease('16n', time, 0.5);
      else if (step === 'H') this.hihat.triggerAttackRelease('32n', time, 0.35);
    }, drumPattern, '16n');

    // Warm mellow bass — triangle wave, round
    this.bass = new Tone.MonoSynth({
      oscillator: { type: 'triangle' },
      filter: { Q: 0.5, type: 'lowpass', rolloff: -12 },
      filterEnvelope: { attack: 0.1, decay: 0.4, sustain: 0.7, baseFrequency: 80, octaves: 1 },
      envelope: { attack: 0.08, decay: 0.3, sustain: 0.6, release: 0.4 },
    }).connect(this.layerVolumes[1]);
    this.bass.volume.value = -4;

    // Walking bass feel
    this.bassSeq = new Tone.Sequence((time, note) => {
      if (note) this.bass.triggerAttackRelease(note, '8n', time);
    }, [
      'D2', null, null, null, null, null, 'F2', null,
      null, null, null, null, 'A1', null, null, null,
      null, null, 'G1', null, null, null, null, null,
      'C2', null, null, null, null, null, null, null,
    ], '16n');

    // Jazz chords — warm, extended voicings with heavy reverb
    this.chordReverb = new Tone.Reverb({ decay: 5, wet: 0.65 }).connect(this.layerVolumes[2]);
    this.chordAutoFilter = new Tone.AutoFilter({
      frequency: '4m', depth: 0.2, baseFrequency: 200, octaves: 1.5,
    }).connect(this.chordReverb);
    this.chordAutoFilter.start();

    this.chordSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.5, decay: 1.5, sustain: 0.4, release: 2 },
    }).connect(this.chordAutoFilter);
    this.chordSynth.volume.value = -8;

    // Jazzy 7th/9th chords — long and dreamy
    this.chordPart = new Tone.Part((time, value) => {
      this.chordSynth.triggerAttackRelease(value.chord, '1m', time, 0.35);
    }, [
      { time: '0:0:0', chord: ['D3', 'F3', 'A3', 'C4', 'E4'] },   // Dm9
      { time: '1:0:0', chord: ['G3', 'B3', 'D4', 'F4', 'A4'] },   // G9
      { time: '2:0:0', chord: ['C3', 'E3', 'G3', 'B3', 'D4'] },   // Cmaj9
      { time: '3:0:0', chord: ['A2', 'C3', 'E3', 'G3', 'B3'] },   // Am9
    ]);
    this.chordPart.loop = true;
    this.chordPart.loopEnd = '4m';

    // Lead — soft Rhodes-like sine melody with lots of delay
    this.leadDelay = new Tone.PingPongDelay({
      delayTime: '4n', feedback: 0.5, wet: 0.5,
    }).connect(this.layerVolumes[3]);
    this.leadSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.08, decay: 0.5, sustain: 0.2, release: 0.8 },
    }).connect(this.leadDelay);
    this.leadSynth.volume.value = -10;

    this.leadSeq = new Tone.Sequence((time, note) => {
      if (note) this.leadSynth.triggerAttackRelease(note, '8n', time, 0.4);
    }, [
      'D4', null, null, null, null, null, 'F4', null,
      null, null, null, null, 'A4', null, null, null,
      null, null, 'G4', null, null, null, null, null,
      'E4', null, null, null, null, null, null, null,
    ], '16n');
  },

  // ─── POP ───
  'pop': function () {
    const drumVol = this.layerVolumes[0];

    // Clean punchy kick
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.04, octaves: 5,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.08 },
    }).connect(drumVol);
    this.kick.volume.value = 2;

    // Snappy snare — bright
    this.snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.13, sustain: 0, release: 0.04 },
    }).connect(drumVol);
    this.snare.volume.value = -3;

    // Clean hats
    this.hihat = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 },
    }).connect(drumVol);
    this.hihat.volume.value = -14;

    this.openHat = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.08 },
    }).connect(drumVol);
    this.openHat.volume.value = -16;

    // Standard pop beat — driving, energetic
    const drumPattern = [
      'K','H','H','H', 'S','H','H','H', 'K','K','H','H', 'S','H','H','O',
    ];

    this.drumSeq = new Tone.Sequence((time, step) => {
      if (step === 'K') this.kick.triggerAttackRelease('C1', '8n', time);
      else if (step === 'S') this.snare.triggerAttackRelease('16n', time, 0.8);
      else if (step === 'H') this.hihat.triggerAttackRelease('32n', time, 0.45);
      else if (step === 'O') this.openHat.triggerAttackRelease('8n', time, 0.4);
    }, drumPattern, '16n');

    // Bright synth bass — punchy, melodic
    this.bass = new Tone.MonoSynth({
      oscillator: { type: 'square' },
      filter: { Q: 2, type: 'lowpass', rolloff: -24 },
      filterEnvelope: { attack: 0.02, decay: 0.12, sustain: 0.3, baseFrequency: 180, octaves: 2 },
      envelope: { attack: 0.005, decay: 0.08, sustain: 0.4, release: 0.15 },
    }).connect(this.layerVolumes[1]);
    this.bass.volume.value = -3;

    // Bouncy pop bassline
    this.bassSeq = new Tone.Sequence((time, note) => {
      if (note) this.bass.triggerAttackRelease(note, '8n', time);
    }, [
      'C2', null, 'C2', null, 'C3', null, 'C2', null,
      'G1', null, 'G1', null, 'G2', null, 'G1', null,
      'A1', null, 'A1', null, 'A2', null, 'A1', null,
      'F1', null, 'F1', null, 'F2', null, 'F1', null,
    ], '16n');

    // Bright chords — major key, uplifting
    this.chordReverb = new Tone.Reverb({ decay: 1.5, wet: 0.25 }).connect(this.layerVolumes[2]);
    this.chordAutoFilter = new Tone.AutoFilter({
      frequency: '4n', depth: 0.4, baseFrequency: 600, octaves: 2,
    }).connect(this.chordReverb);
    this.chordAutoFilter.start();

    this.chordSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.02, decay: 0.15, sustain: 0.5, release: 0.3 },
    }).connect(this.chordAutoFilter);
    this.chordSynth.volume.value = -12;

    // Driving pop chords — half notes, major key I-V-vi-IV
    this.chordPart = new Tone.Part((time, value) => {
      this.chordSynth.triggerAttackRelease(value.chord, '2n', time, 0.5);
    }, [
      { time: '0:0:0', chord: ['C4', 'E4', 'G4'] },
      { time: '0:2:0', chord: ['C4', 'E4', 'G4'] },
      { time: '1:0:0', chord: ['G3', 'B3', 'D4'] },
      { time: '1:2:0', chord: ['G3', 'B3', 'D4'] },
      { time: '2:0:0', chord: ['A3', 'C4', 'E4'] },
      { time: '2:2:0', chord: ['A3', 'C4', 'E4'] },
      { time: '3:0:0', chord: ['F3', 'A3', 'C4'] },
      { time: '3:2:0', chord: ['F3', 'A3', 'C4'] },
    ]);
    this.chordPart.loop = true;
    this.chordPart.loopEnd = '4m';

    // Lead — catchy, bright, singable melody
    this.leadDelay = new Tone.PingPongDelay({
      delayTime: '8n', feedback: 0.2, wet: 0.2,
    }).connect(this.layerVolumes[3]);
    this.leadSynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0.4, release: 0.15 },
    }).connect(this.leadDelay);
    this.leadSynth.volume.value = -6;

    this.leadSeq = new Tone.Sequence((time, note) => {
      if (note) this.leadSynth.triggerAttackRelease(note, '8n', time, 0.7);
    }, [
      'E5', null, 'D5', null, 'C5', null, 'D5', null,
      'E5', null, 'E5', null, 'E5', null, null, null,
      'D5', null, 'D5', null, 'D5', null, null, null,
      'E5', null, 'G5', null, 'G5', null, null, null,
    ], '16n');
  },
};
