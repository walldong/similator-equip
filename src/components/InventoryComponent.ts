/**
 * InventoryComponent - 背包组件
 * 用于存储背包数据
 */

import { Component } from '@/core/Component';
import { InventoryComponent as IInventoryComponent, EntityId } from '@/types';

export class InventoryComponent extends Component implements IInventoryComponent {
  public readonly type = 'inventory';
  public items: EntityId[];
  public maxSize: number;

  constructor(maxSize: number = 50) {
    super();
    this.items = [];
    this.maxSize = maxSize;
  }

  /**
   * 添加物品
   */
  addItem(entityId: EntityId): boolean {
    if (this.items.length >= this.maxSize) {
      return false;
    }
    this.items.push(entityId);
    return true;
  }

  /**
   * 移除物品
   */
  removeItem(entityId: EntityId): boolean {
    const index = this.items.indexOf(entityId);
    if (index !== -1) {
      this.items.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 检查是否拥有物品
   */
  hasItem(entityId: EntityId): boolean {
    return this.items.includes(entityId);
  }

  /**
   * 检查是否已满
   */
  isFull(): boolean {
    return this.items.length >= this.maxSize;
  }

  /**
   * 获取剩余空间
   */
  getRemainingSpace(): number {
    return this.maxSize - this.items.length;
  }

  /**
   * 清空背包
   */
  clear(): void {
    this.items = [];
  }

  serialize(): Record<string, unknown> {
    return {
      type: this.type,
      items: this.items,
      maxSize: this.maxSize,
    };
  }

  static fromData(data: Record<string, unknown>): InventoryComponent {
    const component = new InventoryComponent(data.maxSize as number ?? 50);
    component.items = (data.items as EntityId[]) ?? [];
    return component;
  }
}

export default InventoryComponent;