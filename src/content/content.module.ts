import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { Content } from './entities/content.entity';
import { Media } from './media.entity';
import { VideoSegment } from '../ai/entities/video-segment.entity';
import { IgAccountsModule } from '../ig-accounts/ig-accounts.module';
import { AIModule } from '../ai/ai.module';
import { VertexAIMediaService } from '../ai/services/vertex-ai-media.service';
import { MediaStorageService } from '../ai/services/media-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Content, Media, VideoSegment]),
    IgAccountsModule,
    AIModule,
  ],
  controllers: [ContentController],
  providers: [ContentService, VertexAIMediaService, MediaStorageService],
  exports: [ContentService],
})
export class ContentModule {}

