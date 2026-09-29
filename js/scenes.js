// ===== 基地村庄与互动建筑 =====
const VW = 2200;
const BD = [
  { x: 800, n: '药铺', pg: 'shop', bf: '药铺.jpg', rf: '药房背景.jpg', npc: '药师 阿玲', hi: '欢迎光临！药水随时补货。', c: '#3fae72', nc: '#7dff9a', h: 330 },
  { x: 1150, n: '铁匠铺', pg: 'eq', bf: '铁匠铺.jpg', rf: '铁匠铺背景.jpg', npc: '铁匠 老岩', hi: '装备锻造与基础属性研磨都在这里整备。', c: '#c0703a', nc: '#ffb070', h: 330 },
  { x: 1460, n: '训练馆', pg: 'tal', bf: '训练馆.jpg', rf: '训练馆背景.jpg', npc: '教官 无相', hi: '升级得来的天赋点，在这里点（无上限强化）。', c: '#6a5acd', nc: '#b8a8ff', h: 330 },
  { x: 1720, n: '扭蛋机', pg: 'gacha', bf: '扭蛋机.jpg', rf: '', npc: '扭蛋终端', hi: '放入金币，抽取假面骑士龙骑变身胶囊！', c: '#e84118', nc: '#ff7675', h: 195 }
];
const EL = { x: 500, npc: '长老 阿公' }, PT = 1950, PG = { npc: '传送门', hi: '选择要挑战的章节与关卡', nc: '#7df', pg: 'st' }, RMN = 640;
RM = BD[0];
const RW = () => RM.ri ? Math.max(960, RM.ri.width * 540 / RM.ri.height | 0) : 960;

// 传送门章节滑动与定位状态
let curChapIdx = 0, selStageIdx = 0, chapScrollX = 0, isDraggingChap = false, dragStartX = 0, dragStartScrollX = 0;

function getHighestChapterIdx() {
  const maxStage = Math.min(ST.length - 1, S.cl);
  for (let i = CHAPTERS.length - 1; i >= 0; i--) {
    if (CHAPTERS[i].stages.some(idx => idx <= maxStage)) {
      return i;
    }
  }
  return 0;
}
// 传送门章节滑动与居中定位
function syncChapScroll() {
  const pw = 680, chapListW = pw - 172, tabW = 230, tabGap = 10;
  const minScroll = Math.min(0, chapListW - CHAPTERS.length * (tabW + tabGap));
  const target = -(curChapIdx * (tabW + tabGap)) + (chapListW - tabW) / 2;
  chapScrollX = cl(target, minScroll, 0);
}

function openPortal() {
  RM = PG;
  V.pg = 'st';
  M = 1;
  curChapIdx = getHighestChapterIdx();
  const stages = CHAPTERS[curChapIdx].stages;
  const avail = stages.filter(s => s <= S.cl);
  selStageIdx = avail.length > 0 ? avail[avail.length - 1] : stages[0];
  syncChapScroll();
}

function portalUpdate(dt) {
  if (PR.Escape) { M = 0; delete PR.Escape; return }
  const chap = CHAPTERS[curChapIdx];

  // A键 / 左方向键 切换上一章
  if (PR.KeyA || PR.ArrowLeft) {
    if (curChapIdx > 0) {
      curChapIdx--;
      const stages = CHAPTERS[curChapIdx].stages;
      const avail = stages.filter(s => s <= S.cl);
      selStageIdx = avail.length > 0 ? avail[avail.length - 1] : stages[0];
      syncChapScroll();
    }
    delete PR.KeyA; delete PR.ArrowLeft;
  }

  // D键 / 右方向键 切换下一章
  if (PR.KeyD || PR.ArrowRight) {
    if (curChapIdx < CHAPTERS.length - 1) {
      const nextChap = CHAPTERS[curChapIdx + 1];
      if (nextChap.stages[0] <= S.cl) {
        curChapIdx++;
        const stages = CHAPTERS[curChapIdx].stages;
        const avail = stages.filter(s => s <= S.cl);
        selStageIdx = avail.length > 0 ? avail[avail.length - 1] : stages[0];
        syncChapScroll();
      } else {
        say('下一章节尚未解锁！请先通关当前章节。');
      }
    }
    delete PR.KeyD; delete PR.ArrowRight;
  }

  // W/S 切换当前章节内的关卡
  const stages = chap.stages;
  let curPos = stages.indexOf(selStageIdx);
  if (curPos === -1) curPos = 0;
  if (PR.KeyW || PR.ArrowUp) {
    if (curPos > 0) selStageIdx = stages[curPos - 1];
    delete PR.KeyW; delete PR.ArrowUp;
  }
  if (PR.KeyS || PR.ArrowDown) {
    if (curPos < stages.length - 1) selStageIdx = stages[curPos + 1];
    delete PR.KeyS; delete PR.ArrowDown;
  }

  // 回车 / 空格 / F 键出征
  if (PR.Enter || PR.Space || PR.KeyF) {
    delete PR.Enter; delete PR.Space; delete PR.KeyF;
    if (selStageIdx <= S.cl) {
      M = 0;
      begin(selStageIdx);
    } else {
      say('该关卡尚未解锁！');
    }
  }
}

function vupd(dt) {
  if (gachaModal) {
    if (PR.Enter || PR.Space || PR.Escape || PR.KeyF) { gachaModal = null; delete PR.Enter; delete PR.Space; delete PR.Escape; delete PR.KeyF }
    return;
  }
  if (M) {
    if (V.pg === 'st') { portalUpdate(dt); return; }
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
    c.push({ x: 70, t: '离开' + RM.n, f: () => { G = 'vil'; P.x = RM.x; P.hp = P.mh; P.mp = P.mm; P.sta = P.stm; } }, { x: RMN, t: '与 ' + RM.npc + ' 交谈', f: () => { V.pg = RM.pg; V.i = 0; M = 1 } });
  } else {
    BD.forEach(b => c.push({ x: b.x, t: '进入 ' + b.n, f: () => { RM = b; if (!b.rf) { V.pg = b.pg; V.i = 0; M = 1 } else { G = 'room'; P.x = 140 } } }));
    c.push({ x: EL.x, t: '与 ' + EL.npc + ' 交谈', f: () => { V.m = EL.npc + '：' + (S.cl < 1 ? '药铺买药、铁匠铺强化基础，按[N]装配胶囊后走入传送门。' : S.cl < 3 ? '翡翠巨龙已被讨伐，但炎狱魔王正在苏醒！' : '变强了就去挑战炎狱深处吧！'); V.mt = 5 } });
    c.push({ x: PT, t: '使用传送门', f: () => openPortal() });
  }
  NR = c.find(o => Math.abs(o.x - P.x) < 80);
  if (NR && (PR.KeyF || PR.Enter)) { NR.f() }
}

function bg() {
  if (!SC) { ctx.fillStyle = '#0b0812'; ctx.fillRect(0, 0, 960, 540); return }
  const w = SC.width * 540 / SC.height, k = Math.floor(cam / w);
  for (let i = k; i * w - cam < 960; i++) {
    ctx.save(); const x = i * w - cam; if (i & 1) { ctx.translate(x + w, 0); ctx.scale(-1, 1) } else ctx.translate(x, 0);
    ctx.drawImage(SC, 0, 0, w + 1, 540); ctx.restore();
  }
  const v = (G === 'play' || G === 'over' || G === 'win') ? ST[cur].ov : '';
  if (v) { ctx.fillStyle = v; ctx.fillRect(0, 0, 960, 540) }
}

function npc(x, y, c, n, im = null) {
  y += Math.sin(T * 2 + x) * 2;
  if (im) {
    const targetH = 145;
    const k = targetH / im.height;
    const w = im.width * k;
    ctx.drawImage(im, x - w / 2, y - targetH, w, targetH);
    txt(n, x, y - targetH - 12, 15, '#fff', 'center');
    return;
  }
  ctx.fillStyle = c; ctx.fillRect(x - 22, y - 90, 44, 70); 
  ctx.fillStyle = '#f2d0b0'; ctx.beginPath(); ctx.arc(x, y - 108, 20, 0, 7); ctx.fill();
  ctx.fillStyle = c; ctx.fillRect(x - 24, y - 134, 48, 14); 
  ctx.fillStyle = '#222'; ctx.fillRect(x - 9, y - 112, 4, 6); ctx.fillRect(x + 5, y - 112, 4, 6); 
  ctx.fillRect(x - 20, y - 20, 16, 20); ctx.fillRect(x + 4, y - 20, 16, 20); 
  txt(n, x, y - 146, 15, '#fff', 'center');
}

function house(b) {
  const x = b.x - cam; if (x < -250 || x > 1210) return;
  const bh = b.h || 330;
  if (b.bi) { const k = bh / b.bi.height; ctx.drawImage(b.bi, x - b.bi.width * k / 2, GY + 10 - bh, b.bi.width * k, bh); return }
  rpath(x - 90, GY - bh / 2, 180, bh / 2, 12); ctx.fillStyle = b.c + '44'; ctx.fill(); ctx.strokeStyle = b.c; ctx.lineWidth = 2; ctx.stroke();
  txt(b.n, x, GY - bh / 2 - 18, 18, b.nc, 'center');
}

function portal(x) {
  x -= cam; const c = '#4cd0ff', p = 1 + Math.sin(T * 3) * .06; ctx.save(); ctx.shadowColor = c; ctx.shadowBlur = 30; ctx.strokeStyle = c; ctx.lineWidth = 8; ctx.fillStyle = '#0b1a3acc';
  ctx.beginPath(); ctx.ellipse(x, GY - 105, 58 * p, 110 * p, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); ctx.strokeStyle = '#ff9a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, GY - 105, 40 * p, 88 * p, 0, 0, 7); ctx.stroke(); txt('传送门', x, GY - 235, 18, c, 'center');
}

function drawRoom() {
  if (RM.ri) { const k = 540 / RM.ri.height; ctx.drawImage(RM.ri, -cam, 0, RM.ri.width * k, 540); ctx.fillStyle = 'rgba(60,255,140,.25)'; ctx.fillRect(30 - cam, GY - 140, 80, 140); txt('← 出口', 70 - cam, GY - 150, 15, '#7dff9a', 'center'); npc(RMN - cam, GY, RM.nc, RM.npc); return }
  ctx.fillStyle = '#181024'; ctx.fillRect(0, 0, 960, 540); ctx.fillStyle = RM.c + '44'; ctx.fillRect(0, 0, 960, GY); ctx.fillStyle = '#3a2a1e'; ctx.fillRect(0, GY, 960, 70);
  ctx.fillStyle = '#2a1a10'; ctx.fillRect(25, GY - 130, 90, 130); txt('出口', 70, GY - 140, 14, '#fff', 'center'); npc(650, GY, RM.nc, RM.npc);
}

function drawW() {
  const rm = G === 'room';
  if (!rm) {
    if (IM.v) { const k = 540 / IM.v.height, bw = Math.max(960, IM.v.width * k); ctx.drawImage(IM.v, -cam * (bw - 960) / Math.max(1, VW - 960), 0, bw, 540) }
    else { ctx.fillStyle = '#12101e'; ctx.fillRect(0, 0, 960, 540) }
    BD.forEach(house); npc(EL.x - cam, GY, '#dcdcdc', EL.npc, EL.im); portal(PT);
  } else drawRoom();
  drawP();
  drawPlayerHUD(16, 14); drawGoldHUD(); drawMinimapHUD(); drawLocationHUD(rm ? RM.n : '秘密基地');
  if (NR && !M) { txt('[F] ' + NR.t, P.x - cam, P.y - 250, 18, '#ffd84a', 'center') }
  if (V.mt > 0 && !M) txt(V.m, 480, 470, 18, '#7dff9a', 'center');

  const henshinPrompt = P.ryuki ? '[P] 解除变身' : (S.eqCap === 'ryuki' ? '[P] 龙骑变身' : '[P] 变身试演');
  txt('A/D 移动   W/空格 跳跃   F 互动   ' + henshinPrompt + '   [C] 背包   [N] 胶囊', 480, 524, 13, '#bbb', 'center');
  if (M) {
    if (V.pg === 'st') drawPortalModal();
    else drawV();
  }
} 