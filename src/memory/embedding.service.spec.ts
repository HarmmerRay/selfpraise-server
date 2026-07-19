import { fakeEmbedding } from './short-term-memory.service';

describe('fakeEmbedding', () => {
  it('returns fixed dim and unit-ish norm', () => {
    const v = fakeEmbedding('你好世界', 32);
    expect(v).toHaveLength(32);
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it('is deterministic', () => {
    expect(fakeEmbedding('abc', 16)).toEqual(fakeEmbedding('abc', 16));
  });
});
