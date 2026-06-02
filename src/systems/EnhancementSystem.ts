/**
 * EnhancementSystem - 装备强化系统
 * 处理装备强化逻辑
 */

import { System } from '@/core/System';
import { EquipmentComponent } from '@/components';
import { EntityId, EventType } from '@/types';
import { RandomUtil } from '@/lib/RandomUtil';

export interface EnhanceResult {
  success: boolean;
  broken: boolean;
  newLevel: number;
  upgradedAffix?: {
    stat: string;
    oldValue: number;
    newValue: number;
  };
}

export class EnhancementSystem extends System {
  // 强化升级等级
  private static readonly UPGRADE_LEVELS = [3, 6, 9, 12, 15, 18, 21];

  constructor() {
    super('enhancement', ['equipment'], 20);
  }

  /**
   * 强化装备
   */
  enhance(equipment: EquipmentComponent): EnhanceResult {
    if (equipment.isBroken) {
      return { success: false, broken: false, newLevel: equipment.level };
    }

    if (equipment.level >= 21) {
      return { success: false, broken: false, newLevel: equipment.level };
    }

    const currentLevel = equipment.level;
    const successRate = this.getSuccessRate(currentLevel);
    const brokenRate = this.getBrokenRate(currentLevel);

    const roll = RandomUtil.random() * 100;

    if (roll < successRate) {
      // 强化成功
      equipment.level++;

      // 升级主词条
      const mainIncrease = Math.ceil(
        equipment.mainAffix.value * RandomUtil.randomFloat(5, 10) / 100
      );
      equipment.mainAffix.value += mainIncrease;

      // 检查是否升级副词条
      let upgradedAffix: EnhanceResult['upgradedAffix'];
      if (EnhancementSystem.UPGRADE_LEVELS.includes(equipment.level)) {
        upgradedAffix = this.upgradeRandomSubAffix(equipment);
      }

      this.emit(EventType.EQUIPMENT_ENHANCED, {
        equipmentId: equipment.entityId,
        newLevel: equipment.level,
      });

      return {
        success: true,
        broken: false,
        newLevel: equipment.level,
        upgradedAffix,
      };
    } else if (roll < successRate + brokenRate) {
      // 装备损坏
      equipment.isBroken = true;

      this.emit(EventType.EQUIPMENT_BROKEN, {
        equipmentId: equipment.entityId,
      });

      return {
        success: false,
        broken: true,
        newLevel: equipment.level,
      };
    }

    // 强化失败但装备未损坏
    return {
      success: false,
      broken: false,
      newLevel: equipment.level,
    };
  }

  /**
   * 获取强化成功率
   */
  private getSuccessRate(level: number): number {
    if (level <= 0) return 100;
    if (level <= 9) return Math.max(55, 95 - level * 4);
    return Math.max(3, 50 - (level - 10) * 5);
  }

  /**
   * 获取损坏概率
   */
  private getBrokenRate(level: number): number {
    if (level < 10) return 0;
    return Math.min(70, 5 + (level - 10) * 7);
  }

  /**
   * 升级随机副词条
   */
  private upgradeRandomSubAffix(equipment: EquipmentComponent): EnhanceResult['upgradedAffix'] {
    if (!equipment.subAffixes || equipment.subAffixes.length === 0) {
      return undefined;
    }

    const index = RandomUtil.randomInt(0, equipment.subAffixes.length - 1);
    const affix = equipment.subAffixes[index];
    const oldValue = affix.value;
    const percent = RandomUtil.randomInt(20, 40); // 20%~40%
    const increase = Math.ceil(affix.value * percent / 100);
    affix.value += increase;
    affix.upgradeCount = (affix.upgradeCount ?? 0) + 1;

    return {
      stat: affix.stat,
      oldValue,
      newValue: affix.value,
    };
  }

  update(_deltaTime: number): void {
    // 强化系统不进行自动更新，按需调用 enhance 方法
  }
}

export default EnhancementSystem;