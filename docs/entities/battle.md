# 战斗系统 (Battle System)

战斗系统是游戏的核心玩法，采用回合制战斗模式。

---

## 概述

- **战斗类型**: 回回制
- **触发方式**: 移动到怪物格子自动触发
- **胜负判定**: 怪物HP=0胜利，玩家HP=0失败

---

## 战斗流程

```
移动到怪物格子
    ↓
自动触发战斗
    ↓
回合制战斗
    ↓
胜利 → 获得掉落 + 经验 → 可能升级
失败 → 恢复50%生命 → 返回出生点
```

---

## BattleState 结构

```typescript
interface BattleState {
  isActive: boolean;              // 战斗是否进行中
  currentRound: number;           // 当前回合
  playerRage: number;             // 玩家怒气 (0-100)
  monsterRage: number;            // 怪物怒气 (0-100)
  playerHp: number;               // 玩家当前HP
  playerMaxHp: number;            // 玩家最大HP
  monsterName: string;            // 怪物名称
  monsterHp: number;              // 怪物当前HP
  monsterMaxHp: number;           // 怪物最大HP
  monsterLevel: number;           // 怪物等级
  monsterType: 'normal' | 'elite' | 'boss'; // 怪物类型
  logs: BattleLogEntry[];         // 战斗日志
  skills: SkillData[];            // 可用技能
  dropInfo?: {                    // 掉落信息（胜利时）
    gold: number;
    items: EquipmentItem[];
  };
}
```

---

## 怒气系统

### 怒气获取

- 每次普通攻击：+10% 怒气
- 怒气上限：100%

### 技能消耗

| 技能 | 消耗 | 效果 |
|------|------|------|
| 重击 | 30% | 1.5倍伤害 |
| 旋风斩 | 50% | 2倍伤害 |
| 致命一击 | 80% | 3倍伤害 |
| 治愈之光 | 40% | 恢复30%最大HP |
| 战吼 | 100% | 2.5倍伤害 |
| 狂暴 | 100% | 3倍伤害 |

---

## 怪物属性计算

### HP计算

```typescript
const baseHp = 100 + monsterLevel * 20;
const hpMult = monsterType === 'boss' ? 5 : monsterType === 'elite' ? 2 : 1;
const monsterMaxHp = Math.floor(baseHp * hpMult);
```

### 攻击力计算

```typescript
const monsterAtk = Math.floor(30 + monsterLevel * 5);
```

---

## 伤害计算

### 玩家攻击

```typescript
const isCrit = Math.random() * 100 < critRate;
const damage = Math.floor(atk * (isCrit ? critDmg / 100 : 1));
```

### 怪物反击

```typescript
const monsterDamage = Math.max(1, monsterAtk - playerDef);
```

---

## 战斗掉落

### 掉落触发

击败怪物时立即计算掉落，存储在 `dropInfo` 中。

### 金币掉落

```typescript
const goldMult = monsterType === 'boss' ? 5 : monsterType === 'elite' ? 2 : 1;
const goldDrop = Math.floor((10 + monsterLevel * 5) * goldMult);
```

### 装备掉落

| 怪物类型 | 掉落数量 |
|----------|----------|
| 普通 | 0-2 件 |
| 精英 | 1-3 件 |
| Boss | 2-5 件 |

### 品质概率

| 品质 | 概率 |
|------|------|
| 普通 | 50% |
| 稀有 | 30% |
| 史诗 | 15% |
| 传说 | 4% |
| 神话 | 1% |

---

## 经验与升级

### 经验获取

```typescript
const expMult = monsterType === 'boss' ? 5 : monsterType === 'elite' ? 2 : 1;
const expGain = Math.floor((10 + monsterLevel * 5) * expMult);
```

### 升级逻辑

```typescript
while (newExp >= newLevel * 100) {
  newExp -= newLevel * 100;
  newLevel++;
  // 属性提升
  newMaxHp = 200 + newLevel * 50;
  newAtk = 50 + newLevel * 10;
  newDef = 30 + newLevel * 5;
  newSpd = 20 + newLevel * 2;
}
```

---

## 战斗失败处理

失败时：
- 恢复 50% 最大生命值
- 传送回出生点（地图中心）
- 怪物仍然存在

---

## 战斗UI

### 显示内容

- 玩家/怪物 HP条和怒气条
- 战斗日志（最近8条）
- 普通攻击按钮
- 技能按钮（显示怒气消耗）
- 胜利/失败提示 + 掉落预览

### 掉落预览

胜利时显示：
```
💰 金币: +XXX
🎁 装备: +X件
```

---

## 相关文档

- [技能实体](./skill.md)
- [怪物实体](./monster.md)
- [装备实体](./equipment.md)
- [世界地图](./world-map.md)