# RandomUtil - 通用随机算法模块

提供统一的随机数生成接口，所有游戏随机都通过此模块进行计算。

## 概述

RandomUtil 是一个静态工具类，提供以下功能：

- 基础随机数生成
- 范围随机（整数/浮点数）
- 百分比概率判定
- 权重随机选择
- 数组操作（打乱、选取）
- 正态分布随机

---

## API 参考

### 初始化

```typescript
// 使用种子初始化（用于测试/回放）
RandomUtil.init({ useSeed: true, seed: 12345 });

// 使用系统随机数
RandomUtil.init();
```

### 基础方法

#### `random(): number`
生成 [0, 1) 范围的随机数。

```typescript
const value = RandomUtil.random(); // 0 <= value < 1
```

#### `randomInt(min: number, max: number): number`
生成 [min, max] 范围的随机整数（包含两端）。

```typescript
const dice = RandomUtil.randomInt(1, 6);    // 骰子 1-6
const level = RandomUtil.randomInt(1, 100); // 等级 1-100
```

#### `randomFloat(min: number, max: number): number`
生成 [min, max) 范围的随机浮点数。

```typescript
const variance = RandomUtil.randomFloat(0.8, 1.2); // 80%-120% 变动范围
```

### 概率方法

#### `rollPercent(percent: number): boolean`
百分比概率判定。

```typescript
if (RandomUtil.rollPercent(30)) {
  // 30% 概率触发
}

// Boss 掉落判定
if (RandomUtil.rollPercent(monsterComp.dropRate)) {
  // 掉落装备
}
```

### 权重选择

#### `weightedSelect<T>(items: T[], weights: number[]): T`
根据权重随机选择一个元素。

```typescript
const items = ['普通', '稀有', '史诗', '传说'];
const weights = [60, 25, 10, 5];
const selected = RandomUtil.weightedSelect(items, weights);
```

#### `weightedSelectKey<T>(weightMap: Record<T, number>): T`
根据权重映射选择键。

```typescript
const quality = RandomUtil.weightedSelectKey({
  normal: 60,
  rare: 25,
  epic: 10,
  legendary: 4,
  mythic: 1,
});
```

### 数组方法

#### `shuffle<T>(array: T[]): T[]`
随机打乱数组（返回新数组）。

```typescript
const shuffledDeck = RandomUtil.shuffle([1, 2, 3, 4, 5]);
```

#### `pick<T>(array: T[]): T`
随机选取一个元素。

```typescript
const slots = ['weapon', 'helmet', 'chestplate', 'gloves', 'boots', 'accessory'];
const slot = RandomUtil.pick(slots);
```

#### `pickMultiple<T>(array: T[], count: number): T[]`
随机选取多个不重复元素。

```typescript
const selected = RandomUtil.pickMultiple([1, 2, 3, 4, 5], 3);
```

### 正态分布

#### `gaussian(mean: number, stdDev: number): number`
生成正态分布随机数。

```typescript
const value = RandomUtil.gaussian(100, 15); // 均值100，标准差15
```

#### `gaussianClamped(mean: number, stdDev: number, min: number, max: number): number`
生成范围限制的正态分布随机数。

```typescript
const damage = RandomUtil.gaussianClamped(50, 10, 30, 80);
```

### 骰子方法

#### `dice(sides: number, count: number = 1): number[]`
掷骰子。

```typescript
const results = RandomUtil.dice(6, 3); // 3个6面骰子
```

#### `diceSum(sides: number, count: number = 1): number`
掷骰子求和。

```typescript
const total = RandomUtil.diceSum(6, 3); // 3个6面骰子总和
```

---

## 使用示例

### 掉落系统

```typescript
// 确定掉落数量
const dropCount = RandomUtil.randomInt(2, 5); // Boss: 2-5件

// 确定品质
const quality = RandomUtil.weightedSelectKey({
  normal: 10,
  rare: 30,
  epic: 35,
  legendary: 24,
  mythic: 1,
});

// 确定装备槽位
const slot = RandomUtil.pick(['weapon', 'helmet', 'chestplate', 'gloves', 'boots', 'accessory']);
```

### 强化系统

```typescript
// 强化成功率判定
const successRate = 50;
if (RandomUtil.rollPercent(successRate)) {
  // 强化成功
}

// 词条数值变动
const variance = RandomUtil.randomFloat(0.8, 1.2);
const finalValue = Math.floor(baseValue * variance);
```

### 战斗系统

```typescript
// 闪避判定
const dodgeChance = 15;
if (RandomUtil.rollPercent(dodgeChance)) {
  // 闪避成功
}

// 暴击判定
const critChance = 25;
if (RandomUtil.rollPercent(critChance)) {
  // 暴击
}
```

### 地图生成

```typescript
// 确定怪物等级（玩家等级上下10级）
const monsterLevel = RandomUtil.randomInt(playerLevel - 10, playerLevel + 10);

// Boss 等级（玩家等级 +1~+5）
const bossLevel = playerLevel + RandomUtil.randomInt(1, 5);
```

---

## 测试支持

使用种子模式可以重现随机结果，便于测试和调试：

```typescript
// 测试代码
RandomUtil.init({ useSeed: true, seed: 12345 });

// 相同种子产生相同结果
const result1 = RandomUtil.randomInt(1, 100); // 例如: 42
RandomUtil.resetSeed(12345);
const result2 = RandomUtil.randomInt(1, 100); // 仍然是: 42
```

---

## 文件位置

- 源码: `src/lib/RandomUtil.ts`
- 导入: `import { RandomUtil } from '@/lib/RandomUtil';`
