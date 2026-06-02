/**
 * ECS 核心模块导出
 */

export { Entity, generateEntityId } from './Entity';
export { Component, ComponentRegistry } from './Component';
export { System, SystemManager } from './System';
export { World, createWorld } from './World';
export { EventBus, eventBus } from './EventBus';
