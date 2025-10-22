import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IgAccount } from '../ig-accounts/entities/ig-account.entity';
import { Content } from '../content/entities/content.entity';
import { PostingSchedule } from '../schedules/posting-schedule.entity';
import { ScheduleContent } from '../schedules/schedule-content.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(IgAccount)
    private igAccountRepository: Repository<IgAccount>,
    @InjectRepository(Content)
    private contentRepository: Repository<Content>,
    @InjectRepository(PostingSchedule)
    private scheduleRepository: Repository<PostingSchedule>,
    @InjectRepository(ScheduleContent)
    private scheduleContentRepository: Repository<ScheduleContent>,
  ) {}

  async getDashboardStats(userId: string) {
    try {
      // Get account statistics
      const totalAccounts = await this.igAccountRepository.count({
        where: { userId }
      });

      const connectedAccounts = await this.igAccountRepository.count({
        where: { userId, isConnected: true }
      });

      // Get content statistics
      const totalContent = await this.contentRepository
        .createQueryBuilder('content')
        .leftJoin('content.account', 'account')
        .where('account.userId = :userId', { userId })
        .getCount();

      const publishedContent = await this.contentRepository
        .createQueryBuilder('content')
        .leftJoin('content.account', 'account')
        .where('account.userId = :userId', { userId })
        .andWhere('content.status = :status', { status: 'published' })
        .getCount();

      const pendingContent = await this.contentRepository
        .createQueryBuilder('content')
        .leftJoin('content.account', 'account')
        .where('account.userId = :userId', { userId })
        .andWhere('content.status = :status', { status: 'pending' })
        .getCount();

      // Get schedule statistics
      const totalSchedules = await this.scheduleRepository
        .createQueryBuilder('schedule')
        .leftJoin('schedule.account', 'account')
        .where('account.userId = :userId', { userId })
        .getCount();

      const activeSchedules = await this.scheduleRepository
        .createQueryBuilder('schedule')
        .leftJoin('schedule.account', 'account')
        .where('account.userId = :userId', { userId })
        .andWhere('schedule.status = :status', { status: 'active' })
        .getCount();

      // Get scheduled content count
      const scheduledContent = await this.scheduleContentRepository
        .createQueryBuilder('scheduleContent')
        .leftJoin('scheduleContent.schedule', 'schedule')
        .leftJoin('schedule.account', 'account')
        .where('account.userId = :userId', { userId })
        .andWhere('scheduleContent.status = :status', { status: 'scheduled' })
        .getCount();

      // Get recent content (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentContent = await this.contentRepository
        .createQueryBuilder('content')
        .leftJoin('content.account', 'account')
        .where('account.userId = :userId', { userId })
        .andWhere('content.createdAt >= :date', { date: sevenDaysAgo })
        .getCount();

      return {
        accounts: {
          total: totalAccounts,
          connected: connectedAccounts,
          disconnected: totalAccounts - connectedAccounts,
        },
        content: {
          total: totalContent,
          published: publishedContent,
          pending: pendingContent,
          recent: recentContent,
        },
        schedules: {
          total: totalSchedules,
          active: activeSchedules,
          scheduledContent: scheduledContent,
        },
        summary: {
          totalAccounts,
          totalContent,
          totalSchedules,
          connectedAccounts,
          publishedContent,
          activeSchedules,
        }
      };
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      throw error;
    }
  }
}
