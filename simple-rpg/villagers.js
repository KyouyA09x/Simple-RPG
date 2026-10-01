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
  const pt = n.pt, R = { bh: null, fh: null, tool: null, lean: n.moving ? 0.12 : 0.02, hop: 0, sit: false, kick: 0 };
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
      R.bh = { x: sh.x - f * 2 * s, y: sh.y - 14 * s + Math.sin(pt * 8) * 2 * s }; R.fh = { x: sh.x + f * 5 * s, y: sh.y + 16 * s }; break;
    }
    case 'wave': {
      R.fh = { x: sh.x + f * 9 * s, y: sh.y - (13 + Math.sin(pt * 9) * 3) * s }; R.bh = { x: sh.x - f * 3 * s, y: sh.y + 17 * s }; break;
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
      if (n.moving) {
        const sw = Math.cos(n.walkT);
        R.bh = { x: sh.x - f * 9 * s * sw, y: sh.y + (13 - Math.abs(Math.sin(n.walkT)) * 2) * s };
        R.fh = { x: sh.x + f * 9 * s * sw, y: sh.y + (13 - Math.abs(Math.sin(n.walkT)) * 2) * s };
        if (n.look && n.look.spear) R.tool = { k: 'spear' };
      } else { rest(); if (n.look && n.look.spear) R.tool = { k: 'spear' }; }
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
      const nx = -dy, ny = dx;
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
  const L = n.look || {}, s = n.scale || 1, f = n.f || 1, x = n.x, y = n.y;
  const ink = '#1a1a1a';
  ctx.save();
  ctx.globalAlpha = n.alpha ?? 1;
  drawShadow(x, y, 11 * s);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = ink; ctx.lineWidth = 3 * (s < 0.9 ? 0.85 : 1);
  const br = n.pose === 'sit' || n.pose === 'knit' ? 0 : Math.sin(tAnim * 2.4 + n.ph) * 1.1 * s;
  const sh0 = { x, y: y - 50 * s };
  const P = villagerPose(n, sh0, f, s);
  const moving = n.moving && !P.sit;
  const bounce = moving ? Math.abs(Math.cos(n.walkT)) * 2 * s : 0;
  const yy = y - P.hop;
  const hipY = P.sit ? y - 8 * s : yy - 25 * s + bounce;
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
  if (P.sit) {
    const k1 = { x: x + f * 14 * s, y: hipY }, k2 = { x: x + f * 11 * s, y: hipY + 1 * s };
    legs = [[hip, k1, { x: k1.x + f * 1 * s, y }], [hip, k2, { x: k2.x + f * 1 * s, y }]];
  } else {
    const Lg = 13.5 * s, fy = yy;
    let feet;
    if (n.pose === 'kick') feet = [{ x: x + f * (6 + P.kick * 16) * s, y: fy - P.kick * 9 * s }, { x: x - f * 5 * s, y: fy }];
    else if (moving) feet = [footAt(x, fy, f, n.walkT, 14 * s * 0.85, 7 * s), footAt(x, fy, f, n.walkT + Math.PI, 14 * s * 0.85, 7 * s)];
    else feet = [{ x: x + f * 6 * s, y: fy }, { x: x - f * 5 * s, y: fy }];
    legs = feet.map(ft => { const k = ik(hip.x, hip.y, ft.x, ft.y, Lg, Lg, -f); return [hip, k.j, k.e]; });
  }
  ctx.strokeStyle = L.legs || ink;
  for (const l of legs) poly(...l);
  ctx.strokeStyle = ink;

  // dress / skirt
  if (L.dress) {
    ctx.fillStyle = L.dress; ctx.strokeStyle = shadeHex(L.dress, -0.45); ctx.lineWidth = 1.2;
    const bot = P.sit ? y - 4 * s : yy - 5 * s;
    ctx.beginPath(); ctx.moveTo(neck.x - 3.5 * s, neck.y + 5 * s); ctx.lineTo(neck.x + 3.5 * s, neck.y + 5 * s);
    ctx.lineTo(x + 13 * s, bot); ctx.lineTo(x - 13 * s, bot); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = ink; ctx.lineWidth = 3 * (s < 0.9 ? 0.85 : 1);
  }
  // back arm
  const arm = (hand, front) => {
    const a = ik(sh.x, sh.y, hand.x, hand.y, 9.5 * s, 9.5 * s, f);
    poly(sh, a.j, a.e);
    if (L.body) { ctx.save(); ctx.strokeStyle = L.sleeve || L.body; ctx.lineWidth = 5.5 * s; poly(sh, a.j); ctx.restore(); }
    return a.e;
  };
  if (P.bh) arm(P.bh, false);
  // torso + tunic
  ctx.strokeStyle = ink; poly(hip, neck);
  if (L.body && !L.dress) {
    ctx.save(); ctx.strokeStyle = L.body; ctx.lineWidth = 7.5 * s; ctx.lineCap = 'butt'; poly({ x: hip.x + (neck.x - hip.x) * 0.06, y: hip.y + (neck.y - hip.y) * 0.06 }, { x: neck.x + (hip.x - neck.x) * 0.06, y: neck.y + (hip.y - neck.y) * 0.06 + 1 }); ctx.restore();
  }
  if (L.apron) {
    ctx.save(); ctx.strokeStyle = L.apron; ctx.lineWidth = 6 * s; ctx.lineCap = 'butt';
    poly({ x: hip.x + f * 1.5 * s, y: hip.y + 1 * s }, { x: lerpN(hip.x, neck.x, 0.7) + f * 1.5 * s, y: lerpN(hip.y, neck.y, 0.7) });
    ctx.restore();
  }
  if (L.belt) { ctx.save(); ctx.strokeStyle = L.belt; ctx.lineWidth = 2.5 * s; line(hip.x - 4 * s, hip.y - 3 * s, hip.x + 4 * s, hip.y - 3 * s); ctx.restore(); }
  // head
  const hr = 9.5 * s;
  ctx.fillStyle = L.skin || '#fff'; ctx.strokeStyle = ink; ctx.lineWidth = 2.6 * (s < 0.9 ? 0.9 : 1);
  ctx.beginPath(); ctx.arc(head.x, head.y, hr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (L.beard) {                                               // a crescent round the chin, the mouth stays visible above it
    ctx.fillStyle = L.beard; ctx.beginPath(); ctx.arc(head.x, head.y, hr, 0.55, Math.PI - 0.55);
    ctx.quadraticCurveTo(head.x, head.y + hr * 0.22, head.x + Math.cos(0.55) * hr, head.y + Math.sin(0.55) * hr); ctx.closePath(); ctx.fill();
  }
  if (L.hair && L.hat !== 'helmet' && L.hat !== 'cap' && L.hat !== 'smithcap' && L.hat !== 'beanie') { ctx.fillStyle = L.hair; ctx.beginPath(); ctx.arc(head.x - f * 1 * s, head.y - 1 * s, hr * 1.02, Math.PI * 1.1, Math.PI * 1.9); ctx.closePath(); ctx.fill(); }
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
    case 'smithcap':
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(hx, hy - hr * 0.2, hr * 1.04, Math.PI * 1.0, Math.PI * 2.0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = shadeHex(col, -0.25); ctx.fillRect(hx - hr * 1.04, hy - hr * 0.35, hr * 2.08, hr * 0.28); break;
  }
  ctx.restore();
}

// speech bubble above a head
function drawBubble(x, y, text, a = 1) {
  ctx.save(); ctx.globalAlpha = a; ctx.font = '12px "Segoe UI", sans-serif'; ctx.textAlign = 'center';
  const w = Math.min(240, ctx.measureText(text).width + 16), h = 22;
  ctx.fillStyle = 'rgba(255,252,240,0.96)'; ctx.strokeStyle = 'rgba(40,36,30,0.75)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - h, w, h, 8); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 5, y - 1); ctx.lineTo(x, y + 6); ctx.lineTo(x + 5, y - 1); ctx.fillStyle = 'rgba(255,252,240,0.96)'; ctx.fill();
  ctx.fillStyle = '#2a2620'; ctx.fillText(text.length > 40 ? text.slice(0, 39) + '…' : text, x, y - 7);
  ctx.restore();
}

// ---------------------------------------------------------------- animals
function drawDog(d) {
  const f = d.f, x = d.x, y = d.y, moving = d.moving, t = d.walkT;
  ctx.save(); ctx.globalAlpha = d.alpha ?? 1;
  drawShadow(x, y, 13);
  const fur = '#a8733f', dark = '#6e4524';
  if (d.pose === 'sleep') {
    ell(x, y - 6, 15, 7, fur); ell(x + f * 11, y - 5, 6, 5, dark); ell(x - f * 12, y - 4, 5, 3, fur);
    ctx.fillStyle = '#c9a'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    ctx.globalAlpha *= 0.5 + 0.5 * Math.sin(tAnim * 2); ctx.fillStyle = '#9ab'; ctx.fillText('z', x + f * 14, y - 18 - Math.sin(tAnim * 2) * 3);
    ctx.restore(); return;
  }
  const sit = d.pose === 'sit';
  const bob = moving ? Math.abs(Math.sin(t)) * 1.5 : 0;
  ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.lineCap = 'round';
  if (!sit) for (let i = 0; i < 4; i++) {
    const ph = t + (i % 2 ? Math.PI : 0) + (i > 1 ? 0.6 : 0), lx = x + (i > 1 ? -f * 9 : f * 8) + (i % 2 ? 2 : -1);
    const lift = moving ? Math.max(0, -Math.sin(ph)) * 4 : 0, sw = moving ? Math.cos(ph) * 4 : 0;
    line(lx, y - 8 - bob, lx + sw * f, y - lift);
  }
  if (sit) { ell(x - f * 6, y - 8, 9, 7, fur); line(x + f * 5, y - 10, x + f * 5, y); } else ell(x, y - 12 - bob, 13, 6.5, fur);
  const hx = x + f * (sit ? 8 : 14), hy = y - (sit ? 20 : 17) - bob;
  ell(hx, hy, 6.5, 5.5, fur);
  ell(hx + f * 5, hy + 1.5, 3.5, 2.6, dark);
  ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(hx + f * 7.5, hy + 0.5, 1.1, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(hx + f * 2, hy - 1.5, 1.2, 0, Math.PI * 2); ctx.fill();
  fillPoly([[hx - f * 2, hy - 4], [hx - f * 5, hy - 10 + Math.sin(t * 2) * 0.6], [hx - f * 0.5, hy - 5]], dark);
  const wag = Math.sin(tAnim * (d.happy ? 18 : 5) + d.ph) * (d.happy ? 6 : 2.5);
  ctx.strokeStyle = fur; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - f * (sit ? 14 : 12), y - (sit ? 6 : 14) - bob); ctx.quadraticCurveTo(x - f * 19, y - 20 + wag * 0.4, x - f * 21, y - 22 + wag); ctx.stroke();
  if (d.pose === 'sniff') { ctx.strokeStyle = 'rgba(0,0,0,0)'; }
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
    ctx.fillStyle = '#c9a86a'; ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(p.x - 50, p.y - 66, 100, 24, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3a2a1a'; ctx.font = 'bold 11px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText(p.text, p.x, p.y - 50);
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
