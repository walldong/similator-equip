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
    
    // 修正起始位置
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
      
      // 边界检查
      if (newCellX >= 0 && newCellX < map.width && newCellY >= 0 && newCellY < map.height) {
        const cell = map.cells[newCellY]?.[newCellX];
        
        if (cell && cell.walkable) {
          setMoveLock(true);
          
          // 检查遭遇
          if (cell.entity && !cell.entity.defeated) {
            onEncounter(cell);
          } else {
            onMove(dx, dy);
          }
          
          // 短暂锁定防止连续移动
          setTimeout(() => setMoveLock(false), 100);
        }
      }
    }
  }, [keys, map, moveLock, onMove, onEncounter]);

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
            
            // 背景色
            const bgColor = cell.walkable ? CELL_COLORS[cell.terrain] : '#1a1a2e';
            
            // 实体
            let entityIcon = '';
            if (cell.entity && !cell.entity.defeated) {
              entityIcon = ENTITY_ICONS[cell.entity.type] || '';
            }
            
            const cellClass = `${styles.miniMapCell} ${isPlayer ? styles.playerCell : ''} ${!cell.walkable ? styles.blocked : ''}`;
            
            return (
              <div
                key={`${x}-${y}`}
                className={cellClass}
                style={{ background: isPlayer ? '#4CAF50' : bgColor }}
                title={`(${x}, ${y}) ${cell.terrain}${cell.entity ? ` - ${cell.entity.name} Lv.${cell.entity.level}` : ''}`}
              >
                {isPlayer && <span className={styles.playerIcon}>🧙</span>}
                {!isPlayer && entityIcon && <span>{entityIcon}</span>}
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