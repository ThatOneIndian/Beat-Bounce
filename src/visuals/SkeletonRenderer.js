import { PoseLandmarker } from '@mediapipe/tasks-vision';

export class SkeletonRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.currentScoreColor = '#00ffcc'; // Default color
    
    this.flashTimeout = null;
    this.currentFlashColor = 'rgba(255, 255, 255, 0.45)'; // Default idle
    
    // MediaPipe helper to draw the connections
    this.connections = PoseLandmarker.POSE_CONNECTIONS;
  }

  // Called by the hit-mediator on every scored dribble
  flashRating(rating) {
    const colors = {
      perfect: 'rgba(255, 215, 0, 0.95)',   // Gold
      great:   'rgba(74, 144, 217, 0.90)',   // Azure Blue
      good:    'rgba(39, 174, 96, 0.85)',    // Emerald Green
      miss:    'rgba(220, 60, 60, 0.85)'     // Crimson Red
    };
    
    this.currentFlashColor = colors[rating] || colors.miss;
    
    if (this.flashTimeout) clearTimeout(this.flashTimeout);
    
    // Return to idle color after a brief duration
    const flashDuration = rating === 'perfect' ? 400 : 250;
    this.flashTimeout = setTimeout(() => {
      this.currentFlashColor = 'rgba(255, 255, 255, 0.45)';
    }, flashDuration);
  }

  render(landmarks) {
    if (!landmarks || landmarks.length === 0) return;

    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;
    const color = this.currentFlashColor;

    // Draw connections (bones) - Outer Glow
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // 1. Draw thick colored neon glow
    ctx.lineWidth = 14;
    ctx.strokeStyle = color;
    ctx.shadowBlur = 20;
    ctx.shadowColor = color;
    
    ctx.beginPath();
    for (const connection of this.connections) {
      const p1 = landmarks[connection.start];
      const p2 = landmarks[connection.end];
      
      if (p1.visibility > 0.5 && p2.visibility > 0.5) {
        // Mirrored X coordinates to align with selfie-video
        ctx.moveTo((1 - p1.x) * width, p1.y * height);
        ctx.lineTo((1 - p2.x) * width, p2.y * height);
      }
    }
    ctx.stroke();

    // 2. Draw thin white core (Visual depth)
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#FFFFFF';
    ctx.shadowBlur = 0;
    
    ctx.beginPath();
    for (const connection of this.connections) {
      const p1 = landmarks[connection.start];
      const p2 = landmarks[connection.end];
      
      if (p1.visibility > 0.5 && p2.visibility > 0.5) {
        ctx.moveTo((1 - p1.x) * width, p1.y * height);
        ctx.lineTo((1 - p2.x) * width, p2.y * height);
      }
    }
    ctx.stroke();

    // Draw points (joints) -> Small white glowing dots
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#FFFFFF';
    for (const p of landmarks) {
      if (p.visibility > 0.5) {
        ctx.beginPath();
        ctx.arc((1 - p.x) * width, p.y * height, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
    
    // Highlight wrists (15, 16) with heavy pulse auras
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowBlur = 25;
    ctx.shadowColor = '#FF00FF'; // Magenta pulse
    const drawWrist = (lm) => {
      if (lm && lm.visibility > 0.5) {
        ctx.beginPath();
        ctx.arc((1 - lm.x) * width, lm.y * height, 10, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw an outer ring
        ctx.beginPath();
        ctx.strokeStyle = '#FF00FF';
        ctx.lineWidth = 3;
        ctx.arc((1 - lm.x) * width, lm.y * height, 22, 0, 2 * Math.PI);
        ctx.stroke();
      }
    };
    
    drawWrist(landmarks[15]);
    drawWrist(landmarks[16]);
  }
}
