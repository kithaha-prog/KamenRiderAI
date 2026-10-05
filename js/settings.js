// ===================================================================
// 一、 全局游戏字体控制引擎 (Live Game Font Engine)
// ===================================================================
const FONT_PRESETS = [
  { id: 'default', name: '现代科技 (默认)', family: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif' },
  { id: 'kaiti',   name: '特摄书道 (楷体)', family: '"STKaiti", "KaiTi", "PingFang SC", serif' },
  { id: 'custom',  name: '专属特摄 (上传)', family: '"KamenRiderCustom", "PingFang SC", sans-serif' }
];

const FONT_KEY = 'kr_game_font_preset';

function getGameFontPreset() {
  try {
    const saved = localStorage.getItem(FONT_KEY);
    return FONT_PRESETS.find(p => p.id === saved) || FONT_PRESETS[0];
  } catch (e) {
    return FONT_PRESETS[0];
  }
}

function setGameFontPreset(id) {
  const target = FONT_PRESETS.find(p => p.id === id) || FONT_PRESETS[0];
  try { localStorage.setItem(FONT_KEY, target.id); } catch (e) {}
  applyGameFont(target);
  return target;
}

function cycleGameFont() {
  const cur = getGameFontPreset();
  const idx = FONT_PRESETS.findIndex(p => p.id === cur.id);
  const next = FONT_PRESETS[(idx + 1) % FONT_PRESETS.length];
  return setGameFontPreset(next.id);
}

function applyGameFont(preset) {
  window.GAME_FONT = preset.family;
  document.documentElement.style.setProperty('--game-font', preset.family);
  if (typeof UIF !== 'undefined') window.UIF = preset.family;
}

// 自动拦截 Canvas 字体设置，实现全游戏画面的无感知字体替换
(function hookCanvasFont() {
  const preset = getGameFontPreset();
  applyGameFont(preset);

  try {
    const proto = CanvasRenderingContext2D.prototype;
    const fontDesc = Object.getOwnPropertyDescriptor(proto, 'font');
    if (fontDesc && fontDesc.set) {
      const origSet = fontDesc.set;
      Object.defineProperty(proto, 'font', {
        set: function (val) {
          if (window.GAME_FONT && typeof val === 'string' && (val.includes('sans-serif') || val.includes('system-ui') || val.includes('serif'))) {
            val = val.replace(/-apple-system[^;]+/g, window.GAME_FONT)
                     .replace(/system-ui[^;]+/g, window.GAME_FONT);
          }
          origSet.call(this, val);
        },
        get: fontDesc.get,
        configurable: true,
        enumerable: true
      });
    }
  } catch (e) {
    console.warn('[Font Engine] Canvas 自动拦截已转入全局回退');
  }
})();

// ===================================================================
// 二、 变身动画模式控制
// ===================================================================
const HEN_MODE_KEY = 'kr_henshin_mode';
const HEN_SHORT = {
  malaya: { s0: 2.7,  s1: 4.69, snd: () => (typeof SND_MALAYA !== 'undefined' ? SND_MALAYA : null) },
  ryuki:  { s0: 5.5,  s1: 7.6,  len: () => RYUKI_AUDIO_LEN, snd: () => (typeof SNDR !== 'undefined' ? SNDR : null) },
  '555':  { s0: 7.4,  s1: 9.5,  len: () => FAIZ_AUDIO_LEN,  snd: () => (typeof SND5 !== 'undefined' ? SND5 : null) },
  blade:  { s0: 8.8,  s1: 10.8, len: () => BLADE_AUDIO_LEN, snd: () => (typeof SND6 !== 'undefined' ? SND6 : null) },
  deno:   { s0: 4.6,  s1: 6.4,  len: () => DENO_TL_LEN,     snd: () => (typeof SND_D !== 'undefined' ? SND_D : null) },
  zeztz:  { s0: 10.9, s1: 13.0, snd: () => (typeof SND_ZEZTZ !== 'undefined' ? SND_ZEZTZ : null) }
};

function henshinMode() { try { return localStorage.getItem(HEN_MODE_KEY) === 'short' ? 'short' : 'full'; } catch (e) { return 'full'; } }
function henshinSetMode(m) { try { localStorage.setItem(HEN_MODE_KEY, m === 'short' ? 'short' : 'full'); } catch (e) {} }

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

function henshinApply(key) {
  P.sk = 0; P.tend = 0;
  if (henshinMode() !== 'short') return;
  const c = HEN_SHORT[key]; if (!c) return;
  const a = c.snd(); if (!a) return;
  const dur = (isFinite(a.duration) && a.duration > 0.5) ? a.duration : 0;
  const len = c.len ? c.len() : (P.tdur || dur || 1);
  const td = P.tdur || dur || len;
  const k = td / len;
  P.sk = c.s0;
  P.t = c.s0 * k;
  P.tend = Math.min(c.s1 * k, td);
  const url = a.currentSrc || a.src;
  if (henshinPlayBuf(a, url, c.s0)) { try { a.pause(); } catch (e) {} }
  else { try { a.currentTime = c.s0; } catch (e) {} henLoad(key); }
}

function henshinShortFinish(key) {
  try {
    const nm = { ryuki: ['KAMEN RIDER RYUKI', '#ff4757'], '555': ['KAMEN RIDER 555', '#ffb400'] }[key];
    if (!nm) return;
    DT.push({ x: P.x, y: P.y - 210, s: nm[0], t: 1.4, c: nm[1] });
    FX.push({ type: 'boom', x: P.x, y: GY - 60, t: .5, d: .5, r: 240, c: '#ffd166' });
    shake = Math.max(shake, 14);
  } catch (e) {}
}

// ===================================================================
// 三、 系统设置机甲终端 UI (Cyber Armor Terminal UI)
// ===================================================================
(function () {
  const css = document.createElement('style');
  css.textContent = `
  :root {
    --game-font: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
  }
  #set-overlay {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 98;
    background: rgba(3, 6, 14, 0.88);
    backdrop-filter: blur(8px);
    align-items: center;
    justify-content: center;
    font-family: var(--game-font);
    user-select: none;
    -webkit-user-select: none;
  }
  #set-overlay.show { display: flex; }

  /* 机甲切角底盘 */
  .set-box {
    position: relative;
    width: min(92vw, 420px);
    background: linear-gradient(180deg, #0e172a 0%, #060a14 100%);
    border: 1.5px solid #00e5ff;
    border-radius: 14px;
    box-shadow: 0 0 30px rgba(0, 229, 255, 0.35), inset 0 0 15px rgba(0, 229, 255, 0.1);
    padding: 22px 24px;
    box-sizing: border-box;
    color: #fff;
  }
  .set-box::before {
    content: '';
    position: absolute;
    top: -2px; left: 24px; right: 24px; height: 2px;
    background: linear-gradient(90deg, transparent, #00e5ff, #ffd84a, #00e5ff, transparent);
  }
  .set-box.warn {
    border-color: #ff4757;
    box-shadow: 0 0 30px rgba(255, 71, 87, 0.4), inset 0 0 15px rgba(255, 71, 87, 0.12);
  }

  /* 顶栏标题 */
  .set-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
  }
  .set-t {
    font-size: 18px;
    font-weight: 800;
    color: #7df9ff;
    letter-spacing: 1.2px;
    text-shadow: 0 0 10px rgba(0, 229, 255, 0.6);
  }
  .set-box.warn .set-t { color: #ff8a95; text-shadow: 0 0 10px rgba(255, 71, 87, 0.6); }
  .set-s {
    font-size: 9.5px;
    color: #7a8fa6;
    letter-spacing: 0.8px;
    margin-top: 2px;
  }
  .set-close-x {
    cursor: pointer;
    font-size: 13px;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.15);
    padding: 3px 8px;
    border-radius: 4px;
    transition: 0.15s;
  }
  .set-close-x:hover { color: #fff; border-color: #ff4757; background: rgba(255, 71, 87, 0.2); }

  /* 骑士终端身份识别芯片 */
  .set-id-chip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: rgba(15, 23, 42, 0.85);
    border: 1px solid rgba(0, 229, 255, 0.25);
    border-radius: 8px;
    margin-bottom: 14px;
  }
  .set-id-left { display: flex; align-items: center; gap: 8px; }
  .set-id-beacon {
    width: 8px; height: 8px; border-radius: 50%;
    background: #2ed573; box-shadow: 0 0 8px #2ed573;
  }
  .set-id-beacon.guest { background: #ffd84a; box-shadow: 0 0 8px #ffd84a; }
  .set-id-name { font-size: 12px; font-weight: 700; color: #f1f5f9; }
  .set-id-tag {
    font-size: 9px; font-weight: 700;
    color: #00e5ff; background: rgba(0, 229, 255, 0.15);
    border: 1px solid rgba(0, 229, 255, 0.4);
    padding: 2px 6px; border-radius: 4px;
  }

  /* 分组板块 */
  .set-group { margin-bottom: 12px; }
  .set-group-title {
    font-size: 10px; font-weight: 700; color: #8fa0b5;
    letter-spacing: 1px; margin-bottom: 6px;
    display: flex; align-items: center; gap: 5px;
  }
  .set-group-title::after {
    content: ''; flex: 1; height: 1px; background: rgba(255, 255, 255, 0.08);
  }

  /* 按钮通用设定 */
  .set-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .set-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: 38px;
    box-sizing: border-box;
    padding: 0 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.04);
    color: #e2e8f0;
    transition: 0.12s;
  }
  .set-btn:hover { background: rgba(255, 255, 255, 0.09); border-color: rgba(0, 229, 255, 0.45); }
  .set-btn:active { transform: scale(0.98); }
  .set-btn .label { display: flex; align-items: center; gap: 6px; }
  .set-btn .val {
    font-size: 11px; color: #7df9ff; background: rgba(0, 229, 255, 0.12);
    padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(0, 229, 255, 0.3);
  }

  /* 特殊高亮按钮 */
  .set-btn.main-resume {
    height: 42px;
    margin-top: 14px;
    justify-content: center;
    background: linear-gradient(180deg, #00e5ff 0%, #0099b8 100%);
    border: none;
    color: #050b14;
    font-size: 14.5px;
    font-weight: 800;
    box-shadow: 0 0 16px rgba(0, 229, 255, 0.45);
  }
  .set-btn.main-resume:hover { filter: brightness(1.1); }
  .set-btn.danger {
    background: rgba(255, 71, 87, 0.08);
    border-color: rgba(255, 71, 87, 0.4);
    color: #ff8a95;
  }
  .set-btn.danger:hover { background: rgba(255, 71, 87, 0.18); border-color: #ff4757; }
  .set-btn.danger.go {
    background: linear-gradient(180deg, #ff4757, #b3202e);
    border: none; color: #fff; justify-content: center; height: 40px; margin-top: 10px;
  }

  .set-st {
    min-height: 16px;
    margin-top: 8px;
    font-size: 11px;
    text-align: center;
    color: #7dff9a;
  }
  .set-esc-tip {
    font-size: 10px;
    color: #64748b;
    text-align: center;
    margin-top: 6px;
  }
  `;
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
    if (!u) return { name: nick || '离线骑士', email: '本地单机模式', isGuest: true };
    const guest = u.is_anonymous || String(u.id).startsWith('local_guest');
    return {
      name: nick || (guest ? '游客战士' : '正式骑士'),
      email: guest ? '临时游客通道' : (u.email || '已连接'),
      isGuest: guest
    };
  }

  function render(s) {
    stage = s;
    box.classList.toggle('warn', s === 'confirm');
    const user = who();
    const curFont = getGameFontPreset();

    if (s === 'main') {
      box.innerHTML = `
        <div class="set-head">
          <div>
            <div class="set-t">SYSTEM // 终端整备</div>
            <div class="set-s">PILOT CONFIGURATION & ARCHIVE</div>
          </div>
          <div class="set-close-x" id="btn-set-x">✕ 关闭</div>
        </div>

        <div class="set-id-chip">
          <div class="set-id-left">
            <div class="set-id-beacon ${user.isGuest ? 'guest' : ''}"></div>
            <div>
              <div class="set-id-name">${user.name.replace(/</g, '&lt;')}</div>
              <div style="font-size: 10px; color: #8fa0b5;">${user.email}</div>
            </div>
          </div>
          <div class="set-id-tag">${user.isGuest ? 'GUEST' : 'VERIFIED'}</div>
        </div>

        <div class="set-group">
          <div class="set-group-title">战术与视觉 // TACTICAL & DISPLAY</div>
          <div class="set-row-2">
            <button class="set-btn" id="set-hen">
              <span class="label">⚡ 变身动画</span>
              <span class="val">${henshinMode() === 'short' ? '精简 2.0s' : '完整原速'}</span>
            </button>
            <button class="set-btn" id="set-font">
              <span class="label">🔤 核心字型</span>
              <span class="val">${curFont.name.split(' ')[0]}</span>
            </button>
          </div>
        </div>

        <div class="set-group">
          <div class="set-group-title">云端存储 // CLOUD ARCHIVE</div>
          <button class="set-btn" id="set-sync">
            <span class="label">☁️ 立即同步至云端档案</span>
            <span class="val" style="color: #7dff9a; border-color: rgba(46, 213, 115, 0.4);">备份 SYNC</span>
          </button>
        </div>

        <div class="set-group">
          <div class="set-group-title">安全与授权 // SECURITY & AUTH</div>
          <div class="set-row-2">
            <button class="set-btn" id="set-logout">
              <span class="label">🚪 退出登录</span>
            </button>
            <button class="set-btn danger" id="set-delete">
              <span class="label">⚠️ 注销账号</span>
            </button>
          </div>
        </div>

        <button class="set-btn main-resume" id="set-resume">▶ 继 续 游 戏 [ESC]</button>
        <div class="set-st" id="set-st"></div>
        <div class="set-esc-tip">按 [ESC] 键随时关闭并返回控制</div>
      `;

      box.querySelector('#btn-set-x').onclick = closeSet;
      box.querySelector('#set-resume').onclick = closeSet;
      box.querySelector('#set-sync').onclick = doSync;

      // 变身动画切换
      box.querySelector('#set-hen').onclick = () => {
        const m = henshinMode() === 'short' ? 'full' : 'short';
        henshinSetMode(m);
        if (m === 'short') henshinPreload();
        render('main');
        status(m === 'short' ? '已切入：精简变身（约 2 秒，含爆发判定）' : '已切入：完整原声变身');
      };

      // 游戏字型循环切换
      box.querySelector('#set-font').onclick = () => {
        const next = cycleGameFont();
        render('main');
        status(`字型已切换至：${next.name}`);
        if (typeof DT !== 'undefined' && typeof P !== 'undefined') {
          DT.push({ x: P.x, y: P.y - 180, s: `字型：${next.name}`, t: 1.0, c: '#00e5ff' });
        }
      };

      box.querySelector('#set-logout').onclick = doSignOut;
      box.querySelector('#set-delete').onclick = () => render('confirm');

    } else {
      // 永久注销警告对话框
      box.innerHTML = `
        <div class="set-head">
          <div>
            <div class="set-t">⚠ 永久注销终端</div>
            <div class="set-s">DATA PURGE PROTOCOL // IRREVERSIBLE</div>
          </div>
          <div class="set-close-x" id="btn-cancel-x">✕</div>
        </div>

        <div style="font-size: 11.5px; line-height: 1.6; color: #cbd5e1; margin: 10px 0 16px; background: rgba(255, 71, 87, 0.1); padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255, 71, 87, 0.35);">
          此操作将从云端服务器中<b style="color: #ff8a95">永久擦除</b>：<br>
          · 角色等级、装备、天赋与变身胶囊存档<br>
          · 全服战力、无尽塔与世界 BOSS 历史排位<br>
          <span style="color: #ff7675; font-weight: 700;">该抹除操作无法撤销或找回。</span>
        </div>

        <input id="set-type" style="width: 100%; height: 38px; box-sizing: border-box; border-radius: 6px; border: 1px solid rgba(255, 71, 87, 0.6); background: rgba(15, 23, 42, 0.9); color: #fff; padding: 0 10px; font-size: 13px; text-align: center; outline: none; font-family: inherit;" placeholder="请输入「删除」二字以确认授权" autocomplete="off">
        
        <button class="set-btn danger go" id="set-yes" disabled>核准抹除并注销账号</button>
        <button class="set-btn" id="set-no" style="justify-content: center; margin-top: 8px;">取 消 并 返 回</button>
        <div class="set-st" id="set-st"></div>
      `;

      const yes = box.querySelector('#set-yes'), inp = box.querySelector('#set-type');
      inp.addEventListener('input', () => { yes.disabled = inp.value.trim() !== '删除'; });
      box.querySelector('#btn-cancel-x').onclick = () => render('main');
      box.querySelector('#set-no').onclick = () => render('main');
      yes.onclick = doDelete;
    }
  }

  function status(m, err) {
    const e = box.querySelector('#set-st');
    if (e) {
      e.style.color = err ? '#ff7675' : '#7dff9a';
      e.textContent = m;
    }
  }

  async function doSync() {
    if (busy) return; busy = true;
    try {
      if (typeof save === 'function') save();
      if (!currentAuthUser || String(currentAuthUser.id).startsWith('local_guest')) {
        status('当前为离线模式，档案已保存在本机浏览器');
      } else {
        status('正在上传至 Supabase 云端档案…');
        await forceSyncCloudSave();
        status('✔ 云端备份成功');
      }
    } catch (e) {
      status('备份失败，请检查网络连接', true);
    }
    busy = false;
  }

  async function doSignOut() {
    if (busy) return; busy = true;
    status('正在保存并断开连线…');
    try { if (typeof save === 'function') save(); } catch (e) {}
    await authSignOut();
    busy = false;
    status('退出失败，请稍候再试', true);
  }

  async function doDelete() {
    if (busy) return;
    const inp = box.querySelector('#set-type');
    if (!inp || inp.value.trim() !== '删除') return;
    busy = true;
    status('正在向安全中枢提交抹除指令…');
    const r = await authDeleteAccount();
    if (r && r.ok) return;
    busy = false;
    status((r && r.msg) || '注销受限，请稍后再试', true);
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

  function canOpen() {
    if (typeof G === 'undefined' || !(G === 'vil' || G === 'room')) return false;
    if (document.getElementById('auth-overlay').classList.contains('show')) return false;
    if (typeof M !== 'undefined' && M) return false;
    if (typeof showChar !== 'undefined' && showChar) return false;
    if (typeof showCapModal !== 'undefined' && showCapModal) return false;
    if (typeof showStat !== 'undefined' && showStat) return false;
    if (typeof showQuest !== 'undefined' && showQuest) return false;
    if (typeof gachaModal !== 'undefined' && gachaModal) return false;
    if (typeof HALL_MODAL !== 'undefined' && HALL_MODAL.show) return false;
    if (typeof P !== 'undefined' && (P.st === 'trans' || P.st === 'trans_ryuki')) return false;
    if (typeof COOP !== 'undefined' && COOP.active && COOP.inGame) return false;
    return true;
  }

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
    e.stopImmediatePropagation();
    e.preventDefault();
    openSet();
  }, true);

  addEventListener('keyup', e => { if (isOpen()) e.stopImmediatePropagation(); }, true);

  window.openSettings = openSet;
  setTimeout(henshinPreload, 2500);
})();