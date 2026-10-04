// ===== 变身动画：完整 / 精简（约 2 秒，含伤害爆发）=====
// 精简模式 = 直接从变身中段切入，播到爆发(伤害判定)后收尾；音频同步跳到同一位置。
// 各骑士窗口 [s0, s1] 为“音频原速秒数”，爆发 / 伤害事件都落在窗口内；想调节奏只改这张表。
const HEN_MODE_KEY = 'kr_henshin_mode';
const HEN_SHORT = {
  malaya: { s0: 2.7,  s1: 4.69, snd: () => (typeof SND_MALAYA !== 'undefined' ? SND_MALAYA : null) },                                     // 爆发 3.70
  ryuki:  { s0: 5.5,  s1: 7.6,  len: () => RYUKI_AUDIO_LEN, snd: () => (typeof SNDR !== 'undefined' ? SNDR : null) },                    // 爆发 6.40
  '555':  { s0: 7.4,  s1: 9.5,  len: () => FAIZ_AUDIO_LEN,  snd: () => (typeof SND5 !== 'undefined' ? SND5 : null) },                    // 爆发 8.50
  blade:  { s0: 8.8,  s1: 10.8, len: () => BLADE_AUDIO_LEN, snd: () => (typeof SND6 !== 'undefined' ? SND6 : null) },                    // 伤害 9.82
  deno:   { s0: 4.6,  s1: 6.4,  len: () => DENO_TL_LEN,     snd: () => (typeof SND_D !== 'undefined' ? SND_D : null) },                   // 伤害 5.80
  zeztz:  { s0: 10.9, s1: 13.0, snd: () => (typeof SND_ZEZTZ !== 'undefined' ? SND_ZEZTZ : null) }                                        // 爆发 11.75
};
function henshinMode() { try { return localStorage.getItem(HEN_MODE_KEY) === 'short' ? 'short' : 'full'; } catch (e) { return 'full'; } }
function henshinSetMode(m) { try { localStorage.setItem(HEN_MODE_KEY, m === 'short' ? 'short' : 'full'); } catch (e) {} }

// ---- 精简模式的音频：用 WebAudio 缓冲从指定秒数开播 ----
// 原因：python http.server 等不支持 Range 的服务器上，<audio> 无法跳到中段（currentTime 会被打回 0），
// 而变身动画的时钟又跟随音频 → 会退回完整播放。所以精简模式改用解码后的缓冲播放，动画走自己的时钟。
const HEN_BUF = { ctx: null, buf: {}, loading: {}, src: null };
function henCtx() { if (!HEN_BUF.ctx) { const C = window.AudioContext || window.webkitAudioContext; if (C) { try { HEN_BUF.ctx = new C(); } catch (e) {} } } return HEN_BUF.ctx; }
function henLoad(key) {
  const c = HEN_SHORT[key], a = c && c.snd(); if (!a) return;
  const url = a.currentSrc || a.src; if (!url || HEN_BUF.buf[url] || HEN_BUF.loading[url]) return;
  const ctx = henCtx(); if (!ctx) return;
  HEN_BUF.loading[url] = 1;
  fetch(url).then(r => r.arrayBuffer()).then(ab => new Promise((ok, no) => ctx.decodeAudioData(ab, ok, no)))
    .then(b => { HEN_BUF.buf[url] = b; }).catch(() => {}).then(() => { delete HEN_BUF.loading[url]; });
}
function henshinPreload() { if (henshinMode() === 'short') for (const k in HEN_SHORT) henLoad(k); }
function henshinStopBuf() { if (HEN_BUF.src) { try { HEN_BUF.src.stop(); } catch (e) {} HEN_BUF.src = null; } }
function henshinPlayBuf(a, url, off) {
  const ctx = HEN_BUF.ctx, b = HEN_BUF.buf[url]; if (!ctx || !b) return false;
  try {
    if (ctx.state === 'suspended') ctx.resume();
    henshinStopBuf();
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = b; g.gain.value = a.muted ? 0 : (typeof a.volume === 'number' ? a.volume : 1);
    src.connect(g); g.connect(ctx.destination); src.start(0, off); HEN_BUF.src = src; return true;
  } catch (e) { return false; }
}

// 变身开始后立刻调用（必须在 play*Henshin() 之后，因为它们会把音频拨回 0）
function henshinApply(key) {
  P.sk = 0; P.tend = 0;                       // 默认完整模式
  if (henshinMode() !== 'short') return;
  const c = HEN_SHORT[key]; if (!c) return;
  const a = c.snd(); if (!a) return;          // 没有音频：完整动画本来就只有 ~2 秒
  const dur = (isFinite(a.duration) && a.duration > 0.5) ? a.duration : 0;
  const len = c.len ? c.len() : (P.tdur || dur || 1);
  const td = P.tdur || dur || len;
  const k = td / len;                         // 轴秒 → P.t 的换算系数
  P.sk = c.s0;                                // 起点之前的节拍事件不再触发
  P.t = c.s0 * k;
  P.tend = Math.min(c.s1 * k, td);
  const url = a.currentSrc || a.src;
  if (henshinPlayBuf(a, url, c.s0)) { try { a.pause(); } catch (e) {} }   // 元素静音暂停 → 动画走自己的时钟
  else { try { a.currentTime = c.s0; } catch (e) {} henLoad(key); }       // 缓冲还没就绪：尽力 seek（下次就有缓冲了）
}

// 精简变身收尾：龙骑 / 555 的名字事件在窗口之外，这里补一个收势
function henshinShortFinish(key) {
  try {
    const nm = { ryuki: ['KAMEN RIDER RYUKI', '#ff4757'], '555': ['KAMEN RIDER 555', '#ffb400'] }[key];
    if (!nm) return;
    DT.push({ x: P.x, y: P.y - 210, s: nm[0], t: 1.4, c: nm[1] });
    FX.push({ type: 'boom', x: P.x, y: GY - 60, t: .5, d: .5, r: 240, c: '#ffd166' });
    shake = Math.max(shake, 14);
  } catch (e) {}
}

// ===== 基地设置界面（Esc 呼出）=====
// 只在基地 / 房间里、且没有别的弹窗打开时响应 Esc。
// 里面可以：继续游戏 / 立即云端备份 / 注销账号（必须二次确认才会执行）。
(function () {
  const css = document.createElement('style');
  css.textContent = `
  #set-overlay{display:none;position:fixed;inset:0;z-index:98;background:rgba(3,6,14,.92);align-items:center;justify-content:center}
  #set-overlay.show{display:flex}
  .set-box{width:min(90vw,360px);background:linear-gradient(180deg,#0e172a,#060a14);border:1.5px solid #00e5ff;border-radius:12px;
    box-shadow:0 0 25px rgba(0,229,255,.35);padding:22px;box-sizing:border-box;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;text-align:center}
  .set-box.warn{border-color:#ff4757;box-shadow:0 0 25px rgba(255,71,87,.4)}
  .set-t{font-size:18px;font-weight:700;color:#7df9ff;letter-spacing:1px}
  .set-box.warn .set-t{color:#ff8a95}
  .set-s{font-size:11px;color:#7a8fa6;margin:4px 0 14px}
  .set-who{font-size:12.5px;color:#cbd5e1;margin-bottom:14px;padding:8px;border-radius:6px;background:rgba(255,255,255,.05);word-break:break-all}
  .set-msg{font-size:12.5px;line-height:1.7;color:#e2e8f0;margin:6px 0 14px}
  .set-btn{display:block;width:100%;height:40px;margin-top:10px;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.07);color:#e2e8f0}
  .set-btn.main{background:linear-gradient(180deg,#00e5ff,#0099b8);border:none;color:#050b14}
  .set-btn.danger{background:rgba(255,71,87,.15);border-color:#ff4757;color:#ff8a95}
  .set-btn.danger.go{background:linear-gradient(180deg,#ff4757,#b3202e);border:none;color:#fff}
  .set-btn:active{transform:scale(.98)}
  .set-btn:disabled{opacity:.5;cursor:default}
  .set-in{width:100%;height:38px;box-sizing:border-box;border-radius:6px;border:1px solid rgba(255,71,87,.6);background:rgba(15,23,42,.9);color:#fff;padding:0 10px;font-size:13px;text-align:center;outline:none}
  .set-in:focus{border-color:#ff4757;box-shadow:0 0 8px rgba(255,71,87,.4)}
  .set-st{min-height:16px;margin-top:8px;font-size:11.5px;color:#7dff9a}`;
  document.head.appendChild(css);

  const ov = document.createElement('div');
  ov.id = 'set-overlay';
  ov.innerHTML = '<div class="set-box" id="set-box"></div>';
  document.body.appendChild(ov);
  const box = ov.firstChild;

  let stage = 'main', busy = false;
  const isOpen = () => ov.classList.contains('show');

  function who() {
    const u = (typeof currentAuthUser !== 'undefined') ? currentAuthUser : null;
    const nick = (typeof S !== 'undefined' && S.nick) ? S.nick : '';
    if (!u) return nick || '未登录';
    const acc = u.is_anonymous || String(u.id).startsWith('local_guest') ? '游客账号' : (u.email || '已登录');
    return (nick ? nick + ' · ' : '') + acc;
  }
  const isGuest = () => { const u = currentAuthUser; return !!u && (u.is_anonymous || String(u.id).startsWith('local_guest')); };

  function render(s) {
    stage = s;
    box.classList.toggle('warn', s === 'confirm');
    if (s === 'main') {
      box.innerHTML =
        '<div class="set-t">SYSTEM // 设置</div><div class="set-s">SETTINGS</div>' +
        '<div class="set-who">当前账号：' + who().replace(/</g, '&lt;') + '</div>' +
        '<button class="set-btn main" id="set-resume">继 续 游 戏</button>' +
        '<button class="set-btn" id="set-sync">立 即 云 端 备 份</button>' +
        '<button class="set-btn" id="set-hen">变 身 动 画：' + (henshinMode() === 'short' ? '精 简（约 2 秒）' : '完 整') + '</button>' +
        '<button class="set-btn" id="set-logout">退 出 登 录（保 留 存 档）</button>' +
        '<button class="set-btn danger" id="set-delete">注 销 账 号（删 除 全 部 数 据）</button>' +
        '<div class="set-st" id="set-st"></div>';
      box.querySelector('#set-resume').onclick = closeSet;
      box.querySelector('#set-sync').onclick = doSync;
      box.querySelector('#set-hen').onclick = () => {
        const m = henshinMode() === 'short' ? 'full' : 'short';
        henshinSetMode(m); if (m === 'short') henshinPreload(); render('main');
        status(m === 'short' ? '已切换：精简变身（约 2 秒，含爆发伤害）' : '已切换：完整变身动画');
      };
      box.querySelector('#set-logout').onclick = doSignOut;
      box.querySelector('#set-delete').onclick = () => render('confirm');
      box.querySelector('#set-resume').focus();

    } else {
      const g = isGuest();
      box.innerHTML =
        '<div class="set-t">⚠ 永久注销账号</div><div class="set-s">DELETE ACCOUNT · IRREVERSIBLE</div>' +
        '<div class="set-msg">将<b style="color:#ff8a95">永久删除</b>：<br>· 云端存档与本机存档<br>· 排行榜 / 战绩记录<br>' +
        (g ? '· 这个游客账号<br>' : '· 登录账号（邮箱）<br>') +
        '<b style="color:#ff8a95">删除后无法恢复，也无法找回。</b></div>' +
        '<input id="set-type" class="set-in" placeholder="请输入「删除」二字确认" autocomplete="off">' +
        '<button class="set-btn danger go" id="set-yes" disabled>永 久 注 销</button>' +
        '<button class="set-btn" id="set-no">取 消</button>' +
        '<div class="set-st" id="set-st"></div>';
      const yes = box.querySelector('#set-yes'), inp = box.querySelector('#set-type');
      inp.addEventListener('input', () => { yes.disabled = inp.value.trim() !== '删除'; });
      box.querySelector('#set-no').onclick = () => render('main');
      yes.onclick = doDelete;
    }
  }

  function status(m, err) { const e = box.querySelector('#set-st'); if (e) { e.style.color = err ? '#ff7675' : '#7dff9a'; e.textContent = m; } }

  async function doSync() {
    if (busy) return; busy = true;
    try {
      if (typeof save === 'function') save();
      if (!currentAuthUser || String(currentAuthUser.id).startsWith('local_guest')) status('当前为离线游客，仅保存在本机');
      else { status('正在备份…'); await forceSyncCloudSave(); status('✔ 已备份到云端'); }
    } catch (e) { status('备份失败，请稍后再试', true); }
    busy = false;
  }

  function lock(on) { box.querySelectorAll('button,input').forEach(b => b.disabled = on); }

  // 退出登录：先备份，再退出，本机存档清掉（下次登录可从云端取回）
  async function doSignOut() {
    if (busy) return; busy = true; lock(true);
    status('正在备份并退出…');
    try { if (typeof save === 'function') save(); } catch (e) {}
    await authSignOut();   // 成功会刷新页面；走到下面说明失败
    busy = false; lock(false);
    status('退出失败，请稍后再试', true);
  }

  // 永久注销：删云端存档 + 排行榜 + 登录账号，再清空本机（见 auth.js 的 authDeleteAccount）
  async function doDelete() {
    if (busy) return;
    const inp = box.querySelector('#set-type');
    if (!inp || inp.value.trim() !== '删除') return;
    busy = true; lock(true);
    status('正在删除账号与全部数据…');
    const r = await authDeleteAccount();   // 成功会刷新页面
    if (r && r.ok) return;
    busy = false; lock(false);
    box.querySelector('#set-yes').disabled = false;
    status((r && r.msg) || '注销失败，请稍后再试', true);
  }

  function openSet() {
    try { for (const k in PR) delete PR[k]; for (const k in K) K[k] = 0; } catch (e) {}
    ov.classList.add('show');
    render('main');
  }
  function closeSet() {
    ov.classList.remove('show');
    try { for (const k in PR) delete PR[k]; for (const k in K) K[k] = 0; } catch (e) {}
  }

  // 只在基地 / 房间里，且没有别的弹窗 / 菜单 / 变身动画时才响应 Esc
  // 只在基地 / 房间里，且没有别的弹窗 / 菜单 / 变身动画时才响应 Esc[cite: 18]
  function canOpen() {
    if (typeof G === 'undefined' || !(G === 'vil' || G === 'room')) return false;
    if (document.getElementById('auth-overlay').classList.contains('show')) return false;
    if (typeof M !== 'undefined' && M) return false;
    if (typeof showChar !== 'undefined' && showChar) return false;
    if (typeof showCapModal !== 'undefined' && showCapModal) return false;
    if (typeof showStat !== 'undefined' && showStat) return false;
    if (typeof showQuest !== 'undefined' && showQuest) return false;
    if (typeof gachaModal !== 'undefined' && gachaModal) return false;
    // ★ 加入此行：展厅检视弹窗开启期间，禁止 Esc 打开系统设置！
    if (typeof HALL_MODAL !== 'undefined' && HALL_MODAL.show) return false;
    if (typeof P !== 'undefined' && (P.st === 'trans' || P.st === 'trans_ryuki')) return false;
    if (typeof COOP !== 'undefined' && COOP.active && COOP.inGame) return false;
    return true;
  }

  // 用「捕获阶段」的监听：比游戏自己的按键监听先执行。
  // 打开期间：Esc = 返回 / 关闭，其它按键一律不让游戏收到（输入框里打字不受影响）。
  addEventListener('keydown', e => {
    if (isOpen()) {
      e.stopImmediatePropagation();
      if (e.code === 'Escape') {
        e.preventDefault();
        if (e.repeat || busy) return;
        stage === 'confirm' ? render('main') : closeSet();
      }
      return;
    }
    if (e.code !== 'Escape' || e.repeat || !canOpen()) return;
    e.stopImmediatePropagation();   // 这一下 Esc 只用来打开设置，游戏本体不再响应
    e.preventDefault();
    openSet();
  }, true);
  addEventListener('keyup', e => { if (isOpen()) e.stopImmediatePropagation(); }, true);
  window.openSettings = openSet;
  setTimeout(henshinPreload, 2500);
})();
