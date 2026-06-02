/**
 * MonsterComponent - 怪物组件
 * 用于存储怪物数据
 */

import { Component } from '@/core/Component';
import { MonsterComponent as IMonsterComponent, MonsterType, Quality, EntityId } from '@/types';
import { RandomUtil } from '@/lib/RandomUtil';

export interface MonsterConfig {
  name: string;
  icon: string;
  type: MonsterType;
  hp: number;
  atk: number;
  def: number;
  spd: number;          // 速度
  exp: number;
  gold: number;
  dropRate: number;
  qualityWeights: Record<Quality, number>;
}

export class MonsterComponent extends Component implements IMonsterComponent {
  public readonly type = 'monster';
  public monsterType: MonsterType;
  public name: string;
  public icon: string;
  public hp: number;
  public maxHp: number;
  public atk: number;
  public def: number;
  public spd: number;
  public exp: number;
  public gold: number;
  public dropRate: number;
  public qualityWeights: Record<Quality, number>;

  constructor(config: MonsterConfig) {
    super();
    this.monsterType = config.type;
    this.name = config.name;
    this.icon = config.icon;
    this.hp = config.hp;
    this.maxHp = config.hp;
    this.atk = config.atk;
    this.def = config.def;
    this.spd = config.spd;
    this.exp = config.exp;
    this.gold = config.gold;
    this.dropRate = config.dropRate;
    this.qualityWeights = config.qualityWeights;
  }

  /**
   * 创建 Boss 变体（属性增强）
   */
  static createBoss(baseConfig: MonsterConfig, multiplier: number = 1.5): MonsterComponent {
    return new MonsterComponent({
      ...baseConfig,
      type: 'boss',
      hp: Math.floor(baseConfig.hp * multiplier),
      atk: Math.floor(baseConfig.atk * multiplier),
      def: Math.floor(baseConfig.def * multiplier),
      exp: Math.floor(baseConfig.exp * 2),
      gold: Math.floor(baseConfig.gold * 2),
    });
  }

  /**
   * 创建精英变体（属性增强）
   */
  static createElite(baseConfig: MonsterConfig, multiplier: number = 1.3): MonsterComponent {
    return new MonsterComponent({
      ...baseConfig,
      type: 'elite',
      hp: Math.floor(baseConfig.hp * multiplier),
      atk: Math.floor(baseConfig.atk * multiplier),
      exp: Math.floor(baseConfig.exp * 1.5),
      gold: Math.floor(baseConfig.gold * 1.5),
    });
  }

  /**
   * 受到伤害
   */
  takeDamage(amount: number): number {
    this.hp = Math.max(0, this.hp - amount);
    return this.hp;
  }

  /**
   * 检查是否存活
   */
  isAlive(): boolean {
    return this.hp > 0;
  }

  /**
   * 掷品质
   */
  rollQuality(): Quality {
    const roll = RandomUtil.randomInt(1, 100);
    let acc = 0;
    const qualities: Quality[] = ['normal', 'rare', 'epic', 'legendary', 'mythic'];

    for (const q of qualities) {
      acc += this.qualityWeights[q] ?? 0;
      if (roll <= acc) return q;
    }

    return 'normal';
  }

  serialize(): Record<string, unknown> {
    return {
      type: this.type,
      monsterType: this.monsterType,
      name: this.name,
      icon: this.icon,
      hp: this.hp,
      maxHp: this.maxHp,
      atk: this.atk,
      def: this.def,
      spd: this.spd,
      exp: this.exp,
      gold: this.gold,
      dropRate: this.dropRate,
      qualityWeights: this.qualityWeights,
    };
  }

  static fromData(data: Record<string, unknown>): MonsterComponent {
    return new MonsterComponent({
      name: data.name as string,
      icon: data.icon as string,
      type: data.monsterType as MonsterType,
      hp: data.hp as number,
      atk: data.atk as number,
      def: data.def as number,
      spd: data.spd as number ?? 20,
      exp: data.exp as number,
      gold: data.gold as number,
      dropRate: data.dropRate as number,
      qualityWeights: data.qualityWeights as Record<Quality, number>,
    });
  }
}

export default MonsterComponent;