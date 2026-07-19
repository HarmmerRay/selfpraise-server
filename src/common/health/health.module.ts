import { Global, Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { HealthController } from './health.controller';
import { ShutdownService } from './shutdown.service';

@Global()
@Module({
  imports: [RedisModule, PrismaModule],
  controllers: [HealthController],
  providers: [ShutdownService],
  exports: [ShutdownService],
})
export class HealthModule {}
