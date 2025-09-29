import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImageGenerationAgent } from '../agents/image-generation-agent';
import { ReelGenerationAgent } from '../agents/reel-generation-agent';
import { IgAccount } from '../../ig-accounts/entities/ig-account.entity';
import { PostingSchedule } from '../../schedules/posting-schedule.entity';
import { ScheduleTimeSlot } from '../../schedules/schedule-time-slot.entity';
import { ScheduleContent, ScheduleContentStatus } from '../../schedules/schedule-content.entity';
import { Content } from '../../content/entities/content.entity';

export interface ContentGenerationResult {
  success: boolean;
  contentId?: number;
  mediaPath?: string;
  caption?: string;
  hashtags?: string[];
  error?: string;
  agentUsed?: string;
}

@Injectable()
export class MultiAgentContentService {
  constructor(
    @InjectRepository(IgAccount)
    private igAccountRepository: Repository<IgAccount>,
    @InjectRepository(PostingSchedule)
    private postingScheduleRepository: Repository<PostingSchedule>,
    @InjectRepository(ScheduleContent)
    private scheduleContentRepository: Repository<ScheduleContent>,
    @InjectRepository(Content)
    private contentRepository: Repository<Content>,
    private imageGenerationAgent: ImageGenerationAgent,
    private reelGenerationAgent: ReelGenerationAgent,
  ) {}

  async generateContentForTimeSlot(
    scheduleId: number,
    timeSlotId: number,
    generationDate: string,
    userId: string
  ): Promise<ContentGenerationResult> {
    try {
      // 1. Get schedule with time slot and account details
      const schedule = await this.getScheduleWithTimeSlot(scheduleId, timeSlotId, userId);
      if (!schedule) {
        throw new HttpException('Schedule or time slot not found', HttpStatus.NOT_FOUND);
      }

      const timeSlot = schedule.timeSlots.find(ts => ts.id === timeSlotId);
      if (!timeSlot) {
        throw new HttpException('Time slot not found', HttpStatus.NOT_FOUND);
      }

      // 2. Select appropriate agent based on post type
      const agent = this.selectAgent(timeSlot.postType);
      if (!agent) {
        throw new HttpException(`No agent available for post type: ${timeSlot.postType}`, HttpStatus.BAD_REQUEST);
      }

      // 3. Generate content using the selected agent
      const result = await agent.generateContent(
        schedule.account,
        schedule,
        timeSlot,
        generationDate
      );

      // 4. Create schedule content record
      const scheduleContent = this.scheduleContentRepository.create({
        scheduleId: schedule.id,
        contentId: result.contentId || 0, // Will be updated after content creation
        timeSlotId: timeSlot.id,
        scheduledDate: new Date(generationDate),
        scheduledTime: timeSlot.startTime,
        status: ScheduleContentStatus.SCHEDULED,
        priority: 5,
        notes: result.notes,
      });

      await this.scheduleContentRepository.save(scheduleContent);

      return {
        success: true,
        contentId: result.contentId,
        mediaPath: result.imagePath || result.videoPath,
        caption: result.caption,
        hashtags: result.hashtags,
        agentUsed: this.getAgentName(timeSlot.postType),
      };
    } catch (error) {
      console.error('Multi-Agent Content Generation Error:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate content',
      };
    }
  }

  async generateContentForSchedule(
    scheduleId: number,
    generationWeek: string,
    userId: string
  ): Promise<ContentGenerationResult[]> {
    try {
      // 1. Get schedule with all time slots
      const schedule = await this.getScheduleWithTimeSlots(scheduleId, userId);
      if (!schedule) {
        throw new HttpException('Schedule not found', HttpStatus.NOT_FOUND);
      }

      const results: ContentGenerationResult[] = [];

      // 2. Generate content for each time slot in the week
      for (const timeSlot of schedule.timeSlots) {
        const result = await this.generateContentForTimeSlot(
          scheduleId,
          timeSlot.id,
          generationWeek,
          userId
        );
        results.push(result);
      }

      return results;
    } catch (error) {
      console.error('Schedule Content Generation Error:', error);
      return [{
        success: false,
        error: error.message || 'Failed to generate content for schedule',
      }];
    }
  }

  private async getScheduleWithTimeSlot(
    scheduleId: number,
    timeSlotId: number,
    userId: string
  ): Promise<any> {
    return await this.postingScheduleRepository
      .createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.account', 'account')
      .leftJoinAndSelect('schedule.timeSlots', 'timeSlots')
      .where('schedule.id = :scheduleId', { scheduleId })
      .andWhere('account.userId = :userId', { userId })
      .andWhere('timeSlots.id = :timeSlotId', { timeSlotId })
      .getOne();
  }

  private async getScheduleWithTimeSlots(
    scheduleId: number,
    userId: string
  ): Promise<any> {
    return await this.postingScheduleRepository
      .createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.account', 'account')
      .leftJoinAndSelect('schedule.timeSlots', 'timeSlots')
      .where('schedule.id = :scheduleId', { scheduleId })
      .andWhere('account.userId = :userId', { userId })
      .getOne();
  }

  private selectAgent(postType: string): any {
    switch (postType) {
      case 'post_with_image':
        return this.imageGenerationAgent;
      case 'reel':
        return this.reelGenerationAgent;
      case 'story':
        return this.reelGenerationAgent;
      default:
        return null;
    }
  }

  private getAgentName(postType: string): string {
    switch (postType) {
      case 'post_with_image':
        return 'ImageGenerationAgent';
      case 'reel':
        return 'ReelGenerationAgent';
      case 'story':
        return 'ReelGenerationAgent';
      default:
        return 'UnknownAgent';
    }
  }
}
