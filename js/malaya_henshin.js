// ===== 假面骑士 Malaya 原生变身时间轴与粒子特效 =====
const MALAYA_AUDIO_LEN = 4.69;

const MALAYA_TL = {
  henshin: 0.00,
  insert:  0.55,
  charge:  1.15,
  name:    2.40,
  lock:    3.15,
  eyes:    3.45,
  burst:   3.70,
  land:    4.05,
  stand:   4.35,
  done:    4.69
};

// 变身表关键帧序列：[时刻, 帧索引, 是否硬切]
const MALAYA_KEYS = [
  [0.00, 0, 0],
  [0.35, 1, 0],
  [0.55, 2, 1], // 插卡点亮
  [0.90, 3, 0],
  [1.15, 4, 1], // 花瓣风暴
  [1.45, 5, 0],
  [1.75, 6, 1], // 地面起火
  [2.05, 7, 0],
  [2.40, 8, 1], // 唱名烈焰
  [2.80, 9, 0], // 烈焰内聚
  [3.15, 10, 1], // 机甲锁定
  [3.45, 11, 1], // 眼部星芒
  [3.70, 12, 1], // 大红花图腾大爆发
  [4.05, 13, 1], // 单膝冲击
  [4.35, 14, 0], // 起身收势
  [4.55, 15, 0]  // 待机完成
];

// 音效控制器
let SND_MALAYA = null;
(function initMalayaSound() {
  const tryFiles = [
    'Kamen Rider Malaya Henshin.m4a',
    'Kamen_Rider_Malaya_Henshin.m4a',
    'Kamen Rider Malaya Henshin.mp3',
    'Kamen_Rider_Malaya_Henshin.mp3'
  ];
  let i = 0;
  const next = () => {
    if (i >= tryFiles.length) return;
    const a = new Audio();
    a.preload = 'auto';
    a.addEventListener('error', next, { once: true });
    a.src = encodeURI(A + 'SoundFX/' + tryFiles[i++]);
    SND_MALAYA = a;
  };
  next();
})();

function playMalayaHenshin() {
  if (!SND_MALAYA) return;
  try {
    SND_MALAYA.currentTime = 0;
    const p = SND_MALAYA.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {}
}

function stopMalayaHenshin() {
  if (SND_MALAYA && !SND_MALAYA.paused) SND_MALAYA.pause();
}

function malayaTransDur() {
  return (SND_MALAYA && isFinite(SND_MALAYA.duration) && SND_MALAYA.duration > 0.5)
    ? SND_MALAYA.duration
    : MALAYA_AUDIO_LEN;
}

// 平滑补帧计算
function malayaFrameAt(s) {
  let j = 0;
  while (j + 1 < MALAYA_KEYS.length && MALAYA_KEYS[j + 1][0] <= s) j++;
  const a = MALAYA_KEYS[j], b = MALAYA_KEYS[j + 1];
  if (!b || b[2]) return { a: a[1], b: a[1], e: 0 };
  const span = b[0] - a[0];
  const t = cl((s - a[0]) / span, 0, 1);
  return { a: a[1], b: b[1], e: t * t * (3 - 2 * t) };
}

// 变身视觉特效
function malayaTransFx(x, y, s, pass, f) {
  const L = MALAYA_TL, belt = y - 98;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  if (pass === 0) {
    // [Pass 0: 角色身后] 蓄力烈焰旋风、地面火环与上升大红花瓣
    if (s >= L.charge && s < L.lock) {
      const p = (s - L.charge) / (L.lock - L.charge);
      // 地面光环涟漪
      for (let k = 0; k < 2; k++) {
        const ph = (s * 1.5 + k * 0.5) % 1;
        const rad = 30 + ph * 190;
        ctx.strokeStyle = `rgba(255, 90, 40, ${((1 - ph) * 0.7 * p).toFixed(3)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(x, y + 2, rad, rad * 0.2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // 围绕周身螺旋升腾的花瓣与火星
      for (let i = 0; i < 30; i++) {
        const ph = (s * 1.3 + i * 0.137) % 1;
        const ang = s * 4.0 + i * 0.65;
        const px = x + Math.cos(ang) * (65 + ph * 35);
        const py = y - 10 - ph * 230;
        ctx.fillStyle = i % 2 === 0 ? `rgba(255, 50, 60, ${1 - ph})` : `rgba(255, 215, 60, ${1 - ph})`;
        ctx.beginPath();
        ctx.arc(px, py, 2 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    // [Pass 1: 角色身前] 插槽闪光、复眼点亮星芒与终极图腾爆发
    // 1. 腰带扣合耀斑 (0.55s)
    const insAge = s - L.insert;
    if (insAge >= 0 && insAge < 0.35) {
      const p = insAge / 0.35;
      const gr = ctx.createRadialGradient(x, belt, 0, x, belt, 30 + p * 130);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.3, 'rgba(255, 215, 0, 0.85)');
      gr.addColorStop(1, 'rgba(255, 70, 0, 0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(x, belt, 30 + p * 130, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. 双眼点亮十字星芒 (3.45s - 3.70s 对应第 11 帧)
    if (s >= L.eyes && s < L.burst) {
      const eyeAge = s - L.eyes;
      const eyeY = y - 176;
      const flare = Math.sin((eyeAge / 0.25) * Math.PI) * 1.3;
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5 * flare;
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(x - 42 * flare, eyeY); ctx.lineTo(x + 42 * flare, eyeY);
      ctx.moveTo(x, eyeY - 26 * flare); ctx.lineTo(x, eyeY + 26 * flare);
      ctx.stroke();
      ctx.restore();
    }

    // 3. 大红花图腾大爆发 (3.70s)
    const burstAge = s - L.burst;
    if (burstAge >= 0 && burstAge < 0.85) {
      const p = burstAge / 0.85;
      const r = 40 + p * 420;
      ctx.strokeStyle = `rgba(255, 75, 43, ${(1 - p).toFixed(3)})`;
      ctx.lineWidth = 6 * (1 - p) + 1;
      ctx.beginPath();
      ctx.ellipse(x, y - 90, r, r * 0.8, 0, 0, Math.PI * 2);
      ctx.stroke();

      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        const dist = r * (0.8 + 0.3 * Math.sin(i * 3));
        ctx.fillStyle = `rgba(255, ${40 + (i % 4) * 40}, 50, ${((1 - p) * 0.9).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * dist, (y - 90) + Math.sin(a) * dist, 3 + (i % 4), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

// 变身绘制主入口
function drawMalayaTransform(x, y, f) {
  const S_ = SH.trans;
  if (!okS(S_)) return;

  const s = P.t;
  const fr = malayaFrameAt(s);

  // 1. 身后特效
  malayaTransFx(x, y, s, 0, f);

  // 2. 补帧绘制骑士本体
  ctx.save();
  ctx.shadowColor = '#ff4757';
  ctx.shadowBlur = s >= MALAYA_TL.burst ? 22 : s >= MALAYA_TL.charge ? 12 : 4;
  const bob = Math.sin(T * 2.4) * (s < MALAYA_TL.burst ? 0.8 : 1.4);
  if (fr.a === fr.b) {
    drC(S_, fr.a, x, y + bob, f);
  } else {
    drC(S_, fr.a, x, y + bob, f, 1, 1 - fr.e);
    drC(S_, fr.b, x, y + bob, f, 1, fr.e);
  }
  ctx.restore();

  // 3. 身前特效
  malayaTransFx(x, y, s, 1, f);

  // 4. 爆发瞬间白光淡出
  const bAge = s - MALAYA_TL.burst;
  if (bAge >= 0 && bAge < 0.28) {
    const a = (1 - bAge / 0.28) * 0.55;
    ctx.save();
    ctx.fillStyle = `rgba(255, 255, 255, ${a.toFixed(3)})`;
    ctx.fillRect(0, 0, 960, 540);
    ctx.restore();
  }
}

// 音频时钟同步与节拍事件
function updMalayaTrans(dt) {
  if (SND_MALAYA && !SND_MALAYA.paused && SND_MALAYA.currentTime > 0.02) {
    P.t = SND_MALAYA.currentTime;
  }
  const s = P.t;
  const h = P.hit;
  const fire = (id, t, fn) => { if (s >= t && !h[id]) { h[id] = 1; if (!(t < (P.sk || 0))) fn(); } };

  fire('henshin', MALAYA_TL.henshin, () => {
    DT.push({ x: P.x, y: P.y - 210, s: 'HENSHIN!', t: 1.2, c: '#ffd84a' });
  });
  fire('insert', MALAYA_TL.insert, () => {
    shake = Math.max(shake, 6);
  });
  fire('name', MALAYA_TL.name, () => {
    shake = Math.max(shake, 10);
    DT.push({ x: P.x, y: P.y - 210, s: 'KAMEN RIDER MALAYA', t: 1.4, c: '#ff4757' });
  });
  fire('eyes', MALAYA_TL.eyes, () => {
    shake = Math.max(shake, 8);
  });
  fire('burst', MALAYA_TL.burst, () => {
    shake = 26;
    if (G === 'play') area(P.x - 360, P.x + 360, P.atk * 3.5);
    DT.push({ x: P.x, y: P.y - 210, s: 'BUNGA RAYA BURST · 觉醒！', t: 1.8, c: '#ff3838' });
    FX.push({ type: 'boom', x: P.x, y: GY - 60, t: 0.7, d: 0.7, r: 320, c: '#ff3838' });
  });
}