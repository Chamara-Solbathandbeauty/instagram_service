import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
  IsInt,
} from 'class-validator';
import { ScheduleContentStatus } from '../../schedules/schedule-content.entity';

export class CreateScheduleContentDto {
  @IsNumber()
  @IsNotEmpty()
  scheduleId: number;

  @IsNumber()
  @IsNotEmpty()
  contentId: number;

  @IsOptional()
  @IsNumber()
  timeSlotId?: number;

  @IsDateString()
  @IsNotEmpty()
  scheduledDate: string;

  @IsOptional()
  @IsString()
  scheduledTime?: string;

  @IsOptional()
  @IsEnum(ScheduleContentStatus)
  status?: ScheduleContentStatus;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

