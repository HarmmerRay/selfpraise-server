import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type Redis from 'ioredis';
import { RedisService } from '../common/redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { bid } from '../common/id/snowflake';
import {
  buildDedupeKey,
  contentFingerprintFromPath,
  DEDUPE_TTL_SECONDS,
  MEMORY_DEDUPE_PREFIX,
  MEMORY_JOBS_KEY,
  MEMORY_PROCESSING_KEY,
  MemoryJobPayload,
  MemoryJobTrigger,
} from './memory.types';

@Injectable()
export class MemoryQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(MemoryQueueService.name);
  /** 阻塞弹出必须用独立连接，否则会卡住同连接上的 QPS/缓存读写 */
  private readonly blocker: Redis;

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {
    this.blocker = this.redis.duplicate();
  }

  async onModuleDestroy() {
    await this.blocker.quit();
  }

  async enqueue(params: {
    userId: string;
    sessionId: string;
    trigger: MemoryJobTrigger;
    leafId?: string;
  }): Promise<{ enqueued: boolean; jobId?: string; reason?: string }> {
    const path = await this.loadActivePath(params.sessionId, params.leafId);
    const leafId = params.leafId ?? path[path.length - 1]?.id ?? 'none';
    const contentFingerprint = contentFingerprintFromPath(path);
    const dedupeKey = buildDedupeKey({
      userId: params.userId,
      sessionId: params.sessionId,
      trigger: params.trigger,
      leafId,
      contentFingerprint,
    });
    const redisDedupe = `${MEMORY_DEDUPE_PREFIX}${dedupeKey}`;
    const jobId = randomUUID();
    const setOk = await this.redis.set(
      redisDedupe,
      jobId,
      'EX',
      DEDUPE_TTL_SECONDS,
      'NX',
    );
    if (setOk !== 'OK') {
      return { enqueued: false, reason: 'dedupe_hit' };
    }
    const payload: MemoryJobPayload = {
      jobId,
      userId: params.userId,
      sessionId: params.sessionId,
      trigger: params.trigger,
      leafId,
      contentFingerprint,
      enqueuedAt: new Date().toISOString(),
    };
    await this.redis.lpush(MEMORY_JOBS_KEY, JSON.stringify(payload));
    this.logger.log(`enqueued memory job ${jobId} trigger=${params.trigger}`);
    return { enqueued: true, jobId };
  }

  async brpoplpush(timeoutSec = 5): Promise<MemoryJobPayload | null> {
    const raw = await this.blocker.brpoplpush(
      MEMORY_JOBS_KEY,
      MEMORY_PROCESSING_KEY,
      timeoutSec,
    );
    if (!raw) return null;
    try {
      return JSON.parse(raw) as MemoryJobPayload;
    } catch {
      await this.redis.lrem(MEMORY_PROCESSING_KEY, 1, raw);
      return null;
    }
  }

  async ack(payload: MemoryJobPayload): Promise<void> {
    await this.redis.lrem(
      MEMORY_PROCESSING_KEY,
      1,
      JSON.stringify(payload),
    );
  }

  async nackRequeue(payload: MemoryJobPayload): Promise<void> {
    const raw = JSON.stringify(payload);
    await this.redis.lrem(MEMORY_PROCESSING_KEY, 1, raw);
    await this.redis.lpush(MEMORY_JOBS_KEY, raw);
  }

  private async loadActivePath(sessionId: string, leafId?: string) {
    const sid = bid(sessionId);
    let leaf = leafId ? bid(leafId) : null;
    if (leaf === null) {
      const s = await this.prisma.conversationSession.findUnique({
        where: { id: sid },
        select: { currentLeafId: true },
      });
      leaf = s?.currentLeafId ?? null;
    }
    if (leaf === null) {
      const rows = await this.prisma.conversationMessage.findMany({
        where: { sessionId: sid, status: 'completed' },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          updatedAt: true,
          tokenCount: true,
        },
        take: 50,
      });
      return rows.map((r) => ({
        id: r.id.toString(),
        role: r.role,
        content: r.content,
        updatedAt: r.updatedAt,
        tokenCount: r.tokenCount,
      }));
    }
    const path: {
      id: string;
      role: string;
      content: string;
      updatedAt: Date;
      tokenCount: number | null;
    }[] = [];
    let cur: bigint | null = leaf;
    const guard = new Set<string>();
    while (cur !== null && !guard.has(cur.toString())) {
      guard.add(cur.toString());
      const row = await this.prisma.conversationMessage.findUnique({
        where: { id: cur },
        select: {
          id: true,
          role: true,
          content: true,
          updatedAt: true,
          tokenCount: true,
          parentMessageId: true,
          status: true,
        },
      });
      if (!row) break;
      if (row.status === 'completed') {
        path.push({
          id: row.id.toString(),
          role: row.role,
          content: row.content,
          updatedAt: row.updatedAt,
          tokenCount: row.tokenCount,
        });
      }
      cur = row.parentMessageId;
    }
    return path.reverse();
  }
}
