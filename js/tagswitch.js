// ===== 双胶囊战术轮换 · Tag-In Strike =====
// 数据：S.eqCap = 前台（主位）胶囊，S.eqCap2 = 后台（副位）胶囊；随 save() 写入本地与云端。
// 玩法：已变身 + 已装配副位时，按 [P] 触发「切人突袭」：
//   ① 当前形态“脱手技”退场（前方范围斩击 + 抵消弹幕 + 残影）
//   ② 副位形态以破空飞踢进场（复用闪避位移 + 突进判定），可从普攻 / L / K 中途取消
//   ③ 进场后 crDur 秒暴击率 +crAdd
//   ④ 前后台互换（再按 P 会换回来），冷却 cdMax 秒
// 解除变身：装了副位后 [P] 被切人占用，改用 [O]（触屏有「解除」按钮）。
// 想调平衡：只改 TAG 里的数值。
const TAG = {
  cd: 0, cdMax: 3.5,          // 切人冷却
  crT: 0, crDur: 6, crAdd: .25, // 进场暴击增益：时长 / 暴击率加成
  outMul: 2.4, outReach: 430,   // 退场技：伤害倍率（×攻击）/ 前方距离
  inMul: 3.2,                   // 进场飞踢：伤害倍率
  strike: 0, hit: null
};
const TAG_IDS = ['ryuki', '555', 'blade', 'zeztz', 'deno'];
const CAPSUB = { x: -99, y: -99, w: 0, h: 0 };   // 「设为副位」按钮命中区，由 ui.js 每帧登记

const tagCrBonus = () => TAG.crT > 0 ? TAG.crAdd : 0;
const tagSubCap = () => S.eqCap2 ? CAPSULES.find(c => c.id === S.eqCap2) : null;
const tagHitSub = (px, py) => px >= CAPSUB.x && px <= CAPSUB.x + CAPSUB.w && py >= CAPSUB.y && py <= CAPSUB.y + CAPSUB.h;

// 数据自洽：副位必须已拥有、不能与主位相同；主位空缺时副位自动顶上
function tagNormalize() {
  if (!Array.isArray(S.caps)) return;
  if (S.eqCap2 && (S.eqCap2 === S.eqCap || !S.caps.includes(S.eqCap2) || !TAG_IDS.includes(S.eqCap2))) S.eqCap2 = null;
  if (!S.eqCap && S.eqCap2) { S.eqCap = S.eqCap2; S.eqCap2 = null; }
}

// 胶囊终端：设为 / 取消副位
function capEquipSub(id) {
  id = id || curSelCapId;
  const c = CAPSULES.find(o => o.id === id);
  if (!c) return;
  if (!S.caps.includes(id)) { say('尚未拥有该胶囊'); return; }
  if (!TAG_IDS.includes(id)) { say('该胶囊不能作为副位'); return; }
  if (S.eqCap2 === id) { S.eqCap2 = null; say('已取消副位'); }
  else if (S.eqCap === id) { say('该胶囊已是主位'); return; }
  else if (!S.eqCap) { S.eqCap = id; clearForms(); say('已装配为主位（再选一个设为副位）'); }
  else { S.eqCap2 = id; say('副位：' + c.short + '　战斗中按 [P] 切人突袭'); }
  save(); calc();
}

function tagSetForm(id) {
  clearForms();
  if (id === '555') P.k5 = true;
  else if (id === 'blade') P.bl = true;
  else if (id === 'zeztz') P.zeztz = true;
  else if (id === 'deno') P.dn = true;
  else P.ryuki = true;
}

function tagBlocked() {
  if (typeof COOP !== 'undefined' && COOP.active && COOP.inGame) return true;     // 联机不同步，先禁用
  if (typeof ROGUE !== 'undefined' && ROGUE.inRun) return true;
  return P.down || P.st === 'trans' || P.st === 'trans_ryuki' || !(G === 'play' || G === 'vil' || G === 'room');
}
const tagReady = () => !!(S.eqCap && S.eqCap2 && S.eqCap !== S.eqCap2) && inForm() && !tagBlocked();

// 主循环 P 键入口：返回 true = 已被切人占用
function tagTry() {
  if (!tagReady()) return false;
  if (TAG.cd > 0) { DT.push({ x: P.x, y: P.y - 180, s: '切人冷却 ' + TAG.cd.toFixed(1) + 's', t: .7, c: '#ffa502' }); return true; }
  tagExec();
  return true;
}

function tagExec() {
  const play = G === 'play', outCol = formCol(), f = P.f;
  const outCap = formCap(), outId = S.eqCap, inId = S.eqCap2;

  // ① 退场技：前方范围斩击 + 抵消弹幕 + 旧形态残影
  if (play) {
    const a = P.x - f * 60, b = P.x + f * TAG.outReach;
    area(Math.min(a, b), Math.max(a, b), P.atk * TAG.outMul);
    if (typeof cancelEP === 'function') cancelEP(Math.min(a, b), Math.max(a, b));
    GH.push({ z: depthPz(), x: P.x, y: P.y, f, st: 'idle', t: .55, d: .55, pt: 0,
      rf: { ryuki: P.ryuki, k5: P.k5, bl: P.bl, zeztz: P.zeztz, dn: P.dn } });
    FX.push({ type: 'boom', x: P.x + f * 200, y: P.y - 60, t: .45, d: .45, r: 210, c: outCol });
    DT.push({ x: P.x, y: P.y - 200, s: 'TAG OUT · ' + (outCap ? outCap.short : ''), t: .8, c: outCol });
  }

  // ② 前后台互换，立即换形态（不播变身动画）
  S.eqCap = inId; S.eqCap2 = outId;
  tagSetForm(inId);
  TAG.cd = TAG.cdMax; TAG.crT = TAG.crDur;
  P.hit = {}; P.h = 0; P.inv = Math.max(P.inv, .6);
  calc(); save();

  // ③ 进场：破空飞踢（借用闪避的位移与无敌，期间持续判定）
  const inCap = formCap(), inCol = formCol();
  if (play) {
    P.st = 'dodge'; P.t = 0; P.dcd = .36; P.vy = 0; P.vx = P.f * 1200; P.vz = 0; P.dxm = 1;
    TAG.strike = .36; TAG.hit = {};
    shake = Math.max(shake, 12);
    FX.push({ type: 'boom', x: P.x, y: P.y - 80, t: .3, d: .3, r: 150, c: inCol });
  } else { P.st = 'idle'; }
  DT.push({ x: P.x, y: P.y - 230, s: 'TAG IN · ' + (inCap ? inCap.short : '') + '  暴击 +' + Math.round(TAG.crAdd * 100) + '%', t: 1.2, c: inCol });
}

// 每帧：冷却 / 增益计时 / 飞踢判定（main.js 的 upd 调用）
function tagUpdate(dt) {
  if (TAG.cd > 0) TAG.cd = Math.max(0, TAG.cd - dt);
  if (TAG.crT > 0) {
    if (G !== 'play' && G !== 'vil' && G !== 'room') TAG.crT = 0;
    else TAG.crT = Math.max(0, TAG.crT - dt);
    if (TAG.crT <= 0) calc();
  }
  if (TAG.strike > 0) {
    TAG.strike -= dt;
    if (G === 'play' && P.st === 'dodge' && TAG.hit) {
      const a = P.x - P.f * 40, b = P.x + P.f * 210;
      area(Math.min(a, b), Math.max(a, b), P.atk * TAG.inMul, TAG.hit);
    }
    if (TAG.strike <= 0) {
      if (G === 'play') {
        FX.push({ type: 'boom', x: P.x + P.f * 120, y: GY - 50, t: .4, d: .4, r: 170, c: formCol() });
        shake = Math.max(shake, 8);
      }
      TAG.hit = null;
    }
  }
}

// 解除变身（装了副位后 [P] 被切人占用）
function tagUnform() { if (inForm()) triggerRyukiTransform(); }

// ---------- HUD：不再单独画一条，直接并进技能栏的 [P] 槽 / 手机的 P 键 ----------
const tagOn = () => !!(S.eqCap2 && inForm());                     // P 槽当前是否处于「切人」模式
const tagPcd = () => tagOn() ? TAG.cd : (P.cd.p || 0);            // P 槽冷却：切人模式用切人冷却
const tagPmax = () => tagOn() ? TAG.cdMax : (P.maxCd.p || 1);
const tagPname = () => tagOn() ? '切人' : (inForm() ? '解除' : '变身');

// 桌面：ui.js 的 drawSkillBarHUD 在画完每个槽后调用（只对 P 槽生效）。
// 槽内底部：副位名色条；槽顶：暴击增益剩余时间条 + 金色描边。
function drawTagSlot(x, y, sz) {
  const c = tagSubCap();
  if (!c) return;
  ctx.save();
  if (tagOn()) {
    const h = 12;
    ctx.fillStyle = 'rgba(6,10,20,.82)'; ctx.fillRect(x + 2, y + sz - h - 2, sz - 4, h);
    ctx.fillStyle = c.c; ctx.globalAlpha = .9; ctx.fillRect(x + 2, y + sz - h - 2, 3, h); ctx.globalAlpha = 1;
    txt('⇄' + c.short, x + sz / 2 + 1, y + sz - h / 2 - 2, 9, '#fff', 'center', false);
  }
  if (TAG.crT > 0) {
    ctx.strokeStyle = '#ffd84a'; ctx.shadowColor = '#ffd84a'; ctx.shadowBlur = 8; ctx.lineWidth = 1.8;
    ctx.strokeRect(x + .5, y + .5, sz - 1, sz - 1);
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x + 2, y + 2, sz - 4, 3);
    ctx.fillStyle = '#ffd84a'; ctx.fillRect(x + 2, y + 2, (sz - 4) * Math.min(1, TAG.crT / TAG.crDur), 3);
  }
  ctx.restore();
}

// 手机：P 键的文字（带副位名）与增益高亮，main.js 的触控刷新循环调用
function tagTouchLabel() {
  if (!tagOn()) return inForm() ? '解除' : '变身';
  const c = tagSubCap();
  return '切人<i class="n">⇄' + (c ? c.short : '') + '</i>';
}
