import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { IgAccountsModule } from './ig-accounts/ig-accounts.module';
import { ContentModule } from './content/content.module';
import { SchedulesModule } from './schedules/schedules.module';
import { ScheduleContentModule } from './schedule-content/schedule-content.module';
import { AiModule } from './ai/ai.module';
import { InstagramModule } from './instagram/instagram.module';
import { User } from './users/entities/user.entity';
import { IgAccount } from './ig-accounts/entities/ig-account.entity';
import { Content } from './content/entities/content.entity';
import { ContentMedia } from './content/entities/content-media.entity';
import { Schedule } from './schedules/entities/schedule.entity';
import { TimeSlot } from './schedules/entities/time-slot.entity';
import { ScheduleContent } from './schedule-content/entities/schedule-content.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [
          User,
          IgAccount,
          Content,
          ContentMedia,
          Schedule,
          TimeSlot,
          ScheduleContent,
        ],
        synchronize: false, // Disabled - using manual schema
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    IgAccountsModule,
    ContentModule,
    SchedulesModule,
    ScheduleContentModule,
    AiModule,
    InstagramModule,
  ],
})
export class AppModule {}

