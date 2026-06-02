/**
 * 后端地图生成器
 */

// 区域名称
const ZONE_NAMES = [
  '新手草原',
  '幽暗森林',
  '灼热沙漠',
  '冰霜高原',
  '熔岩地带',
  '暗影深渊',
];

// 怪物名称
const MONSTER_NAMES = {
  grass: ['野猪', '野狼', '哥布林', '史莱姆'],
  forest: ['树妖', '精灵', '巨蚁', '毒蜘蛛'],
  sand: ['沙虫', '木乃伊', '蝎子', '沙漠狼'],
  stone: ['石巨人', '骷髅', '蝙蝠', '洞穴蜘蛛'],
  water: [],
  lava: ['火元素', '熔岩怪', '恶魔', '炎魔'],
};

// 默认配置
const DEFAULT_CONFIG = {
  width: 200,
  height: 200,
  tileSize: 32,
  zoneCount: 6,
  monsterDensity: 0.08,
  eliteRatio: 0.05,
  bossRatio: 0.01,
  chestDensity: 0.02,
};

// 随机工具
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => Math.random() * (max - min) + min;
const rollPercent = (percent) => Math.random() * 100 < percent;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * 生成地图
 * @param {number} playerLevel - 玩家等级
 * @param {object} config - 可选配置
 * @returns {object} GameMap
 */
function generateMap(playerLevel, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { width, height, tileSize, zoneCount, monsterDensity, eliteRatio, bossRatio, chestDensity } = cfg;

  // 生成区域
  const zones = generateZones(width, height, zoneCount, playerLevel);

  // 生成格子
  const cells = generateCells(width, height, zones);

  // 添加障碍物（墙体）
  addObstacles(cells, width, height);

  // 生成怪物
  generateEntities(cells, zones, monsterDensity, eliteRatio, bossRatio, playerLevel);

  // 生成宝箱
  generateChests(cells, chestDensity, playerLevel);

  // 中心安全区
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const safeRadius = 5;
  for (let dy = -safeRadius; dy <= safeRadius; dy++) {
    for (let dx = -safeRadius; dx <= safeRadius; dx++) {
      const x = centerX + dx;
      const y = centerY + dy;
      if (x > 0 && x < width - 1 && y > 0 && y < height - 1 && cells[y]?.[x]) {
        cells[y][x].entity = undefined;
        cells[y][x].walkable = true;
        cells[y][x].terrain = 'grass';
      }
    }
  }

  // 计算统计
  const stats = calculateStats(cells);

  return {
    width,
    height,
    tileSize,
    cells,
    player: {
      x: centerX * tileSize + tileSize / 2,
      y: centerY * tileSize + tileSize / 2,
      cellX: centerX,
      cellY: centerY,
    },
    zones,
    stats,
  };
}

function generateZones(width, height, zoneCount, playerLevel) {
  const zones = [];
  const cols = Math.ceil(Math.sqrt(zoneCount));
  const rows = Math.ceil(zoneCount / cols);
  const zoneWidth = Math.floor(width / cols);
  const zoneHeight = Math.floor(height / rows);

  const terrains = ['grass', 'forest', 'sand', 'stone', 'lava', 'forest'];

  let zoneIndex = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (zoneIndex >= zoneCount) break;

      const terrain = terrains[zoneIndex % terrains.length];
      // 怪物等级加强：基础等级 = 玩家等级 + 区域索引 * 5
      // 第一个区域: 玩家等级 + 0~5
      // 第二个区域: 玩家等级 + 5~10
      // 第三个区域: 玩家等级 + 10~15
      const baseLevel = playerLevel + zoneIndex * 5;

      zones.push({
        name: ZONE_NAMES[zoneIndex % ZONE_NAMES.length],
        minX: col * zoneWidth,
        maxX: (col + 1) * zoneWidth - 1,
        minY: row * zoneHeight,
        maxY: (row + 1) * zoneHeight - 1,
        terrain,
        monsterLevel: [Math.max(1, baseLevel), baseLevel + 5],
      });

      zoneIndex++;
    }
  }

  return zones;
}

function generateCells(width, height, zones) {
  const cells = [];

  for (let y = 0; y < height; y++) {
    cells[y] = [];
    for (let x = 0; x < width; x++) {
      const zone = getZoneAt(zones, x, y);

      cells[y][x] = {
        x,
        y,
        terrain: zone?.terrain || 'grass',
        walkable: true,
      };
    }
  }

  return cells;
}

function generateEntities(cells, zones, density, eliteRatio, bossRatio, playerLevel) {
  const height = cells.length;
  const width = cells[0].length;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const cell = cells[y][x];
      if (!cell.walkable) continue;

      if (!rollPercent(density * 100)) continue;

      const zone = getZoneAt(zones, x, y);
      const level = getMonsterLevel(zone, playerLevel);

      // 确定怪物类型
      let entityType = 'monster';
      const roll = randomFloat(0, 1);
      if (roll < bossRatio) {
        entityType = 'boss';
      } else if (roll < bossRatio + eliteRatio) {
        entityType = 'elite';
      }

      // 生成怪物
      const monsterNames = MONSTER_NAMES[cell.terrain] || ['怪物'];
      const name = pick(monsterNames);

      cell.entity = {
        id: `${entityType}_${x}_${y}`,
        type: entityType,
        level,
        name: getEntityName(name, entityType),
      };
    }
  }
}

function generateChests(cells, density, playerLevel) {
  const height = cells.length;
  const width = cells[0].length;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const cell = cells[y][x];
      if (!cell.walkable || cell.entity) continue;

      if (rollPercent(density * 100)) {
        cell.entity = {
          id: `chest_${x}_${y}`,
          type: 'chest',
          level: playerLevel,
          name: '宝箱',
        };
      }
    }
  }
}

function getZoneAt(zones, x, y) {
  return zones.find(z => x >= z.minX && x <= z.maxX && y >= z.minY && y <= z.maxY);
}

function getMonsterLevel(zone, playerLevel) {
  if (!zone) return playerLevel;
  return randomInt(zone.monsterLevel[0], zone.monsterLevel[1]);
}

function getEntityName(baseName, type) {
  switch (type) {
    case 'elite': return `精英${baseName}`;
    case 'boss': return `${baseName}领主`;
    default: return baseName;
  }
}

function calculateStats(cells) {
  const stats = {
    monsters: { total: 0, defeated: 0 },
    elites: { total: 0, defeated: 0 },
    bosses: { total: 0, defeated: 0 },
    chests: { total: 0, opened: 0 },
  };

  for (const row of cells) {
    for (const cell of row) {
      if (!cell.entity) continue;

      switch (cell.entity.type) {
        case 'monster':
          stats.monsters.total++;
          if (cell.entity.defeated) stats.monsters.defeated++;
          break;
        case 'elite':
          stats.elites.total++;
          if (cell.entity.defeated) stats.elites.defeated++;
          break;
        case 'boss':
          stats.bosses.total++;
          if (cell.entity.defeated) stats.bosses.defeated++;
          break;
        case 'chest':
          stats.chests.total++;
          if (cell.entity.defeated) stats.chests.opened++;
          break;
      }
    }
  }

  return stats;
}

// 添加障碍物（水域/熔岩墙体）
function addObstacles(cells, width, height) {
  const obstacleCount = Math.floor(width * height * 0.02); // 2% 障碍物

  for (let i = 0; i < obstacleCount; i++) {
    const x = randomInt(5, width - 5);
    const y = randomInt(5, height - 5);
    const radius = randomInt(1, 3);

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

module.exports = { generateMap };
