import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MediaStorageService } from '../services/media-storage.service';
import { VertexAIMediaService } from '../services/vertex-ai-media.service';
import { ExtendedVideoGenerationService } from '../services/extended-video-generation.service';
import { PromptBuilderService } from '../services/prompt-builder.service';
import { IgAccount } from '../../ig-accounts/entities/ig-account.entity';
import { PostingSchedule } from '../../schedules/posting-schedule.entity';
import { ScheduleTimeSlot } from '../../schedules/schedule-time-slot.entity';
import { Content, ContentStatus, ContentType } from '../../content/entities/content.entity';
import { Media } from '../../content/media.entity';

export interface ReelContentResult {
  caption: string;
  hashtags: string[];
  contentIdea: {
    title: string;
    description: string;
    visualElements: string[];
    style: string;
    mood: string;
    targetAudience: string;
  };
  mediaPath: string;
  mediaId: number;
  mediaMetadata: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    duration: number;
  };
}

@Injectable()
export class ReelGenerationAgent {
  constructor(
    @InjectRepository(Content)
    private contentRepository: Repository<Content>,
    @InjectRepository(Media)
    private mediaRepository: Repository<Media>,
    private mediaStorageService: MediaStorageService,
    private vertexAiMediaService: VertexAIMediaService,
    private extendedVideoService: ExtendedVideoGenerationService,
    private promptBuilderService: PromptBuilderService,
  ) {}

  async generateContent(
    account: IgAccount,
    schedule: PostingSchedule,
    timeSlot: ScheduleTimeSlot,
    generationDate: string,
    contentIdea: {
      title: string;
      description: string;
      visualElements: string[];
      style: string;
      mood: string;
      targetAudience: string;
    },
    caption: string,
    hashtags: string[],
    contentId?: number,  // Accept contentId from ContentAgentService
    contentType?: 'reel' | 'story'  // Content type for concatenation method selection
  ): Promise<ReelContentResult> {
    try {
      console.log('🎬 Starting 30s reel generation with extended video service');

      // If no contentId provided, create content record (for standalone usage)
      let savedContentId = contentId;
      if (!savedContentId) {
        const content = this.contentRepository.create({
          accountId: account.id,
          caption: caption,
          hashTags: hashtags,
          generatedSource: 'AI Agent - Reel Generator',
          usedTopics: contentIdea.title,
          tone: contentIdea.mood,
          type: ContentType.REEL,
          status: ContentStatus.PENDING,
          desiredDuration: timeSlot.reelDuration || 16, // Use time slot duration or default to 16s
          isExtendedVideo: true,
        });

        const savedContent = await this.contentRepository.save(content);
        savedContentId = savedContent.id;
        console.log(`✅ Content created with ID: ${savedContentId}`);
      } else {
        // Update existing content with extended video settings
        await this.contentRepository.update(savedContentId, {
          desiredDuration: timeSlot.reelDuration || 16, // Use time slot duration or default to 16s
          isExtendedVideo: true,
        });
        console.log(`✅ Using existing content ID: ${savedContentId}`);
      }

      // Enhance content idea with detailed character and setting information
      const enhancedContentIdea = this.enhanceContentIdea(contentIdea);

      // Generate extended video using desired duration from time slot
      const desiredDuration = timeSlot.reelDuration || 16; // default to 16s if not set
      console.log(`🎥 Generating ${desiredDuration}s video for content ${savedContentId}`);
      console.log(`📐 Time slot dimensions: "${timeSlot.dimensions}"`);
      
      // Validate and fix aspect ratio if needed
      let aspectRatio: '16:9' | '9:16' = '9:16'; // Default to portrait
      if (timeSlot.dimensions === '16:9') {
        aspectRatio = '16:9';
      } else if (timeSlot.dimensions === '9:16') {
        aspectRatio = '9:16';
      } else if (timeSlot.dimensions === '6:19') {
        // Fix corrupted data - 6:19 should be 9:16
        console.log(`⚠️  Fixing corrupted aspect ratio: ${timeSlot.dimensions} → 9:16`);
        aspectRatio = '9:16';
      } else {
        console.log(`⚠️  Unknown aspect ratio: ${timeSlot.dimensions}, using default: 9:16`);
      }
      
      console.log(`📐 Using aspect ratio: ${aspectRatio}`);
      
      // Extract time slot context for script generation
      const timeSlotContext = {
        label: timeSlot.label,
        tone: timeSlot.tone,
        preferredVoiceAccent: timeSlot.preferredVoiceAccent,
        dimensions: timeSlot.dimensions,
        reelDuration: timeSlot.reelDuration,
        // Include caption and hashtags for alignment
        caption: caption,
        hashtags: hashtags,
      };
      
      const media = await this.extendedVideoService.generateExtendedVideo(
        savedContentId,
        enhancedContentIdea,
        desiredDuration,
        aspectRatio,
        contentType || 'reel', // Use passed contentType or default to 'reel'
        timeSlotContext
      );

      console.log(`✅ Extended video generation completed for content ${savedContentId}`);

      return {
        caption: caption,
        hashtags: hashtags,
        contentIdea: contentIdea,
        mediaPath: media.filePath,
        mediaId: media.id,
        mediaMetadata: {
          fileName: media.fileName,
          fileSize: media.fileSize,
          mimeType: media.mimeType,
          duration: desiredDuration,
        },
      };
    } catch (error) {
      console.error('❌ Reel Generation Agent Error:', error);
      throw error;
    }
  }

  /**
   * Enhance basic content idea with detailed character and setting information
   * This follows the video script writing best practices for character and background descriptions
   */
  private enhanceContentIdea(basicIdea: any): any {
    // Extract key themes from the content idea
    const isMotivational = basicIdea.mood?.toLowerCase().includes('motivational') || 
                          basicIdea.mood?.toLowerCase().includes('inspirational');
    const isLifestyle = basicIdea.style?.toLowerCase().includes('lifestyle') ||
                       basicIdea.style?.toLowerCase().includes('wellness');
    const isProfessional = basicIdea.targetAudience?.toLowerCase().includes('professional') ||
                          basicIdea.targetAudience?.toLowerCase().includes('business');

    // Create enhanced character profile
    const character = {
      name: isProfessional ? 'Sarah' : 'Alex',
      age: isProfessional ? '28-32' : '22-28',
      appearance: this.generateCharacterAppearance(basicIdea, isProfessional),
      personality: this.generateCharacterPersonality(basicIdea, isMotivational),
      role: isMotivational ? 'Inspirational speaker' : 'Lifestyle influencer'
    };

    // Create detailed setting
    const setting = {
      location: this.generateLocation(basicIdea),
      timeOfDay: this.generateTimeOfDay(basicIdea),
      weather: this.generateWeather(basicIdea),
      atmosphere: this.generateAtmosphere(basicIdea),
      specificDetails: this.generateSettingDetails(basicIdea)
    };

    // Create story arc
    const storyArc = {
      beginning: this.generateStoryBeginning(basicIdea),
      middle: this.generateStoryMiddle(basicIdea),
      end: this.generateStoryEnd(basicIdea)
    };

    return {
      ...basicIdea,
      character,
      setting,
      storyArc
    };
  }

  private generateCharacterAppearance(basicIdea: any, isProfessional: boolean): string {
    const baseAppearance = isProfessional 
      ? 'A confident, well-dressed professional'
      : 'A vibrant, approachable young adult';
    
    const clothing = isProfessional
      ? 'wearing a tailored blazer and modern business attire'
      : 'wearing casual, stylish clothing that reflects current trends';
    
    const features = 'with expressive eyes and a warm, engaging smile';
    
    return `${baseAppearance} ${clothing}, ${features}`;
  }

  private generateCharacterPersonality(basicIdea: any, isMotivational: boolean): string {
    if (isMotivational) {
      return 'Warm, encouraging, and inspiring with a natural ability to connect with viewers';
    }
    return 'Authentic, relatable, and energetic with a genuine passion for sharing experiences';
  }

  private generateLocation(basicIdea: any): string {
    const locations = [
      'A modern, well-lit studio space with clean lines and contemporary furniture',
      'A cozy home office with natural lighting and personal touches',
      'An outdoor urban setting with architectural elements and city views',
      'A peaceful natural environment with trees, plants, and soft lighting',
      'A trendy coffee shop with exposed brick and warm lighting'
    ];
    return locations[Math.floor(Math.random() * locations.length)];
  }

  private generateTimeOfDay(basicIdea: any): string {
    const times = ['Golden hour sunset', 'Early morning with soft light', 'Midday with bright natural light', 'Late afternoon with warm lighting'];
    return times[Math.floor(Math.random() * times.length)];
  }

  private generateWeather(basicIdea: any): string {
    return 'Clear, pleasant conditions with optimal lighting';
  }

  private generateAtmosphere(basicIdea: any): string {
    const atmospheres = [
      'Warm and inviting with a professional yet approachable feel',
      'Energetic and inspiring with positive vibes',
      'Calm and serene with a focus on mindfulness',
      'Dynamic and engaging with modern aesthetics'
    ];
    return atmospheres[Math.floor(Math.random() * atmospheres.length)];
  }

  private generateSettingDetails(basicIdea: any): string[] {
    return [
      'Soft, diffused lighting',
      'Clean, uncluttered background',
      'Natural textures and materials',
      'Modern furniture and decor elements',
      'Plants or natural elements for warmth'
    ];
  }

  private generateStoryBeginning(basicIdea: any): string {
    return 'Character introduction and setting establishment, creating an immediate connection with the viewer';
  }

  private generateStoryMiddle(basicIdea: any): string {
    return 'Key message delivery with engaging visuals and clear communication of the main point';
  }

  private generateStoryEnd(basicIdea: any): string {
    return 'Strong conclusion with a call-to-action or inspiring takeaway that motivates the viewer';
  }


  private async generateVideo(contentIdea: any, timeSlot?: any): Promise<any> {
    const request = {
      prompt: contentIdea.description,
      style: contentIdea.style,
      mood: contentIdea.mood,
      visualElements: contentIdea.visualElements,
      targetAudience: contentIdea.targetAudience,
      duration: timeSlot?.reelDuration || 15,
      aspectRatio: '16:9' as const, // Veo 3 only supports 16:9 aspect ratio
    };
    
    // Generate video using Vertex AI
    return await this.vertexAiMediaService.generateVideo(request);
  }
}
