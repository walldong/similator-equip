/**
 * Component（组件）基类
 * 组件是纯数据容器，不包含任何逻辑
 */

import { IComponent, ComponentType, EntityId } from '@/types';

/**
 * Component 基类
 */
export abstract class Component implements IComponent {
  public abstract readonly type: ComponentType;
  public entityId!: EntityId;

  /**
   * 序列化组件数据
   */
  abstract serialize(): Record<string, unknown>;

  /**
   * 从数据恢复组件
   */
  static fromData(_data: Record<string, unknown>): Component {
    throw new Error('fromData must be implemented by subclass');
  }
}

/**
 * 创建组件的工厂函数类型
 */
export type ComponentFactory<T extends Component = Component> = (data: Record<string, unknown>) => T;

/**
 * 组件注册表
 */
export class ComponentRegistry {
  private static factories: Map<ComponentType, ComponentFactory> = new Map();

  /**
   * 注册组件工厂
   */
  static register<T extends Component>(type: ComponentType, factory: ComponentFactory<T>): void {
    this.factories.set(type, factory);
  }

  /**
   * 创建组件
   */
  static create<T extends Component>(type: ComponentType, data: Record<string, unknown>): T | null {
    const factory = this.factories.get(type);
    if (!factory) {
      console.warn(`Unknown component type: ${type}`);
      return null;
    }
    return factory(data) as T;
  }

  /**
   * 获取已注册的组件类型
   */
  static getRegisteredTypes(): ComponentType[] {
    return Array.from(this.factories.keys());
  }
}

export default Component;
