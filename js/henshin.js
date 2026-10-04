// ===== 龙骑 / 555 变身：按音频时间轴播放变身表 + 节拍特效（结构与 blade.js 一致）=====
// 引入顺序：放在 faiz.js / ryuki.js 之后、main.js 之前。对外接口：henReady() / updHenshin(dt) / drawHenshin(x,y,f)
//
// 下面所有时间都是“音频原速的秒数”，实际按音频真实时长等比换算，并且动画时钟直接跟随音频 currentTime。
// 觉得哪一拍不准，只改 XXX_TL / XXX_KEYS 里的秒数即可。

// ---------------------------------------------------------------------------------------------
// 龙骑（Kamen_Rider_Ryuki_Henshin.m4a · 12.376s）
//   0.05 开头一击 · 0.5~3.4 渐强上升音 · 3.5~4.6 静默 · 4.65 轻响 · 5.4~6.1 闪烁音 · 6.25 咔哒
//   6.4 主旋律进入(爆发) · 9.3 / 10.1 两次重音 · 10.5 高潮 · 11.5 起淡出
// 变身表 4×4：0 站立 · 1 举牌 · 2 收牌 · 3 插入腰带(红光) · 4 蓝环 · 5 碎裂 · 6 半龙骑 · 7~8 红色爆发 ·
//            9 暗头盔 · 10 亮头盔 · 11 红描边 · 12 垂手 · 13~14 拔剑 · 15 待机
const RYUKI_AUDIO_LEN = 12.376;
const RYUKI_TL = {
  hit0: .05,                  // 开头一击
  card: .5,                   // 举牌（牌面闪光）
  belt: 2.4,                  // 腰带开始发红光
  ins: 2.8,                   // 牌插入腰带
  silence: [3.5, 4.65],       // 静默：画面压暗，腰带像心跳一样亮
  advent: 4.65,               // 蓝色镜面法阵展开
  flick: 5.4,                 // 闪烁音开始
  click: 6.25,                // 咔哒
  burst: 6.4,                 // 主旋律进入：红色爆发
  scans: [8.2, 8.65, 9.0],    // 银色装甲逐段生成
  hit1: 9.3, hit2: 10.1,      // 两次重音
  fin: 10.5,                  // 高潮：拔剑
  calm: 11.3                  // 余韵
};
// [时间, 变身表帧号, 是否硬切, 淡入时长(可选)]
const RYUKI_KEYS = [[0, 0], [.5, 1], [1.7, 2], [2.8, 3], [4.65, 4, 1], [5.4, 5, 1], [5.8, 6], [6.4, 7, 1], [6.95, 8],
  [8.2, 9], [9.3, 10, 1], [10.1, 11, 1], [10.5, 13, 1], [11.0, 14], [11.6, 15]];

// ---------------------------------------------------------------------------------------------
// 555（Kamen_Rider_555_Henshin.m4a · 11.976s）
//   0.45 / 1.2 / 1.94 三声拨号音 (5-5-5) · 2.35 ENTER · 3.3 起 6 段上扬“充能”音(约每 0.55s 一段)
//   5.5 / 6.05 两下重击 · 6.4 全曲最强一击(COMPLETE) · 6.7~8.4 琶音 · 8.5 主旋律进入 · 10.45 高潮
// 变身表 4×4：0 站立 · 3 握拳 · 4 蓝环 · 5 溶解 · 6 555(青眼+红线+蓝色水纹) · 7 黄色爆发 · 8 待机 · 9 叉腰 · 10 举手机
const FAIZ_AUDIO_LEN = 11.976;
const FAIZ_TL = {
  beeps: [.45, 1.2, 1.94],                    // 5 · 5 · 5
  enter: 2.35,                                // ENTER → 握拳（把手机插进腰带）
  stand: 3.3,                                 // STANDING BY：蓝环，充能开始
  charges: [3.3, 3.85, 4.4, 4.95],            // 四段轻充能
  heavy: [5.5, 6.05],                         // 两下重击
  complete: 6.4,                              // COMPLETE：Photon Blood 红线贯穿全身
  burst: 8.5,                                 // 主旋律进入：黄色爆发
  acc: 10.45,                                 // 高潮
  calm: 11.2
};
const FAIZ_KEYS = [[0, 0], [2.35, 3, 1], [3.3, 4, 1], [5.5, 5, 1], [6.4, 6, 1], [8.5, 7, 1], [9.1, 8], [9.9, 9], [10.45, 10, 1], [11.2, 8]];

// ---------------------------------------------------------------------------------------------
// 全屏效果：dim=[升起开始, 升起结束, 退去开始, 退去结束, 最大透明度, 'r,g,b']；flash=[[时刻, 持续, 透明度, 'r,g,b'], ...]
const HN = {
  ryuki: {
    len: RYUKI_AUDIO_LEN, keys: RYUKI_KEYS, idle: 15, glow: '#ff4757', clipL: { 9: .235 },   // 第 9 帧左侧 23% 是相邻爆发帧漏进来的碎片
    dim: [3.3, 3.55, 4.6, 4.9, .55, '2,2,14'],
    flash: [[.05, .12, .3, '255,255,255'], [6.25, .12, .5, '255,255,255'], [6.4, .45, .5, '255,225,205'],
            [9.3, .3, .3, '235,240,255'], [10.1, .3, .3, '255,200,190'], [10.5, .45, .5, '255,235,190']]
  },
  '555': {
    len: FAIZ_AUDIO_LEN, keys: FAIZ_KEYS, idle: 8, glow: '#ffb400',
    dim: [3.3, 3.9, 6.4, 6.8, .38, '6,4,2'],
    flash: [[5.5, .18, .22, '255,255,255'], [6.05, .18, .18, '255,255,255'], [6.4, .4, .5, '255,255,255'],
            [8.5, .45, .5, '255,246,200'], [10.45, .4, .35, '255,255,235']]
  }
};

// ---------- 小工具（与 blade.js 同款；换了名字避免重复声明）----------
const hnSm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t) };
const hnRz = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v) };
function hnFlash(x, y, r, a, c0, c1) {
  if (a <= .004) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, 'rgba(' + c0 + ',' + Math.min(1, a).toFixed(3) + ')'); g.addColorStop(.45, 'rgba(' + c1 + ',' + (a * .45).toFixed(3) + ')'); g.addColorStop(1, 'rgba(' + c1 + ',0)');
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function hnRing(x, y, rx, ry, a, lw, c, t0, t1) {
  if (a <= .004) return;
  ctx.strokeStyle = 'rgba(' + c + ',' + Math.min(1, a).toFixed(3) + ')'; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(1, rx), Math.max(1, ry), 0, t0 || 0, t1 === undefined ? 7 : t1); ctx.stroke();
}
function hnRays(x, y, n, r0, r1, a, seed, c) {
  if (a <= .004) return;
  ctx.strokeStyle = 'rgba(' + c + ',' + Math.min(1, a * a).toFixed(3) + ')'; ctx.lineWidth = 1.4; ctx.beginPath();
  for (let i = 0; i < n; i++) { const an = (i + hnRz(i + seed)) / n * 6.2832, k = .6 + hnRz(i * 3 + seed) * .4; ctx.moveTo(x + Math.cos(an) * r0, y + Math.sin(an) * r0 * .8); ctx.lineTo(x + Math.cos(an) * r1 * k, y + Math.sin(an) * r1 * k * .8) }
  ctx.stroke();
}
// 火花 / 水花：向上抛出再落下
function hnSparks(x, y, a, p, n, cols, seed, spd) {
  for (let i = 0; i < n; i++) {
    const an = -3.1416 * (.08 + .84 * hnRz(i + seed)), v = (spd || 220) + hnRz(i + seed + 3) * 300, px = x + Math.cos(an) * v * a * .8, py = y - 6 + Math.sin(an) * v * a + 520 * a * a;
    if (py > y + 4) continue;
    ctx.fillStyle = 'rgba(' + cols[i % cols.length] + ',' + ((1 - p) * .9).toFixed(3) + ')';
    ctx.beginPath(); ctx.arc(px, py, 1.6 + hnRz(i + seed + 5) * 2.6, 0, 7); ctx.fill();
  }
}
// 沿身体上扫的光环（foot → head）
function hnGate(x, y, a, dur, c0, c1) {
  if (a < 0 || a >= dur) return;
  const p = a / dur, yy = y - p * 205;
  for (let m = 0; m < 5; m++) hnRing(x, yy + m * 13, 92 - m * 4, 16, (1 - p) * (m ? .5 / m : .95), m ? 3 : 6, c0);
  hnFlash(x, yy, 120, (1 - p) * .4, c0, c1);
}
function hnScan(x, y, a, dur, c) {
  if (a < 0 || a >= dur) return;
  const p = a / dur, yy = y - p * 200, g = ctx.createLinearGradient(0, yy - 16, 0, yy + 16);
  g.addColorStop(0, 'rgba(' + c + ',0)'); g.addColorStop(.5, 'rgba(' + c + ',' + ((1 - p) * .7).toFixed(3) + ')'); g.addColorStop(1, 'rgba(' + c + ',0)');
  ctx.fillStyle = g; ctx.fillRect(x - 85, yy - 16, 170, 32);
}
// 绕腰旋转的虚线光环 + 亮点
// front=0 画后半圈（在人物身后）  front=1 画前半圈（在人物身前），合起来就是“环绕腰间”
function hnBeltRing(x, belt, s, ra, sp, c0, c1, dots, front) {
  if (ra <= .01) return;
  const t0 = front ? 0 : 3.1416, t1 = front ? 3.1416 : 6.2832;
  ctx.save(); ctx.setLineDash([16, 12]); ctx.lineDashOffset = -s * 70 * sp;
  hnRing(x, belt, 96, 16, ra * .55, 5, c0, t0, t1); hnRing(x, belt, 100, 17, ra * .3, 10, c1, t0, t1);
  ctx.setLineDash([]); ctx.restore();
  for (let i = 0; i < 10; i++) {
    const an = s * 3.2 * sp + i * .6283, sn_ = Math.sin(an);
    if ((sn_ > 0) !== !!front) continue;
    hnFlash(x + Math.cos(an) * 96, belt + sn_ * 16, 9, ra * .8 * (front ? 1 : .45), dots, c0);
  }
}
// 向内聚集 / 向上飘升的粒子
function hnGather(x, cy, s, t0, t1, amp, cols, n) {
  if (amp <= .01) return;
  const tt = s - t0;
  for (let i = 0; i < n; i++) {
    const ph = (tt * .8 + i * .137) % 1, q = 1 - ph, an = hnRz(i) * 6.2832 + ph * 2.2, rad = 26 + 230 * q * q;
    ctx.fillStyle = 'rgba(' + cols[i % cols.length] + ',' + (ph * amp * .95).toFixed(3) + ')';
    ctx.beginPath(); ctx.arc(x + Math.cos(an) * rad, cy + Math.sin(an) * rad * .8, 1.4 + ph * 2.6, 0, 7); ctx.fill();
  }
}
function hnRise(x, y, s, amp, cols, n, speed) {
  if (amp <= .01) return;
  for (let i = 0; i < n; i++) {
    const ph = (s * speed + i * .137) % 1, px = x + (hnRz(i) - .5) * 150 * (.6 + ph * .4), py = y - 10 - ph * 250, r = 1.4 + hnRz(i + 9) * 2.4;
    ctx.fillStyle = 'rgba(' + cols[i & 1] + ',' + ((1 - ph) * amp * .9).toFixed(3) + ')';
    ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill();
  }
}
function hnTxt(s, c, up, t) { DT.push({ x: P.x, y: P.y - (up || 210), s: s, t: t || 1.4, c: c }) }

// ---------------------------------------------------------------------------------------------
// 龙骑特效   pass 0 = 身后（地面涟漪 / 粒子 / 火柱）   pass 1 = 身前（闪光 / 冲击 / 扫描）
function ryukiFx(x, y, s, pass, f, S) {
  const L = RYUKI_TL, belt = y - 98;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (pass === 0) {
    // 每个重音：地面一圈涟漪（蓝=镜面世界，红/金=契约爆发）
    const rg = [[L.advent, 0], [L.flick, 0], [L.burst, 1], [L.hit1, 0], [L.hit2, 0], [L.fin, 1]];
    for (const [tb, big] of rg) {
      const age = s - tb, life = big ? 1.1 : .8;
      if (age < 0 || age > life) continue;
      const p = age / life, r = 30 + p * (big ? 380 : 230);
      hnRing(x, y + 2, r, r * .16, (1 - p) * (big ? .9 : .6), big ? 5 : 3, tb < L.burst ? '110,180,255' : tb >= L.fin ? '255,210,110' : '255,90,60');
    }
    // 0.5~3.4 渐强：火星向腰带聚集
    hnGather(x, belt, s, L.card, 3.4, hnSm(L.card, 1.3, s) * (1 - hnSm(3.2, 3.5, s)), ['255,90,60', '255,210,120'], 34);
    // 4.65~6.4 蓝色镜面光晕
    const ba = hnSm(L.advent, L.advent + .25, s) * (1 - hnSm(L.burst - .1, L.burst + .1, s));
    if (ba > .01) {
      hnFlash(x, y - 100, 175, ba * (.32 + Math.sin(s * 9) * .05), '170,215,255', '60,120,255');
      hnRing(x, y - 100, 88, 112, ba * .55, 3, '120,190,255');
    }
    // 爆发后：赤焰上升（高潮时更密）
    hnRise(x, y, s, hnSm(L.burst, L.burst + .5, s) * (1 - hnSm(10.9, 11.8, s)), ['255,120,40', '255,214,120'], s > L.fin ? 46 : 32, s > L.fin ? .9 : .6);
    // 10.5 脚下火柱
    const a = s - L.fin;
    if (a >= 0 && a < 1.5) {
      const p = a / 1.5, h = 300 * (1 - Math.pow(1 - Math.min(1, p * 2.2), 2)), al = 1 - hnSm(.5, 1, p);
      for (let i = 0; i < 9; i++) {
        const ox = (i - 4) * 38 + Math.sin(s * 9 + i * 2) * 5, hh = h * (.55 + .45 * hnRz(i + 7)) * (1 - Math.abs(i - 4) * .08), ww = 26 + 10 * hnRz(i);
        const g = ctx.createLinearGradient(0, y, 0, y - hh);
        g.addColorStop(0, 'rgba(255,214,102,' + (.85 * al).toFixed(3) + ')'); g.addColorStop(.45, 'rgba(255,75,43,' + (.6 * al).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,45,45,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x + ox - ww / 2, y); ctx.quadraticCurveTo(x + ox - ww / 3, y - hh * .6, x + ox, y - hh);
        ctx.quadraticCurveTo(x + ox + ww / 3, y - hh * .6, x + ox + ww / 2, y); ctx.fill();
      }
    }
  } else {
    let a = s - L.hit0;
    if (a >= 0 && a < .3) { const p = a / .3; hnFlash(x, belt, 50 + p * 90, (1 - p) * .6, '255,255,255', '255,150,110') }
    // 0.5 举牌：牌面闪光 + 十字星芒
    a = s - L.card;
    if (a >= 0 && a < .55 && S) {
      const p = a / .55, c = { x: x + f * 66, y: y - 148 };   // 第 1 帧里牌在人物右前方、头部高度
      hnFlash(c.x, c.y, 22 + p * 110, (1 - p) * .9, '255,255,255', '255,150,110'); hnRays(c.x, c.y, 8, 6, 20 + p * 80, (1 - p) * .8, 3, '255,230,210');
    }
    // 腰带红光：2.4 起渐亮，3.5~4.65 静默期像心跳一样一下一下亮
    const ga = hnSm(L.belt, 3.4, s) * (1 - hnSm(L.advent - .05, L.advent + .1, s));
    if (ga > .01) {
      const beat = (s > L.silence[0] && s < L.silence[1]) ? Math.pow(Math.max(0, Math.sin((s - L.silence[0]) * 7.5)), 3) : 0;
      hnFlash(x, belt, 24 + ga * 22 + beat * 46 + Math.sin(s * 9) * 3, ga * .55 + beat * .5, '255,225,205', '255,60,50');
    }
    a = s - L.ins;
    if (a >= 0 && a < .4) { const p = a / .4; hnRays(x, belt, 12, 10 + p * 60, 30 + p * 140, (1 - p) * .85, 7, '255,210,190') }
    // 4.65 镜面展开：蓝光一闪
    a = s - L.advent;
    if (a >= 0 && a < .45) { const p = a / .45; hnFlash(x, y - 100, 90 + p * 200, (1 - p) * .6, '220,240,255', '90,150,255'); hnRing(x, y - 100, 40 + p * 160, 40 + p * 160, (1 - p) * .7, 4, '150,200,255') }
    // 5.4~6.25 闪烁音：全身忽明忽暗的白蓝闪
    if (s >= L.flick && s < L.click) {
      const k = Math.floor(s * 24), on = hnRz(k) > .4 ? 1 : 0, fade = Math.min(1, (L.click - s) / .2 + .3);
      hnFlash(x, y - 105, 110 + hnRz(k + 5) * 40, on * .34 * fade, '225,240,255', '90,150,255');
      if (on) hnRays(x, y - 105, 10, 30, 90 + hnRz(k) * 60, .6, k, '200,225,255');
    }
    a = s - L.click;
    if (a >= 0 && a < .14) hnFlash(x, belt, 60 + a * 400, (1 - a / .14) * .8, '255,255,255', '255,160,120');
    // 6.4 爆发：光爆 + 射线 + 冲击环 + 火星
    a = s - L.burst;
    if (a >= 0 && a < 1.0) {
      const p = a, my = y - 105;
      hnFlash(x, my, 140 + p * 420, Math.max(0, 1 - p * 1.5) * .6, '255,240,220', '255,70,40');
      hnRays(x, my, 18, 40 + p * 60, 120 + p * 330, (1 - p) * .9, 1, '255,205,160');
      hnRing(x, my, 30 + p * 330, 30 + p * 330, (1 - p) * .8, 6 * (1 - p) + 1, '255,120,80');
      hnRing(x, my, 20 + p * 210, 20 + p * 210, (1 - p) * .7, 4 * (1 - p) + 1, '255,225,140');
      hnSparks(x, y, a, p, 36, ['255,150,60', '255,235,170'], 0, 220);
    }
    // 8.2 / 8.65 / 9.0 银色装甲逐段生成
    for (const ts of L.scans) hnScan(x, y, s - ts, .45, '225,232,245');
    // 9.3 亮头盔：面罩一闪 + 身体一圈
    a = s - L.hit1;
    if (a >= 0 && a < .5) {
      const p = a / .5;
      if (a < .3) hnFlash(x, y - 176, 16 + a * 90, (1 - a / .3) * .9, '255,255,255', '200,225,255');
      hnFlash(x, y - 105, 100 + p * 160, (1 - p) * .45, '235,240,255', '120,160,255'); hnRing(x, y - 105, 40 + p * 200, 40 + p * 200, (1 - p) * .5, 3, '180,205,255');
    }
    // 10.1 红描边：红色冲击环
    a = s - L.hit2;
    if (a >= 0 && a < .55) { const p = a / .55; hnFlash(x, y - 105, 100 + p * 190, (1 - p) * .55, '255,200,190', '255,60,50'); hnRing(x, y - 105, 40 + p * 230, 40 + p * 230, (1 - p) * .65, 4, '255,110,90') }
    // 10.5 高潮：全身光爆 + 射线 + 双层冲击环
    a = s - L.fin;
    if (a >= 0 && a < 1.1) {
      const p = a / 1.1;
      hnFlash(x, y - 105, 120 + p * 480, (1 - p) * .8, '255,250,230', '255,120,60');
      hnRays(x, y - 105, 22, 50 + p * 60, 130 + p * 360, (1 - p) * .85, 11, '255,235,200');
      hnRing(x, y - 105, 30 + p * 360, 30 + p * 360, (1 - p) * .8, 6 * (1 - p) + 1, '255,150,90');
      hnRing(x, y - 105, 20 + p * 230, 20 + p * 230, (1 - p) * .7, 4 * (1 - p) + 1, '255,225,140');
    }
    const ca = hnSm(L.calm - .3, L.calm + .3, s) * (1 - hnSm(11.6, 12.2, s));
    if (ca > .01) hnFlash(x, y - 100, 150, ca * (.16 + Math.sin(s * 5) * .04), '255,225,200', '255,90,60');
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// 555 特效
function faizFx(x, y, s, pass, f, S) {
  const L = FAIZ_TL, belt = y - 98, RING = '255,196,0', RED = '255,59,48';
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (pass === 0) {
    // 每段充能 / 重击：地面一圈涟漪（逐段变大）
    const rg = L.charges.map((t, i) => [t, .5 + i * .15, RING]).concat(L.heavy.map(t => [t, 1.1, '255,225,90']), [[L.complete, 1.6, RED], [L.burst, 1.8, '255,225,90'], [L.acc, 1.1, RING]]);
    for (const [tb, k, c] of rg) {
      const age = s - tb, life = .5 + k * .4;
      if (age < 0 || age > life) continue;
      const p = age / life, r = 30 + p * 230 * k;
      hnRing(x, y + 2, r, r * .16, (1 - p) * (.5 + k * .25), 2 + k * 2, c);
    }
    // 拨号阶段：腰间一点点金光
    const da = hnSm(.3, 1.2, s) * (1 - hnSm(L.enter, L.stand, s)) * .25;
    if (da > .01) hnFlash(x, belt, 36, da, '255,235,160', '255,180,0');
    // 3.3~6.4 腰间光环：随充能变亮、转速加快，COMPLETE 后消失
    hnBeltRing(x, belt, s, hnSm(L.stand, 4.8, s) * (1 - hnSm(L.complete, L.complete + .25, s)), 1 + hnSm(4.8, 6.3, s) * 2.5, RED, RING, '255,245,200', 0);
    // 充能粒子向腰带聚集 / 之后上升
    hnGather(x, belt, s, L.stand, L.complete, hnSm(L.stand, 4.2, s) * (1 - hnSm(6.2, 6.45, s)), [RING, '255,230,140', RED], 40);
    hnRise(x, y, s, hnSm(L.complete + .2, L.complete + .8, s) * (1 - hnSm(10.8, 11.6, s)), s > L.burst ? ['255,215,70', '255,90,40'] : [RED, '255,150,100'], s > L.burst ? 46 : 30, s > L.burst ? .85 : .55);
    // 6.4~8.5 蓝色水纹光晕（变身表第 6 帧自带蓝色水流，这里补外圈）
    const wa = hnSm(L.complete, L.complete + .4, s) * (1 - hnSm(L.burst - .15, L.burst, s));
    if (wa > .01) hnFlash(x, y - 100, 170, wa * (.2 + Math.sin(s * 6) * .04), '170,215,255', '60,130,255');
  } else {
    // 腰间光环的前半圈（后半圈在身后）
    hnBeltRing(x, belt, s, hnSm(L.stand, 4.8, s) * (1 - hnSm(L.complete, L.complete + .25, s)), 1 + hnSm(4.8, 6.3, s) * 2.5, RED, RING, '255,245,200', 1);
    // 三声拨号：键盘依次弹出 5 · 5 · 5，再 ENTER
    faizPad(x, y, s);
    for (const tb of L.beeps) { const a = s - tb; if (a >= 0 && a < .3) { const p = a / .3; hnFlash(x + 6, y - 262, 24 + p * 60, (1 - p) * .6, '255,245,200', RING) } }
    // 2.35 ENTER：握拳 → 插入腰带，金光一闪
    let a = s - L.enter;
    if (a >= 0 && a < .5) { const p = a / .5; hnFlash(x, belt, 40 + p * 140, (1 - p) * .85, '255,250,225', '255,190,0'); hnRays(x, belt, 12, 10 + p * 60, 30 + p * 150, (1 - p) * .85, 5, '255,240,190') }
    // 3.3 STANDING BY：蓝白一闪 + 腰带亮起，之后随充能变亮
    a = s - L.stand;
    if (a >= 0 && a < .4) { const p = a / .4; hnFlash(x, belt, 50 + p * 120, (1 - p) * .7, '230,245,255', '90,160,255') }
    const ga = hnSm(L.stand, 4.4, s) * (1 - hnSm(L.complete, L.complete + .3, s));
    if (ga > .01) hnFlash(x, belt, 24 + ga * 20 + Math.sin(s * 9) * 3, ga * .6, '255,240,200', '255,170,0');
    // 每段充能：腰间一闪
    for (const tb of L.charges.concat(L.heavy)) { a = s - tb; if (a >= 0 && a < .25) { const p = a / .25; hnFlash(x, belt, 60 + p * 150, (1 - p) * .38, '255,240,200', '255,180,0') } }
    // 两下重击：身体整体一闪 + 射线
    for (const tb of L.heavy) { a = s - tb; if (a >= 0 && a < .4) { const p = a / .4; hnFlash(x, y - 105, 100 + p * 200, (1 - p) * .35, '255,255,240', '255,200,60'); hnRays(x, y - 105, 14, 30 + p * 40, 90 + p * 200, (1 - p) * .7, 9, '255,240,190') } }
    // 6.4 COMPLETE：红色光环从脚扫到头 + 光爆
    a = s - L.complete;
    hnGate(x, y, a, .6, '255,120,100', '255,50,40');
    if (a >= 0 && a < .7) { const p = a / .7; hnFlash(x, y - 105, 120 + p * 300, (1 - p) * .5, '255,255,255', '255,80,60'); hnRays(x, y - 105, 16, 40 + p * 60, 110 + p * 260, (1 - p) * .8, 2, '255,215,190') }
    // 6.4~8.5 Photon Blood：红色光流沿身体向上流动
    if (s >= L.complete && s < L.burst) {
      const fade = hnSm(L.complete, L.complete + .3, s) * (1 - hnSm(L.burst - .5, L.burst - .05, s));
      ctx.save(); ctx.lineCap = 'round'; ctx.shadowColor = '#ff2d2d'; ctx.shadowBlur = 10;
      for (let i = 0; i < 14; i++) {
        const ph = (s * 1.5 + hnRz(i + 40)) % 1, lx = x + (i - 6.5) * 7.2 + Math.sin(s * 4 + i) * 2, ly = y - 8 - ph * 200, l = 16 + 22 * hnRz(i);
        ctx.strokeStyle = 'rgba(255,60,50,' + ((1 - ph) * .85 * fade).toFixed(3) + ')'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx, ly - l); ctx.stroke();
      }
      ctx.restore();
      hnScan(x, y, ((s - L.complete) * 1.0) % .9, .9 * .5, '255,110,90');
    }
    // 8.5 爆发：金色光爆 + 射线 + 冲击环 + 火星，面罩由青变黄
    a = s - L.burst;
    if (a >= 0 && a < 1.0) {
      const p = a, my = y - 105;
      hnFlash(x, my, 140 + p * 420, Math.max(0, 1 - p * 1.5) * .6, '255,255,235', '255,170,0');
      hnRays(x, my, 20, 40 + p * 60, 120 + p * 330, (1 - p) * .9, 1, '255,240,170');
      hnRing(x, my, 30 + p * 330, 30 + p * 330, (1 - p) * .8, 6 * (1 - p) + 1, '255,215,90');
      hnRing(x, my, 20 + p * 210, 20 + p * 210, (1 - p) * .7, 4 * (1 - p) + 1, '255,110,70');
      hnSparks(x, y, a, p, 36, ['255,215,70', '255,120,50'], 0, 220);
      if (a < .5) hnFlash(x, y - 176, 14 + a * 70, (1 - a / .5) * .9, '255,255,200', '255,200,0');
    }
    // 10.45 高潮：光爆 + 射线 + 双层冲击环
    a = s - L.acc;
    if (a >= 0 && a < 1.1) {
      const p = a / 1.1;
      hnFlash(x, y - 105, 120 + p * 400, (1 - p) * .65, '255,255,235', '255,190,60');
      hnRays(x, y - 105, 22, 50 + p * 60, 130 + p * 300, (1 - p) * .8, 11, '255,245,200');
      hnRing(x, y - 105, 30 + p * 330, 30 + p * 330, (1 - p) * .8, 6 * (1 - p) + 1, '255,215,90');
      hnRing(x, y - 105, 20 + p * 210, 20 + p * 210, (1 - p) * .7, 4 * (1 - p) + 1, '255,100,70');
    }
    const ca = hnSm(L.calm - .3, L.calm + .3, s) * (1 - hnSm(11.5, 11.95, s));
    if (ca > .01) hnFlash(x, y - 100, 150, ca * (.16 + Math.sin(s * 5) * .04), '255,240,190', '255,180,40');
  }
  ctx.restore();
}

// 555 的拨号键盘：5 · 5 · 5 · ENTER，每声提示音弹出一位
function faizPad(x, y, s) {
  const L = FAIZ_TL, al = hnSm(.3, .45, s) * (1 - hnSm(L.stand - .35, L.stand, s));
  if (al <= .01) return;
  const px = x, py = y - 262, n = L.beeps.filter(t => s >= t).length;
  ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = al; ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(8,8,8,.85)'; ctx.strokeStyle = '#ffb400'; ctx.lineWidth = 2;
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(px - 78, py - 26, 156, 52, 8); else ctx.rect(px - 78, py - 26, 156, 52); ctx.fill(); ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (s >= L.enter) {
    ctx.fillStyle = 'rgba(255,196,0,' + (Math.sin(s * 22) > -.3 ? 1 : .35) + ')'; ctx.font = 'bold 26px monospace'; ctx.fillText('ENTER', px, py + 1);
  } else {
    for (let i = 0; i < n; i++) {
      const pop = 1 + .55 * Math.max(0, 1 - (s - L.beeps[i]) / .16);
      ctx.save(); ctx.translate(px + (i - 1) * 42, py + 1); ctx.scale(pop, pop);
      ctx.fillStyle = '#ffc400'; ctx.shadowColor = '#ffb400'; ctx.shadowBlur = 10; ctx.font = 'bold 34px monospace'; ctx.fillText('5', 0, 0);
      ctx.restore();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// 时间轴驱动 / 绘制
const henKey = () => P.trk === '555' ? '555' : 'ryuki';
const hnSheet0 = () => henKey() === '555' ? (typeof SH5 !== 'undefined' ? SH5.trans : null) : (typeof SH !== 'undefined' ? SH.ryukiTrans : null);
function henReady() { const S = hnSheet0(); return !!(S && S.f && S.f.length >= 16 && S.f[0] && S.f[0].width) }
const hnTS = () => { const H = HN[henKey()]; return P.t * H.len / (P.tdur || H.len) };   // 换算成“音频原速秒数”

// 变身表的格子是整格裁出来的，爆发帧的光芒会被格边切成直线：左右 / 顶部边缘做 4% 羽化（脚底不动，免得脚被淡掉）
function hnSheet(H) {
  const S = hnSheet0();
  if (H._src === S && H._S) return H._S;
  const band = Math.max(4, Math.round(S.cw * .04));
  const f = S.f.map((c, i) => {
    if (i === H.idle || !c || !c.getContext) return c;
    const w = c.width, h = c.height, k = document.createElement('canvas'); k.width = w; k.height = h;
    const g = k.getContext('2d'); g.drawImage(c, 0, 0); g.globalCompositeOperation = 'destination-in';
    for (const [x0, y0, x1, y1] of [[0, 0, band, 0], [w, 0, w - band, 0], [0, 0, 0, band]]) {
      const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
    if (H.clipL && H.clipL[i]) g.clearRect(0, 0, Math.round(w * H.clipL[i]), h);
    return k;
  });
  H._src = S; H._S = Object.assign({}, S, { f });
  return H._S;
}

function hnFrameAt(keys, s) {   // → { a, b, e }：当前帧 / 下一帧 / 交叉淡入进度
  let j = 0; while (j + 1 < keys.length && keys[j + 1][0] <= s) j++;
  const a = keys[j], b = keys[j + 1];
  if (!b || b[2]) return { a: a[1], b: a[1], e: 0 };
  const fd = Math.min(b[3] || .16, (b[0] - a[0]) * .6);
  return { a: a[1], b: b[1], e: hnSm(b[0] - fd, b[0], s) };
}

// 全屏效果：暗场与白闪
function hnScreen(H, s, over) {
  ctx.save();
  if (!over) {
    const D = H.dim, d = D[4] * hnSm(D[0], D[1], s) * (1 - hnSm(D[2], D[3], s));
    if (d > .01) { ctx.fillStyle = 'rgba(' + D[5] + ',' + d.toFixed(3) + ')'; ctx.fillRect(-80, -80, 1120, 700) }
  } else {
    ctx.globalCompositeOperation = 'lighter';
    let a = 0, c = '255,255,255';
    for (const [t, dur, al, col] of H.flash) { const k = s - t; if (k >= 0 && k < dur) { const v = (1 - k / dur) * al; if (v > a) { a = v; c = col } } }
    if (a > .01) { ctx.fillStyle = 'rgba(' + c + ',' + a.toFixed(3) + ')'; ctx.fillRect(-80, -80, 1120, 700) }
  }
  ctx.restore();
}

// 节拍事件（main.js 的更新循环里调用）：音频播放时动画时钟取音频 currentTime；每个事件只触发一次
function updHenshin(dt) {
  const k = henKey(), H = HN[k], snd = k === '555' ? (typeof SND5 !== 'undefined' ? SND5 : null) : (typeof SNDR !== 'undefined' ? SNDR : null);
  if (snd && !snd.paused && snd.currentTime > .02) P.t = snd.currentTime;
  const s = hnTS(), h = P.hit, fire = (id, t, fn) => { if (s >= t && !h[id]) { h[id] = 1; if (!(t < (P.sk || 0))) fn() } };
  const sk = v => { shake = Math.max(shake, v) };
  if (k === 'ryuki') {
    const L = RYUKI_TL;
    fire('hit0', L.hit0, () => sk(4)); fire('card', L.card, () => sk(2));
    fire('ins', L.ins, () => { sk(5); hnTxt('变身！', '#ff4757', 200, 1.2) });
    fire('advent', L.advent, () => sk(6)); fire('flick', L.flick, () => sk(8));
    fire('burst', L.burst, () => {
      sk(26); if (G === 'play') area(P.x - 360, P.x + 360, P.atk * 3.5);
      hnTxt('赤龙契约·烈焰爆发！', '#ff3838', 210, 1.6);
      FX.push({ type: 'boom', x: P.x, y: GY - 60, t: .7, d: .7, r: 320, c: '#ff3b3b' }); FX.push({ type: 'boom', x: P.x, y: GY - 60, t: .5, d: .5, r: 200, c: '#ffd166' });
    });
    fire('hit1', L.hit1, () => sk(10)); fire('hit2', L.hit2, () => sk(12));
    fire('fin', L.fin, () => { sk(22); hnTxt('KAMEN RIDER RYUKI', '#ff4757', 235, 1.8); FX.push({ type: 'boom', x: P.x, y: GY - 80, t: .6, d: .6, r: 260, c: '#ffd166' }) });
  } else {
    const L = FAIZ_TL;
    L.beeps.forEach((t, n) => fire('p' + n, t, () => sk(2)));
    fire('enter', L.enter, () => { sk(5); hnTxt('ENTER', '#ffb400', 200, 1.0) });
    fire('stand', L.stand, () => { sk(4); hnTxt('STANDING BY…', '#ffb400', 215, 1.4) });
    L.charges.forEach((t, n) => fire('c' + n, t, () => sk(3)));
    L.heavy.forEach((t, n) => fire('hv' + n, t, () => sk(9 + n * 2)));
    fire('complete', L.complete, () => { sk(18); hnTxt('COMPLETE', '#ff2d2d', 215, 1.6) });
    fire('burst', L.burst, () => {
      sk(26); if (G === 'play') area(P.x - 360, P.x + 360, P.atk * 3.5);
      hnTxt('555 · 光之斗士！', '#ffb400', 235, 1.8);
      FX.push({ type: 'boom', x: P.x, y: GY - 60, t: .7, d: .7, r: 320, c: '#ffb400' }); FX.push({ type: 'boom', x: P.x, y: GY - 60, t: .5, d: .5, r: 200, c: '#ffffff' });
    });
    fire('acc', L.acc, () => sk(10));
  }
}

function drawHenshin(x, y, f) {
  const k = henKey(), H = HN[k], S = hnSheet(H), s = hnTS(), fr = hnFrameAt(H.keys, s), fx = k === '555' ? faizFx : ryukiFx;
  hnScreen(H, s, 0);
  fx(x, y, s, 0, f, S);
  ctx.save();
  // 发光：开场无光 → 蓄力渐亮 → 爆发后强光 → 余韵收敛
  const L = k === '555' ? FAIZ_TL : RYUKI_TL, b0 = k === '555' ? L.stand : L.belt, b1 = L.burst;
  ctx.shadowColor = H.glow;
  ctx.shadowBlur = s < b0 ? 0 : s < b1 ? Math.min(14, (s - b0) / 1.2 * 14) + Math.sin(s * 9) * 3 : s < L.calm ? 18 : 10;
  const bob = Math.sin(T * 2.4) * (s < 2 ? .6 : 1.2);
  if (fr.a === fr.b) drC(S, fr.a, x, y + bob, f);
  else { drC(S, fr.a, x, y + bob, f, 1, 1 - fr.e * fr.e); drC(S, fr.b, x, y + bob, f, 1, fr.e) }
  ctx.restore();
  fx(x, y, s, 1, f, S);
  hnScreen(H, s, 1);
}
