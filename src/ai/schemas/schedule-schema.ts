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
  reelDuration: z.number().optional().describe("Duration in seconds: 8, 15, 30, 45, 60 (for reel and story post types)"),
  storyType: z.string().optional().describe("Story type: 'video' or 'image' (only for story post type)"),
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

// JSON Schema for LangChain structured output
export const scheduleJsonSchema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description: "Descriptive name for the posting schedule",
      minLength: 1,
      maxLength: 100
    },
    description: {
      type: "string",
      description: "Detailed description of the schedule strategy and goals",
      minLength: 10,
      maxLength: 3000
    },
    frequency: {
      type: "string",
      enum: ["daily", "weekly", "custom"],
      description: "Posting frequency: daily, weekly, or custom"
    },
    status: {
      type: "string",
      enum: ["active", "paused", "inactive"],
      description: "Schedule status: active, paused, or inactive",
      default: "active"
    },
    isEnabled: {
      type: "boolean",
      description: "Whether the schedule is enabled",
      default: true
    },
    startDate: {
      type: "string",
      description: "Start date in YYYY-MM-DD format (should be tomorrow's date)",
      pattern: "^\\d{4}-\\d{2}-\\d{2}$"
    },
    endDate: {
      type: "string",
      description: "End date in YYYY-MM-DD format (should be 3 months from today)",
      pattern: "^\\d{4}-\\d{2}-\\d{2}$"
    },
    customDays: {
      type: "array",
      items: {
        type: "integer",
        minimum: 0,
        maximum: 6
      },
      description: "Custom days array (only if frequency is 'custom')"
    },
    timezone: {
      type: "string",
      description: "Timezone for the schedule",
      default: "UTC"
    },
    timeSlots: {
      type: "array",
      items: {
        type: "object",
        properties: {
          startTime: {
            type: "string",
            pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$",
            description: "Start time in HH:MM:SS format"
          },
          endTime: {
            type: "string",
            pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$",
            description: "End time in HH:MM:SS format"
          },
          dayOfWeek: {
            type: "integer",
            minimum: 0,
            maximum: 6,
            description: "Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)"
          },
          postType: {
            type: "string",
            enum: ["post_with_image", "reel", "story"],
            description: "Type of content to post: post_with_image, reel, or story"
          },
          isEnabled: {
            type: "boolean",
            description: "Whether this time slot is enabled",
            default: true
          },
          label: {
            type: "string",
            description: "Optional label for this time slot (e.g., 'Morning Posts', 'Evening Stories')"
          },
          tone: {
            type: "string",
            description: "Content tone: free text describing the desired tone (e.g., 'professional', 'casual and friendly', 'authoritative and confident')"
          },
          dimensions: {
            type: "string",
            description: "Content dimensions: 1:1, 9:16, 4:5, 16:9"
          },
          preferredVoiceAccent: {
            type: "string",
            description: "Preferred voice accent: american, british, australian, neutral, canadian"
          },
          reelDuration: {
            type: "number",
            description: "Duration in seconds: 8, 15, 30, 45, 60 (for reel and story post types)"
          },
          storyType: {
            type: "string",
            description: "Story type: 'video' or 'image' (only for story post type)"
          }
        },
        required: ["startTime", "endTime", "dayOfWeek", "postType", "isEnabled"]
      },
      minItems: 1,
      maxItems: 14,
      description: "Time slots for posting (max 2 per day)"
    }
  },
  required: ["name", "description", "frequency", "status", "isEnabled", "timezone", "startDate", "endDate", "timeSlots"]
};
