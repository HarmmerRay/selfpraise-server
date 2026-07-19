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
import { MemoryOrchestratorService } from '../memory/memory-orchestrator.service';
import { estimateTokens, titleFromFirstMessage } from '../memory/memory.types';
import { bid, snowflake } from '../common/id/snowflake';

const ALLOWED_CHANNELS = new Set(['text', 'voice', 'video']);

@Injectable()
export class ConversationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly memory: MemoryOrchestratorService,
  ) {}

  async startSession(
    userId: string,
    dto: StartSessionDto,
  ): Promise<SessionResponseDto> {
    const channel = dto.channel.trim().toLowerCase();
    if (!ALLOWED_CHANNELS.has(channel)) {
      throw new ForbiddenException(`不支持的会话渠道: ${dto.channel}`);
    }
    return this.prisma.conversationSession.create({
      data: {
        id: snowflake.nextId(),
        userId: bid(userId),
        channel,
      },
    }) as unknown as Promise<SessionResponseDto>;
  }

  async listSessions(userId: string, take = 20): Promise<SessionResponseDto[]> {
    return this.prisma.conversationSession.findMany({
      where: { userId: bid(userId) },
      orderBy: { lastMessageAt: 'desc' },
      take,
    }) as unknown as Promise<SessionResponseDto[]>;
  }

  async patchSession(
    userId: string,
    sessionId: string,
    body: { title?: string; archived?: boolean },
  ) {
    await this.ensureSessionOwnership(userId, sessionId);
    return this.prisma.conversationSession.update({
      where: { id: bid(sessionId) },
      data: {
        title: body.title,
        archivedAt:
          body.archived === undefined
            ? undefined
            : body.archived
              ? new Date()
              : null,
      },
    });
  }

  async appendMessage(
    userId: string,
    sessionId: string,
    dto: AppendMessageDto & { parentMessageId?: string },
  ): Promise<MessageResponseDto> {
    const session = await this.ensureSessionOwnership(userId, sessionId);
    const role = dto.role.trim().toLowerCase();
    if (role !== 'user' && role !== 'assistant' && role !== 'system') {
      throw new ForbiddenException('role 仅支持 user / assistant / system');
    }

    const parentMessageId =
      dto.parentMessageId != null
        ? bid(dto.parentMessageId)
        : session.currentLeafId ?? undefined;

    const msgId = snowflake.nextId();
    const uid = bid(userId);
    const sid = bid(sessionId);

    const saved = await this.prisma.conversationMessage.create({
      data: {
        id: msgId,
        sessionId: sid,
        userId: uid,
        role,
        content: dto.content,
        parentMessageId,
        status: 'completed',
        tokenCount: estimateTokens(dto.content),
        intentJson:
          dto.intentJson === undefined
            ? undefined
            : (dto.intentJson as Prisma.InputJsonValue),
      },
    });

    const title =
      !session.title && role === 'user'
        ? titleFromFirstMessage(dto.content)
        : undefined;

    await this.prisma.conversationSession.update({
      where: { id: sid },
      data: {
        currentLeafId: saved.id,
        lastMessageAt: new Date(),
        ...(title ? { title } : {}),
      },
    });

    await this.memory.onMessageAppended(
      sessionId,
      role,
      dto.content,
      saved.id.toString(),
      saved.id.toString(),
    );
    return saved as unknown as MessageResponseDto;
  }

  async endSession(
    userId: string,
    sessionId: string,
    dto: EndSessionDto,
  ): Promise<SessionResponseDto> {
    const session = await this.ensureSessionOwnership(userId, sessionId);
    if (session.archivedAt !== null) {
      return session as unknown as SessionResponseDto;
    }

    await this.memory.compactSession(userId, sessionId, dto.summary);

    return this.prisma.conversationSession.update({
      where: { id: bid(sessionId) },
      data: { archivedAt: new Date() },
    }) as unknown as Promise<SessionResponseDto>;
  }

  async listMessages(
    userId: string,
    sessionId: string,
    take = 100,
  ): Promise<MessageResponseDto[]> {
    await this.ensureSessionOwnership(userId, sessionId);
    return this.prisma.conversationMessage.findMany({
      where: { sessionId: bid(sessionId) },
      orderBy: { createdAt: 'asc' },
      take,
    }) as unknown as Promise<MessageResponseDto[]>;
  }

  async saveAssistantMessage(
    userId: string,
    sessionId: string,
    content: string,
    parentMessageId?: string,
  ): Promise<MessageResponseDto> {
    const session = await this.ensureSessionOwnership(userId, sessionId);
    const sid = bid(sessionId);
    const saved = await this.prisma.conversationMessage.create({
      data: {
        id: snowflake.nextId(),
        sessionId: sid,
        userId: bid(userId),
        role: 'assistant',
        content,
        parentMessageId:
          parentMessageId != null
            ? bid(parentMessageId)
            : session.currentLeafId,
        status: 'completed',
        tokenCount: estimateTokens(content),
      },
    });
    await this.prisma.conversationSession.update({
      where: { id: sid },
      data: { currentLeafId: saved.id, lastMessageAt: new Date() },
    });
    await this.memory.onMessageAppended(
      sessionId,
      'assistant',
      content,
      saved.id.toString(),
      saved.id.toString(),
    );
    return saved as unknown as MessageResponseDto;
  }

  async ensureSessionOwnership(userId: string, sessionId: string) {
    const session = await this.prisma.conversationSession.findUnique({
      where: { id: bid(sessionId) },
    });
    if (!session) throw new NotFoundException('会话不存在');
    if (session.userId !== bid(userId)) throw new ForbiddenException();
    return session;
  }
}
