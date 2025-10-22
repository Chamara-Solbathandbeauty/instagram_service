import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Content, ContentType, ContentStatus } from './entities/content.entity';
import { Media } from './media.entity';
import { VideoSegment } from '../ai/entities/video-segment.entity';
import { IgAccountsService } from '../ig-accounts/ig-accounts.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { CreateContentMediaDto } from './dto/create-content-media.dto';
import { VertexAIMediaService } from '../ai/services/vertex-ai-media.service';
import { validateMultipleMediaForContentType, type ContentType as MediaContentType } from './utils/mediaValidation';
import { MediaStorageService } from '../ai/services/media-storage.service';
import { ExtendedVideoGenerationService } from '../ai/services/extended-video-generation.service';
import { ContentIdea } from '../ai/services/video-script-generation.service';
import { PublishedMediaService } from './published-media.service';

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(Content)
    private contentRepository: Repository<Content>,
    @InjectRepository(Media)
    private mediaRepository: Repository<Media>,
    @InjectRepository(VideoSegment)
    private videoSegmentRepository: Repository<VideoSegment>,
    private igAccountsService: IgAccountsService,
    private vertexAiMediaService: VertexAIMediaService,
    private mediaStorageService: MediaStorageService,
    private extendedVideoService: ExtendedVideoGenerationService,
    private publishedMediaService: PublishedMediaService,
  ) {}

  async create(userId: string, createContentDto: CreateContentDto, mediaFiles?: Express.Multer.File[]): Promise<Content> {
    // Verify user owns the account
    await this.igAccountsService.findOne(createContentDto.accountId, userId);

    const content = this.contentRepository.create(createContentDto);
    const savedContent = await this.contentRepository.save(content);

    // Handle media files if provided
    if (mediaFiles && mediaFiles.length > 0) {
      for (const file of mediaFiles) {
        const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
        const createMediaDto: CreateContentMediaDto = {
          fileName: file.filename,
          filePath: file.filename,
          fileSize: file.size,
          mimeType: file.mimetype,
          mediaType: mediaType as any,
        };

        await this.addMedia(savedContent.id, userId, createMediaDto);
      }
    }

    return savedContent;
  }

  async findAll(
    userId: string,
    filters?: {
      accountId?: number;
      type?: ContentType;
      status?: ContentStatus;
      page?: number;
      limit?: number;
    },
  ) {
    const queryBuilder = this.contentRepository
      .createQueryBuilder('content')
      .leftJoinAndSelect('content.account', 'account')
      .leftJoinAndSelect('content.media', 'media')
      .where('account.userId = :userId', { userId });

    if (filters?.accountId) {
      queryBuilder.andWhere('content.accountId = :accountId', {
        accountId: filters.accountId,
      });
    }

    if (filters?.type) {
      queryBuilder.andWhere('content.type = :type', { type: filters.type });
    }

    if (filters?.status) {
      queryBuilder.andWhere('content.status = :status', { status: filters.status });
    }

    queryBuilder.orderBy('content.createdAt', 'DESC');

    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    queryBuilder.skip(skip).take(limit);

    const [content, total] = await queryBuilder.getManyAndCount();

    return {
      data: content,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number, userId: string): Promise<Content> {
    const content = await this.contentRepository
      .createQueryBuilder('content')
      .leftJoinAndSelect('content.account', 'account')
      .leftJoinAndSelect('content.media', 'media')
      .leftJoinAndSelect('content.scheduleContent', 'scheduleContent')
      .leftJoinAndSelect('scheduleContent.schedule', 'schedule')
      .leftJoinAndSelect('scheduleContent.timeSlot', 'timeSlot')
      .where('content.id = :id', { id })
      .andWhere('account.userId = :userId', { userId })
      .getOne();

    if (!content) {
      throw new NotFoundException('Content not found');
    }

    return content;
  }

  async findOneById(id: number): Promise<Content> {
    const content = await this.contentRepository.findOne({
      where: { id },
      relations: ['account', 'media', 'scheduleContent', 'scheduleContent.schedule', 'scheduleContent.timeSlot'],
    });

    if (!content) {
      throw new NotFoundException('Content not found');
    }

    return content;
  }

  async update(
    id: number,
    userId: string,
    updateContentDto: UpdateContentDto,
  ): Promise<Content> {
    const content = await this.findOne(id, userId);

    // Remove accountId from update data since we don't allow changing the account
    const { accountId, ...updateData } = updateContentDto as any;

    await this.contentRepository.update(id, updateData);
    return this.findOne(id, userId);
  }

  async remove(id: number, userId: string): Promise<void> {
    const content = await this.findOne(id, userId);
    await this.contentRepository.remove(content);
  }

  // Media operations
  async addMedia(
    contentId: number,
    userId: string,
    createMediaDto: CreateContentMediaDto,
  ): Promise<Media> {
    const content = await this.findOne(contentId, userId);

    const media = this.mediaRepository.create({
      ...createMediaDto,
      contentId: content.id,
    });

    return this.mediaRepository.save(media);
  }

  async addMediaFiles(
    contentId: number,
    userId: string,
    mediaFiles: Express.Multer.File[],
    prompt?: string,
  ): Promise<Media[]> {
    const content = await this.findOne(contentId, userId);

    // Validate media files against content type
    const validation = validateMultipleMediaForContentType(mediaFiles, content.type as MediaContentType);
    if (!validation.isValid) {
      throw new BadRequestException(`Media validation failed: ${validation.errors.join(', ')}`);
    }

    const createdMedia: Media[] = [];

    for (const file of mediaFiles) {
      const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
      const createMediaDto: CreateContentMediaDto = {
        fileName: file.filename,
        filePath: file.filename,
        fileSize: file.size,
        mimeType: file.mimetype,
        mediaType: mediaType as any,
        prompt: prompt,
      };

      const media = this.mediaRepository.create({
        ...createMediaDto,
        contentId: content.id,
      });

      const savedMedia = await this.mediaRepository.save(media);
      createdMedia.push(savedMedia);
    }

    return createdMedia;
  }

  async getMedia(contentId: number, userId: string): Promise<Media[]> {
    const content = await this.findOne(contentId, userId);
    
    return this.mediaRepository.find({
      where: { contentId: content.id },
      order: { createdAt: 'ASC' },
    });
  }

  async deleteMedia(mediaId: number, userId: string): Promise<void> {
    const media = await this.mediaRepository.findOne({
      where: { id: mediaId },
      relations: ['content', 'content.account'],
    });

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    if (media.content.account.userId !== userId) {
      throw new ForbiddenException('Access denied to this media');
    }

    await this.mediaRepository.remove(media);
  }

  async replaceMediaFiles(
    contentId: number,
    userId: string,
    mediaFiles: Express.Multer.File[],
    prompt?: string,
  ): Promise<Media[]> {
    const content = await this.findOne(contentId, userId);

    // Validate media files against content type
    const validation = validateMultipleMediaForContentType(mediaFiles, content.type as MediaContentType);
    if (!validation.isValid) {
      throw new BadRequestException(`Media validation failed: ${validation.errors.join(', ')}`);
    }

    // Delete all existing media for this content
    const existingMedia = await this.mediaRepository.find({
      where: { contentId: content.id },
    });

    if (existingMedia.length > 0) {
      console.log(`🗑️ Deleting ${existingMedia.length} existing media files for content ${contentId}`);
      await this.mediaRepository.remove(existingMedia);
    }

    // Add new media files
    console.log(`📁 Adding ${mediaFiles.length} new media files for content ${contentId}`);
    const createdMedia: Media[] = [];

    for (const file of mediaFiles) {
      const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
      const createMediaDto: CreateContentMediaDto = {
        fileName: file.filename,
        filePath: file.filename,
        fileSize: file.size,
        mimeType: file.mimetype,
        mediaType: mediaType as any,
        prompt: prompt,
      };

      const media = this.mediaRepository.create({
        ...createMediaDto,
        contentId: content.id,
      });

      const savedMedia = await this.mediaRepository.save(media);
      createdMedia.push(savedMedia);
    }

    return createdMedia;
  }

  async regenerateMedia(mediaId: number, prompt: string, userId: string): Promise<Media> {
    // Find the existing media with its content and account
    const existingMedia = await this.mediaRepository.findOne({
      where: { id: mediaId },
      relations: ['content', 'content.account'],
    });

    if (!existingMedia) {
      throw new NotFoundException('Media not found');
    }

    if (existingMedia.content.account.userId !== userId) {
      throw new ForbiddenException('Access denied to this media');
    }

    // Use injected services

    try {
      // Generate new media based on the prompt and media type
      let newMediaData: Buffer;
      let newFileName: string;

      if (existingMedia.mediaType === 'image') {
        // Generate new image
        const imageRequest = {
          prompt: prompt,
          style: 'professional',
          mood: 'engaging',
          visualElements: ['high quality', 'social media optimized'],
          targetAudience: 'general',
        };
        
        const imageResult = await this.vertexAiMediaService.generateImage(imageRequest);
        if (!imageResult.success || !imageResult.mediaData) {
          throw new Error('Failed to generate new image');
        }
        
        newMediaData = imageResult.mediaData;
        newFileName = `regenerated_image_${Date.now()}.jpg`;
      } else {
        // Generate new video
        const videoRequest = {
          prompt: prompt,
          style: 'professional',
          mood: 'engaging',
          visualElements: ['high quality', 'social media optimized'],
          targetAudience: 'general',
          duration: 15,
          aspectRatio: '16:9' as const, // Veo 3 supported format
        };
        
        const videoResult = await this.vertexAiMediaService.generateVideo(videoRequest);
        if (!videoResult.success || !videoResult.mediaData) {
          throw new Error('Failed to generate new video');
        }
        
        newMediaData = videoResult.mediaData;
        newFileName = `regenerated_video_${Date.now()}.mp4`;
      }

      // Save the new media file
      const newMedia = await this.mediaStorageService.saveMediaFile(
        existingMedia.contentId,
        newMediaData,
        newFileName,
        existingMedia.mediaType,
        prompt
      );

      // Delete the old media file from filesystem
      const fs = await import('fs');
      const path = await import('path');
      const oldFilePath = path.join(process.cwd(), 'uploads', 'media', existingMedia.filePath);
      
      try {
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      } catch (error) {
        console.warn('Failed to delete old media file:', error);
      }

      // Remove the old media record from database
      await this.mediaRepository.remove(existingMedia);

      return newMedia;
    } catch (error) {
      console.error('Error regenerating media:', error);
      throw new Error(`Failed to regenerate media: ${error.message}`);
    }
  }

  /**
   * Generate extended video (8s or 30s) for content
   */
  async generateExtendedVideo(
    contentId: number,
    contentIdea: ContentIdea,
    desiredDuration: number,
    userId: string,
    aspectRatio?: '16:9' | '9:16',
  ): Promise<Media> {
    // Verify content exists and user owns it
    const content = await this.findOne(contentId, userId);

    // Validate duration
    if (desiredDuration !== 8 && desiredDuration !== 30) {
      throw new BadRequestException('Desired duration must be 8 or 30 seconds');
    }

    // Validate content type (only reels and stories)
    if (content.type !== ContentType.REEL && content.type !== ContentType.STORY) {
      throw new BadRequestException('Extended videos can only be generated for reels and stories');
    }

    try {
      console.log(`🎬 Generating ${desiredDuration}s video for content ${contentId}`);

      // Generate extended video
      const media = await this.extendedVideoService.generateExtendedVideo(
        contentId,
        contentIdea,
        desiredDuration,
        aspectRatio,
      );

      return media;
    } catch (error) {
      console.error(`❌ Failed to generate extended video for content ${contentId}:`, error);
      throw new Error(`Failed to generate extended video: ${error.message}`);
    }
  }

  /**
   * Get video segments for a content
   */
  async getVideoSegments(contentId: number, userId: string): Promise<VideoSegment[]> {
    // Verify content exists and user owns it
    await this.findOne(contentId, userId);

    const segments = await this.videoSegmentRepository.find({
      where: { contentId },
      order: { segmentNumber: 'ASC' },
    });

    return segments;
  }

  /**
   * Get published media details for a content
   */
  async getPublishedMedia(contentId: number, userId: string): Promise<any[]> {
    console.log('🔧 ContentService: Getting published media for content:', contentId, 'user:', userId);
    
    // Verify content exists and user owns it
    await this.findOne(contentId, userId);

    const publishedMedia = await this.publishedMediaService.findByContent(contentId);
    console.log('📊 ContentService: Found published media:', publishedMedia);
    return publishedMedia;
  }

  /**
   * Bulk update status for multiple content items
   */
  async bulkUpdateStatus(contentIds: number[], status: string, userId: string): Promise<{ updated: number; message: string }> {
    console.log('🔧 ContentService: bulkUpdateStatus called with:', { contentIds, status, userId });
    
    if (!contentIds || contentIds.length === 0) {
      throw new BadRequestException('Content IDs are required');
    }

    if (!status) {
      throw new BadRequestException('Status is required');
    }

    // Map lowercase status to uppercase ContentStatus
    const statusMap: Record<string, ContentStatus> = {
      'pending': ContentStatus.PENDING,
      'approved': ContentStatus.APPROVED,
      'rejected': ContentStatus.REJECTED,
      'published': ContentStatus.PUBLISHED,
    };

    const mappedStatus = statusMap[status.toLowerCase()];
    if (!mappedStatus) {
      throw new BadRequestException(`Invalid status: ${status}. Valid statuses are: pending, approved, rejected, published`);
    }

    try {
      // Verify all content exists and user owns them
      const contents = await this.contentRepository.find({
        where: { id: In(contentIds) },
        relations: ['account'],
      });

      if (contents.length !== contentIds.length) {
        throw new BadRequestException('Some content items not found');
      }

      // Verify user owns all accounts
      for (const content of contents) {
        if (content.account.userId !== userId) {
          throw new ForbiddenException('You do not have permission to update this content');
        }
      }

      // Update all content status
      await this.contentRepository.update(contentIds, { status: mappedStatus });

      console.log(`✅ Bulk updated ${contentIds.length} content items to status: ${status}`);
      
      return {
        updated: contentIds.length,
        message: `Successfully updated ${contentIds.length} content items to "${status}" status`,
      };
    } catch (error) {
      console.error('❌ Failed to bulk update content status:', error);
      throw error;
    }
  }

  /**
   * Bulk delete multiple content items
   */
  async bulkDelete(contentIds: number[], userId: string): Promise<{ deleted: number; message: string }> {
    console.log('🔧 ContentService: bulkDelete called with:', { contentIds, userId });
    
    if (!contentIds || contentIds.length === 0) {
      throw new BadRequestException('Content IDs are required');
    }

    try {
      // Verify all content exists and user owns them
      const contents = await this.contentRepository.find({
        where: { id: In(contentIds) },
        relations: ['account'],
      });

      if (contents.length !== contentIds.length) {
        throw new BadRequestException('Some content items not found');
      }

      // Verify user owns all accounts
      for (const content of contents) {
        if (content.account.userId !== userId) {
          throw new ForbiddenException('You do not have permission to delete this content');
        }
      }

      // Delete all content items
      await this.contentRepository.delete(contentIds);

      console.log(`✅ Bulk deleted ${contentIds.length} content items`);
      
      return {
        deleted: contentIds.length,
        message: `Successfully deleted ${contentIds.length} content items`,
      };
    } catch (error) {
      console.error('❌ Failed to bulk delete content:', error);
      throw error;
    }
  }

}

