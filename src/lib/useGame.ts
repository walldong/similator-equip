/**
 * 游戏状态管理 Hook - 前端只负责UI展示,所有逻辑在服务端执行
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { EquipmentSlot, Quality } from '@/types';

// API 基础地址
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// 游戏状态接口
export interface GameState {
  isLoggedIn: boolean;
  userId: number | null;
  username: string;
  level: number;
  exp: number;
  gold: number;
  currentHp: number;
  maxHp: number;
  stats: {
    atk: number;
    def: number;
    spd: number;
    critRate: number;
    critDmg: number;
  };
  inventory: EquipmentItem[];
  equippedItems: Record<EquipmentSlot, EquipmentItem | null>;
  logs: LogEntry[];
  gameMap: import('@/types/map').GameMap | null;
  battle: BattleState | null;
}

export interface BattleState {
  isActive: boolean;
  battleId: string | null;
  currentRound: number;
  playerRage: number;
  monsterRage: number;
  playerHp: number;
  playerMaxHp: number;
  monsterName: string;
  monsterHp: number;
  monsterMaxHp: number;
  monsterLevel: number;
  monsterType: 'normal' | 'elite' | 'boss';
  monsterCellX: number;
  monsterCellY: number;
  logs: BattleLogEntry[];
  skills: SkillData[];
  dropInfo?: {
    gold: number;
    items: EquipmentItem[];
    exp: number;
  };
}

export interface BattleLogEntry {
  id: number;
  text: string;
  type: string;
}

export interface SkillData {
  id: string;
  name: string;
  rageCost: number;
  canUse: boolean;
  icon: string;
}

export interface EquipmentItem {
  id: string;
  slot: EquipmentSlot;
  level: number;
  quality: Quality;
  equipLevel?: number;  // 装备等级要求
  isBroken: boolean;
  name?: string;  // 装备名称
  mainAffix: { stat: string; value: number };
  subAffixes: Array<{ stat: string; value: number; upgradeCount?: number; isFixed?: boolean }>;
}

export interface LogEntry {
  id: number;
  text: string;
  type: 'info' | 'success' | 'warning' | 'fail';
  time: string;
}

// API 调用封装
async function apiCall(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  return response.json();
}

// 玩家技能列表
const playerSkills: SkillData[] = [
  { id: 'heavy_hit', name: '重击', rageCost: 30, canUse: true, icon: '💥' },
  { id: 'whirlwind', name: '旋风斩', rageCost: 50, canUse: true, icon: '🌪️' },
  { id: 'fatal_strike', name: '致命一击', rageCost: 80, canUse: true, icon: '⚔️' },
  { id: 'heal', name: '治愈之光', rageCost: 40, canUse: true, icon: '💚' },
  { id: 'war_cry', name: '战吼', rageCost: 100, canUse: true, icon: '📢' },
  { id: 'rage', name: '狂暴', rageCost: 100, canUse: true, icon: '🔥' },
];

// 主 Hook
export default function useGame() {
  const [state, setState] = useState<GameState>({
    isLoggedIn: false,
    userId: null,
    username: '',
    level: 1,
    exp: 0,
    gold: 100,
    currentHp: 200,
    maxHp: 200,
    stats: { atk: 50, def: 30, spd: 20, critRate: 0, critDmg: 0 },
    inventory: [],
    equippedItems: {
      weapon: null,
      helmet: null,
      chestplate: null,
      gloves: null,
      boots: null,
      accessory: null,
    },
    logs: [],
    gameMap: null,
    battle: null,
  });

  const logIdRef = useRef(0);
  const initializingRef = useRef(false);
  const positionSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 添加日志
  const addLog = useCallback((text: string, type: LogEntry['type'] = 'info') => {
    setState((prev) => {
      if (prev.logs.length > 0 && prev.logs[0].text === text && prev.logs[0].type === type) {
        return prev;
      }
      const entry: LogEntry = {
        id: ++logIdRef.current,
        text,
        type,
        time: new Date().toLocaleTimeString(),
      };
      return {
        ...prev,
        logs: [entry, ...prev.logs.slice(0, 49)],
      };
    });
  }, []);

  // 自动登录
  useEffect(() => {
    if (initializingRef.current) return;
    initializingRef.current = true;

    const savedUsername = localStorage.getItem('gameUsername');
    if (savedUsername) {
      login(savedUsername).catch(() => {
        localStorage.removeItem('gameUsername');
      });
    }
  }, []);

  // 清理位置保存定时器
  useEffect(() => {
    return () => {
      if (positionSaveTimerRef.current) {
        clearTimeout(positionSaveTimerRef.current);
      }
    };
  }, []);


  // 登录
  const login = useCallback(async (username: string) => {
    try {
      const data = await apiCall('/login', {
        method: 'POST',
        body: JSON.stringify({ username }),
      });

      if (data.success) {
        const userData = data.data;

        localStorage.setItem('gameUsername', username);

        setState((prev) => ({
          ...prev,
          isLoggedIn: true,
          userId: userData.id,
          username: userData.username,
          level: userData.level,
          exp: userData.exp,
          gold: userData.gold,
          currentHp: userData.currentHp,
          maxHp: userData.maxHp,
          stats: userData.stats,
          inventory: userData.inventory || [],
          equippedItems: userData.equippedItems || {
            weapon: null, helmet: null, chestplate: null,
            gloves: null, boots: null, accessory: null,
          },
        }));

        // 生成地图,传递 userId 和 level
        generateWorldMap(userData.id, userData.level);

        addLog(`欢迎 ${userData.username}!`, 'success');
        return { success: true };
      }

      return { success: false, message: data.message };
    } catch (error) {
      return { success: false, message: '网络错误' };
    }
  }, [addLog]);

  // 注册
  const register = useCallback(async (username: string) => {
    try {
      const data = await apiCall('/register', {
        method: 'POST',
        body: JSON.stringify({ username }),
      });

      if (data.success) {
        const userData = data.data;

        localStorage.setItem('gameUsername', username);

        setState((prev) => ({
          ...prev,
          isLoggedIn: true,
          userId: userData.id,
          username: userData.username,
          level: userData.level,
          exp: userData.exp,
          gold: userData.gold,
          currentHp: userData.currentHp,
          maxHp: userData.maxHp,
          stats: userData.stats,
          inventory: userData.inventory || [],
          equippedItems: userData.equippedItems || {
            weapon: null, helmet: null, chestplate: null,
            gloves: null, boots: null, accessory: null,
          },
        }));

        addLog(`注册成功! 欢迎 ${userData.username}!`, 'success');
        return { success: true };
      }

      return { success: false, message: data.message };
    } catch (error) {
      return { success: false, message: '网络错误' };
    }
  }, [addLog]);

  // 保存游戏
  const saveGame = useCallback(async () => {
    if (!state.userId) return;

    try {
      await apiCall('/save', {
        method: 'POST',
        body: JSON.stringify({
          userId: state.userId,
          data: {
            level: state.level,
            exp: state.exp,
            gold: state.gold,
            currentHp: state.currentHp,
          },
        }),
      });

      if (state.gameMap) {
        await apiCall('/worldmap', {
          method: 'POST',
          body: JSON.stringify({
            userId: state.userId,
            data: state.gameMap,
          }),
        });
      }

      addLog('💾 游戏已保存', 'success');
    } catch (error) {
      addLog('保存失败', 'fail');
    }
  }, [state, addLog]);

  // 恢复生命
  const healPlayer = useCallback(async () => {
    if (!state.userId) return;

    try {
      const data = await apiCall('/heal', {
        method: 'POST',
        body: JSON.stringify({ userId: state.userId }),
      });

      if (data.success) {
        setState((prev) => ({
          ...prev,
          currentHp: data.data.currentHp,
          maxHp: data.data.maxHp,
        }));
        addLog('💚 生命已恢复', 'success');
      }
    } catch (error) {
      addLog('恢复失败', 'fail');
    }
  }, [state.userId, addLog]);

  // 穿戴装备
  const equipItem = useCallback(async (item: EquipmentItem) => {
    if (!state.userId) return;

    try {
      const data = await apiCall('/equipment/equip', {
        method: 'POST',
        body: JSON.stringify({ userId: state.userId, equipmentId: item.id }),
      });

      if (data.success) {
        setState((prev) => ({
          ...prev,
          inventory: data.data.inventory,
          equippedItems: data.data.equippedItems,
          stats: data.data.stats,
          maxHp: data.data.maxHp,
        }));
        addLog(data.message, 'success');
      } else {
        addLog(data.message, 'warning');
      }
    } catch (error) {
      addLog('穿戴失败', 'fail');
    }
  }, [state.userId, addLog]);

  // 卸下装备
  const unequipItem = useCallback(async (slot: EquipmentSlot) => {
    if (!state.userId) return;

    try {
      const data = await apiCall('/equipment/unequip', {
        method: 'POST',
        body: JSON.stringify({ userId: state.userId, slot }),
      });

      if (data.success) {
        setState((prev) => ({
          ...prev,
          inventory: data.data.inventory,
          equippedItems: data.data.equippedItems,
          stats: data.data.stats,
          maxHp: data.data.maxHp,
        }));
        addLog(data.message, 'info');
      } else {
        addLog(data.message, 'warning');
      }
    } catch (error) {
      addLog('卸下失败', 'fail');
    }
  }, [state.userId, addLog]);

  // 强化装备
  const enhanceItem = useCallback(async (item: EquipmentItem) => {
    if (!state.userId || item.isBroken || item.level >= 21) return;

    try {
      const data = await apiCall('/equipment/enhance', {
        method: 'POST',
        body: JSON.stringify({ userId: state.userId, equipmentId: item.id }),
      });

      if (data.broken) {
        // 装备损坏，从列表移除，扣除金币
        setState((prev) => ({
          ...prev,
          gold: data.gold ?? prev.gold,
          inventory: prev.inventory.filter((i) => i.id !== item.id),
          equippedItems: {
            ...prev.equippedItems,
            [item.slot]: prev.equippedItems[item.slot]?.id === item.id ? null : prev.equippedItems[item.slot],
          },
        }));
        addLog(data.message + `（消耗 ${data.cost} 金币）`, 'fail');
      } else if (data.success) {
        // 强化成功，更新装备和金币
        setState((prev) => ({
          ...prev,
          gold: data.gold ?? prev.gold,
          inventory: prev.inventory.map((i) =>
            i.id === item.id
              ? { ...i, level: data.data.level, mainAffix: data.data.mainAffix, subAffixes: data.data.subAffixes }
              : i
          ),
          equippedItems: {
            ...prev.equippedItems,
            [item.slot]:
              prev.equippedItems[item.slot]?.id === item.id
                ? { ...prev.equippedItems[item.slot]!, level: data.data.level, mainAffix: data.data.mainAffix, subAffixes: data.data.subAffixes }
                : prev.equippedItems[item.slot],
          },
        }));
        addLog(data.message + `（消耗 ${data.cost} 金币）`, 'success');
      } else {
        addLog(data.message, 'warning');
      }
    } catch (error) {
      addLog('强化失败', 'fail');
    }
  }, [state.userId, addLog]);

  // 删除装备
  const deleteItem = useCallback(async (item: EquipmentItem) => {
    if (!state.userId) return;

    try {
      const data = await apiCall(`/equipment/${item.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ userId: state.userId }),
      });

      if (data.success) {
        setState((prev) => ({
          ...prev,
          inventory: prev.inventory.filter((i) => i.id !== item.id),
        }));
        addLog(data.message, 'warning');
      }
    } catch (error) {
      addLog('删除失败', 'fail');
    }
  }, [state.userId, addLog]);

  // 从后端加载地图数据
  const loadWorldMap = useCallback(async (userId: number) => {
    try {
      const data = await apiCall(`/worldmap/${userId}`);
      // 检查返回数据是否有效(必须有 cells 和 player)
      if (data.success && data.data && data.data.cells && data.data.player) {
        return data.data as import('@/types/map').GameMap;
      }
      return null;
    } catch (error) {
      console.error('加载地图失败:', error);
      return null;
    }
  }, []);

  // 保存玩家位置(轻量级)
  const savePosition = useCallback(async (cellX: number, cellY: number, userId?: number) => {
    const effectiveUserId = userId || state.userId;
    if (!effectiveUserId) return;

    try {
      await apiCall('/worldmap/position', {
        method: 'POST',
        body: JSON.stringify({ userId: effectiveUserId, cellX, cellY }),
      });
    } catch (error) {
      console.error('保存位置失败:', error);
    }
  }, [state.userId]);

  // 更新怪物击败状态(轻量级)
  const updateEntityDefeated = useCallback(async (cellX: number, cellY: number, defeated: boolean) => {
    if (!state.userId) return;

    try {
      await apiCall('/worldmap/entity', {
        method: 'POST',
        body: JSON.stringify({ userId: state.userId, cellX, cellY, defeated }),
      });
    } catch (error) {
      console.error('更新怪物状态失败:', error);
    }
  }, [state.userId]);

  // 加载或生成地图(登录时调用)
  const generateWorldMap = useCallback(async (userId?: number, level?: number) => {
    const effectiveUserId = userId || state.userId;
    const effectiveLevel = level || state.level;
    if (!effectiveUserId) return;

    // 先尝试从后端加载地图
    let gameMap = await loadWorldMap(effectiveUserId);

    if (!gameMap) {
      // 没有保存的地图，请求后端生成
      const data = await apiCall('/worldmap/generate', {
        method: 'POST',
        body: JSON.stringify({ userId: effectiveUserId, level: effectiveLevel }),
      });
      if (data.success && data.data) {
        gameMap = data.data;
        addLog('🗺️ 新世界地图已生成', 'success');
      }
    } else {
      addLog('🗺️ 地图数据已加载', 'success');
    }

    setState((prev) => ({ ...prev, gameMap }));
  }, [state.level, state.userId, loadWorldMap, addLog]);

  // 重置世界地图（手动触发，后端生成）
  const resetWorldMap = useCallback(async () => {
    if (!state.userId) return;

    // 请求后端生成新地图
    const data = await apiCall('/worldmap/generate', {
      method: 'POST',
      body: JSON.stringify({ userId: state.userId, level: state.level }),
    });

    if (data.success && data.data) {
      setState((prev) => ({ ...prev, gameMap: data.data }));
      addLog('🔄 地图已重置', 'success');
    }
  }, [state.level, state.userId, addLog]);

  // 防抖动保存位置(轻量级)
  const savePositionDebounced = useCallback((cellX: number, cellY: number) => {
    // 清除之前的定时器
    if (positionSaveTimerRef.current) {
      clearTimeout(positionSaveTimerRef.current);
    }

    // 设置新的定时器,1.5秒后保存
    positionSaveTimerRef.current = setTimeout(() => {
      savePosition(cellX, cellY);
    }, 1500);
  }, [savePosition]);

  // 移动玩家
  const movePlayer = useCallback((dx: number, dy: number) => {
    setState((prev) => {
      const gameMap = prev.gameMap;
      if (!gameMap) return prev;

      const newCellX = gameMap.player.cellX + dx;
      const newCellY = gameMap.player.cellY + dy;

      if (newCellX < 0 || newCellX >= gameMap.width || newCellY < 0 || newCellY >= gameMap.height) {
        return prev;
      }

      const cell = gameMap.cells[newCellY]?.[newCellX];
      if (!cell || !cell.walkable) return prev;

      // 触发防抖动保存位置
      savePositionDebounced(newCellX, newCellY);

      return {
        ...prev,
        gameMap: {
          ...gameMap,
          player: {
            ...gameMap.player,
            cellX: newCellX,
            cellY: newCellY,
            x: newCellX * gameMap.tileSize + gameMap.tileSize / 2,
            y: newCellY * gameMap.tileSize + gameMap.tileSize / 2,
          },
        },
      };
    });
  }, [savePositionDebounced]);

  // 更新玩家位置
  const updatePlayerPosition = useCallback((x: number, y: number, cellX: number, cellY: number) => {
    setState((prev) => {
      if (!prev.gameMap) return prev;
      return {
        ...prev,
        gameMap: {
          ...prev.gameMap,
          player: { x, y, cellX, cellY },
        },
      };
    });
  }, []);

  // 开始战斗
  const startBattle = useCallback(async (monsterType: 'normal' | 'elite' | 'boss', monsterLevel: number, monsterCellX: number, monsterCellY: number) => {
    if (!state.userId) return;

    try {
      const data = await apiCall('/battle/start', {
        method: 'POST',
        body: JSON.stringify({
          userId: state.userId,
          monsterType,
          monsterLevel,
          monsterCellX,
          monsterCellY,
        }),
      });

      if (data.success) {
        const battle: BattleState = {
          isActive: true,
          battleId: data.data.battleId,
          currentRound: data.data.currentRound,
          playerRage: data.data.playerRage,
          monsterRage: 0,
          playerHp: data.data.playerHp,
          playerMaxHp: data.data.playerMaxHp,
          monsterName: data.data.monsterName,
          monsterHp: data.data.monsterHp,
          monsterMaxHp: data.data.monsterMaxHp,
          monsterLevel: data.data.monsterLevel,
          monsterType: data.data.monsterType,
          monsterCellX,
          monsterCellY,
          logs: [],
          skills: playerSkills,
        };

        setState((prev) => ({ ...prev, battle }));
        addLog(`⚔️ 遭遇 ${data.data.monsterName} Lv.${data.data.monsterLevel}!`, 'warning');
      }
    } catch (error) {
      addLog('战斗初始化失败', 'fail');
    }
  }, [state.userId, addLog]);

  // 普通攻击
  const playerAttack = useCallback(async () => {
    if (!state.battle?.battleId) return;

    try {
      const data = await apiCall('/battle/attack', {
        method: 'POST',
        body: JSON.stringify({ battleId: state.battle.battleId }),
      });

      if (data.success) {
        const logs = data.data.logs.map((log: { text: string; type: string }, i: number) => ({
          id: Date.now() + i,
          text: log.text,
          type: log.type,
        }));

        setState((prev) => {
          if (!prev.battle) return prev;

          const newBattle = {
            ...prev.battle,
            playerHp: data.data.playerHp,
            playerRage: data.data.playerRage,
            monsterHp: data.data.monsterHp,
            currentRound: data.data.currentRound,
            logs: [...prev.battle.logs, ...logs],
          };

          // 如果战斗胜利,设置掉落预览信息
          if (data.data.victory && data.data.dropInfo) {
            newBattle.dropInfo = {
              gold: data.data.dropInfo.gold,
              exp: data.data.dropInfo.exp,
              items: data.data.dropInfo.items,
            };
          }

          return { ...prev, battle: newBattle };
        });
      }
    } catch (error) {
      addLog('攻击失败', 'fail');
    }
  }, [state.battle, addLog]);

  // 使用技能
  const useSkill = useCallback(async (skillId: string) => {
    if (!state.battle?.battleId) return;

    // 治疗技能特殊处理
    if (skillId === 'heal') {
      try {
        const data = await apiCall('/battle/heal', {
          method: 'POST',
          body: JSON.stringify({ battleId: state.battle.battleId }),
        });

        if (data.success) {
          const logs = data.data.logs.map((log: { text: string; type: string }, i: number) => ({
            id: Date.now() + i,
            text: log.text,
            type: log.type,
          }));

          setState((prev) => {
            if (!prev.battle) return prev;
            return {
              ...prev,
              battle: {
                ...prev.battle,
                playerHp: data.data.playerHp,
                playerRage: data.data.playerRage,
                logs: [...prev.battle.logs, ...logs],
              },
            };
          });
        } else {
          addLog(data.message, 'warning');
        }
      } catch (error) {
        addLog('技能使用失败', 'fail');
      }
      return;
    }

    // 攻击技能
    try {
      const data = await apiCall('/battle/attack', {
        method: 'POST',
        body: JSON.stringify({ battleId: state.battle.battleId, skillId }),
      });

      if (data.success) {
        const logs = data.data.logs.map((log: { text: string; type: string }, i: number) => ({
          id: Date.now() + i,
          text: log.text,
          type: log.type,
        }));

        setState((prev) => {
          if (!prev.battle) return prev;

          const newBattle = {
            ...prev.battle,
            playerHp: data.data.playerHp,
            playerRage: data.data.playerRage,
            monsterHp: data.data.monsterHp,
            currentRound: data.data.currentRound,
            logs: [...prev.battle.logs, ...logs],
          };

          // 如果战斗胜利,设置掉落预览信息
          if (data.data.victory && data.data.dropInfo) {
            newBattle.dropInfo = {
              gold: data.data.dropInfo.gold,
              exp: data.data.dropInfo.exp,
              items: data.data.dropInfo.items,
            };
          }

          return { ...prev, battle: newBattle };
        });
      }
    } catch (error) {
      addLog('技能使用失败', 'fail');
    }
  }, [state.battle, addLog]);

  // 结束战斗
  const endBattle = useCallback(async (victory: boolean) => {
    if (!state.battle?.battleId) return;

    try {
      const data = await apiCall('/battle/end', {
        method: 'POST',
        body: JSON.stringify({
          battleId: state.battle.battleId,
          victory,
        }),
      });

      if (data.success) {
        const result = data.data;

        if (result.victory) {
          // 更新怪物击败状态（轻量级 API）
          updateEntityDefeated(result.monsterCellX, result.monsterCellY, true);
          // 保存玩家位置
          savePosition(result.monsterCellX, result.monsterCellY);

          // 更新玩家数据
          setState((prev) => {
            if (!prev.gameMap) return { ...prev, battle: null };

            // 标记怪物为已击败
            const updatedCells = prev.gameMap.cells.map((row) =>
              row.map((c) => {
                if (c.x === result.monsterCellX && c.y === result.monsterCellY && c.entity) {
                  return { ...c, entity: { ...c.entity, defeated: true } };
                }
                return c;
              })
            );

            // 更新统计
            const stats = prev.gameMap.stats;
            const monsterType = prev.battle?.monsterType;
            const newStats = {
              ...stats,
              monsters: {
                ...stats.monsters,
                defeated: monsterType === 'normal' ? stats.monsters.defeated + 1 : stats.monsters.defeated,
              },
              elites: {
                ...stats.elites,
                defeated: monsterType === 'elite' ? stats.elites.defeated + 1 : stats.elites.defeated,
              },
              bosses: {
                ...stats.bosses,
                defeated: monsterType === 'boss' ? stats.bosses.defeated + 1 : stats.bosses.defeated,
              },
            };

            return {
              ...prev,
              battle: null,
              level: result.userData.level,
              exp: result.userData.exp,
              gold: result.userData.gold,
              currentHp: result.userData.currentHp,
              maxHp: result.userData.maxHp,
              stats: result.userData.stats,
              inventory: result.userData.inventory,
              equippedItems: result.userData.equippedItems,
              gameMap: {
                ...prev.gameMap,
                cells: updatedCells,
                stats: newStats,
                player: {
                  ...prev.gameMap.player,
                  cellX: result.monsterCellX,
                  cellY: result.monsterCellY,
                  x: result.monsterCellX * prev.gameMap.tileSize + prev.gameMap.tileSize / 2,
                  y: result.monsterCellY * prev.gameMap.tileSize + prev.gameMap.tileSize / 2,
                },
              },
            };
          });

          // 显示升级信息
          if (result.levelUps && result.levelUps.length > 0) {
            result.levelUps.forEach((level: number) => {
              addLog(`🎉 升级到 ${level} 级!`, 'success');
            });
          }

          addLog(`获得 ${result.rewards.gold} 金币, ${result.rewards.exp} 经验, ${result.rewards.items.length} 件装备`, 'success');
        } else {
          // 战斗失败，回到中心点
          setState((prev) => {
            if (!prev.gameMap) return { ...prev, battle: null };

            const centerX = Math.floor(prev.gameMap.width / 2);
            const centerY = Math.floor(prev.gameMap.height / 2);

            // 保存玩家位置（回到中心点）
            savePosition(centerX, centerY);

            return {
              ...prev,
              battle: null,
              currentHp: result.userData.currentHp,
              gameMap: {
                ...prev.gameMap,
                player: {
                  ...prev.gameMap.player,
                  cellX: centerX,
                  cellY: centerY,
                  x: centerX * prev.gameMap.tileSize + prev.gameMap.tileSize / 2,
                  y: centerY * prev.gameMap.tileSize + prev.gameMap.tileSize / 2,
                },
              },
            };
          });

          addLog('💀 战斗失败，已回到出生点', 'fail');
        }
      }
    } catch (error) {
      addLog('结束战斗失败', 'fail');
      setState((prev) => ({ ...prev, battle: null }));
    }
  }, [state.battle, addLog, updateEntityDefeated, savePosition]);

  // 退出登录
  const logout = useCallback(() => {
    localStorage.removeItem('gameUsername');
    setState({
      isLoggedIn: false,
      userId: null,
      username: '',
      level: 1,
      exp: 0,
      gold: 100,
      currentHp: 200,
      maxHp: 200,
      stats: { atk: 50, def: 30, spd: 20, critRate: 0, critDmg: 0 },
      inventory: [],
      equippedItems: {
        weapon: null,
        helmet: null,
        chestplate: null,
        gloves: null,
        boots: null,
        accessory: null,
      },
      logs: [],
      gameMap: null,
      battle: null,
    });
  }, []);

  return {
    state,
    login,
    register,
    saveGame,
    healPlayer,
    equipItem,
    unequipItem,
    enhanceItem,
    deleteItem,
    addLog,
    generateWorldMap,
    resetWorldMap,
    movePlayer,
    updatePlayerPosition,
    startBattle,
    playerAttack,
    useSkill,
    endBattle,
    logout,
  };
}

// 命名导出
export { useGame };
