import { IsOptional, IsEnum, IsInt, Min, IsDateString } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ScheduleContentStatus } from '../schedule-content.entity';

export class ScheduleContentFilterDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  scheduleId?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  contentId?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  timeSlotId?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  accountId?: number;

  @IsEnum(ScheduleContentStatus)
  @IsOptional()
  status?: ScheduleContentStatus;

  @IsDateString()
  @IsOptional()
  scheduledDate?: string;

  @IsDateString()
  @IsOptional()
  scheduledDateFrom?: string;

  @IsDateString()
  @IsOptional()
  scheduledDateTo?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;
}
