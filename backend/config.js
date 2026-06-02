/**
 * 数据库配置
 */

const config = {
  // 数据库类型: sqlite | mysql | mongodb
  database: process.env.DB_TYPE || 'sqlite',
  
  // MySQL 配置
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'game',
    connectionLimit: 10,
  },
  
  // MongoDB 配置
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    database: process.env.MONGODB_DATABASE || 'game',
  },
  
  // Redis 配置
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0'),
  },
  
  // 缓存开关
  cache: {
    enabled: process.env.CACHE_ENABLED === 'true',
    ttl: parseInt(process.env.CACHE_TTL || '300'), // 5分钟
  }
};

module.exports = config;
