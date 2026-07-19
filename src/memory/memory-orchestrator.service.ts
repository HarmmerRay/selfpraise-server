import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LongTermMemoryService } from './long-term-memory.service';
import { MemoryQueueService } from './memory-queue.service';
import { MemoryRetrievalService } from './memory-retrieval.service';
import { ShortTermMemoryService } from './short-term-memory.service';
import {
  buildCompressionSummary,
  ChatContext,
  estimateMessagesTokens,
  STM_MESSAGE_TOKEN_BUDGET,
  STM_TARGET_ROUNDS,
  trimMessagesToTokenBudget,
} from './memory.types';
import { bid } from '../common/id/snowflake';

@Injectable()
export class MemoryOrchestratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stm: ShortTermMemoryService,
    private readonly ltm: LongTermMemoryService,
    private readonly retrieval: MemoryRetrievalService,
    private readonly queue: MemoryQueueService,
  ) {}

  async buildChatContext(
    userId: string,
    sessionId: string,
    queryForRetrieve?: string,
  ): Promise<ChatContext> {
    const profile = await this.ltm.getCachedOrBuildProfile(userId);

    let blob = await this.stm.getBlob(sessionId);
    let allMessages =
      blob?.messages.map((m) => ({ role: m.role, content: m.content })) ?? [];

    if (allMessages.length === 0) {
      const path = await this.loadActivePathMessages(sessionId);
      allMessages = path.map((m) => ({ role: m.role, content: m.content }));
      blob = {
        messages: path.map((m) => ({
          role: m.role,
          content: m.content,
          messageId: m.id,
        })),
        currentLeafId: path[path.length - 1]?.id,
        prefixSummary: undefined,
      };
      if (path.length > 0) {
        await this.stm.saveBlob(sessionId, blob);
      }
    }

    let stmPrefixSummary = blob?.prefixSummary;
    const { kept, dropped } = trimMessagesToTokenBudget(
      allMessages,
      STM_MESSAGE_TOKEN_BUDGET,
    );
    let droppedCount = dropped.length;
    let shortTermMessages = kept;

    if (dropped.length > 0) {
      const newSummary = buildCompressionSummary(dropped);
      stmPrefixSummary = stmPrefixSummary
        ? `${stmPrefixSummary}\n${newSummary}`.slice(0, 2000)
        : newSummary;
      await this.stm.saveBlob(sessionId, {
        ...(blob ?? { messages: [] }),
        messages: kept.map((m) => ({ role: m.role, content: m.content })),
        prefixSummary: stmPrefixSummary,
        currentLeafId: blob?.currentLeafId,
      });
      await this.queue.enqueue({
        userId,
        sessionId,
        trigger: 'compress',
        leafId: blob?.currentLeafId,
      });
    }

    const roundCap = STM_TARGET_ROUNDS * 2;
    if (shortTermMessages.length > roundCap) {
      const extra = shortTermMessages.slice(
        0,
        shortTermMessages.length - roundCap,
      );
      shortTermMessages = shortTermMessages.slice(-roundCap);
      droppedCount += extra.length;
      const roundSummary = buildCompressionSummary(extra);
      stmPrefixSummary = stmPrefixSummary
        ? `${stmPrefixSummary}\n${roundSummary}`.slice(0, 2000)
        : roundSummary;
    }

    const retrieveQuery =
      queryForRetrieve ||
      shortTermMessages.filter((m) => m.role === 'user').slice(-1)[0]
        ?.content ||
      '';
    const retrievedMemories = retrieveQuery
      ? await this.retrieval.retrieve(userId, retrieveQuery, 3)
      : [];

    return {
      shortTermMessages,
      stmPrefixSummary,
      stmMeta: {
        estimatedTokens: estimateMessagesTokens(shortTermMessages),
        keptCount: shortTermMessages.length,
        droppedCount,
        tokenBudget: STM_MESSAGE_TOKEN_BUDGET,
      },
      longTermProfile: {
        traits: profile.traits,
        facets: profile.facets.map((f) => ({
          type: f.type,
          content: f.content,
          id: f.id,
        })),
      },
      retrievedMemories,
    };
  }

  async onMessageAppended(
    sessionId: string,
    role: string,
    content: string,
    messageId?: string,
    leafId?: string,
  ): Promise<void> {
    await this.stm.appendMessage(
      sessionId,
      { role, content, messageId, createdAt: new Date().toISOString() },
      leafId,
    );
  }

  async enqueueExtract(userId: string, sessionId: string) {
    return this.queue.enqueue({
      userId,
      sessionId,
      trigger: 'explicit',
    });
  }

  /** 归档用短摘要；并入队沉淀（不写 LTM 同步） */
  async compactSession(
    userId: string,
    sessionId: string,
    explicitSummary?: string,
  ): Promise<string> {
    const messages = await this.prisma.conversationMessage.findMany({
      where: { sessionId: bid(sessionId) },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
      take: 20,
    });
    const summary =
      explicitSummary?.trim() ||
      messages
        .filter((m) => m.role === 'user')
        .slice(0, 1)
        .map((m) => m.content.slice(0, 64))
        .join('') ||
      `会话 ${messages.length} 条消息`;
    await this.queue.enqueue({
      userId,
      sessionId,
      trigger: 'explicit',
    });
    await this.stm.clear(sessionId);
    return summary;
  }

  formatLongTermForPrompt(ctx: ChatContext): string {
    const parts: string[] = [];
    const traitLines = Object.entries(ctx.longTermProfile.traits)
      .filter(([, v]) => v !== null && v !== undefined && `${v}`.trim() !== '')
      .map(([k, v]) => `- ${k}: ${v}`);
    if (traitLines.length > 0) {
      parts.push('【用户画像】\n' + traitLines.join('\n'));
    }
    if (ctx.longTermProfile.facets.length > 0) {
      parts.push(
        '【长期记忆】\n' +
          ctx.longTermProfile.facets
            .map((f) => `- (${f.type}) ${f.content}`)
            .join('\n'),
      );
    }
    if (ctx.retrievedMemories.length > 0) {
      parts.push(
        '【相关记忆召回】\n' +
          ctx.retrievedMemories
            .map((m) => `- ${m.content.slice(0, 200)}`)
            .join('\n'),
      );
    }
    return parts.join('\n\n');
  }

  private async loadActivePathMessages(sessionId: string) {
    const sid = bid(sessionId);
    const session = await this.prisma.conversationSession.findUnique({
      where: { id: sid },
      select: { currentLeafId: true },
    });
    if (!session?.currentLeafId) {
      const rows = await this.prisma.conversationMessage.findMany({
        where: { sessionId: sid, status: 'completed' },
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true, content: true },
        take: 40,
      });
      return rows.map((r) => ({
        id: r.id.toString(),
        role: r.role,
        content: r.content,
      }));
    }
    const path: { id: string; role: string; content: string }[] = [];
    let cur: bigint | null = session.currentLeafId;
    const seen = new Set<string>();
    while (cur !== null && !seen.has(cur.toString())) {
      seen.add(cur.toString());
      const row = await this.prisma.conversationMessage.findUnique({
        where: { id: cur },
        select: {
          id: true,
          role: true,
          content: true,
          parentMessageId: true,
          status: true,
        },
      });
      if (!row) break;
      if (row.status === 'completed') {
        path.push({
          id: row.id.toString(),
          role: row.role,
          content: row.content,
        });
      }
      cur = row.parentMessageId;
    }
    return path.reverse();
  }
}
