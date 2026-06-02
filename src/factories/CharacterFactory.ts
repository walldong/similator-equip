/**
 * CharacterFactory - 角色工厂
 * 负责创建玩家角色实体
 */

import { World, Entity } from '@/core';
import { PlayerComponent, StatsComponent, InventoryComponent } from '@/components';
import { EntityId } from '@/types';

export interface CharacterConfig {
  name?: string;
  level?: number;
  exp?: number;
  gold?: number;
  currentHp?: number;
}

export class CharacterFactory {
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  /**
   * 创建新角色
   */
  create(config: CharacterConfig): Entity {
    const entity = this.world.createEntity();

    // 添加玩家组件
    const playerComp = new PlayerComponent(
      config.level ?? 1,
      config.exp ?? 0,
      config.gold ?? 100
    );
    entity.addComponent(playerComp);

    // 添加属性组件
    const level = config.level ?? 1;
    const stats = new StatsComponent({
      hp: 200 + level * 50,
      atk: 50 + level * 10,
      def: 30 + level * 5,
      spd: 20 + level * 2,
      critRate: 0,
      critDmg: 0,
    });
    stats.currentHp = config.currentHp ?? stats.baseStats.hp ?? 200;
    entity.addComponent(stats);

    // 添加背包组件
    const inventory = new InventoryComponent(50);
    entity.addComponent(inventory);

    return entity;
  }

  /**
   * 从存档数据恢复角色
   */
  restore(data: {
    id?: EntityId;
    level: number;
    exp: number;
    gold: number;
    currentHp: number;
    equipmentSlots?: Record<string, EntityId | null>;
    inventory?: EntityId[];
  }): Entity {
    const entity = this.create({
      level: data.level,
      exp: data.exp,
      gold: data.gold,
      currentHp: data.currentHp,
    });

    // 恢复装备槽
    const playerComp = entity.getComponent<PlayerComponent>('player');
    if (playerComp && data.equipmentSlots) {
      playerComp.equipmentSlots = {
        weapon: data.equipmentSlots.weapon ?? null,
        helmet: data.equipmentSlots.helmet ?? null,
        chestplate: data.equipmentSlots.chestplate ?? null,
        gloves: data.equipmentSlots.gloves ?? null,
        boots: data.equipmentSlots.boots ?? null,
        accessory: data.equipmentSlots.accessory ?? null,
      };
    }

    // 恢复背包
    const inventory = entity.getComponent<InventoryComponent>('inventory');
    if (inventory && data.inventory) {
      inventory.items = data.inventory;
    }

    return entity;
  }

  /**
   * 创建初始角色（新手玩家）
   */
  createNewPlayer(name: string): Entity {
    return this.create({
      name,
      level: 1,
      exp: 0,
      gold: 100,
      currentHp: 200,
    });
  }
}

export default CharacterFactory;