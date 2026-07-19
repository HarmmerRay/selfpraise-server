import {
  buildDedupeKey,
  contentFingerprintFromPath,
  fnv1aHex,
  rrfMerge,
  titleFromFirstMessage,
  trimMessagesToTokenBudget,
} from './memory.types';

describe('memory.types', () => {
  it('fnv1aHex is stable', () => {
    expect(fnv1aHex('hello')).toBe(fnv1aHex('hello'));
    expect(fnv1aHex('a')).not.toBe(fnv1aHex('b'));
  });

  it('contentFingerprint changes when path changes', () => {
    const a = contentFingerprintFromPath([
      { id: '1', role: 'user', content: 'hi', updatedAt: new Date(1) },
    ]);
    const b = contentFingerprintFromPath([
      { id: '1', role: 'user', content: 'hi!', updatedAt: new Date(1) },
    ]);
    expect(a).toHaveLength(16);
    expect(a).not.toBe(b);
  });

  it('buildDedupeKey joins parts', () => {
    expect(
      buildDedupeKey({
        userId: 'u',
        sessionId: 's',
        trigger: 'compress',
        leafId: 'l',
        contentFingerprint: 'abcd',
      }),
    ).toBe('u:s:compress:l:abcd');
  });

  it('rrfMerge prefers items appearing in both lists', () => {
    const merged = rrfMerge(
      [
        [
          { id: 'a', payload: { content: 'A' } },
          { id: 'b', payload: { content: 'B' } },
        ],
        [
          { id: 'b', payload: { content: 'B' } },
          { id: 'c', payload: { content: 'C' } },
        ],
      ],
      60,
      3,
    );
    expect(merged[0].id).toBe('b');
  });

  it('trimMessagesToTokenBudget keeps recent messages', () => {
    const msgs = [
      { role: 'user', content: 'a'.repeat(100) },
      { role: 'assistant', content: 'b'.repeat(100) },
      { role: 'user', content: 'c'.repeat(20) },
    ];
    const { kept, dropped } = trimMessagesToTokenBudget(msgs, 30);
    expect(kept.length).toBeGreaterThan(0);
    expect(kept[kept.length - 1].content.startsWith('c')).toBe(true);
    expect(dropped.length + kept.length).toBe(msgs.length);
  });

  it('titleFromFirstMessage truncates', () => {
    expect(titleFromFirstMessage('短')).toBe('短');
    expect(titleFromFirstMessage('x'.repeat(80)).length).toBe(64);
  });
});
