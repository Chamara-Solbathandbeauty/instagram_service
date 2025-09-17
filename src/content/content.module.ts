import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { Content } from './entities/content.entity';
import { Media } from './media.entity';
import { IgAccountsModule } from '../ig-accounts/ig-accounts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Content, Media]),
    IgAccountsModule,
  ],
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}

