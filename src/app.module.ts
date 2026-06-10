import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { InputModule } from './input/input.module';
import { OutputModule } from './output/output.module';
import { AuthModule } from './auth/auth.module';
import { ConversationModule } from './conversation/conversation.module';
import { PersonaModule } from './persona/persona.module';
import { EpisodeModule } from './episode/episode.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    BullModule.registerQueue({ name: 'praise' }, { name: 'tts' }),
    AuthModule,
    InputModule,
    OutputModule,
    ConversationModule,
    PersonaModule,
    EpisodeModule,
  ],
})
export class AppModule {}
