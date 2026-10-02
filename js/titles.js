// ===== 称号系统 =====
// 解锁条件直接读成就进度（ui.js 的 QA）/ 无尽塔最高层 / 胶囊星级，不需要先「领取」成就奖励。
// 数据：S.tt = 当前佩戴的称号 id；S.tu = 已经提示过的称号 { id: 1 }（避免重复弹提示）。
// 佩戴的称号名会随战力一起上传到排行榜（leaderboard 表的 title 列，见 power.js / leaderboard_title.sql）。
//
// 想加新称号：在 TITLES 里加一项即可（id 一旦发布不要改，存档按 id 记录）
//   a: ['成就id', 档位下标]   档位下标 -1 = 该成就的最后一档
//   tw: 层数                  无尽塔最高层 ≥ 该值
//   ok / d                    自定义条件函数 / 说明文字
const TITLES = [
  { id: 'kill1', n: '猎魔人', col: '#7dff9a', a: ['kill', 2] },
  { id: 'kill2', n: '万魔之敌', col: '#ffd84a', a: ['kill', 4] },
  { id: 'boss1', n: '弑王者', col: '#ff8a4a', a: ['boss', 1] },
  { id: 'boss2', n: '屠神者', col: '#ff4757', a: ['boss', 3] },
  { id: 'win1', n: '常胜骑士', col: '#7df9ff', a: ['win', 2] },
  { id: 'star3', n: '完美主义者', col: '#ffd84a', a: ['star3', 2] },
  { id: 'lv1', n: '身经百战', col: '#7dff9a', a: ['lv', 3] },
  { id: 'hen1', n: '变身达人', col: '#c79bff', a: ['hen', 2] },
  { id: 'cap1', n: '契约之主', col: '#7df9ff', a: ['cap', -1] },
  { id: 'enh1', n: '强化大师', col: '#ffa502', a: ['enh', 2] },
  { id: 'gear1', n: '神装在身', col: '#ff6b81', a: ['gear', 2] },
  { id: 'pow1', n: '战力无双', col: '#ff4757', a: ['power', 3] },
  { id: 'day1', n: '每日勤勉', col: '#7dff9a', a: ['daily', 1] },
  { id: 'time1', n: '骑士之魂', col: '#a55eea', a: ['time', 2] },
  { id: 'cs5', n: '星之契约', col: '#ffd84a', d: '将一枚变身胶囊升到 5 星', ok: () => CAPSULES.some(c => capStar(c.id) >= CAP_STAR_MAX),
    p: () => [Math.max(0, ...CAPSULES.map(c => capStar(c.id))) + ' 星', CAP_STAR_MAX + ' 星'] },
  { id: 'tw10', n: '登塔者', col: '#a55eea', tw: 10 },
  { id: 'tw30', n: '破云行者', col: '#7df9ff', tw: 30 },
  { id: 'tw50', n: '摘星之人', col: '#ffd84a', tw: 50 },
  { id: 'tw100', n: '塔顶之王', col: '#ff3838', tw: 100 },
  // 周榜称号：由 power.js 的周榜结算写入 S.wkw.best（历史最佳周榜名次）
  { id: 'wk10', n: '周榜十强', col: '#4fa8ff', d: '周榜（本周击杀）上周名列前 10', ok: () => wkBest() <= 10, p: () => [wkBest() >= 999 ? '未上榜' : '最佳第 ' + wkBest() + ' 名', '前 10 名'] },
  { id: 'wk3', n: '周榜三甲', col: '#c06bff', d: '周榜（本周击杀）上周名列前 3', ok: () => wkBest() <= 3, p: () => [wkBest() >= 999 ? '未上榜' : '最佳第 ' + wkBest() + ' 名', '前 3 名'] },
  { id: 'wk1', n: '周榜之王', col: '#ffb020', d: '周榜（本周击杀）上周夺得第 1 名', ok: () => wkBest() <= 1, p: () => [wkBest() >= 999 ? '未上榜' : '最佳第 ' + wkBest() + ' 名', '第 1 名'] }
];

// ---------- 稀有度：普通 / 稀有 / 史诗 / 传说（边框、底色不同，传说有流光）----------
const TT_RARITY = {
  n: { n: '普通', col: '#aab4c0', a0: '1c', k: 0 },
  r: { n: '稀有', col: '#4fa8ff', a0: '28', k: 1 },
  e: { n: '史诗', col: '#c06bff', a0: '34', k: 2 },
  l: { n: '传说', col: '#ffb020', a0: '40', k: 3 }
};
const TT_RAR_OF = {   // 称号 id → 稀有度（新增称号在这里加一项，不写默认普通）
  kill1: 'n', win1: 'n', lv1: 'n', hen1: 'n', day1: 'n',
  boss1: 'r', cap1: 'r', enh1: 'r', time1: 'r', tw10: 'r', wk10: 'r',
  kill2: 'e', boss2: 'e', gear1: 'e', star3: 'e', tw30: 'e', cs5: 'e', wk3: 'e',
  pow1: 'l', tw50: 'l', tw100: 'l', wk1: 'l'
};
TITLES.forEach(t => { t.r = TT_RAR_OF[t.id] || 'n'; });
const ttRar = t => TT_RARITY[t && t.r] || TT_RARITY.n;

// 稀有度行背景：普通只有淡边，稀有 / 史诗带发光描边，传说再加一道流光
function ttRowBg(x, y, w, h, t, got) {
  const r = ttRar(t), col = got ? r.col : '#4a5565';
  ctx.save();
  rpath(x, y, w, h, 8);
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, got ? col + r.a0 : 'rgba(255,255,255,.03)'); g.addColorStop(1, 'rgba(255,255,255,.02)');
  ctx.fillStyle = g; ctx.fill();
  if (got && r.k >= 2) { ctx.shadowColor = col; ctx.shadowBlur = r.k === 3 ? 12 : 6; }
  ctx.lineWidth = got ? (r.k >= 2 ? 1.6 : 1.2) : 1;
  ctx.strokeStyle = got ? col + (r.k ? 'cc' : '77') : 'rgba(255,255,255,.12)'; ctx.stroke();
  ctx.restore();
  rpath(x, y + 8, 3, h - 16, 1.5); ctx.fillStyle = col; ctx.fill();
  if (got && r.k === 3 && typeof uiShine === 'function') uiShine(x, y, w, h, 8, .3);
}
// 稀有度小标签：al = 'right' 时 x 为右边缘，否则 x 为左边缘；返回标签宽度
function ttRarTag(x, cy, t, got, al) {
  const r = ttRar(t), pw = uw(r.n, 9.5, 700) + 12, px = al === 'right' ? x - pw : x;
  ctx.save(); ctx.globalAlpha = got === false ? .45 : 1;
  rpath(px, cy - 8, pw, 16, 8); ctx.fillStyle = r.col + '26'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = r.col + 'aa'; ctx.stroke();
  ut(r.n, px + pw / 2, cy + .5, 9.5, r.col, 'center', { w: 700, sh: 0 });
  ctx.restore();
  return pw;
}

const TT_PER = 6;
const ttById = id => TITLES.find(t => t.id === id) || null;
const ttByName = n => TITLES.find(t => t.n === n) || null;

// ---------- 称号图片 ----------
// 图片放在 Assets/Titles/<称号id>.png（透明底 PNG，建议约 3:1 的横条，如 360×120）。
// 某个称号没有图片 / 还没加载好 → 自动退回原来的文字徽章，所以可以只做其中几个。
const TT_IMGS = {};
function ttImg(t) {
  if (!t) return null;
  let e = TT_IMGS[t.id];
  if (!e) {
    e = TT_IMGS[t.id] = { im: new Image(), ok: false };
    e.im.onload = () => { e.ok = true; };
    e.im.onerror = () => { e.bad = true; };
    e.im.src = encodeURI(A + 'Titles/' + t.id + '.png');
  }
  return e.ok ? e.im : null;
}
// 在 (x, cy) 处按高度 h 画称号图（x 为左边缘，cy 为竖直中心），宽度超过 maxW 时等比缩小；
// 返回实际占用的宽度，没有图片返回 0（调用方据此退回文字）
// 裁掉图片四周的透明留白（star3.png 左右各有一大块透明/烟雾），否则徽章看起来没有贴左对齐
const TT_CROP = {};
function ttCrop(im) {
  const k = im.src;
  if (TT_CROP[k]) return TT_CROP[k];
  const W = im.naturalWidth || im.width, H = im.naturalHeight || im.height;
  let sx = 0, sy = 0, sw = W, sh = H;
  try {
    const sc = Math.min(1, 480 / W), qw = Math.max(1, Math.round(W * sc)), qh = Math.max(1, Math.round(H * sc));
    const q = document.createElement('canvas'); q.width = qw; q.height = qh;
    const qg = q.getContext('2d'); qg.drawImage(im, 0, 0, qw, qh);
    const d = qg.getImageData(0, 0, qw, qh).data;
    let x0 = qw, y0 = qh, x1 = -1, y1 = -1;
    for (let y = 0; y < qh; y++) for (let x = 0; x < qw; x++) if (d[(y * qw + x) * 4 + 3] > 40) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 >= x0 && y1 >= y0) {
      sx = Math.max(0, Math.floor(x0 / sc) - 2); sy = Math.max(0, Math.floor(y0 / sc) - 2);
      sw = Math.min(W - sx, Math.ceil((x1 - x0 + 1) / sc) + 4); sh = Math.min(H - sy, Math.ceil((y1 - y0 + 1) / sc) + 4);
    }
  } catch (e) { sx = 0; sy = 0; sw = W; sh = H; }   // 读不了像素（跨域 / file://）就不裁
  const c = document.createElement('canvas'); c.width = sw; c.height = sh;
  c.getContext('2d').drawImage(im, sx, sy, sw, sh, 0, 0, sw, sh);
  return (TT_CROP[k] = c);
}
// 高质量缩小：原图（如 1792×592）一次性缩到几十像素会糊，所以逐次减半到目标物理像素尺寸，结果缓存复用
const TT_SMALL = {};
function ttSmall(im, w, h) {
  const d = (typeof DPR === 'number' && DPR > 0) ? DPR : (window.devicePixelRatio || 1);
  const tw = Math.max(1, Math.round(w * d)), th = Math.max(1, Math.round(h * d));
  const key = im.src + '|' + tw + 'x' + th;
  if (TT_SMALL[key]) return TT_SMALL[key];
  let cur = ttCrop(im), cw = cur.width, ch = cur.height;
  if (cw <= tw * 1.01) return cur;   // 本来就不比目标大，直接用
  while (cw / 2 > tw) {
    const c = document.createElement('canvas');
    cw = Math.ceil(cw / 2); ch = Math.ceil(ch / 2); c.width = cw; c.height = ch;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(cur, 0, 0, cw, ch); cur = c;
  }
  const out = document.createElement('canvas'); out.width = tw; out.height = th;
  const og = out.getContext('2d'); og.imageSmoothingEnabled = true; og.imageSmoothingQuality = 'high';
  og.drawImage(cur, 0, 0, tw, th);
  return (TT_SMALL[key] = out);
}
function ttBadge(t, x, cy, h, maxW, alpha) {
  const im = ttImg(t);
  if (!im) return 0;
  const cr = ttCrop(im);
  let ih = h, iw = cr.width * ih / cr.height;
  if (iw > maxW) { iw = maxW; ih = cr.height * iw / cr.width; }
  ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(ttSmall(im, iw, ih), x, cy - ih / 2, iw, ih);
  ctx.restore();
  return iw;
}
const ttNp = () => Math.max(1, Math.ceil(TITLES.length / TT_PER));

function ttQA(t) { return QA.find(o => o.id === t.a[0]); }
function ttTier(t) {   // 该称号对应的成就档位目标值；成就不存在返回 null
  const a = ttQA(t); if (!a) return null;
  const ts = qaTiers(a), i = t.a[1] < 0 ? ts.length + t.a[1] : t.a[1];
  return i >= 0 && i < ts.length ? { a, v: ts[i] } : null;
}
function ttOk(t) {
  try {
    if (t.a) { const k = ttTier(t); return !!k && k.a.get() >= k.v; }
    if (t.tw) return (typeof twBest === 'function' ? twBest() : 0) >= t.tw;
    return !!(t.ok && t.ok());
  } catch (e) { return false; }
}
function ttDesc(t) {
  if (t.a) { const k = ttTier(t); return k ? k.a.d(k.v) : '—'; }
  if (t.tw) return '无尽塔通关第 ' + t.tw + ' 层';
  return t.d || '';
}
const ttCount = () => TITLES.filter(ttOk).length;

// 当前佩戴的称号（没戴 / 已不满足条件 → null）
function ttCur() { const t = ttById(S.tt); return t && ttOk(t) ? t : null; }
const ttName = () => { const t = ttCur(); return t ? t.n : ''; };
const ttColByName = n => { const t = TITLES.find(o => o.n === n); return t ? ttRar(t).col : '#d9bd7d'; };   // 排行榜文字标签用稀有度颜色

function ttEquip(id) {   // id 为空 = 卸下
  if (id) { const t = ttById(id); if (!t || !ttOk(t)) return false; }
  S.tt = id || null;
  save();
  if (typeof lbSubmit === 'function') lbSubmit();   // 排行榜上的称号跟着更新
  return true;
}

// 每 0.5 秒由 ui.js 的 qScan 调用：发现新称号 → 弹提示（没戴称号时自动戴上）
// 第一次运行时（老存档）把已满足的称号静默记下，不会一口气弹一堆提示
function ttScan() {
  const first = !S.tu || typeof S.tu !== 'object';
  if (first) S.tu = {};
  let changed = first;
  for (const t of TITLES) {
    if (S.tu[t.id] || !ttOk(t)) continue;
    S.tu[t.id] = 1; changed = true;
    if (!first) {
      if (typeof questToast === 'function') questToast('🎖 获得称号：' + t.n, t.col);
      if (!S.tt) S.tt = t.id;
    }
  }
  // 老存档第一次运行：静默记下已满足的称号后，如果还没戴任何称号，就自动戴上最后（最高档）一个，排行榜上马上能看到
  if (first && !S.tt) { const got = TITLES.filter(t => S.tu[t.id]); if (got.length) S.tt = got[got.length - 1].id; }
  if (changed) { save(); if (typeof lbSubmit === 'function') lbSubmit(); }
}

// ---------- 任务面板「称号」页签（ui.js 的 drawQuestModal 调用）----------
function drawTitleTab(b, x0, y0, w) {
  const np = ttNp(), cur = ttCur();
  QST.page = cl(QST.page, 0, np - 1);
  ut(cur ? '当前佩戴：「' + cur.n + '」' : '当前未佩戴称号', b.x + b.w - 28, b.y + 88, 11.5, cur ? cur.col : UIC.sub, 'right', { w: 700, sh: 0 });

  const rh = 50, pitch = 54;
  ttSorted().slice(QST.page * TT_PER, QST.page * TT_PER + TT_PER).forEach((t, i) => {
    const y = y0 + i * pitch, got = ttOk(t), eq = !!cur && cur.id === t.id;
    ttRowBg(x0, y, w, rh, t, got);
    if (!ttBadge(t, x0 + 16, y + 25, 38, 124, got ? 1 : .35)) {   // 有图片用图片，没有就画文字徽章
      const pw = uw(t.n, 13, 700) + 24;
      rpath(x0 + 16, y + 13, pw, 24, 12);
      ctx.fillStyle = got ? ttRar(t).col + '2e' : 'rgba(255,255,255,.04)'; ctx.fill();
      ctx.lineWidth = 1.2; ctx.strokeStyle = got ? ttRar(t).col : 'rgba(255,255,255,.18)'; ctx.stroke();
      ut(t.n, x0 + 16 + pw / 2, y + 25.5, 13, got ? ttRar(t).col : '#7d8795', 'center', { w: 700, sh: 0 });
    }
    ut(ttDesc(t), x0 + 150, y + 25.5, 11, got ? UIC.txt : UIC.sub, 'left', { w: 500, sh: 0 });
    ttRarTag(x0 + w - 98, y + 25, t, got, 'right');
    const bx = x0 + w - 88;
    if (eq) qBtn(bx, y + 11, 76, 28, '卸下', '#ffa502', true, () => { ttEquip(null); });
    else if (got) qBtn(bx, y + 11, 76, 28, '佩戴', '#7dff9a', true, () => { ttEquip(t.id); });
    else qBtn(bx, y + 11, 76, 28, '未解锁', '#5d6b7c', false);
  });

  const fy = b.y + b.h - 44;
  qBtn(b.x + b.w / 2 - 200, fy, 62, 24, '◀ 上页', '#7df9ff', true, () => { QST.page = (QST.page - 1 + np) % np; });
  ut('第 ' + (QST.page + 1) + ' / ' + np + ' 页 · 已获得 ' + ttCount() + ' / ' + TITLES.length, b.x + b.w / 2, fy + 12.5, 11.5, UIC.sub, 'center', { w: 600, sh: 0 });
  qBtn(b.x + b.w / 2 + 138, fy, 62, 24, '下页 ▶', '#7df9ff', true, () => { QST.page = (QST.page + 1) % np; });
}


// ---------- 战绩档案里的「更换称号」选择面板 ----------
// 已拥有的排在前面，未解锁的排在后面并变暗，每行都写着解锁条件和当前进度。
// 点击战绩档案头部的称号（或「更换」按钮）打开；命中区域登记在 LB.hit（power.js），由 psClick 统一处理。
const TS = { open: false, page: 0 };
const TS_PER = 5;
function ttSorted() {
  const got = [], lock = [];
  for (const t of TITLES) (ttOk(t) ? got : lock).push(t);
  const ro = t => 3 - ttRar(t).k;
  got.sort((a, b) => ro(a) - ro(b)); lock.sort((a, b) => ro(a) - ro(b));   // 同组内：传说 > 史诗 > 稀有 > 普通
  return got.concat(lock);
}
function ttProg(t) {   // 当前进度 → [当前值文字, 目标值文字]；没有进度概念返回 null
  try {
    if (t.p) return t.p();
    if (t.a) { const k = ttTier(t); if (!k) return null; const f = k.a.f || (v => psBig(Math.floor(v))); return [f(k.a.get()), f(k.v)]; }
    if (t.tw) return [twBest() + ' 层', t.tw + ' 层'];
  } catch (e) { }
  return null;
}
function ttPickerOpen() { TS.open = true; TS.page = 0; }

function drawTitlePicker() {
  if (!TS.open) return;
  const list = ttSorted(), np = Math.max(1, Math.ceil(list.length / TS_PER)), cur = ttCur();
  TS.page = cl(TS.page, 0, np - 1);
  const pw = 620, ph = 392, px = 170, py = 74, acc = '#ffd84a', x0 = px + 16, w = pw - 32, y0 = py + 66;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, 960, 540);
  LB.hit.push({ x: 0, y: 0, w: 960, h: 540, fn: () => { TS.open = false; } });      // 点面板外：关闭选择面板
  LB.hit.push({ x: px, y: py, w: pw, h: ph, fn: () => { } });                       // 点面板内空白：什么也不做（挡住下层）
  hudPanel(px, py, pw, ph, acc, 16);
  ut('更换称号', px + 24, py + 30, 17, UIC.hi, 'left', { w: 700 });
  ut('已获得 ' + ttCount() + ' / ' + TITLES.length + ' · 已拥有的排在前面（稀有度高的在前），灰色为未解锁', px + 24, py + 50, 10.5, UIC.sub, 'left', { w: 600, sh: 0 });
  lbBtn(px + pw - 78, py + 12, 62, 26, '✕ 关闭', '#ff4757', () => { TS.open = false; });
  if (cur) lbBtn(px + pw - 168, py + 12, 82, 26, '卸下称号', '#ffa502', () => { ttEquip(null); });

  list.slice(TS.page * TS_PER, TS.page * TS_PER + TS_PER).forEach((t, i) => {
    const y = y0 + i * 56, got = ttOk(t), eq = !!cur && cur.id === t.id;
    ttRowBg(x0, y, w, 50, t, got);
    if (!ttBadge(t, x0 + 16, y + 25, 36, 120, got ? 1 : .4)) {     // 有图片用图片，没有就画文字徽章
      const bw = uw(t.n, 13, 700) + 24;
      rpath(x0 + 16, y + 13, bw, 24, 12);
      ctx.fillStyle = got ? ttRar(t).col + '2e' : 'rgba(255,255,255,.03)'; ctx.fill();
      ctx.lineWidth = 1.2; ctx.strokeStyle = got ? ttRar(t).col : 'rgba(255,255,255,.14)'; ctx.stroke();
      ut(t.n, x0 + 16 + bw / 2, y + 25.5, 13, got ? ttRar(t).col : '#6b7482', 'center', { w: 700, sh: 0 });
    }
    ut((got ? '' : '🔒 条件：') + ttDesc(t), x0 + 150, y + 18, 11.5, got ? UIC.txt : '#7d8795', 'left', { w: 600, sh: 0 });
    ttRarTag(x0 + w - 98, y + 18, t, got, 'right');
    const pg = got ? null : ttProg(t);
    if (eq) ut('★ 佩戴中', x0 + 150, y + 37, 10.5, '#ffd84a', 'left', { w: 700, sh: 0 });
    else if (got) ut('✔ 已获得', x0 + 150, y + 37, 10.5, '#7dff9a', 'left', { w: 600, sh: 0 });
    else ut(pg ? '当前进度  ' + pg[0] + ' / ' + pg[1] : '尚未达成', x0 + 150, y + 37, 10.5, '#8a93a1', 'left', { w: 500, sh: 0 });
    const bx = x0 + w - 88;
    if (eq) lbBtn(bx, y + 11, 76, 28, '卸下', '#ffa502', () => { ttEquip(null); });
    else if (got) lbBtn(bx, y + 11, 76, 28, '佩戴', '#7dff9a', () => { ttEquip(t.id); });
    else qBtn(bx, y + 11, 76, 28, '未解锁', '#5d6b7c', false);
  });

  const fy = py + ph - 42;
  lbBtn(px + pw / 2 - 150, fy, 62, 24, '◀ 上页', '#7df9ff', () => { TS.page = (TS.page - 1 + np) % np; });
  ut('第 ' + (TS.page + 1) + ' / ' + np + ' 页', px + pw / 2, fy + 12.5, 11.5, UIC.sub, 'center', { w: 600, sh: 0 });
  lbBtn(px + pw / 2 + 88, fy, 62, 24, '下页 ▶', '#7df9ff', () => { TS.page = (TS.page + 1) % np; });
  ut('A / D 翻页 · Esc 关闭', px + pw / 2, py + ph - 10, 9.5, 'rgba(210,218,232,.5)', 'center', { w: 500, sh: 0 });
  ctx.restore();
}

// 选择面板打开时由 main.js 先调用：返回 true = 按键已被它处理，战绩档案本身不再响应
function ttPickerKeys() {
  if (!TS.open) return false;
  const np = Math.max(1, Math.ceil(TITLES.length / TS_PER)), eat = (...ks) => ks.forEach(k => delete PR[k]);
  if (PR.Escape || PR.Enter || PR.Space || PR.KeyF || PR.KeyI) { TS.open = false; eat('Escape', 'Enter', 'Space', 'KeyF', 'KeyI'); }
  else if (PR.KeyA || PR.ArrowLeft) { TS.page = (TS.page - 1 + np) % np; eat('KeyA', 'ArrowLeft'); }
  else if (PR.KeyD || PR.ArrowRight) { TS.page = (TS.page + 1) % np; eat('KeyD', 'ArrowRight'); }
  return true;
}
