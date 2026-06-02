/**
 * InventorySystem - 背包系统
 * 处理背包管理逻辑
 */

import { System } from '@/core/System';
import { InventoryComponent } from '@/components';
import { Entity, World } from '@/core';
import { EntityId, EventType } from '@/types';

export class InventorySystem extends System {
  constructor() {
    super('inventory', ['inventory'], 15);
  }

  init(world: World): void {
    super.init(world);

    // 订阅物品拾取事件
    this.on(EventType.ITEM_PICKED_UP, this.handleItemPickup.bind(this));
  }

  /**
   * 处理物品拾取
   */
  private handleItemPickup(payload: Record<string, unknown>): void {
    const { playerId, itemId } = payload as { playerId: EntityId; itemId: EntityId };
    this.addItemToInventory(playerId, itemId);
  }

  /**
   * 添加物品到背包
   */
  addItemToInventory(playerId: EntityId, itemId: EntityId): boolean {
    if (!this.world) return false;

    const player = this.world.getEntity(playerId);
    if (!player) return false;

    const inventory = player.getComponent<InventoryComponent>('inventory');
    if (!inventory) return false;

    if (!inventory.addItem(itemId)) {
      return false;
    }

    this.emit(EventType.INVENTORY_CHANGED, {
      playerId,
      action: 'add',
      itemId,
    });

    return true;
  }

  /**
   * 从背包移除物品
   */
  removeItemFromInventory(playerId: EntityId, itemId: EntityId): boolean {
    if (!this.world) return false;

    const player = this.world.getEntity(playerId);
    if (!player) return false;

    const inventory = player.getComponent<InventoryComponent>('inventory');
    if (!inventory) return false;

    if (!inventory.removeItem(itemId)) {
      return false;
    }

    this.emit(EventType.INVENTORY_CHANGED, {
      playerId,
      action: 'remove',
      itemId,
    });

    return true;
  }

  /**
   * 检查背包是否已满
   */
  isInventoryFull(playerId: EntityId): boolean {
    if (!this.world) return true;

    const player = this.world.getEntity(playerId);
    if (!player) return true;

    const inventory = player.getComponent<InventoryComponent>('inventory');
    return inventory?.isFull() ?? true;
  }

  /**
   * 获取背包剩余空间
   */
  getRemainingSpace(playerId: EntityId): number {
    if (!this.world) return 0;

    const player = this.world.getEntity(playerId);
    if (!player) return 0;

    const inventory = player.getComponent<InventoryComponent>('inventory');
    return inventory?.getRemainingSpace() ?? 0;
  }

  update(_deltaTime: number): void {
    // 背包系统不进行自动更新
  }
}

export default InventorySystem;