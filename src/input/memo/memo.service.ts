import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMemoDto, MemoResponseDto } from './memo.dto';

@Injectable()
export class MemoService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMemoDto): Promise<MemoResponseDto> {
    // TODO: 从 JWT 中获取 userId，暂时使用占位
    const userId = 'placeholder-user-id';

    const memo = await this.prisma.memo.create({
      data: {
        userId,
        title: dto.title,
        content: dto.content,
      },
    });

    return memo;
  }

  async findAll(): Promise<MemoResponseDto[]> {
    // TODO: 从 JWT 中获取 userId 进行过滤
    const memos = await this.prisma.memo.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return memos;
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    await this.prisma.memo.delete({ where: { id } });
    return { deleted: true };
  }
}
