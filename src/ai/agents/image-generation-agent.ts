import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MediaStorageService } from '../services/media-storage.service';
import { VertexAIMediaService } from '../services/vertex-ai-media.service';
import { PromptBuilderService } from '../services/prompt-builder.service';

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
  mediaId: number;
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
    contentId?: number | null
  ): Promise<ImageContentResult> {
    try {
      // 1. Generate image using Vertex AI
      const imageGenerationResult = await this.generateImage(contentIdea, timeSlot);

      if (!imageGenerationResult.success) {
        throw new Error(`Image generation failed: ${imageGenerationResult.error}`);
      }

      // 2. Create prompt for media generation
      const mediaPrompt = this.promptBuilderService.buildMediaPrompt(
        contentIdea.description,
        contentIdea.style,
        contentIdea.visualElements,
        'POST_WITH_IMAGE',
        account
      );

      // 3. Save media file and create media record
      // If contentId is provided, link immediately; otherwise it will be set later
      const media = await this.mediaStorageService.saveMediaFile(
        contentId || null,
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
        mediaId: media.id,
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


  private async generateImage(contentIdea: any, timeSlot?: ScheduleTimeSlot): Promise<any> {
    const request: any = {
      prompt: contentIdea.description,
      style: contentIdea.style,
      mood: contentIdea.mood,
      visualElements: contentIdea.visualElements,
      targetAudience: contentIdea.targetAudience,
    };
    
    // For story images, use 9:16 aspect ratio (story format)
    if (timeSlot?.postType === 'story') {
      request.aspectRatio = '9:16';
    }
    
    // Generate image using Vertex AI
    return await this.vertexAiMediaService.generateImage(request);
  }
}
