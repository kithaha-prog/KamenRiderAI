// ===== 全局配置与环境 =====
const TOUCH = /[?&]touch=1/.test(location.search) || (matchMedia('(pointer:coarse)').matches && navigator.maxTouchPoints > 0);
if (TOUCH) document.body.classList.add('touch');

// 素材路径
const A = 'Assets/',
      COVER = A + 'Cover/',      
      KR = A + 'Kamen Rider Malaya/',
      RYUKI = A + 'Kamen Rider Ryuki/',
      FAIZ = A + 'Kamen Rider 555/',
      BLADE = A + 'Kamen Rider Blade/',
      TRANS = A + 'Transform/',
      DRAW = A + 'Draw/',
      ED = A + 'Enemies/',
      SCN = A + 'Scenes/Scene_Highway.jpg',
      PH = 200, GY = 470, WW = 3200;

// Malaya 原生动作
const SH = {
  run: { f: 'KR_Malaya_Run.png', c: 3, r: 4, ref: 0 },
  jump: { f: 'KR_Malaya_Jump.png', c: 4, r: 3, ref: 8, cut: 8 },
  trans: { f: 'KR_Malaya_Transform.png', c: 4, r: 4, ref: 15 },
  sword: { f: 'KR_Malaya_Sword.png', c: 4, r: 4, ref: 0, w: 110, mid: 1 },
  fv: { f: 'KR_Malaya_FinalVent.png', c: 4, r: 4, ref: 15 },
  atk: { f: 'KR_Malaya_NormalAttack.png', c: 4, r: 4, ref: 12 }
};

// Ryuki 动作模组
const SHR = {
  run: { f: 'KR_Ryuki_Run.png', c: 4, r: 2, ref: 0 },
  jump: { f: 'KR_Ryuki_Jump.png', c: 4, r: 3, ref: 8, cut: 8 },
  sword: { f: 'KR_Ryuki_Sword.png', c: 4, r: 4, ref: 0, w: 110, mid: 1 },
  fv: { f: 'KR_Ryuki_FinalVent.png', c: 4, r: 4, ref: 15 },
  atk: { f: 'KR_Ryuki_NormalAttack.png', c: 4, r: 4, ref: 0 }
};

// ===== 555 (Faiz) 动作模组 =====
// 555 全部素材统一缩放（站立身高 ≈ PH），避免各表格帧尺寸不同造成忽大忽小
const FAIZ_SCALE = PH / 484;
const SH5 = {
  run:  { f: 'KR_555_Run.png',          c: 3, r: 4, ref: 0 },
  jump: { f: 'KR_555_Jump.png',         c: 4, r: 2, ref: 2 },
  atk:  { f: 'KR_555_NormalAttack.png', c: 4, r: 3, ref: 0 },
  fv:   { f: 'KR_555_FinalVent.png',    c: 4, r: 4, ref: 15 }
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

// ===== Blade 动作模组（素材：Assets/Kamen Rider Blade/）=====
// 各表格统一以“站立身高 ≈ PH”缩放（由 sliceSheet 的 ref 帧决定）。
const SH6 = {
  run:  { f: 'KR_Blade_Run.png',          c: 3, r: 2, ref: 0 },
  jump: { f: 'KR_Blade_Jump.png',         c: 4, r: 3, ref: 8 },
  atk:  { f: 'KR_Blade_NormalAttack.png', c: 4, r: 4, ref: 12 },
  fv:   { f: 'KR_Blade_FinalVent.png',    c: 4, r: 4, ref: 15 }
};
// 每一帧里角色的水平锚点（原图像素：头部红眼 / 身体质心），保证切换动作时模型不前后晃动
const BLADE_AX = {
  run:  [367, 363, 381, 376, 369, 374],
  jump: [380, 401, 385, 361, 355, 372, 359, 356, 361, 369, 379, 363],
  atk:  [312, 321, 302, 316, 350, 361, 325, 334, 350, 326, 315, 299, 301, 292, 290, 287],
  fv:   [131, 128, 187, 134, 134, 136, 147, 148, 129, 133, 112, 124, 150, 128, 168, 136]
};
const BLADE_FOOT = { run: [505, 530, 501, 476, 482, 482] };   // 跑步表逐帧脚底
// 普通攻击：按 P.t*14 取帧（第 3、5 步为判定帧 = 第一道蓝色刀光 / 金色刀光）
const BLADE_ATK_SEQ = [1, 3, 4, 5, 6, 7, 8];
// 变身表 Transform/KR_Malaya_TransformTo_KR_Blade.png（5列×4行=20帧）：0~1 Malaya → 2~4 取牌 → 5~12 卡牌环 → 13~14 装甲生成 → 15~19 Blade；若朝向反了把 BLADE_TRANS_FLIP 改成 -1
const BLADE_TRANS_FLIP = 1;
// ★ 变身时间轴：对齐 Assets/SoundFX/Kamen_Rider_Blade_Henshin.mp3（11.35 秒）。下面的时间都是“音频原速的秒数”，
//   实际播放按音频真实时长等比换算，并且动画时钟直接跟随音频的 currentTime（暂停/卡顿后也不会错位）。
//   时间点来自音频的能量/低频分析：0.44 首个音头 · 3.0 低音鼓点进入(每 ~0.9s 一拍) · 6.87 大冲击 · 7.48 全曲最强一击 · 9.0 / 9.82 两次重音 · 10.5 起淡出
const BLADE_AUDIO_LEN = 11.35;
const BLADE_TL = {
  draw: .44,                              // 抽牌
  belt: 1.25,                             // 腰带亮起
  spark: 2.0,                             // 卡牌开始飞出
  beats: [3.0, 3.9, 4.8, 5.6, 6.25],      // 鼓点：每拍一圈地面涟漪
  gate: 6.87,                             // 穿过觉醒之门（卡牌环扫过全身）
  burst: 7.48,                            // 水花炸开、脱去 Malaya
  scans: [8.0, 8.45, 8.9],                // 装甲逐段生成（扫描光带）
  wave: 9.0,                              // 第二次重音
  fin: 9.82,                              // 眼睛变红，OPEN UP
  calm: 10.5                              // 余韵
};
// [时间, 变身表帧号, 是否硬切]；'spin' = 卡牌环旋转（8/9/10 三帧循环）直到下一个关键帧
const BLADE_KEYS = [[0, 0], [.44, 2], [1.25, 3], [2.0, 4], [3.0, 5], [3.9, 6], [4.8, 7], [5.45, 'spin'],
  [6.87, 11, 1], [7.2, 12], [7.48, 13, 1], [8.0, 14], [8.45, 15], [8.9, 16], [9.3, 17], [9.82, 18, 1], [10.15, 19]];
const BLADE_IDLE_FLIP = 1;   // 待机(帧12/13) 与 L 技能姿势(帧10) 的镜像系数：素材里这几帧朝右，所以不镜像；若发现反了，改成 -1
const ATK_REACH = 220;   // 所有形态普攻判定向前延伸的距离（原来是 180；想更长/更短改这里）
const BLADE_ATK_FLIP = 1;    // 攻击/待机表里角色朝左，所以镜像；若发现刀光出现在身后，改成 1
// 大招时间线（秒）：charge 蓄力 → rise 跳起 → hold 顶点 → dive 锥体定身停顿结束、开始砸落；tip=落点在身前多少像素
const BLADE_FV = { charge: .86, rise: 1.2, hold: 1.32, dive: 1.82, tip: 105 };
// L 技能：手持剑召雷。pose=攻击表中“无剑、前伸拳头”的帧；hx/hy=该帧里拳头位置(512格内像素)；
// fireT=放出闪电的时刻；dur=整个技能时长
const BLADE_L = { pose: 10, hx: 425, hy: 222, fireT: .3, dur: .8 };
// 剑图几何：len=游戏中整把剑长度；gripR=握柄点离剑柄端占全长比例；gx/gy=握柄点在(裁边后)剑图中的位置比例；
// axisR=剑轴长/剑图宽；phi=剑图中“握柄→剑尖”的方向角（弧度，剑尖朝左下）
const BLADE_SWORD = { vf: -1, len: 125, gripR: .38, gx: .6152, gy: .4261, axisR: 1.1532, phi: 2.6208 };
// 闪电束：L=射程；t=持续秒数；ticks=结算时刻；mul=各次伤害倍率（乘攻击力）；w=束半宽（判定）
// phi=闪电贴图主干方向角(弧度,≈22°)；sy=垂直于束方向的压缩系数（<1 更细长）
const BLADE_BOLT = { L: 760, t: .46, ticks: [0, .15, .3], mul: [1.3, .8, .8], w: 140, phi: .3869, sy: .8 };

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
const HP_K = 0.7, DM_K = 0.03;   // 怪物生命 / 伤害系数（原 0.6 / 0.025）
// 升级所需经验（原来是 等级×40，升得太快）
const xpNeed = lv => Math.round(60 + lv * 45 + lv * lv * 1.1);
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
  ['攻击强化', '伤害 +5%'],
  ['生命强化', '最大生命 +6%'],
  ['魔力强化', '最大魔力 +6%'],
  ['会心一击', '暴击率 +2%（暴击×2）']
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
  },
  {
    id: 'blade',
    name: '假面骑士 Blade',
    short: 'Blade',
    slotName: 'Blade 黑桃胶囊',
    rider: 'BLADE',
    tier: 4, // 传说
    c: '#3aa0ff',
    tag: '黑桃之刃',
    desc: '佩戴 Blay Buckle 的黑桃王牌，手持 Blay Rouzer，召唤雷电斩破一切。',
    buff: '攻击力 +26%，暴击率 +12%，移速 +8%',
    skill: 'L · 召雷（持剑召唤贯穿闪电，自动瞄准）',
    finisher: 'LIGHTNING SONIC · 雷电音速踢 (跃起→锥体定身→砸落→黑桃爆发)',
    trait: '雷电缠身 · 持剑召雷 · 黑桃必杀',
    atkMul: 1.26, crAdd: .12, spdMul: 1.08
  }
];

// 胶囊终端交互状态
let curSelCapId = 'ryuki', capPage = 0, capFilter = 'all';

// 全局状态与池
// 全局状态与池
let uid = 0;
let G = 'load', msg = '加载中…', T = 0, cam = 0, shake = 0;
let E = [], PJ = [], EP = [], FX = [], DT = [], OR = [], GH = [], HZ = [], TQ = [];
let kills = 0, bs = 0, sp = 1, cur = 0, RG = 0, FG = 0, FD = 0;   // FD：本次通关获得的钻石（首通奖励）
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
// 钻石：高级货币（初始 1000；首通关卡 +FIRST_CLEAR_DIAMOND；用于扭蛋）
const FIRST_CLEAR_DIAMOND = 100;
const S = {
  g: 200, d: 1000, hp: 2, mp: 1, sw: 0, ar: 0, bt: 0, lv: 1, xp: 0, tp: 0, ta: [0, 0, 0, 0], cl: 0,
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
  if (typeof S.d !== 'number') S.d = 1000;
} catch (e) {}

const save = () => { try { localStorage.malaya = JSON.stringify(S) } catch (e) {} };
const cl = (v, a, b) => Math.max(a, Math.min(b, v));

// 图像切片与去色去噪图形工具
const load = s => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(s); i.src = encodeURI(s) });

// 透明 PNG：直接裁切，不再需要任何抠底处理
function toCanvas(im) {
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  c.getContext('2d').drawImage(im, 0, 0); return c;
}
function crop(im, x, y, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(im, x, y, w, h, 0, 0, w, h); return c;
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
    let k = crop(im, c * cw, r * ch, cw, ch);
    if (cut && r === rNum - 1) k.getContext('2d').clearRect(0, ch - cut, cw, cut);
    if (doClean) k = cleanFrame(k);
    fr.push(k);
  }
  const b = bb(fr[refIdx] || fr[0]);
  return { f: fr, cw, ch, fy: b.y1, s: PH / (b.y1 - b.y0) };
}
function ph(c) { const o = document.createElement('canvas'); o.width = 80; o.height = 120; const g = o.getContext('2d'); g.fillStyle = c; g.fillRect(10, 10, 60, 110); return o }

// 敌人切片（精准版）：
// 1) 只用“实心像素”(alpha>128) 做 8 邻域连通分析，不再做会把相邻怪物粘在一起的膨胀；
// 2) 面积够大的连通块 = 独立的怪（主体）；零碎部件（翅膀尖 / 喷出的火球 / 熔岩碎块…）按像素距离归到最近的主体；离群小噪点丢弃；
// 3) 半透明的边缘 / 光晕像素：只保留主体 10px 内的，并借用最近实心像素的颜色（去掉抠图残留的绿边），背景里零散的低 alpha 噪点全部清除；
// 4) 每只怪只拷贝属于自己的像素，所以包围盒重叠（一只怪的火球飘进另一只怪的框里）也不会串。
function cut(im) {
  const w = im.width, h = im.height, N = w * h, c = toCanvas(im), g0 = c.getContext('2d');
  const img = g0.getImageData(0, 0, w, h), p = img.data, SOL = 128;

  // ---- 1. 实心像素连通块 ----
  const lab = new Int32Array(N), comps = [];
  for (let s = 0; s < N; s++) {
    if (lab[s] || p[s * 4 + 3] <= SOL) continue;
    const id = comps.length + 1, q = [s]; lab[s] = id;
    for (let head = 0; head < q.length; head++) {
      const cur = q[head], cx = cur % w, cy = (cur / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const X = cx + dx, Y = cy + dy; if (X < 0 || X >= w || Y < 0 || Y >= h) continue;
        const k = Y * w + X; if (!lab[k] && p[k * 4 + 3] > SOL) { lab[k] = id; q.push(k) }
      }
    }
    comps.push({ id, px: q, n: q.length });
  }
  if (!comps.length) return [];
  const maxN = Math.max(...comps.map(o => o.n)), minMain = Math.max(400, maxN * .02);
  const mains = comps.filter(o => o.n >= minMain);

  // ---- 2. 从主体像素向外做距离扩散（4 邻域 BFS），给每个像素标上“最近的主体” ----
  const own = new Int32Array(N), dist = new Int16Array(N).fill(-1), mainId = new Int32Array(comps.length + 1);
  mains.forEach((o, i) => mainId[o.id] = i + 1);
  function spread(seedList, seedOwn, R) {
    own.fill(0); dist.fill(-1);
    const q = [];
    for (const k of seedList) { own[k] = seedOwn(k); dist[k] = 0; q.push(k) }
    for (let head = 0; head < q.length; head++) {
      const cur = q[head], d = dist[cur]; if (d >= R) continue;
      const cx = cur % w, cy = (cur / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = cx + dx, Y = cy + dy; if (X < 0 || X >= w || Y < 0 || Y >= h) continue;
        const k = Y * w + X; if (dist[k] < 0) { dist[k] = d + 1; own[k] = own[cur]; q.push(k) }
      }
    }
  }
  const seedsA = []; for (const o of mains) for (const k of o.px) seedsA.push(k);
  spread(seedsA, k => mainId[lab[k]], 80);
  // 零碎块归属 = 离它最近的主体（取块内离主体最近的像素）；太远的小噪点丢掉
  const grpOf = new Int32Array(comps.length + 1);
  for (const o of comps) {
    if (mainId[o.id]) { grpOf[o.id] = mainId[o.id]; continue }
    let bd = 1e9, bg = 0; for (const k of o.px) if (dist[k] >= 0 && dist[k] < bd) { bd = dist[k]; bg = own[k] }
    grpOf[o.id] = (bg && (bd <= 40 || o.n >= 40)) ? bg : 0;
  }

  // ---- 3. 实心像素定主；再向外扩 10px 收半透明光晕（借色去绿边） ----
  const solid = []; for (let k = 0; k < N; k++) if (lab[k] && grpOf[lab[k]]) solid.push(k);
  const src = new Int32Array(N).fill(-1);
  spread(solid, k => grpOf[lab[k]], 10);
  // 再扩一遍记录“最近实心像素”(用于借色)：沿用同一 BFS 顺序
  {
    const q = []; src.fill(-1);
    for (const k of solid) { src[k] = k; q.push(k) }
    for (let head = 0; head < q.length; head++) {
      const cur = q[head]; if (dist[cur] >= 10) continue;
      const cx = cur % w, cy = (cur / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = cx + dx, Y = cy + dy; if (X < 0 || X >= w || Y < 0 || Y >= h) continue;
        const k = Y * w + X; if (src[k] < 0 && dist[k] >= 0 && own[k] === own[cur]) { src[k] = src[cur]; q.push(k) }
      }
    }
  }

  // ---- 4. 每只怪各自输出一张画布 ----
  const G = mains.length, box = Array.from({ length: G + 1 }, () => ({ x0: w, y0: h, x1: -1, y1: -1, n: 0 }));
  for (let k = 0; k < N; k++) {
    const gi = own[k]; if (!gi || dist[k] < 0 || p[k * 4 + 3] <= 8) continue;
    const x = k % w, y = (k / w) | 0, b = box[gi]; b.n++;
    if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
  }
  const out = [];
  for (let gi = 1; gi <= G; gi++) {
    const b = box[gi]; if (b.n < w * h * .0015) continue;
    const ow = b.x1 - b.x0 + 1, oh = b.y1 - b.y0 + 1, o = document.createElement('canvas'), g = o.getContext('2d');
    o.width = ow; o.height = oh;
    const id = g.createImageData(ow, oh), d = id.data;
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
      const k = y * w + x; if (own[k] !== gi || dist[k] < 0) continue;
      const a = p[k * 4 + 3]; if (a <= 8) continue;
      let s = (a > SOL || src[k] < 0) ? k : src[k];
      // 抠图残留的绿边：边缘(alpha<250)且偏绿的像素，改用 3px 内最近的“芯”像素(alpha>=250)的颜色
      const r0 = p[s * 4], g1 = p[s * 4 + 1], b0 = p[s * 4 + 2];
      if (a < 250 && g1 > r0 + 25 && g1 > b0 + 25) {
        let bd = 99, bs = -1;
        for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
          const X = x + i, Y = y + j; if (X < 0 || X >= w || Y < 0 || Y >= h) continue;
          const kk = Y * w + X, dd = i * i + j * j;
          if (dd < bd && p[kk * 4 + 3] >= 250 && own[kk] === gi && !(p[kk * 4 + 1] > p[kk * 4] + 25 && p[kk * 4 + 1] > p[kk * 4 + 2] + 25)) { bd = dd; bs = kk }
        }
        if (bs >= 0) s = bs;
      }
      const t = ((y - b.y0) * ow + (x - b.x0)) * 4;
      d[t] = p[s * 4]; d[t + 1] = p[s * 4 + 1]; d[t + 2] = p[s * 4 + 2]; d[t + 3] = a;
    }
    g.putImageData(id, 0, 0);
    const t = trim(o); t.ry = Math.round((b.y0 + b.y1) / 2 / (h / 6)); t.rx = b.x0; out.push(t);
  }
  return out.sort((a, b) => a.ry - b.ry || a.rx - b.rx);
}

function assign(L) {
  const r = {}, ix = L.map((_, i) => i).sort((a, b) => L[a].width * L[a].height - L[b].width * L[b].height);
  if (EMAP) { for (const k in EMAP) r[k] = EMAP[k].map(i => L[i]).filter(Boolean) }
  else if (L.length) { r.boss = [L[ix.pop()]]; const m = Math.ceil(ix.length / 2); r.imp = ix.slice(0, m).map(i => L[i]); r.wd = ix.slice(m).map(i => L[i]) } return r;
}