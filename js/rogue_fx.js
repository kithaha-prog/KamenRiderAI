// ===== 虚幻裂隙 · 圣物视觉特效 (rogue_fx.js) =====
// 只负责「画」：不改任何数值与判定。rogue.js 在各圣物触发点调用 rfx('事件名', ...)，
// 本文件把事件变成粒子 / 光环 / 闪电 / 冲击波等，并挂在 drawBikes（玩家身后）与 drawBladeBolts（玩家身前）上绘制。
// 加载顺序：必须在 rogue.js 之前（见 index.html）。任何一步出错只会关闭特效，不会影响游戏本体。

const RFX = (function () {
  const L = [];                 // 事件特效队列
  let snap = [];                // 上一帧的敌人快照（用来在击杀时找到敌人位置）
  const em = {};                // 常驻特效的发射计时器
  let dead = false;             // 出错后自动关闭
  const PI2 = Math.PI * 2;
  const R = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[(Math.random() * a.length) | 0];
  const TIER_COL = { 1: '#00d2d3', 2: '#2e86de', 3: '#a55eea', 4: '#ffd32a' };

  const live = () => !dead && typeof ROGUE !== 'undefined' && ROGUE.inRun;
  const has = id => ROGUE.relics.includes(id);
  const bodyY = () => P.y - 90;
  const ec = e => ({ x: e.x, y: e.y - (e.h || 60) / 2 });
  const add = o => { if (L.length < 340) L.push(Object.assign({ t: 0, d: .5 }, o)); return o; };
  const tick = (k, iv, dt) => { em[k] = (em[k] || 0) - dt; if (em[k] <= 0) { em[k] = iv; return true; } return false; };

  // ---- 基础发射器 ----
  const part = (x, y, o) => add(Object.assign({ k: 'p', x, y, vx: 0, vy: 0, g: 0, s: 4, c: '#fff', d: .6, shape: 'spark' }, o));
  const ring = (x, y, r, c, d, o) => add(Object.assign({ k: 'ring', x, y, r, c, d: d || .5, w: 3, ry: 1 }, o));
  const burst = (x, y, n, c, spd, o) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * PI2, s = R(.4, 1) * spd;
      part(x, y, Object.assign({ vx: Math.cos(a) * s, vy: Math.sin(a) * s, c, s: R(2, 4.5), d: R(.35, .7) }, o));
    }
  };
  const bolt = (x1, y1, x2, y2, c, d, w) => {      // 锯齿闪电
    const pts = [{ x: x1, y: y1 }], n = Math.max(3, Math.min(10, (Math.hypot(x2 - x1, y2 - y1) / 28) | 0));
    for (let i = 1; i < n; i++) {
      const q = i / n;
      pts.push({ x: x1 + (x2 - x1) * q + R(-16, 16), y: y1 + (y2 - y1) * q + R(-16, 16) });
    }
    pts.push({ x: x2, y: y2 });
    add({ k: 'bolt', pts, c, d: d || .25, w: w || 3 });
  };
  const tint = (c, a, d) => add({ k: 'tint', c, a, d: d || .2 });
  const pillar = (x, y, c, d, w) => add({ k: 'pil', x, y, c, d: d || .6, w: w || 50 });
  const glowEll = (x, y, rx, ry, rgb, a) => {
    if (a <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(${rgb},${Math.min(1, a)})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.fillRect(-rx, -rx, rx * 2, rx * 2); ctx.restore();
  };
  const hexPath = (x, y, r, rot) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = rot + i * PI2 / 6; i ? ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.closePath();
  };

  // ================= 事件（rogue.js 调用） =================
  const ev = {
    reset() { L.length = 0; snap = []; for (const k in em) delete em[k]; },

    // 获得圣物：按阶位逐级华丽
    pickup(tier) {
      const c = TIER_COL[tier] || '#fff', x = P.x, y = bodyY();
      pillar(x, GY, c, .9, 40 + tier * 12);
      ring(x, GY - 4, 110 + tier * 20, c, .7, { ry: .22, w: 4 });
      ring(x, GY - 4, 60 + tier * 10, '#fff', .5, { ry: .22 });
      for (let i = 0; i < 12 + tier * 6; i++) part(x + R(-40, 40), GY - R(0, 20), { vy: -R(140, 360), vx: R(-30, 30), g: 160, c: pick([c, '#fff', '#ffd84a']), s: R(2, 4.5), d: R(.7, 1.3) });
      if (tier >= 3) tint(c, .22, .35);
      if (tier >= 4) {
        ring(x, y, 200, '#ffd32a', .8, { w: 5 }); ring(x, y, 120, '#fff', .55);
        if (typeof shake !== 'undefined') shake = Math.max(shake, 10);
      }
    },

    // 雷光重炮：落雷
    thunderHit(e) {
      if (!e) return; const p = ec(e);
      bolt(p.x + R(-50, 50), -30, p.x, p.y, '#ffd84a', .32, 5);
      bolt(p.x + R(-80, 80), -30, p.x, p.y, '#fff6c2', .22, 2.5);
      ring(p.x, p.y, 130, '#ffb142', .45, { w: 5 }); tint('#ffd84a', .2, .15);
      burst(p.x, p.y, 16, '#ffd84a', 300, { g: 300 });
    },
    // 暴击盛宴：金色星芒
    crit(e) {
      if (!e) return; const p = ec(e);
      add({ k: 'star', x: p.x, y: p.y, c: '#ffd84a', d: .35, r: R(70, 100) });
      ring(p.x, p.y, 60, '#fff', .25, { w: 3 });
    },
    // 雷霆之印：连锁闪电
    chain(e, targets) {
      if (!e || !targets) return; const a = ec(e);
      for (const t of targets) {
        const b = ec(t);
        bolt(a.x, a.y, b.x, b.y, '#7df9ff', .28, 3.5); bolt(a.x, a.y, b.x, b.y, '#fff', .18, 1.6);
        ring(b.x, b.y, 55, '#7df9ff', .25, { w: 3 }); burst(b.x, b.y, 6, '#bff7ff', 180);
      }
      ring(a.x, a.y, 40, '#7df9ff', .2);
    },
    // 镜面反甲：反弹光刃
    thorn(t) {
      if (!t) return; const a = { x: P.x, y: bodyY() }, b = ec(t);
      add({ k: 'blade', x1: a.x, y1: a.y, x2: b.x, y2: b.y, c: '#e056fd', d: .3 });
      ring(a.x, a.y, 70, '#e056fd', .3, { w: 4 });
      for (let i = 0; i < 8; i++) part(a.x, a.y, { vx: R(-200, 200), vy: R(-200, 200), shape: 'shard', c: pick(['#e056fd', '#fff', '#c8a2ff']), s: R(4, 8), d: R(.35, .6) });
      ring(b.x, b.y, 50, '#e056fd', .25);
    },
    // 斩杀处决：红色十字斩
    execute(e) {
      if (!e) return; const p = ec(e);
      add({ k: 'x', x: p.x, y: p.y, c: '#ff4757', d: .45, r: 70 });
      pillar(p.x, e.y, '#ff4757', .5, 34); tint('#ff2d3d', .14, .18);
      burst(p.x, p.y, 14, '#ff4757', 260, { g: 420 });
    },
    // 狂涌过载激活
    surge() {
      const x = P.x, y = bodyY();
      ring(x, y, 190, '#00e5ff', .5, { w: 5 }); ring(x, y, 110, '#fff', .35);
      pillar(x, GY, '#00e5ff', .6, 70); tint('#00e5ff', .16, .3);
      for (let i = 0; i < 6; i++) { const a = R(0, PI2); bolt(x, y, x + Math.cos(a) * 150, y + Math.sin(a) * 120, '#7df9ff', .3, 3); }
      burst(x, y, 22, '#7df9ff', 340);
    },
    // 契约回流：蓝色六边形上升
    flow() {
      for (let i = 0; i < 5; i++) part(P.x + R(-30, 30), bodyY() + R(-30, 40), { shape: 'hex', vy: -R(60, 140), c: '#4fb3ff', s: R(5, 9), d: R(.6, .9) });
      ring(P.x, bodyY(), 50, '#4fb3ff', .3);
    },
    // 能量神盾：破碎 / 就绪
    shieldBreak() {
      const x = P.x, y = bodyY();
      for (let i = 0; i < 16; i++) { const a = i / 16 * PI2; part(x + Math.cos(a) * 55, y + Math.sin(a) * 85, { vx: Math.cos(a) * R(160, 300), vy: Math.sin(a) * R(160, 300), shape: 'shard', c: pick(['#7df9ff', '#fff', '#00e5ff']), s: R(5, 10), d: R(.4, .75) }); }
      ring(x, y, 130, '#7df9ff', .4, { w: 5 }); tint('#7df9ff', .14, .15);
    },
    shieldReady() { ring(P.x, bodyY(), 110, '#7df9ff', .5, { w: 3, rev: true }); burst(P.x, bodyY(), 10, '#bff7ff', 120); },
    // 龙皇烈焰：每 0.5 秒一次灼烧脉冲
    flameTick() {
      ring(P.x, GY - 6, 112, '#ff7f50', .28, { ry: .2, w: 4 });
      for (let i = 0; i < 6; i++) part(P.x + R(-100, 100), GY - 6, { vy: -R(80, 200), c: pick(['#ff7f50', '#ffb142', '#ff4757']), shape: 'ember', s: R(4, 8), d: R(.4, .7) });
    },
    // 时空断裂：全场停滞
    timeFrac() {
      tint('#7d5fff', .22, .6); ring(P.x, bodyY(), 280, '#a29bfe', .55, { w: 5 }); ring(P.x, bodyY(), 160, '#fff', .4);
      burst(P.x, bodyY(), 14, '#a29bfe', 220);
    },
    // 幻影残像：假身出现 / 爆炸
    echoStart(x) {
      ring(x, GY - 6, 60, '#81ecec', .45, { ry: .22 });
      for (let i = 0; i < 8; i++) part(x + R(-20, 20), GY - R(20, 160), { shape: 'hex', vy: -R(30, 90), c: '#81ecec', s: R(4, 8), d: R(.5, .8) });
    },
    echoBoom(x) {
      ring(x, GY - 50, 140, '#81ecec', .4, { w: 5 }); ring(x, GY - 6, 150, '#fff', .35, { ry: .2 });
      pillar(x, GY, '#81ecec', .45, 60); tint('#81ecec', .12, .15);
      burst(x, GY - 50, 18, '#c8ffff', 320);
    },
    // 坠地震山：地裂 + 碎石 + 尘浪
    slam(x, rng) {
      ring(x, GY - 6, rng, '#e17055', .5, { ry: .18, w: 6 }); ring(x, GY - 6, rng * .6, '#fab1a0', .4, { ry: .18, w: 4 });
      add({ k: 'crack', x, len: rng, d: .9 });
      for (let i = 0; i < 18; i++) part(x + R(-rng * .6, rng * .6), GY - 8, { shape: 'rock', vx: R(-140, 140), vy: -R(260, 560), g: 1500, c: pick(['#e17055', '#b8623f', '#fab1a0']), s: R(4, 9), d: R(.6, 1.0) });
      for (let i = 0; i < 14; i++) part(x + R(-rng, rng), GY - 4, { shape: 'dust', vx: R(-60, 60) + (Math.random() < .5 ? -1 : 1) * 120, vy: -R(20, 70), c: '#c9a37a', s: R(10, 22), d: R(.6, 1.0) });
    },
    // 战车聚变：大范围聚变爆破
    fusion(x) {
      ring(x, GY - 40, 270, '#fdcb6e', .6, { w: 7 }); ring(x, GY - 40, 160, '#fff', .45, { w: 4 }); ring(x, GY - 6, 280, '#ff9f43', .6, { ry: .2, w: 5 });
      pillar(x, GY, '#fdcb6e', .7, 120); tint('#ffd84a', .24, .3);
      burst(x, GY - 40, 30, '#ffe08a', 460, { g: 200 });
    },
    // 真红终焉：流星
    meteor(mx) {
      add({ k: 'met', x: mx + 220, tx: mx, ty: GY - 24, d: .2, end(o) {
        ring(mx, GY - 8, 100, '#ff6b35', .45, { ry: .22, w: 5 });
        burst(mx, GY - 20, 12, '#ffb142', 340, { g: 500 });
      } });
    },
    // 弹幕粉碎：新月斩 + 火花
    erase(n) {
      add({ k: 'arc', x: P.x, y: bodyY(), f: P.f, d: .26 });
      for (let i = 0; i < Math.min(12, n * 2); i++) part(P.x + P.f * R(30, 170), bodyY() + R(-70, 70), { vx: P.f * R(40, 200), vy: R(-80, 80), c: pick(['#fff', '#7df9ff']), s: R(2, 4), d: R(.25, .5) });
    },
    // 精英房畸变巨兽现身
    champ(e) {
      if (!e) return; const p = ec(e);
      ring(p.x, GY - 6, 170, '#ff4757', .7, { ry: .2, w: 6 }); pillar(p.x, GY, '#ff4757', .8, 70); tint('#ff2d3d', .16, .4);
      burst(p.x, p.y, 20, '#ff6b81', 320);
      if (typeof shake !== 'undefined') shake = Math.max(shake, 8);
    },
    // 升龙引力：旋风开启
    vortexStart(x) { ring(x, GY - 6, 150, '#9bd6ff', .5, { ry: .2, w: 5 }); pillar(x, GY, '#9bd6ff', .5, 60); },

    // 击杀：嗜血 / 蓄势 / 贪婪
    kills(dk) {
      const gone = [];
      for (const s of snap) if (s.ref.dead || !E.includes(s.ref)) gone.push(s);
      const n = Math.min(4, Math.max(dk, 1));
      for (let i = 0; i < n; i++) {
        const s = gone[i], x = s ? s.x : P.x + R(-80, 80), y = s ? s.y - s.h / 2 : bodyY();
        if (has('blood_oath')) for (let j = 0; j < 5; j++) part(x, y, { shape: 'drop', c: '#ff4757', s: R(4, 7), d: R(.55, .85), home: { toP: 1, delay: j * .05, arc: R(-60, 60) } });
        if (has('ultimate_haste')) for (let j = 0; j < 3; j++) part(x, y, { c: '#ffd84a', s: R(3, 5), d: R(.5, .75), home: { toP: 1, delay: j * .06, arc: R(-40, 40) } });
        if (has('midas_mirror')) for (let j = 0; j < 4; j++) part(x, y, { shape: 'coin', vx: R(-90, 90), vy: -R(240, 420), g: 1000, c: '#ffd84a', s: R(5, 8), d: R(.7, 1.0) });
      }
      if (has('ultimate_haste')) ring(P.x, bodyY(), 55, '#ffd84a', .3, { w: 3, rev: true });
      if (has('blood_oath')) ring(P.x, bodyY(), 45, '#ff4757', .3, { w: 3, rev: true });
    }
  };

  // ================= 每帧更新 =================
  function update(dt) {
    if (!live() || !(dt > 0)) return;
    // 粒子 / 事件
    for (let i = L.length - 1; i >= 0; i--) {
      const o = L[i]; o.t += dt;
      if (o.k === 'p') {
        if (o.home) {                       // 飞向玩家（带弧线）
          const h = o.home, q = Math.max(0, (o.t - (h.delay || 0)) / Math.max(.01, o.d - (h.delay || 0)));
          if (o.x0 === undefined) { o.x0 = o.x; o.y0 = o.y; }
          if (o.t >= (h.delay || 0)) {
            const e = q * q * (3 - 2 * q);
            o.x = o.x0 + (P.x - o.x0) * e; o.y = o.y0 + (bodyY() - o.y0) * e + Math.sin(q * Math.PI) * (h.arc || 0);
          }
        } else if (o.pull) {                // 旋风吸入
          const e = Math.min(1, o.t / o.d);
          o.x = o.x0 + (o.pull.x - o.x0) * e * e; o.y = o.y0 + (o.pull.y - o.y0) * e;
        } else { o.x += o.vx * dt; o.y += o.vy * dt; o.vy += o.g * dt; }
      }
      if (o.t >= o.d) { if (o.end) o.end(o); L.splice(i, 1); }
    }

    const F = ROGUE.fx, py = bodyY();

    // 龙皇烈焰：火星
    if (has('dragon_aura') && tick('dr', .06, dt))
      part(P.x + R(-100, 100), GY - R(0, 8), { vy: -R(70, 170), vx: R(-20, 20), c: pick(['#ff7f50', '#ffb142', '#ff4757']), shape: 'ember', s: R(3, 7), d: R(.5, .9) });
    // 光子超频：速度线
    if (has('photon_speed') && Math.abs(P.vx || 0) > 180 && tick('ph', .035, dt))
      part(P.x - P.f * R(10, 40), P.y - R(20, 160), { vx: -P.f * R(500, 800), shape: 'streak', c: pick(['#7df9ff', '#fff']), d: R(.15, .28), s: 2 });
    // 狂涌过载：电弧
    if (ROGUE.surgeTimer > 0 && tick('su', .07, dt)) {
      const a = R(0, PI2), a2 = a + R(-.8, .8);
      bolt(P.x + Math.cos(a) * 36, py + Math.sin(a) * 55, P.x + Math.cos(a2) * 80, py + Math.sin(a2) * 100, '#7df9ff', .16, 2);
    }
    // 雷光重炮：蓄能火花
    if (F.thunderT > 0 && F.thunderDelay <= 0 && tick('th', .06, dt)) {
      const a = R(0, PI2); part(P.x + Math.cos(a) * 44, py + Math.sin(a) * 66, { vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 40, c: pick(['#ffd84a', '#fff6c2']), s: R(2, 4), d: R(.2, .4) });
    }
    // 破釜沉舟：血性余烬
    if (has('desperate_strike')) {
      const k = Math.max(0, 1 - P.hp / P.mh);
      if (k > .25 && tick('de', .16 - k * .1, dt)) part(P.x + R(-30, 30), P.y - R(10, 120), { vy: -R(40, 120), c: pick(['#ff4757', '#ff7f50']), shape: 'ember', s: R(3, 6), d: R(.5, .9) });
    }
    // 战车聚变：机车火焰
    if (has('bike_reactor') && Array.isArray(BIKES) && tick('bk', .04, dt))
      for (const b of BIKES) if (typeof b.x === 'number') part(b.x - (b.f || 1) * R(70, 100), b.y - R(10, 40), { vx: -(b.f || 1) * R(80, 200), vy: R(-40, 20), c: pick(['#fdcb6e', '#ff9f43', '#fff']), shape: 'ember', s: R(4, 8), d: R(.2, .4) });
    // 急冻霜痕：冰晶
    if (has('frost_touch') && tick('fr', .12, dt))
      for (const e of E) if (!e.dead && e._slowT > 0) part(e.x + R(-24, 24), e.y - R(0, e.h || 60), { shape: 'flake', vy: R(10, 40), vx: R(-15, 15), c: '#bfe9ff', s: R(4, 7), d: R(.6, 1.0) });
    // 升龙引力：被卷入的碎光
    if (F.vortex && tick('vo', .035, dt)) {
      const v = F.vortex, x0 = v.x + (Math.random() < .5 ? -1 : 1) * R(120, 220), y0 = GY - R(0, 150);
      part(x0, y0, { c: '#cfeaff', s: R(2, 4), d: .45, pull: { x: v.x, y: GY - 80 }, x0, y0 });
    }
    // 幻影残像：全息假身（复用残影系统）
    for (const dc of F.decoys) if (Array.isArray(GH)) GH.push({ x: dc.x, y: GY, f: dc.f || 1, st: 'idle', t: .06, d: .06 });

    // 敌人快照（放在最后：下一帧的 kills 用它）
    snap = [];
    for (const e of E) if (e && !e.dead && typeof e.x === 'number') snap.push({ ref: e, x: e.x, y: e.y, h: e.h || 60 });
  }

  // ================= 绘制：玩家身后（光环 / 地面 / 敌人状态） =================
  function drawUnder() {
    if (!live() || G !== 'play') return;
    const F = ROGUE.fx, x = P.x - cam, py = bodyY(), t = T;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';

    // 破釜沉舟：血色脚下光晕，血越少越亮
    if (has('desperate_strike')) {
      const k = Math.max(0, 1 - P.hp / P.mh);
      if (k > .2) glowEll(x, GY, 70 + k * 50, 20, '255,40,60', (k - .2) * 1.1 * (.7 + .3 * Math.sin(t * 8)));
    }
    // 不朽体魄：金色心跳
    if (has('immortal_will')) {
      const b = (t % 1.4) / 1.4;
      ctx.strokeStyle = `rgba(255,216,74,${.4 * (1 - b)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, GY - 4, 30 + b * 60, (30 + b * 60) * .2, 0, 0, PI2); ctx.stroke();
    }
    // 龙皇烈焰：旋转火环
    if (has('dragon_aura')) {
      const pulse = ROGUE.auraTimer / .5;
      glowEll(x, GY - 6, 120, 24, '255,110,40', .16 + .22 * pulse);
      ctx.strokeStyle = `rgba(255,150,70,${.45 + .3 * pulse})`; ctx.lineWidth = 3; ctx.setLineDash([16, 10]); ctx.lineDashOffset = -t * 70;
      ctx.beginPath(); ctx.ellipse(x, GY - 6, 110, 18, 0, 0, PI2); ctx.stroke(); ctx.setLineDash([]);
      for (let i = 0; i < 8; i++) {                // 环上的火舌
        const a = t * 2.2 + i * PI2 / 8, fx = x + Math.cos(a) * 110, fy = GY - 6 + Math.sin(a) * 18, h = 22 + 12 * Math.sin(t * 9 + i * 2);
        const g = ctx.createLinearGradient(fx, fy, fx, fy - h); g.addColorStop(0, 'rgba(255,120,40,.8)'); g.addColorStop(1, 'rgba(255,200,80,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(fx - 6, fy); ctx.quadraticCurveTo(fx, fy - h * .6, fx + R(-2, 2), fy - h); ctx.quadraticCurveTo(fx + 1, fy - h * .5, fx + 6, fy); ctx.fill();
      }
    }
    // 狂涌过载：青色光场 + 倒计时弧
    if (ROGUE.surgeTimer > 0) {
      glowEll(x, py, 90, 120, '0,229,255', .2 + .08 * Math.sin(t * 14));
      ctx.strokeStyle = 'rgba(125,249,255,.8)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, py, 66, -Math.PI / 2, -Math.PI / 2 + PI2 * ROGUE.surgeTimer / 3); ctx.stroke();
    }
    // 雷光重炮：蓄能光环
    if (F.thunderT > 0 && F.thunderDelay <= 0) {
      glowEll(x, py, 70, 100, '255,200,60', .16 + .1 * Math.sin(t * 18));
      ctx.strokeStyle = 'rgba(255,216,74,.85)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, py, 58, -Math.PI / 2, -Math.PI / 2 + PI2 * F.thunderT / 6); ctx.stroke();
    }
    // 升龙引力：龙卷
    if (F.vortex) {
      const v = F.vortex, vx = v.x - cam, fade = Math.min(1, v.t / .4);
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        for (let s = 0; s <= 1.001; s += .05) {
          const a = i * PI2 / 5 + t * 9 + s * 4, rad = 22 + s * 78, px = vx + Math.cos(a) * rad, pyy = GY - 8 - s * 170 + Math.sin(a) * rad * .22;
          s === 0 ? ctx.moveTo(px, pyy) : ctx.lineTo(px, pyy);
        }
        ctx.strokeStyle = `rgba(155,214,255,${.5 * fade})`; ctx.lineWidth = 2.2; ctx.stroke();
      }
      glowEll(vx, GY - 6, 110, 20, '155,214,255', .3 * fade);
    }
    // 幻影残像：假身底座 + 引爆倒计时
    for (const dc of F.decoys) {
      const dx = dc.x - cam, q = Math.max(0, dc.t / .8), flick = (T * 24 | 0) % 2 ? 1 : .6;
      ctx.strokeStyle = `rgba(129,236,236,${.7 * flick})`; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.ellipse(dx, GY - 4, 130 * (1 - q * .55), 130 * (1 - q * .55) * .2, 0, 0, PI2); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = `rgba(255,255,255,${.8 * flick})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(dx, GY - 90, 62, -Math.PI / 2, -Math.PI / 2 + PI2 * (1 - q)); ctx.stroke();
      glowEll(dx, GY - 80, 50, 100, '129,236,236', .16 * flick);
    }
    // 敌人状态：霜冻 / 眩晕
    for (const e of E) {
      if (!e || e.dead) continue;
      const ex = e.x - cam, h = e.h || 60;
      if (e._champ) {                       // 畸变巨兽：脚下血色光环 + 周身红雾
        glowEll(ex, e.y, 78, 18, '255,50,70', .5 + .15 * Math.sin(t * 6));
        glowEll(ex, e.y - h / 2, 60, h * .65, '255,40,60', .12 + .05 * Math.sin(t * 5));
      }
      if (e._slowT > 0 && has('frost_touch')) {
        glowEll(ex, e.y, 46, 12, '140,210,255', .45); glowEll(ex, e.y - h / 2, 36, h * .6, '150,215,255', .16);
        ctx.fillStyle = 'rgba(210,240,255,.8)';
        for (let i = 0; i < 3; i++) {
          const a = i * PI2 / 3 + .6, cx = ex + Math.cos(a) * 26, cy = e.y - 4 - (i % 2) * 6;
          ctx.beginPath(); ctx.moveTo(cx, cy - 12); ctx.lineTo(cx + 4, cy); ctx.lineTo(cx, cy + 3); ctx.lineTo(cx - 4, cy); ctx.closePath(); ctx.fill();
        }
      }
    }
    ctx.restore();
    for (const e of E) {
      if (e && !e.dead && e._stunT > 0) {
        for (let i = 0; i < 3; i++) {
          const a = T * 5 + i * PI2 / 3;
          txt('★', e.x - cam + Math.cos(a) * 20, e.y - (e.h || 60) - 16 + Math.sin(a) * 5, 14, '#ffd84a', 'center');
        }
      }
    }
  }

  // ================= 绘制：玩家身前（护盾 / 事件 / 屏幕效果） =================
  function drawOver() {
    if (!live() || G !== 'play') return;
    const F = ROGUE.fx, x = P.x - cam, py = bodyY(), t = T;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';

    // 镜像双生：镜像弹体加青色辉光 + 拖尾
    if (has('twin_bullet') && Array.isArray(PJ)) {
      for (const p of PJ) {
        if (!p || !p._mirror || typeof p.x !== 'number') continue;
        const px = p.x - cam, f = p.f || 1;
        glowEll(px, p.y, 26, 26, '125,249,255', .5);
        ctx.strokeStyle = 'rgba(125,249,255,.7)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(px, p.y); ctx.lineTo(px - f * 42, p.y); ctx.stroke();
      }
    }

    // 能量神盾：六角护罩（2 层时外圈再套一层）
    if (has('energy_aegis') && ROGUE.shieldStacks > 0) {
      for (let s = 0; s < ROGUE.shieldStacks; s++) {
        const rx = 58 + s * 12, ry = 98 + s * 12, a = .5 + .15 * Math.sin(t * 4 + s);
        const g = ctx.createRadialGradient(x, py, rx * .4, x, py, ry);
        g.addColorStop(0, 'rgba(0,229,255,0)'); g.addColorStop(.8, `rgba(0,229,255,${.08 + .04 * s})`); g.addColorStop(1, 'rgba(125,249,255,.28)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, py, rx, ry, 0, 0, PI2); ctx.fill();
        ctx.strokeStyle = s ? `rgba(180,140,255,${a})` : `rgba(125,249,255,${a})`; ctx.lineWidth = 2;
        if (s) ctx.setLineDash([10, 6]);
        ctx.beginPath(); ctx.ellipse(x, py, rx, ry, 0, 0, PI2); ctx.stroke(); ctx.setLineDash([]);
        for (let i = 0; i < 6; i++) {                       // 绕盾游走的六边形
          const an = t * .9 + i * PI2 / 6 + s;
          ctx.strokeStyle = `rgba(190,250,255,${.35 + .25 * Math.sin(t * 3 + i)})`; ctx.lineWidth = 1.2;
          hexPath(x + Math.cos(an) * rx, py + Math.sin(an) * ry, 9, an); ctx.stroke();
        }
      }
    }

    // 时空断裂：时钟环 + 被冻结的弹幕
    if (F.timeFrac > 0) {
      const q = Math.min(1, F.timeFrac / .6);
      ctx.strokeStyle = `rgba(190,170,255,${.8 * q})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, py, 86, 0, PI2); ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const a = i * PI2 / 12; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 78, py + Math.sin(a) * 78); ctx.lineTo(x + Math.cos(a) * 90, py + Math.sin(a) * 90); ctx.stroke();
      }
      const ha = -Math.PI / 2 - (1 - q) * PI2 * 2; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x + Math.cos(ha) * 70, py + Math.sin(ha) * 70); ctx.stroke();
      for (const e of E) if (e && !e.dead) glowEll(e.x - cam, e.y, 50, 14, '162,155,254', .5 * q);
      if (Array.isArray(EP)) {
        ctx.strokeStyle = `rgba(200,190,255,${.8 * q})`; ctx.lineWidth = 1.5;
        for (const b of EP) if (b && typeof b.x === 'number') { ctx.beginPath(); ctx.arc(b.x - cam, b.y, 11, 0, PI2); ctx.stroke(); }
      }
    }

    // 真红终焉：终结技期间血红天幕
    if (has('crimson_finale') && P.st === 'fv') {
      const g = ctx.createLinearGradient(0, 0, 0, 320); g.addColorStop(0, `rgba(255,50,30,${.38 + .08 * Math.sin(t * 10)})`); g.addColorStop(1, 'rgba(255,50,30,0)');
      ctx.fillStyle = g; ctx.fillRect(-100, -100, 1160, 420 + 100);
    }

    // ---- 事件队列 ----
    for (const o of L) {
      const q = 1 - o.t / o.d;           // 1 → 0
      if (q <= 0) continue;
      if (o.k === 'tint') { ctx.fillStyle = o.c; ctx.globalAlpha = o.a * q; ctx.fillRect(-100, -100, 1160, 740); ctx.globalAlpha = 1; }
    }
    for (const o of L) {
      const q = 1 - o.t / o.d;
      if (q <= 0 || o.k === 'tint') continue;
      const ox = (o.x !== undefined ? o.x - cam : 0);
      ctx.globalAlpha = 1;
      switch (o.k) {
        case 'ring': {
          const e = o.rev ? q : 1 - q, rr = o.r * (o.rev ? .3 + .7 * e : e);
          ctx.strokeStyle = o.c; ctx.globalAlpha = q; ctx.lineWidth = o.w * q + .5;
          ctx.beginPath(); ctx.ellipse(ox, o.y, rr, rr * o.ry, 0, 0, PI2); ctx.stroke(); break;
        }
        case 'pil': {
          const w = o.w * (.4 + .6 * q), g = ctx.createLinearGradient(ox - w, 0, ox + w, 0);
          g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, o.c); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.globalAlpha = q * .8; ctx.fillStyle = g; ctx.fillRect(ox - w, -40, w * 2, o.y + 40); break;
        }
        case 'bolt': {
          ctx.strokeStyle = o.c; ctx.globalAlpha = q; ctx.lineWidth = o.w; ctx.lineJoin = 'round'; ctx.shadowColor = o.c; ctx.shadowBlur = 12;
          ctx.beginPath(); o.pts.forEach((p, i) => i ? ctx.lineTo(p.x - cam, p.y) : ctx.moveTo(p.x - cam, p.y)); ctx.stroke(); ctx.shadowBlur = 0; break;
        }
        case 'blade': {
          const e = Math.min(1, (1 - q) * 3), x2 = o.x1 + (o.x2 - o.x1) * e, y2 = o.y1 + (o.y2 - o.y1) * e;
          ctx.strokeStyle = o.c; ctx.globalAlpha = q; ctx.lineWidth = 9 * q + 1; ctx.lineCap = 'round'; ctx.shadowColor = o.c; ctx.shadowBlur = 14;
          ctx.beginPath(); ctx.moveTo(o.x1 - cam, o.y1); ctx.lineTo(x2 - cam, y2); ctx.stroke();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 * q; ctx.stroke(); ctx.shadowBlur = 0; break;
        }
        case 'star': {
          ctx.strokeStyle = o.c; ctx.globalAlpha = q; ctx.lineWidth = 3 * q + 1; ctx.shadowColor = o.c; ctx.shadowBlur = 10;
          const len = o.r * (1 - q * .6);
          for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4 + .2, l0 = len * .3, l1 = len * (i % 2 ? .65 : 1);
            ctx.beginPath(); ctx.moveTo(ox + Math.cos(a) * l0, o.y + Math.sin(a) * l0); ctx.lineTo(ox + Math.cos(a) * l1, o.y + Math.sin(a) * l1); ctx.stroke();
          }
          ctx.shadowBlur = 0; break;
        }
        case 'x': {
          const e = Math.min(1, (1 - q) * 4), l = o.r;
          ctx.strokeStyle = o.c; ctx.globalAlpha = q; ctx.lineWidth = 7 * q + 1; ctx.lineCap = 'round'; ctx.shadowColor = o.c; ctx.shadowBlur = 14;
          for (const s of [-1, 1]) {
            ctx.beginPath(); ctx.moveTo(ox - l * e, o.y - s * l * e * .7); ctx.lineTo(ox + l * e, o.y + s * l * e * .7); ctx.stroke();
          }
          ctx.shadowBlur = 0; break;
        }
        case 'arc': {
          const e = 1 - q;
          ctx.strokeStyle = '#e8fbff'; ctx.globalAlpha = q; ctx.lineWidth = 12 * q + 1; ctx.lineCap = 'round'; ctx.shadowColor = '#7df9ff'; ctx.shadowBlur = 16;
          const a0 = o.f > 0 ? -1.2 : Math.PI - 1.2 + 2.4 * 0, span = 2.4 * Math.min(1, e * 2.5);
          ctx.beginPath();
          if (o.f > 0) ctx.arc(ox, o.y, 118, -1.2, -1.2 + span); else ctx.arc(ox, o.y, 118, Math.PI + 1.2 - span, Math.PI + 1.2);
          ctx.stroke(); ctx.shadowBlur = 0; break;
        }
        case 'crack': {
          const e = Math.min(1, (1 - q) * 3);
          ctx.strokeStyle = '#ffb48a'; ctx.globalAlpha = q; ctx.lineWidth = 3; ctx.shadowColor = '#e17055'; ctx.shadowBlur = 10;
          for (const s of [-1, 1]) {
            ctx.beginPath(); let cx = ox, cy = GY - 2; ctx.moveTo(cx, cy);
            for (let i = 1; i <= 8; i++) { cx = ox + s * o.len * e * i / 8; cy = GY - 2 + ((i * 37 + (s > 0 ? 11 : 0)) % 9) - 4; ctx.lineTo(cx, cy); }
            ctx.stroke();
          }
          ctx.shadowBlur = 0; break;
        }
        case 'met': {
          const e = 1 - q, hx = o.x + (o.tx - o.x) * e, hy = -40 + (o.ty + 40) * e;
          const tx = hx + 90 * (1 - e + .2), ty = hy - 150 * (1 - e + .2);
          const g = ctx.createLinearGradient(hx - cam, hy, tx - cam, ty); g.addColorStop(0, 'rgba(255,200,90,.95)'); g.addColorStop(1, 'rgba(255,60,30,0)');
          ctx.strokeStyle = g; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(hx - cam, hy); ctx.lineTo(tx - cam, ty); ctx.stroke();
          glowEll(hx - cam, hy, 28, 28, '255,200,90', .9); break;
        }
        case 'p': {
          const px = ox, py2 = o.y, s = o.s * (o.shape === 'dust' ? 1 + (1 - q) : q * .6 + .4);
          ctx.globalAlpha = Math.min(1, q * 1.4);
          if (o.shape === 'streak') {
            ctx.strokeStyle = o.c; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, py2); ctx.lineTo(px - o.vx * .05, py2); ctx.stroke();
          } else if (o.shape === 'hex') {
            ctx.strokeStyle = o.c; ctx.lineWidth = 1.6; hexPath(px, py2, s, o.t * 3); ctx.stroke();
          } else if (o.shape === 'shard') {
            ctx.fillStyle = o.c; ctx.save(); ctx.translate(px, py2); ctx.rotate(o.t * 9 + o.s);
            ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * .55, s * .6); ctx.lineTo(-s * .55, s * .6); ctx.closePath(); ctx.fill(); ctx.restore();
          } else if (o.shape === 'coin') {
            ctx.fillStyle = o.c; ctx.beginPath(); ctx.ellipse(px, py2, Math.max(.8, Math.abs(Math.cos(o.t * 12)) * s), s, 0, 0, PI2); ctx.fill();
            ctx.strokeStyle = '#fff6c2'; ctx.lineWidth = 1; ctx.stroke();
          } else if (o.shape === 'drop') {
            ctx.fillStyle = o.c; ctx.beginPath(); ctx.arc(px, py2, s, 0, PI2); ctx.fill();
            ctx.globalAlpha *= .5; ctx.beginPath(); ctx.arc(px, py2, s * 2, 0, PI2); ctx.fill();
          } else if (o.shape === 'rock') {
            ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = o.c; ctx.save(); ctx.translate(px, py2); ctx.rotate(o.t * 8);
            ctx.fillRect(-s / 2, -s / 2, s, s * .8); ctx.restore(); ctx.globalCompositeOperation = 'lighter';
          } else if (o.shape === 'dust') {
            ctx.globalAlpha = q * .35; ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = o.c;
            ctx.beginPath(); ctx.arc(px, py2, s, 0, PI2); ctx.fill(); ctx.globalCompositeOperation = 'lighter';
          } else if (o.shape === 'flake') {
            ctx.strokeStyle = o.c; ctx.lineWidth = 1.3; ctx.save(); ctx.translate(px, py2); ctx.rotate(o.t * 2);
            for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.stroke(); }
            ctx.restore();
          } else if (o.shape === 'ember') {
            glowEll(px, py2, s * 2.2, s * 2.2, o.c === '#ff4757' ? '255,71,87' : o.c === '#ffb142' ? '255,177,66' : '255,127,80', .9);
          } else {
            ctx.fillStyle = o.c; ctx.shadowColor = o.c; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(px, py2, s, 0, PI2); ctx.fill(); ctx.shadowBlur = 0;
          }
          break;
        }
      }
    }
    ctx.restore();
  }

  const guard = fn => function () { try { return fn.apply(this, arguments); } catch (e) { dead = true; console.warn('[rogue_fx] 特效出错，已自动关闭：', e); } };

  // ---- 挂接绘制：drawBikes 之后 = 玩家身后；drawBladeBolts 之前 = 玩家身前 ----
  const hook = (name, make) => {
    const orig = window[name];
    if (typeof orig !== 'function') { console.warn('[rogue_fx] 找不到引擎函数：' + name); return; }
    window[name] = make(orig);
  };
  hook('drawBikes', orig => function () { const r = orig.apply(this, arguments); guard(drawUnder)(); return r; });
  hook('drawBladeBolts', orig => function () { guard(drawOver)(); return orig.apply(this, arguments); });

  const api = { update: guard(update) };
  for (const k in ev) api[k] = guard(ev[k]);
  return api;
})();
