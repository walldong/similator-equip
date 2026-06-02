/**
 * MonsterFactory - 怪物工厂
 * 负责创建各种怪物实体
 */

import { World, Entity } from '@/core';
import { MonsterComponent, MonsterConfig, StatsComponent, PositionComponent } from '@/components';
import { MonsterType, Quality, EntityId, StatType } from '@/types';

// 基础怪物模板
const MonsterTemplates: Record<string, MonsterConfig> = {
  slime: {
    name: '史莱姆',
    icon: '🟢',
    type: 'normal',
    hp: 150,
    atk: 12,
    def: 3,
    spd: 10,
    exp: 20,
    gold: 15,
    dropRate: 35,
    qualityWeights: { normal: 80, rare: 18, epic: 2, legendary: 0, mythic: 0 },
  },
  goblin: {
    name: '哥布林',
    icon: '👺',
    type: 'normal',
    hp: 300,
    atk: 25,
    def: 10,
    spd: 18,
    exp: 35,
    gold: 25,
    dropRate: 40,
    qualityWeights: { normal: 60, rare: 30, epic: 9, legendary: 1, mythic: 0 },
  },
  skeleton: {
    name: '骷髅战士',
    icon: '💀',
    type: 'normal',
    hp: 500,
    atk: 40,
    def: 20,
    spd: 25,
    exp: 50,
    gold: 40,
    dropRate: 45,
    qualityWeights: { normal: 45, rare: 35, epic: 17, legendary: 3, mythic: 0 },
  },
  orc: {
    name: '兽人狂战',
    icon: '👹',
    type: 'normal',
    hp: 800,
    atk: 60,
    def: 35,
    spd: 20,
    exp: 80,
    gold: 70,
    dropRate: 50,
    qualityWeights: { normal: 30, rare: 40, epic: 23, legendary: 6, mythic: 1 },
  },
  dragon: {
    name: '暗影龙',
    icon: '🐉',
    type: 'boss',
    hp: 2000,
    atk: 100,
    def: 70,
    spd: 50,
    exp: 200,
    gold: 200,
    dropRate: 75,
    qualityWeights: { normal: 15, rare: 30, epic: 35, legendary: 17, mythic: 3 },
  },
  demon: {
    name: '深渊魔王',
    icon: '😈',
    type: 'boss',
    hp: 5000,
    atk: 180,
    def: 130,
    spd: 80,
    exp: 400,
    gold: 400,
    dropRate: 95,
    qualityWeights: { normal: 5, rare: 20, epic: 35, legendary: 30, mythic: 10 },
  },
};

export class MonsterFactory {
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  /**
   * 创建普通怪物
   */
  create(templateId: string): Entity {
    const template = MonsterTemplates[templateId];
    if (!template) {
      throw new Error(`Unknown monster template: ${templateId}`);
    }

    return this.createFromTemplate(template);
  }

  /**
   * 创建精英怪物
   */
  createElite(templateId: string, multiplier: number = 1.3): Entity {
    const template = MonsterTemplates[templateId];
    if (!template) {
      throw new Error(`Unknown monster template: ${templateId}`);
    }

    const eliteConfig: MonsterConfig = {
      ...template,
      name: `精英${template.name}`,
      type: 'elite',
      hp: Math.floor(template.hp * multiplier),
      atk: Math.floor(template.atk * multiplier),
      def: Math.floor(template.def * multiplier),
      exp: Math.floor(template.exp * 1.5),
      gold: Math.floor(template.gold * 1.5),
    };

    return this.createFromTemplate(eliteConfig);
  }

  /**
   * 创建Boss
   */
  createBoss(templateId: string, multiplier: number = 1.5): Entity {
    const template = MonsterTemplates[templateId];
    if (!template) {
      throw new Error(`Unknown monster template: ${templateId}`);
    }

    const bossConfig: MonsterConfig = {
      ...template,
      type: 'boss',
      hp: Math.floor(template.hp * multiplier),
      atk: Math.floor(template.atk * multiplier),
      def: Math.floor(template.def * multiplier),
      exp: Math.floor(template.exp * 2),
      gold: Math.floor(template.gold * 2),
    };

    return this.createFromTemplate(bossConfig);
  }

  /**
   * 从模板创建怪物
   */
  private createFromTemplate(config: MonsterConfig): Entity {
    const entity = this.world.createEntity();

    // 添加怪物组件
    entity.addComponent(new MonsterComponent(config));

    // 添加属性组件（用于战斗计算）
    const stats = new StatsComponent({
      hp: config.hp,
      atk: config.atk,
      def: config.def,
    });
    entity.addComponent(stats);

    return entity;
  }

  /**
   * 创建随机怪物（基于等级）
   */
  createRandom(level: number): Entity {
    // 根据等级选择合适的怪物
    let templateId: string;
    if (level <= 3) templateId = 'slime';
    else if (level <= 6) templateId = 'goblin';
    else if (level <= 10) templateId = 'skeleton';
    else if (level <= 15) templateId = 'orc';
    else templateId = 'dragon';

    const template = MonsterTemplates[templateId];
    
    // 根据等级调整属性
    const levelMult = 1 + (level - 1) * 0.1;
    const adjustedConfig: MonsterConfig = {
      ...template,
      hp: Math.floor(template.hp * levelMult),
      atk: Math.floor(template.atk * levelMult),
      def: Math.floor(template.def * levelMult),
      exp: Math.floor(template.exp * levelMult),
      gold: Math.floor(template.gold * levelMult),
    };

    return this.createFromTemplate(adjustedConfig);
  }

  /**
   * 获取所有可用模板
   */
  static getTemplateIds(): string[] {
    return Object.keys(MonsterTemplates);
  }

  /**
   * 获取模板信息
   */
  static getTemplate(id: string): MonsterConfig | undefined {
    return MonsterTemplates[id];
  }
}

export default MonsterFactory;