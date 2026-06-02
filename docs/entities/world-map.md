# 世界地图实体 (World Map Entity)

世界地图是游戏中的单一全局地图，包含玩家等级上下10级的怪物和Boss。

## 概述

- **尺寸**: 200×200 格子
- **类型**: 单一世界地图（全局唯一）
- **刷新**: 手动重置，所有怪物刷新

---

## 地图结构

```
WorldMap (200×200)
├── 出生点 (地图中心)
├── 地形系统
│   ├── 路径 (可通行)
│   └── 墙壁 (障碍物)
└── 怪物分布
    ├── 普通怪物 (玩家等级 ±10)
    ├── 精英怪物 (玩家等级 ±10)
    └── Boss (玩家等级 +1~+5)
```

---

## WorldMap 数据结构

```typescript
interface WorldMap {
  id: EntityId;                     // 地图唯一ID
  width: number;                    // 宽度 (200)
  height: number;                   // 高度 (200)
  cells: WorldMapCell[][];          // 地图格子
  playerPos: { x: number; y: number }; // 玩家位置
  defeatedCells: Set<string>;       // 已击败格子
  totalMonsters: number;            // 总普通怪物数
  totalElites: number;              // 总精英数
  totalBosses: number;              // 总Boss数
  defeatedMonsters: number;         // 已击败普通怪物
  defeatedElites: number;           // 已击败精英
  defeatedBosses: number;           // 已击败Boss
  playerLevel: number;              // 生成时的玩家等级
  createdAt: number;                // 创建时间
  lastResetAt: number;              // 最后重置时间
}
```

---

## WorldMapCell 格子结构

```typescript
interface WorldMapCell {
  x: number;                        // X坐标
  y: number;                        // Y坐标
  type: CellType;                   // 格子类型
  explored: boolean;                // 是否已探索
  visible: boolean;                 // 当前是否可见
  entityId?: EntityId;              // 怪物实体ID
  monsterLevel?: number;            // 怪物等级
  monsterType?: 'normal' | 'elite' | 'boss'; // 怪物类型
}
```

### 格子类型 (CellType)

| 类型 | 说明 | 可通行 |
|------|------|--------|
| `path` | 路径 | ✓ |
| `wall` | 墙壁 | ✗ |
| `start` | 出生点 | ✓ |
| `monster` | 普通怪物 | ✓ |
| `elite` | 精英怪物 | ✓ |
| `boss` | Boss | ✓ |
| `empty` | 空格 | ✓ |

---

## 怪物分布规则

### 密度配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `monsterDensity` | 0.15 | 怪物密度（15%格子有怪物） |
| `eliteRatio` | 0.08 | 精英比例（8%的怪物） |
| `bossRatio` | 0.02 | Boss比例（2%的怪物） |

### 数量计算

```typescript
// 200×200 地图示例
const totalCells = (200-2) * (200-2);  // 39604 个有效格子
const monsterCount = Math.floor(totalCells * 0.15); // ~5940 个怪物
const eliteCount = Math.floor(monsterCount * 0.08); // ~475 个精英
const bossCount = Math.floor(monsterCount * 0.02);  // ~119 个Boss
const normalCount = monsterCount - eliteCount - bossCount; // ~5346 个普通怪
```

### 怪物等级分布

| 类型 | 等级范围 | 说明 |
|------|----------|------|
| 普通怪物 | `[playerLevel-10, playerLevel+10]` | 随机分布 |
| 精英怪物 | `[playerLevel-10, playerLevel+10]` | 随机分布 |
| Boss | `[playerLevel+1, playerLevel+5]` | 必定高于玩家 |

---

## 地形生成

### 生成流程

1. **初始化**: 全部设为路径
2. **边界墙**: 设置四周边界
3. **内部墙**: 随机生成30%墙壁
4. **平滑处理**: 2次平滑算法，减少孤立墙
5. **路径保证**: 确保从出生点到边缘可通行

### 平滑算法

```typescript
// 检查周围8格墙壁数
// >= 6: 变为墙壁
// <= 2: 变为路径
// 其他: 保持不变
```

### 路径生成

从出生点向四个方向生成路径，确保玩家可以探索到地图边缘。

---

## 可见性系统

### 视野范围

- **可见范围**: 玩家周围 5×5 格子（视野2格）
- **探索记录**: 已探索格子永久标记

### 更新规则

```typescript
// 每次移动后更新
for (let dy = -2; dy <= 2; dy++) {
  for (let dx = -2; dx <= 2; dx++) {
    cell.visible = true;
    cell.explored = true;
  }
}
```

---

## WorldMapSystem API

### 核心方法

```typescript
class WorldMapSystem {
  // 生成世界地图
  generateWorldMap(playerLevel: number, config?: Partial<WorldMapConfig>): WorldMap;
  
  // 重置世界地图（刷新所有怪物）
  resetWorldMap(playerLevel: number): WorldMap;
  
  // 获取当前地图
  getWorldMap(): WorldMap | null;
  
  // 移动玩家
  movePlayer(dx: number, dy: number): boolean;
  
  // 检查遭遇
  checkEncounter(): { type: CellType; level: number; position: {...} } | null;
  
  // 标记击败
  markDefeated(x: number, y: number): void;
  
  // 获取统计
  getStatistics(): {...} | null;
  
  // 序列化/恢复
  serialize(): Record<string, unknown> | null;
  restore(data: Record<string, unknown>): WorldMap;
}
```

### 使用示例

```typescript
const worldMapSystem = world.getSystem<WorldMapSystem>('worldMap');

// 生成新地图
const map = worldMapSystem.generateWorldMap(playerLevel);

// 重置地图
worldMapSystem.resetWorldMap(playerLevel);

// 移动玩家
worldMapSystem.movePlayer(1, 0); // 向右移动

// 检查遭遇
const encounter = worldMapSystem.checkEncounter();
if (encounter) {
  // 进入战斗
  const monster = monsterFactory.createByType(encounter.type, encounter.level);
}

// 标记击败
worldMapSystem.markDefeated(x, y);

// 获取进度
const stats = worldMapSystem.getStatistics();
console.log(`进度: ${stats.progress}%`);
```

---

## 重置机制

> ⚠️ **重要**: 重置只能由玩家手动触发，系统不会自动重置地图。

### 触发方式

```typescript
// 玩家手动点击重置按钮时调用
const worldMapSystem = world.getSystem<WorldMapSystem>('worldMap');
worldMapSystem.resetWorldMap(currentPlayerLevel);
```

### 重置效果

- 清除所有击败记录
- 刷新所有怪物等级
- 玩家回到出生点
- 可见性重置

### 适用场景

玩家可在以下情况选择手动重置：

- **清理地图后**: 已击败大部分怪物，想刷新新的怪物
- **升级后**: 玩家等级提升，想挑战更高等级的怪物
- **战斗失败后**: 想重新开始，刷新所有怪物
- **改变策略**: 想换一个区域的怪物配置

### 重置示例

```typescript
// UI层：重置按钮点击事件处理
function handleResetMapClick() {
  const worldMapSystem = world.getSystem<WorldMapSystem>('worldMap');
  const playerLevel = player.getComponent<PlayerComponent>('player')?.level ?? 1;
  
  // 玩家手动触发重置
  worldMapSystem.resetWorldMap(playerLevel);
  
  // 更新UI显示
  updateMapUI();
}
```
worldMapSystem.resetWorldMap(newPlayerLevel);
```

---

## Boss掉落规则

### 掉落数量

| 怪物类型 | 掉落数量 |
|----------|----------|
| 小怪 | 0-2 件 |
| 精英怪 | 1-3 件 |
| Boss | 2-5 件 |

### Boss品质分布

Boss掉落的装备品质分布：

| 品质 | 概率 |
|------|------|
| 普通 | 10% |
| 稀有 | 30% |
| 史诗 | 35% |
| 传说 | 24% |
| 神话 | 1% |

### 精英怪品质分布

| 品质 | 概率 |
|------|------|
| 普通 | 30% |
| 稀有 | 35% |
| 史诗 | 25% |
| 传说 | 9% |
| 神话 | 1% |

### 小怪品质分布

| 品质 | 概率 |
|------|------|
| 普通 | 64% |
| 稀有 | 25% |
| 史诗 | 10% |
| 传说 | 0% |
| 神话 | 1% |

### 掉落代码示例

```typescript
// DropSystem 生成掉落
const drops = dropSystem.generateDrops(monsterComp, monsterLevel);

// 根据怪物类型自动确定掉落数量
// Boss: 2-5件, 精英: 1-3件, 小怪: 0-2件
```
  if (Math.random() < 0.5) {
    const extra = factory.createRandom(level, rollBossQuality());
  }
}
```

---

## 后端存储

地图数据存储在数据库中，玩家登录时自动加载。

### 数据库表结构

```sql
CREATE TABLE world_map (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  width INTEGER DEFAULT 200,
  height INTEGER DEFAULT 200,
  player_x INTEGER DEFAULT 100,
  player_y INTEGER DEFAULT 100,
  cells TEXT,           -- JSON序列化
  stats TEXT,           -- JSON序列化
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### API接口

#### GET /api/worldmap?userId=xxx

获取玩家的地图数据。

**响应：**
```json
{
  "success": true,
  "data": {
    "width": 200,
    "height": 200,
    "playerPos": { "x": 100, "y": 100 },
    "cells": [...],
    "stats": {
      "totalMonsters": 5346,
      "defeatedMonsters": 10,
      ...
    }
  }
}
```

#### POST /api/worldmap

保存地图数据。

**请求：**
```json
{
  "userId": 1,
  "data": {
    "width": 200,
    "height": 200,
    "playerPos": { "x": 105, "y": 98 },
    "cells": [...],
    "stats": {...}
  }
}
```

### 保存时机

- 点击保存按钮时
- 战斗结束后
- 重置地图后

---

## 相关事件

| 事件类型 | 说明 | 数据 |
|----------|------|------|
| `WORLD_MAP_GENERATED` | 地图生成 | `{ mapId, width, height, playerLevel, totalMonsters... }` |
| `WORLD_MAP_RESET` | 地图重置 | `{ mapId, playerLevel, timestamp }` |
| `PLAYER_MOVED` | 玩家移动 | `{ position }` |
| `MONSTER_DEFEATED` | 怪物击败 | `{ position, type, level }` |

---

## 存储格式

```typescript
interface WorldMapData {
  id: EntityId;
  width: number;
  height: number;
  cells: WorldMapCellData[][];
  playerPos: { x: number; y: number };
  defeatedCells: string[];  // 序列化为数组
  totalMonsters: number;
  totalElites: number;
  totalBosses: number;
  defeatedMonsters: number;
  defeatedElites: number;
  defeatedBosses: number;
  playerLevel: number;
  createdAt: number;
  lastResetAt: number;
}
```

---

## 地图UI建议

### 显示范围

建议显示玩家周围 20×20 的区域，实现平滑滚动。

### 格子颜色

| 类型 | 颜色建议 |
|------|----------|
| 路径 | 浅灰色 |
| 墙壁 | 深灰色 |
| 出生点 | 绿色 |
| 普通怪物 | 橙色 |
| 精英怪物 | 紫色 |
| Boss | 红色 |
| 已击败 | 淡色（半透明） |
| 未探索 | 黑色 |

### 迷你地图

可在UI角落显示迷你地图，标记玩家位置和已探索区域。

---

## 性能考虑

### 地图大小

200×200 = 40,000 格子

- 内存占用：约 4MB（每格子约100字节）
- 序列化大小：约 800KB（JSON压缩后）

### 优化建议

1. **分块加载**: 只加载玩家周围区域
2. **延迟渲染**: 只渲染可见区域
3. **压缩存储**: 使用二进制格式存储
4. **增量更新**: 只序列化变化部分

---

## 相关文档

- [怪物实体](./monster.md)
- [装备实体](./equipment.md)
- [架构总览](../ARCHITECTURE.md)