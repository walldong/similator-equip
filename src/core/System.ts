/**
 * System（系统）基类
 * 系统处理特定组件的逻辑，每个系统专注于一个功能领域
 */

import { World } from './World';
import { ComponentType } from '@/types';

/**
 * System 基类
 */
export abstract class System {
  protected world: World | null = null;
  public readonly name: string;
  public readonly requiredComponents: ComponentType[];
  public priority: number;

  constructor(name: string, requiredComponents: ComponentType[] = [], priority: number = 0) {
    this.name = name;
    this.requiredComponents = requiredComponents;
    this.priority = priority;
  }

  /**
   * 初始化系统
   */
  init(world: World): void {
    this.world = world;
  }

  /**
   * 更新系统
   * @param deltaTime 时间增量
   */
  abstract update(deltaTime: number): void;

  /**
   * 清理系统
   */
  destroy(): void {
    this.world = null;
  }

  /**
   * 获取系统需要的实体
   */
  protected getEntities(): ReturnType<World['query']> {
    if (!this.world) return [];
    return this.world.query(this.requiredComponents);
  }

  /**
   * 触发事件
   */
  protected emit(name: string, payload: Record<string, unknown> = {}): void {
    if (!this.world) return;
    this.world.emit(name, payload);
  }

  /**
   * 订阅事件
   */
  protected on(name: string, callback: (payload: Record<string, unknown>) => void): () => void {
    if (!this.world) return () => {};
    return this.world.on(name, callback);
  }
}

/**
 * 系统管理器
 */
export class SystemManager {
  private systems: System[] = [];

  /**
   * 添加系统
   */
  addSystem(system: System): void {
    this.systems.push(system);
    this.systems.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 移除系统
   */
  removeSystem(name: string): boolean {
    const index = this.systems.findIndex(s => s.name === name);
    if (index !== -1) {
      this.systems[index].destroy();
      this.systems.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 初始化所有系统
   */
  initAll(world: World): void {
    for (const system of this.systems) {
      system.init(world);
    }
  }

  /**
   * 更新所有系统
   */
  updateAll(deltaTime: number): void {
    for (const system of this.systems) {
      system.update(deltaTime);
    }
  }

  /**
   * 清理所有系统
   */
  destroyAll(): void {
    for (const system of this.systems) {
      system.destroy();
    }
    this.systems = [];
  }

  /**
   * 获取系统
   */
  getSystem<T extends System>(name: string): T | undefined {
    return this.systems.find(s => s.name === name) as T | undefined;
  }

  /**
   * 获取所有系统名称
   */
  getSystemNames(): string[] {
    return this.systems.map(s => s.name);
  }
}

export default System;
