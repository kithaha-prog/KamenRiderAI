// ===== 登录与 Supabase 认证模块 =====
const SUPABASE_URL = 'https://yoidtdjzxvnfolvvjtdp.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvaWR0ZGp6eHZuZm9sdnZqdGRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NjUzMjgsImV4cCI6MjEwNjQ0MTMyOH0.qxd3sV5DVgK0WLtR4eu6hmVJ64vG4Y4z-Z6wyEa4R2A';

let sbClient = null;
try {
  if (window.supabase) {
    sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: { params: { eventsPerSecond: 40 } }   // 联机广播的每秒消息数上限（默认 10，联机战斗不够用）
    });
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
  if (typeof showQuest !== 'undefined') showQuest = false;
}

function hideLoginModal() {
  if (!overlay) return;
  overlay.classList.remove('show');
}

// ---------- 云存档核心接口（带版本号的冲突检测）----------
// 数据库表 player_saves 需要有 rev 列（只需在 Supabase SQL Editor 执行一次）：
//   alter table player_saves add column if not exists rev integer not null default 0;
//
// 规则：
//   · cloudRev = 本机上次与云端对齐时的版本号。null 表示还没成功读过云端 → 一律不上传，
//     这样断网 / 读取失败时，本机的旧档不会把云端的新档覆盖掉。
//   · 上传时必须带上 cloudRev：只有云端版本号没变才写入成功（并 +1）。
//     如果别的设备已经改过云端，写入会被拒绝 → 进入 resolveCloudConflict() 让玩家 / 程序决定用哪份。
let cloudRev = null;
let cloudSyncing = false;     // 正在上传，避免重叠
let cloudResolving = false;   // 正在处理冲突，避免重复弹窗

const isCloudUser = u => !!(u && u.id && !String(u.id).startsWith('local_guest'));

// 进度比较：先比等级，再比经验。>0 表示 a 比 b 进度更高
const progCmp = (a, b) => ((a.lv | 0) - (b.lv | 0)) || ((a.xp | 0) - (b.xp | 0));

// 1. 从云端拉取存档
async function loadCloudSave(user, retried) {
  if (!sbClient || !isCloudUser(user)) return false;
  try {
    const { data, error } = await sbClient
      .from('player_saves')
      .select('save_data,rev')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.warn('[Cloud Save] 读取云存档出错:', error.message);
      return false;   // cloudRev 保持 null → 本次不会上传，避免旧档覆盖云端
    }

    if (data && data.save_data && typeof data.save_data === 'object' && Object.keys(data.save_data).length > 0) {
      // 用云端数据全面同步游戏状态
      Object.assign(S, data.save_data);
      if (!Array.isArray(S.caps)) S.caps = [];
      if (!Array.isArray(S.inv)) S.inv = [];
      if (!S.eq || typeof S.eq !== 'object') S.eq = { weapon: null, chest: null, belt: null, legs: null, boots: null, necklace: null, ring: null };
      if (!S.stars || typeof S.stars !== 'object') S.stars = {};
      if (!S.cs || typeof S.cs !== 'object') S.cs = {};          // 胶囊星级
      if (typeof S.csh !== 'number') S.csh = 0;                  // 契约碎片
      if (!S.tw || typeof S.tw !== 'object') S.tw = { best: 0 }; // 无尽塔进度

      if (typeof migrateEquip === 'function') migrateEquip();   // 云端旧装备同样要按新倍率迁移
      cloudRev = data.rev | 0;
      try { localStorage.malaya = JSON.stringify(S); } catch (e) {}
      if (typeof calc === 'function') calc();
      console.log('[Cloud Save] ✅ 成功拉取云端存档！金币:', S.g, '等级:', S.lv, '版本:', cloudRev);
      return true;
    }

    // 云端尚无存档：把当前初始数据建成首份档案
    console.log('[Cloud Save] 云端无存档，建立首份档案…');
    const now = new Date().toISOString();
    let err2;
    if (data) {
      // 行已存在但内容为空：按版本号更新
      ({ error: err2 } = await sbClient.from('player_saves')
        .update({ save_data: S, rev: (data.rev | 0) + 1, updated_at: now })
        .eq('user_id', user.id).eq('rev', data.rev | 0));
      if (!err2) cloudRev = (data.rev | 0) + 1;
    } else {
      // 用 insert 而不是 upsert：两台设备同时首次建档时，后到的不会把先到的覆盖掉
      ({ error: err2 } = await sbClient.from('player_saves')
        .insert({ user_id: user.id, save_data: S, rev: 0, updated_at: now }));
      if (!err2) cloudRev = 0;
      else if (err2.code === '23505' && !retried) return loadCloudSave(user, true);   // 别的设备刚建好 → 重新读取
    }
    if (err2) { console.warn('[Cloud Save] 建档失败:', err2.message); return false; }
    return true;
  } catch (e) {
    console.error('[Cloud Save Error]', e);
    return false;
  }
}

// 2. 强制立即向 Supabase 同步当前进度（返回 true = 已成功写入云端）
async function forceSyncCloudSave() {
  if (!sbClient || !isCloudUser(currentAuthUser)) return false;
  if (window.__noSave) return false;                       // 注销 / 切换账号 / 载入云档重启中：不再上传
  if (cloudRev === null || cloudSyncing || cloudResolving) return false;

  cloudSyncing = true;
  let ok = false, conflict = false;
  try {
    const next = cloudRev + 1;
    const { data, error } = await sbClient
      .from('player_saves')
      .update({ save_data: S, rev: next, updated_at: new Date().toISOString() })
      .eq('user_id', currentAuthUser.id)
      .eq('rev', cloudRev)          // ★ 只有云端版本没变才允许写入
      .select('rev');

    if (error) {
      console.warn('[Cloud Save] 存档上传失败:', error.message);
    } else if (!data || !data.length) {
      conflict = true;              // 0 行被更新 = 别的设备已经改过云端
    } else {
      cloudRev = next;
      ok = true;
      console.log('[Cloud Save] ☁️ 进度已成功同步至 Supabase！版本:', cloudRev);
      if (typeof lbSubmit === 'function') lbSubmit();   // 顺带更新排行榜（战力没变会自动跳过）
      if (typeof cloudHintShow === 'function') cloudHintShow();   // 右下角灰色半透明“已备份”
    }
  } catch (e) {
    console.error('[Cloud Save Upload Error]', e);
  } finally {
    cloudSyncing = false;
  }
  if (conflict) await resolveCloudConflict();
  return ok;
}

// 载入云端存档并重启页面（用于冲突时采用云端进度）
function reloadWithCloud(cloudData) {
  window.__noSave = true;           // 阻止 ui.js 在刷新前把内存里的旧档写回 localStorage、也阻止再上传
  if (cloudSyncTimer) { clearTimeout(cloudSyncTimer); cloudSyncTimer = null; }
  try { localStorage.malaya = JSON.stringify(cloudData); } catch (e) {}
  location.reload();
}

// 冲突处理：云端存档已被其他设备更新
async function resolveCloudConflict() {
  if (cloudResolving || !sbClient || !isCloudUser(currentAuthUser)) return;
  cloudResolving = true;
  try {
    const { data, error } = await sbClient
      .from('player_saves')
      .select('save_data,rev')
      .eq('user_id', currentAuthUser.id)
      .maybeSingle();
    if (error || !data || !data.save_data) { cloudResolving = false; return; }

    const cloud = data.save_data, c = progCmp(cloud, S);
    const info = '云端：Lv.' + (cloud.lv | 0) + '　本机：Lv.' + (S.lv | 0);

    if (c > 0) {
      // 云端进度更高 → 采用云端（不会让旧设备覆盖新进度）
      alert('检测到其他设备上有更新的存档（' + info + '）。\n将载入云端存档。');
      reloadWithCloud(cloud);
      return;   // 页面即将刷新，cloudResolving 保持 true
    }
    // 本机进度更高或相同 → 让玩家选
    if (confirm('云端存档已被其他设备更新（' + info + '）。\n\n确定 = 用本机进度覆盖云端\n取消 = 载入云端存档')) {
      cloudRev = data.rev | 0;      // 对齐到云端当前版本，再传一次
      cloudResolving = false;
      await forceSyncCloudSave();
    } else {
      reloadWithCloud(cloud);
    }
  } catch (e) {
    console.error('[Cloud Save Conflict Error]', e);
    cloudResolving = false;
  }
}

// 3. 游戏内防抖上传（每次数据变更 1.2 秒后静默上传）
function queueCloudSync() {
  if (!sbClient || !isCloudUser(currentAuthUser) || window.__noSave) return;
  if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => {
    forceSyncCloudSave();
  }, 1200);
}

// 4. 退出/刷新页面前尝试紧急上传
window.addEventListener('beforeunload', () => {
  if (isCloudUser(currentAuthUser)) {
    forceSyncCloudSave();
  }
});

// 5. 切回这个标签页 / App 时，主动检查云端有没有被别的设备更新（战斗中不打断）
document.addEventListener('visibilitychange', async () => {
  if (document.hidden || window.__noSave) return;
  if (cloudRev === null || cloudSyncing || cloudResolving) return;
  if (!sbClient || !isCloudUser(currentAuthUser)) return;
  if (typeof G !== 'undefined' && G === 'play') return;
  try {
    const { data } = await sbClient.from('player_saves').select('rev').eq('user_id', currentAuthUser.id).maybeSingle();
    if (data && (data.rev | 0) > cloudRev) await resolveCloudConflict();
  } catch (e) {}
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
  cloudRev = null;   // 换账号 / 重新进入：必须重新读取云端后才允许上传
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
let wipeAllOnExit = false;
addEventListener('pagehide', () => {
  if (wipeAllOnExit) { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} }
  else if (wipeLocalOnExit) { try { localStorage.removeItem('malaya'); } catch (e) {} }
});
function wipeLocalAndReload() {
  wipeLocalOnExit = true;
  currentAuthUser = null;   // 阻止 beforeunload 把当前内存里的（别人的）进度传上云
  location.reload();
}

// 彻底注销账号：删除云端存档 + 排行榜记录 + Supabase 里的登录账号（邮箱），再清空本机所有数据。不可恢复。
// 云端删除靠数据库里的 delete_my_account() 函数（SQL 见 supabase_delete_account.sql，需要在 Supabase 里执行一次）。
// 云端删除失败时直接返回错误、什么都不清，免得「本机清了、云端还在」。
async function authDeleteAccount() {
  if (titleBusy) return { ok: false, msg: '请稍候再试' };
  titleBusy = true;
  const u = currentAuthUser;
  const local = !u || String(u.id).startsWith('local_guest');
  try {
    if (!local) {
      if (!sbClient) throw new Error('未连接到云端，无法注销');
      if (cloudSyncTimer) { clearTimeout(cloudSyncTimer); cloudSyncTimer = null; }   // 取消排队中的备份，免得删完又传上去
      const { error } = await sbClient.rpc('delete_my_account');
      if (error) {
        const miss = /delete_my_account|function|schema cache|404/i.test(error.message || '') || error.code === 'PGRST202';
        throw new Error(miss ? '云端还没有注销功能：请先在 Supabase 的 SQL Editor 里执行 supabase_delete_account.sql' : (error.message || '云端删除失败'));
      }
      try { await sbClient.auth.signOut({ scope: 'local' }); } catch (e) {}
    }
  } catch (e) {
    titleBusy = false;
    return { ok: false, msg: e.message || String(e) };
  }
  window.__noSave = true;        // 从这一刻起 save() / 退出前的自动写入全部停止
  currentAuthUser = null;
  wipeAllOnExit = true;          // 页面关闭时再清一次（防止被退出事件写回）
  try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
  location.reload();
  return { ok: true };
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
  return authSignOut();
}
// 真正执行：备份 → 退出登录 → 清本地存档 → 刷新。调用前必须已经让玩家确认过。
async function authSignOut() {
  if (titleBusy) return;
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