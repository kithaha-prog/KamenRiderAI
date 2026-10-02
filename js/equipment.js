// ===== 装备系统核心数据配置 =====
const SLOTS = {
  weapon: { n: '武器', stat: 'atk' },
  chest: { n: '胸甲', stat: 'hp' },
  belt: { n: '变身腰带', stat: 'atk' },
  legs: { n: '腿甲', stat: 'hp' },
  boots: { n: '靴子', stat: 'hp' },
  necklace: { n: '项链', stat: 'mp' },
  ring: { n: '戒指', stat: 'atk' }
};

const TIERS = [
  { id: 0, n: '普通', c: '#a0a0a0', bg: 'rgba(160,160,160,0.22)', mul: 1.0, scrap: 1 },
  { id: 1, n: '优质', c: '#00d2d3', bg: 'rgba(0,210,211,0.25)', mul: 1.25, scrap: 2 },
  { id: 2, n: '稀有', c: '#2e86de', bg: 'rgba(46,134,222,0.28)', mul: 1.6, scrap: 4 },
  { id: 3, n: '史诗', c: '#a55eea', bg: 'rgba(165,94,234,0.32)', mul: 2.1, scrap: 8 },
  { id: 4, n: '传说', c: '#ffd32a', bg: 'rgba(255,211,42,0.36)', mul: 2.8, scrap: 16 },
  { id: 5, n: '神话', c: '#ff3838', bg: 'rgba(255,56,56,0.42)', mul: 3.8, scrap: 32 }
];

const ITEM_NAMES = {
  weapon: [
    ['练习合金刃', '治安短棍', '轻量战刀'],
    ['矢量震荡刃', '聚能光子剑', '突击光刃'],
    ['苍蓝破空剑', '深海电弧刃', '霜袭光剑'],
    ['幻影天驱剑', '零式聚能大剑', '雷芒斩魄刀'],
    ['胜利裁决·圣辉刃', '炽天音速剑', '龙帝霸煌刃'],
    ['终焉创世巨刃', '极皇帝皇圣剑', '弑神骑士斩刃']
  ],
  chest: [
    ['巡逻轻型背心', '冲压铁护胸', '战术背心'],
    ['钛合金强化胸甲', '聚能防弹甲', '守卫者胸甲'],
    ['碧海重流胸甲', '钴蓝离子护胸', '浪涌战甲'],
    ['暗蚀生化纳米甲', '极光棱镜护心甲', '冥王战铠'],
    ['龙鳞不灭重铠', '太阳神威炽光甲', '圣辉守护铠'],
    ['创世神躯·天穹圣铠', '虚空混沌战铠', '终极帝皇神甲']
  ],
  necklace: [
    ['铜制护身符', '巡警识别吊坠', '合金颈链'],
    ['能量汇聚锁片', '灵能增幅挂坠', '动力调节链'],
    ['幽蓝深渊吊坠', '潮汐流光项链', '碧空寒霜链'],
    ['虚空裂隙核心', '幻紫星尘链', '摄魂极光项链'],
    ['炽阳龙核吊坠', '命运裁决符印', '霸主辉光链'],
    ['创世神之泪', '灭世混沌核心', '永恒原石吊坠']
  ],
  ring: [
    ['粗铸铁戒', '巡警银指环', '强化合金戒'],
    ['增幅铜环', '光子充能戒', '战术聚焦指环'],
    ['湛蓝冰魄戒', '深蓝脉冲指环', '雷霆激流戒'],
    ['紫曜噬能戒', '幽冥幻影指环', '魔能增幅戒'],
    ['黄金龙瞳之戒', '救世主契约戒', '圣煌天辉戒'],
    ['万物主宰印戒', '虚无神权魔戒', '终局炽焰神环']
  ],
  belt: [
    ['仿制驱动器', '基础卡槽腰带', '试验型联结带'],
    ['动力增幅驱动器', '离子聚能腰带', '旋风原型腰带'],
    ['苍蓝狂潮驱动器', '极速战鹰腰带', '超导质子带'],
    ['幻影狂暴驱动器', '影月核心腰带', '虚空断罪驱动器'],
    ['炽龙真红驱动器', '帝王霸气腰带', '龙骑终极联结器'],
    ['极神灭尽终极驱动器', '创世主宰腰带', '奇点原初驱动器']
  ],
  legs: [
    ['轻便护膝', '战术护腿', '合金护胫'],
    ['动力增压护腿', '减震战术腿甲', '坚固防冲甲'],
    ['苍风战巡腿甲', '钴蓝激流护腿', '霜痕战术护胫'],
    ['幻紫逐风腿甲', '裂空重型腿甲', '暗影疾行护胫'],
    ['炎龙踏破重护腿', '炽光逐日战铠', '霸者圣辉腿甲'],
    ['崩灭星辰神腿铠', '混沌裁决圣甲', '破虚灭世腿铠']
  ],
  boots: [
    ['防滑战术靴', '巡逻胶底靴', '轻量耐磨短靴'],
    ['缓震充能战靴', '离子加速履', '强力推进战靴'],
    ['碧海潜行短靴', '苍蓝疾影靴', '破浪巡猎战靴'],
    ['虚空瞬影战靴', '紫电逐日履', '极速流光战靴'],
    ['赤龙踏焰战靴', '极光掠影神履', '炽天神速战靴'],
    ['踏碎虚空·神王战履', '创世奇点行者', '终焉灭世魔靴']
  ]
};

// 装备生成器（支持最高 500 级属性平滑曲线与需求等级）
const EQ_K = 0.6;   // 装备基础数值倍率（越小装备越弱）
const TIER_MUL_OLD = [1.0, 1.4, 2.0, 3.0, 4.6, 6.8];   // 旧版品质倍率，仅用于旧存档迁移
// ===== 装备词条系统 =====
// 每件装备带 0~3 条随机词条，每条词条有「品质 q」(0.55~1.00)，q ≥ 0.9 记为「完美」。
// 属性类词条（攻击 / 生命 / 魔力 / 暴击 / 免伤）直接并入 it.stats，所以战力、装备对比、穿戴计算全部自动生效；
// 特殊词条（吸血 / 金币加成 / 经验加成）不进 it.stats，由 affixTotal() 汇总后在战斗里生效（见 battle.js）。
// 词条只存 { k, q }，数值由 affixVal() 按「装备品质 + 需求等级 + 品质 q」实时算出，调平衡不会破坏旧存档。
const AFFIX_DEFS = {
  atk:  { n: '攻击',     c: '#ff9f9f', stat: true, w: 3 },
  hp:   { n: '生命',     c: '#7dffd0', stat: true, w: 3 },
  mp:   { n: '魔力',     c: '#8ec5ff', stat: true, w: 2 },
  crit: { n: '暴击率',   c: '#ffe08a', stat: true, w: 2 },
  def:  { n: '免伤',     c: '#9dffb8', stat: true, w: 2 },
  ls:   { n: '吸血',     c: '#ff6b81', w: 1, minTier: 1 },
  gd:   { n: '金币加成', c: '#ffd84a', w: 1, minTier: 1 },
  xp:   { n: '经验加成', c: '#c79bff', w: 1, minTier: 1 }
};
const AFFIX_N = [[0, .25], [1, 0], [1, .5], [2, 0], [2, .6], [3, 0]];   // 各品质词条数：[保底条数, 多 1 条的概率]
const AFFIX_PERFECT = .9;
let bagAffTab = false;   // 背包详情：false = 属性页，true = 词条页

function affixMax(k, tier, lvl) {   // 品质 q = 1 时的满值
  const b = lvl, mul = TIERS[tier].mul;
  switch (k) {
    case 'atk': return (3 + b * 1.1) * mul * EQ_K;
    case 'hp': return (20 + b * 9) * mul * EQ_K;
    case 'mp': return (10 + b * 5) * mul * EQ_K;
    case 'crit': return .012 + tier * .004;
    case 'def': return (1 + b * .2) * mul * EQ_K;
    case 'ls': return .01 + tier * .004;
    case 'gd': case 'xp': return .04 + tier * .02;
  }
  return 0;
}
function itemM(it) { return (1 + (it.lvl | 0) * UP_BONUS) * (1 + (it.star | 0) * STAR_BONUS); }
function affixVal(it, a) {
  const d = AFFIX_DEFS[a.k]; if (!d) return 0;
  const mx = affixMax(a.k, it.tier | 0, it.reqLvl || 1) * a.q;
  if (!d.stat) return +mx.toFixed(3);                 // 特殊词条：不随强化 / 升星变化
  const v = mx * itemM(it);                           // 属性词条：和基础属性一起吃强化 / 升星加成
  return a.k === 'crit' ? +v.toFixed(3) : Math.max(1, Math.round(v));
}
function affixStr(it, a) {
  const d = AFFIX_DEFS[a.k], v = affixVal(it, a);
  return '+' + ((d && d.stat && a.k !== 'crit') ? v.toLocaleString() : (v * 100).toFixed(1) + '%');
}
function rollAffixes(tier, lvl) {
  const cfg = AFFIX_N[tier] || AFFIX_N[0];
  const n = cfg[0] + (Math.random() < cfg[1] ? 1 : 0);
  const pool = Object.keys(AFFIX_DEFS).filter(k => !(AFFIX_DEFS[k].minTier > tier)), out = [];
  while (out.length < n && pool.length) {
    let r = Math.random() * pool.reduce((s, k) => s + AFFIX_DEFS[k].w, 0), idx = 0;
    for (let i = 0; i < pool.length; i++) { r -= AFFIX_DEFS[pool[i]].w; if (r < 0) { idx = i; break } }
    out.push({ k: pool.splice(idx, 1)[0], q: +(.55 + Math.random() * .45).toFixed(2) });
  }
  return out;
}
// 已穿戴装备的特殊词条合计（吸血 / 金币加成 / 经验加成），例如 affixTotal('gd') = 0.12 表示 +12%
function affixTotal(k) {
  let t = 0;
  for (const s in S.eq) {
    const it = S.eq[s];
    if (it && it.affix) for (const a of it.affix) if (a.k === k) t += affixVal(it, a);
  }
  return t;
}
const affixPerfect = it => (it.affix || []).filter(a => a.q >= AFFIX_PERFECT).length;

function rerollCost(it) { return { g: Math.round(300 * ((it.tier | 0) + 1) * (1 + (it.reqLvl || 1) / 25)), mat: 4 * ((it.tier | 0) + 1) }; }
// 重铸词条：金币 + 碎晶，全部词条重新随机（旧存档里没有词条的装备也能重铸出词条）
function rerollAffix(it) {
  if (!it) return;
  const c = rerollCost(it);
  if (S.g < c.g) { bagNotice = '重铸金币不足！需要 ' + c.g.toLocaleString() + ' G'; bagNoticeT = 1.8; return; }
  if (S.mat < c.mat) { bagNotice = '重铸碎晶不足！需要 ' + c.mat + ' 碎晶'; bagNoticeT = 1.8; return; }
  S.g -= c.g; S.mat -= c.mat;
  it.affix = rollAffixes(it.tier | 0, it.reqLvl || 1);
  recalcItem(it);
  ps().rr++;
  calc(); save();
  const pf = affixPerfect(it);
  bagNotice = it.affix.length ? '♻ 重铸完成：' + it.affix.length + ' 条词条' + (pf ? '（含 ' + pf + ' 条完美！）' : '') : '♻ 重铸完成：这次没有词条…再试试？';
  bagNoticeT = 2.4;
}

function genItem(slot, tier, lvl = 1) {
  const slotKeys = Object.keys(SLOTS);
  if (!slot) slot = slotKeys[(Math.random() * slotKeys.length) | 0];
  if (tier === undefined) tier = 0;
  const names = ITEM_NAMES[slot][tier];
  const name = names[(Math.random() * names.length) | 0];
  const mul = TIERS[tier].mul;

  // 需求等级与最高 500 级基准计算
  const reqLvl = Math.max(1, Math.min(500, lvl | 0));
  const b = reqLvl;

  const s = { atk: 0, hp: 0, mp: 0, crit: 0, def: 0 };
  if (slot === 'weapon') {
    s.atk = Math.round((10 + b * 5.2) * mul);
    if (tier >= 2) s.crit = +(0.02 + tier * 0.015).toFixed(3);
  } else if (slot === 'chest') {
    s.hp = Math.round((60 + b * 32) * mul);
    s.def = Math.round((2 + tier * 1.5 + b * 0.5) * mul);
  } else if (slot === 'necklace') {
    s.mp = Math.round((25 + b * 14) * mul);
    s.atk = Math.round((4 + b * 1.8) * mul);
    if (tier >= 3) s.crit = +(0.03 + tier * 0.01).toFixed(3);
  } else if (slot === 'ring') {
    s.atk = Math.round((6 + b * 3.2) * mul);
    s.crit = +(0.02 + tier * 0.02).toFixed(3);
  } else if (slot === 'belt') {
    s.atk = Math.round((5 + b * 2.2) * mul);
    s.hp = Math.round((40 + b * 18) * mul);
    s.mp = Math.round((30 + b * 16) * mul);
  } else if (slot === 'legs') {
    s.hp = Math.round((50 + b * 25) * mul);
    s.def = Math.round((1 + tier * 1.2 + b * 0.4) * mul);
  } else if (slot === 'boots') {
    s.hp = Math.round((30 + b * 15) * mul);
    s.atk = Math.round((3 + b * 1.2) * mul);
    if (tier >= 1) s.crit = +(0.01 + tier * 0.01).toFixed(3);
  }

  // 装备数值整体削减（EQ_K）
  for (const k in s) s[k] = k === 'crit' ? +(s[k] * EQ_K).toFixed(3) : Math.round(s[k] * EQ_K);

  const it = {
    v: 2,
    id: 'eq_' + (++uid) + '_' + Math.random().toString(36).slice(2, 7),
    name,
    slot,
    tier,
    lvl: 0,
    star: 0,
    reqLvl,
    baseStats: s,
    stats: { ...s }
  };
  it.affix = rollAffixes(tier, reqLvl);   // 词条（见上方词条系统）
  recalcItem(it);
  return it;
}


// ===== 强化 / 升星 / 分解 公共计算 =====
const MAX_STAR = 5;                 // 满星 5 星
const STAR_BONUS = 0.15;            // 每星全属性 +25%
const UP_BONUS = 0.08;              // 每级强化基础属性 +12%
const starStr = it => '⭐'.repeat(it.star | 0) + '☆'.repeat(MAX_STAR - (it.star | 0));

// 统一重算装备属性 = 基础 × 强化加成 × 星级加成（暴击率保留小数，不再被取整成 0）
function recalcItem(it) {
  const m = (1 + (it.lvl | 0) * UP_BONUS) * (1 + (it.star | 0) * STAR_BONUS);
  for (const k in it.baseStats) {
    const b = it.baseStats[k];
    it.stats[k] = !b ? 0 : k === 'crit' ? +(b * m).toFixed(3) : Math.round(b * m);
  }
  // 属性类词条并入 stats（特殊词条见 affixTotal）
  if (it.affix) for (const a of it.affix) {
    const d = AFFIX_DEFS[a.k];
    if (d && d.stat) it.stats[a.k] = a.k === 'crit' ? +((it.stats[a.k] || 0) + affixVal(it, a)).toFixed(3) : (it.stats[a.k] || 0) + affixVal(it, a);
  }
}

// 强化消耗：金币 + 碎晶 + 强化卷轴（每 5 级强化，多 1 张卷轴）
function upgradeCost(it) {
  return { g: (it.lvl + 1) * 60 * (it.tier + 1), mat: (it.lvl + 1) * Math.max(1, it.tier), scr: 1 + (((it.lvl | 0) / 5) | 0) };
}

// 升星消耗：金币 + 2 件「同名 & 同品质」的背包装备（自动挑投入最少的）
function starCost(it) { return Math.round(((it.star | 0) + 1) * (it.tier + 1) * 250 * (1 + (it.reqLvl || 1) / 40)); }
function starMats(it) {
  return S.inv
    .filter(o => o.id !== it.id && !o.locked && o.name === it.name && o.tier === it.tier)
    .sort((a, b) => ((a.lvl | 0) + (a.star | 0) * 3) - ((b.lvl | 0) + (b.star | 0) * 3));
}

// 分解收益（星级越高返还越多）
function dismantleValue(it) {
  const st = it.star | 0, sc = TIERS[it.tier].scrap;
  return { g: (it.tier + 1) * 45 + (it.lvl | 0) * 40 + st * (it.tier + 1) * 120, mat: sc + (it.lvl | 0) * 2 + st * sc * 2 };
}

// 装备综合评分（用于判断“是否比身上这件更强”），可按喜好调整权重
const itemScore = it => { const s = it.stats || {}; return (s.atk || 0) + (s.hp || 0) * .15 + (s.mp || 0) * .1 + (s.crit || 0) * 400 + (s.def || 0) * 8 };
// 相对当前穿戴：槽位空 = 提升；否则综合评分更高 = 提升
function isUpgrade(it) { const cur = S.eq[it.slot]; return !cur || cpDelta(it) > 0 }   // 以战力变化为准（见 power.js）

// 背包交互、批量操作与选择状态
let bagPage = 0, bagFilter = 'all', selItem = null, bagNotice = '', bagNoticeT = 0;
// 状态筛选（可叠加）：只看「比身上更强」的 / 只看「当前等级能穿」的；两个都开 = 现在就能穿且更强
let bagUp = false, bagWear = false;
const canWearNow = it => (it.reqLvl || 1) <= S.lv;
function bagList(slot = bagFilter, up = bagUp, wear = bagWear) {
  return S.inv.filter(it => (slot === 'all' || it.slot === slot) && (!up || isUpgrade(it)) && (!wear || canWearNow(it)));
}
const batchSel = new Set(); // 批量选中的装备 ID 集合
let bagMulti = false;       // 多选模式：开启后点格子=勾选（不再靠点小方框，手机不易误触）
let bagArmKey = '', bagArmUntil = 0;   // 危险操作二次确认

// 危险操作：第一次点击只提示，2.2 秒内再点一次才执行
function bagConfirm(key, msg, fn) {
  if (bagArmKey === key && T < bagArmUntil) { bagArmKey = ''; fn(); }
  else { bagArmKey = key; bagArmUntil = T + 2.2; bagNotice = msg; bagNoticeT = 2.2; }
}

function toggleBatchSel(id) {
  const it = S.inv.find(o => o.id === id);
  if (it && it.locked) { bagNotice = '🔒 「' + it.name + '」已锁定，无法勾选（先解锁）'; bagNoticeT = 1.8; return; }
  if (batchSel.has(id)) batchSel.delete(id);
  else batchSel.add(id);
}

// 锁定 / 解锁（锁定的装备不能被分解、丢弃，也不会被当作升星素材）
function toggleLock(item) {
  if (!item) return;
  item.locked = !item.locked;
  batchSel.delete(item.id); bagArmKey = '';
  save();
  bagNotice = item.locked ? '🔒 已锁定：不会被分解 / 丢弃 / 用作升星素材' : '🔓 已解锁'; bagNoticeT = 1.8;
}

// 批量锁定：已选装备全部已锁定 → 批量解锁，否则批量锁定
function batchLock() {
  const items = S.inv.filter(it => batchSel.has(it.id));
  if (!items.length) return;
  const lockAll = !items.every(it => it.locked);
  items.forEach(it => { it.locked = lockAll; });
  batchSel.clear(); save();
  bagNotice = (lockAll ? '🔒 已锁定 ' : '🔓 已解锁 ') + items.length + ' 件装备'; bagNoticeT = 2.0;
}

function selectAllBatch(list) {
  const unequipped = list.filter(it => !it.locked && S.inv.some(invItem => invItem.id === it.id));
  const allIn = unequipped.length > 0 && unequipped.every(it => batchSel.has(it.id));
  if (allIn) {
    unequipped.forEach(it => batchSel.delete(it.id));
    bagNotice = '已取消当前勾选'; bagNoticeT = 1.2;
  } else {
    unequipped.forEach(it => batchSel.add(it.id));
    const lk = list.filter(it => it.locked).length;
    bagNotice = '已全选当前列表装备 (' + batchSel.size + ' 件)' + (lk ? '，已跳过 ' + lk + ' 件锁定' : ''); bagNoticeT = 1.8;
  }
}

function batchDismantle() {
  if (batchSel.size === 0) return;
  let totalG = 0, totalMat = 0, count = 0;
  const toDelete = new Set();

  let skipped = 0;
  S.inv.forEach(it => {
    if (batchSel.has(it.id)) {
      if (it.locked) { skipped++; return; }
      const v = dismantleValue(it);
      totalG += v.g;
      totalMat += v.mat;
      toDelete.add(it.id);
      count++;
    }
  });

  if (count === 0) { bagNotice = skipped ? '所选装备均已锁定，未分解' : '未选中任何背包中的闲置装备'; bagNoticeT = 1.5; return; }

  S.g += totalG; psGold(totalG);
  S.mat += totalMat;
  S.inv = S.inv.filter(it => !toDelete.has(it.id));
  batchSel.clear();
  selItem = null;
  calc(); save();
  ps().dis += count;
  bagNotice = `批量分解 ${count} 件！获得 ${totalG} G 与 ${totalMat} 碎晶`; bagNoticeT = 2.5;
}

function batchDiscard() {
  if (batchSel.size === 0) return;
  const kill = new Set(S.inv.filter(it => batchSel.has(it.id) && !it.locked).map(it => it.id));
  const count = kill.size;
  if (!count) { bagNotice = '所选装备均已锁定，未丢弃'; bagNoticeT = 1.5; return; }
  S.inv = S.inv.filter(it => !kill.has(it.id));
  batchSel.clear();
  selItem = null;
  save();
  bagNotice = `已批量丢弃 ${count} 件装备！`; bagNoticeT = 2.0;
}

function equipItem(item) {
  if (!item) return;
  if (item.reqLvl && S.lv < item.reqLvl) {
    bagNotice = `穿戴失败：等级不足！需要 Lv.${item.reqLvl} (当前 Lv.${S.lv})`;
    bagNoticeT = 2.2;
    return;
  }
  const slot = item.slot;
  const oldEq = S.eq[slot];
  S.eq[slot] = item;
  S.inv = S.inv.filter(it => it.id !== item.id);
  batchSel.delete(item.id);
  if (oldEq) S.inv.push(oldEq);
  selItem = { item, from: 'eq', slotKey: slot };
  calc(); save();
  bagNotice = '已成功穿戴: ' + item.name; bagNoticeT = 1.8;
}

function unequipItem(slotKey) {
  const item = S.eq[slotKey];
  if (!item) return;
  S.inv.push(item);
  S.eq[slotKey] = null;
  selItem = { item, from: 'inv' };
  calc(); save();
  bagNotice = '已卸下装备放入背包'; bagNoticeT = 1.8;
}

function upgradeItem(item) {
  if (!item) return;
  const c = upgradeCost(item);
  if (S.g < c.g) { bagNotice = '强化金币不足！'; bagNoticeT = 1.8; return; }
  if (S.mat < c.mat) { bagNotice = '强化碎晶不足！请分解闲置装备获得'; bagNoticeT = 1.8; return; }
  if ((S.scr || 0) < c.scr) { bagNotice = '强化卷轴不足！(需 ' + c.scr + ' 张，打怪掉落 / 药铺有售)'; bagNoticeT = 2.4; return; }

  S.g -= c.g;
  S.mat -= c.mat;
  S.scr -= c.scr;
  item.lvl++;
  recalcItem(item);
  calc(); save();
  ps().up++;
  bagNotice = '★ 强化成功！当前强化 +' + item.lvl; bagNoticeT = 2.0;
}

// 升星：消耗 2 件同名同品质装备 + 金币，星级 +1（最高 5 星）
function starUpItem(item) {
  if (!item) return;
  const st = item.star | 0;
  if (st >= MAX_STAR) { bagNotice = '⭐ 已经是满星（5星）装备！'; bagNoticeT = 1.8; return; }
  const cost = starCost(item), mats = starMats(item);
  if (mats.length < 2) { bagNotice = '升星需要背包里另有 2 件「同名同品质」装备（现有 ' + mats.length + ' 件）'; bagNoticeT = 2.6; return; }
  if (S.g < cost) { bagNotice = '升星金币不足！需要 ' + cost + ' G'; bagNoticeT = 1.8; return; }

  const use = new Set([mats[0].id, mats[1].id]);
  S.g -= cost;
  S.inv = S.inv.filter(it => !use.has(it.id));
  use.forEach(id => batchSel.delete(id));
  item.star = st + 1;
  recalcItem(item);
  calc(); save();
  bagNotice = '⭐ 升星成功！' + starStr(item) + '（消耗 2 件同名装备）'; bagNoticeT = 2.4;
}

function dismantleItem(item) {
  if (!item) return;
  if (item.locked) { bagNotice = '🔒 该装备已锁定，请先解锁再分解'; bagNoticeT = 1.8; return; }
  if (selItem && selItem.from === 'eq') { bagNotice = '请先卸下该装备后再进行分解！'; bagNoticeT = 1.8; return; }
  const v = dismantleValue(item);
  const gGain = v.g;
  const matGain = v.mat;
  S.g += gGain; psGold(gGain);
  S.mat += matGain;
  S.inv = S.inv.filter(it => it.id !== item.id);
  batchSel.delete(item.id);
  selItem = null;
  calc(); save();
  ps().dis++;
  bagNotice = '分解成功！获得 ' + gGain + 'G 与 ' + matGain + ' 强化碎晶'; bagNoticeT = 2.2;
}

function discardItem(item) {
  if (!item) return;
  if (item.locked) { bagNotice = '🔒 该装备已锁定，请先解锁再丢弃'; bagNoticeT = 1.8; return; }
  if (selItem && selItem.from === 'eq') { bagNotice = '穿戴中的装备无法丢弃，请先卸下！'; bagNoticeT = 1.8; return; }
  S.inv = S.inv.filter(it => it.id !== item.id);
  batchSel.delete(item.id);
  selItem = null;
  save();
  bagNotice = '已丢弃该装备'; bagNoticeT = 1.8;
}

// ===== 旧存档迁移：把旧版（v1）装备的基础属性按新倍率削减一次 =====
(function migrateEquip() {
  const fix = it => {
    if (!it || it.v === 2 || !it.baseStats) return;
    const t = it.tier | 0, k = TIERS[t].mul / TIER_MUL_OLD[t] * EQ_K;
    for (const key in it.baseStats) {
      const b = it.baseStats[key]; if (!b) continue;
      it.baseStats[key] = key === 'crit' ? +(b * EQ_K).toFixed(3) : Math.max(1, Math.round(b * k));
    }
    it.v = 2; recalcItem(it);
  };
  (S.inv || []).forEach(fix);
  for (const s in (S.eq || {})) fix(S.eq[s]);
})();

// 初始赠送体验装备（放在文件末尾：genItem 依赖上面所有常量都已初始化）
if (S.inv.length === 0 && !S.eq.weapon) {
  S.eq.weapon = genItem('weapon', 1, 1);
  S.eq.belt = genItem('belt', 1, 1);
  S.inv.push(genItem('chest', 0, 1));
  S.inv.push(genItem('necklace', 1, 1));
  S.inv.push(genItem('ring', 0, 1));
  S.inv.push(genItem('legs', 0, 1));
  S.inv.push(genItem('boots', 1, 1));
}
