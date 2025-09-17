import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduleContent, ScheduleContentStatus } from '../schedules/schedule-content.entity';
import { SchedulesService } from '../schedules/schedules.service';
import { ContentService } from '../content/content.service';
import { CreateScheduleContentDto } from './dto/create-schedule-content.dto';
import { UpdateScheduleContentDto } from './dto/update-schedule-content.dto';

@Injectable()
export class ScheduleContentService {
  constructor(
    @InjectRepository(ScheduleContent)
    private scheduleContentRepository: Repository<ScheduleContent>,
    private schedulesService: SchedulesService,
    private contentService: ContentService,
  ) {}

  async create(
    userId: string,
    createScheduleContentDto: CreateScheduleContentDto,
  ): Promise<ScheduleContent> {
    console.log('🔍 ScheduleContentService Debug: Creating schedule content record...');
    console.log('🔍 ScheduleContentService Debug: - userId:', userId);
    console.log('🔍 ScheduleContentService Debug: - DTO:', createScheduleContentDto);
    
    // Verify user owns the schedule and content
    console.log('🔍 ScheduleContentService Debug: Verifying schedule ownership...');
    await this.schedulesService.findOne(createScheduleContentDto.scheduleId, userId);
    console.log('✅ ScheduleContentService Debug: Schedule ownership verified');
    
    console.log('🔍 ScheduleContentService Debug: Verifying content ownership...');
    await this.contentService.findOne(createScheduleContentDto.contentId, userId);
    console.log('✅ ScheduleContentService Debug: Content ownership verified');

    console.log('🔍 ScheduleContentService Debug: Creating schedule content entity...');
    const scheduleContent = this.scheduleContentRepository.create(createScheduleContentDto);
    console.log('🔍 ScheduleContentService Debug: Saving to database...');
    const savedRecord = await this.scheduleContentRepository.save(scheduleContent);
    console.log('✅ ScheduleContentService Debug: Schedule content record saved with ID:', savedRecord.id);
    
    return savedRecord;
  }

  async findAll(
    userId: string,
    filters?: {
      scheduleId?: number;
      contentId?: number;
      timeSlotId?: number;
      status?: ScheduleContentStatus;
      scheduledDate?: string;
      scheduledDateFrom?: string;
      scheduledDateTo?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const queryBuilder = this.scheduleContentRepository
      .createQueryBuilder('scheduleContent')
      .leftJoinAndSelect('scheduleContent.schedule', 'schedule')
      .leftJoinAndSelect('scheduleContent.content', 'content')
      .leftJoinAndSelect('scheduleContent.timeSlot', 'timeSlot')
      .leftJoinAndSelect('schedule.account', 'account')
      .where('account.userId = :userId', { userId });

    if (filters?.scheduleId) {
      queryBuilder.andWhere('scheduleContent.scheduleId = :scheduleId', {
        scheduleId: filters.scheduleId,
      });
    }

    if (filters?.contentId) {
      queryBuilder.andWhere('scheduleContent.contentId = :contentId', {
        contentId: filters.contentId,
      });
    }

    if (filters?.timeSlotId) {
      queryBuilder.andWhere('scheduleContent.timeSlotId = :timeSlotId', {
        timeSlotId: filters.timeSlotId,
      });
    }

    if (filters?.status) {
      queryBuilder.andWhere('scheduleContent.status = :status', {
        status: filters.status,
      });
    }

    if (filters?.scheduledDate) {
      queryBuilder.andWhere('scheduleContent.scheduledDate = :scheduledDate', {
        scheduledDate: filters.scheduledDate,
      });
    }

    if (filters?.scheduledDateFrom) {
      queryBuilder.andWhere('scheduleContent.scheduledDate >= :scheduledDateFrom', {
        scheduledDateFrom: filters.scheduledDateFrom,
      });
    }

    if (filters?.scheduledDateTo) {
      queryBuilder.andWhere('scheduleContent.scheduledDate <= :scheduledDateTo', {
        scheduledDateTo: filters.scheduledDateTo,
      });
    }

    queryBuilder.orderBy('scheduleContent.scheduledDate', 'ASC');

    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    queryBuilder.skip(skip).take(limit);

    const [scheduleContent, total] = await queryBuilder.getManyAndCount();

    return {
      data: scheduleContent,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number, userId: number): Promise<ScheduleContent> {
    const scheduleContent = await this.scheduleContentRepository
      .createQueryBuilder('scheduleContent')
      .leftJoinAndSelect('scheduleContent.schedule', 'schedule')
      .leftJoinAndSelect('scheduleContent.content', 'content')
      .leftJoinAndSelect('scheduleContent.timeSlot', 'timeSlot')
      .leftJoinAndSelect('schedule.account', 'account')
      .where('scheduleContent.id = :id', { id })
      .andWhere('account.userId = :userId', { userId })
      .getOne();

    if (!scheduleContent) {
      throw new NotFoundException('Schedule content not found');
    }

    return scheduleContent;
  }

  async findBySchedule(scheduleId: number, userId: string): Promise<ScheduleContent[]> {
    // Verify user owns the schedule
    await this.schedulesService.findOne(scheduleId, userId);

    return this.scheduleContentRepository.find({
      where: { scheduleId },
      relations: ['content', 'timeSlot'],
      order: { scheduledDate: 'ASC', scheduledTime: 'ASC' },
    });
  }

  async update(
    id: number,
    userId: number,
    updateScheduleContentDto: UpdateScheduleContentDto,
  ): Promise<ScheduleContent> {
    const scheduleContent = await this.findOne(id, userId);

    // Remove scheduleId and contentId from update data since we don't allow changing them
    const { scheduleId, contentId, ...updateData } = updateScheduleContentDto as any;

    await this.scheduleContentRepository.update(id, updateData);
    return this.findOne(id, userId);
  }

  async remove(id: number, userId: number): Promise<void> {
    const scheduleContent = await this.findOne(id, userId);
    await this.scheduleContentRepository.remove(scheduleContent);
  }

  async getQueue(filters?: {
    scheduleId?: number;
    timeSlotId?: number;
    status?: string;
    queueDate?: string;
    queueDateFrom?: string;
    queueDateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const queryBuilder = this.scheduleContentRepository
      .createQueryBuilder('scheduleContent')
      .leftJoinAndSelect('scheduleContent.schedule', 'schedule')
      .leftJoinAndSelect('scheduleContent.content', 'content')
      .leftJoinAndSelect('scheduleContent.timeSlot', 'timeSlot')
      .leftJoinAndSelect('schedule.account', 'account')
      .where('scheduleContent.status IN (:...statuses)', {
        statuses: [ScheduleContentStatus.QUEUED, ScheduleContentStatus.SCHEDULED],
      });

    if (filters?.scheduleId) {
      queryBuilder.andWhere('scheduleContent.scheduleId = :scheduleId', {
        scheduleId: filters.scheduleId,
      });
    }

    if (filters?.timeSlotId) {
      queryBuilder.andWhere('scheduleContent.timeSlotId = :timeSlotId', {
        timeSlotId: filters.timeSlotId,
      });
    }

    if (filters?.queueDate) {
      queryBuilder.andWhere('scheduleContent.scheduledDate = :queueDate', {
        queueDate: filters.queueDate,
      });
    }

    if (filters?.queueDateFrom) {
      queryBuilder.andWhere('scheduleContent.scheduledDate >= :queueDateFrom', {
        queueDateFrom: filters.queueDateFrom,
      });
    }

    if (filters?.queueDateTo) {
      queryBuilder.andWhere('scheduleContent.scheduledDate <= :queueDateTo', {
        queueDateTo: filters.queueDateTo,
      });
    }

    queryBuilder
      .orderBy('scheduleContent.priority', 'DESC')
      .addOrderBy('scheduleContent.scheduledDate', 'ASC')
      .addOrderBy('scheduleContent.scheduledTime', 'ASC');

    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    queryBuilder.skip(skip).take(limit);

    const [scheduleContent, total] = await queryBuilder.getManyAndCount();

    return {
      data: scheduleContent,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

