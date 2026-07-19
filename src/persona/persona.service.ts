import { BadRequestException, Injectable } from '@nestjs/common';
import { PersonaResponseDto } from './persona.dto';
import type { PatchPersonaDto } from './persona.dto';
import { PrismaService } from '../prisma/prisma.service';
import { LtmCacheService } from '../memory/short-term-memory.service';
import { bid, snowflake } from '../common/id/snowflake';

const TRAIT_REF_PREFIX = 'onboarding:trait:';
const COMPLETED_REF = 'onboarding:completed';
const CONFIDENCE_REF = 'onboarding:confidence';

/**
 * 兼容旧 /persona/me API；持久化落在 memory_chunks。
 */
@Injectable()
export class PersonaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ltmCache: LtmCacheService,
  ) {}

  async getMine(userId: string): Promise<PersonaResponseDto> {
    const uid = bid(userId);
    const chunks = await this.prisma.memoryChunk.findMany({
      where: {
        userId: uid,
        sourceRef: { startsWith: 'onboarding:' },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const traits: Record<string, unknown> = {};
    let onboardingCompletedAt: Date | null = null;
    let confidenceScore = 0.3;
    let createdAt = new Date();
    let updatedAt = new Date();

    if (chunks.length === 0) {
      return {
        id: userId,
        userId,
        traits: {},
        confidenceScore,
        onboardingCompletedAt: null,
        createdAt,
        updatedAt,
      };
    }

    createdAt = chunks[chunks.length - 1].createdAt;
    updatedAt = chunks[0].updatedAt;

    for (const c of chunks) {
      const ref = c.sourceRef ?? '';
      if (ref.startsWith(TRAIT_REF_PREFIX)) {
        traits[ref.slice(TRAIT_REF_PREFIX.length)] = c.content;
      } else if (ref === COMPLETED_REF) {
        onboardingCompletedAt = c.createdAt;
      } else if (ref === CONFIDENCE_REF) {
        const n = Number(c.content);
        if (!Number.isNaN(n)) confidenceScore = n;
      }
    }

    return {
      id: userId,
      userId,
      traits,
      confidenceScore,
      onboardingCompletedAt,
      createdAt,
      updatedAt,
    };
  }

  async patch(
    userId: string,
    dto: PatchPersonaDto,
  ): Promise<PersonaResponseDto> {
    if (
      dto.traits === undefined &&
      dto.confidenceScore === undefined &&
      dto.completeOnboarding !== true
    ) {
      throw new BadRequestException(
        '至少提供 traits、confidenceScore 或 completeOnboarding(true) 之一',
      );
    }

    const uid = bid(userId);

    if (dto.traits !== undefined) {
      await this.prisma.memoryChunk.deleteMany({
        where: {
          userId: uid,
          sourceRef: { startsWith: TRAIT_REF_PREFIX },
        },
      });
      const entries = Object.entries(dto.traits).filter(
        ([, v]) => v !== null && v !== undefined && `${v}`.trim() !== '',
      );
      if (entries.length > 0) {
        await this.prisma.memoryChunk.createMany({
          data: entries.map(([key, value]) => ({
            id: snowflake.nextId(),
            userId: uid,
            memoryType: 'preference',
            content: String(value),
            importance: 0.7,
            sourceRef: `${TRAIT_REF_PREFIX}${key}`,
          })),
        });
      }
    }

    if (dto.confidenceScore !== undefined) {
      await this.prisma.memoryChunk.deleteMany({
        where: { userId: uid, sourceRef: CONFIDENCE_REF },
      });
      await this.prisma.memoryChunk.create({
        data: {
          id: snowflake.nextId(),
          userId: uid,
          memoryType: 'preference',
          content: String(dto.confidenceScore),
          importance: 0.5,
          sourceRef: CONFIDENCE_REF,
        },
      });
    }

    if (dto.completeOnboarding === true) {
      const existing = await this.prisma.memoryChunk.findFirst({
        where: { userId: uid, sourceRef: COMPLETED_REF },
      });
      if (!existing) {
        await this.prisma.memoryChunk.create({
          data: {
            id: snowflake.nextId(),
            userId: uid,
            memoryType: 'preference',
            content: 'completed',
            importance: 1,
            sourceRef: COMPLETED_REF,
          },
        });
      }
    }

    await this.ltmCache.del(userId);
    return this.getMine(userId);
  }
}
