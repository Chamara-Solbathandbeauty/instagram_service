import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { InstagramController } from './instagram.controller';
import { InstagramGraphService } from './instagram-graph.service';
import { InstagramPostingService } from './instagram-posting.service';
import { IgAccount } from '../ig-accounts/entities/ig-account.entity';
import { Media } from '../content/media.entity';
import { Content } from '../content/entities/content.entity';
import { PublishedMedia } from '../content/entities/published-media.entity';
import { PublishedMediaService } from '../content/published-media.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IgAccount, Media, Content, PublishedMedia]),
    ConfigModule,
  ],
  controllers: [InstagramController],
  providers: [InstagramGraphService, InstagramPostingService, PublishedMediaService],
  exports: [InstagramGraphService, InstagramPostingService, PublishedMediaService],
})
export class InstagramModule {}
