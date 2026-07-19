-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Conversation sessions: new columns
ALTER TABLE "conversation_sessions" ADD COLUMN IF NOT EXISTS "title" VARCHAR(64);
ALTER TABLE "conversation_sessions" ADD COLUMN IF NOT EXISTS "current_leaf_id" TEXT;
ALTER TABLE "conversation_sessions" ADD COLUMN IF NOT EXISTS "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "conversation_sessions" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);

UPDATE "conversation_sessions" SET "last_message_at" = COALESCE("updated_at", "started_at", CURRENT_TIMESTAMP)
WHERE "last_message_at" IS NULL;

CREATE INDEX IF NOT EXISTS "conversation_sessions_user_id_last_message_at_idx"
  ON "conversation_sessions"("user_id", "last_message_at");
CREATE INDEX IF NOT EXISTS "conversation_sessions_user_id_archived_at_idx"
  ON "conversation_sessions"("user_id", "archived_at");

-- Conversation messages: tree + status
ALTER TABLE "conversation_messages" ADD COLUMN IF NOT EXISTS "parent_message_id" TEXT;
ALTER TABLE "conversation_messages" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE "conversation_messages" ADD COLUMN IF NOT EXISTS "token_count" INTEGER;
ALTER TABLE "conversation_messages" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$ BEGIN
  ALTER TABLE "conversation_messages"
    ADD CONSTRAINT "conversation_messages_parent_message_id_fkey"
    FOREIGN KEY ("parent_message_id") REFERENCES "conversation_messages"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "conversation_messages_session_id_parent_message_id_idx"
  ON "conversation_messages"("session_id", "parent_message_id");
CREATE INDEX IF NOT EXISTS "conversation_messages_parent_message_id_idx"
  ON "conversation_messages"("parent_message_id");

-- Memory chunks: embedding + updated_at
ALTER TABLE "memory_chunks" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);
ALTER TABLE "memory_chunks" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "memory_chunks_user_id_importance_created_at_idx"
  ON "memory_chunks"("user_id", "importance", "created_at");

CREATE INDEX IF NOT EXISTS "memory_chunks_content_trgm_idx"
  ON "memory_chunks" USING GIN ("content" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "memory_chunks_embedding_hnsw_idx"
  ON "memory_chunks" USING hnsw ("embedding" vector_cosine_ops);

-- llm_usage
CREATE TABLE IF NOT EXISTS "llm_usage" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "session_id" TEXT,
  "purpose" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
  "completion_tokens" INTEGER NOT NULL DEFAULT 0,
  "total_tokens" INTEGER NOT NULL DEFAULT 0,
  "estimated" BOOLEAN NOT NULL DEFAULT false,
  "request_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "llm_usage_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "llm_usage"
    ADD CONSTRAINT "llm_usage_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "llm_usage_user_id_created_at_idx" ON "llm_usage"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "llm_usage_created_at_idx" ON "llm_usage"("created_at");
CREATE INDEX IF NOT EXISTS "llm_usage_purpose_created_at_idx" ON "llm_usage"("purpose", "created_at");
CREATE INDEX IF NOT EXISTS "llm_usage_session_id_created_at_idx" ON "llm_usage"("session_id", "created_at");
