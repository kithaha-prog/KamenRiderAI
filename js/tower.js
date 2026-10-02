// ===== 无尽塔 =====
// 做法：和世界BOSS一样，在 ST 末尾追加一个「特殊关卡」，整套战斗系统原样复用；
// 每次开打前 twCfg(层数) 把这一条关卡的名字 / 击杀目标 / 怪物强度 / 主题改成对应层，再 begin(TOWER.si)。
// 数据：S.tw = { best: 历史最高通关层数 }（随 save() 写入本地与云端）
// 难度：第 f 层 ≈ 单人副本第 2f 关（推荐等级 3 + 5f），所以第 100 层 ≈ 第 200 关，之后继续往上无上限。
//
// 想调平衡：只改下面 tw* 开头的几个函数。
const TOWER = { col: '#a55eea', si: ST.length };
ST.push({ n: '无尽塔', k: 20, b: 0, bn: '', wd: .2, g: 150, r: 8, ov: '', set: 1, tw: 1, floor: 1, hpx: 1, hm: 1, dm: 1 });

function twData() {
  if (!S.tw || typeof S.tw !== 'object') S.tw = { best: 0 };
  if (typeof S.tw.best !== 'number') S.tw.best = 0;
  return S.tw;
}
const twBest = () => twData().best | 0;
const twFrontier = () => twBest() + 1;                          // 下一个没通关的层
const twIsBoss = f => f % 10 === 0;                              // 每 10 层一个首领
const twSet = f => ((((f - 1) / 10) | 0) % 10) + 1;               // 每 10 层换一套章节主题（1~10 循环）
const twRec = f => 3 + f * 5;                                    // 推荐等级
const twGold = f => Math.round(400 * Math.pow(1.055, Math.min(199, f * 2)));
const twDiam = f => twIsBoss(f) ? 200 : 100;                        // 首通钻石
const twShard = f => twIsBoss(f) ? 5 : 0;                        // 首通契约碎片（首领层）
const twKills = f => twIsBoss(f) ? Math.min(28, 12 + ((f / 10) | 0) * 2) : Math.min(40, 12 + ((f * .5) | 0));
const twBossName = f => CHAPTER_THEMES[twSet(f) - 1].bn;

function twCfg(f) {
  const z = ST[TOWER.si], boss = twIsBoss(f), r = twRec(f);
  Object.assign(z, {
    n: '无尽塔 第 ' + f + ' 层' + (boss ? ' · ' + twBossName(f) : ''),
    k: twKills(f), b: boss ? 1 : 0, bn: boss ? twBossName(f) : '',
    wd: Math.min(.7, .2 + f * .005), g: twGold(f), r, set: twSet(f), floor: f,
    ov: boss ? 'rgba(40,5,60,.46)' : '', hpx: boss ? 2.5 + f * .02 : 1
  });
  z.hm = Math.max(1, +(atkExp(r) * HP_K / 30).toFixed(1));
  z.dm = Math.max(1, +(hpExp(r) * DM_K / 8).toFixed(1));
}

function twStart(f) {
  f = Math.max(1, Math.min(f | 0, twFrontier()));
  twCfg(f);
  PO.ret = 'tower'; M = 0;
  begin(TOWER.si);
}
function pStartTower() { twStart(PO.tw); }

// 结算「下一层」按钮（battle.js 的 settleAct 调用）
function towerNext() {
  const f = ST[cur].floor + 1;
  PO.tw = f;
  twStart(f);
}

// ---------- 结算（battle.js 的 fin 调用）----------
function towerFin(w, z) {
  const f = z.floor, D = twData();
  if (w) {
    const isFirst = f > D.best;
    FG = RG + z.g;
    const s2 = P.hp / P.mh >= 0.5, s3 = stageT <= STAR_TIME;
    const stars = 1 + (s2 ? 1 : 0) + (s3 ? 1 : 0), rank = stars === 3 ? 'S' : stars === 2 ? 'A' : 'B';
    let diam = 0, sh = 0;
    if (isFirst) {
      D.best = f;
      diam = twDiam(f); sh = twShard(f);
      S.d += diam; psDia(diam);
      if (sh) S.csh = (S.csh | 0) + sh;
    }
    FD = diam;
    const expGain = Math.round((z.r * 30 + 50) * (1 + affixTotal('xp')));
    WIN_RES = {
      t: 0, dur: 1.5, stageName: z.n, stars, rank,
      conds: [
        { text: '通关第 ' + f + ' 层', pass: true },
        { text: '剩余生命 ≥ 50%', pass: s2 },
        { text: '通关耗时 ≤ ' + STAR_TIME + '秒 (' + stageT.toFixed(1) + 's)', pass: s3 }
      ],
      gold: FG, diam, isFirst, expGain, time: stageT, tower: f, shards: sh
    };
    gain(expGain, true);
  } else {
    FG = RG >> 1;
    const k = Math.min(kills, z.k);
    LOSE_RES = {
      t: 0, dur: 1.5, stageName: z.n, kills: k, targetKills: z.k,
      killPercent: z.k > 0 ? Math.floor(k / z.k * 100) : 0,
      gold: FG, lostGold: RG - FG, time: stageT,
      tip: S.lv < z.r
        ? '本层推荐 Lv.' + z.r + '（当前 Lv.' + S.lv + '），建议先强化装备或提升等级'
        : '注意使用 [J] 刀刃劈碎弹幕，不可抵消的陨石和地刺请使用 Shift 闪避'
    };
  }
}

// ---------- 扫荡：自动清空「推荐等级 ≤ 当前等级 × 0.6」的层（拿金币 / 钻石 / 碎片，没有经验和掉落）----------
const twSweepTo = () => Math.max(0, Math.floor((S.lv * .6 - 3) / 5));
function twSweep() {
  const to = twSweepTo(), from = twBest() + 1;
  if (to < from) return pToast('当前等级没有可扫荡的层（第 ' + from + ' 层需要 Lv.' + Math.ceil((twRec(from)) / .6) + '）');
  let g = 0, d = 0, s = 0;
  for (let f = from; f <= to; f++) { g += twGold(f); d += twDiam(f); s += twShard(f); }
  S.g += g; S.d += d; psGold(g); psDia(d);
  if (s) S.csh = (S.csh | 0) + s;
  twData().best = to;
  save();
  PO.tw = twFrontier();
  pToast('扫荡第 ' + from + '–' + to + ' 层：+' + g.toLocaleString() + ' 金币 · +' + d + ' 钻石' + (s ? ' · +' + s + ' 碎片' : ''));
}

// ---------- 传送门里的「无尽塔」页（portal.js 调用）----------
function towerPortalUpdate(L, R, U, D, OK) {
  const mx = twFrontier();
  PO.tw = cl(PO.tw | 0, 1, mx);
  if (L) PO.tw = Math.max(1, PO.tw - 1);
  if (R) PO.tw = Math.min(mx, PO.tw + 1);
  if (U) PO.tw = Math.min(mx, PO.tw + 10);
  if (D) PO.tw = Math.max(1, PO.tw - 10);
  if (OK) pStartTower();
}

function drawPoTower() {
  const col = TOWER.col, mx = twFrontier();
  const f = PO.tw = cl(PO.tw | 0, 1, mx);
  const boss = twIsBoss(f), set = twSet(f), r = twRec(f), best = twBest(), first = f > best;
  poFrame(col, '🗼 无尽塔 · 层层攀登');

  // ---- 左：怪物预览 + 选层 ----
  const lx = POX + 24, ly = 84, lw = 300, lh = 354;
  rpath(lx, ly, lw, lh, 16);
  const g = ctx.createLinearGradient(lx, ly, lx + lw, ly + lh);
  g.addColorStop(0, col + '2a'); g.addColorStop(.5, 'rgba(12,16,32,.92)'); g.addColorStop(1, 'rgba(8,10,22,.95)');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = col + '66'; ctx.stroke();

  txt('FLOOR', lx + lw / 2, ly + 24, 11, col, 'center');
  txt('第 ' + f + ' 层', lx + lw / 2, ly + 56, 34, '#ffd84a', 'center');
  txt(boss ? '👑 首领层 · ' + twBossName(f) : '普通层 · ' + (THEME[set] || '') + '之地', lx + lw / 2, ly + 88, 12, boss ? '#ff8a95' : '#9fb0c6', 'center');

  const fx = lx + lw / 2, fy = ly + 296;
  ctx.save(); ctx.translate(fx, fy);
  const aura = ctx.createRadialGradient(0, -6, 6, 0, -6, 110); aura.addColorStop(0, boss ? 'rgba(255,60,60,.32)' : col + '40'); aura.addColorStop(1, col + '00');
  ctx.fillStyle = aura; ctx.beginPath(); ctx.ellipse(0, -6, 110, 28, 0, 0, 7); ctx.fill();
  const pool = ENS[set] && (boss ? ENS[set].boss : ENS[set].wd), im = pool && pool[0];
  if (im && im.width) {
    const k = Math.min((boss ? 160 : 120) / im.height, 150 / im.width), iw = im.width * k, ih = im.height * k, bob = Math.sin(T * 2) * 3;
    ctx.shadowColor = boss ? WB_COL : col; ctx.shadowBlur = 14 + 5 * Math.sin(T * 3);
    ctx.drawImage(im, -iw / 2, -ih + bob, iw, ih);
  } else txt(boss ? '👹' : '👾', 0, -60, 64, '#fff', 'center', false);
  ctx.restore();

  pBtn(lx + 14, ly + 108, 40, 30, '−10', { c: col, ghost: true, sz: 12, cr: 6 }, () => { PO.tw = Math.max(1, f - 10); });
  pBtn(lx + 58, ly + 108, 40, 30, '◀', { c: col, ghost: true, sz: 12, cr: 6 }, () => { PO.tw = Math.max(1, f - 1); });
  pBtn(lx + lw - 98, ly + 108, 40, 30, '▶', { c: col, ghost: true, sz: 12, cr: 6 }, () => { PO.tw = Math.min(mx, f + 1); });
  pBtn(lx + lw - 54, ly + 108, 40, 30, '+10', { c: col, ghost: true, sz: 12, cr: 6 }, () => { PO.tw = Math.min(mx, f + 10); });

  // ---- 右：数据 / 预览 / 说明 ----
  const dx = POX + 344, dy = 84, dw = POW - 344 - 24, dh = 354, rx = dx + 24;
  rpath(dx, dy, dw, dh, 16);
  const g2 = ctx.createLinearGradient(dx, dy, dx + dw, dy + dh); g2.addColorStop(0, col + '1c'); g2.addColorStop(.5, 'rgba(12,16,32,.92)'); g2.addColorStop(1, 'rgba(8,10,22,.95)');
  ctx.fillStyle = g2; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = col + '66'; ctx.stroke();

  txt('ENDLESS TOWER', rx, dy + 22, 11, col);
  txt(first ? '挑战前沿层' : '重打已通关层（无首通奖励）', rx, dy + 46, 15, first ? '#ffd84a' : '#9fb0c6');

  const stats = [
    ['推荐等级', 'Lv.' + r, poRel(r)[1]],
    ['击杀目标', twKills(f) + ' 只' + (boss ? ' + BOSS' : ''), '#fff'],
    ['历史最高', best ? '第 ' + best + ' 层' : '—', '#7df9ff'],
    ['本层金币', poN(twGold(f)) + ' G', '#ffd84a'],
    ['首通钻石', first ? '+' + twDiam(f) : '已领取', first ? '#4fe3ff' : '#6f7f95'],
    ['契约碎片', boss ? (first ? '+' + twShard(f) : '已领取') : '—', boss && first ? '#c79bff' : '#6f7f95']
  ];
  stats.forEach((st, i) => {
    const sx = rx + (i % 3) * 158, sy = dy + 84 + (i / 3 | 0) * 52;
    rpath(sx - 6, sy - 14, 148, 44, 8); ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fill();
    txt(st[0], sx, sy, 11, '#8a97aa'); txt(st[1], sx, sy + 21, 15, st[2]);
  });

  // 接下来几层
  txt('接下来的层', rx, dy + 196, 11, '#8a97aa');
  for (let i = 0; i < 5; i++) {
    const ff = f + i, bx = rx + i * 96, by = dy + 210, bb = twIsBoss(ff), done = ff <= best;
    rpath(bx, by, 88, 44, 8);
    ctx.fillStyle = i === 0 ? col + '33' : 'rgba(255,255,255,.04)'; ctx.fill();
    ctx.lineWidth = i === 0 ? 1.6 : 1; ctx.strokeStyle = bb ? '#ff6b6b' : (i === 0 ? col : 'rgba(255,255,255,.15)'); ctx.stroke();
    txt((bb ? '👑 ' : '') + '第 ' + ff + ' 层', bx + 44, by + 15, 12, done ? '#7dff9a' : (bb ? '#ff8a95' : '#fff'), 'center');
    txt('Lv.' + twRec(ff), bx + 44, by + 33, 10.5, '#8a97aa', 'center');
  }

  // 说明 + 下一个称号
  txt('💠 钻石 / 碎片只在每层首次通关时获得，首领层奖励翻倍 + 契约碎片', rx, dy + 280, 11.5, '#c9d4e6');
  txt('🎖 每突破一个里程碑层数，还会解锁对应称号', rx, dy + 300, 11.5, '#c9d4e6');
  const nt = (typeof TITLES !== 'undefined') ? TITLES.find(t => t.tw && t.tw > best) : null;
  if (nt) txt('下一个称号：「' + nt.n + '」· 通关第 ' + nt.tw + ' 层', rx, dy + 322, 11.5, nt.col);

  // 扫荡按钮（右下）
  const to = twSweepTo(), canSweep = to > best;
  pBtn(dx + dw - 24 - 200, dy + dh - 46, 200, 34, canSweep ? '⚡ 扫荡至第 ' + to + ' 层' : '⚡ 暂无可扫荡层', { c: '#2ed573', dis: !canSweep, sz: 12.5 }, twSweep);

  poFooter(col, 'A/D 切换层数   W/S ±10 层   Enter 挑战', { label: '⚔ 挑战第 ' + f + ' 层 [Enter]', c: col, f: pStartTower });
}
