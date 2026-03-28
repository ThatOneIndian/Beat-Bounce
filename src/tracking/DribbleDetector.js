class VelocityTracker {
  constructor() {
    this.history = [];  // ring buffer of {y, timestamp} entries
    this.maxHistory = 5; // smoothing window
  }

  update(y, timestamp) {
    this.history.push({ y, timestamp });
    if (this.history.length > this.maxHistory) this.history.shift();
    
    if (this.history.length < 2) return 0;
    
    // Use weighted average of recent velocity samples for smoothing
    let totalVelocity = 0;
    let totalWeight = 0;
    
    for (let i = 1; i < this.history.length; i++) {
      const dy = this.history[i].y - this.history[i - 1].y;
      const dt = this.history[i].timestamp - this.history[i - 1].timestamp;
      if (dt === 0) continue;
      
      const velocity = dy / dt;  // units per millisecond
      const weight = i;  // recent samples weighted more
      totalVelocity += velocity * weight;
      totalWeight += weight;
    }
    
    return totalWeight > 0 ? totalVelocity / totalWeight : 0;
  }
}

export class DribbleDetector {
  constructor() {
    this.leftTracker = new VelocityTracker();
    this.rightTracker = new VelocityTracker();
    this.ballTracker = new VelocityTracker();
    
    this.prevLeftVelocity = 0;
    this.prevRightVelocity = 0;
    this.prevBallVelocity = 0;
    
    this.lastDribbleTime = 0;
    this.MIN_DRIBBLE_INTERVAL = 250; 
    this.MIN_VELOCITY_THRESHOLD = 0.001;
    this.floorY = 0.9; // Default starting assumption
  }

  updateFloorHeight(landmarks) {
    if (!landmarks) return;
    // Ankles (27, 28), Heels (29, 30), and Toes (31, 32)
    const footIndices = [27, 28, 29, 30, 31, 32];
    const footYs = footIndices.map(i => landmarks[i].y).filter(y => y > 0);
    if (footYs.length > 0) {
      // Estimate floor as the lowest foot point detected
      const currentFloor = Math.max(...footYs);
      // Smooth the floor height estimate
      this.floorY = this.floorY * 0.95 + currentFloor * 0.05;
    }
  }

  processFrame(poseLandmarks, ballPos, timestamp) {
    this.updateFloorHeight(poseLandmarks);

    let dribbleDetected = false;
    let dribbleHand = null;
    let impactY = 0;

    // We still track wrists for synchronization, but the ball is the "source of truth"
    const wrists = poseLandmarks ? {
       left: { y: poseLandmarks[15].y, visibility: poseLandmarks[15].visibility },
       right: { y: poseLandmarks[16].y, visibility: poseLandmarks[16].visibility }
    } : null;

    if (ballPos) {
      const ballVelocity = this.ballTracker.update(ballPos.y, timestamp);
      
      // Detection Logic: Velocity reverses direction from down to up (pos -> neg)
      // AND the ball is within the bottom 15% of the estimated body height (near floor)
      const isNearFloor = ballPos.y > (this.floorY - 0.15); 
      
      if (isNearFloor && this.prevBallVelocity > 0 && ballVelocity <= 0) {
        if (timestamp - this.lastDribbleTime > this.MIN_DRIBBLE_INTERVAL) {
          dribbleDetected = true;
          impactY = ballPos.y;
          
          // Determine which hand was likely responsible based on proximity
          if (wrists) {
            const distLeft = Math.abs(ballPos.x - (1 - poseLandmarks[15].x));
            const distRight = Math.abs(ballPos.x - (1 - poseLandmarks[16].x));
            dribbleHand = distLeft < distRight ? 'left' : 'right';
          }
        }
      }
      this.prevBallVelocity = ballVelocity;
    }

    if (dribbleDetected) {
      this.lastDribbleTime = timestamp;
    }

    return {
      detected: dribbleDetected,
      hand: dribbleHand,
      timestamp: timestamp,
      impactY: impactY,
      floorY: this.floorY,
      ballPos: ballPos,
      wristPositions: wrists
    };
  }
}
