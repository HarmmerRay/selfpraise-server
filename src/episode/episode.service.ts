import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateEpisodeDto } from './episode.dto';
import type { EpisodeResponseDto } from './episode.dto';

@Injectable()
export class EpisodeService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    dto: CreateEpisodeDto,
  ): Promise<EpisodeResponseDto> {
    if (dto.sourceSessionId) {
      const s = await this.prisma.conversationSession.findUnique({
        where: { id: dto.sourceSessionId },
      });
      if (!s || s.userId !== userId) {
        throw new ForbiddenException('无权关联该会话');
      }
    }

    return this.prisma.episode.create({
      data: {
        userId,
        title: dto.title,
        content: dto.content,
        emotionTag: dto.emotionTag,
        importanceScore: dto.importanceScore ?? 0.5,
        sourceSessionId: dto.sourceSessionId ?? null,
      },
    });
  }

  async list(userId: string, take = 50): Promise<EpisodeResponseDto[]> {
    return this.prisma.episode.findMany({
      where: { userId },
      orderBy: { occurredAt: 'desc' },
      take,
    });
  }
}
