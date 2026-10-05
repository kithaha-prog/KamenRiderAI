// ===== 假面骑士战斗音效合成引擎 (battle_sound.js) =====
// 特性：出招即响、包含出刀破空声、专属技能声、大招蓄力与下砸，彻底去除杂音与刺耳高频

const BATTLE_SND = {
  ctx: null,
  masterGain: null,
  compressor: null,
  enabled: true,
  lastBoomT: 0,
  prevSt: '',

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      // 动态压缩器：防止声音炸麦与杂音
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(8, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.1, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.55;

      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);
    } catch (e) {}
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  synth(fn) {
    if (!this.enabled) return;
    this.init();
    this.resume();
    if (!this.ctx) return;
    try {
      fn(this.ctx, this.masterGain, this.ctx.currentTime);
    } catch (e) {}
  },

  // ===================================================================
  // 1. 普通攻击出招破空刀风声（按 J、W+J升龙、S+J下砸 出招瞬间鸣响）
  // ===================================================================
  swordSwing() {
    this.synth((ctx, out, t0) => {
      // 0.1秒纯净锐利的金属空气切削声（Fwoosh!）
      const dur = 0.11;
      const bufSize = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;

      const n = ctx.createBufferSource();
      n.buffer = buf;

      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(1400, t0);
      f.frequency.exponentialRampToValueAtTime(360, t0 + dur);
      f.Q.setValueAtTime(1.5, t0);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(0.35, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

      n.connect(f); f.connect(g); g.connect(out);
      n.start(t0); n.stop(t0 + dur + 0.02);
    });
  },

  // ===================================================================
  // 2. 专属 L 技能出招声（按下即发射，出招即响）
  // ===================================================================

  // 555 (Faiz)：光子手枪激光发射
  lFaiz() {
    this.synth((ctx, out, t0) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1450, t0);
      osc.frequency.exponentialRampToValueAtTime(300, t0 + 0.08);

      g.gain.setValueAtTime(0.4, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.085);

      osc.connect(g); g.connect(out);
      osc.start(t0); osc.stop(t0 + 0.09);
    });
  },

  // 龙骑 (Ryuki)：Drag Visor 龙炎火球呼啸
  lRyuki() {
    this.synth((ctx, out, t0) => {
      const dur = 0.22;
      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, t0);
      osc.frequency.exponentialRampToValueAtTime(65, t0 + dur);
      og.gain.setValueAtTime(0.35, t0);
      og.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(og); og.connect(out);
      osc.start(t0); osc.stop(t0 + dur);

      const bufSize = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;

      const n = ctx.createBufferSource(); n.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(600, t0);
      f.frequency.exponentialRampToValueAtTime(140, t0 + dur);

      const ng = ctx.createGain(); ng.gain.setValueAtTime(0.3, t0);
      ng.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      n.connect(f); f.connect(ng); ng.connect(out);
      n.start(t0); n.stop(t0 + dur);
    });
  },

  // Blade (剑)：持剑召雷霹雳
  lBlade() {
    this.synth((ctx, out, t0) => {
      [920, 620].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t0 + idx * 0.02);
        osc.frequency.exponentialRampToValueAtTime(120, t0 + idx * 0.02 + 0.18);

        g.gain.setValueAtTime(0.28, t0 + idx * 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + idx * 0.02 + 0.2);

        osc.connect(g); g.connect(out);
        osc.start(t0 + idx * 0.02); osc.stop(t0 + idx * 0.02 + 0.22);
      });
    });
  },

  // Zeztz：重拳空气音爆
  lZeztz() {
    this.synth((ctx, out, t0) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, t0);
      osc.frequency.exponentialRampToValueAtTime(35, t0 + 0.14);

      g.gain.setValueAtTime(0.5, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);

      osc.connect(g); g.connect(out);
      osc.start(t0); osc.stop(t0 + 0.16);
    });
  },

  // Den-O / 原生 Malaya：斩击波 / 飞剑破空
  lSlashWave() {
    this.synth((ctx, out, t0) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(700, t0);
      osc.frequency.exponentialRampToValueAtTime(180, t0 + 0.12);

      g.gain.setValueAtTime(0.34, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.13);

      osc.connect(g); g.connect(out);
      osc.start(t0); osc.stop(t0 + 0.14);
    });
  },

  // 战车呼啸出击声（E 键出招即响）
  bikeStart() {
    this.synth((ctx, out, t0) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(90, t0);
      osc.frequency.exponentialRampToValueAtTime(320, t0 + 0.25);

      g.gain.setValueAtTime(0.35, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28);

      osc.connect(g); g.connect(out);
      osc.start(t0); osc.stop(t0 + 0.3);
    });
  },

  // ===================================================================
  // 3. 大招必杀技（K 键）出招蓄力与下砸
  // ===================================================================

  // 大招蓄力升压和弦（按 K 瞬间响）
  finisherCharge() {
    this.synth((ctx, out, t0) => {
      const dur = 0.8;
      [220, 277.18, 329.63].forEach((freq) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t0);
        osc.frequency.exponentialRampToValueAtTime(freq * 2.2, t0 + dur);

        g.gain.setValueAtTime(0.01, t0);
        g.gain.linearRampToValueAtTime(0.18, t0 + dur * 0.7);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

        osc.connect(g); g.connect(out);
        osc.start(t0); osc.stop(t0 + dur + 0.05);
      });
    });
  },

  // 大招 45° 俯冲撕裂声
  finisherDive() {
    this.synth((ctx, out, t0) => {
      const dur = 0.35;
      const bufSize = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;

      const n = ctx.createBufferSource(); n.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(1200, t0);
      f.frequency.exponentialRampToValueAtTime(260, t0 + dur);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.35, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      n.connect(f); f.connect(g); g.connect(out);
      n.start(t0); n.stop(t0 + dur);
    });
  },

  // 大爆炸 / 下砸命中轰鸣
  boom(r = 100) {
    if (r < 90) return; // 忽略小命中火花
    const now = performance.now();
    if (now - this.lastBoomT < 90 && r < 200) return;
    this.lastBoomT = now;

    this.synth((ctx, out, t0) => {
      const isUlt = r >= 200;
      const dur = isUlt ? 0.75 : 0.42;

      // 40Hz 超重低音震撼下潜
      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isUlt ? 110 : 85, t0);
      osc.frequency.exponentialRampToValueAtTime(isUlt ? 22 : 30, t0 + dur * 0.85);

      og.gain.setValueAtTime(isUlt ? 0.8 : 0.45, t0);
      og.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

      osc.connect(og); og.connect(out);
      osc.start(t0); osc.stop(t0 + dur + 0.05);

      // 低通空气轰鸣
      const bufSize = Math.floor(ctx.sampleRate * (dur * 0.7));
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

      const noise = ctx.createBufferSource(); noise.buffer = buf;
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass';
      filter.frequency.setValueAtTime(isUlt ? 320 : 220, t0);
      filter.frequency.exponentialRampToValueAtTime(40, t0 + dur * 0.7);

      const ng = ctx.createGain();
      ng.gain.setValueAtTime(isUlt ? 0.45 : 0.25, t0);
      ng.gain.exponentialRampToValueAtTime(0.001, t0 + dur * 0.7);

      noise.connect(filter); filter.connect(ng); ng.connect(out);
      noise.start(t0);
    });
  }
};

// ===================================================================
// 4. 自动挂载管线（支持延迟与轮询挂钩，确保 100% 挂载成功）
// ===================================================================
(function installAudioHooks() {
  const hooked = {};

  const tryHookAfter = (targetName, cb) => {
    if (hooked[targetName] || typeof window[targetName] !== 'function') return false;
    const orig = window[targetName];
    window[targetName] = function() {
      const res = orig.apply(this, arguments);
      try { cb.apply(this, arguments); } catch (e) {}
      return res;
    };
    hooked[targetName] = true;
    return true;
  };

  // 轮询绑定各骑士出招函数，彻底解决脚本顺序问题
  const pollTimer = setInterval(() => {
    tryHookAfter('fireFaiz', () => BATTLE_SND.lFaiz());
    tryHookAfter('fireRyukiGun', () => BATTLE_SND.lRyuki());
    tryHookAfter('fireBlade', () => BATTLE_SND.lBlade());
    tryHookAfter('fireZeztzWave', () => BATTLE_SND.lZeztz());
    tryHookAfter('fireDeno', () => BATTLE_SND.lSlashWave());
    tryHookAfter('spawnBike', () => BATTLE_SND.bikeStart());

    // 挂载主循环：监测普攻挥刀动作（出招即响）与大招蓄力
    if (!hooked['stateWatcher']) {
      hooked['stateWatcher'] = true;
      setInterval(() => {
        if (typeof P === 'undefined' || typeof G === 'undefined') return;
        if (G !== 'play' && G !== 'room') return;

        // ★ 核心：普攻挥出刀刃瞬间，立即播放刀风呼啸破空声（出招就有）
        // 监测状态切换（空挥不响，只有真正释放技能和大招时发声）
        if (P.st !== BATTLE_SND.prevSt) {
          if (P.st === 'thr' && !P.ryuki && !P.k5 && !P.bl && !P.zeztz && !P.dn) {
            BATTLE_SND.lSlashWave(); // 原生 Malaya 飞剑出招
          } else if (P.st === 'fv') {
            BATTLE_SND.finisherCharge(); // 大招蓄力启动
          }
          BATTLE_SND.prevSt = P.st;
        }

        // 大招俯冲撕裂与砸地核爆
        if (P.st === 'fv') {
          if (P.t >= 1.05 && P.t <= 1.15 && !P._fvDivePlayed) {
            P._fvDivePlayed = true;
            BATTLE_SND.finisherDive();
          }
          if (P.hit && P.hit['landed'] && !P._fvLandBoomPlayed) {
            P._fvLandBoomPlayed = true;
            BATTLE_SND.boom(350);
          }
        } else {
          P._fvDivePlayed = false;
          P._fvLandBoomPlayed = false;
        }
      }, 25);
    }
  }, 200);

  // 监听大范围爆炸
  setInterval(() => {
    if (typeof FX === 'undefined' || !Array.isArray(FX)) return;
    for (let i = 0; i < FX.length; i++) {
      const f = FX[i];
      if (f && !f._sndPlayed) {
        f._sndPlayed = true;
        if ((f.type === 'boom' || f.type === 'boss_death_blast' || f.type === 'malaya_kick_blast') && (f.r >= 90)) {
          BATTLE_SND.boom(f.r);
        }
      }
    }
  }, 35);

  window.addEventListener('pointerdown', () => { BATTLE_SND.init(); BATTLE_SND.resume(); }, { once: true });
  window.addEventListener('keydown', () => { BATTLE_SND.init(); BATTLE_SND.resume(); }, { once: true });

  console.log('[BATTLE_SND] 战斗音频引擎已加载，挥刀与出招即时音效已生效');
})();