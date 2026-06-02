/**
 * SkillFactory - 技能工厂
 * 负责创建各种技能实体
 */

import { World, Entity } from '@/core';
import { SkillComponent, SkillConfig } from '@/components/SkillComponent';
import { SkillType, SkillTarget, EntityId } from '@/types';

/**
 * 预设技能配置
 */
export const SkillTemplates: Record<string, SkillConfig> = {
  // 玩家技能
  heavyStrike: {
    name: '重击',
    description: '造成150%攻击力的伤害',
    type: 'attack',
    target: 'enemy',
    rageCost: 30,
    damageMultiplier: 1.5,
    icon: '⚔️',
  },
  whirlwind: {
    name: '旋风斩',
    description: '造成200%攻击力的伤害',
    type: 'attack',
    target: 'enemy',
    rageCost: 50,
    damageMultiplier: 2.0,
    icon: '🌀',
  },
  criticalBlow: {
    name: '致命一击',
    description: '造成300%攻击力的伤害，必定暴击',
    type: 'attack',
    target: 'enemy',
    rageCost: 80,
    damageMultiplier: 3.0,
    icon: '💥',
  },
  healingLight: {
    name: '治愈之光',
    description: '恢复30%最大生命值',
    type: 'heal',
    target: 'self',
    rageCost: 40,
    healPercent: 30,
    icon: '💚',
  },
  battleRoar: {
    name: '战吼',
    description: '造成250%攻击力的伤害，并恢复20%生命值',
    type: 'ultimate',
    target: 'enemy',
    rageCost: 100,
    damageMultiplier: 2.5,
    healPercent: 20,
    icon: '🔥',
  },
  berserk: {
    name: '狂暴',
    description: '造成400%攻击力的伤害',
    type: 'ultimate',
    target: 'enemy',
    rageCost: 100,
    damageMultiplier: 4.0,
    icon: '😈',
  },
  
  // 怪物技能
  monsterBite: {
    name: '撕咬',
    description: '造成120%攻击力的伤害',
    type: 'attack',
    target: 'enemy',
    rageCost: 25,
    damageMultiplier: 1.2,
    icon: '🦷',
  },
  monsterSlam: {
    name: '猛击',
    description: '造成180%攻击力的伤害',
    type: 'attack',
    target: 'enemy',
    rageCost: 50,
    damageMultiplier: 1.8,
    icon: '👊',
  },
  bossRage: {
    name: 'Boss怒击',
    description: '造成300%攻击力的伤害',
    type: 'ultimate',
    target: 'enemy',
    rageCost: 80,
    damageMultiplier: 3.0,
    icon: '💀',
  },
};

/**
 * 默认玩家技能列表
 */
export const DefaultPlayerSkills = ['heavyStrike', 'whirlwind', 'criticalBlow', 'healingLight', 'battleRoar'];

/**
 * 怪物技能映射（按怪物类型）
 */
export const MonsterSkillMap: Record<string, string[]> = {
  normal: ['monsterBite'],
  elite: ['monsterBite', 'monsterSlam'],
  boss: ['monsterBite', 'monsterSlam', 'bossRage'],
};

export class SkillFactory {
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  /**
   * 创建技能
   */
  create(templateId: string): Entity {
    const template = SkillTemplates[templateId];
    if (!template) {
      throw new Error(`Unknown skill template: ${templateId}`);
    }

    return this.createFromConfig(template);
  }

  /**
   * 从配置创建技能
   */
  createFromConfig(config: SkillConfig): Entity {
    const entity = this.world.createEntity();
    const skillComp = new SkillComponent(config);
    entity.addComponent(skillComp);
    return entity;
  }

  /**
   * 创建玩家默认技能
   */
  createPlayerDefaultSkills(): Entity[] {
    return DefaultPlayerSkills.map(id => this.create(id));
  }

  /**
   * 创建怪物技能
   */
  createMonsterSkills(monsterType: 'normal' | 'elite' | 'boss'): Entity[] {
    const skillIds = MonsterSkillMap[monsterType] || ['monsterBite'];
    return skillIds.map(id => this.create(id));
  }

  /**
   * 获取技能模板
   */
  static getTemplate(id: string): SkillConfig | undefined {
    return SkillTemplates[id];
  }

  /**
   * 获取所有技能模板ID
   */
  static getAllTemplateIds(): string[] {
    return Object.keys(SkillTemplates);
  }
}

export default SkillFactory;
