// Pixi.js 地图数据结构

// 地形类型
export type TerrainType = 'grass' | 'sand' | 'stone' | 'water' | 'lava' | 'forest';

// 地图格子
export interface MapCell {
  x: number;              // 格子坐标
  y: number;
  terrain: TerrainType;   // 地形类型
  walkable: boolean;      // 是否可通行
  entity?: MapEntity;     // 格子上的实体（怪物/宝箱等）
}

// 地图实体类型
export type EntityType = 'monster' | 'elite' | 'boss' | 'chest' | 'npc' | 'portal';

// 地图实体
export interface MapEntity {
  id: string;
  type: EntityType;
  level: number;
  name: string;
  defeated?: boolean;
}

// 玩家位置（像素坐标）
export interface PlayerPosition {
  x: number;  // 像素坐标
  y: number;
  cellX: number;  // 格子坐标
  cellY: number;
}

// 区域定义
export interface MapZone {
  name: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  terrain: TerrainType;
  monsterLevel: [number, number];  // [min, max]
}

// 完整地图数据
export interface GameMap {
  width: number;          // 格子宽度
  height: number;         // 格子高度
  tileSize: number;       // 格子像素大小
  cells: MapCell[][];     // 二维数组 [y][x]
  player: PlayerPosition;
  zones: MapZone[];
  stats: MapStats;
}

// 地图统计
export interface MapStats {
  monsters: { total: number; defeated: number };
  elites: { total: number; defeated: number };
  bosses: { total: number; defeated: number };
  chests: { total: number; opened: number };
}

// 地图配置
export interface MapConfig {
  width: number;
  height: number;
  tileSize: number;
  monsterDensity: number;   // 0-1
  eliteRatio: number;       // 0-1
  bossRatio: number;        // 0-1
  chestDensity: number;     // 0-1
  zoneCount: number;        // 区域数量
}

// 默认配置
export const DEFAULT_MAP_CONFIG: MapConfig = {
  width: 200,
  height: 200,
  tileSize: 32,
  monsterDensity: 0.05,     // 5% 格子有怪物
  eliteRatio: 0.1,          // 10% 的怪物是精英
  bossRatio: 0.02,          // 2% 的怪物是Boss
  chestDensity: 0.02,       // 2% 格子有宝箱
  zoneCount: 6,             // 6个区域
};

// 地形配置
export const TERRAIN_CONFIG: Record<TerrainType, {
  color: number;
  walkable: boolean;
  moveCost: number;
}> = {
  grass: { color: 0x4a7c59, walkable: true, moveCost: 1 },
  sand: { color: 0xc2b280, walkable: true, moveCost: 1 },
  stone: { color: 0x696969, walkable: true, moveCost: 1 },
  water: { color: 0x4a90d9, walkable: false, moveCost: 999 },
  lava: { color: 0xff4500, walkable: false, moveCost: 999 },
  forest: { color: 0x228b22, walkable: true, moveCost: 1.5 },
};

// 实体颜色
export const ENTITY_COLORS: Record<EntityType, number> = {
  monster: 0xff9800,
  elite: 0x9c27b0,
  boss: 0xf44336,
  chest: 0xffd700,
  npc: 0x4fc3f7,
  portal: 0x00ffff,
};
