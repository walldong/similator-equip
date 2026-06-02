# 文档索引

## 架构文档

| 文档 | 说明 |
|------|------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | ECS 架构总览 |
| [QUICKSTART.md](./QUICKSTART.md) | 快速开始指南 |

## 实体文档

| 文档 | 说明 |
|------|------|
| [entities/player.md](./entities/player.md) | 玩家实体 - 组件、属性、背包、自动登录 |
| [entities/equipment.md](./entities/equipment.md) | 装备实体 - 词条、强化、合成 |
| [entities/monster.md](./entities/monster.md) | 怪物实体 - 模板、战斗、掉落 |
| [entities/world-map.md](./entities/world-map.md) | 世界地图 - 生成、重置、怪物分布、后端存储 |
| [entities/skill.md](./entities/skill.md) | 技能实体 - 怒气系统、技能类型 |
| [entities/battle.md](./entities/battle.md) | 战斗系统 - 回合制、怒气、掉落 |
| [entities/pixi-map.md](./entities/pixi-map.md) | Pixi.js地图 - 自由移动、区域系统、地形 |

## 工具库文档

| 文档 | 说明 |
|------|------|
| [lib/random-util.md](./lib/random-util.md) | 通用随机算法模块 |

## 文档结构

```
docs/
├── README.md              # 本文档
├── ARCHITECTURE.md        # ECS 架构总览
├── QUICKSTART.md          # 快速开始
└── entities/
    ├── player.md          # 玩家实体详细文档
    ├── equipment.md       # 装备实体详细文档
    └── monster.md         # 怪物实体详细文档
```

## 按主题查阅

### 组件相关

- [PlayerComponent](./entities/player.md#playercomponent玩家组件) - 玩家核心数据
- [StatsComponent](./entities/player.md#statscomponent属性组件) - 属性数据
- [InventoryComponent](./entities/player.md#inventorycomponent背包组件) - 背包数据
- [EquipmentComponent](./entities/equipment.md#equipmentcomponent装备组件) - 装备数据
- [MonsterComponent](./entities/monster.md#monstercomponent怪物组件) - 怪物数据

### 系统相关

- [StatCalculationSystem](./ARCHITECTURE.md#系统详解) - 属性计算
- [EnhancementSystem](./entities/equipment.md#强化系统) - 装备强化
- [SynthesisSystem](./entities/equipment.md#合成系统) - 装备合成
- [BattleSystem](./entities/monster.md#战斗系统) - 战斗逻辑
- [DropSystem](./entities/monster.md#掉落系统) - 掉落生成

### 工厂相关

- [CharacterFactory](./entities/player.md#工厂方法) - 玩家工厂
- [EquipmentFactory](./entities/equipment.md#工厂方法) - 装备工厂
- [MonsterFactory](./entities/monster.md#工厂方法) - 怪物工厂

### 事件相关

- [装备事件](./entities/equipment.md#相关事件)
- [玩家事件](./entities/player.md#相关事件)
- [战斗事件](./entities/monster.md#相关事件)
