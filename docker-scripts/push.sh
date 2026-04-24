#!/bin/bash

# SelfPraise Server - Docker 镜像推送到 DockerHub
# 用法：./docker-scripts/push.sh [版本号]
# 示例：./docker-scripts/push.sh 0.0.1

set -e

# 配置
DOCKERHUB_USER="harmmeray"
IMAGE_NAME="selfpraise-server"
VERSION="${1:-latest}"
FULL_IMAGE="${DOCKERHUB_USER}/${IMAGE_NAME}"

echo "=========================================="
echo " 推送镜像到 DockerHub"
echo " 镜像名: ${FULL_IMAGE}"
echo " 版本:   ${VERSION}"
echo "=========================================="

# 检查是否已登录 DockerHub
if ! docker info 2>/dev/null | grep -q "Username: ${DOCKERHUB_USER}"; then
  echo ">>> 请先登录 DockerHub..."
  docker login -u "${DOCKERHUB_USER}"
fi

# 推送 API 镜像
echo ""
echo ">>> 推送 API 镜像..."
docker push "${FULL_IMAGE}:api-${VERSION}"
docker push "${FULL_IMAGE}:api-latest"
echo "✅ API 镜像推送完成"

# 推送 Worker 镜像
echo ""
echo ">>> 推送 Worker 镜像..."
docker push "${FULL_IMAGE}:worker-${VERSION}"
docker push "${FULL_IMAGE}:worker-latest"
echo "✅ Worker 镜像推送完成"

echo ""
echo "=========================================="
echo " 推送完成！"
echo "=========================================="
echo "  API:    docker pull ${FULL_IMAGE}:api-${VERSION}"
echo "  Worker: docker pull ${FULL_IMAGE}:worker-${VERSION}"
echo ""
echo "清理本地镜像: ./docker-scripts/clean.sh ${VERSION}"
