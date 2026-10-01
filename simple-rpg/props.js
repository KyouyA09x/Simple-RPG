// Prop and decor art. Everything is drawn from shapes in code; each prop is one function of
// { x, y, s (scale), v (0..1 variation), ph (wind phase) }. Wind comes from the weather system (windMul()).

const TAU = Math.PI * 2;
const circ = (x, y, r, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
const ell = (x, y, rx, ry, fill, rot = 0) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); };
function fillPoly(pts, fill, stroke, lw = 1) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
const swayOf = (p, amt) => gfx.anim ? Math.sin(tAnim * 1.2 + p.ph) * amt * Math.min(2.2, windMul()) : 0;
const night01 = () => Math.min(1, Math.max(0, (skyNow().dark - 0.06) / 0.28));   // 0 day .. 1 night

const PROP_ART = {};

// ---------- forest ----------
PROP_ART.oak = p => {
  const { x, y, s } = p, sw = swayOf(p, 2.2);
  drawShadow(x + 8 * s, y + 3, 34 * s, 0.3);
  ctx.fillStyle = '#5a3b1f';
  ctx.beginPath(); ctx.moveTo(x - 8 * s, y + 3); ctx.quadraticCurveTo(x - 4 * s, y - 12 * s, x - 4.5 * s, y - 26 * s);
  ctx.lineTo(x + 4.5 * s, y - 26 * s); ctx.quadraticCurveTo(x + 4 * s, y - 12 * s, x + 8 * s, y + 3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#46301a';
  ctx.beginPath(); ctx.moveTo(x + s, y + 3); ctx.quadraticCurveTo(x + 2 * s, y - 12 * s, x + s, y - 26 * s);
  ctx.lineTo(x + 4.5 * s, y - 26 * s); ctx.quadraticCurveTo(x + 4 * s, y - 12 * s, x + 8 * s, y + 3); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#46301a'; ctx.lineWidth = 2.6 * s; ctx.lineCap = 'round';
  line(x - 5 * s, y + 1, x - 12 * s, y + 4); line(x + 5 * s, y + 1, x + 12 * s, y + 4);
  const t = p.v < 0.5 ? ['#223f25', '#2e5130', '#3f6b3d', '#5b8a4f'] : ['#26432a', '#335836', '#447443', '#62935a'];
  const cy = y - 36 * s;
  const B = [[-17, 6, 16], [17, 6, 16], [0, -1, 21], [-10, -13, 15], [11, -12, 15], [0, -22, 13]];
  for (const [bx, by, br] of B) circ(x + bx * s + sw * (1 - by / 40), cy + by * s, br * s, t[0]);
  for (const [bx, by, br] of B) circ(x + bx * s + sw * (1 - by / 40), cy + by * s - 2 * s, br * s * 0.84, t[1]);
  for (const [bx, by, br] of B) circ(x + (bx - 3) * s + sw * (1 - by / 40), cy + (by - 6) * s, br * s * 0.5, t[2]);
  if (gfx.glow) {
    ctx.fillStyle = 'rgba(200,236,150,0.32)';
    for (let i = 0; i < 4; i++) ell(x + (-12 + i * 8) * s + sw, cy + (-14 - (i % 2) * 6) * s, 4.5 * s, 2.4 * s, 'rgba(200,236,150,0.3)', -0.4);
  }
};
PROP_ART.birch = p => {
  const { x, y, s } = p, sw = swayOf(p, 3.2);
  drawShadow(x + 6 * s, y + 3, 24 * s, 0.26);
  fillPoly([[x - 3.2 * s, y + 2], [x - 2.6 * s, y - 36 * s], [x + 2.6 * s, y - 36 * s], [x + 3.2 * s, y + 2]], '#e9e6da');
  ctx.fillStyle = '#c9c5b4'; ctx.fillRect(x + 0.6 * s, y - 36 * s, 2 * s, 38 * s);
  ctx.fillStyle = '#3a3a36';
  for (let i = 0; i < 5; i++) ctx.fillRect(x - 3 * s, y - 6 * s - i * 6.8 * s, (2 + ((i * 7 + Math.floor(p.v * 10)) % 3)) * s, 1.3 * s);
  const t = p.v < 0.5 ? ['#6f9e4a', '#8dba5c', '#a9d27a'] : ['#7aa84f', '#98c466', '#b5dc88'], cy = y - 42 * s;
  const B = [[-10, 7, 11], [10, 6, 11], [0, -2, 14], [-5, -12, 10], [6, -12, 10]];
  for (const [bx, by, br] of B) circ(x + bx * s + sw * (1 - by / 40), cy + by * s, br * s, t[0]);
  for (const [bx, by, br] of B) circ(x + (bx - 2) * s + sw * (1 - by / 40), cy + (by - 3) * s, br * s * 0.62, t[1]);
  for (const [bx, by, br] of B) circ(x + (bx - 3) * s + sw * (1 - by / 40), cy + (by - 5) * s, br * s * 0.28, t[2]);
};
PROP_ART.bush = p => {
  const { x, y, s } = p, sw = swayOf(p, 1.2);
  drawShadow(x + 4 * s, y + 2, 20 * s, 0.26);
  ell(x - 8 * s + sw, y - 6 * s, 11 * s, 9 * s, '#2a4a2d'); ell(x + 8 * s + sw, y - 6 * s, 11 * s, 9 * s, '#2a4a2d');
  ell(x + sw, y - 10 * s, 13 * s, 11 * s, '#356036');
  ell(x - 3 * s + sw, y - 13 * s, 8 * s, 6 * s, '#4a7d46');
  if (p.v > 0.55) for (let i = 0; i < 5; i++) circ(x + (-9 + i * 4.6) * s + sw, y - (6 + (i % 3) * 3) * s, 1.5 * s, '#c8323a');
};
PROP_ART.stump = p => {
  const { x, y, s } = p;
  drawShadow(x + 3 * s, y + 2, 14 * s, 0.26);
  ctx.fillStyle = '#5a3b1f'; ctx.fillRect(x - 8 * s, y - 12 * s, 16 * s, 14 * s);
  ctx.fillStyle = '#46301a'; ctx.fillRect(x + 2 * s, y - 12 * s, 6 * s, 14 * s);
  ell(x, y - 12 * s, 8 * s, 3.4 * s, '#a07a48');
  ctx.strokeStyle = '#7a5a30'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(x, y - 12 * s, 5 * s, 2.2 * s, 0, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x, y - 12 * s, 2.4 * s, 1 * s, 0, 0, TAU); ctx.stroke();
};
PROP_ART.mossrock = p => {
  const { x, y, s } = p;
  drawShadow(x + 4 * s, y + 3, 20 * s, 0.3);
  fillPoly([[x - 17 * s, y + 1], [x - 14 * s, y - 12 * s], [x - 3 * s, y - 19 * s], [x + 11 * s, y - 14 * s], [x + 17 * s, y + 1]], '#6d727a');
  fillPoly([[x + 2 * s, y - 17 * s], [x + 11 * s, y - 14 * s], [x + 17 * s, y + 1], [x + 6 * s, y + 1]], '#585d65');
  ell(x - 4 * s, y - 15 * s, 11 * s, 4.5 * s, '#4f7a45'); ell(x - 8 * s, y - 12 * s, 5 * s, 3 * s, '#5f8d52');
};

// ---------- desert ----------
function saguaroPill(px, py, w, hh) { ctx.beginPath(); ctx.roundRect(px - w / 2, py - hh, w, hh, w / 2); ctx.fill(); }
PROP_ART.cactus = p => {
  const { x, y, s } = p, h = 44 * s;
  drawShadow(x + 5 * s, y + 2, 16 * s, 0.3);
  ctx.fillStyle = '#3f7a35'; saguaroPill(x - 11 * s, y - h * 0.34, 7 * s, h * 0.42); ctx.fillRect(x - 11 * s, y - h * 0.4, 9 * s, 5 * s);
  saguaroPill(x + 11 * s, y - h * 0.5, 7 * s, h * 0.36); ctx.fillRect(x + 3 * s, y - h * 0.56, 9 * s, 5 * s);
  ctx.fillStyle = '#4d853c'; saguaroPill(x, y, 13 * s, h);
  ctx.fillStyle = '#69a350'; ctx.beginPath(); ctx.roundRect(x - 5.5 * s, y - h + 2 * s, 3 * s, h - 4 * s, 1.5 * s); ctx.fill();
  ctx.strokeStyle = '#356b2d'; ctx.lineWidth = 1;
  for (const o of [-2.5, 2.5]) line(x + o * s, y - h + 4 * s, x + o * s, y - 2 * s);
  if (p.v > 0.6) circ(x, y - h, 3 * s, '#f06a98');
};
PROP_ART.barrel = p => {
  const { x, y, s } = p;
  drawShadow(x + 3 * s, y + 2, 13 * s, 0.28);
  ell(x, y - 8 * s, 11 * s, 10 * s, '#3f7a35'); ell(x - 2 * s, y - 9 * s, 9 * s, 8.6 * s, '#58934a');
  ctx.strokeStyle = '#2f6a2b'; ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(x, y - 8 * s, Math.abs(i) * 4.4 * s + 0.1, 10 * s, 0, Math.PI * 0.5, Math.PI * 1.5, i < 0); ctx.stroke(); }
  circ(x, y - 18 * s, 2.6 * s, '#f6d84a'); circ(x - 3 * s, y - 17 * s, 1.8 * s, '#f09a3a');
};
PROP_ART.deadbush = p => {
  const { x, y, s } = p, sw = swayOf(p, 1.5);
  drawShadow(x + 3 * s, y + 2, 14 * s, 0.22);
  ctx.strokeStyle = '#7a5a34'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI * (0.1 + 0.8 * i / 8), len = (10 + (i * 5 % 7)) * s;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + sw * 0.3, y + Math.sin(a) * len * 0.5 - 2 * s, x + Math.cos(a) * len + sw, y + Math.sin(a) * len);
    ctx.stroke();
  }
};
PROP_ART.sandstone = p => {
  const { x, y, s } = p;
  drawShadow(x + 6 * s, y + 3, 26 * s, 0.3);
  fillPoly([[x - 22 * s, y + 1], [x - 19 * s, y - 14 * s], [x + 18 * s, y - 14 * s], [x + 22 * s, y + 1]], '#b9834a');
  fillPoly([[x - 15 * s, y - 14 * s], [x - 12 * s, y - 28 * s], [x + 10 * s, y - 28 * s], [x + 14 * s, y - 14 * s]], '#c99358');
  fillPoly([[x - 8 * s, y - 28 * s], [x - 5 * s, y - 38 * s], [x + 5 * s, y - 38 * s], [x + 8 * s, y - 28 * s]], '#d9a468');
  ctx.strokeStyle = 'rgba(110,70,30,0.45)'; ctx.lineWidth = 1;
  for (const yy of [-5, -10, -19, -24, -33]) line(x - 17 * s, y + yy * s, x + 17 * s, y + yy * s);
  fillPoly([[x + 10 * s, y - 14 * s], [x + 18 * s, y - 14 * s], [x + 22 * s, y + 1], [x + 10 * s, y + 1]], 'rgba(90,50,20,0.28)');
};
PROP_ART.palm = p => {
  const { x, y, s } = p, sw = swayOf(p, 3.5);
  drawShadow(x + 8 * s, y + 3, 24 * s, 0.26);
  const topX = x + 6 * s + sw * 0.6, topY = y - 54 * s;
  ctx.strokeStyle = '#8a6a3c'; ctx.lineWidth = 5 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 9 * s, y - 28 * s, topX, topY); ctx.stroke();
  ctx.strokeStyle = '#6a4e28'; ctx.lineWidth = 1;
  for (let i = 1; i < 8; i++) { const t = i / 8; const bx = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * (x + 9 * s) + t * t * topX, by = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * (y - 28 * s) + t * t * topY; line(bx - 3 * s, by, bx + 3 * s, by); }
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.55, len = 30 * s;
    const ex = topX + Math.cos(a) * len, ey = topY + Math.sin(a) * len * 0.5 + 14 * s;
    ctx.strokeStyle = '#2f7a38'; ctx.lineWidth = 3.4 * s;
    ctx.beginPath(); ctx.moveTo(topX, topY); ctx.quadraticCurveTo(topX + Math.cos(a) * len * 0.6, topY + Math.sin(a) * len * 0.9 - 6 * s, ex + sw * 0.4, ey); ctx.stroke();
    ctx.strokeStyle = '#3f9a48'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(topX, topY - 1); ctx.quadraticCurveTo(topX + Math.cos(a) * len * 0.6, topY + Math.sin(a) * len * 0.9 - 7 * s, ex + sw * 0.4, ey - 1); ctx.stroke();
  }
  circ(topX - 2 * s, topY + 3 * s, 2.4 * s, '#6a4a22'); circ(topX + 2.5 * s, topY + 4 * s, 2.4 * s, '#6a4a22');
};
PROP_ART.skull = p => {
  const { x, y, s } = p;
  drawShadow(x + 2 * s, y + 2, 14 * s, 0.22);
  ctx.strokeStyle = '#e4dcc6'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x - 14 * s, y - 2 * s, (8 + i * 3) * s, -0.4, 1.2); ctx.stroke(); }
  ell(x + 4 * s, y - 6 * s, 9 * s, 7 * s, '#e8e0cc'); ell(x + 8 * s, y - 2 * s, 6 * s, 3.4 * s, '#d8cfb8');
  circ(x + 1 * s, y - 7 * s, 2.2 * s, '#3a3226'); circ(x + 7 * s, y - 7 * s, 2.2 * s, '#3a3226');
};

// ---------- snow ----------
function pineTiers(p, tiers, scale) {
  const { x, y } = p, s = p.s * scale, sw = swayOf(p, 2);
  drawShadow(x + 7 * s, y + 3, 22 * s, 0.22);
  ctx.fillStyle = '#4a3020'; ctx.fillRect(x - 3 * s, y - 12 * s, 6 * s, 14 * s);
  for (let i = 0; i < tiers; i++) {
    const w = (28 - i * 5.5) * s, ty = y - (9 + i * 15) * s, sx = sw * (i + 1) * 0.35;
    fillPoly([[x - w + sx, ty], [x + w + sx, ty], [x + sx * 1.2, ty - 25 * s]], '#244a38');
    fillPoly([[x + sx * 0.4, ty], [x + w + sx, ty], [x + sx * 1.2, ty - 25 * s]], '#1b3a2c');
    fillPoly([[x - w * 0.55 + sx, ty - 11 * s], [x + w * 0.55 + sx, ty - 11 * s], [x + sx * 1.2, ty - 25 * s]], '#f4f8fb');
    ell(x + sx, ty - 11 * s, w * 0.55, 2.6 * s, '#f4f8fb');
    fillPoly([[x + sx * 1.1, ty - 11 * s], [x + w * 0.55 + sx, ty - 11 * s], [x + sx * 1.2, ty - 25 * s]], '#dce8f2');
  }
}
PROP_ART.pine = p => pineTiers(p, 4, 1);
PROP_ART.smallpine = p => pineTiers(p, 3, 0.7);
PROP_ART.icerock = p => {
  const { x, y, s } = p;
  drawShadow(x + 4 * s, y + 3, 22 * s, 0.22);
  fillPoly([[x - 16 * s, y + 1], [x - 10 * s, y - 16 * s], [x + 2 * s, y - 22 * s], [x + 14 * s, y - 12 * s], [x + 18 * s, y + 1]], '#b9d8ec');
  fillPoly([[x - 10 * s, y - 16 * s], [x + 2 * s, y - 22 * s], [x + 2 * s, y - 4 * s]], '#e2f2fb');
  fillPoly([[x + 2 * s, y - 22 * s], [x + 14 * s, y - 12 * s], [x + 18 * s, y + 1], [x + 2 * s, y - 4 * s]], '#8fb8d4');
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; line(x - 4 * s, y - 18 * s, x - 2 * s, y - 8 * s);
  if (gfx.glow && Math.sin(tAnim * 2 + p.ph) > 0.93) { ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - 20 * s, 2, 2); }
};
PROP_ART.drift = p => {
  const { x, y, s } = p;
  ell(x + 3 * s, y, 26 * s, 7 * s, 'rgba(120,150,185,0.35)');
  ell(x, y - 4 * s, 24 * s, 9 * s, '#f2f7fb'); ell(x - 6 * s, y - 7 * s, 14 * s, 6 * s, '#ffffff');
};
PROP_ART.deadtree = p => {
  const { x, y, s } = p, sw = swayOf(p, 1.4), snowy = world && world.B.key === 'snow';
  drawShadow(x + 5 * s, y + 3, 16 * s, 0.24);
  ctx.strokeStyle = snowy ? '#4a3a30' : '#4a4540'; ctx.lineCap = 'round';
  ctx.lineWidth = 5 * s; line(x, y + 1, x + sw * 0.2, y - 24 * s);
  const br = [[-1, 12, 15, -10], [1, 17, 16, -13], [-1, 24, 11, -9], [1, 27, 9, -12]];
  ctx.lineWidth = 2.4 * s;
  for (const [d, h, lx, ly] of br) { ctx.beginPath(); ctx.moveTo(x + sw * 0.1, y - h * s); ctx.quadraticCurveTo(x + d * lx * 0.6 * s + sw * 0.4, y - (h + 3) * s, x + d * lx * s + sw * 0.6, y - (h - ly) * s); ctx.stroke(); }
  if (snowy) { ctx.fillStyle = '#f4f8fb'; for (const [d, h, lx, ly] of br) ell(x + d * lx * 0.7 * s, y - (h + 2) * s, 4 * s, 1.4 * s, '#f4f8fb'); }
};

// ---------- volcano ----------
const glowOf = (p, k = 2) => 0.6 + Math.sin(tAnim * k + p.ph) * 0.4;
PROP_ART.obsidian = p => {
  const { x, y, s } = p, g = glowOf(p);
  drawShadow(x + 5 * s, y + 3, 24 * s, 0.4);
  fillPoly([[x - 20 * s, y + 1], [x - 16 * s, y - 20 * s], [x - 8 * s, y - 8 * s], [x - 2 * s, y - 34 * s], [x + 6 * s, y - 12 * s], [x + 13 * s, y - 26 * s], [x + 20 * s, y + 1]], '#1e1717');
  fillPoly([[x - 2 * s, y - 34 * s], [x + 6 * s, y - 12 * s], [x + 2 * s, y + 1], [x - 4 * s, y + 1]], '#2e2323');
  fillPoly([[x + 13 * s, y - 26 * s], [x + 20 * s, y + 1], [x + 9 * s, y + 1], [x + 6 * s, y - 12 * s]], '#3a2c2c');
  ctx.strokeStyle = `rgba(255,${110 + g * 70 | 0},30,${0.45 + g * 0.5})`; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(x - 12 * s, y - 2 * s); ctx.lineTo(x - 6 * s, y - 14 * s); ctx.lineTo(x + 1 * s, y - 9 * s); ctx.lineTo(x + 4 * s, y - 21 * s); ctx.stroke();
};
PROP_ART.chartree = p => {
  const { x, y, s } = p, g = glowOf(p, 3);
  drawShadow(x + 4 * s, y + 3, 15 * s, 0.35);
  ctx.strokeStyle = '#17110f'; ctx.lineCap = 'round'; ctx.lineWidth = 6 * s; line(x, y + 1, x - 1 * s, y - 28 * s);
  ctx.lineWidth = 3 * s;
  const br = [[-1, 12, 15, 9], [1, 18, 17, 12], [-1, 26, 10, 9], [1, 30, 8, 11]];
  for (const [d, h, lx, ly] of br) { ctx.beginPath(); ctx.moveTo(x, y - h * s); ctx.lineTo(x + d * lx * s, y - (h + ly) * s); ctx.stroke(); }
  for (const [d, h, lx, ly] of br) circ(x + d * lx * s, y - (h + ly) * s, 1.7 * s, `rgba(255,${120 + g * 60 | 0},40,${0.5 + g * 0.5})`);
};
PROP_ART.vent = p => {
  const { x, y, s } = p, g = glowOf(p, 2.4);
  ell(x, y, 24 * s, 9 * s, '#1c1514'); ell(x, y - 3 * s, 20 * s, 7 * s, '#2b201e');
  ell(x, y - 3 * s, 10 * s, 3.6 * s, `rgba(255,${100 + g * 60 | 0},20,0.95)`); ell(x, y - 3 * s, 5 * s, 1.8 * s, '#ffe080');
  if (gfx.glow) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ell(x, y - 4 * s, 26 * s, 12 * s, `rgba(255,110,30,${0.08 + g * 0.06})`); ctx.restore(); }
};
PROP_ART.lavarock = p => {
  const { x, y, s } = p;
  drawShadow(x + 4 * s, y + 3, 20 * s, 0.38);
  fillPoly([[x - 16 * s, y + 1], [x - 13 * s, y - 12 * s], [x - 2 * s, y - 18 * s], [x + 11 * s, y - 13 * s], [x + 16 * s, y + 1]], '#3b2e2a');
  fillPoly([[x + 2 * s, y - 17 * s], [x + 11 * s, y - 13 * s], [x + 16 * s, y + 1], [x + 4 * s, y + 1]], '#2a1f1d');
  ctx.strokeStyle = 'rgba(255,130,50,0.7)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x - 13 * s, y - 12 * s); ctx.lineTo(x - 2 * s, y - 18 * s); ctx.lineTo(x + 11 * s, y - 13 * s); ctx.stroke();
};

// ---------- swamp ----------
PROP_ART.swamptree = p => {
  const { x, y, s } = p, sw = swayOf(p, 2.4);
  drawShadow(x + 8 * s, y + 3, 30 * s, 0.32);
  ctx.fillStyle = '#3a2f22';
  ctx.beginPath(); ctx.moveTo(x - 15 * s, y + 3); ctx.quadraticCurveTo(x - 8 * s, y - 2 * s, x - 6 * s, y - 20 * s); ctx.lineTo(x + 6 * s, y - 24 * s);
  ctx.quadraticCurveTo(x + 8 * s, y - 2 * s, x + 16 * s, y + 3); ctx.quadraticCurveTo(x, y - 6 * s, x - 15 * s, y + 3); ctx.fill();
  ctx.fillStyle = '#2a2218'; ctx.beginPath(); ctx.moveTo(x + 2 * s, y + 1); ctx.quadraticCurveTo(x + 5 * s, y - 8 * s, x + 6 * s, y - 24 * s); ctx.lineTo(x - 1 * s, y - 22 * s); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#3a2f22'; ctx.lineWidth = 4 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - 4 * s, y - 20 * s); ctx.quadraticCurveTo(x - 16 * s, y - 28 * s, x - 22 * s, y - 24 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 4 * s, y - 22 * s); ctx.quadraticCurveTo(x + 15 * s, y - 32 * s, x + 21 * s, y - 28 * s); ctx.stroke();
  const cy = y - 30 * s;
  for (const [bx, by, br] of [[-16, 0, 11], [16, -4, 11], [0, -8, 14]]) circ(x + bx * s + sw, cy + by * s, br * s, '#2a4a30');
  for (const [bx, by, br] of [[-17, -2, 7], [14, -6, 7], [-2, -11, 9]]) circ(x + bx * s + sw, cy + by * s, br * s, '#3d6540');
  ctx.strokeStyle = '#4f6e4a'; ctx.lineWidth = 1.5;                                      // hanging moss
  for (let i = 0; i < 9; i++) {
    const mx = x + (-22 + i * 5.5) * s + sw, my = cy + (4 + (i % 3) * 3) * s, len = (14 + (i * 7 % 11)) * s;
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.quadraticCurveTo(mx + Math.sin(tAnim * 1.4 + i + p.ph) * 2.4 * Math.min(2, windMul()) , my + len * 0.5, mx + sw * 0.3, my + len); ctx.stroke();
  }
};
PROP_ART.reeds = p => {
  const { x, y, s } = p, sw = swayOf(p, 2.6);
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const bx = x + (-9 + i * 2.6) * s, h = (22 + (i * 9 % 12)) * s, lean = (i - 3.5) * 1.5 * s + sw * (h / (30 * s));
    ctx.strokeStyle = i % 2 ? '#6e8a3a' : '#5a7632'; ctx.lineWidth = 1.7;
    ctx.beginPath(); ctx.moveTo(bx, y); ctx.quadraticCurveTo(bx + lean * 0.4, y - h * 0.6, bx + lean, y - h); ctx.stroke();
    if (i % 3 === 0) { ctx.strokeStyle = '#6b4420'; ctx.lineWidth = 3.6; line(bx + lean * 0.96, y - h * 0.9, bx + lean, y - h - 3 * s); }
  }
};
PROP_ART.mushroom = p => {
  const { x, y, s } = p, big = world && world.B.key === 'swamp', k = big ? 1.5 : 1;
  const cap = p.v < 0.5 ? ['#7a4aa6', '#9a6ac6'] : ['#a03a3a', '#c85a5a'];
  drawShadow(x + 2, y + 2, 10 * s * k, 0.24);
  ctx.fillStyle = '#e8dfc8'; ctx.fillRect(x - 2.4 * s * k, y - 9 * s * k, 4.8 * s * k, 10 * s * k);
  ell(x, y - 10 * s * k, 11 * s * k, 7 * s * k, cap[0]); ell(x - 1 * s * k, y - 11.5 * s * k, 9 * s * k, 5 * s * k, cap[1]);
  circ(x - 4 * s * k, y - 12 * s * k, 1.4 * s * k, '#f4eedd'); circ(x + 3 * s * k, y - 13 * s * k, 1.2 * s * k, '#f4eedd'); circ(x + 5 * s * k, y - 10 * s * k, 1 * s * k, '#f4eedd');
  const n = night01();
  if (gfx.glow && n > 0.2 && big) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y - 9 * s * k, 1, x, y - 9 * s * k, 24 * s * k); g.addColorStop(0, `rgba(190,130,255,${0.3 * n})`); g.addColorStop(1, 'rgba(190,130,255,0)'); ctx.fillStyle = g; ctx.fillRect(x - 26 * s * k, y - 36 * s * k, 52 * s * k, 52 * s * k); ctx.restore(); }
};
PROP_ART.log = p => {
  const { x, y, s } = p;
  drawShadow(x + 3 * s, y + 2, 26 * s, 0.26);
  ctx.fillStyle = '#4a3622'; ctx.beginPath(); ctx.roundRect(x - 24 * s, y - 11 * s, 48 * s, 12 * s, 5 * s); ctx.fill();
  ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.roundRect(x - 24 * s, y - 4 * s, 48 * s, 5 * s, 3 * s); ctx.fill();
  ell(x + 24 * s, y - 5 * s, 3.4 * s, 6 * s, '#8a6a3e'); ell(x + 24 * s, y - 5 * s, 1.6 * s, 3 * s, '#6a4a28');
  ell(x - 6 * s, y - 11 * s, 14 * s, 3 * s, '#4f7a45');
};

// ---------- jungle ----------
PROP_ART.jungletree = p => {
  const { x, y, s } = p, sw = swayOf(p, 2.6);
  drawShadow(x + 10 * s, y + 3, 38 * s, 0.32);
  ctx.fillStyle = '#4a3622'; ctx.beginPath(); ctx.moveTo(x - 7 * s, y + 3); ctx.quadraticCurveTo(x - 3 * s, y - 20 * s, x - 3.6 * s, y - 52 * s); ctx.lineTo(x + 3.6 * s, y - 52 * s); ctx.quadraticCurveTo(x + 3 * s, y - 20 * s, x + 7 * s, y + 3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x + 0.5 * s, y - 52 * s, 3 * s, 54 * s);
  ctx.strokeStyle = '#3f7a35'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x - 3 * s, y - 4 * s); ctx.bezierCurveTo(x + 4 * s, y - 14 * s, x - 5 * s, y - 28 * s, x + 2 * s, y - 44 * s); ctx.stroke();
  const topY = y - 54 * s;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.5, len = (30 + (i % 2) * 6) * s;
    const ex = x + Math.cos(a) * len + sw, ey = topY + Math.sin(a) * len * 0.45 + 10 * s;
    ctx.fillStyle = i % 2 ? '#2f7a38' : '#3f9a48';
    ctx.beginPath(); ctx.moveTo(x, topY); ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.55 + sw * 0.5, topY - 12 * s, ex, ey); ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.55 + sw * 0.5, topY + 2 * s, x, topY); ctx.fill();
  }
  ell(x + sw * 0.5, topY - 3 * s, 20 * s, 9 * s, '#2a6a32'); ell(x + sw * 0.5 - 4 * s, topY - 6 * s, 13 * s, 6 * s, '#3f9a48');
  if (p.v > 0.5) { circ(x - 8 * s + sw, topY - 2 * s, 2 * s, '#ff5a8a'); circ(x + 9 * s + sw, topY, 2 * s, '#ffd23a'); }
};
PROP_ART.bigfern = p => {
  const { x, y, s } = p, sw = swayOf(p, 2);
  drawShadow(x + 3 * s, y + 2, 20 * s, 0.22);
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI * (0.05 + 0.9 * i / 8), len = (24 + (i % 3) * 5) * s;
    const ex = x + Math.cos(a) * len + sw * 0.5, ey = y + Math.sin(a) * len * 0.8 + 4 * s;
    const cx = x + Math.cos(a) * len * 0.5, cy2 = y + Math.sin(a) * len * 0.8 - 8 * s;
    ctx.strokeStyle = '#2f7a36'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(cx, cy2, ex, ey); ctx.stroke();
    ctx.strokeStyle = i % 2 ? '#3f9a48' : '#58b05a'; ctx.lineWidth = 1;
    for (let k = 1; k <= 5; k++) {
      const t = k / 6, px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * cx + t * t * ex, py = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * cy2 + t * t * ey, ll = (7 - k) * s * 0.9;
      line(px, py, px + Math.sin(a) * ll * -1 + ll * 0.6, py - ll * 0.6); line(px, py, px - ll * 0.6 - Math.sin(a) * ll, py - ll * 0.5);
    }
  }
};
PROP_ART.banana = p => {
  const { x, y, s } = p, sw = swayOf(p, 2.4);
  drawShadow(x + 4 * s, y + 2, 20 * s, 0.24);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.6, len = (30 + (i % 2) * 6) * s;
    const ex = x + Math.cos(a) * len + sw, ey = y - 4 * s + Math.sin(a) * len * 0.9;
    ctx.fillStyle = i % 2 ? '#3f9a48' : '#58b05a';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a - 0.5) * len * 0.7, y + Math.sin(a - 0.5) * len * 0.8, ex, ey); ctx.quadraticCurveTo(x + Math.cos(a + 0.5) * len * 0.7, y + Math.sin(a + 0.5) * len * 0.8, x, y); ctx.fill();
    ctx.strokeStyle = '#2f7a36'; ctx.lineWidth = 1; line(x, y, ex, ey);
  }
  ctx.fillStyle = '#e8c93a'; for (let i = 0; i < 4; i++) ell(x + (i - 1.5) * 2.6 * s, y - 6 * s + (i % 2) * 2 * s, 1.6 * s, 4 * s, '#e8c93a', 0.3 * (i - 1.5));
};
PROP_ART.flowerbush = p => {
  const { x, y, s } = p, sw = swayOf(p, 1.2);
  drawShadow(x + 4 * s, y + 2, 20 * s, 0.24);
  ell(x - 8 * s + sw, y - 6 * s, 11 * s, 9 * s, '#2a6a32'); ell(x + 8 * s + sw, y - 6 * s, 11 * s, 9 * s, '#2a6a32'); ell(x + sw, y - 10 * s, 13 * s, 11 * s, '#368040');
  const col = ['#ff5a8a', '#ffd23a', '#ff8a2a', '#c07aff'][Math.floor(p.v * 4) % 4];
  for (let i = 0; i < 7; i++) { const fx = x + (-11 + i * 3.7) * s + sw, fy = y - (6 + (i * 5 % 9)) * s; circ(fx, fy, 2.4 * s, col); circ(fx, fy, 1 * s, '#fff3b0'); }
};

// ---------- ruins ----------
PROP_ART.pillar = p => {
  const { x, y, s } = p, h = (36 + p.v * 18) * s;
  drawShadow(x + 6 * s, y + 3, 22 * s, 0.34);
  ctx.fillStyle = '#7c8189'; ctx.fillRect(x - 11 * s, y - 5 * s, 22 * s, 6 * s);
  fillPoly([[x - 8 * s, y - 5 * s], [x - 8 * s, y - h], [x - 4 * s, y - h - 3 * s], [x + 2 * s, y - h + 4 * s], [x + 8 * s, y - h - 2 * s], [x + 8 * s, y - 5 * s]], '#9097a0');
  fillPoly([[x + 2 * s, y - 5 * s], [x + 2 * s, y - h + 4 * s], [x + 8 * s, y - h - 2 * s], [x + 8 * s, y - 5 * s]], '#7a8089');
  ctx.strokeStyle = 'rgba(50,55,65,0.5)'; ctx.lineWidth = 1; for (const o of [-4, 0, 4]) line(x + o * s, y - 7 * s, x + o * s, y - h + 6 * s);
  ctx.strokeStyle = 'rgba(40,44,52,0.7)'; ctx.beginPath(); ctx.moveTo(x - 2 * s, y - h * 0.55); ctx.lineTo(x + 1 * s, y - h * 0.4); ctx.lineTo(x - 1 * s, y - h * 0.25); ctx.stroke();
  ell(x - 3 * s, y - h * 0.3, 3 * s, 8 * s, 'rgba(80,120,70,0.5)');
  fillPoly([[x + 12 * s, y + 1], [x + 15 * s, y - 5 * s], [x + 21 * s, y - 3 * s], [x + 22 * s, y + 1]], '#8a9098');
};
PROP_ART.arch = p => {
  const { x, y, s } = p;
  drawShadow(x + 8 * s, y + 3, 40 * s, 0.34);
  for (const side of [-1, 1]) {
    const px = x + side * 22 * s, h = side < 0 ? 46 * s : 36 * s;
    ctx.fillStyle = '#7c8189'; ctx.fillRect(px - 8 * s, y - 4 * s, 16 * s, 5 * s);
    ctx.fillStyle = '#9097a0'; ctx.fillRect(px - 6 * s, y - h, 12 * s, h - 4 * s);
    ctx.fillStyle = '#7a8089'; ctx.fillRect(px + 1 * s, y - h, 5 * s, h - 4 * s);
  }
  ctx.strokeStyle = '#9097a0'; ctx.lineWidth = 8 * s; ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.arc(x, y - 36 * s, 22 * s, Math.PI, Math.PI * 1.62); ctx.stroke();
  ctx.strokeStyle = '#7a8089'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.arc(x, y - 33 * s, 22 * s, Math.PI * 1.02, Math.PI * 1.6); ctx.stroke();
  ell(x - 18 * s, y - 20 * s, 3 * s, 10 * s, 'rgba(80,120,70,0.45)');
};
PROP_ART.tomb = p => {
  const { x, y, s } = p;
  drawShadow(x + 3 * s, y + 2, 14 * s, 0.3);
  ell(x, y - 1 * s, 12 * s, 3 * s, '#4f7045');
  ctx.fillStyle = '#8a8f99'; ctx.beginPath(); ctx.moveTo(x - 9 * s, y); ctx.lineTo(x - 9 * s, y - 20 * s); ctx.arc(x, y - 20 * s, 9 * s, Math.PI, 0); ctx.lineTo(x + 9 * s, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#6f747d'; ctx.beginPath(); ctx.moveTo(x + 2 * s, y); ctx.lineTo(x + 2 * s, y - 28 * s); ctx.arc(x, y - 20 * s, 9 * s, -1.2, 0); ctx.lineTo(x + 9 * s, y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#555a63'; ctx.lineWidth = 1.5;
  if (p.v > 0.5) { line(x, y - 24 * s, x, y - 12 * s); line(x - 4 * s, y - 20 * s, x + 4 * s, y - 20 * s); } else { line(x - 4 * s, y - 20 * s, x + 4 * s, y - 20 * s); line(x - 4 * s, y - 15 * s, x + 4 * s, y - 15 * s); line(x - 4 * s, y - 10 * s, x + 2 * s, y - 10 * s); }
};
PROP_ART.statue = p => {
  const { x, y, s } = p;
  drawShadow(x + 5 * s, y + 3, 22 * s, 0.32);
  ctx.fillStyle = '#7c8189'; ctx.fillRect(x - 13 * s, y - 8 * s, 26 * s, 9 * s);
  ctx.fillStyle = '#9097a0'; ctx.fillRect(x - 10 * s, y - 14 * s, 20 * s, 7 * s);
  fillPoly([[x - 7 * s, y - 14 * s], [x - 9 * s, y - 34 * s], [x - 4 * s, y - 40 * s], [x + 5 * s, y - 36 * s], [x + 8 * s, y - 14 * s]], '#a2a8b0');
  fillPoly([[x + 1 * s, y - 14 * s], [x + 2 * s, y - 37 * s], [x + 5 * s, y - 36 * s], [x + 8 * s, y - 14 * s]], '#868c95');
  ctx.strokeStyle = 'rgba(40,44,52,0.7)'; ctx.lineWidth = 1; line(x - 5 * s, y - 30 * s, x - 1 * s, y - 22 * s); line(x - 1 * s, y - 22 * s, x - 4 * s, y - 16 * s);
  ctx.strokeStyle = '#3f7a35'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 8 * s, y - 14 * s); ctx.quadraticCurveTo(x - 4 * s, y - 24 * s, x - 9 * s, y - 32 * s); ctx.stroke();
};
PROP_ART.brazier = p => {
  const { x, y, s } = p, f = 0.7 + Math.sin(tAnim * 9 + p.ph) * 0.3, f2 = 0.7 + Math.sin(tAnim * 6.5 + 2) * 0.3;
  drawShadow(x + 3 * s, y + 2, 14 * s, 0.3);
  ctx.strokeStyle = '#4a4f58'; ctx.lineWidth = 3 * s; ctx.lineCap = 'round';
  line(x - 8 * s, y, x - 4 * s, y - 14 * s); line(x + 8 * s, y, x + 4 * s, y - 14 * s); line(x, y, x, y - 14 * s);
  ctx.fillStyle = '#5a5f68'; ctx.beginPath(); ctx.moveTo(x - 11 * s, y - 16 * s); ctx.lineTo(x + 11 * s, y - 16 * s); ctx.lineTo(x + 7 * s, y - 9 * s); ctx.lineTo(x - 7 * s, y - 9 * s); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  fillPoly([[x - 6 * s, y - 16 * s], [x + 6 * s, y - 16 * s], [x + 2 * s, y - (16 + 16 * f) * s], [x - 1 * s, y - (16 + 20 * f2) * s]], 'rgba(120,190,255,0.8)');
  fillPoly([[x - 3 * s, y - 16 * s], [x + 3 * s, y - 16 * s], [x, y - (16 + 11 * f) * s]], 'rgba(220,245,255,0.9)');
  if (gfx.glow) { const g = ctx.createRadialGradient(x, y - 20 * s, 2, x, y - 20 * s, 46 * s); g.addColorStop(0, 'rgba(120,190,255,0.25)'); g.addColorStop(1, 'rgba(120,190,255,0)'); ctx.fillStyle = g; ctx.fillRect(x - 46 * s, y - 66 * s, 92 * s, 92 * s); }
  ctx.restore();
};
PROP_ART.rubble = p => {
  const { x, y, s } = p;
  drawShadow(x + 3 * s, y + 2, 16 * s, 0.26);
  fillPoly([[x - 14 * s, y + 1], [x - 12 * s, y - 7 * s], [x - 5 * s, y - 9 * s], [x - 3 * s, y + 1]], '#7c8189');
  fillPoly([[x - 4 * s, y + 1], [x - 2 * s, y - 12 * s], [x + 6 * s, y - 10 * s], [x + 8 * s, y + 1]], '#9097a0');
  fillPoly([[x + 7 * s, y + 1], [x + 8 * s, y - 6 * s], [x + 15 * s, y - 4 * s], [x + 16 * s, y + 1]], '#6f747d');
  fillPoly([[x + 2 * s, y - 10 * s], [x + 6 * s, y - 10 * s], [x + 8 * s, y + 1], [x + 3 * s, y + 1]], 'rgba(0,0,0,0.15)');
};

// ---------- highlands ----------
PROP_ART.boulder = p => {
  const { x, y, s } = p;
  drawShadow(x + 7 * s, y + 3, 32 * s, 0.34);
  fillPoly([[x - 26 * s, y + 1], [x - 22 * s, y - 16 * s], [x - 9 * s, y - 26 * s], [x + 8 * s, y - 28 * s], [x + 22 * s, y - 14 * s], [x + 27 * s, y + 1]], '#8b9098');
  fillPoly([[x - 9 * s, y - 26 * s], [x + 8 * s, y - 28 * s], [x + 22 * s, y - 14 * s], [x + 4 * s, y - 10 * s]], '#a3a8b0');
  fillPoly([[x + 4 * s, y - 10 * s], [x + 22 * s, y - 14 * s], [x + 27 * s, y + 1], [x + 2 * s, y + 1]], '#70757d');
  fillPoly([[x - 22 * s, y - 16 * s], [x - 9 * s, y - 26 * s], [x + 4 * s, y - 10 * s], [x - 14 * s, y - 6 * s]], '#979ca4');
  circ(x - 12 * s, y - 12 * s, 2.4 * s, '#8aa070'); circ(x - 8 * s, y - 15 * s, 1.8 * s, '#9ab07e'); circ(x + 12 * s, y - 20 * s, 1.8 * s, '#8aa070');
};
PROP_ART.spire = p => {
  const { x, y, s } = p, h = (62 + p.v * 20) * s;
  drawShadow(x + 10 * s, y + 3, 34 * s, 0.34);
  fillPoly([[x - 22 * s, y + 1], [x - 12 * s, y - h * 0.5], [x - 4 * s, y - h], [x + 5 * s, y - h * 0.62], [x + 13 * s, y - h * 0.78], [x + 24 * s, y + 1]], '#7d838c');
  fillPoly([[x - 4 * s, y - h], [x + 5 * s, y - h * 0.62], [x + 13 * s, y - h * 0.78], [x + 24 * s, y + 1], [x + 2 * s, y + 1]], '#656a72');
  fillPoly([[x - 12 * s, y - h * 0.5], [x - 4 * s, y - h], [x + 2 * s, y - h * 0.5]], '#98a0a8');
  fillPoly([[x - 8 * s, y - h * 0.82], [x - 4 * s, y - h], [x + 1 * s, y - h * 0.78], [x - 2 * s, y - h * 0.7], [x - 5 * s, y - h * 0.76]], '#f2f6fa');
  ctx.strokeStyle = 'rgba(40,44,52,0.4)'; ctx.lineWidth = 1; line(x - 6 * s, y - h * 0.4, x + 2 * s, y - h * 0.2);
};
PROP_ART.alpinepine = p => {
  const { x, y, s } = p, sw = swayOf(p, 2.6);
  drawShadow(x + 5 * s, y + 3, 16 * s, 0.24);
  ctx.fillStyle = '#4a3a2c'; ctx.fillRect(x - 2.4 * s, y - 10 * s, 5 * s, 12 * s);
  for (let i = 0; i < 3; i++) {
    const w = (18 - i * 4.5) * s, ty = y - (7 + i * 12) * s, lean = (i + 1) * 2.4 * s + sw * (i + 1) * 0.4;
    fillPoly([[x - w * 0.7 + lean, ty], [x + w * 1.1 + lean, ty], [x + lean * 1.4, ty - 20 * s]], '#2f5448');
    fillPoly([[x + lean * 0.4, ty], [x + w * 1.1 + lean, ty], [x + lean * 1.4, ty - 20 * s]], '#244236');
  }
};
PROP_ART.cairn = p => {
  const { x, y, s } = p;
  drawShadow(x + 3 * s, y + 2, 14 * s, 0.28);
  const st = [[13, 5, '#8a8f97'], [10, 4.4, '#979ca4'], [7.4, 3.8, '#7d838c'], [5, 3.2, '#a3a8b0'], [3, 2.6, '#8a8f97']];
  let yy = y;
  for (const [rx, ry, c] of st) { ell(x + ((rx * 7) % 3 - 1) * s, yy - ry * s, rx * s, ry * s, c); yy -= ry * 1.7 * s; }
};
PROP_ART.alpinebush = p => {
  const { x, y, s } = p, sw = swayOf(p, 1.4);
  drawShadow(x + 3 * s, y + 2, 14 * s, 0.22);
  ell(x - 6 * s + sw, y - 4 * s, 9 * s, 6 * s, '#4f6a4a'); ell(x + 6 * s + sw, y - 4 * s, 9 * s, 6 * s, '#4f6a4a'); ell(x + sw, y - 7 * s, 10 * s, 7 * s, '#5f7d58');
  for (let i = 0; i < 6; i++) circ(x + (-8 + i * 3.2) * s + sw, y - (4 + (i * 5 % 7)) * s, 1.5 * s, i % 2 ? '#d0a0e0' : '#f0e8f4');
};

function drawProp(p) { const f = PROP_ART[p.k]; if (f) f(p); }

// ---------- decor: small ground details ----------
const DECOR_ART = {
  dot: d => circ(d.x, d.y, d.s, d.c),
  flower: d => {
    ctx.strokeStyle = '#3d6b3a'; ctx.lineWidth = 1; line(d.x, d.y, d.x, d.y - 4 * d.s);
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; circ(d.x + Math.cos(a) * 1.7 * d.s, d.y - 4 * d.s + Math.sin(a) * 1.7 * d.s, 1.15 * d.s, d.c); }
    circ(d.x, d.y - 4 * d.s, 0.95 * d.s, '#f6e27a');
  },
  pebble: d => { ell(d.x, d.y, 2.6 * d.s, 1.7 * d.s, d.c); ell(d.x - 0.6, d.y - 0.5, 1.2 * d.s, 0.7 * d.s, 'rgba(255,255,255,0.25)'); },
  mushroom: d => { ctx.fillStyle = '#e8dfc8'; ctx.fillRect(d.x - 0.8 * d.s, d.y - 2.4 * d.s, 1.6 * d.s, 2.4 * d.s); ell(d.x, d.y - 3 * d.s, 2.6 * d.s, 1.8 * d.s, d.c); },
  bone: d => { ctx.strokeStyle = d.c; ctx.lineWidth = 1.3; ctx.lineCap = 'round'; line(d.x - 3 * d.s, d.y - 1, d.x + 3 * d.s, d.y + 1); line(d.x - 2 * d.s, d.y + 1.5, d.x + 2 * d.s, d.y - 1.5); },
  fern: d => { ctx.strokeStyle = '#2f7a36'; ctx.lineWidth = 1; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.quadraticCurveTo(d.x + i * 3 * d.s, d.y - 4 * d.s, d.x + i * 5 * d.s, d.y - 3 * d.s); ctx.stroke(); } },
  crystal: d => { ctx.fillStyle = d.c; ctx.beginPath(); ctx.moveTo(d.x, d.y - 3 * d.s); ctx.lineTo(d.x + 1.3 * d.s, d.y); ctx.lineTo(d.x, d.y + 3 * d.s); ctx.lineTo(d.x - 1.3 * d.s, d.y); ctx.closePath(); ctx.fill(); },
  ember: d => { const g = 0.5 + Math.sin(tAnim * 3 + d.ph) * 0.5; circ(d.x, d.y, d.s * (0.8 + g * 0.5), `rgba(255,${120 + g * 70 | 0},40,${0.55 + g * 0.4})`); },
  reed: d => { ctx.strokeStyle = d.c; ctx.lineWidth = 1; for (let i = -1; i <= 1; i++) line(d.x + i * 1.6, d.y, d.x + i * 2.4, d.y - (5 + i * i) * d.s); },
  leaf: d => { ell(d.x, d.y, 2.6 * d.s, 1.2 * d.s, d.ph > 3.1 ? '#8a6a3a' : '#6a7a3a', d.ph); },
  crack: d => { ctx.strokeStyle = 'rgba(8,4,4,0.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(d.x - 5 * d.s, d.y); ctx.lineTo(d.x - 1 * d.s, d.y - 2); ctx.lineTo(d.x + 2 * d.s, d.y + 1); ctx.lineTo(d.x + 6 * d.s, d.y - 1); ctx.stroke(); },
  lily: d => {
    const bob = Math.sin(tAnim * 1.3 + d.ph) * 0.6;
    ctx.fillStyle = d.c; ctx.beginPath(); ctx.ellipse(d.x, d.y + bob, 6 * d.s, 3.4 * d.s, 0, 0.3, TAU - 0.3); ctx.lineTo(d.x, d.y + bob); ctx.closePath(); ctx.fill();
    if (d.ph > 4.8) circ(d.x + 1, d.y + bob - 1, 1.6 * d.s, '#f6a8c8');
  },
};
