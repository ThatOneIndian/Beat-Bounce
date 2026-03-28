/**
 * VelocityTracker.js
 * 
 * Computes a smoothed velocity from a stream of position/timestamp pairs.
 * Uses an exponentially weighted moving average (EWMA) for noise reduction.
 */
export class VelocityTracker {
  constructor(maxHistory = 6) {
    this.history = [];
    this.maxHistory = maxHistory;
    this.currentVelocity = 0;
  }

  /**
   * Updates the tracker with a new position and timestamp.
   * @param {number} y - The normalized Y position (0.0 to 1.0)
   * @param {number} timestamp - performance.now() value
   * @returns {number} The current calculated velocity
   */
  update(y, timestamp) {
    this.history.push({ y, timestamp });
    
    // Maintain history limit
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    if (this.history.length < 2) {
      this.currentVelocity = 0;
      return 0;
    }

    // Weighted velocity sum calculation
    // Recent frames are weighted more heavily (i)
    let weightedSum = 0;
    let weightSum = 0;

    for (let i = 1; i < this.history.length; i++) {
      const prev = this.history[i - 1];
      const curr = this.history[i];
      
      const dy = curr.y - prev.y;
      const dt = curr.timestamp - prev.timestamp;
      
      if (dt <= 0) continue;
      
      const velocity = dy / dt; 
      const weight = i; // simple linear weight for recent data
      
      weightedSum += velocity * weight;
      weightSum += weight;
    }

    this.currentVelocity = weightSum > 0 ? weightedSum / weightSum : 0;
    return this.currentVelocity;
  }

  getVelocity() {
    return this.currentVelocity;
  }

  reset() {
    this.history = [];
    this.currentVelocity = 0;
  }
}
