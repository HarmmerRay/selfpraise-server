import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AppendMessageDto,
  EndSessionDto,
  MessageResponseDto,
  SessionResponseDto,
  StartSessionDto,
} from './conversation.dto';

const ALLOWED_CHANNELS = new Set(['text', 'voice', 'video']);

@Injectable()
export class ConversationService {
  constructor(private readonly prisma: PrismaService) {}

  async startSession(
    userId: string,
    dto: StartSessionDto,
  ): Promise<SessionResponseDto> {
    const channel = dto.channel.trim().toLowerCase();
    if (!ALLOWED_CHANNELS.has(channel)) {
      throw new ForbiddenException(`不支持的会话渠道: ${dto.channel}`);
    }
    const row = await this.prisma.conversationSession.create({
      data: {
        userId,
        channel,
      },
    });
    return row;
  }

  async listSessions(userId: string, take = 20): Promise<SessionResponseDto[]> {
    return this.prisma.conversationSession.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take,
    });
  }

  async appendMessage(
    userId: string,
    sessionId: string,
    dto: AppendMessageDto,
  ): Promise<MessageResponseDto> {
    await this.ensureSessionOwnership(userId, sessionId);

    const role = dto.role.trim().toLowerCase();
    if (role !== 'user' && role !== 'assistant' && role !== 'system') {
      throw new ForbiddenException('role 仅支持 user / assistant / system');
    }

    return this.prisma.conversationMessage.create({
      data: {
        sessionId,
        userId,
        role,
        content: dto.content,
        intentJson:
          dto.intentJson === undefined
            ? undefined
            : (dto.intentJson as Prisma.InputJsonValue),
      },
    });
  }

  async endSession(
    userId: string,
    sessionId: string,
    dto: EndSessionDto,
  ): Promise<SessionResponseDto> {
    const session = await this.ensureSessionOwnership(userId, sessionId);
    if (session.endedAt !== null) {
      return session;
    }
    return this.prisma.conversationSession.update({
      where: { id: sessionId },
      data: {
        endedAt: new Date(),
        summary: dto.summary ?? undefined,
      },
    });
  }

  async listMessages(
    userId: string,
    sessionId: string,
    take = 100,
  ): Promise<MessageResponseDto[]> {
    await this.ensureSessionOwnership(userId, sessionId);

    return this.prisma.conversationMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take,
    });
  }

  /**
   * 加载会话中最近 N 条消息（用于多轮对话上下文）。
   * 按 createdAt 升序返回 { role, content }。
   */
  async loadRecentMessages(
    sessionId: string,
    limit = 20,
  ): Promise<{ role: string; content: string }[]> {
    const messages = await this.prisma.conversationMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { role: true, content: true },
    });
    // 反转为时间正序（最旧在前）
    return messages.reverse();
  }

  /**
   * 直接保存一条 assistant 消息（不校验 DTO，供 SSE 端点内部使用）。
   */
  async saveAssistantMessage(
    userId: string,
    sessionId: string,
    content: string,
  ): Promise<MessageResponseDto> {
    return this.prisma.conversationMessage.create({
      data: { sessionId, userId, role: 'assistant', content },
    });
  }

  async ensureSessionOwnership(userId: string, sessionId: string) {
    const session = await this.prisma.conversationSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('会话不存在');
    if (session.userId !== userId) throw new ForbiddenException();
    return session;
  }
}
