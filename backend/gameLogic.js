/**
 * 游戏逻辑模块 - 所有影响数据的计算都在这里
 */

const { generateEquipmentName } = require('./equipmentNamer');

// 品质倍率
const QUALITY_MULT = {
    normal: 1,
    rare: 1.3,
    epic: 1.6,
    legendary: 2,
    mythic: 2.5
};

// 词条基础值
const BASE_VALUES = {
    ATK_FLAT: 15,
    ATK_PERCENT: 5,
    DEF_FLAT: 12,
    DEF_PERCENT: 5,
    HP_FLAT: 80,
    HP_PERCENT: 5,
    SPD_FLAT: 8,
    SPD_PERCENT: 4,
    CRIT_RATE: 4,
    CRIT_DMG: 8,
    STRENGTH: 10,
    SKILL_CD: 5,
    ARMOR: 15,
    MOVE_SPEED: 6
};

// 词条名称映射
const STAT_NAMES = {
    ATK_PERCENT: '攻击力%',
    ATK_FLAT: '攻击力',
    DEF_PERCENT: '防御力%',
    DEF_FLAT: '防御力',
    HP_FLAT: '生命值',
    HP_PERCENT: '生命值%',
    SPD_FLAT: '速度',
    SPD_PERCENT: '速度%',
    CRIT_RATE: '暴击率',
    CRIT_DMG: '暴击伤害',
    STRENGTH: '力量',
    MOVE_SPEED: '移动速度',
    SKILL_CD: '技能冷却',
    ARMOR: '护甲'
};

// 槽位对应主词条
const SLOT_MAIN_STAT = {
    weapon: 'ATK_PERCENT',
    helmet: 'DEF_FLAT',
    chestplate: 'DEF_PERCENT',
    gloves: 'ATK_FLAT',
    boots: 'SPD_FLAT',
    accessory: 'CRIT_DMG'
};

// 槽位中文名
const SLOT_NAMES = {
    weapon: '武器',
    helmet: '头盔',
    chestplate: '胸甲',
    gloves: '护手',
    boots: '鞋子',
    accessory: '首饰'
};

// 怪物名称
const MONSTER_NAMES = {
    normal: ['哥布林', '史莱姆', '野狼', '骷髅兵', '蝙蝠'],
    elite: ['哥布林首领', '史莱姆王', '狂暴野狼', '骷髅将军', '吸血蝙蝠王'],
    boss: ['黑暗龙王', '魔王', '远古巨兽', '深渊领主', '死神']
};

/**
 * 生成随机ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * 随机选择数组元素
 */
function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 生成装备词条
 * @param {string} slot - 装备部位
 * @param {number} enhanceLevel - 强化等级
 * @param {string} quality - 品质
 * @param {boolean} isMain - 是否主词条
 * @param {number} equipLevelMult - 装备等级倍率
 */
function generateAffix(slot, enhanceLevel, quality, isMain = false, equipLevelMult = 1) {
    const commonStats = ['ATK_FLAT', 'ATK_PERCENT', 'DEF_FLAT', 'DEF_PERCENT', 'HP_FLAT', 'SPD_FLAT', 'CRIT_RATE', 'CRIT_DMG'];
    
    let stat;
    if (isMain) {
        stat = SLOT_MAIN_STAT[slot] || randomChoice(commonStats);
    } else {
        const available = commonStats.filter(s => s !== SLOT_MAIN_STAT[slot]);
        stat = randomChoice(available);
    }
    
    const base = BASE_VALUES[stat] || 5;
    const mult = QUALITY_MULT[quality];
    const variance = 0.8 + Math.random() * 0.4;
    
    return {
        stat,
        value: Math.floor(base * mult * equipLevelMult * variance)
    };
}

/**
 * 生成副词条列表
 * @param {string} slot - 装备部位
 * @param {number} enhanceLevel - 强化等级
 * @param {string} quality - 品质
 * @param {object|null} fixedAffix - 固定词条（来自前缀）
 * @param {number} equipLevelMult - 装备等级倍率
 */
function generateSubAffixes(slot, enhanceLevel, quality, fixedAffix = null, equipLevelMult = 1) {
    const subAffixes = [];
    const usedStats = new Set();
    
    // 如果有固定词条，先添加它
    if (fixedAffix) {
        const statMapping = {
            'atk': 'ATK_FLAT',
            'atkPercent': 'ATK_PERCENT',
            'def': 'DEF_FLAT',
            'defPercent': 'DEF_PERCENT',
            'maxHp': 'HP_FLAT',
            'spd': 'SPD_FLAT',
            'critRate': 'CRIT_RATE',
            'critDmg': 'CRIT_DMG',
        };
        const backendStat = statMapping[fixedAffix.stat] || fixedAffix.stat;
        usedStats.add(backendStat);
        subAffixes.push({
            stat: backendStat,
            value: Math.floor(fixedAffix.value * equipLevelMult),
            isFixed: true,
        });
    }
    
    // 根据品质决定副词条数量
    const affixCount = { normal: 2, rare: 3, epic: 4, legendary: 4, mythic: 4 };
    const count = affixCount[quality] || 2;
    const remainingCount = count - subAffixes.length;
    
    const commonStats = ['ATK_FLAT', 'ATK_PERCENT', 'DEF_FLAT', 'DEF_PERCENT', 'HP_FLAT', 'SPD_FLAT', 'CRIT_RATE', 'CRIT_DMG'];
    
    for (let i = 0; i < remainingCount && usedStats.size < commonStats.length; i++) {
        const available = commonStats.filter(s => !usedStats.has(s) && s !== SLOT_MAIN_STAT[slot]);
        if (available.length === 0) break;
        
        const stat = randomChoice(available);
        usedStats.add(stat);
        
        const base = BASE_VALUES[stat] || 5;
        const mult = QUALITY_MULT[quality];
        const variance = 0.8 + Math.random() * 0.4;
        
        subAffixes.push({
            stat,
            value: Math.floor(base * mult * equipLevelMult * variance)
        });
    }
    
    return subAffixes;
}

/**
 * 计算装备等级（每5级为一档）
 * @param {number} monsterLevel - 怪物等级
 * @returns {number} 装备等级 (1, 5, 10, 15, 20...)
 */
function calculateEquipLevel(monsterLevel) {
    // 装备等级: 1, 5, 10, 15, 20, 25, 30...
    if (monsterLevel <= 3) return 1;
    return Math.floor((monsterLevel + 2) / 5) * 5;
}

/**
 * 获取装备等级倍率
 * @param {number} equipLevel - 装备等级
 * @returns {number} 属性倍率
 */
function getEquipLevelMultiplier(equipLevel) {
    // 装备等级越高，基础属性越强
    // 1级: 1.0, 5级: 1.5, 10级: 2.0, 15级: 2.5...
    return 1 + (equipLevel - 1) * 0.1;
}

/**
 * 生成新装备
 * @param {string} slot - 装备部位
 * @param {string} quality - 品质
 * @param {number} monsterLevel - 怪物等级（用于计算装备等级）
 */
function generateEquipment(slot, quality, monsterLevel = 0) {
    // 计算装备等级
    const equipLevel = calculateEquipLevel(monsterLevel);
    const equipLevelMult = getEquipLevelMultiplier(equipLevel);
    
    // 生成装备名称和可能的固定词条
    const { name, fixedAffix, enhanceLevel } = generateEquipmentName(slot, quality);
    
    const mainAffix = generateAffix(slot, 0, quality, true, equipLevelMult);
    const subAffixes = generateSubAffixes(slot, 0, quality, fixedAffix, equipLevelMult);
    
    return {
        id: generateId(),
        slot,
        level: enhanceLevel,
        quality,
        equipLevel,  // 新增: 装备等级要求
        isBroken: false,
        name,
        mainAffix,
        subAffixes
    };
}

/**
 * 随机生成装备品质
 */
function randomQuality(monsterType) {
    const roll = Math.random() * 100;
    
    // Boss掉落更高品质
    const bonus = monsterType === 'boss' ? 15 : monsterType === 'elite' ? 8 : 0;
    
    if (roll < 1 + bonus * 0.1) return 'mythic';
    if (roll < 5 + bonus) return 'legendary';
    if (roll < 20 + bonus) return 'epic';
    if (roll < 50 + bonus) return 'rare';
    return 'normal';
}

/**
 * 计算强化金币消耗
 * @param {number} level - 当前强化等级
 * @returns {number} 金币消耗
 */
function calculateEnhanceCost(level) {
    // 阶梯式增长消耗
    // +0~+3: 50, 60, 70, 80 (低等级便宜)
    // +4~+6: 100, 130, 160 (中等级适中)
    // +7~+9: 200, 250, 300 (高等级昂贵)
    // +10+: 400+ (顶级强化)
    if (level <= 3) {
        return 50 + level * 10;
    } else if (level <= 6) {
        return 100 + (level - 4) * 30;
    } else if (level <= 9) {
        return 200 + (level - 7) * 50;
    } else {
        return 400 + (level - 10) * 100;
    }
}

/**
 * 强化装备
 * @param {object} equipment - 装备数据
 * @param {number} userGold - 用户当前金币
 * @returns { { success, broken, newItem, message, cost } }
 */
function enhanceEquipment(equipment, userGold = Infinity) {
    if (equipment.isBroken || equipment.level >= 21) {
        return { success: false, broken: false, message: '无法强化', cost: 0 };
    }
    
    const cost = calculateEnhanceCost(equipment.level);
    
    if (userGold < cost) {
        return { success: false, broken: false, message: `金币不足（需要 ${cost}）`, cost };
    }
    
    const successRate = Math.max(5, 95 - equipment.level * 4);
    const brokenRate = equipment.level >= 10 ? Math.min(70, 5 + (equipment.level - 10) * 7) : 0;
    const roll = Math.random() * 100;
    
    if (roll < successRate) {
        // 强化成功
        const newLevel = equipment.level + 1;
        const newMainValue = equipment.mainAffix.value + Math.ceil(equipment.mainAffix.value * 0.05);
        
        const newItem = {
            ...equipment,
            level: newLevel,
            mainAffix: {
                ...equipment.mainAffix,
                value: newMainValue
            }
        };
        
        // 检查是否升级副词条
        if ([3, 6, 9, 12, 15, 18, 21].includes(newLevel)) {
            const subAffixes = [...newItem.subAffixes];
            if (subAffixes.length > 0) {
                const idx = Math.floor(Math.random() * subAffixes.length);
                const percent = 20 + Math.floor(Math.random() * 21);
                subAffixes[idx] = {
                    ...subAffixes[idx],
                    value: subAffixes[idx].value + Math.ceil(subAffixes[idx].value * percent / 100),
                    upgradeCount: (subAffixes[idx].upgradeCount || 0) + 1
                };
            }
            newItem.subAffixes = subAffixes;
        }
        
        return { success: true, broken: false, newItem, message: `强化成功! +${newLevel}`, cost };
    } else if (roll < successRate + brokenRate) {
        // 装备损坏
        return { success: false, broken: true, message: '💔 装备损坏!', cost };
    } else {
        // 强化失败
        return { success: false, broken: false, message: `强化失败 +${equipment.level}`, cost };
    }
}

/**
 * 计算玩家属性
 */
function calculateStats(level) {
    return {
        atk: 50 + level * 10,
        def: 30 + level * 5,
        spd: 20 + level * 2,
        critRate: 0,
        critDmg: 0
    };
}

/**
 * 计算装备提供的属性加成
 */
function calculateEquipmentStats(equipments) {
    const flatStats = { atk: 0, def: 0, hp: 0, spd: 0, critRate: 0, critDmg: 0 };
    const percentStats = { atk: 0, def: 0, hp: 0, spd: 0, critRate: 0, critDmg: 0 };
    
    for (const item of equipments) {
        if (!item || item.isBroken) continue;
        
        // 处理主词条和副词条
        const allAffixes = [item.mainAffix, ...item.subAffixes];
        
        for (const affix of allAffixes) {
            if (!affix) continue;
            
            const stat = affix.stat;
            const value = affix.value;
            
            if (stat.endsWith('_PERCENT')) {
                const statKey = stat.replace('_PERCENT', '').toLowerCase();
                if (percentStats[statKey] !== undefined) {
                    percentStats[statKey] += value;
                }
            } else if (stat === 'CRIT_RATE') {
                flatStats.critRate += value;
            } else if (stat === 'CRIT_DMG') {
                flatStats.critDmg += value;
            } else {
                const statKey = stat.replace('_FLAT', '').toLowerCase();
                if (flatStats[statKey] !== undefined) {
                    flatStats[statKey] += value;
                }
            }
        }
    }
    
    return { flat: flatStats, percent: percentStats };
}

/**
 * 计算总属性
 * 公式：(固定数值之和) * (1 + 百分比数值之和/100)
 */
function calculateTotalStats(level, equipments) {
    const baseStats = calculateStats(level);
    const baseHp = 200 + level * 50;
    
    const equip = calculateEquipmentStats(equipments);
    
    // 固定数值之和 = 基础 + 装备固定值
    const flatTotal = {
        atk: baseStats.atk + equip.flat.atk,
        def: baseStats.def + equip.flat.def,
        hp: baseHp + equip.flat.hp,
        spd: baseStats.spd + equip.flat.spd,
        critRate: baseStats.critRate + equip.flat.critRate,
        critDmg: baseStats.critDmg + equip.flat.critDmg
    };
    
    // 最终属性 = 固定数值之和 * (1 + 百分比数值之和/100)
    return {
        atk: Math.floor(flatTotal.atk * (1 + equip.percent.atk / 100)),
        def: Math.floor(flatTotal.def * (1 + equip.percent.def / 100)),
        maxHp: Math.floor(flatTotal.hp * (1 + equip.percent.hp / 100)),
        spd: Math.floor(flatTotal.spd * (1 + equip.percent.spd / 100)),
        // 暴击率和暴击伤害是百分比属性，直接相加
        critRate: flatTotal.critRate + equip.percent.critRate,
        critDmg: flatTotal.critDmg + equip.percent.critDmg
    };
}

/**
 * 计算战斗伤害
 * 改进方案：
 * 1. 基础伤害 = 攻击力 × 技能倍率
 * 2. 暴击伤害 = 基础伤害 × (1 + 暴击伤害/100)
 * 3. 防御减免 = 1 - 防御/(防御 + K)，K为常数(100)
 * 4. 最终伤害 = 伤害 × 防御减免 × 随机浮动(0.95~1.05)
 */
function calculateBattleDamage(attackerStats, defenderDef, skillPercent = 0) {
    // 暴击判定
    const isCrit = Math.random() * 100 < attackerStats.critRate;
    
    // 基础伤害 = 攻击力 × (1 + 技能百分比/100)
    let baseDamage = attackerStats.atk * (1 + skillPercent / 100);
    
    // 暴击加成（独立乘区）
    if (isCrit) {
        baseDamage *= (1 + attackerStats.critDmg / 100);
    }
    
    // 防御减免 = 1 - 防御/(防御 + K)
    // K值设为100，确保防御效果线性衰减
    const DEF_CONSTANT = 100;
    const defReduction = 1 - defenderDef / (defenderDef + DEF_CONSTANT);
    
    // 应用防御减免
    let damage = baseDamage * defReduction;
    
    // 随机浮动 ±5%
    damage *= (0.95 + Math.random() * 0.1);
    
    // 最小伤害为1
    damage = Math.max(1, damage);
    
    return {
        damage: Math.floor(damage),
        isCrit
    };
}

/**
 * 创建战斗实例
 */
function createBattle(monsterType, monsterLevel, playerStats, playerMaxHp, playerCurrentHp) {
    const names = MONSTER_NAMES[monsterType];
    const monsterName = randomChoice(names);
    
    const hpMult = monsterType === 'boss' ? 5 : monsterType === 'elite' ? 2 : 1;
    const monsterMaxHp = Math.floor((100 + monsterLevel * 20) * hpMult);
    
    return {
        monsterName,
        monsterHp: monsterMaxHp,
        monsterMaxHp,
        monsterLevel,
        monsterType,
        monsterAtk: Math.floor(30 + monsterLevel * 5),
        monsterDef: Math.floor(10 + monsterLevel * 3),
        playerHp: playerCurrentHp,
        playerMaxHp,
        playerStats,
        currentRound: 1,
        playerRage: 0,
        logs: []
    };
}

/**
 * 防御常数，用于计算防御减免
 */
const DEF_CONSTANT = 100;

/**
 * 计算防御减免比例
 * 公式：减免 = 1 - 防御/(防御 + K)
 * @param {number} def 防御值
 * @returns {number} 伤害保留比例 (0~1)
 */
function calculateDefReduction(def) {
    return 1 - def / (def + DEF_CONSTANT);
}

/**
 * 执行一次战斗回合
 * 改进方案：
 * - 基础伤害 = 攻击力 × (1 + 技能百分比/100)
 * - 暴击伤害 = 基础伤害 × (1 + 暴击伤害/100)
 * - 防御减免 = 1 - 防御/(防御 + 100)
 * - 最终伤害 = 伤害 × 防御减免 × 随机浮动(0.95~1.05)
 */
function executeBattleRound(battle, skillId = null) {
    const logs = [];
    
    console.log('[战斗回合调试] battle.playerStats:', JSON.stringify(battle.playerStats));
    console.log('[战斗回合调试] battle.monsterDef:', battle.monsterDef);
    
    // 玩家攻击
    let skillPercent = 0;
    let skillName = '';
    let rageCost = 0;
    
    if (skillId) {
        switch (skillId) {
            case 'heavy_hit': skillPercent = 50; skillName = '重击'; rageCost = 30; break;
            case 'whirlwind': skillPercent = 100; skillName = '旋风斩'; rageCost = 50; break;
            case 'fatal_strike': skillPercent = 200; skillName = '致命一击'; rageCost = 80; break;
            case 'war_cry': skillPercent = 150; skillName = '战吼'; rageCost = 100; break;
            case 'rage': skillPercent = 200; skillName = '狂暴'; rageCost = 100; break;
        }
    }
    
    // 使用统一的伤害计算函数
    const playerResult = calculateBattleDamage(battle.playerStats, battle.monsterDef, skillPercent);
    const playerDamage = playerResult.damage;
    const isPlayerCrit = playerResult.isCrit;
    
    if (skillName) {
        logs.push({ text: `💥 ${skillName}造成 ${playerDamage} 点伤害${isPlayerCrit ? ' (暴击!)' : ''}`, type: 'skill' });
    } else {
        logs.push({ text: `你攻击造成 ${playerDamage} 点伤害${isPlayerCrit ? ' (暴击!)' : ''}`, type: isPlayerCrit ? 'crit' : 'attack' });
    }
    
    battle.monsterHp = Math.max(0, battle.monsterHp - playerDamage);
    battle.playerRage = Math.min(100, battle.playerRage + 10 - rageCost);
    
    // 检查怪物是否死亡
    if (battle.monsterHp <= 0) {
        logs.push({ text: `🎉 击败了 ${battle.monsterName}!`, type: 'victory' });
        battle.logs.push(...logs);
        return { victory: true, logs };
    }
    
    // 怪物反击
    // 使用相同的防御减免公式
    const monsterBaseDamage = battle.monsterAtk;
    const defReduction = calculateDefReduction(battle.playerStats.def);
    const monsterDamage = Math.max(1, Math.floor(monsterBaseDamage * defReduction * (0.95 + Math.random() * 0.1)));
    
    battle.playerHp = Math.max(0, battle.playerHp - monsterDamage);
    battle.monsterRage = Math.min(100, battle.monsterRage + 10);
    
    logs.push({ text: `${battle.monsterName}反击造成 ${monsterDamage} 点伤害`, type: 'damage' });
    
    battle.currentRound++;
    battle.logs.push(...logs);
    
    return { victory: false, logs };
}

/**
 * 计算战斗奖励
 */
function calculateBattleRewards(monsterType, monsterLevel) {
    const mult = monsterType === 'boss' ? 5 : monsterType === 'elite' ? 2 : 1;
    
    // 经验
    const exp = Math.floor((10 + monsterLevel * 5) * mult);
    
    // 金币
    const gold = Math.floor((10 + monsterLevel * 5) * mult);
    
    // 装备掉落
    const dropCount = monsterType === 'boss' 
        ? Math.floor(Math.random() * 4) + 2  // 2-5件
        : monsterType === 'elite' 
            ? Math.floor(Math.random() * 3) + 1  // 1-3件
            : Math.floor(Math.random() * 3);  // 0-2件
    
    const slots = ['weapon', 'helmet', 'chestplate', 'gloves', 'boots', 'accessory'];
    const items = [];
    
    for (let i = 0; i < dropCount; i++) {
        const slot = randomChoice(slots);
        const quality = randomQuality(monsterType);
        const level = Math.max(0, monsterLevel - 3 + Math.floor(Math.random() * 6));
        items.push(generateEquipment(slot, quality, level));
    }
    
    return { exp, gold, items };
}

/**
 * 处理升级逻辑
 */
function processLevelUp(currentLevel, currentExp, expGain) {
    let level = currentLevel;
    let exp = currentExp + expGain;
    const levelUps = [];
    
    while (exp >= level * 100) {
        exp -= level * 100;
        level++;
        levelUps.push(level);
    }
    
    return { level, exp, levelUps };
}

module.exports = {
    generateId,
    generateEquipment,
    generateAffix,
    generateSubAffixes,
    enhanceEquipment,
    calculateEnhanceCost,
    calculateEquipLevel,
    getEquipLevelMultiplier,
    calculateStats,
    calculateEquipmentStats,
    calculateTotalStats,
    calculateBattleDamage,
    createBattle,
    executeBattleRound,
    calculateBattleRewards,
    processLevelUp,
    randomQuality,
    randomChoice,
    QUALITY_MULT,
    BASE_VALUES,
    STAT_NAMES,
    SLOT_NAMES,
    SLOT_MAIN_STAT,
    MONSTER_NAMES
};
