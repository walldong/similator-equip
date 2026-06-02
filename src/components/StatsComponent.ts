/**
 * StatsComponent - 属性组件
 * 用于存储角色或怪物的属性数据
 */

import { Component } from '@/core/Component';
import { StatsComponent as IStatsComponent, CharacterStats, EntityId } from '@/types';

export class StatsComponent extends Component implements IStatsComponent {
  public readonly type = 'stats';
  public baseStats: Partial<CharacterStats>;
  public bonusStats: Partial<CharacterStats>;
  public currentHp: number;

  constructor(data: Partial<CharacterStats> = {}) {
    super();
    this.baseStats = {
      hp: data.hp ?? 200,
      atk: data.atk ?? 50,
      def: data.def ?? 30,
      spd: data.spd ?? 20,
      critRate: data.critRate ?? 0,
      critDmg: data.critDmg ?? 0,
      penetration: data.penetration ?? 0,
      dmgBonus: data.dmgBonus ?? 0,
      dmgReduction: data.dmgReduction ?? 0,
      evadeRate: data.evadeRate ?? 0,
    };
    this.bonusStats = {};
    this.currentHp = data.hp ?? 200;
  }

  /**
   * 获取总属性（基础 + 加成）
   */
  getTotalStats(): CharacterStats {
    const result: CharacterStats = {
      hp: this.baseStats.hp ?? 200,
      maxHp: this.baseStats.hp ?? 200,
      atk: this.baseStats.atk ?? 50,
      def: this.baseStats.def ?? 30,
      spd: this.baseStats.spd ?? 20,
      critRate: this.baseStats.critRate ?? 0,
      critDmg: this.baseStats.critDmg ?? 0,
      penetration: this.baseStats.penetration ?? 0,
      dmgBonus: this.baseStats.dmgBonus ?? 0,
      dmgReduction: this.baseStats.dmgReduction ?? 0,
      evadeRate: this.baseStats.evadeRate ?? 0,
    };

    // 应用加成
    for (const [key, value] of Object.entries(this.bonusStats) as [keyof CharacterStats, number][]) {
      if (value !== undefined) {
        // 百分比加成
        if (key === 'atk' || key === 'def' || key === 'hp' || key === 'maxHp' || key === 'spd') {
          // 检查是否是百分比加成（基于 baseStats）
          result[key] = Math.floor(result[key] * (1 + value / 100));
        } else {
          result[key] = (result[key] ?? 0) + value;
        }
      }
    }

    return result;
  }

  /**
   * 添加固定属性加成
   */
  addFlatBonus(stat: keyof CharacterStats, value: number): void {
    this.bonusStats[stat] = (this.bonusStats[stat] ?? 0) + value;
  }

  /**
   * 添加百分比属性加成
   */
  addPercentBonus(stat: keyof CharacterStats, value: number): void {
    // 百分比加成需要特殊处理，存储为百分比值
    this.bonusStats[stat] = (this.bonusStats[stat] ?? 0) + value;
  }

  /**
   * 清除所有加成
   */
  clearBonus(): void {
    this.bonusStats = {};
  }

  /**
   * 恢复生命值
   */
  heal(amount?: number): void {
    const maxHp = this.getTotalStats().maxHp;
    this.currentHp = amount !== undefined ? Math.min(maxHp, this.currentHp + amount) : maxHp;
  }

  /**
   * 受到伤害
   */
  takeDamage(amount: number): number {
    this.currentHp = Math.max(0, this.currentHp - amount);
    return this.currentHp;
  }

  /**
   * 检查是否存活
   */
  isAlive(): boolean {
    return this.currentHp > 0;
  }

  serialize(): Record<string, unknown> {
    return {
      type: this.type,
      baseStats: this.baseStats,
      bonusStats: this.bonusStats,
      currentHp: this.currentHp,
    };
  }

  static fromData(data: Record<string, unknown>): StatsComponent {
    const component = new StatsComponent(data.baseStats as Partial<CharacterStats>);
    component.bonusStats = (data.bonusStats as Partial<CharacterStats>) ?? {};
    component.currentHp = (data.currentHp as number) ?? (data.baseStats as Partial<CharacterStats>)?.hp ?? 200;
    return component;
  }
}

export default StatsComponent;