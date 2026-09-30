// ===== 维度传送门：模式选择 / 副本（章节战役）/ 世界BOSS =====
// 结构：hub（选模式）→ dun（副本）或 wb（世界BOSS）。所有可点击区域在绘制时登记到 PO.hit，点击时统一命中判断。
const NST = CHAPTERS.reduce((a, c) => a + c.stages.length, 0);      // 章节关卡总数
const POX = 40, POY = 22, POW = 880, POH = 496;                     // 面板位置尺寸
const PO = { view: 'hub', hub: 0, wb: 0, ret: 'hub', cp: 0, toast: '', tt: 0, hit: [] };
let curChapIdx = 0, selStageIdx = 0;

const WB_COL = '#ff4d4d';
const poN = n => { n = Math.round(n || 0); return n >= 1e8 ? +(n / 1e8).toFixed(2) + '亿' : n >= 1e4 ? +(n / 1e4).toFixed(1) + '万' : String(n) };
const poFont = sz => `700 ${sz}px -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif`;
const tw = (s, sz) => { ctx.font = poFont(sz); return ctx.measureText(String(s)).width };
const pToast = s => { PO.toast = s; PO.tt = 2 };
const pHit = (x, y, w, h, f) => PO.hit.push({ x, y, w, h, f });

// ---------- 数据 ----------
function wbData() {
  const d = new Date(), day = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  if (!S.wb || typeof S.wb !== 'object') S.wb = { day, used: 0, best: {}, kills: {} };
  if (!S.wb.best) S.wb.best = {};
  if (!S.wb.kills) S.wb.kills = {};
  if (S.wb.day !== day) { S.wb.day = day; S.wb.used = 0 }
  return S.wb;
}
const wbLeft = () => Math.max(0, WB_DAILY - wbData().used);
const wbOpen = w => S.lv >= w.lv;

const chapUnlocked = i => CHAPTERS[i].stages[0] <= S.cl;
const chapCleared = i => CHAPTERS[i].stages.every(s => s < S.cl);
const chapDone = i => CHAPTERS[i].stages.filter(s => s < S.cl).length;
function getHighestChapterIdx() {
  const maxStage = Math.min(NST - 1, S.cl);
  for (let i = CHAPTERS.length - 1; i >= 0; i--) if (CHAPTERS[i].stages.some(idx => idx <= maxStage)) return i;
  return 0;
}
function pickStage() {
  const st = CHAPTERS[curChapIdx].stages, av = st.filter(s => s <= S.cl);
  selStageIdx = av.length ? av[av.length - 1] : st[0];
}
function setChap(i) {
  if (i < 0 || i >= CHAPTERS.length) return;
  if (!chapUnlocked(i)) return pToast('该章节尚未解锁，请先通关上一章节');
  curChapIdx = i; pickStage();
}

// ---------- 入口 / 动作 ----------
function openPortal(ret) {
  RM = PG; V.pg = 'st'; M = 1;
  PO.view = ret ? PO.ret : 'hub';
  PO.hub = PO.view === 'wb' ? 1 : 0;
  curChapIdx = getHighestChapterIdx(); pickStage(); PO.cp = curChapIdx;
  wbData();
  let bi = 0; WB.forEach((w, i) => { if (wbOpen(w)) bi = i });
  PO.wb = bi; PO.tt = 0;
}
const pBack = () => { if (PO.view === 'hub') M = 0; else PO.view = 'hub' };
function pStartStage(idx) {
  if (idx > S.cl) return pToast('该关卡尚未解锁');
  PO.ret = 'dun'; M = 0; begin(idx);
}
function pStartWB() {
  const w = WB[PO.wb];
  if (!wbOpen(w)) return pToast('需要 Lv.' + w.lv + ' 才能挑战该首领');
  const D = wbData();
  if (D.used >= WB_DAILY) return pToast('今日讨伐次数已用完，明日重置');
  D.used++; save();
  PO.ret = 'wb'; M = 0; begin(w.si);
}

// ---------- 输入 ----------
function portalUpdate(dt) {
  PO.tt -= dt;
  PO.cp += (curChapIdx - PO.cp) * Math.min(1, dt * 12);
  const L = PR.KeyA || PR.ArrowLeft, R = PR.KeyD || PR.ArrowRight, U = PR.KeyW || PR.ArrowUp, D = PR.KeyS || PR.ArrowDown;
  const OK = PR.Enter || PR.Space || PR.KeyF;

  if (PR.Escape) { pBack(); delete PR.Escape; return }

  if (PO.view === 'hub') {
    if (L) PO.hub = 0; if (R) PO.hub = 1;
    if (OK) { PO.view = PO.hub ? 'wb' : 'dun' }
    return;
  }
  if (PO.view === 'dun') {
    if (L) setChap(curChapIdx - 1);
    if (R) setChap(curChapIdx + 1);
    const st = CHAPTERS[curChapIdx].stages; let p = st.indexOf(selStageIdx); if (p < 0) p = 0;
    if (U && p > 0) selStageIdx = st[p - 1];
    if (D && p < st.length - 1) selStageIdx = st[p + 1];
    if (OK) pStartStage(selStageIdx);
    return;
  }
  if (U || L) PO.wb = Math.max(0, PO.wb - 1);
  if (D || R) PO.wb = Math.min(WB.length - 1, PO.wb + 1);
  if (OK) pStartWB();
}

function portalClick(x, y) {
  for (let i = PO.hit.length - 1; i >= 0; i--) {
    const r = PO.hit[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { r.f(); return }
  }
  if (x < POX || x > POX + POW || y < POY || y > POY + POH) M = 0;
}

// ---------- 绘制工具 ----------
function pBtn(x, y, w, h, label, o, f) {
  o = o || {}; const c = o.c || '#00e5ff', sz = o.sz || 13;
  rpath(x, y, w, h, 10);
  if (o.dis) {
    ctx.fillStyle = 'rgba(50,60,80,.5)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 1; ctx.stroke();
    txt(label, x + w / 2, y + h / 2, sz, '#778', 'center');
  } else if (o.ghost) {
    ctx.fillStyle = c + '2e'; ctx.fill(); ctx.strokeStyle = c; ctx.lineWidth = 1.2; ctx.stroke();
    txt(label, x + w / 2, y + h / 2, sz, '#fff', 'center');
  } else {
    const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, c); g.addColorStop(1, c + 'bb');
    ctx.save(); ctx.shadowColor = c; ctx.shadowBlur = 8 + 5 * Math.sin(T * 4); ctx.fillStyle = g; ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.2; ctx.stroke();
    txt(label, x + w / 2, y + h / 2, sz, '#fff', 'center');
  }
  if (f) pHit(x, y, w, h, f);
}

function pPill(x, y, w, h, fill, stroke) {
  rpath(x, y, w, h, h / 2); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.lineWidth = 1; ctx.strokeStyle = stroke; ctx.stroke() }
}

function poFrame(acc, title) {
  ctx.fillStyle = 'rgba(3,5,14,.9)'; ctx.fillRect(0, 0, 960, 540);
  ctx.fillStyle = acc;
  for (let i = 0; i < 16; i++) {                       // 漂浮光点
    const x = (i * 173 + T * (8 + i % 4 * 5)) % 980 - 10, y = 560 - (i * 97 + T * (14 + i % 3 * 8)) % 580;
    ctx.globalAlpha = .12 + .12 * Math.sin(T * 2 + i); ctx.beginPath(); ctx.arc(x, y, 1.5 + i % 3, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  rpath(POX, POY, POW, POH, 20);
  const g = ctx.createLinearGradient(0, POY, 0, POY + POH); g.addColorStop(0, '#0e1730'); g.addColorStop(1, '#070b16');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.shadowColor = acc; ctx.shadowBlur = 20; ctx.lineWidth = 2; ctx.strokeStyle = acc; ctx.stroke(); ctx.restore();
  ctx.save(); rpath(POX, POY, POW, POH, 20); ctx.clip();  // 头部渐变条
  const hg = ctx.createLinearGradient(POX, 0, POX + POW, 0); hg.addColorStop(0, acc + '55'); hg.addColorStop(1, acc + '0d');
  ctx.fillStyle = hg; ctx.fillRect(POX, POY, POW, 50);
  ctx.fillStyle = acc + '88'; ctx.fillRect(POX, POY + 50, POW, 1.5);
  ctx.restore();
  txt(title, POX + 26, POY + 26, 18, '#fff');
  const gd = '🪙 ' + S.g.toLocaleString(), lv = 'Lv.' + S.lv;
  const gw = tw(gd, 13) + 24, lw = tw(lv, 13) + 24, ry = POY + 13;
  pPill(POX + POW - 20 - gw, ry, gw, 24, 'rgba(255,216,74,.14)', '#ffd84a88'); txt(gd, POX + POW - 20 - gw / 2, ry + 12, 13, '#ffd84a', 'center');
  pPill(POX + POW - 28 - gw - lw, ry, lw, 24, 'rgba(125,255,154,.12)', '#7dff9a88'); txt(lv, POX + POW - 28 - gw - lw / 2, ry + 12, 13, '#7dff9a', 'center');
}

function poFooter(acc, hint, main) {
  const y = POY + POH - 56;
  rpath(POX + 14, y - 4, POW - 28, 48, 12); ctx.fillStyle = 'rgba(6,10,22,.85)'; ctx.fill(); ctx.strokeStyle = acc + '44'; ctx.lineWidth = 1; ctx.stroke();
  pBtn(POX + 24, y, 156, 40, PO.view === 'hub' ? '← 返回基地 [ESC]' : '← 返回选择 [ESC]', { c: '#ff4757', ghost: true, sz: 12 }, pBack);
  txt(hint, 480, y + 20, 12, '#889', 'center');
  if (main) pBtn(POX + POW - 24 - 200, y, 200, 40, main.label, { c: main.c, dis: main.dis, sz: 14 }, main.f);
}

// ---------- 模式选择 ----------
function poHubCard(x, y, w, h, idx, o) {
  const sel = PO.hub === idx, cy0 = sel ? y - 4 : y, ix = x + w / 2, iy = cy0 + 88;
  ctx.save();
  if (!sel) ctx.globalAlpha = .82;
  rpath(x, cy0, w, h, 18);
  const g = ctx.createLinearGradient(x, cy0, x + w, cy0 + h); g.addColorStop(0, o.c + (sel ? '55' : '2a')); g.addColorStop(.6, '#0b1122'); g.addColorStop(1, '#080c18');
  ctx.fillStyle = g; ctx.fill();
  if (sel) { ctx.save(); ctx.shadowColor = o.c; ctx.shadowBlur = 22; ctx.lineWidth = 2.5; ctx.strokeStyle = o.c; ctx.stroke(); ctx.restore() }
  else { ctx.lineWidth = 1.2; ctx.strokeStyle = o.c + '77'; ctx.stroke() }
  ctx.lineWidth = 2; ctx.strokeStyle = o.c + 'aa'; ctx.setLineDash([6, 8]); ctx.lineDashOffset = -T * 16;   // 旋转法阵
  ctx.beginPath(); ctx.arc(ix, iy, 58, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(ix, iy, 46, 0, 7);
  const rg = ctx.createRadialGradient(ix, iy, 6, ix, iy, 46); rg.addColorStop(0, o.c + '66'); rg.addColorStop(1, o.c + '0d');
  ctx.fillStyle = rg; ctx.fill(); ctx.strokeStyle = o.c; ctx.lineWidth = 1.5; ctx.stroke();
  txt(o.icon, ix, iy + 2, 44, '#fff', 'center', false);
  txt(o.en, ix, cy0 + 160, 11, o.c, 'center');
  txt(o.title, ix, cy0 + 186, 28, '#fff', 'center');
  txt(o.d1, ix, cy0 + 216, 12, '#b4c2d8', 'center');
  txt(o.d2, ix, cy0 + 234, 12, '#8ea0bb', 'center');
  o.status(x + 28, cy0 + 262, w - 56);
  const by = cy0 + h - 46;
  rpath(x + 18, by, w - 36, 34, 10);
  if (sel) { const bg = ctx.createLinearGradient(x, by, x + w, by); bg.addColorStop(0, o.c); bg.addColorStop(1, o.c + '88'); ctx.fillStyle = bg; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.2; ctx.stroke() }
  else { ctx.fillStyle = o.c + '22'; ctx.fill(); ctx.strokeStyle = o.c + '66'; ctx.lineWidth = 1; ctx.stroke() }
  txt('▶ 进入' + o.title, ix, by + 17, 14, '#fff', 'center');
  ctx.restore();
  pHit(x, y - 4, w, h + 4, () => { PO.hub = idx; PO.view = idx ? 'wb' : 'dun' });
}

function drawPoHub() {
  poFrame('#00e5ff', '🌌 维度传送门 · 选择出征模式');
  const cw = 396, ch = 340, cy = POY + 68, x1 = POX + 36, x2 = POX + POW - 36 - cw;
  poHubCard(x1, cy, cw, ch, 0, {
    c: '#00e5ff', icon: '⚔️', en: 'DUNGEON', title: '副本',
    d1: '10 大章 · 30 个关卡 · 章节首领讨伐', d2: '稳步成长，解锁更高阶的装备产出',
    status(sx, sy, sw) {
      const c = Math.min(S.cl, NST);
      txt('通关进度', sx, sy, 12, '#9ab'); txt(c + ' / ' + NST, sx + sw, sy, 12, '#ffd84a', 'right');
      bar(sx, sy + 14, sw, 8, c, NST, '#00e5ff', '#7df9ff', 4);
    }
  });
  poHubCard(x2, cy, cw, ch, 1, {
    c: WB_COL, icon: '👹', en: 'WORLD BOSS', title: '世界BOSS',
    d1: '限时挑战巨型首领 · 伤害越高奖励越丰厚', d2: '击杀必掉高阶装备与大量强化卷轴',
    status(sx, sy, sw) {
      const n = WB.filter(wbOpen).length, left = wbLeft();
      txt('今日剩余讨伐', sx, sy, 12, '#9ab');
      txt(left + ' / ' + WB_DAILY + '  ·  已开放 ' + n + '/' + WB.length, sx + sw, sy, 12, left ? '#ffd84a' : '#ff6b6b', 'right');
      bar(sx, sy + 14, sw, 8, left, WB_DAILY, '#ff4757', '#ff9f43', 4);
    }
  });
  poFooter('#00e5ff', 'A/D 选择模式   Enter 进入', null);
}

// ---------- 副本 ----------
const poRel = r => S.lv >= r ? ['实力充足', '#7dff9a'] : S.lv >= r - 5 ? ['势均力敌', '#ffd84a'] : ['危险', '#ff6b6b'];

function poChapterCard(i, cx, cy, sc, al, sel) {
  const ch = CHAPTERS[i], un = chapUnlocked(i), cd = chapCleared(i), done = chapDone(i), col = ch.col;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.globalAlpha = al * (un ? 1 : .55);
  rpath(-150, -54, 300, 108, 14);
  const g = ctx.createLinearGradient(-150, -54, 150, 54); g.addColorStop(0, col + (sel ? '88' : '44')); g.addColorStop(1, '#0a1020');
  ctx.fillStyle = g; ctx.fill();
  if (sel) { ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 18; ctx.lineWidth = 2.5; ctx.strokeStyle = col; ctx.stroke(); ctx.restore() }
  else { ctx.lineWidth = 1.2; ctx.strokeStyle = col + '88'; ctx.stroke() }
  txt(String(i + 1).padStart(2, '0'), 140, 14, 70, col + '30', 'right', false);
  txt(ch.name, -134, -32, 12, col);
  txt(ch.title, -134, -6, 25, un ? '#fff' : '#9aa');
  txt(ch.sub, -134, 22, 11, '#a9b8cc');
  for (let j = 0; j < ch.stages.length; j++) {
    ctx.beginPath(); ctx.arc(-128 + j * 16, 42, 5, 0, 7); ctx.fillStyle = j < done ? col : 'rgba(255,255,255,.08)'; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = col + '99'; ctx.stroke();
  }
  txt(!un ? '🔒 未解锁' : cd ? '✔ 已通关' : '挑战中', 136, -32, 12, !un ? '#889' : cd ? '#2ed573' : '#ffd84a', 'right');
  ctx.restore();
}

function poArrow(x, y, dir, en, acc, f) {
  rpath(x, y, 30, 64, 10); ctx.fillStyle = en ? acc + '2e' : 'rgba(255,255,255,.05)'; ctx.fill();
  ctx.lineWidth = 1.2; ctx.strokeStyle = en ? acc : '#333'; ctx.stroke();
  txt(dir < 0 ? '◀' : '▶', x + 15, y + 32, 14, en ? '#fff' : '#555', 'center');
  pHit(x, y, 30, 64, f);
}

function poStageCard(s, idx, y, acc) {
  const x = POX + 28, w = POW - 56, h = 62, sel = idx === selStageIdx, un = idx <= S.cl, cd = idx < S.cl;
  rpath(x, y, w, h, 12);
  if (sel) { const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, acc + '40'); g.addColorStop(1, acc + '10'); ctx.fillStyle = g }
  else ctx.fillStyle = 'rgba(12,18,34,.8)';
  ctx.fill();
  if (sel) { ctx.save(); ctx.shadowColor = acc; ctx.shadowBlur = 10; ctx.lineWidth = 2; ctx.strokeStyle = acc; ctx.stroke(); ctx.restore() }
  else { ctx.lineWidth = 1; ctx.strokeStyle = un ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.06)'; ctx.stroke() }
  pHit(x, y, w, h, () => { if (!un) pToast('请先通关前置关卡'); else if (sel) pStartStage(idx); else selStageIdx = idx });

  const bx = x + 40, by = y + h / 2;                               // 编号徽章
  ctx.beginPath(); ctx.arc(bx, by, 22, 0, 7);
  ctx.fillStyle = sel ? acc + '44' : un ? 'rgba(255,216,74,.12)' : 'rgba(30,36,50,.8)'; ctx.fill();
  ctx.lineWidth = 1.6; ctx.strokeStyle = sel ? acc : un ? '#ffd84a' : '#555'; ctx.stroke();
  txt(s.n.split(' ')[0], bx, by, 13, un ? '#ffd84a' : '#777', 'center');

  const name = s.n.replace(/^\S+\s*/, ''), nx = x + 78;
  txt(name, nx, y + 22, 16, un ? (sel ? '#ffd84a' : '#fff') : '#666');
  if (s.b) { const px = nx + tw(name, 16) + 10; pPill(px, y + 13, 64, 18, un ? 'rgba(255,71,87,.22)' : 'rgba(80,80,90,.3)', un ? '#ff4757' : '#555'); txt('★ 首领战', px + 32, y + 22, 11, un ? '#ff8a95' : '#666', 'center') }
  txt('目标：击败 ' + s.k + ' 只敌人' + (s.b ? '，讨伐 [' + s.bn + ']' : ''), nx, y + 44, 11.5, un ? '#9fb0c6' : '#555');

  const mx = x + 430, rel = poRel(s.r);
  txt('推荐 Lv.' + s.r, mx, y + 22, 13, un ? rel[1] : '#555');
  if (un) txt(rel[0], mx + tw('推荐 Lv.' + s.r, 13) + 8, y + 22, 11, rel[1]);
  txt('装备产出 ≤ Lv.' + s.r, mx, y + 44, 11.5, un ? '#7df9ff' : '#555');
  txt('🪙 ' + s.g.toLocaleString() + ' G', x + 600, y + 22, 13, un ? '#ffd84a' : '#555');
  txt('通关奖励', x + 600, y + 44, 11.5, un ? '#8a97aa' : '#555');

  const bw = 104, bh = 34, bxx = x + w - bw - 12, byy = y + 14;
  rpath(bxx, byy, bw, bh, 8);
  if (!un) { ctx.fillStyle = 'rgba(30,36,50,.6)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.stroke(); txt('🔒 未解锁', bxx + bw / 2, byy + bh / 2, 12, '#666', 'center') }
  else if (sel) {
    const g = ctx.createLinearGradient(bxx, byy, bxx, byy + bh); g.addColorStop(0, acc); g.addColorStop(1, acc + 'aa');
    ctx.save(); ctx.shadowColor = acc; ctx.shadowBlur = 8 + 4 * Math.sin(T * 4); ctx.fillStyle = g; ctx.fill(); ctx.restore();
    txt('⚡ 出征', bxx + bw / 2, byy + bh / 2, 13, '#fff', 'center');
  } else if (cd) { ctx.fillStyle = 'rgba(46,213,115,.18)'; ctx.fill(); ctx.strokeStyle = '#2ed573'; ctx.lineWidth = 1; ctx.stroke(); txt('✔ 已通关', bxx + bw / 2, byy + bh / 2, 12, '#2ed573', 'center') }
  else { ctx.fillStyle = 'rgba(255,216,74,.18)'; ctx.fill(); ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 1; ctx.stroke(); txt('可挑战', bxx + bw / 2, byy + bh / 2, 12, '#ffd84a', 'center') }
}

function drawPoDun() {
  const ch = CHAPTERS[curChapIdx], acc = ch.col;
  poFrame(acc, '⚔️ 副本 · 章节战役');
  const order = CHAPTERS.map((_, i) => i).filter(i => Math.abs(i - PO.cp) < 2.2).sort((a, b) => Math.abs(b - PO.cp) - Math.abs(a - PO.cp));
  for (const i of order) {                                        // 章节卡片轮播（远的先画，当前章节在最上层）
    const d = i - PO.cp, ad = Math.abs(d), t = Math.min(1, ad);
    const sc = 1 - .3 * t - Math.max(0, ad - 1) * .06, cx = 480 + Math.sign(d) * (ad <= 1 ? ad * 255 : 255 + (ad - 1) * 120);
    const al = cl(1 - Math.max(0, ad - 1.1) * .9, 0, 1) * (1 - .25 * t);
    poChapterCard(i, cx, 139, sc, al, i === curChapIdx);
    if (al > .25) pHit(cx - 150 * sc, 139 - 54 * sc, 300 * sc, 108 * sc, () => setChap(i));
  }
  poArrow(POX + 12, 107, -1, curChapIdx > 0, acc, () => setChap(curChapIdx - 1));
  poArrow(POX + POW - 42, 107, 1, curChapIdx < CHAPTERS.length - 1, acc, () => setChap(curChapIdx + 1));
  for (let i = 0; i < CHAPTERS.length; i++) {                     // 页码点
    const on = i === curChapIdx, x = 480 + (i - (CHAPTERS.length - 1) / 2) * 16;
    rpath(x - (on ? 8 : 3), 200, on ? 16 : 6, 6, 3); ctx.fillStyle = on ? acc : chapUnlocked(i) ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.1)'; ctx.fill();
  }
  txt(ch.sub + '  ——  ' + ch.desc, 480, 222, 12, '#9ab', 'center');
  ch.stages.forEach((si, k) => poStageCard(ST[si], si, 238 + k * 70, acc));

  const un = selStageIdx <= S.cl;
  poFooter(acc, 'A/D 切换章节   W/S 选择关卡   Enter 出征', { label: un ? '⚡ 立即出征 [Enter]' : '🔒 关卡未解锁', c: '#2ed573', dis: !un, f: () => pStartStage(selStageIdx) });
}

// ---------- 世界BOSS ----------
function poWBRow(w, i, y) {
  const x = POX + 24, rw = 256, h = 50, sel = PO.wb === i, open = wbOpen(w), k = wbData().kills[i] || 0;
  rpath(x, y, rw, h, 12);
  if (sel) { const g = ctx.createLinearGradient(x, 0, x + rw, 0); g.addColorStop(0, WB_COL + '44'); g.addColorStop(1, WB_COL + '10'); ctx.fillStyle = g }
  else ctx.fillStyle = 'rgba(12,18,34,.8)';
  ctx.fill();
  if (sel) { ctx.save(); ctx.shadowColor = WB_COL; ctx.shadowBlur = 10; ctx.lineWidth = 2; ctx.strokeStyle = WB_COL; ctx.stroke(); ctx.restore() }
  else { ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.stroke() }
  ctx.beginPath(); ctx.arc(x + 28, y + h / 2, 18, 0, 7); ctx.fillStyle = open ? WB_COL + '33' : 'rgba(30,36,50,.8)'; ctx.fill();
  ctx.lineWidth = 1.4; ctx.strokeStyle = open ? WB_COL : '#555'; ctx.stroke();
  txt(open ? '👹' : '🔒', x + 28, y + h / 2 + 1, 16, '#fff', 'center', false);
  txt(w.n, x + 56, y + 18, 15, open ? (sel ? '#ffd84a' : '#fff') : '#778');
  txt(open ? '推荐 Lv.' + w.r + (k ? '  ·  已讨伐 ' + k + ' 次' : '') : 'Lv.' + w.lv + ' 解锁', x + 56, y + 36, 11, open ? '#9fb0c6' : '#667');
  pHit(x, y, rw, h, () => { PO.wb = i });
}

function drawPoWB() {
  const w = WB[PO.wb], open = wbOpen(w), Wd = wbData(), left = wbLeft();
  poFrame(WB_COL, '👹 世界BOSS · 限时讨伐');
  WB.forEach((b, i) => poWBRow(b, i, 84 + i * 55));

  const dx = POX + 296, dy = 84, dw = POW - 296 - 24, dh = 354;
  rpath(dx, dy, dw, dh, 16);
  const g = ctx.createLinearGradient(dx, dy, dx + dw, dy + dh); g.addColorStop(0, 'rgba(255,60,60,.16)'); g.addColorStop(.5, 'rgba(12,16,32,.92)'); g.addColorStop(1, 'rgba(8,10,22,.95)');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = WB_COL + '66'; ctx.stroke();

  // 首领立绘
  const fx = dx + 112, fy = dy + 268;
  ctx.save(); ctx.translate(fx, fy);
  const aura = ctx.createRadialGradient(0, -6, 6, 0, -6, 110); aura.addColorStop(0, open ? 'rgba(255,60,60,.35)' : 'rgba(120,120,140,.15)'); aura.addColorStop(1, 'rgba(255,60,60,0)');
  ctx.fillStyle = aura; ctx.beginPath(); ctx.ellipse(0, -6, 110, 30, 0, 0, 7); ctx.fill();
  const pool = ENS[w.set] && ENS[w.set].boss, im = pool && pool[0];
  if (im && im.width) {
    const k = Math.min(230 / im.height, 190 / im.width), iw = im.width * k, ih = im.height * k, bob = Math.sin(T * 2) * 3;
    ctx.globalAlpha = open ? 1 : .35;
    if (open) { ctx.shadowColor = WB_COL; ctx.shadowBlur = 18 + 6 * Math.sin(T * 3) }
    ctx.drawImage(im, -iw / 2, -ih + bob, iw, ih);
  } else txt('👹', 0, -110, 90, '#fff', 'center', false);
  ctx.restore();
  if (!open) txt('🔒', fx, dy + 160, 40, '#fff', 'center', false);

  // 右侧信息
  const rx = dx + 236;
  txt('WORLD BOSS', rx, dy + 24, 11, WB_COL);
  txt(w.n, rx, dy + 50, 27, '#ffd84a');
  txt(w.d, rx, dy + 84, 12, '#9fb0c6');
  const hp = ET.boss.hp * ST[w.si].hm * w.hpx | 0, k = Wd.kills[PO.wb] || 0, best = Wd.best[PO.wb] || 0;
  const stats = [['推荐等级', 'Lv.' + w.r, poRel(w.r)[1]], ['讨伐时限', w.tl + ' 秒', '#fff'], ['首领生命', poN(hp), '#ff8a95'],
                 ['满伤害奖励', poN(w.g) + ' G', '#ffd84a'], ['历史最高伤害', best ? poN(best) : '—', '#7df9ff'], ['累计讨伐', k + ' 次', '#7dff9a']];
  stats.forEach((st, i) => {
    const sx = rx + (i % 3) * 108, sy = dy + 122 + (i / 3 | 0) * 50;
    rpath(sx - 6, sy - 14, 102, 42, 8); ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fill();
    txt(st[0], sx, sy, 11, '#8a97aa'); txt(st[1], sx, sy + 20, 15, st[2]);
  });
  txt('📜 击杀必掉 Lv.' + w.r + ' 顶级装备 + 强化卷轴 ×5~7', rx, dy + 236, 12, '#c9d4e6');
  txt('💰 金币按伤害占比结算，击杀额外 +50%', rx, dy + 256, 12, '#c9d4e6');
  txt('⚠ 撤退 / 战败 / 超时同样消耗 1 次机会', rx, dy + 276, 12, '#c9d4e6');
  txt('今日剩余', rx, dy + 314, 12, '#9ab');
  for (let i = 0; i < WB_DAILY; i++) {
    ctx.beginPath(); ctx.arc(rx + 74 + i * 24, dy + 314, 8, 0, 7); ctx.fillStyle = i < left ? WB_COL : 'rgba(255,255,255,.08)'; ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = WB_COL + 'aa'; ctx.stroke();
  }
  if (!open) { pPill(dx + dw - 168, dy + 12, 152, 24, 'rgba(255,71,87,.2)', '#ff4757'); txt('🔒 需要 Lv.' + w.lv + ' 解锁', dx + dw - 92, dy + 24, 12, '#ff8a95', 'center') }

  const dis = !open || left <= 0;
  poFooter(WB_COL, 'W/S 选择首领   Enter 发起讨伐', { label: !open ? '🔒 等级不足' : left <= 0 ? '今日次数已用完' : '⚔ 发起讨伐 [Enter]', c: WB_COL, dis, f: pStartWB });
}

// ---------- 入口 ----------
function drawPortalModal() {
  PO.hit = [];
  if (PO.view === 'hub') drawPoHub(); else if (PO.view === 'dun') drawPoDun(); else drawPoWB();
  if (PO.tt > 0) {
    const w = tw(PO.toast, 13) + 36;
    ctx.save(); ctx.globalAlpha = Math.min(1, PO.tt * 2);
    pPill(480 - w / 2, POY + POH - 82, w, 24, 'rgba(10,12,22,.96)', '#ffd84a'); txt(PO.toast, 480, POY + POH - 70, 13, '#ffd84a', 'center');
    ctx.restore();
  }
}
