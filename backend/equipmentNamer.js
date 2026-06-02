/**
 * 装备命名系统
 * 前缀 + 后缀组合
 * 某些前缀绑定特定的副词条
 */

// ==================== 前缀系统 ====================

const PREFIX_WITH_AFFIX = {
  // 攻击类前缀
  '毁灭': { affix: { stat: 'critRate', minValue: 3, maxValue: 8 }, qualityBonus: ['rare', 'epic', 'legendary', 'mythic'] },
  '狂暴': { affix: { stat: 'critDmg', minValue: 10, maxValue: 25 }, qualityBonus: ['rare', 'epic', 'legendary', 'mythic'] },
  '致命': { affix: { stat: 'atk', minValue: 5, maxValue: 15 }, qualityBonus: ['rare', 'epic', 'legendary', 'mythic'] },
  '锋利': { affix: { stat: 'atk', minValue: 3, maxValue: 10 }, qualityBonus: ['normal', 'rare', 'epic'] },
  
  // 防御类前缀
  '永恒': { affix: { stat: 'def', minValue: 5, maxValue: 20 }, qualityBonus: ['rare', 'epic', 'legendary', 'mythic'] },
  '坚毅': { affix: { stat: 'def', minValue: 3, maxValue: 12 }, qualityBonus: ['normal', 'rare', 'epic'] },
  '守护': { affix: { stat: 'maxHp', minValue: 50, maxValue: 200 }, qualityBonus: ['rare', 'epic', 'legendary'] },
  '不屈': { affix: { stat: 'maxHp', minValue: 30, maxValue: 100 }, qualityBonus: ['normal', 'rare'] },
  
  // 速度类前缀
  '疾风': { affix: { stat: 'spd', minValue: 5, maxValue: 15 }, qualityBonus: ['rare', 'epic', 'legendary', 'mythic'] },
  '迅捷': { affix: { stat: 'spd', minValue: 2, maxValue: 8 }, qualityBonus: ['normal', 'rare'] },
  
  // 暴击类前缀
  '天赐': { affix: { stat: 'critRate', minValue: 2, maxValue: 6 }, qualityBonus: ['normal', 'rare', 'epic'] },
  '雷霆': { affix: { stat: 'critDmg', minValue: 8, maxValue: 20 }, qualityBonus: ['rare', 'epic'] },
  
  // 生命类前缀
  '生命': { affix: { stat: 'maxHp', minValue: 20, maxValue: 80 }, qualityBonus: ['normal', 'rare'] },
  '复苏': { affix: { stat: 'maxHp', minValue: 40, maxValue: 150 }, qualityBonus: ['rare', 'epic', 'legendary'] },
};

// 随机装饰性前缀（不绑定词条）
const RANDOM_PREFIXES = [
  '黑暗', '光明', '神圣', '邪恶', '混沌',
  '火焰', '冰霜', '雷电', '风暴', '大地',
  '星辰', '月光', '日光', '暗影', '烈阳',
  '深渊', '天堂', '地狱', '虚空', '幻影',
  '远古', '神秘', '传说', '荣耀', '王者',
  '勇士', '英雄', '圣者', '魔神', '天使',
  '龙血', '恶魔', '天使', '精灵', '矮人',
];

// ==================== 后缀系统 ====================
// 简洁的后缀名称，直接跟在前缀后面

const SUFFIXES = {
  weapon: ['之剑', '之刃', '之斧', '之锤', '之矛', '之弓', '杀手', '收割者', '审判'],
  helmet: ['之冠', '之盔', '之帽', '之罩', '王冠', '面具', '兜帽'],
  chestplate: ['之铠', '之甲', '之盾', '战甲', '圣铠', '魔甲', '龙铠'],
  gloves: ['之拳', '之手', '之爪', '护手', '拳套', '手甲'],
  boots: ['之靴', '之鞋', '之履', '战靴', '长靴', '铁靴', '追风'],
  accessory: ['之环', '之链', '之坠', '之符', '项链', '戒指', '护符', '玉佩'],
};

// 特殊后缀（仅用于高品质装备）
const SPECIAL_SUFFIX = {
  legendary: ['神器', '圣器', '魔器'],
  mythic: ['神器', '创世', '永恒', '不朽'],
};

// ==================== 强化等级规则 ====================

const ENHANCE_LEVEL_BY_QUALITY = {
  normal: { min: 0, max: 0, chance: 0 },
  rare: { min: 0, max: 2, chance: 20 },
  epic: { min: 0, max: 4, chance: 30 },
  legendary: { min: 1, max: 6, chance: 50 },
  mythic: { min: 2, max: 8, chance: 70 },
};

// ==================== 主函数 ====================

/**
 * 生成装备名称和可能的固定词条
 */
function generateEquipmentName(slot, quality) {
  let prefix = '';
  let fixedAffix = null;
  
  // 1. 选择前缀
  const canUseFixedPrefix = ['rare', 'epic', 'legendary', 'mythic'].includes(quality);
  const useFixedPrefix = canUseFixedPrefix && Math.random() < 0.5;
  
  if (useFixedPrefix) {
    const availablePrefixes = Object.entries(PREFIX_WITH_AFFIX)
      .filter(([_, config]) => config.qualityBonus.includes(quality));
    
    if (availablePrefixes.length > 0) {
      const [p, config] = availablePrefixes[Math.floor(Math.random() * availablePrefixes.length)];
      prefix = p;
      
      const value = randomInt(config.affix.minValue, config.affix.maxValue);
      const qualityMultiplier = getQualityMultiplier(quality);
      fixedAffix = {
        stat: config.affix.stat,
        value: Math.ceil(value * qualityMultiplier),
      };
    }
  } else if (Math.random() < 0.5) {
    // 使用随机装饰性前缀
    prefix = RANDOM_PREFIXES[Math.floor(Math.random() * RANDOM_PREFIXES.length)];
  }
  
  // 2. 选择后缀
  let suffix;
  const normalSuffixes = SUFFIXES[slot] || ['之物'];
  
  // 高品质装备有概率使用特殊后缀
  if (SPECIAL_SUFFIX[quality] && Math.random() < 0.15) {
    suffix = SPECIAL_SUFFIX[quality][Math.floor(Math.random() * SPECIAL_SUFFIX[quality].length)];
  } else {
    suffix = normalSuffixes[Math.floor(Math.random() * normalSuffixes.length)];
  }
  
  // 3. 组合名称
  let name;
  if (prefix && suffix) {
    name = prefix + suffix;
  } else if (suffix) {
    // 如果没有前缀，使用默认名称
    if (suffix.startsWith('之')) {
      // 用默认名称代替单字
      name = getDefaultName(slot);
    } else {
      name = suffix;
    }
  } else {
    name = getDefaultName(slot);
  }
  
  // 4. 确定强化等级
  const enhanceConfig = ENHANCE_LEVEL_BY_QUALITY[quality];
  let enhanceLevel = 0;
  
  if (Math.random() < enhanceConfig.chance / 100) {
    enhanceLevel = randomInt(enhanceConfig.min, enhanceConfig.max);
  }
  
  return { name, fixedAffix, enhanceLevel };
}

function getQualityMultiplier(quality) {
  const multipliers = {
    normal: 1,
    rare: 1.2,
    epic: 1.5,
    legendary: 2,
    mythic: 2.5,
  };
  return multipliers[quality] || 1;
}

function getDefaultName(slot) {
  const defaults = {
    weapon: '长剑',
    helmet: '头盔',
    chestplate: '铠甲',
    gloves: '护手',
    boots: '战靴',
    accessory: '项链',
  };
  return defaults[slot] || '装备';
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = {
  generateEquipmentName,
  PREFIX_WITH_AFFIX,
  RANDOM_PREFIXES,
  SUFFIXES,
};