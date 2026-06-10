import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMemoDto, MemoResponseDto } from './memo.dto';

@Injectable()
export class MemoService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateMemoDto): Promise<MemoResponseDto> {
    const memo = await this.prisma.memo.create({
      data: {
        userId,
        title: dto.title,
        content: dto.content,
      },
    });

    return memo;
  }

  async findAll(userId: string): Promise<MemoResponseDto[]> {
    return this.prisma.memo.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(userId: string, id: string): Promise<{ deleted: boolean }> {
    const row = await this.prisma.memo.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('备忘录不存在');
    if (row.userId !== userId) throw new ForbiddenException();
    await this.prisma.memo.delete({ where: { id } });
    return { deleted: true };
  }
}
