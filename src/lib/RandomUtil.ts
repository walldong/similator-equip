/**
 * RandomUtil - 通用随机算法模块
 * 提供统一的随机数生成接口，便于调试和测试
 */

/**
 * 随机算法配置
 */
export interface RandomConfig {
  seed?: number;          // 随机种子（用于可重现的随机）
  useSeed?: boolean;      // 是否使用种子模式
}

/**
 * 通用随机工具类
 */
export class RandomUtil {
  private static seed: number = 0;
  private static useSeed: boolean = false;
  private static currentSeed: number = 0;

  /**
   * 初始化随机系统
   */
  static init(config?: RandomConfig): void {
    if (config?.useSeed && config?.seed !== undefined) {
      this.useSeed = true;
      this.seed = config.seed;
      this.currentSeed = config.seed;
    } else {
      this.useSeed = false;
      this.seed = Date.now();
    }
  }

  /**
   * 生成随机数 [0, 1)
   * 使用线性同余算法实现可种子化的随机
   */
  static random(): number {
    if (this.useSeed) {
      // 线性同余算法 (LCG)
      const a = 1664525;
      const c = 1013904223;
      const m = Math.pow(2, 32);
      this.currentSeed = (a * this.currentSeed + c) % m;
      return this.currentSeed / m;
    }
    return Math.random();
  }

  /**
   * 生成指定范围内的随机整数 [min, max]
   * @param min 最小值（包含）
   * @param max 最大值（包含）
   */
  static randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /**
   * 生成指定范围内的随机浮点数 [min, max)
   * @param min 最小值（包含）
   * @param max 最大值（不包含）
   */
  static randomFloat(min: number, max: number): number {
    return this.random() * (max - min) + min;
  }

  /**
   * 百分比概率判定
   * @param percent 百分比概率 (0-100)
   * @returns 是否命中
   */
  static rollPercent(percent: number): boolean {
    return this.random() * 100 < percent;
  }

  /**
   * 权重随机选择
   * @param items 待选择的项目数组
   * @param weights 对应权重数组
   * @returns 选中的项目
   */
  static weightedSelect<T>(items: T[], weights: number[]): T {
    if (items.length === 0) {
      throw new Error('Items array cannot be empty');
    }
    if (items.length !== weights.length) {
      throw new Error('Items and weights must have the same length');
    }

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const roll = this.random() * totalWeight;
    let accumulated = 0;

    for (let i = 0; i < items.length; i++) {
      accumulated += weights[i];
      if (roll < accumulated) {
        return items[i];
      }
    }

    // 返回最后一个元素（边界情况）
    return items[items.length - 1];
  }

  /**
   * 权重随机选择（使用对象形式）
   * @param weightMap 权重映射对象
   * @returns 选中的键
   */
  static weightedSelectKey<T extends string>(weightMap: Record<T, number>): T {
    const keys = Object.keys(weightMap) as T[];
    const weights = keys.map(k => weightMap[k]);
    return this.weightedSelect(keys, weights);
  }

  /**
   * 随机打乱数组
   * @param array 待打乱的数组
   * @returns 打乱后的新数组
   */
  static shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.randomInt(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * 从数组中随机选择一个元素
   * @param array 待选择的数组
   * @returns 随机选中的元素
   */
  static pick<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Array cannot be empty');
    }
    return array[this.randomInt(0, array.length - 1)];
  }

  /**
   * 从数组中随机选择多个不重复的元素
   * @param array 待选择的数组
   * @param count 选择数量
   * @returns 选中的元素数组
   */
  static pickMultiple<T>(array: T[], count: number): T[] {
    if (count >= array.length) {
      return this.shuffle(array);
    }
    const shuffled = this.shuffle(array);
    return shuffled.slice(0, count);
  }

  /**
   * 正态分布随机数（Box-Muller变换）
   * @param mean 均值
   * @param stdDev 标准差
   * @returns 随机数
   */
  static gaussian(mean: number, stdDev: number): number {
    const u1 = this.random();
    const u2 = this.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stdDev + mean;
  }

  /**
   * 范围限制的正态分布随机数
   * @param mean 均值
   * @param stdDev 标准差
   * @param min 最小值
   * @param max 最大值
   * @returns 随机数
   */
  static gaussianClamped(mean: number, stdDev: number, min: number, max: number): number {
    let result = this.gaussian(mean, stdDev);
    result = Math.max(min, Math.min(max, result));
    return Math.floor(result);
  }

  /**
   * 随机生成指定数量的独立随机数
   * @param count 数量
   * @param min 最小值
   * @param max 最大值
   * @returns 随机数数组
   */
  static generateMultiple(count: number, min: number, max: number): number[] {
    return Array.from({ length: count }, () => this.randomInt(min, max));
  }

  /**
   * 掷骰子 (n面骰子，掷m次)
   * @param sides 骰子面数
   * @param count 掷骰次数
   * @returns 骰子结果数组
   */
  static dice(sides: number, count: number = 1): number[] {
    return this.generateMultiple(count, 1, sides);
  }

  /**
   * 掷骰子求和
   * @param sides 骰子面数
   * @param count 掷骰次数
   * @returns 骰子总和
   */
  static diceSum(sides: number, count: number = 1): number {
    return this.dice(sides, count).reduce((sum, val) => sum + val, 0);
  }

  /**
   * 获取当前种子值
   */
  static getSeed(): number {
    return this.seed;
  }

  /**
   * 重置种子（用于测试）
   */
  static resetSeed(seed: number): void {
    this.currentSeed = seed;
  }
}

// 默认初始化
RandomUtil.init();

export default RandomUtil;