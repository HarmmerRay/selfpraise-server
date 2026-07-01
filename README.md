# SelfPraise Server

> 愿景：让自己更成为自己  
> 对外产品与域名：**HugMe**（`hugme`）；仓库目录名为 **`selfpraise-server`**。

HugMe 后端 —— 负责用户认证、画像管理、对话陪伴、事件记忆与 AI 流式回复，为 [SelfPraise Flutter 客户端](https://github.com/HarmmerRay/SelfPraise) 提供 API 服务。

## 产品简介

HugMe 是一个 **Agent 原生的个人成长陪伴系统**。当前 MVP 聚焦：

1. **注册后初见问答** — 快速建立初版用户画像（`Persona`）
2. **持续对话** — 文字 / 语音 / 视频渠道（当前已打通文字 + SSE 流式 AI）
3. **事件沉淀** — 从对话中记录用户身上发生的事（`Episode`）
4. **个性化陪伴** — 基于画像 traits 动态构建 prompt，生成有温度的回复

长期方向仍是多 Agent 编排、`UiIntent` 驱动前端、语义记忆（pgvector/RAG），但**已移除**早期「备忘录 → 夸赞生成 → TTS 播放」链路。

### Agent 原生后端要求

- 稳定：超时、重试、幂等、降级、限流、明确错误边界
- 类型化输出：逐步从纯文本回复演进为 `UiIntent` / `VoiceIntent` / `TaskIntent`
- 可观测：request id、用户状态、参与模块、输入输出可追溯
- 安全：心理、健康等高影响领域需保守措辞与免责声明

### 当前核心链路

```
注册/登录 → 初见问答 → Persona.traits
                ↓
         开启 ConversationSession
                ↓
    用户消息 → SSE 流式 AI 回复（Agnes AI，按 persona 个性化）
                ↓
    异步沉淀 Episode / MemoryChunk（规划中）
```

## 技术栈

| 类别 | 选型 | 说明 |
|------|------|------|
| 语言/框架 | **NestJS 11 (TypeScript)** | 模块化 API 服务 |
| 数据库 | **PostgreSQL 16 + Prisma 5** | 结构化存储；后续 pgvector 一库两用 |
| 缓存 | **Redis 7** | 验证码、会话缓存 |
| LLM | **Agnes AI** | SSE 流式对话（`agnes-2.0-flash`） |
| 认证 | **JWT 双 token** | 手机号验证码登录（开发模式固定码） |
| 容器 | **Docker Compose** | 本地 postgres + redis；生产单 API 镜像 |

> 异步 Worker（Bull 队列、TTS、记忆压缩等）已从当前代码移除，待产品需要时再按模块边界重新引入。

## 项目结构

```
selfpraise-server/
├── src/
│   ├── auth/                 # 手机号验证码 + JWT
│   ├── persona/              # 用户画像 CRUD、onboarding 完成标记
│   ├── conversation/         # 会话、消息、SSE 流式 AI（AgnesLlmService）
│   ├── episode/              # 用户事件记录
│   ├── common/redis/         # Redis 封装
│   ├── prisma/               # PrismaService
│   ├── config/               # 配置管理
│   ├── app.module.ts
│   └── main.ts               # API 入口
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── docker-compose.yml        # PostgreSQL + Redis（prod profile 含 API）
├── Dockerfile
├── docker-scripts/           # build / push / deploy / clean
├── package.json
└── README.md
```

## 数据库设计

### users（用户）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| phone | VARCHAR | 手机号（唯一） |
| nickname | VARCHAR | 昵称（可选） |
| avatar_url | VARCHAR | 头像（可选） |
| created_at / updated_at | TIMESTAMP | 时间戳 |

### personas（用户画像）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 关联用户（唯一） |
| traits | JSONB | 画像字段（语气偏好、压力回应、近期关注等） |
| confidence_score | FLOAT | 画像置信度 |
| onboarding_completed_at | TIMESTAMP | 初见完成时间 |

### conversation_sessions / conversation_messages

| 表 | 说明 |
|----|------|
| conversation_sessions | 会话（channel: text/voice/video，summary，起止时间） |
| conversation_messages | 消息（role: user/assistant/system，content，intent_json） |

### episodes（用户事件）

| 字段 | 类型 | 说明 |
|------|------|------|
| title / content | TEXT | 事件标题与内容 |
| emotion_tag | VARCHAR | 情绪标签 |
| importance_score | FLOAT | 重要度 0–1 |
| occurred_at | TIMESTAMP | 发生时间 |
| source_session_id | UUID | 来源会话（可选） |

### memory_chunks（语义记忆，表已建，向量检索待接）

| 字段 | 类型 | 说明 |
|------|------|------|
| memory_type | VARCHAR | episode / goal / emotion / preference |
| content | TEXT | 记忆原文 |
| importance | FLOAT | 重要度 |

## API 设计

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/send-code` | 发送验证码 |
| POST | `/api/auth/login` | 登录，返回 access + refresh token |
| POST | `/api/auth/refresh` | 刷新 token |
| GET | `/api/auth/me` | 当前用户信息 |

### 画像

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/persona/me` | 获取当前用户画像 |
| PATCH | `/api/v1/persona/me` | 更新 traits / 标记 onboarding 完成 |

### 对话

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/conversations/sessions` | 创建会话 |
| GET | `/api/v1/conversations/sessions` | 会话列表 |
| POST | `/api/v1/conversations/sessions/:id/messages` | 追加消息 |
| GET | `/api/v1/conversations/sessions/:id/messages` | 消息列表 |
| POST | `/api/v1/conversations/sessions/:id/end` | 结束会话 |
| GET (SSE) | `/api/v1/conversations/sessions/:id/chat/stream` | 流式 AI 回复 |

### 事件

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/episodes` | 创建事件 |
| GET | `/api/v1/episodes` | 事件列表 |

## 快速开始

### 前置要求

- Node.js >= 20
- Docker & Docker Compose
- npm

### 安装与运行

```bash
git clone https://github.com/HarmmerRay/selfpraise-server.git
cd selfpraise-server

npm install

# 启动 PostgreSQL 和 Redis
docker-compose up -d

cp .env.example .env
# 编辑 .env：DATABASE_URL、AGNES_API_KEY 等

npx prisma migrate deploy
npm run start:dev
```

API 默认监听 `http://localhost:3000`。

## Docker 部署

### 镜像

| 镜像 Tag | 用途 |
|---------|------|
| `harmmeray/selfpraise-server:api-latest` | API 服务 |

### 构建与推送

```bash
./docker-scripts/deploy.sh 0.0.1   # 构建 + 推送 + 清理

# 或分步
./docker-scripts/build.sh 0.0.1
./docker-scripts/push.sh 0.0.1
```

### Docker Compose

**开发**（仅基础设施）：

```bash
docker-compose up -d
```

**生产**（基础设施 + API）：

```bash
docker-compose --profile prod up -d
```

## 实施路线

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 1 | NestJS + Prisma + Redis + Docker + JWT 认证 | ✅ |
| Phase 2 | Persona / Conversation / Episode 模块 + SSE 流式 AI | ✅ 骨架 |
| Phase 3 | 语音/视频 onboarding、STT、UiIntent 渲染 | 进行中 |
| Phase 4 | pgvector 记忆检索、Episode 自动提炼 | 待做 |
| Phase 5 | K8s 部署、监控、CI/CD | 设计中 |

## 相关仓库

- [SelfPraise Flutter 客户端](https://github.com/HarmmerRay/SelfPraise) — HugMe 移动端
