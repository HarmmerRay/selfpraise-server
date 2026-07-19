import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { HealthModule } from './common/health/health.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { AuthModule } from './auth/auth.module';
import { ConversationModule } from './conversation/conversation.module';
import { PersonaModule } from './persona/persona.module';
import { MemoryModule } from './memory/memory.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    HealthModule,
    MetricsModule,
    AuthModule,
    ConversationModule,
    PersonaModule,
    MemoryModule,
    AdminModule,
  ],
})
export class AppModule {}
