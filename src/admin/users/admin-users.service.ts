import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { bid, snowflake } from '../../common/id/snowflake';
import { AdminCreateUserDto, AdminUpdateUserDto } from './admin-users.dto';

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  private serialize(
    u: {
      id: bigint;
      phone: string;
      nickname: string | null;
      avatarUrl: string | null;
      createdAt: Date;
    },
    counts?: { sessionCount: number; messageCount: number },
  ) {
    return {
      id: u.id.toString(),
      phone: u.phone,
      nickname: u.nickname,
      avatarUrl: u.avatarUrl,
      createdAt: u.createdAt.toISOString(),
      sessionCount: counts?.sessionCount ?? 0,
      messageCount: counts?.messageCount ?? 0,
    };
  }

  async list(params: { q?: string; page?: number; pageSize?: number }) {
    const page = Math.max(params.page ?? 1, 1);
    const pageSize = Math.min(Math.max(params.pageSize ?? 20, 1), 100);
    const where: Prisma.UserWhereInput = {};
    if (params.q?.trim()) {
      const q = params.q.trim();
      where.OR = [
        { phone: { contains: q } },
        { nickname: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: {
            select: {
              conversationSessions: true,
              conversationMessages: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      items: users.map((u) =>
        this.serialize(u, {
          sessionCount: u._count.conversationSessions,
          messageCount: u._count.conversationMessages,
        }),
      ),
    };
  }

  async detail(userId: string) {
    const id = bid(userId);
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            conversationSessions: true,
            conversationMessages: true,
            memoryChunks: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('用户不存在');

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const tokenAgg = await this.prisma.llmUsage.aggregate({
      where: { userId: id, createdAt: { gte: since } },
      _sum: { totalTokens: true },
      _count: true,
    });

    const recentSessions = await this.prisma.conversationSession.findMany({
      where: { userId: id },
      orderBy: { lastMessageAt: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
        channel: true,
        lastMessageAt: true,
        archivedAt: true,
      },
    });

    return {
      ...this.serialize(user, {
        sessionCount: user._count.conversationSessions,
        messageCount: user._count.conversationMessages,
      }),
      memoryChunkCount: user._count.memoryChunks,
      tokensLast30d: {
        calls: tokenAgg._count,
        totalTokens: tokenAgg._sum.totalTokens ?? 0,
      },
      recentSessions: recentSessions.map((s) => ({
        id: s.id.toString(),
        title: s.title,
        channel: s.channel,
        lastMessageAt: s.lastMessageAt.toISOString(),
        archivedAt: s.archivedAt?.toISOString() ?? null,
      })),
    };
  }

  async create(dto: AdminCreateUserDto) {
    const exists = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });
    if (exists) throw new ConflictException('手机号已存在');

    const user = await this.prisma.user.create({
      data: {
        id: snowflake.nextId(),
        phone: dto.phone,
        nickname: dto.nickname?.trim() || null,
        avatarUrl: dto.avatarUrl?.trim() || null,
      },
    });
    return this.serialize(user);
  }

  async update(userId: string, dto: AdminUpdateUserDto) {
    const id = bid(userId);
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');

    if (dto.phone && dto.phone !== user.phone) {
      const clash = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
      });
      if (clash) throw new ConflictException('手机号已存在');
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.nickname !== undefined) {
      data.nickname = dto.nickname.trim() ? dto.nickname.trim() : null;
    }
    if (dto.avatarUrl !== undefined) {
      data.avatarUrl = dto.avatarUrl.trim() ? dto.avatarUrl.trim() : null;
    }

    const updated = await this.prisma.user.update({ where: { id }, data });
    const counts = await this.prisma.user.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            conversationSessions: true,
            conversationMessages: true,
          },
        },
      },
    });
    return this.serialize(updated, {
      sessionCount: counts?._count.conversationSessions ?? 0,
      messageCount: counts?._count.conversationMessages ?? 0,
    });
  }

  async remove(userId: string) {
    const id = bid(userId);
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');
    await this.prisma.user.delete({ where: { id } });
    return { ok: true, id: userId };
  }
}
