import { IsString, IsOptional, IsNotEmpty, IsEnum, IsBoolean, IsDateString, IsArray, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { ScheduleFrequency, ScheduleStatus } from '../posting-schedule.entity';
import { PostType } from '../schedule-time-slot.entity';

export class CreateTimeSlotDto {
  @IsString()
  startTime: string; // Format: "09:00" or "09:00:00"

  @IsString()
  endTime: string; // Format: "17:00" or "17:00:00"

  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  @IsEnum(PostType)
  @IsOptional()
  postType?: PostType;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @IsString()
  @IsOptional()
  label?: string;
}

export class CreatePostingScheduleDto {
  @IsInt()
  @IsNotEmpty()
  accountId: number;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ScheduleFrequency)
  @IsOptional()
  frequency?: ScheduleFrequency;

  @IsEnum(ScheduleStatus)
  @IsOptional()
  status?: ScheduleStatus;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @Transform(({ value }) => value === '' ? undefined : value)
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @Transform(({ value }) => value === '' ? undefined : value)
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @Transform(({ value, obj }) => {
    if (obj.frequency !== 'custom') {
      return undefined;
    }
    return value;
  })
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @IsOptional()
  customDays?: number[];

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsArray()
  @IsOptional()
  timeSlots?: CreateTimeSlotDto[];
}
