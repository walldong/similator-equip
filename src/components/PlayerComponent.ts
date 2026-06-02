/**
 * PlayerComponent - 玩家组件
 * 用于存储玩家特定数据
 */

import { Component } from '@/core/Component';
import { PlayerComponent as IPlayerComponent, EquipmentSlot, EntityId } from '@/types';

export class PlayerComponent extends Component implements IPlayerComponent {
  public readonly type = 'player';
  public level: number;
  public exp: number;
  public gold: number;
  public equipmentSlots: Record<EquipmentSlot, EntityId | null>;

  constructor(level: number = 1, exp: number = 0, gold: number = 100) {
    super();
    this.level = level;
    this.exp = exp;
    this.gold = gold;
    this.equipmentSlots = {
      weapon: null,
      helmet: null,
      chestplate: null,
      gloves: null,
      boots: null,
      accessory: null,
    };
  }

  /**
   * 获取升级所需经验
   */
  getExpForNextLevel(): number {
    return this.level * 100;
  }

  /**
   * 增加经验
   */
  addExp(amount: number): { leveledUp: boolean; newLevel?: number } {
    this.exp += amount;
    let leveledUp = false;
    let newLevel: number | undefined;

    while (this.exp >= this.getExpForNextLevel()) {
      this.exp -= this.getExpForNextLevel();
      this.level++;
      leveledUp = true;
      newLevel = this.level;
    }

    return { leveledUp, newLevel };
  }

  /**
   * 增加金币
   */
  addGold(amount: number): void {
    this.gold += amount;
  }

  /**
   * 消耗金币
   */
  spendGold(amount: number): boolean {
    if (this.gold >= amount) {
      this.gold -= amount;
      return true;
    }
    return false;
  }

  /**
   * 穿戴装备
   */
  equip(slot: EquipmentSlot, entityId: EntityId): EntityId | null {
    const previous = this.equipmentSlots[slot];
    this.equipmentSlots[slot] = entityId;
    return previous;
  }

  /**
   * 卸下装备
   */
  unequip(slot: EquipmentSlot): EntityId | null {
    const previous = this.equipmentSlots[slot];
    this.equipmentSlots[slot] = null;
    return previous;
  }

  /**
   * 获取已穿戴的装备
   */
  getEquipped(slot: EquipmentSlot): EntityId | null {
    return this.equipmentSlots[slot];
  }

  serialize(): Record<string, unknown> {
    return {
      type: this.type,
      level: this.level,
      exp: this.exp,
      gold: this.gold,
      equipmentSlots: this.equipmentSlots,
    };
  }

  static fromData(data: Record<string, unknown>): PlayerComponent {
    const component = new PlayerComponent(
      data.level as number ?? 1,
      data.exp as number ?? 0,
      data.gold as number ?? 100
    );
    component.equipmentSlots = (data.equipmentSlots as Record<EquipmentSlot, EntityId | null>) ?? component.equipmentSlots;
    return component;
  }
}

export default PlayerComponent;