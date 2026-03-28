export class BeatIndicator {
  constructor(canvas, beatGrid) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.beatGrid = beatGrid;
    this.barWidth = canvas.width;
    this.barHeight = 40;
    this.barY = canvas.height - 50;
    this.lookAheadMs = 2000;  // show 2 seconds of upcoming beats
    this.splashes = [];
  }

  addSplash(rating, x, y) {
    this.splashes.push({
      rating,
      x: x || this.barWidth / 2,
      y: y || this.barY - 50,
      createdAt: performance.now(),
      lifetime: 800 // ms
    });
  }

  render(currentTime) {
    const ctx = this.ctx;
    
    // Draw background gradient to make notes pop against user's shoes/floor
    const gradient = ctx.createLinearGradient(0, this.barY - 40, 0, this.barY + this.barHeight + 20);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.7)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, this.barY - 40, this.barWidth, this.barHeight + 60);

    // Draw center line (the "hit zone") with a neon cyan glow
    const centerX = this.barWidth * 0.2;  // hit zone at 20% from left
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#00FFFF'; // Neon Cyan
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(centerX, this.barY - 10);
    ctx.lineTo(centerX, this.barY + this.barHeight + 10);
    ctx.stroke();
    
    // Reset shadow before drawing notes
    ctx.shadowBlur = 0;
    
    // Draw upcoming beat markers scrolling from right to left
    const upcomingBeats = this.beatGrid.getUpcomingBeats(currentTime, 10);
    
    for (const beat of upcomingBeats) {
      // Map time to X position
      const progress = beat.relativeMs / this.lookAheadMs;
      const x = centerX + (progress * (this.barWidth - centerX));
      
      if (x < 0 || x > this.barWidth) continue;
      
      // Dynamic glowing note
      ctx.shadowBlur = progress < 0.1 ? 25 : 10;
      ctx.shadowColor = progress < 0.1 ? '#FF00FF' : '#00FFFF'; // Pink when in hit zone, cyan otherwise
      ctx.fillStyle = progress < 0.1 ? '#FFFFFF' : 'rgba(255, 255, 255, 0.9)';
      
      const size = progress < 0.1 ? 14 : 10; // expand slightly when reaching hit zone
      
      ctx.beginPath();
      // Neon circles jumping along the track
      ctx.arc(x, this.barY + this.barHeight / 2, size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.shadowBlur = 0; // reset
    
    // Draw splashes
    const now = performance.now();
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const s = this.splashes[i];
      const age = now - s.createdAt;
      if (age > s.lifetime) {
        this.splashes.splice(i, 1);
        continue;
      }
      
      const progress = age / s.lifetime;
      const alpha = Math.max(0, 1 - progress);
      const floatY = s.y - (progress * 60); // float up 60px
      const scale = 1 + (progress * 0.5); // expand slightly

      ctx.save();
      ctx.translate(s.x, floatY);
      ctx.scale(scale, scale);
      
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 48px "Inter", sans-serif';
      
      let color = '#FFFFFF';
      if (s.rating === 'perfect') color = '#00FFFF'; // cyan
      else if (s.rating === 'great') color = '#FF00FF'; // magenta
      else if (s.rating === 'good') color = '#FFD700'; // gold
      else if (s.rating === 'miss') color = '#FF4444'; // red
      
      ctx.shadowBlur = 15;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.fillText(s.rating.toUpperCase(), 0, 0);
      ctx.restore();
    }
  }
}
