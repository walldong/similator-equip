/**
 * DropSystem - 掉落系统
 * 处理装备掉落逻辑
 */

import { System } from '@/core/System';
import { MonsterComponent } from '@/components';
import { Entity, World } from '@/core';
import { EntityId, Quality, EquipmentSlot, EventType } from '@/types';
import { EquipmentFactory } from '@/factories/EquipmentFactory';
import { RandomUtil } from '@/lib/RandomUtil';

/**
 * 品质权重配置（普通怪物）
 */
const QualityDropRates: Record<Quality, number> = {
  normal: 64,
  rare: 25,
  epic: 10,
  legendary: 0,
  mythic: 1,
};

/**
 * 精英怪品质权重
 */
const EliteQualityDropRates: Record<Quality, number> = {
  normal: 30,
  rare: 35,
  epic: 25,
  legendary: 9,
  mythic: 1,
};

/**
 * Boss 品质权重（更高品质概率）
 */
const BossQualityDropRates: Record<Quality, number> = {
  normal: 10,
  rare: 30,
  epic: 35,
  legendary: 24,
  mythic: 1,
};

/**
 * 掉落数量配置
 */
const DropCountConfig = {
  normal: { min: 0, max: 2 },   // 小怪 0-2 件
  elite: { min: 1, max: 3 },    // 精英 1-3 件
  boss: { min: 2, max: 5 },     // Boss 2-5 件
};

export class DropSystem extends System {
  private equipmentFactory: EquipmentFactory | null = null;

  constructor() {
    super('drop', [], 40);
  }

  init(world: World): void {
    super.init(world);
    this.equipmentFactory = new EquipmentFactory(world);
  }

  /**
   * 生成掉落物
   * @param monsterComp 怪物组件
   * @param monsterLevel 怪物等级（用于装备等级）
   * @returns 掉落的装备实体ID列表
   */
  generateDrops(monsterComp: MonsterComponent, monsterLevel?: number): EntityId[] {
    if (!this.world || !this.equipmentFactory) {
      return [];
    }

    const drops: EntityId[] = [];
    const level = monsterLevel ?? Math.floor(monsterComp.hp / 100);
    const monsterType = monsterComp.monsterType;

    // 根据怪物类型确定掉落数量
    const countConfig = DropCountConfig[monsterType];
    const dropCount = RandomUtil.randomInt(countConfig.min, countConfig.max);

    // 生成掉落装备
    for (let i = 0; i < dropCount; i++) {
      const quality = this.rollQualityByType(monsterType);
      const equipment = this.equipmentFactory.createRandom(level, quality);
      drops.push(equipment.id);
    }

    if (drops.length > 0) {
      this.emit(EventType.INVENTORY_CHANGED, { drops });
    }

    return drops;
  }

  /**
   * 根据怪物类型掷品质
   */
  rollQualityByType(monsterType: 'normal' | 'elite' | 'boss'): Quality {
    switch (monsterType) {
      case 'boss':
        return RandomUtil.weightedSelectKey(BossQualityDropRates);
      case 'elite':
        return RandomUtil.weightedSelectKey(EliteQualityDropRates);
      default:
        return RandomUtil.weightedSelectKey(QualityDropRates);
    }
  }

  /**
   * 生成 Boss 必定掉落
   */
  generateBossDrop(monsterLevel: number): EntityId {
    if (!this.world || !this.equipmentFactory) {
      throw new Error('World or EquipmentFactory not initialized');
    }

    const quality = RandomUtil.weightedSelectKey(BossQualityDropRates);
    const equipment = this.equipmentFactory.createRandom(monsterLevel, quality);
    
    this.emit(EventType.INVENTORY_CHANGED, { drops: [equipment.id] });
    
    return equipment.id;
  }

  /**
   * 掷装备槽位
   */
  rollSlot(): EquipmentSlot {
    const slots: EquipmentSlot[] = ['weapon', 'helmet', 'chestplate', 'gloves', 'boots', 'accessory'];
    return RandomUtil.pick(slots);
  }

  /**
   * 掷品质（通用方法，向后兼容）
   */
  rollQuality(weights?: Record<Quality, number>): Quality {
    const rates = weights || QualityDropRates;
    return RandomUtil.weightedSelectKey(rates);
  }

  /**
   * 掷品质（Boss专用）
   */
  rollBossQuality(): Quality {
    return RandomUtil.weightedSelectKey(BossQualityDropRates);
  }

  /**
   * 掷品质（精英专用）
   */
  rollEliteQuality(): Quality {
    return RandomUtil.weightedSelectKey(EliteQualityDropRates);
  }

  /**
   * 根据怪物类型获取品质权重
   */
  getQualityWeights(monsterType: 'normal' | 'elite' | 'boss'): Record<Quality, number> {
    switch (monsterType) {
      case 'boss':
        return BossQualityDropRates;
      case 'elite':
        return EliteQualityDropRates;
      default:
        return QualityDropRates;
    }
  }

  /**
   * 获取掉落数量配置
   */
  getDropCountConfig(monsterType: 'normal' | 'elite' | 'boss'): { min: number; max: number } {
    return DropCountConfig[monsterType];
  }

  update(_deltaTime: number): void {
    // 掉落系统不进行自动更新
  }
}

export default DropSystem;