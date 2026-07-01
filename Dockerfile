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

# 安装 openssl（Prisma 运行时依赖）和 openssl11-compat（兼容层）
RUN apk add --no-cache openssl openssl-dev

RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001 -G appgroup

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev && npx prisma generate && chown -R appuser:appgroup /app

COPY --from=build /app/dist ./dist

USER appuser

EXPOSE 3000

CMD ["node", "dist/main.js"]
