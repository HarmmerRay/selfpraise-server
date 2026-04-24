import { Injectable } from '@nestjs/common';
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

  async requestGeneration(): Promise<{ jobId: string }> {
    // TODO: 从 JWT 中获取 userId
    const userId = 'placeholder-user-id';

    const job = await this.praiseQueue.add('generate', { userId });
    return { jobId: job.id.toString() };
  }

  async findAll(): Promise<PraiseResponseDto[]> {
    // TODO: 从 JWT 中获取 userId 进行过滤
    const praises = await this.prisma.praise.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return praises as PraiseResponseDto[];
  }

  async getAudioPath(id: string): Promise<{ audioPath: string }> {
    const praise = await this.prisma.praise.findUnique({ where: { id } });
    return { audioPath: praise?.audioPath ?? '' };
  }
}
