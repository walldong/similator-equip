'use client';

import { useEffect, useCallback, useState } from 'react';
import { GameMap, MapCell } from '@/types/map';
import styles from './Game.module.css';

interface PixiMapProps {
  map: GameMap | null;
  currentHp: number;
  maxHp: number;
  onMove: (dx: number, dy: number) => void;
  onEncounter: (cell: MapCell) => void;
}

// 视野大小
const VIEW_SIZE = 25;

// 格子颜色
const CELL_COLORS: Record<string, string> = {
  grass: '#4a7c59',
  forest: '#228b22',
  sand: '#c2b280',
  stone: '#696969',
  water: '#4a90d9',
  lava: '#ff4500',
};

const ENTITY_ICONS: Record<string, string> = {
  monster: '👹',
  elite: '💀',
  boss: '🐉',
  chest: '📦',
};

export default function PixiMap({ map, currentHp, maxHp, onMove, onEncounter }: PixiMapProps) {
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [moveLock, setMoveLock] = useState(false);

  // 计算视野范围
  const getViewport = useCallback(() => {
    if (!map) return null;
    
    const { cellX, cellY } = map.player;
    const halfView = Math.floor(VIEW_SIZE / 2);
    
    let startX = Math.max(0, cellX - halfView);
    let startY = Math.max(0, cellY - halfView);
    const endX = Math.min(map.width, startX + VIEW_SIZE);
    const endY = Math.min(map.height, startY + VIEW_SIZE);
    
    startX = Math.max(0, endX - VIEW_SIZE);
    startY = Math.max(0, endY - VIEW_SIZE);
    
    return { startX, startY, endX, endY };
  }, [map]);

  // 键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault();
        setKeys(prev => new Set(prev).add(key));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      setKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // 处理移动
  useEffect(() => {
    if (!map || moveLock) return;
    
    const key = keys.values().next().value;
    if (!key) return;
    
    let dx = 0, dy = 0;
    if (key === 'w' || key === 'arrowup') dy = -1;
    else if (key === 's' || key === 'arrowdown') dy = 1;
    else if (key === 'a' || key === 'arrowleft') dx = -1;
    else if (key === 'd' || key === 'arrowright') dx = 1;
    
    if (dx !== 0 || dy !== 0) {
      const newCellX = map.player.cellX + dx;
      const newCellY = map.player.cellY + dy;
      
      if (newCellX >= 0 && newCellX < map.width && newCellY >= 0 && newCellY < map.height) {
        const cell = map.cells[newCellY]?.[newCellX];
        const currentCell = map.cells[map.player.cellY]?.[map.player.cellX];
        
        // 允许移动的条件：目标格子可通行，或者目标格子有实体，或者当前格子不可通行（卡住时）
        const canMove = cell && (
          cell.walkable || 
          (cell.entity && !cell.entity.defeated) ||
          (currentCell && !currentCell.walkable && !currentCell.entity?.defeated)
        );
        
        if (canMove) {
          setMoveLock(true);
          
          if (cell.entity && !cell.entity.defeated) {
            // 对于宝箱，先移动玩家到宝箱位置，然后再打开
            if (cell.entity.type === 'chest') {
              onMove(dx, dy);
              // 等待移动完成后再打开宝箱
              setTimeout(() => onEncounter(cell), 50);
            } else {
              // 对于怪物，触发战斗（战斗胜利后会移动到怪物位置）
              onEncounter(cell);
            }
          } else {
            onMove(dx, dy);
          }
          
          setTimeout(() => setMoveLock(false), 100);
        }
      }
    }
  }, [keys, map, moveLock, onMove, onEncounter]);

  // 检查是否是实体的左上角格子（用于显示图标）
  const isEntityOrigin = useCallback((cell: MapCell, x: number, y: number): boolean => {
    if (!cell.entity) return false;
    
    const entity = cell.entity;
    const size = entity.size || 1;
    
    if (size === 1) return true;
    
    const idParts = entity.id.split('_');
    let startX: number, startY: number;
    
    if (entity.isMiniBoss) {
      // 小Boss格式: miniboss_${index}_${x}_${y}
      startX = parseInt(idParts[2]);
      startY = parseInt(idParts[3]);
    } else if (entity.isFinalBoss) {
      // 最终Boss格式: finalboss_${x}_${y}_${name}
      startX = parseInt(idParts[1]);
      startY = parseInt(idParts[2]);
    } else {
      // 普通怪物格式: ${type}_${x}_${y}_${timestamp}_${random}
      startX = parseInt(idParts[1]);
      startY = parseInt(idParts[2]);
    }
    
    return x === startX && y === startY;
  }, []);

  // HP百分比
  const hpPercent = maxHp > 0 ? (currentHp / maxHp) * 100 : 0;
  
  const viewport = getViewport();
  if (!map || !viewport) {
    return <div className={styles.loadingText}>加载地图...</div>;
  }

  return (
    <div className={styles.miniMapWrapper}>
      {/* HP条 */}
      <div className={styles.hpBar}>
        <div className={styles.hpFill} style={{ width: `${hpPercent}%` }} />
        <span className={styles.hpText}>{currentHp}/{maxHp}</span>
      </div>
      
      {/* 地图网格 */}
      <div className={styles.miniMapGrid} style={{ gridTemplateColumns: `repeat(${VIEW_SIZE}, 1fr)` }}>
        {Array.from({ length: VIEW_SIZE }).map((_, row) =>
          Array.from({ length: VIEW_SIZE }).map((_, col) => {
            const x = viewport.startX + col;
            const y = viewport.startY + row;
            const cell = map.cells[y]?.[x];
            const isPlayer = x === map.player.cellX && y === map.player.cellY;
            
            if (!cell) {
              return <div key={`${x}-${y}`} className={styles.miniMapCell} style={{ background: '#111' }} />;
            }
            
            let bgColor = cell.walkable ? CELL_COLORS[cell.terrain] : '#1a1a2e';
            
            let entityIcon = '';
            let entitySize = 1;
            const entity = cell.entity;
            
            if (entity && !entity.defeated) {
              entitySize = entity.size || 1;
              
              if (entity.isFinalBoss) {
                bgColor = '#2a0a0a';
              } else if (entity.isMiniBoss) {
                bgColor = '#1a1a3a';
              } else if (entity.type === 'elite') {
                bgColor = '#3a3a1a';
              } else if (entity.type === 'boss') {
                bgColor = '#3a1a3a';
              }
              
              // 只在左上角显示图标，并放大覆盖整个实体区域
              if (isEntityOrigin(cell, x, y)) {
                entityIcon = ENTITY_ICONS[entity.type] || '';
              }
            }
            
            const cellClass = `${styles.miniMapCell} ${isPlayer ? styles.playerCell : ''} ${!cell.walkable && !cell.entity ? styles.blocked : ''}`;
            
            return (
              <div
                key={`${x}-${y}`}
                className={cellClass}
                style={{ background: isPlayer ? '#4CAF50' : bgColor }}
                title={`(${x}, ${y}) ${cell.terrain}${cell.entity ? ` - ${cell.entity.name} Lv.${cell.entity.level} (${cell.entity.size || 1}x${cell.entity.size || 1})` : ''}`}
              >
                {isPlayer && <span className={styles.playerIcon}>🧙</span>}
                {!isPlayer && entityIcon && (
                  <span 
                    className={`${styles.entityIcon} ${entitySize === 2 ? styles.entity2x : entitySize === 3 ? styles.entity3x : entitySize >= 4 ? styles.entity4x : ''}`}
                    style={{ 
                      filter: entitySize >= 4 ? 'drop-shadow(0 0 8px #ff0000)' : entitySize >= 3 ? 'drop-shadow(0 0 6px #ff4500)' : entitySize >= 2 ? 'drop-shadow(0 0 4px #ffd700)' : 'none',
                    }}
                  >
                    {entityIcon}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
      
      {/* 控制提示 */}
      <div className={styles.controlHint}>
        使用 WASD 或方向键移动
      </div>
      
      {/* 位置信息 */}
      <div className={styles.positionInfo}>
        📍 位置: ({map.player.cellX}, {map.player.cellY})
      </div>
    </div>
  );
}