import { Module } from '@nestjs/common';
import { InstagramService } from './instagram.service';
import { InstagramController } from './instagram.controller';
import { IgAccountsModule } from '../ig-accounts/ig-accounts.module';
import { ContentModule } from '../content/content.module';

@Module({
  imports: [IgAccountsModule, ContentModule],
  controllers: [InstagramController],
  providers: [InstagramService],
  exports: [InstagramService],
})
export class InstagramModule {}

