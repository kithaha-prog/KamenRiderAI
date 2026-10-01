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

  try {
    let agongRaw;
    try { agongRaw = await load('NPC/阿公.png'); }
    catch(e) { agongRaw = await load(A + 'NPC/阿公.png'); }
    EL.im = shrinkH(trim(toCanvas(agongRaw)), 290);
  } catch (e) {
    miss.push('/Assets/NPC/阿公.png');
  }
}
prep().catch(e => { G = 'err'; msg = '加载出现问题，请确保使用本地服务器(http://)并放置素材。' });

// ===== 普攻音效（Assets/SoundFX/Sword_Hit.mp3）：4 个音频轮流播，连击时不会互相打断 =====
const HIT_SND = []; let hitSndI = 0;
(function () { for (let i = 0; i < 4; i++) { const a = new Audio(); a.preload = 'auto'; a.volume = .6; a.src = encodeURI(A + 'SoundFX/Sword_Hit.mp3'); HIT_SND.push(a) } })();
function playSwordHit() { const a = HIT_SND[hitSndI++ % HIT_SND.length]; try { a.currentTime = 0; const p = a.play(); if (p && p.catch) p.catch(() => { }) } catch (e) { } }

// ===== 游戏主逻辑帧刷新 =====
function upd(dt) {
  T += dt; shake = Math.max(0, shake - 30 * dt); V.mt -= dt; bagNoticeT -= dt;
  for (const d of DT) d.t -= dt; DT = DT.filter(d => d.t > 0);
  for (const f of FX) f.t -= dt; FX = FX.filter(f => f.t > 0);
  for (const g of GH) g.t -= dt; GH = GH.filter(g => g.t > 0);

  // [N] 键呼出/关闭胶囊终端
  if (PR.KeyN) { showCapModal = !showCapModal; delete PR.KeyN; }
  if (showCapModal) {
    if (PR.Escape) { showCapModal = false; delete PR.Escape; }
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
    const tdur = P.tdur || 16 * 0.12, frame = Math.min(15, Math.floor(P.t / tdur * 16));
    if (!isB && frame >= (is5 ? 8 : 10) && !P.hit['burst']) {
      P.hit['burst'] = 1; shake = 24;
      if (G === 'play') area(P.x - 360, P.x + 360, P.atk * 3.5);
      DT.push(isB ? { x: P.x, y: P.y - 210, s: 'BLADE · OPEN UP！', t: 1.6, c: '#3aa0ff' }
            : is5 ? { x: P.x, y: P.y - 210, s: '555 · COMPLETE！', t: 1.6, c: '#ffb400' }
                  : { x: P.x, y: P.y - 210, s: '赤龙契约·烈焰爆发！', t: 1.6, c: '#ff3838' });
    }
    if (P.t > tdur) {
      P.st = 'idle'; P.k5 = is5; P.bl = isB; P.ryuki = !is5 && !isB; P.inv = .6; calc();
    }
    return;
  }

  if (G === 'title') { if (PR.Enter) toVil(); return }
  if (G === 'vil' || G === 'room') return vupd(dt);
  if ((G === 'over' || G === 'win') && (PR.KeyR || PR.Enter)) return toVil('st');
  if (G !== 'play') return;
  if (P.st === 'trans') { P.t += dt; if (P.t > 16 / 7 || PR.Enter) { P.st = 'idle'; P.t = 0 } return }
  if (PR.Escape) { if (ST[cur].wb) { WBR = 'retreat'; return fin(0) } S.g += RG; save(); return toVil('st') }
  if (PR.Digit1 && S.hp > 0 && P.hp < P.mh) { S.hp--; P.hp = Math.min(P.mh, P.hp + P.mh * .5); DT.push({ x: P.x, y: P.y - 180, s: '+HP', t: .8, c: '#7dff9a' }) }
  if (PR.Digit2 && S.mp > 0 && P.mp < P.mm) { S.mp--; P.mp = Math.min(P.mm, P.mp + P.mm * .6); DT.push({ x: P.x, y: P.y - 180, s: '+MP', t: .8, c: '#6ab0ff' }) }
  P.inv -= dt; P.land -= dt; P.cd.e -= dt; P.dcd -= dt; P.gt -= dt; P.mp = Math.min(P.mm, P.mp + 3 * dt);

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
    else if (PR.KeyK && P.mp >= 60) {
      P.mp -= 60; P.st = 'fv'; P.t = 0; P.hit = {}; P.h = 0; delete P.landT;
      if (P.ryuki) playRyukiFV();
    }
    else if (PR.KeyL && P.mp >= 10) {
      P.mp -= 10; P.st = 'thr'; P.t = 0; P.h = 0;
      if (!gr) P.vy = Math.min(P.vy * 0.5, 60);
    }
    else if (PR.KeyE && P.mp >= 40 && P.cd.e <= 0) {
      P.mp -= 40; P.cd.e = 6; P.st = 'dash'; P.t = 0; P.hit = {};
      P.vy = 0;
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
      const d = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0);
      if (d) { P.vx = d * (180 + S.lv * 2); P.f = d; }
    } else {
      P.vx = P.f * 40;
    }
    for (const q of [3, 5]) if (i >= q && !(P.h >> q & 1)) {
      P.h |= 1 << q; if (q === 3) playSwordHit();
      const a = P.x + P.f * 10, b = P.x + P.f * ATK_REACH;
      area(Math.min(a, b), Math.max(a, b), P.atk * (q == 3 ? 1.2 : 1));
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
    if (e.t !== 'boss') bar(sn(e.x - cam - 25), sn(e.y - e.h - 14), 50, 5, e.hp, e.mhp, '#ff4757')
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
  drawP();
  drawBladeBolts();

  for (const f of FX) {
    const p = f.t / f.d;
    ctx.save();
    if (f.type === 'malaya_kick_blast') {
      ctx.beginPath(); ctx.arc(f.x - cam, f.y, (1 - p) * f.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 229, 255, ${p})`; ctx.lineWidth = 6 * p;
      ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 18; ctx.stroke();
    } else if (f.type === 'boom') {
      ctx.beginPath(); ctx.arc(f.x - cam, f.y, (1 - p) * f.r, 0, Math.PI * 2);
      ctx.strokeStyle = f.c; ctx.globalAlpha = p; ctx.lineWidth = 5 * p + 1;
      ctx.shadowColor = f.c; ctx.shadowBlur = 16; ctx.stroke();
    } else if (f.type === 'boss_death_blast') {
      ctx.beginPath(); ctx.arc(f.x - cam, f.y, (1 - p) * f.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 216, 74, ${p})`; ctx.lineWidth = 6 * p;
      ctx.shadowColor = '#ffd84a'; ctx.shadowBlur = 20; ctx.stroke();
    }
    ctx.restore();
  }

  for (const d of DT) txt(d.s, d.x - cam, d.y - (1 - d.t) * 40, String(d.s).length > 4 ? 22 : 18, d.c, 'center');
  ctx.restore();

  drawPlayerHUD(16, 14); drawStaminaHUD(16, 96); drawGoldHUD(); drawMinimapHUD(); drawLocationHUD(ST[cur].n);

  const rw = 160, rh = 78, rx = 960 - 18 - rw, ry = 74;   // 在金币条、钻石条下方
  rpath(rx, ry, rw, rh, 12); ctx.fillStyle = 'rgba(10,12,24,0.82)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,216,74,0.3)'; ctx.stroke();
  if (ST[cur].wb) {
    const tl = Math.ceil(WBT);
    txt('⏱ ' + (tl / 60 | 0) + ':' + String(tl % 60).padStart(2, '0'), rx + rw - 12, ry + 18, 13, WBT < 20 ? '#ff6b6b' : '#ffd84a', 'right');
    txt('伤害: ' + poN(WBD), rx + rw - 12, ry + 39, 13, '#7dff9a', 'right');
  } else {
    txt('目标: ' + Math.min(kills, ST[cur].k) + '/' + ST[cur].k + (bs ? ' (BOSS)' : ''), rx + rw - 12, ry + 18, 13, '#ffd84a', 'right');
    txt('战利品: +' + RG + ' G', rx + rw - 12, ry + 39, 13, '#7dff9a', 'right');
  }
  txt('药水: [1]×' + S.hp + '  [2]×' + S.mp, rx + rw - 12, ry + 59, 12, '#9df', 'right');

  const henshinPrompt = inForm() ? '[P] 解除变身' : (S.eqCap ? '[P] ' + capShort() + '变身' : '[P] 变身');
  txt('J 剑击   L ' + lSkillName() + '   K 终结技   E 机车   Shift 闪避/疾跑   ' + henshinPrompt + '   [C] 背包   [N] 胶囊   Esc 撤退', 480, 524, 12, '#bbb', 'center');

  const b = E.find(e => e.t === 'boss');
  if (b) {
    rpath(260, 490, 440, 24, 12); ctx.fillStyle = 'rgba(12,14,24,0.88)'; ctx.fill();
    bar(264, 494, 432, 16, b.hp, b.mhp, '#ff4757', '#ff9f43', 8);
    txt((ST[cur].bn || '强敌 BOSS') + ' ' + b.hp + '/' + b.mhp, 480, 502, 12, '#fff', 'center');
  }

  if ((G === 'over' || G === 'win') && ST[cur].wb) {
    const w = G === 'win';
    rpath(260, 160, 440, 220, 18); ctx.fillStyle = 'rgba(10,12,22,0.94)'; ctx.fill(); ctx.strokeStyle = w ? '#ffd84a' : '#ff4757'; ctx.lineWidth = 2; ctx.stroke();
    txt(w ? '讨伐成功！' : WBR === 'time' ? '时间耗尽' : WBR === 'retreat' ? '撤退' : '战败…', 480, 208, 34, w ? '#ffd84a' : '#ff6b81', 'center');
    txt('累计伤害  ' + poN(WBD) + (WBM ? '  (' + Math.min(100, WBD / WBM * 100 | 0) + '%)' : ''), 480, 262, 16, '#fff', 'center');
    txt('金币 +' + FG.toLocaleString() + (w ? '   （击杀加成 +50%）' : ''), 480, 292, 16, '#7dff9a', 'center');
    txt('按 Enter 返回传送门', 480, 348, 14, '#aab', 'center');
  } else if (G === 'over') {
    rpath(280, 180, 400, 180, 18); ctx.fillStyle = 'rgba(10,12,22,0.92)'; ctx.fill(); ctx.strokeStyle = '#ff4757'; ctx.stroke();
    txt('战败…', 480, 225, 36, '#ff6b81', 'center'); txt('保留一半战利品：金币 +' + FG + '\n按 Enter 回村', 480, 285, 16, '#fff', 'center');
  } else if (G === 'win') {
    rpath(280, 180, 400, 180, 18); ctx.fillStyle = 'rgba(10,12,22,0.92)'; ctx.fill(); ctx.strokeStyle = '#ffd84a'; ctx.stroke();
    txt('关卡完成！', 480, 225, 38, '#ffd84a', 'center'); txt('通关奖赏：金币 +' + FG + (FD ? '   钻石 +' + FD + '（首通）' : '') + '   Lv.' + S.lv + '\n按 Enter 前往下一战役', 480, 285, 16, '#fff', 'center');
  }

  if (gachaModal) drawGachaModalOverlay();
  if (showChar) drawCharPanel();
  if (showCapModal) drawCapsuleModal();
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
  const B = [
    ['剑击', 'atk', 'right:calc(var(--s)*.2 + 1.5vmin);bottom:calc(var(--s)*.2 + 2vmin);width:calc(var(--s)*1.4);height:calc(var(--s)*1.4);font-size:calc(var(--s)*.34)', ['KeyJ']],
    ['跳', 'jmp', 'right:calc(var(--s)*1.85 + 1.5vmin);bottom:calc(var(--s)*.15 + 2vmin)', ['Space']],
    ['终结技', 'skl', 'right:calc(var(--s)*.25 + 1.5vmin);bottom:calc(var(--s)*1.75 + 2vmin)', ['KeyK']],
    ['飞剑', 'skl', 'right:calc(var(--s)*1.75 + 1.5vmin);bottom:calc(var(--s)*1.3 + 2vmin)', ['KeyL']],
    ['机车', 'skl', 'right:calc(var(--s)*3.3 + 1.5vmin);bottom:calc(var(--s)*.6 + 2vmin)', ['KeyE']],
    ['闪避<br>疾跑', 'dg', 'right:calc(var(--s)*3.3 + 1.5vmin);bottom:calc(var(--s)*1.75 + 2vmin)', ['ShiftLeft']],
    // 左侧 2×2：上排 变身 / 胶囊，下排 药① / 药②（间距 1.0s，按钮 0.8s，互不重叠；下方留给浮动摇杆）
    ['变身', 'trf sm', 'left:2vmin;bottom:calc(var(--s)*3.5 + 3vmin)', ['KeyP']],
    ['胶囊', 'sm', 'left:calc(2vmin + var(--s)*1);bottom:calc(var(--s)*3.5 + 3vmin)', ['KeyN']],
    ['药①', 'sm', 'left:2vmin;bottom:calc(var(--s)*2.5 + 3vmin)', ['Digit1']],
    ['药②', 'sm', 'left:calc(2vmin + var(--s)*1);bottom:calc(var(--s)*2.5 + 3vmin)', ['Digit2']],
    ['▲', 'sm', 'left:calc(50% - var(--s)*1.7);bottom:2vmin', ['KeyW']],
    ['✔<br>互动', 'sm', 'left:calc(50% - var(--s)*.5);bottom:2vmin;width:var(--s);height:var(--s);font-size:calc(var(--s)*.24)', ['KeyF', 'Enter']],
    ['▼', 'sm', 'left:calc(50% + var(--s)*.9);bottom:2vmin', ['KeyS']],
    ['背包<br>规格', 'sm', 'left:calc(50% - var(--s)*1.3);top:1vmin;opacity:.85', ['KeyC']],
    ['关闭<br>撤退', 'sm', 'left:calc(50% + var(--s)*.5);top:1vmin;opacity:.75', ['Escape'], 1],
  ];

  const ui = document.createElement('div'); ui.id = 'tc';
  // 浮动摇杆：左半屏任意位置按下即出现，手指移动时圆盘跟随；上推=跳跃
  const jz = document.createElement('div'); jz.id = 'joyz';
  const jh = document.createElement('div'); jh.id = 'joyh'; jh.innerHTML = '◀ 拖动移动 ▶';
  const jr = document.createElement('div'); jr.id = 'joy'; jr.innerHTML = '<i class="a l">◀</i><i class="a r">▶</i><i class="a u">▲</i><b></b>';
  ui.appendChild(jz); ui.appendChild(jh); ui.appendChild(jr);   // 先于按钮加入 → 按钮在其上层
  for (const [t, c, pos, codes, esc] of B) {
    const b = document.createElement('div'); b.className = 'b ' + c; b.style.cssText = pos; b.innerHTML = t; ui.appendChild(b);
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('on');
      if (esc && G === 'play' && !showChar && !showCapModal && Date.now() - lastEsc > 1500) { lastEsc = Date.now(); DT.push({ x: P.x, y: P.y - 180, s: '再点一次撤退', t: 1.2, c: '#ffd84a' }); return }
      codes.forEach(press)
    });
    const up = () => { b.classList.remove('on'); codes.forEach(rel) };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
  }

  const dgBtn = ui.querySelector('.b.dg');
  const lBtn = [...ui.querySelectorAll('.b')].find(b => b.textContent === '飞剑');
  setInterval(() => {
    if (lBtn) { const t = lSkillName(); if (lBtn.textContent !== t) lBtn.textContent = t }
    if (!dgBtn) return;
    const cd = G === 'play' ? Math.max(0, P.dcd / DODGE_CD) : 0;
    dgBtn.style.background = cd > 0 ? `conic-gradient(rgba(0,0,0,.6) ${cd * 360}deg, rgba(0,190,200,.5) 0)` : '';
    dgBtn.style.borderColor = P.exh ? '#ff6b6b' : '';
  }, 80);

  if (document.documentElement.requestFullscreen) {
    const f = document.createElement('div'); f.className = 'b sm'; f.textContent = '⛶'; f.style.cssText = 'left:calc(50% + var(--s)*1.4);top:1vmin;opacity:.75';
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

    // ===== 胶囊独立终端点击与快速切换交互 =====
    if (showCapModal) {
      const pw = 780, ph = 470, px = (960 - pw) / 2, py = 35;
      // 点击右上角关闭按钮或面板外区域关闭
      if (x >= px + pw - 85 && x <= px + pw - 13 && y >= py + 7 && y <= py + 33) { showCapModal = false; return; }
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
          if (inForm()) clearForms();   // 换胶囊：先解除旧形态
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

    if (G === 'title' || G === 'over' || G === 'win' || (G === 'play' && P.st === 'trans')) return PR.Enter = 1;
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