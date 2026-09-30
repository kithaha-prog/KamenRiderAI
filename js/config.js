// ===== 全局配置与环境 =====
const TOUCH = /[?&]touch=1/.test(location.search) || (matchMedia('(pointer:coarse)').matches && navigator.maxTouchPoints > 0);
if (TOUCH) document.body.classList.add('touch');

// 素材路径
const A = 'Assets/',
      COVER = A + 'Cover/',      
      KR = A + 'Kamen Rider Malaya/',
      RYUKI = A + 'Kamen Rider Ryuki/',
      FAIZ = A + 'Kamen Rider 555/',
      TRANS = A + 'Transform/',
      DRAW = A + 'Draw/',
      ED = A + 'Enemies/',
      SCN = A + 'Scenes/Scene_Highway.jpg',
      PH = 200, GY = 470, WW = 3200;

// Malaya 原生动作
const SH = {
  run: { f: 'KR_Malaya_Run.jpg', c: 3, r: 4, ref: 0 },
  jump: { f: 'KR_Malaya_Jump.jpg', c: 4, r: 3, ref: 8, cut: 8 },
  trans: { f: 'KR_Malaya_Transform.jpg', c: 4, r: 4, ref: 15 },
  sword: { f: 'KR_Malaya_Sword.jpg', c: 4, r: 4, ref: 0, w: 110, mid: 1 },
  fv: { f: 'KR_Malaya_FinalVent.jpg', c: 4, r: 4, ref: 15 },
  atk: { f: 'KR_Malaya_NormalAttack.jpg', c: 4, r: 4, ref: 12 }
};

// Ryuki 动作模组
const SHR = {
  run: { f: 'KR_Ryuki_Run.jpg', c: 4, r: 2, ref: 0 },
  jump: { f: 'KR_Ryuki_Jump.jpg', c: 4, r: 3, ref: 8, cut: 8 },
  sword: { f: 'KR_Ryuki_Sword.jpg', c: 4, r: 4, ref: 0, w: 110, mid: 1 },
  fv: { f: 'KR_Ryuki_FinalVent.jpg', c: 4, r: 4, ref: 15 },
  atk: { f: 'KR_Ryuki_NormalAttack.jpg', c: 4, r: 4, ref: 0 }
};

// ===== 555 (Faiz) 动作模组 =====
// 555 全部素材统一缩放（站立身高 ≈ PH），避免各表格帧尺寸不同造成忽大忽小
const FAIZ_SCALE = PH / 484;
const SH5 = {
  run:  { f: 'KR_555_Run.jpg',          c: 3, r: 4, ref: 0 },
  jump: { f: 'KR_555_Jump.jpg',         c: 4, r: 2, ref: 2 },
  atk:  { f: 'KR_555_NormalAttack.jpg', c: 4, r: 3, ref: 0 },
  fv:   { f: 'KR_555_FinalVent.jpg',    c: 4, r: 4, ref: 15 }
  // trans（变身表 4×4）在 main.js 里加载后挂到 SH5.trans
};
// 变身动画：每 0.12s 一步，值 = 变身表里的帧号（0~3 Malaya → 4~7 光环/粒子/爆发 → 8~11 555 → 8 待机）
const FAIZ_TRANS_SEQ = [0, 1, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 10, 11, 8];
// 普通攻击：按 P.t*14 取帧（第 3、5 步为判定帧）
const FAIZ_ATK_SEQ = [1, 3, 4, 5, 6, 8];
const FAIZ_ATK_FLIP = 1;   // 若发现刀光出现在身后，改成 -1 即可整体镜像
// 大招时间线（秒）：charge 蓄力 → rise 跳起 → hold 顶点 → dive 前圆锥定身停顿结束、开始砸落；tip=圆锥尖端在身前多少像素
const FAIZ_FV = { charge: .72, rise: 1.08, hold: 1.16, dive: 1.72, tip: 92 };
// L 技能：手持手机枪。pose=变身表中“举手”的那一帧；hx/hy=该帧里手的位置(512格内像素)；
// w=枪在游戏中的宽度；gx/gy=握把在枪图(已镜像)中的位置比例；mx/my=枪口位置比例；spd=子弹速度
const FAIZ_GUN = { pose: 10, hx: 416, hy: 168, w: 64, gx: .133, gy: .72, mx: .996, my: .318, spd: 1500 };
let GUN5 = null, BUL5 = null;
const CAP_IMGS = {};   // 胶囊卡面：id → Image

// 敌人基础属性
const ET = {
  imp: { hp: 30, H: 70, sp: 120, xp: 10, g: 8, dm: 8, col: '#4cd0ff' },
  wd: { hp: 90, H: 140, sp: 70, xp: 30, g: 20, dm: 10, col: '#c9a0ff' },
  boss: { hp: 800, H: 340, sp: 55, xp: 0, g: 0, dm: 22, col: '#55dd66' }
};

// ===== 关卡数据（产出装备等级完全由 r 决定，最高支持至 Lv.500） =====
const ST = [
  // 第一章：公路高架 (set: 1)
  { n: '1-1 公路入口', k: 20, b: 0, wd: 0, g: 150, r: 1, ov: '', set: 1 },
  { n: '1-2 黄昏高架', k: 32, b: 0, wd: .4, g: 320, r: 3, ov: 'rgba(255,80,0,.14)', set: 1 },
  { n: '1-3 翡翠巨龙', k: 28, b: 1, bn: '翡翠巨龙', wd: .4, g: 700, r: 7, ov: 'rgba(20,0,70,.32)', set: 1 },

  // 第二章：烈焰焦土 (set: 2)
  { n: '2-1 熔岩边境', k: 28, b: 0, wd: .3, g: 1050, r: 10, ov: 'rgba(255,60,0,.16)', set: 2 },
  { n: '2-2 烈焰焦土', k: 36, b: 0, wd: .5, g: 1600, r: 12, ov: 'rgba(220,40,0,.26)', set: 2 },
  { n: '2-3 炎狱魔尊', k: 32, b: 1, bn: '炎狱魔尊', wd: .5, g: 2800, r: 15, ov: 'rgba(90,0,10,.38)', set: 2 },

  // 第三章：苍雷废都 (set: 3)
  { n: '3-1 荒芜废都', k: 32, b: 0, wd: .4, g: 4000, r: 18, ov: 'rgba(40,10,80,.20)', set: 3 },
  { n: '3-2 苍雷矩阵', k: 40, b: 0, wd: .5, g: 5800, r: 21, ov: 'rgba(0,50,150,.24)', set: 3 },
  { n: '3-3 轰雷兽皇', k: 36, b: 1, bn: '轰雷兽皇', wd: .5, g: 8800, r: 24, ov: 'rgba(70,0,120,.35)', set: 3 },

  // 第四章：极寒冰川 (set: 4)
  { n: '4-1 极寒冻原', k: 36, b: 0, wd: .4, g: 12000, r: 27, ov: 'rgba(0,60,120,.22)', set: 4 },
  { n: '4-2 霜啸裂谷', k: 44, b: 0, wd: .5, g: 16500, r: 30, ov: 'rgba(0,100,160,.28)', set: 4 },
  { n: '4-3 寒霜邪神', k: 40, b: 1, bn: '寒霜邪神', wd: .5, g: 24000, r: 33, ov: 'rgba(10,40,90,.36)', set: 4 },

  // 第五章：剧毒沼泽 (set: 5)
  { n: '5-1 腐蚀泥潭', k: 40, b: 0, wd: .4, g: 30000, r: 36, ov: 'rgba(20,70,10,.22)', set: 5 },
  { n: '5-2 剧毒坑道', k: 48, b: 0, wd: .5, g: 40000, r: 39, ov: 'rgba(40,80,0,.28)', set: 5 },
  { n: '5-3 灾厄毒君', k: 44, b: 1, bn: '灾厄毒君', wd: .5, g: 58000, r: 43, ov: 'rgba(30,60,15,.38)', set: 5 },

  // 第六章：机械要塞 (set: 6)
  { n: '6-1 废弃要塞', k: 44, b: 0, wd: .4, g: 72000, r: 46, ov: 'rgba(70,50,20,.22)', set: 6 },
  { n: '6-2 动力熔炉', k: 52, b: 0, wd: .5, g: 95000, r: 49, ov: 'rgba(90,40,10,.28)', set: 6 },
  { n: '6-3 终结机神', k: 48, b: 1, bn: '终结机神', wd: .5, g: 130000, r: 53, ov: 'rgba(80,60,30,.35)', set: 6 },

  // 第七章：虚空深渊 (set: 7)
  { n: '7-1 裂隙回廊', k: 48, b: 0, wd: .4, g: 165000, r: 56, ov: 'rgba(50,0,80,.26)', set: 7 },
  { n: '7-2 异界畸变', k: 56, b: 0, wd: .5, g: 215000, r: 59, ov: 'rgba(70,10,100,.32)', set: 7 },
  { n: '7-3 虚空大君', k: 52, b: 1, bn: '虚空大君', wd: .5, g: 290000, r: 63, ov: 'rgba(40,0,60,.42)', set: 7 },

  // 第八章：圣辉神域 (set: 8)
  { n: '8-1 浮空神域', k: 52, b: 0, wd: .4, g: 370000, r: 67, ov: 'rgba(90,80,20,.24)', set: 8 },
  { n: '8-2 极光圣所', k: 60, b: 0, wd: .5, g: 480000, r: 70, ov: 'rgba(100,90,30,.30)', set: 8 },
  { n: '8-3 审判天使', k: 56, b: 1, bn: '审判炽天使', wd: .5, g: 650000, r: 74, ov: 'rgba(120,100,40,.36)', set: 8 },

  // 第九章：混沌星骸 (set: 9)
  { n: '9-1 碎星暗礁', k: 56, b: 0, wd: .4, g: 820000, r: 78, ov: 'rgba(60,10,40,.28)', set: 9 },
  { n: '9-2 暗核引力', k: 64, b: 0, wd: .5, g: 1050000, r: 81, ov: 'rgba(80,20,50,.34)', set: 9 },
  { n: '9-3 湮灭魔皇', k: 60, b: 1, bn: '湮灭吞噬者', wd: .5, g: 1400000, r: 85, ov: 'rgba(70,10,30,.40)', set: 9 },

  // 第十章：创世终焉 (set: 10)
  { n: '10-1 维度裂隙', k: 60, b: 0, wd: .5, g: 1800000, r: 89, ov: 'rgba(30,10,50,.32)', set: 10 },
  { n: '10-2 原初虚无', k: 68, b: 0, wd: .6, g: 2300000, r: 93, ov: 'rgba(50,5,40,.38)', set: 10 },
  { n: '10-3 终焉魔神', k: 70, b: 1, bn: '创世·终焉魔神', wd: .6, g: 3500000, r: 98, ov: 'rgba(40,5,60,.46)', set: 10 }
];

// ===== 世界BOSS（作为特殊关卡追加在 ST 末尾，复用整套战斗系统；不计入章节进度 S.cl） =====
// lv=解锁等级  r=推荐等级  g=满伤害金币奖励  hpx=生命倍率  tl=讨伐时限(秒)  set=使用第几章的怪物图与招式
const WB_DAILY = 3;
const WB = [
  { n: '炎狱暴君', set: 2,  lv: 12, r: 15, g: 6000,    hpx: 6,  tl: 120, ov: 'rgba(120,20,0,.34)',  d: '熔岩深处苏醒的火焰君王，\n每一次咆哮都会点燃整片战场。' },
  { n: '苍雷天罚', set: 3,  lv: 21, r: 24, g: 14000,   hpx: 6,  tl: 120, ov: 'rgba(30,20,120,.34)', d: '撕裂云层的雷霆化身，\n雷光落下之前会留下短暂的预兆。' },
  { n: '寒霜古神', set: 4,  lv: 30, r: 33, g: 40000,   hpx: 7,  tl: 120, ov: 'rgba(0,80,140,.34)',  d: '沉睡万年的冰川之神，\n寒气所及之处万物凝滞。' },
  { n: '灾厄毒神', set: 5,  lv: 40, r: 43, g: 90000,   hpx: 7,  tl: 135, ov: 'rgba(30,80,10,.36)',  d: '腐化沼泽孕育的灾厄，\n剧毒会一点点侵蚀你的生命。' },
  { n: '虚空吞噬者', set: 7, lv: 60, r: 63, g: 450000,  hpx: 8,  tl: 150, ov: 'rgba(50,0,90,.40)',   d: '来自维度裂隙的无形巨兽，\n连光与空间都会被它吞没。' },
  { n: '终焉之神', set: 10, lv: 95, r: 98, g: 5500000, hpx: 10, tl: 180, ov: 'rgba(50,0,60,.46)',   d: '创世终焉的化身，\n拥有全部形态的终极攻势。' }
];
WB.forEach(w => {
  w.si = ST.length;
  ST.push({ n: '世界BOSS·' + w.n, k: 0, b: 1, bn: w.n, wd: 0, g: w.g, r: w.r, ov: w.ov, set: w.set, wb: 1, hpx: w.hpx, tl: w.tl });
});

// 怪物强度由推荐等级 r 推导（想整体调难度只改下面两个系数即可）
const HP_K = 0.6, DM_K = 0.025;
const atkExp = r => (14 + 19 * r) * (1 + .02 * r);      // 该等级玩家的大致攻击力
const hpExp  = r => (100 + 75 * r) * (1 + .02 * r);     // 该等级玩家的大致生命值
ST.forEach(z => {
  z.hm = Math.max(1, +(atkExp(z.r) * HP_K / 30).toFixed(1));
  z.dm = Math.max(1, +(hpExp(z.r) * DM_K / 8).toFixed(1));
});

// ===== 各章怪物攻击方式（每章一套） =====
// imp=飞行小怪  wd=远程精英  boss=首领；名称对应 battle.js 里的 ATKS
const THEME = ['', '翡翠', '烈焰', '苍雷', '寒霜', '瘟毒', '机械', '虚空', '圣辉', '星骸', '终焉'];
const ATK_SET = {
  1: { imp: ['swoop', 'aim'],          wd: ['fan', 'lob', 'aim'],                boss: ['fan', 'lob', 'charge', 'slam'] },
  2: { imp: ['aim', 'swoop'],          wd: ['lobPool', 'fan', 'pillar'],         boss: ['pillars', 'lobPool', 'ring', 'slam', 'rain'] },
  3: { imp: ['zap', 'swoop'],          wd: ['pillar', 'burst', 'wave'],          boss: ['pillars', 'beam', 'charge', 'wave', 'ring'] },
  4: { imp: ['aim', 'zap'],            wd: ['rain', 'fan', 'wave'],              boss: ['rain', 'ring', 'slam', 'pillars', 'homing'] },
  5: { imp: ['aim', 'swoop'],          wd: ['lobPool', 'wave', 'homing'],        boss: ['lobPool', 'rain', 'ring', 'summon', 'pillars'] },
  6: { imp: ['burst', 'aim'],          wd: ['burst', 'homing', 'beam'],          boss: ['beam', 'burst', 'ring', 'summon', 'slam', 'homing'] },
  7: { imp: ['blink', 'aim'],          wd: ['blink', 'homing', 'wave'],          boss: ['vortex', 'spiral', 'summon', 'homing', 'beam'] },
  8: { imp: ['zap', 'aim'],            wd: ['pillar', 'fan', 'beam'],            boss: ['pillars', 'beam', 'spiral', 'homing', 'ring'] },
  9: { imp: ['swoop', 'zap'],          wd: ['meteor', 'ring', 'homing'],         boss: ['meteor', 'vortex', 'summon', 'spiral', 'slam', 'beam'] },
  10:{ imp: ['swoop', 'zap', 'blink'], wd: ['meteor', 'beam', 'burst', 'blink', 'pillar', 'lobPool'],
       boss: ['meteor', 'vortex', 'beam', 'pillars', 'spiral', 'summon', 'slam', 'rain', 'homing', 'charge'] }
};

// ===== 章节配置（全10章） =====
const CHAPTERS = [
  {
    id: 1,
    name: '第一章',
    title: '公路高架',
    sub: '翡翠之灾 · 城市边缘',
    desc: '异界魔物突破维度屏障，翡翠巨龙现身公路尽头。',
    stages: [0, 1, 2],
    col: '#00d2d3'
  },
  {
    id: 2,
    name: '第二章',
    title: '烈焰焦土',
    sub: '炎狱深渊 · 熔岩焦土',
    desc: '地下裂隙喷涌炽烈火海，炎狱魔尊构筑毁灭王座。',
    stages: [3, 4, 5],
    col: '#ff4757'
  },
  {
    id: 3,
    name: '第三章',
    title: '苍雷废都',
    sub: '电弧狂暴 · 废墟之巅',
    desc: '电磁风暴撕裂建筑群，雷霆巨兽在雷光中肆虐咆哮。',
    stages: [6, 7, 8],
    col: '#5352ed'
  },
  {
    id: 4,
    name: '第四章',
    title: '极寒冰川',
    sub: '万丈霜痕 · 冻土禁域',
    desc: '绝对零度的寒流冻结万物，寒霜邪神从冰棺中苏醒。',
    stages: [9, 10, 11],
    col: '#70a1ff'
  },
  {
    id: 5,
    name: '第五章',
    title: '剧毒沼泽',
    sub: '腐蚀深潭 · 瘟疫之窟',
    desc: '致命毒雾遮天蔽日，灾厄毒君统帅异变生物吞噬生机。',
    stages: [12, 13, 14],
    col: '#2ed573'
  },
  {
    id: 6,
    name: '第六章',
    title: '机械要塞',
    sub: '钢铁洪流 · 动力核心',
    desc: '古代战争机械全面觉醒，终结机神以绝对武力构筑防线。',
    stages: [15, 16, 17],
    col: '#ffa502'
  },
  {
    id: 7,
    name: '第七章',
    title: '虚空深渊',
    sub: '维度撕裂 · 暗影狂潮',
    desc: '时空在此扭曲断裂，虚空大君跨界降临企图吞噬现实。',
    stages: [18, 19, 20],
    col: '#a55eea'
  },
  {
    id: 8,
    name: '第八章',
    title: '圣辉神域',
    sub: '天穹王座 · 极光圣殿',
    desc: '极光闪耀的神圣殿堂，审判天使降下灭世神罚。',
    stages: [21, 22, 23],
    col: '#ffd32a'
  },
  {
    id: 9,
    name: '第九章',
    title: '混沌星骸',
    sub: '星核崩解 · 引力漩涡',
    desc: '群星陨落后的焦黑残骸，湮灭吞噬者盘踞在破碎星核中。',
    stages: [24, 25, 26],
    col: '#ff6348'
  },
  {
    id: 10,
    name: '第十章',
    title: '创世终焉',
    sub: '原初奇点 · 终局决战',
    desc: '万物归于虚无的奇点，直面终焉魔神，迎来假面骑士的最终宿命！',
    stages: [27, 28, 29],
    col: '#ff3838'
  }
];

// 天赋配置
const TL = [
  ['攻击强化', '伤害 +8%'],
  ['生命强化', '最大生命 +10%'],
  ['魔力强化', '最大魔力 +10%'],
  ['会心一击', '暴击率 +3%（暴击×2）']
];

// ===== 变身胶囊注册中心（仅保留拥有实际美术与动作素材的骑士） =====
const CAPSULES = [
  {
    id: 'ryuki',
    name: '假面骑士 龙骑',
    short: '龙骑',
    slotName: '龙骑契约胶囊',
    rider: 'RYUKI',
    tier: 4, // 传说
    c: '#ff3838',
    tag: '镜界契约',
    desc: '与无双龙缔结契约的镜世界战士，具备炽烈龙炎与终极飞踢。',
    buff: '攻击力 +30%，暴击率 +15%',
    skill: 'L · 飞剑（贯穿斩击）',
    finisher: 'FINAL VENT · 烈焰飞踢 (斜下砸地全屏大爆炸)',
    trait: '龙炎爆破 · 专属烈火动作模组',
    atkMul: 1.3, crAdd: .15, spdMul: 1
  },
  {
    id: '555',
    name: '假面骑士 555',
    short: '555',
    slotName: '555 智脑胶囊',
    rider: 'FAIZ',
    tier: 4, // 传说
    c: '#ffb400',
    tag: '智脑觉醒',
    desc: '佩戴 Faiz 腰带的光之战士，红色光刃与手机变形枪并用。',
    buff: '攻击力 +22%，暴击率 +10%，移速 +15%',
    skill: 'L · 手机枪（穿透光弹，自动瞄准）',
    finisher: 'EXCEED CHARGE · 红锥飞踢 (跃起→锥体定身→砸落)',
    trait: '光速机动 · 手机枪射击 · 红锥必杀',
    atkMul: 1.22, crAdd: .10, spdMul: 1.15
  }
];

// 胶囊终端交互状态
let curSelCapId = 'ryuki', capPage = 0, capFilter = 'all';

// 全局状态与池
// 全局状态与池
let uid = 0;
let G = 'load', msg = '加载中…', T = 0, cam = 0, shake = 0;
let E = [], PJ = [], EP = [], FX = [], DT = [], OR = [], GH = [], HZ = [], TQ = [];
let kills = 0, bs = 0, sp = 1, cur = 0, RG = 0, FG = 0;
let EN = {}, ENS = {}, BK, SC, SC_MAP = {}, CAP_IMG = null, COVER_IMG = null, miss = [], ENL = [], EMAP = null, IM = {};
let showChar = false, gachaModal = null, showCapModal = false; // showCapModal 独立胶囊界面状态
let M = 0, RM = null, NR = null;
let WBT = 0, WBD = 0, WBM = 0, WBR = '';   // 世界BOSS：剩余时间 / 累计伤害 / 首领总血量 / 结束原因

// 画布实例
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
let DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, TOUCH ? 1.5 : 2.5);
  cv.width = 960 * DPR;
  cv.height = 540 * DPR;
}
resize();
window.addEventListener('resize', resize);
// 像素吸附：把逻辑坐标对齐到设备像素，避免子像素采样造成的画面/角色抖动
const sn = v => Math.round(v * DPR) / DPR;

// 输入表
const K = {}, PR = {};

// 存档结构与持久化
const S = {
  g: 200, hp: 2, mp: 1, sw: 0, ar: 0, bt: 0, lv: 1, xp: 0, tp: 0, ta: [0, 0, 0, 0], cl: 0,
  caps: [], eqCap: null,
  inv: [],
  eq: { weapon: null, chest: null, belt: null, legs: null, boots: null, necklace: null, ring: null },
  mat: 20, scr: 3
};

try {
  Object.assign(S, JSON.parse(localStorage.malaya));
  if (!Array.isArray(S.caps)) S.caps = [];
  if (!Array.isArray(S.inv)) S.inv = [];
  if (!S.eq || typeof S.eq !== 'object') S.eq = { weapon: null, chest: null, belt: null, legs: null, boots: null, necklace: null, ring: null };
  if (typeof S.mat !== 'number') S.mat = 20;
  if (typeof S.scr !== 'number') S.scr = 3;
} catch (e) {}

const save = () => { try { localStorage.malaya = JSON.stringify(S) } catch (e) {} };
const cl = (v, a, b) => Math.max(a, Math.min(b, v));

// 图像切片与去色去噪图形工具
const load = s => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(s); i.src = encodeURI(s) });

function key(im, x, y, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(im, x, y, w, h, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], gg = p[i + 1], b = p[i + 2], k = gg - Math.max(r, b);
    if (gg > 80 && k > 45) {
      if (k > 80) p[i + 3] = 0;
      else p[i + 3] = Math.max(0, 255 * (80 - k) / 35);
    }
  }
  g.putImageData(d, 0, 0); return c;
}

// 发光弹体抠图：绿幕背景 r≈0，光体 r 很高 → 以红通道决定透明度，并压掉边缘绿色溢色；配合 'lighter' 叠加绘制
function glowKey(im) {
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], gg = p[i + 1], b = p[i + 2];
    p[i + 3] = 255 * Math.max(0, Math.min(1, (r - 60) / 140));
    p[i + 1] = Math.min(gg, r * .75 + b * .5);
  }
  g.putImageData(d, 0, 0); return c;
}

// 去绿边：半透明边缘里偏绿的像素拉回中性
function despill(c) {
  const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) if (p[i + 3]) { const m = Math.max(p[i], p[i + 2]); if (p[i + 1] > m) p[i + 1] = m + (p[i + 1] - m) * .15 }
  g.putImageData(d, 0, 0); return c;
}

function cleanFrame(canvas) {
  const w = canvas.width, h = canvas.height, ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, w, h), p = imgData.data;
  const vis = new Uint8Array(w * h), blobs = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (vis[idx] || p[idx * 4 + 3] <= 25) continue;
      const q = [idx], pxs = []; vis[idx] = 1;
      let minX = x, maxX = x, minY = y, maxY = y, head = 0;
      while (head < q.length) {
        const cur = q[head++], cx = cur % w, cy = (cur / w) | 0;
        pxs.push(cur);
        if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
        const nbs = [cx > 0 ? cur - 1 : -1, cx < w - 1 ? cur + 1 : -1, cur - w, cur + w];
        for (const n of nbs) {
          if (n >= 0 && n < w * h && !vis[n] && p[n * 4 + 3] > 25) { vis[n] = 1; q.push(n) }
        }
      }
      blobs.push({ pxs, cnt: pxs.length, minX, maxX, minY, maxY });
    }
  }
  if (blobs.length <= 1) return canvas;
  blobs.sort((a, b) => b.cnt - a.cnt);
  const main = blobs[0];
  for (let i = 1; i < blobs.length; i++) {
    const b = blobs[i];
    const touchesEdge = (b.minX <= 4 || b.maxX >= w - 5 || b.minY <= 4 || b.maxY >= h - 5);
    const gapX = Math.max(0, main.minX - b.maxX, b.minX - main.maxX);
    const gapY = Math.max(0, main.minY - b.maxY, b.minY - main.maxY);
    const isDetached = (gapX > 6 || gapY > 6);
    const isFragment = b.cnt < main.cnt * 0.35;
    if ((touchesEdge && isFragment) || (isDetached && isFragment)) {
      for (const pt of b.pxs) p[pt * 4 + 3] = 0;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function bb(c) {
  const w = c.width, h = c.height, p = c.getContext('2d').getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (p[(y * w + x) * 4 + 3] > 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  return { x0, y0, x1, y1 };
}

function trim(c) { const b = bb(c), w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1, o = document.createElement('canvas'); o.width = w; o.height = h; o.getContext('2d').drawImage(c, b.x0, b.y0, w, h, 0, 0, w, h); return o }

function sliceSheet(im, cNum, rNum, refIdx = 0, cut = 0, doClean = false) {
  const cw = im.width / cNum | 0, ch = im.height / rNum | 0, fr = [];
  for (let r = 0; r < rNum; r++) for (let c = 0; c < cNum; c++) {
    let k = key(im, c * cw, r * ch, cw, ch);
    if (cut && r === rNum - 1) k.getContext('2d').clearRect(0, ch - cut, cw, cut);
    if (doClean) k = cleanFrame(k);
    fr.push(k);
  }
  const b = bb(fr[refIdx] || fr[0]);
  return { f: fr, cw, ch, fy: b.y1, s: PH / (b.y1 - b.y0) };
}
function ph(c) { const o = document.createElement('canvas'); o.width = 80; o.height = 120; const g = o.getContext('2d'); g.fillStyle = c; g.fillRect(10, 10, 60, 110); return o }

function bkey(im) {
  const w = im.width, h = im.height, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, w, h), p = d.data, sd = [[0, 0], [w - 1, 0], [w >> 1, 0], [0, h >> 1], [w - 1, h >> 1], [0, h - 1], [w - 1, h - 1], [w >> 1, h - 1], [0, h * .9 | 0], [w - 1, h * .9 | 0]].map(([x, y]) => { const i = (y * w + x) * 4; return [p[i], p[i + 1], p[i + 2]] });
  const seen = new Uint8Array(w * h), st = [], push = (x, y) => { const n = y * w + x, i = n * 4; if (!seen[n] && sd.some(s => Math.abs(p[i] - s[0]) + Math.abs(p[i + 1] - s[1]) + Math.abs(p[i + 2] - s[2]) < 45)) { seen[n] = 1; st.push(n) } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1) } for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y) }
  while (st.length) { const n = st.pop(), x = n % w, y = n / w | 0; p[n * 4 + 3] = 0; if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1) }
  g.putImageData(d, 0, 0); const cx = new Int32Array(w), cy = new Int32Array(h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (p[(y * w + x) * 4 + 3]) { cx[x]++; cy[y]++ }
  const f = (a, n) => { let i = 0, j = n - 1; while (i < n && a[i] < 12) i++; while (j > 0 && a[j] < 12) j--; return [i, j] }, [x0, x1] = f(cx, w), [y0, y1] = f(cy, h), o = document.createElement('canvas');
  o.width = x1 - x0 + 1; o.height = y1 - y0 + 1; o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height); return o;
}

function cut(im) {
  const w = im.width, h = im.height, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, w, h), p = d.data, cs = [0, (w - 1) * 4, (h - 1) * w * 4, (h * w - 1) * 4], bc = [0, 1, 2].map(j => cs.map(i => p[i + j]).sort((a, b) => a - b)[1]);
  const seen = new Uint8Array(w * h), st = [], push = (x, y) => { const n = y * w + x, i = n * 4; if (!seen[n] && Math.abs(p[i] - bc[0]) + Math.abs(p[i + 1] - bc[1]) + Math.abs(p[i + 2] - bc[2]) < 110) { seen[n] = 1; st.push(n) } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1) } for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y) }
  while (st.length) { const n = st.pop(), x = n % w, y = n / w | 0; p[n * 4 + 3] = 0; if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1) }
  g.putImageData(d, 0, 0); const gw = Math.ceil(w / 4), gh = Math.ceil(h / 4), m = new Uint8Array(gw * gh), D = new Uint8Array(gw * gw);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (p[(y * w + x) * 4 + 3]) m[(y >> 2) * gw + (x >> 2)] = 1;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) if (m[y * gw + x]) for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const X = x + i, Y = y + j; if (X >= 0 && X < gw && Y >= 0 && Y < gh) D[Y * gw + X] = 1 }
  const out = [];
  for (let s0 = 0; s0 < D.length; s0++) {
    if (D[s0] !== 1) continue; let x0 = gw, y0 = gh, x1 = 0, y1 = 0, cnt = 0; const q = [s0]; D[s0] = 2;
    while (q.length) {
      const n = q.pop(), x = n % gw, y = n / gw | 0; cnt += m[n]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + a, Y = y + b; if (X >= 0 && X < gw && Y >= 0 && Y < gh && D[Y * gw + X] === 1) { D[Y * gw + X] = 2; q.push(Y * gw + X) } }
    }
    if (cnt < gw * gh * .0015) continue; const o = document.createElement('canvas'), ow = (x1 - x0 + 1) * 4, oh = (y1 - y0 + 1) * 4; o.width = ow; o.height = oh;
    o.getContext('2d').drawImage(c, x0 * 4, y0 * 4, ow, oh, 0, 0, ow, oh); const t = trim(o); t.ry = Math.round((y0 + y1) / 2 / (gh / 6)); t.rx = x0; out.push(t)
  }
  return out.sort((a, b) => a.ry - b.ry || a.rx - b.rx);
}

function assign(L) {
  const r = {}, ix = L.map((_, i) => i).sort((a, b) => L[a].width * L[a].height - L[b].width * L[b].height);
  if (EMAP) { for (const k in EMAP) r[k] = EMAP[k].map(i => L[i]).filter(Boolean) }
  else if (L.length) { r.boss = [L[ix.pop()]]; const m = Math.ceil(ix.length / 2); r.imp = ix.slice(0, m).map(i => L[i]); r.wd = ix.slice(m).map(i => L[i]) } return r;
}