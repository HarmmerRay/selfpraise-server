-- Context STM 压缩摘要持久化：未压缩过为 NULL
ALTER TABLE "conversation_sessions" ADD COLUMN "digest" TEXT;
