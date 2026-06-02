/**
 * Redis 缓存模块
 */

function createCache(config) {
  const Redis = require('ioredis');
  
  const client = new Redis({
    host: config.host,
    port: config.port,
    password: config.password || undefined,
    retryStrategy: (times) => {
      if (times > 3) {
        console.error('[Redis] 连接失败，超过重试次数');
        return null;
      }
      return Math.min(times * 100, 3000);
    }
  });
  
  client.on('connect', () => {
    console.log(`[Redis] 连接成功: ${config.host}:${config.port}`);
  });
  
  client.on('error', (err) => {
    console.error('[Redis] 错误:', err.message);
  });
  
  const KEY_PREFIX = 'game:';
  
  return {
    client,
    
    // 获取缓存
    async get(key) {
      try {
        const data = await client.get(KEY_PREFIX + key);
        if (!data) return null;
        return JSON.parse(data);
      } catch (err) {
        console.error('[Cache] GET 错误:', err.message);
        return null;
      }
    },
    
    // 设置缓存
    async set(key, value, ttl = 300) {
      try {
        const data = JSON.stringify(value);
        if (ttl > 0) {
          await client.setex(KEY_PREFIX + key, ttl, data);
        } else {
          await client.set(KEY_PREFIX + key, data);
        }
      } catch (err) {
        console.error('[Cache] SET 错误:', err.message);
      }
    },
    
    // 删除缓存
    async del(key) {
      try {
        await client.del(KEY_PREFIX + key);
      } catch (err) {
        console.error('[Cache] DEL 错误:', err.message);
      }
    },
    
    // 检查是否存在
    async exists(key) {
      try {
        return await client.exists(KEY_PREFIX + key) === 1;
      } catch {
        return false;
      }
    },
    
    // 设置过期时间
    async expire(key, ttl) {
      try {
        await client.expire(KEY_PREFIX + key, ttl);
      } catch (err) {
        console.error('[Cache] EXPIRE 错误:', err.message);
      }
    },
    
    // 获取或设置（缓存穿透保护）
    async getOrSet(key, callback, ttl = 300) {
      const cached = await this.get(key);
      if (cached !== null) {
        return cached;
      }
      
      const value = await callback();
      await this.set(key, value, ttl);
      return value;
    },
    
    // 健康检查
    async ping() {
      try {
        const result = await client.ping();
        return result === 'PONG';
      } catch {
        return false;
      }
    },
    
    // 批量删除（按模式）
    async delPattern(pattern) {
      try {
        const keys = await client.keys(KEY_PREFIX + pattern);
        if (keys.length > 0) {
          await client.del(...keys);
        }
      } catch (err) {
        console.error('[Cache] DEL_PATTERN 错误:', err.message);
      }
    },
    
    // 缓存键生成器
    userKey(userId) {
      return `user:${userId}`;
    },
    
    equipmentsKey(userId) {
      return `equipments:${userId}`;
    },
    
    battleKey(battleId) {
      return `battle:${battleId}`;
    },
    
    sessionKey(sessionId) {
      return `session:${sessionId}`;
    }
  };
}

module.exports = { createCache };
