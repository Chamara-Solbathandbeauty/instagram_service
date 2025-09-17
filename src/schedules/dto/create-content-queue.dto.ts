import { IsInt, IsOptional, IsEnum, IsDateString, IsString, MaxLength, Min } from 'class-validator';
import { QueueStatus } from '../content-queue.entity';

export class CreateContentQueueDto {
  @IsInt()
  @Min(1)
  scheduleId: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  timeSlotId?: number;

  @IsDateString()
  queueDate: string; // YYYY-MM-DD format

  @IsString()
  @IsOptional()
  queueTime?: string; // HH:MM:SS format

  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;

  @IsEnum(QueueStatus)
  @IsOptional()
  status?: QueueStatus;

  @IsInt()
  @Min(0)
  @IsOptional()
  position?: number;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  notes?: string;
}
