// ===== 玩家数据与属性 =====
const DODGE_CD = 1.2, SHIFT_HOLD = .2;

const P = {
  x: 300, y: GY, vx: 0, vy: 0, f: 1, hp: 100, mh: 100, mp: 100, mm: 100, atk: 14, cr: .05, def: 0,
  st: 'trans', t: 0, inv: 0, land: 0, cd: { e: 0 }, h: 0, hit: {}, ryuki: false,
  sta: 100, stm: 100, dcd: 0, exh: false, spr: false, shDown: false, shT: 0, gt: 0, sreg: 0
};

function calc() {
  const t = S.ta;
  let eqAtk = 0, eqHp = 0, eqMp = 0, eqCr = 0, eqDef = 0;
  if (S.eq) {
    for (const k in S.eq) {
      const it = S.eq[k];
      if (it && it.stats) {
        if (it.stats.atk) eqAtk += it.stats.atk;
        if (it.stats.hp) eqHp += it.stats.hp;
        if (it.stats.mp) eqMp += it.stats.mp;
        if (it.stats.crit) eqCr += it.stats.crit;
        if (it.stats.def) eqDef += it.stats.def;
      }
    }
  }

  // 基础强化攻击+1%/级，生命+5%/级，受到伤害-0.1%/级，魔力+3%/级（无上限乘算）
  let bAtk = (14 + S.lv * 3 + eqAtk) * (1 + .08 * t[0]) * (1 + 0.01 * S.sw);
  let bCr = .05 + .03 * t[3] + eqCr;
  if (P.ryuki) { bAtk *= 1.3; bCr += .15; }
  P.atk = Math.round(bAtk);
  P.mh = Math.round((100 + S.lv * 15 + eqHp) * (1 + .1 * t[1]) * (1 + 0.05 * S.ar));
  P.mm = Math.round((100 + S.lv * 8 + eqMp) * (1 + .1 * t[2]) * (1 + 0.03 * S.bt));
  P.cr = Math.min(1, bCr);
  // 受到伤害 -0.1%/级 -> 免伤增加 S.ar * 0.001
  P.def = Math.min(0.95, (S.ar * 0.001) + (eqDef * 0.005));
  P.stm = (100 + S.lv * 2) | 0;
}
calc();

function walk(dt, R) {
  const d = ((K.KeyD || K.ArrowRight) ? 1 : 0) - ((K.KeyA || K.ArrowLeft) ? 1 : 0);
  P.vx = d * 260; if (d) P.f = d;
  if ((PR.Space || PR.KeyW || PR.ArrowUp) && P.y >= GY) P.vy = -700;
  P.vy += 1900 * dt;
  P.y = Math.min(GY, P.y + P.vy * dt);
  if (P.y >= GY) P.vy = 0;
  P.x = cl(P.x + P.vx * dt, 40, R);
  if (P.st !== 'trans_ryuki') P.st = P.y < GY ? 'air' : d ? 'run' : 'idle';
}

function triggerRyukiTransform() {
  if (P.ryuki) {
    P.ryuki = false; P.inv = 0.5; P.st = 'idle'; calc(); shake = 8;
    DT.push({ x: P.x, y: P.y - 180, s: '解除变身 · 恢复原生装甲', t: 1.4, c: '#00e5ff' });
  } else if (S.eqCap === 'ryuki') {
    if (P.st !== 'trans_ryuki') {
      P.st = 'trans_ryuki'; P.t = 0; P.inv = 2.5; P.hit = {};
      DT.push({ x: P.x, y: P.y - 180, s: 'KAMEN RIDE: RYUKI!', t: 1.5, c: '#ff4757' });
    }
  } else {
    DT.push({ x: P.x, y: P.y - 180, s: '尚未装备变身胶囊！按 [N] 键查看契约终端', t: 1.4, c: '#ffd84a' });
  }
}

function drawP() {
  for (const g of GH) {
    const sv = { x: P.x, y: P.y, f: P.f, st: P.st, inv: P.inv, land: P.land };
    P.x = g.x; P.y = g.y; P.f = g.f; P.st = g.st; P.inv = 0; P.land = 0;
    ctx.save(); ctx.globalAlpha = g.t / g.d * .5; ctx.globalCompositeOperation = 'lighter';
    drawP0(); ctx.restore();
    Object.assign(P, sv);
  }
  drawP0();
}

function drawP0() {
  const x = P.x - cam, y = P.y, f = P.f;
  if (P.inv > 0 && (T * 20 | 0) % 2 && P.st !== 'fv' && P.st !== 'dash' && P.st !== 'dodge' && P.st !== 'trans_ryuki') return;

  if (P.st === 'trans_ryuki' && SH.ryukiTrans) {
    const frame = Math.min(15, Math.floor(P.t / 0.12));
    ctx.save();
    if (frame >= 8 && frame <= 13) { ctx.shadowColor = '#ff3838'; ctx.shadowBlur = 28; }
    dr(SH.ryukiTrans, frame, x, y, f, 1.0);
    ctx.restore();
    return;
  }

  if (P.st === 'dash') {
    const s = 230 / BK.width;
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = 'rgba(255,210,90,' + (.5 - i * .1) + ')';
      ctx.fillRect(x - f * (120 + i * 40) - 20, y - 40 - i * 12, 40, 4);
    }
    ctx.save(); ctx.translate(x, y); ctx.scale(f * s, s);
    ctx.drawImage(BK, -BK.width / 2, -BK.height);
    ctx.restore(); return;
  }

  if (P.st === 'dodge') {
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = 'rgba(120,240,255,' + (.5 - i * .09) + ')';
      ctx.fillRect(x - f * (30 + i * 34) - 18, y - 150 + i * 22, 36, 3);
    }
    ctx.save();
    ctx.translate(x, y); ctx.rotate(f * .22); ctx.translate(-x, -y);
    ctx.shadowColor = P.ryuki ? '#ff4757' : '#00e5ff'; ctx.shadowBlur = 16;
    if (P.ryuki && SHR.run && SHR.run.f && SHR.run.f.length) dr(SHR.run, (T * 20 | 0) % SHR.run.f.length, x, y, f, 1.0);
    else dr(SH.run, (T * 20 | 0) % 12, x, y, f, 1.0);
    ctx.restore();
    return;
  }
  if (P.spr) {
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = 'rgba(255,255,255,' + (.35 - i * .1) + ')';
      ctx.fillRect(x - f * (50 + i * 30) - 15, y - 40 - i * 45, 30, 2);
    }
  }

  // 1. 变身状态：假面骑士龙骑专属渲染
  if (P.ryuki) {
    ctx.save();
    ctx.shadowColor = '#ff4757';
    ctx.shadowBlur = (P.st === 'run') ? 4 : (10 + Math.sin(T * 6) * 4);

    if (P.st === 'run') {
      if (SHR.run && SHR.run.f && SHR.run.f.length) {
        if (!SHR.run.bbs) SHR.run.bbs = SHR.run.f.map(fr => bb(fr));
        const totalRunFrames = 4;
        const runIdx = (T * (P.spr ? 13 : 9) | 0) % totalRunFrames;
        const b = SHR.run.bbs[runIdx];
        const realCenterX = (b.x0 + b.x1) / 2;
        const realFootY = b.y1;

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(f * SHR.run.s, SHR.run.s);
        ctx.drawImage(SHR.run.f[runIdx], -realCenterX, -realFootY);
        ctx.restore();
      } else {
        dr(SH.run, (T * (P.spr ? 20 : 12) | 0) % 12, x, y, f, 1.0);
      }
    } else if (P.st === 'atk') {
      if (SHR.atk && SHR.atk.f && SHR.atk.f.length) {
        const total = SHR.atk.f.length;
        const atkIdx = Math.min(total - 1, (P.t * 16 | 0) % total);
        dr(SHR.atk, atkIdx, x, y, f, 1.0);
      } else {
        const i = [3, 4, 5, 6, 7, 8][Math.min(5, P.t * 14 | 0)];
        dr(SH.atk, i, x, y, f, 1.0);
      }
    } else if (P.st === 'idle' && P.land > 0 && SHR.jump && SHR.jump.f && SHR.jump.f.length) {
      dr(SHR.jump, 7, x, y, f, 1.0);
    } else if (P.st === 'idle' || P.st === 'trans') {
      if (SH.ryukiTrans && SH.ryukiTrans.f[15]) {
        const breath = Math.sin(T * 3) * 1.2;
        dr(SH.ryukiTrans, 15, x, y + breath, f, 1.0);
      } else {
        dr(SH.atk, 12, x, y, f, 1.0);
      }
    } else if (P.st === 'air') {
      if (SHR.jump && SHR.jump.f && SHR.jump.f.length) {
        const i = P.vy < -350 ? 2 : P.vy < -100 ? 3 : P.vy < 100 ? 4 : P.vy < 250 ? 5 : 6;
        dr(SHR.jump, i, x, y, f, 1.0);
      } else if (SHR.run && SHR.run.f[1]) {
        dr(SHR.run, 1, x, y - 5, f, 1.0);
      } else {
        dr(SH.jump, 2, x, y, f, 1.0);
      }
    } else if (P.st === 'thr' && SHR.atk && SHR.atk.f) {
      dr(SHR.atk, P.t < .12 ? 3 : 4, x, y, f, 1.0);
    } else if (P.st === 'fv') {
      const fvSheet = (SHR.fv && SHR.fv.f && SHR.fv.f.length) ? SHR.fv : SH.atk;
      let i = 0;
      const lt = P.t;
      if (lt < 0.18) i = 0;
      else if (lt < 0.36) i = 1;
      else if (lt < 0.65) i = 3;
      else if (lt < 0.78) i = 4;
      else if (lt < 0.98) i = 5;
      else if (lt < 1.12) i = 6;
      else if (lt < 1.30) i = 7;
      else if (lt < 1.48) i = 9;
      else if (P.y < GY - 10) i = 10;
      else if (P.landT && lt - P.landT < 0.25) i = 11;
      else if (P.landT && lt - P.landT < 0.45) i = 13;
      else if (P.landT && lt - P.landT < 0.65) i = 14;
      else i = 15;

      dr(fvSheet, i, x, y, f, 1.0);
    } else {
      let S = SH.atk, i = 12;
      if (P.st === 'thr') i = P.t < .12 ? 3 : 4;
      dr(S, i, x, y, f, 1.0);
    }

    ctx.restore();
    return;
  }

  // 2. 原生 Malaya 动作渲染
  let S, i, lift = 0;
  switch (P.st) {
    case 'trans': S = SH.trans; i = Math.min(15, P.t * 7 | 0); break;
    case 'run': S = SH.run; i = (T * (P.spr ? 22 : 14) | 0) % 12; break;
    case 'air': S = SH.jump; i = P.vy < -250 ? 2 : P.vy < 0 ? 4 : P.vy < 250 ? 6 : 5; break;
    case 'atk': S = SH.atk; i = [3, 4, 5, 6, 7, 8][Math.min(5, P.t * 14 | 0)]; break;
    case 'thr': S = SH.atk; i = P.t < .12 ? 3 : 4; break;
    case 'fv':
      S = SH.fv;
      if (P.t < .99) {
        const k = P.t / .11 | 0;
        i = k + 1;
        if (k >= 4) lift = 50;
      } else {
        i = P.t < 1.3 ? 12 : (P.t < 1.4 ? 13 : 14);
      }
      break;
    default: if (P.land > 0) { S = SH.jump; i = 9; } else { S = SH.atk; i = 12 + (T * 2 | 0) % 2; }
  }
  dr(S, i, x, y - lift, f);
}