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

// 通用面板：深色渐变底 + 顶部高光 + 左侧强调条 + 发光描边
function hudPanel(x, y, w, h, acc, c = 10) {
  ctx.save();
  cutPath(x, y, w, h, c);
  const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, 'rgba(20,30,54,.92)'); g.addColorStop(1, 'rgba(6,10,20,.94)');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(x, y, w, h * .42);
  ctx.fillStyle = acc; ctx.fillRect(x, y + c, 3, h - c);
  ctx.restore();
  cutPath(x, y, w, h, c);
  ctx.shadowColor = acc; ctx.shadowBlur = 8; ctx.lineWidth = 1.3; ctx.strokeStyle = acc + 'aa'; ctx.stroke();
  ctx.restore();
}

// 数值条：ghost 为“残影”（掉血时白色缓慢回落）
function hudBar(x, y, w, h, v, m, c1, c2, ghost) {
  rpath(x, y, w, h, h / 2); ctx.fillStyle = 'rgba(3,6,14,.9)'; ctx.fill();
  ctx.save(); rpath(x, y, w, h, h / 2); ctx.clip();
  const f = cl(v / m, 0, 1);
  if (ghost != null) { ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(x, y, w * cl(ghost / m, 0, 1), h) }
  if (f > 0) {
    const g = ctx.createLinearGradient(x, y, x + w, y); g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(x, y, w * f, h);
    const gl = ctx.createLinearGradient(0, y, 0, y + h);
    gl.addColorStop(0, 'rgba(255,255,255,.4)'); gl.addColorStop(.5, 'rgba(255,255,255,.04)'); gl.addColorStop(1, 'rgba(0,0,0,.22)');
    ctx.fillStyle = gl; ctx.fillRect(x, y, w * f, h);
  }
  ctx.restore();
  rpath(x, y, w, h, h / 2); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.stroke();
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

  // 等级徽章：外圈即经验进度
  const cx = x + 42, cy = y + 38, R = 25, maxExp = S.lv * 40, ep = cl(S.xp / maxExp, 0, 1);
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R + 3, 0, 7); ctx.fillStyle = 'rgba(3,6,14,.92)'; ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
  if (ep > 0) {
    const g = ctx.createLinearGradient(cx - R, cy + R, cx + R, cy - R); g.addColorStop(0, acc); g.addColorStop(1, '#ffffff');
    ctx.lineCap = 'round'; ctx.strokeStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ep); ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(cx, cy, R - 5, 0, 7);
  const ig = ctx.createRadialGradient(cx, cy - 6, 2, cx, cy, R - 5); ig.addColorStop(0, acc + '55'); ig.addColorStop(1, 'rgba(6,10,20,.95)');
  ctx.fillStyle = ig; ctx.fill();
  ctx.restore();
  ht('LV', cx, cy - 9, 9, acc, 'center');
  ht(S.lv, cx, cy + 5, 17, '#ffd84a', 'center');

  const bx = x + 82, bw = w - 82 - 14;
  ht(P.ryuki ? 'KAMEN RIDER RYUKI' : P.k5 ? 'KAMEN RIDER 555' : 'KAMEN RIDER MALAYA', bx, y + 11, 10, acc);
  ht('EXP ' + Math.floor(ep * 100) + '%', bx + bw, y + 11, 10, '#9fb0c4', 'right');
  rpath(bx, y + 19, bw, 3, 1.5); ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fill();
  if (ep > 0) { rpath(bx, y + 19, bw * ep, 3, 1.5); ctx.fillStyle = acc; ctx.fill() }

  hudBar(bx, y + 28, bw, 19, P.hp, P.mh, '#ff3b4e', '#ff8a5c', HUDS.hp);
  ht('HP', bx + 7, y + 38, 10, '#fff');
  ht(fmtC(P.hp) + ' / ' + fmtC(P.mh), bx + bw - 7, y + 38, 11, '#fff', 'right');

  hudBar(bx, y + 52, bw, 13, P.mp, P.mm, '#1e90ff', '#2ee6c8');
  ht('MP', bx + 7, y + 58.5, 9, '#fff');
  ht(fmtC(P.mp) + ' / ' + fmtC(P.mm), bx + bw - 7, y + 58.5, 10, '#fff', 'right');
}

function drawStaminaHUD(x, y) {
  const w = 290, h = 34, ready = P.dcd <= 0, acc = P.exh ? '#ff6b6b' : '#00e5ff';
  hudPanel(x, y, w, h, acc, 9);
  const cx = x + 42, cy = y + 17, rad = 12;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.fillStyle = ready ? 'rgba(0,229,255,.22)' : 'rgba(20,26,42,.95)'; ctx.fill();
  if (!ready) {
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, rad, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - P.dcd / DODGE_CD)); ctx.closePath();
    ctx.fillStyle = 'rgba(0,229,255,.5)'; ctx.fill();
  }
  ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.lineWidth = 2; ctx.strokeStyle = ready ? '#00e5ff' : '#5a6a80';
  if (ready) { ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 8 }
  ctx.stroke(); ctx.restore();
  ht('闪', cx, cy, 11, ready ? '#fff' : '#889', 'center');

  const bx = x + 82, bw = w - 82 - 14;
  hudBar(bx, y + 10, bw, 14, P.sta, P.stm, P.exh ? '#ff6b6b' : '#ffb300', P.exh ? '#ff9f43' : '#ffe066');
  ht(P.exh ? 'EN 力竭' : 'EN', bx + 7, y + 17.5, 9, '#1a1200');
  ht(fmtC(P.sta) + ' / ' + fmtC(P.stm), bx + bw - 7, y + 17.5, 10, '#1a1200', 'right');
}

function drawGoldHUD() {
  const dt = hudDt();
  if (HUDS.g === null) HUDS.g = S.g;
  const df = S.g - HUDS.g; HUDS.g = Math.abs(df) < 1 ? S.g : HUDS.g + df * Math.min(1, dt * 8 + .02);
  const s = Math.round(HUDS.g).toLocaleString(), w = Math.max(132, tw(s, 15) + 74), h = 32, x = 960 - 16 - w, y = 14;
  hudPanel(x, y, w, h, '#ffd84a', 9);
  const cx = x + 24, cy = y + 16;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, 9.5, 0, 7);
  const g = ctx.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, 10); g.addColorStop(0, '#fff4b0'); g.addColorStop(1, '#e0a010');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = '#8a5a00'; ctx.stroke();
  ctx.restore();
  ht('G', cx, cy + .5, 10, '#7a4a00', 'center');
  ht(s, x + w - 32, cy, 15, '#ffe27a', 'right');
  ht('G', x + w - 16, cy + 1, 11, '#c9a64a', 'center');
}

function drawMinimapHUD() {
  const mw = 196, mh = 82, x = 16, y = 405;
  hudPanel(x, y, mw, mh, '#00e5ff', 10);
  ht('RADAR', x + 14, y + 13, 10, '#00e5ff');
  const pulse = (Math.sin(T * 4) + 1) * .5, alert = G === 'play';
  ctx.save(); ctx.fillStyle = alert ? 'rgba(255,71,87,' + (.4 + pulse * .6) + ')' : 'rgba(46,213,115,' + (.4 + pulse * .6) + ')';
  ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 6; ctx.beginPath(); ctx.arc(x + mw - 16, y + 13, 3.5, 0, 7); ctx.fill(); ctx.restore();

  const rx = x + 12, ry = y + 25, rw = mw - 24, rh = 47;
  rpath(rx, ry, rw, rh, 6); ctx.fillStyle = 'rgba(3,6,14,.75)'; ctx.fill();
  ctx.save(); rpath(rx, ry, rw, rh, 6); ctx.clip();
  ctx.fillStyle = 'rgba(0,229,255,.07)';                                      // 网格
  for (let gx = rx + 12; gx < rx + rw; gx += 12) ctx.fillRect(gx, ry, 1, rh);
  ctx.fillRect(rx, ry + rh / 2, rw, 1);
  const sx = rx + ((T * .5) % 1) * rw, sg = ctx.createLinearGradient(sx - 22, 0, sx, 0);   // 扫描线
  sg.addColorStop(0, 'rgba(0,229,255,0)'); sg.addColorStop(1, 'rgba(0,229,255,.22)'); ctx.fillStyle = sg; ctx.fillRect(sx - 22, ry, 22, rh);

  const isPlay = G === 'play', totalW = isPlay ? WW : (G === 'room' ? RW() : VW);
  const camX0 = rx + (cam / totalW) * rw, camW = (960 / totalW) * rw;
  ctx.fillStyle = 'rgba(0,229,255,.1)'; ctx.fillRect(camX0, ry + 1, camW, rh - 2);
  ctx.strokeStyle = 'rgba(0,229,255,.55)'; ctx.lineWidth = 1; ctx.strokeRect(camX0 + .5, ry + 1.5, camW - 1, rh - 3);

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
}

function drawLocationHUD(locName) {
  const x = 16, y = 496, w = 196, h = 30;
  hudPanel(x, y, w, h, '#00e5ff', 8);
  ht('📍', x + 20, y + h / 2, 12, '#fff', 'center');
  ht(locName, x + 36, y + h / 2, 13, '#c9f6ff');
}

// ===== 装备详情用的小工具 =====
const fmtN = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e5 ? Math.floor(n / 1e3) + 'k' : String(n);   // 10万以下显示精确数字

// 小标签：good=true 绿色（够），false 红色（不够）
function chip(x, y, w, h, label, good, sz = 11) {
  rpath(x, y, w, h, 5);
  ctx.fillStyle = good ? 'rgba(46,213,115,.16)' : 'rgba(255,71,87,.18)'; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = good ? 'rgba(46,213,115,.65)' : 'rgba(255,90,100,.75)'; ctx.stroke();
  txt(label, x + w / 2, y + h / 2, sz, good ? '#a6ffc4' : '#ff9aa4', 'center', false);
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
const bagArmed = k => bagArmKey === k && T < bagArmUntil;

function bagBtn(x, y, w, h, label, bg, fg, sz, f, bd) {
  rpath(x, y, w, h, 8); ctx.fillStyle = bg; ctx.fill();
  if (bd) { ctx.lineWidth = 1.5; ctx.strokeStyle = bd; ctx.stroke() }
  txt(label, x + w / 2, y + h / 2, sz, fg, 'center');
  if (f) bagHit(x, y, w, h, f);
}

// 文字过长时自动缩小字号
function fitTxt(s, x, y, maxW, sz, c, al = 'left') {
  while (sz > 9) { ctx.font = `700 ${sz}px ${BAG_FONT}`; if (ctx.measureText(s).width <= maxW) break; sz--; }
  txt(s, x, y, sz, c, al);
}

function drawCharPanel() {
  BH = [];
  const x = 25, y = 20, w = 910, h = 500;
  ctx.save();
  ctx.fillStyle = 'rgba(4, 7, 16, 0.88)'; ctx.fillRect(0, 0, 960, 540);
  rpath(x, y, w, h, 16); ctx.fillStyle = 'rgba(10, 14, 28, 0.96)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#00e5ff'; ctx.stroke();
  rpath(x + 2, y + 2, w - 4, 38, 14); ctx.fillStyle = 'rgba(0, 229, 255, 0.12)'; ctx.fill();
  txt('⚡ 假面骑士 MALAYA · 骑士装甲与无限战备背包 ⚡', x + 20, y + 21, 14, '#7df9ff', 'left');
  bagBtn(x + w - 112, y + 4, 100, 32, '✕ 关闭', 'rgba(255,71,87,.25)', '#ff9aa4', 13, () => { showChar = false }, '#ff4757');

  // ================= 左侧：角色 + 穿戴槽 + 战斗参数 =================
  const lx = x + 18, ly = y + 46, lw = 330, lh = 440;
  rpath(lx, ly, lw, lh, 12); ctx.fillStyle = 'rgba(6, 9, 20, 0.65)'; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)'; ctx.stroke();

  rpath(lx + 10, ly + 10, lw - 20, 110, 8); ctx.fillStyle = 'rgba(12, 20, 38, 0.7)'; ctx.fill();
  ctx.strokeStyle = inForm() ? formCol() : '#00e5ff'; ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.ellipse(lx + 55, ly + 108, 36, 11, 0, 0, Math.PI * 2);
  ctx.fillStyle = P.ryuki ? 'rgba(255,71,87,0.3)' : P.k5 ? 'rgba(255,180,0,0.3)' : 'rgba(0,229,255,0.25)'; ctx.fill();
  ctx.strokeStyle = inForm() ? formCol() : '#00e5ff'; ctx.stroke();
  // 头像按真实像素包围盒居中（555 的变身表帧内角色偏右，旧写法按格子中心画会不居中）
  if (P.ryuki && SH.ryukiTrans && SH.ryukiTrans.f[15]) drCenter(SH.ryukiTrans, 15, lx + 55, ly + 111, .48);
  else if (P.k5 && okS(SH5.trans)) drCenter(SH5.trans, 8, lx + 55, ly + 111, .48);
  else if (SH.atk && SH.atk.f[12]) drCenter(SH.atk, 12, lx + 55, ly + 111, .48);
  ctx.restore();
  txt('假面骑士 MALAYA', lx + 112, ly + 26, 15, '#ffd84a');
  txt(P.ryuki ? '★ 龙骑契约形态' : P.k5 ? '★ 555 智脑形态' : '原生基础形态', lx + 112, ly + 47, 12, P.ryuki ? '#ff7675' : P.k5 ? '#ffd166' : '#7df9ff');
  txt('等级 Lv.' + S.lv + ' / 500', lx + 112, ly + 67, 13, '#fff');
  txt('💰 ' + fmtN(S.g) + ' G', lx + 112, ly + 88, 12, '#ffd84a');
  txt('💎 ' + fmtN(S.mat), lx + 112, ly + 106, 12, '#c58bff');
  txt('📜 ' + (S.scr || 0), lx + 222, ly + 106, 12, '#ffa502');

  // 穿戴槽：2 列 × 4 行，高 46
  const SW = 151, SHt = 46, sx0 = lx + 10, sy0 = ly + 128;
  const slotLayout = [
    { k: 'weapon', n: '武器' }, { k: 'belt', n: '变身腰带' }, { k: 'chest', n: '胸甲' }, { k: 'necklace', n: '项链' },
    { k: 'legs', n: '腿甲' }, { k: 'ring', n: '戒指' }, { k: 'boots', n: '靴子' }, { k: 'ryuki_cap', n: '变身胶囊' }
  ];
  slotLayout.forEach((sl, i) => {
    const sx = sx0 + (i % 2) * (SW + 8), sy = sy0 + ((i / 2) | 0) * (SHt + 6);
    const isCap = sl.k === 'ryuki_cap';
    const ec = isCap ? CAPSULES.find(c => c.id === S.eqCap) : null;
    const it = isCap ? (ec ? { name: ec.slotName, tier: ec.tier, lvl: 0 } : null) : S.eq[sl.k];
    const on = !isCap && selItem && selItem.from === 'eq' && selItem.slotKey === sl.k;
    rpath(sx, sy, SW, SHt, 8);
    ctx.fillStyle = on ? 'rgba(0,229,255,.24)' : 'rgba(8,14,28,.85)'; ctx.fill();
    ctx.lineWidth = on ? 2 : 1.2; ctx.strokeStyle = it ? TIERS[it.tier].c : 'rgba(255,255,255,.14)'; ctx.stroke();
    txt(sl.n, sx + 8, sy + 13, 11, '#8fa0b3');
    if (it && it.star) txt('⭐' + it.star, sx + SW - 8, sy + 13, 11, '#ffd84a', 'right');
    if (it && it.locked) txt('🔒', sx + SW - (it.star ? 40 : 8), sy + 13, 11, '#ffd84a', 'right', false);
    if (it) fitTxt(it.name + (it.lvl ? ' +' + it.lvl : ''), sx + 8, sy + 31, SW - 16, 13, TIERS[it.tier].c);
    else txt(isCap ? '点击装配' : '空槽位', sx + 8, sy + 31, 12, '#5d6b7c');
    bagHit(sx, sy, SW, SHt, () => {
      if (isCap) { showCapModal = true; return }
      if (it) { bagMulti = false; batchSel.clear(); selItem = { item: it, from: 'eq', slotKey: sl.k } }
    });
  });

  // 实战参数
  const py0 = ly + 338;
  rpath(lx + 10, py0, lw - 20, 94, 8); ctx.fillStyle = 'rgba(8,14,30,.85)'; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,229,255,.2)'; ctx.stroke();
  txt('实战参数', lx + 22, py0 + 15, 12, '#7df9ff');
  txt('攻击 ' + (P.atk | 0), lx + 22, py0 + 42, 13, '#ff9f9f');
  txt('暴击 ' + Math.round(P.cr * 100) + '%', lx + 122, py0 + 42, 13, '#ffeaa7');
  txt('免伤 ' + (P.def * 100).toFixed(1) + '%', lx + 222, py0 + 42, 13, '#7dff9a');
  txt('生命 ' + P.mh, lx + 22, py0 + 70, 13, '#55efc4');
  txt('魔力 ' + P.mm, lx + 122, py0 + 70, 13, '#74b9ff');

  // ================= 右侧：列表视图 / 详情视图 =================
  const rx = x + 358, ry = y + 46, rw = 534, rh = 440;
  rpath(rx, ry, rw, rh, 12); ctx.fillStyle = 'rgba(6, 9, 20, 0.65)'; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)'; ctx.stroke();
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
  const list = S.inv.filter(it => bagFilter === 'all' || it.slot === bagFilter);
  const maxPages = Math.max(1, Math.ceil(list.length / BAG_PAGE));
  if (bagPage >= maxPages) bagPage = maxPages - 1;

  // 工具栏：多选开关 + 全选 + 翻页
  const ty = ry + 46, th = 30, cur = BAG_FILTERS.find(f => f.id === bagFilter) || BAG_FILTERS[0];
  bagBtn(rx + 10, ty, 88, th, bagMulti ? '☑ 多选中' : '☐ 多选', bagMulti ? 'rgba(255,216,74,.25)' : 'rgba(20,26,44,.7)', bagMulti ? '#ffd84a' : '#dfe6e9', 13,
    () => { bagMulti = !bagMulti; batchSel.clear(); selItem = null; bagArmKey = '' }, bagMulti ? '#ffd84a' : 'rgba(255,255,255,.2)');
  if (bagMulti) {
    const allIn = list.length > 0 && list.every(it => batchSel.has(it.id));
    bagBtn(rx + 104, ty, 92, th, allIn ? '取消全选' : '✔ 全选', allIn ? 'rgba(255,71,87,.3)' : 'rgba(0,229,255,.25)', allIn ? '#ff9aa4' : '#7df9ff', 13,
      () => selectAllBatch(list), allIn ? '#ff4757' : '#00e5ff');
    txt('已选 ' + batchSel.size + ' 件', rx + 206, ty + th / 2, 13, '#ffd84a');
  } else {
    txt(cur.n + ' · ' + list.length + ' 件', rx + 110, ty + th / 2, 13, '#7df9ff');
  }
  const px = rx + rw - 158;
  bagBtn(px, ty, 34, th, '◀', 'rgba(255,255,255,.08)', bagPage > 0 ? '#fff' : '#555', 14, () => { if (bagPage > 0) bagPage-- });
  txt((bagPage + 1) + ' / ' + maxPages, px + 34 + 40, ty + th / 2, 13, '#b8c2cc', 'center');
  bagBtn(rx + rw - 44, ty, 34, th, '▶', 'rgba(255,255,255,.08)', bagPage < maxPages - 1 ? '#fff' : '#555', 14, () => { if (bagPage < maxPages - 1) bagPage++ });

  // 4×4 格子
  const gx0 = rx + 10, gy0 = ry + 84, gw = 124, gh = 60, gap = 6;
  const pageItems = list.slice(bagPage * BAG_PAGE, (bagPage + 1) * BAG_PAGE);
  for (let i = 0; i < BAG_PAGE; i++) {
    const cx = gx0 + (i % 4) * (gw + gap), cy = gy0 + ((i / 4) | 0) * (gh + gap), it = pageItems[i];
    rpath(cx, cy, gw, gh, 8);
    if (!it) { ctx.fillStyle = 'rgba(12,16,32,.5)'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.stroke(); continue }
    const tier = TIERS[it.tier], chk = batchSel.has(it.id);
    ctx.fillStyle = 'rgba(12,16,32,.92)'; ctx.fill();
    ctx.fillStyle = tier.bg; ctx.fill();
    if (chk) { ctx.fillStyle = 'rgba(0,229,255,.28)'; ctx.fill() }
    ctx.lineWidth = chk ? 2.5 : 1.5; ctx.strokeStyle = chk ? '#00e5ff' : tier.c; ctx.stroke();
    const up = isUpgrade(it), canW = (it.reqLvl || 1) <= S.lv;
    fitTxt(it.name, cx + 8, cy + 18, up ? gw - 34 : gw - 16, 13, tier.c);
    if (up) {                                                // 比身上这件更强：右上角向上箭头（等级不够时变橙色）
      const bob = Math.sin(T * 5) * 1.5;
      ctx.save(); ctx.shadowColor = canW ? '#2ed573' : '#ffa502'; ctx.shadowBlur = 8;
      txt('▲', cx + gw - 14, cy + 16 + bob, 17, canW ? '#2ed573' : '#ffa502', 'center'); ctx.restore();
    }
    const sub = 'Lv.' + (it.reqLvl || 1) + (it.lvl ? ' +' + it.lvl : '') + (it.star ? ' ⭐' + it.star : '');
    fitTxt(sub, cx + 8, cy + 42, (bagMulti || it.locked) ? gw - 40 : gw - 16, 12, (it.reqLvl || 1) > S.lv ? '#ff6b7a' : '#aab6c3');
    if (it.locked) {                                       // 锁定：金色描边 + 🔒（多选模式下不可勾选）
      ctx.save(); rpath(cx, cy, gw, gh, 8); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,216,74,.55)'; ctx.stroke(); ctx.restore();
      txt('🔒', cx + gw - 16, cy + gh - 16, 16, '#ffd84a', 'center', false);
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
    else txt(n ? '分解预估：金币 +' + fmtN(g) + '   碎晶 +' + fmtN(m) : '点击格子勾选装备（可翻页 / 换部件继续勾选）', rx + 22, by + 17, 13, n ? '#7dff9a' : '#8fa0b3');
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

// ---------- 详情视图：占满右侧，按钮加大，分解/丢弃需二次确认 ----------
function drawBagDetail(rx, ry, rw) {
  const it = selItem.item, tier = TIERS[it.tier], slotInfo = SLOTS[it.slot];
  const currEq = S.eq[it.slot], isWorn = selItem.from === 'eq';
  const reqLvl = it.reqLvl || 1, canWear = S.lv >= reqLvl, star = it.star | 0;
  const uc = upgradeCost(it), mats = starMats(it).length, sc = starCost(it), dv = dismantleValue(it);
  const canUp = S.g >= uc.g && S.mat >= uc.mat && (S.scr || 0) >= uc.scr;
  const canStar = star < MAX_STAR && mats >= 2 && S.g >= sc;
  const X = rx + 10, IW = rw - 20;

  bagBtn(X, ry + 8, 112, 36, '← 返回背包', 'rgba(20,26,44,.8)', '#dfe6e9', 13, () => { selItem = null; bagArmKey = '' }, 'rgba(255,255,255,.25)');
  rpath(X + 124, ry + 16, 52, 20, 5); ctx.fillStyle = tier.bg; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = tier.c; ctx.stroke();
  txt(tier.n, X + 150, ry + 26, 12, tier.c, 'center', false);
  rpath(X + 182, ry + 16, 72, 20, 5); ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fill();
  txt(slotInfo.n, X + 218, ry + 26, 12, '#dfe6e9', 'center', false);
  chip(X + 260, ry + 16, 100, 20, '需求 Lv.' + reqLvl, canWear, 12);
  bagBtn(X + IW - 100, ry + 8, 100, 36, it.locked ? '🔒 已锁定' : '🔓 未锁定', it.locked ? 'rgba(255,216,74,.25)' : 'rgba(20,26,44,.8)', it.locked ? '#ffd84a' : '#b8c2cc', 13,
    () => toggleLock(it), it.locked ? '#ffd84a' : 'rgba(255,255,255,.25)');

  txt(it.name, X + 4, ry + 66, 20, tier.c);
  const nw = ctx.measureText(it.name).width;
  if (it.lvl) txt('+' + it.lvl, X + nw + 14, ry + 66, 18, '#ffa502');
  for (let i = 0; i < MAX_STAR; i++) {
    ctx.save(); ctx.globalAlpha = i < star ? 1 : .2;
    txt('⭐', rx + rw - 20 - (MAX_STAR - i) * 22 + 11, ry + 66, 17, '#ffd84a', 'center', false); ctx.restore();
  }

  // 左卡：属性对比
  const cy = ry + 86, lcw = 250;
  card(X, cy, lcw, 172);
  txt(isWorn ? '当前属性（穿戴中）' : (currEq ? '对比现穿 · ' + currEq.name : '该槽位空置'), X + 12, cy + 15, 12, '#8fa0b3', 'left', false);
  const oldStats = (currEq && currEq.stats) ? currEq.stats : {};
  const rows = [['攻击力', 'atk', '#ff9f9f'], ['生命值', 'hp', '#7dffd0'], ['魔力值', 'mp', '#8ec5ff'], ['暴击率', 'crit', '#ffe08a', 1], ['免伤值', 'def', '#9dffb8']]
    .filter(r => (it.stats[r[1]] || 0) || (oldStats[r[1]] || 0));
  const rh = Math.min(30, 132 / Math.max(1, rows.length));
  rows.forEach((r, i) => {
    const yy = cy + 34 + rh * (i + .5), nv = it.stats[r[1]] || 0, ov = oldStats[r[1]] || 0, pc = !!r[3];
    const show = v => pc ? Math.round(v * 100) + '%' : v;
    txt(r[0], X + 12, yy, 13, r[2], 'left', false);
    txt(show(nv), X + 72, yy, 17, '#fff');
    if (!isWorn) {
      const d = nv - ov;
      if (d > 0) txt('▲' + show(d), X + lcw - 10, yy, 14, '#2ed573', 'right', false);
      else if (d < 0) txt('▼' + show(-d), X + lcw - 10, yy, 14, '#ff4757', 'right', false);
      else txt('＝', X + lcw - 10, yy, 14, '#778', 'right', false);
    }
  });

  // 右上卡：强化
  const RX = X + 258, rcw = IW - 258;
  card(RX, cy, rcw, 82);
  txt('🔨 强化  +' + it.lvl + ' → +' + (it.lvl + 1), RX + 10, cy + 18, 14, '#ffa502', 'left', false);
  txt('+12%/级', RX + rcw - 10, cy + 18, 11, '#8fa0b3', 'right', false);
  chip(RX + 8, cy + 48, 78, 24, '💰 ' + fmtN(uc.g), S.g >= uc.g, 12);
  chip(RX + 90, cy + 48, 78, 24, '💎 ' + fmtN(uc.mat), S.mat >= uc.mat, 12);
  chip(RX + 172, cy + 48, 76, 24, '📜 ' + uc.scr, (S.scr || 0) >= uc.scr, 12);

  // 右下卡：升星
  const sy = cy + 90;
  card(RX, sy, rcw, 82);
  if (star >= MAX_STAR) {
    txt('⭐ 已满星（5 / 5）', RX + rcw / 2, sy + 41, 15, '#ffd84a', 'center');
  } else {
    txt('⭐ 升星  ' + star + ' → ' + (star + 1), RX + 10, sy + 18, 14, '#ffd84a', 'left', false);
    txt('全属性 +25%/星', RX + rcw - 10, sy + 18, 11, '#8fa0b3', 'right', false);
    chip(RX + 8, sy + 48, 100, 24, '💰 ' + fmtN(sc), S.g >= sc, 12);
    chip(RX + 112, sy + 48, 136, 24, '📦 同名同品质 ' + Math.min(mats, 99) + '/2', mats >= 2, 11);
  }

  // 提示条
  if (bagNoticeT > 0) txt(bagNotice, rx + rw / 2, ry + 274, 13, '#7dff9a', 'center');
  else if (!canWear && !isWorn) txt('⚠ 等级不足，Lv.' + reqLvl + ' 才能穿戴', rx + rw / 2, ry + 274, 13, '#ff6b81', 'center');

  // 按钮行 1：穿戴 / 强化 / 升星
  const b1 = ry + 292, bh = 50;
  bagBtn(X, b1, 246, bh, isWorn ? '卸下装备' : (canWear ? '穿戴装备' : '等级不足 · 需 Lv.' + reqLvl), isWorn ? '#2e86de' : (canWear ? '#2ed573' : '#57606f'), canWear || isWorn ? '#fff' : '#b2bec3', 15,
    () => { if (isWorn) unequipItem(selItem.slotKey); else equipItem(it) });
  bagBtn(X + 254, b1, 124, bh, '强化 +1', canUp ? '#ff9f43' : '#57606f', canUp ? '#fff' : '#b2bec3', 15, () => upgradeItem(it));
  bagBtn(X + 386, b1, 128, bh, '升星 ⭐', canStar ? '#d4a017' : '#57606f', canStar ? '#fff' : '#b2bec3', 15, () => starUpItem(it));

  // 按钮行 2：分解 / 丢弃（二次确认防误触）
  const b2 = b1 + bh + 8, kd = 'dis:' + it.id, kx = 'drop:' + it.id;
  const a1 = bagArmed(kd), a2 = bagArmed(kx);
  const lk = !!it.locked, off = isWorn || lk;
  bagBtn(X, b2, 253, bh, lk ? '🔒 已锁定 · 无法分解' : isWorn ? '分解（需先卸下）' : (a1 ? '再点一次 确认分解' : '分解  +' + fmtN(dv.g) + 'G  +' + fmtN(dv.mat) + '晶'), off ? '#3d4452' : (a1 ? '#e0563a' : '#a55eea'), off ? '#8b95a1' : '#fff', 14,
    () => { if (off) { if (lk) { bagNotice = '🔒 该装备已锁定，请先解锁再分解'; bagNoticeT = 1.8 } else dismantleItem(it) } else bagConfirm(kd, '再点一次「分解」确认（+' + dv.g + 'G / +' + dv.mat + '晶）', () => dismantleItem(it)) });
  bagBtn(X + 261, b2, 253, bh, lk ? '🔒 已锁定 · 无法丢弃' : isWorn ? '丢弃（需先卸下）' : (a2 ? '再点一次 确认丢弃' : '丢弃'), off ? '#3d4452' : (a2 ? '#ff4757' : '#eb3b5a'), off ? '#8b95a1' : '#fff', 14,
    () => { if (off) { if (lk) { bagNotice = '🔒 该装备已锁定，请先解锁再丢弃'; bagNoticeT = 1.8 } else discardItem(it) } else bagConfirm(kx, '再点一次「丢弃」确认（无收益）', () => discardItem(it)) });
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

    if (CAP_IMGS[selCap.id]) {
      ctx.save();
      rpath(rx + 14, ry + 14, rw - 28, cardH - 4, 6); ctx.clip();
      drawArt(CAP_IMGS[selCap.id], rx + 14, ry + 14, rw - 28, cardH - 4);
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

    txt('【契约战力加成】', rx + 24, infoY + 14, 11, '#7df9ff');
    txt('• ' + selCap.buff, rx + 24, infoY + 31, 11, '#ffd84a');

    txt('【专属技能】', rx + 24, infoY + 51, 11, '#ffa502');
    txt('• ' + selCap.skill, rx + 24, infoY + 68, 11, '#fff');

    txt('【终结必杀技】', rx + 24, infoY + 88, 11, '#ff7675');
    txt('• ' + selCap.finisher, rx + 24, infoY + 105, 11, '#fff');

    txt('【战术说明】 按 P 键变身 / 解除', rx + 24, infoY + 125, 11, '#2ed573');
    txt(selCap.desc, rx + 24, infoY + 141, 10, '#889');
  }

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
  if (p === 'st') openPortal(true);
}

function buy(o) {
  if (o.max) return say('已达上限/已拥有'); if (S.g < (o.g || 0)) return say('金币不足'); if (S.tp < (o.t || 0)) return say('天赋点不足');
  S.g -= o.g || 0; S.tp -= o.t || 0; o.f(); calc(); save(); say('强化成功！');
}

// ===== 扭蛋：奖池 / 概率 / 抽取 =====
// 每次抽取独立随机：各胶囊按下表概率，其余为体力药水与「谢谢惠顾」。重复抽中已拥有的胶囊——什么也不会返还。
// 新增胶囊时只要在 CAPSULES 里加一项；没写概率的默认 10%，总和超过 100% 会自动等比缩小。
const GACHA_COST = 150, GACHA_RATE = { ryuki: 20, '555': 20 }, GACHA_POTION = 25;
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
  if (S.g < cost) return say('金币不足');
  S.g -= cost;
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
  if (n > 1) gachaModal = { type: 'sum', res };
  else if (gachaQ.length) gachaModal = gachaQ.shift();
  else {
    const r = res[0];
    say(r.k === 'dup' ? '重复的【' + r.c.short + '】胶囊——没有任何补偿' : r.k === 'potion' ? (r.full ? '抽中体力药水，但背包已满' : '抽中体力药水 ×1') : '谢谢惠顾，什么也没抽到');
  }
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
    { n: '强化卷轴   持有 ' + (S.scr || 0), ic: '📜', d: '装备强化必需材料（怪物也会掉落，上限99）', g: 300, max: (S.scr || 0) >= 99, bt: '购买', hold: [S.scr || 0, 99], f: () => { S.scr = (S.scr || 0) + 1 } }, bk];

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