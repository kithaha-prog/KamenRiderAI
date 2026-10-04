// ===== 假面骑士 龙骑 (Ryuki) 专属逻辑：素材加载 / 变身动画 / 形态绘制 / L 飞剑 / 大招烈焰飞踢 =====
// 素材与参数见 config.js 中的 SHR / RYUKI ；形态标记：P.ryuki ；变身入口：player.js 的 triggerRyukiTransform()
// 放在 ryuki.js 顶部第 4 行左右
let GUNR = null, BULR = null;
// ---------- 素材加载（由 main.js 的 prep() 调用）----------
async function loadRyukiAssets() {
  try { CAP_IMG = await load(DRAW + 'KR_Ryuki.jpg'); CAP_IMGS.ryuki = CAP_IMG } catch (e) { miss.push('Draw/KR_Ryuki.jpg') }

  try {
    let trIm;
    try { trIm = await load(TRANS + 'KR_Malaya_TrasnformTo_KR_Ryuki.png'); }
    catch (e) { trIm = await load(TRANS + 'KR_Malaya_TransformTo_KR_Ryuki.png'); }
    SH.ryukiTrans = sliceSheet(trIm, 4, 4, 0, 0, true);
  } catch (e) { miss.push('Transform/KR_Malaya_TrasnformTo_KR_Ryuki.png'); }

  // 龙骑 L 技能素材：召龙手枪 + 火球子弹
  try { const g = await load(RYUKI + 'KR_Ryuki_HandDragon.png'); GUNR = trim(toCanvas(g)); } catch (e) { miss.push('Kamen Rider Ryuki/KR_Ryuki_HandDragon.png'); }
  try { const b = await load(RYUKI + 'KR_Ryuki_Bullet.png'); BULR = trim(toCanvas(b)); } catch (e) { miss.push('Kamen Rider Ryuki/KR_Ryuki_Bullet.png'); }

  for (const [key, o] of Object.entries(SHR)) {
    try {
      let im;
      if (key === 'fv') {
        const tryNames = ['KR_Ryuki_FinalVent.png', 'ryuki_finalvent.png', 'Ryuki_FinalVent.png', 'KR_Ryuki_Finalvent.png'];
        for (const fn of tryNames) {
          try { im = await load(RYUKI + fn); if (im) break; } catch(err) {}
        }
        if (!im) im = await load(RYUKI + o.f);
      } else {
        im = await load(RYUKI + o.f);
      }

      const doClean = (key !== 'fv' && key !== 'run');
      const rVal = o.r !== undefined ? o.r : 4;
      const cVal = o.c !== undefined ? o.c : 4;
      const refVal = o.ref !== undefined ? o.ref : 0;

      Object.assign(o, sliceSheet(im, cVal, rVal, refVal, o.cut || 0, doClean));

      if (key === 'sword') {
        const b = bb(o.f[o.ref]);
        if (o.w) o.s = o.w / (b.x1 - b.x0);
      } else if (key !== 'jump' && key !== 'fv' && SH.atk && SH.atk.s) {
        o.s = SH.atk.s;
      }
    } catch (e) {
      miss.push('Kamen Rider Ryuki/' + o.f);
    }
  }
}

// ---------- 【原本的音效】龙骑变身音效（Assets/SoundFX/）----------
// 优先匹配你本地的 .m4a 文件
const RYUKI_SND_FILES = [
  'Kamen Rider Ryuki Henshin.m4a',
  'Kamen_Rider_Ryuki_Henshin.m4a',
  'Kamen Rider Ryuki Henshin.mp3',
  'Kamen_Rider_Ryuki_Henshin.mp3'
];
const RYUKI_TRANS_DEF = 16 * 0.12, RYUKI_TRANS_SEQ = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
let SNDR = null;

(function initRyukiSound() {
  let i = 0;
  const next = () => {
    if (i >= RYUKI_SND_FILES.length) { SNDR = null; return; }
    const a = new Audio(); a.preload = 'auto';
    a.addEventListener('error', next, { once: true });
    a.src = encodeURI(A + 'SoundFX/' + RYUKI_SND_FILES[i++]);
    SNDR = a;
  };
  next();
})();

function ryukiTransDur() { return SNDR && isFinite(SNDR.duration) && SNDR.duration > 0.5 ? SNDR.duration : RYUKI_TRANS_DEF; }
function playRyukiHenshin() { if (!SNDR) return; try { SNDR.currentTime = 0; const p = SNDR.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
function stopRyukiHenshin() { if (SNDR && !SNDR.paused) SNDR.pause(); }

// ---------- 变身动画 ----------
function drawRyukiTransform(x, y, f) {
  const q = Math.min(15.999, P.t / (P.tdur || RYUKI_TRANS_DEF) * 16);
  drawTransSeq(SH.ryukiTrans, RYUKI_TRANS_SEQ, q, x, y, f, RYUKI_PAL);
}

// ---------- 龙骑形态总绘制 ----------
function drawRyuki(x, y, f) {
  ctx.save();
  ctx.shadowColor = '#ff4757';
  ctx.shadowBlur = (P.st === 'run') ? 4 : (10 + Math.sin(T * 6) * 4);

  if (P.st === 'run') {
    if (SHR.run && SHR.run.f && SHR.run.f.length) {
      // 注意：ui.js 的 dr() 也会把 SHR.run.bbs 建成【稀疏数组】（只填用过的帧），所以不能用 !bbs 判断，要按帧懒计算
      if (!SHR.run.bbs) SHR.run.bbs = [];
      const totalRunFrames = Math.min(4, SHR.run.f.length);
      const runIdx = Math.abs(T * (P.spr ? 13 : 9) | 0) % totalRunFrames;
      const b = SHR.run.bbs[runIdx] || (SHR.run.bbs[runIdx] = bb(SHR.run.f[runIdx]));
      const realCenterX = (b.x0 + b.x1) / 2;
      const realFootY = b.y1;

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(f * SHR.run.s, SHR.run.s);
      ctx.drawImage(SHR.run.f[runIdx], -realCenterX, -realFootY);
      ctx.restore();
    } else {
      dr(SH.run, (T * (P.spr ? 20 : 12) | 0) % 12, x, y, f, 1.0);
    }
  } else if (P.st === 'atk') {
    if (SHR.atk && SHR.atk.f && SHR.atk.f.length) {
      const total = SHR.atk.f.length;
      const atkIdx = Math.min(total - 1, (P.t * 16 | 0) % total);
      dr(SHR.atk, atkIdx, x, y, f, 1.0);
    } else {
      const i = [3, 4, 5, 6, 7, 8][Math.min(5, P.t * 14 | 0)];
      dr(SH.atk, i, x, y, f, 1.0);
    }
  } else if (P.st === 'idle' && P.land > 0 && SHR.jump && SHR.jump.f && SHR.jump.f.length) {
    dr(SHR.jump, 7, x, y, f, 1.0);
  } else if (P.st === 'idle' || P.st === 'trans') {
    if (SH.ryukiTrans && SH.ryukiTrans.f[15]) {
      const breath = Math.sin(T * 3) * 1.2;
      drC(SH.ryukiTrans, 15, x, y + breath, f, 1.0);
    } else {
      dr(SH.atk, 12, x, y, f, 1.0);
    }
  } else if (P.st === 'air') {
    if (SHR.jump && SHR.jump.f && SHR.jump.f.length) {
      const i = P.vy < -350 ? 2 : P.vy < -100 ? 3 : P.vy < 100 ? 4 : P.vy < 250 ? 5 : 6;
      dr(SHR.jump, i, x, y, f, 1.0);
    } else if (SHR.run && SHR.run.f[1]) {
      dr(SHR.run, 1, x, y - 5, f, 1.0);
    } else {
      dr(SH.jump, 2, x, y, f, 1.0);
    }
  } else if (P.st === 'thr') {
    drawRyukiGunPose(x, y, f);
  } else if (P.st === 'fv') {
    drawRyukiFV(x, y, f);
  } else {
    let S = SH.atk, i = 12;
    if (P.st === 'thr') i = P.t < .12 ? 3 : 4;
    dr(S, i, x, y, f, 1.0);
  }

  ctx.restore();
}

// ---------- L 技能：召龙手枪（Hand Dragon）+ 火球弹 ----------
// hx/hy = 手在世界里相对脚底的偏移（hx 朝面向方向为正，hy 向上为负），按龙骑“举手”动作微调即可；
// w = 枪在游戏中的宽度；gx/gy = 握持点在枪图中的位置比例；mx/my = 龙口(枪口)位置比例；spd = 子弹速度；bw = 火球宽度
const RYUKI_GUN = { w: 80, gx: .30, gy: .55, mx: .95, my: .47, spd: 1400, bw: 190,
  fx: 365, fy: 250,          // 枪握持点：在 FinalVent 第 1 帧（左臂戴着 Drag Visor 的“插卡”姿势）里的像素坐标（512 格内）
  hx: 30, hy: -PH * .58 };   // 备用：FinalVent 素材没加载到时，枪相对脚底的位置

// 手的位置（相对脚底，x 朝面向方向为正，y 向上为负）
function ryukiHandLocal() {
  const G = RYUKI_GUN, V = SHR.fv;
  if (okS(V) && V.f[1]) return { x: (G.fx - RYUKI_FV_AX[1]) * V.s * V.cw / 512, y: (G.fy - V.fy) * V.s };
  return { x: G.hx, y: G.hy };
}
function ryukiHandWorld() { const h = ryukiHandLocal(); return { x: P.x + P.f * h.x, y: P.y + h.y }; }

// 自动瞄准：朝面向方向最近的敌人身体中部；没有目标就平射
function ryukiAim() {
  const h = ryukiHandWorld(); let best = null, bd = 1e9;
  for (const e of E) {
    const dx = (e.x - h.x) * P.f;
    if (dx > -30 && dx < 950 && dx < bd) { bd = dx; best = e; }
  }
  if (!best) return 0;
  return cl(Math.atan2(best.y - best.h * .55 - h.y, Math.max(80, bd)), -.55, .55);
}

function ryukiMuzzleWorld(ang) {
  const G = RYUKI_GUN, gw = G.w, gh = GUNR ? gw * GUNR.height / GUNR.width : gw, h = ryukiHandWorld();
  const lx = (G.mx - G.gx) * gw, ly = (G.my - G.gy) * gh, c = Math.cos(ang), s = Math.sin(ang);
  return { x: h.x + P.f * (lx * c - ly * s), y: h.y + (lx * s + ly * c) };
}

// ---------- 【L 技能音效】Strike Vent（Assets/SoundFX/）----------
const RYUKI_L_SND_FILES = [
  'Kamen_Rider_Ryuki_Strike_Vent.mp3',
  'Kamen Rider Ryuki Strike Vent.mp3',
  'Kamen_Rider_Ryuki_Strike_Vent.m4a',
  'Kamen Rider Ryuki Strike Vent.m4a'
];
let SND_L = null;

(function initRyukiLSound() {
  let i = 0;
  const next = () => {
    if (i >= RYUKI_L_SND_FILES.length) { SND_L = null; return; }
    const a = new Audio(); a.preload = 'auto';
    a.addEventListener('error', next, { once: true });
    a.src = encodeURI(A + 'SoundFX/' + RYUKI_L_SND_FILES[i++]);
    SND_L = a;
  };
  next();
})();

// 用 cloneNode 播放，连按 L 时音效可以重叠而不是被打断
function playRyukiL() {
  if (!SND_L) return;
  try {
    const a = SND_L.cloneNode(); a.volume = SND_L.volume;
    const p = a.play(); if (p && p.catch) p.catch(() => {});
  } catch (e) {}
}

function fireRyukiGun() {
  const ang = ryukiAim(), m = ryukiMuzzleWorld(ang), v = RYUKI_GUN.spd;
  playRyukiL();
  PJ.push({ x: m.x, y: m.y, vx: P.f * Math.cos(ang) * v, vy: Math.sin(ang) * v, f: P.f, t: .8, h: {}, rb: 1 });
  FX.push({ type: 'boom', x: m.x, y: m.y, t: .18, d: .18, r: 40, c: '#ff8a30' });
  shake = Math.max(shake, 3);
}

// 投掷姿势：用 FinalVent 第 1 帧——龙骑本来就是把召龙手枪(Drag Visor)戴在左前臂上、举在腹前的姿势，
// 手里没刀；枪画在他的前臂位置，随瞄准角旋转，不需要另外画手臂。
function drawRyukiGunPose(x, y, f) {
  const G = RYUKI_GUN, V = SHR.fv, h = ryukiHandLocal();
  if (okS(V) && V.f[1]) drFV(V, 1, x, y, f, 1.0);
  else if (SH.ryukiTrans && SH.ryukiTrans.f[15]) drC(SH.ryukiTrans, 15, x, y, f, 1.0);
  else dr(SH.atk, 12, x, y, f, 1.0);
  if (!GUNR) return;

  const ang = ryukiAim(), gw = G.w, gh = gw * GUNR.height / GUNR.width;
  const rec = (P.t >= .12 && P.t < .2) ? 5 : 0;   // 后坐力

  ctx.save();
  ctx.shadowBlur = 0;
  ctx.translate(x + f * h.x, y + h.y); ctx.scale(f, 1); ctx.translate(-rec, 0); ctx.rotate(ang);
  ctx.drawImage(GUNR, -G.gx * gw, -G.gy * gh, gw, gh);

  // 龙口喷火光
  if (P.t >= .1 && P.t < .26) {
    const mx = (G.mx - G.gx) * gw, my = (G.my - G.gy) * gh, k = 1 - (P.t - .1) / .16;
    const gr = ctx.createRadialGradient(mx, my, 0, mx, my, 30 * k + 8);
    gr.addColorStop(0, 'rgba(255,240,190,1)'); gr.addColorStop(.4, 'rgba(255,140,40,.85)'); gr.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(mx, my, 30 * k + 8, 0, 7); ctx.fill();
  }
  ctx.restore();
}

// 火球子弹：原图火球朝左飞、拖尾在右 → 水平镜像后弹头朝前
function drawBulletR(s) {
  const ang = Math.atan2(s.vy || 0, s.vx);
  ctx.save(); ctx.translate(s.x - cam, s.y); ctx.rotate(ang);
  if (BULR) {
    ctx.globalCompositeOperation = 'lighter';
    const w = RYUKI_GUN.bw, h = w * BULR.height / BULR.width;
    ctx.scale(-1, 1);
    ctx.drawImage(BULR, -w * .35, -h / 2, w, h);   // 弹头在前，拖尾在身后
  } else {
    ctx.strokeStyle = '#ff8a30'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-80, 0); ctx.lineTo(20, 0); ctx.stroke();
  }
  ctx.restore();
}

// （旧版飞剑保留，不再由 L 键触发）
function fireRyukiSword() {
  PJ.push({ x: P.x + P.f * 60, y: P.y - 100, vx: P.f * 800, f: P.f, t: 1.1, h: {}, ry: 1 });
}

function drawRyukiSword(s) {
  const SW = (SHR.sword && SHR.sword.f && SHR.sword.f.length) ? SHR.sword : SH.sword;
  dr(SW, 0, s.x - cam, s.y, -s.f, 1, 1, 1);
}

// ---------- 【新增的大招音效】（Assets/SoundFX/）----------
const RYUKI_FV_SND_FILES = [
  'Kamen Rider Ryuki Final Vent.mp3',
  'Kamen Rider Ryuki Final Vent.m4a',
  'Kamen_Rider_Ryuki_Final_Vent.mp3',
  'Kamen_Rider_Ryuki_Final_Vent.m4a'
];
const RYUKI_FV_TD_FILES = [
  'Kamen Rider Ryuki Final Vent TouchDown.mp3',
  'Kamen Rider Ryuki Final Vent TouchDown.m4a',
  'Kamen_Rider_Ryuki_Final_Vent_TouchDown.mp3',
  'Kamen_Rider_Ryuki_Final_Vent_TouchDown.m4a'
];

let SND_FV = null;
let SND_FV_TD = null;

(function initRyukiFVSounds() {
  function loadSnd(list, cb) {
    let i = 0;
    const next = () => {
      if (i >= list.length) return;
      const a = new Audio();
      a.preload = 'auto';
      a.addEventListener('error', next, { once: true });
      a.src = encodeURI(A + 'SoundFX/' + list[i++]);
      cb(a);
    };
    next();
  }
  loadSnd(RYUKI_FV_SND_FILES, a => { SND_FV = a; });
  loadSnd(RYUKI_FV_TD_FILES, a => { SND_FV_TD = a; });
})();

function ryukiFvLandDur() {
  return (SND_FV_TD && isFinite(SND_FV_TD.duration) && SND_FV_TD.duration > 0.5)
    ? SND_FV_TD.duration
    : 2.5;
}

function playRyukiFV() {
  if (!SND_FV) return;
  try {
    SND_FV.currentTime = 0;
    const p = SND_FV.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {}
}

function stopRyukiFV() {
  if (SND_FV && !SND_FV.paused) SND_FV.pause();
}

function playRyukiFVTouchDown() {
  stopRyukiFV();
  if (!SND_FV_TD) return;
  try {
    SND_FV_TD.currentTime = 0;
    const p = SND_FV_TD.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {}
}

function stopRyukiFVTouchDown() {
  if (SND_FV_TD && !SND_FV_TD.paused) SND_FV_TD.pause();
}

function stopAllRyukiFVSounds() {
  stopRyukiFV();
  stopRyukiFVTouchDown();
}

// ---------- 大招 K：FINAL VENT · 龙骑飞踢（补帧与时长配合）----------
const RYUKI_FV = { card: .22, insert: .5, stand: .8, crouch: 1.05, launch: 1.22, rise: 1.42, spin: 1.92, swirl: 2.07, hold1: 2.32, dive: 2.55 };
const RYUKI_FV_AX = [281, 309, 280, 275, 301, 285, 290, 250, 258, 310, 270, 274, 272, 262, 272, 263];
const RYUKI_FV_SPIN_Y = 250;

function drFV(S, i, x, y, f, al = 1) {
  const fr = S.f[i]; if (!fr) return;
  ctx.save(); ctx.globalAlpha *= al; ctx.translate(sn(x), sn(y)); ctx.scale(f * S.s, S.s);
  ctx.drawImage(fr, -(RYUKI_FV_AX[i] * S.cw / 512), -S.fy); ctx.restore();
}

function drFVBlend(S, iA, iB, mix, x, y, f, al = 1) {
  mix = cl(mix, 0, 1);
  if (mix <= 0.02) drFV(S, iA, x, y, f, al);
  else if (mix >= 0.98) drFV(S, iB, x, y, f, al);
  else {
    drFV(S, iA, x, y, f, al * (1 - mix));
    drFV(S, iB, x, y, f, al * mix);
  }
}

// 后摇标准动作时长（秒）：1.25s 完成从下砸爆破到起身，动作干净利落
const RYUKI_LAND_ANIM_DUR = 1.25;

// ---------- 绘制大招（适配 1.25s 快速后摇与补帧）----------
function drawRyukiFV(x, y, f) {
  const S_ = SHR.fv;
  if (!okS(S_)) { dr(SH.atk, 12, x, y, f, 1.0); return; }
  const Z = RYUKI_FV, t = P.t;

  // 1. 落地阶段：在 1.25 秒内利落完成爆破与起身
  if (P.hit['landed']) {
    const d = t - P.landT;
    const dur = RYUKI_LAND_ANIM_DUR;
    const p = cl(d / dur, 0, 1);

    // 落地后坐力微动（前 0.12 秒下沉回弹）
    const recoil = (p < 0.12) ? Math.sin((p / 0.12) * Math.PI) * 5 : 0;
    const curY = y + recoil;

    // 紧凑四段补帧（11 撞地 -> 13 红光爆破 -> 14 单膝烟尘 -> 15 快速起身）
    if (p < 0.16) {
      const mix = p < 0.05 ? 0 : (p - 0.05) / 0.11;
      drFVBlend(S_, 11, 13, mix, x, curY, f);
    } else if (p < 0.45) {
      const mix = p < 0.22 ? 0 : (p - 0.22) / 0.23;
      drFVBlend(S_, 13, 14, mix, x, curY, f);
    } else if (p < 0.85) {
      const mix = p < 0.55 ? 0 : (p - 0.55) / 0.30;
      drFVBlend(S_, 14, 15, mix, x, curY, f);
    } else {
      drFV(S_, 15, x, curY, f);
    }

    // 地面余波烈焰光环
    const flameAlpha = Math.max(0, 1 - p * 1.5);
    if (flameAlpha > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const rad = 160 * (1 - p * 0.4);
      const gr = ctx.createRadialGradient(x + f * 50, GY - 12, 10, x + f * 50, GY - 12, rad);
      gr.addColorStop(0, `rgba(255, 120, 40, ${flameAlpha * 0.5})`);
      gr.addColorStop(0.6, `rgba(255, 40, 10, ${flameAlpha * 0.2})`);
      gr.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(x + f * 50, GY - 12, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    return;
  }

  // 2. 45° 砸落阶段：高密度运动残影补帧
  if (t >= Z.dive) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 5; k >= 1; k--) drFV(S_, 12, x - f * k * 16, y - k * 16, f, 0.15 * (6 - k));
    ctx.restore();
    drFV(S_, 12, x, y, f);
    return;
  }

  // 3. 旋涡蓄力与抬腿瞄准阶段
  if (t >= Z.spin) {
    let iA, iB, mix = 0;
    if (t < Z.swirl) { iA = 10; iB = 9; mix = (t - Z.spin) / (Z.swirl - Z.spin); }
    else if (t < Z.hold1) { iA = 9; iB = 8; mix = (t - Z.swirl) / (Z.hold1 - Z.swirl); }
    else { iA = 8; iB = 8; mix = 0; }
    drFVBlend(S_, iA, iB, mix > 0.7 ? (mix - 0.7) / 0.3 : 0, x, y, f);
    return;
  }

  // 4. 空中 360° 转体阶段
  if (t >= Z.rise) {
    const p = cl((t - Z.rise) / (Z.spin - Z.rise), 0, 1);
    const e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    const ang = e * Math.PI * 2;
    const fr = S_.f[6], s = S_.s, off = (S_.fy - RYUKI_FV_SPIN_Y) * s;
    if (fr) {
      ctx.save(); ctx.translate(sn(x), sn(y - off)); ctx.rotate(ang * f); ctx.scale(f * s, s);
      ctx.drawImage(fr, -(RYUKI_FV_AX[6] * S_.cw / 512), -RYUKI_FV_SPIN_Y); ctx.restore();
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const a0 = T * 14 + k * 2.1;
      ctx.strokeStyle = 'rgba(255,' + (120 + k * 40) + ',40,' + (.55 - k * .1) + ')';
      ctx.lineWidth = 6 - k;
      ctx.beginPath();
      ctx.ellipse(x, y - off, 74 + k * 14, 40 + k * 9, -.35, a0, a0 + 2.3);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  // 5. 起手插卡与随龙起跳阶段
  let iA = 0, iB = 0, mix = 0;
  if (t < Z.card) { iA = 0; iB = 1; mix = t / Z.card; }
  else if (t < Z.insert) { iA = 1; iB = 2; mix = (t - Z.card) / (Z.insert - Z.card); }
  else if (t < Z.stand) { iA = 2; iB = 4; mix = (t - Z.insert) / (Z.stand - Z.insert); }
  else if (t < Z.crouch) { iA = 4; iB = 3; mix = (t - Z.stand) / (Z.crouch - Z.stand); }
  else if (t < Z.launch) { iA = 3; iB = 5; mix = (t - Z.crouch) / (Z.launch - Z.crouch); }
  else { iA = 5; iB = 5; mix = 0; }

  drFVBlend(S_, iA, iB, mix > 0.75 ? (mix - 0.75) / 0.25 : 0, x, y, f);
}

function drawRyukiMark() {
  if (!P.ryuki || P.st !== 'fv' || P.t < RYUKI_FV.rise || P.hit['landed'] || P.t >= RYUKI_FV.dive + .05) return;
  const tx = P.x + P.f * (GY - P.y) - cam, p = 1 + Math.sin(T * 18) * .08;
  ctx.save(); ctx.strokeStyle = '#ff4030'; ctx.shadowColor = '#ff4030'; ctx.shadowBlur = 14; ctx.lineWidth = 3; ctx.globalAlpha = .85;
  ctx.beginPath(); ctx.ellipse(tx, GY + 4, 100 * p, 18 * p, 0, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(tx, GY + 4, 52 * p, 9 * p, 0, 0, 7); ctx.stroke();
  ctx.restore();
}

// ---------- 大招逻辑更新 ----------
function updRyukiFV(dt) {
  const Z = RYUKI_FV, t = P.t;
  P.inv = 1;

  if (!P.hit['snd_fv']) {
    P.hit['snd_fv'] = 1;
    playRyukiFV();
  }

  if (!P.hit['landed']) {
    if (t < Z.crouch) {
      P.vx = 0; P.vy = 0;
      if (t >= Z.card && !P.hit['card']) {
        P.hit['card'] = 1;
        DT.push({ x: P.x, y: P.y - 200, s: 'FINAL VENT', t: 1.2, c: '#ff3838' });
      }
    } else if (t < Z.rise) {
      P.vx = P.f * 30; P.vy = -680; P.y += P.vy * dt;
      if (!P.hit['jump']) { P.hit['jump'] = 1; shake = 8; }
    } else if (t < Z.dive) {
      P.vx = 0; P.vy = 0;
      if (t >= Z.hold1 && !P.hit['lock']) { P.hit['lock'] = 1; shake = 8; }
    } else {
      const spd = 1200;
      P.vx = P.f * spd; P.vy = spd; P.y += P.vy * dt;
      area(P.x - 90, P.x + 90, P.atk * 1.8, P.hit);

      // 【再提前】距离地面 170 像素（提前约 140ms）预触发 TouchDown 音效
      if (!P.hit['snd_td'] && (GY - P.y <= 170)) {
        P.hit['snd_td'] = 1;
        playRyukiFVTouchDown();
      }

      if (P.y >= GY) {
        P.y = GY; P.vy = 0; P.hit['landed'] = 1; P.landT = t; shake = 32;
        if (!P.hit['snd_td']) {
          P.hit['snd_td'] = 1;
          playRyukiFVTouchDown();
        }
        area(P.x - 380, P.x + 380, P.atk * 5.5);
        FX.push({ type: 'boom', x: P.x + P.f * 60, y: GY - 30, t: .8, d: .8, r: 320, c: '#ff5a20' });
        FX.push({ type: 'boom', x: P.x + P.f * 60, y: GY - 30, t: .6, d: .6, r: 200, c: '#ffd166' });
        DT.push({ x: P.x, y: P.y - 190, s: 'FINAL VENT · 龙骑飞踢！', t: 2.2, c: '#ff3838' });
      }
    }
  } else {
    P.y = GY; P.vy = 0;
    // 滑行减速在 0.35s 内平缓归零
    P.vx = P.f * Math.max(0, 240 * (1 - (t - P.landT) / 0.35));

    // 落地后摇缩短至 1.25 秒：立刻恢复为待机态，重置无敌与速度
    if (t > P.landT + RYUKI_LAND_ANIM_DUR) {
      P.st = 'idle';
      P.inv = .4;
      P.vx = 0;
      stopRyukiFV(); // 停止前摇卡片音效，保留落地爆炸尾音自然放完
    }
  }

  // 超时兜底保护
  if (t > 5.0) {
    P.st = (P.y < GY) ? 'air' : 'idle';
    P.inv = .4;
    stopAllRyukiFVSounds();
  }
}