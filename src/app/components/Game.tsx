'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import useGame, { EquipmentItem, LogEntry, BattleState, SkillData } from '@/lib/useGame';
import { EquipmentSlot, Quality } from '@/types';
import { MapCell } from '@/types/map';
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
    deleteItem,
    generateWorldMap,
    resetWorldMap,
    movePlayer,
    updatePlayerPosition,
    startBattle,
    playerAttack,
    useSkill,
    endBattle,
    logout,
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
  
  // 获取总属性 - 直接使用后端返回的已计算值
  // 后端已经计算好了装备加成，前端不需要重复计算
  const getTotalStats = useCallback(() => {
    return {
      atk: state.stats.atk,
      def: state.stats.def,
      maxHp: state.maxHp,
      spd: state.stats.spd,
      critRate: state.stats.critRate,
      critDmg: state.stats.critDmg,
    };
  }, [state.stats, state.maxHp]);
  
  // 处理怪物遭遇
  const handleEncounter = useCallback((cell: MapCell) => {
    if (cell.entity && ['monster', 'elite', 'boss'].includes(cell.entity.type)) {
      const level = cell.entity.level || state.level;
      // 转换类型: 'monster' -> 'normal'
      const monsterType = (cell.entity.type === 'monster' ? 'normal' : cell.entity.type) as 'normal' | 'elite' | 'boss';
      startBattle(monsterType, level, cell.x, cell.y);
    }
  }, [state.level, startBattle]);
  
  // PixiMap 处理键盘和遭遇，这里不再需要
  
  const [loginTab, setLoginTab] = useState<'login' | 'register'>('login');
  const [loginUsername, setLoginUsername] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
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

    setLoading(true);
    const result = await login(loginUsername.trim());
    setLoading(false);

    if (!result.success) {
      setMessage(result.message || '登录失败');
    }
  }, [loginUsername, login]);

  // 处理注册
  const handleRegister = useCallback(async () => {
    if (!registerUsername.trim()) {
      setMessage('请输入用户名');
      return;
    }

    setLoading(true);
    const result = await register(registerUsername.trim());
    setLoading(false);

    if (!result.success) {
      setMessage(result.message || '注册失败');
    }
  }, [registerUsername, register]);

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
              <button type="submit" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull}`} disabled={loading}>
                {loading ? '登录中...' : '登录'}
              </button>
              <p className={styles.formHint}>首次使用请先注册</p>
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
                  <div className={styles.expFill} style={{ width: `${(state.exp / (state.level * 100)) * 100}%` }}></div>
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
              <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull}`} onClick={healPlayer} style={{ marginTop: 10 }}>
                💚 恢复生命
              </button>

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
              <div className={styles.inventoryGrid}>
                {state.inventory.map((item) => (
                  <div
                    key={item.id}
                    className={`${styles.inventoryItem} ${selectedItem?.id === item.id ? styles.selected : ''} ${styles[`quality_${item.quality}`]}`}
                    onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
                    onMouseEnter={(e) => showTooltip(e, item)}
                    onMouseLeave={hideTooltip}
                  >
                    <div className={styles.itemIcon} style={{ borderColor: QualityColors[item.quality] }}>
                      {SlotIcons[item.slot]}
                    </div>
                    <span className={`${styles.itemLevel} ${getEnhanceClass(item.level)}`}>+{item.level}</span>
                    {item.isBroken && <div className={styles.brokenBadge}>💔</div>}
                  </div>
                ))}
              </div>
            </section>

            {/* 操作面板 */}
            {selectedItem && (
              <section className={styles.actionPanel}>
                <h2>📋 装备操作</h2>
                <div className={styles.itemDetail}>
                  <div className={styles.itemHeader}>
                    <span style={{ color: QualityColors[selectedItem.quality] }}>
                      {selectedItem.name || `${QualityNames[selectedItem.quality]}${SlotNames[selectedItem.slot]}`}
                    </span>
                    <span className={`${styles.enhanceLevel} ${getEnhanceClass(selectedItem.level)}`}>
                      +{selectedItem.level}
                    </span>
                    {selectedItem.equipLevel && selectedItem.equipLevel > 1 && (
                      <span className={styles.equipLevel}>
                        Lv.{selectedItem.equipLevel}
                      </span>
                    )}
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
                    <button
                      className={`${styles.btn} ${styles.btnSuccess}`}
                      onClick={() => enhanceItem(selectedItem)}
                      disabled={selectedItem.isBroken || selectedItem.level >= 21 || state.gold < getEnhanceCost(selectedItem.level)}
                    >
                      强化 ({getEnhanceCost(selectedItem.level)}💰)
                    </button>
                    <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => deleteItem(selectedItem)}>
                      丢弃
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
                <h2>🗺️ 世界地图</h2>
                <p className={styles.adventureHint}>探索200×200的世界地图，击败怪物获取装备</p>
                <div className={styles.adventureInfo}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoIcon}>⚔️</span>
                    <span>怪物等级随区域递增</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoIcon}>🎁</span>
                    <span>击败怪物掉落装备</span>
                  </div>
                </div>
                <button
                  className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLarge}`}
                  onClick={() => generateWorldMap()}
                >
                  🗺️ 进入世界地图
                </button>
              </section>
            ) : state.battle?.isActive ? (
              // 战斗界面
              <BattleView
                battle={state.battle}
                playerAttack={playerAttack}
                useSkill={useSkill}
                endBattle={endBattle}
                playerHp={state.currentHp}
                playerMaxHp={state.maxHp}
              />
            ) : (
              <div className={styles.worldMapContainer}>
                <section className={styles.mapHeader}>
                  <h2>🗺️ 世界地图 <span className={styles.mapSize}>({state.gameMap.width}×{state.gameMap.height})</span></h2>
                  <div className={styles.mapStats}>
                    <span>👹 普通: {state.gameMap.stats.monsters.defeated}/{state.gameMap.stats.monsters.total}</span>
                    <span>💀 精英: {state.gameMap.stats.elites.defeated}/{state.gameMap.stats.elites.total}</span>
                    <span>🐉 Boss: {state.gameMap.stats.bosses.defeated}/{state.gameMap.stats.bosses.total}</span>
                  </div>
                  <button className={`${styles.btn} ${styles.btnWarning}`} onClick={resetWorldMap}>
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
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tooltip */}
      {tooltip.visible && tooltip.item && (
        <div className={styles.tooltip} style={{ left: tooltip.x, top: tooltip.y }}>
          <div className={styles.tooltipHeader}>
            <span style={{ color: QualityColors[tooltip.item.quality] }}>
              {tooltip.item.name || `${QualityNames[tooltip.item.quality]}${SlotNames[tooltip.item.slot]}`}
            </span>
            <span className={`${styles.enhanceLevel} ${getEnhanceClass(tooltip.item.level)}`}>
              +{tooltip.item.level}
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
          <div className={styles.entityName}>🧙 玩家</div>
          <div className={styles.entityHpBar}>
            <div 
              className={styles.hpFill} 
              style={{ width: `${(playerHp / playerMaxHp) * 100}%`, background: '#4CAF50' }}
            />
          </div>
          <div className={styles.hpText}>{playerHp}/{playerMaxHp}</div>
          <div className={styles.rageBar}>
            <div 
              className={styles.rageFill} 
              style={{ width: `${battle.playerRage}%` }}
            />
            <span className={styles.rageText}>怒气: {battle.playerRage}%</span>
          </div>
        </div>
        
        <div className={styles.vsText}>VS</div>
        
        {/* 怪物 */}
        <div className={styles.battleEntity}>
          <div className={styles.entityName}>
            {battle.monsterType === 'boss' ? '🐉' : battle.monsterType === 'elite' ? '💀' : '👹'} {battle.monsterName}
          </div>
          <div className={styles.monsterLevel}>Lv.{battle.monsterLevel}</div>
          <div className={styles.entityHpBar}>
            <div 
              className={styles.hpFill} 
              style={{ width: `${(battle.monsterHp / battle.monsterMaxHp) * 100}%`, background: '#f44336' }}
            />
          </div>
          <div className={styles.hpText}>{battle.monsterHp}/{battle.monsterMaxHp}</div>
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
              <div className={styles.dropItem}>💰 金币: +{dropInfo?.gold}</div>
              <div className={styles.dropItem}>🎁 装备: +{dropInfo?.items.length}件</div>
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