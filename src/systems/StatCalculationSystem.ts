/**
 * StatCalculationSystem - 属性计算系统
 * 负责计算角色的最终属性
 */

import { System } from '@/core/System';
import { StatsComponent, EquipmentComponent, PlayerComponent } from '@/components';
import { StatType, CharacterStats, EntityId, Quality } from '@/types';

// 品质倍率
const QualityMultipliers: Record<Quality, number> = {
  normal: 1.0,
  rare: 1.2,
  epic: 1.5,
  legendary: 2.0,
  mythic: 3.0,
};

export class StatCalculationSystem extends System {
  constructor() {
    super('statCalculation', ['stats', 'player'], 10);
  }

  /**
   * 计算角色属性
   */
  calculateStats(statsComp: StatsComponent, equippedItems: EquipmentComponent[]): CharacterStats {
    // 获取基础属性（包含等级加成）
    const playerLevel = 1; // 应该从 PlayerComponent 获取
    const baseStats = this.getBaseStatsByLevel(playerLevel);
    
    // 应用基础属性
    statsComp.baseStats = { ...baseStats };
    statsComp.bonusStats = {};
    statsComp.currentHp = statsComp.currentHp || baseStats.hp;

    // 应用装备加成
    for (const equipment of equippedItems) {
      if (equipment.isBroken) continue;
      this.applyEquipmentBonus(statsComp, equipment);
    }

    return statsComp.getTotalStats();
  }

  /**
   * 根据等级获取基础属性
   */
  getBaseStatsByLevel(level: number): CharacterStats {
    return {
      hp: 200 + level * 50,
      maxHp: 200 + level * 50,
      atk: 50 + level * 10,
      def: 30 + level * 5,
      spd: 20 + level * 2,
      critRate: 0,
      critDmg: 0,
      penetration: 0,
      dmgBonus: 0,
      dmgReduction: 0,
      evadeRate: 0,
    };
  }

  /**
   * 应用装备词条加成
   */
  private applyEquipmentBonus(statsComp: StatsComponent, equipment: EquipmentComponent): void {
    const mult = QualityMultipliers[equipment.quality] || 1;

    // 主词条
    if (equipment.mainAffix) {
      const value = Math.floor(equipment.mainAffix.value * mult);
      this.applyStatBonus(statsComp, equipment.mainAffix.stat, value);
    }

    // 副词条
    for (const sub of equipment.subAffixes || []) {
      const value = Math.floor(sub.value * mult);
      this.applyStatBonus(statsComp, sub.stat, value);
    }
  }

  /**
   * 应用单个词条加成
   */
  private applyStatBonus(statsComp: StatsComponent, stat: StatType, value: number): void {
    switch (stat) {
      // 攻击相关
      case StatType.ATK_FLAT:
        statsComp.addFlatBonus('atk', value);
        break;
      case StatType.ATK_PERCENT:
        statsComp.addPercentBonus('atk', value);
        break;

      // 防御相关
      case StatType.DEF_FLAT:
        statsComp.addFlatBonus('def', value);
        break;
      case StatType.DEF_PERCENT:
        statsComp.addPercentBonus('def', value);
        break;

      // 生命相关
      case StatType.HP_FLAT:
        statsComp.addFlatBonus('hp', value);
        statsComp.addFlatBonus('maxHp', value);
        break;
      case StatType.HP_PERCENT:
        statsComp.addPercentBonus('hp', value);
        statsComp.addPercentBonus('maxHp', value);
        break;

      // 速度相关
      case StatType.SPD_FLAT:
        statsComp.addFlatBonus('spd', value);
        break;
      case StatType.SPD_PERCENT:
        statsComp.addPercentBonus('spd', value);
        break;

      // 暴击相关
      case StatType.CRIT_RATE:
        statsComp.addFlatBonus('critRate', value);
        break;
      case StatType.CRIT_DMG:
        statsComp.addFlatBonus('critDmg', value);
        break;

      // 特殊词条
      case StatType.PENETRATION:
        statsComp.addFlatBonus('penetration', value);
        break;
      case StatType.DMG_BONUS:
        statsComp.addPercentBonus('atk', value);
        break;
      case StatType.DMG_REDUCTION:
        statsComp.addFlatBonus('dmgReduction', value);
        break;
      case StatType.EVADE_RATE:
        statsComp.addFlatBonus('evadeRate', value);
        break;
    }
  }

  update(_deltaTime: number): void {
    // 在响应式系统中，属性计算通常是按需进行的
    // 这里可以做一些批量更新或定期检查
  }
}

export default StatCalculationSystem;