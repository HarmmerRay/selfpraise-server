# selfpraise-server — Project Operating System (NestJS API + Worker)

## Where this sits

This repository is **HugMe’s backend**. The common parent workspace may also contain `SelfPraise/` (Flutter). Cross-repo norms and mono-repo navigation: **`../AI_HUB.md`**. Canonical engineering baseline: **`../PROJECT_ENGINEERING_STANDARD.md`**.

**Naming:** outward product/domain **HugMe** (`hugme`); Git folder name **`selfpraise-server`** stays as-is unless you deliberately rename repos.

## Mission

- Ship a stable **REST API (`APP_MODE=api`) + async worker (`APP_MODE=worker`)** backbone for HugMe’s companion flows: onboarding / conversation / persona evolution / episodic memory.
- **Queues + idempotent workers first** — LLM/TTS/external IO stay off the synchronous request path wherever possible (Bull + Redis).
- **Modular NestJS structured for future extraction** into separate deployables (bounded contexts), without forcing multi-repo day one.

## Stack (current baseline)

| Layer | Choice |
|------|--------|
| Runtime | Node 20, NestJS ~11 |
| Persistence | PostgreSQL + Prisma; plan **pgvector** in-database for embeddings until scale requires a standalone vector DB |
| Cache / queue | Redis + Bull |
| Containers | Dockerfile / docker-compose (`../k3s` for Kubernetes/K3s YAML) |

## Bounded contexts (evolution targets)

Prefer module boundaries aligned with **`../PROJECT_ENGINEERING_STANDARD.md`**:

- **identity / auth** — JWT send-code/login/refresh/me
- **conversation** — sessions + messages (future primary surface)
- **persona** — structured profile revisions
- **episode** — “what happened to the user” facts derived from multimodal/dialogue flow
- **memory** — chunking + embedding + retrieval (pgvector-phase)
- **ai-orchestration** — postpone heavy frameworks (e.g. LangChain-class) until product demand is explicit

**Legacy:** existing `memo`/`praise` modules are earlier MVP scaffolding — converge new work on the persona/conversation/episode storyline unless deliberately maintaining backward compatibility.

## Engineering rules

- **API versioning:** prefer `/api/v1/...` for public routes going forward so an edge gateway can later route to distinct services unchanged.
- **Auth context:** propagate real `userId` from JWT in all user-scoped services (replace placeholders as you touch code).
- **Secrets:** production values only via Secret / env injection — mirror patterns in **`../k3s/secret.example.yaml`** (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`).
- **Migrations:** `npx prisma migrate deploy` required on each new environment/cluster before relying on writes.
- **Observability (grow as needed):** structured logs → metrics/traces once traffic grows; worker tasks should be observable and retries safe.

## Contract with Flutter

Typed/API contracts (`UiIntent` / streamed responses / future multimodal payloads) **must stay consistent** with `SelfPraise/CLAUDE.md` expectations: don’t bake UI policy only in the client until the roadmap says so.

## Definition of Done (backend slice)

- Prisma/schema + migration when schema changes (or coherent migration notes if split envs).
- DTO validation + guarded routes behave correctly for anon vs JWT paths.
- Worker jobs remain **retry-safe** where external APIs are involved.

## Supporting docs / paths

| Doc | Path |
|-----|------|
| Cross-repo harness | `../AI_HUB.md` |
| Standards | `../PROJECT_ENGINEERING_STANDARD.md` |
| K8s manifests | `../k3s/README.md`, `../k3s/*.yaml` |
| Product depth (intent/UX constraints) | `../SelfPraise/docs/` |
