import { Injectable, Logger } from '@nestjs/common';
import { fakeEmbedding } from './short-term-memory.service';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly dim: number;
  private readonly mode: string;

  constructor() {
    this.dim = parseInt(process.env.EMBEDDING_DIM || '1536', 10);
    this.mode = (process.env.EMBEDDING_MODE || 'fake').toLowerCase();
  }

  async embed(text: string): Promise<number[]> {
    if (this.mode === 'fake' || !process.env.AGNES_API_KEY) {
      return fakeEmbedding(text, this.dim);
    }
    try {
      return await this.embedViaApi(text);
    } catch (e) {
      this.logger.warn(`embedding API failed, fallback fake: ${(e as Error).message}`);
      return fakeEmbedding(text, this.dim);
    }
  }

  private async embedViaApi(text: string): Promise<number[]> {
    const base =
      process.env.AGNES_BASE_URL || 'https://api.agnes-ai.com/v1';
    const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
    const res = await fetch(`${base}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.AGNES_API_KEY}`,
      },
      body: JSON.stringify({ model, input: text }),
    });
    if (!res.ok) {
      throw new Error(`embedding HTTP ${res.status}`);
    }
    const json = (await res.json()) as {
      data?: { embedding: number[] }[];
    };
    const vec = json.data?.[0]?.embedding;
    if (!vec?.length) throw new Error('empty embedding');
    return vec;
  }
}
