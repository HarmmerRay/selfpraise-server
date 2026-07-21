/** 从对话提炼的具体经历（落库 memory_type=experience） */
export interface ExtractedExperience {
  /** 一句完整、可复用的事实陈述（不含「会话要点」类摘要） */
  content: string;
  /** 0.4–0.95 */
  importance: number;
}

const EXPERIENCE_HINT =
  /搬|搬家|换(了|过)?工作|离职|入职|毕业|高考|考研|结婚|离婚|分手|恋爱|生子|生病|住院|手术|出国|留学|定居|创业|失业|升职|调岗|跳槽|买房|租房|怀孕|丧|去世|考上|拿了offer|转行/i;

export function normalizeExperienceContent(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[-*•]\s*/, '')
    .replace(/^(用户|我)(曾经|之前|当时)?/, '')
    .trim()
    .slice(0, 280);
}

export function clampImportance(n: unknown, fallback = 0.65): number {
  const x = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(0.95, Math.max(0.4, x));
}

export function buildExperienceExtractMessages(transcript: string): {
  role: 'system' | 'user';
  content: string;
}[] {
  return [
    {
      role: 'system',
      content: `你是 HugMe 记忆提炼器。只从对话中抽取用户的【具体人生经历】。

必须抽取：已发生的事实事件或背景经历（工作变动、搬家、学业、关系、健康、重大决定等）。
禁止抽取：性格评价、口味/沟通偏好、本次会话摘要、AI 说的话、空洞鼓励。

输出严格 JSON（不要 markdown）：
{"experiences":[{"content":"一句完整事实","importance":0.4到0.95}]}
content 要求：独立可复用、第三人称或无主语陈述，如「去年从北京搬到上海做产品经理」。无经历时返回 {"experiences":[]}。最多 5 条。`,
    },
    {
      role: 'user',
      content: `对话记录：\n${transcript}`,
    },
  ];
}

export function parseExperienceExtractResponse(
  text: string,
): ExtractedExperience[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  let jsonText = trimmed;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonText = fence[1].trim();
  const brace = jsonText.match(/\{[\s\S]*\}/);
  if (brace) jsonText = brace[0];

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }

  const list = (parsed as { experiences?: unknown })?.experiences;
  if (!Array.isArray(list)) return [];

  const out: ExtractedExperience[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const content = normalizeExperienceContent(
      String((item as { content?: unknown }).content ?? ''),
    );
    if (content.length < 6) continue;
    if (isSessionDigestNoise(content)) continue;
    const key = content.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      content,
      importance: clampImportance((item as { importance?: unknown }).importance),
    });
    if (out.length >= 5) break;
  }
  return out;
}

/** 无 LLM 时的弱启发式：只从用户句里抓「经历线索」句，宁缺毋滥 */
export function heuristicExtractExperiences(
  messages: { role: string; content: string }[],
): ExtractedExperience[] {
  const out: ExtractedExperience[] = [];
  const seen = new Set<string>();
  for (const m of messages) {
    if (m.role !== 'user') continue;
    const content = normalizeExperienceContent(m.content);
    if (content.length < 8 || content.length > 200) continue;
    if (!EXPERIENCE_HINT.test(content)) continue;
    if (isSessionDigestNoise(content)) continue;
    const key = content.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ content, importance: 0.6 });
    if (out.length >= 3) break;
  }
  return out;
}

export function isNearDuplicateExperience(
  candidate: string,
  existing: string[],
): boolean {
  const a = normalizeExperienceContent(candidate).toLowerCase();
  if (!a) return true;
  for (const e of existing) {
    const b = normalizeExperienceContent(e).toLowerCase();
    if (!b) continue;
    if (a === b) return true;
    if (a.includes(b) || b.includes(a)) return true;
    if (jaccardBigrams(a, b) >= 0.72) return true;
  }
  return false;
}

function isSessionDigestNoise(content: string): boolean {
  return (
    content.includes('会话要点') ||
    content.includes('当前会话较早对话摘要') ||
    content.startsWith('user:') ||
    content.startsWith('assistant:')
  );
}

function jaccardBigrams(a: string, b: string): number {
  const ba = bigrams(a);
  const bb = bigrams(b);
  if (ba.size === 0 || bb.size === 0) return 0;
  let inter = 0;
  for (const x of ba) if (bb.has(x)) inter += 1;
  return inter / (ba.size + bb.size - inter);
}

function bigrams(s: string): Set<string> {
  const set = new Set<string>();
  const t = s.replace(/\s/g, '');
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
  return set;
}

export function formatTranscriptForExtract(
  messages: { role: string; content: string }[],
  maxMessages = 24,
): string {
  return messages
    .slice(-maxMessages)
    .map((m) => `${m.role}: ${m.content.slice(0, 400)}`)
    .join('\n')
    .slice(0, 6000);
}
