import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';
import { ScheduleContentController } from './schedule-content.controller';
import { ScheduleContentService } from './schedule-content.service';
import { PostingSchedule } from './posting-schedule.entity';
import { ScheduleTimeSlot } from './schedule-time-slot.entity';
import { ScheduleContent } from './schedule-content.entity';
import { ContentQueue } from './content-queue.entity';
import { Content } from '../content/entities/content.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PostingSchedule, 
      ScheduleTimeSlot, 
      ScheduleContent, 
      ContentQueue, 
      Content
    ]),
  ],
  controllers: [SchedulesController, ScheduleContentController],
  providers: [SchedulesService, ScheduleContentService],
  exports: [SchedulesService, ScheduleContentService],
})
export class SchedulesModule {}
