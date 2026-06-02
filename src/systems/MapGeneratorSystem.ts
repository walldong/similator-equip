/**
 * MapGeneratorSystem - 地图生成系统
 * 处理地图随机生成逻辑
 */

import { System } from '@/core/System';
import { Entity, World } from '@/core';
import { CellType, DungeonMap, MapCell, EventType, EntityId } from '@/types';
import { RandomUtil } from '@/lib/RandomUtil';

export interface MapConfig {
  width: number;
  height: number;
  wallDensity: number;
  monsterCount: number;
  eliteCount: number;
  bossCount: number;
}

// 预设地图配置
export const MapConfigs: Record<string, MapConfig> = {
  small: { width: 20, height: 20, wallDensity: 0.15, monsterCount: 8, eliteCount: 2, bossCount: 1 },
  medium: { width: 50, height: 50, wallDensity: 0.18, monsterCount: 25, eliteCount: 5, bossCount: 2 },
  large: { width: 100, height: 100, wallDensity: 0.2, monsterCount: 50, eliteCount: 10, bossCount: 3 },
};

export class MapGeneratorSystem extends System {
  private activeMaps: Map<EntityId, DungeonMap> = new Map();

  constructor() {
    super('mapGenerator', [], 5);
  }

  init(world: World): void {
    super.init(world);
  }

  /**
   * 生成随机地图
   */
  generateMap(config: MapConfig, dungeonId: string): EntityId {
    if (!this.world) throw new Error('World not initialized');

    // 创建地图实体
    const mapEntity = this.world.createEntity();

    // 生成地图数据
    const map = this.generateMapData(config);
    this.activeMaps.set(mapEntity.id, map);

    this.emit(EventType.MAP_GENERATED, {
      mapId: mapEntity.id,
      dungeonId,
      width: config.width,
      height: config.height,
    });

    return mapEntity.id;
  }

  /**
   * 生成地图数据
   */
  private generateMapData(config: MapConfig): DungeonMap {
    const { width, height, wallDensity, monsterCount, eliteCount, bossCount } = config;

    // 初始化地图（全部为路径）
    const cells: MapCell[][] = [];
    for (let y = 0; y < height; y++) {
      const row: MapCell[] = [];
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

    // 设置边界墙
    for (let x = 0; x < width; x++) {
      cells[0][x].type = 'wall';
      cells[height - 1][x].type = 'wall';
    }
    for (let y = 0; y < height; y++) {
      cells[y][0].type = 'wall';
      cells[y][width - 1].type = 'wall';
    }

    // 随机生成内部墙体
    const wallCount = Math.floor((width - 2) * (height - 2) * wallDensity);
    for (let i = 0; i < wallCount; i++) {
      const x = RandomUtil.randomInt(2, width - 3);
      const y = RandomUtil.randomInt(2, height - 3);
      cells[y][x].type = 'wall';
    }

    // 设置入口
    cells[1][1].type = 'start';

    // 放置实体
    const usedPositions = new Set<string>(['1,1']);

    // 放置 Boss
    for (let i = 0; i < bossCount; i++) {
      this.placeEntity(cells, width, height, 'boss', usedPositions);
    }

    // 放置精英怪
    for (let i = 0; i < eliteCount; i++) {
      this.placeEntity(cells, width, height, 'elite', usedPositions);
    }

    // 放置普通怪物
    for (let i = 0; i < monsterCount; i++) {
      this.placeEntity(cells, width, height, 'monster', usedPositions);
    }

    // 确保路径可达
    this.ensurePathExists(cells, width, height);

    // 计算Boss数量
    let bossCountActual = 0;
    for (const row of cells) {
      for (const cell of row) {
        if (cell.type === 'boss') bossCountActual++;
      }
    }

    return {
      width,
      height,
      cells,
      playerPos: { x: 1, y: 1 },
      defeatedCells: new Set(),
      bossCount: bossCountActual,
      defeatedBossCount: 0,
    };
  }

  /**
   * 放置实体
   */
  private placeEntity(
    cells: MapCell[][],
    width: number,
    height: number,
    type: CellType,
    usedPositions: Set<string>
  ): boolean {
    for (let attempts = 0; attempts < 100; attempts++) {
      const x = RandomUtil.randomInt(2, width - 3);
      const y = RandomUtil.randomInt(2, height - 3);
      const key = `${x},${y}`;

      if (!usedPositions.has(key) && cells[y][x].type === 'path') {
        cells[y][x].type = type;
        usedPositions.add(key);
        return true;
      }
    }
    return false;
  }

  /**
   * 确保路径可达
   */
  private ensurePathExists(cells: MapCell[][], width: number, height: number): void {
    // 找到入口和所有Boss位置
    const start = { x: 1, y: 1 };
    const bossPositions: { x: number; y: number }[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (cells[y][x].type === 'boss') {
          bossPositions.push({ x, y });
        }
      }
    }

    // 对每个Boss确保路径可达
    for (const boss of bossPositions) {
      if (!this.hasPath(cells, start.x, start.y, boss.x, boss.y, width, height)) {
        this.createPath(cells, start.x, start.y, boss.x, boss.y);
      }
    }
  }

  /**
   * BFS检查路径是否存在
   */
  private hasPath(
    cells: MapCell[][],
    sx: number,
    sy: number,
    ex: number,
    ey: number,
    width: number,
    height: number
  ): boolean {
    const visited = new Set<string>();
    const queue = [{ x: sx, y: sy }];
    visited.add(`${sx},${sy}`);

    while (queue.length > 0) {
      const { x, y } = queue.shift()!;

      if (x === ex && y === ey) return true;

      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        const key = `${nx},${ny}`;

        if (
          nx >= 0 && nx < width &&
          ny >= 0 && ny < height &&
          !visited.has(key) &&
          cells[ny][nx].type !== 'wall'
        ) {
          visited.add(key);
          queue.push({ x: nx, y: ny });
        }
      }
    }

    return false;
  }

  /**
   * 创建路径
   */
  private createPath(
    cells: MapCell[][],
    sx: number,
    sy: number,
    ex: number,
    ey: number
  ): void {
    let x = sx, y = sy;

    while (x !== ex || y !== ey) {
      // 优先向目标移动
      if (x < ex) x++;
      else if (x > ex) x--;
      else if (y < ey) y++;
      else if (y > ey) y--;

      // 如果是墙，改为路径
      if (cells[y][x].type === 'wall') {
        cells[y][x].type = 'path';
      }
    }
  }

  /**
   * 获取地图
   */
  getMap(mapId: EntityId): DungeonMap | undefined {
    return this.activeMaps.get(mapId);
  }

  /**
   * 移动玩家
   */
  movePlayer(mapId: EntityId, dx: number, dy: number): boolean {
    const map = this.activeMaps.get(mapId);
    if (!map) return false;

    const newX = map.playerPos.x + dx;
    const newY = map.playerPos.y + dy;

    // 边界检查
    if (newX < 0 || newX >= map.width || newY < 0 || newY >= map.height) {
      return false;
    }

    // 墙壁检查
    if (map.cells[newY][newX].type === 'wall') {
      return false;
    }

    // 移动
    map.playerPos = { x: newX, y: newY };

    // 更新可见性
    this.updateVisibility(map);

    this.emit(EventType.PLAYER_MOVED, {
      mapId,
      position: map.playerPos,
    });

    return true;
  }

  /**
   * 更新可见性
   */
  private updateVisibility(map: DungeonMap): void {
    const { x, y } = map.playerPos;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
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
   * 标记格子已击败
   */
  markDefeated(mapId: EntityId, x: number, y: number): void {
    const map = this.activeMaps.get(mapId);
    if (!map) return;

    const key = `${x},${y}`;
    map.defeatedCells.add(key);

    // 检查是否是Boss
    if (map.cells[y][x].type === 'boss') {
      map.defeatedBossCount++;
    }

    this.emit(EventType.MONSTER_DEFEATED, {
      mapId,
      position: { x, y },
    });
  }

  /**
   * 检查当前位置是否有怪物
   */
  checkEncounter(mapId: EntityId): CellType | null {
    const map = this.activeMaps.get(mapId);
    if (!map) return null;

    const { x, y } = map.playerPos;
    const cell = map.cells[y][x];
    const key = `${x},${y}`;

    // 检查是否是怪物格子且未击败
    if (['monster', 'elite', 'boss'].includes(cell.type) && !map.defeatedCells.has(key)) {
      return cell.type;
    }

    return null;
  }

  update(_deltaTime: number): void {
    // 地图系统不进行自动更新
  }
}

export default MapGeneratorSystem;