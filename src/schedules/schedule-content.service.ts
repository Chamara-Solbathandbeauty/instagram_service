import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { ScheduleContent, ScheduleContentStatus } from './schedule-content.entity';
import { ContentQueue, QueueStatus } from './content-queue.entity';
import { PostingSchedule } from './posting-schedule.entity';
import { Content } from '../content/entities/content.entity';
import { CreateScheduleContentDto } from './dto/create-schedule-content.dto';
import { UpdateScheduleContentDto } from './dto/update-schedule-content.dto';
import { ScheduleContentFilterDto } from './dto/schedule-content-filter.dto';
import { ContentQueueFilterDto } from './dto/content-queue-filter.dto';

@Injectable()
export class ScheduleContentService {
  constructor(
    @InjectRepository(ScheduleContent)
    private scheduleContentRepository: Repository<ScheduleContent>,
    @InjectRepository(ContentQueue)
    private contentQueueRepository: Repository<ContentQueue>,
    @InjectRepository(PostingSchedule)
    private scheduleRepository: Repository<PostingSchedule>,
    @InjectRepository(Content)
    private contentRepository: Repository<Content>,
  ) {}

  async createScheduleContent(createDto: CreateScheduleContentDto, userId: string): Promise<ScheduleContent> {
    // Verify schedule ownership
    const schedule = await this.scheduleRepository.findOne({
      where: { id: createDto.scheduleId },
      relations: ['account'],
    });

    if (!schedule || schedule.account.userId !== userId) {
      throw new NotFoundException('Schedule not found or access denied');
    }

    // Verify content ownership
    const content = await this.contentRepository.findOne({
      where: { id: createDto.contentId },
      relations: ['account'],
    });

    if (!content || content.account.userId !== userId) {
      throw new NotFoundException('Content not found or access denied');
    }

    // Check if content is already scheduled
    const existingSchedule = await this.scheduleContentRepository.findOne({
      where: { contentId: createDto.contentId },
    });

    if (existingSchedule) {
      throw new BadRequestException('Content is already scheduled');
    }

    // Create schedule content
    const scheduleContent = this.scheduleContentRepository.create({
      ...createDto,
      scheduledDate: new Date(createDto.scheduledDate),
      scheduledTime: createDto.scheduledTime || undefined,
    });

    const savedScheduleContent = await this.scheduleContentRepository.save(scheduleContent);

    // Add to content queue
    await this.addToContentQueue(savedScheduleContent);

    return this.getScheduleContentById(savedScheduleContent.id, userId);
  }

  async getScheduleContentById(id: number, userId: string): Promise<ScheduleContent> {
    const scheduleContent = await this.scheduleContentRepository.findOne({
      where: { id },
      relations: ['schedule', 'content', 'timeSlot', 'schedule.account'],
    });

    if (!scheduleContent || scheduleContent.schedule.account.userId !== userId) {
      throw new NotFoundException('Schedule content not found or access denied');
    }

    return scheduleContent;
  }

  async getScheduleContentList(filters: ScheduleContentFilterDto, userId: string): Promise<{
    scheduleContent: ScheduleContent[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder = this.scheduleContentRepository
      .createQueryBuilder('scheduleContent')
      .leftJoinAndSelect('scheduleContent.schedule', 'schedule')
      .leftJoinAndSelect('scheduleContent.content', 'content')
      .leftJoinAndSelect('scheduleContent.timeSlot', 'timeSlot')
      .leftJoinAndSelect('schedule.account', 'account')
      .where('account.userId = :userId', { userId });

    // Apply filters
    if (filters.scheduleId) {
      queryBuilder.andWhere('scheduleContent.scheduleId = :scheduleId', { scheduleId: filters.scheduleId });
    }

    if (filters.contentId) {
      queryBuilder.andWhere('scheduleContent.contentId = :contentId', { contentId: filters.contentId });
    }

    if (filters.timeSlotId) {
      queryBuilder.andWhere('scheduleContent.timeSlotId = :timeSlotId', { timeSlotId: filters.timeSlotId });
    }

    if (filters.status) {
      queryBuilder.andWhere('scheduleContent.status = :status', { status: filters.status });
    }

    if (filters.scheduledDate) {
      queryBuilder.andWhere('scheduleContent.scheduledDate = :scheduledDate', { 
        scheduledDate: new Date(filters.scheduledDate) 
      });
    }

    if (filters.scheduledDateFrom && filters.scheduledDateTo) {
      queryBuilder.andWhere('scheduleContent.scheduledDate BETWEEN :from AND :to', {
        from: new Date(filters.scheduledDateFrom),
        to: new Date(filters.scheduledDateTo),
      });
    }

    // Pagination
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const offset = (page - 1) * limit;

    queryBuilder
      .orderBy('scheduleContent.scheduledDate', 'ASC')
      .addOrderBy('scheduleContent.scheduledTime', 'ASC')
      .skip(offset)
      .take(limit);

    const [scheduleContent, total] = await queryBuilder.getManyAndCount();

    return {
      scheduleContent,
      total,
      page,
      limit,
    };
  }

  async updateScheduleContent(id: number, updateDto: UpdateScheduleContentDto, userId: string): Promise<ScheduleContent> {
    const scheduleContent = await this.getScheduleContentById(id, userId);

    // Update fields
    if (updateDto.scheduledDate) {
      scheduleContent.scheduledDate = new Date(updateDto.scheduledDate);
    }
    if (updateDto.scheduledTime !== undefined) {
      scheduleContent.scheduledTime = updateDto.scheduledTime;
    }
    if (updateDto.status) {
      scheduleContent.status = updateDto.status as ScheduleContentStatus;
    }
    if (updateDto.priority !== undefined) {
      scheduleContent.priority = updateDto.priority;
    }
    if (updateDto.notes !== undefined) {
      scheduleContent.notes = updateDto.notes;
    }
    if (updateDto.failureReason !== undefined) {
      scheduleContent.failureReason = updateDto.failureReason;
    }

    await this.scheduleContentRepository.save(scheduleContent);

    // Update content queue if needed
    if (updateDto.scheduledDate || updateDto.scheduledTime) {
      await this.updateContentQueue(scheduleContent);
    }

    return this.getScheduleContentById(id, userId);
  }

  async deleteScheduleContent(id: number, userId: string): Promise<void> {
    const scheduleContent = await this.getScheduleContentById(id, userId);
    
    // Remove from content queue
    await this.removeFromContentQueue(scheduleContent);
    
    await this.scheduleContentRepository.remove(scheduleContent);
  }

  async getContentQueue(filters: ContentQueueFilterDto, userId: string): Promise<{
    contentQueue: ContentQueue[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder = this.contentQueueRepository
      .createQueryBuilder('contentQueue')
      .leftJoinAndSelect('contentQueue.schedule', 'schedule')
      .leftJoinAndSelect('contentQueue.timeSlot', 'timeSlot')
      .leftJoinAndSelect('schedule.account', 'account')
      .where('account.userId = :userId', { userId });

    // Apply filters
    if (filters.scheduleId) {
      queryBuilder.andWhere('contentQueue.scheduleId = :scheduleId', { scheduleId: filters.scheduleId });
    }

    if (filters.timeSlotId) {
      queryBuilder.andWhere('contentQueue.timeSlotId = :timeSlotId', { timeSlotId: filters.timeSlotId });
    }

    if (filters.status) {
      queryBuilder.andWhere('contentQueue.status = :status', { status: filters.status });
    }

    if (filters.queueDate) {
      queryBuilder.andWhere('contentQueue.queueDate = :queueDate', { 
        queueDate: new Date(filters.queueDate) 
      });
    }

    if (filters.queueDateFrom && filters.queueDateTo) {
      queryBuilder.andWhere('contentQueue.queueDate BETWEEN :from AND :to', {
        from: new Date(filters.queueDateFrom),
        to: new Date(filters.queueDateTo),
      });
    }

    // Pagination
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const offset = (page - 1) * limit;

    queryBuilder
      .orderBy('contentQueue.queueDate', 'ASC')
      .addOrderBy('contentQueue.queueTime', 'ASC')
      .addOrderBy('contentQueue.priority', 'DESC')
      .addOrderBy('contentQueue.position', 'ASC')
      .skip(offset)
      .take(limit);

    const [contentQueue, total] = await queryBuilder.getManyAndCount();

    return {
      contentQueue,
      total,
      page,
      limit,
    };
  }

  async getScheduleContentBySchedule(scheduleId: number, userId: string): Promise<ScheduleContent[]> {
    // Verify schedule ownership
    const schedule = await this.scheduleRepository.findOne({
      where: { id: scheduleId },
      relations: ['account'],
    });

    if (!schedule || schedule.account.userId !== userId) {
      throw new NotFoundException('Schedule not found or access denied');
    }

    return this.scheduleContentRepository.find({
      where: { scheduleId },
      relations: ['content', 'timeSlot'],
      order: { scheduledDate: 'ASC', scheduledTime: 'ASC' },
    });
  }

  private async addToContentQueue(scheduleContent: ScheduleContent): Promise<void> {
    const queueEntry = this.contentQueueRepository.create({
      scheduleId: scheduleContent.scheduleId,
      timeSlotId: scheduleContent.timeSlotId,
      queueDate: scheduleContent.scheduledDate,
      queueTime: scheduleContent.scheduledTime,
      priority: scheduleContent.priority,
      status: QueueStatus.PENDING,
    });

    await this.contentQueueRepository.save(queueEntry);
  }

  private async updateContentQueue(scheduleContent: ScheduleContent): Promise<void> {
    await this.contentQueueRepository.update(
      {
        scheduleId: scheduleContent.scheduleId,
        timeSlotId: scheduleContent.timeSlotId,
        queueDate: scheduleContent.scheduledDate,
      },
      {
        queueTime: scheduleContent.scheduledTime,
        priority: scheduleContent.priority,
      }
    );
  }

  private async removeFromContentQueue(scheduleContent: ScheduleContent): Promise<void> {
    await this.contentQueueRepository.delete({
      scheduleId: scheduleContent.scheduleId,
      timeSlotId: scheduleContent.timeSlotId,
      queueDate: scheduleContent.scheduledDate,
    });
  }
}
