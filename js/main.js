// ===== 资源初始化 =====
async function prep() {
  msg = '加载封面…';
  try {
    let covIm = null;
    const tryNames = ['Cover.jpg', 'cover.jpg', 'Cover.png', 'cover.png'];
    for (const fn of tryNames) {
      try { covIm = await load(COVER + fn); if (covIm) break; } catch (err) {}
    }
    if (!covIm) covIm = await load(A + 'Cover/Cover.jpg');
    COVER_IMG = covIm;
  } catch (e) {
    miss.push('Cover/Cover.jpg');
  }
  msg = '加载章节场景…';
  for (let ch = 1; ch <= 10; ch++) {
    const tryList = [
      A + `Scenes/Chapter ${ch}.jpg`,
      A + `Scenes/Chapter ${ch}.png`,
      A + `Scenes/Chapter${ch}.jpg`,
      A + `Scenes/Chapter${ch}.png`,
      SCN
    ];
    for (const p of tryList) {
      try {
        SC_MAP[ch] = await load(p);
        if (SC_MAP[ch]) break;
      } catch (e) {}
    }
    if (!SC_MAP[ch] && SC_MAP[1]) {
      SC_MAP[ch] = SC_MAP[1];
    }
  }
  SC = SC_MAP[1] || (await loadCrit(SCN));
  for (const o of Object.values(SH)) {
    msg = '加载骑士技能…'; const im = await loadCrit(KR + o.f);
    Object.assign(o, sliceSheet(im, o.c, o.r, o.ref, o.cut || 0));
    if (o.mid) o.fy = o.ch / 2; if (o.w) { const b = bb(o.f[o.ref]); o.s = o.w / (b.x1 - b.x0) }
  }

  const iconList = [
    ['atk', 'Skill_Atk'],
    ['l', 'Skill_L'],
    ['e', 'Skill_E'],
    ['k', 'Skill_K'],
    ['p', 'Skill_P']
  ];
  for (const [key, base] of iconList) {
    const tryList = [
      A + 'Icon/' + base + '.png',
      A + 'Icon/' + base + '.PNG',
      A + 'Icon/' + base + '.jpg'
    ];
    for (const p of tryList) {
      try {
        const im = await load(p);
        if (im) { SKILL_IMGS[key] = im; break; }
      } catch(e) {}
    }
  }

  try {
    const lvTries = [
      A + 'UI/Banner_LevelUp.png',
      A + 'Icon/Banner_LevelUp.png',
      A + 'Banner_LevelUp.png'
    ];
    for (const p of lvTries) {
      try { 
        LV_IMG = await load(p); 
        if (LV_IMG) break; 
      } catch(e) {}
    }
  } catch(e) {}

  msg = '加载战斗特效…';
  const efList = [
    ['energy', 'Bullet_Energy'],
    ['homing', 'Bullet_Homing'],
    ['lob', 'Bullet_Lob'],
    ['meteor', 'Bullet_Meteor'],
    ['poison', 'Bullet_PoisonLob'],
    ['wave_air', 'Wave_Air'],
    ['wave_ground', 'Wave_Ground'],
    ['pillar', 'Pillar_Beam'],
    ['laser', 'Laser_Beam'],
    ['pool_acid', 'Pool_Acid'],
    ['vortex', 'Vortex_Hole'],
    ['warn', 'Warn_Decal'],
    ['explosion', 'Hit_Explosion']
  ];
  for (const [key, base] of efList) {
    const tryList = [
      EF + base + '.png',
      EF + base + '.PNG',
      EF + base + '.jpg',
      A + 'effects/' + base + '.png',
      A + 'effects/' + base + '.jpg'
    ];
    for (const p of tryList) {
      try {
        const im = await load(p);
        if (im) { EF_IMGS[key] = im; break; }
      } catch (e) {}
    }
  }

  await loadRyukiAssets();

  try { CAP_IMGS['555'] = await load(DRAW + 'KR_555.jpg') } catch (e) { miss.push('Draw/KR_555.jpg') }
  for (const o of Object.values(SH5)) {
    try {
      const im = await load(FAIZ + o.f);
      Object.assign(o, sliceSheet(im, o.c, o.r, o.ref || 0, 0, false));
      o.s = FAIZ_SCALE;
    } catch (e) { miss.push('Kamen Rider 555/' + o.f); }
  }
  try {
    const trIm = await load(TRANS + 'KR_Malaya_TransformTo_KR_555.png');
    SH5.trans = sliceSheet(trIm, 4, 4, 8, 0, false); SH5.trans.s = FAIZ_SCALE;
  } catch (e) { miss.push('Transform/KR_Malaya_TransformTo_KR_555.png'); }
  try { const g = await load(FAIZ + 'KR_555_Gun.png'); GUN5 = trim(toCanvas(g)); } catch (e) { miss.push('Kamen Rider 555/KR_555_Gun.png'); }
  try { const b = await load(FAIZ + 'KR_555_Bullet.png'); BUL5 = trim(toCanvas(b)); } catch (e) { miss.push('Kamen Rider 555/KR_555_Bullet.png'); }
  await loadBladeAssets();
  if (typeof loadZeztzAssets === 'function') await loadZeztzAssets();

  for (let n = 1; n <= 10; n++) {
    try { const im = await load(ED + 'Enemies_' + n + '.png'); const sp = cut(im); ENL.push(...sp); ENS[n] = assign(sp) }
    catch (e) { miss.push('Enemies_' + n + '.png'); ENS[n] = { imp: [ph(ET.imp.col)], wd: [ph(ET.wd.col)], boss: [ph(ET.boss.col)] } }
  }
  const R = assign(ENL); for (const k in ET) EN[k] = R[k] && R[k].length ? R[k] : ENL.length ? ENL : [ph(ET[k].col)];
  const li = async f => {
    if (!f || f.endsWith('/')) return null;
    try {
      return await load(f);
    } catch (e) {
      const fn = f.split('/').filter(Boolean).pop();
      if (fn) miss.push(fn);
      return null;
    }
  };
  IM.v = await li(A + 'Interior/基地.jpg');
  ICO.g = mkIcon(await li(A + 'Icon/Coin.png')); ICO.d = mkIcon(await li(A + 'Icon/Diamond.png'));
  {
    const lq = async f => { try { return await load(f) } catch (e) { return null } };
    ICO.mat = mkIcon(await lq(A + 'Icon/Shard.png')); ICO.scr = mkIcon(await lq(A + 'Icon/Scroll.png'));
    for (const k of ['weapon', 'chest', 'belt', 'legs', 'boots', 'necklace', 'ring']) EQI[k] = mkIcon(await lq(A + 'Icon/Equip_' + k + '.png'));
    EQI.ryuki_cap = mkIcon(await lq(A + 'Icon/Equip_capsule.png'));
  }
  { const pi = await li(A + 'Buildings/传送门.png'); if (pi) PG.bi = trim(toCanvas(pi)); }
  for (const b of BD) {
    if (b.rf) b.ri = await li(A + 'Interior/' + b.rf);
    if (b.bf) {
      const im = await li(A + 'Buildings/' + b.bf);
      if (im) b.bi = trim(toCanvas(im));
    }
  }
  layoutVillage();
  for (const b of BD) {
    if (b.bi) b.bi = shrinkH(b.bi, Math.round(b.h * 1.5));
    if (b.ri) b.ri = shrinkH(toCanvas(b.ri), 810);
  }
  if (PG.bi) PG.bi = shrinkH(PG.bi, Math.round(PG.h * 1.5));
  if (IM.v) IM.v = shrinkH(toCanvas(IM.v), 810);
  try { const bi = await loadCrit(KR + 'KR_Malaya_Vehicles.png'); BK = trim(toCanvas(bi)); }
  catch (e) { miss.push('Kamen Rider Malaya/KR_Malaya_Vehicles.png'); BK = document.createElement('canvas'); BK.width = 64; BK.height = 64; }
  G = 'title';
  try { localStorage.mlLoadEst = String(LD.done + 2); } catch (e) {}

  const loadNpcImg = async (fn) => {
    const tryList = [
      A + 'NPC/' + fn + '.png',
      A + 'NPC/' + fn + '.PNG',
      'NPC/' + fn + '.png'
    ];
    for (const p of tryList) {
      try {
        const raw = await load(p);
        if (raw) return shrinkH(trim(toCanvas(raw)), 380);
      } catch (e) {}
    }
    miss.push('Assets/NPC/' + fn + '.png');
    return null;
  };

  EL.im = await loadNpcImg('阿公');

  const npcFileMap = {
    '药师 阿玲': '阿玲',
    '铁匠 老岩': '老岩',
    '教官 无相': '无相'
  };
  for (const b of BD) {
    const file = npcFileMap[b.npc];
    if (file) {
      b.im = await loadNpcImg(file);
    }
  }
}
prep().catch(e => {
  console.error('[prep 失败]', e);
  G = 'err';
  const why = typeof e === 'string' ? '无法加载：' + e : (e && e.message) || String(e);
  msg = '加载出现问题（' + why + '）。请确保使用本地服务器(http://)并放置素材，然后刷新重试。';
});

// ===== 普攻音效 =====
const HIT_SND = []; let hitSndI = 0;
(function () { for (let i = 0; i < 4; i++) { const a = new Audio(); a.preload = 'auto'; a.volume = .6; a.src = encodeURI(A + 'SoundFX/Sword_Hit.mp3'); HIT_SND.push(a) } })();
function playSwordHit() { const a = HIT_SND[hitSndI++ % HIT_SND.length]; try { a.currentTime = 0; const p = a.play(); if (p && p.catch) p.catch(() => { }) } catch (e) { } }

// ===== 游戏主逻辑帧刷新 =====
function upd(dt) {
  if (G === 'td') return tdUpdate(dt);   // ★ 塔防：独立画面，不走下面的战斗 / 基地逻辑
  if (G === 'play' && typeof coopUpdateBattle === 'function') coopUpdateBattle(dt);

  if (LV_POP) {
    LV_POP.t += dt;
    shake = Math.max(0, shake - 20 * dt);
    if (LV_POP.t >= LV_POP.dur) {
      LV_POP = null;
    }
    return;
  }

  T += dt; shake = Math.max(0, shake - 30 * dt); V.mt -= dt; bagNoticeT -= dt;
  for (const d of DT) d.t -= dt; DT = DT.filter(d => d.t > 0);
  for (const f of FX) f.t -= dt; FX = FX.filter(f => f.t > 0);
  for (const g of GH) g.t -= dt; GH = GH.filter(g => g.t > 0);

  psTick(dt);
  questTick(dt);

  if (PR.KeyI) { if (showStat) showStat = false; else if (psCanOpen()) psOpen(); delete PR.KeyI; }
  if (showStat) {
    if (typeof ttPickerKeys === 'function' && ttPickerKeys()) return;
    if (PR.Escape || PR.Enter || PR.Space || PR.KeyF) { showStat = false; delete PR.Escape; delete PR.Enter; delete PR.Space; delete PR.KeyF; }
    return;
  }

  if (PR.KeyQ) { if (showQuest) showQuest = false; else if (psCanOpen()) questOpen(); delete PR.KeyQ; }
  if (showQuest) { questKeys(); return; }

  if (PR.KeyN) { showCapModal = !showCapModal; delete PR.KeyN; }
  if (showCapModal) {
    if (PR.Escape) { showCapModal = false; delete PR.Escape; }
    else capKeys();
    return;
  }

  if (PR.KeyC) { showChar = !showChar; delete PR.KeyC }
  if (showChar) { if (PR.Escape) { showChar = false; delete PR.Escape } return }

  if (PR.KeyP && (G === 'vil' || G === 'room') && !S.eqCap && !inForm() && P.st !== 'trans' && P.st !== 'trans_ryuki') {
    delete PR.KeyP;
    const mdur = malayaTransDur();
    Object.assign(P, { vx: 0, st: 'trans', t: 0, tdur: mdur, inv: mdur + .5, hit: {} });
    playMalayaHenshin();
  }
  if (PR.KeyP) { triggerRyukiTransform(); delete PR.KeyP }

  if (P.st === 'trans' && (G === 'vil' || G === 'room')) {
    P.vx = 0; P.t += dt; P.inv = 1;
    updMalayaTrans(dt);
    if (P.t > (P.tdur || malayaTransDur()) || PR.Enter || PR.Space || PR.Escape) {
      delete PR.Enter; delete PR.Space; delete PR.Escape;
      stopMalayaHenshin();
      P.st = 'idle'; P.t = 0; P.inv = .5; P.hit = {};
    }
    return;
  }

  if (P.st !== 'trans_ryuki') { 
    stopFaizHenshin(); stopRyukiHenshin(); stopBladeHenshin(); 
    if (typeof stopZeztzHenshin === 'function') stopZeztzHenshin();
  }
  if (P.st !== 'fv') { stopAllRyukiFVSounds(); }

  if (P.st === 'trans_ryuki') {
    P.vx = 0; P.t += dt; P.inv = 1;
    const is5 = P.trk === '555', isB = P.trk === 'blade', isZ = P.trk === 'zeztz';
    if (isZ && typeof zeztzSyncT === 'function') { P.t = zeztzSyncT(P.t); updZeztzTrans(dt); }
    else if (isB) { P.t = bladeSyncT(P.t); updBladeTrans(); }
    else if (!is5 && !isB && !isZ) updHenshin(dt);
    else updHenshin(dt);

    const tdur = P.tdur || 16 * 0.12;
    if (P.t > tdur) {
      P.st = 'idle'; P.k5 = is5; P.bl = isB; P.zeztz = isZ; P.ryuki = !is5 && !isB && !isZ; P.inv = .6; calc();
    }
    return;
  }

  if (G === 'title') {
    if (PR.Enter || PR.Space) {
      delete PR.Enter;
      delete PR.Space;
      if (typeof titleStart === 'function') {
        titleStart();
      } else {
        toVil();
      }
    }
    return;
  }
  if (G === 'vil' || G === 'room') return vupd(dt);

  if ((G === 'win' || G === 'over') && ST[cur].wb && WB_RES) {
    WB_RES.t += dt;
    if (WB_RES.t < 0.8 && (PR.Enter || PR.Space || PR.KeyR || PR.Escape || PR.KeyC)) {
      WB_RES.t = 1.0;
      delete PR.Enter; delete PR.Space; delete PR.KeyR; delete PR.Escape; delete PR.KeyC;
      return;
    }
    if (PR.Enter || PR.Space || PR.KeyR) {
      delete PR.Enter; delete PR.Space; delete PR.KeyR;
      wbRetry();
      return;
    }
    if (PR.KeyC) {
      delete PR.KeyC;
      showChar = true;
      return;
    }
    if (PR.Escape) {
      delete PR.Escape;
      toVil('st');
      return;
    }
    return;
  }

  if (P.st === 'trans_malaya') {
    P.vx = 0;
    P.t += dt;
    P.inv = 1;
    updMalayaTrans(dt);
    if (P.t > (P.tdur || MALAYA_AUDIO_LEN)) {
      P.st = 'idle';
      P.inv = 0.6;
      calc();
    }
    return;
  }

  if (G === 'over' && LOSE_RES) {
    LOSE_RES.t += dt;
    if (LOSE_RES.t < 0.8 && (PR.Enter || PR.Space || PR.KeyR || PR.Escape || PR.KeyC)) {
      LOSE_RES.t = 1.0;
      delete PR.Enter; delete PR.Space; delete PR.KeyR; delete PR.Escape; delete PR.KeyC;
      return;
    }
    if (PR.Enter || PR.Space || PR.KeyR) {
      delete PR.Enter; delete PR.Space; delete PR.KeyR;
      settleAct('retry');
      return;
    }
    if (PR.KeyC) {
      delete PR.KeyC;
      showChar = true;
      return;
    }
    if (PR.Escape) {
      delete PR.Escape;
      toVil('st');
      return;
    }
    return;
  }

  if (G === 'win' && WIN_RES) {
    WIN_RES.t += dt;
    if (WIN_RES.t < 0.8 && (PR.Enter || PR.Space || PR.KeyR || PR.Escape)) {
      WIN_RES.t = 1.0;
      delete PR.Enter; delete PR.Space; delete PR.KeyR; delete PR.Escape;
      return;
    }
    if (PR.Enter || PR.Space) {
      delete PR.Enter; delete PR.Space;
      settleAct('next');
      return;
    }
    if (PR.KeyR) {
      delete PR.KeyR;
      settleAct('retry');
      return;
    }
    if (PR.Escape) {
      delete PR.Escape;
      toVil('st');
      return;
    }
    return;
  }
  if (G !== 'play') return;
  if (P.st === 'trans') {
    P.vx = 0;
    P.t += dt;
    P.inv = 1;
    updMalayaTrans(dt);
    const dur = P.tdur || malayaTransDur();
    if (P.t > dur || PR.Enter || PR.Space) {
      stopMalayaHenshin();
      P.st = 'idle';
      P.t = 0;
      P.inv = 0.5;
    }
    return;
  }
  stageT += dt;
  if (PR.Escape) {
    if (ST[cur].wb) { WBR = 'retreat'; return fin(0) }
    if (typeof coopEscGuard === 'function' && !coopEscGuard()) return;
    S.g += RG; psGold(RG); save(); return toVil('st');
  }

  if (P.down || COOP.channeling) {
    for (const k of ['KeyJ', 'KeyK', 'KeyL', 'KeyE', 'KeyP', 'Space', 'KeyW', 'ArrowUp', 'ShiftLeft', 'ShiftRight', 'Digit1', 'Digit2']) delete PR[k];
    P.shDown = false; P.shT = 0; P.vx = 0;
    if (P.down) { P.inv = 0; P.st = (P.y < GY) ? 'air' : 'idle'; }
  }
  if (PR.Digit1 && S.hp > 0 && P.hp < P.mh) { S.hp--; P.hp = Math.min(P.mh, P.hp + P.mh * .5); DT.push({ x: P.x, y: P.y - 180, s: '+HP', t: .8, c: '#7dff9a' }) }
  if (PR.Digit2 && S.mp > 0 && P.mp < P.mm) { S.mp--; P.mp = Math.min(P.mm, P.mp + P.mm * .6); DT.push({ x: P.x, y: P.y - 180, s: '+MP', t: .8, c: '#6ab0ff' }) }
  for (const k in P.cd) {
    if (P.cd[k] > 0) P.cd[k] = Math.max(0, P.cd[k] - dt);
  }
  P.inv -= dt; P.land -= dt; P.dcd -= dt; P.gt -= dt; P.mp = Math.min(P.mm, P.mp + 3 * dt);

  // ★ 优化1：战斗中按下 Shift 瞬间立刻触发闪避，支持普攻/技能后摇打断与迎弹穿梭！
  const sh = K.ShiftLeft || K.ShiftRight;
  const shPress = PR.ShiftLeft || PR.ShiftRight;

  if (shPress && P.dcd <= 0 && !P.exh && P.sta > 10 && /^(idle|run|air|atk|thr)$/.test(P.st)) {
    const dd = ((K.KeyD || K.ArrowRight) ? 1 : 0) - ((K.KeyA || K.ArrowLeft) ? 1 : 0);
    P.f = dd || P.f;
    P.st = 'dodge';
    P.t = 0;
    P.dcd = DODGE_CD;
    P.inv = Math.max(P.inv, 0.45);
    P.vy = 0;
    P.vx = P.f * 1200; // 初速爆发
    P.h = 0;
    P.sta = Math.max(0, P.sta - 12);
    cancelEP(P.x - 70, P.x + 70); // 起步消弹
  }
  P.spr = false;

  const lk = P.down || COOP.channeling;
  const fr = P.st === 'idle' || P.st === 'run' || P.st === 'air', l = !lk && (K.KeyA || K.ArrowLeft), r = !lk && (K.KeyD || K.ArrowRight), gr = P.y >= GY;
  if (fr) {
    const d = (r ? 1 : 0) - (l ? 1 : 0);
    let spd = (240 + S.lv * 4) * formSpd() * (1 + (typeof affixTotal === 'function' ? affixTotal('spd') : 0));   // 移速词条在副本里也生效
    if (P.slow > 0) spd *= .55;
    if (sh && d && !P.exh && P.sta > 0) { spd *= 1.7; P.spr = true }
    P.vx = d * spd;
    if (d) P.f = d;

    if ((PR.Space || PR.KeyW || PR.ArrowUp) && gr) {
      P.vy = -700;
      P.st = 'air';
    }

    // ===== 1. 在按键触发区域替换原本的 PR.KeyJ 判定 =====
    if (PR.KeyJ) {
      const isUp = K.KeyW || K.ArrowUp;
      const isDown = K.KeyS || K.ArrowDown;
      const gr = P.y >= GY;

      if (gr && isUp) {
        // 【派生 1：升龙击 Rising Slash】地面按 W + J
        P.st = 'uppercut';
        P.t = 0;
        P.h = 0;
        P.vy = -750; // 自身拔地而起腾空
        P.vx = P.f * 120;
        DT.push({ x: P.x, y: P.y - 180, s: 'RISING SLASH!', t: 0.8, c: '#00e5ff' });
        shake = Math.max(shake, 6);
      } else if (!gr && isDown) {
        // 【派生 2：空中下砸 Dive Slam】空中按 S + J
        P.st = 'diveslam';
        P.t = 0;
        P.h = 0;
        P.vy = 1250; // 极速向下扎刺
        P.vx = P.f * 450;
        cancelEP(P.x - 70, P.x + 70);
        DT.push({ x: P.x, y: P.y - 180, s: 'DIVE SLAM!', t: 0.8, c: '#ffd84a' });
      } else {
        // 常规地面 / 空中普通斩击
        P.st = 'atk'; P.t = 0; P.h = 0;
        if (!gr) P.vy = Math.min(P.vy * 0.4, 60);
      }
    }
    else if (PR.KeyK && P.mp >= 120 && (P.cd.k || 0) <= 0) {
      P.mp -= 120;
      P.cd.k = getSkillCD('k');
      P.maxCd.k = P.cd.k;
      P.st = 'fv'; P.t = 0; P.hit = {}; P.h = 0; delete P.landT;
      if (P.ryuki) playRyukiFV();
    }
    else if (PR.KeyL && P.mp >= 20 && (P.cd.l || 0) <= 0) {
      P.mp -= 20;
      P.cd.l = getSkillCD('l');
      P.maxCd.l = P.cd.l;
      P.st = 'thr'; P.t = 0; P.h = 0;
      if (!gr) P.vy = Math.min(P.vy * 0.5, 60);
    }
    else if (PR.KeyE && P.mp >= 70 && (P.cd.e || 0) <= 0) {
      P.mp -= 70;
      P.cd.e = getSkillCD('e');
      P.maxCd.e = P.cd.e;
      spawnBike();
    }
  }

  if (P.spr) {
    P.sta = Math.max(0, P.sta - 30 * dt);
    P.sreg = .8;
    if (P.sta <= 0 && !P.exh) {
      P.exh = true;
      DT.push({ x: P.x, y: P.y - 180, s: '能量耗尽！', t: .9, c: '#ff8a4a' });
    }
  } else {
    P.sreg -= dt;
    if (P.sreg <= 0) P.sta = Math.min(P.stm, P.sta + (P.exh ? 14 : 26) * dt);
  }
  if (P.exh && P.sta >= P.stm * .3) P.exh = false;

  if ((P.st === 'dodge' || P.spr || (P.st === 'fv' && P.ryuki && P.t >= RYUKI_FV.dive && P.y < GY) || (P.st === 'fv' && P.k5 && P.t >= FAIZ_FV.dive && P.y < GY) || (P.st === 'fv' && P.bl && P.t >= BLADE_FV.dive && P.y < GY)) && P.gt <= 0) {
    P.gt = .038;
    GH.push({ x: P.x, y: P.y, f: P.f, st: P.st, t: .32, d: .32 });
  }

  P.t += dt;
  if (P.st === 'atk') {
    const i = P.t * 14 | 0;
    if (P.y < GY) {
      const d = (K.KeyD || K.ArrowRight ? 1 : 0) - ((K.KeyA || K.ArrowLeft) ? 1 : 0);
      if (d) { P.vx = d * (180 + S.lv * 2); P.f = d; }
    } else {
      P.vx = P.f * 40;
    }

    const a = P.x + P.f * 10, b = P.x + P.f * ATK_REACH;
    const xLeft = Math.min(a, b), xRight = Math.max(a, b);

    if (i >= 1 && i <= 6) {
      cancelEP(xLeft, xRight);
    }

    for (const q of [2, 4]) if (i >= q && !(P.h >> q & 1)) {
      P.h |= 1 << q; 
      if (q === 2) playSwordHit();
      area(xLeft, xRight, P.atk * (q == 2 ? 1.2 : 1));
    }
    if (P.t > .5) P.st = (P.y < GY) ? 'air' : 'idle';
  }
  // ===== 2. 在主状态机中加入派生招式的帧逻辑更新 =====
  else if (P.st === 'uppercut') {
    cancelEP(P.x - 60, P.x + 60);
    if (!P.h && P.t >= 0.08) {
      P.h = 1;
      playSwordHit();
      const hitX0 = Math.min(P.x, P.x + P.f * 180);
      const hitX1 = Math.max(P.x, P.x + P.f * 180);
      knockupEnemies(hitX0, hitX1, P.atk * 1.5, -720); // 挑飞击退敌人
      FX.push({ type: 'boom', x: P.x + P.f * 40, y: P.y - 120, t: 0.3, d: 0.3, r: 80, c: '#00e5ff' });
    }
    // 动作持续时间结束后，转为空中自由落体或待机
    if (P.t > 0.42) {
      P.st = P.y < GY ? 'air' : 'idle';
    }
  }
  else if (P.st === 'diveslam') {
    P.inv = Math.max(P.inv, 0.2); // 俯冲下砸期间附带短暂免伤霸体
    cancelEP(P.x - 80, P.x + 80);
    
    // 沿途向下贯穿触碰到的敌人
    slamDownEnemies(P.x - 70, P.x + 70, P.atk * 1.2);
    
    // 拖尾残影
    if (P.gt <= 0) {
      P.gt = 0.03;
      GH.push({ x: P.x, y: P.y, f: P.f, st: 'diveslam', t: 0.25, d: 0.25 });
    }

    // 落地瞬间触发大范围震荡与地面爆炸
    if (P.y >= GY) {
      P.y = GY;
      P.vy = 0;
      P.vx = 0;
      P.st = 'idle';
      P.land = 0.18; // 落地硬直
      shake = 22; // 强力震屏
      
      // 产生地面范围震荡波伤害
      area(P.x - 220, P.x + 220, P.atk * 2.2);
      FX.push({ type: 'boom', x: P.x, y: GY - 20, t: 0.5, d: 0.5, r: 240, c: '#ffd84a' });
      FX.push({ type: 'malaya_kick_blast', x: P.x, y: GY - 10, t: 0.4, d: 0.4, r: 160 });
      DT.push({ x: P.x, y: GY - 120, s: 'CRASH IMPACT!', t: 1.0, c: '#ffd84a' });
    }
  }
  else if (P.st === 'thr') {
    if (P.y >= GY) P.vx = 0;
    if (P.t >= (P.bl ? BLADE_L.fireT : .12) && !P.h) {
      P.h = 1;
      if (P.zeztz && typeof fireZeztzWave === 'function') fireZeztzWave();
      else if (P.bl) fireBlade();
      else if (P.k5) fireFaiz();
      else if (P.ryuki) fireRyukiGun();
      else PJ.push({ x: P.x + P.f * 60, y: P.y - 100, vx: P.f * 800, f: P.f, t: 1.1, h: {} });
    }
    if (P.t > (P.bl ? BLADE_L.dur : .3)) P.st = (P.y < GY) ? 'air' : 'idle';
  }
  else if (P.st === 'fv') {
    P.inv = 1;
    if (P.zeztz && typeof updZeztzFV === 'function') {
      updZeztzFV(dt);
    } else if (P.ryuki) {
      updRyukiFV(dt);
    } else if (P.k5) {
      updFaizFV(dt);
    } else if (P.bl) {
      updBladeFV(dt);
    } else {
      const i = P.t / .11 | 0;
      if (P.t < .99 && i >= 4) {
        P.vx = P.f * 700;
        area(P.x + P.f * 40 - 90, P.x + P.f * 40 + 90, P.atk * 3, P.hit);
      }
      if (P.t >= 1 && !P.h) {
        P.h = 1; shake = 18;
        area(P.x - 320, P.x + 320, P.atk * 3);
        FX.push({ type: 'malaya_kick_blast', x: P.x + P.f * 80, y: P.y - 80, t: .5, d: .5, r: 160 });
      }
      if (P.t > 1.5) {
        P.st = (P.y < GY) ? 'air' : 'idle';
        P.inv = .3;
      }
    }
  }
  else if (P.st === 'dash') {
    P.inv = 1;
    P.vx = P.f * 950;
    if (P.t % .3 < dt) P.hit = {};
    area(P.x - 90, P.x + 90, P.atk * 1.4, P.hit);
    if (P.t > 2) { P.st = (P.y < GY) ? 'air' : 'idle'; P.inv = .5; }
  }
  // ★ 优化2：战斗中闪避的位移阻尼与全程消弹穿透判定
  else if (P.st === 'dodge') {
    P.inv = Math.max(P.inv, 0.45);
    P.vx = P.f * 1200 * Math.max(0, 1 - (P.t / 0.36) * 0.65);
    cancelEP(P.x - 80, P.x + 80); // 穿梭消弹
    if (P.t >= 0.36) { 
      P.st = (P.y < GY) ? 'air' : 'idle'; 
      P.vx = 0; 
      P.inv = Math.max(P.inv, 0.15); 
    }
  }

  if (typeof updZeztzWaves === 'function') updZeztzWaves(dt);

  const applyGravity = P.st !== 'dash' && P.st !== 'dodge' && !(P.st === 'fv' && (P.ryuki || P.k5 || P.bl || P.zeztz));
  if (applyGravity) {
    const gMul = (P.st === 'atk' || P.st === 'thr') ? 0.65 : 1.0;
    P.vy += 1900 * gMul * dt;
    P.y += P.vy * dt;
    if (P.y >= GY) {
      P.y = GY;
      if (P.st === 'air') { P.st = 'idle'; P.land = .12; }
      P.vy = 0;
    } else if (P.st === 'idle' || P.st === 'run') {
      P.st = 'air';
    }
  }

  P.x = cl(P.x + P.vx * dt, 30, WW - 30);
  if (P.st === 'idle' || P.st === 'run') {
    P.st = P.vx ? 'run' : 'idle';
  }
  cam = cl(P.x - 480, 0, WW - 960);

  const z = ST[cur];
  if (z.wb) { WBT -= dt; if (WBT <= 0) { WBT = 0; WBR = 'time'; return fin(0) } }
  const coopGuest = typeof coopIsGuest === 'function' && coopIsGuest();
  sp -= dt;
  if (!coopGuest && sp <= 0 && !bs) {
    const set = z.set;
    sp = Math.max(.8, 1.7 - set * .08) + Math.random() * .5;
    const cap = 4 + Math.ceil(set * .8) + Math.min(2, S.lv >> 5);
    const alive = E.filter(e => e.t !== 'boss').length;
    const need = z.k - kills - alive;
    let n = 1 + (Math.random() < .35 + set * .04 ? 1 : 0) + (set >= 4 && Math.random() < .25 ? 1 : 0);
    n = Math.min(n, cap - E.length, need);
    for (let i = 0; i < n; i++) spawn(kills >= 2 && Math.random() < z.wd ? 'wd' : 'imp');
  }
  if (!coopGuest && !z.b && kills >= z.k) return fin(1);
  if (!coopGuest && z.b && kills >= z.k && !bs) {
    bs = 1; spawn('boss');
    DT.push({ x: P.x, y: P.y - 240, s: 'BOSS 出现！', t: 2, c: '#ff8a4a' });
  }

  for (const e of E) {
    if (coopGuest) {
      const ox = e.x, oy = e.y, d0 = e.dsh > 0;
      updEnemy(e, dt);
      if (!d0 && !(e.dsh > 0)) { e.x = ox; e.y = oy; }
    } else updEnemy(e, dt);
  }
  E = E.filter(e => !e.dead);
  updBattleFx(dt);
  updBikes(dt);

  for (const s of PJ) {
    s.x += s.vx * dt; if (s.vy) s.y += s.vy * dt; s.t -= dt;
    if (s.vis) continue;
    for (const e of E) {
      if (s.h[e.id]) continue;
      const hit = (s.b5 || s.rb)
        ? (Math.abs(e.x - s.x) < e.w / 2 + 30 && s.y > e.y - e.h - 25 && s.y < e.y + 10)
        : (Math.abs(e.x - s.x) < e.w / 2 + 40 && e.y > s.y - 30 && e.y - e.h < s.y + 30);
      if (hit) {
        s.h[e.id] = 1; hurt(e, P.atk * (s.b5 ? 1.5 : s.rb ? 1.8 : 1.6));
        if (s.b5) FX.push({ type: 'boom', x: s.x, y: s.y, t: .18, d: .18, r: 36, c: '#ffcf5a' });
        if (s.rb) FX.push({ type: 'boom', x: s.x, y: s.y, t: .24, d: .24, r: 52, c: '#ff6a20' });
      }
    }
  }
  PJ = PJ.filter(s => s.t > 0);
  updBladeBolts(dt);

  for (const o of OR) {
    if (!P.down && Math.abs(o.x - P.x) < 45) {
      o.g = 1;
      if (o.k === 'h') { const hv = Math.max(1, Math.round(P.mh * .1)); P.hp = Math.min(P.mh, P.hp + hv); DT.push({ x: P.x, y: P.y - 200, s: '+' + hv, t: .8, c: '#7dff9a' }); }
      else P.mp = Math.min(P.mm, P.mp + 30);
    }
  }
  OR = OR.filter(o => !o.g);
}

// ===== 加载界面 =====
function drawLoadCover() {
  const now = performance.now() / 1000, dt = Math.min(.1, Math.max(0, now - (LD.last || now))); LD.last = now;
  const target = Math.min(.97, LD.done / LD.est);
  LD.shown += (target - LD.shown) * Math.min(1, dt * 6);
  const p = cl(LD.shown, 0, 1);

  ctx.drawImage(COVER_IMG, 0, 0, 960, 540);
  const grad = ctx.createLinearGradient(0, 420, 0, 540);
  grad.addColorStop(0, 'rgba(8, 6, 12, 0)'); grad.addColorStop(1, 'rgba(8, 6, 12, 0.88)');
  ctx.fillStyle = grad; ctx.fillRect(0, 420, 960, 120);

  const bw = 320, bh = 42, bx = (960 - bw) / 2, by = 445;
  rpath(bx, by, bw, bh, 8); ctx.fillStyle = 'rgba(10, 16, 28, 0.82)'; ctx.fill();
  ctx.save();
  rpath(bx, by, bw, bh, 8); ctx.clip();
  const fw = bw * p;
  const fg = ctx.createLinearGradient(bx, 0, bx + bw, 0); fg.addColorStop(0, 'rgba(0,150,200,.55)'); fg.addColorStop(1, 'rgba(0,229,255,.75)');
  ctx.fillStyle = fg; ctx.fillRect(bx, by, fw, bh);
  if (fw > 2) { const hg = ctx.createLinearGradient(bx + fw - 24, 0, bx + fw, 0); hg.addColorStop(0, 'rgba(255,255,255,0)'); hg.addColorStop(1, 'rgba(255,255,255,.55)'); ctx.fillStyle = hg; ctx.fillRect(bx + fw - 24, by, 24, bh); }
  ctx.restore();
  rpath(bx, by, bw, bh, 8); ctx.strokeStyle = 'rgba(0, 229, 255, .85)'; ctx.lineWidth = 1.8; ctx.stroke();
  txt('加载中 ' + Math.round(p * 100) + '%', 480, by + bh / 2, 16, '#ffffff', 'center');
  txt(msg, 480, by + bh + 16, 11.5, 'rgba(255,255,255,0.6)', 'center');
}

// ===== 主渲染管线 =====
function draw() {
  ctx.save();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#08060c'; ctx.fillRect(0, 0, 960, 540);

  if (G === 'load' && COVER_IMG) { drawLoadCover(); ctx.restore(); return }
  if (G === 'load' || G === 'err') { txt(msg, 480, 270, G === 'err' ? 16 : 20, G === 'err' ? '#ff7675' : '#fff', 'center'); ctx.restore(); return }
  if (G === 'title') {
    if (COVER_IMG) {
      ctx.drawImage(COVER_IMG, 0, 0, 960, 540);
      const grad = ctx.createLinearGradient(0, 420, 0, 540);
      grad.addColorStop(0, 'rgba(8, 6, 12, 0)');
      grad.addColorStop(1, 'rgba(8, 6, 12, 0.88)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 420, 960, 120);

      const pulse = 0.65 + Math.sin(T * 4) * 0.35;
      const bw = 320, bh = 42, bx = (960 - bw) / 2, by = 445;
      rpath(bx, by, bw, bh, 8);
      ctx.fillStyle = `rgba(10, 16, 28, ${0.75 + pulse * 0.15})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(0, 229, 255, ${pulse})`;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      const enterText = TOUCH ? '点击屏幕 开始游戏' : '按 Enter / 空格 进入基地';
      txt(enterText, 480, by + bh / 2, 16, '#00e5ff', 'center');
      if (typeof authTitleHint === 'function' && authTitleHint()) {
        txt(authTitleHint(), 480, by - 14, 13, '#7dff9a', 'center');
        txt('切换账号', 865, 512, 12, '#ff9aa4', 'center');
      }
      txt('战役出征 · 收集神话装备 · 强化研磨 · 契约变身', 480, 512, 12, 'rgba(255,255,255,0.7)', 'center');
    } else {
      bg(); dr(SH.atk, 12, 480, GY, 1, 1.3);
      txt('假面骑士 MALAYA', 480, 105, 48, '#f3c94a', 'center');
      txt('按 Enter 进入基地', 480, 165, 20, '#fff', 'center');
      txt('战役出征 → 收集神话装备 → 强化升级 → 扭蛋变身龙骑', 480, 210, 14, '#ccc', 'center');
      ENL.forEach((c, i) => { const k = Math.min(60 / c.width, 60 / c.height); ctx.drawImage(c, 20 + i * 70, 440, c.width * k, c.height * k); txt(i, 20 + i * 70, 438, 12, '#ff0') });
    }

    if (miss.length) txt('未找到素材：' + miss.join(', ') + '（已启用替代图形）', 480, 526, 12, '#ff7675', 'center');
    ctx.restore(); return;
  }

  if (G === 'td') { tdDraw(); ctx.restore(); return; }   // ★ 塔防

  if (G === 'vil' || G === 'room') {
    drawW();
    if (gachaModal) drawGachaModalOverlay();
    if (showChar) drawCharPanel();
    if (showCapModal) drawCapsuleModal();
    if (showStat) drawStatModal();
    if (showQuest) drawQuestModal();
    drawQuestToast(); drawCloudHint();
    if (LV_POP) drawLevelUpBanner();
    ctx.restore(); return;
  }

  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
  bg();

  for (const o of OR) { ctx.fillStyle = o.k === 'h' ? '#ff4a5a' : '#4ab0ff'; ctx.beginPath(); ctx.arc(o.x - cam, GY - 14 + Math.sin(T * 5) * 3, 9, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke() }
  for (const e of E) drawDashWarn(e);
  for (const e of E) {
    ctx.save(); ctx.translate(sn(e.x - cam), sn(e.y)); ctx.scale(e.fc * e.s, e.s); if (e.fl > 0) ctx.filter = 'brightness(2.5)'; else if (e.wu > 0 && (T * 16 | 0) % 2) ctx.filter = 'brightness(1.8) saturate(1.7)'; ctx.drawImage(e.im, -e.im.width / 2, -e.im.height); ctx.restore();
    if (e.wu > 0) txt('!', e.x - cam, e.y - e.h - 26 - Math.abs(Math.sin(T * 10)) * 6, e.t === 'boss' ? 34 : 24, '#ff3838', 'center');
    if (e.t !== 'boss') drawEnemyBar(e)
  }
  drawHZ();
  drawEP();
  for (const s of PJ) {
    if (s.b5) { drawBullet5(s); continue }
    if (s.rb) { drawBulletR(s); continue }
    if (s.ry) { drawRyukiSword(s); continue }
    dr(SH.sword, 0, s.x - cam, s.y, -s.f, 1, 1, 1);
  }

  drawFaizMark();
  drawBladeMark();
  drawRyukiMark();
  if (typeof drawZeztzMark === 'function') drawZeztzMark();
  drawBikes();
  drawP();
  if (typeof drawZeztzEnergyWaves === 'function') drawZeztzEnergyWaves();
  if (typeof drawCoopP2 === 'function') drawCoopP2();
  drawBladeBolts();

  for (const f of FX) {
    const p = f.t / f.d;
    ctx.save();
    const expImg = EF_IMGS['explosion'];

    if (f.type === 'malaya_kick_blast') {
      ctx.beginPath(); ctx.arc(f.x - cam, f.y, (1 - p) * f.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 229, 255, ${p})`; ctx.lineWidth = 6 * p;
      ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 18; ctx.stroke();
    } else if (f.type === 'boom' || f.type === 'boss_death_blast') {
      if (expImg) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(1, p * 1.2);
        const curR = f.r * (0.6 + (1 - p) * 0.8);
        ctx.drawImage(expImg, f.x - cam - curR, f.y - curR, curR * 2, curR * 2);
      } else {
        ctx.beginPath(); ctx.arc(f.x - cam, f.y, (1 - p) * f.r, 0, Math.PI * 2);
        ctx.strokeStyle = f.c || '#ffd84a'; ctx.globalAlpha = p; ctx.lineWidth = 5 * p + 1;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  for (const d of DT) txt(d.s, d.x - cam, d.y - (1 - d.t) * 40, String(d.s).length > 4 ? 22 : 18, d.c, 'center');
  ctx.restore();

  drawPlayerHUD(16, 14); drawStaminaHUD(16, 96); drawGoldHUD(); drawMinimapHUD(); drawLocationHUD(ST[cur].n);
  drawSkillBarHUD();
  drawInfoHUD();

  const henshinPrompt = inForm() ? '[P] 解除变身' : (S.eqCap ? '[P] ' + capShort() + '变身' : '[P] 变身');
  hintLine('J 剑击   L ' + lSkillName() + '   K 终结技   E 机车   Shift 闪避/疾跑   ' + henshinPrompt + '   [C] 背包   [N] 胶囊   Esc 撤退');

  const b = E.find(e => e.t === 'boss');
  if (b) {
    drawBossBar(b, ST[cur].bn || '强敌 BOSS');
  }
  
  if ((G === 'over' || G === 'win') && ST[cur].wb) {
    drawWBSettlement();
  } else if (G === 'over') {
    drawLoseSettlement();
  } else if (G === 'win') {
    drawWinSettlement();
  }
  if (typeof drawCoopOverlay === 'function') drawCoopOverlay();

  if (gachaModal) drawGachaModalOverlay();
  if (showChar) drawCharPanel();
  if (showCapModal) drawCapsuleModal();
  if (showStat) drawStatModal();
  if (showQuest) drawQuestModal();
  drawQuestToast(); drawCloudHint();
  
  if (LV_POP) drawLevelUpBanner();

  ctx.restore();
}

let last = performance.now();
(function loop(n) {
  const dt = Math.min(.05, (n - last) / 1000);
  last = n;
  try {
    upd(dt);
    draw();
  } catch (err) {
    console.error('[game loop error]', err);
    try {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(0, 0, 960, 540);
      ctx.fillStyle = '#ff6b6b'; ctx.font = '13px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      const m = String(err && err.stack || err).split('\n');
      ctx.fillText(m[0].slice(0, 120), 8, 6); ctx.fillText((m[1] || '').trim().slice(0, 120), 8, 22); ctx.fillText((m[2] || '').trim().slice(0, 120), 8, 38);
    } catch (_) { }
  }
  for (const k in PR) delete PR[k];
  requestAnimationFrame(loop);
})(last);

addEventListener('keydown', e => { if (!K[e.code]) PR[e.code] = 1; K[e.code] = 1; if (/Space|Arrow/.test(e.code)) e.preventDefault() });
addEventListener('keyup', e => K[e.code] = 0);
addEventListener('blur', () => { for (const k in K) K[k] = 0 });

(function () {
  const MAP = [
    ['按 Enter 进入基地', '点击屏幕进入基地'], ['按 Enter 回村', '点击屏幕回村'], ['按 Enter 前往下一战役', '点击屏幕出征'], ['确定 [Enter / 空格]', '点击任意处确定'],
    ['[F] ', '[✔] '], ['W/S 选择    Enter/F 确认    Esc 关闭', '点条目选择 · 再点一次确认 · 点面板外关闭'],
    ['[1]×', '①×'], ['[2]×', '②×'], ['按P变身', '点「变身」键'], ['按 P 变身', '点「变身」键'], ['[P] ', '「变身」'], ['点击回车装备', '点击装备']
  ];
  const _txt = txt;
  txt = function (s, ...a) {
    s = String(s);
    if (s.startsWith('A/D 移动') || s.startsWith('J 剑击')) s = '';
    else for (const [m, r] of MAP) if (s.includes(m)) s = s.split(m).join(r);
    return _txt(s, ...a);
  };

  const press = c => { if (!K[c]) PR[c] = 1; K[c] = 1 }, rel = c => { K[c] = 0 };
  let lastEsc = 0;

  const R0 = 'max(3vmin, env(safe-area-inset-right, 0px))', B0 = 'max(3vmin, env(safe-area-inset-bottom, 0px))', L0 = 'max(2vmin, env(safe-area-inset-left, 0px))';
  const f3 = n => +n.toFixed(3);
  const arc = (r, deg, z = 1) => {
    const a = deg * Math.PI / 180;
    return `right:calc(${R0} + var(--s)*${f3(.75 + r * Math.cos(a) - z / 2)});bottom:calc(${B0} + var(--s)*${f3(.75 + r * Math.sin(a) - z / 2)})`;
  };
  const atkCodes = () => (G === 'play' && !showChar && !showCapModal) ? ((typeof coopCanRescue === 'function' && coopCanRescue()) ? ['KeyF'] : ['KeyJ']) : ['KeyF', 'Enter'];
  
  const BTN = [
    { id: 'atk', t: '剑击', c: 'atk', pos: `right:${R0};bottom:${B0}`, codes: atkCodes, ctx: 'b' },
    { id: 'dg', t: '闪避', c: 'dg', pos: arc(1.55, 0), codes: ['ShiftLeft'], ctx: 'b' },
    { id: 'jmp', t: '跳', c: 'jmp', pos: arc(1.55, 45), codes: ['Space'], ctx: 'b' },
    { id: 'p', t: '变身', c: 'trf', pos: arc(1.55, 90), codes: ['KeyP'], ctx: 'b' },
    { id: 'e', t: '机车', c: 'skl sk-e', pos: arc(2.7, 10), codes: ['KeyE'], ctx: 'p', mp: 70 },
    { id: 'l', t: '飞剑', c: 'skl sk-l', pos: arc(2.7, 38), codes: ['KeyL'], ctx: 'p', mp: 20 },
    { id: 'k', t: '终结技', c: 'skl ult', pos: arc(2.7, 66), codes: ['KeyK'], ctx: 'p', mp: 120 },
    { id: 'more', t: '更多', c: 'sm sys', pos: `left:${L0};top:29%`, ctx: 'b', more: 1 },
    { id: 'hp', t: '药①', c: 'sm pot', pos: `left:${L0};top:calc(29% + var(--s)*1)`, codes: ['Digit1'], ctx: 'p' },
    { id: 'mpp', t: '药②', c: 'sm pot mpot', pos: `left:${L0};top:calc(29% + var(--s)*1.9)`, codes: ['Digit2'], ctx: 'p' }
  ];
  window.TC_POS = { R: arc(2.7, 92) };

  const ui = document.createElement('div'); ui.id = 'tc';
  const jz = document.createElement('div'); jz.id = 'joyz';
  const jh = document.createElement('div'); jh.id = 'joyh'; jh.innerHTML = '<i>◀</i><i>▶</i>';
  const jr = document.createElement('div'); jr.id = 'joy'; jr.innerHTML = '<i class=\"a l\">◀</i><i class=\"a r\">▶</i><i class=\"a u\">▲</i><b></b>';
  ui.appendChild(jz); ui.appendChild(jh); ui.appendChild(jr);

  let moreOpen = false;
  const warn = (o, s, c) => { const t = performance.now(); if (o.wt && t - o.wt < 600) return; o.wt = t; DT.push({ x: P.x, y: P.y - 190, s, t: .9, c: c || '#ffa502' }) };
  const tcWarn = o => {
    if (G !== 'play' && o.id !== 'p') return;
    const cdLeft = k => (P.cd[k] || 0), f1 = v => v.toFixed(1) + 's';
    if (o.id === 'dg') { if (P.exh) warn(o, '能量耗尽！', '#ff8a4a'); else if (P.dcd > 0) warn(o, '闪避冷却中 ' + f1(P.dcd)); }
    else if (o.id === 'p') { if (cdLeft('p') > 0) warn(o, '变身冷却中 ' + f1(cdLeft('p'))); }
    else if (o.id === 'l' || o.id === 'e' || o.id === 'k') {
      if (cdLeft(o.id) > 0) warn(o, o.tEl.textContent + '冷却中 ' + f1(cdLeft(o.id)));
      else if (P.mp < o.mp) warn(o, '蓝量不足', '#70a1ff');
    }
    else if (o.id === 'hp') { if (S.hp <= 0) warn(o, '没有生命药水了', '#ff7675'); else if (P.hp >= P.mh) warn(o, '生命已满', '#7dff9a'); }
    else if (o.id === 'mpp') { if (S.mp <= 0) warn(o, '没有蓝药水了', '#ff7675'); else if (P.mp >= P.mm) warn(o, '蓝量已满', '#7dff9a'); }
  };
  const bind = (b, codes, onDown, pre) => {
    let held = [];
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('on');
      if (pre) pre();
      if (onDown) return onDown();
      held = typeof codes === 'function' ? codes() : codes; held.forEach(press);
    });
    const up = () => { b.classList.remove('on'); held.forEach(rel); held = [] };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
  };
  const mk = (cls, pos, html) => { const b = document.createElement('div'); b.className = 'b ' + cls; b.style.cssText = pos; b.innerHTML = html; ui.appendChild(b); return b };
  for (const o of BTN) {
    o.el = mk(o.c, o.pos, '<span class="t">' + o.t + '</span><span class="cd"></span>' + '');
    o.tEl = o.el.querySelector('.t'); o.cdEl = o.el.querySelector('.cd'); o.nEl = o.el.querySelector('.n');
    bind(o.el, o.codes, o.more ? () => (moreOpen ? closeMore() : openMore()) : null, o.more ? null : () => tcWarn(o));
  }
  const byId = id => BTN.find(o => o.id === id);
  const navBtns = [
    mk('sm nav', `left:${L0};bottom:calc(var(--s)*1.1 + ${B0})`, '▲'), mk('sm nav', `left:${L0};bottom:${B0}`, '▼')
  ];
  bind(navBtns[0], ['KeyW']); bind(navBtns[1], ['KeyS']);
  const closeBtn = mk('sm sys cls', 'right:max(1.5vmin, env(safe-area-inset-right, 0px));top:1.5vmin', '✕');
  bind(closeBtn, ['Escape']);

  const css = document.createElement('style');
  css.textContent = `
    #tc .b{overflow:hidden}
    #tc .b .t{position:relative;z-index:1;pointer-events:none;display:flex;flex-direction:column;align-items:center}
    #tc .b .cd{position:absolute;inset:0;border-radius:50%;pointer-events:none;z-index:2}
    #tc .b .n{position:absolute;left:0;right:0;bottom:7%;z-index:3;font-style:normal;font-size:calc(var(--s)*.2);font-weight:700;color:#8fd0ff;pointer-events:none;text-shadow:0 1px 2px #000}
    #tc .b.pot .n{position:static;color:#fff}
    #tc .b.low{filter:grayscale(1) brightness(.7)}
    #tc .b.dg{background:rgba(30,150,90,.5);border-color:rgba(130,255,180,.85)}
    #tc .b.sk-l{background:rgba(30,130,200,.55);border-color:rgba(130,215,255,.95);box-shadow:0 0 10px rgba(80,190,255,.45)}
    #tc .b.sk-e{background:rgba(200,100,10,.55);border-color:rgba(255,190,100,.95);box-shadow:0 0 10px rgba(255,150,40,.45)}
    #tc .b.skl.ult{background:rgba(150,60,200,.55);border-color:rgba(230,170,255,.95);box-shadow:0 0 10px rgba(200,120,255,.5)}
    #tc .b.sk-r{background:rgba(190,150,10,.55);border-color:#ffe066;box-shadow:0 0 10px rgba(255,216,74,.5)}
    #tc .b.pot.mpot{background:rgba(30,80,190,.5);border-color:rgba(120,170,255,.85)}
    #tc .b.on{background:rgba(255,255,255,.35);border-color:#fff}
    #tc .b.cls{display:none;opacity:.85}
    #tc .b.sys .t{font-size:calc(var(--s)*.24)}
    #tcmore{display:none;position:absolute;pointer-events:auto;touch-action:none;box-sizing:border-box;
      padding:calc(var(--s)*.22);border:1.5px solid #00e5ff;border-radius:14px;
      background:linear-gradient(180deg,rgba(14,23,42,.96),rgba(6,10,20,.96));box-shadow:0 0 18px rgba(0,229,255,.35);
      grid-template-columns:repeat(3,calc(var(--s)*1.25));gap:calc(var(--s)*.18)}
    #tcmore.show{display:grid}
    #tcmore .tile{height:calc(var(--s)*1.05);border-radius:10px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);
      display:flex;flex-direction:column;align-items:center;justify-content:center;gap:calc(var(--s)*.06);color:#e2e8f0;
      font:700 calc(var(--s)*.22)/1 system-ui,sans-serif;touch-action:none;-webkit-tap-highlight-color:transparent}
    #tcmore .tile i{font-style:normal;font-size:calc(var(--s)*.42)}
    #tcmore .tile:active{transform:scale(.94);background:rgba(0,229,255,.22)}
    #tcmore .tile.warn{border-color:#ff4757;color:#ff8a95;background:rgba(255,71,87,.15)}`;
  document.head.appendChild(css);
  const mp = document.createElement('div'); mp.id = 'tcmore';
  mp.style.cssText = `left:calc(${L0} + var(--s)*1.0);top:29%`;
  ui.appendChild(mp);
  const mg = mp;
  const tap = (...codes) => () => { codes.forEach(press); setTimeout(() => codes.forEach(rel), 90) };
  const TILES = () => {
    const base = G === 'vil' || G === 'room', t = [
      { ic: '🎒', t: '背包', f: tap('KeyC') }, { ic: '💊', t: '胶囊', f: tap('KeyN') },
      { ic: '📜', t: '任务', f: tap('KeyQ') }, { ic: '📊', t: '战绩', f: tap('KeyI') }
    ];
    if (base && window.openSettings) t.push({ ic: '⚙', t: '设置', f: () => setTimeout(window.openSettings, 120) });
    if (document.documentElement.requestFullscreen) t.push({
      ic: '⛶', t: '全屏', f: () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => { })).catch(() => { }) }
    });
    if (G === 'play') t.push({ ic: '🚪', t: '撤退', warn: 1, f: tap('Escape') });
    return t;
  };
  function openMore() {
    mg.innerHTML = '';
    for (const o of TILES()) {
      const d = document.createElement('div'); d.className = 'tile'; d.innerHTML = '<i>' + o.ic + '</i>' + o.t;
      if (o.warn) d.classList.add('warn');
      d.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation();
        if (o.warn && !d.dataset.armed) {
          d.dataset.armed = 1; d.innerHTML = '<i>⚠</i>再点确认'; setTimeout(() => { if (d.isConnected) { delete d.dataset.armed; d.innerHTML = '<i>' + o.ic + '</i>' + o.t } }, 2000); return;
        }
        closeMore(); o.f();
      });
      mg.appendChild(d);
    }
    moreOpen = true; mp.classList.add('show');
  }
  function closeMore() { mp.classList.remove('show'); moreOpen = false }

  const overlayOn = () => ['auth-overlay', 'set-overlay'].some(id => { const e = document.getElementById(id); return e && e.classList.contains('show') });
  const tcPopup = () => !!(M || showChar || showCapModal || showStat || showQuest || gachaModal || overlayOn() || P.st === 'trans' || P.st === 'trans_ryuki');
  window.tcHidden = () => tcPopup();
  const setCd = (o, r) => { const v = r > 0 ? `conic-gradient(rgba(0,0,0,.62) ${(Math.min(1, r) * 360).toFixed(1)}deg, transparent 0)` : ''; if (o.cdv !== v) { o.cdv = v; o.cdEl.style.background = v } };
  const setT = (o, t) => { if (o.tEl.textContent !== t) o.tEl.textContent = t };
  setInterval(() => {
    const base = G === 'vil' || G === 'room', play = G === 'play', popup = tcPopup();
    const show = (base || play) && !popup;
    if (moreOpen && (!(base || play) || popup)) closeMore();
    for (const o of BTN) {
      const vis = show && (o.ctx === 'b' || (o.ctx === 'p' && play) || (o.ctx === 'v' && base));
      const d = vis ? 'flex' : 'none'; if (o.el.style.display !== d) o.el.style.display = d;
      if (!vis) continue;
      switch (o.id) {
        case 'atk': {
          const inBattle = play && !showChar && !showCapModal;
          const t = inBattle ? ((typeof coopCanRescue === 'function' && coopCanRescue()) ? '救援' : '剑击') : (typeof NR !== 'undefined' && NR) ? '互动' : '剑击';
          setT(o, t); o.el.classList.toggle('hot', t !== '剑击'); break;
        }
        case 'dg': setCd(o, P.dcd > 0 ? P.dcd / DODGE_CD : 0); o.el.style.borderColor = P.exh ? '#ff6b6b' : ''; break;
        case 'p': setT(o, inForm() ? '解除' : '变身'); setCd(o, (P.cd.p || 0) > 0 ? P.cd.p / (P.maxCd.p || 1) : 0); break;
        case 'l': case 'e': case 'k': {
          if (o.id === 'l') setT(o, lSkillName());
          setCd(o, (P.cd[o.id] || 0) > 0 ? P.cd[o.id] / (P.maxCd[o.id] || 1) : 0);
          o.el.classList.toggle('low', P.mp < o.mp); break;
        }
        case 'hp': case 'mpp': {
          const n = o.id === 'hp' ? S.hp : S.mp;
          const h = o.t + '<i class="n">×' + n + '</i>'; if (o.h !== h) { o.h = h; o.tEl.innerHTML = h }
          o.el.classList.toggle('low', n <= 0 || (o.id === 'hp' ? P.hp >= P.mh : P.mp >= P.mm)); break;
        }
      }
    }
    const scroll = !!M && !gachaModal && V.pg !== 'st' && MN.max > 0;
    navBtns.forEach(n => n.classList.toggle('show', scroll));
    closeBtn.style.display = (base || play) && !gachaModal && (showChar || showCapModal || showStat || showQuest || M) ? 'flex' : 'none';
  }, 50);

  if (TOUCH) document.body.appendChild(ui);

  const knob = jr.querySelector('b'), arL = jr.querySelector('.l'), arR = jr.querySelector('.r'), arU = jr.querySelector('.u');
  let jid = null, ox = 0, oy = 0, JR = 60, jl = false, jrt = false, ju = false;
  const joyOk = () => !M && !showChar && !showCapModal && !showStat && !showQuest && !gachaModal && (G === 'vil' || G === 'room' || (G === 'play' && P.st !== 'trans'));
  const joyStop = () => {
    if (jid !== null) { try { jz.releasePointerCapture(jid) } catch (_) { } }
    jid = null; jr.classList.remove('show'); rel('KeyA'); rel('KeyD'); rel('Space');
    jl = jrt = ju = false; [arL, arR, arU].forEach(a => a.classList.remove('on'));
  };
  const joyMove = e => {
    let dx = e.clientX - ox, dy = e.clientY - oy, d = Math.hypot(dx, dy);
    if (d > JR) {
      const k = (d - JR) / d; ox += dx * k; oy += dy * k;
      ox = cl(ox, JR + 4, innerWidth - JR - 4); oy = cl(oy, JR + 4, innerHeight - JR - 4);
      jr.style.left = ox + 'px'; jr.style.top = oy + 'px';
      dx = e.clientX - ox; dy = e.clientY - oy; d = Math.hypot(dx, dy);
    }
    const kk = d > JR ? JR / d : 1;
    knob.style.transform = 'translate(' + dx * kk + 'px,' + dy * kk + 'px)';
    const dz = JR * .3, l = dx < -dz, r = dx > dz, u = dy < -JR * .6;
    if (l !== jl) { l ? press('KeyA') : rel('KeyA'); jl = l }
    if (r !== jrt) { r ? press('KeyD') : rel('KeyD'); jrt = r }
    if (u !== ju) { u ? press('Space') : rel('Space'); ju = u }
    arL.classList.toggle('on', l); arR.classList.toggle('on', r); arU.classList.toggle('on', u);
  };
  const hudTap = e => {
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 960, y = (e.clientY - r.top) / r.height * 540;
    if (!psCanOpen()) return false;
    if (questBtnHit(x, y)) { questOpen(); return true; }
    if (cpHudHit(x, y)) { LB.tab = 1; psOpen(); lbFetch(); return true; }
    if (psBadgeHit(x, y)) { LB.tab = 0; psOpen(); return true; }
    return false;
  };
  jz.addEventListener('pointerdown', e => {
    if (jid !== null || !joyOk()) return;
    if (hudTap(e)) { e.preventDefault(); return; }
    e.preventDefault(); jid = e.pointerId; jz.setPointerCapture(jid);
    jr.classList.add('show'); JR = jr.offsetWidth / 2 || 60;
    ox = cl(e.clientX, JR + 4, innerWidth - JR - 4); oy = cl(e.clientY, JR + 4, innerHeight - JR - 4);
    jr.style.left = ox + 'px'; jr.style.top = oy + 'px'; knob.style.transform = '';
    joyMove(e);
  });
  jz.addEventListener('pointermove', e => { if (e.pointerId === jid) joyMove(e) });
  const joyEnd = e => { if (e.pointerId === jid) joyStop() };
  jz.addEventListener('pointerup', joyEnd); jz.addEventListener('pointercancel', joyEnd); jz.addEventListener('lostpointercapture', joyEnd);
  addEventListener('blur', joyStop);
  setInterval(() => {
    const ok = joyOk();
    jz.classList.toggle('on', ok);
    jh.style.display = ok && jid === null ? 'flex' : 'none';
    if (!ok && jid !== null) joyStop();
  }, 100);

  cv.addEventListener('pointerdown', e => {
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 960, y = (e.clientY - r.top) / r.height * 540;
    if (G === 'td') { tdClick(x, y); return; }   // ★ 塔防
    if (gachaModal) return PR.Enter = 1;
    if (showStat) { psClick(x, y); return; }
    if (showQuest) { questClick(x, y); return; }

    if (G === 'over' && LOSE_RES) {
      if (LOSE_RES.t < 0.8) {
        LOSE_RES.t = 1.0;
        return;
      }
      for (const b of LOSE_HITS) {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          if (b.id === 'retry') {
            settleAct('retry');
          } else if (b.id === 'char') {
            showChar = true;
          } else if (b.id === 'base') {
            toVil('st');
          }
          return;
        }
      }
      return;
    }

    if ((G === 'win' || G === 'over') && ST[cur].wb && WB_RES) {
      if (WB_RES.t < 0.8) {
        WB_RES.t = 1.0;
        return;
      }
      for (const b of WB_HITS) {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          if (b.id === 'retry') {
            wbRetry();
          } else if (b.id === 'char') {
            showChar = true;
          } else if (b.id === 'base') {
            toVil('st');
          }
          return;
        }
      }
      return;
    }

    if (G === 'win' && WIN_RES) {
      if (WIN_RES.t < 0.8) {
        WIN_RES.t = 1.0;
        return;
      }
      for (const b of WIN_HITS) {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          if (b.id === 'next') {
            settleAct('next');
          } else if (b.id === 'retry') {
            settleAct('retry');
          } else if (b.id === 'base') {
            toVil('st');
          }
          return;
        }
      }
      return;
    }

    if (showCapModal) {
      const pw = 780, ph = 470, px = (960 - pw) / 2, py = 35;
      if (x >= px + pw - 80 && x <= px + pw - 8 && y >= py + 7 && y <= py + 35) { showCapModal = false; return; }
      if (x < px || x > px + pw || y < py || y > py + ph) { showCapModal = false; return; }

      const lx = px + 18, ly = py + 48, lw = 360;

      const filterKeys = ['all', 'owned', 'equipped'];
      const fW = 106, fGap = 6;
      for (let i = 0; i < filterKeys.length; i++) {
        const fx = lx + 12 + i * (fW + fGap), fy = ly + 10, fh = 26;
        if (x >= fx && x <= fx + fW && y >= fy && y <= fy + fh) {
          capFilter = filterKeys[i];
          capPage = 0;
          return;
        }
      }

      const btmY = ly + 405 - 34;
      const filteredCaps = CAPSULES.filter(c => {
        if (capFilter === 'owned') return S.caps.includes(c.id);
        if (capFilter === 'equipped') return S.eqCap === c.id;
        return true;
      });
      const maxCapPages = Math.max(1, Math.ceil(filteredCaps.length / 5));

      if (x >= lx + 12 && x <= lx + 44 && y >= btmY && y <= btmY + 22) {
        if (capPage > 0) capPage--;
        return;
      }
      if (x >= lx + lw - 44 && x <= lx + lw - 12 && y >= btmY && y <= btmY + 22) {
        if (capPage < maxCapPages - 1) capPage++;
        return;
      }

      const curPageCaps = filteredCaps.slice(capPage * 5, (capPage + 1) * 5);
      const rowH = 58, rowGap = 6, rowY0 = ly + 44;
      for (let i = 0; i < curPageCaps.length; i++) {
        const rowY = rowY0 + i * (rowH + rowGap);
        if (x >= lx + 12 && x <= lx + lw - 12 && y >= rowY && y <= rowY + rowH) {
          curSelCapId = curPageCaps[i].id;
          return;
        }
      }

      if (typeof capUpHit === 'function' && capUpHit(x, y)) {
        const id = curSelCapId, b0 = capStar(id);
        capStarUp(id);
        if (capStar(id) > b0) { calc(); if (typeof capUpFx === 'function') capUpFx(id, capStar(id)); }
        return;
      }

      if (x >= CAPACT.x && x <= CAPACT.x + CAPACT.w && y >= CAPACT.y && y <= CAPACT.y + CAPACT.h) {
        const selCap = CAPSULES.find(c => c.id === curSelCapId);
        if (!selCap) return;
        const isOwned = S.caps.includes(selCap.id);
        if (!isOwned) {
          showCapModal = false;
          say('尚未拥有该胶囊，请前往扭蛋机抽取！');
        } else if (S.eqCap === selCap.id) {
          S.eqCap = null;
          if (inForm()) { clearForms(); calc(); }
          save();
        } else {
          S.eqCap = selCap.id;
          clearForms();
          save();
          calc();
        }
        return;
      }
      return;
    }

    if (M && V.pg === 'st') { portalClick(x, y); return; }

    if (showChar) {
      for (let i = BH.length - 1; i >= 0; i--) {
        const r = BH[i];
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { r.f(); return; }
      }
      if (x < 25 || x > 935 || y < 20 || y > 520) showChar = false;
      return;
    }

    if (psCanOpen() && questBtnHit(x, y)) { questOpen(); return; }
    if (psCanOpen() && cpHudHit(x, y)) { LB.tab = 1; psOpen(); lbFetch(); return; }
    if (psBadgeHit(x, y)) { LB.tab = 0; psOpen(); return; }
    if (G === 'title') {
      if (typeof authSwitchHit === 'function' && authSwitchHit(x, y)) authSwitchAccount();
      else titleStart();
      return;
    }
    if (G === 'over' || G === 'win' || (G === 'play' && P.st === 'trans')) return PR.Enter = 1;
    if ((G === 'vil' || G === 'room') && M) {
      if (x < MN_X || x > MN_X + MN_W || y < MN_Y || y > MN_Y + MN_H) return PR.Escape = 1;
      for (let j = MN.hit.length - 1; j >= 0; j--) {
        const h = MN.hit[j];
        if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) {
          if (h.fn) { h.fn(); return }
          if (h.act || h.i === V.i) { V.i = h.i; PR.Enter = 1 } else V.i = h.i;
          return;
        }
      }
    }
  });

  cv.addEventListener('wheel', e => { if (M && V.pg !== 'st' && MN.max > 0) { e.preventDefault(); MN.st = cl(MN.st + e.deltaY * .6, 0, MN.max) } }, { passive: false });

  const relAll = () => { for (const k in K) K[k] = 0 };
  addEventListener('blur', relAll); document.addEventListener('visibilitychange', relAll);
  addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
})();