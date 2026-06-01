/**
 * 游戏数据定义 - 词条系统
 */

// ==================== 词条类型定义 ====================

const StatType = {
    // 基础属性
    ATK_PERCENT: 'ATK_PERCENT',       // 攻击力%
    ATK_FLAT: 'ATK_FLAT',             // 攻击力（固定）
    DEF_PERCENT: 'DEF_PERCENT',       // 防御力%
    DEF_FLAT: 'DEF_FLAT',             // 防御力（固定）
    HP_FLAT: 'HP_FLAT',               // 生命值
    HP_PERCENT: 'HP_PERCENT',         // 生命值%
    SPD_FLAT: 'SPD_FLAT',             // 速度
    SPD_PERCENT: 'SPD_PERCENT',       // 速度%
    
    // 暴击相关
    CRIT_RATE: 'CRIT_RATE',           // 暴击率
    CRIT_DMG: 'CRIT_DMG',             // 暴击伤害%
    
    // 部位特有词条
    STRENGTH: 'STRENGTH',             // 力量（武器特有）
    MOVE_SPEED: 'MOVE_SPEED',         // 移动速度（鞋子特有）
    SKILL_CD: 'SKILL_CD',             // 技能冷却（头盔特有）
    ARMOR: 'ARMOR',                   // 护甲（护手特有）
};

// 词条显示名称
const StatNames = {
    ATK_PERCENT: '攻击力',
    ATK_FLAT: '攻击力',
    DEF_PERCENT: '防御力',
    DEF_FLAT: '防御力',
    HP_FLAT: '生命值',
    HP_PERCENT: '生命值',
    SPD_FLAT: '速度',
    SPD_PERCENT: '速度',
    CRIT_RATE: '暴击率',
    CRIT_DMG: '暴击伤害',
    STRENGTH: '力量',
    MOVE_SPEED: '移动速度',
    SKILL_CD: '技能冷却',
    ARMOR: '护甲',
};

// 百分比类型词条（显示时带%）
// 百分比类型词条（显示时带%）
const PercentStats = [
    'ATK_PERCENT', 'DEF_PERCENT', 'HP_PERCENT', 'SPD_PERCENT',
    'CRIT_RATE', 'CRIT_DMG', 'SKILL_CD', 'MOVE_SPEED'
];

// ==================== 词条基础数值 ====================

const AffixBaseValues = {
    ATK_PERCENT: 5,      // 攻击力% 基础值
    ATK_FLAT: 15,        // 攻击力 基础值
    DEF_PERCENT: 5,      // 防御力% 基础值
    DEF_FLAT: 12,        // 防御力 基础值
    HP_FLAT: 80,         // 生命值 基础值
    HP_PERCENT: 5,       // 生命值% 基础值
    SPD_FLAT: 8,         // 速度 基础值
    SPD_PERCENT: 4,      // 速度% 基础值
    CRIT_RATE: 4,        // 暴击率 基础值
    CRIT_DMG: 8,         // 暴击伤害 基础值
    STRENGTH: 10,        // 力量 基础值
    MOVE_SPEED: 6,       // 移动速度 基础值
    SKILL_CD: 5,         // 技能冷却 基础值
    ARMOR: 15,           // 护甲 基础值
};

// ==================== 主词条配置（固定） ====================

// 每个部位的主词条是固定的
const MainAffixBySlot = {
    weapon: StatType.ATK_PERCENT,      // 武器：百分比攻击力
    chestplate: StatType.DEF_PERCENT,  // 胸甲：百分比防御
    helmet: StatType.DEF_FLAT,         // 头盔：固定防御
    boots: StatType.SPD_FLAT,          // 鞋子：固定速度
    gloves: StatType.ATK_FLAT,         // 护手：固定攻击力
    accessory: StatType.CRIT_DMG,      // 首饰：百分比暴击伤害
};

// ==================== 副词条配置 ====================

// 通用副词条池（所有部位共享）
const CommonSubAffixes = [
    { stat: StatType.ATK_FLAT, weight: 15 },
    { stat: StatType.ATK_PERCENT, weight: 8 },
    { stat: StatType.DEF_FLAT, weight: 12 },
    { stat: StatType.DEF_PERCENT, weight: 6 },
    { stat: StatType.HP_FLAT, weight: 14 },
    { stat: StatType.HP_PERCENT, weight: 8 },
    { stat: StatType.SPD_FLAT, weight: 10 },
    { stat: StatType.SPD_PERCENT, weight: 5 },
    { stat: StatType.CRIT_RATE, weight: 8 },
    { stat: StatType.CRIT_DMG, weight: 6 },
];

// 部位特有副词条池（只能在该部位出现）
const SlotSpecificSubAffixes = {
    weapon: [
        { stat: StatType.STRENGTH, weight: 40 },      // 力量（武器特有）
    ],
    boots: [
        { stat: StatType.MOVE_SPEED, weight: 40 },    // 移动速度（鞋子特有）
    ],
    helmet: [
        { stat: StatType.SKILL_CD, weight: 40 },      // 技能冷却（头盔特有）
    ],
    gloves: [
        { stat: StatType.ARMOR, weight: 40 },         // 护甲（护手特有）
    ],
    accessory: [
        { stat: StatType.CRIT_RATE, weight: 40 },     // 暴击率（首饰特有，额外暴击）
    ],
    chestplate: [
        { stat: StatType.HP_FLAT, weight: 40 },       // 生命值（胸甲特有，额外生命）
        { stat: StatType.HP_PERCENT, weight: 20 },    // 生命值%
    ],
};

// ==================== 装备槽位配置 ====================

const EquipmentSlot = {
    WEAPON: 'weapon',
    HELMET: 'helmet',
    CHESTPLATE: 'chestplate',
    GLOVES: 'gloves',
    BOOTS: 'boots',
    ACCESSORY: 'accessory'
};

const SlotNames = {
    weapon: '武器',
    helmet: '头盔',
    chestplate: '胸甲',
    gloves: '护手',
    boots: '鞋子',
    accessory: '首饰'
};

const SlotIcons = {
    weapon: '⚔️',
    helmet: '🪖',
    chestplate: '🛡️',
    gloves: '🧤',
    boots: '👢',
    accessory: '💍'
};

// ==================== 品质配置 ====================

const Quality = {
    NORMAL: 'normal',
    RARE: 'rare',
    EPIC: 'epic',
    LEGENDARY: 'legendary',
    MYTHIC: 'mythic'
};

const QualityNames = {
    normal: '普通',
    rare: '稀有',
    epic: '史诗',
    legendary: '传说',
    mythic: '神话'
};

const QualityColors = {
    normal: '#9e9e9e',
    rare: '#4fc3f7',
    epic: '#ba68c8',
    legendary: '#ff9800',
    mythic: '#ff4444'
};

// 品质倍率
const QualityMultipliers = {
    normal: 1.0,
    rare: 1.2,
    epic: 1.5,
    legendary: 2.0,
    mythic: 3.0
};

// 品质对应的副词条数量（主词条固定1个，副词条4个）
const QualitySubAffixCount = {
    normal: 4,      // 4条副词条
    rare: 4,        // 4条副词条
    epic: 4,        // 4条副词条
    legendary: 4,   // 4条副词条
    mythic: 4       // 4条副词条
};

// 品质影响词条数值倍率
const QualityValueMultiplier = {
    normal: 1.0,
    rare: 1.3,
    epic: 1.6,
    legendary: 2.0,
    mythic: 2.5
};

// 品质掉落权重
const QualityDropRates = {
    normal: 60,
    rare: 25,
    epic: 10,
    legendary: 4,
    mythic: 1
};

// ==================== 强化配置 ====================

const EnhanceSuccessRates = {
    0: 100, 1: 95, 2: 90, 3: 85, 4: 80,
    5: 75, 6: 70, 7: 65, 8: 60, 9: 55,
    10: 50, 11: 45, 12: 40, 13: 35, 14: 30,
    15: 25, 16: 20, 17: 15, 18: 10, 19: 5, 20: 3
};

const EnhanceUpgradeLevels = [3, 6, 9, 12, 15, 18, 21];

// ==================== 怪物配置 ====================

const Monsters = [
    {
        id: 'slime',
        name: '史莱姆',
        icon: '🟢',
        hp: 150,
        atk: 12,
        def: 3,
        exp: 20,
        gold: 15,
        dropRate: 35,
        qualityWeights: { normal: 80, rare: 18, epic: 2, legendary: 0, mythic: 0 }
    },
    {
        id: 'goblin',
        name: '哥布林',
        icon: '👺',
        hp: 300,
        atk: 25,
        def: 10,
        exp: 35,
        gold: 25,
        dropRate: 40,
        qualityWeights: { normal: 60, rare: 30, epic: 9, legendary: 1, mythic: 0 }
    },
    {
        id: 'skeleton',
        name: '骷髅战士',
        icon: '💀',
        hp: 500,
        atk: 40,
        def: 20,
        exp: 50,
        gold: 40,
        dropRate: 45,
        qualityWeights: { normal: 45, rare: 35, epic: 17, legendary: 3, mythic: 0 }
    },
    {
        id: 'orc',
        name: '兽人狂战',
        icon: '👹',
        hp: 800,
        atk: 60,
        def: 35,
        exp: 80,
        gold: 70,
        dropRate: 50,
        qualityWeights: { normal: 30, rare: 40, epic: 23, legendary: 6, mythic: 1 }
    },
    {
        id: 'dragon',
        name: '暗影龙',
        icon: '🐉',
        hp: 2000,
        atk: 100,
        def: 70,
        exp: 200,
        gold: 200,
        dropRate: 75,
        qualityWeights: { normal: 15, rare: 30, epic: 35, legendary: 17, mythic: 3 }
    },
    {
        id: 'demon',
        name: '深渊魔王',
        icon: '😈',
        hp: 5000,
        atk: 180,
        def: 130,
        exp: 400,
        gold: 400,
        dropRate: 95,
        qualityWeights: { normal: 5, rare: 20, epic: 35, legendary: 30, mythic: 10 }
    }
];

// ==================== 副本配置 ====================

const MapConfig = {
    small: { width: 20, height: 20, wallDensity: 0.15, monsterCount: 8, eliteCount: 2, bossCount: 1 },
    medium: { width: 50, height: 50, wallDensity: 0.18, monsterCount: 25, eliteCount: 5, bossCount: 2 },
    large: { width: 100, height: 100, wallDensity: 0.2, monsterCount: 50, eliteCount: 10, bossCount: 3 }
};

const Dungeons = [
    {
        id: 'forest',
        name: '迷雾森林',
        icon: '🌲',
        level: 1,
        width: 5,
        height: 5,
        monsters: ['slime', 'slime', 'goblin'],
        boss: 'goblin',
        bossName: '哥布林首领',
        bossIcon: '👺',
        mapTemplate: [
            ['W','W','W','W','W'],
            ['W','S','P','M','W'],
            ['W','W','P','W','W'],
            ['W','M','P','M','W'],
            ['W','W','B','W','W']
        ]
    },
    {
        id: 'cave',
        name: '幽暗洞穴',
        icon: '🕳️',
        level: 5,
        width: 5,
        height: 5,
        monsters: ['skeleton', 'skeleton', 'goblin'],
        boss: 'skeleton',
        bossName: '骷髅王',
        bossIcon: '💀',
        mapTemplate: [
            ['W','W','W','W','W'],
            ['W','S','P','M','W'],
            ['W','W','P','W','W'],
            ['W','M','P','B','W'],
            ['W','W','W','W','W']
        ]
    },
    {
        id: 'fortress',
        name: '兽人要塞',
        icon: '🏰',
        level: 10,
        width: 7,
        height: 5,
        monsters: ['orc', 'skeleton', 'goblin'],
        boss: 'orc',
        bossName: '兽人统领',
        bossIcon: '👹',
        mapTemplate: [
            ['W','W','W','W','W','W','W'],
            ['W','S','P','E','P','M','W'],
            ['W','W','W','P','W','W','W'],
            ['W','M','P','P','P','B','W'],
            ['W','W','W','W','W','W','W']
        ]
    },
    {
        id: 'lair',
        name: '龙之巢穴',
        icon: '🐉',
        level: 15,
        width: 7,
        height: 6,
        monsters: ['orc', 'orc', 'skeleton'],
        boss: 'dragon',
        bossName: '暗影龙',
        bossIcon: '🐉',
        mapTemplate: [
            ['W','W','W','W','W','W','W'],
            ['W','S','P','M','P','E','W'],
            ['W','W','W','P','W','W','W'],
            ['W','M','P','P','P','M','W'],
            ['W','W','W','B','W','W','W'],
            ['W','W','W','W','W','W','W']
        ]
    },
    {
        id: 'abyss',
        name: '深渊魔殿',
        icon: '🌋',
        level: 20,
        width: 7,
        height: 7,
        monsters: ['dragon', 'orc', 'orc'],
        boss: 'demon',
        bossName: '深渊魔王',
        bossIcon: '😈',
        mapTemplate: [
            ['W','W','W','W','W','W','W'],
            ['W','S','P','M','P','E','W'],
            ['W','W','W','P','W','W','W'],
            ['W','E','P','P','P','E','W'],
            ['W','W','W','P','W','W','W'],
            ['W','M','P','B','P','M','W'],
            ['W','W','W','W','W','W','W']
        ]
    }
];

// ==================== 玩家基础属性 ====================

const BasePlayerStats = {
    hp: 200,
    atk: 20,
    def: 10,
    spd: 15,
    critRate: 5,
    critDmg: 150
};

// ==================== 词条生成函数 ====================

/**
 * 生成主词条（固定类型）
 */
function generateMainAffix(slot, level, quality) {
    const stat = MainAffixBySlot[slot];
    if (!stat) return null;
    
    const baseValue = AffixBaseValues[stat] || 5;
    const qualityMult = QualityValueMultiplier[quality] || 1.0;
    const levelMult = 1 + Math.max(0, level) * 0.12;
    
    const value = Math.max(1, Math.floor(baseValue * qualityMult * levelMult));
    
    return { stat, value };
}

/**
 * 生成副词条（4条，包含部位特有词条）
 */
function generateSubAffixes(slot, level, quality, existingStats = []) {
    const result = [];
    const usedStats = new Set(existingStats.filter(s => s)); // 过滤掉undefined/null
    
    // 合并通用词条和部位特有词条
    const allAffixes = [
        ...CommonSubAffixes,
        ...(SlotSpecificSubAffixes[slot] || [])
    ];
    
    // 过滤已使用的词条
    const availableAffixes = allAffixes.filter(a => !usedStats.has(a.stat));
    
    // 生成4条副词条
    const count = 4;
    
    for (let i = 0; i < count && availableAffixes.length > 0; i++) {
        // 计算总权重
        const totalWeight = availableAffixes.reduce((sum, a) => sum + a.weight, 0);
        let roll = Math.floor(Math.random() * totalWeight) + 1;
        
        let selectedStat = availableAffixes[0].stat;
        let selectedIndex = 0;
        
        for (let j = 0; j < availableAffixes.length; j++) {
            roll -= availableAffixes[j].weight;
            if (roll <= 0) {
                selectedStat = availableAffixes[j].stat;
                selectedIndex = j;
                break;
            }
        }
        
        // 计算数值（添加安全检查）
        const baseValue = AffixBaseValues[selectedStat];
        const qualityMult = QualityValueMultiplier[quality] || 1.0;
        const levelMult = 1 + Math.max(0, level) * 0.06;
        const variance = 0.8 + Math.random() * 0.4; // 80%~120%波动
        
        // 确保所有值都有效
        const value = Math.max(1, Math.floor((baseValue || 5) * qualityMult * levelMult * variance));
        
        result.push({ stat: selectedStat, value });
        usedStats.add(selectedStat);
        
        // 从可用列表移除（避免重复）
        availableAffixes.splice(selectedIndex, 1);
    }
    
    return result;
}

/**
 * 升级随机副词条
 */
function upgradeRandomSubAffix(subAffixes, minPercent = 20, maxPercent = 50) {
    if (!subAffixes || subAffixes.length === 0) return null;
    
    const index = Math.floor(Math.random() * subAffixes.length);
    const affix = subAffixes[index];
    const percent = minPercent + Math.floor(Math.random() * (maxPercent - minPercent));
    const increase = Math.ceil(affix.value * percent / 100);
    affix.value += increase;
    
    return { index, stat: affix.stat, oldValue: affix.value - increase, newValue: affix.value };
}

/**
 * 格式化词条显示
 */
function formatAffixValue(stat, value) {
    if (PercentStats.includes(stat)) {
        return value + '%';
    }
    return value;
}

/**
 * 获取词条完整显示文本
 */
function getAffixDisplayText(stat, value) {
    const name = StatNames[stat] || stat;
    const formattedValue = formatAffixValue(stat, value);
    return `${name} +${formattedValue}`;
}

// ==================== 导出 ====================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        StatType,
        StatNames,
        PercentStats,
        AffixBaseValues,
        MainAffixBySlot,
        CommonSubAffixes,
        SlotSpecificSubAffixes,
        EquipmentSlot,
        SlotNames,
        SlotIcons,
        Quality,
        QualityNames,
        QualityColors,
        QualityMultipliers,
        QualitySubAffixCount,
        QualityValueMultiplier,
        QualityDropRates,
        EnhanceSuccessRates,
        EnhanceUpgradeLevels,
        Monsters,
        MapConfig,
        Dungeons,
        BasePlayerStats,
        generateMainAffix,
        generateSubAffixes,
        upgradeRandomSubAffix,
        formatAffixValue,
        getAffixDisplayText
    };
}