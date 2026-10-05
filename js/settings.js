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
// 三、 系统设置机甲终端 UI (Cyber Armor Terminal UI) —— 手机适配版
//   · 盒子 = 固定标题栏 + 可滚动主体 + 固定底栏（继续游戏永远可见）
//   · 矮屏(横屏手机)自动改为左右双栏，一屏放得下
//   · 跟随 visualViewport，软键盘弹出时不会被遮挡
// ===================================================================
(function () {
  const IS_TOUCH = (typeof TOUCH !== 'undefined' && TOUCH) || (window.matchMedia && matchMedia('(pointer:coarse)').matches);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const css = document.createElement('style');
  css.textContent = `
  :root {
    --game-font: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
  }
  #set-overlay {
    display: none;
    position: fixed;
    left: 0; right: 0; top: 0;
    height: 100vh;
    height: var(--vvh, 100dvh);
    z-index: 98;
    background: rgba(3, 6, 14, 0.88);
    -webkit-backdrop-filter: blur(8px);
    backdrop-filter: blur(8px);
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    padding: max(8px, env(safe-area-inset-top, 0px)) max(8px, env(safe-area-inset-right, 0px))
             max(8px, env(safe-area-inset-bottom, 0px)) max(8px, env(safe-area-inset-left, 0px));
    font-family: var(--game-font);
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
    overscroll-behavior: contain;
  }
  #set-overlay.show { display: flex; }
  #set-overlay * { -webkit-tap-highlight-color: transparent; }
  /* 手机端：去掉重度模糊，战斗画布还在后台跑，blur 会明显掉帧 */
  body.touch #set-overlay { -webkit-backdrop-filter: none; backdrop-filter: none; background: rgba(3, 6, 14, 0.94); }

  .set-box {
    position: relative;
    display: flex;
    flex-direction: column;
    width: min(100%, 420px);
    max-height: 100%;
    background: linear-gradient(180deg, #0e172a 0%, #060a14 100%);
    border: 1.5px solid #00e5ff;
    border-radius: 14px;
    box-shadow: 0 0 30px rgba(0, 229, 255, 0.35), inset 0 0 15px rgba(0, 229, 255, 0.1);
    box-sizing: border-box;
    color: #fff;
    overflow: hidden;
  }
  .set-box::before {
    content: '';
    position: absolute;
    top: 0; left: 24px; right: 24px; height: 2px;
    background: linear-gradient(90deg, transparent, #00e5ff, #ffd84a, #00e5ff, transparent);
    pointer-events: none;
  }
  .set-box.warn {
    border-color: #ff4757;
    box-shadow: 0 0 30px rgba(255, 71, 87, 0.4), inset 0 0 15px rgba(255, 71, 87, 0.12);
  }

  /* 顶栏（固定） */
  .set-head {
    flex: none;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
    padding: 18px 22px 10px;
  }
  .set-t {
    font-size: 18px; font-weight: 800; color: #7df9ff; letter-spacing: 1.2px;
    text-shadow: 0 0 10px rgba(0, 229, 255, 0.6);
  }
  .set-box.warn .set-t { color: #ff8a95; text-shadow: 0 0 10px rgba(255, 71, 87, 0.6); }
  .set-s { font-size: 9.5px; color: #7a8fa6; letter-spacing: 0.8px; margin-top: 2px; }
  .set-close-x {
    flex: none;
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 64px; min-height: 36px;
    box-sizing: border-box;
    font: 700 13px/1 inherit; font-family: inherit;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.15);
    padding: 0 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: 0.15s;
  }
  .set-close-x:hover { color: #fff; border-color: #ff4757; background: rgba(255, 71, 87, 0.2); }
  .set-close-x:active { transform: scale(0.96); }

  /* 主体（可滚动） */
  .set-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    touch-action: pan-y;
    padding: 2px 22px 6px;
  }
  .set-body::-webkit-scrollbar { width: 4px; }
  .set-body::-webkit-scrollbar-thumb { background: rgba(0, 229, 255, 0.35); border-radius: 2px; }
  .set-col { min-width: 0; }

  /* 底栏（固定：状态 + 继续游戏） */
  .set-foot { flex: none; padding: 6px 22px 16px; }

  /* 身份芯片 */
  .set-id-chip {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    padding: 8px 12px;
    background: rgba(15, 23, 42, 0.85);
    border: 1px solid rgba(0, 229, 255, 0.25);
    border-radius: 8px;
    margin-bottom: 14px;
  }
  .set-id-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .set-id-left > div:last-child { min-width: 0; }
  .set-id-beacon { flex: none; width: 8px; height: 8px; border-radius: 50%; background: #2ed573; box-shadow: 0 0 8px #2ed573; }
  .set-id-beacon.guest { background: #ffd84a; box-shadow: 0 0 8px #ffd84a; }
  .set-id-name { font-size: 12px; font-weight: 700; color: #f1f5f9; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .set-id-mail { font-size: 10px; color: #8fa0b5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .set-id-tag {
    flex: none; font-size: 9px; font-weight: 700; color: #00e5ff; background: rgba(0, 229, 255, 0.15);
    border: 1px solid rgba(0, 229, 255, 0.4); padding: 2px 6px; border-radius: 4px;
  }

  /* 分组 */
  .set-group { margin-bottom: 12px; }
  .set-group-title {
    font-size: 10px; font-weight: 700; color: #8fa0b5; letter-spacing: 1px; margin-bottom: 6px;
    display: flex; align-items: center; gap: 5px;
  }
  .set-group-title::after { content: ''; flex: 1; height: 1px; background: rgba(255, 255, 255, 0.08); }

  /* 按钮 */
  .set-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .set-row-2 .wide { grid-column: 1 / -1; }
  .set-row-2 + .set-row-2 { margin-top: 8px; }
  .set-btn {
    display: flex; align-items: center; justify-content: space-between; gap: 6px;
    width: 100%; min-width: 0; height: 40px;
    box-sizing: border-box; padding: 0 12px;
    border-radius: 6px;
    font-size: 12px; font-weight: 700; font-family: inherit;
    cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.04);
    color: #e2e8f0;
    transition: 0.12s;
    touch-action: manipulation;
    -webkit-appearance: none; appearance: none;
  }
  .set-btn:hover { background: rgba(255, 255, 255, 0.09); border-color: rgba(0, 229, 255, 0.45); }
  .set-btn:active { transform: scale(0.98); background: rgba(0, 229, 255, 0.16); }
  .set-btn:disabled { opacity: .4; cursor: not-allowed; transform: none; }
  .set-btn .label { display: flex; align-items: center; gap: 6px; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .set-btn .val {
    flex: none; font-size: 11px; color: #7df9ff; background: rgba(0, 229, 255, 0.12);
    padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(0, 229, 255, 0.3); white-space: nowrap;
  }
  .set-btn .val.ok { color: #7dff9a; border-color: rgba(46, 213, 115, 0.4); background: rgba(46, 213, 115, 0.1); }

  .set-btn.main-resume {
    height: 44px; margin-top: 6px; justify-content: center;
    background: linear-gradient(180deg, #00e5ff 0%, #0099b8 100%);
    border: none; color: #050b14; font-size: 14.5px; font-weight: 800;
    box-shadow: 0 0 16px rgba(0, 229, 255, 0.45);
  }
  .set-btn.main-resume:hover { filter: brightness(1.1); }
  .set-btn.danger { background: rgba(255, 71, 87, 0.08); border-color: rgba(255, 71, 87, 0.4); color: #ff8a95; }
  .set-btn.danger:hover { background: rgba(255, 71, 87, 0.18); border-color: #ff4757; }
  .set-btn.danger.go { background: linear-gradient(180deg, #ff4757, #b3202e); border: none; color: #fff; justify-content: center; margin-top: 10px; }
  .set-btn.center { justify-content: center; margin-top: 8px; }

  .set-warn-box {
    font-size: 11.5px; line-height: 1.6; color: #cbd5e1; margin: 6px 0 14px;
    background: rgba(255, 71, 87, 0.1); padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255, 71, 87, 0.35);
  }
  .set-input {
    width: 100%; height: 42px; box-sizing: border-box; border-radius: 6px;
    border: 1px solid rgba(255, 71, 87, 0.6); background: rgba(15, 23, 42, 0.9);
    color: #fff; padding: 0 10px; text-align: center; outline: none; font-family: inherit;
    font-size: 16px;                       /* ≥16px：iOS 聚焦时不会自动放大页面 */
    -webkit-user-select: text; user-select: text;   /* iOS：user-select:none 的 input 无法输入 */
    -webkit-appearance: none; appearance: none;
  }
  .set-input:focus { border-color: #ff4757; box-shadow: 0 0 0 2px rgba(255, 71, 87, 0.25); }

  .set-st { min-height: 16px; margin: 4px 0 2px; font-size: 11px; text-align: center; color: #7dff9a; line-height: 1.4; }
  .set-esc-tip { font-size: 10px; color: #64748b; text-align: center; margin-top: 6px; }
  @media (pointer: coarse) { .set-esc-tip { display: none; } }

  /* ---- 矮屏（横屏手机）：双栏 + 紧凑 ---- */
  @media (max-height: 540px) {
    .set-box { width: min(100%, 760px); border-radius: 12px; }
    .set-head { padding: 10px 16px 6px; }
    .set-t { font-size: 15px; }
    .set-s { display: none; }
    .set-body { padding: 2px 16px 4px; display: grid; grid-template-columns: 1fr 1fr; column-gap: 14px; align-items: start; }
    .set-body.one { display: block; }
    .set-id-chip { margin-bottom: 10px; padding: 6px 10px; }
    .set-group { margin-bottom: 8px; }
    .set-group-title { margin-bottom: 4px; }
    .set-btn { height: 38px; font-size: 11.5px; }
    .set-btn.main-resume { height: 40px; margin-top: 2px; font-size: 14px; }
    .set-foot { padding: 4px 16px 10px; display: grid; grid-template-columns: 1fr 1fr; column-gap: 14px; align-items: center; }
    .set-foot .set-st { margin: 0; text-align: left; }
    .set-warn-box { margin: 2px 0 8px; padding: 8px 12px; font-size: 11px; line-height: 1.5; }
    .set-input { height: 38px; }
    .set-btn.danger.go { margin-top: 8px; }
  }
  /* 极矮（横屏 + 键盘弹出） */
  @media (max-height: 340px) {
    .set-head { padding: 6px 14px 2px; }
    .set-btn { height: 34px; }
    .set-id-chip { padding: 4px 8px; margin-bottom: 6px; }
    .set-group-title { display: none; }
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

  // 跟随可视视口（地址栏收起 / 软键盘弹出 / 旋转）
  function syncVV() {
    const vv = window.visualViewport;
    ov.style.setProperty('--vvh', Math.round(vv ? vv.height : innerHeight) + 'px');
    ov.style.top = (vv ? Math.round(vv.offsetTop) : 0) + 'px';
  }
  syncVV();
  if (window.visualViewport) {
    visualViewport.addEventListener('resize', syncVV);
    visualViewport.addEventListener('scroll', syncVV);
  }
  addEventListener('resize', syncVV);
  addEventListener('orientationchange', () => setTimeout(syncVV, 250));

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
          <button type="button" class="set-close-x" id="btn-set-x">✕ 关闭</button>
        </div>

        <div class="set-body">
          <div class="set-col">
            <div class="set-id-chip">
              <div class="set-id-left">
                <div class="set-id-beacon ${user.isGuest ? 'guest' : ''}"></div>
                <div>
                  <div class="set-id-name">${esc(user.name)}</div>
                  <div class="set-id-mail">${esc(user.email)}</div>
                </div>
              </div>
              <div class="set-id-tag">${user.isGuest ? 'GUEST' : 'VERIFIED'}</div>
            </div>

            <div class="set-group">
              <div class="set-group-title">战术与视觉 // TACTICAL & DISPLAY</div>
              <div class="set-row-2">
                <button type="button" class="set-btn" id="set-hen">
                  <span class="label">⚡ 变身动画</span>
                  <span class="val">${henshinMode() === 'short' ? '精简 2.0s' : '完整原速'}</span>
                </button>
                <button type="button" class="set-btn" id="set-font">
                  <span class="label">🔤 核心字型</span>
                  <span class="val">${esc(curFont.name.split(' ')[0])}</span>
                </button>
                <button type="button" class="set-btn wide" id="set-depth">
                  <span class="label">🎮 战斗视角</span>
                  <span class="val">${DEPTH.on ? '2.5D 纵深' : '经典 2D'}</span>
                </button>
                <button type="button" class="set-btn" id="set-fhit">
                  <span class="label">💥 打击感</span>
                  <span class="val">${typeof FEEL !== 'undefined' ? FEEL.label('hit') : '-'}</span>
                </button>
                <button type="button" class="set-btn" id="set-fcam">
                  <span class="label">🎬 大招运镜</span>
                  <span class="val">${typeof FEEL !== 'undefined' ? FEEL.label('cam') : '-'}</span>
                </button>
                <button type="button" class="set-btn" id="set-fwx">
                  <span class="label">🌦 天气昼夜</span>
                  <span class="val">${typeof FEEL !== 'undefined' ? FEEL.label('wx') : '-'}</span>
                </button>
                <button type="button" class="set-btn" id="set-fbgm">
                  <span class="label">🎵 分层音乐</span>
                  <span class="val">${typeof FEEL !== 'undefined' ? FEEL.label('bgm') : '-'}</span>
                </button>
                <button type="button" class="set-btn wide" id="set-fsafe">
                  <span class="label">🛡 光敏安全（减弱闪光 / 震屏 / 雷电）</span>
                  <span class="val">${typeof FEEL !== 'undefined' ? FEEL.label('safe') : '-'}</span>
                </button>
              </div>
            </div>
          </div>

          <div class="set-col">
            <div class="set-group">
              <div class="set-group-title">云端存储 // CLOUD ARCHIVE</div>
              <button type="button" class="set-btn" id="set-sync">
                <span class="label">☁️ 立即同步至云端档案</span>
                <span class="val ok">备份 SYNC</span>
              </button>
            </div>

            <div class="set-group">
              <div class="set-group-title">安全与授权 // SECURITY & AUTH</div>
              <div class="set-row-2">
                <button type="button" class="set-btn" id="set-logout"><span class="label">🚪 退出登录</span></button>
                <button type="button" class="set-btn danger" id="set-delete"><span class="label">⚠️ 注销账号</span></button>
              </div>
            </div>
          </div>
        </div>

        <div class="set-foot">
          <div class="set-st" id="set-st"></div>
          <div>
            <button type="button" class="set-btn main-resume" id="set-resume">${IS_TOUCH ? '▶ 继 续 游 戏' : '▶ 继 续 游 戏 [ESC]'}</button>
            <div class="set-esc-tip">按 [ESC] 键随时关闭并返回控制</div>
          </div>
        </div>
      `;

      box.querySelector('#btn-set-x').onclick = closeSet;
      box.querySelector('#set-resume').onclick = closeSet;
      box.querySelector('#set-sync').onclick = doSync;

      box.querySelector('#set-hen').onclick = () => {
        const m = henshinMode() === 'short' ? 'full' : 'short';
        henshinSetMode(m);
        if (m === 'short') henshinPreload();
        render('main');
        status(m === 'short' ? '已切入：精简变身（约 2 秒，含爆发判定）' : '已切入：完整原声变身');
      };

      box.querySelector('#set-depth').onclick = () => {
        depthSetOn(!DEPTH.on);
        render('main');
        status(DEPTH.on
          ? (IS_TOUCH ? '已切入：2.5D 纵深（摇杆上下换道，点「跳」跳跃）' : '已切入：2.5D 纵深（W/S 换道，空格跳跃，闪避时按住 W/S 可纵向翻滚）')
          : (IS_TOUCH ? '已切回：经典 2D（摇杆上推跳跃）' : '已切回：经典 2D（W 跳跃）'));
      };

      const feelBtn = (id, key, tip) => {
        const el = box.querySelector(id);
        if (!el) return;
        el.onclick = () => { FEEL.cycle(key); render('main'); status(tip(FEEL.label(key))); };
      };
      if (typeof FEEL !== 'undefined') {
        feelBtn('#set-fhit', 'hit', v => '打击感：' + v + '（命中停顿 / 分级震屏 / 击杀慢动作）');
        feelBtn('#set-fcam', 'cam', v => '大招运镜：' + v);
        feelBtn('#set-fwx', 'wx', v => '天气昼夜：' + v + '（下次进入关卡生效）');
        feelBtn('#set-fbgm', 'bgm', v => '分层音乐：' + v + '（下一场战斗生效；自动 = 没有 BGM 素材时才用合成分层）');
        feelBtn('#set-fsafe', 'safe', v => '光敏安全：' + v);
      }

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
      box.innerHTML = `
        <div class="set-head">
          <div>
            <div class="set-t">⚠ 永久注销终端</div>
            <div class="set-s">DATA PURGE PROTOCOL // IRREVERSIBLE</div>
          </div>
          <button type="button" class="set-close-x" id="btn-cancel-x">✕</button>
        </div>

        <div class="set-body one">
          <div class="set-warn-box">
            此操作将从云端服务器中<b style="color: #ff8a95">永久擦除</b>：<br>
            · 角色等级、装备、天赋与变身胶囊存档<br>
            · 全服战力、无尽塔与世界 BOSS 历史排位<br>
            <span style="color: #ff7675; font-weight: 700;">该抹除操作无法撤销或找回。</span>
          </div>
          <input id="set-type" class="set-input" placeholder="请输入「删除」二字以确认授权" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done">
        </div>

        <div class="set-foot" style="display:block">
          <div class="set-st" id="set-st"></div>
          <div class="set-row-2">
            <button type="button" class="set-btn danger go" id="set-yes" disabled style="margin-top:0">核准抹除并注销</button>
            <button type="button" class="set-btn center" id="set-no" style="margin-top:0">取 消 返 回</button>
          </div>
        </div>
      `;

      const yes = box.querySelector('#set-yes'), inp = box.querySelector('#set-type');
      inp.addEventListener('input', () => { yes.disabled = inp.value.trim() !== '删除'; });
      // 软键盘弹出后把输入框滚进可视区
      inp.addEventListener('focus', () => setTimeout(() => { try { inp.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} }, 320));
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
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
    try { await authSignOut(); } catch (e) {}
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

  function clearInput() {
    try { for (const k in PR) delete PR[k]; for (const k in K) K[k] = 0; } catch (e) {}
  }

  function openSet() {
    clearInput();
    syncVV();
    ov.classList.add('show');
    render('main');
  }

  function closeSet() {
    ov.classList.remove('show');
    try { const a = document.activeElement; if (a && a !== document.body && a.blur) a.blur(); } catch (e) {}
    clearInput();
  }

  // 点击面板外的暗色背景：主页面=关闭；注销确认页=返回（手机上没有 ESC，这是最顺手的退出方式）
  ov.addEventListener('click', e => {
    if (e.target !== ov || busy) return;
    stage === 'confirm' ? render('main') : closeSet();
  });

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

// ===================================================================
// 四、 移动端防误触 / 防"全屏浅蓝色" 引擎
//   浅蓝色 = ① Android 点按高亮 (tap-highlight)  ② 长按/双击触发的整页文字选中
//   这里一次性把两者彻底关掉，并锁定缩放、橡皮筋回弹等手游不需要的浏览器行为
// ===================================================================
(function mobileGuard() {
  const isT = (typeof TOUCH !== 'undefined' && TOUCH) || (window.matchMedia && matchMedia('(pointer:coarse)').matches);

  const st = document.createElement('style');
  st.textContent = `
  html, body { -webkit-tap-highlight-color: transparent; overscroll-behavior: none; touch-action: manipulation; }
  * { -webkit-tap-highlight-color: transparent; }
  canvas { outline: none; }
  body.touch, body.touch * {
    -webkit-user-select: none; user-select: none;
    -webkit-touch-callout: none;
  }
  body.touch ::selection { background: transparent; color: inherit; }
  body.touch input, body.touch textarea, body.touch [contenteditable="true"] {
    -webkit-user-select: text; user-select: text;
  }
  body.touch input::selection, body.touch textarea::selection { background: rgba(0, 229, 255, 0.35); }
  body.touch #c, body.touch #tc, body.touch #tc *, body.touch #joyz, body.touch #joyh, body.touch #joy { touch-action: none; }
  body.touch #tc .b:focus, body.touch #c:focus { outline: none; }
  `;
  document.head.appendChild(st);

  // 视口：禁缩放 + 铺满刘海屏
  let vp = document.querySelector('meta[name="viewport"]');
  if (!vp) { vp = document.createElement('meta'); vp.name = 'viewport'; document.head.appendChild(vp); }
  vp.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
  const addMeta = (n, c) => { if (!document.querySelector(`meta[name="${n}"]`)) { const m = document.createElement('meta'); m.name = n; m.content = c; document.head.appendChild(m); } };
  addMeta('theme-color', '#050b14');
  addMeta('mobile-web-app-capable', 'yes');
  addMeta('apple-mobile-web-app-capable', 'yes');                 // iPhone：「添加到主屏幕」后可真正全屏
  addMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');

  if (!isT) return;

  const elOf = t => (t && t.nodeType === 1) ? t : (t && t.parentElement);
  const isField = t => { const e = elOf(t); return !!(e && e.closest && e.closest('input,textarea,[contenteditable="true"]')); };

  // 禁止任何非输入框区域发起文字选中
  document.addEventListener('selectstart', e => { if (!isField(e.target)) e.preventDefault(); }, true);
  // 兜底：若浏览器仍然选中了内容（浅蓝覆盖层），立刻清掉
  document.addEventListener('selectionchange', () => {
    const s = getSelection && getSelection();
    if (s && !s.isCollapsed && !isField(document.activeElement)) { try { s.removeAllRanges(); } catch (e) {} }
  });
  // iOS 双指缩放手势
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(n => document.addEventListener(n, e => e.preventDefault(), { passive: false }));
  // 长按菜单
  document.addEventListener('contextmenu', e => { if (!isField(e.target)) e.preventDefault(); }, true);
  // 进入/退出全屏、旋转后：释放卡住的按键，重置滚动，让画布重新布局
  const settle = () => {
    try { for (const k in K) K[k] = 0; for (const k in PR) delete PR[k]; } catch (e) {}
    try { const s = getSelection(); s && s.removeAllRanges(); } catch (e) {}
    scrollTo(0, 0);
    setTimeout(() => { scrollTo(0, 0); dispatchEvent(new Event('resize')); }, 220);
  };
  ['fullscreenchange', 'webkitfullscreenchange'].forEach(n => document.addEventListener(n, settle));
  addEventListener('orientationchange', settle);
  // 切到后台再回来：丢失的 pointerup 会让按键卡住
  document.addEventListener('visibilitychange', () => { if (document.hidden) { try { for (const k in K) K[k] = 0; } catch (e) {} } });
})();
