import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('generate-schedule/:accountId')
  generateSchedule(@Param('accountId') accountId: string, @GetUser() user: any) {
    return this.aiService.generateSchedule(+accountId, user.id);
  }

  @Post('generate-schedule')
  generateSchedulePost(@Body() data: { accountId: number }, @GetUser() user: any) {
    return this.aiService.generateSchedulePost(data, user.id);
  }

  @Post('generate-content')
  generateContent(
    @Body() data: { scheduleId: number; generationWeek?: string },
    @GetUser() user: any,
  ) {
    return this.aiService.generateContent(data, user.id);
  }

  @Get('next-generatable-week/:scheduleId')
  getNextGeneratableWeek(@Param('scheduleId') scheduleId: string, @GetUser() user: any) {
    return this.aiService.getNextGeneratableWeek(+scheduleId, user.id);
  }
}

