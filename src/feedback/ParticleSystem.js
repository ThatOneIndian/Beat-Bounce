// ParticleSystem.js

export class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
  }

  // Emit particles from a screen position (the wrist location)
  emit(x, y, rating) {
    if (rating !== 'perfect' && rating !== 'great') return;
    
    const count = rating === 'perfect' ? 16 : 8;
    const color = rating === 'perfect' 
      ? { r: 255, g: 210, b: 60 }   // gold
      : { r: 74, g: 144, b: 217 };  // blue
    
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.5;
      const speed = 2.0 + Math.random() * 3.5;
      
      this.particles.push({
        x: x, 
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,  // upward bias
        life: 1.0,
        decay: 0.015 + Math.random() * 0.02,
        size: 3 + Math.random() * 4,
        color
      });
    }
  }

  // Called every frame in the render loop
  update() {
    const ctx = this.ctx;
    
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;  // gravity
      p.life -= p.decay;
      
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = `rgb(${p.color.r}, ${p.color.g}, ${p.color.b})`;
      ctx.shadowBlur = 10;
      ctx.shadowColor = `rgb(${p.color.r}, ${p.color.g}, ${p.color.b})`;
      
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    
    ctx.globalAlpha = 1;
  }
}
