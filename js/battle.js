// ===== 战斗系统 =====
function begin(k) {
  cur = k; calc();
  Object.assign(P, { x: 300, y: GY, vx: 0, vy: 0, f: 1, hp: P.mh, mp: P.mm, st: 'trans', t: 0, inv: 0, land: 0, h: 0, hit: {}, sta: P.stm, dcd: 0, exh: false, spr: false, shDown: false, shT: 0, gt: 0, sreg: 0, slow: 0, psn: 0 });
  GH = []; P.cd.e = 0; E = []; PJ = []; EP = []; FX = []; DT = []; OR = []; HZ = []; TQ = [];
  kills = 0; bs = 0; sp = 1; RG = 0; cam = 0; G = 'play';
  if (ST[k].wb) { WBT = ST[k].tl; WBD = 0; WBM = 0; WBR = ''; }   // 世界BOSS：只有首领，限时
  else { spawn('imp'); spawn('imp'); } // 开场先来两只
}

function fin(w) {
  if (G !== 'play') return;
  G = w ? 'win' : 'over';
  const z = ST[cur];
  if (z.wb) {
    // 世界BOSS：按伤害占比结算金币，击杀额外 +50%；不影响章节进度
    const frac = Math.min(1, WBD / Math.max(1, WBM));
    FG = RG + Math.round(z.g * frac) + (w ? Math.round(z.g * .5) : 0);
    const W = wbData();
    const i = WB.findIndex(b => b.si === cur);
    W.best[i] = Math.max(W.best[i] || 0, WBD | 0);
    if (w) W.kills[i] = (W.kills[i] || 0) + 1;
  } else {
    FG = w ? RG + z.g : RG >> 1;
    if (w) S.cl = Math.max(S.cl, cur + 1);
  }
  S.g += FG;
  save();
}

function gain(n) {
  S.xp += n | 0;
  while (S.xp >= S.lv * 40) {
    S.xp -= S.lv * 40; S.lv++; S.tp++; calc();
    P.hp = P.mh; P.mp = P.mm;
    DT.push({ x: P.x, y: P.y - 210, s: 'LEVEL UP! +1天赋点', t: 1.5, c: '#7dff9a' });
  }
}

// 掉落装备：品质随机，获取等级紧密挂钩当前副本等级
function dropLoot(e) {
  const isBoss = e.t === 'boss';

  // 强化卷轴：小怪低概率，精英较高，BOSS 必掉 2~4 张
  let scr = 0;
  if (isBoss) scr = 2 + (Math.random() * 3 | 0) + (ST[cur].wb ? 3 : 0);
  else if (Math.random() < (e.t === 'wd' ? 0.14 : 0.05)) scr = 1;
  if (scr) {
    S.scr = (S.scr || 0) + scr; save();
    DT.push({ x: e.x, y: e.y - e.h - 65, s: '📜强化卷轴 ×' + scr, t: 2.2, c: '#ffa502' });
  }

  // 击杀数已翻倍，装备掉率相应下调
  const dropRate = isBoss ? 1.0 : (e.t === 'wd' ? 0.28 : 0.12);
  if (Math.random() > dropRate) return;

  let tr = 0;
  const r = Math.random();
  const d = Math.min(cur, 29);
  if (isBoss) {
    if (r < 0.16 + d * 0.05) tr = 5;
    else if (r < 0.52 + d * 0.05) tr = 4;
    else if (r < 0.88) tr = 3;
    else tr = 2;
  } else if (e.t === 'wd') {
    if (r < 0.03 + d * 0.02) tr = 4;
    else if (r < 0.18 + d * 0.04) tr = 3;
    else if (r < 0.55) tr = 2;
    else tr = 1;
  } else {
    if (r < 0.04) tr = 3;
    else if (r < 0.22) tr = 2;
    else if (r < 0.65) tr = 1;
    else tr = 0;
  }

  // 严格以当前关卡推荐等级 ST[cur].r 为上限：
  // BOSS 必出关卡推荐最高等级装备，小怪产出等于或略低于推荐等级，绝不超过推荐等级
  const recLvl = (ST[cur] && ST[cur].r) ? ST[cur].r : 1;
  const dropLvl = isBoss ? recLvl : Math.min(recLvl, Math.max(1, recLvl - (Math.random() < 0.4 ? 1 : 0)));

  const dropEq = genItem(null, tr, dropLvl);
  S.inv.push(dropEq);
  save();

  DT.push({
    x: e.x,
    y: e.y - e.h - 35,
    s: `💥掉落: [${TIERS[tr].n}] ${dropEq.name} (Lv.${dropEq.reqLvl})`,
    t: 2.4,
    c: TIERS[tr].c
  });
}

function hurt(e, d) {
  const c = Math.random() < P.cr;
  d = Math.round(d * (.9 + Math.random() * .2) * (c ? 2 : 1));
  if (e.t === 'boss' && ST[cur].wb) WBD += Math.max(0, Math.min(d, e.hp));
  e.hp -= d; e.fl = .12; e.x += P.f * (e.t === 'boss' ? 2 : 12);
  P.mp = Math.min(P.mm, P.mp + 3);
  DT.push({ x: e.x, y: e.y - e.h, s: d + (c ? '!' : ''), t: .8, c: c ? '#ff8a2a' : '#ffd84a' });
  shake = Math.max(shake, 4);

  if (e.hp <= 0 && !e.dead) {
    e.dead = 1; kills++; gain(ET[e.t].xp * (1 + Math.min(cur, 29) * .4)); RG += ET[e.t].g * (1 + Math.min(cur, 29) * .3) | 0;
    if (Math.random() < .35) OR.push({ x: e.x, k: Math.random() < .5 ? 'h' : 'm' });
    dropLoot(e);
    if (e.t === 'boss') fin(1);
    FX.push({ type: 'boss_death_blast', x: e.x, y: e.y - e.h / 2, t: .6, d: .6, r: e.t === 'boss' ? 220 : 70 });
  }
}

function area(x0, x1, dmg, set) {
  for (const e of E) {
    const w = e.w / 2;
    if (e.x + w > x0 && e.x - w < x1 && e.y > P.y - 160 && e.y - e.h < P.y && (!set || !set[e.id])) {
      if (set) set[e.id] = 1;
      hurt(e, dmg);
    }
  }
}

function hurtP(d) {
  if (P.inv > 0 || P.st === 'trans' || P.st === 'trans_ryuki' || G !== 'play') return;
  d = Math.max(1, Math.round(d * (1 - (P.def || 0))));
  P.hp -= d; P.inv = 1; shake = 10;
  DT.push({ x: P.x, y: P.y - 180, s: '-' + d, t: .8, c: '#ff6a6a' });
  if (P.hp <= 0) { P.hp = 0; fin(0) }
}

function spawn(t, ox) {
  const o = ET[t], z = ST[cur];
  const pool = (ENS[z.set] && ENS[z.set][t] && ENS[z.set][t].length) ? ENS[z.set][t] : EN[t];
  const c = pool[Math.random() * pool.length | 0], s = o.H / c.height, side = Math.random() < .5 ? -1 : 1, hp = o.hp * z.hm * (t === 'boss' && z.hpx ? z.hpx : 1) | 0;
  let x = ox !== undefined ? ox : P.x + side * (520 + Math.random() * 150);
  if (ox === undefined && (x < 60 || x > WW - 60)) x = P.x - side * 600;
  E.push({ id: ++uid, t, im: c, x: cl(x, 60, WW - 60), y: t === 'imp' ? 300 : GY, hp, mhp: hp, dm: o.dm * z.dm | 0, h: o.H, w: c.width * s, s, fl: 0,
    cd: t === 'boss' ? 2 : 1.5 + Math.random() * 2, hc: 0, fc: 1, wu: 0, dsh: 0, atk: '', last: '' });
  if (t === 'boss' && z.wb) WBM = hp;
}

// =====================================================================
//  怪物攻击系统：每章一套（见 config.js 的 ATK_SET）
//  流程：冷却结束 → 选招 → 前摇(闪红+惊叹号) → 出招
// =====================================================================
const BCOL = { 1: '#7dff5a', 2: '#ff3a10', 3: '#5352ed', 4: '#70a1ff', 5: '#2ed573', 6: '#ffa502', 7: '#a55eea', 8: '#ffd32a', 9: '#ff6348', 10: '#ff3838' };
const MCOL = { 1: '#4cd0ff', 2: '#ff9a00', 3: '#a29bfe', 4: '#74b9ff', 5: '#55efc4', 6: '#ffeaa7', 7: '#d6a2e8', 8: '#fff200', 9: '#ff7675', 10: '#ff4757' };

const ecol = e => { const s = ST[cur].set; return e.t === 'boss' ? (BCOL[s] || '#ff3a10') : (MCOL[s] || '#4cd0ff') };
const edm = (e, m = 1) => Math.max(1, Math.round((e.t === 'boss' ? 14 : e.t === 'wd' ? 9 : 6) * ST[cur].dm * m));
const aimA = e => Math.atan2(P.y - 90 - (e.y - e.h * .6), P.x - e.x);
const eSpd = e => (e.t === 'boss' ? 300 : 260) + ST[cur].set * 8;
const later = (t, f) => TQ.push({ t, f });

// 发射一枚弹丸；o 里可覆盖：g重力 hom追踪 wave波动 low贴地 r半径 slow/psn 附带效果
function ep(e, a, v, o) {
  const s = ST[cur].set;
  EP.push(Object.assign({
    x: e.x + e.fc * e.w * .4, y: e.y - e.h * .6, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
    dm: edm(e), c: ecol(e), t: 4, r: 10, slow: s === 4, psn: s === 5, a: 0
  }, o || {}));
}

// 地面区域（HZ）：col 天降光柱 / blast 落点爆炸 / pool 持续伤害池 / beam 激光 / well 引力漩涡
function zoneCol(e, x, o) {
  o = o || {};
  HZ.push({ k: 'col', x: cl(x, 40, WW - 40), y: GY, w: o.w || 50, delay: o.delay || .85, dur: .35, t: 0, dm: edm(e, 1.25), c: ecol(e) });
}
function zoneBlast(e, x, w, delay, m) {
  HZ.push({ k: 'blast', x: cl(x, 40, WW - 40), y: GY, w, delay, dur: .3, t: 0, dm: edm(e, m), c: ecol(e) });
}

function lobShot(e, pool, off) {
  const x0 = e.x + e.fc * e.w * .4, y0 = e.y - e.h * .6, g = 900, T2 = .95 + Math.abs(P.x - e.x) / 1600;
  const tx = P.x + (off || 0), ty = GY - 14;
  ep(e, 0, 0, { x: x0, y: y0, vx: (tx - x0) / T2, vy: ((ty - y0) - .5 * g * T2 * T2) / T2, g, gy: ty, pool, t: 3, r: 13, dm: edm(e, 1) });
}

const ATKS = {
  aim:    { n: '瞄准射击', wu: .35, f(e) { ep(e, aimA(e), eSpd(e) * .9) } },
  fan:    { n: '扇形齐射', wu: .45, f(e) { const n = e.t === 'boss' ? 5 : 3, a0 = aimA(e); for (let i = 0; i < n; i++) ep(e, a0 + (i - (n - 1) / 2) * .24, eSpd(e)) } },
  burst:  { n: '连发扫射', wu: .4, f(e) {
    const n = e.t === 'boss' ? 8 : 4;
    for (let i = 0; i < n; i++) later(i * .13, () => { if (!e.dead) ep(e, aimA(e) + (Math.random() - .5) * .12, eSpd(e) * 1.25, { dm: edm(e, .7) }) });
  } },
  ring:   { n: '环形爆裂', wu: .55, f(e) {
    const n = e.t === 'boss' ? 14 : 8, r0 = Math.random() * 6;
    for (let i = 0; i < n; i++) ep(e, r0 + i * Math.PI * 2 / n, 200, { x: e.x, y: e.y - e.h * .5 });
    FX.push({ type: 'boom', x: e.x, y: e.y - e.h * .5, t: .4, d: .4, r: 90, c: ecol(e) });
  } },
  lob:    { n: '抛物重炮', wu: .5, f(e) {
    if (e.t === 'boss') [-150, 0, 150].forEach((o, i) => later(i * .18, () => { if (!e.dead) lobShot(e, false, o) }));
    else lobShot(e, false, 0);
  } },
  lobPool:{ n: '腐蚀投弹', wu: .5, f(e) {
    if (e.t === 'boss') [-110, 110].forEach((o, i) => later(i * .2, () => { if (!e.dead) lobShot(e, true, o) }));
    else lobShot(e, true, 0);
  } },
  pillar: { n: '天降打击', wu: .5, f(e) { zoneCol(e, P.x) } },
  zap:    { n: '落雷', wu: .45, f(e) { zoneCol(e, P.x, { w: 34, delay: .75 }) } },
  pillars:{ n: '天柱连击', wu: .7, f(e) {
    const px = P.x;
    for (let i = 0; i < 5; i++) later(i * .16, () => { if (!e.dead) zoneCol(e, px + (i - 2) * 130, { delay: .8 }) });
  } },
  rain:   { n: '弹幕坠落', wu: .5, f(e) {
    const n = e.t === 'boss' ? 10 : 5, s = ST[cur].set;
    for (let i = 0; i < n; i++) later(i * .16, () => {
      if (e.dead) return;
      EP.push({ x: cl(P.x + (Math.random() - .5) * 760, 30, WW - 30), y: -20, vx: (Math.random() - .5) * 30, vy: 380, dm: edm(e, .9), c: ecol(e), t: 3, r: 11, slow: s === 4, psn: s === 5, a: 0 });
    });
  } },
  wave:   { n: '波形冲击', wu: .45, f(e) {
    const dir = P.x < e.x ? Math.PI : 0;
    for (let i = 0; i < 3; i++) later(i * .2, () => { if (!e.dead) ep(e, dir, eSpd(e) * .85, { wave: 48, y0: e.y - e.h * .55, r: 11 }) });
  } },
  homing: { n: '追踪光球', wu: .5, f(e) {
    const n = e.t === 'boss' ? 3 : 1;
    for (let i = 0; i < n; i++) ep(e, -Math.PI / 2 + (i - (n - 1) / 2) * .7, 170, { hom: 2.4, t: 5, r: 12, dm: edm(e, 1.1) });
  } },
  slam:   { n: '震地冲击', wu: .65, f(e) {
    const waves = e.t === 'boss' ? 2 : 1;
    for (let w = 0; w < waves; w++) later(w * .38, () => {
      if (e.dead) return;
      for (const dir of [-1, 1]) EP.push({ x: e.x + dir * e.w * .4, y: GY - 18, vx: dir * 380, vy: 0, low: 1, dm: edm(e, 1.25), c: ecol(e), t: 2.4, r: 16, a: 0 });
      shake = Math.max(shake, 12);
      FX.push({ type: 'boom', x: e.x, y: GY - 6, t: .4, d: .4, r: 110, c: ecol(e) });
    });
  } },
  beam:   { n: '激光扫射', wu: .55, f(e) {
    HZ.push({ k: 'beam', x: e.x, y: GY - 70, hh: 20, dir: e.fc, len: 1100, delay: .85, dur: .55, tick: .2, tk: 0, t: 0, dm: edm(e, .6), c: ecol(e) });
  } },
  vortex: { n: '引力漩涡', wu: .7, f(e) {
    HZ.push({ k: 'well', x: cl(P.x + (Math.random() - .5) * 300, 120, WW - 120), y: GY - 90, w: 150, delay: 0, dur: 2.2, t: 0, dm: edm(e, 1.6), c: ecol(e), pull: 210 });
  } },
  spiral: { n: '螺旋弹幕', wu: .6, f(e) {
    const arms = e.t === 'boss' ? 2 : 1;
    for (let i = 0; i < 16; i++) later(i * .09, () => {
      if (e.dead) return;
      for (let a = 0; a < arms; a++) ep(e, i * .45 + a * Math.PI, 230, { x: e.x, y: e.y - e.h * .5 });
    });
  } },
  meteor: { n: '陨星轰炸', wu: .6, f(e) {
    const n = e.t === 'boss' ? 7 : 3, px = P.x;
    for (let i = 0; i < n; i++) later(i * .22, () => { if (!e.dead) zoneBlast(e, px + (i === 0 ? 0 : (Math.random() - .5) * 620), 80, .95, 1.3) });
  } },
  swoop:  { n: '俯冲突袭', wu: .5, f(e) { const t = e.lk || { x: P.x, y: P.y - 70 }; e.dsh = .6; e.dvx = (t.x - e.x) / .4; e.dvy = (t.y - e.y) / .4; e.hc = 0 } },
  charge: { n: '狂暴冲锋', wu: .7, f(e) { e.dsh = .75; e.dvx = e.fc * (520 + ST[cur].set * 15); e.dvy = 0; e.hc = 0 } },
  summon: { n: '召唤魔物', wu: .8, f(e) {
    for (let i = 0; i < 2; i++) if (E.length < 12) spawn('imp', e.x + (i ? 1 : -1) * 140);
    FX.push({ type: 'boom', x: e.x, y: e.y - e.h * .5, t: .5, d: .5, r: 130, c: ecol(e) });
  } },
  blink:  { n: '瞬影突袭', wu: .35, f(e) {
    FX.push({ type: 'boom', x: e.x, y: e.y - e.h * .5, t: .3, d: .3, r: 60, c: ecol(e) });
    e.x = cl(P.x + (Math.random() < .5 ? -1 : 1) * 280, 60, WW - 60);
    FX.push({ type: 'boom', x: e.x, y: e.y - e.h * .5, t: .3, d: .3, r: 60, c: ecol(e) });
    later(.25, () => { if (!e.dead) { e.fc = P.x < e.x ? -1 : 1; ATKS.fan.f(e) } });
  } }
};

const LOCK_T = .22;   // 冲锋 / 俯冲：出手前多久锁定落点

function cdBase(e) {
  const s = ST[cur].set, b = e.t === 'boss' ? 1.9 : e.t === 'wd' ? 3.0 : 3.6;
  return (b + Math.random() * 1.2) * (1 - Math.min(.3, s * .025)) * (e.t === 'boss' && e.hp < e.mhp * .5 ? .7 : 1);
}

function startAtk(e) {
  const s = ST[cur].set, set = ATK_SET[s] || ATK_SET[1], list = set[e.t] || set.wd;
  let name; do { name = list[Math.random() * list.length | 0] } while (list.length > 1 && name === e.last);
  e.last = e.atk = name; e.wu = ATKS[name].wu; e.lk = null;
  if (e.t === 'boss') DT.push({ x: e.x, y: e.y - e.h - 20, s: THEME[s] + '·' + ATKS[name].n, t: 1.1, c: ecol(e) });
}

function updEnemy(e, dt) {
  if (e.dead) return;
  const o = ET[e.t], d = P.x - e.x, ad = Math.abs(d);
  e.fl -= dt; e.cd -= dt; e.hc -= dt;

  if (e.t === 'boss' && !e.rg && e.hp < e.mhp * .5) {
    e.rg = 1; shake = 14; e.cd = Math.min(e.cd, .6);
    DT.push({ x: e.x, y: e.y - e.h - 50, s: 'BOSS 狂暴化！', t: 1.6, c: '#ff3838' });
  }

  if (e.dsh > 0) {                                   // 冲刺中（俯冲 / 冲锋）
    e.dsh -= dt; e.x = cl(e.x + e.dvx * dt, 40, WW - 40);
    if (e.t === 'imp') e.y += e.dvy * dt;
    if (e.dsh <= 0) e.cd = cdBase(e);
  } else if (e.wu > 0) {                             // 前摇（原地蓄力）
    e.wu -= dt;
    if (e.wu > LOCK_T) { if (ad > 14) e.fc = d < 0 ? -1 : 1; e.lk = null }          // 前摇前段：跟随玩家
    else if (!e.lk) e.lk = { x: P.x, y: P.y - 70, fc: e.fc };           // 出手前 0.22s：锁定落点，给玩家留出闪避时间
    if (e.t === 'imp' && e.atk === 'swoop') e.y += (150 - e.y) * Math.min(1, 3 * dt);
    if (e.wu <= 0) { e.wu = 0; ATKS[e.atk].f(e); e.lk = null; if (!(e.dsh > 0)) e.cd = cdBase(e) }
  } else {                                           // 正常移动
    if (ad > 14) e.fc = d < 0 ? -1 : 1;                      // 正下方/贴身时保持朝向，避免每帧翻转
    if (e.t === 'imp') {
      if (ad > 40) e.x += Math.sign(d) * o.sp * dt * Math.min(1, (ad - 40) / 40);   // 接近时平滑减速
      e.y += (P.y - 110 + Math.sin(T * 3 + e.id) * 50 - e.y) * Math.min(1, 2 * dt);
    } else {
      const stop = e.t === 'wd' ? 330 : 60;
      if (ad > stop) e.x += Math.sign(d) * o.sp * dt * Math.min(1, (ad - stop) / 40);
      else if (e.t === 'wd' && ad < 250) e.x -= Math.sign(d) * o.sp * dt * Math.min(1, (250 - ad) / 40);
      e.y = e.t === 'wd' ? GY - 30 + Math.sin(T * 2 + e.id) * 15 : GY;
    }
    if (e.cd <= 0 && ad < 720) startAtk(e);
  }

  if (Math.abs(P.x - e.x) < e.w / 2 + 25 && e.y > P.y - 150 && e.y - e.h < P.y && e.hc <= 0 && P.inv <= 0) {
    e.hc = .8; hurtP(e.dm);
  }
}

// 区域命中判定
function hzHit(h) {
  if (h.k === 'col') return Math.abs(P.x - h.x) < h.w + 20;
  if (h.k === 'blast' || h.k === 'pool') return Math.abs(P.x - h.x) < h.w + 15 && P.y > GY - 70;   // 跳起来可躲
  if (h.k === 'beam') { const dx = (P.x - h.x) * h.dir; return dx > -20 && dx < h.len && Math.abs(P.y - 80 - h.y) < h.hh + 40 }
  if (h.k === 'well') return Math.hypot(P.x - h.x, P.y - 80 - h.y) < h.w;
  return false;
}

// 每帧：延迟队列 / 弹丸 / 区域 / 中毒与减速
function updBattleFx(dt) {
  for (const q of TQ) q.t -= dt;
  const due = TQ.filter(q => q.t <= 0); TQ = TQ.filter(q => q.t > 0);
  due.forEach(q => q.f());

  for (const p of EP) {
    p.a += dt; p.t -= dt;
    if (p.hom) {
      const sp2 = Math.hypot(p.vx, p.vy); let ca = Math.atan2(p.vy, p.vx);
      let da = Math.atan2(P.y - 80 - p.y, P.x - p.x) - ca; da = Math.atan2(Math.sin(da), Math.cos(da));
      ca += cl(da, -p.hom * dt, p.hom * dt); p.vx = Math.cos(ca) * sp2; p.vy = Math.sin(ca) * sp2;
    }
    if (p.g) p.vy += p.g * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.wave) p.y = p.y0 + Math.sin(p.a * 7) * p.wave;

    if (p.g && p.vy > 0 && p.y >= p.gy) {                       // 抛物弹落地
      FX.push({ type: 'boom', x: p.x, y: GY - 10, t: .4, d: .4, r: 70, c: p.c });
      HZ.push(p.pool
        ? { k: 'pool', x: p.x, y: GY, w: 75, delay: 0, dur: 4.5, tick: .5, tk: 0, t: 0, dm: Math.max(1, p.dm * .45 | 0), c: p.c }
        : { k: 'blast', x: p.x, y: GY, w: 55, delay: 0, dur: .2, t: 0, dm: p.dm, c: p.c });
      p.t = 0; continue;
    }
    if (p.y > GY + 20 || p.y < -260 || p.x < -100 || p.x > WW + 100) { p.t = 0; continue }

    const hit = p.low ? (Math.abs(P.x - p.x) < 34 && P.y > GY - 50) : (Math.hypot(p.x - P.x, p.y - (P.y - 80)) < p.r + 30);
    if (hit && P.inv <= 0) {
      hurtP(p.dm); p.t = 0;
      if (p.slow) P.slow = 1.8;
      if (p.psn) P.psn = 4;
    }
  }
  EP = EP.filter(p => p.t > 0);

  for (const h of HZ) {
    h.t += dt;
    if (h.t < h.delay || h.t >= h.delay + h.dur) continue;
    if (h.k === 'pool' || h.k === 'beam') {
      h.tk -= dt;
      if (h.tk <= 0) { h.tk = h.tick; if (hzHit(h)) hurtP(h.dm) }
    } else if (h.k === 'well') {
      const dx = h.x - P.x;
      if (Math.abs(dx) < 420 && P.st !== 'fv') P.x = cl(P.x + Math.sign(dx) * h.pull * dt, 30, WW - 30);
      if (!h.hit && h.t >= h.dur - .05) { h.hit = 1; shake = Math.max(shake, 10); FX.push({ type: 'boom', x: h.x, y: h.y, t: .4, d: .4, r: h.w, c: h.c }); if (hzHit(h)) hurtP(h.dm) }
    } else if (!h.hit) {
      h.hit = 1; shake = Math.max(shake, h.k === 'col' ? 8 : 6);
      if (hzHit(h)) hurtP(h.dm);
    }
  }
  HZ = HZ.filter(h => h.t < h.delay + h.dur);

  if (P.slow > 0) P.slow -= dt;
  if (P.psn > 0) {
    P.psn -= dt; P.pt = (P.pt || 0) - dt;
    if (P.pt <= 0) {
      P.pt = .5; const dd = Math.max(1, Math.round(P.mh * .008));
      P.hp = Math.max(1, P.hp - dd);
      DT.push({ x: P.x, y: P.y - 190, s: '-' + dd + '☠', t: .6, c: '#7dff5a' });
    }
  }
}

// ---------- 绘制 ----------
function drawHZ() {
  for (const h of HZ) {
    const x = h.x - cam, act = h.t >= h.delay, pr = cl(h.t / h.delay, 0, 1), flash = (T * 14 | 0) % 2;
    ctx.save(); ctx.fillStyle = h.c; ctx.strokeStyle = h.c;
    if (h.k === 'col') {
      if (!act) {
        ctx.globalAlpha = .08 + .22 * pr; ctx.fillRect(x - h.w, 0, h.w * 2, GY + 8);
        ctx.globalAlpha = flash ? .8 : .4; ctx.lineWidth = 2; ctx.strokeRect(x - h.w, 0, h.w * 2, GY + 8);
        ctx.beginPath(); ctx.ellipse(x, GY + 2, h.w, 9, 0, 0, 7); ctx.fill();
      } else {
        ctx.shadowColor = h.c; ctx.shadowBlur = 30; ctx.globalAlpha = .85; ctx.fillRect(x - h.w, 0, h.w * 2, GY + 8);
        ctx.globalAlpha = .95; ctx.fillStyle = '#fff'; ctx.fillRect(x - h.w * .4, 0, h.w * .8, GY + 8);
      }
    } else if (h.k === 'blast') {
      if (!act) {
        ctx.globalAlpha = flash ? .8 : .45; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, GY + 2, h.w, h.w * .26, 0, 0, 7); ctx.stroke();
        ctx.globalAlpha = .15 + .35 * pr; ctx.beginPath(); ctx.ellipse(x, GY + 2, h.w * pr, h.w * .26 * pr, 0, 0, 7); ctx.fill();
        ctx.globalAlpha = .85; ctx.beginPath(); ctx.arc(x, GY - 320 * (1 - pr), 9, 0, 7); ctx.fill();   // 坠落的火球
      } else {
        const q = (h.t - h.delay) / h.dur;
        ctx.shadowColor = h.c; ctx.shadowBlur = 26; ctx.globalAlpha = .85 * (1 - q * .5);
        ctx.beginPath(); ctx.ellipse(x, GY, h.w * (1 + q * .3), h.w * .4, 0, 0, 7); ctx.fill();
        ctx.globalAlpha = .55 * (1 - q); ctx.fillRect(x - h.w * .5, GY - 240, h.w, 240);
      }
    } else if (h.k === 'pool') {
      const life = cl((h.delay + h.dur - h.t) / .8, 0, 1);
      ctx.globalAlpha = (.3 + Math.sin(T * 5) * .08) * life; ctx.beginPath(); ctx.ellipse(x, GY, h.w, h.w * .24, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = .7 * life; ctx.lineWidth = 2; ctx.stroke();
      for (let i = 0; i < 4; i++) { const ph = (T * .9 + i * .27) % 1; ctx.globalAlpha = (1 - ph) * .7 * life; ctx.beginPath(); ctx.arc(x + (i - 1.5) * h.w * .4, GY - ph * 42, 3.5, 0, 7); ctx.fill() }
    } else if (h.k === 'beam') {
      const x2 = x + h.dir * h.len, xa = Math.min(x, x2), wd = Math.abs(x2 - x);
      if (!act) { ctx.globalAlpha = flash ? .75 : .3; ctx.fillRect(xa, h.y - 2, wd, 4) }
      else { ctx.shadowColor = h.c; ctx.shadowBlur = 28; ctx.globalAlpha = .8; ctx.fillRect(xa, h.y - h.hh, wd, h.hh * 2); ctx.fillStyle = '#fff'; ctx.globalAlpha = .95; ctx.fillRect(xa, h.y - h.hh * .35, wd, h.hh * .7) }
    } else if (h.k === 'well') {
      ctx.shadowColor = h.c; ctx.shadowBlur = 20;
      for (let i = 0; i < 4; i++) { const ph = (T * 1.4 + i / 4) % 1; ctx.globalAlpha = .7 * (1 - ph); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, h.y, h.w * (1 - ph), 0, 7); ctx.stroke() }
      ctx.globalAlpha = .85; ctx.fillStyle = '#05030a'; ctx.beginPath(); ctx.arc(x, h.y, 22 + Math.sin(T * 8) * 3, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
}

function drawEP() {
  for (const p of EP) {
    const x = p.x - cam;
    ctx.save(); ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 12;
    ctx.beginPath();
    if (p.low) ctx.ellipse(x, GY - 26, 14, 32, 0, 0, 7); else ctx.arc(x, p.y, p.r, 0, 7);
    ctx.fill();
    if (p.hom || p.pool) { ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.globalAlpha = .8; ctx.beginPath(); ctx.arc(x, p.y, p.r * .45, 0, 7); ctx.fill() }
    ctx.restore();
  }
}


// ---------- 冲锋 / 俯冲：落点预警 ----------
// 前摇阶段预测终点；出手前 LOCK_T 秒锁定（实线变亮）；冲刺过程中继续显示剩余路径
function dashPlan(e) {
  if (e.dead || (e.atk !== 'charge' && e.atk !== 'swoop')) return null;
  const imp = e.t === 'imp';
  if (e.dsh > 0) {
    return { x0: e.x, y0: e.y, x1: cl(e.x + e.dvx * e.dsh, 40, WW - 40), y1: imp ? Math.min(GY, e.y + e.dvy * e.dsh) : e.y, lock: true };
  }
  if (!(e.wu > 0)) return null;
  let dvx, dvy = 0, dur;
  if (e.atk === 'charge') { dvx = e.fc * (520 + ST[cur].set * 15); dur = .75 }
  else { const t = e.lk || { x: P.x, y: P.y - 70 }; dvx = (t.x - e.x) / .4; dvy = (t.y - e.y) / .4; dur = .6 }
  return { x0: e.x, y0: e.y, x1: cl(e.x + dvx * dur, 40, WW - 40), y1: imp ? Math.min(GY, e.y + dvy * dur) : e.y, lock: e.wu <= LOCK_T };
}

function drawDashWarn(e) {
  const p = dashPlan(e); if (!p) return;
  const fx = p.x0 - cam, tx = p.x1 - cam, dir = tx >= fx ? 1 : -1, len = Math.abs(tx - fx);
  const blink = (T * (p.lock ? 18 : 8) | 0) % 2, RED = '#ff3b3b';
  const fy = p.y0 - e.h / 2, ty = p.y1 - e.h / 2;
  ctx.save();
  // 1) 危险带：沿冲刺路径的碰撞体积
  ctx.strokeStyle = RED; ctx.lineCap = 'butt'; ctx.lineWidth = Math.max(36, e.h * .9);
  ctx.globalAlpha = p.lock ? .17 + .09 * blink : .09;
  ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(tx, ty); ctx.stroke();
  // 2) 中线：未锁定=虚线流动，已锁定=实线
  ctx.lineWidth = 3; ctx.globalAlpha = p.lock ? .95 : .6;
  ctx.setLineDash(p.lock ? [] : [14, 10]); ctx.lineDashOffset = -T * 70 * dir;
  ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.setLineDash([]);
  // 3) 方向箭头
  const n = Math.max(1, Math.floor(len / 70));
  ctx.lineWidth = 4; ctx.globalAlpha = p.lock ? .9 : .55;
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1), px = fx + (tx - fx) * t, py = fy + (ty - fy) * t;
    ctx.beginPath(); ctx.moveTo(px - dir * 9, py - 11); ctx.lineTo(px + dir * 5, py); ctx.lineTo(px - dir * 9, py + 11); ctx.stroke();
  }
  // 4) 地面投影带（判断横向距离）
  ctx.globalAlpha = p.lock ? .5 : .28; ctx.fillStyle = RED;
  ctx.fillRect(Math.min(fx, tx), GY + 2, len, 6);
  // 5) 落点：残影 + 地面圈 + ▼ 标记
  if (e.im) {
    ctx.save(); ctx.globalAlpha = p.lock ? .4 : .24; ctx.translate(tx, p.y1); ctx.scale(dir * e.s, e.s);
    ctx.drawImage(e.im, -e.im.width / 2, -e.im.height); ctx.restore();
  }
  ctx.lineWidth = 3; ctx.strokeStyle = RED; ctx.globalAlpha = p.lock ? .95 : .65;
  ctx.beginPath(); ctx.ellipse(tx, GY + 5, Math.max(38, e.w / 2), 12, 0, 0, 7); ctx.stroke();
  ctx.globalAlpha = .14 + .12 * blink; ctx.fillStyle = RED; ctx.fill();
  ctx.restore();
  txt('▼', tx, p.y1 - e.h - 18 - Math.abs(Math.sin(T * 9)) * 6, 22, RED, 'center');
}
