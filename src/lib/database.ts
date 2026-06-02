/**
 * 数据库模块
 * 使用 better-sqlite3 进行数据持久化
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// 数据库文件路径
const dbPath = path.join(process.cwd(), 'data', 'game.db');

// 确保数据目录存在
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 数据库实例（单例）
let db: Database.Database | null = null;

/**
 * 获取数据库实例
 */
export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('foreign_keys = ON');
    initTables(db);
  }
  return db;
}

/**
 * 初始化数据库表
 */
function initTables(db: Database.Database): void {
  // 用户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      uuid TEXT UNIQUE NOT NULL,
      level INTEGER DEFAULT 1,
      exp INTEGER DEFAULT 0,
      gold INTEGER DEFAULT 0,
      current_hp INTEGER DEFAULT 100,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 装备表
  db.exec(`
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

  // 副本进度表
  db.exec(`
    CREATE TABLE IF NOT EXISTS dungeon_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      dungeon_id TEXT NOT NULL,
      cleared INTEGER DEFAULT 0,
      best_time INTEGER,
      attempts INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, dungeon_id)
    )
  `);

  // 世界地图表
  db.exec(`
    CREATE TABLE IF NOT EXISTS world_map (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      width INTEGER DEFAULT 200,
      height INTEGER DEFAULT 200,
      tile_size INTEGER DEFAULT 32,
      player_x INTEGER DEFAULT 3200,
      player_y INTEGER DEFAULT 3200,
      player_cell_x INTEGER DEFAULT 100,
      player_cell_y INTEGER DEFAULT 100,
      cells TEXT,
      stats TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id)
    )
  `);

  // 迁移：添加缺失的列（如果不存在）
  try {
    db.exec(`ALTER TABLE world_map ADD COLUMN tile_size INTEGER DEFAULT 32`);
  } catch {}
  try {
    db.exec(`ALTER TABLE world_map ADD COLUMN player_cell_x INTEGER DEFAULT 100`);
  } catch {}
  try {
    db.exec(`ALTER TABLE world_map ADD COLUMN player_cell_y INTEGER DEFAULT 100`);
  } catch {}

  console.log('[DB] 数据库表初始化完成');
}

/**
 * 生成 UUID
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 导出数据库操作方法
export const UserMethods = {
  create(username: string) {
    const db = getDatabase();
    const uuid = generateUUID();
    const result = db.prepare(`
      INSERT INTO users (username, uuid, level, exp, gold, current_hp)
      VALUES (?, ?, 1, 0, 100, 200)
    `).run(username, uuid);
    return { id: result.lastInsertRowid, username, uuid };
  },

  findByUsername(username: string) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  },

  findById(id: number) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  update(id: number, data: { level?: number; exp?: number; gold?: number; current_hp?: number }) {
    const db = getDatabase();
    db.prepare(`
      UPDATE users SET level = ?, exp = ?, gold = ?, current_hp = ? WHERE id = ?
    `).run(data.level, data.exp, data.gold, data.current_hp, id);
  },

  getAll() {
    const db = getDatabase();
    return db.prepare('SELECT id, username, uuid, level, gold, created_at, last_login FROM users ORDER BY last_login DESC').all();
  },

  delete(id: number) {
    const db = getDatabase();
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  },
};

export const EquipmentMethods = {
  getByUserId(userId: number) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM equipments WHERE user_id = ?').all(userId);
  },

  create(userId: number, equipment: { slot: string; level?: number; quality?: string; isBroken?: boolean; equipped?: boolean; mainAffix?: { stat: string; value: number }; subAffixes?: Array<{ stat: string; value: number }> }) {
    const db = getDatabase();
    const result = db.prepare(`
      INSERT INTO equipments (user_id, slot, level, quality, is_broken, equipped, main_affix_stat, main_affix_value, sub_affixes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
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
  },

  deleteByUserId(userId: number) {
    const db = getDatabase();
    db.prepare('DELETE FROM equipments WHERE user_id = ?').run(userId);
  },
};

export const DungeonMethods = {
  getProgress(userId: number) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM dungeon_progress WHERE user_id = ?').all(userId);
  },

  updateProgress(userId: number, dungeonId: string, cleared: boolean) {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO dungeon_progress (user_id, dungeon_id, cleared, attempts)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(user_id, dungeon_id) DO UPDATE SET
        cleared = MAX(cleared, ?),
        attempts = attempts + 1
    `).run(userId, dungeonId, cleared ? 1 : 0, cleared ? 1 : 0);
  },
};

export const WorldMapMethods = {
  getByUserId(userId: number) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM world_map WHERE user_id = ?').get(userId) as {
      id: number;
      user_id: number;
      width: number;
      height: number;
      tile_size: number;
      player_x: number;
      player_y: number;
      player_cell_x: number;
      player_cell_y: number;
      cells: string;
      stats: string;
    } | undefined;
  },

  upsert(userId: number, data: {
    width: number;
    height: number;
    tileSize: number;
    playerX: number;
    playerY: number;
    playerCellX: number;
    playerCellY: number;
    cells: string;
    stats: string;
  }) {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO world_map (user_id, width, height, tile_size, player_x, player_y, player_cell_x, player_cell_y, cells, stats)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        width = ?, height = ?, tile_size = ?, player_x = ?, player_y = ?, player_cell_x = ?, player_cell_y = ?, cells = ?, stats = ?
    `).run(
      userId, data.width, data.height, data.tileSize, data.playerX, data.playerY, data.playerCellX, data.playerCellY, data.cells, data.stats,
      data.width, data.height, data.tileSize, data.playerX, data.playerY, data.playerCellX, data.playerCellY, data.cells, data.stats
    );
  },

  deleteByUserId(userId: number) {
    const db = getDatabase();
    db.prepare('DELETE FROM world_map WHERE user_id = ?').run(userId);
  },
};