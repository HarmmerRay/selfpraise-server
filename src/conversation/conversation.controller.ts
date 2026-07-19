import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { ConversationService } from './conversation.service';
import { AgnesLlmService, ChatMessage } from './agnes-llm.service';
import {
  AppendMessageDto,
  EndSessionDto,
  MessageResponseDto,
  SessionResponseDto,
  StartSessionDto,
} from './conversation.dto';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryOrchestratorService } from '../memory/memory-orchestrator.service';
import { LlmUsageService } from '../memory/llm-usage.service';
import { Observable, Subscriber } from 'rxjs';
import { estimateTokens } from '../memory/memory.types';

@Controller('api/v1/conversations')
export class ConversationController {
  private readonly logger = new Logger(ConversationController.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly agnesLlmService: AgnesLlmService,
    private readonly prisma: PrismaService,
    private readonly memoryOrchestrator: MemoryOrchestratorService,
    private readonly llmUsage: LlmUsageService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('sessions')
  startSession(
    @CurrentUserId() userId: string,
    @Body() dto: StartSessionDto,
  ): Promise<SessionResponseDto> {
    return this.conversationService.startSession(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  listSessions(@CurrentUserId() userId: string): Promise<SessionResponseDto[]> {
    return this.conversationService.listSessions(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('sessions/:id')
  patchSession(
    @CurrentUserId() userId: string,
    @Param('id') sessionId: string,
    @Body() body: { title?: string; archived?: boolean },
  ) {
    return this.conversationService.patchSession(userId, sessionId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sessions/:id/messages')
  appendMessage(
    @CurrentUserId() userId: string,
    @Param('id') sessionId: string,
    @Body() dto: AppendMessageDto & { parentMessageId?: string },
  ): Promise<MessageResponseDto> {
    return this.conversationService.appendMessage(userId, sessionId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sessions/:id/end')
  endSession(
    @CurrentUserId() userId: string,
    @Param('id') sessionId: string,
    @Body() dto: EndSessionDto,
  ): Promise<SessionResponseDto> {
    return this.conversationService.endSession(userId, sessionId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions/:id/messages')
  listMessages(
    @CurrentUserId() userId: string,
    @Param('id') sessionId: string,
  ): Promise<MessageResponseDto[]> {
    return this.conversationService.listMessages(userId, sessionId);
  }

  private emit(
    subscriber: Subscriber<MessageEvent>,
    payload: Record<string, unknown>,
  ) {
    subscriber.next(
      new MessageEvent('message', { data: JSON.stringify(payload) }),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Sse('sessions/:id/chat/stream')
  chatStream(
    @CurrentUserId() userId: string,
    @Param('id') sessionId: string,
  ): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.conversationService.ensureSessionOwnership(
            userId,
            sessionId,
          );

          this.emit(subscriber, {
            type: 'step',
            name: 'load_stm',
            status: 'start',
          });

          const chatContext = await this.memoryOrchestrator.buildChatContext(
            userId,
            sessionId,
          );
          this.emit(subscriber, {
            type: 'step',
            name: 'load_stm',
            status: 'done',
            detail: chatContext.stmMeta,
          });

          this.emit(subscriber, {
            type: 'step',
            name: 'retrieve_memory',
            status: 'start',
          });
          this.emit(subscriber, {
            type: 'step',
            name: 'retrieve_memory',
            status: 'done',
            detail: { hits: chatContext.retrievedMemories.length },
          });

          const memoryBlock =
            this.memoryOrchestrator.formatLongTermForPrompt(chatContext);
          const traits = chatContext.longTermProfile.traits as Record<
            string,
            string
          >;
          let systemPrompt = this.agnesLlmService.buildSystemPrompt(traits);
          if (memoryBlock) systemPrompt += `\n\n${memoryBlock}`;
          if (chatContext.stmPrefixSummary) {
            systemPrompt += `\n\n${chatContext.stmPrefixSummary}`;
          }

          const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            ...chatContext.shortTermMessages.map((m) => ({
              role: m.role as ChatMessage['role'],
              content: m.content,
            })),
          ];

          this.emit(subscriber, {
            type: 'step',
            name: 'call_llm',
            status: 'start',
          });

          let fullContent = '';
          let started = false;
          const stream = this.agnesLlmService.streamChat(messages);
          for await (const rawDelta of stream) {
            let delta = rawDelta;
            if (!started) {
              // Agnes 常以多余换行开头，跳过纯空白前缀
              delta = delta.replace(/^\s*\n+/, '').replace(/^\n+/, '');
              if (!delta.trim()) continue;
              started = true;
            }
            fullContent += delta;
            this.emit(subscriber, { type: 'delta', delta, done: false });
          }
          fullContent = fullContent
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

          this.emit(subscriber, {
            type: 'step',
            name: 'call_llm',
            status: 'done',
          });

          let savedId = '';
          if (fullContent) {
            const saved = await this.conversationService.saveAssistantMessage(
              userId,
              sessionId,
              fullContent,
            );
            savedId = String(saved.id);
            await this.llmUsage.record({
              userId,
              sessionId,
              purpose: 'chat',
              model: process.env.AGNES_MODEL || 'agnes-default',
              promptTokens: estimateTokens(systemPrompt),
              completionTokens: estimateTokens(fullContent),
              estimated: true,
            });
          }

          this.emit(subscriber, {
            type: 'done',
            delta: '',
            done: true,
            messageId: savedId,
          });
          subscriber.complete();
        } catch (err: unknown) {
          this.logger.error(`chatStream: ${(err as Error).message}`);
          this.emit(subscriber, {
            type: 'error',
            error: true,
            message: (err as Error).message ?? 'AI 服务异常',
            done: true,
          });
          subscriber.complete();
        }
      })();
    });
  }

  /** 教育场景：关键词 + 会话上下文讲解 */
  @UseGuards(JwtAuthGuard)
  @Sse('sessions/:id/explain/stream')
  explainStream(
    @CurrentUserId() userId: string,
    @Param('id') sessionId: string,
    @Query('keyword') keywordQuery: string,
  ): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.conversationService.ensureSessionOwnership(
            userId,
            sessionId,
          );
          const keyword = keywordQuery || '';
          if (!keyword.trim()) {
            this.emit(subscriber, {
              type: 'error',
              message: 'keyword 必填',
              done: true,
            });
            subscriber.complete();
            return;
          }

          this.emit(subscriber, {
            type: 'step',
            name: 'load_context',
            status: 'start',
          });
          const ctx = await this.memoryOrchestrator.buildChatContext(
            userId,
            sessionId,
            keyword,
          );
          this.emit(subscriber, {
            type: 'step',
            name: 'load_context',
            status: 'done',
          });

          const recent = ctx.shortTermMessages
            .slice(-6)
            .map((m) => `${m.role}: ${m.content}`)
            .join('\n');
          const system = `你是耐心的学习辅导老师。用户选中了关键词「${keyword}」。请结合对话上下文，用简洁中文解释该概念，可举例。`;
          const messages: ChatMessage[] = [
            { role: 'system', content: system },
            {
              role: 'user',
              content: `对话上下文：\n${recent}\n\n请解释关键词：${keyword}`,
            },
          ];

          this.emit(subscriber, {
            type: 'step',
            name: 'call_llm',
            status: 'start',
          });
          let full = '';
          let started = false;
          for await (const rawDelta of this.agnesLlmService.streamChat(
            messages,
          )) {
            let delta = rawDelta;
            if (!started) {
              delta = delta.replace(/^\s*\n+/, '').replace(/^\n+/, '');
              if (!delta.trim()) continue;
              started = true;
            }
            full += delta;
            this.emit(subscriber, { type: 'delta', delta, done: false });
          }
          full = full
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
          await this.llmUsage.record({
            userId,
            sessionId,
            purpose: 'explain',
            model: process.env.AGNES_MODEL || 'agnes-default',
            promptTokens: estimateTokens(system + keyword),
            completionTokens: estimateTokens(full),
            estimated: true,
          });
          this.emit(subscriber, { type: 'done', done: true, delta: '' });
          subscriber.complete();
        } catch (err: unknown) {
          this.emit(subscriber, {
            type: 'error',
            message: (err as Error).message,
            done: true,
          });
          subscriber.complete();
        }
      })();
    });
  }
}
