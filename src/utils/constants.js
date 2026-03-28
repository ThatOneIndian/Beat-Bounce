/**
 * MediaPipe Pose Landmark Indices
 * 
 * 0-32 indices representing human body joints.
 * Mirrored: Right is on the left side of the frame typically.
 */
export const LANDMARKS = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

/**
 * Dribble Detection Thresholds
 */
export const DETECTION_CONFIG = {
  // Normalized Y per millisecond — must be high enough to ignore hand tremor/breathing
  MIN_VELOCITY_THRESHOLD: 0.0015,

  // Cooldown between dribbles (Prevents double triggers)
  COOLDOWN_MS: 200,

  // Audio detection sensitivity (3x noise floor)
  AUDIO_THRESHOLD_MULTIPLIER: 3,
  MIN_AUDIO_THRESHOLD: 0.08,

  // Logic Synchronization (how long to wait for sensor pairing)
  MAX_SYNC_WINDOW_MS: 80,
};

/**
 * Difficulty presets — affect scoring windows and grade thresholds
 */
export const DIFFICULTY = {
  easy: {
    label: 'Easy',
    perfectMs: 80,
    greatMs: 160,
    goodMs: 250,
    gradeThresholds: { S: 75, A: 60, B: 45, C: 30, D: 15 },
  },
  normal: {
    label: 'Normal',
    perfectMs: 60,
    greatMs: 120,
    goodMs: 200,
    gradeThresholds: { S: 80, A: 65, B: 50, C: 35, D: 20 },
  },
  hard: {
    label: 'Hard',
    perfectMs: 40,
    greatMs: 90,
    goodMs: 150,
    gradeThresholds: { S: 88, A: 72, B: 58, C: 42, D: 28 },
  },
};
