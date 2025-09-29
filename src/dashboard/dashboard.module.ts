import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { IgAccount } from '../ig-accounts/entities/ig-account.entity';
import { Content } from '../content/entities/content.entity';
import { PostingSchedule } from '../schedules/posting-schedule.entity';
import { ScheduleContent } from '../schedules/schedule-content.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IgAccount,
      Content,
      PostingSchedule,
      ScheduleContent,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
