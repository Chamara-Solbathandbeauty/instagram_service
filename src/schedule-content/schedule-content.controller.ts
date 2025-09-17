import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ScheduleContentService } from './schedule-content.service';
import { CreateScheduleContentDto } from './dto/create-schedule-content.dto';
import { UpdateScheduleContentDto } from './dto/update-schedule-content.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ScheduleContentStatus } from '../schedules/schedule-content.entity';

@Controller('schedule-content')
@UseGuards(JwtAuthGuard)
export class ScheduleContentController {
  constructor(private readonly scheduleContentService: ScheduleContentService) {}

  @Post()
  create(@GetUser() user: any, @Body() createScheduleContentDto: CreateScheduleContentDto) {
    return this.scheduleContentService.create(user.id, createScheduleContentDto);
  }

  @Get()
  findAll(
    @GetUser() user: any,
    @Query('scheduleId') scheduleId?: number,
    @Query('contentId') contentId?: number,
    @Query('timeSlotId') timeSlotId?: number,
    @Query('status') status?: ScheduleContentStatus,
    @Query('scheduledDate') scheduledDate?: string,
    @Query('scheduledDateFrom') scheduledDateFrom?: string,
    @Query('scheduledDateTo') scheduledDateTo?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.scheduleContentService.findAll(user.id, {
      scheduleId,
      contentId,
      timeSlotId,
      status,
      scheduledDate,
      scheduledDateFrom,
      scheduledDateTo,
      page,
      limit,
    });
  }

  @Get('queue')
  getQueue(
    @Query('scheduleId') scheduleId?: number,
    @Query('timeSlotId') timeSlotId?: number,
    @Query('status') status?: string,
    @Query('queueDate') queueDate?: string,
    @Query('queueDateFrom') queueDateFrom?: string,
    @Query('queueDateTo') queueDateTo?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.scheduleContentService.getQueue({
      scheduleId,
      timeSlotId,
      status,
      queueDate,
      queueDateFrom,
      queueDateTo,
      page,
      limit,
    });
  }

  @Get('schedule/:scheduleId')
  findBySchedule(@Param('scheduleId') scheduleId: string, @GetUser() user: any) {
    return this.scheduleContentService.findBySchedule(+scheduleId, user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @GetUser() user: any) {
    return this.scheduleContentService.findOne(+id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @GetUser() user: any,
    @Body() updateScheduleContentDto: UpdateScheduleContentDto,
  ) {
    return this.scheduleContentService.update(+id, user.id, updateScheduleContentDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @GetUser() user: any) {
    return this.scheduleContentService.remove(+id, user.id);
  }
}

