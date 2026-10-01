// ===== 基地功能界面：药铺 / 铁匠铺 / 训练馆 / 扭蛋机 =====
// 重构版：高对比度纯净黑曜石装甲终端 (Solid Dark Armor Chassis)
// 数据与逻辑在 ui.js；按键导航在 scenes.js；此处专精渲染、碰撞注册与长按连发控制

const MN_X = 96, MN_Y = 24, MN_W = 768, MN_H = 492;
const MN = { 
  hit: [], key: '', t0: 0, lastG: -1, lastTp: -1, lastD: -1, 
  flashT: -9, flashI: -1, sc: 0, st: 0, si: -1, max: 0, rates: false, last: null 
};

// 长按连续触发控制器
const MN_HOLD = {
  down: false,
  key: false,
  t: 0,
  next: 0,
  count: 0
};

// 设施主题色系
const MN_THEME = {
  shop:  { id: 'shop', title: '战备药械合成终端', code: 'FACILITY // PHARMACEUTICAL LAB', acc: '#00f298', tag: '战术补给', icons: ['🧪', '💧', '📜'] },
  eq:    { id: 'eq', title: '骑士装甲整备终端', code: 'FACILITY // ARMORED FORGE & CALIBRATION', acc: '#ff9f43', tag: '基础研磨', icons: ['⚔', '🛡', '⚙'] },
  tal:   { id: 'tal', title: '神经中枢拟真训练场', code: 'FACILITY // NEURAL SIMULATION PROTOCOL', acc: '#a55eea', tag: '潜能突破', icons: ['💥', '❤', '🔷', '🎯'] },
  gacha: { id: 'gacha', title: '契约胶囊扭蛋终端', code: 'FACILITY // RIDER CONTRACT SYSTEM', acc: '#ff5d73', tag: '契约抽取', icons: [] }
};

const mt = (s, x, y, sz, c, al = 'left') => txt(s, x, y, sz, c, al, false);
const mHit = (x, y, w, h, i, act, fn) => MN.hit.push({ x, y, w, h, i, act, fn });
const mHitClip = (x, y, w, h, c0, c1, i, act, fn) => { const a = Math.max(y, c0), b = Math.min(y + h, c1); if (b > a) MN.hit.push({ x, y: a, w, h: b - a, i, act, fn }); };

function mFit(s, x, y, maxW, sz, c, al = 'left') {
  while (sz > 9) { ctx.font = poFont(sz); if (ctx.measureText(s).width <= maxW) break; sz--; }
  mt(s, x, y, sz, c, al);
}

// 切角多边形科技容器
function techCutBox(x, y, w, h, c = 8) {
  ctx.beginPath();
  ctx.moveTo(x + c, y); ctx.lineTo(x + w - c, y); ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c); ctx.lineTo(x + w - c, y + h); ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c); ctx.lineTo(x, y + c);
  ctx.closePath();
}

// 科技按钮通用组件
function mTechBtn(x, y, w, h, label, kind, acc, sel, sz = 13, corner = 7) {
  techCutBox(x, y, w, h, corner);
  if (kind === 'main') {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, acc);
    g.addColorStop(1, acc + 'bb');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.shadowColor = acc; ctx.shadowBlur = 10;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
    mt(label, x + w / 2, y + h / 2, sz, '#050a14', 'center');
  } else if (kind === 'lack') {
    ctx.fillStyle = 'rgba(255, 71, 87, 0.14)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255, 90, 100, 0.55)'; ctx.lineWidth = 1; ctx.stroke();
    mt(label, x + w / 2, y + h / 2, sz, '#ff7675', 'center');
  } else if (kind === 'done') {
    ctx.fillStyle = 'rgba(46, 213, 115, 0.14)'; ctx.fill();
    ctx.strokeStyle = 'rgba(46, 213, 115, 0.55)'; ctx.lineWidth = 1; ctx.stroke();
    mt(label, x + w / 2, y + h / 2, sz, '#2ed573', 'center');
  } else {
    ctx.fillStyle = sel ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.05)'; ctx.fill();
    ctx.strokeStyle = sel ? acc : 'rgba(255, 255, 255, 0.2)'; ctx.lineWidth = 1; ctx.stroke();
    mt(label, x + w / 2, y + h / 2, sz, sel ? '#ffffff' : '#cfd8e3', 'center');
  }
  if (sel && kind !== 'main') {
    ctx.save();
    techCutBox(x - 2, y - 2, w + 4, h + 4, corner + 1);
    ctx.strokeStyle = acc; ctx.lineWidth = 1.8;
    ctx.shadowColor = acc; ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.restore();
  }
}

const mCost = o => o.max ? 'MAX' : [o.g ? o.g.toLocaleString() + ' G' : '', o.t ? o.t + ' 点' : ''].filter(Boolean).join(' + ');
const mOk = o => !o.max && S.g >= (o.g || 0) && S.tp >= (o.t || 0);
const mStat = (v, f) => f === 3 ? (Math.round(v * 10) / 10).toLocaleString(undefined, { maximumFractionDigits: 1 }) : f === 1 ? Math.round(v * 100) + '%' : f === 2 ? (v * 100).toFixed(1) + '%' : Math.round(v).toLocaleString();

// 试算升级属性收益
function mnPreview(o) {
  if (!o.st) return [];
  const rd = () => ({ atk: P.atkRaw, mh: P.mhRaw, mm: P.mmRaw, cr: P.cr, def: P.def });
  const a = rd(), sv = { sw: S.sw, ar: S.ar, bt: S.bt, ta: S.ta.slice() };
  o.f(); calc(); const b = rd();
  S.sw = sv.sw; S.ar = sv.ar; S.bt = sv.bt; sv.ta.forEach((v, i) => { S.ta[i] = v; }); calc();
  return [
    ['基础攻击', 'atk', '#ff7675', 3],
    ['装甲生命', 'mh', '#55efc4', 3],
    ['核心魔力', 'mm', '#74b9ff', 3],
    ['会心暴击', 'cr', '#ffeaa7', 1],
    ['机甲免伤', 'def', '#7dff9a', 2]
  ].filter(r => Math.abs(b[r[1]] - a[r[1]]) > 1e-9).map(r => ({
    n: r[0], c: r[2], a: a[r[1]], b: b[r[1]], delta: b[r[1]] - a[r[1]], f: r[3]
  }));
}

// 执行购买/加点核心方法
function mnDoExecute(idx) {
  const it = items();
  const o = it[idx];
  if (!o || o.nv || o.max) return false;
  if (!mOk(o)) {
    say(S.g < (o.g || 0) ? '金币不足' : '天赋点不足');
    return false;
  }
  buy(o);
  MN.flashT = T;
  MN.flashI = idx;
  return true;
}

// 启动/停止长按判定
function mnStartHold(isKey = false) {
  MN_HOLD.down = true;
  MN_HOLD.key = isKey;
  MN_HOLD.t = 0;
  MN_HOLD.next = 0.35;
  MN_HOLD.count = 0;
}
function mnStopHold() {
  MN_HOLD.down = false;
  MN_HOLD.key = false;
  MN_HOLD.t = 0;
}

window.addEventListener('pointerup', mnStopHold);
window.addEventListener('pointercancel', mnStopHold);

// 每帧长按更新控制
function mnHoldUpdate(dt) {
  if (!M || V.pg === 'st' || V.pg === 'gacha') {
    mnStopHold();
    return;
  }
  const kDown = !!(K.Enter || K.Space || K.KeyF);
  if (kDown && !MN_HOLD.key && !MN_HOLD.down) mnStartHold(true);
  else if (!kDown && MN_HOLD.key) mnStopHold();

  if (MN_HOLD.down) {
    MN_HOLD.t += dt;
    if (MN_HOLD.t >= MN_HOLD.next) {
      const ok = mnDoExecute(V.i);
      if (ok) {
        MN_HOLD.count++;
        const iv = MN_HOLD.count > 15 ? 0.05 : MN_HOLD.count > 6 ? 0.08 : 0.12;
        MN_HOLD.next = MN_HOLD.t + iv;
      } else {
        mnStopHold();
      }
    }
  }
}

// ---------- 终端主外框 (修复贴顶重合与数值靠右对齐) ----------
function mnFrame(th, backIdx) {
  const acc = th.acc, X = MN_X, Y = MN_Y, W = MN_W, H = MN_H;

  // 1. 全局近全黑遮罩
  ctx.fillStyle = 'rgba(2, 4, 10, 0.96)';
  ctx.fillRect(0, 0, 960, 540);

  // 2. 底盘深空黑曜石实心底
  techCutBox(X, Y, W, H, 16);
  const pg = ctx.createLinearGradient(X, Y, X + W, Y + H);
  pg.addColorStop(0, '#0e1628');
  pg.addColorStop(0.5, '#080d1a');
  pg.addColorStop(1, '#040710');
  ctx.fillStyle = pg; ctx.fill();

  // 3. 科技硬朗描边与四角卡榫
  ctx.save();
  techCutBox(X, Y, W, H, 16);
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = acc + '88';
  ctx.shadowColor = acc; ctx.shadowBlur = 14;
  ctx.stroke();
  ctx.restore();

  // 四角 L 型机械锁扣
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.lineCap = 'square';
  const L = 14, C = 16;
  ctx.beginPath(); ctx.moveTo(X + C + L, Y); ctx.lineTo(X + C, Y); ctx.lineTo(X, Y + C); ctx.lineTo(X, Y + C + L); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X + W - C - L, Y); ctx.lineTo(X + W - C, Y); ctx.lineTo(X + W, Y + C); ctx.lineTo(X + W, Y + C + L); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X, Y + H - C - L); ctx.lineTo(X, Y + H - C); ctx.lineTo(X + C, Y + H); ctx.lineTo(X + C + L, Y + H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X + W, Y + H - C - L); ctx.lineTo(X + W, Y + H - C); ctx.lineTo(X + W - C, Y + H); ctx.lineTo(X + W - C - L, Y + H); ctx.stroke();
  ctx.restore();

  // 4. 顶栏：设施身份信息区
  const headY = Y + 12;
  const tagW = tw(th.tag, 11) + 16;
  techCutBox(X + 24, headY + 2, tagW, 20, 4);
  ctx.fillStyle = acc + '28'; ctx.fill();
  ctx.strokeStyle = acc; ctx.lineWidth = 1; ctx.stroke();
  mt(th.tag, X + 24 + tagW / 2, headY + 12, 11, acc, 'center');

  mt(th.title, X + 24 + tagW + 10, headY + 12, 19, '#ffffff');
  mt(th.code, X + 24, headY + 34, 9.5, '#7f93a8');

  // NPC 终端通讯气泡 (高度 20，底部在 y = 96)
  const npcStr = `[OPERATOR] ${RM.npc || '终端'}：${RM.hi || '待命中。'}`;
  const npcBoxW = 420;
  techCutBox(X + 24, headY + 44, npcBoxW, 20, 4);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.lineWidth = 1; ctx.stroke();
  mFit(npcStr, X + 32, headY + 54, npcBoxW - 16, 11, '#9fb3c8');

  // 5. 右上角：图二修复项（icon 居左，数值贴紧卡片右侧）
  const pills = [
    { s: S.d.toLocaleString(), ic: ICO.d, c: '#4fe3ff' },
    { s: S.g.toLocaleString() + ' G', ic: ICO.g, c: '#ffd84a' },
    { s: 'Lv.' + S.lv, c: '#7dff9a' },
    { s: '天赋点 ' + S.tp, c: '#b8a8ff' }
  ];
  let curPx = X + W - 24;
  ctx.font = poFont(11.5);
  for (let i = pills.length - 1; i >= 0; i--) {
    const p = pills[i];
    const textW = ctx.measureText(p.s).width;
    // 赋予带 icon 的胶囊充足的呼吸宽度，让文字能拉开并清晰贴靠在右侧
    const w = p.ic ? Math.max(96, textW + 42) : textW + 24;
    curPx -= w;
    techCutBox(curPx, headY + 6, w, 24, 4);
    ctx.fillStyle = 'rgba(8, 14, 28, 0.95)'; ctx.fill();
    ctx.strokeStyle = p.c + '66'; ctx.lineWidth = 1; ctx.stroke();
    if (p.ic) {
      // 图标贴左，数值完全贴右（距右边界 10px）
      drawIco(p.ic, curPx + 14, headY + 18, 15);
      mt(p.s, curPx + w - 10, headY + 18, 11.5, p.c, 'right');
    } else {
      mt(p.s, curPx + w / 2, headY + 18, 11.5, p.c, 'center');
    }
    curPx -= 6;
  }

  // 6. 页脚区域
  const footY = Y + H - 42;
  techCutBox(X + 24, footY - 4, W - 48, 36, 6);
  ctx.fillStyle = 'rgba(6, 10, 20, 0.85)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'; ctx.lineWidth = 1; ctx.stroke();

  // 返回大厅按钮
  const bsel = V.i === backIdx;
  mTechBtn(X + 30, footY, 110, 28, '← 返回大厅 [ESC]', 'ghost', '#ff4757', bsel, 11.5, 5);
  mHit(X + 30, footY, 110, 28, backIdx, true);

  // 操作指引
  if (V.mt > 0) {
    const nw = tw(V.m, 12) + 36;
    techCutBox(480 - nw / 2, footY, nw, 28, 6);
    ctx.fillStyle = acc + '33'; ctx.fill();
    ctx.strokeStyle = acc; ctx.lineWidth = 1.2; ctx.stroke();
    mt(V.m, 480, footY + 14, 12, '#ffffff', 'center');
  } else {
    mt(TOUCH ? '支持长按大按钮连续执行 · 点选条目切换 · 点面板外关闭' : '支持长按 Enter/F/按钮连续执行 · W/S 切换条目 · Esc 退出', X + W - 36, footY + 14, 11, '#6f8298', 'right');
  }
}

// ---------- 左右分栏：图一修复项（下移 Y0 彻底解决卡片文字重叠） ----------
function mnList(it, th, backIdx) {
  // Y0 从原先的 100 下移至 112，避开上方结束于 y=96 的 NPC 通讯卡片，彻底避免压边重合
  const acc = th.acc, X0 = MN_X + 24, Y0 = MN_Y + 88, listH = 356, listW = 388, rh = 68, gap = 8;
  const rows = [];
  it.forEach((o, k) => { if (k !== backIdx) rows.push(k); });
  const totalH = rows.length * (rh + gap) - gap;
  const maxSc = Math.max(0, totalH - listH);

  // 智能平滑跟随光标滚动
  if (MN.si !== V.i) {
    MN.si = V.i;
    const sr = rows.indexOf(V.i);
    if (sr >= 0) {
      const top = sr * (rh + gap), bot = top + rh;
      if (top < MN.st) MN.st = top;
      else if (bot > MN.st + listH) MN.st = bot - listH;
    }
  }
  MN.max = maxSc;
  MN.st = cl(MN.st, 0, maxSc);
  MN.sc += (MN.st - MN.sc) * 0.35;
  if (Math.abs(MN.st - MN.sc) < 0.2) MN.sc = MN.st;

  ctx.save();
  ctx.beginPath();
  ctx.rect(X0 - 4, Y0 - 4, listW + 8, listH + 8);
  ctx.clip();

  const rw = listW - (maxSc > 0 ? 12 : 0);
  rows.forEach((k, r) => {
    const o = it[k], y = Y0 + r * (rh + gap) - MN.sc;
    if (y + rh < Y0 - 10 || y > Y0 + listH + 10) return;

    const sel = V.i === k, ok = mOk(o);
    const parts = o.n.split(/\s{2,}/), name = parts[0], tag = parts[1] || '';

    // 卡片底板
    techCutBox(X0, y, rw, rh, 8);
    ctx.fillStyle = sel ? 'rgba(18, 30, 56, 0.95)' : 'rgba(10, 16, 30, 0.85)';
    ctx.fill();

    // 选中态边框与高光
    if (sel) {
      ctx.save();
      techCutBox(X0, y, rw, rh, 8);
      ctx.strokeStyle = acc; ctx.lineWidth = 1.8;
      ctx.shadowColor = acc; ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = acc;
      ctx.fillRect(X0, y + 8, 4, rh - 16);
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(X0, y + 14, 3, rh - 28);
    }

    // 连续触发闪光
    if (MN.flashI === k && T - MN.flashT < 0.25) {
      const fl = (1 - (T - MN.flashT) / 0.25) * 0.35;
      techCutBox(X0, y, rw, rh, 8);
      ctx.fillStyle = `rgba(255, 255, 255, ${fl.toFixed(3)})`;
      ctx.fill();
    }

    // 左侧图标
    const icBoxX = X0 + 12, icBoxY = y + 12, icSize = 44;
    techCutBox(icBoxX, icBoxY, icSize, icSize, 6);
    ctx.fillStyle = sel ? acc + '28' : 'rgba(255, 255, 255, 0.05)'; ctx.fill();
    ctx.strokeStyle = sel ? acc : 'rgba(255, 255, 255, 0.14)'; ctx.lineWidth = 1; ctx.stroke();
    mt(o.ic || '◆', icBoxX + icSize / 2, icBoxY + icSize / 2, 22, '#ffffff', 'center');

    // 严格测量名称宽度并留出安全间距，防止名称与 tag 互相压字
    const nx = X0 + 66;
    ctx.font = poFont(14.5);
    const nw = ctx.measureText(name).width;
    mt(name, nx, y + 20, 14.5, sel ? '#ffffff' : '#e2e8f0');

    if (tag) {
      ctx.font = poFont(10.5);
      const tagW = ctx.measureText(tag).width + 14;
      const tagX = nx + nw + 10; // 固定安全间距 10px
      techCutBox(tagX, y + 11, tagW, 18, 4);
      ctx.fillStyle = sel ? acc + '22' : 'rgba(255, 255, 255, 0.08)'; ctx.fill();
      ctx.strokeStyle = sel ? acc + '88' : 'rgba(255, 255, 255, 0.2)'; ctx.lineWidth = 1; ctx.stroke();
      mt(tag, tagX + tagW / 2, y + 20, 10.5, sel ? acc : '#9fb3c8', 'center');
    }

    // 价格胶囊预留空间，保证说明文字不超过价格区域
    const costStr = mCost(o);
    const cw = tw(costStr, 12) + 20;
    const cx = X0 + rw - cw - 12, cy = y + (rh - 24) / 2;

    if (o.d) {
      const maxDescW = rw - 66 - cw - 24;
      mFit(o.d, nx, y + 44, maxDescW, 11, '#8fa0b5');
    }

    // 右侧价格胶囊
    techCutBox(cx, cy, cw, 24, 4);
    if (o.max) {
      ctx.fillStyle = 'rgba(46, 213, 115, 0.16)'; ctx.fill();
      ctx.strokeStyle = '#2ed573'; ctx.lineWidth = 1; ctx.stroke();
      mt('MAX', cx + cw / 2, cy + 12, 11, '#2ed573', 'center');
    } else {
      ctx.fillStyle = ok ? 'rgba(255, 216, 74, 0.14)' : 'rgba(255, 71, 87, 0.14)'; ctx.fill();
      ctx.strokeStyle = ok ? '#ffd84a88' : '#ff475788'; ctx.lineWidth = 1; ctx.stroke();
      mt(costStr, cx + cw / 2, cy + 12, 11.5, ok ? '#ffd84a' : '#ff7675', 'center');
    }

    if (sel) mt('▶', X0 + rw - 6, y + rh / 2, 11, acc, 'center');
    mHitClip(X0, y, rw, rh, Y0, Y0 + listH, k, false, () => { V.i = k; });
  });
  ctx.restore();

  if (maxSc > 0) {
    const barX = X0 + listW - 6, barH = Math.max(32, listH * (listH / totalH)), barY = Y0 + (listH - barH) * (MN.sc / maxSc);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(barX, Y0, 4, listH);
    ctx.fillStyle = acc;
    ctx.fillRect(barX - 0.5, barY, 5, barH);
  }

  // 右侧详情终端
  const detailX = X0 + listW + 14, detailW = MN_X + MN_W - 24 - detailX;
  mnDetail(it[V.i], V.i, th, detailX, Y0, detailW, listH);
}

// ---------- 右侧详情：静态插槽 + 动态大数字防重叠 ----------
function mnDetail(o, k, th, x, y, w, h) {
  const acc = th.acc;
  techCutBox(x, y, w, h, 10);
  const bg = ctx.createLinearGradient(x, y, x + w, y + h);
  bg.addColorStop(0, '#101a30');
  bg.addColorStop(1, '#060a16');
  ctx.fillStyle = bg; ctx.fill();
  ctx.strokeStyle = acc + '44'; ctx.lineWidth = 1.2; ctx.stroke();

  if (!o || o.nv) {
    mt('请在左侧选择要整备的模块条目', x + w / 2, y + h / 2, 13, '#6f8298', 'center');
    return;
  }

  // 1. 顶部硬朗切角插槽
  const iconBoxX = x + 16, iconBoxY = y + 16, iconBoxS = 52;
  techCutBox(iconBoxX, iconBoxY, iconBoxS, iconBoxS, 8);
  ctx.fillStyle = acc + '22'; ctx.fill();
  ctx.strokeStyle = acc; ctx.lineWidth = 1.5; ctx.stroke();
  mt(o.ic || '◆', iconBoxX + iconBoxS / 2, iconBoxY + iconBoxS / 2, 28, '#ffffff', 'center');

  // 条目名称与级别
  const parts = o.n.split(/\s{2,}/), name = parts[0], tag = parts[1] || '';
  mFit(name, x + 78, y + 26, w - 90, 17, '#ffffff');
  if (tag) {
    const tw_ = tw(tag, 11) + 16;
    techCutBox(x + 78, y + 42, tw_, 20, 4);
    ctx.fillStyle = acc + '26'; ctx.fill();
    ctx.strokeStyle = acc; ctx.lineWidth = 1; ctx.stroke();
    mt(tag, x + 78 + tw_ / 2, y + 52, 11, acc, 'center');
  }

  // 2. 模块技术描述
  const descY = y + 80;
  mWrap(o.d || '', w - 32, 12, 3).forEach((line, idx) => {
    mt(line, x + 16, descY + idx * 18, 12, '#9eb2c6');
  });

  // 3. 诊断面板 (效能增幅 / 药水容量 / 耗材库存)
  const pv = mnPreview(o);
  const midBoxY = y + 144, midBoxH = 96;
  techCutBox(x + 16, midBoxY, w - 32, midBoxH, 6);
  ctx.fillStyle = 'rgba(6, 10, 20, 0.85)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.lineWidth = 1; ctx.stroke();

  if (pv.length) {
    // 强化/加点预览：采用多列固定锚点安全计算，彻底杜绝大数字（如111,299与增幅）重叠
    mt('// CALIBRATION GAIN · 效能增幅预估', x + 20, midBoxY + 16, 9.5, acc);
    pv.slice(0, 2).forEach((r, idx) => {
      const yy = midBoxY + 42 + idx * 26;
      mt(r.n, x + 20, yy, 12, r.c);

      const deltaStr = `▲ +${mStat(r.delta, r.f)}`;
      const newStr = mStat(r.b, r.f);
      const oldStr = mStat(r.a, r.f);

      // 右侧增幅标签
      ctx.font = poFont(11.5);
      const dW = ctx.measureText(deltaStr).width;
      const dRight = x + w - 24;
      mt(deltaStr, dRight, yy, 11.5, '#2ed573', 'right');

      // 新数值
      ctx.font = poFont(13);
      const newW = ctx.measureText(newStr).width;
      const newRight = dRight - dW - 10;
      mt(newStr, newRight, yy, 13, '#2ed573', 'right');

      // 箭头指示
      const arrowRight = newRight - newW - 6;
      mt('➔', arrowRight, yy, 11, acc, 'right');

      // 旧数值
      const oldRight = arrowRight - 12;
      mt(oldStr, oldRight, yy, 12, '#8fa0b5', 'right');
    });
  } else if (o.st) {
    mt('// CALIBRATION GAIN · 效能增幅预估', x + 20, midBoxY + 16, 9.5, acc);
    mt('下一级暂无可预估的属性变化', x + 26, midBoxY + 52, 12, '#8fa0b5');
  } else if (o.hold && o.hold[1] <= 10) {
    // 仅针对药水展示限量刻度电池
    mt('// INVENTORY CAPACITY · 战备背包容量', x + 24, midBoxY + 16, 9.5, acc);
    mt(`当前存量: ${o.hold[0]} / ${o.hold[1]} 瓶`, x + 26, midBoxY + 40, 12, '#ffffff');
    const segs = o.hold[1], filled = o.hold[0];
    const segW = (w - 74) / segs;
    for (let s = 0; s < segs; s++) {
      const sx = x + 26 + s * (segW + 2);
      ctx.fillStyle = s < filled ? acc : 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(sx, midBoxY + 58, segW, 14);
      ctx.strokeStyle = s < filled ? '#ffffff88' : 'rgba(255, 255, 255, 0.14)';
      ctx.strokeRect(sx, midBoxY + 58, segW, 14);
    }
  } else {
    // 强化卷轴与普通材料：清爽展示无限堆叠库存卡，无上限且无错乱电池格
    mt('// STRATEGIC STOCK · 核心战备耗材库存', x + 24, midBoxY + 16, 9.5, acc);
    const holdCount = S.scr || 0;
    mt(`当前持有数量: ${holdCount.toLocaleString()} 张`, x + 26, midBoxY + 44, 14, '#ffffff');
    mt('★ 无持有上限 · 随身战备背包自动无限堆叠', x + 26, midBoxY + 68, 11, '#2ed573');
  }

  // 4. 资源预算提示
  const checkY = y + h - 74;
  const isTp = o.t && !o.g;
  const needVal = isTp ? (o.t || 0) : (o.g || 0);
  const curVal = isTp ? S.tp : S.g;
  const balanceStr = isTp 
    ? `当前天赋点: ${curVal} 点 (消耗 ${needVal} 点)`
    : `持有金币: ${curVal.toLocaleString()} G (消耗 ${needVal.toLocaleString()} G)`;
  mt(balanceStr, x + 16, checkY, 11, mOk(o) ? '#8fa0b5' : '#ff7675');

  // 5. 终极执行按钮（长按连续触发支持）
  const ok = mOk(o), by = y + h - 54, bw = w - 32, bh = 42;
  const btnLabel = o.max 
    ? '✔ 已达极值上限'
    : ok 
      ? `⚡ 立即${o.bt || '确认'} · ${mCost(o)}`
      : (S.g < (o.g || 0) ? '🔒 金币不足 · 无法研磨' : '🔒 天赋点不足 · 无法加点');

  mTechBtn(x + 16, by, bw, bh, btnLabel, o.max ? 'done' : ok ? 'main' : 'lack', acc, MN_HOLD.down, 14.5, 8);
  
  // 注册点击与长按开始
  mHit(x + 16, by, bw, bh, k, true, () => {
    mnDoExecute(k);
    mnStartHold(false);
  });
}

// ---------- 扭蛋系统逻辑 ----------
function mnGacha(it, th, backIdx) {
  const acc = th.acc, X = MN_X + 24, y0 = MN_Y + 88, H = 356, lw = 290, mx = X + lw / 2;

  // ---------- 左侧：胶囊展示台 ----------
  techCutBox(X, y0, lw, H, 12);
  const g = ctx.createLinearGradient(X, y0, X, y0 + H); g.addColorStop(0, acc + '2e'); g.addColorStop(1, 'rgba(255,255,255,.03)');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.stroke();

  ctx.save();
  techCutBox(X, y0, lw, H, 12); ctx.clip();
  const cy0 = y0 + 112;
  // 背后聚光
  const rg = ctx.createRadialGradient(mx, cy0, 6, mx, cy0, 150);
  rg.addColorStop(0, acc + '44'); rg.addColorStop(.55, acc + '14'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.fillRect(X, y0, lw, H);
  // 底部科技网格地台线
  ctx.strokeStyle = acc + '16'; ctx.lineWidth = 1;
  for (let k = 0; k < 6; k++) { const yy = y0 + H - 70 + k * 14; ctx.beginPath(); ctx.moveTo(X, yy); ctx.lineTo(X + lw, yy); ctx.stroke(); }
  // 旋转虚线环 + 内环
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = acc + '88'; ctx.setLineDash([3, 9]); ctx.lineDashOffset = -T * 14;
  ctx.beginPath(); ctx.arc(mx, cy0, 96, 0, 7); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(255,255,255,.10)';
  ctx.beginPath(); ctx.arc(mx, cy0, 74, 0, 7); ctx.stroke();
  // 环绕光点
  for (let k = 0; k < 8; k++) {
    const an = T * (k % 2 ? .45 : -.35) + k * .785, rr = 74 + (k % 3) * 11;
    const px = mx + Math.cos(an) * rr, py = cy0 + Math.sin(an) * rr * .86, pu = .55 + .45 * Math.sin(T * 3 + k * 1.7), sz = 2 + pu * 2.2;
    ctx.globalAlpha = .35 + pu * .55; ctx.fillStyle = k % 3 ? '#ffffff' : acc;
    ctx.beginPath(); ctx.moveTo(px, py - sz * 1.6); ctx.lineTo(px + sz, py); ctx.lineTo(px, py + sz * 1.6); ctx.lineTo(px - sz, py); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // 左上角小标签
  const lb = 'CAPSULE POOL', lbw = tw(lb, 9.5) + 18;
  techCutBox(X + 16, y0 + 14, lbw, 20, 4); ctx.fillStyle = acc + '22'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = acc + 'aa'; ctx.stroke();
  mt(lb, X + 16 + lbw / 2, y0 + 24.5, 9.5, acc, 'center');

  mCapsule(mx, cy0, acc, 1.2);

  // 标题 + 装饰分隔线
  mt('胶囊抽取终端', mx, y0 + 236, 20, '#fff', 'center');
  const ly = y0 + 256, lg = ctx.createLinearGradient(mx - 70, 0, mx + 70, 0);
  lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(.5, acc); lg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lg; ctx.fillRect(mx - 70, ly, 140, 1.5);
  mt('抽取假面骑士变身契约胶囊', mx, y0 + 276, 11.5, '#8fa2b8', 'center');

  if (MN.last) {
    const c = { new: 0, dup: 0, potion: 0, none: 0 }; MN.last.forEach(r => { c[r.k]++; });
    const s = [c.new && '新胶囊 ' + c.new, c.dup && '重复 ' + c.dup, c.potion && '药水 ' + c.potion, c.none && '未中 ' + c.none].filter(Boolean).join(' · ');
    const sw_ = tw('上次：' + s, 11) + 24;
    techCutBox(mx - sw_ / 2, y0 + H - 38, sw_, 24, 6); ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1; ctx.stroke();
    mt('上次：' + s, mx, y0 + H - 25.5, 11, '#c9d6e4', 'center');
  } else {
    mt('点击右上角 ? 查看奖池概率', mx, y0 + H - 25, 10.5, '#5f7088', 'center');
  }

  const qx = X + lw - 26, qy = y0 + 26, qs = V.i === 2;
  ctx.beginPath(); ctx.arc(qx, qy, 14, 0, 7); ctx.fillStyle = qs ? acc + '55' : 'rgba(255,255,255,.08)'; ctx.fill();
  ctx.lineWidth = qs ? 2 : 1.2; ctx.strokeStyle = qs ? '#fff' : acc; ctx.stroke();
  mt('?', qx, qy + .5, 15, '#fff', 'center');
  mHit(qx - 18, qy - 18, 36, 36, 2, true);

  // ---------- 右侧：单抽 / 十连 ----------
  const cx = X + lw + 14, cw = MN_W - 48 - lw - 14, gp = 12, ch = (H - gp) / 2;
  [[1, '单抽契约', 'SINGLE CONTRACT', '单次抽取契约胶囊', 0], [10, '十连契约', 'MULTI CONTRACT', '连续抽取 10 次，独立判定', 1]].forEach(([c, title, en, sub, idx]) => {
    const y = y0 + idx * (ch + gp), cost = GACHA_COST * c, ok = S.d >= cost, sel = V.i === idx;

    // 卡面底色：左亮右暗渐变
    techCutBox(cx, y, cw, ch, 10);
    const cg = ctx.createLinearGradient(cx, y, cx + cw, y + ch);
    cg.addColorStop(0, sel ? acc + '38' : 'rgba(20,28,50,.85)'); cg.addColorStop(1, sel ? 'rgba(10,14,28,.92)' : 'rgba(8,12,24,.85)');
    ctx.fillStyle = cg; ctx.fill();

    // 巨型数字水印 ×1 / ×10 与左侧亮条
    ctx.save(); techCutBox(cx, y, cw, ch, 10); ctx.clip();
    mt('×' + c, cx + cw - 12, y + ch - 34, 78, acc + (sel ? '1c' : '0e'), 'right');
    if (sel) { ctx.fillStyle = acc; ctx.fillRect(cx, y + 14, 4, ch - 28); }
    ctx.restore();

    // 描边（选中带发光）
    techCutBox(cx, y, cw, ch, 10);
    if (sel) { ctx.save(); ctx.shadowColor = acc; ctx.shadowBlur = 12; ctx.lineWidth = 1.8; ctx.strokeStyle = acc; ctx.stroke(); ctx.restore(); }
    else { ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1; ctx.stroke(); }

    mt(en, cx + 24, y + 24, 9.5, acc);
    mt(title, cx + 24, y + 48, 22, '#fff');
    mt(sub, cx + 24, y + 74, 11.5, '#8fa2b8');

    // 价格胶囊
    const ctxt = cost.toLocaleString() + ' 钻石', cwid = tw(ctxt, 16) + 58, cyy = y + ch - 46;
    techCutBox(cx + 22, cyy, cwid, 30, 6);
    ctx.fillStyle = 'rgba(4,8,18,.8)'; ctx.fill(); ctx.strokeStyle = ok ? 'rgba(95,224,255,.45)' : 'rgba(255,143,154,.5)'; ctx.lineWidth = 1; ctx.stroke();
    { const dx = cx + 40, dy = cyy + 15; if (!drawIco(ICO.d, dx, dy, 22)) { ctx.beginPath(); ctx.moveTo(dx, dy - 8); ctx.lineTo(dx + 7, dy - 1); ctx.lineTo(dx, dy + 8); ctx.lineTo(dx - 7, dy - 1); ctx.closePath(); ctx.fillStyle = '#5fe0ff'; ctx.fill(); } }   // Assets/Icon/Diamond.png，未加载时用矢量钻石兜底
    mt(ctxt, cx + 58, cyy + 15.5, 16, ok ? '#7fe9ff' : '#ff8f9a');

    const bw = 126, bh = 42, bx = cx + cw - 18 - bw, by = y + (ch - bh) / 2;
    mTechBtn(bx, by, bw, bh, ok ? '抽取 ×' + c : '钻石不足', ok ? 'main' : 'lack', acc, false, 15, 6);
    mHit(cx, y, cw, ch, idx, false, () => { V.i = idx; });
    mHit(bx, by, bw, bh, idx, true);
  });
}

function mCapsule(cx, cy, acc, k = 1) {
  const bob = Math.sin(T * 1.6) * 5, cw = 108, ch = 50;
  ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(sn(cx), cy + 58 * k, (42 - bob * .8) * k, 7 * k, 0, 0, 7); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(sn(cx), sn(cy + bob)); ctx.rotate(-.5 + Math.sin(T * 1.6) * .08); ctx.scale(k, k);
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

function mnRates(th) {
  const acc = th.acc, tb = gachaTable(), bx = MN_X + 60, by = MN_Y + 56, bw = MN_W - 120, bh = 376;
  MN.hit = []; mHit(0, 0, 960, 540, 0, false, () => { MN.rates = false; });
  techCutBox(bx, by, bw, bh, 14);
  const g = ctx.createLinearGradient(0, by, 0, by + bh); g.addColorStop(0, '#16213f'); g.addColorStop(1, '#0a1022');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.shadowColor = acc; ctx.shadowBlur = 18; ctx.lineWidth = 1.5; ctx.strokeStyle = acc; ctx.stroke(); ctx.restore();

  mt('奖池与概率', bx + 24, by + 30, 19, '#fff');
  mt('十连 = 连抽 10 次，每次独立判定', bx + 24, by + 54, 11.5, '#8fa2b8');
  ctx.beginPath(); ctx.arc(bx + bw - 30, by + 30, 13, 0, 7); ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.stroke();
  mt('✕', bx + bw - 30, by + 30.5, 12, '#fff', 'center');

  const rh = Math.min(46, Math.floor(196 / tb.length)), ry0 = by + 86;
  tb.forEach((e, i) => {
    const ry = ry0 + i * rh, cap = e.kind === 'cap', col = cap ? e.c.c : e.kind === 'potion' ? '#3fe08a' : '#7f8ea3';
    techCutBox(bx + 14, ry, bw - 28, rh - 6, 6); ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fill();
    ctx.beginPath(); ctx.arc(bx + 38, ry + (rh - 6) / 2, 12, 0, 7); ctx.fillStyle = col + '30'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = col; ctx.stroke();
    mt(cap ? e.c.rider[0] : e.kind === 'potion' ? '🧪' : '✕', bx + 38, ry + (rh - 6) / 2, cap ? 12 : 11, '#fff', 'center');
    const nm = cap ? e.c.name : e.kind === 'potion' ? '体力药水 ×1' : '谢谢惠顾', ty = ry + (rh - 6) / 2;
    mt(nm, bx + 62, ty, 14, cap ? e.c.c : '#e6ecf5');
    mt((Math.round(e.p * 10) / 10) + '%', bx + bw - 150, ty, 15, cap ? '#ffd84a' : '#c9d6e4', 'right');
    if (cap) { const has = S.caps.includes(e.c.id); mt(has ? '已拥有' : '未拥有', bx + bw - 24, ty, 11.5, has ? '#7dff9a' : '#8fa2b8', 'right'); }
  });
}

function mWrap(s, maxW, sz, maxLines) {
  ctx.font = poFont(sz); const out = []; let cur = '';
  for (const ch of String(s)) {
    if (cur && ctx.measureText(cur + ch).width > maxW) { out.push(cur); cur = ch; } else cur += ch;
  }
  if (cur) out.push(cur);
  if (out.length > maxLines) { out.length = maxLines; out[maxLines - 1] = out[maxLines - 1].slice(0, -1) + '…'; }
  return out;
}

// ---------- 入口统一调用 ----------
function drawV() {
  const dt = Math.min(0.05, Math.max(0, T - (MN._lastT || T)));
  MN._lastT = T;
  mnHoldUpdate(dt);

  const th = MN_THEME[V.pg] || MN_THEME.shop, it = items();
  let backIdx = it.length - 1;
  for (let k = it.length - 1; k >= 0; k--) if (it[k].nv && /返回/.test(it[k].n)) { backIdx = k; break; }
  MN.hit = [];

  const key = V.pg + ':' + G;
  if (MN.key !== key) {
    MN.key = key; MN.t0 = T; MN.lastG = S.g; MN.lastD = S.d; MN.lastTp = S.tp;
    MN.flashI = -1; MN.sc = MN.st = 0; MN.si = -1; MN.rates = false;
  }
  if (S.g < MN.lastG || S.d < MN.lastD || S.tp < MN.lastTp) { MN.flashT = T; MN.flashI = V.i; }
  MN.lastG = S.g; MN.lastD = S.d; MN.lastTp = S.tp;

  const e = Math.min(1, (T - MN.t0) / 0.18), ez = 1 - Math.pow(1 - e, 3);
  ctx.save();
  ctx.globalAlpha = ez;
  ctx.translate(480, 270);
  ctx.scale(0.965 + 0.035 * ez, 0.965 + 0.035 * ez);
  ctx.translate(-480, -270);

  mnFrame(th, backIdx);
  if (V.pg === 'gacha') {
    mnGacha(it, th, backIdx);
    if (MN.rates) mnRates(th);
  } else {
    mnList(it, th, backIdx);
  }
  ctx.restore();
}

function drawGachaSummary() {
  const g = gachaModal, res = g.res;
  if (g.t0 === undefined) g.t0 = T;
  const cols = Math.min(5, res.length), rows = Math.ceil(res.length / cols), TW = 150, TH = 146, GP = 14;
  const x0 = 480 - (cols * TW + (cols - 1) * GP) / 2, y0 = rows > 1 ? 74 : 150;
  ctx.save();
  ctx.fillStyle = 'rgba(4,6,14,.94)'; ctx.fillRect(0, 0, 960, 540);
  gaSparkles('#ffd84a');
  mt(res.length === 1 ? '抽取结果' : res.length + ' 连抽 · 结果', 480, 38, 24, '#ffd84a', 'center');
  res.forEach((r, i) => {
    const x = x0 + (i % cols) * (TW + GP), y = y0 + ((i / cols) | 0) * (TH + GP), a = cl((T - g.t0 - i * .07) / .25, 0, 1);
    if (a <= 0) return;
    const col = r.c ? r.c.c : r.k === 'potion' ? '#3fe08a' : '#7f8ea3', good = r.k === 'new';
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x + TW / 2, y + TH / 2); ctx.scale(.85 + .15 * a, .85 + .15 * a); ctx.translate(-x - TW / 2, -y - TH / 2);
    techCutBox(x, y, TW, TH, 10); ctx.fillStyle = good ? col + '22' : 'rgba(255,255,255,.05)'; ctx.fill();
    ctx.save(); if (good) { ctx.shadowColor = col; ctx.shadowBlur = 14; } ctx.lineWidth = good ? 2 : 1; ctx.strokeStyle = good ? col : 'rgba(255,255,255,.14)'; ctx.stroke(); ctx.restore();
    let nm, sub, sc;
    if (r.k === 'new') {
      const art = CAP_IMGS[r.c.id]; ctx.save(); techCutBox(x + 8, y + 8, TW - 16, 82, 8); ctx.clip();
      if (art) drawArt(art, x + 8, y + 8, TW - 16, 82); else { ctx.fillStyle = col + '44'; ctx.fillRect(x + 8, y + 8, TW - 16, 82); mt(r.c.rider, x + TW / 2, y + 49, 16, '#fff', 'center'); }
      ctx.restore();
      rpath(x + 12, y + 12, 38, 18, 9); ctx.fillStyle = '#ffd84a'; ctx.fill(); mt('NEW', x + 31, y + 21, 11, '#3a2a00', 'center');
      nm = r.c.short; sub = '新获得'; sc = '#ffd84a';
    } else if (r.k === 'dup') {
      ctx.beginPath(); ctx.arc(x + TW / 2, y + 48, 26, 0, 7); ctx.fillStyle = col + '22'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = col + '88'; ctx.stroke();
      mt(r.c.rider[0], x + TW / 2, y + 48, 20, '#ffffff88', 'center');
      nm = r.c.short; sub = '重复 · 无补偿'; sc = '#8fa2b8';
    } else if (r.k === 'potion') {
      mt('🧪', x + TW / 2, y + 48, 36, '#fff', 'center'); nm = '体力药水 ×1'; sub = r.full ? '背包已满 · 无效' : '已放入背包'; sc = r.full ? '#8fa2b8' : '#7dff9a';
    } else { mt('✕', x + TW / 2, y + 48, 32, '#5d6b7c', 'center'); nm = '未中'; sub = '谢谢惠顾'; sc = '#6f7f95'; }
    mt(nm, x + TW / 2, y + 108, 15, r.k === 'none' || r.k === 'dup' ? '#9fb0c4' : col === '#3fe08a' ? '#e6ecf5' : col, 'center');
    mt(sub, x + TW / 2, y + 129, 11, sc, 'center');
    ctx.restore();
  });
  const c = { new: 0, dup: 0, potion: 0, none: 0 }; res.forEach(r => { c[r.k]++; });
  const ty = y0 + rows * (TH + GP) + 8;
  mt('新胶囊 ' + c.new + ' · 重复 ' + c.dup + ' · 药水 ' + c.potion + ' · 未中 ' + c.none, 480, Math.min(ty, 452), 14, '#c9d6e4', 'center');
  techCutBox(360, 478, 240, 38, 10);
  const bgb = ctx.createLinearGradient(0, 478, 0, 516); bgb.addColorStop(0, '#ff5d73'); bgb.addColorStop(1, '#ff5d73aa');
  ctx.fillStyle = bgb; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.stroke();
  mt(gachaQ.length ? '查看新胶囊 (' + gachaQ.length + ')' : '确定 [Enter / 空格]', 480, 497, 15, '#fff', 'center');
  ctx.restore();
}

function drawGachaModalCore() {
  if (gachaModal.type === 'sum') { drawGachaSummary(); return; }
  const cap = CAPSULES.find(c => c.id === gachaModal.type) || CAPSULES[0], art = CAP_IMGS[cap.id];
  if (gachaModal.t0 === undefined) gachaModal.t0 = T;
  const e = Math.min(1, (T - gachaModal.t0) / .3), ez = 1 - Math.pow(1 - e, 3);
  ctx.save();
  ctx.fillStyle = 'rgba(4,6,14,.94)'; ctx.fillRect(0, 0, 960, 540);

  ctx.save(); ctx.translate(480, 215);
  for (let a = 0; a < 12; a++) {
    ctx.rotate(Math.PI / 6);
    ctx.fillStyle = (a % 2 === 0) ? cap.c + '16' : 'rgba(255,216,74,.05)';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 420, -.2 + T * .04, .2 + T * .04); ctx.fill();
  }
  ctx.restore();
  gaSparkles(cap.c);

  ctx.globalAlpha = ez; ctx.translate(480, 270); ctx.scale(.94 + .06 * ez, .94 + .06 * ez); ctx.translate(-480, -270);
  mt(gachaModal.isNew ? '获得新的变身胶囊' : '契约胶囊 · 结算卡面', 480, 36, 22, '#ffd84a', 'center');

  const iw = 520, ih = 293, ix = 480 - iw / 2, iy = 62;
  if (art) {
    ctx.save(); ctx.shadowColor = cap.c; ctx.shadowBlur = 30 + Math.sin(T * 4) * 8;
    techCutBox(ix, iy, iw, ih, 14); ctx.fillStyle = '#0a0f1c'; ctx.fill(); ctx.restore();
    ctx.save(); techCutBox(ix, iy, iw, ih, 14); ctx.clip(); drawArt(art, ix, iy, iw, ih); ctx.restore();
    techCutBox(ix, iy, iw, ih, 14); ctx.lineWidth = 2.5; ctx.strokeStyle = cap.c; ctx.stroke();
  }

  mt(cap.name, 480, 385, 26, cap.c, 'center');
  mt('KAMEN RIDER ' + cap.rider, 480, 411, 13, '#9fb0c4', 'center');
  const t1 = TIERS[cap.tier].n + '契约', t2 = cap.tag, w1 = tw(t1, 12) + 20, w2 = tw(t2, 12) + 20, gx = 480 - (w1 + w2 + 8) / 2;
  techCutBox(gx, 424, w1, 22, 6); ctx.fillStyle = TIERS[cap.tier].c + '2a'; ctx.fill(); ctx.strokeStyle = TIERS[cap.tier].c; ctx.lineWidth = 1; ctx.stroke();
  mt(t1, gx + w1 / 2, 435, 12, TIERS[cap.tier].c, 'center');
  techCutBox(gx + w1 + 8, 424, w2, 22, 6); ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.stroke();
  mt(t2, gx + w1 + 8 + w2 / 2, 435, 12, '#dfe6ee', 'center');
  mFit(cap.buff + ' · ' + cap.skill, 480, 461, 640, 12, '#c9d6e4', 'center');

  techCutBox(360, 478, 240, 38, 10);
  const bgc = ctx.createLinearGradient(0, 478, 0, 516); bgc.addColorStop(0, cap.c); bgc.addColorStop(1, cap.c + 'aa');
  ctx.fillStyle = bgc; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.stroke();
  mt('确定 [Enter / 空格]', 480, 497, 15, '#fff', 'center');
  mt('按【N】装配胶囊 · 战斗中按【P】变身', 480, 528, 11, '#6f7f95', 'center');
  ctx.restore();
}

const GA_DUR = 3.4, GA_SKIP_AFTER = .45;
const GA_PAL = [null,
  { a: '#4aa8ff', b: '#cfeaff' },
  { a: '#b05cff', b: '#ecd2ff' },
  { a: '#ffc233', b: '#fff4c2' }
];
let gachaFlash = null;
const gaRnd = i => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
const gaRgba = (h, a) => { const n = parseInt(h.slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')'; };
function gaRarity(r) { if (r.k === 'new' || r.k === 'dup') { const t = (r.c && r.c.tier) || 4; return t >= 4 ? 3 : t >= 3 ? 2 : 1; } return 1; }

function gachaAnimStart(res, nxt) {
  let best = 1, bc = null;
  res.forEach(r => {
    best = Math.max(best, gaRarity(r));
    if (r.c && (!bc || (r.k === 'new' && bc.k !== 'new'))) bc = r;
  });
  gachaModal = { type: 'anim', res, nxt, rar: best, col: bc ? bc.c.c : null, t0: T };
  gaSound('start', best);
}
function gachaAnimEnd() {
  const g = gachaModal;
  gachaModal = g.nxt || null;
  gachaFlash = { t0: T };
  gaSound('reveal', g.rar);
}

let GA_AC = null;
function gaSound(kind, q) {
  try {
    GA_AC = GA_AC || new (window.AudioContext || window.webkitAudioContext)();
    const ac = GA_AC; if (ac.state === 'suspended') ac.resume();
    const now = ac.currentTime, out = ac.createGain(); out.gain.value = .45; out.connect(ac.destination);
    const tone = (f0, f1, t0, d, type, v) => {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = type;
      o.frequency.setValueAtTime(f0, now + t0); o.frequency.exponentialRampToValueAtTime(f1, now + t0 + d);
      g.gain.setValueAtTime(.0001, now + t0); g.gain.exponentialRampToValueAtTime(v, now + t0 + .02); g.gain.exponentialRampToValueAtTime(.0001, now + t0 + d);
      o.connect(g); g.connect(out); o.start(now + t0); o.stop(now + t0 + d + .05);
    };
    const noise = (t0, d, f0, f1, v) => {
      const len = Math.max(1, ac.sampleRate * d | 0), buf = ac.createBuffer(1, len, ac.sampleRate), ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
      const s = ac.createBufferSource(); s.buffer = buf;
      const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
      f.frequency.setValueAtTime(f0, now + t0); f.frequency.exponentialRampToValueAtTime(f1, now + t0 + d);
      const g = ac.createGain(); g.gain.setValueAtTime(.0001, now + t0); g.gain.exponentialRampToValueAtTime(v, now + t0 + d * .8); g.gain.exponentialRampToValueAtTime(.0001, now + t0 + d);
      s.connect(f); f.connect(g); g.connect(out); s.start(now + t0); s.stop(now + t0 + d + .05);
    };
    if (kind === 'start') { noise(.3, 1.15, 300, 4200, .5); tone(180, 900, .3, 1.15, 'sawtooth', .05); }
    else if (kind === 'hit') { tone(150, 32, 0, .6, 'sine', .9); noise(0, .35, 2400, 200, .6); if (q === 3) tone(880, 1320, 0, .5, 'triangle', .12); }
    else if (kind === 'burst') { noise(0, .5, 600, 7000, .6); tone(300, 1200, 0, .35, 'triangle', .2); }
    else if (kind === 'reveal') {
      const ns = q === 3 ? [784, 988, 1175, 1568, 1976] : q === 2 ? [659, 784, 988, 1319] : [523, 659, 784];
      ns.forEach((f, i) => tone(f, f, i * .07, .8, 'triangle', .16));
    }
  } catch (e) { }
}

function gaSparkles(col) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 46; i++) {
    const sp = 22 + gaRnd(i) * 50, x = gaRnd(i + 99) * 960 + Math.sin(T * .8 + i) * 14;
    const y = 560 - ((T * sp + gaRnd(i + 7) * 700) % 620), s = 1.5 + gaRnd(i + 33) * 3;
    ctx.fillStyle = gaRgba(i % 3 ? col : '#ffe9a0', .15 + .6 * Math.abs(Math.sin(T * 2.4 + i)));
    ctx.fillRect(x, y, s, s);
  }
  ctx.restore();
}

function drawGachaAnim() {
  const g = gachaModal, t = T - g.t0, pal = GA_PAL[g.rar], A = pal.a, B = pal.b, n = g.res.length;
  const CX = 480, CY = 262, HIT = 1.45, BURST = 3.0, rnd = gaRnd;
  const LT = () => { ctx.globalCompositeOperation = 'lighter'; }, NM = () => { ctx.globalCompositeOperation = 'source-over'; };
  if (t > HIT && !g.hit) { g.hit = 1; gaSound('hit', g.rar); }
  if (t > BURST && !g.bst) { g.bst = 1; gaSound('burst', g.rar); }

  ctx.save();
  if (t > HIT && t < HIT + .55) { const k = (1 - (t - HIT) / .55) * 10; ctx.translate(Math.sin(t * 95) * k, Math.cos(t * 83) * k); }

  ctx.fillStyle = '#03040a'; ctx.fillRect(-30, -30, 1020, 600);
  const bgA = t < HIT ? 0 : Math.min(1, (t - HIT) / .5);
  { const rg = ctx.createRadialGradient(CX, CY, 0, CX, CY, 520); rg.addColorStop(0, gaRgba(A, .08 + .4 * bgA)); rg.addColorStop(.5, gaRgba(A, .03 + .12 * bgA)); rg.addColorStop(1, gaRgba(A, 0)); ctx.fillStyle = rg; ctx.fillRect(-30, -30, 1020, 600); }

  LT();
  for (let i = 0; i < 80; i++) {
    const x = rnd(i) * 960, y = (rnd(i + 200) * 540 + t * (6 + rnd(i + 50) * 18)) % 540, r = .7 + rnd(i + 90) * 1.5;
    ctx.fillStyle = 'rgba(255,255,255,' + (.12 + .45 * Math.abs(Math.sin(t * 2 + i))).toFixed(3) + ')'; ctx.fillRect(x, y, r, r);
  }

  { const ca = Math.min(1, t / .8) * (t < BURST ? 1 : Math.max(0, 1 - (t - BURST) / .2));
    ctx.save(); ctx.translate(CX, CY + 118); ctx.scale(1, .28); ctx.lineWidth = 3;
    [[210, .4, [14, 10]], [150, -.7, [4, 12]], [262, .2, [30, 16]]].forEach(([r, sp, dash]) => {
      ctx.save(); ctx.rotate(t * sp); ctx.setLineDash(dash); ctx.strokeStyle = gaRgba(A, .55 * ca * (1 + bgA * .6));
      ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke(); ctx.restore();
    });
    ctx.restore(); }

  const meteor = (sx, sy, ex, ey, u, w, col, col2, L) => {
    if (u <= 0 || u >= 1) return;
    const dx = ex - sx, dy = ey - sy, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d, px = -uy, py = ux, k = Math.pow(u, 2.2);
    const hx = sx + dx * k, hy = sy + dy * k, len = L * Math.min(1, u * 3), tx = hx - ux * len, ty = hy - uy * len;
    const gr = ctx.createLinearGradient(hx, hy, tx, ty); gr.addColorStop(0, gaRgba(col2, .95)); gr.addColorStop(.35, gaRgba(col, .6)); gr.addColorStop(1, gaRgba(col, 0));
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(hx + px * w, hy + py * w); ctx.lineTo(hx - px * w, hy - py * w); ctx.lineTo(tx, ty); ctx.closePath(); ctx.fill();
    const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, w * 5); hg.addColorStop(0, 'rgba(255,255,255,.95)'); hg.addColorStop(.25, gaRgba(col2, .8)); hg.addColorStop(1, gaRgba(col, 0));
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(hx, hy, w * 5, 0, 7); ctx.fill();
    const fr = Math.floor(t * 30);
    for (let i = 0; i < 10; i++) {
      const f = i / 10, off = (rnd(i * 7 + fr) - .5) * w * 4;
      ctx.fillStyle = gaRgba(col2, (1 - f) * .9); ctx.fillRect(hx - ux * len * f * .9 + px * off, hy - uy * len * f * .9 + py * off, 3, 3);
    }
  };
  if (t < HIT + .1) {
    for (let i = 1; i < n; i++) {
      const q = GA_PAL[gaRarity(g.res[i])], a = rnd(i * 5) * 6.283;
      meteor(CX + Math.cos(a) * 760, CY + Math.sin(a) * 620, CX + (rnd(i + 1) - .5) * 40, CY + (rnd(i + 2) - .5) * 40, (t - .2 - i * .015) / 1.25, 6, q.a, q.b, 260);
    }
    meteor(-80, -60, CX, CY, (t - .3) / 1.15, 14, A, B, 430);
  }

  if (t >= HIT) {
    const d = t - HIT, fade = t < BURST ? 1 : Math.max(0, 1 - (t - BURST) / .15);
    ctx.save(); ctx.translate(CX, CY); ctx.rotate(t * .25);
    for (let i = 0; i < 14; i++) {
      ctx.rotate(Math.PI * 2 / 14); const L = (i % 2 ? 300 : 480) * Math.min(1, d / .4);
      ctx.fillStyle = gaRgba(i % 2 ? B : A, .22 * Math.min(1, d / .25) * fade);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L, -18); ctx.lineTo(L, 18); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    for (let i = 0; i < 3; i++) {
      const r = (d - i * .1) * 1100; if (r <= 0) continue;
      ctx.strokeStyle = i ? gaRgba(A, Math.max(0, 1 - r / 900) * .8) : 'rgba(255,255,255,' + (Math.max(0, 1 - r / 900) * .8).toFixed(3) + ')';
      ctx.lineWidth = 14 - i * 4; ctx.beginPath(); ctx.arc(CX, CY, r, 0, 7); ctx.stroke();
    }
    for (let i = 0; i < 70; i++) {
      const a = rnd(i + 300) * 6.283, sp = 150 + rnd(i + 400) * 520, life = .6 + rnd(i + 500) * .9; if (d > life) continue;
      const s = 2 + rnd(i + 600) * 3.5;
      ctx.fillStyle = gaRgba(i % 3 ? A : B, 1 - d / life);
      ctx.fillRect(CX + Math.cos(a) * sp * d - s / 2, CY + Math.sin(a) * sp * d + 260 * d * d - s / 2, s, s);
    }
    if (g.rar === 3 && d < .9) {
      const k = 1 - d / .9; ctx.save(); ctx.translate(CX, CY); ctx.scale(1, .035 + .02 * k);
      const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 520); rg.addColorStop(0, 'rgba(255,255,255,' + (.9 * k).toFixed(3) + ')'); rg.addColorStop(.3, gaRgba(B, .5 * k)); rg.addColorStop(1, gaRgba(A, 0));
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, 520, 0, 7); ctx.fill(); ctx.restore();
    }
  }

  if (t >= HIT && t < BURST) {
    const d = t - HIT, x1 = Math.min(1, d / .4) - 1, eb = 1 + 2.70158 * x1 * x1 * x1 + 1.70158 * x1 * x1;
    const charge = cl((t - 1.85) / 1.15, 0, 1), jit = charge * charge * 5;
    const R = 74 * eb * (1 + Math.sin(t * 10) * .02 * (1 + charge * 2)), bx = CX + Math.sin(t * 70) * jit, by = CY + Math.cos(t * 63) * jit, cc = g.col || A;

    LT();
    if (t > 1.7) for (let i = 0; i < 30; i++) {
      const ph = (t * 1.2 + rnd(i)) % 1, r = (1 - ph) * 320 + R, a = rnd(i + 30) * 6.283 + t * .8;
      ctx.fillStyle = gaRgba(i % 2 ? B : A, ph); ctx.fillRect(bx + Math.cos(a) * r - 1.5, by + Math.sin(a) * r - 1.5, 3, 3);
    }
    { const gr = ctx.createRadialGradient(bx, by, R * .5, bx, by, R * (2.4 + charge * 1.2)); gr.addColorStop(0, gaRgba(A, .55)); gr.addColorStop(1, gaRgba(A, 0)); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(bx, by, R * (2.4 + charge * 1.2), 0, 7); ctx.fill(); }

    NM();
    { const rg = ctx.createRadialGradient(bx - R * .3, by - R * .35, R * .05, bx, by, R);
      rg.addColorStop(0, 'rgba(255,255,255,.95)'); rg.addColorStop(.25, gaRgba(B, .55)); rg.addColorStop(.7, gaRgba(cc, .38)); rg.addColorStop(1, gaRgba(A, .75));
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(bx, by, R, 0, 7); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(bx - R * .35, by - R * .5, R * .28, R * .12, -.6, 0, 7); ctx.fill(); }
    LT();
    { const cr = R * .6 * (.6 + charge * .8), cg = ctx.createRadialGradient(bx, by, 0, bx, by, cr); cg.addColorStop(0, 'rgba(255,255,255,' + (.5 + charge * .5).toFixed(3) + ')'); cg.addColorStop(1, gaRgba(cc, 0)); ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(bx, by, cr, 0, 7); ctx.fill(); }
    ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.strokeStyle = gaRgba(B, .9);
    ctx.beginPath(); ctx.arc(bx, by, R + 16, -Math.PI / 2, -Math.PI / 2 + charge * 6.283); ctx.stroke();
    if (t > 2.7) {
      const ck = cl((t - 2.7) / .3, 0, 1); ctx.strokeStyle = 'rgba(255,255,255,' + ck.toFixed(3) + ')'; ctx.lineWidth = 2.5;
      for (let i = 0; i < 7; i++) {
        let a = i * .897 + .3, px = bx, py = by; ctx.beginPath(); ctx.moveTo(px, py);
        for (let j = 0; j < 4; j++) { a += (rnd(i * 9 + j) - .5) * .9; px += Math.cos(a) * R * ck * .27; py += Math.sin(a) * R * ck * .27; ctx.lineTo(px, py); }
        ctx.stroke();
      }
    }
  }

  if (t >= BURST) {
    const d2 = t - BURST; LT();
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * 6.283 + rnd(i) * .3, r = 90 + d2 * 700 * (.6 + rnd(i + 5) * .8), s = 16 + rnd(i + 9) * 18;
      ctx.save(); ctx.translate(CX + Math.cos(a) * r, CY + Math.sin(a) * r); ctx.rotate(a + d2 * 6); ctx.fillStyle = gaRgba(i % 2 ? B : A, Math.max(0, 1 - d2 / .35));
      ctx.beginPath(); ctx.moveTo(-s, -s * .4); ctx.lineTo(s, 0); ctx.lineTo(-s, s * .4); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }
  NM();
  { const wa = cl((t - 2.95) / .2, 0, 1); if (wa > 0) { ctx.fillStyle = 'rgba(255,255,255,' + wa.toFixed(3) + ')'; ctx.fillRect(-30, -30, 1020, 600); } }
  ctx.restore();

  if (t > GA_SKIP_AFTER && t < BURST) mt(TOUCH ? '点击跳过 ▶▶' : 'Enter / 点击 跳过 ▶▶', 940, 520, 12, 'rgba(255,255,255,.45)', 'right');
}

function drawGachaModalOverlay() {
  if (gachaModal.type === 'anim') { drawGachaAnim(); return; }
  drawGachaModalCore();
  if (gachaFlash) {
    const a = 1 - (T - gachaFlash.t0) / .5;
    if (a <= 0) gachaFlash = null;
    else { ctx.save(); ctx.fillStyle = 'rgba(255,255,255,' + (a * a).toFixed(3) + ')'; ctx.fillRect(0, 0, 960, 540); ctx.restore(); }
  }
}