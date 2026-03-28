export class BeatScorer {
  constructor(beatGrid) {
    this.beatGrid = beatGrid;
    this.totalScore = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.multiplier = 1;
    this.hitCounts = { perfect: 0, great: 0, good: 0, miss: 0 };
    this.totalDribbles = 0;
  }

  scoreDribble(dribbleTimestamp) {
    this.totalDribbles++;
    const { beatTime, offsetMs } = this.beatGrid.getNearestBeat(dribbleTimestamp);
    const absOffset = Math.abs(offsetMs);

    let result;

    if (absOffset <= 50) {
      result = { rating: 'perfect', basePoints: 100 };
      this.combo++;
      this.hitCounts.perfect++;
    } else if (absOffset <= 100) {
      result = { rating: 'great', basePoints: 75 };
      this.combo++;
      this.hitCounts.great++;
    } else if (absOffset <= 150) {
      result = { rating: 'good', basePoints: 50 };
      this.combo++;
      this.hitCounts.good++;
    } else {
      result = { rating: 'miss', basePoints: 0 };
      this.combo = 0;
      this.multiplier = 1;
      this.hitCounts.miss++;
    }

    // Update multiplier based on combo
    if (this.combo >= 50) this.multiplier = 8;
    else if (this.combo >= 20) this.multiplier = 4;
    else if (this.combo >= 10) this.multiplier = 2;
    else if (this.combo >= 5) this.multiplier = 1.5;
    else this.multiplier = 1;

    const points = Math.round(result.basePoints * this.multiplier);
    this.totalScore += points;
    this.maxCombo = Math.max(this.maxCombo, this.combo);

    return {
      ...result,
      points,
      offsetMs,
      combo: this.combo,
      multiplier: this.multiplier,
      totalScore: this.totalScore
    };
  }

  getPerformanceLevel() {
    return this.combo;  // LayeredMusicEngine handles thresholds + hysteresis
  }

  getStats() {
    return {
      totalScore: this.totalScore,
      maxCombo: this.maxCombo,
      totalDribbles: this.totalDribbles,
      accuracy: this.totalDribbles > 0
        ? ((this.hitCounts.perfect + this.hitCounts.great) / this.totalDribbles * 100).toFixed(1)
        : 0,
      hitCounts: { ...this.hitCounts }
    };
  }
}
