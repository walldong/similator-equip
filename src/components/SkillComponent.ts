/**
 * SkillComponent - 技能组件
 * 用于存储技能数据
 */

import { Component } from '@/core/Component';
import { SkillData, SkillType, SkillTarget, EntityId } from '@/types';

export interface SkillConfig {
  name: string;
  description: string;
  type: SkillType;
  target: SkillTarget;
  rageCost: number;
  baseDamage?: number;
  damageMultiplier?: number;
  healPercent?: number;
  cooldown?: number;
  icon?: string;
}

export class SkillComponent extends Component implements SkillData {
  public readonly type = 'skill';
  public id: EntityId;
  public name: string;
  public description: string;
  public skillType: SkillType;
  public target: SkillTarget;
  public rageCost: number;
  public baseDamage: number;
  public damageMultiplier: number;
  public healPercent: number;
  public cooldown: number;
  public currentCooldown: number;
  public icon: string;

  constructor(config: SkillConfig) {
    super();
    this.id = `skill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.name = config.name;
    this.description = config.description;
    this.skillType = config.type;
    this.target = config.target;
    this.rageCost = config.rageCost;
    this.baseDamage = config.baseDamage ?? 0;
    this.damageMultiplier = config.damageMultiplier ?? 1;
    this.healPercent = config.healPercent ?? 0;
    this.cooldown = config.cooldown ?? 0;
    this.currentCooldown = 0;
    this.icon = config.icon ?? '⚔️';
  }

  /**
   * 是否可以释放技能
   */
  canUse(currentRage: number): boolean {
    return currentRage >= this.rageCost && this.currentCooldown === 0;
  }

  /**
   * 使用技能（消耗怒气，设置冷却）
   */
  use(): void {
    this.currentCooldown = this.cooldown;
  }

  /**
   * 减少冷却
   */
  reduceCooldown(): void {
    if (this.currentCooldown > 0) {
      this.currentCooldown--;
    }
  }

  /**
   * 重置冷却
   */
  resetCooldown(): void {
    this.currentCooldown = 0;
  }

  serialize(): Record<string, unknown> {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      description: this.description,
      skillType: this.skillType,
      target: this.target,
      rageCost: this.rageCost,
      baseDamage: this.baseDamage,
      damageMultiplier: this.damageMultiplier,
      healPercent: this.healPercent,
      cooldown: this.cooldown,
      currentCooldown: this.currentCooldown,
      icon: this.icon,
    };
  }

  static fromData(data: Record<string, unknown>): SkillComponent {
    return new SkillComponent({
      name: data.name as string,
      description: data.description as string,
      type: data.skillType as SkillType,
      target: data.target as SkillTarget,
      rageCost: data.rageCost as number,
      baseDamage: data.baseDamage as number,
      damageMultiplier: data.damageMultiplier as number,
      healPercent: data.healPercent as number,
      cooldown: data.cooldown as number,
      icon: data.icon as string,
    });
  }
}

export default SkillComponent;
