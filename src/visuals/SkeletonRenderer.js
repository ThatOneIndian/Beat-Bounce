import { PoseLandmarker } from '@mediapipe/tasks-vision';

export class SkeletonRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.currentScoreColor = '#00ffcc'; // Default color
    
    // MediaPipe helper to draw the connections
    this.connections = PoseLandmarker.POSE_CONNECTIONS;
  }

  setScoreColor(rating) {
    switch (rating) {
      case 'perfect': this.currentScoreColor = '#FFD700'; break; // Gold
      case 'great': this.currentScoreColor = '#00BFFF'; break; // Blue
      case 'good': this.currentScoreColor = '#00FF00'; break; // Green
      case 'miss': this.currentScoreColor = '#FF0000'; break; // Red
      default: this.currentScoreColor = '#00ffcc'; break;
    }
  }

  render(video, landmarks, ballPos) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;

    // 1. Draw MIRRORED video background first
    if (video) {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-width, 0);
        ctx.drawImage(video, 0, 0, width, height);
        ctx.restore();
    }

    if (!landmarks && !ballPos) return;

    // Draw floor indicator (dynamic based on feet)
    if (landmarks) {
       const footIndices = [27, 28, 29, 30, 31, 32];
       const footYs = footIndices.map(i => landmarks[i].y).filter(y => y > 0);
       if (footYs.length > 0) {
         const floorY = Math.max(...footYs) * height;
         ctx.strokeStyle = 'rgba(0, 255, 204, 0.2)';
         ctx.lineWidth = 2;
         ctx.setLineDash([10, 10]);
         ctx.beginPath();
         ctx.moveTo(0, floorY);
         ctx.lineTo(width, floorY);
         ctx.stroke();
         ctx.setLineDash([]);
       }
    }

    if (landmarks) {
        // Draw connections (bones) - Outer Glow
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.lineWidth = 12;
        ctx.strokeStyle = this.currentScoreColor;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.currentScoreColor;
        
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

        // Joints
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
    }

    // DRAW THE BASKETBALL (The Focus)
    if (ballPos) {
      this.drawBall(ballPos);
    }
    
    // Reset shadow
    ctx.shadowBlur = 0;
  }

  drawBall(ball) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;
    
    // BallTracker already mirrors X to match the flipped canvas
    const x = ball.x * width;
    const y = ball.y * height;
    
    // Dynamic radius based on bounding box size
    const radius = Math.max(20, Math.min(60, ((ball.width || 0.05) * width) / 2));

    // Outer glow ring
    ctx.strokeStyle = '#FFA500';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#FFA500';
    ctx.beginPath();
    ctx.arc(x, y, radius + 10, 0, 2 * Math.PI);
    ctx.stroke();

    // Inner filled circle
    ctx.fillStyle = 'rgba(255, 165, 0, 0.25)';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();

    // Corner brackets
    ctx.strokeStyle = '#FFA500';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#FFA500';
    const s = radius + 20;
    const g = radius / 2;
    ctx.beginPath();
    ctx.moveTo(x - s, y - g); ctx.lineTo(x - s, y - s); ctx.lineTo(x - g, y - s);
    ctx.moveTo(x + g, y - s); ctx.lineTo(x + s, y - s); ctx.lineTo(x + s, y - g);
    ctx.moveTo(x - s, y + g); ctx.lineTo(x - s, y + s); ctx.lineTo(x - g, y + s);
    ctx.moveTo(x + g, y + s); ctx.lineTo(x + s, y + s); ctx.lineTo(x + s, y + g);
    ctx.stroke();

    // Label
    if (ball.label) {
      ctx.fillStyle = '#FFA500';
      ctx.font = 'bold 12px monospace';
      ctx.shadowBlur = 0;
      ctx.fillText(`${ball.label} ${Math.round((ball.score || 0) * 100)}%`, x - s, y - s - 6);
    }
  }
}
