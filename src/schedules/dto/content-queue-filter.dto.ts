import { IsOptional, IsEnum, IsInt, Min, IsDateString } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { QueueStatus } from '../content-queue.entity';

export class ContentQueueFilterDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  scheduleId?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  timeSlotId?: number;

  @IsEnum(QueueStatus)
  @IsOptional()
  status?: QueueStatus;

  @IsDateString()
  @IsOptional()
  queueDate?: string;

  @IsDateString()
  @IsOptional()
  queueDateFrom?: string;

  @IsDateString()
  @IsOptional()
  queueDateTo?: string;

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
