import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { RedisService } from '../common/redis/redis.service';
import {
  LTM_CACHE_PREFIX,
  LTM_CACHE_TTL_SECONDS,
  StmBlob,
  StmMessage,
  STM_KEY_PREFIX,
  STM_TTL_SECONDS,
} from './memory.types';

@Injectable()
export class ShortTermMemoryService {
  constructor(private readonly redis: RedisService) {}

  private key(sessionId: string): string {
    return `${STM_KEY_PREFIX}${sessionId}`;
  }

  async getBlob(sessionId: string): Promise<StmBlob | null> {
    const raw = await this.redis.get(this.key(sessionId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StmBlob;
    } catch {
      return null;
    }
  }

  async saveBlob(sessionId: string, blob: StmBlob): Promise<void> {
    await this.redis.set(
      this.key(sessionId),
      JSON.stringify(blob),
      'EX',
      STM_TTL_SECONDS,
    );
  }

  async touch(sessionId: string): Promise<void> {
    await this.redis.expire(this.key(sessionId), STM_TTL_SECONDS);
  }

  async appendMessage(
    sessionId: string,
    message: StmMessage,
    currentLeafId?: string,
  ): Promise<StmBlob> {
    const blob = (await this.getBlob(sessionId)) ?? {
      messages: [],
      prefixSummary: undefined,
      currentLeafId: undefined,
    };
    blob.messages.push(message);
    if (currentLeafId) blob.currentLeafId = currentLeafId;
    await this.saveBlob(sessionId, blob);
    return blob;
  }

  async clear(sessionId: string): Promise<void> {
    await this.redis.del(this.key(sessionId));
  }
}

@Injectable()
export class LtmCacheService {
  constructor(private readonly redis: RedisService) {}

  private key(userId: string): string {
    return `${LTM_CACHE_PREFIX}${userId}`;
  }

  async get(userId: string): Promise<string | null> {
    return this.redis.get(this.key(userId));
  }

  async set(userId: string, json: string): Promise<void> {
    await this.redis.set(this.key(userId), json, 'EX', LTM_CACHE_TTL_SECONDS);
  }

  async del(userId: string): Promise<void> {
    await this.redis.del(this.key(userId));
  }
}

/** Deterministic fake embedding for EMBEDDING_MODE=fake */
export function fakeEmbedding(text: string, dim = 1536): number[] {
  const out = new Array<number>(dim).fill(0);
  const hash = createHash('sha256').update(text).digest();
  for (let i = 0; i < dim; i++) {
    out[i] = ((hash[i % hash.length] / 255) * 2 - 1) * (1 / Math.sqrt(dim));
  }
  // L2 normalize
  let norm = Math.sqrt(out.reduce((s, v) => s + v * v, 0)) || 1;
  return out.map((v) => v / norm);
}

export function vectorToSqlLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}
