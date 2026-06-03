# 装备强化模拟器

基于 **Next.js 15** 和 **ECS（Entity-Component-System）架构**的装备强化模拟器，采用 TypeScript 开发，支持用户注册登录和数据持久化。

## 功能特性

### 核心玩法
- **装备系统**：6个装备槽位（武器、头盔、胸甲、护手、鞋子、首饰）
- **强化系统**：最高+21，每+3级升级随机副词条，+10以上失败装备损坏消失
- **合成系统**：相同品质装备合成，有几率提升品质
- **副本战斗**：5个副本，击败怪物获得装备掉落
- **品质系统**：普通、稀有、史诗、传说、神话 5个品质等级

### 世界地图
- **6张大地图**：新手草原、幽暗森林、灼热沙漠、冰霜高原、熔岩地带、暗影深渊
- **区域系统**：每张地图4个区域，每个区域一个小Boss
- **最终Boss**：击败4个小Boss后召唤最终Boss
- **自动战斗**：支持自动探索地图，自动售卖指定品质装备

### 用户系统
- 简易注册：输入用户名即可注册，自动生成UUID
- 快速登录：输入用户名即可登录，自动加载数据
- 数据持久化：自动保存到MySQL数据库

---

## 自动战斗系统

### 功能概述

自动战斗系统允许玩家自动探索地图，无需手动操作即可完成战斗和拾取奖励。

### 配置选项

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| 跳过最终Boss | 是否跳过最终Boss战斗 | 启用 |
| 最低血量% | 低于此血量时暂停战斗 | 30% |
| 战斗间隔 | 每次战斗之间的间隔时间 | 500ms |
| 自动售卖品质 | 战斗胜利后自动售卖的装备品质 | 普通、稀有 |

### 战斗逻辑

1. **寻怪**：使用BFS算法搜索最近的怪物
2. **技能选择**：
   - 怒气 ≥ 100：使用狂暴（200%伤害）
   - 怒气 ≥ 80：使用致命一击（200%伤害）
   - 怒气 ≥ 50：使用旋风斩（100%伤害）
   - 怒气 ≥ 30：使用重击（50%伤害）
   - 怒气 < 30：普通攻击
3. **自动治疗**：血量低于40%且怒气 ≥ 40时自动治疗（恢复30%最大生命）
4. **胜利奖励**：
   - 获得30%最大生命值恢复
   - 获得金币、经验、装备
   - 自动售卖配置品质的装备

### API接口

#### 获取自动战斗配置
```
GET /api/auto-battle/config/:userId
Response: { "success": true, "data": { "enabled": false, "skipFinalBoss": true, ... } }
```

#### 设置自动战斗配置
```
POST /api/auto-battle/config
Request:  { "userId": 1, "config": { "skipFinalBoss": true, "minHpPercent": 30 } }
Response: { "success": true, "data": { ... } }
```

#### 执行一次自动战斗
```
POST /api/auto-battle/execute
Request:  { "userId": 1 }
Response: { "success": true, "data": { "victory": true, "rewards": { ... }, "autoSold": { ... } } }
```

---

## 技术架构

### Next.js 15 + TypeScript

项目采用最新的 Next.js 15 App Router，使用 TypeScript 进行类型安全开发。

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # API 路由
│   │   ├── login/          # 登录 API
│   │   ├── register/       # 注册 API
│   │   ├── save/           # 保存 API
│   │   └── equipments/     # 装备 API
│   ├── components/         # React 组件
│   ├── layout.tsx          # 根布局
│   ├── page.tsx            # 主页
│   └── globals.css         # 全局样式
│
├── core/                   # ECS 核心架构
│   ├── Entity.ts           # 实体基类
│   ├── Component.ts        # 组件基类
│   ├── System.ts           # 系统基类
│   ├── World.ts            # 世界管理器
│   └── EventBus.ts         # 事件总线
│
├── components/             # 游戏组件
│   ├── StatsComponent.ts   # 属性组件
│   ├── EquipmentComponent.ts # 装备组件
│   ├── PlayerComponent.ts  # 玩家组件
│   ├── InventoryComponent.ts # 背包组件
│   ├── MonsterComponent.ts # 怪物组件
│   ├── PositionComponent.ts # 位置组件
│   └── BattleComponent.ts  # 战斗组件
│
├── systems/                # 游戏系统
│   ├── StatCalculationSystem.ts # 属性计算
│   ├── EnhancementSystem.ts # 强化系统
│   ├── BattleSystem.ts     # 战斗系统
│   ├── SynthesisSystem.ts  # 合成系统
│   ├── DropSystem.ts       # 掉落系统
│   ├── InventorySystem.ts  # 背包系统
│   ├── EquipmentSystem.ts  # 装备管理
│   └── MapGeneratorSystem.ts # 地图生成
│
├── factories/              # 工厂类
│   ├── EquipmentFactory.ts # 装备工厂
│   ├── MonsterFactory.ts   # 怪物工厂
│   └── CharacterFactory.ts # 角色工厂
│
├── data/                   # 游戏数据
│   └── gameData.ts         # 配置数据
│
├── lib/                    # 工具库
│   ├── database.ts         # 数据库模块
│   └── useGame.ts          # 游戏状态 Hook
│
└── types/                  # 类型定义
    └── index.ts
```

---

## ECS 架构详解

### 核心概念

ECS（Entity-Component-System）是一种数据驱动的架构模式，将游戏对象分为三个核心部分：

```
┌─────────────────────────────────────────────────────────────┐
│                        World（世界）                          │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    Entities（实体）                       │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │ │
│  │  │  Player     │  │ Equipment   │  │  Monster    │     │ │
│  │  │  Entity     │  │  Entity     │  │  Entity     │     │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                  Components（组件）                       │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │ │
│  │  │  Stats   │ │Equipment │ │ Affix    │ │Inventory │   │ │
│  │  │Component │ │Component │ │Component │ │Component │   │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    Systems（系统）                        │ │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐          │ │
│  │  │Enhancement │ │ Synthesis  │ │  Battle    │  ...     │ │
│  │  │  System    │ │  System    │ │  System    │          │ │
│  │  └────────────┘ └────────────┘ └────────────┘          │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Entity（实体）

实体是唯一的标识符，可以附加任意数量的组件：

```typescript
class Entity {
  public readonly id: EntityId;
  public readonly components: Map<ComponentType, IComponent>;
  
  addComponent(component: IComponent): this;
  removeComponent(type: ComponentType): boolean;
  getComponent<T>(type: ComponentType): T | undefined;
  hasComponent(type: ComponentType): boolean;
}
```

### Component（组件）

组件是纯数据容器，不包含任何逻辑：

| 组件名 | 用途 | 主要属性 |
|--------|------|----------|
| `StatsComponent` | 属性数据 | `baseStats`, `bonusStats`, `currentHp` |
| `PlayerComponent` | 玩家数据 | `level`, `exp`, `gold`, `equipmentSlots` |
| `InventoryComponent` | 背包数据 | `items[]`, `maxSize` |
| `EquipmentComponent` | 装备数据 | `slot`, `level`, `quality`, `mainAffix`, `subAffixes` |
| `MonsterComponent` | 怪物数据 | `hp`, `atk`, `def`, `exp`, `gold`, `dropRates` |
| `BattleComponent` | 战斗状态 | `isActive`, `logs[]`, `result` |
| `PositionComponent` | 位置数据 | `x`, `y` |

### System（系统）

系统处理特定组件的逻辑：

| 系统名 | 职责 |
|--------|------|
| `StatCalculationSystem` | 角色属性计算 |
| `EnhancementSystem` | 装备强化逻辑 |
| `SynthesisSystem` | 装备合成逻辑 |
| `BattleSystem` | 战斗回合处理 |
| `InventorySystem` | 背包管理 |
| `EquipmentSystem` | 穿戴/卸下装备 |
| `DropSystem` | 掉落生成 |
| `MapGeneratorSystem` | 地图随机生成 |

### EventBus（事件总线）

系统间解耦通信的核心：

```typescript
// 订阅事件
eventBus.on(EventType.EQUIPMENT_ENHANCED, (data) => {
  console.log('装备强化成功', data);
});

// 触发事件
eventBus.emit(EventType.INVENTORY_CHANGED, { playerId });
```

---

## 抽象设计

### 1. 装备抽象

```typescript
// 装备工厂 - 快速创建新装备
const equipmentFactory = new EquipmentFactory(world);

// 创建武器
const weapon = equipmentFactory.create('weapon', 10, 'epic');

// 创建随机装备
const randomEq = equipmentFactory.createRandom(5, 'legendary');

// 恢复装备
const restored = equipmentFactory.restore(equipmentData);
```

### 2. 词条抽象

```typescript
// 主词条（固定）
const MainAffixBySlot = {
  weapon: StatType.ATK_PERCENT,
  chestplate: StatType.DEF_PERCENT,
  helmet: StatType.DEF_FLAT,
  boots: StatType.SPD_FLAT,
  gloves: StatType.ATK_FLAT,
  accessory: StatType.CRIT_DMG,
};

// 副词条（随机生成）
const subAffixes = generateSubAffixes(slot, level, quality);
```

### 3. 角色抽象

```typescript
// 角色工厂
const characterFactory = new CharacterFactory(world);

// 创建新玩家
const player = characterFactory.createNewPlayer('玩家名');

// 从存档恢复
const restored = characterFactory.restore(saveData);
```

### 4. 怪物抽象

```typescript
// 怪物工厂
const monsterFactory = new MonsterFactory(world);

// 创建普通怪物
const slime = monsterFactory.create('slime');

// 创建精英怪
const eliteGoblin = monsterFactory.createElite('goblin', 1.3);

// 创建Boss
const boss = monsterFactory.createBoss('dragon', 1.5);

// 创建随机怪物（基于等级）
const randomMonster = monsterFactory.createRandom(playerLevel);
```

### 5. 地图抽象

```typescript
// 地图生成系统
const mapGenerator = world.getSystem<MapGeneratorSystem>('mapGenerator');

// 生成地图
const mapId = mapGenerator.generateMap(MapConfigs.medium, 'forest');

// 获取地图数据
const map = mapGenerator.getMap(mapId);

// 移动玩家
mapGenerator.movePlayer(mapId, dx, dy);

// 检查遭遇
const encounter = mapGenerator.checkEncounter(mapId);
```

---

## 扩展指南

### 添加新装备类型

```typescript
// 1. 在 types/index.ts 中添加新槽位
export type EquipmentSlot = 'weapon' | 'helmet' | ... | 'shield'; // 新增盾牌

// 2. 在 data/gameData.ts 中添加配置
export const SlotNames = {
  ...
  shield: '盾牌',
};

export const SlotIcons = {
  ...
  shield: '🛡️',
};

// 3. 在 factories/EquipmentFactory.ts 中添加主词条
const MainAffixBySlot = {
  ...
  shield: StatType.DEF_PERCENT,
};
```

### 添加新词条

```typescript
// 1. 在 types/index.ts 中添加词条类型
export enum StatType {
  ...
  LIFE_STEAL: 'LIFE_STEAL',  // 新增吸血
}

// 2. 在 data/gameData.ts 中添加配置
export const StatNames = {
  ...
  [StatType.LIFE_STEAL]: '吸血',
};

export const AffixBaseValues = {
  ...
  [StatType.LIFE_STEAL]: 3,
};

// 3. 在 StatCalculationSystem 中处理新词条
case StatType.LIFE_STEAL:
  statsComp.addFlatBonus('lifeSteal', value);
  break;
```

### 添加新怪物

```typescript
// 在 factories/MonsterFactory.ts 中的 MonsterTemplates 添加
const MonsterTemplates = {
  ...
  ghost: {
    name: '幽灵',
    icon: '👻',
    type: 'normal',
    hp: 400,
    atk: 35,
    def: 15,
    exp: 45,
    gold: 35,
    dropRate: 42,
    qualityWeights: { normal: 50, rare: 35, epic: 13, legendary: 2, mythic: 0 },
  },
};
```

### 添加新副本

```typescript
// 在 data/gameData.ts 中的 DungeonConfigs 添加
{
  id: 'temple',
  name: '神殿遗迹',
  icon: '🏛️',
  level: 25,
  mapSize: 'large',
  monsters: ['ghost', 'ghost', 'skeleton'],
  boss: 'demon',
  bossName: '神殿守护者',
  bossIcon: '🗿',
  isRandom: true,
}
```

---

## API 接口

### 用户相关

#### 注册
```
POST /api/register
Request:  { "username": "player1" }
Response: { "success": true, "data": { "id": 1, "username": "player1", ... } }
```

#### 登录
```
POST /api/login
Request:  { "username": "player1" }
Response: { "success": true, "data": { ... } }
```

#### 保存
```
POST /api/save
Request:  { "userId": 1, "data": { "level": 5, ... } }
Response: { "success": true }
```

#### 保存装备
```
POST /api/equipments/save
Request:  { "userId": 1, "equipments": [...], "equippedSlots": {...} }
Response: { "success": true }
```

---

## 运行方式

### 1. 安装依赖
```bash
npm install
```

### 2. 开发模式
```bash
npm run dev
```

服务器将在 `http://localhost:3000` 启动。

### 3. 生产构建
```bash
npm run build
npm start
```

---

## 游戏平衡系统

### 设计理念

游戏平衡系统确保玩家在不同阶段的游戏体验：

1. **刚进地图时**：能打过普通怪，打不过精英怪
2. **打完一半小怪后**：能打过精英怪
3. **地图毕业时**：能打过小Boss和最终Boss（使用技能）

### 地图平衡配置

每个地图定义三个阶段的玩家属性：

| 地图 | 等级范围 | early阶段 | mid阶段 | final阶段 |
|------|----------|-----------|---------|----------|
| 新手草原 | 1-10 | Lv1, 装备Lv1, +0 | Lv5, 装备Lv1, +3 | Lv10, 装备Lv5, +6 |
| 幽暗森林 | 11-20 | Lv11, 装备Lv5, +6 | Lv15, 装备Lv10, +8 | Lv20, 装备Lv15, +10 |
| 灼热沙漠 | 21-30 | Lv21, 装备Lv15, +10 | Lv25, 装备Lv20, +10 | Lv30, 装备Lv25, +11 |
| 冰霜高原 | 31-40 | Lv31, 装备Lv25, +11 | Lv35, 装备Lv30, +11 | Lv40, 装备Lv35, +12 |
| 熔岩地带 | 41-50 | Lv41, 装备Lv35, +12 | Lv45, 装备Lv40, +12 | Lv50, 装备Lv45, +12 |
| 暗影深渊 | 51-60 | Lv51, 装备Lv45, +12 | Lv55, 装备Lv50, +12 | Lv60, 装备Lv55, +12 |

> **注意**：装备强化+10以上有碎裂风险，所以final阶段强化等级控制在+12以内

### 怪物强度设计

怪物属性根据目标玩家属性动态计算：

| 怪物类型 | 目标回合数 | 每回合伤害比例 | 目标玩家阶段 |
|----------|------------|----------------|--------------|
| 普通怪 | 3回合 | 10%玩家血量 | early |
| 精英怪 | 5回合 | 15%玩家血量 | mid |
| 小Boss | 7回合（使用技能） | 10%玩家血量 | final |
| 最终Boss | 10回合（使用技能） | 12%玩家血量 | final |

### 战斗模拟结果

以地图2（幽暗森林）为例：

```
early玩家 (Lv11, 装备Lv5, +6, rare):
  - 普通怪: ✓ 3回合击杀, 剩余70%血
  - 精英怪: ✗ 9回合击杀, 剩余0%血 (打不过)

mid玩家 (Lv15, 装备Lv10, +8, rare):
  - 普通怪: ✓ 2回合击杀, 剩余89%血
  - 精英怪: ✓ 5回合击杀, 剩余25%血

final玩家 (Lv20, 装备Lv15, +10, rare):
  - 小Boss: ✓ 5回合击杀(技能), 剩余50%血
  - 最终Boss: ✓ 7回合击杀(技能), 剩余16%血
```

### 装备属性动态计算

装备属性由以下因素决定：

1. **装备等级倍率**：`1 + (equipLevel - 1) * 0.1`
   - 1级装备: 1.0x
   - 5级装备: 1.4x
   - 10级装备: 1.9x
   - 15级装备: 2.4x

2. **强化等级倍率**：`1 + enhanceLevel * 0.05`
   - +0: 1.0x
   - +5: 1.25x
   - +10: 1.5x
   - +12: 1.6x

3. **品质倍率**：
   - 普通: 1.0x
   - 稀有: 1.3x
   - 史诗: 1.6x
   - 传说: 2.0x
   - 神话: 2.5x

4. **主词条加成**：主词条额外 1.2x 倍率

### 属性计算公式

```
最终属性 = (基础属性 + 装备固定值) × (1 + 装备百分比/100)

词条值 = 基础值 × 品质倍率 × 装备等级倍率 × 强化倍率 × 主词条加成 × 随机波动(0.8~1.2)
```

### 防御减免公式

```
防御减免 = 1 - 防御/(防御 + 100)
伤害 = 攻击力 × 防御减免 × 随机波动(0.95~1.05)
```

### 核心代码位置

- **平衡配置**: `backend/gameBalance.js`
- **装备生成**: `backend/gameLogic.js`
- **地图配置**: `backend/mapConfig.js`
- **地图生成**: `backend/mapGenerator.js`

### 调试命令

```bash
cd backend
node -e "const { printBalanceDebug } = require('./gameBalance'); printBalanceDebug();"
```

---

## 词条系统

### 主词条（固定）

| 部位 | 主词条 | 说明 |
|------|--------|------|
| 🗡️ 武器 | 攻击力% | 百分比攻击力加成 |
| 🛡️ 胸甲 | 防御力% | 百分比防御力加成 |
| 🪖 头盔 | 防御力 | 固定防御力加成 |
| 👢 鞋子 | 速度 | 固定速度加成 |
| 🧤 护手 | 攻击力 | 固定攻击力加成 |
| 💍 首饰 | 暴击伤害% | 百分比暴击伤害加成 |

### 副词条（随机）

通用副词条：攻击力、攻击力%、防御力、防御力%、生命值、生命值%、速度、速度%、暴击率、暴击伤害

部位特有副词条：
- 武器：力量
- 鞋子：移动速度
- 头盔：技能冷却
- 护手：护甲
- 首饰：暴击率（额外）
- 胸甲：生命值（额外）

---

## 强化系统

### 成功率

| 等级 | 成功率 | 失败后果 |
|------|--------|----------|
| +0 ~ +9 | 95% ~ 55% | 无（等级保持不变） |
| +10 ~ +20 | 50% ~ 3% | 装备损坏消失 |

### 词条升级

强化等级达到 3, 6, 9, 12, 15, 18, 21 时，随机升级一个副词条（20%~40%）。

---

## 技术栈

- **框架**: Next.js 15 (App Router)
- **语言**: TypeScript 5
- **样式**: CSS Modules
- **状态管理**: React Hooks + 自定义 Hook
- **数据库**: MySQL 8.0
- **缓存**: Redis 7
- **架构**: ECS (Entity-Component-System)

---

## 版本历史

- **v4.1** - 新增自动战斗系统，支持自动探索地图和自动售卖装备
- **v4.0** - 重构为 Next.js + TypeScript，完善 ECS 架构，添加世界地图系统
- **v3.0** - 重构为 Vue 3 + SQLite
- **v2.0** - 重构为 ECS 架构，添加用户系统
- **v1.0** - 基础功能实现

---

## 许可证

MIT License