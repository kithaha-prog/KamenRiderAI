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
// 展厅宽度随骑士数量自动扩展：第 n 个展台在 320 + n*260，最后一个展台右侧再留 320 的余量（以后新增胶囊不用再改）
const HALL_W = Math.max(1600, 320 + (typeof CAPSULES !== 'undefined' ? CAPSULES.length : 5) * 260 + 320);
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
        rSkill: c.id === 'ryuki' ? 'R · 无限龙助战与喷火' : c.id === '555' ? 'R · Accel 10秒全场加速' : c.id === 'blade' ? 'R · 卡牌合成二合一联合技' : c.id === 'deno' ? '—' : 'R · Overdrive 高能超载'
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

  // 如果身处训练馆室内，启动木桩战斗循环与技能拦截
  if (G === 'room' && RM && RM.n === '训练馆') {
    updateTrainingCombat(dt);
  }

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
    } else if (id === 'deno') {
      if (okS(SHD.atk)) dr(SHD.atk, 12, x, y, f * DENO_FLIP.atk, 1.0);
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
    } else if (riderId === 'deno' && okS(SHD.fv)) {
      const fl = DENO_FLIP.fv;
      if (loopT < 0.7) dr(SHD.fv, 4, cx, cy, fl, 1.0);
      else if (loopT < 1.3) dr(SHD.fv, 8, cx, cy - 30, fl, 1.0);
      else if (loopT < 1.8) dr(SHD.fv, 11, cx, cy - 10, fl, 1.0);
      else dr(SHD.fv, 15, cx, cy, fl, 1.0);
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
    if (RM && RM.n === '训练馆') {
      drawTrainingDummy(); // 渲染全息测试木桩实体与头顶血条/护甲
      // 渲染场上的技能弹道、战车与爆炸火花
      if (typeof drawBikes === 'function') drawBikes();
      if (typeof drawBladeBolts === 'function') drawBladeBolts();
      if (typeof drawZeztzEnergyWaves === 'function') drawZeztzEnergyWaves();
      if (typeof drawDenoWaves === 'function') drawDenoWaves();
    }
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
  // 仅在训练馆室内展示左上方 DPS 测算与扇形图面板
  if (G === 'room' && RM && RM.n === '训练馆') {
    drawDPSMeterHUD();
  }

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

// =====================================================================
//  训练馆全息测试木桩 & 实时 DPS 伤害统计终端 (Training Dummy & DPS Meter)
// =====================================================================

// ---------- 1. 伤害统计与分类引擎 ----------
const DUMMY_STATS = {
  active: false,
  startTime: 0,
  lastHitTime: 0,
  totalDamage: 0,
  totalHits: 0,
  critHits: 0,
  maxHit: 0,
  rollingHits: [], // [{ t, d }]
  bySkill: {
    atk: 0, // 普攻 / 升龙击 / 空中下砸
    l: 0,   // 战术技能 [L]
    e: 0,   // 机车战车 [E]
    k: 0,   // 终结必杀 [K]
    r: 0    // 专属特技 [R] (龙骑无限龙/555加速/Blade卡牌/Zeztz超载)
  },

  reset() {
    this.active = false;
    this.startTime = 0;
    this.lastHitTime = 0;
    this.totalDamage = 0;
    this.totalHits = 0;
    this.critHits = 0;
    this.maxHit = 0;
    this.rollingHits = [];
    this.bySkill = { atk: 0, l: 0, e: 0, k: 0, r: 0 };
  },

  addHit(dmg, isCrit, skillKey) {
    const now = performance.now() / 1000;
    if (!this.active || this.totalHits === 0) {
      this.active = true;
      this.startTime = now;
    }
    this.lastHitTime = now;
    this.totalDamage += dmg;
    this.totalHits++;
    if (isCrit) this.critHits++;
    if (dmg > this.maxHit) this.maxHit = dmg;

    const sk = this.bySkill.hasOwnProperty(skillKey) ? skillKey : 'atk';
    this.bySkill[sk] += dmg;
    this.rollingHits.push({ t: now, d: dmg });
  },

  update(now) {
    // 维护 3.5 秒滑动时间窗
    while (this.rollingHits.length && now - this.rollingHits[0].t > 3.5) {
      this.rollingHits.shift();
    }
  },

  getDPS(now) {
    if (!this.active || this.totalDamage <= 0) return { current: 0, average: 0, time: 0 };
    const combatTime = Math.max(1, (this.lastHitTime || now) - this.startTime);
    const windowTime = Math.min(3.5, Math.max(0.5, now - this.startTime));
    const rollingDmg = this.rollingHits.reduce((sum, h) => sum + h.d, 0);
    const isStale = (now - this.lastHitTime) > 4.0; // 超过 4 秒无命中视为停火
    const current = isStale ? 0 : Math.round(rollingDmg / windowTime);
    const average = Math.round(this.totalDamage / combatTime);
    return { current, average, time: combatTime };
  }
};

// 当前伤害来源标记追踪
window._currentDamageSource = null;

// ---------- 2. 全息木桩实体对象 ----------
const DUMMY = {
  isDummy: true,
  id: 888888,
  t: 'boss',
  x: 450,
  y: GY,
  w: 70,
  h: 170,
  hp: 999999999,
  mhp: 999999999,
  dead: false,
  fl: 0,
  shakeX: 0,
  defenseMode: 0, // 0: 0%免伤 (无甲), 1: 30%免伤 (轻甲), 2: 50%免伤 (重装)
  getDef() {
    return this.defenseMode === 1 ? 0.3 : this.defenseMode === 2 ? 0.5 : 0;
  },
  cycleDef() {
    this.defenseMode = (this.defenseMode + 1) % 3;
    const names = ['0% 原生无甲', '30% 战术轻甲', '50% 领主重装'];
    if (typeof DT !== 'undefined') {
      DT.push({ x: this.x, y: this.y - this.h - 40, s: `木桩护甲切换: ${names[this.defenseMode]}`, t: 1.2, c: '#ffd84a' });
    }
  }
};

// 技能类型与颜色配置
const DUMMY_SKILL_CATS = [
  { id: 'atk', name: '普攻/派生', col: '#00e5ff' },
  { id: 'l',   name: '战术 [L]',  col: '#ff9f43' },
  { id: 'e',   name: '战车 [E]',  col: '#ffd84a' },
  { id: 'k',   name: '必杀 [K]',  col: '#ff4757' },
  { id: 'r',   name: '特技 [R]',  col: '#a55eea' }
];

// ---------- 3. 挂钩现有伤害系统（使木桩享受全局受击判定） ----------
(function hookDummyDamage() {
  const origHurt = window.hurt;
  if (typeof origHurt !== 'function') return;

  window.hurt = function(e, d, pre) {
    if (e && e.isDummy) {
      // 1. 根据当前伤害源判断技能分类
      let sk = window._currentDamageSource;
      if (!sk) {
        if (P.st === 'fv') sk = 'k';
        else if (P.st === 'thr') sk = 'l';
        else if (P.st === 'atk' || P.st === 'uppercut' || P.st === 'diveslam') sk = 'atk';
        else sk = 'atk';
      }

      // 2. 模拟计算暴击与护甲减伤
      const isCrit = pre ? !!pre.c : (Math.random() < P.cr);
      let actualD = pre ? d : Math.round(d * (0.9 + Math.random() * 0.2) * (isCrit ? 2 : 1));
      actualD = Math.max(1, Math.round(actualD * (1 - e.getDef())));

      // 3. 记录至木桩统计引擎并生成受击震颤
      DUMMY_STATS.addHit(actualD, isCrit, sk);
      e.fl = 0.16;
      e.shakeX = (Math.random() - 0.5) * 8;
      shake = Math.max(shake, 4);

      if (typeof playSwordHit === 'function') playSwordHit();

      // 4. 飘字与特效
      if (typeof DT !== 'undefined') {
        DT.push({ x: e.x + (Math.random() - 0.5) * 30, y: e.y - e.h - 10, s: actualD + (isCrit ? '!' : ''), t: 0.8, c: isCrit ? '#ff8a2a' : '#ffd84a' });
      }
      if (typeof FX !== 'undefined') {
        FX.push({ type: 'boom', x: e.x, y: e.y - e.h * 0.55, t: 0.2, d: 0.2, r: 45, c: isCrit ? '#ff9f43' : '#00e5ff' });
      }

      // 保持木桩无限血量，永不阵亡
      e.hp = e.mhp;
      return;
    }
    return origHurt.apply(this, arguments);
  };
})();

// ---------- 4. 训练馆室内战斗帧循环与技能支持 ----------
function updateTrainingCombat(dt) {
  // 保持玩家魔力充盈与体力充沛
  P.mp = P.mm;
  P.sta = P.stm;
  P.exh = false;
  // 缩短技能 CD 方便自由测试
  for (const k in P.cd) {
    if (P.cd[k] > 0) P.cd[k] = Math.max(0, P.cd[k] - dt * 2.5);
  }

  // 确保训练木桩挂载在怪物池 E 中，使 area() 和弹道能自动检索命中
  if (!E.includes(DUMMY)) {
    E = [DUMMY];
  }
  DUMMY.fl = Math.max(0, DUMMY.fl - dt);
  DUMMY.shakeX *= 0.8;

  // 更新 DPS 测算引擎时序
  const now = performance.now() / 1000;
  DUMMY_STATS.update(now);

  // 快捷键监听：[R] 清空数据（未变身或按住 Ctrl 时），[T] 切换木桩护甲
  if (PR.KeyT) {
    DUMMY.cycleDef();
    delete PR.KeyT;
  }

  // 1. 玩家输入判定响应 (J/L/E/K 及派生)
  const gr = P.y >= GY;
  const fr = (P.st === 'idle' || P.st === 'run' || P.st === 'air');

  if (fr) {
    if (PR.KeyJ) {
      delete PR.KeyJ;
      const isUp = K.KeyW || K.ArrowUp;
      const isDown = K.KeyS || K.ArrowDown;
      if (isUp && gr) {
        P.st = 'uppercut'; P.t = 0; P.h = 0; P.vy = -750; P.vx = P.f * 120;
        DT.push({ x: P.x, y: P.y - 180, s: 'RISING SLASH!', t: 0.8, c: '#00e5ff' });
      } else if (!gr && isDown) {
        P.st = 'diveslam'; P.t = 0; P.h = 0; P.vy = 1250; P.vx = P.f * 450;
        DT.push({ x: P.x, y: P.y - 180, s: 'DIVE SLAM!', t: 0.8, c: '#ffd84a' });
      } else {
        P.st = 'atk'; P.t = 0; P.h = 0;
        if (!gr) P.vy = Math.min(P.vy * 0.4, 60);
      }
    } else if (PR.KeyL) {
      delete PR.KeyL;
      P.st = 'thr'; P.t = 0; P.h = 0;
      if (!gr) P.vy = Math.min(P.vy * 0.5, 60);
    } else if (PR.KeyE) {
      delete PR.KeyE;
      window._currentDamageSource = 'e';
      if (typeof spawnBike === 'function') spawnBike();
      window._currentDamageSource = null;
    } else if (PR.KeyK) {
      delete PR.KeyK;
      P.st = 'fv'; P.t = 0; P.hit = {}; P.h = 0; delete P.landT;
      if (P.ryuki && typeof playRyukiFV === 'function') playRyukiFV();
    }
  }

  // 2. 招式推进与判定
  P.t += dt;
  if (P.st === 'atk') {
    const i = P.t * 14 | 0;
    const a = P.x + P.f * 10, b = P.x + P.f * (typeof ATK_REACH !== 'undefined' ? ATK_REACH : 220);
    window._currentDamageSource = 'atk';
    for (const q of [2, 4]) {
      if (i >= q && !(P.h >> q & 1)) {
        P.h |= 1 << q;
        if (q === 2 && typeof playSwordHit === 'function') playSwordHit();
        area(Math.min(a, b), Math.max(a, b), P.atk * (q === 2 ? 1.2 : 1));
      }
    }
    window._currentDamageSource = null;
    if (P.t > 0.5) P.st = (P.y < GY) ? 'air' : 'idle';
  } else if (P.st === 'uppercut') {
    if (!P.h && P.t >= 0.08) {
      P.h = 1;
      window._currentDamageSource = 'atk';
      if (typeof knockupEnemies === 'function') knockupEnemies(Math.min(P.x, P.x + P.f * 180), Math.max(P.x, P.x + P.f * 180), P.atk * 1.5);
      window._currentDamageSource = null;
    }
    if (P.t > 0.42) P.st = P.y < GY ? 'air' : 'idle';
  } else if (P.st === 'diveslam') {
    window._currentDamageSource = 'atk';
    if (typeof slamDownEnemies === 'function') slamDownEnemies(P.x - 70, P.x + 70, P.atk * 1.2);
    window._currentDamageSource = null;
    if (P.y >= GY) {
      P.y = GY; P.vy = 0; P.st = 'idle';
      window._currentDamageSource = 'atk';
      area(P.x - 220, P.x + 220, P.atk * 2.2);
      window._currentDamageSource = null;
      FX.push({ type: 'boom', x: P.x, y: GY - 20, t: 0.5, d: 0.5, r: 240, c: '#ffd84a' });
    }
  } else if (P.st === 'thr') {
    const fireT = (P.bl && typeof BLADE_L !== 'undefined') ? BLADE_L.fireT : (P.dn && typeof DENO_L !== 'undefined') ? DENO_L.fireT : 0.12;
    if (P.t >= fireT && !P.h) {
      P.h = 1;
      window._currentDamageSource = 'l';
      if (P.zeztz && typeof fireZeztzWave === 'function') fireZeztzWave();
      else if (P.dn && typeof fireDeno === 'function') fireDeno();
      else if (P.bl && typeof fireBlade === 'function') fireBlade();
      else if (P.k5 && typeof fireFaiz === 'function') fireFaiz();
      else if (P.ryuki && typeof fireRyukiGun === 'function') fireRyukiGun();
      else if (typeof PJ !== 'undefined') PJ.push({ x: P.x + P.f * 60, y: P.y - 100, vx: P.f * 800, f: P.f, t: 1.1, h: {}, skill: 'l' });
      window._currentDamageSource = null;
    }
    const durT = (P.bl && typeof BLADE_L !== 'undefined') ? BLADE_L.dur : (P.dn && typeof DENO_L !== 'undefined') ? DENO_L.dur : 0.3;
    if (P.t > durT) P.st = (P.y < GY) ? 'air' : 'idle';
  } else if (P.st === 'fv') {
    window._currentDamageSource = 'k';
    if (P.zeztz && typeof updZeztzFV === 'function') updZeztzFV(dt);
    else if (P.dn && typeof updDenoFV === 'function') updDenoFV(dt);
    else if (P.ryuki && typeof updRyukiFV === 'function') updRyukiFV(dt);
    else if (P.k5 && typeof updFaizFV === 'function') updFaizFV(dt);
    else if (P.bl && typeof updBladeFV === 'function') updBladeFV(dt);
    else {
      if (P.t >= 1.0 && !P.h) {
        P.h = 1; shake = 18;
        area(P.x - 320, P.x + 320, P.atk * 3);
        FX.push({ type: 'boom', x: P.x + P.f * 80, y: P.y - 80, t: 0.5, d: 0.5, r: 200, c: '#00e5ff' });
      }
      if (P.t > 1.5) { P.st = (P.y < GY) ? 'air' : 'idle'; }
    }
    window._currentDamageSource = null;
  }

  // 3. 更新弹道与附属战斗实体
  if (typeof updZeztzWaves === 'function') updZeztzWaves(dt);
  if (typeof updDenoWaves === 'function') updDenoWaves(dt);
  if (typeof updBladeBolts === 'function') updBladeBolts(dt);
  if (typeof updBikes === 'function') {
    window._currentDamageSource = 'e';
    updBikes(dt);
    window._currentDamageSource = null;
  }
  if (typeof updBattleFx === 'function') updBattleFx(dt);

  // 普通飞行弹道碰撞判定
  for (const s of PJ) {
    s.x += s.vx * dt; if (s.vy) s.y += s.vy * dt; s.t -= dt;
    if (s.vis) continue;
    const hit = (Math.abs(DUMMY.x - s.x) < DUMMY.w / 2 + 35 && Math.abs(DUMMY.y - DUMMY.h * 0.5 - s.y) < DUMMY.h * 0.5 + 25);
    if (hit && !s.h[DUMMY.id]) {
      s.h[DUMMY.id] = 1;
      window._currentDamageSource = s.skill || 'l';
      hurt(DUMMY, P.atk * (s.b5 ? 1.5 : s.rb ? 1.8 : 1.6));
      window._currentDamageSource = null;
      FX.push({ type: 'boom', x: s.x, y: s.y, t: 0.2, d: 0.2, r: 40, c: '#ffd84a' });
    }
  }
  PJ = PJ.filter(s => s.t > 0);

  // 4. 更新专属 [R] 键特技机制
  if (typeof mechUpdate === 'function') {
    window._currentDamageSource = 'r';
    mechUpdate(dt);
    window._currentDamageSource = null;
  }
}

// ---------- 5. 绘制全息测试木桩实体 ----------
function drawTrainingDummy() {
  const x = sn(DUMMY.x - cam) + DUMMY.shakeX;
  const y = sn(DUMMY.y);

  ctx.save();
  // 1. 地面八角高科技聚能投影底盘
  const baseW = 96, baseH = 20;
  ctx.save();
  poBevel(x - baseW / 2, y - 6, baseW, baseH, 6);
  ctx.fillStyle = '#0a1020'; ctx.fill();
  ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 1.6; ctx.stroke();

  // 底盘地面全息环
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = (DUMMY.fl > 0) ? '#ffd84a' : '#00e5ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y + 2, 54, 14, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 2. 垂直全息扫描光束
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const beamGrad = ctx.createLinearGradient(x, y - DUMMY.h, x, y);
  beamGrad.addColorStop(0, 'rgba(0, 229, 255, 0)');
  beamGrad.addColorStop(0.7, 'rgba(0, 229, 255, 0.12)');
  beamGrad.addColorStop(1, 'rgba(0, 229, 255, 0.35)');
  ctx.fillStyle = beamGrad;
  ctx.fillRect(x - DUMMY.w / 2 - 10, y - DUMMY.h - 10, DUMMY.w + 20, DUMMY.h + 10);

  // 全息水平干涉条纹
  for (let ly = y - DUMMY.h; ly < y; ly += 8) {
    ctx.fillStyle = 'rgba(125, 249, 255, 0.08)';
    ctx.fillRect(x - DUMMY.w / 2 - 8, ly, DUMMY.w + 16, 1.5);
  }
  ctx.restore();

  // 3. 绘制赛博训练假人机甲身躯 (矢量透明晶格 + 核心反应堆)
  ctx.save();
  if (DUMMY.fl > 0) ctx.filter = 'brightness(2.2)';

  const col = (DUMMY.fl > 0) ? '#ffd84a' : '#00e5ff';
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.8;
  ctx.fillStyle = 'rgba(10, 24, 48, 0.75)';

  // 头部
  poBevel(x - 16, y - DUMMY.h + 8, 32, 28, 6);
  ctx.fill(); ctx.stroke();
  // 面罩单晶发光横线
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 10, y - DUMMY.h + 20, 20, 3);

  // 躯干重装甲
  poBevel(x - 28, y - DUMMY.h + 40, 56, 62, 8);
  ctx.fillStyle = 'rgba(12, 28, 56, 0.85)'; ctx.fill(); ctx.stroke();

  // 胸口聚能反应堆
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y - DUMMY.h + 70, 10, 0, Math.PI * 2);
  ctx.fillStyle = (DUMMY.fl > 0) ? '#ff4757' : '#00e5ff';
  ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 14;
  ctx.fill();
  ctx.restore();

  // 双臂装甲架
  poBevel(x - 38, y - DUMMY.h + 46, 8, 50, 3); ctx.stroke();
  poBevel(x + 30, y - DUMMY.h + 46, 8, 50, 3); ctx.stroke();

  // 腿部支架
  poBevel(x - 22, y - DUMMY.h + 106, 16, 58, 4); ctx.stroke();
  poBevel(x + 6, y - DUMMY.h + 106, 16, 58, 4); ctx.stroke();
  ctx.restore();

  // 4. 头顶状态与无限血条展示
  const tagY = y - DUMMY.h - 18;
  txt('【 全息机甲测试木桩 · DUMMY 】', x, tagY - 18, 12, '#7df9ff', 'center');

  // 护甲免伤状态徽章
  const defNames = ['0% 原生无甲', '30% 战术轻甲', '50% 领主重装'];
  const defCols = ['#7dff9a', '#ffd84a', '#ff4757'];
  txt(`[ 护甲: ${defNames[DUMMY.defenseMode]} ]`, x, tagY - 3, 10.5, defCols[DUMMY.defenseMode], 'center');

  // 无限血量条
  const barW = 100, barH = 7;
  rpath(x - barW / 2, tagY + 8, barW, barH, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fill();
  rpath(x - barW / 2, tagY + 8, barW, barH, 3);
  ctx.fillStyle = '#00e5ff'; ctx.fill();
  ctx.strokeStyle = '#ffffff88'; ctx.lineWidth = 1; ctx.stroke();
  txt('∞ / ∞', x, tagY + 11.5, 9, '#ffffff', 'center', false);

  ctx.restore();
}

// ---------- 6. 绘制左上角 DPS 伤害测算与扇形图终端面板 ----------
const DPS_HUD_LAYOUT = { x: 16, y: 94, w: 300, h: 242 };

function drawDPSMeterHUD() {
  const L = DPS_HUD_LAYOUT;
  const now = performance.now() / 1000;
  const dps = DUMMY_STATS.getDPS(now);

  ctx.save();
  // 1. 主面板科技底座（切角香槟金包边）
  hudPanel(L.x, L.y, L.w, L.h, '#00e5ff', 10);

  // 2. 顶栏标题与快捷按钮
  ut('// REAL-TIME COMBAT TELEMETRY', L.x + 14, L.y + 13, 9, '#7f8da3', 'left', { w: 700, sp: 1.2, sh: 0 });
  ut('伤害测算终端', L.x + 14, L.y + 28, 14, '#ffffff', 'left', { w: 700 });

  // 护甲切换小按钮
  const defNames = ['无甲0%', '轻甲30%', '重装50%'];
  const defColors = ['#7dff9a', '#ffd84a', '#ff4757'];
  const defBtnW = 66, defBtnH = 20, defBtnX = L.x + L.w - 128, defBtnY = L.y + 16;
  rpath(defBtnX, defBtnY, defBtnW, defBtnH, 4);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'; ctx.fill();
  ctx.strokeStyle = defColors[DUMMY.defenseMode]; ctx.lineWidth = 1; ctx.stroke();
  ut(defNames[DUMMY.defenseMode], defBtnX + defBtnW / 2, defBtnY + defBtnH / 2, 9.5, defColors[DUMMY.defenseMode], 'center', { w: 700, sh: 0 });

  // 清空数据小按钮
  const resetBtnW = 46, resetBtnH = 20, resetBtnX = L.x + L.w - 56, resetBtnY = L.y + 16;
  rpath(resetBtnX, resetBtnY, resetBtnW, resetBtnH, 4);
  ctx.fillStyle = 'rgba(255, 71, 87, 0.16)'; ctx.fill();
  ctx.strokeStyle = '#ff4757'; ctx.lineWidth = 1; ctx.stroke();
  ut('清空[R]', resetBtnX + resetBtnW / 2, resetBtnY + resetBtnH / 2, 9.5, '#ff7675', 'center', { w: 700, sh: 0 });

  // 3. 核心秒伤与总伤害指标卡 (左右分列)
  const cardY = L.y + 42, cardH = 50, cardW = (L.w - 36) / 2;

  // 左卡：实时秒伤 (DPS)
  rpath(L.x + 14, cardY, cardW, cardH, 6);
  ctx.fillStyle = 'rgba(0, 229, 255, 0.08)'; ctx.fill();
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)'; ctx.lineWidth = 1; ctx.stroke();
  ut('实时秒伤 (DPS)', L.x + 22, cardY + 12, 9, '#7df9ff', 'left', { w: 600 });
  const dpsStr = dps.current > 0 ? dps.current.toLocaleString() : '0';
  ut(dpsStr, L.x + 22, cardY + 28, 16, '#00e5ff', 'left', { w: 700 });
  ut(`全场均伤: ${dps.average.toLocaleString()}/s`, L.x + 22, cardY + 42, 8.5, '#8fa0b5', 'left', { w: 500 });

  // 右卡：累计总伤与战斗耗时
  rpath(L.x + 22 + cardW, cardY, cardW, cardH, 6);
  ctx.fillStyle = 'rgba(255, 216, 74, 0.06)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255, 216, 74, 0.3)'; ctx.lineWidth = 1; ctx.stroke();
  ut('累计总伤害', L.x + 30 + cardW, cardY + 12, 9, '#ffd84a', 'left', { w: 600 });
  const totalStr = DUMMY_STATS.totalDamage >= 1e6 
    ? (DUMMY_STATS.totalDamage / 1e4).toFixed(1) + '万' 
    : DUMMY_STATS.totalDamage.toLocaleString();
  ut(totalStr, L.x + 30 + cardW, cardY + 28, 15, '#ffd84a', 'left', { w: 700 });
  const sec = Math.floor(dps.time);
  const timeStr = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  ut(`耗时: ${timeStr} | 命中: ${DUMMY_STATS.totalHits}`, L.x + 30 + cardW, cardY + 42, 8.5, '#8fa0b5', 'left', { w: 500 });

  // 4. 暴击率与单次极值行
  const critY = L.y + 100;
  const actualCr = DUMMY_STATS.totalHits > 0 
    ? (DUMMY_STATS.critHits / DUMMY_STATS.totalHits * 100).toFixed(1) + '%' 
    : '0.0%';
  const panelCr = (P.cr * 100).toFixed(1) + '%';
  ut(`暴击分布: ${DUMMY_STATS.critHits}/${DUMMY_STATS.totalHits} (${actualCr})`, L.x + 14, critY, 9.5, '#7dff9a', 'left', { w: 600 });
  const maxHitStr = DUMMY_STATS.maxHit > 0 ? DUMMY_STATS.maxHit.toLocaleString() : '0';
  ut(`最大单击: ${maxHitStr}`, L.x + L.w - 14, critY, 9.5, '#ffa502', 'right', { w: 600 });

  // 分割虚线
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(L.x + 14, critY + 10); ctx.lineTo(L.x + L.w - 14, critY + 10);
  ctx.stroke();

  // 5. 技能伤害占比环形扇形图 (Doughnut Chart) 与右侧图例列表
  const chartY = critY + 68;
  const pieCx = L.x + 48, pieCy = chartY;
  const outerR = 34, innerR = 18;
  const totalD = DUMMY_STATS.totalDamage;

  if (totalD <= 0) {
    // 未出手时的待机空心圆环
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.lineWidth = outerR - innerR;
    ctx.beginPath(); ctx.arc(pieCx, pieCy, (outerR + innerR) / 2, 0, Math.PI * 2); ctx.stroke();
    ut('待命中', pieCx, pieCy, 8.5, '#6a788c', 'center', { w: 600, sh: 0 });
    ctx.restore();
  } else {
    // 绘制各技能占比扇区
    let curAngle = -Math.PI / 2;
    DUMMY_SKILL_CATS.forEach(cat => {
      const dmg = DUMMY_STATS.bySkill[cat.id] || 0;
      if (dmg <= 0) return;
      const sliceAngle = (dmg / totalD) * Math.PI * 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(pieCx, pieCy, outerR, curAngle, curAngle + sliceAngle);
      ctx.arc(pieCx, pieCy, innerR, curAngle + sliceAngle, curAngle, true);
      ctx.closePath();
      ctx.fillStyle = cat.col;
      ctx.shadowColor = cat.col; ctx.shadowBlur = 4;
      ctx.fill();
      ctx.restore();
      curAngle += sliceAngle;
    });
    // 圆环中心小字
    ut('技能', pieCx, pieCy - 4, 8, '#8fa0b5', 'center', { w: 600, sh: 0 });
    ut('占比', pieCx, pieCy + 5, 8, '#ffffff', 'center', { w: 700, sh: 0 });
  }

  // 右侧各技能占比数据行 (5 项紧凑排布)
  const legendX = L.x + 94;
  DUMMY_SKILL_CATS.forEach((cat, idx) => {
    const ly = chartY - 32 + idx * 15;
    const dmg = DUMMY_STATS.bySkill[cat.id] || 0;
    const pctStr = totalD > 0 ? (dmg / totalD * 100).toFixed(1) + '%' : '0.0%';

    // 颜色图标块
    rpath(legendX, ly - 4, 6, 6, 1.5);
    ctx.fillStyle = cat.col; ctx.fill();

    // 技能名称
    ut(cat.name, legendX + 11, ly, 9.5, '#cbd5e1', 'left', { w: 600 });

    // 百分比
    ut(pctStr, legendX + 90, ly, 9.5, cat.col, 'right', { w: 700 });

    // 具体伤害数值
    const dmgStr = dmg >= 1e4 ? (dmg / 1e4).toFixed(1) + '万' : (dmg > 0 ? dmg.toLocaleString() : '0');
    ut(dmgStr, L.x + L.w - 14, ly, 9, '#8fa0b5', 'right', { w: 500 });
  });

  // 6. 底部提示
  ut('[R] 清空数据 · [T] 切换木桩护甲 · [F] 交互/离开', L.x + L.w / 2, L.y + L.h - 8, 8.5, '#6a788c', 'center', { w: 500, sh: 0 });

  ctx.restore();
}

// ---------- 7. 点击交互监听（重置与护甲切换） ----------
(function hookDummyClick() {
  const canvasEl = document.getElementById('c');
  if (!canvasEl) return;

  canvasEl.addEventListener('pointerdown', e => {
    if (typeof G === 'undefined' || G !== 'room' || !RM || RM.n !== '训练馆') return;
    const rect = canvasEl.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * 960;
    const y = (e.clientY - rect.top) / rect.height * 540;

    const L = DPS_HUD_LAYOUT;
    // 点击清空数据按钮
    const resetBtnX = L.x + L.w - 56, resetBtnY = L.y + 16;
    if (x >= resetBtnX && x <= resetBtnX + 46 && y >= resetBtnY && y <= resetBtnY + 20) {
      DUMMY_STATS.reset();
      if (typeof DT !== 'undefined') {
        DT.push({ x: P.x, y: P.y - 180, s: 'DPS 测算数据已重置！', t: 1.0, c: '#7dff9a' });
      }
      return;
    }
    // 点击切换护甲按钮
    const defBtnX = L.x + L.w - 128, defBtnY = L.y + 16;
    if (x >= defBtnX && x <= defBtnX + 66 && y >= defBtnY && y <= defBtnY + 20) {
      DUMMY.cycleDef();
      return;
    }
  });
})();