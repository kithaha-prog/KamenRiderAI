// ===== 假面骑士沉浸式视听引擎：动态 BGM / 处决曲 & 动态摄像机 / 漫画斩杀定格 =====
// 模块包含：
// 1. DYNAMIC_BGM: 多轨自适应混音控制器（道中紧张 -> 领主摇滚 -> 25%血/破防特摄处刑曲 -> 慢动作渐出）
// 2. CAMERA: 视口平滑缩放、弹反局部径向聚焦推镜、升龙拉远全景、以及 Boss 终结 1.2s 电影级黑白漫画高反差定格

// =====================================================================
//  一、 动态自适应 BGM / 处刑曲引擎 (Dynamic OST Engine)
// =====================================================================
const DYNAMIC_BGM = {
  enabled: true,
  state: 'idle', // 'idle' | 'mob' | 'boss_intro' | 'boss_rock' | 'climax' | 'victory' | 'defeat'
  ctx: null,
  masterGain: null,
  tracks: {},
  currentTrack: null,
  synthTimer: null,
  synthBeat: 0,
  isSynthMode: false,

  // 音频文件配置（放置于 Assets/BGM/，无文件时自动转入 Web Audio 动态合成器保底）
  config: {
    mob:        'Assets/BGM/BGM_Battle_Normal.mp3',
    boss_rock:  'Assets/BGM/BGM_Boss_Rock.mp3',
    climax:     'Assets/BGM/BGM_Climax_Execution.mp3', // 25%血量或破防瘫痪时的特摄处刑曲
    victory:    'Assets/BGM/BGM_Victory.mp3'
  },

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.55;
      this.masterGain.connect(this.ctx.destination);

      // 初始化各音轨节点
      for (const [key, src] of Object.entries(this.config)) {
        const audio = new Audio();
        audio.loop = (key !== 'victory');
        audio.preload = 'auto';
        audio.src = encodeURI(src);
        
        let sourceNode = null;
        let gainNode = this.ctx.createGain();
        gainNode.gain.value = 0;
        gainNode.connect(this.masterGain);

        audio.addEventListener('canplaythrough', () => {
          if (!sourceNode && this.ctx) {
            try {
              sourceNode = this.ctx.createMediaElementSource(audio);
              sourceNode.connect(gainNode);
            } catch (e) {}
          }
        }, { once: true });

        // 真实音频加载失败时启用合成器模式
        audio.addEventListener('error', () => {
          this.isSynthMode = true;
        });

        this.tracks[key] = { audio, gainNode };
      }
    } catch (e) {
      console.warn('[BGM Engine] Web Audio 初始化受限，将在交互后激活');
    }
  },

  // 恢复 AudioContext（应对浏览器自动播放策略）
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  // 平滑淡入淡出切换音轨 (Crossfade)
  switchTrack(trackName, fadeDuration = 0.8) {
    if (!this.enabled) return;
    this.init();
    this.resume();
    if (this.currentTrack === trackName) return;

    const prevTrack = this.currentTrack;
    this.currentTrack = trackName;
    const now = this.ctx ? this.ctx.currentTime : 0;

    // 1. 若音频缺失，自动切入合成器变奏模拟
    if (this.isSynthMode) {
      this.playSynth(trackName);
      return;
    }

    // 2. 真实音频平滑 Crossfade 混音
    if (prevTrack && this.tracks[prevTrack]) {
      const pg = this.tracks[prevTrack].gainNode;
      pg.gain.cancelScheduledValues(now);
      pg.gain.setValueAtTime(pg.gain.value, now);
      pg.gain.linearRampToValueAtTime(0.001, now + fadeDuration);
      setTimeout(() => {
        try { this.tracks[prevTrack].audio.pause(); } catch (e) {}
      }, fadeDuration * 1000);
    }

    if (trackName && this.tracks[trackName]) {
      const next = this.tracks[trackName];
      try {
        next.audio.currentTime = 0;
        const p = next.audio.play();
        if (p && p.catch) p.catch(() => { this.isSynthMode = true; this.playSynth(trackName); });
      } catch (e) {
        this.isSynthMode = true;
        this.playSynth(trackName);
      }
      const ng = next.gainNode;
      ng.gain.cancelScheduledValues(now);
      ng.gain.setValueAtTime(0.001, now);
      ng.gain.linearRampToValueAtTime(trackName === 'climax' ? 0.75 : 0.55, now + fadeDuration);
    }
  },

  // 阶段自适应状态机更新（在战斗主循环中轮询）
  updateBattleState() {
    if (G !== 'play') {
      if (G === 'vil' || G === 'room' || G === 'title') {
        this.stop(1.0);
      }
      return;
    }

    const boss = E.find(e => !e.dead && e.t === 'boss');

    // 1. 领主战阶段判断
    if (boss) {
      const hpPct = boss.hp / boss.mhp;
      // 达到特摄处刑曲触发条件：Boss 血量低于 25% 或已被击破破绽瘫痪（Broken）
      if (hpPct <= 0.25 || boss.broken) {
        if (this.state !== 'climax') {
          this.state = 'climax';
          this.switchTrack('climax', 0.5);
          DT.push({ x: P.x, y: P.y - 230, s: '♫ CLIMAX EXECUTION // 处刑曲切入', t: 1.8, c: '#ffd84a' });
        }
      } else {
        // 常规领主摇滚
        if (this.state !== 'boss_rock' && this.state !== 'climax') {
          this.state = 'boss_rock';
          this.switchTrack('boss_rock', 0.8);
        }
      }
    } else {
      // 2. 道中小怪阶段循环低压紧张律动
      if (this.state !== 'mob') {
        this.state = 'mob';
        this.switchTrack('mob', 1.0);
      }
    }
  },

  // 战斗结束瞬间慢速淡出并收尾
  onGameEnd(win) {
    if (win) {
      this.state = 'victory';
      this.switchTrack('victory', 0.6);
    } else {
      this.state = 'defeat';
      this.stop(0.8);
    }
  },

  stop(fadeDuration = 0.6) {
    if (this.synthTimer) { clearInterval(this.synthTimer); this.synthTimer = null; }
    if (!this.ctx || !this.currentTrack) return;
    const now = this.ctx.currentTime;
    const track = this.tracks[this.currentTrack];
    if (track) {
      track.gainNode.gain.cancelScheduledValues(now);
      track.gainNode.gain.setValueAtTime(track.gainNode.gain.value, now);
      track.gainNode.gain.linearRampToValueAtTime(0.001, now + fadeDuration);
      setTimeout(() => { try { track.audio.pause(); } catch(e){} }, fadeDuration * 1000);
    }
    this.currentTrack = null;
    this.state = 'idle';
  },

  // Web Audio 实时音序合成器兜底（本地无需任何 MP3 也拥有带感的自适应音乐）
  playSynth(stage) {
    if (this.synthTimer) clearInterval(this.synthTimer);
    if (!this.ctx) return;
    this.synthBeat = 0;
    const tempo = stage === 'climax' ? 140 : stage === 'boss_rock' ? 128 : 105;
    const interval = (60 / tempo / 4) * 1000;

    this.synthTimer = setInterval(() => {
      if (!this.enabled || G !== 'play') return;
      const b = this.synthBeat++;
      const now = this.ctx.currentTime;

      // 底鼓与低音 Bassline
      if (b % 4 === 0 || (stage === 'climax' && b % 2 === 0)) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.frequency.setValueAtTime(stage === 'climax' ? 140 : 100, now);
        osc.frequency.exponentialRampToValueAtTime(28, now + 0.12);
        g.gain.setValueAtTime(0.4, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(g); g.connect(this.masterGain);
        osc.start(now); osc.stop(now + 0.15);
      }

      // 军鼓与重节奏切音
      if (b % 8 === 4) {
        const bufSize = this.ctx.sampleRate * 0.1;
        const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = this.ctx.createBufferSource();
        noise.buffer = buf;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass'; filter.frequency.value = 1000;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(stage === 'climax' ? 0.35 : 0.22, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        noise.connect(filter); filter.connect(g); g.connect(this.masterGain);
        noise.start(now);
      }

      // 处刑曲激昂高频琶音 Lead
      if (stage === 'climax' && b % 2 === 0) {
        const notes = [440, 523, 659, 784, 880, 1046];
        const freq = notes[(b / 2) % notes.length];
        const lead = this.ctx.createOscillator();
        const lg = this.ctx.createGain();
        lead.type = 'sawtooth';
        lead.frequency.setValueAtTime(freq, now);
        lg.gain.setValueAtTime(0.12, now);
        lg.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        lead.connect(lg); lg.connect(this.masterGain);
        lead.start(now); lead.stop(now + 0.11);
      }
    }, interval);
  }
};

// =====================================================================
//  二、 动态镜头缩放与黑白漫画高反差剪影引擎 (Dynamic Camera & Manga Split)
// =====================================================================
const CAMERA = {
  zoom: 1.0,
  targetZoom: 1.0,
  zoomSpeed: 5.5,
  offX: 0,
  offY: 0,
  targetOffX: 0,
  targetOffY: 0,
  
  // 弹反聚焦动效
  parryT: 0,
  parryDur: 0.35,

  // 终结击杀黑白漫画高反差剪影状态机
  manga: {
    active: false,
    t: 0,
    dur: 1.2,          // 1.2秒电影级高反差漫画慢动作定格
    boss: null,
    bossX: 0,
    bossY: 0,
    riderKey: 'malaya',
    lines: [],         // 动感漫画速线
    slashAngle: -0.45  // 巨型切割斜角
  },

  // 弹反瞬间触发聚焦推镜
  onParry(x, y) {
    this.targetZoom = 1.22; // 微推放大 1.22 倍
    this.parryT = this.parryDur;
  },

  // 触发击杀 Boss 终结电影级漫画剪影定格
  triggerMangaKill(boss) {
    if (!boss || this.manga.active) return;
    this.manga.active = true;
    this.manga.t = 0;
    this.manga.boss = boss;
    this.manga.bossX = boss.x;
    this.manga.bossY = boss.y;
    this.manga.riderKey = typeof curRiderKey === 'function' ? curRiderKey() : 'malaya';
    this.manga.slashAngle = (Math.random() < 0.5 ? 1 : -1) * (0.35 + Math.random() * 0.2);

    // 生成 28 条辐射动感漫画速线
    this.manga.lines = [];
    for (let i = 0; i < 28; i++) {
      this.manga.lines.push({
        angle: (i / 28) * Math.PI * 2 + (Math.random() - 0.5) * 0.1,
        len: 260 + Math.random() * 260,
        width: 1.5 + Math.random() * 3.5,
        speed: 1.5 + Math.random() * 2.0
      });
    }

    // 全局强力定格 1.2 秒
    if (typeof HITSTOP !== 'undefined') HITSTOP = 1.2;
    shake = 32;

    // 强化音效反馈
    if (typeof playParryHit === 'function') playParryHit();
  },

  // 每帧更新相机矩阵状态
  update(dt) {
    if (G !== 'play') {
      this.targetZoom = 1.0;
      this.targetOffX = 0;
      this.targetOffY = 0;
      this.manga.active = false;
    }

    // 1. 升龙击（Uppercut）跳起时镜头平滑拉远，看清全景空域
    if (P && P.st === 'uppercut') {
      this.targetZoom = 0.88;
    } else if (this.parryT > 0) {
      this.parryT -= dt;
      if (this.parryT <= 0) {
        this.targetZoom = 1.0;
      }
    } else if (!this.manga.active) {
      this.targetZoom = 1.0;
    }

    // 2. 镜头平滑阻尼插值
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1, dt * this.zoomSpeed);

    // 3. 漫画高反差剪影定时推进
    if (this.manga.active) {
      this.manga.t += dt;
      if (this.manga.t >= this.manga.dur) {
        this.manga.active = false;
      }
    }
  },

  // 应用视口矩阵变换：以屏幕中心 (480, 270) 为锚点缩放
  apply(ctx) {
    if (Math.abs(this.zoom - 1.0) > 0.001) {
      ctx.translate(480, 270);
      ctx.scale(this.zoom, this.zoom);
      ctx.translate(-480, -270);
    }
  },

  // 渲染屏幕后处理（弹反径向速度线、黑白漫画高反差击杀定格）
  drawOverlay(ctx) {
    // 1. 完美弹反 0.35s 局部径向高能冲击线
    if (this.parryT > 0 && G === 'play') {
      const p = this.parryT / this.parryDur;
      const px = sn(P.x - cam), py = sn(P.y - 90);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2 + T * 6;
        const r1 = 80 + (1 - p) * 120;
        const r2 = r1 + 60 + Math.sin(i * 3 + T * 12) * 40;
        ctx.strokeStyle = (i % 2 === 0) ? '#ffd84a' : '#ffffff';
        ctx.lineWidth = 2.5 * p;
        ctx.beginPath();
        ctx.moveTo(px + Math.cos(ang) * r1, py + Math.sin(ang) * r1);
        ctx.lineTo(px + Math.cos(ang) * r2, py + Math.sin(ang) * r2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 2. 领主击杀瞬间电影级黑白漫画高反差剪影 (Manga Split Execution)
    if (this.manga.active) {
      const m = this.manga;
      const p = cl(m.t / m.dur, 0, 1);
      const W = 960, H = 540;

      ctx.save();
      // (1) 纯白背景两极反转
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      // (2) 动感辐射漫画黑速线
      ctx.save();
      const focusX = W / 2, focusY = H / 2;
      ctx.strokeStyle = '#05070e';
      m.lines.forEach(l => {
        const dist = l.len * (0.8 + 0.2 * Math.sin(m.t * 18));
        ctx.lineWidth = l.width;
        ctx.beginPath();
        ctx.moveTo(focusX + Math.cos(l.angle) * 110, focusY + Math.sin(l.angle) * 110);
        ctx.lineTo(focusX + Math.cos(l.angle) * (110 + dist), focusY + Math.sin(l.angle) * (110 + dist));
        ctx.stroke();
      });
      ctx.restore();

      // (3) 斜向漆黑水墨撕裂底带
      ctx.save();
      ctx.translate(focusX, focusY);
      ctx.rotate(m.slashAngle);
      ctx.fillStyle = '#05070f';
      ctx.fillRect(-W, -75, W * 2, 150);

      // 切口中央贯穿的一道绝杀赤金裂痕
      ctx.strokeStyle = '#ff3838';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#ffd84a'; ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(-W, 0); ctx.lineTo(W, 0);
      ctx.stroke();

      ctx.restore();

      // (4) 骑士与 Boss 高反差黑色剪影
      const k = m.riderKey;
      const riderConfig = {
        malaya: { text: '絕 滅 必 殺', title: 'KAMEN RIDER MALAYA', symbol: 'BUNGA RAYA', col: '#00e5ff' },
        ryuki:  { text: '龍 騎 昇 天', title: 'FINAL VENT · RYUKI', symbol: 'DRAGREDDER', col: '#ff3838' },
        '555':  { text: '終 焉 審 判', title: 'EXCEED CHARGE · 555', symbol: 'SMART BRAIN', col: '#ffb400' },
        blade:  { text: '封 印 覺 醒', title: 'LIGHTNING SONIC · BLADE', symbol: 'SPADE ACE', col: '#3aa0ff' },
        zeztz:  { text: '破 壞 衝 擊', title: 'FINAL IMPACT · ZEZTZ', symbol: 'MECHA CORE', col: '#00f2fe' },
        deno:   { text: '一 刀 兩 斷', title: 'ORE NO WAZA · DEN-O', symbol: 'DEN-LINER', col: '#ff3b30' }
      };
      const cfg = riderConfig[k] || riderConfig.malaya;

      // 居中大号汉字书法印记与极高反差剪影
      ctx.save();
      ctx.font = 'italic 900 48px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 书法印记高光与倒影
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#050711';
      ctx.strokeText(cfg.text, W / 2, H / 2 - 8);
      ctx.fillStyle = '#ffd84a';
      ctx.shadowColor = cfg.col;
      ctx.shadowBlur = 24;
      ctx.fillText(cfg.text, W / 2, H / 2 - 8);

      // 顶部与底部小号英文战术代号
      ctx.font = '800 13px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 8;
      ctx.fillText(cfg.title, W / 2, H / 2 + 36);
      ctx.fillStyle = cfg.col;
      ctx.fillText(`// CREST ARCHIVE: ${cfg.symbol}`, W / 2, H / 2 + 54);

      ctx.restore();

      // (5) 画面边缘黑白撕裂暗角
      const vig = ctx.createRadialGradient(W / 2, H / 2, W * 0.28, W / 2, H / 2, W * 0.55);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(5,7,16,0.85)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      ctx.restore();
    }
  }
};