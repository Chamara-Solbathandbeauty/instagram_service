import { IsInt, IsOptional, IsEnum, IsDateString, IsString, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ScheduleContentStatus } from '../schedule-content.entity';

export class CreateScheduleContentDto {
  @IsInt()
  @Min(1)
  scheduleId: number;

  @IsInt()
  @Min(1)
  contentId: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  timeSlotId?: number;

  @IsDateString()
  scheduledDate: string; // YYYY-MM-DD format

  @IsString()
  @IsOptional()
  scheduledTime?: string; // HH:MM:SS format

  @IsEnum(ScheduleContentStatus)
  @IsOptional()
  status?: ScheduleContentStatus;

  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  notes?: string;
}
