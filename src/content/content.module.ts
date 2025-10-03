import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { Content } from './entities/content.entity';
import { Media } from './media.entity';
import { VideoSegment } from '../ai/entities/video-segment.entity';
import { PublishedMedia } from './entities/published-media.entity';
import { PublishedMediaService } from './published-media.service';
import { IgAccountsModule } from '../ig-accounts/ig-accounts.module';
import { AIModule } from '../ai/ai.module';
import { VertexAIMediaService } from '../ai/services/vertex-ai-media.service';
import { MediaStorageService } from '../ai/services/media-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Content, Media, VideoSegment, PublishedMedia]),
    IgAccountsModule,
    AIModule,
  ],
  controllers: [ContentController],
  providers: [ContentService, PublishedMediaService, VertexAIMediaService, MediaStorageService],
  exports: [ContentService, PublishedMediaService],
})
export class ContentModule {}

