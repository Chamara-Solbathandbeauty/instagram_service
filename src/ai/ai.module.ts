import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { IgAccountsModule } from '../ig-accounts/ig-accounts.module';
import { SchedulesModule } from '../schedules/schedules.module';
import { ContentModule } from '../content/content.module';

@Module({
  imports: [IgAccountsModule, SchedulesModule, ContentModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}

