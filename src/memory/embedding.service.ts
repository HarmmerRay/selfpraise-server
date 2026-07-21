import { Injectable, Logger } from '@nestjs/common';

/**
 * EMBEDDING_MODE 空 = 关闭向量（不写 embedding、不向量召回）
 * EMBEDDING_MODE=local = Ollama BGE-M3
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly dim: number;
  private readonly mode: string;
  private readonly model: string;
  private readonly ollamaBaseUrl: string;

  constructor() {
    this.mode = (process.env.EMBEDDING_MODE || '').trim().toLowerCase();
    this.dim = parseInt(process.env.EMBEDDING_DIM || '1024', 10);
    this.model = process.env.EMBEDDING_MODEL || 'bge-m3';
    this.ollamaBaseUrl = (
      process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'
    ).replace(/\/$/, '');
  }

  /** 是否启用向量写入/召回 */
  isEnabled(): boolean {
    return this.mode === 'local';
  }

  getDim(): number {
    return this.dim;
  }

  /**
   * 关闭模式返回 null；local 调 Ollama。
   */
  async embed(text: string): Promise<number[] | null> {
    const input = text.trim();
    if (!input || !this.isEnabled()) return null;

    try {
      return await this.embedViaOllama(input);
    } catch (e) {
      this.logger.warn(`Ollama embed failed: ${(e as Error).message}`);
      return null;
    }
  }

  /** pgvector 字面量：'[0.1,0.2,...]' */
  toPgVectorLiteral(vec: number[]): string {
    return `[${vec.map((x) => (Number.isFinite(x) ? x : 0)).join(',')}]`;
  }

  private async embedViaOllama(text: string): Promise<number[]> {
    // 新接口 /api/embed
    const embedUrl = `${this.ollamaBaseUrl}/api/embed`;
    let res = await fetch(embedUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, input: text }),
    });

    if (res.ok) {
      const json = (await res.json()) as {
        embeddings?: number[][];
        embedding?: number[];
      };
      const vec = json.embeddings?.[0] ?? json.embedding;
      if (vec?.length) return this.assertDim(vec);
    }

    // 兼容旧接口 /api/embeddings
    const legacyUrl = `${this.ollamaBaseUrl}/api/embeddings`;
    res = await fetch(legacyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt: text }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Ollama HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as { embedding?: number[] };
    if (!json.embedding?.length) throw new Error('empty embedding from Ollama');
    return this.assertDim(json.embedding);
  }

  private assertDim(vec: number[]): number[] {
    if (vec.length !== this.dim) {
      this.logger.warn(
        `embedding dim ${vec.length} != EMBEDDING_DIM ${this.dim}; using returned dim for this call`,
      );
    }
    return vec;
  }
}
