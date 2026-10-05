// ===== 连击动作评价系统 (Style Rank System) =====
const STYLE_RANKS = [
  { rank: 'D',   title: "DON'T STOP", min: 1,  col: '#a4b0be', spdMul: 1.02, mpAdd: 1 },
  { rank: 'C',   title: 'COOL!',      min: 5,  col: '#70a1ff', spdMul: 1.05, mpAdd: 2 },
  { rank: 'B',   title: 'BRAVO!',     min: 12, col: '#2ed573', spdMul: 1.08, mpAdd: 3 },
  { rank: 'A',   title: 'AWESOME!',   min: 22, col: '#ffa502', spdMul: 1.12, mpAdd: 4 },
  { rank: 'S',   title: 'STYLISH!!',  min: 36, col: '#ff4757', spdMul: 1.16, mpAdd: 5 },
  { rank: 'SS',  title: 'SUPERIOR!!', min: 55, col: '#e056fd', spdMul: 1.20, mpAdd: 7 },
  { rank: 'SSS', title: 'SUPREME!!!', min: 80, col: '#ffd32a', spdMul: 1.25, mpAdd: 10 }
];

const COMBO = {
  count: 0,
  timer: 0,
  maxT: 3.2,      // 连击保护时间 3.2 秒
  rankIdx: 0,
  pop: 1.0,       // 升阶弹性缩放动画
  flash: 0        // 升阶光晕
};

// 增加连击数并检测升阶
function addComboHit() {
  COMBO.count++;
  COMBO.timer = COMBO.maxT;

  const oldRank = COMBO.rankIdx;
  let newRank = 0;
  for (let i = STYLE_RANKS.length - 1; i >= 0; i--) {
    if (COMBO.count >= STYLE_RANKS[i].min) {
      newRank = i;
      break;
    }
  }

  // 触发升阶动画弹跳
  if (newRank > oldRank || COMBO.count === 1) {
    COMBO.pop = 1.45;
    COMBO.flash = 0.35;
    shake = Math.max(shake, 4 + newRank * 1.5);
  }
  COMBO.rankIdx = newRank;
}

// ===== 完美招架 (Parry) & 全局顿帧 (Hit-stop) =====
let HITSTOP = 0; // 全局顿帧倒计时（秒）

// 招架窗口判定：仅限主动出刀普攻 J（受击前 0.12s 按下，或斩击起手 0.12s 内）
function isParryWindow() {
  const byInputTime = (typeof P.lastParryT === 'number') && (T - P.lastParryT <= 0.12) && (T - P.lastParryT >= 0);
  const byStateTime = (P.st === 'atk' || P.st === 'uppercut') && P.t <= 0.12;
  return byInputTime || byStateTime;
}

// 核心招架触发函数
function tryParry(attacker, projectile) {
  if (!isParryWindow()) return false;

  const isChargingMonster = attacker && (attacker.dsh > 0 || attacker.atk === 'charge' || attacker.atk === 'swoop');
  const isHeavyProjectile = projectile && (projectile.unblockable || projectile.tex === 'meteor' || projectile.tex === 'wave_ground' || projectile.tex === 'ch1_guardrail' || projectile.tex === 'ch1_pillar_fall' || projectile.pool || projectile.low || projectile.g);

  if (!isChargingMonster && !isHeavyProjectile) {
    return false;
  }

  P.lastParryT = -999;
  P.inv = Math.max(P.inv, 0.4);

  HITSTOP = 0.3;
  if (typeof CAMERA !== 'undefined') CAMERA.onParry(P.x, P.y);
  if (typeof coopSend === 'function' && typeof COOP !== 'undefined' && COOP.active && COOP.inGame) coopSend('hitstop', { d: 0.3 });   // 联机：全队一起顿帧
  shake = 22;

  if (typeof playParryHit === 'function') playParryHit();

  const sparkX = P.x + P.f * 50, sparkY = P.y - 90;
  FX.push({ type: 'parry_spark', x: sparkX, y: sparkY, t: 0.45, d: 0.45, r: 140, c: '#ffd84a' });
  FX.push({ type: 'boom', x: sparkX, y: sparkY, t: 0.3, d: 0.3, r: 70, c: '#ffffff' });
  DT.push({ x: P.x, y: P.y - 200, s: 'PERFECT PARRY!!', t: 1.2, c: '#ffd84a' });

  if (projectile) {
    const revVx = -projectile.vx * 1.6 || -P.f * 800;
    const revVy = (projectile.vy ? -projectile.vy : 0) * 1.2;
    PJ.push({
      x: projectile.x, y: projectile.y,
      vx: revVx, vy: revVy,
      f: Math.sign(revVx),
      t: 1.5,
      h: {},
      parryReflect: 1,
      dmg: P.atk * 2.5
    });
    FX.push({ type: 'boom', x: projectile.x, y: projectile.y, t: 0.25, d: 0.25, r: 60, c: '#ffd84a' });
  }

  // 找到 for (const e of E) 循环
  for (const e of E) {
    if (e.dead) continue;
    const isTarget = (e === attacker) || (Math.abs(e.x - P.x) < 220 && Math.abs(e.y - P.y) < 170);
    if (isTarget) {
      e.stun = 1.5;
      e.fl = 0.35;
      e.dsh = 0;
      e.wu = 0;
      e.cd = Math.max(e.cd, 2.0);
      e.x += P.f * 40;
      
      // ★ 完美弹反削韧：世界Boss削减8% (约130点)，普通Boss削减25%
      if (e.t === 'boss' && !e.broken && (e.breakImmune || 0) <= 0) {
        const isWb = ST[cur] && ST[cur].wb;
        const parryPct = isWb ? 0.08 : 0.25;
        const parryPoiseDmg = Math.round(e.maxPoise * parryPct);
        e.poise = Math.max(0, e.poise - parryPoiseDmg);
        DT.push({ x: e.x, y: e.y - e.h - 30, s: `POISE CRUSH -${parryPoiseDmg}`, t: 1.2, c: '#00e5ff' });
        if (e.poise <= 0) {
          e.broken = true; e.brokenT = 4.0; e.stun = 4.0;
          DT.push({ x: e.x, y: e.y - e.h - 50, s: '💥 PARRY BREAK!! 击破破绽', t: 2.0, c: '#ffd84a' });
        }
      } else {
        DT.push({ x: e.x, y: e.y - e.h - 10, s: 'STAGGER! 击破硬直', t: 1.2, c: '#ffd84a' });
      }
    }
  }

  const xLeft = Math.min(P.x - 20, P.x + P.f * 260);
  const xRight = Math.max(P.x - 20, P.x + P.f * 260);
  area(xLeft, xRight, P.atk * 2.5);

  return true;
}

let stageT = 0;      // 本关耗时（秒）
let WIN_RES = null;  // 结算数据与动画状态机
let LOSE_RES = null; // 战败结算数据与动效状态
let WB_RES = null;   // 世界BOSS专属结算数据与动画状态

// ===== 战斗系统 =====
function begin(k) {
  BIKES = [];
  stageT = 0;
  WIN_RES = null;
  LOSE_RES = null;
  WB_RES = null;
  // 在 begin(k) 里加入重置连击
  COMBO.count = 0;
  COMBO.timer = 0;
  COMBO.rankIdx = 0;
  COMBO.pop = 1.0;
  COMBO.flash = 0;

  // 在 begin(k) 内部加入：
  if (typeof BOSS_BANNER !== 'undefined') {
    BOSS_BANNER.active = false;
  }
  
  if (typeof clearForms === 'function') clearForms();
  calc();

  if (typeof stopAllRyukiFVSounds === 'function') stopAllRyukiFVSounds();
  if (typeof stopFaizHenshin === 'function') stopFaizHenshin();
  if (typeof stopRyukiHenshin === 'function') stopRyukiHenshin();
  if (typeof stopBladeHenshin === 'function') stopBladeHenshin();
  if (typeof stopDenoHenshin === 'function') stopDenoHenshin();

  const transDur = typeof malayaTransDur === 'function' ? malayaTransDur() : 4.69;
  Object.assign(P, { 
    x: 300, y: GY, vx: 0, vy: 0, f: 1, 
    hp: P.mh, mp: P.mm, 
    st: 'trans', t: 0, tdur: transDur,
    inv: transDur + 0.5, land: 0, h: 0, hit: {}, 
    sta: P.stm, dcd: 0, exh: false, spr: false, down: false, 
    shDown: false, shT: 0, gt: 0, sreg: 0, slow: 0, psn: 0 
  });

  for (const key in P.cd) P.cd[key] = 0;
  P.dcd = 0;

  psHen();
  if (typeof playMalayaHenshin === 'function') playMalayaHenshin();
  if (typeof henshinApply === 'function') henshinApply('malaya');

  GH = []; E = []; PJ = []; EP = []; FX = []; DT = []; OR = []; HZ = []; TQ = [];
  kills = 0; bs = 0; sp = 1; RG = 0; cam = 0; cur = k; G = 'play';
  if (typeof coopResetBattle === 'function') coopResetBattle();

  if (ST[k].wb) { 
    WBT = ST[k].tl; WBD = 0; WBM = 0; WBR = ''; 
  } else { 
    if (!COOP.active || COOP.isHost) {
      spawn('imp'); spawn('imp'); 
    }
  }
}

function fin(w) {
  if (typeof DYNAMIC_BGM !== 'undefined') DYNAMIC_BGM.onGameEnd(w);
  if (G !== 'play') return;
  G = w ? 'win' : 'over'; FD = 0;
  psResult(w);
  const z = ST[cur];

  if (typeof COOP !== 'undefined' && COOP.active && COOP.inGame && COOP.isHost) {
    coopSend('game_end', { win: w ? 1 : 0, kills, RG, RGb: Math.round(COOP.RGb || 0) });
  }

  if (z.tw) {
    towerFin(w, z);
  } else if (z.wb) {
    const i = WB.findIndex(b => b.si === cur);
    const retreat = WBR === 'retreat';
    const totalMaxHp = (typeof wbMaxHp === 'function') ? wbMaxHp(i) : Math.round(ET.boss.hp * z.hm * (z.hpx || 1));
    const curRem = (typeof WB_LOC === 'number' && WB_LOC > 0) ? WB_LOC : totalMaxHp;
    const dmg = retreat ? 0 : Math.max(0, Math.min(WBD | 0, curRem));

    const base = (typeof wbBaseHp === 'function') ? wbBaseHp(i) : Math.round(totalMaxHp / (typeof WB_HP_MUL !== 'undefined' ? WB_HP_MUL : 20));
    const frac = Math.min(1, dmg / base);
    const W = wbData();
    FG = RG + Math.round(z.g * frac);
    if (retreat) {
      W.used = Math.max(0, (W.used | 0) - 1);
    } else {
      W.best[i] = Math.max(W.best[i] || 0, dmg);
    }

    const wbD = Math.round((WB_DIAM[i] || 30) * frac);
    if (wbD > 0) { S.d += wbD; psDia(wbD); }

    const remHp = Math.max(0, curRem - dmg);
    const isKill = remHp <= 0 || w;
    const timeSpent = Math.max(1, Math.round(z.tl - WBT));
    const dmgPct = Math.min(100, Math.round((dmg / totalMaxHp) * 100));
    const rank = (isKill || frac >= 1.0) ? 'S' : frac >= 0.7 ? 'A' : frac >= 0.4 ? 'B' : 'C';

    WB_RES = {
      t: 0, dur: 1.5, win: w || isKill,
      reason: (w || isKill) ? 'win' : (WBR || 'defeat'),
      bossName: z.bn || '世界首领',
      damage: dmg,
      maxHp: totalMaxHp,
      bossMax: totalMaxHp,
      rem: remHp,
      dmgPct,
      rank,
      gold: FG,
      diam: wbD,
      timeSpent,
      totalLimit: z.tl,
      isKill: isKill,
      leftTries: wbLeft(),
      bestDmg: W.best[i] || dmg,
      pending: !retreat && dmg > 0,
      err: '', msg: '', ask: 0, top: []
    };

    if (!retreat && dmg > 0) {
      if (typeof WBG !== 'undefined' && WBG.s && WBG.s[i]) {
        WBG.s[i].hp = remHp;
        if (isKill) WBG.s[i].lastKiller = S.nick || '你';
      }
      WB_LOC = remHp;
    }

    if (WB_RES.pending && typeof wbCommit === 'function') {
      wbCommit(i, dmg, WB_RES);
    }
  } else {
    FG = w ? RG + z.g : RG >> 1;
    if (w) {
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

      const ci = z.coop ? (z.coopIdx | 0) : -1;
      if (isFirst) {
        FD = z.coop ? (COOP_FIRST_DIAM[ci] || FIRST_CLEAR_DIAMOND) : FIRST_CLEAR_DIAMOND;
        S.d += FD; psDia(FD);
      } else {
        FD = 0;
      }
      let cShard = 0, cMat = 0, cScr = 0;
      if (z.coop) {
        cShard = COOP_SHARD[ci] || 1; cMat = COOP_MAT[ci] || 8; cScr = COOP_SCR[ci] || 1;
        S.csh = (S.csh | 0) + cShard; S.mat += cMat; S.scr = (S.scr || 0) + cScr;
      }
      if (stars > prevStars) S.stars[cur] = stars;

      const expGain = Math.round((z.r * 30 + 50) * (z.coop ? 5 : 1) * (1 + affixTotal('xp')));
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
      const aliveKills = Math.min(kills, z.k);
      const killPercent = z.k > 0 ? Math.floor((aliveKills / z.k) * 100) : 0;
      LOSE_RES = {
        t: 0, dur: 1.5, stageName: z.n,
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

function gain(n, raw) {
  S.xp += (raw ? n : n * (1 + affixTotal('xp'))) | 0;
  let leveled = false;
  const oldLv = S.lv;
  while (S.xp >= xpNeed(S.lv)) {
    S.xp -= xpNeed(S.lv); S.lv++; S.tp++;
    leveled = true;
  }
  if (leveled) {
    calc();
    LV_POP = { t: 0, dur: 3.0, lv: S.lv, dLv: S.lv - oldLv };
    shake = Math.max(shake, 14);
    FX.push({ type: 'boom', x: P.x, y: P.y - 100, t: .5, d: .5, r: 240, c: '#ffd84a' });
  }
}

function dropLoot(e) {
  const isBoss = e.t === 'boss';
  const z = ST[cur];
  const isCoop = !!(z && z.coop);

  let scr = 0;
  if (isBoss) scr = (2 + (Math.random() * 3 | 0)) * (isCoop ? 5 : 1) + (z.wb ? 3 : 0);
  else if (Math.random() < (e.t === 'wd' ? 0.14 : 0.05) * (isCoop ? 2.5 : 1)) scr = isCoop ? 3 : 1;

  if (scr) {
    S.scr = (S.scr || 0) + scr; save();
    DT.push({ x: e.x, y: e.y - e.h - 65, s: '📜强化卷轴 ×' + scr, t: 2.2, c: '#ffa502' });
  }

  const dropRate = isCoop 
    ? (isBoss ? 1.0 : (e.t === 'wd' ? 0.35 : 0.15)) 
    : (isBoss ? 0.6 : (e.t === 'wd' ? 0.10 : 0.04));
  if (Math.random() > dropRate) return;

  let tr = 0;
  const r = Math.random();
  if (isCoop) {
    if (isBoss) tr = r < 0.25 ? 5 : r < 0.75 ? 4 : 3;
    else if (e.t === 'wd') tr = r < 0.12 ? 4 : r < 0.55 ? 3 : 2;
    else tr = r < 0.25 ? 3 : r < 0.65 ? 2 : 1;
  } else {
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

function hurt(e, d, pre) {
  const mp2 = typeof COOP !== 'undefined' && COOP.active && COOP.inGame;
  const guest = mp2 && !COOP.isHost;
  let c, f = P.f;

  // 1. 破防状态下享受 150% 易伤
  if (e.broken) {
    d = Math.round(d * 1.5);
  }

  if (pre) { 
    c = !!pre.c; f = pre.f || 1; 
  } else { 
    c = Math.random() < P.cr; 
    d = Math.round(d * (.9 + Math.random() * .2) * (c ? 2 : 1)); 
  }

  // 2. 领主削韧逻辑 (带 0.06s 内置CD与霸体保护)
  if (e.t === 'boss' && !e.dead && !guest) {
    e.poiseDelay = 3.5;

    if (!e.broken && (e.breakImmune || 0) <= 0) {
      if (!e.pIcd || e.pIcd <= 0) {
        e.pIcd = 0.06; // 限制高频判定瞬秒韧性

        let pDmg = 12;
        if (P.st === 'uppercut') pDmg = 30;
        else if (P.st === 'diveslam') pDmg = 50;
        else if (P.st === 'fv') pDmg = 80;
        else if (P.st === 'thr') pDmg = 25;

        e.poise = Math.max(0, e.poise - pDmg);

        if (e.poise <= 0) {
          e.broken = true;
          e.brokenT = 4.0;
          e.stun = 4.0;
          e.dsh = 0; e.wu = 0;
          shake = 24;
          if (typeof playParryHit === 'function') playParryHit();
          FX.push({ type: 'boom', x: e.x, y: e.y - e.h / 2, t: 0.6, d: 0.6, r: 240, c: '#ffffff' });
          DT.push({ x: e.x, y: e.y - e.h - 50, s: '💥 SHIELD BREAK!! 破防瘫痪', t: 2.0, c: '#ffffff' });
          DT.push({ x: e.x, y: e.y - e.h - 25, s: '✦ 150% 易伤状态 ✦', t: 1.8, c: '#ff4757' });
        }
      }
    }
  }

  if (guest) {
    if (e.dead) return;
    psHit(d, c);
    e.fl = .12; shake = Math.max(shake, 4);
    P.mp = Math.min(P.mm, P.mp + 3);
    if (!P.down) { 
      const ls = affixTotal('ls'); 
      if (ls > 0) P.hp = Math.min(P.mh, P.hp + Math.min(P.mh * .03, Math.max(1, d * ls))); 
    }
    DT.push({ x: e.x, y: e.y - e.h, s: d + (c ? '!' : ''), t: .8, c: c ? '#ff8a2a' : '#ffd84a' });
    coopSend('guest_hurt_m', { id: e.id, dmg: d, c: c ? 1 : 0, f });
    return;
  }

  if (e.t === 'boss' && ST[cur].wb) WBD += Math.max(0, Math.min(d, e.hp));
  if (!pre) psHit(d, c);
  if (!pre && !P.down) { 
    const ls = affixTotal('ls'); 
    if (ls > 0) P.hp = Math.min(P.mh, P.hp + Math.min(P.mh * .03, Math.max(1, d * ls))); 
  }
  e.hp -= d; e.fl = .12; e.x += f * (e.t === 'boss' ? 2 : 12);
  if (!pre) P.mp = Math.min(P.mm, P.mp + 3);

  // ★★★ 核心：只有普攻/空中连段真正命中怪物时，才播放打击音效（60ms 节流防一刀砍多怪声音爆鸣） ★★★
  if (!pre && /^(atk|uppercut|diveslam|air_atk)$/.test(P.st)) {
    const nowMs = performance.now();
    if (nowMs - (P._lastHitSndT || 0) > 60) {
      P._lastHitSndT = nowMs;
      if (typeof playSwordHit === 'function') playSwordHit();
    }
  }

  DT.push({ x: e.x, y: e.y - e.h, s: d + (c ? '!' : ''), t: .8, c: c ? '#ff8a2a' : '#ffd84a' });
  shake = Math.max(shake, 4);

  // ★ 加入连击累加与额外回蓝收益
  if (!pre) {
    addComboHit();
    const curRankObj = STYLE_RANKS[COMBO.rankIdx];
    // 原有每次击中回蓝 3 点，评价越高回蓝加成越多
    P.mp = Math.min(P.mm, P.mp + 3 + (curRankObj ? curRankObj.mpAdd : 0));
  }

  if (mp2) coopSend('m_hurt_ack', { id: e.id, hp: e.hp, dmg: d, c: c ? 1 : 0, dead: e.hp <= 0, g: pre ? 1 : 0 });

  if (e.hp <= 0 && !e.dead) {
    e.dead = 1; kills++; if (!pre) psKill(e.t === 'boss');
    gain(ET[e.t].xp * .6 * (1 + Math.min(cur, 29) * .3)); 
    const gBase = ET[e.t].g * (1 + Math.min(cur, 29) * .3);
    RG += gBase * (1 + affixTotal('gd')) | 0;
    if (mp2) COOP.RGb += gBase;
    if (Math.random() < .35) OR.push({ x: e.x, k: Math.random() < .5 ? 'h' : 'm' });
    dropLoot(e);
    if (e.t === 'boss') {
      if (typeof CAMERA !== 'undefined') CAMERA.triggerMangaKill(e);
      fin(1);
    }
    if (e.t === 'boss') fin(1);
    FX.push({ type: 'boss_death_blast', x: e.x, y: e.y - e.h / 2, t: .6, d: .6, r: e.t === 'boss' ? 220 : 70 });
  }
}

function area(x0, x1, dmg, set) {
  for (const e of E) {
    if (e.dead) continue;
    const w = e.w / 2;
    if (e.x + w > x0 && e.x - w < x1 && e.y > P.y - 160 && e.y - e.h < P.y && (!set || !set[e.id])) {
      if (set) set[e.id] = 1;
      hurt(e, dmg);
    }
  }
}

// ===== 普攻斩断 / 抵消敌方投射物 =====
function cancelEP(x0, x1) {
  const yMin = P.y - 170, yMax = P.y + 10;
  for (const p of EP) {
    if (p.t <= 0) continue;
    if (p.unblockable || p.pool || p.g || p.low || p.tex === 'meteor' || p.tex === 'wave_ground' || p.tex === 'ch1_guardrail' || p.tex === 'ch1_pillar_fall') {
      continue;
    }
    if (p.x >= x0 - 30 && p.x <= x1 + 30 && p.y >= yMin && p.y <= yMax) {
      p.t = 0;
      playSwordHit();
      shake = Math.max(shake, 4);
      FX.push({ type: 'boom', x: p.x, y: p.y, t: .2, d: .2, r: 40, c: '#00e5ff' });
      DT.push({ x: p.x, y: p.y - 25, s: '抵消!', t: .5, c: '#7df9ff' });
    }
  }
}

function hurtP(d, attacker, projectile) {
  if (P.down || P.st === 'trans' || P.st === 'trans_ryuki' || G !== 'play') return;

  // ★★★ 核心修复：升龙击 (uppercut) 与空中普攻 (air_atk) 期间，肉身撞击怪物（非投射物）完全免疫伤害 ★★★
  if ((P.st === 'uppercut' || P.st === 'air_atk') && attacker && !projectile) return;

  if (tryParry(attacker, projectile)) return;
  if (P.inv > 0) return;

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
    if (typeof coopBattleOn === 'function' && coopBattleOn()) coopOnDown(); else fin(0);
  }
}

function spawn(t, ox, vi) {
  const o = ET[t], z = ST[cur];
  const pool = (ENS[z.set] && ENS[z.set][t] && ENS[z.set][t].length) ? ENS[z.set][t] : EN[t];
  const vi2 = (vi !== undefined && vi >= 0) ? vi % pool.length : (Math.random() * pool.length | 0);
  const c = pool[vi2], s = o.H / c.height, side = Math.random() < .5 ? -1 : 1;

  const isCoop = !!z.coop;
  const hpMul = isCoop ? 5.0 : (t === 'boss' && z.hpx ? z.hpx : 1);
  const dmMul = 1.0;

  const hpFull = Math.max(1, Math.round(o.hp * z.hm * hpMul));
  const hp = (t === 'boss' && z.wb && WB_LOC > 0) ? Math.min(hpFull, Math.round(WB_LOC)) : hpFull;
  const dm = Math.max(1, Math.round(o.dm * z.dm * dmMul));

  let x = ox !== undefined ? ox : P.x + side * (520 + Math.random() * 150);
  if (ox === undefined && (x < 60 || x > WW - 60)) x = P.x - side * 600;

  // ★ Boss 韧性池平衡：世界Boss设为 1600 点，普通关卡Boss设为 360~600 点
  const maxPoise = t === 'boss' ? (z.wb ? 1600 : (360 + Math.min(cur, 20) * 12)) : 0;

  E.push({ 
    id: ++uid, t, im: c, vi: vi2, x: cl(x, 60, WW - 60), y: t === 'imp' ? 300 : GY, 
    hp, mhp: (t === 'boss' && z.wb) ? hpFull : hp, dm, h: o.H, w: c.width * s, s, fl: 0,
    cd: t === 'boss' ? 2 : 1.5 + Math.random() * 2, hc: 0, fc: 1, wu: 0, dsh: 0, atk: '', last: '',
    stun: 0,
    // 领主专属韧性系统
    poise: maxPoise,
    maxPoise: maxPoise,
    broken: false,
    brokenT: 0,
    poiseDelay: 0,
    pIcd: 0,
    breakImmune: 0
  });

  // ★ 领主登场：自动触发专属立绘机械横幅与 0.4s 微定格
  if (t === 'boss' && typeof triggerBossBanner === 'function') {
    triggerBossBanner(E[E.length - 1]);
  }

  if (t === 'boss' && z.wb) WBM = hpFull;
}

// =====================================================================
//  怪物招式与独立攻击系统
// =====================================================================
const BCOL = { 1: '#7dff5a', 2: '#ff3a10', 3: '#5352ed', 4: '#70a1ff', 5: '#2ed573', 6: '#ffa502', 7: '#a55eea', 8: '#ffd32a', 9: '#ff6348', 10: '#ff3838' };
const MCOL = { 1: '#4cd0ff', 2: '#ff9a00', 3: '#a29bfe', 4: '#74b9ff', 5: '#55efc4', 6: '#ffeaa7', 7: '#d6a2e8', 8: '#fff200', 9: '#ff7675', 10: '#ff4757' };

// ★ 每章·每种怪独立的特效主色（imp=飞行小怪 wd=精英 boss=首领）；没写的章节自动回退到上面的 BCOL / MCOL
const ECOL_T = {
  2: { imp: '#ff9a2e', wd: '#ff6a1a', boss: '#ff3a10' },   // 熔岩炎蝠=琥珀橙 · 黑曜熔喉兽=熔岩橙红 · 炎狱魔尊=炎红
  1: { imp: '#3dffb4', wd: '#ff9a3c', boss: '#ff3b30' }   // 翡翠晶龙=翡翠绿 · 碎岩兽=熔橙 · 红绿灯机神=警报红
};
const ecol = e => {
  const s = ST[cur].set, t = ECOL_T[s];
  if (t && t[e.t]) return t[e.t];
  return e.t === 'boss' ? (BCOL[s] || '#ff3a10') : (MCOL[s] || '#4cd0ff');
};
const edm = (e, m = 1) => Math.max(1, Math.round((e.t === 'boss' ? 14 : e.t === 'wd' ? 9 : 6) * ST[cur].dm * m));
const aimA = e => Math.atan2(P.y - 90 - (e.y - e.h * .6), P.x - e.x);
const eSpd = e => (e.t === 'boss' ? 300 : 260) + ST[cur].set * 8;
const later = (t, f) => TQ.push({ t, f });

function ep(e, a, v, o) {
  const s = ST[cur].set;
  EP.push(Object.assign({
    x: e.x + e.fc * e.w * .4, y: e.y - e.h * .6, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
    dm: edm(e), c: ecol(e), t: 4, r: 10, slow: s === 4, psn: s === 5, a: 0,
    tex: 'energy'
  }, o || {}));
}

function zoneCol(e, x, o) {
  o = o || {};
  HZ.push({ k: 'col', x: cl(x, 40, WW - 40), y: GY, w: o.w || 50, delay: o.delay || .85, dur: .35, t: 0, dm: edm(e, 1.25), c: ecol(e) });
}
function zoneBlast(e, x, w, delay, m) {
  HZ.push({ k: 'blast', x: cl(x, 40, WW - 40), y: GY, w, delay, dur: .3, t: 0, dm: edm(e, m), c: ecol(e) });
}

// 独立的抛物线碎石投掷（精英怪）
function lobShot(e, pool, off, o) {
  const isCh1 = ST[cur] && ST[cur].set === 1;
  const x0 = e.x + e.fc * e.w * 0.4, y0 = e.y - e.h * 0.6, g = 900, T2 = 0.95 + Math.abs(P.x - e.x) / 1600;
  const tx = P.x + (off || 0), ty = GY - 14;
  ep(e, 0, 0, Object.assign({
    x: x0, y: y0, vx: (tx - x0) / T2, vy: ((ty - y0) - 0.5 * g * T2 * T2) / T2,
    g, gy: ty, pool, t: 3, r: isCh1 ? 24 : 16, dm: edm(e, 1.2),
    tex: isCh1 ? 'ch1_rubble' : (pool ? 'poison' : 'lob'),
    unblockable: true
  }, o || {}));
}

// 怪物完整招式表（已彻底去除语法占位符）
const ATKS = {
  // ★ 1. 绿晶幼龙专属：翡翠晶簇连射
  ch1_crystal_shot: {
    n: '翡翠晶簇连射', wu: 0.4,
    f(e) {
      for (let i = 0; i < 3; i++) {
        later(i * 0.12, () => {
          if (e.dead) return;
          ep(e, aimA(e) + (Math.random() - 0.5) * 0.1, eSpd(e) * 1.15, {
            tex: 'ch1_crystal',
            r: 16,
            c: '#00e5ff',
            dm: edm(e, 0.75)
          });
        });
      }
    }
  },

  // ★ 2. 废墟骨角兽专属：巨型混凝土石块投掷
  ch1_rubble_lob: {
    n: '瓦砾投掷', wu: 0.55,
    f(e) {
      lobShot(e, false, 0);
      DT.push({ x: e.x, y: e.y - e.h - 15, s: 'CRUSH BOULDER!', t: 0.8, c: '#ff9f43' });
    }
  },

  // ★ 3. 废墟骨角兽专属：地面撕裂沥青突刺
  ch1_road_fissure: {
    n: '沥青地层撕裂', wu: 0.5,
    f(e) {
      for (let i = 0; i < 2; i++) {
        later(i * 0.25, () => {
          if (e.dead) return;
          EP.push({
            x: e.x + e.fc * e.w * 0.4, y: GY - 18,
            vx: e.fc * (360 + i * 80), vy: 0,
            low: 1, dm: edm(e, 1.2), c: '#334455', t: 2.6, r: 24, a: 0,
            tex: 'wave_ground',
            unblockable: true
          });
          shake = Math.max(shake, 8);
        });
      }
    }
  },

  // ★ 4. 断桥机神Boss专属：重砸桥面·推射高速防撞护栏
  ch1_bridge_slam: {
    n: '崩桥·飞旋护栏', wu: 0.65,
    f(e) {
      shake = 22;
      FX.push({ type: 'boom', x: e.x, y: GY - 10, t: 0.5, d: 0.5, r: 160, c: '#ffd84a' });
      [-1, 1].forEach(dir => {
        EP.push({
          x: e.x + dir * e.w * 0.4, y: GY - 20,
          vx: dir * 460, vy: 0,
          low: 1, dm: edm(e, 1.4), c: '#cfd8e3', t: 2.5, r: 35, a: 0,
          tex: 'ch1_guardrail',
          unblockable: true
        });
      });
      DT.push({ x: e.x, y: GY - 140, s: 'GUARDRAIL CRASH!', t: 1.0, c: '#ffd84a' });
    }
  },

  // ★ 5. 断桥机神Boss专属：高架桥大塌方·巨型水泥桥柱轰落
  ch1_pillar_rain: {
    n: '高架桥塌方', wu: 0.55,
    f(e) {
      const count = 5;
      for (let i = 0; i < count; i++) {
        later(i * 0.22, () => {
          if (e.dead) return;
          const dropX = cl(P.x + (i - 2) * 160 + (Math.random() - 0.5) * 60, 40, WW - 40);
          zoneBlast(e, dropX, 90, 0.75, 1.5);
          EP.push({
            x: dropX, y: -80,
            vx: 0, vy: 520, dm: edm(e, 1.5), c: '#a0a0a0',
            t: 3, r: 32, a: 0,
            tex: 'ch1_pillar_fall',
            unblockable: true
          });
        });
      }
    }
  },

  // ★ 6. 断桥机神Boss专属：交通红外警报高能死光
  ch1_traffic_laser: {
    n: '红外警戒死光', wu: 0.6,
    f(e) {
      HZ.push({
        k: 'beam', x: e.x, y: GY - 80, hh: 26,
        dir: e.fc, len: 1200, delay: 0.85, dur: 0.7,
        tick: 0.15, tk: 0, t: 0, dm: edm(e, 0.8), c: '#ff3838', tex: 'ch1_laser'
      });
      DT.push({ x: e.x, y: e.y - e.h - 30, s: 'RED ALERT BEAM!', t: 1.2, c: '#ff3838' });
    }
  },

  // ★ 晶龙：晶翼扇射——振翅一次，五枚晶刺呈扇形散开
  ch1_shard_fan: {
    n: '晶翼扇射', wu: 0.45,
    f(e) {
      const a0 = aimA(e);
      for (let i = 0; i < 5; i++) {
        ep(e, a0 + (i - 2) * 0.2, eSpd(e) * 0.95, { tex: 'ch1_crystal', r: 15, c: '#3dffb4', dm: edm(e, 0.6) });
      }
      FX.push({ type: 'boom', x: e.x, y: e.y - e.h * 0.5, t: 0.3, d: 0.3, r: 55, c: '#3dffb4' });
    }
  },

  // ★ 碎岩兽：树根地刺——背上的枯根钻入地下，沿地面一路朝你顶出（可跳跃躲避）
  ch1_root_spike: {
    n: '碎岩地根突刺', wu: 0.6,
    f(e) {
      const dir = P.x < e.x ? -1 : 1;
      for (let i = 0; i < 5; i++) {
        later(i * 0.12, () => {
          if (e.dead) return;
          HZ.push({ k: 'blast', x: cl(e.x + dir * (120 + i * 105), 40, WW - 40), y: GY, w: 46,
                    delay: 0.55, dur: 0.35, t: 0, dm: edm(e, 1.25), c: '#b5722f', tex: 'ch1_root', up: 1 });
        });
      }
      shake = Math.max(shake, 6);
      DT.push({ x: e.x, y: e.y - e.h - 15, s: 'ROOT SPIKES!', t: 0.8, c: '#ff9a3c' });
    }
  },

  // ★ 机神：工字钢投掷——拆下肩上的钢梁，三连抛物线砸落
  ch1_girder_throw: {
    n: '工字钢投掷', wu: 0.55,
    f(e) {
      [-170, 0, 170].forEach((o, i) => later(i * 0.2, () => {
        if (e.dead) return;
        lobShot(e, false, o, { tex: 'ch1_girder', r: 30, c: '#ffd84a', dm: edm(e, 1.3) });
      }));
      DT.push({ x: e.x, y: e.y - e.h - 15, s: 'STEEL GIRDER!', t: 0.9, c: '#ffd84a' });
    }
  },

  // ★ 机神招牌：红黄绿信号连击（红灯死光 → 黄灯环形光球 → 绿灯冲锋）
  ch1_signal_cycle: {
    n: '红黄绿·信号连击', wu: 0.8,
    f(e) {
      const rage = !!e.rg;
      later(0.02, () => { e.cd = Math.max(e.cd, 3.4); });   // 连击期间不插入别的招式
      // 红灯：死光
      DT.push({ x: e.x, y: e.y - e.h - 30, s: '红灯·停！', t: 0.9, c: '#ff3b30' });
      HZ.push({ k: 'beam', x: e.x, y: GY - 80, hh: 24, dir: e.fc, len: 1100, delay: 0.7, dur: 0.45,
                tick: 0.15, tk: 0, t: 0, dm: edm(e, 0.8), c: '#ff3b30', tex: 'ch1_laser' });
      // 黄灯：环形琥珀光球
      later(1.0, () => {
        if (e.dead || e.stun > 0) return;
        DT.push({ x: e.x, y: e.y - e.h - 30, s: '黄灯·躲！', t: 0.9, c: '#ffc400' });
        const n = rage ? 14 : 10, r0 = Math.random() * 6;
        for (let i = 0; i < n; i++) ep(e, r0 + i * Math.PI * 2 / n, 210,
          { x: e.x, y: e.y - e.h * 0.55, tex: 'ch1_signal_orb', c: '#ffc400', r: 14, dm: edm(e, 0.8) });
        FX.push({ type: 'boom', x: e.x, y: e.y - e.h * 0.55, t: 0.4, d: 0.4, r: 90, c: '#ffc400' });
      });
      // 绿灯：冲锋
      later(1.8, () => {
        if (e.dead || e.stun > 0) return;
        DT.push({ x: e.x, y: e.y - e.h - 30, s: '绿灯·冲！', t: 0.9, c: '#3dff7a' });
        e.fc = P.x < e.x ? -1 : 1;
        e.dsh = 0.75; e.dvx = e.fc * 560; e.dvy = 0; e.hc = 0;
      });
    }
  },

  // ================= 第二章·烈焰焦土 专属招式 =================
  // ★ 熔岩炎蝠：炎羽连射——四枚炎羽先后射出，每一枚都重新瞄准
  ch2_ember_feather: {
    n: '炎羽连射', wu: 0.4,
    f(e) {
      for (let i = 0; i < 4; i++) later(i * 0.13, () => {
        if (e.dead) return;
        ep(e, aimA(e) + (Math.random() - .5) * .08, eSpd(e) * .95, { tex: 'ch2_ember', r: 13, c: '#ff9a2e', dm: edm(e, .7) });
      });
      FX.push({ type: 'boom', x: e.x, y: e.y - e.h * 0.5, t: 0.3, d: 0.3, r: 50, c: '#ff9a2e' });
    }
  },
  // ★ 熔岩炎蝠：坠火炎弹——飞过头顶丢下两枚火球，落地烧出一小片火池
  ch2_ember_bomb: {
    n: '坠火炎弹', wu: 0.5,
    f(e) {
      [-90, 90].forEach((o, i) => later(i * 0.2, () => {
        if (e.dead) return;
        lobShot(e, true, o, { tex: 'ch2_ember_bomb', ptex: 'ch2_fire_pool', fire: 1, r: 15, pw: 60, pdur: 3.2, c: '#ff7a1a', dm: edm(e, .9) });
      }));
    }
  },
  // ★ 黑曜熔喉兽：熔岩吐息——背上熔囊鼓起，三团岩浆球抛出，落地变成岩浆池
  ch2_magma_spit: {
    n: '熔岩吐息', wu: 0.6,
    f(e) {
      [-120, 0, 120].forEach((o, i) => later(i * 0.16, () => {
        if (e.dead) return;
        lobShot(e, true, o, { tex: 'ch2_magma_ball', ptex: 'ch2_lava_pool', fire: 1, r: 22, pw: 85, pdur: 3.6, c: '#ff5a1a', dm: edm(e, 1.1) });
      }));
      DT.push({ x: e.x, y: e.y - e.h - 15, s: 'MAGMA SPIT!', t: 0.8, c: '#ff7a1a' });
    }
  },
  // ★ 黑曜熔喉兽：岩浆喷泉——地下岩浆连续五次顶出，每次都盯着你当时的位置
  ch2_lava_geyser: {
    n: '岩浆喷泉', wu: 0.55,
    f(e) {
      for (let i = 0; i < 5; i++) later(i * 0.28, () => {
        if (e.dead) return;
        const x = cl(P.x + (i === 0 ? 0 : (Math.random() - .5) * 160), 40, WW - 40);
        HZ.push({ k: 'blast', x, y: GY, w: 52, delay: 0.75, dur: 0.4, t: 0, dm: edm(e, 1.3), c: '#ff6a1a', tex: 'ch2_geyser', up: 1, fire: 1 });
      });
      shake = Math.max(shake, 6);
      DT.push({ x: e.x, y: e.y - e.h - 15, s: 'LAVA GEYSER!', t: 0.8, c: '#ff7a1a' });
    }
  },
  // ★ 黑曜熔喉兽：熔囊爆裂——熔囊炸开，六团火星抛向你周围，落地即炸
  ch2_sac_burst: {
    n: '熔囊爆裂', wu: 0.6,
    f(e) {
      FX.push({ type: 'boom', x: e.x, y: e.y - e.h * .8, t: .35, d: .35, r: 80, c: '#ffb02e' });
      for (let i = 0; i < 6; i++) later(i * 0.1, () => {
        if (e.dead) return;
        const x0 = e.x + e.fc * e.w * (i % 2 ? .19 : -.03), y0 = e.y - e.h * .8, g = 900, T2 = 1.1 + Math.random() * .4;
        const tx = cl(P.x + (Math.random() - .5) * 520, 40, WW - 40), ty = GY - 14;
        ep(e, 0, 0, { x: x0, y: y0, vx: (tx - x0) / T2, vy: ((ty - y0) - .5 * g * T2 * T2) / T2, g, gy: ty, t: 3, r: 14, dm: edm(e, 1), tex: 'ch2_ember_bomb', c: '#ff9a2e', unblockable: true });
      });
    }
  },
  // ★ 炎狱魔尊：炎狱斩——先贴地一道火刃（要跳），再接一道胸口高度的火刃（要闪避/招架）
  ch2_hellfire_slash: {
    n: '炎狱斩', wu: 0.65,
    f(e) {
      const dir = e.fc;
      shake = Math.max(shake, 10);
      EP.push({ x: e.x + dir * e.w * .45, y: GY - 30, vx: dir * 540, vy: 0, low: 1, dm: edm(e, 1.35), c: '#ff6a1a', t: 2.2, r: 34, a: 0, tex: 'ch2_fire_slash', unblockable: true });
      later(0.5, () => {
        if (e.dead) return;
        shake = Math.max(shake, 8);
        EP.push({ x: e.x + dir * e.w * .45, y: GY - 110, vx: dir * 480, vy: 0, dm: edm(e, 1.2), c: '#ffb02e', t: 2.4, r: 30, a: 0, tex: 'ch2_fire_slash', unblockable: true });
      });
      DT.push({ x: e.x, y: e.y - e.h - 30, s: 'HELLFIRE SLASH!', t: 1.0, c: '#ff6a1a' });
    }
  },
  // ★ 炎狱魔尊：炎翼风暴——双翼一振，两轮炎羽扇形扫出
  ch2_flame_wing: {
    n: '炎翼风暴', wu: 0.7,
    f(e) {
      const n = e.rg ? 9 : 7, a0 = aimA(e);
      for (let i = 0; i < n; i++) ep(e, a0 + (i - (n - 1) / 2) * .2, eSpd(e) * 1.05, { tex: 'ch2_ember', r: 14, c: '#ff9a2e', x: e.x, y: e.y - e.h * .65, dm: edm(e, .8) });
      later(0.35, () => {
        if (e.dead) return;
        const a1 = aimA(e);
        for (let i = 0; i < n - 1; i++) ep(e, a1 + (i - (n - 2) / 2) * .2, eSpd(e) * 1.05, { tex: 'ch2_ember', r: 14, c: '#ffb02e', x: e.x, y: e.y - e.h * .65, dm: edm(e, .8) });
      });
      FX.push({ type: 'boom', x: e.x, y: e.y - e.h * .6, t: .45, d: .45, r: 130, c: '#ff6a1a' });
      shake = Math.max(shake, 8);
    }
  },
  // ★ 炎狱魔尊：炼狱锁链鞭——两手的锁链同时向左右抽出（要跳起来）
  ch2_chain_lash: {
    n: '炼狱锁链鞭', wu: 0.6,
    f(e) {
      [-1, 1].forEach(dir => HZ.push({ k: 'beam', x: e.x, y: GY - 48, hh: 16, dir, len: 520, delay: 0.7, dur: 0.3, tick: 0.1, tk: 0, t: 0, dm: edm(e, .9), c: '#ff6a1a', tex: 'ch2_chain' }));
      DT.push({ x: e.x, y: e.y - e.h - 30, s: 'CHAIN LASH!', t: 1.0, c: '#ff9a2e' });
    }
  },
  // ★ 炎狱魔尊：熔岩天降——斜着砸下的熔岩陨块，落点先出预警圈
  ch2_meteor_rain: {
    n: '熔岩天降', wu: 0.6,
    f(e) {
      const n = e.rg ? 8 : 6;
      for (let i = 0; i < n; i++) later(i * 0.2, () => {
        if (e.dead) return;
        const dropX = cl(P.x + (Math.random() - .5) * 620, 40, WW - 40);
        zoneBlast(e, dropX, 85, 0.85, 1.4);
        EP.push({ x: dropX + 102, y: -90, vx: -120, vy: 670, dm: edm(e, 1.2), c: '#ff6a1a', t: 3, r: 32, a: 0, tex: 'ch2_lava_meteor', unblockable: true });
      });
    }
  },
  // ★ 炎狱魔尊：狱火喷柱——火柱从他脚下出发，一根接一根朝你推进
  ch2_hellfire_pillars: {
    n: '狱火喷柱', wu: 0.7,
    f(e) {
      const dir = P.x < e.x ? -1 : 1, n = e.rg ? 7 : 5;
      for (let i = 0; i < n; i++) later(i * 0.17, () => {
        if (e.dead) return;
        HZ.push({ k: 'col', x: cl(e.x + dir * (140 + i * 140), 40, WW - 40), y: GY, w: 48, delay: 0.8, dur: 0.35, t: 0, dm: edm(e, 1.3), c: '#ff5a1a', tex: 'ch2_fire_pillar' });
      });
    }
  },

  // 常规通用技能库
  aim:    { n: '瞄准射击', wu: .35, f(e) { ep(e, aimA(e), eSpd(e) * .9, { tex: 'energy' }); } },
  fan:    { n: '扇形齐射', wu: .45, f(e) { const n = e.t === 'boss' ? 5 : 3, a0 = aimA(e); for (let i = 0; i < n; i++) ep(e, a0 + (i - (n - 1) / 2) * .24, eSpd(e), { tex: 'energy' }); } },
  burst:  { n: '连发扫射', wu: .4, f(e) {
    const n = e.t === 'boss' ? 8 : 4;
    for (let i = 0; i < n; i++) later(i * .13, () => { if (!e.dead) ep(e, aimA(e) + (Math.random() - .5) * .12, eSpd(e) * 1.25, { dm: edm(e, .7), tex: 'energy' }); });
  } },
  ring:   { n: '环形爆裂', wu: .55, f(e) {
    const n = e.t === 'boss' ? 14 : 8, r0 = Math.random() * 6;
    for (let i = 0; i < n; i++) ep(e, r0 + i * Math.PI * 2 / n, 200, { x: e.x, y: e.y - e.h * .5, tex: 'energy' });
    FX.push({ type: 'boom', x: e.x, y: e.y - e.h * .5, t: .4, d: .4, r: 90, c: ecol(e) });
  } },
  lob:    { n: '抛物重炮', wu: .5, f(e) {
    if (e.t === 'boss') [-150, 0, 150].forEach((o, i) => later(i * .18, () => { if (!e.dead) lobShot(e, false, o); }));
    else lobShot(e, false, 0);
  } },
  lobPool:{ n: '腐蚀投弹', wu: .5, f(e) {
    if (e.t === 'boss') [-110, 110].forEach((o, i) => later(i * .2, () => { if (!e.dead) lobShot(e, true, o); }));
    else lobShot(e, true, 0);
  } },
  pillar: { n: '天降打击', wu: .5, f(e) { zoneCol(e, P.x); } },
  zap:    { n: '落雷', wu: .45, f(e) { zoneCol(e, P.x, { w: 34, delay: .75 }); } },
  pillars:{ n: '天柱连击', wu: .7, f(e) {
    const px = P.x;
    for (let i = 0; i < 5; i++) later(i * .16, () => { if (!e.dead) zoneCol(e, px + (i - 2) * 130, { delay: .8 }); });
  } },
  rain: { n: '弹幕坠落', wu: .5, f(e) {
    const n = e.t === 'boss' ? 10 : 5, s = ST[cur].set;
    for (let i = 0; i < n; i++) later(i * .16, () => {
      if (e.dead) return;
      EP.push({ 
        x: cl(P.x + (Math.random() - .5) * 760, 30, WW - 30), y: -20, 
        vx: (Math.random() - .5) * 30, vy: 380, dm: edm(e, .9), c: ecol(e), 
        t: 3, r: 15, slow: s === 4, psn: s === 5, a: 0, tex: 'meteor',
        unblockable: true
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
          unblockable: true
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
    for (let i = 0; i < n; i++) later(i * .22, () => { if (!e.dead) zoneBlast(e, px + (i === 0 ? 0 : (Math.random() - .5) * 620), 80, .95, 1.3); });
  } },
  swoop:  { n: '俯冲突袭', wu: .5, f(e) { const t = e.lk || { x: P.x, y: P.y - 70 }; e.dsh = .6; e.dvx = (t.x - e.x) / .4; e.dvy = (t.y - e.y) / .4; e.hc = 0; } },
  charge: { n: '狂暴冲锋', wu: .7, f(e) { e.dsh = .75; e.dvx = e.fc * (520 + ST[cur].set * 15); e.dvy = 0; e.hc = 0; } },
  summon: { n: '召唤魔物', wu: .8, f(e) {
    for (let i = 0; i < 2; i++) if (E.length < 12 && !(typeof coopIsGuest === 'function' && coopIsGuest())) spawn('imp', e.x + (i ? 1 : -1) * 140);
    FX.push({ type: 'boom', x: e.x, y: e.y - e.h * .5, t: .5, d: .5, r: 130, c: ecol(e) });
  } },
  blink:  { n: '瞬影突袭', wu: .35, f(e) {
    FX.push({ type: 'boom', x: e.x, y: e.y - e.h * .5, t: .3, d: .3, r: 60, c: ecol(e) });
    e.x = cl(P.x + (Math.random() < .5 ? -1 : 1) * 280, 60, WW - 60);
    FX.push({ type: 'boom', x: e.x, y: e.y - e.h * .5, t: .3, d: .3, r: 60, c: ecol(e) });
    later(.25, () => { if (!e.dead) { e.fc = P.x < e.x ? -1 : 1; ATKS.fan.f(e); } });
  } }
};

const LOCK_T = .22;

function cdBase(e) {
  const s = ST[cur].set, b = e.t === 'boss' ? 1.9 : e.t === 'wd' ? 3.0 : 3.6;
  return (b + Math.random() * 1.2) * (1 - Math.min(.3, s * .025)) * (e.t === 'boss' && e.hp < e.mhp * .5 ? .7 : 1);
}

function startAtk(e) {
  const s = ST[cur].set, set = ATK_SET[s] || ATK_SET[1], list = set[e.t] || set.wd;
  let name; do { name = list[Math.random() * list.length | 0]; } while (list.length > 1 && name === e.last);
  e.last = e.atk = name; e.wu = ATKS[name].wu; e.lk = null;
  if (e.t === 'boss') DT.push({ x: e.x, y: e.y - e.h - 20, s: THEME[s] + '·' + ATKS[name].n, t: 1.1, c: ecol(e) });
}

function updEnemy(e, dt) {
  if (e.dead) return;

  // 1. 领主破防倒计时、霸体保护与自然回韧
  if (e.t === 'boss') {
    if (e.pIcd > 0) e.pIcd -= dt;
    if (e.breakImmune > 0) e.breakImmune -= dt;

    if (e.broken) {
      e.brokenT -= dt;
      e.stun = Math.max(e.stun, e.brokenT);
      e.fl = (Math.sin(T * 18) > 0) ? 0.2 : 0;

      if (e.brokenT <= 0) {
        e.broken = false;
        e.poise = e.maxPoise;
        e.breakImmune = 3.5; // 重启护盾后提供 3.5 秒霸体保护，避免连环瘫痪
        e.cd = 1.0;
        DT.push({ x: e.x, y: e.y - e.h - 30, s: '🛡️ 护盾重启', t: 1.2, c: '#7df9ff' });
        FX.push({ type: 'boom', x: e.x, y: e.y - e.h / 2, t: 0.3, d: 0.3, r: 120, c: '#7df9ff' });
      }
    } else {
      if (e.poiseDelay > 0) {
        e.poiseDelay -= dt;
      } else if (e.poise < e.maxPoise) {
        e.poise = Math.min(e.maxPoise, e.poise + (e.maxPoise * 0.12) * dt);
      }
    }
  }

  if (e.stun > 0) {
    e.stun -= dt;
    e.fl = Math.max(e.fl, 0.08);
    e.dsh = 0; e.wu = 0;
    return;
  }

  const o = ET[e.t], d = P.x - e.x, ad = Math.abs(d);
  e.fl -= dt; e.cd -= dt; e.hc -= dt;

  if (e.t === 'boss' && !e.rg && e.hp < e.mhp * .5) {
    e.rg = 1; shake = 14; e.cd = Math.min(e.cd, .6);
    DT.push({ x: e.x, y: e.y - e.h - 50, s: 'BOSS 狂暴化！', t: 1.6, c: '#ff3838' });
  }

  if (e.dsh > 0) {
    e.dsh -= dt; e.x = cl(e.x + e.dvx * dt, 40, WW - 40);
    if (e.t === 'imp') e.y += e.dvy * dt;
    if (e.dsh <= 0) e.cd = cdBase(e);
  } else if (e.wu > 0) {
    e.wu -= dt;
    if (e.wu > LOCK_T) { if (ad > 14) e.fc = d < 0 ? -1 : 1; e.lk = null; }
    else if (!e.lk) e.lk = { x: P.x, y: P.y - 70, fc: e.fc };
    if (e.t === 'imp' && e.atk === 'swoop') e.y += (150 - e.y) * Math.min(1, 3 * dt);
    if (e.wu <= 0) { e.wu = 0; ATKS[e.atk].f(e); e.lk = null; if (!(e.dsh > 0)) e.cd = cdBase(e); }
  } else {
    if (ad > 14) e.fc = d < 0 ? -1 : 1;
    if (e.t === 'imp') {
      if (ad > 40) e.x += Math.sign(d) * o.sp * dt * Math.min(1, (ad - 40) / 40);
      e.y += (P.y - 110 + Math.sin(T * 3 + e.id) * 50 - e.y) * Math.min(1, 2 * dt);
    } else {
      const stop = e.t === 'wd' ? 330 : 60;
      if (ad > stop) e.x += Math.sign(d) * o.sp * dt * Math.min(1, (ad - stop) / 40);
      else if (e.t === 'wd' && ad < 250) e.x -= Math.sign(d) * o.sp * dt * Math.min(1, (250 - ad) / 40);

      // ★ 怪物空中下落物理
      if (e.vy !== undefined && (e.y < GY || e.vy < 0)) {
        e.vy += 1600 * dt;
        e.y += e.vy * dt;
        if (e.y >= GY) {
          e.y = GY;
          e.vy = 0;
        }
      } else {
        e.y = e.t === 'wd' ? GY - 30 + Math.sin(T * 2 + e.id) * 15 : GY;
      }
    }
    if (e.cd <= 0 && ad < 720) startAtk(e);
  }

  const isCharging = (e.dsh > 0 || e.atk === 'charge' || e.atk === 'swoop');
  if (Math.abs(P.x - e.x) < e.w / 2 + 25 && e.y > P.y - 150 && e.y - e.h < P.y && e.hc <= 0) {
    // ★ 玩家处于升龙斩与空中攻击时，即使在怪物体内穿行也绝不受撞击伤害
    if (P.st === 'uppercut' || P.st === 'air_atk') return;

    if (P.inv <= 0 || (isCharging && isParryWindow())) {
      e.hc = .8;
      hurtP(e.dm, e, null);
    }
  }
}

function knockupEnemies(x0, x1, dmg, upForce = -650) {
  for (const e of E) {
    if (e.dead) continue;
    const w = e.w / 2;
    if (e.x + w > x0 && e.x - w < x1 && e.y >= P.y - 140 && e.y <= P.y + 20) {
      hurt(e, dmg);
      if (e.t !== 'boss') {
        if (e.vy === undefined) e.vy = 0;
        e.vy = upForce;
        e.y -= 10;
        e.fl = 0.2;
        e.hc = Math.max(e.hc, 1.2); // ★ 击飞期间静默怪兽的身体碰撞伤害
      }
    }
  }
}

function juggleAirEnemies(x0, x1, dmg, liftForce = -220) {
  let hitCount = 0;
  for (const e of E) {
    if (e.dead) continue;
    const w = e.w / 2;
    if (e.x + w > x0 && e.x - w < x1 && Math.abs(e.y - P.y) < 130) {
      hurt(e, dmg);
      if (e.t !== 'boss') {
        if (e.vy === undefined) e.vy = 0;
        e.vy = liftForce;
        e.y = Math.min(e.y, P.y - 5);
        e.fl = 0.2;
        e.hc = Math.max(e.hc, 0.8); // ★ 滞空受击期间静默怪兽的身体碰撞伤害
      }
      hitCount++;
    }
  }
  return hitCount;
}

function slamDownEnemies(x0, x1, dmg) {
  for (const e of E) {
    if (e.dead) continue;
    const w = e.w / 2;
    if (e.x + w > x0 && e.x - w < x1 && Math.abs((e.y - e.h * 0.5) - P.y) < 90) {
      hurt(e, dmg);
      if (e.t !== 'boss') {
        if (e.vy === undefined) e.vy = 0;
        e.vy = 900;
      }
    }
  }
}

function hzHit(h) {
  if (h.k === 'col') return Math.abs(P.x - h.x) < h.w + 20;
  if (h.k === 'blast' || h.k === 'pool') return Math.abs(P.x - h.x) < h.w + 15 && P.y > GY - 70;
  if (h.k === 'beam') { const dx = (P.x - h.x) * h.dir; return dx > -20 && dx < h.len && Math.abs(P.y - 80 - h.y) < h.hh + 40; }
  if (h.k === 'well') return Math.hypot(P.x - h.x, P.y - 80 - h.y) < h.w;
  return false;
}

function updBattleFx(dt) {
  // ★ 连击衰减与动画更新
  if (COMBO.timer > 0) {
    COMBO.timer -= dt;
    if (COMBO.timer <= 0) {
      COMBO.count = 0;
      COMBO.rankIdx = 0;
    }
  }
  if (COMBO.pop > 1.0) COMBO.pop = Math.max(1.0, COMBO.pop - dt * 2.2);
  if (COMBO.flash > 0) COMBO.flash = Math.max(0, COMBO.flash - dt);

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

    if (p.g && p.vy > 0 && p.y >= p.gy) {
      FX.push({ type: 'boom', x: p.x, y: GY - 10, t: .4, d: .4, r: 70, c: p.c });
      HZ.push(p.pool
        ? { k: 'pool', x: p.x, y: GY, w: p.pw || 75, delay: 0, dur: p.pdur || 4.5, tick: .5, tk: 0, t: 0, dm: Math.max(1, p.dm * .45 | 0), c: p.c, tex: p.ptex, fire: p.fire }
        : { k: 'blast', x: p.x, y: GY, w: 55, delay: 0, dur: .2, t: 0, dm: p.dm, c: p.c });
      p.t = 0; continue;
    }
    if (p.y > GY + 20 || p.y < -260 || p.x < -100 || p.x > WW + 100) { p.t = 0; continue; }

    const hit = p.low ? (Math.abs(P.x - p.x) < 34 && P.y > GY - 50) : (Math.hypot(p.x - P.x, p.y - (P.y - 80)) < p.r + 30);
    const isHeavy = (p.unblockable || p.tex === 'meteor' || p.tex === 'wave_ground' || p.tex === 'ch1_guardrail' || p.tex === 'ch1_pillar_fall' || p.pool || p.low || p.g);
    if (hit && (P.inv <= 0 || (isHeavy && isParryWindow()))) {
      hurtP(p.dm, null, p);
      p.t = 0;
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
      if (h.tk <= 0) { h.tk = h.tick; if (hzHit(h)) hurtP(h.dm); }
    } else if (h.k === 'well') {
      const dx = h.x - P.x;
      if (Math.abs(dx) < 420 && P.st !== 'fv') P.x = cl(P.x + Math.sign(dx) * h.pull * dt, 30, WW - 30);
      if (!h.hit && h.t >= h.dur - .05) { h.hit = 1; shake = Math.max(shake, 10); FX.push({ type: 'boom', x: h.x, y: h.y, t: .4, d: .4, r: h.w, c: h.c }); if (hzHit(h)) hurtP(h.dm); }
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
      if (!act) {
        ctx.fillStyle = h.c;
        ctx.globalAlpha = 0.06 + 0.16 * pr;
        ctx.fillRect(x - h.w, 0, h.w * 2, GY);
        
        ctx.strokeStyle = h.c;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 6]);
        ctx.strokeRect(x - h.w, 0, h.w * 2, GY);
        ctx.setLineDash([]);

        const rMax = Math.max(38, h.w * 1.4);
        const rShrink = Math.max(6, rMax * (1 - pr));
        
        ctx.beginPath();
        ctx.ellipse(x, GY + 2, rMax, rMax * 0.32, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 59, 48, 0.22)';
        ctx.fill();
        ctx.strokeStyle = h.c;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(x, GY + 2, rShrink, rShrink * 0.32, 0, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 8;
        ctx.stroke();

        txt('⚡', x, GY - 70 - Math.sin(T * 8) * 8, 20, h.c, 'center');

        if (warnImg) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.4 + 0.5 * pr;
          const rw = h.w * 1.3, rh = rw * 0.35;
          ctx.drawImage(warnImg, x - rw, GY + 2 - rh, rw * 2, rh * 2);
        }
      } else {
        const beamImg = EF_IMGS[h.tex] || EF_IMGS['pillar'];
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
      const laserImg = EF_IMGS[h.tex] || EF_IMGS['laser'];
      const xStart = x, xEnd = x + h.dir * h.len;
      const xLeft = Math.min(xStart, xEnd);
      const beamW = Math.abs(h.len);
      const beamH = h.hh * 2;

      if (!act) {
        ctx.fillStyle = 'rgba(255, 50, 60, ' + (0.12 + 0.15 * pr).toFixed(3) + ')';
        ctx.fillRect(xLeft, h.y - h.hh, beamW, beamH);

        ctx.strokeStyle = h.c || '#ff3b3b';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([12, 8]);
        ctx.lineDashOffset = -T * 50 * h.dir;
        ctx.beginPath();
        ctx.moveTo(xLeft, h.y - h.hh); ctx.lineTo(xLeft + beamW, h.y - h.hh);
        ctx.moveTo(xLeft, h.y + h.hh); ctx.lineTo(xLeft + beamW, h.y + h.hh);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = (T * 20 | 0) % 2 ? '#ffffff' : '#ff4757';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(xStart, h.y);
        ctx.lineTo(xEnd, h.y);
        ctx.stroke();

        const glowR = 12 + 28 * pr + Math.sin(T * 25) * 4;
        const gr = ctx.createRadialGradient(xStart, h.y, 2, xStart, h.y, glowR);
        gr.addColorStop(0, '#ffffff');
        gr.addColorStop(0.4, '#ff4757');
        gr.addColorStop(1, 'rgba(255, 71, 87, 0)');
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(xStart, h.y, glowR, 0, Math.PI * 2);
        ctx.fill();

        txt('⚠ LASER', xStart + h.dir * 40, h.y - h.hh - 12, 12, '#ff6b6b', 'center');
      } else {
        if (laserImg) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.translate(x, h.y);
          ctx.scale(h.dir, 1);
          ctx.drawImage(laserImg, 0, -h.hh * 1.5, h.len, h.hh * 3);
        } else {
          // ★ 强化版矢量死光保底：双层高能激光柱
          ctx.fillStyle = '#ff2222'; ctx.shadowColor = '#ff3838'; ctx.shadowBlur = 32; ctx.globalAlpha = .9;
          ctx.fillRect(xLeft, h.y - h.hh, beamW, beamH);
          ctx.fillStyle = '#ffffff'; ctx.shadowBlur = 10; ctx.fillRect(xLeft, h.y - h.hh * 0.35, beamW, beamH * 0.7);
        }
      }
    } else if (h.k === 'blast') {
      if (!act) {
        if (warnImg) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.4 + 0.5 * Math.sin(T * 12);
          const rw = h.w * pr, rh = rw * 0.35;
          ctx.drawImage(warnImg, x - rw, GY + 2 - rh, rw * 2, rh * 2);
        } else {
          ctx.strokeStyle = h.c; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.7;
          ctx.beginPath(); ctx.ellipse(x, GY + 2, h.w * pr, h.w * .26 * pr, 0, 0, 7); ctx.stroke();
        }
      } else {
        const expImg = EF_IMGS[h.tex] || EF_IMGS['explosion'];
        const q = (h.t - h.delay) / h.dur;
        if (h.up) {   // 从地面向上刺出（地根突刺等）：有贴图用贴图，没有就画矢量尖刺
          const grow = Math.min(1, q * 3), fade = Math.max(0, 1 - Math.max(0, q - 0.55) / 0.45);
          ctx.globalAlpha = fade;
          const hw = h.w * 1.1, hh2 = h.w * 2.6 * grow;
          if (EF_IMGS[h.tex]) ctx.drawImage(EF_IMGS[h.tex], x - hw, GY + 10 - hh2, hw * 2, hh2);
          else if (h.fire) {   // 岩浆/火柱喷发保底
            ctx.globalCompositeOperation = 'lighter';
            for (const k of [-0.55, 0, 0.55]) {
              const hh3 = hh2 * (k ? 0.72 : 1);
              ctx.fillStyle = '#ff6a1a';
              ctx.beginPath(); ctx.moveTo(x + k * hw - 18, GY + 8); ctx.quadraticCurveTo(x + k * hw - 8, GY + 8 - hh3 * .6, x + k * hw, GY + 8 - hh3); ctx.quadraticCurveTo(x + k * hw + 8, GY + 8 - hh3 * .6, x + k * hw + 18, GY + 8); ctx.fill();
              ctx.fillStyle = '#ffe08a';
              ctx.beginPath(); ctx.moveTo(x + k * hw - 8, GY + 8); ctx.lineTo(x + k * hw, GY + 8 - hh3 * .7); ctx.lineTo(x + k * hw + 8, GY + 8); ctx.fill();
            }
          }
          else {
            ctx.fillStyle = h.c; ctx.strokeStyle = '#2b1b0e'; ctx.lineWidth = 2;
            for (const k of [-0.6, 0, 0.6]) {
              ctx.beginPath(); ctx.moveTo(x + k * hw - 14, GY + 8); ctx.lineTo(x + k * hw, GY + 8 - hh2 * (k ? 0.7 : 1));
              ctx.lineTo(x + k * hw + 14, GY + 8); ctx.closePath(); ctx.fill(); ctx.stroke();
            }
          }
        } else if (expImg) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = Math.max(0, 1 - q);
          const r = h.w * (1 + q * 0.4);
          ctx.drawImage(expImg, x - r, GY - r * 0.8, r * 2, r * 1.6);
        }
      }
    } else if (h.k === 'pool') {
      const acidImg = EF_IMGS[h.tex] || EF_IMGS['pool_acid'];
      const life = cl((h.delay + h.dur - h.t) / .8, 0, 1);
      if (acidImg) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (0.75 + Math.sin(T * 4) * 0.15) * life;
        const pw = h.w * 1.5, ph = pw * 0.38;
        ctx.drawImage(acidImg, x - pw / 2, GY - ph / 2 + 4, pw, ph);
      } else if (h.fire) {   // 矢量火池保底：橙色底光 + 跳动的火舌
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = .5 * life; ctx.fillStyle = h.c;
        ctx.beginPath(); ctx.ellipse(x, GY, h.w, h.w * .24, 0, 0, 7); ctx.fill();
        for (let i = 0; i < 7; i++) {
          const fx = x + (i - 3) * h.w * .28, fh = (16 + 14 * Math.abs(Math.sin(T * 9 + i * 1.9))) * life;
          ctx.globalAlpha = .75 * life; ctx.fillStyle = '#ff8a1a';
          ctx.beginPath(); ctx.moveTo(fx - 9, GY + 2); ctx.quadraticCurveTo(fx - 3, GY - fh * .6, fx, GY - fh); ctx.quadraticCurveTo(fx + 3, GY - fh * .6, fx + 9, GY + 2); ctx.fill();
          ctx.fillStyle = '#ffe08a'; ctx.globalAlpha = .8 * life;
          ctx.beginPath(); ctx.moveTo(fx - 4, GY + 2); ctx.lineTo(fx, GY - fh * .55); ctx.lineTo(fx + 4, GY + 2); ctx.fill();
        }
      } else {
        ctx.fillStyle = h.c; ctx.globalAlpha = .35 * life;
        ctx.beginPath(); ctx.ellipse(x, GY, h.w, h.w * .24, 0, 0, 7); ctx.fill();
      }
    } else if (h.k === 'well') {
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

function drawDashWarn(e) {
  const p = dashPlan(e); if (!p) return;
  const fx = p.x0 - cam, tx = p.x1 - cam, dir = tx >= fx ? 1 : -1;
  const blink = (T * (p.lock ? 18 : 8) | 0) % 2, RED = '#ff3b3b';
  const fy = p.y0 - e.h / 2, ty = p.y1 - e.h / 2;
  const warnImg = EF_IMGS['warn'];
  ctx.save();

  ctx.strokeStyle = RED; ctx.lineCap = 'butt'; ctx.lineWidth = Math.max(36, e.h * .9);
  ctx.globalAlpha = p.lock ? .18 + .1 * blink : .09;
  ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(tx, ty); ctx.stroke();

  ctx.lineWidth = 3; ctx.globalAlpha = p.lock ? .95 : .6;
  ctx.setLineDash(p.lock ? [] : [14, 10]); ctx.lineDashOffset = -T * 70 * dir;
  ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.setLineDash([]);

  if (warnImg) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = p.lock ? 0.9 : 0.55;
    const rw = Math.max(45, e.w * 0.6), rh = rw * 0.35;
    ctx.drawImage(warnImg, tx - rw, GY + 4 - rh, rw * 2, rh * 2);
  } else {
    ctx.lineWidth = 3; ctx.strokeStyle = RED; ctx.globalAlpha = p.lock ? .95 : .65;
    ctx.beginPath(); ctx.ellipse(tx, GY + 5, Math.max(38, e.w / 2), 12, 0, 0, 7); ctx.stroke();
  }

  if (e.im) {
    ctx.globalAlpha = p.lock ? .4 : .24; ctx.translate(tx, p.y1); ctx.scale(dir * e.s, e.s);
    ctx.drawImage(e.im, -e.im.width / 2, -e.im.height);
  }
  ctx.restore();
  txt('▼', tx, p.y1 - e.h - 18 - Math.abs(Math.sin(T * 9)) * 6, 22, RED, 'center');
}

// =====================================================================
//  ★ 第一章怪物光效（无状态绘制：位置全部由 T / e.id 算出，不占内存）
//    layer 0 = 画在怪物身后（光晕、地面热浪）；layer 1 = 画在怪物身前（眼光、火星、闪光）
// =====================================================================
const _hexA = (h, a) => { const n = parseInt(h.slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; };
function _glow(x, y, r, col, a, sy) {
  if (r <= 0 || a <= 0) return;
  ctx.save(); ctx.translate(x, y); if (sy) ctx.scale(1, sy);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, _hexA(col, Math.min(1, a))); g.addColorStop(.45, _hexA(col, Math.min(1, a) * .4)); g.addColorStop(1, _hexA(col, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.restore();
}
function _star(x, y, r, col, a) {      // 四角闪光
  if (a <= 0.02) return;
  ctx.save(); ctx.globalAlpha = Math.min(1, a); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - r * .5, y); ctx.lineTo(x + r * .5, y); ctx.moveTo(x, y - r * .5); ctx.lineTo(x, y + r * .5); ctx.stroke();
  ctx.restore();
}
function _rise(x0, y0, w, n, rise, col, size, spd, seed, alpha) {   // 向上飘的火星/尘/晶屑
  ctx.save(); ctx.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const ph = (T * spd + i / n + seed * .37) % 1;
    const x = x0 + (((i * 73 + seed * 31) % 100) / 100 - .5) * w + Math.sin(T * 2 + i * 1.7 + seed) * 7;
    ctx.globalAlpha = Math.max(0, (1 - ph)) * alpha; const sz = size * (1 - ph * .5);
    ctx.fillRect(x - sz / 2, y0 - ph * rise - sz / 2, sz, sz);
  }
  ctx.restore();
}

function drawEnemyAura(e, layer) {
  if (e.dead || !ST[cur]) return;
  if (ST[cur].set === 2) { drawAura2(e, layer); return; }
  if (ST[cur].set !== 1) return;
  const sx = e.x - cam, fc = e.fc || 1, col = ecol(e), id = e.id || 0;
  const wuMax = (e.atk && ATKS[e.atk]) ? ATKS[e.atk].wu : .5;
  const wu = e.wu > 0 ? 1 - Math.min(1, e.wu / wuMax) : 0;          // 蓄力进度 0→1
  const pulse = .75 + .25 * Math.sin(T * 5 + id), cy = e.y - e.h * .5;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';

  // ───────────── 翡翠晶龙（小怪）：翡翠晶光 + 闪烁星芒 + 晶屑拖尾 ─────────────
  if (e.t === 'imp') {
    if (layer === 0) {
      _glow(sx, cy, e.h * 1.0, col, .30 * pulse + .30 * wu);
      _glow(sx - fc * e.w * .25, cy - e.h * .1, e.h * .55, '#7dffd8', .16 * pulse);   // 翼膜透光
      _glow(sx + fc * e.w * .25, cy - e.h * .1, e.h * .55, '#7dffd8', .16 * pulse);
    } else {
      // 晶体棱面闪光
      for (let i = 0; i < 5; i++) {
        const a = Math.max(0, Math.sin(T * 3 + i * 1.9 + id)); 
        _star(sx + Math.cos(i * 2.4 + id) * e.w * .32, cy + Math.sin(i * 1.7 + id) * e.h * .34, 6 + 8 * a, '#c8fff0', Math.pow(a, 5));
      }
      // 环绕小晶片
      ctx.fillStyle = '#9dffe6';
      for (let i = 0; i < 4; i++) {
        const an = T * 2.2 + i * Math.PI / 2 + id, px = sx + Math.cos(an) * e.w * .55, py = cy + Math.sin(an) * e.h * .32;
        ctx.globalAlpha = .85; ctx.beginPath(); ctx.moveTo(px, py - 5); ctx.lineTo(px + 3, py); ctx.lineTo(px, py + 5); ctx.lineTo(px - 3, py); ctx.fill();
      }
      // 身后拖出的翡翠晶屑
      _rise(sx - fc * e.w * .3, cy + e.h * .2, e.w * .5, 8, 40, '#7dffd8', 4, .7, id, .7);
      // 蓄力：嘴前汇聚光球 + 向内收缩的光线
      if (wu > 0) {
        const mx = sx + fc * e.w * .32, my = e.y - e.h * .68;
        _glow(mx, my, 16 + 34 * wu, '#e6fff8', .55 + .4 * wu);
        ctx.strokeStyle = '#7dffd8'; ctx.lineWidth = 1.5; ctx.globalAlpha = .7 * wu;
        for (let i = 0; i < 6; i++) { const an = i * Math.PI / 3 + T * 4, r1 = 60 * (1 - wu) + 14, r2 = r1 + 22; ctx.beginPath(); ctx.moveTo(mx + Math.cos(an) * r1, my + Math.sin(an) * r1); ctx.lineTo(mx + Math.cos(an) * r2, my + Math.sin(an) * r2); ctx.stroke(); }
      }
    }
  }

  // ───────────── 碎岩兽（精英）：地面热浪 + 裂缝熔光 + 眼睛烈焰 + 火星尘 ─────────────
  else if (e.t === 'wd') {
    if (layer === 0) {
      _glow(sx, e.y - 4, e.w * .75, col, .30 * pulse + .25 * wu, .22);          // 脚下热浪椭圆
      _glow(sx, cy, e.h * .8, col, .10 + .12 * wu);
    } else {
      // 岩缝里的熔橙光（跟着心跳闪烁）
      const cr = [[-.22, .55], [.02, .72], [-.36, .38], [.16, .46], [-.06, .28], [.28, .30]];
      cr.forEach((c, i) => {
        const f = .45 + .55 * Math.max(0, Math.sin(T * 4.2 + i * 2.1 + id));
        _glow(sx + fc * e.w * c[0] * -1, e.y - e.h * c[1], 14 + 10 * wu, '#ff8a2a', .35 * f + .3 * wu);
      });
      // 眼睛
      const ex = sx + fc * e.w * .32, ey = e.y - e.h * .55;
      _glow(ex, ey, 16 + 28 * wu, '#ffb347', .75 + .25 * wu);
      _glow(ex, ey, 6, '#fff3d0', 1);
      // 飘起的火星和灰尘
      _rise(sx, e.y - e.h * .55, e.w * .8, 10, 90, '#ffb347', 3, .55, id, .85);
      _rise(sx, e.y - e.h * .30, e.w * .9, 6, 60, '#9aa7b5', 4, .35, id + 3, .35);
      // 地根突刺蓄力：地面裂开一道发光的缝
      if (wu > 0 && e.atk === 'ch1_root_spike') {
        ctx.strokeStyle = '#ff8a2a'; ctx.lineWidth = 3; ctx.shadowColor = '#ff8a2a'; ctx.shadowBlur = 14; ctx.globalAlpha = .4 + .5 * wu;
        ctx.beginPath(); ctx.moveTo(sx + fc * e.w * .3, GY + 2);
        for (let i = 1; i <= 8; i++) ctx.lineTo(sx + fc * (e.w * .3 + i * 62 * wu), GY + 2 + (i % 2 ? 3 : -3));
        ctx.stroke();
      }
    }
  }

  // ───────────── 红绿灯机神（Boss）：警报红背光 + 信号灯三色轮转 + 钢梁闪光 ─────────────
  else if (e.t === 'boss') {
    const rage = e.rg ? 1 : 0, hx = sx + fc * e.w * .09, hy = e.y - e.h * .9;
    if (layer === 0) {
      _glow(sx, cy, e.h * .95, '#ff3b30', .16 + .08 * Math.sin(T * 3) + .22 * wu + .14 * rage);
      _glow(sx, e.y - 4, e.w * .85, '#ff3b30', .22 + .2 * wu + .16 * rage, .2);   // 地面红色警示光
      if (rage) {   // 狂暴：脚下不断外扩的红色冲击环
        for (let i = 0; i < 2; i++) {
          const ph = (T * .9 + i * .5) % 1; ctx.globalAlpha = (1 - ph) * .5; ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.ellipse(sx, GY + 2, e.w * (.3 + ph * .8), e.w * (.3 + ph * .8) * .2, 0, 0, 7); ctx.stroke();
        }
      }
    } else {
      // 信号灯：红 → 黄 → 绿 轮流发光（蓄力时锁定红灯并增强）
      const sig = (e.atk === 'ch1_signal_cycle' && e.wu > 0) ? 0 : (T * .9 | 0) % 3;
      const cols = ['#ff3b30', '#ffc400', '#3dff7a'], sc = cols[sig];
      const flick = .8 + .2 * Math.sin(T * 24);
      _glow(hx, hy, 34 + 40 * wu + 12 * rage, sc, (.6 + .35 * wu) * flick);
      _glow(hx, hy, 9, '#ffffff', .9);
      // 镜头星芒
      ctx.strokeStyle = sc; ctx.globalAlpha = .55 * flick; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(hx - 54 - 30 * wu, hy); ctx.lineTo(hx + 54 + 30 * wu, hy); ctx.moveTo(hx, hy - 36 - 20 * wu); ctx.lineTo(hx, hy + 36 + 20 * wu); ctx.stroke();
      // 钢梁/护栏的金属反光（随机错开闪烁）
      const gl = [[-.30, .74], [.24, .72], [.32, .56], [-.12, .50], [-.34, .52], [.10, .64]];
      gl.forEach((c, i) => {
        const a = Math.pow(Math.max(0, Math.sin(T * 2.6 + i * 1.7 + id)), 8);
        _star(sx + fc * e.w * c[0], e.y - e.h * c[1], 8 + 12 * a, '#e8f1ff', a);
      });
      // 裂缝里的暗红能量 + 肩部飘出的火星
      [[-.1, .62], [.08, .5], [-.2, .38], [.18, .38]].forEach((c, i) => {
        const f = .4 + .6 * Math.max(0, Math.sin(T * 3.4 + i * 2.3 + id));
        _glow(sx + fc * e.w * c[0], e.y - e.h * c[1], 20, '#ff5a30', .22 * f + .25 * wu + .12 * rage);
      });
      _rise(sx, e.y - e.h * .7, e.w * .8, 8 + 6 * rage, 110, '#ff8a4a', 3, .5, id, .8);
      // 蓄力：红色警戒环向头部收缩
      if (wu > 0) {
        ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 3; ctx.globalAlpha = .8;
        ctx.beginPath(); ctx.arc(hx, hy, 90 * (1 - wu) + 22, 0, 7); ctx.stroke();
      }
    }
  }
  ctx.restore();
}

// =====================================================================
//  ★ 第二章怪物光效：熔岩炎蝠 / 黑曜熔喉兽 / 炎狱魔尊
// =====================================================================
function drawAura2(e, layer) {
  const sx = e.x - cam, fc = e.fc || 1, id = e.id || 0;
  const wuMax = (e.atk && ATKS[e.atk]) ? ATKS[e.atk].wu : .5;
  const wu = e.wu > 0 ? 1 - Math.min(1, e.wu / wuMax) : 0;
  const pulse = .75 + .25 * Math.sin(T * 5 + id), cy = e.y - e.h * .5, rage = e.rg ? 1 : 0;
  // 火舌：橙色外焰 + 黄色内焰，高度随时间跳动
  const fl = (x, y, s, seed, a) => {
    const f = .8 + .2 * Math.sin(T * 13 + seed * 2.3);
    _glow(x, y - s * .6 * f, s * f * .7, '#ff6a1a', a, 1.7);
    _glow(x, y - s * .4 * f, s * f * .4, '#ffd84a', a * .9, 1.6);
  };
  ctx.save(); ctx.globalCompositeOperation = 'lighter';

  // ───────────── 熔岩炎蝠（小怪）：翼焰 + 火星拖尾 ─────────────
  if (e.t === 'imp') {
    if (layer === 0) {
      _glow(sx, cy, e.h * 1.0, '#ff7a1a', .28 * pulse + .30 * wu);
      _glow(sx - fc * e.w * .3, cy - e.h * .1, e.h * .6, '#ff9a2e', .20 * pulse);
      _glow(sx + fc * e.w * .3, cy - e.h * .1, e.h * .6, '#ff9a2e', .20 * pulse);
    } else {
      for (const s of [-1, 1]) for (let j = 0; j < 3; j++)           // 翅膀边缘的火舌
        fl(sx + s * e.w * (.18 + .13 * j), cy - e.h * (.12 + .06 * j), e.h * (.26 + .12 * wu), id + j + s * 5, .5);
      _rise(sx - fc * e.w * .3, cy + e.h * .1, e.w * .5, 8, 50, '#ffb347', 3, .8, id, .85);   // 身后火星
      _rise(sx, cy, e.w * .9, 6, 70, '#ff6a1a', 4, .5, id + 4, .6);
      _glow(sx + fc * e.w * .1, e.y - e.h * .38, 9, '#fff0b0', .95);                           // 眼睛
      if (wu > 0) {   // 蓄力：胸口燃起，火舌拔高
        _glow(sx, cy, 18 + 46 * wu, '#ffd84a', .55 * wu);
        fl(sx, cy + e.h * .15, e.h * (.4 + .5 * wu), id, .7 * wu);
      }
    }
  }

  // ───────────── 黑曜熔喉兽（精英）：背上熔囊 + 喉咙熔光 + 地面热浪 ─────────────
  else if (e.t === 'wd') {
    const sacs = [[-.03, .81], [.19, .78]];
    if (layer === 0) {
      _glow(sx, e.y - 4, e.w * .8, '#ff5a1a', .30 * pulse + .25 * wu, .22);
      _glow(sx, cy, e.h * .9, '#ff5a1a', .12 + .12 * wu);
    } else {
      sacs.forEach((c, i) => {          // 两颗熔囊：蓄力时鼓胀发亮，上面蹿火
        const sxx = sx + fc * e.w * c[0], syy = e.y - e.h * c[1], r = e.h * .22 * (1 + .3 * wu);
        _glow(sxx, syy, r, '#ffb02e', .55 * pulse + .35 * wu);
        fl(sxx, syy - r * .6, e.h * .35 * (1 + .4 * wu + .3 * rage), id + i * 3, .6);
      });
      const cr = [[-.3, .35], [-.1, .5], [.1, .4], [.2, .28], [-.35, .22], [0, .25]];
      cr.forEach((c, i) => {            // 岩缝熔光
        const f = .45 + .55 * Math.max(0, Math.sin(T * 4.2 + i * 2.1 + id));
        _glow(sx + fc * e.w * c[0], e.y - e.h * c[1], 14 + 8 * wu, '#ff8a2a', .35 * f + .3 * wu);
      });
      _glow(sx + fc * e.w * .42, e.y - e.h * .42, 14 + 30 * wu, '#ffd84a', .6 + .35 * wu);   // 喉咙熔光
      _glow(sx + fc * e.w * .34, e.y - e.h * .54, 10, '#fff0b0', .9);                        // 眼睛
      _rise(sx, e.y - e.h * .9, e.w * .5, 10, 120, '#ffb347', 3, .6, id, .9);
      _rise(sx, e.y - e.h * .3, e.w * .9, 6, 60, '#4a3a34', 4, .3, id + 3, .4);               // 灰烬
      if (wu > 0 && e.atk === 'ch2_lava_geyser') {   // 岩浆喷泉蓄力：地面裂缝发光
        ctx.strokeStyle = '#ff6a1a'; ctx.lineWidth = 3; ctx.shadowColor = '#ff6a1a'; ctx.shadowBlur = 14; ctx.globalAlpha = .4 + .5 * wu;
        ctx.beginPath(); ctx.moveTo(sx + fc * e.w * .3, GY + 2);
        for (let i = 1; i <= 8; i++) ctx.lineTo(sx + fc * (e.w * .3 + i * 62 * wu), GY + 2 + (i % 2 ? 3 : -3));
        ctx.stroke();
      }
    }
  }

  // ───────────── 炎狱魔尊（Boss）：翼焰 + 头冠火 + 胸口熔脉 + 巨剑辉光 ─────────────
  else if (e.t === 'boss') {
    const k = 1 + .5 * wu + .35 * rage, hx = sx + fc * e.w * .12;
    if (layer === 0) {
      _glow(sx, cy + e.h * .1, e.h * .95, '#ff5a1a', .20 + .08 * Math.sin(T * 3) + .25 * wu + .15 * rage);
      _glow(sx - e.w * .38, e.y - e.h * .6, e.h * .55, '#ff7a1a', .22 + .1 * wu);
      _glow(sx + e.w * .38, e.y - e.h * .6, e.h * .55, '#ff7a1a', .22 + .1 * wu);
      _glow(sx, e.y - 4, e.w * .9, '#ff4a10', .28 + .2 * wu + .15 * rage, .2);
      if (rage) for (let i = 0; i < 2; i++) {   // 狂暴：脚下火圈外扩
        const ph = (T * .9 + i * .5) % 1; ctx.globalAlpha = (1 - ph) * .5; ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(sx, GY + 2, e.w * (.3 + ph * .8), e.w * (.3 + ph * .8) * .2, 0, 0, 7); ctx.stroke();
      }
    } else {
      for (const s of [-1, 1]) for (let j = 0; j < 4; j++)            // 双翼火焰
        fl(sx + s * e.w * (.30 + .06 * j), e.y - e.h * (.92 - .13 * j), e.h * .22 * k, id * 3 + j + s * 7, .55);
      fl(hx, e.y - e.h * .84, e.h * .2 * k, id, .75);                  // 头冠火
      _glow(hx, e.y - e.h * .76, 9, '#ffe08a', .95);                   // 眼
      [[.05, .55], [.10, .45], [0, .38], [.18, .5]].forEach((c, i) => { // 胸口熔脉
        const f = .4 + .6 * Math.max(0, Math.sin(T * 3.4 + i * 2.3 + id));
        _glow(sx + fc * e.w * c[0], e.y - e.h * c[1], 22, '#ff8a2a', .3 * f + .25 * wu + .12 * rage);
      });
      for (let i = 0; i < 5; i++) {                                    // 巨剑：从握柄到剑尖逐点发光
        const t = i / 4, bx = sx + fc * e.w * (-.23 + .64 * t), by = e.y - e.h * (.36 - .28 * t);
        const f = .7 + .3 * Math.sin(T * 9 + i * 1.3);
        _glow(bx, by, 24 + 10 * wu, '#ffb02e', (.45 + .4 * wu) * f);
      }
      _star(sx + fc * e.w * .41, e.y - e.h * .08, 14 + 10 * wu, '#ffe08a', .6 + .4 * Math.sin(T * 8) ** 2);   // 剑尖闪光
      _rise(sx + fc * e.w * .1, e.y - e.h * .25, e.w * .5, 6, 70, '#ffb347', 3, .6, id + 2, .8);               // 剑上落火星
      _rise(sx, e.y - e.h * .8, e.w * .9, 10 + 6 * rage, 140, '#ff8a2a', 3, .5, id, .8);                      // 翼上飘火星
      if (wu > 0) {                                                    // 蓄力：火环向身体收缩
        ctx.strokeStyle = '#ff6a1a'; ctx.lineWidth = 3; ctx.globalAlpha = .8;
        ctx.beginPath(); ctx.arc(sx, cy, e.h * .6 * (1 - wu) + e.h * .25, 0, 7); ctx.stroke();
      }
    }
  }
  ctx.restore();
}

// ===== 弹幕与第一章高精专属特效绘制（带高精矢量降级保底） =====
function drawEP() {
  for (const p of EP) {
    const x = p.x - cam;
    const img = p.tex ? EF_IMGS[p.tex] : null;

    ctx.save();
    // ★ 1. Boss专属：超大断裂防撞护栏（由 84x38 放大至 150x65）
    if (p.tex === 'ch1_guardrail') {
      const w = 150, h = 65;
      ctx.translate(x, GY - 20);
      ctx.rotate(T * 14 * Math.sign(p.vx || 1));
      if (img) {
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      } else {
        // [高精矢量保底] 飞旋的双色工业防撞护栏 + 弯曲钢筋 + 地面火花
        ctx.fillStyle = '#7a889b'; ctx.fillRect(-w / 2, -h / 2 + 10, w, h - 20);
        ctx.strokeStyle = '#d9e2ec'; ctx.lineWidth = 3; ctx.strokeRect(-w / 2, -h / 2 + 10, w, h - 20);
        ctx.fillStyle = '#ffd84a';
        for (let sx = -w / 2 + 12; sx < w / 2 - 10; sx += 32) {
          ctx.beginPath(); ctx.moveTo(sx, -h / 2 + 10); ctx.lineTo(sx + 16, -h / 2 + 10);
          ctx.lineTo(sx, h / 2 - 10); ctx.lineTo(sx - 16, h / 2 - 10); ctx.fill();
        }
        ctx.strokeStyle = '#ff4757'; ctx.lineWidth = 3.5; ctx.beginPath();
        ctx.moveTo(-w / 2, -5); ctx.lineTo(-w / 2 - 24, -18); ctx.lineTo(-w / 2 - 38, -6);
        ctx.moveTo(w / 2, 5); ctx.lineTo(w / 2 + 26, 18); ctx.lineTo(w / 2 + 40, 8); ctx.stroke();
      }
    } 
    // ★ 2. Boss专属：天降巨型水泥桥墩立柱（由 54x104 放大至 95x210）
    else if (p.tex === 'ch1_pillar_fall') {
      const w = 95, h = 210;
      ctx.translate(x, p.y);
      if (img) {
        ctx.drawImage(img, -w / 2, -h * 0.75, w, h);
      } else {
        // [高精矢量保底] 倒塌的钢筋混凝土立交桥柱
        ctx.fillStyle = '#627282'; ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeStyle = '#9fb3c8'; ctx.lineWidth = 3; ctx.strokeRect(-w / 2, -h / 2, w, h);
        ctx.fillStyle = '#102a43'; ctx.fillRect(-w / 2 - 8, -h / 2 - 16, w + 16, 18);
        ctx.fillStyle = '#f0b429'; ctx.fillRect(-20, -h / 2 - 12, 40, 5);
        ctx.strokeStyle = '#e12d39'; ctx.lineWidth = 4; ctx.beginPath();
        ctx.moveTo(-24, h / 2); ctx.lineTo(-30, h / 2 + 35);
        ctx.moveTo(18, h / 2); ctx.lineTo(22, h / 2 + 40); ctx.lineTo(34, h / 2 + 48); ctx.stroke();
      }
    } 
    else if (p.tex === 'wave_ground') {
      const w = 110, h = 80;
      ctx.translate(x, GY);
      ctx.scale(p.vx > 0 ? 1 : -1, 1);
      if (img) {
        ctx.drawImage(img, -w * 0.45, -h + 8, w, h);
      } else {
        ctx.fillStyle = '#334e68'; ctx.beginPath();
        ctx.moveTo(-w * 0.5, 0); ctx.lineTo(-w * 0.2, -h * 0.85); ctx.lineTo(0, -h * 0.4);
        ctx.lineTo(w * 0.3, -h); ctx.lineTo(w * 0.5, 0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#627d98'; ctx.lineWidth = 2; ctx.stroke();
      }
    } 
    else {
      const ang = Math.atan2(p.vy || 0, p.vx || 0);
      ctx.translate(x, p.y);
      ctx.rotate(ang);

      let dw = 60, dh = 60, ox = -dw / 2;
      // ★ 3. 小怪绿晶龙专属：晶刺飞弹（由 64x24 放大至 110x42）
      if (p.tex === 'ch1_crystal') {
        dw = 110; dh = 42; ox = -dw * 0.7;
        if (img) {
          ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 16;
          ctx.drawImage(img, ox, -dh / 2, dw, dh);
        } else {
          // [高精矢量保底] 散发强光的翡翠菱形晶刃
          ctx.save(); ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 18;
          ctx.fillStyle = '#00e5ff'; ctx.beginPath();
          ctx.moveTo(35, 0); ctx.lineTo(-20, -18); ctx.lineTo(-45, 0); ctx.lineTo(-20, 18); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ffffff'; ctx.beginPath();
          ctx.moveTo(25, 0); ctx.lineTo(-15, -9); ctx.lineTo(-30, 0); ctx.lineTo(-15, 9); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      } 
      // ★ 4. 精英怪废墟兽专属：混凝土滚石（由 50x50 放大至 95x95）
      else if (p.tex === 'ch1_rubble') {
        dw = 95; dh = 95; ox = -dw / 2;
        ctx.rotate(T * 8);
        if (img) {
          ctx.drawImage(img, ox, -dh / 2, dw, dh);
        } else {
          // [高精矢量保底] 穿出生锈钢筋的滚石瓦砾
          ctx.fillStyle = '#829ab1'; ctx.beginPath();
          ctx.arc(0, 0, 36, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#486581'; ctx.lineWidth = 4; ctx.stroke();
          ctx.strokeStyle = '#d64545'; ctx.lineWidth = 5; ctx.beginPath();
          ctx.moveTo(-40, -10); ctx.lineTo(-58, -25);
          ctx.moveTo(30, 15); ctx.lineTo(55, 30); ctx.lineTo(65, 20); ctx.stroke();
        }
      } 
      // ★ 机神：工字钢（旋转飞行）
      else if (p.tex === 'ch1_girder') {
        dw = 170; dh = 44; ox = -dw / 2;
        ctx.rotate(T * 9);
        if (img) {
          ctx.drawImage(img, ox, -dh / 2, dw, dh);
        } else {
          ctx.fillStyle = '#9aa7b5'; ctx.fillRect(ox, -dh / 2, dw, dh);
          ctx.fillStyle = '#ffd84a';
          for (let sx = ox + 8; sx < dw / 2 - 20; sx += 40) ctx.fillRect(sx, -dh / 2, 18, 8);
          ctx.strokeStyle = '#e8eef5'; ctx.lineWidth = 3; ctx.strokeRect(ox, -dh / 2, dw, dh);
        }
      }
      // ★ 机神：红黄绿信号灯的琥珀光球
      else if (p.tex === 'ch1_signal_orb') {
        dw = 60; dh = 60; ox = -dw / 2;
        ctx.shadowColor = p.c || '#ffc400'; ctx.shadowBlur = 14;
        if (img) ctx.drawImage(img, ox, -dh / 2, dw, dh);
        else {
          ctx.fillStyle = p.c || '#ffc400'; ctx.beginPath(); ctx.arc(0, 0, 18, 0, 7); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill();
        }
      }
      // ===== 第二章弹体 =====
      else if (p.tex === 'ch2_ember') {            // 炎羽（沿飞行方向）
        dw = 92; dh = 36; ox = -dw * 0.65;
        ctx.shadowColor = '#ff7a1a'; ctx.shadowBlur = 16;
        if (img) ctx.drawImage(img, ox, -dh / 2, dw, dh);
        else {
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = '#ff6a1a'; ctx.beginPath(); ctx.moveTo(34, 0); ctx.quadraticCurveTo(0, -17, -44, -4); ctx.lineTo(-30, 0); ctx.lineTo(-44, 4); ctx.quadraticCurveTo(0, 17, 34, 0); ctx.fill();
          ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.moveTo(22, 0); ctx.quadraticCurveTo(0, -7, -22, 0); ctx.quadraticCurveTo(0, 7, 22, 0); ctx.fill();
        }
      }
      else if (p.tex === 'ch2_ember_bomb' || p.tex === 'ch2_magma_ball') {   // 火球/岩浆球（滚动）
        const big = p.tex === 'ch2_magma_ball';
        dw = big ? 96 : 66; dh = dw; ox = -dw / 2;
        ctx.rotate(-ang); ctx.rotate(T * (big ? 5 : 8));
        ctx.shadowColor = big ? '#ff5a1a' : '#ff9a2e'; ctx.shadowBlur = 20;
        if (img) ctx.drawImage(img, ox, -dh / 2, dw, dh);
        else {
          const r = dw * .34;
          ctx.fillStyle = big ? '#3a1408' : '#5a2208'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
          ctx.fillStyle = '#ff6a1a'; ctx.beginPath(); ctx.arc(0, 0, r * .8, 0, 7); ctx.fill();
          ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(-r * .1, -r * .1, r * .45, 0, 7); ctx.fill();
        }
      }
      else if (p.tex === 'ch2_fire_slash') {       // 炎狱斩：横向火刃，朝哪边飞就朝哪边弯
        dw = 170; dh = 120; ox = -dw * 0.5;
        ctx.rotate(-ang); ctx.scale(p.vx < 0 ? -1 : 1, 1);
        ctx.shadowColor = '#ff6a1a'; ctx.shadowBlur = 22;
        if (img) ctx.drawImage(img, ox, -dh / 2, dw, dh);
        else {
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = '#ff5a1a'; ctx.beginPath(); ctx.moveTo(60, 0); ctx.quadraticCurveTo(10, -66, -46, -56); ctx.quadraticCurveTo(-8, -26, -18, 0); ctx.quadraticCurveTo(-8, 26, -46, 56); ctx.quadraticCurveTo(10, 66, 60, 0); ctx.fill();
          ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.moveTo(48, 0); ctx.quadraticCurveTo(10, -36, -26, -34); ctx.quadraticCurveTo(0, -12, -4, 0); ctx.quadraticCurveTo(0, 12, -26, 34); ctx.quadraticCurveTo(10, 36, 48, 0); ctx.fill();
        }
      }
      else if (p.tex === 'ch2_lava_meteor') {      // 熔岩陨块（沿飞行方向，尾焰在后）
        dw = 140; dh = 100; ox = -dw * 0.62;
        ctx.shadowColor = '#ff6a1a'; ctx.shadowBlur = 24;
        if (img) ctx.drawImage(img, ox, -dh / 2, dw, dh);
        else {
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = '#ff6a1a'; ctx.beginPath(); ctx.moveTo(-70, 0); ctx.lineTo(-10, -22); ctx.lineTo(-10, 22); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = '#2a1410'; ctx.beginPath(); ctx.arc(0, 0, 30, 0, 7); ctx.fill();
          ctx.strokeStyle = '#ff8a1a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-18, -8); ctx.lineTo(0, 4); ctx.lineTo(14, -12); ctx.moveTo(0, 4); ctx.lineTo(8, 20); ctx.stroke();
        }
      }
      else if (p.tex === 'energy') { 
        dw = 64; dh = 64; ox = -dw / 2;
        if (img) { ctx.shadowColor = p.c || '#a29bfe'; ctx.shadowBlur = 10; ctx.drawImage(img, ox, -dh / 2, dw, dh); }
        else { ctx.fillStyle = p.c || '#00e5ff'; ctx.beginPath(); ctx.arc(0, 0, 18, 0, 7); ctx.fill(); }
      } 
      else if (p.tex === 'wave_air') { 
        dw = 95; dh = 52; ox = -dw * 0.6;
        if (img) { ctx.shadowColor = p.c || '#7df'; ctx.shadowBlur = 12; ctx.drawImage(img, ox, -dh / 2, dw, dh); }
        else { ctx.fillStyle = p.c || '#7df'; ctx.beginPath(); ctx.ellipse(0, 0, 30, 14, 0, 0, 7); ctx.fill(); }
      } 
      else if (p.tex === 'meteor') { 
        dw = 115; dh = 58; ox = -dw * 0.6;
        if (img) ctx.drawImage(img, ox, -dh / 2, dw, dh);
        else { ctx.fillStyle = '#ff4757'; ctx.beginPath(); ctx.arc(0, 0, 26, 0, 7); ctx.fill(); }
      } 
      else if (p.tex === 'homing') { 
        dw = 70; dh = 70; ox = -dw * 0.55;
        if (img) ctx.drawImage(img, ox, -dh / 2, dw, dh);
        else { ctx.fillStyle = '#a55eea'; ctx.beginPath(); ctx.arc(0, 0, 20, 0, 7); ctx.fill(); }
      } 
      else if (p.tex === 'lob' || p.tex === 'poison') { 
        dw = 75; dh = 75; ox = -dw * 0.5;
        if (img) ctx.drawImage(img, ox, -dh / 2, dw, dh);
        else { ctx.fillStyle = p.tex === 'poison' ? '#2ed573' : '#ffa502'; ctx.beginPath(); ctx.arc(0, 0, 22, 0, 7); ctx.fill(); }
      }
    }
    ctx.restore();
  }
}

function dashPlan(e) {
  if (e.dead) return null;
  if (e.atk !== 'charge' && e.atk !== 'swoop' && !(e.atk === 'ch1_signal_cycle' && e.dsh > 0)) return null;
  const imp = e.t === 'imp';
  if (e.dsh > 0) {
    return { x0: e.x, y0: e.y, x1: cl(e.x + e.dvx * e.dsh, 40, WW - 40), y1: imp ? Math.min(GY, e.y + e.dvy * e.dsh) : e.y, lock: true };
  }
  if (!(e.wu > 0)) return null;
  let dvx, dvy = 0, dur;
  if (e.atk === 'charge') { dvx = e.fc * (520 + ST[cur].set * 15); dur = .75; }
  else { const t = e.lk || { x: P.x, y: P.y - 70 }; dvx = (t.x - e.x) / .4; dvy = (t.y - e.y) / .4; dur = .6; }
  return { x0: e.x, y0: e.y, x1: cl(e.x + dvx * dur, 40, WW - 40), y1: imp ? Math.min(GY, e.y + dvy * dur) : e.y, lock: e.wu <= LOCK_T };
}

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
    
    if (b.tick <= 0) {
      b.tick = 0.2;
      b.hit = {};
    }
    
    if (!b.vis) {
      cancelEP(b.x - 70, b.x + 70);
      area(b.x - 80, b.x + 80, b.dmg, b.hit);
    }

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

function nextStageIdx() {
  const z = ST[cur];
  if (z && z.tw) return cur;
  if (z && z.coop) return (ST[cur + 1] && ST[cur + 1].coop) ? cur + 1 : -1;
  return (cur + 1 < ST.length && !ST[cur + 1].wb && !ST[cur + 1].coop && !ST[cur + 1].tw) ? cur + 1 : -1;
}

function settleAct(act) {
  const multi = typeof coopSettleActive === 'function' && coopSettleActive();
  if (act === 'retry') {
    if (multi) coopVote('retry'); else begin(cur);
    return;
  }
  if (act === 'next') {
    if (ST[cur] && ST[cur].tw) { towerNext(); return; }
    const nx = nextStageIdx();
    if (nx < 0) { toVil('st'); return; }
    if (multi) coopVote('next'); else begin(nx);
  }
}