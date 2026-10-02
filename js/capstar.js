// ===== 胶囊升星 =====
// 数据（随 save() 写入本地与云端）：
//   S.cs  = { 胶囊id: 星级 0~5 }
//   S.csh = 契约碎片（所有胶囊通用）
// 碎片来源：扭蛋抽到重复胶囊（见 ui.js 的 gachaPull）、无尽塔首领层首通（见 tower.js）
// 想调平衡：只改下面这几个常量。
const CAP_STAR_MAX = 5;
const CAP_STAR_COST = [3, 6, 10, 16, 25];   // 升到第 1~5 星各需要多少碎片（合计 60）
const CAP_STAR_ATK = 0.04;                  // 每星：该形态攻击倍率 +4%
const CAP_STAR_CR = 0.015;                  // 每星：该形态暴击率 +1.5%
const CAP_STAR_CD = [0, 0, 0, 0.10, 0.10, 0.20];   // 按星级：L / E 技能冷却缩减（3★ -10%，5★ -20%）
const CAP_DUP_SHARD = 3;                    // 抽到重复胶囊返还的碎片数

function capCS() { if (!S.cs || typeof S.cs !== 'object') S.cs = {}; return S.cs; }
const capStar = id => Math.max(0, Math.min(CAP_STAR_MAX, capCS()[id] | 0));
const capShards = () => S.csh | 0;
const capStarCost = id => { const s = capStar(id); return s >= CAP_STAR_MAX ? 0 : CAP_STAR_COST[s]; };

// 带星级的形态倍率：power.js 的 previewStats 用它们代替 c.atkMul / c.crAdd
const capAtkMul = c => (c.atkMul || 1) + capStar(c.id) * CAP_STAR_ATK;
const capCrAdd = c => (c.crAdd || 0) + capStar(c.id) * CAP_STAR_CR;
// 当前形态的技能冷却倍率：player.js 的 getSkillCD 用它（只作用于 L / E）
function capCdMul() {
  const c = (typeof formCap === 'function') ? formCap() : null;
  return c ? 1 - (CAP_STAR_CD[capStar(c.id)] || 0) : 1;
}

function capStarBonusText(id) {
  const s = capStar(id);
  if (!s) return '';
  const cd = CAP_STAR_CD[s] ? ' 冷却-' + Math.round(CAP_STAR_CD[s] * 100) + '%' : '';
  return '★' + s + ' 攻+' + +(s * CAP_STAR_ATK * 100).toFixed(1) + '% 暴+' + +(s * CAP_STAR_CR * 100).toFixed(1) + '%' + cd;
}

// 升星按钮的命中区域：由胶囊终端（ui.js drawCapsuleModal0）每帧登记，main.js 的点击处理读取
const CAPUP = { x: -99, y: -99, w: 0, h: 0, msg: '', until: 0 };
const capUpHit = (px, py) => px >= CAPUP.x && px <= CAPUP.x + CAPUP.w && py >= CAPUP.y && py <= CAPUP.y + CAPUP.h;
function capMsg(s) { CAPUP.msg = s; CAPUP.until = T + 1.8; }

function capStarUp(id) {
  const c = CAPSULES.find(o => o.id === id);
  if (!c) return false;
  if (!S.caps.includes(id)) { capMsg('尚未拥有该胶囊'); return false; }
  const s = capStar(id);
  if (s >= CAP_STAR_MAX) { capMsg('已满星'); return false; }
  const need = CAP_STAR_COST[s];
  if (capShards() < need) { capMsg('契约碎片不足（还差 ' + (need - capShards()) + '）'); return false; }
  S.csh = capShards() - need;
  capCS()[id] = s + 1;
  calc(); save();
  capMsg('★ ' + c.short + ' 升至 ' + (s + 1) + ' 星！');
  if (typeof questToast === 'function') questToast('⭐ ' + c.name + ' 升至 ' + (s + 1) + ' 星', '#ffd84a');
  return true;
}
