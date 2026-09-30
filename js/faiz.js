// ===== 假面骑士 555 (Faiz) 专属逻辑：绘制 / L 手机枪 / 大招红锥飞踢 =====
// 素材与参数见 config.js 中的 SH5 / FAIZ_* ；形态标记：P.k5 ；变身入口：player.js 的 triggerRyukiTransform()

// ---------- 变身音效（Assets/SoundFX/）----------
// 变身动画总时长 = 音频时长（触发变身时读取并记入 P.tdur）；音频没加载到时退回默认 1.92s
const FAIZ_SND_FILES = ['Kamen_Rider_555_Henshin.m4a', 'Kamen Rider 555 Henshin.m4a'];
const FAIZ_TRANS_DEF = 16 * 0.12;
let SND5 = null;
(function initFaizSound() {
  let i = 0;
  const next = () => {
    if (i >= FAIZ_SND_FILES.length) { SND5 = null; return }
    const a = new Audio(); a.preload = 'auto';
    a.addEventListener('error', next, { once: true });
    a.src = encodeURI(A + 'SoundFX/' + FAIZ_SND_FILES[i++]);
    SND5 = a;
  };
  next();
})();
function faizTransDur() { return SND5 && isFinite(SND5.duration) && SND5.duration > 0.5 ? SND5.duration : FAIZ_TRANS_DEF }
function playFaizHenshin() { if (!SND5) return; try { SND5.currentTime = 0; const p = SND5.play(); if (p && p.catch) p.catch(() => { }) } catch (e) { } }
function stopFaizHenshin() { if (SND5 && !SND5.paused) SND5.pause() }

// ---------- 变身动画（帧间渐变 + 居中 + 特效见 ui.js 的 drawTransSeq）----------
function drawFaizTransform(x, y, f) {
  if (!okS(SH5.trans)) { dr(SH.atk, 12, x, y, f, 1.0); return; }
  const q = Math.min(15.999, P.t / (P.tdur || FAIZ_TRANS_DEF) * 16);
  drawTransSeq(SH5.trans, FAIZ_TRANS_SEQ, q, x, y, f, FAIZ_PAL);
}

// ---------- 555 形态总绘制 ----------
function drawFaiz(x, y, f) {
  const R = SH5.run, J = SH5.jump, A = SH5.atk, TR = SH5.trans, st = P.st;
  ctx.save();
  ctx.shadowColor = '#ffb400';
  ctx.shadowBlur = st === 'run' ? 4 : 10 + Math.sin(T * 6) * 4;

  if (st === 'run') {
    if (okS(R)) dr(R, (T * (P.spr ? 22 : 14) | 0) % R.f.length, x, y, f, 1.0);
    else dr(SH.run, (T * 14 | 0) % 12, x, y, f, 1.0);
  } else if (st === 'atk') {
    if (okS(A)) dr(A, FAIZ_ATK_SEQ[Math.min(FAIZ_ATK_SEQ.length - 1, P.t * 14 | 0)], x, y, f * FAIZ_ATK_FLIP, 1.0);
    else dr(SH.atk, [3, 4, 5, 6, 7, 8][Math.min(5, P.t * 14 | 0)], x, y, f, 1.0);
  } else if (st === 'air') {
    if (okS(J)) {
      const i = P.vy < -350 ? 2 : P.vy < -100 ? 3 : P.vy < 100 ? 4 : P.vy < 250 ? 5 : 6;
      dr(J, i, x, y, f, 1.0);
    } else dr(SH.jump, 2, x, y, f, 1.0);
  } else if (st === 'thr') {
    drawFaizGun(x, y, f);
  } else if (st === 'fv') {
    drawFaizFV(x, y, f);
  } else {   // idle / trans
    if (P.land > 0 && okS(J)) dr(J, 7, x, y, f, 1.0);
    else if (okS(TR)) drC(TR, 8, x, y + Math.sin(T * 3) * 1.2, f, 1.0);
    else dr(SH.atk, 12, x, y, f, 1.0);
  }
  ctx.restore();
}

// ---------- L 技能：手机枪 ----------
// 手的世界坐标（以变身表“举手”那一帧里的手为准）
function faizHandWorld() {
  const G = FAIZ_GUN, s = FAIZ_SCALE, fy = okS(SH5.trans) ? SH5.trans.fy : 509;
  return { x: P.x + P.f * (G.hx - 256) * s, y: P.y + (G.hy - fy) * s };
}

// 自动瞄准：朝面向方向最近的敌人身体中部；没有目标就平射
function faizAim() {
  const h = faizHandWorld(); let best = null, bd = 1e9;
  for (const e of E) {
    const dx = (e.x - h.x) * P.f;
    if (dx > -30 && dx < 950 && dx < bd) { bd = dx; best = e; }
  }
  if (!best) return 0;
  return cl(Math.atan2(best.y - best.h * .55 - h.y, Math.max(80, bd)), -.55, .55);
}

function faizMuzzleWorld(ang) {
  const G = FAIZ_GUN, gw = G.w, gh = GUN5 ? gw * GUN5.height / GUN5.width : gw * .69, h = faizHandWorld();
  const lx = (G.mx - G.gx) * gw, ly = (G.my - G.gy) * gh, c = Math.cos(ang), s = Math.sin(ang);
  return { x: h.x + P.f * (lx * c - ly * s), y: h.y + (lx * s + ly * c) };
}

function fireFaiz() {
  const ang = faizAim(), m = faizMuzzleWorld(ang), v = FAIZ_GUN.spd;
  PJ.push({ x: m.x, y: m.y, vx: P.f * Math.cos(ang) * v, vy: Math.sin(ang) * v, f: P.f, t: .75, h: {}, b5: 1 });
  FX.push({ type: 'boom', x: m.x, y: m.y, t: .16, d: .16, r: 34, c: '#ffcf5a' });
  shake = Math.max(shake, 3);
}

function drawFaizGun(x, y, f) {
  const TR = SH5.trans, G = FAIZ_GUN;
  if (okS(TR)) dr(TR, G.pose, x, y, f, 1.0); else dr(SH.atk, 12, x, y, f, 1.0);
  if (!GUN5 || !okS(TR)) return;

  const ang = faizAim(), gw = G.w, gh = gw * GUN5.height / GUN5.width;
  const hx = x + f * (G.hx - 256) * FAIZ_SCALE, hy = y + (G.hy - TR.fy) * FAIZ_SCALE;
  const rec = (P.t >= .12 && P.t < .2) ? 4 : 0;   // 后坐力

  ctx.save();
  ctx.shadowBlur = 0;
  ctx.translate(hx, hy); ctx.scale(f, 1); ctx.translate(-rec, 0); ctx.rotate(ang);

  // 枪口火光（在“朝右”的局部坐标里画）
  if (P.t >= .1 && P.t < .24) {
    const mx = (G.mx - G.gx) * gw, my = (G.my - G.gy) * gh, k = 1 - (P.t - .1) / .14;
    const gr = ctx.createRadialGradient(mx, my, 0, mx, my, 26 * k + 6);
    gr.addColorStop(0, 'rgba(255,250,210,1)'); gr.addColorStop(.4, 'rgba(255,190,60,.8)'); gr.addColorStop(1, 'rgba(255,120,0,0)');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(mx, my, 26 * k + 6, 0, 7); ctx.fill(); ctx.restore();
  }

  // 枪图原本枪口朝左 → 镜像后枪口朝右，握把对准手
  ctx.scale(-1, 1);
  ctx.drawImage(GUN5, -(1 - G.gx) * gw, -G.gy * gh, gw, gh);
  ctx.restore();
}

function drawBullet5(s) {
  const ang = Math.atan2(s.vy, s.vx);
  ctx.save(); ctx.translate(s.x - cam, s.y); ctx.rotate(ang);
  if (BUL5) {
    ctx.globalCompositeOperation = 'lighter';
    const w = 150, h = Math.max(16, w * BUL5.height / BUL5.width * 1.8);
    ctx.drawImage(BUL5, -w * .65, -h / 2, w, h);   // 弹头在图右侧，拖尾在身后
  } else {
    ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-70, 0); ctx.lineTo(20, 0); ctx.stroke();
  }
  ctx.restore();
}

// ---------- 大招 K：红锥飞踢（EXCEED CHARGE）----------
// 蓄力 → 跳起 → 顶点出现圆锥并“定身停顿” → 45° 砸落 → 落地爆发
function updFaizFV(dt) {
  const Z = FAIZ_FV, t = P.t;
  P.inv = 1;
  if (!P.hit['landed']) {
    if (t < Z.charge) {
      P.vx = 0; P.vy = 0;
    } else if (t < Z.rise) {
      P.vx = P.f * 70; P.vy = -720; P.y += P.vy * dt;
    } else if (t < Z.dive) {
      P.vx = 0; P.vy = 0;                      // 圆锥出现 → 悬停
      if (t >= Z.hold && !P.hit['lock']) {
        P.hit['lock'] = 1; shake = 10;
        DT.push({ x: P.x, y: P.y - 200, s: 'LOCK ON', t: .9, c: '#ff3b3b' });
      }
    } else {
      P.vx = P.f * 1250; P.vy = 1250; P.y += P.vy * dt;
      const a = P.x - P.f * 60, b = P.x + P.f * 160;
      area(Math.min(a, b), Math.max(a, b), P.atk * 1.6, P.hit);
      if (P.y >= GY) {
        P.y = GY; P.vy = 0; P.hit['landed'] = 1; P.landT = t; shake = 30;
        const tx = P.x + P.f * Z.tip;
        area(tx - 380, tx + 380, P.atk * 5.6);
        FX.push({ type: 'boom', x: tx, y: GY - 30, t: .7, d: .7, r: 300, c: '#ff3b3b' });
        FX.push({ type: 'boom', x: tx, y: GY - 30, t: .5, d: .5, r: 190, c: '#ffd166' });
        DT.push({ x: P.x, y: P.y - 190, s: 'EXCEED CHARGE · 红锥飞踢！', t: 1.8, c: '#ff3b3b' });
      }
    }
  } else {
    P.y = GY; P.vy = 0;
    P.vx = P.f * Math.max(0, 200 * (1 - (t - P.landT) / .5));
    if (t > P.landT + 1.0) { P.st = 'idle'; P.inv = .4; P.vx = 0; }
  }
  if (t > 4) { P.st = (P.y < GY) ? 'air' : 'idle'; P.inv = .4; }   // 保险：任何意外都不会卡在大招里
}

function drawFaizFV(x, y, f) {
  const V = SH5.fv;
  if (!okS(V)) { dr(SH.atk, 12, x, y, f, 1.0); return; }
  const Z = FAIZ_FV, t = P.t;
  let i, cone = false;
  if (t < .14) i = 0;
  else if (t < .28) i = 1;
  else if (t < .42) i = 2;
  else if (t < .58) i = 3;
  else if (t < Z.charge) i = 4;
  else if (t < Z.charge + .12) i = 5;
  else if (t < Z.charge + .24) i = 6;
  else if (t < Z.rise) i = 7;
  else if (t < Z.hold) i = 8;
  else if (!P.hit['landed']) { cone = true; i = ((t * (t < Z.dive ? 10 : 26)) | 0) % 2 ? 10 : 9; }
  else {
    const d = t - P.landT;
    i = d < .2 ? 11 : d < .4 ? 12 : d < .75 ? 13 : d < .95 ? 14 : 15;
  }
  if (cone) { ctx.shadowColor = '#ff3b3b'; ctx.shadowBlur = 22 + Math.sin(T * 20) * 8; }
  dr(V, i, x, y, f, 1.0);
}

// 落点预警：圆锥定身期间，地面显示红色锁定圈
function drawFaizMark() {
  if (!P.k5 || P.st !== 'fv' || P.t < FAIZ_FV.rise || P.hit['landed']) return;
  const tx = P.x + P.f * ((GY - P.y) + FAIZ_FV.tip) - cam, p = 1 + Math.sin(T * 18) * .08;
  ctx.save();
  ctx.strokeStyle = '#ff3b3b'; ctx.shadowColor = '#ff3b3b'; ctx.shadowBlur = 16; ctx.lineWidth = 3; ctx.globalAlpha = .85;
  ctx.beginPath(); ctx.ellipse(tx, GY + 4, 110 * p, 20 * p, 0, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(tx, GY + 4, 60 * p, 11 * p, 0, 0, 7); ctx.stroke();
  ctx.globalAlpha = .4; ctx.setLineDash([6, 8]);
  ctx.beginPath(); ctx.moveTo(tx, GY); ctx.lineTo(tx, GY - 260); ctx.stroke();
  ctx.restore();
}
