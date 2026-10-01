// ===== 资源初始化 =====
async function prep() {
  msg = '加载章节场景…';
  // 预加载 1~10 章地景：Chapter 1.jpg ~ Chapter 10.jpg
  for (let ch = 1; ch <= 10; ch++) {
    const tryList = [
      A + `Scenes/Chapter ${ch}.jpg`,
      A + `Scenes/Chapter ${ch}.png`,
      A + `Scenes/Chapter${ch}.jpg`,
      A + `Scenes/Chapter${ch}.png`,
      SCN // 兜底备用
    ];
    for (const p of tryList) {
      try {
        SC_MAP[ch] = await load(p);
        if (SC_MAP[ch]) break;
      } catch (e) {}
    }
    // 若当前章节图片未找到，自动沿用第 1 章背景
    if (!SC_MAP[ch] && SC_MAP[1]) {
      SC_MAP[ch] = SC_MAP[1];
    }
  }
  SC = SC_MAP[1] || (await load(SCN)); // 默认/全局兜底
  for (const o of Object.values(SH)) {
    msg = '加载骑士技能…'; const im = await load(KR + o.f);
    Object.assign(o, sliceSheet(im, o.c, o.r, o.ref, o.cut || 0));
    if (o.mid) o.fy = o.ch / 2; if (o.w) { const b = bb(o.f[o.ref]); o.s = o.w / (b.x1 - b.x0) }
  }

  // 加载标题封面图（支持 Cover.jpg / Cover.png 等常见命名格式）
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

  // ===== 加载技能栏 UI 图标 =====
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

  // ===== 加载升级专属横幅（支持自动去黑底与多种路径） =====
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

  // ===== 加载怪兽投射物与技能特效 =====
  // ===== 加载怪兽投射物与技能特效（自动容错 png / jpg / 大小写） =====
  // ===== 加载怪兽投射物与技能特效（含全套地面/光柱/爆炸/预警素材） =====
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

  await loadRyukiAssets();   // 龙骑素材见 ryuki.js

  // ===== 假面骑士 555 (Faiz) 素材 =====
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
  await loadBladeAssets();   // Blade 素材见 blade.js

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
  ICO.g = mkIcon(await li(A + 'Icon/Coin.png')); ICO.d = mkIcon(await li(A + 'Icon/Diamond.png'));   // 金币 / 钻石图标（Assets/Icon/）
  { const pi = await li(A + 'Buildings/传送门.png'); if (pi) PG.bi = trim(toCanvas(pi)); }   // 传送门贴图
  for (const b of BD) {
  if (b.rf) b.ri = await li(A + 'Interior/' + b.rf);
  if (b.bf) {
    const im = await li(A + 'Buildings/' + b.bf);
    if (im) b.bi = trim(toCanvas(im));
  }
}
  layoutVillage();   // 建筑贴图都载入后，按实际宽度排布村庄（排布只看宽高比，之后缩小贴图不影响位置）
  // —— 性能：把所有大图预缩小到“显示尺寸的 1.5 倍”，主页每帧不再缩放几千像素的大图 ——
  for (const b of BD) {
    if (b.bi) b.bi = shrinkH(b.bi, Math.round(b.h * 1.5));
    if (b.ri) b.ri = shrinkH(toCanvas(b.ri), 810);
  }
  if (PG.bi) PG.bi = shrinkH(PG.bi, Math.round(PG.h * 1.5));
  if (IM.v) IM.v = shrinkH(toCanvas(IM.v), 810);
  const bi = await load(KR + 'KR_Malaya_Vehicles.png'); BK = trim(toCanvas(bi)); G = 'title';

  // ===== 批量加载 NPC 角色形象（阿公、阿玲、老岩、无相） =====
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

  // 1. 加载村庄街道上的长者 阿公
  EL.im = await loadNpcImg('阿公');

  // 2. 自动匹配各建筑室内的 NPC 形象
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
prep().catch(e => { G = 'err'; msg = '加载出现问题，请确保使用本地服务器(http://)并放置素材。' });

// ===== 普攻音效（Assets/SoundFX/Sword_Hit.mp3）：4 个音频轮流播，连击时不会互相打断 =====
const HIT_SND = []; let hitSndI = 0;
(function () { for (let i = 0; i < 4; i++) { const a = new Audio(); a.preload = 'auto'; a.volume = .6; a.src = encodeURI(A + 'SoundFX/Sword_Hit.mp3'); HIT_SND.push(a) } })();
function playSwordHit() { const a = HIT_SND[hitSndI++ % HIT_SND.length]; try { a.currentTime = 0; const p = a.play(); if (p && p.catch) p.catch(() => { }) } catch (e) { } }

// ===== 游戏主逻辑帧刷新 =====
function upd(dt) {
  // 升级时全场定格暂停 1.2 秒
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

  // [N] 键呼出/关闭胶囊终端
  if (PR.KeyN) { showCapModal = !showCapModal; delete PR.KeyN; }
  if (showCapModal) {
    if (PR.Escape) { showCapModal = false; delete PR.Escape; }
    else capKeys();   // W/S 选择 · A/D 切换分类 · Enter 装配（见 ui.js）
    return;
  }

  // [C] 键背包
  if (PR.KeyC) { showChar = !showChar; delete PR.KeyC }
  if (showChar) { if (PR.Escape) { showChar = false; delete PR.Escape } return }

  // [P] 键变身
  if (PR.KeyP) { triggerRyukiTransform(); delete PR.KeyP }

  // 当离开对应状态时，停掉大招和变身音效
  if (P.st !== 'trans_ryuki') { stopFaizHenshin(); stopRyukiHenshin(); stopBladeHenshin(); }
  if (P.st !== 'fv') { stopAllRyukiFVSounds(); }
  if (P.st === 'trans_ryuki') {
    P.vx = 0; P.t += dt; P.inv = 1;
    const is5 = P.trk === '555', isB = P.trk === 'blade';
    if (isB) { P.t = bladeSyncT(P.t); updBladeTrans() }   // Blade：动画时钟跟随音频，节拍事件见 blade.js
    if (!isB) updHenshin(dt);   // 龙骑 / 555：动画时钟跟随音频，时间轴与特效见 henshin.js
    const tdur = P.tdur || 16 * 0.12;
    if (P.t > tdur) {
      P.st = 'idle'; P.k5 = is5; P.bl = isB; P.ryuki = !is5 && !isB; P.inv = .6; calc();
    }
    return;
  }

  // 在 main.js 的 upd(dt) 中：
  if (G === 'play') {
    stageT += dt;
    if (typeof coopUpdateBattle === 'function') coopUpdateBattle(dt); // ★ 刷新联机
  }

  // 修改后（拦截 Enter / 空格，呼出登录窗口）：
  // 标题界面拦截 Enter 与空格，呼出登录弹窗
  if (G === 'title') {
    if (PR.Enter || PR.Space) {
      delete PR.Enter;
      delete PR.Space;
      if (typeof showLoginModal === 'function') {
        showLoginModal();
      } else {
        toVil();
      }
    }
    return;
  }
  if (G === 'vil' || G === 'room') return vupd(dt);
  // 战败处理
  // ★ 世界BOSS 专属结算按键分流与快进（在 upd 函数内 dt 才能正常计时）
  if ((G === 'win' || G === 'over') && ST[cur].wb && WB_RES) {
    WB_RES.t += dt; // 推进动效时钟

    // 动画未播完按任意键跳过快进
    if (WB_RES.t < 0.8 && (PR.Enter || PR.Space || PR.KeyR || PR.Escape || PR.KeyC)) {
      WB_RES.t = 1.0;
      delete PR.Enter; delete PR.Space; delete PR.KeyR; delete PR.Escape; delete PR.KeyC;
      return;
    }

    // 1. [Enter / R] 再次挑战或返回传送门
    if (PR.Enter || PR.Space || PR.KeyR) {
      delete PR.Enter; delete PR.Space; delete PR.KeyR;
      if (WB_RES.leftTries > 0) {
        const D = wbData();
        D.used++; save();
        begin(cur);
      } else {
        toVil('st');
      }
      return;
    }
    // 2. [C] 打开战备背包
    if (PR.KeyC) {
      delete PR.KeyC;
      showChar = true;
      return;
    }
    // 3. [Esc] 返回传送门大厅
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

  // 紧接着是原本的常规战败与胜利分流判断：
  if (G === 'over' && LOSE_RES) {
    LOSE_RES.t += dt; // 推进战败面板动效时钟

    // 动画未播完，按键直接快进至最终结果
    if (LOSE_RES.t < 0.8 && (PR.Enter || PR.Space || PR.KeyR || PR.Escape || PR.KeyC)) {
      LOSE_RES.t = 1.0;
      delete PR.Enter; delete PR.Space; delete PR.KeyR; delete PR.Escape; delete PR.KeyC;
      return;
    }

    // 1. [Enter / R] 再次挑战
    if (PR.Enter || PR.Space || PR.KeyR) {
      delete PR.Enter; delete PR.Space; delete PR.KeyR;
      begin(cur); // 立即重刷本关
      return;
    }
    // 2. [C] 打开战备背包
    if (PR.KeyC) {
      delete PR.KeyC;
      showChar = true;
      return;
    }
    // 3. [Esc] 返回传送门大厅
    if (PR.Escape) {
      delete PR.Escape;
      toVil('st');
      return;
    }
    return;
  }

  // ★ 胜利结算三键独立分流
  if (G === 'win' && WIN_RES) {
    WIN_RES.t += dt; // 推进结算动效时钟

    // 动效未播完按任意键直接跳过快进
    if (WIN_RES.t < 0.8 && (PR.Enter || PR.Space || PR.KeyR || PR.Escape)) {
      WIN_RES.t = 1.0;
      delete PR.Enter; delete PR.Space; delete PR.KeyR; delete PR.Escape;
      return;
    }

    // 1. [Enter] 推进下一关 / 完成
    if (PR.Enter || PR.Space) {
      delete PR.Enter; delete PR.Space;
      if (cur + 1 < ST.length && !ST[cur + 1].wb) {
        begin(cur + 1); // 无缝进下一关！
      } else {
        toVil('st');
      }
      return;
    }
    // 2. [R] 再次挑战
    if (PR.KeyR) {
      delete PR.KeyR;
      begin(cur); // 重刷本关
      return;
    }
    // 3. [Esc] 返回传送门大厅
    if (PR.Escape) {
      delete PR.Escape;
      toVil('st');
      return;
    }
    return;
  }
  if (G === 'play') {
    stageT += dt; // 累加本关战斗耗时
  }
  if (G !== 'play') return;
  if (P.st === 'trans') {
    P.vx = 0;
    P.t += dt;
    P.inv = 1;
    updMalayaTrans(dt); // ★ 音频时钟校验与震屏/飘字事件触发
    const dur = P.tdur || malayaTransDur();
    // 播完或玩家按下 Enter/空格 跳过
    if (P.t > dur || PR.Enter || PR.Space) {
      stopMalayaHenshin();
      P.st = 'idle';
      P.t = 0;
      P.inv = 0.5;
    }
    return;
  }
  if (PR.Escape) { if (ST[cur].wb) { WBR = 'retreat'; return fin(0) } S.g += RG; save(); return toVil('st') }
  if (PR.Digit1 && S.hp > 0 && P.hp < P.mh) { S.hp--; P.hp = Math.min(P.mh, P.hp + P.mh * .5); DT.push({ x: P.x, y: P.y - 180, s: '+HP', t: .8, c: '#7dff9a' }) }
  if (PR.Digit2 && S.mp > 0 && P.mp < P.mm) { S.mp--; P.mp = Math.min(P.mm, P.mp + P.mm * .6); DT.push({ x: P.x, y: P.y - 180, s: '+MP', t: .8, c: '#6ab0ff' }) }
  // 全技能 CD 递减
  for (const k in P.cd) {
    if (P.cd[k] > 0) P.cd[k] = Math.max(0, P.cd[k] - dt);
  }
  P.inv -= dt; P.land -= dt; P.dcd -= dt; P.gt -= dt; P.mp = Math.min(P.mm, P.mp + 3 * dt);

  let holdS = false;
  {
    const sh = K.ShiftLeft || K.ShiftRight;
    if (PR.ShiftLeft || PR.ShiftRight) { P.shDown = true; P.shT = 0 }
    if (P.shDown) {
      if (sh) { P.shT += dt; holdS = P.shT >= SHIFT_HOLD }
      else {
        if (P.shT < SHIFT_HOLD && P.dcd <= 0 && /^(idle|run|air|atk|thr)$/.test(P.st)) {
          const dd = ((K.KeyD || K.ArrowRight) ? 1 : 0) - ((K.KeyA || K.ArrowLeft) ? 1 : 0);
          P.f = dd || P.f;
          P.st = 'dodge';
          P.t = 0;
          P.dcd = DODGE_CD;
          P.inv = Math.max(P.inv, .45);
          P.vy = 0;
          P.vx = P.f * 820;
          P.h = 0;
        }
        P.shDown = false; P.shT = 0;
      }
    }
  }
  P.spr = false;

  const fr = P.st === 'idle' || P.st === 'run' || P.st === 'air', l = K.KeyA || K.ArrowLeft, r = K.KeyD || K.ArrowRight, gr = P.y >= GY;
  if (fr) {
    const d = (r ? 1 : 0) - (l ? 1 : 0);
    let spd = (240 + S.lv * 4) * formSpd();
    if (P.slow > 0) spd *= .55;
    if (holdS && d && !P.exh && P.sta > 0) { spd *= 1.7; P.spr = true }
    P.vx = d * spd;
    if (d) P.f = d;

    if ((PR.Space || PR.KeyW || PR.ArrowUp) && gr) {
      P.vy = -700;
      P.st = 'air';
    }

    if (PR.KeyJ) {
      P.st = 'atk'; P.t = 0; P.h = 0;
      if (!gr) P.vy = Math.min(P.vy * 0.4, 60);
    }
    else if (PR.KeyK && P.mp >= 60 && (P.cd.k || 0) <= 0) {
      P.mp -= 60;
      P.cd.k = getSkillCD('k');
      P.maxCd.k = P.cd.k;
      P.st = 'fv'; P.t = 0; P.hit = {}; P.h = 0; delete P.landT;
      if (P.ryuki) playRyukiFV();
    }
    else if (PR.KeyL && P.mp >= 10 && (P.cd.l || 0) <= 0) {
      P.mp -= 10;
      P.cd.l = getSkillCD('l');
      P.maxCd.l = P.cd.l;
      P.st = 'thr'; P.t = 0; P.h = 0;
      if (!gr) P.vy = Math.min(P.vy * 0.5, 60);
    }
    else if (PR.KeyE && P.mp >= 35 && (P.cd.e || 0) <= 0) {
      // ★ E 战车脱手技能：不再锁定玩家动作，瞬间召唤冲锋！
      P.mp -= 35;
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

    // 挥刀消弹判定窗口相应提前
    if (i >= 1 && i <= 6) {
      cancelEP(xLeft, xRight);
    }

    // ★ 将原本的 [3, 5] 提前至 [2, 4]，在第 2 帧（刚劈中目标点）瞬间触发音效与首次伤害
    for (const q of [2, 4]) if (i >= q && !(P.h >> q & 1)) {
      P.h |= 1 << q; 
      if (q === 2) playSwordHit(); // 第一段刀刃命中的瞬间发声
      area(xLeft, xRight, P.atk * (q == 2 ? 1.2 : 1));
    }
    if (P.t > .5) P.st = (P.y < GY) ? 'air' : 'idle';
  }
  else if (P.st === 'thr') {
    if (P.y >= GY) P.vx = 0;
    if (P.t >= (P.bl ? BLADE_L.fireT : .12) && !P.h) {
      P.h = 1;
      if (P.bl) fireBlade();
      else if (P.k5) fireFaiz();
      else if (P.ryuki) fireRyukiGun();
      else PJ.push({ x: P.x + P.f * 60, y: P.y - 100, vx: P.f * 800, f: P.f, t: 1.1, h: {} });
    }
    if (P.t > (P.bl ? BLADE_L.dur : .3)) P.st = (P.y < GY) ? 'air' : 'idle';
  }
  else if (P.st === 'fv') {
    P.inv = 1;
    if (P.ryuki) {
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
  else if (P.st === 'dodge') {
    P.inv = Math.max(P.inv, .06);
    P.vx = P.f * 820 * (1 - P.t / .3 * .55);
    if (P.t >= .3) { P.st = (P.y < GY) ? 'air' : 'idle'; P.vx = 0; P.inv = Math.max(P.inv, .12); }
  }

  const applyGravity = P.st !== 'dash' && P.st !== 'dodge' && !(P.st === 'fv' && (P.ryuki || P.k5 || P.bl));
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
  if (z.wb) { WBT -= dt; if (WBT <= 0) { WBT = 0; WBR = 'time'; return fin(0) } }   // 世界BOSS 限时
  sp -= dt;
  if (sp <= 0 && !bs) {
    const set = z.set;
    sp = Math.max(.8, 1.7 - set * .08) + Math.random() * .5;          // 刷怪间隔（随章节缩短）
    const cap = 4 + Math.ceil(set * .8) + Math.min(2, S.lv >> 5);     // 场上同时存在上限
    const alive = E.filter(e => e.t !== 'boss').length;
    const need = z.k - kills - alive;                                 // 还差几只就够击杀目标
    let n = 1 + (Math.random() < .35 + set * .04 ? 1 : 0) + (set >= 4 && Math.random() < .25 ? 1 : 0);
    n = Math.min(n, cap - E.length, need);                            // 一次可刷 1~3 只
    for (let i = 0; i < n; i++) spawn(kills >= 2 && Math.random() < z.wd ? 'wd' : 'imp');
  }
  if (!z.b && kills >= z.k) return fin(1);
  if (z.b && kills >= z.k && !bs) {
    bs = 1; spawn('boss');
    DT.push({ x: P.x, y: P.y - 240, s: 'BOSS 出现！', t: 2, c: '#ff8a4a' });
  }

  for (const e of E) updEnemy(e, dt);
  E = E.filter(e => !e.dead);
  updBattleFx(dt);
  updBikes(dt); // 刷新脱手战车运动与判定

  for (const s of PJ) {
    s.x += s.vx * dt; if (s.vy) s.y += s.vy * dt; s.t -= dt;
    for (const e of E) {
      if (s.h[e.id]) continue;
      const hit = (s.b5 || s.rb)
        ? (Math.abs(e.x - s.x) < e.w / 2 + 30 && s.y > e.y - e.h - 25 && s.y < e.y + 10)      // 555 光弹：按身体范围判定（自动瞄准打中部）
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
    if (Math.abs(o.x - P.x) < 45) {
      o.g = 1;
      if (o.k === 'h') P.hp = Math.min(P.mh, P.hp + 25);
      else P.mp = Math.min(P.mm, P.mp + 30);
    }
  }
  OR = OR.filter(o => !o.g);
}

// ===== 主渲染管线 =====
function draw() {
  ctx.save();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#08060c'; ctx.fillRect(0, 0, 960, 540);

  if (G === 'load' || G === 'err') { txt(msg, 480, 270, G === 'err' ? 16 : 20, G === 'err' ? '#ff7675' : '#fff', 'center'); ctx.restore(); return }
  if (G === 'title') {
    if (COVER_IMG) {
      // 1. 满屏绘制专属科技风封面原画 (960x540 完美自适应)
      ctx.drawImage(COVER_IMG, 0, 0, 960, 540);

      // 2. 底部暗色渐变遮罩，增强提示文字可读性
      const grad = ctx.createLinearGradient(0, 420, 0, 540);
      grad.addColorStop(0, 'rgba(8, 6, 12, 0)');
      grad.addColorStop(1, 'rgba(8, 6, 12, 0.88)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 420, 960, 120);

      // 3. 科技感呼吸光效开始提示框
      const pulse = 0.65 + Math.sin(T * 4) * 0.35;
      const bw = 320, bh = 42, bx = (960 - bw) / 2, by = 445;
      rpath(bx, by, bw, bh, 8);
      ctx.fillStyle = `rgba(10, 16, 28, ${0.75 + pulse * 0.15})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(0, 229, 255, ${pulse})`;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // 4. 按钮提示与副标
      const enterText = TOUCH ? '点击屏幕 开始游戏' : '按 Enter / 空格 进入基地';
      txt(enterText, 480, by + bh / 2, 16, '#00e5ff', 'center');
      txt('战役出征 · 收集神话装备 · 强化研磨 · 契约变身', 480, 512, 12, 'rgba(255,255,255,0.7)', 'center');
    } else {
      // 若封面素材缺失，自动回退到原有渲染方式
      bg(); dr(SH.atk, 12, 480, GY, 1, 1.3);
      txt('假面骑士 MALAYA', 480, 105, 48, '#f3c94a', 'center');
      txt('按 Enter 进入基地', 480, 165, 20, '#fff', 'center');
      txt('战役出征 → 收集神话装备 → 强化升级 → 扭蛋变身龙骑', 480, 210, 14, '#ccc', 'center');
      ENL.forEach((c, i) => { const k = Math.min(60 / c.width, 60 / c.height); ctx.drawImage(c, 20 + i * 70, 440, c.width * k, c.height * k); txt(i, 20 + i * 70, 438, 12, '#ff0') });
    }

    if (miss.length) txt('未找到素材：' + miss.join(', ') + '（已启用替代图形）', 480, 526, 12, '#ff7675', 'center');
    ctx.restore(); return;
  }

  if (G === 'vil' || G === 'room') {
    drawW();
    if (gachaModal) drawGachaModalOverlay();
    if (showChar) drawCharPanel();
    if (showCapModal) drawCapsuleModal();
    // 绘制升级全屏横幅与光效
    if (LV_POP) drawLevelUpBanner();
    ctx.restore(); return;
  }

  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
  bg();

  for (const o of OR) { ctx.fillStyle = o.k === 'h' ? '#ff4a5a' : '#4ab0ff'; ctx.beginPath(); ctx.arc(o.x - cam, GY - 14 + Math.sin(T * 5) * 3, 9, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke() }
  for (const e of E) drawDashWarn(e);   // 冲锋 / 俯冲落点预警（画在怪物下层）
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
  drawBikes(); // 绘制脱手战车（在玩家身后驶出）
  drawP();
  if (typeof drawCoopP2 === 'function') drawCoopP2(); // ★ 渲染 2P 队友模型与头顶血条
  drawBladeBolts();

  // 爆炸与全屏打击特效
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
        // 兜底色块渲染
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
  drawSkillBarHUD(); // 绘制屏幕底部技能图标与 CD 倒计时

  drawInfoHUD();

  const henshinPrompt = inForm() ? '[P] 解除变身' : (S.eqCap ? '[P] ' + capShort() + '变身' : '[P] 变身');
  hintLine('J 剑击   L ' + lSkillName() + '   K 终结技   E 机车   Shift 闪避/疾跑   ' + henshinPrompt + '   [C] 背包   [N] 胶囊   Esc 撤退');

  // ===== 顶部居中 BOSS 专属血条（避开左侧玩家面板与底部技能栏） =====
  const b = E.find(e => e.t === 'boss');
  if (b) {
    drawBossBar(b, ST[cur].bn || '强敌 BOSS');
  }
  
  if ((G === 'over' || G === 'win') && ST[cur].wb) {
    drawWBSettlement(); // 统一的高级世界BOSS结算
  } else if (G === 'over') {
    drawLoseSettlement();
  } else if (G === 'win') {
    drawWinSettlement();
  }

  if (gachaModal) drawGachaModalOverlay();
  if (showChar) drawCharPanel();
  if (showCapModal) drawCapsuleModal();
  
  // ★ 升级弹窗必须放在最后，保证浮在所有战斗画面最上层
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
    // 任何一帧出错都不再让整个循环停掉；把错误打印到控制台并显示在画面左上角，方便定位
    console.error('[game loop error]', err);
    try {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(0, 0, 960, 56);
      ctx.fillStyle = '#ff6b6b'; ctx.font = '13px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      const m = String(err && err.stack || err).split('\n');
      ctx.fillText(m[0].slice(0, 120), 8, 6); ctx.fillText((m[1] || '').trim().slice(0, 120), 8, 22); ctx.fillText((m[2] || '').trim().slice(0, 120), 8, 38);
    } catch (_) { }
  }
  for (const k in PR) delete PR[k];
  requestAnimationFrame(loop);
})(last);

// 键盘事件监听
addEventListener('keydown', e => { if (!K[e.code]) PR[e.code] = 1; K[e.code] = 1; if (/Space|Arrow/.test(e.code)) e.preventDefault() });
addEventListener('keyup', e => K[e.code] = 0);
addEventListener('blur', () => { for (const k in K) K[k] = 0 });

// 触屏与点击交互逻辑（含批量勾选、胶囊终端与等级装备）
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
  // ===== 手游式按键布局 =====
  // 右下：大号「剑击/互动」+ 弧形排列的技能键；左上（HUD 下方）：变身 / 药水；右上：背包 / 胶囊 / 撤退 / 全屏；
  // 左下：浮动圆盘摇杆（见下方逻辑 + index.html 里的 #joy 样式）；▲▼ 只在菜单打开时出现
  const R0 = '3vmin', B0 = '3vmin';
  const atkCodes = () => (G === 'play' && !showChar && !showCapModal) ? ['KeyJ'] : ['KeyF', 'Enter'];   // 战斗=剑击；基地/菜单=互动·确认
  const B = [
    ['剑击', 'atk', `right:${R0};bottom:${B0}`, atkCodes],
    ['跳', 'jmp', `right:calc(var(--s)*1.65 + ${R0});bottom:calc(var(--s)*.05 + ${B0})`, ['Space']],
    ['飞剑', 'skl', `right:calc(var(--s)*1.5 + ${R0});bottom:calc(var(--s)*1.45 + ${B0})`, ['KeyL']],
    ['终结技', 'skl ult', `right:calc(var(--s)*.25 + ${R0});bottom:calc(var(--s)*1.7 + ${B0})`, ['KeyK']],
    ['闪避<br>疾跑', 'dg', `right:calc(var(--s)*2.85 + ${R0});bottom:calc(var(--s)*.7 + ${B0})`, ['ShiftLeft']],
    ['机车', 'skl', `right:calc(var(--s)*2.9 + ${R0});bottom:calc(var(--s)*1.95 + ${B0})`, ['KeyE']],
    // 左上：变身 + 两瓶药
    ['变身', 'trf', 'left:2vmin;top:19vmin', ['KeyP']],
    ['药①', 'sm pot', 'left:calc(2vmin + var(--s)*1.1);top:calc(19vmin + var(--s)*.1)', ['Digit1']],
    ['药②', 'sm pot', 'left:calc(2vmin + var(--s)*2);top:calc(19vmin + var(--s)*.1)', ['Digit2']],
    // 右上：系统键
    ['背包<br>规格', 'sm sys', 'right:2vmin;top:14vmin', ['KeyC']],
    ['胶囊', 'sm sys', 'right:calc(2vmin + var(--s)*.95);top:14vmin', ['KeyN']],
    ['关闭<br>撤退', 'sm sys', 'right:calc(2vmin + var(--s)*1.9);top:14vmin', ['Escape'], 1],
    // 菜单上下选择（仅菜单/胶囊终端打开时显示）
    ['▲', 'sm nav', `left:3vmin;bottom:calc(var(--s)*1.1 + ${B0})`, ['KeyW']],
    ['▼', 'sm nav', `left:3vmin;bottom:${B0}`, ['KeyS']],
  ];

  const ui = document.createElement('div'); ui.id = 'tc';
  // 浮动摇杆：左半屏任意位置按下即出现，手指移动时圆盘跟随；上推=跳跃
  const jz = document.createElement('div'); jz.id = 'joyz';
  const jh = document.createElement('div'); jh.id = 'joyh'; jh.innerHTML = '<i>◀</i><i>▶</i>';
  const jr = document.createElement('div'); jr.id = 'joy'; jr.innerHTML = '<i class="a l">◀</i><i class="a r">▶</i><i class="a u">▲</i><b></b>';
  ui.appendChild(jz); ui.appendChild(jh); ui.appendChild(jr);   // 先于按钮加入 → 按钮在其上层
  for (const [t, c, pos, codes, esc] of B) {
    const b = document.createElement('div'); b.className = 'b ' + c; b.style.cssText = pos; b.innerHTML = t; ui.appendChild(b);
    let held = [];
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('on');
      if (esc && G === 'play' && !showChar && !showCapModal && Date.now() - lastEsc > 1500) { lastEsc = Date.now(); DT.push({ x: P.x, y: P.y - 180, s: '再点一次撤退', t: 1.2, c: '#ffd84a' }); return }
      held = typeof codes === 'function' ? codes() : codes; held.forEach(press);
    });
    const up = () => { b.classList.remove('on'); held.forEach(rel); held = [] };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
  }

  const dgBtn = ui.querySelector('.b.dg');
  const lBtn = [...ui.querySelectorAll('.b')].find(b => b.textContent === '飞剑');
  const atkBtn = ui.querySelector('.b.atk'), navBtns = [...ui.querySelectorAll('.b.nav')];
  setInterval(() => {
    if (lBtn) { const t = lSkillName(); if (lBtn.textContent !== t) lBtn.textContent = t }
    if (atkBtn) {   // 剑击 / 互动 / 确认 共用一个键
      const inBattle = G === 'play' && !showChar && !showCapModal;
      const t = inBattle ? '剑击' : (M || showCapModal || showChar || gachaModal) ? '确认' : (typeof NR !== 'undefined' && NR) ? '互动' : '剑击';
      if (atkBtn.textContent !== t) atkBtn.textContent = t;
      atkBtn.classList.toggle('hot', t !== '剑击');
    }
    const showNav = (!!M && !gachaModal) || showCapModal;
    navBtns.forEach(n => n.classList.toggle('show', showNav));
    if (!dgBtn) return;
    const cd = G === 'play' ? Math.max(0, P.dcd / DODGE_CD) : 0;
    dgBtn.style.background = cd > 0 ? `conic-gradient(rgba(0,0,0,.6) ${cd * 360}deg, rgba(0,190,200,.5) 0)` : '';
    dgBtn.style.borderColor = P.exh ? '#ff6b6b' : '';
  }, 80);

  if (document.documentElement.requestFullscreen) {
    const f = document.createElement('div'); f.className = 'b sm sys'; f.textContent = '⛶'; f.style.cssText = 'right:calc(2vmin + var(--s)*2.85);top:14vmin';
    f.addEventListener('pointerdown', e => { e.preventDefault(); document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => { })).catch(() => { }) });
    ui.appendChild(f);
  }
  if (TOUCH) document.body.appendChild(ui);

  // ===== 浮动摇杆逻辑 =====
  const knob = jr.querySelector('b'), arL = jr.querySelector('.l'), arR = jr.querySelector('.r'), arU = jr.querySelector('.u');
  let jid = null, ox = 0, oy = 0, JR = 60, jl = false, jrt = false, ju = false;
  // 只在“可走动”的场景启用（弹窗 / 菜单 / 变身动画时把触摸让给画布）
  const joyOk = () => !M && !showChar && !showCapModal && !gachaModal && (G === 'vil' || G === 'room' || (G === 'play' && P.st !== 'trans'));
  const joyStop = () => {
    if (jid !== null) { try { jz.releasePointerCapture(jid) } catch (_) { } }
    jid = null; jr.classList.remove('show'); rel('KeyA'); rel('KeyD'); rel('Space');
    jl = jrt = ju = false; [arL, arR, arU].forEach(a => a.classList.remove('on'));
  };
  const joyMove = e => {
    let dx = e.clientX - ox, dy = e.clientY - oy, d = Math.hypot(dx, dy);
    if (d > JR) {                                   // 超出圆盘：圆盘跟随手指（全局浮动的关键）
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
  jz.addEventListener('pointerdown', e => {
    if (jid !== null || !joyOk()) return;
    e.preventDefault(); jid = e.pointerId; jz.setPointerCapture(jid);
    jr.classList.add('show'); JR = jr.offsetWidth / 2 || 60;      // 先显示再量尺寸
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
    if (gachaModal) return PR.Enter = 1;

    // ===== 战败结算面板点击交互 =====
    if (G === 'over' && LOSE_RES) {
      // 动画未播完，点击屏幕任意处立即跳过快进
      if (LOSE_RES.t < 0.8) {
        LOSE_RES.t = 1.0;
        return;
      }
      // 检查三大按钮点击
      for (const b of LOSE_HITS) {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          if (b.id === 'retry') {
            begin(cur);
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

    // ===== 世界BOSS 结算面板点击交互 =====
    if ((G === 'win' || G === 'over') && ST[cur].wb && WB_RES) {
      if (WB_RES.t < 0.8) {
        WB_RES.t = 1.0; // 点击任意处快进跳过动画
        return;
      }
      for (const b of WB_HITS) {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          if (b.id === 'retry') {
            if (WB_RES.leftTries > 0) {
              const D = wbData();
              D.used++; save();
              begin(cur);
            } else {
              toVil('st');
            }
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

    // ===== 胜利结算面板点击交互 =====
    if (G === 'win' && WIN_RES) {
      // 动画未播完，点击屏幕任意处立即跳过快进展示
      if (WIN_RES.t < 0.8) {
        WIN_RES.t = 1.0;
        return;
      }
      // 检查三大按钮点击
      for (const b of WIN_HITS) {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          if (b.id === 'next') {
            if (cur + 1 < ST.length && !ST[cur + 1].wb) begin(cur + 1);
            else toVil('st');
          } else if (b.id === 'retry') {
            begin(cur);
          } else if (b.id === 'base') {
            toVil('st');
          }
          return;
        }
      }
      return;
    }

    // ===== 胶囊独立终端点击与快速切换交互 =====
    if (showCapModal) {
      const pw = 780, ph = 470, px = (960 - pw) / 2, py = 35;
      // 点击右上角关闭按钮或面板外区域关闭
      if (x >= px + pw - 80 && x <= px + pw - 8 && y >= py + 7 && y <= py + 35) { showCapModal = false; return; }
      if (x < px || x > px + pw || y < py || y > py + ph) { showCapModal = false; return; }

      const lx = px + 18, ly = py + 48, lw = 360;

      // 1. 顶部过滤器切换 (全部 / 已拥有 / 当前装配)
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

      // 2. 翻页按钮点击
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

      // 3. 点击左侧列表中的胶囊条目进行选中切换
      const curPageCaps = filteredCaps.slice(capPage * 5, (capPage + 1) * 5);
      const rowH = 58, rowGap = 6, rowY0 = ly + 44;
      for (let i = 0; i < curPageCaps.length; i++) {
        const rowY = rowY0 + i * (rowH + rowGap);
        if (x >= lx + 12 && x <= lx + lw - 12 && y >= rowY && y <= rowY + rowH) {
          curSelCapId = curPageCaps[i].id;
          return;
        }
      }

      // 4. 右侧「立即装配 / 卸下」大按钮点击
      const rx = px + 392, ry = py + 48, rw = 370;
      const actBtnY = ry + 150 + 42, actBtnH = 36;
      if (x >= rx + 14 && x <= rx + rw - 14 && y >= actBtnY && y <= actBtnY + actBtnH) {
        const selCap = CAPSULES.find(c => c.id === curSelCapId);
        if (!selCap) return;
        const isOwned = S.caps.includes(selCap.id);
        if (!isOwned) {
          showCapModal = false;
          say('尚未拥有该胶囊，请前往扭蛋机抽取！');
        } else if (S.eqCap === selCap.id) {
          // 卸下胶囊
          S.eqCap = null;
          if (inForm()) { clearForms(); calc(); }
          save();
        } else {
          // 装配胶囊
          S.eqCap = selCap.id;
          clearForms(); // ★ 确保未按 P 之前，各形态全为 false
          save();
          calc();
        }
        return;
      }
      return;
    }

    // 传送门点击交互（命中区域由 portal.js 每帧登记）
    if (M && V.pg === 'st') { portalClick(x, y); return; }

    // 角色背包面板点击：直接查 drawCharPanel 登记的命中区域（后登记的在上层）
    if (showChar) {
      for (let i = BH.length - 1; i >= 0; i--) {
        const r = BH[i];
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { r.f(); return; }
      }
      if (x < 25 || x > 935 || y < 20 || y > 520) showChar = false;
      return;
    }

    if (G === 'title') {
      showLoginModal();
      return;
    }
    if (G === 'over' || G === 'win' || (G === 'play' && P.st === 'trans')) return PR.Enter = 1;
    if ((G === 'vil' || G === 'room') && M) {
      // 商店 / 铁匠铺 / 训练馆 / 扭蛋机：命中区域由 menu.js 每帧登记（后登记的在上层）
      if (x < MN_X || x > MN_X + MN_W || y < MN_Y || y > MN_Y + MN_H) return PR.Escape = 1;
      for (let j = MN.hit.length - 1; j >= 0; j--) {
        const h = MN.hit[j];
        if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) {
          if (h.fn) { h.fn(); return }
          if (h.act || h.i === V.i) { V.i = h.i; PR.Enter = 1 } else V.i = h.i;   // 点按钮直接确认；点条目先选中
          return;
        }
      }
    }
  });

  // 商店 / 铁匠铺 / 训练馆 列表：鼠标滚轮滚动
  cv.addEventListener('wheel', e => { if (M && V.pg !== 'st' && MN.max > 0) { e.preventDefault(); MN.st = cl(MN.st + e.deltaY * .6, 0, MN.max) } }, { passive: false });

  const relAll = () => { for (const k in K) K[k] = 0 };
  addEventListener('blur', relAll); document.addEventListener('visibilitychange', relAll);
  addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
})();