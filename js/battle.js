// ===== 战斗系统 =====
function begin(k) {
  cur = k; calc();
  Object.assign(P, { x: 300, y: GY, vx: 0, vy: 0, f: 1, hp: P.mh, mp: P.mm, st: 'trans', t: 0, inv: 0, land: 0, h: 0, hit: {}, sta: P.stm, dcd: 0, exh: false, spr: false, shDown: false, shT: 0, gt: 0, sreg: 0 });
  GH = []; P.cd.e = 0; E = []; PJ = []; EP = []; FX = []; DT = []; OR = [];
  kills = 0; bs = 0; sp = 1; RG = 0; cam = 0; G = 'play';
}

function fin(w) {
  if (G !== 'play') return;
  G = w ? 'win' : 'over';
  FG = w ? RG + ST[cur].g : RG >> 1;
  S.g += FG;
  if (w) S.cl = Math.max(S.cl, cur + 1);
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
  const dropRate = isBoss ? 1.0 : (e.t === 'wd' ? 0.38 : 0.18);
  if (Math.random() > dropRate) return;

  let tr = 0;
  const r = Math.random();
  const d = cur;
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
  e.hp -= d; e.fl = .12; e.x += P.f * (e.t === 'boss' ? 2 : 12);
  P.mp = Math.min(P.mm, P.mp + 3);
  DT.push({ x: e.x, y: e.y - e.h, s: d + (c ? '!' : ''), t: .8, c: c ? '#ff8a2a' : '#ffd84a' });
  shake = Math.max(shake, 4);

  if (e.hp <= 0 && !e.dead) {
    e.dead = 1; kills++; gain(ET[e.t].xp * (1 + cur * .4)); RG += ET[e.t].g * (1 + cur * .3) | 0;
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

function spawn(t) {
  const o = ET[t], z = ST[cur];
  const pool = (ENS[z.set] && ENS[z.set][t] && ENS[z.set][t].length) ? ENS[z.set][t] : EN[t];
  const c = pool[Math.random() * pool.length | 0], s = o.H / c.height, side = Math.random() < .5 ? -1 : 1, hp = o.hp * z.hm | 0;
  let x = P.x + side * (520 + Math.random() * 150);
  if (x < 60 || x > WW - 60) x = P.x - side * 600;
  E.push({ id: ++uid, t, im: c, x: cl(x, 60, WW - 60), y: t === 'imp' ? 300 : GY, hp, mhp: hp, dm: o.dm * z.dm | 0, h: o.H, w: c.width * s, s, fl: 0, cd: 2, hc: 0, fc: 1 });
}

function shoot(e, n) {
  const a0 = Math.atan2(P.y - 90 - (e.y - e.h * .6), P.x - e.x), v = e.t === 'boss' ? 300 : 260;
  const set = ST[cur].set;
  const bossCols = { 1: '#7dff5a', 2: '#ff3a10', 3: '#5352ed', 4: '#70a1ff', 5: '#2ed573', 6: '#ffa502', 7: '#a55eea', 8: '#ffd32a', 9: '#ff6348', 10: '#ff3838' };
  const mobCols = { 1: '#4cd0ff', 2: '#ff9a00', 3: '#a29bfe', 4: '#74b9ff', 5: '#55efc4', 6: '#ffeaa7', 7: '#d6a2e8', 8: '#fff200', 9: '#ff7675', 10: '#ff4757' };
  const col = e.t === 'boss' ? (bossCols[set] || '#ff3a10') : (mobCols[set] || '#4cd0ff');
  for (let i = 0; i < n; i++) {
    const a = a0 + (i - (n - 1) / 2) * .25;
    EP.push({ x: e.x + e.fc * e.w * .4, y: e.y - e.h * .6, vx: Math.cos(a) * v, vy: Math.sin(a) * v, dm: (e.t === 'boss' ? 14 : 9) * ST[cur].dm | 0, c: col, t: 4 });
  }
}