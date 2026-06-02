/**
 * EquipmentComponent - 装备组件
 * 用于存储装备数据
 */

import { Component } from '@/core/Component';
import { EquipmentComponent as IEquipmentComponent, EquipmentSlot, Quality, Affix } from '@/types';
import { RandomUtil } from '@/lib/RandomUtil';

export class EquipmentComponent extends Component implements IEquipmentComponent {
  public readonly type = 'equipment';
  public slot: EquipmentSlot;
  public level: number;
  public quality: Quality;
  public isBroken: boolean;
  public mainAffix: Affix;
  public subAffixes: Affix[];

  constructor(
    slot: EquipmentSlot,
    level: number = 0,
    quality: Quality = 'normal',
    mainAffix: Affix,
    subAffixes: Affix[] = []
  ) {
    super();
    this.slot = slot;
    this.level = level;
    this.quality = quality;
    this.isBroken = false;
    this.mainAffix = mainAffix;
    this.subAffixes = subAffixes;
  }

  /**
   * 强化装备
   */
  enhance(): { success: boolean; broken: boolean; upgradedAffix?: Affix } {
    if (this.isBroken || this.level >= 21) {
      return { success: false, broken: false };
    }

    // 成功率计算
    const successRate = Math.max(5, 100 - this.level * 4);
    const brokenRate = this.level >= 10 ? Math.min(70, 5 + (this.level - 10) * 7) : 0;

    const roll = RandomUtil.random() * 100;

    if (roll < successRate) {
      this.level++;
      
      // 升级主词条
      const mainIncrease = Math.ceil(this.mainAffix.value * RandomUtil.randomFloat(5, 10) / 100);
      this.mainAffix.value += mainIncrease;

      // 每+3级升级一个随机副词条
      const upgradeLevels = [3, 6, 9, 12, 15, 18, 21];
      if (upgradeLevels.includes(this.level) && this.subAffixes.length > 0) {
        const upgraded = this.upgradeRandomSubAffix();
        return { success: true, broken: false, upgradedAffix: upgraded };
      }

      return { success: true, broken: false };
    } else if (roll < successRate + brokenRate) {
      this.isBroken = true;
      return { success: false, broken: true };
    }

    return { success: false, broken: false };
  }

  /**
   * 升级随机副词条
   */
  upgradeRandomSubAffix(): Affix | undefined {
    if (this.subAffixes.length === 0) return undefined;

    const index = RandomUtil.randomInt(0, this.subAffixes.length - 1);
    const affix = this.subAffixes[index];
    const percent = RandomUtil.randomInt(20, 40); // 20%~40%
    const increase = Math.ceil(affix.value * percent / 100);
    affix.value += increase;
    affix.upgradeCount = (affix.upgradeCount ?? 0) + 1;

    return affix;
  }

  /**
   * 获取所有词条
   */
  getAllAffixes(): Affix[] {
    return [this.mainAffix, ...this.subAffixes];
  }

  serialize(): Record<string, unknown> {
    return {
      type: this.type,
      slot: this.slot,
      level: this.level,
      quality: this.quality,
      isBroken: this.isBroken,
      mainAffix: this.mainAffix,
      subAffixes: this.subAffixes,
    };
  }

  static fromData(data: Record<string, unknown>): EquipmentComponent {
    return new EquipmentComponent(
      data.slot as EquipmentSlot,
      data.level as number ?? 0,
      data.quality as Quality ?? 'normal',
      data.mainAffix as Affix,
      data.subAffixes as Affix[] ?? []
    );
  }
}

export default EquipmentComponent;