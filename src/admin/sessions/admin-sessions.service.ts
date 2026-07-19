import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { bid, snowflake } from '../../common/id/snowflake';
import {
  AdminCreateSessionDto,
  AdminUpdateSessionDto,
} from './admin-sessions.dto';

@Injectable()
export class AdminSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  private serializeSession(s: {
    id: bigint;
    userId: bigint;
    title: string | null;
    channel: string;
    lastMessageAt: Date;
    archivedAt: Date | null;
    startedAt: Date;
    user?: { phone: string; nickname: string | null };
    _count?: { messages: number };
  }) {
    return {
      id: s.id.toString(),
      userId: s.userId.toString(),
      phone: s.user?.phone ?? null,
      nickname: s.user?.nickname ?? null,
      title: s.title,
      channel: s.channel,
      lastMessageAt: s.lastMessageAt.toISOString(),
      archivedAt: s.archivedAt?.toISOString() ?? null,
      startedAt: s.startedAt.toISOString(),
      messageCount: s._count?.messages ?? 0,
    };
  }

  async list(params: {
    userId?: string;
    q?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(params.page ?? 1, 1);
    const pageSize = Math.min(Math.max(params.pageSize ?? 20, 1), 100);
    const where: Prisma.ConversationSessionWhereInput = {};
    if (params.userId) {
      where.userId = bid(params.userId);
    }
    if (params.q?.trim()) {
      where.title = { contains: params.q.trim(), mode: 'insensitive' };
    }

    const [total, sessions] = await Promise.all([
      this.prisma.conversationSession.count({ where }),
      this.prisma.conversationSession.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, phone: true, nickname: true } },
          _count: { select: { messages: true } },
        },
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      items: sessions.map((s) => this.serializeSession(s)),
    };
  }

  async create(dto: AdminCreateSessionDto) {
    const userId = bid(dto.userId);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('用户不存在');

    const session = await this.prisma.conversationSession.create({
      data: {
        id: snowflake.nextId(),
        userId,
        channel: dto.channel ?? 'text',
        title: dto.title?.trim() || null,
      },
      include: {
        user: { select: { phone: true, nickname: true } },
        _count: { select: { messages: true } },
      },
    });
    return this.serializeSession(session);
  }

  async update(sessionId: string, dto: AdminUpdateSessionDto) {
    const id = bid(sessionId);
    const session = await this.prisma.conversationSession.findUnique({
      where: { id },
    });
    if (!session) throw new NotFoundException('会话不存在');

    const data: Prisma.ConversationSessionUpdateInput = {};
    if (dto.title !== undefined) {
      data.title = dto.title.trim() ? dto.title.trim() : null;
    }
    if (dto.channel !== undefined) data.channel = dto.channel;
    if (dto.archived !== undefined) {
      data.archivedAt = dto.archived ? new Date() : null;
    }

    const updated = await this.prisma.conversationSession.update({
      where: { id },
      data,
      include: {
        user: { select: { phone: true, nickname: true } },
        _count: { select: { messages: true } },
      },
    });
    return this.serializeSession(updated);
  }

  async remove(sessionId: string) {
    const id = bid(sessionId);
    const session = await this.prisma.conversationSession.findUnique({
      where: { id },
    });
    if (!session) throw new NotFoundException('会话不存在');
    await this.prisma.conversationSession.delete({ where: { id } });
    return { ok: true, id: sessionId };
  }

  async messages(sessionId: string, limit = 100) {
    const id = bid(sessionId);
    const session = await this.prisma.conversationSession.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, phone: true, nickname: true } },
        _count: { select: { messages: true } },
      },
    });
    if (!session) throw new NotFoundException('会话不存在');

    const take = Math.min(Math.max(limit, 1), 500);
    const messages = await this.prisma.conversationMessage.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: 'asc' },
      take,
      select: {
        id: true,
        role: true,
        content: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      session: this.serializeSession(session),
      messages: messages.map((m) => ({
        id: m.id.toString(),
        role: m.role,
        content: m.content,
        status: m.status,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }
}
