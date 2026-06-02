/**
 * 数据库抽象层 - 支持 SQLite / MySQL / MongoDB
 */

const config = require('./config');
const path = require('path');
const fs = require('fs');

// 数据库类型
const DB_TYPE = config.database;

// ==================== SQLite 实现 ====================
class SQLiteDatabase {
  private db: any;
  
  constructor() {
    const Database = require('better-sqlite3');
    const dbPath = path.join(__dirname, '..', 'data', 'game.db');
    
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    this.db = new Database(dbPath);
    this.db.pragma('foreign_keys = ON');
    this.initTables();
    console.log('[DB] SQLite 初始化完成');
  }
  
  private initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        uuid TEXT UNIQUE NOT NULL,
        level INTEGER DEFAULT 1,
        exp INTEGER DEFAULT 0,
        gold INTEGER DEFAULT 0,
        current_hp INTEGER DEFAULT 200,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS equipments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        slot TEXT NOT NULL,
        level INTEGER DEFAULT 0,
        quality TEXT DEFAULT 'normal',
        is_broken INTEGER DEFAULT 0,
        equipped INTEGER DEFAULT 0,
        main_affix_stat TEXT,
        main_affix_value INTEGER,
        sub_affixes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS game_state (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        map_data TEXT,
        last_x INTEGER,
        last_y INTEGER,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  }
  
  // 用户操作
  async createUser(username: string) {
    const uuid = this.generateUUID();
    const stmt = this.db.prepare(`
      INSERT INTO users (username, uuid, level, exp, gold, current_hp)
      VALUES (?, ?, 1, 0, 100, 200)
    `);
    const result = stmt.run(username, uuid);
    return { id: result.lastInsertRowid, username, uuid };
  }
  
  async findUserByUsername(username: string) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username);
  }
  
  async findUserById(id: number) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id);
  }
  
  async updateUser(id: number, data: { level?: number; exp?: number; gold?: number; current_hp?: number }) {
    const fields = [];
    const values = [];
    
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });
    
    if (fields.length === 0) return null;
    values.push(id);
    
    const stmt = this.db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
    return stmt.run(...values);
  }
  
  async updateLoginTime(id: number) {
    const stmt = this.db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?');
    return stmt.run(id);
  }
  
  // 装备操作
  async createEquipment(userId: number, equipment: any) {
    const stmt = this.db.prepare(`
      INSERT INTO equipments (user_id, slot, level, quality, is_broken, equipped, main_affix_stat, main_affix_value, sub_affixes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      userId,
      equipment.slot,
      equipment.level || 0,
      equipment.quality || 'normal',
      equipment.isBroken ? 1 : 0,
      equipment.equipped ? 1 : 0,
      equipment.mainAffix?.stat || null,
      equipment.mainAffix?.value || 0,
      JSON.stringify(equipment.subAffixes || [])
    );
    return { id: result.lastInsertRowid, ...equipment };
  }
  
  async getEquipmentsByUserId(userId: number) {
    const stmt = this.db.prepare('SELECT * FROM equipments WHERE user_id = ?');
    return stmt.all(userId).map((row: any) => ({
      id: row.id,
      slot: row.slot,
      level: row.level,
      quality: row.quality,
      isBroken: row.is_broken === 1,
      equipped: row.equipped === 1,
      mainAffix: { stat: row.main_affix_stat, value: row.main_affix_value },
      subAffixes: JSON.parse(row.sub_affixes || '[]'),
      user_id: row.user_id
    }));
  }
  
  async getEquipmentById(id: number) {
    const stmt = this.db.prepare('SELECT * FROM equipments WHERE id = ?');
    const row = stmt.get(id);
    if (!row) return null;
    return {
      id: row.id,
      slot: row.slot,
      level: row.level,
      quality: row.quality,
      isBroken: row.is_broken === 1,
      equipped: row.equipped === 1,
      mainAffix: { stat: row.main_affix_stat, value: row.main_affix_value },
      subAffixes: JSON.parse(row.sub_affixes || '[]'),
      user_id: row.user_id
    };
  }
  
  async updateEquipment(id: number, data: any) {
    const fields = [];
    const values = [];
    
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });
    
    if (fields.length === 0) return null;
    values.push(id);
    
    const stmt = this.db.prepare(`UPDATE equipments SET ${fields.join(', ')} WHERE id = ?`);
    return stmt.run(...values);
  }
  
  async deleteEquipment(id: number) {
    const stmt = this.db.prepare('DELETE FROM equipments WHERE id = ?');
    return stmt.run(id);
  }
  
  // 游戏状态
  async saveGameState(userId: number, mapData: any, x: number, y: number) {
    const stmt = this.db.prepare(`
      INSERT INTO game_state (user_id, map_data, last_x, last_y, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        map_data = excluded.map_data,
        last_x = excluded.last_x,
        last_y = excluded.last_y,
        updated_at = CURRENT_TIMESTAMP
    `);
    return stmt.run(userId, JSON.stringify(mapData), x, y);
  }
  
  async getGameState(userId: number) {
    const stmt = this.db.prepare('SELECT * FROM game_state WHERE user_id = ?');
    const row = stmt.get(userId);
    if (!row || !row.map_data) return null;
    const mapData = JSON.parse(row.map_data);
    if (!mapData.cells || !mapData.player) return null;
    return {
      mapData,
      lastX: row.last_x,
      lastY: row.last_y
    };
  }
  
  private generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c: string) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// ==================== MySQL 实现 ====================
class MySQLDatabase {
  private pool: any;
  
  constructor() {
    const mysql = require('mysql2/promise');
    this.pool = mysql.createPool({
      host: config.mysql.host,
      port: config.mysql.port,
      user: config.mysql.user,
      password: config.mysql.password,
      database: config.mysql.database,
      connectionLimit: config.mysql.connectionLimit,
      waitForConnections: true,
    });
    
    this.initTables();
    console.log('[DB] MySQL 初始化完成');
  }
  
  private async initTables() {
    const conn = await this.pool.getConnection();
    try {
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          uuid VARCHAR(36) UNIQUE NOT NULL,
          level INT DEFAULT 1,
          exp INT DEFAULT 0,
          gold INT DEFAULT 0,
          current_hp INT DEFAULT 200,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_login DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_username (username),
          INDEX idx_uuid (uuid)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS equipments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          slot VARCHAR(20) NOT NULL,
          level INT DEFAULT 0,
          quality VARCHAR(20) DEFAULT 'normal',
          is_broken TINYINT DEFAULT 0,
          equipped TINYINT DEFAULT 0,
          main_affix_stat VARCHAR(30),
          main_affix_value INT,
          sub_affixes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_user_id (user_id),
          INDEX idx_equipped (equipped)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS game_state (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL UNIQUE,
          map_data TEXT,
          last_x INT,
          last_y INT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    } finally {
      conn.release();
    }
  }
  
  async createUser(username: string) {
    const uuid = this.generateUUID();
    const [result] = await this.pool.execute(
      'INSERT INTO users (username, uuid, level, exp, gold, current_hp) VALUES (?, ?, 1, 0, 100, 200)',
      [username, uuid]
    );
    return { id: result.insertId, username, uuid };
  }
  
  async findUserByUsername(username: string) {
    const [rows] = await this.pool.execute('SELECT * FROM users WHERE username = ?', [username]);
    return (rows as any[])[0] || null;
  }
  
  async findUserById(id: number) {
    const [rows] = await this.pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    return (rows as any[])[0] || null;
  }
  
  async updateUser(id: number, data: any) {
    const fields = Object.keys(data).filter(k => data[k] !== undefined);
    if (fields.length === 0) return null;
    
    const sets = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => data[f]);
    values.push(id);
    
    await this.pool.execute(`UPDATE users SET ${sets} WHERE id = ?`, values);
  }
  
  async updateLoginTime(id: number) {
    await this.pool.execute('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [id]);
  }
  
  async createEquipment(userId: number, equipment: any) {
    const [result] = await this.pool.execute(
      `INSERT INTO equipments (user_id, slot, level, quality, is_broken, equipped, main_affix_stat, main_affix_value, sub_affixes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, equipment.slot, equipment.level || 0, equipment.quality || 'normal',
       equipment.isBroken ? 1 : 0, equipment.equipped ? 1 : 0,
       equipment.mainAffix?.stat || null, equipment.mainAffix?.value || 0,
       JSON.stringify(equipment.subAffixes || [])]
    );
    return { id: result.insertId, ...equipment };
  }
  
  async getEquipmentsByUserId(userId: number) {
    const [rows] = await this.pool.execute('SELECT * FROM equipments WHERE user_id = ?', [userId]);
    return (rows as any[]).map(row => ({
      id: row.id,
      slot: row.slot,
      level: row.level,
      quality: row.quality,
      isBroken: row.is_broken === 1,
      equipped: row.equipped === 1,
      mainAffix: { stat: row.main_affix_stat, value: row.main_affix_value },
      subAffixes: JSON.parse(row.sub_affixes || '[]'),
      user_id: row.user_id
    }));
  }
  
  async getEquipmentById(id: number) {
    const [rows] = await this.pool.execute('SELECT * FROM equipments WHERE id = ?', [id]);
    const row = (rows as any[])[0];
    if (!row) return null;
    return {
      id: row.id,
      slot: row.slot,
      level: row.level,
      quality: row.quality,
      isBroken: row.is_broken === 1,
      equipped: row.equipped === 1,
      mainAffix: { stat: row.main_affix_stat, value: row.main_affix_value },
      subAffixes: JSON.parse(row.sub_affixes || '[]'),
      user_id: row.user_id
    };
  }
  
  async updateEquipment(id: number, data: any) {
    const fields = Object.keys(data).filter(k => data[k] !== undefined);
    if (fields.length === 0) return;
    
    const sets = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => data[f]);
    values.push(id);
    
    await this.pool.execute(`UPDATE equipments SET ${sets} WHERE id = ?`, values);
  }
  
  async deleteEquipment(id: number) {
    await this.pool.execute('DELETE FROM equipments WHERE id = ?', [id]);
  }
  
  async saveGameState(userId: number, mapData: any, x: number, y: number) {
    await this.pool.execute(
      `INSERT INTO game_state (user_id, map_data, last_x, last_y) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE map_data = VALUES(map_data), last_x = VALUES(last_x), last_y = VALUES(last_y)`,
      [userId, JSON.stringify(mapData), x, y]
    );
  }
  
  async getGameState(userId: number) {
    const [rows] = await this.pool.execute('SELECT * FROM game_state WHERE user_id = ?', [userId]);
    const row = (rows as any[])[0];
    if (!row || !row.map_data) return null;
    const mapData = JSON.parse(row.map_data);
    // 只有有效的地图数据才返回
    if (!mapData.cells || !mapData.player) return null;
    return {
      mapData,
      lastX: row.last_x,
      lastY: row.last_y
    };
  }
  
  private generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c: string) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// ==================== MongoDB 实现 ====================
class MongoDBDatabase {
  private client: any;
  private db: any;
  private users: any;
  private equipments: any;
  private gameStates: any;
  
  constructor() {
    const { MongoClient } = require('mongodb');
    this.client = new MongoClient(config.mongodb.uri);
    this.init();
    console.log('[DB] MongoDB 初始化完成');
  }
  
  private async init() {
    await this.client.connect();
    this.db = this.client.db(config.mongodb.database);
    this.users = this.db.collection('users');
    this.equipments = this.db.collection('equipments');
    this.gameStates = this.db.collection('game_states');
    
    // 创建索引
    await this.users.createIndex({ username: 1 }, { unique: true });
    await this.users.createIndex({ uuid: 1 }, { unique: true });
    await this.equipments.createIndex({ user_id: 1 });
    await this.equipments.createIndex({ equipped: 1 });
  }
  
  async createUser(username: string) {
    const uuid = this.generateUUID();
    const result = await this.users.insertOne({
      username,
      uuid,
      level: 1,
      exp: 0,
      gold: 100,
      current_hp: 200,
      created_at: new Date(),
      last_login: new Date()
    });
    return { id: result.insertedId, username, uuid };
  }
  
  async findUserByUsername(username: string) {
    return this.users.findOne({ username });
  }
  
  async findUserById(id: any) {
    const { ObjectId } = require('mongodb');
    return this.users.findOne({ _id: new ObjectId(id) });
  }
  
  async updateUser(id: any, data: any) {
    const { ObjectId } = require('mongodb');
    await this.users.updateOne(
      { _id: new ObjectId(id) },
      { $set: data }
    );
  }
  
  async updateLoginTime(id: any) {
    const { ObjectId } = require('mongodb');
    await this.users.updateOne(
      { _id: new ObjectId(id) },
      { $set: { last_login: new Date() } }
    );
  }
  
  async createEquipment(userId: any, equipment: any) {
    const result = await this.equipments.insertOne({
      user_id: userId,
      slot: equipment.slot,
      level: equipment.level || 0,
      quality: equipment.quality || 'normal',
      isBroken: equipment.isBroken || false,
      equipped: equipment.equipped || false,
      mainAffix: equipment.mainAffix,
      subAffixes: equipment.subAffixes || [],
      created_at: new Date()
    });
    return { id: result.insertedId, ...equipment };
  }
  
  async getEquipmentsByUserId(userId: any) {
    return this.equipments.find({ user_id: userId }).toArray();
  }
  
  async getEquipmentById(id: any) {
    const { ObjectId } = require('mongodb');
    return this.equipments.findOne({ _id: new ObjectId(id) });
  }
  
  async updateEquipment(id: any, data: any) {
    const { ObjectId } = require('mongodb');
    await this.equipments.updateOne(
      { _id: new ObjectId(id) },
      { $set: data }
    );
  }
  
  async deleteEquipment(id: any) {
    const { ObjectId } = require('mongodb');
    await this.equipments.deleteOne({ _id: new ObjectId(id) });
  }
  
  async saveGameState(userId: any, mapData: any, x: number, y: number) {
    await this.gameStates.updateOne(
      { user_id: userId },
      { $set: { mapData, lastX: x, lastY: y, updated_at: new Date() } },
      { upsert: true }
    );
  }
  
  async getGameState(userId: any) {
    return this.gameStates.findOne({ user_id: userId });
  }
  
  private generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c: string) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// ==================== 数据库工厂 ====================
function createDatabase() {
  switch (DB_TYPE) {
    case 'mysql':
      return new MySQLDatabase();
    case 'mongodb':
      return new MongoDBDatabase();
    case 'sqlite':
    default:
      return new SQLiteDatabase();
  }
}

const db = createDatabase();
module.exports = db;
export default db;
