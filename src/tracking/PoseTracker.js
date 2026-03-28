import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export class PoseTracker {
  constructor() {
    this.poseLandmarker = null;
    this.isInitialized = false;
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
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.8 // High confidence to stick to one person
    });

    this.isInitialized = true;
    console.log("PoseLandmarker initialized.");
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
        return results.landmarks[0]; // We only track one person
      }
    } catch (err) {
      console.error("Error in PoseLandmarker detection limit/throughput:", err);
    }
    
    return null;
  }
}
