// ===== 虚幻裂隙 · 镜世界探索 (Mirror World Roguelite Engine v5 - Clean HUD) =====
// 特性：12间多维裂隙、房间切关、24款质变圣物、神龛永久强化、修复升级/变身数值覆盖、移除三星条件栏目并紧凑HUD

const rfx = (name, ...a) => { try { if (typeof RFX !== 'undefined' && RFX[name]) RFX[name](...a); } catch (e) {} };

const ROGUE_TOTAL_ROOMS = 12;
const ROGUE_COL_THEME = '#9b51e0';
const ROGUE_STAGE_INDEX = 999;

// ---------- 0. 平衡参数 ----------
const ROGUE_BAL = {
  baseHp: 150, baseAtk: 34, baseCr: 0.08, baseDef: 0.05,
  hitsFirst: 8,              // 第 1 间：小怪 ≈ 8 击致死
  hitsLast: 5.5,             // 第 12 间：小怪 ≈ 5.5 击致死
  hitsEliteLess: 0.5,
  hitsBossPlus: 1,
  bossHpx: 3.0,
  eliteWd: 0.4,
  champHp: 2.5,
  champScale: 1.22,
  champAfterKills: 3,
  crystalDepth: 0.08,
  winCrystal: 60,
  scalePow: 0.9,
  clearHeal: 0.15,           // 每清一间战斗房回复比例
  restHeal: 0.50,            // 避难所回复比例
  roomCrystal: { combat: 20, elite: 38, boss: 90 },
  skipCrystal: 20,           // 放弃圣物换取的镜晶
  reward: {
    goldPerRoom: 1500, diaPerRoom: 6, matPerRoom: 2,
    winGold: 15000, winDia: 100, winMat: 10, winScr: 5,
    epicFromRoom: 6
  }
};

// ---------- 1. 24 款专属圣物库 ----------
const ROGUE_RELICS = [
  { id: 'chain_lightning', n: '雷霆之印', tier: 2, ic: '⚡', tag: '攻击', d: '命中时有 45% 概率释放连锁闪电，波及周围 2 名敌人，各造成 65% 攻击力伤害。' },
  { id: 'time_fracture',   n: '时空断裂', tier: 3, ic: '⏳', tag: '特技', d: '闪避时令全场敌人与弹幕陷入 0.6 秒时空停滞（速度 -85%），冷却 2.5 秒。' },
  { id: 'contract_flow',   n: '契约回流', tier: 2, ic: '🔷', tag: '魔力', d: '暴击时回复 8% 最大魔力与 5 点闪避耐力。' },
  { id: 'mirror_thorns',   n: '镜面反甲', tier: 1, ic: '🪞', tag: '生存', d: '受到攻击时，向最近的敌人反弹 150% 攻击力的镜面光刃（冷却 0.5 秒）。' },
  { id: 'dragon_aura',     n: '龙皇烈焰', tier: 2, ic: '🔥', tag: '攻击', d: '周身环绕龙炎，每 0.5 秒对贴身范围敌人造成 30% 攻击力的灼烧。' },
  { id: 'blood_oath',      n: '嗜血契约', tier: 2, ic: '🩸', tag: '生存', d: '每击败 1 名敌人，立即回复 2% 最大生命值。' },
  { id: 'execute',         n: '斩杀处决', tier: 3, ic: '🪓', tag: '攻击', d: '命中生命低于 18% 的普通怪物时直接处决（精英房 8%，首领免疫）。' },
  { id: 'photon_speed',    n: '光子超频', tier: 1, ic: '👟', tag: '机动', d: '移动速度 +25%；疾跑或闪避期间额外获得 20% 减伤。' },
  { id: 'thunder_impact',  n: '雷光重炮', tier: 2, ic: '💥', tag: '特技', d: '施展 L 战术技能后，6 秒内下一次命中必定造成 2.5 倍伤害。' },
  { id: 'desperate_strike',n: '破釜沉舟', tier: 2, ic: '🗡️', tag: '攻击', d: '当前生命值每降低 10%，攻击力提升 6.5%（最高可提升 52%）。' },
  { id: 'shadow_echo',     n: '幻影残像', tier: 2, ic: '👥', tag: '特技', d: '闪避起步时留下全息假身，0.8 秒后爆炸造成 180% 攻击力范围伤害。' },
  { id: 'energy_aegis',    n: '能量神盾', tier: 3, ic: '🛡️', tag: '生存', d: '每 12 秒充能一层圣盾（最多 2 层，入房即带 1 层），完全抵消一次伤害。' },
  { id: 'crit_feast',      n: '暴击盛宴', tier: 2, ic: '🎯', tag: '攻击', d: '每次命中有 20% 概率触发盛宴暴击，造成 2.6 倍伤害（可与基础暴击叠乘）。' },
  { id: 'bullet_eraser',   n: '弹幕粉碎', tier: 1, ic: '⚔️', tag: '生存', d: '斩击消弹范围扩大，且每消除 1 枚敌方弹幕恢复 5 点魔力。' },
  { id: 'ultimate_haste',  n: '终结蓄势', tier: 2, ic: '⏱️', tag: '特技', d: '每击败 1 名敌人，终结必杀技（K 键）剩余冷却缩短 1.2 秒。' },
  { id: 'frost_touch',     n: '急冻霜痕', tier: 2, ic: '❄️', tag: '控制', d: '所有伤害附带寒霜：目标移动速度 -40%，持续 2.5 秒。' },
  { id: 'bike_reactor',    n: '战车聚变', tier: 2, ic: '🏍️', tag: '特技', d: '战斗机车沿途追加伤害，消失时在终点引发大范围聚变爆破。' },
  { id: 'vortex_slash',    n: '升龙引力', tier: 2, ic: '🌪️', tag: '控制', d: '【W+J】升龙击命中后卷起 1.2 秒引力旋风，将小怪向中心聚拢。' },
  { id: 'earth_tremor',    n: '坠地震山', tier: 2, ic: '🌋', tag: '特技', d: '【S+J】空中下砸落地时引发震荡波，造成 150% 攻击力伤害并眩晕小怪 1.5 秒。' },
  { id: 'midas_mirror',    n: '镜界贪婪', tier: 1, ic: '🪙', tag: '资源', d: '每击败 1 名敌人额外获得 1 枚镜晶，结算时镜晶额外 +30%。' },
  { id: 'twin_bullet',     n: '镜像双生', tier: 3, ic: '✨', tag: '攻击', d: '发射飞剑、光弹或能量波时，额外生成 1 枚等伤的镜像弹体。' },
  { id: 'immortal_will',   n: '不朽体魄', tier: 3, ic: '❤', tag: '生存', d: '最大生命上限 +50%，但通关与整备的生命回复效果 -30%。' },
  { id: 'energy_surge',    n: '狂涌过载', tier: 3, ic: '🌀', tag: '特技', d: '连续命中 6 次进入 3 秒「狂涌」：伤害 +40%、技能不耗蓝、冷却恢复 +40%。' },
  { id: 'crimson_finale',  n: '真红终焉', tier: 4, ic: '☄️️', tag: '传说', d: '终结技伤害提升 80%，施展期间苍穹持续降下流星雨轰炸全场。' }
];
const ROGUE_TIER_W = { 1: 10, 2: 8, 3: 4, 4: 1.5 };
const ROGUE_TIER_MIN_ROOM = { 1: 1, 2: 1, 3: 3, 4: 8 };

// ---------- 2. 局外永久神龛天赋 ----------
const ROGUE_TALENTS = [
  { id: 'g_atk',   n: '全域锋刃', max: 5, cost: [150, 350, 750, 1400, 2500], desc: '【全局加成】主游戏全部关卡与形态基础攻击力 +3% / 级。', global: true },
  { id: 'g_hp',    n: '全域装甲', max: 5, cost: [120, 300, 650, 1200, 2200], desc: '【全局加成】主游戏全部关卡与形态基础生命上限 +4% / 级。', global: true },
  { id: 'g_crit',  n: '会心共鸣', max: 4, cost: [200, 500, 1100, 2200],       desc: '【全局加成】主游戏全形态暴击伤害额外增加 +15% / 级。', global: true },
  { id: 'reroll',  n: '敏锐感知', max: 3, cost: [200, 600, 1200],             desc: '【肉鸽专属】每场探索赋予 1 次「圣物三选一」刷新机会 / 级。' },
  { id: 'gain',    n: '镜晶共鸣', max: 5, cost: [100, 250, 550, 1000, 1800], desc: '【肉鸽专属】通关或战败结算时代币「镜晶」获取量 +12% / 级。' },
  { id: 'revive',  n: '逆命假面', max: 1, cost: [2500],                      desc: '【肉鸽专属】裂隙中承受致命伤害时免疫阵亡并立即复活 1 次。' }
];

// ---------- 3. 运行期数据状态机 ----------
const ROGUE = {
  inRun: false,
  room: 1,
  cleared: 0,
  roomType: 'combat',
  state: 'idle',
  relics: [],
  relicChoices: [],
  rerollsLeft: 0,
  reviveUsed: false,
  crystalsGained: 0,
  shardsGained: 0,
  shieldStacks: 0,
  shieldTimer: 0,
  auraTimer: 0,
  surgeHits: 0,
  surgeTimer: 0,
  mods: { atkMul: 1, hpMul: 1, crAdd: 0 },
  hm1: 1, dm1: 1,
  clock: 0,
  busy: 0,
  hitCrit: false,
  held: {},
  fx: {},
  savedP: null,
  hitRects: [],
  champ: false,
  rewardView: null,
  cur: 0,
  lockUntil: 0
};
const rogueOpenPopup = () => { ROGUE.cur = 0; ROGUE.lockUntil = performance.now() + 350; };

function rogueFreshFx() {
  return {
    thunderT: 0, thunderDelay: 0,
    upperT: 0, vortex: null, vortexFx: 0,
    slamT: 0, slamAir: false,
    timeFrac: 0, tfIcd: 0, dodgeIcd: 0, echoIcd: 0, lastDodge: -9,
    decoys: [], thornsIcd: 0, chainIcd: 0, meteorT: 0,
    lastKills: 0, bikeSnap: [], bikeT: 0,
    pjSeen: new WeakSet(),
    prevSt: '', prevSta: null
  };
}
ROGUE.fx = rogueFreshFx();

function rogueData() {
  if (typeof S.mc !== 'number') S.mc = 0;
  if (!S.mt || typeof S.mt !== 'object') S.mt = { g_atk: 0, g_hp: 0, g_crit: 0, reroll: 0, gain: 0, revive: 0 };
  if (typeof S.mr !== 'number') S.mr = 0;
  return { mc: S.mc, mt: S.mt, mr: S.mr };
}
const rogueMirrorCrystals = () => (rogueData(), S.mc);
const rogueBestRoom = () => (rogueData(), S.mr);
const rogueTalents = () => (rogueData(), S.mt);
const rogueHasRelic = (id) => ROGUE.relics.includes(id);

function rogueGetRoomType(roomIdx) {
  if (roomIdx === ROGUE_TOTAL_ROOMS) return 'boss';
  if (roomIdx === 4 || roomIdx === 9) return 'rest';
  if (roomIdx === 7) return 'shrine';
  if (roomIdx === 3 || roomIdx === 6 || roomIdx === 11) return 'elite';
  return 'combat';
}

function rogueHitScale(z, roomIdx, isBoss, isElite) {
  const B = ROGUE_BAL;
  let n = B.hitsFirst + (B.hitsLast - B.hitsFirst) * (roomIdx - 1) / Math.max(1, ROGUE_TOTAL_ROOMS - 1);
  if (isBoss) n += B.hitsBossPlus; else if (isElite) n -= B.hitsEliteLess;
  const gh = Math.pow(Math.max(1, z.dm || 1) / Math.max(1, ROGUE.dm1 || 1), B.scalePow);
  const baseMh = B.baseHp * (isFinite(gh) ? gh : 1);
  const hit1 = hpExp(z.r) / 8 * (1 - B.baseDef);
  const v = baseMh / (Math.max(1, n) * hit1);
  return isFinite(v) ? Math.max(0.05, Math.min(1, +v.toFixed(3))) : 1;
}

function rogueTweakSpawn(n0) {
  if (!ROGUE.inRun || ROGUE.roomType !== 'elite' || ROGUE.champ || ROGUE.state !== 'combat') return;
  const B = ROGUE_BAL, z = ST[ROGUE_STAGE_INDEX];
  if ((kills | 0) < B.champAfterKills) return;
  const late = (kills | 0) >= (z.k || 10) - 3;
  for (let i = n0; i < E.length; i++) {
    const e = E[i];
    if (!e || e.t === 'boss' || e._champ || !(late || e.t === 'wd')) continue;
    e._champ = true; ROGUE.champ = true;
    e.hp = e.mhp = Math.max(1, Math.round(e.hp * B.champHp));
    const k = B.champScale;
    if (typeof e.s === 'number') e.s *= k;
    if (typeof e.h === 'number') e.h *= k;
    if (typeof e.w === 'number') e.w *= k;
    DT.push({ x: e.x, y: e.y - (e.h || 100) - 30, s: '裂隙畸变巨兽 现身！', t: 1.8, c: '#ff4757' });
    rfx('champ', e);
    break;
  }
}

// 核心属性重算（局内升级、变身、切房间均走这里，绝不读取外部装备）
function rogueRecalcStats(first) {
  const t = rogueTalents();
  const z = ST[ROGUE_STAGE_INDEX] || {};
  const B = ROGUE_BAL, M = ROGUE.mods;
  const grow = (cur, base) => {
    const g = Math.pow(Math.max(1, cur || 1) / Math.max(1, base || 1), B.scalePow);
    return isFinite(g) ? Math.min(Math.max(g, 1), 1e4) : 1;
  };
  const ga = grow(z.hm, ROGUE.hm1), gh = grow(z.dm, ROGUE.dm1);
  const gAtkMul = 1 + (t.g_atk || 0) * 0.03;
  const gHpMul = 1 + (t.g_hp || 0) * 0.04;
  const immortal = rogueHasRelic('immortal_will') ? 1.5 : 1;

  const ratio = first || !(P.mh > 0) ? 1 : Math.max(0, Math.min(1, P.hp / P.mh));
  P.mh = Math.max(1, Math.round(B.baseHp * gHpMul * gh * M.hpMul * immortal));
  P.hp = Math.max(1, Math.round(P.mh * ratio));

  let baseAtk = Math.max(1, Math.round(B.baseAtk * gAtkMul * ga * M.atkMul));
  let baseCr = B.baseCr + M.crAdd;

  if (typeof inForm === 'function' && inForm()) {
    const fc = typeof formCap === 'function' ? formCap() : null;
    if (fc) {
      const atkMul = (typeof capAtkMul === 'function' ? capAtkMul(fc) : (fc.atkMul || 1));
      const crAdd = (typeof capCrAdd === 'function' ? capCrAdd(fc) : (fc.crAdd || 0));
      baseAtk = Math.round(baseAtk * atkMul);
      baseCr = Math.min(1, baseCr + crAdd);
    }
  }

  P.atk = baseAtk;
  P.cr = baseCr;
  P.def = B.baseDef;
  P.stm = (100 + S.lv * 2) | 0;
  P.mm = 100;
}

function rogueHeal(amount, scaled) {
  if (!(amount > 0)) return;
  if (scaled && rogueHasRelic('immortal_will')) amount *= 0.7;
  P.hp = Math.min(P.mh, P.hp + amount);
}

function rogueAddRelic(id) {
  if (!id || rogueHasRelic(id)) return;
  ROGUE.relics.push(id);
  const rel = ROGUE_RELICS.find(r => r.id === id);
  if (id === 'immortal_will') rogueRecalcStats(false);
  if (id === 'energy_aegis' && ROGUE.shieldStacks < 1) ROGUE.shieldStacks = 1;
  if (rel) DT.push({ x: P.x, y: P.y - 190, s: `获得圣物：${rel.n}`, t: 1.4, c: '#ffd84a' });
  if (rel) rfx('pickup', rel.tier);
}

// ---------- 4. 探索启程与房间流转 ----------
function rogueStartRun() {
  const d = rogueData();
  const t = d.mt;

  ROGUE.savedP = {
    mh: P.mh, mm: P.mm, atk: P.atk, cr: P.cr, def: P.def,
    hp: P.hp, mp: P.mp, sta: P.sta, stm: P.stm
  };

  ROGUE.inRun = true;
  ROGUE.room = 1;
  ROGUE.cleared = 0;
  ROGUE.relics = [];
  ROGUE.relicChoices = [];
  ROGUE.rerollsLeft = t.reroll || 0;
  ROGUE.reviveUsed = false;
  ROGUE.crystalsGained = 0;
  ROGUE.shardsGained = 0;
  ROGUE.shieldStacks = 0;
  ROGUE.shieldTimer = 0;
  ROGUE.auraTimer = 0;
  ROGUE.surgeHits = 0;
  ROGUE.surgeTimer = 0;
  ROGUE.mods = { atkMul: 1, hpMul: 1, crAdd: 0 };
  ROGUE.clock = 0;
  ROGUE.busy = 0;
  ROGUE.held = {};
  ROGUE.fx = rogueFreshFx(); rfx('reset');

  P.mm = 100; P.mp = 100;
  P.def = ROGUE_BAL.baseDef;
  P.sta = 100; P.stm = 100;

  PO.ret = 'rogue';
  M = 0;
  rogueSetupRoom(1, true);
}

function rogueSetupRoom(roomIdx, first) {
  ROGUE.room = roomIdx;
  ROGUE.roomType = rogueGetRoomType(roomIdx);
  ROGUE.hitRects = [];

  const isBoss = ROGUE.roomType === 'boss';
  const isElite = ROGUE.roomType === 'elite';
  const isRest = ROGUE.roomType === 'rest';
  const isShrine = ROGUE.roomType === 'shrine';

  let z = ST[ROGUE_STAGE_INDEX];
  if (!z) {
    z = ST[ROGUE_STAGE_INDEX] = { n: '', k: 0, b: 0, bn: '', wd: 0.2, g: 0, r: 10, set: 1, rogue: 1 };
  }

  const roomNames = {
    combat: `第 ${roomIdx} 裂隙 · 异空间回廊`,
    elite: `第 ${roomIdx} 裂隙 · 狂暴异变核心 [精英]`,
    rest: `第 ${roomIdx} 裂隙 · 镜界避难所 [整备]`,
    shrine: `第 ${roomIdx} 裂隙 · 远古契约神龛 [偶遇]`,
    boss: `第 ${roomIdx} 裂隙 · 镜世界霸主领地 [决战]`
  };

  const themeSets = [1, 2, 3, 4, 7, 10];
  const setIndex = themeSets[Math.min(themeSets.length - 1, Math.floor((roomIdx - 1) / 2))];

  z.n = roomNames[ROGUE.roomType];
  z.b = isBoss ? 1 : 0;
  z.bn = isBoss ? '异类·暗黑龙皇' : (isElite ? '裂隙畸变巨兽' : '');
  z.k = isBoss ? 15 : (isElite ? 10 : 8);
  z.wd = isElite ? ROGUE_BAL.eliteWd : 0.25;
  z.g = 200 + roomIdx * 50;
  z.r = 6 + roomIdx * 3;
  z.set = setIndex;
  z.hpx = isBoss ? ROGUE_BAL.bossHpx : 1.0;
  z.hm = Math.max(1, +(atkExp(z.r) * HP_K / 30).toFixed(1));
  z.dm = Math.max(1, +(hpExp(z.r) * DM_K / 8).toFixed(1));

  if (first || roomIdx === 1) { ROGUE.hm1 = z.hm; ROGUE.dm1 = z.dm; }
  rogueRecalcStats(!!first);
  z.dmx = rogueHitScale(z, roomIdx, isBoss, isElite);
  ROGUE.champ = false;

  GH = []; E = []; PJ = []; EP = []; FX = []; DT = []; OR = []; HZ = []; TQ = []; BIKES = [];
  kills = 0; bs = 0; sp = 1; cur = ROGUE_STAGE_INDEX; G = 'play';

  ROGUE.fx = rogueFreshFx(); rfx('reset');
  ROGUE.surgeHits = 0; ROGUE.surgeTimer = 0;
  ROGUE.shieldTimer = 0;
  if (rogueHasRelic('energy_aegis') && ROGUE.shieldStacks < 1) ROGUE.shieldStacks = 1;

  P.x = 220; P.y = GY; P.vx = 0; P.vy = 0; P.f = 1;
  P.st = 'idle'; P.inv = 1.2; P.t = 0; P.land = 0; P.h = 0; P.hit = {};
  P.mp = P.mm; P.sta = P.stm;
  for (const k in P.cd) P.cd[k] = 0;

  if (isRest) {
    ROGUE.state = 'rest_pick'; rogueOpenPopup();
  } else if (isShrine) {
    ROGUE.state = 'shrine_pick'; rogueOpenPopup();
  } else {
    ROGUE.state = 'combat';
    DT.push({ x: P.x, y: P.y - 200, s: `ROOM ${roomIdx}/${ROGUE_TOTAL_ROOMS}`, t: 1.8, c: ROGUE_COL_THEME });
    spawn('imp'); spawn('imp');
  }
}

function rogueGoNext() {
  ROGUE.cleared = Math.max(ROGUE.cleared, ROGUE.room);
  if (ROGUE.cleared > S.mr) S.mr = ROGUE.cleared;
  rogueSetupRoom(ROGUE.room + 1);
}

function rogueRollRelics() {
  const room = ROGUE.room;
  const owned = new Set(ROGUE.relics);
  let pool = ROGUE_RELICS.filter(r => !owned.has(r.id) && room >= (ROGUE_TIER_MIN_ROOM[r.tier] || 1));
  if (pool.length < 3) pool = ROGUE_RELICS.filter(r => !owned.has(r.id));
  if (pool.length < 3) pool = ROGUE_RELICS.slice();

  const eliteBoost = ROGUE.roomType === 'elite';
  const temp = pool.map(r => ({ r, w: (ROGUE_TIER_W[r.tier] || 5) * (eliteBoost && r.tier >= 3 ? 2.5 : 1) }));
  const picked = [];
  for (let i = 0; i < 3 && temp.length; i++) {
    const total = temp.reduce((a, o) => a + o.w, 0);
    let roll = Math.random() * total, idx = 0;
    for (; idx < temp.length - 1; idx++) { roll -= temp[idx].w; if (roll <= 0) break; }
    const [chosen] = temp.splice(idx, 1);
    picked.push(chosen.r);
    temp.forEach(o => { if (o.r.tag === chosen.r.tag) o.w *= 0.25; });
  }
  ROGUE.relicChoices = picked;
}

// ---------- 5. 房间通过与结算 ----------
function rogueOnRoomClear() {
  if (!ROGUE.inRun) return;

  if (ST[ROGUE_STAGE_INDEX]) ST[ROGUE_STAGE_INDEX].k = 999999;
  EP = []; HZ = []; PJ = []; BIKES = []; E = [];
  P.inv = 9999; P.vx = 0; P.vy = 0; P.st = 'idle';

  const isFinalRoom = ROGUE.room >= ROGUE_TOTAL_ROOMS;
  const base = (ROGUE_BAL.roomCrystal[ROGUE.roomType] || ROGUE_BAL.roomCrystal.combat) * (1 + ROGUE_BAL.crystalDepth * (ROGUE.room - 1));
  const talentBonus = 1 + (rogueTalents().gain || 0) * 0.12;
  const greedBonus = rogueHasRelic('midas_mirror') ? 1.3 : 1.0;
  ROGUE.crystalsGained += Math.round(base * talentBonus * greedBonus);
  if (ROGUE.room >= ROGUE_TOTAL_ROOMS) ROGUE.crystalsGained += Math.round(ROGUE_BAL.winCrystal * talentBonus * greedBonus);

  if (ROGUE.room === 4) ROGUE.shardsGained += 2;
  if (ROGUE.room === 8) ROGUE.shardsGained += 4;
  if (ROGUE.room === 12) ROGUE.shardsGained += 8;

  ROGUE.cleared = Math.max(ROGUE.cleared, ROGUE.room);
  if (ROGUE.cleared > S.mr) S.mr = ROGUE.cleared;

  rogueHeal(P.mh * ROGUE_BAL.clearHeal, true);

  if (isFinalRoom) {
    ROGUE.state = 'settle_win'; rogueOpenPopup();
    rogueApplyMetaRewards(true);
  } else {
    ROGUE.state = 'relic_pick'; rogueOpenPopup();
    rogueRollRelics();
  }
}

function rogueOnPlayerDeath() {
  if (!ROGUE.inRun) return;

  const t = rogueTalents();
  if (t.revive && !ROGUE.reviveUsed) {
    ROGUE.reviveUsed = true;
    P.down = false;
    P.hp = Math.round(P.mh * 0.4);
    P.inv = 3.0;
    shake = 22;
    DT.push({ x: P.x, y: P.y - 210, s: '★ 逆命假面 · 绝境苏生！', t: 2.2, c: '#ffd84a' });
    FX.push({ type: 'boom', x: P.x, y: GY - 60, t: 0.8, d: 0.8, r: 280, c: '#ffd84a' });
    return;
  }

  if (ST[ROGUE_STAGE_INDEX]) ST[ROGUE_STAGE_INDEX].k = 999999;
  EP = []; HZ = []; PJ = []; BIKES = []; E = [];
  ROGUE.state = 'settle_lose'; rogueOpenPopup();
  ROGUE.crystalsGained = Math.round(ROGUE.crystalsGained * 0.7);
  rogueApplyMetaRewards(false);
}

function rogueApplyMetaRewards(win) {
  const R = ROGUE_BAL.reward;
  const n = win ? ROGUE_TOTAL_ROOMS : ROGUE.cleared;

  S.mc = (S.mc || 0) + ROGUE.crystalsGained;
  if (ROGUE.shardsGained > 0) S.csh = (S.csh | 0) + ROGUE.shardsGained;

  const gold = R.goldPerRoom * n + (win ? R.winGold : 0);
  const dia = R.diaPerRoom * n + (win ? R.winDia : 0);
  const mat = R.matPerRoom * n + (win ? R.winMat : 0);
  const scr = win ? R.winScr : 0;
  ROGUE.rewardView = { gold, dia, mat, scr };

  if (gold > 0) { S.g += gold; if (typeof psGold === 'function') psGold(gold); }
  if (dia > 0) { S.d += dia; if (typeof psDia === 'function') psDia(dia); }
  S.mat += mat;
  if (scr > 0) S.scr = (S.scr || 0) + scr;

  if (typeof genItem === 'function') {
    if (win) {
      const mythicGear = genItem(null, 5, Math.min(500, S.lv + 2));
      S.inv.push(mythicGear);
      DT.push({ x: P.x, y: P.y - 250, s: `★ 获得神话装备：[${mythicGear.name}]`, t: 3.0, c: '#ff3838' });
    } else if (ROGUE.cleared >= R.epicFromRoom) {
      S.inv.push(genItem(null, 4, S.lv));
    }
  }

  save();
}

function rogueEndRun(noNav) {
  if (!ROGUE.inRun) return;
  ROGUE.inRun = false;
  ROGUE.state = 'idle';
  ROGUE.held = {};
  if (ROGUE.savedP) {
    P.mh = ROGUE.savedP.mh;
    P.hp = ROGUE.savedP.hp;
    P.mm = ROGUE.savedP.mm;
    P.mp = ROGUE.savedP.mp;
    P.atk = ROGUE.savedP.atk;
    P.cr = ROGUE.savedP.cr;
    P.def = ROGUE.savedP.def;
    P.sta = ROGUE.savedP.sta;
    P.stm = ROGUE.savedP.stm;
    ROGUE.savedP = null;
  }
  calc();
  if (!noNav) toVil('st');
}

// ---------- 6. 局内圣物效果机制 ----------
function rogueDeal(e, d) {
  if (!e || e.dead) return;
  ROGUE.busy++;
  try { hurt(e, d); } finally { ROGUE.busy--; }
}
function rogueArea(x0, x1, d) {
  ROGUE.busy++;
  try { area(x0, x1, d); } finally { ROGUE.busy--; }
}
const rogueBoom = (x, y, r, c, t) => FX.push({ type: 'boom', x, y, t: t || 0.3, d: t || 0.3, r, c });
const rogueTxt = (s, c, t) => DT.push({ x: P.x, y: P.y - 180, s, t: t || 1.0, c });

function rogueCloneObj(o) {
  const c = Object.assign({}, o);
  for (const k in c) {
    const v = c[k];
    if (Array.isArray(v)) c[k] = v.slice();
    else if (v instanceof Set) c[k] = new Set(v);
    else if (v instanceof Map) c[k] = new Map(v);
    else if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) c[k] = Object.assign({}, v);
  }
  return c;
}

function rogueModifyDamage(e, d) {
  if (!ROGUE.inRun) return d;
  const F = ROGUE.fx;
  let mult = 1.0;

  if (rogueHasRelic('desperate_strike')) {
    mult += Math.min(0.52, Math.max(0, 1 - P.hp / P.mh) * 0.65);
  }
  if (ROGUE.surgeTimer > 0) mult += 0.40;
  if (rogueHasRelic('crimson_finale') && P.st === 'fv') mult += 0.80;

  if (F.thunderT > 0 && F.thunderDelay <= 0) {
    mult *= 2.5;
    F.thunderT = 0;
    DT.push({ x: e ? e.x : P.x, y: (e ? e.y - (e.h || 60) : P.y) - 40, s: '雷光重炮 ×2.5', t: 1.0, c: '#ffb142' });
    if (e) rogueBoom(e.x, e.y - (e.h || 60) / 2, 110, '#ffb142');
    rfx('thunderHit', e);
  }

  let crit = false;
  if (rogueHasRelic('crit_feast') && Math.random() < 0.20) { mult *= 2.6; crit = true; rfx('crit', e); }
  ROGUE.hitCrit = crit || Math.random() < (P.cr || 0);

  return d * mult;
}

function rogueOnHit(e, d) {
  if (!ROGUE.inRun || !e) return;
  const F = ROGUE.fx;

  if (rogueHasRelic('energy_surge') && ROGUE.surgeTimer <= 0) {
    ROGUE.surgeHits++;
    if (ROGUE.surgeHits >= 6) {
      ROGUE.surgeHits = 0;
      ROGUE.surgeTimer = 3.0;
      rogueTxt('ENERGY SURGE! 狂涌过载', '#00e5ff');
      rfx('surge');
    }
  }

  if (rogueHasRelic('execute') && !e.dead && e.t !== 'boss' && e.mhp > 0) {
    const thr = ROGUE.roomType === 'elite' ? 0.08 : 0.18;
    if (e.hp > 0 && e.hp / e.mhp <= thr) {
      rogueDeal(e, 999999);
      DT.push({ x: e.x, y: e.y - (e.h || 60), s: 'EXECUTE! 斩杀', t: 1.2, c: '#ff4757' });
      rogueBoom(e.x, e.y - (e.h || 60) / 2, 120, '#ff4757');
      rfx('execute', e);
      return;
    }
  }

  if (rogueHasRelic('chain_lightning') && F.chainIcd <= 0 && Math.random() < 0.45) {
    F.chainIcd = 0.12;
    const targets = E.filter(o => o !== e && !o.dead && Math.abs(o.x - e.x) < 320).slice(0, 2);
    rfx('chain', e, targets);
    for (const tg of targets) {
      rogueDeal(tg, P.atk * 0.65);
      rogueBoom(tg.x, tg.y - (tg.h || 60) / 2, 60, '#7df9ff', 0.25);
    }
  }

  if (rogueHasRelic('frost_touch')) e._slowT = Math.max(e._slowT || 0, 2.5);

  if (rogueHasRelic('contract_flow') && ROGUE.hitCrit) {
    P.mp = Math.min(P.mm, P.mp + P.mm * 0.08);
    P.sta = Math.min(P.stm, P.sta + 5);
    rfx('flow');
  }

  if (F.upperT > 0 && rogueHasRelic('vortex_slash')) {
    F.upperT = 0;
    F.vortex = { x: e.x, t: 1.2 };
    rogueTxt('升龙引力 · 旋风', '#9bd6ff');
    rfx('vortexStart', e.x);
  }
}

function rogueOnHurtP(dmg) {
  const out = { block: false, mul: 1 };
  if (!ROGUE.inRun) return out;
  const F = ROGUE.fx;

  if (rogueHasRelic('energy_aegis') && ROGUE.shieldStacks > 0) {
    ROGUE.shieldStacks--;
    rogueTxt('AEGIS BLOCK! 护盾吸收', '#7df9ff', 1.2);
    rogueBoom(P.x, P.y - 90, 100, '#00e5ff');
    rfx('shieldBreak');
    out.block = true;
    return out;
  }

  if (rogueHasRelic('mirror_thorns') && F.thornsIcd <= 0) {
    const target = E.filter(o => !o.dead && Math.abs(o.x - P.x) < 450)
                    .sort((a, b) => Math.abs(a.x - P.x) - Math.abs(b.x - P.x))[0];
    if (target) {
      F.thornsIcd = 0.5;
      rogueDeal(target, P.atk * 1.5);
      rogueBoom(target.x, target.y - (target.h || 60) / 2, 80, '#e056fd', 0.2);
      rfx('thorn', target);
    }
  }

  if (rogueHasRelic('photon_speed')) {
    const dodging = ROGUE.clock - F.lastDodge < 0.35;
    if (dodging || Math.abs(P.vx || 0) > 180) out.mul *= 0.8;
  }
  return out;
}

function rogueOnKey(code) {
  if (!ROGUE.inRun || ROGUE.state !== 'combat' || G !== 'play') return;
  const F = ROGUE.fx, H = ROGUE.held;
  const up = H.KeyW || H.ArrowUp, down = H.KeyS || H.ArrowDown;

  if (code === 'KeyJ') {
    if (up && rogueHasRelic('vortex_slash')) F.upperT = 0.7;
    if (down && rogueHasRelic('earth_tremor') && P.y < GY - 6) { F.slamT = 1.6; F.slamAir = true; }
  }
  if (code === 'KeyL' && rogueHasRelic('thunder_impact')) {
    const cd = P.cd ? (P.cd.l != null ? P.cd.l : P.cd.L) : 0;
    if (!(cd > 0.05)) { F.thunderT = 6; F.thunderDelay = 0.6; }
  }
}

function rogueUpdate(dt) {
  if (!ROGUE.inRun || ROGUE.state !== 'combat' || !(dt > 0)) return;
  const F = ROGUE.fx;
  ROGUE.clock += dt;
  F.chainIcd -= dt; F.thornsIcd -= dt; F.tfIcd -= dt; F.echoIcd -= dt; F.dodgeIcd -= dt;
  if (F.thunderDelay > 0) F.thunderDelay -= dt;
  if (F.thunderT > 0) F.thunderT -= dt;
  if (F.upperT > 0) F.upperT -= dt;

  rogueTickKills();
  rogueTickDodge();
  rogueTickAuras(dt);
  rogueTickSkills(dt);
  rogueTickBikes(dt);
  rogueTickProjectiles();
  rogueTickTime(dt);
  rfx('update', dt);
}

function rogueTickKills() {
  const F = ROGUE.fx;
  const k = kills | 0, dk = k - F.lastKills;
  F.lastKills = k;
  if (dk <= 0) return;
  rfx('kills', dk);

  if (rogueHasRelic('blood_oath')) {
    rogueHeal(P.mh * 0.02 * dk, false);
    DT.push({ x: P.x, y: P.y - 150, s: `+${Math.round(P.mh * 0.02 * dk)}`, t: 0.7, c: '#ff6b81' });
  }
  if (rogueHasRelic('ultimate_haste') && P.cd) {
    for (const key of ['fv', 'k', 'K', 'ult', 'ultimate', 'final']) {
      if (typeof P.cd[key] === 'number' && P.cd[key] > 0) P.cd[key] = Math.max(0, P.cd[key] - 1.2 * dk);
    }
  }
  if (rogueHasRelic('midas_mirror')) ROGUE.crystalsGained += dk;
}

function rogueTickDodge() {
  const F = ROGUE.fx;
  const st = String(P.st || '');
  const dodgeState = /dodge|dash|roll|evade|blink|slide/i.test(st);
  const staDrop = F.prevSta != null ? F.prevSta - P.sta : 0;
  const started = (dodgeState && !/dodge|dash|roll|evade|blink|slide/i.test(F.prevSt)) || staDrop >= 10;
  F.prevSt = st; F.prevSta = P.sta;
  if (!started || F.dodgeIcd > 0) return;

  F.dodgeIcd = 0.25;
  F.lastDodge = ROGUE.clock;

  if (rogueHasRelic('time_fracture') && F.tfIcd <= 0) {
    F.tfIcd = 2.5; F.timeFrac = 0.6;
    rogueTxt('时空断裂', '#a29bfe');
    rogueBoom(P.x, P.y - 80, 220, '#a29bfe', 0.4);
    rfx('timeFrac');
  }
  if (rogueHasRelic('shadow_echo') && F.echoIcd <= 0) {
    F.echoIcd = 1.2;
    F.decoys.push({ x: P.x, t: 0.8, f: P.f });
    rogueBoom(P.x, P.y - 70, 50, '#81ecec', 0.8);
    rfx('echoStart', P.x);
  }
}

function rogueTickAuras(dt) {
  const F = ROGUE.fx;

  if (ROGUE.surgeTimer > 0) {
    ROGUE.surgeTimer -= dt;
    P.mp = P.mm;
    if (P.cd) for (const k in P.cd) if (P.cd[k] > 0) P.cd[k] = Math.max(0, P.cd[k] - dt * 0.4);
  }

  if (rogueHasRelic('energy_aegis')) {
    ROGUE.shieldTimer += dt;
    if (ROGUE.shieldTimer >= 12) {
      ROGUE.shieldTimer = 0;
      if (ROGUE.shieldStacks < 2) {
        ROGUE.shieldStacks++;
        rogueTxt(`神盾就绪 (${ROGUE.shieldStacks}/2)`, '#7df9ff');
        rfx('shieldReady');
      }
    }
  }

  if (rogueHasRelic('dragon_aura')) {
    ROGUE.auraTimer += dt;
    if (ROGUE.auraTimer >= 0.5) {
      ROGUE.auraTimer = 0;
      rogueArea(P.x - 110, P.x + 110, P.atk * 0.3);
      rogueBoom(P.x, P.y - 40, 90, '#ff7f50', 0.18);
      rfx('flameTick');
    }
  }

  if (rogueHasRelic('crimson_finale') && P.st === 'fv') {
    F.meteorT -= dt;
    if (F.meteorT <= 0) {
      F.meteorT = 0.22;
      const alive = E.filter(o => !o.dead);
      const mx = alive.length ? alive[Math.floor(Math.random() * alive.length)].x : P.x + (Math.random() - 0.5) * 800;
      rogueBoom(mx, GY - 30, 90, '#ff6b35', 0.3);
      rfx('meteor', mx);
      rogueArea(mx - 80, mx + 80, P.atk * 1.1);
    }
  }
}

function rogueTickSkills(dt) {
  const F = ROGUE.fx;

  for (let i = F.decoys.length - 1; i >= 0; i--) {
    const dc = F.decoys[i];
    dc.t -= dt;
    if (dc.t <= 0) {
      F.decoys.splice(i, 1);
      rogueBoom(dc.x, GY - 50, 130, '#81ecec', 0.35);
      rfx('echoBoom', dc.x);
      rogueArea(dc.x - 130, dc.x + 130, P.atk * 1.8);
    }
  }

  if (F.slamT > 0) {
    F.slamT -= dt;
    const air = P.y < GY - 6;
    if (air) F.slamAir = true;
    else if (F.slamAir) {
      F.slamAir = false; F.slamT = 0;
      const rng = 238;
      rogueBoom(P.x, GY - 20, rng, '#e17055', 0.45);
      rfx('slam', P.x, rng);
      rogueArea(P.x - rng, P.x + rng, P.atk * 1.5);
      for (const e of E) {
        if (e.dead || Math.abs(e.x - P.x) > rng) continue;
        if (e.t === 'boss') e._slowT = Math.max(e._slowT || 0, 1.5);
        else e._stunT = 1.5;
      }
      if (typeof shake !== 'undefined') shake = Math.max(shake, 14);
      rogueTxt('坠地震山！', '#fab1a0');
    }
  }

  if (F.vortex) {
    const v = F.vortex;
    v.t -= dt;
    for (const e of E) {
      if (e.dead || e.t === 'boss' || e._stunT > 0 || typeof e.x !== 'number') continue;
      e.x += (v.x - e.x) * Math.min(1, dt * 5);
    }
    F.vortexFx -= dt;
    if (F.vortexFx <= 0) { F.vortexFx = 0.2; rogueBoom(v.x, GY - 60, 150, '#9bd6ff', 0.25); }
    if (v.t <= 0) F.vortex = null;
  }
}

function rogueTickBikes(dt) {
  const F = ROGUE.fx;
  if (!rogueHasRelic('bike_reactor') || !Array.isArray(BIKES)) { F.bikeSnap = []; return; }

  const cur = new Set(BIKES);
  for (const s of F.bikeSnap) {
    if (!cur.has(s.ref)) {
      rogueBoom(s.x, GY - 40, 260, '#fdcb6e', 0.5);
      rfx('fusion', s.x);
      rogueArea(s.x - 260, s.x + 260, P.atk * 2.2);
      rogueTxt('聚变爆破', '#fdcb6e');
    }
  }
  F.bikeSnap = BIKES.map(b => ({ ref: b, x: typeof b.x === 'number' ? b.x : P.x }));

  F.bikeT -= dt;
  if (F.bikeT <= 0 && BIKES.length) {
    F.bikeT = 0.25;
    for (const b of BIKES) if (typeof b.x === 'number') rogueArea(b.x - 90, b.x + 90, P.atk * 0.5);
  }
}

function rogueTickProjectiles() {
  const F = ROGUE.fx;
  if (!rogueHasRelic('twin_bullet') || !Array.isArray(PJ)) return;
  const fresh = [];
  for (const p of PJ) {
    if (!p || F.pjSeen.has(p)) continue;
    F.pjSeen.add(p);
    fresh.push(p);
  }
  if (PJ.length > 90) return;
  for (const p of fresh) {
    if (p._mirror || typeof p.y !== 'number') continue;
    const c = rogueCloneObj(p);
    c._mirror = true;
    c.y = p.y + (Math.random() < 0.5 ? -16 : 16);
    F.pjSeen.add(c);
    PJ.push(c);
  }
}

function rogueTickTime(dt) {
  const F = ROGUE.fx;
  if (F.timeFrac > 0) F.timeFrac -= dt;
  const tf = F.timeFrac > 0 ? 0.15 : 1;

  for (const e of E) {
    if (!e || e.dead || typeof e.x !== 'number') continue;
    if (e._slowT > 0) e._slowT -= dt;
    if (e._stunT > 0) e._stunT -= dt;
    if (typeof e._px === 'number') {
      let f = tf;
      if (e._slowT > 0) f *= 0.6;
      if (e._stunT > 0) f = 0;
      const dx = e.x - e._px;
      if (f < 1 && Math.abs(dx) < 160) e.x = e._px + dx * f;
    }
    e._px = e.x;
  }

  if (Array.isArray(EP)) {
    for (const b of EP) {
      if (!b || typeof b.x !== 'number' || typeof b.y !== 'number') continue;
      if (typeof b._px === 'number' && tf < 1) {
        const dx = b.x - b._px, dy = b.y - b._py;
        if (Math.abs(dx) < 200 && Math.abs(dy) < 200) { b.x = b._px + dx * tf; b.y = b._py + dy * tf; }
      }
      b._px = b.x; b._py = b.y;
    }
  }

  if (rogueHasRelic('photon_speed') && typeof P._px === 'number') {
    const dx = P.x - P._px;
    if (dx !== 0 && Math.abs(dx) < 60) P.x = Math.max(20, P.x + dx * 0.25);
  }
  P._px = P.x;
}

// ---------- 7. 传送门「虚幻裂隙」主面板渲染 ----------
function drawPoRogue() {
  const col = ROGUE_COL_THEME;
  const d = rogueData();
  const crystals = d.mc;
  const best = d.mr;

  poFrame(col, '🪞 虚幻裂隙 · 镜世界探索 (Roguelite)');

  const lx = POX + 24, ly = 84, lw = 440, lh = 372;
  rpath(lx, ly, lw, lh, 16);
  const lg = ctx.createLinearGradient(lx, ly, lx + lw, ly + lh);
  lg.addColorStop(0, 'rgba(35, 15, 60, 0.95)');
  lg.addColorStop(1, 'rgba(12, 6, 24, 0.98)');
  ctx.fillStyle = lg; ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.stroke();

  poBadge(lx + 20, ly + 16, 'SANCTUARY // 永久神龛', col);
  txt('镜晶神龛 · 全局属性强化', lx + 185, ly + 26, 16, '#ffffff');

  const talents = ROGUE_TALENTS;
  const rowH = 50, rowGap = 3, startY = ly + 46;
  const btnW = 78, btnH = 28;
  talents.forEach((t, i) => {
    const ry = startY + i * (rowH + rowGap);
    const curLv = d.mt[t.id] || 0;
    const isMax = curLv >= t.max;
    const cost = isMax ? 0 : t.cost[curLv];
    const canAfford = crystals >= cost && !isMax;

    rpath(lx + 16, ry, lw - 32, rowH, 8);
    ctx.fillStyle = t.global ? 'rgba(255, 216, 74, 0.05)' : 'rgba(255, 255, 255, 0.04)'; ctx.fill();
    ctx.strokeStyle = isMax ? 'rgba(255, 216, 74, 0.35)' : 'rgba(255, 255, 255, 0.1)'; ctx.lineWidth = 1; ctx.stroke();

    const btnX = lx + lw - 16 - 10 - btnW, btnY = ry + (rowH - btnH) / 2;
    const textX = lx + 28;
    const textMaxW = btnX - 14 - textX;

    txt(`[${i + 1}]`, textX, ry + 14, 10, '#6f7f96');
    txt(t.n, textX + 24, ry + 14, 13, t.global ? '#ffd84a' : '#ffffff');

    const lvStr = `${curLv}/${t.max}`;
    const lvW = 30, barW = 46, barH = 5;
    const lvRight = btnX - 14;
    const bx = lvRight - lvW - 6 - barW, by = ry + 12;
    rpath(bx, by, barW, barH, 2.5);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'; ctx.fill();
    if (curLv > 0) {
      rpath(bx, by, barW * (curLv / t.max), barH, 2.5);
      ctx.fillStyle = isMax ? '#ffd84a' : col; ctx.fill();
    }
    txt(lvStr, lvRight, ry + 14, 10, isMax ? '#ffd84a' : '#9fb0c6', 'right');

    const descLines = mWrap(t.desc, textMaxW, 10, 2);
    descLines.forEach((l, li) => txt(l, textX, ry + 29 + li * 12, 10, '#8fa0b8'));

    pBtn(btnX, btnY, btnW, btnH, isMax ? '已满级' : `升级 · ${cost}`, {
      c: isMax ? '#334455' : (canAfford ? '#ffd84a' : '#556677'),
      dis: isMax || !canAfford,
      sz: 10.5,
      cr: 5
    }, () => rogueUpgradeTalent(i));
  });

  const rx = POX + lw + 40, ry = 84, rw = POW - lw - 64, rh = 372;
  rpath(rx, ry, rw, rh, 16);
  const rg = ctx.createLinearGradient(rx, ry, rx + rw, ry + rh);
  rg.addColorStop(0, 'rgba(28, 12, 48, 0.95)');
  rg.addColorStop(1, 'rgba(8, 4, 18, 0.98)');
  ctx.fillStyle = rg; ctx.fill();
  ctx.strokeStyle = 'rgba(155, 81, 224, 0.5)'; ctx.lineWidth = 1.6; ctx.stroke();

  txt('EXPLORATION TELEMETRY', rx + 24, ry + 22, 10.5, col);
  txt('虚幻裂隙 · 镜世界启程', rx + 24, ry + 46, 22, '#ffd84a');

  const stats = [
    ['持有镜晶', `${crystals.toLocaleString()} 💠`, '#7df9ff'],
    ['历史最高记录', best ? `第 ${best} / ${ROGUE_TOTAL_ROOMS} 裂隙` : '未曾涉足', '#ffd84a'],
    ['探索规则', '纯净属性重置入场', '#7dff9a'],
    ['通关保底', '神话装备 + 契约碎片', '#ff7675']
  ];

  stats.forEach((st, idx) => {
    const sx = rx + 24 + (idx % 2) * 170, sy = ry + 80 + Math.floor(idx / 2) * 54;
    rpath(sx, sy, 156, 44, 8);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.stroke();
    txt(st[0], sx + 12, sy + 14, 10.5, '#8fa0b8');
    txt(st[1], sx + 12, sy + 31, 13, st[2]);
  });

  const infoY = ry + 202;
  txt('◆ 进入裂隙后装备与等级属性将完全封存，转化为纯粹肉鸽基准；', rx + 24, infoY, 11, '#c9d4e6');
  txt('◆ 通关房间自选质变圣物；击破第 12 间霸主必得【神话装备】；', rx + 24, infoY + 20, 11, '#c9d4e6');
  txt('◆ 神龛金色天赋可【永久提升主游戏攻击、生命与暴击伤害】！', rx + 24, infoY + 40, 11, '#ffd84a');

  const startBtnY = ry + 290, startBtnW = rw - 48, startBtnH = 50;
  pBtn(rx + 24, startBtnY, startBtnW, startBtnH, '⚡ 踏入镜世界 · 启程 [Enter]', {
    c: col,
    sz: 16,
    cr: 10
  }, () => {
    rogueStartRun();
  });

  poFooter(col, '数字键 1-6 升级天赋 · Enter 踏入虚幻裂隙 · ESC 返回', null);
}

function rogueUpgradeTalent(i) {
  const t = ROGUE_TALENTS[i];
  if (!t) return;
  const d = rogueData();
  const lv = d.mt[t.id] || 0;
  if (lv >= t.max) return pToast(`「${t.n}」已满级`);
  const cost = t.cost[lv];
  if (d.mc < cost) return pToast(`镜晶不足，需要 ${cost} 💠`);
  S.mc -= cost;
  S.mt[t.id] = lv + 1;
  calc(); save();
  pToast(`★「${t.n}」提升至 Lv.${lv + 1}，属性已永久生效！`);
}

function roguePortalUpdate(L, R, U, D, OK) {
  for (let i = 0; i < ROGUE_TALENTS.length; i++) {
    const k1 = 'Digit' + (i + 1), k2 = 'Numpad' + (i + 1);
    if (PR[k1] || PR[k2]) { delete PR[k1]; delete PR[k2]; rogueUpgradeTalent(i); }
  }
  if (OK) {
    delete PR.Enter; delete PR.Space; delete PR.KeyF;
    rogueStartRun();
  }
}

// ---------- 8. 战斗 HUD 与弹窗渲染 ----------
const ROGUE_HUD_H = 62;
function rogueStatusList() {
  const F = ROGUE.fx, out = [];
  if (ROGUE.shieldStacks > 0) out.push(`🛡×${ROGUE.shieldStacks}`);
  if (ROGUE.surgeTimer > 0) out.push('🌀狂涌');
  if (F.thunderT > 0) out.push('💥蓄能');
  if (F.timeFrac > 0) out.push('⏳停滞');
  if (rogueHasRelic('energy_surge') && ROGUE.surgeTimer <= 0) out.push(`${ROGUE.surgeHits}/6`);
  return out.join(' ');
}

function rogueDrawHUD(x, y, w) {
  const h = ROGUE_HUD_H, col = ROGUE_COL_THEME;
  hudPanel(x, y, w, h, col, 8);
  const R = x + w - 12;
  const tag = { combat: '战斗回廊', elite: '狂暴异变', rest: '避难所', shrine: '远古神龛', boss: '最终决战' }[ROGUE.roomType] || '';

  ut('🪞 虚幻裂隙', x + 12, y + 14, 11, col, 'left', { w: 700, sp: 0, sh: 0 });
  ut(`${ROGUE.room}/${ROGUE_TOTAL_ROOMS}`, R, y + 14, 13, '#ffd84a', 'right', { w: 700 });
  ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(x + 12, y + 24, w - 24, 1);
  ut(tag, x + 12, y + 36, 10, '#c79bff', 'left', { w: 600, sh: 0 });
  ut(`圣物 ${ROGUE.relics.length}`, R, y + 36, 10, '#7df9ff', 'right', { w: 600 });
  ut(`镜晶 +${ROGUE.crystalsGained}`, x + 12, y + 51, 10, '#7df9ff', 'left', { w: 600 });

  const n = ROGUE.relics.length;
  if (n > 0) {
    const perRow = 6, cell = 24, rows = Math.ceil(n / perRow);
    const gy = y + h + 4, gh = rows * 22 + 6;
    rpath(x, gy, w, gh, 6);
    ctx.fillStyle = 'rgba(8, 4, 18, 0.72)'; ctx.fill();
    ctx.strokeStyle = 'rgba(155, 81, 224, 0.4)'; ctx.lineWidth = 1; ctx.stroke();
    ROGUE.relics.forEach((id, i) => {
      const rel = ROGUE_RELICS.find(o => o.id === id);
      if (!rel) return;
      const tc = { 1: '#00d2d3', 2: '#2e86de', 3: '#a55eea', 4: '#ffd32a' }[rel.tier] || '#9b51e0';
      const hx = x + 14 + (i % perRow) * cell, hy = gy + 14 + Math.floor(i / perRow) * 22;
      ctx.save();
      ctx.beginPath(); ctx.arc(hx, hy - 1, 10, 0, Math.PI * 2);
      ctx.fillStyle = tc + (rel.tier >= 3 ? '40' : '26'); ctx.fill();
      if (rel.tier >= 3) { ctx.shadowColor = tc; ctx.shadowBlur = 6 + 5 * Math.sin(T * 3 + i); }
      ctx.strokeStyle = tc + (rel.tier >= 3 ? 'ee' : '99'); ctx.lineWidth = rel.tier >= 4 ? 1.8 : 1; ctx.stroke();
      ctx.restore();
      txt(rel.ic, hx, hy, 13, '#ffffff', 'center');
    });
    const st = rogueStatusList();
    if (st) ut(st, x + 12, gy + gh + 10, 10, '#7df9ff', 'left', { w: 600 });
  } else {
    const st = rogueStatusList();
    if (st) ut(st, x + 12, y + h + 12, 10, '#7df9ff', 'left', { w: 600 });
  }
}

function rogueChooseRelic(i) {
  if (ROGUE.state !== 'relic_pick') return;
  const rel = ROGUE.relicChoices[i];
  if (!rel) return;
  rogueAddRelic(rel.id);
  rogueGoNext();
}

function rogueReroll() {
  if (ROGUE.state !== 'relic_pick' || ROGUE.rerollsLeft <= 0) return;
  ROGUE.rerollsLeft--;
  rogueRollRelics();
  ROGUE.cur = 0;
}

function rogueSkipRelic() {
  if (ROGUE.state !== 'relic_pick') return;
  ROGUE.crystalsGained += ROGUE_BAL.skipCrystal;
  rogueHeal(P.mh * 0.10, true);
  DT.push({ x: P.x, y: P.y - 180, s: `放弃圣物 · 镜晶 +${ROGUE_BAL.skipCrystal}`, t: 1.2, c: '#7df9ff' });
  rogueGoNext();
}

function rogueRestChoices() {
  const k = rogueHasRelic('immortal_will') ? 0.7 : 1;
  const heal = Math.round(ROGUE_BAL.restHeal * 100 * k);
  const heal3 = Math.round(15 * k);
  return [
    { t: '纳米休整', d: `深度修复机甲，立即恢复 ${heal}% 最大生命值。`, c: '#2ed573', f: () => {
      rogueHeal(P.mh * ROGUE_BAL.restHeal, true);
      rogueGoNext();
    }},
    { t: '超频冥想', d: '消耗当前 20% 生命值（至少剩 1 点），立即随机获得 1 件高阶圣物。', c: '#a55eea', f: () => {
      let pool = ROGUE_RELICS.filter(r => r.tier >= 3 && r.tier < 4 && !ROGUE.relics.includes(r.id));
      if (!pool.length) pool = ROGUE_RELICS.filter(r => r.tier >= 2 && !ROGUE.relics.includes(r.id));
      const bonus = pool[Math.floor(Math.random() * pool.length)];
      if (!bonus) {
        ROGUE.crystalsGained += ROGUE_BAL.skipCrystal;
        DT.push({ x: P.x, y: P.y - 180, s: `圣物已齐 · 镜晶 +${ROGUE_BAL.skipCrystal}`, t: 1.4, c: '#7df9ff' });
        rogueGoNext();
        return;
      }
      P.hp = Math.max(1, Math.round(P.hp - P.mh * 0.2));
      rogueAddRelic(bonus.id);
      rogueGoNext();
    }},
    { t: '搜刮镜晶', d: `收集周围裂隙残骸，立即获得 +45 枚镜晶，并回复 ${heal3}% 生命。`, c: '#ffd84a', f: () => {
      ROGUE.crystalsGained += 45;
      rogueHeal(P.mh * 0.15, true);
      rogueGoNext();
    }}
  ];
}

function rogueShrineChoices() {
  return [
    { t: '鲜血狂怒', d: '最大生命 -25%，换取攻击力 +30%、暴击率 +15%（本次探索永久）。', c: '#ff4757', f: () => {
      ROGUE.mods.hpMul *= 0.75; ROGUE.mods.atkMul *= 1.3; ROGUE.mods.crAdd += 0.15;
      rogueRecalcStats(false);
      rogueGoNext();
    }},
    { t: '极度冰寒', d: '获得「急冻霜痕」；若已拥有，则改为回复 30% 生命。', c: '#70a1ff', f: () => {
      if (!ROGUE.relics.includes('frost_touch')) rogueAddRelic('frost_touch');
      else rogueHeal(P.mh * 0.30, true);
      rogueGoNext();
    }},
    { t: '致敬并离开', d: '不接受深渊试炼，安然离开，并回复 20% 生命。', c: '#9fb0c6', f: () => {
      rogueHeal(P.mh * 0.20, true);
      rogueGoNext();
    }}
  ];
}

function rogueChoosePanelOption(i) {
  const list = ROGUE.state === 'rest_pick' ? rogueRestChoices()
             : ROGUE.state === 'shrine_pick' ? rogueShrineChoices() : null;
  if (!list || !list[i]) return;
  list[i].f();
}

function rogueDrawOptionPanel(opts) {
  const pw = 680, ph = 380, px = (960 - pw) / 2, py = 80;
  poBevel(px, py, pw, ph, 16);
  ctx.fillStyle = opts.bg; ctx.fill();
  ctx.strokeStyle = opts.frame; ctx.lineWidth = 2; ctx.stroke();

  txt(opts.en, px + pw / 2, py + 30, 11, opts.frame, 'center');
  txt(opts.title, px + pw / 2, py + 58, 22, opts.titleCol, 'center');

  ROGUE.hitRects = [];
  opts.list.forEach((ch, idx) => {
    const rx = px + 36, ry = py + 92 + idx * 80, rw = pw - 72, rh = 64;
    const sel = ROGUE.cur === idx;
    poBevel(rx, ry, rw, rh, 10);
    ctx.fillStyle = sel ? 'rgba(255, 255, 255, 0.10)' : 'rgba(255, 255, 255, 0.04)'; ctx.fill();
    ctx.strokeStyle = ch.c; ctx.lineWidth = sel ? 2.4 : 1.2;
    if (sel) { ctx.save(); ctx.shadowColor = ch.c; ctx.shadowBlur = 14; ctx.stroke(); ctx.restore(); }
    else ctx.stroke();

    txt(`[${idx + 1}]`, rx + 22, ry + 22, 12, '#8fa0b8');
    txt(ch.t, rx + 56, ry + 22, 16, ch.c);
    txt(ch.d, rx + 56, ry + 44, 11.5, '#c9d4e6');

    const act = () => rogueChoosePanelOption(idx);
    pBtn(rx + rw - 128, ry + 16, 114, 32, `${opts.btn} [${idx + 1}]`, { c: ch.c, sz: 12, cr: 6 }, act);
    ROGUE.hitRects.push({ x: rx, y: ry, w: rw, h: rh, f: act });
  });

  txt('W/S 或 ←/→ 切换 · Enter 确认 · 数字键直选', px + pw / 2, py + ph - 20, 11, '#7f90a8', 'center');
}

function rogueDrawOverlays() {
  if (!ROGUE.inRun) return;
  if (typeof PO !== 'undefined' && Array.isArray(PO.hit)) PO.hit.length = 0;

  if (ROGUE.state === 'relic_pick') {
    ctx.save();
    ctx.fillStyle = 'rgba(3, 2, 10, 0.88)';
    ctx.fillRect(0, 0, 960, 540);

    const pw = 740, ph = 420, px = (960 - pw) / 2, py = 60;
    poBevel(px, py, pw, ph, 16);
    const g = ctx.createLinearGradient(px, py, px + pw, py + ph);
    g.addColorStop(0, '#1c0f2e'); g.addColorStop(1, '#080410');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = ROGUE_COL_THEME; ctx.lineWidth = 2; ctx.stroke();

    txt('MIRROR ARTIFACT CONVERGENCE', px + pw / 2, py + 26, 11, ROGUE_COL_THEME, 'center');
    txt('裂隙涤清 · 选择你的契约圣物', px + pw / 2, py + 52, 22, '#ffd84a', 'center');

    const cw = 210, ch = 250, cgap = 20;
    const cx0 = px + (pw - (3 * cw + 2 * cgap)) / 2, cy0 = py + 86;
    ROGUE.hitRects = [];

    ROGUE.relicChoices.forEach((rel, i) => {
      const cx = cx0 + i * (cw + cgap);
      const tierCols = { 1: '#00d2d3', 2: '#2e86de', 3: '#a55eea', 4: '#ffd32a' };
      const cardCol = tierCols[rel.tier] || '#ffffff';
      const sel = ROGUE.cur === i;

      poBevel(cx, cy0, cw, ch, 12);
      const cg = ctx.createLinearGradient(cx, cy0, cx + cw, cy0 + ch);
      cg.addColorStop(0, sel ? 'rgba(45, 25, 70, 0.98)' : 'rgba(25, 12, 40, 0.95)');
      cg.addColorStop(1, 'rgba(10, 5, 20, 0.98)');
      ctx.fillStyle = cg; ctx.fill();
      ctx.strokeStyle = cardCol; ctx.lineWidth = sel ? 3 : 1.5;
      if (sel) { ctx.save(); ctx.shadowColor = cardCol; ctx.shadowBlur = 16; ctx.stroke(); ctx.restore(); }
      else ctx.stroke();

      poBadge(cx + 14, cy0 + 14, rel.tag, cardCol);
      txt(`[ ${i + 1} ]`, cx + cw - 20, cy0 + 24, 12, '#8fa0b8', 'right');

      txt(rel.ic, cx + cw / 2, cy0 + 64, 38, '#ffffff', 'center');
      txt(rel.n, cx + cw / 2, cy0 + 104, 16, cardCol, 'center');

      const lines = mWrap(rel.d, cw - 28, 11.5, 4);
      lines.forEach((l, idx) => {
        txt(l, cx + 14, cy0 + 134 + idx * 18, 11.5, '#c9d4e6');
      });

      const btnY = cy0 + ch - 42;
      const act = () => rogueChooseRelic(i);
      pBtn(cx + 14, btnY, cw - 28, 32, `确认契约 [${i + 1}]`, { c: cardCol, sz: 12.5, cr: 6 }, act);
      ROGUE.hitRects.push({ x: cx, y: cy0, w: cw, h: ch, f: act });
    });

    const canReroll = ROGUE.rerollsLeft > 0;
    const rerollY = py + ph - 42;
    pBtn(px + pw / 2 - 210, rerollY, 200, 28, `重掷候选圣物 [R] (${ROGUE.rerollsLeft})`, {
      c: canReroll ? '#ffd84a' : '#556677',
      dis: !canReroll,
      sz: 11.5,
      cr: 6
    }, rogueReroll);
    pBtn(px + pw / 2 + 10, rerollY, 200, 28, `放弃圣物 · 镜晶 +${ROGUE_BAL.skipCrystal} [X]`, {
      c: '#7df9ff', ghost: true, sz: 11.5, cr: 6
    }, rogueSkipRelic);

    txt('A/D 或 ←/→ 切换 · Enter 确认 · 数字键直选 · R 重掷 · X 放弃', px + pw / 2, py + ph - 56, 10.5, '#7f90a8', 'center');

    ctx.restore();
  }

  if (ROGUE.state === 'rest_pick') {
    ctx.save();
    ctx.fillStyle = 'rgba(3, 2, 10, 0.88)';
    ctx.fillRect(0, 0, 960, 540);
    rogueDrawOptionPanel({
      bg: '#140c24', frame: '#2ed573', titleCol: '#ffffff',
      en: 'MIRROR REFUGE · 镜界避难所', title: '战局歇息 · 选择你的补给整备',
      btn: '确认选择', list: rogueRestChoices()
    });
    ctx.restore();
  }

  if (ROGUE.state === 'shrine_pick') {
    ctx.save();
    ctx.fillStyle = 'rgba(3, 2, 10, 0.88)';
    ctx.fillRect(0, 0, 960, 540);
    rogueDrawOptionPanel({
      bg: '#1a0d2a', frame: '#e056fd', titleCol: '#ffd84a',
      en: 'ANCIENT SHADOW SHRINE · 远古神龛', title: '深渊呢喃 · 牺牲与力量的抉择',
      btn: '立下契约', list: rogueShrineChoices()
    });
    ctx.restore();
  }

  if (ROGUE.state === 'settle_win' || ROGUE.state === 'settle_lose') {
    const isWin = ROGUE.state === 'settle_win';
    ctx.save();
    ctx.fillStyle = 'rgba(2, 2, 8, 0.92)';
    ctx.fillRect(0, 0, 960, 540);

    const pw = 660, ph = 410, px = (960 - pw) / 2, py = 65;
    poBevel(px, py, pw, ph, 16);
    ctx.fillStyle = isWin ? '#1b102e' : '#1a0c14'; ctx.fill();
    ctx.strokeStyle = isWin ? '#ffd84a' : '#ff4757'; ctx.lineWidth = 2; ctx.stroke();

    txt(isWin ? 'VICTORY · 虚幻裂隙完全涤清！' : 'DEFEAT · 裂隙维度崩解…', px + pw / 2, py + 34, 24, isWin ? '#ffd84a' : '#ff4757', 'center');
    txt(isWin ? '你成功贯穿全部 12 间裂隙，加冕无上契约！' : `倒在了第 ${ROGUE.room} 裂隙（已涤清 ${ROGUE.cleared} 间），下次再来吧！`, px + pw / 2, py + 62, 12.5, '#a2b4cb', 'center');

    const cards = [
      { t: '涤清裂隙', v: `${isWin ? ROGUE_TOTAL_ROOMS : ROGUE.cleared} / ${ROGUE_TOTAL_ROOMS}`, c: '#ffd84a' },
      { t: '收获镜晶', v: `+${ROGUE.crystalsGained} 💠`, c: '#7df9ff' },
      { t: '契约碎片', v: `+${ROGUE.shardsGained} 🔮`, c: '#c79bff' },
      { t: '神话装备', v: isWin ? '获得 1 件' : (ROGUE.cleared >= ROGUE_BAL.reward.epicFromRoom ? '史诗 1 件' : '无'), c: isWin ? '#ff4757' : '#889' }
    ];

    const cw = 135, ch = 60, cgap = 12;
    const cx0 = px + (pw - (4 * cw + 3 * cgap)) / 2, cy0 = py + 86;
    cards.forEach((cd, idx) => {
      const cx = cx0 + idx * (cw + cgap);
      rpath(cx, cy0, cw, ch, 8);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'; ctx.stroke();
      txt(cd.t, cx + cw / 2, cy0 + 18, 10.5, '#8fa0b8', 'center');
      txt(cd.v, cx + cw / 2, cy0 + 40, 15, cd.c, 'center');
    });

    const listY = py + 162;
    txt('本次探索融合圣物构筑：', px + 36, listY, 11.5, '#c9d4e6');
    const iconSize = 28, igap = 6, perRow = 14;
    ROGUE.relics.forEach((id, idx) => {
      const item = ROGUE_RELICS.find(o => o.id === id);
      if (!item) return;
      const ix = px + 36 + (idx % perRow) * (iconSize + igap);
      const iy = listY + 12 + Math.floor(idx / perRow) * (iconSize + igap);
      rpath(ix, iy, iconSize, iconSize, 6);
      ctx.fillStyle = 'rgba(155, 81, 224, 0.25)'; ctx.fill();
      ctx.strokeStyle = item.tier >= 3 ? '#ffd84a' : '#9b51e0'; ctx.lineWidth = 1; ctx.stroke();
      txt(item.ic, ix + iconSize / 2, iy + iconSize / 2 + 1, 14, '#ffffff', 'center');
    });

    const rv = ROGUE.rewardView || { gold: 0, dia: 0, mat: 0, scr: 0 };
    txt(`主游戏奖励：${rv.gold.toLocaleString()} G · ${rv.dia} 钻石 · ${rv.mat} 材料${rv.scr ? ' · ' + rv.scr + ' 卷轴' : ''}`, px + pw / 2, py + ph - 112, 12, '#ffd84a', 'center');
    txt('★ 所获镜晶、契约碎片与神话装备均已直接存入主游戏背包与神龛！', px + pw / 2, py + ph - 88, 11.5, '#7dff9a', 'center');

    ROGUE.hitRects = [];
    const btnW = 200, btnH = 42, btnX = px + (pw - btnW) / 2, btnY = py + ph - 54;
    pBtn(btnX, btnY, btnW, btnH, '离开镜世界 [Enter]', { c: ROGUE_COL_THEME, sz: 14, cr: 8 }, rogueEndRun);
    ROGUE.hitRects.push({ x: btnX, y: btnY, w: btnW, h: btnH, f: rogueEndRun });

    ctx.restore();
  }
}

function rogueIsPaused() {
  return ROGUE.inRun && (ROGUE.state === 'relic_pick' || ROGUE.state === 'rest_pick' || ROGUE.state === 'shrine_pick' || ROGUE.state === 'settle_win' || ROGUE.state === 'settle_lose');
}

// ---------- 9. 核心挂接 (Hooking Engine) ----------
(function hookRogueEngine() {
  const hook = (name, make) => {
    const orig = window[name];
    if (typeof orig !== 'function') { console.warn('[rogue] 找不到引擎函数：' + name); return; }
    window[name] = make(orig);
  };

  // 0. 时停逻辑
  const rawRAF = window.requestAnimationFrame.bind(window);
  let pauseAt = null, pausedTotal = 0;
  window.requestAnimationFrame = function(cb) {
    return rawRAF(function(ts) {
      if (rogueIsPaused()) {
        if (pauseAt === null) pauseAt = ts;
        cb(pauseAt - pausedTotal);
      } else {
        if (pauseAt !== null) { pausedTotal += ts - pauseAt; pauseAt = null; }
        cb(ts - pausedTotal);
      }
    });
  };

  // 1. 拦截战斗胜利/战败
  hook('fin', orig => function(w) {
    if (ROGUE.inRun && G === 'play') {
      if (rogueIsPaused()) return;
      if (w) rogueOnRoomClear(); else rogueOnPlayerDeath();
      return;
    }
    return orig.apply(this, arguments);
  });

  // 2. 拦截 calc() 计算：防止局内升级或变身时属性被外部装备覆盖
  hook('calc', orig => function() {
    if (ROGUE.inRun && G === 'play') {
      const curHp = P.hp;
      const curMh = P.mh;
      const hpRatio = curMh > 0 ? Math.max(0, Math.min(1, curHp / curMh)) : 1;

      rogueRecalcStats(false);

      P.hp = Math.max(1, Math.min(P.mh, Math.round(P.mh * hpRatio)));
      P.mp = Math.min(P.mm, P.mp || P.mm);
      P.sta = Math.min(P.stm, P.sta || P.stm);
      return;
    }
    return orig.apply(this, arguments);
  });

  // 2.1 拦截 gain()：在肉鸽中升级时给予回血
  hook('gain', orig => function(n, raw) {
    const oldLv = S.lv;
    const res = orig.apply(this, arguments);
    if (ROGUE.inRun && G === 'play' && S.lv > oldLv) {
      rogueHeal(P.mh * 0.2, false);
      DT.push({ x: P.x, y: P.y - 180, s: 'LEVEL UP! 生命 +20%', t: 1.5, c: '#7dff9a' });
    }
    return res;
  });

  // 3. 拦截伤害
  hook('hurt', orig => function(e, d, pre) {
    if (!ROGUE.inRun || G !== 'play' || ROGUE.busy > 0 || pre || !e) return orig.apply(this, arguments);
    const args = Array.prototype.slice.call(arguments);
    args[1] = rogueModifyDamage(e, d);
    const res = orig.apply(this, args);
    rogueOnHit(e, args[1]);
    return res;
  });

  // 4. 拦截受击
  hook('hurtP', orig => function(d) {
    if (rogueIsPaused()) return;
    if (!ROGUE.inRun || G !== 'play' || P.inv > 0 || P.down) return orig.apply(this, arguments);
    const r = rogueOnHurtP(d);
    if (r.block) return;
    const args = Array.prototype.slice.call(arguments);
    if (r.mul !== 1 && typeof args[0] === 'number') args[0] = args[0] * r.mul;
    return orig.apply(this, args);
  });

  // 5. 弹幕粉碎
  hook('cancelEP', orig => function(x0, x1) {
    if (ROGUE.inRun && G === 'play' && rogueHasRelic('bullet_eraser')) {
      const before = Array.isArray(EP) ? EP.length : 0;
      const res = orig.call(this, x0 - 40, x1 + 40);
      const removed = before - (Array.isArray(EP) ? EP.length : 0);
      if (removed > 0) { P.mp = Math.min(P.mm, P.mp + 5 * removed); rfx('erase', removed); }
      return res;
    }
    return orig.apply(this, arguments);
  });

  // 6. 神龛永久加成作用于主游戏面板
  const ROGUE_CRIT_DMG_KEYS = ['cd', 'cdm', 'critDmg', 'critDamage', 'cdmg', 'crd', 'critdmg'];
  let critKeyWarned = false;
  hook('previewStats', orig => function(eq, withForm) {
    const res = orig.apply(this, arguments);
    if (!res || typeof res !== 'object') return res;
    const t = (S.mt || {});
    if (t.g_atk && typeof res.atk === 'number') res.atk *= (1 + t.g_atk * 0.03);
    if (t.g_hp && typeof res.hp === 'number') res.hp *= (1 + t.g_hp * 0.04);
    if (t.g_crit) {
      const key = ROGUE_CRIT_DMG_KEYS.find(k => typeof res[k] === 'number');
      if (key) res[key] += t.g_crit * 0.15;
      else if (!critKeyWarned) { critKeyWarned = true; console.warn('[rogue] 未找到暴击伤害字段，会心共鸣暂未生效；请把字段名加入 ROGUE_CRIT_DMG_KEYS'); }
    }
    return res;
  });

  // 7. 每帧更新
  hook('updBikes', orig => function(dt) {
    const r = orig.apply(this, arguments);
    if (ROGUE.inRun && G === 'play') rogueUpdate(dt);
    return r;
  });

  // 8. ★★★ 核心修复：完全屏蔽常规三星条件面板 ★★★
  hook('drawStarHUD', orig => function(x, y, w) {
    if (ROGUE.inRun && G === 'play') return; // 在肉鸽模式下静默拦截，不绘制三星框
    return orig.apply(this, arguments);
  });

  // 8.1 挂接右侧 HUD：紧贴上方任务框，消减空隙
  hook('drawInfoHUD', orig => function() {
    const active = ROGUE.inRun && G === 'play';
    let bottom = 0;
    const origPanel = window.hudPanel;
    const wrapPanel = active && typeof origPanel === 'function';
    if (wrapPanel) {
      window.hudPanel = function(x, y, w, h) {
        if (x > 700) bottom = Math.max(bottom, y + h);
        return origPanel.apply(this, arguments);
      };
    }
    try {
      orig.apply(this, arguments);
    } finally {
      if (wrapPanel) window.hudPanel = origPanel;
    }
    if (active) {
      // bottom 对应上方「目标/战利品/时长/药水」的底部（约为 174px），肉鸽面板直接紧随其后
      rogueDrawHUD(960 - 18 - 160, (bottom || 174) + 6, 160);
    }
  });

  // 9. 顶层弹窗与时停兜底
  hook('hintLine', orig => function() {
    orig.apply(this, arguments);
    if (rogueIsPaused()) {
      E = []; EP = []; HZ = []; PJ = []; BIKES = [];
      P.inv = 9999; P.vx = 0; P.vy = 0;
    }
    if (ROGUE.inRun && (G === 'play' || ROGUE.state !== 'idle')) rogueDrawOverlays();
  });

  // 10. 怪物生成
  hook('spawn', orig => function() {
    if (rogueIsPaused()) return;
    const n0 = Array.isArray(E) ? E.length : 0;
    const r = orig.apply(this, arguments);
    try { rogueTweakSpawn(n0); } catch (err) { console.warn('[rogue] 畸变巨兽生成失败（已忽略）', err); }
    return r;
  });

  // 11. 中途退出
  hook('toVil', orig => function() {
    if (ROGUE.inRun) rogueEndRun(true);
    return orig.apply(this, arguments);
  });
})();

// ---------- 10. 键盘与鼠标交互 ----------
function rogueHandlePopupKey(code, repeat) {
  const st = ROGUE.state;
  const ok = code === 'Enter' || code === 'NumpadEnter' || code === 'Space' || code === 'KeyF';
  const locked = performance.now() < ROGUE.lockUntil;

  if (st === 'settle_win' || st === 'settle_lose') {
    if (!locked && !repeat && (ok || code === 'Escape')) rogueEndRun();
    return true;
  }

  const n = st === 'relic_pick' ? ROGUE.relicChoices.length : 3;
  const m = /^(?:Digit|Numpad)(\d)$/.exec(code);
  const num = m ? +m[1] : 0;
  const prev = code === 'KeyA' || code === 'ArrowLeft' || code === 'KeyW' || code === 'ArrowUp';
  const next = code === 'KeyD' || code === 'ArrowRight' || code === 'KeyS' || code === 'ArrowDown';

  if (prev) { if (n) ROGUE.cur = (ROGUE.cur + n - 1) % n; return true; }
  if (next) { if (n) ROGUE.cur = (ROGUE.cur + 1) % n; return true; }
  if (locked) return true;

  if (num >= 1 && num <= n) {
    ROGUE.cur = num - 1;
    if (!repeat) { st === 'relic_pick' ? rogueChooseRelic(num - 1) : rogueChoosePanelOption(num - 1); }
    return true;
  }
  if (ok && !repeat) {
    st === 'relic_pick' ? rogueChooseRelic(ROGUE.cur) : rogueChoosePanelOption(ROGUE.cur);
    return true;
  }
  if (st === 'relic_pick' && !repeat) {
    if (code === 'KeyR') { rogueReroll(); return true; }
    if (code === 'KeyX') { rogueSkipRelic(); return true; }
  }
  return false;
}

window.addEventListener('keydown', e => {
  if (!ROGUE.inRun || !rogueIsPaused()) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const handled = rogueHandlePopupKey(e.code, e.repeat);
  if (handled) e.preventDefault();
  e.stopImmediatePropagation();
}, true);

window.addEventListener('keydown', e => {
  if (!ROGUE.inRun) return;
  ROGUE.held[e.code] = true;
  if (!e.repeat && !rogueIsPaused()) rogueOnKey(e.code);
});
window.addEventListener('keyup', e => { delete ROGUE.held[e.code]; });
window.addEventListener('blur', () => { ROGUE.held = {}; });

window.addEventListener('pointerdown', e => {
  if (!ROGUE.inRun || !rogueIsPaused()) return;
  const c = document.getElementById('c');
  if (!c) return;
  const r = c.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (performance.now() < ROGUE.lockUntil) return;
  const x = (e.clientX - r.left) / r.width * 960, y = (e.clientY - r.top) / r.height * 540;
  const inR = o => x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h;
  const hit = (typeof PO !== 'undefined' && Array.isArray(PO.hit))
    ? PO.hit.slice().reverse().find(inR)
    : null;
  const target = hit || (ROGUE.hitRects || []).slice().reverse().find(inR);
  if (!target || typeof target.f !== 'function') return;
  const idx = (ROGUE.hitRects || []).indexOf(target);
  if (idx >= 0 && ROGUE.state !== 'settle_win' && ROGUE.state !== 'settle_lose') ROGUE.cur = idx;
  target.f();
}, true);