// ===== 登录与 Supabase 认证模块 =====
const SUPABASE_URL = 'https://yoidtdjzxvnfolvvjtdp.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvaWR0ZGp6eHZuZm9sdnZqdGRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NjUzMjgsImV4cCI6MjEwNjQ0MTMyOH0.qxd3sV5DVgK0WLtR4eu6hmVJ64vG4Y4z-Z6wyEa4R2A';

let sbClient = null;
try {
  if (window.supabase) {
    sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) {
  console.error('[Supabase Init Error]', e);
}

let isSignUpMode = false;
let currentAuthUser = null;
let cloudSyncTimer = null; // 防抖上传定时器

const overlay = document.getElementById('auth-overlay');
const emailInput = document.getElementById('auth-email');
const passInput = document.getElementById('auth-password');
const statusText = document.getElementById('auth-status');
const mainActionBtn = document.getElementById('btn-email-action');
const guestActionBtn = document.getElementById('btn-guest-action');
const toggleModeBtn = document.getElementById('btn-toggle-mode');
const closeBtn = document.getElementById('btn-auth-close');

function setAuthStatus(msg, isErr = true) {
  if (!statusText) return;
  statusText.style.color = isErr ? '#ff7675' : '#7dff9a';
  statusText.textContent = msg;
}

function showLoginModal() {
  if (!overlay) return;
  overlay.classList.add('show');
  setAuthStatus('');
  if (emailInput) emailInput.focus();
}

// 登录框里敲字不能漏到游戏：游戏在 window 上监听键盘，
// 邮箱里的 c / n / i 会在标题画面就把背包 / 胶囊 / 战绩切开，空格还会被 preventDefault 吃掉
if (overlay) for (const t of ['keydown', 'keyup', 'keypress']) overlay.addEventListener(t, ev => ev.stopPropagation());

// 进游戏前把残留的按键 / 弹窗状态清干净（保险）
function resetInputState() {
  try { for (const k in PR) delete PR[k]; for (const k in K) K[k] = 0; } catch (e) {}
  if (typeof showChar !== 'undefined') showChar = false;
  if (typeof showCapModal !== 'undefined') showCapModal = false;
  if (typeof showStat !== 'undefined') showStat = false;
}

function hideLoginModal() {
  if (!overlay) return;
  overlay.classList.remove('show');
}

// ---------- 云存档核心接口 ----------

// 1. 从云端拉取存档
async function loadCloudSave(user) {
  if (!sbClient || !user || !user.id || user.id.startsWith('local_guest')) return false;
  try {
    const { data, error } = await sbClient
      .from('player_saves')
      .select('save_data')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.warn('[Cloud Save] 读取云存档出错:', error.message);
      return false;
    }

    if (data && data.save_data && typeof data.save_data === 'object' && Object.keys(data.save_data).length > 0) {
      // 用云端数据全面同步游戏状态
      Object.assign(S, data.save_data);
      if (!Array.isArray(S.caps)) S.caps = [];
      if (!Array.isArray(S.inv)) S.inv = [];
      if (!S.eq || typeof S.eq !== 'object') S.eq = { weapon: null, chest: null, belt: null, legs: null, boots: null, necklace: null, ring: null };
      if (!S.stars || typeof S.stars !== 'object') S.stars = {};
      
      try { localStorage.malaya = JSON.stringify(S); } catch (e) {}
      if (typeof calc === 'function') calc();
      console.log('[Cloud Save] ✅ 成功拉取云端存档！金币:', S.g, '等级:', S.lv);
      return true;
    } else {
      // 云端尚无存档，立即把当前初始数据上传备份
      console.log('[Cloud Save] 云端无存档，建立首份档案…');
      await forceSyncCloudSave();
      return true;
    }
  } catch (e) {
    console.error('[Cloud Save Error]', e);
    return false;
  }
}

// 2. 强制立即向 Supabase 同步当前进度
async function forceSyncCloudSave() {
  if (!sbClient || !currentAuthUser || !currentAuthUser.id || currentAuthUser.id.startsWith('local_guest')) return;
  try {
    const { error } = await sbClient
      .from('player_saves')
      .upsert({
        user_id: currentAuthUser.id,
        save_data: S,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) {
      console.warn('[Cloud Save] 存档上传失败:', error.message);
    } else {
      console.log('[Cloud Save] ☁️ 进度已成功同步至 Supabase！');
      if (typeof lbSubmit === 'function') lbSubmit();   // 顺带更新排行榜（战力没变会自动跳过）
      if (typeof DT !== 'undefined' && Array.isArray(DT) && typeof P !== 'undefined') {
        DT.push({ x: P.x || 300, y: (P.y || 470) - 180, s: '☁️ 进度已备份云端', t: 1.2, c: '#7dff9a' });
      }
    }
  } catch (e) {
    console.error('[Cloud Save Upload Error]', e);
  }
}

// 3. 游戏内防抖上传（每次数据变更 1.2 秒后静默上传）
function queueCloudSync() {
  if (!sbClient || !currentAuthUser || !currentAuthUser.id || currentAuthUser.id.startsWith('local_guest')) return;
  if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => {
    forceSyncCloudSave();
  }, 1200);
}

// 4. 退出/刷新页面前尝试紧急上传
window.addEventListener('beforeunload', () => {
  if (currentAuthUser && !currentAuthUser.id.startsWith('local_guest')) {
    forceSyncCloudSave();
  }
});

// ---------- 认证与登录流程 ----------

async function enterGameWithUser(user, isGuest = false) {
  // 本地存档归属检查：localStorage 是"这个浏览器"的，不属于某个账号。
  // 云端没有存档时，游戏会把本地存档传上去当作新账号的首份档案，
  // 所以换了账号（或删号重注册）后必须先丢掉上一个账号的本地进度。
  // 没有归属标记的老存档视为当前账号的，只打上标记，不清除。
  if (!String(user.id).startsWith('local_guest')) {
    let owner = null;
    try { owner = localStorage.getItem('malaya_owner'); } catch (e) {}
    try { localStorage.setItem('malaya_owner', user.id); } catch (e) {}
    if (owner && owner !== user.id) {
      authToast('检测到切换了账号，正在重置本地存档…');
      wipeLocalAndReload();
      return;
    }
  }
  currentAuthUser = user;
  setAuthStatus('正在读取个人终端档案…', false);

  // 拉取云端数据覆盖当前游戏
  await loadCloudSave(user);

  hideLoginModal();
  resetInputState();

  // 首次进入（注册 / 游客 / 老玩家还没起过名）：先起名再进基地
  if (!S.nick && typeof askNickname === 'function') {
    await askNickname({ title: '为你的骑士命名', force: true });
  }
  resetInputState();
  if (typeof toVil === 'function') toVil();
}

async function handleEmailAuth() {
  if (!sbClient) return setAuthStatus('Supabase 未正确初始化');
  const email = (emailInput.value || '').trim();
  const password = passInput.value || '';

  if (!email || !password) return setAuthStatus('请完整填写邮箱与密码');
  if (password.length < 6) return setAuthStatus('密码至少需要 6 位');

  setAuthStatus('正在验证身份…', false);

  if (isSignUpMode) {
    const { data, error } = await sbClient.auth.signUp({ email, password });
    if (error) return setAuthStatus(error.message);
    if (data.user) {
      setAuthStatus('注册成功！正在连接基地…', false);
      setTimeout(() => enterGameWithUser(data.user, false), 500);
    }
  } else {
    const { data, error } = await sbClient.auth.signInWithPassword({ email, password });
    if (error) return setAuthStatus(error.message);
    if (data.user) {
      setAuthStatus('认证通过！正在连接基地…', false);
      setTimeout(() => enterGameWithUser(data.user, false), 300);
    }
  }
}

async function handleGuestAuth() {
  setAuthStatus('正在分配临时骑士序列…', false);
  if (sbClient) {
    const { data, error } = await sbClient.auth.signInAnonymously();
    if (!error && data && data.user) {
      await enterGameWithUser(data.user, true);
      return;
    }
  }
  // 离线环境本地临时游客
  enterGameWithUser({ id: 'local_guest_' + Date.now() }, true);
}

// ---------- 启动时检测已有登录态（刷新后免输入邮箱）----------
// supabase-js 默认把会话存在 localStorage 并自动续期；这里只需要在标题画面点击时读出来用。
let sessionReady = Promise.resolve();   // 点击时先等它，避免刷新后立刻点击、会话还没读出来
let titleBusy = false;

if (sbClient) {
  sessionReady = (async () => {
    const { data: { session } } = await sbClient.auth.getSession();
    if (!(session && session.user)) return;
    currentAuthUser = session.user;
    console.log('[Supabase] 检测到已存在登录会话:', session.user.email || ('游客 ' + session.user.id));
    // 本地会话还在，但账号可能已在后台被删：向服务器确认一次。
    // 只有服务器明确拒绝(4xx)才清除；断网等网络错误不动，保证离线也能进。
    const { error } = await sbClient.auth.getUser();
    if (error && error.status >= 400 && error.status < 500) {
      console.warn('[Supabase] 会话对应的账号已不存在，已清除本地登录态:', error.message);
      currentAuthUser = null;
      await sbClient.auth.signOut({ scope: 'local' });
    }
  })().catch(e => console.warn('[Supabase] 读取会话失败', e));

  // 在别处退出 / 会话失效时，标题画面不再显示"已登录"
  sbClient.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') currentAuthUser = null; });
}

// 清掉本地存档并刷新页面。
// ui.js 在 beforeunload / visibilitychange 时会把内存里的存档写回 localStorage，
// 只在刷新前 removeItem 会被写回去；pagehide 在它们之后触发，所以在这里最后删一次。
let wipeLocalOnExit = false;
addEventListener('pagehide', () => { if (wipeLocalOnExit) { try { localStorage.removeItem('malaya'); } catch (e) {} } });
function wipeLocalAndReload() {
  wipeLocalOnExit = true;
  currentAuthUser = null;   // 阻止 beforeunload 把当前内存里的（别人的）进度传上云
  location.reload();
}

function authToast(msg) {
  let t = document.getElementById('auth-toast');
  if (!msg) { if (t) t.remove(); return; }
  if (!t) {
    t = document.createElement('div'); t.id = 'auth-toast';
    t.style.cssText = 'position:fixed;left:50%;bottom:14%;transform:translateX(-50%);z-index:99998;padding:10px 20px;border:1px solid #00e5ff;border-radius:10px;background:rgba(6,10,20,.92);color:#7df9ff;font-size:15px;pointer-events:none';
    document.body.appendChild(t);
  }
  t.textContent = msg;
}

// 标题画面入口（点击 / Enter / 空格）：已登录 → 直接进游戏；否则弹登录框
async function titleStart() {
  if (titleBusy) return;
  titleBusy = true;
  try {
    await sessionReady;
    if (currentAuthUser) {
      authToast('欢迎回来，正在读取档案…');
      await enterGameWithUser(currentAuthUser, !!currentAuthUser.is_anonymous);
    } else {
      showLoginModal();
    }
  } catch (e) {
    console.error('[Auth] 自动登录失败，改为手动登录', e);
    currentAuthUser = null;
    showLoginModal();
  } finally {
    authToast('');
    titleBusy = false;
  }
}

// 标题画面提示文字（空字符串 = 未登录）
function authTitleHint() {
  if (!currentAuthUser) return '';
  const who = S.nick || currentAuthUser.email || (currentAuthUser.is_anonymous ? '游客骑士' : '骑士');
  return '已登录：' + who + ' · 点击直接进入';
}

// 切换账号：先把进度传上云，再退出，并清掉本地存档
// （不清的话，下一个账号如果云端是空的，会把上一个账号的本地进度当成自己的）
const AUTH_SW = { x: 780, y: 494, w: 170, h: 36 };
const authSwitchHit = (x, y) => !!currentAuthUser && x >= AUTH_SW.x && x <= AUTH_SW.x + AUTH_SW.w && y >= AUTH_SW.y && y <= AUTH_SW.y + AUTH_SW.h;
async function authSwitchAccount() {
  if (titleBusy) return;
  const guest = !!(currentAuthUser && currentAuthUser.is_anonymous);
  const msg = guest ? '当前是游客账号，退出后这份存档将无法找回。确定要切换账号吗？' : '切换账号？当前进度会先备份到云端。';
  if (!confirm(msg)) return;
  titleBusy = true;
  try {
    authToast('正在备份并退出…');
    await forceSyncCloudSave();
    if (sbClient) await sbClient.auth.signOut();
  } catch (e) {
    console.error('[Auth] 切换账号失败', e);
    authToast('');
    titleBusy = false;
    return;
  }
  wipeLocalAndReload();
}

// 绑定交互事件
if (mainActionBtn) mainActionBtn.addEventListener('click', handleEmailAuth);
if (guestActionBtn) guestActionBtn.addEventListener('click', handleGuestAuth);
if (closeBtn) closeBtn.addEventListener('click', hideLoginModal);

if (toggleModeBtn) {
  toggleModeBtn.addEventListener('click', () => {
    isSignUpMode = !isSignUpMode;
    mainActionBtn.textContent = isSignUpMode ? '注 册 终 端' : '登 录 终 端';
    toggleModeBtn.textContent = isSignUpMode ? '已有账号？点击登录' : '没有账号？点击注册';
    setAuthStatus('');
  });
}