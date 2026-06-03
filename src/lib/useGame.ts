/**
 * 游戏状态管理 Hook - 前端只负责UI展示,所有逻辑在服务端执行
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { EquipmentSlot, Quality } from '@/types';
import type { MapCell } from '@/types/map';

// API 基础地址
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

// 品质名称映射
const QualityNames: Record<Quality, string> = {
  normal: '普通',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
  mythic: '神话',
};

// 世界广播消息
export interface BroadcastItem {
  name: string;
  quality: Quality;
}

export interface BroadcastMessage {
  id: number;
  username: string;
  message: string;
  type: 'enhance' | 'drop';
  timestamp: number;
  items?: BroadcastItem[];
}

// 游戏状态接口
export interface GameState {
  isLoggedIn: boolean;
  userId: number | null;
  username: string;
  nickname: string;
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
  autoBattle: AutoBattleState;
  broadcasts: BroadcastMessage[];
}

// 自动战斗状态
export interface AutoBattleState {
  enabled: boolean;
  skipFinalBoss: boolean;
  autoSellQualities: Quality[];
  minHpPercent: number;
  battleInterval: number;
  isRunning: boolean;
  stats: {
    battlesWon: number;
    goldEarned: number;
    expEarned: number;
    itemsDropped: number;
    autoSoldCount: number;
    autoSoldGold: number;
  };
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
  sellPrice?: number;  // 售卖价格（后端计算）
}

export interface LogEntry {
  id: number;
  text: string;
  type: 'info' | 'success' | 'warning' | 'fail';
  time: string;
}

// API 调用封装
async function apiCall(endpoint: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('gameToken') : null;
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
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
    nickname: '',
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
    autoBattle: {
      enabled: false,
      skipFinalBoss: false, // 默认不跳过最终Boss，打完Boss才停止
      autoSellQualities: ['normal', 'rare'],
      minHpPercent: 30,
      battleInterval: 500,
      isRunning: false,
      stats: {
        battlesWon: 0,
        goldEarned: 0,
        expEarned: 0,
        itemsDropped: 0,
        autoSoldCount: 0,
        autoSoldGold: 0,
      },
    },
    broadcasts: [],
  });

  const logIdRef = useRef(0);
  const broadcastIdRef = useRef(0);
  const initializingRef = useRef(false);
  const positionSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoBattleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoBattleRunningRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const wsReconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket 连接管理
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    // 确定 WebSocket 地址
    // 通过前端的代理服务器连接 WebSocket (端口 3000)
    let wsUrl: string;
    if (typeof window !== 'undefined') {
      const host = window.location.host; // 包含端口号
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      wsUrl = `${protocol}://${host}`;
    } else {
      wsUrl = 'ws://localhost:3000';
    }
    
    console.log('[WebSocket] 正在连接:', wsUrl);
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log('[WebSocket] 已连接到服务器');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // 处理广播消息
          if (data.type === 'broadcast') {
            const entry: BroadcastMessage = {
              id: ++broadcastIdRef.current,
              username: data.username,
              message: data.message,
              type: data.broadcastType,
              timestamp: data.timestamp,
              items: data.items,
            };
            setState((prev) => ({
              ...prev,
              broadcasts: [entry, ...prev.broadcasts.slice(0, 9)],
            }));
          }
        } catch (err) {
          // 忽略无效消息
        }
      };
      
      ws.onclose = () => {
        console.log('[WebSocket] 连接关闭，准备重连...');
        wsRef.current = null;
        // 5秒后重连
        wsReconnectTimerRef.current = setTimeout(connectWebSocket, 5000);
      };
      
      ws.onerror = (err) => {
        console.error('[WebSocket] 连接错误:', err);
      };
      
    } catch (err) {
      console.error('[WebSocket] 创建连接失败:', err);
      // 5秒后重试
      wsReconnectTimerRef.current = setTimeout(connectWebSocket, 5000);
    }
  }, []);

  // 登录成功后连接 WebSocket
  useEffect(() => {
    if (state.isLoggedIn) {
      connectWebSocket();
    }
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (wsReconnectTimerRef.current) {
        clearTimeout(wsReconnectTimerRef.current);
        wsReconnectTimerRef.current = null;
      }
    };
  }, [state.isLoggedIn, connectWebSocket]);

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

  // 强化成功广播文案（达到12级及以上）
  // 自动登录（使用token验证）
  useEffect(() => {
    // 只在客户端执行
    if (typeof window === 'undefined') return;
    
    // 防止重复执行
    if (initializingRef.current) return;
    initializingRef.current = true;

    const savedToken = localStorage.getItem('gameToken');
    if (savedToken) {
      // 使用 token 验证登录状态
      apiCall('/auth/verify', { method: 'GET' })
        .then((data) => {
          if (data.success) {
            const userData = data.data;
            setState((prev) => ({
              ...prev,
              isLoggedIn: true,
              userId: userData.id,
              username: userData.username,
              nickname: userData.nickname || userData.username,
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
              gameMap: userData.gameMap || null,
            }));
            // 如果没有地图数据，生成新地图
            if (!userData.gameMap) {
              generateWorldMap(userData.id, userData.level);
            } else {
              // 连接 WebSocket
              connectWebSocket();
            }
            addLog(`欢迎回来，${userData.nickname || userData.username}!`, 'success');
          } else {
            // Token 无效，清除本地存储
            localStorage.removeItem('gameToken');
            localStorage.removeItem('gameUsername');
          }
        })
        .catch(() => {
          localStorage.removeItem('gameToken');
          localStorage.removeItem('gameUsername');
        });
    }
  }, []);

  // 清理位置保存定时器和自动战斗定时器
  useEffect(() => {
    return () => {
      if (positionSaveTimerRef.current) {
        clearTimeout(positionSaveTimerRef.current);
      }
      if (autoBattleTimerRef.current) {
        clearTimeout(autoBattleTimerRef.current);
      }
    };
  }, []);


  // 登录
  const login = useCallback(async (username: string, password: string) => {
    try {
      const data = await apiCall('/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      if (data.success) {
        const userData = data.data;

        // 存储 token 和用户信息
        if (userData.token) {
          localStorage.setItem('gameToken', userData.token);
        }
        localStorage.setItem('gameUsername', username);

        setState((prev) => ({
          ...prev,
          isLoggedIn: true,
          userId: userData.id,
          username: userData.username,
          nickname: userData.nickname || userData.username,
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
          gameMap: userData.gameMap || null,
        }));

        // 如果没有地图数据，生成新地图
        if (!userData.gameMap) {
          generateWorldMap(userData.id, userData.level);
        }

        addLog(`欢迎 ${userData.nickname || userData.username}!`, 'success');
        return { success: true };
      }

      return { success: false, message: data.message };
    } catch (error) {
      return { success: false, message: '网络错误' };
    }
  }, [addLog]);

  // 注册
  const register = useCallback(async (username: string, password: string, nickname?: string) => {
    try {
      const data = await apiCall('/register', {
        method: 'POST',
        body: JSON.stringify({ username, password, nickname }),
      });

      if (data.success) {
        const userData = data.data;

        // 存储 token
        if (userData.token) {
          localStorage.setItem('gameToken', userData.token);
        }
        localStorage.setItem('gameUsername', username);

        setState((prev) => ({
          ...prev,
          isLoggedIn: true,
          userId: userData.id,
          username: userData.username,
          nickname: userData.nickname || userData.username,
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

        // 生成地图
        generateWorldMap(userData.id, userData.level);

        addLog(`注册成功! 欢迎 ${userData.nickname || userData.username}!`, 'success');
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
          gold: data.data.gold,
        }));
        addLog(`💚 生命已恢复，消耗 ${data.data.goldCost} 金币`, 'success');
      } else {
        addLog(data.message || '恢复失败', 'warning');
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
        // 装备损坏,从列表移除,扣除金币
        setState((prev) => ({
          ...prev,
          gold: data.gold ?? prev.gold,
          inventory: prev.inventory.filter((i) => i.id !== item.id),
          equippedItems: {
            ...prev.equippedItems,
            [item.slot]: prev.equippedItems[item.slot]?.id === item.id ? null : prev.equippedItems[item.slot],
          },
        }));
        addLog(data.message + `(消耗 ${data.cost} 金币)`, 'fail');
      } else if (data.success) {
        const newLevel = data.data.level;
        const equipName = item.name || `${QualityNames[item.quality]}${item.slot}`;
        
        // 强化成功,更新装备和金币
        setState((prev) => ({
          ...prev,
          gold: data.gold ?? prev.gold,
          inventory: prev.inventory.map((i) =>
            i.id === item.id
              ? { ...i, level: newLevel, mainAffix: data.data.mainAffix, subAffixes: data.data.subAffixes, sellPrice: data.data.sellPrice }
              : i
          ),
          equippedItems: {
            ...prev.equippedItems,
            [item.slot]:
              prev.equippedItems[item.slot]?.id === item.id
                ? { ...prev.equippedItems[item.slot]!, level: newLevel, mainAffix: data.data.mainAffix, subAffixes: data.data.subAffixes, sellPrice: data.data.sellPrice }
                : prev.equippedItems[item.slot],
          },
        }));
        addLog(data.message + `(消耗 ${data.cost} 金币)`, 'success');
      } else {
        addLog(data.message, 'warning');
      }
    } catch (error) {
      addLog('强化失败', 'fail');
    }
  }, [state.userId, state.username, addLog]);

  // 删除装备
  // 售卖装备
  const sellItem = useCallback(async (item: EquipmentItem) => {
    if (!state.userId) return;

    try {
      const data = await apiCall('/equipment/sell', {
        method: 'POST',
        body: JSON.stringify({ userId: state.userId, equipmentId: item.id }),
      });

      if (data.success) {
        setState((prev) => ({
          ...prev,
          gold: data.data.gold,
          inventory: prev.inventory.filter((i) => i.id !== item.id),
        }));
        addLog(`💰 售卖装备获得 ${data.data.sellPrice} 金币`, 'success');
      } else {
        addLog(data.message || '售卖失败', 'warning');
      }
    } catch (error) {
      addLog('售卖失败', 'fail');
    }
  }, [state.userId, addLog]);

  // 批量售卖装备（按稀有度）
  const sellBatch = useCallback(async (quality: Quality) => {
    if (!state.userId) return;

    try {
      const data = await apiCall('/equipment/sell-batch', {
        method: 'POST',
        body: JSON.stringify({ userId: state.userId, quality }),
      });

      if (data.success) {
        setState((prev) => {
          // 过滤掉已售卖的装备
          const newInventory = prev.inventory.filter(
            (item) => item.quality !== quality
          );
          return {
            ...prev,
            gold: data.data.gold,
            inventory: newInventory,
          };
        });
        addLog(`💰 批量售卖 ${data.data.count} 件${QualityNames[quality]}装备，获得 ${data.data.totalSellPrice} 金币`, 'success');
      } else {
        addLog(data.message || '批量售卖失败', 'warning');
      }
    } catch (error) {
      addLog('批量售卖失败', 'fail');
    }
  }, [state.userId, addLog]);

  // 获取批量售卖预估价格
  const getSellBatchPreview = useCallback(async (quality: Quality): Promise<{ count: number; totalSellPrice: number } | null> => {
    if (!state.userId) return null;

    try {
      const data = await apiCall('/equipment/sell-batch-preview', {
        method: 'POST',
        body: JSON.stringify({ userId: state.userId, quality }),
      });

      if (data.success) {
        return {
          count: data.data.count,
          totalSellPrice: data.data.totalSellPrice,
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }, [state.userId]);

  // 删除装备（保留兼容）
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
    if (!state.userId) return null;

    try {
      const data = await apiCall('/worldmap/entity', {
        method: 'POST',
        body: JSON.stringify({ userId: state.userId, cellX, cellY, defeated }),
      });
      return data;
    } catch (error) {
      console.error('更新怪物状态失败:', error);
      return null;
    }
  }, [state.userId]);

  // 加载或生成地图（登录时调用）
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
        addLog(`🗺️ 进入 ${data.mapInfo?.name || '新地图'}`, 'success');
      } else if (data.message?.includes('用户不存在')) {
        // 用户不存在，清除登录状态
        addLog('⚠️ 用户信息已过期，请重新登录', 'warning');
        localStorage.removeItem('gameUsername');
        setState((prev) => ({ ...prev, isLoggedIn: false, userId: null }));
        return;
      }
    } else {
      addLog('🗺️ 地图数据已加载', 'success');
    }

    setState((prev) => ({ ...prev, gameMap }));
  }, [state.level, state.userId, loadWorldMap, addLog]);

  // 进入下一张地图（通关后调用）
  const enterNextMap = useCallback(async () => {
    if (!state.userId) return;

    const currentMapId = state.gameMap?.mapId || 1;
    const nextMapId = currentMapId + 1;

    const data = await apiCall('/worldmap/generate', {
      method: 'POST',
      body: JSON.stringify({ userId: state.userId, level: state.level, mapId: nextMapId }),
    });

    if (data.success && data.data) {
      setState((prev) => ({ ...prev, gameMap: data.data }));
      addLog(`🎉 进入新地图: ${data.mapInfo?.name}`, 'success');
    }
  }, [state.userId, state.level, state.gameMap?.mapId, addLog]);

  // 重新开始当前地图
  const restartCurrentMap = useCallback(async () => {
    if (!state.userId) return;

    const data = await apiCall('/worldmap/restart', {
      method: 'POST',
      body: JSON.stringify({ userId: state.userId }),
    });

    if (data.success && data.data) {
      setState((prev) => ({ ...prev, gameMap: data.data }));
      addLog(`🔄 重新开始地图: ${data.mapInfo?.name}`, 'warning');
    }
  }, [state.userId, addLog]);

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
          // 更新怪物击败状态(轻量级 API)
          const entityData = await updateEntityDefeated(result.monsterCellX, result.monsterCellY, true);
          // 保存玩家位置
          savePosition(result.monsterCellX, result.monsterCellY);

          // 检查是否通关了地图
          if (entityData?.mapCleared) {
            addLog(`🎉 通关了地图！`, 'success');
            if (entityData?.nextMap && !entityData?.isLastMap) {
              addLog(`可以进入下一张地图: ${entityData.nextMap.name}`, 'info');
              // 自动进入下一张地图
              setTimeout(() => enterNextMap(), 2000);
            } else {
              addLog('🏆 你已完成所有地图！', 'success');
            }
          }
          
          // 检查是否召唤了最终Boss
          if (entityData?.finalBossSpawned) {
            addLog(`🔥 ${entityData.finalBoss?.name} 已在地图中心召唤！`, 'warning');
          }

          // 更新玩家数据
          setState((prev) => {
            if (!prev.gameMap) return { ...prev, battle: null };

            // 标记怪物为已击败（处理多格子实体）
            const defeatedEntity = prev.gameMap.cells[result.monsterCellY]?.[result.monsterCellX]?.entity;
            const entitySize = defeatedEntity?.size || 1;
            const idParts = defeatedEntity?.id?.split('_') || [];
            
            // 根据实体类型解析起始坐标
            let startX: number, startY: number;
            if (defeatedEntity?.isMiniBoss) {
              // 小Boss格式: miniboss_${index}_${x}_${y}
              startX = parseInt(idParts[2]) || result.monsterCellX;
              startY = parseInt(idParts[3]) || result.monsterCellY;
            } else if (defeatedEntity?.isFinalBoss) {
              // 最终Boss格式: finalboss_${x}_${y}_${name}
              startX = parseInt(idParts[1]) || result.monsterCellX;
              startY = parseInt(idParts[2]) || result.monsterCellY;
            } else {
              // 普通怪物格式: ${type}_${x}_${y}_${timestamp}_${random}
              startX = parseInt(idParts[1]) || result.monsterCellX;
              startY = parseInt(idParts[2]) || result.monsterCellY;
            }
            
            const updatedCells = prev.gameMap.cells.map((row, rowIdx) =>
              row.map((c, colIdx): MapCell => {
                // 检查是否在实体范围内
                const dx = colIdx - startX;
                const dy = rowIdx - startY;
                if (dx >= 0 && dx < entitySize && dy >= 0 && dy < entitySize && 
                    c.entity?.id === defeatedEntity?.id) {
                  return { ...c, entity: { ...c.entity!, defeated: true }, walkable: true };
                }
                return c;
              })
            );

            // 更新统计和小Boss进度
            const stats = prev.gameMap.stats;
            const monsterType = prev.battle?.monsterType;
            const isMiniBoss = defeatedEntity?.isMiniBoss;
            const newMiniBossesDefeated = isMiniBoss ? (prev.gameMap.miniBossesDefeated || 0) + 1 : (prev.gameMap.miniBossesDefeated || 0);
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
              miniBosses: {
                total: prev.gameMap.totalMiniBosses || 0,
                defeated: newMiniBossesDefeated,
              },
            };

            // 如果最终Boss被召唤,需要在cells中添加Boss实体
          let finalCells = updatedCells;
          if (entityData?.finalBossSpawned && entityData?.finalBoss) {
            const bossX = entityData.finalBoss.x - 1; // 中心点向左偏移
            const bossY = entityData.finalBoss.y - 1; // 中心点向上偏移
            const bossSize = 3;
            const bossEntity = {
              id: `finalboss_${bossX}_${bossY}_${entityData.finalBoss.name}`,
              type: 'boss' as const,
              level: entityData.finalBoss.level,
              name: entityData.finalBoss.name,
              size: bossSize,
              isFinalBoss: true,
            };
            
            finalCells = updatedCells.map((row, rowIdx) =>
              row.map((c, colIdx): MapCell => {
                const dx = colIdx - bossX;
                const dy = rowIdx - bossY;
                if (dx >= 0 && dx < bossSize && dy >= 0 && dy < bossSize) {
                  return { ...c, entity: bossEntity, walkable: false };
                }
                return c;
              })
            );
          }
          
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
                cells: finalCells,
                stats: newStats,
                miniBossesDefeated: newMiniBossesDefeated,
                finalBossSpawned: entityData?.finalBossSpawned || prev.gameMap.finalBossSpawned,
                player: entityData?.finalBossSpawned ? {
                  ...prev.gameMap.player,
                  // 传送到最终Boss左侧的安全位置
                  cellX: Math.max(5, (entityData.finalBoss?.x || Math.floor(prev.gameMap.width / 2)) - 6),
                  cellY: entityData.finalBoss?.y || Math.floor(prev.gameMap.height / 2),
                  x: Math.max(5, (entityData.finalBoss?.x || Math.floor(prev.gameMap.width / 2)) - 6) * prev.gameMap.tileSize + prev.gameMap.tileSize / 2,
                  y: (entityData.finalBoss?.y || Math.floor(prev.gameMap.height / 2)) * prev.gameMap.tileSize + prev.gameMap.tileSize / 2,
                } : {
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
          // 战斗失败,回到安全位置（地图左上角区域）
          setState((prev) => {
            if (!prev.gameMap) return { ...prev, battle: null };

            // 找到一个安全的出生点（地图左上角，远离Boss）
            const safeX = 10;
            const safeY = 10;

            // 保存玩家位置
            savePosition(safeX, safeY);

            return {
              ...prev,
              battle: null,
              currentHp: result.userData.currentHp,
              gameMap: {
                ...prev.gameMap,
                player: {
                  ...prev.gameMap.player,
                  cellX: safeX,
                  cellY: safeY,
                  x: safeX * prev.gameMap.tileSize + prev.gameMap.tileSize / 2,
                  y: safeY * prev.gameMap.tileSize + prev.gameMap.tileSize / 2,
                },
              },
            };
          });

          addLog(`💀 战斗失败，血量恢复到 ${result.userData.currentHp}`, 'fail');
        }
      }
    } catch (error) {
      addLog('结束战斗失败', 'fail');
      setState((prev) => ({ ...prev, battle: null }));
    }
  }, [state.battle, addLog, updateEntityDefeated, savePosition, enterNextMap]);

  // 打开宝箱
  const openChest = useCallback(async (cellX: number, cellY: number) => {
    if (!state.userId) return;

    try {
      const data = await apiCall('/chest/open', {
        method: 'POST',
        body: JSON.stringify({
          userId: state.userId,
          cellX,
          cellY,
        }),
      });

      if (data.success) {
        const result = data.data;
        
        // 更新玩家数据
        setState((prev) => {
          if (!prev.gameMap) return prev;
          
          // 标记宝箱为已打开
          const updatedCells = prev.gameMap.cells.map((row, rowIdx) =>
            row.map((c, colIdx): MapCell => {
              if (colIdx === cellX && rowIdx === cellY && c.entity?.type === 'chest') {
                return { ...c, entity: { ...c.entity!, defeated: true }, walkable: true };
              }
              return c;
            })
          );
          
          return {
            ...prev,
            level: result.userData.level,
            exp: result.userData.exp,
            gold: result.userData.gold,
            stats: result.userData.stats,
            maxHp: result.userData.maxHp,
            inventory: result.userData.inventory,
            equippedItems: result.userData.equippedItems,
            gameMap: {
              ...prev.gameMap,
              cells: updatedCells,
            },
          };
        });
        
        // 显示奖励
        if (result.levelUps && result.levelUps.length > 0) {
          result.levelUps.forEach((level: number) => {
            addLog(`🎉 升级到 ${level} 级!`, 'success');
          });
        }
        
        addLog(`📦 打开宝箱获得 ${result.rewards.gold} 💰, ${result.rewards.exp} ✨`, 'success');
        
        // 显示每件装备的详细信息
        if (result.rewards.items && result.rewards.items.length > 0) {
          result.rewards.items.forEach((item: { name?: string; quality: string; slot: string }) => {
            const qualityEmoji: Record<string, string> = {
              normal: '⚪',
              rare: '🔵',
              epic: '🟣',
              legendary: '🟡',
              mythic: '🔴',
            };
            const slotNames: Record<string, string> = {
              weapon: '武器',
              helmet: '头盔',
              chestplate: '胸甲',
              gloves: '手套',
              boots: '鞋子',
              accessory: '首饰',
            };
            const emoji = qualityEmoji[item.quality] || '⚪';
            const slotName = slotNames[item.slot] || item.slot;
            addLog(`${emoji} 获得装备: ${item.name || slotName}`, 'success');
          });
        }
      } else {
        addLog(data.message || '打开宝箱失败', 'warning');
      }
    } catch (error) {
      addLog('打开宝箱失败', 'fail');
    }
  }, [state.userId, addLog]);

  // 退出登录
  const logout = useCallback(() => {
    localStorage.removeItem('gameUsername');
    localStorage.removeItem('gameToken');
    // 停止自动战斗
    autoBattleRunningRef.current = false;
    if (autoBattleTimerRef.current) {
      clearTimeout(autoBattleTimerRef.current);
    }
    setState({
      isLoggedIn: false,
      userId: null,
      username: '',
      nickname: '',
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
      autoBattle: {
        enabled: false,
        skipFinalBoss: false, // 默认不跳过最终Boss
        autoSellQualities: ['normal', 'rare'],
        minHpPercent: 30,
        battleInterval: 500,
        isRunning: false,
        stats: {
          battlesWon: 0,
          goldEarned: 0,
          expEarned: 0,
          itemsDropped: 0,
          autoSoldCount: 0,
          autoSoldGold: 0,
        },
      },
      broadcasts: [],
    });
  }, []);

  // ==================== 自动战斗相关方法 ====================

  // 加载自动战斗配置
  const loadAutoBattleConfig = useCallback(async () => {
    if (!state.userId) return;
    
    try {
      const data = await apiCall(`/auto-battle/config/${state.userId}`);
      if (data.success) {
        setState(prev => ({
          ...prev,
          autoBattle: {
            ...prev.autoBattle,
            ...data.data,
            isRunning: prev.autoBattle.isRunning, // 保持当前运行状态
          },
        }));
      }
    } catch (error) {
      console.error('加载自动战斗配置失败:', error);
    }
  }, [state.userId]);

  // 设置自动战斗配置
  const setAutoBattleConfig = useCallback(async (config: Partial<AutoBattleState>) => {
    if (!state.userId) return;
    
    try {
      const data = await apiCall('/auto-battle/config', {
        method: 'POST',
        body: JSON.stringify({ userId: state.userId, config }),
      });
      
      if (data.success) {
        setState(prev => ({
          ...prev,
          autoBattle: {
            ...prev.autoBattle,
            ...data.data,
          },
        }));
      }
    } catch (error) {
      console.error('设置自动战斗配置失败:', error);
    }
  }, [state.userId]);

  // 执行一次自动战斗
  const executeAutoBattle = useCallback(async (): Promise<{ success: boolean; message?: string; data?: any; mapCleared?: boolean; battleFailed?: boolean }> => {
    if (!state.userId) return { success: false, message: '未登录' };
    
    try {
      const data = await apiCall('/auto-battle/execute', {
        method: 'POST',
        body: JSON.stringify({ userId: state.userId }),
      });
      
      if (data.success && data.data) {
        const result = data.data;
        
        if (result.victory) {
          // 更新状态
          setState(prev => {
            if (!prev.gameMap) return prev;
            
            const entity = result.entity;
            const entitySize = entity?.size || 1;
            const idParts = entity?.id?.split('_') || [];
            
            let startX: number, startY: number;
            if (entity?.isMiniBoss) {
              startX = parseInt(idParts[2]) || result.cellX;
              startY = parseInt(idParts[3]) || result.cellY;
            } else if (entity?.isFinalBoss) {
              startX = parseInt(idParts[1]) || result.cellX;
              startY = parseInt(idParts[2]) || result.cellY;
            } else {
              startX = parseInt(idParts[1]) || result.cellX;
              startY = parseInt(idParts[2]) || result.cellY;
            }
            
            const updatedCells = prev.gameMap.cells.map((row, rowIdx) =>
              row.map((c, colIdx): import('@/types/map').MapCell => {
                const dx = colIdx - startX;
                const dy = rowIdx - startY;
                if (dx >= 0 && dx < entitySize && dy >= 0 && dy < entitySize && 
                    c.entity?.id === entity?.id) {
                  return { ...c, entity: { ...c.entity!, defeated: true }, walkable: true };
                }
                return c;
              })
            );
            
            const newMiniBossesDefeated = entity?.isMiniBoss 
              ? (prev.gameMap.miniBossesDefeated || 0) + 1 
              : (prev.gameMap.miniBossesDefeated || 0);
            
            // 如果最终Boss被召唤,需要在cells中添加Boss实体
            let finalCells = updatedCells;
            if (result.finalBossSpawned && result.finalBossName) {
              const bossX = Math.floor(prev.gameMap.width / 2) - 1; // 中心点向左偏移
              const bossY = Math.floor(prev.gameMap.height / 2) - 1; // 中心点向上偏移
              const bossSize = 3;
              const bossEntity = {
                id: `finalboss_${bossX}_${bossY}_${result.finalBossName}`,
                type: 'boss' as const,
                level: prev.gameMap.finalBoss?.level || 25,
                name: result.finalBossName,
                size: bossSize,
                isFinalBoss: true,
              };
              
              finalCells = updatedCells.map((row, rowIdx) =>
                row.map((c, colIdx): import('@/types/map').MapCell => {
                  const dx = colIdx - bossX;
                  const dy = rowIdx - bossY;
                  if (dx >= 0 && dx < bossSize && dy >= 0 && dy < bossSize) {
                    return { ...c, entity: bossEntity, walkable: false };
                  }
                  return c;
                })
              );
            }
            
            return {
              ...prev,
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
                cells: finalCells,
                miniBossesDefeated: newMiniBossesDefeated,
                finalBossSpawned: result.finalBossSpawned || prev.gameMap.finalBossSpawned,
                player: {
                  ...prev.gameMap.player,
                  cellX: result.playerPosition?.cellX || prev.gameMap.player.cellX,
                  cellY: result.playerPosition?.cellY || prev.gameMap.player.cellY,
                  x: (result.playerPosition?.cellX || prev.gameMap.player.cellX) * prev.gameMap.tileSize + prev.gameMap.tileSize / 2,
                  y: (result.playerPosition?.cellY || prev.gameMap.player.cellY) * prev.gameMap.tileSize + prev.gameMap.tileSize / 2,
                },
              },
              autoBattle: {
                ...prev.autoBattle,
                stats: {
                  battlesWon: prev.autoBattle.stats.battlesWon + 1,
                  goldEarned: prev.autoBattle.stats.goldEarned + (result.rewards?.gold || 0) + (result.autoSold?.totalPrice || 0),
                  expEarned: prev.autoBattle.stats.expEarned + (result.rewards?.exp || 0),
                  itemsDropped: prev.autoBattle.stats.itemsDropped + (result.rewards?.items || 0),
                  autoSoldCount: prev.autoBattle.stats.autoSoldCount + (result.autoSold?.count || 0),
                  autoSoldGold: prev.autoBattle.stats.autoSoldGold + (result.autoSold?.totalPrice || 0),
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
          
          addLog(`⚔️ 自动击败 ${result.entity?.name}，获得 ${result.rewards?.gold}💰 ${result.rewards?.exp}✨`, 'success');
          
          if (result.autoSold?.count > 0) {
            addLog(`💰 自动售出 ${result.autoSold.count} 件装备，获得 ${result.autoSold.totalPrice} 金币`, 'info');
          }
          
          if (result.finalBossSpawned) {
            addLog(`🔥 ${result.finalBossName} 已在地图中心召唤!`, 'warning');
          }
          
          // 如果击败了最终Boss，地图通关
          if (result.finalBossDefeated || result.mapCleared) {
            addLog(`🏆 击败了最终Boss! 地图通关!`, 'success');
            return { success: true, data: result, mapCleared: true };
          }
          
          return { success: true, data: result };
        } else {
          // 战斗失败
          setState(prev => ({
            ...prev,
            currentHp: result.userData?.currentHp || prev.currentHp,
            autoBattle: {
              ...prev.autoBattle,
              isRunning: false,
            },
          }));
          
          // 详细的失败提示
          const entity = result.entity;
          const suggestion = result.suggestion;
          const monsterStats = result.monsterStats;
          const playerStats = result.playerStats;
          
          const monsterInfo = entity ? `${entity.name}(Lv.${entity.level})` : '怪物';
          addLog(`💀 自动战斗失败！被 ${monsterInfo} 击败`, 'fail');
          
          // 显示属性对比
          if (monsterStats && playerStats) {
            addLog(`📊 你: ATK=${playerStats.atk} DEF=${playerStats.def} HP=${playerStats.maxHp}`, 'info');
            addLog(`📊 敌: ATK=${monsterStats.atk} DEF=${monsterStats.def} HP=${monsterStats.maxHp}`, 'info');
          }
          
          // 显示建议
          if (suggestion) {
            addLog(`💡 ${suggestion.message}`, 'warning');
            if (suggestion.needAtk) {
              addLog(`💡 建议攻击力: ${suggestion.needAtk}+ (当前${playerStats?.atk || '?'})`, 'info');
            }
            if (suggestion.needDef) {
              addLog(`💡 建议防御力: ${suggestion.needDef}+ (当前${playerStats?.def || '?'})`, 'info');
            }
          } else {
            addLog(`💡 建议提升装备强化等级或获取更好品质的装备后重试`, 'warning');
          }
          
          return { success: false, message: '战斗失败，需要提升实力', data: result, battleFailed: true };
        }
      }
      
      return { success: false, message: data.message, data };
    } catch (error) {
      console.error('自动战斗执行失败:', error);
      return { success: false, message: '网络错误' };
    }
  }, [state.userId, addLog]);

  // 开始自动战斗循环
  const startAutoBattle = useCallback(async () => {
    if (!state.userId || autoBattleRunningRef.current) return;
    
    // 设置运行标志
    autoBattleRunningRef.current = true;
    
    // 更新配置
    await setAutoBattleConfig({ enabled: true });
    
    setState(prev => ({
      ...prev,
      autoBattle: {
        ...prev.autoBattle,
        isRunning: true,
        enabled: true,
      },
    }));
    
    addLog('🤖 开始自动战斗', 'info');
    
    // 定义循环执行函数
    const runAutoBattle = async () => {
      if (!autoBattleRunningRef.current) return;
      
      const result = await executeAutoBattle();
      
      if (result.success) {
        // 检查是否击败了最终Boss
        if (result.mapCleared || result.data?.finalBossDefeated) {
          autoBattleRunningRef.current = false;
          addLog(`🏆 地图已完全清理，最终Boss已被击败!`, 'success');
          setState(prev => ({
            ...prev,
            autoBattle: { ...prev.autoBattle, isRunning: false },
          }));
          return;
        }
        // 继续下一次
        autoBattleTimerRef.current = setTimeout(runAutoBattle, state.autoBattle.battleInterval);
      } else if (result.battleFailed) {
        // 战斗失败，需要提升实力
        autoBattleRunningRef.current = false;
        addLog(`⏹️ 自动战斗已停止，请提升实力后重试`, 'warning');
        setState(prev => ({
          ...prev,
          autoBattle: { ...prev.autoBattle, isRunning: false },
        }));
      } else if (result.data?.needHeal) {
        // 血量不足，暂停
        autoBattleRunningRef.current = false;
        addLog(`⚠️ 血量不足，自动战斗暂停`, 'warning');
        setState(prev => ({
          ...prev,
          autoBattle: { ...prev.autoBattle, isRunning: false },
        }));
      } else if (result.data?.mapCleared || result.data?.finalBossDefeated) {
        // 地图已完全清理
        autoBattleRunningRef.current = false;
        addLog(`🏆 地图已完全清理，最终Boss已被击败!`, 'success');
        setState(prev => ({
          ...prev,
          autoBattle: { ...prev.autoBattle, isRunning: false },
        }));
      } else if (result.data?.mapExplored) {
        // 地图探索完毕
        autoBattleRunningRef.current = false;
        addLog(`🎉 地图探索完毕!`, 'success');
        setState(prev => ({
          ...prev,
          autoBattle: { ...prev.autoBattle, isRunning: false },
        }));
      } else {
        // 其他错误，暂停
        autoBattleRunningRef.current = false;
        setState(prev => ({
          ...prev,
          autoBattle: { ...prev.autoBattle, isRunning: false },
        }));
      }
    };
    
    // 立即执行第一次
    const result = await executeAutoBattle();
    
    if (result.success) {
      // 检查是否击败了最终Boss
      if (result.mapCleared || result.data?.finalBossDefeated) {
        autoBattleRunningRef.current = false;
        addLog(`🏆 地图已完全清理，最终Boss已被击败!`, 'success');
        setState(prev => ({
          ...prev,
          autoBattle: { ...prev.autoBattle, isRunning: false },
        }));
        return;
      }
      autoBattleTimerRef.current = setTimeout(runAutoBattle, state.autoBattle.battleInterval);
    } else if (result.battleFailed) {
      // 战斗失败，需要提升实力
      autoBattleRunningRef.current = false;
      addLog(`⏹️ 自动战斗已停止，请提升实力后重试`, 'warning');
      setState(prev => ({
        ...prev,
        autoBattle: { ...prev.autoBattle, isRunning: false },
      }));
    } else if (result.data?.needHeal) {
      autoBattleRunningRef.current = false;
      addLog(`⚠️ 血量不足，自动战斗暂停`, 'warning');
      setState(prev => ({
        ...prev,
        autoBattle: { ...prev.autoBattle, isRunning: false },
      }));
    } else if (result.data?.mapCleared || result.data?.finalBossDefeated) {
      autoBattleRunningRef.current = false;
      addLog(`🏆 地图已完全清理，最终Boss已被击败!`, 'success');
      setState(prev => ({
        ...prev,
        autoBattle: { ...prev.autoBattle, isRunning: false },
      }));
    } else if (result.data?.mapExplored) {
      autoBattleRunningRef.current = false;
      addLog(`🎉 地图探索完毕!`, 'success');
      setState(prev => ({
        ...prev,
        autoBattle: { ...prev.autoBattle, isRunning: false },
      }));
    } else {
      autoBattleRunningRef.current = false;
      setState(prev => ({
        ...prev,
        autoBattle: { ...prev.autoBattle, isRunning: false },
      }));
    }
  }, [state.userId, state.autoBattle.battleInterval, executeAutoBattle, setAutoBattleConfig, addLog]);

  // 停止自动战斗
  const stopAutoBattle = useCallback(async () => {
    autoBattleRunningRef.current = false;
    
    if (autoBattleTimerRef.current) {
      clearTimeout(autoBattleTimerRef.current);
      autoBattleTimerRef.current = null;
    }
    
    await setAutoBattleConfig({ enabled: false });
    
    setState(prev => ({
      ...prev,
      autoBattle: {
        ...prev.autoBattle,
        isRunning: false,
        enabled: false,
      },
    }));
    
    addLog('⏹️ 停止自动战斗', 'info');
  }, [setAutoBattleConfig, addLog]);

  // 重置自动战斗统计
  const resetAutoBattleStats = useCallback(() => {
    setState(prev => ({
      ...prev,
      autoBattle: {
        ...prev.autoBattle,
        stats: {
          battlesWon: 0,
          goldEarned: 0,
          expEarned: 0,
          itemsDropped: 0,
          autoSoldCount: 0,
          autoSoldGold: 0,
        },
      },
    }));
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
    sellItem,
    sellBatch,
    getSellBatchPreview,
    deleteItem,
    addLog,
    generateWorldMap,
    enterNextMap,
    restartCurrentMap,
    movePlayer,
    updatePlayerPosition,
    startBattle,
    playerAttack,
    useSkill,
    endBattle,
    openChest,
    logout,
    // 自动战斗
    loadAutoBattleConfig,
    setAutoBattleConfig,
    startAutoBattle,
    stopAutoBattle,
    executeAutoBattle,
    resetAutoBattleStats,
  };
}

// 命名导出
export { useGame };
