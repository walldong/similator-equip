/**
 * BattleSystem - 回合制战斗系统
 * 处理战斗逻辑
 */

import { System } from '@/core/System';
import { StatsComponent, MonsterComponent, BattleComponent, SkillComponent } from '@/components';
import { Entity, World } from '@/core';
import { EntityId, EventType, TurnInfo, RoundResult, AttackResult } from '@/types';
import { RandomUtil } from '@/lib/RandomUtil';
import { DropSystem } from './DropSystem';
import { SkillFactory, SkillTemplates } from '@/factories/SkillFactory';

export class BattleSystem extends System {
  private dropSystem: DropSystem | null = null;
  private skillFactory: SkillFactory | null = null;

  constructor() {
    super('battle', ['battle'], 30);
  }

  init(world: World): void {
    super.init(world);
    this.dropSystem = new DropSystem();
    this.dropSystem.init(world);
    this.skillFactory = new SkillFactory(world);
    this.on(EventType.BATTLE_START, this.handleBattleStart.bind(this));
  }

  /**
   * 处理战斗开始
   */
  private handleBattleStart(payload: Record<string, unknown>): void {
    const { playerId, monsterId, playerLevel } = payload as { 
      playerId: EntityId; 
      monsterId: EntityId;
      playerLevel?: number;
    };
    this.startBattle(playerId, monsterId, playerLevel);
  }

  /**
   * 开始战斗
   */
  startBattle(playerId: EntityId, monsterId: EntityId, playerLevel: number = 1): void {
    if (!this.world) return;

    const player = this.world.getEntity(playerId);
    const monster = this.world.getEntity(monsterId);
    if (!player || !monster) return;

    // 创建战斗实体
    const battleEntity = this.world.createEntity();
    const battleComp = new BattleComponent();

    // 创建玩家技能
    const playerSkills = this.skillFactory!.createPlayerDefaultSkills();
    const playerSkillIds = playerSkills.map(e => e.id);

    battleComp.start(playerId, monsterId, playerSkillIds);
    battleEntity.addComponent(battleComp);

    // 计算攻击顺序
    this.calculateTurnOrder(battleComp, player, monster);

    battleComp.addLog(`⚔️ 战斗开始！`, 'player');
    battleComp.addLog(`📊 第 1 回合`, 'player');
  }

  /**
   * 计算攻击顺序（根据攻速比值分配攻击次数）
   */
  calculateTurnOrder(battleComp: BattleComponent, player: Entity, monster: Entity): void {
    const playerStats = player.getComponent<StatsComponent>('stats');
    const monsterStats = monster.getComponent<MonsterComponent>('monster');

    if (!playerStats || !monsterStats) return;

    const playerTotal = playerStats.getTotalStats();
    const playerSpd = playerTotal.spd;
    const monsterSpd = monsterStats.atk; // 怪物用攻击力近似速度

    // 计算总攻击次数（基础4-8次）
    const baseAttacks = RandomUtil.randomInt(4, 8);
    
    // 根据攻速比值分配
    const totalSpd = playerSpd + monsterSpd;
    const playerAttackRatio = playerSpd / totalSpd;
    const monsterAttackRatio = monsterSpd / totalSpd;

    const playerAttacks = Math.round(baseAttacks * playerAttackRatio);
    const monsterAttacks = baseAttacks - playerAttacks;

    // 生成攻击队列
    const turnQueue: TurnInfo[] = [];

    // 玩家攻击
    for (let i = 0; i < playerAttacks; i++) {
      turnQueue.push({
        attacker: 'player',
        attackIndex: i,
        totalAttacks: playerAttacks,
      });
    }

    // 怪物攻击
    for (let i = 0; i < monsterAttacks; i++) {
      turnQueue.push({
        attacker: 'monster',
        attackIndex: i,
        totalAttacks: monsterAttacks,
      });
    }

    // 按速度排序（速度快的先攻击）
    turnQueue.sort((a, b) => {
      if (a.attacker === 'player' && b.attacker === 'monster') {
        return playerSpd >= monsterSpd ? -1 : 1;
      }
      if (a.attacker === 'monster' && b.attacker === 'player') {
        return monsterSpd >= playerSpd ? -1 : 1;
      }
      return RandomUtil.randomInt(0, 1) === 0 ? -1 : 1;
    });

    battleComp.setTurnQueue(turnQueue);
    
    battleComp.addLog(`⚡ 攻击顺序: 玩家 ${playerAttacks} 次, 怪物 ${monsterAttacks} 次`, 'player');
  }

  /**
   * 执行当前回合的攻击
   */
  executeCurrentTurn(): AttackResult | null {
    if (!this.world) return null;

    const battleEntities = this.world.query(['battle']);
    if (battleEntities.length === 0) return null;

    const battleEntity = battleEntities[0];
    const battleComp = battleEntity.getComponent<BattleComponent>('battle');
    if (!battleComp || !battleComp.isActive) return null;

    const currentTurn = battleComp.getCurrentTurn();
    if (!currentTurn) return null;

    const player = this.world.getEntity(battleComp.playerEntityId!);
    const monster = this.world.getEntity(battleComp.monsterEntityId!);
    if (!player || !monster) return null;

    let result: AttackResult;

    if (currentTurn.attacker === 'player') {
      result = this.executePlayerAttack(player, monster, battleComp);
    } else {
      result = this.executeMonsterAttack(monster, player, battleComp);
    }

    // 移到下一个攻击
    battleComp.nextTurn();

    // 检查回合结束
    if (battleComp.isRoundEnd()) {
      this.endRound(battleComp, player, monster);
    }

    return result;
  }

  /**
   * 执行玩家普通攻击
   */
  executePlayerAttack(player: Entity, monster: Entity, battleComp: BattleComponent): AttackResult {
    const playerStats = player.getComponent<StatsComponent>('stats');
    const monsterComp = monster.getComponent<MonsterComponent>('monster');

    if (!playerStats || !monsterComp) {
      return { damage: 0, isCrit: false, isDodge: false, attacker: 'player' };
    }

    const playerTotal = playerStats.getTotalStats();

    // 闪避判定
    const dodgeChance = Math.min(20, monsterComp.spd * 0.2);
    if (RandomUtil.rollPercent(dodgeChance)) {
      battleComp.addLog(`💨 ${monsterComp.name} 闪避了攻击！`, 'dodge');
      return { damage: 0, isCrit: false, isDodge: true, attacker: 'player' };
    }

    // 伤害计算
    let baseDamage = Math.max(1, playerTotal.atk - monsterComp.def * 0.3);

    // 暴击判定
    const critChance = Math.min(30, 5 + playerTotal.spd * 0.5);
    const isCrit = RandomUtil.rollPercent(critChance);
    if (isCrit) {
      baseDamage *= (playerTotal.critDmg / 100);
    }

    // 伤害减免
    baseDamage *= (1 - playerTotal.dmgReduction / 100);
    const damage = Math.floor(baseDamage);

    monsterComp.takeDamage(damage);

    // 增加怒气（普通攻击+10%）
    battleComp.addPlayerRage(10);

    if (isCrit) {
      battleComp.addLog(`💥 暴击！对 ${monsterComp.name} 造成 ${damage} 点伤害`, 'crit');
    } else {
      battleComp.addLog(`⚔️ 对 ${monsterComp.name} 造成 ${damage} 点伤害`, 'player');
    }

    return { damage, isCrit, isDodge: false, attacker: 'player' };
  }

  /**
   * 执行怪物攻击
   */
  executeMonsterAttack(monster: Entity, player: Entity, battleComp: BattleComponent): AttackResult {
    const monsterComp = monster.getComponent<MonsterComponent>('monster');
    const playerStats = player.getComponent<StatsComponent>('stats');

    if (!monsterComp || !playerStats) {
      return { damage: 0, isCrit: false, isDodge: false, attacker: 'monster' };
    }

    const playerTotal = playerStats.getTotalStats();

    // 闪避判定
    const dodgeChance = Math.min(25, playerTotal.spd * 0.3);
    if (RandomUtil.rollPercent(dodgeChance)) {
      battleComp.addLog(`💨 你闪避了 ${monsterComp.name} 的攻击！`, 'dodge');
      return { damage: 0, isCrit: false, isDodge: true, attacker: 'monster' };
    }

    // 伤害计算
    let baseDamage = Math.max(1, monsterComp.atk - playerTotal.def * 0.3);

    // 暴击判定（怪物暴击率较低）
    const critChance = 10;
    const isCrit = RandomUtil.rollPercent(critChance);
    if (isCrit) {
      baseDamage *= 1.5;
    }

    // 伤害减免
    baseDamage *= (1 - playerTotal.dmgReduction / 100);
    const damage = Math.floor(baseDamage);

    playerStats.takeDamage(damage);

    // 怪物增加怒气
    battleComp.addMonsterRage(10);

    if (isCrit) {
      battleComp.addLog(`💥 ${monsterComp.name} 暴击！对你造成 ${damage} 点伤害`, 'crit');
    } else {
      battleComp.addLog(`👊 ${monsterComp.name} 对你造成 ${damage} 点伤害`, 'monster');
    }

    return { damage, isCrit, isDodge: false, attacker: 'monster' };
  }

  /**
   * 使用技能攻击
   */
  useSkill(skillId: EntityId): boolean {
    if (!this.world) return false;

    const battleEntities = this.world.query(['battle']);
    if (battleEntities.length === 0) return false;

    const battleEntity = battleEntities[0];
    const battleComp = battleEntity.getComponent<BattleComponent>('battle');
    if (!battleComp || !battleComp.isActive) return false;

    const skillEntity = this.world.getEntity(skillId);
    if (!skillEntity) return false;

    const skillComp = skillEntity.getComponent<SkillComponent>('skill');
    if (!skillComp) return false;

    // 检查怒气是否足够
    if (!skillComp.canUse(battleComp.playerRage)) {
      battleComp.addLog(`❌ 怒气不足，需要 ${skillComp.rageCost}%`, 'player');
      return false;
    }

    // 检查当前是否是玩家回合
    const currentTurn = battleComp.getCurrentTurn();
    if (!currentTurn || currentTurn.attacker !== 'player') {
      battleComp.addLog(`❌ 当前不是你的回合`, 'player');
      return false;
    }

    // 消耗怒气
    battleComp.consumePlayerRage(skillComp.rageCost);
    skillComp.use();

    // 执行技能
    const player = this.world.getEntity(battleComp.playerEntityId!);
    const monster = this.world.getEntity(battleComp.monsterEntityId!);
    if (!player || !monster) return false;

    this.executeSkill(player, monster, skillComp, battleComp);

    // 移到下一个攻击
    battleComp.nextTurn();

    // 检查回合结束
    if (battleComp.isRoundEnd()) {
      this.endRound(battleComp, player, monster);
    }

    return true;
  }

  /**
   * 执行技能效果
   */
  private executeSkill(
    player: Entity, 
    monster: Entity, 
    skillComp: SkillComponent, 
    battleComp: BattleComponent
  ): void {
    const playerStats = player.getComponent<StatsComponent>('stats');
    const monsterComp = monster.getComponent<MonsterComponent>('monster');

    if (!playerStats || !monsterComp) return;

    const playerTotal = playerStats.getTotalStats();

    battleComp.addLog(`✨ 使用技能: ${skillComp.name}`, 'skill');

    // 伤害型技能
    if (skillComp.damageMultiplier > 0) {
      const baseDamage = playerTotal.atk * skillComp.damageMultiplier;
      
      // 必定暴击的技能（如致命一击）
      const isGuaranteedCrit = skillComp.damageMultiplier >= 3.0;
      let finalDamage = baseDamage;

      if (isGuaranteedCrit) {
        finalDamage *= (playerTotal.critDmg / 100);
        battleComp.addLog(`💥 必定暴击！`, 'crit');
      }

      // 闪避判定（部分技能不可闪避）
      if (skillComp.damageMultiplier < 3.0) {
        const dodgeChance = Math.min(10, monsterComp.spd * 0.1);
        if (RandomUtil.rollPercent(dodgeChance)) {
          battleComp.addLog(`💨 ${monsterComp.name} 闪避了技能！`, 'dodge');
          return;
        }
      }

      const damage = Math.floor(finalDamage);
      monsterComp.takeDamage(damage);
      battleComp.addLog(`💫 对 ${monsterComp.name} 造成 ${damage} 点伤害`, 'player');
    }

    // 治疗型技能
    if (skillComp.healPercent > 0) {
      const healAmount = Math.floor(playerTotal.maxHp * skillComp.healPercent / 100);
      playerStats.heal(healAmount);
      battleComp.addLog(`💚 恢复 ${healAmount} 点生命值`, 'player');
    }
  }

  /**
   * 怪物使用技能
   */
  monsterUseSkill(battleComp: BattleComponent): boolean {
    if (!this.world) return false;

    const monster = this.world.getEntity(battleComp.monsterEntityId!);
    const player = this.world.getEntity(battleComp.playerEntityId!);
    if (!monster || !player) return false;

    const monsterComp = monster.getComponent<MonsterComponent>('monster');
    const playerStats = player.getComponent<StatsComponent>('stats');
    if (!monsterComp || !playerStats) return false;

    // 怪物有几率使用技能（怒气足够时）
    if (battleComp.monsterRage >= 50 && RandomUtil.rollPercent(30)) {
      const skillMultiplier = battleComp.monsterRage >= 80 ? 3.0 : 1.8;
      const rageCost = battleComp.monsterRage >= 80 ? 80 : 50;

      battleComp.monsterRage -= rageCost;

      const baseDamage = monsterComp.atk * skillMultiplier;
      const damage = Math.floor(baseDamage);
      playerStats.takeDamage(damage);

      const skillName = skillMultiplier >= 3.0 ? '猛击' : '撕咬';
      battleComp.addLog(`🔥 ${monsterComp.name} 使用 ${skillName}！造成 ${damage} 点伤害`, 'monster');

      return true;
    }

    return false;
  }

  /**
   * 结束回合
   */
  private endRound(battleComp: BattleComponent, player: Entity, monster: Entity): void {
    // 检查战斗结束
    if (this.checkBattleEnd(player, monster, battleComp)) {
      return;
    }

    // 开始新回合
    battleComp.startNewRound();
    this.calculateTurnOrder(battleComp, player, monster);
    battleComp.addLog(`📊 第 ${battleComp.currentRound} 回合`, 'player');
  }

  /**
   * 检查战斗结束
   */
  checkBattleEnd(player: Entity, monster: Entity, battleComp: BattleComponent): boolean {
    const playerStats = player.getComponent<StatsComponent>('stats');
    const monsterComp = monster.getComponent<MonsterComponent>('monster');

    // 怪物死亡
    if (monsterComp && !monsterComp.isAlive()) {
      const monsterLevel = monsterComp.hp / 100 | 0;
      const drops = this.dropSystem!.generateDrops(monsterComp, monsterLevel);
      
      battleComp.end(true, monsterComp.exp, monsterComp.gold, drops);
      battleComp.addLog(`🎉 战斗胜利！获得 ${monsterComp.exp} 经验, ${monsterComp.gold} 金币`, 'victory');
      
      if (drops.length > 0) {
        battleComp.addLog(`🎁 获得装备 ${drops.length} 件`, 'victory');
      }

      this.emit(EventType.BATTLE_VICTORY, {
        playerId: player.id,
        monsterId: monster.id,
        exp: monsterComp.exp,
        gold: monsterComp.gold,
        drops,
      });
      return true;
    }

    // 玩家死亡
    if (playerStats && !playerStats.isAlive()) {
      battleComp.end(false, 0, 0);
      battleComp.addLog(`💀 战斗失败`, 'defeat');
      
      this.emit(EventType.BATTLE_DEFEAT, {
        playerId: player.id,
        monsterId: monster.id,
      });
      return true;
    }

    return false;
  }

  /**
   * 获取玩家可用技能列表
   */
  getPlayerSkills(battleComp: BattleComponent): { skill: SkillComponent; canUse: boolean }[] {
    const skills: { skill: SkillComponent; canUse: boolean }[] = [];

    for (const skillId of battleComp.playerSkillIds) {
      const skillEntity = this.world?.getEntity(skillId);
      if (!skillEntity) continue;

      const skillComp = skillEntity.getComponent<SkillComponent>('skill');
      if (!skillComp) continue;

      skills.push({
        skill: skillComp,
        canUse: skillComp.canUse(battleComp.playerRage),
      });
    }

    return skills;
  }

  /**
   * 自动战斗（用于测试或跳过）
   */
  autoBattle(): void {
    if (!this.world) return;

    const battleEntities = this.world.query(['battle']);
    if (battleEntities.length === 0) return;

    const battleComp = battleEntities[0].getComponent<BattleComponent>('battle');
    if (!battleComp || !battleComp.isActive) return;

    // 执行所有攻击直到回合结束
    while (!battleComp.isRoundEnd()) {
      const currentTurn = battleComp.getCurrentTurn();
      if (!currentTurn) break;

      // 怪物有几率使用技能
      if (currentTurn.attacker === 'monster') {
        this.monsterUseSkill(battleComp);
      }

      this.executeCurrentTurn();
    }
  }

  update(_deltaTime: number): void {
    // 战斗系统不进行自动更新
  }
}

export default BattleSystem;
