export class SensorFusion {
  /**
   * Fuses visual and audio detections to output high-confidence dribble events
   * @param {Object} visualEvent { detected, timestamp } 
   * @param {Object} audioEvent { detected, timestamp }
   * @param {number} toleranceMs Tolerance for timestamp difference
   * @returns {Object} Fused event
   */
  static fuseDribbleSignals(visualEvent, audioEvent) {
    // Both signals agree (High confidence)
    if (visualEvent.detected && audioEvent.detected) {
      return {
        detected: true,
        confidence: 0.95,
        timestamp: Math.min(visualEvent.timestamp, audioEvent.timestamp),
        source: 'fused'
      };
    }

    // Visual only (Flick detected)
    if (visualEvent.detected) {
      return {
        detected: true,
        confidence: 0.7,
        timestamp: visualEvent.timestamp,
        source: 'visual'
      };
    }

    // Audio only (Impact heard)
    if (audioEvent.detected) {
      return {
        detected: true,
        confidence: 0.5,
        timestamp: audioEvent.timestamp,
        source: 'audio'
      };
    }

    return { detected: false, confidence: 0 };
  }
}
