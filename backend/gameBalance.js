/**
 * 游戏平衡系统
 * 校心设计：
 * 1. 玩家刚进地图能打过普通怪，但打不过精英
 * 2. 打完一半小怪后能打过精英
 * 3. Boss需要地图毕业属性才能挑战
 */

/**
 * 装备槽位配置
 */
const EQUIPMENT_SLOTS = ['weapon', 'helmet', 'chestplate', 'gloves', 'boots', 'accessory'];

/**
 * 品质倍率
 */
const QUALITY_MULT = {
    normal: 1,
    rare: 1.3,
    epic: 1.6,
    legendary: 2,
    mythic: 2.5
};

/**
 * 词条基础值
 */
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
    CRIT_DMG: 8
};

/**
 * 槽位对应主词条
 */
const SLOT_MAIN_STAT = {
    weapon: 'ATK_PERCENT',
    helmet: 'DEF_FLAT',
    chestplate: 'DEF_PERCENT',
    gloves: 'ATK_FLAT',
    boots: 'SPD_FLAT',
    accessory: 'CRIT_DMG'
};

/**
 * 副词条池
 */
const SUB_STAT_POOL = {
    weapon: ['ATK_FLAT', 'CRIT_RATE', 'CRIT_DMG', 'HP_FLAT'],
    helmet: ['DEF_FLAT', 'HP_FLAT', 'DEF_PERCENT', 'HP_PERCENT'],
    chestplate: ['DEF_PERCENT', 'HP_FLAT', 'DEF_FLAT', 'HP_PERCENT'],
    gloves: ['ATK_FLAT', 'CRIT_RATE', 'CRIT_DMG', 'ATK_PERCENT'],
    boots: ['SPD_FLAT', 'HP_FLAT', 'DEF_FLAT', 'SPD_PERCENT'],
    accessory: ['CRIT_DMG', 'CRIT_RATE', 'ATK_FLAT', 'ATK_PERCENT']
};

/**
 * 地图平衡配置
 * 定义每个地图的不同阶段玩家属性
 * 
 * 设计原则：
 * 1. early: 刚进地图时（能打过普通怪，打不过精英）
 * 2. mid: 打完一半小怪后（能打过精英）
 * 3. final: 地图毕业时（能打过Boss）
 */
/**
 * 地图平衡配置
 * 定义每个地图的不同阶段玩家属性
 * 
 * 设计原则：
 * 1. early: 刚进地图时（能打过普通怪，打不过精英）
 * 2. mid: 打完一半小怪后（能打过精英）
 * 3. final: 地图毕业时（能打过Boss）
 * 
 * 注意：装备强化10级以上会碎，所以final阶段强化最多11-12
 */
const MAP_BALANCE_CONFIG = {
    1: { // 新手草原 1-10级
        early: {
            playerLevel: 1,
            equipLevel: 1,
            enhanceLevel: 0,
            quality: 'normal'
        },
        mid: {
            playerLevel: 5,
            equipLevel: 1,
            enhanceLevel: 3,
            quality: 'normal'
        },
        final: {
            playerLevel: 10,
            equipLevel: 5,
            enhanceLevel: 6,
            quality: 'rare'
        },
        levelRange: [1, 10]
    },
    2: { // 幽暗森林 11-20级
        early: {
            playerLevel: 11,
            equipLevel: 5,
            enhanceLevel: 6,
            quality: 'rare'
        },
        mid: {
            playerLevel: 15,
            equipLevel: 10,
            enhanceLevel: 8,
            quality: 'rare'
        },
        final: {
            playerLevel: 20,
            equipLevel: 15,
            enhanceLevel: 10,
            quality: 'rare'
        },
        levelRange: [11, 20]
    },
    3: { // 灼热沙漠 21-30级
        early: {
            playerLevel: 21,
            equipLevel: 15,
            enhanceLevel: 10,
            quality: 'rare'
        },
        mid: {
            playerLevel: 25,
            equipLevel: 20,
            enhanceLevel: 10,
            quality: 'epic'
        },
        final: {
            playerLevel: 30,
            equipLevel: 25,
            enhanceLevel: 11,
            quality: 'epic'
        },
        levelRange: [21, 30]
    },
    4: { // 冰霜高原 31-40级
        early: {
            playerLevel: 31,
            equipLevel: 25,
            enhanceLevel: 11,
            quality: 'epic'
        },
        mid: {
            playerLevel: 35,
            equipLevel: 30,
            enhanceLevel: 11,
            quality: 'epic'
        },
        final: {
            playerLevel: 40,
            equipLevel: 35,
            enhanceLevel: 12,
            quality: 'epic'
        },
        levelRange: [31, 40]
    },
    5: { // 熔岩地带 41-50级
        early: {
            playerLevel: 41,
            equipLevel: 35,
            enhanceLevel: 12,
            quality: 'epic'
        },
        mid: {
            playerLevel: 45,
            equipLevel: 40,
            enhanceLevel: 12,
            quality: 'legendary'
        },
        final: {
            playerLevel: 50,
            equipLevel: 45,
            enhanceLevel: 12,
            quality: 'legendary'
        },
        levelRange: [41, 50]
    },
    6: { // 暗影深渊 51-60级
        early: {
            playerLevel: 51,
            equipLevel: 45,
            enhanceLevel: 12,
            quality: 'legendary'
        },
        mid: {
            playerLevel: 55,
            equipLevel: 50,
            enhanceLevel: 12,
            quality: 'legendary'
        },
        final: {
            playerLevel: 60,
            equipLevel: 55,
            enhanceLevel: 12,
            quality: 'mythic'
        },
        levelRange: [51, 60]
    }
};

/**
 * 获取装备等级倍率
 */
function getEquipLevelMultiplier(equipLevel) {
    return 1 + (equipLevel - 1) * 0.1;
}

/**
 * 获取强化等级倍率
 */
function getEnhanceMultiplier(enhanceLevel) {
    return 1 + enhanceLevel * 0.05;
}

/**
 * 应用词条值到属性对象
 */
function applyStatValue(stats, stat, value) {
    switch (stat) {
        case 'ATK_FLAT': stats.atk += value; break;
        case 'ATK_PERCENT': stats.atkPercent += value; break;
        case 'DEF_FLAT': stats.def += value; break;
        case 'DEF_PERCENT': stats.defPercent += value; break;
        case 'HP_FLAT': stats.hp += value; break;
        case 'HP_PERCENT': stats.hpPercent += value; break;
        case 'SPD_FLAT': stats.spd += value; break;
        case 'SPD_PERCENT': stats.spdPercent += value; break;
        case 'CRIT_RATE': stats.critRate += value; break;
        case 'CRIT_DMG': stats.critDmg += value; break;
    }
}

/**
 * 计算单个装备词条的预期值
 */
function calculateExpectedAffixValue(stat, quality, equipLevel, enhanceLevel, isMain = false) {
    const baseValue = BASE_VALUES[stat] || 10;
    const qualityMult = QUALITY_MULT[quality] || 1;
    const equipMult = getEquipLevelMultiplier(equipLevel);
    const enhanceMult = getEnhanceMultiplier(enhanceLevel);
    const mainBonus = isMain ? 1.2 : 1.0;
    
    return Math.floor(baseValue * qualityMult * equipMult * enhanceMult * mainBonus);
}

/**
 * 计算单个装备的预期属性贡献
 */
function calculateExpectedEquipmentStats(slot, quality, equipLevel, enhanceLevel) {
    const stats = { 
        atk: 0, def: 0, hp: 0, spd: 0, 
        atkPercent: 0, defPercent: 0, hpPercent: 0, spdPercent: 0,
        critRate: 0, critDmg: 0 
    };
    
    // 主词条
    const mainStat = SLOT_MAIN_STAT[slot];
    const mainValue = calculateExpectedAffixValue(mainStat, quality, equipLevel, enhanceLevel, true);
    applyStatValue(stats, mainStat, mainValue);
    
    // 副词条
    const subCount = { normal: 2, rare: 3, epic: 4, legendary: 4, mythic: 4 };
    const numSubs = subCount[quality] || 2;
    const subPool = SUB_STAT_POOL[slot] || [];
    
    for (let i = 0; i < numSubs && i < subPool.length; i++) {
        const subStat = subPool[i];
        const subValue = calculateExpectedAffixValue(subStat, quality, equipLevel, enhanceLevel, false);
        applyStatValue(stats, subStat, subValue);
    }
    
    return stats;
}

/**
 * 计算玩家基础属性
 */
function calculatePlayerBaseStats(level) {
    return {
        atk: 50 + level * 10,
        def: 30 + level * 5,
        hp: 200 + level * 50,
        spd: 20 + level * 2,
        critRate: 0,
        critDmg: 0
    };
}

/**
 * 计算预期玩家总属性
 */
function calculateExpectedPlayerStats(playerLevel, equipLevel, enhanceLevel, avgQuality = 'epic') {
    const base = calculatePlayerBaseStats(playerLevel);
    
    const equipTotal = {
        atk: 0, def: 0, hp: 0, spd: 0,
        atkPercent: 0, defPercent: 0, hpPercent: 0, spdPercent: 0,
        critRate: 0, critDmg: 0
    };
    
    for (const slot of EQUIPMENT_SLOTS) {
        const equipStats = calculateExpectedEquipmentStats(slot, avgQuality, equipLevel, enhanceLevel);
        for (const key in equipStats) {
            equipTotal[key] += equipStats[key];
        }
    }
    
    const finalAtk = Math.floor((base.atk + equipTotal.atk) * (1 + equipTotal.atkPercent / 100));
    const finalDef = Math.floor((base.def + equipTotal.def) * (1 + equipTotal.defPercent / 100));
    const finalHp = Math.floor((base.hp + equipTotal.hp) * (1 + equipTotal.hpPercent / 100));
    const finalSpd = Math.floor((base.spd + equipTotal.spd) * (1 + equipTotal.spdPercent / 100));
    
    return {
        atk: finalAtk,
        def: finalDef,
        maxHp: finalHp,
        spd: finalSpd,
        critRate: equipTotal.critRate,
        critDmg: 50 + equipTotal.critDmg
    };
}

/**
 * 防御常数
 */
const DEF_CONSTANT = 100;

/**
 * 计算防御减免
 */
function calculateDefReduction(def) {
    return 1 - def / (def + DEF_CONSTANT);
}

/**
 * 计算预期伤害
 */
function calculateExpectedDamage(atk, def, critRate = 0, critDmg = 50, skillPercent = 0) {
    const baseDamage = atk * (1 + skillPercent / 100);
    const defReduction = calculateDefReduction(def);
    const avgDamage = baseDamage * defReduction * (1 + critRate * critDmg / 10000);
    const normalDamage = baseDamage * defReduction;
    const critDamage = baseDamage * defReduction * (1 + critDmg / 100);
    
    return {
        avg: Math.floor(avgDamage),
        normal: Math.floor(normalDamage * 0.95),
        crit: Math.floor(critDamage * 1.05)
    };
}

/**
 * 怪物基础属性配置
 * 每种类型有独立的基础属性和成长系数
 * 根据玩家实际属性水平调整
 */
const MONSTER_BASE_STATS = {
    normal: {
        baseHp: 300,
        baseAtk: 50,
        baseDef: 20,
        baseSpd: 20,
        // 每等级成长
        hpPerLevel: 50,
        atkPerLevel: 18,  // 提高攻击成长，确保对高防玩家有威胁
        defPerLevel: 5,
        spdPerLevel: 2,
    },
    elite: {
        baseHp: 600,
        baseAtk: 80,
        baseDef: 40,
        baseSpd: 30,
        hpPerLevel: 80,
        atkPerLevel: 32,  // 大幅提高，精英怪应该有威胁
        defPerLevel: 8,
        spdPerLevel: 3,
    },
    miniboss: {
        baseHp: 1500,
        baseAtk: 120,
        baseDef: 80,
        baseSpd: 40,
        hpPerLevel: 120,
        atkPerLevel: 48,  // 小Boss攻击力显著提高
        defPerLevel: 12,
        spdPerLevel: 4,
    },
    boss: {
        baseHp: 3000,
        baseAtk: 180,
        baseDef: 120,
        baseSpd: 50,
        hpPerLevel: 200,
        atkPerLevel: 70,  // Boss攻击力大幅提高
        defPerLevel: 20,
        spdPerLevel: 5,
    }
};

/**
 * 计算怪物属性（独立成长系统）
 * @param {string} monsterType - 怪物类型
 * @param {number} monsterLevel - 怪物等级
 * @returns {object} 怪物属性
 */
function calculateMonsterStats(monsterType, monsterLevel) {
    const config = MONSTER_BASE_STATS[monsterType] || MONSTER_BASE_STATS.normal;
    
    // 基础属性 + 等级成长
    let hp = config.baseHp + Math.floor(config.hpPerLevel * monsterLevel);
    let atk = config.baseAtk + Math.floor(config.atkPerLevel * monsterLevel);
    let def = config.baseDef + Math.floor(config.defPerLevel * monsterLevel);
    let spd = config.baseSpd + Math.floor(config.spdPerLevel * monsterLevel);
    
    // 加入随机性 (±15%)
    const randomFactor = () => 0.85 + Math.random() * 0.30;
    hp = Math.floor(hp * randomFactor());
    atk = Math.floor(atk * randomFactor());
    def = Math.floor(def * randomFactor());
    spd = Math.floor(spd * randomFactor());
    
    return {
        maxHp: hp,
        atk: atk,
        def: def,
        spd: spd
    };
}

/**
 * 获取地图怪物的属性
 * 
 * @param {number} mapId - 地图ID（用于日志）
 * @param {string} monsterType - 怪物类型 (normal/elite/miniboss/boss)
 * @param {number} monsterLevel - 怪物等级
 * @returns {object} 怪物属性
 */
function getMonsterStatsForMap(mapId, monsterType, monsterLevel) {
    // 直接使用独立成长系统，不再依赖玩家属性
    return calculateMonsterStats(monsterType, monsterLevel);
}

/**
 * 计算战斗结果
 * @param {object} playerStats - 玩家属性
 * @param {object} monsterStats - 怪物属性
 * @param {number} skillPercent - 技能倍率（Boss战默认使用50%技能）
 * @returns {object} 战斗结果
 */
function simulateBattle(playerStats, monsterStats, skillPercent = 0) {
    // 玩家对怪物的伤害
    const playerDmg = calculateExpectedDamage(
        playerStats.atk,
        monsterStats.def,
        playerStats.critRate,
        playerStats.critDmg,
        skillPercent
    );
    
    // 怪物对玩家的伤害
    const monsterDmg = calculateExpectedDamage(monsterStats.atk, playerStats.def);
    
    // 击杀所需回合数
    const playerKillRounds = Math.ceil(monsterStats.maxHp / playerDmg.avg);
    const monsterKillRounds = Math.ceil(playerStats.maxHp / monsterDmg.avg);
    
    // 玩家总受伤
    const playerTotalDamage = monsterDmg.avg * playerKillRounds;
    const playerSurvivePercent = (playerStats.maxHp - playerTotalDamage) / playerStats.maxHp * 100;
    
    return {
        playerKillRounds,
        monsterKillRounds,
        playerWin: playerKillRounds < monsterKillRounds,
        playerSurvivePercent: Math.max(0, playerSurvivePercent),
        playerDmgPerRound: playerDmg.avg,
        monsterDmgPerRound: monsterDmg.avg
    };
}

/**
 * 打印平衡调试信息
 */
function printBalanceDebug() {
    console.log('\n========== 游戏平衡调试信息 ==========\n');
    
    for (let mapId = 1; mapId <= 6; mapId++) {
        const config = MAP_BALANCE_CONFIG[mapId];
        console.log(`\n【地图${mapId}】等级${config.levelRange[0]}-${config.levelRange[1]}`);
        
        // 三个阶段的玩家属性
        const stages = ['early', 'mid', 'final'];
        const playerStatsByStage = {};
        
        for (const stage of stages) {
            const s = config[stage];
            const stats = calculateExpectedPlayerStats(s.playerLevel, s.equipLevel, s.enhanceLevel, s.quality);
            playerStatsByStage[stage] = stats;
            console.log(`  ${stage}: Lv${s.playerLevel} 装备Lv${s.equipLevel} +${s.enhanceLevel} ${s.quality}`);
            console.log(`        ATK=${stats.atk} DEF=${stats.def} HP=${stats.maxHp} CRIT=${stats.critRate}%/${stats.critDmg}%`);
        }
        
        // 测试怪物战斗
        const avgMonsterLevel = (config.levelRange[0] + config.levelRange[1]) / 2;
        console.log(`\n  --- 战斗模拟 (怪物等级${avgMonsterLevel}) ---`);
        
        for (const type of ['normal', 'elite', 'miniboss', 'boss']) {
            const monsterStats = getMonsterStatsForMap(mapId, type, avgMonsterLevel);
            console.log(`\n  【${type}】 HP=${monsterStats.maxHp} ATK=${monsterStats.atk} DEF=${monsterStats.def}`);
            
            // 测试不同阶段的玩家
            for (const stage of stages) {
                const playerStats = playerStatsByStage[stage];
                // Boss和小Boss使用技能（50%倍率）
                const skillPercent = (type === 'boss' || type === 'miniboss') ? 50 : 0;
                const result = simulateBattle(playerStats, monsterStats, skillPercent);
                const winMark = result.playerWin ? '✓' : '✗';
                const skillMark = skillPercent > 0 ? '(技能)' : '';
                console.log(`    ${stage}玩家: ${winMark} ${result.playerKillRounds}回合击杀${skillMark}, 剩余${result.playerSurvivePercent.toFixed(0)}%血`);
            }
        }
    }
    
    console.log('\n========== 调试信息结束 ==========\n');
}

module.exports = {
    calculateExpectedPlayerStats,
    calculateMonsterStats,
    getMonsterStatsForMap,
    calculateExpectedDamage,
    getEquipLevelMultiplier,
    getEnhanceMultiplier,
    calculateDefReduction,
    simulateBattle,
    MAP_BALANCE_CONFIG,
    MONSTER_BASE_STATS,
    DEF_CONSTANT,
    printBalanceDebug
};
