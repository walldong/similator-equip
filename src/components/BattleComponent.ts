/**
 * BattleComponent - 战斗组件
 * 用于存储战斗状态（回合制）
 */

import { Component } from '@/core/Component';
import { BattleLog, BattleResult, EntityId, TurnInfo, RoundResult, AttackResult } from '@/types';

export class BattleComponent extends Component {
  public readonly type = 'battle';
  public isActive: boolean;
  public playerEntityId: EntityId | null;
  public monsterEntityId: EntityId | null;
  public logs: BattleLog[];
  public result: BattleResult | null;

  // 回合制战斗相关
  public currentRound: number;           // 当前回合数
  public playerRage: number;             // 玩家怒气值 (0-100)
  public monsterRage: number;            // 怪物怒气值 (0-100)
  public turnQueue: TurnInfo[];          // 攻击顺序队列
  public currentTurnIndex: number;       // 当前攻击索引
  public roundResults: RoundResult[];    // 每回合结果记录

  // 玩家技能列表
  public playerSkillIds: EntityId[];     // 玩家可用技能ID列表
  public selectedSkillId: EntityId | null; // 当前选择的技能

  constructor() {
    super();
    this.isActive = false;
    this.playerEntityId = null;
    this.monsterEntityId = null;
    this.logs = [];
    this.result = null;
    this.currentRound = 0;
    this.playerRage = 0;
    this.monsterRage = 0;
    this.turnQueue = [];
    this.currentTurnIndex = 0;
    this.roundResults = [];
    this.playerSkillIds = [];
    this.selectedSkillId = null;
  }

  /**
   * 开始战斗
   */
  start(playerId: EntityId, monsterId: EntityId, playerSkills: EntityId[] = []): void {
    this.isActive = true;
    this.playerEntityId = playerId;
    this.monsterEntityId = monsterId;
    this.logs = [];
    this.result = null;
    this.currentRound = 0;
    this.playerRage = 0;
    this.monsterRage = 0;
    this.turnQueue = [];
    this.currentTurnIndex = 0;
    this.roundResults = [];
    this.playerSkillIds = playerSkills;
    this.selectedSkillId = null;
  }

  /**
   * 添加战斗日志
   */
  addLog(text: string, type: BattleLog['type']): void {
    this.logs.push({ text, type });
  }

  /**
   * 结束战斗
   */
  end(victory: boolean, exp: number, gold: number, drops: EntityId[] = []): void {
    this.result = { victory, exp, gold, drops };
    this.isActive = false;
  }

  /**
   * 设置攻击顺序
   */
  setTurnQueue(queue: TurnInfo[]): void {
    this.turnQueue = queue;
    this.currentTurnIndex = 0;
  }

  /**
   * 获取当前攻击方
   */
  getCurrentTurn(): TurnInfo | null {
    if (this.currentTurnIndex < this.turnQueue.length) {
      return this.turnQueue[this.currentTurnIndex];
    }
    return null;
  }

  /**
   * 下一个攻击方
   */
  nextTurn(): TurnInfo | null {
    this.currentTurnIndex++;
    return this.getCurrentTurn();
  }

  /**
   * 是否回合结束（所有攻击完成）
   */
  isRoundEnd(): boolean {
    return this.currentTurnIndex >= this.turnQueue.length;
  }

  /**
   * 开始新回合
   */
  startNewRound(): void {
    this.currentRound++;
    this.currentTurnIndex = 0;
    this.selectedSkillId = null;
  }

  /**
   * 增加玩家怒气
   */
  addPlayerRage(amount: number): void {
    this.playerRage = Math.min(100, this.playerRage + amount);
    this.addLog(`🔥 怒气 +${amount}，当前: ${this.playerRage}%`, 'rage');
  }

  /**
   * 增加怪物怒气
   */
  addMonsterRage(amount: number): void {
    this.monsterRage = Math.min(100, this.monsterRage + amount);
  }

  /**
   * 消耗玩家怒气
   */
  consumePlayerRage(amount: number): boolean {
    if (this.playerRage >= amount) {
      this.playerRage -= amount;
      return true;
    }
    return false;
  }

  /**
   * 记录回合结果
   */
  recordRoundResult(result: RoundResult): void {
    this.roundResults.push(result);
  }

  /**
   * 选择技能
   */
  selectSkill(skillId: EntityId): void {
    this.selectedSkillId = skillId;
  }

  /**
   * 清除选择的技能
   */
  clearSelectedSkill(): void {
    this.selectedSkillId = null;
  }

  /**
   * 清理战斗状态
   */
  clear(): void {
    this.isActive = false;
    this.playerEntityId = null;
    this.monsterEntityId = null;
    this.logs = [];
    this.result = null;
    this.currentRound = 0;
    this.playerRage = 0;
    this.monsterRage = 0;
    this.turnQueue = [];
    this.currentTurnIndex = 0;
    this.roundResults = [];
    this.playerSkillIds = [];
    this.selectedSkillId = null;
  }

  serialize(): Record<string, unknown> {
    return {
      type: this.type,
      isActive: this.isActive,
      playerEntityId: this.playerEntityId,
      monsterEntityId: this.monsterEntityId,
      logs: this.logs,
      result: this.result,
      currentRound: this.currentRound,
      playerRage: this.playerRage,
      monsterRage: this.monsterRage,
      playerSkillIds: this.playerSkillIds,
      selectedSkillId: this.selectedSkillId,
    };
  }

  static fromData(data: Record<string, unknown>): BattleComponent {
    const component = new BattleComponent();
    component.isActive = data.isActive as boolean ?? false;
    component.playerEntityId = data.playerEntityId as EntityId | null;
    component.monsterEntityId = data.monsterEntityId as EntityId | null;
    component.logs = data.logs as BattleLog[] ?? [];
    component.result = data.result as BattleResult | null;
    component.currentRound = data.currentRound as number ?? 0;
    component.playerRage = data.playerRage as number ?? 0;
    component.monsterRage = data.monsterRage as number ?? 0;
    component.playerSkillIds = data.playerSkillIds as EntityId[] ?? [];
    component.selectedSkillId = data.selectedSkillId as EntityId | null;
    return component;
  }
}

export default BattleComponent;
