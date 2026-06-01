/**
 * Vue 3 应用
 */

const { createApp, ref, computed, onMounted, watch } = Vue;

const API_BASE = 'http://localhost:3000/api';

createApp({
    setup() {
        // ==================== 状态 ====================
        
        // 登录状态
        const isLoggedIn = ref(false);
        const loginTab = ref('login');
        
        // 主页签状态
        const mainTab = ref('character'); // 'character' | 'dungeon'
        
        // 副本数据
        const dungeons = Dungeons;
        const loginUsername = ref('');
        const registerUsername = ref('');
        const loginMessage = ref('');
        const loginMessageType = ref('error');
        const loading = ref(false);
        
        // 用户数据
        const user = ref({
            id: null,
            username: '',
            uuid: '',
            level: 1,
            exp: 0,
            gold: 100,
            currentHp: 200
        });
        
        // 装备数据
        const inventory = ref([]);
        const equippedItems = ref({
            weapon: null,
            helmet: null,
            chestplate: null,
            gloves: null,
            boots: null,
            accessory: null
        });
        const selectedItem = ref(null);
        
        // 副本状态
        const inDungeon = ref(false);
        const currentDungeon = ref(null);
        const dungeonState = ref({
            width: 5,
            height: 5,
            playerPos: { x: 0, y: 0 },
            map: [],
            cells: [],
            defeatedCells: new Set(),
            bossDefeated: false
        });
        
        // 地图视图状态
        const mapScale = ref(1);
        const mapOffset = ref({ x: 0, y: 0 });
        const isDragging = ref(false);
        const dragStart = ref({ x: 0, y: 0 });
        const showMiniMap = ref(true);
        
        // Tooltip状态
        const tooltip = ref({
            visible: false,
            x: 0,
            y: 0,
            item: null
        });
        
        // 战斗状态
        const inBattle = ref(false);
        const battleState = ref({
            monsterName: '',
            monsterIcon: '👹',
            monsterHp: 0,
            monsterMaxHp: 0,
            isBoss: false
        });
        const battleLogs = ref([]);
        const battleResult = ref(null);
        const attacking = ref(false);
        const pendingLoot = ref([]);
        
        // 合成状态
        const synthesis = ref({
            active: false,
            slot1: null,
            slot2: null
        });
        
        // 日志
        const logs = ref([]);
        
        // ==================== 计算属性 ====================
        
        const stats = computed(() => {
            // 基础属性大幅增强，并加入等级加成
            let atk = 50 + user.value.level * 10;  // 基础50 + 每级10
            let def = 30 + user.value.level * 5;    // 基础30 + 每级5
            let hp = 200 + user.value.level * 50;   // 基础200 + 每级50
            let spd = 20 + user.value.level * 2;    // 基础20 + 每级2
            
            // 新增属性
            let critRate = 5;      // 基础暴击率 5%
            let critDmg = 150;     // 基础暴击伤害 150%
            let penetration = 0;  // 穿透
            let dmgReduction = 0; // 伤害减免
            let evadeRate = 0;    // 闪避率
            
            for (const item of Object.values(equippedItems.value)) {
                if (!item) continue;
                
                const mult = QualityMultipliers[item.quality] || 1;
                
                // 主词条
                if (item.mainAffix) {
                    const val = Math.floor(item.mainAffix.value * mult);
                    applyStatBonus(item.mainAffix.stat, val);
                }
                
                // 辅词条
                for (const sub of (item.subAffixes || [])) {
                    const val = Math.floor(sub.value * mult);
                    applyStatBonus(sub.stat, val);
                }
            }
            
            return { atk, def, hp, spd, critRate, critDmg, penetration, dmgReduction, evadeRate };
            
            // 内部函数：应用词条加成
            function applyStatBonus(stat, val) {
                switch (stat) {
                    // 攻击相关
                    case 'ATK_FLAT': atk += val; break;
                    case 'ATK_PERCENT': atk = Math.floor(atk * (1 + val / 100)); break;
                    
                    // 防御相关
                    case 'DEF_FLAT': def += val; break;
                    case 'DEF_PERCENT': def = Math.floor(def * (1 + val / 100)); break;
                    
                    // 生命相关
                    case 'HP_FLAT': hp += val; break;
                    case 'HP_PERCENT': hp = Math.floor(hp * (1 + val / 100)); break;
                    
                    // 速度相关
                    case 'SPD_FLAT': spd += val; break;
                    case 'SPD_PERCENT': spd = Math.floor(spd * (1 + val / 100)); break;
                    
                    // 暴击相关
                    case 'CRIT_RATE': critRate += val; break;
                    case 'CRIT_DMG': critDmg += val; break;
                    
                    // 特有词条
                    case 'PENETRATION': penetration += val; break;
                    case 'DMG_BONUS': atk = Math.floor(atk * (1 + val / 100)); break;
                    case 'DMG_REDUCTION': dmgReduction += val; break;
                    case 'EVADE_RATE': evadeRate += val; break;
                    case 'ALL_STAT':
                        atk += val; def += val; hp += val * 5; spd += val;
                        break;
                    case 'ALL_STAT_PERCENT':
                        atk = Math.floor(atk * (1 + val / 100));
                        def = Math.floor(def * (1 + val / 100));
                        hp = Math.floor(hp * (1 + val / 100));
                        break;
                    
                    // 兼容旧数据
                    case 'atk_flat': atk += val; break;
                    case 'atk_percent': atk = Math.floor(atk * (1 + val / 100)); break;
                    case 'def_flat': def += val; break;
                    case 'def_percent': def = Math.floor(def * (1 + val / 100)); break;
                    case 'hp_flat': hp += val; break;
                    case 'hp_percent': hp = Math.floor(hp * (1 + val / 100)); break;
                    case 'spd_flat': spd += val; break;
                    case 'crit_rate': critRate += val; break;
                    case 'crit_dmg': critDmg += val; break;
                }
            }
        });
        
        const maxHp = computed(() => stats.value.hp);
        
        const expForNext = computed(() => user.value.level * 100);
        
        const expPercent = computed(() => (user.value.exp / expForNext.value) * 100);
        
        const playerHpPercent = computed(() => (user.value.currentHp / maxHp.value) * 100);
        
        const monsterHpPercent = computed(() => {
            if (!battleState.value.monsterMaxHp) return 0;
            return (battleState.value.monsterHp / battleState.value.monsterMaxHp) * 100;
        });
        
        const mapCells = computed(() => {
            if (!dungeonState.value.map) return [];
            
            const cells = [];
            for (let y = 0; y < dungeonState.value.height; y++) {
                for (let x = 0; x < dungeonState.value.width; x++) {
                    const cellType = dungeonState.value.map[y][x];
                    const isPlayer = dungeonState.value.playerPos.x === x && dungeonState.value.playerPos.y === y;
                    const defeated = dungeonState.value.defeatedCells.has(`${x},${y}`);
                    
                    let icon = '';
                    switch (cellType) {
                        case 'W': icon = '🧱'; break;
                        case 'S': icon = '🚪'; break;
                        case 'P': icon = '・'; break;
                        case 'M': icon = defeated ? '💨' : '❓'; break;
                        case 'E': icon = defeated ? '💨' : '⚡'; break;
                        case 'B': icon = defeated ? '✅' : '👹'; break;
                    }
                    if (isPlayer) icon = '🧙';
                    
                    cells.push({
                        x, y,
                        type: cellType.toLowerCase(),
                        icon,
                        isPlayer,
                        defeated
                    });
                }
            }
            return cells;
        });
        
        // 小地图数据
        const miniMapCells = computed(() => {
            if (!dungeonState.value.map) return [];
            
            const cells = [];
            for (let y = 0; y < dungeonState.value.height; y++) {
                for (let x = 0; x < dungeonState.value.width; x++) {
                    const cellType = dungeonState.value.map[y][x];
                    const isPlayer = dungeonState.value.playerPos.x === x && dungeonState.value.playerPos.y === y;
                    const defeated = dungeonState.value.defeatedCells.has(`${x},${y}`);
                    
                    cells.push({
                        x, y,
                        type: cellType.toLowerCase(),
                        isPlayer,
                        defeated
                    });
                }
            }
            return cells;
        });
        
        // 地图容器样式
        const mapContainerStyle = computed(() => ({
            transform: `translate(${mapOffset.value.x}px, ${mapOffset.value.y}px) scale(${mapScale.value})`,
            transformOrigin: '0 0'
        }));
        
        // 副本进度信息
        const dungeonProgress = computed(() => {
            if (!dungeonState.value.totalBosses) return '';
            return `Boss: ${dungeonState.value.defeatedBosses || 0}/${dungeonState.value.totalBosses}`;
        });
        
        // ==================== 方法 ====================
        
        // 登录
        async function handleLogin() {
            if (!loginUsername.value.trim()) {
                loginMessage.value = '请输入用户名';
                loginMessageType.value = 'error';
                return;
            }
            
            loading.value = true;
            loginMessage.value = '登录中...';
            loginMessageType.value = 'success';
            
            try {
                const res = await fetch(`${API_BASE}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: loginUsername.value })
                });
                
                const data = await res.json();
                
                if (data.success) {
                    loginMessage.value = '登录成功！';
                    loginMessageType.value = 'success';
                    
                    user.value = {
                        id: data.data.id,
                        username: data.data.username,
                        uuid: data.data.uuid,
                        level: data.data.level,
                        exp: data.data.exp,
                        gold: data.data.gold,
                        currentHp: data.data.currentHp
                    };
                    
                    // 加载装备
                    inventory.value = (data.data.equipments || []).filter(e => !e.equipped);
                    
                    const equipped = {};
                    for (const eq of (data.data.equipments || [])) {
                        if (eq.equipped) {
                            equipped[eq.slot] = eq;
                        }
                    }
                    equippedItems.value = { ...equippedItems.value, ...equipped };
                    
                    isLoggedIn.value = true;
                    
                    // 保存登录状态到localStorage
                    saveSession(data.data.username);
                    
                    addLog(`欢迎 ${user.value.username}！`, 'success');
                } else {
                    loginMessage.value = data.message;
                    loginMessageType.value = 'error';
                }
            } catch (e) {
                loginMessage.value = '网络错误，请检查服务器是否启动';
                loginMessageType.value = 'error';
            } finally {
                loading.value = false;
            }
        }
        
        // 注册
        async function handleRegister() {
            if (!registerUsername.value.trim()) {
                loginMessage.value = '请输入用户名';
                loginMessageType.value = 'error';
                return;
            }
            
            loading.value = true;
            loginMessage.value = '注册中...';
            loginMessageType.value = 'success';
            
            try {
                const res = await fetch(`${API_BASE}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: registerUsername.value })
                });
                
                const data = await res.json();
                
                if (data.success) {
                    loginMessage.value = '注册成功！正在登录...';
                    loginMessageType.value = 'success';
                    
                    // 自动登录
                    user.value = {
                        id: data.data.id,
                        username: data.data.username,
                        uuid: data.data.uuid,
                        level: data.data.level,
                        exp: data.data.exp,
                        gold: data.data.gold,
                        currentHp: 200
                    };
                    
                    // 给新玩家初始装备并自动穿戴
                    const weapon = createEquipment('weapon', 0, 'rare');
                    const helmet = createEquipment('helmet', 0, 'normal');
                    const chestplate = createEquipment('chestplate', 0, 'normal');
                    
                    equippedItems.value = {
                        weapon: weapon,
                        helmet: helmet,
                        chestplate: chestplate,
                        gloves: null,
                        boots: null,
                        accessory: null
                    };
                    
                    inventory.value = [];
                    
                    isLoggedIn.value = true;
                    
                    // 保存登录状态到localStorage
                    saveSession(data.data.username);
                    
                    addLog(`注册成功！欢迎 ${user.value.username}，已获得新手装备！`, 'success');
                } else {
                    loginMessage.value = data.message;
                    loginMessageType.value = 'error';
                }
            } catch (e) {
                loginMessage.value = '网络错误，请检查服务器是否启动';
                loginMessageType.value = 'error';
            } finally {
                loading.value = false;
            }
        }
        
        // 退出
        function handleLogout() {
            saveGame();
            isLoggedIn.value = false;
            user.value = { id: null, username: '', uuid: '', level: 1, exp: 0, gold: 100, currentHp: 200 };
            inventory.value = [];
            equippedItems.value = { weapon: null, helmet: null, chestplate: null, gloves: null, boots: null, accessory: null };
            loginUsername.value = '';
            registerUsername.value = '';
            loginMessage.value = '';
            
            // 清除登录状态
            clearSession();
        }
        
        // 保存游戏
        async function saveGame() {
            try {
                // 保存用户数据
                await fetch(`${API_BASE}/save`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: user.value.id,
                        data: {
                            level: user.value.level,
                            exp: user.value.exp,
                            gold: user.value.gold,
                            currentHp: user.value.currentHp
                        }
                    })
                });
                
                // 保存装备数据
                const allEquipments = [
                    ...inventory.value,
                    ...Object.values(equippedItems.value).filter(e => e)
                ];
                
                await fetch(`${API_BASE}/equipments/save`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: user.value.id,
                        equipments: allEquipments,
                        equippedSlots: Object.fromEntries(
                            Object.entries(equippedItems.value)
                                .filter(([, v]) => v)
                                .map(([k, v]) => [k, v.id])
                        )
                    })
                });
                
                addLog('💾 游戏已保存', 'success');
            } catch (e) {
                addLog('保存失败', 'fail');
            }
        }
        
        // 自动保存（静默保存，不显示提示）
        let autoSaveTimer = null;
        function autoSave() {
            // 防抖，500ms内多次调用只执行一次
            if (autoSaveTimer) clearTimeout(autoSaveTimer);
            autoSaveTimer = setTimeout(async () => {
                try {
                    // 保存用户数据
                    await fetch(`${API_BASE}/save`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: user.value.id,
                            data: {
                                level: user.value.level,
                                exp: user.value.exp,
                                gold: user.value.gold,
                                currentHp: user.value.currentHp
                            }
                        })
                    });
                    
                    // 保存装备数据
                    const allEquipments = [
                        ...inventory.value,
                        ...Object.values(equippedItems.value).filter(e => e)
                    ];
                    
                    await fetch(`${API_BASE}/equipments/save`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: user.value.id,
                            equipments: allEquipments,
                            equippedSlots: Object.fromEntries(
                                Object.entries(equippedItems.value)
                                    .filter(([, v]) => v)
                                    .map(([k, v]) => [k, v.id])
                            )
                        })
                    });
                } catch (e) {
                    console.error('自动保存失败', e);
                }
            }, 500);
        }
        
        // 恢复生命
        function healPlayer() {
            user.value.currentHp = maxHp.value;
            addLog('💚 生命已恢复', 'success');
            autoSave();
        }
        
        // 选择物品
        function selectItem(item) {
            if (synthesis.value.active) {
                // 合成模式
                if (item.isBroken) {
                    addLog('无法选择损坏装备', 'warning');
                    return;
                }
                if (!synthesis.value.slot1) {
                    synthesis.value.slot1 = item;
                } else if (!synthesis.value.slot2) {
                    if (synthesis.value.slot1.quality !== item.quality) {
                        addLog('品质不同无法合成', 'warning');
                        return;
                    }
                    synthesis.value.slot2 = item;
                }
            } else {
                selectedItem.value = selectedItem.value === item ? null : item;
            }
        }
        
        // 穿戴装备
        function equipItem() {
            if (!selectedItem.value) return;
            
            const item = selectedItem.value;
            const slot = normalizeSlot(item.slot);
            
            // 先卸下当前装备
            if (equippedItems.value[slot]) {
                inventory.value.push(equippedItems.value[slot]);
            }
            
            // 穿上新装备
            const index = inventory.value.findIndex(i => i === item);
            if (index > -1) {
                inventory.value.splice(index, 1);
            }
            
            equippedItems.value[slot] = item;
            selectedItem.value = null;
            
            addLog(`穿戴了 ${getSlotName(slot)}`, 'success');
            autoSave();
        }
        
        // 卸下装备
        function unequipItem(slot) {
            if (!equippedItems.value[slot]) return;
            
            if (inventory.value.length >= 50) {
                addLog('背包已满', 'warning');
                return;
            }
            
            inventory.value.push(equippedItems.value[slot]);
            equippedItems.value[slot] = null;
            
            if (selectedItem.value && selectedItem.value.slot === slot) {
                selectedItem.value = null;
            }
            
            addLog(`卸下了 ${getSlotName(slot)}`, 'info');
            autoSave();
        }
        
        // 强化装备
        function enhanceItem() {
            if (!selectedItem.value || selectedItem.value.isBroken || selectedItem.value.level >= 21) return;
            
            const item = selectedItem.value;
            const currentLevel = item.level;
            const successRate = Math.max(5, 95 - currentLevel * 4);
            const brokenRate = currentLevel >= 10 ? Math.min(70, 5 + (currentLevel - 10) * 7) : 0;
            
            const roll = Math.random() * 100;
            
            if (roll < successRate) {
                const oldLevel = item.level;
                item.level++;
                
                // 升级主词条（每次强化增加5-10%）
                if (item.mainAffix) {
                    const mainIncrease = Math.ceil(item.mainAffix.value * (5 + Math.random() * 5) / 100);
                    item.mainAffix.value += mainIncrease;
                }
                
                // 每+3级升级一个随机副词条
                if (EnhanceUpgradeLevels.includes(item.level)) {
                    if (item.subAffixes && item.subAffixes.length > 0) {
                        const result = upgradeRandomSubAffix(item.subAffixes);
                        if (result) {
                            addLog(`✨ 副词条强化！${getStatName(result.stat)}: ${formatStatValue(result.stat, getFinalStatValue(result.oldValue, item.quality))} → ${formatStatValue(result.stat, getFinalStatValue(result.newValue, item.quality))}`, 'success');
                        }
                    }
                }
                
                addLog(`强化成功！+${item.level}`, 'success');
            } else if (roll < successRate + brokenRate) {
                item.isBroken = true;
                item.level = Math.max(0, item.level - 3);
                addLog('💔 装备损坏！', 'fail');
                
                // 从背包或装备槽移除
                const invIndex = inventory.value.findIndex(i => i === item);
                if (invIndex > -1) {
                    inventory.value.splice(invIndex, 1);
                } else {
                    for (const slot in equippedItems.value) {
                        if (equippedItems.value[slot] === item) {
                            equippedItems.value[slot] = null;
                        }
                    }
                }
                selectedItem.value = null;
            } else {
                item.level = Math.max(0, item.level - 1);
                addLog(`强化失败 +${item.level}`, 'warning');
            }
            autoSave();
        }
        
        // 删除装备
        function deleteItem() {
            if (!selectedItem.value) return;
            
            const item = selectedItem.value;
            
            const invIndex = inventory.value.findIndex(i => i === item);
            if (invIndex > -1) {
                inventory.value.splice(invIndex, 1);
            }
            
            selectedItem.value = null;
            addLog('丢弃了装备', 'warning');
            autoSave();
        }
        
        // 开始合成
        function startSynthesis() {
            if (!selectedItem.value) return;
            synthesis.value.active = true;
            synthesis.value.slot1 = selectedItem.value;
            synthesis.value.slot2 = null;
            selectedItem.value = null;
        }
        
        // 取消合成
        function cancelSynthesis() {
            synthesis.value.active = false;
            synthesis.value.slot1 = null;
            synthesis.value.slot2 = null;
        }
        
        // 执行合成
        function doSynthesis() {
            if (!synthesis.value.slot1 || !synthesis.value.slot2) return;
            
            // 移除原装备
            const removeItem = (item) => {
                const idx = inventory.value.findIndex(i => i === item);
                if (idx > -1) inventory.value.splice(idx, 1);
            };
            
            removeItem(synthesis.value.slot1);
            removeItem(synthesis.value.slot2);
            
            // 创建新装备
            const slots = Object.values(EquipmentSlot);
            const randomSlot = slots[Math.floor(Math.random() * slots.length)];
            const avgLevel = Math.floor((synthesis.value.slot1.level + synthesis.value.slot2.level) / 4);
            
            const newItem = createEquipment(randomSlot, Math.max(0, avgLevel), synthesis.value.slot1.quality);
            inventory.value.push(newItem);
            
            addLog(`合成成功！获得 ${getQualityName(newItem.quality)} ${getSlotName(newItem.slot)}`, 'success');
            
            cancelSynthesis();
            autoSave();
        }
        
        // 清空合成槽
        function clearSynthesis(slot) {
            if (slot === 1) synthesis.value.slot1 = null;
            else synthesis.value.slot2 = null;
        }
        
        // 进入副本
        function enterDungeon(dungeon) {
            if (user.value.level < dungeon.level) {
                addLog(`等级不足，需要 ${dungeon.level} 级`, 'warning');
                return;
            }
            
            // 切换到副本页签
            mainTab.value = 'dungeon';
            
            currentDungeon.value = dungeon;
            inDungeon.value = true;
            
            // 初始化地图
            initDungeonMap(dungeon);
            
            addLog(`进入 ${dungeon.name}`, 'info');
        }
        
        // 初始化地图
        function initDungeonMap(dungeon) {
            let map, width, height;
            
            if (dungeon.isRandom) {
                // 随机生成地图
                const config = MapConfig[dungeon.mapSize] || MapConfig.small;
                width = config.width;
                height = config.height;
                map = generateRandomMap(config, dungeon);
            } else {
                // 使用模板地图
                map = dungeon.mapTemplate || generateRandomMap(MapConfig.small, dungeon);
                width = dungeon.width || 5;
                height = dungeon.height || 5;
            }
            
            // 重置地图缩放和偏移
            mapScale.value = Math.min(1, 400 / (width * 40));
            mapOffset.value = { x: 0, y: 0 };
            
            dungeonState.value = {
                width: width,
                height: height,
                map: map,
                cells: map.map(row => row.map(cell => ({ explored: false, visible: false }))),
                playerPos: { x: 1, y: 1 },
                defeatedCells: new Set(),
                bossDefeated: false,
                isRandom: dungeon.isRandom,
                totalBosses: countBosses(map),
                defeatedBosses: 0
            };
            
            // 找入口
            for (let y = 0; y < dungeonState.value.height; y++) {
                for (let x = 0; x < dungeonState.value.width; x++) {
                    if (map[y][x] === 'S') {
                        dungeonState.value.playerPos = { x, y };
                    }
                }
            }
            
            updateVisibility();
        }
        
        // 统计Boss数量
        function countBosses(map) {
            let count = 0;
            for (const row of map) {
                for (const cell of row) {
                    if (cell === 'B') count++;
                }
            }
            return count;
        }
        
        // 生成随机地图
        function generateRandomMap(config, dungeon) {
            const { width, height, wallDensity, monsterCount, eliteCount, bossCount } = config;
            
            // 初始化地图（全部为可通行区域）
            const map = [];
            for (let y = 0; y < height; y++) {
                const row = [];
                for (let x = 0; x < width; x++) {
                    row.push('P');
                }
                map.push(row);
            }
            
            // 设置边界墙
            for (let x = 0; x < width; x++) {
                map[0][x] = 'W';
                map[height - 1][x] = 'W';
            }
            for (let y = 0; y < height; y++) {
                map[y][0] = 'W';
                map[y][width - 1] = 'W';
            }
            
            // 随机生成墙体（确保不会完全阻挡路径）
            const wallCount = Math.floor((width - 2) * (height - 2) * wallDensity);
            for (let i = 0; i < wallCount; i++) {
                const x = Math.floor(Math.random() * (width - 4)) + 2;
                const y = Math.floor(Math.random() * (height - 4)) + 2;
                map[y][x] = 'W';
            }
            
            // 设置入口
            map[1][1] = 'S';
            
            // 放置怪物（确保位置可达）
            const usedPositions = new Set(['1,1']);
            
            // 放置Boss
            for (let i = 0; i < bossCount; i++) {
                let attempts = 0;
                while (attempts < 100) {
                    const x = Math.floor(Math.random() * (width - 4)) + 2;
                    const y = Math.floor(Math.random() * (height - 4)) + 2;
                    const key = `${x},${y}`;
                    
                    if (!usedPositions.has(key) && map[y][x] === 'P') {
                        map[y][x] = 'B';
                        usedPositions.add(key);
                        break;
                    }
                    attempts++;
                }
            }
            
            // 放置精英怪
            for (let i = 0; i < eliteCount; i++) {
                let attempts = 0;
                while (attempts < 100) {
                    const x = Math.floor(Math.random() * (width - 4)) + 2;
                    const y = Math.floor(Math.random() * (height - 4)) + 2;
                    const key = `${x},${y}`;
                    
                    if (!usedPositions.has(key) && map[y][x] === 'P') {
                        map[y][x] = 'E';
                        usedPositions.add(key);
                        break;
                    }
                    attempts++;
                }
            }
            
            // 放置普通怪物
            for (let i = 0; i < monsterCount; i++) {
                let attempts = 0;
                while (attempts < 100) {
                    const x = Math.floor(Math.random() * (width - 4)) + 2;
                    const y = Math.floor(Math.random() * (height - 4)) + 2;
                    const key = `${x},${y}`;
                    
                    if (!usedPositions.has(key) && map[y][x] === 'P') {
                        map[y][x] = 'M';
                        usedPositions.add(key);
                        break;
                    }
                    attempts++;
                }
            }
            
            // 确保从入口到所有Boss的路径可达（使用BFS验证）
            ensurePathExists(map, width, height);
            
            return map;
        }
        
        // 确保路径可达
        function ensurePathExists(map, width, height) {
            // 找到入口位置
            let startX = 1, startY = 1;
            
            // 找到所有Boss位置
            const bossPositions = [];
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    if (map[y][x] === 'B') {
                        bossPositions.push({ x, y });
                    }
                }
            }
            
            // 对每个Boss，确保有路径可达
            for (const boss of bossPositions) {
                if (!hasPath(map, startX, startY, boss.x, boss.y, width, height)) {
                    // 创建路径
                    createPath(map, startX, startY, boss.x, boss.y, width, height);
                }
            }
        }
        
        // BFS检查路径是否存在
        function hasPath(map, sx, sy, ex, ey, width, height) {
            const visited = new Set();
            const queue = [{ x: sx, y: sy }];
            visited.add(`${sx},${sy}`);
            
            while (queue.length > 0) {
                const { x, y } = queue.shift();
                
                if (x === ex && y === ey) return true;
                
                const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
                for (const [dx, dy] of dirs) {
                    const nx = x + dx;
                    const ny = y + dy;
                    const key = `${nx},${ny}`;
                    
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height &&
                        !visited.has(key) && map[ny][nx] !== 'W') {
                        visited.add(key);
                        queue.push({ x: nx, y: ny });
                    }
                }
            }
            
            return false;
        }
        
        // 创建路径（只穿过墙体，不穿过其他实体）
        function createPath(map, sx, sy, ex, ey, width, height) {
            let x = sx, y = sy;
            
            while (x !== ex || y !== ey) {
                // 随机选择方向，优先向目标靠近
                const dirs = [];
                if (x < ex) dirs.push([1, 0]);
                if (x > ex) dirs.push([-1, 0]);
                if (y < ey) dirs.push([0, 1]);
                if (y > ey) dirs.push([0, -1]);
                
                // 添加一些随机性
                if (Math.random() < 0.3) {
                    if (x < ex) dirs.push([1, 0]);
                    if (y < ey) dirs.push([0, 1]);
                }
                
                const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
                x += dx;
                y += dy;
                
                // 如果当前位置是墙，改为可通行
                if (map[y][x] === 'W') {
                    map[y][x] = 'P';
                }
            }
        }
        
        // 更新可见性
        function updateVisibility() {
            const { x, y } = dungeonState.value.playerPos;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx >= 0 && nx < dungeonState.value.width && ny >= 0 && ny < dungeonState.value.height) {
                        dungeonState.value.cells[ny][nx].visible = true;
                        dungeonState.value.cells[ny][nx].explored = true;
                    }
                }
            }
        }
        
        // 移动玩家
        function movePlayer(dx, dy) {
            if (inBattle.value) return;
            
            const newX = dungeonState.value.playerPos.x + dx;
            const newY = dungeonState.value.playerPos.y + dy;
            
            if (newX < 0 || newX >= dungeonState.value.width || newY < 0 || newY >= dungeonState.value.height) return;
            if (dungeonState.value.map[newY][newX] === 'W') return;
            
            dungeonState.value.playerPos = { x: newX, y: newY };
            updateVisibility();
            
            // 检查战斗
            const cell = dungeonState.value.map[newY][newX];
            const cellKey = `${newX},${newY}`;
            
            if ((cell === 'M' || cell === 'E' || cell === 'B') && !dungeonState.value.defeatedCells.has(cellKey)) {
                triggerBattle(cell === 'B');
            }
        }
        
        // 触发战斗
        function triggerBattle(isBoss) {
            inBattle.value = true;
            battleLogs.value = [];
            battleResult.value = null;
            
            const dungeon = currentDungeon.value;
            let monster;
            
            if (isBoss) {
                const bossConfig = Monsters.find(m => m.id === dungeon.boss);
                monster = { ...bossConfig, type: 'boss' };
            } else {
                const monsterId = dungeon.monsters[Math.floor(Math.random() * dungeon.monsters.length)];
                monster = { ...Monsters.find(m => m.id === monsterId), type: 'normal' };
            }
            
            // Boss加强
            if (isBoss) {
                monster.hp = Math.floor(monster.hp * 1.5);
                monster.atk = Math.floor(monster.atk * 1.3);
                monster.exp = Math.floor(monster.exp * 2);
                monster.gold = Math.floor(monster.gold * 2);
            }
            
            battleState.value = {
                monsterName: isBoss ? dungeon.bossName : monster.name,
                monsterIcon: isBoss ? dungeon.bossIcon : monster.icon,
                monsterHp: monster.hp,
                monsterMaxHp: monster.hp,
                monsterAtk: monster.atk,
                monsterDef: monster.def,
                monsterExp: monster.exp,
                monsterGold: monster.gold,
                monsterQuality: monster.qualityWeights,
                monsterDropRate: monster.dropRate,
                isBoss: isBoss
            };
            
            addLog(`遭遇 ${battleState.value.monsterName}！`, 'warning');
        }
        
        // 执行攻击
        function executeAttack() {
            if (attacking.value) return;
            attacking.value = true;
            
            const playerAtk = stats.value.atk;
            const playerDef = stats.value.def;
            const playerSpd = stats.value.spd;
            const monsterAtk = battleState.value.monsterAtk;
            const monsterDef = battleState.value.monsterDef;
            
            // 玩家攻击
            let playerDmg = Math.max(1, playerAtk - monsterDef * 0.3);
            
            // 暴击率基于速度 (最高30%)
            const critChance = Math.min(30, 5 + playerSpd * 0.5);
            const isCrit = Math.random() * 100 < critChance;
            if (isCrit) {
                playerDmg = Math.floor(playerDmg * 2);
                battleLogs.value.push({ text: `💥 暴击！对 ${battleState.value.monsterName} 造成 ${playerDmg} 伤害`, type: 'crit' });
            } else {
                battleLogs.value.push({ text: `⚔️ 对 ${battleState.value.monsterName} 造成 ${Math.floor(playerDmg)} 伤害`, type: 'player' });
            }
            
            battleState.value.monsterHp -= playerDmg;
            
            // 检查胜利
            if (battleState.value.monsterHp <= 0) {
                setTimeout(() => endBattle(true), 500);
                return;
            }
            
            // 怪物攻击
            setTimeout(() => {
                // 闪避率基于速度 (最高25%)
                const dodgeChance = Math.min(25, playerSpd * 0.3);
                
                if (Math.random() * 100 < dodgeChance) {
                    battleLogs.value.push({ text: `💨 你闪避了 ${battleState.value.monsterName} 的攻击！`, type: 'player' });
                } else {
                    let monsterDmg = Math.max(1, monsterAtk - playerDef * 0.5);
                    // 怪物伤害降低20%
                    monsterDmg = Math.floor(monsterDmg * 0.8);
                    user.value.currentHp -= monsterDmg;
                    battleLogs.value.push({ text: `👊 ${battleState.value.monsterName} 对你造成 ${monsterDmg} 伤害`, type: 'monster' });
                    
                    // 检查失败
                    if (user.value.currentHp <= 0) {
                        user.value.currentHp = 1;
                        endBattle(false);
                    }
                }
                
                attacking.value = false;
            }, 300);
        }
        
        // 结束战斗
        function endBattle(victory) {
            attacking.value = false;
            
            if (victory) {
                const drops = [];
                
                // 掉落检查
                if (Math.random() * 100 < battleState.value.monsterDropRate) {
                    const quality = rollQuality(battleState.value.monsterQuality);
                    const slot = Object.values(EquipmentSlot)[Math.floor(Math.random() * 6)];
                    drops.push(createEquipment(slot, Math.floor(Math.random() * 3), quality));
                }
                
                // Boss必掉
                if (battleState.value.isBoss) {
                    const quality = rollQuality(battleState.value.monsterQuality);
                    const slot = Object.values(EquipmentSlot)[Math.floor(Math.random() * 6)];
                    drops.push(createEquipment(slot, Math.floor(Math.random() * 5), quality));
                    
                    // 增加击败Boss计数
                    dungeonState.value.defeatedBosses = (dungeonState.value.defeatedBosses || 0) + 1;
                }
                
                battleResult.value = {
                    victory: true,
                    exp: battleState.value.monsterExp,
                    gold: battleState.value.monsterGold,
                    drops: drops
                };
                
                pendingLoot.value = drops;
                
                battleLogs.value.push({ text: `🎉 胜利！`, type: 'victory' });
                
                // 标记已击败
                const { x, y } = dungeonState.value.playerPos;
                dungeonState.value.defeatedCells.add(`${x},${y}`);
                
                // 检查是否所有Boss都被击败
                if (battleState.value.isBoss && dungeonState.value.defeatedBosses >= dungeonState.value.totalBosses) {
                    dungeonState.value.bossDefeated = true;
                }
                
            } else {
                battleResult.value = {
                    victory: false,
                    exp: 0,
                    gold: 0,
                    drops: []
                };
                
                battleLogs.value.push({ text: '💀 战斗失败', type: 'defeat' });
                
                // 战斗失败后延迟退出副本
                setTimeout(() => {
                    inBattle.value = false;
                    inDungeon.value = false;
                    currentDungeon.value = null;
                    battleResult.value = null;
                    mapScale.value = 1;
                    mapOffset.value = { x: 0, y: 0 };
                    addLog('💀 战斗失败，已退出副本', 'fail');
                }, 1500);
            }
        }
        
        // 掷品质
        function rollQuality(weights) {
            const roll = Math.floor(Math.random() * 100) + 1;
            let acc = 0;
            const qualities = ['normal', 'rare', 'epic', 'legendary', 'mythic'];
            for (const q of qualities) {
                acc += weights[q] || 0;
                if (roll <= acc) return q;
            }
            return 'normal';
        }
        
        // 创建装备（使用词条系统）
        function createEquipment(slot, level, quality) {
            // 使用新的词条生成系统
            const mainAffix = generateMainAffix(slot, level + 1, quality);
            const subAffixes = generateSubAffixes(slot, level + 1, quality, [mainAffix?.stat]);
            
            return {
                id: Date.now() + Math.random(),
                slot: slot,
                level: level || 0,
                quality: quality || 'normal',
                isBroken: false,
                mainAffix: mainAffix,
                subAffixes: subAffixes
            };
        }
        
        // 拾取掉落
        function pickupLoot() {
            for (const item of pendingLoot.value) {
                if (inventory.value.length < 50) {
                    inventory.value.push(item);
                }
            }
            
            // 加经验和金币
            addExp(battleResult.value.exp);
            user.value.gold += battleResult.value.gold;
            
            closeBattle();
            autoSave();
        }
        
        // 放弃掉落
        function abandonLoot() {
            addExp(battleResult.value.exp);
            user.value.gold += battleResult.value.gold;
            closeBattle();
            autoSave();
        }
        
        // 继续战斗后
        function continueAfterBattle() {
            closeBattle();
        }
        
        // 关闭战斗
        function closeBattle() {
            inBattle.value = false;
            battleResult.value = null;
            pendingLoot.value = [];
        }
        
        // 复活
        function respawn() {
            user.value.currentHp = maxHp.value;
            inBattle.value = false;
            inDungeon.value = false;
            currentDungeon.value = null;
            battleResult.value = null;
            mapScale.value = 1;
            mapOffset.value = { x: 0, y: 0 };
            addLog('💚 已复活，生命值已恢复', 'success');
            autoSave();
        }
        
        // 增加经验
        function addExp(amount) {
            user.value.exp += amount;
            while (user.value.exp >= expForNext.value) {
                user.value.exp -= expForNext.value;
                user.value.level++;
                addLog(`🎉 升级到 ${user.value.level} 级！`, 'success');
            }
        }
        
        // 退出副本
        function exitDungeon() {
            inDungeon.value = false;
            inBattle.value = false;
            currentDungeon.value = null;
            mapScale.value = 1;
            mapOffset.value = { x: 0, y: 0 };
            addLog('退出副本', 'info');
            autoSave();
        }
        
        // 地图缩放
        function zoomMap(delta) {
            const newScale = mapScale.value + delta;
            mapScale.value = Math.max(0.2, Math.min(3, newScale));
        }
        
        // 重置地图视图
        function resetMapView() {
            mapScale.value = Math.min(1, 400 / (dungeonState.value.width * 40));
            mapOffset.value = { x: 0, y: 0 };
        }
        
        // 居中地图到玩家
        function centerOnPlayer() {
            const { x, y } = dungeonState.value.playerPos;
            const cellSize = 40 * mapScale.value;
            const containerWidth = 600;
            const containerHeight = 400;
            
            mapOffset.value = {
                x: containerWidth / 2 - x * cellSize - cellSize / 2,
                y: containerHeight / 2 - y * cellSize - cellSize / 2
            };
        }
        
        // 开始拖动
        function startDrag(e) {
            isDragging.value = true;
            dragStart.value = {
                x: e.clientX - mapOffset.value.x,
                y: e.clientY - mapOffset.value.y
            };
        }
        
        // 拖动中
        function onDrag(e) {
            if (!isDragging.value) return;
            mapOffset.value = {
                x: e.clientX - dragStart.value.x,
                y: e.clientY - dragStart.value.y
            };
        }
        
        // 结束拖动
        function endDrag() {
            isDragging.value = false;
        }
        
        // 滚轮缩放
        function onWheel(e) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            zoomMap(delta);
        }
        
        // 添加日志
        function addLog(message, type = 'info') {
            logs.value.unshift({ message, type, time: new Date().toLocaleTimeString() });
            if (logs.value.length > 50) logs.value.pop();
        }
        
        // ==================== 辅助函数 ====================
        
        function getSlotIcon(slot) {
            const normalizedSlot = normalizeSlot(slot);
            return SlotIcons[normalizedSlot] || '❓';
        }
        
        function getSlotName(slot) {
            const normalizedSlot = normalizeSlot(slot);
            return SlotNames[normalizedSlot] || slot;
        }
        
        // 标准化槽位名称（兼容大写）
        function normalizeSlot(slot) {
            if (!slot) return slot;
            const slotMap = {
                'WEAPON': 'weapon',
                'HELMET': 'helmet',
                'CHESTPLATE': 'chestplate',
                'GLOVES': 'gloves',
                'BOOTS': 'boots',
                'ACCESSORY': 'accessory'
            };
            return slotMap[slot] || slot.toLowerCase();
        }
        
        function getQualityColor(quality) {
            return QualityColors[quality] || '#888';
        }
        
        function getQualityName(quality) {
            return QualityNames[quality] || quality;
        }
        
        // 获取强化等级CSS类
        function getEnhanceClass(level) {
            if (!level && level !== 0) return 'level-default';
            if (level >= 20) return 'level-mythic';
            if (level >= 16) return 'level-legendary';
            if (level >= 11) return 'level-epic';
            if (level >= 6) return 'level-rare';
            return 'level-default';
        }
        
        // 获取品质光晕效果
        function getQualityGlow(quality) {
            const glows = {
                normal: 'none',
                rare: 'radial-gradient(circle, rgba(79, 195, 247, 0.3) 0%, transparent 70%)',
                epic: 'radial-gradient(circle, rgba(186, 104, 200, 0.4) 0%, transparent 70%)',
                legendary: 'radial-gradient(circle, rgba(255, 152, 0, 0.5) 0%, transparent 70%)',
                mythic: 'radial-gradient(circle, rgba(244, 67, 54, 0.6) 0%, transparent 70%)'
            };
            return glows[quality] || 'none';
        }
        
        // 获取属性名称（使用data.js中的StatNames）
        function getStatName(stat) {
            return StatNames[stat] || stat;
        }
        
        // 格式化属性值
        function formatStatValue(stat, value) {
            // 如果value已经是数字，直接判断是否为百分比类型
            if (PercentStats && PercentStats.includes(stat)) {
                return value + '%';
            }
            return value;
        }
        
        // 计算属性最终值
        function getFinalStatValue(value, quality) {
            const safeValue = (typeof value === 'number' && !isNaN(value)) ? value : 0;
            const mult = QualityMultipliers[quality] || 1;
            return Math.max(0, Math.floor(safeValue * mult));
        }
        
        // 显示Tooltip
        function showTooltip(event, item) {
            if (!item) return;
            
            // 使用currentTarget确保获取正确的元素
            const target = event.currentTarget || event.target;
            const rect = target.getBoundingClientRect();
            
            // 计算位置，确保不超出屏幕
            let x = rect.right + 15;
            let y = rect.top;
            
            // 检查是否超出右边界
            if (x + 280 > window.innerWidth) {
                x = rect.left - 290;
            }
            
            // 检查是否超出下边界
            if (y + 280 > window.innerHeight) {
                y = window.innerHeight - 290;
            }
            
            tooltip.value = {
                visible: true,
                x: x,
                y: Math.max(10, y),
                item: item
            };
        }
        
        // 隐藏Tooltip
        function hideTooltip() {
            tooltip.value.visible = false;
            tooltip.value.item = null;
        }
        
        // ==================== 生命周期 ====================
        
        // 保存会话到localStorage
        function saveSession(username) {
            localStorage.setItem('game_username', username);
        }
        
        // 清除会话
        function clearSession() {
            localStorage.removeItem('game_username');
        }
        
        // 恢复会话
        async function restoreSession() {
            const savedUsername = localStorage.getItem('game_username');
            if (!savedUsername) return;
            
            try {
                const res = await fetch(`${API_BASE}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: savedUsername })
                });
                
                const data = await res.json();
                
                if (data.success) {
                    user.value = {
                        id: data.data.id,
                        username: data.data.username,
                        uuid: data.data.uuid,
                        level: data.data.level,
                        exp: data.data.exp,
                        gold: data.data.gold,
                        currentHp: data.data.currentHp
                    };
                    
                    inventory.value = (data.data.equipments || []).filter(e => !e.equipped);
                    
                    const equipped = {};
                    for (const eq of (data.data.equipments || [])) {
                        if (eq.equipped) {
                            equipped[eq.slot] = eq;
                        }
                    }
                    equippedItems.value = { ...equippedItems.value, ...equipped };
                    
                    isLoggedIn.value = true;
                    addLog(`自动登录成功，欢迎 ${user.value.username}！`, 'success');
                } else {
                    // 登录失败，清除保存的用户名
                    clearSession();
                }
            } catch (e) {
                console.error('自动登录失败', e);
                clearSession();
            }
        }
        
        // 键盘移动处理
        function handleKeydown(e) {
            // 只在副本页签且不在战斗中时响应
            if (mainTab.value !== 'dungeon' || !inDungeon.value || inBattle.value) return;
            
            const keyMap = {
                'KeyW': [0, -1],
                'KeyA': [-1, 0],
                'KeyS': [0, 1],
                'KeyD': [1, 0],
                'ArrowUp': [0, -1],
                'ArrowLeft': [-1, 0],
                'ArrowDown': [0, 1],
                'ArrowRight': [1, 0]
            };
            
            const move = keyMap[e.code];
            if (move) {
                e.preventDefault();
                movePlayer(move[0], move[1]);
            }
        }
        
        onMounted(() => {
            addLog('游戏加载完成，请登录或注册', 'info');
            // 尝试恢复登录状态
            restoreSession();
            
            // 添加键盘监听
            window.addEventListener('keydown', handleKeydown);
        });
        
        // 返回所有状态和方法
        return {
            // 状态
            isLoggedIn,
            loginTab,
            mainTab,
            loginUsername,
            registerUsername,
            loginMessage,
            loginMessageType,
            loading,
            user,
            inventory,
            equippedItems,
            selectedItem,
            inDungeon,
            currentDungeon,
            dungeonState,
            inBattle,
            battleState,
            battleLogs,
            battleResult,
            attacking,
            synthesis,
            logs,
            dungeons,
            
            // 地图状态
            mapScale,
            mapOffset,
            isDragging,
            showMiniMap,
            
            // Tooltip状态
            tooltip,
            
            // 计算属性
            stats,
            maxHp,
            expForNext,
            expPercent,
            playerHpPercent,
            monsterHpPercent,
            mapCells,
            miniMapCells,
            mapContainerStyle,
            dungeonProgress,
            
            // 方法
            handleLogin,
            handleRegister,
            handleLogout,
            saveGame,
            healPlayer,
            selectItem,
            equipItem,
            unequipItem,
            enhanceItem,
            deleteItem,
            startSynthesis,
            cancelSynthesis,
            doSynthesis,
            clearSynthesis,
            enterDungeon,
            movePlayer,
            executeAttack,
            pickupLoot,
            abandonLoot,
            continueAfterBattle,
            respawn,
            exitDungeon,
            
            // 地图控制
            zoomMap,
            resetMapView,
            centerOnPlayer,
            startDrag,
            onDrag,
            endDrag,
            onWheel,
            
            // 辅助
            getSlotIcon,
            getSlotName,
            normalizeSlot,
            getQualityColor,
            getQualityName,
            getEnhanceClass,
            getQualityGlow,
            getStatName,
            formatStatValue,
            getFinalStatValue,
            showTooltip,
            hideTooltip,
            QualityMultipliers
        };
    }
}).mount('#app');
