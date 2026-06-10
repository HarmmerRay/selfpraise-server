# SelfPraise Server

> 愿景：让自己更成为自己  
> 对外产品与域名：**HugMe**（`hugme`）；仓库目录多为 **`selfpraise-server`**。

SelfPraise 服务端 —— 负责数据采集、用户状态建模、多 Agent 编排、AI 夸赞生成、TTS 语音合成，为 [SelfPraise Flutter 客户端](https://github.com/HarmmerRay/SelfPraise) 提供后端服务。

**AI/Codex 辅助开发：** 先读上一级 **`AI_HUB.md`**、**`PROJECT_ENGINEERING_STANDARD.md`**；本仓库以 **`CLAUDE.md`**、**`CODEX.md`** 为日常指令集。

## 产品简介

SelfPraise 是一个 Agent 原生的个人成长系统。用户的备忘录、录音、心率、运动、学习、对话和行为等信号会进入后端，由情感、生活、健身、学习、法律、记忆等多个 Agent 协同理解，再由编排 Agent 生成最终输出，驱动前端 UI、语音、任务和提醒。

早期产品形态包含类似酷狗/QQ 音乐的后台播放体验：用户点击「播放」后，应用在后台持续运行，不定时语音夸赞用户。但这只是 MVP 切片，不是完整产品边界。

### Agent 原生后端要求

- 稳定：超时、重试、幂等、降级、熔断、限流、明确错误边界。
- 高并发：耗时 Agent 工作异步化，API worker 尽量无状态，使用队列、缓存和任务状态查询。
- 编排效果：专家 Agent 职责清晰，输入输出类型化，编排 Agent 负责优先级、冲突解决和结果合并。
- 可观测：每次决策应能追踪 request id、用户状态、参与 Agent、输入、输出、置信度和最终意图。
- 安全：法律、健康、心理等高影响领域必须有安全等级、保守措辞、免责声明和升级路径。

后端最终不应只返回自然语言，而应返回类型化意图：

```text
AgentDecision -> UiIntent / VoiceIntent / TaskIntent
```

### MVP 核心链路

```
备忘录（纯文本）→ 通义千问生成夸赞文案 → 阿里云 TTS 合成语音 → 客户端播放
```

### 长期核心链路

```
用户信号 → 用户状态建模 → 多 Agent 协同 → 编排决策 → UI/语音/任务意图 → 客户端个性化表达
```

## 技术栈

| 类别 | 选型 | 说明 |
|------|------|------|
| 语言/框架 | **NestJS (TypeScript)** | 与 Flutter 客户端同语言生态，类型定义可共享 |
| 数据库 | **PostgreSQL + Prisma ORM** | 结构化存储，类型安全 |
| 缓存/队列 | **Redis + Bull** | 异步任务队列，耗时操作后台处理 |
| 文件存储 | **本地文件（MVP）** → 七牛云 | TTS 生成的音频文件存储 |
| LLM | **通义千问 API** | 国内合规，中文效果好 |
| TTS | **阿里云语音合成** | 稳定，按量计费 |
| 认证 | **手机号验证码** | 简单直接 |

## 项目结构

```
selfpraise-server/
├── src/
│   ├── input/                        # 数据输入层
│   │   ├── memo/                     # 备忘录（MVP 唯一数据源）
│   │   │   ├── memo.controller.ts
│   │   │   ├── memo.service.ts
│   │   │   └── memo.dto.ts
│   │   └── input.module.ts
│   │
│   ├── output/                       # 数据输出层
│   │   ├── praise/                   # 夸赞生成
│   │   │   ├── praise.controller.ts
│   │   │   ├── praise.service.ts
│   │   │   └── praise.dto.ts
│   │   ├── tts/                      # 语音合成
│   │   │   ├── tts.service.ts
│   │   │   └── tts.dto.ts
│   │   └── output.module.ts
│   │
│   ├── auth/                         # 手机号认证
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.dto.ts
│   │
│   ├── workers/                      # 后台任务处理
│   │   ├── praise.worker.ts          # LLM 夸赞生成
│   │   └── tts.worker.ts             # TTS 音频合成
│   │
│   ├── common/                       # 公共基础设施
│   │   ├── guards/
│   │   ├── filters/
│   │   └── interceptors/
│   │
│   ├── prisma/                       # 数据库
│   │   └── schema.prisma
│   │
│   ├── config/                       # 配置管理
│   │   └── configuration.ts
│   │
│   ├── app.module.ts
│   ├── main.ts                       # API 服务入口
│   └── main-worker.ts                # Worker 服务入口
│
├── docker-compose.yml                # PostgreSQL + Redis
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 两种启动模式

| 模式 | 入口 | 作用 |
|------|------|------|
| **API 模式** | `main.ts` | 接收前端请求，存取数据库，投递异步任务到队列 |
| **Worker 模式** | `main-worker.ts` | 从队列取任务，执行 LLM 夸赞生成、TTS 语音合成 |

```bash
# 启动 API 服务
npm run start:api

# 启动 Worker 服务
npm run start:worker

# 开发模式（两个都启动）
npm run start:dev
```

## 数据库设计

### users（用户）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| phone | VARCHAR | 手机号 |
| nickname | VARCHAR | 昵称（可选） |
| avatar_url | VARCHAR | 头像（可选） |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### memos（备忘录）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 关联用户 |
| title | VARCHAR | 标题 |
| content | TEXT | 正文 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### praises（夸赞）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 关联用户 |
| content | TEXT | AI 生成的夸赞文案 |
| audio_path | VARCHAR | 音频文件路径 |
| status | ENUM | pending / generated / synthesized |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

## API 设计

### 认证

- `POST /api/auth/send-code` — 发送验证码
- `POST /api/auth/login` — 手机号 + 验证码登录

### Input（备忘录）

- `POST   /api/input/memo` — 创建备忘录
- `GET    /api/input/memo` — 查询备忘录列表
- `DELETE /api/input/memo/:id` — 删除备忘录

### Output（夸赞）

- `POST /api/output/praise/generate` — 手动触发生成夸赞
- `GET  /api/output/praise` — 查询夸赞列表
- `GET  /api/output/praise/:id/audio` — 获取夸赞音频文件

## 核心数据流

```
1. 用户注册/登录（手机号验证码）
2. 用户写备忘录 → POST /api/input/memo → 存数据库
3. 投递异步任务到 Bull 队列
       │
       ▼
   praise.worker：读取用户备忘录 → 全量组装 Prompt → 调用通义千问 → 存夸赞文案
       │
       ▼
   tts.worker：夸赞文案 → 调用阿里云 TTS → 音频存本地 → 更新 audio_path
       │
       ▼
4. 客户端拉取夸赞音频 → GET /api/output/praise → 播放
```

## AI 分析策略

### 当前（MVP）：全量发送

将用户所有备忘录组装成 Prompt，一次性发送给通义千问生成夸赞。用户初期备忘录不多，Token 消耗可控。

### 后续优化：用户画像摘要

维护一份用户画像摘要（几百字），生成夸赞时用「摘要 + 最近几条备忘录」组装 Prompt，Token 更省、信息更完整。

## 快速开始

### 前置要求

- Node.js >= 20
- Docker & Docker Compose
- npm

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/HarmmerRay/selfpraise-server.git
cd selfpraise-server

# 安装依赖
npm install

# 启动 PostgreSQL 和 Redis
docker-compose up -d

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入数据库连接、通义千问 API Key、阿里云 TTS 配置等

# 初始化数据库
npx prisma migrate dev

# 启动开发服务
npm run start:dev
```

## Docker 部署

### 镜像说明

项目提供两种镜像，通过 `APP_MODE` 环境变量区分：

| 镜像 Tag | 模式 | 用途 |
|---------|------|------|
| `harmmeray/selfpraise-server:api-latest` | API | 接收前端请求，存取数据库，投递异步任务 |
| `harmmeray/selfpraise-server:worker-latest` | Worker | 从队列取任务，执行 LLM/TTS 等耗时操作 |

### 构建与推送

所有脚本在 `docker-scripts/` 目录下：

```bash
# 构建 + 推送 + 清理（一键完成）
./docker-scripts/deploy.sh 0.0.1

# 或分步执行
./docker-scripts/build.sh 0.0.1    # 构建镜像
./docker-scripts/push.sh 0.0.1     # 推送到 DockerHub
./docker-scripts/clean.sh 0.0.1    # 清理本地镜像
```

### Docker Compose 部署

**开发模式**（仅启动基础设施）：

```bash
docker-compose up -d
```

**生产模式**（基础设施 + API + Worker）：

```bash
docker-compose --profile prod up -d
```

### 手动运行

```bash
# 拉取镜像
docker pull harmmeray/selfpraise-server:api-latest
docker pull harmmeray/selfpraise-server:worker-latest

# 运行 API 服务
docker run -d \
  --name selfpraise-api \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://selfpraise:selfpraise_dev@postgres:5432/selfpraise" \
  -e REDIS_HOST=redis \
  -e REDIS_PORT=6379 \
  harmmeray/selfpraise-server:api-latest

# 运行 Worker 服务
docker run -d \
  --name selfpraise-worker \
  -e DATABASE_URL="postgresql://selfpraise:selfpraise_dev@postgres:5432/selfpraise" \
  -e REDIS_HOST=redis \
  -e REDIS_PORT=6379 \
  harmmeray/selfpraise-server:worker-latest
```

## 实施路线

| 步骤 | 内容 |
|------|------|
| Step 1 | 项目初始化（NestJS + Prisma + Redis + Docker） |
| Step 2 | 用户认证（手机号验证码） |
| Step 3 | 备忘录 CRUD |
| Step 4 | 夸赞生成（通义千问） |
| Step 5 | TTS 语音合成（阿里云） |
| Step 6 | 客户端对接 |

## 相关仓库

- [SelfPraise Flutter 客户端](https://github.com/HarmmerRay/SelfPraise) — Flutter 全平台客户端
