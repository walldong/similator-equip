/**
 * 数据迁移脚本: SQLite -> MySQL
 * 
 * 使用方法:
 * 1. 确保 MySQL Docker 容器已启动: docker-compose up -d
 * 2. 运行迁移: node migrate-to-mysql.js
 */

const Database = require('better-sqlite3');
const mysql = require('mysql2/promise');
const path = require('path');

// SQLite 数据库路径
const SQLITE_PATH = path.join(__dirname, '..', 'data', 'game.db');

// MySQL 配置
const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'game',
  password: process.env.MYSQL_PASSWORD || 'game123456',
  database: process.env.MYSQL_DATABASE || 'game',
};

async function migrate() {
  console.log('========================================');
  console.log('  数据迁移: SQLite -> MySQL');
  console.log('========================================\n');

  // 1. 连接 SQLite
  console.log('[1/4] 连接 SQLite...');
  const sqlite = new Database(SQLITE_PATH);
  sqlite.pragma('journal_mode = RO');
  
  // 2. 连接 MySQL
  console.log('[2/4] 连接 MySQL...');
  const mysqlConn = await mysql.createConnection(MYSQL_CONFIG);
  console.log('      MySQL 连接成功\n');

  // 3. 读取 SQLite 数据
  console.log('[3/4] 读取 SQLite 数据...');
  
  const users = sqlite.prepare('SELECT * FROM users').all();
  console.log(`      用户: ${users.length} 条`);
  
  const equipments = sqlite.prepare('SELECT * FROM equipments').all();
  console.log(`      装备: ${equipments.length} 条\n`);

  // 4. 迁移数据到 MySQL
  console.log('[4/4] 迁移数据到 MySQL...');
  
  // 创建 ID 映射（SQLite ID -> MySQL ID）
  const userIdMap = new Map();
  
  // 迁移用户
  console.log('      迁移用户...');
  for (const user of users) {
    const [result] = await mysqlConn.execute(
      `INSERT INTO users (username, uuid, level, exp, gold, current_hp, created_at, last_login)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.username, user.uuid, user.level, user.exp, user.gold, user.current_hp, user.created_at, user.last_login]
    );
    userIdMap.set(user.id, result.insertId);
    console.log(`      - 用户 ${user.username} (ID: ${user.id} -> ${result.insertId})`);
  }
  
  // 迁移装备
  console.log('      迁移装备...');
  let equipCount = 0;
  for (const eq of equipments) {
    const newUserId = userIdMap.get(eq.user_id);
    if (!newUserId) {
      console.log(`      [警告] 装备 ${eq.id} 的用户 ${eq.user_id} 不存在，跳过`);
      continue;
    }
    
    await mysqlConn.execute(
      `INSERT INTO equipments (user_id, slot, level, quality, is_broken, equipped, main_affix_stat, main_affix_value, sub_affixes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newUserId,
        eq.slot,
        eq.level,
        eq.quality,
        eq.is_broken,
        eq.equipped,
        eq.main_affix_stat,
        eq.main_affix_value,
        eq.sub_affixes,
        eq.created_at
      ]
    );
    equipCount++;
  }
  console.log(`      - 装备: ${equipCount} 条\n`);

  // 关闭连接
  sqlite.close();
  await mysqlConn.end();

  console.log('========================================');
  console.log('  迁移完成!');
  console.log(`  用户: ${users.length} 条`);
  console.log(`  装备: ${equipCount} 条`);
  console.log('========================================');
}

// 运行迁移
migrate().catch(err => {
  console.error('\n迁移失败:', err.message);
  process.exit(1);
});
