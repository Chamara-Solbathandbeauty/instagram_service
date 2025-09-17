import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  ParseIntPipe, 
  UseGuards,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../users/entities/user.entity';
import { ScheduleContentService } from './schedule-content.service';
import { CreateScheduleContentDto } from './dto/create-schedule-content.dto';
import { UpdateScheduleContentDto } from './dto/update-schedule-content.dto';
import { ScheduleContentFilterDto } from './dto/schedule-content-filter.dto';
import { ContentQueueFilterDto } from './dto/content-queue-filter.dto';

@Controller('schedule-content')
@UseGuards(JwtAuthGuard)
export class ScheduleContentController {
  constructor(private readonly scheduleContentService: ScheduleContentService) {}

  @Post()
  async createScheduleContent(
    @Body() createDto: CreateScheduleContentDto,
    @GetUser() user: User,
  ) {
    try {
      const scheduleContent = await this.scheduleContentService.createScheduleContent(createDto, user.id);
      return {
        message: 'Content scheduled successfully',
        data: scheduleContent,
      };
    } catch (error) {
      console.error('Error creating schedule content:', error);
      throw new HttpException(
        error.message || 'Failed to schedule content',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get()
  async getScheduleContentList(
    @Query() filters: ScheduleContentFilterDto,
    @GetUser() user: User,
  ) {
    try {
      const result = await this.scheduleContentService.getScheduleContentList(filters, user.id);
      return {
        message: 'Schedule content retrieved successfully',
        data: result,
      };
    } catch (error) {
      console.error('Error fetching schedule content:', error);
      throw new HttpException(
        error.message || 'Failed to fetch schedule content',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('queue')
  async getContentQueue(
    @Query() filters: ContentQueueFilterDto,
    @GetUser() user: User,
  ) {
    try {
      const result = await this.scheduleContentService.getContentQueue(filters, user.id);
      return {
        message: 'Content queue retrieved successfully',
        data: result,
      };
    } catch (error) {
      console.error('Error fetching content queue:', error);
      throw new HttpException(
        error.message || 'Failed to fetch content queue',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('schedule/:scheduleId')
  async getScheduleContentBySchedule(
    @Param('scheduleId', ParseIntPipe) scheduleId: number,
    @GetUser() user: User,
  ) {
    try {
      const scheduleContent = await this.scheduleContentService.getScheduleContentBySchedule(scheduleId, user.id);
      return {
        message: 'Schedule content retrieved successfully',
        data: scheduleContent,
      };
    } catch (error) {
      console.error('Error fetching schedule content:', error);
      throw new HttpException(
        error.message || 'Failed to fetch schedule content',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get(':id')
  async getScheduleContentById(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ) {
    try {
      const scheduleContent = await this.scheduleContentService.getScheduleContentById(id, user.id);
      return {
        message: 'Schedule content retrieved successfully',
        data: scheduleContent,
      };
    } catch (error) {
      console.error('Error fetching schedule content:', error);
      throw new HttpException(
        error.message || 'Failed to fetch schedule content',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Put(':id')
  async updateScheduleContent(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateScheduleContentDto,
    @GetUser() user: User,
  ) {
    try {
      const scheduleContent = await this.scheduleContentService.updateScheduleContent(id, updateDto, user.id);
      return {
        message: 'Schedule content updated successfully',
        data: scheduleContent,
      };
    } catch (error) {
      console.error('Error updating schedule content:', error);
      throw new HttpException(
        error.message || 'Failed to update schedule content',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete(':id')
  async deleteScheduleContent(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ) {
    try {
      await this.scheduleContentService.deleteScheduleContent(id, user.id);
      return {
        message: 'Schedule content deleted successfully',
      };
    } catch (error) {
      console.error('Error deleting schedule content:', error);
      throw new HttpException(
        error.message || 'Failed to delete schedule content',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }
}
