/**
 * Express 服务器
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { User, Equipment, Dungeon, generateUUID } = require('./database');

const app = express();

// 中间件
app.use(cors());
app.use(express.json());

// 静态文件
app.use(express.static(path.join(__dirname, '..', 'public')));

// ==================== API 路由 ====================

// --- 用户 API ---

// 注册
app.post('/api/register', (req, res) => {
    const { username } = req.body;

    if (!username || !username.trim()) {
        return res.status(400).json({ success: false, message: '用户名不能为空' });
    }

    const trimmedName = username.trim();

    // 验证用户名
    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(trimmedName)) {
        return res.status(400).json({ success: false, message: '用户名只能包含字母、数字、下划线和中文' });
    }

    if (trimmedName.length > 20) {
        return res.status(400).json({ success: false, message: '用户名最长20个字符' });
    }

    // 检查是否存在
    const existing = User.findByUsername(trimmedName);
    if (existing) {
        return res.status(400).json({ success: false, message: '用户名已存在' });
    }

    // 创建用户
    const user = User.create(trimmedName);

    console.log(`[注册] 用户 ${trimmedName} 注册成功`);

    res.json({
        success: true,
        message: '注册成功',
        data: {
            id: user.id,
            username: user.username,
            uuid: user.uuid,
            level: 1,
            exp: 0,
            gold: 100,
            currentHp: 200
        }
    });
});

// 登录
app.post('/api/login', (req, res) => {
    const { username } = req.body;

    if (!username || !username.trim()) {
        return res.status(400).json({ success: false, message: '用户名不能为空' });
    }

    const user = User.findByUsername(username.trim());

    if (!user) {
        return res.status(404).json({ success: false, message: '用户不存在，请先注册' });
    }

    // 更新登录时间
    User.updateLoginTime(user.id);

    // 获取装备数据
    const equipments = Equipment.getByUserId(user.id);

    console.log(`[登录] 用户 ${user.username} 登录成功`);

    res.json({
        success: true,
        message: '登录成功',
        data: {
            id: user.id,
            username: user.username,
            uuid: user.uuid,
            level: user.level,
            exp: user.exp,
            gold: user.gold,
            currentHp: user.current_hp,
            equipments: equipments
        }
    });
});

// 保存用户数据
app.post('/api/save', (req, res) => {
    const { userId, data } = req.body;

    if (!userId) {
        return res.status(400).json({ success: false, message: '缺少用户ID' });
    }

    // 更新用户数据
    User.update(userId, {
        level: data.level,
        exp: data.exp,
        gold: data.gold,
        current_hp: data.currentHp
    });

    res.json({ success: true, message: '保存成功' });
});

// 获取用户数据
app.get('/api/user/:id', (req, res) => {
    const user = User.findById(req.params.id);

    if (!user) {
        return res.status(404).json({ success: false, message: '用户不存在' });
    }

    const equipments = Equipment.getByUserId(user.id);

    res.json({
        success: true,
        data: {
            id: user.id,
            username: user.username,
            uuid: user.uuid,
            level: user.level,
            exp: user.exp,
            gold: user.gold,
            currentHp: user.current_hp,
            equipments: equipments
        }
    });
});

// 获取所有用户
app.get('/api/users', (req, res) => {
    const users = User.getAll();
    res.json({ success: true, data: users });
});

// --- 装备 API ---

// 添加装备
app.post('/api/equipment', (req, res) => {
    const { userId, equipment } = req.body;

    if (!userId || !equipment) {
        return res.status(400).json({ success: false, message: '参数不完整' });
    }

    const newEquip = Equipment.create(userId, equipment);

    res.json({ success: true, data: newEquip });
});

// 更新装备
app.put('/api/equipment/:id', (req, res) => {
    const { id } = req.params;
    const { level, quality, isBroken, equipped } = req.body;

    Equipment.update(id, { level, quality, is_broken: isBroken ? 1 : 0, equipped: equipped ? 1 : 0 });

    res.json({ success: true });
});

// 删除装备
app.delete('/api/equipment/:id', (req, res) => {
    Equipment.delete(req.params.id);
    res.json({ success: true });
});

// 批量保存装备
app.post('/api/equipments/save', (req, res) => {
    const { userId, equipments, equippedSlots } = req.body;

    if (!userId) {
        return res.status(400).json({ success: false, message: '缺少用户ID' });
    }

    // 先删除所有旧装备
    Equipment.deleteByUserId(userId);

    // 批量插入新装备
    for (const eq of equipments) {
        const isEquipped = equippedSlots && Object.values(equippedSlots).includes(eq.id);
        Equipment.create(userId, {
            ...eq,
            equipped: isEquipped
        });
    }

    res.json({ success: true, message: '装备保存成功' });
});

// --- 副本进度 API ---

app.get('/api/dungeon/progress/:userId', (req, res) => {
    const progress = Dungeon.getProgress(req.params.userId);
    res.json({ success: true, data: progress });
});

app.post('/api/dungeon/progress', (req, res) => {
    const { userId, dungeonId, cleared } = req.body;
    Dungeon.updateProgress(userId, dungeonId, cleared);
    res.json({ success: true });
});

// 主页
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('========================================');
    console.log(`  服务器已启动: http://localhost:${PORT}`);
    console.log('========================================');
});
