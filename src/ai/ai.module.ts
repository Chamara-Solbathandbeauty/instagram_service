import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleGeneratorService } from './schedule-generator.service';
import { ContentGeneratorService } from './content-generator.service';
import { AIController } from './ai.controller';
import { IgAccount } from '../ig-accounts/entities/ig-account.entity';
import { PostingSchedule } from '../schedules/posting-schedule.entity';
import { ScheduleContent } from '../schedules/schedule-content.entity';
import { Content } from '../content/entities/content.entity';
import { Media } from '../content/media.entity';
import { ScheduleTimeSlot } from '../schedules/schedule-time-slot.entity';
import { VideoSegment } from './entities/video-segment.entity';
import { ContentGenerationJob } from './entities/content-generation-job.entity';
import { ContentGenerationJobService } from './services/content-generation-job.service';
import { ContentGenerationWorkerService } from './services/content-generation-worker.service';
import { User } from '../users/entities/user.entity';

// Multi-Agent System
import { ImageGenerationAgent } from './agents/image-generation-agent';
import { ReelGenerationAgent } from './agents/reel-generation-agent';
import { MediaStorageService } from './services/media-storage.service';
import { VertexAIMediaService } from './services/vertex-ai-media.service';
import { LLMService } from './services/llm.service';
import { PromptBuilderService } from './services/prompt-builder.service';
import { AILoggerService } from './services/ai-logger.service';

// Extended Video Services
import { GcsStorageService } from './services/gcs-storage.service';
import { VideoScriptGenerationService } from './services/video-script-generation.service';
import { VideoConcatenationService } from './services/video-concatenation.service';
import { ExtendedVideoGenerationService } from './services/extended-video-generation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IgAccount,
      PostingSchedule,
      ScheduleContent,
      ScheduleTimeSlot,
      Content,
      Media,
      VideoSegment,
      ContentGenerationJob,
      User,
    ])
  ],
  providers: [
    LLMService,
    PromptBuilderService,
    AILoggerService,
    ScheduleGeneratorService, 
    ContentGeneratorService,
    ContentGenerationJobService,
    ContentGenerationWorkerService,
    ImageGenerationAgent,
    ReelGenerationAgent,
    MediaStorageService,
    VertexAIMediaService,
    // Extended Video Services
    GcsStorageService,
    VideoScriptGenerationService,
    VideoConcatenationService,
    ExtendedVideoGenerationService,
  ],
  controllers: [AIController],
  exports: [
    ScheduleGeneratorService, 
    ContentGeneratorService,
    MediaStorageService,
    ExtendedVideoGenerationService,
  ],
})
export class AIModule {}
