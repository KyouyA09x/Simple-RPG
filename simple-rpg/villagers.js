// Village art: villagers, animals, buildings and small props, all drawn in code.
// Pure drawing: no game state is changed here. village.js owns the logic and calls these.

const hexToRgb = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mixHex = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const shadeHex = (h, k) => k < 0 ? mixHex(h, '#000000', -k) : mixHex(h, '#ffffff', k);
const ease01 = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const lerpN = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------- villagers
// A villager is a stick figure with clothes. n: { x, y, f (facing ±1), scale, pose, pt (pose time), walkT, moving,
// carry, alpha, ph, look: { body, apron, hat, hair, beard, dress, glasses, skin } }
function villagerPose(n, sh, f, s) {
  const pt = n.pt, mv = n._mv ?? (n.moving ? 1 : 0), R = { bh: null, fh: null, tool: null, lean: 0.02 + 0.10 * mv, hop: 0, sit: false, kick: 0 };
  const rest = () => { R.bh = { x: sh.x - f * 3 * s, y: sh.y + 17 * s }; R.fh = { x: sh.x + f * 5 * s, y: sh.y + 16 * s }; };
  switch (n.pose) {
    case 'chop': {
      const ph = (pt * 1.7) % 1, up = ph < 0.55 ? ease01(ph / 0.55) : ph < 0.68 ? 1 - (ph - 0.55) / 0.13 : 0;
      R.fh = { x: sh.x + f * (15 - up * 20) * s, y: sh.y + (14 - up * 31) * s };
      R.bh = { x: R.fh.x - f * 4 * s, y: R.fh.y + 4 * s };
      R.tool = { k: 'axe', a: lerpN(0.9, -2.2, up) }; R.lean = 0.08 + (1 - up) * 0.14;
      R.impact = ph >= 0.66 && ph < 0.7; break;
    }
    case 'hammer': {
      const ph = (pt * 1.15) % 1, up = ph < 0.6 ? ease01(ph / 0.6) : ph < 0.72 ? 1 - (ph - 0.6) / 0.12 : 0;
      R.fh = { x: sh.x + f * (13 - up * 7) * s, y: sh.y + (12 - up * 26) * s };
      R.bh = { x: sh.x + f * 16 * s, y: sh.y + 14 * s };
      R.tool = { k: 'hammer', a: lerpN(0.7, -1.9, up) }; R.lean = 0.09;
      R.impact = ph >= 0.7 && ph < 0.74; R.tongs = true; break;
    }
    case 'water': {
      const tilt = 0.35 + Math.sin(pt * 1.6) * 0.1;
      R.fh = { x: sh.x + f * 15 * s, y: sh.y + 9 * s }; R.bh = { x: sh.x + f * 9 * s, y: sh.y + 15 * s };
      R.tool = { k: 'can', a: tilt, full: true }; R.lean = 0.12; break;
    }
    case 'dip': {
      R.fh = { x: sh.x + f * 16 * s, y: sh.y + 20 * s }; R.bh = { x: sh.x + f * 12 * s, y: sh.y + 22 * s };
      R.tool = { k: 'can', a: 1.1 }; R.lean = 0.3; break;
    }
    case 'sweep': {
      const sw = Math.sin(pt * 5.2) * 9 * s;
      R.fh = { x: sh.x + f * 11 * s + sw * 0.5, y: sh.y + 13 * s }; R.bh = { x: sh.x + f * 14 * s + sw * 0.5, y: sh.y + 20 * s };
      R.tool = { k: 'broom', sw }; R.lean = 0.14; break;
    }
    case 'stir': {
      R.fh = { x: sh.x + f * (14 + Math.cos(pt * 4) * 5) * s, y: sh.y + (12 + Math.sin(pt * 4) * 3) * s };
      R.bh = { x: sh.x + f * 6 * s, y: sh.y + 17 * s }; R.tool = { k: 'spoon', a: 0.9 }; R.lean = 0.1; break;
    }
    case 'carry': {
      R.fh = { x: sh.x + f * 13 * s, y: sh.y + 12 * s }; R.bh = { x: sh.x + f * 10 * s, y: sh.y + 16 * s };
      R.tool = { k: 'carry', what: n.carry }; R.lean = 0.05; break;
    }
    case 'pray': {                                           // standing, head bowed, hands together
      R.fh = { x: sh.x + f * 7 * s, y: sh.y + 7 * s }; R.bh = { x: sh.x + f * 6 * s, y: sh.y + 8 * s }; R.lean = 0.2; break;
    }
    case 'sitpray': {                                        // seated on a pew, hands together
      R.sit = true; R.lean = 0.12; R.fh = { x: sh.x + f * 8 * s, y: sh.y + 9 * s }; R.bh = { x: sh.x + f * 7 * s, y: sh.y + 10 * s }; break;
    }
    case 'sit': case 'knit': {
      R.sit = true; R.lean = 0.02;
      R.fh = { x: sh.x + f * 12 * s, y: sh.y + 18 * s }; R.bh = { x: sh.x + f * 9 * s, y: sh.y + 19 * s };
      if (n.pose === 'knit') { R.tool = { k: 'knit', t: pt }; R.fh.x += Math.sin(pt * 6) * 1.5 * s; R.bh.x -= Math.sin(pt * 6) * 1.5 * s; }
      break;
    }
    case 'read': {
      R.fh = { x: sh.x + f * 12 * s, y: sh.y + 2 * s }; R.bh = { x: sh.x + f * 10 * s, y: sh.y + 6 * s };
      R.tool = { k: 'paper' }; break;
    }
    case 'wipe': {
      R.fh = { x: sh.x + f * (13 + Math.sin(pt * 7) * 7) * s, y: sh.y + 12 * s + Math.cos(pt * 7) * 2 * s };           // polishing a surface in front of them
      R.bh = { x: sh.x - f * 3 * s, y: sh.y + 17 * s }; R.lean = 0.07; break;
    }
    case 'wave': {
      R.fh = { x: sh.x + f * (21 + Math.sin(pt * 9) * 3) * s, y: sh.y - 21 * s + Math.cos(pt * 9) * 2 * s };            // a hand held up beside the head, waggling
      R.bh = { x: sh.x - f * 3 * s, y: sh.y + 17 * s }; break;
    }
    case 'cheer': {
      R.hop = Math.abs(Math.sin(pt * 7)) * 8 * s;
      R.fh = { x: sh.x + f * 8 * s, y: sh.y - 15 * s }; R.bh = { x: sh.x - f * 7 * s, y: sh.y - 14 * s }; break;
    }
    case 'kick': {
      R.fh = { x: sh.x + f * 10 * s, y: sh.y + 10 * s }; R.bh = { x: sh.x - f * 10 * s, y: sh.y + 12 * s }; R.lean = -0.1;
      R.kick = Math.sin(Math.min(1, pt / 0.3) * Math.PI); break;
    }
    case 'lean': {                                            // guard resting on a spear
      R.fh = { x: sh.x + f * 11 * s, y: sh.y + 10 * s }; R.bh = { x: sh.x + f * 11 * s, y: sh.y + 16 * s };
      R.tool = { k: 'spear' }; R.lean = 0.0; break;
    }
    default:
      rest();                                                  // standing, then blended into the walking swing as they start to move
      if (mv > 0.01) {
        const sw = Math.cos(n.walkT), wy = sh.y + (13 - Math.abs(Math.sin(n.walkT)) * 2) * s;
        R.bh = { x: lerpN(R.bh.x, sh.x - f * 9 * s * sw, mv), y: lerpN(R.bh.y, wy, mv) };
        R.fh = { x: lerpN(R.fh.x, sh.x + f * 9 * s * sw, mv), y: lerpN(R.fh.y, wy, mv) };
      }
      if (n.look && n.look.spear) R.tool = { k: 'spear' };
      if (n.carry && n.pose !== 'carry') { /* carried item shown only in the carry pose */ }
  }
  return R;
}

function drawTool(t, hand, f, s) {
  if (!t) return;
  const hx = hand.x, hy = hand.y;
  ctx.save();
  switch (t.k) {
    case 'axe': case 'hammer': {
      const len = (t.k === 'axe' ? 26 : 17) * s, dx = f * Math.cos(t.a), dy = Math.sin(t.a), ex = hx + dx * len, ey = hy + dy * len;
      ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 3 * s; line(hx - dx * 4, hy - dy * 4, ex, ey);
      const nx = -dy * f, ny = dx * f;
      if (t.k === 'axe') fillPoly([[ex + nx * 3, ey + ny * 3], [ex + nx * 9 + dx * 3, ey + ny * 9 + dy * 3], [ex + dx * 7 + nx * 2, ey + dy * 7 + ny * 2], [ex - nx * 3, ey - ny * 3]], '#b9bec6', '#555', 1);
      else fillPoly([[ex + nx * 6 - dx * 3, ey + ny * 6 - dy * 3], [ex + nx * 6 + dx * 4, ey + ny * 6 + dy * 4], [ex - nx * 6 + dx * 4, ey - ny * 6 + dy * 4], [ex - nx * 6 - dx * 3, ey - ny * 6 - dy * 3]], '#8a8f98', '#333', 1);
      break;
    }
    case 'can': {
      ctx.translate(hx, hy); ctx.rotate(f > 0 ? t.a : -t.a); ctx.scale(f, 1);
      ctx.fillStyle = '#7e8a93'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(-6 * s, -4 * s, 12 * s, 10 * s, 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -4 * s, 5 * s, Math.PI, 0); ctx.stroke();
      ctx.strokeStyle = '#7e8a93'; ctx.lineWidth = 3; line(5 * s, 0, 13 * s, -5 * s);
      break;
    }
    case 'broom': {
      const gx = hx + f * 6 * s + t.sw * 0.5, gy = hy + 24 * s;
      ctx.strokeStyle = '#8b6a3f'; ctx.lineWidth = 2.5 * s; line(hx - f * 4 * s, hy - 10 * s, gx, gy - 8 * s);
      ctx.strokeStyle = '#c9a85a'; ctx.lineWidth = 6 * s; line(gx, gy - 8 * s, gx + f * 3 * s, gy + 2 * s);
      break;
    }
    case 'spoon': {
      ctx.strokeStyle = '#8b6a3f'; ctx.lineWidth = 2.5 * s; line(hx, hy, hx + f * 9 * s, hy + 12 * s);
      break;
    }
    case 'carry': {
      if (t.what === 'log') { ctx.fillStyle = '#8a5a30'; ctx.strokeStyle = '#4a2c16'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(hx - 9 * s, hy - 5 * s, 22 * s, 9 * s, 4); ctx.fill(); ctx.stroke(); ell(hx + 13 * s, hy - 0.5 * s, 2.5 * s, 4 * s, '#d9b27a'); }
      else if (t.what === 'wood') { for (let i = 0; i < 3; i++) { ctx.fillStyle = i % 2 ? '#b98a52' : '#a87a44'; ctx.fillRect(hx - 8 * s, hy - 6 * s + i * 4 * s, 18 * s, 3.5 * s); } }
      else if (t.what === 'crate') { ctx.fillStyle = '#a9794a'; ctx.strokeStyle = '#4a2c16'; ctx.lineWidth = 1.2; ctx.fillRect(hx - 9 * s, hy - 10 * s, 18 * s, 14 * s); ctx.strokeRect(hx - 9 * s, hy - 10 * s, 18 * s, 14 * s); line(hx - 9 * s, hy - 3 * s, hx + 9 * s, hy - 3 * s); }
      break;
    }
    case 'knit': {
      ell(hx + f * 4 * s, hy + 6 * s, 5 * s, 4.5 * s, '#d9534f');
      ctx.strokeStyle = '#e8d7a0'; ctx.lineWidth = 1.5; line(hx - 5 * s, hy - 7 * s, hx + 3 * s, hy + 1 * s); line(hx + 5 * s, hy - 7 * s, hx - 2 * s, hy + 1 * s);
      break;
    }
    case 'paper': {
      ctx.fillStyle = '#efe6c8'; ctx.strokeStyle = '#8a7b55'; ctx.lineWidth = 1;
      ctx.fillRect(hx - 6 * s, hy - 11 * s, 12 * s, 15 * s); ctx.strokeRect(hx - 6 * s, hy - 11 * s, 12 * s, 15 * s);
      ctx.strokeStyle = '#8a7b55'; for (let i = 0; i < 4; i++) line(hx - 4 * s, hy - 8 * s + i * 3 * s, hx + 4 * s, hy - 8 * s + i * 3 * s);
      break;
    }
    case 'spear': {
      const sx = hx + f * 1 * s;
      ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 2.5 * s; line(sx, hy + 22 * s, sx, hy - 52 * s);
      fillPoly([[sx, hy - 66 * s], [sx - 4 * s, hy - 52 * s], [sx + 4 * s, hy - 52 * s]], '#c8ccd2', '#555', 1);
      break;
    }
  }
  ctx.restore();
}

function drawVillager(n) {
  const L = n.look || {}, s = n.scale || 1, x = n.x, y = n.y;
  const ink = '#1a1a1a';
  // smooth state, so nothing pops: turning round takes a moment (the figure narrows through the turn), walking eases in and out, poses blend into each other, sitting down is a motion
  const dtA = Math.max(0, Math.min(0.1, tAnim - (n._lt ?? tAnim))); n._lt = tAnim;
  const fWant = n.f || 1; if (n._fv === undefined) n._fv = fWant;
  n._fv += (fWant - n._fv) * Math.min(1, dtA * 11); if (Math.abs(fWant - n._fv) < 0.03) n._fv = fWant;
  const f = n._fv;
  const sitting = n.pose === 'sit' || n.pose === 'knit' || n.pose === 'sitpray', mvWant = n.moving && !sitting ? 1 : 0;
  n._mv = n._mv === undefined ? mvWant : n._mv + (mvWant - n._mv) * Math.min(1, dtA * 9);
  n._sk = n._sk === undefined ? (sitting ? 1 : 0) : n._sk + ((sitting ? 1 : 0) - n._sk) * Math.min(1, dtA * 8);
  const mvK = n._mv < 0.02 ? 0 : n._mv, sitK = n._sk < 0.02 ? 0 : n._sk > 0.98 ? 1 : n._sk;
  ctx.save();
  ctx.globalAlpha = n.alpha ?? 1;
  drawShadow(x, y, 11 * s);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = ink; ctx.lineWidth = 3 * (s < 0.9 ? 0.85 : 1);
  const br = n.pose === 'sit' || n.pose === 'knit' || n.pose === 'sitpray' ? 0 : Math.sin(tAnim * 2.4 + n.ph) * 1.1 * s;
  const sh0 = { x, y: y - 50 * s };
  const P = villagerPose(n, sh0, f, s);
  { const key = n.pose;                                          // a new pose: the hands glide from where they were to where they now belong
    if (n._pk !== key) { n._pk = key; n._pb = 0; n._fromB = n._lastB; n._fromF = n._lastF; }
    n._pb = Math.min(1, (n._pb ?? 1) + dtA / 0.22); const wB = ease01(n._pb);
    const rel = (h, from) => !h ? null : (from && wB < 1 ? { x: lerpN(from.x, h.x - sh0.x, wB) + sh0.x, y: lerpN(from.y, h.y - sh0.y, wB) + sh0.y } : h);
    const nb = rel(P.bh, n._fromB), nf = rel(P.fh, n._fromF);
    n._lastB = P.bh ? { x: (nb || P.bh).x - sh0.x, y: (nb || P.bh).y - sh0.y } : n._lastB; n._lastF = P.fh ? { x: (nf || P.fh).x - sh0.x, y: (nf || P.fh).y - sh0.y } : n._lastF;
    if (nb) P.bh = nb; if (nf) P.fh = nf; }
  const bounce = mvK ? Math.abs(Math.cos(n.walkT)) * 2 * s * mvK : 0;
  const yy = y - P.hop;
  const hipY = lerpN(yy - 25 * s + bounce, y - 8 * s, sitK);
  const hip = { x, y: hipY };
  const lean = P.lean;
  const neck = { x: x + f * Math.sin(lean) * 26 * s, y: hipY - Math.cos(lean) * 26 * s + br * 0.5 };
  const head = { x: neck.x + f * (Math.sin(lean) * 10 + 1.5) * s, y: neck.y - 11 * s + br * 0.2 };
  const sh = { x: neck.x, y: neck.y + 4 * s };
  // recompute arms against the real shoulder (the pose was built around an upright one)
  const dx = sh.x - sh0.x, dy = sh.y - sh0.y;
  for (const k of ['bh', 'fh']) if (P[k]) { P[k] = { x: P[k].x + dx, y: P[k].y + dy }; }

  // legs
  let legs;
  if (sitK > 0.5) {
    const k1 = { x: x + f * 14 * s, y: hipY }, k2 = { x: x + f * 11 * s, y: hipY + 1 * s };
    legs = [[hip, k1, { x: k1.x + f * 1 * s, y }], [hip, k2, { x: k2.x + f * 1 * s, y }]];
  } else {
    const Lg = 13.5 * s, fy = yy;
    let feet;
    if (n.pose === 'kick') feet = [{ x: x + f * (6 + P.kick * 16) * s, y: fy - P.kick * 9 * s }, { x: x - f * 5 * s, y: fy }];
    else {
      feet = [{ x: x + f * 6 * s, y: fy }, { x: x - f * 5 * s, y: fy }];
      if (mvK) { const wf = [footAt(x, fy, f, n.walkT, 14 * s * 0.85, 7 * s), footAt(x, fy, f, n.walkT + Math.PI, 14 * s * 0.85, 7 * s)]; feet = feet.map((p, i) => ({ x: lerpN(p.x, wf[i].x, mvK), y: lerpN(p.y, wf[i].y, mvK) })); }
    }
    legs = feet.map(ft => { const k = ik(hip.x, hip.y, ft.x, ft.y, Lg, Lg, -f); return [hip, k.j, k.e]; });
  }
  const trousers = L.legs || (L.body && !L.dress ? shadeHex(L.body, -0.55) : null), boots = L.boots || '#3b2a1e';
  ctx.strokeStyle = ink; ctx.lineWidth = 3.4 * (s < 0.9 ? 0.85 : 1);
  for (const l of legs) poly(...l);
  if (trousers) { ctx.strokeStyle = trousers; ctx.lineWidth = 2 * s; for (const l of legs) poly(...l); }
  for (const l of legs) ell(l[2].x + f * 2 * s, l[2].y - 1 * s, 4.6 * s, 2.5 * s, boots);                    // shoes
  ctx.strokeStyle = ink; ctx.lineWidth = 3 * (s < 0.9 ? 0.85 : 1);

  // dress / skirt
  if (L.dress) {
    ctx.fillStyle = L.dress; ctx.strokeStyle = shadeHex(L.dress, -0.45); ctx.lineWidth = 1.2;
    const bot = lerpN(yy - 5 * s, y - 4 * s, sitK), wy = hipY - 7 * s, wx = hip.x + (neck.x - hip.x) * 0.3;
    ctx.beginPath(); ctx.moveTo(neck.x - 5 * s, neck.y + 3 * s); ctx.lineTo(neck.x + 5 * s, neck.y + 3 * s); ctx.lineTo(wx + 5 * s, wy); ctx.lineTo(x + 13.5 * s, bot); ctx.lineTo(x - 13.5 * s, bot); ctx.lineTo(wx - 5 * s, wy); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = shadeHex(L.dress, -0.28); ctx.lineWidth = 2 * s; line(wx - 5 * s, wy, wx + 5 * s, wy);                // the sash at the waist
    ctx.strokeStyle = shadeHex(L.dress, 0.22); ctx.lineWidth = 1.6 * s; line(x - 12.5 * s, bot - 1.2 * s, x + 12.5 * s, bot - 1.2 * s);   // the hem
    if (L.stole) {
      ctx.fillStyle = L.stole; ctx.strokeStyle = shadeHex(L.stole, -0.4); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(neck.x - 2.6 * s, neck.y + 3 * s); ctx.lineTo(neck.x + 2.6 * s, neck.y + 3 * s); ctx.lineTo(x + 3.4 * s, bot); ctx.lineTo(x - 3.4 * s, bot); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = shadeHex(L.stole, -0.5); ctx.lineWidth = 1.3 * s; line(neck.x, neck.y + 6 * s, neck.x, neck.y + 15 * s); line(neck.x - 3 * s, neck.y + 9 * s, neck.x + 3 * s, neck.y + 9 * s);         // a little cross on the chest
    }
    ctx.strokeStyle = ink; ctx.lineWidth = 3 * (s < 0.9 ? 0.85 : 1);
  }
  // back arm
  const arm = (hand, front) => {
    const a = ik(sh.x, sh.y, hand.x, hand.y, 9.5 * s, 9.5 * s, f);
    poly(sh, a.j, a.e);
    const sl = L.sleeve || L.body || L.dress;
    if (sl) { ctx.save(); ctx.lineCap = 'butt'; ctx.strokeStyle = sl; ctx.lineWidth = 5.6 * s; poly(sh, a.j); ctx.lineWidth = 4.6 * s; poly(a.j, { x: a.j.x + (a.e.x - a.j.x) * 0.42, y: a.j.y + (a.e.y - a.j.y) * 0.42 });
      ctx.strokeStyle = shadeHex(sl, 0.3); ctx.lineWidth = 1.6 * s; const cx = a.j.x + (a.e.x - a.j.x) * 0.42, cy = a.j.y + (a.e.y - a.j.y) * 0.42; line(cx - 2.4 * s, cy - 0.4 * s, cx + 2.4 * s, cy + 0.4 * s); ctx.restore(); }
    return a.e;
  };
  if (P.bh) arm(P.bh, false);
  // torso + tunic
  ctx.strokeStyle = ink; poly(hip, neck);
  if (L.body && !L.dress) {
    const tx = neck.x - hip.x, ty = neck.y - hip.y, tl = Math.hypot(tx, ty) || 1, ux = tx / tl, uy = ty / tl, nx = -uy, ny = ux;           // up the body, and across it
    const P1 = (k, w) => ({ x: hip.x + ux * tl * k + nx * w * s, y: hip.y + uy * tl * k + ny * w * s });
    ctx.save(); ctx.fillStyle = L.body; ctx.strokeStyle = shadeHex(L.body, -0.5); ctx.lineWidth = 1.1; ctx.lineJoin = 'round';
    ctx.beginPath(); const pts = [P1(-0.18, 7), P1(0.05, 6.2), P1(0.55, 5.4), P1(0.98, 5.9), P1(0.98, -5.9), P1(0.55, -5.4), P1(0.05, -6.2), P1(-0.18, -7)];
    ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = shadeHex(L.body, 0.28); ctx.lineWidth = 1.5 * s; const c1 = P1(0.97, 4.4), c2 = P1(0.97, -4.4); line(c1.x, c1.y, c2.x, c2.y);        // the collar
    ctx.strokeStyle = shadeHex(L.body, -0.3); ctx.lineWidth = 1.4 * s; const h1 = P1(-0.16, 6.8), h2 = P1(-0.16, -6.8); line(h1.x, h1.y, h2.x, h2.y);       // the hem
    if (!L.apron && !L.belt) { ctx.strokeStyle = '#3a2a1c'; ctx.lineWidth = 2 * s; const b1 = P1(0.1, 6), b2 = P1(0.1, -6); line(b1.x, b1.y, b2.x, b2.y); ctx.fillStyle = '#d9b44a'; ctx.fillRect(hip.x + ux * tl * 0.1 - 1.2 * s + (f > 0 ? 1.5 * s : -1.5 * s), hip.y + uy * tl * 0.1 - 1.2 * s, 2.4 * s, 2.4 * s); }
    ctx.restore();
  }
  if (L.apron) {
    ctx.save(); ctx.strokeStyle = L.apron; ctx.lineWidth = 7 * s; ctx.lineCap = 'butt';
    poly({ x: hip.x + f * 1.2 * s, y: hip.y + 5 * s }, { x: lerpN(hip.x, neck.x, 0.78) + f * 1.2 * s, y: lerpN(hip.y, neck.y, 0.78) });
    ctx.strokeStyle = shadeHex(L.apron, -0.25); ctx.lineWidth = 1.2; line(hip.x - 3 * s, hip.y + 5 * s, hip.x + 3 * s, hip.y + 5 * s);
    ctx.restore();
  }
  if (L.belt) { ctx.save(); ctx.strokeStyle = L.belt; ctx.lineWidth = 2.5 * s; line(hip.x - 4 * s, hip.y - 3 * s, hip.x + 4 * s, hip.y - 3 * s); ctx.restore(); }
  // head
  const hr = 9.5 * s;
  ctx.fillStyle = L.skin || '#fff'; ctx.strokeStyle = ink; ctx.lineWidth = 2.6 * (s < 0.9 ? 0.9 : 1);
  ctx.beginPath(); ctx.arc(head.x, head.y, hr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (L.beard) {                                               // a crescent round the chin, the mouth stays visible above it
    ctx.fillStyle = L.beard; ctx.beginPath(); ctx.arc(head.x, head.y, hr, 0.85, Math.PI - 0.85);
    ctx.quadraticCurveTo(head.x, head.y + hr * 0.62, head.x + Math.cos(0.85) * hr, head.y + Math.sin(0.85) * hr); ctx.closePath(); ctx.fill();
  }
  if (L.hair && L.hat !== 'veil' && L.hat !== 'helmet' && L.hat !== 'cap' && L.hat !== 'smithcap' && L.hat !== 'beanie') { ctx.fillStyle = L.hair; ctx.beginPath(); ctx.arc(head.x - f * 1 * s, head.y - 1 * s, hr * 1.02, Math.PI * 1.1, Math.PI * 1.9); ctx.closePath(); ctx.fill(); }
  // face
  ctx.fillStyle = ink;
  const talking = !!n.talking && Math.sin(tAnim * 14) > 0;
  if (n.pose === 'sleep' || (Math.sin(tAnim * 0.9 + n.ph * 3) > 0.985)) ctx.fillRect(head.x + f * 2.5 * s, head.y - 2 * s, 3.5 * s * f, 1.2);
  else { ctx.beginPath(); ctx.arc(head.x + f * 4 * s, head.y - 2 * s, 1.7 * s, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = ink; ctx.lineWidth = 1.2;
  if (talking) { ctx.beginPath(); ctx.ellipse(head.x + f * 4 * s, head.y + 4 * s, 1.8 * s, 1.4 * s, 0, 0, Math.PI * 2); ctx.stroke(); }
  else if (n.happy || n.pose === 'cheer' || n.pose === 'wave') { ctx.beginPath(); ctx.arc(head.x + f * 3.5 * s, head.y + 2 * s, 3 * s, 0.2, Math.PI - 0.5); ctx.stroke(); }
  else line(head.x + f * 2 * s, head.y + 4.5 * s, head.x + f * 5.5 * s, head.y + 4.5 * s);
  if (L.glasses) { ctx.strokeStyle = '#333'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(head.x + f * 4 * s, head.y - 2 * s, 3.2 * s, 0, Math.PI * 2); ctx.stroke(); line(head.x + f * 0.8 * s, head.y - 2 * s, head.x - f * 6 * s, head.y - 3 * s); }
  if (L.cheek) { ctx.fillStyle = 'rgba(255,120,120,0.35)'; ctx.beginPath(); ctx.arc(head.x + f * 2 * s, head.y + 2.5 * s, 2.3 * s, 0, Math.PI * 2); ctx.fill(); }
  // hat
  drawHat(L.hat, L.hatColor || '#a44', head, hr, f, s);
  // front arm + tool
  ctx.strokeStyle = ink; ctx.lineWidth = 3 * (s < 0.9 ? 0.85 : 1);
  if (P.fh) {
    const e = arm(P.fh, true);
    if (P.tool) drawTool(P.tool, e, f, s);
    if (P.tongs) { ctx.strokeStyle = '#555'; ctx.lineWidth = 2; line(P.bh.x, P.bh.y, P.bh.x + f * 12 * s, P.bh.y + 6 * s); }
  } else if (P.tool) drawTool(P.tool, sh, f, s);
  if (L.spear && !P.tool) drawTool({ k: 'spear' }, P.fh || sh, f, s);
  ctx.restore();
  n._impact = P.impact;                                // village.js plays the hit sound/sparks on this edge
  n._hand = P.fh || sh;
}

function drawHat(kind, col, head, hr, f, s) {
  if (!kind) return;
  const hx = head.x, hy = head.y;
  ctx.save(); ctx.lineWidth = 1.4; ctx.strokeStyle = shadeHex(col, -0.5);
  switch (kind) {
    case 'straw':
      ell(hx, hy - hr * 0.55, hr * 1.9, hr * 0.38, '#e2c26a'); ctx.strokeStyle = '#8a6d25'; ctx.beginPath(); ctx.ellipse(hx, hy - hr * 0.55, hr * 1.9, hr * 0.38, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#e8cc7c'; ctx.beginPath(); ctx.arc(hx, hy - hr * 0.6, hr * 0.85, Math.PI, 0); ctx.fill(); ctx.stroke();
      ctx.fillStyle = col; ctx.fillRect(hx - hr * 0.85, hy - hr * 0.8, hr * 1.7, hr * 0.22);
      break;
    case 'cap':
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(hx, hy - hr * 0.25, hr * 1.02, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillRect(hx + f * hr * 0.2 - (f < 0 ? hr * 1.0 : 0), hy - hr * 0.4, hr * 1.0, hr * 0.25); break;
    case 'cone':
      fillPoly([[hx - hr * 1.15, hy - hr * 0.55], [hx + hr * 1.15, hy - hr * 0.55], [hx + f * hr * 0.3, hy - hr * 2.7]], col, shadeHex(col, -0.5), 1.4);
      ctx.fillStyle = '#e8c850'; ctx.fillRect(hx - hr * 1.0, hy - hr * 0.78, hr * 2.0, hr * 0.22); break;
    case 'kerchief':
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(hx, hy - hr * 0.1, hr * 1.06, Math.PI * 1.0, Math.PI * 2.0); ctx.closePath(); ctx.fill(); ctx.stroke();
      fillPoly([[hx - f * hr * 0.9, hy - hr * 0.2], [hx - f * hr * 1.9, hy + hr * 0.1], [hx - f * hr * 1.2, hy + hr * 0.6]], col, shadeHex(col, -0.5), 1); break;
    case 'helmet':
      ctx.fillStyle = '#aeb4bd'; ctx.beginPath(); ctx.arc(hx, hy - hr * 0.1, hr * 1.12, Math.PI * 1.0, Math.PI * 2.0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = col; ctx.fillRect(hx - 1.5 * s, hy - hr * 1.5, 3 * s, hr * 0.7);
      ctx.fillStyle = '#8c929b'; ctx.fillRect(hx + f * hr * 0.7 - 1.5 * s, hy - hr * 0.15, 3 * s, hr * 0.8); break;
    case 'beanie':
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(hx, hy - hr * 0.15, hr * 1.08, Math.PI * 1.0, Math.PI * 2.0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = shadeHex(col, 0.3); ctx.fillRect(hx - hr * 1.08, hy - hr * 0.35, hr * 2.16, hr * 0.32);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx, hy - hr * 1.25, hr * 0.32, 0, Math.PI * 2); ctx.fill(); break;
    case 'bun':
      ctx.fillStyle = '#e9e9ee'; ctx.beginPath(); ctx.arc(hx, hy - hr * 0.15, hr * 1.04, Math.PI * 1.0, Math.PI * 2.0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(hx - f * hr * 0.5, hy - hr * 1.18, hr * 0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); break;
    case 'veil':
      fillPoly([[hx - f * hr * 0.7, hy - hr * 0.5], [hx - f * hr * 1.7, hy + hr * 2.1], [hx - f * hr * 0.2, hy + hr * 1.9], [hx + f * hr * 0.1, hy]], col, shadeHex(col, -0.45), 1.2);
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(hx, hy - hr * 0.1, hr * 1.14, Math.PI * 0.96, Math.PI * 2.04); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e0b84a'; ctx.fillRect(hx - hr * 1.1, hy - hr * 0.62, hr * 2.2, hr * 0.2); ctx.fillStyle = '#fff'; ctx.fillRect(hx - 1.2 * s, hy - hr * 1.5, 2.4 * s, hr * 0.9); ctx.fillRect(hx - 3.2 * s, hy - hr * 1.18, 6.4 * s, 2 * s);   // a gold band and a small cross
      break;
    case 'smithcap':
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(hx, hy - hr * 0.2, hr * 1.04, Math.PI * 1.0, Math.PI * 2.0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = shadeHex(col, -0.25); ctx.fillRect(hx - hr * 1.04, hy - hr * 0.35, hr * 2.08, hr * 0.28); break;
  }
  ctx.restore();
}

// speech bubble above a head: wraps to up to three lines and stays inside the part of the village you can see
function drawBubble(x, y, text, a = 1) {
  ctx.save(); ctx.globalAlpha = a; ctx.font = '12px "Segoe UI", sans-serif'; ctx.textAlign = 'center';
  const maxW = 190, lines = []; let cur = '';
  for (const word of String(text).split(' ')) { const t = cur ? cur + ' ' + word : word; if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = word; } else cur = t; }
  if (cur) lines.push(cur);
  if (lines.length > 3) { lines.length = 3; lines[2] = lines[2].replace(/\s*\S*$/, '') + '…'; }
  const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 18, lh = 15, h = lines.length * lh + 9;
  let bx = x, by = y;
  if (typeof state !== 'undefined' && state === 'village') {
    const vw = VW / VIL_ZOOM;
    bx = Math.max(cam.x + w / 2 + 6, Math.min(cam.x + vw - w / 2 - 6, x)); by = Math.max(cam.y + h + 10, y);
  }
  ctx.fillStyle = 'rgba(255,252,240,0.96)'; ctx.strokeStyle = 'rgba(40,36,30,0.75)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.roundRect(bx - w / 2, by - h, w, h, 8); ctx.fill(); ctx.stroke();
  const tx = Math.max(bx - w / 2 + 12, Math.min(bx + w / 2 - 12, x));
  ctx.beginPath(); ctx.moveTo(tx - 5, by - 1); ctx.lineTo(Math.max(bx - w / 2 + 4, Math.min(bx + w / 2 - 4, x)), by + 6); ctx.lineTo(tx + 5, by - 1); ctx.fillStyle = 'rgba(255,252,240,0.96)'; ctx.fill();
  ctx.fillStyle = '#2a2620';
  lines.forEach((l, i) => ctx.fillText(l, bx, by - h + 15 + i * lh - 3));
  ctx.restore();
}

function drawDog(d) {
  const f = d.f, x = d.x, y = d.y, moving = d.moving, t = d.walkT, T = tAnim;
  ctx.save(); ctx.globalAlpha = d.alpha ?? 1;
  drawShadow(x, y, d.pose === 'sleep' ? 15 : 13);
  const fur = '#a8733f', dark = '#6e4524', belly = '#d7b078';
  ctx.lineCap = 'round';
  // ---- asleep: curled up, breathing, a twitching ear, little z's drifting up
  if (d.pose === 'sleep') {
    const br = Math.sin(T * 1.7 + d.ph) * 0.9;
    ell(x, y - 6 - br * 0.4, 15, 7 + br * 0.5, fur);                                 // body
    ell(x - f * 2, y - 3, 11, 3, belly);
    ell(x + f * 11, y - 5 + br * 0.2, 6, 5, fur);                                   // head resting on the paws
    ell(x + f * 14, y - 3, 3.4, 2.4, dark);                                         // muzzle
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x + f * 9, y - 7); ctx.lineTo(x + f * 11.5, y - 6.4); ctx.stroke();   // closed eye
    ell(x + f * 8, y - 10 + (Math.sin(T * 0.6) > 0.96 ? -1.5 : 0), 2.6, 4, dark);   // ear
    ell(x - f * 9, y - 8, 5, 3, dark);                                              // curled tail over the back legs
    ctx.fillStyle = '#bcd'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    for (let i = 0; i < 3; i++) { const p = ((T * 0.45 + i / 3) % 1); ctx.globalAlpha = (d.alpha ?? 1) * Math.sin(p * Math.PI) * 0.8; ctx.font = `bold ${8 + i * 2}px sans-serif`; ctx.fillText('z', x + f * (14 + p * 8), y - 14 - p * 20); }
    ctx.restore(); return;
  }
  const sit = d.pose === 'sit', sniff = d.pose === 'sniff';
  const gait = moving ? 1 : 0, bob = gait ? Math.abs(Math.sin(t)) * 1.6 : 0;
  const breath = Math.sin(T * 2.2 + d.ph) * 0.5;
  const happy = d.happy;
  ctx.strokeStyle = dark; ctx.lineWidth = 3;
  // ---- legs: diagonal pairs swing together; far legs drawn darker and first
  if (!sit) {
    const legs = [[f * 8, 0, 1], [f * 8, 1, 0], [-f * 9, 1, 1], [-f * 9, 0, 0]];
    legs.forEach(([ox, pair, far], i) => {
      const ph = t + (pair ? Math.PI : 0), lx = x + ox + (far ? -1.5 : 1.5);
      const lift = gait ? Math.max(0, -Math.sin(ph)) * 4.5 : 0, sw = gait ? Math.cos(ph) * 4.5 * f : 0;
      ctx.strokeStyle = far ? '#55361b' : dark;
      ctx.beginPath(); ctx.moveTo(lx, y - 9 - bob); ctx.lineTo(lx + sw * 0.5, y - 4.5 - lift * 0.6); ctx.lineTo(lx + sw, y - lift); ctx.stroke();
    });
  } else {
    ctx.strokeStyle = dark; line(x + f * 6, y - 11, x + f * 6, y);                    // front legs straight down
    ell(x - f * 5, y - 4, 8, 4.5, dark);                                               // haunch on the ground
  }
  // ---- body
  if (sit) { ctx.save(); ctx.translate(x - f * 3, y - 14); ctx.rotate(-f * 0.55); ell(0, 0, 11, 6.5 + breath * 0.3, fur); ell(f * 1, 3, 7, 3, belly); ctx.restore(); }
  else { ell(x, y - 12 - bob, 13, 6.5 + breath * 0.25, fur); ell(x + f, y - 9 - bob, 9, 3, belly); }
  // ---- head: sniffing drops it to the ground and jitters the nose, trotting bobs it, happy tilts it up
  const sniffDip = sniff ? (0.6 + 0.4 * Math.sin(T * 1.3)) : 0;
  const hx = x + f * (sit ? 8 : 14 + sniffDip * 3), hy = y - (sit ? 23 : 17) - bob + sniffDip * 10 - (happy && !sit ? 1.5 : 0) + (gait ? Math.sin(t * 2) * 0.7 : 0);
  ell(hx, hy, 6.5, 5.6, fur);
  ell(hx + f * 5, hy + 1.5 + (sniff ? Math.sin(T * 22) * 0.5 : 0), 3.6, 2.7, dark);          // snout
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(hx + f * 8, hy + 0.7, 1.2, 0, Math.PI * 2); ctx.fill();   // nose
  ctx.beginPath(); ctx.arc(hx + f * 2, hy - 1.6, 1.25, 0, Math.PI * 2); ctx.fill();                      // eye
  if (happy) { ctx.fillStyle = '#e8607a'; ctx.beginPath(); ctx.ellipse(hx + f * 6, hy + 4.4 + Math.abs(Math.sin(T * 9)) * 1.2, 1.6, 2.4, 0, 0, Math.PI * 2); ctx.fill(); }   // tongue
  // floppy ear: swings with the walk and flaps when happy
  const ear = (gait ? Math.sin(t * 2 - 0.8) * 2.2 : 0) + (happy ? Math.sin(T * 14) * 1.6 : 0);
  fillPoly([[hx - f * 2, hy - 4], [hx - f * 6 - ear * f * 0.3, hy - 8 + Math.abs(ear) * 0.5], [hx - f * 5.5, hy + 1.5], [hx - f * 0.5, hy - 3]], dark);
  // ---- tail: slow sway at rest, fast wag when happy, lifted while trotting
  const wag = Math.sin(T * (happy ? 20 : gait ? 8 : 4) + d.ph) * (happy ? 7 : 3);
  const tx = x - f * (sit ? 12 : 12), ty = y - (sit ? 6 : 14) - bob;
  ctx.strokeStyle = fur; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx - f * 7, ty - (gait ? 8 : 5) + wag * 0.4, tx - f * 9, ty - (gait ? 11 : 8) + wag); ctx.stroke();
  ctx.restore();
}

function drawHen(c) {
  const f = c.f, x = c.x, y = c.y;
  ctx.save(); ctx.globalAlpha = c.alpha ?? 1; drawShadow(x, y, 7, 0.2);
  const peck = c.pose === 'peck' ? Math.abs(Math.sin(c.pt * 9)) : 0, bob = c.moving ? Math.abs(Math.sin(c.walkT)) * 1 : 0;
  const body = c.col || '#f2eee4';
  ctx.strokeStyle = '#d6902a'; ctx.lineWidth = 1.5; line(x - 1, y - 4, x - 1, y); line(x + 2, y - 4, x + 2, y);
  ell(x, y - 7 - bob, 7, 5, body);
  fillPoly([[x - f * 6, y - 8 - bob], [x - f * 11, y - 14 - bob], [x - f * 8, y - 5 - bob]], shadeHex(body, -0.1));
  const hx = x + f * (6 + peck * 2), hy = y - 11 - bob + peck * 6;
  circ(hx, hy, 3.2, body);
  fillPoly([[hx + f * 3, hy - 0.5], [hx + f * 6.5, hy + 0.8 + peck], [hx + f * 3, hy + 1.6]], '#e8a030');
  circ(hx - f * 0.5, hy - 3.2, 1.3, '#d63a3a'); circ(hx + f * 1.2, hy - 0.6, 0.8, '#111');
  ctx.restore();
}

// ---------------------------------------------------------------- buildings
function winOffsets(w) { const o = [-(w / 2 - 30), (w / 2 - 30)]; if (w >= 220) o.push(-(w / 2 - 92), (w / 2 - 92)); return o; }

function drawBuilding(b, night, lit) {
  const x = b.x, y = b.y, w = b.w, wh = b.wh, rh = b.rh;
  ell(x, y + 3, w * 0.58, 11, 'rgba(0,0,0,0.24)');
  // foundation + wall
  ctx.fillStyle = shadeHex(b.wall, -0.3); ctx.fillRect(x - w / 2, y - 11, w, 11);
  ctx.fillStyle = b.wall; ctx.fillRect(x - w / 2, y - wh, w, wh - 11);
  ctx.strokeStyle = shadeHex(b.wall, -0.14); ctx.lineWidth = 1;
  for (let i = 1; i < w / 18; i++) line(x - w / 2 + i * 18, y - wh + 2, x - w / 2 + i * 18, y - 12);
  ctx.strokeStyle = shadeHex(b.wall, -0.28); line(x - w / 2, y - 11, x + w / 2, y - 11);
  // timber frame
  ctx.fillStyle = b.trim;
  ctx.fillRect(x - w / 2, y - wh, 6, wh); ctx.fillRect(x + w / 2 - 6, y - wh, 6, wh); ctx.fillRect(x - w / 2, y - wh, w, 5);
  ctx.fillRect(x - w / 2, y - wh * 0.5 - 2, w, 3);
  // windows (the glow at night is added by the lights pass)
  for (const dx of winOffsets(w)) {
    const wx = x + dx, wy = y - wh * 0.78, ww = 22, wi = 20;
    ctx.fillStyle = b.trim; ctx.fillRect(wx - ww / 2 - 2, wy - 2, ww + 4, wi + 4);
    ctx.fillStyle = lit ? '#ffd88a' : night ? '#2b3550' : '#9cc4e0'; ctx.fillRect(wx - ww / 2, wy, ww, wi);
    ctx.strokeStyle = b.trim; ctx.lineWidth = 2; line(wx, wy, wx, wy + wi); line(wx - ww / 2, wy + wi / 2, wx + ww / 2, wy + wi / 2);
    ctx.fillStyle = '#7a5a3a'; ctx.fillRect(wx - ww / 2 - 3, wy + wi + 2, ww + 6, 3);
    if (b.flowers) for (let i = 0; i < 4; i++) circ(wx - 8 + i * 5.4, wy + wi + 1, 2, ['#f28ab2', '#f4e04d', '#fff', '#e85a5a'][i]);
  }
  // door
  const dxx = x + (b.doorX || 0), dh = 38;
  ctx.fillStyle = shadeHex(b.trim, -0.15); ctx.beginPath(); ctx.moveTo(dxx - 13, y); ctx.lineTo(dxx - 13, y - dh + 10); ctx.arc(dxx, y - dh + 10, 13, Math.PI, 0); ctx.lineTo(dxx + 13, y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = b.trim; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = shadeHex(b.trim, -0.4); ctx.lineWidth = 1; line(dxx, y - dh + 1, dxx, y); line(dxx - 13, y - 18, dxx + 13, y - 18);
  circ(dxx + 7, y - 16, 1.6, '#e0b84a');
  if (lit) { ctx.fillStyle = 'rgba(255,200,110,0.22)'; ctx.fillRect(dxx - 12, y - dh + 8, 24, dh - 8); }
  // roof (hip roof seen from the front) with shingle rows
  const rl = x - w / 2 - 14, rr = x + w / 2 + 14, top = y - wh - rh, base = y - wh + 7;
  const roof = b.roof;
  ctx.beginPath(); ctx.moveTo(rl, base); ctx.lineTo(x - w / 2 + 20, top); ctx.lineTo(x + w / 2 - 20, top); ctx.lineTo(rr, base); ctx.closePath();
  ctx.fillStyle = roof; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = shadeHex(roof, -0.28); ctx.lineWidth = 1.2;
  for (let yy = top + 7, k = 0; yy < base; yy += 7, k++) {
    line(rl, yy, rr, yy);
    for (let xx = rl + (k % 2 ? 9 : 0); xx < rr; xx += 18) line(xx, yy, xx, yy + 7);
  }
  const g = ctx.createLinearGradient(0, top, 0, base); g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = g; ctx.fillRect(rl, top, rr - rl, base - top);
  ctx.restore();
  ctx.strokeStyle = shadeHex(roof, -0.5); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(rl, base); ctx.lineTo(x - w / 2 + 20, top); ctx.lineTo(x + w / 2 - 20, top); ctx.lineTo(rr, base); ctx.closePath(); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(rl + 4, base, rr - rl - 8, 5);        // eave shadow on the wall
  // chimney
  if (b.chimney !== false) {
    const cx = x + w * 0.26;
    ctx.fillStyle = shadeHex(b.wall, -0.35); ctx.fillRect(cx, top - 10, 14, rh * 0.62 + 10); ctx.fillStyle = shadeHex(b.wall, -0.5); ctx.fillRect(cx - 2, top - 12, 18, 4);
  }
  // hanging sign
  if (b.sign) drawSign(b, x - w / 2 - 6, y - wh * 0.42);
  if (b.church) drawChurchFront(b, night, lit);
  if (b.id === 'enchant') drawEnchantAura(b, night);
  if (b.id === 'craft') drawCraftBoards(b, night);
}
// the church: stained glass, a rose window, a tall arched door and a bell tower with a spire
function drawChurchFront(b, night, lit) {
  const x = b.x, y = b.y, w = b.w, wh = b.wh, rh = b.rh, top = y - wh - rh, glass = ['#3f6fd0', '#c0392b', '#e0b84a', '#3f9a5a', '#8a4fd0'], t = typeof vil !== 'undefined' && vil ? vil.t : 0;
  winOffsets(w).forEach((dx, i) => {
    const wx = x + dx, wy = y - wh * 0.78;
    ctx.fillStyle = glass[i % glass.length]; ctx.beginPath(); ctx.moveTo(wx - 11, wy + 20); ctx.lineTo(wx - 11, wy + 7); ctx.arc(wx, wy + 7, 11, Math.PI, 0); ctx.lineTo(wx + 11, wy + 20); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(wx - 9, wy + 2, 5, 17);
    ctx.strokeStyle = b.trim; ctx.lineWidth = 1.6; line(wx, wy - 4, wx, wy + 20); line(wx - 11, wy + 11, wx + 11, wy + 11);
  });
  const rx = x, ry = y - wh * 0.74;                                                      // the rose window above the door
  circ(rx, ry, 17, b.trim); for (let i = 0; i < 8; i++) { ctx.fillStyle = glass[i % glass.length]; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.arc(rx, ry, 14, i * Math.PI / 4, (i + 1) * Math.PI / 4); ctx.closePath(); ctx.fill(); }
  ctx.strokeStyle = b.trim; ctx.lineWidth = 1.4; for (let i = 0; i < 8; i++) line(rx, ry, rx + Math.cos(i * Math.PI / 4) * 14, ry + Math.sin(i * Math.PI / 4) * 14); circ(rx, ry, 3.2, '#f3e6b0');
  const dxx = x + (b.doorX || 0);
  ctx.fillStyle = shadeHex(b.wall, -0.22); ctx.beginPath(); ctx.moveTo(dxx - 24, y); ctx.lineTo(dxx - 24, y - 36); ctx.arc(dxx, y - 36, 24, Math.PI, 0); ctx.lineTo(dxx + 24, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5a3a22'; ctx.beginPath(); ctx.moveTo(dxx - 19, y); ctx.lineTo(dxx - 19, y - 34); ctx.arc(dxx, y - 34, 19, Math.PI, 0); ctx.lineTo(dxx + 19, y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#d9b44a'; ctx.lineWidth = 1.8; ctx.stroke(); ctx.strokeStyle = '#2a1a0e'; ctx.lineWidth = 1.2; line(dxx, y - 53, dxx, y); line(dxx - 19, y - 18, dxx + 19, y - 18);
  circ(dxx - 5, y - 20, 1.7, '#e0b84a'); circ(dxx + 5, y - 20, 1.7, '#e0b84a');
  if (lit) { ctx.fillStyle = 'rgba(255,200,110,0.22)'; ctx.fillRect(dxx - 18, y - 52, 36, 52); }
  ctx.fillStyle = '#e8dcc0'; ctx.fillRect(dxx - 30, y - 1, 60, 3);                       // the step
  const tw = 48, tb = top + 16, tt = top - 64;                                           // the bell tower on the roof
  ctx.fillStyle = shadeHex(b.wall, -0.06); ctx.fillRect(x - tw / 2, tt, tw, tb - tt);
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x + tw / 2 - 10, tt, 10, tb - tt);
  ctx.strokeStyle = shadeHex(b.wall, -0.2); ctx.lineWidth = 1; for (let yy = tt + 9; yy < tb; yy += 9) line(x - tw / 2, yy, x + tw / 2, yy);
  ctx.strokeStyle = b.trim; ctx.lineWidth = 2.4; ctx.strokeRect(x - tw / 2, tt, tw, tb - tt);
  ctx.fillStyle = '#23222c'; ctx.beginPath(); ctx.moveTo(x - 10, tt + 40); ctx.lineTo(x - 10, tt + 22); ctx.arc(x, tt + 22, 10, Math.PI, 0); ctx.lineTo(x + 10, tt + 40); ctx.closePath(); ctx.fill();
  const sw = Math.sin(t * 1.4) * 0.12; ctx.save(); ctx.translate(x, tt + 15); ctx.rotate(sw); ctx.fillStyle = '#e0b84a'; ctx.beginPath(); ctx.moveTo(-5, 18); ctx.quadraticCurveTo(-6, 6, 0, 3); ctx.quadraticCurveTo(6, 6, 5, 18); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#7a5a10'; ctx.lineWidth = 1; ctx.stroke(); circ(0, 19, 1.8, '#7a5a10'); ctx.restore();
  fillPoly([[x - tw / 2 - 6, tt + 1], [x + tw / 2 + 6, tt + 1], [x, tt - 56]], b.roof, shadeHex(b.roof, -0.5), 2);
  ctx.strokeStyle = '#d9b44a'; ctx.lineWidth = 2.4; line(x, tt - 56, x, tt - 76); line(x - 7, tt - 67, x + 7, tt - 67);
  if (night) ell(x, tt - 70, 18, 18, 'rgba(255,225,150,0.16)');
}
// the inside of the church (drawn alone on the screen): a stone floor with a red runner, pews, an altar and a hovering light. o = the room's top-left corner, in village coordinates.
function drawChurchRoom(v, o) {
  const W = CHURCH.w, H = CHURCH.h, t = v.t, ox = o.x, oy = o.y, glass = ['#3f6fd0', '#c0392b', '#e0b84a', '#3f9a5a'];
  ctx.fillStyle = '#d3cab6'; ctx.fillRect(ox, oy, W, H);
  for (let r = 0; r * 22 < H - 100; r++) for (let c = 0; c * 40 < W; c++) { ctx.fillStyle = (r + c) % 2 ? '#c9bfa8' : '#d6cdb8'; ctx.fillRect(ox + c * 40 - (r % 2 ? 20 : 0), oy + 104 + r * 22, 40, 22); }
  ctx.fillStyle = '#b9ae96'; ctx.fillRect(ox, oy, W, 104);                                                       // the back wall
  ctx.strokeStyle = 'rgba(0,0,0,0.10)'; ctx.lineWidth = 1; for (let yy = 12; yy < 104; yy += 16) line(ox, oy + yy, ox + W, oy + yy); for (let r = 0; r < 6; r++) for (let xx = (r % 2) * 20; xx < W; xx += 40) line(ox + xx, oy + 12 + r * 16, ox + xx, oy + 28 + r * 16);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(ox, oy + 96, W, 8);
  const lights = [];
  [[110, 0], [320, 1], [530, 2]].forEach(([wx, k]) => {                                                         // three tall windows of coloured glass
    const big = wx === 320, ww = big ? 40 : 28, hh = big ? 78 : 66, wy = oy + 96 - hh;
    ctx.fillStyle = '#4a3f33'; ctx.beginPath(); ctx.moveTo(ox + wx - ww - 4, oy + 98); ctx.lineTo(ox + wx - ww - 4, wy + ww); ctx.arc(ox + wx, wy + ww, ww + 4, Math.PI, 0); ctx.lineTo(ox + wx + ww + 4, oy + 98); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 4; i++) { ctx.fillStyle = glass[(i + k) % 4]; ctx.beginPath(); ctx.rect(ox + wx - ww + (i % 2) * ww, wy + ww - 10 + Math.floor(i / 2) * ((hh - ww + 10) / 2), ww, (hh - ww + 10) / 2); ctx.fill(); }
    ctx.fillStyle = glass[(k + 1) % 4]; ctx.beginPath(); ctx.arc(ox + wx, wy + ww, ww, Math.PI, 0); ctx.lineTo(ox + wx + ww, wy + ww - 10); ctx.lineTo(ox + wx - ww, wy + ww - 10); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#4a3f33'; ctx.lineWidth = 2; line(ox + wx, wy, ox + wx, oy + 96); line(ox + wx - ww, wy + ww + 14, ox + wx + ww, wy + ww + 14);
    lights.push([ox + wx, k]);
  });
  ctx.save(); ctx.globalCompositeOperation = 'lighter';                                                         // coloured light falling on the floor
  for (const [lx, k] of lights) { const g = ctx.createLinearGradient(0, oy + 104, 0, oy + 240); const c = ['63,111,208', '192,57,43', '224,184,74'][k]; g.addColorStop(0, `rgba(${c},0.20)`); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(lx - 22, oy + 104); ctx.lineTo(lx + 22, oy + 104); ctx.lineTo(lx + 64, oy + 240); ctx.lineTo(lx - 12, oy + 240); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = '#7a1f2a'; ctx.fillRect(ox + 294, oy + 158, 52, H - 158); ctx.fillStyle = '#d9b44a'; ctx.fillRect(ox + 294, oy + 158, 3, H - 158); ctx.fillRect(ox + 343, oy + 158, 3, H - 158);      // the runner
  ctx.fillStyle = '#a79d86'; ctx.fillRect(ox + 220, oy + 100, 200, 62); ctx.fillStyle = '#c4baa2'; ctx.fillRect(ox + 220, oy + 100, 200, 8); ctx.fillStyle = '#b2a78f'; ctx.fillRect(ox + 238, oy + 152, 164, 10);   // the dais
  ctx.fillStyle = '#7a1f2a'; ctx.fillRect(ox + 294, oy + 108, 52, 50);
  ctx.fillStyle = '#4a3f33'; ctx.fillRect(ox, oy, 14, H); ctx.fillRect(ox + W - 14, oy, 14, H); ctx.fillStyle = '#6a5d4b'; ctx.fillRect(ox + 10, oy, 6, H); ctx.fillRect(ox + W - 16, oy, 6, H);       // the side walls
  [60, 580].forEach(bx => { ctx.fillStyle = '#7a1f2a'; ctx.fillRect(ox + bx - 9, oy + 8, 18, 56); fillPoly([[ox + bx - 9, oy + 64], [ox + bx + 9, oy + 64], [ox + bx, oy + 74]], '#7a1f2a', null); ctx.fillStyle = '#d9b44a'; ctx.fillRect(ox + bx - 1.2, oy + 18, 2.4, 22); ctx.fillRect(ox + bx - 5, oy + 24, 10, 2.4); });
  // the doorway: a bright arch in the south wall
  const dg = ctx.createLinearGradient(0, oy + H - 26, 0, oy + H); dg.addColorStop(0, 'rgba(255,244,208,0)'); dg.addColorStop(1, 'rgba(255,244,208,0.85)'); ctx.fillStyle = dg; ctx.fillRect(ox + 284, oy + H - 26, 72, 26);
  ctx.fillStyle = '#4a3f33'; ctx.fillRect(ox + 276, oy + H - 6, 8, 6); ctx.fillRect(ox + 356, oy + H - 6, 8, 6);
}
function drawChurchPot(p, t) {                                                                                   // a flowerpot; the flowers perk up and sparkle after a watering
  ell(p.x, p.y + 1, 11, 4, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = '#b5653a'; ctx.beginPath(); ctx.moveTo(p.x - 8, p.y - 11); ctx.lineTo(p.x + 8, p.y - 11); ctx.lineTo(p.x + 6, p.y); ctx.lineTo(p.x - 6, p.y); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#c97a48'; ctx.fillRect(p.x - 9, p.y - 13, 18, 4);
  const w = p.wet || 0, cols = ['#f28ab2', '#f4e04d', '#ffffff', '#b99bff', '#ff9a6a'];
  for (let i = 0; i < 5; i++) { const sx = p.x - 8 + i * 4, h = 12 + (i % 2) * 5 + w * 3 + Math.sin(t * 1.6 + i + p.x) * 0.8; ctx.strokeStyle = '#3f8a3a'; ctx.lineWidth = 1.6; line(p.x - 6 + i * 3, p.y - 12, sx, p.y - 12 - h); circ(sx, p.y - 13 - h, 3, cols[(i + (p.k | 0)) % 5]); }
  if (w > 0.2) { ctx.fillStyle = `rgba(166,216,255,${w * 0.6})`; for (let i = 0; i < 3; i++) circ(p.x - 6 + i * 6, p.y - 24 - ((t * 20 + i * 7) % 8), 1.4, ctx.fillStyle); }
}
function drawChurchPew(p) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(p.x0 + 2, p.y1 - 1, p.x1 - p.x0, 4);
  ctx.fillStyle = '#5a3a22'; ctx.fillRect(p.x0, p.y0 - 12, p.x1 - p.x0, 8);                                       // the back
  ctx.fillStyle = '#7a5230'; ctx.fillRect(p.x0, p.y0 - 4, p.x1 - p.x0, p.y1 - p.y0 + 4);                       // the seat
  ctx.fillStyle = '#4a2c18'; ctx.fillRect(p.x0 - 2, p.y0 - 12, 4, p.y1 - p.y0 + 12); ctx.fillRect(p.x1 - 2, p.y0 - 12, 4, p.y1 - p.y0 + 12);
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(p.x0, p.y0 - 4, p.x1 - p.x0, 2);
}
function drawChurchAltar(a, t) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ell(a.x, a.y + 2, 54, 7, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = '#e8e2d2'; ctx.fillRect(a.x - 46, a.y - 26, 92, 26); ctx.fillStyle = '#d9b44a'; ctx.fillRect(a.x - 46, a.y - 8, 92, 3); ctx.fillStyle = '#7a1f2a'; ctx.fillRect(a.x - 46, a.y - 26, 92, 5);
  ctx.fillStyle = '#d9b44a'; ctx.fillRect(a.x - 1.6, a.y - 22, 3.2, 14); ctx.fillRect(a.x - 5, a.y - 18, 10, 3);
  for (const dx of [-34, 34]) { ctx.fillStyle = '#efe6c8'; ctx.fillRect(a.x + dx - 2.5, a.y - 40, 5, 14); const fl = 1 + Math.sin(t * 9 + dx) * 0.2; ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.ellipse(a.x + dx, a.y - 44, 2.6, 4.5 * fl, 0, 0, Math.PI * 2); ctx.fill(); ell(a.x + dx, a.y - 44, 13, 13, 'rgba(255,210,120,0.20)'); }
}
function drawChurchLight(cx, cy, t) {                                                                           // the light of return: a slow orb with a ring of rays
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 46); g.addColorStop(0, 'rgba(255,240,200,0.55)'); g.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = g; ctx.fillRect(cx - 50, cy - 50, 100, 100);
  ctx.strokeStyle = 'rgba(255,236,170,0.5)'; ctx.lineWidth = 1.6; for (let i = 0; i < 10; i++) { const a = t * 0.4 + i * Math.PI / 5, r0 = 13, r1 = 22 + Math.sin(t * 2 + i) * 4; line(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.8, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.8); }
  ctx.restore(); circ(cx, cy, 7 + Math.sin(t * 2.4) * 0.8, '#fff6d6');
}
// the Crafting Hall: shutters over the windows, planks across the door, a banner (it opens in a later update)
function drawCraftBoards(b, night) {
  const x = b.x, y = b.y, w = b.w, wh = b.wh, dxx = x + (b.doorX || 0);
  for (const dx of winOffsets(w)) { const wx = x + dx, wy = y - wh * 0.78; ctx.fillStyle = '#6a4a2e'; ctx.strokeStyle = '#2a1a0e'; ctx.lineWidth = 1.2; ctx.fillRect(wx - 12, wy, 24, 20); ctx.strokeRect(wx - 12, wy, 24, 20); line(wx - 12, wy + 7, wx + 12, wy + 7); line(wx - 12, wy + 14, wx + 12, wy + 14); }
  ctx.fillStyle = '#7a5a38'; ctx.strokeStyle = '#2a1a0e'; ctx.lineWidth = 1.4;
  ctx.save(); ctx.translate(dxx, y - 20); ctx.rotate(-0.35); ctx.fillRect(-20, -3, 40, 6); ctx.strokeRect(-20, -3, 40, 6); ctx.rotate(0.7); ctx.fillRect(-20, -3, 40, 6); ctx.strokeRect(-20, -3, 40, 6); ctx.restore();
  ctx.fillStyle = '#c9a86a'; ctx.beginPath(); ctx.roundRect(dxx - 37, y - wh - 4 + 22, 74, 15, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3a2a1a'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('OPENING SOON', dxx, y - wh + 33); ctx.textAlign = 'left';
  if (gfx.particles && Math.random() < 0.02) particles.push({ x: b.chim.x + 7, y: b.chim.y, vx: 6, vy: -18, life: 1.2, max: 1.2, size: 3, color: 'rgba(200,200,200,0.45)' });
}
// the enchantress's house: a crystal on the roof and a ring of little runes turning above it
function drawEnchantAura(b, night) {
  const t = typeof vil !== 'undefined' && vil ? vil.t : 0, top = b.y - b.wh - b.rh, cols = ['#ff9a4a', '#6fb5ff', '#c36bff', '#5fd07a', '#3ff2e0', '#ffd24a'];
  const pulse = 0.55 + 0.45 * Math.sin(t * 2.2), cy = top - 11;
  ell(b.x, cy, 22 + pulse * 6, 12 + pulse * 3, night ? 'rgba(190,150,255,0.30)' : 'rgba(190,150,255,0.16)');
  ctx.fillStyle = '#bfe8ff'; ctx.strokeStyle = '#33265c'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(b.x, cy - 9); ctx.lineTo(b.x + 6, cy); ctx.lineTo(b.x, cy + 9); ctx.lineTo(b.x - 6, cy); ctx.closePath(); ctx.fill(); ctx.stroke();
  for (let i = 0; i < cols.length; i++) {
    const a = t * 0.7 + i * (Math.PI * 2 / cols.length), px = b.x + Math.cos(a) * 56, py = cy - 8 + Math.sin(a) * 8 + Math.sin(t * 1.6 + i) * 2.5, back = Math.sin(a) < 0;
    ctx.globalAlpha = back ? 0.55 : 1; ell(px, py, 6, 6, cols[i] + '40');
    ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.moveTo(px, py - 4.2); ctx.lineTo(px + 3, py); ctx.lineTo(px, py + 4.2); ctx.lineTo(px - 3, py); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawSign(b, sx, sy) {
  ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2.5; line(sx, sy - 10, sx - 26, sy - 10); line(sx - 2, sy - 10, sx - 2, sy - 3);
  ctx.fillStyle = '#c9a86a'; ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(sx - 40, sy - 8, 30, 24, 3); ctx.fill(); ctx.stroke();
  const cx = sx - 25, cy = sy + 4;
  ctx.save(); ctx.lineWidth = 1.6; ctx.strokeStyle = '#3a2a1a';
  switch (b.sign) {
    case 'inn': ctx.fillStyle = '#e8e0c4'; ctx.fillRect(cx - 6, cy - 6, 10, 12); ctx.strokeRect(cx - 6, cy - 6, 10, 12); ctx.fillStyle = '#e0a030'; ctx.fillRect(cx - 6, cy - 6, 10, 4); ctx.beginPath(); ctx.arc(cx + 8, cy, 3.5, -1.5, 1.5); ctx.stroke(); break;
    case 'flask': ctx.fillStyle = '#7a4fd0'; ctx.beginPath(); ctx.moveTo(cx - 2, cy - 8); ctx.lineTo(cx + 2, cy - 8); ctx.lineTo(cx + 2, cy - 2); ctx.lineTo(cx + 7, cy + 7); ctx.lineTo(cx - 7, cy + 7); ctx.lineTo(cx - 2, cy - 2); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    case 'sack': ctx.fillStyle = '#b89a62'; ctx.beginPath(); ctx.ellipse(cx, cy + 2, 8, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#f5c451'; ctx.beginPath(); ctx.arc(cx, cy + 2, 3, 0, Math.PI * 2); ctx.fill(); break;
    case 'shield': ctx.fillStyle = '#5b7fb5'; ctx.beginPath(); ctx.moveTo(cx - 7, cy - 7); ctx.lineTo(cx + 7, cy - 7); ctx.lineTo(cx + 7, cy + 1); ctx.quadraticCurveTo(cx + 7, cy + 7, cx, cy + 9); ctx.quadraticCurveTo(cx - 7, cy + 7, cx - 7, cy + 1); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#e8d8a8'; ctx.fillRect(cx - 1, cy - 5, 2, 11); ctx.fillRect(cx - 4, cy - 1, 8, 2); break;
    case 'gem': ctx.fillStyle = '#4fd0b0'; ctx.beginPath(); ctx.moveTo(cx - 7, cy - 2); ctx.lineTo(cx - 3, cy - 7); ctx.lineTo(cx + 3, cy - 7); ctx.lineTo(cx + 7, cy - 2); ctx.lineTo(cx, cy + 8); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - 7, cy - 2); ctx.lineTo(cx + 7, cy - 2); ctx.stroke(); break;
    case 'rune': ctx.fillStyle = '#262432'; ctx.strokeStyle = '#6b3fb0'; ctx.beginPath(); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx + 7, cy - 4); ctx.lineTo(cx + 7, cy + 5); ctx.lineTo(cx, cy + 9); ctx.lineTo(cx - 7, cy + 5); ctx.lineTo(cx - 7, cy - 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#c36bff'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(cx - 2, cy - 4); ctx.lineTo(cx - 2, cy + 6); ctx.moveTo(cx - 2, cy - 4); ctx.lineTo(cx + 3, cy - 1); ctx.lineTo(cx - 2, cy + 2); ctx.stroke(); break;
    case 'hammer': ctx.fillStyle = '#6a6a74'; ctx.fillRect(cx - 7, cy - 6, 12, 6); ctx.strokeRect(cx - 7, cy - 6, 12, 6); ctx.fillStyle = '#8a5a30'; ctx.fillRect(cx - 1, cy - 1, 3, 11); ctx.strokeRect(cx - 1, cy - 1, 3, 11); break;
    case 'anvil': ctx.fillStyle = '#555'; ctx.fillRect(cx - 8, cy - 4, 16, 5); ctx.fillRect(cx - 3, cy + 1, 6, 5); ctx.fillRect(cx - 7, cy + 6, 14, 2); break;
  }
  ctx.restore();
}

// ---------------------------------------------------------------- small props
const VPROP = {
  lamp: (p, night) => {
    ctx.strokeStyle = '#2a2a30'; ctx.lineWidth = 3; line(p.x, p.y, p.x, p.y - 54); line(p.x, p.y - 52, p.x + 9, p.y - 56);
    ctx.fillStyle = '#2a2a30'; ctx.fillRect(p.x + 4, p.y - 54, 11, 3);
    ctx.fillStyle = night ? '#ffe39a' : '#d8d2b8'; ctx.beginPath(); ctx.roundRect(p.x + 6, p.y - 51, 7, 11, 2); ctx.fill();
    ctx.strokeStyle = '#2a2a30'; ctx.lineWidth = 1.5; ctx.strokeRect(p.x + 6, p.y - 51, 7, 11);
    ell(p.x, p.y, 4, 1.6, 'rgba(0,0,0,0.3)');
  },
  bench: p => {
    ell(p.x, p.y + 3, 32, 5, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = '#8b6a3f'; ctx.fillRect(p.x - 28, p.y - 14, 56, 5); ctx.fillRect(p.x - 28, p.y - 6, 56, 6);
    ctx.fillStyle = '#5a4126'; ctx.fillRect(p.x - 26, p.y, 4, 5); ctx.fillRect(p.x + 22, p.y, 4, 5); ctx.fillRect(p.x - 26, p.y - 22, 4, 10); ctx.fillRect(p.x + 22, p.y - 22, 4, 10);
    ctx.fillStyle = '#7a5a33'; ctx.fillRect(p.x - 28, p.y - 24, 56, 4);
  },
  well: p => {
    ell(p.x, p.y + 4, 36, 10, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = '#7d7f86'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 26, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9a9ca4'; ctx.fillRect(p.x - 26, p.y - 16, 52, 16); ctx.beginPath(); ctx.ellipse(p.x, p.y - 16, 26, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1d3648'; ctx.beginPath(); ctx.ellipse(p.x, p.y - 16, 19, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#b4b6be'; ctx.lineWidth = 1; for (let i = 0; i < 6; i++) line(p.x - 22 + i * 9, p.y - 15, p.x - 22 + i * 9, p.y - 1);
    ctx.fillStyle = '#5a4126'; ctx.fillRect(p.x - 25, p.y - 52, 5, 40); ctx.fillRect(p.x + 20, p.y - 52, 5, 40); ctx.fillRect(p.x - 28, p.y - 56, 56, 5);
    ctx.strokeStyle = '#d8cdb0'; ctx.lineWidth = 1.5; line(p.x, p.y - 52, p.x, p.y - 26 + Math.sin(tAnim * 1.6) * 1.5);
    ctx.fillStyle = '#8a5a30'; ctx.fillRect(p.x - 5, p.y - 26 + Math.sin(tAnim * 1.6) * 1.5, 10, 8);
    fillPoly([[p.x - 32, p.y - 54], [p.x, p.y - 74], [p.x + 32, p.y - 54]], '#a4483a', '#4a2018', 1.4);
  },
  shrine: (p, night) => {                                      // the Shrine of Return: two pillars, a lintel and a slowly turning light
    const t = tAnim, bob = Math.sin(t * 1.8) * 3, L = night ? 1 : 0.55;
    ell(p.x, p.y + 4, 46, 9, 'rgba(0,0,0,0.26)');
    ctx.fillStyle = '#7d7f8c'; ctx.beginPath(); ctx.roundRect(p.x - 38, p.y - 8, 76, 10, 3); ctx.fill();
    ctx.fillStyle = '#9496a4'; ctx.beginPath(); ctx.roundRect(p.x - 31, p.y - 15, 62, 8, 3); ctx.fill();
    for (const sx of [-24, 24]) {
      ctx.fillStyle = '#a9abb8'; ctx.fillRect(p.x + sx - 6, p.y - 70, 12, 56);
      ctx.fillStyle = '#8c8e9c'; ctx.fillRect(p.x + sx + 1, p.y - 70, 5, 56);
      ctx.fillStyle = '#c4c6d2'; ctx.fillRect(p.x + sx - 8, p.y - 74, 16, 5); ctx.fillRect(p.x + sx - 8, p.y - 18, 16, 4);
      ctx.fillStyle = withAlpha('#c9b8ff', 0.4 + 0.4 * Math.sin(t * 2 + sx)); ctx.fillRect(p.x + sx - 1.5, p.y - 60, 3, 4); ctx.fillRect(p.x + sx - 1.5, p.y - 46, 3, 4); ctx.fillRect(p.x + sx - 1.5, p.y - 32, 3, 4);
    }
    ctx.fillStyle = '#b2b4c0'; ctx.beginPath(); ctx.roundRect(p.x - 36, p.y - 84, 72, 11, 3); ctx.fill();
    ctx.fillStyle = '#8c8e9c'; ctx.fillRect(p.x - 36, p.y - 76, 72, 3);
    const gx = p.x, gy = p.y - 46 + bob;
    if (gfx && gfx.glow) { const g = ctx.createRadialGradient(gx, gy, 1, gx, gy, 30); g.addColorStop(0, withAlpha('#d8caff', 0.55 * L + 0.2)); g.addColorStop(1, withAlpha('#c9b8ff', 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(gx, gy, 30, 0, TAU); ctx.fill(); }
    ctx.save(); ctx.translate(gx, gy); ctx.rotate(t * 0.9);
    ctx.fillStyle = '#e6dcff'; ctx.strokeStyle = '#8a72d8'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(7, 0); ctx.lineTo(0, 11); ctx.lineTo(-7, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#d9d4f0'; ctx.fillRect(gx - 1, gy - 3, 2, 6);
  },
  board: p => {
    ell(p.x, p.y + 3, 30, 5, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = '#5a4126'; ctx.fillRect(p.x - 24, p.y - 40, 4, 40); ctx.fillRect(p.x + 20, p.y - 40, 4, 40);
    ctx.fillStyle = '#8b6a3f'; ctx.fillRect(p.x - 28, p.y - 62, 56, 34); ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2; ctx.strokeRect(p.x - 28, p.y - 62, 56, 34);
    const notes = [[-20, -57, '#efe6c8'], [-4, -58, '#e8d8a8'], [10, -56, '#f0eadc']];
    for (const [dx, dy, c] of notes) { ctx.fillStyle = c; ctx.fillRect(p.x + dx, p.y + dy, 13, 17); ctx.fillStyle = '#8a7b55'; for (let i = 0; i < 3; i++) ctx.fillRect(p.x + dx + 2, p.y + dy + 4 + i * 4, 9, 1); circ(p.x + dx + 6, p.y + dy + 1.5, 1.4, '#c33'); }
  },
  barrel: p => {
    ell(p.x, p.y + 2, 14, 4, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = '#8a5a30'; ctx.beginPath(); ctx.roundRect(p.x - 11, p.y - 24, 22, 26, 5); ctx.fill();
    ctx.strokeStyle = '#4a2c16'; ctx.lineWidth = 1.5; ctx.stroke(); line(p.x - 11, p.y - 17, p.x + 11, p.y - 17); line(p.x - 11, p.y - 7, p.x + 11, p.y - 7);
    ell(p.x, p.y - 24, 11, 3.5, p.water ? '#2a5878' : '#a8744a');
  },
  crates: p => {
    ell(p.x, p.y + 2, 24, 5, 'rgba(0,0,0,0.25)');
    const box = (x, y, w, h) => { ctx.fillStyle = '#a9794a'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = '#4a2c16'; ctx.lineWidth = 1.4; ctx.strokeRect(x, y, w, h); line(x, y, x + w, y + h); line(x + w, y, x, y + h); };
    box(p.x - 20, p.y - 17, 20, 18); box(p.x + 1, p.y - 14, 18, 15); if (p.n !== 0) box(p.x - 12, p.y - 33, 18, 16);
  },
  hay: p => {
    ell(p.x, p.y + 3, 26, 6, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = '#d8b858'; ctx.beginPath(); ctx.ellipse(p.x, p.y - 12, 24, 17, 0, Math.PI, 0); ctx.lineTo(p.x + 24, p.y); ctx.lineTo(p.x - 24, p.y); ctx.fill();
    ctx.strokeStyle = '#a8883a'; ctx.lineWidth = 1; for (let i = 0; i < 7; i++) line(p.x - 20 + i * 6.5, p.y - 2, p.x - 18 + i * 6, p.y - 22 + Math.abs(i - 3) * 3);
  },
  stump: p => {
    ell(p.x, p.y + 3, 18, 5, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = '#6e4a2a'; ctx.fillRect(p.x - 13, p.y - 16, 26, 17); ell(p.x, p.y, 13, 4.5, '#6e4a2a');
    ell(p.x, p.y - 16, 13, 5, '#c89a62'); ctx.strokeStyle = '#8a6438'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(p.x, p.y - 16, 8, 3, 0, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.ellipse(p.x, p.y - 16, 3.5, 1.4, 0, 0, Math.PI * 2); ctx.stroke();
    if (p.log === 1) {                                         // a log on end, ready to split; it jumps at every blow and cracks a little more each time
      const j = (p.kick || 0), lx = p.x + Math.sin(j * 9) * j * 1.6, top = p.y - 16 - 26;
      ctx.fillStyle = '#8a5a30'; ctx.fillRect(lx - 9, top, 18, 26); ctx.strokeStyle = '#4a2c16'; ctx.lineWidth = 1.2; ctx.strokeRect(lx - 9, top, 18, 26);
      ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = 1; for (let i = 0; i < 3; i++) line(lx - 5 + i * 5, top + 3, lx - 5 + i * 5, top + 23);
      ell(lx, top, 9, 3.4, '#d9b27a'); ctx.strokeStyle = '#8a6438'; ctx.beginPath(); ctx.ellipse(lx, top, 5.5, 2, 0, 0, Math.PI * 2); ctx.stroke();
      const cr = (p.hits | 0) / 5; if (cr > 0) { ctx.strokeStyle = '#2a1a0e'; ctx.lineWidth = 1.4; line(lx, top - 2, lx + (j ? 1 : 0), top - 2 + 4 + cr * 24); }       // the crack runs down with the grain
    } else if (p.log === 2) {                                  // split: two halves fall to either side
      for (const sd of [-1, 1]) { ctx.save(); ctx.translate(p.x + sd * 19, p.y - 4); ctx.rotate(sd * 1.25); ctx.fillStyle = '#b98a52'; ctx.strokeStyle = '#4a2c16'; ctx.lineWidth = 1.2; ctx.fillRect(-4.5, -13, 9, 26); ctx.strokeRect(-4.5, -13, 9, 26); ctx.fillStyle = '#d9b27a'; ctx.fillRect(-4.5, -13, 9, 3); ctx.restore(); }
    }
    if (p.split) for (let i = 0; i < Math.min(4, p.split); i++) { ctx.fillStyle = '#b98a52'; ctx.fillRect(p.x + 18 + (i % 2) * 9, p.y - 4 - Math.floor(i / 2) * 6, 11, 5); }
  },
  logs: p => {
    ell(p.x, p.y + 3, 34, 6, 'rgba(0,0,0,0.22)');
    const n = p.n ?? 6;
    for (let i = 0; i < n; i++) {
      const row = i < 4 ? 0 : 1, col = row ? i - 4 : i, lx = p.x - 24 + col * 13 + (row ? 6 : 0), ly = p.y - 6 - row * 11;
      ctx.fillStyle = '#7a5230'; ctx.beginPath(); ctx.roundRect(lx - 4, ly - 5, 36 - col * 0, 10, 5); ctx.fill();
      ell(lx - 3, ly, 3, 5, '#d9b27a');
    }
  },
  stack: p => {                                              // neatly stacked firewood
    ell(p.x, p.y + 3, 38, 6, 'rgba(0,0,0,0.22)');
    const n = p.n || 0;
    ctx.fillStyle = '#4a2c16'; ctx.fillRect(p.x - 34, p.y - 40, 4, 42); ctx.fillRect(p.x + 30, p.y - 40, 4, 42);
    for (let i = 0; i < n; i++) { const r = Math.floor(i / 6), c = i % 6; ctx.fillStyle = (r + c) % 2 ? '#b98a52' : '#a87a44'; ctx.fillRect(p.x - 30 + c * 10, p.y - 8 - r * 8, 9.5, 7.5); ell(p.x - 30 + c * 10 + 1.5, p.y - 4 - r * 8, 1.6, 3, '#d9b27a'); }
    ctx.fillStyle = '#6e4a2a'; ctx.fillRect(p.x - 36, p.y - 44, 72, 4);
  },
  rack: p => {                                               // weapon rack outside the smithy
    ell(p.x, p.y + 3, 28, 5, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = '#5a4126'; ctx.fillRect(p.x - 22, p.y - 36, 4, 38); ctx.fillRect(p.x + 18, p.y - 36, 4, 38); ctx.fillRect(p.x - 24, p.y - 28, 48, 4); ctx.fillRect(p.x - 24, p.y - 12, 48, 4);
    const cols = ['#d4d8e0', '#b8864b', '#9ac4e8'];
    for (let i = 0; i < 3; i++) { const sx = p.x - 11 + i * 11; ctx.strokeStyle = cols[i]; ctx.lineWidth = 2.6; line(sx, p.y - 52 + i * 2, sx, p.y - 17); ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 4; line(sx - 4, p.y - 18, sx + 4, p.y - 18); }
  },
  anvil: p => {
    ell(p.x, p.y + 3, 18, 5, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = '#6e4a2a'; ctx.fillRect(p.x - 9, p.y - 12, 18, 13);
    ctx.fillStyle = '#4a4e56'; ctx.beginPath(); ctx.moveTo(p.x - 18, p.y - 20); ctx.lineTo(p.x + 12, p.y - 20); ctx.lineTo(p.x + 22, p.y - 26); ctx.lineTo(p.x - 18, p.y - 26); ctx.closePath(); ctx.fill();
    ctx.fillRect(p.x - 8, p.y - 20, 16, 8); ctx.fillStyle = '#6a6e78'; ctx.fillRect(p.x - 18, p.y - 26, 40, 2.5);
    if (p.hot > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ell(p.x - 2, p.y - 27, 7, 2.6, `rgba(255,150,40,${Math.min(1, p.hot)})`); ctx.restore(); }
  },
  forge: p => {
    ell(p.x, p.y + 3, 34, 8, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = '#6a625e'; ctx.fillRect(p.x - 28, p.y - 36, 56, 37);
    ctx.strokeStyle = '#3a3532'; ctx.lineWidth = 1; for (let i = 0; i < 4; i++) for (let j = 0; j < 7; j++) ctx.strokeRect(p.x - 28 + j * 8 + (i % 2) * 4, p.y - 36 + i * 9, 8, 9);
    ctx.fillStyle = '#1a1412'; ctx.beginPath(); ctx.roundRect(p.x - 15, p.y - 26, 30, 20, [10, 10, 0, 0]); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const fl = 0.7 + Math.sin(tAnim * 9) * 0.15 + Math.sin(tAnim * 14) * 0.1;
    const g = ctx.createRadialGradient(p.x, p.y - 12, 1, p.x, p.y - 12, 16); g.addColorStop(0, `rgba(255,190,80,${fl})`); g.addColorStop(1, 'rgba(255,60,10,0)');
    ctx.fillStyle = g; ctx.fillRect(p.x - 16, p.y - 28, 32, 28); ctx.restore();
    ctx.fillStyle = '#4a4440'; ctx.fillRect(p.x - 12, p.y - 52, 24, 18);
  },
  cauldron: p => {
    ell(p.x, p.y + 3, 17, 5, 'rgba(0,0,0,0.25)');
    ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 2.5; line(p.x - 11, p.y - 6, p.x - 14, p.y + 1); line(p.x + 11, p.y - 6, p.x + 14, p.y + 1);
    ctx.fillStyle = '#2f3138'; ctx.beginPath(); ctx.ellipse(p.x, p.y - 12, 15, 13, 0, 0, Math.PI); ctx.lineTo(p.x - 15, p.y - 14); ctx.fill();
    ell(p.x, p.y - 14, 15, 5, '#1d1f24'); ell(p.x, p.y - 14, 12, 3.6, p.col || '#6fd08a');
    for (let i = 0; i < 3; i++) { const b = (tAnim * 0.9 + i * 0.37) % 1; ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - b)})`; ctx.beginPath(); ctx.arc(p.x - 6 + i * 6, p.y - 14 - b * 14, 1.4 + b, 0, Math.PI * 2); ctx.fill(); }
  },
  counter: (p) => {                                          // shop counter with wares
    const w = p.w, x = p.x, y = p.y;
    ell(x, y + 8, w / 2 + 6, 6, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = '#8b6a3f'; ctx.fillRect(x - w / 2, y - 12, w, 16);
    ctx.fillStyle = '#a07c4c'; ctx.fillRect(x - w / 2 - 3, y - 15, w + 6, 5);
    ctx.strokeStyle = '#4a3420'; ctx.lineWidth = 1; for (let i = 1; i < w / 20; i++) line(x - w / 2 + i * 20, y - 10, x - w / 2 + i * 20, y + 3);
    if (p.kind === 'alch') {
      const cols = ['#d9534f', '#5b8def', '#7fd08a', '#b07af0', '#f5c451'];
      for (let i = 0; i < 5; i++) {
        const bx = x - w / 2 + 14 + i * ((w - 28) / 4); ctx.fillStyle = cols[i];
        ctx.beginPath(); ctx.moveTo(bx - 2, y - 24); ctx.lineTo(bx + 2, y - 24); ctx.lineTo(bx + 2, y - 20); ctx.lineTo(bx + 5, y - 15); ctx.lineTo(bx - 5, y - 15); ctx.lineTo(bx - 2, y - 20); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#c9a86a'; ctx.fillRect(bx - 2, y - 26, 4, 2.5);
      }
    } else if (p.kind === 'armour') {
      ctx.fillStyle = '#9aa3ad'; ctx.strokeStyle = '#4a4e56'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x - w / 2 + 18, y - 18, 9, Math.PI, 0); ctx.lineTo(x - w / 2 + 27, y - 14); ctx.lineTo(x - w / 2 + 9, y - 14); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3a3e46'; ctx.fillRect(x - w / 2 + 14, y - 20, 8, 3);
      ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.moveTo(x - 8, y - 32); ctx.lineTo(x + 12, y - 32); ctx.lineTo(x + 12, y - 22); ctx.quadraticCurveTo(x + 12, y - 14, x + 2, y - 11); ctx.quadraticCurveTo(x - 8, y - 14, x - 8, y - 22); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8d8a8'; ctx.fillRect(x + 1, y - 29, 2, 15); ctx.fillRect(x - 4, y - 24, 12, 2);
      ctx.fillStyle = '#8a929c'; ctx.beginPath(); ctx.moveTo(x + w / 2 - 30, y - 30); ctx.lineTo(x + w / 2 - 14, y - 30); ctx.lineTo(x + w / 2 - 12, y - 14); ctx.lineTo(x + w / 2 - 32, y - 14); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (p.kind === 'jewel') {
      const cols = ['#4fd0b0', '#e85a8a', '#f5c451', '#6a8aff'];
      for (let i = 0; i < 4; i++) {
        const bx = x - w / 2 + 14 + i * ((w - 28) / 3);
        ctx.fillStyle = '#2a2040'; ctx.fillRect(bx - 8, y - 17, 16, 5);
        ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.moveTo(bx - 5, y - 21); ctx.lineTo(bx - 2, y - 26); ctx.lineTo(bx + 2, y - 26); ctx.lineTo(bx + 5, y - 21); ctx.lineTo(bx, y - 17); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(bx - 2, y - 25); ctx.lineTo(bx, y - 21); ctx.stroke();
      }
    } else if (p.kind === 'enchant') {
      const t = typeof vil !== 'undefined' && vil ? vil.t : 0, gl = 0.5 + 0.5 * Math.sin(t * 2.4);
      ctx.fillStyle = '#33265c'; ctx.fillRect(x - w / 2 + 11, y - 17, 18, 5);                          // a crystal ball on its stand
      ell(x - w / 2 + 20, y - 26, 12 + gl * 3, 11 + gl * 2, 'rgba(160,210,255,0.22)');
      circ(x - w / 2 + 20, y - 26, 8, '#9fd8ff'); circ(x - w / 2 + 17, y - 29, 2.6, 'rgba(255,255,255,0.85)');
      ctx.fillStyle = '#5a2f7a'; ctx.fillRect(x - 4, y - 19, 24, 6); ctx.fillStyle = '#efe6c8'; ctx.fillRect(x - 2, y - 22, 20, 4);   // an open book
      ctx.strokeStyle = '#8a7a5a'; ctx.lineWidth = 0.8; line(x + 8, y - 22, x + 8, y - 18);
      const cols = ['#ff9a4a', '#c36bff', '#3ff2e0'];                                                    // three resting runes
      for (let i = 0; i < 3; i++) { const bx = x + w / 2 - 34 + i * 11; ctx.fillStyle = '#262432'; ctx.strokeStyle = cols[i]; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(bx, y - 24); ctx.lineTo(bx + 4.5, y - 21); ctx.lineTo(bx + 4.5, y - 16); ctx.lineTo(bx, y - 14); ctx.lineTo(bx - 4.5, y - 16); ctx.lineTo(bx - 4.5, y - 21); ctx.closePath(); ctx.fill(); ctx.stroke(); circ(bx, y - 19, 1.5 + gl * 0.6, cols[i]); }
    } else {
      ctx.fillStyle = '#c8a24a'; ctx.beginPath(); ctx.ellipse(x - w / 2 + 16, y - 19, 9, 6, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#d23'; circ(x - w / 2 + 12, y - 22, 3, '#d9534f'); circ(x - w / 2 + 19, y - 22, 3, '#e8903a');
      ctx.fillStyle = '#b89a62'; ctx.beginPath(); ctx.ellipse(x + 6, y - 19, 11, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#6a5530'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#7e8a93'; ctx.fillRect(x + w / 2 - 24, y - 26, 10, 12); ctx.fillStyle = '#ffd36a'; ctx.fillRect(x + w / 2 - 22, y - 24, 6, 6);
    }
    // striped awning
    const ay = y - 62;
    for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#f0ead8' : (p.awn || '#c0392b'); ctx.beginPath(); ctx.moveTo(x - w / 2 - 6 + i * ((w + 12) / 8), ay); ctx.lineTo(x - w / 2 - 6 + (i + 1) * ((w + 12) / 8), ay); ctx.lineTo(x - w / 2 - 6 + (i + 1) * ((w + 12) / 8), ay + 10); ctx.arc(x - w / 2 - 6 + (i + 0.5) * ((w + 12) / 8), ay + 10, (w + 12) / 16, 0, Math.PI); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = '#4a3420'; ctx.fillRect(x - w / 2 - 6, ay - 3, w + 12, 4); ctx.fillRect(x - w / 2 - 4, ay, 4, 50); ctx.fillRect(x + w / 2, ay, 4, 50);
  },
  fence: p => {                                              // horizontal run of fence: x..x+len
    const len = p.len, n = Math.max(1, Math.round(len / 18));
    ctx.fillStyle = '#9a7648'; ctx.strokeStyle = '#4a3420'; ctx.lineWidth = 1;
    ctx.fillRect(p.x, p.y - 16, len, 3); ctx.fillRect(p.x, p.y - 8, len, 3);
    for (let i = 0; i <= n; i++) { const fx = p.x + i * (len / n); ctx.fillStyle = '#b08a56'; ctx.fillRect(fx - 2, p.y - 22, 4, 24); fillPoly([[fx - 2, p.y - 22], [fx, p.y - 26], [fx + 2, p.y - 22]], '#b08a56'); }
  },
  fenceV: p => {                                             // vertical run of fence: y..y+len
    const len = p.len, n = Math.max(1, Math.round(len / 22));
    for (let i = 0; i <= n; i++) { const fy = p.y + i * (len / n); ctx.fillStyle = '#b08a56'; ctx.fillRect(p.x - 2, fy - 22, 4, 24); fillPoly([[p.x - 2, fy - 22], [p.x, fy - 26], [p.x + 2, fy - 22]], '#b08a56'); if (i < n) { ctx.fillStyle = '#9a7648'; ctx.fillRect(p.x - 1.5, fy - 18, 3, len / n); ctx.fillRect(p.x - 1.5, fy - 9, 3, len / n); } }
  },
  coop: p => {
    ell(p.x, p.y + 3, 30, 6, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = '#a9794a'; ctx.fillRect(p.x - 24, p.y - 28, 48, 29); ctx.strokeStyle = '#4a2c16'; ctx.lineWidth = 1.2; ctx.strokeRect(p.x - 24, p.y - 28, 48, 29);
    fillPoly([[p.x - 29, p.y - 27], [p.x, p.y - 46], [p.x + 29, p.y - 27]], '#a4483a', '#4a2018', 1.4);
    ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.roundRect(p.x - 6, p.y - 18, 12, 18, [6, 6, 0, 0]); ctx.fill();
  },
  gate: (p, night) => {                                      // arch over the east road; the pillars are separate solids
    const x = p.x, y = p.y;
    ell(x, y + 3, 62, 8, 'rgba(0,0,0,0.25)');
    for (const sx of [-1, 1]) {
      ctx.fillStyle = '#6a5a48'; ctx.fillRect(x + sx * 43 - 7, y - 92, 14, 94);
      ctx.fillStyle = '#7d6b56'; ctx.fillRect(x + sx * 43 - 10, y - 8, 20, 10); ctx.fillRect(x + sx * 43 - 9, y - 98, 18, 8);
      ctx.strokeStyle = '#4a3f33'; ctx.lineWidth = 1; for (let i = 0; i < 6; i++) line(x + sx * 43 - 7, y - 80 + i * 14, x + sx * 43 + 7, y - 80 + i * 14);
    }
    ctx.fillStyle = '#5a4126'; ctx.fillRect(x - 56, y - 118, 112, 22);
    ctx.fillStyle = '#6e4f30'; ctx.fillRect(x - 56, y - 118, 112, 5);
    ctx.fillStyle = '#e8d8a8'; ctx.font = 'bold 11px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('THE ROAD', x, y - 102);
    const wv = Math.sin(tAnim * 3) * 3;
    for (const sx of [-1, 1]) {
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2; line(x + sx * 43, y - 118, x + sx * 43, y - 138);
      ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.moveTo(x + sx * 43, y - 138); ctx.lineTo(x + sx * 43 + sx * (16 + wv), y - 131); ctx.lineTo(x + sx * 43, y - 124); ctx.fill();
    }
  },
  welcome: (p) => {
    ell(p.x, p.y + 3, 26, 5, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = '#5a4126'; ctx.fillRect(p.x - 3, p.y - 46, 6, 48);
    let px = 11; ctx.font = `bold ${px}px Georgia, serif`;
    const sw = Math.max(100, Math.min(190, ctx.measureText(p.text).width + 26));          // the board is as wide as the village's name needs
    while (px > 7 && ctx.measureText(p.text).width > sw - 14) { px--; ctx.font = `bold ${px}px Georgia, serif`; }
    ctx.fillStyle = '#c9a86a'; ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(p.x - sw / 2, p.y - 66, sw, 24, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3a2a1a'; ctx.textAlign = 'center'; ctx.fillText(p.text, p.x, p.y - 50);
  },
  line: p => {                                               // clothesline with cloths swaying in the wind
    ctx.strokeStyle = '#5a4126'; ctx.lineWidth = 3; line(p.x, p.y, p.x, p.y - 46); line(p.x + p.len, p.y, p.x + p.len, p.y - 46);
    ctx.strokeStyle = '#d8cdb0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y - 44); ctx.quadraticCurveTo(p.x + p.len / 2, p.y - 38, p.x + p.len, p.y - 44); ctx.stroke();
    const cols = ['#e8e0c4', '#6a8fd0', '#d9534f', '#f0ead8', '#7fd08a'];
    for (let i = 0; i < 5; i++) {
      const cx = p.x + 18 + i * ((p.len - 36) / 4), sw = Math.sin(tAnim * 2.2 + i * 0.9) * 3;
      ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.moveTo(cx - 8, p.y - 42); ctx.lineTo(cx + 8, p.y - 42); ctx.lineTo(cx + 9 + sw, p.y - 20); ctx.lineTo(cx - 7 + sw, p.y - 20); ctx.closePath(); ctx.fill();
    }
  },
  ball: p => {
    ell(p.x, p.y + 1, 5, 1.6, 'rgba(0,0,0,0.3)'); circ(p.x, p.y - 4 - (p.z || 0), 4.5, '#e04a4a'); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y - 4 - (p.z || 0), 4.5, 0.4, 2.6); ctx.stroke();
  },
};

function drawPlant(p) {
  const g = Math.min(1, 0.55 + p.g * 0.45), sway = Math.sin(tAnim * 1.3 + p.ph) * 1.2;
  const perk = p.wet > 0 ? p.wet : 0;
  ctx.save(); ctx.translate(p.x, p.y);
  ell(0, 1, 6, 2, 'rgba(0,0,0,0.2)');
  if (p.kind === 0) {                                        // cabbage
    ell(0, -4 * g, 6.5 * g, 5.5 * g, '#6fae5a'); ell(0, -5 * g, 4 * g, 3.5 * g, '#9fd37e'); ell(-3, -3 * g, 3, 4 * g, '#58944a');
  } else if (p.kind === 1) {                                 // carrot tops
    ctx.strokeStyle = '#4f9a48'; ctx.lineWidth = 1.6; for (let i = -2; i <= 2; i++) line(0, 0, i * 2.4 + sway, -9 * g - Math.abs(i));
    ell(0, 1, 2.2, 1.4, '#e8903a');
  } else if (p.kind === 2) {                                 // flowers
    ctx.strokeStyle = '#3d7a3a'; ctx.lineWidth = 1.6; line(0, 0, sway, -10 * g);
    const c = ['#f28ab2', '#f4e04d', '#fff', '#a0c4ff'][p.c % 4]; circ(sway, -11 * g, 3.2 * g, c); circ(sway, -11 * g, 1.2, '#e8a030');
  } else {                                                   // sprouts
    ctx.strokeStyle = '#4f9a48'; ctx.lineWidth = 1.8; line(0, 0, sway, -7 * g); ell(sway - 3, -7 * g, 3, 1.6, '#7fd08a', -0.5); ell(sway + 3, -8 * g, 3, 1.6, '#7fd08a', 0.5);
  }
  if (perk > 0) { ctx.fillStyle = `rgba(150,210,255,${0.6 * perk})`; ctx.beginPath(); ctx.arc(-3, -2, 1.6, 0, Math.PI * 2); ctx.arc(3, -5, 1.4, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
