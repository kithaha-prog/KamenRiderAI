// ===== 战力系统：公式 / 装备对比 / HUD / 排行榜 =====
// 加载顺序：config.js、equipment.js 之后，player.js 之前（player.js 加载时就会调用 calc()）。
// 本文件顶层只定义函数和常量；运行时才会用到 ctx / ut / hudPanel / sbClient 等，所以不受加载顺序影响。

// ---------- 1. 战力公式 ----------
// 战力 = 输出力 + 生存力 + 魔力。不含变身形态加成，这样排行榜不会因为变身与否而跳动。
const DEF_CAP = 0.8;       // 角色总免伤上限 80%
const EQ_DEF_MAX = 0.45;   // 装备免伤的递减曲线渐近线（装备单独最多贡献 45%，再叠加护甲强化，总计封顶 DEF_CAP）
const CP_W = { off: 10, sur: 0.8, mp: 0.3, critMul: 1.5, defCap: DEF_CAP };   // 权重集中在这里，方便调平衡

// 纯函数：给定一套装备，算出玩家属性（calc() 也改成调用它，公式只维护一份）
// 纯函数：给定一套装备，算出玩家属性（本体基础与装备解耦版）
function previewStats(eq, withForm) {
  let a = 0, h = 0, m = 0, c = 0, d = 0;
  for (const k in eq) {
    const it = eq[k];
    if (it && it.stats) { 
      a += it.stats.atk || 0; 
      h += it.stats.hp || 0; 
      m += it.stats.mp || 0; 
      c += it.stats.crit || 0; 
      d += it.stats.def || 0; 
    }
  }
  const t = S.ta;

  // ★ 核心解耦：天赋 (t) 与铁匠铺研磨 (S.sw / S.ar / S.bt) 仅作用于骑士自身本体成长
  // 随着角色等级 (S.lv) 成长，即使脱光装备加点也能获得扎实可观的提升
  // ★ 核心公式：按你的需求调整升级与天赋百分比系数
  // 1. 攻击天赋由 0.05 提升至 0.10 (10%)；金币研磨 S.sw 由 0.02 提升至 0.05 (5%)
  const baseAtk = (14 + S.lv * 8) * (1 + .10 * t[0]) * (1 + .05 * S.sw);

  // 2. 生命天赋由 0.06 提升至 0.10 (10%)
  const baseHp  = (100 + S.lv * 25) * (1 + .10 * t[1]) * (1 + .05 * S.ar);

  // 3. 魔力保持原样
  const baseMp  = (100 + S.lv * 0.8) * (1 + .06 * t[2]) * (1 + .03 * S.bt);

  // 装备属性独立相加
  let atk = baseAtk + a;
  let hp  = baseHp + h;
  let mp  = baseMp + m;

  // 4. 会心一击暴击天赋由 0.02 (2%) 调整为 0.0025 (0.25%)
  let cr  = .05 + .0025 * t[3] + c;

  // 最终形态全域倍率放大（变身依然能够等比放大全身实力）
  if (withForm) {
    const fc = formCap();
    if (fc) {
      atk *= (typeof capAtkMul === 'function' ? capAtkMul(fc) : (fc.atkMul || 1));
      cr += (typeof capCrAdd === 'function' ? capCrAdd(fc) : (fc.crAdd || 0));
    }
  }

  return {
    atk, 
    cr: Math.min(1, cr),
    hp, 
    mp,
    def: Math.min(DEF_CAP, S.ar * .0005 + EQ_DEF_MAX * d / (d + 40 + S.lv))
  };
}

function calcCP(eq) {
  const st = previewStats(eq || S.eq, false);
  const off = st.atk * (1 + st.cr * (CP_W.critMul - 1));      // 暴击期望伤害
  const sur = st.hp / (1 - Math.min(st.def, CP_W.defCap));    // 减伤折算成等效血量（封顶，防止免伤接近上限时战力爆表）
  return Math.round(off * CP_W.off + sur * CP_W.sur + st.mp * CP_W.mp);
}

// ---------- 2. 装备对比 ----------
// 穿上这件装备后战力变化多少（已穿戴的返回 0）
function cpDelta(it) {
  const cur = S.eq[it.slot];
  if (cur && cur.id === it.id) return 0;
  return calcCP({ ...S.eq, [it.slot]: it }) - calcCP(S.eq);
}
const cpTag = d => d === 0 ? '战力 ＝' : '战力 ' + (d > 0 ? '▲ ' : '▼ ') + Math.abs(d).toLocaleString();

// ---------- 3. 战力 HUD（血条右侧的小胶囊，点击打开排行榜）----------
const CP_HUD = { x: 0, y: 0, w: 0, h: 22 };
function drawCPHUD(x, y) {
  if (!showStat) LB.tab = 0;                      // 战绩档案关闭后，下次默认回到战绩页
  const s = fmtC(P.cp || calcCP()), w = Math.max(96, tw(s, 13) + 54), h = 22;
  hudPanel(x, y, w, h, UIC.gold, 6);
  ut('战力', x + 12, y + 11.5, 9, UIC.sub, 'left', { w: 700, sp: 1, sh: 0 });
  ut(s, x + w - 10, y + 11.5, 13, UIC.hi, 'right', { w: 700 });
  Object.assign(CP_HUD, { x, y, w, h });
}
const cpHudHit = (px, py) => px >= CP_HUD.x && px <= CP_HUD.x + CP_HUD.w && py >= CP_HUD.y && py <= CP_HUD.y + CP_HUD.h;

// ---------- 4. 排行榜（Supabase 表 leaderboard，建表见 leaderboard.sql）----------
const LB_SHOW = 12;
// 榜单：col = leaderboard 表里的排序列；weekly = 每周一 00:00（UTC+8）清零的周榜
const LB_BOARDS = [
  { id: 'cp',    n: '战力',   lab: '战力',     col: 'cp',    fmt: v => Math.round(v).toLocaleString(), desc: '综合战力（等级 · 装备 · 天赋 · 研磨）' },
  { id: 'tw',    n: '无尽塔', lab: '最高层数', col: 'tw',    fmt: v => v + ' 层',                      desc: '无尽塔历史最高通关层数' },
  { id: 'kills', n: '击杀',   lab: '累计击杀', col: 'kills', fmt: v => Number(v).toLocaleString(),     desc: '累计消灭的怪物总数' },
  { id: 'lv',    n: '等级',   lab: '等级',     col: 'lv',    fmt: v => 'Lv.' + v,                      desc: '骑士等级（同级比战力）' },
  { id: 'wk',    n: '周榜',   lab: '本周击杀', col: 'wkv',   fmt: v => Number(v).toLocaleString(),     weekly: true }
];
const LB = { tab: 0, board: 0, view: null, st: 'idle', rows: [], me: null, at: 0, sent: '', hit: [], err: '', subErr: '', cache: {}, busy: {}, no: {} };
const lbErrStr = e => e ? [e.code, e.message, e.hint].filter(Boolean).join(' | ') : '';   // st: idle | loading | ok | err | off | nodb

// 只有正式注册账号能上榜；游客 / 离线只能看
const lbCanPost = () => !!(typeof sbClient !== 'undefined' && sbClient && currentAuthUser && currentAuthUser.id &&
  !String(currentAuthUser.id).startsWith('local_guest') && !currentAuthUser.is_anonymous);
const lbNick = () => S.nick || ('骑士' + String(currentAuthUser.id).slice(0, 4));

// ---------- 周榜：每周一 00:00（UTC+8）结算清零 ----------
// 周榜成绩 = 本周击杀数 = 累计击杀 - 周初累计击杀。S.wk = { id: 周编号, k0: 周初累计击杀 }
// 跨周时上周最终成绩存进 S.wkPrev，并随排行榜上传（pwk / pwkv 列），这样别人本周上传后也不会丢掉上周名次
const WK_MIN = 30;   // 上周至少击杀这么多才有资格领奖
const WK_REWARDS = [   // 上周名次 → 奖励（从上到下第一个满足的）
  { max: 1,  d: 500, label: '第 1 名',  note: '💎500 + 称号' },
  { max: 3,  d: 300, label: '前 3 名',  note: '💎300 + 称号' },
  { max: 10, d: 150, label: '前 10 名', note: '💎150 + 称号' },
  { max: 30, d: 50,  label: '前 30 名', note: '💎50' }
];
function wkId(ms = Date.now()) {   // ISO 周编号，按 UTC+8 切周
  const d = new Date(ms + 8 * 36e5), dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  dt.setUTCDate(dt.getUTCDate() + 4 - (dt.getUTCDay() || 7));
  const y0 = Date.UTC(dt.getUTCFullYear(), 0, 1);
  return dt.getUTCFullYear() + '-W' + String(Math.ceil(((dt - y0) / 864e5 + 1) / 7)).padStart(2, '0');
}
function wkLeft() {   // 距离本周结算的毫秒数
  const d = new Date(Date.now() + 8 * 36e5), into = ((d.getUTCDay() + 6) % 7) * 864e5 + d.getUTCHours() * 36e5 + d.getUTCMinutes() * 6e4 + d.getUTCSeconds() * 1e3;
  return 7 * 864e5 - into;
}
function wkSync() {   // ui.js 的 qScan 每 0.5 秒调用；跨周时在这里结转
  const cur = wkId(), k = ps().kills;
  if (!S.wk || typeof S.wk !== 'object') { S.wk = { id: cur, k0: k }; return; }
  if (S.wk.id !== cur) {
    S.wkPrev = { id: S.wk.id, v: Math.max(0, k - S.wk.k0) };
    S.wk = { id: cur, k0: k };
    if (typeof save === 'function') save();
  }
}
const wkScore = () => { wkSync(); return Math.max(0, ps().kills - S.wk.k0); };
const wkBest = () => (S.wkw && S.wkw.best) || 999;   // 历史最佳周榜名次（titles.js 的周榜称号用）

// 我自己在某个榜单上的数值
function lbMyVal(bd) {
  return bd.id === 'cp' ? calcCP() : bd.id === 'tw' ? (typeof twBest === 'function' ? twBest() : 0) : bd.id === 'kills' ? ps().kills : bd.id === 'lv' ? S.lv : wkScore();
}

// 缺列时的退化：数据库还没执行 leaderboard_title.sql / leaderboard_profile.sql / leaderboard_boards.sql，就去掉对应列，排行榜照常工作
function lbColErr(error) {
  const m = lbErrStr(error);
  if (!LB.no.profile && /profile/i.test(m)) return (LB.no.profile = true);
  if (!LB.no.title && /title/i.test(m)) return (LB.no.title = true);
  if (!LB.no.boards && /\b(tw|kills|wkv?|pwkv?)\b/i.test(m)) return (LB.no.boards = true);
  return false;
}

// 别人点你的名字时看到的「档案」：只放展示用的汇总数据（leaderboard 表的 profile jsonb 列，见 leaderboard_profile.sql）
function lbProfile() {
  const p = ps(), gear = [...S.inv, ...Object.values(S.eq || {}).filter(Boolean)];
  return {
    v: 1, nick: lbNick(), lv: S.lv, cp: calcCP(), title: (typeof ttName === 'function' ? ttName() : '') || '',
    p: { pt: Math.round(p.pt), gE: p.gE, dE: p.dE, dmg: p.dmg, maxHit: p.maxHit, hits: p.hits, crits: p.crits, kills: p.kills, boss: p.boss,
      win: p.win, lose: p.lose, taken: p.taken, hen: p.hen, first: p.first, formT: p.formT },
    g: S.g, d: S.d, cl: Math.min(S.cl, NST), s3: Object.values(S.stars || {}).filter(v => v >= 3).length,
    caps: S.caps.length, top: gear.reduce((m, it) => it && it.tier > m ? it.tier : m, -1)
  };
}

async function lbSubmit(force) {
  if (!lbCanPost()) return;
  wkSync();
  const title = (typeof ttName === 'function' ? ttName() : '') || '';
  const cp = calcCP(), lv = S.lv, nick = lbNick(), q = ps(), tw = typeof twBest === 'function' ? twBest() : 0;
  // 战绩类数据变化很频繁，只按粗粒度判断（每 10 次击杀 / 每场战斗 / 每 2 分钟），避免每次存档都上传
  const sig = [cp, lv, nick, title, tw, (q.kills / 10) | 0, q.win + q.lose, (q.pt / 120) | 0, S.wkPrev ? S.wkPrev.id : ''].join('|');
  if (!force && sig === LB.sent) { lbWeekSettle(); return; }
  const up = async () => {
    const row = { user_id: currentAuthUser.id, nickname: nick, cp, lv, updated_at: new Date().toISOString() };
    if (!LB.no.title) row.title = title || null;
    if (!LB.no.profile) row.profile = lbProfile();
    if (!LB.no.boards) Object.assign(row, { tw, kills: q.kills, wk: S.wk.id, wkv: wkScore(), pwk: S.wkPrev ? S.wkPrev.id : null, pwkv: S.wkPrev ? S.wkPrev.v : 0 });
    return sbClient.from('leaderboard').upsert(row, { onConflict: 'user_id' });
  };
  try {
    let { error } = await up();
    for (let i = 0; error && i < 3 && lbColErr(error); i++) ({ error } = await up());
    if (error) { LB.subErr = lbErrStr(error); console.warn('[Leaderboard] 上传失败:', error); } else { LB.sent = sig; LB.subErr = ''; }
  } catch (e) { LB.subErr = lbErrStr(e); console.warn('[Leaderboard] 上传异常', e); }
  lbWeekSettle();
}

// 周榜结算：每个新的一周第一次联网时，查上一周的最终名次并发奖（每周只领一次，记在 S.wkClaim）
async function lbWeekSettle() {
  if (!lbCanPost() || LB.no.boards || LB.settling) return;
  wkSync();
  const prev = wkId(Date.now() - 7 * 864e5);
  if (S.wkClaim === prev || LB.settledId === prev) return;
  LB.settling = true;
  try {
    const sel = (idc, vc) => sbClient.from('leaderboard').select('user_id,' + vc + ',updated_at').eq(idc, prev).gte(vc, WK_MIN)
      .order(vc, { ascending: false }).order('updated_at', { ascending: true }).limit(30);
    const [a, b] = await Promise.all([sel('wk', 'wkv'), sel('pwk', 'pwkv')]);
    if (a.error || b.error) { lbColErr(a.error || b.error); return; }   // 网络 / 缺列：下次再试
    const list = [...(a.data || []).map(r => ({ u: r.user_id, v: r.wkv, t: r.updated_at })), ...(b.data || []).map(r => ({ u: r.user_id, v: r.pwkv, t: r.updated_at }))]
      .sort((x, y) => y.v - x.v || (x.t < y.t ? -1 : 1));
    const rank = list.findIndex(o => o.u === currentAuthUser.id) + 1, rw = rank > 0 ? WK_REWARDS.find(r => rank <= r.max) : null;
    S.wkClaim = prev; LB.settledId = prev;
    if (rw) {
      S.d += rw.d; if (typeof psDia === 'function') psDia(rw.d);
      S.wkw = S.wkw && typeof S.wkw === 'object' ? S.wkw : {};
      S.wkw.best = Math.min(S.wkw.best || 999, rank);
      S.wkw.last = { id: prev, rank, d: rw.d };
      if (typeof questToast === 'function') questToast('🏆 上周周榜第 ' + rank + ' 名 · 钻石 +' + rw.d, '#ffd84a');
    }
    if (typeof save === 'function') save();
  } catch (e) { console.warn('[Leaderboard] 周榜结算失败', e); }
  finally { LB.settling = false; }
}

// 名次升降：每个榜单每天存一份名次快照（localStorage），今天的名次和「前一天的最后快照」比较
function lbRankSnap(id, rows) {
  let all = {};
  try { all = JSON.parse(localStorage.malaya_lbrank || '{}') || {}; } catch (e) { all = {}; }
  const day = new Date(Date.now() + 8 * 36e5).toISOString().slice(0, 10), e = all[id] || {};
  if (e.day !== day) { e.prev = e.cur || null; e.day = day; }
  e.cur = {}; rows.forEach((r, i) => { e.cur[r.user_id] = i + 1; });
  all[id] = e;
  try { localStorage.malaya_lbrank = JSON.stringify(all); } catch (er) { }
  rows.forEach((r, i) => {
    r.dr = e.prev && e.prev[r.user_id] ? e.prev[r.user_id] - (i + 1) : null;
    r.nw = !!(e.prev && !e.prev[r.user_id]);
  });
}

async function lbFetch(force) {
  if (typeof sbClient === 'undefined' || !sbClient) { LB.st = 'off'; return; }
  const bi = LB.board, bd = LB_BOARDS[bi], cur = () => LB.board === bi;
  if (LB.busy[bd.id]) return;
  const c = LB.cache[bd.id];
  if (!force && c && Date.now() - c.at < 8000) return;
  LB.busy[bd.id] = 1;
  if (cur()) LB.st = 'loading';
  try {
    await lbSubmit();
    const lim = bd.weekly ? 10 : LB_SHOW, wk = wkId();
    const cols = () => 'user_id,nickname,cp,lv' + (LB.no.title ? '' : ',title') + (LB.no.profile ? '' : ',profile') + (LB.no.boards ? '' : ',tw,kills,wk,wkv');
    const q = () => {
      let x = sbClient.from('leaderboard').select(cols()).order(bd.col, { ascending: false });
      if (bd.weekly) x = x.eq('wk', wk).gt('wkv', 0);
      if (bd.id === 'lv') x = x.order('cp', { ascending: false });
      return x.order('updated_at', { ascending: true }).limit(lim);
    };
    if (bd.id !== 'cp' && LB.no.boards) { LB.cache[bd.id] = { rows: [], me: null, at: Date.now(), nodb: true }; if (cur()) { LB.rows = []; LB.me = null; LB.st = 'nodb'; } return; }
    let res = await q();
    for (let i = 0; res.error && i < 3 && lbColErr(res.error); i++) {
      if (bd.id !== 'cp' && LB.no.boards) { LB.cache[bd.id] = { rows: [], me: null, at: Date.now(), nodb: true }; if (cur()) { LB.rows = []; LB.me = null; LB.st = 'nodb'; } return; }
      res = await q();
    }
    if (res.error) throw res.error;
    const rows = res.data || [];
    lbRankSnap(bd.id, rows);
    let me = null;
    if (lbCanPost()) {
      const uid = currentAuthUser.id, i = rows.findIndex(r => r.user_id === uid), mv = lbMyVal(bd);
      if (i >= 0) me = { rank: i + 1, val: rows[i][bd.col], nick: rows[i].nickname };
      else if (!(bd.weekly && mv <= 0)) {
        let cq = sbClient.from('leaderboard').select('user_id', { count: 'exact', head: true }).gt(bd.col, mv);
        if (bd.weekly) cq = cq.eq('wk', wk);
        const { count, error: e2 } = await cq;
        if (!e2) me = { rank: (count || 0) + 1, val: mv, nick: lbNick() };
      }
    }
    LB.cache[bd.id] = { rows, me, at: Date.now() };
    if (cur()) { LB.rows = rows; LB.me = me; LB.at = Date.now(); LB.st = 'ok'; LB.err = ''; }
  } catch (e) { console.warn('[Leaderboard] 读取失败', e); if (cur()) { LB.err = lbErrStr(e) || String(e); LB.st = 'err'; } }
  finally { LB.busy[bd.id] = 0; }
}
function lbSetBoard(i) {
  if (i === LB.board) return;
  LB.board = i;
  const c = LB.cache[LB_BOARDS[i].id];
  LB.rows = c ? c.rows : []; LB.me = c ? c.me : null; LB.st = c ? (c.nodb ? 'nodb' : 'ok') : 'idle';
  lbFetch();
}

// ---------- 昵称弹框（DOM 浮层，不依赖 HTML 里预先写好的元素）----------
// opt: { title, init, force }  force=true 时不能取消（首次进入必须起名）
// 返回 Promise<string|null>；确认后写入 S.nick 并存档、同步排行榜
function askNickname(opt = {}) {
  return new Promise(resolve => {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(2,4,10,.88);font-family:inherit';
    const box = document.createElement('div');
    box.style.cssText = 'width:min(86vw,380px);padding:22px 22px 18px;border:2px solid #00e5ff;border-radius:14px;background:rgba(10,14,28,.97);box-shadow:0 0 24px rgba(0,229,255,.35);color:#eef2f8;text-align:center';
    const h = document.createElement('div');
    h.textContent = opt.title || '为你的骑士命名';
    h.style.cssText = 'font-size:19px;font-weight:700;color:#f3e3b0;margin-bottom:6px';
    const sub = document.createElement('div');
    sub.textContent = '这个名字会显示在战绩档案和战力排行榜上（2~12 个字符）';
    sub.style.cssText = 'font-size:12px;color:#8f9bb0;margin-bottom:14px;line-height:1.5';
    const inp = document.createElement('input');
    inp.type = 'text'; inp.maxLength = 12; inp.value = opt.init || ''; inp.placeholder = '输入骑士名';
    inp.autocomplete = 'off'; inp.spellcheck = false;
    inp.style.cssText = 'width:100%;box-sizing:border-box;padding:10px 12px;font-size:16px;color:#fff;background:rgba(0,0,0,.45);border:1px solid #00e5ff;border-radius:8px;outline:none;text-align:center';
    const err = document.createElement('div');
    err.style.cssText = 'min-height:18px;margin:8px 0 6px;font-size:12px;color:#ff7675';
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;justify-content:center';
    const mk = (t, c) => { const x = document.createElement('button'); x.textContent = t; x.style.cssText = 'flex:1;padding:9px 0;font-size:14px;font-weight:700;color:#fff;background:' + c + '33;border:1px solid ' + c + ';border-radius:8px;cursor:pointer'; return x; };
    const ok = mk('确 定', '#2ed573'), no = mk('取 消', '#ff4757');
    row.appendChild(ok); if (!opt.force) row.appendChild(no);
    box.append(h, sub, inp, err, row); ov.appendChild(box); document.body.appendChild(ov);

    const close = v => { ov.remove(); resolve(v); };
    const submit = () => {
      const n = inp.value.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12);
      if ([...n].length < 2) { err.textContent = '名字至少 2 个字符'; return; }
      S.nick = n; save();
      if (typeof lbSubmit === 'function' && lbCanPost()) lbSubmit(true);
      close(n);
    };
    ok.onclick = submit;
    no.onclick = () => close(null);
    // 键盘事件不能漏到游戏：游戏在 window 上监听 keydown，并会拦截空格 / 方向键
    for (const t of ['keydown', 'keyup', 'keypress']) ov.addEventListener(t, e => {
      e.stopPropagation();
      if (t === 'keydown') {
        if (e.key === 'Enter') { e.preventDefault(); submit(); }
        else if (e.key === 'Escape' && !opt.force) close(null);
      }
    });
    setTimeout(() => { inp.focus(); inp.select(); }, 60);
  });
}

function lbRename() {
  askNickname({ title: '修改昵称', init: S.nick || '' }).then(n => { if (n) lbFetch(true); });
}

// 小按钮：绘制并登记点击区域（lbClick 在 psClick 里先于关闭逻辑被调用）
function lbBtn(x, y, w, h, label, col, fn) {
  rpath(x, y, w, h, 6); ctx.fillStyle = col + '33'; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.stroke();
  ut(label, x + w / 2, y + h / 2 + .5, 11.5, '#fff', 'center', { w: 700 });
  LB.hit.push({ x, y, w, h, fn });
}
function lbTabBtn(b) {   // 战绩 ⇄ 排行榜 切换按钮（两个页面位置相同）
  lbBtn(b.x + b.w - 146, b.y + 10, 68, 26, LB.tab ? '战绩' : '排行榜', '#ffd84a', () => { LB.tab = LB.tab ? 0 : 1; if (LB.tab) lbFetch(); });
}
// 返回 true = 点击已被排行榜按钮消费，psClick 不再处理
function lbClick(x, y) {
  for (let i = LB.hit.length - 1; i >= 0; i--) {
    const r = LB.hit[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { r.fn(); return true; }
  }
  return false;
}

// 点排行榜某一行：切到战绩页，显示那位骑士的档案（LB.view 非空 = 查看他人 / 他人视角）
function lbOpenProfile(r) {
  const mine = lbCanPost() && r.user_id === currentAuthUser.id;
  LB.view = mine ? psSelfView() : psViewFromRow(r);
  LB.view.mine = mine;
  LB.tab = 0;
}

// 流光：在圆角矩形内扫过一道高光（传说称号、排行榜第一名用）
function uiShine(x, y, w, h, rad, a) {
  ctx.save(); rpath(x, y, w, h, rad); ctx.clip();
  const px = x - w * .35 + ((T * .32) % 1.5) * w * 1.7, g = ctx.createLinearGradient(px - 70, y, px + 70, y + h * .4);
  g.addColorStop(0, 'rgba(255,240,190,0)'); g.addColorStop(.5, 'rgba(255,240,190,' + (a || .3) + ')'); g.addColorStop(1, 'rgba(255,240,190,0)');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h); ctx.restore();
}

// 奖牌：金 / 银 / 铜
function lbMedal(x, y, i) {
  const c = [['#fff3b0', '#ffd84a', '#a8790b'], ['#ffffff', '#cfd8e3', '#6f7d8c'], ['#ffd9b0', '#d98b4a', '#7a3f14']][i], rb = ['#e0523f', '#3f7de0', '#3fa56b'][i];
  ctx.save();
  ctx.fillStyle = rb; ctx.beginPath(); ctx.moveTo(x - 7, y - 11); ctx.lineTo(x - 2, y - 11); ctx.lineTo(x + 1, y - 3); ctx.lineTo(x - 4, y - 3); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 7, y - 11); ctx.lineTo(x + 2, y - 11); ctx.lineTo(x - 1, y - 3); ctx.lineTo(x + 4, y - 3); ctx.closePath(); ctx.fill();
  const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 10); g.addColorStop(0, c[0]); g.addColorStop(.55, c[1]); g.addColorStop(1, c[2]);
  ctx.shadowColor = c[1]; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.arc(x, y + 1, 8.5, 0, 7); ctx.fillStyle = g; ctx.fill();
  ctx.shadowBlur = 0; ctx.lineWidth = 1.2; ctx.strokeStyle = c[2]; ctx.stroke();
  ctx.restore();
  ut(String(i + 1), x, y + 1.5, 11, '#3a2a05', 'center', { w: 800, sh: 0 });
}

function drawLeaderboard() {
  const b = PS_PANEL, acc = '#ffd84a', medal = ['#ffd84a', '#cfd8e3', '#d98b4a'], bd = LB_BOARDS[LB.board];
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.62)'; ctx.fillRect(0, 0, 960, 540);
  hudPanel(b.x, b.y, b.w, b.h, acc, 18);
  ut(bd.n + '排行榜', b.x + 28, b.y + 30, 19, UIC.hi, 'left', { w: 700 });
  rpath(b.x + b.w - 70, b.y + 10, 60, 26, 6); ctx.fillStyle = 'rgba(255,71,87,.25)'; ctx.fill(); ctx.strokeStyle = '#ff4757'; ctx.lineWidth = 1.2; ctx.stroke();
  ut('✕ 关闭', b.x + b.w - 40, b.y + 23, 11.5, '#ff9aa4', 'center', { w: 700 });
  lbTabBtn(b);
  lbBtn(b.x + b.w - 222, b.y + 10, 68, 26, LB.st === 'loading' ? '刷新中…' : '刷新', '#7df9ff', () => lbFetch(true));
  lbBtn(b.x + b.w - 298, b.y + 10, 68, 26, '改昵称', '#a55eea', lbRename);

  // 榜单页签
  const tw0 = 76;
  LB_BOARDS.forEach((o, i) => {
    const x = b.x + 28 + i * (tw0 + 6), y = b.y + 46, on = i === LB.board;
    rpath(x, y, tw0, 24, 12);
    if (on) { const g = ctx.createLinearGradient(x, y, x, y + 24); g.addColorStop(0, 'rgba(255,216,74,.38)'); g.addColorStop(1, 'rgba(255,216,74,.14)'); ctx.fillStyle = g; }
    else ctx.fillStyle = 'rgba(255,255,255,.05)';
    ctx.fill(); ctx.lineWidth = on ? 1.4 : 1; ctx.strokeStyle = on ? acc : 'rgba(255,255,255,.16)'; ctx.stroke();
    ut((o.weekly ? '🏆 ' : '') + o.n, x + tw0 / 2, y + 12.5, 11.5, on ? '#fff' : UIC.sub, 'center', { w: on ? 700 : 600, sh: 0 });
    LB.hit.push({ x, y, w: tw0, h: 24, fn: () => lbSetBoard(i) });
  });
  if (bd.weekly) {
    const ms = wkLeft(), d = ms / 864e5 | 0, h = (ms % 864e5) / 36e5 | 0;
    ut('距本周结算 ' + (d ? d + ' 天 ' : '') + h + ' 时 · 每周一 00:00 清零发奖', b.x + b.w - 28, b.y + 58, 10, '#ffd84a', 'right', { w: 600, sh: 0 });
  } else ut(bd.desc, b.x + b.w - 28, b.y + 58, 10, UIC.sub, 'right', { w: 500, sh: 0 });

  // 表头
  const y0 = b.y + 104, rh = 26, cx = [b.x + 44, b.x + 100, b.x + 470, b.x + b.w - 40];
  const sec = bd.id === 'lv' ? { lab: '战力', get: r => Math.round(r.cp).toLocaleString() } : { lab: '等级', get: r => 'Lv.' + r.lv };
  ut('排名', cx[0], y0 - 14, 10, UIC.sub, 'center', { w: 600, sh: 0 });
  ut('骑士', cx[1], y0 - 14, 10, UIC.sub, 'left', { w: 600, sh: 0 });
  ut(sec.lab, cx[2], y0 - 14, 10, UIC.sub, 'right', { w: 600, sh: 0 });
  ut(bd.lab, cx[3], y0 - 14, 10, UIC.sub, 'right', { w: 600, sh: 0 });
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(b.x + 20, y0 - 6, b.w - 40, 1);

  const uid = lbCanPost() ? currentAuthUser.id : null, nShow = bd.weekly ? 10 : LB_SHOW;
  if (LB.st !== 'ok' && !LB.rows.length) {
    const msg = LB.st === 'loading' ? '正在读取排行榜…' : LB.st === 'off' ? '排行榜需要联网（当前为离线模式）' : LB.st === 'err' ? '读取失败，点「刷新」重试'
      : LB.st === 'nodb' ? '这个榜单需要先升级数据库（在 Supabase 执行 leaderboard_boards.sql）' : '暂无数据';
    ut(msg, 480, y0 + 130, 14, UIC.sub, 'center', { w: 600 });
    if (LB.st === 'err' && LB.err) ut(LB.err.slice(0, 90), 480, y0 + 158, 11, '#ff9aa4', 'center', { w: 500, sh: 0 });
  } else if (LB.st === 'ok' && !LB.rows.length) ut(bd.weekly ? '本周还没有人上榜，去打怪吧！' : '暂无数据', 480, y0 + 130, 14, UIC.sub, 'center', { w: 600 });
  if (LB.subErr) ut('上传失败：' + LB.subErr.slice(0, 80), 480, b.y + b.h - 70, 10, '#ff9aa4', 'center', { w: 500, sh: 0 });

  LB.rows.slice(0, nShow).forEach((r, i) => {
    const y = y0 + i * rh, mine = r.user_id === uid, tc = i < 3 ? medal[i] : null, my = y + rh / 2 - 1;   // 行与行之间留 4px 间隙：可见高度 rh-4
    LB.hit.push({ x: b.x + 16, y, w: b.w - 32, h: rh, fn: () => lbOpenProfile(r) });   // 点这一行：查看该骑士的档案
    if (tc) {   // 前三名：金 / 银 / 铜 行底色 + 左侧色条
      rpath(b.x + 16, y + 1, b.w - 32, rh - 4, 6);
      const g = ctx.createLinearGradient(b.x + 16, 0, b.x + b.w - 16, 0); g.addColorStop(0, tc + '3a'); g.addColorStop(.6, tc + '10'); g.addColorStop(1, tc + '06');
      ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = tc + '66'; ctx.stroke();
      rpath(b.x + 16, y + 4, 3, rh - 10, 1.5); ctx.fillStyle = tc; ctx.fill();
      if (i === 0) uiShine(b.x + 16, y + 1, b.w - 32, rh - 4, 6, .22);
    } else if (i & 1) { ctx.fillStyle = 'rgba(255,255,255,.025)'; ctx.fillRect(b.x + 16, y + 1, b.w - 32, rh - 4); }
    if (mine) { rpath(b.x + 16, y + 1, b.w - 32, rh - 4, 6); if (!tc) { ctx.fillStyle = 'rgba(255,216,74,.14)'; ctx.fill(); } ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,216,74,.7)'; ctx.stroke(); }

    if (tc) lbMedal(cx[0] - 2, my, i); else ut(String(i + 1), cx[0] - 2, my, 12.5, UIC.txt, 'center', { w: 700 });
    if (r.dr > 0) ut('▲' + r.dr, cx[0] + 16, my, 9, '#7dff9a', 'left', { w: 700, sh: 0 });          // 名次上升
    else if (r.dr < 0) ut('▼' + (-r.dr), cx[0] + 16, my, 9, '#ff7675', 'left', { w: 700, sh: 0 });  // 名次下降
    else if (r.nw) ut('NEW', cx[0] + 16, my, 8, '#7df9ff', 'left', { w: 700, sh: 0 });

    const nm = r.nickname + (mine ? '（你）' : ''), nf = tc ? 13.5 : 12.5, nw = mine || tc ? 700 : 500;
    ut(nm, cx[1], my, nf, tc || (mine ? acc : UIC.txt), 'left', { w: nw });
    const ttl = mine && typeof ttName === 'function' ? (ttName() || r.title) : r.title;   // 自己的行用本地最新称号，不用等上传
    if (ttl) {
      const px = cx[1] + uw(nm, nf, nw) + 8, tdef = typeof ttByName === 'function' ? ttByName(ttl) : null;
      // 榜上存的是称号名，按名字找到称号后优先画图片；没有图片再退回文字标签
      if (!(tdef && ttBadge(tdef, px, my - 1, 20, 100))) {
        const tcol = typeof ttColByName === 'function' ? ttColByName(ttl) : '#d9bd7d', pw = uw(ttl, 10.5, 700) + 14;
        rpath(px, y + 3, pw, rh - 8, 8); ctx.fillStyle = tcol + '26'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = tcol + 'aa'; ctx.stroke();
        ut(ttl, px + pw / 2, my, 10.5, tcol, 'center', { w: 700, sh: 0 });
      }
    }
    ut(sec.get(r), cx[2], my, 11.5, UIC.sub, 'right', { w: 600, sh: 0 });
    ut(bd.fmt(r[bd.col] || 0), cx[3], my, tc ? 14 : 13, tc || UIC.hi, 'right', { w: 700 });
  });

  // 周榜奖励说明
  if (bd.weekly) {
    const sy = y0 + 10 * rh + 4, last = S.wkw && S.wkw.last;
    ut('// 周榜奖励（以上周最终名次发放，至少击杀 ' + WK_MIN + ' 只）', b.x + 24, sy + 6, 10, acc, 'left', { w: 700, sp: 1, sh: 0 });
    if (last) ut('上周：第 ' + last.rank + ' 名 · 💎+' + last.d, b.x + b.w - 24, sy + 6, 10, '#7dff9a', 'right', { w: 700, sh: 0 });
    const cw = (b.w - 40 - 3 * 8) / 4;
    WK_REWARDS.forEach((o, i) => {
      const x = b.x + 20 + i * (cw + 8), y = sy + 15, c = ['#ffd84a', '#cfd8e3', '#d98b4a', '#7df9ff'][i];
      rpath(x, y, cw, 24, 7); ctx.fillStyle = c + '1c'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = c + '77'; ctx.stroke();
      ut(o.label, x + 10, y + 12.5, 10.5, c, 'left', { w: 700, sh: 0 });
      ut(o.note, x + cw - 8, y + 12.5, 10, UIC.txt, 'right', { w: 600, sh: 0 });
    });
  }

  // 自己的名次
  const my = b.y + b.h - 58, mv = lbMyVal(bd);
  rpath(b.x + 20, my, b.w - 40, 30, 7); ctx.fillStyle = 'rgba(255,216,74,.08)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,216,74,.35)'; ctx.lineWidth = 1; ctx.stroke();
  if (lbCanPost() && LB.me) {
    ut('我的名次  第 ' + LB.me.rank.toLocaleString() + ' 名', b.x + 36, my + 15, 12.5, acc, 'left', { w: 700 });
    ut(LB.me.nick, b.x + 300, my + 15, 12, UIC.txt, 'left', { w: 500 });
    const mt = typeof ttCur === 'function' ? ttCur() : null;
    if (mt) {
      const mx = b.x + 300 + uw(LB.me.nick, 12, 500) + 8;
      if (!ttBadge(mt, mx, my + 15, 22, 110)) ut('「' + mt.n + '」', mx, my + 15, 12, mt.col, 'left', { w: 600 });
    }
  } else if (!lbCanPost()) {
    ut('游客 / 离线账号无法上榜，登录或注册账号后自动参与排名', b.x + 36, my + 15, 12, '#ff9aa4', 'left', { w: 600 });
  } else ut(bd.weekly && mv <= 0 ? '我的名次  本周还没有成绩' : '我的名次  —', b.x + 36, my + 15, 12.5, acc, 'left', { w: 700 });
  ut('我的' + bd.lab + ' ' + bd.fmt(mv), b.x + b.w - 36, my + 15, 13.5, UIC.hi, 'right', { w: 700 });
  ut('点击骑士查看档案 · ▲▼ 为较前一天的名次变化 · Esc 关闭', 480, b.y + b.h - 12, 9.5, 'rgba(210,218,232,.5)', 'center', { w: 500, sh: 0 });
  ctx.restore();
}
