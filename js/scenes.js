// ===== 基地村庄、互动建筑与形态陈列室 (Rider Trophy Hall) =====
let VW = 2200;   // 实际宽度由 layoutVillage() 计算
const BD = [
  { x: 800, n: '药铺', pg: 'shop', bf: '药铺.png', rf: '药房背景.jpg', npc: '药师 阿玲', hi: '欢迎光临！药水随时补货。', c: '#3fae72', nc: '#7dff9a', h: 330, sc: .23 },
  { x: 1150, n: '铁匠铺', pg: 'eq', bf: '铁匠铺.png', rf: '铁匠铺背景.jpg', npc: '铁匠 老岩', hi: '装备锻造与基础属性研磨都在这里整备。', c: '#c0703a', nc: '#ffb070', h: 330, sc: .23 },
  { x: 1460, n: '训练馆', pg: 'tal', bf: '训练馆.png', rf: '训练馆背景.jpg', npc: '教官 无相', hi: '升级得来的天赋点，在这里点（无上限强化）。', c: '#6a5acd', nc: '#b8a8ff', h: 330, sc: .23 },
  { x: 1720, n: '扭蛋机', pg: 'gacha', bf: '扭蛋机.png', rf: '', npc: '扭蛋终端', hi: '放入钻石，抽取假面骑士龙骑变身胶囊！', c: '#e84118', nc: '#ff7675', h: 195 }
];
let PT = 1950;
const EL = { x: 500, npc: '长老 阿公' }, PG = { npc: '传送门', hi: '选择要挑战的章节与关卡', nc: '#7df', pg: 'st', h: 300 }, RMN = 640;
RM = BD[0];

// ===== 展厅专属配置 =====
const HALL_ROOM = { isHall: true, n: '形态展厅', npc: '陈列控制台' };
const HALL_W = 1600;
const HALL_ENTRANCE_X = 220; // 位于基地左侧 (阿公 x:500 的左方)

const HALL_MODAL = {
  show: false,
  riderId: 'ryuki',
  animT: 0,
  animPlaying: false,
  hits: []
};

const RW = () => RM.isHall ? HALL_W : (RM.ri ? Math.max(960, RM.ri.width * 540 / RM.ri.height | 0) : 960);

// 获取展厅的所有骑士形态列表（原生 Malaya + 所有胶囊骑士）
function getHallRiderList() {
  const list = [
    {
      id: 'malaya',
      name: '假面骑士 MALAYA',
      short: 'Malaya',
      c: '#00e5ff',
      tag: '原生基础',
      trait: '原生大红花纳米装甲 · 均衡攻防 · 绝灭飞踢',
      skill: 'L · 飞剑 / J · 升龙击与下砸',
      finisher: 'FINAL VENT · 绝灭狂风踢',
      rSkill: '—'
    }
  ];
  if (typeof CAPSULES !== 'undefined') {
    CAPSULES.forEach(c => {
      list.push({
        id: c.id,
        name: c.name,
        short: c.short,
        c: c.c,
        tag: c.tag,
        trait: c.trait,
        skill: c.skill,
        finisher: c.finisher,
        rSkill: c.id === 'ryuki' ? 'R · 无限龙助战与喷火' : c.id === '555' ? 'R · Accel 10秒全场加速' : c.id === 'blade' ? 'R · 卡牌合成二合一联合技' : 'R · Overdrive 高能超载'
      });
    });
  }
  return list;
}

// 获取各展台横向坐标
function getPedestalX(index, total) {
  const startX = 320;
  const step = 260;
  return startX + index * step;
}

// 布局基地外区
function layoutVillage() {
  const GAP = 70;
  let cur = EL.x + 160;
  for (const b of BD) {
    if (b.sc && b.bi) b.h = Math.round(b.bi.height * b.sc);
    b.w = b.bi ? b.bi.width * b.h / b.bi.height : 180;
    b.x = Math.round(cur + b.w / 2);
    b.r = cl(b.w * .22, 80, 150);
    cur += b.w + GAP;
  }
  const pw = PG.bi ? PG.bi.width * PG.h / PG.bi.height : 120;
  PT = Math.round(cur + pw / 2);
  VW = Math.round(PT + pw / 2 + 220);
}

// 基地与室内逻辑帧更新
function vupd(dt) {
  P.hp = P.mh; P.mp = P.mm; P.sta = P.stm; P.exh = false;
  for (const k in P.cd) P.cd[k] = 0;

  // 展厅检视弹窗开启期间拦截玩家移动与常规交互
  if (HALL_MODAL.show) {
    updateHallModal(dt);
    return;
  }

  if (gachaModal && gachaModal.type === 'anim') {
    const el = T - gachaModal.t0;
    if (el >= GA_DUR || ((PR.Enter || PR.Space || PR.Escape || PR.KeyF) && el > GA_SKIP_AFTER)) gachaAnimEnd();
    delete PR.Enter; delete PR.Space; delete PR.Escape; delete PR.KeyF;
    return;
  }
  if (gachaModal) {
    if (PR.Enter || PR.Space || PR.Escape || PR.KeyF) { gachaModal = gachaQ.shift() || null; delete PR.Enter; delete PR.Space; delete PR.Escape; delete PR.KeyF }
    return;
  }
  if (M) {
    if (V.pg === 'st') { portalUpdate(dt); return; }
    if (V.pg === 'gacha' && MN.rates) {
      if (PR.Enter || PR.Space || PR.Escape || PR.KeyF) { MN.rates = false; delete PR.Enter; delete PR.Space; delete PR.Escape; delete PR.KeyF }
      return;
    }
    const it = items(), n = it.length;
    if (PR.KeyW || PR.ArrowUp) V.i = (V.i + n - 1) % n;
    if (PR.KeyS || PR.ArrowDown) V.i = (V.i + 1) % n;
    if (PR.Escape) M = 0;
    else if (PR.Enter || PR.Space || PR.KeyF) { const o = it[V.i]; o.lock ? say('尚未解锁') : o.nv ? o.f() : buy(o) }
    return;
  }

  const rm = G === 'room', c = [];
  P.inv = 0; P.land = 0;
  walk(dt, (rm ? RW() : VW) - 40);
  cam = cl(P.x - 480, 0, (rm ? RW() : VW) - 960);

  if (rm) {
    if (RM.isHall) {
      // 展厅室内交互：左侧出口 + 各骑士展台
      c.push({
        x: 80, r: 70, t: '离开展厅',
        f: () => { G = 'vil'; P.x = HALL_ENTRANCE_X; P.hp = P.mh; P.mp = P.mm; P.sta = P.stm; }
      });
      const riders = getHallRiderList();
      riders.forEach((rd, idx) => {
        const pedX = getPedestalX(idx, riders.length);
        c.push({
          x: pedX, r: 75, t: '检视装甲 · ' + rd.short,
          f: () => openHallModal(rd.id)
        });
      });
    } else {
      c.push(
        { x: 70, t: '离开' + RM.n, f: () => { G = 'vil'; P.x = RM.x; P.hp = P.mh; P.mp = P.mm; P.sta = P.stm; } },
        { x: RMN, t: '与 ' + RM.npc + ' 交谈', f: () => { V.pg = RM.pg; V.i = 0; M = 1; } }
      );
    }
  } else {
    // 基地外区交互：增加左侧形态展厅入口
    c.push({
      x: HALL_ENTRANCE_X, r: 90, t: '进入 形态展厅',
      f: () => { G = 'room'; RM = HALL_ROOM; P.x = 100; P.vx = 0; }
    });
    BD.forEach(b => c.push({ x: b.x, r: b.r, t: '进入 ' + b.n, f: () => { RM = b; if (!b.rf) { V.pg = b.pg; V.i = 0; M = 1 } else { G = 'room'; P.x = 140 } } }));
    c.push({ x: EL.x, t: '与 ' + EL.npc + ' 交谈', f: () => { V.m = EL.npc + '：' + (S.cl < 1 ? '药铺买药、铁匠铺强化基础，左侧可参观形态展厅。' : '战力充沛就多去传送门试炼吧！'); V.mt = 5 } });
    c.push({ x: PT, t: '使用传送门', f: () => openPortal() });
  }

  NR = c.find(o => Math.abs(o.x - P.x) < (o.r || 80));
  if (NR && (PR.KeyF || PR.Enter)) { NR.f(); }
}

// 绘制展厅大门（位于基地外景左侧 x: 220 处）
function drawHallEntrance() {
  const x = sn(HALL_ENTRANCE_X - cam), y = GY;
  if (x < -200 || x > 1160) return;

  const w = 150, h = 270;
  ctx.save();
  // 顶部全息霓虹拱门光影
  const gr = ctx.createRadialGradient(x, y - h / 2, 20, x, y - h / 2, h * 0.6);
  gr.addColorStop(0, 'rgba(155, 81, 224, 0.35)');
  gr.addColorStop(0.6, 'rgba(0, 229, 255, 0.15)');
  gr.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gr; ctx.fillRect(x - w, y - h - 40, w * 2, h + 40);

  // 左右两侧高科技立柱
  const colW = 22;
  techCutBox(x - w / 2, y - h, colW, h, 6);
  ctx.fillStyle = '#0a1020'; ctx.fill();
  ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 1.8; ctx.stroke();

  techCutBox(x + w / 2 - colW, y - h, colW, h, 6);
  ctx.fillStyle = '#0a1020'; ctx.fill();
  ctx.strokeStyle = '#9b51e0'; ctx.lineWidth = 1.8; ctx.stroke();

  // 顶部横梁与全息标牌
  techCutBox(x - w / 2 - 10, y - h - 20, w + 20, 28, 6);
  ctx.fillStyle = 'rgba(14, 20, 36, 0.95)'; ctx.fill();
  ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 1.5; ctx.stroke();

  txt('🏛️ 骑士形态展厅', x, y - h - 6, 12.5, '#ffffff', 'center');

  // 门洞中央垂直流光穿梭
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const pulse = Math.sin(T * 4) * 0.2 + 0.6;
  ctx.fillStyle = `rgba(0, 229, 255, ${pulse * 0.35})`;
  ctx.fillRect(x - w / 2 + colW + 4, y - h + 10, w - colW * 2 - 8, h - 10);
  ctx.restore();

  txt('RIDER TROPHY HALL', x, y - 30, 9.5, '#7df9ff', 'center');
  ctx.restore();
}

// 绘制展厅内部长廊
function drawHall() {
  const riders = getHallRiderList();
  const total = riders.length;

  // 1. 展厅内部背景（深空金属廊厅 + 顶部导轨缆线）
  ctx.fillStyle = '#060a14'; ctx.fillRect(0, 0, 960, 540);
  
  // 顶部灯光导轨
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'; ctx.fillRect(0, 30, 960, 8);
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, 38); ctx.lineTo(960, 38); ctx.stroke();

  // 地面科幻网格
  for (let gx = -cam % 60; gx < 960; gx += 60) {
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(gx, GY); ctx.lineTo(gx - 40, 540); ctx.stroke();
  }

  // 2. 左侧出口门区
  const exitX = sn(80 - cam);
  techCutBox(exitX - 35, GY - 150, 70, 150, 8);
  ctx.fillStyle = 'rgba(46, 213, 115, 0.18)'; ctx.fill();
  ctx.strokeStyle = '#2ed573'; ctx.lineWidth = 1.5; ctx.stroke();
  txt('← 离开', exitX, GY - 165, 13, '#7dff9a', 'center');

  // 3. 各骑士装甲展台渲染
  riders.forEach((rd, idx) => {
    const pedX = getPedestalX(idx, total);
    const sx = sn(pedX - cam), sy = GY;
    if (sx < -180 || sx > 1140) return;

    const isOwned = (rd.id === 'malaya') || (Array.isArray(S.caps) && S.caps.includes(rd.id));
    const starLv = (rd.id === 'malaya') ? 5 : (typeof capStar === 'function' ? capStar(rd.id) : 0);
    const col = isOwned ? rd.c : '#556677';
    const isNearby = Math.abs(P.x - pedX) < 75;

    ctx.save();
    // 顶部专属射灯倾泻而下
    const spot = ctx.createLinearGradient(sx, 38, sx, sy);
    spot.addColorStop(0, `${col}55`);
    spot.addColorStop(0.8, `${col}15`);
    spot.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = spot;
    ctx.beginPath();
    ctx.moveTo(sx - 15, 38); ctx.lineTo(sx + 15, 38);
    ctx.lineTo(sx + 80, sy); ctx.lineTo(sx - 80, sy);
    ctx.closePath();
    ctx.fill();

    // 展台底座（八角水晶发光台）
    techCutBox(sx - 70, sy - 14, 140, 24, 6);
    ctx.fillStyle = '#080e1c'; ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = isNearby ? 2.5 : 1.5;
    if (isNearby) { ctx.shadowColor = col; ctx.shadowBlur = 12; }
    ctx.stroke();

    // 地面全息环
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(sx, sy - 2, 60, 16, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 绘制 1:1 装甲架姿态
    ctx.save();
    if (isOwned) {
      ctx.shadowColor = col;
      ctx.shadowBlur = isNearby ? 16 : 8;
      const breath = Math.sin(T * 2.5 + idx) * 1.5;
      drawPedestalArmor(rd.id, sx, sy - 14 + breath, 1);
    } else {
      // 未激活状态：半透明暗影线框轮廓
      ctx.globalAlpha = 0.35;
      drawPedestalArmor(rd.id, sx, sy - 14, 1);
      ctx.restore();
      ctx.save();
      txt('🔒', sx, sy - 100, 32, '#6a788c', 'center', false);
    }
    ctx.restore();

    // 顶部全息铭牌与星级信息
    const tagY = sy - 215;
    techCutBox(sx - 68, tagY - 12, 136, 32, 6);
    ctx.fillStyle = isNearby ? 'rgba(18, 30, 56, 0.95)' : 'rgba(8, 14, 28, 0.85)';
    ctx.fill();
    ctx.strokeStyle = isNearby ? '#ffd84a' : col;
    ctx.lineWidth = isNearby ? 1.8 : 1;
    ctx.stroke();

    txt(rd.short, sx, tagY, 13, isOwned ? '#ffffff' : '#7f8d9f', 'center');
    
    // 星级展示
    let starStr = '';
    for (let s = 0; s < 5; s++) starStr += (s < starLv) ? '★' : '☆';
    txt(starStr, sx, tagY + 13, 9.5, isOwned ? '#ffd84a' : '#556578', 'center');

    // 靠近时的互动光圈提示
    if (isNearby) {
      txt('[F] 检视装甲档案', sx, sy - 245, 12, '#ffd84a', 'center');
    }

    ctx.restore();
  });
}

// 绘制展台上的 1:1 装甲姿态
function drawPedestalArmor(id, x, y, f) {
  try {
    if (id === 'malaya') {
      if (okS(SH.atk)) dr(SH.atk, 12, x, y, f, 1.0);
    } else if (id === 'ryuki') {
      if (SH.ryukiTrans && SH.ryukiTrans.f[15]) drC(SH.ryukiTrans, 15, x, y, f, 1.0);
      else if (okS(SHR.atk)) dr(SHR.atk, 0, x, y, f, 1.0);
    } else if (id === '555') {
      if (okS(SH5.trans)) drC(SH5.trans, 8, x, y, f, 1.0);
      else if (okS(SH5.run)) dr(SH5.run, 0, x, y, f, 1.0);
    } else if (id === 'blade') {
      if (okS(SH6.atk)) drB(SH6.atk, BLADE_AX.atk, 12, x, y, f * BLADE_IDLE_FLIP);
    } else if (id === 'zeztz') {
      if (okS(SHZ.atk)) dr(SHZ.atk, 0, x, y, f, 1.0);
    }
  } catch (e) {}
}

// 打开检视终端弹窗
function openHallModal(riderId) {
  HALL_MODAL.show = true;
  HALL_MODAL.riderId = riderId;
  HALL_MODAL.animT = 0;
  HALL_MODAL.animPlaying = false;
  HALL_MODAL.hits = [];
}

// 弹窗动画与按键更新
function updateHallModal(dt) {
  if (!HALL_MODAL.show) return;
  if (HALL_MODAL.animPlaying) {
    HALL_MODAL.animT += dt;
  }
  if (PR.Escape) {
    HALL_MODAL.show = false;
    delete PR.Escape;
    return;
  }
  if (PR.Space) {
    HALL_MODAL.animPlaying = !HALL_MODAL.animPlaying;
    if (HALL_MODAL.animPlaying) HALL_MODAL.animT = 0;
    delete PR.Space;
    return;
  }
  if (PR.KeyE || PR.Enter) {
    toggleEquipFromHall(HALL_MODAL.riderId);
    delete PR.KeyE; delete PR.Enter;
    return;
  }
}

// 展厅快捷装配
function toggleEquipFromHall(riderId) {
  if (riderId === 'malaya') {
    S.eqCap = null;
    clearForms();
    calc(); save();
    pToast('已切换为 Malaya 原生形态');
    return;
  }
  const isOwned = Array.isArray(S.caps) && S.caps.includes(riderId);
  if (!isOwned) {
    pToast('尚未拥有该胶囊，请前往扭蛋终端抽取');
    return;
  }
  if (S.eqCap === riderId) {
    S.eqCap = null;
    clearForms();
    calc(); save();
    pToast('已卸下变身胶囊');
  } else {
    S.eqCap = riderId;
    clearForms();
    calc(); save();
    const c = CAPSULES.find(x => x.id === riderId);
    pToast(`已装配胶囊：${c ? c.name : riderId}`);
  }
}

// 绘制展厅专属全息检视终端 Modal
// 绘制展厅专属全息检视终端 Modal
function drawHallModal() {
  if (!HALL_MODAL.show) return;
  HALL_MODAL.hits = [];
  const riders = getHallRiderList();
  const rd = riders.find(r => r.id === HALL_MODAL.riderId) || riders[0];
  const isOwned = (rd.id === 'malaya') || (Array.isArray(S.caps) && S.caps.includes(rd.id));
  const isEquipped = (rd.id === 'malaya') ? (!S.eqCap) : (S.eqCap === rd.id);
  const starLv = (rd.id === 'malaya') ? 5 : (typeof capStar === 'function' ? capStar(rd.id) : 0);
  const kills = (S.ps && S.ps.formKills && S.ps.formKills[rd.id]) || (rd.id === 'malaya' ? (S.ps ? S.ps.kills : 0) : 0);
  const bossKills = (S.ps && S.ps.formBoss && S.ps.formBoss[rd.id]) || 0;

  // 1. 全屏科技暗化背景
  ctx.save();
  ctx.fillStyle = 'rgba(3, 5, 14, 0.88)';
  ctx.fillRect(0, 0, 960, 540);

  // 2. 居中终端主框
  const mw = 840, mh = 480, mx = (960 - mw) / 2, my = (540 - mh) / 2;
  poBevel(mx, my, mw, mh, 16);
  const bgGrad = ctx.createLinearGradient(mx, my, mx + mw, my + mh);
  bgGrad.addColorStop(0, '#0c1628'); bgGrad.addColorStop(1, '#050814');
  ctx.fillStyle = bgGrad; ctx.fill();
  ctx.strokeStyle = rd.c; ctx.lineWidth = 2;
  ctx.save(); ctx.shadowColor = rd.c; ctx.shadowBlur = 18; ctx.stroke(); ctx.restore();

  // 顶栏标题
  txt('ARMOR SPECIFICATION & HOLO ARCHIVE // 形态装甲规格档案', mx + 24, my + 24, 11, rd.c);
  txt(rd.name, mx + 24, my + 46, 22, '#ffffff');

  // 关闭按钮
  pBtn(mx + mw - 76, my + 14, 60, 26, '✕ 关闭', { c: '#ff4757', ghost: true, sz: 11, cr: 6 }, () => {
    HALL_MODAL.show = false;
  });
  HALL_MODAL.hits.push({ x: mx + mw - 76, y: my + 14, w: 60, h: 26, f: () => { HALL_MODAL.show = false; } });

  // ---------- 左侧：全息装甲/大招演练舱 ----------
  const chamberX = mx + 24, chamberY = my + 66, chamberW = 310, chamberH = 350;
  poBevel(chamberX, chamberY, chamberW, chamberH, 12);
  ctx.fillStyle = 'rgba(6, 12, 24, 0.9)'; ctx.fill();
  ctx.strokeStyle = rd.c + '66'; ctx.lineWidth = 1.2; ctx.stroke();

  // 演练舱全息光栅线
  ctx.save();
  poBevel(chamberX, chamberY, chamberW, chamberH, 12); ctx.clip();
  for (let ly = chamberY; ly < chamberY + chamberH; ly += 6) {
    ctx.fillStyle = 'rgba(0, 229, 255, 0.03)'; ctx.fillRect(chamberX, ly, chamberW, 1.5);
  }
  ctx.restore();

  // 演练舱内部装甲 / 大招全息回放
  const holoCx = chamberX + chamberW / 2, holoCy = chamberY + chamberH - 45;
  drawHoloChamber(rd.id, holoCx, holoCy, HALL_MODAL.animPlaying, HALL_MODAL.animT);

  // 全息演练切换按钮
  const simBtnW = chamberW - 32, simBtnH = 34, simBtnY = chamberY + chamberH - 44;
  pBtn(chamberX + 16, simBtnY, simBtnW, simBtnH, HALL_MODAL.animPlaying ? '⏹ 停止全息演练 [空格]' : '▶ 终结大招全息演练 [空格]', {
    c: rd.c, ghost: !HALL_MODAL.animPlaying, sz: 12, cr: 6
  }, () => {
    HALL_MODAL.animPlaying = !HALL_MODAL.animPlaying;
    if (HALL_MODAL.animPlaying) HALL_MODAL.animT = 0;
  });
  HALL_MODAL.hits.push({ x: chamberX + 16, y: simBtnY, w: simBtnW, h: simBtnH, f: () => {
    HALL_MODAL.animPlaying = !HALL_MODAL.animPlaying;
    if (HALL_MODAL.animPlaying) HALL_MODAL.animT = 0;
  }});

  // ---------- 右侧：战绩数据、勋章与特技 ----------
  const infoX = mx + 354, infoW = mw - 378, infoY = my + 66;

  // 1. 核心属性与星级卡
  techCutBox(infoX, infoY, infoW, 76, 8);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.lineWidth = 1; ctx.stroke();

  txt(`契约状态：${isOwned ? '已激活 (ACTIVE)' : '未获得 (LOCKED)'}`, infoX + 14, infoY + 18, 12, isOwned ? '#7dff9a' : '#ff7675');
  txt(`星级觉醒：★${starLv} / 5 星`, infoX + 180, infoY + 18, 12, '#ffd84a');

  let statDetail = '';
  if (rd.id === 'malaya') {
    statDetail = '标准全属性 100% · 原生标准均衡装甲';
  } else {
    const cap = (typeof CAPSULES !== 'undefined') ? CAPSULES.find(c => c.id === rd.id) : null;
    if (cap) {
      // 最终总攻击 = (胶囊基础倍率 - 1) + 星级加成 (每星 4%)
      const totalAtk = typeof capAtkMul === 'function' 
        ? ((capAtkMul(cap) - 1) * 100).toFixed(1) 
        : (((cap.atkMul || 1) - 1 + starLv * 0.04) * 100).toFixed(1);

      // 最终总暴击 = 胶囊基础暴击 + 星级加成 (每星 1.5%)
      const totalCr = typeof capCrAdd === 'function' 
        ? (capCrAdd(cap) * 100).toFixed(1) 
        : (((cap.crAdd || 0) + starLv * 0.015) * 100).toFixed(1);

      // 移速加成与星级冷却缩减
      const spdAdd = Math.round(((cap.spdMul || 1) - 1) * 100);
      const cdRed = (typeof CAP_STAR_CD !== 'undefined' && CAP_STAR_CD[starLv]) 
        ? Math.round(CAP_STAR_CD[starLv] * 100) 
        : 0;

      statDetail = `最终总成: 攻击 +${totalAtk}% · 暴击 +${totalCr}%${spdAdd > 0 ? ` · 移速 +${spdAdd}%` : ''}${cdRed > 0 ? ` · 技能CD -${cdRed}%` : ''}`;
    } else {
      statDetail = `攻击 +${(starLv * 4).toFixed(1)}% · 暴击 +${(starLv * 1.5).toFixed(1)}%`;
    }
  }
  txt(statDetail, infoX + 14, infoY + 38, 11, '#c9d4e6');
  txt(`出战击杀: ${kills.toLocaleString()} 敌 | 击破领主: ${bossKills} 首领`, infoX + 14, infoY + 58, 11, '#8fa0b5');

  // 2. 四大专属战绩勋章 (Trophy Medals)
  const medalBoxY = infoY + 88, medalBoxH = 92;
  techCutBox(infoX, medalBoxY, infoW, medalBoxH, 8);
  ctx.fillStyle = 'rgba(6, 12, 24, 0.9)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255, 216, 74, 0.25)'; ctx.lineWidth = 1; ctx.stroke();
  txt('FORM MASTERY MEDALS // 战役作战勋章', infoX + 14, medalBoxY + 16, 10, '#ffd84a');

  const medals = [
    { ic: '📜', t: '契约缔结', ok: isOwned, d: '解锁该形态' },
    { ic: '⚔️', t: '百战老兵', ok: kills >= 100, d: '击杀≥100' },
    { ic: '👑', t: '领主破阵', ok: bossKills >= 1 || (rd.id === 'malaya' && (S.ps && S.ps.boss >= 5)), d: '讨伐首领' },
    { ic: '🌟', t: '神域觉醒', ok: starLv >= 5, d: '达成★5满星' }
  ];

  const mSlotW = (infoW - 28 - 24) / 4;
  medals.forEach((m, mi) => {
    const msX = infoX + 14 + mi * (mSlotW + 8), msY = medalBoxY + 30;
    techCutBox(msX, msY, mSlotW, 52, 6);
    ctx.fillStyle = m.ok ? 'rgba(255, 216, 74, 0.12)' : 'rgba(255, 255, 255, 0.03)'; ctx.fill();
    ctx.strokeStyle = m.ok ? '#ffd84a' : 'rgba(255, 255, 255, 0.1)'; ctx.lineWidth = 1; ctx.stroke();

    txt(m.ic, msX + 18, msY + 18, 18, '#fff', 'center');
    txt(m.t, msX + 34, msY + 14, 11, m.ok ? '#ffffff' : '#6f7f95');
    txt(m.ok ? '✔ 已点亮' : m.d, msX + 34, msY + 32, 9.5, m.ok ? '#7dff9a' : '#556578');
  });

  // 3. 专属特技与战斗机制说明
  const traitBoxY = medalBoxY + medalBoxH + 12, traitBoxH = 100;
  techCutBox(infoX, traitBoxY, infoW, traitBoxH, 8);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'; ctx.fill();
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.2)'; ctx.lineWidth = 1; ctx.stroke();

  txt('TACTICAL CAPABILITY // 战术与特技', infoX + 14, traitBoxY + 16, 10, '#00e5ff');
  txt(`核心特性: ${rd.trait}`, infoX + 14, traitBoxY + 36, 11, '#e2e8f0');
  txt(`战术技能: ${rd.skill}`, infoX + 14, traitBoxY + 54, 11, '#7df9ff');
  txt(`终结必杀: ${rd.finisher}`, infoX + 14, traitBoxY + 72, 11, '#ff7675');
  txt(`专属觉醒: ${rd.rSkill}`, infoX + 14, traitBoxY + 90, 11, '#ffd84a');

  // 4. 底部快捷装配大按钮
  const actBtnY = traitBoxY + traitBoxH + 12, actBtnH = 42;
  const actLabel = (rd.id === 'malaya')
    ? (isEquipped ? '✔ 当前已是 Malaya 原生形态' : '⚡ 卸下胶囊，回归原生形态 [E]')
    : (isEquipped ? '✔ 当前已装配 [点击卸下 E]' : (isOwned ? '⚡ 立即装配该变身胶囊 [E]' : '🔒 尚未获得该胶囊'));

  pBtn(infoX, actBtnY, infoW, actBtnH, actLabel, {
    c: isEquipped ? '#2e86de' : (isOwned ? '#2ed573' : '#445566'),
    dis: !isOwned && rd.id !== 'malaya',
    sz: 13.5,
    cr: 8
  }, () => {
    toggleEquipFromHall(rd.id);
  });
  if (isOwned || rd.id === 'malaya') {
    HALL_MODAL.hits.push({ x: infoX, y: actBtnY, w: infoW, h: actBtnH, f: () => toggleEquipFromHall(rd.id) });
  }

  ctx.restore();
}

// 全息展示舱动画（支持静态立绘与终结大招全息演练）
function drawHoloChamber(riderId, cx, cy, isAnim, animT) {
  ctx.save();
  // 全息底盘
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, 70, 18, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  if (!isAnim) {
    // 静态待机姿态
    drawPedestalArmor(riderId, cx, cy, 1);
  } else {
    // 终结大招全息投影演练循环（周期 2.4s）
    const loopT = animT % 2.4;
    ctx.save();
    ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 14;

    if (riderId === 'malaya') {
      if (loopT < 0.6) dr(SH.atk, 5, cx, cy, 1, 1.0);
      else if (loopT < 1.4) dr(SH.fv, 7, cx, cy - 30, 1, 1.0);
      else dr(SH.fv, 14, cx, cy, 1, 1.0);
    } else if (riderId === 'ryuki') {
      if (loopT < 0.6) drFV(SHR.fv, 2, cx, cy, 1);
      else if (loopT < 1.2) drFV(SHR.fv, 6, cx, cy - 35, 1);
      else if (loopT < 1.8) drFV(SHR.fv, 12, cx, cy - 15, 1);
      else drFV(SHR.fv, 14, cx, cy, 1);
    } else if (riderId === '555') {
      if (loopT < 0.7) dr(SH5.fv, 4, cx, cy, 1, 1.0);
      else if (loopT < 1.3) dr(SH5.fv, 9, cx, cy - 30, 1, 1.0);
      else if (loopT < 1.8) dr(SH5.fv, 11, cx, cy - 10, 1, 1.0);
      else dr(SH5.fv, 14, cx, cy, 1, 1.0);
    } else if (riderId === 'blade') {
      if (loopT < 0.7) drB(SH6.fv, BLADE_AX.fv, 4, cx, cy, 1);
      else if (loopT < 1.3) drB(SH6.fv, BLADE_AX.fv, 7, cx, cy - 30, 1);
      else if (loopT < 1.8) drB(SH6.fv, BLADE_AX.fv, 11, cx, cy - 10, 1);
      else drB(SH6.fv, BLADE_AX.fv, 14, cx, cy, 1);
    } else if (riderId === 'zeztz') {
      if (loopT < 0.7) dr(SHZ.fv, 2, cx, cy, 1, 1.0);
      else if (loopT < 1.4) dr(SHZ.fv, 8, cx, cy, 1, 1.0);
      else if (loopT < 1.9) dr(SHZ.fv, 14, cx, cy, 1, 1.0);
      else dr(SHZ.fv, 18, cx, cy, 1, 1.0);
    }
    ctx.restore();

    // 全息投影标识
    txt('✦ SIMULATION: FINISHER REPLAY ✦', cx, cy - 180, 10, '#ffd84a', 'center');
  }
  ctx.restore();
}

// 城镇/房间/展厅主渲染管线
function bg() {
  const curSet = (typeof cur === 'number' && ST[cur] && ST[cur].set) ? ST[cur].set : 1;
  const curSc = SC_MAP[curSet] || SC || SC_MAP[1];

  if (!curSc) { ctx.fillStyle = '#0b0812'; ctx.fillRect(0, 0, 960, 540); return; }
  const w = curSc.width * 540 / curSc.height, k = Math.floor(cam / w);
  for (let i = k; i * w - cam < 960; i++) {
    ctx.save(); const x = sn(i * w - cam); if (i & 1) { ctx.translate(x + w + 1, 0); ctx.scale(-1, 1); } else ctx.translate(x, 0);
    ctx.drawImage(curSc, 0, 0, w + 1, 540); ctx.restore();
  }
  const v = (G === 'play' || G === 'over' || G === 'win') ? ST[cur].ov : '';
  if (v) { ctx.fillStyle = v; ctx.fillRect(0, 0, 960, 540); }
}

function npc(x, y, c, n, im = null) {
  x = sn(x); y = sn(y + Math.sin(T * 2) * 2);
  if (im) {
    const targetH = 195;
    const k = targetH / im.height;
    const w = im.width * k;
    ctx.drawImage(im, x - w / 2, y - targetH, w, targetH);
    txt(n, x, y - targetH - 14, 15, '#fff', 'center');
    return;
  }
  ctx.fillStyle = c; ctx.fillRect(x - 22, y - 110, 44, 90); 
  ctx.fillStyle = '#f2d0b0'; ctx.beginPath(); ctx.arc(x, y - 128, 20, 0, 7); ctx.fill();
  ctx.fillStyle = c; ctx.fillRect(x - 24, y - 154, 48, 14); 
  ctx.fillStyle = '#222'; ctx.fillRect(x - 9, y - 132, 4, 6); ctx.fillRect(x + 5, y - 132, 4, 6); 
  ctx.fillRect(x - 20, y - 20, 16, 20); ctx.fillRect(x + 4, y - 20, 16, 20); 
  txt(n, x, y - 166, 15, '#fff', 'center');
}

function house(b) {
  const x = sn(b.x - cam), hw = (b.w || 180) / 2 + 40; if (x < -hw || x > 960 + hw) return;
  const bh = b.h || 330;
  if (b.bi) { const k = bh / b.bi.height; ctx.drawImage(b.bi, x - b.bi.width * k / 2, GY + 10 - bh, b.bi.width * k, bh); return; }
  rpath(x - 90, GY - bh / 2, 180, bh / 2, 12); ctx.fillStyle = b.c + '44'; ctx.fill(); ctx.strokeStyle = b.c; ctx.lineWidth = 2; ctx.stroke();
  txt(b.n, x, GY - bh / 2 - 18, 18, b.nc, 'center');
}

function portal(x) {
  x = sn(x - cam);
  if (x < -250 || x > 1210) return;
  const c = '#4cd0ff', p = 1 + Math.sin(T * 3) * .06;
  if (PG.bi) {
    const bh = PG.h, k = bh / PG.bi.height, bw = PG.bi.width * k;
    ctx.save();
    const gr = ctx.createRadialGradient(x, GY - bh / 2, 10, x, GY - bh / 2, bh * (.55 + Math.sin(T * 3) * .04));
    gr.addColorStop(0, 'rgba(76,208,255,.28)'); gr.addColorStop(1, 'rgba(76,208,255,0)');
    ctx.fillStyle = gr; ctx.fillRect(x - bh, GY - bh * 1.5, bh * 2, bh * 2);
    ctx.drawImage(PG.bi, sn(x - bw / 2), sn(GY + 10 - bh), bw, bh);
    ctx.restore();
    txt('传送门', x, GY - bh - 6, 18, c, 'center');
    return;
  }
  ctx.save(); ctx.shadowColor = c; ctx.shadowBlur = 30; ctx.strokeStyle = c; ctx.lineWidth = 8; ctx.fillStyle = '#0b1a3acc';
  ctx.beginPath(); ctx.ellipse(x, GY - 105, 58 * p, 110 * p, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); ctx.strokeStyle = '#ff9a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, GY - 105, 40 * p, 88 * p, 0, 0, 7); ctx.stroke(); txt('传送门', x, GY - 235, 18, c, 'center');
}

function drawRoom() {
  if (RM.isHall) {
    drawHall();
    return;
  }
  if (RM.ri) {
    const k = 540 / RM.ri.height;
    ctx.drawImage(RM.ri, sn(-cam), 0, RM.ri.width * k, 540);
    ctx.fillStyle = 'rgba(60,255,140,.25)';
    ctx.fillRect(30 - cam, GY - 140, 80, 140);
    txt('← 出口', 70 - cam, GY - 150, 15, '#7dff9a', 'center');
    npc(RMN - cam, GY, RM.nc, RM.npc, RM.im);
    return;
  }
  ctx.fillStyle = '#181024'; ctx.fillRect(0, 0, 960, 540);
  ctx.fillStyle = RM.c + '44'; ctx.fillRect(0, 0, 960, GY);
  ctx.fillStyle = '#3a2a1e'; ctx.fillRect(0, GY, 960, 70);
  ctx.fillStyle = '#2a1a10'; ctx.fillRect(25, GY - 130, 90, 130);
  txt('出口', 70, GY - 140, 14, '#fff', 'center');
  npc(650, GY, RM.nc, RM.npc, RM.im);
}

function drawW() {
  const rm = G === 'room';
  if (!rm) {
    if (IM.v) { const k = 540 / IM.v.height, bw = Math.max(960, IM.v.width * k); ctx.drawImage(IM.v, sn(-cam * (bw - 960) / Math.max(1, VW - 960)), 0, bw, 540) }
    else { ctx.fillStyle = '#12101e'; ctx.fillRect(0, 0, 960, 540) }
    drawHallEntrance(); // 绘制左侧形态展厅大门
    BD.forEach(house); npc(EL.x - cam, GY, '#dcdcdc', EL.npc, EL.im); portal(PT);
  } else {
    drawRoom();
  }

  drawP();
  drawPlayerHUD(16, 14); drawGoldHUD(); drawMinimapHUD(); 
  drawLocationHUD(rm ? RM.n : '秘密基地');

  if (NR && !M && !HALL_MODAL.show) { 
    txt('[F] ' + NR.t, P.x - cam, P.y - 250, 18, '#ffd84a', 'center'); 
  }
  if (V.mt > 0 && !M) txt(V.m, 480, 470, 18, '#7dff9a', 'center');

  const henshinPrompt = inForm() ? '[P] 解除变身' : (S.eqCap ? '[P] ' + capShort() + '变身' : '[P] 变身试演');
  hintLine('A/D 移动   W/空格 跳跃   F 互动   ' + henshinPrompt + '   [C] 背包   [N] 胶囊');

  if (M) {
    if (V.pg === 'st') drawPortalModal();
    else drawV();
  }

  // 渲染形态展厅检视终端弹窗
  if (HALL_MODAL.show) {
    drawHallModal();
  }
}

// 展厅弹窗点击分发
function hallClick(x, y) {
  if (!HALL_MODAL.show) return false;
  for (let i = HALL_MODAL.hits.length - 1; i >= 0; i--) {
    const r = HALL_MODAL.hits[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      r.f();
      return true;
    }
  }
  // 点击弹窗主体外部半透明黑底直接关闭
  const mw = 840, mh = 480, mx = (960 - mw) / 2, my = (540 - mh) / 2;
  if (x < mx || x > mx + mw || y < my || y > my + mh) {
    HALL_MODAL.show = false;
    return true;
  }
  return true;
}