-- 对齐 db_design.md：清空并重建 5 张表，主键雪花 BIGINT，TIMESTAMPTZ。
-- 开发环境允许丢数据。

CREATE EXTENSION IF NOT EXISTS pg_trgm;

DROP TABLE IF EXISTS llm_usage CASCADE;
DROP TABLE IF EXISTS memory_chunks CASCADE;
DROP TABLE IF EXISTS conversation_messages CASCADE;
DROP TABLE IF EXISTS conversation_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 可选：旧向量扩展不再被业务表使用（保留扩展无害）
-- DROP EXTENSION IF EXISTS vector;

CREATE TABLE users (
  id         BIGINT PRIMARY KEY,
  phone      VARCHAR(20) NOT NULL UNIQUE,
  nickname   VARCHAR(64),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE conversation_sessions (
  id               BIGINT PRIMARY KEY,
  user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel          VARCHAR(16) NOT NULL,
  current_leaf_id  BIGINT,
  title            VARCHAR(64),
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX conversation_sessions_user_id_last_message_at_idx
  ON conversation_sessions (user_id, last_message_at DESC);
CREATE INDEX conversation_sessions_user_id_archived_at_idx
  ON conversation_sessions (user_id, archived_at);

CREATE TABLE conversation_messages (
  id                 BIGINT PRIMARY KEY,
  session_id         BIGINT NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  user_id            BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_message_id  BIGINT REFERENCES conversation_messages(id) ON DELETE SET NULL,
  role               VARCHAR(16) NOT NULL,
  content            TEXT NOT NULL DEFAULT '',
  status             VARCHAR(16) NOT NULL DEFAULT 'completed',
  intent_json        JSONB,
  token_count        INTEGER,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX conversation_messages_session_id_parent_message_id_idx
  ON conversation_messages (session_id, parent_message_id);
CREATE INDEX conversation_messages_parent_message_id_idx
  ON conversation_messages (parent_message_id);
CREATE INDEX conversation_messages_session_id_created_at_idx
  ON conversation_messages (session_id, created_at);
CREATE INDEX conversation_messages_user_id_created_at_idx
  ON conversation_messages (user_id, created_at DESC);

ALTER TABLE conversation_sessions
  ADD CONSTRAINT conversation_sessions_current_leaf_id_fkey
  FOREIGN KEY (current_leaf_id) REFERENCES conversation_messages(id) ON DELETE SET NULL;

CREATE TABLE memory_chunks (
  id          BIGINT PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  memory_type VARCHAR(32) NOT NULL,
  content     TEXT NOT NULL,
  importance  REAL NOT NULL DEFAULT 0.5,
  source_ref  VARCHAR(128),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX memory_chunks_user_id_memory_type_idx
  ON memory_chunks (user_id, memory_type);
CREATE INDEX memory_chunks_user_id_importance_created_at_idx
  ON memory_chunks (user_id, importance DESC, created_at DESC);

CREATE TABLE llm_usage (
  id                 BIGINT PRIMARY KEY,
  user_id            BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id         BIGINT REFERENCES conversation_sessions(id) ON DELETE SET NULL,
  purpose            VARCHAR(32) NOT NULL,
  model              VARCHAR(64) NOT NULL,
  prompt_tokens      INTEGER NOT NULL DEFAULT 0,
  completion_tokens  INTEGER NOT NULL DEFAULT 0,
  total_tokens       INTEGER NOT NULL DEFAULT 0,
  estimated          BOOLEAN NOT NULL DEFAULT false,
  request_id         VARCHAR(128),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX llm_usage_user_id_created_at_idx ON llm_usage (user_id, created_at DESC);
CREATE INDEX llm_usage_created_at_idx ON llm_usage (created_at);
CREATE INDEX llm_usage_purpose_created_at_idx ON llm_usage (purpose, created_at);
CREATE INDEX llm_usage_session_id_created_at_idx ON llm_usage (session_id, created_at);
