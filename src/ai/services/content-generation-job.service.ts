import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ContentGenerationJob, ContentGenerationStatus } from '../entities/content-generation-job.entity';

@Injectable()
export class ContentGenerationJobService {
  constructor(
    @InjectRepository(ContentGenerationJob)
    private jobRepository: Repository<ContentGenerationJob>,
  ) {}

  async createJob(
    scheduleId: number,
    userId: string,
    generationWeek: string,
    userInstructions?: string,
  ): Promise<ContentGenerationJob> {
    // Check if there's already an active job (ANY schedule - global lock)
    const activeJob = await this.getAnyActiveJob();
    if (activeJob) {
      throw new HttpException(
        `Content generation is already in progress. Please wait for the current job (ID: ${activeJob.id}) to complete before starting a new one.`,
        HttpStatus.CONFLICT,
      );
    }

    const job = this.jobRepository.create({
      scheduleId,
      userId,
      generationWeek,
      status: ContentGenerationStatus.PENDING,
      progress: 0,
      userInstructions: userInstructions || null,
    });

    return await this.jobRepository.save(job);
  }

  async getAnyActiveJob(): Promise<ContentGenerationJob | null> {
    return await this.jobRepository.findOne({
      where: {
        status: In([ContentGenerationStatus.PENDING, ContentGenerationStatus.PROCESSING]),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async getActiveJobForSchedule(scheduleId: number): Promise<ContentGenerationJob | null> {
    return await this.jobRepository.findOne({
      where: {
        scheduleId,
        status: In([ContentGenerationStatus.PENDING, ContentGenerationStatus.PROCESSING]),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async getJobById(jobId: number): Promise<ContentGenerationJob | null> {
    return await this.jobRepository.findOne({
      where: { id: jobId },
      relations: ['schedule', 'user'],
    });
  }

  async getPendingJobs(): Promise<ContentGenerationJob[]> {
    return await this.jobRepository.find({
      where: {
        status: ContentGenerationStatus.PENDING,
      },
      order: { createdAt: 'ASC' },
      take: 10, // Process max 10 jobs at a time
    });
  }

  async updateJobStatus(
    jobId: number,
    status: ContentGenerationStatus,
    progress?: number,
    errorMessage?: string,
  ): Promise<void> {
    const updateData: any = { status };
    
    if (progress !== undefined) {
      updateData.progress = progress;
    }
    
    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    if (status === ContentGenerationStatus.PROCESSING && !updateData.startedAt) {
      updateData.startedAt = new Date();
    }

    if (status === ContentGenerationStatus.COMPLETED || status === ContentGenerationStatus.FAILED) {
      updateData.completedAt = new Date();
    }

    await this.jobRepository.update(jobId, updateData);
  }

  async updateJobProgress(jobId: number, progress: number): Promise<void> {
    await this.jobRepository.update(jobId, { progress });
  }

  async completeJob(jobId: number, generatedContentCount: number): Promise<void> {
    await this.jobRepository.update(jobId, {
      status: ContentGenerationStatus.COMPLETED,
      progress: 100,
      generatedContentCount,
      completedAt: new Date(),
    });
  }

  async failJob(jobId: number, errorMessage: string): Promise<void> {
    await this.jobRepository.update(jobId, {
      status: ContentGenerationStatus.FAILED,
      errorMessage,
      completedAt: new Date(),
    });
  }
}

