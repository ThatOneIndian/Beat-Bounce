import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export class PoseTracker {
  constructor() {
    this.poseLandmarker = null;
    this.isInitialized = false;
    this.lastResults = null;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Pose tracking model failed to load (timeout). Check your internet connection."));
      }, 25000);

      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        // Switch to Lite model for 30fps performance
        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        clearTimeout(timeout);
        this.isInitialized = true;
        console.info("PoseLandmarker (Lite) initialized for 30fps tracking.");
        resolve();
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  /**
   * Processes a video frame and returns the detected landmarks.
   * @param {HTMLVideoElement} videoElement - The source video
   * @param {number} timestampMs - Current high-res timestamp (performance.now())
   * @returns {Object|null} Array of landmarks if detected, else null
   */
  processFrame(videoElement, timestampMs) {
    if (!this.isInitialized || !this.poseLandmarker) return null;
    if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) return null;

    try {
      this.lastResults = this.poseLandmarker.detectForVideo(videoElement, timestampMs);
      if (this.lastResults.landmarks && this.lastResults.landmarks.length > 0) {
        return this.lastResults.landmarks[0]; // Return the raw person (33 landmarks)
      }
    } catch (err) {
      console.error("Error in PoseLandmarker detection:", err);
    }
    
    return null;
  }
}
