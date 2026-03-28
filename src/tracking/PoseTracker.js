import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export class PoseTracker {
  constructor() {
    this.poseLandmarker = null;
    this.isInitialized = false;
    this.prevLandmarks = null;
    this.smoothingFactor = 0.45; // 0 = no smoothing, 1 = static (EMA alpha)
  }

  async initialize() {
    if (this.isInitialized) return;
    
    // Load WASM files required by MediaPipe
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task`,
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.4, // Faster initial lock
      minPosePresenceConfidence: 0.4,  // More resilient to occlusion
      minTrackingConfidence: 0.6      // Stable tracking with less jitter
    });

    this.isInitialized = true;
    console.log("PoseLandmarker (Heavy) initialized with smoothing.");
  }

  /**
   * Processes a video frame and returns the detected landmarks.
   * @param {HTMLVideoElement} videoElement - The source video
   * @param {number} timestamp - Current high-res timestamp
   * @returns {Object|null} Array of landmarks if detected, else null
   */
  processFrame(videoElement, timestamp) {
    if (!this.isInitialized || !this.poseLandmarker) return null;
    
    // MediaPipe requires the video to have actual dimensions
    if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) return null;

    try {
      const results = this.poseLandmarker.detectForVideo(videoElement, timestamp);
      if (results.landmarks && results.landmarks.length > 0) {
        const rawLandmarks = results.landmarks[0];
        
        // Apply EMA smoothing to every joint
        if (this.prevLandmarks) {
          const smoothed = rawLandmarks.map((point, i) => {
            const prev = this.prevLandmarks[i];
            return {
              x: prev.x * this.smoothingFactor + point.x * (1 - this.smoothingFactor),
              y: prev.y * this.smoothingFactor + point.y * (1 - this.smoothingFactor),
              z: prev.z * this.smoothingFactor + point.z * (1 - this.smoothingFactor),
              visibility: point.visibility
            };
          });
          this.prevLandmarks = smoothed;
          return smoothed;
        } else {
          this.prevLandmarks = rawLandmarks;
          return rawLandmarks;
        }
      }
    } catch (err) {
      console.error("Error in PoseLandmarker detection:", err);
    }
    
    return null;
  }
}
