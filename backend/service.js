/**
 * 服务层 - 结合缓存和数据库
 * 
 * 架构设计：
 * ┌─────────┐     ┌─────────┐     ┌─────────┐
 * │   API   │────▶│  Cache  │────▶│   DB    │
 * └─────────┘     └─────────┘     └─────────┘
 * 
 * 读取流程：Cache -> DB (miss时回填)
 * 写入流程：DB -> 更新/删除 Cache
 */

const db = require('./database-unified');
const cache = require('./cache');
const GameLogic = require('./gameLogic');

class GameService {
  
  // ==================== 用户服务 ====================
  
  /**
   * 获取用户数据（带缓存）
   */
  async getUser(userId: number) {
    const cacheKey = cache.userKey(userId);
    
    return cache.getOrSet(cacheKey, async () => {
      const user = await db.findUserById(userId);
      if (!user) return null;
      
      // 同时获取装备
      const equipments = await this.getUserEquipments(userId);
      const equippedItems: any = {};
      const inventory: any[] = [];
      
      for (const eq of equipments) {
        if (eq.equipped) {
          equippedItems[eq.slot] = eq;
        } else {
          inventory.push(eq);
        }
      }
      
      const stats = GameLogic.calculateTotalStats(user.level, Object.values(equippedItems).filter((e: any) => e));
      
      return {
        id: user.id,
        username: user.username,
        uuid: user.uuid,
        level: user.level,
        exp: user.exp,
        gold: user.gold,
        currentHp: user.current_hp,
        maxHp: stats.maxHp,
        stats,
        inventory,
        equippedItems
      };
    }, 300); // 缓存5分钟
  }
  
  /**
   * 更新用户数据（同时更新缓存）
   */
  async updateUser(userId: number, data: any) {
    // 先更新数据库
    await db.updateUser(userId, {
      level: data.level,
      exp: data.exp,
      gold: data.gold,
      current_hp: data.currentHp
    });
    
    // 删除缓存，下次读取时重新加载
    await cache.del(cache.userKey(userId));
    await cache.del(cache.equipmentsKey(userId));
    
    return this.getUser(userId);
  }
  
  /**
   * 用户登录
   */
  async login(username: string) {
    const user = await db.findUserByUsername(username);
    if (!user) return null;
    
    await db.updateLoginTime(user.id);
    
    // 预热缓存
    const userData = await this.getUser(user.id);
    
    return userData;
  }
  
  /**
   * 用户注册
   */
  async register(username: string) {
    const user = await db.createUser(username);
    
    // 给新玩家初始装备
    const initialEquipments = [
      GameLogic.generateEquipment('weapon', 'rare', 0),
      GameLogic.generateEquipment('helmet', 'normal', 0),
      GameLogic.generateEquipment('chestplate', 'normal', 0)
    ];
    
    for (const eq of initialEquipments) {
      await this.createEquipment(user.id, { ...eq, equipped: true });
    }
    
    // 缓存用户数据
    const userData = await this.getUser(user.id);
    
    return userData;
  }
  
  // ==================== 装备服务 ====================
  
  /**
   * 获取用户装备（带缓存）
   */
  async getUserEquipments(userId: number) {
    const cacheKey = cache.equipmentsKey(userId);
    
    return cache.getOrSet(cacheKey, async () => {
      return db.getEquipmentsByUserId(userId);
    }, 300);
  }
  
  /**
   * 创建装备
   */
  async createEquipment(userId: number, equipment: any) {
    const result = await db.createEquipment(userId, equipment);
    
    // 清除装备缓存
    await cache.del(cache.equipmentsKey(userId));
    await cache.del(cache.userKey(userId));
    
    return result;
  }
  
  /**
   * 强化装备（核心逻辑在服务端）
   */
  async enhanceEquipment(userId: number, equipmentId: number) {
    // 获取装备
    const equipment = await db.getEquipmentById(equipmentId);
    if (!equipment) {
      return { success: false, message: '装备不存在' };
    }
    
    // 验证所有权
    if (equipment.user_id !== userId) {
      return { success: false, message: '无权操作' };
    }
    
    // 执行强化逻辑
    const result = GameLogic.enhanceEquipment(equipment);
    
    if (result.broken) {
      // 装备损坏，删除
      await db.deleteEquipment(equipmentId);
      await cache.del(cache.equipmentsKey(userId));
      await cache.del(cache.userKey(userId));
      
      return { success: false, broken: true, message: result.message };
    }
    
    if (result.success) {
      // 更新装备
      await db.updateEquipment(equipmentId, {
        level: result.newItem.level,
        main_affix_stat: result.newItem.mainAffix.stat,
        main_affix_value: result.newItem.mainAffix.value,
        sub_affixes: JSON.stringify(result.newItem.subAffixes)
      });
      
      // 清除缓存
      await cache.del(cache.equipmentsKey(userId));
      await cache.del(cache.userKey(userId));
    }
    
    return {
      success: result.success,
      broken: false,
      message: result.message,
      data: result.success ? result.newItem : null
    };
  }
  
  /**
   * 穿戴装备
   */
  async equipItem(userId: number, equipmentId: number) {
    const equipment = await db.getEquipmentById(equipmentId);
    if (!equipment || equipment.user_id !== userId) {
      return { success: false, message: '装备不存在或无权操作' };
    }
    
    // 卸下同槽位装备
    const equipments = await this.getUserEquipments(userId);
    const currentEquipped = equipments.find((e: any) => e.slot === equipment.slot && e.equipped);
    if (currentEquipped) {
      await db.updateEquipment(currentEquipped.id, { equipped: 0 });
    }
    
    // 穿上新装备
    await db.updateEquipment(equipmentId, { equipped: 1 });
    
    // 清除缓存
    await cache.del(cache.equipmentsKey(userId));
    await cache.del(cache.userKey(userId));
    
    return { success: true, message: `穿戴了 ${GameLogic.SLOT_NAMES[equipment.slot]}` };
  }
  
  /**
   * 卸下装备
   */
  async unequipItem(userId: number, slot: string) {
    const equipments = await this.getUserEquipments(userId);
    const equipped = equipments.find((e: any) => e.slot === slot && e.equipped);
    
    if (!equipped) {
      return { success: false, message: '该槽位没有装备' };
    }
    
    // 检查背包容量
    const inventoryCount = equipments.filter((e: any) => !e.equipped).length;
    if (inventoryCount >= 50) {
      return { success: false, message: '背包已满' };
    }
    
    await db.updateEquipment(equipped.id, { equipped: 0 });
    
    // 清除缓存
    await cache.del(cache.equipmentsKey(userId));
    await cache.del(cache.userKey(userId));
    
    return { success: true, message: `卸下了 ${GameLogic.SLOT_NAMES[slot]}` };
  }
  
  /**
   * 删除装备
   */
  async deleteEquipment(userId: number, equipmentId: number) {
    const equipment = await db.getEquipmentById(equipmentId);
    if (!equipment || equipment.user_id !== userId) {
      return { success: false, message: '装备不存在或无权操作' };
    }
    
    await db.deleteEquipment(equipmentId);
    
    // 清除缓存
    await cache.del(cache.equipmentsKey(userId));
    await cache.del(cache.userKey(userId));
    
    return { success: true, message: '丢弃了装备' };
  }
  
  // ==================== 战斗服务 ====================
  
  // 战斗会话（生产环境应使用 Redis）
  private battleSessions: Map<string, any> = new Map();
  
  /**
   * 开始战斗
   */
  async startBattle(userId: number, monsterType: string, monsterLevel: number, cellX: number, cellY: number) {
    const user = await this.getUser(userId);
    if (!user) return null;
    
    const playerStats = GameLogic.calculateTotalStats(user.level, Object.values(user.equippedItems).filter((e: any) => e));
    
    const battle = GameLogic.createBattle(monsterType, monsterLevel, playerStats, playerStats.maxHp, user.currentHp);
    battle.userId = userId;
    battle.monsterCellX = cellX;
    battle.monsterCellY = cellY;
    battle.playerStats = playerStats;
    
    const battleId = GameLogic.generateId();
    
    // 存储战斗会话（生产环境用 Redis）
    await cache.set(cache.battleKey(battleId), battle, 1800); // 30分钟过期
    
    return {
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
    };
  }
  
  /**
   * 获取战斗会话
   */
  async getBattle(battleId: string) {
    return cache.get(cache.battleKey(battleId));
  }
  
  /**
   * 更新战斗会话
   */
  async updateBattle(battleId: string, battle: any) {
    await cache.set(cache.battleKey(battleId), battle, 1800);
  }
  
  /**
   * 结束战斗
   */
  async endBattle(battleId: string, victory: boolean) {
    const battle = await this.getBattle(battleId);
    if (!battle) return null;
    
    let result: any = { victory };
    
    if (victory) {
      // 计算奖励
      const rewards = GameLogic.calculateBattleRewards(battle.monsterType, battle.monsterLevel);
      
      // 处理升级
      const user = await this.getUser(battle.userId);
      const levelResult = GameLogic.processLevelUp(user.level, user.exp, rewards.exp);
      
      // 更新用户数据
      await this.updateUser(battle.userId, {
        level: levelResult.level,
        exp: levelResult.exp,
        gold: user.gold + rewards.gold,
        currentHp: battle.playerHp
      });
      
      // 添加装备
      for (const item of rewards.items) {
        await this.createEquipment(battle.userId, { ...item, equipped: false });
      }
      
      result = {
        victory: true,
        rewards,
        levelUps: levelResult.levelUps,
        userData: await this.getUser(battle.userId),
        monsterCellX: battle.monsterCellX,
        monsterCellY: battle.monsterCellY
      };
    } else {
      // 失败
      const user = await this.getUser(battle.userId);
      const halfHp = Math.floor(user.maxHp / 2);
      
      await this.updateUser(battle.userId, {
        currentHp: halfHp
      });
      
      result = {
        victory: false,
        userData: { currentHp: halfHp }
      };
    }
    
    // 清除战斗会话
    await cache.del(cache.battleKey(battleId));
    
    return result;
  }
  
  // ==================== 游戏状态服务 ====================
  
  /**
   * 保存游戏地图状态
   */
  async saveGameState(userId: number, mapData: any, x: number, y: number) {
    await db.saveGameState(userId, mapData, x, y);
  }
  
  /**
   * 获取游戏地图状态
   */
  async getGameState(userId: number) {
    return db.getGameState(userId);
  }
  
  /**
   * 恢复生命
   */
  async healPlayer(userId: number) {
    const user = await this.getUser(userId);
    if (!user) return null;
    
    await this.updateUser(userId, {
      currentHp: user.maxHp
    });
    
    return { currentHp: user.maxHp, maxHp: user.maxHp };
  }
}

// 单例导出
const gameService = new GameService();
module.exports = gameService;
export default gameService;
