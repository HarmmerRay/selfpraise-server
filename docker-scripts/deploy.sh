#!/bin/bash

# SelfPraise Server - 一键构建 + 推送 + 清理
# 用法：./docker-scripts/deploy.sh [版本号]
# 示例：./docker-scripts/deploy.sh 0.0.1

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 开始部署流程..."

# 1. 构建
echo ""
bash "${SCRIPT_DIR}/build.sh" "$1"

# 2. 推送
echo ""
bash "${SCRIPT_DIR}/push.sh" "$1"

# 3. 清理
echo ""
bash "${SCRIPT_DIR}/clean.sh" "$1"

echo ""
echo "🎉 部署流程全部完成！"
