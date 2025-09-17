import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { InstagramController } from './instagram.controller';
import { InstagramGraphService } from './instagram-graph.service';
import { InstagramPostingService } from './instagram-posting.service';
import { IgAccount } from '../users/ig-account.entity';
import { Media } from '../content/media.entity';
import { Content } from '../content/content.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([IgAccount, Media, Content]),
    ConfigModule,
  ],
  controllers: [InstagramController],
  providers: [InstagramGraphService, InstagramPostingService],
  exports: [InstagramGraphService, InstagramPostingService],
})
export class InstagramModule {}
