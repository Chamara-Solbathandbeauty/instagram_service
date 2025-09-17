import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MediaStorageService } from '../services/media-storage.service';
import { VertexAIMediaService } from '../services/vertex-ai-media.service';
import { IgAccount } from '../../users/ig-account.entity';
import { PostingSchedule } from '../../schedules/posting-schedule.entity';
import { ScheduleTimeSlot } from '../../schedules/schedule-time-slot.entity';
import { Content, ContentStatus, ContentType } from '../../content/content.entity';
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
  ): Promise<ReelContentResult> {
    try {
      // 1. Generate video using Vertex AI
      const videoGenerationResult = await this.generateVideo(contentIdea);

      if (!videoGenerationResult.success) {
        throw new Error(`Video generation failed: ${videoGenerationResult.error}`);
      }

      // 2. Handle async video generation (long-running operation)
      if (videoGenerationResult.metadata?.status === 'RUNNING' && videoGenerationResult.metadata?.operationName) {
        // For long-running operations, we need to poll for completion
        console.log('Reel generation is running, polling for completion...');
        
        // Poll for completion (simplified - in production you'd want more sophisticated polling)
        let attempts = 0;
        const maxAttempts = 30; // 5 minutes max (10 second intervals)
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
          
          const statusResult = await this.vertexAiMediaService.checkVideoGenerationStatus(
            videoGenerationResult.metadata.operationName
          );
          
          if (statusResult.success && statusResult.metadata?.status === 'COMPLETED' && statusResult.mediaData) {
            // Video generation completed, save the media
            const media = await this.mediaStorageService.saveMediaFile(
              null, // contentId will be set later by ContentAgentService
              statusResult.mediaData,
              `generated_reel_${Date.now()}.mp4`,
              'video'
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
                duration: 15, // Default duration for reels
              },
            };
          } else if (statusResult.success && statusResult.metadata?.status === 'RUNNING') {
            console.log(`Reel generation still running... attempt ${attempts + 1}/${maxAttempts}`);
            attempts++;
          } else {
            throw new Error(`Reel generation failed: ${statusResult.error || 'Unknown error'}`);
          }
        }
        
        throw new Error('Reel generation timed out after 5 minutes');
      } else if (videoGenerationResult.mediaData) {
        // Direct response with media data (fallback for non-long-running operations)
        const media = await this.mediaStorageService.saveMediaFile(
          null, // contentId will be set later by ContentAgentService
          videoGenerationResult.mediaData,
          `generated_reel_${Date.now()}.mp4`,
          'video'
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
            duration: 15, // Default duration for reels
          },
        };
      } else {
        throw new Error('No media data received from reel generation');
      }
    } catch (error) {
      console.error('Reel Generation Agent Error:', error);
      throw error;
    }
  }

  private async generateVideo(contentIdea: any): Promise<any> {
    const request = {
      prompt: contentIdea.description,
      style: contentIdea.style,
      mood: contentIdea.mood,
      visualElements: contentIdea.visualElements,
      targetAudience: contentIdea.targetAudience,
      duration: 15,
      aspectRatio: '9:16' as const,
    };
    
    // Generate video using Vertex AI
    return await this.vertexAiMediaService.generateVideo(request);
  }
}
