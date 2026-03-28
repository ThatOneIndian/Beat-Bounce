import { VelocityTracker } from './VelocityTracker.js';
import { LANDMARKS, DETECTION_CONFIG } from '../utils/constants.js';

function getBestTrackingPoint(landmarks, hand) {
  const wristIdx = hand === 'left' ? LANDMARKS.LEFT_WRIST : LANDMARKS.RIGHT_WRIST;
  const elbowIdx = hand === 'left' ? LANDMARKS.LEFT_ELBOW : LANDMARKS.RIGHT_ELBOW;
  const shoulderIdx = hand === 'left' ? LANDMARKS.LEFT_SHOULDER : LANDMARKS.RIGHT_SHOULDER;

  const wrist = landmarks[wristIdx];
  const elbow = landmarks[elbowIdx];
  const shoulder = landmarks[shoulderIdx];

  if (wrist.visibility > 0.5) {
    return {
      y: wrist.y - shoulder.y, // Normalization: wrist position relative to shoulder
      z: wrist.z,
      x: wrist.x,
      rawY: wrist.y,
      rawX: wrist.x,
      source: 'wrist',
      visibility: wrist.visibility
    };
  }

  if (elbow.visibility > 0.3) {
    return {
      y: elbow.y - shoulder.y,
      z: elbow.z,
      x: elbow.x,
      rawY: elbow.y,
      rawX: elbow.x,
      source: 'elbow',
      visibility: elbow.visibility * 0.6
    };
  }

  return null;
}

export class DribbleDetector {
  constructor() {
    this.leftVelocity = new VelocityTracker();
    this.rightVelocity = new VelocityTracker();

    this.prevLeftV = 0;
    this.prevRightV = 0;

    this.lastDribbleTime = 0;

    this.leftCount = 0;
    this.rightCount = 0;
    this.dominantHand = null;

    this.leftPeakV = 0;
    this.rightPeakV = 0;
  }

  processFrame(landmarks, timestamp) {
    const result = {
      detected: false,
      hand: null,
      timestamp: timestamp,
      intensity: 0,
      wristScreenX: 0,
      wristScreenY: 0,
      leftVelocity: 0,
      rightVelocity: 0,
      dominantHand: this.dominantHand
    };

    if (!landmarks) return result;

    const leftPoint = getBestTrackingPoint(landmarks, 'left');
    const rightPoint = getBestTrackingPoint(landmarks, 'right');

    let leftV = 0;
    let rightV = 0;

    if (leftPoint) {
      leftV = this.leftVelocity.update(leftPoint.y, timestamp);
    }
    if (rightPoint) {
      rightV = this.rightVelocity.update(rightPoint.y, timestamp);
    }

    result.leftVelocity = leftV;
    result.rightVelocity = rightV;

    if (leftV > 0) this.leftPeakV = Math.max(this.leftPeakV, leftV);
    if (rightV > 0) this.rightPeakV = Math.max(this.rightPeakV, rightV);

    let dribbleDetected = false;
    let dribbleHand = null;
    let dribbleIntensity = 0;
    let dribbleScreenX = 0;
    let dribbleScreenY = 0;

    // Zero-crossing check: was moving down (positive V), now stopped or moving up (non-positive V)
    const thresh = DETECTION_CONFIG.MIN_VELOCITY_THRESHOLD;
    const cooldown = DETECTION_CONFIG.COOLDOWN_MS;

    if (leftPoint && this.prevLeftV > thresh && leftV <= 0) {
      if (timestamp - this.lastDribbleTime >= cooldown) {
        if (this.leftPeakV > thresh) {
          dribbleDetected = true;
          dribbleHand = 'left';
          dribbleIntensity = Math.min(1, this.leftPeakV / 0.002);
          dribbleScreenX = leftPoint.rawX;
          dribbleScreenY = leftPoint.rawY;
        }
      }
    }

    if (!dribbleDetected && rightPoint && this.prevRightV > thresh && rightV <= 0) {
      if (timestamp - this.lastDribbleTime >= cooldown) {
        if (this.rightPeakV > thresh) {
          dribbleDetected = true;
          dribbleHand = 'right';
          dribbleIntensity = Math.min(1, this.rightPeakV / 0.002);
          dribbleScreenX = rightPoint.rawX;
          dribbleScreenY = rightPoint.rawY;
        }
      }
    }

    if (dribbleDetected) {
      this.lastDribbleTime = timestamp;
      if (dribbleHand === 'left') this.leftCount++;
      if (dribbleHand === 'right') this.rightCount++;

      if (this.leftCount + this.rightCount >= 8) {
        this.dominantHand = this.leftCount > this.rightCount ? 'left' : 'right';
      }

      this.leftPeakV = 0;
      this.rightPeakV = 0;

      result.detected = true;
      result.hand = dribbleHand;
      result.intensity = dribbleIntensity;
      result.wristScreenX = dribbleScreenX;
      result.wristScreenY = dribbleScreenY;
      result.dominantHand = this.dominantHand;
    }

    this.prevLeftV = leftV;
    this.prevRightV = rightV;

    return result;
  }

  reset() {
    this.leftVelocity.reset();
    this.rightVelocity.reset();
    this.prevLeftV = 0;
    this.prevRightV = 0;
    this.lastDribbleTime = 0;
    this.leftPeakV = 0;
    this.rightPeakV = 0;
    this.leftCount = 0;
    this.rightCount = 0;
    this.dominantHand = null;
  }
}
