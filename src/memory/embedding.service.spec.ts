import { EmbeddingService } from './embedding.service';

describe('EmbeddingService', () => {
  const prevMode = process.env.EMBEDDING_MODE;

  afterEach(() => {
    if (prevMode === undefined) delete process.env.EMBEDDING_MODE;
    else process.env.EMBEDDING_MODE = prevMode;
  });

  it('isEnabled is false when EMBEDDING_MODE empty', () => {
    delete process.env.EMBEDDING_MODE;
    const svc = new EmbeddingService();
    expect(svc.isEnabled()).toBe(false);
  });

  it('isEnabled is true when EMBEDDING_MODE=local', () => {
    process.env.EMBEDDING_MODE = 'local';
    const svc = new EmbeddingService();
    expect(svc.isEnabled()).toBe(true);
  });

  it('embed returns null when disabled', async () => {
    delete process.env.EMBEDDING_MODE;
    const svc = new EmbeddingService();
    await expect(svc.embed('你好')).resolves.toBeNull();
  });

  it('formats pgvector literal', () => {
    process.env.EMBEDDING_MODE = '';
    const svc = new EmbeddingService();
    expect(svc.toPgVectorLiteral([0.1, 0.2])).toBe('[0.1,0.2]');
  });
});
