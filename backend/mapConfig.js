/**
 * 地图配置系统
 * 6个地图，每个地图10级跨度
 */

const MAP_CONFIGS = [
  {
    id: 1,
    name: '新手草原',
    description: '一片宁静的草原，适合初学者冒险',
    levelRange: [1, 10],
    terrain: 'grass',
    zones: [
      { name: '草原外围', monsterLevel: [1, 3], hasMiniBoss: true, miniBossName: '野猪王' },
      { name: '草原深处', monsterLevel: [3, 5], hasMiniBoss: true, miniBossName: '狼王' },
      { name: '草原中心', monsterLevel: [5, 7], hasMiniBoss: true, miniBossName: '哥布林首领' },
      { name: '草原秘境', monsterLevel: [7, 10], hasMiniBoss: true, miniBossName: '草原守护者' },
    ],
    finalBoss: { name: '草原霸主', level: 10 },
    width: 150,
    height: 150,
  },
  {
    id: 2,
    name: '幽暗森林',
    description: '阴森的森林，栖息着危险的生物',
    levelRange: [11, 20],
    terrain: 'forest',
    zones: [
      { name: '森林边缘', monsterLevel: [11, 13], hasMiniBoss: true, miniBossName: '树妖长老' },
      { name: '迷雾林地', monsterLevel: [13, 15], hasMiniBoss: true, miniBossName: '毒蜘蛛女王' },
      { name: '幽暗深处', monsterLevel: [15, 17], hasMiniBoss: true, miniBossName: '暗影精灵' },
      { name: '森林之心', monsterLevel: [17, 20], hasMiniBoss: true, miniBossName: '森林守卫' },
    ],
    finalBoss: { name: '森林之主', level: 20 },
    width: 175,
    height: 175,
  },
  {
    id: 3,
    name: '灼热沙漠',
    description: '炎热的沙漠，隐藏着古老的秘密',
    levelRange: [21, 30],
    terrain: 'sand',
    zones: [
      { name: '沙漠边缘', monsterLevel: [21, 23], hasMiniBoss: true, miniBossName: '沙虫领主' },
      { name: '流沙地带', monsterLevel: [23, 25], hasMiniBoss: true, miniBossName: '木乃伊王' },
      { name: '金字塔遗迹', monsterLevel: [25, 27], hasMiniBoss: true, miniBossName: '蝎皇' },
      { name: '沙漠腹地', monsterLevel: [27, 30], hasMiniBoss: true, miniBossName: '沙漠领主' },
    ],
    finalBoss: { name: '沙漠法老', level: 30 },
    width: 200,
    height: 200,
  },
  {
    id: 4,
    name: '冰霜高原',
    description: '永恒冰封的高原，极寒之地',
    levelRange: [31, 40],
    terrain: 'stone',
    zones: [
      { name: '冰原边缘', monsterLevel: [31, 33], hasMiniBoss: true, miniBossName: '冰巨人' },
      { name: '霜冻峡谷', monsterLevel: [33, 35], hasMiniBoss: true, miniBossName: '雪女' },
      { name: '暴风雪域', monsterLevel: [35, 37], hasMiniBoss: true, miniBossName: '霜龙' },
      { name: '冰封王座', monsterLevel: [37, 40], hasMiniBoss: true, miniBossName: '冰霜守卫' },
    ],
    finalBoss: { name: '冰霜君王', level: 40 },
    width: 200,
    height: 200,
  },
  {
    id: 5,
    name: '熔岩地带',
    description: '炽热的火山地带，岩浆流淌',
    levelRange: [41, 50],
    terrain: 'lava',
    zones: [
      { name: '火山脚', monsterLevel: [41, 43], hasMiniBoss: true, miniBossName: '炎魔' },
      { name: '熔岩河流', monsterLevel: [43, 45], hasMiniBoss: true, miniBossName: '火焰领主' },
      { name: '烈焰深渊', monsterLevel: [45, 47], hasMiniBoss: true, miniBossName: '凤凰' },
      { name: '火山之心', monsterLevel: [47, 50], hasMiniBoss: true, miniBossName: '熔岩巨人' },
    ],
    finalBoss: { name: '炎魔王', level: 50 },
    width: 225,
    height: 225,
  },
  {
    id: 6,
    name: '暗影深渊',
    description: '最终的试炼之地，黑暗的尽头',
    levelRange: [51, 60],
    terrain: 'stone',
    zones: [
      { name: '深渊入口', monsterLevel: [51, 53], hasMiniBoss: true, miniBossName: '暗影骑士' },
      { name: '暗影迷宫', monsterLevel: [53, 55], hasMiniBoss: true, miniBossName: '虚空行者' },
      { name: '虚空领域', monsterLevel: [55, 57], hasMiniBoss: true, miniBossName: '堕落天使' },
      { name: '深渊核心', monsterLevel: [57, 60], hasMiniBoss: true, miniBossName: '深渊守卫' },
    ],
    finalBoss: { name: '深渊魔王', level: 60 },
    width: 250,
    height: 250,
  },
];

/**
 * 根据玩家等级获取当前地图
 */
function getCurrentMap(playerLevel) {
  for (const mapConfig of MAP_CONFIGS) {
    if (playerLevel <= mapConfig.levelRange[1]) {
      return mapConfig;
    }
  }
  // 超过最高等级，返回最后一个地图
  return MAP_CONFIGS[MAP_CONFIGS.length - 1];
}

/**
 * 获取地图配置
 */
function getMapConfig(mapId) {
  return MAP_CONFIGS.find(m => m.id === mapId) || MAP_CONFIGS[0];
}

module.exports = {
  MAP_CONFIGS,
  getCurrentMap,
  getMapConfig,
};
