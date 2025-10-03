import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  HttpException, 
  HttpStatus,
  Get,
  Param,
  ParseIntPipe
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../users/entities/user.entity';
import { AIAgentService } from './ai-agent.service';
import { ContentAgentService } from './content-agent.service';
import { MultiAgentContentService } from './services/multi-agent-content.service';
import { IgAccount } from '../ig-accounts/entities/ig-account.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';


@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AIController {
  constructor(
    private readonly aiAgentService: AIAgentService,
    private readonly contentAgentService: ContentAgentService,
    private readonly multiAgentContentService: MultiAgentContentService,
    @InjectRepository(IgAccount)
    private igAccountRepository: Repository<IgAccount>,
  ) {}

  @Post('generate-schedule')
  async generateSchedule(
    @GetUser() user: User,
    @Body() body: { accountId: number; userInstructions?: string },
  ) {
    try {
      // Verify account ownership
      const account = await this.igAccountRepository.findOne({
        where: { 
          id: body.accountId,
          userId: user.id 
        },
      });

      if (!account) {
        throw new HttpException('Account not found or access denied', HttpStatus.NOT_FOUND);
      }

      // Generate AI schedule
      const aiSchedule = await this.aiAgentService.generateSchedule(account, body.userInstructions);

      return {
        success: true,
        data: aiSchedule,
        message: 'AI schedule generated successfully',
      };
    } catch (error) {
      console.error('Error in generateSchedule:', error);
      throw new HttpException(
        error.message || 'Failed to generate AI schedule',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('generate-schedule/:accountId')
  async generateScheduleByAccountId(
    @GetUser() user: User,
    @Param('accountId', ParseIntPipe) accountId: number,
  ) {
    try {
      // Verify account ownership
      const account = await this.igAccountRepository.findOne({
        where: { 
          id: accountId,
          userId: user.id 
        },
      });

      if (!account) {
        throw new HttpException('Account not found or access denied', HttpStatus.NOT_FOUND);
      }

      // Generate AI schedule
      const aiSchedule = await this.aiAgentService.generateSchedule(account);

      return {
        success: true,
        data: aiSchedule,
        message: 'AI schedule generated successfully',
      };
    } catch (error) {
      console.error('Error in generateScheduleByAccountId:', error);
      throw new HttpException(
        error.message || 'Failed to generate AI schedule',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('generate-content')
  async generateContent(
    @GetUser() user: User,
    @Body() body: { scheduleId: number; generationWeek?: string; userInstructions?: string },
  ) {
    try {
      const generationWeek = body.generationWeek || await this.contentAgentService.getNextGeneratableWeek(body.scheduleId, user.id);
      
      if (!generationWeek) {
        throw new HttpException('No week available for content generation', HttpStatus.BAD_REQUEST);
      }

      const result = await this.contentAgentService.generateContentForSchedule(
        body.scheduleId,
        user.id,
        generationWeek,
        body.userInstructions
      );

      return {
        success: true,
        data: result,
        message: result.message,
      };
    } catch (error) {
      console.error('Error in generateContent:', error);
      throw new HttpException(
        error.message || 'Failed to generate content',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('next-generatable-week/:scheduleId')
  async getNextGeneratableWeek(
    @GetUser() user: User,
    @Param('scheduleId', ParseIntPipe) scheduleId: number,
  ) {
    try {
      const nextWeek = await this.contentAgentService.getNextGeneratableWeek(scheduleId, user.id);
      
      return {
        success: true,
        data: { nextWeek },
        message: nextWeek ? 'Next generatable week found' : 'No week available for content generation',
      };
    } catch (error) {
      console.error('Error in getNextGeneratableWeek:', error);
      throw new HttpException(
        error.message || 'Failed to get next generatable week',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Multi-Agent Content Generation Endpoints
  @Post('generate-content-multi-agent')
  async generateContentMultiAgent(
    @GetUser() user: User,
    @Body() body: { 
      scheduleId: number; 
      timeSlotId?: number; 
      generationDate: string; 
    },
  ) {
    try {
      if (body.timeSlotId) {
        // Generate content for specific time slot
        const result = await this.multiAgentContentService.generateContentForTimeSlot(
          body.scheduleId,
          body.timeSlotId,
          body.generationDate,
          user.id
        );

        return {
          success: result.success,
          data: result,
          message: result.success ? 'Content generated successfully' : 'Failed to generate content',
        };
      } else {
        // Generate content for entire schedule
        const results = await this.multiAgentContentService.generateContentForSchedule(
          body.scheduleId,
          body.generationDate,
          user.id
        );

        return {
          success: results.some(r => r.success),
          data: results,
          message: `Generated content for ${results.filter(r => r.success).length} time slots`,
        };
      }
    } catch (error) {
      console.error('Error in generateContentMultiAgent:', error);
      throw new HttpException(
        error.message || 'Failed to generate content with multi-agent system',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('agents/status')
  async getAgentsStatus(@GetUser() user: User) {
    try {
      const projectIdConfigured = !!process.env.GOOGLE_CLOUD_PROJECT;
      const adcConfigured = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
      
      return {
        success: true,
        data: {
          agents: {
            contentIdea: {
              available: true,
              configured: true, // Always available as it uses Google Gemini
              mockMode: false,
            },
            imageGeneration: {
              available: true,
              configured: projectIdConfigured && adcConfigured,
            },
            reelGeneration: {
              available: true,
              configured: projectIdConfigured && adcConfigured,
            },
            videoGeneration: {
              available: true,
              configured: projectIdConfigured && adcConfigured,
            },
          },
          vertexAiIntegration: {
            projectId: process.env.GOOGLE_CLOUD_PROJECT || 'Not configured',
            location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
            adcCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'Configured' : 'Not configured',
            authenticationMethod: 'Application Default Credentials (ADC)',
          },
        },
        message: 'Multi-agent system status retrieved successfully',
      };
    } catch (error) {
      console.error('Error in getAgentsStatus:', error);
      throw new HttpException(
        error.message || 'Failed to get agents status',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

}
