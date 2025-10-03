import { Injectable } from '@nestjs/common';
import { LLMService } from './llm.service';

export interface SegmentScript {
  segmentNumber: number;
  duration: number;
  prompt: string;
  transitionCue?: string;
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
   * @returns Array of segment scripts
   */
  async generateSegmentedScript(
    contentIdea: ContentIdea,
    desiredDuration: number,
  ): Promise<SegmentScript[]> {
    // For 8-second videos, return single segment
    if (desiredDuration <= 8) {
      return [
        {
          segmentNumber: 1,
          duration: 8,
          prompt: this.buildSingleSegmentPrompt(contentIdea),
        },
      ];
    }

    // For 30-second videos, generate 4 segments
    const segmentCount = Math.ceil(desiredDuration / 8); // 30s = 4 segments
    
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

    const scriptPrompt = `You are an expert video script writer for Veo AI video generation with automatic visual continuity.

IMPORTANT: When extending videos, Veo 3 automatically analyzes the last frame of the previous segment and matches:
- Camera position and movement
- Lighting and time of day
- Scene composition and colors
- Character/object positions and states
- Background music continuation

TASK: Create a ${desiredDuration}-second video script divided into ${segmentCount} segments of 8 seconds each.

VIDEO CONCEPT:
- Title: ${contentIdea.title}
- Description: ${contentIdea.description}
- Visual Style: ${contentIdea.style}
- Mood: ${contentIdea.mood}
- Visual Elements: ${contentIdea.visualElements.join(', ')}
- Target Audience: ${contentIdea.targetAudience}

${characterDetails}

${settingDetails}

${storyArcDetails}

SCRIPT REQUIREMENTS:

**SEGMENT 1 (Establishes Everything):**
- Include COMPLETE visual description: exact character appearance, location, lighting, colors, camera angle, subjects, music
- Establish the character's EXACT appearance: facial features, hair, clothing, body type, age
- Establish the EXACT setting: background, lighting conditions, colors, atmosphere, time of day
- Specify 9:16 vertical aspect ratio, professional video quality
- This segment sets the visual baseline that ALL subsequent segments must maintain
- Use the character and setting details provided above for consistency

**SEGMENTS 2-${segmentCount} (Maintain Visual Consistency):**
- Focus on narrative progression while MAINTAINING EXACT visual consistency
- Keep the SAME character appearance, background, lighting, colors, camera style
- Describe what happens next while preserving all visual elements from Segment 1
- Use phrases like "The same character continues...", "In the same setting...", "Maintaining the same lighting..."
- DO NOT change any visual elements - only describe actions and story progression
- Maintain 9:16 vertical aspect ratio and professional quality

EXAMPLE (Correct Format):

Segment 1: "A 25-year-old woman with long brown hair, wearing a white summer dress, walks through a sunlit garden path at golden hour. The botanical garden features cobblestone paths lined with rose bushes and ancient oak trees. Warm amber lighting bathes the scene with soft shadows. Upbeat acoustic guitar music plays. Camera follows smoothly from behind as she walks forward with confident, graceful steps."

Segment 2: "She continues walking forward along the cobblestone path and pauses to look at a red rose. Camera moves to her side, capturing her gentle smile."

Segment 3: "She carefully picks the rose and brings it to her nose, inhaling deeply with a contented expression. Camera slowly circles around to face her, showing her peaceful demeanor."

Segment 4: "She continues walking forward down the path with the rose in hand, her white dress flowing gently. Camera pulls back slightly as she walks into the distance, the garden path stretching ahead."

Notice: Segment 1 has ALL visual details including character appearance and setting. Segments 2-4 only describe ACTIONS (Veo automatically maintains the character, garden, lighting, colors, music from segment 1).

Respond with ONLY valid JSON (no markdown, no explanations):
{
  "segments": [
    {
      "segmentNumber": 1,
      "duration": 8,
      "prompt": "Complete detailed description with character appearance, location, lighting, colors, camera, subjects, music, and initial action"
    },
    {
      "segmentNumber": 2,
      "duration": 8,
      "prompt": "Simple action description: what happens next (Veo auto-continues visuals)"
    },
    {
      "segmentNumber": 3,
      "duration": 8,
      "prompt": "Simple action description: what happens next"
    },
    {
      "segmentNumber": 4,
      "duration": 8,
      "prompt": "Simple action description: conclusion"
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

      return parsed.segments as SegmentScript[];
    } catch (error) {
      console.error('Failed to generate segmented script:', error);
      // Fallback: generate simple sequential prompts
      return this.generateFallbackScript(contentIdea, segmentCount);
    }
  }

  /**
   * Build a single segment prompt for 8-second videos
   */
  private buildSingleSegmentPrompt(contentIdea: ContentIdea): string {
    return `Create a high-quality, engaging 8-second video with the following:

Title: ${contentIdea.title}
Description: ${contentIdea.description}
Style: ${contentIdea.style}
Mood: ${contentIdea.mood}
Visual Elements: ${contentIdea.visualElements.join(', ')}
Target Audience: ${contentIdea.targetAudience}

Requirements:
- High resolution and smooth motion
- Professional cinematography
- Engaging visual storytelling
- Suitable for social media (Instagram Reels/Stories)
- Clear and focused narrative
- Excellent lighting and composition`;
  }

  /**
   * Fallback script generation if AI fails
   */
  private generateFallbackScript(
    contentIdea: ContentIdea,
    segmentCount: number,
  ): SegmentScript[] {
    const segments: SegmentScript[] = [];

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
      duration: 8,
      prompt: `${characterDesc} in ${settingDesc} ${basePrompt} Professional cinematography with smooth camera movements. Establish character appearance, location, lighting, and composition.`,
    });

    // Segments 2+: Simple action progressions (Veo auto-continues visuals)
    const narrativeActions = [
      'Continue the action with natural progression.',
      'Build towards the key moment or message.',
      'Conclude with impactful finale.',
    ];

    for (let i = 1; i < segmentCount; i++) {
      segments.push({
        segmentNumber: i + 1,
        duration: 8,
        prompt: narrativeActions[i - 1] || 'Continue the narrative naturally.',
      });
    }

    return segments;
  }
}
