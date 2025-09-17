import { IsOptional, IsEnum, IsInt, Min, IsBoolean } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ScheduleStatus } from '../posting-schedule.entity';

export class ScheduleFilterDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  accountId?: number;

  @IsEnum(ScheduleStatus)
  @IsOptional()
  status?: ScheduleStatus;

  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

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
