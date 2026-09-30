// ===== 基地功能界面：药铺 / 铁匠铺 / 训练馆 / 扭蛋机 =====
// 数据与逻辑仍在 ui.js 的 items()；键盘导航在 scenes.js 的 vupd()。这里只负责“画”和“登记点击区域”。
// 每个场所一个主题色，顶部横幅直接用该场所的室内背景图（RM.ri），标题就是店名。
// 点击：点条目 = 选中；点条目右侧的按钮 = 直接确认（命中区域见 MN.hit，点击处理在 main.js）。

const MN_X = 110, MN_Y = 24, MN_W = 740, MN_H = 492;
const MN = { hit: [], key: '', t0: 0, lastG: -1, lastTp: -1, flashT: -9, flashI: -1, sc: 0, st: 0, si: -1, max: 0, rates: false, last: null };

const MN_THEME = {
  shop:  { acc: '#3fe08a', icons: ['🧪', '💧', '📜'] },
  eq:    { acc: '#ffa94d', icons: ['⚔', '🛡', '⚙'] },
  tal:   { acc: '#a78bfa', icons: ['💥', '❤', '🔷', '🎯'] },
  gacha: { acc: '#ff5d73', icons: [] }
};

const mt = (s, x, y, sz, c, al = 'left') => txt(s, x, y, sz, c, al, false);       // 无描边文字（新界面用干净的字）
const mHit = (x, y, w, h, i, act, fn) => MN.hit.push({ x, y, w, h, i, act, fn });
// 列表用：把命中区域裁到可视范围内，滚出去的部分点不到
const mHitClip = (x, y, w, h, c0, c1, i, act, fn) => { const a = Math.max(y, c0), b = Math.min(y + h, c1); if (b > a) MN.hit.push({ x, y: a, w, h: b - a, i, act, fn }) };

// 文字过长自动缩字号（无描边版）
function mFit(s, x, y, maxW, sz, c, al = 'left') {
  while (sz > 9) { ctx.font = poFont(sz); if (ctx.measureText(s).width <= maxW) break; sz--; }
  mt(s, x, y, sz, c, al);
}

// 按钮：kind = 'main'(可点，主题色实心) | 'lack'(资源不足) | 'done'(已拥有/MAX) | 'ghost'(次要)
function mBtn(x, y, w, h, label, kind, acc, sel, sz = 14) {
  rpath(x, y, w, h, Math.min(12, h / 2));
  if (kind === 'main') {
    const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, acc); g.addColorStop(1, acc + 'b8');
    ctx.fillStyle = g; ctx.fill();
    mt(label, x + w / 2, y + h / 2, sz, '#07121d', 'center');
  } else if (kind === 'lack') {
    ctx.fillStyle = 'rgba(255,90,100,.10)'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,110,120,.55)'; ctx.stroke();
    mt(label, x + w / 2, y + h / 2, sz, '#ff8f9a', 'center');
  } else if (kind === 'done') {
    ctx.fillStyle = 'rgba(125,255,154,.10)'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(125,255,154,.45)'; ctx.stroke();
    mt(label, x + w / 2, y + h / 2, sz, '#7dff9a', 'center');
  } else {
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.stroke();
    mt(label, x + w / 2, y + h / 2, sz, '#dfe6ee', 'center');
  }
  if (sel) { rpath(x - 3, y - 3, w + 6, h + 6, Math.min(14, h / 2 + 3)); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); }
}

// 胶囊图形（扭蛋机主视觉）：斜放的两色胶囊，轻微漂浮
function mCapsule(cx, cy, acc) {
  const bob = Math.sin(T * 1.6) * 5, cw = 108, ch = 50;
  ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(sn(cx), cy + 58, 42 - bob * .8, 7, 0, 0, 7); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(sn(cx), sn(cy + bob)); ctx.rotate(-.5 + Math.sin(T * 1.6) * .08);
  ctx.save(); ctx.shadowColor = acc; ctx.shadowBlur = 28; rpath(-cw / 2, -ch / 2, cw, ch, ch / 2); ctx.fillStyle = '#eef2f8'; ctx.fill(); ctx.restore();
  rpath(-cw / 2, -ch / 2, cw, ch, ch / 2); ctx.clip();
  const g = ctx.createLinearGradient(0, -ch / 2, 0, ch / 2); g.addColorStop(0, acc); g.addColorStop(1, acc + '88');
  ctx.fillStyle = g; ctx.fillRect(-cw / 2, -ch / 2, cw / 2, ch);
  const g2 = ctx.createLinearGradient(0, -ch / 2, 0, ch / 2); g2.addColorStop(0, '#ffffff'); g2.addColorStop(1, '#c4ccd8');
  ctx.fillStyle = g2; ctx.fillRect(0, -ch / 2, cw / 2, ch);
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(-1.5, -ch / 2, 3, ch);
  rpath(-cw / 2 + 10, -ch / 2 + 6, cw - 20, 9, 4.5); ctx.fillStyle = 'rgba(255,255,255,.42)'; ctx.fill();
  ctx.restore();
}

// ---------- 外框 + 横幅 + 数值条 + 页脚 ----------
function mnFrame(th, backIdx) {
  const acc = th.acc, X = MN_X, Y = MN_Y, W = MN_W, H = MN_H, BH = 92;
  ctx.fillStyle = 'rgba(3,5,12,.74)'; ctx.fillRect(0, 0, 960, 540);

  rpath(X, Y, W, H, 22);
  const pg = ctx.createLinearGradient(0, Y, 0, Y + H); pg.addColorStop(0, '#0f1830'); pg.addColorStop(1, '#070a16');
  ctx.fillStyle = pg; ctx.fill();
  ctx.save(); ctx.shadowColor = acc; ctx.shadowBlur = 24; ctx.lineWidth = 1.5; ctx.strokeStyle = acc + 'aa'; ctx.stroke(); ctx.restore();

  // 横幅：场所自己的室内背景（没有就用主题色渐变 + 建筑立绘）
  ctx.save(); rpath(X, Y, W, H, 22); ctx.clip();
  ctx.beginPath(); ctx.rect(X, Y, W, BH); ctx.clip();          // 横幅只画在顶部条内
  const im = RM && RM.ri;
  if (im) {
    const s = Math.max(W / im.width, BH / im.height), dw = im.width * s, dh = im.height * s;
    ctx.drawImage(im, X + (W - dw) / 2, Y + (BH - dh) * .6, dw, dh);
  } else {
    const g = ctx.createLinearGradient(X, Y, X + W, Y + BH); g.addColorStop(0, acc + '40'); g.addColorStop(1, '#0a1020');
    ctx.fillStyle = g; ctx.fillRect(X, Y, W, BH);
    if (RM && RM.bi) { const k = 128 / RM.bi.height; ctx.drawImage(RM.bi, X + W - 100 - RM.bi.width * k / 2, Y + BH - 118, RM.bi.width * k, 128) }
  }
  const sh = ctx.createLinearGradient(X, 0, X + W, 0); sh.addColorStop(0, 'rgba(6,9,20,.94)'); sh.addColorStop(.6, 'rgba(6,9,20,.7)'); sh.addColorStop(1, 'rgba(6,9,20,.35)');
  ctx.fillStyle = sh; ctx.fillRect(X, Y, W, BH);
  ctx.fillStyle = acc; ctx.fillRect(X, Y + BH - 2, W, 2);
  ctx.fillRect(X, Y, 5, BH - 2);
  ctx.restore();

  mt(RM.n || '', X + 28, Y + 34, 24, '#fff');
  mFit(RM.npc + '：' + RM.hi, X + 28, Y + 65, 470, 13, '#c9d6e4');

  // 资源胶囊（右上）
  const pills = [['🪙 ' + S.g.toLocaleString(), '#ffd84a'], ['Lv.' + S.lv, '#7dff9a'], ['天赋点 ' + S.tp, '#b8a8ff']];
  let px = X + W - 22;
  for (let i = pills.length - 1; i >= 0; i--) {
    const w = tw(pills[i][0], 13) + 22; px -= w;
    rpath(px, Y + 16, w, 26, 13); ctx.fillStyle = 'rgba(6,9,20,.72)'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = pills[i][1] + '88'; ctx.stroke();
    mt(pills[i][0], px + w / 2, Y + 29, 13, pills[i][1], 'center'); px -= 8;
  }

  // 战斗数值条
  const sy = Y + BH + 12, sw = W - 40, cwd = sw / 4;
  rpath(X + 20, sy, sw, 44, 12); ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fill();
  const cells = [['攻击', P.atk | 0, '#ff9f9f'], ['生命', P.mh, '#55efc4'], ['魔力', P.mm, '#74b9ff'], ['暴击', Math.round(P.cr * 100) + '%', '#ffeaa7']];
  cells.forEach((c, i) => {
    const cx = X + 20 + i * cwd;
    if (i) { ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(cx, sy + 9, 1, 26) }
    mt(c[0], cx + 20, sy + 15, 11, '#8394a8');
    mt(String(c[1]), cx + 20, sy + 31, 17, c[2]);
  });

  // 页脚：返回 + 操作提示
  const fy = Y + H - 42, bsel = V.i === backIdx;
  mBtn(X + 20, fy, 112, 28, '← 返回', 'ghost', acc, bsel, 13);
  mHit(X + 20, fy, 112, 28, backIdx, true);
  // 提示条（购买成功 / 金币不足等）优先占用页脚右侧，否则显示操作提示
  if (V.mt > 0) {
    const s = V.m, w = tw(s, 13) + 30;
    ctx.save(); ctx.globalAlpha = Math.min(1, V.mt / .35);
    rpath(X + W - 20 - w, fy + 1, w, 26, 13); ctx.fillStyle = acc + '30'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = acc; ctx.stroke();
    mt(s, X + W - 20 - w / 2, fy + 14, 13, '#f2fff8', 'center');
    ctx.restore();
  } else {
    mt(TOUCH ? '点条目选择 · 点按钮确认 · 点面板外关闭' : 'W/S 选择 · Enter/F 确认 · Esc 关闭', X + W - 22, fy + 14, 12, '#6f7f95', 'right');
  }
}

// ---------- 小工具 ----------
function mWrap(s, maxW, sz, maxLines) {                 // 按像素宽度折行（中文逐字）
  ctx.font = poFont(sz); const out = []; let cur = '';
  for (const ch of String(s)) {
    if (cur && ctx.measureText(cur + ch).width > maxW) { out.push(cur); cur = ch } else cur += ch;
  }
  if (cur) out.push(cur);
  if (out.length > maxLines) { out.length = maxLines; out[maxLines - 1] = out[maxLines - 1].slice(0, -1) + '…' }
  return out;
}
const mCost = o => o.max ? 'MAX' : [o.g ? o.g.toLocaleString() + ' G' : '', o.t ? o.t + ' 点' : ''].filter(Boolean).join(' + ');
const mOk = o => !o.max && S.g >= (o.g || 0) && S.tp >= (o.t || 0);
const mStat = (v, f) => f === 1 ? Math.round(v * 100) + '%' : f === 2 ? (v * 100).toFixed(1) + '%' : Math.round(v).toLocaleString();

// 试算：假装买一次，读出属性变化，然后原样还原（只用于详情面板的“升级后”预览）
function mnPreview(o) {
  if (!o.st) return [];
  const rd = () => ({ atk: P.atk, mh: P.mh, mm: P.mm, cr: P.cr, def: P.def });
  const a = rd(), sv = { sw: S.sw, ar: S.ar, bt: S.bt, ta: S.ta.slice() };
  o.f(); calc(); const b = rd();
  S.sw = sv.sw; S.ar = sv.ar; S.bt = sv.bt; sv.ta.forEach((v, i) => { S.ta[i] = v }); calc();
  return [['攻击', 'atk', '#ff9f9f'], ['生命', 'mh', '#55efc4'], ['魔力', 'mm', '#74b9ff'], ['暴击', 'cr', '#ffeaa7', 1], ['免伤', 'def', '#7dff9a', 2]]
    .filter(r => Math.abs(b[r[1]] - a[r[1]]) > 1e-9).map(r => ({ n: r[0], c: r[2], a: a[r[1]], b: b[r[1]], f: r[3] }));
}

// ---------- 右侧详情面板 ----------
function mnDetail(o, k, th, x, y, w, h) {
  const acc = th.acc;
  rpath(x, y, w, h, 18);
  const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, acc + '22'); g.addColorStop(1, 'rgba(255,255,255,.025)');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = acc + '55'; ctx.stroke();
  if (!o || o.nv) { mt('选择左侧条目查看详情', x + w / 2, y + h / 2, 13, '#6f7f95', 'center'); return }

  rpath(x + 16, y + 16, 56, 56, 16); ctx.fillStyle = acc + '26'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = acc + '88'; ctx.stroke();
  mt(o.ic || '◆', x + 44, y + 45, 30, '#fff', 'center');
  const parts = o.n.split(/\s{2,}/), name = parts[0], tag = parts[1] || '';
  mFit(name, x + 86, y + 32, w - 102, 19, '#fff');
  if (tag) {
    const pw = tw(tag, 12) + 18;
    rpath(x + 86, y + 48, pw, 21, 10.5); ctx.fillStyle = acc + '22'; ctx.fill();
    mt(tag, x + 86 + pw / 2, y + 58.5, 12, acc, 'center');
  }
  mWrap(o.d || '', w - 32, 12, 3).forEach((l, i) => mt(l, x + 16, y + 92 + i * 17, 12, '#9fb0c4'));

  const pv = mnPreview(o);
  if (pv.length) {
    mt('升级后', x + 16, y + 142, 11, '#6f7f95');
    pv.slice(0, 3).forEach((r, i) => {
      const yy = y + 160 + i * 20;
      mt(r.n, x + 16, yy, 12, r.c);
      const bs = mStat(r.b, r.f), as = mStat(r.a, r.f), rx = x + w - 16;
      mt(bs, rx, yy, 14, '#7dff9a', 'right');
      const ax = rx - tw(bs, 14) - 8;
      mt('→', ax, yy, 12, '#6f7f95', 'right');
      mt(as, ax - 18, yy, 12, '#8fa2b8', 'right');
    });
  } else if (o.hold) {
    mt('持有 ' + o.hold[0] + ' / ' + o.hold[1], x + 16, y + 152, 13, '#e6ecf5');
    rpath(x + 16, y + 170, w - 32, 8, 4); ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fill();
    if (o.hold[0] > 0) { rpath(x + 16, y + 170, (w - 32) * cl(o.hold[0] / o.hold[1], 0, 1), 8, 4); ctx.fillStyle = acc; ctx.fill() }
  }

  mt(o.t && !o.g ? '剩余天赋点 ' + S.tp : '持有金币 ' + S.g.toLocaleString() + ' G', x + 16, y + h - 68, 11, '#8fa2b8');
  const ok = mOk(o), by = y + h - 54;
  const label = o.max ? '已达上限' : ok ? (o.bt || '确认') + '  ·  ' + mCost(o) : (S.g < (o.g || 0) ? '金币不足  ·  ' : '天赋点不足  ·  ') + mCost(o);
  mBtn(x + 16, by, w - 32, 40, label, o.max ? 'done' : ok ? 'main' : 'lack', acc, false, 15);
  mHit(x + 16, by, w - 32, 40, k, true);
}

// ---------- 通用列表：药铺 / 铁匠铺 / 训练馆（左：可滚动列表；右：选中项详情）----------
function mnList(it, th, backIdx) {
  const acc = th.acc, X0 = MN_X + 20, y0 = 184, H = 280, LW = 388, rh = 56, gp = 6;
  const rows = []; it.forEach((o, k) => { if (k !== backIdx) rows.push(k) });
  const total = rows.length * (rh + gp) - gp, maxSc = Math.max(0, total - H);

  // 选中项自动滚进可视区；滚轮 / 滚动条改的是 MN.st（目标值），这里做平滑追赶
  if (MN.si !== V.i) {
    MN.si = V.i; const sr = rows.indexOf(V.i);
    if (sr >= 0) { const top = sr * (rh + gp), bot = top + rh; if (top < MN.st) MN.st = top; else if (bot > MN.st + H) MN.st = bot - H }
  }
  MN.max = maxSc; MN.st = cl(MN.st, 0, maxSc);
  MN.sc += (MN.st - MN.sc) * .3; if (Math.abs(MN.st - MN.sc) < .3) MN.sc = MN.st;

  ctx.save(); ctx.beginPath(); ctx.rect(X0 - 8, y0 - 6, LW + 16, H + 12); ctx.clip();
  const rw = LW - (maxSc > 0 ? 14 : 0);
  rows.forEach((k, r) => {
    const o = it[k], y = y0 + r * (rh + gp) - MN.sc;
    if (y + rh < y0 - 6 || y > y0 + H + 6) return;
    const sel = V.i === k, ok = mOk(o);
    const parts = o.n.split(/\s{2,}/), name = parts[0], tag = parts[1] || '';

    rpath(X0, y, rw, rh, 14);
    ctx.fillStyle = sel ? acc + '1f' : 'rgba(255,255,255,.035)'; ctx.fill();
    if (sel) { ctx.save(); ctx.shadowColor = acc; ctx.shadowBlur = 12; ctx.lineWidth = 1.6; ctx.strokeStyle = acc; ctx.stroke(); ctx.restore() }
    else { ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.stroke() }
    const fl = MN.flashI === k ? 1 - (T - MN.flashT) / .35 : 0;
    if (fl > 0) { rpath(X0, y, rw, rh, 14); ctx.fillStyle = 'rgba(255,255,255,' + (fl * .2).toFixed(3) + ')'; ctx.fill() }

    rpath(X0 + 10, y + 8, 40, 40, 11); ctx.fillStyle = acc + '26'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = acc + '66'; ctx.stroke();
    mt(o.ic || '◆', X0 + 30, y + 28, 20, '#fff', 'center');

    const cw = 92, nx = X0 + 62;
    mt(name, nx, y + 20, 15, sel ? '#fff' : '#e6ecf5');
    if (tag) {
      const nw = tw(name, 15), pw = tw(tag, 11) + 14;
      rpath(nx + nw + 8, y + 11, pw, 18, 9); ctx.fillStyle = acc + '22'; ctx.fill();
      mt(tag, nx + nw + 8 + pw / 2, y + 20, 11, acc, 'center');
    }
    if (o.d) mFit(o.d, nx, y + 40, rw - 62 - cw - 10, 11, '#8fa2b8');
    mt(mCost(o), X0 + rw - 12, y + rh / 2, 13, o.max ? '#7dff9a' : ok ? '#ffd84a' : '#ff8f9a', 'right');
    mHitClip(X0, y, rw, rh, y0, y0 + H, k, false, () => { V.i = k });
  });
  // 上下渐隐 + 滚动条
  if (MN.sc > 2) { const gr = ctx.createLinearGradient(0, y0, 0, y0 + 20); gr.addColorStop(0, 'rgba(11,18,36,.95)'); gr.addColorStop(1, 'rgba(11,18,36,0)'); ctx.fillStyle = gr; ctx.fillRect(X0 - 8, y0, LW + 16, 20) }
  if (MN.sc < maxSc - 2) {
    const gr = ctx.createLinearGradient(0, y0 + H - 24, 0, y0 + H); gr.addColorStop(0, 'rgba(9,14,29,0)'); gr.addColorStop(1, 'rgba(9,14,29,.95)'); ctx.fillStyle = gr; ctx.fillRect(X0 - 8, y0 + H - 24, LW + 16, 24);
    mt('▾', X0 + rw / 2, y0 + H - 8, 13, acc, 'center');
  }
  ctx.restore();
  if (maxSc > 0) {
    const tx = X0 + LW - 6, th_ = Math.max(28, H * H / total), ty = y0 + (H - th_) * (MN.sc / maxSc);
    rpath(tx, y0, 5, H, 2.5); ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fill();
    rpath(tx, ty, 5, th_, 2.5); ctx.fillStyle = acc + 'cc'; ctx.fill();
    mHit(tx - 8, y0, 22, H / 2, 0, false, () => { MN.st = cl(MN.st - 120, 0, maxSc) });      // 点滚动条上半 / 下半翻页（触屏用）
    mHit(tx - 8, y0 + H / 2, 22, H / 2, 0, false, () => { MN.st = cl(MN.st + 120, 0, maxSc) });
  }

  const dx = X0 + LW + 14;
  mnDetail(it[V.i], V.i, th, dx, y0, MN_X + MN_W - 20 - dx, H);
}

// ---------- 扭蛋机：左侧机器主视觉（含“？”），右侧 单抽 / 十连 ----------
function mnGacha(it, th, backIdx) {
  const acc = th.acc, X = MN_X + 20, y0 = 184, H = 280, lw = 290, n = CAPSULES.length;
  const own = c => S.caps.includes(c.id), got = CAPSULES.filter(own).length;

  rpath(X, y0, lw, H, 18);
  const g = ctx.createLinearGradient(X, y0, X, y0 + H); g.addColorStop(0, acc + '2e'); g.addColorStop(1, 'rgba(255,255,255,.03)');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.stroke();
  mCapsule(X + lw / 2, y0 + 76, acc);
  mt('胶囊抽取', X + lw / 2, y0 + 152, 20, '#fff', 'center');
  mt('抽取假面骑士变身胶囊', X + lw / 2, y0 + 175, 12, '#8fa2b8', 'center');
  const dx0 = X + lw / 2 - (n - 1) * 9;
  CAPSULES.forEach((c, i) => {
    ctx.beginPath(); ctx.arc(dx0 + i * 18, y0 + 199, 5, 0, 7);
    if (own(c)) { ctx.fillStyle = c.c; ctx.fill() } else { ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.stroke() }
  });
  mt('已收集 ' + got + ' / ' + n, X + lw / 2, y0 + 216, 11, '#6f7f95', 'center');
  if (MN.last) {
    const c = { new: 0, dup: 0, potion: 0, none: 0 }; MN.last.forEach(r => { c[r.k]++ });
    const s = [c.new && '新胶囊 ' + c.new, c.dup && '重复 ' + c.dup, c.potion && '药水 ' + c.potion, c.none && '未中 ' + c.none].filter(Boolean).join(' · ');
    mt('上次：' + s, X + lw / 2, y0 + H - 20, 11, '#c9d6e4', 'center');
  }

  // “？”按钮：奖池与概率
  const qx = X + lw - 26, qy = y0 + 26, qs = V.i === 2;
  ctx.beginPath(); ctx.arc(qx, qy, 15, 0, 7); ctx.fillStyle = qs ? acc + '55' : 'rgba(255,255,255,.08)'; ctx.fill();
  ctx.lineWidth = qs ? 2 : 1.2; ctx.strokeStyle = qs ? '#fff' : acc; ctx.stroke();
  mt('?', qx, qy + .5, 17, '#fff', 'center');
  mHit(qx - 18, qy - 18, 36, 36, 2, true);

  // 右：单抽 / 十连
  const cx = X + lw + 14, cw = MN_W - 40 - lw - 14, gp = 12, ch = (H - gp) / 2;
  [[1, '单抽', '抽取 1 次', 0], [10, '十连抽', '连续抽取 10 次，每次独立判定', 1]].forEach(([c, title, sub, idx]) => {
    const y = y0 + idx * (ch + gp), cost = GACHA_COST * c, ok = S.g >= cost, sel = V.i === idx;
    rpath(cx, y, cw, ch, 16); ctx.fillStyle = sel ? acc + '1f' : 'rgba(255,255,255,.035)'; ctx.fill();
    if (sel) { ctx.save(); ctx.shadowColor = acc; ctx.shadowBlur = 12; ctx.lineWidth = 1.6; ctx.strokeStyle = acc; ctx.stroke(); ctx.restore() }
    else { ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.stroke() }
    if (MN.flashI === idx && T - MN.flashT < .35) { rpath(cx, y, cw, ch, 16); ctx.fillStyle = 'rgba(255,255,255,' + ((1 - (T - MN.flashT) / .35) * .16).toFixed(3) + ')'; ctx.fill() }

    mt(title, cx + 22, y + 34, 24, '#fff');
    mt(sub, cx + 22, y + 62, 12, '#8fa2b8');
    ctx.beginPath(); ctx.arc(cx + 30, y + ch - 30, 8, 0, 7); ctx.fillStyle = '#f2b81c'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#8a5a00'; ctx.stroke();
    mt(cost.toLocaleString() + ' G', cx + 46, y + ch - 30, 18, ok ? '#ffd84a' : '#ff8f9a');
    const bw = 130, bh = 46, bx = cx + cw - 20 - bw, by = y + (ch - bh) / 2;
    mBtn(bx, by, bw, bh, ok ? '抽取 ×' + c : '金币不足', ok ? 'main' : 'lack', acc, false, 16);
    mHit(cx, y, cw, ch, idx, false, () => { V.i = idx });
    mHit(bx, by, bw, bh, idx, true);
  });
}

// ---------- 奖池与概率（点“？”打开）----------
function mnRates(th) {
  const acc = th.acc, tb = gachaTable(), bx = MN_X + 60, by = MN_Y + 56, bw = MN_W - 120, bh = 376;
  MN.hit = []; mHit(0, 0, 960, 540, 0, false, () => { MN.rates = false });     // 点哪儿都关闭，并挡住下层按钮
  rpath(MN_X, MN_Y, MN_W, MN_H, 22); ctx.fillStyle = 'rgba(2,4,10,.74)'; ctx.fill();
  rpath(bx, by, bw, bh, 18);
  const g = ctx.createLinearGradient(0, by, 0, by + bh); g.addColorStop(0, '#16213f'); g.addColorStop(1, '#0a1022');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.shadowColor = acc; ctx.shadowBlur = 18; ctx.lineWidth = 1.5; ctx.strokeStyle = acc + 'aa'; ctx.stroke(); ctx.restore();

  mt('奖池与概率', bx + 24, by + 30, 20, '#fff');
  mt('十连 = 连抽 10 次，每次独立判定', bx + 24, by + 54, 12, '#8fa2b8');
  ctx.beginPath(); ctx.arc(bx + bw - 30, by + 30, 14, 0, 7); ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.stroke();
  mt('✕', bx + bw - 30, by + 30.5, 13, '#fff', 'center');

  mt('奖品', bx + 24, by + 84, 11, '#6f7f95'); mt('概率', bx + bw - 150, by + 84, 11, '#6f7f95', 'right'); mt('状态', bx + bw - 24, by + 84, 11, '#6f7f95', 'right');
  const rh = Math.min(46, Math.floor(196 / tb.length)), ry0 = by + 98;
  tb.forEach((e, i) => {
    const ry = ry0 + i * rh, cap = e.kind === 'cap', col = cap ? e.c.c : e.kind === 'potion' ? '#3fe08a' : '#7f8ea3';
    rpath(bx + 14, ry, bw - 28, rh - 6, 10); ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fill();
    ctx.beginPath(); ctx.arc(bx + 40, ry + (rh - 6) / 2, 13, 0, 7); ctx.fillStyle = col + '30'; ctx.fill(); ctx.lineWidth = 1.3; ctx.strokeStyle = col; ctx.stroke();
    mt(cap ? e.c.rider[0] : e.kind === 'potion' ? '🧪' : '✕', bx + 40, ry + (rh - 6) / 2, cap ? 12 : 11, '#fff', 'center');
    const nm = cap ? e.c.name : e.kind === 'potion' ? '体力药水 ×1' : '谢谢惠顾', ty = ry + (rh - 6) / 2;
    mt(nm, bx + 64, ty, 15, cap ? e.c.c : '#e6ecf5');
    if (cap) { const nw = tw(nm, 15), tg = e.c.tag, pw = tw(tg, 11) + 14; rpath(bx + 64 + nw + 8, ty - 9, pw, 18, 9); ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fill(); mt(tg, bx + 64 + nw + 8 + pw / 2, ty, 11, '#c9d6e4', 'center') }
    else if (e.kind === 'potion') mt('（持有已满时无效）', bx + 64 + tw(nm, 15) + 8, ty, 11, '#6f7f95');
    const barX = bx + bw - 290, barW = 100;                         // 概率条
    rpath(barX, ty - 3, barW, 6, 3); ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fill();
    if (e.p > 0) { rpath(barX, ty - 3, Math.max(4, barW * e.p / 100), 6, 3); ctx.fillStyle = col; ctx.fill() }
    mt((Math.round(e.p * 10) / 10) + '%', bx + bw - 150, ty, 16, cap ? '#ffd84a' : '#c9d6e4', 'right');
    if (cap) { const has = S.caps.includes(e.c.id); mt(has ? '已拥有' : '未拥有', bx + bw - 24, ty, 12, has ? '#7dff9a' : '#8fa2b8', 'right') }
  });
  const fy = ry0 + tb.length * rh + 12;
  mt('· 抽中已拥有的胶囊不会获得任何补偿（不返还金币或经验）', bx + 24, fy, 12, '#ff9aa4');
  mt('· 新胶囊抽中后自动入库，按 [N] 装配，战斗中按 [P] 变身', bx + 24, fy + 20, 12, '#8fa2b8');
  mt(TOUCH ? '点任意处关闭' : '点任意处 / Enter / Esc 关闭', bx + bw / 2, by + bh - 16, 11, '#6f7f95', 'center');
}

// ---------- 入口：scenes.js 的 drawW() 在 M 打开时调用 ----------
function drawV() {
  const th = MN_THEME[V.pg] || MN_THEME.shop, it = items();
  let backIdx = it.length - 1;
  for (let k = it.length - 1; k >= 0; k--) if (it[k].nv && /返回/.test(it[k].n)) { backIdx = k; break }
  MN.hit = [];

  const key = V.pg + ':' + G;
  if (MN.key !== key) { MN.key = key; MN.t0 = T; MN.lastG = S.g; MN.lastTp = S.tp; MN.flashI = -1; MN.sc = MN.st = 0; MN.si = -1; MN.rates = false }
  if (S.g < MN.lastG || S.tp < MN.lastTp) { MN.flashT = T; MN.flashI = V.i }      // 花了钱/点：选中项闪一下
  MN.lastG = S.g; MN.lastTp = S.tp;

  const e = Math.min(1, (T - MN.t0) / .18), ez = 1 - Math.pow(1 - e, 3);         // 打开动画
  ctx.save();
  ctx.globalAlpha = ez; ctx.translate(480, 270); ctx.scale(.965 + .035 * ez, .965 + .035 * ez); ctx.translate(-480, -270);
  mnFrame(th, backIdx);
  if (V.pg === 'gacha') { mnGacha(it, th, backIdx); if (MN.rates) mnRates(th) } else mnList(it, th, backIdx);
  ctx.restore();
}

// ---------- 十连结算总览 ----------
function drawGachaSummary() {
  const g = gachaModal, res = g.res;
  if (g.t0 === undefined) g.t0 = T;
  const cols = Math.min(5, res.length), rows = Math.ceil(res.length / cols), TW = 150, TH = 146, GP = 14;
  const x0 = 480 - (cols * TW + (cols - 1) * GP) / 2, y0 = rows > 1 ? 74 : 150;
  ctx.save();
  ctx.fillStyle = 'rgba(4,6,14,.94)'; ctx.fillRect(0, 0, 960, 540);
  mt(res.length + ' 连抽 · 结果', 480, 38, 24, '#ffd84a', 'center');
  res.forEach((r, i) => {
    const x = x0 + (i % cols) * (TW + GP), y = y0 + ((i / cols) | 0) * (TH + GP), a = cl((T - g.t0 - i * .07) / .25, 0, 1);
    if (a <= 0) return;
    const col = r.c ? r.c.c : r.k === 'potion' ? '#3fe08a' : '#7f8ea3', good = r.k === 'new';
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x + TW / 2, y + TH / 2); ctx.scale(.85 + .15 * a, .85 + .15 * a); ctx.translate(-x - TW / 2, -y - TH / 2);
    rpath(x, y, TW, TH, 14); ctx.fillStyle = good ? col + '22' : 'rgba(255,255,255,.05)'; ctx.fill();
    ctx.save(); if (good) { ctx.shadowColor = col; ctx.shadowBlur = 14 } ctx.lineWidth = good ? 2 : 1; ctx.strokeStyle = good ? col : 'rgba(255,255,255,.14)'; ctx.stroke(); ctx.restore();
    let nm, sub, sc;
    if (r.k === 'new') {
      const art = CAP_IMGS[r.c.id]; ctx.save(); rpath(x + 8, y + 8, TW - 16, 82, 9); ctx.clip();
      if (art) drawArt(art, x + 8, y + 8, TW - 16, 82); else { ctx.fillStyle = col + '44'; ctx.fillRect(x + 8, y + 8, TW - 16, 82); mt(r.c.rider, x + TW / 2, y + 49, 16, '#fff', 'center') }
      ctx.restore();
      rpath(x + 12, y + 12, 38, 18, 9); ctx.fillStyle = '#ffd84a'; ctx.fill(); mt('NEW', x + 31, y + 21, 11, '#3a2a00', 'center');
      nm = r.c.short; sub = '新获得'; sc = '#ffd84a';
    } else if (r.k === 'dup') {
      ctx.beginPath(); ctx.arc(x + TW / 2, y + 48, 26, 0, 7); ctx.fillStyle = col + '22'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = col + '88'; ctx.stroke();
      mt(r.c.rider[0], x + TW / 2, y + 48, 20, '#ffffff88', 'center');
      nm = r.c.short; sub = '重复 · 无补偿'; sc = '#8fa2b8';
    } else if (r.k === 'potion') {
      mt('🧪', x + TW / 2, y + 48, 36, '#fff', 'center'); nm = '体力药水 ×1'; sub = r.full ? '背包已满 · 无效' : '已放入背包'; sc = r.full ? '#8fa2b8' : '#7dff9a';
    } else { mt('✕', x + TW / 2, y + 48, 32, '#5d6b7c', 'center'); nm = '未中'; sub = '谢谢惠顾'; sc = '#6f7f95' }
    mt(nm, x + TW / 2, y + 108, 15, r.k === 'none' || r.k === 'dup' ? '#9fb0c4' : col === '#3fe08a' ? '#e6ecf5' : col, 'center');
    mt(sub, x + TW / 2, y + 129, 11, sc, 'center');
    ctx.restore();
  });
  const c = { new: 0, dup: 0, potion: 0, none: 0 }; res.forEach(r => { c[r.k]++ });
  const ty = y0 + rows * (TH + GP) + 8;
  mt('新胶囊 ' + c.new + '　·　重复 ' + c.dup + '　·　药水 ' + c.potion + '　·　未中 ' + c.none, 480, Math.min(ty, 452), 14, '#c9d6e4', 'center');
  rpath(360, 478, 240, 38, 19);
  const bg = ctx.createLinearGradient(0, 478, 0, 516); bg.addColorStop(0, '#ff5d73'); bg.addColorStop(1, '#ff5d73aa');
  ctx.fillStyle = bg; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.stroke();
  mt(gachaQ.length ? '查看新胶囊 (' + gachaQ.length + ')' : '确定 [Enter / 空格]', 480, 497, 15, '#fff', 'center');
  ctx.restore();
}

// ---------- 扭蛋结算卡面 ----------
function drawGachaModalOverlay() {
  if (gachaModal.type === 'sum') { drawGachaSummary(); return }
  const cap = CAPSULES.find(c => c.id === gachaModal.type) || CAPSULES[0], art = CAP_IMGS[cap.id];
  if (gachaModal.t0 === undefined) gachaModal.t0 = T;
  const e = Math.min(1, (T - gachaModal.t0) / .3), ez = 1 - Math.pow(1 - e, 3);
  ctx.save();
  ctx.fillStyle = 'rgba(4,6,14,.94)'; ctx.fillRect(0, 0, 960, 540);

  // 背景光芒（这一屏唯一的动态重点）
  ctx.save(); ctx.translate(480, 215);
  for (let a = 0; a < 12; a++) {
    ctx.rotate(Math.PI / 6);
    ctx.fillStyle = (a % 2 === 0) ? cap.c + '16' : 'rgba(255,216,74,.05)';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 420, -.2 + T * .04, .2 + T * .04); ctx.fill();
  }
  ctx.restore();

  ctx.globalAlpha = ez; ctx.translate(480, 270); ctx.scale(.94 + .06 * ez, .94 + .06 * ez); ctx.translate(-480, -270);

  mt(gachaModal.isNew ? '获得新的变身胶囊' : '契约胶囊 · 结算卡面', 480, 36, 22, '#ffd84a', 'center');

  const iw = 520, ih = 293, ix = 480 - iw / 2, iy = 62;
  if (art) {
    ctx.save(); ctx.shadowColor = cap.c; ctx.shadowBlur = 30 + Math.sin(T * 4) * 8;
    rpath(ix, iy, iw, ih, 18); ctx.fillStyle = '#0a0f1c'; ctx.fill(); ctx.restore();
    ctx.save(); rpath(ix, iy, iw, ih, 18); ctx.clip(); drawArt(art, ix, iy, iw, ih); ctx.restore();
    rpath(ix, iy, iw, ih, 18); ctx.lineWidth = 2.5; ctx.strokeStyle = cap.c; ctx.stroke();
  }

  mt(cap.name, 480, 385, 26, cap.c, 'center');
  mt('KAMEN RIDER ' + cap.rider, 480, 411, 13, '#9fb0c4', 'center');
  // 品质与类别
  const t1 = TIERS[cap.tier].n + '契约', t2 = cap.tag, w1 = tw(t1, 12) + 20, w2 = tw(t2, 12) + 20, gx = 480 - (w1 + w2 + 8) / 2;
  rpath(gx, 424, w1, 22, 11); ctx.fillStyle = TIERS[cap.tier].c + '2a'; ctx.fill(); ctx.strokeStyle = TIERS[cap.tier].c; ctx.lineWidth = 1; ctx.stroke();
  mt(t1, gx + w1 / 2, 435, 12, TIERS[cap.tier].c, 'center');
  rpath(gx + w1 + 8, 424, w2, 22, 11); ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.stroke();
  mt(t2, gx + w1 + 8 + w2 / 2, 435, 12, '#dfe6ee', 'center');
  mFit(cap.buff + '　·　' + cap.skill, 480, 461, 640, 12, '#c9d6e4', 'center');

  // 确认按钮
  rpath(360, 478, 240, 38, 19);
  const bg = ctx.createLinearGradient(0, 478, 0, 516); bg.addColorStop(0, cap.c); bg.addColorStop(1, cap.c + 'aa');
  ctx.fillStyle = bg; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.stroke();
  mt('确定 [Enter / 空格]', 480, 497, 15, '#fff', 'center');
  mt('按【N】装配胶囊 · 战斗中按【P】变身', 480, 528, 11, '#6f7f95', 'center');
  ctx.restore();
}
