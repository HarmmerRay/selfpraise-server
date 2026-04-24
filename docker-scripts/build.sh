#!/bin/bash

# SelfPraise Server - Docker 镜像构建脚本
# 用法：./docker-scripts/build.sh [版本号]
# 示例：./docker-scripts/build.sh 0.0.1

set -e

# 配置
DOCKERHUB_USER="harmmeray"
IMAGE_NAME="selfpraise-server"
VERSION="${1:-latest}"
FULL_IMAGE="${DOCKERHUB_USER}/${IMAGE_NAME}"

echo "=========================================="
echo " 构建 Docker 镜像"
echo " 镜像名: ${FULL_IMAGE}"
echo " 版本:   ${VERSION}"
echo "=========================================="

# 构建 API 镜像
echo ""
echo ">>> 构建 API 镜像..."
docker build \
  --build-arg APP_MODE=api \
  -t "${FULL_IMAGE}:api-${VERSION}" \
  -t "${FULL_IMAGE}:api-latest" \
  .

echo "✅ API 镜像构建完成: ${FULL_IMAGE}:api-${VERSION}"

# 构建 Worker 镜像
echo ""
echo ">>> 构建 Worker 镜像..."
docker build \
  --build-arg APP_MODE=worker \
  -t "${FULL_IMAGE}:worker-${VERSION}" \
  -t "${FULL_IMAGE}:worker-latest" \
  .

echo "✅ Worker 镜像构建完成: ${FULL_IMAGE}:worker-${VERSION}"

# 显示构建结果
echo ""
echo "=========================================="
echo " 构建完成，本地镜像列表："
echo "=========================================="
docker images "${FULL_IMAGE}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
echo ""
echo "下一步："
echo "  推送到 DockerHub:  ./docker-scripts/push.sh ${VERSION}"
echo "  清理本地镜像:      ./docker-scripts/clean.sh ${VERSION}"
