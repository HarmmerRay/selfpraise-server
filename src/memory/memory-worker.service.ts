import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AgnesLlmService } from '../conversation/agnes-llm.service';
import { PrismaService } from '../prisma/prisma.service';
import { bid } from '../common/id/snowflake';
import {
  buildExperienceExtractMessages,
  formatTranscriptForExtract,
  heuristicExtractExperiences,
  parseExperienceExtractResponse,
} from './experience-extract';
import { LongTermMemoryService } from './long-term-memory.service';
import { LlmUsageService } from './llm-usage.service';
import { MemoryQueueService } from './memory-queue.service';
import { LtmCacheService } from './short-term-memory.service';

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
    private readonly agnes: AgnesLlmService,
    private readonly llmUsage: LlmUsageService,
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

    const transcript = formatTranscriptForExtract(messages);
    let experiences = await this.extractViaLlm(
      job.userId,
      job.sessionId,
      transcript,
    );
    if (experiences.length === 0) {
      experiences = heuristicExtractExperiences(messages);
    }
    if (experiences.length === 0) {
      this.logger.debug(
        `no experience for session ${job.sessionId} (${job.trigger})`,
      );
      return;
    }

    const created = await this.ltm.saveExperiences(
      job.userId,
      experiences,
      `session:${job.sessionId}`,
    );
    await this.ltmCache.del(job.userId);
    this.logger.log(
      `extracted ${created.length}/${experiences.length} experience(s) for user ${job.userId}`,
    );
  }

  private async extractViaLlm(
    userId: string,
    sessionId: string,
    transcript: string,
  ) {
    const messages = buildExperienceExtractMessages(transcript);
    const result = await this.agnes.completeChat(messages, { temperature: 0.2 });
    if (result.content) {
      await this.llmUsage.record({
        userId,
        sessionId,
        purpose: 'memory_extract',
        model: this.agnes.getModelName(),
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        estimated: result.promptTokens == null,
      });
    }
    return parseExperienceExtractResponse(result.content);
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
