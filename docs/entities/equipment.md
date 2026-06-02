# 装备实体 (Equipment Entity)

装备实体代表游戏中的装备物品，可通过强化、合成等方式提升属性。

## 组件构成

装备实体只有一个核心组件：

```
Equipment Entity
└── EquipmentComponent  # 装备核心数据
```

---

## EquipmentComponent（装备组件）

### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `slot` | `EquipmentSlot` | 装备槽位类型 |
| `level` | `number` | 强化等级（0~21） |
| `quality` | `Quality` | 品质等级 |
| `isBroken` | `boolean` | 是否损坏 |
| `mainAffix` | `Affix` | 主词条（固定） |
| `subAffixes` | `Affix[]` | 副词条列表（最多4条） |

### 方法

```typescript
class EquipmentComponent {
  // 强化装备
  enhance(): { success: boolean; broken: boolean; upgradedAffix?: Affix };
  
  // 升级随机副词条
  upgradeRandomSubAffix(): Affix | undefined;
  
  // 获取所有词条
  getAllAffixes(): Affix[];
  
  // 序列化/反序列化
  serialize(): Record<string, unknown>;
  static fromData(data: Record<string, unknown>): EquipmentComponent;
}
```

---

## 装备槽位

| 槽位 | 名称 | 图标 | 主词条 |
|------|------|------|--------|
| `weapon` | 武器 | ⚔️ | 攻击力% |
| `helmet` | 头盔 | 🪖 | 防御力 |
| `chestplate` | 胸甲 | 🛡️ | 防御力% |
| `gloves` | 护手 | 🧤 | 攻击力 |
| `boots` | 鞋子 | 👢 | 速度 |
| `accessory` | 首饰 | 💍 | 暴击伤害% |

---

## 品质系统

| 品质 | 名称 | 颜色 | 倍率 | 掉落权重 |
|------|------|------|------|----------|
| `normal` | 普通 | 灰色 | 1.0x | 60% |
| `rare` | 稀有 | 蓝色 | 1.2x | 25% |
| `epic` | 史诗 | 紫色 | 1.5x | 10% |
| `legendary` | 传说 | 橙色 | 2.0x | 4% |
| `mythic` | 神话 | 红色 | 3.0x | 1% |

品质影响：
- 词条数值倍率
- 掉落概率权重

---

## 词条系统

### 词条类型 (StatType)

```typescript
enum StatType {
  // 基础属性
  ATK_PERCENT = 'ATK_PERCENT',   // 攻击力%
  ATK_FLAT = 'ATK_FLAT',         // 攻击力
  DEF_PERCENT = 'DEF_PERCENT',   // 防御力%
  DEF_FLAT = 'DEF_FLAT',         // 防御力
  HP_FLAT = 'HP_FLAT',           // 生命值
  HP_PERCENT = 'HP_PERCENT',     // 生命值%
  SPD_FLAT = 'SPD_FLAT',         // 速度
  SPD_PERCENT = 'SPD_PERCENT',   // 速度%
  
  // 暴击属性
  CRIT_RATE = 'CRIT_RATE',       // 暴击率
  CRIT_DMG = 'CRIT_DMG',         // 暴击伤害
  
  // 部位特有
  STRENGTH = 'STRENGTH',         // 力量（武器）
  MOVE_SPEED = 'MOVE_SPEED',     // 移动速度（鞋子）
  SKILL_CD = 'SKILL_CD',         // 技能冷却（头盔）
  ARMOR = 'ARMOR',               // 护甲（护手）
  PENETRATION = 'PENETRATION',   // 穿透
  DMG_BONUS = 'DMG_BONUS',       // 伤害加成
  DMG_REDUCTION = 'DMG_REDUCTION', // 伤害减免
  EVADE_RATE = 'EVADE_RATE',     // 闪避率
}
```

### 词条结构

```typescript
interface Affix {
  stat: StatType;      // 词条类型
  value: number;       // 词条数值
  upgradeCount?: number; // 升级次数（副词条）
}
```

### 主词条配置

每个部位固定一个主词条：

| 部位 | 主词条 | 基础值 |
|------|--------|--------|
| 武器 | 攻击力% | 5% |
| 胸甲 | 防御力% | 5% |
| 头盔 | 防御力 | 12 |
| 鞋子 | 速度 | 8 |
| 护手 | 攻击力 | 15 |
| 首饰 | 暴击伤害% | 8% |

### 副词条配置

#### 通用副词条池

| 词条 | 权重 | 基础值 |
|------|------|--------|
| 攻击力 | 15 | 15 |
| 攻击力% | 8 | 5% |
| 防御力 | 12 | 12 |
| 防御力% | 6 | 5% |
| 生命值 | 14 | 80 |
| 生命值% | 8 | 5% |
| 速度 | 10 | 8 |
| 速度% | 5 | 4% |
| 暴击率 | 8 | 4% |
| 暴击伤害 | 6 | 8% |

#### 部位特有副词条

| 部位 | 特有词条 | 权重 |
|------|----------|------|
| 武器 | 力量 | 40 |
| 鞋子 | 移动速度 | 40 |
| 头盔 | 技能冷却 | 40 |
| 护手 | 护甲 | 40 |
| 首饰 | 暴击率（额外） | 40 |
| 胸甲 | 生命值（额外） | 40 |

---

## 强化系统

### 成功率

| 等级范围 | 成功率 | 损坏概率 |
|----------|--------|----------|
| +0 | 100% | 0% |
| +1 ~ +9 | 95% ~ 55% | 0% |
| +10 | 50% | 12% |
| +11 ~ +15 | 45% ~ 25% | 30% ~ 40% |
| +16 ~ +20 | 1% ~ 0.01% | 70% ~ 90% |

### 强化效果

1. **等级提升**：每次成功强化等级+1
2. **主词条升级**：每次成功主词条+5%~10%
3. **副词条升级**：在+3, +6, +9, +12, +15, +18, +21时随机升级一个副词条+20%~40%

### 强化失败

- **+0~+9**：失败无惩罚
- **+10以上**：失败可能损坏，装备消失

---

## 合成系统

相同品质的装备可以合成，有几率提升品质：

| 当前品质 | 成功率 | 目标品质 |
|----------|--------|----------|
| 普通×3 | 100% | 稀有 |
| 稀有×3 | 80% | 史诗 |
| 史诗×3 | 60% | 传说 |
| 传说×3 | 40% | 神话 |

---

## 工厂方法

使用 `EquipmentFactory` 创建装备：

```typescript
const factory = new EquipmentFactory(world);

// 创建指定装备
const weapon = factory.create('weapon', 0, 'epic');

// 创建随机装备
const randomEq = factory.createRandom(5, 'legendary');

// 从数据恢复
const restored = factory.restore({
  slot: 'weapon',
  level: 10,
  quality: 'epic',
  isBroken: false,
  mainAffix: { stat: 'ATK_PERCENT', value: 15 },
  subAffixes: [
    { stat: 'CRIT_RATE', value: 8 },
    { stat: 'ATK_FLAT', value: 25 },
  ]
});
```

---

## 相关事件

| 事件类型 | 说明 | 数据 |
|----------|------|------|
| `EQUIPMENT_CREATED` | 装备创建 | `{ equipmentId, slot, quality }` |
| `EQUIPMENT_ENHANCED` | 装备强化成功 | `{ equipmentId, newLevel }` |
| `EQUIPMENT_BROKEN` | 装备损坏 | `{ equipmentId }` |
| `EQUIPMENT_EQUIPPED` | 装备穿戴 | `{ playerId, slot, equipmentId }` |
| `EQUIPMENT_UNEQUIPPED` | 装备卸下 | `{ playerId, slot }` |
| `EQUIPMENT_SYNTHESIZED` | 装备合成 | `{ newEquipmentId, quality }` |

---

## 相关系统

- **EnhancementSystem** - 强化系统
- **SynthesisSystem** - 合成系统
- **EquipmentSystem** - 装备管理系统
- **DropSystem** - 掉落系统
- **StatCalculationSystem** - 属性计算系统

---

## 序列化格式

```typescript
interface EquipmentData {
  id: EntityId;
  slot: EquipmentSlot;
  level: number;
  quality: Quality;
  isBroken: boolean;
  mainAffix: Affix;
  subAffixes: Affix[];
}
```

---

## 相关文档

- [玩家实体](./player.md)
- [怪物实体](./monster.md)
- [架构总览](../ARCHITECTURE.md)
