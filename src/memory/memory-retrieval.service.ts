import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';
import { rrfMerge } from './memory.types';
import { bid } from '../common/id/snowflake';

export interface RetrievedMemory {
  id: string;
  content: string;
  memoryType: string;
  score: number;
}

/**
 * EMBEDDING_MODE 空：按类型先验 + importance 算法召回
 * EMBEDDING_MODE=local：BGE-M3 向量为主 + 轻量关键词补漏 → RRF
 */
@Injectable()
export class MemoryRetrievalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingService,
  ) {}

  async retrieve(
    userId: string,
    query: string,
    topK = 5,
  ): Promise<RetrievedMemory[]> {
    if (!this.embedding.isEnabled()) {
      return this.algorithmSearch(userId, topK);
    }

    const q = query.trim();
    if (!q) return this.algorithmSearch(userId, topK);

    const [vectorHits, ilikeHits, experienceHits] = await Promise.all([
      this.vectorSearch(userId, q, Math.max(topK, 10)),
      this.ilikeSearch(userId, q, topK),
      this.experienceSearch(userId, q, topK),
    ]);

    if (vectorHits.length === 0 && ilikeHits.length === 0 && experienceHits.length === 0) {
      return this.algorithmSearch(userId, topK);
    }

    const merged = rrfMerge(
      [
        vectorHits.map((h) => ({
          id: h.id,
          payload: { content: h.content, memoryType: h.memoryType },
        })),
        experienceHits.map((h) => ({
          id: h.id,
          payload: { content: h.content, memoryType: h.memoryType },
        })),
        ilikeHits.map((h) => ({
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

  /** 无向量时：类型先验 + importance（非正式文本/倒排索引） */
  private async algorithmSearch(userId: string, topK: number) {
    const rows = await this.prisma.$queryRawUnsafe<
      { id: bigint; content: string; memory_type: string; importance: number }[]
    >(
      `SELECT id, content, memory_type, importance
       FROM memory_chunks
       WHERE user_id = $1::bigint
       ORDER BY
         CASE memory_type
           WHEN 'personality' THEN 0
           WHEN 'preference' THEN 1
           WHEN 'experience' THEN 2
           WHEN 'skill' THEN 3
           ELSE 4
         END,
         importance DESC,
         created_at DESC
       LIMIT $2`,
      bid(userId).toString(),
      topK,
    );
    return rows.map((r, idx) => ({
      id: r.id.toString(),
      content: r.content,
      memoryType: r.memory_type,
      score: 1 / (idx + 1),
    }));
  }

  private async vectorSearch(userId: string, query: string, topK: number) {
    const vec = await this.embedding.embed(query);
    if (!vec?.length) return [];
    const literal = this.embedding.toPgVectorLiteral(vec);
    const rows = await this.prisma.$queryRawUnsafe<
      { id: bigint; content: string; memory_type: string }[]
    >(
      `SELECT id, content, memory_type
       FROM memory_chunks
       WHERE user_id = $1::bigint
         AND embedding IS NOT NULL
       ORDER BY embedding <=> $2::vector
       LIMIT $3`,
      bid(userId).toString(),
      literal,
      topK,
    );
    return rows.map((r) => ({
      id: r.id.toString(),
      content: r.content,
      memoryType: r.memory_type,
    }));
  }

  private async ilikeSearch(userId: string, query: string, topK: number) {
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
      query.slice(0, 100),
      topK,
    );
    return rows.map((r) => ({
      id: r.id.toString(),
      content: r.content,
      memoryType: r.memory_type,
    }));
  }

  private async experienceSearch(userId: string, query: string, topK: number) {
    const rows = await this.prisma.$queryRawUnsafe<
      { id: bigint; content: string; memory_type: string }[]
    >(
      `SELECT id, content, memory_type
       FROM memory_chunks
       WHERE user_id = $1::bigint
         AND memory_type = 'experience'
         AND content ILIKE '%' || $2 || '%'
       ORDER BY importance DESC, created_at DESC
       LIMIT $3`,
      bid(userId).toString(),
      query.slice(0, 100),
      topK,
    );
    return rows.map((r) => ({
      id: r.id.toString(),
      content: r.content,
      memoryType: r.memory_type,
    }));
  }
}
