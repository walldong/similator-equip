/**
 * WorldMapSystem - 世界地图系统
 * 管理单一世界地图的生成、怪物分布、重置等功能
 */

import { System } from '@/core/System';
import { Entity, World } from '@/core';
import { 
  WorldMap, 
  WorldMapCell, 
  WorldMapConfig, 
  CellType, 
  EventType, 
  EntityId 
} from '@/types';
import { MonsterFactory } from '@/factories/MonsterFactory';
import { MonsterComponent } from '@/components';
import { RandomUtil } from '@/lib/RandomUtil';

/**
 * 世界地图配置
 */
export const WorldMapDefaults: Omit<WorldMapConfig, 'playerLevel'> = {
  width: 200,
  height: 200,
  monsterDensity: 0.15,   // 15% 的格子有怪物
  eliteRatio: 0.08,       // 8% 的怪物是精英
  bossRatio: 0.02,        // 2% 的怪物是Boss
};

/**
 * 地形类型及其权重
 */
const TerrainWeights = {
  path: 70,
  wall: 30,
};

export class WorldMapSystem extends System {
  private worldMap: WorldMap | null = null;
  private monsterFactory: MonsterFactory | null = null;
  private monsterEntities: Map<string, EntityId> = new Map(); // 位置 -> 怪物实体ID

  constructor() {
    super('worldMap', [], 5);
  }

  init(world: World): void {
    super.init(world);
    this.monsterFactory = new MonsterFactory(world);
  }

  /**
   * 生成世界地图
   * @param playerLevel 玩家等级
   * @param config 可选的地图配置
   */
  generateWorldMap(playerLevel: number, config?: Partial<WorldMapConfig>): WorldMap {
    const finalConfig: WorldMapConfig = {
      ...WorldMapDefaults,
      ...config,
      playerLevel,
    };

    const { width, height, monsterDensity, eliteRatio, bossRatio } = finalConfig;

    // 初始化地图格子
    const cells: WorldMapCell[][] = [];
    for (let y = 0; y < height; y++) {
      const row: WorldMapCell[] = [];
      for (let x = 0; x < width; x++) {
        row.push({
          x,
          y,
          type: 'path',
          explored: false,
          visible: false,
        });
      }
      cells.push(row);
    }

    // 生成地形（墙壁和路径）
    this.generateTerrain(cells, width, height);

    // 设置出生点（地图中心附近）
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    cells[centerY][centerX].type = 'start';

    // 统计数据
    let totalMonsters = 0;
    let totalElites = 0;
    let totalBosses = 0;

    // 放置怪物
    const usedPositions = new Set<string>([`${centerX},${centerY}`]);
    const monsterCount = Math.floor((width - 2) * (height - 2) * monsterDensity);
    const eliteCount = Math.floor(monsterCount * eliteRatio);
    const bossCount = Math.floor(monsterCount * bossRatio);
    const normalCount = monsterCount - eliteCount - bossCount;

    // 放置 Boss（等级高于玩家）
    for (let i = 0; i < bossCount; i++) {
      const pos = this.findEmptyPosition(cells, width, height, usedPositions);
      if (pos) {
        cells[pos.y][pos.x].type = 'boss';
        cells[pos.y][pos.x].monsterLevel = playerLevel + RandomUtil.randomInt(1, 5); // +1~+5级
        cells[pos.y][pos.x].monsterType = 'boss';
        usedPositions.add(`${pos.x},${pos.y}`);
        totalBosses++;
      }
    }

    // 放置精英怪（等级玩家等级上下浮动）
    for (let i = 0; i < eliteCount; i++) {
      const pos = this.findEmptyPosition(cells, width, height, usedPositions);
      if (pos) {
        cells[pos.y][pos.x].type = 'elite';
        cells[pos.y][pos.x].monsterLevel = this.rollMonsterLevel(playerLevel);
        cells[pos.y][pos.x].monsterType = 'elite';
        usedPositions.add(`${pos.x},${pos.y}`);
        totalElites++;
      }
    }

    // 放置普通怪物（等级玩家等级上下浮动）
    for (let i = 0; i < normalCount; i++) {
      const pos = this.findEmptyPosition(cells, width, height, usedPositions);
      if (pos) {
        cells[pos.y][pos.x].type = 'monster';
        cells[pos.y][pos.x].monsterLevel = this.rollMonsterLevel(playerLevel);
        cells[pos.y][pos.x].monsterType = 'normal';
        usedPositions.add(`${pos.x},${pos.y}`);
        totalMonsters++;
      }
    }

    // 确保从出生点到边缘有路径
    this.ensurePathsToEdges(cells, width, height, centerX, centerY);

    // 创建世界地图对象
    this.worldMap = {
      id: `world_map_${Date.now()}`,
      width,
      height,
      cells,
      playerPos: { x: centerX, y: centerY },
      defeatedCells: new Set(),
      totalMonsters,
      totalElites,
      totalBosses,
      defeatedMonsters: 0,
      defeatedElites: 0,
      defeatedBosses: 0,
      playerLevel,
      createdAt: Date.now(),
      lastResetAt: Date.now(),
    };

    // 更新初始可见性
    this.updateVisibility(this.worldMap);

    this.emit(EventType.WORLD_MAP_GENERATED, {
      mapId: this.worldMap.id,
      width,
      height,
      playerLevel,
      totalMonsters,
      totalElites,
      totalBosses,
    });

    return this.worldMap;
  }

  /**
   * 生成地形（墙壁和路径）
   */
  private generateTerrain(cells: WorldMapCell[][], width: number, height: number): void {
    // 边界墙
    for (let x = 0; x < width; x++) {
      cells[0][x].type = 'wall';
      cells[height - 1][x].type = 'wall';
    }
    for (let y = 0; y < height; y++) {
      cells[y][0].type = 'wall';
      cells[y][width - 1].type = 'wall';
    }

    // 随机内部墙（使用噪声生成更自然的地形）
    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        if (RandomUtil.rollPercent(TerrainWeights.wall)) {
          cells[y][x].type = 'wall';
        }
      }
    }

    // 平滑地形（减少孤立墙壁）
    this.smoothTerrain(cells, width, height);
  }

  /**
   * 平滑地形
   */
  private smoothTerrain(cells: WorldMapCell[][], width: number, height: number): void {
    // 执行2次平滑
    for (let pass = 0; pass < 2; pass++) {
      const toChange: { x: number; y: number; newType: CellType }[] = [];
      
      for (let y = 2; y < height - 2; y++) {
        for (let x = 2; x < width - 2; x++) {
          let wallCount = 0;
          
          // 检查周围8格
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              if (cells[y + dy][x + dx].type === 'wall') {
                wallCount++;
              }
            }
          }
          
          // 如果周围墙壁太多，变为墙；太少，变为路径
          if (wallCount >= 6) {
            if (cells[y][x].type !== 'wall') {
              toChange.push({ x, y, newType: 'wall' });
            }
          } else if (wallCount <= 2) {
            if (cells[y][x].type === 'wall') {
              toChange.push({ x, y, newType: 'path' });
            }
          }
        }
      }
      
      for (const change of toChange) {
        cells[change.y][change.x].type = change.newType;
      }
    }
  }

  /**
   * 掷怪物等级（玩家等级上下10级）
   */
  private rollMonsterLevel(playerLevel: number): number {
    const minLevel = Math.max(1, playerLevel - 10);
    const maxLevel = playerLevel + 10;
    return RandomUtil.randomInt(minLevel, maxLevel);
  }

  /**
   * 查找空位置
   */
  private findEmptyPosition(
    cells: WorldMapCell[][],
    width: number,
    height: number,
    usedPositions: Set<string>
  ): { x: number; y: number } | null {
    for (let attempts = 0; attempts < 100; attempts++) {
      const x = RandomUtil.randomInt(2, width - 3);
      const y = RandomUtil.randomInt(2, height - 3);
      const key = `${x},${y}`;

      if (!usedPositions.has(key) && cells[y][x].type === 'path') {
        return { x, y };
      }
    }
    return null;
  }

  /**
   * 确保到边缘有路径
   */
  private ensurePathsToEdges(
    cells: WorldMapCell[][],
    width: number,
    height: number,
    startX: number,
    startY: number
  ): void {
    // 创建从中心到四个方向的路径
    const directions = [
      { dx: 1, dy: 0 },   // 右
      { dx: -1, dy: 0 },  // 左
      { dx: 0, dy: 1 },   // 下
      { dx: 0, dy: -1 },  // 上
    ];

    for (const dir of directions) {
      let x = startX;
      let y = startY;
      
      while (x > 1 && x < width - 2 && y > 1 && y < height - 2) {
        x += dir.dx;
        y += dir.dy;
        
        // 清除墙壁
        if (cells[y][x].type === 'wall') {
          cells[y][x].type = 'path';
        }
        
        // 随机偏移，创造更自然的路径
        if (RandomUtil.rollPercent(30)) {
          const offsetX = RandomUtil.randomInt(-1, 1);
          const offsetY = RandomUtil.randomInt(-1, 1);
          const nx = x + offsetX;
          const ny = y + offsetY;
          
          if (nx > 1 && nx < width - 2 && ny > 1 && ny < height - 2) {
            if (cells[ny][nx].type === 'wall') {
              cells[ny][nx].type = 'path';
            }
          }
        }
      }
    }
  }

  /**
   * 重置世界地图（刷新所有怪物）
   * 
   * ⚠️ 此方法只能由玩家手动触发，系统不会自动调用。
   * 
   * @param playerLevel 当前玩家等级
   * @returns 重置后的世界地图
   */
  resetWorldMap(playerLevel: number): WorldMap | null {
    if (!this.worldMap) {
      return this.generateWorldMap(playerLevel);
    }

    // 清除现有怪物实体
    this.monsterEntities.clear();

    // 重置击败记录
    this.worldMap.defeatedCells.clear();
    this.worldMap.defeatedMonsters = 0;
    this.worldMap.defeatedElites = 0;
    this.worldMap.defeatedBosses = 0;
    this.worldMap.lastResetAt = Date.now();
    this.worldMap.playerLevel = playerLevel;

    // 重新设置所有怪物格子
    for (let y = 0; y < this.worldMap.height; y++) {
      for (let x = 0; x < this.worldMap.width; x++) {
        const cell = this.worldMap.cells[y][x];
        
        if (['monster', 'elite', 'boss'].includes(cell.type)) {
          // 重新掷等级
          if (cell.type === 'boss') {
            cell.monsterLevel = playerLevel + RandomUtil.randomInt(1, 5);
          } else {
            cell.monsterLevel = this.rollMonsterLevel(playerLevel);
          }
          cell.explored = false;
          cell.visible = false;
        }
      }
    }

    // 重置玩家位置到中心
    const centerX = Math.floor(this.worldMap.width / 2);
    const centerY = Math.floor(this.worldMap.height / 2);
    this.worldMap.playerPos = { x: centerX, y: centerY };

    // 更新可见性
    this.updateVisibility(this.worldMap);

    this.emit(EventType.WORLD_MAP_RESET, {
      mapId: this.worldMap.id,
      playerLevel,
      timestamp: this.worldMap.lastResetAt,
    });

    return this.worldMap;
  }

  /**
   * 获取世界地图
   */
  getWorldMap(): WorldMap | null {
    return this.worldMap;
  }

  /**
   * 移动玩家
   */
  movePlayer(dx: number, dy: number): boolean {
    if (!this.worldMap) return false;

    const newX = this.worldMap.playerPos.x + dx;
    const newY = this.worldMap.playerPos.y + dy;

    // 边界检查
    if (newX < 0 || newX >= this.worldMap.width || 
        newY < 0 || newY >= this.worldMap.height) {
      return false;
    }

    // 墙壁检查
    if (this.worldMap.cells[newY][newX].type === 'wall') {
      return false;
    }

    // 移动
    this.worldMap.playerPos = { x: newX, y: newY };
    this.updateVisibility(this.worldMap);

    this.emit(EventType.PLAYER_MOVED, {
      position: this.worldMap.playerPos,
    });

    return true;
  }

  /**
   * 更新可见性（玩家周围5x5范围）
   */
  private updateVisibility(map: WorldMap): void {
    const { x, y } = map.playerPos;
    const viewRange = 2; // 可见范围2格，共5x5

    for (let dy = -viewRange; dy <= viewRange; dy++) {
      for (let dx = -viewRange; dx <= viewRange; dx++) {
        const nx = x + dx;
        const ny = y + dy;

        if (nx >= 0 && nx < map.width && ny >= 0 && ny < map.height) {
          map.cells[ny][nx].visible = true;
          map.cells[ny][nx].explored = true;
        }
      }
    }
  }

  /**
   * 检查当前位置是否有怪物遭遇
   */
  checkEncounter(): { type: CellType; level: number; position: { x: number; y: number } } | null {
    if (!this.worldMap) return null;

    const { x, y } = this.worldMap.playerPos;
    const cell = this.worldMap.cells[y][x];
    const key = `${x},${y}`;

    // 检查是否是怪物格子且未击败
    if (['monster', 'elite', 'boss'].includes(cell.type) && 
        !this.worldMap.defeatedCells.has(key)) {
      return {
        type: cell.type,
        level: cell.monsterLevel || 1,
        position: { x, y },
      };
    }

    return null;
  }

  /**
   * 标记怪物已击败
   */
  markDefeated(x: number, y: number): void {
    if (!this.worldMap) return;

    const key = `${x},${y}`;
    this.worldMap.defeatedCells.add(key);

    const cell = this.worldMap.cells[y][x];
    
    // 更新统计数据
    switch (cell.type) {
      case 'monster':
        this.worldMap.defeatedMonsters++;
        break;
      case 'elite':
        this.worldMap.defeatedElites++;
        break;
      case 'boss':
        this.worldMap.defeatedBosses++;
        break;
    }

    this.emit(EventType.MONSTER_DEFEATED, {
      position: { x, y },
      type: cell.type,
      level: cell.monsterLevel,
    });
  }

  /**
   * 获取地图统计信息
   */
  getStatistics(): {
    total: { monsters: number; elites: number; bosses: number };
    defeated: { monsters: number; elites: number; bosses: number };
    progress: number;
  } | null {
    if (!this.worldMap) return null;

    const total = this.worldMap.totalMonsters + this.worldMap.totalElites + this.worldMap.totalBosses;
    const defeated = this.worldMap.defeatedMonsters + this.worldMap.defeatedElites + this.worldMap.defeatedBosses;

    return {
      total: {
        monsters: this.worldMap.totalMonsters,
        elites: this.worldMap.totalElites,
        bosses: this.worldMap.totalBosses,
      },
      defeated: {
        monsters: this.worldMap.defeatedMonsters,
        elites: this.worldMap.defeatedElites,
        bosses: this.worldMap.defeatedBosses,
      },
      progress: total > 0 ? (defeated / total) * 100 : 0,
    };
  }

  /**
   * 序列化世界地图
   */
  serialize(): Record<string, unknown> | null {
    if (!this.worldMap) return null;

    return {
      id: this.worldMap.id,
      width: this.worldMap.width,
      height: this.worldMap.height,
      cells: this.worldMap.cells.map(row => 
        row.map(cell => ({
          x: cell.x,
          y: cell.y,
          type: cell.type,
          explored: cell.explored,
          visible: cell.visible,
          monsterLevel: cell.monsterLevel,
          monsterType: cell.monsterType,
        }))
      ),
      playerPos: this.worldMap.playerPos,
      defeatedCells: Array.from(this.worldMap.defeatedCells),
      totalMonsters: this.worldMap.totalMonsters,
      totalElites: this.worldMap.totalElites,
      totalBosses: this.worldMap.totalBosses,
      defeatedMonsters: this.worldMap.defeatedMonsters,
      defeatedElites: this.worldMap.defeatedElites,
      defeatedBosses: this.worldMap.defeatedBosses,
      playerLevel: this.worldMap.playerLevel,
      createdAt: this.worldMap.createdAt,
      lastResetAt: this.worldMap.lastResetAt,
    };
  }

  /**
   * 从数据恢复世界地图
   */
  restore(data: Record<string, unknown>): WorldMap {
    const cells: WorldMapCell[][] = (data.cells as WorldMapCell[][]).map(row =>
      row.map(cell => ({
        ...cell,
        explored: cell.explored ?? false,
        visible: cell.visible ?? false,
      }))
    );

    this.worldMap = {
      id: data.id as EntityId,
      width: data.width as number,
      height: data.height as number,
      cells,
      playerPos: data.playerPos as { x: number; y: number },
      defeatedCells: new Set(data.defeatedCells as string[]),
      totalMonsters: data.totalMonsters as number,
      totalElites: data.totalElites as number,
      totalBosses: data.totalBosses as number,
      defeatedMonsters: data.defeatedMonsters as number,
      defeatedElites: data.defeatedElites as number,
      defeatedBosses: data.defeatedBosses as number,
      playerLevel: data.playerLevel as number,
      createdAt: data.createdAt as number,
      lastResetAt: data.lastResetAt as number,
    };

    return this.worldMap;
  }

  update(_deltaTime: number): void {
    // 世界地图系统不进行自动更新
  }
}

export default WorldMapSystem;
