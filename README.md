# SelfPraise Server

> 愿景：让自己更成为自己

SelfPraise 服务端 —— 负责数据采集、AI 夸赞生成、TTS 语音合成，为 [SelfPraise Flutter 客户端](https://github.com/HarmmerRay/SelfPraise) 提供后端服务。

## 产品简介

SelfPraise 是一款个人成长与自我鼓励应用。用户记录备忘录后，系统通过 AI 生成个性化夸赞文案，并合成为语音，在用户跑步、工作、听歌等场景中随机、间断地播放，帮助用户更好地认识与接纳自己。

产品形态类似酷狗/QQ 音乐——用户点击「播放」后，应用在后台持续运行，不定时语音夸赞用户。

### MVP 核心链路

```
备忘录（纯文本）→ 通义千问生成夸赞文案 → 阿里云 TTS 合成语音 → 客户端播放
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
