// HUD.js
// Canvas-based HUD for performance and sync

export class HUD {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  render(state) {
    // state = { score, combo, multiplier, bpm, rating, ratingAge }
    
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    // 1. Stats Bar (Top)
    ctx.save();
    
    // Top-left: Score
    ctx.font = '500 22px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.textAlign = 'left';
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.fillText(`SCORE: ${state.score.toLocaleString()}`, 30, 45);
    
    // Top-center: BPM
    ctx.font = '700 16px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(0, 255, 204, 0.6)'; // Accent color
    ctx.textAlign = 'center';
    ctx.letterSpacing = "2px";
    ctx.fillText(`${state.bpm} BPM`, w / 2, 45);
    
    // Top-right: Combo
    ctx.textAlign = 'right';
    if (state.combo > 0) {
      // Glow if high combo
      const comboColor = state.combo >= 10 ? '#FFD700' : '#FFFFFF';
      ctx.shadowColor = comboColor;
      ctx.shadowBlur = state.combo >= 10 ? 15 : 0;
      
      ctx.font = '700 24px "Inter", sans-serif';
      ctx.fillStyle = comboColor;
      ctx.fillText(`COMBO ${state.combo}x`, w - 30, 45);
      
      if (state.multiplier > 1) {
        ctx.font = '500 14px "Inter", sans-serif';
        ctx.fillStyle = 'rgba(255, 215, 0, 0.8)';
        ctx.fillText(`${state.multiplier}x MULT`, w - 30, 70);
      }
    }
    ctx.restore();
    
    // 2. Rating splash (Center)
    // Only show for 500ms after each scored dribble
    if (state.rating && state.ratingAge < 500) {
      const opacity = 1 - (state.ratingAge / 500);
      const ratingColors = {
        perfect: `rgba(255, 215, 0, ${opacity})`, // Gold
        great:   `rgba(74, 144, 217, ${opacity})`, // Blue
        good:    `rgba(39, 174, 96, ${opacity})`,  // Green
        miss:    `rgba(220, 60, 60, ${opacity})`,  // Red
        'too late': `rgba(220, 60, 60, ${opacity})`,
        'too early': `rgba(220, 60, 60, ${opacity})`
      };
      
      const ratingLabels = {
        perfect: 'PERFECT',
        great: 'GREAT',
        good: 'GOOD',
        miss: 'MISS',
        'too late': 'TOO LATE',
        'too early': 'TOO EARLY'
      };
      
      ctx.save();
      ctx.font = '700 48px "Inter", sans-serif';
      ctx.fillStyle = ratingColors[state.rating];
      ctx.textAlign = 'center';
      ctx.shadowBlur = 20;
      ctx.shadowColor = ratingColors[state.rating];
      
      // Scale-up and fade-out animation
      const scale = 1 + (state.ratingAge * 0.0005);
      const yOffset = state.ratingAge * 0.12; 
      
      ctx.translate(w / 2, h / 2 - 120 - yOffset);
      ctx.scale(scale, scale);
      ctx.fillText(ratingLabels[state.rating], 0, 0);
      ctx.restore();
    }
  }
}
