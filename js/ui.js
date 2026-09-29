// ===== 基础 UI 渲染工具 =====
function rpath(x, y, w, h, r = 8) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r) }
  else { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath() }
}

function dr(S, i, x, y, fl = 1, sx = 1, al = 1, mid = 0) {
  ctx.save(); ctx.globalAlpha *= al; ctx.translate(x, y); ctx.scale(fl * S.s * sx, S.s * sx);
  ctx.drawImage(S.f[i], -S.cw / 2, mid ? -S.ch / 2 : -S.fy); ctx.restore();
}

function txt(s, x, y, sz = 16, c = '#fff', al = 'left', stk = true) {
  ctx.font = `700 ${sz}px -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif`;
  ctx.textAlign = al; ctx.textBaseline = 'middle';
  const ls = String(s).split('\n'), lh = sz * 1.32;
  ls.forEach((l, i) => {
    const py = y + i * lh;
    if (stk) { ctx.lineWidth = Math.max(2, sz * 0.16); ctx.strokeStyle = 'rgba(4,6,12,0.92)'; ctx.strokeText(l, x, py) }
    ctx.fillStyle = c; ctx.fillText(l, x, py);
  });
}

function bar(x, y, w, h, v, m, c1, c2 = null, r = 5) {
  rpath(x - 1.5, y - 1.5, w + 3, h + 3, r + 1); ctx.fillStyle = 'rgba(6,10,18,0.85)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.stroke();
  const fillW = Math.max(0, w * cl(v / m, 0, 1));
  if (fillW > 0) {
    rpath(x, y, fillW, h, r);
    if (c2) { const g = ctx.createLinearGradient(x, y, x + w, y); g.addColorStop(0, c1); g.addColorStop(1, c2); ctx.fillStyle = g }
    else ctx.fillStyle = c1;
    ctx.fill();
  }
}

// ===== HUD 仪表盘 =====
function drawPlayerHUD(x, y) {
  const w = 275, h = 76, r = 16;
  ctx.save();
  rpath(x, y, w, h, r); ctx.fillStyle = 'rgba(10, 16, 28, 0.88)'; ctx.fill();
  ctx.lineWidth = 1.6; ctx.strokeStyle = P.ryuki ? '#ff4757' : 'rgba(0, 229, 255, 0.55)'; ctx.stroke();

  const cx = x + 30, cy = y + 36, rad = 20;
  ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fillStyle = P.ryuki ? 'rgba(255, 71, 87, 0.25)' : 'rgba(0, 229, 255, 0.15)'; ctx.fill();
  ctx.strokeStyle = P.ryuki ? '#ff4757' : '#00e5ff'; ctx.lineWidth = 2; ctx.stroke();
  txt(P.ryuki ? 'RYU' : 'Lv', cx, cy - 7, 10, P.ryuki ? '#ff7675' : '#00e5ff', 'center', false);
  txt(S.lv, cx, cy + 7, 15, '#ffd84a', 'center', false);

  const maxExp = S.lv * 40, expW = 195, expVal = cl(S.xp / maxExp, 0, 1), bx = x + 64;
  bar(bx, y + 13, expW, 6, S.xp, maxExp, '#00d2d3', '#00e5ff', 3);
  txt(Math.floor(expVal * 100) + '%', bx + expW, y + 7, 9, '#7df9ff', 'right', false);

  const hpW = 195;
  bar(bx, y + 27, hpW, 16, P.hp, P.mh, '#ff4757', '#ff6b81', 6);
  txt('HP', bx + 6, y + 35, 11, '#fff', 'left');
  txt(Math.ceil(P.hp) + '/' + P.mh, bx + hpW - 6, y + 35, 11, '#fff', 'right');

  bar(bx, y + 49, hpW, 14, P.mp, P.mm, '#1e90ff', '#2ed573', 5);
  txt('MP', bx + 6, y + 56, 10, '#fff', 'left');
  txt((P.mp | 0) + '/' + P.mm, bx + hpW - 6, y + 56, 10, '#fff', 'right');
  ctx.restore();
}

function drawStaminaHUD(x, y) {
  const w = 275, h = 34;
  ctx.save();
  rpath(x, y, w, h, 12); ctx.fillStyle = 'rgba(10,16,28,0.88)'; ctx.fill();
  ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(0,229,255,0.45)'; ctx.stroke();

  const cx = x + 30, cy = y + 17, rad = 12, ready = P.dcd <= 0;
  ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fillStyle = ready ? 'rgba(0,229,255,0.3)' : 'rgba(30,36,52,0.95)'; ctx.fill();
  if (!ready) {
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, rad, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - P.dcd / DODGE_CD));
    ctx.closePath(); ctx.fillStyle = 'rgba(0,229,255,0.55)'; ctx.fill();
  }
  ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.strokeStyle = ready ? '#00e5ff' : '#5a6a80'; ctx.lineWidth = 2; ctx.stroke();
  txt('闪', cx, cy, 11, ready ? '#fff' : '#889', 'center', false);

  const bx = x + 64, bw = 195;
  bar(bx, y + 10, bw, 14, P.sta, P.stm, P.exh ? '#ff6b6b' : '#ffb300', P.exh ? '#ff9f43' : '#ffe066', 5);
  txt(P.exh ? 'EN 力竭' : 'EN', bx + 6, y + 17, 10, '#fff', 'left');
  txt(Math.ceil(P.sta) + '/' + P.stm, bx + bw - 6, y + 17, 10, '#fff', 'right');
  ctx.restore();
}

function drawGoldHUD() {
  const w = 145, h = 34, x = 960 - 18 - w, y = 14;
  ctx.save(); rpath(x, y, w, h, 14); ctx.fillStyle = 'rgba(12, 11, 20, 0.85)'; ctx.fill();
  ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(255, 216, 74, 0.65)'; ctx.stroke();
  txt('🪙 ' + S.g.toLocaleString() + ' G', x + w / 2, y + h / 2, 14, '#ffd84a', 'center');
  ctx.restore();
}

function drawMinimapHUD() {
  const mw = 196, mh = 82, x = 16, y = 405, r = 12;
  ctx.save(); rpath(x, y, mw, mh, r); ctx.fillStyle = 'rgba(8, 12, 22, 0.86)'; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0, 229, 255, 0.45)'; ctx.stroke();
  txt('RADAR', x + 12, y + 14, 10, '#00e5ff', 'left', false);

  const pulse = (Math.sin(T * 4) + 1) * 0.5;
  ctx.fillStyle = G === 'play' ? `rgba(255, 71, 87, ${0.4 + pulse * 0.6})` : `rgba(0, 229, 255, ${0.4 + pulse * 0.6})`;
  ctx.beginPath(); ctx.arc(x + mw - 16, y + 14, 4, 0, Math.PI * 2); ctx.fill();

  const rx = x + 12, ry = y + 26, rw = mw - 24, rh = 46;
  rpath(rx, ry, rw, rh, 6); ctx.fillStyle = 'rgba(4, 7, 14, 0.7)'; ctx.fill();
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.2)'; ctx.stroke();

  const isPlay = G === 'play', totalW = isPlay ? WW : (G === 'room' ? RW() : VW);
  const camX0 = rx + (cam / totalW) * rw, camW = (960 / totalW) * rw;
  rpath(camX0, ry + 2, camW, rh - 4, 3); ctx.fillStyle = 'rgba(0, 229, 255, 0.12)'; ctx.fill();

  if (!isPlay && G !== 'room') {
    const elx = rx + (EL.x / totalW) * rw;
    ctx.fillStyle = '#bbb'; ctx.beginPath(); ctx.arc(elx, ry + rh / 2, 3, 0, Math.PI * 2); ctx.fill();
    BD.forEach(b => {
      const bx = rx + (b.x / totalW) * rw;
      ctx.fillStyle = b.c; ctx.beginPath(); ctx.arc(bx, ry + rh / 2, 4, 0, Math.PI * 2); ctx.fill();
    });
    const ptx = rx + (PT / totalW) * rw;
    ctx.fillStyle = '#7df9ff'; ctx.beginPath(); ctx.arc(ptx, ry + rh / 2, 5, 0, Math.PI * 2); ctx.fill();
  }

  if (isPlay) {
    for (const e of E) {
      const ex = rx + (e.x / totalW) * rw, ey = ry + (e.t === 'imp' ? rh * 0.35 : rh * 0.65);
      ctx.fillStyle = e.t === 'boss' ? '#ff3838' : (e.t === 'wd' ? '#d6a2e8' : '#ff5252');
      ctx.beginPath(); ctx.arc(ex, ey, e.t === 'boss' ? 6 : 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  const px = rx + (P.x / totalW) * rw;
  ctx.fillStyle = P.ryuki ? '#ff4757' : '#2ed573';
  ctx.beginPath(); ctx.arc(px, ry + rh / 2, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.restore();
}

function drawLocationHUD(locName) {
  const x = 16, y = 496, w = 196, h = 30;
  ctx.save(); rpath(x, y, w, h, 10); ctx.fillStyle = 'rgba(8, 14, 26, 0.85)'; ctx.fill();
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)'; ctx.lineWidth = 1.2; ctx.stroke();
  txt('📍 ' + locName, x + 12, y + h / 2, 12, '#7df9ff', 'left', false);
  ctx.restore();
}

// ===== 详细部位 Filter 背包、等级需求、全选与批量分解 =====
function drawCharPanel() {
  const x = 25, y = 20, w = 910, h = 500;
  ctx.save();
  ctx.fillStyle = 'rgba(4, 7, 16, 0.88)'; ctx.fillRect(0, 0, 960, 540);

  rpath(x, y, w, h, 16); ctx.fillStyle = 'rgba(10, 14, 28, 0.96)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#00e5ff'; ctx.stroke();

  rpath(x + 2, y + 2, w - 4, 38, 14); ctx.fillStyle = 'rgba(0, 229, 255, 0.12)'; ctx.fill();
  txt('⚡ 假面骑士 MALAYA · 骑士装甲与无限战备背包 ⚡', x + 20, y + 21, 14, '#7df9ff', 'left');

  rpath(x + w - 90, y + 7, 75, 26, 6); ctx.fillStyle = 'rgba(255, 71, 87, 0.25)'; ctx.fill();
  ctx.strokeStyle = '#ff4757'; ctx.lineWidth = 1; ctx.stroke();
  txt('关闭 [C/ESC]', x + w - 52, y + 20, 11, '#ff7675', 'center');

  // 左侧穿戴槽位
  const lx = x + 18, ly = y + 46, lw = 345, lh = 440;
  rpath(lx, ly, lw, lh, 12); ctx.fillStyle = 'rgba(6, 9, 20, 0.65)'; ctx.fill();
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)'; ctx.stroke();

  rpath(lx + 10, ly + 10, lw - 20, 110, 8); ctx.fillStyle = 'rgba(12, 20, 38, 0.7)'; ctx.fill();
  ctx.strokeStyle = P.ryuki ? '#ff4757' : '#00e5ff'; ctx.stroke();

  ctx.save();
  ctx.beginPath(); ctx.ellipse(lx + 55, ly + 100, 36, 12, 0, 0, Math.PI * 2);
  ctx.fillStyle = P.ryuki ? 'rgba(255,71,87,0.3)' : 'rgba(0,229,255,0.25)'; ctx.fill();
  ctx.strokeStyle = P.ryuki ? '#ff4757' : '#00e5ff'; ctx.stroke();
  if (P.ryuki && SH.ryukiTrans && SH.ryukiTrans.f[15]) {
    dr(SH.ryukiTrans, 15, lx + 55, ly + 105, 1, 0.55);
  } else if (SH.atk && SH.atk.f[12]) {
    dr(SH.atk, 12, lx + 55, ly + 105, 1, 0.55);
  }
  ctx.restore();

  txt('假面骑士 MALAYA', lx + 115, ly + 25, 14, '#ffd84a', 'left');
  txt(P.ryuki ? '★ 龙骑契约形态' : '原生基础形态', lx + 115, ly + 45, 11, P.ryuki ? '#ff7675' : '#7df9ff');
  txt('等级: Lv.' + S.lv + ' (上限 500级)', lx + 115, ly + 65, 12, '#fff');
  txt('金币: ' + S.g + ' G', lx + 115, ly + 85, 11, '#ffd84a');
  txt('强化碎晶: ' + S.mat + ' 颗', lx + 115, ly + 103, 11, '#a55eea');

  const slotLayout = [
    { k: 'weapon', n: '武器', x: lx + 10, y: ly + 128 },
    { k: 'belt', n: '变身腰带', x: lx + 175, y: ly + 128 },
    { k: 'chest', n: '胸甲', x: lx + 10, y: ly + 176 },
    { k: 'necklace', n: '项链', x: lx + 175, y: ly + 176 },
    { k: 'legs', n: '腿甲', x: lx + 10, y: ly + 224 },
    { k: 'ring', n: '戒指', x: lx + 175, y: ly + 224 },
    { k: 'boots', n: '靴子', x: lx + 10, y: ly + 272 },
    { k: 'ryuki_cap', n: '变身胶囊', x: lx + 175, y: ly + 272 }
  ];

  slotLayout.forEach(sl => {
    const isCap = sl.k === 'ryuki_cap';
    const it = isCap ? (S.eqCap === 'ryuki' ? { name: '龙骑契约胶囊', tier: 4, lvl: 0 } : null) : S.eq[sl.k];
    const isSelected = selItem && selItem.from === 'eq' && selItem.slotKey === sl.k;

    rpath(sl.x, sl.y, 160, 42, 6);
    ctx.fillStyle = isSelected ? 'rgba(0, 229, 255, 0.22)' : 'rgba(8, 14, 28, 0.85)';
    ctx.fill();
    ctx.lineWidth = isSelected ? 1.8 : 1;
    ctx.strokeStyle = it ? TIERS[it.tier].c : 'rgba(255,255,255,0.12)';
    ctx.stroke();

    txt('[' + sl.n + ']', sl.x + 8, sl.y + 13, 10, '#889');
    if (it) {
      txt(it.name + (it.lvl ? ' +' + it.lvl : ''), sl.x + 8, sl.y + 29, 11, TIERS[it.tier].c);
    } else {
      txt(isCap ? '未装备 (按N装备)' : '空槽位 (可穿戴)', sl.x + 8, sl.y + 29, 11, '#556');
    }
  });

  rpath(lx + 10, ly + 322, lw - 20, 108, 8); ctx.fillStyle = 'rgba(8, 14, 30, 0.85)'; ctx.fill();
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.2)'; ctx.stroke();
  txt('【实战参数】', lx + 20, ly + 338, 11, '#7df9ff');
  txt('攻击力: ' + (P.atk | 0), lx + 20, ly + 360, 12, '#ff7675');
  txt('暴击率: ' + Math.round(P.cr * 100) + '%', lx + 120, ly + 360, 12, '#ffeaa7');
  txt('受到免伤: ' + (P.def * 100).toFixed(1) + '%', lx + 220, ly + 360, 12, '#7dff9a');
  txt('生命上限: ' + P.mh, lx + 20, ly + 384, 12, '#55efc4');
  txt('魔力上限: ' + P.mm, lx + 120, ly + 384, 12, '#74b9ff');

  // 右侧筛选栏、背包格子与批量工具
  const rx = x + 375, ry = y + 46, rw = 512, rh = 440;
  rpath(rx, ry, rw, rh, 12); ctx.fillStyle = 'rgba(6, 9, 20, 0.65)'; ctx.fill();
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)'; ctx.stroke();

  const filters = [
    { id: 'all', n: '全部' },
    { id: 'weapon', n: '武器' },
    { id: 'chest', n: '胸甲' },
    { id: 'belt', n: '腰带' },
    { id: 'legs', n: '腿甲' },
    { id: 'boots', n: '靴子' },
    { id: 'necklace', n: '项链' },
    { id: 'ring', n: '戒指' }
  ];

  const btnW = 58, btnGap = 4;
  filters.forEach((fl, idx) => {
    const fx = rx + 10 + idx * (btnW + btnGap), fy = ry + 8, fw = btnW, fh = 26;
    const isAct = bagFilter === fl.id;
    rpath(fx, fy, fw, fh, 5);
    ctx.fillStyle = isAct ? 'rgba(0, 229, 255, 0.3)' : 'rgba(20, 26, 44, 0.6)';
    ctx.fill();
    ctx.lineWidth = isAct ? 1.8 : 1;
    ctx.strokeStyle = isAct ? '#00e5ff' : 'rgba(255, 255, 255, 0.15)'; ctx.stroke();
    txt(fl.n, fx + fw / 2, fy + fh / 2, 11, isAct ? '#ffd84a' : '#aaa', 'center');
  });

  const filteredInv = S.inv.filter(it => (bagFilter === 'all' ? true : it.slot === bagFilter));
  const PAGE_SIZE = 15;
  const maxPages = Math.max(1, Math.ceil(filteredInv.length / PAGE_SIZE));
  if (bagPage >= maxPages) bagPage = maxPages - 1;

  const curFilterObj = filters.find(f => f.id === bagFilter) || filters[0];
  txt('部件: ' + curFilterObj.n + ' (' + filteredInv.length + '件)', rx + 12, ry + 46, 11, '#7df9ff');

  // 全选/取消全选按钮
  const allIn = filteredInv.length > 0 && filteredInv.every(it => batchSel.has(it.id));
  rpath(rx + 155, ry + 36, 75, 20, 4);
  ctx.fillStyle = allIn ? 'rgba(255, 71, 87, 0.3)' : 'rgba(0, 229, 255, 0.25)'; ctx.fill();
  ctx.strokeStyle = allIn ? '#ff4757' : '#00e5ff'; ctx.stroke();
  txt(allIn ? '取消全选' : '✔ 全部勾选', rx + 192, ry + 46, 10, allIn ? '#ff7675' : '#7df9ff', 'center');

  if (batchSel.size > 0) {
    txt(`已勾选: ${batchSel.size} 件`, rx + 242, ry + 46, 11, '#ffd84a');
  }

  // 分页控件
  txt('第 ' + (bagPage + 1) + ' / ' + maxPages + ' 页', rx + 400, ry + 46, 11, '#aaa', 'center');
  rpath(rx + 338, ry + 36, 26, 20, 4); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
  txt('◀', rx + 351, ry + 46, 11, bagPage > 0 ? '#fff' : '#555', 'center');
  rpath(rx + 448, ry + 36, 26, 20, 4); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
  txt('▶', rx + 461, ry + 46, 11, bagPage < maxPages - 1 ? '#fff' : '#555', 'center');

  const curPageItems = filteredInv.slice(bagPage * PAGE_SIZE, (bagPage + 1) * PAGE_SIZE);
  const gx0 = rx + 10, gy0 = ry + 60, gw = 95, gh = 48, gap = 4;

  for (let i = 0; i < PAGE_SIZE; i++) {
    const col = i % 5, row = (i / 5) | 0;
    const cx = gx0 + col * (gw + gap), cy = gy0 + row * (gh + gap);
    const item = curPageItems[i];
    const isSelected = selItem && selItem.item && item && selItem.item.id === item.id;
    const isChecked = item && batchSel.has(item.id);

    rpath(cx, cy, gw, gh, 6);
    ctx.fillStyle = isSelected ? 'rgba(0, 229, 255, 0.28)' : 'rgba(12, 16, 32, 0.85)';
    ctx.fill();
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.strokeStyle = item ? TIERS[item.tier].c : 'rgba(255, 255, 255, 0.08)';
    ctx.stroke();

    if (item) {
      txt(item.name, cx + 6, cy + 14, 10, TIERS[item.tier].c);
      txt('Lv.' + (item.reqLvl || 1) + (item.lvl ? ' +' + item.lvl : ''), cx + 6, cy + 32, 9, (item.reqLvl > S.lv) ? '#ff4757' : '#889');

      // 右上角勾选框
      const cbX = cx + gw - 18, cbY = cy + 4, cbS = 14;
      rpath(cbX, cbY, cbS, cbS, 3);
      ctx.fillStyle = isChecked ? '#00e5ff' : 'rgba(255,255,255,0.1)'; ctx.fill();
      ctx.strokeStyle = isChecked ? '#fff' : 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.stroke();
      if (isChecked) txt('✔', cbX + 7, cbY + 7, 10, '#041018', 'center', false);
    } else {
      txt('+', cx + gw / 2, cy + gh / 2, 14, 'rgba(255,255,255,0.08)', 'center');
    }
  }

  // 底部详情与批量处理控制栏
  const detY = ry + 218, detH = 212;
  rpath(rx + 10, detY, rw - 20, detH, 10); ctx.fillStyle = 'rgba(8, 12, 24, 0.92)'; ctx.fill();
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)'; ctx.stroke();

  // 若处于批量勾选状态，优先展示批量处理面板
  if (batchSel.size > 0) {
    let totalG = 0, totalMat = 0;
    S.inv.forEach(it => {
      if (batchSel.has(it.id)) {
        totalG += (it.tier + 1) * 45 + it.lvl * 40;
        totalMat += TIERS[it.tier].scrap + it.lvl * 2;
      }
    });

    txt(`📦 【批量勾选管理模式】 当前已选中 ${batchSel.size} 件装备`, rx + 25, detY + 24, 15, '#ffd84a');
    txt('• 可一键将所有勾选的闲置装备进行批量分解或批量丢弃。', rx + 25, detY + 54, 12, '#889');
    txt(`• 预估批量分解收益：金币 +${totalG} G   |   强化碎晶 +${totalMat} 颗`, rx + 25, detY + 78, 13, '#7dff9a');
    txt('• 提示：穿戴中的装备无法勾选，安全无误拆风险。', rx + 25, detY + 104, 11, '#7df9ff');

    if (bagNoticeT > 0) txt(bagNotice, rx + 25, detY + 130, 13, '#ffd84a');

    const btnY = detY + 155, btnH = 34;
    // 取消全选
    rpath(rx + 22, btnY, 110, btnH, 6); ctx.fillStyle = '#4b6584'; ctx.fill();
    txt('取消全部勾选', rx + 22 + 55, btnY + btnH / 2, 12, '#fff', 'center');

    // 批量分解
    rpath(rx + 150, btnY, 160, btnH, 6); ctx.fillStyle = '#a55eea'; ctx.fill();
    ctx.strokeStyle = '#d6a2e8'; ctx.stroke();
    txt(`批量分解 (${batchSel.size}件)`, rx + 150 + 80, btnY + btnH / 2, 13, '#fff', 'center');

    // 批量丢弃
    rpath(rx + 330, btnY, 145, btnH, 6); ctx.fillStyle = '#eb3b5a'; ctx.fill();
    ctx.strokeStyle = '#ff7675'; ctx.stroke();
    txt(`批量丢弃 (${batchSel.size}件)`, rx + 330 + 72, btnY + btnH / 2, 13, '#fff', 'center');
    ctx.restore();
    return;
  }

  // 单件装备详情与常规对比
  if (selItem && selItem.item) {
    const it = selItem.item;
    const tier = TIERS[it.tier];
    const slotInfo = SLOTS[it.slot];
    const currEq = S.eq[it.slot];
    const reqLvl = it.reqLvl || 1;
    const canWear = S.lv >= reqLvl;

    txt(it.name + (it.lvl ? ' +' + it.lvl : ''), rx + 25, detY + 22, 15, tier.c);
    txt('【' + tier.n + ' · ' + slotInfo.n + '】', rx + 185, detY + 22, 12, '#ffd84a');
    txt('需求等级: Lv.' + reqLvl, rx + 295, detY + 22, 12, canWear ? '#7dff9a' : '#ff4757');

    const renderDelta = (statName, newVal, oldVal, dy, isPercent = false) => {
      if (!newVal && !oldVal) return;
      const d = newVal - oldVal;
      let dStr = '';
      let dCol = '#888';
      if (d > 0) { dStr = ' (+' + (isPercent ? Math.round(d * 100) + '%' : d) + ' ▲)'; dCol = '#2ed573'; }
      else if (d < 0) { dStr = ' (' + (isPercent ? Math.round(d * 100) + '%' : d) + ' ▼)'; dCol = '#ff4757'; }
      else { dStr = ' (=)'; }

      const valShow = isPercent ? Math.round(newVal * 100) + '%' : newVal;
      txt(statName + ': ' + valShow, rx + 25, detY + dy, 12, '#fff');
      txt(dStr, rx + 130, detY + dy, 11, dCol);
    };

    const oldStats = (currEq && currEq.stats) ? currEq.stats : { atk: 0, hp: 0, mp: 0, crit: 0, def: 0 };
    renderDelta('攻击力', it.stats.atk || 0, oldStats.atk || 0, 48);
    renderDelta('生命值', it.stats.hp || 0, oldStats.hp || 0, 68);
    renderDelta('魔力值', it.stats.mp || 0, oldStats.mp || 0, 88);
    renderDelta('暴击率', it.stats.crit || 0, oldStats.crit || 0, 108, true);
    renderDelta('免伤值', it.stats.def || 0, oldStats.def || 0, 128);

    const goldCost = (it.lvl + 1) * 60 * (it.tier + 1);
    const scrapCost = (it.lvl + 1) * Math.max(1, it.tier);
    txt('强化升级预览: 每次强化基础全属性提升 12%', rx + 220, detY + 48, 10, '#7df9ff');
    txt('强化消耗: ' + goldCost + ' G  |  ' + scrapCost + ' 碎晶', rx + 220, detY + 68, 11, '#ffd84a');
    txt(selItem.from === 'eq' ? '★ 当前状态：正在穿戴中' : (currEq ? '对比穿戴: ' + currEq.name : '该槽位目前空置'), rx + 220, detY + 88, 10, '#aaa');

    if (!canWear && selItem.from !== 'eq') {
      txt('⚠️ 当前玩家等级不足 Lv.' + reqLvl + '，无法装备！', rx + 220, detY + 110, 11, '#ff6b81');
    } else if (bagNoticeT > 0) {
      txt(bagNotice, rx + 220, detY + 115, 12, '#7dff9a');
    }

    const btnY = detY + 155, btnH = 34;
    const isWorn = selItem.from === 'eq';

    rpath(rx + 22, btnY, 105, btnH, 6);
    ctx.fillStyle = isWorn ? '#2e86de' : (canWear ? '#2ed573' : '#57606f'); ctx.fill();
    txt(isWorn ? '卸下装备' : (canWear ? '穿戴装备' : '等级不足'), rx + 22 + 52, btnY + btnH / 2, 12, '#fff', 'center');

    rpath(rx + 140, btnY, 105, btnH, 6); ctx.fillStyle = '#ff9f43'; ctx.fill();
    txt('强化升级 +1', rx + 140 + 52, btnY + btnH / 2, 12, '#fff', 'center');

    rpath(rx + 258, btnY, 105, btnH, 6); ctx.fillStyle = '#a55eea'; ctx.fill();
    txt('分解 (返碎晶)', rx + 258 + 52, btnY + btnH / 2, 12, '#fff', 'center');

    rpath(rx + 376, btnY, 105, btnH, 6); ctx.fillStyle = '#eb3b5a'; ctx.fill();
    txt('丢弃装备', rx + 376 + 52, btnY + btnH / 2, 12, '#fff', 'center');
  } else {
    txt('【装备整备室】', rx + 25, detY + 25, 13, '#7df9ff');
    txt('• 点击背包格子可查看装备详情与对比\n' +
      '• 点击右上角勾选框或【全部勾选】按钮，可开启批量分解/丢弃\n' +
      '• 高等级副本将掉落更高装备等级（满级500级）的神兵利器\n' +
      '• 变身胶囊已迁移至专属终端，按 [N] 键随时呼出！', rx + 25, detY + 70, 12, '#889');
    if (bagNoticeT > 0) txt(bagNotice, rx + 25, detY + 160, 13, '#7dff9a');
  }
  ctx.restore();
}

// ===== 极速胶囊检索与契约驱动终端 (按 N 键呼出) =====
function drawCapsuleModal() {
  const pw = 780, ph = 470, px = (960 - pw) / 2, py = 35;
  ctx.save();
  ctx.fillStyle = 'rgba(4, 6, 16, 0.90)'; ctx.fillRect(0, 0, 960, 540);

  // 终端主面板背景
  rpath(px, py, pw, ph, 16); ctx.fillStyle = 'rgba(10, 14, 28, 0.97)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#00e5ff'; ctx.stroke();

  // 顶栏标题
  rpath(px + 2, py + 2, pw - 4, 38, 14); ctx.fillStyle = 'rgba(0, 229, 255, 0.14)'; ctx.fill();
  txt('⚡ 假面骑士变身胶囊 · 契约驱动终端 [N] ⚡', px + 20, py + 21, 14, '#7df9ff', 'left');

  // 关闭按钮
  rpath(px + pw - 85, py + 7, 72, 26, 6); ctx.fillStyle = 'rgba(255, 71, 87, 0.25)'; ctx.fill();
  ctx.strokeStyle = '#ff4757'; ctx.lineWidth = 1; ctx.stroke();
  txt('关闭 [N/ESC]', px + pw - 49, py + 20, 11, '#ff7675', 'center');

  // ==================== 左侧：胶囊矩阵快速检索列表 ====================
  const lx = px + 18, ly = py + 48, lw = 360, lh = 405;
  rpath(lx, ly, lw, lh, 10); ctx.fillStyle = 'rgba(6, 9, 20, 0.65)'; ctx.fill();
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)'; ctx.stroke();

  // 快速过滤按钮 (全部 / 已拥有 / 当前装配)
  const filters = [
    { id: 'all', n: '全部胶囊' },
    { id: 'owned', n: '已拥有' },
    { id: 'equipped', n: '当前装配' }
  ];
  const fW = 106, fGap = 6;
  filters.forEach((fl, i) => {
    const fx = lx + 12 + i * (fW + fGap), fy = ly + 10, fh = 26;
    const isAct = capFilter === fl.id;
    rpath(fx, fy, fW, fh, 5);
    ctx.fillStyle = isAct ? 'rgba(0, 229, 255, 0.3)' : 'rgba(20, 26, 44, 0.6)'; ctx.fill();
    ctx.strokeStyle = isAct ? '#00e5ff' : 'rgba(255, 255, 255, 0.15)'; ctx.lineWidth = isAct ? 1.6 : 1; ctx.stroke();
    txt(fl.n, fx + fW / 2, fy + fh / 2, 11, isAct ? '#ffd84a' : '#aaa', 'center');
  });

  // 根据当前过滤器筛选真实存在的胶囊列表
  const filteredCaps = CAPSULES.filter(c => {
    const isOwned = S.caps.includes(c.id);
    const isEq = S.eqCap === c.id;
    if (capFilter === 'owned') return isOwned;
    if (capFilter === 'equipped') return isEq;
    return true;
  });

  const PAGE_CAP_SIZE = 5;
  const maxCapPages = Math.max(1, Math.ceil(filteredCaps.length / PAGE_CAP_SIZE));
  if (capPage >= maxCapPages) capPage = maxCapPages - 1;

  // 胶囊条目列表渲染（只渲染有真实数据的项）
  const curPageCaps = filteredCaps.slice(capPage * PAGE_CAP_SIZE, (capPage + 1) * PAGE_CAP_SIZE);
  const rowH = 58, rowGap = 6, rowY0 = ly + 44;

  if (curPageCaps.length === 0) {
    txt('暂无匹配的胶囊数据', lx + lw / 2, ly + lh / 2 - 15, 13, '#667', 'center');
    txt('（可在基地扭蛋终端抽取新契约）', lx + lw / 2, ly + lh / 2 + 10, 11, '#445', 'center');
  } else {
    curPageCaps.forEach((c, i) => {
      const rowY = rowY0 + i * (rowH + rowGap);
      const isSel = curSelCapId === c.id;
      const isEq = S.eqCap === c.id;
      const isOwned = S.caps.includes(c.id);

      rpath(lx + 12, rowY, lw - 24, rowH, 8);
      ctx.fillStyle = isSel ? 'rgba(0, 229, 255, 0.22)' : 'rgba(12, 18, 36, 0.85)'; ctx.fill();
      ctx.lineWidth = isSel ? 1.8 : 1;
      ctx.strokeStyle = isEq ? '#2ed573' : (isSel ? '#00e5ff' : (isOwned ? c.c : 'rgba(255,255,255,0.1)'));
      ctx.stroke();

      // 核心微缩图标徽记
      const iconX = lx + 36, iconY = rowY + rowH / 2;
      ctx.beginPath(); ctx.arc(iconX, iconY, 18, 0, Math.PI * 2);
      ctx.fillStyle = isOwned ? `${c.c}33` : 'rgba(30, 36, 50, 0.8)'; ctx.fill();
      ctx.strokeStyle = isOwned ? c.c : '#555'; ctx.lineWidth = 1.5; ctx.stroke();
      txt(c.rider[0], iconX, iconY, 13, isOwned ? '#fff' : '#666', 'center');

      // 胶囊名称与类别标签
      txt(c.name, lx + 64, rowY + 18, 12, isOwned ? (isSel ? '#ffd84a' : '#fff') : '#777');
      txt(c.tag + ' · ' + c.rider, lx + 64, rowY + 38, 10, isOwned ? '#889' : '#555');

      // 状态标识徽章
      const tagW = 68, tagH = 22, tagX = lx + lw - 24 - tagW - 8, tagY = rowY + (rowH - tagH) / 2;
      rpath(tagX, tagY, tagW, tagH, 4);
      if (isEq) {
        ctx.fillStyle = 'rgba(46, 213, 115, 0.25)'; ctx.fill();
        ctx.strokeStyle = '#2ed573'; ctx.stroke();
        txt('★ 装配中', tagX + tagW / 2, tagY + tagH / 2, 10, '#2ed573', 'center');
      } else if (isOwned) {
        ctx.fillStyle = 'rgba(255, 216, 74, 0.2)'; ctx.fill();
        ctx.strokeStyle = '#ffd84a'; ctx.stroke();
        txt('可装配', tagX + tagW / 2, tagY + tagH / 2, 10, '#ffd84a', 'center');
      } else {
        ctx.fillStyle = 'rgba(40, 44, 60, 0.6)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'; ctx.stroke();
        txt('🔒 未解锁', tagX + tagW / 2, tagY + tagH / 2, 10, '#666', 'center');
      }
    });
  }

  // 翻页底栏
  const btmY = ly + lh - 34;
  rpath(lx + 12, btmY, 32, 22, 4); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
  txt('◀', lx + 28, btmY + 11, 12, capPage > 0 ? '#fff' : '#444', 'center');

  txt(`第 ${capPage + 1} / ${maxCapPages} 页 (共 ${filteredCaps.length} 件)`, lx + lw / 2, btmY + 11, 11, '#889', 'center');

  rpath(lx + lw - 12 - 32, btmY, 32, 22, 4); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
  txt('▶', lx + lw - 12 - 16, btmY + 11, 12, capPage < maxCapPages - 1 ? '#fff' : '#444', 'center');

  // ==================== 右侧：选定胶囊详细数据与装配控制 ====================
  const rx = px + 392, ry = py + 48, rw = 370, rh = 405;
  rpath(rx, ry, rw, rh, 10); ctx.fillStyle = 'rgba(6, 9, 20, 0.65)'; ctx.fill();
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)'; ctx.stroke();

  const selCap = CAPSULES.find(c => c.id === curSelCapId) || CAPSULES[0];
  const isCapOwned = selCap ? S.caps.includes(selCap.id) : false;
  const isCapEquipped = selCap ? S.eqCap === selCap.id : false;

  if (selCap) {
    // 胶囊卡面展示框
    const cardH = 150;
    rpath(rx + 12, ry + 12, rw - 24, cardH, 8);
    ctx.fillStyle = 'rgba(12, 18, 36, 0.9)'; ctx.fill();
    ctx.strokeStyle = isCapEquipped ? '#2ed573' : (isCapOwned ? selCap.c : 'rgba(255,255,255,0.15)'); ctx.lineWidth = 1.6; ctx.stroke();

    if (selCap.id === 'ryuki' && CAP_IMG) {
      ctx.save();
      rpath(rx + 14, ry + 14, rw - 28, cardH - 4, 6); ctx.clip();
      ctx.drawImage(CAP_IMG, rx + 14, ry + 14, rw - 28, cardH - 4);
      ctx.restore();
    } else {
      ctx.save();
      const cx = rx + (rw / 2), cy = ry + 75;
      ctx.beginPath(); ctx.arc(cx, cy, 42, 0, Math.PI * 2);
      ctx.fillStyle = isCapOwned ? `${selCap.c}28` : 'rgba(30, 36, 50, 0.5)'; ctx.fill();
      ctx.strokeStyle = isCapOwned ? selCap.c : '#666'; ctx.lineWidth = 2; ctx.stroke();
      txt(selCap.rider, cx, cy - 6, 14, isCapOwned ? '#fff' : '#777', 'center');
      txt(selCap.tag, cx, cy + 12, 11, isCapOwned ? selCap.c : '#555', 'center');
      ctx.restore();
    }

    // 骑士名称与状态横条
    txt(selCap.name + ' · ' + selCap.rider, rx + 16, ry + cardH + 24, 14, selCap.c);
    txt('品质：' + TIERS[selCap.tier].n + '契约级', rx + rw - 16, ry + cardH + 24, 11, TIERS[selCap.tier].c, 'right');

    // 一键装配/卸下大按钮
    const actBtnY = ry + cardH + 42, actBtnH = 36;
    rpath(rx + 14, actBtnY, rw - 28, actBtnH, 8);
    if (!isCapOwned) {
      ctx.fillStyle = 'rgba(40, 48, 64, 0.8)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.stroke();
      txt('🔒 尚未拥有此胶囊（可前往扭蛋终端抽取）', rx + rw / 2, actBtnY + actBtnH / 2, 12, '#889', 'center');
    } else if (isCapEquipped) {
      ctx.fillStyle = '#2e86de'; ctx.fill();
      ctx.strokeStyle = '#70a1ff'; ctx.stroke();
      txt('✔ 当前已装配 [点击卸下契约]', rx + rw / 2, actBtnY + actBtnH / 2, 13, '#fff', 'center');
    } else {
      ctx.fillStyle = '#ff4757'; ctx.fill();
      ctx.strokeStyle = '#ff7675'; ctx.stroke();
      txt('⚡ 立即装配该变身胶囊', rx + rw / 2, actBtnY + actBtnH / 2, 13, '#fff', 'center');
    }

    // 属性加成与必杀技参数卡片
    const infoY = actBtnY + actBtnH + 12, infoH = rh - (infoY - ry) - 12;
    rpath(rx + 14, infoY, rw - 28, infoH, 8);
    ctx.fillStyle = 'rgba(8, 12, 24, 0.85)'; ctx.fill();
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.2)'; ctx.stroke();

    txt('【契约战力加成】', rx + 24, infoY + 18, 11, '#7df9ff');
    txt('• ' + selCap.buff, rx + 24, infoY + 38, 11, '#ffd84a');

    txt('【终结必杀技】', rx + 24, infoY + 62, 11, '#ff7675');
    txt('• ' + selCap.finisher, rx + 24, infoY + 80, 11, '#fff');

    txt('【战术说明】', rx + 24, infoY + 104, 11, '#2ed573');
    txt(selCap.desc + '\n战斗或基地中随时按【P键】即可进行变身/解除！', rx + 24, infoY + 122, 10, '#889');
  }

  ctx.restore();
}

// ===== 章节化传送门 =====
function drawPortalModal() {
  const pw = 680, ph = 472, px = (960 - pw) / 2, py = 34;
  ctx.save();
  ctx.fillStyle = 'rgba(4, 6, 16, 0.88)'; ctx.fillRect(0, 0, 960, 540);

  rpath(px, py, pw, ph, 16); ctx.fillStyle = 'rgba(10, 14, 28, 0.96)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#00e5ff'; ctx.stroke();

  rpath(px + 2, py + 2, pw - 4, 38, 14); ctx.fillStyle = 'rgba(0, 229, 255, 0.14)'; ctx.fill();
  txt('🌌 维度传送门 · 战区战役部署', px + 20, py + 21, 15, '#7df9ff', 'left');
  txt(`金币: ${S.g} G   Lv.${S.lv}   通关进度: ${Math.min(S.cl, ST.length)}/${ST.length}`, px + pw - 20, py + 21, 12, '#ffd84a', 'right');

  const chapBarY = py + 48;
  txt('【章节选择】', px + 20, chapBarY + 14, 12, '#00e5ff');

  rpath(px + 90, chapBarY, 28, 28, 6);
  ctx.fillStyle = curChapIdx > 0 ? 'rgba(0,229,255,0.2)' : 'rgba(255,255,255,0.05)'; ctx.fill();
  ctx.strokeStyle = curChapIdx > 0 ? '#00e5ff' : '#444'; ctx.stroke();
  txt('◀', px + 104, chapBarY + 14, 12, curChapIdx > 0 ? '#fff' : '#666', 'center');

  rpath(px + pw - 38, chapBarY, 28, 28, 6);
  const hasNextChap = curChapIdx < CHAPTERS.length - 1;
  ctx.fillStyle = hasNextChap ? 'rgba(0,229,255,0.2)' : 'rgba(255,255,255,0.05)'; ctx.fill();
  ctx.strokeStyle = hasNextChap ? '#00e5ff' : '#444'; ctx.stroke();
  txt('▶', px + pw - 24, chapBarY + 14, 12, hasNextChap ? '#fff' : '#666', 'center');

  const chapListX = px + 126, chapListW = pw - 172;
  ctx.save();
  rpath(chapListX, chapBarY - 2, chapListW, 32, 6); ctx.clip();

  const tabW = 230, tabGap = 10;
  CHAPTERS.forEach((chap, idx) => {
    const tabX = chapListX + idx * (tabW + tabGap) + chapScrollX;
    const isAct = idx === curChapIdx;
    const isUnlocked = chap.stages[0] <= S.cl;
    const isCleared = chap.stages.every(s => s < S.cl);

    rpath(tabX, chapBarY, tabW, 28, 6);
    ctx.fillStyle = isAct ? 'rgba(0, 229, 255, 0.28)' : 'rgba(16, 22, 40, 0.7)'; ctx.fill();
    ctx.lineWidth = isAct ? 1.8 : 1;
    ctx.strokeStyle = isAct ? '#00e5ff' : (isUnlocked ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'); ctx.stroke();

    const tagText = isCleared ? ' [✔已通关]' : (isUnlocked ? ' [挑战中]' : ' [🔒未解锁]');
    txt(chap.name + ' · ' + chap.title + tagText, tabX + tabW / 2, chapBarY + 14, 11, isAct ? '#ffd84a' : (isUnlocked ? '#ddd' : '#777'), 'center');
  });
  ctx.restore();

  const currChap = CHAPTERS[curChapIdx];
  txt(currChap.sub + ' —— ' + currChap.desc, px + 22, py + 88, 11, '#889');

  const stagesY = py + 104;
  currChap.stages.forEach((stIdx, i) => {
    const s = ST[stIdx];
    const isSel = stIdx === selStageIdx;
    const isUnlocked = stIdx <= S.cl;
    const isCleared = stIdx < S.cl;
    const sy = stagesY + i * 86, sw = pw - 40, sh = 78;

    rpath(px + 20, sy, sw, sh, 10);
    ctx.fillStyle = isSel ? 'rgba(0, 229, 255, 0.18)' : 'rgba(12, 18, 34, 0.75)'; ctx.fill();
    ctx.lineWidth = isSel ? 2 : 1;
    ctx.strokeStyle = isSel ? '#00e5ff' : (isUnlocked ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'); ctx.stroke();

    const badgeX = px + 55, badgeY = sy + 39;
    ctx.beginPath(); ctx.arc(badgeX, badgeY, 22, 0, Math.PI * 2);
    ctx.fillStyle = isSel ? 'rgba(0, 229, 255, 0.3)' : (isUnlocked ? 'rgba(255,216,74,0.15)' : 'rgba(30,36,50,0.8)'); ctx.fill();
    ctx.strokeStyle = isSel ? '#00e5ff' : (isUnlocked ? '#ffd84a' : '#555'); ctx.lineWidth = 1.6; ctx.stroke();
    txt(s.n.split(' ')[0], badgeX, badgeY, 13, isUnlocked ? '#ffd84a' : '#777', 'center');

    txt(s.n + (s.b ? '  ★首领战' : ''), px + 90, sy + 24, 15, isUnlocked ? (isSel ? '#ffd84a' : '#fff') : '#666');
    txt('推荐等级: Lv.' + s.r + ' (产出最高 Lv.' + s.r + ' 装备)', px + 300, sy + 24, 12, isUnlocked ? '#7df9ff' : '#555');

    const targetText = '目标: 击败 ' + s.k + ' 只敌人' + (s.b ? ' 并讨伐首领 [' + s.bn + ']' : '');
    txt(targetText, px + 90, sy + 52, 12, isUnlocked ? '#aaa' : '#555');
    txt('🪙 奖励: +' + s.g + ' G', px + 340, sy + 52, 12, isUnlocked ? '#ffd84a' : '#555');

    const stateW = 100, stateH = 34, stateX = px + sw - stateW - 10, stateY = sy + 22;
    rpath(stateX, stateY, stateW, stateH, 6);
    if (!isUnlocked) {
      ctx.fillStyle = 'rgba(30, 36, 50, 0.6)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.stroke();
      txt('🔒 未解锁', stateX + stateW / 2, stateY + stateH / 2, 12, '#666', 'center');
    } else if (isSel) {
      ctx.fillStyle = '#00d2d3'; ctx.fill();
      txt('⚡ 选定挑战', stateX + stateW / 2, stateY + stateH / 2, 12, '#041018', 'center');
    } else if (isCleared) {
      ctx.fillStyle = 'rgba(46, 213, 115, 0.2)'; ctx.fill();
      ctx.strokeStyle = '#2ed573'; ctx.stroke();
      txt('✔ 已通关', stateX + stateW / 2, stateY + stateH / 2, 12, '#2ed573', 'center');
    } else {
      ctx.fillStyle = 'rgba(255, 216, 74, 0.2)'; ctx.fill();
      ctx.strokeStyle = '#ffd84a'; ctx.stroke();
      txt('可挑战', stateX + stateW / 2, stateY + stateH / 2, 12, '#ffd84a', 'center');
    }
  });

  const btmY = py + ph - 58;
  rpath(px + 10, btmY - 6, pw - 20, 52, 8); ctx.fillStyle = 'rgba(6, 10, 22, 0.9)'; ctx.fill();
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)'; ctx.stroke();

  rpath(px + 22, btmY, 140, 38, 8); ctx.fillStyle = 'rgba(255, 71, 87, 0.18)'; ctx.fill();
  ctx.strokeStyle = '#ff4757'; ctx.lineWidth = 1.2; ctx.stroke();
  txt('← 返回基地 [ESC]', px + 22 + 70, btmY + 19, 12, '#ff7675', 'center');

  const canGo = selStageIdx <= S.cl;
  rpath(px + pw - 200, btmY, 180, 38, 8); ctx.fillStyle = canGo ? '#2ed573' : 'rgba(50, 60, 80, 0.6)'; ctx.fill();
  if (canGo) { ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 1.5; ctx.stroke(); }
  txt(canGo ? '⚡ 立即出征 [Enter]' : '关卡尚未解锁', px + pw - 110, btmY + 19, 13, canGo ? '#fff' : '#888', 'center');
  txt('A/D 切换章节   W/S 选关   Enter 出征', px + pw / 2 - 10, btmY + 19, 11, '#889', 'center');

  ctx.restore();
}

// ===== 抽卡与常规功能菜单（铁匠铺与天赋解除10级上限，强化百分比更新） =====
const V = { pg: 'main', i: 0, m: '', mt: 0 };
const go = p => { V.pg = p; V.i = 0 }, say = s => { V.m = s; V.mt = 1.8 };
function toVil(p) {
  G = 'vil'; M = 0; cam = 0;
  calc();                 // 重新核算当前装备与强化的属性上限
  P.hp = P.mh;            // 生命值回满
  P.mp = P.mm;            // 魔力值回满
  P.sta = P.stm;          // 耐力/能量条一并回满
  Object.assign(P, { x: p ? 1800 : 250, y: GY, vx: 0, vy: 0, f: 1, st: 'idle', inv: 0, land: 0, t: 0 });
  if (p === 'st') openPortal();
}

function buy(o) {
  if (o.max) return say('已达上限/已拥有'); if (S.g < (o.g || 0)) return say('金币不足'); if (S.tp < (o.t || 0)) return say('天赋点不足');
  S.g -= o.g || 0; S.tp -= o.t || 0; o.f(); calc(); save(); say('强化成功！');
}

function openRyukiGachaSettlement(isNew = true) {
  gachaModal = { type: 'ryuki', isNew };
}

function items() {
  const p = V.pg, bk = { n: '← 返回', nv: 1, f: () => { M = 0 } };
  if (p === 'main') return [
    ['商店 · 药水补给', 'shop'],
    ['铁匠铺 · 基础研磨', 'eq'],
    ['扭蛋终端 · 抽取骑士胶囊', 'gacha'],
    ['修炼场 · 天赋（' + S.tp + ' 点）', 'tal'],
    ['出征 · 选择关卡', 'st']
  ].map(([n, q]) => ({ n, nv: 1, f: () => (q === 'st' ? openPortal() : go(q)) }));

  if (p === 'shop') return [
    { n: '体力药水   持有 ' + S.hp, d: '战斗中按 1：回复 50% 生命（上限9）', g: 40, max: S.hp >= 9, f: () => S.hp++ },
    { n: '魔力药水   持有 ' + S.mp, d: '战斗中按 2：回复 60% 魔力（上限9）', g: 40, max: S.mp >= 9, f: () => S.mp++ }, bk];

  if (p === 'gacha') {
    const hasRyuki = S.caps.includes('ryuki');
    return [
      {
        n: '胶囊抽取 (150 G / 次)',
        d: '投入金币抽取变身胶囊！高概率获取【假面骑士 龙骑】变身胶囊！',
        g: 150,
        f: () => {
          if (!hasRyuki && Math.random() < 0.65) {
            S.caps.push('ryuki'); if (!S.eqCap) S.eqCap = 'ryuki'; save();
            openRyukiGachaSettlement(true);
          } else if (hasRyuki) {
            S.g += 120; S.xp += 60; save();
            say('重复抽中龙骑核心，已转化为 120G 与 60 经验！');
          } else {
            S.hp = Math.min(9, S.hp + 1); save();
            say('抽中祝福宝箱，获得体力药水 ×1！');
          }
        }
      },
      {
        n: '保底兑换【龙骑变身胶囊】(450 G)',
        d: hasRyuki ? '你已拥有该胶囊' : '必定获得【假面骑士 龙骑】变身胶囊并自动装备！',
        g: 450,
        max: hasRyuki,
        f: () => {
          if (!S.caps.includes('ryuki')) { S.caps.push('ryuki'); if (!S.eqCap) S.eqCap = 'ryuki'; save(); openRyukiGachaSettlement(true) }
        }
      },
      {
        n: '查看结算卡面【龙骑胶囊】',
        d: '查看在Draw文件夹中的KR_Ryuki.jpg结算界面',
        nv: 1,
        f: () => openRyukiGachaSettlement(false)
      },
      bk
    ];
  }

  // 铁匠铺：胶囊已剥离，无上限等级，攻击+1%/生命+5%/伤害-0.1%/魔力+3%
  if (p === 'eq') {
    const q = (k, n, d) => ({ n: n + '  Lv.' + S[k], d, g: 80 * (S[k] + 1), max: false, f: () => S[k]++ });
    return [
      q('sw', '基础斩刃研磨', '基础攻击力 +1% / 级（无上限）'),
      q('ar', '基础装甲强化', '基础生命 +5%、受到伤害 -0.1% / 级（无上限）'),
      q('bt', '驱动引擎调试', '基础魔力 +3% / 级（无上限）'),
      bk
    ];
  }

  // 天赋：解除 10 级上限，允许无上限加点
  if (p === 'tal') return [...TL.map((t, k) => ({ n: t[0] + '  Lv.' + S.ta[k], d: t[1] + ' / 级（无上限加点）', t: 1, max: false, f: () => S.ta[k]++ })), bk];
  return [bk];
}

function drawV() {
  rpath(180, 30, 600, 480, 18); ctx.fillStyle = 'rgba(10,12,24,.94)'; ctx.fill(); ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 2; ctx.stroke();
  txt(RM.npc + '：' + RM.hi, 480, 62, 18, RM.nc, 'center'); txt('金币 ' + S.g + '    Lv.' + S.lv + '    天赋点 ' + S.tp, 480, 94, 15, '#fff', 'center');
  txt('攻击 ' + (P.atk | 0) + '   生命 ' + P.mh + '   魔力 ' + P.mm + '   暴击 ' + Math.round(P.cr * 100) + '%', 480, 118, 14, '#9df', 'center');
  rpath(200, 135, 560, 305, 12); ctx.fillStyle = 'rgba(4,7,16,.75)'; ctx.fill();

  const listW = 540;
  const it = items(); it.forEach((o, k) => {
    const y = 168 + k * 44, sel = k === V.i; if (sel) { rpath(210, y - 18, listW, 36, 8); ctx.fillStyle = 'rgba(0,229,255,.22)'; ctx.fill() }
    txt((sel ? '▶ ' : '   ') + o.n, 225, y, 15, o.lock ? '#666' : sel ? '#ffd84a' : '#fff');
    if (o.g || o.t) txt(o.max ? 'MAX' : (o.g ? o.g + 'G ' : '') + (o.t ? o.t + ' 点' : ''), 210 + listW - 15, y, 14, o.max ? '#7dff9a' : (S.g >= (o.g || 0) && S.tp >= (o.t || 0)) ? '#ffd84a' : '#f66', 'right');
  });

  const o = it[V.i]; if (o && o.d) txt(o.d, 225, 415, 13, '#9df');
  if (V.mt > 0) txt(V.m, 480, 455, 16, '#7dff9a', 'center');
  txt('W/S 选择    Enter/F 确认    Esc 关闭', 480, 490, 13, '#888', 'center');
}

function drawGachaModalOverlay() {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 6, 14, 0.92)'; ctx.fillRect(0, 0, 960, 540);

  const cx = 480, cy = 255;
  ctx.save(); ctx.translate(cx, cy);
  for (let a = 0; a < 12; a++) {
    ctx.rotate(Math.PI / 6); ctx.fillStyle = (a % 2 === 0) ? 'rgba(255, 71, 87, 0.08)' : 'rgba(255, 216, 74, 0.05)';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 360, -0.2, 0.2); ctx.fill();
  }
  ctx.restore();

  if (CAP_IMG) {
    const iw = 560, ih = 315, ix = 480 - iw / 2, iy = 72;
    ctx.save();
    ctx.shadowColor = '#ff3838'; ctx.shadowBlur = 28 + Math.sin(T * 5) * 10;
    rpath(ix, iy, iw, ih, 16); ctx.clip();
    ctx.drawImage(CAP_IMG, ix, iy, iw, ih);
    ctx.restore();
    rpath(ix, iy, iw, ih, 16); ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 3; ctx.stroke();
  }

  txt(gachaModal.isNew ? '🎉 恭喜获得传说变身胶囊！' : '★ 假面骑士 龙骑 · 契约胶囊 ★', 480, 42, 22, '#ffd84a', 'center');
  txt('【假面骑士 龙骑】KAMEN RIDER RYUKI', 480, 412, 20, '#ff4757', 'center');
  txt('按【N键】可随时呼出胶囊终端进行装配！战斗中按【P键】变身！', 480, 442, 14, '#7df9ff', 'center');

  rpath(360, 468, 240, 40, 12); ctx.fillStyle = '#ff4757'; ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  txt('确定 [Enter / 空格]', 480, 488, 15, '#fff', 'center');
  ctx.restore();
}