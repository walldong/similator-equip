/**
 * 地图生成器 - 基于地图配置生成
 */

const { MAP_CONFIGS, getMapConfig } = require('./mapConfig');

// 怪物名称
const MONSTER_NAMES = {
  grass: ['野猪', '野狼', '哥布林', '史莱姆'],
  forest: ['树妖', '精灵', '巨蚁', '毒蜘蛛'],
  sand: ['沙虫', '木乃伊', '蝎子', '沙漠狼'],
  stone: ['石巨人', '骷髅', '蝙蝠', '洞穴蜘蛛'],
  lava: ['火元素', '熔岩怪', '恶魔', '炎魔'],
};

// 默认配置
const DEFAULT_CONFIG = {
  monsterDensity: 0.06,
  eliteRatio: 0.04,
  bossRatio: 0.008,
  chestDensity: 0.015,
};

// 随机工具
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => Math.random() * (max - min) + min;
const rollPercent = (percent) => Math.random() * 100 < percent;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * 检查区域是否可以放置指定大小的实体
 */
function canPlaceEntity(cells, x, y, size, width, height) {
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= width - 1 || ny >= height - 1 || nx < 1 || ny < 1) return false;
      if (!cells[ny]?.[nx]?.walkable) return false;
      if (cells[ny][nx].entity) return false;
    }
  }
  return true;
}

/**
 * 放置多格子实体
 */
function placeEntity(cells, x, y, size, entity) {
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (cells[ny]?.[nx]) {
        cells[ny][nx].entity = entity;
        cells[ny][nx].walkable = false; // 大实体阻挡移动
      }
    }
  }
}

/**
 * 生成指定地图
 * @param {number} mapId - 地图ID (1-6)
 * @param {number} playerLevel - 玩家等级
 * @returns {object} GameMap
 */
function generateMap(mapId, playerLevel) {
  const config = getMapConfig(mapId);
  const { width, height, zones, finalBoss, terrain } = config;
  const tileSize = 32;

  // 生成格子
  const cells = generateCells(width, height, config);

  // 添加障碍物
  addObstacles(cells, width, height);

  // 生成普通怪物和精英
  generateEntities(cells, zones, DEFAULT_CONFIG, width, height);

  // 生成宝箱
  generateChests(cells, DEFAULT_CONFIG.chestDensity, playerLevel, width, height);

  // 生成小Boss（每个区域一个，占3x3格子）
  const miniBosses = generateMiniBosses(cells, zones, width, height);

  // 最终Boss不预先生成，等小Boss死后召唤
  // 但我们需要标记最终Boss将出现的位置（地图中心）
  const finalBossSpawnX = Math.floor(width / 2);
  const finalBossSpawnY = Math.floor(height / 2);

  // 中心安全区（清理障碍物，为最终Boss预留空间）
  const safeRadius = 8;
  for (let dy = -safeRadius; dy <= safeRadius; dy++) {
    for (let dx = -safeRadius; dx <= safeRadius; dx++) {
      const x = finalBossSpawnX + dx;
      const y = finalBossSpawnY + dy;
      if (x > 0 && x < width - 1 && y > 0 && y < height - 1 && cells[y]?.[x]) {
        cells[y][x].walkable = true;
        cells[y][x].terrain = terrain;
        // 清除普通怪物，但保留中心区域的空地
        if (Math.abs(dx) <= 3 && Math.abs(dy) <= 3) {
          cells[y][x].entity = undefined;
        }
      }
    }
  }

  // 玩家出生点（中心偏左上）
  const spawnX = finalBossSpawnX - 5;
  const spawnY = finalBossSpawnY - 5;

  // 计算统计
  const stats = calculateStats(cells, miniBosses, finalBoss);

  return {
    mapId,
    mapName: config.name,
    width,
    height,
    tileSize,
    cells,
    player: {
      x: spawnX * tileSize + tileSize / 2,
      y: spawnY * tileSize + tileSize / 2,
      cellX: spawnX,
      cellY: spawnY,
    },
    zones: generateZoneInfo(zones, width, height),
    stats,
    miniBossesDefeated: 0,
    totalMiniBosses: miniBosses.length,
    finalBossSpawnX,
    finalBossSpawnY,
    finalBoss: finalBoss,
    finalBossSpawned: false,
  };
}

/**
 * 生成格子
 */
function generateCells(width, height, mapConfig) {
  const cells = [];
  const terrain = mapConfig.terrain;

  for (let y = 0; y < height; y++) {
    cells[y] = [];
    for (let x = 0; x < width; x++) {
      cells[y][x] = {
        x,
        y,
        terrain,
        walkable: true,
      };
    }
  }

  return cells;
}

/**
 * 添加障碍物
 */
function addObstacles(cells, width, height) {
  const obstacleCount = Math.floor(width * height * 0.015);

  for (let i = 0; i < obstacleCount; i++) {
    const x = randomInt(10, width - 10);
    const y = randomInt(10, height - 10);
    const radius = randomInt(1, 2);

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= radius * radius) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx > 0 && nx < width - 1 && ny > 0 && ny < height - 1) {
            cells[ny][nx].terrain = rollPercent(30) ? 'lava' : 'water';
            cells[ny][nx].walkable = false;
            cells[ny][nx].entity = undefined;
          }
        }
      }
    }
  }
}

/**
 * 生成普通怪物和精英
 */
function generateEntities(cells, zones, config, width, height) {
  const { monsterDensity, eliteRatio, bossRatio } = config;

  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const cell = cells[y][x];
      if (!cell.walkable || cell.entity) continue;

      if (!rollPercent(monsterDensity * 100)) continue;

      const zone = getZoneAt(zones, x, y, width, height);
      if (!zone) continue;

      const level = randomInt(zone.monsterLevel[0], zone.monsterLevel[1]);

      // 确定怪物类型和大小
      let entityType = 'monster';
      let entitySize = 1;
      const roll = randomFloat(0, 1);
      if (roll < bossRatio) {
        entityType = 'boss';
        entitySize = 3;
      } else if (roll < bossRatio + eliteRatio) {
        entityType = 'elite';
        entitySize = 2;
      }

      // 检查是否有足够空间
      if (!canPlaceEntity(cells, x, y, entitySize, width, height)) continue;

      const monsterNames = MONSTER_NAMES[cell.terrain] || ['怪物'];
      const baseName = pick(monsterNames);

      const entity = {
        id: `${entityType}_${x}_${y}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        type: entityType,
        level,
        name: getEntityName(baseName, entityType),
        size: entitySize,
      };

      placeEntity(cells, x, y, entitySize, entity);
    }
  }
}

/**
 * 生成小Boss - 分布在地图四个角落
 */
function generateMiniBosses(cells, zones, width, height) {
  const miniBosses = [];
  const bossSize = 3;
  
  // 四个小Boss分布在四个角落区域
  const cornerPositions = [
    { x: Math.floor(width * 0.15), y: Math.floor(height * 0.15), name: '左上' },    // 左上角
    { x: Math.floor(width * 0.85), y: Math.floor(height * 0.15), name: '右上' },    // 右上角
    { x: Math.floor(width * 0.15), y: Math.floor(height * 0.85), name: '左下' },    // 左下角
    { x: Math.floor(width * 0.85), y: Math.floor(height * 0.85), name: '右下' },    // 右下角
  ];

  zones.forEach((zone, index) => {
    if (!zone.hasMiniBoss) return;

    const corner = cornerPositions[index];
    let placed = false;
    
    // 尝试在角落附近放置
    for (let attempt = 0; attempt < 50 && !placed; attempt++) {
      // 从角落向外搜索
      const offsetX = randomInt(-10, 10);
      const offsetY = randomInt(-10, 10);
      const x = Math.max(5, Math.min(width - bossSize - 5, corner.x + offsetX));
      const y = Math.max(5, Math.min(height - bossSize - 5, corner.y + offsetY));

      if (canPlaceEntity(cells, x, y, bossSize, width, height)) {
        const entity = {
          id: `miniboss_${index}_${x}_${y}`,
          type: 'boss',
          level: zone.monsterLevel[1],
          name: zone.miniBossName,
          size: bossSize,
          isMiniBoss: true,
          miniBossIndex: index,
        };
        placeEntity(cells, x, y, bossSize, entity);
        miniBosses.push({
          index,
          name: zone.miniBossName,
          x, y,
          level: zone.monsterLevel[1],
          defeated: false,
        });
        placed = true;
      }
    }
  });

  return miniBosses;
}

/**
 * 生成宝箱
 */
function generateChests(cells, density, playerLevel, width, height) {
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const cell = cells[y][x];
      if (!cell.walkable || cell.entity) continue;

      if (rollPercent(density * 100)) {
        cell.entity = {
          id: `chest_${x}_${y}`,
          type: 'chest',
          level: playerLevel,
          name: '宝箱',
          size: 1,
        };
      }
    }
  }
}

/**
 * 获取区域
 */
function getZoneAt(zones, x, y, width, height) {
  const zoneWidth = Math.floor(width / 2);
  const zoneHeight = Math.floor(height / 2);
  
  const zoneX = Math.floor(x / zoneWidth);
  const zoneY = Math.floor(y / zoneHeight);
  const zoneIndex = Math.min(zoneY * 2 + zoneX, zones.length - 1);

  return zones[zoneIndex];
}

/**
 * 获取实体名称
 */
function getEntityName(baseName, type) {
  switch (type) {
    case 'elite': return `精英${baseName}`;
    case 'boss': return baseName;
    default: return baseName;
  }
}

/**
 * 生成区域信息
 */
function generateZoneInfo(zones, width, height) {
  const zoneWidth = Math.floor(width / 2);
  const zoneHeight = Math.floor(height / 2);

  return zones.map((zone, index) => ({
    name: zone.name,
    minX: (index % 2) * zoneWidth,
    maxX: ((index % 2) + 1) * zoneWidth - 1,
    minY: Math.floor(index / 2) * zoneHeight,
    maxY: (Math.floor(index / 2) + 1) * zoneHeight - 1,
    terrain: zone.terrain || 'grass',
    monsterLevel: zone.monsterLevel,
    hasMiniBoss: zone.hasMiniBoss,
    miniBossDefeated: false,
  }));
}

/**
 * 计算统计
 */
function calculateStats(cells, miniBosses, finalBoss) {
  const stats = {
    monsters: { total: 0, defeated: 0 },
    elites: { total: 0, defeated: 0 },
    bosses: { total: 0, defeated: 0 },
    miniBosses: { total: miniBosses.length, defeated: 0 },
    chests: { total: 0, opened: 0 },
  };

  // 统计时只计算左上角格子（避免重复计数）
  for (let y = 0; y < cells.length; y++) {
    for (let x = 0; x < cells[y].length; x++) {
      const cell = cells[y][x];
      if (!cell.entity) continue;
      
      // 只统计实体的左上角格子（id包含坐标）
      const entity = cell.entity;
      const idParts = entity.id.split('_');
      const entityX = parseInt(idParts[1]);
      const entityY = parseInt(idParts[2]);
      if (entityX !== x || entityY !== y) continue;

      switch (entity.type) {
        case 'monster':
          if (!entity.isMiniBoss && !entity.isFinalBoss) {
            stats.monsters.total++;
            if (entity.defeated) stats.monsters.defeated++;
          }
          break;
        case 'elite':
          stats.elites.total++;
          if (entity.defeated) stats.elites.defeated++;
          break;
        case 'boss':
          if (entity.isFinalBoss) {
            stats.bosses.total++;
            if (entity.defeated) stats.bosses.defeated++;
          } else if (entity.isMiniBoss) {
            // miniBosses 已在上面初始化
            if (entity.defeated) stats.miniBosses.defeated++;
          } else {
            stats.bosses.total++;
            if (entity.defeated) stats.bosses.defeated++;
          }
          break;
        case 'chest':
          stats.chests.total++;
          if (entity.defeated) stats.chests.opened++;
          break;
      }
    }
  }

  return stats;
}

/**
 * 召唤最终Boss（在小Boss全部击败后调用）
 */
function spawnFinalBoss(cells, finalBoss, spawnX, spawnY) {
  const bossSize = 4; // 最终Boss占4x4格子

  // 清理召唤区域
  for (let dy = -1; dy <= bossSize; dy++) {
    for (let dx = -1; dx <= bossSize; dx++) {
      const x = spawnX + dx - Math.floor(bossSize / 2);
      const y = spawnY + dy - Math.floor(bossSize / 2);
      if (cells[y]?.[x]) {
        cells[y][x].entity = undefined;
        cells[y][x].walkable = true;
      }
    }
  }

  // 放置最终Boss
  const bossX = spawnX - Math.floor(bossSize / 2);
  const bossY = spawnY - Math.floor(bossSize / 2);

  const entity = {
    id: `finalboss_${bossX}_${bossY}_${finalBoss.name}`,
    type: 'boss',
    level: finalBoss.level,
    name: finalBoss.name,
    size: bossSize,
    isFinalBoss: true,
  };

  for (let dy = 0; dy < bossSize; dy++) {
    for (let dx = 0; dx < bossSize; dx++) {
      const x = bossX + dx;
      const y = bossY + dy;
      if (cells[y]?.[x]) {
        cells[y][x].entity = entity;
        cells[y][x].walkable = false;
      }
    }
  }

  return entity;
}

module.exports = { 
  generateMap, 
  getMapConfig, 
  MAP_CONFIGS,
  spawnFinalBoss,
};