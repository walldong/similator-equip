# 装备强化模拟器

一个基于 ECS（Entity-Component-System）架构的装备强化模拟器，支持用户注册登录和数据持久化。

## 功能特性

### 核心玩法
- **装备系统**：6个装备槽位（武器、头盔、胸甲、护手、鞋子、首饰）
- **强化系统**：最高+21，每+3级升级随机副词条，+10以上失败装备损坏消失
- **合成系统**：相同品质装备合成，有几率提升品质
- **副本战斗**：5个副本，击败怪物获得装备掉落
- **品质系统**：普通、稀有、史诗、传说、神话 5个品质等级

### 用户系统
- 简易注册：输入用户名即可注册，自动生成UUID
- 快速登录：输入用户名即可登录，自动加载数据
- 数据持久化：自动保存到SQLite数据库
- 自动保存：每30秒自动保存游戏进度

## 技术架构

### ECS 架构

项目采用 ECS（Entity-Component-System）架构，实现数据与逻辑的完全分离。

```
┌─────────────────────────────────────────────────────────────┐
│                        World（世界）                          │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    Entities（实体）                       │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │ │
│  │  │  Player     │  │ Equipment   │  │  Monster    │     │ │
│  │  │  Entity     │  │  Entity     │  │  Entity     │     │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                  Components（组件）                       │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │ │
│  │  │  Stats   │ │Equipment │ │ Affix    │ │Inventory │   │ │
│  │  │Component │ │Component │ │Component │ │Component │   │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    Systems（系统）                        │ │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐          │ │
│  │  │Enhancement │ │ Synthesis  │ │  Battle    │  ...     │ │
│  │  │  System    │ │  System    │ │  System    │          │ │
│  │  └────────────┘ └────────────┘ └────────────┘          │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### Entity（实体）
实体的唯一标识，可以附加任意数量的组件。

```javascript
class Entity {
    constructor() {
        this.id = entityIdCounter++;  // 唯一ID
        this.components = new Map();   // 组件映射
        this.isActive = true;
    }
}
```

#### Component（组件）
纯数据容器，不包含任何逻辑。

| 组件名 | 用途 | 主要属性 |
|--------|------|----------|
| `TypeComponent` | 类型标识 | `type` |
| `StatsComponent` | 属性数据 | `baseStats`, `bonusStats`, `currentHp` |
| `PlayerComponent` | 玩家数据 | `level`, `exp`, `gold`, `equipmentSlots` |
| `InventoryComponent` | 背包数据 | `items[]`, `maxSize` |
| `EquipmentComponent` | 装备数据 | `slot`, `level`, `quality`, `isBroken` |
| `AffixComponent` | 词条数据 | `mainAffix`, `subAffixes[]` |
| `MonsterComponent` | 怪物数据 | `hp`, `atk`, `def`, `exp`, `dropRates` |
| `BattleComponent` | 战斗状态 | `isActive`, `logs[]` |

#### System（系统）
处理特定组件的逻辑，每个系统专注于一个功能领域。

| 系统名 | 职责 |
|--------|------|
| `EnhancementSystem` | 装备强化逻辑 |
| `SynthesisSystem` | 装备合成逻辑 |
| `BattleSystem` | 战斗回合处理 |
| `InventorySystem` | 背包管理 |
| `EquipmentSystem` | 穿戴/卸下装备 |
| `DropSystem` | 掉落生成 |
| `StatCalculationSystem` | 属性计算 |
| `ExperienceSystem` | 经验升级 |
| `DungeonProgressSystem` | 副本进度 |

#### EventBus（事件总线）
系统间解耦通信的核心。

```javascript
// 事件类型
const Events = {
    EQUIPMENT_CREATED: 'equipment:created',
    EQUIPMENT_ENHANCED: 'equipment:enhanced',
    EQUIPMENT_BROKEN: 'equipment:broken',
    INVENTORY_CHANGED: 'inventory:changed',
    STATS_CHANGED: 'stats:changed',
    BATTLE_START: 'battle:start',
    BATTLE_VICTORY: 'battle:victory',
    // ...
};

// 订阅事件
eventBus.on(Events.EQUIPMENT_ENHANCED, (data) => {
    // 处理强化成功
});

// 触发事件
eventBus.emit(Events.INVENTORY_CHANGED, { playerId });
```

## 文件结构

```
similator-equip/
├── public/                 # 前端静态文件
│   ├── index.html          # 主页面
│   ├── css/
│   │   └── styles.css      # 样式文件
│   └── js/
│       ├── data.js         # 游戏配置数据
│       ├── ecs-core.js     # ECS核心架构
│       ├── components.js   # 组件定义
│       ├── systems.js      # 系统定义
│       ├── factory.js      # 实体工厂
│       ├── game.js         # 游戏主类
│       ├── app.js          # UI控制器
│       └── user-client.js  # 用户客户端
│
├── backend/                # 后端服务
│   ├── server.js           # Express服务器
│   └── database.js         # SQLite数据库模块
│
├── data/                   # 数据存储目录
│   └── game.db            # SQLite数据库文件
│
├── package.json            # Node.js 配置
└── README.md               # 本文档
```

## 数据持久化方案

### 数据库表结构

#### 用户表 (users)
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    uuid TEXT UNIQUE NOT NULL,
    level INTEGER DEFAULT 1,
    exp INTEGER DEFAULT 0,
    gold INTEGER DEFAULT 0,
    current_hp INTEGER DEFAULT 100,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 装备表 (equipments)
```sql
CREATE TABLE equipments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    slot TEXT NOT NULL,
    level INTEGER DEFAULT 0,
    quality TEXT DEFAULT 'normal',
    is_broken INTEGER DEFAULT 0,
    equipped INTEGER DEFAULT 0,
    main_affix_stat TEXT,
    main_affix_value INTEGER,
    sub_affixes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### 副本进度表 (dungeon_progress)
```sql
CREATE TABLE dungeon_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    dungeon_id TEXT NOT NULL,
    cleared INTEGER DEFAULT 0,
    best_time INTEGER,
    attempts INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, dungeon_id)
);
```

## API 接口

### 用户相关

#### 注册
```
POST /api/register
Request:  { "username": "player1" }
Response: { 
  "success": true, 
  "data": { 
    "id": 1,
    "username": "player1", 
    "uuid": "xxx-xxx-xxx",
    "level": 1,
    "exp": 0,
    "gold": 100,
    "currentHp": 200
  } 
}
```

#### 登录
```
POST /api/login
Request:  { "username": "player1" }
Response: { 
  "success": true, 
  "data": { 
    "id": 1,
    "username": "player1",
    "uuid": "xxx-xxx-xxx",
    "level": 5,
    "exp": 150,
    "gold": 1200,
    "currentHp": 180,
    "equipments": [...]
  } 
}
```

#### 保存用户数据
```
POST /api/save
Request:  { "userId": 1, "data": { "level": 5, "exp": 150, "gold": 1200, "currentHp": 180 } }
Response: { "success": true, "message": "保存成功" }
```

#### 获取用户数据
```
GET /api/user/:id
Response: { "success": true, "data": { /* 用户数据 */ } }
```

#### 获取所有用户
```
GET /api/users
Response: { "success": true, "data": [{ "id": 1, "username": "player1", ... }] }
```

### 装备相关

#### 添加装备
```
POST /api/equipment
Request:  { "userId": 1, "equipment": { "slot": "weapon", "level": 10, ... } }
Response: { "success": true, "data": { "id": 1, ... } }
```

#### 更新装备
```
PUT /api/equipment/:id
Request:  { "level": 15, "isBroken": false, "equipped": true }
Response: { "success": true }
```

#### 删除装备
```
DELETE /api/equipment/:id
Response: { "success": true }
```

#### 批量保存装备
```
POST /api/equipments/save
Request:  { 
  "userId": 1, 
  "equipments": [...],
  "equippedSlots": { "weapon": "eq-id-1", "helmet": null, ... }
}
Response: { "success": true, "message": "装备保存成功" }
```

### 副本进度

#### 获取副本进度
```
GET /api/dungeon/progress/:userId
Response: { "success": true, "data": [{ "dungeon_id": "forest", "cleared": 1, ... }] }
```

#### 更新副本进度
```
POST /api/dungeon/progress
Request:  { "userId": 1, "dungeonId": "forest", "cleared": true }
Response: { "success": true }
```

## 运行方式

### 1. 安装依赖
```bash
npm install
```

### 2. 启动服务器
```bash
npm start
# 或者
node backend/server.js
```

服务器将在 `http://localhost:3000` 启动。

### 3. 访问游戏
打开浏览器访问 `http://localhost:3000`

### 4. 注册/登录
- 输入用户名点击「注册」创建新账号
- 输入用户名点击「登录」进入已有账号

---

## 页签结构

游戏分为两个主要页签：

### 🧙 角色/装备页签
- 查看角色属性和等级
- 管理6个装备槽位（武器、头盔、胸甲、护手、鞋子、首饰）
- 背包物品管理
- 装备强化和合成

### 🏰 副本页签
- 选择并进入副本
- 探索地图，击败怪物
- 获得装备掉落

---

## 副本操作

### 地图移动
- **键盘控制**: 使用 `W` `A` `S` `D` 或方向键移动角色
- **点击控制**: 点击方向按钮移动
- **地图缩放**: 使用 ➕/➖ 按钮或鼠标滚轮
- **地图拖拽**: 按住鼠标拖拽地图视图
- **居中显示**: 点击 🎯 按钮回到玩家位置

### 战斗流程
```
遭遇怪物 → 点击「攻击」→ 结算战斗 → 拾取掉落 → 继续探索
```

---

## 游戏流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   注册/登录  │ ──▶ │   进入游戏   │ ──▶ │   生成装备   │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   副本战斗   │ ◀── │   穿戴装备   │ ◀── │   强化装备   │
└─────────────┘     └─────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│   获得掉落   │ ──▶ │   合成升级   │
└─────────────┘     └─────────────┘
```

## 装备系统详解

### 品质与词条数量
| 品质 | 主词条 | 副词条 | 总词条数 | 颜色 |
|------|--------|--------|----------|------|
| 普通 | 1 | 3 | 4 | 灰色 |
| 稀有 | 1 | 4 | 5 | 蓝色 |
| 史诗 | 1 | 5 | 6 | 紫色 |
| 传说 | 1 | 6 | 7 | 橙色 |
| 神话 | 1 | 7 | 8 | 红色 |

### 强化等级颜色
| 等级范围 | 颜色 |
|----------|------|
| +1 ~ +10 | 绿色 |
| +11 ~ +15 | 蓝色 |
| +16 ~ +19 | 紫色 |
| +20 ~ +21 | 红色 |

### 强化成功率
| 等级 | 成功率 | 失败后果 |
|------|--------|----------|
| +0 ~ +9 | 95% ~ 55% | 无 |
| +10 ~ +20 | 50% ~ 3% | 装备损坏消失 |

### 词条升级
强化等级达到 3, 6, 9, 12, 15, 18, 21 时，随机升级一个副词条（+20%~50%）。

---

## 词条系统

### 词条结构

每件装备包含：
- **1个主词条**：固定类型，由部位决定
- **4个副词条**：随机生成，包含部位特有词条

---

### 主词条（固定）

每个装备部位的主词条类型是固定的：

| 部位 | 主词条 | 说明 |
|------|--------|------|
| 🗡️ 武器 | 攻击力% | 百分比攻击力加成 |
| 🛡️ 胸甲 | 防御力% | 百分比防御力加成 |
| 🪖 头盔 | 防御力 | 固定防御力加成 |
| 👢 鞋子 | 速度 | 固定速度加成 |
| 🧤 护手 | 攻击力 | 固定攻击力加成 |
| 💍 首饰 | 暴击伤害% | 百分比暴击伤害加成 |

---

### 副词条池

#### 通用副词条（所有部位共享）

| 词条 | 权重 | 基础值 | 说明 |
|------|------|--------|------|
| 攻击力 | 15 | 15 | 固定攻击 |
| 攻击力% | 8 | 5% | 百分比攻击 |
| 防御力 | 12 | 12 | 固定防御 |
| 防御力% | 6 | 5% | 百分比防御 |
| 生命值 | 14 | 80 | 固定生命 |
| 生命值% | 8 | 5% | 百分比生命 |
| 速度 | 10 | 8 | 固定速度 |
| 速度% | 5 | 4% | 百分比速度 |
| 暴击率 | 8 | 4% | 暴击概率 |
| 暴击伤害 | 6 | 8% | 暴击倍率 |

#### 部位特有副词条

| 部位 | 特有词条 | 权重 | 基础值 | 说明 |
|------|----------|------|--------|------|
| 🗡️ 武器 | 力量 | 40 | 10 | 提升物理伤害 |
| 👢 鞋子 | 移动速度 | 40 | 6 | 地图移动效率 |
| 🪖 头盔 | 技能冷却 | 40 | 5% | 减少技能CD |
| 🧤 护手 | 护甲 | 40 | 15 | 额外防御层数 |
| 💍 首饰 | 暴击率 | 40 | 4% | 额外暴击概率 |
| 🛡️ 胸甲 | 生命值 | 40 | 80 | 额外生命 |
| 🛡️ 胸甲 | 生命值% | 20 | 5% | 额外百分比生命 |

> **注意**：特有词条只能在该部位出现，其他部位无法获得。

---

### 副词条生成规则

生成4条副词条时，从以下池子中随机抽取：

```
可用词条池 = 通用副词条池 + 当前部位特有词条池
```

**权重计算示例（武器）**：
```
通用池：攻击力(15) + 攻击力%(8) + 防御力(12) + ... = 96
特有池：力量(40)
总权重：136

抽中力量的概率 = 40 / 136 ≈ 29.4%
```

---

### 词条数值计算

#### 主词条数值
```
主词条数值 = 基础值 × 品质倍率 × (1 + 装备等级 × 0.12)
```

#### 副词条数值
```
副词条数值 = 基础值 × 品质倍率 × (1 + 装备等级 × 0.06) × 随机系数(0.8~1.2)
```

#### 品质倍率
| 品质 | 倍率 |
|------|------|
| 普通 | 1.0x |
| 稀有 | 1.3x |
| 史诗 | 1.6x |
| 传说 | 2.0x |
| 神话 | 2.5x |

#### 词条基础值参考
| 词条类型 | 基础值 |
|----------|--------|
| 攻击力% | 5% |
| 攻击力 | 15 |
| 防御力% | 5% |
| 防御力 | 12 |
| 生命值 | 80 |
| 生命值% | 5% |
| 速度 | 8 |
| 速度% | 4% |
| 暴击率 | 4% |
| 暴击伤害 | 8% |
| 力量 | 10 |
| 移动速度 | 6 |
| 技能冷却 | 5% |
| 护甲 | 15 |

---

### 词条生成示例

#### 示例：Lv.5 史诗武器

**主词条（固定）**：
- 攻击力% = 5 × 1.6 × (1 + 5 × 0.12) = 5 × 1.6 × 1.6 = **12.8%**

**副词条（随机4条）**：
| 词条 | 数值计算 | 最终值 |
|------|----------|--------|
| 力量（特有） | 10 × 1.6 × 1.3 × 1.05 | 21 |
| 攻击力 | 15 × 1.6 × 1.3 × 0.95 | 29 |
| 暴击率 | 4 × 1.6 × 1.3 × 1.1 | 9% |
| 生命值 | 80 × 1.6 × 1.3 × 0.85 | 141 |

**最终结果**：
```
史诗之剑 +0
━━━━━━━━━━━━━━━━━━━━
★ 攻击力 +13%      [主词条]
○ 力量 +21         [特有副词条]
○ 攻击力 +29       [通用副词条]
○ 暴击率 +9%       [通用副词条]
○ 生命值 +141      [通用副词条]
```

---

### 强化与词条升级

每强化+3级（+3, +6, +9, +12, +15, +18, +21），随机升级一条副词条：
- 升幅范围：20%~50%
- 随机选择一条副词条提升

**示例**：
```
武器 +2 → +3 成功
随机选择「力量 +21」升级
升幅 35%：21 × 1.35 = 28

结果：力量 +21 → 力量 +28
```

## 扩展性

### 添加新组件
```javascript
// public/js/components.js
class NewComponent {
    constructor(config) {
        this.property = config.value;
    }
}
```

### 添加新系统
```javascript
// public/js/systems.js
class NewSystem {
    constructor() {
        this.world = null;
    }
    
    init() {
        eventBus.on('some:event', (data) => this.handleEvent(data));
    }
    
    update(deltaTime) {
        const entities = this.world.query('newComponent');
        // 处理逻辑
    }
}

// 注册系统
world.addSystem(new NewSystem());
```

### 添加新实体类型
```javascript
// public/js/factory.js
createNewEntity(config) {
    const entity = this.world.createEntity();
    entity.addComponent('type', new TypeComponent('newType'));
    entity.addComponent('new', new NewComponent(config));
    this.world.updateIndex('type', entity.id);
    this.world.updateIndex('new', entity.id);
    return entity;
}
```

## 技术栈

- **前端**: 原生 JavaScript (ES6+), HTML5, CSS3
- **后端**: Node.js, Express
- **数据库**: SQLite (better-sqlite3)
- **架构**: ECS (Entity-Component-System)

## 版本历史

- **v2.0** - 重构为ECS架构，添加用户系统，使用SQLite持久化
- **v1.0** - 基础功能实现

## 许可证

MIT License