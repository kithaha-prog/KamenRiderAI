// ===== feel.js · 手感与表现 =====
// 1. 打击感：分级命中停顿 / 分级震屏 / 受击闪白 + 火花 / 受击红边 / 击杀慢动作
// 2. 镜头演出：全骑士统一的大招运镜（letterbox 黑边 + 背景压暗 + 推镜 + 技能名闪现 + 落地冲击）
// 3. 动态背景：按章节自动配天气（雨/雷暴/雪/火星/孢子/火花/虚空/圣光/星尘/灰烬）+ 昼夜色调 + 多层视差
// 4. 驱动 bgm_layers.js 的音乐强度（战况越激烈，叠的声部越多）
//
// 设计原则：
//  · 完全不改动原战斗数值；只通过「包装」hurt / hurtP / fin / tagExec，并在 main.js 里加几处 typeof FEEL 守卫的调用。
//  · 联机对局(COOP.inGame)中不改变时间流速 / 顿帧（避免与队友不同步），只保留纯视觉效果。
//  · 设置面板里可以分别关闭；「光敏安全」会削弱闪光 / 震屏 / 雷电。
//  · 想调手感：只改下面的 HS_TABLE / SK_TABLE / TOD / WX_TYPES / WX_BY_SET。

// ---------- 可调参数 ----------
// 命中停顿（秒）与最小震屏，按档位：0 普通 / 1 暴击·技能 / 2 重击 / 3 击杀
const HS_TABLE = [0.028, 0.055, 0.085, 0.10];
const SK_TABLE = [3, 7, 12, 13];

// 昼夜关键帧：[相位, r, g, b, alpha, 夜色程度]    相位 0=黎明 .25=正午 .5=黄昏 .75=午夜
const TOD = [
  [0.00, 255, 170, 120, 0.10, 0.15],
  [0.25, 255, 255, 255, 0.00, 0.00],
  [0.50, 255, 105, 45, 0.20, 0.25],
  [0.75, 12, 22, 80, 0.44, 1.00],
  [1.00, 255, 170, 120, 0.10, 0.15]
];

// 天气类型（数据驱动）
const WX_TYPES = {
  drizzle: { n: 60, shape: 'line', vy: [650, 900], vx: [-90, -60], len: [10, 16], col: '170,200,240', a: [.22, .4], dir: 'down', splash: 1, cloud: '120,135,155', cloudA: .16, amb: ['rain', .35] },
  storm:   { n: 150, shape: 'line', vy: [850, 1150], vx: [-260, -200], len: [16, 26], col: '175,195,255', a: [.28, .5], dir: 'down', splash: 1, lightning: 1, cloud: '45,52,78', cloudA: .30, amb: ['rain', .8] },
  snow:    { n: 85, shape: 'dot', vy: [35, 95], vx: [-15, 15], size: [1.4, 3.6], col: '240,248,255', a: [.5, .9], dir: 'down', sway: 22, cloud: '200,215,235', cloudA: .14, amb: ['wind', .35] },
  ember:   { n: 55, shape: 'dot', vy: [-95, -30], vx: [-20, 30], size: [1.2, 3.2], col: '255,150,50', col2: '255,220,90', a: [.5, 1], dir: 'up', sway: 14, glow: 1, flick: 1, cloud: '90,40,30', cloudA: .18, amb: ['wind', .2] },
  spore:   { n: 36, shape: 'dot', vy: [-18, 10], vx: [-14, 14], size: [2.5, 6], col: '140,255,110', a: [.2, .55], dir: 'float', sway: 26, glow: 1, cloud: '60,90,55', cloudA: .16 },
  spark:   { n: 34, shape: 'dot', vy: [18, 50], vx: [-20, 20], size: [1, 2.4], col: '255,190,90', a: [.3, .8], dir: 'down', sway: 8, glow: 1, bursts: 1, cloud: '80,80,90', cloudA: .14 },
  void:    { n: 46, shape: 'dot', vy: [-30, -8], vx: [-12, 12], size: [1.6, 4.5], col: '190,130,255', a: [.25, .7], dir: 'up', sway: 20, glow: 1, pulse: 1, cloud: '70,40,110', cloudA: .18 },
  holy:    { n: 42, shape: 'dot', vy: [-30, -8], vx: [-10, 10], size: [1.6, 4.2], col: '255,230,140', a: [.3, .8], dir: 'up', sway: 16, glow: 1, rays: 1, cloud: '255,245,215', cloudA: .14 },
  star:    { n: 60, shape: 'dot', vy: [-4, 4], vx: [-6, 6], size: [.8, 2.2], col: '200,215,255', a: [.3, 1], dir: 'float', twinkle: 1, meteor: 1, par: .06, cloud: '60,60,100', cloudA: .12 },
  ash:     { n: 60, shape: 'dot', vy: [28, 75], vx: [-26, 10], size: [1.5, 3.8], col: '200,170,170', col2: '255,90,70', a: [.35, .75], dir: 'down', sway: 20, cloud: '70,30,35', cloudA: .22, amb: ['wind', .25] }
};
// 章节(set 1~10) → 天气 / 基础时间 / 雾色
const WX_BY_SET = {
  1: { k: 'drizzle', tod: .30, mist: '159,216,224', mA: .10 },
  2: { k: 'ember', tod: .52, mist: '255,106,42', mA: .10 },
  3: { k: 'storm', tod: .80, mist: '138,160,255', mA: .10 },
  4: { k: 'snow', tod: .12, mist: '216,236,255', mA: .14 },
  5: { k: 'spore', tod: .62, mist: '125,255,106', mA: .16 },
  6: { k: 'spark', tod: .36, mist: '255,179,71', mA: .08 },
  7: { k: 'void', tod: .78, mist: '181,123,255', mA: .12 },
  8: { k: 'holy', tod: .22, mist: '255,233,160', mA: .10 },
  9: { k: 'star', tod: .86, mist: '159,176,255', mA: .08 },
  10: { k: 'ash', tod: .55, mist: '255,58,58', mA: .12 }
};
// 大招名字闪现：[英文大字, 中文小字]
const ULT_NAMES = {
  malaya: ['BUNGA RAYA BREAK', 'KAMEN RIDER MALAYA · 大红花必杀'],
  ryuki: ['FINAL VENT', 'KAMEN RIDER RYUKI · 龙骑终极之技'],
  '555': ['EXCEED CHARGE', 'KAMEN RIDER 555 · 红锥飞踢'],
  blade: ['LIGHTNING SONIC', 'KAMEN RIDER BLADE · 雷电音速'],
  zeztz: ['FINAL IMPACT', 'KAMEN RIDER ZEZTZ · 终极冲击'],
  deno: ['ORE NO WAZA', 'KAMEN RIDER DEN-O · 俺の必杀技']
};

// ---------- 主体 ----------
const FEEL = {
  KEY: 'kr_feel_v1',
  cfg: { hit: 1, cam: 1, wx: 1, bgm: 'auto', safe: 0 },   // hit: 0 关 / 1 标准 / 2 强烈
  rt: 0,            // 真实时间（不受慢动作 / 顿帧影响）
  ts: 1,            // 当前时间流速
  sm: { delay: 0, t: 0, dur: 0, scale: 1 },
  lastHsT: -9, lastTier: -1, lastSlowT: -99, kc: { t: -9, n: 0 },
  dir: 1, punch: 0, zoom: 1,
  hurtT: 0, flashA: 0, flashCol: '#fff',
  spokes: null, ult: null, dimK: 0, barK: 0, prevSt: '', gray: false,
  sp: [], rings: [],
  // 天气
  wx: null, wxKey: '', splashes: [], bursts: [], lt: null, ltNext: 3, meteor: null, lastCam: 0,
  tod: .3, todT: .3, tint: [0, 0, 0, 0, 0], _blob: {}, _dot: {}, stars: [],
  intensity: .1, tension: 0,

  // ---- 设置 ----
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) Object.assign(this.cfg, JSON.parse(raw));
      else if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) this.cfg.safe = 1;
    } catch (e) { }
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.cfg)); } catch (e) { } },
  set(k, v) { this.cfg[k] = v; this.save(); if (k === 'wx') this.wxKey = ''; },
  cycle(k) {
    const seq = { hit: [1, 2, 0], cam: [1, 0], wx: [1, 0], bgm: ['auto', 'synth', 'off'], safe: [0, 1] }[k];
    if (!seq) return;
    const i = seq.indexOf(this.cfg[k]);
    this.set(k, seq[(i + 1) % seq.length]);
  },
  label(k) {
    const v = this.cfg[k];
    if (k === 'hit') return ['关闭', '标准', '强烈'][v] || '标准';
    if (k === 'bgm') return { auto: '自动', synth: '强制分层', off: '旧版' }[v] || '自动';
    return v ? '开启' : '关闭';
  },
  coop() { return typeof COOP !== 'undefined' && COOP.active && COOP.inGame; },
  live() { return G === 'play' && !this.coop(); },
  safeK() { return this.cfg.safe ? .35 : 1; },
  q() { return TOUCH ? .55 : 1; },

  // ---- 时间流速 / 慢动作 ----
  slow(scale, dur, delay) {
    if (this.coop() || !this.cfg.hit) return;
    this.sm = { delay: delay || 0, t: 0, dur, scale };
    this.lastSlowT = this.rt;
  },

  // ---- 命中反馈 ----
  onHit(e, dmg, killed, pre, crit) {
    if (G !== 'play' || pre) return;
    const lv = this.cfg.hit, st = P.st, boss = e.t === 'boss';
    this.dir = P.f || 1;

    let tier = 0;
    if (crit) tier = 1;
    if (st === 'uppercut' || st === 'thr' || st === 'dodge') tier = Math.max(tier, 1);
    if (st === 'diveslam') tier = 2;
    if (st === 'fv') tier = (P.hit && P.hit.landed) ? 2 : 0;   // 俯冲途中的连续判定不停顿，落地爆发才重击
    if (killed && !boss) tier = 3;

    // 火花 / 闪白信息（即使关闭了顿帧也保留视觉）
    e._fc = crit || tier >= 3 ? 1 : 0;
    this.spawnHitFx(e, tier, crit, killed);

    if (!lv || this.coop()) return;
    const mul = lv === 2 ? 1.5 : 1;

    // 停顿：节流，避免一刀砍多怪 / 连续判定时画面卡成幻灯片
    const skipBossLight = boss && tier === 0;
    if (!skipBossLight && !(killed && boss) && (this.rt - this.lastHsT > .10 || tier > this.lastTier)) {
      const dur = HS_TABLE[tier] * mul;
      HITSTOP = Math.max(HITSTOP, dur);
      this.lastHsT = this.rt; this.lastTier = tier;
      e._hsUntil = this.rt + dur + .05; e._tier = tier;
    }
    shake = Math.max(shake, SK_TABLE[tier] * mul);
    if (tier >= 2) this.punch = Math.max(this.punch, (tier === 3 ? .018 : .012) * mul);

    // 慢动作击杀
    if (killed && !boss) {
      this.kc = (this.rt - this.kc.t < .08) ? { t: this.rt, n: this.kc.n + 1 } : { t: this.rt, n: 1 };
      if (this.kc.n >= 3 && this.rt - this.lastSlowT > 4) this.slow(.35, .75);
      else if (crit && this.rt - this.lastSlowT > 7) this.slow(.45, .4);
    }
    if (killed && boss) this.slow(.4, 1.0, 1.25);   // 等漫画定格(1.2s)结束后再进入慢动作
  },

  onFin(w) {
    if (this.coop()) return;
    const bossHere = E.some(e => e.t === 'boss');
    if (w) {
      this.flash('#ffffff', .3); this.punch = Math.max(this.punch, .03);
      if (!bossHere) this.slow(.3, .9);
    } else if (P.hp <= 0) {
      this.slow(.25, 1.1); this.hurtT = Math.max(this.hurtT, .9);
      try { ctx.canvas.style.transition = 'filter 1.2s'; ctx.canvas.style.filter = 'grayscale(.75) contrast(1.1)'; this.gray = true; } catch (e) { }
    }
  },

  onPlayerHurt(d) {
    this.hurtT = .5;
    if (this.live() && this.cfg.hit) {
      const big = d >= P.mh * .2;
      HITSTOP = Math.max(HITSTOP, big ? .10 : .06);
      this.punch = Math.max(this.punch, .012);
      if (big) this.slow(.5, .28);
    }
  },

  onTag() { this.punch = Math.max(this.punch, .05); this.flash(typeof formCol === 'function' ? formCol() : '#fff', .3); },

  flash(col, a) { this.flashCol = col; this.flashA = Math.max(this.flashA, a * this.safeK()); },

  spawnHitFx(e, tier, crit, killed) {
    const hx = e.x - P.f * (e.w || 80) * .25, hy = e.y - (e.h || 120) * .55 + zv(e);
    const n = [4, 9, 14, 18][tier], col = crit ? '#ff9a3a' : (tier >= 2 && inForm()) ? formCol() : '#ffe9a0';
    for (let i = 0; i < n; i++) {
      const a = (Math.random() - .5) * 2.2 + (P.f < 0 ? Math.PI : 0), v = 220 + Math.random() * (260 + tier * 90);
      this.sp.push({ x: hx, y: hy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, l: .22 + Math.random() * .18, d: .4, c: i % 3 ? col : '#ffffff', w: 1.5 + Math.random() * 1.5 });
    }
    if (tier >= 1) this.rings.push({ x: hx, y: hy, t: .22, d: .22, r: 38 + tier * 22, c: col, star: crit || killed ? 1 : 0 });
  },

  // ---- 每帧：主循环调用，返回「给 upd 的 dt」 ----
  tick(rdt) {
    rdt = Math.min(rdt, .05);
    this.rt += rdt;
    const inBattle = G === 'play' || G === 'win' || G === 'over';

    // 时间流速
    let ts = 1;
    const sm = this.sm;
    if (sm.dur > 0 && inBattle) {
      if (sm.delay > 0) sm.delay -= rdt;
      else {
        sm.t += rdt;
        const k = sm.t / sm.dur;
        if (k >= 1) { sm.dur = 0; }
        else {
          const inK = Math.min(1, sm.t / .06), out = k > .6 ? (k - .6) / .4 : 0, e = out * out * (3 - 2 * out);
          ts = 1 + (sm.scale - 1) * inK * (1 - e);
        }
      }
    } else if (!inBattle) sm.dur = 0;
    this.ts = ts;

    // 死亡灰度的复位
    if (this.gray && G !== 'over') { try { ctx.canvas.style.filter = ''; } catch (e) { } this.gray = false; }

    // 衰减量
    this.punch = Math.max(0, this.punch - this.punch * rdt * 9 - rdt * .02);
    this.hurtT = Math.max(0, this.hurtT - rdt);
    this.flashA = Math.max(0, this.flashA - rdt * 3.2);

    // 火花 / 光环（跟随世界冻结）
    const frozen = typeof HITSTOP !== 'undefined' && HITSTOP > 0;
    if (!frozen) {
      for (const s of this.sp) { s.l -= rdt; s.x += s.vx * rdt; s.y += s.vy * rdt; s.vy += 900 * rdt; }
      this.sp = this.sp.filter(s => s.l > 0);
      for (const r of this.rings) r.t -= rdt;
      this.rings = this.rings.filter(r => r.t > 0);
    }

    if (G === 'play') { this.updUlt(rdt); this.updWeather(rdt); }
    else {
      this.dimK += (0 - this.dimK) * Math.min(1, rdt * 8); this.barK += (0 - this.barK) * Math.min(1, rdt * 8); this.ult = null;
      if (typeof FEEL_AMB !== 'undefined' && FEEL_AMB.ctx) FEEL_AMB.update(null, 0, false);
    }

    // 镜头缩放平滑（大招推镜）
    const zt = this.ult && !this.ult.out && this.cfg.cam ? 1.10 : 1;
    this.zoom += (zt - this.zoom) * Math.min(1, rdt * 6);

    if (this.spokes) { this.spokes.t -= rdt; if (this.spokes.t <= 0) this.spokes = null; }

    // 音乐强度
    this.updMusic(rdt);

    this.prevSt = P.st;
    return (this.live() && this.cfg.hit) ? rdt * ts : rdt;
  },

  // ---- 大招运镜 ----
  updUlt(rdt) {
    if (!this.cfg.cam || this.coop()) { this.ult = null; this.dimK = 0; this.barK = 0; return; }
    const st = P.st;
    if (st === 'fv' && this.prevSt !== 'fv') {
      const key = typeof curRiderKey === 'function' ? curRiderKey() : 'malaya';
      this.ult = { t: 0, key, name: ULT_NAMES[key] || ULT_NAMES.malaya, col: typeof formCol === 'function' ? formCol() : '#00e5ff', landed: 0, out: 0, ot: 0 };
      HITSTOP = Math.max(HITSTOP, this.cfg.hit ? .05 : 0);
      this.flash(this.ult.col, .25);
    }
    const u = this.ult;
    if (u) {
      u.t += rdt;
      if (!u.out && P.hit && P.hit.landed && !u.landed) {
        u.landed = 1;
        this.flash('#ffffff', .6); this.punch = Math.max(this.punch, .06);
        this.spokes = { t: .45, d: .45 };
        if (this.cfg.hit && !this.coop()) HITSTOP = Math.max(HITSTOP, .09);
      }
      if (!u.out && st !== 'fv') {
        u.out = 1;
        if (!u.landed) this.flash(u.col, .3);
      }
      if (u.out) { u.ot += rdt; if (u.ot > .45) this.ult = null; }
    }
    const want = (this.ult && !this.ult.out) ? 1 : 0;
    this.dimK += (want - this.dimK) * Math.min(1, rdt * 7);
    this.barK += (want - this.barK) * Math.min(1, rdt * 9);
  },

  // ---- 音乐强度（给 bgm_layers.js） ----
  updMusic(rdt) {
    let v = 0;
    if (G === 'play') {
      v = .12;
      let near = 0, boss = null;
      for (const e of E) {
        if (e.dead) continue;
        if (e.t === 'boss') boss = e;
        if (Math.abs(e.x - P.x) < 700) near++;
      }
      v += Math.min(.28, near * .055);
      if (typeof COMBO !== 'undefined' && COMBO.count > 0) v += (COMBO.rankIdx + 1) * .045;
      if (boss) { v += .2; if (boss.hp / (boss.mhp || boss.hp || 1) <= .25 || boss.broken) v += .15; }
      if (P.mh && P.hp / P.mh < .3) v += .08;
      if (typeof TAG !== 'undefined' && TAG.crT > 0) v += .08;
      if (P.st === 'fv') v = 1;
    }
    v = Math.min(1, v);
    this.intensity += (v - this.intensity) * (1 - Math.exp(-(v > this.intensity ? 2.4 : .35) * rdt));
    if (typeof FEEL_BGM !== 'undefined') FEEL_BGM.intensity = this.intensity;
  },

  // ---- 绘制：镜头（替换 draw() 里的随机震屏那一行） ----
  applyCam(ctx) {
    const sh = shake;
    if (!this.cfg.hit && this.zoom < 1.001 && !this.punch) {      // 全关：与原版完全一致
      if (sh > 0) ctx.translate((Math.random() - .5) * sh, (Math.random() - .5) * sh);
      return;
    }
    let tx = 0, ty = 0, rot = 0;
    if (sh > 0) {
      const lvl = sh <= 5 ? 0 : sh <= 12 ? 1 : sh <= 21 ? 2 : 3;
      const m = (this.cfg.hit === 2 ? 1.25 : 1) * (this.cfg.safe ? .45 : 1), amp = sh * m;
      tx = (Math.random() - .5) * amp * .85 + this.dir * amp * .22 * Math.sin(this.rt * 70);
      ty = (Math.random() - .5) * amp * (lvl >= 2 ? .8 : 1);
      if (lvl >= 2) rot = (Math.random() - .5) * .0045 * Math.min(sh, 32) / 10 * m;
    }
    let z = this.zoom + this.punch;
    if (rot) z = Math.max(z, 1 + Math.abs(rot) * 2);
    if (z > 1.0005 || rot) {
      const px = cl(P.x - cam, 120, 840), py = cl(P.y - 100, 120, 420);
      ctx.translate(px, py); if (rot) ctx.rotate(rot); ctx.scale(z, z); ctx.translate(-px, -py);
    }
    ctx.translate(tx, ty);
  },

  // ---- 敌人受击：闪白 / 抖动 ----
  flashFilter(e) { return (e._fc && this.cfg.hit) ? 'brightness(3.6) saturate(.25)' : 'brightness(2.5)'; },
  jx(e) {
    if (!this.cfg.hit || !(e._hsUntil > this.rt)) { e._jy = 0; return 0; }
    const a = 1.2 + (e._tier | 0) * 1.1;
    e._jy = (Math.random() - .5) * a * .6;
    return (Math.random() - .5) * a * 2;
  },
  jy(e) { return e._jy || 0; },

  // ---- 背景层：昼夜 / 视差云雾 / 后景天气 ----
  wxCur() {
    if (!this.cfg.wx) return null;
    const z = (typeof ST !== 'undefined' && ST[cur]) || null;
    if (!z) return null;
    const set = (((z.set || 1) - 1) % 10) + 1;
    const key = cur + ':' + set + ':' + this.q();
    if (key !== this.wxKey || !this.wx) {
      this.wxKey = key;
      const info = WX_BY_SET[set] || WX_BY_SET[1], def = WX_TYPES[info.k];
      this.wx = { info, def, type: info.k, parts: this.mkParts(def) };
      this.todT = this.tod = info.tod;
      this.lt = null; this.ltNext = 2 + Math.random() * 3; this.meteor = null; this.bursts = []; this.splashes = [];
      if (!this.stars.length) for (let i = 0; i < 46; i++) this.stars.push({ x: Math.random() * 1400, y: Math.random() * 300, s: .6 + Math.random() * 1.4, ph: Math.random() * 6.28 });
    }
    return this.wx;
  },
  mkParts(D) {
    const n = Math.round(D.n * this.q()), out = [], R = (a, b) => a + Math.random() * (b - a);
    for (let i = 0; i < n; i++) {
      const l = D.backOnly ? 0 : (i % 100 < 55 ? 0 : 1), k = l ? 1 : .7;
      out.push({
        l, x: R(-20, 980), y: R(-20, 560), ph: Math.random() * 6.28,
        vx: R(D.vx[0], D.vx[1]) * (l ? 1.2 : .8), vy: R(D.vy[0], D.vy[1]) * (l ? 1.25 : .8),
        s: D.size ? R(D.size[0], D.size[1]) * k : 0, len: D.len ? R(D.len[0], D.len[1]) * (l ? 1.2 : .8) : 0,
        a: R(D.a[0], D.a[1]) * (l ? 1 : .75), c: (D.col2 && Math.random() < .3) ? D.col2 : D.col,
        land: GY + R(-4, 46)
      });
    }
    return out;
  },
  updWeather(dt) {
    const W = this.wxCur();
    if (!W) { if (typeof FEEL_AMB !== 'undefined' && FEEL_AMB.ctx) FEEL_AMB.update(null, 0, false); return; }
    const D = W.def, dcam = cl(cam - this.lastCam, -80, 80); this.lastCam = cam;
    // 时间随击杀进度推进
    const z = ST[cur], prog = z && z.k > 0 ? cl(kills / z.k, 0, 1) : 0;
    this.todT = W.info.tod + .10 * prog;
    this.tod += (this.todT - this.tod) * Math.min(1, dt * .5);
    this.tint = this.calcTint(this.tod);

    const sd = this.ts < 1 ? dt * Math.max(.3, this.ts) : dt;
    for (const p of W.parts) {
      const par = D.par !== undefined ? D.par : (p.l ? 1 : .55);
      p.x += (p.vx + (D.sway ? Math.cos(this.rt * 1.1 + p.ph) * D.sway * .5 : 0)) * sd - dcam * par;
      p.y += p.vy * sd;
      if (p.x < -30) p.x += 1020; else if (p.x > 990) p.x -= 1020;
      if (D.dir === 'down') {
        if (D.splash ? p.y >= p.land : p.y > 560) {
          if (D.splash && this.splashes.length < 40 && Math.random() < .5) this.splashes.push({ x: p.x, y: p.y, t: .22, d: .22 });
          p.y = -Math.random() * 60; p.x = Math.random() * 1000 - 20;
          p.land = GY + (Math.random() * 50 - 4);
        }
      } else if (D.dir === 'up') {
        if (p.y < -20) { p.y = 540 + Math.random() * 40; p.x = Math.random() * 980; }
      } else {
        if (p.y < -20) p.y += 580; else if (p.y > 560) p.y -= 580;
      }
    }
    for (const s of this.splashes) s.t -= sd;
    this.splashes = this.splashes.filter(s => s.t > 0);

    // 雷暴
    if (D.lightning) {
      this.ltNext -= dt;
      if (this.ltNext <= 0 && !this.lt) {
        const x0 = 120 + Math.random() * 720, pts = [[x0, 0]];
        let x = x0, y = 0;
        while (y < GY - 20) { y += 40 + Math.random() * 50; x += (Math.random() - .5) * 90; pts.push([x, y]); }
        this.lt = { t: .32, d: .32, pts };
        this.ltNext = 4 + Math.random() * 6;
        if (typeof FEEL_AMB !== 'undefined') FEEL_AMB.thunder(.18 + Math.random() * .5);
        if (!this.cfg.safe) { shake = Math.max(shake, 3); }
      }
      if (this.lt) { this.lt.t -= dt; if (this.lt.t <= 0) this.lt = null; }
    }
    // 火花迸发
    if (D.bursts) {
      this.burstT = (this.burstT || 1.5) - dt;
      if (this.burstT <= 0) {
        this.burstT = 1.5 + Math.random() * 2.2;
        const bx = 150 + Math.random() * 660;
        for (let i = 0; i < 10; i++) this.bursts.push({ x: bx, y: GY - Math.random() * 40, vx: (Math.random() - .5) * 520, vy: -120 - Math.random() * 220, l: .6 + Math.random() * .4 });
      }
      for (const b of this.bursts) { b.l -= sd; b.x += b.vx * sd - dcam; b.y += b.vy * sd; b.vy += 700 * sd; }
      this.bursts = this.bursts.filter(b => b.l > 0);
    }
    // 流星
    if (D.meteor) {
      if (!this.meteor) { this.meteorT = (this.meteorT === undefined ? 3 : this.meteorT) - dt; if (this.meteorT <= 0) { this.meteor = { x: 300 + Math.random() * 600, y: 20 + Math.random() * 120, t: .7 }; this.meteorT = 4 + Math.random() * 5; } }
      else { this.meteor.t -= dt; this.meteor.x -= 520 * dt; this.meteor.y += 240 * dt; if (this.meteor.t <= 0) this.meteor = null; }
    }

    // 环境音
    if (typeof FEEL_AMB !== 'undefined') FEEL_AMB.update(D.amb ? D.amb[0] : null, D.amb ? D.amb[1] : 0, G === 'play');
  },
  calcTint(p) {
    p = ((p % 1) + 1) % 1;
    let i = 0; while (i < TOD.length - 2 && TOD[i + 1][0] <= p) i++;
    const a = TOD[i], b = TOD[i + 1], k = (p - a[0]) / (b[0] - a[0]);
    return [0, 1, 2, 3, 4, 5].slice(1).map(j => a[j] + (b[j] - a[j]) * k);   // [r,g,b,alpha,night]
  },
  blob(col) {
    let c = this._blob[col]; if (c) return c;
    c = document.createElement('canvas'); c.width = 128; c.height = 64;
    const g = c.getContext('2d'); g.translate(64, 32); g.scale(1, .5);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 64); gr.addColorStop(0, 'rgba(' + col + ',1)'); gr.addColorStop(1, 'rgba(' + col + ',0)');
    g.fillStyle = gr; g.fillRect(-64, -64, 128, 128);
    return this._blob[col] = c;
  },
  dot(col) {
    let c = this._dot[col]; if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(' + col + ',1)'); gr.addColorStop(.35, 'rgba(' + col + ',.6)'); gr.addColorStop(1, 'rgba(' + col + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    return this._dot[col] = c;
  },

  drawBackFx(ctx) {
    if (G !== 'play' && G !== 'win' && G !== 'over') return;
    const W = this.wxCur(); if (!W) return;
    const D = W.def, tn = this.tint, night = tn[4], R = this.rt;
    ctx.save();

    // 1) 昼夜色调：只盖在背景上，角色 / 敌人仍保持明亮
    if (tn[3] > .01) { ctx.fillStyle = 'rgba(' + (tn[0] | 0) + ',' + (tn[1] | 0) + ',' + (tn[2] | 0) + ',' + tn[3].toFixed(3) + ')'; ctx.fillRect(-60, -40, 1080, 620); }

    // 2) 星空 / 月亮（夜晚）
    if (night > .35 || D.meteor) {
      const a = D.meteor ? Math.max(.6, night) : night;
      ctx.fillStyle = '#fff';
      for (const s of this.stars) {
        const x = ((s.x - cam * .04) % 1000 + 1000) % 1000 - 20;
        ctx.globalAlpha = a * (.35 + .65 * Math.abs(Math.sin(R * 1.6 + s.ph)));
        ctx.fillRect(x, s.y, s.s, s.s);
      }
      if (!D.meteor && night > .6) {
        const mx = 790 - cam * .02 % 60, my = 86;
        ctx.globalAlpha = (night - .5) * .9; ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(this.dot('255,250,225'), mx - 70, my - 70, 140, 140);
        ctx.globalAlpha = (night - .5) * 1.2; ctx.drawImage(this.dot('255,255,245'), mx - 18, my - 18, 36, 36);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }

    // 3) 远景云层（视差 0.18）
    ctx.globalCompositeOperation = D.glow ? 'lighter' : 'source-over';
    const cb = this.blob(D.cloud);
    for (let i = 0; i < 6; i++) {
      const w = 340 + (i * 53 % 180), x = (((i * 260 - cam * .18 + R * (5 + i)) % 1500) + 1500) % 1500 - 300, y = 30 + (i * 37 % 120);
      ctx.globalAlpha = D.cloudA * (.7 + .3 * Math.sin(R * .3 + i));
      ctx.drawImage(cb, x, y, w, w * .3);
    }
    // 4) 近地雾（视差 0.6）
    const mb = this.blob(W.info.mist);
    ctx.globalCompositeOperation = (W.type === 'ember' || W.type === 'spore' || W.type === 'void' || W.type === 'holy' || W.type === 'ash') ? 'lighter' : 'source-over';
    for (let i = 0; i < 5; i++) {
      const w = 520 + (i * 71 % 240), x = (((i * 300 - cam * .6 + R * (7 + i * 2)) % 1700) + 1700) % 1700 - 350;
      ctx.globalAlpha = W.info.mA * (.7 + .3 * Math.sin(R * .5 + i * 2));
      ctx.drawImage(mb, x, GY - w * .09 - 8, w, w * .22);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;

    // 5) 圣光射线
    if (D.rays) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const x0 = (((i * 210 - cam * .3) % 1100) + 1100) % 1100 - 80, w = 90 + (i * 37 % 70), sk = 160 + i * 20;
        const gr = ctx.createLinearGradient(0, 0, 0, GY);
        const a = (.075 + .03 * Math.sin(R * .8 + i * 1.7)) * (1 - night * .5);
        gr.addColorStop(0, 'rgba(255,240,190,' + a.toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,240,190,0)');
        ctx.fillStyle = gr; ctx.beginPath();
        ctx.moveTo(x0, 0); ctx.lineTo(x0 + w, 0); ctx.lineTo(x0 + w - sk, GY); ctx.lineTo(x0 - sk, GY); ctx.closePath(); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // 6) 流星
    if (this.meteor) {
      const m = this.meteor, gr = ctx.createLinearGradient(m.x, m.y, m.x + 90, m.y - 42);
      gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = gr; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x + 90, m.y - 42); ctx.stroke();
    }
    // 7) 闪电
    if (this.lt) {
      const l = this.lt, k = l.t / l.d, flick = (k > .75 || (k < .55 && k > .35)) ? 1 : .35;
      ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(210,225,255,' + (flick * this.safeK()).toFixed(2) + ')';
      ctx.shadowColor = '#9fb8ff'; ctx.shadowBlur = 18; ctx.lineWidth = 3;
      ctx.beginPath(); l.pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
      ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'source-over';
    }
    // 8) 夜间暗角 + 角色辉光
    if (night > .3) {
      const gr = ctx.createRadialGradient(480, 280, 260, 480, 280, 620);
      gr.addColorStop(0, 'rgba(0,0,10,0)'); gr.addColorStop(1, 'rgba(0,0,14,' + (night * .38).toFixed(3) + ')');
      ctx.fillStyle = gr; ctx.fillRect(-60, -40, 1080, 620);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(.22, night * .22);
      ctx.drawImage(this.blob('120,200,255'), P.x - cam - 150, P.y - 60 + zv({ z: P.z }) - 40, 300, 100);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    // 9) 大招：只压暗背景（角色和敌人仍然高亮，形成「聚光」）
    if (this.dimK > .01) { ctx.fillStyle = 'rgba(4,6,16,' + (.42 * this.dimK).toFixed(3) + ')'; ctx.fillRect(-60, -40, 1080, 620); }

    // 10) 后景粒子
    this.drawParts(ctx, W, 0);
    ctx.restore();
  },

  drawParts(ctx, W, layer) {
    const D = W.def, R = this.rt;
    if (D.shape === 'line') {
      ctx.save();
      ctx.strokeStyle = 'rgba(' + D.col + ',' + (layer ? .5 : .28) + ')'; ctx.lineWidth = layer ? 1.4 : 1;
      ctx.beginPath();
      for (const p of W.parts) {
        if (p.l !== layer) continue;
        const k = p.len / Math.hypot(p.vx, p.vy);
        ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.vx * k, p.y + p.vy * k);
      }
      ctx.stroke(); ctx.restore();
      return;
    }
    ctx.save();
    ctx.globalCompositeOperation = D.glow ? 'lighter' : 'source-over';
    for (const p of W.parts) {
      if (p.l !== layer) continue;
      let a = p.a;
      if (D.flick) a *= .65 + .35 * Math.sin(R * 9 + p.ph);
      else if (D.pulse) a *= .6 + .4 * Math.sin(R * 2 + p.ph);
      else if (D.twinkle) a *= .4 + .6 * Math.abs(Math.sin(R * 2.2 + p.ph));
      ctx.globalAlpha = Math.max(0, Math.min(1, a));
      const s = p.s * 2.4;
      ctx.drawImage(this.dot(p.c), p.x - s, p.y - s, s * 2, s * 2);
    }
    ctx.restore();
  },

  // ---- 前景层（在相机变换内、伤害数字之前）：近景天气 / 火花 / 光环 / 前景虚化 ----
  drawFrontFx(ctx) {
    // 命中火花与光环（世界坐标）
    if (this.sp.length || this.rings.length) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (const s of this.sp) {
        const k = Math.max(0, s.l / s.d), x = s.x - cam, y = s.y;
        ctx.strokeStyle = s.c; ctx.globalAlpha = Math.min(1, k * 1.6); ctx.lineWidth = s.w;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s.vx * .035, y - s.vy * .035); ctx.stroke();
      }
      for (const r of this.rings) {
        const p = r.t / r.d, rad = r.r * (1 - p * .6) + 8, x = r.x - cam;
        ctx.globalAlpha = p; ctx.strokeStyle = r.c; ctx.lineWidth = 3 * p + 1;
        ctx.beginPath(); ctx.arc(x, r.y, rad, 0, 7); ctx.stroke();
        if (r.star) {
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5 * p + .5; const L = rad * 1.5;
          ctx.beginPath(); ctx.moveTo(x - L, r.y); ctx.lineTo(x + L, r.y); ctx.moveTo(x, r.y - L); ctx.lineTo(x, r.y + L); ctx.stroke();
        }
      }
      ctx.restore();
    }
    const W = this.wx;
    if (!this.cfg.wx || !W || G !== 'play') return;
    // 前景粒子
    this.drawParts(ctx, W, 1);
    // 雨滴落地涟漪
    if (this.splashes.length) {
      ctx.save(); ctx.strokeStyle = 'rgba(190,210,240,.5)'; ctx.lineWidth = 1;
      for (const s of this.splashes) { const p = 1 - s.t / s.d; ctx.globalAlpha = (1 - p) * .7; ctx.beginPath(); ctx.ellipse(s.x, s.y, 3 + p * 9, 1 + p * 3, 0, 0, 7); ctx.stroke(); }
      ctx.restore();
    }
    // 火花迸发
    if (this.bursts.length) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 1.6;
      for (const b of this.bursts) { ctx.globalAlpha = Math.min(1, b.l * 2); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * .03, b.y - b.vy * .03); ctx.stroke(); }
      ctx.restore();
    }
    // 近景虚化大光斑（视差 1.5，增强纵深感）
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const bb = this.blob(W.info.mist);
    for (let i = 0; i < 3; i++) {
      const w = 160 + i * 60, x = (((i * 430 - cam * 1.5 + this.rt * (12 + i * 5)) % 1300) + 1300) % 1300 - 200, y = 360 + i * 55 + Math.sin(this.rt * .6 + i) * 10;
      ctx.globalAlpha = .05; ctx.drawImage(bb, x, y, w, w * .5);
    }
    ctx.restore();
  },

  // ---- 屏幕后处理（在相机变换外） ----
  drawOverlay(ctx) {
    if (G !== 'play' && G !== 'win' && G !== 'over') return;
    const W = 960, H = 540, sk = this.safeK();
    ctx.save();

    // 雷暴白闪
    if (this.lt && !this.cfg.safe) {
      const k = this.lt.t / this.lt.d, a = (k > .75 ? .35 : (k < .55 && k > .35) ? .22 : .06) * (k > .1 ? 1 : 0);
      ctx.fillStyle = 'rgba(200,215,255,' + a.toFixed(3) + ')'; ctx.fillRect(0, 0, W, H);
    }
    // 受击红边 + 低血量心跳
    let ra = 0;
    if (this.hurtT > 0) ra = this.hurtT / .5 * .5 * (this.cfg.safe ? .6 : 1);
    if (G === 'play' && !P.down && P.mh && P.hp / P.mh < .3 && P.hp > 0) ra = Math.max(ra, (.10 + .07 * Math.sin(this.rt * 6)) * (this.cfg.safe ? .6 : 1));
    if (G === 'over') ra = Math.max(ra, .35);
    if (ra > .01) {
      const gr = ctx.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .95);
      gr.addColorStop(0, 'rgba(160,0,0,0)'); gr.addColorStop(1, 'rgba(190,10,20,' + ra.toFixed(3) + ')');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    }

    // 大招：letterbox 黑边
    if (this.barK > .01) {
      const h = 46 * this.barK;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, h); ctx.fillRect(0, H - h, W, h);
      const u = this.ult;
      if (u) { ctx.fillStyle = u.col; ctx.globalAlpha = .8 * this.barK; ctx.fillRect(0, h - 2, W, 2); ctx.fillRect(0, H - h, W, 2); ctx.globalAlpha = 1; }
    }
    // 大招：速度线（俯冲阶段）
    const u = this.ult;
    if (u && !u.out && u.t > .4) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 22; i++) {
        const ang = i / 22 * Math.PI * 2 + i * .37, ph = (this.rt * 2.2 + i * .173) % 1;
        const r0 = 300 + ph * 260, r1 = r0 + 90 + (i % 3) * 30;
        ctx.globalAlpha = (1 - ph) * .22 * sk;
        ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(ang) * r0 * 1.3, H / 2 + Math.sin(ang) * r0 * .8); ctx.lineTo(W / 2 + Math.cos(ang) * r1 * 1.3, H / 2 + Math.sin(ang) * r1 * .8); ctx.stroke();
      }
      ctx.restore();
    }
    // 大招：技能名闪现
    if (u && u.t < 1.35) this.drawBanner(ctx, u);
    // 落地冲击射线
    if (this.spokes) {
      const k = this.spokes.t / this.spokes.d, px = cl(P.x - cam, 0, W), py = cl(P.y - 90, 0, H);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#fff';
      for (let i = 0; i < 26; i++) {
        const a = i / 26 * Math.PI * 2 + i * .21, r0 = 40 + (1 - k) * 220, r1 = r0 + 140 + (i % 4) * 60;
        ctx.globalAlpha = k * .6 * sk; ctx.lineWidth = 2.5 * k + .5;
        ctx.beginPath(); ctx.moveTo(px + Math.cos(a) * r0, py + Math.sin(a) * r0 * .7); ctx.lineTo(px + Math.cos(a) * r1, py + Math.sin(a) * r1 * .7); ctx.stroke();
      }
      ctx.restore();
    }
    // 全屏闪光
    if (this.flashA > .01) { ctx.globalAlpha = Math.min(1, this.flashA); ctx.fillStyle = this.flashCol; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  },

  drawBanner(ctx, u) {
    const t = u.t, dur = 1.35, W = 960;
    const inK = Math.min(1, t / .28), eI = 1 - Math.pow(1 - inK, 3), outK = t > dur - .3 ? (t - (dur - .3)) / .3 : 0;
    const cx = W / 2 - (1 - eI) * 760 + outK * 760, cy = 150;
    ctx.save();
    ctx.globalAlpha = 1 - outK * .7;
    ctx.font = 'italic 900 50px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    const bw = ctx.measureText(u.name[0]).width + 130;
    ctx.save(); ctx.translate(cx, cy); ctx.transform(1, 0, -.22, 1, 0, 0);
    ctx.fillStyle = 'rgba(5,8,18,.84)'; ctx.fillRect(-bw / 2, -44, bw, 88);
    ctx.fillStyle = u.col; ctx.fillRect(-bw / 2, -44, bw, 3); ctx.fillRect(-bw / 2, 41, bw, 3);
    ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(-bw / 2, -41, bw * .45, 82);
    ctx.restore();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = '#050711'; ctx.strokeText(u.name[0], cx, cy - 6);
    ctx.fillStyle = '#fff'; ctx.shadowColor = u.col; ctx.shadowBlur = 20; ctx.fillText(u.name[0], cx, cy - 6);
    ctx.shadowBlur = 0; ctx.font = '800 14px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = u.col; ctx.fillText(u.name[1], cx, cy + 28);
    ctx.restore();
  }
};
FEEL.load();

// ---------- 包装现有函数（不改原文件） ----------
(function installFeelHooks() {
  const wrap = (name, fn) => {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function () { return fn.call(this, orig, arguments); };
  };

  // 所有命中的统一入口
  wrap('hurt', function (orig, args) {
    const e = args[0], pre = args[2];
    if (!e || G !== 'play') return orig.apply(this, args);
    const hp0 = e.hp, dead0 = e.dead, n0 = DT.length;
    const r = orig.apply(this, args);
    try {
      const dmg = hp0 - e.hp;
      if (dmg > 0 || (e.dead && !dead0)) {
        let crit = false;
        for (let i = n0; i < DT.length; i++) if (DT[i].c === '#ff8a2a') { crit = true; break; }
        FEEL.onHit(e, dmg, !!e.dead && !dead0, pre, crit);
      }
    } catch (err) { }
    return r;
  });

  wrap('hurtP', function (orig, args) {
    const hp0 = P.hp, r = orig.apply(this, args);
    try { if (P.hp < hp0) FEEL.onPlayerHurt(hp0 - P.hp); } catch (err) { }
    return r;
  });

  wrap('fin', function (orig, args) {
    if (G === 'play') { try { FEEL.onFin(args[0]); } catch (err) { } }
    return orig.apply(this, args);
  });

  wrap('tagExec', function (orig, args) {
    const r = orig.apply(this, args);
    try { FEEL.onTag(); } catch (err) { }
    return r;
  });

  if (typeof CAMERA !== 'undefined' && CAMERA.onParry) {
    const op = CAMERA.onParry.bind(CAMERA);
    CAMERA.onParry = function (x, y) { op(x, y); FEEL.flash('#ffd84a', .3); };
  }
})();
