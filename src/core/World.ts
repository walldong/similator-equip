/**
 * World（世界）
 * 管理所有实体、组件和系统的容器
 */

import { Entity } from './Entity';
import { System, SystemManager } from './System';
import { EventBus, eventBus } from './EventBus';
import { EntityId, ComponentType, IComponent } from '@/types';

/**
 * World 类 - ECS 架构的核心管理器
 */
export class World {
  private entities: Map<EntityId, Entity> = new Map();
  private componentIndex: Map<ComponentType, Set<EntityId>> = new Map();
  private systemManager: SystemManager;
  private eventBus: EventBus;
  private isRunning: boolean = false;
  private lastUpdateTime: number = 0;

  constructor() {
    this.systemManager = new SystemManager();
    this.eventBus = eventBus;
  }

  // ==================== 实体管理 ====================

  /**
   * 创建实体
   */
  createEntity(): Entity {
    const entity = new Entity();
    this.entities.set(entity.id, entity);
    return entity;
  }

  /**
   * 创建带有初始组件的实体
   */
  createEntityWithComponents(...components: IComponent[]): Entity {
    const entity = this.createEntity();
    components.forEach(component => {
      entity.addComponent(component);
      this.updateIndex(component.type, entity.id);
    });
    return entity;
  }

  /**
   * 获取实体
   */
  getEntity(id: EntityId): Entity | undefined {
    return this.entities.get(id);
  }

  /**
   * 移除实体
   */
  removeEntity(id: EntityId): boolean {
    const entity = this.entities.get(id);
    if (!entity) return false;

    // 清理组件索引
    entity.getComponentTypes().forEach(type => {
      this.componentIndex.get(type)?.delete(id);
    });

    entity.deactivate();
    return this.entities.delete(id);
  }

  /**
   * 检查实体是否存在
   */
  hasEntity(id: EntityId): boolean {
    return this.entities.has(id);
  }

  /**
   * 获取所有实体
   */
  getAllEntities(): Entity[] {
    return Array.from(this.entities.values()).filter(e => e.isActive);
  }

  /**
   * 获取实体数量
   */
  getEntityCount(): number {
    return this.entities.size;
  }

  // ==================== 组件索引 ====================

  /**
   * 更新组件索引
   */
  updateIndex(type: ComponentType, entityId: EntityId): void {
    if (!this.componentIndex.has(type)) {
      this.componentIndex.set(type, new Set());
    }
    this.componentIndex.get(type)!.add(entityId);
  }

  /**
   * 从索引移除实体
   */
  removeFromIndex(type: ComponentType, entityId: EntityId): void {
    this.componentIndex.get(type)?.delete(entityId);
  }

  /**
   * 查询拥有指定组件的实体
   */
  query(componentTypes: ComponentType[]): Entity[] {
    if (componentTypes.length === 0) {
      return this.getAllEntities();
    }

    // 获取第一个组件类型的实体ID集合
    const firstSet = this.componentIndex.get(componentTypes[0]);
    if (!firstSet) return [];

    // 取交集
    const result: Entity[] = [];
    for (const entityId of firstSet) {
      const entity = this.entities.get(entityId);
      if (entity && entity.isActive && componentTypes.every(type => entity.hasComponent(type))) {
        result.push(entity);
      }
    }

    return result;
  }

  /**
   * 查询单个实体
   */
  queryOne(componentTypes: ComponentType[]): Entity | undefined {
    const entities = this.query(componentTypes);
    return entities[0];
  }

  // ==================== 系统管理 ====================

  /**
   * 添加系统
   */
  addSystem(system: System): this {
    this.systemManager.addSystem(system);
    system.init(this);
    return this;
  }

  /**
   * 移除系统
   */
  removeSystem(name: string): boolean {
    return this.systemManager.removeSystem(name);
  }

  /**
   * 获取系统
   */
  getSystem<T extends System>(name: string): T | undefined {
    return this.systemManager.getSystem<T>(name);
  }

  // ==================== 事件管理 ====================

  /**
   * 触发事件
   */
  emit(name: string, payload: Record<string, unknown> = {}): void {
    this.eventBus.emit(name, payload);
  }

  /**
   * 订阅事件
   */
  on(name: string, callback: (payload: Record<string, unknown>) => void): () => void {
    return this.eventBus.on(name, callback);
  }

  // ==================== 生命周期 ====================

  /**
   * 启动世界
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastUpdateTime = Date.now();
  }

  /**
   * 停止世界
   */
  stop(): void {
    this.isRunning = false;
  }

  /**
   * 更新世界
   */
  update(): void {
    if (!this.isRunning) return;

    const now = Date.now();
    const deltaTime = (now - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = now;

    this.systemManager.updateAll(deltaTime);
  }

  /**
   * 清理世界
   */
  destroy(): void {
    this.stop();
    this.systemManager.destroyAll();
    this.entities.clear();
    this.componentIndex.clear();
    this.eventBus.clear();
  }

  // ==================== 序列化 ====================

  /**
   * 序列化世界状态
   */
  serialize(): { entities: ReturnType<Entity['serialize']>[] } {
    return {
      entities: this.getAllEntities().map(e => e.serialize()),
    };
  }

  /**
   * 反序列化
   */
  deserialize(_data: { entities: unknown[] }): void {
    // 实现反序列化逻辑
  }
}

// 创建全局世界实例的工厂函数
export function createWorld(): World {
  return new World();
}

export default World;
