-- 游戏数据库初始化脚本

-- 用户表
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 装备表
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 游戏状态表
CREATE TABLE IF NOT EXISTS game_state (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    map_data LONGTEXT,
    last_x INT,
    last_y INT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 战斗日志表 (可选 - 用于数据分析)
CREATE TABLE IF NOT EXISTS battle_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    monster_type VARCHAR(20),
    monster_level INT,
    victory TINYINT,
    rewards_gold INT,
    rewards_exp INT,
    rewards_items INT,
    battle_duration INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认管理员 (可选)
-- INSERT IGNORE INTO users (username, uuid, level, gold) VALUES ('admin', UUID(), 99, 999999);
