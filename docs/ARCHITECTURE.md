# 游戏后端架构设计

## 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                         客户端 (Next.js)                          │
│                    只负责 UI 展示和用户交互                        │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTP API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         服务层 (Service)                          │
│                      业务逻辑处理 + 数据校验                        │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ UserService│ │EquipService│ │BattleService│ │GameService│      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────┬───────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────────┐
│      缓存层 (Redis)      │     │         数据库层                  │
│   ┌─────────────────┐   │     │   ┌─────────────────────────┐   │
│   │  用户会话        │   │     │   │  SQLite (开发/小规模)    │   │
│   │  战斗会话        │   │     │   ├─────────────────────────┤   │
│   │  热点数据缓存    │   │     │   │  MySQL (中等规模)       │   │
│   │  分布式锁        │   │     │   ├─────────────────────────┤   │
│   └─────────────────┘   │     │   │  MongoDB (大规模/文档型) │   │
└─────────────────────────┘     │   └─────────────────────────┘   │
                                └─────────────────────────────────┘
```

## 技术选型

### 数据库选择

| 数据库 | 适用场景 | 优势 | 劣势 |
|--------|----------|------|------|
| **SQLite** | 开发/小规模 (<1万用户) | 部署简单，零配置，单文件 | 单机，无法水平扩展 |
| **MySQL** | 中等规模 (1-100万用户) | 成熟稳定，生态丰富，事务支持 | 需要预先定义schema |
| **MongoDB** | 大规模/文档型数据 | 灵活schema，水平扩展容易 | 事务支持较弱，内存占用高 |

### 是否需要 Redis？

| 场景 | 是否需要 | 说明 |
|------|----------|------|
| 单机开发 | ❌ 不需要 | 内存缓存足够 |
| 小规模部署 (<1万用户) | ⚠️ 可选 | 可以用内存缓存替代 |
| 中等规模 (1-10万用户) | ✅ 推荐 | 缓存热点数据，会话管理 |
| 大规模/分布式 | ✅ 必须 | 分布式会话，分布式锁，限流 |

## 当前推荐配置

### 开发阶段（当前）
```
SQLite + 内存缓存
```

### 生产环境（小规模）
```
MySQL + Redis (可选)
```

### 生产环境（大规模）
```
MySQL 主从 + Redis 集群 + 负载均衡
```

## 配置方法

### 环境变量

```bash
# 数据库类型
DB_TYPE=sqlite  # sqlite | mysql | mongodb

# MySQL 配置
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=game

# MongoDB 配置
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=game

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# 缓存配置
CACHE_ENABLED=false  # true 开启 Redis
CACHE_TTL=300        # 缓存时间（秒）
```

### Docker Compose（生产环境）

```yaml
version: '3.8'
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: your_password
      MYSQL_DATABASE: game
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "3306:3306"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  game-server:
    build: .
    environment:
      DB_TYPE: mysql
      MYSQL_HOST: mysql
      CACHE_ENABLED: "true"
      REDIS_HOST: redis
    depends_on:
      - mysql
      - redis
    ports:
      - "3001:3001"

volumes:
  mysql_data:
  redis_data:
```

## 数据安全

### 所有数据操作在服务端执行

| 操作 | 服务端校验 | 说明 |
|------|-----------|------|
| 强化装备 | ✅ | 成功率、损坏率在服务端计算 |
| 战斗伤害 | ✅ | 伤害计算在服务端执行 |
| 获得奖励 | ✅ | 掉落在服务端计算 |
| 装备穿戴 | ✅ | 验证所有权 |
| 升级经验 | ✅ | 服务端计算升级 |

### 防作弊措施

1. **数据验证**：所有传入参数做类型和范围校验
2. **所有权验证**：装备操作验证归属
3. **状态验证**：战斗状态、装备状态在服务端维护
4. **操作日志**：关键操作记录日志

## 性能优化

### 缓存策略

```javascript
// 读流程：Cache Aside
async getUser(userId) {
  // 1. 先查缓存
  let data = await cache.get(key);
  if (data) return data;
  
  // 2. 缓存未命中，查数据库
  data = await db.findUser(userId);
  
  // 3. 回填缓存
  await cache.set(key, data, ttl);
  
  return data;
}

// 写流程：Write Through
async updateUser(userId, data) {
  // 1. 更新数据库
  await db.updateUser(userId, data);
  
  // 2. 删除缓存（下次读取时重新加载）
  await cache.del(key);
}
```

### 缓存键设计

```
game:user:{userId}           # 用户数据
game:equipments:{userId}     # 用户装备列表
game:battle:{battleId}       # 战斗会话
game:session:{sessionId}     # 登录会话
```

## 扩展建议

1. **增加限流**：防止恶意请求
2. **增加日志**：ELK 收集分析
3. **增加监控**：Prometheus + Grafana
4. **数据备份**：定时备份数据库
