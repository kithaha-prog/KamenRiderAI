let stageT = 0;      // 本关耗时（秒）
let WIN_RES = null;  // 结算数据与动画状态机
let LOSE_RES = null; // 战败结算数据与动效状态
let WB_RES = null; // 世界BOSS专属结算数据与动画状态

// ===== 战斗系统 =====
function begin(k) {
  BIKES = [];
  stageT = 0;
  WIN_RES = null;
  LOSE_RES = null;
  WB_RES = null;

  // 1. ★ 核心：强制解除所有假面骑士形态，回归 Malaya 原生形态
  if (typeof clearForms === 'function') clearForms();

  // 2. ★ 重新核算属性：去除龙骑/555/Blade的攻击与暴击倍率，使数值回归原生
  calc();

  // 3. ★ 清除可能正在播放的形态变身/大招音频
  if (typeof stopAllRyukiFVSounds === 'function') stopAllRyukiFVSounds();
  if (typeof stopFaizHenshin === 'function') stopFaizHenshin();
  if (typeof stopRyukiHenshin === 'function') stopRyukiHenshin();
  if (typeof stopBladeHenshin === 'function') stopBladeHenshin();

  // 4. 重置玩家坐标、状态与全技能 CD
  const transDur = typeof malayaTransDur === 'function' ? malayaTransDur() : 4.69;
  Object.assign(P, { 
    x: 300, y: GY, vx: 0, vy: 0, f: 1, 
    hp: P.mh, mp: P.mm, 
    st: 'trans', t: 0, tdur: transDur,
    inv: transDur + 0.5, land: 0, h: 0, hit: {}, 
    sta: P.stm, dcd: 0, exh: false, spr: false, down: false, 
    shDown: false, shT: 0, gt: 0, sreg: 0, slow: 0, psn: 0 
  });

  // ★ 核心：遍历全技能池（J/L/E/K/P）与闪避 CD 全部清零就绪
  for (const key in P.cd) P.cd[key] = 0;
  P.dcd = 0;

  psHen();
  // 5. 播放 Malaya 原生变身音效
  if (typeof playMalayaHenshin === 'function') playMalayaHenshin();

  // 6. 清空战场实体并重置进度
  GH = []; E = []; PJ = []; EP = []; FX = []; DT = []; OR = []; HZ = []; TQ = [];
  kills = 0; bs = 0; sp = 1; RG = 0; cam = 0; cur = k; G = 'play';
  if (typeof coopResetBattle === 'function') coopResetBattle();   // ★ 联机：重置投票/救援/队友镜像

  // 在 js/battle.js 的 begin(k) 末尾：
  if (ST[k].wb) { 
    WBT = ST[k].tl; WBD = 0; WBM = 0; WBR = ''; 
  } else { 
    // ★ 若为联机客机，怪兽由房主生成并同步过来，本地不重复初始刷怪
    if (!COOP.active || COOP.isHost) {
      spawn('imp'); spawn('imp'); 
    }
  }
}

function fin(w) {
  if (G !== 'play') return;
  G = w ? 'win' : 'over'; FD = 0;
  psResult(w);
  const z = ST[cur];
  // ★ 联机：房主裁决胜负并广播给客机
  if (typeof COOP !== 'undefined' && COOP.active && COOP.inGame && COOP.isHost) coopSend('game_end', { win: w ? 1 : 0, kills, RG, RGb: Math.round(COOP.RGb || 0) });

  if (z.tw) {
    towerFin(w, z);   // 无尽塔结算（tower.js）：首通奖励 / 契约碎片 / 层数记录
  } else if (z.wb) {
    // ★ 全服世界BOSS结算：奖励按「本场伤害 / 单场基准血量」折算；最后一击者的 +50% 要等服务器确认后在 wbCommit 里补发
    const i = WB.findIndex(b => b.si === cur);
    const retreat = WBR === 'retreat';
    const dmg = retreat ? 0 : Math.max(0, Math.min(WBD | 0, WB_LOC > 0 ? WB_LOC : (WBD | 0)));
    const base = wbBaseHp(i);
    const frac = Math.min(1, dmg / base);
    const W = wbData();
    FG = RG + Math.round(z.g * frac);
    if (retreat) W.used = Math.max(0, (W.used | 0) - 1);          // 撤退不算次数
    else W.best[i] = Math.max(W.best[i] || 0, dmg);
    const wbD = Math.round((WB_DIAM[i] || 30) * frac);
    if (wbD > 0) { S.d += wbD; psDia(wbD); }

    const dmgPct = Math.min(100, Math.floor(frac * 100));
    const rank = dmgPct >= 100 ? 'S' : dmgPct >= 70 ? 'A' : dmgPct >= 40 ? 'B' : 'C';
    const timeSpent = Math.max(1, Math.round(z.tl - WBT));

    WB_RES = {
      t: 0, dur: 1.5, win: w,
      reason: w ? 'win' : (WBR || 'defeat'),
      bossName: z.bn || '世界首领',
      damage: dmg, maxHp: base, dmgPct, rank,
      gold: FG, diam: wbD, timeSpent, totalLimit: z.tl,
      isKill: false,                       // 服务器确认是最后一击者后才会变 true
      leftTries: wbLeft(),
      bestDmg: W.best[i] || dmg,
      pending: !retreat && dmg > 0, err: '', msg: '', ask: 0, rem: -1, bossMax: wbMaxHp(i), top: []
    };
    if (WB_RES.pending) wbCommit(i, dmg, WB_RES);
  } else {
    // 常规关卡结算
    FG = w ? RG + z.g : RG >> 1; // 战败折半保留 50%
    if (w) {
      // 胜利结算（保持不变）
      // ★ 双人副本独立于单人进度：不推进 S.cl（否则会误解锁单人关卡）
      const isFirst = z.coop ? !(S.stars && S.stars[cur]) : cur >= S.cl;
      if (!z.coop) S.cl = Math.max(S.cl, cur + 1);

      const hpRate = P.hp / P.mh;
      const s1 = true;
      const s2 = hpRate >= 0.5;
      const s3 = stageT <= STAR_TIME;
      const stars = (s1 ? 1 : 0) + (s2 ? 1 : 0) + (s3 ? 1 : 0);
      const rank = stars === 3 ? 'S' : stars === 2 ? 'A' : 'B';

      S.stars = S.stars || {};
      const prevStars = S.stars[cur] || 0;

      // 首通钻石：主线固定 FIRST_CLEAR_DIAMOND（60）；双人副本按难度（COOP_FIRST_DIAM）。重复挑战不再给钻石
      const ci = z.coop ? (z.coopIdx | 0) : -1;
      if (isFirst) {
        FD = z.coop ? (COOP_FIRST_DIAM[ci] || FIRST_CLEAR_DIAMOND) : FIRST_CLEAR_DIAMOND;
        S.d += FD; psDia(FD);
      } else {
        FD = 0;
      }
      // 双人副本：每次通关（可重复刷）都有 契约碎片 / 强化碎晶 / 强化卷轴
      let cShard = 0, cMat = 0, cScr = 0;
      if (z.coop) {
        cShard = COOP_SHARD[ci] || 1; cMat = COOP_MAT[ci] || 8; cScr = COOP_SCR[ci] || 1;
        S.csh = (S.csh | 0) + cShard; S.mat += cMat; S.scr = (S.scr || 0) + cScr;
      }
      if (stars > prevStars) S.stars[cur] = stars;

      // 在 fin(w) 胜利分支里：
      const expGain = Math.round((z.r * 30 + 50) * (z.coop ? 5 : 1) * (1 + affixTotal('xp'))); // ★ 双人 5 倍经验
      WIN_RES = {
        t: 0, dur: 1.5, stageName: z.n, stars, rank,
        conds: [
          { text: '通关战役', pass: s1 },
          { text: '剩余生命 ≥ 50%', pass: s2 },
          { text: '通关耗时 ≤ ' + STAR_TIME + '秒 (' + stageT.toFixed(1) + 's)', pass: s3 }
        ],
        gold: FG, diam: FD, isFirst,
        shards: cShard, mats: cMat, scrs: cScr,
        expGain: expGain, time: stageT
      };
      gain(WIN_RES.expGain, true);
    } else {
      // ★ 新增：构建战败结算信息
      const aliveKills = Math.min(kills, z.k);
      const killPercent = z.k > 0 ? Math.floor((aliveKills / z.k) * 100) : 0;
      LOSE_RES = {
        t: 0,
        dur: 1.5,
        stageName: z.n,
        kills: aliveKills,
        targetKills: z.k,
        killPercent,
        gold: FG,
        lostGold: RG - FG,
        time: stageT,
        tip: S.lv < z.r 
          ? `关卡推荐 Lv.${z.r} (当前 Lv.${S.lv})，建议强化装备或提升等级`
          : '注意使用 [J] 刀刃劈碎弹幕，不可抵消的陨石和地刺请使用 Shift 闪避'
      };
    }
  }
  S.g += FG; psGold(FG);
  save();
}

// ===== 高级战败结算 UI（科技赤红暗黑风格） =====
let LOSE_HITS = [];

function drawLoseSettlement() {
  if (!LOSE_RES) return;
  LOSE_HITS = [];
  const L = LOSE_RES;
  const t = L.t;
  const p = Math.min(1, t / 0.8);

  ctx.save();
  // 1. 全屏战败暗红遮罩
  ctx.fillStyle = 'rgba(12, 4, 8, 0.90)';
  ctx.fillRect(0, 0, 960, 540);

  // 2. 居中弹性入场
  const sc = t < 0.25 ? 0.8 + 0.2 * Math.sin((t / 0.25) * Math.PI * 0.5) : 1;
  const pw = 680, ph = 430, px = (960 - pw) / 2, py = 55;

  ctx.translate(px + pw / 2, py + ph / 2);
  ctx.scale(sc, sc);
  ctx.translate(-(px + pw / 2), -(py + ph / 2));

  // 边框与暗红渐变底板
  rpath(px, py, pw, ph, 18);
  const bgGrad = ctx.createLinearGradient(px, py, px, py + ph);
  bgGrad.addColorStop(0, '#1c0f18');
  bgGrad.addColorStop(1, '#09050a');
  ctx.fillStyle = bgGrad; ctx.fill();
  ctx.strokeStyle = '#ff4757'; ctx.lineWidth = 2; ctx.stroke();

  // 顶部警示条
  const hg = ctx.createLinearGradient(px + 40, py, px + pw - 40, py);
  hg.addColorStop(0, 'rgba(255, 71, 87, 0)');
  hg.addColorStop(0.5, 'rgba(255, 71, 87, 0.22)');
  hg.addColorStop(1, 'rgba(255, 71, 87, 0)');
  ctx.fillStyle = hg; ctx.fillRect(px + 40, py + 2, pw - 80, 50);

  // 3. 标题与关卡名
  txt('DEFEAT · 战役失利', px + pw / 2, py + 30, 25, '#ff4757', 'center');
  txt(L.stageName, px + pw / 2, py + 66, 14, '#a2b4cb', 'center');

  // 4. 战况徽章与击杀进度
  const midY = py + 108;

  // 破损/失败勋章 (FAILED)
  const rankX = px + pw - 78, rankY = midY;
  ctx.save();
  ctx.beginPath(); ctx.arc(rankX, rankY, 26, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 71, 87, 0.15)'; ctx.fill();
  ctx.strokeStyle = '#ff4757'; ctx.lineWidth = 2; ctx.stroke();
  txt('FAIL', rankX, rankY - 1, 16, '#ff4757', 'center');
  txt('STATUS', rankX, rankY + 36, 10, '#8fa0b3', 'center');
  ctx.restore();

  // 目标讨伐进度条
  const barW = 280, barH = 14, barX = px + pw / 2 - barW / 2, barY = midY - 12;
  txt('战役突破进度: ' + L.kills + ' / ' + L.targetKills + ' (' + L.killPercent + '%)', px + pw / 2, barY - 14, 12, '#dfe6ee', 'center');
  rpath(barX, barY, barW, barH, 7);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'; ctx.fill();
  if (L.killPercent > 0) {
    rpath(barX, barY, barW * (L.killPercent / 100), barH, 7);
    ctx.fillStyle = '#ff4757'; ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255, 71, 87, 0.5)'; ctx.lineWidth = 1; ctx.stroke();

  // 战术指导提示
  txt(L.tip, px + pw / 2, py + 148, 11.5, '#ffa502', 'center');

  // 5. 奖励卡片网格
  const cardW = 180, cardH = 70, cardGap = 14;
  const cards = [
    { 
      title: '保留战利品', 
      val: '+' + Math.round(L.gold * p).toLocaleString(), 
      icon: ICO.g, 
      col: '#ffd84a', 
      badge: 'RESCUED 50%' 
    },
    { 
      title: '受损遗失', 
      val: '-' + Math.round(L.lostGold * p).toLocaleString(), 
      sym: '⚠', 
      col: '#ff6b81' 
    },
    { 
      title: '坚守时间', 
      val: L.time.toFixed(1) + ' 秒', 
      sym: '⏱', 
      col: '#7df9ff' 
    }
  ];

  const totalCardsW = cards.length * cardW + (cards.length - 1) * cardGap;
  const cardX0 = px + (pw - totalCardsW) / 2, cardY = py + 204;

  cards.forEach((cd, idx) => {
    const cx = cardX0 + idx * (cardW + cardGap);
    rpath(cx, cardY, cardW, cardH, 10);
    ctx.fillStyle = 'rgba(24, 12, 18, 0.85)'; ctx.fill();
    ctx.strokeStyle = cd.col + '55'; ctx.lineWidth = 1.2; ctx.stroke();

    if (cd.icon) drawIco(cd.icon, cx + 26, cardY + cardH / 2, 28);
    else txt(cd.sym || '◆', cx + 26, cardY + cardH / 2, 22, cd.col, 'center');

    txt(cd.title, cx + 48, cardY + 22, 11, '#8fa0b3');
    txt(cd.val, cx + 48, cardY + 46, 15, cd.col);

    if (cd.badge) {
      rpath(cx + cardW - 74, cardY + 5, 68, 15, 4);
      ctx.fillStyle = 'rgba(255, 216, 74, 0.25)'; ctx.fill();
      ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 1; ctx.stroke();
      txt(cd.badge, cx + cardW - 40, cardY + 12.5, 7.5, '#ffd84a', 'center');
    }
  });

  // 6. 当前经验条
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

  // 7. 三大交互按钮组
  const btnY = py + 342, btnH = 46;
  const btnDefs = [
    { id: 'base', text: '返回大厅 [ESC]', w: 140, bg: 'rgba(255,255,255,0.08)', col: '#ccd6e0', border: 'rgba(255,255,255,0.2)' },
    { id: 'char', text: '战备整备 [C]', w: 140, bg: 'rgba(0, 229, 255, 0.15)', col: '#7df9ff', border: '#00e5ff' },
    { id: 'retry', text: '再次挑战 [Enter/R]', w: 190, bg: 'rgba(255, 71, 87, 0.3)', col: '#ff6b81', border: '#ff4757', main: true }
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

    LOSE_HITS.push({ id: b.id, x: curBx, y: btnY, w: b.w, h: btnH });
    curBx += b.w + 12;
  });

  ctx.restore();
}

function gain(n, raw) {   // raw = true：已含经验加成，不再重复计算
  S.xp += (raw ? n : n * (1 + affixTotal('xp'))) | 0;
  let leveled = false;
  const oldLv = S.lv;
  while (S.xp >= xpNeed(S.lv)) {
    S.xp -= xpNeed(S.lv); S.lv++; S.tp++;
    leveled = true;
  }
  if (leveled) {
    calc();
    // ★ 定格时间调为 3 秒
    LV_POP = { t: 0, dur: 3.0, lv: S.lv, dLv: S.lv - oldLv };
    shake = Math.max(shake, 14);
    FX.push({ type: 'boom', x: P.x, y: P.y - 100, t: .5, d: .5, r: 240, c: '#ffd84a' });
  }
}

// 在 dropLoot(e) 中：
function dropLoot(e) {
  const isBoss = e.t === 'boss';
  const z = ST[cur];
  const isCoop = !!(z && z.coop);

  // ★ 强化卷轴：双人副本 5 倍狂暴掉落！
  let scr = 0;
  if (isBoss) scr = (2 + (Math.random() * 3 | 0)) * (isCoop ? 5 : 1) + (z.wb ? 3 : 0);
  else if (Math.random() < (e.t === 'wd' ? 0.14 : 0.05) * (isCoop ? 2.5 : 1)) scr = isCoop ? 3 : 1;

  if (scr) {
    S.scr = (S.scr || 0) + scr; save();
    DT.push({ x: e.x, y: e.y - e.h - 65, s: '📜强化卷轴 ×' + scr, t: 2.2, c: '#ffa502' });
  }

  // ★ 装备掉率：双人副本大幅提高，Boss 必掉高阶装备！
  const dropRate = isCoop 
    ? (isBoss ? 1.0 : (e.t === 'wd' ? 0.35 : 0.15)) 
    : (isBoss ? 0.6 : (e.t === 'wd' ? 0.10 : 0.04));
  if (Math.random() > dropRate) return;

  let tr = 0;
  const r = Math.random();
  if (isCoop) {
    // 双人专属高阶品质判定（4:传说, 5:神话）
    if (isBoss) tr = r < 0.25 ? 5 : r < 0.75 ? 4 : 3;
    else if (e.t === 'wd') tr = r < 0.12 ? 4 : r < 0.55 ? 3 : 2;
    else tr = r < 0.25 ? 3 : r < 0.65 ? 2 : 1;
  } else {
    // 单人模式原逻辑...
    const d = Math.min(cur, 29);
    if (isBoss) tr = r < 0.02 + d * 0.006 ? 5 : r < 0.12 + d * 0.010 ? 4 : r < 0.50 ? 3 : r < 0.85 ? 2 : 1;
    else if (e.t === 'wd') tr = r < 0.004 + d * 0.0025 ? 4 : r < 0.06 + d * 0.006 ? 3 : r < 0.35 ? 2 : 1;
    else tr = r < 0.01 ? 3 : r < 0.08 ? 2 : r < 0.40 ? 1 : 0;
  }

  const recLvl = (ST[cur] && ST[cur].r) ? ST[cur].r : 1;
  const dropLvl = isBoss ? recLvl : Math.min(recLvl, Math.max(1, recLvl - (Math.random() < 0.4 ? 1 : 0)));
  const dropEq = genItem(null, tr, dropLvl);
  S.inv.push(dropEq);
  save();

  DT.push({ x: e.x, y: e.y - e.h - 35, s: `💥掉落: [${TIERS[tr].n}] ${dropEq.name} (Lv.${dropEq.reqLvl})`, t: 2.4, c: TIERS[tr].c });
}

// pre：房主处理客机上报时传入 {c 暴击, f 朝向}，此时 d 已是客机算好的最终伤害
function hurt(e, d, pre) {
  const mp2 = typeof COOP !== 'undefined' && COOP.active && COOP.inGame;
  const guest = mp2 && !COOP.isHost;
  let c, f = P.f;
  if (pre) { c = !!pre.c; f = pre.f || 1; }
  else { c = Math.random() < P.cr; d = Math.round(d * (.9 + Math.random() * .2) * (c ? 2 : 1)); }

  // ★ 客机：本地只做命中反馈，真实扣血由房主结算
  if (guest) {
    if (e.dead) return;
    psHit(d, c);
    e.fl = .12; shake = Math.max(shake, 4);
    P.mp = Math.min(P.mm, P.mp + 3);
    // ★ 客机也要吸血：用客机自己装备的吸血词条（单次最多回 3% 生命上限）
    if (!P.down) { const ls = affixTotal('ls'); if (ls > 0) P.hp = Math.min(P.mh, P.hp + Math.min(P.mh * .03, Math.max(1, d * ls))); }
    DT.push({ x: e.x, y: e.y - e.h, s: d + (c ? '!' : ''), t: .8, c: c ? '#ff8a2a' : '#ffd84a' });
    coopSend('guest_hurt_m', { id: e.id, dmg: d, c: c ? 1 : 0, f });
    return;
  }

  if (e.t === 'boss' && ST[cur].wb) WBD += Math.max(0, Math.min(d, e.hp));
  if (!pre) psHit(d, c);
  if (!pre && !P.down) { const ls = affixTotal('ls'); if (ls > 0) P.hp = Math.min(P.mh, P.hp + Math.min(P.mh * .03, Math.max(1, d * ls))); }   // 吸血词条（单次最多回 3% 生命上限）
  e.hp -= d; e.fl = .12; e.x += f * (e.t === 'boss' ? 2 : 12);
  if (!pre) P.mp = Math.min(P.mm, P.mp + 3);
  DT.push({ x: e.x, y: e.y - e.h, s: d + (c ? '!' : ''), t: .8, c: c ? '#ff8a2a' : '#ffd84a' });
  shake = Math.max(shake, 4);

  // ★ 房主：把血量变化广播给客机（g=1 表示这一击来自客机，客机已自行显示伤害数字）
  if (mp2) coopSend('m_hurt_ack', { id: e.id, hp: e.hp, dmg: d, c: c ? 1 : 0, dead: e.hp <= 0, g: pre ? 1 : 0 });

  if (e.hp <= 0 && !e.dead) {
    e.dead = 1; kills++; if (!pre) psKill(e.t === 'boss');
    gain(ET[e.t].xp * .6 * (1 + Math.min(cur, 29) * .3)); 
    const gBase = ET[e.t].g * (1 + Math.min(cur, 29) * .3);
    RG += gBase * (1 + affixTotal('gd')) | 0;   // 金币加成词条
    if (mp2) COOP.RGb += gBase;                 // 联机：记录基础金币，客机按自己的词条结算
    if (Math.random() < .35) OR.push({ x: e.x, k: Math.random() < .5 ? 'h' : 'm' });
    dropLoot(e);
    if (e.t === 'boss') fin(1);
    FX.push({ type: 'boss_death_blast', x: e.x, y: e.y - e.h / 2, t: .6, d: .6, r: e.t === 'boss' ? 220 : 70 });
  }
}

// 打开 js/battle.js，替换原本的 area() 函数：
function area(x0, x1, dmg, set) {
  for (const e of E) {
    if (e.dead) continue;
    const w = e.w / 2;
    if (e.x + w > x0 && e.x - w < x1 && e.y > P.y - 160 && e.y - e.h < P.y && (!set || !set[e.id])) {
      if (set) set[e.id] = 1;
      hurt(e, dmg);   // 客机/房主/单人的分流统一在 hurt() 内处理
    }
  }
}

// ===== 普攻斩断 / 抵消敌方投射物（排除陨石、天降弹幕与地形范围投弹） =====
function cancelEP(x0, x1) {
  const yMin = P.y - 170, yMax = P.y + 10;
  for (const p of EP) {
    if (p.t <= 0) continue;

    // ★ 不可抵消规则：
    // 1. 丢出后落地形成范围/地形地池 (带重力抛物 p.g、地池 p.pool)
    // 2. 从天而降的坠落攻击 (陨石 p.tex === 'meteor' 或下坠速度过大)
    // 3. 贴地推进行进的岩石冲击波 (p.low 或 wave_ground)
    // 4. 显式标记 unblockable 的重型攻击
    if (p.unblockable || p.pool || p.g || p.low || p.tex === 'meteor' || p.tex === 'wave_ground') {
      continue; // 无法抵消，普通斩击无效，玩家必须跳跃或闪避
    }

    // 常规可抵消投射物（法球、连发射击、追踪弹、风刃）
    if (p.x >= x0 - 30 && p.x <= x1 + 30 && p.y >= yMin && p.y <= yMax) {
      p.t = 0;
      playSwordHit();
      shake = Math.max(shake, 4);
      FX.push({ type: 'boom', x: p.x, y: p.y, t: .2, d: .2, r: 40, c: '#00e5ff' });
      DT.push({ x: p.x, y: p.y - 25, s: '抵消!', t: .5, c: '#7df9ff' });
    }
  }
}

function hurtP(d) {
  if (P.inv > 0 || P.down || P.st === 'trans' || P.st === 'trans_ryuki' || G !== 'play') return;
  // ★ 怪物伤害 = 绝对数值，不再按「玩家当前最大生命」折算（血越厚挨得越痛 → 已修复）
  //   伤害 = 推荐等级期望生命 hpExp(z.r) × HIT_FRAC × 招式强弱(0.4~2) × 进度系数 × 关卡倍率(z.dmx，双人=3)
  //   · 等级：随关卡推荐等级 r 增长；玩家等级 / 血量越高，实际挨打占比越低，越级挑战则很疼
  //   · 进度：本关击杀进度 0%→100%，伤害 ×0.9 → ×1.1（世界BOSS等无击杀目标的关取 ×1.0）
  //   · 关卡：双人 dmx=3；首领/弹幕本身的强弱已体现在招式倍率里
  //   · 安全线：单次伤害 ≤ 最大生命 × DMG_MAX_FRAC
  const z = ST[cur], ref = 8 * z.dm;
  const prog = z.k > 0 ? Math.min(1, (kills || 0) / z.k) : .5;
  d = hpExp(z.r) * HIT_FRAC * cl(d / ref, .4, 2) * (.9 + .2 * prog) * (z.dmx || 1);
  d = Math.max(1, Math.round(Math.min(d, P.mh * DMG_MAX_FRAC)));
  d = Math.max(1, Math.round(d * (1 - (P.def || 0))));
  psTaken(d);
  P.hp -= d; P.inv = 1; shake = 10;
  DT.push({ x: P.x, y: P.y - 180, s: '-' + d, t: .8, c: '#ff6a6a' });
  if (P.hp <= 0) {
    P.hp = 0;
    // ★ 联机：不立即失败，进入濒死等待救援；双方都倒下才失败（由房主裁决）
    if (typeof coopBattleOn === 'function' && coopBattleOn()) coopOnDown(); else fin(0);
  }
}

function spawn(t, ox, vi) {
  const o = ET[t], z = ST[cur];
  const pool = (ENS[z.set] && ENS[z.set][t] && ENS[z.set][t].length) ? ENS[z.set][t] : EN[t];
  const vi2 = (vi !== undefined && vi >= 0) ? vi % pool.length : (Math.random() * pool.length | 0);
  const c = pool[vi2], s = o.H / c.height, side = Math.random() < .5 ? -1 : 1;

  // ★ 双人副本专属：全员怪物 500% 血量；攻击力 3 倍改在 hurtP 里按 z.dmx 统一结算（这里不再重复乘）
  const isCoop = !!z.coop;
  const hpMul = isCoop ? 5.0 : (t === 'boss' && z.hpx ? z.hpx : 1);
  const dmMul = 1.0;

  const hpFull = Math.max(1, Math.round(o.hp * z.hm * hpMul));
  // 世界BOSS：以开战时全服剩余血量开打，血条总量显示全服满血
  const hp = (t === 'boss' && z.wb && WB_LOC > 0) ? Math.min(hpFull, Math.round(WB_LOC)) : hpFull;
  const dm = Math.max(1, Math.round(o.dm * z.dm * dmMul));

  let x = ox !== undefined ? ox : P.x + side * (520 + Math.random() * 150);
  if (ox === undefined && (x < 60 || x > WW - 60)) x = P.x - side * 600;

  E.push({ 
    id: ++uid, t, im: c, vi: vi2, x: cl(x, 60, WW - 60), y: t === 'imp' ? 300 : GY, 
    hp, mhp: (t === 'boss' && z.wb) ? hpFull : hp, dm, h: o.H, w: c.width * s, s, fl: 0,
    cd: t === 'boss' ? 2 : 1.5 + Math.random() * 2, hc: 0, fc: 1, wu: 0, dsh: 0, atk: '', last: '' 
  });

  if (t === 'boss' && z.wb) WBM = hpFull;
}

// =====================================================================
//  怪物攻击系统：每章一套（见 config.js 的 ATK_SET）
//  流程：冷却结束 → 选招 → 前摇(闪红+惊叹号) → 出招
// =====================================================================
const BCOL = { 1: '#7dff5a', 2: '#ff3a10', 3: '#5352ed', 4: '#70a1ff', 5: '#2ed573', 6: '#ffa502', 7: '#a55eea', 8: '#ffd32a', 9: '#ff6348', 10: '#ff3838' };
const MCOL = { 1: '#4cd0ff', 2: '#ff9a00', 3: '#a29bfe', 4: '#74b9ff', 5: '#55efc4', 6: '#ffeaa7', 7: '#d6a2e8', 8: '#fff200', 9: '#ff7675', 10: '#ff4757' };

const ecol = e => { const s = ST[cur].set; return e.t === 'boss' ? (BCOL[s] || '#ff3a10') : (MCOL[s] || '#4cd0ff') };
const edm = (e, m = 1) => Math.max(1, Math.round((e.t === 'boss' ? 14 : e.t === 'wd' ? 9 : 6) * ST[cur].dm * m));
const aimA = e => Math.atan2(P.y - 90 - (e.y - e.h * .6), P.x - e.x);
const eSpd = e => (e.t === 'boss' ? 300 : 260) + ST[cur].set * 8;
const later = (t, f) => TQ.push({ t, f });

// 发射一枚弹丸；o 里可覆盖：g重力 hom追踪 wave波动 low贴地 r半径 slow/psn 附带效果
function ep(e, a, v, o) {
  const s = ST[cur].set;
  EP.push(Object.assign({
    x: e.x + e.fc * e.w * .4, y: e.y - e.h * .6, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
    dm: edm(e), c: ecol(e), t: 4, r: 10, slow: s === 4, psn: s === 5, a: 0,
    tex: 'energy' // 默认能量法球
  }, o || {}));
}

// 地面区域（HZ）：col 天降光柱 / blast 落点爆炸 / pool 持续伤害池 / beam 激光 / well 引力漩涡
function zoneCol(e, x, o) {
  o = o || {};
  HZ.push({ k: 'col', x: cl(x, 40, WW - 40), y: GY, w: o.w || 50, delay: o.delay || .85, dur: .35, t: 0, dm: edm(e, 1.25), c: ecol(e) });
}
function zoneBlast(e, x, w, delay, m) {
  HZ.push({ k: 'blast', x: cl(x, 40, WW - 40), y: GY, w, delay, dur: .3, t: 0, dm: edm(e, m), c: ecol(e) });
}

// 抛物重炮 / 腐蚀投弹
function lobShot(e, pool, off) {
  const x0 = e.x + e.fc * e.w * .4, y0 = e.y - e.h * .6, g = 900, T2 = .95 + Math.abs(P.x - e.x) / 1600;
  const tx = P.x + (off || 0), ty = GY - 14;
  ep(e, 0, 0, { 
    x: x0, y: y0, vx: (tx - x0) / T2, vy: ((ty - y0) - .5 * g * T2 * T2) / T2, 
    g, gy: ty, pool, t: 3, r: 16, dm: edm(e, 1),
    tex: pool ? 'poison' : 'lob',
    unblockable: true // 落地形成地形爆炸/毒液池，不可抵消
  });
}

// 怪物攻击招式表（所有招式必须完整包裹在 ATKS 内）
const ATKS = {
  aim:    { n: '瞄准射击', wu: .35, f(e) { ep(e, aimA(e), eSpd(e) * .9, { tex: 'energy' }) } },
  fan:    { n: '扇形齐射', wu: .45, f(e) { const n = e.t === 'boss' ? 5 : 3, a0 = aimA(e); for (let i = 0; i < n; i++) ep(e, a0 + (i - (n - 1) / 2) * .24, eSpd(e), { tex: 'energy' }) } },
  burst:  { n: '连发扫射', wu: .4, f(e) {
    const n = e.t === 'boss' ? 8 : 4;
    for (let i = 0; i < n; i++) later(i * .13, () => { if (!e.dead) ep(e, aimA(e) + (Math.random() - .5) * .12, eSpd(e) * 1.25, { dm: edm(e, .7), tex: 'energy' }) });
  } },
  ring:   { n: '环形爆裂', wu: .55, f(e) {
    const n = e.t === 'boss' ? 14 : 8, r0 = Math.random() * 6;
    for (let i = 0; i < n; i++) ep(e, r0 + i * Math.PI * 2 / n, 200, { x: e.x, y: e.y - e.h * .5, tex: 'energy' });
    FX.push({ type: 'boom', x: e.x, y: e.y - e.h * .5, t: .4, d: .4, r: 90, c: ecol(e) });
  } },
  lob:    { n: '抛物重炮', wu: .5, f(e) {
    if (e.t === 'boss') [-150, 0, 150].forEach((o, i) => later(i * .18, () => { if (!e.dead) lobShot(e, false, o) }));
    else lobShot(e, false, 0);
  } },
  lobPool:{ n: '腐蚀投弹', wu: .5, f(e) {
    if (e.t === 'boss') [-110, 110].forEach((o, i) => later(i * .2, () => { if (!e.dead) lobShot(e, true, o) }));
    else lobShot(e, true, 0);
  } },
  pillar: { n: '天降打击', wu: .5, f(e) { zoneCol(e, P.x) } },
  zap:    { n: '落雷', wu: .45, f(e) { zoneCol(e, P.x, { w: 34, delay: .75 }) } },
  pillars:{ n: '天柱连击', wu: .7, f(e) {
    const px = P.x;
    for (let i = 0; i < 5; i++) later(i * .16, () => { if (!e.dead) zoneCol(e, px + (i - 2) * 130, { delay: .8 }) });
  } },
  rain: { n: '弹幕坠落', wu: .5, f(e) {
    const n = e.t === 'boss' ? 10 : 5, s = ST[cur].set;
    for (let i = 0; i < n; i++) later(i * .16, () => {
      if (e.dead) return;
      EP.push({ 
        x: cl(P.x + (Math.random() - .5) * 760, 30, WW - 30), y: -20, 
        vx: (Math.random() - .5) * 30, vy: 380, dm: edm(e, .9), c: ecol(e), 
        t: 3, r: 15, slow: s === 4, psn: s === 5, a: 0, tex: 'meteor',
        unblockable: true // 从天而降的陨石，不可抵消
      });
    });
  } },
  wave:   { n: '波形冲击', wu: .45, f(e) {
    const dir = P.x < e.x ? Math.PI : 0;
    for (let i = 0; i < 3; i++) later(i * .2, () => { 
      if (!e.dead) ep(e, dir, eSpd(e) * .85, { wave: 48, y0: e.y - e.h * .55, r: 16, tex: 'wave_air' }); 
    });
  } },
  homing: { n: '追踪光球', wu: .5, f(e) {
    const n = e.t === 'boss' ? 3 : 1;
    for (let i = 0; i < n; i++) ep(e, -Math.PI / 2 + (i - (n - 1) / 2) * .7, 170, { hom: 2.4, t: 5, r: 15, dm: edm(e, 1.1), tex: 'homing' });
  } },
  slam: { n: '震地冲击', wu: .65, f(e) {
    const waves = e.t === 'boss' ? 2 : 1;
    for (let w = 0; w < waves; w++) later(w * .38, () => {
      if (e.dead) return;
      for (const dir of [-1, 1]) {
        EP.push({ 
          x: e.x + dir * e.w * .4, y: GY - 18, vx: dir * 380, vy: 0, 
          low: 1, dm: edm(e, 1.25), c: ecol(e), t: 2.4, r: 20, a: 0, 
          tex: 'wave_ground',
          unblockable: true // 地面突刺，必须起跳躲避，不可用刀劈碎
        });
      }
      shake = Math.max(shake, 12);
      FX.push({ type: 'boom', x: e.x, y: GY - 6, t: .4, d: .4, r: 110, c: ecol(e) });
    });
  } },
  beam:   { n: '激光扫射', wu: .55, f(e) {
    HZ.push({ k: 'beam', x: e.x, y: GY - 70, hh: 20, dir: e.fc, len: 1100, delay: .85, dur: .55, tick: .2, tk: 0, t: 0, dm: edm(e, .6), c: ecol(e) });
  } },
  vortex: { n: '引力漩涡', wu: .7, f(e) {
    HZ.push({ k: 'well', x: cl(P.x + (Math.random() - .5) * 300, 120, WW - 120), y: GY - 90, w: 150, delay: 0, dur: 2.2, t: 0, dm: edm(e, 1.6), c: ecol(e), pull: 210 });
  } },
  spiral: { n: '螺旋弹幕', wu: .6, f(e) {
    const arms = e.t === 'boss' ? 2 : 1;
    for (let i = 0; i < 16; i++) later(i * .09, () => {
      if (e.dead) return;
      for (let a = 0; a < arms; a++) ep(e, i * .45 + a * Math.PI, 230, { x: e.x, y: e.y - e.h * .5, tex: 'energy' });
    });
  } },
  meteor: { n: '陨星轰炸', wu: .6, f(e) {
    const n = e.t === 'boss' ? 7 : 3, px = P.x;
    for (let i = 0; i < n; i++) later(i * .22, () => { if (!e.dead) zoneBlast(e, px + (i === 0 ? 0 : (Math.random() - .5) * 620), 80, .95, 1.3) });
  } },
  swoop:  { n: '俯冲突袭', wu: .5, f(e) { const t = e.lk || { x: P.x, y: P.y - 70 }; e.dsh = .6; e.dvx = (t.x - e.x) / .4; e.dvy = (t.y - e.y) / .4; e.hc = 0 } },
  charge: { n: '狂暴冲锋', wu: .7, f(e) { e.dsh = .75; e.dvx = e.fc * (520 + ST[cur].set * 15); e.dvy = 0; e.hc = 0 } },
  summon: { n: '召唤魔物', wu: .8, f(e) {
    for (let i = 0; i < 2; i++) if (E.length < 12 && !(typeof coopIsGuest === 'function' && coopIsGuest())) spawn('imp', e.x + (i ? 1 : -1) * 140);
    FX.push({ type: 'boom', x: e.x, y: e.y - e.h * .5, t: .5, d: .5, r: 130, c: ecol(e) });
  } },
  blink:  { n: '瞬影突袭', wu: .35, f(e) {
    FX.push({ type: 'boom', x: e.x, y: e.y - e.h * .5, t: .3, d: .3, r: 60, c: ecol(e) });
    e.x = cl(P.x + (Math.random() < .5 ? -1 : 1) * 280, 60, WW - 60);
    FX.push({ type: 'boom', x: e.x, y: e.y - e.h * .5, t: .3, d: .3, r: 60, c: ecol(e) });
    later(.25, () => { if (!e.dead) { e.fc = P.x < e.x ? -1 : 1; ATKS.fan.f(e) } });
  } }
};

const LOCK_T = .22;   // 冲锋 / 俯冲：出手前多久锁定落点

function cdBase(e) {
  const s = ST[cur].set, b = e.t === 'boss' ? 1.9 : e.t === 'wd' ? 3.0 : 3.6;
  return (b + Math.random() * 1.2) * (1 - Math.min(.3, s * .025)) * (e.t === 'boss' && e.hp < e.mhp * .5 ? .7 : 1);
}

function startAtk(e) {
  const s = ST[cur].set, set = ATK_SET[s] || ATK_SET[1], list = set[e.t] || set.wd;
  let name; do { name = list[Math.random() * list.length | 0] } while (list.length > 1 && name === e.last);
  e.last = e.atk = name; e.wu = ATKS[name].wu; e.lk = null;
  if (e.t === 'boss') DT.push({ x: e.x, y: e.y - e.h - 20, s: THEME[s] + '·' + ATKS[name].n, t: 1.1, c: ecol(e) });
}

function updEnemy(e, dt) {
  if (e.dead) return;
  const o = ET[e.t], d = P.x - e.x, ad = Math.abs(d);
  e.fl -= dt; e.cd -= dt; e.hc -= dt;

  if (e.t === 'boss' && !e.rg && e.hp < e.mhp * .5) {
    e.rg = 1; shake = 14; e.cd = Math.min(e.cd, .6);
    DT.push({ x: e.x, y: e.y - e.h - 50, s: 'BOSS 狂暴化！', t: 1.6, c: '#ff3838' });
  }

  if (e.dsh > 0) {                                   // 冲刺中（俯冲 / 冲锋）
    e.dsh -= dt; e.x = cl(e.x + e.dvx * dt, 40, WW - 40);
    if (e.t === 'imp') e.y += e.dvy * dt;
    if (e.dsh <= 0) e.cd = cdBase(e);
  } else if (e.wu > 0) {                             // 前摇（原地蓄力）
    e.wu -= dt;
    if (e.wu > LOCK_T) { if (ad > 14) e.fc = d < 0 ? -1 : 1; e.lk = null }          // 前摇前段：跟随玩家
    else if (!e.lk) e.lk = { x: P.x, y: P.y - 70, fc: e.fc };           // 出手前 0.22s：锁定落点，给玩家留出闪避时间
    if (e.t === 'imp' && e.atk === 'swoop') e.y += (150 - e.y) * Math.min(1, 3 * dt);
    if (e.wu <= 0) { e.wu = 0; ATKS[e.atk].f(e); e.lk = null; if (!(e.dsh > 0)) e.cd = cdBase(e) }
  } else {                                           // 正常移动
    if (ad > 14) e.fc = d < 0 ? -1 : 1;                      // 正下方/贴身时保持朝向，避免每帧翻转
    if (e.t === 'imp') {
      if (ad > 40) e.x += Math.sign(d) * o.sp * dt * Math.min(1, (ad - 40) / 40);   // 接近时平滑减速
      e.y += (P.y - 110 + Math.sin(T * 3 + e.id) * 50 - e.y) * Math.min(1, 2 * dt);
    } else {
      const stop = e.t === 'wd' ? 330 : 60;
      if (ad > stop) e.x += Math.sign(d) * o.sp * dt * Math.min(1, (ad - stop) / 40);
      else if (e.t === 'wd' && ad < 250) e.x -= Math.sign(d) * o.sp * dt * Math.min(1, (250 - ad) / 40);
      e.y = e.t === 'wd' ? GY - 30 + Math.sin(T * 2 + e.id) * 15 : GY;
    }
    if (e.cd <= 0 && ad < 720) startAtk(e);
  }

  if (Math.abs(P.x - e.x) < e.w / 2 + 25 && e.y > P.y - 150 && e.y - e.h < P.y && e.hc <= 0 && P.inv <= 0) {
    e.hc = .8; hurtP(e.dm);
  }
}

// ===== battle.js 补充内容：怪物浮空与连招判定 =====

// 在 updEnemy(e, dt) 的逻辑开始或合适处，加入怪物受击垂直位移及重力模拟：
function updEnemyPhysics(e, dt) {
  if (e.vy !== undefined && e.vy !== 0) {
    e.y += e.vy * dt;
    e.vy += 1800 * dt; // 重力加速度
    if (e.t !== 'imp' && e.y >= GY) {
      e.y = GY;
      e.vy = 0;
    }
  }
}

// 1. 升龙击挑飞判定：将范围内的敌人向上挑起
function knockupEnemies(x0, x1, dmg, upForce = -650) {
  for (const e of E) {
    if (e.dead) continue;
    const w = e.w / 2;
    if (e.x + w > x0 && e.x - w < x1 && e.y >= P.y - 140 && e.y <= P.y + 20) {
      hurt(e, dmg);
      // BOSS 具有霸体，小怪和精英怪可被挑飞
      if (e.t !== 'boss') {
        if (e.vy === undefined) e.vy = 0;
        e.vy = upForce;
        e.y -= 10;
        e.fl = 0.2;
      }
    }
  }
}

// 2. 空中下砸判定：将怪物沿途向下砸落
function slamDownEnemies(x0, x1, dmg) {
  for (const e of E) {
    if (e.dead) continue;
    const w = e.w / 2;
    if (e.x + w > x0 && e.x - w < x1 && Math.abs((e.y - e.h * 0.5) - P.y) < 90) {
      hurt(e, dmg);
      if (e.t !== 'boss') {
        if (e.vy === undefined) e.vy = 0;
        e.vy = 900; // 快速砸向地面
      }
    }
  }
}

// 区域命中判定
function hzHit(h) {
  if (h.k === 'col') return Math.abs(P.x - h.x) < h.w + 20;
  if (h.k === 'blast' || h.k === 'pool') return Math.abs(P.x - h.x) < h.w + 15 && P.y > GY - 70;   // 跳起来可躲
  if (h.k === 'beam') { const dx = (P.x - h.x) * h.dir; return dx > -20 && dx < h.len && Math.abs(P.y - 80 - h.y) < h.hh + 40 }
  if (h.k === 'well') return Math.hypot(P.x - h.x, P.y - 80 - h.y) < h.w;
  return false;
}

// 每帧：延迟队列 / 弹丸 / 区域 / 中毒与减速
function updBattleFx(dt) {
  for (const q of TQ) q.t -= dt;
  const due = TQ.filter(q => q.t <= 0); TQ = TQ.filter(q => q.t > 0);
  due.forEach(q => q.f());

  for (const p of EP) {
    p.a += dt; p.t -= dt;
    if (p.hom) {
      const sp2 = Math.hypot(p.vx, p.vy); let ca = Math.atan2(p.vy, p.vx);
      let da = Math.atan2(P.y - 80 - p.y, P.x - p.x) - ca; da = Math.atan2(Math.sin(da), Math.cos(da));
      ca += cl(da, -p.hom * dt, p.hom * dt); p.vx = Math.cos(ca) * sp2; p.vy = Math.sin(ca) * sp2;
    }
    if (p.g) p.vy += p.g * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.wave) p.y = p.y0 + Math.sin(p.a * 7) * p.wave;

    if (p.g && p.vy > 0 && p.y >= p.gy) {                       // 抛物弹落地
      FX.push({ type: 'boom', x: p.x, y: GY - 10, t: .4, d: .4, r: 70, c: p.c });
      HZ.push(p.pool
        ? { k: 'pool', x: p.x, y: GY, w: 75, delay: 0, dur: 4.5, tick: .5, tk: 0, t: 0, dm: Math.max(1, p.dm * .45 | 0), c: p.c }
        : { k: 'blast', x: p.x, y: GY, w: 55, delay: 0, dur: .2, t: 0, dm: p.dm, c: p.c });
      p.t = 0; continue;
    }
    if (p.y > GY + 20 || p.y < -260 || p.x < -100 || p.x > WW + 100) { p.t = 0; continue }

    const hit = p.low ? (Math.abs(P.x - p.x) < 34 && P.y > GY - 50) : (Math.hypot(p.x - P.x, p.y - (P.y - 80)) < p.r + 30);
    if (hit && P.inv <= 0) {
      hurtP(p.dm); p.t = 0;
      if (p.slow) P.slow = 1.8;
      if (p.psn) P.psn = 4;
    }
  }
  EP = EP.filter(p => p.t > 0);

  for (const h of HZ) {
    h.t += dt;
    if (h.t < h.delay || h.t >= h.delay + h.dur) continue;
    if (h.k === 'pool' || h.k === 'beam') {
      h.tk -= dt;
      if (h.tk <= 0) { h.tk = h.tick; if (hzHit(h)) hurtP(h.dm) }
    } else if (h.k === 'well') {
      const dx = h.x - P.x;
      if (Math.abs(dx) < 420 && P.st !== 'fv') P.x = cl(P.x + Math.sign(dx) * h.pull * dt, 30, WW - 30);
      if (!h.hit && h.t >= h.dur - .05) { h.hit = 1; shake = Math.max(shake, 10); FX.push({ type: 'boom', x: h.x, y: h.y, t: .4, d: .4, r: h.w, c: h.c }); if (hzHit(h)) hurtP(h.dm) }
    } else if (!h.hit) {
      h.hit = 1; shake = Math.max(shake, h.k === 'col' ? 8 : 6);
      if (hzHit(h)) hurtP(h.dm);
    }
  }
  HZ = HZ.filter(h => h.t < h.delay + h.dur);

  if (P.slow > 0) P.slow -= dt;
  if (P.psn > 0) {
    P.psn -= dt; P.pt = (P.pt || 0) - dt;
    if (P.pt <= 0) {
      P.pt = .5; const dd = Math.max(1, Math.round(P.mh * .008));
      P.hp = Math.max(1, P.hp - dd);
      DT.push({ x: P.x, y: P.y - 190, s: '-' + dd + '☠', t: .6, c: '#7dff5a' });
    }
  }
}

// ---------- 地面区域 / 陷阱 / 天降光柱 / 激光 / 漩涡渲染 ----------
function drawHZ() {
  for (const h of HZ) {
    const x = h.x - cam, act = h.t >= h.delay, pr = cl(h.t / h.delay, 0, 1);
    const warnImg = EF_IMGS['warn'];
    ctx.save();

    if (h.k === 'col') {
      // 1. 天降打击 / 落雷 / 天柱连击
      if (!act) {
        // [预警A] 贯穿天地的预警天光柱（半透明警示带）
        ctx.fillStyle = h.c;
        ctx.globalAlpha = 0.06 + 0.16 * pr;
        ctx.fillRect(x - h.w, 0, h.w * 2, GY);
        
        ctx.strokeStyle = h.c;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 6]);
        ctx.strokeRect(x - h.w, 0, h.w * 2, GY);
        ctx.setLineDash([]);

        // [预警B] 地面危险倒计时圈：外圈向中心逐步紧缩，圈合拢瞬间雷电劈下！
        const rMax = Math.max(38, h.w * 1.4);
        const rShrink = Math.max(6, rMax * (1 - pr)); // 紧缩倒计时圈
        
        // 地面警戒底盘
        ctx.beginPath();
        ctx.ellipse(x, GY + 2, rMax, rMax * 0.32, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 59, 48, 0.22)';
        ctx.fill();
        ctx.strokeStyle = h.c;
        ctx.lineWidth = 2;
        ctx.stroke();

        // 倒计时紧缩高亮白圈
        ctx.beginPath();
        ctx.ellipse(x, GY + 2, rShrink, rShrink * 0.32, 0, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 8;
        ctx.stroke();

        // 空中漂浮闪电警示符
        txt('⚡', x, GY - 70 - Math.sin(T * 8) * 8, 20, h.c, 'center');

        // 如有 warn 图，叠加上去增加质感
        if (warnImg) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.4 + 0.5 * pr;
          const rw = h.w * 1.3, rh = rw * 0.35;
          ctx.drawImage(warnImg, x - rw, GY + 2 - rh, rw * 2, rh * 2);
        }
      } else {
        // [爆发态] 天降高耸光柱贴图
        const beamImg = EF_IMGS['pillar'];
        if (beamImg) {
          ctx.globalCompositeOperation = 'lighter';
          const q = (h.t - h.delay) / h.dur;
          ctx.globalAlpha = Math.max(0, 1 - q * 0.7);
          ctx.drawImage(beamImg, x - h.w * 1.4, 0, h.w * 2.8, GY + 10);
        } else {
          ctx.fillStyle = h.c; ctx.shadowColor = h.c; ctx.shadowBlur = 30; ctx.globalAlpha = .85;
          ctx.fillRect(x - h.w, 0, h.w * 2, GY + 8);
        }
      }
    } else if (h.k === 'beam') {
      // 2. 横向激光扫射
      const laserImg = EF_IMGS['laser'];
      const xStart = x, xEnd = x + h.dir * h.len;
      const xLeft = Math.min(xStart, xEnd);
      const beamW = Math.abs(h.len);
      const beamH = h.hh * 2; // 真实碰撞判定全宽（40px）

      if (!act) {
        // [预警A] 真实伤害范围的半透明警戒通道（跳跃高度高于此带即可躲避）
        ctx.fillStyle = 'rgba(255, 50, 60, ' + (0.12 + 0.15 * pr).toFixed(3) + ')';
        ctx.fillRect(xLeft, h.y - h.hh, beamW, beamH);

        // 警戒通道上下边界虚线
        ctx.strokeStyle = '#ff3b3b';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([12, 8]);
        ctx.lineDashOffset = -T * 50 * h.dir;
        ctx.beginPath();
        ctx.moveTo(xLeft, h.y - h.hh); ctx.lineTo(xLeft + beamW, h.y - h.hh);
        ctx.moveTo(xLeft, h.y + h.hh); ctx.lineTo(xLeft + beamW, h.y + h.hh);
        ctx.stroke();
        ctx.setLineDash([]);

        // [预警B] 中心高能红外聚能瞄准线
        ctx.strokeStyle = (T * 20 | 0) % 2 ? '#ffffff' : '#ff4757';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(xStart, h.y);
        ctx.lineTo(xEnd, h.y);
        ctx.stroke();

        // [预警C] 枪口/眼部汇聚的高温能量耀斑（越来越大越耀眼）
        const glowR = 12 + 28 * pr + Math.sin(T * 25) * 4;
        const gr = ctx.createRadialGradient(xStart, h.y, 2, xStart, h.y, glowR);
        gr.addColorStop(0, '#ffffff');
        gr.addColorStop(0.4, '#ff4757');
        gr.addColorStop(1, 'rgba(255, 71, 87, 0)');
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(xStart, h.y, glowR, 0, Math.PI * 2);
        ctx.fill();

        // 枪口警示标记
        txt('⚠ LASER', xStart + h.dir * 40, h.y - h.hh - 12, 12, '#ff6b6b', 'center');
      } else {
        // [发射态] 激光喷涌
        if (laserImg) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.translate(x, h.y);
          ctx.scale(h.dir, 1);
          ctx.drawImage(laserImg, 0, -h.hh * 1.5, h.len, h.hh * 3);
        } else {
          ctx.fillStyle = h.c; ctx.shadowColor = h.c; ctx.shadowBlur = 28; ctx.globalAlpha = .8;
          ctx.fillRect(xLeft, h.y - h.hh, beamW, beamH);
        }
      }
    } else if (h.k === 'blast') {
      // 3. 陨石/投弹落点
      if (!act) {
        if (warnImg) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.4 + 0.5 * Math.sin(T * 12);
          const rw = h.w * pr, rh = rw * 0.35;
          ctx.drawImage(warnImg, x - rw, GY + 2 - rh, rw * 2, rh * 2);
        } else {
          ctx.strokeStyle = h.c; ctx.lineWidth = 2; ctx.globalAlpha = 0.5;
          ctx.beginPath(); ctx.ellipse(x, GY + 2, h.w, h.w * .26, 0, 0, 7); ctx.stroke();
        }
      } else {
        const expImg = EF_IMGS['explosion'];
        const q = (h.t - h.delay) / h.dur;
        if (expImg) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = Math.max(0, 1 - q);
          const r = h.w * (1 + q * 0.4);
          ctx.drawImage(expImg, x - r, GY - r * 0.8, r * 2, r * 1.6);
        }
      }
    } else if (h.k === 'pool') {
      // 4. 腐蚀地池
      const acidImg = EF_IMGS['pool_acid'];
      const life = cl((h.delay + h.dur - h.t) / .8, 0, 1);
      if (acidImg) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (0.75 + Math.sin(T * 4) * 0.15) * life;
        const pw = h.w * 1.5, ph = pw * 0.38;
        ctx.drawImage(acidImg, x - pw / 2, GY - ph / 2 + 4, pw, ph);
      } else {
        ctx.fillStyle = h.c; ctx.globalAlpha = .35 * life;
        ctx.beginPath(); ctx.ellipse(x, GY, h.w, h.w * .24, 0, 0, 7); ctx.fill();
      }
    } else if (h.k === 'well') {
      // 5. 引力黑洞
      const vortexImg = EF_IMGS['vortex'];
      if (vortexImg) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(x, h.y);
        ctx.rotate(-T * 3.5);
        ctx.drawImage(vortexImg, -h.w, -h.w, h.w * 2, h.w * 2);
      } else {
        ctx.fillStyle = '#05030a'; ctx.beginPath(); ctx.arc(x, h.y, 24, 0, 7); ctx.fill();
      }
    }
    ctx.restore();
  }
}

// ---------- 冲锋 / 俯冲：落点预警 ----------
function drawDashWarn(e) {
  const p = dashPlan(e); if (!p) return;
  const fx = p.x0 - cam, tx = p.x1 - cam, dir = tx >= fx ? 1 : -1, len = Math.abs(tx - fx);
  const blink = (T * (p.lock ? 18 : 8) | 0) % 2, RED = '#ff3b3b';
  const fy = p.y0 - e.h / 2, ty = p.y1 - e.h / 2;
  const warnImg = EF_IMGS['warn'];
  ctx.save();

  // 1) 冲刺碰撞体积通道
  ctx.strokeStyle = RED; ctx.lineCap = 'butt'; ctx.lineWidth = Math.max(36, e.h * .9);
  ctx.globalAlpha = p.lock ? .18 + .1 * blink : .09;
  ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(tx, ty); ctx.stroke();

  // 2) 导向线与动态流动虚线
  ctx.lineWidth = 3; ctx.globalAlpha = p.lock ? .95 : .6;
  ctx.setLineDash(p.lock ? [] : [14, 10]); ctx.lineDashOffset = -T * 70 * dir;
  ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.setLineDash([]);

  // 3) 落点处预警法阵贴图
  if (warnImg) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = p.lock ? 0.9 : 0.55;
    const rw = Math.max(45, e.w * 0.6), rh = rw * 0.35;
    ctx.drawImage(warnImg, tx - rw, GY + 4 - rh, rw * 2, rh * 2);
  } else {
    ctx.lineWidth = 3; ctx.strokeStyle = RED; ctx.globalAlpha = p.lock ? .95 : .65;
    ctx.beginPath(); ctx.ellipse(tx, GY + 5, Math.max(38, e.w / 2), 12, 0, 0, 7); ctx.stroke();
  }

  // 4) 终点残影预示
  if (e.im) {
    ctx.globalAlpha = p.lock ? .4 : .24; ctx.translate(tx, p.y1); ctx.scale(dir * e.s, e.s);
    ctx.drawImage(e.im, -e.im.width / 2, -e.im.height);
  }
  ctx.restore();
  txt('▼', tx, p.y1 - e.h - 18 - Math.abs(Math.sin(T * 9)) * 6, 22, RED, 'center');
}

function drawEP() {
  for (const p of EP) {
    const x = p.x - cam;
    const img = p.tex ? EF_IMGS[p.tex] : null;

    ctx.save();
    if (img) {
      if (p.tex === 'wave_ground') {
        // 贴地突刺：底部固定在地面 GY
        const w = 110, h = 80;
        ctx.translate(x, GY);
        ctx.scale(p.vx > 0 ? 1 : -1, 1);
        ctx.drawImage(img, -w * 0.45, -h + 8, w, h);
      } else {
        // 空中投射物：随速度方向旋转
        const ang = Math.atan2(p.vy || 0, p.vx || 0);
        ctx.translate(x, p.y);
        ctx.rotate(ang);

        let dw = 60, dh = 60, ox = -dw / 2; // 默认尺寸与正中心对齐
        if (p.tex === 'energy') { 
          dw = 64; dh = 64; ox = -dw / 2; // 圆形法球，中心对称
          ctx.shadowColor = p.c || '#a29bfe';
          ctx.shadowBlur = 10;
        } else if (p.tex === 'wave_air') { 
          dw = 95; dh = 52; ox = -dw * 0.6;
          ctx.shadowColor = p.c || '#7df';
          ctx.shadowBlur = 12;
        } else if (p.tex === 'meteor') { 
          dw = 115; dh = 58; ox = -dw * 0.6;
        } else if (p.tex === 'homing') { 
          dw = 70; dh = 70; ox = -dw * 0.55;
        } else if (p.tex === 'lob' || p.tex === 'poison') { 
          dw = 75; dh = 75; ox = -dw * 0.5;
        }

        ctx.drawImage(img, ox, -dh / 2, dw, dh);
      }
    } else {
      // 贴图未就绪时的兜底纯色渲染
      ctx.fillStyle = p.c;
      ctx.shadowColor = p.c;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      if (p.low) ctx.ellipse(x, GY - 26, 14, 32, 0, 0, 7); 
      else ctx.arc(x, p.y, p.r, 0, 7);
      ctx.fill();
    }
    ctx.restore();
  }
}


// ---------- 冲锋 / 俯冲：落点预警 ----------
// 前摇阶段预测终点；出手前 LOCK_T 秒锁定（实线变亮）；冲刺过程中继续显示剩余路径
function dashPlan(e) {
  if (e.dead || (e.atk !== 'charge' && e.atk !== 'swoop')) return null;
  const imp = e.t === 'imp';
  if (e.dsh > 0) {
    return { x0: e.x, y0: e.y, x1: cl(e.x + e.dvx * e.dsh, 40, WW - 40), y1: imp ? Math.min(GY, e.y + e.dvy * e.dsh) : e.y, lock: true };
  }
  if (!(e.wu > 0)) return null;
  let dvx, dvy = 0, dur;
  if (e.atk === 'charge') { dvx = e.fc * (520 + ST[cur].set * 15); dur = .75 }
  else { const t = e.lk || { x: P.x, y: P.y - 70 }; dvx = (t.x - e.x) / .4; dvy = (t.y - e.y) / .4; dur = .6 }
  return { x0: e.x, y0: e.y, x1: cl(e.x + dvx * dur, 40, WW - 40), y1: imp ? Math.min(GY, e.y + dvy * dur) : e.y, lock: e.wu <= LOCK_T };
}

// ===== 战车脱手突击实体系统 =====
function spawnBike() {
  if (!BK) return;
  BIKES.push({
    x: P.x + P.f * 50,
    y: GY,
    vx: P.f * 1050,
    f: P.f,
    t: 1.6,
    d: 1.6,
    dmg: P.atk * 1.5,
    hit: {},
    tick: 0
  });
  shake = Math.max(shake, 6);
  DT.push({ x: P.x, y: P.y - 170, s: '战车出击!', t: .8, c: '#ffd84a' });
}

function updBikes(dt) {
  for (const b of BIKES) {
    b.t -= dt;
    b.x += b.vx * dt;
    b.tick -= dt;
    
    // 每 0.2 秒刷新一次命中字典，让贯穿多段打击成立
    if (b.tick <= 0) {
      b.tick = 0.2;
      b.hit = {};
    }
    
    // 战车碾压判定 & 碾碎沿途敌方投射物
    if (!b.vis) {   // 队友战车仅展示，判定由队友自己的客户端负责
      cancelEP(b.x - 70, b.x + 70);
      area(b.x - 80, b.x + 80, b.dmg, b.hit);
    }

    // 尾部喷气与轮胎火花
    if (Math.random() < 0.45) {
      FX.push({ type: 'boom', x: b.x - b.f * 90, y: b.y - 25 + Math.random() * 10, t: .16, d: .16, r: 24, c: '#ffa502' });
    }
  }
  BIKES = BIKES.filter(b => b.t > 0);
}

function drawBikes() {
  if (!BK) return;
  const s = 230 / BK.width;
  for (const b of BIKES) {
    const x = sn(b.x - cam), y = sn(b.y), f = b.f;
    // 拖尾光效
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = 'rgba(255,210,90,' + (.4 - i * .09) + ')';
      ctx.fillRect(x - f * (100 + i * 35) - 20, y - 35 - i * 10, 35, 4);
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(f * s, s);
    ctx.drawImage(BK, -BK.width / 2, -BK.height);
    ctx.restore();
  }
}

// ===== 关卡流转辅助 =====
// 下一关索引：双人副本只在双人副本池里前进；单人关卡不会误入双人副本；没有则返回 -1
function nextStageIdx() {
  const z = ST[cur];
  if (z && z.tw) return cur;   // 无尽塔：永远有「下一层」
  if (z && z.coop) return (ST[cur + 1] && ST[cur + 1].coop) ? cur + 1 : -1;
  return (cur + 1 < ST.length && !ST[cur + 1].wb && !ST[cur + 1].coop && !ST[cur + 1].tw) ? cur + 1 : -1;
}

// 结算界面的「再次挑战 / 下一关」统一入口：联机时只发起投票，双方一致才会真正开始
function settleAct(act) {
  const multi = typeof coopSettleActive === 'function' && coopSettleActive();
  if (act === 'retry') {
    if (multi) coopVote('retry'); else begin(cur);
    return;
  }
  if (act === 'next') {
    if (ST[cur] && ST[cur].tw) { towerNext(); return; }   // 无尽塔：直接进入下一层
    const nx = nextStageIdx();
    if (nx < 0) { toVil('st'); return; }
    if (multi) coopVote('next'); else begin(nx);
  }
}