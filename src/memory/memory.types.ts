export interface StmMessage {
  role: string;
  content: string;
  messageId?: string;
  createdAt?: string;
}

export interface StmBlob {
  currentLeafId?: string;
  prefixSummary?: string;
  messages: StmMessage[];
}

export interface ChatContext {
  shortTermMessages: { role: string; content: string }[];
  stmPrefixSummary?: string;
  stmMeta: {
    estimatedTokens: number;
    keptCount: number;
    droppedCount: number;
    tokenBudget: number;
  };
  longTermProfile: {
    traits: Record<string, unknown>;
    facets: { type: string; content: string; id?: string }[];
  };
  retrievedMemories: {
    id: string;
    content: string;
    memoryType: string;
    score: number;
  }[];
}

export const STM_KEY_PREFIX = 'hugme:stm:';
export const LTM_CACHE_PREFIX = 'hugme:ltm:';
export const MEMORY_JOBS_KEY = 'hugme:memory:jobs';
export const MEMORY_PROCESSING_KEY = 'hugme:memory:processing';
export const MEMORY_DEDUPE_PREFIX = 'hugme:memory:dedupe:';
/** 管理台聚合结果缓存前缀（Token 等） */
export const ADMIN_METRICS_CACHE_PREFIX = 'hugme:admin:cache:';

export const STM_TTL_SECONDS = 3600;
export const LTM_CACHE_TTL_SECONDS = 1800;
export const DEDUPE_TTL_SECONDS = 86400;
export const STM_MESSAGE_TOKEN_BUDGET = 6000;
export const STM_TARGET_ROUNDS = 10;

export const LTM_FACET_TYPES = [
  'personality',
  'skill',
  'experience',
  'preference',
] as const;

export type LtmFacetType = (typeof LTM_FACET_TYPES)[number];

export type MemoryJobTrigger = 'compress' | 'explicit' | 'compensate';

export interface MemoryJobPayload {
  jobId: string;
  userId: string;
  sessionId: string;
  trigger: MemoryJobTrigger;
  leafId?: string;
  contentFingerprint: string;
  enqueuedAt: string;
}

export function estimateTokens(text: string): number {
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    if (/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(ch)) cjk += 1;
    else other += 1;
  }
  return Math.max(1, Math.ceil(cjk / 1.5 + other / 4));
}

export function estimateMessagesTokens(
  messages: { role: string; content: string }[],
): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content) + 4, 0);
}

export function trimMessagesToTokenBudget(
  messages: { role: string; content: string }[],
  maxTokens: number,
): {
  kept: { role: string; content: string }[];
  dropped: { role: string; content: string }[];
} {
  if (messages.length === 0) return { kept: [], dropped: [] };
  const kept: { role: string; content: string }[] = [];
  let used = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const cost = estimateTokens(msg.content) + 4;
    if (kept.length > 0 && used + cost > maxTokens) {
      return { kept: kept.reverse(), dropped: messages.slice(0, i + 1) };
    }
    kept.push(msg);
    used += cost;
  }
  return { kept: kept.reverse(), dropped: [] };
}

export function buildCompressionSummary(
  dropped: { role: string; content: string }[],
): string {
  if (dropped.length === 0) return '';
  const lines = dropped
    .slice(-8)
    .map((m) => `${m.role}: ${m.content.slice(0, 100)}`);
  return `【当前会话较早对话摘要】共省略 ${dropped.length} 条消息。要点：\n${lines.join('\n')}`;
}

/** Simple stable hash for fingerprint (no crypto dependency in unit tests). */
export function fnv1aHex(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function contentFingerprintFromPath(
  path: {
    id: string;
    role: string;
    content: string;
    updatedAt?: Date | string;
    tokenCount?: number | null;
  }[],
): string {
  const parts = path.map((m) => {
    const len = m.tokenCount ?? m.content.length;
    const ts =
      m.updatedAt instanceof Date
        ? m.updatedAt.getTime()
        : m.updatedAt
          ? new Date(m.updatedAt).getTime()
          : 0;
    return `${m.id}:${m.role}:${len}:${ts}`;
  });
  const raw = parts.join('|');
  return (fnv1aHex(raw) + fnv1aHex(raw.split('').reverse().join(''))).slice(
    0,
    16,
  );
}

export function buildDedupeKey(parts: {
  userId: string;
  sessionId: string;
  trigger: string;
  leafId: string;
  contentFingerprint: string;
}): string {
  return `${parts.userId}:${parts.sessionId}:${parts.trigger}:${parts.leafId}:${parts.contentFingerprint}`;
}

/** Reciprocal Rank Fusion */
export function rrfMerge(
  rankedLists: { id: string; payload: Record<string, unknown> }[][],
  k = 60,
  topN = 5,
): { id: string; score: number; payload: Record<string, unknown> }[] {
  const scores = new Map<
    string,
    { score: number; payload: Record<string, unknown> }
  >();
  for (const list of rankedLists) {
    list.forEach((item, idx) => {
      const add = 1 / (k + idx + 1);
      const prev = scores.get(item.id);
      if (prev) {
        prev.score += add;
      } else {
        scores.set(item.id, { score: add, payload: item.payload });
      }
    });
  }
  return [...scores.entries()]
    .map(([id, v]) => ({ id, score: v.score, payload: v.payload }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

export function titleFromFirstMessage(content: string, max = 64): string {
  const t = content.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + '…';
}
