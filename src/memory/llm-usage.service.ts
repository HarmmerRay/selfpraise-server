import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { bid, snowflake } from '../common/id/snowflake';

@Injectable()
export class LlmUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async record(params: {
    userId: string;
    sessionId?: string;
    purpose: string;
    model: string;
    promptTokens?: number;
    completionTokens?: number;
    estimated?: boolean;
    requestId?: string;
  }) {
    const promptTokens = params.promptTokens ?? 0;
    const completionTokens = params.completionTokens ?? 0;
    return this.prisma.llmUsage.create({
      data: {
        id: snowflake.nextId(),
        userId: bid(params.userId),
        sessionId: params.sessionId ? bid(params.sessionId) : null,
        purpose: params.purpose,
        model: params.model,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        estimated: params.estimated ?? true,
        requestId: params.requestId,
      },
    });
  }

  async aggregateForUser(userId: string, from?: Date, to?: Date) {
    const where: {
      userId: bigint;
      createdAt?: { gte?: Date; lte?: Date };
    } = { userId: bid(userId) };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to) where.createdAt.lte = to;
    }
    const rows = await this.prisma.llmUsage.groupBy({
      by: ['purpose', 'model'],
      where,
      _sum: { totalTokens: true, promptTokens: true, completionTokens: true },
      _count: true,
    });
    return rows.map((r) => ({
      purpose: r.purpose,
      model: r.model,
      calls: r._count,
      totalTokens: r._sum.totalTokens ?? 0,
      promptTokens: r._sum.promptTokens ?? 0,
      completionTokens: r._sum.completionTokens ?? 0,
    }));
  }
}
