import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
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
import { Observable, Subscriber } from 'rxjs';

/** HugMe：对话会话与消息 */
@Controller('api/v1/conversations')
export class ConversationController {
  private readonly logger = new Logger(ConversationController.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly agnesLlmService: AgnesLlmService,
    private readonly prisma: PrismaService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('sessions')
  async startSession(
    @CurrentUserId() userId: string,
    @Body() dto: StartSessionDto,
  ): Promise<SessionResponseDto> {
    return this.conversationService.startSession(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  async listSessions(
    @CurrentUserId() userId: string,
  ): Promise<SessionResponseDto[]> {
    return this.conversationService.listSessions(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sessions/:id/messages')
  async appendMessage(
    @CurrentUserId() userId: string,
    @Param('id') sessionId: string,
    @Body() dto: AppendMessageDto,
  ): Promise<MessageResponseDto> {
    return this.conversationService.appendMessage(userId, sessionId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sessions/:id/end')
  async endSession(
    @CurrentUserId() userId: string,
    @Param('id') sessionId: string,
    @Body() dto: EndSessionDto,
  ): Promise<SessionResponseDto> {
    return this.conversationService.endSession(userId, sessionId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions/:id/messages')
  async listMessages(
    @CurrentUserId() userId: string,
    @Param('id') sessionId: string,
  ): Promise<MessageResponseDto[]> {
    return this.conversationService.listMessages(userId, sessionId);
  }

  /** SSE 流式 AI 回复端点 */
  @UseGuards(JwtAuthGuard)
  @Sse('sessions/:id/chat/stream')
  chatStream(
    @CurrentUserId() userId: string,
    @Param('id') sessionId: string,
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber: Subscriber<MessageEvent>) => {
      (async () => {
        try {
          // 1. 验证会话归属
          await this.conversationService.ensureSessionOwnership(
            userId,
            sessionId,
          );

          // 2. 加载用户 persona traits
          const persona = await this.prisma.persona.findUnique({
            where: { userId },
          });
          const traits = (persona?.traits as Record<string, string>) ?? null;

          // 3. 加载最近对话历史（多轮上下文）
          const recentMessages =
            await this.conversationService.loadRecentMessages(sessionId, 20);

          // 4. 组装发送给 Agnes AI 的 messages
          const systemPrompt = this.agnesLlmService.buildSystemPrompt(traits);
          const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            ...recentMessages.map((m) => ({
              role: m.role as ChatMessage['role'],
              content: m.content,
            })),
          ];

          // 5. 流式调用 Agnes AI
          let fullContent = '';
          const stream = this.agnesLlmService.streamChat(messages);

          for await (const delta of stream) {
            fullContent += delta;
            subscriber.next(
              new MessageEvent('message', {
                data: JSON.stringify({ delta, done: false }),
              }),
            );
          }

          // 6. 流结束，持久化完整回复
          let savedId = '';
          if (fullContent) {
            const saved =
              await this.conversationService.saveAssistantMessage(
                userId,
                sessionId,
                fullContent,
              );
            savedId = saved.id;
          }

          // 7. 发送完成事件
          subscriber.next(
            new MessageEvent('message', {
              data: JSON.stringify({ delta: '', done: true, messageId: savedId }),
            }),
          );
          subscriber.complete();
        } catch (err: unknown) {
          this.logger.error(`chatStream 错误: ${(err as Error).message}`);
          subscriber.next(
            new MessageEvent('message', {
              data: JSON.stringify({
                error: true,
                message: (err as Error).message ?? 'AI 服务异常',
                done: true,
              }),
            }),
          );
          subscriber.complete();
        }
      })();
    });
  }
}
