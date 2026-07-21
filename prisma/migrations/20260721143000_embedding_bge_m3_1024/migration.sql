-- BGE-M3 维度 1024：重建 embedding 列与 HNSW
DROP INDEX IF EXISTS memory_chunks_embedding_hnsw_idx;
ALTER TABLE memory_chunks DROP COLUMN IF EXISTS embedding;
ALTER TABLE memory_chunks ADD COLUMN embedding vector(1024);
CREATE INDEX memory_chunks_embedding_hnsw_idx
  ON memory_chunks USING hnsw (embedding vector_cosine_ops);
