import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { MemoryController } from './memory.controller';
import {
  LtmCacheService,
  ShortTermMemoryService,
} from './short-term-memory.service';
import { LongTermMemoryService } from './long-term-memory.service';
import { MemoryOrchestratorService } from './memory-orchestrator.service';
import { EmbeddingService } from './embedding.service';
import { LlmUsageService } from './llm-usage.service';
import { MemoryQueueService } from './memory-queue.service';
import { MemoryWorkerService } from './memory-worker.service';
import { MemoryRetrievalService } from './memory-retrieval.service';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    AuthModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [MemoryController],
  providers: [
    ShortTermMemoryService,
    LtmCacheService,
    LongTermMemoryService,
    MemoryOrchestratorService,
    EmbeddingService, // 保留服务；db_design 无 embedding 列，暂不落库
    LlmUsageService,
    MemoryQueueService,
    MemoryWorkerService,
    MemoryRetrievalService,
  ],
  exports: [
    MemoryOrchestratorService,
    ShortTermMemoryService,
    LtmCacheService,
    LongTermMemoryService,
    MemoryRetrievalService,
    LlmUsageService,
    MemoryQueueService,
  ],
})
export class MemoryModule {}
