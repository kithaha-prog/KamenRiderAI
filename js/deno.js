// ===== 假面骑士 DenO（电王·剑形态）专属逻辑：素材加载 / 变身 / 形态绘制 / L 斩击波 / 大招 =====
// 结构参照 blade.js；形态标记：P.dn ；变身入口：player.js 的 triggerRyukiTransform()
// 依赖：blade.js 的 sliceTransBlade / smooth01、ui.js 的 drC / transFx / massCenterX（所以 index.html 里要放在 blade.js 之后）
// 素材放在 Assets/Kamen Rider DenO/ ：KR_DenO_Run / Jump / NormalAttack / FinalVent / Sword / SwordLight .png
//        以及 Assets/Transform/KR_Malaya_TransformTo_KR_DenO.png

// ---------- 配置 ----------
const DENO = A + 'Kamen Rider DenO/';
const SHD = {
  run:  { f: 'KR_DenO_Run.png',          c: 3, r: 2, ref: 0 },    // 6 帧跑步
  jump: { f: 'KR_DenO_Jump.png',         c: 4, r: 3, ref: 11 },   // 12 帧：2 起跳 3/4 上升 6 下落 7 落地
  atk:  { f: 'KR_DenO_NormalAttack.png', c: 4, r: 4, ref: 12 },  // 16 帧：1~9 挥剑 · 12/13 待机
  fv:   { f: 'KR_DenO_FinalVent.png',    c: 4, r: 4, ref: 15 }   // 16 帧：必杀技
};
// 各表格里角色的朝向：素材里角色朝右 = 1；如果发现某个动作朝向反了，把对应的值改成 -1
const DENO_FLIP = { run: 1, jump: 1, atk: 1, fv: 1, trans: 1 };
// 普攻帧序列（按 P.t*14 取帧）：main.js 在第 2、4 步结算伤害 → 对应第 5 帧（起刀火光）和第 7 帧（火轨大回旋）
const DENO_ATK_SEQ = [1, 2, 5, 6, 7, 8, 9];
// L 技能「斩击波」：fireT=放出时刻；dur=整个技能时长；vx=飞行速度；life=存在时间；len=光刃长度；mul=伤害倍率
const DENO_L = { fireT: .16, dur: .5, vx: 980, life: .85, len: 330, mul: 1.8, w: 120 };
// 大招时间线（秒）：charge 蓄力 → rise 跳起 → dive 旋转悬停结束、开始俯冲 → 落地爆发；tip=落点在身前多少像素
const DENO_FV = { charge: .86, rise: 1.2, hold: 1.32, dive: 1.9, tip: 105 };

// 变身时间轴：没有音频时整条动画 DENO_TL_LEN 秒；有音频（Assets/SoundFX/ 下）就按音频真实时长等比缩放
// 变身表 5×4=20 帧：0~4 Malaya 取牌 → 5~9 胶片环 → 10~12 装甲替换 → 13~15 环散开 → 16 火焰 → 17 待机 → 18~19 「俺、参上！」
const DENO_TL_LEN = 6.4, DENO_TRANS_DEF = DENO_TL_LEN;
const DENO_KEYS = [[0, 0], [.35, 1], [.7, 2], [1.05, 3], [1.4, 4], [1.8, 5], [2.1, 6], [2.4, 7], [2.7, 8], [3.0, 9, 1],
  [3.3, 10, 1], [3.6, 11], [3.9, 12], [4.2, 13], [4.5, 14], [4.8, 15], [5.1, 16], [5.4, 17], [5.8, 18], [6.15, 19]];
const DENO_BURST = 3.3, DENO_FIN = 5.8;   // 节拍：装甲爆发 / 摆出终极姿势
const DENO_PAL = { sh: '#ff3b30', g0: 8, g1: 14, bq: 6.2, ring: [[255, 110, 60], [255, 200, 80]], pt: ['255,60,50', '255,200,90'], fl: ['255,240,220', '255,80,60', '200,0,0'], fr: '255,210,170' };

// ---------- 素材加载（由 main.js 的 prep() 调用）----------
let SWD_D = null, SLT_D = null;   // 剑 / 斩击光刃（预缩放）
let DNW = [];                     // 场上的斩击波

async function loadDenoAssets() {
  for (const fn of ['KR_DenO.jpg', 'KR_DenO.png']) { try { CAP_IMGS.deno = await load(DRAW + fn); break } catch (e) { } }

  try {
    const im = await load(TRANS + 'KR_Malaya_TransformTo_KR_DenO.png');
    SHD.trans = sliceTransBlade(im, 5, 4, 17);   // 按像素空隙切 5×4 → 清邻行碎块 → 脚底对齐，以第 17 帧 DenO 待机为缩放基准
  } catch (e) { miss.push('Transform/KR_Malaya_TransformTo_KR_DenO.png'); }

  for (const [key, o] of Object.entries(SHD)) {
    if (key === 'trans') continue;
    try {
      const im = await load(DENO + o.f);
      Object.assign(o, sliceSheet(im, o.c, o.r, o.ref || 0, 0, false));
    } catch (e) { miss.push('Kamen Rider DenO/' + o.f); }
  }
  // 跑步表：逐帧用真实“最低脚底”和质心对齐，避免跑动时上下 / 前后抖
  if (okS(SHD.run)) SHD.run.ft = SHD.run.f.map(fr => bb(fr).y1);

  // 剑：柄在右上、尖在左下 → 记录“柄→尖”的方向角与长度
  try {
    const t = trim(toCanvas(await load(DENO + 'KR_DenO_Sword.png')));
    const w = 360, h = Math.round(t.height * w / t.width), c = document.createElement('canvas');
    c.width = w; c.height = h; c.getContext('2d').drawImage(t, 0, 0, w, h);
    c.phi = Math.atan2(h, -w); c.dg = Math.hypot(w, h);
    SWD_D = c;
  } catch (e) { miss.push('Kamen Rider DenO/KR_DenO_Sword.png'); }

  // 光刃：左上→右下的细长斩光
  try {
    const t = trim(toCanvas(await load(DENO + 'KR_DenO_SwordLight.png')));
    const w = Math.min(900, t.width), h = Math.round(t.height * w / t.width), c = document.createElement('canvas');
    c.width = w; c.height = h; c.getContext('2d').drawImage(t, 0, 0, w, h);
    c.phi = Math.atan2(h, w); c.dg = Math.hypot(w, h);
    SLT_D = c;
  } catch (e) { miss.push('Kamen Rider DenO/KR_DenO_SwordLight.png'); }
}

// ---------- 变身音效（可选：Assets/SoundFX/ 下放 DenO 的变身音频即可；没有就静音）----------
const DENO_SND_FILES = ['Kamen_Rider_DenO_Henshin.m4a', 'Kamen Rider DenO Henshin.m4a', 'Kamen_Rider_DenO_Henshin.mp3', 'Kamen Rider DenO Henshin.mp3'];
let SND_D = null;
(function initDenoSound() {
  let i = 0;
  const next = () => {
    if (i >= DENO_SND_FILES.length) { SND_D = null; return }
    const a = new Audio(); a.preload = 'auto';
    a.addEventListener('error', next, { once: true });
    a.src = encodeURI(A + 'SoundFX/' + DENO_SND_FILES[i++]);
    SND_D = a;
  };
  next();
})();
function denoTransDur() { return SND_D && isFinite(SND_D.duration) && SND_D.duration > 0.5 ? SND_D.duration : DENO_TRANS_DEF }
function denoSyncT(t) { return SND_D && !SND_D.paused && SND_D.currentTime > .02 ? SND_D.currentTime : t }
const denoTS = () => P.t * DENO_TL_LEN / (P.tdur || DENO_TRANS_DEF);   // 换算成时间轴秒数
function playDenoHenshin() { if (!SND_D) return; try { SND_D.currentTime = 0; const p = SND_D.play(); if (p && p.catch) p.catch(() => { }) } catch (e) { } }
function stopDenoHenshin() { if (SND_D && !SND_D.paused) SND_D.pause() }

// ---------- 绘制小工具 ----------
// 通用帧绘制：水平锚点 = 格子中心，脚底 = 参考帧脚底
function drD(S, i, x, y, f, al = 1) { if (S && S.f && S.f[i]) dr(S, i, x, y, f, 1, al) }
// 跑步帧：质心水平对齐 + 逐帧脚底
function drDR(i, x, y, f) {
  const S = SHD.run, fr = S && S.f && S.f[i]; if (!fr) return;
  if (!S.cxs) S.cxs = [];
  let c = S.cxs[i]; if (c === undefined) c = S.cxs[i] = massCenterX(fr);
  const ft = S.ft && S.ft[i] !== undefined ? S.ft[i] : S.fy;
  ctx.save(); ctx.translate(sn(x), sn(y)); ctx.scale(f * DENO_FLIP.run * S.s, S.s);
  ctx.drawImage(fr, -c, -ft); ctx.restore();
}

// ---------- 变身动画 ----------
function denoFrameAt(s) {   // → { a, b, e }：当前帧 / 下一帧 / 交叉淡入进度
  const K = DENO_KEYS; let j = 0;
  while (j + 1 < K.length && K[j + 1][0] <= s) j++;
  const a = K[j], b = K[j + 1];
  if (!b || b[2]) return { a: a[1], b: a[1], e: 0 };
  const fd = Math.min(.2, (b[0] - a[0]) * .6);
  return { a: a[1], b: b[1], e: smooth01(b[0] - fd, b[0], s) };
}

// 节拍事件（main.js 更新循环里调用）：震屏 / 飘字 / 伤害，每个只触发一次
function updDenoTrans() {
  const s = denoTS(), h = P.hit, fire = (k, t, fn) => { if (s >= t && !h[k]) { h[k] = 1; if (!(t < (P.sk || 0))) fn() } };
  fire('card', .7, () => { shake = Math.max(shake, 3) });
  fire('ring', 1.8, () => { shake = Math.max(shake, 5); DT.push({ x: P.x, y: P.y - 210, s: '胶片之环！', t: 1.0, c: '#ffb36b' }) });
  fire('burst', DENO_BURST, () => { shake = Math.max(shake, 18) });
  fire('wave', 4.8, () => { shake = Math.max(shake, 8) });
  fire('fin', DENO_FIN, () => {
    shake = 24; if (G === 'play') area(P.x - 360, P.x + 360, P.atk * 3.5);
    DT.push({ x: P.x, y: P.y - 210, s: 'DEN-O · 俺、参上！', t: 1.8, c: '#ff3b30' });
  });
}

function drawDenoTransform(x, y, f) {
  const TR = SHD.trans, M = SH.trans;
  const s = denoTS(), q = cl(s / DENO_TL_LEN * 16, 0, 15.999), fa = cl((16 - q) / 3, 0, 1);
  if (!okS(TR)) { if (okS(SHD.atk)) drD(SHD.atk, 12, x, y, f * DENO_FLIP.atk); else dr(SH.atk, 12, x, y, f, 1.0); return; }
  // 暗场：胶片环段落压暗背景，爆发后恢复
  ctx.save();
  const dk = .35 * smooth01(1.6, 2.6, s) * (1 - smooth01(DENO_BURST, DENO_BURST + .5, s));
  if (dk > .01) { ctx.fillStyle = 'rgba(14,4,6,' + dk.toFixed(3) + ')'; ctx.fillRect(-80, -80, 1120, 700) }
  ctx.restore();
  transFx(x, y, q, fa, 0, DENO_PAL);
  const fr = denoFrameAt(s), fl = f * DENO_FLIP.trans, bob = Math.sin(T * 2.4) * (s < 2 ? .6 : 1.2);
  ctx.save();
  ctx.shadowColor = DENO_PAL.sh;
  ctx.shadowBlur = s < 1.8 ? 0 : s < DENO_BURST ? (s - 1.8) / 1.5 * 16 : s < DENO_FIN ? 20 + Math.sin(T * 9) * 5 : 10;
  if (fr.a === fr.b) drC(TR, fr.a, x, y + bob, fl);
  else { drC(TR, fr.a, x, y + bob, fl, 1, 1 - fr.e * fr.e); drC(TR, fr.b, x, y + bob, fl, 1, fr.e) }
  ctx.restore();
  transFx(x, y, q, fa, 1, DENO_PAL);
  // 白闪：装甲爆发 / 终极姿势
  let a = 0, t;
  if ((t = s - DENO_BURST) >= 0 && t < .5) a = Math.max(a, (1 - t / .5) * .7);
  if ((t = s - DENO_FIN) >= 0 && t < .4) a = Math.max(a, (1 - t / .4) * .45);
  if (a > .01) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,240,230,' + a.toFixed(3) + ')'; ctx.fillRect(-80, -80, 1120, 700); ctx.restore(); }
}

// ---------- DenO 形态总绘制 ----------
function drawDeno(x, y, f) {
  const R = SHD.run, J = SHD.jump, A_ = SHD.atk, st = P.st;
  ctx.save();
  ctx.shadowColor = '#ff3b30';
  ctx.shadowBlur = st === 'run' ? 4 : 10 + Math.sin(T * 6) * 4;

  if (st === 'run') {
    if (okS(R)) drDR((T * (P.spr ? 15 : 10) | 0) % R.f.length, x, y, f);
    else dr(SH.run, (T * 14 | 0) % 12, x, y, f, 1.0);
  } else if (st === 'atk') {
    if (okS(A_)) drD(A_, DENO_ATK_SEQ[Math.min(DENO_ATK_SEQ.length - 1, P.t * 14 | 0)], x, y, f * DENO_FLIP.atk);
    else dr(SH.atk, [3, 4, 5, 6, 7, 8][Math.min(5, P.t * 14 | 0)], x, y, f, 1.0);
  } else if (st === 'air') {
    if (okS(J)) drD(J, P.vy < -250 ? 3 : P.vy < 60 ? 4 : 6, x, y, f * DENO_FLIP.jump);
    else dr(SH.jump, 2, x, y, f, 1.0);
  } else if (st === 'thr') {
    drawDenoL(x, y, f);
  } else if (st === 'fv') {
    drawDenoFV(x, y, f);
  } else {   // idle / trans
    if (P.land > 0 && okS(J)) drD(J, 7, x, y, f * DENO_FLIP.jump);
    else if (okS(A_)) drD(A_, 12 + ((T * 1.6) | 0) % 2, x, y + Math.sin(T * 3) * 1.0, f * DENO_FLIP.atk);
    else dr(SH.atk, 12, x, y, f, 1.0);
  }
  ctx.restore();
}

// ---------- L 技能：电王剑·斩击波 ----------
// 起手(帧4) → 挥剑(帧5) → 放出光刃(帧6 X 斩) → 收招(帧7)
function drawDenoL(x, y, f) {
  const A_ = SHD.atk, t = P.t;
  if (!okS(A_)) { dr(SH.atk, 12, x, y, f, 1.0); return; }
  const i = t < .06 ? 4 : t < DENO_L.fireT ? 5 : t < .32 ? 6 : 7;
  drD(A_, i, x, y, f * DENO_FLIP.atk);
}

function fireDeno() {
  const ox = P.x + P.f * 70, oy = P.y - 95;
  DNW.push({ x: ox, y: oy, f: P.f, t: DENO_L.life, d: DENO_L.life, hit: new Set(), spin: Math.random() * 6 });
  FX.push({ type: 'boom', x: ox, y: oy, t: .2, d: .2, r: 56, c: '#ff8a5a' });
  shake = Math.max(shake, 5);
  DT.push({ x: P.x, y: P.y - 200, s: 'RIDER SLASH', t: .8, c: '#ff6b4a' });
}

function updDenoWaves(dt) {
  for (const w of DNW) {
    w.t -= dt; w.x += w.f * DENO_L.vx * dt;
    if (typeof cancelEP === 'function') cancelEP(w.x - 70, w.x + 70);
    for (const e of E) {
      if (e.dead || w.hit.has(e) || w.vis) continue;   // w.vis = 队友发来的斩击波：只展示，伤害由队友端结算
      if (Math.abs(e.x - w.x) < DENO_L.w + e.w * .4 && Math.abs((e.y - e.h * .5) - w.y) < 140 + e.h * .5) {
        w.hit.add(e);
        hurt(e, P.atk * DENO_L.mul);
        FX.push({ type: 'boom', x: e.x, y: e.y - e.h * .5, t: .22, d: .22, r: 50, c: '#ff9a5a' });
      }
    }
  }
  DNW = DNW.filter(w => w.t > 0);
}

function drawDenoWaves() {
  for (const w of DNW) {
    const p = 1 - w.t / w.d, al = cl(p / .06, 0, 1) * cl((1 - p) / .3, 0, 1);
    ctx.save();
    ctx.translate(w.x - cam, w.y); ctx.scale(w.f, 1);
    if (SLT_D) {   // 光刃：旋转到主干水平，压扁成一道新月形斩痕
      const k = DENO_L.len / SLT_D.dg, fl = ((((T * 30) | 0) + (w.spin | 0)) % 2) ? 1 : -1;
      ctx.save(); ctx.scale(1, fl * 1.5); ctx.rotate(-SLT_D.phi); ctx.scale(k, k);
      ctx.globalAlpha = al; ctx.shadowColor = '#ff7a3a'; ctx.shadowBlur = 20;
      ctx.drawImage(SLT_D, -SLT_D.width / 2, -SLT_D.height / 2);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = al * .5; ctx.shadowBlur = 0;
      ctx.drawImage(SLT_D, -SLT_D.width / 2, -SLT_D.height / 2);
      ctx.restore();
    } else {       // 素材缺失：程序化月牙
      ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,170,90,' + al.toFixed(3) + ')'; ctx.lineWidth = 10; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(-40, 0, 120, -.9, .9); ctx.stroke();
    }
    if (SWD_D) {   // 光刃前端飞出的电王剑，边飞边轻微颤动
      const k = 110 / SWD_D.dg;
      ctx.save(); ctx.translate(DENO_L.len * .38, 0); ctx.rotate(-SWD_D.phi + Math.sin(T * 40 + w.spin) * .05); ctx.scale(k, k);
      ctx.globalAlpha = al; ctx.shadowColor = '#ff6a3a'; ctx.shadowBlur = 14;
      ctx.drawImage(SWD_D, -SWD_D.width / 2, -SWD_D.height / 2);
      ctx.restore();
    }
    ctx.restore();
  }
}

// ---------- 大招 K：俺の必殺技 · 电王剑俯冲斩 ----------
// 拔剑蓄力 → 雷光缠身跳起 → 空中旋转斩定身 → 45° 俯冲 → 落地爆炸
function updDenoFV(dt) {
  const Z = DENO_FV, t = P.t;
  P.inv = 1;
  if (!P.hit['landed']) {
    if (t < Z.charge) {
      P.vx = 0; P.vy = 0;
      if (t >= .3 && !P.hit['card']) {
        P.hit['card'] = 1;
        DT.push({ x: P.x, y: P.y - 200, s: '俺の必殺技！', t: 1.2, c: '#ff8a5a' });
      }
    } else if (t < Z.rise) {
      P.vx = P.f * 70; P.vy = -720; P.y += P.vy * dt;
      if (!P.hit['jump']) { P.hit['jump'] = 1; shake = 8; }
    } else if (t < Z.dive) {
      P.vx = 0; P.vy = 0;                      // 空中旋转斩 → 悬停
      if (t >= Z.hold && !P.hit['lock']) {
        P.hit['lock'] = 1; shake = 10;
        DT.push({ x: P.x, y: P.y - 200, s: 'FULL CHARGE', t: .9, c: '#ffd166' });
      }
    } else {
      P.vx = P.f * 1250; P.vy = 1250; P.y += P.vy * dt;
      const a = P.x - P.f * 60, b = P.x + P.f * 160;
      area(Math.min(a, b), Math.max(a, b), P.atk * 1.6, P.hit);
      if (P.y >= GY) {
        P.y = GY; P.vy = 0; P.hit['landed'] = 1; P.landT = t; shake = 30;
        const tx = P.x + P.f * Z.tip;
        area(tx - 380, tx + 380, P.atk * 5.6);
        FX.push({ type: 'boom', x: tx, y: GY - 30, t: .7, d: .7, r: 300, c: '#ff6a3a' });
        FX.push({ type: 'boom', x: tx, y: GY - 30, t: .5, d: .5, r: 190, c: '#ffd166' });
        DT.push({ x: P.x, y: P.y - 190, s: 'ORE NO HISSATSU WAZA · 电王剑·俯冲斩！', t: 1.8, c: '#ff5a3a' });
      }
    }
  } else {
    P.y = GY; P.vy = 0;
    P.vx = P.f * Math.max(0, 200 * (1 - (t - P.landT) / .5));
    if (t > P.landT + 1.1) { P.st = 'idle'; P.inv = .4; P.vx = 0; }
  }
  if (t > 4) { P.st = (P.y < GY) ? 'air' : 'idle'; P.inv = .4; }   // 保险：不会卡在大招里
}

function drawDenoFV(x, y, f) {
  const V = SHD.fv;
  if (!okS(V)) { dr(SH.atk, 12, x, y, f, 1.0); return; }
  const Z = DENO_FV, t = P.t, fv = f * DENO_FLIP.fv;
  let i, glow = false;
  if (t < .14) i = 0;                  // 持剑站立
  else if (t < .30) i = 2;             // 单膝跪地、剑插入地面
  else if (t < .46) i = 3;             // 拔剑 / 雷光
  else if (t < .62) i = 4;             // 张开双臂，雷光环绕
  else if (t < .74) i = 5;             // 能量汇聚
  else if (t < Z.charge) i = 6;        // 下蹲蓄力（脚下火球）
  else if (t < Z.rise) i = 7;          // 带火跳起
  else if (!P.hit['landed'] && t < Z.dive) { glow = true; i = ((t * 12) | 0) % 2 ? 9 : 8; }   // 空中旋转斩
  else if (!P.hit['landed']) { glow = true; i = (P.y > GY - 140) ? 12 : 11; }                 // 45° 俯冲（贴近地面时换更陡的一帧）
  else i = -1;
  if (glow) { ctx.shadowColor = '#ff7a3a'; ctx.shadowBlur = 22 + Math.sin(T * 20) * 8; }
  if (i >= 0) { drD(V, i, x, y, fv); return; }

  // 落地阶段：爆炸帧（第 13 帧）在落点炸开 → 蹲伏 → 起身持剑
  const d = t - P.landT;
  if (d < .6 && V.f[13]) {
    const p = d / .6, tx = x + f * Z.tip, sc = V.s * (1.0 + p * .45);
    ctx.save(); ctx.globalAlpha = cl(p / .08, 0, 1) * cl((1 - p) / .5, 0, 1);
    ctx.translate(tx, y + 6); ctx.scale(sc, sc);
    ctx.drawImage(V.f[13], -V.cw / 2, -V.ch * .8); ctx.restore();
  }
  drD(V, d < .3 ? 14 : 15, x, y, fv);
}

// 落点预警：定身旋转斩期间，地面显示红色锁定圈
function drawDenoMark() {
  if (!P.dn || P.st !== 'fv' || P.t < DENO_FV.rise || P.hit['landed']) return;
  const tx = P.x + P.f * ((GY - P.y) + DENO_FV.tip) - cam, p = 1 + Math.sin(T * 18) * .08;
  ctx.save();
  ctx.strokeStyle = '#ff5a3a'; ctx.shadowColor = '#ff5a3a'; ctx.shadowBlur = 16; ctx.lineWidth = 3; ctx.globalAlpha = .85;
  ctx.beginPath(); ctx.ellipse(tx, GY + 4, 110 * p, 20 * p, 0, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(tx, GY + 4, 60 * p, 11 * p, 0, 0, 7); ctx.stroke();
  ctx.globalAlpha = .4; ctx.setLineDash([6, 8]);
  ctx.beginPath(); ctx.moveTo(tx, GY); ctx.lineTo(tx, GY - 260); ctx.stroke();
  ctx.restore();
}
