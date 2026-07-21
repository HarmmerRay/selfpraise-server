import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ExtractedExperience,
  isNearDuplicateExperience,
  normalizeExperienceContent,
} from './experience-extract';
import { EmbeddingService } from './embedding.service';
import { LTM_FACET_TYPES } from './memory.types';
import { LtmCacheService } from './short-term-memory.service';
import { bid, snowflake } from '../common/id/snowflake';

const TRAIT_REF_PREFIX = 'onboarding:trait:';

@Injectable()
export class LongTermMemoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ltmCache: LtmCacheService,
    private readonly embedding: EmbeddingService,
  ) {}

  async getPersonaTraits(userId: string): Promise<Record<string, unknown>> {
    const chunks = await this.prisma.memoryChunk.findMany({
      where: {
        userId: bid(userId),
        sourceRef: { startsWith: TRAIT_REF_PREFIX },
      },
    });
    const traits: Record<string, unknown> = {};
    for (const c of chunks) {
      const ref = c.sourceRef ?? '';
      if (ref.startsWith(TRAIT_REF_PREFIX)) {
        traits[ref.slice(TRAIT_REF_PREFIX.length)] = c.content;
      }
    }
    return traits;
  }

  async listExperiences(userId: string, take = 40) {
    return this.prisma.memoryChunk.findMany({
      where: { userId: bid(userId), memoryType: 'experience' },
      orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
      take,
      select: {
        id: true,
        memoryType: true,
        content: true,
        importance: true,
        createdAt: true,
        sourceRef: true,
      },
    });
  }

  /**
   * 写入 experience：内容规范化 + 近重复跳过。
   * source_ref 形如 session:{id}（同 session 多条事实共用，靠 content 去重）。
   */
  async saveExperiences(
    userId: string,
    items: ExtractedExperience[],
    sourceRef: string,
  ) {
    if (items.length === 0) return [];
    const existing = await this.listExperiences(userId, 80);
    const existingTexts = existing.map((e) => e.content);
    const created: typeof existing = [];

    for (const item of items) {
      const content = normalizeExperienceContent(item.content);
      if (content.length < 6) continue;
      if (isNearDuplicateExperience(content, existingTexts)) continue;
      const row = await this.prisma.memoryChunk.create({
        data: {
          id: snowflake.nextId(),
          userId: bid(userId),
          memoryType: 'experience',
          content,
          importance: item.importance,
          sourceRef,
        },
      });
      await this.writeEmbedding(row.id, content);
      existingTexts.push(content);
      created.push({
        id: row.id,
        memoryType: row.memoryType,
        content: row.content,
        importance: row.importance,
        createdAt: row.createdAt,
        sourceRef: row.sourceRef,
      });
    }

    if (created.length > 0) {
      await this.ltmCache.del(userId);
    }
    return created;
  }

  async listProfileFacets(userId: string, take = 20) {
    const experiences = await this.listExperiences(userId, Math.min(12, take));
    const otherTake = Math.max(0, take - experiences.length);
    const others =
      otherTake > 0
        ? await this.prisma.memoryChunk.findMany({
            where: {
              userId: bid(userId),
              memoryType: {
                in: LTM_FACET_TYPES.filter((t) => t !== 'experience'),
              },
            },
            orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
            take: otherTake,
            select: {
              id: true,
              memoryType: true,
              content: true,
              importance: true,
              createdAt: true,
              sourceRef: true,
            },
          })
        : [];
    return [...experiences, ...others];
  }

  async listChunks(userId: string, take = 50) {
    return this.prisma.memoryChunk.findMany({
      where: { userId: bid(userId) },
      orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
      take,
    });
  }

  async saveFacet(
    userId: string,
    memoryType: string,
    content: string,
    importance = 0.6,
    sourceRef?: string,
  ) {
    if (!LTM_FACET_TYPES.includes(memoryType as (typeof LTM_FACET_TYPES)[number])) {
      throw new Error(`无效的长期记忆类型: ${memoryType}`);
    }
    const row = await this.prisma.memoryChunk.create({
      data: {
        id: snowflake.nextId(),
        userId: bid(userId),
        memoryType,
        content,
        importance,
        sourceRef,
      },
    });
    await this.writeEmbedding(row.id, content);
    await this.ltmCache.del(userId);
    return row;
  }

  async deleteChunk(userId: string, id: string) {
    const existing = await this.prisma.memoryChunk.findFirst({
      where: { id: bid(id), userId: bid(userId) },
    });
    if (!existing) return null;
    await this.prisma.memoryChunk.delete({ where: { id: bid(id) } });
    await this.ltmCache.del(userId);
    return existing;
  }

  async getCachedOrBuildProfile(userId: string) {
    const cached = await this.ltmCache.get(userId);
    if (cached) {
      try {
        return JSON.parse(cached) as {
          traits: Record<string, unknown>;
          facets: { type: string; content: string; id: string }[];
        };
      } catch {
        /* rebuild */
      }
    }
    const traits = await this.getPersonaTraits(userId);
    const facetRows = await this.listProfileFacets(userId, 20);
    const facets = facetRows.map((f) => ({
      id: f.id.toString(),
      type: f.memoryType,
      content: f.content,
    }));
    const profile = { traits, facets };
    await this.ltmCache.set(userId, JSON.stringify(profile));
    return profile;
  }

  private async writeEmbedding(chunkId: bigint, content: string) {
    if (!this.embedding.isEnabled()) return;
    try {
      const vec = await this.embedding.embed(content);
      if (!vec?.length) return;
      const literal = this.embedding.toPgVectorLiteral(vec);
      await this.prisma.$executeRawUnsafe(
        `UPDATE memory_chunks SET embedding = $1::vector, updated_at = now() WHERE id = $2::bigint`,
        literal,
        chunkId.toString(),
      );
    } catch {
      // 不挡主流程；embedding 为空时走算法召回
    }
  }
}
