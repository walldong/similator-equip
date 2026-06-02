/**
 * 装备强化模拟器 - ECS 架构总导出
 * 
 * 这个文件导出了所有核心模块，方便外部引用
 */

// ECS 核心
export * from '@/core';

// 类型
export * from '@/types';

// 数据
export * from '@/data';

// 组件
export {
  StatsComponent,
  EquipmentComponent,
  PlayerComponent,
  InventoryComponent,
  MonsterComponent,
  PositionComponent,
  BattleComponent,
} from '@/components';
export type { MonsterConfig } from '@/components';

// 系统
export {
  StatCalculationSystem,
  EnhancementSystem,
  BattleSystem,
  SynthesisSystem,
  DropSystem,
  InventorySystem,
  EquipmentSystem,
  MapGeneratorSystem,
} from '@/systems';
export type { MapConfig, MapConfigs } from '@/systems';

// 工厂
export {
  EquipmentFactory,
  MonsterFactory,
  CharacterFactory,
} from '@/factories';

// 工具
export { useGame } from '@/lib/useGame';
export { getDatabase, UserMethods, EquipmentMethods, DungeonMethods } from '@/lib/database';