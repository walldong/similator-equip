# 快速开始指南

## 环境要求

- Node.js 18+
- npm 或 pnpm

## 安装步骤

```bash
# 1. 安装依赖
pnpm install

# 2. 启动开发服务器
pnpm run dev
```

## 访问应用

打开浏览器访问 http://localhost:3000

## 使用流程

### 1. 注册账号
- 输入用户名（支持中文、字母、数字、下划线）
- 点击「注册」按钮

### 2. 登录游戏
- 输入已注册的用户名
- 点击「登录」按钮

### 3. 游戏操作

#### 角色面板
- 查看角色属性和等级
- 管理装备槽位
- 点击装备槽可卸下装备
- 使用「恢复生命」按钮恢复HP

#### 背包管理
- 点击背包中的装备可选中
- 选中后可进行：穿戴、强化、丢弃

#### 装备强化
- 选中背包中的装备
- 点击「强化」按钮
- +0~+9 失败不会损坏
- +10以上失败可能损坏装备

### 4. 保存游戏
- 点击「保存」按钮手动保存
- 数据自动保存到 SQLite 数据库

## 项目结构

```
src/
├── app/           # Next.js 页面和 API
├── core/          # ECS 核心架构
├── components/    # 游戏组件
├── systems/       # 游戏系统
├── factories/     # 实体工厂
├── data/          # 游戏配置
├── lib/           # 工具库
└── types/         # TypeScript 类型
```

## 扩展开发

### 添加新装备类型
编辑 `src/data/gameData.ts` 和 `src/factories/EquipmentFactory.ts`

### 添加新怪物
编辑 `src/factories/MonsterFactory.ts` 中的 `MonsterTemplates`

### 添加新副本
编辑 `src/data/gameData.ts` 中的 `DungeonConfigs`

## 常见问题

### Q: 启动时报错 "Cannot find module"
A: 运行 `npm install` 安装依赖

### Q: 数据库文件在哪里？
A: `data/game.db`

### Q: 如何重置数据？
A: 删除 `data/game.db` 文件，重启服务器