'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import useGame, { EquipmentItem, LogEntry, BattleState, SkillData, BroadcastMessage, BroadcastItem } from '@/lib/useGame';
import { EquipmentSlot, Quality } from '@/types';
import { MapCell, GameMap } from '@/types/map';
import styles from './Game.module.css';
import PixiMap from './PixiMap';
import pixiStyles from './PixiMap.module.css';

// 品质配置
const QualityNames: Record<Quality, string> = {
  normal: '普通',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
  mythic: '神话',
};

const QualityColors: Record<Quality, string> = {
  normal: '#9e9e9e',
  rare: '#4fc3f7',
  epic: '#ba68c8',
  legendary: '#ff9800',
  mythic: '#ff4444',
};

// 槽位配置
const SlotNames: Record<EquipmentSlot, string> = {
  weapon: '武器',
  helmet: '头盔',
  chestplate: '胸甲',
  gloves: '护手',
  boots: '鞋子',
  accessory: '首饰',
};

const SlotIcons: Record<EquipmentSlot, string> = {
  weapon: '⚔️',
  helmet: '🪖',
  chestplate: '🛡️',
  gloves: '🧤',
  boots: '👢',
  accessory: '💍',
};

// 固定槽位顺序
const SLOT_ORDER: EquipmentSlot[] = ['weapon', 'helmet', 'chestplate', 'gloves', 'boots', 'accessory'];

// 词条名称
const StatNames: Record<string, string> = {
  ATK_PERCENT: '攻击力%',
  ATK_FLAT: '攻击力',
  DEF_PERCENT: '防御力%',
  DEF_FLAT: '防御力',
  HP_FLAT: '生命值',
  HP_PERCENT: '生命值%',
  SPD_FLAT: '速度',
  SPD_PERCENT: '速度%',
  CRIT_RATE: '暴击率',
  CRIT_DMG: '暴击伤害',
  STRENGTH: '力量',
  MOVE_SPEED: '移动速度',
  SKILL_CD: '技能冷却',
  ARMOR: '护甲',
};

const MAP_NAMES: Record<number, string> = {
  1: '新手草原',
  2: '幽暗森林',
  3: '灼热沙漠',
  4: '冰霜高原',
  5: '熔岩地带',
  6: '暗影深渊',
};

// 背包页签类型
type InventoryTab = 'all' | 'weapon' | 'armor' | 'accessory';

// 背包页签名称
const InventoryTabNames: Record<InventoryTab, string> = {
  all: '全部',
  weapon: '武器',
  armor: '护甲',
  accessory: '首饰',
};

// 槽位分类
const SlotCategories: Record<EquipmentSlot, InventoryTab> = {
  weapon: 'weapon',
  helmet: 'armor',
  chestplate: 'armor',
  gloves: 'armor',
  boots: 'armor',
  accessory: 'accessory',
};

export default function Game() {
  const {
    state,
    login,
    register,
    saveGame,
    healPlayer,
    equipItem,
    unequipItem,
    enhanceItem,
    sellItem,
    sellBatch,
    getSellBatchPreview,
    deleteItem,
    generateWorldMap,
    enterNextMap,
    restartCurrentMap,
    movePlayer,
    updatePlayerPosition,
    startBattle,
    playerAttack,
    useSkill,
    endBattle,
    openChest,
    logout,
    loadAutoBattleConfig,
    setAutoBattleConfig,
    startAutoBattle,
    stopAutoBattle,
    executeAutoBattle,
    resetAutoBattleStats,
  } = useGame();

  // 计算强化金币消耗
  const getEnhanceCost = useCallback((level: number) => {
    if (level <= 3) {
      return 50 + level * 10;
    } else if (level <= 6) {
      return 100 + (level - 4) * 30;
    } else if (level <= 9) {
      return 200 + (level - 7) * 50;
    } else {
      return 400 + (level - 10) * 100;
    }
  }, []);

  const [mainTab, setMainTab] = useState<'character' | 'adventure'>('character');
  
  // 售卖确认弹窗状态
  const [sellConfirm, setSellConfirm] = useState<{
    visible: boolean;
    quality: Quality | null;
    count: number;
    totalPrice: number;
    isSingle: boolean;
    item: EquipmentItem | null;
  }>({ visible: false, quality: null, count: 0, totalPrice: 0, isSingle: false, item: null });
  
  // 打开批量售卖确认弹窗
  const openSellConfirm = useCallback(async (quality: Quality) => {
    const preview = await getSellBatchPreview(quality);
    if (preview && preview.count > 0) {
      setSellConfirm({
        visible: true,
        quality,
        count: preview.count,
        totalPrice: preview.totalSellPrice,
        isSingle: false,
        item: null,
      });
    }
  }, [getSellBatchPreview]);
  
  // 打开单件售卖确认弹窗
  const openSingleSellConfirm = useCallback((item: EquipmentItem) => {
    setSellConfirm({
      visible: true,
      quality: null,
      count: 1,
      totalPrice: item.sellPrice || 0,
      isSingle: true,
      item,
    });
  }, []);
  
  // 确认售卖
  const confirmSell = useCallback(() => {
    if (sellConfirm.isSingle && sellConfirm.item) {
      sellItem(sellConfirm.item);
    } else if (sellConfirm.quality) {
      sellBatch(sellConfirm.quality);
    }
    setSellConfirm({ visible: false, quality: null, count: 0, totalPrice: 0, isSingle: false, item: null });
  }, [sellConfirm.quality, sellConfirm.isSingle, sellConfirm.item, sellBatch, sellItem]);
  
  // 取消售卖
  const cancelSell = useCallback(() => {
    setSellConfirm({ visible: false, quality: null, count: 0, totalPrice: 0, isSingle: false, item: null });
  }, []);
  
  // 获取总属性 - 直接使用后端返回的已计算值
  // 后端已经计算好了装备加成，前端不需要重复计算
  const getTotalStats = useCallback(() => {
    const stats = state.stats || { atk: 50, def: 30, spd: 20, critRate: 0, critDmg: 0 };
    return {
      atk: stats.atk,
      def: stats.def,
      maxHp: state.maxHp,
      spd: stats.spd,
      critRate: stats.critRate,
      critDmg: stats.critDmg,
    };
  }, [state.stats, state.maxHp]);
  
  // 处理怪物遭遇
  const handleEncounter = useCallback((cell: MapCell) => {
    if (cell.entity) {
      if (['monster', 'elite', 'boss'].includes(cell.entity.type)) {
        // 战斗
        const level = cell.entity.level || state.level;
        const monsterType = (cell.entity.type === 'monster' ? 'normal' : cell.entity.type) as 'normal' | 'elite' | 'boss';
        startBattle(monsterType, level, cell.x, cell.y);
      } else if (cell.entity.type === 'chest') {
        // 打开宝箱
        openChest(cell.x, cell.y);
      }
    }
  }, [state.level, startBattle, openChest]);
  
  // PixiMap 处理键盘和遭遇，这里不再需要
  
  const [loginTab, setLoginTab] = useState<'login' | 'register'>('login');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerNickname, setRegisterNickname] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EquipmentItem | null>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; item: EquipmentItem | null }>({
    visible: false,
    x: 0,
    y: 0,
    item: null,
  });

  // 同步 selectedItem 与 state 中的数据
  useEffect(() => {
    if (selectedItem) {
      // 从 inventory 中查找更新后的物品
      const updatedItem = state.inventory.find(i => i.id === selectedItem.id);
      if (updatedItem && updatedItem.level !== selectedItem.level) {
        setSelectedItem(updatedItem);
      } else if (!updatedItem) {
        // 从 equippedItems 中查找
        const equippedItem = state.equippedItems[selectedItem.slot];
        if (equippedItem && equippedItem.id === selectedItem.id) {
          if (equippedItem.level !== selectedItem.level) {
            setSelectedItem(equippedItem);
          }
        } else {
          // 物品已被删除或损坏
          setSelectedItem(null);
        }
      }
    }
  }, [state.inventory, state.equippedItems, selectedItem]);

  // 处理登录
  const handleLogin = useCallback(async () => {
    if (!loginUsername.trim()) {
      setMessage('请输入用户名');
      return;
    }
    if (!loginPassword) {
      setMessage('请输入密码');
      return;
    }

    setLoading(true);
    const result = await login(loginUsername.trim(), loginPassword);
    setLoading(false);

    if (!result.success) {
      setMessage(result.message || '登录失败');
    }
  }, [loginUsername, loginPassword, login]);

  // 处理注册
  const handleRegister = useCallback(async () => {
    if (!registerUsername.trim()) {
      setMessage('请输入用户名');
      return;
    }
    if (!registerPassword || registerPassword.length < 6) {
      setMessage('密码至少6个字符');
      return;
    }

    setLoading(true);
    const result = await register(registerUsername.trim(), registerPassword, registerNickname.trim());
    setLoading(false);

    if (!result.success) {
      setMessage(result.message || '注册失败');
    }
  }, [registerUsername, registerPassword, registerNickname, register]);

  // 显示 Tooltip
  const showTooltip = useCallback((e: React.MouseEvent, item: EquipmentItem) => {
    setTooltip({
      visible: true,
      x: e.clientX + 10,
      y: e.clientY + 10,
      item,
    });
  }, []);

  // 隐藏 Tooltip
  const hideTooltip = useCallback(() => {
    setTooltip({ visible: false, x: 0, y: 0, item: null });
  }, []);

  // 获取强化等级样式类
  const getEnhanceClass = (level: number): string => {
    if (level <= 10) return styles.enhanceLow;
    if (level <= 15) return styles.enhanceMedium;
    if (level <= 19) return styles.enhanceHigh;
    return styles.enhanceMax;
  };

  // 格式化词条
  const formatStat = (stat: string, value: number): string => {
    const name = StatNames[stat] || stat;
    const isPercent = stat.includes('PERCENT') || stat === 'CRIT_RATE' || stat === 'CRIT_DMG';
    return `${name} +${value}${isPercent ? '%' : ''}`;
  };

  // 背包页签状态
  const [inventoryTab, setInventoryTab] = useState<InventoryTab>('all');
  
  // 获取排序和过滤后的背包物品
  const getSortedInventory = useCallback(() => {
    // 先过滤掉undefined/null元素（防御性编程）
    let items = state.inventory.filter(item => item && item.id);
    if (inventoryTab !== 'all') {
      items = items.filter(item => SlotCategories[item.slot] === inventoryTab);
    }
    
    // 获取已穿戴装备的ID集合
    const equippedIds = new Set(
      Object.values(state.equippedItems)
        .filter(item => item !== null)
        .map(item => item!.id)
    );
    
    // 排序：已穿戴的排在前面
    return items.sort((a, b) => {
      const aEquipped = equippedIds.has(a.id) ? 0 : 1;
      const bEquipped = equippedIds.has(b.id) ? 0 : 1;
      return aEquipped - bEquipped;
    });
  }, [state.inventory, state.equippedItems, inventoryTab]);
  
  // 检查物品是否已穿戴
  const isItemEquipped = useCallback((item: EquipmentItem): boolean => {
    return Object.values(state.equippedItems).some(
      equipped => equipped !== null && equipped.id === item.id
    );
  }, [state.equippedItems]);

  // 登录界面
  if (!state.isLoggedIn) {
    return (
      <div className={styles.loginScreen}>
        <div className={styles.loginContainer}>
          <div className={styles.loginHeader}>
            <h1>⚔️ 装备强化模拟器</h1>
            <p className={styles.loginSubtitle}>Next.js + TypeScript + ECS</p>
          </div>

          <div className={styles.loginTabs}>
            <button
              className={`${styles.tabBtn} ${loginTab === 'login' ? styles.active : ''}`}
              onClick={() => setLoginTab('login')}
            >
              登录
            </button>
            <button
              className={`${styles.tabBtn} ${loginTab === 'register' ? styles.active : ''}`}
              onClick={() => setLoginTab('register')}
            >
              注册
            </button>
          </div>

          {loginTab === 'login' ? (
            <form className={styles.loginForm} onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
              <div className={styles.formGroup}>
                <label>用户名</label>
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="输入用户名"
                  autoComplete="off"
                />
              </div>
              <div className={styles.formGroup}>
                <label>密码</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="输入密码"
                  autoComplete="off"
                />
              </div>
              <button type="submit" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull}`} disabled={loading}>
                {loading ? '登录中...' : '登录'}
              </button>
              <p className={styles.formHint}>默认密码: 888888</p>
            </form>
          ) : (
            <form className={styles.loginForm} onSubmit={(e) => { e.preventDefault(); handleRegister(); }}>
              <div className={styles.formGroup}>
                <label>用户名</label>
                <input
                  type="text"
                  value={registerUsername}
                  onChange={(e) => setRegisterUsername(e.target.value)}
                  placeholder="输入用户名"
                  autoComplete="off"
                />
                <p className={styles.inputHint}>字母、数字、下划线、中文，最长20字符</p>
              </div>
              <div className={styles.formGroup}>
                <label>密码</label>
                <input
                  type="password"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  placeholder="输入密码 (至少6位)"
                  autoComplete="off"
                />
              </div>
              <div className={styles.formGroup}>
                <label>昵称 (可选)</label>
                <input
                  type="text"
                  value={registerNickname}
                  onChange={(e) => setRegisterNickname(e.target.value)}
                  placeholder="显示在广播中的名字"
                  autoComplete="off"
                />
              </div>
              <button type="submit" className={`${styles.btn} ${styles.btnSuccess} ${styles.btnFull}`} disabled={loading}>
                {loading ? '注册中...' : '注册'}
              </button>
            </form>
          )}

          {message && <p className={styles.loginMessage}>{message}</p>}

          <div className={styles.loginFooter}>
            <p>💡 数据保存在服务器数据库</p>
          </div>
        </div>
      </div>
    );
  }

  // 游戏主界面
  return (
    <div className={styles.gameScreen}>
      <div className={styles.container}>
        {/* 头部 */}
        <header className={styles.header}>
          <h1>⚔️ 装备强化模拟器</h1>
          <div className={styles.userInfo}>
            <span>{state.username} (Lv.{state.level})</span>
            <span className={styles.goldDisplay}>💰 {state.gold}</span>
            <button className={styles.btn} onClick={saveGame}>💾 保存</button>
            <button className={`${styles.btn} ${styles.btnDanger}`} onClick={logout}>🚪 退出</button>
          </div>
        </header>

        {/* 世界喇叭 */}
        <WorldBroadcast broadcasts={state.broadcasts} />

        {/* 主页签 */}
        <div className={styles.mainTabs}>
          <button
            className={`${styles.mainTab} ${mainTab === 'character' ? styles.active : ''}`}
            onClick={() => setMainTab('character')}
          >
            🧙 角色/装备
          </button>
          <button
            className={`${styles.mainTab} ${mainTab === 'adventure' ? styles.active : ''}`}
            onClick={() => setMainTab('adventure')}
          >
            🗺️ 历练
          </button>
        </div>

        {/* 角色/装备页签 */}
        {mainTab === 'character' && (
          <div className={styles.characterContent}>
            {/* 角色面板 */}
            <section className={styles.characterPanel}>
              <h2>🧙 角色</h2>
              <div className={styles.characterAvatar}>
                <div className={styles.avatarIcon}>🧙‍♂️</div>
                <div className={styles.characterName}>Lv.{state.level}</div>
                <div className={styles.expBar}>
                  <div className={styles.expFill} style={{ width: `${Math.min(100, (state.exp / (state.level * 100)) * 100)}%` }}></div>
                  <span>{state.exp}/{state.level * 100}</span>
                </div>
              </div>
              <div className={styles.characterStats}>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>⚔️ 攻击</span>
                  <span className={styles.statValue}>{getTotalStats().atk}</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>🛡️ 防御</span>
                  <span className={styles.statValue}>{getTotalStats().def}</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>❤️ 生命</span>
                  <span className={styles.statValue}>{state.currentHp}/{getTotalStats().maxHp}</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>💨 速度</span>
                  <span className={styles.statValue}>{getTotalStats().spd}</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>💥 暴击率</span>
                  <span className={styles.statValue}>{getTotalStats().critRate}%</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>🔥 暴击伤害</span>
                  <span className={styles.statValue}>{getTotalStats().critDmg}%</span>
                </div>
              </div>
              {(() => {
                const hpToHeal = state.maxHp - state.currentHp;
                const goldCost = hpToHeal;
                const canHeal = hpToHeal > 0 && state.gold >= goldCost;
                return (
                  <button 
                    className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull}`} 
                    onClick={healPlayer} 
                    style={{ marginTop: 10 }}
                    disabled={!canHeal}
                  >
                    💚 恢复生命 {hpToHeal > 0 ? `(${goldCost}💰)` : '(已满)'}
                  </button>
                );
              })()}

              {/* 装备槽位 */}
              <div className={styles.equipmentSlots}>
                <h3>装备槽</h3>
                <div className={styles.slotsGrid}>
                  {SLOT_ORDER.map((slot) => {
                    const item = state.equippedItems[slot];
                    return (
                      <div
                        key={slot}
                        className={`${styles.slot} ${item ? styles.filled : ''}`}
                        onClick={() => item && unequipItem(slot)}
                        onMouseEnter={(e) => item && showTooltip(e, item)}
                        onMouseLeave={hideTooltip}
                      >
                        <div className={styles.slotIcon}>{SlotIcons[slot]}</div>
                        <div className={styles.slotLabel}>{SlotNames[slot]}</div>
                        {item ? (
                          <div className={styles.slotItem}>
                            <div
                              className={styles.slotItemName}
                              style={{ color: QualityColors[item.quality] }}
                            >
                              {item.name ? item.name.substring(0, 4) : QualityNames[item.quality]}
                            </div>
                            <span className={`${styles.enhanceLevel} ${getEnhanceClass(item.level)}`}>
                              +{item.level}
                            </span>
                          </div>
                        ) : (
                          <div className={styles.slotEmptyIndicator}>空</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* 背包面板 */}
            <section className={styles.inventoryPanel}>
              <h2>🎒 背包 <span>{state.inventory.length}/50</span></h2>
              
              {/* 背包页签 */}
              <div className={styles.inventoryTabs}>
                {(['all', 'weapon', 'armor', 'accessory'] as InventoryTab[]).map((tab) => {
                  const count = tab === 'all' 
                    ? state.inventory.length 
                    : state.inventory.filter(i => SlotCategories[i.slot] === tab).length;
                  return (
                    <button
                      key={tab}
                      className={`${styles.inventoryTab} ${inventoryTab === tab ? styles.active : ''}`}
                      onClick={() => setInventoryTab(tab)}
                    >
                      {InventoryTabNames[tab]}({count})
                    </button>
                  );
                })}
              </div>
              
              {/* 一键售卖按钮组 */}
              <div className={styles.sellBatchButtons}>
                <span className={styles.sellBatchLabel}>一键售卖:</span>
                {(['normal', 'rare', 'epic'] as Quality[]).map((q) => {
                  const count = state.inventory.filter(i => i.quality === q).length;
                  const estimatedValue = state.inventory
                    .filter(i => i.quality === q)
                    .reduce((sum, i) => sum + (i.sellPrice || 0), 0);
                  return (
                    <button
                      key={q}
                      className={`${styles.btn} ${styles.btnSmall} ${styles[`quality_${q}`]}`}
                      onClick={() => openSellConfirm(q)}
                      disabled={count === 0}
                      title={`${QualityNames[q]}装备 ${count}件，约${estimatedValue}💰`}
                    >
                      {QualityNames[q]}({count})
                    </button>
                  );
                })}
              </div>
              
              <div className={styles.inventoryGrid}>
                {getSortedInventory().map((item) => (
                  <div
                    key={item.id}
                    className={`${styles.inventoryItem} ${selectedItem?.id === item.id ? styles.selected : ''} ${styles[`quality_${item.quality}`]} ${isItemEquipped(item) ? styles.equipped : ''}`}
                    onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
                    onMouseEnter={(e) => showTooltip(e, item)}
                    onMouseLeave={hideTooltip}
                  >
                    {/* 穿戴标识 */}
                    {isItemEquipped(item) && <div className={styles.equippedBadge} />}
                    <div className={styles.itemIcon} style={{ borderColor: QualityColors[item.quality] }}>
                      {SlotIcons[item.slot]}
                    </div>
                    <span className={`${styles.itemLevel} ${getEnhanceClass(item.level)}`}>+{item.level}</span>
                    {item.isBroken && <div className={styles.brokenBadge}>💔</div>}
                  </div>
                ))}
                {getSortedInventory().length === 0 && (
                  <div className={styles.inventoryEmpty}>暂无装备</div>
                )}
              </div>
            </section>

            {/* 操作面板 */}
            {selectedItem && (
              <section className={styles.actionPanel}>
                <h2>📋 装备操作</h2>
                <div className={styles.itemDetail}>
                  <div className={styles.itemHeader}>
                    <div className={styles.itemTitleRow}>
                      <span style={{ color: QualityColors[selectedItem.quality] }}>
                        {selectedItem.name || `${QualityNames[selectedItem.quality]}${SlotNames[selectedItem.slot]}`}
                      </span>
                      <span className={`${styles.enhanceLevel} ${getEnhanceClass(selectedItem.level)}`}>
                        +{selectedItem.level}
                      </span>
                    </div>
                    <span 
                      className={styles.qualityBadge}
                      style={{ background: QualityColors[selectedItem.quality] }}
                    >
                      {QualityNames[selectedItem.quality]}
                    </span>
                  </div>
                  <div className={styles.affixList}>
                    <div className={styles.mainAffix}>
                      ★ {formatStat(selectedItem.mainAffix.stat, selectedItem.mainAffix.value)}
                    </div>
                    {selectedItem.subAffixes.map((affix, i) => (
                      <div key={i} className={styles.subAffix}>
                        ○ {formatStat(affix.stat, affix.value)}
                        {affix.upgradeCount && <span className={styles.upgradeStars}>{'☆'.repeat(affix.upgradeCount)}</span>}
                      </div>
                    ))}
                    {selectedItem.equipLevel && selectedItem.equipLevel > 1 && (
                      <div className={styles.affixListFooter}>
                        <span className={styles.equipLevelBadge}>Lv.{selectedItem.equipLevel}</span>
                      </div>
                    )}
                  </div>
                  <div className={styles.actionButtons}>
                    <button
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      onClick={() => equipItem(selectedItem)}
                      disabled={!!selectedItem.equipLevel && state.level < selectedItem.equipLevel}
                    >
                      {selectedItem.equipLevel && state.level < selectedItem.equipLevel
                        ? `需要Lv.${selectedItem.equipLevel}`
                        : '穿戴'}
                    </button>
                    <div className={styles.enhanceButtonWrapper}>
                      <button
                        className={`${styles.btn} ${styles.btnSuccess}`}
                        onClick={() => enhanceItem(selectedItem)}
                        disabled={selectedItem.isBroken || selectedItem.level >= 21 || state.gold < getEnhanceCost(selectedItem.level)}
                      >
                        强化 ({getEnhanceCost(selectedItem.level)}💰)
                      </button>
                      {selectedItem.level >= 10 && !selectedItem.isBroken && selectedItem.level < 21 && (
                        <span className={styles.breakWarning}>⚠️ +10以上有碎裂风险!</span>
                      )}
                    </div>
                    <button 
                      className={`${styles.btn} ${styles.btnDanger}`}
                      onClick={() => openSingleSellConfirm(selectedItem)}
                    >
                      售卖 ({selectedItem.sellPrice || 0}💰)
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* 日志面板 */}
            <section className={styles.logPanel}>
              <h2>📜 日志</h2>
              <div className={styles.logContainer}>
                {state.logs.map((log) => (
                  <div key={log.id} className={`${styles.logEntry} ${styles[log.type]}`}>
                    {log.text}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* 历练页签 */}
        {mainTab === 'adventure' && (
          <div className={styles.adventureContent}>
            {!state.gameMap ? (
              <section className={styles.adventureSelect}>
                <h2>🗺️ 冒险地图</h2>
                <p className={styles.adventureHint}>探索6个不同的地图，击败Boss获取装备</p>
                <div className={styles.adventureInfo}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoIcon}>⚔️</span>
                    <span>击败小Boss和最终Boss</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoIcon}>🎁</span>
                    <span>通关后自动进入下一张地图</span>
                  </div>
                </div>
                <button
                  className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLarge}`}
                  onClick={() => generateWorldMap()}
                >
                  🗺️ 开始冒险
                </button>
              </section>
            ) : state.battle?.isActive ? (
              // 战斗界面
              <BattleView
                battle={state.battle}
                playerAttack={playerAttack}
                useSkill={useSkill}
                endBattle={endBattle}
                playerHp={state.battle?.playerHp ?? state.currentHp}
                playerMaxHp={state.battle?.playerMaxHp ?? state.maxHp}
              />
            ) : (
              <div className={styles.worldMapContainer}>
                {/* 自动战斗控制面板 */}
                <section className={styles.autoBattlePanel}>
                  <h3>🤖 自动战斗</h3>
                  
                  {/* 状态显示 */}
                  <div className={styles.autoBattleStats}>
                    <div className={styles.statItem}>
                      <span className={styles.statIcon}>⚔️</span>
                      <span className={styles.statValue}>{state.autoBattle.stats.battlesWon}</span>
                      <span className={styles.statLabel}>战斗</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statIcon}>💰</span>
                      <span className={styles.statValue}>{state.autoBattle.stats.goldEarned}</span>
                      <span className={styles.statLabel}>金币</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statIcon}>✨</span>
                      <span className={styles.statValue}>{state.autoBattle.stats.expEarned}</span>
                      <span className={styles.statLabel}>经验</span>
                    </div>
                  </div>
                  
                  {/* 配置选项 */}
                  <div className={styles.autoBattleConfig}>
                    <label className={styles.configRow}>
                      <span>挑战最终Boss</span>
                      <input
                        type="checkbox"
                        checked={!state.autoBattle.skipFinalBoss}
                        onChange={(e) => setAutoBattleConfig({ skipFinalBoss: !e.target.checked })}
                      />
                    </label>
                    
                    <label className={styles.configRow}>
                      <span>最低血量: {state.autoBattle.minHpPercent}%</span>
                      <input
                        type="range"
                        min="10"
                        max="80"
                        value={state.autoBattle.minHpPercent}
                        onChange={(e) => setAutoBattleConfig({ minHpPercent: parseInt(e.target.value) })}
                      />
                    </label>
                    
                    <label className={styles.configRow}>
                      <span>战斗间隔: {state.autoBattle.battleInterval}ms</span>
                      <input
                        type="range"
                        min="200"
                        max="2000"
                        step="100"
                        value={state.autoBattle.battleInterval}
                        onChange={(e) => setAutoBattleConfig({ battleInterval: parseInt(e.target.value) })}
                      />
                    </label>
                    
                    <div className={styles.autoSellConfig}>
                      <span>自动售卖品质:</span>
                      <div className={styles.qualityToggles}>
                        {(['normal', 'rare', 'epic'] as const).map(q => (
                          <label key={q} className={styles.qualityToggle}>
                            <input
                              type="checkbox"
                              checked={state.autoBattle.autoSellQualities.includes(q)}
                              onChange={(e) => {
                                const newQualities = e.target.checked
                                  ? [...state.autoBattle.autoSellQualities, q]
                                  : state.autoBattle.autoSellQualities.filter(x => x !== q);
                                setAutoBattleConfig({ autoSellQualities: newQualities });
                              }}
                            />
                            <span style={{ color: QualityColors[q] }}>{QualityNames[q]}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* 控制按钮 */}
                  <div className={styles.autoBattleControls}>
                    {state.autoBattle.isRunning ? (
                      <button 
                        className={`${styles.btn} ${styles.btnDanger} ${styles.btnFull}`}
                        onClick={stopAutoBattle}
                      >
                        ⏹️ 停止自动战斗
                      </button>
                    ) : (
                      <button 
                        className={`${styles.btn} ${styles.btnSuccess} ${styles.btnFull}`}
                        onClick={startAutoBattle}
                        disabled={state.currentHp <= state.maxHp * (state.autoBattle.minHpPercent / 100)}
                      >
                        ▶️ 开始自动战斗
                      </button>
                    )}
                    <button 
                        className={`${styles.btn} ${styles.btnSmall} ${styles.btnFull}`}
                        onClick={resetAutoBattleStats}
                      >
                        🔄 重置统计
                      </button>
                  </div>
                  
                  {state.autoBattle.stats.autoSoldCount > 0 && (
                    <div className={styles.autoSellStats}>
                      已自动售出 {state.autoBattle.stats.autoSoldCount} 件，获得 {state.autoBattle.stats.autoSoldGold} 金币
                    </div>
                  )}
                </section>
                {/* 左侧小地图导航 */}
                <section className={styles.miniMapSidebar}>
                  <div className={styles.miniMapOverviewFixed}>
                    <MiniMapOverview map={state.gameMap} />
                  </div>
                  <div className={styles.miniBossProgress}>
                    小Boss: {state.gameMap.miniBossesDefeated || 0}/{state.gameMap.totalMiniBosses || 0}
                    {state.gameMap.finalBossSpawned && <span style={{ color: '#ff4500' }}>🔥</span>}
                  </div>
                </section>
                
                {/* 右侧主地图 */}
                <section className={styles.mapMain}>
                  <section className={styles.mapHeader}>
                  <h2>🗺️ {state.gameMap.mapName || MAP_NAMES[state.gameMap.mapId || 1] || '世界地图'} <span className={styles.mapSize}>({state.gameMap.width}×{state.gameMap.height})</span></h2>
                  <div className={styles.mapStats}>
                    <span>👹 普通: {state.gameMap.stats.monsters.defeated}/{state.gameMap.stats.monsters.total}</span>
                    <span>💀 精英: {state.gameMap.stats.elites.defeated}/{state.gameMap.stats.elites.total}</span>
                    <span>🐉 Boss: {state.gameMap.stats.bosses.defeated}/{state.gameMap.stats.bosses.total}</span>
                  </div>
                  <div className={styles.mapProgress}>
                    等级 {state.gameMap.zones?.[0]?.monsterLevel?.[0] || 1}-{state.gameMap.zones?.[state.gameMap.zones.length - 1]?.monsterLevel?.[1] || 10}
                  </div>
                  <button 
                    className={styles.restartButton}
                    onClick={restartCurrentMap}
                    title="重新开始当前地图"
                  >
                    🔄 重置地图
                  </button>
                </section>
                <section className={styles.mapView}>
                  <div className={pixiStyles.pixiMapContainer}>
                    <PixiMap 
                      map={state.gameMap}
                      currentHp={state.currentHp}
                      maxHp={state.maxHp}
                      onMove={movePlayer}
                      onEncounter={handleEncounter}
                    />
                  </div>
                  <div className={styles.mapInfo}>
                    <p>📍 位置: ({state.gameMap.player.cellX}, {state.gameMap.player.cellY})</p>
                  </div>
                </section>
                </section>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 售卖确认弹窗 */}
      {sellConfirm.visible && (
        <div className={styles.modalOverlay} onClick={cancelSell}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>🛒 确认售卖</h3>
            </div>
            <div className={styles.modalBody}>
              {sellConfirm.isSingle && sellConfirm.item ? (
                // 单件售卖显示
                <div className={styles.sellInfo}>
                  <div className={styles.sellItemPreview}>
                    <div className={styles.sellItemIcon} style={{ borderColor: QualityColors[sellConfirm.item.quality] }}>
                      {SlotIcons[sellConfirm.item.slot]}
                    </div>
                    <div className={styles.sellItemDetails}>
                      <div 
                        className={styles.sellItemName}
                        style={{ color: QualityColors[sellConfirm.item.quality] }}
                      >
                        {sellConfirm.item.name || `${QualityNames[sellConfirm.item.quality]}${SlotNames[sellConfirm.item.slot]}`}
                      </div>
                      <div className={styles.sellItemLevel}>
                        +{sellConfirm.item.level} {SlotNames[sellConfirm.item.slot]}
                      </div>
                    </div>
                  </div>
                  <div className={styles.sellDivider} />
                  <div className={styles.sellInfoRow}>
                    <span className={styles.sellInfoLabel}>获得金币</span>
                    <span className={`${styles.sellInfoValue} ${styles.goldText}`}>💰 {sellConfirm.totalPrice}</span>
                  </div>
                </div>
              ) : (
                // 批量售卖显示
                <div className={styles.sellInfo}>
                  <div className={styles.sellInfoRow}>
                    <span className={styles.sellInfoLabel}>装备品质</span>
                    <span 
                      className={styles.sellInfoValue}
                      style={{ color: QualityColors[sellConfirm.quality!] }}
                    >
                      {sellConfirm.quality && QualityNames[sellConfirm.quality]}
                    </span>
                  </div>
                  <div className={styles.sellInfoRow}>
                    <span className={styles.sellInfoLabel}>装备数量</span>
                    <span className={styles.sellInfoValue}>{sellConfirm.count} 件</span>
                  </div>
                  <div className={styles.sellInfoRow}>
                    <span className={styles.sellInfoLabel}>获得金币</span>
                    <span className={`${styles.sellInfoValue} ${styles.goldText}`}>💰 {sellConfirm.totalPrice}</span>
                  </div>
                </div>
              )}
              {!sellConfirm.isSingle && <p className={styles.sellWarning}>⚠️ 已装备的装备不会被售卖</p>}
            </div>
            <div className={styles.modalFooter}>
              <button className={`${styles.btn} ${styles.btnCancel}`} onClick={cancelSell}>
                取消
              </button>
              <button className={`${styles.btn} ${styles.btnConfirm}`} onClick={confirmSell}>
                确认售卖
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tooltip */}
      {tooltip.visible && tooltip.item && (
        <div className={styles.tooltip} style={{ left: tooltip.x, top: tooltip.y }}>
          <div className={styles.tooltipHeader}>
            <div className={styles.itemTitleRow}>
              <span style={{ color: QualityColors[tooltip.item.quality] }}>
                {tooltip.item.name || `${QualityNames[tooltip.item.quality]}${SlotNames[tooltip.item.slot]}`}
              </span>
              <span className={`${styles.enhanceLevel} ${getEnhanceClass(tooltip.item.level)}`}>
                +{tooltip.item.level}
              </span>
            </div>
            <span 
              className={styles.qualityBadge}
              style={{ background: QualityColors[tooltip.item.quality] }}
            >
              {QualityNames[tooltip.item.quality]}
            </span>
          </div>
          <div className={styles.affixList}>
            <div className={styles.mainAffix}>
              ★ {formatStat(tooltip.item.mainAffix.stat, tooltip.item.mainAffix.value)}
            </div>
            {tooltip.item.subAffixes.map((affix, i) => (
              <div key={i} className={styles.subAffix}>
                ○ {formatStat(affix.stat, affix.value)}
                {affix.upgradeCount && <span className={styles.upgradeStars}>{'☆'.repeat(affix.upgradeCount)}</span>}
              </div>
            ))}
            {tooltip.item.equipLevel && tooltip.item.equipLevel > 1 && (
              <div className={styles.affixListFooter}>
                <span className={styles.equipLevelBadge}>Lv.{tooltip.item.equipLevel}</span>
              </div>
            )}
          </div>
          {tooltip.item.isBroken && <div className={styles.tooltipBroken}>💔 已损坏</div>}
        </div>
      )}
    </div>
  );
}

// 战斗组件
interface BattleViewProps {
  battle: import('@/lib/useGame').BattleState;
  playerAttack: () => void;
  useSkill: (skillId: string) => void;
  endBattle: (victory: boolean) => void;
  playerHp: number;
  playerMaxHp: number;
}

function BattleView({ battle, playerAttack, useSkill, endBattle, playerHp, playerMaxHp }: BattleViewProps) {
  const isVictory = battle.monsterHp <= 0;
  const isDefeat = playerHp <= 0;
  
  // 获取掉落信息
  const dropInfo = battle.dropInfo;
  
  return (
    <div className={styles.battleContainer}>
      <div className={styles.battleHeader}>
        <h2>⚔️ 战斗</h2>
        <span className={styles.roundInfo}>回合 {battle.currentRound}</span>
      </div>
      
      <div className={styles.battleArena}>
        {/* 玩家 */}
        <div className={styles.battleEntity}>
          <div className={styles.entityAvatar}>🧙</div>
          <div className={styles.entityName}>玩家</div>
          <div className={styles.hpContainer}>
            <div className={styles.hpLabel}>❤️ 生命</div>
            <div className={styles.entityHpBar}>
              <div 
                className={styles.hpFill} 
                style={{ width: `${(playerHp / playerMaxHp) * 100}%`, background: 'linear-gradient(90deg, #2e7d32, #4CAF50)' }}
              />
            </div>
            <div className={styles.hpNumbers}>
              <span className={styles.hpCurrent}>{playerHp}</span>
              <span className={styles.hpSeparator}>/</span>
              <span className={styles.hpMax}>{playerMaxHp}</span>
              <span className={styles.hpPercent}>({Math.round((playerHp / playerMaxHp) * 100)}%)</span>
            </div>
          </div>
          <div className={styles.rageContainer}>
            <div className={styles.rageLabel}>🔥 怒气</div>
            <div className={styles.rageBar}>
              <div 
                className={styles.rageFill} 
                style={{ width: `${battle.playerRage}%` }}
              />
            </div>
            <div className={styles.rageNumbers}>{battle.playerRage}%</div>
          </div>
        </div>
        
        <div className={styles.vsText}>VS</div>
        
        {/* 怪物 */}
        <div className={styles.battleEntity}>
          <div className={styles.entityAvatar}>
            {battle.monsterType === 'boss' ? '🐉' : battle.monsterType === 'elite' ? '💀' : '👹'}
          </div>
          <div className={styles.entityName}>{battle.monsterName}</div>
          <div className={styles.monsterLevel}>Lv.{battle.monsterLevel}</div>
          <div className={styles.hpContainer}>
            <div className={styles.hpLabel}>❤️ 生命</div>
            <div className={styles.entityHpBar}>
              <div 
                className={styles.hpFill} 
                style={{ width: `${(battle.monsterHp / battle.monsterMaxHp) * 100}%`, background: 'linear-gradient(90deg, #b71c1c, #f44336)' }}
              />
            </div>
            <div className={styles.hpNumbers}>
              <span className={styles.hpCurrent}>{battle.monsterHp}</span>
              <span className={styles.hpSeparator}>/</span>
              <span className={styles.hpMax}>{battle.monsterMaxHp}</span>
              <span className={styles.hpPercent}>({Math.round((battle.monsterHp / battle.monsterMaxHp) * 100)}%)</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* 战斗日志 */}
      <div className={styles.battleLogs}>
        {battle.logs.slice(-8).map(log => (
          <div key={log.id} className={`${styles.battleLog} ${styles[log.type]}`}>
            {log.text}
          </div>
        ))}
      </div>
      
      {/* 操作按钮 */}
      <div className={styles.battleActions}>
        {isVictory ? (
          <div className={styles.victoryContent}>
            <div className={styles.dropPreview}>
              <div className={styles.dropItem}>⭐ 经验: +{dropInfo?.exp}</div>
              <div className={styles.dropItem}>💰 金币: +{dropInfo?.gold}</div>
              <div className={styles.dropItem}>🎁 装备: +{dropInfo?.items?.length || 0}件</div>
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => endBattle(true)}>
              🎉 拾取并返回地图
            </button>
          </div>
        ) : isDefeat ? (
          <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => endBattle(false)}>
            💀 失败！点击返回地图
          </button>
        ) : (
          <>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={playerAttack}>
              ⚔️ 普通攻击
            </button>
            <div className={styles.skillButtons}>
              {battle.skills.map(skill => (
                <button
                  key={skill.id}
                  className={`${styles.btn} ${styles.skillBtn} ${battle.playerRage < skill.rageCost ? styles.disabled : ''}`}
                  onClick={() => useSkill(skill.id)}
                  disabled={battle.playerRage < skill.rageCost}
                  title={`需要 ${skill.rageCost}% 怒气`}
                >
                  {skill.icon} {skill.name}
                  <span className={styles.skillCost}>{skill.rageCost}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// 小地图导航组件
function MiniMapOverview({ map }: { map: GameMap }) {
  const scale = 2;
  const width = map.width * scale;
  const height = map.height * scale;
  
  const bossPositions: Array<{ x: number; y: number; name: string; type: 'miniBoss' | 'finalBoss' }> = [];
  
  for (let y = 0; y < map.cells.length; y++) {
    for (let x = 0; x < map.cells[y].length; x++) {
      const cell = map.cells[y][x];
      if (cell.entity && !cell.entity.defeated) {
        if (cell.entity.isMiniBoss) {
          const idParts = cell.entity.id.split('_');
          const startX = parseInt(idParts[2]);
          const startY = parseInt(idParts[3]);
          if (x === startX && y === startY) {
            bossPositions.push({ x, y, name: cell.entity.name || '小Boss', type: 'miniBoss' });
          }
        } else if (cell.entity.isFinalBoss) {
          const idParts = cell.entity.id.split('_');
          const startX = parseInt(idParts[1]);
          const startY = parseInt(idParts[2]);
          if (x === startX && y === startY) {
            bossPositions.push({ x, y, name: cell.entity.name || '最终Boss', type: 'finalBoss' });
          }
        }
      }
    }
  }
  
  if (!map.finalBossSpawned && map.finalBossSpawnX && map.finalBossSpawnY) {
    bossPositions.push({
      x: map.finalBossSpawnX,
      y: map.finalBossSpawnY,
      name: map.finalBoss?.name || '最终Boss',
      type: 'finalBoss',
    });
  }
  
  return (
    <div style={{ width, height, background: '#1a1a2e', borderRadius: '4px', position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          left: map.player.cellX * scale - 3,
          top: map.player.cellY * scale - 3,
          width: 6,
          height: 6,
          background: '#4CAF50',
          borderRadius: '50%',
          border: '1px solid #fff',
          zIndex: 20,
        }}
        title="玩家位置"
      />
      {bossPositions.map((boss, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: boss.x * scale - 4,
            top: boss.y * scale - 4,
            width: boss.type === 'finalBoss' ? 12 : 8,
            height: boss.type === 'finalBoss' ? 12 : 8,
            background: boss.type === 'finalBoss' ? '#ff0000' : '#ff4500',
            borderRadius: '2px',
            border: boss.type === 'finalBoss' ? '2px solid #ffd700' : '1px solid #fff',
            zIndex: 10,
            opacity: boss.type === 'finalBoss' && !map.finalBossSpawned ? 0.5 : 1,
          }}
          title={boss.name}
        />
      ))}
    </div>
  );
}

// 世界广播组件
interface WorldBroadcastProps {
  broadcasts: BroadcastMessage[];
}

// 品质颜色配置
const BroadcastQualityColors: Record<Quality, string> = {
  normal: '#9e9e9e',
  rare: '#4fc3f7',
  epic: '#ba68c8',
  legendary: '#ff9800',
  mythic: '#ff4444',
};

// 渲染带颜色的广播消息
function renderBroadcastMessage(message: string, items?: BroadcastItem[]) {
  if (!items || items.length === 0) {
    return message;
  }
  
  // 替换消息中的装备名称为带颜色的 span
  let result = message;
  items.forEach((item) => {
    // 替换 【装备名】 格式
    const coloredName = `<span style="color: ${BroadcastQualityColors[item.quality]}; font-weight: bold;">【${item.name}】</span>`;
    result = result.replace(`【${item.name}】`, coloredName);
  });
  
  return result;
}

function WorldBroadcast({ broadcasts }: WorldBroadcastProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animationKey, setAnimationKey] = useState(0); // 用于重置动画
  const scrollCountRef = useRef(0);
  
  // 监听动画结束事件，滚动3次后切换下一条
  const handleAnimationEnd = useCallback(() => {
    scrollCountRef.current++;
    
    if (scrollCountRef.current >= 3) {
      // 滚动3次后切换到下一条
      scrollCountRef.current = 0;
      setCurrentIndex((prev) => (prev + 1) % broadcasts.length);
      setAnimationKey((prev) => prev + 1); // 重置动画
    }
  }, [broadcasts.length]);
  
  // 当广播列表变化时，重置到最新的一条
  useEffect(() => {
    if (broadcasts.length > 0) {
      setCurrentIndex(0);
      scrollCountRef.current = 0;
      setAnimationKey((prev) => prev + 1);
    }
  }, [broadcasts.length]);
  
  if (broadcasts.length === 0) {
    return (
      <div className={styles.broadcastBar}>
        <div className={styles.broadcastIcon}>📢</div>
        <div className={styles.broadcastContent}>
          <span className={styles.broadcastStaticText}>暂无世界消息</span>
        </div>
      </div>
    );
  }
  
  const currentBroadcast = broadcasts[currentIndex];
  if (!currentBroadcast) return null;
  
  const coloredMessage = renderBroadcastMessage(currentBroadcast.message, currentBroadcast.items);
  
  return (
    <div className={styles.broadcastBar}>
      <div className={styles.broadcastIcon}>
        {currentBroadcast.type === 'enhance' ? '✨' : '🎁'}
      </div>
      <div className={styles.broadcastContent}>
        <span 
          key={animationKey}
          className={styles.broadcastScrollText}
          onAnimationEnd={handleAnimationEnd}
          dangerouslySetInnerHTML={{ __html: coloredMessage }}
        />
        <span className={styles.broadcastCount}>
          ({currentIndex + 1}/{broadcasts.length})
        </span>
      </div>
    </div>
  );
}