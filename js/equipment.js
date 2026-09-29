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
  { id: 1, n: '优质', c: '#00d2d3', bg: 'rgba(0,210,211,0.25)', mul: 1.4, scrap: 2 },
  { id: 2, n: '稀有', c: '#2e86de', bg: 'rgba(46,134,222,0.28)', mul: 2.0, scrap: 4 },
  { id: 3, n: '史诗', c: '#a55eea', bg: 'rgba(165,94,234,0.32)', mul: 3.0, scrap: 8 },
  { id: 4, n: '传说', c: '#ffd32a', bg: 'rgba(255,211,42,0.36)', mul: 4.6, scrap: 16 },
  { id: 5, n: '神话', c: '#ff3838', bg: 'rgba(255,56,56,0.42)', mul: 6.8, scrap: 32 }
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

  return {
    id: 'eq_' + (++uid) + '_' + Math.random().toString(36).slice(2, 7),
    name,
    slot,
    tier,
    lvl: 0,
    reqLvl,
    baseStats: s,
    stats: { ...s }
  };
}

// 初始赠送体验装备
if (S.inv.length === 0 && !S.eq.weapon) {
  S.eq.weapon = genItem('weapon', 1, 1);
  S.eq.belt = genItem('belt', 1, 1);
  S.inv.push(genItem('chest', 0, 1));
  S.inv.push(genItem('necklace', 1, 1));
  S.inv.push(genItem('ring', 0, 1));
  S.inv.push(genItem('legs', 0, 1));
  S.inv.push(genItem('boots', 1, 1));
}

// 背包交互、批量操作与选择状态
let bagPage = 0, bagFilter = 'all', selItem = null, bagNotice = '', bagNoticeT = 0;
const batchSel = new Set(); // 批量选中的装备 ID 集合

function toggleBatchSel(id) {
  if (batchSel.has(id)) batchSel.delete(id);
  else batchSel.add(id);
}

function selectAllBatch(list) {
  const unequipped = list.filter(it => S.inv.some(invItem => invItem.id === it.id));
  const allIn = unequipped.length > 0 && unequipped.every(it => batchSel.has(it.id));
  if (allIn) {
    unequipped.forEach(it => batchSel.delete(it.id));
    bagNotice = '已取消当前勾选'; bagNoticeT = 1.2;
  } else {
    unequipped.forEach(it => batchSel.add(it.id));
    bagNotice = '已全选当前列表装备 (' + batchSel.size + ' 件)'; bagNoticeT = 1.5;
  }
}

function batchDismantle() {
  if (batchSel.size === 0) return;
  let totalG = 0, totalMat = 0, count = 0;
  const toDelete = new Set();

  S.inv.forEach(it => {
    if (batchSel.has(it.id)) {
      totalG += (it.tier + 1) * 45 + it.lvl * 40;
      totalMat += TIERS[it.tier].scrap + it.lvl * 2;
      toDelete.add(it.id);
      count++;
    }
  });

  if (count === 0) { bagNotice = '未选中任何背包中的闲置装备'; bagNoticeT = 1.5; return; }

  S.g += totalG;
  S.mat += totalMat;
  S.inv = S.inv.filter(it => !toDelete.has(it.id));
  batchSel.clear();
  selItem = null;
  calc(); save();
  bagNotice = `批量分解 ${count} 件！获得 ${totalG} G 与 ${totalMat} 碎晶`; bagNoticeT = 2.5;
}

function batchDiscard() {
  if (batchSel.size === 0) return;
  const count = batchSel.size;
  S.inv = S.inv.filter(it => !batchSel.has(it.id));
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
  const goldCost = (item.lvl + 1) * 60 * (item.tier + 1);
  const scrapCost = (item.lvl + 1) * Math.max(1, item.tier);
  if (S.g < goldCost) { bagNotice = '强化金币不足！'; bagNoticeT = 1.8; return; }
  if (S.mat < scrapCost) { bagNotice = '强化碎晶不足！请分解闲置装备获得'; bagNoticeT = 1.8; return; }

  S.g -= goldCost;
  S.mat -= scrapCost;
  item.lvl++;
  for (const k in item.baseStats) {
    if (item.baseStats[k]) {
      item.stats[k] = Math.round(item.baseStats[k] * (1 + item.lvl * 0.12));
    }
  }
  calc(); save();
  bagNotice = '★ 强化成功！当前强化 +' + item.lvl; bagNoticeT = 2.0;
}

function dismantleItem(item) {
  if (!item) return;
  if (selItem && selItem.from === 'eq') { bagNotice = '请先卸下该装备后再进行分解！'; bagNoticeT = 1.8; return; }
  const gGain = (item.tier + 1) * 45 + item.lvl * 40;
  const matGain = TIERS[item.tier].scrap + item.lvl * 2;
  S.g += gGain;
  S.mat += matGain;
  S.inv = S.inv.filter(it => it.id !== item.id);
  batchSel.delete(item.id);
  selItem = null;
  calc(); save();
  bagNotice = '分解成功！获得 ' + gGain + 'G 与 ' + matGain + ' 强化碎晶'; bagNoticeT = 2.2;
}

function discardItem(item) {
  if (!item) return;
  if (selItem && selItem.from === 'eq') { bagNotice = '穿戴中的装备无法丢弃，请先卸下！'; bagNoticeT = 1.8; return; }
  S.inv = S.inv.filter(it => it.id !== item.id);
  batchSel.delete(item.id);
  selItem = null;
  save();
  bagNotice = '已丢弃该装备'; bagNoticeT = 1.8;
}