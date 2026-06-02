# 部署指南

## 快速启动

### 1. 启动 MySQL 和 Redis (Docker)

```bash
# 启动服务
docker-compose up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

服务启动后：
- MySQL: `localhost:3306`
- Redis: `localhost:6379`
- Redis管理界面: http://localhost:8081
- MySQL管理界面: http://localhost:8082

### 2. 安装后端依赖

```bash
cd backend
npm install
```

### 3. 启动后端服务器

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

### 4. 启动前端 (Next.js)

```bash
# 在项目根目录
npm install
npm run dev
```

## 环境变量

复制 `.env.example` 到 `.env` 并修改：

```bash
cp .env.example .env
```

| 变量 | 说明 | 默认值 |
|------|------|--------|
| DB_TYPE | 数据库类型 | mysql |
| MYSQL_HOST | MySQL地址 | localhost |
| MYSQL_PORT | MySQL端口 | 3306 |
| MYSQL_USER | MySQL用户 | game |
| MYSQL_PASSWORD | MySQL密码 | game123456 |
| MYSQL_DATABASE | 数据库名 | game |
| REDIS_HOST | Redis地址 | localhost |
| REDIS_PORT | Redis端口 | 6379 |
| PORT | 后端端口 | 3001 |

## 管理界面

### Redis Commander (http://localhost:8081)
查看和管理 Redis 缓存数据

### Adminer (http://localhost:8082)
数据库管理界面
- 系统: MySQL
- 服务器: mysql
- 用户名: game
- 密码: game123456
- 数据库: game

## 常用命令

```bash
# 重置数据库和缓存（删除所有数据）
npm run docker:reset

# 停止服务
npm run docker:down

# 查看服务日志
npm run docker:logs
```

## 健康检查

```bash
curl http://localhost:3001/health
```

返回：
```json
{
  "status": "healthy",
  "database": "connected",
  "cache": "connected",
  "timestamp": "2024-..."
}
```

## 数据持久化

数据存储在 Docker volumes 中：
- `mysql_data`: MySQL数据
- `redis_data`: Redis数据

即使删除容器，数据也会保留。要完全重置：
```bash
docker-compose down -v  # 删除 volumes
docker-compose up -d    # 重新启动
```