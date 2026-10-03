// ===== 全服世界BOSS =====
// 所有玩家共用同一条血量（每个首领档位各一条）。前提：在 Supabase 的 SQL Editor 里执行一次 supabase_world_boss.sql。
// 流程：开战前 wbFetch 读取全服剩余血量 → 本地首领以「剩余血量」开打 → 战斗结束 wbCommit 把伤害提交给服务器，
//       由服务器扣血、累计伤害榜、判定「最后一击者」（只有服务器确认的击杀者才拿 +50%）。
// 撤退：不消耗次数、不提交伤害。超时 / 战败：结束并结算（消耗次数，伤害照常提交）。
// 注意：和现有排行榜一样，伤害由客户端上报，没有防作弊校验。
const WBG = { s: {}, busy: {}, err: '', miss: false, starting: false };

const wbMaxHp = i => { const z = ST[WB[i].si]; return Math.max(1, Math.round(ET.boss.hp * z.hm * z.hpx)); };   // 与 battle.js spawn 的首领满血一致
const wbBaseHp = i => Math.max(1, Math.round(wbMaxHp(i) / WB_HP_MUL));          // 旧版（未×20）的单场血量：奖励折算的基准
const wbOnline = () => typeof lbCanPost === 'function' && lbCanPost();
const wbPct = g => g && g.max ? g.hp / g.max * 100 : 100;

function wbApply(i, r) {
  if (!r) return null;
  const g = WBG.s[i] = {
    hp: +r.hp, max: +r.max, gen: r.gen | 0, lastKiller: r.last_killer || '', lastGen: r.last_gen | 0,
    top: Array.isArray(r.top) ? r.top : [], me: +r.me || 0, at: Date.now()
  };
  return g;
}

function wbErr(e) {
  const m = (e && (e.message || e.details)) || String(e);
  WBG.miss = /could not find|does not exist|schema cache|function public\.wb_/i.test(m);
  return WBG.miss ? '服务器还没部署世界BOSS（请先执行 supabase_world_boss.sql）' : m;
}

async function wbFetch(i, force) {
  if (!wbOnline()) { WBG.err = '需要登录账号并联网'; return null; }
  const c = WBG.s[i];
  if (!force && c && Date.now() - c.at < 6000) return c;
  if (WBG.busy[i]) return c || null;
  WBG.busy[i] = 1;
  try {
    const { data, error } = await sbClient.rpc('wb_get', { p_idx: i, p_max: wbMaxHp(i) });
    if (error) throw error;
    wbApply(i, data); WBG.err = ''; WBG.miss = false;
  } catch (e) { WBG.err = wbErr(e); }
  finally { WBG.busy[i] = 0; }
  return WBG.s[i] || null;
}

// ---- 讨伐次数：每天 WB_DAILY 次免费 + 钻石购买 ----
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

// ---- 开战（门户按钮 / 结算页「再次挑战」共用）----
async function wbStart(i) {
  const w = WB[i];
  if (WBG.starting) return;
  const say2 = s => { if (G === 'play') return; if (WB_RES && (G === 'win' || G === 'over')) WB_RES.msg = s; else pToast(s); };
  if (!wbOpen(w)) return say2('需要 Lv.' + w.lv + ' 才能挑战该首领');
  if (!wbOnline()) return say2('世界BOSS 是全服共用的，需要登录账号并联网');
  if (wbLeft() <= 0) return say2('今日讨伐次数已用完，可花 ' + WB_BUY_COST + ' 钻购买');
  WBG.starting = true;
  const g0 = G;
  const s = await wbFetch(i, true);
  WBG.starting = false;
  if (G !== g0) return;                       // 等待服务器期间玩家已离开
  if (!s) return say2('连接服务器失败：' + (WBG.err || '未知错误'));
  const D = wbData(); D.used++; save();       // 次数在开战时扣；撤退会在 fin 里退还
  WB_LOC = Math.max(1, s.hp);
  PO.ret = 'wb'; M = 0;
  begin(w.si);
}

// 结算页「再次挑战」：没次数时第一次按只是提示，第二次按才扣钻石
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

// ---- 战斗结束：把伤害交给服务器 ----
async function wbCommit(i, dmg, R) {
  try {
    const { data, error } = await sbClient.rpc('wb_hit', { p_idx: i, p_max: wbMaxHp(i), p_dmg: Math.round(dmg), p_nick: lbNick() });
    if (error) throw error;
    wbApply(i, data);
    R.rem = +data.hp; R.top = (data.killed && data.final_top) ? data.final_top : (data.top || []);
    if (data.killed) {
      const z = WB[i], bg = Math.round(z.g * WB_KILL_BONUS), bd = Math.round((WB_DIAM[i] || 30) * WB_KILL_BONUS);
      S.g += bg; psGold(bg); S.d += bd; psDia(bd);
      R.gold += bg; R.diam += bd; R.isKill = true; R.rank = 'S';
      const W = wbData(); W.kills[i] = (W.kills[i] || 0) + 1;
      save();
    }
  } catch (e) { R.err = wbErr(e); }
  R.pending = false;
}
