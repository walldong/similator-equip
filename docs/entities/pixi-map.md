# Pixi.js 地图系统

基于 Pixi.js 的实时地图渲染系统，支持自由移动和流畅动画。

---

## 概述

- **渲染引擎**: Pixi.js 8.x
- **地图大小**: 200×200 格子
- **移动方式**: WASD / 方向键，像素级自由移动
- **战斗触发**: 与怪物碰撞触发

---

## 数据结构

### GameMap

```typescript
interface GameMap {
  width: number;          // 格子宽度 (200)
  height: number;         // 格子高度 (200)
  tileSize: number;       // 格子像素大小 (32)
  cells: MapCell[][];      // 二维数组 [y][x]
  player: PlayerPosition;
  zones: MapZone[];
  stats: MapStats;
}
```

### MapCell

```typescript
interface MapCell {
  x: number;              // 格子坐标
  y: number;
  terrain: TerrainType;   // 地形类型
  walkable: boolean;      // 是否可通行
  entity?: MapEntity;     // 格子上的实体
}
```

### MapEntity

```typescript
interface MapEntity {
  id: string;
  type: EntityType;       // 'monster' | 'elite' | 'boss' | 'chest' | 'npc' | 'portal'
  level: number;
  name: string;
  defeated?: boolean;
}
```

### PlayerPosition

```typescript
interface PlayerPosition {
  x: number;    // 像素坐标
  y: number;
  cellX: number; // 格子坐标
  cellY: number;
}
```

---

## 地形类型

| 地形 | 颜色 | 可通行 | 移动消耗 |
|------|------|--------|----------|
| `grass` | 绿色 | ✓ | 1 |
| `forest` | 深绿 | ✓ | 1.5 |
| `sand` | 黄色 | ✓ | 1 |
| `stone` | 灰色 | ✓ | 1 |
| `water` | 蓝色 | ✗ | - |
| `lava` | 红色 | ✗ | - |

---

## 区域系统

地图被划分为多个区域，每个区域有不同的怪物等级：

| 区域 | 等级范围 | 地形 | 怪物类型 |
|------|----------|------|----------|
| 新手草原 | 1-20 | grass | 野猪、野狼、史莱姆 |
| 幽暗森林 | 21-40 | forest | 树妖、精灵、毒蜘蛛 |
| 灼热沙漠 | 41-60 | sand | 沙虫、木乃伊、蝎子 |
| 冰霜高原 | 61-80 | stone | 石巨人、骷髅、蝙蝠 |
| 熔岩地带 | 81-100 | lava | 火元素、熔岩怪、恶魔 |

---

## 地图生成

### 配置参数

```typescript
const DEFAULT_MAP_CONFIG: MapConfig = {
  width: 200,
  height: 200,
  tileSize: 32,
  monsterDensity: 0.05,   // 5% 格子有怪物
  eliteRatio: 0.1,       // 10% 的怪物是精英
  bossRatio: 0.02,       // 2% 的怪物是Boss
  chestDensity: 0.02,    // 2% 格子有宝箱
  zoneCount: 6,           // 6个区域
};
```

### 生成流程

```
1. 划分区域 → 2. 生成地形 → 3. 添加障碍 → 4. 放置怪物 → 5. 放置宝箱
```

---

## 渲染优化

### 视口裁剪

只渲染玩家周围可见的格子：

```typescript
const startCellX = Math.max(0, player.cellX - viewRadius - 1);
const endCellX = Math.min(width, player.cellX + viewRadius + 1);
```

### 视口跟随

玩家始终在视口中心：

```typescript
mapContainer.x = VIEWPORT_WIDTH / 2 - player.x;
mapContainer.y = VIEWPORT_HEIGHT / 2 - player.y;
```

---

## 移动系统

### 键盘输入

```typescript
// WASD 或方向键
if (keys.has('w') || keys.has('arrowup')) dy = -1;
if (keys.has('s') || keys.has('arrowdown')) dy = 1;
if (keys.has('a') || keys.has('arrowleft')) dx = -1;
if (keys.has('d') || keys.has('arrowright')) dx = 1;
```

### 对角线归一化

```typescript
if (dx !== 0 && dy !== 0) {
  dx *= 0.707; // 1/√2
  dy *= 0.707;
}
```

### 碰撞检测

```typescript
const cellX = Math.floor(newX / tileSize);
const cellY = Math.floor(newY / tileSize);
const cell = cells[cellY]?.[cellX];

if (cell && cell.walkable) {
  // 允许移动
}
```

---

## 战斗触发

当玩家进入有怪物的格子时：

```typescript
if (cell.entity && !cell.entity.defeated) {
  keysRef.current.clear(); // 清空输入
  onEncounter(cell);       // 触发战斗
}
```

---

## 组件使用

```tsx
import PixiMap from './PixiMap';

<PixiMap 
  map={state.gameMap}
  currentHp={state.currentHp}
  maxHp={state.maxHp}
  onMove={movePlayer}
  onEncounter={handleEncounter}
/>
```

---

## 相关文档

- [战斗系统](./battle.md)
- [地图生成器](../lib/map-generator.md)
- [随机工具](../lib/random-util.md)
