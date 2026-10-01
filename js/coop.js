// ===== 双人联机核心模块 (Co-op Dungeon Engine) =====
// 基于 Supabase Realtime Broadcast，房主(1P)权威 + 客机(2P)上报。
//
// 同步内容：
//   · 玩家：位置 / 动作状态 / 动画时钟 / 形态 / 倒地与救援进度   (p_sync，约 18 次/秒，状态切换时立即发)
//   · 弹道/战车：新增即广播，对方只做展示（fx_pj / fx_bike）
//   · 怪物：房主权威位置与血量（host_monsters_sync），客机伤害上报给房主结算（guest_hurt_m / m_hurt_ack）
//   · 胜负：房主裁决并广播（game_end）
//   · 结算：再次挑战 / 下一关需要双方投票一致（vote）

const COOP_REVIVE_TIME = 10;     // 救援所需持续时间（秒）
const COOP_REVIVE_RANGE = 130;   // 救援有效距离（px）
const COOP_TIMEOUT = 15000;      // 队友多久没有任何消息视为掉线（ms）

// 渲染队友时需要临时借用的 P 字段
const COOP_P2_KEYS = ['x', 'y', 'f', 'st', 't', 'inv', 'land', 'vx', 'vy', 'ryuki', 'k5', 'bl', 'trk', 'spr', 'tdur', 'h'];

function coopNewP2() {
  return {
    x: 300, y: 470, vx: 0, vy: 0, f: 1, st: 'trans', t: 0,
    hp: 100, mh: 100, ryuki: false, k5: false, bl: false, trk: null,
    spr: false, tdur: 0, h: 0, inv: 0,
    down: false, rv: 0, gone: false, kb: false, init: false,
    targetX: 300, targetY: 470
  };
}

const COOP = {
  active: false,        // 是否在联机房间/战斗中
  inGame: false,        // 是否已进入战斗关卡（直到离开联机为止保持 true，含结算界面）
  isHost: false,        // 是否为房主 (1P)
  roomCode: '',
  channel: null,
  stageIdx: 0,
  myReady: false,
  peerReady: false,
  peerConnected: false,

  lastSyncT: 0, monT: 0, lastSt: '', lastDown: false, lastRecv: 0,
  rescueT: 0,           // 我正在救队友的累计进度（秒）
  channeling: false,    // 我此刻是否正在读条救人（锁定移动与出招）
  escT: 0,              // 撤退二次确认计时
  vote: { me: null, peer: null },   // 结算投票：'retry' | 'next' | null
  note: null,           // 屏幕提示 {s, until}

  P2: coopNewP2()       // 队友数据镜像
};

// ---------- 0. 状态查询小工具 ----------
const coopIsGuest = () => COOP.active && COOP.inGame && !COOP.isHost;
const coopBattleOn = () => COOP.active && COOP.inGame && COOP.peerConnected && !COOP.P2.gone;
const coopSettleActive = () => COOP.active && COOP.inGame && COOP.peerConnected && !!(ST[cur] && ST[cur].coop);
const coopCanRescue = () => coopBattleOn() && G === 'play' && !P.down && COOP.P2.down && Math.abs(P.x - COOP.P2.x) < COOP_REVIVE_RANGE;

function coopNotice(s) {
  if ((G === 'vil' || G === 'room') && typeof pToast === 'function') pToast(s);
  else COOP.note = { s, until: performance.now() + 3200 };
}

// 战斗开始（begin）时重置联机战斗状态
function coopResetBattle() {
  COOP.vote = { me: null, peer: null };
  COOP.rescueT = 0; COOP.channeling = false; COOP.escT = 0;
  COOP.lastSt = ''; COOP.lastDown = false; COOP.lastSyncT = 0; COOP.monT = 0;
  COOP.lastRecv = performance.now();
  const keepHp = COOP.P2.mh || 100;
  COOP.P2 = coopNewP2();
  COOP.P2.mh = keepHp; COOP.P2.hp = keepHp;
}

// 撤退二次确认（联机撤退会解散房间，防误触）
function coopEscGuard() {
  if (!(COOP.active && COOP.inGame)) return true;
  if (COOP.escT > 0) return true;
  COOP.escT = 1.5;
  DT.push({ x: P.x, y: P.y - 200, s: '再按一次 Esc 撤退（将解散联机房间）', t: 1.5, c: '#ffd84a' });
  return false;
}

// ---------- 1. 房间创建与加入 ----------

async function coopCreateRoom(stageIdx = 0) {
  if (!sbClient) return alert('Supabase 未初始化');
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  COOP.roomCode = code;
  COOP.isHost = true;
  COOP.stageIdx = stageIdx;
  COOP.myReady = true;
  COOP.peerReady = false;
  COOP.peerConnected = false;
  COOP.active = true;
  COOP.inGame = false;
  COOP.vote = { me: null, peer: null };
  COOP.P2 = coopNewP2();

  await coopJoinChannel(code);
  return code;
}

async function coopJoinRoom(code) {
  if (!sbClient) return alert('Supabase 未初始化');
  code = String(code).trim();
  COOP.roomCode = code;
  COOP.isHost = false;
  COOP.myReady = false;
  COOP.peerReady = false;
  COOP.peerConnected = false;
  COOP.active = true;
  COOP.inGame = false;
  COOP.vote = { me: null, peer: null };
  COOP.P2 = coopNewP2();

  await coopJoinChannel(code);
  setTimeout(() => {
    coopSend('peer_join', { uid: S.userId || 'guest' });
  }, 500);
}

// 退出/解散房间
function coopLeaveRoom() {
  if (COOP.channel) {
    const ch = COOP.channel;
    coopSend('room_close', {});
    COOP.channel = null;
    // 延迟移除，保证 room_close 先发出去
    setTimeout(() => { try { sbClient.removeChannel(ch); } catch (e) { } }, 250);
  }
  COOP.active = false;
  COOP.inGame = false;
  COOP.roomCode = '';
  COOP.peerConnected = false;
  COOP.channeling = false;
  COOP.rescueT = 0;
  COOP.vote = { me: null, peer: null };
  COOP.P2 = coopNewP2();
  P.down = false;
}

// ---------- 2. 频道连接与网络消息监听 ----------

async function coopJoinChannel(code) {
  if (COOP.channel) sbClient.removeChannel(COOP.channel);

  COOP.channel = sbClient.channel(`coop_room_${code}`, {
    config: { broadcast: { ack: false, self: false } }
  });

  COOP.channel
    .on('broadcast', { event: 'coop_msg' }, ({ payload }) => {
      coopHandleMessage(payload);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[Co-op] 成功接入联机频道: room_${code}`);
      }
    });
}

function coopSend(type, data) {
  if (!COOP.channel) return;
  COOP.channel.send({
    type: 'broadcast',
    event: 'coop_msg',
    payload: { type, data, fromHost: COOP.isHost }
  });
}

// 只打包数值/布尔/字符串字段（弹道、战车等实体的通用序列化）
function coopPack(o) {
  const r = {};
  for (const k in o) {
    const v = o[k];
    if (typeof v === 'number') r[k] = Math.round(v * 100) / 100;
    else if (typeof v === 'boolean' || typeof v === 'string') r[k] = v;
  }
  return r;
}

// 房主出征（首次出征 / 结算后投票通过）
function coopStartStage(idx) {
  COOP.vote = { me: null, peer: null };
  COOP.stageIdx = idx;
  COOP.inGame = true;
  M = 0;
  coopSend('stage_start', { stageIdx: idx });
  begin(idx);
}

// 结算投票：再按一次同一选项=取消
function coopVote(choice) {
  if (!coopSettleActive() || (G !== 'win' && G !== 'over')) return;
  COOP.vote.me = COOP.vote.me === choice ? null : choice;
  coopSend('vote', { choice: COOP.vote.me });
  coopCheckVotes();
}

// 只有房主负责判定：双方选择一致才真正开始
function coopCheckVotes() {
  if (!COOP.isHost) return;
  const v = COOP.vote;
  if (!v.me || v.me !== v.peer) return;
  const idx = v.me === 'next' ? nextStageIdx() : cur;
  if (idx < 0) return;
  coopStartStage(idx);
}

// 倒地（濒死）
function coopOnDown() {
  P.down = true;
  P.hp = 0;
  P.st = 'idle';
  P.vx = 0; P.t = 0; P.h = 0; P.hit = {};
  P.inv = 0;
  if (typeof stopAllRyukiFVSounds === 'function') stopAllRyukiFVSounds();
  shake = 14;
  DT.push({ x: P.x, y: P.y - 200, s: '濒死！等待队友救援', t: 1.8, c: '#ff4757' });
}

// 房主端：客机击杀怪物后，客机也要拿到经验与掉落
function coopGuestKill(e) {
  gain(ET[e.t].xp * .6 * (1 + Math.min(cur, 29) * .3));
  if (Math.random() < .35) OR.push({ x: e.x, k: Math.random() < .5 ? 'h' : 'm' });
  dropLoot(e);
}

// 消息分发处理器
function coopHandleMessage({ type, data, fromHost }) {
  if (!COOP.active) return;
  COOP.lastRecv = performance.now();
  if (COOP.P2.gone) COOP.P2.gone = false;

  // 1. 房间与准备流程
  if (type === 'peer_join') {
    COOP.peerConnected = true;
    if (COOP.isHost) {
      coopSend('room_sync', { stageIdx: COOP.stageIdx, hostReady: COOP.myReady });
    }
  } else if (type === 'room_sync') {
    COOP.peerConnected = true;
    COOP.stageIdx = data.stageIdx;
    COOP.peerReady = data.hostReady;
  } else if (type === 'ready_change') {
    COOP.peerReady = data.ready;
  } else if (type === 'stage_start') {
    COOP.stageIdx = data.stageIdx;
    COOP.inGame = true;
    M = 0;
    begin(COOP.stageIdx);
  } else if (type === 'room_close') {
    const was = (G === 'play' || G === 'win' || G === 'over');
    coopLeaveRoom();
    if (was) toVil('st');
    coopNotice('队友已退出，联机房间已解散');
  }

  // 2. 队友状态（位置 + 动作 + 形态 + 倒地）
  else if (type === 'p_sync') {
    COOP.peerConnected = true;
    const { x, y, ...rest } = data;
    const p2 = COOP.P2;
    Object.assign(p2, rest);
    p2.targetX = x; p2.targetY = y;
    if (!p2.init || Math.abs(x - p2.x) > 500) { p2.x = x; p2.y = y; p2.init = true; }
  }

  // 3. 队友弹道 / 战车（仅展示，不产生伤害）
  else if (type === 'fx_pj') {
    if (G === 'play') PJ.push(Object.assign({}, data, { h: {}, vis: 1, cs: 1 }));
  } else if (type === 'fx_bike') {
    if (G === 'play') BIKES.push(Object.assign({}, data, { hit: {}, vis: 1, cs: 1 }));
  }

  // 4. 怪物强同步
  else if (type === 'guest_hurt_m') {
    // 【房主】客机上报命中：用客机算好的伤害/暴击权威结算
    if (COOP.isHost && G === 'play') {
      const e = E.find(m => m.id === data.id && !m.dead);
      if (e) hurt(e, data.dmg, { c: data.c, f: data.f });
    }
  } else if (type === 'm_hurt_ack') {
    // 【客机】房主通知血量变化
    if (COOP.isHost) return;
    const e = E.find(m => m.id === data.id);
    if (e) {
      e.hp = data.hp;
      e.fl = .12;
      if (!data.g) {   // 客机自己打出的伤害数字已在本地即时显示，避免重复
        DT.push({ x: e.x, y: e.y - e.h, s: Math.round(data.dmg) + (data.c ? '!' : ''), t: .8, c: data.c ? '#ff8a2a' : '#ffd84a' });
      }
      if (data.dead && !e.dead) {
        e.dead = 1;
        FX.push({ type: 'boss_death_blast', x: e.x, y: e.y - e.h / 2, t: .6, d: .6, r: e.t === 'boss' ? 220 : 70 });
        coopGuestKill(e);
      }
    }
  } else if (type === 'host_monsters_sync') {
    if (COOP.isHost || G !== 'play') return;
    kills = data.kills;
    RG = data.RG;
    if (data.bs) bs = 1;
    const alive = new Set();
    for (const m of data.monsters) {
      alive.add(m.id);
      let le = E.find(e => e.id === m.id);
      if (!le) {
        spawn(m.t, m.x, m.vi);
        le = E[E.length - 1];
        if (!le) continue;
        le.id = m.id; le.x = m.x; le.y = m.y;
      }
      le.tx = m.x; le.ty = m.y;
      le.hp = m.hp; le.mhp = m.mhp;
    }
    E = E.filter(e => alive.has(e.id));   // 房主列表为准，清理幽灵怪
  }

  // 5. 救援 / 胜负 / 投票
  else if (type === 'revive_done') {
    if (P.down) {
      P.down = false;
      P.hp = Math.max(1, Math.round(P.mh * .5));
      P.inv = 2.5;
      P.st = 'idle';
      COOP.P2.rv = 0;
      shake = 8;
      DT.push({ x: P.x, y: P.y - 200, s: '被队友救起！', t: 1.6, c: '#7dff9a' });
    }
  } else if (type === 'game_end') {
    if (!COOP.isHost && G === 'play') {
      kills = data.kills; RG = data.RG;
      fin(data.win ? 1 : 0);
    }
  } else if (type === 'vote') {
    COOP.vote.peer = data.choice || null;
    coopCheckVotes();
  }
}

// ---------- 3. 战斗中帧循环高频同步 ----------

function coopUpdateBattle(dt) {
  if (!COOP.active || !COOP.inGame || G !== 'play') return;
  const p2 = COOP.P2, now = performance.now();
  if (COOP.escT > 0) COOP.escT -= dt;

  // 1. 队友平滑插值 + 本地推进动画时钟（两次网络包之间动画不卡）
  const k = Math.min(1, dt * 18);
  p2.x += (p2.targetX - p2.x) * k;
  p2.y += (p2.targetY - p2.y) * k;
  p2.t += dt;
  if (p2.st === 'fv' && !(p2.ryuki || p2.k5 || p2.bl)) {   // Malaya 终结技落地冲击波
    if (p2.t >= 1 && !p2.kb) { p2.kb = true; FX.push({ type: 'malaya_kick_blast', x: p2.x + p2.f * 80, y: p2.y - 80, t: .5, d: .5, r: 160 }); }
  } else p2.kb = false;

  // 2. 客机：怪物位置向房主权威位置平滑靠拢
  if (!COOP.isHost) {
    const kk = Math.min(1, dt * 14);
    for (const e of E) {
      if (e.tx === undefined || e.dsh > 0) continue;
      e.x += (e.tx - e.x) * kk;
      e.y += (e.ty - e.y) * kk;
    }
  }

  // 3. 掉线检测
  if (now - COOP.lastRecv > COOP_TIMEOUT && !p2.gone) {
    p2.gone = true;
    if (COOP.isHost) coopNotice('队友已掉线');
    else { coopLeaveRoom(); toVil('st'); coopNotice('与房主失去连接，战斗结束'); return; }
  }

  // 4. 救援读条：靠近倒地队友，按住 F
  COOP.channeling = false;
  if (!P.down && p2.down && !p2.gone) {
    const near = Math.abs(P.x - p2.x) < COOP_REVIVE_RANGE;
    const able = (P.st === 'idle' || P.st === 'run') && P.y >= GY;
    if (near && K.KeyF && able) {
      COOP.channeling = true;
      COOP.rescueT = Math.min(COOP_REVIVE_TIME, COOP.rescueT + dt);
      if (COOP.rescueT >= COOP_REVIVE_TIME) {
        coopSend('revive_done', {});
        p2.down = false; p2.hp = Math.round(p2.mh * .5); p2.rv = 0;
        COOP.rescueT = 0; COOP.channeling = false;
        DT.push({ x: p2.x, y: p2.y - 200, s: '救援成功！', t: 1.6, c: '#7dff9a' });
      }
    } else {
      COOP.rescueT = Math.max(0, COOP.rescueT - dt * 1.5);   // 中断后进度缓慢回落
    }
  } else {
    COOP.rescueT = 0;
  }

  // 5. 房主裁决：双方都倒下（或一方倒下、另一方掉线）= 战斗失败
  if (COOP.isHost && P.down && (p2.down || p2.gone)) { fin(0); return; }

  // 6. 新增弹道 / 战车：广播给队友做展示
  for (const s of PJ) if (!s.vis && !s.cs) { const pk = coopPack(s); s.cs = 1; coopSend('fx_pj', pk); }
  for (const b of BIKES) if (!b.vis && !b.cs) { const pk = coopPack(b); b.cs = 1; coopSend('fx_bike', pk); }

  // 7. 向网络广播自身状态（约 18 次/秒；动作/倒地状态变化时立即发）
  COOP.lastSyncT += dt;
  if (P.st !== COOP.lastSt || P.down !== COOP.lastDown || COOP.lastSyncT >= 0.055) {
    COOP.lastSyncT = 0; COOP.lastSt = P.st; COOP.lastDown = P.down;
    coopSend('p_sync', {
      x: Math.round(P.x), y: Math.round(P.y),
      vx: Math.round(P.vx), vy: Math.round(P.vy),
      f: P.f, st: P.st, t: Math.round(P.t * 1000) / 1000,
      hp: P.hp, mh: P.mh,
      ryuki: !!P.ryuki, k5: !!P.k5, bl: !!P.bl, trk: P.trk || null,
      spr: !!P.spr, tdur: P.tdur || 0, h: P.h | 0,
      inv: P.inv > 0 ? 1 : 0,
      down: !!P.down,
      rv: Math.round(cl(COOP.rescueT / COOP_REVIVE_TIME, 0, 1) * 100) / 100
    });
  }

  // 8. 房主：怪物权威位置/血量 + 全队进度
  if (COOP.isHost) {
    COOP.monT += dt;
    if (COOP.monT >= 0.055) {
      COOP.monT = 0;
      coopSend('host_monsters_sync', {
        kills, RG, bs: bs ? 1 : 0,
        monsters: E.filter(e => !e.dead).map(e => ({
          id: e.id, x: Math.round(e.x), y: Math.round(e.y),
          hp: e.hp, mhp: e.mhp, t: e.t, vi: e.vi
        }))
      });
    }
  }
}

// ---------- 4. 队友 (2P) 画面渲染 ----------

function drawCoopP2() {
  if (!COOP.active || !COOP.inGame || !COOP.peerConnected) return;
  const p2 = COOP.P2;
  if (p2.gone || !p2.init) return;
  const x = sn(p2.x - cam), y = sn(p2.y);
  if (x < -220 || x > 1180) return;

  // 变身演出依赖本地全局状态，队友变身期间用站立姿态 + 形态色光效代替
  const trans = p2.st === 'trans' || p2.st === 'trans_ryuki';
  const saved = {};
  for (const k of COOP_P2_KEYS) saved[k] = P[k];
  Object.assign(P, {
    x: p2.x, y: p2.y, f: p2.f,
    st: (trans || p2.down) ? 'idle' : p2.st,
    t: p2.t, inv: 0, land: 0, vx: p2.vx, vy: p2.vy,
    ryuki: !!p2.ryuki, k5: !!p2.k5, bl: !!p2.bl, trk: p2.trk,
    spr: !!p2.spr, tdur: p2.tdur, h: p2.h
  });

  ctx.save();
  try {
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 10;
    if (p2.down) {   // 倒地：横躺 + 半透明
      ctx.translate(x, y); ctx.rotate(-p2.f * Math.PI / 2); ctx.translate(-x, -y);
      ctx.globalAlpha = .8;
    } else if (trans) {
      ctx.shadowColor = p2.trk === '555' ? '#ffb400' : p2.trk === 'blade' ? '#3aa0ff' : p2.trk === 'ryuki' ? '#ff4757' : '#00e5ff';
      ctx.shadowBlur = 22 + 10 * Math.sin(T * 14);
    }
    drawP0();   // 与本机完全相同的绘制管线 → 普攻/技能/终结技/闪避/疾跑动画全部可见
  } catch (err) {
    console.warn('[Co-op] 队友渲染异常', err);
  } finally {
    ctx.restore();
    Object.assign(P, saved);
  }

  // 头顶名牌与血条
  const tagY = y - 214;
  txt((COOP.isHost ? '2P' : '1P') + (p2.down ? ' · 倒地!' : ''), x, tagY - 14, 12, p2.down ? '#ff6b81' : '#7df9ff', 'center');
  const bw = 50, bh = 5;
  rpath(x - bw / 2 - 1, tagY - 1, bw + 2, bh + 2, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fill();
  const hpW = Math.max(0, bw * cl(p2.hp / Math.max(1, p2.mh), 0, 1));
  if (hpW > 0) {
    rpath(x - bw / 2, tagY, hpW, bh, 2);
    ctx.fillStyle = p2.down ? '#ff4757' : '#00e5ff'; ctx.fill();
  }

  // 倒地队友：救援读条圈
  if (p2.down) {
    const cx = x, cy = y - 60, r = 30;
    const prog = cl(COOP.rescueT / COOP_REVIVE_TIME, 0, 1);
    ctx.save();
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,.55)';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    if (prog > 0) {
      ctx.strokeStyle = '#7dff9a'; ctx.shadowColor = '#7dff9a'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog); ctx.stroke();
    }
    ctx.restore();
    txt('✚', cx, cy, 20, '#ff6b81', 'center');
    if (COOP.channeling) txt('救援中 ' + Math.round(prog * 100) + '%', cx, cy - r - 12, 13, '#7dff9a', 'center');
    else if (coopCanRescue()) txt('按住 F 救援（' + COOP_REVIVE_TIME + ' 秒）', cx, cy - r - 12, 13, '#ffd84a', 'center');
  }
}

// ---------- 5. 联机 HUD 叠层：屏外指示 / 倒地提示 / 救援进度 / 结算投票 ----------

function drawCoopOverlay() {
  if (!COOP.active || !COOP.inGame) return;
  const p2 = COOP.P2;

  if (G === 'play') {
    // 队友在屏幕外：边缘箭头
    if (COOP.peerConnected && p2.init && !p2.gone) {
      const sx = p2.x - cam;
      if (sx < 20 || sx > 940) {
        const left = sx < 20, ax = left ? 26 : 934, ay = 300;
        const col = p2.down ? '#ff4757' : '#00e5ff';
        ctx.save();
        ctx.globalAlpha = .75 + .25 * Math.sin(T * 8);
        ctx.fillStyle = col;
        ctx.beginPath();
        if (left) { ctx.moveTo(ax + 10, ay - 14); ctx.lineTo(ax - 10, ay); ctx.lineTo(ax + 10, ay + 14); }
        else { ctx.moveTo(ax - 10, ay - 14); ctx.lineTo(ax + 10, ay); ctx.lineTo(ax - 10, ay + 14); }
        ctx.closePath(); ctx.fill();
        ctx.restore();
        txt((COOP.isHost ? '2P' : '1P') + (p2.down ? ' 倒地!' : ''), left ? ax + 18 : ax - 18, ay - 4, 12, col, left ? 'left' : 'right');
        txt(Math.round(Math.abs(p2.x - P.x) / 10) + 'm', left ? ax + 18 : ax - 18, ay + 12, 11, '#cfd8e3', left ? 'left' : 'right');
      }
    }

    // 自己倒地：红色暗角 + 提示
    if (P.down) {
      const g = ctx.createRadialGradient(480, 270, 170, 480, 270, 570);
      g.addColorStop(0, 'rgba(120,0,10,0)'); g.addColorStop(1, 'rgba(170,0,22,.55)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 960, 540);
      txt('濒 死 · DOWN', 480, 140, 30, '#ff4757', 'center');
      const prog = cl(p2.rv || 0, 0, 1), bw = 300, bx = 330, by = 172;
      rpath(bx, by, bw, 12, 6); ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fill();
      if (prog > 0) { rpath(bx, by, bw * prog, 12, 6); ctx.fillStyle = '#7dff9a'; ctx.fill(); }
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; rpath(bx, by, bw, 12, 6); ctx.stroke();
      txt(prog > 0 ? '队友救援中 ' + Math.round(prog * 100) + '%' : '等待队友前来救援…', 480, 204, 14, prog > 0 ? '#7dff9a' : '#ffd8d8', 'center');
      txt('队友需在你身旁持续按住 F 满 ' + COOP_REVIVE_TIME + ' 秒；队友倒下则战斗失败', 480, 226, 11.5, '#c9a0a8', 'center');
    }

    // 我在救人：底部读条
    if (COOP.channeling) {
      const prog = cl(COOP.rescueT / COOP_REVIVE_TIME, 0, 1), bw = 320, bx = 320, by = 434;
      rpath(bx - 6, by - 20, bw + 12, 40, 8); ctx.fillStyle = 'rgba(6,12,24,.85)'; ctx.fill();
      txt('救援中 · 剩余 ' + (COOP_REVIVE_TIME - COOP.rescueT).toFixed(1) + 's（松开 F 会缓慢回落）', 480, by - 7, 12, '#7dff9a', 'center');
      rpath(bx, by + 4, bw, 8, 4); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill();
      if (prog > 0) { rpath(bx, by + 4, bw * prog, 8, 4); ctx.fillStyle = '#7dff9a'; ctx.fill(); }
    }
  }

  // 结算投票条（画在结算面板下方）
  if ((G === 'win' || G === 'over') && coopSettleActive()) {
    const v = COOP.vote;
    const hasNext = nextStageIdx() >= 0;
    const nm = c => c === 'retry' ? '再次挑战' : c === 'next' ? (hasNext ? '下一战役' : '完成出征') : '未选择';
    const x0 = 140, w = 680, y0 = 494, h = 36;
    const conflict = v.me && v.peer && v.me !== v.peer;
    rpath(x0, y0, w, h, 10);
    ctx.fillStyle = 'rgba(6,12,24,.92)'; ctx.fill();
    ctx.strokeStyle = conflict ? '#ffa502' : (v.me || v.peer) ? '#00e5ff' : 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.4; ctx.stroke();
    txt('你：' + nm(v.me) + (v.me ? ' ✓' : ''), x0 + 18, y0 + h / 2, 13, v.me ? '#7df9ff' : '#8fa0b3', 'left');
    txt('队友：' + nm(v.peer) + (v.peer ? ' ✓' : ''), x0 + w - 18, y0 + h / 2, 13, v.peer ? '#ffd84a' : '#8fa0b3', 'right');
    const hint = conflict ? '双方选择不一致，请重新选择（再按一次可取消）'
      : v.me && !v.peer ? '等待队友确认…'
      : !v.me && v.peer ? '队友已选择，按相同选项即可开始'
      : '再次挑战 / 下一战役 需双方都选择才会开始';
    txt(hint, x0 + w / 2, y0 + h / 2, 12, conflict ? '#ffa502' : '#dfe6ee', 'center');
  }

  // 提示条
  if (COOP.note && performance.now() < COOP.note.until) {
    txt(COOP.note.s, 480, 96, 16, '#ffd84a', 'center');
  }
}
