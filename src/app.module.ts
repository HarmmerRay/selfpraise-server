import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { ConversationModule } from './conversation/conversation.module';
import { PersonaModule } from './persona/persona.module';
import { EpisodeModule } from './episode/episode.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    AuthModule,
    ConversationModule,
    PersonaModule,
    EpisodeModule,
  ],
})
export class AppModule {}
