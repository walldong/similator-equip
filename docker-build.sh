#!/bin/bash

# Docker 构建和推送脚本
# 用法: ./docker-build.sh [版本号]

set -e

# 配置
REGISTRY="192.168.1.8:50445"
PROJECT_NAME="similator-equip"
VERSION=${1:-"latest"}

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 Docker 是否可用
if ! command -v docker &> /dev/null; then
    log_error "Docker 未安装，请先安装 Docker"
    exit 1
fi

# 登录镜像仓库
log_info "登录镜像仓库: $REGISTRY"
docker login $REGISTRY

# 构建镜像
log_info "构建镜像: ${REGISTRY}/${PROJECT_NAME}:${VERSION}"
docker build \
    -f Dockerfile \
    -t ${REGISTRY}/${PROJECT_NAME}:${VERSION} \
    -t ${REGISTRY}/${PROJECT_NAME}:latest \
    .

log_info "推送镜像..."
docker push ${REGISTRY}/${PROJECT_NAME}:${VERSION}
docker push ${REGISTRY}/${PROJECT_NAME}:latest

log_info "=========================================="
log_info "构建和推送完成!"
log_info "镜像: ${REGISTRY}/${PROJECT_NAME}:${VERSION}"
log_info "=========================================="