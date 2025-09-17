import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { IgAccount } from '../ig-accounts/entities/ig-account.entity';
import { PostingSchedule } from '../schedules/posting-schedule.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { IgAccountsModule } from '../ig-accounts/ig-accounts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, IgAccount, PostingSchedule]),
    IgAccountsModule
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [TypeOrmModule, UsersService],
})
export class UsersModule {}
