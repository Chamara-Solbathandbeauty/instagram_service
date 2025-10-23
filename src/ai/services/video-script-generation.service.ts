import { Injectable } from '@nestjs/common';
import { LLMService } from './llm.service';

export interface SegmentScript {
  segmentNumber: number;
  duration: number;
  prompt: string;
  transitionCue?: string;
}

export interface TimeSlotContext {
  label?: string;
  tone?: string;
  preferredVoiceAccent?: string;
  dimensions?: string;
  reelDuration?: number;
  caption?: string;
  hashtags?: string[];
}

export interface ContentIdea {
  title: string;
  description: string;
  visualElements: string[];
  style: string;
  mood: string;
  targetAudience: string;
  // Enhanced character and setting details
  character?: {
    name?: string;
    age?: string;
    appearance: string; // "A 25-year-old woman with long brown hair, wearing a white summer dress"
    personality: string; // "Warm, confident, and approachable"
    role: string; // "Main protagonist", "Narrator", etc.
  };
  setting?: {
    location: string; // "A sunlit garden path in a botanical garden"
    timeOfDay: string; // "Golden hour sunset", "Early morning", "Midday"
    weather: string; // "Clear sunny day", "Soft overcast", "Light breeze"
    atmosphere: string; // "Peaceful and serene", "Energetic and vibrant"
    specificDetails: string[]; // ["Cobblestone path", "Rose bushes lining the path", "Ancient oak trees"]
  };
  storyArc?: {
    beginning: string; // "Character introduction and setting establishment"
    middle: string; // "Key action or discovery moment"
    end: string; // "Resolution or conclusion"
  };
}

@Injectable()
export class VideoScriptGenerationService {
  constructor(private llmService: LLMService) {}

  /**
   * Generate a segmented script for extended video
   * @param contentIdea - Content idea with visual details
   * @param desiredDuration - Desired duration in seconds (8 or 30)
   * @param timeSlotContext - Schedule time slot context (tone, voice accent, label)
   * @returns Array of segment scripts
   */
  async generateSegmentedScript(
    contentIdea: ContentIdea,
    desiredDuration: number,
    timeSlotContext?: TimeSlotContext,
    contentType?: 'reel' | 'story',
  ): Promise<SegmentScript[]> {
    // For short videos, return single segment with 8-second duration (Veo 3.0 compatible)
    if (desiredDuration <= 8) {
      return [
        {
          segmentNumber: 1,
          duration: 8, // Always use 8s for Veo 3.0 compatibility
          prompt: this.buildSingleSegmentPrompt(contentIdea, timeSlotContext, contentType),
        },
      ];
    }

    // Calculate segments based on desired duration
    // IMPORTANT: Vertex AI Veo 3.0 only supports durations: 4, 6, 8 seconds
    let segmentCount: number;
    let segmentDuration: number;
    
    if (desiredDuration <= 8) {
      // Single segment for short videos (use 8s for maximum compatibility)
      segmentCount = 1;
      segmentDuration = 8; // Always use 8s for single segments
    } else if (desiredDuration <= 16) {
      // Two segments for medium videos
      segmentCount = 2;
      segmentDuration = 8; // Use 8s per segment (total: 16s)
    } else if (desiredDuration <= 24) {
      // Three segments for longer videos
      segmentCount = 3;
      segmentDuration = 8; // Use 8s per segment (total: 24s)
    } else if (desiredDuration <= 32) {
      // Four segments for extended videos
      segmentCount = 4;
      segmentDuration = 8; // Use 8s per segment (total: 32s)
    } else {
      // Multiple segments for very long videos
      segmentCount = Math.ceil(desiredDuration / 8);
      segmentDuration = 8; // Always use 8s per segment
    }
    
    console.log(`📊 Generating ${segmentCount} segments for ${desiredDuration}s video (${segmentDuration}s per segment)`);
    console.log(`🔍 DEBUG: desiredDuration=${desiredDuration}, segmentCount=${segmentCount}, segmentDuration=${segmentDuration}`);
    console.log(`⚠️  VEO 3.0 LIMITATION: Using 8s segments (Veo 3.0 only supports 4s, 6s, 8s durations)`);
    
    // Build comprehensive character and setting details
    const characterDetails = contentIdea.character ? `
CHARACTER PROFILE:
- Name: ${contentIdea.character.name || 'Main character'}
- Age: ${contentIdea.character.age || 'Young adult'}
- Appearance: ${contentIdea.character.appearance}
- Personality: ${contentIdea.character.personality}
- Role: ${contentIdea.character.role}
` : '';

    const settingDetails = contentIdea.setting ? `
SETTING DETAILS:
- Location: ${contentIdea.setting.location}
- Time of Day: ${contentIdea.setting.timeOfDay}
- Weather: ${contentIdea.setting.weather}
- Atmosphere: ${contentIdea.setting.atmosphere}
- Specific Elements: ${contentIdea.setting.specificDetails.join(', ')}
` : '';

    const storyArcDetails = contentIdea.storyArc ? `
STORY STRUCTURE:
- Beginning: ${contentIdea.storyArc.beginning}
- Middle: ${contentIdea.storyArc.middle}
- End: ${contentIdea.storyArc.end}
` : '';

    // Build time slot context information
    const timeSlotInfo = timeSlotContext ? `
SCHEDULE TIME SLOT REQUIREMENTS:
- Label: ${timeSlotContext.label || 'General Content'}
- Tone: ${timeSlotContext.tone || 'Professional and engaging'}
- Voice Accent: ${timeSlotContext.preferredVoiceAccent || 'American'}
- Dimensions: ${timeSlotContext.dimensions || '9:16 (vertical)'}
- Duration: ${timeSlotContext.reelDuration || desiredDuration} seconds
` : '';

    // Build caption and hashtag context for alignment
    const captionContext = timeSlotContext?.caption ? `
SOCIAL MEDIA CONTEXT:
- Caption: ${timeSlotContext.caption}
- Hashtags: ${timeSlotContext.hashtags?.join(', ') || 'N/A'}

CRITICAL: The video content must visually support and align with the above caption and hashtags. The video narrative should reinforce the caption's message and hashtag themes.
` : '';

    // Build content type specific requirements
    const contentTypeInfo = contentType === 'reel' ? `
REEL CONTENT REQUIREMENTS:
- Fast-paced, engaging content optimized for social media
- Strong opening hook within first 2 seconds
- Quick cuts and dynamic visuals
- Clear call-to-action in final segment
- High energy and engaging throughout
- Optimized for ${timeSlotContext?.dimensions || '9:16'} vertical format
- Duration: ${desiredDuration} seconds total (${segmentCount} segments of 8s each)
` : contentType === 'story' ? `
STORY CONTENT REQUIREMENTS:
- More personal and intimate storytelling
- Smooth, flowing narrative
- Natural pacing and transitions
- Emotional connection with audience
- Optimized for ${timeSlotContext?.dimensions || '9:16'} vertical format
- Duration: ${desiredDuration} seconds total (${segmentCount} segments of 8s each)
` : `
GENERAL VIDEO REQUIREMENTS:
- Professional, engaging content
- Smooth flow and transitions
- Optimized for ${timeSlotContext?.dimensions || '9:16'} vertical format
- Duration: ${desiredDuration} seconds total (${segmentCount} segments of 8s each)
`;

    const scriptPrompt = `You are an expert video script writer for creating seamless 8-second video segments that flow together like a single continuous video.

CRITICAL REQUIREMENTS FOR SMOOTH FLOW:
- Each 8-second segment must feel like a natural continuation, not separate clips
- Voiceover and music must flow continuously without pauses or gaps
- Visual transitions must be smooth and natural
- Story progression must feel organic and engaging

TASK: Create a ${desiredDuration}-second ${contentType || 'video'} script divided into ${segmentCount} segments of 8 seconds each.

${contentTypeInfo}

VIDEO CONCEPT:
- Title: ${contentIdea.title}
- Description: ${contentIdea.description}
- Visual Style: ${contentIdea.style}
- Mood: ${contentIdea.mood}
- Visual Elements: ${contentIdea.visualElements.join(', ')}
- Target Audience: ${contentIdea.targetAudience}

IMPORTANT: The video content MUST match the caption and hashtags that will be displayed with this content. Ensure the visual narrative aligns with the social media caption and hashtag strategy.

${timeSlotInfo}

${captionContext}

${characterDetails}

${settingDetails}

${storyArcDetails}

SCRIPT REQUIREMENTS FOR SEAMLESS FLOW:

  **SEGMENT 1 (Strong Opening Hook - 0-8 seconds):**
  - IMMEDIATE IMPACT: Start with a compelling visual hook in the first 2 seconds
  - Establish character, setting, lighting, colors, camera style, music, voiceover tone
  - Include specific details: exact character features, clothing, location, time of day, lighting conditions
  - Set the audio baseline: music style, tempo, voiceover pace and tone
  - Use ${timeSlotContext?.dimensions || '9:16'} aspect ratio for optimal viewing
  - Create engaging opening that hooks viewers immediately (0-2 seconds)
  - Build momentum and establish story (2-6 seconds)
  - Set up smooth transition to next segment (6-8 seconds)
  - Follow the specified tone: ${timeSlotContext?.tone || 'Professional and engaging'}
  - Use ${timeSlotContext?.preferredVoiceAccent || 'American'} accent for voiceover
  ${contentType === 'reel' ? '- REEL SPECIFIC: High energy, fast-paced, social media optimized' : ''}

**SEGMENTS 2-${segmentCount} (Seamless Continuation):**
- Continue the story naturally without visual or audio breaks
- Maintain IDENTICAL character, setting, lighting, colors, music from Segment 1
- Focus on smooth story progression and natural actions
- Ensure voiceover flows continuously without pauses
- Use transition phrases that connect segments: "As she continues...", "Meanwhile...", "Building on this..."
- Each segment should feel like the next 8 seconds of the same video, not a new clip
- Maintain the ${timeSlotContext?.tone || 'Professional and engaging'} tone throughout
- Keep ${timeSlotContext?.preferredVoiceAccent || 'American'} accent consistency
${contentType === 'reel' ? '- REEL SPECIFIC: Maintain high energy, quick cuts, engaging visuals' : ''}

CRITICAL AUDIO CONTINUITY REQUIREMENTS:
- BACKGROUND MUSIC: Each segment MUST specify the EXACT same music style, tempo, and key
- MUSIC CONTINUITY: "Upbeat acoustic guitar at 120 BPM in C major" → Next segment: "Continue the SAME upbeat acoustic guitar at 120 BPM in C major"
- NO MUSIC CHANGES: Never change music style, tempo, or key between segments
- VOICEOVER FLOW: Each segment must continue the voiceover as if it's one continuous narration
- VOICE CONSISTENCY: Use the SAME voice tone, pace, and accent throughout all segments
- AUDIO SEAMLESSNESS: The audio should sound like one continuous 30-second video, not separate clips
- MUSIC LAYERING: Maintain the same instrumental arrangement and mixing levels
- VOICE TIMING: Voiceover should flow naturally without pauses or abrupt changes
- AUDIO QUALITY: Maintain consistent audio levels and EQ across all segments
- SOUND EFFECTS: If using sound effects, maintain the same ambient sounds throughout

VISUAL FLOW REQUIREMENTS:
- Camera movements must feel natural and connected
- Lighting and colors must remain consistent
- Character appearance must be identical across all segments
- Scene composition must flow smoothly
- Use ${timeSlotContext?.dimensions || '9:16'} aspect ratio consistently

${segmentCount > 2 ? `**FINAL SEGMENT (Powerful Closing - Last 8 seconds):**
- STRONG FINISH: Create a compelling conclusion that leaves viewers satisfied
- Build to a climax or key message in the first 4-6 seconds
- End with a clear call-to-action or memorable closing statement (6-8 seconds)
- Maintain visual and audio consistency with previous segments
- Create a sense of completion and fulfillment
- Use ${timeSlotContext?.dimensions || '9:16'} aspect ratio for optimal viewing
- Follow the specified tone: ${timeSlotContext?.tone || 'Professional and engaging'}
- Use ${timeSlotContext?.preferredVoiceAccent || 'American'} accent for voiceover
${contentType === 'reel' ? '- REEL SPECIFIC: Strong call-to-action, high energy finish, social media engagement' : ''}` : ''}

EXAMPLE (Seamless Audio Flow Format):

Segment 1: "A confident 25-year-old woman with long brown hair, wearing a white summer dress, walks through a sunlit botanical garden at golden hour. The cobblestone path is lined with vibrant rose bushes and ancient oak trees. Warm amber lighting creates soft shadows. Upbeat acoustic guitar music plays at 120 BPM in C major with consistent strumming pattern. Camera follows smoothly from behind as she walks with confident, graceful steps. Voiceover begins in a warm, engaging tone: 'Every journey starts with a single step...'"

Segment 2: "She continues walking forward along the same cobblestone path, her white dress flowing gently in the breeze. Camera moves to her side, capturing her gentle smile as she notices a red rose. The SAME warm lighting and SAME upbeat acoustic guitar music at 120 BPM in C major continues seamlessly without any change. Voiceover continues in the SAME warm, engaging tone without pause: '...and every step leads to new discoveries.'"

Segment 3: "She carefully picks the red rose, bringing it to her nose with a contented expression. Camera slowly circles around to face her, showing her peaceful demeanor. The garden setting, lighting, and SAME upbeat acoustic guitar music at 120 BPM in C major remain completely unchanged. Voiceover flows in the SAME tone without interruption: 'Sometimes the most beautiful moments are the simplest ones.'"

Segment 4: "She continues walking forward down the path with the rose in hand, her white dress flowing gently. Camera pulls back slightly as she walks into the distance, the garden path stretching ahead. The scene maintains the SAME lighting, SAME upbeat acoustic guitar music at 120 BPM in C major, and SAME atmosphere. Voiceover concludes in the SAME warm tone: 'And every ending is just a new beginning.'"

CRITICAL: Notice how the music specification is IDENTICAL across all segments - "upbeat acoustic guitar at 120 BPM in C major" - and the voiceover flows as one continuous narration without any audio breaks or changes.

Respond with ONLY valid JSON (no markdown, no explanations):
{
  "segments": [
    {
      "segmentNumber": 1,
      "duration": ${segmentDuration},
      "prompt": "Complete setup with character, setting, lighting, music, and opening action. Include voiceover start."
    },
    {
      "segmentNumber": 2,
      "duration": ${segmentDuration},
      "prompt": "Seamless continuation with same character, setting, lighting, music. Natural story progression with continuous voiceover."
    },
    {
      "segmentNumber": 3,
      "duration": ${segmentDuration},
      "prompt": "Seamless continuation with same character, setting, lighting, music. Build story momentum with continuous voiceover."
    },
    {
      "segmentNumber": 4,
      "duration": ${segmentDuration},
      "prompt": "Seamless conclusion with same character, setting, lighting, music. Complete story arc with continuous voiceover."
    }
  ]
}`;

    try {
      const llm = this.llmService.getLLM();
      const response = await llm.invoke(scriptPrompt);
      
      // Extract text content from response
      const responseText = typeof response.content === 'string' 
        ? response.content 
        : JSON.stringify(response.content);
      
      // Clean up markdown code blocks if present
      const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      const parsed = JSON.parse(cleanedText);
      
      if (!parsed.segments || !Array.isArray(parsed.segments)) {
        throw new Error('Invalid script format returned');
      }

      // Transform the segments to ensure they have the correct structure
      const transformedSegments = parsed.segments.map((segment: any, index: number) => {
        let promptStr = '';
        
        // Ensure we have valid segmentNumber and duration
        const segmentNumber = segment.segmentNumber || (index + 1);
        const duration = segment.duration || 8;
        
        // If the segment has a complex structure with visuals and audio, combine them into a prompt
        if (segment.visuals && segment.audio) {
          const visuals = typeof segment.visuals === 'string' ? segment.visuals : JSON.stringify(segment.visuals || '');
          const music = typeof segment.audio.music === 'string' ? segment.audio.music : JSON.stringify(segment.audio.music || '');
          const voiceover = typeof segment.audio.voiceover === 'string' ? segment.audio.voiceover : JSON.stringify(segment.audio.voiceover || '');
          promptStr = `${visuals}\n\nAudio: ${music}\nVoiceover: ${voiceover}`;
        }
        // If it already has a prompt field, use it
        else if (segment.prompt) {
          promptStr = typeof segment.prompt === 'string' ? segment.prompt : JSON.stringify(segment.prompt);
        }
        // Fallback: create a basic prompt
        else {
          promptStr = `Generate segment ${segmentNumber} for the video content.`;
        }
        
        return {
          segmentNumber: segmentNumber,
          duration: duration,
          prompt: promptStr
        };
      });

      return transformedSegments as SegmentScript[];
    } catch (error) {
      console.error('Failed to generate segmented script:', error);
      // Fallback: generate simple sequential prompts
      return this.generateFallbackScript(contentIdea, segmentCount, desiredDuration);
    }
  }

  /**
   * Build a single segment prompt for 8-second videos
   */
  private buildSingleSegmentPrompt(contentIdea: ContentIdea, timeSlotContext?: TimeSlotContext, contentType?: 'reel' | 'story'): string {
    const timeSlotInfo = timeSlotContext ? `
Time Slot Requirements:
- Label: ${timeSlotContext.label || 'General Content'}
- Tone: ${timeSlotContext.tone || 'Professional and engaging'}
- Voice Accent: ${timeSlotContext.preferredVoiceAccent || 'American'}
- Dimensions: ${timeSlotContext.dimensions || '9:16 (vertical)'}
` : '';

    const captionContext = timeSlotContext?.caption ? `
Social Media Context:
- Caption: ${timeSlotContext.caption}
- Hashtags: ${timeSlotContext.hashtags?.join(', ') || 'N/A'}

CRITICAL: The video content must visually support and align with the above caption and hashtags.
` : '';

    const contentTypeRequirements = contentType === 'reel' ? `
REEL SPECIFIC REQUIREMENTS:
- Fast-paced, high-energy content optimized for social media
- Strong opening hook within first 2 seconds
- Quick cuts and dynamic visuals
- Clear call-to-action or engaging conclusion
- High energy and engaging throughout
- Optimized for social media sharing
` : contentType === 'story' ? `
STORY SPECIFIC REQUIREMENTS:
- More personal and intimate storytelling
- Smooth, flowing narrative
- Natural pacing and transitions
- Emotional connection with audience
- Intimate and engaging content
` : `
GENERAL REQUIREMENTS:
- Professional, engaging content
- Smooth flow and transitions
- Clear and focused narrative
`;

    return `Create a high-quality, engaging 8-second ${contentType || 'video'} with the following:

Title: ${contentIdea.title}
Description: ${contentIdea.description}
Style: ${contentIdea.style}
Mood: ${contentIdea.mood}
Visual Elements: ${contentIdea.visualElements.join(', ')}
Target Audience: ${contentIdea.targetAudience}

${timeSlotInfo}

${captionContext}

${contentTypeRequirements}

Technical Requirements:
- High resolution and smooth motion
- Professional cinematography
- Engaging visual storytelling
- Suitable for social media (Instagram Reels/Stories)
- Clear and focused narrative
- Excellent lighting and composition
- Strong opening hook (0-2 seconds)
- Smooth middle development (2-6 seconds)
- Satisfying conclusion (6-8 seconds)
- Follow the specified tone: ${timeSlotContext?.tone || 'Professional and engaging'}
- Use ${timeSlotContext?.preferredVoiceAccent || 'American'} accent for voiceover
- Use ${timeSlotContext?.dimensions || '9:16'} aspect ratio`;
  }

  /**
   * Fallback script generation if AI fails
   */
  private generateFallbackScript(
    contentIdea: ContentIdea,
    segmentCount: number,
    desiredDuration?: number,
  ): SegmentScript[] {
    const segments: SegmentScript[] = [];

    // Calculate segment duration - always use 8s for Veo 3.0 compatibility
    const segmentDuration = 8; // Always use 8s for Veo 3.0 compatibility

    // Build character and setting details for fallback
    const characterDesc = contentIdea.character 
      ? `${contentIdea.character.appearance}. ${contentIdea.character.personality}.`
      : 'A person';
    
    const settingDesc = contentIdea.setting 
      ? `${contentIdea.setting.location} at ${contentIdea.setting.timeOfDay}. ${contentIdea.setting.weather}. ${contentIdea.setting.atmosphere}. Features: ${contentIdea.setting.specificDetails.join(', ')}.`
      : 'A suitable location';

    // Segment 1: Detailed establishment with character and setting
    const basePrompt = `${contentIdea.description}. Visual style: ${contentIdea.style}. Mood: ${contentIdea.mood}. Include these elements: ${contentIdea.visualElements.join(', ')}.`;
    
    segments.push({
      segmentNumber: 1,
      duration: segmentDuration,
      prompt: `${characterDesc} in ${settingDesc} ${basePrompt} Professional cinematography with smooth camera movements. Start with a compelling visual hook (0-2 seconds), establish character appearance, location, lighting, and composition (2-6 seconds), and build momentum for the next segment (6-8 seconds).`,
    });

    // Segments 2+: Simple action progressions (Veo auto-continues visuals)
    const narrativeActions = [
      'Continue the action with natural progression.',
      'Build towards the key moment or message.',
      'Conclude with impactful finale.',
    ];

    for (let i = 1; i < segmentCount; i++) {
      const isLastSegment = i === segmentCount - 1;
      const action = isLastSegment 
        ? 'Build to a compelling climax or key message (0-4 seconds), then conclude with a satisfying ending or call-to-action (4-8 seconds).'
        : narrativeActions[i - 1] || 'Continue the narrative naturally.';
      
      segments.push({
        segmentNumber: i + 1,
        duration: segmentDuration,
        prompt: action,
      });
    }

    return segments;
  }
}
