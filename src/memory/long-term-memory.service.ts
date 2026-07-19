import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LTM_FACET_TYPES } from './memory.types';
import { LtmCacheService } from './short-term-memory.service';
import { bid, snowflake } from '../common/id/snowflake';

const TRAIT_REF_PREFIX = 'onboarding:trait:';

@Injectable()
export class LongTermMemoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ltmCache: LtmCacheService,
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

  async listProfileFacets(userId: string, take = 20) {
    return this.prisma.memoryChunk.findMany({
      where: {
        userId: bid(userId),
        memoryType: { in: [...LTM_FACET_TYPES] },
      },
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
}
