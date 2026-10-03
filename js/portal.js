// ===== 维度传送门：模式选择 / 单人副本 / 双人高难联机 / 世界BOSS / 无尽塔 / 骑士防线 / 虚幻裂隙 =====
const NST = CHAPTERS.reduce((a, c) => a + c.stages.length, 0);
const POX = 40, POY = 22, POW = 880, POH = 496;
const PO = { view: 'hub', hub: 0, hp: 0, wb: 0, tw: 1, td: 0, ret: 'hub', cp: 0, toast: '', tt: 0, hit: [], _lastView: '' };
const HUB_N = 6;   // 模式数扩充为 6：单人 / 双人 / 世界BOSS / 无尽塔 / 塔防 / 虚幻裂隙(肉鸽)
const hubView = i => ['dun', 'coop', 'wb', 'tower', 'td', 'rogue'][i] || 'dun';
let curChapIdx = 0, selStageIdx = 0, stagePage = 0;
let coopStageSelectIdx = 0; // 选中的双人高难副本索引

// 专属双人联机房间号数码输入弹窗状态
const COOP_PIN_MODAL = {
  show: false,
  code: '',
  maxLen: 4
};

const WB_COL = '#ff4d4d';
const poN = n => { n = Math.round(n || 0); return n >= 1e8 ? +(n / 1e8).toFixed(2) + '亿' : n >= 1e4 ? +(n / 1e4).toFixed(1) + '万' : String(n); };
const poFont = sz => `700 ${sz}px -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif`;
const tw = (s, sz) => { ctx.font = poFont(sz); return ctx.measureText(String(s)).width; };
const pToast = s => { PO.toast = s; PO.tt = 2; };
const pHit = (x, y, w, h, f) => PO.hit.push({ x, y, w, h, f });

// 切角多边形现代机甲外框
function poBevel(x, y, w, h, c = 8) {
  ctx.beginPath();
  ctx.moveTo(x + c, y); ctx.lineTo(x + w - c, y); ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c); ctx.lineTo(x + w - c, y + h); ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c); ctx.lineTo(x, y + c);
  ctx.closePath();
}

// 战术特性小胶囊
function poBadge(x, y, label, col, bg) {
  ctx.font = poFont(10.5);
  const w = ctx.measureText(label).width + 14, h = 20;
  poBevel(x, y, w, h, 4);
  ctx.fillStyle = bg || (col + '22'); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke();
  txt(label, x + w / 2, y + 10, 10.5, col, 'center');
  return w;
}

// 数据状态
function wbData() {
  const d = new Date(), day = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  if (!S.wb || typeof S.wb !== 'object') S.wb = { day, used: 0, buy: 0, best: {}, kills: {} };
  if (!S.wb.best) S.wb.best = {};
  if (!S.wb.kills) S.wb.kills = {};
  if (typeof S.wb.buy !== 'number') S.wb.buy = 0;
  if (S.wb.day !== day) { S.wb.day = day; S.wb.used = 0; S.wb.buy = 0; }
  return S.wb;
}
const wbLeft = () => Math.max(0, WB_DAILY + (wbData().buy | 0) - wbData().used);
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
  const p = st.indexOf(selStageIdx);
  stagePage = p >= 5 ? 1 : 0;
}

function setChap(i) {
  if (i < 0 || i >= CHAPTERS.length) return;
  if (!chapUnlocked(i)) return pToast('该章节尚未解锁，请先通关上一章节');
  curChapIdx = i;
  stagePage = 0; 
  window._stageStartIdx = 0;
  pickStage();
}

// 入口与控制
function openPortal(ret) {
  RM = PG; V.pg = 'st'; M = 1;
  COOP_PIN_MODAL.show = false;
  COOP_PIN_MODAL.code = '';
  PO.view = ret ? PO.ret : 'hub';
  PO.hub = PO.view === 'rogue' ? 5 : PO.view === 'td' ? 4 : PO.view === 'tower' ? 3 : PO.view === 'wb' ? 2 : PO.view === 'coop' ? 1 : 0;
  PO.hp = PO.hub;
  // 打开传送门时自动跳转至最新前沿待挑战层数
  PO.tw = (typeof twFrontier === 'function') ? twFrontier() : 1;
  PO._lastView = '';
  curChapIdx = getHighestChapterIdx(); pickStage(); PO.cp = curChapIdx;
  wbData();
  let bi = 0; WB.forEach((w, i) => { if (wbOpen(w)) bi = i; });
  PO.wb = bi; PO.tt = 0;
}

const pBack = () => { 
  if (COOP_PIN_MODAL.show) {
    COOP_PIN_MODAL.show = false;
    return;
  }
  if (PO.view === 'hub') {
    M = 0; 
  } else if (PO.view === 'coop' && typeof COOP !== 'undefined' && COOP.active && COOP.roomCode) {
    coopLeaveRoom();
  } else {
    PO.view = 'hub'; 
  }
};

function pStartStage(idx) {
  if (idx > S.cl) return pToast('该关卡尚未解锁');
  PO.ret = 'dun'; M = 0; begin(idx);
}
function pStartWB() { wbStart(PO.wb); }   // 全服世界BOSS

// 输入处理
function portalUpdate(dt) {
  PO.tt -= dt;
  PO.cp += (curChapIdx - PO.cp) * Math.min(1, dt * 12);
  PO.hp += (PO.hub - PO.hp) * Math.min(1, dt * 12);

  // 状态机监测：进入无尽塔视图自动定位到最高待挑战层数
  if (PO.view === 'tower' && PO._lastView !== 'tower') {
    PO.tw = (typeof twFrontier === 'function') ? twFrontier() : 1;
  }
  PO._lastView = PO.view;

  const L = PR.KeyA || PR.ArrowLeft, R = PR.KeyD || PR.ArrowRight, U = PR.KeyW || PR.ArrowUp, D = PR.KeyS || PR.ArrowDown;
  const OK = PR.Enter || PR.Space || PR.KeyF;

  if (PR.Escape) { pBack(); delete PR.Escape; return; }

  // 0. 专属数码键盘输入拦截
  if (COOP_PIN_MODAL.show) {
    for (let num = 0; num <= 9; num++) {
      if (PR['Digit' + num] || PR['Numpad' + num]) {
        delete PR['Digit' + num]; delete PR['Numpad' + num];
        if (COOP_PIN_MODAL.code.length < COOP_PIN_MODAL.maxLen) {
          COOP_PIN_MODAL.code += String(num);
        }
        return;
      }
    }
    if (PR.Backspace) {
      delete PR.Backspace;
      COOP_PIN_MODAL.code = COOP_PIN_MODAL.code.slice(0, -1);
      return;
    }
    if (OK) {
      delete PR.Enter; delete PR.Space; delete PR.KeyF;
      if (COOP_PIN_MODAL.code.length === COOP_PIN_MODAL.maxLen) {
        const code = COOP_PIN_MODAL.code;
        COOP_PIN_MODAL.show = false;
        if (typeof coopJoinRoom === 'function') coopJoinRoom(code);
      } else {
        pToast('请输入完整的 4 位房间码');
      }
      return;
    }
    return;
  }

  // 1. 模式选择首页
  if (PO.view === 'hub') {
    if (L) PO.hub = Math.max(0, PO.hub - 1);
    if (R) PO.hub = Math.min(HUB_N - 1, PO.hub + 1);
    if (OK) {
      PO.view = hubView(PO.hub);
      if (PO.view === 'tower' && typeof twFrontier === 'function') PO.tw = twFrontier();
    }
    return;
  }

  // 2. 双人联机大厅
  if (PO.view === 'coop') {
    const coopList = (typeof COOP_STAGES !== 'undefined') ? COOP_STAGES : [];
    if (typeof COOP !== 'undefined' && COOP.active && COOP.roomCode) {
      if (COOP.isHost && COOP.peerConnected && OK) {
        coopSend('stage_start', { stageIdx: COOP.stageIdx });
        COOP.inGame = true;
        M = 0;
        begin(COOP.stageIdx);
      }
    } else {
      if (L) coopStageSelectIdx = (coopStageSelectIdx + coopList.length - 1) % coopList.length;
      if (R) coopStageSelectIdx = (coopStageSelectIdx + 1) % coopList.length;
    }
    return;
  }

  // 3. 单人副本
  if (PO.view === 'dun') {
    if (L) setChap(curChapIdx - 1);
    if (R) setChap(curChapIdx + 1);
    const st = CHAPTERS[curChapIdx].stages; let p = st.indexOf(selStageIdx); if (p < 0) p = 0;
    if (U && p > 0) selStageIdx = st[p - 1];
    if (D && p < st.length - 1) selStageIdx = st[p + 1];
    if (OK) pStartStage(selStageIdx);
    return;
  }

  // 3.5 无尽塔
  if (PO.view === 'tower') { towerPortalUpdate(L, R, U, D, OK); return; }

  // 3.6 骑士防线（塔防）
  if (PO.view === 'td') { towerDefPortalUpdate(L, R, U, D, OK); return; }

  // 3.7 虚幻裂隙 (镜世界肉鸽模式)
  if (PO.view === 'rogue') {
    if (typeof roguePortalUpdate === 'function') roguePortalUpdate(L, R, U, D, OK);
    return;
  }

  // 4. 世界BOSS
  if (U || L) PO.wb = Math.max(0, PO.wb - 1);
  if (D || R) PO.wb = Math.min(WB.length - 1, PO.wb + 1);
  if (OK) pStartWB();
}

function portalClick(x, y) {
  for (let i = PO.hit.length - 1; i >= 0; i--) {
    const r = PO.hit[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { r.f(); return; }
  }
  if (x < POX || x > POX + POW || y < POY || y > POY + POH) M = 0;
}

// 基础科技按钮组件
function pBtn(x, y, w, h, label, o, f) {
  o = o || {}; const c = o.c || '#00e5ff', sz = o.sz || 13, cr = o.cr || 8;
  poBevel(x, y, w, h, cr);
  if (o.dis) {
    ctx.fillStyle = 'rgba(25, 32, 48, 0.7)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'; ctx.lineWidth = 1; ctx.stroke();
    txt(label, x + w / 2, y + h / 2, sz, '#6a788c', 'center');
  } else if (o.ghost) {
    ctx.fillStyle = c + '1a'; ctx.fill();
    ctx.strokeStyle = c; ctx.lineWidth = 1.2; ctx.stroke();
    txt(label, x + w / 2, y + h / 2, sz, '#ffffff', 'center');
  } else {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, c); g.addColorStop(1, c + 'bb');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.shadowColor = c; ctx.shadowBlur = 10;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
    txt(label, x + w / 2, y + h / 2, sz, '#ffffff', 'center');
  }
  if (f) pHit(x, y, w, h, f);
}

function pPill(x, y, w, h, fill, stroke) {
  poBevel(x, y, w, h, 5); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.lineWidth = 1; ctx.strokeStyle = stroke; ctx.stroke(); }
}

function poOffscreen(key, w, h, draw) {
  const R = DPR, k = 'p' + key.id;
  let e = poOffscreen.m[k];
  if (e && e.key === key.v + '|' + R) return e;
  if (!e) { e = poOffscreen.m[k] = { c: document.createElement('canvas') }; }
  e.key = key.v + '|' + R;
  e.c.width = Math.ceil(w * R); e.c.height = Math.ceil(h * R);
  const g = e.c.getContext('2d'), real = ctx, n0 = PO.hit.length;
  g.setTransform(R, 0, 0, R, 0, 0);
  ctx = g;
  try { e.extra = draw(); } finally { ctx = real; PO.hit.splice(n0); }
  return e;
}
poOffscreen.m = {};
poOffscreen.can = (() => { try { const t = ctx; ctx = t; return true; } catch (e) { return false; } })();

function poFrame(acc, title) {
  if (!poOffscreen.can) return poFrameRaw(acc, title);
  const e = poOffscreen({ id: 'frame', v: [acc, title, S.d, S.g, S.lv, (typeof S.mc === 'number' ? S.mc : 0)].join('|') }, 960, 540, () => poFrameRaw(acc, title));
  ctx.drawImage(e.c, 0, 0, 960, 540);
}

function poFrameRaw(acc, title) {
  ctx.fillStyle = 'rgba(2, 4, 10, 0.94)'; ctx.fillRect(0, 0, 960, 540);
  poBevel(POX, POY, POW, POH, 18);
  const g = ctx.createLinearGradient(0, POY, 0, POY + POH);
  g.addColorStop(0, '#0c1628'); g.addColorStop(0.5, '#070d18'); g.addColorStop(1, '#040710');
  ctx.fillStyle = g; ctx.fill();

  ctx.save();
  poBevel(POX, POY, POW, POH, 18);
  ctx.shadowColor = acc; ctx.shadowBlur = 18; ctx.lineWidth = 1.8; ctx.strokeStyle = acc + '88'; ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.lineCap = 'square';
  const L = 14, C = 18;
  ctx.beginPath(); ctx.moveTo(POX + C + L, POY); ctx.lineTo(POX + C, POY); ctx.lineTo(POX, POY + C); ctx.lineTo(POX, POY + C + L); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(POX + POW - C - L, POY); ctx.lineTo(POX + POW - C, POY); ctx.lineTo(POX + POW, POY + C); ctx.lineTo(POX + POW, POY + C + L); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(POX, POY + POH - C - L); ctx.lineTo(POX, POY + POH - C); ctx.lineTo(POX + C, POY + POH); ctx.lineTo(POX + C + L, POY + POH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(POX + POW, POY + POH - C - L); ctx.lineTo(POX + POW, POY + POH - C); ctx.lineTo(POX + POW - C, POY + POH); ctx.lineTo(POX + POW - C - L, POY + POH); ctx.stroke();
  ctx.restore();

  txt(title, POX + 26, POY + 25, 17, '#ffffff');

  const pills = [
    { s: `${(S.mc || 0).toLocaleString()} 💠`, c: '#c79bff' }, // 镜晶代币
    { s: S.d.toLocaleString(), ic: ICO.d, c: '#4fe3ff' },
    { s: S.g.toLocaleString() + ' G', ic: ICO.g, c: '#ffd84a' },
    { s: 'Lv.' + S.lv, c: '#7dff9a' }
  ];
  let curPx = POX + POW - 24;
  ctx.font = poFont(11.5);
  for (let i = pills.length - 1; i >= 0; i--) {
    const p = pills[i];
    const textW = ctx.measureText(p.s).width;
    const w = (p.ic ? 22 : 0) + textW + 20;
    curPx -= w;
    poBevel(curPx, POY + 13, w, 24, 4);
    ctx.fillStyle = 'rgba(8, 14, 28, 0.95)'; ctx.fill();
    ctx.strokeStyle = p.c + '66'; ctx.lineWidth = 1; ctx.stroke();
    if (p.ic) {
      drawIco(p.ic, curPx + 14, POY + 25, 14);
      txt(p.s, curPx + w - 8, POY + 25, 11.5, p.c, 'right');
    } else {
      txt(p.s, curPx + w / 2, POY + 25, 11.5, p.c, 'center');
    }
    curPx -= 6;
  }
}

function poFooter(acc, hint, main) {
  const y = POY + POH - 52;
  poBevel(POX + 16, y - 4, POW - 32, 42, 8);
  ctx.fillStyle = 'rgba(6, 10, 20, 0.85)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'; ctx.lineWidth = 1; ctx.stroke();

  pBtn(POX + 26, y, 140, 34, PO.view === 'hub' ? '← 返回基地 [ESC]' : '← 返回模式 [ESC]', { c: '#ff4757', ghost: true, sz: 12 }, pBack);
  txt(hint, 480, y + 17, 12, '#8da0b8', 'center');
  if (main) pBtn(POX + POW - 26 - 190, y, 190, 34, main.label, { c: main.c, dis: main.dis, sz: 13.5 }, main.f);
}

// ---------- 1. 首页：六联装模式卡片 (包含虚幻裂隙) ----------
function poHubCard(x, y, w, h, idx, o) {
  const sel = PO.hub === idx, cy0 = sel ? y - 4 : y, ix = x + w / 2, iy = cy0 + 82;
  ctx.save();
  poBevel(x, cy0, w, h, 14);
  const g = ctx.createLinearGradient(x, cy0, x + w, cy0 + h);
  g.addColorStop(0, o.c + (sel ? '44' : '1e')); g.addColorStop(0.6, '#0b1224'); g.addColorStop(1, '#050912');
  ctx.fillStyle = g; ctx.fill();

  if (sel) {
    ctx.save(); ctx.shadowColor = o.c; ctx.shadowBlur = 18; ctx.lineWidth = 2; ctx.strokeStyle = o.c; ctx.stroke(); ctx.restore();
  } else {
    ctx.lineWidth = 1.2; ctx.strokeStyle = o.c + '66'; ctx.stroke();
  }

  poBevel(ix - 32, iy - 32, 64, 64, 10);
  ctx.fillStyle = o.c + '22'; ctx.fill();
  ctx.strokeStyle = o.c; ctx.lineWidth = 1.5; ctx.stroke();
  txt(o.icon, ix, iy + 2, 34, '#fff', 'center', false);

  txt(o.en, ix, cy0 + 152, 9.5, o.c, 'center');
  txt(o.title, ix, cy0 + 176, 23, '#fff', 'center');
  txt(o.d1, ix, cy0 + 204, 11, '#a6b8cc', 'center');
  txt(o.d2, ix, cy0 + 222, 11, '#7f93a8', 'center');

  o.status(x + 20, cy0 + 248, w - 40);

  const by = cy0 + h - 46;
  pBtn(x + 16, by, w - 32, 34, '▶ 进入' + o.title, { c: o.c, ghost: !sel, sz: 13, cr: 6 }, () => {
    PO.hub = idx;
    PO.view = hubView(idx);
    if (PO.view === 'tower' && typeof twFrontier === 'function') PO.tw = twFrontier();
  });
  ctx.restore();
}

function drawPoHub() {
  const ROGUE_COL = (typeof ROGUE_COL_THEME !== 'undefined') ? ROGUE_COL_THEME : '#9b51e0';
  const HUB_COL = ['#00e5ff', '#2ed573', WB_COL, TOWER.col, TD_COL, ROGUE_COL];
  poFrame(HUB_COL[PO.hub], '🌌 维度传送门 · 选择出征模式');
  const cw = 262, ch = 340, cy = POY + 68, midY = cy + ch / 2;

  const modes = [
    {
      c: '#00e5ff', icon: '⚔️', en: 'SOLO DUNGEON', title: '单人副本',
      d1: '20 大章 · 200 关卡 · 领主战役', d2: '单兵出征，稳步解锁神话装备',
      status(sx, sy, sw) {
        const c = Math.min(S.cl, NST);
        txt('通关进度', sx, sy, 11, '#9ab'); txt(c + ' / ' + NST, sx + sw, sy, 11, '#ffd84a', 'right');
        bar(sx, sy + 14, sw, 7, c, NST, '#00e5ff', '#7df9ff', 4);
      }
    },
    {
      c: '#2ed573', icon: '👥', en: 'CO-OP RAID', title: '双人高难',
      d1: '500% 领主血量 · 500% 赏金经验', d2: '双向伤害强同步 · 专属神话保底',
      status(sx, sy, sw) {
        const hasRoom = typeof COOP !== 'undefined' && COOP.active && COOP.roomCode;
        txt('战备状态', sx, sy, 11, '#9ab');
        txt(hasRoom ? `已在房间 [${COOP.roomCode}]` : '战备大厅就绪', sx + sw, sy, 11, hasRoom ? '#7dff9a' : '#2ed573', 'right');
        bar(sx, sy + 14, sw, 7, hasRoom ? 1 : 0, 1, '#2ed573', '#7dff9a', 4);
      }
    },
    {
      c: WB_COL, icon: '👹', en: 'WORLD BOSS', title: '世界BOSS',
      d1: '全服共讨巨型首领 · 90秒限时', d2: '击杀必掉高阶装备与强化卷轴',
      status(sx, sy, sw) {
        const n = WB.filter(wbOpen).length, left = wbLeft();
        txt('今日剩余讨伐', sx, sy, 11, '#9ab');
        txt(left + ' / ' + (WB_DAILY + (wbData().buy | 0)) + ' (已开放 ' + n + ')', sx + sw, sy, 11, left ? '#ffd84a' : '#ff6b6b', 'right');
        bar(sx, sy + 14, sw, 7, left, WB_DAILY + (wbData().buy | 0), '#ff4757', '#ff9f43', 4);
      }
    },
    {
      c: TOWER.col, icon: '🗼', en: 'ENDLESS TOWER', title: '无尽塔',
      d1: '层层攀登 · 每 10 层首领镇守', d2: '首通钻石 · 契约碎片 · 解锁称号',
      status(sx, sy, sw) {
        const b = twBest();
        txt('历史最高', sx, sy, 11, '#9ab'); txt(b ? '第 ' + b + ' 层' : '尚未挑战', sx + sw, sy, 11, '#ffd84a', 'right');
        bar(sx, sy + 14, sw, 7, b % 10 || (b ? 10 : 0), 10, '#a55eea', '#c79bff', 4);
      }
    },
    {
      c: TD_COL, icon: '🛡️', en: 'RIDER DEFENSE', title: '骑士防线',
      d1: '部署五位假面骑士守卫车道', d2: '升级 · 必杀 · 机车清场 · 首通钻石',
      status(sx, sy, sw) {
        const b = tdBest();
        txt('防线进度', sx, sy, 11, '#9ab'); txt(b + ' / ' + TD_LEVELS, sx + sw, sy, 11, '#ffd84a', 'right');
        bar(sx, sy + 14, sw, 7, b, TD_LEVELS, '#ff9f43', '#ffd84a', 4);
      }
    },
    {
      c: ROGUE_COL, icon: '🪞', en: 'PHANTASM RIFT', title: '虚幻裂隙',
      d1: '12 间随机裂隙 · 圣物构筑 · 纯粹肉鸽', d2: '重置入场 · 战利圣物 · 结算代币「镜晶」',
      status(sx, sy, sw) {
        const b = (typeof rogueBestRoom === 'function') ? rogueBestRoom() : 0;
        txt('探索记录', sx, sy, 11, '#9ab'); txt(b ? `最高第 ${b} / 12 间` : '未曾涉足', sx + sw, sy, 11, '#ffd84a', 'right');
        bar(sx, sy + 14, sw, 7, b, 12, '#9b51e0', '#e056fd', 4);
      }
    }
  ];

  const order = [0, 1, 2, 3, 4, 5].filter(i => Math.abs(i - PO.hp) < 2).sort((a, b) => Math.abs(b - PO.hp) - Math.abs(a - PO.hp));
  for (const i of order) {
    const d = i - PO.hp, ad = Math.abs(d), t = Math.min(1, ad);
    const sc = 1 - .26 * t - Math.max(0, ad - 1) * .1;
    const cx = 480 + Math.sign(d) * (ad <= 1 ? ad * 258 : 258 + (ad - 1) * 40);
    const al = (1 - .3 * t) * cl(2 - ad, 0, 1);
    if (al < .03) continue;

    const sel = i === PO.hub, PAD = 26;
    if (!poOffscreen.can) {
      const n0 = PO.hit.length;
      ctx.save(); ctx.globalAlpha = al;
      ctx.translate(cx, midY); ctx.scale(sc, sc); ctx.translate(-cx, -midY);
      poHubCard(cx - cw / 2, cy, cw, ch, i, modes[i]);
      ctx.restore();
      const added = PO.hit.splice(n0);
      if (sel) {
        const enter = added[0] && added[0].f;
        if (enter) pHit(cx - cw * sc / 2, midY - ch * sc / 2, cw * sc, ch * sc, () => {
          enter();
          if (PO.view === 'tower' && typeof twFrontier === 'function') PO.tw = twFrontier();
        });
      } else if (al > .2) pHit(cx - cw * sc / 2, midY - ch * sc / 2, cw * sc, ch * sc, () => { PO.hub = i; });
      continue;
    }
    const key = { id: 'hub' + i + (sel ? 's' : 'n'), v: [S.cl, S.lv, wbLeft(), WB.filter(wbOpen).length, twBest(), tdBest(), (typeof S.mr === 'number' ? S.mr : 0), typeof COOP !== 'undefined' && COOP.active ? COOP.roomCode : ''].join('|') };
    const e = poOffscreen(key, cw + PAD * 2, ch + PAD * 2, () => {
      const sv = PO.hub; PO.hub = sel ? i : -1;
      try {
        const n0 = PO.hit.length;
        poHubCard(PAD, PAD + 4, cw, ch, i, modes[i]);
        return { enter: PO.hit[n0] && PO.hit[n0].f };
      } finally { PO.hub = sv; }
    });
    ctx.save();
    ctx.globalAlpha = al;
    ctx.translate(cx, midY); ctx.scale(sc, sc);
    ctx.drawImage(e.c, -cw / 2 - PAD, -ch / 2 - PAD, cw + PAD * 2, ch + PAD * 2);
    ctx.restore();

    if (sel) {
      if (e.extra && e.extra.enter) pHit(cx - cw * sc / 2, midY - ch * sc / 2, cw * sc, ch * sc, () => {
        e.extra.enter();
        if (PO.view === 'tower' && typeof twFrontier === 'function') PO.tw = twFrontier();
      });
    } else if (al > .2) {
      pHit(cx - cw * sc / 2, midY - ch * sc / 2, cw * sc, ch * sc, () => { PO.hub = i; });
    }
  }

  const col = HUB_COL[PO.hub];
  poArrow(POX + 12, midY - 32, -1, PO.hub > 0, col, () => { PO.hub = Math.max(0, PO.hub - 1); });
  poArrow(POX + POW - 42, midY - 32, 1, PO.hub < HUB_N - 1, col, () => { PO.hub = Math.min(HUB_N - 1, PO.hub + 1); });
  for (let i = 0; i < HUB_N; i++) {
    const dx = 480 + (i - (HUB_N - 1) / 2) * 22, dy = cy + ch + 16, on = i === PO.hub;
    ctx.beginPath(); ctx.arc(dx, dy, on ? 5 : 4, 0, 7);
    ctx.fillStyle = on ? HUB_COL[i] : 'rgba(255,255,255,.12)'; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = HUB_COL[i] + '99'; ctx.stroke();
    pHit(dx - 10, dy - 10, 20, 20, () => { PO.hub = i; });
  }

  poFooter(col, 'A/D 切换模式   Enter/点击 进入', null);
}

// ---------- 2. 联机大厅 ----------
function drawPoCoop() {
  poFrame('#2ed573', '👥 维度传送门 · 假面骑士双人协同高难副本');
  const inRoom = typeof COOP !== 'undefined' && COOP.active && COOP.roomCode;
  const coopList = (typeof COOP_STAGES !== 'undefined') ? COOP_STAGES : [];
  const curCoopObj = coopList[coopStageSelectIdx] || coopList[0] || { n: '双人深渊·翡翠巨兽 [试炼]', r: 21, g: 4000, desc: '全怪物 500% 血量' };

  if (!inRoom) {
    const w = 402, h = 348, cy = POY + 66, lx = POX + 24, rx = POX + POW - 24 - w;

    poBevel(lx, cy, w, h, 14);
    const lg = ctx.createLinearGradient(lx, cy, lx + w, cy + h);
    lg.addColorStop(0, 'rgba(12, 32, 48, 0.95)'); lg.addColorStop(1, 'rgba(6, 14, 26, 0.98)');
    ctx.fillStyle = lg; ctx.fill();
    ctx.strokeStyle = '#2ed573'; ctx.lineWidth = 1.6; ctx.stroke();

    poBadge(lx + 20, cy + 16, 'HOST PROTOCOL // 1P', '#2ed573');
    txt('创建双人高难副本', lx + 160, cy + 26, 16, '#ffffff');

    const missionCardY = cy + 48, mcH = 146;
    poBevel(lx + 16, missionCardY, w - 32, mcH, 10);
    ctx.fillStyle = 'rgba(4, 9, 20, 0.9)'; ctx.fill();
    ctx.strokeStyle = 'rgba(46, 213, 115, 0.35)'; ctx.lineWidth = 1.2; ctx.stroke();

    txt(`PHASE ${coopStageSelectIdx + 1}/${coopList.length} · 建议战力 Lv.${curCoopObj.r}`, lx + 28, missionCardY + 20, 11, '#7df9ff');
    mFit(curCoopObj.n, lx + 28, missionCardY + 44, w - 120, 16, '#ffd84a');

    pBtn(lx + w - 86, missionCardY + 16, 28, 42, '◀', { c: '#2ed573', ghost: true, sz: 12, cr: 6 }, () => {
      coopStageSelectIdx = (coopStageSelectIdx + coopList.length - 1) % coopList.length;
    });
    pBtn(lx + w - 52, missionCardY + 16, 28, 42, '▶', { c: '#2ed573', ghost: true, sz: 12, cr: 6 }, () => {
      coopStageSelectIdx = (coopStageSelectIdx + 1) % coopList.length;
    });

    // 倍率按关卡读取（进阶关卡 hpx / dmx 各不相同；老关卡仍是 500% / ×3）
    const cst = ST[curCoopObj.si] || {}, hpPct = Math.round((cst.hpx || 5) * 100), dmN = +(cst.dmx || 3).toFixed(2);
    let chipX = lx + 28;
    chipX += poBadge(chipX, missionCardY + 70, hpPct + '% 领主血量', '#ff6b81') + 6;
    chipX += poBadge(chipX, missionCardY + 70, '×' + dmN + ' 怪物攻击', '#ffd84a') + 6;
    poBadge(chipX, missionCardY + 70, '神话必掉', '#a55eea');

    const cix = Math.max(0, COOP_STAGES.indexOf(curCoopObj));
    txt(`领主: ${curCoopObj.bn || '强敌'}   |   赏金: +${curCoopObj.g.toLocaleString()} G   |   首通钻石 +${COOP_FIRST_DIAM[cix] || 0}`, lx + 28, missionCardY + 97, 11, '#8fa0b8');
    txt(`每次通关：契约碎片 ×${COOP_SHARD[cix] || 1}   碎晶 ×${COOP_MAT[cix] || 0}   强化卷轴 ×${COOP_SCR[cix] || 0}（可重复刷）`, lx + 28, missionCardY + 115, 11, '#c79bff');
    txt(curCoopObj.desc || '', lx + 28, missionCardY + 133, 10.5, '#708398');

    // 关卡圆点：每关一个，点哪个跳哪个（当前关高亮）
    {
      const n = coopList.length, areaW = w - 48, step = Math.min(24, areaW / Math.max(1, n)), x0 = lx + w / 2 - step * (n - 1) / 2, dy = cy + 204;
      for (let k = 0; k < n; k++) {
        const dx = x0 + k * step, on = k === coopStageSelectIdx;
        ctx.save();
        if (on) { ctx.shadowColor = '#ffd84a'; ctx.shadowBlur = 8; }
        ctx.beginPath(); ctx.arc(dx, dy, on ? 5 : 3.2, 0, 7);
        ctx.fillStyle = on ? '#ffd84a' : 'rgba(46, 213, 115, 0.45)'; ctx.fill();
        ctx.restore();
        pHit(dx - step / 2, dy - 9, step, 18, () => { coopStageSelectIdx = k; });
      }
    }

    pBtn(lx + 24, cy + 214, w - 48, 46, '⚡ 生成专属房间码 // CREATE ROOM', { c: '#2ed573', sz: 14.5, cr: 8 }, async () => {
      if (typeof coopCreateRoom === 'function') {
        await coopCreateRoom(curCoopObj.si);
      } else {
        pToast('未检测到 coop.js 模块');
      }
    });

    txt('系统将生成 4 位纯数字房间码，告知好友即可实时同步', lx + w / 2, cy + 280, 11, '#687a8e', 'center');

    poBevel(rx, cy, w, h, 14);
    const rg = ctx.createLinearGradient(rx, cy, rx + w, cy + h);
    rg.addColorStop(0, 'rgba(18, 24, 46, 0.95)'); rg.addColorStop(1, 'rgba(8, 12, 24, 0.98)');
    ctx.fillStyle = rg; ctx.fill();
    ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 1.6; ctx.stroke();

    poBadge(rx + 20, cy + 16, 'LINK PROTOCOL // 2P', '#00e5ff');
    txt('加入好友房间', rx + 155, cy + 26, 16, '#ffffff');

    const pinBoxY = cy + 48, pbH = 146;
    poBevel(rx + 16, pinBoxY, w - 32, pbH, 10);
    ctx.fillStyle = 'rgba(5, 10, 22, 0.9)'; ctx.fill();
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)'; ctx.lineWidth = 1.2; ctx.stroke();

    txt('DIGITAL FREQUENCY PIN · 作战频段密钥', rx + w / 2, pinBoxY + 24, 11, '#7df9ff', 'center');

    const slotW = 54, slotH = 50, slotGap = 12;
    const slotStartX = rx + (w - (4 * slotW + 3 * slotGap)) / 2;
    for (let s = 0; s < 4; s++) {
      const sx = slotStartX + s * (slotW + slotGap), sy = pinBoxY + 44;
      poBevel(sx, sy, slotW, slotH, 6);
      ctx.fillStyle = 'rgba(0, 229, 255, 0.08)'; ctx.fill();
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.5)'; ctx.lineWidth = 1.2; ctx.stroke();
      txt('—', sx + slotW / 2, sy + slotH / 2, 20, '#00e5ff', 'center');
    }

    txt('输入房主屏幕上方展示的 4 位房间号即可连接', rx + w / 2, pinBoxY + 118, 11, '#8fa0b8', 'center');

    pBtn(rx + 24, cy + 214, w - 48, 46, '🔑 输入房间号并加入 // CONNECT', { c: '#00e5ff', sz: 14.5, cr: 8 }, () => {
      COOP_PIN_MODAL.show = true;
      COOP_PIN_MODAL.code = '';
    });

    txt('连接成功后双方动作姿态与怪兽血量将毫秒级强同步', rx + w / 2, cy + 280, 11, '#687a8e', 'center');

    poFooter('#2ed573', '点击选择专属高难副本 · 支持键盘 ◀ ▶ 快速切关', null);

  } else {
    const w = 620, h = 356, cy = POY + 62, cx = POX + (POW - w) / 2;
    poBevel(cx, cy, w, h, 16);
    const bg = ctx.createLinearGradient(cx, cy, cx + w, cy + h);
    bg.addColorStop(0, '#0e1c32'); bg.addColorStop(0.5, '#07101e'); bg.addColorStop(1, '#040710');
    ctx.fillStyle = bg; ctx.fill();
    ctx.save();
    ctx.shadowColor = '#2ed573'; ctx.shadowBlur = 18; ctx.lineWidth = 2; ctx.strokeStyle = '#2ed573'; ctx.stroke();
    ctx.restore();

    txt('// RAID TELEMETRY · 双人协同战备室', cx + 30, cy + 24, 11.5, '#2ed573');
    txt(COOP.isHost ? '【 1P 房主指挥端 】' : '【 2P 协同队员端 】', cx + w - 30, cy + 24, 11.5, '#00e5ff', 'right');

    const code = String(COOP.roomCode || '0000');
    const cw = 54, ch = 48, cgap = 10;
    const cStartX = cx + (w - (4 * cw + 3 * cgap)) / 2, cY = cy + 40;
    for (let c = 0; c < 4; c++) {
      const bx = cStartX + c * (cw + cgap);
      poBevel(bx, cY, cw, ch, 8);
      ctx.fillStyle = 'rgba(6, 14, 28, 0.95)'; ctx.fill();
      ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 1.5; ctx.stroke();
      txt(code[c] || '0', bx + cw / 2, cY + ch / 2, 26, '#ffd84a', 'center');
    }

    const slotY = cy + 104, sw = (w - 72) / 2, sh = 72;
    poBevel(cx + 28, slotY, sw, sh, 8);
    ctx.fillStyle = 'rgba(12, 24, 40, 0.85)'; ctx.fill();
    ctx.strokeStyle = '#2ed573'; ctx.lineWidth = 1.2; ctx.stroke();
    txt('1P COMMANDER // 房主', cx + 40, slotY + 18, 10.5, '#2ed573');
    txt(COOP.isHost ? '你 (HOST)' : '房主 (HOST)', cx + 40, slotY + 38, 14, '#ffffff');
    txt('✔ 作战状态正常', cx + 40, slotY + 58, 10, '#7dff9a');

    poBevel(cx + 36 + sw, slotY, sw, sh, 8);
    const conn = COOP.peerConnected;
    ctx.fillStyle = conn ? 'rgba(12, 28, 44, 0.85)' : 'rgba(28, 18, 20, 0.85)'; ctx.fill();
    ctx.strokeStyle = conn ? '#00e5ff' : '#ff9f43'; ctx.lineWidth = 1.2; ctx.stroke();
    txt('2P OPERATOR // 协同', cx + 48 + sw, slotY + 18, 10.5, conn ? '#00e5ff' : '#ff9f43');
    txt(conn ? (COOP.isHost ? '协同队员已加入' : '你 (CLIENT)') : '等待信号接入…', cx + 48 + sw, slotY + 38, 14, conn ? '#ffffff' : '#a2b4cb');
    txt(conn ? '✔ 双向同步就绪' : '⏳ 等待队友输入房间码', cx + 48 + sw, slotY + 58, 10, conn ? '#7dff9a' : '#ffa502');

    const stObj = ST[COOP.stageIdx] || ST[0];
    const briefY = slotY + sh + 10;
    poBevel(cx + 28, briefY, w - 56, 28, 6);
    ctx.fillStyle = 'rgba(6, 12, 24, 0.9)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.stroke();
    txt(`战役目标: ${stObj.n} (${Math.round((stObj.hpx || 5) * 100)}% 血量 · ×${+(stObj.dmx || 3).toFixed(2)} 攻击)`, cx + 38, briefY + 14, 11, '#ffd84a');

    const btnY = briefY + 38;
    if (COOP.isHost) {
      pBtn(cx + 40, btnY, w - 80, 44, conn ? '⚡ 全员出征！ // ENGAGE MISSION [Enter]' : '等待队友接入中…', { c: '#2ed573', dis: !conn, sz: 14.5, cr: 8 }, () => {
        if (conn && typeof coopSend === 'function') {
          coopSend('stage_start', { stageIdx: COOP.stageIdx });
          COOP.inGame = true;
          M = 0;
          begin(COOP.stageIdx);
        }
      });
    } else {
      poBevel(cx + 40, btnY, w - 80, 44, 8);
      ctx.fillStyle = 'rgba(0, 229, 255, 0.12)'; ctx.fill();
      ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 1.2; ctx.stroke();
      txt('正在等待 1P 房主下达全员出征指令…', cx + w / 2, btnY + 22, 13.5, '#7df9ff', 'center');
    }

    pBtn(cx + (w - 150) / 2, btnY + 54, 150, 28, '🚪 解散 / 退出频段', { c: '#ff4757', ghost: true, sz: 11, cr: 5 }, () => {
      coopLeaveRoom();
    });

    poFooter('#2ed573', COOP.isHost ? '队友就绪后点击或按 Enter 即可全员出征' : '保持连接，房主出征后将自动载入', null);
  }

  if (COOP_PIN_MODAL.show) {
    drawCoopPinModal();
  }
}

// ---------- 双人联机专属数码输入全息弹窗 ----------
function drawCoopPinModal() {
  ctx.save();
  ctx.fillStyle = 'rgba(2, 4, 10, 0.85)';
  ctx.fillRect(0, 0, 960, 540);

  const mw = 360, mh = 360, mx = (960 - mw) / 2, my = (540 - mh) / 2;
  poBevel(mx, my, mw, mh, 16);
  const bg = ctx.createLinearGradient(mx, my, mx + mw, my + mh);
  bg.addColorStop(0, '#0e1c34'); bg.addColorStop(1, '#050a16');
  ctx.fillStyle = bg; ctx.fill();
  ctx.save();
  ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 24; ctx.lineWidth = 2; ctx.strokeStyle = '#00e5ff'; ctx.stroke();
  ctx.restore();

  txt('TERMINAL // 作战频段直连', mx + mw / 2, my + 26, 15, '#7df9ff', 'center');
  txt('请输入房主 4 位房间码', mx + mw / 2, my + 46, 11, '#8fa0b8', 'center');

  const curCode = COOP_PIN_MODAL.code;
  const cw = 48, ch = 48, cgap = 10;
  const startX = mx + (mw - (4 * cw + 3 * cgap)) / 2, startY = my + 66;
  for (let i = 0; i < 4; i++) {
    const bx = startX + i * (cw + cgap);
    poBevel(bx, startY, cw, ch, 6);
    const hasChar = i < curCode.length;
    ctx.fillStyle = hasChar ? 'rgba(0, 229, 255, 0.16)' : 'rgba(255, 255, 255, 0.05)'; ctx.fill();
    ctx.strokeStyle = hasChar ? '#00e5ff' : 'rgba(255, 255, 255, 0.2)'; ctx.lineWidth = 1.2; ctx.stroke();
    txt(hasChar ? curCode[i] : '•', bx + cw / 2, startY + ch / 2, 22, hasChar ? '#ffd84a' : '#556578', 'center');
  }

  const numGrid = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['⌫', '0', '✔']
  ];
  const kw = 72, kh = 34, kgap = 8;
  const kStartX = mx + (mw - (3 * kw + 2 * kgap)) / 2, kStartY = my + 130;

  numGrid.forEach((row, r) => {
    row.forEach((key, c) => {
      const kx = kStartX + c * (kw + kgap), ky = kStartY + r * (kh + kgap);
      const isOk = key === '✔', isDel = key === '⌫';
      const canSubmit = curCode.length === 4;

      pBtn(kx, ky, kw, kh, key, {
        c: isOk ? (canSubmit ? '#2ed573' : '#334455') : (isDel ? '#ff4757' : '#00e5ff'),
        ghost: !isOk,
        dis: isOk && !canSubmit,
        sz: 14,
        cr: 6
      }, () => {
        if (isDel) {
          COOP_PIN_MODAL.code = COOP_PIN_MODAL.code.slice(0, -1);
        } else if (isOk) {
          if (canSubmit) {
            const codeToJoin = COOP_PIN_MODAL.code;
            COOP_PIN_MODAL.show = false;
            if (typeof coopJoinRoom === 'function') coopJoinRoom(codeToJoin);
          }
        } else {
          if (COOP_PIN_MODAL.code.length < 4) {
            COOP_PIN_MODAL.code += key;
          }
        }
      });
    });
  });

  pBtn(mx + (mw - 120) / 2, my + mh - 38, 120, 26, '✕ 取消并关闭', { c: '#8fa0b8', ghost: true, sz: 11, cr: 5 }, () => {
    COOP_PIN_MODAL.show = false;
  });

  ctx.restore();
}

// ---------- 3. 单人副本详情列表 ----------
function poChapterCard(i, cx, cy, sc, al, sel) {
  const ch = CHAPTERS[i], un = chapUnlocked(i), cd = chapCleared(i), done = chapDone(i), col = ch.col;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.globalAlpha = al * (un ? 1 : .55);
  rpath(-150, -54, 300, 108, 14);
  const g = ctx.createLinearGradient(-150, -54, 150, 54); g.addColorStop(0, col + (sel ? '88' : '44')); g.addColorStop(1, '#0a1020');
  ctx.fillStyle = g; ctx.fill();
  if (sel) { ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 18; ctx.lineWidth = 2.5; ctx.strokeStyle = col; ctx.stroke(); ctx.restore(); }
  else { ctx.lineWidth = 1.2; ctx.strokeStyle = col + '88'; ctx.stroke(); }
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
  const x = POX + 28, w = POW - 56, h = 40, sel = idx === selStageIdx, un = idx <= S.cl, cd = idx < S.cl;
  rpath(x, y, w, h, 10);
  if (sel) { const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, acc + '40'); g.addColorStop(1, acc + '10'); ctx.fillStyle = g; }
  else ctx.fillStyle = 'rgba(12,18,34,.8)';
  ctx.fill();
  if (sel) { ctx.save(); ctx.shadowColor = acc; ctx.shadowBlur = 10; ctx.lineWidth = 1.8; ctx.strokeStyle = acc; ctx.stroke(); ctx.restore(); }
  else { ctx.lineWidth = 1; ctx.strokeStyle = un ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.06)'; ctx.stroke(); }

  pHit(x, y, w, h, () => { if (!un) pToast('请先通关前置关卡'); else if (sel) pStartStage(idx); else selStageIdx = idx; });

  const bx = x + 28, by = y + h / 2;
  ctx.beginPath(); ctx.arc(bx, by, 14, 0, 7);
  ctx.fillStyle = sel ? acc + '44' : un ? 'rgba(255,216,74,.12)' : 'rgba(30,36,50,.8)'; ctx.fill();
  ctx.lineWidth = 1.4; ctx.strokeStyle = sel ? acc : un ? '#ffd84a' : '#555'; ctx.stroke();
  txt(s.n.split(' ')[0], bx, by, 11, un ? '#ffd84a' : '#777', 'center');

  const name = s.n.replace(/^\S+\s*/, ''), nx = x + 52;
  txt(name, nx, y + 13, 14, un ? (sel ? '#ffd84a' : '#fff') : '#666');
  
  let tagEnd = nx + tw(name, 14);
  if (s.b) { 
    const px = tagEnd + 8; 
    pPill(px, y + 5, 56, 16, un ? 'rgba(255,71,87,.22)' : 'rgba(80,80,90,.3)', un ? '#ff4757' : '#555'); 
    txt('★ 首领', px + 28, y + 13, 9.5, un ? '#ff8a95' : '#666', 'center');
    tagEnd = px + 60;
  }

  if (un) {
    const stCount = (S.stars && S.stars[idx]) || 0;
    const starX0 = tagEnd + 10;
    for (let i = 0; i < 3; i++) {
      const isLit = i < stCount;
      txt(isLit ? '⭐' : '☆', starX0 + i * 14, y + 13, 11, isLit ? '#ffd84a' : 'rgba(255,255,255,0.25)', 'center', false);
    }
  }

  txt('目标: ' + s.k + '只  |  产出≤Lv.' + s.r, nx, y + 28, 10.5, un ? '#9fb0c6' : '#555');
  const mx = x + 380, rel = poRel(s.r);
  txt('推荐 Lv.' + s.r, mx, y + 20, 12, un ? rel[1] : '#555');

  curT('🪙 ' + s.g.toLocaleString() + ' G', x + 530, y + 20, 12, un ? '#ffd84a' : '#555');
  if (un && idx >= S.cl && !s.wb) curT('💎 +' + FIRST_CLEAR_DIAMOND + ' 首通', x + 640, y + 20, 11, '#4fe3ff');

  const bw = 88, bh = 28, bxx = x + w - bw - 10, byy = y + 6;
  rpath(bxx, byy, bw, bh, 7);
  if (!un) { ctx.fillStyle = 'rgba(30,36,50,.6)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.stroke(); txt('🔒 未解锁', bxx + bw / 2, byy + bh / 2, 11, '#666', 'center'); }
  else if (sel) {
    const g = ctx.createLinearGradient(bxx, byy, bxx, byy + bh); g.addColorStop(0, acc); g.addColorStop(1, acc + 'aa');
    ctx.save(); ctx.shadowColor = acc; ctx.shadowBlur = 6; ctx.fillStyle = g; ctx.fill(); ctx.restore();
    txt('⚡ 出征', bxx + bw / 2, byy + bh / 2, 12, '#fff', 'center');
  } else if (cd) { ctx.fillStyle = 'rgba(46,213,115,.18)'; ctx.fill(); ctx.strokeStyle = '#2ed573'; ctx.lineWidth = 1; ctx.stroke(); txt('✔ 已通关', bxx + bw / 2, byy + bh / 2, 11, '#2ed573', 'center'); }
  else { ctx.fillStyle = 'rgba(255,216,74,.18)'; ctx.fill(); ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 1; ctx.stroke(); txt('可挑战', bxx + bw / 2, byy + bh / 2, 11, '#ffd84a', 'center'); }
}

const poRel = r => S.lv >= r ? ['实力充足', '#7dff9a'] : S.lv >= r - 5 ? ['势均力敌', '#ffd84a'] : ['危险', '#ff6b6b'];

function drawPoDun() {
  const ch = CHAPTERS[curChapIdx], acc = ch.col;
  poFrame(acc, '⚔️ 副本 · 章节战役');

  const order = CHAPTERS.map((_, i) => i).filter(i => Math.abs(i - PO.cp) < 2.2).sort((a, b) => Math.abs(b - PO.cp) - Math.abs(a - PO.cp));
  for (const i of order) {
    const d = i - PO.cp, ad = Math.abs(d), t = Math.min(1, ad);
    const sc = 1 - .3 * t - Math.max(0, ad - 1) * .06, cx = 480 + Math.sign(d) * (ad <= 1 ? ad * 255 : 255 + (ad - 1) * 120);
    const al = cl(1 - Math.max(0, ad - 1.1) * .9, 0, 1) * (1 - .25 * t);
    poChapterCard(i, cx, 139, sc, al, i === curChapIdx);
    if (al > .25) pHit(cx - 150 * sc, 139 - 54 * sc, 300 * sc, 108 * sc, () => setChap(i));
  }
  poArrow(POX + 12, 107, -1, curChapIdx > 0, acc, () => setChap(curChapIdx - 1));
  poArrow(POX + POW - 42, 107, 1, curChapIdx < CHAPTERS.length - 1, acc, () => setChap(curChapIdx + 1));

  txt(ch.sub + '  ——  ' + ch.desc, POX + 28, 218, 12, '#9ab', 'left');
  
  const totalStages = ch.stages.length;
  let curIndexInChap = ch.stages.indexOf(selStageIdx);
  if (curIndexInChap < 0) curIndexInChap = 0;

  const progTag = `关卡 ${curIndexInChap + 1} / ${totalStages}`;
  const tagW = 90, tagH = 22, tagX = POX + POW - 28 - tagW, tagY = 208;
  rpath(tagX, tagY, tagW, tagH, 11);
  ctx.fillStyle = 'rgba(12, 18, 34, 0.85)'; ctx.fill();
  ctx.strokeStyle = acc + '88'; ctx.lineWidth = 1.2; ctx.stroke();
  txt(progTag, tagX + tagW / 2, tagY + tagH / 2, 11, '#7df9ff', 'center');

  const WINDOW_SIZE = 5;
  let startIdx = typeof window._stageStartIdx === 'number' ? window._stageStartIdx : 0;
  if (curIndexInChap < startIdx) startIdx = curIndexInChap;
  else if (curIndexInChap >= startIdx + WINDOW_SIZE) startIdx = curIndexInChap - WINDOW_SIZE + 1;
  startIdx = Math.max(0, Math.min(startIdx, totalStages - WINDOW_SIZE));
  window._stageStartIdx = startIdx;

  const visibleStages = ch.stages.slice(startIdx, startIdx + WINDOW_SIZE);
  visibleStages.forEach((si, k) => poStageCard(ST[si], si, 234 + k * 44, acc));

  const un = selStageIdx <= S.cl;
  poFooter(acc, 'A/D 切换章节   W/S 滚动选择关卡   Enter 出征', { 
    label: un ? '⚡ 立即出征 [Enter]' : '🔒 关卡未解锁', 
    c: '#2ed573', 
    dis: !un, 
    f: () => pStartStage(selStageIdx) 
  });
}

// ---------- 4. 世界BOSS ----------
function poWBRow(w, i, y) {
  const x = POX + 24, rw = 256, h = 50, sel = PO.wb === i, open = wbOpen(w), k = wbData().kills[i] || 0;
  rpath(x, y, rw, h, 12);
  if (sel) { const g = ctx.createLinearGradient(x, 0, x + rw, 0); g.addColorStop(0, WB_COL + '44'); g.addColorStop(1, WB_COL + '10'); ctx.fillStyle = g; }
  else ctx.fillStyle = 'rgba(12,18,34,.8)';
  ctx.fill();
  if (sel) { ctx.save(); ctx.shadowColor = WB_COL; ctx.shadowBlur = 10; ctx.lineWidth = 2; ctx.strokeStyle = WB_COL; ctx.stroke(); ctx.restore(); }
  else { ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.stroke(); }
  ctx.beginPath(); ctx.arc(x + 28, y + h / 2, 18, 0, 7); ctx.fillStyle = open ? WB_COL + '33' : 'rgba(30,36,50,.8)'; ctx.fill();
  ctx.lineWidth = 1.4; ctx.strokeStyle = open ? WB_COL : '#555'; ctx.stroke();
  txt(open ? '👹' : '🔒', x + 28, y + h / 2 + 1, 16, '#fff', 'center', false);
  txt(w.n, x + 56, y + 18, 15, open ? (sel ? '#ffd84a' : '#fff') : '#778');
  txt(open ? '推荐 Lv.' + w.r + (WBG.s[i] ? '  ·  全服剩余 ' + wbPct(WBG.s[i]).toFixed(1) + '%' : (k ? '  ·  已击杀 ' + k + ' 次' : '')) : 'Lv.' + w.lv + ' 解锁', x + 56, y + 36, 11, open ? '#9fb0c6' : '#667');
  pHit(x, y, rw, h, () => { PO.wb = i; });
}

function drawPoWB() {
  const w = WB[PO.wb], open = wbOpen(w), Wd = wbData(), left = wbLeft(), total = WB_DAILY + (Wd.buy | 0), online = wbOnline();
  poFrame(WB_COL, '👹 世界BOSS · 全服共讨');
  WB.forEach((b, i) => poWBRow(b, i, 84 + i * 55));
  wbFetch(PO.wb);
  const g = WBG.s[PO.wb];

  const dx = POX + 296, dy = 84, dw = POW - 296 - 24, dh = 354;
  rpath(dx, dy, dw, dh, 16);
  const bg = ctx.createLinearGradient(dx, dy, dx + dw, dy + dh); bg.addColorStop(0, 'rgba(255,60,60,.16)'); bg.addColorStop(.5, 'rgba(12,16,32,.92)'); bg.addColorStop(1, 'rgba(8,10,22,.95)');
  ctx.fillStyle = bg; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = WB_COL + '66'; ctx.stroke();

  // ---- 左：首领立绘 ----
  const fx = dx + 100, fy = dy + 190;
  ctx.save(); ctx.translate(fx, fy);
  const aura = ctx.createRadialGradient(0, -6, 6, 0, -6, 100); aura.addColorStop(0, open ? 'rgba(255,60,60,.35)' : 'rgba(120,120,140,.15)'); aura.addColorStop(1, 'rgba(255,60,60,0)');
  ctx.fillStyle = aura; ctx.beginPath(); ctx.ellipse(0, -6, 100, 26, 0, 0, 7); ctx.fill();
  const pool = ENS[w.set] && ENS[w.set].boss, im = pool && pool[0];
  if (im && im.width) {
    const k = Math.min(160 / im.height, 168 / im.width), iw = im.width * k, ih = im.height * k, bob = Math.sin(T * 2) * 3;
    ctx.globalAlpha = open ? 1 : .35;
    if (open) { ctx.shadowColor = WB_COL; ctx.shadowBlur = 16 + 5 * Math.sin(T * 3); }
    ctx.drawImage(im, -iw / 2, -ih + bob, iw, ih);
  } else txt('👹', 0, -80, 80, '#fff', 'center', false);
  ctx.restore();
  if (!open) txt('🔒', fx, dy + 120, 40, '#fff', 'center', false);

  // ---- 右上：名称 / 全服血条 / 数据 ----
  const rx = dx + 208, rw = dw - 208 - 18;
  txt('WORLD BOSS · 全服共讨', rx, dy + 22, 11, WB_COL);
  txt(w.n, rx, dy + 48, 25, '#ffd84a');
  const hpMax = g ? g.max : wbMaxHp(PO.wb), hpNow = g ? g.hp : hpMax;
  txt('全服首领生命', rx, dy + 76, 11, '#8a97aa');
  txt(g ? wbPct(g).toFixed(wbPct(g) < 10 ? 2 : 1) + '%' : '—', rx + rw, dy + 76, 12.5, '#ff8a95', 'right');
  bar(rx, dy + 85, rw, 14, hpNow, hpMax, '#ff4757', '#ff9f43', 7);
  txt(g ? poN(hpNow) + ' / ' + poN(hpMax) : (!online ? '需要登录账号并联网' : WBG.err ? '无法连接：' + WBG.err.slice(0, 26) : '同步中…'), rx + rw / 2, dy + 92, 10, '#fff', 'center');
  txt(g && g.lastKiller ? '上一只首领被「' + g.lastKiller + '」终结' : '这只首领还没有被击杀过', rx, dy + 116, 11, '#9fb0c6');

  const stats = [['推荐等级', 'Lv.' + w.r, poRel(w.r)[1]], ['讨伐时限', w.tl + ' 秒', '#fff'], ['我的累计伤害', g ? poN(g.me) : '—', '#7df9ff']];
  stats.forEach((st, i) => {
    const sx = rx + i * 112, sy = dy + 144;
    rpath(sx - 4, sy - 14, 106, 42, 8); ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fill();
    txt(st[0], sx, sy, 11, '#8a97aa'); txt(st[1], sx, sy + 20, 15, st[2]);
  });

  // ---- 累计伤害 TOP3 ----
  const ty = dy + 206;
  txt('🏆 累计伤害 TOP 3', dx + 16, ty, 12, '#ffd84a');
  txt('本轮首领 · 被击杀后清零', dx + dw - 16, ty, 10.5, '#7a8aa0', 'right');
  const MEDAL = ['🥇', '🥈', '🥉'], MCOL = ['#ffd84a', '#cfd8e6', '#e0905a'], cw = (dw - 32 - 24) / 3;
  for (let i = 0; i < 3; i++) {
    const r = g && g.top && g.top[i], cx = dx + 16 + i * (cw + 12), cy = ty + 14;
    rpath(cx, cy, cw, 54, 10);
    ctx.fillStyle = r ? MCOL[i] + '14' : 'rgba(255,255,255,.03)'; ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = r ? MCOL[i] + '88' : 'rgba(255,255,255,.1)'; ctx.stroke();
    txt(MEDAL[i], cx + 22, cy + 27, 22, '#fff', 'center', false);
    if (r) {
      let nm = String(r.nick || '骑士'); if (nm.length > 7) nm = nm.slice(0, 7) + '…';
      txt(nm, cx + 44, cy + 19, 13, '#fff'); txt(poN(r.dmg), cx + 44, cy + 39, 14, MCOL[i]);
    } else txt('虚位以待', cx + 44, cy + 27, 12.5, '#5d6b80');
  }

  txt('💰 金币 + 💠 钻石（最高 ' + (WB_DIAM[PO.wb] || 30) + '）按你造成的伤害折算；最后一击者额外 +50%', dx + 16, dy + 292, 11.5, '#c9d4e6');
  txt('⚠ 超时 / 战败即结束并结算；撤退不消耗次数，但本次伤害不计入全服', dx + 16, dy + 310, 11.5, '#c9d4e6');

  // ---- 次数 ----
  txt('今日剩余', dx + 16, dy + 336, 12, '#9ab');
  const nd = Math.min(total, 10);
  for (let i = 0; i < nd; i++) {
    ctx.beginPath(); ctx.arc(dx + 88 + i * 19, dy + 336, 7, 0, 7); ctx.fillStyle = i < left ? WB_COL : 'rgba(255,255,255,.08)'; ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = WB_COL + 'aa'; ctx.stroke();
  }
  txt(left + ' / ' + total, dx + 88 + nd * 19 + 6, dy + 336, 12, left ? '#ffd84a' : '#ff6b6b');
  const ask = (PO.wbAsk || 0) > T;
  pBtn(dx + dw - 16 - 190, dy + 322, 190, 28, ask ? '再点一次确认 -' + WB_BUY_COST + ' 💎' : '💎 购买 1 次（' + WB_BUY_COST + ' 钻）', { c: '#4fe3ff', ghost: true, sz: 11.5, cr: 6 }, wbBuyClick);

  if (!open) { pPill(dx + dw - 168, dy + 12, 152, 24, 'rgba(255,71,87,.2)', '#ff4757'); txt('🔒 需要 Lv.' + w.lv + ' 解锁', dx + dw - 92, dy + 24, 12, '#ff8a95', 'center'); }

  const dis = !open || !online || left <= 0;
  poFooter(WB_COL, 'W/S 选择首领   Enter 发起讨伐', { label: !open ? '🔒 等级不足' : !online ? '需登录联网' : left <= 0 ? '次数已用完（可购买）' : '⚔ 发起讨伐 [Enter]', c: WB_COL, dis, f: pStartWB });
}

// ---------- 入口统一渲染分发 ----------
function drawPortalModal() {
  PO.hit = [];
  if (PO.view === 'tower' && PO._lastView !== 'tower') {
    PO.tw = (typeof twFrontier === 'function') ? twFrontier() : 1;
    PO._lastView = 'tower';
  } else if (PO.view !== 'tower') {
    PO._lastView = PO.view;
  }

  if (PO.view === 'hub') drawPoHub();
  else if (PO.view === 'dun') drawPoDun();
  else if (PO.view === 'coop') drawPoCoop();
  else if (PO.view === 'tower') drawPoTower();
  else if (PO.view === 'td') drawPoTD();
  else if (PO.view === 'rogue') {
    if (typeof drawPoRogue === 'function') drawPoRogue();
  }
  else drawPoWB();

  if (PO.tt > 0) {
    const w = tw(PO.toast, 13) + 36;
    ctx.save(); ctx.globalAlpha = Math.min(1, PO.tt * 2);
    pPill(480 - w / 2, POY + POH - 82, w, 24, 'rgba(10,12,22,.96)', '#ffd84a'); txt(PO.toast, 480, POY + POH - 70, 13, '#ffd84a', 'center');
    ctx.restore();
  }
}