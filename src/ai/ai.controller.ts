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
import { ScheduleGeneratorService } from './schedule-generator.service';
import { ContentGeneratorService } from './content-generator.service';
import { ContentGenerationJobService } from './services/content-generation-job.service';
import { IgAccount } from '../ig-accounts/entities/ig-account.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';


@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AIController {
  constructor(
    private readonly scheduleGeneratorService: ScheduleGeneratorService,
    private readonly contentGeneratorService: ContentGeneratorService,
    private readonly contentGenerationJobService: ContentGenerationJobService,
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
      const aiSchedule = await this.scheduleGeneratorService.generateSchedule(account, body.userInstructions);

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
      const aiSchedule = await this.scheduleGeneratorService.generateSchedule(account);

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
      const generationWeek = body.generationWeek || await this.contentGeneratorService.getNextGeneratableWeek(body.scheduleId, user.id.toString());
      
      if (!generationWeek) {
        throw new HttpException('No week available for content generation', HttpStatus.BAD_REQUEST);
      }

      // Create job instead of processing synchronously
      const job = await this.contentGenerationJobService.createJob(
        body.scheduleId,
        user.id.toString(),
        generationWeek,
        body.userInstructions,
      );

      return {
        success: true,
        data: {
          jobId: job.id,
          status: job.status,
          message: 'Content generation job created. Processing will start shortly.',
        },
        message: 'Content generation job created successfully',
      };
    } catch (error) {
      console.error('Error in generateContent:', error);
      throw new HttpException(
        error.message || 'Failed to create content generation job',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('generation-job/active')
  async getActiveJob(@GetUser() user: User) {
    try {
      const activeJob = await this.contentGenerationJobService.getAnyActiveJob();

      if (!activeJob) {
        return {
          success: true,
          data: null,
          message: 'No active generation job found',
        };
      }

      return {
        success: true,
        data: activeJob,
        message: 'Active generation job found',
      };
    } catch (error) {
      console.error('Error in getActiveJob:', error);
      throw new HttpException(
        error.message || 'Failed to get active generation job',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('generation-job/:jobId')
  async getGenerationJob(
    @GetUser() user: User,
    @Param('jobId', ParseIntPipe) jobId: number,
  ) {
    try {
      const job = await this.contentGenerationJobService.getJobById(jobId);

      if (!job) {
        throw new HttpException('Generation job not found', HttpStatus.NOT_FOUND);
      }

      // Verify job belongs to user
      if (job.userId !== user.id.toString()) {
        throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
      }

      return {
        success: true,
        data: job,
        message: 'Generation job retrieved successfully',
      };
    } catch (error) {
      console.error('Error in getGenerationJob:', error);
      throw new HttpException(
        error.message || 'Failed to get generation job',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('generation-job/schedule/:scheduleId')
  async getScheduleActiveJob(
    @GetUser() user: User,
    @Param('scheduleId', ParseIntPipe) scheduleId: number,
  ) {
    try {
      // Check for any active job (global lock)
      const activeJob = await this.contentGenerationJobService.getAnyActiveJob();

      if (!activeJob) {
        return {
          success: true,
          data: null,
          message: 'No active generation job found',
        };
      }

      // Verify job belongs to user (optional check - can show any user's job status)
      // For now, we'll return it if it exists to inform user of global lock
      return {
        success: true,
        data: activeJob,
        message: 'Active generation job found',
      };
    } catch (error) {
      console.error('Error in getScheduleActiveJob:', error);
      throw new HttpException(
        error.message || 'Failed to get active generation job',
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
      const nextWeek = await this.contentGeneratorService.getNextGeneratableWeek(scheduleId, user.id);
      
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
      // Use ContentGeneratorService for both single time slot and full schedule generation
      const result = await this.contentGeneratorService.generateContentForSchedule(
        body.scheduleId,
        user.id,
        body.generationDate
      );

      return {
        success: true,
        data: result,
        message: result.message,
      };
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
