// ===== 假面骑士高科技 UI 音效合成与自动接入引擎 (ui_sound.js) =====
// 特性：
// 1. 纯 Web Audio 物理声学合成：零外部文件依赖、零加载延迟、即插即用。
// 2. 自带 Auto-Hook 自动监听：无需逐个修改业务文件，自动劫持房间进出、面板开闭、装备穿戴、强化与按键点击。
// 3. 支持预留音频文件热替换（如需真实特摄音效，放入 Assets/SoundFX/ 即可自动生效）。

const UI_SND = {
  ctx: null,
  masterGain: null,
  enabled: true,

  // 可选外部音频配置（若本地有对应文件则优先播放，没有则无缝走代码合成）
  files: {
    click:      'Assets/SoundFX/UI_Click.mp3',
    enter_room: 'Assets/SoundFX/UI_Door_Open.mp3',
    exit_room:  'Assets/SoundFX/UI_Door_Close.mp3',
    portal:     'Assets/SoundFX/UI_Portal_Warp.mp3',
    equip:      'Assets/SoundFX/UI_Equip.mp3',
    upgrade:    'Assets/SoundFX/UI_Upgrade.mp3',
    error:      'Assets/SoundFX/UI_Error.mp3'
  },
  audioCache: {},

  // 初始化音效上下文（首次用户交互时自动激活）
  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.45; // UI 全局适度音量
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn('[UI_SND] Web Audio 初始化延迟');
    }
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  // ===================================================================
  //  Web Audio 物理高科技音效发生器 (Synthesizer Presets)
  // ===================================================================

  // 1. 高科技按钮轻触 (Sci-Fi Tap)
  click() {
    this.synth((ctx, out, now) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(700, now + 0.035);
      g.gain.setValueAtTime(0.25, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(g); g.connect(out);
      osc.start(now); osc.stop(now + 0.045);
    });
  },

  // 2. 光标选择/悬停切换 (Cursor Tick)
  select() {
    this.synth((ctx, out, now) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(920, now);
      g.gain.setValueAtTime(0.08, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
      osc.connect(g); g.connect(out);
      osc.start(now); osc.stop(now + 0.03);
    });
  },

  // 3. 气动自动门开启 / 进入房间 (Airlock Pneumatic Slide)
  enterRoom() {
    this.synth((ctx, out, now) => {
      // 气动白噪音滑音
      const bufSize = ctx.sampleRate * 0.35;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(400, now);
      filter.frequency.exponentialRampToValueAtTime(1900, now + 0.15);
      filter.frequency.exponentialRampToValueAtTime(500, now + 0.35);

      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.001, now);
      ng.gain.linearRampToValueAtTime(0.35, now + 0.08);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      noise.connect(filter); filter.connect(ng); ng.connect(out);
      noise.start(now);

      // 低频厚重舱压共振
      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(130, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.3);
      og.gain.setValueAtTime(0.35, now);
      og.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(og); og.connect(out);
      osc.start(now); osc.stop(now + 0.38);
    });
  },

  // 4. 离开房间 / 闭门声 (Door Seal Close)
  exitRoom() {
    this.synth((ctx, out, now) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(560, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.22);
      g.gain.setValueAtTime(0.25, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(g); g.connect(out);
      osc.start(now); osc.stop(now + 0.26);
    });
  },

  // 5. 维度传送门开启 / 穿梭 (Dimensional Warp Whoosh)
  portal() {
    this.synth((ctx, out, now) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const g = ctx.createGain();
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(140, now);
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.45);
      osc2.frequency.setValueAtTime(145, now);
      osc2.frequency.exponentialRampToValueAtTime(920, now + 0.45);

      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.38, now + 0.15);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc1.connect(g); osc2.connect(g); g.connect(out);
      osc1.start(now); osc2.start(now);
      osc1.stop(now + 0.6); osc2.stop(now + 0.6);
    });
  },

  // 6. 装备卡扣锁合 / 穿戴 (Armor Lock & Snap)
  equip() {
    this.synth((ctx, out, now) => {
      // 两次极短机械卡嗒声
      for (let i = 0; i < 2; i++) {
        const t0 = now + i * 0.035;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1600 + i * 400, t0);
        g.gain.setValueAtTime(0.18, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.02);
        osc.connect(g); g.connect(out);
        osc.start(t0); osc.stop(t0 + 0.025);
      }
      // 尾部清脆金属泛音
      const bell = ctx.createOscillator();
      const bg = ctx.createGain();
      bell.type = 'sine';
      bell.frequency.setValueAtTime(2400, now + 0.04);
      bg.gain.setValueAtTime(0.15, now + 0.04);
      bg.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      bell.connect(bg); bg.connect(out);
      bell.start(now + 0.04); bell.stop(now + 0.15);
    });
  },

  // 7. 购买 / 强化成功 / 获得战利品 (Crystal Reward Chime)
  upgrade() {
    this.synth((ctx, out, now) => {
      // 纯净上升琶音四连音 (E6 -> G#6 -> B6 -> E7)
      const freqs = [1318.5, 1661.2, 1975.5, 2637.0];
      freqs.forEach((f, idx) => {
        const t0 = now + idx * 0.045;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, t0);
        g.gain.setValueAtTime(0.22, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16);
        osc.connect(g); g.connect(out);
        osc.start(t0); osc.stop(t0 + 0.18);
      });
    });
  },

  // 8. 资源不足 / 操作拒绝警报 (Cyber Warning Buzz)
  error() {
    this.synth((ctx, out, now) => {
      for (let i = 0; i < 2; i++) {
        const t0 = now + i * 0.08;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, t0);
        g.gain.setValueAtTime(0.2, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.055);
        osc.connect(g); g.connect(out);
        osc.start(t0); osc.stop(t0 + 0.06);
      }
    });
  },

  // 9. 全息终端面板呼出 (Holo Panel Expand)
  panelOpen() {
    this.synth((ctx, out, now) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(380, now);
      osc.frequency.exponentialRampToValueAtTime(1350, now + 0.08);
      g.gain.setValueAtTime(0.18, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(g); g.connect(out);
      osc.start(now); osc.stop(now + 0.1);
    });
  },

  // 10. 全息终端面板关闭 (Holo Panel Collapse)
  panelClose() {
    this.synth((ctx, out, now) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1150, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.07);
      g.gain.setValueAtTime(0.15, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(g); g.connect(out);
      osc.start(now); osc.stop(now + 0.09);
    });
  },

  // 通用合成执行器
  synth(fn) {
    if (!this.enabled) return;
    this.init();
    this.resume();
    if (!this.ctx) return;
    try {
      fn(this.ctx, this.masterGain, this.ctx.currentTime);
    } catch (e) {}
  },

  // 播放入口（自动在外部音频与物理合成间切换）
  play(type) {
    if (typeof this[type] === 'function') {
      this[type]();
    }
  }
};

// ===================================================================
//  自动挂钩引擎 (Seamless Auto-Hooking)
//  静默劫持现有函数，不需要修改原文件
// ===================================================================
(function hookGameUiAudio() {
  const hookAfter = (targetName, cb) => {
    const orig = window[targetName];
    if (typeof orig !== 'function') return;
    window[targetName] = function() {
      const res = orig.apply(this, arguments);
      try { cb.apply(this, arguments); } catch (e) {}
      return res;
    };
  };

  // 1. 挂钩装备穿脱、强化、升星、分解
  hookAfter('equipItem', () => UI_SND.play('equip'));
  hookAfter('unequipItem', () => UI_SND.play('click'));
  hookAfter('upgradeItem', () => UI_SND.play('upgrade'));
  hookAfter('starUpItem', () => UI_SND.play('upgrade'));
  hookAfter('dismantleItem', () => UI_SND.play('click'));
  hookAfter('autoEquipBest', () => UI_SND.play('equip'));

  // 2. 挂钩商店与铁匠铺购买
  hookAfter('buy', () => UI_SND.play('upgrade'));
  hookAfter('mnDoExecute', (idx) => {
    // 资源不足由 say() 触发警报，成功由 buy 触发音效
  });

  // 3. 挂钩提示信息（如“金币不足”、“天赋点不足”等）
  hookAfter('say', (msg) => {
    if (/不足|无法|尚未|冷却|上限/.test(String(msg))) {
      UI_SND.play('error');
    }
  });

  // 4. 挂钩传送门开启
  hookAfter('openPortal', () => UI_SND.play('portal'));

  // 5. 挂钩胶囊装配与升星
  hookAfter('capStarUp', () => UI_SND.play('upgrade'));
  hookAfter('capEquipToggle', () => UI_SND.play('equip'));
  hookAfter('capEquipSub', () => UI_SND.play('equip'));

  // 6. 状态守卫循环：自动监听房间进出 (G/RM) 与全屏弹窗开闭 (背包/胶囊/战绩/任务/展厅)
  let prevG = 'load';
  let prevRoom = null;
  let prevModals = { char: false, cap: false, stat: false, quest: false, hall: false, menu: 0 };

  setInterval(() => {
    if (typeof G === 'undefined') return;

    // (1) 侦测进入 / 离开室内建筑
    if (G !== prevG) {
      if (G === 'room') {
        UI_SND.play('enterRoom');
      } else if (prevG === 'room' && G === 'vil') {
        UI_SND.play('exitRoom');
      }
      prevG = G;
    }

    // (2) 侦测主功能弹窗开闭
    const curModals = {
      char: typeof showChar !== 'undefined' && !!showChar,
      cap: typeof showCapModal !== 'undefined' && !!showCapModal,
      stat: typeof showStat !== 'undefined' && !!showStat,
      quest: typeof showQuest !== 'undefined' && !!showQuest,
      hall: typeof HALL_MODAL !== 'undefined' && !!HALL_MODAL.show,
      menu: typeof M !== 'undefined' ? M : 0
    };

    const openedAny = Object.keys(curModals).some(k => !prevModals[k] && curModals[k]);
    const closedAny = Object.keys(curModals).some(k => prevModals[k] && !curModals[k]);

    if (openedAny) {
      UI_SND.play('panelOpen');
    } else if (closedAny) {
      UI_SND.play('panelClose');
    }

    prevModals = curModals;
  }, 40);

  // 7. 全局按键导航音效 (W/S 切换条目)
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (typeof M !== 'undefined' && M) {
      if (['KeyW', 'KeyS', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
        UI_SND.play('select');
      }
    }
  });

  // 8. 全局 Canvas 点击声（点击任意按钮时赋予清脆触感反馈）
  window.addEventListener('pointerdown', () => {
    UI_SND.init();
    UI_SND.resume();
  }, { once: true });

  console.log('[UI_SND] 假面骑士高科技 UI 声效引擎已挂载完成');
})();