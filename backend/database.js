/**
 * SQLite 数据库模块
 */

const Database = require('better-sqlite3');
const path = require('path');

// 数据库文件路径
const dbPath = path.join(__dirname, '..', 'data', 'game.db');

// 确保数据目录存在
const fs = require('fs');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// 创建数据库连接
const db = new Database(dbPath);

// 启用外键约束
db.pragma('foreign_keys = ON');

// 初始化表结构
function initTables() {
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

    console.log('[DB] 数据库表初始化完成');
}

// 初始化
initTables();

// ==================== 用户操作 ====================

const UserMethods = {
    // 创建用户
    create(username) {
        const uuid = generateUUID();
        const stmt = db.prepare(`
            INSERT INTO users (username, uuid, level, exp, gold, current_hp)
            VALUES (?, ?, 1, 0, 100, 200)
        `);
        const result = stmt.run(username, uuid);
        return { id: result.lastInsertRowid, username, uuid };
    },

    // 根据用户名查找
    findByUsername(username) {
        const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
        return stmt.get(username);
    },

    // 根据UUID查找
    findByUUID(uuid) {
        const stmt = db.prepare('SELECT * FROM users WHERE uuid = ?');
        return stmt.get(uuid);
    },

    // 根据ID查找
    findById(id) {
        const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
        return stmt.get(id);
    },

    // 更新用户数据
    update(id, data) {
        const fields = [];
        const values = [];
        
        ['level', 'exp', 'gold', 'current_hp'].forEach(field => {
            if (data[field] !== undefined) {
                fields.push(`${field} = ?`);
                values.push(data[field]);
            }
        });

        if (fields.length === 0) return null;

        values.push(id);
        const stmt = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
        return stmt.run(...values);
    },

    // 更新登录时间
    updateLoginTime(id) {
        const stmt = db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?');
        return stmt.run(id);
    },

    // 获取所有用户
    getAll() {
        const stmt = db.prepare('SELECT id, username, uuid, level, gold, created_at, last_login FROM users ORDER BY last_login DESC');
        return stmt.all();
    },

    // 删除用户
    delete(id) {
        const stmt = db.prepare('DELETE FROM users WHERE id = ?');
        return stmt.run(id);
    }
};

// ==================== 装备操作 ====================

const EquipmentMethods = {
    // 创建装备
    create(userId, equipment) {
        const stmt = db.prepare(`
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
    },

    // 获取用户所有装备
    getByUserId(userId) {
        const stmt = db.prepare('SELECT * FROM equipments WHERE user_id = ?');
        return stmt.all(userId).map(row => ({
            id: row.id,
            slot: row.slot,
            level: row.level,
            quality: row.quality,
            isBroken: row.is_broken === 1,
            equipped: row.equipped === 1,
            mainAffix: {
                stat: row.main_affix_stat,
                value: row.main_affix_value
            },
            subAffixes: JSON.parse(row.sub_affixes || '[]')
        }));
    },

    // 更新装备
    update(id, data) {
        const fields = [];
        const values = [];

        ['level', 'quality', 'is_broken', 'equipped'].forEach(field => {
            if (data[field] !== undefined) {
                fields.push(`${field} = ?`);
                values.push(data[field]);
            }
        });

        if (fields.length === 0) return null;

        values.push(id);
        const stmt = db.prepare(`UPDATE equipments SET ${fields.join(', ')} WHERE id = ?`);
        return stmt.run(...values);
    },

    // 删除装备
    delete(id) {
        const stmt = db.prepare('DELETE FROM equipments WHERE id = ?');
        return stmt.run(id);
    },

    // 获取单个装备
    getById(id) {
        const stmt = db.prepare('SELECT * FROM equipments WHERE id = ?');
        const row = stmt.get(id);
        if (!row) return null;
        return {
            id: row.id,
            slot: row.slot,
            level: row.level,
            quality: row.quality,
            isBroken: row.is_broken === 1,
            equipped: row.equipped === 1,
            mainAffix: {
                stat: row.main_affix_stat,
                value: row.main_affix_value
            },
            subAffixes: JSON.parse(row.sub_affixes || '[]'),
            user_id: row.user_id
        };
    },

    // 删除用户所有装备
    deleteByUserId(userId) {
        const stmt = db.prepare('DELETE FROM equipments WHERE user_id = ?');
        return stmt.run(userId);
    }
};

// ==================== 副本进度操作 ====================

const DungeonMethods = {
    // 获取用户副本进度
    getProgress(userId) {
        const stmt = db.prepare('SELECT * FROM dungeon_progress WHERE user_id = ?');
        return stmt.all(userId);
    },

    // 更新副本进度
    updateProgress(userId, dungeonId, cleared = false) {
        const stmt = db.prepare(`
            INSERT INTO dungeon_progress (user_id, dungeon_id, cleared, attempts)
            VALUES (?, ?, ?, 1)
            ON CONFLICT(user_id, dungeon_id) DO UPDATE SET
                cleared = MAX(cleared, ?),
                attempts = attempts + 1
        `);
        return stmt.run(userId, dungeonId, cleared ? 1 : 0, cleared ? 1 : 0);
    }
};

// ==================== 辅助函数 ====================

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

module.exports = {
    db,
    User: UserMethods,
    Equipment: EquipmentMethods,
    Dungeon: DungeonMethods,
    generateUUID
};
