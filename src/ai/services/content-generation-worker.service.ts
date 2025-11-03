import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ContentGenerationJob, ContentGenerationStatus } from '../entities/content-generation-job.entity';
import { ContentGenerationJobService } from './content-generation-job.service';
import { ContentGeneratorService } from '../content-generator.service';

@Injectable()
export class ContentGenerationWorkerService implements OnModuleInit {
  private readonly logger = new Logger(ContentGenerationWorkerService.name);
  private isProcessing = false;

  constructor(
    private jobService: ContentGenerationJobService,
    private contentGeneratorService: ContentGeneratorService,
  ) {}

  onModuleInit() {
    // Start worker interval when module initializes
    this.logger.log('Content generation worker started');
    this.startWorker();
  }

  private startWorker() {
    // Process jobs every 10 seconds
    setInterval(async () => {
      if (!this.isProcessing) {
        await this.processNextJob();
      }
    }, 10000); // 10 seconds
  }

  private async processNextJob(): Promise<void> {
    try {
      const pendingJobs = await this.jobService.getPendingJobs();

      if (pendingJobs.length === 0) {
        return; // No jobs to process
      }

      // Process first pending job only (one at a time)
      if (pendingJobs.length > 0 && !this.isProcessing) {
        this.isProcessing = true;
        await this.processJob(pendingJobs[0]);
        // isProcessing will be reset in processJob's finally block
      }
    } catch (error) {
      this.logger.error('Error in worker processNextJob:', error);
      this.isProcessing = false;
    }
  }

  private async processJob(job: ContentGenerationJob): Promise<void> {
    this.logger.log(`Processing content generation job ${job.id} for schedule ${job.scheduleId}`);

    try {
      // Update status to processing
      await this.jobService.updateJobStatus(
        job.id,
        ContentGenerationStatus.PROCESSING,
        5, // 5% - Started
      );

      // Create progress callback
      const progressCallback = async (progress: number, message?: string) => {
        await this.jobService.updateJobProgress(job.id, progress);
        if (message) {
          this.logger.log(`Job ${job.id} progress: ${progress}% - ${message}`);
        }
      };

      // Generate content with progress tracking
      await progressCallback(10, 'Fetching schedule and account details');
      const result = await this.contentGeneratorService.generateContentForScheduleWithProgress(
        job.scheduleId,
        job.userId,
        job.generationWeek,
        job.userInstructions,
        progressCallback,
      );

      // Complete the job
      await this.jobService.completeJob(job.id, result.generatedContent.length);
      this.logger.log(`Job ${job.id} completed successfully. Generated ${result.generatedContent.length} content pieces.`);
    } catch (error) {
      this.logger.error(`Job ${job.id} failed:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred during content generation';
      await this.jobService.failJob(job.id, errorMessage);
    } finally {
      // Always reset processing flag
      this.isProcessing = false;
    }
  }
}

