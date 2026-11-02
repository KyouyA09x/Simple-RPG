// The prologue's pictures: the hero's rig, the bonfire, the memories, and the village shop window (the real shop window of the game).

// ---------------------------------------------------------------- a stick figure with real joints
// a two-bone limb from a to b: where the knee or the elbow goes. side: which way it bends. `end` is where the far end really lands (the limb cannot stretch).
function proIK(a, b, l1, l2, side) {
  let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1; const mx = l1 + l2 - 0.05; if (d > mx) { dx *= mx / d; dy *= mx / d; d = mx; }
  const x = (d * d + l1 * l1 - l2 * l2) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - x * x)), ux = dx / d, uy = dy / d;
  return { x: a.x + ux * x - uy * h * side, y: a.y + uy * x + ux * h * side, end: { x: a.x + dx, y: a.y + dy } };
}
function proWrapSeg(p, q, n, w, blood) {                                            // a limb or the body wrapped in bandage: a thick cream sleeve with the turns of the cloth across it
  if (!p || !q) return; ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = '#3a342a'; ctx.lineWidth = w * 1.9 + 1.6; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
  ctx.strokeStyle = '#ece3c8'; ctx.lineWidth = w * 1.9; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
  const ang = Math.atan2(q.y - p.y, q.x - p.x) + Math.PI / 2 + 0.55, c = Math.cos(ang) * w * 0.9, s = Math.sin(ang) * w * 0.9;
  ctx.strokeStyle = 'rgba(120,98,66,0.65)'; ctx.lineWidth = 0.9; ctx.lineCap = 'butt';
  for (let i = 1; i <= n; i++) { const k = i / (n + 1), x = p.x + (q.x - p.x) * k, y = p.y + (q.y - p.y) * k; ctx.beginPath(); ctx.moveTo(x - c, y - s); ctx.lineTo(x + c, y + s); ctx.stroke(); }
  if (blood) { ctx.fillStyle = 'rgba(170,20,20,0.85)'; ctx.beginPath(); ctx.arc(p.x + (q.x - p.x) * blood + 0.8, p.y + (q.y - p.y) * blood, w * 0.55, 0, 6.3); ctx.fill(); }
  ctx.restore();
}
function proWraps(J, f, mode) {
  const headOnly = mode !== 2;                                                           // the village hero in game.js: bandages over the whole body (drawHero calls this)
  const L = proWrapSeg;
  if (!headOnly) {
  L(J.hip, J.neck, 4, 2.6, 0.55); L(J.sh, J.front.j, 2, 1.5); L(J.front.j, J.front.e, 2, 1.3, 0.5); L(J.sh, J.back.j, 2, 1.5); L(J.back.j, J.back.e, 2, 1.3);
  for (const l of J.legs) { L(l[0], l[1], 2, 2.3, 0.4); L(l[1], l[2], 2, 2.0); }
  }
  if (mode === 3) {                                                                  // freshly mauled: blood soaking the torso and the thigh, a bruised arm, scratches
    const seg = (p, q, k0, k1, col, w) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(p.x + (q.x - p.x) * k0, p.y + (q.y - p.y) * k0); ctx.lineTo(p.x + (q.x - p.x) * k1, p.y + (q.y - p.y) * k1); ctx.stroke(); };
    ctx.save(); ctx.lineCap = 'round'; const R = 'rgba(160,18,18,0.92)';
    seg(J.neck, J.hip, 0.1, 0.42, R, 4.8); seg(J.neck, J.hip, 0.55, 0.7, R, 4); seg(J.sh, J.front.j, 0.2, 0.9, 'rgba(110,60,140,0.85)', 4.4); seg(J.front.j, J.front.e, 0.1, 0.55, R, 3.6);
    const l0 = J.legs[0]; if (l0) seg(l0[0], l0[1], 0.2, 0.75, R, 4); const l1 = J.legs[1]; if (l1) seg(l1[1], l1[2], 0.1, 0.5, 'rgba(110,60,140,0.8)', 4);
    ctx.fillStyle = R; for (const [k, dx] of [[0.46, 2], [0.62, -2]]) { const x = J.neck.x + (J.hip.x - J.neck.x) * k + dx, y = J.neck.y + (J.hip.y - J.neck.y) * k; ctx.beginPath(); ctx.arc(x, y + 5 + Math.abs(Math.sin(tAnim * 3 + k * 9)) * 3, 1.5, 0, 6.3); ctx.fill(); }
    ctx.restore();
  }
}
// the hero as a small stick figure (feet at x, y). o: walk (phase), amp (0 = standing .. 1), lean, stumble (0..1), bob, sit, hand (0..1: a hand to the sore head),
// arm (0..1 raised), swordAng, reach {x,y} (front hand, from the shoulder), hold ('loaf'), bandage, scarf
function proHeroFig(x, y, s, f, o = {}) {
  s *= 0.84; ctx.save(); ctx.translate(x, y); ctx.scale(s * f, s); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const ink = '#1a1a1a', sit = !!o.sit, wk = o.walk || 0, amp = o.amp !== undefined ? o.amp : (o.walk !== undefined ? 1 : 0), st = o.stumble || 0, lean = o.lean || 0;
  const bob = o.bob ? Math.abs(Math.sin(wk)) * 1.6 * amp : 0;
  const hip = { x: o.bob ? Math.sin(wk) * 1.6 * amp : 0, y: (sit ? -22 : -34.5) + bob * 0.6 + st * 1.5 };
  const sh = { x: hip.x + Math.sin(lean) * 32, y: hip.y - Math.cos(lean) * 32 }, tilt = lean + 0.1 + st * 0.25 + (o.hand || 0) * 0.1;
  const hd = { x: sh.x + Math.sin(tilt) * 16, y: sh.y - Math.cos(tilt) * 16 };
  ell(0, 2, 18, 5, 'rgba(0,0,0,0.25)');
  const legs = [];
  if (sit) legs.push([hip, { x: 16, y: hip.y }, { x: 16, y: 0 }], [hip, { x: 10, y: hip.y + 3 }, { x: 10, y: 0 }]);
  else for (let k = 0; k < 2; k++) {                                                // a planted foot stays put and the body moves over it, then the foot swings through, lifted
    const u = (((wk / 6.2832 + k * 0.5) % 1) + 1) % 1, S = 10 * amp, lead = k === 0;
    let fx, lift = 0;
    if (u < 0.6) fx = S - (u / 0.6) * 2 * S; else { const q = (u - 0.6) / 0.4; fx = -S + q * 2 * S; lift = Math.sin(q * Math.PI) * 9 * amp; }
    if (st > 0 && lead) { fx += st * 7; lift = Math.max(lift, st * 3); }
    const foot = { x: hip.x + fx + (k ? -2 : 2), y: -lift };
    const kn = proIK(hip, foot, 18.5, 18.5, -1); legs.push([hip, kn, kn.end]);
  }
  const S0 = { x: sh.x, y: sh.y + 3 }, arms = [];
  for (let k = 0; k < 2; k++) {                                                      // k 0: the front arm, k 1: the back arm. They swing against the legs
    const sw = Math.sin(wk + (k ? 0 : Math.PI)) * 8 * amp; let tx = S0.x + 2 + sw, ty = S0.y + 26 - Math.abs(sw) * 0.2;
    if (k === 0) {
      if (o.arm > 0) { tx = S0.x + 14 + o.arm * 6; ty = S0.y + 22 - o.arm * 46; }
      if (o.swordAng !== undefined) { tx = S0.x + 8 + Math.cos(o.swordAng) * 12; ty = S0.y + 6 + Math.sin(o.swordAng) * 14; }
      if (o.reach) { tx = S0.x + o.reach.x; ty = S0.y + o.reach.y; }
      if (o.hand > 0.02) { tx += (hd.x - 3 - tx) * o.hand; ty += (hd.y + 9 - ty) * o.hand; }
      if (st > 0) { tx += (S0.x + 25 - tx) * st; ty += (S0.y - 8 - ty) * st; }
    } else if (st > 0) { tx += (S0.x - 16 - tx) * st; ty += (S0.y + 6 - ty) * st; }
    const el = proIK(S0, { x: tx, y: ty }, 14, 14, 1); arms.push([S0, el, el.end]);
  }
  const line3 = p => { ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y); ctx.lineTo(p[1].x, p[1].y); ctx.lineTo(p[2].x, p[2].y); ctx.stroke(); };
  ctx.strokeStyle = ink; ctx.lineWidth = 3.4;
  line3(arms[1]); for (const l of legs) line3(l);
  ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(sh.x, sh.y); ctx.stroke();
  line3(arms[0]);
  const hand = arms[0][2];
  if (o.swordAng !== undefined) { ctx.strokeStyle = '#b8864b'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(hand.x + Math.cos(o.swordAng) * 38, hand.y + Math.sin(o.swordAng) * 38); ctx.stroke(); ctx.strokeStyle = '#6a4a28'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(hand.x - Math.cos(o.swordAng) * 5, hand.y - Math.sin(o.swordAng) * 5); ctx.lineTo(hand.x + Math.cos(o.swordAng) * 3, hand.y + Math.sin(o.swordAng) * 3); ctx.stroke(); }
  if (o.hold === 'loaf') { ctx.fillStyle = '#c98a4a'; ctx.strokeStyle = '#7a4a1a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(hand.x + 3, hand.y - 3, 9, 5, -0.2, 0, 6.3); ctx.fill(); ctx.stroke(); }
  if (o.bandage === true) {
    proWrapSeg(hip, sh, 4, 3.0, 0.55); for (const a of arms) { proWrapSeg(a[0], a[1], 2, 1.7); proWrapSeg(a[1], a[2], 2, 1.5, 0.5); } for (const l of legs) { proWrapSeg(l[0], l[1], 2, 2.5, 0.4); proWrapSeg(l[1], l[2], 2, 2.2); }
  }
  ctx.fillStyle = '#f3efe4'; ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(hd.x, hd.y, 12.5, 0, 6.3); ctx.fill(); ctx.stroke();
  if (o.eyes === 'shut') { ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(hd.x + 5, hd.y - 1, 3, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); } else { ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(hd.x + 5, hd.y - 1, 2.8, 0, 6.3); ctx.fill(); }
  if (st > 0.3) { ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(hd.x + 6, hd.y + 6, 3, 2 + st * 2, 0, 0, 6.3); ctx.stroke(); }
  if (o.scarf) { ctx.strokeStyle = '#c0282d'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(sh.x - 3, sh.y - 1); ctx.lineTo(sh.x + 4, sh.y); ctx.moveTo(sh.x - 3, sh.y - 1); const k = Math.sin(tAnim * 4) * 3; ctx.quadraticCurveTo(sh.x - 14, sh.y + 4 + k, sh.x - 22, sh.y + 10 + k); ctx.stroke(); }
  ctx.restore();
}

// ---------------------------------------------------------------- a bonfire, the real thing: stones, stacked logs, layered flames, sparks and smoke
function proDrawBonfire(x, y, k, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  const fl = 0.9 + Math.sin(t * 9) * 0.06 + Math.sin(t * 5.3) * 0.05;
  ell(0, 6, 56, 15, 'rgba(0,0,0,0.35)'); ell(0, 3, 46, 11, '#2a2018'); ell(0, 3, 34, 8, '#171210');
  for (let i = 0; i < 11; i++) { const a = i / 11 * 6.283 + 0.2, sx = Math.cos(a) * 44, sy = Math.sin(a) * 11 + 3; ell(sx, sy + 2, 9, 6, 'rgba(0,0,0,0.3)'); ell(sx, sy, 8.5, 5.5, i % 2 ? '#7a7a82' : '#63636c'); ell(sx - 1.5, sy - 2, 5, 2, 'rgba(255,255,255,0.18)'); }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; const eg = ctx.createRadialGradient(0, 2, 2, 0, 2, 40); eg.addColorStop(0, `rgba(255,120,30,${0.8 * fl})`); eg.addColorStop(1, 'rgba(255,60,10,0)'); ctx.save(); ctx.scale(1, 0.3); ctx.fillStyle = eg; ctx.fillRect(-42, -30, 84, 70); ctx.restore(); ctx.restore();
  ctx.lineCap = 'round';
  for (const [bx, by, tx] of [[-30, 1, -5], [28, 2, 6], [-12, 8, 0], [14, 7, -3], [0, 3, 2]]) {                    // logs leaning against each other
    ctx.strokeStyle = '#3a2416'; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, -36); ctx.stroke(); ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(bx, by - 1); ctx.lineTo(tx, -36); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; for (let j = 1; j < 5; j++) { const q = j / 5; ctx.beginPath(); ctx.moveTo(bx + (tx - bx) * q - 3, by + (-36 - by) * q); ctx.lineTo(bx + (tx - bx) * q + 3, by + (-36 - by) * q + 2); ctx.stroke(); }
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [sc, col, hm] of [[1, 'rgba(255,60,10,0.75)', 1], [0.74, 'rgba(255,140,30,0.85)', 0.84], [0.48, 'rgba(255,215,100,0.9)', 0.68], [0.24, 'rgba(255,250,225,0.9)', 0.46]]) {
    for (let i = 0; i < 7; i++) {
      const ph = t * (5.5 + i * 0.8) + i * 1.9, a = (i - 3) / 3, bx = a * 26 * sc, h = (60 + 24 * Math.sin(ph) + 13 * Math.sin(ph * 2.3)) * hm * (1 - Math.abs(a) * 0.5), w = (13 + 4 * Math.sin(ph * 1.3)) * sc, sw = Math.sin(ph * 0.8) * 6 * sc + a * 5;
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(bx - w, -6); ctx.bezierCurveTo(bx - w * 1.1, -h * 0.4, bx + sw - w * 0.4, -h * 0.75, bx + sw, -h); ctx.bezierCurveTo(bx + sw + w * 0.4, -h * 0.75, bx + w * 1.1, -h * 0.4, bx + w, -6); ctx.closePath(); ctx.fill();
    }
  }
  for (let i = 0; i < 26; i++) {                                                                                  // sparks rising and drifting
    const age = (t * 0.5 + i * 0.0385) % 1, px = Math.sin(i * 5.1) * 24 * age + Math.sin(t * 2 + i) * 8 * age, py = -26 - age * 150;
    ctx.fillStyle = `rgba(255,${170 + (i % 3) * 25},70,${1 - age})`; ctx.beginPath(); ctx.arc(px, py, 1.9 * (1 - age) + 0.4, 0, 6.3); ctx.fill();
  }
  ctx.restore();
  for (let i = 0; i < 6; i++) { const age = (t * 0.2 + i / 6) % 1; ctx.fillStyle = `rgba(70,62,60,${0.16 * (1 - age)})`; ctx.beginPath(); ctx.arc(Math.sin(t + i * 2) * 10 * age + 4 * age, -70 - age * 120, 10 + age * 26, 0, 6.3); ctx.fill(); }
  ctx.restore();
}
function proFireGlow(x, y, r, a) {                                                  // the light of a fire on the ground and on whoever sits near it
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y - 10); ctx.scale(1, 0.62);
  const g = ctx.createRadialGradient(0, 0, 8, 0, 0, r); g.addColorStop(0, `rgba(255,150,50,${0.5 * a})`); g.addColorStop(0.5, `rgba(255,110,30,${0.2 * a})`); g.addColorStop(1, 'rgba(255,90,20,0)'); ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore();
}
const PRO_CAMP = { x: 1370, y: 985 };
// where everyone sits round the bonfire (offsets from the fire), and how
const PRO_SEATS = { maren: [-122, 8, 'sit'], orla: [-88, -54, 'knit'], hale: [-22, -72, 'stand'], dorn: [64, -60, 'sit'], garrick: [124, 6, 'stand'], tomas: [86, 64, 'sit'], sera: [-72, 64, 'sit'] };
function proDrawLog(x, y, len = 30) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, y + 3, len * 0.55, 5, 0, 0, 6.3); ctx.fill();
  ctx.fillStyle = '#6a4424'; ctx.beginPath(); ctx.roundRect(x - len / 2, y - 9, len, 12, 5); ctx.fill(); ctx.fillStyle = '#85582f'; ctx.fillRect(x - len / 2 + 4, y - 8, len - 8, 3); ctx.fillStyle = '#d9b27a'; ctx.beginPath(); ctx.ellipse(x + len / 2 - 2, y - 3, 3, 5, 0, 0, 6.3); ctx.fill(); ctx.strokeStyle = '#8a5a30'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x + len / 2 - 2, y - 3, 1.4, 2.6, 0, 0, 6.3); ctx.stroke();
}

// ---------------------------------------------------------------- memories: the kindnesses of the village, shown behind the words as the hero remembers them
function proMemFig(id, x, y, s, f, pose, set) {
  const m = (pro.mem = pro.mem || {})[id] || (pro.mem[id] = { ...pro.N[id], bubble: null, bubbleT: 0, _fv: f, _pb: 1 });
  m.x = 0; m.y = 0; m.f = f; m.scale = 1; m.alpha = 1; m.pose = pose || 'stand'; m.moving = !!(set && set.moving); if (m.moving) m.walkT += 0.1; m.swAng = undefined; m.lunge = 0; m.reach = 0; if (set) Object.assign(m, set);
  s *= 1.2; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); drawVillager(m); ctx.restore();
}
const proEz = k => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
const proLerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));
function proSparkle(x, y, t, n = 9, r = 22) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < n; i++) { const a = i / n * 6.283 + t * 0.8, d = r * (0.4 + 0.6 * ((t * 1.3 + i * 0.37) % 1)); ctx.fillStyle = `rgba(255,236,160,${1 - ((t * 1.3 + i * 0.37) % 1)})`; ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8 - 6, 2.2, 0, 6.3); ctx.fill(); } ctx.restore(); }
function proMemory(kind, t, a) {
  const W = 960, H = 540, fy = 440, night = kind === 'maren'; ctx.save(); ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, night ? '#2a1a14' : '#f6dfae'); g.addColorStop(0.62, night ? '#5a3018' : '#e8c07c'); g.addColorStop(0.62, night ? '#3a2a1a' : '#9aa65c'); g.addColorStop(1, night ? '#2a1c10' : '#6f8a46'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,240,200,0.35)'; for (let i = 0; i < 18; i++) { ctx.beginPath(); ctx.arc((i * 211 + t * (6 + i % 4)) % W, 60 + (i * 97) % 260, 2 + (i % 3), 0, 6.3); ctx.fill(); }
  if (kind === 'orla') {
    const L = proEz(t / 6), hx = proLerp(880, 600, (t - 0.4) / 2.6), moving = t > 0.4 && t < 3.0, worn = t > 6.2;
    ctx.fillStyle = '#7a5230'; ctx.fillRect(316, fy - 104, 10, 104); ctx.fillRect(316, fy - 22, 86, 9); ctx.fillRect(322, fy - 14, 8, 14); ctx.fillRect(386, fy - 14, 8, 14);
    proMemFig('orla', 352, fy, 2.3, 1, 'knit');
    ctx.save(); ctx.lineCap = 'round'; const sw = Math.sin(t * 2.2) * 6, ex = 410 + 190 * L;                                                         // the scarf grows and lies out along the floor
    ctx.strokeStyle = '#a81e22'; ctx.lineWidth = 17; ctx.globalAlpha = a * (worn ? Math.max(0, 1 - (t - 6.2) * 2) : 1); ctx.beginPath(); ctx.moveTo(404, fy - 34); ctx.bezierCurveTo(424, fy - 4, 430 + 80 * L, fy + 6 + sw * 0.4, ex, fy + 4 + sw * 0.3); ctx.stroke();
    ctx.strokeStyle = '#d94040'; ctx.lineWidth = 11; ctx.stroke(); ctx.strokeStyle = 'rgba(255,200,180,0.45)'; ctx.lineWidth = 2; ctx.setLineDash([5, 7]); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    ell(340 + Math.sin(t * 1.5) * 6, fy + 8, 15, 12, '#d94040'); ctx.strokeStyle = '#8a1a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(340 + Math.sin(t * 1.5) * 6, fy + 8, 8, 0.5, 5.5); ctx.stroke();
    proHeroFig(hx, fy, 2.3, -1, { bandage: true, walk: moving ? t * 5.2 : 0, amp: moving ? 0.9 : 0, bob: moving, lean: t > 3.4 ? 0.1 * proEz((t - 3.4) / 0.8) : 0, scarf: worn, hand: 0 });
    if (worn) proSparkle(hx - 14, fy - 98, t - 6.2, 10, 26);
  } else if (kind === 'dorn') {
    const hx = proLerp(840, 470, (t - 0.3) / 2.2), moving = t > 0.3 && t < 2.5, give = proEz((t - 2.6) / 2.0), took = t > 4.9, wavePhase = t > 5.2;
    ctx.save(); ctx.translate(300, fy + 16); ctx.scale(2.3, 2.3); proDrawStall(0, 0, 'food'); ctx.restore();
    proMemFig('dorn', 300, fy - 2, 2.3, 1, took ? (wavePhase ? 'wave' : 'stand') : (t > 2.6 ? 'offer' : 'stand'), { reach: give });
    proHeroFig(hx, fy, 2.3, -1, { bandage: true, scarf: true, walk: moving ? t * 5.4 : 0, amp: moving ? 1 : 0, bob: moving, reach: t > 3.4 && !took ? { x: 8 + 21 * proEz((t - 3.4) / 1.2), y: 6 } : (took ? { x: 14, y: 11 } : undefined), hold: took ? 'loaf' : undefined });
    if (took) { ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { const q = (t * 0.8 + i * 0.33) % 1; ctx.beginPath(); ctx.moveTo(hx - 54 + i * 6, fy - 112 - q * 34); ctx.quadraticCurveTo(hx - 50 + i * 6, fy - 122 - q * 34, hx - 54 + i * 6, fy - 132 - q * 34); ctx.stroke(); } }
    if (t > 5.4 && t < 8.4) { const k = (t - 5.4) / 3, cx = k < 0.5 ? proLerp(hx - 40, 380, k * 2) : proLerp(380, hx - 40, (k - 0.5) * 2), cy = fy - 118 - Math.sin(k * Math.PI) * 22; ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, 6.3); ctx.fill(); ctx.strokeStyle = '#a07a10'; ctx.lineWidth = 2; ctx.stroke(); }
  } else if (kind === 'tomas') {
    const hop = Math.abs(Math.sin(t * 3)), fx = proLerp(760, 700, 0.5 + Math.sin(t * 1.1) * 0.5);
    proMemFig('tomas', 310, fy, 2.6, 1, t > 5.2 ? 'cheer' : 'stand');
    proHeroFig(600, fy, 2.3, -1, { bandage: true, scarf: true, hand: t > 3 ? 0.55 : 0, lean: Math.sin(t * 2) * 0.03, eyes: t > 2.4 && t < 3.2 ? 'shut' : undefined });
    ctx.font = 'bold 30px Georgia, serif'; ctx.textAlign = 'center';
    for (let i = 0; i < 4; i++) { const k = (t * 0.6 + i * 0.25) % 1; ctx.globalAlpha = a * (1 - k); ctx.fillStyle = '#3a2a1a'; ctx.fillText(i % 2 ? '♪' : '♫', 400 + i * 28 + Math.sin(t * 2 + i) * 9, fy - 190 - k * 80); }
    if (t > 3) for (let i = 0; i < 2; i++) { const k = (t * 0.5 + i * 0.5) % 1; ctx.globalAlpha = a * (1 - k) * (t > 5 ? 1 : 0.6); ctx.font = `bold ${t > 5 ? 26 : 18}px Georgia, serif`; ctx.fillStyle = '#5a3a20'; ctx.fillText(t > 5 ? '♪' : '~', 560 - i * 22 + Math.sin(t * 3 + i) * 5, fy - 168 - k * 60); }
    ctx.globalAlpha = a; ell(fx, fy + 3, 17 - hop * 6, 5, 'rgba(0,0,0,0.25)'); ctx.fillStyle = '#4a9a4a'; ctx.beginPath(); ctx.ellipse(fx, fy - 12 - hop * 38, 15, 11 - hop * 2, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = '#3a7a3a'; ctx.beginPath(); ctx.ellipse(fx - 14, fy - 4 - hop * 20, 9, 4, -0.4, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(fx - 6, fy - 24 - hop * 38, 4, 0, 6.3); ctx.arc(fx + 6, fy - 24 - hop * 38, 4, 0, 6.3); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(fx - 5, fy - 24 - hop * 38, 1.6, 0, 6.3); ctx.arc(fx + 7, fy - 24 - hop * 38, 1.6, 0, 6.3); ctx.fill();
  } else if (kind === 'sera') {
    ctx.fillStyle = '#8b6a3f'; ctx.fillRect(536, fy - 38, 90, 10); ctx.fillRect(546, fy - 28, 9, 28); ctx.fillRect(606, fy - 28, 9, 28);
    proHeroFig(582, fy, 2.3, -1, { sit: true, bandage: true, hand: 0, eyes: Math.sin(t * 1.3) > 0.7 ? 'shut' : undefined });
    proMemFig('sera', 484, fy, 2.3, 1, 'tend');
    ctx.fillStyle = '#7a9a5a'; ctx.fillRect(250, fy - 44, 22, 30); ctx.fillStyle = '#a05a4a'; ctx.fillRect(282, fy - 40, 22, 26); ctx.fillStyle = '#4a3220'; ctx.fillRect(252, fy - 50, 18, 6); ctx.fillRect(284, fy - 46, 18, 6);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 12; i++) { const k = (t * 0.45 + i * 0.083) % 1; ctx.fillStyle = `rgba(150,255,170,${0.8 * (1 - k)})`; ctx.beginPath(); ctx.arc(566 + Math.sin(i * 3 + t) * 22, fy - 146 - k * 60, 2.4 * (1 - k) + 0.8, 0, 6.3); ctx.fill(); } ctx.restore();
  } else if (kind === 'garrick') {
    const T = 3.4, u = (t % T) / T, strike = proEz((u - 0.25) / 0.14), recover = proEz((u - 0.52) / 0.12), counter = proEz((u - 0.56) / 0.14), reset = proEz((u - 0.78) / 0.2);
    const gAng = u < 0.25 ? -0.8 + Math.sin(t * 3) * 0.06 : u < 0.52 ? proLerp(-1.3, 0.55, strike) : u < 0.78 ? proLerp(0.55, -0.1, recover) : proLerp(-0.1, -0.8, reset);
    const gLunge = u < 0.25 ? 0 : u < 0.52 ? strike : u < 0.78 ? 1 - recover * 1.3 : Math.max(0, 1 - reset);
    const hAng = u < 0.25 ? -0.5 : u < 0.36 ? proLerp(-0.5, -0.5, (u - 0.25) / 0.11) : u < 0.56 ? -0.62 : u < 0.72 ? proLerp(-0.62, 0.45, counter) : proLerp(0.45, -0.5, reset);
    const gx = 400 + gLunge * 26 - (u > 0.56 && u < 0.78 ? counter * 18 : 0), hx = 640 - (u > 0.3 && u < 0.5 ? proEz((u - 0.3) / 0.08) * 10 : 0) + (u > 0.56 && u < 0.72 ? counter * 22 : 0) - (u > 0.5 && u < 0.6 ? 0 : 0);
    proMemFig('garrick', gx, fy, 2.4, 1, 'spar', { swAng: gAng, lunge: gLunge > 0.5 && u < 0.5 ? gLunge : 0 });
    proHeroFig(hx, fy, 2.3, -1, { bandage: true, scarf: true, swordAng: hAng, arm: 0, lean: u > 0.56 && u < 0.72 ? 0.16 * counter : 0 });
    if (u > 0.34 && u < 0.5) { const k = (u - 0.34) / 0.16, cx = 560, cy = fy - 168; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,246,190,${1 - k})`; ctx.lineWidth = 3; for (let i = 0; i < 8; i++) { const an = i * 0.785; ctx.beginPath(); ctx.moveTo(cx + Math.cos(an) * (6 + k * 6), cy + Math.sin(an) * (6 + k * 6)); ctx.lineTo(cx + Math.cos(an) * (16 + k * 22), cy + Math.sin(an) * (16 + k * 22)); ctx.stroke(); } ctx.restore(); }
    if (u > 0.58 && u < 0.8) { ctx.fillStyle = '#4a2a10'; ctx.font = 'bold 26px Georgia, serif'; ctx.textAlign = 'center'; ctx.globalAlpha = a * Math.min(1, (0.8 - u) * 8); ctx.fillText('Ha!', gx + 6, fy - 238 - (u - 0.58) * 40); ctx.globalAlpha = a; }
    for (const px of [gx - 40, hx + 40]) { ctx.fillStyle = 'rgba(120,100,60,0.28)'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(px + Math.sin(t * 2 + i) * 10, fy - 2 - ((t * 20 + i * 9) % 18), 3 + (i % 2) * 2, 0, 6.3); ctx.fill(); } }
    ctx.fillStyle = '#6a4a28'; ctx.fillRect(838, fy - 110, 8, 110); ctx.fillRect(816, fy - 90, 52, 7); ctx.fillStyle = '#d8c27a'; ctx.beginPath(); ctx.arc(842, fy - 124, 14, 0, 6.3); ctx.fill();
  } else if (kind === 'maren') {
    const fx = 480, k = 1.5; proFireGlow(fx, fy, 380, 1);
    for (const [lx, ly] of [[290, fy + 6], [690, fy + 8], [360, fy + 50], [610, fy + 52]]) proDrawLog(lx, ly, 56);
    proMemFig('maren', 290, fy - 2, 2.1, 1, 'sit'); proMemFig('orla', 690, fy, 2.1, -1, 'knit'); proMemFig('tomas', 360, fy + 44, 2.0, 1, 'sit'); proHeroFig(610, fy + 46, 2.1, -1, { sit: true, scarf: true, bandage: true, eyes: Math.sin(t * 1.1) > 0.8 ? 'shut' : undefined });
    proDrawBonfire(fx, fy + 4, k, t);
  }
  // an old photograph: sepia, a soft vignette
  ctx.fillStyle = 'rgba(120,70,20,0.18)'; ctx.fillRect(0, 0, W, H); const vg = ctx.createRadialGradient(W / 2, H * 0.45, 230, W / 2, H * 0.45, 640); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,8,0,0.7)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ---------------------------------------------------------------- the village shops: the game's own shop window, with a few things on the shelf
const PRO_SVG = {
  'a loaf of bread': px => `<svg viewBox="0 0 28 28" width="${px}" height="${px}"><ellipse cx="14" cy="16" rx="11" ry="7" fill="#c98a4a" stroke="#17171f" stroke-width="1"/><path d="M8 12l3 6M13 11l3 7M18 12l3 6" stroke="#7a4a1a" stroke-width="1.4" stroke-linecap="round" fill="none"/><path d="M7 14q3-4 7-4" stroke="#f0c888" stroke-width="1.2" fill="none" stroke-opacity=".7"/></svg>`,
  'a honey cake': px => `<svg viewBox="0 0 28 28" width="${px}" height="${px}"><rect x="5" y="12" width="18" height="10" rx="1.5" fill="#e0b060" stroke="#17171f" stroke-width="1"/><rect x="5" y="12" width="18" height="4" fill="#f4d890"/><path d="M8 16v4M14 16v6M20 16v3" stroke="#d8902a" stroke-width="2.4" stroke-linecap="round"/><circle cx="14" cy="9" r="2.6" fill="#c0392b" stroke="#17171f" stroke-width=".8"/></svg>`,
  'a bag of apples': px => `<svg viewBox="0 0 28 28" width="${px}" height="${px}"><path d="M5 24l3-12h12l3 12z" fill="#9a7a4a" stroke="#17171f" stroke-width="1"/><circle cx="10" cy="11" r="4" fill="#c0392b" stroke="#17171f" stroke-width=".8"/><circle cx="16" cy="9" r="4" fill="#d44a3a" stroke="#17171f" stroke-width=".8"/><circle cx="20" cy="12" r="3.6" fill="#c0392b" stroke="#17171f" stroke-width=".8"/><path d="M16 5l1-2" stroke="#3a2a1a" stroke-width="1.2"/></svg>`,
  'a coil of rope': px => `<svg viewBox="0 0 28 28" width="${px}" height="${px}"><g fill="none" stroke="#c9b07a" stroke-width="2.6"><ellipse cx="13" cy="15" rx="9" ry="6.5"/><ellipse cx="13" cy="15" rx="6" ry="4"/><ellipse cx="13" cy="15" rx="3" ry="2"/></g><path d="M21 17q4 2 4 7" stroke="#c9b07a" stroke-width="2.6" fill="none" stroke-linecap="round"/><ellipse cx="13" cy="15" rx="9" ry="6.5" fill="none" stroke="#17171f" stroke-width=".6" stroke-opacity=".5"/></svg>`,
  'a box of nails': px => `<svg viewBox="0 0 28 28" width="${px}" height="${px}"><rect x="4" y="14" width="20" height="9" fill="#7a5a30" stroke="#17171f" stroke-width="1"/><rect x="4" y="14" width="20" height="3" fill="#9a7a4a"/><g stroke="#8a8f9c" stroke-width="1.6"><path d="M8 14l-1-9M12 14l1-10M16 14l-1-9M20 14l1-8"/></g><g fill="#b6bbc8"><rect x="4.6" y="3.4" width="5" height="2"/><rect x="10.6" y="2.4" width="5" height="2"/><rect x="12.6" y="3.4" width="5" height="2"/><rect x="18.6" y="4.4" width="5" height="2"/></g></svg>`,
  'an oak plank': px => `<svg viewBox="0 0 28 28" width="${px}" height="${px}"><rect x="3" y="10" width="22" height="9" fill="#b8864b" stroke="#17171f" stroke-width="1"/><path d="M5 14q5-3 9 0t9-1" stroke="#7a5226" stroke-width="1" fill="none"/><circle cx="19" cy="15.5" r="1.3" fill="#6a4a28"/><path d="M3 19l2 3h18l2-3" fill="#8a6030" stroke="#17171f" stroke-width=".8"/></svg>`,
};
const proTitle = s => s[0].toUpperCase() + s.slice(1);
function proShopOpen(n, items) {
  pro.shop = { n, items, sel: 0 }; vil = null;
  document.getElementById('shopTitle').textContent = n.id === 'dorn' ? "DORN'S BAKERY" : "HALE'S WORKSHOP";
  showMenu('shop'); proShopRender();
}
function proShopRender() {
  const sh = pro && pro.shop; if (!sh) return;
  const P = document.querySelector('.shop-panel'); P.classList.remove('upgrade', 'enchant'); P.classList.add('tiles');
  document.getElementById('shopGold').textContent = hero.gold.toLocaleString();
  const tiles = sh.items.map((it, i) => ({ id: String(i), svg: PRO_SVG[it.n](44), name: proTitle(it.n), color: hero.gold >= it.p ? '#ffd86a' : '#9a8a68', sub: `${it.p} g`, on: i === sh.sel, dim: hero.gold < it.p }));
  const it = sh.items[sh.sel], can = hero.gold >= it.p;
  const detail = tHead(PRO_SVG[it.n](56), proTitle(it.n), '#ffd86a', escapeHtml(sh.n.name)) + `<div class="tdesc">${escapeHtml(it.d)}</div><div class="srow"><span>Price</span><b>${it.p} g</b></div><div class="srow"><span>Your gold</span><b>${hero.gold.toLocaleString()} g</b></div><div class="ubuy"><button class="go" data-buy="pro" ${can ? '' : 'disabled'}>${can ? `Buy · ${it.p} g` : 'Not enough gold'}</button></div>`;
  document.getElementById('shopBody').innerHTML = tileShop(tiles, detail, 3);
}
document.getElementById('shop').addEventListener('click', e => {                     // the village stall: choosing and buying (the game's own handler only knows the real shops)
  if (!pro || !pro.shop) return;
  const tp = e.target.closest('[data-tpick]'), by = e.target.closest('[data-buy]');
  if (tp) { pro.shop.sel = +tp.dataset.tpick; sfx('tick'); proShopRender(); } else if (by) proBuy(pro.shop.sel); else return;
  e.stopImmediatePropagation();
}, true);
window.addEventListener('keydown', e => {                                            // the keys in the stall: arrows to choose, E or Enter to buy
  if (!pro || !pro.shop || openMenu !== 'shop' || e.repeat) return;
  const sh = pro.shop, n = sh.items.length, c = e.code;
  if (c === 'Enter' || isBound('interact', c)) proBuy(sh.sel);
  else if (c === 'ArrowLeft' || c === 'ArrowUp' || isBound('left', c) || isBound('up', c)) { sh.sel = (sh.sel + n - 1) % n; sfx('tick'); proShopRender(); }
  else if (c === 'ArrowRight' || c === 'ArrowDown' || isBound('right', c) || isBound('down', c)) { sh.sel = (sh.sel + 1) % n; sfx('tick'); proShopRender(); }
  else return;
  e.preventDefault(); e.stopImmediatePropagation();
}, true);

// ---------------------------------------------------------------- the forest edge: herbs to pick, and a bear
function proDrawHerb(h) {
  const t = tAnim, x = h.x, y = h.y, pulse = 0.5 + 0.5 * Math.sin(t * 4);
  ctx.save(); ell(x, y + 2, 16, 5, 'rgba(0,0,0,0.22)');
  ctx.strokeStyle = `rgba(255,236,150,${0.25 + 0.3 * pulse})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y + 1, 20 + pulse * 3, 7, 0, 0, 6.3); ctx.stroke();
  for (let i = -2; i <= 2; i++) { const sw = Math.sin(t * 1.6 + i) * 1.6; ctx.strokeStyle = i % 2 ? '#4f9a46' : '#6dbb5a'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x + i * 4, y); ctx.quadraticCurveTo(x + i * 5 + sw, y - 12, x + i * 7 + sw * 1.4, y - 20 - (i % 2) * 5); ctx.stroke(); }
  for (const [dx, dy] of [[-12, -22], [0, -26], [11, -21]]) { ctx.fillStyle = '#b48ae0'; ctx.beginPath(); ctx.arc(x + dx, y + dy, 3, 0, 6.3); ctx.fill(); ctx.fillStyle = '#f2e6ff'; ctx.beginPath(); ctx.arc(x + dx, y + dy, 1.1, 0, 6.3); ctx.fill(); }
  ctx.restore();
}
function proDrawBear(b) {
  const f = b.f, ink = '#1a1a1a', fur = '#5a3a24', fur2 = '#7a5638'; ctx.save(); ctx.translate(b.x, b.y); ctx.scale(f < 0 ? 1 : -1, 1);   // drawn facing left; f > 0 flips him
  ell(0, 3, 46, 9, 'rgba(0,0,0,0.3)'); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = ink;
  if (b.ph === 'grapple') {                                                                                          // up on his hind legs, paws at the hero's shoulders
    const sw = Math.sin(b.t * 14) * 3 + b.push * 5;
    ctx.fillStyle = fur; for (const lx of [-14, 12]) { ctx.beginPath(); ctx.roundRect(lx - 9, -34, 18, 34, 8); ctx.fill(); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(0, -62, 34, 38, 0, 0, 6.3); ctx.fill(); ctx.stroke(); ctx.fillStyle = fur2; ctx.beginPath(); ctx.ellipse(-6, -58, 20, 26, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = fur; for (const [ax, ay] of [[-36, -78 + sw], [-30, -56 - sw]]) { ctx.beginPath(); ctx.ellipse(ax, ay, 18, 9, -0.3, 0, 6.3); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#eee'; ctx.lineWidth = 1.6; for (let c = -1; c <= 1; c++) { ctx.beginPath(); ctx.moveTo(ax - 17, ay + c * 4); ctx.lineTo(ax - 24, ay + c * 5); ctx.stroke(); } ctx.strokeStyle = ink; ctx.lineWidth = 3; }
    ctx.fillStyle = fur; ctx.beginPath(); ctx.arc(-6, -104, 22, 0, 6.3); ctx.fill(); ctx.stroke(); for (const ex of [-22, 8]) { ctx.beginPath(); ctx.arc(ex, -122, 7, 0, 6.3); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = fur2; ctx.beginPath(); ctx.ellipse(-20, -98, 11, 9, 0, 0, 6.3); ctx.fill(); ctx.stroke(); ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(-26, -102, 3, 0, 6.3); ctx.fill(); ctx.beginPath(); ctx.arc(-6, -108, 2.6, 0, 6.3); ctx.fill();
    const jaw = 4 + Math.abs(Math.sin(b.t * 10)) * 5; ctx.fillStyle = '#7a1a1a'; ctx.beginPath(); ctx.ellipse(-20, -91 + jaw * 0.3, 9, jaw, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(-26, -93, 3, 4); ctx.fillRect(-16, -93, 3, 4);
  } else {                                                                                                          // on all fours: running
    const p = b.walkT, run = b.ph === 'charge' || b.ph === 'won';
    ctx.fillStyle = fur; for (const [lx, ph2] of [[-30, 0], [-18, Math.PI], [20, Math.PI * 0.5], [32, Math.PI * 1.5]]) { const sw = run ? Math.sin(p + ph2) * 11 : 0, lf = run ? Math.max(0, Math.cos(p + ph2)) * 7 : 0; ctx.beginPath(); ctx.moveTo(lx, -26); ctx.lineTo(lx + sw, -4 - lf); ctx.lineWidth = 11; ctx.strokeStyle = ink; ctx.stroke(); ctx.lineWidth = 8; ctx.strokeStyle = fur; ctx.stroke(); }
    ctx.lineWidth = 3; ctx.strokeStyle = ink; const bob = run ? Math.sin(p * 2) * 2.4 : 0; ctx.fillStyle = fur; ctx.beginPath(); ctx.ellipse(4, -38 + bob, 46, 28, 0, 0, 6.3); ctx.fill(); ctx.stroke(); ctx.fillStyle = fur2; ctx.beginPath(); ctx.ellipse(-22, -52 + bob, 18, 14, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = fur; ctx.beginPath(); ctx.arc(-50, -40 + bob, 19, 0, 6.3); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(-44, -58 + bob, 7, 0, 6.3); ctx.fill(); ctx.stroke(); ctx.fillStyle = fur2; ctx.beginPath(); ctx.ellipse(-64, -36 + bob, 10, 8, 0, 0, 6.3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(-69, -37 + bob, 2.6, 0, 6.3); ctx.fill(); ctx.beginPath(); ctx.arc(-52, -46 + bob, 2.4, 0, 6.3); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 2; if (b.ph === 'charge') { ctx.fillStyle = '#7a1a1a'; ctx.beginPath(); ctx.ellipse(-62, -30 + bob, 6, 4, 0, 0, 6.3); ctx.fill(); }
  }
  ctx.restore();
}
