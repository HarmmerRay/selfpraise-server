#!/bin/bash

# SelfPraise Server - 清理本地 Docker 镜像
# 用法：./docker-scripts/clean.sh [版本号]
# 示例：./docker-scripts/clean.sh 0.0.1

set -e

# 配置
DOCKERHUB_USER="harmmeray"
IMAGE_NAME="selfpraise-server"
VERSION="${1:-latest}"
FULL_IMAGE="${DOCKERHUB_USER}/${IMAGE_NAME}"

echo "=========================================="
echo " 清理本地 Docker 镜像"
echo " 镜像名: ${FULL_IMAGE}"
echo " 版本:   ${VERSION}"
echo "=========================================="

echo ""
echo ">>> 删除 API 镜像..."
docker rmi "${FULL_IMAGE}:api-${VERSION}" 2>/dev/null && echo "✅ 已删除 ${FULL_IMAGE}:api-${VERSION}" || echo "⚠️  镜像不存在: ${FULL_IMAGE}:api-${VERSION}"
docker rmi "${FULL_IMAGE}:api-latest" 2>/dev/null && echo "✅ 已删除 ${FULL_IMAGE}:api-latest" || echo "⚠️  镜像不存在: ${FULL_IMAGE}:api-latest"

echo ""
echo ">>> 清理悬空镜像..."
docker image prune -f

echo ""
echo "=========================================="
echo " 清理完成"
echo "=========================================="
