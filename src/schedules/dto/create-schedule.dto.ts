import { 
  IsNotEmpty, 
  IsNumber, 
  IsOptional, 
  IsString, 
  IsEnum, 
  IsBoolean, 
  IsDateString,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  Max,
  ValidateIf
} from 'class-validator';
import { Type } from 'class-transformer';
import { ScheduleFrequency, ScheduleStatus } from '../posting-schedule.entity';
import { PostType } from '../schedule-time-slot.entity';

export class CreateTimeSlotDto {
  @IsString()
  @IsNotEmpty()
  startTime: string;

  @IsString()
  @IsNotEmpty()
  endTime: string;

  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsEnum(PostType)
  postType: PostType;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  tone?: string;

  @IsOptional()
  @IsString()
  dimensions?: string;

  @IsOptional()
  @IsString()
  preferredVoiceAccent?: string;

  @IsOptional()
  @IsString()
  storyType?: string;

  @ValidateIf((o) => o.postType === PostType.REEL || (o.postType === PostType.STORY && o.storyType === 'video'))
  @IsNotEmpty({ message: 'Duration is required for reels and video stories' })
  @IsNumber()
  @IsInt()
  reelDuration?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  imageCount?: number; // Number of images to generate (1-5), only for post_with_image type
}

export class CreateScheduleDto {
  @IsNumber()
  @IsNotEmpty()
  accountId: number;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ScheduleFrequency)
  frequency?: ScheduleFrequency;

  @IsOptional()
  @IsEnum(ScheduleStatus)
  status?: ScheduleStatus;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  customDays?: number[];

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTimeSlotDto)
  timeSlots?: CreateTimeSlotDto[];
}

