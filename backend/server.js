/**
 * Express 服务器 - MySQL + Redis + WebSocket
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const crypto = require('crypto');
const config = require('./config');

// JWT 配置
const JWT_SECRET = process.env.JWT_SECRET || 'similator-equip-secret-key-2024';
const TOKEN_EXPIRE = 7 * 24 * 60 * 60 * 1000; // 7天

// 生成 Token
function generateToken(userId, username) {
  const payload = { userId, username, timestamp: Date.now() };
  const data = JSON.stringify(payload);
  return Buffer.from(data).toString('base64') + '.' + 
         crypto.createHmac('sha256', JWT_SECRET).update(data).digest('hex');
}

// 验证 Token
function verifyToken(token) {
  try {
    const [payloadB64, signature] = token.split('.');
    const data = Buffer.from(payloadB64, 'base64').toString();
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('hex');
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(data);
    // 检查过期
    if (Date.now() - payload.timestamp > TOKEN_EXPIRE) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

// 密码加密
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'salt-prefix').digest('hex');
}

// 验证密码
function verifyPassword(password, hashedPassword) {
  // 兼容旧密码（未加密的）
  if (password === hashedPassword) return true;
  return hashPassword(password) === hashedPassword;
}

// Token 验证中间件
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, message: '未登录', needLogin: true });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Token已过期，请重新登录', needLogin: true });
  }
  req.userId = payload.userId;
  req.username = payload.username;
  next();
}

// 导入游戏逻辑和服务
const GameLogic = require('./gameLogic');
const { createDatabase } = require('./database-mysql');
const { createCache } = require('./cache-redis');

// 初始化
const app = express();
const server = http.createServer(app);
let db, cache;

// WebSocket 服务器
let wss;
const connectedClients = new Map(); // userId -> Set of WebSocket

// 广播消息给所有在线用户
function broadcastMessage(message) {
  if (!wss) return;
  
  const data = JSON.stringify(message);
  let sentCount = 0;
  
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
      sentCount++;
    }
  });
  
  console.log(`[广播] 发送给 ${sentCount} 个在线用户: ${message.type}`);
}

// 生成强化广播文案
function getEnhanceBroadcastMessages(username, level, equipName) {
  if (level === 12) {
    return [
      `恭喜【${username}】将【${equipName}】强化到了+${level}，这把武器已经可以毁天灭地了！`,
      `天降神光！【${username}】成功将【${equipName}】强化至+${level}，屠龙宝刀就在眼前！`,
      `众神惊呼！【${username}】的【${equipName}】突破+${level}大关，人间神器就此诞生！`,
      `江湖震动！【${username}】将【${equipName}】强化到+${level}，各路英雄纷纷侧目！`,
      `传说成真！【${username}】的【${equipName}】达到+${level}，已经可以挑战神明！`,
    ];
  } else if (level === 15) {
    return [
      `神迹降临！【${username}】将【${equipName}】强化到+${level}，这已经不是凡间该有的力量了！`,
      `天神下凡！【${username}】的【${equipName}】达到+${level}，整个世界都为之颤抖！`,
      `传奇诞生！【${username}】成功将【${equipName}】强化至+${level}，此等神兵万年难遇！`,
      `宇宙震动！【${username}】的【${equipName}】突破+${level}，就连创世神都感到恐惧！`,
    ];
  } else if (level === 18) {
    return [
      `时空裂缝！【${username}】将【${equipName}】强化到+${level}，这把武器已经超越了维度的限制！`,
      `命运改写！【${username}】的【${equipName}】达到+${level}，整个宇宙的命运已在其掌控之中！`,
      `创世神器！【${username}】成功将【${equipName}】强化至+${level}，此等神兵足以重铸世界！`,
    ];
  } else if (level === 21) {
    return [
      `终极奥义！【${username}】将【${equipName}】强化到+${level}满级，已然成为超越神明的存在！`,
      `世界之巅！【${username}】的【${equipName}】达到+${level}满级，这是凡人所能触及的终极力量！`,
      `传说终结！【${username}】成功将【${equipName}】强化至+${level}满级，新的神话就此开始！`,
      `万古流芳！【${username}】的【${equipName}】突破极限达到+${level}，此等壮举将被载入史册！`,
    ];
  } else if (level > 12) {
    return [
      `不可思议！【${username}】将【${equipName}】强化到+${level}，神魔皆惊！`,
      `惊叹连连！【${username}】的【${equipName}】突破+${level}，此等壮举世间罕见！`,
      `众神赞叹！【${username}】成功将【${equipName}】强化至+${level}，凡人之躯比肩神明！`,
    ];
  }
  return [];
}

// 生成掉落广播文案
function getDropBroadcastMessages(username, monsterName, equipName) {
  return [
    `恭喜【${username}】经过艰苦奋战击败了【${monsterName}】，在弥留之际它交出了神话级的【${equipName}】！`,
    `天降奇珍！【${username}】成功从【${monsterName}】身上摸出了神话级的【${equipName}】，此乃天命所归！`,
    `奇迹降临！【${username}】在击败【${monsterName}】后，一道金光闪过，神话级【${equipName}】落入囊中！`,
    `宿命之遇！【${username}】与【${monsterName}】激战三百回合，终于获得其守护千年的神话级【${equipName}】！`,
    `传说成真！【${username}】成功从【${monsterName}】的宝库中夺得神话级【${equipName}】，此乃王者之器！`,
    `神明眷顾！【${username}】击败【${monsterName}】后，天降祥瑞，神话级【${equipName}】应运而生！`,
    `龙争虎斗！【${username}】与【${monsterName}】斗智斗勇，最终获得神话级【${equipName}】，荣耀属于勇者！`,
    `命运之轮转动！【${username}】战胜【${monsterName}】后，获得了传说中的神话级【${equipName}】！`,
    `天地变色！【${username}】从【${monsterName}】身上获得神话级【${equipName}】，众生膜拜！`,
    `史诗时刻！【${username}】历经千辛万苦，终于从【${monsterName}】手中夺得神话级【${equipName}】！`,
  ];
}

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// ==================== 数据库和缓存初始化 ====================

async function initialize() {
  console.log('========================================');
  console.log('  初始化数据库和缓存...');
  console.log('========================================');

  // 初始化数据库
  db = createDatabase(config.mysql);
  await db.initTables();
  console.log('[DB] MySQL 连接成功');

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
    // 计算装备售价
    const sellPrice = GameLogic.calculateEquipmentPrice(eq);
    const eqWithPrice = { ...eq, sellPrice };
    
    if (eq.equipped) {
      equippedItems[eq.slot] = eqWithPrice;
    } else {
      inventory.push(eqWithPrice);
    }
  }

  const stats = GameLogic.calculateTotalStats(user.level, Object.values(equippedItems).filter(e => e)) || { atk: 50, def: 30, spd: 20, critRate: 0, critDmg: 0, maxHp: 200 };

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
    const { username, password, nickname } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, message: '用户名不能为空' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: '密码至少6个字符' });
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

    const hashedPassword = hashPassword(password);
    const user = await db.createUser(trimmedName, hashedPassword);
    
    // 设置昵称
    const userNickname = nickname?.trim() || trimmedName;
    await db.updateNickname(user.id, userNickname);

    // 给新玩家初始装备
    const initialEquipments = [
      GameLogic.generateEquipment('weapon', 'rare', 0),
      GameLogic.generateEquipment('helmet', 'normal', 0),
      GameLogic.generateEquipment('chestplate', 'normal', 0)
    ];

    for (const eq of initialEquipments) {
      await db.createEquipment(user.id, { ...eq, equipped: true });
    }

    // 生成 Token
    const token = generateToken(user.id, user.username);

    console.log(`[注册] 用户 ${trimmedName} 注册成功`);

    const userData = await getUserFullData(user.id);

    res.json({
      success: true,
      message: '注册成功',
      data: {
        id: user.id,
        username: user.username,
        nickname: userNickname,
        uuid: user.uuid,
        token,
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
    const { username, password } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, message: '用户名不能为空' });
    }

    if (!password) {
      return res.status(400).json({ success: false, message: '请输入密码' });
    }

    const user = await db.findUserByUsername(username.trim());

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在,请先注册' });
    }

    // 验证密码
    if (!verifyPassword(password, user.password)) {
      return res.status(401).json({ success: false, message: '密码错误' });
    }

    await db.updateLoginTime(user.id);

    // 生成 Token
    const token = generateToken(user.id, user.username);

    const userData = await getUserFullData(user.id);

    console.log(`[登录] 用户 ${user.username} 登录成功`);

    res.json({
      success: true,
      message: '登录成功',
      data: {
        id: user.id,
        username: user.username,
        nickname: user.nickname || user.username,
        uuid: user.uuid,
        token,
        level: user.level,
        exp: user.exp,
        gold: user.gold,
        currentHp: user.current_hp,
        maxHp: userData.stats.maxHp,
        stats: userData.stats,
        inventory: userData.inventory,
        equippedItems: userData.equippedItems,
        gameMap: userData.gameMap
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
      // 计算强化后的售卖价格
      const sellPrice = GameLogic.calculateEquipmentPrice(result.newItem);
      
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
      
      // 强化到12级及以上时发送世界广播
      if (result.newItem.level >= 12) {
        const equipName = equipment.name || `${GameLogic.QUALITY_NAMES[equipment.quality]}${GameLogic.SLOT_NAMES[equipment.slot]}`;
        const displayName = user.nickname || user.username;
        const messages = getEnhanceBroadcastMessages(displayName, result.newItem.level, equipName);
        if (messages.length > 0) {
          const randomMessage = messages[Math.floor(Math.random() * messages.length)];
          broadcastMessage({
            type: 'broadcast',
            broadcastType: 'enhance',
            username: displayName,
            message: randomMessage,
            items: [{ name: equipName, quality: equipment.quality }],
            timestamp: Date.now()
          });
        }
      }
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
        subAffixes: result.newItem.subAffixes,
        sellPrice: GameLogic.calculateEquipmentPrice(result.newItem)
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
// 售卖装备
app.post('/api/equipment/sell', async (req, res) => {
  try {
    const { userId, equipmentId } = req.body;

    if (!userId || !equipmentId) {
      return res.status(400).json({ success: false, message: '参数不完整' });
    }

    const user = await validateUser(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    const validation = await validateEquipmentOwnership(userId, parseInt(equipmentId));
    if (!validation.valid) {
      return res.status(403).json({ success: false, message: validation.error });
    }

    const equipment = validation.equipment;
    
    // 计算售卖价格
    const sellPrice = GameLogic.calculateEquipmentPrice(equipment);
    
    // 删除装备并增加金币
    await db.deleteEquipment(parseInt(equipmentId));
    const newGold = user.gold + sellPrice;
    await db.updateUser(userId, { gold: newGold });
    await invalidateUserCache(userId);

    console.log(`[售卖] 用户 ${user.username} 售卖装备 ${equipmentId}，获得 ${sellPrice} 金币`);

    res.json({ 
      success: true, 
      message: `售卖成功，获得 ${sellPrice} 金币`,
      data: {
        sellPrice,
        gold: newGold
      }
    });
  } catch (error) {
    console.error('[售卖错误]', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取批量售卖预估价格
app.post('/api/equipment/sell-batch-preview', async (req, res) => {
  try {
    const { userId, quality } = req.body;

    if (!userId || !quality) {
      return res.status(400).json({ success: false, message: '参数不完整' });
    }

    const user = await validateUser(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 获取用户所有装备
    const allEquipments = await db.getEquipmentsByUserId(userId);
    
    // 筛选指定稀有度的装备（排除已装备和损坏的）
    const toSell = allEquipments.filter(eq => {
      if (eq.quality !== quality) return false;
      if (eq.equipped) return false;
      if (eq.isBroken) return false;
      return true;
    });

    // 计算总售价
    let totalSellPrice = 0;
    for (const eq of toSell) {
      totalSellPrice += GameLogic.calculateEquipmentPrice(eq);
    }

    res.json({ 
      success: true, 
      data: {
        count: toSell.length,
        totalSellPrice,
        quality
      }
    });
  } catch (error) {
    console.error('[预估价格错误]', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 批量售卖装备（按稀有度）
app.post('/api/equipment/sell-batch', async (req, res) => {
  try {
    const { userId, quality, excludeEquipped = true } = req.body;

    if (!userId || !quality) {
      return res.status(400).json({ success: false, message: '参数不完整' });
    }

    const user = await validateUser(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 获取用户所有装备
    const allEquipments = await db.getEquipmentsByUserId(userId);
    
    // 筛选指定稀有度的装备
    const toSell = allEquipments.filter(eq => {
      if (eq.quality !== quality) return false;
      if (excludeEquipped && eq.equipped) return false;
      if (eq.isBroken) return false;
      return true;
    });

    if (toSell.length === 0) {
      return res.json({ 
        success: false, 
        message: `没有可售卖的${QualityNames[quality] || quality}装备` 
      });
    }

    // 计算总售价
    let totalSellPrice = 0;
    for (const eq of toSell) {
      totalSellPrice += GameLogic.calculateEquipmentPrice(eq);
    }

    // 批量删除装备
    for (const eq of toSell) {
      await db.deleteEquipment(eq.id);
    }

    // 增加金币
    const newGold = user.gold + totalSellPrice;
    await db.updateUser(userId, { gold: newGold });
    await invalidateUserCache(userId);

    console.log(`[批量售卖] 用户 ${user.username} 售卖 ${toSell.length} 件${quality}装备，获得 ${totalSellPrice} 金币`);

    res.json({ 
      success: true, 
      message: `售卖了 ${toSell.length} 件装备，获得 ${totalSellPrice} 金币`,
      data: {
        count: toSell.length,
        totalSellPrice,
        gold: newGold
      }
    });
  } catch (error) {
    console.error('[批量售卖错误]', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 品质名称映射
const QualityNames = {
  normal: '普通',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
  mythic: '神话'
};

// 删除装备（保留兼容）
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

      // 战斗胜利后恢复全部生命值
      const newHp = battle.playerMaxHp;

      await db.updateUser(user.id, {
        level: levelResult.level,
        exp: levelResult.exp,
        gold: user.gold + rewards.gold,
        current_hp: newHp
      });

      for (const item of rewards.items) {
        await db.createEquipment(user.id, { ...item, equipped: false });
      }

      // 检查是否获得神话装备，发送世界广播
      const mythicItems = rewards.items.filter(item => item.quality === 'mythic');
      if (mythicItems.length > 0) {
        const displayName = user.nickname || user.username;
        mythicItems.forEach(item => {
          const equipName = item.name || '神话装备';
          const messages = getDropBroadcastMessages(displayName, battle.monsterName || '未知怪物', equipName);
          const randomMessage = messages[Math.floor(Math.random() * messages.length)];
          broadcastMessage({
            type: 'broadcast',
            broadcastType: 'drop',
            username: displayName,
            message: randomMessage,
            items: [{ name: equipName, quality: 'mythic' }],
            timestamp: Date.now()
          });
        });
      }

      await invalidateUserCache(user.id);

      const userData = await getUserFullData(user.id);

      responseData = {
        victory: true,
        healAmount: battle.playerMaxHp, // 恢复全部血量
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
          currentHp: newHp,
          maxHp: userData.stats.maxHp,
          stats: userData.stats,
          inventory: userData.inventory,
          equippedItems: userData.equippedItems
        },
        monsterCellX: battle.monsterCellX,
        monsterCellY: battle.monsterCellY
      };

      console.log(`[战斗] 用户 ${user.username} 胜利 获得 ${rewards.exp}经验 ${rewards.gold}金币 ${rewards.items.length}装备 恢复全部生命值`);
    } else {
      // 战斗失败,恢复全部血量
      const maxHp = battle.playerMaxHp;
      await db.updateUser(user.id, { current_hp: maxHp });
      await invalidateUserCache(user.id);

      responseData = {
        victory: false,
        userData: { currentHp: maxHp }
      };

      console.log(`[战斗] 用户 ${user.username} 战斗失败,恢复全部血量(${maxHp})`);
    }

    await cache.del(`battle:${battleId}`);

    res.json({ success: true, data: responseData });
  } catch (error) {
    console.error('[结束战斗错误]', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// ==================== 用户信息 API ====================

// 修改昵称
app.post('/api/user/nickname', authMiddleware, async (req, res) => {
  try {
    const { nickname } = req.body;
    
    if (!nickname || !nickname.trim()) {
      return res.status(400).json({ success: false, message: '昵称不能为空' });
    }
    
    const trimmedNickname = nickname.trim();
    
    if (trimmedNickname.length > 20) {
      return res.status(400).json({ success: false, message: '昵称最长20个字符' });
    }
    
    await db.updateNickname(req.userId, trimmedNickname);
    await invalidateUserCache(req.userId);
    
    console.log(`[昵称] 用户 ${req.username} 修改昵称为: ${trimmedNickname}`);
    
    res.json({
      success: true,
      message: '昵称修改成功',
      data: { nickname: trimmedNickname }
    });
  } catch (error) {
    console.error('[修改昵称错误]', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 修改密码
app.post('/api/user/password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: '请输入旧密码和新密码' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: '新密码至少6个字符' });
    }
    
    const user = await db.findUserById(req.userId);
    if (!verifyPassword(oldPassword, user.password)) {
      return res.status(401).json({ success: false, message: '旧密码错误' });
    }
    
    const hashedPassword = hashPassword(newPassword);
    await db.updatePassword(req.userId, hashedPassword);
    
    console.log(`[密码] 用户 ${req.username} 修改密码成功`);
    
    res.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    console.error('[修改密码错误]', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 验证Token
app.get('/api/auth/verify', authMiddleware, async (req, res) => {
  try {
    const userData = await getUserFullData(req.userId);
    
    res.json({
      success: true,
      data: {
        id: req.userId,
        username: req.username,
        nickname: userData.user.nickname || userData.user.username,
        level: userData.user.level,
        exp: userData.user.exp,
        gold: userData.user.gold,
        currentHp: userData.user.current_hp,
        maxHp: userData.stats.maxHp,
        stats: userData.stats,
        inventory: userData.inventory,
        equippedItems: userData.equippedItems,
        gameMap: userData.gameMap
      }
    });
  } catch (error) {
    console.error('[验证Token错误]', error);
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
    const currentHp = user.current_hp;
    
    // 计算需要恢复的血量和金币消耗
    const hpToHeal = maxHp - currentHp;
    if (hpToHeal <= 0) {
      return res.json({ success: false, message: '生命值已满，无需恢复' });
    }
    
    const goldCost = hpToHeal; // 每点血花费1金币
    if (user.gold < goldCost) {
      return res.json({ 
        success: false, 
        message: `金币不足！恢复生命需要 ${goldCost} 金币（当前: ${user.gold}）` 
      });
    }
    
    // 扣除金币并恢复生命
    const newGold = user.gold - goldCost;
    await db.updateUser(userId, { 
      current_hp: maxHp,
      gold: newGold
    });
    await invalidateUserCache(userId);

    console.log(`[恢复] 用户 ${user.username} 恢复生命，消耗 ${goldCost} 金币`);

    res.json({ 
      success: true, 
      message: `生命已恢复，消耗 ${goldCost} 金币`, 
      data: { 
        currentHp: maxHp, 
        maxHp,
        gold: newGold,
        goldCost
      } 
    });
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

    console.log(`[地图生成请求] userId=${userId}, level=${level}`);

    if (!userId) {
      return res.status(400).json({ success: false, message: '缺少用户ID' });
    }

    const user = await validateUser(userId);
    console.log(`[地图生成] 查询用户结果:`, user ? `id=${user.id}, name=${user.username}` : 'null');

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在，请先登录' });
    }

    const playerLevel = level || user.level || 1;

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

// 重新开始当前地图
app.post('/api/worldmap/restart', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: '缺少用户ID' });
    }

    const user = await validateUser(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 获取当前地图ID
    const state = await db.getGameState(userId);
    const currentMapId = state?.mapData?.mapId || 1;

    const { getMapConfig } = require('./mapConfig');
    const { generateMap } = require('./mapGenerator');

    const gameMap = generateMap(currentMapId, user.level);

    // 保存新地图
    await db.saveGameState(userId, gameMap, gameMap.player.cellX, gameMap.player.cellY);

    const mapConfig = getMapConfig(currentMapId);
    console.log(`[地图重置] 用户 ${user.username} 重新开始地图 ${mapConfig.name}`);

    res.json({
      success: true,
      data: gameMap,
      mapInfo: {
        id: mapConfig.id,
        name: mapConfig.name,
        levelRange: mapConfig.levelRange,
      },
      message: `重新开始 ${mapConfig.name}`
    });
  } catch (error) {
    console.error('[地图重置错误]', error);
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

// ==================== 自动战斗 API ====================

// 自动战斗配置存储（简化版，实际应该存数据库）
const autoBattleConfigs = new Map();

// 获取自动战斗配置
app.get('/api/auto-battle/config/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const config = autoBattleConfigs.get(userId) || {
      enabled: false,
      skipFinalBoss: false, // 默认不跳过最终Boss，打完Boss才停止
      autoSellQualities: ['normal', 'rare'],
      minHpPercent: 30,
      battleInterval: 500,
    };
    res.json({ success: true, data: config });
  } catch (error) {
    console.error('[获取自动战斗配置错误]', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 设置自动战斗配置
app.post('/api/auto-battle/config', async (req, res) => {
  try {
    const { userId, config } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: '缺少用户ID' });
    }
    
    const user = await validateUser(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    
    // 合并默认配置
    const defaultConfig = {
      enabled: false,
      skipFinalBoss: false, // 默认不跳过最终Boss
      autoSellQualities: ['normal', 'rare'],
      minHpPercent: 30,
      battleInterval: 500,
    };
    
    const finalConfig = { ...defaultConfig, ...config };
    autoBattleConfigs.set(userId, finalConfig);
    
    console.log(`[自动战斗配置] 用户 ${user.username} 设置:`, finalConfig);
    
    res.json({ success: true, data: finalConfig });
  } catch (error) {
    console.error('[设置自动战斗配置错误]', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 执行一次自动战斗（查找最近的怪物并战斗）
app.post('/api/auto-battle/execute', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: '缺少用户ID' });
    }
    
    const user = await validateUser(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    
    // 获取地图数据
    const state = await db.getGameState(userId);
    if (!state || !state.mapData || !state.mapData.cells) {
      return res.json({ success: false, message: '没有地图数据', needMap: true });
    }
    
    const gameMap = state.mapData;
    const config = autoBattleConfigs.get(userId) || {
      enabled: false,
      skipFinalBoss: true,
      autoSellQualities: ['normal', 'rare'],
      minHpPercent: 30,
      battleInterval: 500,
    };
    
    // 检查血量是否足够
    const userData = await getUserFullData(userId);
    const hpPercent = (user.current_hp / userData.stats.maxHp) * 100;
    if (hpPercent < config.minHpPercent) {
      return res.json({ 
        success: false, 
        message: `血量不足 (${hpPercent.toFixed(1)}% < ${config.minHpPercent}%)`, 
        needHeal: true,
        hpPercent,
      });
    }
    
    // 寻找最近的怪物（使用BFS）
    const playerX = gameMap.player.cellX;
    const playerY = gameMap.player.cellY;
    const cells = gameMap.cells;
    
    let nearestEntity = null;
    let nearestDistance = Infinity;
    let nearestCellX = playerX;
    let nearestCellY = playerY;
    
    // BFS搜索最近的怪物
    const visited = new Set();
    const queue = [[playerX, playerY, 0]];
    visited.add(`${playerX},${playerY}`);
    
    const maxSearchRadius = Math.max(gameMap.width, gameMap.height); // 扩大搜索范围到全地图
    
    while (queue.length > 0) {
      const [x, y, dist] = queue.shift();
      
      if (dist > maxSearchRadius) continue;
      
      const cell = cells[y]?.[x];
      if (cell && cell.entity && !cell.entity.defeated) {
        const entity = cell.entity;
        
        // 跳过最终Boss（如果配置了skipFinalBoss）
        if (config.skipFinalBoss && entity.isFinalBoss) {
          continue;
        }
        
        // 跳过宝箱
        if (entity.type === 'chest') {
          continue;
        }
        
        // 检查是否是实体的左上角格子
        const idParts = entity.id.split('_');
        let startX, startY;
        
        if (entity.isMiniBoss) {
          startX = parseInt(idParts[2]);
          startY = parseInt(idParts[3]);
        } else if (entity.isFinalBoss) {
          startX = parseInt(idParts[1]);
          startY = parseInt(idParts[2]);
        } else {
          startX = parseInt(idParts[1]);
          startY = parseInt(idParts[2]);
        }
        
        if (x === startX && y === startY) {
          nearestEntity = entity;
          nearestDistance = dist;
          nearestCellX = x;
          nearestCellY = y;
          break; // 找到最近的就停止
        }
      }
      
      // 向四周扩展
      const directions = [[0, -1], [0, 1], [-1, 0], [1, 0]]; // 上、下、左、右
      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        const key = `${nx},${ny}`;
        
        if (!visited.has(key) && nx >= 0 && nx < gameMap.width && ny >= 0 && ny < gameMap.height) {
          visited.add(key);
          const nextCell = cells[ny]?.[nx];
          if (nextCell && (nextCell.walkable || (nextCell.entity && !nextCell.entity.defeated))) {
            queue.push([nx, ny, dist + 1]);
          }
        }
      }
    }
    
    if (!nearestEntity) {
      // 检查是否还有任何未击败的怪物（包括Boss）
      let hasAnyMonster = false;
      let hasFinalBoss = false;
      let finalBossDefeated = gameMap.finalBossDefeated || false;
      
      for (let y = 0; y < cells.length; y++) {
        for (let x = 0; x < cells[y].length; x++) {
          const cell = cells[y][x];
          if (cell.entity && !cell.entity.defeated && cell.entity.type !== 'chest') {
            hasAnyMonster = true;
            if (cell.entity.isFinalBoss) {
              hasFinalBoss = true;
            }
          }
        }
      }
      
      // 如果最终Boss已被击败，地图清理完成
      if (finalBossDefeated || (gameMap.finalBossSpawned && !hasFinalBoss)) {
        return res.json({ 
          success: false, 
          message: '地图已完全清理，最终Boss已被击败！', 
          mapCleared: true,
          finalBossDefeated: true,
        });
      }
      
      // 如果没有任何怪物了，但最终Boss还没击败（可能是bug或特殊情况）
      if (!hasAnyMonster) {
        return res.json({ 
          success: false, 
          message: '地图已探索完毕，没有更多怪物', 
          mapExplored: true,
        });
      }
      
      // 如果有最终Boss但被跳过了（配置skipFinalBoss=true）
      if (hasFinalBoss && config.skipFinalBoss) {
        return res.json({ 
          success: false, 
          message: '已跳过最终Boss，地图探索完毕', 
          mapExplored: true,
          skippedFinalBoss: true,
        });
      }
      
      return res.json({ success: false, message: '没有找到可战斗的怪物' });
    }
    
    // 执行战斗
    const monsterType = nearestEntity.isMiniBoss ? 'boss' : 
                         nearestEntity.type === 'elite' ? 'elite' : 'normal';
    const monsterLevel = nearestEntity.level;
    
    const playerStats = GameLogic.calculateTotalStats(user.level, Object.values(userData.equippedItems).filter(e => e));
    
    // 创建战斗
    let battle = GameLogic.createBattle(monsterType, monsterLevel, playerStats, playerStats.maxHp, user.current_hp);
    battle.userId = userId;
    battle.monsterCellX = nearestCellX;
    battle.monsterCellY = nearestCellY;
    battle.playerStats = playerStats;
    battle.originalPlayerHp = user.current_hp;
    
    // 自动战斗直到结束
    const battleLogs = [];
    while (battle.monsterHp > 0 && battle.playerHp > 0) {
      // 选择技能：怒气足够时使用高伤害技能
      let skillId = null;
      if (battle.playerRage >= 100) {
        skillId = 'rage'; // 狂暴 200%伤害
      } else if (battle.playerRage >= 80) {
        skillId = 'fatal_strike'; // 致命一击 200%伤害
      } else if (battle.playerRage >= 50) {
        skillId = 'whirlwind'; // 旋风斩 100%伤害
      } else if (battle.playerRage >= 30) {
        skillId = 'heavy_hit'; // 重击 50%伤害
      }
      
      // 如果血量低，优先治疗
      const currentHpPercent = (battle.playerHp / battle.playerMaxHp) * 100;
      if (currentHpPercent < 40 && battle.playerRage >= 40) {
        // 治疗
        const healAmount = Math.floor(battle.playerMaxHp * 0.3);
        battle.playerHp = Math.min(battle.playerMaxHp, battle.playerHp + healAmount);
        battle.playerRage -= 40;
        battleLogs.push({ text: `💚 治愈之光恢复了 ${healAmount} 点生命`, type: 'heal' });
      } else {
        const result = GameLogic.executeBattleRound(battle, skillId);
        battleLogs.push(...result.logs);
      }
    }
    
    const victory = battle.monsterHp <= 0;
    
    // 处理战斗结果
    let responseData = { victory, entity: nearestEntity, cellX: nearestCellX, cellY: nearestCellY };
    
    if (victory) {
      const rewards = GameLogic.calculateBattleRewards(monsterType, monsterLevel);
      const levelResult = GameLogic.processLevelUp(user.level, user.exp, rewards.exp);
      
      // 恢复全部生命
      const newHp = battle.playerMaxHp;
      
      await db.updateUser(user.id, {
        level: levelResult.level,
        exp: levelResult.exp,
        gold: user.gold + rewards.gold,
        current_hp: newHp,
      });
      
      // 创建装备
      for (const item of rewards.items) {
        await db.createEquipment(user.id, { ...item, equipped: false });
      }
      
      // 更新怪物击败状态
      const entitySize = nearestEntity.size || 1;
      const idParts = nearestEntity.id.split('_');
      let startX, startY;
      
      if (nearestEntity.isMiniBoss) {
        startX = parseInt(idParts[2]);
        startY = parseInt(idParts[3]);
      } else if (nearestEntity.isFinalBoss) {
        startX = parseInt(idParts[1]);
        startY = parseInt(idParts[2]);
      } else {
        startX = parseInt(idParts[1]);
        startY = parseInt(idParts[2]);
      }
      
      // 标记所有格子为已击败
      for (let dy = 0; dy < entitySize; dy++) {
        for (let dx = 0; dx < entitySize; dx++) {
          const nx = startX + dx;
          const ny = startY + dy;
          if (cells[ny]?.[nx]?.entity?.id === nearestEntity.id) {
            cells[ny][nx].entity.defeated = true;
            cells[ny][nx].walkable = true;
          }
        }
      }
      
      // 更新小Boss进度
      if (nearestEntity.isMiniBoss) {
        gameMap.miniBossesDefeated = (gameMap.miniBossesDefeated || 0) + 1;
        
        // 检查是否召唤最终Boss
        if (gameMap.miniBossesDefeated >= gameMap.totalMiniBosses && !gameMap.finalBossSpawned) {
          const { spawnFinalBoss } = require('./mapGenerator');
          spawnFinalBoss(cells, gameMap.finalBoss, gameMap.finalBossSpawnX, gameMap.finalBossSpawnY);
          gameMap.finalBossSpawned = true;
          responseData.finalBossSpawned = true;
          responseData.finalBossName = gameMap.finalBoss?.name;
          console.log(`[自动战斗] 用户 ${user.username} 已召唤最终Boss ${gameMap.finalBoss?.name}!`);
        }
      }
      
      // 检查是否击败了最终Boss
      if (nearestEntity.isFinalBoss) {
        gameMap.finalBossDefeated = true;
        responseData.finalBossDefeated = true;
        responseData.mapCleared = true;
        console.log(`[自动战斗] 用户 ${user.username} 击败了最终Boss ${nearestEntity.name}! 地图通关!`);
      }
      
      // 保存地图
      await db.saveGameState(userId, gameMap, nearestCellX, nearestCellY);
      await invalidateUserCache(userId);
      
      // 自动售卖配置的装备
      if (config.autoSellQualities && config.autoSellQualities.length > 0) {
        const allEquipments = await db.getEquipmentsByUserId(userId);
        let totalSellPrice = 0;
        let sellCount = 0;
        
        for (const quality of config.autoSellQualities) {
          const toSell = allEquipments.filter(eq => {
            if (eq.quality !== quality) return false;
            if (eq.equipped) return false;
            if (eq.isBroken) return false;
            return true;
          });
          
          for (const eq of toSell) {
            const price = GameLogic.calculateEquipmentPrice(eq);
            totalSellPrice += price;
            sellCount++;
            await db.deleteEquipment(eq.id);
          }
        }
        
        if (sellCount > 0) {
          const newGold = (user.gold + rewards.gold) + totalSellPrice;
          await db.updateUser(userId, { gold: newGold });
          responseData.autoSold = { count: sellCount, totalPrice: totalSellPrice, qualities: config.autoSellQualities }; 
        }
      }
      
      const newUserData = await getUserFullData(userId);
      
      responseData.rewards = {
        exp: rewards.exp,
        gold: rewards.gold,
        items: rewards.items.length,
      }; 
      responseData.levelUps = levelResult.levelUps;
      responseData.userData = {
        level: levelResult.level,
        exp: levelResult.exp,
        gold: newUserData.user.gold,
        currentHp: newHp,
        maxHp: newUserData.stats.maxHp,
        stats: newUserData.stats,
        inventory: newUserData.inventory,
        equippedItems: newUserData.equippedItems,
      }; 
      responseData.playerPosition = { cellX: nearestCellX, cellY: nearestCellY }; 
      responseData.battleLogs = battleLogs.slice(-10); // 只返回最后10条日志
      
      console.log(`[自动战斗] 用户 ${user.username} 自动击败 ${nearestEntity.name}，获得 ${rewards.gold}金币 ${rewards.exp}经验`);
    } else {
      // 战斗失败，恢复全部血量
      const maxHp = battle.playerMaxHp;
      await db.updateUser(user.id, { current_hp: maxHp });
      await invalidateUserCache(userId);
      
      // 返回详细失败信息
      responseData.userData = { currentHp: maxHp }; 
      responseData.battleLogs = battleLogs.slice(-10); 
      responseData.playerStats = playerStats; // 玩家属性
      responseData.monsterStats = {
        name: nearestEntity.name,
        level: monsterLevel,
        type: monsterType,
        atk: battle.monsterAtk,
        def: battle.monsterDef,
        maxHp: battle.monsterMaxHp,
      }; // 怪物属性
      responseData.battleFailed = true; // 标记战斗失败
      responseData.suggestion = {
        type: monsterType,
        message: monsterType === 'boss' 
          ? 'Boss战失败，建议强化装备到+10以上或更换更高品质装备后再挑战'
          : monsterType === 'elite'
          ? '精英怪战失败，建议强化装备或提升等级后再挑战'
          : '普通怪战失败，建议检查装备是否已穿戴、是否需要强化',
        needAtk: Math.ceil(battle.monsterMaxHp / 5), // 建议攻击力(5回合击败)
        needDef: Math.ceil(battle.monsterAtk * 0.5), // 建议防御力(减少一半伤害)
      }; // 提升建议
      
      console.log(`[自动战斗] 用户 ${user.username} 自动战斗失败 vs ${nearestEntity.name}，恢复全部血量(${maxHp})`);
      console.log(`[自动战斗] 玩家属性: ATK=${playerStats.atk}, DEF=${playerStats.def}, HP=${playerStats.maxHp}`);
      console.log(`[自动战斗] 怪物属性: ATK=${battle.monsterAtk}, DEF=${battle.monsterDef}, HP=${battle.monsterMaxHp}`);
    }
    
    res.json({ success: true, data: responseData });
  } catch (error) {
    console.error('[自动战斗错误]', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// ==================== 宝箱 API ====================

// 打开宝箱
app.post('/api/chest/open', async (req, res) => {
  try {
    const { userId, cellX, cellY } = req.body;
    
    if (!userId || typeof cellX !== 'number' || typeof cellY !== 'number') {
      return res.status(400).json({ success: false, message: '参数不完整' });
    }
    
    const user = await validateUser(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    
    // 获取地图数据
    const state = await db.getGameState(userId);
    if (!state || !state.mapData || !state.mapData.cells) {
      return res.status(404).json({ success: false, message: '地图数据不存在' });
    }
    
    const cells = state.mapData.cells;
    const cell = cells[cellY]?.[cellX];
    
    if (!cell || !cell.entity || cell.entity.type !== 'chest') {
      return res.status(404).json({ success: false, message: '该位置没有宝箱' });
    }
    
    if (cell.entity.defeated) {
      return res.status(400).json({ success: false, message: '宝箱已打开' });
    }
    
    // 检查玩家是否在宝箱位置
    const playerX = state.mapData.player.cellX;
    const playerY = state.mapData.player.cellY;
    if (playerX !== cellX || playerY !== cellY) {
      return res.status(400).json({ success: false, message: '请先移动到宝箱位置' });
    }
    
    // 生成宝箱奖励
    const chestLevel = cell.entity.level || user.level;
    const rewards = GameLogic.calculateBattleRewards('normal', chestLevel);
    
    // 添加奖励
    const newGold = user.gold + rewards.gold;
    const levelResult = GameLogic.processLevelUp(user.level, user.exp, rewards.exp);
    
    // 创建装备
    for (const item of rewards.items) {
      await db.createEquipment(user.id, { ...item, equipped: false });
    }
    
    // 更新用户数据
    await db.updateUser(user.id, {
      level: levelResult.level,
      exp: levelResult.exp,
      gold: newGold,
    });
    
    // 标记宝箱为已打开
    cells[cellY][cellX].entity.defeated = true;
    cells[cellY][cellX].walkable = true;
    
    // 更新统计
    if (state.mapData.stats) {
      state.mapData.stats.chests = state.mapData.stats.chests || { total: 0, opened: 0 };
      state.mapData.stats.chests.opened++;
    }
    
    // 保存地图
    await db.saveGameState(userId, state.mapData, cellX, cellY);
    await invalidateUserCache(userId);
    
    const userData = await getUserFullData(userId);
    
    console.log(`[宝箱] 用户 ${user.username} 打开宝箱，获得 ${rewards.gold}金币 ${rewards.exp}经验 ${rewards.items.length}件装备`);
    
    res.json({
      success: true,
      message: `打开宝箱获得 ${rewards.gold}金币 ${rewards.exp}经验 ${rewards.items.length}件装备`,
      data: {
        rewards: {
          gold: rewards.gold,
          exp: rewards.exp,
          items: rewards.items,
        },
        userData: {
          level: levelResult.level,
          exp: levelResult.exp,
          gold: newGold,
          currentHp: userData.user.current_hp,
          maxHp: userData.stats.maxHp,
          stats: userData.stats,
          inventory: userData.inventory,
          equippedItems: userData.equippedItems,
        },
        levelUps: levelResult.levelUps,
      },
    });
  } catch (error) {
    console.error('[打开宝箱错误]', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
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

// WebSocket 连接端点
app.get('/ws', (req, res) => {
  res.json({ 
    message: 'WebSocket 端点',
    protocol: 'ws',
    hint: '请使用 WebSocket 客户端连接'
  });
});

// 启动
initialize().then(() => {
  // 初始化 WebSocket 服务器
  wss = new WebSocket.Server({ server });
  
  wss.on('connection', (ws, req) => {
    console.log('[WebSocket] 新客户端连接');
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        // 处理客户端消息（如心跳包、认证等）
        if (message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (err) {
        // 忽略无效消息
      }
    });
    
    ws.on('close', () => {
      console.log('[WebSocket] 客户端断开连接');
    });
    
    ws.on('error', (err) => {
      console.error('[WebSocket] 连接错误:', err.message);
    });
    
    // 发送欢迎消息
    ws.send(JSON.stringify({ 
      type: 'connected', 
      message: '已连接到游戏服务器',
      timestamp: Date.now()
    }));
  });
  
  server.listen(config.port, () => {
    console.log('');
    console.log('========================================');
    console.log(`  游戏服务器运行中`);
    console.log(`  API: http://localhost:${config.port}`);
    console.log(`  WebSocket: ws://localhost:${config.port}`);
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
