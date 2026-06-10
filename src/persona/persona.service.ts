import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PersonaResponseDto } from './persona.dto';
import type { PatchPersonaDto } from './persona.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PersonaService {
  constructor(private readonly prisma: PrismaService) {}

  async getMine(userId: string): Promise<PersonaResponseDto> {
    let row = await this.prisma.persona.findUnique({ where: { userId } });

    if (!row) {
      row = await this.prisma.persona.create({
        data: {
          userId,
          traits: {},
          confidenceScore: 0.2,
        },
      });
    }

    const traits =
      typeof row.traits === 'object' && row.traits !== null
        ? (row.traits as Record<string, unknown>)
        : {};

    return {
      ...row,
      traits,
    };
  }

  async patch(
    userId: string,
    dto: PatchPersonaDto,
  ): Promise<PersonaResponseDto> {
    await this.getMine(userId);

    const data: Prisma.PersonaUpdateInput = {};

    if (dto.traits !== undefined) {
      data.traits = dto.traits as Prisma.InputJsonValue;
    }
    if (dto.confidenceScore !== undefined) {
      data.confidenceScore = dto.confidenceScore;
    }
    if (dto.completeOnboarding === true) {
      data.onboardingCompletedAt = new Date();
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException(
        '至少提供 traits、confidenceScore 或 completeOnboarding(true) 之一',
      );
    }

    const row = await this.prisma.persona.update({
      where: { userId },
      data,
    });

    const traits =
      typeof row.traits === 'object' && row.traits !== null
        ? (row.traits as Record<string, unknown>)
        : {};

    return { ...row, traits };
  }
}
