// ===== 基础 UI 渲染工具 =====
function rpath(x, y, w, h, r = 8) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r) }
  else { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath() }
}

function dr(S, i, x, y, fl = 1, sx = 1, al = 1, mid = 0) {
  ctx.save(); ctx.globalAlpha *= al; ctx.translate(sn(x), sn(y)); ctx.scale(fl * S.s * sx, S.s * sx);
  ctx.drawImage(S.f[i], -S.cw / 2, mid ? -S.ch / 2 : -S.fy); ctx.restore();
}

// 按角色真实像素包围盒居中、脚底对齐绘制（cx=水平中心, fy=脚底, k=相对该动作表比例的缩放）
function drCenter(S, i, cx, fy, k = 1) {
  const fr = S.f[i]; if (!fr) return;
  if (!S.bbs) S.bbs = [];
  const b = S.bbs[i] || (S.bbs[i] = bb(fr)), s = S.s * k;
  ctx.save(); ctx.translate(sn(cx), sn(fy)); ctx.scale(s, s);
  ctx.drawImage(fr, -(b.x0 + b.x1) / 2, -b.y1); ctx.restore();
}


// ===== 变身动画通用件：居中绘制 / 帧间渐变 / 特效（555 与龙骑共用）=====
// 以“像素质量中位数”作为角色水平中心（不是格子中心），每一帧都对齐到同一个 x，
// 这样不同帧里角色在格子中的位置差异不会让模型前后晃动。
function massCenterX(c) {
  const w = c.width, h = c.height, p = c.getContext('2d').getImageData(0, 0, w, h).data, col = new Float64Array(w);
  let tot = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (p[(y * w + x) * 4 + 3] > 128) { col[x]++; tot++ }
  if (!tot) return w / 2;
  let acc = 0; for (let x = 0; x < w; x++) { acc += col[x]; if (acc >= tot / 2) return x + .5 }
  return w / 2;
}
function drC(S, i, x, y, fl = 1, sx = 1, al = 1) {
  const fr = S.f[i]; if (!fr) return;
  if (!S.cxs) S.cxs = [];
  let c = S.cxs[i]; if (c === undefined) c = S.cxs[i] = massCenterX(fr);
  ctx.save(); ctx.globalAlpha *= al; ctx.translate(sn(x), sn(y)); ctx.scale(fl * S.s * sx, S.s * sx);
  ctx.drawImage(fr, -c, -S.fy); ctx.restore();
}

// 配色与时间点：g0~g1 = 强发光区间（进度 q，0~16）；bq = 爆发时刻（与 main.js 里的爆发帧一致）
const FAIZ_PAL = { sh: '#ffb400', g0: 8, g1: 12, bq: 8, ring: [[255, 190, 60], [255, 90, 60]], pt: ['255,60,60', '255,207,90'], fl: ['255,250,220', '255,190,60', '255,120,0'], fr: '255,240,180' };
const RYUKI_PAL = { sh: '#ff3838', g0: 8, g1: 14, bq: 10, ring: [[255, 110, 60], [255, 50, 50]], pt: ['255,50,50', '255,150,80'], fl: ['255,235,220', '255,70,60', '200,0,0'], fr: '255,200,170' };

// seq[i] = 第 i 步对应的帧号；q = 连续进度。相邻两帧交叉淡入淡出 = 补帧；停留时加呼吸 / 浮动
function drawTransSeq(S, seq, q, x, y, f, pal) {
  const i0 = q | 0, i1 = Math.min(15, i0 + 1), fr = q - i0, e = fr * fr * (3 - 2 * fr);
  const a = seq[i0], b = seq[i1], fa = cl((16 - q) / 3, 0, 1);
  const sw = Math.sin(T * 2.4), bob = sw * (q < 2 ? .6 : 1.4), br = 1 + sw * .005;
  transFx(x, y, q, fa, 0, pal);
  ctx.save();
  ctx.shadowColor = pal.sh;
  ctx.shadowBlur = q < pal.g0 - 3.5 ? 0 : q < pal.g0 ? (q - (pal.g0 - 3.5)) / 3.5 * 14 : q < pal.g1 ? 26 + Math.sin(T * 9) * 6 : 10;
  if (a === b) drC(S, a, x, y + bob, f, br);
  else { drC(S, a, x, y + bob, f, br, 1 - e * e); drC(S, b, x, y + bob, f, br, e) }
  ctx.restore();
  transFx(x, y, q, fa, 1, pal);
}

// pass 0 = 身后（地面光环 + 上升粒子），pass 1 = 身前（爆发闪光）
function transFx(x, y, q, fa, pass, pal) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (pass === 0 && q >= 3.5) {
    const amp = cl((q - 3.5) / 2, 0, 1) * fa;
    for (let k = 0; k < 2; k++) {
      const ph = (T * .8 + k * .5) % 1, rx = 40 + ph * 190;
      ctx.strokeStyle = 'rgba(' + pal.ring[k].join(',') + ',' + ((1 - ph) * .6 * amp).toFixed(3) + ')'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(x, y + 2, rx, rx * .16, 0, 0, 7); ctx.stroke();
    }
  }
  if (pass === 0 && q >= 2) {
    const n = Math.min(26, ((q - 2) * 3) | 0), amp = cl((q - 2) / 3, 0, 1) * fa;
    for (let i = 0; i < n; i++) {
      const ph = (T * .5 + i * .173) % 1, px = x + Math.sin(i * 7.3) * (45 + ph * 25), py = y - 20 - ph * 250;
      ctx.fillStyle = 'rgba(' + pal.pt[i & 1] + ',' + ((1 - ph) * amp).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(px, py, 1.6 + (i % 3), 0, 7); ctx.fill();
    }
  }
  if (pass === 1 && q >= pal.bq && q < pal.bq + 1.4) {
    const t = (q - pal.bq) / 1.4, gr = ctx.createRadialGradient(x, y - 110, 0, x, y - 110, 120 + t * 200);
    gr.addColorStop(0, 'rgba(' + pal.fl[0] + ',' + ((1 - t) * .75).toFixed(3) + ')'); gr.addColorStop(.5, 'rgba(' + pal.fl[1] + ',' + ((1 - t) * .3).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(' + pal.fl[2] + ',0)');
    ctx.fillStyle = gr; ctx.fillRect(x - 340, y - 450, 680, 560);
    ctx.strokeStyle = 'rgba(' + pal.fr + ',' + ((1 - t) * .8).toFixed(3) + ')'; ctx.lineWidth = 4 * (1 - t) + 1;
    ctx.beginPath(); ctx.ellipse(x, y - 110, 30 + t * 260, 30 + t * 260, 0, 0, 7); ctx.stroke();
  }
  ctx.restore();
}

// 卡面绘制：比例接近就直接拉伸，否则「模糊底图 + 等比居中」避免圆形胶囊被压扁
function drawArt(im, x, y, w, h) {
  if (Math.abs(w / h - im.width / im.height) < .12) { ctx.drawImage(im, x, y, w, h); return }
  const k = Math.min(w / im.width, h / im.height), iw = im.width * k, ih = im.height * k;
  ctx.save(); ctx.filter = 'blur(10px)'; ctx.drawImage(im, x - 12, y - 12, w + 24, h + 24); ctx.restore();
  ctx.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
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

// ===== HUD 仪表盘（切角科技面板 + 渐变高光血条 + 残影血条 + 数值缓动）=====
const HUDS = { hp: null, g: null, t: null };
const hudDt = () => { const d = HUDS.t === null ? 0 : Math.min(.1, Math.max(0, T - HUDS.t)); HUDS.t = T; return d };
const ht = (s, x, y, sz, c, al = 'left') => txt(s, x, y, sz, c, al, false);

function cutPath(x, y, w, h, c = 10) {
  ctx.beginPath(); ctx.moveTo(x + c, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + c); ctx.closePath();
}

// 设计语言：深色磨砂玻璃 + 发丝细描边 + 切角香槟金包边；强调色只留给“形态色 / 货币图标”，其余保持克制
const UIC = { gold: '#d9bd7d', hi: '#f3e3b0', sub: '#8f9bb0', txt: '#eef2f8' };
const UIF = '-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif';
function uw(s, sz, w = 600) { ctx.save(); ctx.font = w + ' ' + sz + 'px ' + UIF; const r = ctx.measureText(String(s)).width; ctx.restore(); return r }
// 精致文字：可调字重 / 字距 / 柔和投影（不用粗描边）
function ut(s, x, y, sz, c, al = 'left', o = {}) {
  ctx.save();
  ctx.font = (o.w || 600) + ' ' + sz + 'px ' + UIF; ctx.textAlign = al; ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) ctx.letterSpacing = (o.sp || 0) + 'px';
  if (o.sh !== 0) { ctx.shadowColor = 'rgba(0,0,0,.75)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1 }
  ctx.fillStyle = c; ctx.fillText(String(s), x, y); ctx.restore();
}

function hudPanel(x, y, w, h, acc, c = 10) {
  const k = acc === '#ff6b6b' ? acc : UIC.gold;       // 仅“力竭”警示时换红色包边
  ctx.save();
  cutPath(x, y, w, h, c);
  ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 4;
  const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, 'rgba(18,22,36,.82)'); g.addColorStop(1, 'rgba(7,9,17,.9)');
  ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.save(); ctx.clip();
  const sh = ctx.createLinearGradient(x, y, x, y + h * .5); sh.addColorStop(0, 'rgba(255,255,255,.07)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh; ctx.fillRect(x, y, w, h * .5);
  ctx.restore();
  cutPath(x, y, w, h, c); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.stroke();
  const L = 14;                                       // 切角处的金色包边
  ctx.beginPath();
  ctx.moveTo(x, y + c + L); ctx.lineTo(x, y + c); ctx.lineTo(x + c, y); ctx.lineTo(x + c + L, y);
  ctx.moveTo(x + w, y + h - c - L); ctx.lineTo(x + w, y + h - c); ctx.lineTo(x + w - c, y + h); ctx.lineTo(x + w - c - L, y + h);
  ctx.lineWidth = 1.5; ctx.lineCap = 'square'; ctx.strokeStyle = k; ctx.stroke();
  ctx.restore();
}

// 数值条：哑光深色槽 + 渐变填充 + 顶部细高光 + 端点亮线；ghost 为“残影”
function hudBar(x, y, w, h, v, m, c1, c2, ghost) {
  const r = Math.min(3, h / 2), f = cl(v / m, 0, 1), fw = w * f;
  rpath(x, y, w, h, r); ctx.fillStyle = 'rgba(2,4,10,.72)'; ctx.fill();
  ctx.save(); rpath(x, y, w, h, r); ctx.clip();
  if (ghost != null) { const gw = w * cl(ghost / m, 0, 1); if (gw > fw) { ctx.fillStyle = 'rgba(255,236,200,.55)'; ctx.fillRect(x, y, gw, h) } }
  if (fw > 0) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(x, y, fw, h);
    const gl = ctx.createLinearGradient(0, y, 0, y + h);
    gl.addColorStop(0, 'rgba(255,255,255,.22)'); gl.addColorStop(.45, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(0,0,0,.28)');
    ctx.fillStyle = gl; ctx.fillRect(x, y, fw, h);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x, y, fw, 1);
    if (fw > 2 && f < 1) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x + fw - 1, y, 1, h) }
  }
  ctx.restore();
  rpath(x, y, w, h, r); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.stroke();
}

const fmtC = n => Math.ceil(n).toLocaleString();

function drawPlayerHUD(x, y) {
  const w = 290, h = 76, acc = inForm() ? formCol() : '#00e5ff', dt = hudDt();
  if (HUDS.hp === null || HUDS.hp < P.hp) HUDS.hp = P.hp;
  else if (HUDS.hp > P.hp) HUDS.hp = Math.max(P.hp, HUDS.hp - P.mh * .3 * dt);

  hudPanel(x, y, w, h, acc, 12);
  if (P.hp / P.mh < .3 && P.hp > 0) {           // 低血量：红色脉冲警示
    ctx.save(); cutPath(x, y, w, h, 12); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,60,70,' + (.25 + .35 * (Math.sin(T * 8) + 1) / 2).toFixed(2) + ')'; ctx.stroke(); ctx.restore();
  }

  // 等级徽章：外圈即经验进度，金色发丝外环
  const cx = x + 42, cy = y + 38, R = 24, maxExp = xpNeed(S.lv), ep = cl(S.xp / maxExp, 0, 1);
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R + 4, 0, 7); ctx.fillStyle = 'rgba(3,5,12,.92)'; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(217,189,125,.55)'; ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
  if (ep > 0) {
    const g = ctx.createLinearGradient(cx - R, cy + R, cx + R, cy - R); g.addColorStop(0, acc); g.addColorStop(1, '#ffffff');
    ctx.lineCap = 'round'; ctx.strokeStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ep); ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(cx, cy, R - 5, 0, 7);
  const ig = ctx.createRadialGradient(cx, cy - 6, 2, cx, cy, R - 5); ig.addColorStop(0, acc + '33'); ig.addColorStop(1, 'rgba(6,10,20,.95)');
  ctx.fillStyle = ig; ctx.fill();
  ctx.restore();
  ut('LV', cx, cy - 9, 8, UIC.sub, 'center', { w: 700, sp: 1.5, sh: 0 });
  ut(S.lv, cx, cy + 5, 18, UIC.hi, 'center', { w: 700 });

  const bx = x + 82, bw = w - 82 - 14;
  ut(formName(), bx, y + 11, 9.5, acc, 'left', { w: 700, sp: 1.2, sh: 0 });
  ut('EXP ' + Math.floor(ep * 100) + '%', bx + bw, y + 11, 9.5, UIC.sub, 'right', { w: 600, sh: 0 });
  rpath(bx, y + 18, bw, 2, 1); ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fill();
  if (ep > 0) { rpath(bx, y + 18, bw * ep, 2, 1); ctx.fillStyle = acc; ctx.fill() }

  hudBar(bx, y + 27, bw, 18, P.hp, P.mh, '#b81f33', '#f0603f', HUDS.hp);
  ut('HP', bx + 7, y + 36.5, 9, 'rgba(255,255,255,.78)', 'left', { w: 700, sp: 1 });
  ut(fmtC(P.hp) + ' / ' + fmtC(P.mh), bx + bw - 7, y + 36.5, 11, '#fff', 'right', { w: 700 });

  hudBar(bx, y + 51, bw, 12, P.mp, P.mm, '#1f4fc0', '#35b4e8');
  ut('MP', bx + 7, y + 57.2, 8, 'rgba(255,255,255,.78)', 'left', { w: 700, sp: 1 });
  ut(fmtC(P.mp) + ' / ' + fmtC(P.mm), bx + bw - 7, y + 57.2, 9.5, '#fff', 'right', { w: 700 });
  drawCPHUD(x + w + 8, y);   // 战力胶囊（点击打开排行榜）
  drawQuestBtn(CP_HUD.x + CP_HUD.w + 6, CP_HUD.y);   // 任务按钮（有可领奖励时显示红点）
}

function drawStaminaHUD(x, y) {
  const w = 290, h = 34, ready = P.dcd <= 0, acc = P.exh ? '#ff6b6b' : UIC.gold;
  hudPanel(x, y, w, h, acc, 9);
  const cx = x + 42, cy = y + 17, rad = 12;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.fillStyle = 'rgba(5,8,16,.85)'; ctx.fill();
  if (!ready) {
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, rad, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - P.dcd / DODGE_CD)); ctx.closePath();
    ctx.fillStyle = 'rgba(217,189,125,.3)'; ctx.fill();
  }
  ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.lineWidth = 1.5; ctx.strokeStyle = ready ? UIC.gold : '#4a5568';
  if (ready) { ctx.shadowColor = UIC.gold; ctx.shadowBlur = 5 }
  ctx.stroke(); ctx.restore();
  ut('闪', cx, cy, 11, ready ? UIC.hi : '#6f7a8c', 'center', { w: 700, sh: 0 });

  const bx = x + 82, bw = w - 82 - 14;
  hudBar(bx, y + 10, bw, 14, P.sta, P.stm, P.exh ? '#a8323a' : '#a87a14', P.exh ? '#e8654f' : '#e6bd4b');
  ut(P.exh ? 'EN 力竭' : 'EN', bx + 7, y + 17.5, 9, 'rgba(255,255,255,.85)', 'left', { w: 700, sp: 1 });
  ut(fmtC(P.sta) + ' / ' + fmtC(P.stm), bx + bw - 7, y + 17.5, 10, '#fff', 'right', { w: 700 });
}

// ===== 货币图标（Assets/Icon/Coin.png / Diamond.png）=====
// 载入时裁掉透明边并逐级缩小到 96px 高（直接把 2000px 大图画成 20px 会有锯齿）；没载入到就退回原来的矢量图 / emoji
const ICO = { g: null, d: null, mat: null, scr: null };   // mat = 强化碎晶(Shard.png)，scr = 强化卷轴(Scroll.png)
// ===== 装备部位图标（Assets/Icon/Equip_xxx.png），没有素材时退回 emoji =====
const EQI = {};   // { weapon, chest, belt, legs, boots, necklace, ring, ryuki_cap } -> canvas
function fitIco(ic, cx, cy, box) {   // 等比缩放进 box×box 的方框（取宽高中较大的一边），居中绘制
  if (!ic) return false;
  const k = box / Math.max(ic.width, ic.height), w = ic.width * k, h = ic.height * k;
  ctx.drawImage(ic, cx - w / 2, cy - h / 2, w, h); return true;
}
function slotIco(slot, cx, cy, box, fs) {   // box = 图标方框边长；fs = 没贴图时 emoji 的字号
  if (fitIco(EQI[slot], cx, cy, box)) return;
  txt(SLOT_ICON[slot] || '', cx, cy, fs, '#fff', 'center', false);
}
function mkIcon(im, H = 96) {
  if (!im) return null;
  let c = trim(toCanvas(im));
  while (c.height > H * 2) { const n = document.createElement('canvas'); n.width = Math.max(1, c.width >> 1); n.height = Math.max(1, c.height >> 1); const g = n.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, n.width, n.height); c = n }
  if (c.height > H) { const o = document.createElement('canvas'); o.height = H; o.width = Math.round(c.width * H / c.height); const g = o.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, o.width, o.height); c = o }
  return c;
}
// 把大图缩到指定高度（逐级对半）。主页卡顿的元凶是每帧把几千像素的大图缩成几百像素来画
function shrinkH(c, H) {
  if (!c || c.height <= H) return c;
  let cur = c;
  while (cur.height > H) {
    const nh = cur.height > H * 2 ? cur.height >> 1 : H, n = document.createElement('canvas');
    n.height = nh; n.width = Math.max(1, Math.round(cur.width * nh / cur.height));
    const g = n.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(cur, 0, 0, n.width, n.height); cur = n;
  }
  return cur;
}
const icoW = (ic, h) => ic.width * h / ic.height;
function drawIco(ic, cx, cy, h) { if (!ic) return false; const w = icoW(ic, h); ctx.drawImage(ic, cx - w / 2, cy - h / 2, w, h); return true }
// 文字开头的 🪙/💰/💎 换成图标；go=true 时只换金币（材料也用 💎，不是钻石）
function curParse(s, go) { const m = /^(🪙|💰|💎|📜) ?/.exec(s); if (!m) return null; const ic = m[1] === '📜' ? ICO.scr : m[1] === '💎' ? (go ? ICO.mat : ICO.d) : ICO.g; return ic ? { ic, rest: s.slice(m[0].length) } : null }
function curW(s, sz, go) { const c = curParse(s, go); return c ? icoW(c.ic, sz * 1.05) + 3 + tw(c.rest, sz) : tw(s, sz) }
function curT(s, x, y, sz, col, al = 'left', tf = txt, go) {
  const c = curParse(s, go); if (!c) return tf(s, x, y, sz, col, al);
  const ih = sz * 1.05, iw = icoW(c.ic, ih), w = iw + 3 + tw(c.rest, sz), x0 = al === 'center' ? x - w / 2 : al === 'right' ? x - w : x;
  drawIco(c.ic, x0 + iw / 2, y, ih); tf(c.rest, x0 + iw + 3, y, sz, col, 'left');
}

function drawGoldHUD() {
  const dt = hudDt();
  if (HUDS.g === null) HUDS.g = S.g;
  const df = S.g - HUDS.g; HUDS.g = Math.abs(df) < 1 ? S.g : HUDS.g + df * Math.min(1, dt * 8 + .02);
  const s = Math.round(HUDS.g).toLocaleString(), w = Math.max(92, tw(s, 12) + 52), h = 22, x = 960 - 16 - w, y = 14;
  hudPanel(x, y, w, h, UIC.gold, 6);
  const cx = x + 15, cy = y + 11;
  if (!drawIco(ICO.g, cx, cy, 15)) {   // 没有图标素材时用矢量金币
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, 6.5, 0, 7);
    const g = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, 7); g.addColorStop(0, '#fff4b0'); g.addColorStop(1, '#e0a010');
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#8a5a00'; ctx.stroke();
    ctx.restore();
  }
  ut(s, x + w - 24, cy, 12, UIC.hi, 'right', { w: 700 });
  ut('G', x + w - 12, cy + 1, 8.5, UIC.sub, 'center', { w: 700, sh: 0 });
  drawDiamondHUD(y + h + 4);
}

// 钻石 HUD：金币条正下方
function drawDiamondHUD(y) {
  const s = Math.round(S.d).toLocaleString(), w = Math.max(92, tw(s, 12) + 52), h = 22, x = 960 - 16 - w;
  hudPanel(x, y, w, h, UIC.gold, 6);
  const cx = x + 15, cy = y + 11;
  if (!drawIco(ICO.d, cx, cy, 15)) {   // 没有图标素材时用矢量钻石
    ctx.save();
    ctx.beginPath(); ctx.moveTo(cx, cy - 7); ctx.lineTo(cx + 6, cy - 1); ctx.lineTo(cx, cy + 7); ctx.lineTo(cx - 6, cy - 1); ctx.closePath();
    const g = ctx.createLinearGradient(cx - 6, cy - 7, cx + 6, cy + 7); g.addColorStop(0, '#e6fdff'); g.addColorStop(.5, '#5fe0ff'); g.addColorStop(1, '#2a8de0');
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#1b5f9a'; ctx.stroke();
    ctx.restore();
  }
  ut(s, x + w - 12, cy, 12, '#c4ecf7', 'right', { w: 700 });
}

function drawMinimapHUD() {
  const mw = 196, mh = 82, x = 16, y = 405;
  hudPanel(x, y, mw, mh, UIC.gold, 10);
  ut('RADAR', x + 14, y + 13, 9, UIC.sub, 'left', { w: 700, sp: 2, sh: 0 });
  const pulse = (Math.sin(T * 4) + 1) * .5, alert = G === 'play';
  ctx.save(); ctx.fillStyle = alert ? 'rgba(255,71,87,' + (.45 + pulse * .55) + ')' : 'rgba(46,213,115,' + (.45 + pulse * .55) + ')';
  ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 4; ctx.beginPath(); ctx.arc(x + mw - 18, y + 13, 3, 0, 7); ctx.fill(); ctx.restore();

  const rx = x + 12, ry = y + 25, rw = mw - 24, rh = 47;
  rpath(rx, ry, rw, rh, 4); ctx.fillStyle = 'rgba(2,4,10,.7)'; ctx.fill();
  ctx.save(); rpath(rx, ry, rw, rh, 4); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,.035)';                                   // 网格
  for (let gx = rx + 12; gx < rx + rw; gx += 12) ctx.fillRect(gx, ry, 1, rh);
  ctx.fillRect(rx, ry + rh / 2, rw, 1);
  const sx = rx + ((T * .5) % 1) * rw, sg = ctx.createLinearGradient(sx - 22, 0, sx, 0);   // 扫描线
  sg.addColorStop(0, 'rgba(217,189,125,0)'); sg.addColorStop(1, 'rgba(217,189,125,.16)'); ctx.fillStyle = sg; ctx.fillRect(sx - 22, ry, 22, rh);

  const isPlay = G === 'play', totalW = isPlay ? WW : (G === 'room' ? RW() : VW);
  const camX0 = rx + (cam / totalW) * rw, camW = (960 / totalW) * rw;
  ctx.fillStyle = 'rgba(217,189,125,.07)'; ctx.fillRect(camX0, ry + 1, camW, rh - 2);
  ctx.strokeStyle = 'rgba(217,189,125,.5)'; ctx.lineWidth = 1; ctx.strokeRect(camX0 + .5, ry + 1.5, camW - 1, rh - 3);

  const dot = (px, py, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill() };
  if (!isPlay && G !== 'room') {
    dot(rx + (EL.x / totalW) * rw, ry + rh / 2, 3, '#bbb');
    BD.forEach(b => dot(rx + (b.x / totalW) * rw, ry + rh / 2, 4, b.c));
    dot(rx + (PT / totalW) * rw, ry + rh / 2, 5, '#7df9ff');
  }
  if (isPlay) {
    for (const e of E) {
      const ex = rx + (e.x / totalW) * rw, ey = ry + (e.t === 'imp' ? rh * .35 : rh * .65);
      dot(ex, ey, e.t === 'boss' ? 6 : 3, e.t === 'boss' ? '#ff3838' : (e.t === 'wd' ? '#d6a2e8' : '#ff5252'));
    }
  }
  const px = rx + (P.x / totalW) * rw;
  ctx.save(); ctx.shadowColor = inForm() ? formCol() : '#2ed573'; ctx.shadowBlur = 8;
  dot(px, ry + rh / 2, 4.5, inForm() ? formCol() : '#2ed573'); ctx.restore();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(px, ry + rh / 2, 4.5, 0, 7); ctx.stroke();
  ctx.restore();
  rpath(rx, ry, rw, rh, 4); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.stroke();
}

function drawLocationHUD(locName) {
  const x = 16, y = 496, w = 196, h = 30;
  hudPanel(x, y, w, h, UIC.gold, 8);
  const mx = x + 21, my = y + h / 2;                     // 金色菱形定位标记（替代 emoji）
  ctx.save(); ctx.fillStyle = UIC.gold; ctx.beginPath(); ctx.moveTo(mx, my - 5); ctx.lineTo(mx + 4, my); ctx.lineTo(mx, my + 5); ctx.lineTo(mx - 4, my); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(8,10,18,.9)'; ctx.beginPath(); ctx.arc(mx, my, 1.4, 0, 7); ctx.fill(); ctx.restore();
  ut(locName, x + 36, my, 12.5, '#e6ebf5', 'left', { w: 600, sp: .5 });
}

// ===== 装备详情用的小工具 =====
const fmtN = n => Math.round(+n || 0).toLocaleString();   // 完整数字（千分位），不再缩写成 k / M

// 小标签：good=true 绿色（够），false 红色（不够）
function chip(x, y, w, h, label, good, sz = 11) {
  rpath(x, y, w, h, 5);
  ctx.fillStyle = good ? 'rgba(46,213,115,.16)' : 'rgba(255,71,87,.18)'; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = good ? 'rgba(46,213,115,.65)' : 'rgba(255,90,100,.75)'; ctx.stroke();
  curT(label, x + w / 2, y + h / 2, sz, good ? '#a6ffc4' : '#ff9aa4', 'center', ht, true);
}

// 信息卡片底板
function card(x, y, w, h) {
  rpath(x, y, w, h, 8); ctx.fillStyle = 'rgba(14,20,42,.92)'; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,229,255,.2)'; ctx.stroke();
}

// ===== 详细部位 Filter 背包、等级需求、全选与批量分解 =====
// ===== 背包面板 =====
// 绘制时同步登记点击区域(BH)，点击时直接查表 —— 绘制与点击永远不会错位
let BH = [];
const BAG_PAGE = 16;   // 4 列 × 4 行
const BAG_FONT = '-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif';
const BAG_FILTERS = [
  { id: 'all', n: '全部' }, { id: 'weapon', n: '武器' }, { id: 'chest', n: '胸甲' }, { id: 'belt', n: '腰带' },
  { id: 'legs', n: '腿甲' }, { id: 'boots', n: '靴子' }, { id: 'necklace', n: '项链' }, { id: 'ring', n: '戒指' }
];
const bagHit = (x, y, w, h, f) => BH.push({ x, y, w, h, f });
// 鼠标位置（仅鼠标指针；触屏没有悬停，点开详情页就能对比）
const MOUSE = { x: -1, y: -1, on: false };
cv.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); MOUSE.x = (e.clientX - r.left) / r.width * 960; MOUSE.y = (e.clientY - r.top) / r.height * 540; MOUSE.on = e.pointerType === 'mouse'; });
cv.addEventListener('pointerleave', () => { MOUSE.on = false; });
let bagHover = null;   // 本帧鼠标指着的背包装备
// 数值差异小标签（▲ 绿 / ▼ 红）；返回标签左边缘，没有差异返回 null
function bagDelta(d, fmt, rightX, yy, sz = 12, h = 20) {
  if (Math.abs(d) < 1e-6) return null;
  const up = d > 0, s = (up ? '▲ ' : '▼ ') + fmt(Math.abs(d)), w = bagTw(s, sz) + 14, px = rightX - w;
  rpath(px, yy - h / 2, w, h, 5); ctx.fillStyle = up ? 'rgba(46,213,115,.16)' : 'rgba(255,71,87,.16)'; ctx.fill();
  txt(s, px + w / 2, yy, sz, up ? '#2ed573' : '#ff6b81', 'center', false);
  return px;
}
const BASE_ROWS = { atk: ['攻击力', '#ff9f9f'], hp: ['生命值', '#7dffd0'], mp: ['魔力值', '#8ec5ff'], crit: ['暴击率', '#ffe08a', 1], def: ['免伤值', '#9dffb8'] };
const baseFmt = (k, v) => k === 'crit' ? (v * 100).toFixed(1) + '%' : Math.round(v).toLocaleString();
const bagTw = (s, sz) => { ctx.save(); ctx.font = `700 ${sz}px ${BAG_FONT}`; const w = ctx.measureText(String(s)).width; ctx.restore(); return w };
const bagArmed = k => bagArmKey === k && T < bagArmUntil;

function bagBtn(x, y, w, h, label, bg, fg, sz, f, bd) {
  bevel(x, y, w, h, 6); ctx.fillStyle = bg; ctx.fill();
  if (bd) { ctx.lineWidth = 1.5; ctx.strokeStyle = bd; ctx.stroke() }
  txt(label, x + w / 2, y + h / 2, sz, fg, 'center');
  if (f) bagHit(x, y, w, h, f);
}

// 文字过长时自动缩小字号
function fitTxt(s, x, y, maxW, sz, c, al = 'left') {
  while (sz > 9) { ctx.font = `700 ${sz}px ${BAG_FONT}`; if (ctx.measureText(s).width <= maxW) break; sz--; }
  txt(s, x, y, sz, c, al);
}

// ===== 科幻风背包面板（参考效果图）：切角边框 / 品质发光卡片 / 全息底座 =====
// 可选背景：把一张「无文字」的实验室背景图放到 Assets/UI/bag_bg.jpg，会自动铺在面板底层；没有这张图也能正常显示
const BAGBG = new Image(); BAGBG.src = encodeURI(A + 'UI/bag_bg.jpg');
const SLOT_ICON = { weapon: '🗡️', chest: '🛡️', belt: '🥋', legs: '🦿', boots: '👢', necklace: '📿', ring: '💍', ryuki_cap: '💊' };

// 切角路径
function bevel(x, y, w, h, c) {
  ctx.beginPath();
  ctx.moveTo(x + c, y); ctx.lineTo(x + w - c, y); ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c); ctx.lineTo(x + w - c, y + h); ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c); ctx.lineTo(x, y + c); ctx.closePath();
}

// 品质卡片：品质色渐变底 + 发光描边
function techCard(x, y, w, h, col, on) {
  bevel(x, y, w, h, 8);
  ctx.fillStyle = 'rgba(8,12,26,.95)'; ctx.fill();
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(5,10,20,0)');
  ctx.save(); ctx.globalAlpha = .34; ctx.fillStyle = g; ctx.fill(); ctx.restore();
  ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = on ? 14 : 6;
  ctx.lineWidth = on ? 2.5 : 1.6; ctx.strokeStyle = col; ctx.stroke(); ctx.restore();
}

// 面板：深色底 + 切角发光边 + 四角亮点
function techPanel(x, y, w, h, col, c = 10, fill = 'rgba(6,9,20,.72)') {
  bevel(x, y, w, h, c); ctx.fillStyle = fill; ctx.fill();
  ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 8; ctx.lineWidth = 1.4; ctx.strokeStyle = col; ctx.stroke(); ctx.restore();
  ctx.save(); ctx.fillStyle = col;
  [[x + c, y], [x + w - c, y], [x + c, y + h], [x + w - c, y + h]].forEach(p => ctx.fillRect(p[0] - 3, p[1] - 1.5, 6, 3));
  ctx.restore();
}

// 全息底座 + 上升光粒子
function drawHoloPlatform(cx, cy, w, col) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const gr = ctx.createRadialGradient(cx, cy, 4, cx, cy, w / 2);
  gr.addColorStop(0, 'rgba(255,190,80,.38)'); gr.addColorStop(1, 'rgba(255,190,80,0)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(cx, cy, w / 2, w * .17, 0, 0, 7); ctx.fill();
  for (let i = 0; i < 3; i++) {
    const rr = w / 2 - i * 13;
    ctx.strokeStyle = col; ctx.globalAlpha = .75 - i * .2; ctx.lineWidth = 1.8 - i * .4;
    ctx.beginPath(); ctx.ellipse(cx, cy, rr, rr * .3, 0, 0, 7); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 16; i++) {
    const k = (T * .3 + i / 16) % 1, a = i * 2.4;
    ctx.fillStyle = 'rgba(255,215,130,' + (1 - k) * .9 + ')';
    ctx.fillRect(cx + Math.cos(a) * w * .36 * (1 - k * .35), cy - k * 170 + Math.sin(a) * 4, 2, 2);
  }
  ctx.restore();
}

function drawCharPanel() {
  BH = [];
  const x = 25, y = 20, w = 910, h = 500;
  const fcol = inForm() ? formCol() : '#00e5ff';
  ctx.save();
  ctx.fillStyle = 'rgba(4, 7, 16, 0.88)'; ctx.fillRect(0, 0, 960, 540);

  // 主框：背景图（可选）+ 暗色罩 + 切角发光边
  bevel(x, y, w, h, 18); ctx.fillStyle = 'rgba(10, 14, 28, 0.97)'; ctx.fill();
  if (BAGBG.complete && BAGBG.naturalWidth) {
    ctx.save(); bevel(x, y, w, h, 18); ctx.clip();
    ctx.drawImage(BAGBG, x, y, w, h);
    ctx.fillStyle = 'rgba(4,8,18,.55)'; ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
  bevel(x, y, w, h, 18);
  ctx.save(); ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 14; ctx.lineWidth = 2.5; ctx.strokeStyle = '#00e5ff'; ctx.stroke(); ctx.restore();

  // 标题栏
  bevel(x + 4, y + 4, w - 8, 34, 12); ctx.fillStyle = 'rgba(0, 229, 255, 0.13)'; ctx.fill();
  txt('⚡ 假面骑士 MALAYA · 骑士装甲与无限战备背包 ⚡', x + 20, y + 21, 14, '#7df9ff', 'left');
  bagBtn(x + w - 76, y + 9, 66, 24, '✕ 关闭', 'rgba(255,71,87,.25)', '#ff9aa4', 11.5, () => { showChar = false }, '#ff4757');

  // ================= 左侧：信息条 + [左槽 | 角色 | 右槽] + 战斗参数 =================
  const lx = x + 18, ly = y + 46, lw = 330, lh = 440;
  techPanel(lx, ly, lw, lh, 'rgba(0,229,255,.4)', 12);

  // 顶部信息条
  techPanel(lx + 10, ly + 10, lw - 20, 62, fcol, 8, 'rgba(12,20,38,.78)');
  txt('假面骑士 MALAYA', lx + 20, ly + 24, 14, '#ffd84a');
  txt(P.ryuki ? '★ 龙骑契约形态' : P.k5 ? '★ 555 智脑形态' : P.bl ? '★ Blade 黑桃形态' : '原生基础形态', lx + 150, ly + 24, 11, P.ryuki ? '#ff7675' : P.k5 ? '#ffd166' : P.bl ? '#7fd0ff' : '#7df9ff');
  txt('Lv.' + S.lv + ' / 500', lx + 20, ly + 42, 12, '#fff');
  curT('💰 ' + fmtN(S.g) + ' G', lx + 110, ly + 42, 12, '#ffd84a', 'left', txt, true);
  {   // 第二行按实际宽度顺排：数字再长也不会叠在一起
    let ex = lx + 20;
    const dS = '💎 ' + fmtN(S.d), mS = ICO.mat ? '💎 ' + fmtN(S.mat) : '◆碎晶 ' + fmtN(S.mat), cS = '📜 ' + fmtN(S.scr || 0);
    curT(dS, ex, ly + 60, 12, '#7fe9ff', 'left', txt); ex += curW(dS, 12) + 16;
    curT(mS, ex, ly + 60, 12, '#c58bff', 'left', txt, true); ex += curW(mS, 12, true) + 16;
    curT(cS, ex, ly + 60, 12, '#ffa502', 'left', txt, true);
  }

  // 角色舞台（中间）
  const SW = 96, SHt = 56, GAPY = 8, sy0 = ly + 80, stageH = SHt * 4 + GAPY * 3;
  const cx = lx + lw / 2, pcy = sy0 + stageH - 14;
  const sg = ctx.createRadialGradient(cx, sy0 + stageH * .55, 10, cx, sy0 + stageH * .55, 130);
  sg.addColorStop(0, fcol.length === 7 ? fcol + '33' : 'rgba(0,229,255,.2)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg; ctx.fillRect(lx + 10, sy0 - 4, lw - 20, stageH + 8);
  drawHoloPlatform(cx, pcy, 108, formCol());
  ctx.save();
  ctx.shadowColor = fcol; ctx.shadowBlur = 12;
  const K = .95;   // 立绘缩放：嫌大/小改这里
  if (P.ryuki && SH.ryukiTrans && SH.ryukiTrans.f[15]) drCenter(SH.ryukiTrans, 15, cx, pcy - 2, K);
  else if (P.k5 && okS(SH5.trans)) drCenter(SH5.trans, 8, cx, pcy - 2, K);
  else if (P.bl && okS(SH6.atk)) drCenter(SH6.atk, 12, cx, pcy - 2, K);
  else if (SH.atk && SH.atk.f[12]) drCenter(SH.atk, 12, cx, pcy - 2, K);
  ctx.restore();

  // 穿戴槽：左 4（武器/胸甲/腿甲/靴子），右 4（腰带/项链/戒指/胶囊）
  const slotLayout = [
    { k: 'weapon', n: '武器', col: 0 }, { k: 'chest', n: '胸甲', col: 0 }, { k: 'legs', n: '腿甲', col: 0 }, { k: 'boots', n: '靴子', col: 0 },
    { k: 'belt', n: '变身腰带', col: 1 }, { k: 'necklace', n: '项链', col: 1 }, { k: 'ring', n: '戒指', col: 1 }, { k: 'ryuki_cap', n: '变身胶囊', col: 1 }
  ];
  slotLayout.forEach((sl, i) => {
    const row = i % 4, sx = sl.col ? lx + lw - 10 - SW : lx + 10, sy = sy0 + row * (SHt + GAPY);
    const isCap = sl.k === 'ryuki_cap';
    const ec = isCap ? CAPSULES.find(c => c.id === S.eqCap) : null;
    const it = isCap ? (ec ? { name: ec.slotName, tier: ec.tier, lvl: 0 } : null) : S.eq[sl.k];
    const on = !isCap && selItem && selItem.from === 'eq' && selItem.slotKey === sl.k;
    const tc = it ? TIERS[it.tier].c : 'rgba(255,255,255,.16)';
    bevel(sx, sy, SW, SHt, 7);
    ctx.fillStyle = on ? 'rgba(0,229,255,.26)' : 'rgba(8,14,28,.88)'; ctx.fill();
    if (it) { const g = ctx.createLinearGradient(sx, sy, sx + SW, sy); g.addColorStop(0, tc); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.save(); ctx.globalAlpha = .22; ctx.fillStyle = g; ctx.fill(); ctx.restore(); }
    ctx.save(); if (it) { ctx.shadowColor = tc; ctx.shadowBlur = on ? 12 : 5 }
    ctx.lineWidth = on ? 2.2 : 1.3; ctx.strokeStyle = on ? '#00e5ff' : tc; ctx.stroke(); ctx.restore();
    ctx.fillStyle = tc; ctx.fillRect(sl.col ? sx + SW - 4 : sx, sy + 9, 4, SHt - 18);   // 贴向角色一侧的品质色条
    const tx = sl.col ? sx + 8 : sx + 10;
    txt(sl.n, tx, sy + 13, 11, '#8fa0b3');
    slotIco(sl.k, sx + (sl.col ? SW - 20 : SW - 16), sy + 14, 20, 12);
    if (it) {
      fitTxt(it.name, tx, sy + 31, SW - 22, 12, tc);
      if (it.lvl) txt('+' + it.lvl, tx, sy + 46, 11, '#ffa502');
      if (it.star) txt('⭐' + it.star, sx + (sl.col ? SW - 12 : SW - 8), sy + 46, 10, '#ffd84a', 'right');
      if (it.locked) txt('🔒', tx + (it.lvl ? 30 : 0), sy + 46, 10, '#ffd84a', 'left', false);
    } else txt(isCap ? '点击装配' : '空槽位', tx, sy + 34, 11, '#5d6b7c');
    bagHit(sx, sy, SW, SHt, () => {
      if (isCap) { showCapModal = true; return }
      if (it) { bagMulti = false; batchSel.clear(); selItem = { item: it, from: 'eq', slotKey: sl.k } }
    });
  });

  // 实战参数
  const py0 = ly + 338;
  techPanel(lx + 10, py0, lw - 20, 94, 'rgba(0,229,255,.35)', 8, 'rgba(8,14,30,.88)');
  txt('实战参数', lx + 22, py0 + 15, 12, '#7df9ff');
  ctx.save(); ctx.strokeStyle = 'rgba(0,229,255,.55)'; ctx.lineWidth = 1; ctx.beginPath();   // 心电线装饰
  for (let i = 0; i <= 40; i++) { const px = lx + 190 + i * 3, v = (i % 10 === 4 ? -7 : i % 10 === 5 ? 6 : 0) + Math.sin(T * 4 + i) * .6; i ? ctx.lineTo(px, py0 + 15 + v) : ctx.moveTo(px, py0 + 15 + v) }
  ctx.stroke(); ctx.restore();
  txt('攻击 ' + (P.atk | 0), lx + 22, py0 + 36, 13, '#ff9f9f');
  txt('暴击 ' + Math.round(P.cr * 100) + '%', lx + 122, py0 + 36, 13, '#ffeaa7');
  txt('免伤 ' + (P.def * 100).toFixed(1) + '%', lx + 222, py0 + 36, 13, '#7dff9a');
  txt('生命 ' + P.mh, lx + 22, py0 + 58, 13, '#55efc4');
  txt('魔力 ' + P.mm, lx + 122, py0 + 58, 13, '#74b9ff');
  txt('吸血 ' + (affixTotal('ls') * 100).toFixed(1) + '%', lx + 222, py0 + 58, 13, '#ff6b81');
  txt('移速 +' + Math.round(affixTotal('spd') * 100) + '%', lx + 22, py0 + 80, 13, '#7df9ff');

  // ================= 右侧：列表视图 / 详情视图 =================
  const rx = x + 358, ry = y + 46, rw = 534, rh = 440;
  techPanel(rx, ry, rw, rh, 'rgba(0,229,255,.4)', 12);
  bagHover = null;
  if (!bagMulti && selItem && selItem.item) drawBagDetail(rx, ry, rw); else { drawBagList(rx, ry, rw); if (bagHover) drawBagTip(bagHover); }
  ctx.restore();
}

// ---------- 悬停对比浮窗：指着的装备（带 ▲▼）vs 当前穿戴的同部位装备 ----------
function drawTipCard(o, ref, x, y, w, h, label, lcol) {
  rpath(x, y, w, h, 8); ctx.fillStyle = 'rgba(10,16,32,.96)'; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = o ? TIERS[o.tier].c : 'rgba(255,255,255,.2)'; ctx.stroke();
  txt(label, x + 10, y + 11, 10, lcol, 'left', false);
  if (!o) { txt('该部位未穿戴', x + w / 2, y + h / 2, 13, '#6f7f95', 'center', false); return; }
  const tier = TIERS[o.tier];
  fitTxt(o.name + (o.lvl ? ' +' + o.lvl : ''), x + 10, y + 29, w - 20, 13, tier.c);
  const sub = 'Lv.' + (o.reqLvl || 1) + (o.star ? '  ⭐' + o.star : '');
  txt(sub, x + 10, y + 46, 11, (o.reqLvl || 1) > S.lv ? '#ff6b7a' : '#aab6c3', 'left', false);
  const bks = Object.keys(o.baseStats || {}).filter(k => o.baseStats[k] && BASE_ROWS[k]), affs = o.affix || [], rh = 21, y0 = y + 58;
  bks.forEach((k, i) => {
    const r = BASE_ROWS[k], yy = y0 + rh * (i + .5), nv = baseShow(o, k);
    txt(r[0], x + 10, yy, 11.5, r[1], 'left', false);
    txt(baseFmt(k, nv), x + 66, yy, 13.5, '#fff');
    if (ref) bagDelta(nv - baseShow(ref, k), v => baseFmt(k, v), x + w - 8, yy, 10.5, 17);
  });
  const ay = y0 + rh * bks.length;
  ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(x + 8, ay + 1, w - 16, 1);
  affs.forEach((a, i) => {
    const d = AFFIX_DEFS[a.k]; if (!d) return;
    const yy = ay + 4 + rh * (i + .5);
    ctx.fillStyle = d.c; ctx.fillRect(x + 8, yy - 8, 2, 16);
    txt('◆ ' + d.n, x + 14, yy, 11.5, d.c, 'left', false);
    txt(affixStr(o, a), x + 76, yy, 12.5, d.c);
    if (ref) bagDelta(affixNum(o, a.k) - affixNum(ref, a.k), v => affixFmt(a.k, v), x + w - 8, yy, 10.5, 17);
  });
}
function drawBagTip(it) {
  const cur = S.eq[it.slot], CW = 196, gap = 6, H = 58 + 21 * 5 + 8 + 4, FH = 26, W = CW * 2 + gap, TH = H + FH;
  let x = MOUSE.x + 18, y = MOUSE.y + 14;
  if (x + W > 950) x = MOUSE.x - 18 - W;
  x = Math.max(8, x); y = Math.max(8, Math.min(y, 532 - TH));
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 16;
  rpath(x - 4, y - 4, W + 8, TH + 8, 10); ctx.fillStyle = 'rgba(4,7,16,.94)'; ctx.fill();
  ctx.shadowBlur = 0; ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,229,255,.5)'; ctx.stroke();
  drawTipCard(it, cur, x, y, CW, H, '🔍 指向的装备（▲▼ = 相对当前穿戴）', '#7df9ff');
  drawTipCard(cur || null, null, x + CW + gap, y, CW, H, '✅ 当前穿戴', '#7dff9a');
  const dcp = cur ? cpDelta(it) : null;
  if (dcp !== null) txt(cpTag(dcp), x + W / 2, y + H + FH / 2 - 1, 13, dcp > 0 ? '#2ed573' : dcp < 0 ? '#ff6b81' : '#9fb0c6', 'center');
  else txt('该部位空着，穿上就是提升', x + W / 2, y + H + FH / 2 - 1, 13, '#2ed573', 'center');
  ctx.restore();
}

// ---------- 列表视图：筛选 / 工具栏 / 4×4 格子 / 底部操作栏 ----------
function drawBagList(rx, ry, rw) {
  const fw = 60, fg = 4;
  BAG_FILTERS.forEach((fl, i) => {
    const on = bagFilter === fl.id;
    bagBtn(rx + 10 + i * (fw + fg), ry + 8, fw, 32, fl.n, on ? 'rgba(0,229,255,.3)' : 'rgba(20,26,44,.7)', on ? '#ffd84a' : '#b8c2cc', 13,
      () => { bagFilter = fl.id; bagPage = 0 }, on ? '#00e5ff' : 'rgba(255,255,255,.15)');
  });
  const list = bagList();
  const maxPages = Math.max(1, Math.ceil(list.length / BAG_PAGE));
  if (bagPage >= maxPages) bagPage = maxPages - 1;

  // 工具栏：多选开关 + 全选 + 翻页
  const ty = ry + 46, th = 30, cur = BAG_FILTERS.find(f => f.id === bagFilter) || BAG_FILTERS[0];
  bagBtn(rx + 10, ty, 88, th, bagMulti ? '☑ 多选中' : '☐ 多选', bagMulti ? 'rgba(255,216,74,.25)' : 'rgba(20,26,44,.7)', bagMulti ? '#ffd84a' : '#dfe6e9', 13,
    () => { bagMulti = !bagMulti; batchSel.clear(); selItem = null; bagArmKey = '' }, bagMulti ? '#ffd84a' : 'rgba(255,255,255,.2)');
  if (bagMulti) {
    const allIn = list.length > 0 && list.every(it => batchSel.has(it.id));
    bagBtn(rx + 104, ty, 80, th, allIn ? '取消全选' : '✔ 全选', allIn ? 'rgba(255,71,87,.3)' : 'rgba(0,229,255,.25)', allIn ? '#ff9aa4' : '#7df9ff', 13,
      () => selectAllBatch(list), allIn ? '#ff4757' : '#00e5ff');
  } else {
    txt(cur.n + ' · ' + list.length + ' 件', rx + 110, ty + th / 2, 13, '#7df9ff');
  }
  // 状态筛选（可叠加）：▲有提升 / ✔可穿戴（数字 = 当前部位下符合的件数）
  const upN = bagList(bagFilter, true, false).length, wearN = bagList(bagFilter, false, true).length;
  bagToggle(rx + 190, ty, 88, th, '▲ 有提升 ' + upN, bagUp, '#2ed573', () => { bagUp = !bagUp; bagPage = 0 });
  bagToggle(rx + 282, ty, 88, th, '✔ 可穿戴 ' + wearN, bagWear, '#ffd84a', () => { bagWear = !bagWear; bagPage = 0 });
  const px = rx + rw - 158;
  bagBtn(px, ty, 34, th, '◀', 'rgba(255,255,255,.08)', bagPage > 0 ? '#fff' : '#555', 14, () => { if (bagPage > 0) bagPage-- });
  txt((bagPage + 1) + ' / ' + maxPages, px + 34 + 40, ty + th / 2, 13, '#b8c2cc', 'center');
  bagBtn(rx + rw - 44, ty, 34, th, '▶', 'rgba(255,255,255,.08)', bagPage < maxPages - 1 ? '#fff' : '#555', 14, () => { if (bagPage < maxPages - 1) bagPage++ });

  // 4×4 格子
  const gx0 = rx + 10, gy0 = ry + 84, gw = 124, gh = 60, gap = 6;
  const pageItems = list.slice(bagPage * BAG_PAGE, (bagPage + 1) * BAG_PAGE);
  if (!list.length) {
    txt('没有符合条件的装备', rx + rw / 2, gy0 + 100, 16, '#8fa0b3', 'center');
    if (bagUp || bagWear) txt('试试关闭上方的「有提升」/「可穿戴」筛选', rx + rw / 2, gy0 + 130, 12, '#5d6b7c', 'center');
  }
  for (let i = 0; i < BAG_PAGE; i++) {
    const cx = gx0 + (i % 4) * (gw + gap), cy = gy0 + ((i / 4) | 0) * (gh + gap), it = pageItems[i];
    if (!it) { bevel(cx, cy, gw, gh, 8); ctx.fillStyle = 'rgba(12,16,32,.5)'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.stroke(); continue }
    const tier = TIERS[it.tier], chk = batchSel.has(it.id);
    techCard(cx, cy, gw, gh, chk ? '#00e5ff' : tier.c, chk);
    if (MOUSE.on && MOUSE.x >= cx && MOUSE.x <= cx + gw && MOUSE.y >= cy && MOUSE.y <= cy + gh) {   // 鼠标悬停：高亮 + 记录，稍后画对比浮窗
      bagHover = it; bevel(cx, cy, gw, gh, 8); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.stroke();
    }
    if (chk) { bevel(cx, cy, gw, gh, 8); ctx.fillStyle = 'rgba(0,229,255,.22)'; ctx.fill() }
    const up = isUpgrade(it), canW = (it.reqLvl || 1) <= S.lv;
    fitTxt(it.name, cx + 8, cy + 18, up ? gw - 34 : gw - 16, 13, tier.c);
    if (up) {                                                // 比身上这件更强：右上角向上箭头（等级不够时变橙色）
      const bob = Math.sin(T * 5) * 1.5;
      ctx.save(); ctx.shadowColor = canW ? '#2ed573' : '#ffa502'; ctx.shadowBlur = 8;
      txt('▲', cx + gw - 14, cy + 16 + bob, 17, canW ? '#2ed573' : '#ffa502', 'center'); ctx.restore();
    }
    const sub = 'Lv.' + (it.reqLvl || 1) + (it.lvl ? ' +' + it.lvl : '') + (it.star ? ' ⭐' + it.star : '');
    fitTxt(sub, cx + 8, cy + 42, gw - 40, 12, (it.reqLvl || 1) > S.lv ? '#ff6b7a' : '#aab6c3');
    if (it.locked) {                                       // 锁定：金色描边 + 🔒（多选模式下不可勾选）
      ctx.save(); bevel(cx, cy, gw, gh, 8); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,216,74,.55)'; ctx.stroke(); ctx.restore();
      txt('🔒', cx + gw - 16, cy + gh - 16, 16, '#ffd84a', 'center', false);
    } else if (!bagMulti) {                                // 右下角部位图标
      slotIco(it.slot, cx + gw - 20, cy + gh - 20, 28, 15);
    } else if (bagMulti) {                                 // 多选模式：右下角大勾选框，点整格即可切换
      const bx = cx + gw - 26, by = cy + gh - 26;
      rpath(bx, by, 20, 20, 5); ctx.fillStyle = chk ? '#00e5ff' : 'rgba(255,255,255,.08)'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = chk ? '#fff' : 'rgba(255,255,255,.4)'; ctx.stroke();
      if (chk) txt('✔', bx + 10, by + 10, 13, '#041018', 'center', false);
    }
    bagHit(cx, cy, gw, gh, () => { if (bagMulti) toggleBatchSel(it.id); else selItem = { item: it, from: 'inv' } });
  }

  // 底部操作栏
  const by = ry + 352;
  rpath(rx + 10, by, rw - 20, 80, 10); ctx.fillStyle = 'rgba(8,12,24,.92)'; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,229,255,.3)'; ctx.stroke();
  if (bagMulti) {
    let g = 0, m = 0; S.inv.forEach(it => { if (batchSel.has(it.id)) { const v = dismantleValue(it); g += v.g; m += v.mat } });
    const n = batchSel.size;
    if (bagNoticeT > 0) txt(bagNotice, rx + 22, by + 17, 13, '#ffd84a');
    else txt(n ? '已选 ' + n + ' 件  ·  分解预估：金币 +' + fmtN(g) + '   碎晶 +' + fmtN(m) : '点击格子勾选装备（可翻页 / 换部件继续勾选）', rx + 22, by + 17, 13, n ? '#7dff9a' : '#8fa0b3');
    const yb = by + 34, a1 = bagArmed('bdis'), a2 = bagArmed('bdrop');
    const sel = S.inv.filter(it => batchSel.has(it.id)), allLocked = sel.length > 0 && sel.every(it => it.locked);
    bagBtn(rx + 16, yb, 80, 38, '清空', '#4b6584', '#fff', 13, () => { batchSel.clear(); bagNotice = '已清空勾选'; bagNoticeT = 1.2 });
    bagBtn(rx + 102, yb, 88, 38, allLocked ? '🔓 解锁' : '🔒 锁定', n ? '#b8860b' : '#3d4452', n ? '#fff' : '#8b95a1', 13, () => { if (n) batchLock() }, n ? '#ffd84a' : null);
    bagBtn(rx + 196, yb, 160, 38, a1 ? '再点一次 确认分解' : '批量分解 (' + n + ')', n ? (a1 ? '#e0563a' : '#a55eea') : '#3d4452', n ? '#fff' : '#8b95a1', 13,
      () => { if (n) bagConfirm('bdis', '再点一次确认：分解 ' + n + ' 件（+' + g + 'G / +' + m + '晶）', batchDismantle) }, n ? '#d6a2e8' : null);
    bagBtn(rx + 362, yb, 156, 38, a2 ? '再点一次 确认丢弃' : '批量丢弃 (' + n + ')', n ? (a2 ? '#ff4757' : '#eb3b5a') : '#3d4452', n ? '#fff' : '#8b95a1', 13,
      () => { if (n) bagConfirm('bdrop', '再点一次确认：丢弃 ' + n + ' 件（无收益）', batchDiscard) }, n ? '#ff7675' : null);
  } else {
    txt('点击装备查看详情 · 强化 / 升星 / 穿戴', rx + 22, by + 20, 13, '#7df9ff');
    txt('要批量分解？先点上方「☐ 多选」再勾选装备', rx + 22, by + 44, 12, '#8fa0b3');
    if (bagNoticeT > 0) txt(bagNotice, rx + 22, by + 66, 12, '#7dff9a');
  }
}

// ---------- 详情视图小部件 ----------
// 状态筛选开关（开启后高亮）
function bagToggle(x, y, w, h, label, on, col, f) {
  bevel(x, y, w, h, 6);
  ctx.fillStyle = on ? col + '33' : 'rgba(20,26,44,.7)'; ctx.fill();
  ctx.lineWidth = on ? 1.6 : 1; ctx.strokeStyle = on ? col : 'rgba(255,255,255,.18)'; ctx.stroke();
  txt(label, x + w / 2, y + h / 2, 12, on ? col : '#b8c2cc', 'center');
  bagHit(x, y, w, h, f);
}

// 矢量五角星：实心 = 已获得，空心 = 未获得
function starShape(cx, cy, r, on) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r;
    i ? ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.save();
  if (on) { ctx.shadowColor = '#ffd84a'; ctx.shadowBlur = 8; ctx.fillStyle = '#ffd84a'; ctx.fill(); ctx.shadowBlur = 0; ctx.lineWidth = 1; ctx.strokeStyle = '#fff3b0'; ctx.stroke() }
  else { ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,216,74,.4)'; ctx.stroke() }
  ctx.restore();
}

// 自适应宽度的资源标签：返回占用宽度，方便从左往右顺排
function chipFit(x, y, h, label, good, sz = 12) {
  const c = curParse(label, true);
  const w = (c ? icoW(c.ic, sz * 1.05) + 3 + bagTw(c.rest, sz) : bagTw(label, sz)) + 18;
  chip(x, y, w, h, label, good, sz);
  return w;
}

// 小徽章（品质 / 部位 / 穿戴中）
function badge(x, y, label, col, bg) {
  const w = bagTw(label, 12) + 18;
  rpath(x, y, w, 22, 6); ctx.fillStyle = bg; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = col; ctx.stroke();
  txt(label, x + w / 2, y + 11, 12, col, 'center', false);
  return w;
}

// 信息面板：切角底 + 左侧强调条 + 顶部淡色渐变标题栏
function dPanel(x, y, w, h, title, sub, col) {
  bevel(x, y, w, h, 10); ctx.fillStyle = 'rgba(10,15,32,.94)'; ctx.fill();
  ctx.save(); ctx.clip();
  const g = ctx.createLinearGradient(x, y, x + w, y); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = .18; ctx.fillStyle = g; ctx.fillRect(x, y, w, 30); ctx.restore();
  ctx.save(); bevel(x, y, w, h, 10); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(0,229,255,.28)'; ctx.stroke(); ctx.restore();
  ctx.fillStyle = col; ctx.fillRect(x, y + 8, 3, 14);
  txt(title, x + 12, y + 15, 13, col, 'left', false);
  if (sub) txt(sub, x + w - 10, y + 15, 11, '#8fa0b3', 'right', false);
}

// 主操作按钮：高光渐变 + 发光描边；不可用时变灰
function actBtn(x, y, w, h, label, col, on, sz, f) {
  bevel(x, y, w, h, 7); ctx.fillStyle = on ? col : '#2a3140'; ctx.fill();
  if (on) {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, 'rgba(255,255,255,.28)'); g.addColorStop(.55, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.2)');
    ctx.fillStyle = g; ctx.fill();
  }
  ctx.save(); if (on) { ctx.shadowColor = col; ctx.shadowBlur = 10 }
  ctx.lineWidth = 1.3; ctx.strokeStyle = on ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.12)'; ctx.stroke(); ctx.restore();
  txt(label, x + w / 2, y + h / 2, sz, on ? '#fff' : '#7d8795', 'center');
  if (f) bagHit(x, y, w, h, f);
}

// ---------- 详情视图：顶栏 / 标题区 / 属性对比 + 强化 + 升星 / 穿戴 + 分解 + 丢弃 ----------
function drawBagDetail(rx, ry, rw) {
  const it = selItem.item, tier = TIERS[it.tier], slotInfo = SLOTS[it.slot];
  const currEq = S.eq[it.slot], isWorn = selItem.from === 'eq';
  const reqLvl = it.reqLvl || 1, canWear = S.lv >= reqLvl, star = it.star | 0;
  const uc = upgradeCost(it), mats = starMats(it).length, sc = starCost(it), dv = dismantleValue(it);
  const canUp = S.g >= uc.g && S.mat >= uc.mat && (S.scr || 0) >= uc.scr;
  const canStar = star < MAX_STAR && mats >= 2 && S.g >= sc;
  const X = rx + 10, IW = rw - 20;

  // —— 顶栏：返回 / 锁定 ——
  bagBtn(X, ry + 8, 104, 34, '← 返回背包', 'rgba(20,26,44,.8)', '#dfe6e9', 13, () => { selItem = null; bagArmKey = '' }, 'rgba(255,255,255,.25)');
  bagBtn(X + IW - 100, ry + 8, 100, 34, it.locked ? '🔒 已锁定' : '🔓 未锁定', it.locked ? 'rgba(255,216,74,.25)' : 'rgba(20,26,44,.8)', it.locked ? '#ffd84a' : '#b8c2cc', 13,
    () => toggleLock(it), it.locked ? '#ffd84a' : 'rgba(255,255,255,.25)');

  // —— 标题区：品质图标底座 + 名称 + 星级 + 徽章 ——
  const ty = ry + 52;
  bevel(X, ty, 60, 60, 9); ctx.fillStyle = 'rgba(8,12,26,.95)'; ctx.fill();
  { const g = ctx.createLinearGradient(X, ty, X + 60, ty + 60); g.addColorStop(0, tier.c); g.addColorStop(1, 'rgba(8,12,26,0)');
    ctx.save(); ctx.globalAlpha = .6; ctx.fillStyle = g; ctx.fill(); ctx.restore(); }
  ctx.save(); ctx.shadowColor = tier.c; ctx.shadowBlur = 12; ctx.lineWidth = 2; ctx.strokeStyle = tier.c; bevel(X, ty, 60, 60, 9); ctx.stroke(); ctx.restore();
  slotIco(it.slot, X + 30, ty + 30, 40, 28);

  let nsz = 20; while (nsz > 12 && bagTw(it.name, nsz) > 250) nsz--;
  txt(it.name, X + 74, ty + 14, nsz, tier.c);
  if (it.lvl) txt('+' + it.lvl, X + 74 + bagTw(it.name, nsz) + 8, ty + 14, 17, '#ffa502');
  for (let i = 0; i < MAX_STAR; i++) starShape(X + IW - 12 - (MAX_STAR - 1 - i) * 22, ty + 14, 9, i < star);

  let bx = X + 74; const by = ty + 38;
  bx += badge(bx, by, tier.n, tier.c, tier.bg) + 6;
  bx += badge(bx, by, slotInfo.n, '#cfd8e3', 'rgba(255,255,255,.08)') + 6;
  if (isWorn) bx += badge(bx, by, '穿戴中', '#2ed573', 'rgba(46,213,115,.16)') + 6;
  bx += chipFit(bx, by, 22, '需求 Lv.' + reqLvl, canWear, 12) + 6;
  if (!isWorn) { const dcp = cpDelta(it); chipFit(bx, by, 22, cpTag(dcp), dcp >= 0, 12); }   // 换上后的战力变化

  // —— 左卡：属性对比 ——
  const cy = ry + 122, lcw = 240, RX = X + lcw + 8, rcw = IW - lcw - 8, CH = 168;
  dPanel(X, cy, lcw, CH, bagAffTab ? '词条' : '属性', '', '#00e5ff');
  { const na = (it.affix || []).length, tx = X + lcw - 10;
    const tab = (x, w, label, on, f) => { rpath(x, cy + 5, w, 20, 5); ctx.fillStyle = on ? 'rgba(0,229,255,.25)' : 'rgba(255,255,255,.05)'; ctx.fill(); ctx.strokeStyle = on ? '#00e5ff' : 'rgba(255,255,255,.2)'; ctx.lineWidth = 1; ctx.stroke(); txt(label, x + w / 2, cy + 15, 11.5, on ? '#fff' : '#8fa0b3', 'center', false); bagHit(x, cy + 5, w, 20, f); };
    tab(tx - 58, 58, '词条 ' + na, bagAffTab, () => { bagAffTab = true });
    tab(tx - 58 - 4 - 46, 46, '属性', !bagAffTab, () => { bagAffTab = false }); }
  // —— 属性页：2 项固定基础属性（吃强化 / 升星） + 3 条副词条（带 ◆ 和底色，数值固定）——
  if (!bagAffTab) {
    const bks = Object.keys(it.baseStats || {}).filter(k => it.baseStats[k] && BASE_ROWS[k]), affs = it.affix || [];
    const n = Math.max(1, bks.length + affs.length), rh = Math.min(28, 126 / n), vs = n >= 5 ? 15 : 17;
    bks.forEach((k, i) => {
      const r = BASE_ROWS[k], yy = cy + 34 + rh * (i + .5), nv = baseShow(it, k), ov = currEq ? baseShow(currEq, k) : 0;
      if (i) { ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(X + 10, cy + 34 + rh * i, lcw - 20, 1) }
      txt(r[0], X + 12, yy, 12.5, r[1], 'left', false);
      txt(baseFmt(k, nv), X + 90, yy, vs, '#fff');
      if (!isWorn && bagDelta(nv - ov, v => baseFmt(k, v), X + lcw - 10, yy) === null) txt('＝', X + lcw - 18, yy, 14, '#778', 'center', false);
    });
    affs.forEach((a, i) => {
      const d = AFFIX_DEFS[a.k]; if (!d) return;
      const j = bks.length + i, top = cy + 34 + rh * j, yy = top + rh / 2, nv = affixNum(it, a.k), ov = affixNum(currEq, a.k);
      if (i === 0) { ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(X + 10, top, lcw - 20, 1) }   // 基础属性与词条的分界线
      rpath(X + 8, top + 2, lcw - 16, rh - 4, 4); ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fill();
      ctx.fillStyle = d.c; ctx.fillRect(X + 8, top + 4, 2.5, rh - 8);                                   // 左侧色条
      txt('◆ ' + d.n, X + 16, yy, 12.5, d.c, 'left', false);
      const vtxt = affixStr(it, a), vw = bagTw(vtxt, 14);
      txt(vtxt, X + 90, yy, 14, d.c);                                                                    // 数值紧贴在文字旁边
      let left = X + lcw - 10;
      if (!isWorn) { const px = bagDelta(nv - ov, v => affixFmt(a.k, v), X + lcw - 10, yy, 11.5, 18); if (px === null) txt('＝', X + lcw - 18, yy, 14, '#778', 'center', false); else left = px; }
      if (a.q >= AFFIX_PERFECT && X + 90 + vw + 6 + 24 < left - 2) txt('完美', X + 90 + vw + 6, yy, 9.5, '#ffd84a', 'left', false);
    });
    if (!bks.length && !affs.length) txt('无属性加成', X + lcw / 2, cy + 90, 13, '#5d6b7c', 'center');
  }

  // —— 词条页：词条列表 + 品质条 + 重铸 ——
  if (bagAffTab) {
    const affs = it.affix || [];
    if (!affs.length) txt('该装备没有词条', X + lcw / 2, cy + 66, 13, '#5d6b7c', 'center');
    affs.forEach((a, i) => {
      const d = AFFIX_DEFS[a.k]; if (!d) return;
      const yy = cy + 34 + i * 29, perfect = a.q >= AFFIX_PERFECT;
      txt('◆ ' + d.n, X + 12, yy + 6, 12.5, d.c, 'left', false);
      if (perfect) txt('完美', X + 12 + bagTw('◆ ' + d.n, 12.5) + 8, yy + 6, 10, '#ffd84a', 'left', false);
      { const lw = 22, lx = X + lcw - 12 - lw;   // 锁定开关：锁定的词条重铸时保持不变
        rpath(lx, yy - 3, lw, 18, 4); ctx.fillStyle = a.lk ? 'rgba(255,216,74,.22)' : 'rgba(255,255,255,.06)'; ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = a.lk ? '#ffd84a' : 'rgba(255,255,255,.22)'; ctx.stroke();
        txt(a.lk ? '🔒' : '🔓', lx + lw / 2, yy + 6, 11, '#fff', 'center', false);
        bagHit(lx, yy - 3, lw, 18, () => toggleAffixLock(it, i));
        txt(affixStr(it, a), lx - 6, yy + 6, 14.5, '#fff', 'right'); }
      rpath(X + 12, yy + 17, lcw - 24, 5, 2.5); ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fill();
      rpath(X + 12, yy + 17, Math.max(5, (lcw - 24) * a.q), 5, 2.5); ctx.fillStyle = perfect ? '#ffd84a' : d.c; ctx.fill();
    });
    const rc = rerollCost(it), rok = S.g >= rc.g && S.mat >= rc.mat, kr = 'rr:' + it.id, ar = bagArmed(kr);
    { const a = '💰 ' + fmtN(rc.g), b = '💎 ' + fmtN(rc.mat), col = rok ? '#cfd8e3' : '#ff8a8a', gap = 18, aw = curW(a, 11, true), bw = curW(b, 11, true), x0 = X + lcw / 2 - (aw + gap + bw) / 2, tf = (s, x, y, z, c, al) => txt(s, x, y, z, c, al, false);
      curT(a, x0, cy + CH - 42, 11, col, 'left', tf, true);
      curT(b, x0 + aw + gap, cy + CH - 42, 11, col, 'left', tf, true); }
    { const nl = affixLockN(it);
    actBtn(X + 10, cy + CH - 33, lcw - 20, 26, ar ? '再点一次 确认重铸' : (nl ? '♻ 重铸词条（锁定 ' + nl + ' 条）' : '♻ 重铸词条'), ar ? '#e0563a' : '#a55eea', rok, 12.5,
      () => bagConfirm(kr, nl ? '再点一次确认重铸（已锁定 ' + nl + ' 条保持不变，其余重新随机）' : '再点一次确认重铸（现有词条将被全部重新随机）', () => rerollAffix(it))); }
  }

  // —— 右上卡：强化（按钮就在卡片里）——
  dPanel(RX, cy, rcw, 80, '🔨 强化  +' + it.lvl + ' → +' + (it.lvl + 1), '', '#ffa502');
  actBtn(RX + rcw - 76, cy + 4, 68, 26, '强化 +1', '#ff9f43', canUp, 12, () => upgradeItem(it));
  txt('每级 +8% 两项基础属性 · 词条不变', RX + 12, cy + 38, 11, '#8fa0b3', 'left', false);
  { let cx = RX + 10; const yy = cy + 50;
    cx += chipFit(cx, yy, 24, '💰 ' + fmtN(uc.g), S.g >= uc.g) + 5;
    cx += chipFit(cx, yy, 24, '💎 ' + fmtN(uc.mat), S.mat >= uc.mat) + 5;
    chipFit(cx, yy, 24, '📜 ' + uc.scr, (S.scr || 0) >= uc.scr); }

  // —— 右下卡：升星 ——
  const sy = cy + 88;
  if (star >= MAX_STAR) {
    dPanel(RX, sy, rcw, 80, '⭐ 升星', '', '#ffd84a');
    txt('已满星  5 / 5', RX + rcw / 2, sy + 52, 16, '#ffd84a', 'center');
  } else {
    dPanel(RX, sy, rcw, 80, '⭐ 升星  ' + star + ' → ' + (star + 1), '', '#ffd84a');
    actBtn(RX + rcw - 76, sy + 4, 68, 26, '升星', '#d4a017', canStar, 12, () => starUpItem(it));
    txt('每星 两项基础属性 +15% · 词条不变', RX + 12, sy + 38, 11, '#8fa0b3', 'left', false);
    let cx = RX + 10; const yy = sy + 50;
    cx += chipFit(cx, yy, 24, '💰 ' + fmtN(sc), S.g >= sc) + 5;
    chipFit(cx, yy, 24, '📦 同名同品质 ' + Math.min(mats, 99) + '/2', mats >= 2, 11);
  }

  // —— 提示条 ——
  if (bagNoticeT > 0) txt(bagNotice, rx + rw / 2, ry + 304, 13, '#7dff9a', 'center');
  else if (!canWear && !isWorn) txt('⚠ 等级不足，Lv.' + reqLvl + ' 才能穿戴', rx + rw / 2, ry + 304, 13, '#ff6b81', 'center');

  // —— 按钮行 1：穿戴 / 卸下（整行）——
  const b1 = ry + 318;
  actBtn(X, b1, IW, 46, isWorn ? '卸下装备' : (canWear ? '穿戴装备' : '等级不足 · 需 Lv.' + reqLvl), isWorn ? '#2e86de' : '#2ed573', canWear || isWorn, 16,
    () => { if (isWorn) unequipItem(selItem.slotKey); else equipItem(it) });

  // —— 按钮行 2：分解 / 丢弃（二次确认防误触）——
  const b2 = b1 + 54, kd = 'dis:' + it.id, kx = 'drop:' + it.id, hw = (IW - 8) / 2;
  const a1 = bagArmed(kd), a2 = bagArmed(kx);
  const lk = !!it.locked, off = isWorn || lk;
  actBtn(X, b2, hw, 40, lk ? '🔒 已锁定 · 无法分解' : isWorn ? '分解（需先卸下）' : (a1 ? '再点一次 确认分解' : '分解  +' + fmtN(dv.g) + 'G  +' + fmtN(dv.mat) + '晶'), a1 ? '#e0563a' : '#a55eea', !off, 13.5,
    () => { if (off) { if (lk) { bagNotice = '🔒 该装备已锁定，请先解锁再分解'; bagNoticeT = 1.8 } else dismantleItem(it) } else bagConfirm(kd, '再点一次「分解」确认（+' + fmtN(dv.g) + 'G / +' + fmtN(dv.mat) + '晶）', () => dismantleItem(it)) });
  actBtn(X + hw + 8, b2, hw, 40, lk ? '🔒 已锁定 · 无法丢弃' : isWorn ? '丢弃（需先卸下）' : (a2 ? '再点一次 确认丢弃' : '丢弃'), a2 ? '#ff4757' : '#eb3b5a', !off, 13.5,
    () => { if (off) { if (lk) { bagNotice = '🔒 该装备已锁定，请先解锁再丢弃'; bagNoticeT = 1.8 } else discardItem(it) } else bagConfirm(kx, '再点一次「丢弃」确认（无收益）', () => discardItem(it)) });
}

// ===== 极速胶囊检索与契约驱动终端 (按 N 键呼出) =====
const CAPL = { cardY: 10, cardH: 108, titleY: 136, btnY: 152, btnH: 36, p1Y: 198, p2Y: 298, pH: 92 };   // 胶囊详情的纵向布局（特效也读它）
const CAPACT = { x: -99, y: -99, w: 0, h: 0 };   // 「装配 / 卸下」按钮命中区，每帧由 drawCapsuleModal0 登记
function drawCapsuleModal0() {
  const pw = 780, ph = 470, px = (960 - pw) / 2, py = 35;
  ctx.save();
  // 1. 全屏柔和暗化遮罩
  ctx.fillStyle = 'rgba(4, 7, 16, 0.88)';
  ctx.fillRect(0, 0, 960, 540);

  // 2. 终端主面板背景与科幻切角边框
  bevel(px, py, pw, ph, 18);
  ctx.fillStyle = 'rgba(10, 14, 28, 0.97)';
  ctx.fill();

  // 底层铺设实验室科技背景图（若存在）
  if (BAGBG.complete && BAGBG.naturalWidth) {
    ctx.save();
    bevel(px, py, pw, ph, 18);
    ctx.clip();
    ctx.drawImage(BAGBG, px, py, pw, ph);
    ctx.fillStyle = 'rgba(4, 8, 18, 0.55)';
    ctx.fillRect(px, py, pw, ph);
    ctx.restore();
  }

  // 主面板发光霓虹青边框
  bevel(px, py, pw, ph, 18);
  ctx.save();
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = 14;
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#00e5ff';
  ctx.stroke();
  ctx.restore();

  // 3. 顶栏标题与关闭按钮
  bevel(px + 4, py + 4, pw - 8, 34, 12);
  ctx.fillStyle = 'rgba(0, 229, 255, 0.13)';
  ctx.fill();
  txt('⚡ 假面骑士变身胶囊 · 契约驱动终端 [N] ⚡', px + 20, py + 21, 14, '#7df9ff', 'left');

  // 紧凑型关闭按钮
  bagBtn(px + pw - 76, py + 9, 66, 24, '✕ 关闭', 'rgba(255, 71, 87, 0.25)', '#ff9aa4', 11.5, () => { showCapModal = false; }, '#ff4757');

  // ==================== 左侧：胶囊检索矩阵 ====================
  const lx = px + 18, ly = py + 48, lw = 360, lh = 405;
  techPanel(lx, ly, lw, lh, 'rgba(0, 229, 255, 0.4)', 12);

  // 快速过滤按钮 (3 个按钮宽度严格与卡片总宽 336px 对齐：108*3 + 6*2 = 336)
  const filters = [
    { id: 'all', n: '全部胶囊' },
    { id: 'owned', n: '已拥有' },
    { id: 'equipped', n: '当前装配' }
  ];
  const fW = 108, fGap = 6, fh = 26;
  filters.forEach((fl, i) => {
    const fx = lx + 12 + i * (fW + fGap), fy = ly + 10;
    const isAct = capFilter === fl.id;
    bagBtn(fx, fy, fW, fh, fl.n,
      isAct ? 'rgba(0, 229, 255, 0.28)' : 'rgba(20, 26, 44, 0.7)',
      isAct ? '#ffd84a' : '#b8c2cc',
      12,
      null,
      isAct ? '#00e5ff' : 'rgba(255, 255, 255, 0.15)'
    );
  });

  // 根据过滤器筛选
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

  // 胶囊卡片列表渲染
  const curPageCaps = filteredCaps.slice(capPage * PAGE_CAP_SIZE, (capPage + 1) * PAGE_CAP_SIZE);
  const rowH = 58, rowGap = 6, rowY0 = ly + 44;

  if (curPageCaps.length === 0) {
    txt('暂无匹配的胶囊数据', lx + lw / 2, ly + lh / 2 - 12, 13, '#8fa0b3', 'center');
    txt('（可在基地扭蛋终端抽取新契约）', lx + lw / 2, ly + lh / 2 + 12, 11, '#5d6b7c', 'center');
  } else {
    curPageCaps.forEach((c, i) => {
      const rowY = rowY0 + i * (rowH + rowGap);
      const isSel = curSelCapId === c.id;
      const isEq = S.eqCap === c.id;
      const isOwned = S.caps.includes(c.id);
      const cardX = lx + 12, cardW = lw - 24;

      // 1. 卡片底座切角
      bevel(cardX, rowY, cardW, rowH, 8);
      ctx.fillStyle = isSel ? 'rgba(0, 229, 255, 0.16)' : 'rgba(8, 14, 28, 0.92)';
      ctx.fill();

      // 2. 品质色渐变辉光背景
      const cardCol = isOwned ? c.c : 'rgba(100, 110, 130, 0.6)';
      const g = ctx.createLinearGradient(cardX, rowY, cardX + cardW, rowY);
      g.addColorStop(0, cardCol);
      g.addColorStop(1, 'rgba(5, 10, 20, 0)');
      ctx.save();
      ctx.globalAlpha = isSel ? 0.35 : 0.18;
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();

      // 3. 边框发光
      ctx.save();
      const borderCol = isSel ? '#00e5ff' : (isEq ? '#2ed573' : (isOwned ? c.c : 'rgba(255, 255, 255, 0.12)'));
      ctx.shadowColor = borderCol;
      ctx.shadowBlur = isSel ? 14 : (isEq ? 10 : 5);
      ctx.lineWidth = isSel ? 2.2 : 1.3;
      ctx.strokeStyle = borderCol;
      ctx.stroke();
      ctx.restore();

      // 4. 左侧品质竖直能量条
      ctx.fillStyle = isOwned ? c.c : '#3a4454';
      ctx.fillRect(cardX, rowY + 9, 4, rowH - 18);

      // 5. 核心微缩图标徽记
      const iconX = cardX + 12, iconY = rowY + 9, iconSize = 40;
      bevel(iconX, iconY, iconSize, iconSize, 6);
      ctx.fillStyle = isOwned ? `${c.c}26` : 'rgba(20, 26, 40, 0.85)';
      ctx.fill();
      ctx.strokeStyle = isOwned ? c.c : '#556';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      const sym = c.id === 'ryuki' ? '龍' : (c.id === '555' ? 'Φ' : (c.id === 'blade' ? '♠' : c.rider[0]));
      if (EQI.ryuki_cap) {
        ctx.save(); if (!isOwned) ctx.globalAlpha = .38;
        fitIco(EQI.ryuki_cap, iconX + iconSize / 2, iconY + iconSize / 2 - 1, 32); ctx.restore();
        txt(sym, iconX + iconSize - 7, iconY + iconSize - 8, 10, isOwned ? '#ffffff' : '#6f7a8c', 'center');
      } else txt(sym, iconX + iconSize / 2, iconY + iconSize / 2, 18, isOwned ? '#ffffff' : '#6f7a8c', 'center');
      const stN = isOwned ? capStar(c.id) : 0;
      if (stN > 0) txt('★' + stN, cardX + 60 + bagTw(c.name, 13) + 8, rowY + 18, 11.5, '#ffd84a');

      // 6. 胶囊名称与类别标签
      const nameX = cardX + 60;
      txt(c.name, nameX, rowY + 18, 13, isOwned ? (isSel ? '#ffd84a' : '#ffffff') : '#7d8795');
      txt(c.tag + ' · ' + c.rider, nameX, rowY + 39, 10.5, isOwned ? '#8fa0b3' : '#556170');

      // 7. 右侧状态徽章
      const tagW = 76, tagH = 24, tagX = cardX + cardW - tagW - 8, tagY = rowY + (rowH - tagH) / 2;
      bevel(tagX, tagY, tagW, tagH, 5);
      if (isEq) {
        ctx.fillStyle = 'rgba(46, 213, 115, 0.22)'; ctx.fill();
        ctx.strokeStyle = '#2ed573'; ctx.lineWidth = 1.2; ctx.stroke();
        txt('★ 装配中', tagX + tagW / 2, tagY + tagH / 2, 11, '#2ed573', 'center');
      } else if (isOwned) {
        ctx.fillStyle = 'rgba(255, 216, 74, 0.18)'; ctx.fill();
        ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 1.2; ctx.stroke();
        txt('✔ 可装配', tagX + tagW / 2, tagY + tagH / 2, 11, '#ffd84a', 'center');
      } else {
        ctx.fillStyle = 'rgba(30, 36, 50, 0.65)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'; ctx.lineWidth = 1; ctx.stroke();
        txt('🔒 未解锁', tagX + tagW / 2, tagY + tagH / 2, 11, '#6f7a8c', 'center');
      }
    });
  }

  // 翻页底栏
  const btmY = ly + lh - 34;
  bevel(lx + 12, btmY, 32, 22, 5);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'; ctx.lineWidth = 1; ctx.stroke();
  txt('◀', lx + 28, btmY + 11, 12, capPage > 0 ? '#fff' : '#444', 'center');

  txt(`第 ${capPage + 1} / ${maxCapPages} 页 (共 ${filteredCaps.length} 件)`, lx + lw / 2, btmY + 11, 11.5, '#8fa0b3', 'center');

  bevel(lx + lw - 12 - 32, btmY, 32, 22, 5);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'; ctx.lineWidth = 1; ctx.stroke();
  txt('▶', lx + lw - 12 - 16, btmY + 11, 12, capPage < maxCapPages - 1 ? '#fff' : '#444', 'center');

  // ==================== 右侧：选定胶囊详细数据与装配控制 ====================
  const rx = px + 392, ry = py + 48, rw = 370, rh = 405;
  techPanel(rx, ry, rw, rh, 'rgba(0, 229, 255, 0.4)', 12);

  const selCap = CAPSULES.find(c => c.id === curSelCapId) || CAPSULES[0];
  const isCapOwned = selCap ? S.caps.includes(selCap.id) : false;
  const isCapEquipped = selCap ? S.eqCap === selCap.id : false;

  if (selCap) {
    // 右侧详情：卡面 → 名称/星级 → 操作按钮 → 两张信息卡；所有行距 ≥ 18px，标签与内容分列，不再挤在一起
    const L = CAPL, cx = rx + 14, cw = rw - 28;
    const csN = isCapOwned ? capStar(selCap.id) : 0, MAXS = CAP_STAR_MAX;

    // 1. 卡面
    bevel(cx, ry + L.cardY, cw, L.cardH, 9); ctx.fillStyle = 'rgba(8,12,26,.95)'; ctx.fill();
    const cg = ctx.createLinearGradient(cx, ry + L.cardY, cx, ry + L.cardY + L.cardH);
    cg.addColorStop(0, selCap.c + '38'); cg.addColorStop(1, 'rgba(5,10,20,0)'); ctx.fillStyle = cg; ctx.fill();
    if (CAP_IMGS[selCap.id]) {
      ctx.save(); bevel(cx + 2, ry + L.cardY + 2, cw - 4, L.cardH - 4, 7); ctx.clip();
      drawArt(CAP_IMGS[selCap.id], cx + 2, ry + L.cardY + 2, cw - 4, L.cardH - 4);
      if (!isCapOwned) { ctx.fillStyle = 'rgba(4,8,18,.55)'; ctx.fillRect(cx, ry + L.cardY, cw, L.cardH) }   // 未拥有：压暗
      ctx.restore();
    } else {
      const midX = cx + cw / 2, midY = ry + L.cardY + L.cardH / 2;
      ctx.save(); ctx.beginPath(); ctx.arc(midX, midY, 34, 0, 7);
      ctx.fillStyle = isCapOwned ? selCap.c + '28' : 'rgba(30,36,50,.5)'; ctx.fill(); ctx.strokeStyle = isCapOwned ? selCap.c : '#666'; ctx.lineWidth = 2; ctx.stroke();
      txt(selCap.rider, midX, midY - 6, 14, isCapOwned ? '#fff' : '#777', 'center');
      txt(selCap.tag, midX, midY + 12, 11, isCapOwned ? selCap.c : '#555', 'center'); ctx.restore();
    }
    ctx.save(); bevel(cx, ry + L.cardY, cw, L.cardH, 9);
    ctx.shadowColor = isCapEquipped ? '#2ed573' : selCap.c; ctx.shadowBlur = 10; ctx.lineWidth = 1.8;
    ctx.strokeStyle = isCapEquipped ? '#2ed573' : (isCapOwned ? selCap.c : 'rgba(255,255,255,.15)'); ctx.stroke(); ctx.restore();
    badge(cx + 8, ry + L.cardY + 8, TIERS[selCap.tier].n + '契约级', TIERS[selCap.tier].c, TIERS[selCap.tier].bg);
    const tagW0 = bagTw(selCap.tag, 11) + 16;
    badge(cx + cw - 8 - tagW0, ry + L.cardY + 8, selCap.tag, '#7df9ff', 'rgba(0,229,255,.18)');

    // 2. 名称 + 骑士标签 + 星级
    const ty = ry + L.titleY, nw = bagTw(selCap.name, 17);
    txt(selCap.name, cx + 2, ty, 17, isCapOwned ? selCap.c : '#8c96a6');
    const rw2 = bagTw(selCap.rider, 10.5) + 14, rxx = cx + 2 + nw + 10;
    rpath(rxx, ty - 10, rw2, 20, 6); ctx.fillStyle = 'rgba(255,216,74,.12)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,216,74,.7)'; ctx.lineWidth = 1; ctx.stroke();
    txt(selCap.rider, rxx + rw2 / 2, ty, 10.5, '#ffd84a', 'center', false);
    for (let s = 0; s < MAXS; s++) starShape((cx + cw - 8) - (MAXS - 1 - s) * 17, ty, 6.5, s < csN);

    // 3. 操作按钮：装配 / 卸下 + 升星（升星按钮内含碎片数量）
    const by = ry + L.btnY, bh = L.btnH;
    if (!isCapOwned) {
      actBtn(cx, by, cw, bh, '🔒 尚未拥有（可前往扭蛋终端抽取）', '#2a3140', false, 12);
      Object.assign(CAPACT, { x: cx, y: by, w: cw, h: bh }); Object.assign(CAPUP, { x: -99, y: -99, w: 0, h: 0 });
    } else {
      const uw0 = 116, ew = cw - uw0 - 8, ux = cx + cw - uw0;
      if (isCapEquipped) actBtn(cx, by, ew, bh, '✔ 当前已装配 [点击卸下]', '#2e86de', true, 13);
      else actBtn(cx, by, ew, bh, '⚡ 立即装配该变身胶囊', '#2ed573', true, 13.5);
      Object.assign(CAPACT, { x: cx, y: by, w: ew, h: bh });
      const need = capStarCost(selCap.id), maxed = need === 0, have = capShards(), can = !maxed && have >= need;
      actBtn(ux, by, uw0, bh, '', '#a55eea', can, 12);
      if (maxed) txt('★ 已满星', ux + uw0 / 2, by + bh / 2, 12.5, '#ffd84a', 'center', false);
      else {
        txt('⭐ 升星', ux + uw0 / 2, by + 12, 12.5, can ? '#fff' : '#9aa6b8', 'center', false);
        txt('碎片 ' + have + ' / ' + need, ux + uw0 / 2, by + 27, 10, can ? '#f1e6ff' : '#b08cff', 'center', false);
      }
      Object.assign(CAPUP, { x: ux, y: by, w: uw0, h: bh });
    }

    // 4. 信息卡（标签 + 内容 两列）
    const lab = (y, l, v, col) => { ut(l, cx + 14, y, 10.5, '#7f8da3', 'left', { w: 600, sh: 0 }); qFit(v, cx + 76, y, cw - 76 - 14, 11.5, col, 600); };
    let buffS = selCap.buff;
    if (isCapOwned && typeof capAtkMul === 'function' && typeof capCrAdd === 'function') {   // 含升星加成的实际数值
      const f1 = n => String(Math.round(n * 10) / 10), sp = ((selCap.spdMul || 1) - 1) * 100;
      buffS = '攻击力 +' + f1((capAtkMul(selCap) - 1) * 100) + '%，暴击率 +' + f1(capCrAdd(selCap) * 100) + '%' + (sp > .5 ? '，移速 +' + f1(sp) + '%' : '');
    }
    const p1 = ry + L.p1Y;
    dPanel(cx, p1, cw, L.pH, '契约战力加成', csN ? '★' + csN + ' 加成已生效' : 'FORM BUFF', '#00e5ff');
    lab(p1 + 44, '属性提升', buffS, csN ? '#9dff9d' : '#ffd84a');
    lab(p1 + 62, '核心特性', selCap.trait || '专属形态动作模组与独立变身音效', '#e6ebf5');
    if (CAPUP.msg && T < CAPUP.until) lab(p1 + 80, '提示', CAPUP.msg, '#ffd84a');
    else lab(p1 + 80, '升星成长', csN && typeof capStarBonusText === 'function' ? capStarBonusText(selCap.id) : '每星 攻击 +4%，暴击 +1.5%；3★ / 5★ 缩减冷却', '#c79bff');

    const p2 = ry + L.p2Y;
    dPanel(cx, p2, cw, L.pH, '形态技能与战术', 'SKILLS & TACTIC', '#ffa502');
    lab(p2 + 44, '战术技能', selCap.skill, '#7df9ff');
    lab(p2 + 62, '终结必杀', selCap.finisher, '#ff8f8f');
    lab(p2 + 80, '操作提示', '战斗中按「变身」键变身 / 解除', '#7dff9a');
  }

  ctx.restore();
}

// ===== 抽卡与常规功能菜单（铁匠铺与天赋解除10级上限，强化百分比更新） =====
const V = { pg: 'main', i: 0, m: '', mt: 0 };
const go = p => { V.pg = p; V.i = 0 }, say = s => { V.m = s; V.mt = 1.8 };
function toVil(p) {
  // ★ 联机中离开战斗 = 退出联机房间（同时通知队友）
  if (typeof COOP !== 'undefined' && COOP.active && COOP.inGame) coopLeaveRoom();
  P.down = false;
  G = 'vil'; M = 0; cam = 0;
  clearForms(); // ★ 核心修复：回到秘密基地一律解除变身
  calc();
  P.hp = P.mh;
  P.mp = P.mm;
  P.sta = P.stm;
  Object.assign(P, { x: p ? 1800 : 250, y: GY, vx: 0, vy: 0, f: 1, st: 'idle', inv: 0, land: 0, t: 0 });
  if (p === 'st') openPortal(true);
}

function buy(o) {
  if (o.max) return say('已达上限/已拥有'); if (S.g < (o.g || 0)) return say('金币不足'); if (S.tp < (o.t || 0)) return say('天赋点不足');
  S.g -= o.g || 0; S.tp -= o.t || 0; o.f(); calc(); save(); say('强化成功！');
}

// ===== 扭蛋：奖池 / 概率 / 抽取 =====
// 每次抽取独立随机：各胶囊按下表概率，其余为体力药水与「谢谢惠顾」。重复抽中已拥有的胶囊——什么也不会返还。
// 新增胶囊时只要在 CAPSULES 里加一项；没写概率的默认 10%，总和超过 100% 会自动等比缩小。
const GACHA_COST = 160,   // 单抽钻石价（十连 = ×10 = 1600）
   GACHA_RATE = { ryuki: 20, '555': 20, blade: 20 }, GACHA_POTION = 25;
let gachaQ = [];      // 十连结算后，等待依次展示的新胶囊卡面

function gachaTable() {
  const t = CAPSULES.map(c => ({ kind: 'cap', c, p: GACHA_RATE[c.id] !== undefined ? GACHA_RATE[c.id] : 10 }));
  t.push({ kind: 'potion', p: GACHA_POTION });
  const sum = t.reduce((a, b) => a + b.p, 0);
  if (sum > 100) t.forEach(r => r.p *= 100 / sum);
  t.push({ kind: 'none', p: Math.max(0, 100 - Math.min(100, sum)) });
  return t;
}

function gachaPull(n) {
  const cost = GACHA_COST * n;
  if (S.d < cost) return say('钻石不足');
  S.d -= cost;
  const tb = gachaTable(), res = [], fresh = [];
  for (let i = 0; i < n; i++) {
    let r = Math.random() * 100, hit = tb[tb.length - 1];
    for (const e of tb) { if (r < e.p) { hit = e; break } r -= e.p }
    if (hit.kind === 'cap') {
      if (S.caps.includes(hit.c.id)) { S.csh = (S.csh | 0) + CAP_DUP_SHARD; res.push({ k: 'dup', c: hit.c, sh: CAP_DUP_SHARD }); }   // 重复胶囊 → 契约碎片（用于升星）
      else { S.caps.push(hit.c.id); if (!S.eqCap) S.eqCap = hit.c.id; res.push({ k: 'new', c: hit.c }); fresh.push(hit.c.id) }
    } else if (hit.kind === 'potion') {
      if (S.hp < 9) { S.hp++; res.push({ k: 'potion' }) } else res.push({ k: 'potion', full: 1 });
    } else res.push({ k: 'none' });
  }
  save();
  MN.last = res;
  gachaQ = fresh.map(id => ({ type: id, isNew: true }));
  // 动画播完后展示：十连 / 单抽未出新胶囊 → 结算总览；单抽出新胶囊 → 直接卡面（动画见 menu.js 的 drawGachaAnim）
  const nxt = (n > 1 || !gachaQ.length) ? { type: 'sum', res } : gachaQ.shift();
  gachaAnimStart(res, nxt);
}

function openCapsuleGachaSettlement(id, isNew = true) {
  gachaModal = { type: id, isNew };
}
function openRyukiGachaSettlement(isNew = true) { openCapsuleGachaSettlement('ryuki', isNew) }   // 兼容旧调用

// 铁匠铺研磨价格：全面平衡通关关卡奖励（降幅约 60%~75%，1 关收益 ≈ 1~2 次升级）
// Lv.0=30G, Lv.4=180G, Lv.6=270G(原900G), Lv.10=480G, Lv.20=1200G, Lv.30=2200G
const forgeCost = lv => Math.round(30 * (lv + 1) * (1 + lv / 22) / 5) * 5;  

// 条目字段：n=名称（两个以上空格后为标签）  ic=图标  d=说明  g/t=金币/天赋点花费  max=已满
//           bt=按钮动词  hold=[当前,上限]（显示持有条）  st=1（详情里预览升级后的属性变化）  nv=1（非购买动作）
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
    { n: '体力药水   持有 ' + S.hp, ic: '🧪', d: '战斗中按 1：回复 50% 生命（上限9）', g: 40, max: S.hp >= 9, bt: '购买', hold: [S.hp, 9], f: () => S.hp++ },
    { n: '魔力药水   持有 ' + S.mp, ic: '💧', d: '战斗中按 2：回复 60% 魔力（上限9）', g: 40, max: S.mp >= 9, bt: '购买', hold: [S.mp, 9], f: () => S.mp++ },
    { n: '强化卷轴   持有 ' + (S.scr || 0), ic: '📜', d: '装备强化核心必需耗材（怪物掉落或药铺购买，无上限）', g: 300, max: false, bt: '购买', f: () => { S.scr = (S.scr || 0) + 1; } },
    bk
  ];

  // 扭蛋：只有 单抽 / 十连 / 奖池说明（？）——抽取逻辑见 gachaPull，界面见 menu.js
  if (p === 'gacha') return [
    { n: '单抽', nv: 1, f: () => gachaPull(1) },
    { n: '十连抽', nv: 1, f: () => gachaPull(10) },
    { n: '奖池概率', nv: 1, f: () => { MN.rates = true } },
    bk
  ];

  // 铁匠铺：胶囊已剥离，无上限等级，攻击+2%/生命+5%/伤害-0.05%/魔力+3%
  // 铁匠铺条目描述对齐 5%
  if (p === 'eq') {
    const q = (k, n, d, ic) => ({ n: n + '  Lv.' + S[k], ic, d, g: forgeCost(S[k]), max: false, bt: '研磨', st: 1, f: () => S[k]++ });
    return [
      q('sw', '基础斩刃研磨', '基础攻击力 +5% / 级（无上限）', '⚔'),
      q('ar', '基础装甲强化', '基础生命 +5%、受到伤害 -0.05% / 级（无上限）', '🛡'),
      q('bt', '驱动引擎调试', '基础魔力 +3% / 级（无上限）', '⚙'),
      bk
    ];
  }

  // 天赋：解除 10 级上限，允许无上限加点
  if (p === 'tal') return [...TL.map((t, k) => ({ n: t[0] + '  Lv.' + S.ta[k], ic: ['💥', '❤', '🔷', '🎯'][k] || '◆', d: t[1] + ' / 级（无上限加点）', t: 1, max: false, bt: '加点', st: 1, f: () => S.ta[k]++ })), bk];
  return [bk];
}

// 药铺 / 铁匠铺 / 训练馆 / 扭蛋机 的界面与扭蛋结算见 menu.js（drawV / drawGachaModalOverlay）

// ===== 屏幕专属技能栏 HUD（支持图标、CD 遮罩与冷却数字） =====
function drawSkillBarHUD() {
  if (G !== 'play' || (typeof TOUCH !== 'undefined' && TOUCH)) return;   // 手机端：冷却直接显示在右下角按键上
  const curRk = curRiderKey();
  const skills = [
    { key: 'atk', label: 'J', name: '普攻', mp: 0, cd: 0, mcd: 0 },
    { key: 'l',   label: 'L', name: lSkillName(), mp: 20, cd: P.cd.l || 0, mcd: P.maxCd.l || 1 },
    { key: 'e',   label: 'E', name: '战车', mp: 70, cd: P.cd.e || 0, mcd: P.maxCd.e || 1 },
    { key: 'k',   label: 'K', name: '终结技', mp: 120, cd: P.cd.k || 0, mcd: P.maxCd.k || 1 },
    { key: 'p',   label: 'P', name: inForm() ? '解除' : '变身', mp: 0, cd: P.cd.p || 0, mcd: P.maxCd.p || 1 }
  ];

  const sz = 44, gap = 10, totalW = skills.length * sz + (skills.length - 1) * gap;
  const sx = (960 - totalW) / 2, sy = 468;

  skills.forEach((sk, i) => {
    const x = sx + i * (sz + gap), y = sy;
    const ready = sk.cd <= 0, hasMp = P.mp >= sk.mp;
    const canUse = ready && hasMp;
    const iconImg = SKILL_IMGS[sk.key];

    ctx.save();
    // 槽位底框
    cutPath(x, y, sz, sz, 9);
    ctx.fillStyle = 'rgba(12, 16, 28, 0.9)';
    ctx.fill();

    // 绘制图标贴图或默认发光符记
    if (iconImg) {
      ctx.save();
      cutPath(x + 2, y + 2, sz - 4, sz - 4, 7);
      ctx.clip();
      if (!canUse) ctx.filter = 'grayscale(0.8) brightness(0.6)';
      ctx.drawImage(iconImg, x + 2, y + 2, sz - 4, sz - 4);
      ctx.restore();
    } else {
      const fallbackSym = { atk: '⚔', l: P.k5 ? '🔫' : P.bl ? '⚡' : '🗡', e: '🏍', k: '💥', p: '✦' }[sk.key];
      txt(fallbackSym, x + sz / 2, y + sz / 2 - 2, 18, canUse ? '#fff' : '#678', 'center');
    }

    // 边框描边
    cutPath(x, y, sz, sz, 9);
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = canUse ? (sk.key === 'k' ? '#f0d68a' : 'rgba(217,189,125,0.8)') : 'rgba(255,255,255,0.14)';
    ctx.shadowColor = (canUse && sk.key === 'k') ? '#d9bd7d' : 'transparent'; ctx.shadowBlur = 8;
    ctx.stroke();

    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    // 冷却扇形遮罩与剩余时间
    if (sk.cd > 0) {
      const frac = cl(sk.cd / sk.mcd, 0, 1);
      ctx.save();
      cutPath(x, y, sz, sz, 9);
      ctx.clip();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.68)';
      ctx.beginPath();
      ctx.moveTo(x + sz / 2, y + sz / 2);
      ctx.arc(x + sz / 2, y + sz / 2, sz, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac, false);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 倒计时数字
      ut(sk.cd >= 10 ? sk.cd.toFixed(0) : sk.cd.toFixed(1), x + sz / 2, y + sz / 2, 13, '#f3e3b0', 'center', { w: 700 });
    }

    // 缺蓝提示斜条纹
    if (!hasMp && ready) {
      ctx.save();
      cutPath(x, y, sz, sz, 9);
      ctx.clip();
      ctx.fillStyle = 'rgba(20, 80, 220, 0.45)';
      ctx.fill();
      ctx.restore();
      txt('MP', x + sz / 2, y + sz / 2, 11, '#6ab0ff', 'center');
    }

    // 左上角按键标记 (J, L, E, K, P)
    rpath(x - 3, y - 4, 16, 14, 4);
    ctx.fillStyle = '#080c16'; ctx.fill();
    ctx.strokeStyle = 'rgba(217,189,125,.8)'; ctx.lineWidth = 1; ctx.stroke();
    ut(sk.label, x + 5, y + 3, 9, '#f3e3b0', 'center', { w: 700, sh: 0 });

    // 右下角消耗 MP 标牌
    if (sk.mp > 0) {
      txt(sk.mp, x + sz - 3, y + sz - 5, 9, hasMp ? '#70a1ff' : '#ff4757', 'right');
    }

    ctx.restore();
  });
}

// ===== 升级专属全屏横幅与定格动画（透明 PNG 纯净直出） =====
function drawLevelUpBanner() {
  if (!LV_POP) return;
  const p = Math.min(1, LV_POP.t / LV_POP.dur);
  const t = LV_POP.t;

  ctx.save();
  // 1. 全屏柔和暗化遮罩（突出居中金光横幅）
  const alpha = p < 0.15 ? (p / 0.15) * 0.65 : p > 0.85 ? ((1 - p) / 0.15) * 0.65 : 0.65;
  ctx.fillStyle = `rgba(3, 6, 16, ${alpha.toFixed(3)})`;
  ctx.fillRect(0, 0, 960, 540);

  // 2. 居中弹性弹出（0.2秒内从小冲出，随后微浮）
  let sc = 1.0;
  if (t < 0.2) {
    const k = t / 0.2;
    sc = 0.35 + 0.7 * Math.sin(k * Math.PI * 0.5);
  } else if (p > 0.85) {
    sc = 1.0 + (p - 0.85) * 0.25;
  }

  const cx = 480, cy = 195;
  ctx.translate(cx, cy);
  ctx.scale(sc, sc);

  // 3. 背后放射状金色科技神芒
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 8; i++) {
    const an = (i * Math.PI / 4) + t * 0.45;
    ctx.strokeStyle = 'rgba(255, 216, 74, 0.18)';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(an) * 440, Math.sin(an) * 200);
    ctx.stroke();
  }
  ctx.restore();

  // 4. 绘制透明 PNG 横幅
  const bw = 560;
  const bh = LV_IMG ? Math.round(bw * LV_IMG.height / LV_IMG.width) : 168;
  if (LV_IMG) {
    ctx.save();
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 26;
    ctx.drawImage(LV_IMG, -bw / 2, -bh / 2, bw, bh);
    ctx.restore();
  } else {
    txt('LEVEL UP!', 0, -10, 48, '#ffd84a', 'center');
  }

  // 5. 横幅下方展示当前新等级与天赋点
  const textAlpha = p < 0.15 ? p / 0.15 : p > 0.85 ? (1 - p) / 0.15 : 1;
  ctx.globalAlpha = textAlpha;

  // 等级高亮徽章
  const lvStr = 'Lv.' + LV_POP.lv;
  ctx.font = '700 22px system-ui, -apple-system, sans-serif';
  const textW = ctx.measureText(lvStr).width;
  const badgeW = textW + 46, badgeH = 34, by = bh / 2 + 10;

  rpath(-badgeW / 2, by, badgeW, badgeH, 17);
  ctx.fillStyle = 'rgba(10, 16, 32, 0.95)';
  ctx.fill();
  ctx.strokeStyle = '#ffd84a';
  ctx.lineWidth = 2;
  ctx.stroke();

  txt(lvStr, 0, by + badgeH / 2, 20, '#ffd84a', 'center');
  txt('★ 全属性提升 · 获得 +' + LV_POP.dLv + ' 天赋点 ★', 0, by + badgeH + 22, 14, '#7dff9a', 'center');

  ctx.restore();
}

// ===== 高级通关胜利结算 UI（精准间距与水平对齐） =====
let WIN_HITS = [];

function drawWinSettlement() {
  if (!WIN_RES) return;
  WIN_HITS = [];
  const W = WIN_RES;
  const t = W.t;
  const p = Math.min(1, t / 0.8);

  ctx.save();
  // 1. 背景暗化
  ctx.fillStyle = 'rgba(4, 6, 14, 0.88)';
  ctx.fillRect(0, 0, 960, 540);

  // 2. 主面板弹性入场
  const sc = t < 0.25 ? 0.8 + 0.2 * Math.sin((t / 0.25) * Math.PI * 0.5) : 1;
  const pw = 680, ph = 430, px = (960 - pw) / 2, py = 55;

  ctx.translate(px + pw / 2, py + ph / 2);
  ctx.scale(sc, sc);
  ctx.translate(-(px + pw / 2), -(py + ph / 2));

  rpath(px, py, pw, ph, 18);
  const bgGrad = ctx.createLinearGradient(px, py, px, py + ph);
  bgGrad.addColorStop(0, '#10172e');
  bgGrad.addColorStop(1, '#070a14');
  ctx.fillStyle = bgGrad; ctx.fill();
  ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 2; ctx.stroke();

  // 顶部渐变装饰
  const hg = ctx.createLinearGradient(px + 40, py, px + pw - 40, py);
  hg.addColorStop(0, 'rgba(255, 216, 74, 0)');
  hg.addColorStop(0.5, 'rgba(255, 216, 74, 0.25)');
  hg.addColorStop(1, 'rgba(255, 216, 74, 0)');
  ctx.fillStyle = hg; ctx.fillRect(px + 40, py + 2, pw - 80, 50);

  // 3. 标题与下移后的关卡名（解决贴合过紧问题）
  txt(W.tower ? 'VICTORY · 第 ' + W.tower + ' 层通关' : 'VICTORY · 关卡完成', px + pw / 2, py + 30, 25, '#ffd84a', 'center');
  txt(W.stageName, px + pw / 2, py + 66, 14, '#a2b4cb', 'center'); // ★ 下移至 py+66

  // 4. 星级与 Rank 徽章（无尽塔专属清爽结算，无星星与 S/A/B 评级）
  const starY = py + 108;
  if (W.tower) {
    // ★ 无尽塔：展示大号层数突破横幅与 CLEAR 通关勋章
    const isRec = W.isFirst;
    const tagTxt = isRec ? '★ 突破新纪录 · 第 ' + W.tower + ' 层 ★' : '🗼 第 ' + W.tower + ' 层 挑战通关';
    txt(tagTxt, px + pw / 2, starY - 6, 21, isRec ? '#ffd84a' : '#7df9ff', 'center');
    const subTxt = isRec ? '历史最高层数已成功刷新至第 ' + W.tower + ' 层！' : '历史最高纪录：第 ' + (W.best || W.tower) + ' 层';
    txt(subTxt, px + pw / 2, starY + 18, 12, '#a2b4cb', 'center');

    // 右侧勋章：显示 CLEAR
    const rankX = px + pw - 78, rankY = starY;
    ctx.save();
    ctx.beginPath(); ctx.arc(rankX, rankY, 26, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(165, 94, 234, 0.15)'; ctx.fill();
    ctx.strokeStyle = '#a55eea'; ctx.lineWidth = 2; ctx.stroke();
    txt('CLEAR', rankX, rankY - 1, 13.5, '#c79bff', 'center');
    txt('TOWER', rankX, rankY + 36, 10, '#8fa0b3', 'center');
    ctx.restore();
  } else {
    // 常规关卡：原有的三颗星与 Rank 勋章
    for (let i = 0; i < 3; i++) {
      const sx = px + pw / 2 + (i - 1) * 64;
      const isLit = i < W.stars;
      const starDelay = 0.2 + i * 0.15;
      const starProgress = cl((t - starDelay) / 0.2, 0, 1);

      ctx.save();
      ctx.translate(sx, starY);
      if (isLit && starProgress > 0) {
        const pop = 1 + 0.35 * Math.sin(starProgress * Math.PI);
        ctx.scale(pop, pop);
        ctx.shadowColor = '#ffd84a'; ctx.shadowBlur = 14;
        txt('⭐', 0, 0, 36, '#ffd84a', 'center', false);
      } else {
        ctx.globalAlpha = 0.25;
        txt('☆', 0, 0, 34, '#8fa0b3', 'center', false);
      }
      ctx.restore();
    }

    const rankX = px + pw - 78, rankY = starY;
    ctx.save();
    ctx.beginPath(); ctx.arc(rankX, rankY, 26, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 216, 74, 0.12)'; ctx.fill();
    ctx.strokeStyle = W.rank === 'S' ? '#ffd84a' : '#7df9ff'; ctx.lineWidth = 2; ctx.stroke();
    txt(W.rank, rankX, rankY - 1, 26, W.rank === 'S' ? '#ffd84a' : '#7df9ff', 'center');
    txt('RANK', rankX, rankY + 36, 10, '#8fa0b3', 'center');
    ctx.restore();
  }

  // 5. 达成条件列表（适度紧凑）
  const condY0 = py + 142;
  W.conds.forEach((c, idx) => {
    const cy = condY0 + idx * 18;
    const pass = c.pass;
    txt(pass ? '✔ ' + c.text : '✘ ' + c.text, px + pw / 2, cy, 11.5, pass ? '#7dff9a' : '#6f7f95', 'center');
  });

  // 6. 奖励卡片网格（★ 大幅收紧与上方的间距，从 py+224 提前至 py+204）
  let cardW = 180; const cardH = 70, cardGap = 14;
  const cards = [
    { title: '金币收益', val: '+' + Math.round(W.gold * p).toLocaleString(), icon: ICO.g, col: '#ffd84a' },
    { 
      title: W.isFirst ? '首通钻石' : '星级突破', 
      val: W.diam > 0 ? '+' + W.diam : '已领取', 
      icon: ICO.d, 
      col: W.diam > 0 ? '#4fe3ff' : '#8fa0b3', 
      badge: W.isFirst ? 'FIRST CLEAR' : (W.diam > 0 ? 'STAR REWARD' : null) 
    },
    { title: '获得经验', val: '+' + W.expGain + ' EXP', sym: '⚡', col: '#7dff9a' }
  ];

  if (W.shards > 0) cards.push({ title: '契约碎片', val: '+' + W.shards, sym: '◆', col: '#c79bff', badge: W.tower ? 'BOSS' : null });   // 无尽塔首领层 / 双人副本
  if (W.mats > 0) cards.push({ title: '碎晶 / 卷轴', val: '+' + W.mats + ' / +' + (W.scrs | 0), sym: '🔨', col: '#ffa502' });   // 双人副本
  cardW = cards.length >= 5 ? 118 : cards.length === 4 ? 150 : 180;
  if (cardW < 130) cards.forEach(c => { c.badge = null; });   // 卡片太窄时不画角标，避免盖住标题
  const totalCardsW = cards.length * cardW + (cards.length - 1) * cardGap;
  const cardX0 = px + (pw - totalCardsW) / 2, cardY = py + 204; // ★ 紧凑排布

  cards.forEach((cd, idx) => {
    const cx = cardX0 + idx * (cardW + cardGap);
    rpath(cx, cardY, cardW, cardH, 10);
    ctx.fillStyle = 'rgba(12, 18, 36, 0.85)'; ctx.fill();
    ctx.strokeStyle = cd.col + '55'; ctx.lineWidth = 1.2; ctx.stroke();

    if (cd.icon) drawIco(cd.icon, cx + 26, cardY + cardH / 2, 28);
    else txt(cd.sym || '◆', cx + 26, cardY + cardH / 2, 22, cd.col, 'center');

    txt(cd.title, cx + 48, cardY + 22, 11, '#8fa0b3');
    txt(cd.val, cx + 48, cardY + 46, 15, cd.col);

    if (cd.badge) {
      rpath(cx + cardW - 62, cardY + 5, 56, 15, 4);
      ctx.fillStyle = 'rgba(255, 71, 87, 0.3)'; ctx.fill();
      ctx.strokeStyle = '#ff4757'; ctx.lineWidth = 1; ctx.stroke();
      txt(cd.badge, cx + cardW - 34, cardY + 12.5, 7.5, '#ff7675', 'center');
    }
  });

  // 7. 经验条
  const expY = py + 292, expW = pw - 90, expX = px + 45;
  const curExp = S.xp, needExp = xpNeed(S.lv);
  const expRate = cl(curExp / needExp, 0, 1);
  rpath(expX, expY, expW, 14, 7);
  ctx.fillStyle = 'rgba(6, 10, 20, 0.9)'; ctx.fill();
  if (expRate > 0) {
    rpath(expX, expY, expW * expRate, 14, 7);
    ctx.fillStyle = '#2ed573'; ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; ctx.lineWidth = 1; ctx.stroke();
  txt('骑士等级 Lv.' + S.lv, expX + 10, expY + 7, 10, '#ffffff');
  txt(curExp + ' / ' + needExp + ' (' + Math.floor(expRate * 100) + '%)', expX + expW - 10, expY + 7, 10, '#8fa0b3', 'right');

  // 8. 按钮组
  const btnY = py + 342, btnH = 46;
  const isLast = nextStageIdx() < 0;

  const btnDefs = [
    { id: 'base', text: '返回大厅 [ESC]', w: 140, bg: 'rgba(255,255,255,0.08)', col: '#ccd6e0', border: 'rgba(255,255,255,0.2)' },
    { id: 'retry', text: '再次挑战 [R]', w: 140, bg: 'rgba(0, 229, 255, 0.15)', col: '#7df9ff', border: '#00e5ff' },
    { id: 'next', text: ST[cur].tw ? '下一层 [Enter]' : isLast ? '完成出征 [Enter]' : '下一战役 [Enter]', w: 190, bg: 'rgba(255, 216, 74, 0.25)', col: '#ffd84a', border: '#ffd84a', main: true }
  ];

  const totalBtnW = btnDefs.reduce((a, b) => a + b.w, 0) + 24;
  let curBx = px + (pw - totalBtnW) / 2;

  btnDefs.forEach(b => {
    rpath(curBx, btnY, b.w, btnH, 10);
    ctx.fillStyle = b.bg; ctx.fill();
    ctx.strokeStyle = b.border; ctx.lineWidth = b.main ? 2 : 1.2; ctx.stroke();

    if (b.main) {
      ctx.save();
      ctx.shadowColor = b.col; ctx.shadowBlur = 10 + 4 * Math.sin(T * 6);
      txt(b.text, curBx + b.w / 2, btnY + btnH / 2, 14, '#ffffff', 'center');
      ctx.restore();
    } else {
      txt(b.text, curBx + b.w / 2, btnY + btnH / 2, 13, b.col, 'center');
    }

    WIN_HITS.push({ id: b.id, x: curBx, y: btnY, w: b.w, h: btnH });
    curBx += b.w + 12;
  });

  ctx.restore();
}

// ===== 世界BOSS 高级结算 UI（暗炎赤金科技面板，对齐 680x430 统一规格） =====
let WB_HITS = [];

function drawWBSettlement() {
  if (!WB_RES) return;
  WB_HITS = [];
  const W = WB_RES;
  const t = W.t;
  const p = Math.min(1, t / 0.8);
  const isWin = W.win;

  ctx.save();
  // 1. 全屏暗黑聚焦遮罩
  ctx.fillStyle = isWin ? 'rgba(8, 4, 12, 0.90)' : 'rgba(12, 4, 8, 0.92)';
  ctx.fillRect(0, 0, 960, 540);

  // 2. 居中弹性入场
  const sc = t < 0.25 ? 0.8 + 0.2 * Math.sin((t / 0.25) * Math.PI * 0.5) : 1;
  const pw = 680, ph = 430, px = (960 - pw) / 2, py = 55;

  ctx.translate(px + pw / 2, py + ph / 2);
  ctx.scale(sc, sc);
  ctx.translate(-(px + pw / 2), -(py + ph / 2));

  // 底板与科技描边
  rpath(px, py, pw, ph, 18);
  const bgGrad = ctx.createLinearGradient(px, py, px, py + ph);
  bgGrad.addColorStop(0, isWin ? '#1a1426' : '#1c0e14');
  bgGrad.addColorStop(1, '#08050c');
  ctx.fillStyle = bgGrad; ctx.fill();
  ctx.strokeStyle = isWin ? '#ffd84a' : '#ff4757'; ctx.lineWidth = 2; ctx.stroke();

  // 顶部光影条
  const hg = ctx.createLinearGradient(px + 40, py, px + pw - 40, py);
  hg.addColorStop(0, 'rgba(255, 71, 87, 0)');
  hg.addColorStop(0.5, isWin ? 'rgba(255, 216, 74, 0.25)' : 'rgba(255, 71, 87, 0.25)');
  hg.addColorStop(1, 'rgba(255, 71, 87, 0)');
  ctx.fillStyle = hg; ctx.fillRect(px + 40, py + 2, pw - 80, 50);

  // 3. 标题与首领名
  let titleStr = isWin ? 'VICTORY · 讨伐成功！' : (W.reason === 'time' ? 'TIME OVER · 讨伐超时' : (W.reason === 'retreat' ? 'RETREAT · 战略撤离' : 'DEFEAT · 战役溃败'));
  let titleCol = isWin ? '#ffd84a' : (W.reason === 'retreat' ? '#7df9ff' : '#ff4757');
  txt(titleStr, px + pw / 2, py + 30, 25, titleCol, 'center');
  txt('首领讨伐 · ' + W.bossName, px + pw / 2, py + 66, 14, '#a2b4cb', 'center');

  // 4. 伤害总进度条与 Rank 勋章（水平基准线 py + 108 对齐）
  const midY = py + 108;
  const barW = 320, barH = 14, barX = px + pw / 2 - barW / 2, barY = midY - 6;

  // 伤害文本
  txt('累计伤害: ' + poN(W.damage * p) + ' / ' + poN(W.maxHp) + ' (' + Math.round(W.dmgPct * p) + '%)', px + pw / 2, barY - 14, 12, '#dfe6ee', 'center');
  
  // 伤害血条
  rpath(barX, barY, barW, barH, 7);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'; ctx.fill();
  if (W.dmgPct > 0) {
    rpath(barX, barY, barW * (W.dmgPct / 100) * p, barH, 7);
    const dmgGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    dmgGrad.addColorStop(0, '#ff4757');
    dmgGrad.addColorStop(1, '#ffa502');
    ctx.fillStyle = dmgGrad; ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255, 216, 74, 0.45)'; ctx.lineWidth = 1; ctx.stroke();

  // 状态评价勋章 (S / A / B / C)
  const rankX = px + pw - 78, rankY = midY;
  ctx.save();
  ctx.beginPath(); ctx.arc(rankX, rankY, 26, 0, Math.PI * 2);
  ctx.fillStyle = isWin ? 'rgba(255, 216, 74, 0.15)' : 'rgba(255, 71, 87, 0.15)'; ctx.fill();
  ctx.strokeStyle = W.rank === 'S' ? '#ffd84a' : (W.rank === 'A' ? '#7df9ff' : '#ff6b81'); ctx.lineWidth = 2; ctx.stroke();
  txt(W.rank, rankX, rankY - 1, 26, W.rank === 'S' ? '#ffd84a' : (W.rank === 'A' ? '#7df9ff' : '#ff6b81'), 'center');
  txt('RANK', rankX, rankY + 36, 10, '#8fa0b3', 'center');
  ctx.restore();

  // 提示信息
  const subTip = W.msg ? W.msg
    : W.pending ? '正在把战果上传到全服榜单…'
    : W.reason === 'retreat' ? '已撤退：本次伤害不计入全服，也不消耗讨伐次数'
    : W.err ? '⚠ 战果上传失败（伤害未计入全服）：' + W.err
    : W.isKill ? '★ 最后一击由你完成！额外获得 50% 赏金与钻石 ★'
    : isWin ? '首领已倒下，但最后一击被他人抢先；你的伤害已计入全服'
    : '金币与钻石按伤害折算；你的伤害已计入全服累计榜';
  txt(subTip, px + pw / 2, py + 148, 11.5, W.isKill ? '#7dff9a' : '#ffa502', 'center');

  // 5. 奖励展示卡片网格 (py + 204，收紧间距)
  // 5. 奖励展示卡片网格 (收紧间距，防止文字与角标重叠)[cite: 45]
  const cardW = 150, cardH = 70, cardGap = 14;
  const cards = [
    { 
      title: '战果赏金', 
      val: '+' + Math.round(W.gold * p).toLocaleString(), 
      icon: ICO.g, 
      col: '#ffd84a',
      badge: W.isKill ? 'KILL +50%' : null
    },
    // ★ 将标题微调为「首领钻石」，排版更清爽[cite: 45]
    { 
      title: '首领钻石', 
      val: '+' + (W.diam | 0), 
      icon: ICO.d, 
      col: '#4fe3ff', 
      badge: W.isKill ? 'KILL +50%' : null 
    },
    { 
      title: '历史最高伤害', 
      val: poN(W.bestDmg), 
      sym: '🏆', 
      col: '#ff9f43' 
    },
    { 
      title: '交战耗时', 
      val: W.timeSpent + 's / ' + W.totalLimit + 's', 
      sym: '⏱', 
      col: '#7df9ff' 
    }
  ];

  const totalCardsW = cards.length * cardW + (cards.length - 1) * cardGap;
  const cardX0 = px + (pw - totalCardsW) / 2, cardY = py + 204;

  cards.forEach((cd, idx) => {
    const cx = cardX0 + idx * (cardW + cardGap);
    rpath(cx, cardY, cardW, cardH, 10);
    ctx.fillStyle = 'rgba(16, 12, 24, 0.85)'; ctx.fill();
    ctx.strokeStyle = cd.col + '55'; ctx.lineWidth = 1.2; ctx.stroke();

    if (cd.icon) drawIco(cd.icon, cx + 26, cardY + cardH / 2, 28);
    else txt(cd.sym || '◆', cx + 26, cardY + cardH / 2, 22, cd.col, 'center');

    // 内部文字正常显示，不再受角标干扰[cite: 45]
    txt(cd.title, cx + 48, cardY + 22, 11, '#8fa0b3');
    txt(cd.val, cx + 48, cardY + 46, 15, cd.col);

    // ★ 核心优化：改为卡片右上边框上方外浮挂件，彻底告别文字重叠！
    if (cd.badge) {
      const bw = 66, bh = 17, bx = cx + cardW - bw - 8, by = cardY - 9;
      rpath(bx, by, bw, bh, 5);
      ctx.fillStyle = 'rgba(235, 47, 47, 0.95)'; ctx.fill();
      ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 1.2; ctx.stroke();
      txt(cd.badge, bx + bw / 2, by + bh / 2, 8.5, '#ffffff', 'center');
    }
  });

  // 6. 今日剩余讨伐次数指示条
  const expY = py + 292, expW = pw - 90, expX = px + 45;
  rpath(expX, expY, expW, 20, 10);
  ctx.fillStyle = 'rgba(10, 12, 22, 0.9)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'; ctx.lineWidth = 1; ctx.stroke();
  
  txt('今日剩余讨伐次数：' + W.leftTries + ' / ' + (WB_DAILY + (wbData().buy | 0)), expX + 16, expY + 10, 11, W.leftTries > 0 ? '#ffd84a' : '#ff6b81');
  txt(W.rem >= 0 ? '全服首领剩余 ' + (W.rem / Math.max(1, W.bossMax) * 100).toFixed(1) + '%' : '每天 00:00 重置配额 · 可花钻石购买', expX + expW - 16, expY + 10, 10, '#8fa0b3', 'right');

  // 7. 三大交互操作按钮组 (py + 342)
  const btnY = py + 342, btnH = 46;
  const canRetry = !W.pending, hasTry = W.leftTries > 0;

  const btnDefs = [
    { id: 'base', text: '返回传送门 [ESC]', w: 150, bg: 'rgba(255,255,255,0.08)', col: '#ccd6e0', border: 'rgba(255,255,255,0.2)' },
    { id: 'char', text: '战备整备 [C]', w: 140, bg: 'rgba(0, 229, 255, 0.15)', col: '#7df9ff', border: '#00e5ff' },
    { 
      id: 'retry', 
      text: W.pending ? '结算中…' : hasTry ? '再次挑战 [Enter/R]' : (W.ask ? '确认花费100钻 [Enter]' : '💎100钻购买次数 [Enter]'), 
      w: 190, 
      bg: canRetry ? (isWin ? 'rgba(255, 216, 74, 0.25)' : 'rgba(255, 71, 87, 0.25)') : 'rgba(60,60,70,0.4)', 
      col: canRetry ? (isWin ? '#ffd84a' : '#ff7675') : '#889', 
      border: canRetry ? (isWin ? '#ffd84a' : '#ff4757') : '#555', 
      main: canRetry 
    }
  ];

  const totalBtnW = btnDefs.reduce((a, b) => a + b.w, 0) + 24;
  let curBx = px + (pw - totalBtnW) / 2;

  btnDefs.forEach(b => {
    rpath(curBx, btnY, b.w, btnH, 10);
    ctx.fillStyle = b.bg; ctx.fill();
    ctx.strokeStyle = b.border; ctx.lineWidth = b.main ? 2 : 1.2; ctx.stroke();

    if (b.main) {
      ctx.save();
      ctx.shadowColor = b.col; ctx.shadowBlur = 10 + 4 * Math.sin(T * 6);
      txt(b.text, curBx + b.w / 2, btnY + btnH / 2, 14, '#ffffff', 'center');
      ctx.restore();
    } else {
      txt(b.text, curBx + b.w / 2, btnY + btnH / 2, 13, b.col, 'center');
    }

    WB_HITS.push({ id: b.id, x: curBx, y: btnY, w: b.w, h: btnH });
    curBx += b.w + 12;
  });

  ctx.restore();
}

// ===== Boss 血条：登场充能 / 延迟残影 / 血量变色 / 受击抖动闪白 =====
const BOSSB = { e: null, hp: 0, ghost: 0, hold: 0, flash: 0, intro: 0, t: null };
function drawBossBar(b, name) {
  // 独立计时（不与 hudDt 共用，避免同帧互相吃掉 dt）
  const d = BOSSB.t === null ? 0 : Math.min(.1, Math.max(0, T - BOSSB.t)); BOSSB.t = T;
  if (BOSSB.e !== b) { Object.assign(BOSSB, { e: b, hp: b.hp, ghost: b.hp, hold: 0, flash: 0, intro: 0 }); }   // 新首领：重新播放登场充能
  if (b.hp < BOSSB.hp) { BOSSB.hold = .45; BOSSB.flash = .18; }                                                // 受击：残影停留 .45s，整体抖动闪白
  BOSSB.hp = b.hp;
  BOSSB.intro = Math.min(1, BOSSB.intro + d / 1.1);
  BOSSB.flash = Math.max(0, BOSSB.flash - d);
  const ease = 1 - Math.pow(1 - BOSSB.intro, 3);
  if (BOSSB.intro < 1 || BOSSB.ghost < b.hp) BOSSB.ghost = b.hp;
  else if (BOSSB.hold > 0) BOSSB.hold -= d;
  else BOSSB.ghost = Math.max(b.hp, BOSSB.ghost - (BOSSB.ghost - b.hp) * Math.min(1, d * 5) - b.mhp * .02 * d);

  const r = cl(b.hp / b.mhp, 0, 1), gr = cl(BOSSB.ghost / b.mhp, 0, 1);
  const bw = 300, bh = 16, bx = (CP_HUD.w ? CP_HUD.x + 3 : 317) + (BOSSB.flash > 0 ? (Math.random() - .5) * 4 : 0), by = 66;   // 放在战力 / 任务按钮正下方（与战力胶囊左对齐）
  const pulse = r < .25 ? .5 + .5 * Math.sin(T * 9) : 0;
  const cols = r > .5 ? ['#ff4757', '#ff9f43'] : r > .25 ? ['#d81f3a', '#ff6a3d'] : ['#a80018', '#ff2d2d'];
  const rage = !!b.rg;

  ctx.save();
  // 名称 + 狂暴标记 + 百分比
  txt(name, bx + 2, 53, 14, '#fff', 'left');
  if (rage) txt('狂暴', bx + 2 + ctx.measureText(name).width + 10, 53, 12, '#ff3838', 'left');
  txt((r * 100 < 10 && r > 0 ? (r * 100).toFixed(1) : Math.ceil(r * 100)) + '%', bx + bw - 2, 53, 13, r < .25 ? '#ff6b6b' : '#ffd8a8', 'right');

  // 底框
  rpath(bx - 3, by - 3, bw + 6, bh + 6, 10);
  ctx.fillStyle = 'rgba(8,10,20,.92)'; ctx.fill();
  ctx.strokeStyle = rage ? 'rgba(255,60,60,.85)' : 'rgba(217,189,125,.55)'; ctx.lineWidth = 1.6;
  if (rage || pulse) { ctx.shadowColor = '#ff3030'; ctx.shadowBlur = 8 + pulse * 10 }
  ctx.stroke(); ctx.shadowBlur = 0;

  // 条内裁剪
  rpath(bx, by, bw, bh, 7); ctx.clip();
  const fw = bw * Math.min(r, ease), gw = bw * Math.min(gr, ease);
  if (gw > fw) { ctx.fillStyle = 'rgba(255,240,200,.85)'; ctx.fillRect(bx + fw, by, gw - fw, bh) }   // 残影
  if (fw > 0) {
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]);
    ctx.fillStyle = g; ctx.fillRect(bx, by, fw, bh);
    const hl = ctx.createLinearGradient(0, by, 0, by + bh); hl.addColorStop(0, 'rgba(255,255,255,.38)'); hl.addColorStop(.5, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl; ctx.fillRect(bx, by, fw, bh);                                                  // 顶部高光
    if (pulse) { ctx.fillStyle = 'rgba(255,255,255,' + pulse * .22 + ')'; ctx.fillRect(bx, by, fw, bh) }
    if (BOSSB.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + BOSSB.flash / .18 * .55 + ')'; ctx.fillRect(bx, by, fw, bh) }
  }
  if (BOSSB.intro < 1) { ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(bx + bw * ease - 2, by, 3, bh) }   // 充能光标
  ctx.restore();

  // 数值（条下方右对齐）
  txt(b.hp.toLocaleString() + ' / ' + b.mhp.toLocaleString(), bx + bw - 2, by + bh + 13, 11, '#cdd6e6', 'right');
}

// ===== 小怪 / 精英血条：常驻显示（平时半透明）、受伤后高亮、带延迟残影、受击闪白 =====
function drawEnemyBar(e) {
  if (e.dead) return;
  const now = T, d = e.bt === undefined ? 0 : Math.min(.1, Math.max(0, now - e.bt)); e.bt = now;
  if (e.bl === undefined) { e.bl = e.hp; e.bg = e.hp; e.bs = -99; e.bh = 0 }
  if (e.hp < e.bl) { e.bs = now; e.bh = .3 }                                   // 受击：记录时间，残影停留 .3s
  e.bl = e.hp;
  if (e.bg < e.hp) e.bg = e.hp;
  else if (e.bh > 0) e.bh -= d;
  else e.bg += (e.hp - e.bg) * Math.min(1, d * 6);
  const idle = now - e.bs;
  const base = .6;                                                              // 常驻显示：平时半透明，受伤后 3.4 秒内全亮，再缓慢回落
  const a = idle < 3.4 ? 1 : idle < 4 ? 1 - (idle - 3.4) / .6 * (1 - base) : base;

  const elite = e.t === 'wd', w = elite ? 66 : 52, h = elite ? 7 : 5;
  const x = sn(e.x - cam - w / 2), y = sn(e.y - e.h - 14), r = cl(e.hp / e.mhp, 0, 1), gr = cl(e.bg / e.mhp, 0, 1);
  const c1 = r > .5 ? '#ff4757' : r > .25 ? '#e0283c' : '#b3001b', c2 = r > .5 ? '#ff9f43' : r > .25 ? '#ff6a3d' : '#ff3030';

  ctx.save(); ctx.globalAlpha = a;
  rpath(x - 2, y - 2, w + 4, h + 4, (h + 4) / 2);                                // 底框
  ctx.fillStyle = 'rgba(8,10,20,.82)'; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = elite ? 'rgba(255,208,90,.85)' : 'rgba(255,255,255,.28)'; ctx.stroke();
  rpath(x, y, w, h, h / 2); ctx.clip();
  if (gr > r) { ctx.fillStyle = 'rgba(255,240,200,.85)'; ctx.fillRect(x + w * r, y, w * (gr - r), h) }
  if (r > 0) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(x, y, w * r, h);
    const hl = ctx.createLinearGradient(0, y, 0, y + h); hl.addColorStop(0, 'rgba(255,255,255,.4)'); hl.addColorStop(.6, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl; ctx.fillRect(x, y, w * r, h);
    if (e.fl > 0) { ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(x, y, w * r, h) }
  }
  ctx.restore();
  if (elite) {                                                                   // 精英：左侧金色菱形标记
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#ffd84a'; ctx.strokeStyle = 'rgba(4,6,12,.9)'; ctx.lineWidth = 1.5;
    const dx = x - 8, dy = y + h / 2; ctx.beginPath(); ctx.moveTo(dx, dy - 4.5); ctx.lineTo(dx + 4.5, dy); ctx.lineTo(dx, dy + 4.5); ctx.lineTo(dx - 4.5, dy); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
  }
}


// ===== 右侧任务信息面板（与其它 HUD 同一套玻璃 + 金色包边；标签/数值分层）=====
function drawInfoHUD() {
  const z = ST[cur], w = 160, h = z.wb ? 78 : 100, x = 960 - 18 - w, y = 74;   // 非世界BOSS：多一行“时长”
  hudPanel(x, y, w, h, UIC.gold, 9);
  const R = x + w - 12, rows = [y + 19, y + 41, y + 63, y + 85];
  ctx.fillStyle = 'rgba(255,255,255,.07)';
  for (let k = 0; k < (z.wb ? 2 : 3); k++) ctx.fillRect(x + 14, y + 30 + k * 22, w - 26, 1);
  const lab = (s, yy) => ut(s, x + 16, yy, 10.5, UIC.sub, 'left', { w: 600, sp: 1, sh: 0 });
  let rp = rows[2];                                     // 药水所在行
  if (z.wb) {
    const tl = Math.ceil(WBT);
    lab('剩余时间', rows[0]); ut((tl / 60 | 0) + ':' + String(tl % 60).padStart(2, '0'), R, rows[0], 13, WBT < 20 ? '#ff7b7b' : UIC.txt, 'right', { w: 700 });
    lab('累计伤害', rows[1]); ut(poN(WBD), R, rows[1], 13, '#9be8b0', 'right', { w: 700 });
  } else {
    const cnt = Math.min(kills, z.k) + ' / ' + z.k;
    lab('目标', rows[0]); ut(cnt, R, rows[0], 13, UIC.txt, 'right', { w: 700 });
    if (bs) ut('BOSS', R - uw(cnt, 13, 700) - 8, rows[0], 10, '#ff5a5a', 'right', { w: 700, sp: 1, sh: 0 });
    lab('战利品', rows[1]); ut('+' + RG + ' G', R, rows[1], 13, '#e8cf8e', 'right', { w: 700 });
    const tm = Math.max(0, stageT), tmS = (tm / 60 | 0) + ':' + String(tm % 60 | 0).padStart(2, '0');
    lab('时长', rows[2]); ut(tmS, R, rows[2], 13, tm <= STAR_TIME ? UIC.txt : '#ff9b7b', 'right', { w: 700 });   // 超过 STAR_TIME 秒（失去耗时星）变橙红
    rp = rows[3];
  }
  lab('药水', rp);
  let cx = R;                                           // 药水：色点 + ×数量，从右往左排
  for (const [col, n] of [['#3f8fe8', S.mp], ['#e0414f', S.hp]]) {
    const t = '×' + n, tw0 = uw(t, 12, 700);
    ut(t, cx, rp, 12, n > 0 ? UIC.txt : '#6f7a8c', 'right', { w: 700 });
    ctx.save(); const dx = cx - tw0 - 8;
    const g = ctx.createRadialGradient(dx - 1, rp - 1.5, .5, dx, rp, 4.5); g.addColorStop(0, '#fff'); g.addColorStop(.35, col); g.addColorStop(1, 'rgba(0,0,0,.6)');
    ctx.fillStyle = g; ctx.globalAlpha = n > 0 ? 1 : .45; ctx.beginPath(); ctx.arc(dx, rp, 4.5, 0, 7); ctx.fill(); ctx.restore();
    cx = dx - 14;
  }
  // 在 drawInfoHUD 函数的末尾，替换原本的 if (!z.wb) drawStarHUD(...):
  if (!z.wb && !z.tw) {
    drawStarHUD(x, y + h + 6, w); // 常规战役：显示三星达成条件
  } else if (z.tw) {
    drawTowerHUD(x, y + h + 6, w); // ★ 无尽塔：只显示层数与突破进度，无三星之分
  }
}

// ===== 无尽塔战斗 HUD：不展示任何三星条件，只展示层数与纪录 =====
function drawTowerHUD(x, y, w) {
  const h = 54, z = ST[cur], f = z.floor || 1, best = typeof twBest === 'function' ? twBest() : 0;
  const isFirst = f > best;
  const col = (typeof TOWER !== 'undefined' && TOWER.col) ? TOWER.col : '#a55eea';
  hudPanel(x, y, w, h, col, 8);
  const R = x + w - 12;
  ut('🗼 无尽塔', x + 14, y + 16, 11, col, 'left', { w: 700, sp: 1, sh: 0 });
  ut('第 ' + f + ' 层', R, y + 16, 13, '#ffd84a', 'right', { w: 700 });
  ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(x + 14, y + 27, w - 26, 1);
  ut(isFirst ? '挑战前沿' : '已通关层', x + 14, y + 39, 10, isFirst ? '#ffd84a' : UIC.sub, 'left', { w: 600, sh: 0 });
  ut(best ? '最高第 ' + best + ' 层' : '首战突破', R, y + 39, 11, '#7df9ff', 'right', { w: 600 });
}

// ===== 实时三星面板：与结算条件（battle.js fin）一致 —— 通关 / 剩余生命 ≥ 50% / 耗时 ≤ 75 秒 =====
function drawStarHUD(x, y, w) {
  const h = 68, hr = P.mh > 0 ? cl(P.hp / P.mh, 0, 1) : 0, hOk = hr >= .5, tOk = stageT <= STAR_TIME;
  hudPanel(x, y, w, h, UIC.gold, 9);
  const R = x + w - 12, rows = [y + 17, y + 36, y + 55];
  ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(x + 14, y + 26, w - 26, 1); ctx.fillRect(x + 14, y + 45, w - 26, 1);
  const GOOD = '#9be8b0', BAD = '#ff7b7b', ON = '#ffd84a', OFF = '#4a5468';
  const row = (yy, on, label, val, vc) => {
    ut('★', x + 20, yy, 13, on ? ON : OFF, 'center', { w: 700, sh: 0 });
    ut(label, x + 32, yy, 10.5, on ? UIC.txt : UIC.sub, 'left', { w: 600, sh: 0 });
    ut(val, R, yy, 12, vc, 'right', { w: 700 });
  };
  row(rows[0], true, '通关', '通关即得', '#e8cf8e');
  row(rows[1], hOk, '生命 ≥ 50%', Math.round(hr * 100) + '%', hOk ? GOOD : BAD);
  row(rows[2], tOk, '耗时 ≤ ' + STAR_TIME + 's', tOk ? '剩 ' + Math.ceil(STAR_TIME - stageT) + 's' : '已超时', tOk ? GOOD : BAD);
}


// ===== 底部按键提示：键帽 + 说明（触屏设备不显示，沿用原先行为）=====
function hintLine(str, cy = 524) {
  if (typeof TOUCH !== 'undefined' && TOUCH) return;
  const segs = String(str).split(/ {2,}/).filter(Boolean).map(s => {
    const i = s.indexOf(' ');
    return { k: (i < 0 ? s : s.slice(0, i)).replace(/^\[|\]$/g, ''), l: i < 0 ? '' : s.slice(i + 1) };
  });
  const gap = 14;
  for (const g of segs) { g.kw = uw(g.k, 10, 700) + 10; g.lw = uw(g.l, 11, 500) }
  let x = 480 - (segs.reduce((a, g) => a + g.kw + 4 + g.lw, 0) + gap * (segs.length - 1)) / 2;
  ctx.save(); ctx.globalAlpha = .8;
  for (const g of segs) {
    rpath(x, cy - 8, g.kw, 16, 4); ctx.fillStyle = 'rgba(10,14,26,.7)'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(217,189,125,.45)'; ctx.stroke();
    ut(g.k, x + g.kw / 2, cy, 10, '#e6cf93', 'center', { w: 700, sh: 0 });
    ut(g.l, x + g.kw + 4, cy, 11, 'rgba(210,218,232,.9)', 'left', { w: 500 });
    x += g.kw + 4 + g.lw + gap;
  }
  ctx.restore();
}


// ===== 胶囊终端 [N]：键盘操作 =====
// W/S ↑/↓ 选择胶囊（自动翻页）　A/D ←/→ 切换分类　Enter/空格/F 装配或卸下　N/Esc 关闭（在 main.js 处理）
const CAP_FILTERS = ['all', 'owned', 'equipped'], CAP_PAGE = 5;
function capList() {
  return CAPSULES.filter(c => capFilter === 'owned' ? S.caps.includes(c.id) : capFilter === 'equipped' ? S.eqCap === c.id : true);
}
function capEquipToggle() {
  const c = CAPSULES.find(c => c.id === curSelCapId);
  if (!c) return;
  if (!S.caps.includes(c.id)) { showCapModal = false; say('尚未获得该胶囊，请前往扭蛋机抽取！'); }
  else if (S.eqCap === c.id) { S.eqCap = null; if (inForm()) { clearForms(); calc() } save() }
  else { S.eqCap = c.id; if (inForm()) clearForms(); save(); calc() }
}
function capKeys() {
  const list = capList(), n = list.length;
  const eat = (...ks) => ks.forEach(k => delete PR[k]);
  const sel = i => { curSelCapId = list[i].id; capPage = Math.floor(i / CAP_PAGE) };
  const idx = () => list.findIndex(c => c.id === curSelCapId);
  const step = d => { if (!n) return; const i = idx(); sel(i < 0 ? 0 : (i + d + n) % n) };
  const tab = d => {
    capFilter = CAP_FILTERS[(CAP_FILTERS.indexOf(capFilter) + d + 3) % 3]; capPage = 0;
    const l = capList(); if (l.length && !l.some(c => c.id === curSelCapId)) curSelCapId = l[0].id;
  };
  if (PR.KeyW || PR.ArrowUp) { step(-1); eat('KeyW', 'ArrowUp') }
  if (PR.KeyS || PR.ArrowDown) { step(1); eat('KeyS', 'ArrowDown') }
  if (PR.KeyA || PR.ArrowLeft) { tab(-1); eat('KeyA', 'ArrowLeft') }
  if (PR.KeyD || PR.ArrowRight) { tab(1); eat('KeyD', 'ArrowRight') }
  if (PR.Enter || PR.Space || PR.KeyF) { capEquipToggle(); eat('Enter', 'Space', 'KeyF') }
}
function drawCapsuleModal() {
  drawCapsuleModal0();
  drawCapUpFx();
  if (typeof TOUCH !== 'undefined' && TOUCH) return;
  ut('W/S 选择    A/D 切换分类    Enter 装配 / 卸下    N 或 Esc 关闭', 480, 523, 11, 'rgba(210,218,232,.8)', 'center', { w: 500, sp: .5 });
}

// ===== 战绩档案（点击左上角等级徽章 / 按 [I] 打开）=====
// 数据存在 S.ps 里，跟着 save() 一起写入本地与云端；统计从加入本功能后开始累计。
let showStat = false;
const PS_BADGE = { x: 58, y: 52, r: 32 };   // 与 drawPlayerHUD(16,14) 的等级徽章对齐
let psSaveT = 0;
function ps() {
  let p = S.ps;
  if (!p || typeof p !== 'object') p = S.ps = {};
  for (const k of ['pt', 'gE', 'dE', 'dmg', 'maxHit', 'hits', 'crits', 'kills', 'boss', 'win', 'lose', 'taken', 'hen', 'up', 'dis', 'rr'])
    if (typeof p[k] !== 'number') p[k] = 0;
  if (!p.formT || typeof p.formT !== 'object') p.formT = {};
  if (!p.first) p.first = Date.now();
  return p;
}
function psTick(dt) {
  if (G === 'title' || G === 'load') return;
  const p = ps(); p.pt += dt;
  if (G === 'play') { const k = curRiderKey(); p.formT[k] = (p.formT[k] || 0) + dt }
  psSaveT += dt;
  if (psSaveT > 15) { psSaveT = 0; if (!window.__noSave) try { localStorage.malaya = JSON.stringify(S) } catch (e) { } }   // 仅本地，云端仍走 save() 的防抖
}
function psHit(d, c) { const p = ps(); p.dmg += d; p.hits++; if (c) p.crits++; if (d > p.maxHit) p.maxHit = d }
function psKill(isBoss) { 
  const p = ps(); 
  p.kills++; 
  if (isBoss) p.boss++; 

  // ★ 记录各个形态专属的击杀数据
  if (!p.formKills) p.formKills = {};
  if (!p.formBoss) p.formBoss = {};
  const rk = (typeof curRiderKey === 'function') ? curRiderKey() : 'malaya';
  p.formKills[rk] = (p.formKills[rk] || 0) + 1;
  if (isBoss) {
    p.formBoss[rk] = (p.formBoss[rk] || 0) + 1;
  }
}
function psGold(n) { if (n > 0) ps().gE += n }
function psDia(n) { if (n > 0) ps().dE += n }
function psTaken(d) { ps().taken += d }
function psResult(w) { const p = ps(); if (w) p.win++; else p.lose++ }
function psHen() { ps().hen++ }
addEventListener('beforeunload', () => { if (!window.__noSave) try { localStorage.malaya = JSON.stringify(S) } catch (e) { } });
document.addEventListener('visibilitychange', () => { if (document.hidden && !window.__noSave) try { localStorage.malaya = JSON.stringify(S) } catch (e) { } });

function psCanOpen() {
  return !showStat && !showQuest && !M && !showChar && !showCapModal && !gachaModal && (G === 'vil' || G === 'room' || G === 'play');
}
function psOpen() {
  if (G === 'play' && typeof coopBattleOn === 'function' && coopBattleOn()) {
    DT.push({ x: P.x, y: P.y - 180, s: '联机战斗中无法暂停查看战绩', t: 1.2, c: '#ffd84a' }); return;
  }
  showStat = true; TS.open = false; LB.view = null;
}
function psBadgeHit(x, y) { return Math.hypot(x - PS_BADGE.x, y - PS_BADGE.y) <= PS_BADGE.r }
const PS_PANEL = { x: 110, y: 26, w: 740, h: 488 };
function psClick(x, y) {
  if (lbClick(x, y)) return;   // 排行榜按钮优先
  const b = PS_PANEL;
  if ((x >= b.x + b.w - 70 && x <= b.x + b.w - 10 && y >= b.y + 10 && y <= b.y + 36) || x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) showStat = false;
}
cv.addEventListener('pointermove', e => {
  const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 960, y = (e.clientY - r.top) / r.height * 540;
  cv.style.cursor = (showStat || showQuest || (psCanOpen() && (psBadgeHit(x, y) || questBtnHit(x, y)))) ? 'pointer' : '';
});

function psBig(n) {
  n = Math.floor(n);
  if (n < 100000) return n.toLocaleString();
  if (n < 1e8) return (n / 1e4).toFixed(n < 1e6 ? 2 : 1) + ' 万';
  return (n / 1e8).toFixed(2) + ' 亿';
}
function psDur(s) {
  s = Math.floor(s); const h = s / 3600 | 0, m = (s % 3600) / 60 | 0;
  return h > 0 ? h + ' 小时 ' + m + ' 分' : m > 0 ? m + ' 分 ' + (s % 60) + ' 秒' : s + ' 秒';
}
const PS_TITLES = [[0, '见习骑士'], [50, '正式骑士'], [300, '资深战士'], [1000, '王牌骑士'], [3000, '传说骑士'], [10000, '大红花守护者']];
const PS_FORM = { malaya: 'Malaya', ryuki: '龙骑', '555': '555', blade: 'Blade' };

// ---- 档案数据源：自己（实时）/ 排行榜上的其他骑士（leaderboard.profile）----
function psSelfView() {
  const gear = [...S.inv, ...Object.values(S.eq || {}).filter(Boolean)];
  return {
    self: true, nick: S.nick || '无名骑士', lv: S.lv, cp: (typeof calcCP === 'function') ? calcCP() : 0,
    title: (typeof ttName === 'function' ? ttName() : '') || '', p: ps(), g: S.g, d: S.d,
    cl: Math.min(S.cl, NST), s3: Object.values(S.stars || {}).filter(v => v >= 3).length,
    caps: S.caps.length, top: gear.reduce((m, it) => it && it.tier > m ? it.tier : m, -1)
  };
}
function psViewFromRow(r) {
  const f = r.profile && typeof r.profile === 'object' && r.profile.p && typeof r.profile.p === 'object' ? r.profile : null;
  const v = { nick: r.nickname || '无名骑士', lv: r.lv || 1, cp: Math.round(r.cp || 0), title: r.title || (f && f.title) || '', p: null };
  if (!f) return v;   // 对方还没同步过详细档案（没升级到新版 / 数据库没加 profile 列）
  const n = x => Number(x) || 0, o = f.p;
  v.p = { pt: n(o.pt), gE: n(o.gE), dE: n(o.dE), dmg: n(o.dmg), maxHit: n(o.maxHit), hits: n(o.hits), crits: n(o.crits), kills: n(o.kills),
    boss: n(o.boss), win: n(o.win), lose: n(o.lose), taken: n(o.taken), hen: n(o.hen), first: n(o.first) || Date.now(),
    formT: o.formT && typeof o.formT === 'object' ? o.formT : {} };
  v.g = n(f.g); v.d = n(f.d); v.cl = n(f.cl); v.s3 = n(f.s3); v.caps = n(f.caps); v.top = f.top == null ? -1 : n(f.top);
  return v;
}

function drawStatModal() {
  const v = LB.view || psSelfView(), p = v.p || ps(), hasP = !!v.p, b = PS_PANEL, acc = inForm() ? formCol() : '#00e5ff';
  LB.hit = [];
  if (LB.tab === 1) { drawLeaderboard(); return; }   // 战力排行榜页（power.js）
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.62)'; ctx.fillRect(0, 0, 960, 540);
  hudPanel(b.x, b.y, b.w, b.h, acc, 18);

  // ===== 头部横幅：头像 + 昵称 + 称号 + 战力 / 称号收集 =====
  const hx = b.x + 20, hy = b.y + 44, hw = b.w - 40, hh = 78, hcy = hy + hh / 2;
  ut('// 骑士档案 · RIDER PROFILE', b.x + 24, b.y + 23, 10.5, acc, 'left', { w: 700, sp: 1.5, sh: 0 });
  ctx.save();
  rpath(hx, hy, hw, hh, 12);
  const hbg = ctx.createLinearGradient(hx, 0, hx + hw, 0);
  hbg.addColorStop(0, acc + '30'); hbg.addColorStop(.5, 'rgba(255,255,255,.045)'); hbg.addColorStop(1, 'rgba(255,255,255,.02)');
  ctx.fillStyle = hbg; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = acc + '55'; ctx.stroke();
  ctx.restore();

  // 头像环：LV
  const cx = hx + 14 + 30, cy = hcy;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, 32, 0, 7); ctx.lineWidth = 1; ctx.strokeStyle = acc + '44'; ctx.stroke();
  ctx.shadowColor = acc; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.arc(cx, cy, 27, 0, 7); ctx.fillStyle = 'rgba(3,5,12,.94)'; ctx.fill();
  ctx.lineWidth = 2.2; ctx.strokeStyle = acc; ctx.stroke();
  ctx.restore();
  ut('LV', cx, cy - 9, 8, UIC.sub, 'center', { w: 700, sp: 1.5, sh: 0 });
  ut(v.lv, cx, cy + 6, 19, UIC.hi, 'center', { w: 700 });

  // 昵称（大）+ 称号（在昵称下面，比昵称小一号）
  const tx = hx + 96, tcy = hy + 57;
  ut(v.nick || '无名骑士', tx, hy + 24, 24, UIC.hi, 'left', { w: 700 });
  const wornT = (v.title && typeof ttByName === 'function') ? ttByName(v.title) : null;
  let tImgW = wornT ? ttBadge(wornT, tx, tcy, 30, 130) : 0;
  if (wornT && !tImgW) {   // 有称号但没有图片：文字徽章
    const pw = uw(wornT.n, 12.5, 700) + 22;
    const rc = ttRar(wornT).col;
    rpath(tx, tcy - 11, pw, 22, 11); ctx.fillStyle = rc + '2e'; ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = rc; ctx.stroke();
    ut(wornT.n, tx + pw / 2, tcy + .5, 12.5, rc, 'center', { w: 700, sh: 0 });
    tImgW = pw;
  }
  if (wornT) ttRarTag(tx + tImgW + 8, tcy, wornT, true);   // 稀有度小标签
  if (!wornT) {
    const pw = uw('无称号', 12, 600) + 22;
    rpath(tx, tcy - 11, pw, 22, 11); ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.stroke();
    ut('无称号', tx + pw / 2, tcy + .5, 12, '#8a93a1', 'center', { w: 600, sh: 0 });
    tImgW = pw;
  }
  if (!LB.view) LB.hit.push({ x: tx - 6, y: tcy - 22, w: Math.max(tImgW + 12, 96), h: 44, fn: ttPickerOpen });   // 点称号：打开「更换称号」面板（查看他人时不可点）

  // 右侧：战力
  const r1 = hx + hw - 28;
  ut('战 力', r1, hcy - 15, 10, UIC.sub, 'right', { w: 600, sp: 1, sh: 0 });
  ut((v.cp || 0).toLocaleString(), r1, hcy + 9, 24, acc, 'right', { w: 700 });

  // 关闭按钮 + 页签
  rpath(b.x + b.w - 70, b.y + 10, 60, 26, 6); ctx.fillStyle = 'rgba(255,71,87,.25)'; ctx.fill(); ctx.strokeStyle = '#ff4757'; ctx.lineWidth = 1.2; ctx.stroke();
  ut('✕ 关闭', b.x + b.w - 40, b.y + 23, 11.5, '#ff9aa4', 'center', { w: 700 });
  if (LB.view) lbBtn(b.x + b.w - 154, b.y + 10, 76, 26, '← 排行榜', '#ffd84a', () => { LB.view = null; LB.tab = 1; lbFetch(); });   // 查看他人档案时：返回排行榜
  else lbTabBtn(b);   // 战绩 ⇄ 排行榜

  if (!hasP) {   // 对方还没有同步详细档案
    ut('该骑士的详细档案还没有同步', 480, b.y + 250, 16, UIC.hi, 'center', { w: 700 });
    ut('需要对方登录新版游戏并上线一次后才会显示', 480, b.y + 278, 11.5, UIC.sub, 'center', { w: 500, sh: 0 });
    ut('[I] / Esc / 点击空白处关闭', 480, b.y + b.h - 9, 9.5, 'rgba(210,218,232,.5)', 'center', { w: 500, sh: 0 });
    ctx.restore(); drawTitlePicker(); return;
  }

  // ===== 六张核心数据卡（3×2）=====
  const days = Math.max(0, (Date.now() - p.first) / 864e5);
  const avg = p.hits ? p.dmg / p.hits : 0;
  const cards = [
    ['总游戏时长', psDur(p.pt), '开始记录 ' + (days < 1 ? '不到 1' : days | 0) + ' 天', '#7df9ff', '⏱'],
    ['累计获得金币', psBig(p.gE) + ' G', '当前持有 ' + psBig(v.g), '#ffd84a', '🪙'],
    ['累计获得钻石', psBig(p.dE), '当前持有 ' + psBig(v.d), '#4fe3ff', '💎'],
    ['总造成伤害', psBig(p.dmg), '平均每击 ' + psBig(avg), '#ff7675', '⚔'],
    ['最高单击伤害', psBig(p.maxHit), p.maxHit && avg ? '约为平均伤害的 ' + (p.maxHit / avg).toFixed(1) + ' 倍' : '还没出过手', '#ff9f43', '💥'],
    ['消灭怪物总数', psBig(p.kills), '其中 BOSS ' + p.boss + ' 只', '#7dff9a', '☠']
  ];
  const cw = 224, ch = 70, gx = 14, gy = 10, x0 = hx, y0 = b.y + 134;
  cards.forEach((c, i) => {
    const x = x0 + (i % 3) * (cw + gx), y = y0 + (i / 3 | 0) * (ch + gy), col = c[3];
    rpath(x, y, cw, ch, 10);
    const cg = ctx.createLinearGradient(x, y, x + cw, y + ch); cg.addColorStop(0, col + '24'); cg.addColorStop(1, 'rgba(255,255,255,.02)');
    ctx.fillStyle = cg; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = col + '40'; ctx.stroke();
    ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 8; rpath(x, y + 12, 3, ch - 24, 1.5); ctx.fillStyle = col; ctx.fill(); ctx.restore();
    ctx.save(); ctx.globalAlpha = .16; ut(c[4], x + cw - 14, y + ch / 2 + 1, 32, '#fff', 'right', { sh: 0 }); ctx.restore();   // 右侧淡淡的大图标
    ut(c[0], x + 16, y + 15, 10.5, UIC.sub, 'left', { w: 600, sp: .8, sh: 0 });
    ut(c[1], x + 16, y + 38, 24, col, 'left', { w: 700 });
    ut(c[2], x + 16, y + 57, 10, 'rgba(210,218,232,.65)', 'left', { w: 500, sh: 0 });
  });

  // ===== 更多资讯 =====
  const iy = y0 + 2 * (ch + gy) + 16;
  ut('// 更多资讯', b.x + 24, iy, 11, acc, 'left', { w: 700, sp: 1.5, sh: 0 });
  const rg = ctx.createLinearGradient(b.x + 116, 0, b.x + b.w - 20, 0); rg.addColorStop(0, acc + '66'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = rg; ctx.fillRect(b.x + 116, iy, b.w - 136, 1);
  const total = p.win + p.lose, ft = Object.entries(p.formT).sort((a, b2) => b2[1] - a[1])[0];
  const top = v.top;
  const info = [
    ['战斗战绩', p.win + ' 胜 / ' + p.lose + ' 负' + (total ? '（胜率 ' + Math.round(p.win / total * 100) + '%）' : '')],
    ['暴击', p.crits.toLocaleString() + ' 次' + (p.hits ? '（占 ' + (p.crits / p.hits * 100).toFixed(1) + '%）' : '')],
    ['累计承受伤害', psBig(p.taken)],
    ['变身次数', p.hen.toLocaleString() + ' 次'],
    ['最常用形态', ft ? (PS_FORM[ft[0]] || ft[0]) + '（' + psDur(ft[1]) + '）' : '暂无'],
    ['关卡进度', v.cl + ' / ' + NST + ' 通关 · 三星 ' + v.s3],
    ['胶囊收集', v.caps + ' / ' + CAPSULES.length],
    ['最高品质装备', top >= 0 ? TIERS[top].n : '暂无']
  ];
  info.forEach((r, i) => {
    const row = i / 2 | 0, x = hx + (i % 2) * 358, y = iy + 22 + row * 28;
    if (row % 2 === 0) { rpath(x, y - 13, 342, 26, 6); ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fill(); }
    ctx.beginPath(); ctx.arc(x + 12, y, 2.2, 0, 7); ctx.fillStyle = acc + 'aa'; ctx.fill();
    ut(r[0], x + 22, y, 11.5, UIC.sub, 'left', { w: 600, sh: 0 });
    ut(r[1], x + 330, y, 12, UIC.hi, 'right', { w: 700 });
  });

  // 趣味小贴士（每小时换一条）
  const mins = p.pt / 60, eps = mins / 25;
  const fun = [
    '累计游玩时间相当于看完 ' + eps.toFixed(1) + ' 集特摄剧（按每集 25 分钟算）。',
    p.kills ? '平均每玩 1 分钟消灭 ' + (p.kills / Math.max(1, mins)).toFixed(1) + ' 只怪物。' : '还没有击杀记录，去传送门走一趟吧！',
    p.taken ? '你挨的打 ' + psBig(p.taken) + ' 点，是出手总伤害的 ' + (p.taken / Math.max(1, p.dmg) * 100).toFixed(1) + '%，防守得不错。' : '至今零受伤记录，或者是刚开始记录？',
    p.hen ? '每次变身平均能带来 ' + (p.kills / p.hen).toFixed(1) + ' 个击杀。' : '试试按 P 变身，看看数据怎么变。'
  ];
  const tip = LB.view ? (LB.view.mine ? '这是你在排行榜上的公开档案，其他骑士点你的名字看到的就是这些。' : '正在查看「' + v.nick + '」的档案 · 数据为对方最近一次同步时的状态。') : fun[(Date.now() / 36e5 | 0) % fun.length];
  const ty = b.y + b.h - 44;
  rpath(b.x + 20, ty, b.w - 40, 28, 8); { const tg = ctx.createLinearGradient(b.x + 20, 0, b.x + b.w - 20, 0); tg.addColorStop(0, 'rgba(255,216,74,.16)'); tg.addColorStop(1, 'rgba(255,216,74,.03)'); ctx.fillStyle = tg; } ctx.fill(); ctx.strokeStyle = 'rgba(255,216,74,.32)'; ctx.lineWidth = 1; ctx.stroke();
  ut('💡 ' + tip, b.x + 34, ty + 14.5, 11.5, '#ffe9a6', 'left', { w: 600, sh: 0 });
  ut('[I] / Esc / 点击空白处关闭 · 统计从本功能上线后开始累计', 480, b.y + b.h - 9, 9.5, 'rgba(210,218,232,.5)', 'center', { w: 500, sh: 0 });
  ctx.restore();
  drawTitlePicker();   // 「更换称号」面板（titles.js），盖在战绩档案上层
}

// ===== 每日任务 + 成就（按 [Q] / 点击战力旁的「任务」按钮）=====
// 数据：S.qd（今日任务）、S.ach（各成就已领取档数）、S.qs（全勤天数）——随 save() 写入本地与云端。
// 进度全部来自战绩档案 ps() 的累计数字：每日任务记「当天开始时的快照」，进度 = 当前累计 − 快照；成就直接读累计值 / 当前状态。
// 想加新任务 / 新成就：只要在 QD_POOL / QA 里加一项（get 返回一个累计数字即可）。
let showQuest = false;
const QST = { tab: 0, page: 0, hit: [], toast: [], seen: null, tickT: 0, pend: 0, pendD: 0, pendA: 0 };
const QB = { x: -99, y: -99, w: 0, h: 22 };
const QA_PER = 6;
const QROM = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ'];
const QRW = [{ d: 10, g: 300 }, { d: 20, g: 1000 }, { d: 40, g: 3000, s: 2 }, { d: 80, g: 8000, s: 3 }, { d: 150, g: 20000, s: 5 }];   // 成就每一档的奖励
const qR10 = n => Math.max(10, Math.round(n / 10) * 10);

function qDay() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function qSecsLeft() { const n = new Date(), e = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1); return Math.max(0, ((e - n) / 1000) | 0); }
function qHMS(s) { return String(s / 3600 | 0).padStart(2, '0') + ':' + String((s % 3600) / 60 | 0).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
function qRng(seed) {   // 同一天、同一台设备 / 云端 → 同样的任务
  let h = 2166136261; for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h += 0x6D2B79F5; let t = Math.imul(h ^ h >>> 15, 1 | h); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// ---------- 每日任务 ----------
const QD_POOL = [
  { id: 'kill', n: '清剿怪物', d: t => '消灭 ' + t + ' 只怪物', get: p => p.kills, tg: lv => qR10(40 + lv * 1.2), x: {} },
  { id: 'boss', n: '讨伐首领', d: t => '击败 ' + t + ' 只 BOSS', get: p => p.boss, tg: lv => lv >= 40 ? 2 : 1, x: { s: 1 } },
  { id: 'win', n: '凯旋而归', d: t => '赢得 ' + t + ' 场战斗', get: p => p.win, tg: lv => lv >= 30 ? 3 : 2, x: { s: 1 } },
  { id: 'hen', n: '变身！', d: t => '变身 ' + t + ' 次', get: p => p.hen, tg: lv => lv >= 30 ? 5 : 3, x: {}, need: () => S.caps.length > 0 },
  { id: 'crit', n: '致命节奏', d: t => '打出 ' + t + ' 次暴击', get: p => p.crits, tg: lv => qR10(30 + lv * 1.5), x: {} },
  { id: 'dmg', n: '火力全开', d: t => '累计造成 ' + psBig(t) + ' 点伤害', get: p => p.dmg, tg: lv => Math.round((6000 + lv * 2500) / 1000) * 1000, x: {} },
  { id: 'up', n: '锻造时间', d: t => '强化装备 ' + t + ' 次', get: p => p.up, tg: lv => lv < 20 ? 1 : 2, x: { m: 6 } },
  { id: 'dis', n: '废物利用', d: t => '分解 ' + t + ' 件装备', get: p => p.dis, tg: () => 3, x: { m: 8 } },
  { id: 'gold', n: '赏金猎人', d: t => '累计获得 ' + psBig(t) + ' 金币', get: p => p.gE, tg: lv => Math.round((500 + lv * 80) / 100) * 100, x: {} },
  { id: 'form', n: '形态磨合', d: t => '以变身形态战斗 ' + t + ' 秒', get: p => (p.formT.ryuki || 0) + (p.formT['555'] || 0) + (p.formT.blade || 0), tg: () => 120, x: {}, need: () => S.caps.length > 0 }
];
const QD_BY = {}; for (const q of QD_POOL) QD_BY[q.id] = q;
const QD_N = 4;
const QD_DIAM = 100, QD_BONUS_DIAM = 200;   // 每日任务钻石：4 个任务各 100，全勤奖励 200

function qdInit() {   // 幂等：每天第一次调用时抽 4 个任务并记录当天起点快照
  const day = qDay();
  let d = S.qd;
  if (d && d.day === day && Array.isArray(d.ids) && d.ids.length && d.base && d.tg && d.rw && d.claimed) {
    for (const id of d.ids) if (!d.claimed[id] && d.rw[id]) d.rw[id].d = QD_DIAM;   // 今天已经抽好的任务也按新钻石数发放
    return d;
  }
  const p = ps(), rnd = qRng('malaya|' + day), lv = S.lv;
  const pool = QD_POOL.filter(q => !q.need || q.need());
  for (let i = pool.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const ids = pool.slice(0, QD_N).map(q => q.id), base = {}, tg = {}, rw = {};
  for (const q of QD_POOL) base[q.id] = q.get(p);
  for (const id of ids) { const q = QD_BY[id]; tg[id] = q.tg(lv); rw[id] = Object.assign({ g: qR10(150 + lv * 20), d: QD_DIAM }, q.x); }
  d = S.qd = { day, ids, base, tg, rw, claimed: {}, bonus: 0 };
  save();
  return d;
}
function qdList() {
  const d = qdInit(), p = ps();
  return d.ids.map(id => {
    const q = QD_BY[id], t = d.tg[id], v = Math.min(t, Math.max(0, q.get(p) - d.base[id]));
    return { q, id, t, v, ok: v >= t, got: !!d.claimed[id], rw: d.rw[id] };
  });
}
const qdBonusRw = () => ({ d: QD_BONUS_DIAM, g: qR10(600 + (S.qd ? S.qd.lv || S.lv : S.lv) * 60), s: 3, m: 10 });

// ---------- 成就 ----------
function qGear() { return [...S.inv, ...Object.values(S.eq || {}).filter(Boolean)]; }
function qAch() { if (!S.ach || typeof S.ach !== 'object') S.ach = {}; return S.ach; }
const qUniq = a => [...new Set(a)].sort((x, y) => x - y);
const QA = [
  { id: 'kill', n: '猎魔人', ic: '🗡️', tiers: [100, 500, 2000, 10000, 50000], d: t => '累计消灭 ' + psBig(t) + ' 只怪物', get: () => ps().kills },
  { id: 'boss', n: '弑王者', ic: '👑', tiers: [1, 10, 50, 200], d: t => '累计击败 ' + psBig(t) + ' 只 BOSS', get: () => ps().boss },
  { id: 'win', n: '常胜骑士', ic: '🏁', tiers: [1, 10, 50, 200, 1000], d: t => '赢得 ' + psBig(t) + ' 场战斗', get: () => ps().win },
  { id: 'stage', n: '征途不止', ic: '🗺️', tiers: () => qUniq([1, 3, 5, 8, NST].filter(x => x > 0 && x <= Math.max(1, NST))), d: t => '通关 ' + t + ' 个关卡', get: () => Math.min(S.cl, NST) },
  { id: 'star3', n: '完美主义', ic: '⭐', tiers: [1, 3, 5, 10], d: t => '获得 ' + t + ' 个关卡的三星评价', get: () => Object.values(S.stars || {}).filter(v => v >= 3).length },
  { id: 'lv', n: '成长之路', ic: '🆙', tiers: [10, 30, 60, 100, 200], d: t => '角色等级达到 Lv.' + t, get: () => S.lv },
  { id: 'crit', n: '致命一击', ic: '💥', tiers: [100, 1000, 10000, 50000], d: t => '累计打出 ' + psBig(t) + ' 次暴击', get: () => ps().crits },
  { id: 'maxhit', n: '一击必杀', ic: '🎯', tiers: [1000, 10000, 100000, 1000000], d: t => '单次伤害达到 ' + psBig(t), get: () => ps().maxHit },
  { id: 'dmg', n: '破坏之王', ic: '🔥', tiers: [1e5, 1e6, 1e7, 1e8, 1e9], d: t => '累计造成 ' + psBig(t) + ' 点伤害', get: () => ps().dmg },
  { id: 'hen', n: '变身达人', ic: '🔄', tiers: [10, 50, 200, 1000], d: t => '累计变身 ' + psBig(t) + ' 次', get: () => ps().hen },
  { id: 'cap', n: '胶囊收藏家', ic: '💊', tiers: () => qUniq([1, 2, CAPSULES.length]), d: t => '收集 ' + t + ' 枚变身胶囊', get: () => S.caps.length },
  { id: 'gold', n: '富可敌国', ic: '💰', tiers: [1e4, 1e5, 1e6, 1e7], d: t => '累计获得 ' + psBig(t) + ' 金币', get: () => ps().gE },
  { id: 'gear', n: '神装在身', ic: '🛡️', tiers: [2, 3, 4, 5], d: t => '拥有「' + TIERS[t].n + '」品质装备', get: () => qGear().reduce((m, it) => Math.max(m, it.tier | 0), -1), f: v => v < 0 ? '无' : TIERS[v].n },
  { id: 'enh', n: '强化大师', ic: '🔨', tiers: [3, 6, 10, 15], d: t => '将一件装备强化到 +' + t, get: () => qGear().reduce((m, it) => Math.max(m, it.lvl | 0), 0) },
  { id: 'star', n: '星耀之躯', ic: '🌟', tiers: [1, 3, 5], d: t => '将一件装备升到 ' + t + ' 星', get: () => qGear().reduce((m, it) => Math.max(m, it.star | 0), 0) },
  { id: 'affix', n: '词条猎人', ic: '◆', tiers: [1, 5, 15, 40], d: t => '拥有 ' + t + ' 条完美词条（品质 ≥ 90%）', get: () => qGear().reduce((s, it) => s + affixPerfect(it), 0) },
  { id: 'reroll', n: '重铸匠', ic: '♻️', tiers: [1, 10, 50], d: t => '重铸装备词条 ' + t + ' 次', get: () => ps().rr },
  { id: 'power', n: '战力飙升', ic: '⚡', tiers: [1000, 5000, 20000, 100000, 500000], d: t => '战力达到 ' + psBig(t), get: () => calcCP() },
  { id: 'time', n: '骑士之魂', ic: '⏱️', tiers: [1, 5, 24, 100], d: t => '累计游戏 ' + t + ' 小时', get: () => ps().pt / 3600, f: v => v.toFixed(1) },
  { id: 'daily', n: '每日勤勉', ic: '📋', tiers: [1, 7, 30, 100], d: t => '累计 ' + t + ' 天完成全部每日任务', get: () => (S.qs && S.qs.days) | 0 }
];
const qaTiers = a => typeof a.tiers === 'function' ? a.tiers() : a.tiers;
function qaState(a) {
  const ts = qaTiers(a), c = Math.min(qAch()[a.id] | 0, ts.length), v = a.get(), done = c >= ts.length, t = done ? ts[ts.length - 1] : ts[c];
  return { a, ts, c, v, t, done, ok: !done && v >= t, rw: QRW[Math.min(c, QRW.length - 1)] };
}
const qaPoints = () => QA.reduce((s, a) => s + Math.min(qAch()[a.id] | 0, qaTiers(a).length), 0);

// ---------- 奖励 / 领取 ----------
function qApply(r) { S.g += r.g || 0; S.d += r.d || 0; S.scr = (S.scr || 0) + (r.s || 0); S.mat += r.m || 0; }
function qRwList(r) { const a = []; if (r.d) a.push(['💠 ' + r.d, '#7df9ff']); if (r.g) a.push(['💰 ' + psBig(r.g), '#ffd84a']); if (r.s) a.push(['📜 ' + r.s, '#ffa502']); if (r.m) a.push(['💎 ' + r.m, '#c79bff']); return a; }
const qRwText = r => qRwList(r).map(x => x[0]).join('  ');
function qSum(a, b) { for (const k in b) a[k] = (a[k] || 0) + b[k]; return a; }

function qdClaim(id, sum) {
  const d = qdInit(), x = qdList().find(o => o.id === id);
  if (!x || !x.ok || x.got) return false;
  d.claimed[id] = 1; qApply(x.rw); if (sum) qSum(sum, x.rw);
  return true;
}
function qdBonusReady() { const d = qdInit(); return !d.bonus && qdList().every(o => o.got); }
function qdClaimBonus(sum) {
  if (!qdBonusReady()) return false;
  const d = qdInit(), r = qdBonusRw();
  d.bonus = 1; qApply(r); if (sum) qSum(sum, r);
  const qs = S.qs && typeof S.qs === 'object' ? S.qs : (S.qs = { days: 0 });
  qs.days = (qs.days | 0) + 1;
  return true;
}
function qaClaim(id, sum) {
  const a = QA.find(o => o.id === id); if (!a) return false;
  const st = qaState(a); if (!st.ok) return false;
  qAch()[id] = st.c + 1; qApply(st.rw); if (sum) qSum(sum, st.rw);
  return true;
}
function qClaimOne(fn) {
  const sum = {}; if (!fn(sum)) return;
  save(); qScan(); questToast('🎁 获得 ' + qRwText(sum), '#7dff9a');
}
function qClaimAll() {
  const sum = {}; let n = 0;
  for (const x of qdList()) if (qdClaim(x.id, sum)) n++;
  if (qdClaimBonus(sum)) n++;
  for (const a of QA) while (qaClaim(a.id, sum)) n++;
  if (!n) { questToast('没有可领取的奖励', '#ffa502'); return; }
  save(); qScan(); questToast('🎁 已领取 ' + n + ' 项奖励： ' + qRwText(sum), '#7dff9a');
}

// ---------- 每帧：日期刷新 / 进度扫描 / 提示 ----------
function questToast(s, c) { QST.toast.push({ s, c: c || '#7dff9a', t: 3.6 }); if (QST.toast.length > 4) QST.toast.shift(); }
function qScan() {
  const d = qdInit(), first = !QST.seen; if (first) QST.seen = new Set();
  const list = qdList(), mark = (k, msg, col) => { if (!QST.seen.has(k)) { QST.seen.add(k); if (!first) questToast(msg, col); } };
  let pd = 0, pa = 0;
  for (const x of list) if (x.ok && !x.got) { pd++; mark('d:' + d.day + ':' + x.id, '📋 每日任务完成：' + x.q.n, '#7dff9a'); }
  if (!d.bonus && list.every(o => o.got)) { pd++; mark('b:' + d.day, '🎁 今日任务全部完成，可领取全勤奖励！', '#ffd84a'); }
  for (const a of QA) { const s = qaState(a); if (s.ok) { pa++; mark('a:' + a.id + ':' + s.c, '🏆 成就达成：' + a.n + ' ' + QROM[s.c], '#ffd84a'); } }
  QST.pendD = pd; QST.pendA = pa; QST.pend = pd + pa;
  if (typeof wkSync === 'function') wkSync();   // 周榜跨周结转（power.js）
  if (typeof ttScan === 'function') ttScan();   // 新称号提示（titles.js）
}
function questTick(dt) {
  if (G === 'title' || G === 'load') return;
  for (const t of QST.toast) t.t -= dt;
  QST.toast = QST.toast.filter(t => t.t > 0);
  QST.tickT -= dt; if (QST.tickT > 0) return;
  QST.tickT = .5;
  try { qScan(); } catch (e) { console.warn('[Quest] 扫描出错', e); }
}

// ---------- 入口 / 按键 / 点击 ----------
function questOpen() {
  if (G === 'play' && typeof coopBattleOn === 'function' && coopBattleOn()) { DT.push({ x: P.x, y: P.y - 180, s: '联机战斗中无法暂停查看任务', t: 1.2, c: '#ffd84a' }); return; }
  QST.tab = 0; QST.page = 0; showQuest = true;
  try { qScan(); } catch (e) { }
}
const questBtnHit = (px, py) => px >= QB.x && px <= QB.x + QB.w && py >= QB.y && py <= QB.y + QB.h;
function questKeys() {
  const eat = (...ks) => ks.forEach(k => delete PR[k]), np = Math.ceil(QA.length / QA_PER);
  if (PR.Escape) { showQuest = false; eat('Escape'); return; }
  if (PR.KeyA || PR.ArrowLeft || PR.KeyD || PR.ArrowRight) { QST.tab = QST.tab ? 0 : 1; QST.page = 0; eat('KeyA', 'ArrowLeft', 'KeyD', 'ArrowRight'); }
  if (PR.KeyW || PR.ArrowUp) { QST.page = (QST.page - 1 + np) % np; eat('KeyW', 'ArrowUp'); }
  if (PR.KeyS || PR.ArrowDown) { QST.page = (QST.page + 1) % np; eat('KeyS', 'ArrowDown'); }
  if (PR.Enter || PR.Space || PR.KeyF) { qClaimAll(); eat('Enter', 'Space', 'KeyF'); }
}
function questClick(x, y) {
  for (let i = QST.hit.length - 1; i >= 0; i--) { const r = QST.hit[i]; if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { r.fn(); return; } }
  const b = PS_PANEL;
  if (x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) showQuest = false;
}

// ---------- 绘制 ----------
function drawQuestBtn(x, y) {   // 血条旁的小按钮（战力胶囊右边），有可领取奖励时显示红点数字
  const w = 54, h = 22, n = QST.pend | 0;
  hudPanel(x, y, w, h, UIC.gold, 6);
  ut('任务', x + w / 2, y + 11.5, 11, UIC.hi, 'center', { w: 700, sh: 0 });
  if (n > 0) {
    ctx.save(); ctx.beginPath(); ctx.arc(x + w - 3, y + 3, 7.5, 0, 7); ctx.fillStyle = '#ff4757'; ctx.fill(); ctx.restore();
    ut(n > 9 ? '9+' : String(n), x + w - 3, y + 3.5, 8.5, '#fff', 'center', { w: 700, sh: 0 });
  }
  Object.assign(QB, { x, y, w, h });
}
// 奖励提示条（领取任务 / 成就奖励后顶部弹出）
// 文本约定不变：questToast('🎁 已领取 3 项奖励： 💠 100  💰 390 …')
//   🎁 → 矢量礼盒图标；💠 钻石 / 💰 🪙 金币 / 📜 卷轴 / 💎 碎晶 → 对应 Assets/Icon 里的贴图（ICO.d / ICO.g / ICO.scr / ICO.mat），
//   每个奖励做成一枚“胶囊”；贴图没载入到时退回 emoji。
// 修复：旧版正则里写成了 '\\s'（字面反斜杠），而且 💠💰 这类 emoji 是 2 个 UTF-16 单元，charAt(0) 取不到 → 图标永远走不到，全部退化成文字 emoji。
const QT_ICON = {
  '💠': { k: 'd',   col: '#7df9ff' },   // 钻石
  '💰': { k: 'g',   col: '#ffd84a' },   // 金币
  '🪙': { k: 'g',   col: '#ffd84a' },
  '📜': { k: 'scr', col: '#ffa502' },   // 强化卷轴
  '💎': { k: 'mat', col: '#c79bff' }    // 强化碎晶
};
const QT_RE = /(💠|💰|🪙|📜|💎)\s*([\d.,]+(?:\s?[万亿])?)/gu;
function qtParse(str) {   // → { head, gift, items:[{ch,val}] }
  str = String(str); const items = []; let first = -1, m;
  QT_RE.lastIndex = 0;
  while ((m = QT_RE.exec(str))) { if (first < 0) first = m.index; items.push({ ch: m[1], val: m[2].replace(/\s+/g, ' ') }); }
  let head = (first < 0 ? str : str.slice(0, first)).trim();
  const gift = head.startsWith('🎁'); if (gift) head = head.slice(2).trim();
  return { head, gift, items };
}
function qtGift(cx, cy, s, col) {   // 矢量礼盒（s = 边长）
  ctx.save(); ctx.translate(cx, cy);
  const w = s, h = s * .78, top = -h / 2 + s * .12;
  rpath(-w / 2, top, w, h - s * .12, 2); ctx.fillStyle = col + '33'; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.3; ctx.stroke();      // 盒身
  rpath(-w / 2 - 1, top - s * .2, w + 2, s * .24, 2); ctx.fillStyle = col + '66'; ctx.fill(); ctx.stroke();                                         // 盒盖
  ctx.fillStyle = col; ctx.fillRect(-1, top - s * .2, 2, h + s * .1);                                                                               // 竖丝带
  ctx.beginPath(); ctx.ellipse(-s * .17, top - s * .3, s * .17, s * .12, -.5, 0, 7); ctx.ellipse(s * .17, top - s * .3, s * .17, s * .12, .5, 0, 7); ctx.stroke();   // 蝴蝶结
  ctx.restore();
}
function drawQuestToast() {
  if (!QST.toast.length) return;
  const ih = 17, H = 30, FS = 13, DUR = 3.6;
  ctx.save();
  QST.toast.forEach((t, i) => {
    const { head, gift, items } = qtParse(t.s), age = DUR - t.t;
    // 先量宽度
    const gw = gift ? 18 : 0, hw = head ? uw(head, FS, 700) : 0;
    const chips = items.map(it => {
      const cfg = QT_ICON[it.ch], ic = ICO[cfg.k], iw = ic ? icoW(ic, ih) : 15, vw = uw(it.val, FS + .5, 800);
      return { cfg, ic, iw, vw, w: 8 + iw + 5 + vw + 10, val: it.val, ch: it.ch };
    });
    const cw = chips.reduce((s, c) => s + c.w, 0) + Math.max(0, chips.length - 1) * 6;
    const sep = chips.length && (gift || head) ? 12 : 0;
    const inner = gw + (gw && hw ? 7 : 0) + hw + sep + cw, w = inner + 30;
    // 入场：下滑 + 轻微放大；退场：淡出
    const ein = cl(age / .28, 0, 1), eo = 1 - (1 - ein) * (1 - ein), alpha = cl(Math.min(ein * 1.4, t.t / .45), 0, 1);
    const x = 480 - w / 2, y = 96 + i * (H + 8) - (1 - eo) * 14;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(480, y + H / 2); const sc = .94 + .06 * eo; ctx.scale(sc, sc); ctx.translate(-480, -(y + H / 2));
    // 底框：深色渐变 + 发光描边
    ctx.save();
    ctx.shadowColor = t.c; ctx.shadowBlur = 14 * alpha;
    rpath(x, y, w, H, 10);
    const bg = ctx.createLinearGradient(x, y, x, y + H); bg.addColorStop(0, 'rgba(16,22,38,.96)'); bg.addColorStop(1, 'rgba(6,9,18,.96)');
    ctx.fillStyle = bg; ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = t.c; ctx.globalAlpha = alpha * .85; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
    // 入场扫光
    if (age > .08 && age < .75) {
      ctx.save(); rpath(x, y, w, H, 10); ctx.clip();
      const k = (age - .08) / .67, bx = x - 60 + (w + 120) * k, g = ctx.createLinearGradient(bx - 30, 0, bx + 30, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(bx - 30, y, 60, H); ctx.restore();
    }
    // 内容
    const cy = y + H / 2 + .5;
    let cx = x + (w - inner) / 2;
    if (gift) { qtGift(cx + gw / 2, cy, 13, t.c); cx += gw + (hw ? 7 : 0); }
    if (head) { ut(head, cx, cy, FS, '#e8f4ff', 'left', { w: 700 }); cx += hw; }
    cx += sep;
    for (const c of chips) {
      // 胶囊底
      rpath(cx, cy - 11, c.w, 22, 11); ctx.fillStyle = c.cfg.col + '24'; ctx.fill();
      ctx.strokeStyle = c.cfg.col + '88'; ctx.lineWidth = 1; ctx.stroke();
      const icx = cx + 8 + c.iw / 2;
      if (c.ic) {   // 图标背后一点柔光，让贴图在深底上更跳
        const gr = ctx.createRadialGradient(icx, cy, 0, icx, cy, ih * .8); gr.addColorStop(0, c.cfg.col + '55'); gr.addColorStop(1, c.cfg.col + '00');
        ctx.fillStyle = gr; ctx.fillRect(icx - ih, cy - ih, ih * 2, ih * 2);
        drawIco(c.ic, icx, cy, ih);
      } else ut(c.ch, icx, cy, 13, c.cfg.col, 'center', { w: 700 });
      ut(c.val, cx + 8 + c.iw + 5, cy, FS + .5, c.cfg.col, 'left', { w: 800 });
      cx += c.w + 6;
    }
    ctx.restore();
  });
  ctx.restore();
}
function qBtn(x, y, w, h, label, col, on, fn) {
  rpath(x, y, w, h, 6); ctx.fillStyle = on ? col + '33' : 'rgba(255,255,255,.05)'; ctx.fill();
  ctx.strokeStyle = on ? col : 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.2; ctx.stroke();
  ut(label, x + w / 2, y + h / 2 + .5, 11.5, on ? '#fff' : '#7d8795', 'center', { w: 700 });
  if (fn) QST.hit.push({ x, y, w, h, fn });
}
function qBar(x, y, w, h, r, col) {
  rpath(x, y, w, h, h / 2); ctx.fillStyle = 'rgba(255,255,255,.09)'; ctx.fill();
  if (r > 0) { rpath(x, y, Math.max(h, w * cl(r, 0, 1)), h, h / 2); ctx.fillStyle = col; ctx.fill(); }
}
function qRowBg(x, y, w, h, col) {
  rpath(x, y, w, h, 8); ctx.fillStyle = 'rgba(255,255,255,.045)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1; ctx.stroke();
  rpath(x, y + 8, 3, h - 16, 1.5); ctx.fillStyle = col; ctx.fill();
}
// ---- 任务界面新版：固定列宽、文字自动收缩，保证任何内容都不会互相重叠 ----
const QD_IC = { kill: '⚔️', boss: '👑', win: '🏁', hen: '🔄', crit: '💥', dmg: '🔥', up: '🔨', dis: '♻️', gold: '💰', form: '⚡' };
const QRW_DEF = [['d', '💠', '#7df9ff'], ['g', '💰', '#ffd84a'], ['s', '📜', '#ffa502'], ['m', '💎', '#c79bff']];
function qFit(s, x, y, maxW, sz, col, w = 600, al = 'left') {   // 超宽就等比缩小字号
  const k = uw(s, sz, w); ut(s, x, y, k > maxW ? Math.max(8, sz * maxW / k) : sz, col, al, { w, sh: 0 });
}
function qRwIco(k) { return k === 'd' ? ICO.d : k === 'g' ? ICO.g : k === 's' ? ICO.scr : ICO.mat }
// 奖励：两列网格（最多 2 行），在 [x, x+w] 范围内垂直居中于 cy
function qRwGrid(x, cy, w, r) {
  const items = QRW_DEF.filter(d => r[d[0]]), cw = w / 2, rows = Math.ceil(items.length / 2), gap = 17;
  items.forEach((d, i) => {
    const ix = x + (i % 2) * cw, iy = cy + (((i / 2) | 0) - (rows - 1) / 2) * gap;
    if (!fitIco(qRwIco(d[0]), ix + 8, iy, 15)) ut(d[1], ix + 8, iy, 12, '#fff', 'center', { sh: 0 });
    qFit(psBig(r[d[0]]), ix + 20, iy, cw - 24, 12, d[2], 700);
  });
}
function qCard(x, y, w, h, st, col) {   // st: 'ready' 可领取 / 'done' 已完成 / 'todo' 进行中
  const pu = .5 + .5 * Math.sin(performance.now() / 1000 * 4);
  rpath(x, y, w, h, 10);
  if (st === 'ready') {
    const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, 'rgba(125,255,154,.17)'); g.addColorStop(1, 'rgba(125,255,154,.04)');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(125,255,154,' + (.4 + .35 * pu) + ')'; ctx.lineWidth = 1.4; ctx.stroke();
  } else if (st === 'done') {
    ctx.fillStyle = 'rgba(255,255,255,.025)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1; ctx.stroke();
  } else {
    const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, 'rgba(255,255,255,.07)'); g.addColorStop(1, 'rgba(255,255,255,.03)');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.lineWidth = 1; ctx.stroke();
  }
  rpath(x, y + 10, 3, h - 20, 1.5); ctx.fillStyle = col; ctx.fill();
}
function qIcoBox(x, y, s, ic) {
  rpath(x, y, s, s, 9); ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 1; ctx.stroke();
  ut(ic, x + s / 2, y + s / 2 + 1, s * .5, '#fff', 'center', { sh: 0 });
}
function qClaimBtn(x, y, w, h, label, st, col, fn) {   // st: 'ready' / 'done' / 'idle'
  const pu = .5 + .5 * Math.sin(performance.now() / 1000 * 4);
  rpath(x, y, w, h, 7);
  if (st === 'ready') {
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, col); g.addColorStop(1, col + 'aa');
    ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 6 + pu * 8; ctx.fillStyle = g; ctx.fill(); ctx.restore();
    ut(label, x + w / 2, y + h / 2 + .5, 12.5, '#0b1220', 'center', { w: 800, sh: 0 });
    QST.hit.push({ x, y, w, h, fn });
  } else {
    ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1; ctx.stroke();
    ut(label, x + w / 2, y + h / 2 + .5, 11.5, st === 'done' ? '#8fa0b3' : '#6f7a8c', 'center', { w: 600, sh: 0 });
  }
}

function drawQuestModal() {
  const b = PS_PANEL, acc = '#7dff9a';
  QST.hit = [];
  if (QST.tab > 1) QST.tab = 0;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.66)'; ctx.fillRect(0, 0, 960, 540);
  hudPanel(b.x, b.y, b.w, b.h, acc, 18);

  // ---- 头部 ----
  ut('任务 · 成就', b.x + 28, b.y + 34, 20, UIC.hi, 'left', { w: 700 });
  ut('DAILY QUESTS & ACHIEVEMENTS', b.x + 28, b.y + 58, 10.5, acc, 'left', { w: 700, sp: 1.5, sh: 0 });
  qBtn(b.x + b.w - 76, b.y + 12, 64, 26, '✕ 关闭', '#ff4757', true, () => { showQuest = false; });
  qBtn(b.x + b.w - 76 - 8 - 112, b.y + 12, 112, 26, '一键领取' + (QST.pend ? '  ' + QST.pend : ''), '#ffd84a', QST.pend > 0, qClaimAll);
  const dv = ctx.createLinearGradient(b.x + 24, 0, b.x + b.w - 24, 0); dv.addColorStop(0, 'rgba(125,255,154,.55)'); dv.addColorStop(1, 'rgba(125,255,154,0)');
  ctx.fillStyle = dv; ctx.fillRect(b.x + 24, b.y + 66, b.w - 48, 1);

  // ---- 页签（只有 每日任务 / 成就）----
  const tabs = [['每日任务', QST.pendD], ['成就  ' + qaPoints() + ' 点', QST.pendA]];
  tabs.forEach((t, i) => {
    const x = b.x + 28 + i * 160, y = b.y + 76, on = QST.tab === i;
    rpath(x, y, 150, 30, 8); ctx.fillStyle = on ? 'rgba(125,255,154,.2)' : 'rgba(255,255,255,.05)'; ctx.fill();
    ctx.strokeStyle = on ? acc : 'rgba(255,255,255,.2)'; ctx.lineWidth = on ? 1.5 : 1.1; ctx.stroke();
    ut(t[0], x + 75, y + 15.5, 13, on ? '#fff' : UIC.sub, 'center', { w: 700 });
    if (t[1] > 0) { ctx.beginPath(); ctx.arc(x + 144, y + 5, 5, 0, 7); ctx.fillStyle = '#ff4757'; ctx.fill(); }
    QST.hit.push({ x, y, w: 150, h: 30, fn: () => { QST.tab = i; QST.page = 0; } });
  });

  const x0 = b.x + 20, w = b.w - 40, y0 = b.y + 118;
  if (QST.tab === 0) {
    const d = qdInit(), list = qdList(), rh = 60, pitch = 66, doneN = list.filter(o => o.got).length;
    ut('今日 ' + doneN + ' / ' + list.length + '   ·   距离刷新  ' + qHMS(qSecsLeft()), b.x + b.w - 28, b.y + 91, 11.5, UIC.sub, 'right', { w: 600, sh: 0 });
    const row = (y, st, col, ic, name, nameCol, desc, v, t, rw, btn) => {
      ctx.save(); if (st === 'done') ctx.globalAlpha = .62;
      qCard(x0, y, w, rh, st, col);
      qIcoBox(x0 + 14, y + 10, 40, ic);
      qFit(name, x0 + 66, y + 20, 196, 14.5, nameCol, 700);
      qFit(desc, x0 + 66, y + 42, 196, 10.5, UIC.sub, 500);
      qBar(x0 + 276, y + 17, 150, 9, t ? v / t : 0, st === 'ready' ? '#2ed573' : st === 'done' ? '#5d6b7c' : '#00b8d9');
      qFit(psBig(Math.floor(v)) + ' / ' + psBig(t), x0 + 351, y + 41, 150, 10.5, UIC.txt, 600, 'center');
      qRwGrid(x0 + 446, y + rh / 2, 156, rw);
      ctx.restore();
      qClaimBtn(x0 + w - 90, y + 15, 78, 30, btn.l, btn.s, btn.c, btn.fn);
    };
    list.forEach((o, i) => row(y0 + i * pitch, o.got ? 'done' : o.ok ? 'ready' : 'todo', o.got ? '#5d6b7c' : o.ok ? '#7dff9a' : '#00e5ff',
      QD_IC[o.id] || '📋', o.q.n, o.got ? UIC.sub : UIC.hi, o.q.d(o.t), o.v, o.t, o.rw,
      o.got ? { l: '✔ 已领取', s: 'done' } : o.ok ? { l: '领取', s: 'ready', c: '#7dff9a', fn: () => qClaimOne(s => qdClaim(o.id, s)) } : { l: '进行中', s: 'idle' }));
    const rdy = qdBonusReady();
    row(y0 + list.length * pitch + 2, d.bonus ? 'done' : rdy ? 'ready' : 'todo', '#ffd84a', '🎁', '全勤奖励', d.bonus ? UIC.sub : '#ffd84a',
      '领取全部 ' + list.length + ' 项任务奖励后解锁', doneN, list.length, qdBonusRw(),
      d.bonus ? { l: '✔ 已领取', s: 'done' } : rdy ? { l: '领取', s: 'ready', c: '#ffd84a', fn: () => qClaimOne(s => qdClaimBonus(s)) } : { l: '未完成', s: 'idle' });
  } else {
    const np = Math.ceil(QA.length / QA_PER), rh = 50, pitch = 54;
    QST.page = cl(QST.page, 0, np - 1);
    ut('已获得成就点数  ' + qaPoints(), b.x + b.w - 28, b.y + 91, 11.5, UIC.sub, 'right', { w: 600, sh: 0 });
    QA.slice(QST.page * QA_PER, QST.page * QA_PER + QA_PER).forEach((a, i) => {
      const st = qaState(a), y = y0 + i * pitch, fv = a.f || (v => psBig(Math.floor(v))), cs = st.done ? 'done' : st.ok ? 'ready' : 'todo';
      ctx.save(); if (st.done) ctx.globalAlpha = .75;
      qCard(x0, y, w, rh, cs, st.done ? '#ffd84a' : st.ok ? '#7dff9a' : '#00e5ff');
      qIcoBox(x0 + 12, y + 7, 36, a.ic);
      qFit(a.n, x0 + 58, y + 16, 110, 13.5, st.done ? '#ffd84a' : UIC.hi, 700);
      const nw = Math.min(110, uw(a.n, 13.5, 700)); let px = x0 + 58 + nw + 12;
      for (let k = 0; k < st.ts.length; k++, px += 11) { ctx.beginPath(); ctx.arc(px, y + 16, 3.6, 0, 7); ctx.fillStyle = k < st.c ? '#ffd84a' : 'rgba(255,255,255,.18)'; ctx.fill(); }
      qFit(st.done ? '全部档位已完成' : a.d(st.t), x0 + 58, y + 36, 226, 10.5, UIC.sub, 500);
      qBar(x0 + 298, y + 15, 136, 9, st.done ? 1 : st.v / st.t, st.done ? '#ffd84a' : st.ok ? '#2ed573' : '#00b8d9');
      qFit(st.done ? '已满' : fv(st.v) + ' / ' + (a.f ? a.f(st.t) : psBig(st.t)), x0 + 366, y + 37, 150, 10.5, UIC.txt, 600, 'center');
      if (!st.done) qRwGrid(x0 + 450, y + rh / 2, 156, st.rw);
      ctx.restore();
      if (st.done) qClaimBtn(x0 + w - 82, y + 10, 70, 30, '已完成', 'done');
      else if (st.ok) qClaimBtn(x0 + w - 82, y + 10, 70, 30, '领取', 'ready', '#7dff9a', () => qClaimOne(s => qaClaim(a.id, s)));
      else qClaimBtn(x0 + w - 82, y + 10, 70, 30, '进行中', 'idle');
    });
    const fy = b.y + b.h - 44;
    qBtn(b.x + b.w / 2 - 110, fy, 62, 24, '◀ 上页', '#7df9ff', true, () => { QST.page = (QST.page - 1 + np) % np; });
    ut('第 ' + (QST.page + 1) + ' / ' + np + ' 页', b.x + b.w / 2, fy + 12.5, 11.5, UIC.sub, 'center', { w: 600, sh: 0 });
    qBtn(b.x + b.w / 2 + 48, fy, 62, 24, '下页 ▶', '#7df9ff', true, () => { QST.page = (QST.page + 1) % np; });
  }
  ut('[Q] / Esc 关闭 · A / D 切换页签 · W / S 翻页 · Enter 一键领取 · 每日任务按本机日期 0 点刷新', 480, b.y + b.h - 11, 9.5, 'rgba(210,218,232,.5)', 'center', { w: 500, sh: 0 });
  ctx.restore();
}


// ===== 胶囊升星特效：卡面闪光 + 光环 + 火花 + 新亮起的星星 + 飘字 + 属性栏闪烁 =====
const CAPFX = { id: null, star: 0, t0: -9, ps: [] };
function capUpFx(id, star) {
  CAPFX.id = id; CAPFX.star = star; CAPFX.t0 = performance.now() / 1000;
  CAPFX.ps = Array.from({ length: 36 }, () => ({ a: Math.random() * 6.283, v: 80 + Math.random() * 170, l: .7 + Math.random() * .8, s: 2 + Math.random() * 3 }));
}
function drawCapUpFx() {
  const el = performance.now() / 1000 - CAPFX.t0, DUR = 1.9;
  if (!CAPFX.id || el < 0 || el > DUR || CAPFX.id !== curSelCapId) return;
  const L = CAPL, rx = 90 + 392, ry = 35 + 48, cx = rx + 14, cw = 370 - 28, mx = cx + cw / 2, my = ry + L.cardY + L.cardH / 2;
  const MAXS = typeof CAP_STAR_MAX !== 'undefined' ? CAP_STAR_MAX : 5, c = (CAPSULES.find(k => k.id === CAPFX.id) || {}).c || '#ffd84a';
  ctx.save();
  // 卡面闪光
  if (el < .55) { ctx.save(); bevel(cx, ry + L.cardY, cw, L.cardH, 9); ctx.clip(); const g = ctx.createRadialGradient(mx, my, 4, mx, my, 190); g.addColorStop(0, 'rgba(255,240,170,' + (1 - el / .55) * .85 + ')'); g.addColorStop(1, 'rgba(255,200,60,0)'); ctx.fillStyle = g; ctx.fillRect(cx, ry + L.cardY, cw, L.cardH); ctx.restore(); }
  // 扩散光环
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 2; i++) { const e2 = el - i * .18; if (e2 <= 0) continue; ctx.globalAlpha = Math.max(0, 1 - e2 / 1.0) * .9; ctx.lineWidth = 3 - i; ctx.strokeStyle = i ? c : '#ffe27a'; ctx.beginPath(); ctx.arc(mx, my, 14 + e2 * 240, 0, 7); ctx.stroke(); }
  // 火花
  for (const p of CAPFX.ps) { if (el > p.l) continue; const x = mx + Math.cos(p.a) * p.v * el, y = my + Math.sin(p.a) * p.v * el + 90 * el * el; ctx.globalAlpha = 1 - el / p.l; ctx.fillStyle = '#ffe27a'; ctx.fillRect(x - p.s / 2, y - p.s / 2, p.s, p.s); }
  ctx.globalCompositeOperation = 'source-over';
  // 新亮起的那颗星：放大 + 光晕
  const idx = Math.min(MAXS, CAPFX.star) - 1, sx = (cx + cw - 8) - (MAXS - 1 - idx) * 17, sy = ry + L.titleY;
  const pop = Math.max(0, .9 - el * 1.6);
  ctx.globalAlpha = Math.max(0, 1 - el / 1.3); const gg = ctx.createRadialGradient(sx, sy, 1, sx, sy, 22); gg.addColorStop(0, 'rgba(255,230,120,.9)'); gg.addColorStop(1, 'rgba(255,200,60,0)'); ctx.fillStyle = gg; ctx.fillRect(sx - 24, sy - 24, 48, 48);
  ctx.globalAlpha = 1; starShape(sx, sy, 6.5 * (1 + pop * 1.4), true);
  // 属性栏绿色闪烁
  ctx.globalAlpha = Math.max(0, 1 - el / DUR) * (.45 + .55 * Math.abs(Math.sin(el * 9))); ctx.lineWidth = 2; ctx.strokeStyle = '#7dff9a'; ctx.strokeRect(cx, ry + L.p1Y, cw, L.pH);
  // 飘字
  const fa = el < .15 ? el / .15 : el > DUR - .6 ? (DUR - el) / .6 : 1; ctx.globalAlpha = Math.max(0, fa);
  txt('★ 升至 ' + CAPFX.star + ' 星！', mx, my - 8 - Math.min(el, .8) * 26, 22, '#ffe27a', 'center');
  if (typeof capStarBonusText === 'function') txt(capStarBonusText(CAPFX.id), mx, my + 20 - Math.min(el, .8) * 26, 12.5, '#c9ffd2', 'center');
  ctx.restore();
}


// ===== 右下角“已备份”灰色小字（云存档成功后淡出，取代原来的飘字）=====
let cloudHintAt = -1e9;
function cloudHintShow() { cloudHintAt = performance.now(); }
function drawCloudHint() {
  const el = (performance.now() - cloudHintAt) / 1000, DUR = 2.6;
  if (el < 0 || el > DUR) return;
  const a = el < .25 ? el / .25 : el > DUR - .8 ? (DUR - el) / .8 : 1;
  ctx.save(); ctx.globalAlpha = a * .5;
  txt('已备份', 950, 528, 11, '#aeb6c2', 'right', false);
  ctx.restore();
}
