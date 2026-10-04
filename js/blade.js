// ===== 假面骑士 Blade 专属逻辑：素材加载 / 变身 / 形态绘制 / L 持剑召雷 / 大招 雷电音速踢 =====
// 素材与参数见 config.js 中的 SH6 / BLADE_* ；形态标记：P.bl ；变身入口：player.js 的 triggerRyukiTransform()
// 素材放在 Assets/Kamen Rider Blade/ ：KR_Blade_Run / Jump / NormalAttack / FinalVent / Sword / Lightning .png

// ---------- 素材加载（由 main.js 的 prep() 调用）----------
let SWD6 = null, LTN6 = null;    // L 技能：Blay Rouzer 剑 / 闪电贴图（加载时预缩放）
let BLB = [];                    // 场上的闪电束
let LOGO6 = null;               // 大招落地的黑桃纹章（边缘做了径向渐隐，去掉格子硬边）

// ---------- 变身表精准切分 ----------
// 素材不是等分网格：列间有空隙，但行与行之间几乎贴在一起（行距约 395~440px，而且上一行的脚/特效会碰到下一行的头）。
// 做法：在“名义边界 ± 窗口”内找像素最稀疏的位置当切线（列用整表，行按列带分别找），
// 再清掉切线两侧漏进来的邻行碎块，最后把每帧按“脚底”对齐到同一条基线（所有帧同尺寸，fy 统一）。
function valleyCut(prof, nominal, win) {
  const a = Math.max(1, Math.round(nominal - win)), b = Math.min(prof.length - 1, Math.round(nominal + win));
  let mv = 1e9; for (let i = a; i <= b; i++) if (prof[i] < mv) mv = prof[i];
  const c = []; for (let i = a; i <= b; i++) if (prof[i] <= mv) c.push(i);
  return c[c.length >> 1];   // 最稀疏处可能是一段，取中间
}
// 去掉“漏进来的邻行碎块”：贴着格子上/下边缘、整块只在边缘 30% 内、且比主体小很多的实心块（连同它周围孤立的光晕）
function stripEdgeLeak(c, top, bot) {
  const w = c.width, h = c.height, g = c.getContext('2d'), img = g.getImageData(0, 0, w, h), p = img.data, N = w * h;
  const lab = new Int32Array(N), blobs = [];
  for (let s = 0; s < N; s++) {
    if (lab[s] || p[s * 4 + 3] <= 128) continue;
    const id = blobs.length + 1, q = [s]; lab[s] = id; let minX = w, maxX = 0, minY = h, maxY = 0;
    for (let head = 0; head < q.length; head++) {
      const cur = q[head], cx = cur % w, cy = (cur / w) | 0;
      if (cx < minX) minX = cx; if (cx > maxX) maxX = cx; if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; const X = cx + dx, Y = cy + dy; if (X < 0 || X >= w || Y < 0 || Y >= h) continue;
        const k = Y * w + X; if (!lab[k] && p[k * 4 + 3] > 128) { lab[k] = id; q.push(k) }
      }
    }
    blobs.push({ id, q, minX, maxX, minY, maxY });
  }
  if (blobs.length < 2) return c;
  let main = blobs[0]; for (const b of blobs) if (b.q.length > main.q.length) main = b;
  const kill = blobs.filter(b => b !== main && b.q.length < main.q.length * .25 &&
    ((top && b.minY <= 3 && b.maxY < h * .3) || (bot && b.maxY >= h - 4 && b.minY > h * .7)));
  const R = 10;
  for (const b of kill) {
    const x0 = Math.max(0, b.minX - R), x1 = Math.min(w - 1, b.maxX + R), y0 = Math.max(0, b.minY - R), y1 = Math.min(h - 1, b.maxY + R);
    for (const k of b.q) p[k * 4 + 3] = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = y * w + x; if (!p[k * 4 + 3] || lab[k] === main.id) continue;
      let near = false;
      for (let dy = -3; dy <= 3 && !near; dy++) for (let dx = -3; dx <= 3; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && X < w && Y >= 0 && Y < h && lab[Y * w + X] === main.id) { near = true; break } }
      if (!near) p[k * 4 + 3] = 0;
    }
  }
  // 切线附近 14px 内：不贴着主体(8px)的残留半透明像素（邻行漏进来的光晕 / 细线）一并擦掉
  const Z = 14, RR = 8;
  for (let y = 0; y < h; y++) {
    if (!((top && y < Z) || (bot && y >= h - Z))) continue;
    for (let x = 0; x < w; x++) {
      const k = y * w + x; if (!p[k * 4 + 3]) continue;
      let near = false;
      for (let dy = -RR; dy <= RR && !near; dy += 2) for (let dx = -RR; dx <= RR; dx += 2) { const X = x + dx, Y = y + dy; if (X >= 0 && X < w && Y >= 0 && Y < h && lab[Y * w + X] === main.id) { near = true; break } }
      if (!near) p[k * 4 + 3] = 0;
    }
  }
  g.putImageData(img, 0, 0); return c;
}

// 去绿边：素材是绿幕抠的，轮廓上那 3~4px 半透明像素带绿色。
// 把“偏绿且 alpha<250”的像素改成 4px 内最近的“芯”像素颜色（芯 = alpha>=250 且不偏绿）；周围没有非绿芯的（绿色能量 / 光效本身）保持原样。
function defringe(c) {
  const w = c.width, h = c.height, g = c.getContext('2d'), img = g.getImageData(0, 0, w, h), p = img.data, o = new Uint8ClampedArray(p);
  const green = k => o[k + 1] > o[k] + 25 && o[k + 1] > o[k + 2] + 25, R = 4;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = (y * w + x) * 4, a = o[k + 3]; if (a === 0 || a >= 250 || !green(k)) continue;
    let bd = 1e9, bk = -1;
    for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
      const X = x + i, Y = y + j; if (X < 0 || X >= w || Y < 0 || Y >= h) continue;
      const kk = (Y * w + X) * 4, d = i * i + j * j; if (d < bd && o[kk + 3] >= 250 && !green(kk)) { bd = d; bk = kk }
    }
    if (bk >= 0) { p[k] = o[bk]; p[k + 1] = o[bk + 1]; p[k + 2] = o[bk + 2] }
  }
  g.putImageData(img, 0, 0); return c;
}
function sliceTransBlade(im, cN, rN, refIdx) {
  const w = im.width, h = im.height, src = toCanvas(im), p = src.getContext('2d').getImageData(0, 0, w, h).data;
  const colP = new Int32Array(w); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (p[(y * w + x) * 4 + 3] > 128) colP[x]++;
  const xs = [0]; for (let k = 1; k < cN; k++) xs.push(valleyCut(colP, w * k / cN, w / cN * .18)); xs.push(w);
  const ys = [];   // ys[c] = 第 c 列带的 rN+1 条横切线
  for (let c = 0; c < cN; c++) {
    const rp = new Int32Array(h);
    for (let y = 0; y < h; y++) { let n = 0; for (let x = xs[c]; x < xs[c + 1]; x++) if (p[(y * w + x) * 4 + 3] > 128) n++; rp[y] = n }
    const a = [0]; for (let k = 1; k < rN; k++) a.push(valleyCut(rp, h * k / rN, h / rN * .22)); a.push(h); ys.push(a);
  }
  // 逐格裁剪 + 清邻行碎块 + 记录包围盒
  const cells = []; let W = 0, H = 0;
  for (let r = 0; r < rN; r++) for (let c = 0; c < cN; c++) {
    const x0 = xs[c], x1 = xs[c + 1], y0 = ys[c][r], y1 = ys[c][r + 1], cw = x1 - x0, ch = y1 - y0;
    const k = document.createElement('canvas'); k.width = cw; k.height = ch;
    k.getContext('2d').drawImage(src, x0, y0, cw, ch, 0, 0, cw, ch);
    stripEdgeLeak(k, r > 0, r < rN - 1); defringe(k);
    const b = bb(k); cells.push({ k, b }); if (cw > W) W = cw; if (b.y1 - b.y0 + 1 > H) H = b.y1 - b.y0 + 1;
  }
  H += 4;
  // 统一画布：每帧脚底（包围盒底边）落在 H-1，水平位置保持原样
  const f = cells.map(({ k, b }) => {
    const o = document.createElement('canvas'); o.width = W; o.height = H;
    o.getContext('2d').drawImage(k, 0, -(b.y1 - (H - 1)) , k.width, k.height);
    return o;
  });
  const br = bb(f[refIdx]);
  return { f, cw: W, ch: H, fy: H - 1, s: PH / (br.y1 - br.y0), cuts: { xs, ys } };
}

async function loadBladeAssets() {
  // 胶囊卡面（可选；没有就用默认占位，不报缺失）
  for (const fn of ['KR_Blade.jpg', 'KR_Blade.png']) {
    try { CAP_IMGS.blade = await load(DRAW + fn); break } catch (e) { }
  }

  // 变身表（Transform 文件夹，5×4 共 20 帧；以第 19 帧 Blade 站姿作为缩放基准）
  try {
    const im = await load(TRANS + 'KR_Malaya_TransformTo_KR_Blade.png');
    // 变身表不是等分网格（行与行贴在一起、列间有空隙）：按像素空隙找切线 → 清邻行漏入 → 去绿边 → 脚底对齐
    SH6.trans = sliceTransBlade(im, 5, 4, 19);
  } catch (e) { miss.push('Transform/KR_Malaya_TransformTo_KR_Blade.png'); }

  for (const [key, o] of Object.entries(SH6)) {
    if (key === 'trans') continue;
    try {
      const im = await load(BLADE + o.f);
      Object.assign(o, sliceSheet(im, o.c, o.r, o.ref || 0, 0, false));
    } catch (e) { miss.push('Kamen Rider Blade/' + o.f); }
  }

  if (okS(SH6.fv) && SH6.fv.f[13]) {
    const src = SH6.fv.f[13], w = src.width, h = src.height, c = document.createElement('canvas'), g = c.getContext('2d');
    c.width = w; c.height = h; g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'destination-in';
    const rg = g.createRadialGradient(w / 2, h / 2, w * .28, w / 2, h / 2, w * .5);
    rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, w, h); LOGO6 = c;
  }

  // 剑：裁掉透明边后预缩放到 480px 宽，并记录“握柄点 / 轴长 / 剑尖朝向”
  try {
    const t = trim(toCanvas(await load(BLADE + 'KR_Blade_Sword.png')));
    const w = 480, h = Math.round(t.height * w / t.width), c = document.createElement('canvas');
    c.width = w; c.height = h; c.getContext('2d').drawImage(t, 0, 0, w, h);
    c.gx = w * BLADE_SWORD.gx; c.gy = h * BLADE_SWORD.gy; c.axis = w * BLADE_SWORD.axisR;
    SWD6 = c;
  } catch (e) { miss.push('Kamen Rider Blade/KR_Blade_Sword.png'); }

  // 闪电：左上角→右下角为主干，预缩放到 1200px 宽
  try {
    const t = trim(toCanvas(await load(BLADE + 'KR_Blade_Lightning.png')));
    const w = Math.min(1200, t.width), h = Math.round(t.height * w / t.width), c = document.createElement('canvas');
    c.width = w; c.height = h; c.getContext('2d').drawImage(t, 0, 0, w, h);
    c.dg = Math.hypot(w, h); c.phi = BLADE_BOLT.phi;
    LTN6 = c;
  } catch (e) { miss.push('Kamen Rider Blade/KR_Blade_Lightning.png'); }
}

// ---------- 变身音效（可选：Assets/SoundFX/ 下放 Blade 的变身音频即可；没有就静音，时长用默认值）----------
const BLADE_SND_FILES = ['Kamen_Rider_Blade_Henshin.m4a', 'Kamen Rider Blade Henshin.m4a', 'Kamen Rider Blade Henshin.mp3', 'Kamen_Rider_Blade_Henshin.mp3'];
const BLADE_TRANS_DEF = 16 * 0.12;   // 没有音频时的默认时长（整条时间轴等比压缩）
let SND6 = null;
(function initBladeSound() {
  let i = 0;
  const next = () => {
    if (i >= BLADE_SND_FILES.length) { SND6 = null; return }
    const a = new Audio(); a.preload = 'auto';
    a.addEventListener('error', next, { once: true });
    a.src = encodeURI(A + 'SoundFX/' + BLADE_SND_FILES[i++]);
    SND6 = a;
  };
  next();
})();
function bladeTransDur() { return SND6 ? (isFinite(SND6.duration) && SND6.duration > 0.5 ? SND6.duration : BLADE_AUDIO_LEN) : BLADE_TRANS_DEF }
// 音频正在播放时，动画时钟直接取音频的 currentTime（开菜单 / 掉帧后恢复也能对上）
function bladeSyncT(t) { return SND6 && !SND6.paused && SND6.currentTime > .02 ? SND6.currentTime : t }
const bladeTS = () => P.t * BLADE_AUDIO_LEN / (P.tdur || BLADE_TRANS_DEF);   // 换算成“音频原速秒数”
function playBladeHenshin() { if (!SND6) return; try { SND6.currentTime = 0; const p = SND6.play(); if (p && p.catch) p.catch(() => { }) } catch (e) { } }
function stopBladeHenshin() { if (SND6 && !SND6.paused) SND6.pause() }

// ---------- 绘制小工具 ----------
// 按“每帧的锚点 x（头部/身体中心）+ 脚底 y”绘制；ax[i] 为该帧里角色的水平锚点（原图像素），foot[i] 可选，逐帧脚底
function drB(S, ax, i, x, y, f, al = 1, foot) {
  const fr = S && S.f && S.f[i]; if (!fr) return;
  const a = ax && ax[i] !== undefined ? ax[i] : S.cw / 2, fy = foot && foot[i] !== undefined ? foot[i] : S.fy;
  ctx.save(); ctx.globalAlpha *= al; ctx.translate(sn(x), sn(y)); ctx.scale(f * S.s, S.s);
  ctx.drawImage(fr, -a, -fy); ctx.restore();
}
function drBR(i, x, y, f) { drB(SH6.run, BLADE_AX.run, i, x, y, f, 1, BLADE_FOOT.run) }
const smooth01 = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) };

// ---------- 变身动画（素材里没有专用变身表：Malaya → 卡牌展开 → 雷光爆发 → Blade 待机，帧间交叉淡入淡出）----------
const BLADE_PAL = { sh: '#3aa0ff', g0: 8, g1: 13, bq: 8, ring: [[90, 180, 255], [90, 255, 210]], pt: ['90,180,255', '210,240,255'], fl: ['235,248,255', '90,180,255', '20,80,220'], fr: '200,230,255' };

// ---------- 变身动画：按音频时间轴播放变身表 20 帧 + 节拍特效 ----------
let _bladeKeys = null;
function bladeKeys() {
  if (_bladeKeys) return _bladeKeys;
  const src = BLADE_KEYS, out = [];
  for (let n = 0; n < src.length; n++) {
    const [t, i, cut] = src[n];
    if (i === 'spin') { const t1 = src[n + 1][0]; let c = 0; for (let u = t; u < t1 - .05; u += .15, c++) out.push({ t: u, i: 8 + c % 3, cut: 0, fd: .05 }) }
    else out.push({ t, i, cut: cut | 0 });
  }
  return _bladeKeys = out;
}
function bladeFrameAt(s) {   // → { a, b, e }：当前帧 / 下一帧 / 交叉淡入进度
  const K = bladeKeys(); let j = 0;
  while (j + 1 < K.length && K[j + 1].t <= s) j++;
  const a = K[j], b = K[j + 1];
  if (!b || b.cut) return { a: a.i, b: a.i, e: 0 };
  const fd = Math.min(b.fd || .16, (b.t - a.t) * .6);
  return { a: a.i, b: b.i, e: smooth01(b.t - fd, b.t, s) };
}

const bhz = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v) };   // 稳定伪随机（不会每帧乱跳）
function bFlash(x, y, r, a, c0, c1) {
  if (a <= .004) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, 'rgba(' + c0 + ',' + Math.min(1, a).toFixed(3) + ')'); g.addColorStop(.45, 'rgba(' + c1 + ',' + (a * .45).toFixed(3) + ')'); g.addColorStop(1, 'rgba(' + c1 + ',0)');
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function bRing(x, y, rx, ry, a, lw, c) {
  if (a <= .004) return;
  ctx.strokeStyle = 'rgba(' + c + ',' + Math.min(1, a).toFixed(3) + ')'; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(1, rx), Math.max(1, ry), 0, 0, 7); ctx.stroke();
}
function bRays(x, y, n, r0, r1, a, seed, c) {
  if (a <= .004) return;
  ctx.strokeStyle = 'rgba(' + c + ',' + Math.min(1, a * a).toFixed(3) + ')'; ctx.lineWidth = 1.4; ctx.beginPath();
  for (let i = 0; i < n; i++) { const an = (i + bhz(i + seed)) / n * 6.2832, k = .6 + bhz(i * 3 + seed) * .4; ctx.moveTo(x + Math.cos(an) * r0, y + Math.sin(an) * r0 * .8); ctx.lineTo(x + Math.cos(an) * r1 * k, y + Math.sin(an) * r1 * k * .8) }
  ctx.stroke();
}

// pass 0 = 角色身后（地面涟漪 / 卡牌环光晕 / 粒子）  pass 1 = 角色身前（闪光 / 冲击 / 扫描）
function bladeTransFx(x, y, s, pass) {
  const L = BLADE_TL, belt = y - 98;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (pass === 0) {
    // 每个鼓点 / 重音：地面一圈涟漪（大冲击更大更亮）
    for (const tb of L.beats.concat([L.gate, L.burst, L.wave, L.fin])) {
      const age = s - tb, big = tb === L.burst || tb === L.fin, life = big ? 1.1 : .8;
      if (age < 0 || age > life) continue;
      const p = age / life, r = 30 + p * (big ? 380 : 230);
      bRing(x, y + 2, r, r * .16, (1 - p) * (big ? .9 : .6), big ? 5 : 3, tb >= L.burst ? '120,200,255' : '90,255,210');
    }
    // 腰间卡牌环光晕：随鼓点逐渐变亮、转速加快，6.87 穿过之门后消失
    const ra = smooth01(3.0, 4.8, s) * (1 - smooth01(L.gate, L.gate + .25, s));
    if (ra > .01) {
      const sp = 1 + smooth01(4.8, 6.8, s) * 2.5;
      ctx.save(); ctx.setLineDash([16, 12]); ctx.lineDashOffset = -s * 70 * sp;
      bRing(x, belt, 96, 16, ra * .55, 5, '90,255,210'); bRing(x, belt, 100, 17, ra * .3, 10, '90,180,255');
      ctx.setLineDash([]); ctx.restore();
      for (let i = 0; i < 10; i++) {   // 沿环旋转的亮点
        const an = s * 3.2 * sp + i * .6283, px = x + Math.cos(an) * 96, py = belt + Math.sin(an) * 16;
        bFlash(px, py, 9, ra * .8 * (Math.sin(an) > 0 ? 1 : .45), '235,255,250', '90,255,210');
      }
    }
    // 上升粒子（爆发后更密）
    const amp = smooth01(3.0, 4.2, s) * (1 - smooth01(10.2, 11.2, s)), n = s > L.burst ? 44 : 28;
    if (amp > .01) for (let i = 0; i < n; i++) {
      const ph = (s * (s > L.burst ? .8 : .5) + i * .137) % 1, px = x + (bhz(i) - .5) * 150 * (.6 + ph * .4), py = y - 10 - ph * 250, r = 1.4 + bhz(i + 9) * 2.4;
      ctx.fillStyle = 'rgba(' + (i & 1 ? '90,255,210' : '150,210,255') + ',' + ((1 - ph) * amp * .9).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill();
    }
  } else {
    // 0.44 抽牌：牌面闪光 + 十字星芒
    let a = s - L.draw;
    if (a >= 0 && a < .5) { const p = a / .5; bFlash(x - 4, y - 212, 22 + p * 110, (1 - p) * .9, '255,255,255', '120,255,200'); bRays(x - 4, y - 212, 8, 6, 20 + p * 80, (1 - p) * .8, 3, '220,255,240') }
    // 腰带亮起（1.25 → 穿门）+ 2.0 火花
    const ga = smooth01(L.belt, 2.0, s) * (1 - smooth01(L.gate, L.gate + .3, s));
    if (ga > .01) bFlash(x, belt, 24 + ga * 20 + Math.sin(s * 9) * 3, ga * .6, '220,255,235', '90,255,190');
    a = s - L.spark;
    if (a >= 0 && a < .4) { const p = a / .4; bRays(x, belt, 12, 10 + p * 60, 30 + p * 140, (1 - p) * .85, 7, '200,255,230') }
    // 鼓点：腰间一闪
    for (const tb of L.beats) { a = s - tb; if (a >= 0 && a < .25) { const p = a / .25; bFlash(x, belt, 60 + p * 150, (1 - p) * .38, '210,255,235', '90,200,255') } }
    // 6.87 穿过觉醒之门：光环从脚扫到头
    a = s - L.gate;
    if (a >= 0 && a < .55) {
      const p = a / .55, yy = y - p * 205;
      for (let m = 0; m < 5; m++) bRing(x, yy + m * 13, 92 - m * 4, 16, (1 - p) * (m ? .5 / m : .95), m ? 3 : 6, '230,250,255');
      bFlash(x, yy, 120, (1 - p) * .4, '235,250,255', '90,200,255');
    }
    // 7.48 全曲最强一击：光爆 + 射线 + 冲击环 + 水花
    a = s - L.burst;
    if (a >= 0 && a < 1.0) {
      const p = a / 1.0, my = y - 105;
      bFlash(x, my, 140 + p * 420, (1 - p) * .9, '255,255,255', '90,180,255');
      bRays(x, my, 18, 40 + p * 60, 120 + p * 330, (1 - p) * .9, 1, '210,240,255');
      bRing(x, my, 30 + p * 330, 30 + p * 330, (1 - p) * .8, 6 * (1 - p) + 1, '160,220,255');
      for (let i = 0; i < 36; i++) {   // 水花：向上抛出再落下
        const an = -3.1416 * (.08 + .84 * bhz(i)), v = 220 + bhz(i + 3) * 300, px = x + Math.cos(an) * v * a * .8, py = y - 6 + Math.sin(an) * v * a + 520 * a * a;
        if (py > y + 4) continue;
        ctx.fillStyle = 'rgba(' + (i & 1 ? '170,225,255' : '235,250,255') + ',' + ((1 - p) * .9).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(px, py, 1.6 + bhz(i + 5) * 2.6, 0, 7); ctx.fill();
      }
    }
    // 8.0 / 8.45 / 8.9 装甲逐段生成：光带从脚扫到头
    for (const ts of L.scans) {
      a = s - ts;
      if (a >= 0 && a < .45) {
        const p = a / .45, yy = y - p * 200, g = ctx.createLinearGradient(0, yy - 16, 0, yy + 16);
        g.addColorStop(0, 'rgba(150,230,255,0)'); g.addColorStop(.5, 'rgba(200,245,255,' + ((1 - p) * .7).toFixed(3) + ')'); g.addColorStop(1, 'rgba(150,230,255,0)');
        ctx.fillStyle = g; ctx.fillRect(x - 85, yy - 16, 170, 32);
      }
    }
    // 9.0 第二次重音：身体一闪 + 一圈环
    a = s - L.wave;
    if (a >= 0 && a < .5) { const p = a / .5; bFlash(x, y - 105, 100 + p * 160, (1 - p) * .5, '230,250,255', '90,180,255'); bRing(x, y - 105, 40 + p * 200, 40 + p * 200, (1 - p) * .5, 3, '150,230,255') }
    // 9.82 眼睛变红 · OPEN UP：红色眼光 + 全身光爆 + 射线 + 双层冲击环
    a = s - L.fin;
    if (a >= 0 && a < 1.1) {
      const p = a / 1.1;
      if (a < .5) bFlash(x, y - 176, 14 + a * 70, (1 - a / .5) * .95, '255,235,235', '255,40,40');
      bFlash(x, y - 105, 120 + p * 480, (1 - p) * .8, '255,255,255', '90,180,255');
      bRays(x, y - 105, 22, 50 + p * 60, 130 + p * 360, (1 - p) * .85, 11, '255,240,230');
      bRing(x, y - 105, 30 + p * 360, 30 + p * 360, (1 - p) * .8, 6 * (1 - p) + 1, '150,210,255');
      bRing(x, y - 105, 20 + p * 230, 20 + p * 230, (1 - p) * .7, 4 * (1 - p) + 1, '255,225,140');
    }
    // 10.5 起余韵：淡蓝光晕缓慢呼吸，随音频淡出
    const ca = smooth01(L.calm - .3, L.calm + .3, s) * (1 - smooth01(10.9, 11.35, s));
    if (ca > .01) bFlash(x, y - 100, 150, ca * (.16 + Math.sin(s * 5) * .04), '200,235,255', '90,180,255');
  }
  ctx.restore();
}

// 全屏效果：暗场（鼓点段落压暗背景）与白闪
function bladeScreenFx(s, over) {
  const L = BLADE_TL;
  ctx.save();
  if (!over) {
    const d = .42 * smooth01(2.6, 3.6, s) * (1 - smooth01(L.burst, L.burst + .4, s));
    if (d > .01) { ctx.fillStyle = 'rgba(2,8,26,' + d.toFixed(3) + ')'; ctx.fillRect(-80, -80, 1120, 700) }
  } else {
    ctx.globalCompositeOperation = 'lighter';
    let a = 0, t;
    if ((t = s - L.gate) >= 0 && t < .2) a = Math.max(a, (1 - t / .2) * .35);
    if ((t = s - L.burst) >= 0 && t < .55) a = Math.max(a, (1 - t / .55) * .85);
    if ((t = s - L.fin) >= 0 && t < .45) a = Math.max(a, (1 - t / .45) * .5);
    if (a > .01) { ctx.fillStyle = 'rgba(235,248,255,' + a.toFixed(3) + ')'; ctx.fillRect(-80, -80, 1120, 700) }
  }
  ctx.restore();
}

// 节拍事件（在 main.js 的更新循环里调用）：震屏 / 飘字 / 伤害，每个只触发一次
function updBladeTrans() {
  const s = bladeTS(), L = BLADE_TL, h = P.hit, fire = (k, t, fn) => { if (s >= t && !h[k]) { h[k] = 1; if (!(t < (P.sk || 0))) fn() } };
  fire('draw', L.draw, () => { shake = Math.max(shake, 2) });
  L.beats.forEach((t, n) => fire('b' + n, t, () => { shake = Math.max(shake, 4) }));
  fire('gate', L.gate, () => { shake = Math.max(shake, 12); DT.push({ x: P.x, y: P.y - 210, s: 'TURN UP！', t: 1.4, c: '#8fe9ff' }) });
  fire('burst', L.burst, () => { shake = Math.max(shake, 24) });
  fire('wave', L.wave, () => { shake = Math.max(shake, 9) });
  fire('fin', L.fin, () => {
    shake = 26; if (G === 'play') area(P.x - 360, P.x + 360, P.atk * 3.5);
    DT.push({ x: P.x, y: P.y - 210, s: 'BLADE · OPEN UP！', t: 1.8, c: '#3aa0ff' });
  });
}

function drawBladeTimeline(x, y, f) {
  const TR = SH6.trans, s = bladeTS(), fr = bladeFrameAt(s), L = BLADE_TL;
  bladeScreenFx(s, 0);
  bladeTransFx(x, y, s, 0);
  ctx.save();
  // 发光：开场无光 → 卡牌环段落青绿 → 爆发后蓝色 → 最终红眼瞬间一点红
  const green = s >= L.beats[0] && s < L.burst;
  ctx.shadowColor = (s >= L.fin && s < L.fin + .35) ? '#ff5a5a' : green ? '#5affc8' : BLADE_PAL.sh;
  ctx.shadowBlur = s < L.belt ? 0 : s < L.beats[0] ? (s - L.belt) / (L.beats[0] - L.belt) * 10 : s < L.burst ? 14 + Math.sin(s * 9) * 4 : s < L.calm ? 18 : 10;
  const fl = f * BLADE_TRANS_FLIP, bob = Math.sin(T * 2.4) * (s < 2 ? .6 : 1.2);
  if (fr.a === fr.b) drC(TR, fr.a, x, y + bob, fl);
  else { drC(TR, fr.a, x, y + bob, fl, 1, 1 - fr.e * fr.e); drC(TR, fr.b, x, y + bob, fl, 1, fr.e) }
  ctx.restore();
  bladeTransFx(x, y, s, 1);
  bladeScreenFx(s, 1);
}

function drawBladeTransform(x, y, f) {
  const TR = SH6.trans;
  if (okS(TR)) { drawBladeTimeline(x, y, f); return }   // 有变身表：按音频时间轴播放
  const V = SH6.fv, A6 = SH6.atk, M = SH.trans;
  if (!okS(V) || !okS(A6) || !okS(M)) { dr(SH.atk, 12, x, y, f, 1.0); return; }
  const q = Math.min(15.999, P.t / (P.tdur || BLADE_TRANS_DEF) * 16);
  const sw = Math.sin(T * 2.4), bob = sw * (q < 2 ? .6 : 1.4), fa = cl((16 - q) / 3, 0, 1);
  transFx(x, y, q, fa, 0, BLADE_PAL);
  ctx.save();
  ctx.shadowColor = BLADE_PAL.sh;
  ctx.shadowBlur = q < 4.5 ? 0 : q < 8 ? (q - 4.5) / 3.5 * 14 : q < 13 ? 24 + Math.sin(T * 9) * 6 : 10;
  const aM = 1 - smooth01(5, 8, q);                              // Malaya 淡出
  const aA = smooth01(5, 6.5, q) * (1 - smooth01(8, 9, q));      // 卡牌环绕
  const aB = smooth01(8, 8.8, q) * (1 - smooth01(10.2, 11, q));  // 雷光爆发
  const aD = smooth01(12.6, 14.2, q);                            // Blade 待机（淡入）
  const aC = smooth01(10, 11, q) * (aD < .999 ? 1 : 0);          // 雷电缠身（保持不透明直到待机完全盖上，避免人物半透明）
  if (aM > .01) drC(M, q < 3 ? 0 : 1, x, y + bob, f, 1, aM);
  if (aA > .01) drB(V, BLADE_AX.fv, 4, x, y + bob, f, aA);
  if (aB > .01) drB(V, BLADE_AX.fv, 5, x, y + bob, f, aB);
  if (aC > .01) drB(V, BLADE_AX.fv, 6, x, y + bob, f, aC);
  if (aD > .01) drB(A6, BLADE_AX.atk, 12, x, y + bob, f * BLADE_IDLE_FLIP, aD);
  ctx.restore();
  transFx(x, y, q, fa, 1, BLADE_PAL);
}

// ---------- Blade 形态总绘制 ----------
function drawBlade(x, y, f) {
  const R = SH6.run, J = SH6.jump, A6 = SH6.atk, st = P.st;
  ctx.save();
  ctx.shadowColor = '#3aa0ff';
  ctx.shadowBlur = st === 'run' ? 4 : 10 + Math.sin(T * 6) * 4;

  if (st === 'run') {
    if (okS(R)) drBR((T * (P.spr ? 15 : 10) | 0) % R.f.length, x, y, f);
    else dr(SH.run, (T * 14 | 0) % 12, x, y, f, 1.0);
  } else if (st === 'atk') {
    if (okS(A6)) drB(A6, BLADE_AX.atk, BLADE_ATK_SEQ[Math.min(BLADE_ATK_SEQ.length - 1, P.t * 14 | 0)], x, y, f * BLADE_ATK_FLIP);
    else dr(SH.atk, [3, 4, 5, 6, 7, 8][Math.min(5, P.t * 14 | 0)], x, y, f, 1.0);
  } else if (st === 'air') {
    if (okS(J)) {
      const i = P.vy < -350 ? 2 : P.vy < -100 ? 3 : P.vy < 100 ? 4 : P.vy < 250 ? 5 : 6;
      drB(J, BLADE_AX.jump, i, x, y, f);
    } else dr(SH.jump, 2, x, y, f, 1.0);
  } else if (st === 'thr') {
    drawBladeL(x, y, f);
  } else if (st === 'fv') {
    drawBladeFV(x, y, f);
  } else {   // idle / trans
    if (P.land > 0 && okS(J)) drB(J, BLADE_AX.jump, 7, x, y, f);
    else if (okS(A6)) drB(A6, BLADE_AX.atk, 12 + ((T * 1.6) | 0) % 2, x, y + Math.sin(T * 3) * 1.0, f * BLADE_IDLE_FLIP);
    else dr(SH.atk, 12, x, y, f, 1.0);
  }
  ctx.restore();
}

// ---------- L 技能：手持 Blay Rouzer，召唤闪电 ----------
// 手的位置：取 NormalAttack 第 10 帧（无剑、前伸的拳头）里的拳头，剑画在这只手上
function bladeHandLocal() {
  const B = BLADE_L, A6 = SH6.atk;
  if (okS(A6)) return { x: BLADE_IDLE_FLIP * (B.hx - BLADE_AX.atk[B.pose]) * A6.s, y: (B.hy - A6.fy) * A6.s };
  return { x: 60, y: -PH * .58 };
}
function bladeHandWorld() { const h = bladeHandLocal(); return { x: P.x + P.f * h.x, y: P.y + h.y } }

// 自动瞄准：朝面向方向最近的敌人身体中部；没有目标就略微朝上
function bladeAim() {
  const h = bladeHandWorld(); let best = null, bd = 1e9;
  for (const e of E) {
    const dx = (e.x - h.x) * P.f;
    if (dx > -30 && dx < 950 && dx < bd) { bd = dx; best = e; }
  }
  if (!best) return -.12;
  return cl(Math.atan2(best.y - best.h * .55 - h.y, Math.max(80, bd)), -.55, .55);
}
function bladeTipWorld(ang) {
  const h = bladeHandWorld(), d = BLADE_SWORD.len * (1 - BLADE_SWORD.gripR);
  return { x: h.x + P.f * Math.cos(ang) * d, y: h.y + Math.sin(ang) * d };
}

function fireBlade() {
  const ang = bladeAim(), m = bladeTipWorld(ang), Bo = BLADE_BOLT;
  BLB.push({ x: m.x, y: m.y, dx: P.f * Math.cos(ang), dy: Math.sin(ang), t: Bo.t, d: Bo.t, tk: 0, seed: Math.random() * 10 | 0 });
  FX.push({ type: 'boom', x: m.x, y: m.y, t: .2, d: .2, r: 50, c: '#7fd0ff' });
  shake = Math.max(shake, 5);
  DT.push({ x: P.x, y: P.y - 200, s: 'THUNDER', t: .8, c: '#7fd0ff' });
}

// 闪电：在 tk 对应的时间点对束内所有敌人各结算一次（贯穿）
function updBladeBolts(dt) {
  const Bo = BLADE_BOLT;
  for (const b of BLB) {
    b.t -= dt;
    const age = b.d - b.t;
    while (b.tk < Bo.ticks.length && age >= Bo.ticks[b.tk]) {
      const mul = Bo.mul[b.tk++];
      for (const e of E) {
        if (e.dead) continue;
        const cx = e.x - b.x, cy = (e.y - e.h * .5) - b.y;
        const along = cx * b.dx + cy * b.dy, perp = Math.abs(-cx * b.dy + cy * b.dx);
        if (along > -60 && along < Bo.L + 40 && perp < Bo.w + e.w * .3) {
          hurt(e, P.atk * mul);
          FX.push({ type: 'boom', x: e.x, y: e.y - e.h * .5, t: .2, d: .2, r: 44, c: '#8fdcff' });
        }
      }
    }
  }
  BLB = BLB.filter(b => b.t > 0);
}

function drawBladeBolts() {
  const Bo = BLADE_BOLT;
  for (const b of BLB) {
    const p = 1 - b.t / b.d, al = cl(p / .08, 0, 1) * cl((1 - p) / .45, 0, 1), a = Math.atan2(b.dy, b.dx);
    ctx.save();
    ctx.translate(b.x - cam, b.y);
    // 剑尖光球
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const r = 46 * (1 - p * .5) + 8, gr = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    gr.addColorStop(0, 'rgba(235,250,255,' + (al).toFixed(3) + ')'); gr.addColorStop(.5, 'rgba(90,180,255,' + (al * .6).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(20,80,220,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.restore();

    if (LTN6) {
      const fl = ((((T * 28) | 0) + b.seed) % 2) ? 1 : -1, jit = Math.sin(T * 90 + b.seed) * .025, k = Bo.L / LTN6.dg * (1 + Math.sin(T * 60 + b.seed) * .03);
      ctx.rotate(a + jit); ctx.scale(1, fl * Bo.sy); ctx.rotate(-LTN6.phi); ctx.scale(k, k);
      ctx.globalAlpha = al; ctx.shadowColor = '#6cf'; ctx.shadowBlur = 18;
      ctx.drawImage(LTN6, 0, 0);
      ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = al * .55;
      ctx.drawImage(LTN6, 0, 0);
    } else {   // 素材缺失时的程序化折线闪电
      ctx.rotate(a); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(160,220,255,' + al.toFixed(3) + ')'; ctx.lineWidth = 4; ctx.shadowColor = '#6cf'; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.moveTo(0, 0);
      for (let s = 1; s <= 12; s++) ctx.lineTo(s * Bo.L / 12, (Math.random() - .5) * 60 * (s < 12 ? 1 : 0));
      ctx.stroke();
    }
    ctx.restore();
  }
}

// 持剑姿势：剑从举起 → 指向目标，剑尖聚电，随后放出闪电
function drawBladeL(x, y, f) {
  const A6 = SH6.atk, B = BLADE_L, S6 = BLADE_SWORD;
  if (!okS(A6)) { dr(SH.atk, 12, x, y, f, 1.0); return; }
  drB(A6, BLADE_AX.atk, B.pose, x, y, f * BLADE_IDLE_FLIP);
  if (!SWD6) return;

  const h = bladeHandLocal(), ang = bladeAim(), k0 = cl(P.t / B.fireT, 0, 1), e = k0 * k0 * (3 - 2 * k0);
  const sa = ang;                                          // 剑保持水平，直接指向目标方向（与闪电平行）
  const fired = P.t >= B.fireT, rec = (P.t >= B.fireT && P.t < B.fireT + .1) ? 4 : 0;
  const k = S6.len / SWD6.axis;

  ctx.save();
  ctx.translate(x + f * h.x, y + h.y); ctx.scale(f, 1); ctx.translate(-rec, 0);
  ctx.rotate(sa);
  // 剑尖电光（在“朝右”的局部坐标里画）
  const td = S6.len * (1 - S6.gripR);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  const n = fired ? 7 : 2 + (e * 5 | 0);
  for (let s = 0; s < n; s++) {
    ctx.strokeStyle = 'rgba(' + (s & 1 ? '200,235,255' : '90,180,255') + ',' + (.5 + Math.random() * .4).toFixed(2) + ')'; ctx.lineWidth = 1.5 + Math.random() * 1.5;
    ctx.beginPath(); let px = td, py = 0; ctx.moveTo(px, py);
    for (let j = 0; j < 4; j++) { px += (Math.random() - .3) * 16; py += (Math.random() - .5) * 20; ctx.lineTo(px, py) }
    ctx.stroke();
  }
  if (fired) {
    const fk = 1 - (P.t - B.fireT) / .25;
    if (fk > 0) {
      const g = ctx.createRadialGradient(td, 0, 0, td, 0, 40 * fk + 10);
      g.addColorStop(0, 'rgba(235,250,255,1)'); g.addColorStop(.5, 'rgba(90,180,255,.7)'); g.addColorStop(1, 'rgba(20,80,220,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(td, 0, 40 * fk + 10, 0, 7); ctx.fill();
    }
  }
  ctx.restore();
  // 剑本体：把剑图旋转到“剑尖朝 +x”，握柄点对准手
  ctx.rotate(-S6.phi); ctx.scale(k, k * (S6.vf || 1));   // vf=-1：沿剑轴上下翻转
  ctx.shadowColor = '#6cf'; ctx.shadowBlur = fired ? 22 : 8;
  ctx.drawImage(SWD6, -SWD6.gx, -SWD6.gy);
  ctx.restore();
}

// ---------- 大招 K：LIGHTNING SONIC · 雷电音速踢 ----------
// 召牌蓄力 → 雷光缠身跳起 → 顶点锥体定身停顿 → 45° 砸落 → 黑桃纹章爆发
function updBladeFV(dt) {
  const Z = BLADE_FV, t = P.t;
  P.inv = 1;
  if (!P.hit['landed']) {
    if (t < Z.charge) {
      P.vx = 0; P.vy = 0;
      if (t >= .3 && !P.hit['card']) {
        P.hit['card'] = 1;
        DT.push({ x: P.x, y: P.y - 200, s: 'THUNDER · KICK · MACH', t: 1.2, c: '#7fd0ff' });
      }
    } else if (t < Z.rise) {
      P.vx = P.f * 70; P.vy = -720; P.y += P.vy * dt;
      if (!P.hit['jump']) { P.hit['jump'] = 1; shake = 8; }
    } else if (t < Z.dive) {
      P.vx = 0; P.vy = 0;                      // 锥体出现 → 悬停
      if (t >= Z.hold && !P.hit['lock']) {
        P.hit['lock'] = 1; shake = 10;
        DT.push({ x: P.x, y: P.y - 200, s: 'LIGHTNING SONIC', t: .9, c: '#7fd0ff' });
      }
    } else {
      P.vx = P.f * 1250; P.vy = 1250; P.y += P.vy * dt;
      const a = P.x - P.f * 60, b = P.x + P.f * 160;
      area(Math.min(a, b), Math.max(a, b), P.atk * 1.6, P.hit);
      if (P.y >= GY) {
        P.y = GY; P.vy = 0; P.hit['landed'] = 1; P.landT = t; shake = 30;
        const tx = P.x + P.f * Z.tip;
        area(tx - 380, tx + 380, P.atk * 5.6);
        FX.push({ type: 'boom', x: tx, y: GY - 30, t: .7, d: .7, r: 300, c: '#4fc3ff' });
        FX.push({ type: 'boom', x: tx, y: GY - 30, t: .5, d: .5, r: 190, c: '#ffd166' });
        DT.push({ x: P.x, y: P.y - 190, s: 'LIGHTNING SONIC · 雷电音速踢！', t: 1.8, c: '#4fc3ff' });
      }
    }
  } else {
    P.y = GY; P.vy = 0;
    P.vx = P.f * Math.max(0, 200 * (1 - (t - P.landT) / .5));
    if (t > P.landT + 1.1) { P.st = 'idle'; P.inv = .4; P.vx = 0; }
  }
  if (t > 4) { P.st = (P.y < GY) ? 'air' : 'idle'; P.inv = .4; }   // 保险：任何意外都不会卡在大招里
}

function drawBladeFV(x, y, f) {
  const V = SH6.fv;
  if (!okS(V)) { dr(SH.atk, 12, x, y, f, 1.0); return; }
  const Z = BLADE_FV, t = P.t, AX = BLADE_AX.fv;
  let i, cone = false;
  if (t < .14) i = 0;                  // 持剑站立
  else if (t < .30) i = 2;             // 单膝跪地、剑插入地面
  else if (t < .46) i = 3;             // 拔剑 / 牌浮起
  else if (t < .62) i = 4;             // 张开双臂，牌环绕
  else if (t < .74) i = 5;             // 雷光汇聚
  else if (t < Z.charge) i = 6;        // 雷电缠身
  else if (t < Z.rise) i = 7;          // 带电起跳
  else if (t < Z.hold) i = 8;          // 抬腿
  else if (!P.hit['landed']) { cone = true; i = ((t * (t < Z.dive ? 10 : 26)) | 0) % 2 ? 10 : 9; }   // 雷电锥体（定身 → 砸落）
  else i = -1;

  if (!P.hit['landed'] && t >= Z.dive) { cone = false; i = 11 }       // 45° 砸落
  if (cone) { ctx.shadowColor = '#4fc3ff'; ctx.shadowBlur = 22 + Math.sin(T * 20) * 8; }

  if (i >= 0) { drB(V, AX, i, x, y, f); return; }

  // 落地阶段：冲击 → 蹲伏 → 起身，黑桃纹章在落点炸开（画在骑士身后）
  const d = t - P.landT;
  if (d < .85 && LOGO6) {
    const p = d / .85, tx = x + f * Z.tip, sc = V.s * (1.15 + p * .5);
    ctx.save(); ctx.globalAlpha = cl(p / .1, 0, 1) * cl((1 - p) / .55, 0, 1) * .95;
    ctx.translate(tx, y - 8); ctx.scale(sc, sc);
    ctx.drawImage(LOGO6, -LOGO6.width / 2, -LOGO6.height * .78); ctx.restore();
  }
  drB(V, AX, d < .25 ? 12 : d < .85 ? 14 : 15, x, y, f);
}

// 落点预警：锥体定身期间，地面显示蓝色锁定圈
function drawBladeMark() {
  if (!P.bl || P.st !== 'fv' || P.t < BLADE_FV.rise || P.hit['landed']) return;
  const tx = P.x + P.f * ((GY - P.y) + BLADE_FV.tip) - cam, p = 1 + Math.sin(T * 18) * .08;
  ctx.save();
  ctx.strokeStyle = '#4fc3ff'; ctx.shadowColor = '#4fc3ff'; ctx.shadowBlur = 16; ctx.lineWidth = 3; ctx.globalAlpha = .85;
  ctx.beginPath(); ctx.ellipse(tx, GY + 4, 110 * p, 20 * p, 0, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(tx, GY + 4, 60 * p, 11 * p, 0, 0, 7); ctx.stroke();
  ctx.globalAlpha = .4; ctx.setLineDash([6, 8]);
  ctx.beginPath(); ctx.moveTo(tx, GY); ctx.lineTo(tx, GY - 260); ctx.stroke();
  ctx.restore();
}
