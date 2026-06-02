/**
 * Express 服务器 - 使用 MySQL + Redis
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

// 配置
const config = {
  // 数据库配置
  dbType: process.env.DB_TYPE || 'mysql',
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'game',
    password: process.env.MYSQL_PASSWORD || 'game123456',
    database: process.env.MYSQL_DATABASE || 'game',
    connectionLimit: 10,
  },
  // Redis 配置
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || '',
  },
  // 服务器配置
  port: parseInt(process.env.PORT || '3001'),
};

// 导入游戏逻辑和服务
const GameLogic = require('./gameLogic');
const { createDatabase } = require('./database-mysql');
const { createCache } = require('./cache-redis');

// 初始化
const app = express();
let db, cache;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));  // 增大限制以支持大地图数据
app.use(express.static(path.join(__dirname, '..', 'public')));

// ==================== 数据库和缓存初始化 ====================

async function initialize() {
  console.log('========================================');
  console.log('  初始化数据库和缓存...');
  console.log('========================================');

  // 初始化数据库
  db = createDatabase(config.mysql);
  await db.initTables();
  console.log(`[DB] ${config.dbType.toUpperCase()} 连接成功`);

  // 初始化缓存
  cache = createCache(config.redis);
  console.log('[Cache] Redis 连接成功');

  console.log('========================================');
  console.log(`  服务器启动: http://localhost:${config.port}`);
  console.log('========================================');
}

// ==================== 辅助函数 ====================

async function validateUser(userId) {
  if (!userId) return null;
  return db.findUserById(userId);
}

async function validateEquipmentOwnership(userId, equipmentId) {
  const equipment = await db.getEquipmentById(equipmentId);
  if (!equipment) return { valid: false, error: '装备不存在' };
  if (equipment.user_id !== userId) return { valid: false, error: '无权操作此装备' };
  return { valid: true, equipment };
}

async function getUserFullData(userId) {
  const user = await db.findUserById(userId);
  if (!user) return null;

  const equipments = await db.getEquipmentsByUserId(userId);
  const equippedItems = {};
  const inventory = [];

  for (const eq of equipments) {
    if (eq.equipped) {
      equippedItems[eq.slot] = eq;
    } else {
      inventory.push(eq);
    }
  }

  const stats = GameLogic.calculateTotalStats(user.level, Object.values(equippedItems).filter(e => e));

  return { user, equipments, equippedItems, inventory, stats };
}

// 缓存辅助
async function getCachedUser(userId) {
  const cacheKey = `user:${userId}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const data = await getUserFullData(userId);
  if (data) {
    await cache.set(cacheKey, data, 300); // 5分钟
  }
  return data;
}

async function invalidateUserCache(userId) {
  await cache.del(`user:${userId}`);
  await cache.del(`equipments:${userId}`);
}

// ==================== 用户 API ====================

// 注册
app.post('/api/register', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, message: '用户名不能为空' });
    }

    const trimmedName = username.trim();

    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(trimmedName)) {
      return res.status(400).json({ success: false, message: '用户名只能包含字母、数字、下划线和中文' });
    }

    if (trimmedName.length > 20) {
      return res.status(400).json({ success: false, message: '用户名最长20个字符' });
    }

    const existing = await db.findUserByUsername(trimmedName);
    if (existing) {
      return res.status(400).json({ success: false, message: '用户名已存在' });
    }

    const user = await db.createUser(trimmedName);

    // 给新玩家初始装备
    const initialEquipments = [
      GameLogic.generateEquipment('weapon', 'rare', 0),
      GameLogic.generateEquipment('helmet', 'normal', 0),
      GameLogic.generateEquipment('chestplate', 'normal', 0)
    ];

    for (const eq of initialEquipments) {
      await db.createEquipment(user.id, { ...eq, equipped: true });
    }

    console.log(`[注册] 用户 ${trimmedName} 注册成功`);

    const userData = await getUserFullData(user.id);

    res.json({
      success: true,
      message: '注册成功',
      data: {
        id: user.id,
        username: user.username,
        uuid: user.uuid,
        level: user.level,
        exp: user.exp,
        gold: user.gold,
        currentHp: user.current_hp,
        maxHp: userData.stats.maxHp,
        stats: userData.stats,
        inventory: userData.inventory,
        equippedItems: userData.equippedItems
      }
    });
  } catch (error) {
    console.error('[注册错误]', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 登录
app.post('/api/login', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, message: '用户名不能为空' });
    }

    const user = await db.findUserByUsername(username.trim());

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在,请先注册' });
    }

    await db.updateLoginTime(user.id);

    const userData = await getUserFullData(user.id);

    console.log(`[登录] 用户 ${user.username} 登录成功`);

    res.json({
      success: true,
      message: '登录成功',
      data: {
        id: user.id,
        username: user.username,
        uuid: user.uuid,
        level: user.level,
        exp: user.exp,
        gold: user.gold,
        currentHp: user.current_hp,
        maxHp: userData.stats.maxHp,
        stats: userData.stats,
        inventory: userData.inventory,
        equippedItems: userData.equippedItems
      }
    });
  } catch (error) {
    console.error('[登录错误]', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取用户数据
app.get('/api/user/:id', async (req, res) => {
  try {
    const userData = await getCachedUser(parseInt(req.params.id));

    if (!userData) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    res.json({
      success: true,
      data: {
        id: userData.user.id,
        username: userData.user.username,
        uuid: userData.user.uuid,
        level: userData.user.level,
        exp: userData.user.exp,
        gold: userData.user.gold,
        currentHp: userData.user.current_hp,
        maxHp: userData.stats.maxHp,
        stats: userData.stats,
        inventory: userData.inventory,
        equippedItems: userData.equippedItems
      }
    });
  } catch (error) {
    console.error('[获取用户错误]', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// ==================== 装备 API ====================

// 强化装备
app.post('/api/equipment/enhance', async (req, res) => {
  try {
    const { userId, equipmentId } = req.body;

    if (!userId || !equipmentId) {
      return res.status(400).json({ success: false, message: '参数不完整' });
    }

    const user = await validateUser(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    const validation = await validateEquipmentOwnership(userId, equipmentId);
    if (!validation.valid) {
      return res.status(403).json({ success: false, message: validation.error });
    }

    const equipment = validation.equipment;

    // 计算金币消耗
    const cost = GameLogic.calculateEnhanceCost(equipment.level);

    // 检查金币是否足够
    const userGold = user.gold || 0;
    if (userGold < cost) {
      return res.json({
        success: false,
        broken: false,
        message: `金币不足,需要 ${cost} 金币`,
        cost
      });
    }

    // 执行强化(服务端计算)
    const result = GameLogic.enhanceEquipment(equipment, userGold);

    if (result.broken) {
      // 装备损坏,扣除金币
      await db.deleteEquipment(equipmentId);
      await db.updateUser(userId, { gold: userGold - cost });
      await invalidateUserCache(userId);
      console.log(`[强化] 用户 ${user.username} 装备损坏 ${equipmentId},消耗 ${cost} 金币`);
      return res.json({
        success: true,
        broken: true,
        message: result.message,
        cost,
        gold: userGold - cost
      });
    }

    if (result.success) {
      // 强化成功,扣除金币
      await db.updateEquipment(equipmentId, {
        level: result.newItem.level,
        main_affix_stat: result.newItem.mainAffix.stat,
        main_affix_value: result.newItem.mainAffix.value,
        sub_affixes: JSON.stringify(result.newItem.subAffixes)
      });
      await db.updateUser(userId, { gold: userGold - cost });
      await invalidateUserCache(userId);
      console.log(`[强化] 用户 ${user.username} 装备强化成功 +${result.newItem.level},消耗 ${cost} 金币`);
    }

    res.json({
      success: result.success,
      broken: false,
      message: result.message,
      cost,
      gold: userGold - (result.success || result.broken ? cost : 0),
      data: result.success ? {
        id: equipmentId,
        level: result.newItem.level,
        mainAffix: result.newItem.mainAffix,
        subAffixes: result.newItem.subAffixes
      } : null
    });
  } catch (error) {
    console.error('[强化错误]', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 穿戴装备
app.post('/api/equipment/equip', async (req, res) => {
  try {
    const { userId, equipmentId } = req.body;

    if (!userId || !equipmentId) {
      return res.status(400).json({ success: false, message: '参数不完整' });
    }

    const user = await validateUser(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    const validation = await validateEquipmentOwnership(userId, equipmentId);
    if (!validation.valid) {
      return res.status(403).json({ success: false, message: validation.error });
    }

    const equipment = validation.equipment;

    // 检查装备等级限制
    const equipLevel = equipment.equipLevel || 1;
    if (user.level < equipLevel) {
      return res.json({
        success: false,
        message: `等级不足,需要 ${equipLevel} 级才能穿戴此装备`
      });
    }

    // 卸下同槽位装备
    const allEquipments = await db.getEquipmentsByUserId(userId);
    const currentEquipped = allEquipments.find(e => e.slot === equipment.slot && e.equipped);
    if (currentEquipped) {
      await db.updateEquipment(currentEquipped.id, { equipped: 0 });
    }

    // 穿上新装备
    await db.updateEquipment(equipmentId, { equipped: 1 });
    await invalidateUserCache(userId);

    console.log(`[装备] 用户 ${user.username} 穿戴 ${equipment.slot}`);

    const userData = await getUserFullData(userId);

    res.json({
      success: true,
      message: `穿戴了 ${GameLogic.SLOT_NAMES[equipment.slot]}`,
      data: {
        inventory: userData.inventory,
        equippedItems: userData.equippedItems,
        stats: userData.stats,
        maxHp: userData.stats.maxHp
      }
    });
  } catch (error) {
    console.error('[穿戴错误]', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 卸下装备
app.post('/api/equipment/unequip', async (req, res) => {
  try {
    const { userId, slot } = req.body;

    if (!userId || !slot) {
      return res.status(400).json({ success: false, message: '参数不完整' });
    }

    const user = await validateUser(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    const equipments = await db.getEquipmentsByUserId(userId);
    const inventoryCount = equipments.filter(e => !e.equipped).length;
    if (inventoryCount >= 50) {
      return res.status(400).json({ success: false, message: '背包已满' });
    }

    const equipped = equipments.find(e => e.slot === slot && e.equipped);
    if (!equipped) {
      return res.status(404).json({ success: false, message: '该槽位没有装备' });
    }

    await db.updateEquipment(equipped.id, { equipped: 0 });
    await invalidateUserCache(userId);

    console.log(`[装备] 用户 ${user.username} 卸下 ${slot}`);

    const userData = await getUserFullData(userId);

    res.json({
      success: true,
      message: `卸下了 ${GameLogic.SLOT_NAMES[slot]}`,
      data: {
        inventory: userData.inventory,
        equippedItems: userData.equippedItems,
        stats: userData.stats,
        maxHp: userData.stats.maxHp
      }
    });
  } catch (error) {
    console.error('[卸下错误]', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 删除装备
app.delete('/api/equipment/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: '缺少用户ID' });
    }

    const validation = await validateEquipmentOwnership(userId, parseInt(id));
    if (!validation.valid) {
      return res.status(403).json({ success: false, message: validation.error });
    }

    await db.deleteEquipment(parseInt(id));
    await invalidateUserCache(userId);

    console.log(`[装备] 用户 ${userId} 丢弃装备 ${id}`);

    res.json({ success: true, message: '丢弃了装备' });
  } catch (error) {
    console.error('[删除错误]', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// ==================== 战斗 API ====================

// 开始战斗
app.post('/api/battle/start', async (req, res) => {
  try {
    const { userId, monsterType, monsterLevel, monsterCellX, monsterCellY } = req.body;

    if (!userId || !monsterType) {
      return res.status(400).json({ success: false, message: '参数不完整' });
    }

    const user = await validateUser(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    const userData = await getUserFullData(userId);
    const playerStats = GameLogic.calculateTotalStats(user.level, Object.values(userData.equippedItems).filter(e => e));

    const battle = GameLogic.createBattle(monsterType, monsterLevel, playerStats, playerStats.maxHp, user.current_hp);
    battle.userId = userId;
    battle.monsterCellX = monsterCellX;
    battle.monsterCellY = monsterCellY;
    battle.playerStats = playerStats;
    battle.originalPlayerHp = user.current_hp; // 保存战斗前的血量

    console.log(`[战斗调试] playerStats:`, JSON.stringify(playerStats));
    console.log(`[战斗调试] monsterDef:`, battle.monsterDef, 'monsterAtk:', battle.monsterAtk);

    const battleId = GameLogic.generateId();
    await cache.set(`battle:${battleId}`, battle, 1800); // 30分钟过期

    console.log(`[战斗] 用户 ${user.username} 开始战斗 vs ${battle.monsterName}`);

    res.json({
      success: true,
      data: {
        battleId,
        monsterName: battle.monsterName,
        monsterHp: battle.monsterHp,
        monsterMaxHp: battle.monsterMaxHp,
        monsterLevel: battle.monsterLevel,
        monsterType: battle.monsterType,
        playerHp: battle.playerHp,
        playerMaxHp: battle.playerMaxHp,
        playerRage: battle.playerRage,
        currentRound: battle.currentRound
      }
    });
  } catch (error) {
    console.error('[战斗开始错误]', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 执行战斗回合
app.post('/api/battle/attack', async (req, res) => {
  try {
    const { battleId, skillId } = req.body;

    if (!battleId) {
      return res.status(400).json({ success: false, message: '缺少战斗ID' });
    }

    const battle = await cache.get(`battle:${battleId}`);
    if (!battle) {
      return res.status(404).json({ success: false, message: '战斗不存在或已过期' });
    }

    if (skillId) {
      const rageCosts = { heavy_hit: 30, whirlwind: 50, fatal_strike: 80, war_cry: 100, rage: 100 };
      const cost = rageCosts[skillId] || 0;
      if (battle.playerRage < cost) {
        return res.status(400).json({ success: false, message: '怒气不足' });
      }
    }

    const result = GameLogic.executeBattleRound(battle, skillId);
    await cache.set(`battle:${battleId}`, battle, 1800);

    // 如果战斗胜利,预计算奖励信息
    let dropInfo = null;
    if (result.victory) {
      const rewards = GameLogic.calculateBattleRewards(battle.monsterType, battle.monsterLevel);
      dropInfo = {
        gold: rewards.gold,
        exp: rewards.exp,
        items: rewards.items
      };
      // 将奖励信息存入 battle 缓存,以便 endBattle 时使用
      battle.rewards = rewards;
      await cache.set(`battle:${battleId}`, battle, 1800);
    }

    res.json({
      success: true,
      data: {
        victory: result.victory,
        playerHp: battle.playerHp,
        playerRage: battle.playerRage,
        monsterHp: battle.monsterHp,
        currentRound: battle.currentRound,
        logs: result.logs,
        dropInfo
      }
    });
  } catch (error) {
    console.error('[战斗回合错误]', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 使用治疗技能
app.post('/api/battle/heal', async (req, res) => {
  try {
    const { battleId } = req.body;

    if (!battleId) {
      return res.status(400).json({ success: false, message: '缺少战斗ID' });
    }

    const battle = await cache.get(`battle:${battleId}`);
    if (!battle) {
      return res.status(404).json({ success: false, message: '战斗不存在或已过期' });
    }

    if (battle.playerRage < 40) {
      return res.status(400).json({ success: false, message: '怒气不足' });
    }

    const healAmount = Math.floor(battle.playerMaxHp * 0.3);
    battle.playerHp = Math.min(battle.playerMaxHp, battle.playerHp + healAmount);
    battle.playerRage -= 40;

    await cache.set(`battle:${battleId}`, battle, 1800);

    res.json({
      success: true,
      data: {
        playerHp: battle.playerHp,
        playerRage: battle.playerRage,
        healAmount,
        logs: [{ text: `💚 治愈之光恢复了 ${healAmount} 点生命`, type: 'heal' }]
      }
    });
  } catch (error) {
    console.error('[治疗错误]', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 结束战斗
app.post('/api/battle/end', async (req, res) => {
  try {
    const { battleId, victory } = req.body;

    if (!battleId) {
      return res.status(400).json({ success: false, message: '缺少战斗ID' });
    }

    const battle = await cache.get(`battle:${battleId}`);
    if (!battle) {
      return res.status(404).json({ success: false, message: '战斗不存在或已过期' });
    }

    const user = await db.findUserById(battle.userId);
    if (!user) {
      await cache.del(`battle:${battleId}`);
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    let responseData = { victory };

    if (victory) {
      // 使用缓存的奖励信息(如果有),否则重新计算
      const rewards = battle.rewards || GameLogic.calculateBattleRewards(battle.monsterType, battle.monsterLevel);
      const levelResult = GameLogic.processLevelUp(user.level, user.exp, rewards.exp);

      await db.updateUser(user.id, {
        level: levelResult.level,
        exp: levelResult.exp,
        gold: user.gold + rewards.gold,
        current_hp: battle.playerHp
      });

      for (const item of rewards.items) {
        await db.createEquipment(user.id, { ...item, equipped: false });
      }

      await invalidateUserCache(user.id);

      const userData = await getUserFullData(user.id);

      responseData = {
        victory: true,
        rewards: {
          exp: rewards.exp,
          gold: rewards.gold,
          items: rewards.items
        },
        levelUps: levelResult.levelUps,
        userData: {
          level: levelResult.level,
          exp: levelResult.exp,
          gold: user.gold + rewards.gold,
          currentHp: battle.playerHp,
          maxHp: userData.stats.maxHp,
          stats: userData.stats,
          inventory: userData.inventory,
          equippedItems: userData.equippedItems
        },
        monsterCellX: battle.monsterCellX,
        monsterCellY: battle.monsterCellY
      };

      console.log(`[战斗] 用户 ${user.username} 胜利 获得 ${rewards.exp}经验 ${rewards.gold}金币 ${rewards.items.length}装备`);
    } else {
      // 战斗失败,恢复到战斗前的血量
      const originalHp = battle.originalPlayerHp || battle.playerMaxHp;
      await db.updateUser(user.id, { current_hp: originalHp });
      await invalidateUserCache(user.id);

      responseData = {
        victory: false,
        userData: { currentHp: originalHp }
      };

      console.log(`[战斗] 用户 ${user.username} 战斗失败,恢复血量到 ${originalHp}`);
    }

    await cache.del(`battle:${battleId}`);

    res.json({ success: true, data: responseData });
  } catch (error) {
    console.error('[结束战斗错误]', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// ==================== 恢复生命 API ====================

app.post('/api/heal', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: '缺少用户ID' });
    }

    const user = await validateUser(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    const userData = await getUserFullData(userId);
    const maxHp = userData.stats.maxHp;

    await db.updateUser(userId, { current_hp: maxHp });
    await invalidateUserCache(userId);

    console.log(`[恢复] 用户 ${user.username} 恢复生命`);

    res.json({ success: true, message: '生命已恢复', data: { currentHp: maxHp, maxHp } });
  } catch (error) {
    console.error('[恢复错误]', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// ==================== 地图 API ====================

app.post('/api/worldmap', async (req, res) => {
  try {
    const { userId, data } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: '缺少用户ID' });
    }

    if (data && data.cells && data.player) {
      await db.saveGameState(userId, data, data.player.cellX, data.player.cellY);
      res.json({ success: true, message: '地图保存成功' });
    } else {
      res.status(400).json({ success: false, message: '地图数据无效' });
    }
  } catch (error) {
    console.error('[地图保存错误]', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

app.get('/api/worldmap/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const state = await db.getGameState(userId);

    if (state) {
      res.json({ success: true, data: state.mapData });
    } else {
      res.json({ success: true, data: null });
    }
  } catch (error) {
    console.error('[地图获取错误]', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 保存玩家位置(防抖动设计,轻量级API)
app.post('/api/worldmap/position', async (req, res) => {
  try {
    const { userId, cellX, cellY } = req.body;

    if (!userId || typeof cellX !== 'number' || typeof cellY !== 'number') {
      return res.status(400).json({ success: false, message: '参数无效' });
    }

    // 更新玩家位置
    const state = await db.getGameState(userId);
    if (state && state.mapData) {
      // 更新 map_data 中的 player 位置
      state.mapData.player.cellX = cellX;
      state.mapData.player.cellY = cellY;
      state.mapData.player.x = cellX * state.mapData.tileSize + state.mapData.tileSize / 2;
      state.mapData.player.y = cellY * state.mapData.tileSize + state.mapData.tileSize / 2;

      await db.saveGameState(userId, state.mapData, cellX, cellY);
      res.json({ success: true, message: '位置已保存' });
    } else {
      res.status(404).json({ success: false, message: '地图数据不存在' });
    }
  } catch (error) {
    console.error('[位置保存错误]', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取玩家位置
app.get('/api/worldmap/position/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const state = await db.getGameState(userId);

    if (state) {
      res.json({ success: true, data: { cellX: state.lastX, cellY: state.lastY } });
    } else {
      res.json({ success: true, data: null });
    }
  } catch (error) {
    console.error('[位置获取错误]', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 更新怪物击败状态(轻量级更新)
app.post('/api/worldmap/entity', async (req, res) => {
  try {
    const { userId, cellX, cellY, defeated } = req.body;

    if (!userId || typeof cellX !== 'number' || typeof cellY !== 'number') {
      return res.status(400).json({ success: false, message: '参数无效' });
    }

    const state = await db.getGameState(userId);
    if (!state || !state.mapData || !state.mapData.cells) {
      return res.status(404).json({ success: false, message: '地图数据不存在' });
    }

    const user = await validateUser(userId);
    const cells = state.mapData.cells;
    let isFinalBossDefeated = false;
    let allMiniBossesDefeated = false;
    let finalBossSpawned = false;

    if (cells[cellY] && cells[cellY][cellX] && cells[cellY][cellX].entity) {
      const entity = cells[cellY][cellX].entity;
      const entitySize = entity.size || 1;

      // 标记所有格子为已击败
      if (entitySize > 1) {
        // 从entity id中提取起始坐标
        const idParts = entity.id.split('_');
        let startX, startY;

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

        for (let dy = 0; dy < entitySize; dy++) {
          for (let dx = 0; dx < entitySize; dx++) {
            const nx = startX + dx;
            const ny = startY + dy;
            if (cells[ny]?.[nx]?.entity?.id === entity.id) {
              cells[ny][nx].entity.defeated = defeated;
              cells[ny][nx].walkable = true; // 击败后可以通行
            }
          }
        }
      } else {
        cells[cellY][cellX].entity.defeated = defeated;
        cells[cellY][cellX].walkable = true;
      }

      // 检查是否击败了最终Boss
      if (entity.isFinalBoss && defeated) {
        isFinalBossDefeated = true;
        state.mapData.finalBossDefeated = true;
      }

      // 检查是否击败了小Boss
      if (entity.isMiniBoss && defeated) {
        state.mapData.miniBossesDefeated = (state.mapData.miniBossesDefeated || 0) + 1;
        console.log(`[小Boss击败] 用户 ${user?.username} 击败了 ${entity.name} (${state.mapData.miniBossesDefeated}/${state.mapData.totalMiniBosses})`);

        // 检查是否所有小Boss都被击败
        if (state.mapData.miniBossesDefeated >= state.mapData.totalMiniBosses && !state.mapData.finalBossSpawned) {
          allMiniBossesDefeated = true;

          // 召唤最终Boss
          const { spawnFinalBoss } = require('./mapGenerator');
          const finalBoss = state.mapData.finalBoss;
          const spawnX = state.mapData.finalBossSpawnX;
          const spawnY = state.mapData.finalBossSpawnY;

          spawnFinalBoss(cells, finalBoss, spawnX, spawnY);
          state.mapData.finalBossSpawned = true;
          finalBossSpawned = true;

          console.log(`[最终Boss召唤] ${finalBoss.name} 已在地图中心召唤!`);
        }
      }

      await db.saveGameState(userId, state.mapData, state.mapData.player?.cellX || 0, state.mapData.player?.cellY || 0);

      // 如果击败了最终Boss,返回通关信息
      if (isFinalBossDefeated) {
        const { getMapConfig } = require('./mapConfig');
        const currentMap = getMapConfig(state.mapData.mapId || 1);
        const nextMap = getMapConfig((state.mapData.mapId || 1) + 1);

        console.log(`[地图通关] 用户 ${user?.username} 通关了 ${currentMap.name}!`);

        return res.json({
          success: true,
          message: `恭喜通关 ${currentMap.name}!`,
          mapCleared: true,
          nextMap: nextMap ? {
            id: nextMap.id,
            name: nextMap.name,
            levelRange: nextMap.levelRange,
          } : null,
          isLastMap: !nextMap || nextMap.id === currentMap.id,
        });
      }

      // 如果最终Boss被召唤,返回召唤信息
      if (finalBossSpawned) {
        return res.json({
          success: true,
          message: `${state.mapData.finalBoss.name} 已在地图中心召唤!`,
          finalBossSpawned: true,
          finalBoss: {
            name: state.mapData.finalBoss.name,
            level: state.mapData.finalBoss.level,
            x: state.mapData.finalBossSpawnX,
            y: state.mapData.finalBossSpawnY,
          },
        });
      }

      res.json({ success: true, message: '怪物状态已更新' });
    } else {
      res.status(404).json({ success: false, message: '格子不存在' });
    }
  } catch (error) {
    console.error('[怪物状态更新错误]', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 生成新地图(后端生成)
app.post('/api/worldmap/generate', async (req, res) => {
  try {
    const { userId, level, mapId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: '缺少用户ID' });
    }

    const user = await validateUser(userId);
    const playerLevel = level || user?.level || 1;

    // 根据玩家等级确定地图ID(如果没有指定)
    const { getCurrentMap, getMapConfig } = require('./mapConfig');
    const targetMapId = mapId || getCurrentMap(playerLevel).id;

    const { generateMap } = require('./mapGenerator');
    const gameMap = generateMap(targetMapId, playerLevel);

    // 保存新地图
    await db.saveGameState(userId, gameMap, gameMap.player.cellX, gameMap.player.cellY);

    const mapConfig = getMapConfig(targetMapId);
    console.log(`[地图生成] 用户 ${user?.username || userId} 进入地图 ${mapConfig.name} (等级${mapConfig.levelRange[0]}-${mapConfig.levelRange[1]})`);

    res.json({
      success: true,
      data: gameMap,
      mapInfo: {
        id: mapConfig.id,
        name: mapConfig.name,
        levelRange: mapConfig.levelRange,
      },
      message: `进入 ${mapConfig.name}`
    });
  } catch (error) {
    console.error('[地图生成错误]', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// ==================== 兼容旧 API ====================

app.post('/api/save', async (req, res) => {
  res.json({ success: true, message: '数据自动保存,无需手动保存' });
});

app.post('/api/equipments/save', (req, res) => {
  res.status(403).json({ success: false, message: '此接口已禁用,请使用游戏API' });
});

// ==================== 健康检查 ====================

app.get('/health', async (req, res) => {
  try {
    // 检查数据库连接
    const dbHealthy = db.healthCheck ? await db.healthCheck() : true;

    // 检查Redis连接
    const cacheHealthy = await cache.ping();

    res.json({
      status: dbHealthy && cacheHealthy ? 'healthy' : 'degraded',
      database: dbHealthy ? 'connected' : 'disconnected',
      cache: cacheHealthy ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});

// ==================== 启动服务器 ====================

// 主页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 启动
initialize().then(() => {
  app.listen(config.port, () => {
    console.log('');
    console.log('========================================');
    console.log(`  游戏服务器运行中`);
    console.log(`  API: http://localhost:${config.port}`);
    console.log(`  健康检查: http://localhost:${config.port}/health`);
    console.log('========================================');
    console.log('');
    console.log('管理界面:');
    console.log(`  Redis: http://localhost:8081`);
    console.log(`  MySQL: http://localhost:8082`);
    console.log('========================================');
  });
}).catch(err => {
  console.error('初始化失败:', err);
  process.exit(1);
});
