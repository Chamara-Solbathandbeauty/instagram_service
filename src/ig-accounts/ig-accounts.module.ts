import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IgAccountsService } from './ig-accounts.service';
import { IgAccountsController } from './ig-accounts.controller';
import { IgAccount } from './entities/ig-account.entity';
import { AccountImage } from './entities/account-image.entity';

@Module({
  imports: [TypeOrmModule.forFeature([IgAccount, AccountImage])],
  controllers: [IgAccountsController],
  providers: [IgAccountsService],
  exports: [IgAccountsService],
})
export class IgAccountsModule {}

