import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { Content } from './entities/content.entity';
import { ContentMedia } from './entities/content-media.entity';
import { IgAccountsModule } from '../ig-accounts/ig-accounts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Content, ContentMedia]),
    IgAccountsModule,
  ],
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}

