class VelocityTracker {
  constructor() {
    this.history = [];  
    this.maxHistory = 8; // Slightly larger window for smoother flicks
  }

  update(y, timestamp) {
    this.history.push({ y, timestamp });
    if (this.history.length > this.maxHistory) this.history.shift();
    if (this.history.length < 3) return 0;
    
    // Weighted derivative for recent velocity
    let totalVelocity = 0;
    let totalWeight = 0;
    for (let i = 1; i < this.history.length; i++) {
      const dy = this.history[i].y - this.history[i - 1].y;
      const dt = this.history[i].timestamp - this.history[i - 1].timestamp;
      if (dt <= 0) continue;
      
      const v = dy / dt;
      const weight = i;
      totalVelocity += v * weight;
      totalWeight += weight;
    }
    return totalWeight > 0 ? totalVelocity / totalWeight : 0;
  }
}

export class DribbleDetector {
  constructor() {
    this.leftTracker = new VelocityTracker();
    this.rightTracker = new VelocityTracker();
    
    this.prevLeftV = 0;
    this.prevRightV = 0;
    
    this.lastDribbleTime = 0;
    this.COOLDOWN = 250; 
    this.FLICK_THRESHOLD = 0.0008; // Units/ms downward
  }

  processFrame(landmarks, timestamp) {
    if (!landmarks || landmarks.length < 17) return { detected: false };

    const leftWristY = landmarks[15].y;
    const rightWristY = landmarks[16].y;
    
    const leftV = this.leftTracker.update(leftWristY, timestamp);
    const rightV = this.rightTracker.update(rightWristY, timestamp);
    
    let detected = false;
    let hand = null;

    // "Flick" Logic: Signal peaked and is now decelerating (the snap)
    // MediaPipe Y is top-down, so downward flick = positive velocity increase then decrease.
    if (timestamp - this.lastDribbleTime > this.COOLDOWN) {
      if (this.prevLeftV > this.FLICK_THRESHOLD && leftV < this.prevLeftV * 0.5) {
        detected = true;
        hand = 'left';
      } else if (this.prevRightV > this.FLICK_THRESHOLD && rightV < this.prevRightV * 0.5) {
        detected = true;
        hand = 'right';
      }
    }

    if (detected) {
      this.lastDribbleTime = timestamp;
    }

    this.prevLeftV = leftV;
    this.prevRightV = rightV;

    return {
      detected,
      hand,
      timestamp,
      method: 'flick'
    };
  }
}
