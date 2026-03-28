import { ObjectDetector, FilesetResolver } from '@mediapipe/tasks-vision';

export class BallTracker {
  constructor() {
    this.objectDetector = null;
    this.isInitialized = false;
    this.smoothingAlpha = 0.35;
    this.smoothPos = null;
    this.frameCount = 0;
    this.lastLoggedCategories = null; // For debug
  }

  async initialize() {
    if (this.isInitialized) return;

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    this.objectDetector = await ObjectDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `/models/efficientdet_lite0.tflite`,
        delegate: "CPU" // Use CPU for reliability; GPU can cause silent failures
      },
      runningMode: "VIDEO",
      scoreThreshold: 0.15, // Very lenient — we filter by label
      maxResults: 10         // Look at more detections to find the ball
    });

    this.isInitialized = true;
    console.log("[BallTracker] initialized with CPU delegate.");
  }

  processFrame(videoElement, timestamp) {
    if (!this.isInitialized || !this.objectDetector) return null;
    if (!videoElement || videoElement.readyState < 2) return null;
    if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) return null;

    this.frameCount++;

    try {
      const results = this.objectDetector.detectForVideo(videoElement, timestamp);

      // Log all detected categories every 60 frames for debugging
      if (this.frameCount % 60 === 1 && results.detections.length > 0) {
        const cats = results.detections.map(d =>
          d.categories[0]?.categoryName + ':' + d.categories[0]?.score?.toFixed(2)
        );
        console.log('[BallTracker] detected:', cats.join(', '));
      }

      // COCO class 37 = "sports ball" (basketball, soccer ball, etc.)
      // Also match: 'ball', 'basketball', 'football', 'soccer ball'
      const BALL_LABELS = ['sports ball', 'ball', 'basketball', 'football', 'soccer', 'frisbee'];
      
      const ball = results.detections.find(d =>
        d.categories.some(cat => {
          const name = cat.categoryName?.toLowerCase() ?? '';
          return BALL_LABELS.some(label => name.includes(label));
        })
      );

      if (ball) {
        const box = ball.boundingBox;
        const rawX = (box.originX + box.width / 2) / videoElement.videoWidth;
        const rawY = (box.originY + box.height / 2) / videoElement.videoHeight;

        // Mirror X to match the mirrored canvas rendering
        const mirroredX = 1 - rawX;

        const center = {
          x: mirroredX,
          y: rawY,
          rawX: rawX,
          width: box.width / videoElement.videoWidth,
          height: box.height / videoElement.videoHeight,
          score: ball.categories[0].score,
          label: ball.categories[0].categoryName
        };

        // Exponential moving average for smooth tracking
        if (!this.smoothPos) {
          this.smoothPos = { ...center };
        } else {
          const a = this.smoothingAlpha;
          this.smoothPos.x = this.smoothPos.x * (1 - a) + center.x * a;
          this.smoothPos.y = this.smoothPos.y * (1 - a) + center.y * a;
          this.smoothPos.width = center.width;
          this.smoothPos.height = center.height;
          this.smoothPos.score = center.score;
          this.smoothPos.label = center.label;
        }

        return this.smoothPos;
      }
    } catch (err) {
      // Only log every 100 frames to avoid spam
      if (this.frameCount % 100 === 0) {
        console.error('[BallTracker] detection error:', err.message);
      }
    }

    return null;
  }
}
