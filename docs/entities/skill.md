# 技能实体 (Skill Entity)

技能实体代表战斗中可释放的技能，消耗怒气值释放。

## 概述

- **类型**: 攻击型、治疗型、增益型、减益型、终极技能
- **消耗**: 怒气值 (0-100)
- **释放时机**: 玩家回合时可选择释放

---

## 技能结构

```
Skill Entity
└── SkillComponent  # 技能数据
```

---

## SkillComponent（技能组件）

### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `id` | `EntityId` | 技能唯一ID |
| `name` | `string` | 技能名称 |
| `description` | `string` | 技能描述 |
| `skillType` | `SkillType` | 技能类型 |
| `target` | `SkillTarget` | 目标类型 |
| `rageCost` | `number` | 怒气消耗 |
| `baseDamage` | `number` | 基础伤害 |
| `damageMultiplier` | `number` | 伤害倍率 |
| `healPercent` | `number` | 治疗百分比 |
| `cooldown` | `number` | 冷却回合数 |
| `currentCooldown` | `number` | 当前冷却 |
| `icon` | `string` | 技能图标 |

### 方法

```typescript
class SkillComponent {
  // 检查是否可以释放
  canUse(currentRage: number): boolean;
  
  // 使用技能
  use(): void;
  
  // 减少冷却
  reduceCooldown(): void;
  
  // 重置冷却
  resetCooldown(): void;
}
```

---

## 技能类型 (SkillType)

| 类型 | 说明 |
|------|------|
| `attack` | 攻击型技能 |
| `heal` | 治疗型技能 |
| `buff` | 增益型技能 |
| `debuff` | 减益型技能 |
| `ultimate` | 终极技能 |

---

## 目标类型 (SkillTarget)

| 类型 | 说明 |
|------|------|
| `self` | 自身 |
| `enemy` | 敌人 |
| `all` | 全体 |

---

## 玩家默认技能

| 技能名 | 类型 | 怒气消耗 | 效果 | 图标 |
|--------|------|----------|------|------|
| 重击 | 攻击 | 30% | 150%攻击力伤害 | ⚔️ |
| 旋风斩 | 攻击 | 50% | 200%攻击力伤害 | 🌀 |
| 致命一击 | 攻击 | 80% | 300%攻击力伤害，必定暴击 | 💥 |
| 治愈之光 | 治疗 | 40% | 恢复30%最大生命值 | 💚 |
| 战吼 | 终极 | 100% | 250%攻击力伤害 + 恢复20%生命值 | 🔥 |
| 狂暴 | 终极 | 100% | 400%攻击力伤害 | 😈 |

---

## 怪物技能

### 普通怪物

| 技能名 | 怒气消耗 | 效果 |
|--------|----------|------|
| 撕咬 | 25% | 120%攻击力伤害 |

### 精英怪物

| 技能名 | 怒气消耗 | 效果 |
|--------|----------|------|
| 撕咬 | 25% | 120%攻击力伤害 |
| 猛击 | 50% | 180%攻击力伤害 |

### Boss

| 技能名 | 怒气消耗 | 效果 |
|--------|----------|------|
| 撕咬 | 25% | 120%攻击力伤害 |
| 猛击 | 50% | 180%攻击力伤害 |
| Boss怒击 | 80% | 300%攻击力伤害 |

---

## 怒气系统

### 怒气获取

- **普通攻击**: 每次 +10% 怒气
- **被攻击**: 不增加怒气
- **最大值**: 100%

### 怒气消耗

- 释放技能时消耗对应怒气值
- 怒气不足时无法释放技能

### 战斗流程

```
回合开始
    ↓
根据攻速比值计算攻击次数
    ↓
执行攻击队列
    ├── 玩家回合 → 可选择普通攻击或释放技能
    │   ├── 普通攻击 → 怒气 +10%
    │   └── 释放技能 → 消耗怒气，造成技能效果
    └── 怪物回合 → 普通攻击，有几率使用技能
    ↓
回合结束，检查战斗结果
```

---

## 攻击速度系统

### 攻击次数计算

```typescript
// 基础攻击次数 4-8 次
const baseAttacks = RandomUtil.randomInt(4, 8);

// 根据攻速比值分配
const totalSpd = playerSpd + monsterSpd;
const playerAttackRatio = playerSpd / totalSpd;
const monsterAttackRatio = monsterSpd / totalSpd;

const playerAttacks = Math.round(baseAttacks * playerAttackRatio);
const monsterAttacks = baseAttacks - playerAttacks;
```

### 攻击顺序

- 速度快的角色先攻击
- 同速度时随机决定

### 示例

| 玩家速度 | 怪物速度 | 玩家攻击 | 怪物攻击 |
|----------|----------|----------|----------|
| 30 | 20 | 4 次 | 2 次 |
| 50 | 50 | 3 次 | 3 次 |
| 100 | 50 | 5 次 | 2 次 |

---

## 工厂方法

```typescript
const factory = new SkillFactory(world);

// 创建单个技能
const heavyStrike = factory.create('heavyStrike');

// 创建玩家默认技能
const playerSkills = factory.createPlayerDefaultSkills();

// 创建怪物技能
const monsterSkills = factory.createMonsterSkills('boss');

// 获取技能模板
const template = SkillFactory.getTemplate('heavyStrike');
```

---

## 相关事件

| 事件类型 | 说明 | 数据 |
|----------|------|------|
| `BATTLE_START` | 战斗开始 | `{ playerId, monsterId }` |
| `BATTLE_ATTACK` | 攻击事件 | `{ attacker, defender, damage }` |
| `BATTLE_VICTORY` | 战斗胜利 | `{ exp, gold, drops }` |
| `BATTLE_DEFEAT` | 战斗失败 | `{ }` |

---

## 战斗UI建议

### 技能按钮显示

- 显示技能图标和名称
- 怒气足够时高亮显示
- 怒气不足时灰色显示并标注需求
- 冷却中显示剩余回合数

### 怒气条显示

- 当前怒气百分比
- 技能怒气需求标记
- 怒气增加动画效果

### 战斗日志

```
⚔️ 战斗开始！
📊 第 1 回合
⚡ 攻击顺序: 玩家 4 次, 怪物 2 次
⚔️ 对 史莱姆 造成 50 点伤害
🔥 怒气 +10%，当前: 10%
💥 暴击！对 史莱姆 造成 120 点伤害
🔥 怒气 +10%，当前: 20%
✨ 使用技能: 重击
💫 对 史莱姆 造成 150 点伤害
👊 史莱姆 对你造成 15 点伤害
🎉 战斗胜利！获得 20 经验, 15 金币
🎁 获得装备 1 件
```

---

## 相关文档

- [玩家实体](./player.md)
- [怪物实体](./monster.md)
- [随机算法](../lib/random-util.md)
- [架构总览](../ARCHITECTURE.md)
