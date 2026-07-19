import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { rrfMerge } from './memory.types';
import { bid } from '../common/id/snowflake';

export interface RetrievedMemory {
  id: string;
  content: string;
  memoryType: string;
  score: number;
}

/**
 * 混合召回：ILIKE + pg_trgm（db_design 未含 embedding 列，本阶段不做向量）。
 */
@Injectable()
export class MemoryRetrievalService {
  constructor(private readonly prisma: PrismaService) {}

  async retrieve(
    userId: string,
    query: string,
    topK = 5,
  ): Promise<RetrievedMemory[]> {
    const [ilikeHits, trgmHits] = await Promise.all([
      this.ilikeSearch(userId, query, topK),
      this.trgmSearch(userId, query, topK),
    ]);

    const merged = rrfMerge(
      [
        ilikeHits.map((h) => ({
          id: h.id,
          payload: { content: h.content, memoryType: h.memoryType },
        })),
        trgmHits.map((h) => ({
          id: h.id,
          payload: { content: h.content, memoryType: h.memoryType },
        })),
      ],
      60,
      topK,
    );

    return merged.map((m) => ({
      id: m.id,
      content: String(m.payload.content ?? ''),
      memoryType: String(m.payload.memoryType ?? ''),
      score: m.score,
    }));
  }

  private async ilikeSearch(userId: string, query: string, topK: number) {
    const q = query.trim();
    if (!q) return [];
    const rows = await this.prisma.$queryRawUnsafe<
      { id: bigint; content: string; memory_type: string }[]
    >(
      `SELECT id, content, memory_type
       FROM memory_chunks
       WHERE user_id = $1::bigint
         AND content ILIKE '%' || $2 || '%'
       ORDER BY importance DESC, created_at DESC
       LIMIT $3`,
      bid(userId).toString(),
      q.slice(0, 100),
      topK,
    );
    return rows.map((r) => ({
      id: r.id.toString(),
      content: r.content,
      memoryType: r.memory_type,
    }));
  }

  private async trgmSearch(userId: string, query: string, topK: number) {
    const q = query.trim();
    if (!q) return [];
    const rows = await this.prisma.$queryRawUnsafe<
      { id: bigint; content: string; memory_type: string }[]
    >(
      `SELECT id, content, memory_type
       FROM memory_chunks
       WHERE user_id = $1::bigint
         AND content % $2
       ORDER BY similarity(content, $2) DESC NULLS LAST, importance DESC
       LIMIT $3`,
      bid(userId).toString(),
      q.slice(0, 100),
      topK,
    );
    return rows.map((r) => ({
      id: r.id.toString(),
      content: r.content,
      memoryType: r.memory_type,
    }));
  }
}
