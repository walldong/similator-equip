# 玩家实体 (Player Entity)

玩家实体是游戏中的核心实体，代表游戏中的角色。

## 组件构成

玩家实体由以下组件组成：

```
Player Entity
├── PlayerComponent    # 玩家核心数据
├── StatsComponent     # 属性数据
└── InventoryComponent # 背包数据
```

---

## 自动登录机制

玩家登录成功后，用户名保存到 `localStorage`，刷新页面时自动登录。

### 存储格式

```typescript
localStorage.setItem('gameUsername', username);
```

### 自动登录流程

```typescript
useEffect(() => {
  const savedUsername = localStorage.getItem('gameUsername');
  if (savedUsername) {
    // 调用登录API自动登录
    apiCall('/login', {
      method: 'POST',
      body: JSON.stringify({ username: savedUsername })
    }).then(data => {
      if (data.success) {
        // 恢复玩家状态
        // 加载地图数据
      }
    });
  }
}, []);
```

### 退出登录

退出时清除存储：
```typescript
localStorage.removeItem('gameUsername');
```

---

## PlayerComponent（玩家组件）

### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `level` | `number` | 玩家等级 |
| `exp` | `number` | 当前经验值 |
| `gold` | `number` | 金币数量 |
| `equipmentSlots` | `Record<EquipmentSlot, EntityId \| null>` | 装备槽位映射 |

### 方法

```typescript
class PlayerComponent {
  // 获取升级所需经验
  getExpForNextLevel(): number;
  
  // 增加经验，返回是否升级
  addExp(amount: number): { leveledUp: boolean; newLevel?: number };
  
  // 金币操作
  addGold(amount: number): void;
  spendGold(amount: number): boolean;
  
  // 装备管理
  equip(slot: EquipmentSlot, entityId: EntityId): EntityId | null;
  unequip(slot: EquipmentSlot): EntityId | null;
  getEquipped(slot: EquipmentSlot): EntityId | null;
}
```

### 装备槽位

| 槽位 | 名称 | 图标 |
|------|------|------|
| `weapon` | 武器 | ⚔️ |
| `helmet` | 头盔 | 🪖 |
| `chestplate` | 胸甲 | 🛡️ |
| `gloves` | 护手 | 🧤 |
| `boots` | 鞋子 | 👢 |
| `accessory` | 首饰 | 💍 |

---

## StatsComponent（属性组件）

### 基础属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `hp` | `number` | 200 | 生命值 |
| `maxHp` | `number` | 200 | 最大生命值 |
| `atk` | `number` | 50 | 攻击力 |
| `def` | `number` | 30 | 防御力 |
| `spd` | `number` | 20 | 速度 |
| `critRate` | `number` | 0 | 暴击率(%) |
| `critDmg` | `number` | 0 | 暴击伤害(%) |
| `penetration` | `number` | 0 | 穿透 |
| `dmgBonus` | `number` | 0 | 伤害加成(%) |
| `dmgReduction` | `number` | 0 | 伤害减免(%) |
| `evadeRate` | `number` | 0 | 闪避率(%) |

### 方法

```typescript
class StatsComponent {
  // 获取总属性（基础 + 加成）
  getTotalStats(): CharacterStats;
  
  // 添加加成
  addFlatBonus(stat: keyof CharacterStats, value: number): void;
  addPercentBonus(stat: keyof CharacterStats, value: number): void;
  
  // 清除加成
  clearBonus(): void;
  
  // 生命值操作
  heal(amount?: number): void;
  takeDamage(amount: number): number;
  isAlive(): boolean;
}
```

---

## InventoryComponent（背包组件）

### 属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `items` | `EntityId[]` | `[]` | 背包物品列表 |
| `maxSize` | `number` | 50 | 最大容量 |

### 方法

```typescript
class InventoryComponent {
  addItem(entityId: EntityId): boolean;      // 添加物品
  removeItem(entityId: EntityId): boolean;   // 移除物品
  hasItem(entityId: EntityId): boolean;      // 检查是否拥有
  isFull(): boolean;                         // 检查是否已满
  getRemainingSpace(): number;               // 获取剩余空间
  clear(): void;                             // 清空背包
}
```

---

## 工厂方法

使用 `CharacterFactory` 创建玩家实体：

```typescript
const factory = new CharacterFactory(world);

// 创建新玩家
const player = factory.createNewPlayer('玩家名');

// 从配置创建
const player = factory.create({
  name: '玩家名',
  level: 5,
  exp: 200,
  gold: 1000,
  currentHp: 400
});

// 从存档恢复
const player = factory.restore({
  level: 10,
  exp: 500,
  gold: 5000,
  currentHp: 800,
  equipmentSlots: { weapon: 'eq_001', ... },
  inventory: ['eq_002', 'eq_003', ...]
});
```

---

## 属性计算公式

玩家总属性由基础属性和装备加成组成。

### 计算公式

```
最终属性 = (基础属性 + 固定加成之和) × (1 + 百分比加成/100)
```

### 示例

假设：
- 基础攻击力: 50
- 固定加成: +30, +20 = +50
- 百分比加成: +5%, +10%

计算：
```
最终攻击力 = (50 + 50) × 1.05 × 1.10 = 100 × 1.155 = 115
```

### 词条类型

| 词条类型 | 计算方式 |
|----------|----------|
| `ATK_FLAT` | 直接加攻击力 |
| `ATK_PERCENT` | (基础+固定) × 百分比 |
| `DEF_FLAT` | 直接加防御力 |
| `DEF_PERCENT` | (基础+固定) × 百分比 |
| `HP_FLAT` | 直接加生命值 |
| `HP_PERCENT` | (基础+固定) × 百分比 |
| `SPD_FLAT` | 直接加速度 |
| `SPD_PERCENT` | (基础+固定) × 百分比 |
| `CRIT_RATE` | 直接加暴击率（加法） |
| `CRIT_DMG` | 直接加暴击伤害（加法） |

### 计算代码

```typescript
// 基础属性 + 固定加成
const baseWithFlat = {
  atk: baseAtk + flatBonus.atk,
  def: baseDef + flatBonus.def,
  hp: baseHp + flatBonus.hp,
  spd: baseSpd + flatBonus.spd,
};

// 应用百分比加成（乘法）
const totalStats = {
  atk: Math.floor(baseWithFlat.atk * (1 + percentBonus.atk / 100)),
  def: Math.floor(baseWithFlat.def * (1 + percentBonus.def / 100)),
  hp: Math.floor(baseWithFlat.hp * (1 + percentBonus.hp / 100)),
  spd: Math.floor(baseWithFlat.spd * (1 + percentBonus.spd / 100)),
};
```

---

## 相关事件

| 事件类型 | 说明 | 数据 |
|----------|------|------|
| `PLAYER_LEVEL_UP` | 玩家升级 | `{ playerId, newLevel }` |
| `PLAYER_STATS_CHANGED` | 属性变化 | `{ playerId, stats }` |
| `PLAYER_HEALED` | 玩家治疗 | `{ playerId, amount }` |

---

## 相关系统

- **StatCalculationSystem** - 属性计算系统，计算装备词条加成
- **EquipmentSystem** - 装备管理系统，处理穿戴/卸下
- **InventorySystem** - 背包管理系统

---

## 序列化格式

```typescript
interface PlayerData {
  id: EntityId;
  name: string;
  level: number;
  exp: number;
  gold: number;
  stats: CharacterStats;
  equipmentSlots: Record<EquipmentSlot, EntityId | null>;
  inventory: EntityId[];
}
```

---

## 相关文档

- [装备实体](./equipment.md)
- [怪物实体](./monster.md)
- [架构总览](../ARCHITECTURE.md)
