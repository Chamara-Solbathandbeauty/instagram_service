import { PartialType } from '@nestjs/mapped-types';
import { CreatePostingScheduleDto } from './create-posting-schedule.dto';

export class UpdatePostingScheduleDto extends PartialType(CreatePostingScheduleDto) {}
