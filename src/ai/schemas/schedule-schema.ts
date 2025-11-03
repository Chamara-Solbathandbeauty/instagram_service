import { z } from 'zod';
import { ScheduleFrequency, ScheduleStatus } from '../../schedules/posting-schedule.entity';
import { PostType } from '../../schedules/schedule-time-slot.entity';

// Time Slot Schema
export const TimeSlotSchema = z.object({
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).describe("Start time in HH:MM:SS format"),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).describe("End time in HH:MM:SS format"),
  dayOfWeek: z.number().min(0).max(6).describe("Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)"),
  postType: z.nativeEnum(PostType).describe("Type of content to post: post_with_image, reel, or story"),
  isEnabled: z.boolean().default(true).describe("Whether this time slot is enabled"),
  label: z.string().optional().describe("Optional label for this time slot (e.g., 'Morning Posts', 'Evening Stories')"),
  tone: z.string().optional().describe("Content tone: free text describing the desired tone (e.g., 'professional', 'casual and friendly', 'authoritative and confident')"),
  dimensions: z.string().optional().describe("Content dimensions: 1:1, 9:16, 4:5, 16:9"),
  preferredVoiceAccent: z.string().optional().describe("Preferred voice accent: american, british, australian, neutral, canadian"),
  reelDuration: z.number().optional().describe("CRITICAL - Duration in seconds: 8, 16, 24, or 32. MUST be included for EVERY reel postType. MUST also be included for story postType when storyType is 'video'. MUST NOT be included for post_with_image or image stories."),
  storyType: z.string().optional().default('image').describe("Story type: 'image' or 'video'. ONLY for story postType. DEFAULT is 'image'. If story postType is 'video', MUST include reelDuration. For image stories, omit reelDuration."),
  imageCount: z.number().int().min(1).max(5).optional().describe("Number of images to generate (1-5). ONLY for post_with_image postType. Randomly assign a value between 1-5 for variety. Omit for reel and story types."),
});

// Main Schedule Schema
export const AIGeneratedScheduleSchema = z.object({
  name: z.string().min(1).max(100).describe("Descriptive name for the posting schedule"),
  description: z.string().min(10).max(3000).describe("Detailed description of the schedule strategy and goals"),
  frequency: z.nativeEnum(ScheduleFrequency).describe("Posting frequency: daily, weekly, or custom"),
  status: z.nativeEnum(ScheduleStatus).default(ScheduleStatus.ACTIVE).describe("Schedule status: active, paused, or inactive"),
  isEnabled: z.boolean().default(true).describe("Whether the schedule is enabled"),
  startDate: z.string().describe("Start date in YYYY-MM-DD format (should be tomorrow's date)"),
  endDate: z.string().describe("End date in YYYY-MM-DD format (should be 3 months from today)"),
  customDays: z.array(z.number().min(0).max(6)).optional().describe("Custom days array (only if frequency is 'custom')"),
  timezone: z.string().default("UTC").describe("Timezone for the schedule"),
  timeSlots: z.array(TimeSlotSchema).min(1).max(14).describe("Time slots for posting (max 2 per day)"),
});

// Type inference
export type AIGeneratedSchedule = z.infer<typeof AIGeneratedScheduleSchema>;
export type TimeSlot = z.infer<typeof TimeSlotSchema>;

// JSON Schema for LangChain structured output (simplified to avoid Gemini constraint errors)
export const scheduleJsonSchema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description: "Schedule name"
    },
    description: {
      type: "string",
      description: "Schedule description"
    },
    frequency: {
      type: "string",
      enum: ["daily", "weekly", "custom"],
      description: "Posting frequency"
    },
    status: {
      type: "string",
      enum: ["active", "paused", "inactive"],
      description: "Schedule status",
      default: "active"
    },
    isEnabled: {
      type: "boolean",
      description: "Schedule enabled",
      default: true
    },
    startDate: {
      type: "string",
      description: "Start date YYYY-MM-DD"
    },
    endDate: {
      type: "string",
      description: "End date YYYY-MM-DD"
    },
    customDays: {
      type: "array",
      items: {
        type: "integer"
      },
      description: "Custom days (0-6)"
    },
    timezone: {
      type: "string",
      description: "Timezone",
      default: "UTC"
    },
    timeSlots: {
      type: "array",
      items: {
        type: "object",
        properties: {
          startTime: {
            type: "string",
            description: "Start time HH:MM:SS"
          },
          endTime: {
            type: "string",
            description: "End time HH:MM:SS"
          },
          dayOfWeek: {
            type: "integer",
            description: "Day 0-6 (0=Sun)"
          },
          postType: {
            type: "string",
            enum: ["post_with_image", "reel", "story"],
            description: "Content type"
          },
          isEnabled: {
            type: "boolean",
            description: "Enabled",
            default: true
          },
          label: {
            type: "string",
            description: "Slot label"
          },
          tone: {
            type: "string",
            description: "Content tone"
          },
          dimensions: {
            type: "string",
            description: "Dimensions"
          },
          preferredVoiceAccent: {
            type: "string",
            description: "Voice accent"
          },
          reelDuration: {
            type: "number",
            description: "Duration in seconds (8, 16, 24, or 32). REQUIRED for reel postType. REQUIRED for story postType when storyType is video. Omit for others."
          },
          storyType: {
            type: "string",
            enum: ["image", "video"],
            description: "Story type. Default 'image'. If 'video', reelDuration is required.",
            default: "image"
          },
          imageCount: {
            type: "integer",
            description: "Image count 1-5"
          }
        },
        required: ["startTime", "endTime", "dayOfWeek", "postType", "isEnabled"]
      },
      description: "Time slots"
    }
  },
  required: ["name", "description", "frequency", "status", "isEnabled", "timezone", "startDate", "endDate", "timeSlots"]
};
