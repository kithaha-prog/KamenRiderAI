// ===== 战力系统：公式 / 装备对比 / HUD / 排行榜 =====
// 加载顺序：config.js、equipment.js 之后，player.js 之前（player.js 加载时就会调用 calc()）。
// 本文件顶层只定义函数和常量；运行时才会用到 ctx / ut / hudPanel / sbClient 等，所以不受加载顺序影响。

// ---------- 1. 战力公式 ----------
// 战力 = 输出力 + 生存力 + 魔力。不含变身形态加成，这样排行榜不会因为变身与否而跳动。
const CP_W = { off: 10, sur: 0.8, mp: 0.3, critMul: 1.5, defCap: 0.8 };   // 权重集中在这里，方便调平衡

// 纯函数：给定一套装备，算出玩家属性（calc() 也改成调用它，公式只维护一份）
function previewStats(eq, withForm) {
  let a = 0, h = 0, m = 0, c = 0, d = 0;
  for (const k in eq) {
    const it = eq[k];
    if (it && it.stats) { a += it.stats.atk || 0; h += it.stats.hp || 0; m += it.stats.mp || 0; c += it.stats.crit || 0; d += it.stats.def || 0; }
  }
  const t = S.ta;
  let atk = (14 + S.lv * 2 + a) * (1 + .05 * t[0]) * (1 + .01 * S.sw);
  let cr = .05 + .02 * t[3] + c;
  if (withForm) { const fc = formCap(); if (fc) { atk *= fc.atkMul || 1; cr += fc.crAdd || 0; } }
  return {
    atk, cr: Math.min(1, cr),
    hp: (100 + S.lv * 10 + h) * (1 + .06 * t[1]) * (1 + .05 * S.ar),
    mp: (100 + S.lv * 5 + m) * (1 + .06 * t[2]) * (1 + .03 * S.bt),
    def: Math.min(.95, S.ar * .001 + d * .005)
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
const LB_SHOW = 14;
const LB = { tab: 0, st: 'idle', rows: [], me: null, at: 0, sent: '', hit: [], err: '', subErr: '' };
const lbErrStr = e => e ? [e.code, e.message, e.hint].filter(Boolean).join(' | ') : '';   // st: idle | loading | ok | err | off

// 只有正式注册账号能上榜；游客 / 离线只能看
const lbCanPost = () => !!(typeof sbClient !== 'undefined' && sbClient && currentAuthUser && currentAuthUser.id &&
  !String(currentAuthUser.id).startsWith('local_guest') && !currentAuthUser.is_anonymous);
const lbNick = () => S.nick || ('骑士' + String(currentAuthUser.id).slice(0, 4));

async function lbSubmit(force) {
  if (!lbCanPost()) return;
  const cp = calcCP(), lv = S.lv, nick = lbNick(), sig = cp + '|' + lv + '|' + nick;
  if (!force && sig === LB.sent) return;
  try {
    const { error } = await sbClient.from('leaderboard')
      .upsert({ user_id: currentAuthUser.id, nickname: nick, cp, lv, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) { LB.subErr = lbErrStr(error); console.warn('[Leaderboard] 上传失败:', error); } else { LB.sent = sig; LB.subErr = ''; }
  } catch (e) { LB.subErr = lbErrStr(e); console.warn('[Leaderboard] 上传异常', e); }
}

async function lbFetch(force) {
  if (typeof sbClient === 'undefined' || !sbClient) { LB.st = 'off'; return; }
  if (LB.st === 'loading') return;
  if (!force && LB.st === 'ok' && Date.now() - LB.at < 8000) return;
  LB.st = 'loading';
  try {
    await lbSubmit();
    const { data, error } = await sbClient.from('leaderboard').select('user_id,nickname,cp,lv')
      .order('cp', { ascending: false }).order('updated_at', { ascending: true }).limit(LB_SHOW);
    if (error) throw error;
    LB.rows = data || [];
    LB.me = null;
    if (lbCanPost()) {
      const uid = currentAuthUser.id, i = LB.rows.findIndex(r => r.user_id === uid), cp = calcCP();
      if (i >= 0) LB.me = { rank: i + 1, cp: LB.rows[i].cp, lv: LB.rows[i].lv, nick: LB.rows[i].nickname };
      else {
        const { count, error: e2 } = await sbClient.from('leaderboard').select('user_id', { count: 'exact', head: true }).gt('cp', cp);
        if (!e2) LB.me = { rank: (count || 0) + 1, cp, lv: S.lv, nick: lbNick() };
      }
    }
    LB.at = Date.now(); LB.st = 'ok'; LB.err = '';
  } catch (e) { console.warn('[Leaderboard] 读取失败', e); LB.err = lbErrStr(e) || String(e); LB.st = 'err'; }
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

function drawLeaderboard() {
  const b = PS_PANEL, acc = '#ffd84a', medal = ['#ffd84a', '#cfd8e3', '#d98b4a'];
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.62)'; ctx.fillRect(0, 0, 960, 540);
  hudPanel(b.x, b.y, b.w, b.h, acc, 18);
  ut('战力排行榜', b.x + 28, b.y + 34, 19, UIC.hi, 'left', { w: 700 });
  ut('POWER RANKING · TOP ' + LB_SHOW, b.x + 28, b.y + 58, 10.5, acc, 'left', { w: 700, sp: 1.5, sh: 0 });
  rpath(b.x + b.w - 70, b.y + 10, 60, 26, 6); ctx.fillStyle = 'rgba(255,71,87,.25)'; ctx.fill(); ctx.strokeStyle = '#ff4757'; ctx.lineWidth = 1.2; ctx.stroke();
  ut('✕ 关闭', b.x + b.w - 40, b.y + 23, 11.5, '#ff9aa4', 'center', { w: 700 });
  lbTabBtn(b);
  lbBtn(b.x + b.w - 222, b.y + 10, 68, 26, LB.st === 'loading' ? '刷新中…' : '刷新', '#7df9ff', () => lbFetch(true));
  lbBtn(b.x + b.w - 298, b.y + 10, 68, 26, '改昵称', '#a55eea', lbRename);

  // 表头
  const y0 = b.y + 86, rh = 24, cx = [b.x + 44, b.x + 90, b.x + 500, b.x + b.w - 40];
  ut('排名', cx[0], y0 - 14, 10, UIC.sub, 'center', { w: 600, sh: 0 });
  ut('骑士', cx[1], y0 - 14, 10, UIC.sub, 'left', { w: 600, sh: 0 });
  ut('等级', cx[2], y0 - 14, 10, UIC.sub, 'right', { w: 600, sh: 0 });
  ut('战力', cx[3], y0 - 14, 10, UIC.sub, 'right', { w: 600, sh: 0 });
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(b.x + 20, y0 - 6, b.w - 40, 1);

  const uid = lbCanPost() ? currentAuthUser.id : null;
  if (LB.st !== 'ok' && !LB.rows.length) {
    const msg = LB.st === 'loading' ? '正在读取排行榜…' : LB.st === 'off' ? '排行榜需要联网（当前为离线模式）' : LB.st === 'err' ? '读取失败，点「刷新」重试' : '暂无数据';
    ut(msg, 480, y0 + 150, 14, UIC.sub, 'center', { w: 600 });
    if (LB.st === 'err' && LB.err) ut(LB.err.slice(0, 90), 480, y0 + 178, 11, '#ff9aa4', 'center', { w: 500, sh: 0 });
  }
  if (LB.subErr) ut('上传失败：' + LB.subErr.slice(0, 80), 480, b.y + b.h - 70, 10.5, '#ff9aa4', 'center', { w: 500, sh: 0 });
  LB.rows.forEach((r, i) => {
    const y = y0 + i * rh, mine = r.user_id === uid;
    if (mine) { rpath(b.x + 16, y - 1, b.w - 32, rh - 2, 5); ctx.fillStyle = 'rgba(255,216,74,.14)'; ctx.fill(); }
    else if (i & 1) { ctx.fillStyle = 'rgba(255,255,255,.025)'; ctx.fillRect(b.x + 16, y - 1, b.w - 32, rh - 2); }
    const my = y + rh / 2 - 1, col = i < 3 ? medal[i] : UIC.txt;
    ut(String(i + 1), cx[0], my, i < 3 ? 15 : 12.5, col, 'center', { w: 700 });
    ut(r.nickname + (mine ? '（你）' : ''), cx[1], my, 12.5, mine ? acc : UIC.txt, 'left', { w: mine ? 700 : 500 });
    ut('Lv.' + r.lv, cx[2], my, 11.5, UIC.sub, 'right', { w: 600, sh: 0 });
    ut(Math.round(r.cp).toLocaleString(), cx[3], my, 13.5, i < 3 ? medal[i] : UIC.hi, 'right', { w: 700 });
  });

  // 自己的名次（不在前几名时单独一行）
  const my = b.y + b.h - 58;
  rpath(b.x + 20, my, b.w - 40, 30, 7); ctx.fillStyle = 'rgba(255,216,74,.08)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,216,74,.35)'; ctx.lineWidth = 1; ctx.stroke();
  const cp = calcCP();
  if (lbCanPost() && LB.me) {
    ut('我的名次  第 ' + LB.me.rank.toLocaleString() + ' 名', b.x + 36, my + 15, 12.5, acc, 'left', { w: 700 });
    ut(LB.me.nick, b.x + 300, my + 15, 12, UIC.txt, 'left', { w: 500 });
  } else if (!lbCanPost()) {
    ut('游客 / 离线账号无法上榜，登录或注册账号后自动参与排名', b.x + 36, my + 15, 12, '#ff9aa4', 'left', { w: 600 });
  } else ut('我的名次  —', b.x + 36, my + 15, 12.5, acc, 'left', { w: 700 });
  ut('我的战力 ' + cp.toLocaleString(), b.x + b.w - 36, my + 15, 13.5, UIC.hi, 'right', { w: 700 });
  ut('战力由等级、装备、天赋、研磨计算（不含变身加成）· Esc / 点击空白处关闭', 480, b.y + b.h - 12, 9.5, 'rgba(210,218,232,.5)', 'center', { w: 500, sh: 0 });
  ctx.restore();
}
