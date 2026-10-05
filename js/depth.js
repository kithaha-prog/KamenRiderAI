// ===== 2.5D 纵深系统（清版动作式「车道」）=====
// 思路：世界逻辑仍是 2D（x 横向、y 高度，GY 为地面基线），额外加一条「纵深轴 z」：
//   z < 0 = 远处（屏幕偏上、略小）　z > 0 = 近处（屏幕偏下、略大）　范围 [zMin, zMax]
//   · 玩家 W/S（↑/↓）在地面换道；Shift 闪避时按住 W/S 可「斜向/纵向闪避」
//   · 玩家攻击只命中「同一车道」的敌人；敌方弹幕 / 地面技 / 肉体冲撞只命中同车道的玩家
//   · 敌人会缓慢向玩家车道靠拢（前摇期间不换道，所以看到预警后换道就能躲）
//   · 绘制按 z 排序（远的先画），并带透视缩放与地面阴影
// 联机（COOP）与塔防不启用，行为与原来完全一致；设置里可随时切回经典 2D。
// 想调手感：只改下面 DEPTH 里的数值。
const DEPTH = {
  zMin: -70, zMax: 46,     // 车道范围（像素）
  spd: 210,                // 玩家换道速度
  tol: 30,                 // 玩家攻击的纵向命中容差（Boss 额外 +16）
  bodyTol: 30,             // 敌人肉体冲撞的纵向容差
  epTol: 30,               // 敌方弹幕的纵向容差（大弹幕按半径再加一点）
  hzTol: 44,               // 敌方地面技 / 光柱 / 激光的纵向半宽
  persp: 0.0016,           // 透视：每像素 z 缩放 0.16%
  lane: true,              // 是否绘制淡淡的车道边界线
  key: 'kr_depth25'
};
DEPTH.on = (() => { try { return localStorage.getItem(DEPTH.key) !== '0'; } catch (e) { return true; } })();

function depthSetOn(v) {
  DEPTH.on = !!v;
  try { localStorage.setItem(DEPTH.key, v ? '1' : '0'); } catch (e) { }
  if (!DEPTH.on) { P.z = 0; P.vz = 0; }
}

// 只有「单人战斗」才启用；其余场景（基地 / 联机 / 塔防）一律当作 z = 0
function depthActive() {
  return DEPTH.on && G === 'play' && !(typeof COOP !== 'undefined' && COOP.active && COOP.inGame);
}
const zv = o => (o && depthActive()) ? (o.z || 0) : 0;      // 取对象的有效 z
const depthPz = () => depthActive() ? (P.z || 0) : 0;
function depthStamp(o) {                                      // 没有 z 的对象：记下创建时玩家所在车道
  if (o.z === undefined) o.z = depthActive() ? (P.z || 0) : 0;
  return o.z;
}

// 敌人 e 是否在 src 车道（默认玩家车道）的攻击范围内
function zOk(e, src, tol) {
  if (!depthActive()) return true;
  const s = src === undefined ? (P.z || 0) : src;
  return Math.abs((e.z || 0) - s) <= (tol || DEPTH.tol) + (e.t === 'boss' ? 16 : 0);
}
const zBodyOk = e => !depthActive() || Math.abs((e.z || 0) - (P.z || 0)) <= DEPTH.bodyTol + (e.t === 'boss' ? 16 : 0);
const zEpOk = p => !depthActive() || Math.abs((p.z || 0) - (P.z || 0)) <= DEPTH.epTol + Math.min(30, (p.r || 10) * .4);
const zLaneOk = (o, tol) => !depthActive() || Math.abs((o.z || 0) - (P.z || 0)) <= tol;

// 敌人向玩家车道靠拢（updEnemy 的「正常行动」分支调用；前摇 / 冲锋期间不会调用）
function depthEnemyLane(e, dt) {
  if (e.z === undefined) e.z = 0;
  const sp = e.t === 'boss' ? 62 : e.t === 'wd' ? 85 : 105;
  const dz = (P.z || 0) - e.z;
  if (Math.abs(dz) > 8) e.z = cl(e.z + Math.sign(dz) * Math.min(Math.abs(dz), sp * dt), DEPTH.zMin, DEPTH.zMax);
}

// 每帧：玩家换道 + 给新生成的特效 / 掉落物 / 伤害数字记录车道（main.js 的 upd 在位移前调用）
function depthUpd(dt) {
  if (!depthActive()) { P.z = 0; P.vz = 0; return; }
  const lock = P.down || (typeof COOP !== 'undefined' && COOP.channeling);
  const dz = lock ? 0 : ((K.KeyS || K.ArrowDown ? 1 : 0) - (K.KeyW || K.ArrowUp ? 1 : 0));
  if (P.vz === undefined) P.vz = 0;
  if (P.st === 'dodge') {
    P.vz *= Math.max(0, 1 - dt * 2.6);                       // 闪避中纵向惯性衰减
  } else {
    let mul = (P.st === 'idle' || P.st === 'run') ? 1 : (P.st === 'atk' || P.st === 'thr') ? .5 : 0;
    if (P.y < GY - 1) mul = 0;                               // 空中不能换道（S + 攻击 = 下砸 保持不变）
    const want = dz * DEPTH.spd * mul * (P.slow > 0 ? .55 : 1);
    P.vz += (want - P.vz) * Math.min(1, 16 * dt);
  }
  P.z = cl((P.z || 0) + P.vz * dt, DEPTH.zMin, DEPTH.zMax);
  if (P.z <= DEPTH.zMin || P.z >= DEPTH.zMax) P.vz = 0;

  const pz = P.z || 0;
  for (const f of FX) if (f.z === undefined) f.z = pz;
  for (const d of DT) if (d.z === undefined) d.z = pz;
  for (const o of OR) if (o.z === undefined) o.z = pz;
}

// ---------- 绘制 ----------
// 把后续绘制「搬」到车道 z：以脚下 (wx, GY) 为支点平移 + 透视缩放；必须与一次 ctx.restore() 配对
function depthBegin(wx, z) {
  ctx.save();
  if (!z) return;
  const px = wx - cam, k = 1 + z * DEPTH.persp;
  ctx.translate(px, GY + z); ctx.scale(k, k); ctx.translate(-px, -GY);
}
// 地面阴影（空中单位的阴影留在地面，方便判断落点）
function depthShadow(wx, z, w, a) {
  if (!depthActive()) return;
  const k = 1 + z * DEPTH.persp;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,' + a + ')';
  ctx.beginPath(); ctx.ellipse(wx - cam, GY + z + 3, Math.max(24, w * .38) * k, 8 * k, 0, 0, 7); ctx.fill();
  ctx.restore();
}
// 车道边界提示线（bg() 之后调用）
function depthDrawLane() {
  if (!DEPTH.lane || !depthActive()) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 1.5; ctx.setLineDash([14, 10]);
  for (const z of [DEPTH.zMin - 6, DEPTH.zMax + 6]) {
    ctx.beginPath(); ctx.moveTo(0, GY + z); ctx.lineTo(960, GY + z); ctx.stroke();
  }
  ctx.restore();
}
