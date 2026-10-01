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
const ICO = { g: null, d: null };
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
function curParse(s, go) { const m = /^(🪙|💰|💎) ?/.exec(s); if (!m || (go && m[1] === '💎')) return null; const ic = m[1] === '💎' ? ICO.d : ICO.g; return ic ? { ic, rest: s.slice(m[0].length) } : null }
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
    const dS = '💎 ' + fmtN(S.d), mS = '◆碎晶 ' + fmtN(S.mat), cS = '📜 ' + fmtN(S.scr || 0);
    curT(dS, ex, ly + 60, 12, '#7fe9ff', 'left', txt); ex += curW(dS, 12) + 16;
    txt(mS, ex, ly + 60, 12, '#c58bff'); ex += bagTw(mS, 12) + 16;
    txt(cS, ex, ly + 60, 12, '#ffa502');
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
    txt(SLOT_ICON[sl.k] || '', sx + (sl.col ? SW - 20 : SW - 14), sy + 13, 12, '#fff', 'center', false);
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
  txt('攻击 ' + (P.atk | 0), lx + 22, py0 + 42, 13, '#ff9f9f');
  txt('暴击 ' + Math.round(P.cr * 100) + '%', lx + 122, py0 + 42, 13, '#ffeaa7');
  txt('免伤 ' + (P.def * 100).toFixed(1) + '%', lx + 222, py0 + 42, 13, '#7dff9a');
  txt('生命 ' + P.mh, lx + 22, py0 + 70, 13, '#55efc4');
  txt('魔力 ' + P.mm, lx + 122, py0 + 70, 13, '#74b9ff');

  // ================= 右侧：列表视图 / 详情视图 =================
  const rx = x + 358, ry = y + 46, rw = 534, rh = 440;
  techPanel(rx, ry, rw, rh, 'rgba(0,229,255,.4)', 12);
  if (!bagMulti && selItem && selItem.item) drawBagDetail(rx, ry, rw); else drawBagList(rx, ry, rw);
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
      txt(SLOT_ICON[it.slot] || '', cx + gw - 16, cy + gh - 16, 15, '#fff', 'center', false);
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
  txt(SLOT_ICON[it.slot] || '', X + 30, ty + 31, 28, '#fff', 'center', false);

  let nsz = 20; while (nsz > 12 && bagTw(it.name, nsz) > 250) nsz--;
  txt(it.name, X + 74, ty + 14, nsz, tier.c);
  if (it.lvl) txt('+' + it.lvl, X + 74 + bagTw(it.name, nsz) + 8, ty + 14, 17, '#ffa502');
  for (let i = 0; i < MAX_STAR; i++) starShape(X + IW - 12 - (MAX_STAR - 1 - i) * 22, ty + 14, 9, i < star);

  let bx = X + 74; const by = ty + 38;
  bx += badge(bx, by, tier.n, tier.c, tier.bg) + 6;
  bx += badge(bx, by, slotInfo.n, '#cfd8e3', 'rgba(255,255,255,.08)') + 6;
  if (isWorn) bx += badge(bx, by, '穿戴中', '#2ed573', 'rgba(46,213,115,.16)') + 6;
  chipFit(bx, by, 22, '需求 Lv.' + reqLvl, canWear, 12);

  // —— 左卡：属性对比 ——
  const cy = ry + 122, lcw = 240, RX = X + lcw + 8, rcw = IW - lcw - 8, CH = 168;
  dPanel(X, cy, lcw, CH, '属性', isWorn ? '当前穿戴' : (currEq ? '对比 · ' + currEq.name : '该槽位空置'), '#00e5ff');
  const oldStats = (currEq && currEq.stats) ? currEq.stats : {};
  const rows = [['攻击力', 'atk', '#ff9f9f'], ['生命值', 'hp', '#7dffd0'], ['魔力值', 'mp', '#8ec5ff'], ['暴击率', 'crit', '#ffe08a', 1], ['免伤值', 'def', '#9dffb8']]
    .filter(r => (it.stats[r[1]] || 0) || (oldStats[r[1]] || 0));
  if (!rows.length) txt('无属性加成', X + lcw / 2, cy + 90, 13, '#5d6b7c', 'center');
  const rh = Math.min(28, 126 / Math.max(1, rows.length));
  rows.forEach((r, i) => {
    const yy = cy + 34 + rh * (i + .5), nv = it.stats[r[1]] || 0, ov = oldStats[r[1]] || 0, pc = !!r[3];
    const show = v => pc ? Math.round(v * 100) + '%' : Math.round(v).toLocaleString();
    if (i) { ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(X + 10, cy + 34 + rh * i, lcw - 20, 1) }
    txt(r[0], X + 12, yy, 12.5, r[2], 'left', false);
    txt(show(nv), X + 74, yy, 17, '#fff');
    if (!isWorn) {
      const d = nv - ov;
      if (d !== 0) {
        const up = d > 0, s = (up ? '▲ ' : '▼ ') + show(Math.abs(d)), w = bagTw(s, 12) + 14, px = X + lcw - 10 - w;
        rpath(px, yy - 10, w, 20, 5); ctx.fillStyle = up ? 'rgba(46,213,115,.16)' : 'rgba(255,71,87,.16)'; ctx.fill();
        txt(s, px + w / 2, yy, 12, up ? '#2ed573' : '#ff6b81', 'center', false);
      } else txt('＝', X + lcw - 18, yy, 14, '#778', 'center', false);
    }
  });

  // —— 右上卡：强化（按钮就在卡片里）——
  dPanel(RX, cy, rcw, 80, '🔨 强化  +' + it.lvl + ' → +' + (it.lvl + 1), '', '#ffa502');
  actBtn(RX + rcw - 76, cy + 4, 68, 26, '强化 +1', '#ff9f43', canUp, 12, () => upgradeItem(it));
  txt('每级 +8% 基础属性', RX + 12, cy + 38, 11, '#8fa0b3', 'left', false);
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
    txt('每星 全属性 +15%', RX + 12, sy + 38, 11, '#8fa0b3', 'left', false);
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
      txt(sym, iconX + iconSize / 2, iconY + iconSize / 2, 18, isOwned ? '#ffffff' : '#6f7a8c', 'center');

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
    // ★ 统一右侧所有元素对齐基线：左侧 cx，宽度统一为 cw，右边界为 cx + cw
    const cx = rx + 12, cw = rw - 24;

    // 1. 胶囊卡面全息展示框（高度收至 138px，留出舒适纵向呼吸间距）
    const cardH = 138;
    bevel(cx, ry + 12, cw, cardH, 9);
    ctx.fillStyle = 'rgba(8, 12, 26, 0.95)'; ctx.fill();

    const cg = ctx.createLinearGradient(cx, ry + 12, cx, ry + 12 + cardH);
    cg.addColorStop(0, selCap.c + '38');
    cg.addColorStop(1, 'rgba(5, 10, 20, 0)');
    ctx.fillStyle = cg; ctx.fill();

    ctx.save();
    ctx.shadowColor = isCapEquipped ? '#2ed573' : selCap.c;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = isCapEquipped ? '#2ed573' : (isCapOwned ? selCap.c : 'rgba(255, 255, 255, 0.15)');
    ctx.stroke();
    ctx.restore();

    // 绘制卡面图像（带切角剪裁）
    if (CAP_IMGS[selCap.id]) {
      ctx.save();
      bevel(cx + 2, ry + 14, cw - 4, cardH - 4, 7);
      ctx.clip();
      drawArt(CAP_IMGS[selCap.id], cx + 2, ry + 14, cw - 4, cardH - 4);
      ctx.restore();
    } else {
      ctx.save();
      const midX = cx + cw / 2, midY = ry + 12 + cardH / 2;
      ctx.beginPath(); ctx.arc(midX, midY, 36, 0, Math.PI * 2);
      ctx.fillStyle = isCapOwned ? `${selCap.c}28` : 'rgba(30, 36, 50, 0.5)'; ctx.fill();
      ctx.strokeStyle = isCapOwned ? selCap.c : '#666'; ctx.lineWidth = 2; ctx.stroke();
      txt(selCap.rider, midX, midY - 6, 14, isCapOwned ? '#fff' : '#777', 'center');
      txt(selCap.tag, midX, midY + 12, 11, isCapOwned ? selCap.c : '#555', 'center');
      ctx.restore();
    }

    // 展示框内左右角标（内边距严格 8px 对称）
    badge(cx + 8, ry + 20, TIERS[selCap.tier].n + '契约级', TIERS[selCap.tier].c, TIERS[selCap.tier].bg);
    const tagW0 = bagTw(selCap.tag, 11) + 16;
    badge(cx + cw - 8 - tagW0, ry + 20, selCap.tag, '#7df9ff', 'rgba(0, 229, 255, 0.18)');

    // 2. 骑士名称与星级横栏（垂直精确居中于展示框底与装配按钮之间，间距各 13px）
    const titleY = ry + 172;
    // 左对齐：紧贴 cx 基准线
    txt(selCap.name, cx, titleY, 15, selCap.c);
    txt('· ' + selCap.rider, cx + bagTw(selCap.name, 15) + 6, titleY, 12, '#ffd84a');

    // 右对齐：5 颗星徽的最右端严格贴合 cx + cw
    for (let s = 0; s < 5; s++) {
      const starX = (cx + cw - 6) - (4 - s) * 15;
      starShape(starX, titleY, 5.5, true);
    }

    // 3. 一键装配/卸下大按钮（Y 保持在 ry + 192，高度 36，宽度与上下严格对齐）
    const actBtnY = ry + 192, actBtnH = 36;
    if (!isCapOwned) {
      actBtn(cx, actBtnY, cw, actBtnH, '🔒 尚未拥有此胶囊（可前往扭蛋终端抽取）', '#2a3140', false, 12);
    } else if (isCapEquipped) {
      actBtn(cx, actBtnY, cw, actBtnH, '✔ 当前已装配 [点击卸下契约]', '#2e86de', true, 13);
    } else {
      actBtn(cx, actBtnY, cw, actBtnH, '⚡ 立即装配该变身胶囊', '#2ed573', true, 13.5);
    }

    // 4. 属性加成与必杀技参数卡片（文字避开 30px 标题栏，行距均匀）
    // 卡片 1：契约属性强化 (高 66px)
    const p1Y = ry + 238, p1H = 66;
    dPanel(cx, p1Y, cw, p1H, '契约战力加成', 'FORM BUFF', '#00e5ff');
    txt('• 属性提升: ' + selCap.buff, cx + 14, p1Y + 37, 11.5, '#ffd84a');
    txt('• 核心特性: ' + (selCap.trait || '专属形态动作模组与独立变身音效'), cx + 14, p1Y + 54, 11, '#e6ebf5');

    // 卡片 2：技能与必杀战术 (高 88px)
    const p2Y = ry + 314, p2H = 88;
    dPanel(cx, p2Y, cw, p2H, '形态技能与战术', 'SKILLS & TACTIC', '#ffa502');
    txt('• 战术技能: ' + selCap.skill, cx + 14, p2Y + 36, 11, '#7df9ff');
    fitTxt('• 终结必杀: ' + selCap.finisher, cx + 14, p2Y + 54, cw - 28, 11, '#ff7675');
    txt('★ 战术提示: 战斗中按「变身」键变身/解除', cx + 14, p2Y + 72, 10.5, '#7dff9a');
  }

  ctx.restore();
}

// ===== 抽卡与常规功能菜单（铁匠铺与天赋解除10级上限，强化百分比更新） =====
const V = { pg: 'main', i: 0, m: '', mt: 0 };
const go = p => { V.pg = p; V.i = 0 }, say = s => { V.m = s; V.mt = 1.8 };
function toVil(p) {
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
      if (S.caps.includes(hit.c.id)) res.push({ k: 'dup', c: hit.c });
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

// 铁匠铺研磨价格：随等级递增（等级越高，每级涨得越多）
// 公式 80 × (Lv+1) × (1 + Lv/10)，取整到 10：Lv0=80  Lv10=1760  Lv24=6800  Lv50=24480  Lv100=88890
const forgeCost = lv => Math.round(80 * (lv + 1) * (1 + lv / 10) / 10) * 10;

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

  // 铁匠铺：胶囊已剥离，无上限等级，攻击+1%/生命+5%/伤害-0.1%/魔力+3%
  if (p === 'eq') {
    const q = (k, n, d, ic) => ({ n: n + '  Lv.' + S[k], ic, d, g: forgeCost(S[k]), max: false, bt: '研磨', st: 1, f: () => S[k]++ });
    return [
      q('sw', '基础斩刃研磨', '基础攻击力 +1% / 级（无上限）', '⚔'),
      q('ar', '基础装甲强化', '基础生命 +5%、受到伤害 -0.1% / 级（无上限）', '🛡'),
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
  if (G !== 'play') return;
  const curRk = curRiderKey();
  const skills = [
    { key: 'atk', label: 'J', name: '普攻', mp: 0, cd: 0, mcd: 0 },
    { key: 'l',   label: 'L', name: lSkillName(), mp: 10, cd: P.cd.l || 0, mcd: P.maxCd.l || 1 },
    { key: 'e',   label: 'E', name: '战车', mp: 35, cd: P.cd.e || 0, mcd: P.maxCd.e || 1 },
    { key: 'k',   label: 'K', name: '终结技', mp: 60, cd: P.cd.k || 0, mcd: P.maxCd.k || 1 },
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
  txt('VICTORY · 关卡完成', px + pw / 2, py + 30, 25, '#ffd84a', 'center');
  txt(W.stageName, px + pw / 2, py + 66, 14, '#a2b4cb', 'center'); // ★ 下移至 py+66

  // 4. 星级与 Rank 徽章（绝对同一水平线 py + 108 对齐）
  const starY = py + 108; // ★ 统一水平基准线
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

  // ★ Rank 勋章：垂直中心严格与星星 starY 对齐
  const rankX = px + pw - 78, rankY = starY;
  ctx.save();
  ctx.beginPath(); ctx.arc(rankX, rankY, 26, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 216, 74, 0.12)'; ctx.fill();
  ctx.strokeStyle = W.rank === 'S' ? '#ffd84a' : '#7df9ff'; ctx.lineWidth = 2; ctx.stroke();
  txt(W.rank, rankX, rankY - 1, 26, W.rank === 'S' ? '#ffd84a' : '#7df9ff', 'center');
  txt('RANK', rankX, rankY + 36, 10, '#8fa0b3', 'center');
  ctx.restore();

  // 5. 达成条件列表（适度紧凑）
  const condY0 = py + 142;
  W.conds.forEach((c, idx) => {
    const cy = condY0 + idx * 18;
    const pass = c.pass;
    txt(pass ? '✔ ' + c.text : '✘ ' + c.text, px + pw / 2, cy, 11.5, pass ? '#7dff9a' : '#6f7f95', 'center');
  });

  // 6. 奖励卡片网格（★ 大幅收紧与上方的间距，从 py+224 提前至 py+204）
  const cardW = 180, cardH = 70, cardGap = 14;
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
  const isLast = cur >= ST.length - 1 || ST[cur + 1].wb;

  const btnDefs = [
    { id: 'base', text: '返回大厅 [ESC]', w: 140, bg: 'rgba(255,255,255,0.08)', col: '#ccd6e0', border: 'rgba(255,255,255,0.2)' },
    { id: 'retry', text: '再次挑战 [R]', w: 140, bg: 'rgba(0, 229, 255, 0.15)', col: '#7df9ff', border: '#00e5ff' },
    { id: 'next', text: isLast ? '完成出征 [Enter]' : '下一战役 [Enter]', w: 190, bg: 'rgba(255, 216, 74, 0.25)', col: '#ffd84a', border: '#ffd84a', main: true }
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
  const subTip = isWin 
    ? '★ 成功破除首领装甲，额外获得 50% 赏金加成与满额战利品 ★'
    : '金币收益按实际伤害比例发放；撤退、超时或战败均结算战利品';
  txt(subTip, px + pw / 2, py + 148, 11.5, isWin ? '#7dff9a' : '#ffa502', 'center');

  // 5. 奖励展示卡片网格 (py + 204，收紧间距)
  const cardW = 180, cardH = 70, cardGap = 14;
  const cards = [
    { 
      title: '战果赏金', 
      val: '+' + Math.round(W.gold * p).toLocaleString(), 
      icon: ICO.g, 
      col: '#ffd84a',
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

    txt(cd.title, cx + 48, cardY + 22, 11, '#8fa0b3');
    txt(cd.val, cx + 48, cardY + 46, 15, cd.col);

    if (cd.badge) {
      rpath(cx + cardW - 74, cardY + 5, 68, 15, 4);
      ctx.fillStyle = 'rgba(255, 71, 87, 0.28)'; ctx.fill();
      ctx.strokeStyle = '#ff4757'; ctx.lineWidth = 1; ctx.stroke();
      txt(cd.badge, cx + cardW - 40, cardY + 12.5, 7.5, '#ffd84a', 'center');
    }
  });

  // 6. 今日剩余讨伐次数指示条
  const expY = py + 292, expW = pw - 90, expX = px + 45;
  rpath(expX, expY, expW, 20, 10);
  ctx.fillStyle = 'rgba(10, 12, 22, 0.9)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'; ctx.lineWidth = 1; ctx.stroke();
  
  txt('今日剩余讨伐次数：' + W.leftTries + ' / ' + WB_DAILY, expX + 16, expY + 10, 11, W.leftTries > 0 ? '#ffd84a' : '#ff6b81');
  txt('每天 00:00 自动重置挑战配额', expX + expW - 16, expY + 10, 10, '#8fa0b3', 'right');

  // 7. 三大交互操作按钮组 (py + 342)
  const btnY = py + 342, btnH = 46;
  const canRetry = W.leftTries > 0;

  const btnDefs = [
    { id: 'base', text: '返回传送门 [ESC]', w: 150, bg: 'rgba(255,255,255,0.08)', col: '#ccd6e0', border: 'rgba(255,255,255,0.2)' },
    { id: 'char', text: '战备整备 [C]', w: 140, bg: 'rgba(0, 229, 255, 0.15)', col: '#7df9ff', border: '#00e5ff' },
    { 
      id: 'retry', 
      text: canRetry ? '再次挑战 [Enter/R]' : '已无次数 [Enter]', 
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
  const bw = 320, bh = 16, bx = (960 - bw) / 2 + (BOSSB.flash > 0 ? (Math.random() - .5) * 4 : 0), by = 30;
  const pulse = r < .25 ? .5 + .5 * Math.sin(T * 9) : 0;
  const cols = r > .5 ? ['#ff4757', '#ff9f43'] : r > .25 ? ['#d81f3a', '#ff6a3d'] : ['#a80018', '#ff2d2d'];
  const rage = !!b.rg;

  ctx.save();
  // 名称 + 狂暴标记 + 百分比
  txt(name, bx + 2, 17, 14, '#fff', 'left');
  if (rage) txt('狂暴', bx + 2 + ctx.measureText(name).width + 10, 17, 12, '#ff3838', 'left');
  txt((r * 100 < 10 && r > 0 ? (r * 100).toFixed(1) : Math.ceil(r * 100)) + '%', bx + bw - 2, 17, 13, r < .25 ? '#ff6b6b' : '#ffd8a8', 'right');

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
  const w = 160, h = 78, x = 960 - 18 - w, y = 74, z = ST[cur];
  hudPanel(x, y, w, h, UIC.gold, 9);
  const r1 = y + 19, r2 = y + 41, r3 = y + 63, R = x + w - 12;
  ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(x + 14, y + 30, w - 26, 1); ctx.fillRect(x + 14, y + 52, w - 26, 1);
  const lab = (s, yy) => ut(s, x + 16, yy, 10.5, UIC.sub, 'left', { w: 600, sp: 1, sh: 0 });
  if (z.wb) {
    const tl = Math.ceil(WBT);
    lab('剩余时间', r1); ut((tl / 60 | 0) + ':' + String(tl % 60).padStart(2, '0'), R, r1, 13, WBT < 20 ? '#ff7b7b' : UIC.txt, 'right', { w: 700 });
    lab('累计伤害', r2); ut(poN(WBD), R, r2, 13, '#9be8b0', 'right', { w: 700 });
  } else {
    const cnt = Math.min(kills, z.k) + ' / ' + z.k;
    lab('目标', r1); ut(cnt, R, r1, 13, UIC.txt, 'right', { w: 700 });
    if (bs) ut('BOSS', R - uw(cnt, 13, 700) - 8, r1, 10, '#ff5a5a', 'right', { w: 700, sp: 1, sh: 0 });
    lab('战利品', r2); ut('+' + RG + ' G', R, r2, 13, '#e8cf8e', 'right', { w: 700 });
  }
  lab('药水', r3);
  let cx = R;                                           // 药水：色点 + ×数量，从右往左排
  for (const [col, n] of [['#3f8fe8', S.mp], ['#e0414f', S.hp]]) {
    const t = '×' + n, tw0 = uw(t, 12, 700);
    ut(t, cx, r3, 12, n > 0 ? UIC.txt : '#6f7a8c', 'right', { w: 700 });
    ctx.save(); const dx = cx - tw0 - 8;
    const g = ctx.createRadialGradient(dx - 1, r3 - 1.5, .5, dx, r3, 4.5); g.addColorStop(0, '#fff'); g.addColorStop(.35, col); g.addColorStop(1, 'rgba(0,0,0,.6)');
    ctx.fillStyle = g; ctx.globalAlpha = n > 0 ? 1 : .45; ctx.beginPath(); ctx.arc(dx, r3, 4.5, 0, 7); ctx.fill(); ctx.restore();
    cx = dx - 14;
  }
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
  if (typeof TOUCH !== 'undefined' && TOUCH) return;
  ut('W/S 选择    A/D 切换分类    Enter 装配 / 卸下    N 或 Esc 关闭', 480, 523, 11, 'rgba(210,218,232,.8)', 'center', { w: 500, sp: .5 });
}
