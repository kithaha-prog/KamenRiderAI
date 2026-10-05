// ===== 骑士专属机制（R 键）=====
//   龙骑 Ryuki ：契约兽「无限龙」—— 每 9 秒自动助战喷火；每击杀 4 个敌人得 1 张 Advent 卡，按 R 召唤无限龙贯穿全场
//   555 Faiz   ：Accel Form —— 按 R 进入 10 秒加速：敌人与敌方弹幕变慢、自身移速 / 技能回复 / 出手速度提升
//   Blade      ：卡牌合成 —— 命中敌人获得 ♠ 牌（斩 / 雷 / 踢 / 速），手里凑够 2 张按 R 融合成联合技（共 10 种）
//   Zeztz      ：Overdrive —— 按 R 释放超载冲击波并进入 8 秒高能超载强化状态
//
// 本文件完全自包含：不需要改 main.js / battle.js / player.js / ui.js。
// 加载顺序：放在 coop.js 之后、main.js 之前。

// ---------- 平衡参数（想调数值只改这里）----------
const MECH_CFG = {
  ryuki: { cardEvery: 4, maxCards: 3, autoEvery: 9, assistMul: 2.4, adventMul: 1.3, adventEnd: 4.0, cd: 2 },
  k555:  { dur: 10, cd: 32, ts: .3, spd: 1.5, cdRegen: .6, atkSpd: .55, coopSpd: 1.8, coopAtk: .85 },   // 联机：不能减慢怪物（会让队友错位），改为加强自身移速 / 攻速作补偿
  blade: { hitsPerCard: 3, maxHand: 2, cd: 4 },
  zeztz: { dur: 8, cd: 24, atkMul: 1.35 }
};

const MECH = {
  rk: '', cd: 0, mcd: 1, vis: [], tl: [], dash: null, buff: null,
  // 龙骑
  cards: 0, lastKills: 0, auto: 6, dragon: null, shots: [],
  // 555
  accel: 0,
  // Blade
  hand: [], hits: 0, noDrawT: 0,
  // Zeztz
  overdrive: 0
};

// 无限龙贴图（由 KR_Ryuki_FinalVent.png 第 8 帧裁出；朝左）
let DRG = null;
(function loadDragon() {
  try {
    const im = new Image();
    im.onload = () => { DRG = im; };
    im.onerror = () => { };
    im.src = encodeURI((typeof RYUKI !== 'undefined' ? RYUKI : 'Assets/Kamen Rider Ryuki/') + 'KR_Ryuki_Dragon.png');
  } catch (e) { }
})();

// ---------- 通用小工具 ----------
const mCoop = () => typeof COOP !== 'undefined' && COOP && COOP.active && COOP.inGame;
const mToast = (s, c, y) => DT.push({ x: P.x, y: P.y - (y || 200), s, t: 1.1, c: c || '#ffd84a' });
const mEase = p => p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
const mHz = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const mFx = (x, y, r, c, t) => FX.push({ type: 'boom', x, y, t: t || .3, d: t || .3, r, c });

function mNearest(x, maxd) {
  let b = null, bd = maxd || 1e9;
  for (const e of E) { if (e.dead) continue; const d = Math.abs(e.x - x); if (d < bd) { bd = d; b = e; } }
  return b;
}
function mNearestN(x, n, maxd) {
  return E.filter(e => !e.dead && Math.abs(e.x - x) < (maxd || 1e9)).sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x)).slice(0, n);
}
// 范围伤害：以 x 为中心、半径 r 的纵向柱形，o.set 防重复，o.ground 只打地面单位
function mBlast(x, r, mul, o) {
  o = o || {}; let n = 0;
  for (const e of E) {
    if (e.dead) continue;
    if (Math.abs(e.x - x) >= r + e.w * .4) continue;
    if (!zOk(e, undefined, r > 350 ? 110 : 60)) continue;   // ★ 2.5D
    if (o.ground && e.y < GY - 150) continue;
    if (o.set) { if (o.set[e.id]) continue; o.set[e.id] = 1; }
    hurt(e, P.atk * mul); n++;
  }
  return n;
}
const mAt = (t, fn) => { if (t <= 0) fn(); else MECH.tl.push({ t, fn }); };

// ---------- 重置 ----------
function mechReset(rk, keepKills) {
  rk = rk || (typeof curRiderKey === 'function' ? curRiderKey() : 'malaya');
  Object.assign(MECH, {
    rk, cd: 0, mcd: 1, vis: [], tl: [], dash: null, buff: null, dragon: null, shots: [], accel: 0, overdrive: 0,
    lastKills: keepKills ? kills : 0, auto: 6, hits: 0, noDrawT: 0, cards: rk === 'ryuki' ? 1 : 0, hand: []
  });
  if (rk === 'blade') { MECH.hand.push(bDraw(), bDraw()); }
}

// 判断当前形态对应的变身胶囊是否已达到满星（5星）
function mIsCapMaxStar() {
  const rk = curRiderKey();
  if (rk === 'malaya') return false;
  if (typeof capStar !== 'function' || typeof CAP_STAR_MAX === 'undefined') return true;
  return capStar(rk) >= CAP_STAR_MAX;
}

// =====================================================================
//  龙骑：契约兽 无限龙（Dragredder） + Advent 卡
// =====================================================================
function spawnDragon(mode) {
  const f = P.f;
  if (mode === 'assist') {
    MECH.dragon = { mode, t: 0, dur: 2.4, dir: f, x: P.x - f * 130, y: GY - 300, w: 230, rot: 0, al: 0, shot: 0 };
    DT.push({ x: P.x - f * 130, y: GY - 360, s: '无限龙 助战', t: 1.0, c: '#ff8a4a' });
  } else {
    MECH.dragon = { mode, t: 0, dur: 1.45, dir: f, x0: P.x - f * 220, x: P.x - f * 220, y: GY - 170, w: 320, rot: 0, al: 0, tk: 0, end: 0 };
    DT.push({ x: P.x, y: P.y - 210, s: 'ADVENT！', t: 1.4, c: '#ff3838' });
    shake = Math.max(shake, 12);
  }
}

function updRyuki(dt, can) {
  const C = MECH_CFG.ryuki;
  const isMaxStar = mIsCapMaxStar();

  // 未满星时完全不积攒卡片也不触发自动助战
  if (isMaxStar) {
    if (kills < MECH.lastKills) MECH.lastKills = kills;
    const n = Math.floor(kills / C.cardEvery) - Math.floor(MECH.lastKills / C.cardEvery);
    MECH.lastKills = kills;
    if (n > 0 && MECH.cards < C.maxCards) {
      MECH.cards = Math.min(C.maxCards, MECH.cards + n);
      mToast('+1 Advent 卡', '#ff7a7a', 230);
    }

    if (!MECH.dragon && E.length && can) {
      MECH.auto -= dt;
      if (MECH.auto <= 0) { spawnDragon('assist'); MECH.auto = C.autoEvery; }
    }
  }

  // 现有 dragon、shots 飞弹逻辑保持...
  const g = MECH.dragon;
  if (g) {
    g.t += dt;
    if (g.mode === 'assist') {
      g.dir = P.f; g.x = P.x - P.f * 130 + Math.sin(g.t * 2.2) * 26; g.y = GY - 300 + Math.sin(g.t * 3) * 14; g.rot = 0;
      g.al = Math.min(1, g.t / .3, (g.dur - g.t) / .4);
      if (!g.shot && g.t >= .9) {
        g.shot = 1;
        const e = mNearest(g.x, 1200);
        if (e) {
          MECH.shots.push({ x: g.x + g.dir * 80, y: g.y - 10, vx: 0, vy: 0, t: 1.4, tg: e, tx: e.x, ty: e.y - e.h * .5 });
          mFx(g.x + g.dir * 80, g.y - 10, 60, '#ff8a30', .25);
        }
      }
    } else {
      const e = mEase(cl(g.t / g.dur, 0, 1));
      g.x = g.x0 + g.dir * 1000 * e; g.y = GY - 170 + Math.sin(g.t * 8) * 10; g.rot = g.dir * .06;
      g.al = Math.min(1, g.t / .15, (g.dur - g.t) / .25);
      g.tk -= dt;
      if (g.tk <= 0) { g.tk = .12; mBlast(g.x, 150, C.adventMul); cancelEP(g.x - 150, g.x + 150); }
      if (Math.random() < .7) mFx(g.x - g.dir * 90, g.y + Math.random() * 40 - 10, 46, '#ff7a28', .2);
      shake = Math.max(shake, 5);
      if (!g.end && g.t >= g.dur - .05) {
        g.end = 1;
        const bx = g.x + g.dir * 80;
        mBlast(bx, 300, C.adventEnd);
        mFx(bx, GY - 40, 320, '#ff5a20', .7); mFx(bx, GY - 40, 200, '#ffd166', .5);
        shake = 24;
        DT.push({ x: bx, y: GY - 200, s: '无限龙 · 烈焰吐息！', t: 1.6, c: '#ff3838' });
      }
    }
    if (g.t >= g.dur) MECH.dragon = null;
  }

  // 龙的火球（追踪目标）
  for (const s of MECH.shots) {
    s.t -= dt;
    if (s.tg && !s.tg.dead) { s.tx = s.tg.x; s.ty = s.tg.y - s.tg.h * .5; }
    const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy) || 1;
    s.vx = dx / d * 1100; s.vy = dy / d * 1100;
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (d < 55 || s.t <= 0) {
      s.t = 0;
      mBlast(s.x, 150, C.assistMul);
      mFx(s.x, s.y, 190, '#ff6a20', .4); mFx(s.x, s.y, 110, '#ffd166', .3);
      shake = Math.max(shake, 10);
    }
  }
  MECH.shots = MECH.shots.filter(s => s.t > 0);

  // 按 R 判定
  if (PR.KeyR && can) {
    if (!isMaxStar) {
      mToast('契约未觉醒：需将龙骑胶囊升至 5★ 解锁！', '#ff7675');
    } else if (MECH.dragon && MECH.dragon.mode === 'advent') {}
    else if (MECH.cd > 0) mToast('冷却中 ' + MECH.cd.toFixed(1) + 's', '#ffa502');
    else if (MECH.cards <= 0) mToast('Advent 卡不足（每击杀 ' + C.cardEvery + ' 个敌人得 1 张）', '#ffd84a');
    else { MECH.cards--; MECH.cd = C.cd; MECH.mcd = C.cd; spawnDragon('advent'); }
  }
}

function drawDragon(g) {
  const img = DRG, w = g.w, h = img ? w * img.height / img.width : w * .6;
  ctx.save();
  ctx.globalAlpha = cl(g.al, 0, 1);
  ctx.translate(sn(g.x - cam), sn(g.y)); ctx.rotate(g.rot || 0); ctx.scale(g.dir > 0 ? -1 : 1, 1);
  ctx.shadowColor = '#ff6a20'; ctx.shadowBlur = 26;
  if (img) ctx.drawImage(img, -w / 2, -h / 2, w, h);
  else {
    ctx.lineCap = 'round'; ctx.strokeStyle = '#d83a1a'; ctx.lineWidth = 22;
    ctx.beginPath(); ctx.moveTo(-w * .45, -10);
    for (let i = 1; i <= 8; i++) ctx.lineTo(-w * .45 + i * w * .11, Math.sin(i * .9 + T * 5) * 22);
    ctx.stroke(); ctx.strokeStyle = '#ffd34a'; ctx.lineWidth = 6; ctx.stroke();
    ctx.fillStyle = '#d83a1a'; ctx.beginPath(); ctx.arc(-w * .47, -10, 20, 0, 7); ctx.fill();
  }
  ctx.restore();
}

// =====================================================================
//  555：Accel Form
// =====================================================================
function accelStart() {
  const C = MECH_CFG.k555;
  MECH.accel = C.dur; MECH.cd = C.cd; MECH.mcd = C.cd;
  P.inv = Math.max(P.inv, .5);
  MECH.vis.push({ k: 'ring', x: P.x, y: GY, r: 260, t: .6, d: .6, col: '255,60,60' });
  DT.push({ x: P.x, y: P.y - 215, s: 'START UP', t: 1.0, c: '#ff3b3b' });
  DT.push({ x: P.x, y: P.y - 240, s: 'ACCEL FORM', t: 1.4, c: '#ffd166' });
  shake = Math.max(shake, 14);
}
function accelEnd(quiet) {
  if (MECH.accel <= 0) return;
  MECH.accel = 0;
  if (!quiet) {
    MECH.vis.push({ k: 'ring', x: P.x, y: GY, r: 200, t: .5, d: .5, col: '120,200,255' });
    DT.push({ x: P.x, y: P.y - 215, s: 'TIME OUT', t: 1.2, c: '#7dd3ff' });
    shake = Math.max(shake, 8);
  }
}

function updAccel(dt, can) {
  const C = MECH_CFG.k555;
  if (MECH.accel > 0) {
    MECH.accel -= dt;
    for (const k in P.cd) if (P.cd[k] > 0) P.cd[k] = Math.max(0, P.cd[k] - dt * C.cdRegen);
    if (P.dcd > 0) P.dcd = Math.max(0, P.dcd - dt * .8);
    if (P.st === 'atk' || P.st === 'thr') P.t += dt * (mCoop() ? C.coopAtk : C.atkSpd);
    MECH.gt = (MECH.gt || 0) - dt;
    if (MECH.gt <= 0 && (P.vx || P.st === 'atk' || P.st === 'dodge')) {
      MECH.gt = .045; GH.push({ x: P.x, y: P.y, f: P.f, st: P.st, t: .3, d: .3 });
    }
    if (MECH.accel <= 0) accelEnd();
  }
  if (PR.KeyR && can) {
    if (!mIsCapMaxStar()) {
      mToast('智脑未授权：需将 555 胶囊升至 5★ 解锁 Accel！', '#ff7675');
    } else if (MECH.accel > 0) {}
    else if (MECH.cd > 0) mToast('Accel 冷却中 ' + MECH.cd.toFixed(0) + 's', '#ffa502');
    else accelStart();
  }
}

// =====================================================================
//  Blade：卡牌合成
// =====================================================================
const BL_CARD = { S: { g: '斩', c: '#ffd84a' }, T: { g: '雷', c: '#5ec8ff' }, K: { g: '踢', c: '#ff8a4a' }, M: { g: '速', c: '#7dff9a' } };
const BL_COMBO = {
  ST: { n: 'LIGHTNING SLASH', cn: '雷电斩', c: '#7fd0ff' },
  KT: { n: 'LIGHTNING BLAST', cn: '雷电冲击', c: '#5ec8ff' },
  KM: { n: 'SONIC KICK', cn: '音速踢', c: '#ffb15a' },
  MS: { n: 'SLASH MACH', cn: '疾风连斩', c: '#9dffb8' },
  MT: { n: 'THUNDER MACH', cn: '雷速领域', c: '#8fdcff' },
  KS: { n: 'ROCK SLASH', cn: '岩斩', c: '#d6b27a' },
  TT: { n: 'THUNDER STORM', cn: '落雷风暴', c: '#6cf' },
  SS: { n: 'CROSS SLASH', cn: '十字斩', c: '#ffd84a' },
  KK: { n: 'DOUBLE KICK', cn: '双重音速踢', c: '#ff9a4a' },
  MM: { n: 'MACH RUSH', cn: '疾风无敌', c: '#7dff9a' }
};
function bDraw() { return 'SKTM'[Math.random() * 4 | 0]; }
const bPair = () => MECH.hand.slice().sort().join('');

function mDash(f, vx, dur, mul, refresh) {
  MECH.dash = { vx: f * vx, t: dur, mul, refresh: refresh || 0, rt: refresh || 0, set: {}, gt: 0 };
}
function mStrike(x, mul, r) {
  MECH.vis.push({ k: 'strike', x, t: .35, d: .35, seed: Math.random() * 100 });
  mBlast(x, r || 110, mul);
  mFx(x, GY - 30, (r || 110) * 1.2, '#7fd0ff', .3);
  shake = Math.max(shake, 8);
}
const mSlash = (x, y, f, r, col, a) => MECH.vis.push({ k: 'slash', x, y, f, r, col, a: a || 0, t: .28, d: .28 });
const mCross = (x, y, L, col) => MECH.vis.push({ k: 'cross', x, y, L, col, t: .3, d: .3 });
const mRock = x => MECH.vis.push({ k: 'rock', x, t: .6, d: .6 });

function bFire(pair) {
  const C = BL_COMBO[pair], f = P.f;
  const fr = d => P.x + f * d, hy = () => P.y - 100;
  MECH.cd = MECH_CFG.blade.cd; MECH.mcd = MECH.cd;
  MECH.noDrawT = T + 3.5;
  DT.push({ x: P.x, y: P.y - 215, s: C.n, t: 1.4, c: C.c });
  DT.push({ x: P.x, y: P.y - 240, s: C.cn, t: 1.4, c: '#fff' });
  shake = Math.max(shake, 8);
  const bolt = () => {
    const Bo = typeof BLADE_BOLT !== 'undefined' ? BLADE_BOLT : { t: .46 };
    BLB.push({ x: P.x + f * 70, y: hy(), dx: f, dy: -.03, t: Bo.t, d: Bo.t, tk: 0, seed: Math.random() * 10 | 0 });
    mFx(P.x + f * 70, hy(), 50, '#7fd0ff', .2); shake = Math.max(shake, 10);
  };

  switch (pair) {
    case 'ST':
      mAt(0, () => { mSlash(fr(70), hy(), f, 150, '#7fd0ff'); mBlast(fr(150), 190, 1.5); shake = 12; });
      mAt(.13, () => { mSlash(fr(70), hy(), f, 175, '#ffd84a', .3); mBlast(fr(170), 210, 1.3); });
      mAt(.26, () => {
        mCross(fr(130), hy(), 170, '#fff'); mBlast(fr(190), 240, 1.8); shake = 18;
        mNearestN(P.x, 3, 650).forEach(e => mStrike(e.x, 1.0, 90));
      });
      break;
    case 'KT':
      mAt(0, bolt); mAt(.24, bolt);
      break;
    case 'KM':
      mDash(f, 2600, .3, 3.2);
      mAt(.32, () => { mBlast(fr(90), 230, 2.2); mFx(fr(90), GY - 60, 260, '#ffb15a', .5); shake = 20; });
      break;
    case 'MS':
      mDash(f, 1200, .45, .9, .09);
      mAt(.46, () => { mCross(fr(100), hy(), 180, '#9dffb8'); mBlast(fr(120), 230, 1.6); shake = 14; });
      break;
    case 'MT':
      MECH.buff = { k: 'MT', t: 6, spd: 1.45, tk: 0 };
      P.inv = Math.max(P.inv, .3);
      MECH.vis.push({ k: 'ring', x: P.x, y: GY, r: 220, t: .5, d: .5, col: '110,200,255' });
      break;
    case 'KS':
      for (let i = 0; i < 4; i++) mAt(i * .12, () => { const x = fr(130 + i * 140); mRock(x); mBlast(x, 100, 1.9, { ground: true }); shake = 8 + i * 2; });
      break;
    case 'TT':
      for (let i = 0; i < 5; i++) mAt(i * .26, () => {
        const ts = mNearestN(P.x, 4, 900), tg = ts.length ? ts[Math.random() * ts.length | 0] : null;
        mStrike(tg ? tg.x : fr(200 + Math.random() * 400), 1.3, 120);
      });
      break;
    case 'SS':
      mAt(0, () => { mCross(fr(120), hy(), 220, '#ffd84a'); });
      mAt(.1, () => { mBlast(fr(150), 270, 2.2); shake = 14; });
      mAt(.28, () => { mBlast(fr(160), 300, 2.4); mFx(fr(160), GY - 90, 300, '#ffd84a', .5); shake = 22; });
      break;
    case 'KK':
      mDash(f, 1500, .26, 2.6);
      mAt(.34, () => { mDash(f, 1500, .26, 2.6); });
      mAt(.62, () => { mBlast(fr(100), 240, 1.8); mFx(fr(100), GY - 60, 240, '#ff9a4a', .4); shake = 18; });
      break;
    case 'MM':
      MECH.buff = { k: 'MM', t: 3, spd: 1.8, tk: 0 };
      MECH.vis.push({ k: 'ring', x: P.x, y: GY, r: 200, t: .5, d: .5, col: '125,255,154' });
      break;
  }
}

function updBlade(dt, can) {
  const B = MECH_CFG.blade;
  if (PR.KeyR && can) {
    if (!mIsCapMaxStar()) {
      mToast('觉醒封印中：需将 Blade 胶囊升至 5★ 解锁融合卡牌！', '#ff7675');
    } else if (MECH.cd > 0) mToast('冷却中 ' + MECH.cd.toFixed(1) + 's', '#ffa502');
    else if (MECH.hand.length < B.maxHand) mToast('需要 ' + B.maxHand + ' 张卡牌（命中敌人获得）', '#ffd84a');
    else { const pr = bPair(); MECH.hand = []; bFire(pr); }
  }
}

// =====================================================================
//  Zeztz：超载冲击 (Overdrive)
// =====================================================================
function updZeztz(dt, can) {
  const C = MECH_CFG.zeztz;
  if (MECH.overdrive > 0) {
    MECH.overdrive -= dt;
    if (Math.random() < 0.35) {
      FX.push({ type: 'boom', x: P.x + (Math.random() - 0.5) * 60, y: P.y - 70, t: 0.2, d: 0.2, r: 26, c: '#00f2fe' });
    }
    if (MECH.overdrive <= 0) {
      MECH.overdrive = 0;
      DT.push({ x: P.x, y: P.y - 200, s: 'OVERDRIVE END', t: 1.0, c: '#a4b0be' });
    }
  }
  if (PR.KeyR && can) {
    if (!mIsCapMaxStar()) {
      mToast('核心未破限：需将 Zeztz 胶囊升至 5★ 解锁超载！', '#ff7675');
    } else if (MECH.overdrive > 0) {}
    else if (MECH.cd > 0) mToast('超载充能中 ' + MECH.cd.toFixed(0) + 's', '#ffa502');
    else {
      MECH.overdrive = C.dur;
      MECH.cd = C.cd;
      MECH.mcd = C.cd;
      shake = 16;
      DT.push({ x: P.x, y: P.y - 210, s: 'OVERDRIVE IMPACT!', t: 1.4, c: '#00f2fe' });
      mBlast(P.x, 260, 2.0);
      cancelEP(P.x - 200, P.x + 200);
      FX.push({ type: 'boom', x: P.x, y: GY - 40, t: 0.6, d: 0.6, r: 260, c: '#00f2fe' });
      FX.push({ type: 'boom', x: P.x, y: GY - 40, t: 0.4, d: 0.4, r: 180, c: '#ff4757' });
    }
  }
}

// ---------- 冲刺 / 增益 ----------
function updDash(dt) {
  const d = MECH.dash; d.t -= dt;
  P.x = cl(P.x + d.vx * dt, 30, WW - 30);
  P.inv = Math.max(P.inv, .12);
  if (P.st === 'idle') P.st = 'run';
  d.gt -= dt;
  if (d.gt <= 0) { d.gt = .035; GH.push({ x: P.x, y: P.y, f: P.f, st: 'run', t: .3, d: .3 }); }
  if (d.refresh > 0) { d.rt -= dt; if (d.rt <= 0) { d.rt = d.refresh; d.set = {}; } }
  mBlast(P.x, 105, d.mul, { set: d.set });
  cancelEP(P.x - 80, P.x + 80);
  if (d.t <= 0) MECH.dash = null;
}
function updBuff(dt) {
  const b = MECH.buff; b.t -= dt; b.tk -= dt;
  if (b.k === 'MT') {
    if (b.tk <= 0) { b.tk = .6; const e = mNearest(P.x, 650); if (e) mStrike(e.x, 1.3, 110); }
  } else if (b.k === 'MM') {
    P.inv = Math.max(P.inv, .15);
    if (b.tk <= 0) { b.tk = .2; mBlast(P.x, 120, .9); }
    MECH.gt = (MECH.gt || 0) - dt;
    if (MECH.gt <= 0) { MECH.gt = .04; GH.push({ x: P.x, y: P.y, f: P.f, st: P.st, t: .3, d: .3 }); }
  }
  if (b.t <= 0) MECH.buff = null;
}

// ---------- 主更新（挂在 updBikes 之后，每个战斗帧调用一次）----------
function mechUpdate(dt) {
  if (G !== 'play') return;
  const rk = curRiderKey();
  if (rk !== MECH.rk) mechReset(rk, true);
  if (P.st === 'trans' || P.st === 'trans_ryuki') return;

  for (const v of MECH.vis) v.t -= dt;
  MECH.vis = MECH.vis.filter(v => v.t > 0);
  for (const q of MECH.tl) q.t -= dt;
  const due = MECH.tl.filter(q => q.t <= 0); MECH.tl = MECH.tl.filter(q => q.t > 0);
  due.forEach(q => q.fn());

  if (rk === 'malaya') return;
  MECH.cd = Math.max(0, MECH.cd - dt);
  const can = !P.down && !(typeof COOP !== 'undefined' && COOP && COOP.channeling);

  if (rk === 'ryuki') updRyuki(dt, can);
  else if (rk === '555') updAccel(dt, can);
  else if (rk === 'blade') updBlade(dt, can);
  else if (rk === 'zeztz') updZeztz(dt, can);
  if (MECH.dash) updDash(dt);
  if (MECH.buff) updBuff(dt);
}

// =====================================================================
//  绘制
// =====================================================================
function bCard(x, y, w, h, t, al, rot) {
  const C = BL_CARD[t];
  ctx.save(); ctx.globalAlpha *= (al === undefined ? 1 : al); ctx.translate(x, y); ctx.rotate(rot || 0);
  rpath(-w / 2, -h / 2, w, h, Math.max(2, w * .12));
  ctx.fillStyle = '#f4efe0'; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = C.c; ctx.stroke();
  ut('♠', -w / 2 + w * .22, -h / 2 + h * .18, w * .3, '#222', 'center', { w: 700, sh: 0 });
  ut(C.g, 0, h * .06, w * .55, C.c, 'center', { w: 800 });
  ctx.restore();
}
function rCard(x, y, w, h, on) {
  ctx.save(); ctx.translate(x, y);
  rpath(-w / 2, -h / 2, w, h, 3);
  ctx.fillStyle = on ? '#8a1420' : 'rgba(255,255,255,.06)'; ctx.fill();
  ctx.lineWidth = 1.4; ctx.strokeStyle = on ? '#ffd166' : 'rgba(255,255,255,.2)'; ctx.stroke();
  if (on) ut('龙', 0, 0, w * .62, '#ffd166', 'center', { w: 800, sh: 0 });
  ctx.restore();
}

function mechDrawBack() {
  if (G !== 'play' || !MECH.rk) return;
  for (const s of MECH.shots) {
    if (typeof drawBulletR === 'function') drawBulletR({ x: s.x, y: s.y, vx: s.vx, vy: s.vy });
    else { ctx.save(); ctx.fillStyle = '#ff8a30'; ctx.beginPath(); ctx.arc(s.x - cam, s.y, 16, 0, 7); ctx.fill(); ctx.restore(); }
  }
  if (MECH.dragon) drawDragon(MECH.dragon);
}

function mechDrawFront() {
  if (G !== 'play' || !MECH.rk) return;

  for (const v of MECH.vis) {
    const p = 1 - v.t / v.d, a = 1 - p;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    if (v.k === 'ring') {
      ctx.strokeStyle = 'rgba(' + v.col + ',' + (a * .8).toFixed(3) + ')'; ctx.lineWidth = 5 * a + 1;
      ctx.beginPath(); ctx.ellipse(v.x - cam, v.y + 2, v.r * p, v.r * p * .22, 0, 0, 7); ctx.stroke();
    } else if (v.k === 'slash') {
      const a0 = v.f > 0 ? -1.15 : Math.PI - 1.15, a1 = a0 + 2.3, aa = a0 + (a1 - a0) * Math.min(1, p * 2.4);
      ctx.translate(v.x - cam, v.y); ctx.rotate(v.a * v.f);
      ctx.strokeStyle = v.col; ctx.globalAlpha = a; ctx.shadowColor = v.col; ctx.shadowBlur = 18; ctx.lineWidth = 16 * a + 2;
      ctx.beginPath(); ctx.arc(0, 0, v.r * (.85 + p * .2), a0, aa); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 5 * a + 1; ctx.beginPath(); ctx.arc(0, 0, v.r * (.85 + p * .2), a0, aa); ctx.stroke();
    } else if (v.k === 'cross') {
      const L = v.L * Math.min(1, p * 3 + .2);
      ctx.translate(v.x - cam, v.y); ctx.globalAlpha = a; ctx.shadowColor = v.col; ctx.shadowBlur = 16;
      ctx.strokeStyle = v.col; ctx.lineWidth = 10 * a + 2;
      ctx.beginPath(); ctx.moveTo(-L, -L * .6); ctx.lineTo(L, L * .6); ctx.moveTo(-L, L * .6); ctx.lineTo(L, -L * .6); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
    } else if (v.k === 'strike') {
      const x0 = v.x - cam, N = 9;
      ctx.globalAlpha = a; ctx.shadowColor = '#6cf'; ctx.shadowBlur = 20;
      const path = () => {
        ctx.beginPath(); ctx.moveTo(x0, -30);
        for (let i = 1; i <= N; i++) ctx.lineTo(x0 + (i < N ? (mHz(v.seed + i + (T * 30 | 0)) - .5) * 60 : 0), -30 + (GY - 10 + 30) * i / N);
        ctx.stroke();
      };
      ctx.strokeStyle = 'rgba(90,190,255,.55)'; ctx.lineWidth = 14 * a + 2; path();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; path();
      ctx.fillStyle = 'rgba(160,225,255,' + (a * .6).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(x0, GY + 2, 90 * (.4 + p), 16, 0, 0, 7); ctx.fill();
    } else if (v.k === 'rock') {
      ctx.globalCompositeOperation = 'source-over';
      const up = p < .35 ? mEase(p / .35) : 1 - Math.max(0, (p - .6) / .4);
      for (let i = 0; i < 5; i++) {
        const bx = v.x - cam + (i - 2) * 28, h = (70 + (i % 2) * 40 + mHz(v.x + i) * 24) * up;
        ctx.fillStyle = '#7a5a3a'; ctx.strokeStyle = '#e0c08a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(bx - 17, GY + 8); ctx.lineTo(bx + (mHz(i + v.x) - .5) * 14, GY + 8 - h); ctx.lineTo(bx + 17, GY + 8); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Blade：手牌环绕
  if (MECH.rk === 'blade' && MECH.hand.length) {
    MECH.hand.forEach((t, i) => {
      const an = T * 1.8 + i * Math.PI, x = P.x - cam + Math.cos(an) * 56, y = P.y - 150 + Math.sin(an) * 18 - 8 * Math.sin(T * 3 + i);
      bCard(sn(x), sn(y), 24, 34, t, .95, Math.sin(an) * .25);
    });
  }

  // 555 Accel：红色暗角 + 倒计时 + 速度线
  if (MECH.rk === '555' && MECH.accel > 0) {
    ctx.save(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const gr = ctx.createRadialGradient(480, 270, 180, 480, 270, 620);
    gr.addColorStop(0, 'rgba(255,40,40,0)'); gr.addColorStop(1, 'rgba(255,40,40,.3)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, 960, 540);
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 9; i++) {
      const y = 60 + mHz(i * 7.3 + (T * 14 | 0)) * 400, x = mHz(i * 3.1 + (T * 14 | 0)) * 960, L = 80 + mHz(i) * 120;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + L * -P.f, y); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ut(String(Math.ceil(MECH.accel)), 480, 104, 56, 'rgba(255,209,102,.5)', 'center', { w: 800, sh: 0 });
    ctx.restore();
  }

  // Zeztz Overdrive：青蓝色聚能辉光暗角 + 倒计时
  if (MECH.rk === 'zeztz' && MECH.overdrive > 0) {
    ctx.save(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const gr = ctx.createRadialGradient(480, 270, 180, 480, 270, 620);
    gr.addColorStop(0, 'rgba(0,242,254,0)'); gr.addColorStop(1, 'rgba(0,242,254,.25)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, 960, 540);
    ut(String(Math.ceil(MECH.overdrive)), 480, 104, 56, 'rgba(0,242,254,.55)', 'center', { w: 800, sh: 0 });
    ctx.restore();
  }
}

// ---------- HUD：技能栏右侧第 6 格（R）----------
function mechHUD() {
  if (G !== 'play' || !MECH.rk || MECH.rk === 'malaya') return;
  const rk = MECH.rk, sz = 44, gap = 10, total = 5 * sz + 4 * gap, sx = (960 - total) / 2, x = sx + total + gap, y = 468;
  const col = rk === 'ryuki' ? '#ff4757' : rk === '555' ? '#ffb400' : rk === 'blade' ? '#3aa0ff' : '#00f2fe';
  const isMaxStar = mIsCapMaxStar();
  const act = isMaxStar && ((rk === '555' && MECH.accel > 0) || (rk === 'zeztz' && MECH.overdrive > 0));
  
  let ready, name, icon;
  if (!isMaxStar) {
    ready = false;
    name = 'LOCKED';
    icon = '🔒';
  } else {
    if (rk === 'ryuki') { ready = MECH.cards > 0 && MECH.cd <= 0; name = 'ADVENT'; icon = '龙'; }
    else if (rk === '555') { ready = MECH.cd <= 0 || act; name = 'ACCEL'; icon = 'Φ'; }
    else if (rk === 'blade') { ready = MECH.hand.length >= 2 && MECH.cd <= 0; name = 'FUSION'; icon = '♠'; }
    else if (rk === 'zeztz') { ready = MECH.cd <= 0 || act; name = 'OVERDRIVE'; icon = '⚡'; }
  }

  ctx.save();
  cutPath(x, y, sz, sz, 9); ctx.fillStyle = isMaxStar ? 'rgba(12,16,28,.9)' : 'rgba(8,10,16,.95)'; ctx.fill();
  ctx.save(); cutPath(x + 2, y + 2, sz - 4, sz - 4, 7); ctx.clip();
  const g = ctx.createLinearGradient(x, y, x, y + sz);
  g.addColorStop(0, (isMaxStar ? col : '#555555') + (ready || act ? '99' : '33'));
  g.addColorStop(1, (isMaxStar ? col : '#555555') + (ready || act ? '33' : '11'));
  ctx.fillStyle = g; ctx.fillRect(x, y, sz, sz); ctx.restore();

  ut(icon, x + sz / 2, y + sz / 2 + 1, isMaxStar ? 22 : 18, ready || act ? '#fff' : '#678', 'center', { w: 800 });
  cutPath(x, y, sz, sz, 9); ctx.lineWidth = 1.3;
  ctx.strokeStyle = act ? '#ffd166' : ready ? col : 'rgba(255,255,255,.14)';
  ctx.shadowColor = ready || act ? col : 'transparent'; ctx.shadowBlur = 8; ctx.stroke();
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';

  // 冷却遮罩（未解锁时不走冷却动画）
  if (isMaxStar && MECH.cd > 0 && !act) {
    const frac = cl(MECH.cd / (MECH.mcd || 1), 0, 1);
    ctx.save(); cutPath(x, y, sz, sz, 9); ctx.clip(); ctx.fillStyle = 'rgba(0,0,0,.68)';
    ctx.beginPath(); ctx.moveTo(x + sz / 2, y + sz / 2); ctx.arc(x + sz / 2, y + sz / 2, sz, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); ctx.closePath(); ctx.fill(); ctx.restore();
    ut(MECH.cd >= 10 ? MECH.cd.toFixed(0) : MECH.cd.toFixed(1), x + sz / 2, y + sz / 2, 13, '#f3e3b0', 'center', { w: 700 });
  }
  if (act) ut((rk === '555' ? MECH.accel : MECH.overdrive).toFixed(1), x + sz / 2, y + sz / 2, 14, '#fff', 'center', { w: 800 });

  // 按键角标 R
  rpath(x - 3, y - 4, 16, 14, 4); ctx.fillStyle = '#080c16'; ctx.fill(); ctx.strokeStyle = 'rgba(217,189,125,.8)'; ctx.lineWidth = 1; ctx.stroke();
  ut('R', x + 5, y + 3, 9, '#f3e3b0', 'center', { w: 700, sh: 0 });

  // 右侧状态与满星未解锁提示
  const wx = x + sz + 10;
  if (!isMaxStar) {
    ut('专属特技', wx, y + 5, 10, '#8fa0b3', 'left', { w: 800, sp: 1.2, sh: 0 });
    ut('需 5★ 解锁', wx, y + 25, 11, '#ff6b7a', 'left', { w: 700, sh: 0 });
    const curStar = typeof capStar === 'function' ? capStar(rk) : 0;
    ut(`(当前 ${curStar}/5 星)`, wx, y + 42, 10, '#ffd84a', 'left', { w: 700, sh: 0 });
  } else {
    ut(name, wx, y + 5, 10, col, 'left', { w: 800, sp: 1.2, sh: 0 });
    if (rk === 'ryuki') {
      for (let i = 0; i < MECH_CFG.ryuki.maxCards; i++) rCard(wx + 10 + i * 24, y + 28, 20, 28, i < MECH.cards);
      const pr = cl(1 - MECH.auto / MECH_CFG.ryuki.autoEvery, 0, 1);
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(wx, y + 46, 72, 3);
      ctx.fillStyle = MECH.dragon ? '#ffd166' : '#ff7a4a'; ctx.fillRect(wx, y + 46, 72 * (MECH.dragon ? 1 : pr), 3);
    } else if (rk === '555') {
      const frac = act ? MECH.accel / MECH_CFG.k555.dur : 1 - cl(MECH.cd / (MECH.mcd || 1), 0, 1);
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(wx, y + 30, 72, 6);
      ctx.fillStyle = act ? '#ff5a3a' : frac >= 1 ? '#ffd166' : '#9a8a5a'; ctx.fillRect(wx, y + 30, 72 * frac, 6);
      ut(act ? '加速中' : frac >= 1 ? 'READY' : '充能中', wx, y + 44, 10, act ? '#ffd166' : UIC.sub, 'left', { w: 700, sh: 0 });
    } else if (rk === 'blade') {
      for (let i = 0; i < MECH_CFG.blade.maxHand; i++) {
        const t = MECH.hand[i];
        if (t) bCard(wx + 14 + i * 32, y + 28, 26, 36, t, 1, 0);
        else { rpath(wx + 1 + i * 32, y + 10, 26, 36, 3); ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]); }
      }
      if (MECH.hand.length >= 2) ut('→ ' + BL_COMBO[bPair()].cn, wx, y + 55, 11, BL_COMBO[bPair()].c, 'left', { w: 800 });
      else {
        const pr = MECH.hits / MECH_CFG.blade.hitsPerCard;
        ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(wx, y + 52, 64, 3);
        ctx.fillStyle = '#5ec8ff'; ctx.fillRect(wx, y + 52, 64 * pr, 3);
      }
    } else if (rk === 'zeztz') {
      const frac = act ? MECH.overdrive / MECH_CFG.zeztz.dur : 1 - cl(MECH.cd / (MECH.mcd || 1), 0, 1);
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(wx, y + 30, 72, 6);
      ctx.fillStyle = act ? '#00f2fe' : frac >= 1 ? '#ffd84a' : '#5a8a9a'; ctx.fillRect(wx, y + 30, 72 * frac, 6);
      ut(act ? '超载中' : frac >= 1 ? 'READY' : '充能中', wx, y + 44, 10, act ? '#00f2fe' : UIC.sub, 'left', { w: 700, sh: 0 });
    }
  }
  ctx.restore();
}

// =====================================================================
//  把机制“包”进现有系统（不改其它文件）
// =====================================================================
(function hook() {
  const wrap = (name, make) => { try { if (typeof window[name] === 'function') window[name] = make(window[name]); else console.warn('[mechanics] 找不到函数', name); } catch (e) { console.warn('[mechanics] 挂接失败', name, e); } };

  wrap('begin', orig => function () { mechReset(); return orig.apply(this, arguments); });
  wrap('updBikes', orig => function (dt) { const r = orig.apply(this, arguments); mechUpdate(dt); return r; });
  wrap('drawP', orig => function () { mechDrawBack(); const r = orig.apply(this, arguments); mechDrawFront(); return r; });
  wrap('drawSkillBarHUD', orig => function () { const r = orig.apply(this, arguments); mechHUD(); return r; });

  const ts = () => (G === 'play' && MECH.rk === '555' && MECH.accel > 0 && !mCoop()) ? MECH_CFG.k555.ts : 1;
  wrap('updEnemy', orig => function (e, dt) { return orig.call(this, e, dt * ts()); });
  wrap('updBattleFx', orig => function (dt) { return orig.call(this, dt * ts()); });

  wrap('formSpd', orig => function () {
    let m = 1;
    if (G === 'play') { if (MECH.rk === '555' && MECH.accel > 0) m *= mCoop() ? MECH_CFG.k555.coopSpd : MECH_CFG.k555.spd; if (MECH.buff) m *= MECH.buff.spd; }
    return orig.apply(this, arguments) * m;
  });

  wrap('hurt', orig => function (e, d, pre) {
    if (G === 'play' && MECH.rk === 'zeztz' && MECH.overdrive > 0 && !pre) {
      d *= MECH_CFG.zeztz.atkMul;
    }
    const r = orig.call(this, e, d, pre);
    if (!pre && G === 'play' && MECH.rk === 'blade' && mIsCapMaxStar() && T >= MECH.noDrawT && MECH.hand.length < MECH_CFG.blade.maxHand) {
      if (++MECH.hits >= MECH_CFG.blade.hitsPerCard) {
        MECH.hits = 0; const c = bDraw(); MECH.hand.push(c);
        DT.push({ x: P.x, y: P.y - 230, s: '+♠' + BL_CARD[c].g, t: .8, c: BL_CARD[c].c });
      }
    }
    return r;
  });
})();

// ---------- 触屏按键（R）：只在变身后的战斗里出现 ----------
(function touchBtn() {
  if (typeof TOUCH === 'undefined' || !TOUCH) return;
  const t0 = setInterval(() => {
    const ui = document.getElementById('tc'); if (!ui) return; clearInterval(t0);
    const b = document.createElement('div'); b.className = 'b skl sk-r';
    b.style.cssText = (window.TC_POS && TC_POS.R || 'right:calc(var(--s)*3.95 + 3vmin);bottom:calc(var(--s)*1.45 + 3vmin)') + ';display:none';
    b.innerHTML = '<span class="t"></span><span class="cd"></span>';
    const tEl = b.querySelector('.t'), cdEl = b.querySelector('.cd');
    ui.appendChild(b);
    b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('on'); if (!K.KeyR) PR.KeyR = 1; K.KeyR = 1; });
    const up = () => { b.classList.remove('on'); K.KeyR = 0; };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    let lastCd = '', lastT = '';
    setInterval(() => {
      const on = G === 'play' && typeof inForm === 'function' && inForm() && !(window.tcHidden && tcHidden());
      b.style.display = on ? 'flex' : 'none';
      if (!on) return;
      const isMax = mIsCapMaxStar();
      let t = '';
      if (!isMax) {
        t = '🔒<br>需5★';
      } else {
        t = P.ryuki ? '契约<br>Advent' : P.k5 ? 'Accel' : P.bl ? '卡牌<br>合成' : '超载<br>Overdrive';
      }
      if (t !== lastT) { lastT = t; tEl.innerHTML = t; }

      const act = isMax && ((P.k5 && MECH.accel > 0) || (P.zeztz && MECH.overdrive > 0));
      let frac = 0;
      if (isMax) {
        if (P.k5 && MECH.accel > 0) frac = 1 - MECH.accel / MECH_CFG.k555.dur;
        else if (P.zeztz && MECH.overdrive > 0) frac = 1 - MECH.overdrive / MECH_CFG.zeztz.dur;
        else if (MECH.cd > 0) frac = cl(MECH.cd / (MECH.mcd || 1), 0, 1);
      }
      const v = frac > 0 ? 'conic-gradient(rgba(0,0,0,.62) ' + (frac * 360).toFixed(1) + 'deg, transparent 0)' : '';
      if (v !== lastCd) { lastCd = v; cdEl.style.background = v; }

      const low = !isMax || (!act && ((P.ryuki && MECH.cards <= 0) || (P.bl && MECH.hand.length < 2)));
      b.classList.toggle('low', low);
      b.style.boxShadow = act ? '0 0 16px #00e5ff' : '';
    }, 50);
  }, 200);
})();