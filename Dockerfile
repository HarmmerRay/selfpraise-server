# ===== 阶段1：依赖安装 =====
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci

# ===== 阶段2：构建 =====
FROM deps AS build

WORKDIR /app

COPY . .

RUN npx prisma generate
RUN npm run build

# ===== 阶段3：运行 =====
FROM node:20-alpine AS runtime

WORKDIR /app

RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001 -G appgroup

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev && npx prisma generate

COPY --from=build /app/dist ./dist

RUN mkdir -p /app/audio && chown -R appuser:appgroup /app/audio

USER appuser

EXPOSE 3000

# 通过 APP_MODE 环境变量切换启动模式
ENV APP_MODE=api

CMD ["sh", "-c", "if [ \"$APP_MODE\" = 'worker' ]; then node dist/main-worker.js; else node dist/main.js; fi"]
