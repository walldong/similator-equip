# 装备强化模拟器

基于 **Next.js 15** 和 **ECS（Entity-Component-System）架构**的装备强化模拟器，采用 TypeScript 开发，支持用户注册登录和数据持久化。

## 功能特性

### 核心玩法
- **装备系统**：6个装备槽位（武器、头盔、胸甲、护手、鞋子、首饰）
- **强化系统**：最高+21，每+3级升级随机副词条，+10以上失败装备损坏消失
- **合成系统**：相同品质装备合成，有几率提升品质
- **副本战斗**：5个副本，击败怪物获得装备掉落
- **品质系统**：普通、稀有、史诗、传说、神话 5个品质等级

### 用户系统
- 简易注册：输入用户名即可注册，自动生成UUID
- 快速登录：输入用户名即可登录，自动加载数据
- 数据持久化：自动保存到SQLite数据库

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
- **数据库**: SQLite (better-sqlite3)
- **架构**: ECS (Entity-Component-System)

---

## 版本历史

- **v4.0** - 重构为 Next.js + TypeScript，完善 ECS 架构
- **v3.0** - 重构为 Vue 3 + SQLite
- **v2.0** - 重构为 ECS 架构，添加用户系统
- **v1.0** - 基础功能实现

---

## 许可证

MIT License