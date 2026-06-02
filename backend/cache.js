/**
 * 缓存层抽象 - 支持 Redis 和内存缓存
 */

const config = require('./config');

// 缓存接口
interface CacheInterface {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  expire(key: string, ttl: number): Promise<void>;
}

// 内存缓存实现
class MemoryCache implements CacheInterface {
  private cache: Map<string, { value: any; expireAt: number | null }>;
  
  constructor() {
    this.cache = new Map();
    // 定期清理过期缓存
    setInterval(() => this.cleanup(), 60000);
  }
  
  async get(key: string): Promise<any> {
    const item = this.cache.get(key);
    if (!item) return null;
    if (item.expireAt && Date.now() > item.expireAt) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }
  
  async set(key: string, value: any, ttl?: number): Promise<void> {
    this.cache.set(key, {
      value,
      expireAt: ttl ? Date.now() + ttl * 1000 : null
    });
  }
  
  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }
  
  async exists(key: string): Promise<boolean> {
    const item = this.cache.get(key);
    if (!item) return false;
    if (item.expireAt && Date.now() > item.expireAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }
  
  async expire(key: string, ttl: number): Promise<void> {
    const item = this.cache.get(key);
    if (item) {
      item.expireAt = Date.now() + ttl * 1000;
    }
  }
  
  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (item.expireAt && now > item.expireAt) {
        this.cache.delete(key);
      }
    }
  }
}

// Redis 缓存实现
class RedisCache implements CacheInterface {
  private client: any;
  
  constructor() {
    const Redis = require('ioredis');
    this.client = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      db: config.redis.db,
    });
    
    this.client.on('error', (err: Error) => {
      console.error('[Redis] 连接错误:', err);
    });
    
    this.client.on('connect', () => {
      console.log('[Redis] 连接成功');
    });
  }
  
  async get(key: string): Promise<any> {
    const data = await this.client.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }
  
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const data = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttl) {
      await this.client.setex(key, ttl, data);
    } else {
      await this.client.set(key, data);
    }
  }
  
  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
  
  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }
  
  async expire(key: string, ttl: number): Promise<void> {
    await this.client.expire(key, ttl);
  }
}

// 缓存管理器
class CacheManager {
  private cache: CacheInterface;
  private enabled: boolean;
  private keyPrefix: string;
  
  constructor() {
    this.enabled = config.cache.enabled;
    this.keyPrefix = 'game:';
    
    if (this.enabled) {
      try {
        this.cache = new RedisCache();
        console.log('[Cache] 使用 Redis 缓存');
      } catch (err) {
        console.warn('[Cache] Redis 连接失败，降级为内存缓存');
        this.cache = new MemoryCache();
      }
    } else {
      this.cache = new MemoryCache();
      console.log('[Cache] 使用内存缓存');
    }
  }
  
  private getKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }
  
  async get<T>(key: string): Promise<T | null> {
    return this.cache.get(this.getKey(key));
  }
  
  async set(key: string, value: any, ttl?: number): Promise<void> {
    return this.cache.set(this.getKey(key), value, ttl || config.cache.ttl);
  }
  
  async del(key: string): Promise<void> {
    return this.cache.del(this.getKey(key));
  }
  
  async exists(key: string): Promise<boolean> {
    return this.cache.exists(this.getKey(key));
  }
  
  // 缓存穿透保护：获取数据，不存在则执行回调并缓存
  async getOrSet<T>(key: string, callback: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    
    const value = await callback();
    await this.set(key, value, ttl);
    return value;
  }
  
  // 用户数据缓存键
  userKey(userId: number): string {
    return `user:${userId}`;
  }
  
  // 装备列表缓存键
  equipmentsKey(userId: number): string {
    return `equipments:${userId}`;
  }
  
  // 战斗会话缓存键
  battleKey(battleId: string): string {
    return `battle:${battleId}`;
  }
  
  // 用户会话缓存键
  sessionKey(sessionId: string): string {
    return `session:${sessionId}`;
  }
}

// 单例导出
const cacheManager = new CacheManager();
module.exports = cacheManager;
export default cacheManager;
