/**
 * EquipmentSystem - 装备管理系统
 * 处理装备穿戴/卸下逻辑
 */

import { System } from '@/core/System';
import { EquipmentComponent, PlayerComponent, InventoryComponent, StatsComponent } from '@/components';
import { Entity, World } from '@/core';
import { EntityId, EquipmentSlot, EventType } from '@/types';

export class EquipmentSystem extends System {
  constructor() {
    super('equipmentManager', ['player'], 12);
  }

  init(world: World): void {
    super.init(world);
  }

  /**
   * 穿戴装备
   */
  equipItem(playerId: EntityId, equipmentId: EntityId): EntityId | null {
    if (!this.world) return null;

    const player = this.world.getEntity(playerId);
    const equipment = this.world.getEntity(equipmentId);

    if (!player || !equipment) return null;

    const playerComp = player.getComponent<PlayerComponent>('player');
    const equipmentComp = equipment.getComponent<EquipmentComponent>('equipment');
    const inventory = player.getComponent<InventoryComponent>('inventory');

    if (!playerComp || !equipmentComp) return null;

    const slot = equipmentComp.slot;
    const previousEquipmentId = playerComp.getEquipped(slot);

    // 穿戴新装备
    playerComp.equip(slot, equipmentId);

    // 从背包移除
    if (inventory) {
      inventory.removeItem(equipmentId);
    }

    // 如果有之前的装备，放入背包
    if (previousEquipmentId && inventory) {
      inventory.addItem(previousEquipmentId);
    }

    this.emit(EventType.EQUIPMENT_EQUIPPED, {
      playerId,
      equipmentId,
      slot,
      previousEquipmentId,
    });

    // 重新计算属性
    this.recalculateStats(player);

    return previousEquipmentId;
  }

  /**
   * 卸下装备
   */
  unequipItem(playerId: EntityId, slot: EquipmentSlot): EntityId | null {
    if (!this.world) return null;

    const player = this.world.getEntity(playerId);
    if (!player) return null;

    const playerComp = player.getComponent<PlayerComponent>('player');
    const inventory = player.getComponent<InventoryComponent>('inventory');

    if (!playerComp) return null;

    const equipmentId = playerComp.getEquipped(slot);
    if (!equipmentId) return null;

    // 检查背包空间
    if (inventory && inventory.isFull()) {
      return null;
    }

    // 卸下装备
    const previousId = playerComp.unequip(slot);

    // 放入背包
    if (previousId && inventory) {
      inventory.addItem(previousId);
    }

    this.emit(EventType.EQUIPMENT_UNEQUIPPED, {
      playerId,
      equipmentId: previousId,
      slot,
    });

    // 重新计算属性
    this.recalculateStats(player);

    return previousId;
  }

  /**
   * 重新计算角色属性
   */
  private recalculateStats(player: Entity): void {
    const statsComp = player.getComponent<StatsComponent>('stats');
    const playerComp = player.getComponent<PlayerComponent>('player');

    if (!statsComp || !playerComp || !this.world) return;

    // 清除装备加成
    statsComp.clearBonus();

    // 应用等级基础属性
    const level = playerComp.level;
    statsComp.baseStats.hp = 200 + level * 50;
    statsComp.baseStats.maxHp = 200 + level * 50;
    statsComp.baseStats.atk = 50 + level * 10;
    statsComp.baseStats.def = 30 + level * 5;
    statsComp.baseStats.spd = 20 + level * 2;

    // 应用所有装备加成
    for (const slot of Object.values(playerComp.equipmentSlots)) {
      if (!slot) continue;

      const equipment = this.world.getEntity(slot);
      if (!equipment) continue;

      const equipmentComp = equipment.getComponent<EquipmentComponent>('equipment');
      if (!equipmentComp || equipmentComp.isBroken) continue;

      this.applyEquipmentStats(statsComp, equipmentComp);
    }

    this.emit(EventType.PLAYER_STATS_CHANGED, {
      playerId: player.id,
      stats: statsComp.getTotalStats(),
    });
  }

  /**
   * 应用装备属性
   */
  private applyEquipmentStats(statsComp: StatsComponent, equipment: EquipmentComponent): void {
    const mult = this.getQualityMultiplier(equipment.quality);

    // 主词条
    if (equipment.mainAffix) {
      const value = Math.floor(equipment.mainAffix.value * mult);
      this.applyStat(statsComp, equipment.mainAffix.stat, value);
    }

    // 副词条
    for (const sub of equipment.subAffixes || []) {
      const value = Math.floor(sub.value * mult);
      this.applyStat(statsComp, sub.stat, value);
    }
  }

  /**
   * 应用单个词条
   */
  private applyStat(statsComp: StatsComponent, stat: string, value: number): void {
    switch (stat) {
      case 'ATK_FLAT':
      case 'atk_flat':
        statsComp.addFlatBonus('atk', value);
        break;
      case 'ATK_PERCENT':
      case 'atk_percent':
        statsComp.addPercentBonus('atk', value);
        break;
      case 'DEF_FLAT':
      case 'def_flat':
        statsComp.addFlatBonus('def', value);
        break;
      case 'DEF_PERCENT':
      case 'def_percent':
        statsComp.addPercentBonus('def', value);
        break;
      case 'HP_FLAT':
      case 'hp_flat':
        statsComp.addFlatBonus('hp', value);
        statsComp.addFlatBonus('maxHp', value);
        break;
      case 'HP_PERCENT':
      case 'hp_percent':
        statsComp.addPercentBonus('hp', value);
        statsComp.addPercentBonus('maxHp', value);
        break;
      case 'SPD_FLAT':
      case 'spd_flat':
        statsComp.addFlatBonus('spd', value);
        break;
      case 'CRIT_RATE':
      case 'crit_rate':
        statsComp.addFlatBonus('critRate', value);
        break;
      case 'CRIT_DMG':
      case 'crit_dmg':
        statsComp.addFlatBonus('critDmg', value);
        break;
    }
  }

  /**
   * 获取品质倍率
   */
  private getQualityMultiplier(quality: string): number {
    const multipliers: Record<string, number> = {
      normal: 1.0,
      rare: 1.2,
      epic: 1.5,
      legendary: 2.0,
      mythic: 3.0,
    };
    return multipliers[quality] || 1.0;
  }

  update(_deltaTime: number): void {
    // 装备系统不进行自动更新
  }
}

export default EquipmentSystem;