import {
  heuristicExtractExperiences,
  isNearDuplicateExperience,
  normalizeExperienceContent,
  parseExperienceExtractResponse,
} from './experience-extract';

describe('experience-extract', () => {
  it('parses JSON experiences and drops noise', () => {
    const raw = `\`\`\`json
{"experiences":[
  {"content":"去年从北京搬到上海做产品经理","importance":0.8},
  {"content":"会话要点（compress）：user: hi","importance":0.9},
  {"content":"ok","importance":0.5}
]}
\`\`\``;
    const got = parseExperienceExtractResponse(raw);
    expect(got).toEqual([
      { content: '去年从北京搬到上海做产品经理', importance: 0.8 },
    ]);
  });

  it('heuristic only keeps user experience-like lines', () => {
    const got = heuristicExtractExperiences([
      { role: 'assistant', content: '你最近搬了吗？' },
      { role: 'user', content: '今天天气不错' },
      { role: 'user', content: '我上个月离职了，正在找新工作' },
    ]);
    expect(got).toHaveLength(1);
    expect(got[0].content).toContain('离职');
  });

  it('detects near-duplicate experiences', () => {
    const existing = ['去年从北京搬到上海做产品经理'];
    expect(
      isNearDuplicateExperience('去年从北京搬到上海做产品经理', existing),
    ).toBe(true);
    expect(
      isNearDuplicateExperience('去年从北京搬到上海，做产品经理', existing),
    ).toBe(true);
    expect(isNearDuplicateExperience('大学在杭州读计算机', existing)).toBe(
      false,
    );
  });

  it('normalizes content', () => {
    expect(normalizeExperienceContent('  用户曾经  换了工作  ')).toBe(
      '换了工作',
    );
  });
});
