// PulseRing.js

export class PulseRing {
  constructor(containerElement) {
    if (!containerElement) return;
    
    // Create the overlay element
    this.el = document.createElement('div');
    this.el.style.cssText = `
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 10;
      border-radius: inherit;
    `;
    containerElement.appendChild(this.el);
    
    this.beatInterval = null;
    this.currentBPM = 120;
  }

  // Call this when the beat grid is established and music starts playing
  startPulsing(bpm) {
    this.currentBPM = bpm;
    const intervalMs = 60000 / bpm;
    
    if (this.beatInterval) clearInterval(this.beatInterval);
    
    // Using simple interval for now, re-sync happens on dribbles
    this.beatInterval = setInterval(() => {
      this.triggerBeatPulse();
    }, intervalMs);
  }

  stopPulsing() {
    if (this.beatInterval) clearInterval(this.beatInterval);
  }

  updateBPM(newBPM) {
    if (Math.abs(newBPM - this.currentBPM) < 2) return;
    this.currentBPM = newBPM;
    this.startPulsing(newBPM);
  }

  // Neutral beat pulse — white glow
  triggerBeatPulse() {
    if (!this.el) return;
    this.el.style.boxShadow = 'inset 0 0 60px 30px rgba(255, 255, 255, 0.15)';
    this.el.style.transition = 'box-shadow 0.08s ease-in';
    
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!this.el) return;
        this.el.style.transition = 'box-shadow 0.4s ease-out';
        this.el.style.boxShadow = 'inset 0 0 0 0 rgba(255, 255, 255, 0)';
      });
    });
  }

  // Override pulse with score-colored version — called on scored dribbles
  triggerScoredPulse(rating) {
    if (!this.el) return;
    const colors = {
      perfect: 'rgba(255, 200, 50, 0.4)',   // warm gold
      great:   'rgba(74, 144, 217, 0.35)',   // blue
      good:    'rgba(39, 174, 96, 0.3)',     // green
      miss:    'rgba(220, 60, 60, 0.35)'     // red
    };
    
    const sizes = {
      perfect: 'inset 0 0 120px 60px',  // biggest, most dramatic
      great:   'inset 0 0 80px 40px',
      good:    'inset 0 0 60px 30px',
      miss:    'inset 0 0 50px 25px'
    };
    
    const color = colors[rating] || colors.miss;
    const size = sizes[rating] || sizes.miss;
    
    this.el.style.boxShadow = `${size} ${color}`;
    this.el.style.transition = 'box-shadow 0.06s ease-in';
    
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!this.el) return;
        const fadeTime = rating === 'perfect' ? '0.6s' : '0.4s';
        this.el.style.transition = `box-shadow ${fadeTime} ease-out`;
        this.el.style.boxShadow = 'inset 0 0 0 0 rgba(0, 0, 0, 0)';
      });
    });
  }

  destroy() {
    this.stopPulsing();
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
  }
}
