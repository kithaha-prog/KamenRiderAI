// ===== 玩家数据与属性 =====
const DODGE_CD = 0.7, SHIFT_HOLD = .2; // ★ 闪避 CD 从 1.2s 缩短至 0.7s，更加连贯

const P = {
  x: 300, y: GY, vx: 0, vy: 0, f: 1, hp: 100, mh: 100, mp: 100, mm: 100, atk: 14, cr: .05, def: 0,
  st: 'trans', t: 0, inv: 0, land: 0, cd: { e: 0, k: 0, l: 0, p: 0 },
  maxCd: { e: 7, k: 16, l: 2, p: 5 }, h: 0, hit: {}, ryuki: false, k5: false, bl: false, zeztz: false, dn: false, trk: null,
  sta: 100, stm: 100, dcd: 0, exh: false, spr: false, shDown: false, shT: 0, gt: 0, sreg: 0, slow: 0, psn: 0, down: false
};

function curRiderKey() {
  return P.ryuki ? 'ryuki' : P.k5 ? '555' : P.bl ? 'blade' : P.zeztz ? 'zeztz' : P.dn ? 'deno' : 'malaya';
}

function getSkillCD(key) {
  const rk = curRiderKey();
  let v = (SKILL_CDS[rk] && SKILL_CDS[rk][key]) || 5.0;
  if ((key === 'l' || key === 'e') && typeof capCdMul === 'function') v *= capCdMul();
  return v;
}

function okS(o) {
  return !!(o && Array.isArray(o.f) && o.f.length);
}

function calc() {
  const t = S.ta;
  const oldMh = P.mh, oldMm = P.mm;

  // 将原先的兜底数值对齐新基数：
  const st = (typeof previewStats === 'function') 
    ? previewStats(S.eq, true)
    : { atk: 14 + S.lv * 8, hp: 100 + S.lv * 25, mp: 100 + S.lv * 0.8, cr: 0.05, def: 0 };

  P.atkRaw = st.atk; P.mhRaw = st.hp; P.mmRaw = st.mp;
  P.atk = Math.round(st.atk);
  P.mh = Math.round(st.hp);
  P.mm = Math.round(st.mp);
  P.cr = st.cr;
  if (typeof tagNormalize === 'function') tagNormalize();                       // 双胶囊：主/副位自洽
  if (typeof tagCrBonus === 'function') P.cr += tagCrBonus();                   // 切人突袭：进场暴击增益
  P.def = st.def;
  P.stm = (100 + S.lv * 2) | 0;

  if (typeof G !== 'undefined' && (G === 'vil' || G === 'room')) {
    P.hp = P.mh;
    P.mp = P.mm;
    P.sta = P.stm;
  } else {
    P.hp = Math.min(P.mh, P.hp || P.mh);
    P.mp = Math.min(P.mm, P.mp || P.mm);
    P.sta = Math.min(P.stm, P.sta);
  }

  const oldCP = P.cp;
  P.cp = (typeof calcCP === 'function') ? calcCP() : 0;
  if (oldCP !== undefined && P.cp !== oldCP && typeof DT !== 'undefined') {
    const d = P.cp - oldCP;
    DT.push({ x: P.x, y: P.y - 230, s: '战力 ' + (d > 0 ? '+' : '') + d, t: 1.2, c: d > 0 ? '#7dff9a' : '#ff7675' });
  }
}
calc();

function formCap() { 
  return P.ryuki ? CAPSULES.find(c => c.id === 'ryuki') 
       : P.k5 ? CAPSULES.find(c => c.id === '555') 
       : P.bl ? CAPSULES.find(c => c.id === 'blade')
       : P.zeztz ? CAPSULES.find(c => c.id === 'zeztz')
       : P.dn ? CAPSULES.find(c => c.id === 'deno') : null;
}
function inForm() { return P.ryuki || P.k5 || P.bl || P.zeztz || P.dn; }
function formCol() { return P.ryuki ? '#ff4757' : P.k5 ? '#ffb400' : P.bl ? '#3aa0ff' : P.zeztz ? '#00f2fe' : P.dn ? '#ff3b30' : '#00e5ff'; }
function clearForms() { P.ryuki = false; P.k5 = false; P.bl = false; P.zeztz = false; P.dn = false; }
function lSkillName() { return P.k5 ? '手枪' : P.bl ? '召雷' : P.zeztz ? '拳压' : P.dn ? '斩击波' : '飞剑'; }
function formName() { return P.ryuki ? 'KAMEN RIDER RYUKI' : P.k5 ? 'KAMEN RIDER 555' : P.bl ? 'KAMEN RIDER BLADE' : P.zeztz ? 'KAMEN RIDER ZEZTZ' : P.dn ? 'KAMEN RIDER DEN-O' : 'KAMEN RIDER MALAYA'; }
function formSpd() { const c = formCap(); return c ? (c.spdMul || 1) : 1; }
function capShort() { const c = CAPSULES.find(c => c.id === S.eqCap); return c ? c.short : ''; }

function walk(dt, R) {
  P.dcd = Math.max(0, (P.dcd || 0) - dt);
  P.gt = Math.max(0, (P.gt || 0) - dt);
  P.spr = false;

  const sh = K.ShiftLeft || K.ShiftRight;
  const shPress = PR.ShiftLeft || PR.ShiftRight;

  // ★ 优化1：按下瞬间立即触发闪避，无需等待抬手松开！
  if (shPress && P.dcd <= 0 && /^(idle|run|air)$/.test(P.st)) {
    const dd = ((K.KeyD || K.ArrowRight) ? 1 : 0) - ((K.KeyA || K.ArrowLeft) ? 1 : 0);
    P.f = dd || P.f;
    P.st = 'dodge';
    P.t = 0;
    P.dcd = DODGE_CD;
    P.vy = 0;
    P.vx = P.f * 1200; // ★ 初速度 820 -> 1200
  }

  // ★ 优化2：位移持续时间增至 0.36s，总位移翻倍（可达 350+ 像素）
  if (P.st === 'dodge') {
    P.t += dt;
    P.inv = Math.max(P.inv, 0.45);
    P.vx = P.f * 1200 * Math.max(0, 1 - (P.t / 0.36) * 0.65);
    if (P.t >= 0.36) {
      P.st = (P.y < GY) ? 'air' : 'idle';
      P.vx = 0;
      P.inv = Math.max(P.inv, 0.15); // 结束保留安全护盾
    }
  } else {
    // 正常走动；若玩家持续按住 Shift 则无缝进入疾跑
    const d = ((K.KeyD || K.ArrowRight) ? 1 : 0) - ((K.KeyA || K.ArrowLeft) ? 1 : 0);
    let spd = (260 + S.lv * 4) * formSpd() * (1 + (typeof affixTotal === 'function' ? affixTotal('spd') : 0));
    // ★ Style Rank 连击移速加成（D级 +2% ~ SSS级 +25%）
    if (typeof COMBO !== 'undefined' && COMBO.count > 0 && typeof STYLE_RANKS !== 'undefined') {
      spd *= (STYLE_RANKS[COMBO.rankIdx] ? STYLE_RANKS[COMBO.rankIdx].spdMul : 1.0);
    }
    if (sh && d) {
      spd *= 1.75;
      P.spr = true;
    }
    P.vx = d * spd;
    if (d) P.f = d;

    if ((PR.Space || PR.KeyW || PR.ArrowUp) && P.y >= GY) {
      P.vy = -700;
      P.st = 'air';
    }
  }

  if (P.st !== 'dodge') {
    P.vy += 1900 * dt;
    P.y = Math.min(GY, P.y + P.vy * dt);
    if (P.y >= GY) {
      P.y = GY;
      P.vy = 0;
    }
  }

  P.x = cl(P.x + P.vx * dt, 40, R);

  if (P.st !== 'trans_ryuki' && P.st !== 'dodge') {
    P.st = P.y < GY ? 'air' : P.vx ? 'run' : 'idle';
  }

  if ((P.st === 'dodge' || P.spr) && P.gt <= 0) {
    P.gt = .038;
    GH.push({ x: P.x, y: P.y, f: P.f, st: P.st, t: .32, d: .32 });
  }
}

function triggerRyukiTransform() {
  if (P.down || (typeof COOP !== 'undefined' && COOP.channeling)) return;
  if (P.cd.p > 0) {
    DT.push({ x: P.x, y: P.y - 180, s: '变身冷却中 ' + P.cd.p.toFixed(1) + 's', t: 0.8, c: '#ffa502' });
    return;
  }
  
  if (P.ryuki || P.k5 || P.bl || P.zeztz || P.dn) {
    P.ryuki = false; P.k5 = false; P.bl = false; P.zeztz = false; P.dn = false; P.inv = 0.5; P.st = 'idle'; calc(); shake = 8;
    P.cd.p = getSkillCD('p'); P.maxCd.p = P.cd.p;
    DT.push({ x: P.x, y: P.y - 180, s: '解除变身 · 恢复原生装甲', t: 1.4, c: '#00e5ff' });
  } else if (S.eqCap === 'ryuki' || S.eqCap === '555' || S.eqCap === 'blade' || S.eqCap === 'zeztz' || S.eqCap === 'deno') {
    if (P.st !== 'trans_ryuki') {
      const is5 = S.eqCap === '555', isB = S.eqCap === 'blade', isZ = S.eqCap === 'zeztz', isD = S.eqCap === 'deno';
      P.st = 'trans_ryuki'; P.trk = S.eqCap; P.t = 0; P.inv = 2.5; P.hit = {};
      P.cd.p = getSkillCD('p'); P.maxCd.p = P.cd.p;
      P.tdur = isD ? denoTransDur() : isZ ? zeztzTransDur() : isB ? bladeTransDur() : is5 ? faizTransDur() : ryukiTransDur();
      if (isD) playDenoHenshin();
      else if (isZ) playZeztzHenshin();
      else if (isB) playBladeHenshin(); 
      else if (is5) playFaizHenshin(); 
      else playRyukiHenshin();
      if (typeof henshinApply === 'function') henshinApply(S.eqCap);   // 精简变身：跳到爆发段并缩短时长
      
      DT.push({ x: P.x, y: P.y - 180, s: isD ? 'DEN-O · 変身！' : isZ ? 'IMPACT ZEZTZ!' : isB ? '变身！' : is5 ? 'STANDING BY…' : 'KAMEN RIDE: RYUKI!', t: 1.5, c: isD ? '#ff3b30' : isZ ? '#00f2fe' : isB ? '#3aa0ff' : is5 ? '#ffb400' : '#ff4757' });
    }
  } else {
    DT.push({ x: P.x, y: P.y - 180, s: '尚未装备变身胶囊！按 [N] 键查看契约终端', t: 1.4, c: '#ffd84a' });
  }
}

function drawP() {
  for (const g of GH) {
    const sv = { x: P.x, y: P.y, f: P.f, st: P.st, inv: P.inv, land: P.land, ryuki: P.ryuki, k5: P.k5, bl: P.bl, zeztz: P.zeztz, dn: P.dn, t: P.t, hit: P.hit };
    P.x = g.x; P.y = g.y; P.f = g.f; P.st = g.st; P.inv = 0; P.land = 0;
    if (g.rf) { P.ryuki = g.rf.ryuki; P.k5 = g.rf.k5; P.bl = g.rf.bl; P.zeztz = g.rf.zeztz; P.dn = !!g.rf.dn; P.t = g.pt || 0; P.hit = {}; }   // 联机队友的残影用队友自己的形态
    ctx.save(); ctx.globalAlpha = g.t / g.d * .5; ctx.globalCompositeOperation = 'lighter';
    drawP0(); ctx.restore();
    Object.assign(P, sv);
  }
  if (P.down) {
    const dx = sn(P.x - cam), dy = sn(P.y);
    ctx.save(); ctx.translate(dx, dy); ctx.rotate(-P.f * Math.PI / 2); ctx.translate(-dx, -dy);
    ctx.globalAlpha = .8; drawP0(); ctx.restore();
  } else drawP0();
  if (P.slow > 0) txt('❄', P.x - cam - 14, P.y - 215, 16, '#8ad0ff', 'center');
  if (P.psn > 0) txt('☠', P.x - cam + 14, P.y - 215, 16, '#7dff5a', 'center');
}

function drawP0() {
  const x = sn(P.x - cam), y = sn(P.y), f = P.f;
  if (P.inv > 0 && (T * 20 | 0) % 2 && P.st !== 'fv' && P.st !== 'dash' && P.st !== 'dodge' && P.st !== 'trans_ryuki' && P.st !== 'trans' && P.st !== 'trans_malaya') return;

  if (P.st === 'trans') {
    drawMalayaTransform(x, y, f);
    return;
  }
  if (P.st === 'trans_ryuki' && P.trk === 'blade') { drawBladeTransform(x, y, f); return; }
  if (P.st === 'trans_ryuki' && P.trk === 'deno') { drawDenoTransform(x, y, f); return; }
  if (P.st === 'trans_ryuki' && (P.trk === '555' || P.trk === 'ryuki') && typeof henReady === 'function' && henReady()) { drawHenshin(x, y, f); return; }
  if (P.st === 'trans_ryuki' && P.trk === '555') { drawFaizTransform(x, y, f); return; }
  if (P.st === 'trans_ryuki' && P.trk === 'zeztz') { drawZeztzTransform(x, y, f); return; }
  if (P.st === 'trans_ryuki' && SH.ryukiTrans) { drawRyukiTransform(x, y, f); return; }
  
  // ===== 在 drawP0() 的状态分支中增加对新派生动作的贴图渲染映射 =====

  // 1. 升龙击姿态：复用跳跃拔起或挥刀帧
  if (P.st === 'uppercut') {
    const i = Math.min(SH.jump.f.length - 1, Math.floor(P.t * 12));
    dr(SH.jump, i, x, y, f, 1.0);
    return;
  }

  // 2. 空中下砸俯冲姿态：身体向前倾斜下刺
  if (P.st === 'diveslam') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(f * 0.45); // 向前倾斜下刺角度
    ctx.translate(-x, -y);
    dr(SH.jump, 4, x, y, f, 1.0);
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
    ctx.shadowColor = inForm() ? formCol() : '#00e5ff'; ctx.shadowBlur = 16;
    if (P.ryuki && SHR.run && SHR.run.f && SHR.run.f.length) dr(SHR.run, (T * 20 | 0) % SHR.run.f.length, x, y, f, 1.0);
    else if (P.k5 && okS(SH5.run)) dr(SH5.run, (T * 20 | 0) % SH5.run.f.length, x, y, f, 1.0);
    else if (P.bl && okS(SH6.run)) drBR((T * 20 | 0) % SH6.run.f.length, x, y, f);
    else if (P.zeztz && okS(SHZ.run)) dr(SHZ.run, (T * 20 | 0) % SHZ.run.f.length, x, y, f, 1.0);
    else if (P.dn && okS(SHD.run)) drDR((T * 20 | 0) % SHD.run.f.length, x, y, f);
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

  if (P.k5) { drawFaiz(x, y, f); return; }
  if (P.bl) { drawBlade(x, y, f); return; }
  if (P.ryuki) { drawRyuki(x, y, f); return; }
  if (P.zeztz) { drawZeztz(x, y, f); return; }
  if (P.dn) { drawDeno(x, y, f); return; }

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