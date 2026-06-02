/**
 * 类型定义文件
 */

// ==================== 基础类型 ====================

export type EntityId = string;
export type ComponentType = string;

// ==================== 词条类型 ====================

export enum StatType {
  // 基础属性
  ATK_PERCENT = 'ATK_PERCENT',
  ATK_FLAT = 'ATK_FLAT',
  DEF_PERCENT = 'DEF_PERCENT',
  DEF_FLAT = 'DEF_FLAT',
  HP_FLAT = 'HP_FLAT',
  HP_PERCENT = 'HP_PERCENT',
  SPD_FLAT = 'SPD_FLAT',
  SPD_PERCENT = 'SPD_PERCENT',
  
  // 暴击相关
  CRIT_RATE = 'CRIT_RATE',
  CRIT_DMG = 'CRIT_DMG',
  
  // 部位特有词条
  STRENGTH = 'STRENGTH',
  MOVE_SPEED = 'MOVE_SPEED',
  SKILL_CD = 'SKILL_CD',
  ARMOR = 'ARMOR',
  PENETRATION = 'PENETRATION',
  DMG_BONUS = 'DMG_BONUS',
  DMG_REDUCTION = 'DMG_REDUCTION',
  EVADE_RATE = 'EVADE_RATE',
}

export interface Affix {
  stat: StatType;
  value: number;
  upgradeCount?: number;
}

// ==================== 品质类型 ====================

export type Quality = 'normal' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface QualityConfig {
  name: string;
  color: string;
  multiplier: number;
  valueMultiplier: number;
  dropRate: number;
}

// ==================== 装备类型 ====================

export type EquipmentSlot = 'weapon' | 'helmet' | 'chestplate' | 'gloves' | 'boots' | 'accessory';

export interface EquipmentData {
  id: EntityId;
  slot: EquipmentSlot;
  level: number;
  quality: Quality;
  isBroken: boolean;
  mainAffix: Affix;
  subAffixes: Affix[];
}

// ==================== 角色类型 ====================

export interface CharacterStats {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  critRate: number;
  critDmg: number;
  penetration: number;
  dmgBonus: number;
  dmgReduction: number;
  evadeRate: number;
}

export interface CharacterData {
  id: EntityId;
  name: string;
  level: number;
  exp: number;
  gold: number;
  stats: CharacterStats;
  equipmentSlots: Record<EquipmentSlot, EntityId | null>;
  inventory: EntityId[];
}

// ==================== 怪物类型 ====================

export type MonsterType = 'normal' | 'elite' | 'boss';

export interface MonsterData {
  id: EntityId;
  name: string;
  icon: string;
  type: MonsterType;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  exp: number;
  gold: number;
  dropRate: number;
  qualityWeights: Record<Quality, number>;
}

// ==================== 地图类型 ====================

export type CellType = 'wall' | 'path' | 'start' | 'monster' | 'elite' | 'boss' | 'empty';

export interface MapCell {
  x: number;
  y: number;
  type: CellType;
  explored: boolean;
  visible: boolean;
  entityId?: EntityId;
  monsterLevel?: number;  // 怪物等级
}

export interface DungeonMap {
  width: number;
  height: number;
  cells: MapCell[][];
  playerPos: { x: number; y: number };
  defeatedCells: Set<string>;
  bossCount: number;
  defeatedBossCount: number;
}

// ==================== 世界地图类型 ====================

export interface WorldMapCell {
  x: number;
  y: number;
  type: CellType;
  explored: boolean;
  visible: boolean;
  entityId?: EntityId;
  monsterLevel?: number;
  monsterType?: 'normal' | 'elite' | 'boss';
}

export interface WorldMap {
  id: EntityId;
  width: number;
  height: number;
  cells: WorldMapCell[][];
  playerPos: { x: number; y: number };
  defeatedCells: Set<string>;
  totalMonsters: number;
  totalElites: number;
  totalBosses: number;
  defeatedMonsters: number;
  defeatedElites: number;
  defeatedBosses: number;
  playerLevel: number;  // 生成时的玩家等级
  createdAt: number;
  lastResetAt: number;
}

export interface WorldMapConfig {
  width: number;
  height: number;
  playerLevel: number;
  monsterDensity: number;   // 怪物密度 0-1
  eliteRatio: number;       // 精英比例 0-1
  bossRatio: number;        // Boss比例 0-1
}

// ==================== 副本类型 ====================

export interface DungeonConfig {
  id: string;
  name: string;
  icon: string;
  level: number;
  mapSize: 'small' | 'medium' | 'large';
  monsters: string[];
  boss: string;
  bossName: string;
  bossIcon: string;
  isRandom: boolean;
  mapTemplate?: CellType[][];
}

// ==================== 战斗类型 ====================

export interface BattleState {
  isActive: boolean;
  playerHp: number;
  monsterHp: number;
  logs: BattleLog[];
  result?: BattleResult;
}

export interface BattleLog {
  text: string;
  type: 'player' | 'monster' | 'crit' | 'dodge' | 'victory' | 'defeat' | 'skill' | 'rage';
}

export interface BattleResult {
  victory: boolean;
  exp: number;
  gold: number;
  drops: EntityId[];
}

// ==================== 技能类型 ====================

export type SkillType = 'attack' | 'heal' | 'buff' | 'debuff' | 'ultimate';

export type SkillTarget = 'self' | 'enemy' | 'all';

export interface SkillData {
  id: EntityId;
  name: string;
  description: string;
  skillType: SkillType;
  target: SkillTarget;
  rageCost: number;        // 怒气消耗
  baseDamage?: number;     // 基础伤害
  damageMultiplier?: number; // 伤害倍率
  healPercent?: number;    // 治疗百分比
  cooldown?: number;       // 冷却回合数
  icon?: string;
}

export interface SkillEffect {
  damage?: number;
  heal?: number;
  buffs?: BuffEffect[];
  debuffs?: BuffEffect[];
}

export interface BuffEffect {
  stat: keyof CharacterStats;
  value: number;
  duration: number;  // 持续回合数
}

// ==================== 回合制战斗类型 ====================

export interface TurnInfo {
  attacker: 'player' | 'monster';
  attackIndex: number;     // 当前第几次攻击
  totalAttacks: number;    // 总攻击次数
}

export interface RoundResult {
  playerAttacks: AttackResult[];
  monsterAttacks: AttackResult[];
  playerDamageDealt: number;
  monsterDamageDealt: number;
  playerRageGained: number;
  monsterRageGained: number;
  skillUsed?: string;     // 使用的技能名称
}

export interface AttackResult {
  damage: number;
  isCrit: boolean;
  isDodge: boolean;
  attacker: 'player' | 'monster';
}


// ==================== 用户类型 ====================

export interface UserData {
  id: number;
  username: string;
  uuid: string;
  level: number;
  exp: number;
  gold: number;
  currentHp: number;
  equipments?: EquipmentData[];
}

// ==================== 组件类型 ====================

export interface IComponent {
  type: ComponentType;
  entityId: EntityId;
}

export interface StatsComponent extends IComponent {
  type: 'stats';
  baseStats: Partial<CharacterStats>;
  bonusStats: Partial<CharacterStats>;
  currentHp: number;
}

export interface EquipmentComponent extends IComponent {
  type: 'equipment';
  slot: EquipmentSlot;
  level: number;
  quality: Quality;
  isBroken: boolean;
  mainAffix: Affix;
  subAffixes: Affix[];
}

export interface InventoryComponent extends IComponent {
  type: 'inventory';
  items: EntityId[];
  maxSize: number;
}

export interface MonsterComponent extends IComponent {
  type: 'monster';
  monsterType: MonsterType;
  name: string;
  icon: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  exp: number;
  gold: number;
  dropRate: number;
  qualityWeights: Record<Quality, number>;
}

export interface PositionComponent extends IComponent {
  type: 'position';
  x: number;
  y: number;
}

export interface PlayerComponent extends IComponent {
  type: 'player';
  level: number;
  exp: number;
  gold: number;
  equipmentSlots: Record<EquipmentSlot, EntityId | null>;
}

// ==================== 事件类型 ====================

export enum EventType {
  // 装备事件
  EQUIPMENT_CREATED = 'equipment:created',
  EQUIPMENT_ENHANCED = 'equipment:enhanced',
  EQUIPMENT_BROKEN = 'equipment:broken',
  EQUIPMENT_EQUIPPED = 'equipment:equipped',
  EQUIPMENT_UNEQUIPPED = 'equipment:unequipped',
  EQUIPMENT_SYNTHESIZED = 'equipment:synthesized',
  
  // 角色事件
  PLAYER_LEVEL_UP = 'player:levelUp',
  PLAYER_STATS_CHANGED = 'player:statsChanged',
  PLAYER_HEALED = 'player:healed',
  
  // 战斗事件
  BATTLE_START = 'battle:start',
  BATTLE_ATTACK = 'battle:attack',
  BATTLE_VICTORY = 'battle:victory',
  BATTLE_DEFEAT = 'battle:defeat',
  
  // 地图事件
  MAP_GENERATED = 'map:generated',
  PLAYER_MOVED = 'player:moved',
  MONSTER_DEFEATED = 'monster:defeated',
  WORLD_MAP_GENERATED = 'worldMap:generated',
  WORLD_MAP_RESET = 'worldMap:reset',
  WORLD_MAP_MONSTER_RESPAWNED = 'worldMap:monsterRespawned',
  
  // 背包事件
  INVENTORY_CHANGED = 'inventory:changed',
  ITEM_PICKED_UP = 'inventory:itemPickedUp',
  ITEM_DROPPED = 'inventory:itemDropped',
}

export interface EventPayload {
  [key: string]: unknown;
}

export type EventCallback = (payload: EventPayload) => void;
