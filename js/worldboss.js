// ===== 全服世界BOSS（支持全服云端同步 + 本地离线存储双轨机制） =====
const WBG = { s: {}, busy: {}, err: '', miss: false, starting: false };

const wbMaxHp = i => { const z = ST[WB[i].si]; return Math.max(1, Math.round(ET.boss.hp * z.hm * z.hpx)); }; // 真实全额总血量 (124.8万)
const wbBaseHp = i => Math.max(1, Math.round(wbMaxHp(i) / WB_HP_MUL)); // 单场通关奖励基准线
const wbOnline = () => typeof lbCanPost === 'function' && lbCanPost();
const wbPct = g => g && g.max ? g.hp / g.max * 100 : 100;

// 获取本地存档中的首领血量状态
function wbLocalHp(i) {
  const W = wbData();
  if (!W.hp) W.hp = {};
  const max = wbMaxHp(i);
  if (typeof W.hp[i] !== 'number' || W.hp[i] <= 0) W.hp[i] = max;
  return W.hp[i];
}

function wbApply(i, r) {
  if (!r) return null;
  const g = WBG.s[i] = {
    hp: +r.hp, max: +r.max, gen: r.gen | 0, lastKiller: r.last_killer || '', lastGen: r.last_gen | 0,
    top: Array.isArray(r.top) ? r.top : [], me: +r.me || 0, at: Date.now()
  };
  // 同步更新本地存档
  const W = wbData();
  if (!W.hp) W.hp = {};
  W.hp[i] = g.hp;
  return g;
}

function wbErr(e) {
  const m = (e && (e.message || e.details)) || String(e);
  WBG.miss = /could not find|does not exist|schema cache|function public\.wb_/i.test(m);
  return WBG.miss ? '服务器未配置（已自动转入本地单机模式）' : m;
}

// 读取首领血量（优先读取云端，失败自动退回本地存储）
async function wbFetch(i, force) {
  const max = wbMaxHp(i);
  const localHp = wbLocalHp(i);

  // 若未登录或离线，直接使用本地保底数据
  if (!wbOnline()) {
    WBG.s[i] = { hp: localHp, max, gen: 1, lastKiller: S.nick || '', top: [], me: 0, at: Date.now() };
    return WBG.s[i];
  }

  const c = WBG.s[i];
  if (!force && c && Date.now() - c.at < 6000) return c;
  if (WBG.busy[i]) return c || null;
  WBG.busy[i] = 1;

  try {
    const { data, error } = await sbClient.rpc('wb_get', { p_idx: i, p_max: max });
    if (error) throw error;
    wbApply(i, data); 
    WBG.err = ''; 
    WBG.miss = false;
  } catch (e) { 
    WBG.err = wbErr(e);
    // 云端失败时，无缝降级为本地持久化数据
    WBG.s[i] = { hp: localHp, max, gen: 1, lastKiller: S.nick || '', top: [], me: 0, at: Date.now() };
  } finally { 
    WBG.busy[i] = 0; 
  }
  return WBG.s[i];
}

// 讨伐次数相关
function wbBuy() {
  if ((S.d | 0) < WB_BUY_COST) return false;
  S.d -= WB_BUY_COST; wbData().buy = (wbData().buy | 0) + 1; save();
  return true;
}
function wbBuyClick() {
  if ((PO.wbAsk || 0) > T) {
    PO.wbAsk = 0;
    if (wbBuy()) pToast('已购买 1 次讨伐机会（-' + WB_BUY_COST + ' 钻石）');
    else pToast('钻石不足（需要 ' + WB_BUY_COST + '）');
  } else { PO.wbAsk = T + 3; pToast('再点一次确认：花费 ' + WB_BUY_COST + ' 钻石购买 1 次'); }
}

// 开战
async function wbStart(i) {
  const w = WB[i];
  if (WBG.starting) return;
  const say2 = s => { if (G === 'play') return; if (WB_RES && (G === 'win' || G === 'over')) WB_RES.msg = s; else pToast(s); };
  if (!wbOpen(w)) return say2('需要 Lv.' + w.lv + ' 才能挑战该首领');
  if (wbLeft() <= 0) return say2('今日讨伐次数已用完，可花 ' + WB_BUY_COST + ' 钻购买');
  
  WBG.starting = true;
  const g0 = G;
  const s = await wbFetch(i, true);
  WBG.starting = false;
  if (G !== g0) return;

  const D = wbData(); D.used++; save();
  // 以当前首领剩余血量开打
  WB_LOC = s ? Math.max(1, s.hp) : wbLocalHp(i);
  PO.ret = 'wb'; M = 0;
  begin(w.si);
}

function wbRetry() {
  if (!WB_RES || WB_RES.pending) return;
  const i = WB.findIndex(b => b.si === cur);
  if (wbLeft() <= 0) {
    if (!WB_RES.ask) { WB_RES.ask = 1; WB_RES.msg = '再按一次确认：花费 ' + WB_BUY_COST + ' 钻石购买 1 次讨伐'; return; }
    if (!wbBuy()) { WB_RES.msg = '钻石不足（需要 ' + WB_BUY_COST + '）'; return; }
    WB_RES.ask = 0;
  }
  wbStart(i);
}

// 战斗结束：提交伤害并持久化扣除血量
async function wbCommit(i, dmg, R) {
  const max = wbMaxHp(i);
  const curLocal = wbLocalHp(i);
  const newHp = Math.max(0, curLocal - dmg);
  const localKilled = newHp <= 0;

  // 1. 本地存储立即扣除血量并保存
  const W = wbData();
  if (!W.hp) W.hp = {};
  if (localKilled) {
    W.hp[i] = max; // 首领被击杀，下一次生成全新满血首领
    W.kills[i] = (W.kills[i] || 0) + 1;
  } else {
    W.hp[i] = newHp;
  }
  save();

  // 2. 尝试向云端 RPC 提交同步
  if (wbOnline()) {
    try {
      const { data, error } = await sbClient.rpc('wb_hit', { p_idx: i, p_max: max, p_dmg: Math.round(dmg), p_nick: lbNick() });
      if (error) throw error;
      wbApply(i, data);
      R.rem = +data.hp; 
      R.top = (data.killed && data.final_top) ? data.final_top : (data.top || []);
      if (data.killed) {
        const z = WB[i], bg = Math.round(z.g * WB_KILL_BONUS), bd = Math.round((WB_DIAM[i] || 30) * WB_KILL_BONUS);
        S.g += bg; psGold(bg); S.d += bd; psDia(bd);
        R.gold += bg; R.diam += bd; R.isKill = true; R.rank = 'S';
        save();
      }
    } catch (e) { 
      R.err = wbErr(e); 
      // 云端未响应时，采用本地扣血结果呈现
      R.rem = newHp;
      if (localKilled) {
        const z = WB[i], bg = Math.round(z.g * WB_KILL_BONUS), bd = Math.round((WB_DIAM[i] || 30) * WB_KILL_BONUS);
        S.g += bg; psGold(bg); S.d += bd; psDia(bd);
        R.gold += bg; R.diam += bd; R.isKill = true; R.rank = 'S';
        save();
      }
    }
  } else {
    // 离线/单机模式直接由本地结算
    R.rem = newHp;
    if (localKilled) {
      const z = WB[i], bg = Math.round(z.g * WB_KILL_BONUS), bd = Math.round((WB_DIAM[i] || 30) * WB_KILL_BONUS);
      S.g += bg; psGold(bg); S.d += bd; psDia(bd);
      R.gold += bg; R.diam += bd; R.isKill = true; R.rank = 'S';
      save();
    }
  }

  R.pending = false;
}