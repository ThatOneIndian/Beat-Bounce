class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.vx = (Math.random() - 0.5) * 15;
    this.vy = (Math.random() - 0.5) * 15;
    this.alpha = 1;
    this.life = 1.0;
  }
  update(dt) {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= dt * 2;
    this.alpha = Math.max(0, this.life);
  }
  draw(ctx) {
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export class BeatIndicator {
  constructor(canvas, beatGrid) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.beatGrid = beatGrid;
    this.laneY = canvas.height * 0.85;
    this.hitX = canvas.width * 0.15;
    this.laneHeight = 90;
    this.lookAheadMs = 2000;
    this.particles = [];
    this.lastTime = performance.now();
    this.hitPulseTime = 0; // ms
  }

  triggerHit() {
    this.hitPulseTime = performance.now();
  }

  addSplash(rating) {
    this.triggerHit(); // Lighting up the line too
    const colors = { perfect: '#FFD700', great: '#00BFFF', good: '#00FF00' };
    const color = colors[rating] || '#FFF';
    for (let i = 0; i < 20; i++) {
      this.particles.push(new Particle(this.hitX, this.laneY + this.laneHeight / 2, color));
    }
  }

  render(nowMs) {
    const ctx = this.ctx;
    const now = performance.now();
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // Draw Lane Boundaries (The "Highway")
    ctx.save();
    
    // Draw base horizon line
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(0, 255, 204, 0.5)';
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.4)';
    ctx.lineWidth = 3;
    
    ctx.beginPath();
    ctx.moveTo(0, this.laneY);
    ctx.lineTo(this.canvas.width, this.laneY);
    ctx.moveTo(0, this.laneY + this.laneHeight);
    ctx.lineTo(this.canvas.width, this.laneY + this.laneHeight);
    ctx.stroke();

    // Center "Path" line
    ctx.setLineDash([10, 20]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(0, this.laneY + this.laneHeight / 2);
    ctx.lineTo(this.canvas.width, this.laneY + this.laneHeight / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Hit Zone (The "Aperture")
    const hitAge = now - this.hitPulseTime;
    const hitApertureGlow = Math.max(0, 1 - (hitAge / 250));
    const apertureSize = 5 + (hitApertureGlow * 15);
    
    ctx.shadowBlur = apertureSize + 10;
    ctx.shadowColor = hitApertureGlow > 0 ? '#FFD700' : '#00FFCC';
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(this.hitX, this.laneY - 10);
    ctx.lineTo(this.hitX, this.laneY + this.laneHeight + 10);
    ctx.stroke();
    
    // Glowing Hit Line Pulse
    if (hitApertureGlow > 0) {
      ctx.globalAlpha = hitApertureGlow;
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(this.hitX, this.laneY - 40);
      ctx.lineTo(this.hitX, this.laneY + this.laneHeight + 40);
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }

    // Upcoming Beats
    const tracks = this.beatGrid.getUpcomingBeats(nowMs, 8);
    for (const b of tracks) {
      const x = this.hitX + (b.relativeMs / this.lookAheadMs) * (this.canvas.width - this.hitX);
      
      if (x < 0 || x > this.canvas.width) continue;

      // Draw high-impact beat marker
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#00FFCC';
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(x, this.laneY + this.laneHeight / 2, 22, 0, Math.PI * 2);
      ctx.fill();
      
      // Pulse outer ring
      ctx.strokeStyle = 'rgba(0, 255, 204, 0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, this.laneY + this.laneHeight / 2, 30, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Draw Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.update(dt);
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      } else {
        p.draw(ctx);
      }
    }
  }
}
