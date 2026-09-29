// ===== 资源初始化 =====
async function prep() {
  msg = '加载场景…'; SC = await load(SCN);
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

  try { CAP_IMG = await load(DRAW + 'KR_Ryuki.jpg') } catch (e) { miss.push('Draw/KR_Ryuki.jpg') }

  try {
    let trIm;
    try { trIm = await load(TRANS + 'KR_Malaya_TrasnformTo_KR_Ryuki.jpg'); }
    catch (e) { trIm = await load(TRANS + 'KR_Malaya_TransformTo_KR_Ryuki.jpg'); }
    SH.ryukiTrans = sliceSheet(trIm, 4, 4, 0, 0, true);
  } catch (e) { miss.push('Transform/KR_Malaya_TrasnformTo_KR_Ryuki.jpg'); }

  for (const [key, o] of Object.entries(SHR)) {
    try {
      let im;
      if (key === 'fv') {
        const tryNames = ['KR_Ryuki_FinalVent.jpg', 'ryuki_finalvent.jpg', 'Ryuki_FinalVent.jpg', 'KR_Ryuki_Finalvent.jpg'];
        for (const fn of tryNames) {
          try { im = await load(RYUKI + fn); if (im) break; } catch(err) {}
        }
        if (!im) im = await load(RYUKI + o.f);
      } else {
        im = await load(RYUKI + o.f);
      }

      const doClean = (key !== 'fv' && key !== 'run');
      const rVal = o.r !== undefined ? o.r : 4;
      const cVal = o.c !== undefined ? o.c : 4;
      const refVal = o.ref !== undefined ? o.ref : 0;

      Object.assign(o, sliceSheet(im, cVal, rVal, refVal, o.cut || 0, doClean));

      if (key === 'sword') {
        const b = bb(o.f[o.ref]);
        if (o.w) o.s = o.w / (b.x1 - b.x0);
      } else if (key !== 'jump' && key !== 'fv' && SH.atk && SH.atk.s) {
        o.s = SH.atk.s;
      }
    } catch (e) {
      miss.push('Kamen Rider Ryuki/' + o.f);
    }
  }

  for (let n = 1; n <= 10; n++) {
    try { const im = await load(ED + 'Enemies_' + n + '.jpg'); const sp = cut(im); ENL.push(...sp); ENS[n] = assign(sp) }
    catch (e) { miss.push('Enemies_' + n + '.jpg'); ENS[n] = { imp: [ph(ET.imp.col)], wd: [ph(ET.wd.col)], boss: [ph(ET.boss.col)] } }
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
  for (const b of BD) {
  if (b.rf) b.ri = await li(A + 'Interior/' + b.rf);
  if (b.bf) {
    const im = await li(A + 'Buildings/' + b.bf);
    if (im) b.bi = bkey(im);
  }
}
  const bi = await load(KR + 'KR_Malaya_Vehicles.jpg'); BK = trim(key(bi, 0, 0, bi.width, bi.height)); G = 'title';

  try {
    let agongRaw;
    try { agongRaw = await load('NPC/阿公.jpg'); }
    catch(e) { agongRaw = await load(A + 'NPC/阿公.jpg'); }
    EL.im = trim(key(agongRaw, 0, 0, agongRaw.width, agongRaw.height));
  } catch (e) {
    miss.push('/Assets/NPC/阿公.jpg');
  }
}
prep().catch(e => { G = 'err'; msg = '加载出现问题，请确保使用本地服务器(http://)并放置素材。' });

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

  if (P.st === 'trans_ryuki') {
    P.vx = 0; P.t += dt; P.inv = 1;
    const frame = Math.min(15, Math.floor(P.t / 0.12));
    if (frame >= 10 && !P.hit['burst']) {
      P.hit['burst'] = 1; shake = 24;
      if (G === 'play') area(P.x - 360, P.x + 360, P.atk * 3.5);
      DT.push({ x: P.x, y: P.y - 210, s: '赤龙契约·烈焰爆发！', t: 1.6, c: '#ff3838' });
    }
    if (P.t > 16 * 0.12) {
      P.st = 'idle'; P.ryuki = true; P.inv = .6; calc();
    }
    return;
  }

  if (G === 'title') { if (PR.Enter) toVil(); return }
  if (G === 'vil' || G === 'room') return vupd(dt);
  if ((G === 'over' || G === 'win') && (PR.KeyR || PR.Enter)) return toVil('st');
  if (G !== 'play') return;
  if (P.st === 'trans') { P.t += dt; if (P.t > 16 / 7 || PR.Enter) { P.st = 'idle'; P.t = 0 } return }
  if (PR.Escape) { S.g += RG; save(); return toVil('st') }
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
    let spd = 240 + S.lv * 4;
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

  if ((P.st === 'dodge' || P.spr || (P.st === 'fv' && P.ryuki && P.t >= 1.48 && P.y < GY)) && P.gt <= 0) {
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
      P.h |= 1 << q;
      const a = P.x + P.f * 10, b = P.x + P.f * 180;
      area(Math.min(a, b), Math.max(a, b), P.atk * (q == 3 ? 1.2 : 1));
    }
    if (P.t > .5) P.st = (P.y < GY) ? 'air' : 'idle';
  }
  else if (P.st === 'thr') {
    if (P.y >= GY) P.vx = 0;
    if (P.t >= .12 && !P.h) {
      P.h = 1;
      PJ.push({ x: P.x + P.f * 60, y: P.y - 100, vx: P.f * 800, f: P.f, t: 1.1, h: {}, ry: P.ryuki });
    }
    if (P.t > .3) P.st = (P.y < GY) ? 'air' : 'idle';
  }
  else if (P.st === 'fv') {
    P.inv = 1;
    if (P.ryuki) {
      if (P.t < 0.78) {
        P.vx = 0; P.vy = 0;
      } else if (P.t < 1.12) {
        P.vx = P.f * 60;
        P.vy = -720;
        P.y += P.vy * dt;
      } else if (P.t < 1.48) {
        P.vx = P.f * 20;
        P.vy = 20;
        P.y += P.vy * dt;
      } else if (!P.hit['landed']) {
        const diveSpd = 1050;
        P.vx = P.f * diveSpd;
        P.vy = diveSpd;
        P.y += P.vy * dt;

        area(P.x - 90, P.x + 90, P.atk * 1.8, P.hit);

        if (P.y >= GY) {
          P.y = GY;
          P.vy = 0;
          P.hit['landed'] = 1;
          P.landT = P.t;
          shake = 28;
          area(P.x - 360, P.x + 360, P.atk * 5.2);
          DT.push({ x: P.x, y: P.y - 180, s: 'FINAL VENT · 龙骑飞踢！', t: 1.8, c: '#ff3838' });
        }
      } else {
        P.y = GY;
        P.vy = 0;
        P.vx = P.f * Math.max(0, 220 * (1 - (P.t - P.landT) / 0.5));
      }

      if (P.t > 2.2) {
        P.st = 'idle';
        P.inv = 0.4;
      }
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

  const applyGravity = P.st !== 'dash' && P.st !== 'dodge' && !(P.st === 'fv' && P.ryuki);
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
  sp -= dt;
  if (sp <= 0 && !bs) {
    sp = 2.5;
    if (E.length < 3 + cur + Math.min(2, S.lv >> 2)) {
      spawn(kills >= 3 && Math.random() < z.wd ? 'wd' : 'imp');
    }
  }
  if (!z.b && kills >= z.k) return fin(1);
  if (z.b && kills >= z.k && !bs) {
    bs = 1; spawn('boss');
    DT.push({ x: P.x, y: P.y - 240, s: 'BOSS 出现！', t: 2, c: '#ff8a4a' });
  }

  for (const e of E) {
    const o = ET[e.t], d = P.x - e.x, ad = Math.abs(d);
    e.fl -= dt; e.cd -= dt; e.hc -= dt; e.fc = d < 0 ? -1 : 1;
    if (e.t === 'imp') {
      if (ad > 40) e.x += Math.sign(d) * o.sp * dt;
      e.y += (P.y - 110 + Math.sin(T * 3 + e.id) * 50 - e.y) * Math.min(1, 2 * dt);
    } else {
      const stop = e.t === 'wd' ? 330 : 60;
      if (ad > stop) e.x += Math.sign(d) * o.sp * dt;
      else if (e.t === 'wd' && ad < 250) e.x -= Math.sign(d) * o.sp * dt;
      e.y = e.t === 'wd' ? GY - 30 + Math.sin(T * 2 + e.id) * 15 : GY;
      if (e.cd <= 0) { e.cd = e.t === 'wd' ? 2.4 : 2.2; shoot(e, e.t === 'boss' ? 3 : 1) }
    }
    if (Math.abs(P.x - e.x) < e.w / 2 + 25 && e.y > P.y - 150 && e.y - e.h < P.y && e.hc <= 0 && P.inv <= 0) {
      e.hc = .8; hurtP(e.dm);
    }
  }
  E = E.filter(e => !e.dead);

  for (const p of EP) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.t -= dt;
    if (Math.hypot(p.x - P.x, p.y - (P.y - 80)) < 40 && P.inv <= 0) {
      hurtP(p.dm); p.t = 0;
    }
  }
  EP = EP.filter(p => p.t > 0);

  for (const s of PJ) {
    s.x += s.vx * dt; s.t -= dt;
    for (const e of E) {
      if (!s.h[e.id] && Math.abs(e.x - s.x) < e.w / 2 + 40 && e.y > s.y - 30 && e.y - e.h < s.y + 30) {
        s.h[e.id] = 1; hurt(e, P.atk * 1.6);
      }
    }
  }
  PJ = PJ.filter(s => s.t > 0);

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
  for (const e of E) {
    ctx.save(); ctx.translate(e.x - cam, e.y); ctx.scale(e.fc * e.s, e.s); if (e.fl > 0) ctx.filter = 'brightness(2.5)'; ctx.drawImage(e.im, -e.im.width / 2, -e.im.height); ctx.restore();
    if (e.t !== 'boss') bar(e.x - cam - 25, e.y - e.h - 14, 50, 5, e.hp, e.mhp, '#ff4757')
  }
  for (const p of EP) { ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(p.x - cam, p.y, 10, 0, 7); ctx.fill(); ctx.shadowBlur = 0 }
  for (const s of PJ) { const SW = (s.ry && SHR.sword && SHR.sword.f && SHR.sword.f.length) ? SHR.sword : SH.sword; dr(SW, 0, s.x - cam, s.y, -s.f, 1, 1, 1) }

  drawP();

  for (const f of FX) {
    const p = f.t / f.d;
    ctx.save();
    if (f.type === 'malaya_kick_blast') {
      ctx.beginPath(); ctx.arc(f.x - cam, f.y, (1 - p) * f.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 229, 255, ${p})`; ctx.lineWidth = 6 * p;
      ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 18; ctx.stroke();
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

  const rw = 160, rh = 78, rx = 960 - 18 - rw, ry = 56;
  rpath(rx, ry, rw, rh, 12); ctx.fillStyle = 'rgba(10,12,24,0.82)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,216,74,0.3)'; ctx.stroke();
  txt('目标: ' + Math.min(kills, ST[cur].k) + '/' + ST[cur].k + (bs ? ' (BOSS)' : ''), rx + rw - 12, ry + 18, 13, '#ffd84a', 'right');
  txt('战利品: +' + RG + ' G', rx + rw - 12, ry + 39, 13, '#7dff9a', 'right');
  txt('药水: [1]×' + S.hp + '  [2]×' + S.mp, rx + rw - 12, ry + 59, 12, '#9df', 'right');

  const henshinPrompt = P.ryuki ? '[P] 解除变身' : (S.eqCap === 'ryuki' ? '[P] 龙骑变身' : '[P] 变身');
  txt('J 剑击   L 飞剑   K 终结技   E 机车   Shift 闪避/疾跑   ' + henshinPrompt + '   [C] 背包   [N] 胶囊   Esc 撤退', 480, 524, 12, '#bbb', 'center');

  const b = E.find(e => e.t === 'boss');
  if (b) {
    rpath(260, 490, 440, 24, 12); ctx.fillStyle = 'rgba(12,14,24,0.88)'; ctx.fill();
    bar(264, 494, 432, 16, b.hp, b.mhp, '#ff4757', '#ff9f43', 8);
    txt((ST[cur].bn || '强敌 BOSS') + ' ' + b.hp + '/' + b.mhp, 480, 502, 12, '#fff', 'center');
  }

  if (G === 'over') {
    rpath(280, 180, 400, 180, 18); ctx.fillStyle = 'rgba(10,12,22,0.92)'; ctx.fill(); ctx.strokeStyle = '#ff4757'; ctx.stroke();
    txt('战败…', 480, 225, 36, '#ff6b81', 'center'); txt('保留一半战利品：金币 +' + FG + '\n按 Enter 回村', 480, 285, 16, '#fff', 'center');
  }
  if (G === 'win') {
    rpath(280, 180, 400, 180, 18); ctx.fillStyle = 'rgba(10,12,22,0.92)'; ctx.fill(); ctx.strokeStyle = '#ffd84a'; ctx.stroke();
    txt('关卡完成！', 480, 225, 38, '#ffd84a', 'center'); txt('通关奖赏：金币 +' + FG + '   Lv.' + S.lv + '\n按 Enter 前往下一战役', 480, 285, 16, '#fff', 'center');
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
  upd(dt);
  draw();
  for (const k in PR) delete PR[k];
  requestAnimationFrame(loop);
})(last);

// 键盘事件监听
addEventListener('keydown', e => { if (!K[e.code]) PR[e.code] = 1; K[e.code] = 1; if (/Space|Arrow/.test(e.code)) e.preventDefault() });
addEventListener('keyup', e => K[e.code] = 0);
addEventListener('blur', () => { for (const k in K) K[k] = 0 });

// 传送门滑动监听
window.addEventListener('pointermove', e => {
  if (!isDraggingChap) return;
  const r = cv.getBoundingClientRect();
  const curX = (e.clientX - r.left) / r.width * 960;
  const dx = curX - dragStartX;
  const tabW = 230, tabGap = 10, chapListW = 680 - 172;
  const minScroll = Math.min(0, chapListW - CHAPTERS.length * (tabW + tabGap));
  chapScrollX = cl(dragStartScrollX + dx, minScroll - 40, 40);
});
window.addEventListener('pointerup', () => { isDraggingChap = false });
window.addEventListener('pointercancel', () => { isDraggingChap = false });

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
    ['变身', 'trf sm', 'left:calc(2vmin + var(--s)*.1);bottom:calc(var(--s)*1.5 + 3vmin)', ['KeyP']],
    ['胶囊', 'sm', 'left:calc(2vmin + var(--s)*.1);bottom:calc(var(--s)*2.5 + 3.5vmin)', ['KeyN']],
    ['药①', 'sm', 'left:calc(2vmin + var(--s)*.95);bottom:calc(var(--s)*1.5 + 3vmin)', ['Digit1']],
    ['药②', 'sm', 'left:calc(2vmin + var(--s)*.18);bottom:calc(var(--s)*1.5 + 3vmin)', ['Digit2']],
    ['▲', 'sm', 'left:calc(50% - var(--s)*1.55);bottom:2vmin', ['KeyW']],
    ['✔<br>互动', 'sm', 'left:calc(50% - var(--s)*.36);bottom:2vmin;width:var(--s);height:var(--s);font-size:calc(var(--s)*.24)', ['KeyF', 'Enter']],
    ['▼', 'sm', 'left:calc(50% + var(--s)*.83);bottom:2vmin', ['KeyS']],
    ['背包<br>规格', 'sm', 'left:calc(50% - var(--s)*1.2);top:1vmin;opacity:.85', ['KeyC']],
    ['关闭<br>撤退', 'sm', 'left:calc(50% + var(--s)*.48);top:1vmin;opacity:.75', ['Escape'], 1],
  ];

  const ui = document.createElement('div'); ui.id = 'tc';
  const pad = document.createElement('div'); pad.id = 'pad'; pad.innerHTML = '<i>◀</i><i>▶</i>'; ui.appendChild(pad);
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
  setInterval(() => {
    if (!dgBtn) return;
    const cd = G === 'play' ? Math.max(0, P.dcd / DODGE_CD) : 0;
    dgBtn.style.background = cd > 0 ? `conic-gradient(rgba(0,0,0,.6) ${cd * 360}deg, rgba(0,190,200,.5) 0)` : '';
    dgBtn.style.borderColor = P.exh ? '#ff6b6b' : '';
  }, 80);

  if (document.documentElement.requestFullscreen) {
    const f = document.createElement('div'); f.className = 'b sm'; f.textContent = '⛶'; f.style.cssText = 'left:calc(50% + var(--s)*1.25);top:1vmin;opacity:.75';
    f.addEventListener('pointerdown', e => { e.preventDefault(); document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => { })).catch(() => { }) });
    ui.appendChild(f);
  }
  if (TOUCH) document.body.appendChild(ui);

  const arrows = pad.querySelectorAll('i');
  const setDir = e => {
    const r = pad.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, l = x < .45, rt = x > .55;
    l ? press('KeyA') : rel('KeyA'); rt ? press('KeyD') : rel('KeyD'); arrows[0].classList.toggle('on', l); arrows[1].classList.toggle('on', rt); pad.classList.toggle('on', l || rt)
  };
  const stop = () => { rel('KeyA'); rel('KeyD'); arrows.forEach(a => a.classList.remove('on')); pad.classList.remove('on') };
  pad.addEventListener('pointerdown', e => { e.preventDefault(); pad.setPointerCapture(e.pointerId); setDir(e) });
  pad.addEventListener('pointermove', e => { if (pad.hasPointerCapture(e.pointerId)) setDir(e) });
  pad.addEventListener('pointerup', stop); pad.addEventListener('pointercancel', stop);

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
          if (P.ryuki) { P.ryuki = false; calc(); }
          save();
        } else {
          // 装配胶囊
          S.eqCap = selCap.id;
          save();
          calc();
        }
        return;
      }
      return;
    }

    // 传送门点击交互
    if (M && V.pg === 'st') {
      const pw = 680, ph = 472, px = (960 - pw) / 2, py = 34;
      if (x < px || x > px + pw || y < py || y > py + ph) { M = 0; return; }

      const btmY = py + ph - 58;
      // 点击返回基地
      if (x >= px + 22 && x <= px + 162 && y >= btmY && y <= btmY + 38) { M = 0; return; }
      // 点击立即出征
      if (x >= px + pw - 200 && x <= px + pw - 20 && y >= btmY && y <= btmY + 38) {
        if (selStageIdx <= S.cl) { M = 0; begin(selStageIdx); }
        else { say('该关卡尚未解锁！'); }
        return;
      }

      // 点击章节栏左翻箭头 ◀
      const chapBarY = py + 48;
      if (x >= px + 90 && x <= px + 118 && y >= chapBarY && y <= chapBarY + 28) {
        if (curChapIdx > 0) {
          curChapIdx--;
          const stages = CHAPTERS[curChapIdx].stages;
          const avail = stages.filter(s => s <= S.cl);
          selStageIdx = avail.length > 0 ? avail[avail.length - 1] : stages[0];
          syncChapScroll();
        }
        return;
      }
      // 点击章节栏右翻箭头 ▶
      if (x >= px + pw - 38 && x <= px + pw - 10 && y >= chapBarY && y <= chapBarY + 28) {
        if (curChapIdx < CHAPTERS.length - 1) {
          const nextChap = CHAPTERS[curChapIdx + 1];
          if (nextChap.stages[0] <= S.cl) {
            curChapIdx++;
            const stages = CHAPTERS[curChapIdx].stages;
            const avail = stages.filter(s => s <= S.cl);
            selStageIdx = avail.length > 0 ? avail[avail.length - 1] : stages[0];
            syncChapScroll();
          } else {
            say('下一章节尚未解锁！请先通关当前章节。');
          }
        }
        return;
      }

      // 拖拽或点击章节标签
      const chapListX = px + 126, tabW = 230, tabGap = 10;
      if (y >= chapBarY - 2 && y <= chapBarY + 30 && x >= chapListX && x <= px + pw - 46) {
        isDraggingChap = true; dragStartX = x; dragStartScrollX = chapScrollX;
        CHAPTERS.forEach((chap, idx) => {
          const tabX = chapListX + idx * (tabW + tabGap) + chapScrollX;
          if (x >= tabX && x <= tabX + tabW) {
            if (chap.stages[0] <= S.cl) {
              curChapIdx = idx;
              const stages = CHAPTERS[curChapIdx].stages;
              const avail = stages.filter(s => s <= S.cl);
              selStageIdx = avail.length > 0 ? avail[avail.length - 1] : stages[0];
              syncChapScroll();
            } else {
              say('该章节尚未解锁！请先通关前序章节。');
            }
          }
        });
        return;
      }

      // 点击选定具体关卡
      const stagesY = py + 104;
      const currChap = CHAPTERS[curChapIdx];
      currChap.stages.forEach((stIdx, i) => {
        const sy = stagesY + i * 86, sw = pw - 40, sh = 78;
        if (x >= px + 20 && x <= px + 20 + sw && y >= sy && y <= sy + sh) {
          if (stIdx <= S.cl) {
            if (selStageIdx === stIdx) { M = 0; begin(stIdx); }
            else { selStageIdx = stIdx; }
          } else {
            say('请先通关前置关卡！');
          }
        }
      });
      return;
    }

    // 角色背包面板点击（全选、批量多选与操作）
    if (showChar) {
      if (x >= 845 && x <= 920 && y >= 25 && y <= 55) { showChar = false; return; }
      if (x < 25 || x > 935 || y < 20 || y > 520) { showChar = false; return; }

      const lx = 43, ly = 66;
      // 变身胶囊槽位点击直接呼出胶囊终端
      if (x >= lx + 175 && x <= lx + 175 + 160 && y >= ly + 272 && y <= ly + 272 + 42) {
        showCapModal = true; return;
      }

      const slotLayout = [
        { k: 'weapon', x: lx + 10, y: ly + 128 },
        { k: 'belt', x: lx + 175, y: ly + 128 },
        { k: 'chest', x: lx + 10, y: ly + 176 },
        { k: 'necklace', x: lx + 175, y: ly + 176 },
        { k: 'legs', x: lx + 10, y: ly + 224 },
        { k: 'ring', x: lx + 175, y: ly + 224 },
        { k: 'boots', x: lx + 10, y: ly + 272 }
      ];
      for (const sl of slotLayout) {
        if (x >= sl.x && x <= sl.x + 160 && y >= sl.y && y <= sl.y + 42) {
          const it = S.eq[sl.k];
          if (it) selItem = { item: it, from: 'eq', slotKey: sl.k };
          return;
        }
      }

      const rx = 400, ry = 66;
      const filterKeys = ['all', 'weapon', 'chest', 'belt', 'legs', 'boots', 'necklace', 'ring'];
      const btnW = 58, btnGap = 4;
      for (let idx = 0; idx < filterKeys.length; idx++) {
        const fx = rx + 10 + idx * (btnW + btnGap), fy = ry + 8, fw = btnW, fh = 26;
        if (x >= fx && x <= fx + fw && y >= fy && y <= fy + fh) {
          bagFilter = filterKeys[idx];
          bagPage = 0;
          return;
        }
      }

      const filteredInv = S.inv.filter(it => bagFilter === 'all' || it.slot === bagFilter);

      // 全选/取消全选按钮
      if (x >= rx + 155 && x <= rx + 230 && y >= ry + 36 && y <= ry + 56) {
        selectAllBatch(filteredInv);
        return;
      }

      // 分页切换
      if (x >= rx + 338 && x <= rx + 364 && y >= ry + 36 && y <= ry + 56) {
        if (bagPage > 0) bagPage--;
        return;
      }
      if (x >= rx + 448 && x <= rx + 474 && y >= ry + 36 && y <= ry + 56) {
        const maxPages = Math.max(1, Math.ceil(filteredInv.length / 15));
        if (bagPage < maxPages - 1) bagPage++;
        return;
      }

      // 背包格子与右上角勾选框点击
      const gx0 = rx + 10, gy0 = ry + 60, gw = 95, gh = 48, gap = 4;
      const curPageItems = filteredInv.slice(bagPage * 15, (bagPage + 1) * 15);
      for (let i = 0; i < 15; i++) {
        const col = i % 5, row = (i / 5) | 0;
        const cx = gx0 + col * (gw + gap), cy = gy0 + row * (gh + gap);
        if (x >= cx && x <= cx + gw && y >= cy && y <= cy + gh) {
          const item = curPageItems[i];
          if (!item) return;

          // 点击右上角方框为勾选/取消勾选
          if (x >= cx + gw - 22 && y <= cy + 22) {
            toggleBatchSel(item.id);
          } else {
            selItem = { item, from: 'inv' };
          }
          return;
        }
      }

      // 底部操作栏（批量与单件）
      const detY = ry + 218, btnY = detY + 155, btnH = 34;
      if (batchSel.size > 0) {
        if (x >= rx + 22 && x <= rx + 132 && y >= btnY && y <= btnY + btnH) {
          batchSel.clear(); bagNotice = '已清空勾选'; bagNoticeT = 1.2; return;
        }
        if (x >= rx + 150 && x <= rx + 310 && y >= btnY && y <= btnY + btnH) {
          batchDismantle(); return;
        }
        if (x >= rx + 330 && x <= rx + 475 && y >= btnY && y <= btnY + btnH) {
          batchDiscard(); return;
        }
        return;
      }

      if (selItem && selItem.item) {
        if (x >= rx + 22 && x <= rx + 127 && y >= btnY && y <= btnY + btnH) {
          if (selItem.from === 'eq') unequipItem(selItem.slotKey);
          else equipItem(selItem.item);
          return;
        }
        if (x >= rx + 140 && x <= rx + 245 && y >= btnY && y <= btnY + btnH) { upgradeItem(selItem.item); return; }
        if (x >= rx + 258 && x <= rx + 363 && y >= btnY && y <= btnY + btnH) { dismantleItem(selItem.item); return; }
        if (x >= rx + 376 && x <= rx + 481 && y >= btnY && y <= btnY + btnH) { discardItem(selItem.item); return; }
      }
      return;
    }

    if (G === 'title' || G === 'over' || G === 'win' || (G === 'play' && P.st === 'trans')) return PR.Enter = 1;
    if ((G === 'vil' || G === 'room') && M) {
      if (x < 180 || x > 780 || y < 30 || y > 510) return PR.Escape = 1;
      const n = items().length, lw = 540, k = Math.round((y - 168) / 44);
      if (x >= 210 && x <= 210 + lw && k >= 0 && k < n && Math.abs(y - 168 - k * 44) <= 22) { if (k === V.i) PR.Enter = 1; else V.i = k }
    }
  });

  const relAll = () => { for (const k in K) K[k] = 0 };
  addEventListener('blur', relAll); document.addEventListener('visibilitychange', relAll);
  addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
})();