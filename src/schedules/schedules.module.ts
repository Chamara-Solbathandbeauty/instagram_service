import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchedulesService } from './schedules.service';
import { SchedulesController } from './schedules.controller';
import { Schedule } from './entities/schedule.entity';
import { TimeSlot } from './entities/time-slot.entity';
import { IgAccountsModule } from '../ig-accounts/ig-accounts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Schedule, TimeSlot]),
    IgAccountsModule,
  ],
  controllers: [SchedulesController],
  providers: [SchedulesService],
  exports: [SchedulesService],
})
export class SchedulesModule {}

