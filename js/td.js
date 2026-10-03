// ===== 塔防：骑士守卫战 =====
// 入口：传送门 →「骑士防线」。整局是独立画面（G === 'td'），不碰原来的战斗系统。
// 玩法：5 条车道，敌人从右往左推进；用「契约能量」部署骑士，骑士各有攻击方式，可升级 / 出售。
//       敌人冲到最左边时，该车道的「机车」会自动冲出清场（每条车道 1 次），机车用完后再漏怪就扣基地血量。
// 数据：S.td = { best: 已通关的最高关数, stars: { 关卡序号: 最高星级 } }（随 save() 写入本地与云端）
// 想调平衡：只改下面「可调参数」和 TD_RIDERS 里的数值。

// ---------- 可调参数 ----------
const TD_COLS = 9, TD_ROWS = 5, TD_X0 = 108, TD_Y0 = 100, TD_CW = 78, TD_RH = 68;
const TD_LEVELS = 10;            // 关卡数（对应 10 个章节主题）
const TD_WAVES = 10;             // 每关波数，最后一波带首领
const TD_BASE_HP = 10;           // 基地血量
const TD_START_EN = 200;         // 开局能量
const TD_EN_RATE = 6;            // 每秒自然回复能量
const TD_NEED_CAP = false;       // true：除 Malaya 外，必须拥有对应胶囊才能出战；false：未拥有的骑士「借调」出战（造价 +25%，威力 ×0.8）
const TD_SPAWN_X = 990;
const TD_COL = '#ff9f43';        // 塔防模式主题色
// 如果某位骑士出手 / 站立时朝向反了，把对应值改成 -1
const TD_FLIP = { malaya: 1, ryuki: 1, '555': 1, blade: 1, zeztz: 1 };

// 骑士定义：cost 造价 / hp 生命 / dmg 单次伤害 / cd 攻击间隔(秒) / rng 射程(格) / cdc 部署冷却(秒)
const TD_RIDERS = [
  { id: 'malaya', cap: null, name: 'Malaya', col: '#00e5ff', cost: 50, hp: 320, dmg: 22, cd: .9, rng: 1.8, cdc: 3, kind: 'slash', desc: '近战斩击，一剑扫过范围内所有敌人' },
  { id: '555', cap: '555', name: '555', col: '#ffb400', cost: 75, hp: 220, dmg: 11, cd: .42, rng: 7, cdc: 4, kind: 'gun', desc: '手机枪高速连射，射程全场最远' },
  { id: 'ryuki', cap: 'ryuki', name: '龙骑', col: '#ff4757', cost: 100, hp: 260, dmg: 30, cd: 1.2, rng: 5, cdc: 6, kind: 'fire', desc: '龙炎弹点燃目标，持续灼烧' },
  { id: 'blade', cap: 'blade', name: 'Blade', col: '#3aa0ff', cost: 150, hp: 240, dmg: 44, cd: 2.0, rng: 6, cdc: 8, kind: 'bolt', desc: '召雷贯穿整条车道，并波及相邻车道' },
  { id: 'zeztz', cap: 'zeztz', name: 'Zeztz', col: '#00f2fe', cost: 175, hp: 440, dmg: 34, cd: 1.6, rng: 2.6, cdc: 9, kind: 'wave', desc: '拳压冲击波，范围伤害并减速，血厚能扛' }
];
const TD_BY = {}; TD_RIDERS.forEach(r => TD_BY[r.id] = r);
const TD_SPECIAL_EVERY = 6;      // 每第 N 次攻击触发一次「必杀」强化攻击

// ---------- 存档 ----------
function tdData() {
  if (!S.td || typeof S.td !== 'object') S.td = { best: 0, stars: {} };
  if (typeof S.td.best !== 'number') S.td.best = 0;
  if (!S.td.stars || typeof S.td.stars !== 'object') S.td.stars = {};
  return S.td;
}
const tdBest = () => tdData().best | 0;
const tdOpen = L => L <= tdBest();               // 第 L 关(0 起)是否已解锁
const tdStarOf = L => tdData().stars[L] | 0;
const tdOwned = d => !d.cap || (Array.isArray(S.caps) && S.caps.includes(d.cap));
const tdUsable = d => !TD_NEED_CAP || tdOwned(d);
const tdCost = d => Math.round(d.cost * (tdOwned(d) ? 1 : 1.25));
const tdUpCost = (d, lv) => Math.round(d.cost * (lv === 1 ? .9 : 1.4));
function tdMul(d) {                                  // 等级 / 胶囊星级 / 是否拥有 带来的威力倍率
  const star = (d.cap && typeof capStar === 'function') ? capStar(d.cap) : 0;
  return (1 + (S.lv | 0) * .012) * (1 + star * .04) * (tdOwned(d) ? 1 : .8);
}
const tdDmg = (d, lv) => d.dmg * (1 + .45 * (lv - 1)) * tdMul(d);
const tdHp = (d, lv) => d.hp * (1 + .3 * (lv - 1)) * (tdOwned(d) ? 1 : .8);

// ---------- 关卡 ----------
function tdCfg(L) {
  const th = CHAPTER_THEMES[Math.min(L, CHAPTER_THEMES.length - 1)];
  return {
    L, set: L + 1, name: th.title, sub: th.sub, col: th.col, boss: th.bn,
    hpMul: 1 + L * .42, dpsMul: 1 + L * .15,
    gold: 500 + L * 350, diam: 80 + L * 20, shard: L === 4 ? 3 : L === 9 ? 5 : 0
  };
}
const TD_ET = {    // 敌人基础：hp 生命 / spd 速度(px/s) / dps 啃咬伤害 / er 击杀能量 / h 显示高度
  imp: { hp: 70, spd: 34, dps: 14, er: 8, h: 74 },
  wd: { hp: 260, spd: 22, dps: 28, er: 18, h: 108 },
  boss: { hp: 2600, spd: 15, dps: 70, er: 120, h: 156 }
};

function tdMakeWave(cfg, w) {   // 返回按时间排好的出怪表 [{t, type, row}]
  const n = Math.round(4 + w * 1.6 + cfg.L * .7), span = 10 + w * 1.2, list = [];
  const pw = w < 3 ? 0 : Math.min(.55, .1 + (w - 2) * .07);
  for (let i = 0; i < n; i++) {
    const type = Math.random() < pw ? 'wd' : 'imp';
    list.push({ t: 1 + span * i / n + Math.random() * .6, type, row: (Math.random() * TD_ROWS) | 0 });
  }
  if (w === TD_WAVES) list.push({ t: 2, type: 'boss', row: 2 });
  list.sort((a, b) => a.t - b.t);
  return { list, span };
}

// ---------- 状态 ----------
const TD = {
  on: false, L: 0, cfg: null, spd: 1, paused: false, over: null, pauseMenu: false,
  energy: 0, baseHp: 0, wave: 0, phase: 'prep', timer: 0, waveT: 0, queue: [], span: 0,
  riders: [], enemies: [], shots: [], fx: [], orbs: [], bikes: [], cardCd: {},
  pickCard: null, pickRider: null, mouse: { x: -99, y: -99 }, hits: [], kills: 0, leaks: 0, orbT: 4, toast: '', toastT: 0, t: 0
};

function tdStart(L) {
  L = Math.max(0, Math.min(L | 0, TD_LEVELS - 1));
  if (!tdOpen(L)) return pToast('请先通关上一关');
  const cfg = tdCfg(L);
  Object.assign(TD, {
    on: true, L, cfg, spd: 1, paused: false, over: null, pauseMenu: false,
    energy: TD_START_EN, baseHp: TD_BASE_HP, wave: 0, phase: 'prep', timer: 14, waveT: 0, queue: [], span: 0,
    riders: [], enemies: [], shots: [], fx: [], orbs: [], cardCd: {}, kills: 0, leaks: 0, orbT: 4, toast: '', toastT: 0, t: 0,
    pickCard: null, pickRider: null, hits: []
  });
  TD.bikes = [];
  for (let r = 0; r < TD_ROWS; r++) TD.bikes.push({ row: r, x: 56, st: 'idle' });
  PO.ret = 'td'; PO.td = L; M = 0; G = 'td';
  for (const k in K) K[k] = 0;
}

function tdExit() {
  TD.on = false;
  save();
  toVil('st');
}

const tdRowY = r => TD_Y0 + r * TD_RH + TD_RH - 10;          // 车道脚底 y
const tdColX = c => TD_X0 + c * TD_CW + TD_CW / 2;           // 格子中心 x
const tdToast = s => { TD.toast = s; TD.toastT = 1.8; };
const tdFx = o => TD.fx.push(Object.assign({ t: .4, d: .4 }, o, { d: o.t || .4 }));

// ---------- 部署 / 升级 / 出售 ----------
function tdPlace(id, r, c) {
  const d = TD_BY[id];
  if (!d || !tdUsable(d)) return;
  if (TD.riders.some(o => o.row === r && o.col === c)) return tdToast('这个格子已经有骑士了');
  if ((TD.cardCd[id] || 0) > 0) return tdToast(d.name + ' 部署冷却中');
  const cost = tdCost(d);
  if (TD.energy < cost) return tdToast('能量不足（需要 ' + cost + '）');
  TD.energy -= cost;
  TD.cardCd[id] = d.cdc;
  const o = { id, d, row: r, col: c, lv: 1, spent: cost, hp: tdHp(d, 1), mh: tdHp(d, 1), cd: .3, n: 0, at: 0, flash: 0, born: 0 };
  TD.riders.push(o);
  tdFx({ k: 'ring', x: tdColX(c), y: tdRowY(r) - 30, r: 60, col: d.col, t: .45 });
  TD.pickCard = null;
}
function tdUpgrade(o) {
  if (!o || o.lv >= 3) return;
  const cost = tdUpCost(o.d, o.lv);
  if (TD.energy < cost) return tdToast('能量不足（升级需要 ' + cost + '）');
  TD.energy -= cost; o.spent += cost; o.lv++;
  const nm = tdHp(o.d, o.lv), add = nm - o.mh; o.mh = nm; o.hp = Math.min(nm, o.hp + add);
  tdFx({ k: 'ring', x: tdColX(o.col), y: tdRowY(o.row) - 40, r: 80, col: '#ffd84a', t: .5 });
  tdFx({ k: 'txt', x: tdColX(o.col), y: tdRowY(o.row) - 120, s: 'LEVEL UP Lv.' + o.lv, col: '#ffd84a', t: 1 });
}
function tdSell(o) {
  if (!o) return;
  const back = Math.round(o.spent * .6);
  TD.energy += back;
  TD.riders.splice(TD.riders.indexOf(o), 1);
  if (TD.pickRider === o) TD.pickRider = null;
  tdFx({ k: 'txt', x: tdColX(o.col), y: tdRowY(o.row) - 90, s: '+' + back + ' 能量', col: '#7dff9a', t: .9 });
}

// ---------- 伤害 ----------
function tdHurt(e, dmg, o) {
  if (e.dead) return;
  e.hp -= dmg; e.fl = .09;
  if (o && o.slow) e.slow = Math.max(e.slow, o.slow);
  if (o && o.burn) { e.burn = 3; e.burnD = Math.max(e.burnD, o.burn); }
  if (o && o.stun) e.stun = Math.max(e.stun, o.stun);
  if (o && o.kb) e.x += o.kb;
  if (e.hp <= 0) {
    e.dead = true; TD.kills++;
    TD.energy += e.er;
    tdFx({ k: 'ring', x: e.x, y: tdRowY(e.row) - e.h * .5, r: 40 + e.h * .2, col: '#ffd84a', t: .35 });
    tdFx({ k: 'txt', x: e.x, y: tdRowY(e.row) - e.h - 6, s: '+' + e.er, col: '#7df9ff', t: .7 });
  }
}
function tdLaneEnemies(row, x0, x1) {
  return TD.enemies.filter(e => !e.dead && e.row === row && e.x >= x0 && e.x <= x1 && e.x < 975);
}

// ---------- 骑士出手 ----------
function tdFire(o, dt) {
  const d = o.d, cx = tdColX(o.col), reach = d.rng * TD_CW + 34, sp = (o.n + 1) % TD_SPECIAL_EVERY === 0;
  let dmg = tdDmg(d, o.lv);
  // 先找目标：同一车道（Zeztz / Blade 还会看相邻车道）
  const lane = tdLaneEnemies(o.row, cx - 20, cx + reach);
  let near = (d.kind === 'wave' || d.kind === 'bolt') ? [o.row - 1, o.row, o.row + 1].flatMap(r => tdLaneEnemies(r, cx - 20, cx + reach)) : lane;
  if (!near.length) return false;
  o.n++; o.at = .5; o.cd = d.cd;
  const y = tdRowY(o.row) - 56;
  if (sp) tdFx({ k: 'txt', x: cx, y: tdRowY(o.row) - 130, s: 'FINAL VENT!', col: d.col, t: .8 });
  if (d.kind === 'slash') {
    const m = sp ? 2.4 : 1;
    for (const e of lane) tdHurt(e, dmg * m);
    tdFx({ k: 'slash', x: cx + 40, y: y, r: sp ? 130 : 90, col: d.col, t: .25 });
    if (sp) TD.shots.push({ k: 'wave', x: cx + 30, y, row: o.row, vx: 560, dmg: dmg * 1.6, pierce: 1, hit: new Set(), col: d.col, life: 2 });
  } else if (d.kind === 'gun') {
    const m = sp ? 2.2 : 1;
    TD.shots.push({ k: 'bullet', x: cx + 36, y: y - 4, row: o.row, vx: 1250, dmg: dmg * m, pierce: sp ? 1 : 0, hit: new Set(), col: sp ? '#fff3a0' : d.col, life: 1.2, big: sp });
  } else if (d.kind === 'fire') {
    TD.shots.push({ k: 'fire', x: cx + 36, y, row: o.row, vx: 520, dmg: dmg * (sp ? 1.8 : 1), burn: dmg * .22, pierce: 0, aoe: sp, hit: new Set(), col: d.col, life: 2 });
  } else if (d.kind === 'bolt') {
    const tg = sp ? TD.enemies.filter(e => !e.dead && e.x < 975) : near;
    for (const e of tg) tdHurt(e, e.row === o.row ? dmg * (sp ? 1.5 : 1) : dmg * .5);
    const rows = sp ? [0, 1, 2, 3, 4] : [o.row - 1, o.row, o.row + 1];
    for (const r of rows) if (r >= 0 && r < TD_ROWS) tdFx({ k: 'bolt', x0: cx + 30, y0: -10, x1: cx + reach, y1: tdRowY(r) - 30, col: '#bfe6ff', t: .3, seed: Math.random() * 99 });
  } else if (d.kind === 'wave') {
    const opt = { slow: 2.2, stun: sp ? 1 : 0, kb: sp ? 50 : 0 };
    for (const e of near) tdHurt(e, dmg * (sp ? 1.8 : 1), opt);
    tdFx({ k: 'ring', x: cx + 60, y: tdRowY(o.row) - 30, r: reach * (sp ? 1.1 : .8), col: d.col, t: .4 });
    tdFx({ k: 'ring', x: cx + 60, y: tdRowY(o.row) - 30, r: reach * .5, col: '#ffffff', t: .3 });
  }
  return true;
}

// ---------- 更新 ----------
function tdUpdate(dt) {
  T += dt;
  const P1 = id => { const v = PR[id]; if (v) delete PR[id]; return !!v; };
  // 键盘
  for (let i = 0; i < TD_RIDERS.length; i++) if (P1('Digit' + (i + 1)) && !TD.over && !TD.pauseMenu) tdPickCard(TD_RIDERS[i].id);
  if (P1('Escape')) {
    if (TD.over) { /* 结算界面 Esc = 返回 */ tdExit(); return; }
    else if (TD.pickCard || TD.pickRider) { TD.pickCard = null; TD.pickRider = null; }
    else TD.pauseMenu = !TD.pauseMenu;
  }
  if (P1('KeyF') && !TD.over) TD.spd = TD.spd === 1 ? 2 : 1;
  if ((P1('Space') || P1('Enter')) && !TD.over && !TD.pauseMenu) tdCallNext();
  if (P1('KeyU') && TD.pickRider) tdUpgrade(TD.pickRider);
  if (P1('KeyX') && TD.pickRider) tdSell(TD.pickRider);
  if (TD.toastT > 0) TD.toastT -= dt;
  if (TD.pauseMenu || TD.over) { if (TD.over) TD.over.t += dt; return; }

  const d = dt * TD.spd;
  TD.t += d;
  TD.energy += TD_EN_RATE * d;
  for (const k in TD.cardCd) if (TD.cardCd[k] > 0) TD.cardCd[k] -= d;

  // 波次推进
  if (TD.phase === 'prep') {
    TD.timer -= d;
    if (TD.timer <= 0) tdStartWave();
  } else if (TD.phase === 'run') {
    TD.waveT += d;
    while (TD.queue.length && TD.queue[0].t <= TD.waveT) tdSpawn(TD.queue.shift());
    const alive = TD.enemies.some(e => !e.dead);
    if (!TD.queue.length) {
      if (TD.wave >= TD_WAVES) { if (!alive) tdFinish(true); }
      else if (!alive || TD.waveT > TD.span + 18) { TD.phase = 'prep'; TD.timer = alive ? 2 : 6; }
    }
  }

  // 天降能量胶囊
  TD.orbT -= d;
  if (TD.orbT <= 0) {
    TD.orbT = 7 + Math.random() * 4;
    const x = TD_X0 + 40 + Math.random() * (TD_COLS * TD_CW - 80), ty = TD_Y0 + 40 + Math.random() * (TD_ROWS * TD_RH - 70);
    TD.orbs.push({ x, y: TD_Y0 - 30, ty, life: 9, v: 25 });
  }
  for (const o of TD.orbs) { o.y = Math.min(o.ty, o.y + 90 * d); o.life -= d; }
  TD.orbs = TD.orbs.filter(o => o.life > 0);

  // 骑士
  for (const o of TD.riders) {
    o.born += d; o.flash = Math.max(0, o.flash - d);
    o.at = Math.max(0, o.at - d);
    o.cd -= d;
    if (o.cd <= 0 && !tdFire(o, d)) o.cd = 0;
  }

  // 敌人
  for (const e of TD.enemies) {
    if (e.dead) continue;
    e.fl = Math.max(0, e.fl - d);
    if (e.burn > 0) { e.burn -= d; tdHurt(e, e.burnD * d); if (e.burn <= 0) e.burnD = 0; }
    if (e.dead) continue;
    e.slow = Math.max(0, e.slow - d); e.stun = Math.max(0, e.stun - d);
    // 是否被骑士挡住
    let blocker = null;
    for (const o of TD.riders) {
      if (o.row !== e.row) continue;
      const cx = tdColX(o.col), dx = e.x - cx;
      if (dx < 38 && dx > -30 && (!blocker || cx > tdColX(blocker.col))) blocker = o;
    }
    e.eat = blocker;
    if (e.stun > 0) continue;
    if (blocker) {
      blocker.hp -= e.dps * d; blocker.flash = .12;
      if (blocker.hp <= 0) {
        tdFx({ k: 'ring', x: tdColX(blocker.col), y: tdRowY(blocker.row) - 40, r: 70, col: '#ff6b6b', t: .4 });
        TD.riders.splice(TD.riders.indexOf(blocker), 1);
        if (TD.pickRider === blocker) TD.pickRider = null;
      }
    } else {
      e.x -= e.spd * (e.slow > 0 ? .5 : 1) * d;
      e.ph += d * 6;
    }
    // 冲到防线
    if (e.x < TD_X0 - 6) {
      const b = TD.bikes[e.row];
      if (b && b.st === 'idle') { b.st = 'run'; }
      else if (!b || b.st === 'used') {
        e.dead = true; e.leak = true;
        const dmg = e.t === 'boss' ? 5 : 1;
        TD.baseHp -= dmg; TD.leaks += dmg; shake = 10;
        tdFx({ k: 'txt', x: 130, y: tdRowY(e.row) - 70, s: '基地受损 -' + dmg, col: '#ff6b6b', t: 1 });
        if (TD.baseHp <= 0) { TD.baseHp = 0; tdFinish(false); }
      }
    }
  }
  // 机车
  for (const b of TD.bikes) {
    if (b.st !== 'run') continue;
    b.x += 760 * d;
    for (const e of TD.enemies) if (!e.dead && e.row === b.row && e.x < b.x + 30) tdHurt(e, 99999);
    if (b.x > 1010) b.st = 'used';
  }
  TD.enemies = TD.enemies.filter(e => !e.dead);

  // 弹道
  for (const s of TD.shots) {
    s.x += s.vx * d; s.life -= d;
    for (const e of TD.enemies) {
      if (e.dead || e.row !== s.row || s.hit.has(e) || Math.abs(e.x - s.x) > 28) continue;
      s.hit.add(e);
      tdHurt(e, s.dmg, s.burn ? { burn: s.burn } : null);
      if (s.k === 'fire' && s.aoe) {
        for (const e2 of TD.enemies) if (e2 !== e && Math.abs(e2.row - s.row) <= 1 && Math.abs(e2.x - s.x) < TD_CW * 1.2) tdHurt(e2, s.dmg * .6, { burn: s.burn });
        tdFx({ k: 'ring', x: s.x, y: s.y, r: 110, col: '#ff9f43', t: .4 });
      } else tdFx({ k: 'ring', x: s.x, y: s.y, r: 26, col: s.col, t: .2 });
      if (!s.pierce) { s.life = 0; break; }
    }
  }
  TD.shots = TD.shots.filter(s => s.life > 0 && s.x < 1040);

  for (const f of TD.fx) f.t -= d;
  TD.fx = TD.fx.filter(f => f.t > 0);
  shake = Math.max(0, shake - 30 * dt);
}

function tdStartWave() {
  TD.wave++;
  const w = tdMakeWave(TD.cfg, TD.wave);
  TD.queue = w.list; TD.span = w.span; TD.waveT = 0; TD.phase = 'run';
  tdFx({ k: 'banner', s: TD.wave >= TD_WAVES ? '⚠ 最终波 · 首领来袭 ⚠' : '第 ' + TD.wave + ' 波', col: TD.wave >= TD_WAVES ? '#ff4757' : '#ffd84a', t: 1.6 });
}
function tdCallNext() {   // 提前呼叫下一波（准备阶段才可用，给一点能量作为奖励）
  if (TD.phase !== 'prep' || TD.over) return;
  if (TD.wave === 0 || TD.timer > 2.5) TD.energy += 25;
  tdStartWave();
}
function tdSpawn(q) {
  const b = TD_ET[q.type], c = TD.cfg;
  const hpw = 1 + (TD.wave - 1) * .09, hp = b.hp * c.hpMul * hpw;
  const pool = (ENS[c.set] && ENS[c.set][q.type] && ENS[c.set][q.type].length) ? ENS[c.set][q.type] : (EN && EN[q.type]) || [];
  const im = pool.length ? pool[(Math.random() * pool.length) | 0] : null;
  TD.enemies.push({
    t: q.type, row: q.row, x: TD_SPAWN_X + Math.random() * 30, hp, mh: hp, spd: b.spd * (.9 + Math.random() * .2), dps: b.dps * c.dpsMul, er: b.er, h: b.h,
    im, slow: 0, stun: 0, burn: 0, burnD: 0, fl: 0, ph: Math.random() * 6, dead: false, eat: null
  });
}

// ---------- 结算 ----------
function tdFinish(win) {
  if (TD.over) return;
  const c = TD.cfg, D = tdData();
  let stars = 0, gold = 0, diam = 0, shard = 0, first = false, newStars = 0;
  if (win) {
    stars = TD.leaks === 0 ? 3 : TD.baseHp >= 6 ? 2 : 1;
    gold = c.gold;
    first = TD.L >= D.best;
    if (first) { D.best = TD.L + 1; diam += c.diam; shard += c.shard; }
    const old = D.stars[TD.L] | 0;
    if (stars > old) { newStars = stars - old; D.stars[TD.L] = stars; diam += newStars * 20; }
  } else {
    gold = Math.round(c.gold * .3 * Math.max(0, TD.wave - 1) / TD_WAVES);
  }
  S.g += gold; psGold(gold);
  if (diam) { S.d += diam; psDia(diam); }
  if (shard) S.csh = (S.csh | 0) + shard;
  save();
  TD.over = { win, stars, gold, diam, shard, first, t: 0 };
}

// ---------- 输入 ----------
function tdPickCard(id) {
  const d = TD_BY[id];
  if (!d) return;
  if (!tdUsable(d)) return tdToast('尚未拥有 ' + d.name + ' 胶囊');
  TD.pickCard = TD.pickCard === id ? null : id; TD.pickRider = null;
}
function tdClick(x, y) {
  for (let i = TD.hits.length - 1; i >= 0; i--) {
    const r = TD.hits[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { r.f(); return; }
  }
  if (TD.over || TD.pauseMenu) return;
  // 能量胶囊
  for (let i = TD.orbs.length - 1; i >= 0; i--) {
    const o = TD.orbs[i];
    if ((x - o.x) ** 2 + (y - o.y) ** 2 < 32 * 32) {
      TD.energy += o.v; TD.orbs.splice(i, 1);
      tdFx({ k: 'txt', x: o.x, y: o.y - 20, s: '+' + o.v, col: '#7df9ff', t: .7 });
      return;
    }
  }
  // 场地
  const c = Math.floor((x - TD_X0) / TD_CW), r = Math.floor((y - TD_Y0) / TD_RH);
  if (c >= 0 && c < TD_COLS && r >= 0 && r < TD_ROWS) {
    const o = TD.riders.find(o => o.row === r && o.col === c);
    if (TD.pickCard) { if (!o) tdPlace(TD.pickCard, r, c); else { TD.pickCard = null; TD.pickRider = o; } }
    else TD.pickRider = o || null;
    return;
  }
  TD.pickRider = null;
}
(function () {
  const cv0 = document.getElementById('c');
  if (!cv0) return;
  cv0.addEventListener('pointermove', e => {
    const r = cv0.getBoundingClientRect();
    TD.mouse.x = (e.clientX - r.left) / r.width * 960; TD.mouse.y = (e.clientY - r.top) / r.height * 540;
  });
})();

// ---------- 绘制：骑士精灵 ----------
function tdSheets(id) {
  try {
    switch (id) {
      case 'malaya': return { idle: SH.run, atk: SH.atk, seq: [3, 4, 5, 6, 7, 8] };
      case 'ryuki': return { idle: SHR.run, atk: SHR.atk, seq: [1, 3, 4, 5, 6, 8] };
      case '555': return { idle: SH5.run, atk: SH5.atk, seq: (typeof FAIZ_ATK_SEQ !== 'undefined') ? FAIZ_ATK_SEQ : [1, 3, 4, 5, 6, 8] };
      case 'blade': return { idle: SH6.run, atk: SH6.atk, seq: (typeof BLADE_ATK_SEQ !== 'undefined') ? BLADE_ATK_SEQ : [1, 3, 4, 5, 6, 7, 8] };
      case 'zeztz': return { idle: SHZ.run, atk: SHZ.atk, seq: [1, 3, 4, 5, 6, 8] };
    }
  } catch (e) { }
  return null;
}
function tdBlit(Sx, i, cx, fy, k, fl) {
  if (!Sx || !Sx.f || !Sx.f.length) return false;
  i = Math.max(0, Math.min(Sx.f.length - 1, i | 0));
  const fr = Sx.f[i];
  if (!fr) return false;
  let b = null;
  if (typeof bb === 'function') { if (!Sx.bbs) Sx.bbs = []; b = Sx.bbs[i] || (Sx.bbs[i] = bb(fr)); }
  const s = (Sx.s || 1) * k;
  ctx.save(); ctx.translate(sn(cx), sn(fy)); ctx.scale(s * fl, s);
  ctx.drawImage(fr, b ? -(b.x0 + b.x1) / 2 : -fr.width / 2, b ? -b.y1 : -fr.height);
  ctx.restore();
  return true;
}
// at = 0~1 的出手进度（0 = 待机）
function tdDrawRider(d, cx, fy, k, at) {
  const sh = tdSheets(d.id), fl = TD_FLIP[d.id] || 1;
  let ok = false;
  if (sh) {
    if (at > 0 && sh.atk && sh.atk.f && sh.atk.f.length) ok = tdBlit(sh.atk, sh.seq[Math.min(sh.seq.length - 1, (at * sh.seq.length) | 0)], cx, fy, k, fl);
    else ok = tdBlit(sh.idle, 0, cx, fy, k, fl);
  }
  if (!ok) {   // 素材没加载到：用色块代替
    ctx.save(); ctx.fillStyle = d.col + '99'; ctx.strokeStyle = d.col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, fy - 50 * k * 2, 26 * k * 2, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore();
    txt(d.name[0], cx, fy - 100 * k, 22 * k * 2, '#fff', 'center');
  }
}

// ---------- 绘制：场地 ----------
function tdBtn(x, y, w, h, label, o, f) {
  o = o || {}; const c = o.c || '#00e5ff';
  const ty = y + h / 2 - (String(label).includes('\n') ? (o.sz || 12) * .66 : 0);
  poBevel(x, y, w, h, o.cr || 6);
  if (o.dis) { ctx.fillStyle = 'rgba(25,32,48,.75)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 1; ctx.stroke(); txt(label, x + w / 2, ty, o.sz || 12, '#6a788c', 'center', false); }
  else if (o.ghost) { ctx.fillStyle = c + '22'; ctx.fill(); ctx.strokeStyle = c; ctx.lineWidth = 1.2; ctx.stroke(); txt(label, x + w / 2, ty, o.sz || 12, '#fff', 'center', false); }
  else { const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, c); g.addColorStop(1, c + 'aa'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke(); txt(label, x + w / 2, ty, o.sz || 12, '#fff', 'center', false); }
  if (f && !o.dis) TD.hits.push({ x, y, w, h, f });
  else if (o.dis && o.f) TD.hits.push({ x, y, w, h, f: o.f });
}

function tdDrawEnemy(e) {
  const y = tdRowY(e.row) + 4, b = Math.sin(e.ph) * (e.eat || e.stun > 0 ? 0 : 2);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(e.x, y, e.h * .28, 6, 0, 0, 7); ctx.fill();
  if (e.im && e.im.width) {
    const k = Math.min(e.h / e.im.height, (e.h * 1.3) / e.im.width), w = e.im.width * k, h = e.im.height * k;
    ctx.translate(sn(e.x), sn(y + b)); ctx.scale(-1, 1);
    if (e.fl > 0) ctx.filter = 'brightness(2.4)';
    else if (e.slow > 0) ctx.filter = 'hue-rotate(160deg) saturate(1.3)';
    else if (e.burn > 0) ctx.filter = 'brightness(1.2) saturate(1.8) hue-rotate(-25deg)';
    ctx.drawImage(e.im, -w / 2, -h, w, h);
  } else {
    ctx.fillStyle = e.t === 'boss' ? '#ff4757' : e.t === 'wd' ? '#c9a0ff' : '#4cd0ff';
    ctx.beginPath(); ctx.arc(e.x, y - e.h / 2, e.h / 2.4, 0, 7); ctx.fill();
  }
  ctx.restore();
  if (e.stun > 0) txt('💫', e.x, y - e.h - 8, 16, '#fff', 'center', false);
  if (e.hp < e.mh || e.t === 'boss') {
    const w = e.t === 'boss' ? 90 : 44;
    bar(e.x - w / 2, y - e.h - 14, w, 5, Math.max(0, e.hp), e.mh, e.t === 'boss' ? '#ff4757' : '#ff6b6b', e.t === 'boss' ? '#ff9f43' : null, 3);
  }
}

function tdDrawField() {
  const c = TD.cfg;
  const im = SC_MAP[c.set] || SC;
  if (im && im.width) ctx.drawImage(im, 0, 0, 960, 540); else { ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, 960, 540); }
  ctx.fillStyle = 'rgba(4,6,14,.58)'; ctx.fillRect(0, 0, 960, 540);
  // 车道
  for (let r = 0; r < TD_ROWS; r++) for (let col = 0; col < TD_COLS; col++) {
    const x = TD_X0 + col * TD_CW, y = TD_Y0 + r * TD_RH;
    ctx.fillStyle = (r + col) % 2 ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.03)';
    ctx.fillRect(x, y, TD_CW, TD_RH);
  }
  ctx.strokeStyle = c.col + '66'; ctx.lineWidth = 1;
  for (let r = 0; r <= TD_ROWS; r++) { ctx.beginPath(); ctx.moveTo(TD_X0, TD_Y0 + r * TD_RH); ctx.lineTo(TD_X0 + TD_COLS * TD_CW, TD_Y0 + r * TD_RH); ctx.stroke(); }
  // 基地防线
  const g = ctx.createLinearGradient(TD_X0 - 40, 0, TD_X0, 0); g.addColorStop(0, 'rgba(0,229,255,0)'); g.addColorStop(1, 'rgba(0,229,255,.28)');
  ctx.fillStyle = g; ctx.fillRect(TD_X0 - 40, TD_Y0, 40, TD_ROWS * TD_RH);
  ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(TD_X0, TD_Y0); ctx.lineTo(TD_X0, TD_Y0 + TD_ROWS * TD_RH); ctx.stroke();
  // 机车
  for (const b of TD.bikes) {
    if (b.st === 'used') continue;
    const y = tdRowY(b.row) + 2;
    ctx.save(); ctx.translate(sn(b.x), sn(y));
    if (BK && BK.width) { const k = 54 / BK.width; ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = b.st === 'run' ? 18 : 6; ctx.scale(k, k); ctx.drawImage(BK, -BK.width / 2, -BK.height); }
    else { ctx.fillStyle = '#00e5ff'; ctx.fillRect(-24, -26, 48, 22); }
    ctx.restore();
    if (b.st === 'run') for (let i = 0; i < 4; i++) { ctx.fillStyle = 'rgba(120,240,255,' + (.45 - i * .1) + ')'; ctx.fillRect(b.x - 40 - i * 36, y - 30 - i * 3, 30, 3); }
  }
}

function tdDrawRidersAndEnemies() {
  for (let r = 0; r < TD_ROWS; r++) {
    for (const o of TD.riders) {
      if (o.row !== r) continue;
      const cx = tdColX(o.col), fy = tdRowY(r) + 4;
      const pop = Math.min(1, o.born / .25), kk = .56 * (.85 + .15 * pop);
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(cx, fy, 26, 7, 0, 0, 7); ctx.fill();
      ctx.shadowColor = o.d.col; ctx.shadowBlur = o.lv > 1 ? 10 + o.lv * 4 : 0;
      if (o.flash > 0) ctx.filter = 'brightness(1.6)';
      tdDrawRider(o.d, cx, fy, kk, o.at > 0 ? 1 - o.at / .5 : 0);
      ctx.restore();
      if (o.hp < o.mh) bar(cx - 24, fy - 126, 48, 5, o.hp, o.mh, '#2ed573', '#7dff9a', 3);
      if (o.lv > 1) txt('Lv.' + o.lv, cx, fy - 134, 11, '#ffd84a', 'center');
      if (TD.pickRider === o) { ctx.save(); ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.strokeRect(TD_X0 + o.col * TD_CW + 2, TD_Y0 + r * TD_RH + 2, TD_CW - 4, TD_RH - 4); ctx.restore(); }
    }
    for (const e of TD.enemies) if (e.row === r) tdDrawEnemy(e);
  }
}

function tdDrawShots() {
  for (const s of TD.shots) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (s.k === 'bullet') {
      ctx.strokeStyle = s.col; ctx.lineWidth = s.big ? 5 : 3; ctx.shadowColor = s.col; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(s.x - 30, s.y); ctx.lineTo(s.x, s.y); ctx.stroke();
    } else if (s.k === 'fire') {
      const g = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, 20); g.addColorStop(0, '#fff3a0'); g.addColorStop(.5, '#ff9f43'); g.addColorStop(1, 'rgba(255,71,87,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, s.aoe ? 26 : 20, 0, 7); ctx.fill();
    } else if (s.k === 'wave') {
      ctx.strokeStyle = s.col; ctx.lineWidth = 6; ctx.shadowColor = s.col; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(s.x - 30, s.y + 10, 60, -.9, .9); ctx.stroke();
    }
    ctx.restore();
  }
}

function tdDrawFx() {
  for (const f of TD.fx) {
    const p = f.t / f.d;
    ctx.save();
    if (f.k === 'ring') {
      ctx.globalAlpha = p; ctx.strokeStyle = f.col; ctx.lineWidth = 4 * p + 1; ctx.shadowColor = f.col; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 - p * .7), 0, 7); ctx.stroke();
    } else if (f.k === 'slash') {
      ctx.globalAlpha = p; ctx.strokeStyle = f.col; ctx.lineWidth = 8 * p; ctx.shadowColor = f.col; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(f.x - 40, f.y, f.r, -.8, .8); ctx.stroke();
    } else if (f.k === 'bolt') {
      ctx.globalAlpha = Math.min(1, p * 1.6); ctx.strokeStyle = f.col; ctx.lineWidth = 3; ctx.shadowColor = '#3aa0ff'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.moveTo(f.x0, f.y0);
      const n = 7;
      for (let i = 1; i <= n; i++) {
        const t = i / n, jx = (Math.sin(f.seed + i * 9.1) * 18) * (i < n ? 1 : 0);
        ctx.lineTo(f.x0 + (f.x1 - f.x0) * t * .35 + jx + (f.x1 - f.x0) * (t > .6 ? (t - .6) * 1.6 : 0), f.y0 + (f.y1 - f.y0) * t);
      }
      ctx.stroke();
    } else if (f.k === 'txt') {
      ctx.globalAlpha = Math.min(1, p * 2); txt(f.s, f.x, f.y - (1 - p) * 30, 16, f.col, 'center');
    } else if (f.k === 'banner') {
      const a = p > .85 ? (1 - p) / .15 : p < .2 ? p / .2 : 1;
      ctx.globalAlpha = Math.max(0, Math.min(1, a));
      ctx.fillStyle = 'rgba(4,8,18,.7)'; ctx.fillRect(0, 196, 960, 62);
      txt(f.s, 480, 227, 30, f.col, 'center');
    }
    ctx.restore();
  }
  for (const o of TD.orbs) {
    const b = Math.sin(T * 5 + o.x) * 3;
    ctx.save(); ctx.globalAlpha = o.life < 2 ? (T * 10 | 0) % 2 ? .4 : 1 : 1;
    const g = ctx.createRadialGradient(o.x, o.y + b, 2, o.x, o.y + b, 22); g.addColorStop(0, '#fff'); g.addColorStop(.4, '#4fe3ff'); g.addColorStop(1, 'rgba(0,229,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.x, o.y + b, 22, 0, 7); ctx.fill();
    txt('⚡', o.x, o.y + b, 15, '#fff', 'center', false);
    ctx.restore();
  }
}

// ---------- 绘制：HUD ----------
function tdDrawHud() {
  const c = TD.cfg;
  ctx.fillStyle = 'rgba(4,8,18,.82)'; ctx.fillRect(0, 0, 960, 50);
  ctx.fillStyle = TD_COL; ctx.fillRect(0, 49, 960, 2);
  txt(c.name + ' · ' + c.sub.split('·')[0].trim(), 14, 16, 13, c.col);
  // 基地血量
  txt('基地', 14, 36, 11, '#9fb0c6');
  bar(48, 31, 110, 10, TD.baseHp, TD_BASE_HP, '#2ed573', '#7dff9a', 5);
  txt(TD.baseHp + '/' + TD_BASE_HP, 103, 36, 9.5, '#fff', 'center', false);
  // 能量
  poBevel(180, 8, 130, 34, 6); ctx.fillStyle = 'rgba(0,229,255,.14)'; ctx.fill(); ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 1.2; ctx.stroke();
  txt('⚡', 196, 25, 18, '#fff', 'center', false);
  txt(String(Math.floor(TD.energy)), 214, 25, 19, '#7df9ff');
  txt('契约能量', 296, 25, 9.5, '#7a92aa', 'right', false);
  // 波次
  const wl = TD.wave === 0 ? '准备中' : '第 ' + TD.wave + ' / ' + TD_WAVES + ' 波';
  txt(wl, 400, 16, 15, '#ffd84a', 'center');
  const total = TD_WAVES, prog = TD.wave - (TD.phase === 'run' ? 1 : 0) + (TD.phase === 'run' && TD.queue.length === 0 ? 1 : 0);
  bar(340, 31, 120, 8, Math.max(0, Math.min(total, prog)), total, '#ffd84a', '#ff9f43', 4);
  // 控制键
  tdBtn(580, 9, 70, 32, TD.spd === 2 ? '⏩ ×2' : '▶ ×1', { c: TD_COL, ghost: TD.spd !== 2, sz: 13 }, () => { TD.spd = TD.spd === 1 ? 2 : 1; });
  tdBtn(660, 9, 70, 32, '⏸ 暂停', { c: '#00e5ff', ghost: true, sz: 12.5 }, () => { TD.pauseMenu = true; });
  if (TD.phase === 'prep' && !TD.over) {
    const lab = TD.wave === 0 ? '▶ 开始首波 (' + Math.ceil(TD.timer) + 's)' : '▶ 呼叫下一波 (' + Math.ceil(TD.timer) + 's)';
    tdBtn(740, 9, 206, 32, lab, { c: '#2ed573', sz: 12.5 }, tdCallNext);
  } else txt(TD.phase === 'run' ? '击杀 ' + TD.kills : '', 940, 25, 12, '#9fb0c6', 'right');
}

function tdDrawBottom() {
  ctx.fillStyle = 'rgba(4,8,18,.9)'; ctx.fillRect(0, 462, 960, 78);
  ctx.fillStyle = TD_COL + '88'; ctx.fillRect(0, 462, 960, 1.5);
  TD_RIDERS.forEach((d, i) => {
    const x = 12 + i * 100, y = 468, w = 94, h = 66;
    const usable = tdUsable(d), cost = tdCost(d), cd = TD.cardCd[d.id] || 0, can = TD.energy >= cost && cd <= 0 && usable, sel = TD.pickCard === d.id;
    poBevel(x, y, w, h, 8);
    const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, d.col + (sel ? '66' : '2a')); g.addColorStop(1, 'rgba(8,12,24,.95)');
    ctx.fillStyle = g; ctx.fill();
    if (sel) { ctx.save(); ctx.shadowColor = d.col; ctx.shadowBlur = 12; ctx.lineWidth = 2; ctx.strokeStyle = d.col; ctx.stroke(); ctx.restore(); }
    else { ctx.lineWidth = 1.2; ctx.strokeStyle = d.col + (can ? 'cc' : '55'); ctx.stroke(); }
    ctx.save(); poBevel(x, y, w, h, 8); ctx.clip();
    ctx.globalAlpha = can ? 1 : .45;
    tdDrawRider(d, x + 28, y + 56, .26, 0);
    ctx.restore();
    txt(d.name, x + w - 6, y + 14, 12, '#fff', 'right');
    txt('⚡' + cost, x + w - 6, y + 52, 13, can ? '#7df9ff' : (usable ? '#ff8a95' : '#778'), 'right');
    txt(String(i + 1), x + 6, y + 10, 9.5, '#8a97aa', 'left', false);
    if (!tdOwned(d)) txt(usable ? '借调' : '🔒', x + w - 6, y + 32, 10, usable ? '#ffa502' : '#778', 'right');
    if (cd > 0) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x + 2, y + 2 + (h - 4) * (1 - cd / d.cdc), w - 4, (h - 4) * (cd / d.cdc)); txt(cd.toFixed(1), x + w / 2, y + h / 2, 16, '#fff', 'center'); }
    TD.hits.push({ x, y, w, h, f: () => tdPickCard(d.id) });
  });

  // 右侧：选中的骑士信息 / 操作提示
  const px = 530, py = 468, pw = 418, ph = 66;
  poBevel(px, py, pw, ph, 8); ctx.fillStyle = 'rgba(12,20,38,.9)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1; ctx.stroke();
  const o = TD.pickRider, pc = TD.pickCard && TD_BY[TD.pickCard];
  if (o) {
    const d = o.d;
    txt(d.name + '  Lv.' + o.lv + (o.lv >= 3 ? ' (满级)' : ''), px + 12, py + 15, 14, d.col);
    txt('伤害 ' + Math.round(tdDmg(d, o.lv)) + '   生命 ' + Math.round(o.hp) + '/' + Math.round(o.mh) + '   射程 ' + d.rng + ' 格', px + 12, py + 36, 11, '#c9d4e6');
    txt(d.desc, px + 12, py + 54, 10.5, '#8a97aa');
    const uc = o.lv >= 3 ? 0 : tdUpCost(d, o.lv);
    tdBtn(px + pw - 196, py + 10, 90, 46, o.lv >= 3 ? '已满级' : '升级\n⚡' + uc, { c: '#ffd84a', dis: o.lv >= 3 || TD.energy < uc, sz: 12, f: null }, () => tdUpgrade(o));
    tdBtn(px + pw - 98, py + 10, 86, 46, '出售\n+' + Math.round(o.spent * .6), { c: '#ff4757', ghost: true, sz: 12 }, () => tdSell(o));
  } else if (pc) {
    txt('部署 ' + pc.name + '：点击场上空格子', px + 12, py + 18, 14, pc.col);
    txt(pc.desc, px + 12, py + 40, 11, '#c9d4e6');
    txt('再次点击卡牌 / Esc 取消', px + 12, py + 56, 10.5, '#8a97aa');
  } else {
    txt('选择下方骑士卡牌（或按 1~5），点击空格子部署', px + 12, py + 18, 12.5, '#c9d4e6');
    txt('点击场上骑士可升级 / 出售 · 点天降的 ⚡ 胶囊收集能量', px + 12, py + 38, 11, '#9fb0c6');
    txt('Space 呼叫下一波   F 切换倍速   Esc 暂停', px + 12, py + 56, 10.5, '#8a97aa');
  }
}

function tdDrawHover() {
  if (!TD.pickCard || TD.over || TD.pauseMenu) return;
  const m = TD.mouse, c = Math.floor((m.x - TD_X0) / TD_CW), r = Math.floor((m.y - TD_Y0) / TD_RH);
  if (c < 0 || c >= TD_COLS || r < 0 || r >= TD_ROWS) return;
  const d = TD_BY[TD.pickCard], busy = TD.riders.some(o => o.row === r && o.col === c);
  ctx.save();
  ctx.fillStyle = busy ? 'rgba(255,71,87,.18)' : d.col + '22'; ctx.fillRect(TD_X0 + c * TD_CW, TD_Y0 + r * TD_RH, TD_CW, TD_RH);
  if (!busy) {
    ctx.globalAlpha = .55; tdDrawRider(d, tdColX(c), tdRowY(r) + 4, .56, 0);
    ctx.globalAlpha = .35; ctx.fillStyle = d.col; ctx.fillRect(tdColX(c), tdRowY(r) - 30, d.rng * TD_CW, 3);
  }
  ctx.restore();
}

function tdDrawOverlay() {
  if (TD.pauseMenu) {
    ctx.fillStyle = 'rgba(2,4,10,.78)'; ctx.fillRect(0, 0, 960, 540);
    const w = 340, h = 270, x = 480 - w / 2, y = 135;
    poBevel(x, y, w, h, 14); ctx.fillStyle = '#0a1224'; ctx.fill(); ctx.strokeStyle = TD_COL; ctx.lineWidth = 2; ctx.stroke();
    txt('⏸ 暂停', 480, y + 34, 22, '#fff', 'center');
    tdBtn(x + 40, y + 70, w - 80, 40, '▶ 继续战斗', { c: '#2ed573', sz: 14 }, () => { TD.pauseMenu = false; });
    tdBtn(x + 40, y + 120, w - 80, 40, '↻ 重新开始本关', { c: '#00e5ff', ghost: true, sz: 13 }, () => tdStart(TD.L));
    tdBtn(x + 40, y + 170, w - 80, 40, '← 退出到传送门', { c: '#ff4757', ghost: true, sz: 13 }, () => tdExit());
    txt('中途退出不会获得奖励', 480, y + 235, 11, '#7a8fa6', 'center');
    return;
  }
  const o = TD.over;
  if (!o) return;
  const a = Math.min(1, o.t * 2.5);
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(2,4,10,.82)'; ctx.fillRect(0, 0, 960, 540);
  const w = 480, h = 330, x = 480 - w / 2, y = 105, col = o.win ? '#ffd84a' : '#ff4757';
  poBevel(x, y, w, h, 16); ctx.fillStyle = '#0a1224'; ctx.fill();
  ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 18; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  txt(o.win ? '防线守住了！' : '防线被突破…', 480, y + 36, 28, col, 'center');
  txt(TD.cfg.name + ' · 击杀 ' + TD.kills + ' · 基地剩余 ' + TD.baseHp + '/' + TD_BASE_HP, 480, y + 68, 12, '#9fb0c6', 'center');
  if (o.win) for (let i = 0; i < 3; i++) txt(i < o.stars ? '⭐' : '☆', 480 + (i - 1) * 46, y + 108, 34, i < o.stars ? '#ffd84a' : 'rgba(255,255,255,.3)', 'center', false);
  else txt('坚持到第 ' + TD.wave + ' 波', 480, y + 108, 18, '#ff8a95', 'center');
  const rows = [['🪙 金币', '+' + o.gold.toLocaleString(), '#ffd84a']];
  if (o.diam) rows.push(['💎 钻石' + (o.first ? '（首通）' : '（新星级）'), '+' + o.diam, '#4fe3ff']);
  if (o.shard) rows.push(['🔮 契约碎片', '+' + o.shard, '#c79bff']);
  if (o.win && !o.first && !o.diam) rows.push(['提示', '提升星级可再获钻石', '#8a97aa']);
  rows.forEach((r, i) => { txt(r[0], x + 90, y + 152 + i * 26, 14, '#c9d4e6'); txt(r[1], x + w - 90, y + 152 + i * 26, 15, r[2], 'right'); });
  const by = y + h - 62;
  tdBtn(x + 24, by, 130, 40, '↻ 再来一次', { c: '#00e5ff', ghost: true, sz: 13 }, () => tdStart(TD.L));
  if (o.win && TD.L < TD_LEVELS - 1) tdBtn(x + 170, by, 140, 40, '下一关 ▶', { c: '#2ed573', sz: 14 }, () => tdStart(TD.L + 1));
  tdBtn(x + w - 154, by, 130, 40, '← 返回传送门', { c: '#ff4757', ghost: true, sz: 12.5 }, () => tdExit());
  ctx.restore();
}

function tdDraw() {
  TD.hits = [];
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
  tdDrawField();
  tdDrawHover();
  tdDrawRidersAndEnemies();
  tdDrawShots();
  tdDrawFx();
  ctx.restore();
  tdDrawHud();
  tdDrawBottom();
  if (TD.toastT > 0) {
    const w = tw(TD.toast, 13) + 36;
    ctx.save(); ctx.globalAlpha = Math.min(1, TD.toastT * 2);
    pPill(480 - w / 2, 428, w, 24, 'rgba(10,12,22,.96)', '#ffd84a'); txt(TD.toast, 480, 440, 13, '#ffd84a', 'center');
    ctx.restore();
  }
  if (TD.pauseMenu || TD.over) TD.hits = [];   // 弹窗期间，下层按钮不响应
  tdDrawOverlay();
}

// ---------- 传送门里的「骑士防线」页 ----------
function towerDefPortalUpdate(L, R, U, D, OK) {
  PO.td = cl(PO.td | 0, 0, TD_LEVELS - 1);
  if (U || L) PO.td = Math.max(0, PO.td - 1);
  if (D || R) PO.td = Math.min(Math.min(TD_LEVELS - 1, tdBest()), PO.td + 1);
  if (OK) tdStart(PO.td);
}

function drawPoTD() {
  const col = TD_COL, sel = PO.td = cl(PO.td | 0, 0, TD_LEVELS - 1), cfg = tdCfg(sel), open = tdOpen(sel);
  poFrame(col, '🛡 骑士防线 · 塔防守卫');

  // ---- 左：关卡列表 ----
  const lx = POX + 24, ly = 84, lw = 270, lh = 354;
  rpath(lx, ly, lw, lh, 16);
  const g = ctx.createLinearGradient(lx, ly, lx + lw, ly + lh); g.addColorStop(0, col + '26'); g.addColorStop(.5, 'rgba(12,16,32,.92)'); g.addColorStop(1, 'rgba(8,10,22,.95)');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = col + '66'; ctx.stroke();
  for (let i = 0; i < TD_LEVELS; i++) {
    const c = tdCfg(i), y = ly + 10 + i * 34, un = tdOpen(i), on = i === sel, st = tdStarOf(i);
    rpath(lx + 10, y, lw - 20, 30, 8);
    ctx.fillStyle = on ? c.col + '40' : 'rgba(255,255,255,.04)'; ctx.fill();
    ctx.lineWidth = on ? 1.6 : 1; ctx.strokeStyle = on ? c.col : 'rgba(255,255,255,.1)'; ctx.stroke();
    txt(String(i + 1).padStart(2, '0'), lx + 28, y + 15, 12, un ? c.col : '#5d6b80', 'center');
    txt(c.name, lx + 48, y + 15, 13, un ? (on ? '#ffd84a' : '#fff') : '#667');
    if (!un) txt('🔒', lx + lw - 24, y + 15, 12, '#889', 'center', false);
    else for (let s = 0; s < 3; s++) txt(s < st ? '⭐' : '☆', lx + lw - 56 + s * 15, y + 15, 10.5, s < st ? '#ffd84a' : 'rgba(255,255,255,.25)', 'center', false);
    pHit(lx + 10, y, lw - 20, 30, () => { if (!un) pToast('请先通关上一关'); else if (on) tdStart(i); else PO.td = i; });
  }

  // ---- 右：详情 ----
  const dx = POX + 314, dy = 84, dw = POW - 314 - 24, dh = 354, rx = dx + 22;
  rpath(dx, dy, dw, dh, 16);
  const g2 = ctx.createLinearGradient(dx, dy, dx + dw, dy + dh); g2.addColorStop(0, cfg.col + '1c'); g2.addColorStop(.5, 'rgba(12,16,32,.92)'); g2.addColorStop(1, 'rgba(8,10,22,.95)');
  ctx.fillStyle = g2; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = col + '66'; ctx.stroke();

  txt('DEFENSE LINE ' + String(sel + 1).padStart(2, '0'), rx, dy + 20, 11, col);
  txt(cfg.name, rx, dy + 46, 24, '#ffd84a');
  txt(cfg.sub + ' · 首领「' + cfg.boss + '」', rx, dy + 70, 11.5, '#9fb0c6');

  // 敌人预览
  const pv = ['imp', 'wd', 'boss'];
  pv.forEach((t, i) => {
    const bx = dx + dw - 22 - (3 - i) * 74, by = dy + 16, pool = ENS[cfg.set] && ENS[cfg.set][t], im = pool && pool[0];
    rpath(bx, by, 66, 66, 10); ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fill(); ctx.strokeStyle = t === 'boss' ? '#ff6b6b88' : 'rgba(255,255,255,.12)'; ctx.stroke();
    if (im && im.width) { const k = Math.min(54 / im.height, 54 / im.width); ctx.drawImage(im, bx + 33 - im.width * k / 2, by + 60 - im.height * k, im.width * k, im.height * k); }
  });

  const stats = [
    ['波数', TD_WAVES + ' 波 · 末波首领', '#fff'],
    ['敌人强度', '×' + cfg.hpMul.toFixed(1) + ' 生命', '#ff8a95'],
    ['通关金币', poN(cfg.gold) + ' G', '#ffd84a'],
    ['首通钻石', tdBest() > sel ? '已领取' : '+' + cfg.diam, tdBest() > sel ? '#6f7f95' : '#4fe3ff'],
    ['契约碎片', cfg.shard ? (tdBest() > sel ? '已领取' : '+' + cfg.shard) : '—', cfg.shard && tdBest() <= sel ? '#c79bff' : '#6f7f95'],
    ['历史星级', tdStarOf(sel) ? tdStarOf(sel) + ' / 3 ★' : '—', '#ffd84a']
  ];
  stats.forEach((st, i) => {
    const sx = rx + (i % 3) * 168, sy = dy + 106 + (i / 3 | 0) * 50;
    rpath(sx - 6, sy - 14, 158, 42, 8); ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fill();
    txt(st[0], sx, sy, 11, '#8a97aa'); txt(st[1], sx, sy + 20, 14, st[2]);
  });

  // 出战骑士
  txt('出战骑士（拥有胶囊的骑士威力更强，胶囊星级也会加成）', rx, dy + 216, 11.5, '#c9d4e6');
  TD_RIDERS.forEach((d, i) => {
    const bx = rx + i * 96, by = dy + 228, w = 90, h = 84, own = tdOwned(d), ok = tdUsable(d);
    rpath(bx, by, w, h, 10); ctx.fillStyle = d.col + (own ? '22' : '0e'); ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = d.col + (own ? 'cc' : '44'); ctx.stroke();
    ctx.save(); rpath(bx, by, w, h, 10); ctx.clip(); ctx.globalAlpha = ok ? 1 : .35;
    tdDrawRider(d, bx + w / 2, by + 62, .28, 0); ctx.restore();
    txt(d.name, bx + w / 2, by + 11, 11.5, '#fff', 'center');
    const star = d.cap && typeof capStar === 'function' ? capStar(d.cap) : 0;
    txt(!d.cap ? '初始' : own ? (star ? '★' + star : '已拥有') : (ok ? '借调' : '🔒未拥有'), bx + w / 2, by + h - 8, 10, own ? '#7dff9a' : ok ? '#ffa502' : '#778', 'center');
  });
  txt(TD_NEED_CAP ? '未拥有胶囊的骑士无法出战，去扭蛋机抽取吧' : '未拥有胶囊的骑士可「借调」出战：造价 +25%，威力 ×0.8', rx, dy + 330, 10.5, '#8a97aa');

  poFooter(col, 'W/S 选择关卡   Enter 出征   首通 / 提升星级可获钻石', {
    label: open ? '🛡 出征第 ' + (sel + 1) + ' 关 [Enter]' : '🔒 请先通关上一关', c: col, dis: !open, f: () => tdStart(sel)
  });
}
