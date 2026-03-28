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

    // Track whether we've already fired for the current downward motion
    this.leftFired = false;
    this.rightFired = false;
    this.leftFiredTime = 0;
    this.rightFiredTime = 0;
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

    const thresh = DETECTION_CONFIG.MIN_VELOCITY_THRESHOLD;
    const cooldown = DETECTION_CONFIG.COOLDOWN_MS;

    // Reset fired flag only when velocity has been non-positive AND enough
    // time has passed since firing — prevents noise from resetting too early
    const minFiredHold = cooldown * 0.75;
    if (leftV <= 0 && (timestamp - this.leftFiredTime) > minFiredHold) this.leftFired = false;
    if (rightV <= 0 && (timestamp - this.rightFiredTime) > minFiredHold) this.rightFired = false;

    let dribbleDetected = false;
    let dribbleHand = null;
    let dribbleIntensity = 0;
    let dribbleScreenX = 0;
    let dribbleScreenY = 0;

    // Peak-velocity detection: fire when downward velocity is above threshold
    // AND has started decreasing (prevV was higher) — this is the impact moment,
    // not the zero-crossing which lags by 2-4 frames.
    if (leftPoint && !this.leftFired && leftV > thresh && this.prevLeftV > leftV) {
      if (timestamp - this.lastDribbleTime >= cooldown) {
        dribbleDetected = true;
        dribbleHand = 'left';
        dribbleIntensity = Math.min(1, leftV / 0.0012);
        dribbleScreenX = leftPoint.rawX;
        dribbleScreenY = leftPoint.rawY;
        this.leftFired = true;
        this.leftFiredTime = timestamp;
      }
    }

    if (!dribbleDetected && rightPoint && !this.rightFired && rightV > thresh && this.prevRightV > rightV) {
      if (timestamp - this.lastDribbleTime >= cooldown) {
        dribbleDetected = true;
        dribbleHand = 'right';
        dribbleIntensity = Math.min(1, rightV / 0.0012);
        dribbleScreenX = rightPoint.rawX;
        dribbleScreenY = rightPoint.rawY;
        this.rightFired = true;
        this.rightFiredTime = timestamp;
      }
    }

    if (dribbleDetected) {
      this.lastDribbleTime = timestamp;
      if (dribbleHand === 'left') this.leftCount++;
      if (dribbleHand === 'right') this.rightCount++;

      if (this.leftCount + this.rightCount >= 8) {
        this.dominantHand = this.leftCount > this.rightCount ? 'left' : 'right';
      }

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
    this.leftFired = false;
    this.rightFired = false;
    this.leftFiredTime = 0;
    this.rightFiredTime = 0;
    this.leftCount = 0;
    this.rightCount = 0;
    this.dominantHand = null;
  }
}
