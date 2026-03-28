// HarmonyMeter.js (Canvas rendering)

export class HarmonyMeter {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 240;
    this.height = 10;
    this.x = (canvas.width - this.width) / 2;  // centered
    this.y = canvas.height - 40;
  }

  render(harmonyLevel) {
    const ctx = this.ctx;
    
    // Position check for dynamic resizing
    this.x = (this.canvas.width - this.width) / 2;
    this.y = this.canvas.height - 60;

    // Outer glow for the container
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';

    // Background track
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.roundRect(this.x, this.y, this.width, this.height, 5);
    ctx.fill();
    
    // Fill bar — color changes based on level
    let fillColor;
    if (harmonyLevel > 70) {
      fillColor = '#27AE60';       // green — full/euphoric
    } else if (harmonyLevel > 40) {
      fillColor = '#4A90D9';       // blue — building
    } else if (harmonyLevel > 20) {
      fillColor = '#E2A14B';       // amber — thin
    } else {
      fillColor = '#f44336';       // red — bare/danger
    }
    
    const fillWidth = (harmonyLevel / 100) * this.width;
    
    // Drawing the glow for the fill bar
    ctx.shadowBlur = 10;
    ctx.shadowColor = fillColor;
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.roundRect(this.x, this.y, fillWidth, this.height, 5);
    ctx.fill();
    ctx.restore();
    
    // Label above the bar
    const zoneLabels = {
      euphoric: 'EUPHORIC MAX',
      full: 'FULL HARMONY',
      building: 'GROOVING',
      thin: 'THIN',
      bare: 'CRITICAL: BARE'
    };
    
    let zone;
    if (harmonyLevel >= 85) zone = 'euphoric';
    else if (harmonyLevel >= 70) zone = 'full';
    else if (harmonyLevel >= 50) zone = 'building';
    else if (harmonyLevel >= 25) zone = 'thin';
    else zone = 'bare';
    
    ctx.font = 'bold 12px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'center';
    ctx.letterSpacing = "1px";
    ctx.fillText(zoneLabels[zone], this.x + this.width / 2, this.y - 12);
  }
}
