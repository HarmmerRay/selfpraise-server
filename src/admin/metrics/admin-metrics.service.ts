import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { ADMIN_METRICS_CACHE_PREFIX } from '../../memory/memory.types';

/** Token 聚合缓存（秒）— PG 聚合偏贵，可稍长 */
const TOKEN_CACHE_TTL_SECONDS = 60;

const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;

function clampTokenRange(from: Date, to: Date, groupBy: string): Date {
  const maxSpan =
    groupBy === 'minute'
      ? 24 * MS_HOUR
      : groupBy === 'hour'
        ? 14 * MS_DAY
        : 90 * MS_DAY;
  const earliest = new Date(to.getTime() - maxSpan);
  return from < earliest ? earliest : from;
}

function formatTokenBucket(
  d: Date,
  unit: 'day' | 'hour' | 'minute',
): string {
  const iso = d.toISOString();
  if (unit === 'day') return iso.slice(0, 10);
  if (unit === 'hour') return `${iso.slice(0, 13)}:00`;
  return iso.slice(0, 16).replace('T', ' ');
}

@Injectable()
export class AdminMetricsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private async cached<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    try {
      const hit = await this.redis.get(key);
      if (hit) return JSON.parse(hit) as T;
    } catch {
      /* ignore cache read errors */
    }
    const value = await loader();
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      /* ignore cache write errors */
    }
    return value;
  }

  async tokens(params: {
    from?: Date;
    to?: Date;
    groupBy?: 'day' | 'hour' | 'minute' | 'purpose' | 'user';
  }) {
    const groupBy = params.groupBy ?? 'day';
    const to = params.to ?? new Date();
    let from =
      params.from ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    if (!params.from) {
      if (groupBy === 'hour') {
        from = new Date(Date.now() - 48 * 60 * 60 * 1000);
      } else if (groupBy === 'minute') {
        from = new Date(Date.now() - 6 * 60 * 60 * 1000);
      }
    }

    from = clampTokenRange(from, to, groupBy);

    const cacheKey = `${ADMIN_METRICS_CACHE_PREFIX}tokens:${groupBy}:${from.toISOString()}:${to.toISOString()}`;

    return this.cached(cacheKey, TOKEN_CACHE_TTL_SECONDS, () =>
      this.loadTokens({ from, to, groupBy }),
    );
  }

  private async loadTokens(params: {
    from: Date;
    to: Date;
    groupBy: 'day' | 'hour' | 'minute' | 'purpose' | 'user';
  }) {
    const where: Prisma.LlmUsageWhereInput = {
      createdAt: { gte: params.from, lte: params.to },
    };

    if (params.groupBy === 'purpose') {
      const rows = await this.prisma.llmUsage.groupBy({
        by: ['purpose', 'model'],
        where,
        _sum: {
          totalTokens: true,
          promptTokens: true,
          completionTokens: true,
        },
        _count: true,
        orderBy: { purpose: 'asc' },
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

    if (params.groupBy === 'user') {
      const rows = await this.prisma.llmUsage.groupBy({
        by: ['userId'],
        where,
        _sum: { totalTokens: true },
        _count: true,
        orderBy: { _sum: { totalTokens: 'desc' } },
        take: 100,
      });
      const userIds = rows.map((r) => r.userId);
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, phone: true, nickname: true },
      });
      const byId = new Map(users.map((u) => [u.id.toString(), u]));
      return rows.map((r) => {
        const u = byId.get(r.userId.toString());
        return {
          userId: r.userId.toString(),
          phone: u?.phone ?? null,
          nickname: u?.nickname ?? null,
          calls: r._count,
          totalTokens: r._sum.totalTokens ?? 0,
        };
      });
    }

    return this.loadTokensByTime(params.from, params.to, params.groupBy);
  }

  private async loadTokensByTime(
    from: Date,
    to: Date,
    unit: 'day' | 'hour' | 'minute',
  ) {
    const trunc =
      unit === 'day'
        ? Prisma.sql`date_trunc('day', created_at)`
        : unit === 'hour'
          ? Prisma.sql`date_trunc('hour', created_at)`
          : Prisma.sql`date_trunc('minute', created_at)`;

    const rows = await this.prisma.$queryRaw<
      Array<{
        bucket: Date;
        calls: bigint;
        total_tokens: bigint;
        prompt_tokens: bigint;
        completion_tokens: bigint;
      }>
    >`
      SELECT ${trunc} AS bucket,
             COUNT(*)::bigint AS calls,
             COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens,
             COALESCE(SUM(prompt_tokens), 0)::bigint AS prompt_tokens,
             COALESCE(SUM(completion_tokens), 0)::bigint AS completion_tokens
      FROM llm_usage
      WHERE created_at >= ${from} AND created_at <= ${to}
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    return rows.map((r) => ({
      bucket: formatTokenBucket(r.bucket, unit),
      day: formatTokenBucket(r.bucket, unit),
      calls: Number(r.calls),
      totalTokens: Number(r.total_tokens),
      promptTokens: Number(r.prompt_tokens),
      completionTokens: Number(r.completion_tokens),
    }));
  }
}
