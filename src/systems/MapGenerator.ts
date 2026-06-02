import { RandomUtil } from '@/lib/RandomUtil';
import {
  GameMap,
  MapCell,
  MapEntity,
  MapConfig,
  MapZone,
  TerrainType,
  EntityType,
  DEFAULT_MAP_CONFIG,
  TERRAIN_CONFIG,
} from '@/types/map';

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
const MONSTER_NAMES: Record<TerrainType, string[]> = {
  grass: ['野猪', '野狼', '哥布林', '史莱姆'],
  forest: ['树妖', '精灵', '巨蚁', '毒蜘蛛'],
  sand: ['沙虫', '木乃伊', '蝎子', '沙漠狼'],
  stone: ['石巨人', '骷髅', '蝙蝠', '洞穴蜘蛛'],
  water: [],
  lava: ['火元素', '熔岩怪', '恶魔', '炎魔'],
};

export class MapGenerator {
  private config: MapConfig;
  private playerLevel: number;

  constructor(playerLevel: number, config: Partial<MapConfig> = {}) {
    this.config = { ...DEFAULT_MAP_CONFIG, ...config };
    this.playerLevel = playerLevel;
  }

  // 生成地图
  generate(): GameMap {
    const { width, height, tileSize } = this.config;
    
    // 生成区域
    const zones = this.generateZones();
    
    // 生成格子
    const cells = this.generateCells(zones);
    
    // 生成玩家位置（中心）
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    
    // 清除玩家周围5x5区域的实体
    const safeRadius = 5;
    for (let dy = -safeRadius; dy <= safeRadius; dy++) {
      for (let dx = -safeRadius; dx <= safeRadius; dx++) {
        const x = centerX + dx;
        const y = centerY + dy;
        if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
          if (cells[y]?.[x]) {
            cells[y][x].entity = undefined;
            cells[y][x].walkable = true;
            cells[y][x].terrain = 'grass';
          }
        }
      }
    }
    
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
      stats: this.calculateStats(cells),
    };
  }

  // 生成区域
  private generateZones(): MapZone[] {
    const zones: MapZone[] = [];
    const { width, height, zoneCount } = this.config;
    
    // 将地图划分为若干区域
    const cols = Math.ceil(Math.sqrt(zoneCount));
    const rows = Math.ceil(zoneCount / cols);
    const zoneWidth = Math.floor(width / cols);
    const zoneHeight = Math.floor(height / rows);
    
    const terrains: TerrainType[] = ['grass', 'forest', 'sand', 'stone', 'lava', 'forest'];
    
    let zoneIndex = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (zoneIndex >= zoneCount) break;
        
        const terrain = terrains[zoneIndex % terrains.length];
        const baseLevel = this.playerLevel - 5 + zoneIndex * 3;
        
        zones.push({
          name: ZONE_NAMES[zoneIndex % ZONE_NAMES.length],
          minX: col * zoneWidth,
          maxX: (col + 1) * zoneWidth - 1,
          minY: row * zoneHeight,
          maxY: (row + 1) * zoneHeight - 1,
          terrain,
          monsterLevel: [
            Math.max(1, baseLevel - 5),
            baseLevel + 5,
          ],
        });
        
        zoneIndex++;
      }
    }
    
    return zones;
  }

  // 生成格子
  private generateCells(zones: MapZone[]): MapCell[][] {
    const { width, height, monsterDensity, eliteRatio, bossRatio, chestDensity } = this.config;
    
    // 初始化二维数组
    const cells: MapCell[][] = [];
    
    for (let y = 0; y < height; y++) {
      cells[y] = [];
      for (let x = 0; x < width; x++) {
        // 获取当前位置的区域
        const zone = this.getZoneAt(zones, x, y);
        
        // 基础格子
        const cell: MapCell = {
          x,
          y,
          terrain: zone?.terrain || 'grass',
          walkable: true,
        };
        
        // 边界水域
        if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
          cell.terrain = 'water';
          cell.walkable = false;
        }
        
        cells[y][x] = cell;
      }
    }
    
    // 添加随机水域/熔岩（障碍物）
    this.addObstacles(cells);
    
    // 生成怪物
    this.generateEntities(cells, zones, monsterDensity, eliteRatio, bossRatio);
    
    // 生成宝箱
    this.generateChests(cells, chestDensity);
    
    // 确保出生点可通行
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    cells[centerY][centerX].walkable = true;
    cells[centerY][centerX].terrain = 'grass';
    cells[centerY][centerX].entity = undefined;
    
    return cells;
  }

  // 添加障碍物
  private addObstacles(cells: MapCell[][]): void {
    const { width, height } = this.config;
    
    // 随机添加水域/熔岩区域
    const obstacleCount = Math.floor(width * height * 0.02); // 2% 障碍物
    
    for (let i = 0; i < obstacleCount; i++) {
      const x = RandomUtil.randomInt(5, width - 5);
      const y = RandomUtil.randomInt(5, height - 5);
      const radius = RandomUtil.randomInt(1, 3);
      
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy <= radius * radius) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx > 0 && nx < width - 1 && ny > 0 && ny < height - 1) {
              cells[ny][nx].terrain = RandomUtil.rollPercent(30) ? 'lava' : 'water';
              cells[ny][nx].walkable = false;
            }
          }
        }
      }
    }
  }

  // 生成实体
  private generateEntities(
    cells: MapCell[][],
    zones: MapZone[],
    density: number,
    eliteRatio: number,
    bossRatio: number
  ): void {
    const { width, height } = this.config;
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const cell = cells[y][x];
        if (!cell.walkable) continue;
        
        // 检查是否生成怪物
        if (!RandomUtil.rollPercent(density * 100)) continue;
        
        const zone = this.getZoneAt(zones, x, y);
        const level = this.getMonsterLevel(zone);
        
        // 确定怪物类型
        let entityType: EntityType = 'monster';
        const roll = RandomUtil.randomFloat(0, 1);
        if (roll < bossRatio) {
          entityType = 'boss';
        } else if (roll < bossRatio + eliteRatio) {
          entityType = 'elite';
        }
        
        // 生成怪物
        const monsterNames = MONSTER_NAMES[cell.terrain] || ['怪物'];
        const name = RandomUtil.pick(monsterNames);
        
        cell.entity = {
          id: `${entityType}_${x}_${y}`,
          type: entityType,
          level,
          name: this.getEntityName(name, entityType),
        };
      }
    }
  }

  // 生成宝箱
  private generateChests(cells: MapCell[][], density: number): void {
    const { width, height } = this.config;
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const cell = cells[y][x];
        if (!cell.walkable || cell.entity) continue;
        
        if (RandomUtil.rollPercent(density * 100)) {
          cell.entity = {
            id: `chest_${x}_${y}`,
            type: 'chest',
            level: this.playerLevel,
            name: '宝箱',
          };
        }
      }
    }
  }

  // 获取区域
  private getZoneAt(zones: MapZone[], x: number, y: number): MapZone | undefined {
    return zones.find(z => x >= z.minX && x <= z.maxX && y >= z.minY && y <= z.maxY);
  }

  // 获取怪物等级
  private getMonsterLevel(zone?: MapZone): number {
    if (!zone) return this.playerLevel;
    return RandomUtil.randomInt(zone.monsterLevel[0], zone.monsterLevel[1]);
  }

  // 获取实体名称
  private getEntityName(baseName: string, type: EntityType): string {
    switch (type) {
      case 'elite': return `精英${baseName}`;
      case 'boss': return `${baseName}领主`;
      default: return baseName;
    }
  }

  // 计算统计
  private calculateStats(cells: MapCell[][]): GameMap['stats'] {
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
}
