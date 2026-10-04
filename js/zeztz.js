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

// ---------- 各动作表的缩放 ----------
// 这几张表的原画比例并不一致（Run 的角色在格子里只占 ~91%，Jump 站立帧高 ~83% 且身体偏瘦长，FinalVent 带光环）。
// 以前四张表共用 ZEZTZ_SCALE = PH/484：跑步被缩小到 138px，跳跃被放大到 ~207~229px。
// 现在每张表单独算：缩放 = 目标身高 / (角色占格高的比例 × 格高)，换分辨率也不会错。
//   h = 目标身高(px)；frac = 站立/跑动帧里角色占格子高度的比例（实测）；clean = 切格碎片清理阈值（见 zCleanEdges）
//   clean 用 0.4：FinalVent 表里相邻帧的旋涡 / 拳头整块漏进格子，面积能到主体的 3~4 成，0.15 清不掉；
//   实测 0.4 只会删漏进来的块，不伤角色和特效。清理太狠（特效被吃掉）就调小，漏进来的碎块清不干净就调大。
const ZEZTZ_BODY = PH * 0.965;      // 站立身高 ≈ 193px，与 NormalAttack 表（ZEZTZ_SCALE）一致；变身表最终站姿也用它，变身结束不会“跳一下”
const ZEZTZ_FIT = {
  run:  { h: 190, frac: .913, clean: .4 },
  jump: { h: 190, frac: .834, clean: .4 },
  atk:  { h: 0, clean: .4 },        // h = 0 → 沿用 ZEZTZ_SCALE（这张表本来就是对的）
  fv:   { h: 190, frac: .997, clean: .4 }
};
const ZEZTZ_TRANS_CLEAN = .4;       // 变身表的碎片清理阈值

// 切格后的碎片清理：整格均分切出来的帧，经常带着相邻帧漏进来的碎片（贴着格子左 / 右 / 顶边的小块，
// 例如变身表里飘在头顶两侧的绿色小块、FinalVent 帧顶的细线）。
// 规则：与角色主体不相连、贴着左 / 右 / 顶边、面积 < 主体 frac 的块，整块删除。
// 脚底边不处理（地面冲击波 / 碎石要保留）；不贴边的零散光球（蓄力帧的红色光球）也保留。
function zCleanEdges(cv, frac) {
  const w = cv.width, h = cv.height, g = cv.getContext('2d');
  let id; try { id = g.getImageData(0, 0, w, h); } catch (e) { return cv; }
  const p = id.data, N = w * h, lab = new Int32Array(N), q = new Int32Array(N), comps = [];
  for (let s0 = 0; s0 < N; s0++) {
    if (lab[s0] || p[s0 * 4 + 3] <= 25) continue;
    const cid = comps.length + 1; let head = 0, tail = 0, n = 0, edge = false;
    q[tail++] = s0; lab[s0] = cid;
    while (head < tail) {
      const cur = q[head++], cx = cur % w, cy = (cur / w) | 0; n++;
      if (cx <= 1 || cx >= w - 2 || cy <= 1) edge = true;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = cx + dx, Y = cy + dy;
        if (X < 0 || X >= w || Y < 0 || Y >= h) continue;
        const k = Y * w + X;
        if (!lab[k] && p[k * 4 + 3] > 25) { lab[k] = cid; q[tail++] = k; }
      }
    }
    comps.push({ n, edge });
  }
  if (comps.length < 2) return cv;
  let max = 0; for (const c of comps) if (c.n > max) max = c.n;
  const kill = comps.map(c => c.edge && c.n < max * frac);
  if (!kill.some(Boolean)) return cv;
  for (let i = 0; i < N; i++) if (lab[i] && kill[lab[i] - 1]) p[i * 4 + 3] = 0;
  g.putImageData(id, 0, 0);
  return cv;
}

// 切格（先清碎片再量角色高度，所以参考帧的包围盒不会被碎片撑大）
// body > 0：缩放 = body / 参考帧身高；否则 s = 1（调用方自己设）
function zSlice(im, cNum, rNum, ref, body, clean) {
  const cw = im.width / cNum | 0, ch = im.height / rNum | 0, fr = [];
  for (let r = 0; r < rNum; r++) for (let c = 0; c < cNum; c++) fr.push(zCleanEdges(crop(im, c * cw, r * ch, cw, ch), clean));
  const b = bb(fr[ref] || fr[0]);
  return { f: fr, cw, ch, fy: b.y1, s: body ? body / (b.y1 - b.y0) : 1 };
}

// ===== 变身表“按连通关系”分帧 =====
// 变身表里的帧并不规整：脚底 / 地面火花 / 头顶光球会越过均分格线，硬切必然出现断面或缺脚。
// zOwnerMap：给整张表每个像素分配“属于哪一帧”（-1 = 透明），纯函数，不依赖画布。
// 思路：不再按固定网格硬切，而是看像素真正连着哪个角色 / 光球
function zOwnerMap(d, W, H, cNum, rNum) {
  const N = W * H, nc = cNum * rNum, cw = W / cNum, ch = H / rNum;
  const cellOf = (x, y) => Math.min(rNum - 1, (y / ch) | 0) * cNum + Math.min(cNum - 1, (x / cw) | 0);
  const STRONG = 128, WEAK = 25, R = 2, BODY_MIN = 800, MAXD = 40;
  const own = new Int16Array(N).fill(-1), lab = new Uint8Array(N), q = new Int32Array(N);

  // 1) 强像素腐蚀掉细线（地面火花 / 光环细丝会把相邻帧“粘”在一起），剩下的实心块当作种子
  const core = new Uint8Array(N);
  for (let y = R; y < H - R; y++) for (let x = R; x < W - R; x++) {
    let ok = 1;
    for (let dy = -R; dy <= R && ok; dy++) for (let dx = -R; dx <= R; dx++) if (d[((y + dy) * W + x + dx) * 4 + 3] < STRONG) { ok = 0; break; }
    core[y * W + x] = ok;
  }
  for (let s0 = 0; s0 < N; s0++) {
    if (!core[s0] || lab[s0]) continue;
    let head = 0, tail = 0, sx = 0, sy = 0; const cnt = new Array(nc).fill(0);
    q[tail++] = s0; lab[s0] = 1;
    while (head < tail) {
      const cur = q[head++], cx = cur % W, cy = (cur / W) | 0; sx += cx; sy += cy; cnt[cellOf(cx, cy)]++;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = cx + dx, Y = cy + dy; if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
        const k = Y * W + X; if (core[k] && !lab[k]) { lab[k] = 1; q[tail++] = k; }
      }
    }
    if (tail < 6) continue;
    let best = 0; for (let c = 1; c < nc; c++) if (cnt[c] > cnt[best]) best = c;
    const body = tail >= BODY_MIN && cnt[best] >= tail * 0.9;           // 角色主体：按像素占比最多的格子
    const frag = cellOf(Math.round(sx / tail), Math.round(sy / tail));  // 光球 / 碎块：按质心所在格子
    for (let h = 0; h < tail; h++) { const p = q[h]; own[p] = body ? best : (tail >= BODY_MIN ? cellOf(p % W, (p / W) | 0) : frag); }
  }

  // 2) 从所有种子同时向外扩散，沿着非透明像素归给最近的种子（光晕 / 细线 / 描边都这样认领）
  const dist = new Uint8Array(N);
  let head = 0, tail = 0;
  for (let i = 0; i < N; i++) if (own[i] >= 0) q[tail++] = i;
  while (head < tail) {
    const cur = q[head++], cx = cur % W, cy = (cur / W) | 0, o = own[cur];
    if (dist[cur] >= MAXD) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = cx + dx, Y = cy + dy; if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
      const k = Y * W + X; if (own[k] < 0 && d[k * 4 + 3] > WEAK) { own[k] = o; dist[k] = dist[cur] + 1; q[tail++] = k; }
    }
  }

  // 3) 仍没人认领的零星像素：按所在格子兜底
  for (let i = 0; i < N; i++) if (own[i] < 0 && d[i * 4 + 3] > WEAK) own[i] = cellOf(i % W, (i / W) | 0);
  return own;
}

// 按 zOwnerMap 的结果切帧：每帧画布 = 名义格子四周各扩 P 像素，只拷贝“属于这一帧”的像素。
// 画布原点与名义格子保持固定偏移 → 各帧共用同一条地面基线（fy）和同一坐标系，和旧版 zSlice 的用法完全兼容。
function zSliceOwn(im, cNum, rNum, ref, body) {
  const W = im.width, H = im.height, g = im.getContext('2d');
  const id = g.getImageData(0, 0, W, H), d = id.data;     // 跨域污染的画布会在这里抛错 → 外层回退到旧切法
  const own = zOwnerMap(d, W, H, cNum, rNum);
  const fw0 = W / cNum, fh0 = H / rNum, cwI = Math.round(fw0), chI = Math.round(fh0);
  const ox = c => Math.round(c * fw0), oy = r => Math.round(r * fh0);
  // 先量一遍每帧越过名义格子的最大像素数，决定统一的外扩边距 P
  let P = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = own[y * W + x]; if (o < 0) continue;
    const c = o % cNum, r = (o / cNum) | 0, x0 = ox(c), y0 = oy(r);
    P = Math.max(P, x0 - x, x - (x0 + cwI - 1), y0 - y, y - (y0 + chI - 1));
  }
  P = Math.max(16, P + 4);
  const fw = cwI + P * 2, fh = chI + P * 2, n = cNum * rNum, bufs = [];
  for (let i = 0; i < n; i++) bufs.push(new Uint8ClampedArray(fw * fh * 4));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x, o = own[k]; if (o < 0) continue;
    const c = o % cNum, r = (o / cNum) | 0;
    const dx = x - ox(c) + P, dy = y - oy(r) + P;
    if (dx < 0 || dy < 0 || dx >= fw || dy >= fh) continue;
    const s = k * 4, t = (dy * fw + dx) * 4, b = bufs[o];
    b[t] = d[s]; b[t + 1] = d[s + 1]; b[t + 2] = d[s + 2]; b[t + 3] = d[s + 3];
  }
  const fr = bufs.map(b => {
    const cv = document.createElement('canvas'); cv.width = fw; cv.height = fh;
    cv.getContext('2d').putImageData(new ImageData(b, fw, fh), 0, 0);
    return cv;
  });
  const bx = bb(fr[ref] || fr[0]);
  return { f: fr, cw: fw, ch: fh, fy: bx.y1, s: body ? body / (bx.y1 - bx.y0) : 1, exact: true, pad: P };
}

// ===== FinalVent 表分帧：按“真实行列间隙”切（共 23 帧：每行 6 / 6 / 5 / 6）=====
// 旧版把这张表当成 6×4=24 格均分，但原画第 3 行只有 5 帧，而且大旋涡会越过格线：
//   ① 旋涡被格线劈开 → 不完美裁剪；② 帧号对不上，还会引用到根本不存在的第 24 帧（直接消失）。
// 现在：
//   行界 = 名义行界附近“占用像素最少”的一行；
//   列   = 行内按“有像素的连续区间”分帧，火花 / 碎石等小碎块并入最近的大块，
//          相邻两帧在空隙正中间切开 → 不会切到特效，也不会丢像素；
//   对齐 = x 取“脚底往上 110px 内的深色 / 青色像素”的中心（旋涡把上半身遮住时也稳定），
//          y 取该行所有帧的脚底中位数 → 播放时脚不会上下 / 左右抖。
//   缩放 = 以最后一帧（站姿）的身高 = bodyH 为准，与其它动作表的站立身高一致。
// 各行帧数换了新素材就改这里：
const ZEZTZ_FV_ROWS = [6, 6, 5, 6];
function zSliceFV(im, rowCounts, bodyH) {
  const W = im.width, H = im.height, nR = rowCounts.length, T = 40;
  const d = im.getContext('2d').getImageData(0, 0, W, H).data;   // 画布被污染会在这里抛错 → 外层回退
  // 1) 行界
  const occ = new Uint32Array(H);
  for (let y = 0; y < H; y++) { let n = 0; for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > T) n++; occ[y] = n; }
  const cuts = [0];
  for (let k = 1; k < nR; k++) {
    const c = Math.round(H * k / nR), r = Math.round(H * .1); let best = c, bv = 1e9;
    for (let y = c - r; y <= c + r; y++) if (occ[y] < bv) { bv = occ[y]; best = y; }
    cuts.push(best);
  }
  cuts.push(H);
  // 2) 列：行内连续区间 → 并 / 拆到恰好 n 帧
  const fr = [];
  for (let r = 0; r < nR; r++) {
    const y0 = cuts[r], y1 = cuts[r + 1], n = rowCounts[r], cnt = new Uint32Array(W);
    for (let x = 0; x < W; x++) { let s = 0; for (let y = y0; y < y1; y++) if (d[(y * W + x) * 4 + 3] > T) s++; cnt[x] = s >= 2 ? s : 0; }
    const runs = []; let st = -1;
    for (let x = 0; x <= W; x++) {
      const on = x < W && cnt[x] > 0;
      if (on && st < 0) st = x;
      if (!on && st >= 0) { let m = 0; for (let k = st; k < x; k++) m += cnt[k]; runs.push({ a: st, b: x - 1, m }); st = -1; }
    }
    if (!runs.length) throw new Error('FinalVent: 第 ' + r + ' 行没有像素');
    while (runs.length > n) {            // 质量最小的碎块并入间隙更小的邻居
      let k = 0; for (let i = 1; i < runs.length; i++) if (runs[i].m < runs[k].m) k = i;
      const gl = k > 0 ? runs[k].a - runs[k - 1].b : 1e9, gr = k < runs.length - 1 ? runs[k + 1].a - runs[k].b : 1e9, j = gl <= gr ? k - 1 : k;
      runs.splice(j, 2, { a: runs[j].a, b: runs[j + 1].b, m: runs[j].m + runs[j + 1].m });
    }
    while (runs.length < n) {            // 帧粘在一起时：在最宽的一块中段、像素最少的列切开
      let k = 0; for (let i = 1; i < runs.length; i++) if (runs[i].b - runs[i].a > runs[k].b - runs[k].a) k = i;
      const q = runs[k], w = q.b - q.a, lo = q.a + (w * .3 | 0), hi = q.b - (w * .3 | 0);
      let mx = lo, mv = 1e9; for (let x = lo; x <= hi; x++) if (cnt[x] < mv) { mv = cnt[x]; mx = x; }
      runs.splice(k, 1, { a: q.a, b: mx - 1, m: q.m / 2 }, { a: mx + 1, b: q.b, m: q.m / 2 });
    }
    runs.forEach((q, i) => fr.push({
      row: r, y0, y1,
      x0: i ? (runs[i - 1].b + q.a + 1) >> 1 : 0,
      x1: i < n - 1 ? (q.b + runs[i + 1].a + 1) >> 1 : W,
      cx: (q.a + q.b) / 2
    }));
  }
  // 3) 每帧的头顶 / 脚底（alpha≥200 的 0.5% ~ 99.5% 分位，免得零星火花撑大）
  for (const q of fr) {
    const hist = new Uint32Array(q.y1 - q.y0); let tot = 0;
    for (let y = q.y0; y < q.y1; y++) { let s = 0; for (let x = q.x0; x < q.x1; x++) if (d[(y * W + x) * 4 + 3] >= 200) s++; hist[y - q.y0] = s; tot += s; }
    let acc = 0, lo = 0, hi = hist.length - 1, gotLo = false;
    for (let i = 0; i < hist.length; i++) { acc += hist[i]; if (!gotLo && acc >= tot * .005) { lo = i; gotLo = true; } if (acc >= tot * .995) { hi = i; break; } }
    q.top = q.y0 + lo; q.bot = q.y0 + hi;
  }
  const base = [];
  for (let r = 0; r < nR; r++) { const v = fr.filter(q => q.row === r).map(q => q.bot).sort((a, b) => a - b); base.push(v[v.length >> 1] + 1); }
  // 4) x 锚点：脚底往上 110px 内的深色战斗服 / 青色护甲
  const isBody = (r, g, b) => { const m = Math.max(r, g, b); return (m < 85 && Math.abs(r - b) < 40) || (r < 70 && g > 110 && b > 110 && Math.abs(g - b) < 45); };
  for (const q of fr) {
    const by = base[q.row]; let n = 0, sx = 0;
    for (let y = Math.max(q.y0, by - 110); y <= Math.min(q.y1 - 1, by); y++) for (let x = q.x0; x < q.x1; x++) {
      const i = (y * W + x) * 4; if (d[i + 3] >= 200 && isBody(d[i], d[i + 1], d[i + 2])) { n++; sx += x; }
    }
    q.ax = n > 200 ? sx / n : q.cx;
  }
  // 5) 出帧
  const f = [], ax = [], fyA = []; let cw = 0, ch = 0;
  for (const q of fr) {
    const w = q.x1 - q.x0, h = q.y1 - q.y0, cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(im, q.x0, q.y0, w, h, 0, 0, w, h);
    f.push(cv); ax.push(q.ax - q.x0); fyA.push(base[q.row] - q.y0); cw = Math.max(cw, w); ch = Math.max(ch, h);
  }
  const ref = fr[fr.length - 1];
  return { f, ax, fyA, cw, ch, fy: fyA[fyA.length - 1], s: bodyH / Math.max(40, ref.bot - ref.top), exact: true, n: f.length };
}

// ===== 能量波贴图整理 =====
// 原图两个问题：① 右侧火焰拖尾被图片边缘直接切断（发射时尾巴有一道直边）；② 抠图残留的浅绿色半透明边，
// 在 'lighter' 叠加下会发出一圈绿雾。这里：去绿边 → 按可见像素裁边 → 尾部 38% 渐隐。
function zWaveFinish(src) {
  const w = src.width, h = src.height, g = src.getContext('2d');
  let id; try { id = g.getImageData(0, 0, w, h); } catch (e) { return trim(src); }
  const d = id.data; let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, a = d[i + 3]; if (!a) continue;
    if (a < 235 && d[i + 1] > d[i] * .85) { d[i + 3] = 0; continue; }
    if (a > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return trim(src);
  g.putImageData(id, 0, 0);
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, out = document.createElement('canvas');
  out.width = bw; out.height = bh;
  const o = out.getContext('2d');
  o.drawImage(src, x0, y0, bw, bh, 0, 0, bw, bh);
  o.globalCompositeOperation = 'destination-in';
  const gr = o.createLinearGradient(0, 0, bw, 0);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(.62, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  o.fillStyle = gr; o.fillRect(0, 0, bw, bh);
  return out;
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
    if (trIm) {
      const tc = toTransparentCanvas(trIm);
      // ★ 优先用“按连通关系分帧”（脚底 / 光球 / 火花越过格线也不会被切断）；取像素失败时才回退到旧的均分切法
      try { SHZ.trans = zSliceOwn(tc, 5, 4, 19, ZEZTZ_BODY); }
      catch (e) { console.warn('[Zeztz] 智能分帧失败，回退均分切格：', e); SHZ.trans = zSlice(tc, 5, 4, 19, ZEZTZ_BODY, ZEZTZ_TRANS_CLEAN); }
    }
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
      const tc = toTransparentCanvas(im);
      let done = false;
      if (key === 'fv') {   // ★ 大招表：按真实行列间隙分帧（23 帧），失败才回退到均分切格
        try { Object.assign(SHZ.fv, zSliceFV(tc, ZEZTZ_FV_ROWS, ZEZTZ_BODY)); done = true; }
        catch (e) { console.warn('[Zeztz] FinalVent 智能分帧失败，回退均分切格：', e); }
      }
      if (!done) {
        const fit = ZEZTZ_FIT[key], sl = zSlice(tc, c, r, ref, 0, fit.clean);
        Object.assign(SHZ[key], sl);
        SHZ[key].s = fit.h ? fit.h / (fit.frac * sl.ch) : ZEZTZ_SCALE;
      }
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
    if (wIm) WAVE_Z = zWaveFinish(toTransparentCanvas(wIm));
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
// 音频校对：对 Kamen_Rider_Zeztz_Henshin.mp3（14.45s）重新做了分频段起音检测 + 节拍相位拟合，结论如下：
//   0.09 开场低频重击 · 0.88 第二记低频 · 1.52(1.63) / 1.85 / 2.47 三记中段鼓点（旧表的 2.00 / 2.40 偏了 0.15 / 0.07s）
//   2.68~3.40 全曲最安静（整体能量下探）· 3.00 静默里的一记低频 · 3.47 安静后全曲第一记强低频（= ready）
//   3.5~7.9 稳定脉冲，周期 0.99s、相位 0.47s → 4.43 / 5.42 / 6.41 / 7.40（旧表按 x.50 排，整体晚了 0.07~0.10s）
//   7.6 起高频上涌（升调）· 8~11.7 无明显鼓点，靠能量爬升（脉冲不稳，不拿来踩点）
//   11.75 + 11.87 双重爆发（全曲最强起音）· 12.0~12.35 静默 · 12.42 / 12.60 / 12.83 / 12.98 四记收尾重音 → 14.4 余韵
// 哪一拍还对不上，只改这里的数字即可。
const ZEZTZ_TL = {
  impact1: 0.09,
  beats1: [0.88, 1.52, 1.85, 2.47],        // 第一段鼓点：Malaya 摆出架势
  gap1: [2.68, 3.40],                      // 静默：画面压暗（3.00 有一记低频，当作心跳）
  heart: 3.00,
  ready: 3.47,                             // 安静之后第一记强低频：腰带亮、红色能量开始缠身
  beats2: [4.43, 5.42, 6.41, 7.40],        // 第二段脉冲：每拍一圈更大的地面冲击环
  swell: 7.65,                             // 高频上涌（红光闪烁）
  henshin: 10.00,                          // HENSHIN!（能量二次推高；该点没有明显起音，凭听感，不准就改这里）
  burst: 11.75,                            // 爆发：Malaya 装甲炸开，Zeztz 现身
  burst2: 11.87,                           // 双重爆发的第二下
  gap2: [12.00, 12.35],                    // 爆发后的静默：画面短暂压暗，Zeztz 蓄力
  echoes: [12.42, 12.60, 12.83, 12.98],    // 收尾四记重音
  calm: 12.98                              // 余韵
};

// 变身表（5列×4行=20帧）：
//   0~1 Malaya 站立 · 2~6 摆架势/绿环/红色光球 · 7~12 红色能量逐渐缠满 Malaya（11/12 为最红）
//   13 Zeztz 现身 · 14/18 蓄力蹲姿(红色光球) · 15 战斗站姿 · 16 跃起 · 17 红光 · 19 最终站姿
// [时间, 帧号（数组 = 在这几帧之间闪烁）, 是否硬切]
const ZEZTZ_KEYS = [
  [0.00, 0, 0],
  [0.45, 1, 0],
  [0.88, 2, 1],
  [1.52, 3, 1],
  [1.85, 4, 1],
  [2.47, 5, 1],
  [3.00, 6, 0],
  [3.47, 7, 1],
  [4.43, 8, 1],
  [5.42, 9, 1],
  [6.41, 10, 1],
  [7.40, 11, 1],
  [7.65, [11, 12], 0],        // 红光闪烁直到爆发
  [11.75, 13, 1],             // ★ Zeztz 现身（硬切）
  [12.00, 14, 1],             // 静默里蓄力（蹲姿）
  [12.42, 18, 1],
  [12.60, 17, 1],
  [12.83, 16, 1],             // 跃起
  [12.98, 19, 1],             // 落地 = 最终站姿（与最后一记重音同步）
  [13.40, 19, 0]
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

// 变身表预处理（只做一次，按 SHZ.trans 缓存）：
//   ① 格子是整格均分裁出来的，爆发 / 光环帧会被格边切出笔直的断面 → 左 / 右 / 顶边做 4% 羽化（脚底不动，免得脚被淡掉；最终站姿帧不处理）
//   ② 每帧角色在格子里的位置不一样，按格子中心对齐会前后晃 → 改成按“像素质量中位数”对齐（与龙骑 / 555 变身一致）
// 可调：ZEZTZ_CLIP = { 帧号: 比例 }，把某帧左侧这个比例的区域擦掉（相邻帧漏进来的大块碎片，参考 henshin.js 的 clipL）
const ZEZTZ_CLIP = {};
function zTransSheet() {
  const S = SHZ.trans;
  if (!S || !S.f) return S;
  if (S._zsrc === S.f && S._z) return S._z;
  const band = Math.max(4, Math.round(S.cw * .04)), last = S.f.length - 1, cx = [];
  const f = S.f.map((c, i) => {
    if (!c || !c.getContext) { cx.push(S.cw / 2); return c; }
    const w = c.width, h = c.height, k = document.createElement('canvas'); k.width = w; k.height = h;
    const g = k.getContext('2d'); g.drawImage(c, 0, 0);
    if (i !== last && !S.exact) {   // 智能分帧的画布四周留有空白，没有断面，不需要羽化
      g.globalCompositeOperation = 'destination-in';
      for (const [x0, y0, x1, y1] of [[0, 0, band, 0], [w, 0, w - band, 0], [0, 0, 0, band]]) {
        const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      }
      g.globalCompositeOperation = 'source-over';
    }
    if (ZEZTZ_CLIP[i]) g.clearRect(0, 0, Math.round(w * ZEZTZ_CLIP[i]), h);
    cx.push(typeof massCenterX === 'function' ? massCenterX(k) : w / 2);
    return k;
  });
  S._zsrc = S.f; S._z = { f, cx, s: S.s, fy: S.fy, cw: S.cw };
  return S._z;
}

// 画变身表的一帧：脚底对齐 y，角色质心对齐 x
function zDrawTrans(S, idx, x, y, f, alpha) {
  const Z = zTransSheet(), fr = Z && Z.f[idx];
  if (!fr || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.scale(f * ZEZTZ_TRANS_FLIP * Z.s, Z.s);
  ctx.drawImage(fr, -Z.cx[idx], -Z.fy);
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


// ---------- 屏幕级特效 + 字幕（坐标系与 henshin.js 的 hnScreen 一致：整屏 960×540，用 -80,-80,1120,700 铺满）----------
const ZEZTZ_SUBS_ON = true;      // false = 关闭字幕，退回原来的头顶飘字
const ZEZTZ_LETTERBOX = 30;      // 电影黑边高度（0 = 关闭）
const ZEZTZ_SUBS_Y = 0.33;      // 字幕中心的纵向位置（占屏高比例）。越大越靠下；Boss 血条占到约 0.27，想再下移就加大
const zzRand = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const zzSmooth = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// 字幕表：[开始, 结束, 中文, 英文小字, 颜色, 是否大标题]（单位：音频秒）
// ★ 这段音频里的人声 / 歌词我没法转写，下面是按“剧情节拍”写的演出字幕。
//   想换成真正的台词 / 歌词：直接改中文、英文两列，时间沿用即可（可以再加行，同一时刻后面的行优先）。
const ZEZTZ_SUBS = [
  [0.09, 0.86, '变身序列启动', 'SEQUENCE START',        '#00f2fe', 0],
  [0.88, 2.65, 'MALAYA · 起势', 'KAMEN RIDER MALAYA',    '#7dff9a', 0],
  [2.68, 3.44, '（……能量沉寂……）', '',                     '#9aa7b8', 0],
  [3.47, 7.62, 'COME ON! READY!', '红色能量开始缠身',      '#ffd84a', 0],
  [7.65, 9.98, 'POWER OVERLOAD…', '能量过载 · 装甲濒临极限', '#ff4757', 0],
  [10.00, 11.72, 'HENSHIN!', '变　身！',                    '#ffffff', 1],
  [11.75, 12.38, 'ZEZTZ · MECHA IMPACT!', '机甲冲击',      '#00f2fe', 1],
  [12.42, 14.30, 'KAMEN RIDER ZEZTZ', '假面骑士 Zeztz',     '#00f2fe', 1]
];

// 屏幕坐标绘制：重置变换到画布像素，回调拿到 (宽, 高, 缩放k, 世界矩阵)。
// 全屏元素（字幕 / 黑边 / 闪光 / 压暗）必须走这里：世界坐标会跟着镜头平移、缩放、震屏，还会被后绘制的 HUD 盖住。
function zzScreen(fn) {
  const m = ctx.getTransform ? ctx.getTransform() : null;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const W = ctx.canvas.width, H = ctx.canvas.height;
  fn(W, H, H / 540, m);
  ctx.restore();
}
const zzFill = (c, a) => zzScreen((W, H) => { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'rgba(' + c + ',' + a.toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); });

// 字幕放在画面中上部（y≈33%，在 Boss 血条下方）、水平居中且收窄（宽 44%）：
//   底部是技能栏 / 按键提示 / 小地图；左上是 HP / MP 血条面板（约占左侧 30%、顶部 20%）；右上是星级任务面板；
//   只有上方中间这块是空的。想再靠上 / 靠下，改下面 cy 的比例；想更窄 / 更宽，改 bw。
function zeztzSubs(s) {
  if (!ZEZTZ_SUBS_ON) return;
  let q = null;
  for (const r of ZEZTZ_SUBS) if (s >= r[0] && s < r[1]) q = r;
  if (!q) return;
  const [t0, t1, zh, en, col, big] = q;
  const a = cl(Math.min((s - t0) / 0.14, (t1 - s) / 0.2), 0, 1);
  zzScreen((W, H, k) => {
    const cx = W / 2, cy = H * (big ? ZEZTZ_SUBS_Y + 0.01 : ZEZTZ_SUBS_Y), h = (big ? 62 : 50) * k, bw = W * 0.44, rise = (1 - a) * 8 * k;
    ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalCompositeOperation = 'source-over';
    const gr = ctx.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.18, 'rgba(0,0,0,.66)');
    gr.addColorStop(.82, 'rgba(0,0,0,.66)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(cx - bw / 2, cy - h / 2 + rise, bw, h);
    ctx.fillStyle = col; ctx.globalAlpha = a * .9;
    ctx.fillRect(cx - bw * .36, cy - h / 2 + rise, bw * .72, 1.5 * k); ctx.fillRect(cx - bw * .36, cy + h / 2 + rise - 1.5 * k, bw * .72, 1.5 * k);
    ctx.globalAlpha = a;
    const fam = '"PingFang SC","Microsoft YaHei","Noto Sans SC","Noto Sans CJK SC","WenQuanYi Micro Hei",system-ui,sans-serif';
    const zy = en ? cy - (big ? 9 : 7) * k : cy;
    // 文字自动缩小以适应字幕条宽度（长标题不会伸进左上角血条 / 右上角面板）
    let fs = (big ? 30 : 23) * k;
    ctx.font = '800 ' + fs + 'px ' + fam;
    const tw = ctx.measureText(zh).width, maxW = bw * 0.82;
    if (tw > maxW) { fs *= maxW / tw; ctx.font = '800 ' + fs + 'px ' + fam; }
    ctx.lineJoin = 'round'; ctx.lineWidth = 5 * k; ctx.strokeStyle = 'rgba(0,0,0,.85)';
    ctx.shadowColor = col; ctx.shadowBlur = (big ? 16 : 8) * k;
    ctx.strokeText(zh, cx, zy + rise); ctx.fillStyle = '#fff'; ctx.fillText(zh, cx, zy + rise);
    if (en) {
      ctx.shadowBlur = 0; ctx.font = '700 ' + (big ? 14 : 12) * k + 'px ' + fam;
      ctx.fillStyle = col; ctx.fillText(en, cx, cy + (big ? 20 : 15) * k + rise);
    }
  });
}

function zeztzScreenFx(x, y, s, pass) {
  const L = ZEZTZ_TL, belt = y - 96, TAU = Math.PI * 2;
  ctx.save();
  if (pass === 0) {
    // ① 静默段压暗（两段静默：2.68~3.40 与 12.00~12.35）
    let dim = 0;
    for (const [a, b] of [L.gap1, L.gap2]) dim = Math.max(dim, zzSmooth(a, a + .15, s) * (1 - zzSmooth(b - .1, b, s)));
    if (dim > .01) zzFill('2,4,12', dim * .45);
    // 静默里的“心跳”：3.00 那一记低频，腰带轻轻亮一下（跟着角色，用世界坐标）
    const hb = s - L.heart;
    if (hb >= 0 && hb < .5) {
      const k = 1 - hb / .5, gr = ctx.createRadialGradient(x, belt, 0, x, belt, 90);
      gr.addColorStop(0, 'rgba(255,80,80,' + (.55 * k).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,80,80,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.fillRect(x - 100, belt - 100, 200, 200);
      ctx.globalCompositeOperation = 'source-over';
    }
    // ② 红色暗角：以角色为中心，ready → burst 逐渐收紧；7.65 之后脉动加快
    if (s >= L.ready && s < L.burst + .1) {
      const p = zzSmooth(L.ready, L.burst, s) * (1 - zzSmooth(L.burst, L.burst + .1, s));
      const pulse = .5 + .5 * Math.sin(s * (s < L.swell ? TAU * 1.01 : 11));
      const v = p * (.26 + .2 * pulse) * (s < L.swell ? .7 : 1);
      zzScreen((W, H, k, m) => {
        const px = m ? m.a * x + m.c * belt + m.e : W / 2, py = m ? m.b * x + m.d * belt + m.f : H / 2, sc = m ? m.a : k;
        const gr = ctx.createRadialGradient(px, py, 150 * sc, px, py, Math.max(640 * sc, W * .7));
        gr.addColorStop(0, 'rgba(160,10,25,0)'); gr.addColorStop(1, 'rgba(160,10,25,' + v.toFixed(3) + ')');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      });
    }
    // ③ 地面电弧（贴图里的绿色地面火花的延伸）：ready → burst 越来越密
    if (s >= L.ready && s < L.burst) {
      const g = zzSmooth(L.ready, L.swell, s), n = 2 + (g * 5 | 0), seed = (s * 16) | 0;
      ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1.6; ctx.shadowBlur = 8;
      for (let i = 0; i < n; i++) {
        const dir = zzRand(seed * 7 + i) < .5 ? -1 : 1, x0 = x + dir * (20 + zzRand(seed * 3 + i) * 40);
        const len = 90 + zzRand(seed * 5 + i) * 150 * (.5 + g);
        ctx.strokeStyle = zzRand(i + seed) < .75 ? 'rgba(120,255,140,.8)' : 'rgba(0,242,254,.8)'; ctx.shadowColor = ctx.strokeStyle;
        ctx.beginPath(); ctx.moveTo(x0, y + 2);
        for (let j = 1; j <= 7; j++) ctx.lineTo(x0 + dir * len * j / 7, y + 2 + (zzRand(seed * 13 + i * 7 + j) - .5) * 14 * (1 - j / 9));
        ctx.stroke();
      }
    }
  } else {
    // ④ 向腰带收拢的聚能线：swell → burst（HENSHIN 之后更密）
    if (s >= L.swell && s < L.burst) {
      const q = zzSmooth(L.swell, L.burst, s), n = 10 + (q * 36 | 0);
      ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1.2;
      for (let i = 0; i < n; i++) {
        const ang = zzRand(i) * TAU, ph = (s * (1.4 + q) + zzRand(i + 50)) % 1;
        const r0 = 420 * (1 - ph) + 40, r1 = r0 + 30 + q * 70;
        ctx.strokeStyle = (i % 2 ? 'rgba(255,71,87,' : 'rgba(0,242,254,') + (ph * (.15 + .5 * q)).toFixed(3) + ')';
        ctx.beginPath(); ctx.moveTo(x + Math.cos(ang) * r1, belt + Math.sin(ang) * r1 * .6);
        ctx.lineTo(x + Math.cos(ang) * r0, belt + Math.sin(ang) * r0 * .6); ctx.stroke();
      }
    }
    // ⑤ 爆发光柱（世界坐标，从角色头顶一直拉到画面最上方）
    const bk = s - L.burst;
    if (bk >= 0 && bk < .9) {
      const k = bk / .9, w = (1 - k) * 90 + 10, gr = ctx.createLinearGradient(x - w, 0, x + w, 0);
      gr.addColorStop(0, 'rgba(0,242,254,0)'); gr.addColorStop(.5, 'rgba(255,255,255,' + (.7 * (1 - k)).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(0,242,254,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.fillRect(x - w, y - 1400, w * 2, 1400 + 90);
    }
    // ⑥ 全屏闪光（每个节拍一下，爆发最强）
    ctx.globalCompositeOperation = 'source-over';
    const fl = [[L.impact1, .18, .35, '255,255,255'], [L.ready, .30, .30, '255,216,74'], [L.swell, .30, .28, '255,59,48'],
      [L.henshin, .55, .50, '255,255,255'], [L.burst, .55, .80, '255,255,255'], [L.burst2, .45, .45, '0,242,254']];
    L.beats1.forEach(t => fl.push([t, .14, .20, '0,242,254']));
    L.beats2.forEach((t, i) => fl.push([t, .22, .16 + i * .04, '255,59,48']));
    L.echoes.forEach(t => fl.push([t, .30, .30, '0,242,254']));
    let fa = 0, fc = '255,255,255';
    for (const [t, d, al, c] of fl) { const k = s - t; if (k >= 0 && k < d) { const v = (1 - k / d) * al; if (v > fa) { fa = v; fc = c; } } }
    if (fa > .01) zzFill(fc, fa);
    // ⑦ 电影黑边（屏幕坐标，只在顶部：底部是 HUD）+ 字幕
    if (ZEZTZ_LETTERBOX > 0) {
      const lb = zzSmooth(0, .5, s) * (1 - zzSmooth(zeztzTransDur() - .5, zeztzTransDur() - .05, s));
      if (lb > .01) zzScreen((W, H, k) => { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, ZEZTZ_LETTERBOX * k * lb); });
    }
    zeztzSubs(s);
  }
  ctx.restore();
}

function drawZeztzTransform(x, y, f) {
  const S_ = SHZ.trans;
  if (!okS(S_)) { dr(SH.atk, 12, x, y, f, 1.0); return; }
  const s = zeztzSyncT(P.t);
  const fr = zeztzFrameAt(s);

  zeztzScreenFx(x, y, s, 0);
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
  zeztzScreenFx(x, y, s, 1);
}

function updZeztzTrans(dt) {
  const L = ZEZTZ_TL, s = zeztzSyncT(P.t), h = P.hit;
  const fire = (id, t, fn) => { if (s >= t && !h[id]) { h[id] = 1; if (!(t < (P.sk || 0))) fn(); } };
  // 字幕开着时不再飘头顶文字（避免重复）；关掉字幕会自动退回飘字
  const say = (str, t, c) => { if (!ZEZTZ_SUBS_ON) DT.push({ x: P.x, y: P.y - 210, s: str, t: t, c: c }); };

  fire('impact1', L.impact1, () => { shake = Math.max(shake, 6); say('IMPACT!', 1.0, '#00f2fe'); });
  L.beats1.forEach((tb, i) => fire('a' + i, tb, () => { shake = Math.max(shake, 4); }));
  fire('heart', L.heart, () => { shake = Math.max(shake, 2); });
  fire('ready', L.ready, () => { shake = Math.max(shake, 7); say('COME ON! READY!', 1.2, '#ffd84a'); });
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
  fire('burst2', L.burst2, () => {
    shake = Math.max(shake, 20);
    FX.push({ type: 'boom', x: P.x, y: GY - 60, t: 0.5, d: 0.5, r: 300, c: '#ffffff' });
  });
  L.echoes.forEach((tb, i) => fire('e' + i, tb, () => {
    shake = Math.max(shake, 8 + i * 2);
    FX.push({ type: 'boom', x: P.x, y: GY - 40, t: 0.4, d: 0.4, r: 150 + i * 40, c: '#00f2fe' });
  }));
  fire('calm', L.calm, () => { say('KAMEN RIDER ZEZTZ', 1.6, '#00f2fe'); });
}

// ---------- L 技能：挥拳释放 KR_Zeztz_Energywave（按怪兽高低瞄准）----------
//   speed  = 飞行速度；aimMax = 最大仰 / 俯角（弧度，0.62 ≈ 35°）；range = 锁定目标的最远水平距离
//   homing = 飞行中朝目标高度修正的转向速度（弧度/秒）。0 = 只在发射时定角，不追踪；怪兽会上下飘就保持开着
//   w      = 贴图显示宽度（高度按贴图原比例，不再被压扁）
const ZEZTZ_WAVE = { speed: 1150, aimMax: 0.62, range: 1100, homing: 3.2, w: 240 };

// 锁定面前（朝向一侧）水平距离最近的活怪
function zWaveTarget(sx, f) {
  let best = null, bd = 1e9;
  for (const e of E) {
    if (e.dead) continue;
    const dx = (e.x - sx) * f;
    if (dx < -20 || dx > ZEZTZ_WAVE.range) continue;
    if (dx < bd) { bd = dx; best = e; }
  }
  return best;
}
const zWaveAim = (e, x, y, f) => cl(Math.atan2((e.y - e.h * 0.5) - y, Math.max(120, (e.x - x) * f)), -ZEZTZ_WAVE.aimMax, ZEZTZ_WAVE.aimMax);

function fireZeztzWave() {
  const f = P.f, W_ = ZEZTZ_WAVE;
  const startX = P.x + f * 50;
  const startY = P.y - 95;
  const tg = zWaveTarget(startX, f);
  // 角度：怪兽比拳头高 → 往上打，低 → 往下压；面前没有怪就平射
  const ang = tg ? zWaveAim(tg, startX, startY, f) : 0;
  const wave = {
    x: startX,
    y: startY,
    vx: f * W_.speed * Math.cos(ang),
    vy: W_.speed * Math.sin(ang),      // 向下为正
    f: f,
    tid: tg ? tg.id : null,            // 只存 id，不存对象（联机同步 / 序列化更安全）
    t: 1.3,
    dur: 1.3,
    w: W_.w,
    h: W_.w * (WAVE_Z ? WAVE_Z.height / WAVE_Z.width : 0.65),
    dmg: P.atk * 2.2,
    hit: {},
    tick: 0
  };
  Z_WAVES.push(wave);
  shake = Math.max(shake, 8);
  FX.push({ type: 'boom', x: startX, y: startY, t: 0.2, d: 0.2, r: 50, c: '#00f2fe' });
  DT.push({ x: P.x, y: P.y - 190, s: 'IMPACT WAVE!', t: 0.9, c: '#00f2fe' });
  return wave;
}

function updZeztzWaves(dt) {
  const Wc = ZEZTZ_WAVE;
  for (const b of Z_WAVES) {
    b.t -= dt;
    b.tick -= dt;

    // 追踪目标高度（只有发射者本机结算；队友的波只做展示）
    if (!b.vis && Wc.homing > 0 && b.tid != null) {
      const e = E.find(q => q.id === b.tid);
      if (e && !e.dead && (e.x - b.x) * b.f > 30) {
        const vy = b.vy || 0, sp = Math.hypot(b.vx, vy) || Wc.speed;
        let cur = Math.atan2(vy, Math.abs(b.vx));
        cur += cl(zWaveAim(e, b.x, b.y, b.f) - cur, -Wc.homing * dt, Wc.homing * dt);
        b.vx = b.f * sp * Math.cos(cur);
        b.vy = sp * Math.sin(cur);
      }
    }
    b.x += b.vx * dt;
    b.y += (b.vy || 0) * dt;
    if (b.vis) continue;   // 联机：队友的能量波只做展示，伤害由发射者结算

    // 打到地面就消散（往下压的角度会走到这里）
    if (b.y > GY - 6) {
      b.y = GY - 6; b.t = 0;
      FX.push({ type: 'boom', x: b.x, y: GY - 20, t: 0.25, d: 0.25, r: 60, c: '#ff3838' });
      continue;
    }

    if (b.tick <= 0) {
      b.tick = 0.15;
      b.hit = {}; // 允许对穿过的敌人造成多段贯穿伤害
    }
    // 抵消前方的弹幕
    cancelEP(b.x - 80, b.x + 80);

    // 碰撞：沿着波的轴线（从身后一点到波头）取 5 个点，任何一点碰到怪物的身体框就算命中
    const sp = Math.hypot(b.vx, b.vy || 0) || 1, ux = b.vx / sp, uy = (b.vy || 0) / sp;
    for (const e of E) {
      if (e.dead || b.hit[e.id]) continue;
      const cy = e.y - e.h * 0.5;
      for (const k of [-0.12, 0.05, 0.22, 0.4, 0.55]) {
        const px = b.x + ux * b.w * k, py = b.y + uy * b.w * k;
        if (Math.abs(px - e.x) < e.w * 0.45 + 30 && Math.abs(py - cy) < e.h * 0.5 + 45) {
          b.hit[e.id] = 1;
          hurt(e, b.dmg);
          FX.push({ type: 'boom', x: e.x, y: cy, t: 0.2, d: 0.2, r: 48, c: '#ff3838' });
          break;
        }
      }
    }
  }
  Z_WAVES = Z_WAVES.filter(b => b.t > 0);
}

function drawZeztzEnergyWaves() {
  for (const b of Z_WAVES) {
    const x = sn(b.x - cam), y = sn(b.y);
    const p = b.t / b.dur, age = b.dur - b.t;
    const ang = Math.atan2(b.vy || 0, Math.abs(b.vx));   // 仰 / 俯角（相对朝向，向下为正）
    const grow = cl(age / 0.12, 0, 1);                    // 出手 0.12s 内从小变大，不再“啪”地冒出来
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(b.f, 1);
    ctx.rotate(ang);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, p * 1.5) * (0.4 + 0.6 * grow);

    if (WAVE_Z) {
      // 素材：波头在左、火焰拖尾在右 → 镜像后波头朝前；按贴图原比例绘制，不再压扁
      const w = b.w * (0.6 + 0.4 * grow), h = w * WAVE_Z.height / WAVE_Z.width;
      ctx.scale(-1, 1);
      ctx.drawImage(WAVE_Z, -w * 0.55, -h * 0.5, w, h);
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
// 时间轴（P.t，秒）：
//   0 ~ charge    蓄力：气场（帧 0~2）→ 收势 / 摆拳架（帧 3~5）→ 拳前聚起旋涡（帧 6~11），原地不动
//   charge ~ rush 旋涡冲拳突进（帧 12~16），speed 像素/秒
//   rush ~        落地大爆炸（帧 17~19）→ 收拳（20）→ 红光回身（21）→ 站姿（22），之后恢复 idle
// 键名沿用旧版：charge = 蓄力结束 / 开始突进，rush = 突进结束 / 落地，slam = 整个技能结束
const ZEZTZ_FV = { charge: 1.0, rush: 1.6, slam: 2.5, recover: 0.9, speed: 1450 };

// 逐帧时间表 [时间, 帧号]：每一帧都按顺序播放、不跳帧，每帧持续到下一条的时间点
const ZEZTZ_FV_PRE = [
  [0.00, 0], [0.08, 1], [0.16, 2], [0.26, 3], [0.35, 4], [0.44, 5],          // 气场 → 摆架势
  [0.55, 6], [0.625, 7], [0.70, 8], [0.775, 9], [0.85, 10], [0.925, 11],      // 拳前旋涡成形
  [1.00, 12], [1.10, 13], [1.20, 14], [1.30, 15], [1.45, 16]                  // 冲拳突进
];
const ZEZTZ_FV_POST = [                                                       // 时间 = 落地后经过的秒数
  [0.00, 17], [0.12, 18], [0.24, 19], [0.36, 20], [0.48, 21], [0.62, 22]
];
const ZEZTZ_FV_KEYS = ZEZTZ_FV_PRE.concat(ZEZTZ_FV_POST.map(k => [k[0] + ZEZTZ_FV.rush, k[1]]));
const ZEZTZ_FV_BLEND = 0.04;    // 换帧前最后这几十毫秒做淡入过渡（秒）；0 = 纯硬切

function zFvFrameAt(t, nMax) {
  const K = ZEZTZ_FV_KEYS; let j = 0;
  while (j + 1 < K.length && K[j + 1][0] <= t) j++;
  const a = Math.min(K[j][1], nMax), nx = K[j + 1];
  if (!nx || ZEZTZ_FV_BLEND <= 0) return { a, b: a, e: 0 };
  const left = nx[0] - t, bl = Math.min(ZEZTZ_FV_BLEND, (nx[0] - K[j][0]) * 0.5);
  return { a, b: Math.min(nx[1], nMax), e: left < bl ? zzSmooth(0, 1, 1 - left / bl) : 0 };
}

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
    if (t >= 0.16 && !P.hit['fv_aura']) { P.hit['fv_aura'] = 1; shake = Math.max(shake, 5); }    // 青色气场爆开
    if (t >= 0.55 && !P.hit['fv_wind']) { P.hit['fv_wind'] = 1; shake = Math.max(shake, 4); }    // 旋涡开始成形
  } else if (t < Z.rush) {
    if (!P.hit['fv_go']) {
      P.hit['fv_go'] = 1; shake = Math.max(shake, 14);
      FX.push({ type: 'boom', x: P.x, y: GY - 30, t: 0.3, d: 0.3, r: 90, c: '#ff4757' });
    }
    // 旋涡冲拳急速突进！
    P.vx = P.f * Z.speed; P.vy = 0;
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
    if (t > P.landT + Z.recover) {
      P.st = 'idle';
      P.inv = 0.5;
    }
  }
}

// 画 FinalVent 的一帧：x 用“下半身中心”对齐、y 用脚底线对齐（锚点在切帧时已算好）
function zDrawFV(V, idx, x, y, f, alpha) {
  const fr = V.f[idx];
  if (!fr || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.scale(f * V.s, V.s);
  ctx.drawImage(fr, -V.ax[idx], -V.fyA[idx]);
  ctx.restore();
}

function drawZeztzFV(x, y, f) {
  const V = SHZ.fv;
  if (!okS(V)) { dr(SH.atk, 12, x, y, f, 1.0); return; }
  const Z = ZEZTZ_FV, t = P.t, nMax = V.f.length - 1;
  const fr = zFvFrameAt(t, nMax);

  ctx.save();
  ctx.shadowColor = '#00f2fe';
  ctx.shadowBlur = 12;
  if (V.exact) {
    // 突进残影：让高速冲刺看起来连贯
    if (t >= Z.charge && t < Z.rush) {
      ctx.shadowBlur = 0;
      for (const k of [2, 1]) zDrawFV(V, fr.a, x - f * k * 42, y, f, 0.16 * (3 - k));
      ctx.shadowBlur = 12;
    }
    zDrawFV(V, fr.a, x, y, f, 1);                                  // 底层帧完整绘制
    if (fr.e > 0 && fr.b !== fr.a) zDrawFV(V, fr.b, x, y, f, fr.e); // 下一帧叠加淡入（避免中间变暗）
  } else {
    dr(V, fr.a, x, y, f, 1.0);   // 智能分帧失败时的旧式回退
  }
  ctx.restore();
}

// 落点标记：显示冲拳会停在哪（突进中随剩余距离更新，落地后消失）
function drawZeztzMark() {
  if (!P.zeztz || P.st !== 'fv' || P.hit['landed']) return;
  const Z = ZEZTZ_FV, left = Z.speed * (Z.rush - Math.max(P.t, Z.charge));
  const tx = P.x + P.f * left - cam;
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