// ===== 双人联机核心模块 (Co-op Dungeon Engine) =====
// 基于 Supabase Realtime Broadcast，实现房主-客机架构与怪物血量强同步

const COOP = {
  active: false,       // 是否在联机房间/战斗中
  inGame: false,       // 是否已进入战斗关卡
  isHost: false,       // 是否为房主 (1P)
  roomCode: '',        // 4 位房间号
  channel: null,       // Supabase 频道实例
  stageIdx: 0,         // 选定的关卡索引
  myReady: false,      // 本地准备状态
  peerReady: false,    // 队友准备状态
  peerConnected: false,// 队友是否在线
  lastSyncT: 0,        // 发送同步包节流计时器
  
  // 队友数据镜像 (2P)
  P2: {
    x: 300, y: 470, vx: 0, vy: 0, f: 1,
    st: 'idle', hp: 100, mh: 100, mp: 100, mm: 100,
    rk: 'malaya', spr: false, t: 0,
    targetX: 300, targetY: 470
  }
};

// ---------- 1. 房间创建与加入 ----------

// 创建房间 (作为 Host)
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

  await coopJoinChannel(code);
  return code;
}

// 加入房间 (作为 Client)
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

  await coopJoinChannel(code);
  // 向房主发送打招呼包
  setTimeout(() => {
    coopSend('peer_join', { uid: S.userId || 'guest' });
  }, 500);
}

// 退出/解散房间
function coopLeaveRoom() {
  if (COOP.channel) {
    coopSend('room_close', {});
    sbClient.removeChannel(COOP.channel);
    COOP.channel = null;
  }
  COOP.active = false;
  COOP.inGame = false;
  COOP.roomCode = '';
  COOP.peerConnected = false;
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

// 消息分发处理器
function coopHandleMessage({ type, data, fromHost }) {
  // 1. 房间与准备流程
  if (type === 'peer_join') {
    COOP.peerConnected = true;
    if (COOP.isHost) {
      // 房主告诉客机当前选的关卡和准备状态
      coopSend('room_sync', { stageIdx: COOP.stageIdx, hostReady: COOP.myReady });
    }
  } else if (type === 'room_sync') {
    COOP.peerConnected = true;
    COOP.stageIdx = data.stageIdx;
    COOP.peerReady = data.hostReady;
  } else if (type === 'ready_change') {
    COOP.peerReady = data.ready;
  } else if (type === 'stage_start') {
    // 房主下达出征令，两人同时进入关卡
    COOP.stageIdx = data.stageIdx;
    COOP.inGame = true;
    M = 0; // 关闭所有菜单
    begin(COOP.stageIdx);
  } else if (type === 'room_close') {
    alert('房间已解散或队友已退出');
    coopLeaveRoom();
    if (G === 'play') toVil('st');
  }

  // 2. 战斗中：队友位置与动作状态同步 (P2)
  if (type === 'p_sync') {
    Object.assign(COOP.P2, data);
    COOP.P2.targetX = data.x;
    COOP.P2.targetY = data.y;
  }

  // 3. 战斗中：怪兽血量与状态强同步（核心！）
  if (type === 'guest_hurt_m') {
    // 【房主端收到客机的攻击判定】
    if (COOP.isHost) {
      const e = E.find(m => m.id === data.id && !m.dead);
      if (e) {
        hurt(e, data.dmg); // 房主执行权威扣血
        // 将扣血事实广播给客机
        coopSend('m_hurt_ack', { id: e.id, hp: e.hp, dmg: data.dmg, dead: !!e.dead });
      }
    }
  } else if (type === 'm_hurt_ack') {
    // 【客机端收到房主的血量扣除通知】
    const e = E.find(m => m.id === data.id);
    if (e) {
      e.hp = data.hp;
      e.fl = 0.12;
      // 飘出伤害数字
      DT.push({ x: e.x, y: e.y - e.h, s: String(Math.round(data.dmg)), t: 0.8, c: '#ffd84a' });
      if (data.dead && !e.dead) {
        e.dead = 1;
        FX.push({ type: 'boss_death_blast', x: e.x, y: e.y - e.h / 2, t: 0.6, d: 0.6, r: e.t === 'boss' ? 220 : 70 });
      }
    }
  } else if (type === 'host_monsters_sync') {
    // 【客机端接收房主的全场怪兽列表更新】
    if (!COOP.isHost) {
      // 对齐怪兽坐标与血量
      data.monsters.forEach(m => {
        let localE = E.find(e => e.id === m.id);
        if (!localE && !m.dead) {
          // 本地缺失则按类型占位补齐
          spawn(m.t, m.x);
          localE = E[E.length - 1];
          if (localE) localE.id = m.id;
        }
        if (localE) {
          localE.x += (m.x - localE.x) * 0.4;
          localE.y += (m.y - localE.y) * 0.4;
          localE.hp = m.hp;
          localE.mhp = m.mhp;
          if (m.dead && !localE.dead) localE.dead = 1;
        }
      });
    }
  }
}

// ---------- 3. 战斗中帧循环高频同步 ----------

function coopUpdateBattle(dt) {
  if (!COOP.active || !COOP.inGame) return;

  // 1. 队友坐标平滑靠拢插值 (避免网络抖动带来的瞬移)
  const p2 = COOP.P2;
  p2.x += (p2.targetX - p2.x) * Math.min(1, dt * 18);
  p2.y += (p2.targetY - p2.y) * Math.min(1, dt * 18);

  // 2. 本地向网络广播自身数据 (每秒约 18 次)
  COOP.lastSyncT += dt;
  if (COOP.lastSyncT >= 0.055) {
    COOP.lastSyncT = 0;
    coopSend('p_sync', {
      x: Math.round(P.x),
      y: Math.round(P.y),
      vx: Math.round(P.vx),
      vy: Math.round(P.vy),
      f: P.f,
      st: P.st,
      hp: P.hp,
      mh: P.mh,
      rk: curRiderKey(),
      spr: P.spr
    });

    // 房主额外高频广播怪兽权威位置与生命
    if (COOP.isHost) {
      coopSend('host_monsters_sync', {
        monsters: E.map(e => ({
          id: e.id,
          x: Math.round(e.x),
          y: Math.round(e.y),
          hp: e.hp,
          mhp: e.mhp,
          t: e.t,
          dead: e.dead
        }))
      });
    }
  }
}

// ---------- 4. 队友 (2P) 画面渲染 ----------

function drawCoopP2() {
  if (!COOP.active || !COOP.inGame || !COOP.peerConnected) return;

  const p2 = COOP.P2;
  const x = sn(p2.x - cam), y = sn(p2.y), f = p2.f;

  ctx.save();
  // 队友青蓝色光芒标记
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = 10;

  // 绘制队友模型（根据队友上报的形态）
  if (p2.rk === 'ryuki' && SHR.run) dr(SHR.run, (T * 12 | 0) % 4, x, y, f, 1.0);
  else if (p2.rk === '555' && okS(SH5.run)) dr(SH5.run, (T * 14 | 0) % 4, x, y, f, 1.0);
  else if (p2.rk === 'blade' && okS(SH6.run)) drBR((T * 12 | 0) % 6, x, y, f);
  else dr(SH.atk, 12, x, y, f, 1.0);

  ctx.restore();

  // 队友头顶名牌与血条
  const tagY = y - 210;
  txt(COOP.isHost ? '2P [队友]' : '1P [房主]', x, tagY - 14, 12, '#7df9ff', 'center');
  
  // 微型血条
  const bw = 50, bh = 5;
  rpath(x - bw / 2 - 1, tagY - 1, bw + 2, bh + 2, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fill();
  const hpW = Math.max(0, bw * cl(p2.hp / Math.max(1, p2.mh), 0, 1));
  if (hpW > 0) {
    rpath(x - bw / 2, tagY, hpW, bh, 2);
    ctx.fillStyle = '#00e5ff'; ctx.fill();
  }
}