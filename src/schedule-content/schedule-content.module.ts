import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleContentService } from './schedule-content.service';
import { ScheduleContentController } from './schedule-content.controller';
import { ScheduleContent } from '../schedules/schedule-content.entity';
import { SchedulesModule } from '../schedules/schedules.module';
import { ContentModule } from '../content/content.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScheduleContent]),
    SchedulesModule,
    ContentModule,
  ],
  controllers: [ScheduleContentController],
  providers: [ScheduleContentService],
  exports: [ScheduleContentService],
})
export class ScheduleContentModule {}

