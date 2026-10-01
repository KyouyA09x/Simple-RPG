// Campfire scene backdrop. The sky follows the real in-game clock: the hero rests until the next morning, so the
// scene fast-forwards from the current time to dawn (and the day counter ticks over at midnight, exactly like the HUD).
// The landscape, ground and drifting particles match the biome the hero is about to wake up in.

const CAMP_WAKE = 0.34;                       // the hero wakes at about 08:10

// Where the clock goes during a camp: from `tod0` to the next morning (at least six hours of rest).
function campPlan(tod0, day0) {
  let d = (((CAMP_WAKE - tod0) % 1) + 1) % 1;
  if (d < 0.25) d += 1;
  const end = tod0 + d;
  return { t0: tod0, delta: d, day0, endTod: end % 1, endDay: day0 + Math.floor(end) };
}
// the clock p (0..1) of the way through the rest
function campClock(plan, p) {
  const at = plan.t0 + plan.delta * Math.max(0, Math.min(1, p));
  return { tod: at % 1, day: plan.day0 + Math.floor(at + 1e-9) };
}
const campClockLabel = tod => {
  const mins = Math.floor(tod * 1440) % 1440, h = Math.floor(mins / 60), m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};
const campPhase = tod => (tod < 0.26 || tod >= 0.84) ? 'Night' : tod < 0.36 ? 'Dawn' : tod < 0.70 ? 'Day' : 'Dusk';

// sky colours by biome: top and horizon by day, top and horizon by night
const CAMP_SKY = {
  forest:    ['#4a8fd0', '#bfe0ef', '#050814', '#1d1a2a'],
  desert:    ['#4d93d6', '#f0d8a8', '#080a18', '#2a2030'],
  snow:      ['#6a9fd0', '#d4e4f0', '#060b1a', '#1c2438'],
  volcano:   ['#6a5a60', '#c8836a', '#120608', '#3a1610'],
  swamp:     ['#6a9a98', '#a6c2a0', '#050c0c', '#0f1c16'],
  jungle:    ['#3f9ad0', '#b4e4d0', '#04100c', '#12281e'],
  ruins:     ['#6c7aa0', '#aab0c8', '#060612', '#1a1a2c'],
  highlands: ['#5c9ad4', '#c4d8ea', '#060a18', '#1a2236'],
};

let _campMoon = null;                          // the crescent is cut out once on its own little canvas (cutting on the main canvas would erase the sky)
function campMoon() {
  if (_campMoon) return _campMoon;
  const c = document.createElement('canvas'); c.width = c.height = 56; const g = c.getContext('2d');
  g.fillStyle = '#f4efd8'; g.beginPath(); g.arc(28, 28, 24, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(38, 22, 21, 0, Math.PI * 2); g.fill();
  return (_campMoon = c);
}
function campDraw(B, ck, t) {
  const key = B.key, S = CAMP_SKY[key] || CAMP_SKY.forest;
  const sky = skyNow(ck.tod), d = Math.max(0, Math.min(1, sky.dark / 0.38));       // 0 = full day, 1 = deep night
  const H = VH * 0.6;
  // ---- sky ----
  const g = ctx.createLinearGradient(0, 0, 0, H + 40);
  g.addColorStop(0, mixHex(S[0], S[2], d)); g.addColorStop(1, mixHex(S[1], S[3], d));
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  const glow = Math.max(0, 1 - Math.abs(sky.dark - 0.19) / 0.13) * (sky.c[0] > 200 ? 1 : 0);     // sunrise / sunset band
  if (glow > 0.01) {
    const hg = ctx.createLinearGradient(0, H - VH * 0.34, 0, H + 10);
    hg.addColorStop(0, `rgba(${sky.c[0]},${sky.c[1]},${sky.c[2]},0)`); hg.addColorStop(1, `rgba(${sky.c[0]},${sky.c[1]},${sky.c[2]},${0.62 * glow})`);
    ctx.fillStyle = hg; ctx.fillRect(0, H - VH * 0.34, VW, VH * 0.34 + 10);
  }
  const starA = Math.max(0, Math.min(1, (sky.dark - 0.2) / 0.17));
  if (starA > 0.01) {
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 110; i++) {
      const sx = (i * 197.3) % VW, sy = (i * 83.7) % (VH * 0.55), big = i % 7 === 0;
      ctx.globalAlpha = starA * (0.35 + 0.65 * Math.abs(Math.sin(t * (0.4 + (i % 5) * 0.15) + i)));
      ctx.fillRect(sx, sy, big ? 2 : 1.2, big ? 2 : 1.2);
    }
    ctx.globalAlpha = 1;
  }
  // sun and moon travel their arcs with the clock (sun 06:00 to 18:00, moon the rest of the day)
  const arc = (u, r, col, halo) => {
    const x = VW * (0.08 + 0.84 * u), y = H - Math.sin(Math.PI * u) * VH * 0.46 + 6;
    if (halo) { const hg = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 4); hg.addColorStop(0, halo); hg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = hg; ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8); }
    if (col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
    return [x, y];
  };
  const tt = ck.tod;
  if (tt >= 0.25 && tt <= 0.75) arc((tt - 0.25) / 0.5, 22, '#fff4c8', 'rgba(255,235,170,0.35)');
  else {
    const u = ((tt - 0.75 + 1) % 1) / 0.5, [mx, my] = arc(u, 24, null, 'rgba(200,215,255,0.16)');
    ctx.drawImage(campMoon(), mx - 28, my - 28);                                                                      // a crescent
  }
  // ---- landscape ----
  const tone = (hex, base) => shadeHex(hex, -(base + 0.55 * d));
  const r = mulberry(0x51a7 + key.length * 977 + key.charCodeAt(0) * 31);
  const far = tone(mixHex(B.ground, S[1], 0.35), 0.18), mid = tone(B.patch, 0.12), near = tone(B.patch, 0.3);
  SCENERY[key] ? SCENERY[key](H, r, far, mid, near, d, t, B) : SCENERY.forest(H, r, far, mid, near, d, t, B);
  // ground
  const gy = VH * 0.64, grd = ctx.createLinearGradient(0, gy, 0, VH);
  grd.addColorStop(0, tone(B.ground, 0.15)); grd.addColorStop(1, tone(B.ground, 0.4));
  ctx.fillStyle = grd; ctx.fillRect(0, gy, VW, VH - gy);
  ctx.fillStyle = tone(B.patch2, 0.2);
  for (let i = 0; i < 120; i++) { const x = r() * VW, y = gy + 4 + r() * (VH - gy - 6); ctx.globalAlpha = 0.25 + r() * 0.3; ctx.fillRect(x, y, 2 + r() * 8, 1 + r() * 1.5); }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 26; i++) {                                                        // a few tufts and pebbles in the foreground
    const x = r() * VW, y = gy + 10 + r() * (VH - gy - 14), k = r();
    ctx.fillStyle = k < 0.5 ? tone(B.grass[0], 0.3) : tone(B.patch2, 0.35);
    if (k < 0.5) { ctx.fillRect(x, y - 5, 1.5, 5); ctx.fillRect(x + 3, y - 4, 1.5, 4); ctx.fillRect(x - 3, y - 3, 1.5, 3); } else { ctx.beginPath(); ctx.ellipse(x, y, 4, 2.4, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  return { d, sky };
}

// ---- silhouettes ----
const campPine = (x, y, h, col, cap) => {
  ctx.fillStyle = col; ctx.fillRect(x - 2, y - h * 0.18, 4, h * 0.18);
  for (let i = 0; i < 4; i++) { const w = h * (0.34 - i * 0.07), yy = y - h * 0.12 - i * h * 0.22; ctx.beginPath(); ctx.moveTo(x - w, yy); ctx.lineTo(x, yy - h * 0.34); ctx.lineTo(x + w, yy); ctx.fill(); }
  if (cap) { ctx.fillStyle = cap; for (let i = 0; i < 4; i++) { const w = h * (0.34 - i * 0.07), yy = y - h * 0.12 - i * h * 0.22; ctx.beginPath(); ctx.moveTo(x - w * 0.5, yy - h * 0.17); ctx.lineTo(x, yy - h * 0.34); ctx.lineTo(x + w * 0.5, yy - h * 0.17); ctx.fill(); } }
};
const campOak = (x, y, h, col) => {
  ctx.fillStyle = col; ctx.fillRect(x - 3, y - h * 0.55, 6, h * 0.55);
  for (const [dx, dy, rr] of [[0, 0.72, 0.36], [-0.26, 0.56, 0.27], [0.26, 0.58, 0.28], [0, 0.95, 0.24]]) { ctx.beginPath(); ctx.arc(x + dx * h, y - dy * h, rr * h, 0, Math.PI * 2); ctx.fill(); }
};
const campRidge = (H, r, col, amp, step, base = 0) => {
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H + 8);
  let y = H - base - amp * 0.5;
  for (let x = 0; x <= VW + step; x += step) { y = H - base - amp * (0.15 + r() * 0.85); ctx.lineTo(x, y); }
  ctx.lineTo(VW, H + 8); ctx.fill();
};
const campMist = (H, d, col, a) => {
  for (let i = 0; i < 3; i++) { const g = ctx.createLinearGradient(0, H - 30 + i * 22, 0, H + 20 + i * 22); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, withAlpha(col, a * (0.6 + 0.4 * d))); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, H - 30 + i * 22, VW, 70); }
};

const SCENERY = {
  forest(H, r, far, mid, near) {
    campRidge(H, r, far, 70, 46, 0);
    for (let i = 0; i < 22; i++) { const x = (i + r() * 0.8) * VW / 21; (i % 3 ? campPine : campOak)(x, H + 4, 50 + r() * 40, mid); }
    for (let i = 0; i < 12; i++) { const x = (i + r()) * VW / 11; (i % 2 ? campPine : campOak)(x, H + 22, 78 + r() * 50, near); }
  },
  desert(H, r, far, mid, near, d) {
    for (let i = 0; i < 3; i++) { const x = VW * (0.12 + i * 0.34 + r() * 0.1), w = 90 + r() * 70, h = 50 + r() * 40; ctx.fillStyle = far; ctx.beginPath(); ctx.moveTo(x - w, H + 8); ctx.lineTo(x - w * 0.8, H - h); ctx.lineTo(x + w * 0.6, H - h); ctx.lineTo(x + w, H + 8); ctx.fill(); }
    for (const [amp, col, off] of [[26, mid, 0], [20, near, 14]]) {
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, VH);
      for (let x = 0; x <= VW; x += 12) ctx.lineTo(x, H + 6 + off - amp * (0.5 + 0.5 * Math.sin(x * 0.011 + off) * Math.sin(x * 0.0031 + 1)));
      ctx.lineTo(VW, VH); ctx.fill();
    }
    ctx.fillStyle = near;
    for (let i = 0; i < 5; i++) {
      const x = VW * (0.06 + i * 0.22) + r() * 40, y = H + 20, h = 44 + r() * 30;
      ctx.fillRect(x - 4, y - h, 8, h); ctx.fillRect(x - 18, y - h * 0.55, 6, h * 0.3); ctx.fillRect(x - 18, y - h * 0.55, 14, 5); ctx.fillRect(x + 12, y - h * 0.7, 6, h * 0.34); ctx.fillRect(x + 4, y - h * 0.7, 14, 5);
    }
  },
  snow(H, r, far, mid, near, d) {
    campRidge(H, r, mixHex(far, '#ffffff', 0.35), 120, 70, 0);
    campRidge(H, r, far, 70, 40, 0);
    const cap = mixHex('#ffffff', mid, 0.25 + 0.5 * d);
    for (let i = 0; i < 20; i++) campPine((i + r() * 0.8) * VW / 19, H + 4, 56 + r() * 40, mid, cap);
    for (let i = 0; i < 10; i++) campPine((i + r()) * VW / 9, H + 24, 90 + r() * 50, near, mixHex('#ffffff', near, 0.4 + 0.4 * d));
  },
  volcano(H, r, far, mid, near, d, t) {
    campRidge(H, r, far, 50, 52, 0);
    const cx = VW * 0.28, top = H - 190, w = 260;                                   // the volcano itself
    ctx.fillStyle = mid; ctx.beginPath(); ctx.moveTo(cx - w, H + 8); ctx.lineTo(cx - 42, top); ctx.lineTo(cx - 14, top + 10); ctx.lineTo(cx + 18, top + 4); ctx.lineTo(cx + 44, top); ctx.lineTo(cx + w, H + 8); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const cg = ctx.createRadialGradient(cx, top + 4, 4, cx, top + 4, 120 + Math.sin(t * 2) * 6); cg.addColorStop(0, 'rgba(255,140,50,0.55)'); cg.addColorStop(1, 'rgba(255,60,20,0)'); ctx.fillStyle = cg; ctx.fillRect(cx - 130, top - 120, 260, 260);
    ctx.strokeStyle = 'rgba(255,110,40,0.7)'; ctx.lineWidth = 3;
    for (const [dx, k] of [[-10, 1], [8, 1.3], [28, 0.8]]) { ctx.beginPath(); ctx.moveTo(cx + dx * 0.4, top + 6); ctx.bezierCurveTo(cx + dx, top + 50 * k, cx + dx * 3, top + 90 * k, cx + dx * 4.5, H - 6); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = mid; for (let i = 0; i < 16; i++) { const x = r() * VW, h = 24 + r() * 46; ctx.beginPath(); ctx.moveTo(x - 14, H + 12); ctx.lineTo(x - 4, H - h); ctx.lineTo(x + 8, H - h * 0.7); ctx.lineTo(x + 16, H + 12); ctx.fill(); }
    ctx.fillStyle = near; for (let i = 0; i < 9; i++) { const x = (i + r()) * VW / 8, h = 46 + r() * 50; ctx.beginPath(); ctx.moveTo(x - 20, H + 26); ctx.lineTo(x - 8, H + 6 - h); ctx.lineTo(x + 6, H + 14 - h * 0.6); ctx.lineTo(x + 22, H + 26); ctx.fill(); }
  },
  swamp(H, r, far, mid, near, d, t, B) {
    campRidge(H, r, far, 50, 60, 0);
    const tree = (x, y, h, col) => {
      ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 5; const lean = (r() - 0.5) * 30;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + lean, y - h * 0.5, x + lean * 0.6, y - h); ctx.stroke();
      for (const [dx, dy, rx] of [[0, 0, 40], [-26, 8, 28], [28, 10, 30]]) { ctx.beginPath(); ctx.ellipse(x + lean * 0.6 + dx, y - h + dy, rx, rx * 0.4, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.lineWidth = 1.2; for (let i = 0; i < 9; i++) { const mx = x + lean * 0.6 - 36 + i * 9, ml = 12 + r() * 30; ctx.beginPath(); ctx.moveTo(mx, y - h + 10); ctx.lineTo(mx + Math.sin(t * 0.8 + i) * 2, y - h + 10 + ml); ctx.stroke(); }
    };
    for (let i = 0; i < 8; i++) tree((i + r() * 0.8) * VW / 7.5, H + 6, 90 + r() * 50, mid);
    campMist(H, d, mixHex(B.patch2, '#cfe8d0', 0.5), 0.22);
    for (let i = 0; i < 5; i++) tree((i + r() * 0.7) * VW / 4.5, H + 28, 130 + r() * 60, near);
    ctx.fillStyle = near; for (let i = 0; i < 40; i++) { const x = r() * VW, y = H + 24 + r() * 30, h = 14 + r() * 22; ctx.fillRect(x, y - h, 1.6, h); ctx.beginPath(); ctx.ellipse(x + 0.8, y - h, 2.2, 5, 0, 0, Math.PI * 2); ctx.fill(); }
  },
  jungle(H, r, far, mid, near) {
    campRidge(H, r, far, 70, 40, 0);
    const palm = (x, y, h, col, big) => {
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 6 * big; const lean = (r() - 0.5) * 24;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + lean * 0.4, y - h * 0.5, x + lean, y - h); ctx.stroke();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, L = 44 * big; ctx.beginPath(); ctx.moveTo(x + lean, y - h); ctx.quadraticCurveTo(x + lean + Math.cos(a) * L * 0.6, y - h - 16 * big + Math.sin(a) * 10, x + lean + Math.cos(a) * L, y - h + 10 * big + Math.sin(a) * 22 * big); ctx.lineWidth = 3.4 * big; ctx.stroke(); }
    };
    for (let i = 0; i < 16; i++) palm((i + r() * 0.8) * VW / 15, H + 6, 70 + r() * 60, mid, 0.8);
    for (let i = 0; i < 8; i++) palm((i + r() * 0.8) * VW / 7.5, H + 34, 120 + r() * 70, near, 1.3);
    ctx.strokeStyle = near; ctx.lineWidth = 1.4;
    for (let i = 0; i < 22; i++) { const x = r() * VW, l = 30 + r() * 80; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + (r() - 0.5) * 6, l); ctx.stroke(); }
  },
  ruins(H, r, far, mid, near, d, t) {
    campRidge(H, r, far, 56, 50, 0);
    const pillar = (x, y, h, w, col, broken) => {
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w / 2, y - h);
      if (broken) { ctx.lineTo(x - w * 0.1, y - h - 8); ctx.lineTo(x + w * 0.1, y - h + 6); ctx.lineTo(x + w / 2, y - h - 4); } else { ctx.lineTo(x + w / 2, y - h); ctx.fillRect(x - w * 0.8, y - h - 7, w * 1.6, 7); }
      ctx.lineTo(x + w / 2, y); ctx.fill(); ctx.fillRect(x - w * 0.7, y - 5, w * 1.4, 7);
    };
    for (let i = 0; i < 9; i++) pillar((i + r() * 0.8) * VW / 8.5, H + 6, 50 + r() * 60, 12 + r() * 6, mid, r() < 0.5);
    const ax = VW * 0.62; ctx.fillStyle = mid; ctx.beginPath(); ctx.moveTo(ax - 70, H + 8); ctx.lineTo(ax - 70, H - 90); ctx.arc(ax, H - 90, 70, Math.PI, 0); ctx.lineTo(ax + 70, H + 8); ctx.lineTo(ax + 50, H + 8); ctx.lineTo(ax + 50, H - 90); ctx.arc(ax, H - 90, 50, 0, Math.PI, true); ctx.lineTo(ax - 50, H + 8); ctx.fill();
    for (let i = 0; i < 7; i++) pillar((i + r() * 0.8) * VW / 6.5, H + 30, 80 + r() * 70, 16 + r() * 8, near, r() < 0.65);
    ctx.strokeStyle = near; ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) { const x = r() * VW, y = H + 30; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4, y - 60); ctx.moveTo(x + 4, y - 40); ctx.lineTo(x + 24, y - 66); ctx.moveTo(x + 4, y - 30); ctx.lineTo(x - 16, y - 52); ctx.stroke(); }
  },
  highlands(H, r, far, mid, near) {
    campRidge(H, r, mixHex(far, '#ffffff', 0.2), 150, 80, 0);
    campRidge(H, r, far, 100, 52, 0);
    campRidge(H, r, mid, 58, 36, 0);
    for (let i = 0; i < 8; i++) campPine((i + r()) * VW / 7.5, H + 22, 60 + r() * 40, near);
    ctx.fillStyle = near; for (let i = 0; i < 12; i++) { const x = r() * VW, y = H + 28 + r() * 16, w = 20 + r() * 26; ctx.beginPath(); ctx.moveTo(x - w, y + 8); ctx.lineTo(x - w * 0.5, y - w * 0.6); ctx.lineTo(x + w * 0.3, y - w * 0.8); ctx.lineTo(x + w, y + 8); ctx.fill(); }
  },
};

// ---- particles that drift through the scene (nothing is stored: positions come from the index and the time) ----
function campAmbient(B, t, d) {
  const key = B.key, hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  ctx.save();
  if (key === 'snow') {
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 90; i++) { const sp = 28 + hash(i) * 40, x = (hash(i + 9) * VW + Math.sin(t * 0.7 + i) * 24) % VW, y = (hash(i + 3) * VH + t * sp) % (VH + 10); ctx.globalAlpha = 0.5 + hash(i + 5) * 0.4; ctx.fillRect(x, y, 1.6 + hash(i + 1) * 1.6, 1.6 + hash(i + 1) * 1.6); }
  } else if (key === 'volcano') {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 46; i++) { const sp = 20 + hash(i) * 40, life = (t * sp + hash(i + 3) * 400) % 400, x = hash(i + 9) * VW + Math.sin(t + i) * 14, y = VH * 0.82 - life * 1.4; ctx.globalAlpha = (1 - life / 400) * 0.9; ctx.fillStyle = hash(i + 2) < 0.5 ? '#ff9a3a' : '#ff5a20'; ctx.fillRect(x, y, 2, 2); }
  } else if (key === 'ruins') {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) { const x = hash(i) * VW + Math.sin(t * 0.3 + i * 2) * 60, y = VH * (0.3 + hash(i + 4) * 0.4) + Math.sin(t * 0.5 + i) * 18, rr = 14 + hash(i + 8) * 10; const g = ctx.createRadialGradient(x, y, 1, x, y, rr); g.addColorStop(0, `rgba(170,220,255,${0.55 * d})`); g.addColorStop(1, 'rgba(170,220,255,0)'); ctx.fillStyle = g; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  } else if (key === 'forest' || key === 'jungle' || key === 'swamp') {
    ctx.globalCompositeOperation = 'lighter';
    const col = key === 'swamp' ? '150,255,170' : '230,240,120';
    for (let i = 0; i < 26; i++) { const x = hash(i) * VW + Math.sin(t * 0.4 + i * 3) * 40, y = VH * (0.45 + hash(i + 4) * 0.45) + Math.cos(t * 0.5 + i) * 20, a = d * (0.4 + 0.6 * Math.abs(Math.sin(t * 1.3 + i))); if (a < 0.03) continue; const g = ctx.createRadialGradient(x, y, 0, x, y, 7); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.fillRect(x - 7, y - 7, 14, 14); }
  } else {                                                                      // desert and highlands: wind-blown dust
    ctx.fillStyle = key === 'desert' ? '#e8d4a0' : '#d8dce4';
    for (let i = 0; i < 34; i++) { const sp = 60 + hash(i) * 90, x = (hash(i + 9) * VW + t * sp) % VW, y = VH * (0.5 + hash(i + 3) * 0.45); ctx.globalAlpha = 0.16 + hash(i + 5) * 0.2; ctx.fillRect(x, y, 6 + hash(i) * 12, 1.2); }
  }
  ctx.restore();
}
