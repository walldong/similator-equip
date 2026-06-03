/**
 * MySQL 数据库模块
 */

function createDatabase(config) {
  const mysql = require('mysql2/promise');
  
  // 连接池
  const pool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectionLimit: config.connectionLimit || 10,
    waitForConnections: true,
    charset: 'utf8mb4'
  });
  
  console.log(`[MySQL] 连接池创建: ${config.host}:${config.port}/${config.database}`);
  
  return {
    pool,
    
    // 初始化表
    async initTables() {
      const conn = await pool.getConnection();
      try {
        await conn.execute(`
          CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password VARCHAR(255) DEFAULT '888888',
            nickname VARCHAR(50),
            uuid VARCHAR(36) UNIQUE NOT NULL,
            level INT DEFAULT 1,
            exp INT DEFAULT 0,
            gold INT DEFAULT 0,
            current_hp INT DEFAULT 200,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_username (username),
            INDEX idx_uuid (uuid)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        await conn.execute(`
          CREATE TABLE IF NOT EXISTS equipments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            slot VARCHAR(20) NOT NULL,
            level INT DEFAULT 0,
            quality VARCHAR(20) DEFAULT 'normal',
            equip_level INT DEFAULT 1,
            is_broken TINYINT DEFAULT 0,
            equipped TINYINT DEFAULT 0,
            name VARCHAR(50),
            main_affix_stat VARCHAR(30),
            main_affix_value INT,
            sub_affixes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_user_id (user_id),
            INDEX idx_equipped (equipped)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        await conn.execute(`
          CREATE TABLE IF NOT EXISTS game_state (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL UNIQUE,
            map_data LONGTEXT,
            last_x INT,
            last_y INT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        // 迁移：为已存在的表添加新字段
        try {
          // 检查是否存在 equip_level 列
          const [columns] = await conn.execute('SHOW COLUMNS FROM equipments LIKE "equip_level"');
          if (columns.length === 0) {
            await conn.execute('ALTER TABLE equipments ADD COLUMN equip_level INT DEFAULT 1 AFTER quality');
            console.log('[MySQL] 添加 equip_level 列');
          }
        } catch (e) {
          // 表不存在或迁移失败，忽略
        }
        
        try {
          // 检查是否存在 name 列
          const [columns] = await conn.execute('SHOW COLUMNS FROM equipments LIKE "name"');
          if (columns.length === 0) {
            await conn.execute('ALTER TABLE equipments ADD COLUMN name VARCHAR(50) AFTER equipped');
            console.log('[MySQL] 添加 name 列');
          }
        } catch (e) {
          // 表不存在或迁移失败，忽略
        }
        
        // 迁移：为 users 表添加 password 和 nickname 列
        try {
          const [pwdColumns] = await conn.execute('SHOW COLUMNS FROM users LIKE "password"');
          if (pwdColumns.length === 0) {
            await conn.execute('ALTER TABLE users ADD COLUMN password VARCHAR(255) DEFAULT "888888" AFTER username');
            console.log('[MySQL] 添加 password 列，默认密码 888888');
          }
        } catch (e) {}
        
        try {
          const [nickColumns] = await conn.execute('SHOW COLUMNS FROM users LIKE "nickname"');
          if (nickColumns.length === 0) {
            await conn.execute('ALTER TABLE users ADD COLUMN nickname VARCHAR(50) AFTER password');
            console.log('[MySQL] 添加 nickname 列');
          }
        } catch (e) {}
        
        console.log('[MySQL] 数据表初始化完成');
      } finally {
        conn.release();
      }
    },
    
    // 健康检查
    async healthCheck() {
      try {
        await pool.execute('SELECT 1');
        return true;
      } catch {
        return false;
      }
    },
    
    // ==================== 用户操作 ====================
    
    createUser(username, password) {
      const uuid = generateUUID();
      const nickname = username; // 默认昵称等于用户名
      const stmt = `
        INSERT INTO users (username, password, nickname, uuid, level, exp, gold, current_hp)
        VALUES (?, ?, ?, ?, 1, 0, 100, 200)
      `;
      return pool.execute(stmt, [username, password, nickname, uuid]).then(([result]) => ({
        id: result.insertId,
        username,
        nickname,
        uuid
      }));
    },
    
    findUserByUsername(username) {
      return pool.execute('SELECT * FROM users WHERE username = ?', [username])
        .then(([rows]) => {
          const row = rows[0];
          if (!row) return null;
          return {
            id: row.id ?? row.ID,
            username: row.username ?? row.USERNAME,
            password: row.password ?? row.PASSWORD,
            nickname: row.nickname ?? row.NICKNAME ?? row.username ?? row.USERNAME,
            uuid: row.uuid ?? row.UUID,
            level: row.level ?? row.LEVEL ?? 1,
            exp: row.exp ?? row.EXP ?? 0,
            gold: row.gold ?? row.GOLD ?? 0,
            current_hp: row.current_hp ?? row.CURRENT_HP ?? 200,
            created_at: row.created_at ?? row.CREATED_AT,
            last_login: row.last_login ?? row.LAST_LOGIN
          };
        });
    },
    
    findUserById(id) {
      return pool.execute('SELECT * FROM users WHERE id = ?', [id])
        .then(([rows]) => {
          const row = rows[0];
          if (!row) return null;
          return {
            id: row.id ?? row.ID,
            username: row.username ?? row.USERNAME,
            password: row.password ?? row.PASSWORD,
            nickname: row.nickname ?? row.NICKNAME ?? row.username ?? row.USERNAME,
            uuid: row.uuid ?? row.UUID,
            level: row.level ?? row.LEVEL ?? 1,
            exp: row.exp ?? row.EXP ?? 0,
            gold: row.gold ?? row.GOLD ?? 0,
            current_hp: row.current_hp ?? row.CURRENT_HP ?? 200,
            created_at: row.created_at ?? row.CREATED_AT,
            last_login: row.last_login ?? row.LAST_LOGIN
          };
        });
    },
    
    updateUser(id, data) {
      const fields = Object.keys(data).filter(k => data[k] !== undefined);
      if (fields.length === 0) return Promise.resolve();
      
      const sets = fields.map(f => `${f} = ?`).join(', ');
      const values = fields.map(f => data[f]);
      values.push(id);
      
      return pool.execute(`UPDATE users SET ${sets} WHERE id = ?`, values);
    },
    
    updateLoginTime(id) {
      return pool.execute('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    },
    
    updateNickname(id, nickname) {
      return pool.execute('UPDATE users SET nickname = ? WHERE id = ?', [nickname, id]);
    },
    
    updatePassword(id, password) {
      return pool.execute('UPDATE users SET password = ? WHERE id = ?', [password, id]);
    },
    
    // ==================== 装备操作 ====================
    
    createEquipment(userId, equipment) {
      const stmt = `
        INSERT INTO equipments (user_id, slot, level, quality, equip_level, is_broken, equipped, name, main_affix_stat, main_affix_value, sub_affixes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      return pool.execute(stmt, [
        userId,
        equipment.slot,
        equipment.level || 0,
        equipment.quality || 'normal',
        equipment.equipLevel || 1,
        equipment.isBroken ? 1 : 0,
        equipment.equipped ? 1 : 0,
        equipment.name || null,
        equipment.mainAffix?.stat || null,
        equipment.mainAffix?.value || 0,
        JSON.stringify(equipment.subAffixes || [])
      ]).then(([result]) => ({
        id: result.insertId,
        ...equipment,
        user_id: userId
      }));
    },
    
    getEquipmentsByUserId(userId) {
      return pool.execute('SELECT * FROM equipments WHERE user_id = ?', [userId])
        .then(([rows]) => rows.map(row => ({
          id: row.id,
          slot: row.slot,
          level: row.level,
          quality: row.quality,
          equipLevel: row.equip_level || 1,
          isBroken: row.is_broken === 1,
          equipped: row.equipped === 1,
          name: row.name || null,
          mainAffix: { stat: row.main_affix_stat, value: row.main_affix_value },
          subAffixes: JSON.parse(row.sub_affixes || '[]'),
          user_id: row.user_id
        })));
    },
    
    getEquipmentById(id) {
      return pool.execute('SELECT * FROM equipments WHERE id = ?', [id])
        .then(([rows]) => {
          const row = rows[0];
          if (!row) return null;
          return {
            id: row.id,
            slot: row.slot,
            level: row.level,
            quality: row.quality,
            equipLevel: row.equip_level || 1,
            isBroken: row.is_broken === 1,
            equipped: row.equipped === 1,
            name: row.name || null,
            mainAffix: { stat: row.main_affix_stat, value: row.main_affix_value },
            subAffixes: JSON.parse(row.sub_affixes || '[]'),
            user_id: row.user_id
          };
        });
    },
    
    updateEquipment(id, data) {
      const fields = Object.keys(data).filter(k => data[k] !== undefined);
      if (fields.length === 0) return Promise.resolve();
      
      const sets = fields.map(f => `${f} = ?`).join(', ');
      const values = fields.map(f => data[f]);
      values.push(id);
      
      return pool.execute(`UPDATE equipments SET ${sets} WHERE id = ?`, values);
    },
    
    deleteEquipment(id) {
      return pool.execute('DELETE FROM equipments WHERE id = ?', [id]);
    },
    
    // ==================== 游戏状态 ====================
    
    saveGameState(userId, mapData, x, y) {
      const stmt = `
        INSERT INTO game_state (user_id, map_data, last_x, last_y)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE map_data = VALUES(map_data), last_x = VALUES(last_x), last_y = VALUES(last_y)
      `;
      return pool.execute(stmt, [userId, JSON.stringify(mapData), x, y]);
    },
    
    getGameState(userId) {
      return pool.execute('SELECT * FROM game_state WHERE user_id = ?', [userId])
        .then(([rows]) => {
          const row = rows[0];
          if (!row) return null;
          return {
            mapData: JSON.parse(row.map_data || '{}'),
            lastX: row.last_x,
            lastY: row.last_y
          };
        });
    }
  };
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

module.exports = { createDatabase };
