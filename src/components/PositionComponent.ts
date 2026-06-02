/**
 * PositionComponent - 位置组件
 * 用于存储实体在地图上的位置
 */

import { Component } from '@/core/Component';
import { PositionComponent as IPositionComponent } from '@/types';

export class PositionComponent extends Component implements IPositionComponent {
  public readonly type = 'position';
  public x: number;
  public y: number;

  constructor(x: number = 0, y: number = 0) {
    super();
    this.x = x;
    this.y = y;
  }

  /**
   * 设置位置
   */
  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  /**
   * 移动
   */
  move(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
  }

  /**
   * 计算到另一位置的距离（曼哈顿距离）
   */
  distanceTo(x: number, y: number): number {
    return Math.abs(this.x - x) + Math.abs(this.y - y);
  }

  /**
   * 计算到另一位置的欧几里得距离
   */
  euclideanDistanceTo(x: number, y: number): number {
    return Math.sqrt(Math.pow(this.x - x, 2) + Math.pow(this.y - y, 2));
  }

  /**
   * 检查是否在范围内
   */
  isInRange(x: number, y: number, range: number): boolean {
    return this.distanceTo(x, y) <= range;
  }

  serialize(): Record<string, unknown> {
    return {
      type: this.type,
      x: this.x,
      y: this.y,
    };
  }

  static fromData(data: Record<string, unknown>): PositionComponent {
    return new PositionComponent(data.x as number ?? 0, data.y as number ?? 0);
  }
}

export default PositionComponent;