import { PartialType } from '@nestjs/mapped-types';
import { CreateScheduleContentDto } from './create-schedule-content.dto';
import { IsOptional, IsDateString, IsString, IsEnum } from 'class-validator';
import { ScheduleContentStatus } from '../schedule-content.entity';

export class UpdateScheduleContentDto extends PartialType(CreateScheduleContentDto) {
  @IsDateString()
  @IsOptional()
  scheduledDate?: string;

  @IsString()
  @IsOptional()
  scheduledTime?: string;

  @IsEnum(ScheduleContentStatus)
  @IsOptional()
  status?: ScheduleContentStatus;

  @IsString()
  @IsOptional()
  failureReason?: string;
}
