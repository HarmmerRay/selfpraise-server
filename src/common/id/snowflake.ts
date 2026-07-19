/**
 * Snowflake ID（64-bit）：时间戳 | worker | sequence
 * API 层一律用十进制 string，避免 JS Number 精度问题。
 */
const EPOCH = 1704067200000n; // 2024-01-01 UTC

export class Snowflake {
  private seq = 0n;
  private lastMs = -1n;

  constructor(private readonly workerId = 1n) {
    if (workerId < 0n || workerId > 1023n) {
      throw new Error('workerId must be 0..1023');
    }
  }

  nextId(): bigint {
    let ms = BigInt(Date.now());
    if (ms === this.lastMs) {
      this.seq = (this.seq + 1n) & 4095n;
      if (this.seq === 0n) {
        while (ms <= this.lastMs) ms = BigInt(Date.now());
      }
    } else {
      this.seq = 0n;
      this.lastMs = ms;
    }
    this.lastMs = ms;
    const ts = ms - EPOCH;
    return (ts << 22n) | (this.workerId << 12n) | this.seq;
  }

  nextIdString(): string {
    return this.nextId().toString();
  }
}

export const snowflake = new Snowflake(
  BigInt(process.env.SNOWFLAKE_WORKER_ID || '1'),
);

/** 路由/JWT 中的 string → Prisma BigInt */
export function bid(id: string | bigint | number): bigint {
  if (typeof id === 'bigint') return id;
  if (typeof id === 'number') return BigInt(id);
  const s = id.trim();
  if (!/^\d+$/.test(s)) {
    throw new Error(`无效的雪花 ID: ${id}`);
  }
  return BigInt(s);
}

export function idStr(id: bigint | string | null | undefined): string | null {
  if (id === null || id === undefined) return null;
  return String(id);
}
