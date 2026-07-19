import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { LongTermMemoryService } from './long-term-memory.service';
import { LtmCacheService } from './short-term-memory.service';
import { MemoryQueueService } from './memory-queue.service';
import { bid } from '../common/id/snowflake';

@Injectable()
export class MemoryWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MemoryWorkerService.name);
  private running = false;
  private loopPromise?: Promise<void>;

  constructor(
    private readonly queue: MemoryQueueService,
    private readonly prisma: PrismaService,
    private readonly ltm: LongTermMemoryService,
    private readonly ltmCache: LtmCacheService,
  ) {}

  onModuleInit() {
    this.running = true;
    this.loopPromise = this.loop();
  }

  async onModuleDestroy() {
    this.running = false;
    await this.loopPromise;
  }

  private async loop() {
    while (this.running) {
      try {
        const job = await this.queue.brpoplpush(2);
        if (!job) continue;
        try {
          await this.process(job);
          await this.queue.ack(job);
        } catch (e) {
          this.logger.error(`job ${job.jobId} failed: ${(e as Error).message}`);
          await this.queue.nackRequeue(job);
          await new Promise((r) => setTimeout(r, 1000));
        }
      } catch (e) {
        this.logger.warn(`worker loop: ${(e as Error).message}`);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  private async process(job: {
    userId: string;
    sessionId: string;
    leafId?: string;
    trigger: string;
  }) {
    const messages = await this.prisma.conversationMessage.findMany({
      where: { sessionId: bid(job.sessionId), status: 'completed' },
      orderBy: { createdAt: 'asc' },
      take: 40,
      select: { role: true, content: true },
    });
    if (messages.length === 0) return;

    const digest = messages
      .slice(-12)
      .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
      .join('\n');

    const content = `会话要点（${job.trigger}）：${digest.slice(0, 500)}`;
    const type = job.trigger === 'explicit' ? 'experience' : 'preference';

    const created = await this.ltm.saveFacet(
      job.userId,
      type,
      content,
      0.55,
      `session:${job.sessionId}`,
    );
    await this.ltmCache.del(job.userId);
    this.logger.log(`extracted memory ${created.id} for user ${job.userId}`);
  }

  /** 补偿：24h 内且沉寂 ≥6h 的 session */
  @Cron(CronExpression.EVERY_HOUR)
  async compensateIdleSessions() {
    const now = new Date();
    const from = new Date(now.getTime() - 24 * 3600 * 1000);
    const to = new Date(now.getTime() - 6 * 3600 * 1000);
    const sessions = await this.prisma.conversationSession.findMany({
      where: {
        lastMessageAt: { gt: from, lte: to },
      },
      select: { id: true, userId: true, currentLeafId: true },
      take: 100,
    });
    for (const s of sessions) {
      await this.queue.enqueue({
        userId: s.userId.toString(),
        sessionId: s.id.toString(),
        trigger: 'compensate',
        leafId: s.currentLeafId?.toString(),
      });
    }
    if (sessions.length) {
      this.logger.log(`compensate scanned ${sessions.length} sessions`);
    }
  }
}
