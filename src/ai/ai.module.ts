import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AIAgentService } from './ai-agent.service';
import { ContentAgentService } from './content-agent.service';
import { AIController } from './ai.controller';
import { IgAccount } from '../ig-accounts/entities/ig-account.entity';
import { PostingSchedule } from '../schedules/posting-schedule.entity';
import { ScheduleContent } from '../schedules/schedule-content.entity';
import { Content } from '../content/entities/content.entity';
import { Media } from '../content/media.entity';
import { ScheduleTimeSlot } from '../schedules/schedule-time-slot.entity';

// Multi-Agent System
import { ImageGenerationAgent } from './agents/image-generation-agent';
import { ReelGenerationAgent } from './agents/reel-generation-agent';
import { VideoGenerationAgent } from './agents/video-generation-agent';
import { MediaStorageService } from './services/media-storage.service';
import { VertexAIMediaService } from './services/vertex-ai-media.service';
import { MultiAgentContentService } from './services/multi-agent-content.service';
import { LLMService } from './services/llm.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IgAccount,
      PostingSchedule,
      ScheduleContent,
      ScheduleTimeSlot,
      Content,
      Media
    ])
  ],
  providers: [
    LLMService,
    AIAgentService, 
    ContentAgentService,
    ImageGenerationAgent,
    ReelGenerationAgent,
    VideoGenerationAgent,
    MediaStorageService,
    VertexAIMediaService,
    MultiAgentContentService,
  ],
  controllers: [AIController],
  exports: [
    AIAgentService, 
    ContentAgentService,
    MultiAgentContentService,
    MediaStorageService,
  ],
})
export class AIModule {}
