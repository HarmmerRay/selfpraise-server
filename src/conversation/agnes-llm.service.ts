import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpMetricsService } from '../common/metrics/http-metrics.service';

/** 单条消息的结构，与 OpenAI Chat Completions 兼容 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** 流式分片：思考过程 vs 正式回复 */
export type StreamChunk =
  | { kind: 'thinking'; text: string }
  | { kind: 'content'; text: string };

/** Agnes AI 用户画像 traits 中可用的 key */
interface PersonaTraits {
  companionTone?: string;
  stressSupportPreference?: string;
  recentFocus?: string;
  celebratedSmallWin?: string;
  interactionTimePreference?: string;
  riskNote?: string;
}

@Injectable()
export class AgnesLlmService {
  private readonly logger = new Logger(AgnesLlmService.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly viaGateway: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly metrics: HttpMetricsService,
  ) {
    const gatewayUrl = (
      this.configService.get<string>('llm.baseUrl', '') || ''
    ).trim();
    this.viaGateway = Boolean(gatewayUrl);
    if (this.viaGateway) {
      this.baseUrl = gatewayUrl.replace(/\/$/, '');
      this.apiKey =
        this.configService.get<string>('llm.apiKey', '') ||
        'sk-hugme-litellm';
      this.model =
        this.configService.get<string>('llm.model', '') || 'hugme-agnes';
    } else {
      this.apiKey = this.configService.get<string>('agnes.apiKey', '');
      this.model = this.configService.get<string>(
        'agnes.model',
        'agnes-2.0-flash',
      );
      this.baseUrl = this.configService.get<string>(
        'agnes.baseUrl',
        'https://apihub.agnes-ai.com/v1',
      );
    }
  }

  /**
   * 根据 persona traits 构建系统提示词。
   * 如果 traits 为空，使用合理的默认值。
   */
  buildSystemPrompt(traits: PersonaTraits | null | undefined): string {
    const t = traits ?? {};
    const tone = t.companionTone ?? '温柔自然';
    const stress = t.stressSupportPreference ?? '安慰和理解';
    const focus = t.recentFocus ?? '综合生活';
    const avoid = t.riskNote;

    let prompt = `你是 HugMe 的温暖陪伴助手。你的角色是倾听用户、给予真诚鼓励、帮助用户看到自己的闪光点。

【用户偏好】
- 语气风格: ${tone}
- 压力时的回应方式: ${stress}
- 最近关注: ${focus}

【行为准则】
- 像一个关心你的朋友，不要像心理咨询师或教练那样正式
- 回复简洁自然（通常2-4句话），不要过度分析
- 如果用户表达负面情绪，先共情再鼓励
- 适当使用具体细节，不要泛泛而谈
- 如果用户分享成就，真诚庆祝`;

    if (avoid) {
      prompt += `\n- 需要注意：${avoid}`;
    }

    return prompt;
  }

  getModelName(): string {
    return this.model;
  }

  private isFakeMode(): boolean {
    const llmMode =
      this.configService.get<string>('LLM_MODE', '') ||
      process.env.LLM_MODE ||
      '';
    return (!this.apiKey && !this.viaGateway) || llmMode === 'fake';
  }

  private secondsSince(startNs: bigint): number {
    return Number(process.hrtime.bigint() - startNs) / 1e9;
  }

  /**
   * 非流式补全（记忆提炼等）。fake 模式返回空内容，由调用方走启发式。
   */
  async completeChat(
    messages: ChatMessage[],
    options?: { temperature?: number },
  ): Promise<{
    content: string;
    promptTokens?: number;
    completionTokens?: number;
  }> {
    if (this.isFakeMode()) {
      this.metrics.observeLlm('complete', 'fake', 'total', 0);
      return { content: '', promptTokens: 0, completionTokens: 0 };
    }

    const start = process.hrtime.bigint();
    let status: 'ok' | 'error' = 'ok';
    try {
      const url = `${this.baseUrl}/chat/completions`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
          temperature: options?.temperature ?? 0.2,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.error(`LLM 返回错误: ${response.status} ${text}`);
        throw new Error(`LLM API 错误: ${response.status}`);
      }

      const json = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      return {
        content: json.choices?.[0]?.message?.content?.trim() ?? '',
        promptTokens: json.usage?.prompt_tokens,
        completionTokens: json.usage?.completion_tokens,
      };
    } catch (err) {
      status = 'error';
      throw err;
    } finally {
      this.metrics.observeLlm(
        'complete',
        status,
        'total',
        this.secondsSince(start),
      );
    }
  }

  /**
   * 流式调用 Chat Completions。
   * 产出 thinking（CoT）与 content；兼容 reasoning_content / &lt;think&gt; 标签。
   */
  async *streamChat(messages: ChatMessage[]): AsyncGenerator<StreamChunk> {
    if (this.isFakeMode()) {
      const lastUser = [...messages].reverse().find((m) => m.role === 'user');
      const hint = (lastUser?.content ?? '').slice(0, 40);
      const thinking = `先理解用户在说什么：「${hint || '分享'}」，再给一句真诚回应。`;
      for (const part of thinking.match(/.{1,16}/g) ?? [thinking]) {
        yield { kind: 'thinking', text: part };
      }
      const text =
        hint.includes('解释') || hint.includes('关键词')
          ? `（开发假回复）这个词可以理解为对话里提到的核心概念。结合你刚才说的内容：「${hint}」——先抓住定义，再想一个小例子就够用了。`
          : `（开发假回复）我听到了：「${hint || '你的分享'}」。先肯定你愿意开口这件事本身，就已经很棒了。想继续聊聊细节吗？`;
      for (const part of text.match(/.{1,12}/g) ?? [text]) {
        yield { kind: 'content', text: part };
      }
      this.metrics.observeLlm('stream', 'fake', 'ttft', 0);
      this.metrics.observeLlm('stream', 'fake', 'total', 0);
      return;
    }

    const url = `${this.baseUrl}/chat/completions`;
    const body = {
      model: this.model,
      messages,
      stream: true,
      temperature: 0.7,
    };

    this.logger.debug(
      `调用 LLM: gateway=${this.viaGateway} model=${this.model}, messages=${messages.length}`,
    );

    const start = process.hrtime.bigint();
    let status: 'ok' | 'error' = 'ok';
    let sawFirst = false;
    let inThinkTag = false;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.error(`LLM 返回错误: ${response.status} ${text}`);
        throw new Error(`LLM API 错误: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('LLM 响应体为空');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            const data = trimmed.slice(6);
            if (data === '[DONE]') return;

            try {
              const parsed = JSON.parse(data) as {
                choices?: {
                  delta?: {
                    content?: string;
                    reasoning_content?: string;
                    reasoning?: string;
                  };
                }[];
              };
              const delta = parsed.choices?.[0]?.delta;
              if (!delta) continue;

              const reasoning =
                delta.reasoning_content ?? delta.reasoning ?? '';
              if (reasoning) {
                if (!sawFirst) {
                  sawFirst = true;
                  this.metrics.observeLlm(
                    'stream',
                    'ok',
                    'ttft',
                    this.secondsSince(start),
                  );
                }
                yield { kind: 'thinking', text: reasoning };
              }

              const content = delta.content ?? '';
              if (!content) continue;

              for (const chunk of this.splitContentWithThinkTags(
                content,
                () => inThinkTag,
                (v) => {
                  inThinkTag = v;
                },
              )) {
                if (!sawFirst) {
                  sawFirst = true;
                  this.metrics.observeLlm(
                    'stream',
                    'ok',
                    'ttft',
                    this.secondsSince(start),
                  );
                }
                yield chunk;
              }
            } catch {
              // 跳过无法解析的行
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (err) {
      status = 'error';
      throw err;
    } finally {
      this.metrics.observeLlm(
        'stream',
        status,
        'total',
        this.secondsSince(start),
      );
    }
  }

  /** 把 content 里的 &lt;think&gt;...&lt;/think&gt; 拆成 thinking / content */
  private *splitContentWithThinkTags(
    content: string,
    getInThink: () => boolean,
    setInThink: (v: boolean) => void,
  ): Generator<StreamChunk> {
    let rest = content;
    let inThink = getInThink();
    while (rest.length > 0) {
      if (inThink) {
        const end = rest.indexOf('</think>');
        if (end < 0) {
          yield { kind: 'thinking', text: rest };
          setInThink(true);
          return;
        }
        if (end > 0) {
          yield { kind: 'thinking', text: rest.slice(0, end) };
        }
        rest = rest.slice(end + '</think>'.length);
        inThink = false;
        setInThink(false);
        continue;
      }
      const start = rest.indexOf('<think>');
      if (start < 0) {
        yield { kind: 'content', text: rest };
        return;
      }
      if (start > 0) {
        yield { kind: 'content', text: rest.slice(0, start) };
      }
      rest = rest.slice(start + '<think>'.length);
      inThink = true;
      setInThink(true);
    }
  }
}
