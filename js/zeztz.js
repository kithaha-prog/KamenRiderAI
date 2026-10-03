// ===== 假面骑士 Zeztz (KR_Zeztz) 专属逻辑模块 =====
// 素材与参数：SHZ / ZEZTZ ；形态标记：P.zeztz ；变身入口：player.js
let WAVE_Z = null;    // L 技能能量波贴图
let Z_WAVES = [];     // 场上的能量波实体池

// ---------- 素材加载（同时支持：PNG 自带透明通道 / JPG 黑底）（main.js prep() 调用）----------
function toTransparentCanvas(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  try {
    const id = g.getImageData(0, 0, c.width, c.height);
    const d = id.data;
    // 先判断素材是否已经自带透明通道（抽样检查 alpha）
    let hasAlpha = false;
    for (let i = 3; i < d.length; i += 4 * 97) { if (d[i] < 250) { hasAlpha = true; break; } }
    if (hasAlpha) {
      // ★ 已是透明 PNG：只清掉抠图残留的极低 alpha 杂点。
      //   绝对不能再按“亮度”去黑底——Zeztz 的战斗服和描边本身就是深色，会被吃成半透明。
      for (let i = 3; i < d.length; i += 4) if (d[i] < 14) d[i] = 0;
    } else {
      // 不透明 JPG（纯黑背景）：旧逻辑，黑色透明 + 暗部渐变羽化
      for (let i = 0; i < d.length; i += 4) {
        const br = Math.max(d[i], d[i + 1], d[i + 2]);
        if (br < 18) d[i + 3] = 0;
        else if (br < 70) d[i + 3] = Math.round((br - 18) / 52 * 255);
      }
    }
    g.putImageData(id, 0, 0);
  } catch (e) {}
  return c;
}

async function loadZeztzAssets() {
  // 依次尝试多个路径，返回第一张加载成功的图（PNG 优先）
  const first = async (paths) => {
    for (const p of paths) {
      try { const im = await load(p); if (im && im.width) return im; } catch (e) {}
    }
    return null;
  };

  // 胶囊图标
  for (const fn of ['KR_Zeztz.png', 'KR_Zeztz.jpg', 'kr_zeztz.jpg']) {
    try { const im = await load(DRAW + fn); if (im) { CAP_IMGS.zeztz = im; break; } } catch (e) {}
  }
  if (!CAP_IMGS.zeztz) {
    try { CAP_IMGS.zeztz = await load(ZEZTZ + 'KR_Zeztz.png'); } catch (e) {}
    if (!CAP_IMGS.zeztz) { try { CAP_IMGS.zeztz = await load(ZEZTZ + 'KR_Zeztz.jpg'); } catch (e) {} }
  }

  // 1. 变身动作表：★ 5 列 × 4 行，共 20 帧（原来误按 4×5 切，帧会被劈开）
  //    ref=19（最终站姿）决定整张表的缩放，使 Zeztz 站立身高 ≈ PH；不再被 ZEZTZ_SCALE 覆盖（那个值会让变身表缩成一半大小）
  {
    const N = 'KR_Malaya_TransformTo_KR_Zeztz';
    const trIm = await first([
      TRANS + N + '.png', TRANS + N + '.jpg',
      ZEZTZ + N + '.png', ZEZTZ + N + '.jpg',
      A + N + '.png', A + N + '.jpg'
    ]);
    if (trIm) SHZ.trans = sliceSheet(toTransparentCanvas(trIm), 5, 4, 19, 0, false);
    else miss.push('Transform/' + N + '.png');
  }

  // 2. 基础与大招动作模组
  const list = [
    ['run',  'KR_Zeztz_Run', 3, 2, 0],
    ['jump', 'KR_Zeztz_Jump', 4, 3, 1],
    ['atk',  'KR_Zeztz_NormalAttack', 4, 4, 0],
    ['fv',   'KR_Zeztz_FinalVent', 6, 4, 0]
  ];
  for (const [key, base, c, r, ref] of list) {
    const im = await first([
      ZEZTZ + base + '.png', ZEZTZ + base + '.jpg',
      A + base + '.png', A + base + '.jpg'
    ]);
    if (im) {
      Object.assign(SHZ[key], sliceSheet(toTransparentCanvas(im), c, r, ref, 0, false));
      SHZ[key].s = ZEZTZ_SCALE;
    } else {
      miss.push('Kamen Rider Zeztz/' + base + '.png');
    }
  }

  // 3. 拳压能量波贴图
  {
    const wIm = await first([
      ZEZTZ + 'KR_Zeztz_Energywave.png', ZEZTZ + 'KR_Zeztz_Energywave.jpg',
      A + 'KR_Zeztz_Energywave.png', A + 'KR_Zeztz_Energywave.jpg'
    ]);
    if (wIm) WAVE_Z = trim(toTransparentCanvas(wIm));
    else miss.push('Kamen Rider Zeztz/KR_Zeztz_Energywave.png');
  }
}

// ---------- 变身音频控制器 ----------
const ZEZTZ_SND_FILES = [
  'Kamen_Rider_Zeztz_Henshin.mp3',
  'Kamen Rider Zeztz Henshin.mp3',
  'Kamen_Rider_Zeztz_Henshin.m4a',
  'Kamen Rider Zeztz Henshin.m4a'
];
const ZEZTZ_AUDIO_LEN = 14.4;   // 音频真实时长 ≈ 14.4 秒（音频没加载出来时的兜底）
let SND_ZEZTZ = null;

(function initZeztzSound() {
  let i = 0;
  const next = () => {
    if (i >= ZEZTZ_SND_FILES.length) { SND_ZEZTZ = null; return; }
    const a = new Audio(); a.preload = 'auto';
    a.addEventListener('error', next, { once: true });
    a.src = encodeURI(A + 'SoundFX/' + ZEZTZ_SND_FILES[i++]);
    SND_ZEZTZ = a;
  };
  next();
})();

function zeztzTransDur() {
  return SND_ZEZTZ && isFinite(SND_ZEZTZ.duration) && SND_ZEZTZ.duration > 0.5
    ? SND_ZEZTZ.duration
    : ZEZTZ_AUDIO_LEN;
}
function playZeztzHenshin() {
  if (!SND_ZEZTZ) return;
  try {
    SND_ZEZTZ.currentTime = 0;
    const p = SND_ZEZTZ.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {}
}
function stopZeztzHenshin() {
  if (SND_ZEZTZ && !SND_ZEZTZ.paused) SND_ZEZTZ.pause();
}
function zeztzSyncT(t) {
  return SND_ZEZTZ && !SND_ZEZTZ.paused && SND_ZEZTZ.currentTime > 0.02
    ? SND_ZEZTZ.currentTime
    : t;
}

// ---------- 变身时间轴（单位：音频秒；动画时钟直接跟随音频 currentTime）----------
// 时间点来自对 Kamen_Rider_Zeztz_Henshin.mp3 的低频/能量分析：
//   0.1 首个冲击 · 0.9~2.4 一段密集鼓点 · 2.6~3.4 安静 · 3.5 起每 1 秒一记重鼓（3.5/4.5/5.5/6.5/7.5）
//   7.9 起能量上涌 · 约 10.0 再次推高 · 11.8~12.2 全曲最强低频（= 变身完成的爆发） · 之后余韵到 14.4
// 觉得某个点对不上，只改这里的数字即可。
const ZEZTZ_TL = {
  impact1: 0.10,
  beats1: [0.90, 1.50, 2.00, 2.40],        // 第一段鼓点：Malaya 摆出架势
  ready: 3.50,                             // 安静之后第一记重鼓：腰带亮、红色能量开始缠身
  beats2: [4.50, 5.50, 6.50, 7.50],        // 第二段鼓点：每拍一圈更大的地面冲击环
  swell: 7.90,                             // 能量上涌（红光闪烁）
  henshin: 10.00,                          // HENSHIN!
  burst: 11.80,                            // 爆发：Malaya 装甲炸开，Zeztz 现身
  calm: 12.90                              // 余韵
};

// 变身表（5列×4行=20帧）：
//   0~1 Malaya 站立 · 2~6 摆架势/绿环/红色光球 · 7~12 红色能量逐渐缠满 Malaya（11/12 为最红）
//   13 Zeztz 现身 · 14/18 蓄力蹲姿(红色光球) · 15 战斗站姿 · 16 跃起 · 17 红光 · 19 最终站姿
// [时间, 帧号（数组 = 在这几帧之间闪烁）, 是否硬切]
const ZEZTZ_KEYS = [
  [0.00, 0, 0],
  [0.45, 1, 0],
  [0.90, 2, 1],
  [1.50, 3, 1],
  [2.00, 4, 1],
  [2.40, 5, 1],
  [3.00, 6, 0],
  [3.50, 7, 1],
  [4.50, 8, 1],
  [5.50, 9, 1],
  [6.50, 10, 1],
  [7.50, 11, 1],
  [7.90, [11, 12], 0],        // 红光闪烁直到爆发
  [11.80, 13, 1],             // ★ Zeztz 现身（硬切）
  [12.10, 14, 1],
  [12.45, 18, 1],
  [12.80, 17, 1],
  [13.15, 15, 0],
  [13.60, 19, 0]
];
const ZEZTZ_FLICKER = 0.18;   // 闪烁帧的切换周期（秒）
const ZEZTZ_TRANS_FLIP = 1;   // 变身表朝向系数：若变身时角色朝向反了，改成 -1

function zFrameVal(v, s) {
  return Array.isArray(v) ? v[((s / ZEZTZ_FLICKER) | 0) % v.length] : v;
}

function zeztzFrameAt(s) {
  let j = 0;
  while (j + 1 < ZEZTZ_KEYS.length && ZEZTZ_KEYS[j + 1][0] <= s) j++;
  const a = ZEZTZ_KEYS[j], b = ZEZTZ_KEYS[j + 1];
  const fa = zFrameVal(a[1], s);
  if (!b || b[2] || Array.isArray(a[1])) return { a: fa, b: fa, e: 0 };
  const t = cl((s - a[0]) / (b[0] - a[0]), 0, 1);
  return { a: fa, b: zFrameVal(b[1], s), e: t * t * (3 - 2 * t) };
}

// 画变身表的一帧：脚底对齐 y，水平居中于 x（不依赖外部 drC，缩放用 sliceSheet 算好的 S.s）
function zDrawTrans(S, idx, x, y, f, alpha) {
  const fr = S.f[idx];
  if (!fr || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.scale(f * ZEZTZ_TRANS_FLIP * S.s, S.s);
  ctx.drawImage(fr, -S.cw / 2, -S.fy);
  ctx.restore();
}

// ---------- 变身粒子特效 ----------
function zeztzTransFx(x, y, s, pass) {
  const L = ZEZTZ_TL, belt = y - 96;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  if (pass === 0) {
    // 身后：鼓点能量环（第二段更大，青/红交替）
    const ring = (tb, i, big) => {
      const age = s - tb;
      if (age < 0 || age >= 0.7) return;
      const p = age / 0.7, r = 30 + p * (big ? 280 : 190), a = (1 - p).toFixed(3);
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(0,242,254,' + a + ')' : 'rgba(255,59,48,' + a + ')';
      ctx.lineWidth = (big ? 4 : 3) * (1 - p) + 1;
      ctx.beginPath();
      ctx.ellipse(x, y + 2, r, r * 0.22, 0, 0, Math.PI * 2);
      ctx.stroke();
    };
    L.beats1.forEach((tb, i) => ring(tb, i, false));
    L.beats2.forEach((tb, i) => ring(tb, i, true));

    // 聚能：腰带辉光 + 向身体收拢的粒子，强度随时间递增，直到爆发
    if (s >= L.ready && s < L.burst) {
      const p = cl((s - L.ready) / (L.burst - L.ready), 0, 1);
      const gr = ctx.createRadialGradient(x, belt, 0, x, belt, 50 + p * 90);
      gr.addColorStop(0, 'rgba(255,255,255,' + (0.12 + p * 0.45).toFixed(3) + ')');
      gr.addColorStop(0.5, 'rgba(255,59,48,' + (0.10 + p * 0.25).toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(x, belt, 50 + p * 90, 0, Math.PI * 2); ctx.fill();

      const n = 10 + (p * 26 | 0);
      for (let i = 0; i < n; i++) {
        const ph = (s * (1.2 + p) + i * 0.17) % 1;
        const ang = s * 3.5 + i * 0.7;
        const rad = (1 - ph) * (170 + p * 40) + 20;
        ctx.fillStyle = i % 2 === 0 ? '#00f2fe' : '#ff4757';
        ctx.beginPath();
        ctx.arc(x + Math.cos(ang) * rad, belt + Math.sin(ang) * rad * 0.55, 2.5 * ph + 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    // 身前：爆发闪光 + 地面冲击环
    const bAge = s - L.burst;
    if (bAge >= 0 && bAge < 0.9) {
      const p = bAge / 0.9, R = 40 + p * 400;
      const gr = ctx.createRadialGradient(x, belt, 0, x, belt, R);
      gr.addColorStop(0, 'rgba(255,255,255,' + (1 - p * 0.6).toFixed(3) + ')');
      gr.addColorStop(0.35, 'rgba(0,242,254,' + (0.85 * (1 - p)).toFixed(3) + ')');
      gr.addColorStop(0.7, 'rgba(255,59,48,' + (0.5 * (1 - p)).toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(x, belt, R, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = 'rgba(0,242,254,' + (1 - p).toFixed(3) + ')';
      ctx.lineWidth = 5 * (1 - p) + 1;
      ctx.beginPath(); ctx.ellipse(x, y + 2, 40 + p * 420, (40 + p * 420) * 0.2, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawZeztzTransform(x, y, f) {
  const S_ = SHZ.trans;
  if (!okS(S_)) { dr(SH.atk, 12, x, y, f, 1.0); return; }
  const s = zeztzSyncT(P.t);
  const fr = zeztzFrameAt(s);

  zeztzTransFx(x, y, s, 0);
  ctx.save();
  // 爆发前红光，爆发后换青光
  ctx.shadowColor = s >= ZEZTZ_TL.burst ? '#00f2fe' : '#ff4757';
  ctx.shadowBlur = s >= ZEZTZ_TL.burst ? 24 : 10 + cl((s - ZEZTZ_TL.ready) / (ZEZTZ_TL.burst - ZEZTZ_TL.ready), 0, 1) * 14;
  const by = y + Math.sin(T * 3.0) * 1.2;
  zDrawTrans(S_, fr.a, x, by, f, 1);                 // 底层帧完整绘制
  if (fr.e > 0 && fr.b !== fr.a) zDrawTrans(S_, fr.b, x, by, f, fr.e);   // 目标帧叠加淡入（避免中间变暗）
  ctx.restore();
  zeztzTransFx(x, y, s, 1);
}

function updZeztzTrans(dt) {
  const L = ZEZTZ_TL, s = zeztzSyncT(P.t), h = P.hit;
  const fire = (id, t, fn) => { if (s >= t && !h[id]) { h[id] = 1; fn(); } };
  const say = (str, t, c) => DT.push({ x: P.x, y: P.y - 210, s: str, t: t, c: c });

  fire('impact1', L.impact1, () => { shake = Math.max(shake, 6); say('IMPACT!', 1.0, '#00f2fe'); });
  L.beats1.forEach((tb, i) => fire('a' + i, tb, () => { shake = Math.max(shake, 4); }));
  fire('ready', L.ready, () => { shake = Math.max(shake, 6); say('COME ON! READY!', 1.2, '#ffd84a'); });
  L.beats2.forEach((tb, i) => fire('b' + i, tb, () => { shake = Math.max(shake, 5 + i * 1.5); }));
  fire('swell', L.swell, () => { shake = Math.max(shake, 7); say('POWER OVERLOAD…', 1.4, '#ff4757'); });
  fire('henshin', L.henshin, () => { shake = Math.max(shake, 10); say('HENSHIN!', 1.4, '#ffffff'); });
  fire('burst', L.burst, () => {
    shake = 28;
    if (G === 'play') area(P.x - 380, P.x + 380, P.atk * 3.6);
    say('ZEZTZ · MECHA IMPACT!', 1.8, '#00f2fe');
    FX.push({ type: 'boom', x: P.x, y: GY - 60, t: 0.8, d: 0.8, r: 340, c: '#00f2fe' });
    FX.push({ type: 'boom', x: P.x, y: GY - 60, t: 0.6, d: 0.6, r: 240, c: '#ff4757' });
  });
  fire('calm', L.calm, () => { say('KAMEN RIDER ZEZTZ', 1.6, '#00f2fe'); });
}

// ---------- L 技能：挥拳释放 KR_Zeztz_Energywave ----------
function fireZeztzWave() {
  const f = P.f;
  const startX = P.x + f * 50;
  const startY = P.y - 95;
  Z_WAVES.push({
    x: startX,
    y: startY,
    vx: f * 1150,
    f: f,
    t: 1.3,
    dur: 1.3,
    w: 220,
    h: 110,
    dmg: P.atk * 2.2,
    hit: {},
    tick: 0
  });
  shake = Math.max(shake, 8);
  FX.push({ type: 'boom', x: startX, y: startY, t: 0.2, d: 0.2, r: 50, c: '#00f2fe' });
  DT.push({ x: P.x, y: P.y - 190, s: 'IMPACT WAVE!', t: 0.9, c: '#00f2fe' });
}

function updZeztzWaves(dt) {
  for (const b of Z_WAVES) {
    b.t -= dt;
    b.x += b.vx * dt;
    b.tick -= dt;
    if (b.vis) continue;   // 联机：队友的能量波只做展示，伤害由发射者结算

    if (b.tick <= 0) {
      b.tick = 0.15;
      b.hit = {}; // 允许对穿过的敌人造成多段贯穿伤害
    }
    // 抵消前方的弹幕
    cancelEP(b.x - 80, b.x + 80);

    // 碰撞伤害判定
    for (const e of E) {
      if (e.dead || b.hit[e.id]) continue;
      if (Math.abs(e.x - b.x) < 80 + e.w * 0.4 && Math.abs((e.y - e.h * 0.5) - b.y) < 70) {
        b.hit[e.id] = 1;
        hurt(e, b.dmg);
        FX.push({ type: 'boom', x: e.x, y: e.y - e.h * 0.5, t: 0.2, d: 0.2, r: 48, c: '#ff3838' });
      }
    }
  }
  Z_WAVES = Z_WAVES.filter(b => b.t > 0);
}

function drawZeztzEnergyWaves() {
  for (const b of Z_WAVES) {
    const x = sn(b.x - cam), y = sn(b.y);
    const p = b.t / b.dur;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(b.f, 1);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, p * 1.5);

    if (WAVE_Z) {
      // 素材图像原图：左边为波头，右边为火焰拖尾
      // 当向右发射(b.f > 0)时，需要将图像水平镜像让波头朝右前冲
      ctx.scale(-1, 1);
      ctx.drawImage(WAVE_Z, -b.w * 0.55, -b.h * 0.5, b.w, b.h);
    } else {
      ctx.fillStyle = '#ff3838';
      ctx.beginPath();
      ctx.ellipse(0, 0, 70, 35, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ---------- 大招 K：FINAL IMPACT · 旋涡冲拳连击 ----------
const ZEZTZ_FV = { charge: 0.5, rush: 1.2, slam: 1.9 };

function updZeztzFV(dt) {
  const Z = ZEZTZ_FV, t = P.t;
  P.inv = 1;

  if (!P.hit['fv_start']) {
    P.hit['fv_start'] = 1;
    shake = 10;
    DT.push({ x: P.x, y: P.y - 200, s: 'FINAL VENT · IMPACT BUSTER!', t: 1.5, c: '#00f2fe' });
  }

  if (t < Z.charge) {
    P.vx = 0; P.vy = 0;
  } else if (t < Z.rush) {
    // 旋涡冲拳急速突进！
    P.vx = P.f * 1300; P.vy = 0;
    area(P.x - 90, P.x + 90, P.atk * 1.6, P.hit);
    cancelEP(P.x - 100, P.x + 100);
  } else if (!P.hit['landed']) {
    // 终结大爆炸撞地！
    P.hit['landed'] = 1; P.landT = t;
    P.vx = 0;
    shake = 32;
    area(P.x - 360, P.x + 360, P.atk * 5.8);
    FX.push({ type: 'boom', x: P.x + P.f * 60, y: GY - 40, t: 0.8, d: 0.8, r: 320, c: '#00f2fe' });
    FX.push({ type: 'boom', x: P.x + P.f * 60, y: GY - 40, t: 0.6, d: 0.6, r: 240, c: '#ff3838' });
    DT.push({ x: P.x, y: P.y - 190, s: 'FINAL IMPACT · 毁灭重击！', t: 1.8, c: '#00f2fe' });
  } else {
    P.vx = 0;
    if (t > P.landT + 0.8) {
      P.st = 'idle';
      P.inv = 0.5;
    }
  }
}

function drawZeztzFV(x, y, f) {
  const V = SHZ.fv;
  if (!okS(V)) { dr(SH.atk, 12, x, y, f, 1.0); return; }
  const t = P.t;
  let idx = 0;
  if (t < 0.25) idx = 1;
  else if (t < 0.5) idx = 4;
  else if (t < 0.8) idx = 7;
  else if (t < 1.1) idx = 10;
  else if (t < 1.4) idx = 14;
  else if (t < 1.7) idx = 16;
  else if (!P.hit['landed']) idx = 17;
  else {
    const d = t - P.landT;
    idx = d < 0.3 ? 20 : d < 0.6 ? 21 : 23;
  }
  ctx.save();
  ctx.shadowColor = '#00f2fe';
  ctx.shadowBlur = 18;
  dr(V, idx, x, y, f, 1.0);
  ctx.restore();
}

function drawZeztzMark() {
  if (!P.zeztz || P.st !== 'fv' || P.hit['landed']) return;
  const tx = P.x + P.f * 180 - cam;
  ctx.save();
  ctx.strokeStyle = '#00f2fe';
  ctx.shadowColor = '#00f2fe';
  ctx.shadowBlur = 14;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(tx, GY + 4, 90, 16, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ---------- Zeztz 形态总绘制 ----------
function drawZeztz(x, y, f) {
  const R = SHZ.run, J = SHZ.jump, A = SHZ.atk, st = P.st;
  ctx.save();
  ctx.shadowColor = '#00f2fe';
  ctx.shadowBlur = st === 'run' ? 4 : 10 + Math.sin(T * 6) * 4;

  if (st === 'run') {
    if (okS(R)) dr(R, (T * (P.spr ? 20 : 13) | 0) % R.f.length, x, y, f, 1.0);
    else dr(SH.run, (T * 14 | 0) % 12, x, y, f, 1.0);
  } else if (st === 'atk') {
    if (okS(A)) {
      const idx = Math.min(A.f.length - 1, P.t * 15 | 0);
      dr(A, idx, x, y, f, 1.0);
    } else dr(SH.atk, [3, 4, 5, 6, 7, 8][Math.min(5, P.t * 14 | 0)], x, y, f, 1.0);
  } else if (st === 'air') {
    if (okS(J)) {
      const i = P.vy < -300 ? 2 : P.vy < 0 ? 3 : P.vy < 250 ? 4 : 5;
      dr(J, Math.min(J.f.length - 1, i), x, y, f, 1.0);
    } else dr(SH.jump, 2, x, y, f, 1.0);
  } else if (st === 'thr') {
    // 挥拳放波姿势
    if (okS(A)) dr(A, 6, x, y, f, 1.0);
    else dr(SH.atk, 4, x, y, f, 1.0);
  } else if (st === 'fv') {
    drawZeztzFV(x, y, f);
  } else {
    // idle
    if (okS(A)) dr(A, 0, x, y + Math.sin(T * 3) * 1.0, f, 1.0);
    else dr(SH.atk, 12, x, y, f, 1.0);
  }
  ctx.restore();
}