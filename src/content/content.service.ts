import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Content, ContentType, ContentStatus } from './entities/content.entity';
import { Media } from './media.entity';
import { IgAccountsService } from '../ig-accounts/ig-accounts.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { CreateContentMediaDto } from './dto/create-content-media.dto';

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(Content)
    private contentRepository: Repository<Content>,
    @InjectRepository(Media)
    private mediaRepository: Repository<Media>,
    private igAccountsService: IgAccountsService,
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
          filePath: `media/${file.filename}`,
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
      relations: ['account', 'media'],
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
}

