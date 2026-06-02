/**
 * Entity（实体）基类
 * 实体是 ECS 架构中的唯一标识，可以附加任意数量的组件
 */

import { EntityId, IComponent, ComponentType } from '@/types';

let entityIdCounter = 0;

/**
 * 生成唯一实体ID
 */
export function generateEntityId(): EntityId {
  return `entity_${Date.now()}_${entityIdCounter++}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Entity 类 - 实体基类
 */
export class Entity {
  public readonly id: EntityId;
  public readonly components: Map<ComponentType, IComponent>;
  public isActive: boolean;

  constructor(id?: EntityId) {
    this.id = id || generateEntityId();
    this.components = new Map();
    this.isActive = true;
  }

  /**
   * 添加组件
   */
  addComponent(component: IComponent): this {
    component.entityId = this.id;
    this.components.set(component.type, component);
    return this;
  }

  /**
   * 移除组件
   */
  removeComponent(type: ComponentType): boolean {
    return this.components.delete(type);
  }

  /**
   * 获取组件
   */
  getComponent<T extends IComponent>(type: ComponentType): T | undefined {
    return this.components.get(type) as T | undefined;
  }

  /**
   * 检查是否拥有组件
   */
  hasComponent(type: ComponentType): boolean {
    return this.components.has(type);
  }

  /**
   * 获取所有组件类型
   */
  getComponentTypes(): ComponentType[] {
    return Array.from(this.components.keys());
  }

  /**
   * 序列化实体数据
   */
  serialize(): { id: EntityId; components: Record<string, IComponent> } {
    const components: Record<string, IComponent> = {};
    this.components.forEach((component, type) => {
      components[type] = component;
    });
    return { id: this.id, components };
  }

  /**
   * 激活实体
   */
  activate(): void {
    this.isActive = true;
  }

  /**
   * 停用实体
   */
  deactivate(): void {
    this.isActive = false;
  }
}

export default Entity;
