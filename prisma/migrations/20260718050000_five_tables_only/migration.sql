-- Align to db_design: keep only 5 business tables.
-- Drop rejected tables; trim conversation_sessions columns.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Migrate personas.traits → memory_chunks (preference rows + completion marker)
INSERT INTO memory_chunks (id, user_id, memory_type, content, importance, source_ref, created_at, updated_at)
SELECT
  gen_random_uuid()::text,
  p.user_id,
  'preference',
  kv.value,
  0.7,
  'onboarding:trait:' || kv.key,
  NOW(),
  NOW()
FROM personas p
CROSS JOIN LATERAL jsonb_each_text(COALESCE(p.traits::jsonb, '{}'::jsonb)) AS kv(key, value)
WHERE kv.value IS NOT NULL AND btrim(kv.value) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM memory_chunks m
    WHERE m.user_id = p.user_id AND m.source_ref = 'onboarding:trait:' || kv.key
  );

INSERT INTO memory_chunks (id, user_id, memory_type, content, importance, source_ref, created_at, updated_at)
SELECT
  gen_random_uuid()::text,
  p.user_id,
  'preference',
  'completed',
  1.0,
  'onboarding:completed',
  COALESCE(p.onboarding_completed_at, p.updated_at, NOW()),
  NOW()
FROM personas p
WHERE p.onboarding_completed_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM memory_chunks m
    WHERE m.user_id = p.user_id AND m.source_ref = 'onboarding:completed'
  );

-- Migrate notable episodes → experience chunks
INSERT INTO memory_chunks (id, user_id, memory_type, content, importance, source_ref, created_at, updated_at)
SELECT
  gen_random_uuid()::text,
  e.user_id,
  'experience',
  e.title || E'\n' || e.content,
  COALESCE(e.importance_score, 0.5),
  CASE
    WHEN e.source_session_id IS NOT NULL THEN 'session:' || e.source_session_id
    ELSE 'episode:' || e.id
  END,
  COALESCE(e.occurred_at, e.created_at, NOW()),
  NOW()
FROM episodes e
WHERE NOT EXISTS (
  SELECT 1 FROM memory_chunks m
  WHERE m.user_id = e.user_id AND m.source_ref IN ('episode:' || e.id, 'session:' || COALESCE(e.source_session_id, ''))
);

DROP TABLE IF EXISTS conversation_summaries;
DROP TABLE IF EXISTS episodes;
DROP TABLE IF EXISTS personas;

ALTER TABLE conversation_sessions DROP COLUMN IF EXISTS summary;
ALTER TABLE conversation_sessions DROP COLUMN IF EXISTS ended_at;
