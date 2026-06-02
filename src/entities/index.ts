/**
 * 实体模块导出
 * 
 * 实体是 ECS 架构中唯一的标识符
 * 通过组合不同的组件来创建不同类型的实体
 */

// 基础实体类已由 core/Entity 提供
// 这里导出用于创建特定类型实体的辅助函数

export { Entity, generateEntityId } from '@/core/Entity';