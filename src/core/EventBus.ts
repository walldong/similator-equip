/**
 * EventBus（事件总线）
 * 实现系统间解耦通信
 */

import { EventType, EventPayload, EventCallback } from '@/types';

type EventName = EventType | string;

/**
 * 事件总线类
 */
export class EventBus {
  private listeners: Map<EventName, Set<EventCallback>> = new Map();
  private onceListeners: Map<EventName, Set<EventCallback>> = new Map();
  private eventQueue: Array<{ name: EventName; payload: EventPayload }> = [];
  private isProcessing: boolean = false;

  /**
   * 订阅事件
   */
  on(name: EventName, callback: EventCallback): () => void {
    if (!this.listeners.has(name)) {
      this.listeners.set(name, new Set());
    }
    this.listeners.get(name)!.add(callback);

    // 返回取消订阅函数
    return () => this.off(name, callback);
  }

  /**
   * 订阅一次性事件
   */
  once(name: EventName, callback: EventCallback): () => void {
    if (!this.onceListeners.has(name)) {
      this.onceListeners.set(name, new Set());
    }
    this.onceListeners.get(name)!.add(callback);

    return () => this.onceListeners.get(name)?.delete(callback);
  }

  /**
   * 取消订阅
   */
  off(name: EventName, callback: EventCallback): boolean {
    return this.listeners.get(name)?.delete(callback) ?? false;
  }

  /**
   * 触发事件（同步）
   */
  emit(name: EventName, payload: EventPayload = {}): void {
    const eventPayload = { ...payload, _eventName: name, _timestamp: Date.now() };

    // 触发普通监听器
    const callbacks = this.listeners.get(name);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(eventPayload);
        } catch (error) {
          console.error(`Error in event handler for ${name}:`, error);
        }
      });
    }

    // 触发一次性监听器
    const onceCallbacks = this.onceListeners.get(name);
    if (onceCallbacks) {
      onceCallbacks.forEach(callback => {
        try {
          callback(eventPayload);
        } catch (error) {
          console.error(`Error in once event handler for ${name}:`, error);
        }
      });
      this.onceListeners.delete(name);
    }
  }

  /**
   * 触发事件（异步，放入队列）
   */
  emitAsync(name: EventName, payload: EventPayload = {}): void {
    this.eventQueue.push({ name, payload });
    this.processQueue();
  }

  /**
   * 处理事件队列
   */
  private processQueue(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;
      this.emit(event.name, event.payload);
    }

    this.isProcessing = false;
  }

  /**
   * 清空所有监听器
   */
  clear(): void {
    this.listeners.clear();
    this.onceListeners.clear();
    this.eventQueue = [];
  }

  /**
   * 获取事件的监听器数量
   */
  listenerCount(name: EventName): number {
    const count = (this.listeners.get(name)?.size ?? 0) + (this.onceListeners.get(name)?.size ?? 0);
    return count;
  }

  /**
   * 检查是否有监听器
   */
  hasListeners(name: EventName): boolean {
    return this.listenerCount(name) > 0;
  }
}

// 全局事件总线实例
export const eventBus = new EventBus();

export default EventBus;