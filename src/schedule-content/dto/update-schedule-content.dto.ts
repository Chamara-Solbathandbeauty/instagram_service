import { PartialType } from '@nestjs/mapped-types';
import { CreateScheduleContentDto } from './create-schedule-content.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateScheduleContentDto extends PartialType(CreateScheduleContentDto) {
  @IsOptional()
  @IsString()
  failureReason?: string;
}

