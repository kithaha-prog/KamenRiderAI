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
  currentAuthUser = user;
  setAuthStatus('正在读取个人终端档案…', false);

  // 拉取云端数据覆盖当前游戏
  await loadCloudSave(user);

  hideLoginModal();
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

// 启动时检测已有登录态
if (sbClient) {
  sbClient.auth.getSession().then(({ data: { session } }) => {
    if (session && session.user) {
      currentAuthUser = session.user;
      console.log('[Supabase] 检测到已存在登录会话:', session.user.email || session.user.id);
    }
  });
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