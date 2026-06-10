import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { PraiseResponseDto } from './praise.dto';

@Injectable()
export class PraiseService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('praise') private readonly praiseQueue: Queue,
  ) {}

  async requestGeneration(userId: string): Promise<{ jobId: string }> {
    const job = await this.praiseQueue.add('generate', { userId });
    return { jobId: job.id.toString() };
  }

  async findAll(userId: string): Promise<PraiseResponseDto[]> {
    const praises = await this.prisma.praise.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return praises as PraiseResponseDto[];
  }

  async getAudioPath(
    userId: string,
    id: string,
  ): Promise<{ audioPath: string }> {
    const praise = await this.prisma.praise.findUnique({ where: { id } });
    if (!praise) throw new NotFoundException();
    if (praise.userId !== userId) throw new ForbiddenException();
    return { audioPath: praise.audioPath ?? '' };
  }
}
