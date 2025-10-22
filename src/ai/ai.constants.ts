// AI Module Constants
export const AI_CONSTANTS = {
  // Model Configuration
  MODELS: {
    GEMINI: 'gemini-1.5-flash',
    GEMINI_2_5: 'gemini-2.5-flash',
    VERTEX_AI_TEXT: 'gemini-1.5-flash-001',
    VERTEX_AI_IMAGE: 'imagegeneration@006',
    VERTEX_AI_VIDEO: 'veo-3.0-generate-001',
  },

  // Default Settings
  DEFAULTS: {
    TEMPERATURE: 0.7,
    MAX_OUTPUT_TOKENS: 4096,
    VIDEO_DURATION: 8,
    EXTENDED_VIDEO_DURATION: 30,
    ASPECT_RATIO: '9:16',
    SAMPLE_COUNT: 1,
    SAFETY_FILTER_LEVEL: 'block_some',
  },

  // API Endpoints
  VERTEX_AI_LOCATION: 'us-central1',
  VERTEX_AI_BASE_URL: 'https://us-central1-aiplatform.googleapis.com/v1',

  // Storage
  GCS_BUCKET: 'insta_generated_videos',
  GCS_BASE_FOLDER: 'reels',
  LOCAL_MEDIA_PATH: './uploads/media',

  // File Types
  ALLOWED_IMAGE_TYPES: ['jpg', 'jpeg', 'png', 'webp'],
  ALLOWED_VIDEO_TYPES: ['mp4', 'mov', 'avi', 'webm'],

  // MIME Types
  MIME_TYPES: {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'webm': 'video/webm',
  },

  // Video Generation
  VIDEO_SEGMENT_DURATION: 8,
  MAX_VIDEO_SEGMENTS: 4,
  POLL_INTERVAL_MS: 10000,
  MAX_POLL_ATTEMPTS: 60,

  // Logging
  LOG_LEVELS: {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
  },
} as const;

// Type definitions for better type safety
export type ModelName = keyof typeof AI_CONSTANTS.MODELS;
export type MediaType = 'image' | 'video';
export type AspectRatio = '16:9' | '9:16' | '1:1';
export type LogLevel = keyof typeof AI_CONSTANTS.LOG_LEVELS;
