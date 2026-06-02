/**
 * EquipmentFactory - 装备工厂
 * 负责创建各种装备实体
 */

import { World, Entity } from '@/core';
import { EquipmentComponent } from '@/components';
import { EquipmentSlot, Quality, StatType, Affix, EntityId } from '@/types';
import { RandomUtil } from '@/lib/RandomUtil';

// 主词条配置（每个部位固定）
const MainAffixBySlot: Record<EquipmentSlot, StatType> = {
  weapon: StatType.ATK_PERCENT,
  chestplate: StatType.DEF_PERCENT,
  helmet: StatType.DEF_FLAT,
  boots: StatType.SPD_FLAT,
  gloves: StatType.ATK_FLAT,
  accessory: StatType.CRIT_DMG,
};

// 词条基础值
const AffixBaseValues: Record<StatType, number> = {
  [StatType.ATK_PERCENT]: 5,
  [StatType.ATK_FLAT]: 15,
  [StatType.DEF_PERCENT]: 5,
  [StatType.DEF_FLAT]: 12,
  [StatType.HP_FLAT]: 80,
  [StatType.HP_PERCENT]: 5,
  [StatType.SPD_FLAT]: 8,
  [StatType.SPD_PERCENT]: 4,
  [StatType.CRIT_RATE]: 4,
  [StatType.CRIT_DMG]: 8,
  [StatType.STRENGTH]: 10,
  [StatType.MOVE_SPEED]: 6,
  [StatType.SKILL_CD]: 5,
  [StatType.ARMOR]: 15,
  [StatType.PENETRATION]: 5,
  [StatType.DMG_BONUS]: 5,
  [StatType.DMG_REDUCTION]: 3,
  [StatType.EVADE_RATE]: 3,
};

// 品质倍率
const QualityMultipliers: Record<Quality, number> = {
  normal: 1.0,
  rare: 1.2,
  epic: 1.5,
  legendary: 2.0,
  mythic: 3.0,
};

// 通用副词条池
const CommonSubAffixes: StatType[] = [
  StatType.ATK_FLAT,
  StatType.ATK_PERCENT,
  StatType.DEF_FLAT,
  StatType.DEF_PERCENT,
  StatType.HP_FLAT,
  StatType.HP_PERCENT,
  StatType.SPD_FLAT,
  StatType.SPD_PERCENT,
  StatType.CRIT_RATE,
  StatType.CRIT_DMG,
];

// 部位特有副词条
const SlotSpecificAffixes: Record<EquipmentSlot, StatType[]> = {
  weapon: [StatType.STRENGTH],
  boots: [StatType.MOVE_SPEED],
  helmet: [StatType.SKILL_CD],
  gloves: [StatType.ARMOR],
  accessory: [StatType.CRIT_RATE],
  chestplate: [StatType.HP_FLAT, StatType.HP_PERCENT],
};

export class EquipmentFactory {
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  /**
   * 创建装备
   */
  create(slot: EquipmentSlot, level: number = 0, quality?: Quality): Entity {
    // 如果没有指定品质，随机生成
    const actualQuality = quality ?? this.rollQuality();

    // 生成主词条
    const mainStat = MainAffixBySlot[slot];
    const mainAffix = this.generateMainAffix(slot, level, actualQuality);

    // 生成副词条
    const subAffixes = this.generateSubAffixes(slot, level, actualQuality, [mainStat]);

    // 创建实体
    const entity = this.world.createEntity();
    entity.addComponent(new EquipmentComponent(slot, level, actualQuality, mainAffix, subAffixes));

    return entity;
  }

  /**
   * 创建随机槽位装备
   */
  createRandom(level: number = 0, quality?: Quality): Entity {
    const slots: EquipmentSlot[] = ['weapon', 'helmet', 'chestplate', 'gloves', 'boots', 'accessory'];
    const slot = RandomUtil.pick(slots);
    return this.create(slot, level, quality);
  }

  /**
   * 从数据恢复装备
   */
  restore(data: {
    id?: EntityId;
    slot: EquipmentSlot;
    level: number;
    quality: Quality;
    isBroken: boolean;
    mainAffix: Affix;
    subAffixes: Affix[];
  }): Entity {
    const entity = this.world.createEntity();
    entity.addComponent(new EquipmentComponent(
      data.slot,
      data.level,
      data.quality,
      data.mainAffix,
      data.subAffixes
    ));

    const equipmentComp = entity.getComponent<EquipmentComponent>('equipment');
    if (equipmentComp) {
      equipmentComp.isBroken = data.isBroken;
    }

    return entity;
  }

  /**
   * 生成主词条
   */
  private generateMainAffix(slot: EquipmentSlot, level: number, quality: Quality): Affix {
    const stat = MainAffixBySlot[slot];
    const baseValue = AffixBaseValues[stat] || 5;
    const mult = QualityMultipliers[quality] || 1.0;
    const levelMult = 1 + Math.max(0, level) * 0.12;

    const value = Math.max(1, Math.floor(baseValue * mult * levelMult));

    return { stat, value };
  }

  /**
   * 生成副词条
   */
  private generateSubAffixes(
    slot: EquipmentSlot,
    level: number,
    quality: Quality,
    existingStats: StatType[]
  ): Affix[] {
    const result: Affix[] = [];
    const usedStats = new Set<StatType>(existingStats);

    // 合并通用和部位特有词条
    const allStats = [
      ...CommonSubAffixes,
      ...(SlotSpecificAffixes[slot] || []),
    ];

    // 生成4条副词条
    for (let i = 0; i < 4; i++) {
      // 过滤已使用的词条
      const availableStats = allStats.filter(s => !usedStats.has(s));
      if (availableStats.length === 0) break;

      // 随机选择
      const stat = RandomUtil.pick(availableStats);
      usedStats.add(stat);

      // 计算数值
      const baseValue = AffixBaseValues[stat] || 5;
      const mult = QualityMultipliers[quality] || 1.0;
      const levelMult = 1 + Math.max(0, level) * 0.06;
      const variance = RandomUtil.randomFloat(0.8, 1.2); // 80%~120%

      const value = Math.max(1, Math.floor(baseValue * mult * levelMult * variance));

      result.push({ stat, value });
    }

    return result;
  }

  /**
   * 掷品质
   */
  private rollQuality(): Quality {
    const roll = RandomUtil.randomInt(1, 100);
    if (roll < 1) return 'mythic';
    if (roll < 5) return 'legendary';
    if (roll < 15) return 'epic';
    if (roll < 40) return 'rare';
    return 'normal';
  }
}

export default EquipmentFactory;