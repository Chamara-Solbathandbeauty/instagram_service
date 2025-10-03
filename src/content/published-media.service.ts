import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PublishedMedia } from './entities/published-media.entity';

export interface CreatePublishedMediaDto {
  contentId: number;
  accountId: number;
  instagramMediaId: string;
  instagramUrl?: string;
  instagramPermalink?: string;
  publishedAt: Date;
  metadata?: any;
}

export interface UpdatePublishedMediaDto {
  instagramUrl?: string;
  instagramPermalink?: string;
  metadata?: any;
  isActive?: boolean;
}

@Injectable()
export class PublishedMediaService {
  constructor(
    @InjectRepository(PublishedMedia)
    private readonly publishedMediaRepository: Repository<PublishedMedia>,
  ) {}

  /**
   * Create a new published media record
   */
  async createPublishedMedia(dto: CreatePublishedMediaDto): Promise<PublishedMedia> {
    console.log('🔧 PublishedMediaService.createPublishedMedia called with:', dto);
    
    try {
      const publishedMedia = this.publishedMediaRepository.create(dto);
      const saved = await this.publishedMediaRepository.save(publishedMedia);
      console.log('💾 Published media saved to database:', saved);
      return saved;
    } catch (error) {
      console.error('❌ Error saving published media to database:', error);
      throw error;
    }
  }

  /**
   * Find published media by content ID and account ID
   */
  async findByContentAndAccount(
    contentId: number,
    accountId: number,
  ): Promise<PublishedMedia | null> {
    return await this.publishedMediaRepository.findOne({
      where: { contentId, accountId },
      relations: ['content', 'account'],
    });
  }

  /**
   * Find published media by Instagram media ID
   */
  async findByInstagramMediaId(instagramMediaId: string): Promise<PublishedMedia | null> {
    return await this.publishedMediaRepository.findOne({
      where: { instagramMediaId },
      relations: ['content', 'account'],
    });
  }

  /**
   * Get all published media for a specific account
   */
  async findByAccount(accountId: number): Promise<PublishedMedia[]> {
    return await this.publishedMediaRepository.find({
      where: { accountId },
      relations: ['content'],
      order: { publishedAt: 'DESC' },
    });
  }

  /**
   * Get all published media for a specific content
   */
  async findByContent(contentId: number): Promise<PublishedMedia[]> {
    return await this.publishedMediaRepository.find({
      where: { contentId },
      relations: ['account'],
      order: { publishedAt: 'DESC' },
    });
  }

  /**
   * Update published media record
   */
  async updatePublishedMedia(
    id: number,
    dto: UpdatePublishedMediaDto,
  ): Promise<PublishedMedia | null> {
    await this.publishedMediaRepository.update(id, dto);
    return await this.publishedMediaRepository.findOne({
      where: { id },
      relations: ['content', 'account'],
    });
  }

  /**
   * Update published media by Instagram media ID
   */
  async updateByInstagramMediaId(
    instagramMediaId: string,
    dto: UpdatePublishedMediaDto,
  ): Promise<PublishedMedia | null> {
    const publishedMedia = await this.findByInstagramMediaId(instagramMediaId);
    if (!publishedMedia) {
      return null;
    }
    return await this.updatePublishedMedia(publishedMedia.id, dto);
  }

  /**
   * Mark published media as inactive
   */
  async markAsInactive(id: number): Promise<PublishedMedia | null> {
    return await this.updatePublishedMedia(id, { isActive: false });
  }

  /**
   * Mark published media as inactive by Instagram media ID
   */
  async markAsInactiveByInstagramMediaId(instagramMediaId: string): Promise<PublishedMedia | null> {
    return await this.updateByInstagramMediaId(instagramMediaId, { isActive: false });
  }

  /**
   * Delete published media record
   */
  async deletePublishedMedia(id: number): Promise<boolean> {
    const result = await this.publishedMediaRepository.delete(id);
    return result.affected > 0;
  }

  /**
   * Delete published media by Instagram media ID
   */
  async deleteByInstagramMediaId(instagramMediaId: string): Promise<boolean> {
    const publishedMedia = await this.findByInstagramMediaId(instagramMediaId);
    if (!publishedMedia) {
      return false;
    }
    return await this.deletePublishedMedia(publishedMedia.id);
  }

  /**
   * Get published media statistics for an account
   */
  async getAccountStats(accountId: number): Promise<{
    totalPublished: number;
    activePublished: number;
    inactivePublished: number;
    recentPublishes: PublishedMedia[];
  }> {
    const [totalPublished, activePublished, inactivePublished, recentPublishes] = await Promise.all([
      this.publishedMediaRepository.count({ where: { accountId } }),
      this.publishedMediaRepository.count({ where: { accountId, isActive: true } }),
      this.publishedMediaRepository.count({ where: { accountId, isActive: false } }),
      this.publishedMediaRepository.find({
        where: { accountId },
        relations: ['content'],
        order: { publishedAt: 'DESC' },
        take: 10,
      }),
    ]);

    return {
      totalPublished,
      activePublished,
      inactivePublished,
      recentPublishes,
    };
  }

  /**
   * Check if content has been published to a specific account
   */
  async isContentPublishedToAccount(contentId: number, accountId: number): Promise<boolean> {
    const count = await this.publishedMediaRepository.count({
      where: { contentId, accountId },
    });
    return count > 0;
  }

  /**
   * Get all active published media for an account
   */
  async getActivePublishedMedia(accountId: number): Promise<PublishedMedia[]> {
    return await this.publishedMediaRepository.find({
      where: { accountId, isActive: true },
      relations: ['content'],
      order: { publishedAt: 'DESC' },
    });
  }
}
