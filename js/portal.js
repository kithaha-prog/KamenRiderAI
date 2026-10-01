// ===== 维度传送门：模式选择 / 单人副本 / 双人高难联机 / 世界BOSS =====
const NST = CHAPTERS.reduce((a, c) => a + c.stages.length, 0);
const POX = 40, POY = 22, POW = 880, POH = 496;
const PO = { view: 'hub', hub: 0, wb: 0, ret: 'hub', cp: 0, toast: '', tt: 0, hit: [] };
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
  if (!S.wb || typeof S.wb !== 'object') S.wb = { day, used: 0, best: {}, kills: {} };
  if (!S.wb.best) S.wb.best = {};
  if (!S.wb.kills) S.wb.kills = {};
  if (S.wb.day !== day) { S.wb.day = day; S.wb.used = 0; }
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
  PO.hub = PO.view === 'wb' ? 2 : PO.view === 'coop' ? 1 : 0;
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
function pStartWB() {
  const w = WB[PO.wb];
  if (!wbOpen(w)) return pToast('需要 Lv.' + w.lv + ' 才能挑战该首领');
  const D = wbData();
  if (D.used >= WB_DAILY) return pToast('今日讨伐次数已用完，明日重置');
  D.used++; save();
  PO.ret = 'wb'; M = 0; begin(w.si);
}

// 输入处理
function portalUpdate(dt) {
  PO.tt -= dt;
  PO.cp += (curChapIdx - PO.cp) * Math.min(1, dt * 12);
  const L = PR.KeyA || PR.ArrowLeft, R = PR.KeyD || PR.ArrowRight, U = PR.KeyW || PR.ArrowUp, D = PR.KeyS || PR.ArrowDown;
  const OK = PR.Enter || PR.Space || PR.KeyF;

  if (PR.Escape) { pBack(); delete PR.Escape; return; }

  // 0. 专属数码键盘输入拦截
  if (COOP_PIN_MODAL.show) {
    // 监听数字键 0-9
    for (let num = 0; num <= 9; num++) {
      if (PR['Digit' + num] || PR['Numpad' + num]) {
        delete PR['Digit' + num]; delete PR['Numpad' + num];
        if (COOP_PIN_MODAL.code.length < COOP_PIN_MODAL.maxLen) {
          COOP_PIN_MODAL.code += String(num);
        }
        return;
      }
    }
    // 退格删除
    if (PR.Backspace) {
      delete PR.Backspace;
      COOP_PIN_MODAL.code = COOP_PIN_MODAL.code.slice(0, -1);
      return;
    }
    // 回车直接提交
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
    if (R) PO.hub = Math.min(2, PO.hub + 1);
    if (OK) {
      if (PO.hub === 0) PO.view = 'dun';
      else if (PO.hub === 1) PO.view = 'coop';
      else if (PO.hub === 2) PO.view = 'wb';
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

// 基础科技按钮组件（★ 修复图一：主按钮文字采用纯白 #ffffff + 柔和暗色阴影）
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
    // ★ 统一采用纯白文字显示，彻底解决深黑看不清的问题
    txt(label, x + w / 2, y + h / 2, sz, '#ffffff', 'center');
  }
  if (f) pHit(x, y, w, h, f);
}

function pPill(x, y, w, h, fill, stroke) {
  poBevel(x, y, w, h, 5); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.lineWidth = 1; ctx.strokeStyle = stroke; ctx.stroke(); }
}

function poFrame(acc, title) {
  ctx.fillStyle = 'rgba(2, 4, 10, 0.94)'; ctx.fillRect(0, 0, 960, 540);
  poBevel(POX, POY, POW, POH, 18);
  const g = ctx.createLinearGradient(0, POY, 0, POY + POH);
  g.addColorStop(0, '#0c1628'); g.addColorStop(0.5, '#070d18'); g.addColorStop(1, '#040710');
  ctx.fillStyle = g; ctx.fill();

  ctx.save();
  poBevel(POX, POY, POW, POH, 18);
  ctx.shadowColor = acc; ctx.shadowBlur = 18; ctx.lineWidth = 1.8; ctx.strokeStyle = acc + '88'; ctx.stroke();
  ctx.restore();

  // 四角机械卡榫
  ctx.save();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.lineCap = 'square';
  const L = 14, C = 18;
  ctx.beginPath(); ctx.moveTo(POX + C + L, POY); ctx.lineTo(POX + C, POY); ctx.lineTo(POX, POY + C); ctx.lineTo(POX, POY + C + L); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(POX + POW - C - L, POY); ctx.lineTo(POX + POW - C, POY); ctx.lineTo(POX + POW, POY + C); ctx.lineTo(POX + POW, POY + C + L); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(POX, POY + POH - C - L); ctx.lineTo(POX, POY + POH - C); ctx.lineTo(POX + C, POY + POH); ctx.lineTo(POX + C + L, POY + POH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(POX + POW, POY + POH - C - L); ctx.lineTo(POX + POW, POY + POH - C); ctx.lineTo(POX + POW - C, POY + POH); ctx.lineTo(POX + POW - C - L, POY + POH); ctx.stroke();
  ctx.restore();

  txt(title, POX + 26, POY + 25, 17, '#ffffff');

  // 右上角资产监控胶囊
  const pills = [
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

// ---------- 1. 首页：三联装模式卡片 ----------
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
    if (idx === 0) PO.view = 'dun';
    else if (idx === 1) PO.view = 'coop';
    else if (idx === 2) PO.view = 'wb';
  });
  ctx.restore();
}

function drawPoHub() {
  poFrame('#00e5ff', '🌌 维度传送门 · 选择出征模式');
  const cw = 262, ch = 340, cy = POY + 68;
  const gap = 18;
  const x0 = POX + Math.round((POW - (3 * cw + 2 * gap)) / 2);

  poHubCard(x0, cy, cw, ch, 0, {
    c: '#00e5ff', icon: '⚔️', en: 'SOLO DUNGEON', title: '单人副本',
    d1: '20 大章 · 200 关卡 · 领主战役', d2: '单兵出征，稳步解锁神话装备',
    status(sx, sy, sw) {
      const c = Math.min(S.cl, NST);
      txt('通关进度', sx, sy, 11, '#9ab'); txt(c + ' / ' + NST, sx + sw, sy, 11, '#ffd84a', 'right');
      bar(sx, sy + 14, sw, 7, c, NST, '#00e5ff', '#7df9ff', 4);
    }
  });

  poHubCard(x0 + cw + gap, cy, cw, ch, 1, {
    c: '#2ed573', icon: '👥', en: 'CO-OP RAID', title: '双人高难',
    d1: '500% 领主血量 · 500% 赏金经验', d2: '双向伤害强同步 · 专属神话保底',
    status(sx, sy, sw) {
      const hasRoom = typeof COOP !== 'undefined' && COOP.active && COOP.roomCode;
      txt('战备状态', sx, sy, 11, '#9ab');
      txt(hasRoom ? `已在房间 [${COOP.roomCode}]` : '战备大厅就绪', sx + sw, sy, 11, hasRoom ? '#7dff9a' : '#2ed573', 'right');
      bar(sx, sy + 14, sw, 7, hasRoom ? 1 : 0, 1, '#2ed573', '#7dff9a', 4);
    }
  });

  poHubCard(x0 + (cw + gap) * 2, cy, cw, ch, 2, {
    c: WB_COL, icon: '👹', en: 'WORLD BOSS', title: '世界BOSS',
    d1: '限时挑战巨型首领 · 伤害结算', d2: '击杀必掉高阶装备与强化卷轴',
    status(sx, sy, sw) {
      const n = WB.filter(wbOpen).length, left = wbLeft();
      txt('今日剩余讨伐', sx, sy, 11, '#9ab');
      txt(left + ' / ' + WB_DAILY + ' (已开放 ' + n + ')', sx + sw, sy, 11, left ? '#ffd84a' : '#ff6b6b', 'right');
      bar(sx, sy + 14, sw, 7, left, WB_DAILY, '#ff4757', '#ff9f43', 4);
    }
  });

  poFooter('#00e5ff', 'A/D 切换模式   Enter/点击 进入', null);
}

// ---------- 2. ★ 联机大厅：重排间距（修复图二重叠）+ 接入数码输入弹窗（修复图三原生弹窗） ----------
function drawPoCoop() {
  poFrame('#2ed573', '👥 维度传送门 · 假面骑士双人协同高难副本');
  const inRoom = typeof COOP !== 'undefined' && COOP.active && COOP.roomCode;
  const coopList = (typeof COOP_STAGES !== 'undefined') ? COOP_STAGES : [];
  const curCoopObj = coopList[coopStageSelectIdx] || coopList[0] || { n: '双人深渊·翡翠巨兽 [试炼]', r: 15, g: 15000, desc: '全怪物 500% 血量' };

  if (!inRoom) {
    // 【未加入房间状态：左右分栏 1P 创建 vs 2P 直连】
    const w = 402, h = 348, cy = POY + 66, lx = POX + 24, rx = POX + POW - 24 - w;

    // 左侧：1P 房主创建专属副本
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

    let chipX = lx + 28;
    chipX += poBadge(chipX, missionCardY + 70, '500% 领主血量', '#ff6b81') + 6;
    chipX += poBadge(chipX, missionCardY + 70, '500% 赏金经验', '#ffd84a') + 6;
    poBadge(chipX, missionCardY + 70, '神话必掉', '#a55eea');

    txt(`领主: ${curCoopObj.bn || '强敌'}   |   赏金: +${curCoopObj.g.toLocaleString()} G   |   强化卷轴 ×10~15`, lx + 28, missionCardY + 104, 11, '#8fa0b8');
    txt(curCoopObj.desc || '', lx + 28, missionCardY + 126, 10.5, '#708398');

    pBtn(lx + 24, cy + 214, w - 48, 46, '⚡ 生成专属房间码 // CREATE ROOM', { c: '#2ed573', sz: 14.5, cr: 8 }, async () => {
      if (typeof coopCreateRoom === 'function') {
        await coopCreateRoom(curCoopObj.si);
      } else {
        pToast('未检测到 coop.js 模块');
      }
    });

    txt('系统将生成 4 位纯数字房间码，告知好友即可实时同步', lx + w / 2, cy + 280, 11, '#687a8e', 'center');

    // 右侧：2P 客机直连
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

    // ★ 修复图三：点击呼出专属全息数码输入键盘，彻底废除系统原生 prompt
    pBtn(rx + 24, cy + 214, w - 48, 46, '🔑 输入房间号并加入 // CONNECT', { c: '#00e5ff', sz: 14.5, cr: 8 }, () => {
      COOP_PIN_MODAL.show = true;
      COOP_PIN_MODAL.code = '';
    });

    txt('连接成功后双方动作姿态与怪兽血量将毫秒级强同步', rx + w / 2, cy + 280, 11, '#687a8e', 'center');

    poFooter('#2ed573', '点击选择专属高难副本 · 支持键盘 ◀ ▶ 快速切关', null);

  } else {
    // 【已在房间内：★ 彻底修复图二的文字按钮重叠问题，精准重排垂直间距】
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

    // 4位大号数码房间号卡片
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

    // 双席位玩家连接状态面板 (1P vs 2P)
    const slotY = cy + 104, sw = (w - 72) / 2, sh = 72;
    // 1P 席位
    poBevel(cx + 28, slotY, sw, sh, 8);
    ctx.fillStyle = 'rgba(12, 24, 40, 0.85)'; ctx.fill();
    ctx.strokeStyle = '#2ed573'; ctx.lineWidth = 1.2; ctx.stroke();
    txt('1P COMMANDER // 房主', cx + 40, slotY + 18, 10.5, '#2ed573');
    txt(COOP.isHost ? '你 (HOST)' : '房主 (HOST)', cx + 40, slotY + 38, 14, '#ffffff');
    txt('✔ 作战状态正常', cx + 40, slotY + 58, 10, '#7dff9a');

    // 2P 席位
    poBevel(cx + 36 + sw, slotY, sw, sh, 8);
    const conn = COOP.peerConnected;
    ctx.fillStyle = conn ? 'rgba(12, 28, 44, 0.85)' : 'rgba(28, 18, 20, 0.85)'; ctx.fill();
    ctx.strokeStyle = conn ? '#00e5ff' : '#ff9f43'; ctx.lineWidth = 1.2; ctx.stroke();
    txt('2P OPERATOR // 协同', cx + 48 + sw, slotY + 18, 10.5, conn ? '#00e5ff' : '#ff9f43');
    txt(conn ? (COOP.isHost ? '协同队员已加入' : '你 (CLIENT)') : '等待信号接入…', cx + 48 + sw, slotY + 38, 14, conn ? '#ffffff' : '#a2b4cb');
    txt(conn ? '✔ 双向同步就绪' : '⏳ 等待队友输入房间码', cx + 48 + sw, slotY + 58, 10, conn ? '#7dff9a' : '#ffa502');

    // 关卡任务简报条
    const stObj = ST[COOP.stageIdx] || ST[0];
    const briefY = slotY + sh + 10;
    poBevel(cx + 28, briefY, w - 56, 28, 6);
    ctx.fillStyle = 'rgba(6, 12, 24, 0.9)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.stroke();
    txt(`战役目标: ${stObj.n} (500% 血量 · 500% 赏金)`, cx + 38, briefY + 14, 11, '#ffd84a');

    // ★ 关键重构点：全员出征按钮与退出按钮各占专属高度，绝对不重合
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

    // 退出按钮垂直向下留出完整间隔
    pBtn(cx + (w - 150) / 2, btnY + 54, 150, 28, '🚪 解散 / 退出频段', { c: '#ff4757', ghost: true, sz: 11, cr: 5 }, () => {
      coopLeaveRoom();
    });

    poFooter('#2ed573', COOP.isHost ? '队友就绪后点击或按 Enter 即可全员出征' : '保持连接，房主出征后将自动载入', null);
  }

  // ★ 修复图三：若打开了专属输入弹窗，在最顶层绘制全息数码输入面板
  if (COOP_PIN_MODAL.show) {
    drawCoopPinModal();
  }
}

// ---------- ★ 修复图三新增：专属高科技数码键盘全息弹窗 (取代系统 prompt) ----------
function drawCoopPinModal() {
  // 全屏暗化阻隔层
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

  // 弹窗标题
  txt('TERMINAL // 作战频段直连', mx + mw / 2, my + 26, 15, '#7df9ff', 'center');
  txt('请输入房主 4 位房间码', mx + mw / 2, my + 46, 11, '#8fa0b8', 'center');

  // 四联装密码槽展示
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

  // 虚拟数字小键盘 (3 列 × 4 行)
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

  // 底部关闭取消按钮
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
  txt(open ? '推荐 Lv.' + w.r + (k ? '  ·  已讨伐 ' + k + ' 次' : '') : 'Lv.' + w.lv + ' 解锁', x + 56, y + 36, 11, open ? '#9fb0c6' : '#667');
  pHit(x, y, rw, h, () => { PO.wb = i; });
}

function drawPoWB() {
  const w = WB[PO.wb], open = wbOpen(w), Wd = wbData(), left = wbLeft();
  poFrame(WB_COL, '👹 世界BOSS · 限时讨伐');
  WB.forEach((b, i) => poWBRow(b, i, 84 + i * 55));

  const dx = POX + 296, dy = 84, dw = POW - 296 - 24, dh = 354;
  rpath(dx, dy, dw, dh, 16);
  const g = ctx.createLinearGradient(dx, dy, dx + dw, dy + dh); g.addColorStop(0, 'rgba(255,60,60,.16)'); g.addColorStop(.5, 'rgba(12,16,32,.92)'); g.addColorStop(1, 'rgba(8,10,22,.95)');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = WB_COL + '66'; ctx.stroke();

  const fx = dx + 112, fy = dy + 268;
  ctx.save(); ctx.translate(fx, fy);
  const aura = ctx.createRadialGradient(0, -6, 6, 0, -6, 110); aura.addColorStop(0, open ? 'rgba(255,60,60,.35)' : 'rgba(120,120,140,.15)'); aura.addColorStop(1, 'rgba(255,60,60,0)');
  ctx.fillStyle = aura; ctx.beginPath(); ctx.ellipse(0, -6, 110, 30, 0, 0, 7); ctx.fill();
  const pool = ENS[w.set] && ENS[w.set].boss, im = pool && pool[0];
  if (im && im.width) {
    const k = Math.min(230 / im.height, 190 / im.width), iw = im.width * k, ih = im.height * k, bob = Math.sin(T * 2) * 3;
    ctx.globalAlpha = open ? 1 : .35;
    if (open) { ctx.shadowColor = WB_COL; ctx.shadowBlur = 18 + 6 * Math.sin(T * 3); }
    ctx.drawImage(im, -iw / 2, -ih + bob, iw, ih);
  } else txt('👹', 0, -110, 90, '#fff', 'center', false);
  ctx.restore();
  if (!open) txt('🔒', fx, dy + 160, 40, '#fff', 'center', false);

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
  if (!open) { pPill(dx + dw - 168, dy + 12, 152, 24, 'rgba(255,71,87,.2)', '#ff4757'); txt('🔒 需要 Lv.' + w.lv + ' 解锁', dx + dw - 92, dy + 24, 12, '#ff8a95', 'center'); }

  const dis = !open || left <= 0;
  poFooter(WB_COL, 'W/S 选择首领   Enter 发起讨伐', { label: !open ? '🔒 等级不足' : left <= 0 ? '今日次数已用完' : '⚔ 发起讨伐 [Enter]', c: WB_COL, dis, f: pStartWB });
}

// ---------- 入口统一渲染分发 ----------
function drawPortalModal() {
  PO.hit = [];
  if (PO.view === 'hub') drawPoHub();
  else if (PO.view === 'dun') drawPoDun();
  else if (PO.view === 'coop') drawPoCoop();
  else drawPoWB();

  if (PO.tt > 0) {
    const w = tw(PO.toast, 13) + 36;
    ctx.save(); ctx.globalAlpha = Math.min(1, PO.tt * 2);
    pPill(480 - w / 2, POY + POH - 82, w, 24, 'rgba(10,12,22,.96)', '#ffd84a'); txt(PO.toast, 480, POY + POH - 70, 13, '#ffd84a', 'center');
    ctx.restore();
  }
}