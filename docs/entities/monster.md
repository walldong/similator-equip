# 怪物实体 (Monster Entity)

怪物实体代表游戏中的敌人，包括普通怪、精英怪和Boss。

## 组件构成

怪物实体由以下组件组成：

```
Monster Entity
├── MonsterComponent  # 怪物核心数据
├── StatsComponent    # 属性数据
└── PositionComponent # 位置数据（地图中）
```

---

## MonsterComponent（怪物组件）

### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `monsterType` | `MonsterType` | 怪物类型（普通/精英/Boss） |
| `name` | `string` | 怪物名称 |
| `icon` | `string` | 怪物图标（emoji） |
| `hp` | `number` | 当前生命值 |
| `maxHp` | `number` | 最大生命值 |
| `atk` | `number` | 攻击力 |
| `def` | `number` | 防御力 |
| `exp` | `number` | 经验奖励 |
| `gold` | `number` | 金币奖励 |
| `dropRate` | `number` | 掉落率(%) |
| `qualityWeights` | `Record<Quality, number>` | 掉落品质权重 |

### 方法

```typescript
class MonsterComponent {
  // 受到伤害
  takeDamage(amount: number): number;
  
  // 检查是否存活
  isAlive(): boolean;
  
  // 掷品质
  rollQuality(): Quality;
  
  // 序列化/反序列化
  serialize(): Record<string, unknown>;
  static fromData(data: Record<string, unknown>): MonsterComponent;
  
  // 静态工厂方法
  static createBoss(config: MonsterConfig, multiplier?: number): MonsterComponent;
  static createElite(config: MonsterConfig, multiplier?: number): MonsterComponent;
}
```

---

## 怪物类型

| 类型 | 名称 | 说明 |
|------|------|------|
| `normal` | 普通怪 | 基础属性，正常掉落 |
| `elite` | 精英怪 | 属性增强1.3倍，奖励1.5倍 |
| `boss` | Boss | 属性增强1.5倍，奖励2倍 |

---

## 怪物模板

### 基础怪物

| ID | 名称 | 图标 | HP | 攻击 | 防御 | 经验 | 金币 | 掉落率 |
|----|------|------|-----|------|------|------|------|--------|
| `slime` | 史莱姆 | 🟢 | 150 | 12 | 3 | 20 | 15 | 35% |
| `goblin` | 哥布林 | 👺 | 300 | 25 | 10 | 35 | 25 | 40% |
| `skeleton` | 骷髅战士 | 💀 | 500 | 40 | 20 | 50 | 40 | 45% |
| `orc` | 兽人狂战 | 👹 | 800 | 60 | 35 | 80 | 70 | 50% |

### Boss怪物

| ID | 名称 | 图标 | HP | 攻击 | 防御 | 经验 | 金币 | 掉落率 |
|----|------|------|-----|------|------|------|------|--------|
| `dragon` | 暗影龙 | 🐉 | 2000 | 100 | 70 | 200 | 200 | 75% |
| `demon` | 深渊魔王 | 😈 | 5000 | 180 | 130 | 400 | 400 | 95% |

---

## 掉落品质权重

### 普通怪物

| 品质 | 史莱姆 | 哥布林 | 骷髅 | 兽人 |
|------|--------|--------|------|------|
| 普通 | 80% | 60% | 45% | 30% |
| 稀有 | 18% | 30% | 35% | 40% |
| 史诗 | 2% | 9% | 17% | 23% |
| 传说 | 0% | 1% | 3% | 6% |
| 神话 | 0% | 0% | 0% | 1% |

### Boss怪物

| 品质 | 暗影龙 | 深渊魔王 |
|------|--------|----------|
| 普通 | 15% | 5% |
| 稀有 | 30% | 20% |
| 史诗 | 35% | 35% |
| 传说 | 17% | 30% |
| 神话 | 3% | 10% |

---

## StatsComponent（属性组件）

怪物同样使用 `StatsComponent` 存储战斗属性：

```typescript
const stats = new StatsComponent({
  hp: config.hp,
  atk: config.atk,
  def: config.def,
});
```

---

## PositionComponent（位置组件）

地图中的怪物拥有位置信息：

```typescript
interface PositionComponent {
  type: 'position';
  x: number;
  y: number;
}
```

---

## 工厂方法

使用 `MonsterFactory` 创建怪物：

```typescript
const factory = new MonsterFactory(world);

// 创建普通怪物
const slime = factory.create('slime');
const goblin = factory.create('goblin');

// 创建精英怪（属性增强1.3倍）
const eliteGoblin = factory.createElite('goblin', 1.3);

// 创建Boss（属性增强1.5倍）
const boss = factory.createBoss('dragon', 1.5);

// 创建随机怪物（基于等级）
const randomMonster = factory.createRandom(playerLevel);

// 获取可用模板
const templates = MonsterFactory.getTemplateIds();
// ['slime', 'goblin', 'skeleton', 'orc', 'dragon', 'demon']

// 获取模板信息
const template = MonsterFactory.getTemplate('slime');
```

---

## 战斗系统

### 伤害计算

```typescript
// 基础伤害
let damage = attackerStats.atk;

// 暴击判定
const isCrit = Math.random() * 100 < attackerStats.critRate;
if (isCrit) {
  damage *= attackerStats.critDmg / 100;
}

// 防御减免
const reduction = defenderStats.def / (defenderStats.def + 100);
damage = Math.floor(damage * (1 - reduction));

// 穿透计算
damage += attackerStats.penetration;
```

### 战斗流程

1. 根据速度决定先手
2. 攻击方进行攻击判定
3. 防守方受到伤害
4. 检查是否死亡
5. 反击回合（如存活）
6. 重复直到一方死亡

---

## 掉落系统

### 掉落判定

```typescript
// 掉落率检查
if (Math.random() * 100 < monster.dropRate) {
  // 掷品质
  const quality = monster.rollQuality();
  
  // 生成装备
  const equipment = equipmentFactory.createRandom(level, quality);
}
```

### 掉落奖励

击杀怪物获得：

| 类型 | 计算方式 |
|------|----------|
| 经验 | `monster.exp`（精英×1.5，Boss×2） |
| 金币 | `monster.gold`（精英×1.5，Boss×2） |
| 装备 | 根据 `dropRate` 和 `qualityWeights` |

---

## 相关事件

| 事件类型 | 说明 | 数据 |
|----------|------|------|
| `BATTLE_START` | 战斗开始 | `{ playerId, monsterId }` |
| `BATTLE_ATTACK` | 攻击事件 | `{ attacker, defender, damage, isCrit }` |
| `BATTLE_VICTORY` | 战斗胜利 | `{ exp, gold, drops }` |
| `BATTLE_DEFEAT` | 战斗失败 | `{ }` |
| `MONSTER_DEFEATED` | 怪物被击败 | `{ monsterId, position }` |

---

## 相关系统

- **BattleSystem** - 战斗系统
- **DropSystem** - 掉落系统
- **MapGeneratorSystem** - 地图生成系统

---

## 副本配置

| 副本 | 等级 | 图标 | 怪物 | Boss |
|------|------|------|------|------|
| 迷雾森林 | 1 | 🌲 | 史莱姆×2, 哥布林 | 哥布林首领 |
| 幽暗洞穴 | 5 | 🕳️ | 骷髅×2, 哥布林 | 骷髅王 |
| 兽人要塞 | 10 | 🏰 | 兽人, 骷髅, 哥布林 | 兽人统领 |
| 龙之巢穴 | 15 | 🐉 | 兽人×2, 骷髅 | 暗影龙 |
| 深渊魔殿 | 20 | 🌋 | 龙, 兽人×2 | 深渊魔王 |

---

## 序列化格式

```typescript
interface MonsterData {
  id: EntityId;
  name: string;
  icon: string;
  type: MonsterType;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  exp: number;
  gold: number;
  dropRate: number;
  qualityWeights: Record<Quality, number>;
}
```

---

## 相关文档

- [玩家实体](./player.md)
- [装备实体](./equipment.md)
- [架构总览](../ARCHITECTURE.md)
