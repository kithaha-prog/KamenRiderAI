// ===== bgm_layers.js · 分层自适应音乐 + 环境音 =====
// 与 cinema.js 的 DYNAMIC_BGM 协作：
//   · DYNAMIC_BGM 仍然负责「状态机」（道中 mob → 领主 boss_rock → 处刑 climax → 胜利 victory）
//   · 当没有 Assets/BGM/*.mp3（或设置里选了「强制分层」）时，原来那个单声部的合成器被本引擎替换：
//       - 同一首曲子里持续运行，状态切换只改速度 / 调性，不会硬切断
//       - 战况强度 FEEL_BGM.intensity（0~1，由 feel.js 每帧计算：敌人数 / 连击评级 / Boss / 血量 / 大招）
//         决定叠几层：垫底(pad)+底鼓 → 贝斯 → 踩镲 → 军鼓 → 琶音 → 主旋律 → 合唱
//   · 顿帧 / 慢动作时整体做低通「闷音」，和画面同步
// 声音全部用 Web Audio 实时合成，零素材依赖。
// 想调：LAYERS（出现阈值与音量）、CHORDS（和弦）、LEAD（主旋律）。

const FEEL_BGM_LAYERS = {
  //        出现阈值 thr / 渐入宽度 w / 音量 vol
  pad:    { thr: -1,  w: .01, vol: .55 },
  kick:   { thr: -1,  w: .01, vol: .90 },
  bass:   { thr: .10, w: .12, vol: .80 },
  hat:    { thr: .22, w: .12, vol: .35 },
  snare:  { thr: .34, w: .12, vol: .60 },
  arp:    { thr: .50, w: .12, vol: .35 },
  lead:   { thr: .72, w: .10, vol: .40 },
  choir:  { thr: .88, w: .08, vol: .35 }
};
// A 小调：Am - F - C - G
const FEEL_CHORDS = [
  { r: 45, t: [0, 3, 7] }, { r: 41, t: [0, 4, 7] }, { r: 48, t: [0, 4, 7] }, { r: 43, t: [0, 4, 7] }
];
// 主旋律（每小节 16 步：步号 → MIDI 音高）
const FEEL_LEAD = [
  { 0: 76, 3: 74, 4: 72, 8: 69, 10: 72, 12: 76 },
  { 0: 77, 3: 76, 4: 72, 8: 69, 10: 72, 12: 77 },
  { 0: 76, 3: 79, 4: 76, 8: 72, 10: 74, 12: 76 },
  { 0: 74, 3: 71, 4: 74, 8: 79, 10: 76, 12: 74, 14: 71 }
];
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

const FEEL_BGM = {
  ctx: null, bus: null, lp: null, comp: null, noise: null, layers: {}, pres: {},
  timer: null, running: false, stage: 'mob', step: 0, nextT: 0, intensity: .1, tok: 0,

  ready() {
    if (this.ctx) return true;
    if (typeof DYNAMIC_BGM === 'undefined') return false;
    try { DYNAMIC_BGM.init(); } catch (e) { }
    const c = DYNAMIC_BGM.ctx;
    if (!c || !DYNAMIC_BGM.masterGain) return false;
    this.ctx = c;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.knee.value = 10; this.comp.ratio.value = 5; this.comp.attack.value = .004; this.comp.release.value = .12;
    this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 16000; this.lp.Q.value = .7;
    this.bus = c.createGain(); this.bus.gain.value = 0;
    this.bus.connect(this.lp); this.lp.connect(this.comp); this.comp.connect(DYNAMIC_BGM.masterGain);
    for (const k in FEEL_BGM_LAYERS) { const g = c.createGain(); g.gain.value = 0; g.connect(this.bus); this.layers[k] = g; this.pres[k] = 0; }
    const n = c.sampleRate, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    return true;
  },

  // ---- 与 DYNAMIC_BGM 的接口 ----
  start(stage) {
    if (!this.ready()) return false;
    const c = this.ctx, now = c.currentTime;
    this.stage = stage;
    if (c.state === 'suspended') c.resume();
    if (stage === 'victory') { this.fanfare(); return true; }
    this.tok++;
    this.bus.gain.cancelScheduledValues(now);
    this.bus.gain.setTargetAtTime(1, now, .25);
    if (!this.running) {
      this.running = true; this.step = 0; this.nextT = now + .08;
      this.timer = setInterval(() => this.sched(), 25);
    }
    return true;
  },

  stop(fade) {
    if (!this.running || !this.ctx) return;
    fade = fade === undefined ? .6 : fade;
    const tok = ++this.tok, now = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(now);
    this.bus.gain.setTargetAtTime(0, now, Math.max(.05, fade / 3));
    setTimeout(() => {
      if (tok !== this.tok) return;
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
      this.running = false;
    }, fade * 1000 + 150);
  },

  stepDur() {
    const base = this.stage === 'climax' ? 142 : this.stage === 'boss_rock' ? 128 : 120;
    const tempo = base + this.intensity * 8, ts = Math.max(.4, (typeof FEEL !== 'undefined' ? FEEL.ts : 1) || 1);
    return 60 / tempo / 4 / ts;
  },

  sched() {
    const c = this.ctx;
    if (!c || !this.running) return;
    const now = c.currentTime;
    let I = this.intensity;
    if (this.stage === 'climax') I = Math.max(I, .92);
    for (const k in FEEL_BGM_LAYERS) {
      const L = FEEL_BGM_LAYERS[k], p = Math.max(0, Math.min(1, (I - L.thr) / L.w));
      this.pres[k] = p;
      this.layers[k].gain.setTargetAtTime(L.vol * p, now, .3);
    }
    // 顿帧 / 慢动作 → 闷音
    const muffle = (typeof HITSTOP !== 'undefined' && HITSTOP > .06) || (typeof FEEL !== 'undefined' && FEEL.ts < .75);
    this.lp.frequency.setTargetAtTime(muffle ? 1200 : 16000, now, muffle ? .04 : .12);

    if (this.nextT < now - .25) this.nextT = now + .05;   // 页面被挂起后追不上，直接重置
    const play = G === 'play';
    while (this.nextT < now + .12) {
      const sd = this.stepDur();
      if (play) { try { this.playStep(this.step, this.nextT, sd, I); } catch (e) { } }
      this.nextT += sd; this.step++;
    }
  },

  // ---- 发声原语 ----
  tone(dest, type, freq, t, dur, vol, o) {
    o = o || {};
    const c = this.ctx, osc = c.createOscillator(), g = c.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    if (o.det) osc.detune.value = o.det;
    const atk = o.atk || .004, rel = o.rel || .05;
    g.gain.setValueAtTime(.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + atk);
    g.gain.setValueAtTime(vol, Math.max(t + atk, t + dur - rel));
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    let tail = g;
    osc.connect(g);
    if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; g.connect(f); tail = f; }
    tail.connect(dest);
    osc.start(t); osc.stop(t + dur + .02);
  },
  hit(dest, t, dur, vol, ftype, freq, q) {
    const c = this.ctx, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    n.buffer = this.noise; n.loop = true;
    f.type = ftype; f.frequency.value = freq; if (q) f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(dest);
    n.start(t, Math.random() * .5); n.stop(t + dur + .02);
  },

  // ---- 每一个 16 分音符 ----
  playStep(s, t, sd, I) {
    const L = this.layers, P_ = this.pres, st = s & 15, bar = s >> 4, chord = FEEL_CHORDS[bar & 3];
    const tran = this.stage === 'climax' ? 2 : 0, c = this.ctx;

    // 垫底和弦（每小节一次）
    if (st === 0 && P_.pad > .03) {
      for (const iv of chord.t) for (const det of [-8, 8]) this.tone(L.pad, 'sawtooth', mtof(chord.r + 12 + iv + tran), t, sd * 16, .035, { atk: .35, rel: .4, lp: 1100, det });
    }
    // 底鼓
    if (P_.kick > .03) {
      const on = st % 4 === 0 || (I > .65 && st === 10) || (I > .85 && st === 14);
      if (on) {
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .12);
        g.gain.setValueAtTime(.9, t); g.gain.exponentialRampToValueAtTime(.001, t + .16);
        o.connect(g); g.connect(L.kick); o.start(t); o.stop(t + .18);
      }
    }
    // 贝斯：八分音符推进
    if (P_.bass > .03 && st % 2 === 0) {
      let m = chord.r + tran;
      if (st % 8 === 6) m += 7; else if (st === 14 && I > .5) m += 12;
      this.tone(L.bass, 'sawtooth', mtof(m), t, sd * 1.7, .22, { lp: 520, rel: .06 });
    }
    // 踩镲
    if (P_.hat > .03) {
      const pat = I > .75 ? true : I > .5 ? st % 2 === 0 : st % 4 === 2;
      if (pat) {
        const open = st === 14 && I > .7;
        this.hit(L.hat, t, open ? .12 : .04, (st % 4 === 2 ? .22 : .13), 'highpass', 7500);
      }
    }
    // 军鼓（+ 小节尾过门）
    if (P_.snare > .03) {
      const fill = I > .8 && (bar & 3) === 3 && (st === 11 || st === 13 || st === 14 || st === 15);
      if (st === 4 || st === 12 || fill) {
        this.hit(L.snare, t, .13, .28, 'bandpass', 2000, .8);
        this.tone(L.snare, 'triangle', 200, t, .08, .18, {});
      }
    }
    // 琶音
    if (P_.arp > .03) {
      const idx = [0, 1, 2, 1][st & 3], m = chord.r + 24 + chord.t[idx] + tran;
      this.tone(L.arp, 'square', mtof(m), t, sd * .9, .09, { lp: 2600 });
      if (I > .78) this.tone(L.arp, 'sawtooth', mtof(m + 12), t, sd * .8, .05, { lp: 3500, det: 6 });
    }
    // 主旋律
    if (P_.lead > .03) {
      const note = FEEL_LEAD[bar & 3][st];
      if (note) {
        let len = 2; for (let k = st + 1; k < 16 && !FEEL_LEAD[bar & 3][k]; k++) len++;
        len = Math.min(len, 4);
        for (const det of [-7, 7]) this.tone(L.lead, 'sawtooth', mtof(note + tran), t, sd * len, .08, { lp: 3200, atk: .01, rel: .08, det });
      }
    }
    // 合唱（每小节一次，最高强度）
    if (st === 0 && P_.choir > .03) {
      for (const iv of chord.t) {
        this.tone(L.choir, 'triangle', mtof(chord.r + 24 + iv + tran), t, sd * 16, .06, { atk: .5, rel: .5 });
        this.tone(L.choir, 'sine', mtof(chord.r + 36 + iv + tran), t, sd * 16, .03, { atk: .6, rel: .5 });
      }
    }
  },

  // 胜利号角：上行琶音 + 长和弦，然后淡出
  fanfare() {
    const c = this.ctx, now = c.currentTime;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.running = false; this.tok++;
    this.bus.gain.cancelScheduledValues(now); this.bus.gain.setTargetAtTime(1, now, .05);
    this.lp.frequency.setTargetAtTime(16000, now, .05);
    const d = this.layers.lead;
    d.gain.cancelScheduledValues(now); d.gain.setValueAtTime(1, now);
    [57, 61, 64, 69, 73, 76, 81].forEach((m, k) => this.tone(d, 'sawtooth', mtof(m), now + .05 + k * .085, .5, .12, { lp: 3500 }));
    [69, 73, 76, 81].forEach(m => { this.tone(d, 'sawtooth', mtof(m), now + .7, 1.8, .09, { lp: 3000, rel: .6 }); this.tone(d, 'triangle', mtof(m - 12), now + .7, 1.8, .1, { rel: .6 }); });
    this.hit(d, now + .7, .9, .25, 'highpass', 5000);
    const tok = this.tok;
    setTimeout(() => { if (tok !== this.tok || !this.bus) return; this.bus.gain.setTargetAtTime(0, this.ctx.currentTime, .3); }, 2400);
  }
};

// ===================================================================
//  环境音：雨声 / 风声 / 雷声（和天气同步）
// ===================================================================
const FEEL_AMB = {
  ctx: null, out: null, rain: null, wind: null, noise: null, cur: null,

  ready() {
    if (this.ctx) return true;
    if (typeof DYNAMIC_BGM === 'undefined') return false;
    if (!DYNAMIC_BGM.ctx) { try { DYNAMIC_BGM.init(); } catch (e) { } }
    const c = DYNAMIC_BGM.ctx;
    if (!c) return false;
    try {
      this.ctx = c;
      this.out = c.createGain(); this.out.gain.value = .6; this.out.connect(c.destination);
      const n = c.sampleRate * 2, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
      const mk = (f1, f2, q) => {
        const s = c.createBufferSource(); s.buffer = buf; s.loop = true;
        const a = c.createBiquadFilter(), b = c.createBiquadFilter(), g = c.createGain(); g.gain.value = 0;
        a.type = f1[0]; a.frequency.value = f1[1]; b.type = f2[0]; b.frequency.value = f2[1]; if (q) a.Q.value = q;
        s.connect(a); a.connect(b); b.connect(g); g.connect(this.out); s.start(0, Math.random());
        return g;
      };
      this.rain = mk(['highpass', 1200], ['lowpass', 7000]);
      this.wind = mk(['bandpass', 320], ['lowpass', 900], .6);
      // 风声缓慢起伏
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = .13; lg.gain.value = .02;
      lfo.connect(lg); lg.connect(this.wind.gain); lfo.start();
      return true;
    } catch (e) { this.ctx = null; return false; }
  },

  // type: 'rain' | 'wind' | null；lvl 0~1；on=是否处于战斗中
  update(type, lvl, on) {
    if (!on || !type) { if (!this.ctx) return; }
    else if (!this.ready()) return;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const rl = on && type === 'rain' ? lvl * .12 : 0, wl = on && type === 'wind' ? lvl * .10 : 0;
    this.rain.gain.setTargetAtTime(rl, now, .6);
    // 风声的 gain 同时被 LFO 调制，基础值设为目标
    this.wind.gain.setTargetAtTime(wl, now, .6);
  },

  thunder(delay) {
    if (!this.ready()) return;
    try {
      const c = this.ctx, t0 = c.currentTime + (delay || .2), dur = 1.8;
      const n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      n.buffer = this.noise; n.loop = true; f.type = 'lowpass';
      f.frequency.setValueAtTime(420, t0); f.frequency.exponentialRampToValueAtTime(60, t0 + dur);
      g.gain.setValueAtTime(.0001, t0); g.gain.linearRampToValueAtTime(.5, t0 + .06);
      g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
      n.connect(f); f.connect(g); g.connect(this.out); n.start(t0, Math.random()); n.stop(t0 + dur + .05);
      const o = c.createOscillator(), og = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(70, t0); o.frequency.exponentialRampToValueAtTime(30, t0 + dur);
      og.gain.setValueAtTime(.0001, t0); og.gain.linearRampToValueAtTime(.35, t0 + .08); og.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
      o.connect(og); og.connect(this.out); o.start(t0); o.stop(t0 + dur + .05);
    } catch (e) { }
  }
};

// ===================================================================
//  接入 DYNAMIC_BGM（不修改 cinema.js）
// ===================================================================
(function hookDynamicBgm() {
  if (typeof DYNAMIC_BGM === 'undefined') return;
  const D = DYNAMIC_BGM;
  const origSwitch = D.switchTrack.bind(D), origStop = D.stop.bind(D), origSynth = D.playSynth.bind(D);

  D.switchTrack = function (name, fade) {
    const mode = (typeof FEEL !== 'undefined') ? FEEL.cfg.bgm : 'auto';
    if (this.enabled && mode !== 'off') {
      this.init();
      if (mode === 'synth') {
        for (const k in this.tracks) { try { this.tracks[k].audio.pause(); } catch (e) { } }
        this.isSynthMode = true;
      } else {
        // auto：只要有一条素材加载失败就走合成；素材齐全则继续播放文件
        this.isSynthMode = Object.values(this.tracks).some(t => !!t.audio.error);
      }
    }
    return origSwitch(name, fade);
  };

  D.playSynth = function (stage) {
    const mode = (typeof FEEL !== 'undefined') ? FEEL.cfg.bgm : 'auto';
    if (mode !== 'off' && FEEL_BGM.start(stage)) {
      if (this.synthTimer) { clearInterval(this.synthTimer); this.synthTimer = null; }   // 关掉原来的单声部合成器
      return;
    }
    return origSynth(stage);
  };

  D.stop = function (fade) {
    FEEL_BGM.stop(fade);
    return origStop(fade);
  };
})();
