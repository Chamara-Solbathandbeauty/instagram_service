import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  ParseIntPipe, 
  UseGuards, 
  Query,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../users/entities/user.entity';
import { SchedulesService } from './schedules.service';
import { CreatePostingScheduleDto } from './dto/create-posting-schedule.dto';
import { UpdatePostingScheduleDto } from './dto/update-posting-schedule.dto';
import { ScheduleFilterDto } from './dto/schedule-filter.dto';

@Controller('schedules')
@UseGuards(JwtAuthGuard)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Post()
  async createSchedule(
    @GetUser() user: User,
    @Body() createScheduleDto: CreatePostingScheduleDto,
  ) {
    try {
      console.log('Creating schedule with data:', JSON.stringify(createScheduleDto, null, 2));
      return this.schedulesService.createSchedule(user.id, createScheduleDto);
    } catch (error) {
      console.error('Error creating schedule:', error);
      throw new HttpException(
        error.message || 'Failed to create schedule', 
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get()
  async getSchedules(
    @GetUser() user: User,
    @Query() filters: ScheduleFilterDto,
  ) {
    return this.schedulesService.getSchedules(user.id, filters);
  }

  @Get(':id')
  async getScheduleById(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ) {
    const schedule = await this.schedulesService.getScheduleById(id);
    
    // Verify ownership
    if (schedule.account.userId !== user.id) {
      throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
    }
    
    return schedule;
  }

  @Put(':id')
  async updateSchedule(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @Body() updateScheduleDto: UpdatePostingScheduleDto,
  ) {
    try {
      return this.schedulesService.updateSchedule(id, user.id, updateScheduleDto);
    } catch (error) {
      throw new HttpException(error.message || 'Failed to update schedule', HttpStatus.BAD_REQUEST);
    }
  }

  @Delete(':id')
  async deleteSchedule(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ) {
    try {
      await this.schedulesService.deleteSchedule(id, user.id);
      return { message: 'Schedule deleted successfully' };
    } catch (error) {
      throw new HttpException(error.message || 'Failed to delete schedule', HttpStatus.BAD_REQUEST);
    }
  }

  @Put(':id/toggle')
  async toggleScheduleStatus(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ) {
    try {
      return this.schedulesService.toggleScheduleStatus(id, user.id);
    } catch (error) {
      throw new HttpException(error.message || 'Failed to toggle schedule status', HttpStatus.BAD_REQUEST);
    }
  }

  @Get('account/:accountId')
  async getSchedulesByAccount(
    @Param('accountId', ParseIntPipe) accountId: number,
    @GetUser() user: User,
  ) {
    try {
      return this.schedulesService.getSchedulesByAccount(accountId, user.id);
    } catch (error) {
      throw new HttpException(error.message || 'Failed to get schedules', HttpStatus.BAD_REQUEST);
    }
  }
}
