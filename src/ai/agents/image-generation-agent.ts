import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MediaStorageService } from '../services/media-storage.service';
import { VertexAIMediaService } from '../services/vertex-ai-media.service';

import { IgAccount } from '../../ig-accounts/entities/ig-account.entity';
import { PostingSchedule } from '../../schedules/posting-schedule.entity';
import { ScheduleTimeSlot } from '../../schedules/schedule-time-slot.entity';
import { Content, ContentStatus, ContentType } from '../../content/entities/content.entity';
import { Media } from '../../content/media.entity';

export interface ImageContentResult {
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
  mediaMetadata: {
    fileName: string;
    fileSize: number;
    mimeType: string;
  };
}

@Injectable()
export class ImageGenerationAgent {
  constructor(
    @InjectRepository(Content)
    private contentRepository: Repository<Content>,
    @InjectRepository(Media)
    private mediaRepository: Repository<Media>,
    private mediaStorageService: MediaStorageService,
    private vertexAiMediaService: VertexAIMediaService,
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
    hashtags: string[]
  ): Promise<ImageContentResult> {
    try {
      // 1. Generate image using Vertex AI
      const imageGenerationResult = await this.generateImage(contentIdea);

      if (!imageGenerationResult.success) {
        throw new Error(`Image generation failed: ${imageGenerationResult.error}`);
      }

      // 2. Create prompt for media generation
      const mediaPrompt = this.createMediaPrompt(contentIdea);

      // 3. Save media file and create media record (content will be created by ContentAgentService)
      const media = await this.mediaStorageService.saveMediaFile(
        null, // contentId will be set later by ContentAgentService
        imageGenerationResult.mediaData!,
        `generated_image_${Date.now()}.jpg`,
        'image',
        mediaPrompt
      );

      return {
        caption: caption,
        hashtags: hashtags,
        contentIdea: contentIdea,
        mediaPath: media.filePath,
        mediaMetadata: {
          fileName: media.fileName,
          fileSize: media.fileSize,
          mimeType: media.mimeType,
        },
      };
    } catch (error) {
      console.error('Image Generation Agent Error:', error);
      throw error;
    }
  }

  private createMediaPrompt(contentIdea: any): string {
    const elementsText = contentIdea.visualElements.join(', ');
    
    return `Create an image for Instagram content. 
Content Description: ${contentIdea.description}. 
Visual Style: ${contentIdea.style}. 
Mood: ${contentIdea.mood}. 
Key Elements to Include: ${elementsText}. 
Target Audience: ${contentIdea.targetAudience}. 
Requirements: High-quality, professional composition, visually appealing, suitable for social media content.`;
  }

  private async generateImage(contentIdea: any): Promise<any> {
    const request = {
      prompt: contentIdea.description,
      style: contentIdea.style,
      mood: contentIdea.mood,
      visualElements: contentIdea.visualElements,
      targetAudience: contentIdea.targetAudience,
    };
    
    // Generate image using Vertex AI
    return await this.vertexAiMediaService.generateImage(request);
  }
}
