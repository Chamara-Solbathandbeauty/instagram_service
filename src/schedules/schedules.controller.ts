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
  Put,
} from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ScheduleStatus } from './entities/schedule.entity';

@Controller('schedules')
@UseGuards(JwtAuthGuard)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Post()
  create(@GetUser() user: any, @Body() createScheduleDto: CreateScheduleDto) {
    return this.schedulesService.create(user.id, createScheduleDto);
  }

  @Get()
  findAll(
    @GetUser() user: any,
    @Query('accountId') accountId?: number,
    @Query('status') status?: ScheduleStatus,
    @Query('isEnabled') isEnabled?: boolean,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.schedulesService.findAll(user.id, {
      accountId,
      status,
      isEnabled,
      page,
      limit,
    });
  }

  @Get('account/:accountId')
  findByAccount(@Param('accountId') accountId: string, @GetUser() user: any) {
    return this.schedulesService.findByAccount(+accountId, user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @GetUser() user: any) {
    return this.schedulesService.findOne(+id, user.id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @GetUser() user: any,
    @Body() updateScheduleDto: UpdateScheduleDto,
  ) {
    return this.schedulesService.update(+id, user.id, updateScheduleDto);
  }

  @Put(':id/toggle')
  toggleStatus(@Param('id') id: string, @GetUser() user: any) {
    return this.schedulesService.toggleStatus(+id, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @GetUser() user: any) {
    return this.schedulesService.remove(+id, user.id);
  }
}

