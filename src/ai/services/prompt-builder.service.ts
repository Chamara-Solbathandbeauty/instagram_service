import { Injectable } from '@nestjs/common';
import { AI_CONSTANTS } from '../ai.constants';

export interface SchedulePromptContext {
  accountName: string;
  accountType: string;
  accountDescription: string;
  accountTopics: string;
  accountTone: string;
  currentDate: string;
  currentDayOfWeek: string;
  currentMonth: string;
  currentYear: string;
  tomorrowDate: string;
  endDate: string;
  userInstructions?: string;
}

export interface ContentPromptContext {
  accountName: string;
  accountType: string;
  accountDescription: string;
  accountTone: string;
  targetAudience: string;
  scheduleName: string;
  frequency: string;
  contentTypes: string;
  timeSlots: string;
  timeSlotDetails?: string;
  currentDate: string;
  generationWeek: string;
  trendingTopics: string;
  contentCount: number;
  userInstructions?: string;
}

export interface MediaPromptRequest {
  prompt: string;
  style: string;
  mood: string;
  visualElements: string[];
  targetAudience: string;
  duration?: number;
  aspectRatio?: string;
}

export interface VideoSegmentContext {
  segment: {
    segmentNumber: number;
    prompt: string;
    duration: number;
  };
  allSegments: Array<{
    segmentNumber: number;
    prompt: string;
  }>;
  visualBaseline?: {
    character: string;
    setting: string;
    lighting: string;
    camera: string;
    colors: string;
    music: string;
    aspectRatio: string;
    quality: string;
  };
}

@Injectable()
export class PromptBuilderService {
  
  /**
   * Build schedule generation prompt
   */
  buildSchedulePrompt(context: SchedulePromptContext): string {
    return `
        You are an expert Instagram content strategist. Generate the most effective, realistic posting schedule for the account below.

        Account Details:
        - Name: ${context.accountName}
        - Type: ${context.accountType}  // one of: business | creator
        - Description: ${context.accountDescription}
        - Topics/Niche: ${context.accountTopics}
        - Tone/Voice: ${context.accountTone}

        Current Date Context (use for seasonality and recency):
        - Today's Date: ${context.currentDate}
        - Current Day of Week: ${context.currentDayOfWeek}
        - Current Month: ${context.currentMonth}
        - Current Year: ${context.currentYear}

        Objectives:
        - Maximize engagement while keeping workload realistic for the account type
        - Reflect the account's topics and tone in the content mix and cadence
        - Be seasonally aware (current month, holidays, typical engagement patterns)

        Hard Requirements (must follow):
        1) frequency ∈ (daily, weekly, custom). Choose custom only if it's clearly better.
        2) status = active, isEnabled = true, timezone = "UTC" (unless a different timezone is clearly implied by the description).
        3) Dates: startDate = tomorrow (${context.tomorrowDate}); endDate = one month from today (${context.endDate}); format = YYYY-MM-DD.
        4) timeSlots (7–14 total). Each slot:
          - dayOfWeek ∈ 0..6 (0=Sun)
          - startTime/endTime in HH:MM:SS (24h) and non-overlapping within the same day
          - postType ∈ (post_with_image, reel, story) - choose based on account type and optimal timing
          - label: descriptive name (e.g., "Morning Posts", "Evening Stories")
          - tone: content tone (free text describing the desired tone, e.g., "professional", "casual and friendly", "authoritative and confident") - match account type
          - dimensions: content format (1:1 for posts, 9:16 for reels/stories, 4:5 for Instagram posts, 16:9 for landscape)
          - preferredVoiceAccent: voice accent for audio content (american, british, australian, neutral, canadian)
          - reelDuration: duration in seconds (8, 16, 24, 32) - ONLY for reel postType, omit for others
          - Favor windows typical for audience (examples):
            • business: weekdays 09:00:00–12:00:00 or 13:00:00–17:00:00 (post_with_image)
            • creator: weekdays 18:00:00–21:00:00; weekends late morning/afternoon (reel)
        5) Ensure internal consistency:
          - No duplicate or overlapping timeSlots per day
          - Use postType distribution that reflects account type and topics:
            • business: post_with_image 50–70%, reel 20–40%, story 10–20%
            • creator: reel 40–60%, story 20–40%, post_with_image 10–30%

        Strategy Guidance (apply, do not output):
        - Derive cadence from accountType and topics (e.g., trending/visual niches → more reels; tutorials/products → more posts)
        - If description suggests local business hours, bias to weekday daytimes; if lifestyle/entertainment, bias evenings/weekends
        - If ${context.currentMonth} contains notable seasonal events, bias timeSlots and notes accordingly

        User Instructions:
        ${context.userInstructions || 'No specific instructions provided. Generate a schedule based on the account type and best practices for Instagram content strategy.'}

        Return only the structured schedule fields (the model will format as JSON via a schema).
        Include:
        - name: short, specific (e.g., "Q${context.currentMonth} ${context.accountType} Growth Plan")
        - description: 2–3 sentences explaining cadence, content mix, and timing rationale (keep under 3000 characters)
        - frequency, status, isEnabled, startDate, endDate, timezone
        - timeSlots (7–14) covering the week without overlaps, each with postType and label
        `;
  }

  /**
   * Build content generation prompt
   */
  buildContentPrompt(context: ContentPromptContext): string {
    return `
        You are an expert Instagram content creator and social media strategist. Generate engaging, trend-aware content for the specified Instagram account.

        ## Account Information
        - Account Name: ${context.accountName}
        - Account Type: ${context.accountType}
        - Description: ${context.accountDescription}
        - Tone: ${context.accountTone}
        - Target Audience: ${context.targetAudience}

        ## Schedule Information
        - Schedule Name: ${context.scheduleName}
        - Frequency: ${context.frequency}
        - Content Types: ${context.contentTypes}
        - Time Slots: ${context.timeSlots}
        - Time Slot Details: ${context.timeSlotDetails || 'Use default settings for all time slots'}

        ## Current Context
        - Current Date: ${context.currentDate}
        - Generation Week: ${context.generationWeek}
        - Trending Topics: ${context.trendingTopics}

        ## Content Requirements
        Generate content for the upcoming week (${context.generationWeek}) based on:

        1. **Account Brand Voice**: Match the account's tone and style
        2. **Content Mix**: Balance the required content types (posts, reels, stories)
        3. **Optimal Timing**: Use the provided time slots for best engagement
        4. **Trend Integration**: Incorporate current trends relevant to the account
        5. **Hashtag Strategy**: Include relevant, trending hashtags
        6. **Engagement Focus**: Create content that encourages interaction
        7. **Time Slot Customization**: Use specific tone, dimensions, voice accent, and reel duration for each time slot

        ## Hard Requirements (must follow):
        1. Generate exactly ${context.contentCount} pieces of content for the week
        2. Each content must have:
          - type ∈ (post_with_image, reel, story)
          - caption: 10-2200 characters, engaging and brand-appropriate
          - hashtags: 1-5 relevant hashtags, mix of trending and niche
          - contentIdea: Structured content idea with:
            - title: Catchy title (5-100 chars)
            - description: Detailed description for media generation (20-500 chars)
            - visualElements: Key visual elements to include (3-10 items)
            - style: Visual style and aesthetic (5-50 chars)
            - mood: Mood and atmosphere (5-50 chars)
            - targetAudience: Specific target audience (10-100 chars)
          - priority: 1-10 (higher = more important)
          - notes: Optional strategy notes

        3. Content should be diverse and engaging
        4. Captions should include call-to-actions
        5. Hashtags should be relevant and trending
        6. Image/video prompts should be detailed for AI generation

        ## Trending Topics to Consider:
        ${context.trendingTopics}

        ## User Instructions:
        ${context.userInstructions || 'No specific instructions provided. Generate content based on the account\'s brand and current trends.'}

        Generate content that feels authentic, engaging, and perfectly aligned with the account's brand and current trends.
        `;
  }

  /**
   * Build image generation prompt
   */
  buildImagePrompt(request: MediaPromptRequest): string {
    const { prompt, style, mood, visualElements, targetAudience } = request;

    return `Create a high-quality, realistic image with the following specifications:

        Content: ${prompt}
        Style: ${style}
        Mood: ${mood}
        Visual Elements: ${visualElements.join(', ')}
        Target Audience: ${targetAudience}

        Requirements:
        - High resolution and photorealistic quality
        - Professional composition and lighting
        - Engaging and visually appealing
        - Suitable for social media content
        - Clear and focused subject matter
        - Excellent color balance and contrast

        Generate an image that perfectly captures the described content with the specified style and mood.`;
  }

  /**
   * Build video generation prompt
   */
  buildVideoPrompt(request: MediaPromptRequest, isFirstSegment: boolean = true): string {
    const { prompt, style, mood, visualElements, targetAudience, duration, aspectRatio } = request;

    if (isFirstSegment) {
      return `Create a high-quality, realistic video with the following specifications:

            Content: ${prompt}
            Style: ${style}
            Mood: ${mood}
            Visual Elements: ${visualElements.join(', ')}
            Target Audience: ${targetAudience}
            Duration: ${duration || AI_CONSTANTS.DEFAULTS.VIDEO_DURATION} seconds
            Aspect Ratio: ${aspectRatio || AI_CONSTANTS.DEFAULTS.ASPECT_RATIO}

            Requirements:
            - High resolution and smooth motion
            - Professional cinematography
            - Engaging visual storytelling
            - Suitable for social media content
            - Clear and focused narrative
            - Excellent lighting and composition
            - Smooth transitions and movements

            Generate a video that perfectly captures the described content with the specified style and mood.`;
    } else {
      // Simplified prompt for continuation segments
      return `Continue the scene: ${prompt}`;
    }
  }

  /**
   * Build first segment prompt with complete visual establishment
   */
  buildFirstSegmentPrompt(context: VideoSegmentContext): string {
    const { segment, allSegments } = context;

    return `Generate an 8-second video segment in English only.

          CONTENT: ${segment.prompt}

          CRITICAL VISUAL ESTABLISHMENT REQUIREMENTS:
          - High quality, professional video
          - 9:16 aspect ratio (vertical)
          - Smooth camera movements
          - Clear, well-lit scene
          - English language only (no text overlays in other languages)
          - Suitable for social media (Instagram Reels/Stories)
          - Establish COMPLETE visual baseline for all subsequent segments

          VISUAL BASELINE REQUIREMENTS:
          - Establish EXACT character appearance (facial features, hair, clothing, body type)
          - Establish EXACT setting/background (location, objects, colors, atmosphere)
          - Establish EXACT lighting conditions (brightness, shadows, colors, time of day)
          - Establish EXACT camera style (angles, movement, framing)
          - Establish EXACT color palette (tones, saturation, contrast)
          - Establish EXACT music style (tempo, mood, instruments)
          - Establish EXACT video quality and aspect ratio

          This is segment 1 of ${allSegments.length} segments that will be combined into a longer video. All subsequent segments must maintain IDENTICAL visual characteristics established in this first segment.`;
  }

  /**
   * Build continuation segment prompt with visual consistency
   */
  buildContinuationPrompt(context: VideoSegmentContext): string {
    const { segment, allSegments, visualBaseline } = context;

    if (!visualBaseline) {
      throw new Error('Visual baseline is required for continuation segments');
    }

    return `Generate an 8-second video segment in English only, continuing from the previous segment.

        CONTENT: ${segment.prompt}

        CRITICAL VISUAL CONSISTENCY REQUIREMENTS:
        - Continue seamlessly from the reference image (last frame of previous segment)
        - Maintain EXACT same character appearance: ${visualBaseline.character}
        - Maintain EXACT same setting/background: ${visualBaseline.setting}
        - Maintain EXACT same lighting conditions: ${visualBaseline.lighting}
        - Maintain EXACT same camera style and angles: ${visualBaseline.camera}
        - Maintain EXACT same color palette and tones: ${visualBaseline.colors}
        - Maintain EXACT same music style and tempo: ${visualBaseline.music}
        - Maintain EXACT same aspect ratio: ${visualBaseline.aspectRatio}
        - Maintain EXACT same video quality: ${visualBaseline.quality}

        TECHNICAL REQUIREMENTS:
        - High quality, professional video
        - 9:16 aspect ratio (vertical)
        - Smooth camera movements
        - Clear, well-lit scene
        - English language only (no text overlays in other languages)
        - Suitable for social media (Instagram Reels/Stories)
        - Consistent with previous segment's visual style

        This is segment ${segment.segmentNumber} of ${allSegments.length} segments. Use the reference image to maintain visual continuity and ensure the character, background, lighting, colors, and camera style are IDENTICAL to the first segment.`;
  }

  /**
   * Build media prompt for saving to database
   */
  buildMediaPrompt(
    mediaDescription: string,
    mediaStyle: string,
    mediaElements: string[],
    postType: string,
    account: any
  ): string {
    const elementsText = mediaElements.join(', ');
    
    let basePrompt = `Create ${postType === 'REEL' ? 'a short video' : 'an image'} for Instagram content. `;
    
    basePrompt += `Content Description: ${mediaDescription}. `;
    basePrompt += `Visual Style: ${mediaStyle}. `;
    basePrompt += `Key Elements to Include: ${elementsText}. `;
    basePrompt += `Account Context: ${account.name} - ${account.description || 'Professional Instagram account'}. `;
    basePrompt += `Brand Tone: ${account.tone || 'Professional and engaging'}. `;
    
    if (postType === 'REEL') {
      basePrompt += `Video Requirements: Create a dynamic, engaging short video (15-30 seconds) with smooth transitions, modern editing, and high visual appeal. Include text overlays if appropriate. Ensure it's optimized for mobile viewing and Instagram's vertical format.`;
    } else if (postType === 'STORY') {
      basePrompt += `Story Requirements: Create a vertical image (9:16 aspect ratio) with bold, readable text overlays. Include interactive elements like polls or questions. Ensure it's eye-catching and designed for mobile viewing.`;
    } else {
      basePrompt += `Post Requirements: Create a high-quality image (1:1 or 4:5 aspect ratio) with professional composition. Include any necessary text overlays or graphics. Ensure it's visually appealing and brand-consistent.`;
    }
    
    return basePrompt;
  }

  /**
   * Parse media prompt to extract components
   */
  parseMediaPrompt(prompt: string): {
    content: string;
    style: string;
    mood: string;
    elements: string[];
    audience: string;
  } {
    // Extract components from the media prompt
    const contentMatch = prompt.match(/Content Description: ([^.]+)/);
    const styleMatch = prompt.match(/Visual Style: ([^.]+)/);
    const elementsMatch = prompt.match(/Key Elements to Include: ([^.]+)/);
    const accountMatch = prompt.match(/Account Context: ([^-]+)/);
    
    return {
      content: contentMatch ? contentMatch[1].trim() : 'Instagram content',
      style: styleMatch ? styleMatch[1].trim() : 'Modern and professional',
      mood: 'Engaging and vibrant',
      elements: elementsMatch ? elementsMatch[1].split(',').map(e => e.trim()) : ['Professional design'],
      audience: accountMatch ? accountMatch[1].trim() : 'Social media users',
    };
  }
}
