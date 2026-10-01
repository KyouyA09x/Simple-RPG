// Ambient life and biome effects: harmless creatures that wander and flee from the
// hero, jumping fish, desert dust devils, and the particles that give each biome its air
// (pollen, spores, wisp dust, snow glints, vent smoke, bog bubbles).

let critters = [], devils = [], devilTimer = 12, fxT = 0;
const critterCool = {};
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

// animal sounds are rate-limited and only play when the animal is near
function critterCall(name, x, y, gap = 1.2) {
  if (!hero || Math.hypot(x - hero.x, y - hero.y) > 420) return;
  if ((critterCool[name] || 0) > tAnim) return;
  critterCool[name] = tAnim + gap + Math.random() * gap;
  sfx(name);
}

const BUTTERFLY_COLORS = ['#ffd23a', '#ff8ab0', '#8ad0ff', '#ffffff', '#c08aff'];
const BIRD_COLORS = { forest: ['#7a5a3a', '#5a6a7a', '#a05a3a'], jungle: ['#d83a3a', '#3a7ad8', '#e8c83a', '#3ab86a'], highlands: ['#6a6a72', '#4a4a52'] };

function makeCritter(kind, x, y, r, B) {
  const c = { kind, x, y, ph: r() * 6.28, ph2: r() * 20, t: r() * 3, state: 'idle', facing: r() < 0.5 ? 1 : -1, z: 0, wing: r() * 6, ct: 2 + r() * 6, croak: 0, peck: 0, wig: 0, ang: r() * 6.28, spd: 20 };
  if (kind === 'butterfly') c.col = BUTTERFLY_COLORS[Math.floor(r() * BUTTERFLY_COLORS.length)];
  if (kind === 'bird') { const pal = BIRD_COLORS[B.key] || BIRD_COLORS.forest; c.col = pal[Math.floor(r() * pal.length)]; c.state = 'perch'; }
  if (kind === 'wisp') { c.trail = []; c.rgb = B.wispColor || [170, 220, 255]; }
  if (kind === 'hare') c.col = B.key === 'snow' ? '#f2f6fa' : '#a98a66';
  return c;
}

function spawnCritters() {
  critters = []; devils = []; devilTimer = 6 + Math.random() * 10;
  const B = world.B, r = mulberry(world.seed ^ 0x1234567);
  for (const [kind, n] of B.critters || []) for (let i = 0; i < n; i++) {
    let x, y, tries = 0;
    do { x = 80 + r() * (WW - 160); y = 90 + r() * (WH - 180); tries++; } while ((waterAt(x, y) || Math.hypot(x - WW / 2, y - WH / 2) < 140) && tries < 40);
    critters.push(makeCritter(kind, x, y, r, B));
  }
  for (const w of world.water) if (!w.frozen) critters.push({ kind: 'fish', x: w.x, y: w.y, w, t: 1 + r() * 6, jump: null, ph: r() * 6, ph2: 0, facing: 1, z: 0 });
}

function respawnBird(c) {
  for (let i = 0; i < 20; i++) {
    const x = 80 + Math.random() * (WW - 160), y = 90 + Math.random() * (WH - 180);
    if (Math.hypot(x - hero.x, y - hero.y) > 520 && !waterAt(x, y)) { c.x = x; c.y = y; break; }
  }
  c.state = 'perch'; c.z = 0; c.t = 1;
}

const CRITTER_AI = {
  butterfly(c, dt, ux, uy, dist) {
    c.t -= dt; c.wing += dt * 16;
    if (c.t <= 0) { c.ang = Math.random() * TAU; c.spd = 18 + Math.random() * 26; c.t = 0.6 + Math.random() * 1.6; }
    let spd = c.spd;
    if (dist < 95) { c.ang = Math.atan2(uy, ux) + (Math.random() - 0.5) * 1.2; spd = 75; }   // startled
    c.x += Math.cos(c.ang) * spd * dt; c.y += Math.sin(c.ang) * spd * dt * 0.7;
    c.z = 14 + Math.sin(tAnim * 3 + c.ph) * 5;
    c.facing = Math.cos(c.ang) >= 0 ? 1 : -1;
  },
  bird(c, dt, ux, uy, dist) {
    if (c.state === 'perch') {
      c.t -= dt; if (c.t <= 0) { c.peck = 0.35; c.t = 1.2 + Math.random() * 2.6; }
      c.peck = Math.max(0, c.peck - dt);
      if (dist < 125) {                                     // takes off when the hero gets close
        c.state = 'fly'; c.fly = 0; c.vx = ux * 150 + (Math.random() - 0.5) * 60; c.vy = uy * 60 - 10; c.facing = c.vx >= 0 ? 1 : -1;
        critterCall('chirp', c.x, c.y, 0.8);
      }
    } else {
      c.wing += dt * 22; c.fly += dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z = Math.min(80, c.z + 70 * dt);
      if (c.fly > 4.2) respawnBird(c);
    }
  },
  frog(c, dt, ux, uy, dist) {
    if (c.state === 'hop') {
      c.hop += dt; const p = Math.min(1, c.hop / 0.38);
      c.x += c.vx * dt; c.y += c.vy * dt; c.z = Math.sin(p * Math.PI) * 13;
      if (p >= 1) { c.state = 'idle'; c.z = 0; c.t = 0.8 + Math.random() * 3; if (waterAt(c.x, c.y)) burst(c.x, c.y, '#bfe4f4', 4, 60, 1.6, 200); }
      return;
    }
    c.t -= dt; c.croak = Math.max(0, c.croak - dt);
    if (dist < 105 || c.t <= 0) {
      const away = dist < 105, a = away ? Math.atan2(uy, ux) + (Math.random() - 0.5) : Math.random() * TAU, len = away ? 70 : 32;
      c.state = 'hop'; c.hop = 0; c.vx = Math.cos(a) * len / 0.38; c.vy = Math.sin(a) * len / 0.38 * 0.7; c.facing = c.vx >= 0 ? 1 : -1;
    } else if ((c.ct -= dt) <= 0) { c.ct = 3 + Math.random() * 6; c.croak = 0.5; critterCall('frog', c.x, c.y, 2.5); }
  },
  lizard(c, dt, ux, uy, dist) {
    c.t -= dt;
    if (c.state === 'run') {
      c.run -= dt; c.x += c.vx * dt; c.y += c.vy * dt; c.wig += dt * 32;
      if (c.run <= 0) { c.state = 'idle'; c.t = 1 + Math.random() * 3; }
    } else {
      c.wig += dt * 2;
      if (dist < 110) { c.state = 'run'; c.run = 0.6; const a = Math.atan2(uy, ux) + (Math.random() - 0.5) * 0.9; c.vx = Math.cos(a) * 170; c.vy = Math.sin(a) * 120; c.facing = c.vx >= 0 ? 1 : -1; }
      else if (c.t <= 0) { c.t = 2 + Math.random() * 4; c.state = 'run'; c.run = 0.25; const a = Math.random() * TAU; c.vx = Math.cos(a) * 60; c.vy = Math.sin(a) * 40; c.facing = c.vx >= 0 ? 1 : -1; }
    }
  },
  hare(c, dt, ux, uy, dist) {
    if (c.state === 'hop') {
      c.hop += dt; const p = Math.min(1, c.hop / 0.5);
      c.x += c.vx * dt; c.y += c.vy * dt; c.z = Math.sin(p * Math.PI) * 18;
      if (p >= 1) { c.hops--; if (c.hops > 0) { c.hop = 0; } else { c.state = 'idle'; c.z = 0; c.t = 1 + Math.random() * 3; } }
      return;
    }
    c.t -= dt; c.wig += dt * 6;
    if (dist < 140 || c.t <= 0) {
      const away = dist < 140, a = away ? Math.atan2(uy, ux) + (Math.random() - 0.5) * 0.8 : Math.random() * TAU, len = away ? 90 : 36;
      c.state = 'hop'; c.hop = 0; c.hops = away ? 3 : 1; c.vx = Math.cos(a) * len / 0.5; c.vy = Math.sin(a) * len / 0.5 * 0.7; c.facing = c.vx >= 0 ? 1 : -1;
    }
  },
  wisp(c, dt, ux, uy, dist) {
    c.ph2 += dt;
    c.x += Math.sin(c.ph2 * 0.7 + c.ph) * 16 * dt; c.y += Math.cos(c.ph2 * 0.5 + c.ph * 2) * 10 * dt;
    if (dist > 80 && dist < 300) { c.x -= ux * 14 * dt; c.y -= uy * 10 * dt; }           // curious: drifts toward the hero
    else if (dist <= 80) { c.x += ux * 38 * dt; c.y += uy * 26 * dt; }                   // ...but shy up close
    c.z = 26 + Math.sin(c.ph2 * 1.3 + c.ph) * 8;
    c.trail.unshift([c.x, c.y - c.z]); if (c.trail.length > 8) c.trail.pop();
  },
  fish(c, dt) {
    if (c.jump) { c.jump.t += dt; if (c.jump.t > 0.55) { burst(c.jump.x, c.jump.y, '#d8f0fa', 5, 70, 1.5, 220); c.jump = null; } return; }
    c.t -= dt;
    if (c.t <= 0) {
      c.t = 3 + Math.random() * 8;
      const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * 0.6, w = c.w;
      c.jump = { t: 0, x: w.x + Math.cos(a) * w.rx * d, y: w.y + Math.sin(a) * w.ry * d, dir: Math.random() < 0.5 ? 1 : -1 };
      burst(c.jump.x, c.jump.y, '#d8f0fa', 7, 90, 1.8, 260);
      critterCall('splash', c.jump.x, c.jump.y, 1.5);
    }
  },
};

function updateCritters(dt) {
  if (!hero || !world) return;
  for (const c of critters) {
    if (!inView(c.x, c.y, 360)) continue;                    // animals far from the camera sleep
    const dx = c.x - hero.x, dy = c.y - hero.y, dist = Math.hypot(dx, dy) || 1;
    CRITTER_AI[c.kind](c, dt, dx / dist, dy / dist, dist);
    if (c.kind !== 'fish') { c.x = clampN(c.x, 20, WW - 20); c.y = clampN(c.y, 50, WH - 10); }
  }
  updateDevils(dt);
  updateWorldFx(dt);
}

// ---------- drawing ----------
function critterShadow(c, rx) { if (gfx.shadows) { ctx.fillStyle = `rgba(0,0,0,${0.2 - c.z * 0.002})`; ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, rx * 0.35, 0, 0, TAU); ctx.fill(); } }

const CRITTER_ART = {
  butterfly(c) {
    critterShadow(c, 3);
    const x = c.x, y = c.y - c.z, f = Math.abs(Math.sin(c.wing)), wx = 1 + f * 4.2;
    ell(x - wx * 0.6, y - 1.2, wx, 3.6, c.col); ell(x + wx * 0.6, y - 1.2, wx, 3.6, c.col);
    ell(x - wx * 0.5, y + 1.6, wx * 0.7, 2.4, 'rgba(0,0,0,0.25)'); ell(x + wx * 0.5, y + 1.6, wx * 0.7, 2.4, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = '#2a2420'; ctx.fillRect(x - 0.7, y - 3, 1.4, 7);
  },
  bird(c) {
    const x = c.x, y = c.y - c.z, f = c.facing;
    critterShadow(c, c.state === 'fly' ? 5 : 4);
    if (c.state === 'perch') {
      const bob = c.peck > 0 ? Math.sin(c.peck / 0.35 * Math.PI) * 2.2 : 0;
      ell(x, y - 4, 5, 3.6, c.col); ell(x - f * 5, y - 3.2, 3.4, 1.4, c.col, -0.3 * f);      // body + tail
      circ(x + f * 4, y - 6 + bob, 2.4, c.col);
      ctx.fillStyle = '#e8a020'; ctx.beginPath(); ctx.moveTo(x + f * 6, y - 6 + bob); ctx.lineTo(x + f * 8.4, y - 5.4 + bob); ctx.lineTo(x + f * 6, y - 4.8 + bob); ctx.fill();
      circ(x + f * 4.6, y - 6.8 + bob, 0.6, '#111');
      ctx.strokeStyle = '#5a4a3a'; ctx.lineWidth = 1; line(x - 1, y - 1, x - 1, y + 1); line(x + 1, y - 1, x + 1, y + 1);
    } else {
      const flap = Math.sin(c.wing);
      ell(x, y, 4.6, 2.8, c.col); circ(x + f * 4, y - 1, 2, c.col);
      ctx.strokeStyle = c.col; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x, y - 1); ctx.lineTo(x + side * 6, y - 3 - flap * 6); ctx.lineTo(x + side * 11, y - 1 - flap * 9); ctx.stroke(); }
    }
  },
  frog(c) {
    const x = c.x, y = c.y - c.z, f = c.facing, hop = c.state === 'hop';
    critterShadow(c, 5);
    ell(x, y - 3, hop ? 5.4 : 5, hop ? 3.2 : 3.6, '#4a8a3a'); ell(x - f * 0.5, y - 3.8, 3.6, 2, '#6aaa4a');
    circ(x + f * 3, y - 6, 1.6, '#4a8a3a'); circ(x + f * 0.2, y - 6, 1.6, '#4a8a3a'); circ(x + f * 3.2, y - 6.2, 0.7, '#111'); circ(x + f * 0.4, y - 6.2, 0.7, '#111');
    if (c.croak > 0) ell(x + f * 4, y - 2, 2 + Math.sin(c.croak * 20) * 0.8, 1.6, '#d8e8a0');
    ctx.strokeStyle = '#3a7a2e'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    if (hop) { line(x - f * 3, y - 2, x - f * 8, y); line(x + f * 3, y - 2, x + f * 7, y - 1); } else { line(x - f * 3, y - 1, x - f * 5, y + 0.5); line(x + f * 3, y - 1, x + f * 4, y + 0.5); }
  },
  lizard(c) {
    const x = c.x, f = c.facing, y = c.y, w = Math.sin(c.wig) * (c.state === 'run' ? 2.4 : 0.6);
    critterShadow(c, 7);
    ctx.strokeStyle = '#a08850'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - f * 4, y - 2); ctx.quadraticCurveTo(x - f * 10, y - 2 + w, x - f * 15, y - 1 - w); ctx.stroke();      // tail
    ell(x, y - 2.4, 5.4, 2.6, '#b89a5a'); ell(x - f * 1, y - 3, 3.4, 1, '#d4b878');
    circ(x + f * 6.4, y - 2.8, 2.2, '#b89a5a'); circ(x + f * 7.4, y - 3.4, 0.5, '#111');
    ctx.strokeStyle = '#8a7240'; ctx.lineWidth = 1.2;
    const lp = c.state === 'run' ? Math.sin(c.wig * 1.2) * 2 : 0;
    line(x + f * 3, y - 1, x + f * 5 + lp, y + 1); line(x - f * 3, y - 1, x - f * 5 - lp, y + 1);
  },
  hare(c) {
    const x = c.x, y = c.y - c.z, f = c.facing, hop = c.state === 'hop';
    critterShadow(c, 6);
    ell(x, y - 5, 6.4, hop ? 4 : 4.8, c.col); circ(x - f * 6.4, y - 5.4, 2.2, '#fff'); circ(x + f * 5.2, y - 7, 3.2, c.col);
    const tw = Math.sin(c.wig) * 0.3;
    ell(x + f * 4.4, y - 12 + (hop ? 1 : 0), 1.3, 4.4, c.col, f * (0.2 + tw)); ell(x + f * 6.4, y - 11.4, 1.3, 4.2, c.col, f * (0.5 - tw));
    circ(x + f * 6.6, y - 7.4, 0.7, '#111');
    ctx.strokeStyle = c.col; ctx.lineWidth = 2; ctx.lineCap = 'round'; line(x - f * 2, y - 2, x + f * 3, y - 1);
  },
  wisp(c) {
    const night = night01(), x = c.x, y = c.y - c.z, [r, g, b] = c.rgb, a = (0.5 + night * 0.5) * (0.8 + Math.sin(tAnim * 7 + c.ph) * 0.2);
    ctx.save(); ctx.globalCompositeOperation = gfx.glow ? 'lighter' : 'source-over';
    for (let i = c.trail.length - 1; i >= 1; i--) circ(c.trail[i][0], c.trail[i][1], 3 - i * 0.3, `rgba(${r},${g},${b},${0.2 * a * (1 - i / 8)})`);
    const gr = ctx.createRadialGradient(x, y, 0, x, y, 20);
    gr.addColorStop(0, `rgba(${r},${g},${b},${0.55 * a})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = gr; ctx.fillRect(x - 20, y - 20, 40, 40);
    circ(x, y, 2.6, `rgba(255,255,255,${0.9 * a})`);
    ctx.restore();
  },
  fish(c) {
    const j = c.jump; if (!j) return;
    const p = j.t / 0.55, h = Math.sin(p * Math.PI) * 15, fx = j.x + j.dir * (p - 0.5) * 18, fy = j.y - h;
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(j.dir * (p - 0.5) * 2.2);
    ell(0, 0, 5, 2.2, '#bcd4e0'); ell(0, 0.6, 4, 1.2, '#e8f4fa'); fillPoly([[-4.6 * j.dir, 0], [-8 * j.dir, -2.4], [-8 * j.dir, 2.4]], '#9ab8c8');
    ctx.restore();
    const rp = clampN(p, 0, 1); ctx.strokeStyle = `rgba(235,248,255,${(1 - rp) * 0.6})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(j.x, j.y, 3 + rp * 14, (3 + rp * 14) * 0.4, 0, 0, TAU); ctx.stroke();
  },
};
function drawCritter(c) { CRITTER_ART[c.kind](c); }

// ---------- desert dust devils ----------
function updateDevils(dt) {
  if (!world.B.devils) return;
  devilTimer -= dt;
  if (devilTimer <= 0 && devils.length < 2) {
    devilTimer = 22 + Math.random() * 24;
    const left = Math.random() < 0.5;
    devils.push({ x: clampN(cam.x + (left ? -120 : VW + 120), 40, WW - 40), y: clampN(cam.y + 100 + Math.random() * (VH - 200), 80, WH - 40), vx: (left ? 1 : -1) * (38 + Math.random() * 20), vy: (Math.random() - 0.5) * 16, life: 16, max: 16, ph: Math.random() * 6 });
  }
  for (const d of devils) {
    d.x += d.vx * dt; d.y += (d.vy + Math.sin(tAnim * 0.8 + d.ph) * 14) * dt; d.life -= dt;
    if (gfx.particles && inView(d.x, d.y, 60) && Math.random() < dt * 14) particles.push({ x: d.x + (Math.random() - 0.5) * 14, y: d.y, vx: d.vx * 0.3, vy: -10, life: 0.8, max: 0.8, size: 2.4, color: '#e8d4a0', g: 0 });
  }
  devils = devils.filter(d => d.life > 0 && d.x > -150 && d.x < WW + 150);
}
function drawDevil(d) {
  const fade = Math.min(1, d.life / 2, (d.max - d.life) / 2);
  drawShadow(d.x, d.y, 18, 0.18 * fade);
  for (let i = 0; i < 20; i++) {
    const h = i * 5.5, rad = 4 + i * 1.5 + Math.sin(tAnim * 2 + i) * 1.2, a = tAnim * 6 + i * 0.75 + d.ph;
    const px = d.x + Math.cos(a) * rad + Math.sin(h * 0.05 + tAnim) * 4, py = d.y - h;
    ctx.fillStyle = `rgba(222,196,142,${(0.42 - i * 0.012) * fade})`;
    ctx.beginPath(); ctx.ellipse(px, py, 5 + i * 0.3, 2.2, 0, 0, TAU); ctx.fill();
  }
}

// ---------- ambient particles ----------
function ambientCount(amb) { return amb === 'firefly' ? 45 : amb === 'pollen' ? 50 : amb === 'spore' ? 60 : amb === 'wispdust' ? 40 : amb === 'dust' ? 70 : 110; }
function makeAmbient(amb, x, y) {
  const base = { x, y, amb: true, life: 3 + Math.random() * 4, max: 7, g: 0 };
  switch (amb) {
    case 'firefly': return Math.random() < 0.7
      ? { ...base, kind: 'fly', vx: 0, vy: 0, size: 2, color: '#e8ff80', add: true }
      : { ...base, kind: 'leaf', y: cam.y - 10, vx: 0, vy: 30 + Math.random() * 20, size: 3, color: '#8a6', ph: Math.random() * 6 };
    case 'sand': return { ...base, x: cam.x - 10 + Math.random() * 40, vx: 250 + Math.random() * 150, vy: (Math.random() - 0.5) * 20, size: 1.5, color: '#f0dca0', streak: true };
    case 'snow': return { ...base, y: cam.y - 10 + Math.random() * 60, vx: -20 + Math.random() * 15, vy: 40 + Math.random() * 40, size: 1.5 + Math.random() * 2, color: '#fff' };
    case 'ember': return { ...base, y: cam.y + VH + 5 - Math.random() * 60, vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 60, size: 1.5 + Math.random() * 1.5, color: '#ff8a30', add: true };
    case 'pollen': if (night01() > 0.5) return null;             // drifting specks of pollen, by day only
      return { ...base, kind: 'pollen', vx: 8 + Math.random() * 10, vy: -4 - Math.random() * 6, size: 1.2 + Math.random() * 1.2, color: '#fff3b0', ph: Math.random() * 6 };
    case 'spore': return { ...base, kind: 'spore', vx: (Math.random() - 0.5) * 8, vy: -6 - Math.random() * 8, size: 1.6 + Math.random() * 1.6, color: Math.random() < 0.5 ? '#a8f0b0' : '#c8a0f0', add: true, ph: Math.random() * 6 };
    case 'wispdust': return { ...base, kind: 'spore', vx: (Math.random() - 0.5) * 6, vy: -4 - Math.random() * 6, size: 1.2 + Math.random(), color: '#bfe0ff', add: true, ph: Math.random() * 6 };
    case 'dust': return { ...base, x: cam.x - 10 + Math.random() * 30, vx: 120 + Math.random() * 90, vy: (Math.random() - 0.5) * 14, size: 1.5, color: '#d8dce4', streak: true };
  }
  return null;
}

// particles with their own look; returns true when it drew the particle
function drawSpecialParticle(p) {
  if (p.kind === 'smoke') {
    ctx.globalAlpha = (p.life / p.max) * 0.34; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgb(${p.color})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill(); return true;
  }
  if (p.kind === 'bubble') {
    ctx.globalAlpha = Math.min(1, p.life / 0.4) * 0.8; ctx.strokeStyle = p.color; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + (1 - p.life / p.max) * 0.5), 0, TAU); ctx.stroke(); return true;
  }
  if (p.kind === 'glint') {
    const a = Math.sin((1 - p.life / p.max) * Math.PI); ctx.globalAlpha = a; ctx.globalCompositeOperation = gfx.glow ? 'lighter' : 'source-over'; ctx.fillStyle = '#fff';
    ctx.fillRect(p.x - p.size, p.y - 0.5, p.size * 2, 1); ctx.fillRect(p.x - 0.5, p.y - p.size, 1, p.size * 2); return true;
  }
  if (p.kind === 'spore' || p.kind === 'pollen') {
    const tw = 0.55 + Math.sin(tAnim * 3 + p.ph) * 0.45, edge = Math.min(1, p.life / 1.2, (p.max - p.life) / 1.2 + 0.2);
    ctx.globalAlpha = Math.max(0, tw * edge * (p.kind === 'pollen' ? 0.7 : 0.9)); ctx.globalCompositeOperation = p.add && gfx.glow ? 'lighter' : 'source-over';
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x + Math.sin(tAnim * 1.3 + p.ph) * 3, p.y, p.size, 0, TAU); ctx.fill(); return true;
  }
  return false;
}

// smoke from vents, ghost-flame motes from braziers, bog bubbles, snow glints
function updateWorldFx(dt) {
  fxT -= dt; if (fxT > 0) return; fxT = 0.18;
  if (!gfx.particles) return;
  for (const p of world.props) {
    if ((p.k !== 'vent' && p.k !== 'brazier') || !inView(p.x, p.y, 50)) continue;
    if (p.k === 'vent') particles.push({ kind: 'smoke', x: p.x + (Math.random() - 0.5) * 8, y: p.y - 6, vx: 6 * windMul(), vy: -34 - Math.random() * 14, life: 2.4, max: 2.4, size: 5, grow: 6, color: '70,60,58', g: 0 });
    else if (Math.random() < 0.5) particles.push({ x: p.x + (Math.random() - 0.5) * 6, y: p.y - 24 * p.s, vx: (Math.random() - 0.5) * 10, vy: -24, life: 1.4, max: 1.4, size: 1.6, color: '#a8d8ff', add: true, g: 0 });
  }
  if (world.B.key === 'swamp') for (const w of world.water) {
    if (!inView(w.x, w.y, 80) || Math.random() > 0.3) continue;
    const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * 0.7;
    particles.push({ kind: 'bubble', x: w.x + Math.cos(a) * w.rx * d, y: w.y + Math.sin(a) * w.ry * d, vx: 0, vy: -8, life: 0.9, max: 0.9, size: 1.5 + Math.random() * 1.5, color: '#cfe8d0', g: 0 });
  }
  if (world.B.glint && night01() < 0.5) for (let i = 0; i < 3; i++)
    particles.push({ kind: 'glint', x: cam.x + Math.random() * VW, y: cam.y + Math.random() * VH, vx: 0, vy: 0, life: 0.5, max: 0.5, size: 2 + Math.random() * 2, color: '#fff', g: 0 });
}
