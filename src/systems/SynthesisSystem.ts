/**
 * SynthesisSystem - 装备合成系统
 * 处理装备合成逻辑
 */

import { System } from '@/core/System';
import { EquipmentComponent } from '@/components';
import { Entity, World } from '@/core';
import { EntityId, Quality, EquipmentSlot, EventType } from '@/types';
import { RandomUtil } from '@/lib/RandomUtil';

export interface SynthesisResult {
  success: boolean;
  newEquipment?: EntityId;
  error?: string;
}

export class SynthesisSystem extends System {
  constructor() {
    super('synthesis', ['equipment'], 25);
  }

  init(world: World): void {
    super.init(world);
  }

  /**
   * 检查是否可以合成
   */
  canSynthesize(equipment1: EquipmentComponent, equipment2: EquipmentComponent): { valid: boolean; error?: string } {
    // 检查是否损坏
    if (equipment1.isBroken || equipment2.isBroken) {
      return { valid: false, error: '损坏的装备无法合成' };
    }

    // 检查品质是否相同
    if (equipment1.quality !== equipment2.quality) {
      return { valid: false, error: '品质不同的装备无法合成' };
    }

    // 检查是否满级
    if (equipment1.level >= 21 && equipment2.level >= 21) {
      return { valid: false, error: '装备已满级' };
    }

    return { valid: true };
  }

  /**
   * 执行合成
   */
  synthesize(
    equipment1: EquipmentComponent,
    equipment2: EquipmentComponent,
    entity1: Entity,
    entity2: Entity
  ): SynthesisResult {
    const check = this.canSynthesize(equipment1, equipment2);
    if (!check.valid) {
      return { success: false, error: check.error };
    }

    if (!this.world) {
      return { success: false, error: '系统未初始化' };
    }

    // 计算新装备属性
    const avgLevel = Math.floor((equipment1.level + equipment2.level) / 4);
    const newQuality = this.rollNewQuality(equipment1.quality);
    const newSlot = this.rollNewSlot();

    // 创建新装备实体
    const newEquipment = this.world.createEntity();
    // 这里需要使用工厂来创建装备，暂时返回 ID
    const newEquipmentId = newEquipment.id;

    this.emit(EventType.EQUIPMENT_SYNTHESIZED, {
      newEquipmentId,
      sourceIds: [entity1.id, entity2.id],
      quality: newQuality,
    });

    return {
      success: true,
      newEquipment: newEquipmentId,
    };
  }

  /**
   * 掷新品质（有几率升级）
   */
  private rollNewQuality(currentQuality: Quality): Quality {
    const qualities: Quality[] = ['normal', 'rare', 'epic', 'legendary', 'mythic'];
    const currentIndex = qualities.indexOf(currentQuality);
    
    // 30% 几率升级品质
    if (RandomUtil.rollPercent(30) && currentIndex < qualities.length - 1) {
      return qualities[currentIndex + 1];
    }

    return currentQuality;
  }

  /**
   * 掷新槽位
   */
  private rollNewSlot(): EquipmentSlot {
    const slots: EquipmentSlot[] = ['weapon', 'helmet', 'chestplate', 'gloves', 'boots', 'accessory'];
    return RandomUtil.pick(slots);
  }

  update(_deltaTime: number): void {
    // 合成系统不进行自动更新
  }
}

export default SynthesisSystem;