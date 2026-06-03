# Docker 构建和推送脚本 (Windows PowerShell)
# 用法: .\docker-build.ps1 [-Version "版本号"]

param(
    [string]$Version = "latest"
)

$ErrorActionPreference = "Stop"

# 配置
$REGISTRY = "192.168.1.8:50445"
$PROJECT_NAME = "similator-equip"

function Write-Log-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Log-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# 检查 Docker 是否可用
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Log-Error "Docker 未安装，请先安装 Docker"
    exit 1
}

# 登录镜像仓库
Write-Log-Info "登录镜像仓库: $REGISTRY"
docker login $REGISTRY

# 构建镜像
Write-Log-Info "构建镜像: ${REGISTRY}/${PROJECT_NAME}:${Version}"
docker build `
    -f Dockerfile `
    -t "${REGISTRY}/${PROJECT_NAME}:${Version}" `
    -t "${REGISTRY}/${PROJECT_NAME}:latest" `
    .

Write-Log-Info "推送镜像..."
docker push "${REGISTRY}/${PROJECT_NAME}:${Version}"
docker push "${REGISTRY}/${PROJECT_NAME}:latest"

Write-Log-Info "=========================================="
Write-Log-Info "构建和推送完成!"
Write-Log-Info "镜像: ${REGISTRY}/${PROJECT_NAME}:${Version}"
Write-Log-Info "=========================================="