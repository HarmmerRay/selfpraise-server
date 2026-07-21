-- 语义召回：memory_chunks.embedding（雪花重建表后补回）
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE memory_chunks
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

CREATE INDEX IF NOT EXISTS memory_chunks_content_trgm_idx
  ON memory_chunks USING gin (content gin_trgm_ops);

CREATE INDEX IF NOT EXISTS memory_chunks_embedding_hnsw_idx
  ON memory_chunks USING hnsw (embedding vector_cosine_ops);
