// Boss variants: one boss per biome, each with its own look and its own set of attacks.
// A boss is data (BOSSES) plus a small attack engine: it walks, picks an attack from its kit, telegraphs it, fires it, and goes
// back to walking. At half health it enrages (faster, more of everything). The Minotaur King keeps its original brain
// (updateMinotaurBoss in game.js); every other boss runs updateKitBoss below.

const BOSS_BY_BIOME = { forest: 'minotaur', jungle: 'goblinKing', swamp: 'slimeQueen', ruins: 'lich', snow: 'frostTitan', volcano: 'magma', desert: 'pharaoh', highlands: 'stormWarden' };

// hp/speed/dmg are multipliers on the standard boss numbers; attacks: weight of each attack; p2: extra weight once enraged
const BOSSES = {
  minotaur:   { names: ['Minotaur King', 'Minotaur Emperor'], hp: 1, speed: 1, dmg: 1, r: 34, color: '#ffdca0', intro: 'The ground shakes under heavy hooves.',
    theme: { epithet: 'of the Minotaur King', pref: ['dmg'] } },
  goblinKing: { names: ['Goblin King'], hp: 0.85, speed: 1.25, dmg: 0.9, r: 30, move: 'chase', color: '#9be36f', intro: 'A crown glints in a swarm of knives.',
    attacks: { bombs: 3, summon: 2, charge: 2 }, p2: { summon: 2, bombs: 1 }, summon: { type: 'goblin', n: 4, p2: 7 }, bomb: 'powder',
    theme: { epithet: 'of the Goblin King', pref: ['gold'] } },
  slimeQueen: { names: ['Slime Queen'], hp: 1.15, speed: 0.6, dmg: 1, r: 36, move: 'chase', color: '#7fe07f', intro: 'The swamp itself rises and wobbles.',
    attacks: { pools: 3, summon: 2, charge: 1 }, p2: { pools: 2, summon: 1 }, summon: { type: 'slime', n: 3, p2: 5 }, pool: 'acid',
    theme: { epithet: 'of the Slime Queen', pref: ['hp'] } },
  lich:       { names: ['Lich Archer'], hp: 0.8, speed: 0.9, dmg: 1, r: 30, move: 'kite', color: '#a6f0b0', intro: 'Bone fingers draw a bowstring of cold light.',
    attacks: { volley: 4, blink: 2, summon: 1 }, p2: { volley: 2, blink: 1 }, summon: { type: 'archer', n: 2, p2: 3 },
    theme: { epithet: 'of the Lich Archer', pref: ['crit'] } },
  frostTitan: { names: ['Frost Titan'], hp: 1.3, speed: 0.6, dmg: 1.05, r: 38, move: 'chase', color: '#bfeaff', intro: 'The air freezes in front of a walking glacier.', chill: true,
    attacks: { slam: 3, nova: 3, strikes: 2 }, p2: { strikes: 2, nova: 1 }, strike: 'icicle',
    theme: { epithet: 'of the Frost Titan', pref: ['cdr'] } },
  magma:      { names: ['Magma Colossus'], hp: 1.35, speed: 0.5, dmg: 1.1, r: 40, move: 'chase', color: '#ffb060', intro: 'Stone cracks and the cracks glow.',
    attacks: { slam: 3, pools: 2, bombs: 2 }, p2: { bombs: 2, pools: 1 }, pool: 'lava', bomb: 'lava',
    theme: { epithet: 'of the Magma Colossus', pref: ['critDmg'] } },
  pharaoh:    { names: ['Sand Pharaoh'], hp: 1, speed: 0.8, dmg: 1, r: 34, move: 'chase', color: '#ffe08a', intro: 'Linen wraps and a rattle of gold from the dunes.',
    attacks: { nova: 3, charge: 2, summon: 2 }, p2: { summon: 2, nova: 1 }, summon: { type: 'goblin', n: 3, p2: 5 }, sand: true,
    theme: { epithet: 'of the Sand Pharaoh', pref: ['stamina'] } },
  stormWarden:{ names: ['Storm Warden'], hp: 1.1, speed: 0.75, dmg: 1, r: 36, move: 'chase', color: '#fff3a0', intro: 'Thunder walks on two legs.',
    attacks: { strikes: 4, slam: 2, charge: 2 }, p2: { strikes: 3 }, strike: 'lightning',
    theme: { epithet: 'of the Storm Warden', pref: ['speed'] } },
};

let hazards = [];                                  // lingering danger on the ground: bombs, pools, strikes
const clearHazards = () => { hazards = []; };
const bossColor = m => (BOSSES[m.kind] || BOSSES.minotaur).color;

// ---------------------------------------------------------------- the attacks
const clampWorld = (x, y) => ({ x: Math.max(30, Math.min(WW - 30, x)), y: Math.max(70, Math.min(WH - 20, y)) });
const ATK = {
  slam:    { wind: 0.8, fire(m) { shockwaves.push({ x: m.x, y: m.y, r: 10, maxR: m.phase2 ? 320 : 250, hit: false, dmg: m.dmg, color: m.def.color }); sfx('slam'); shake(12); burst(m.x, m.y, '#b9a', 24, 220, 4, 100); } },
  nova:    { wind: 0.95, fire(m) { shockwaves.push({ x: m.x, y: m.y, r: 10, maxR: m.phase2 ? 400 : 340, hit: false, dmg: Math.round(m.dmg * 0.9), color: m.def.color, chill: !!m.def.chill }); sfx(m.def.chill ? 'thunder' : 'boom'); shake(9); burst(m.x, m.y, m.def.color, 26, 240, 3, 60, true); } },
  summon:  { wind: 1.0, fire(m) {
    const S = m.def.summon; if (!S) return;
    const n = m.phase2 ? S.p2 : S.n, room = Math.max(0, 16 - enemies.length);
    for (let i = 0; i < Math.min(n, room); i++) { const a = (i / n) * Math.PI * 2 + Math.random(), p = clampWorld(m.x + Math.cos(a) * 70, m.y + Math.sin(a) * 40); spawnEnemy(S.type, p, { spawnT: 0.4, noVariant: true }); }
    sfx('roar'); shake(6); burst(m.x, m.y, m.def.color, 20, 200, 3, 0, true);
  } },
  bombs:   { wind: 0.7, fire(m) {
    const n = m.phase2 ? 6 : 4;
    for (let i = 0; i < n; i++) { const p = clampWorld(hero.x + (Math.random() - 0.5) * 150, hero.y + (Math.random() - 0.5) * 90), f = 0.9 + i * 0.28; hazards.push({ k: 'bomb', x: p.x, y: p.y, fuse: f, f0: f, r: 62, dmg: Math.round(m.dmg * 0.9), kind: m.def.bomb || 'powder' }); }
    sfx('spawn');
  } },
  pools:   { wind: 0.9, fire(m) {
    const n = m.phase2 ? 5 : 3;
    for (let i = 0; i < n; i++) { const p = clampWorld(hero.x + (Math.random() - 0.5) * 220, hero.y + (Math.random() - 0.5) * 130); hazards.push({ k: 'pool', x: p.x, y: p.y, r: 50, life: 7, max: 7, tick: 0, dmg: Math.max(2, Math.round(m.dmg * 0.35)), kind: m.def.pool || 'acid', born: 0 }); }
    sfx(m.def.pool === 'lava' ? 'lava' : 'splash');
  } },
  strikes: { wind: 0.9, fire(m) {
    const n = m.phase2 ? 9 : 6;
    for (let i = 0; i < n; i++) { const p = i === 0 ? clampWorld(hero.x, hero.y) : clampWorld(hero.x + (Math.random() - 0.5) * 340, hero.y + (Math.random() - 0.5) * 200); hazards.push({ k: 'strike', x: p.x, y: p.y, delay: 0.95 + i * 0.14, d0: 0.95 + i * 0.14, r: 44, dmg: Math.round(m.dmg * 0.95), kind: m.def.strike || 'lightning', boltT: 0 }); }
    sfx('crackle');
  } },
  volley:  { wind: 0.7, fire(m) {
    const n = m.phase2 ? 9 : 5, a0 = Math.atan2(hero.y - 35 - (m.y - 70), hero.x - m.x);
    for (let i = 0; i < n; i++) { const a = a0 + (i - (n - 1) / 2) * 0.17; projectiles.push({ x: m.x, y: m.y - 70, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320, t: 3.4, dmg: Math.round(m.dmg * 0.6) }); }
    sfx('arrow');
  } },
  blink:   { wind: 0.55, fire(m) {
    const a = Math.random() * Math.PI * 2, d = 190 + Math.random() * 90, p = clampWorld(hero.x + Math.cos(a) * d, hero.y + Math.sin(a) * d * 0.7);
    burst(m.x, m.y - 40, m.def.color, 16, 160, 3, 0, true); m.x = p.x; m.y = p.y; m.appearT = 0.35; m.chain = 'volley';
    burst(m.x, m.y - 40, m.def.color, 16, 160, 3, 0, true); sfx('spawn');
  } },
  charge:  { wind: 0.6, fire(m) { m.state = 'charge'; m.stateT = 0.55; m.charges = m.charges > 0 ? m.charges : (m.phase2 ? 3 : 2); sfx('charge'); } },
};

function spawnBossOfKind(kind, pos, d, th) {
  const def = BOSSES[kind] || BOSSES.minotaur;
  const hp = Math.round((700 + wave * 120) * d.hp * th.hp * def.hp);
  const names = def.names, setNo = Math.max(1, Math.round(wave / WAVES_PER_SET));
  return {
    type: 'boss', kind, name: names[(setNo % 2 === 0 && names.length > 1) ? 1 : 0],
    x: pos.x, y: pos.y, hp, maxHp: hp, r: def.r, dmg: Math.round((20 + wave) * d.dmg * th.dmg * def.dmg), xp: Math.round((150 + wave * 20) * d.xp),
    speed: (70 + wave) * d.spd * th.spd * def.speed, facing: 1, walkT: 0, state: 'walk', stateT: 1.6, charges: 0, summoned: false, phase2: false, spawnT: 0.8,
    chargeDx: 0, chargeDy: 0, knockX: 0, knockY: 0, flashT: 0, burnT: 0, slowT: 0, atk: null, atkT: 0, lastAtk: null, atkLog: {}, def,
  };
}

function pickAttack(m, dist) {
  const w = { ...m.def.attacks };
  if (m.phase2) for (const k in m.def.p2) w[k] = (w[k] || 0) + m.def.p2[k];
  if (m.chain) { const c = m.chain; m.chain = null; return c; }
  for (const k of Object.keys(w)) {
    if (k === 'slam') w[k] *= dist < 160 ? 3 : 0.3;
    if (k === 'charge') w[k] *= dist > 160 ? 2 : 0.5;
    if (k === 'volley') w[k] *= dist > 110 ? 1 : 0.2;
    if (k === 'blink') w[k] *= dist < 240 ? 2 : 0.3;
    if (k === m.lastAtk) w[k] *= 0.35;
  }
  let tot = 0; for (const k in w) tot += w[k];
  let x = Math.random() * tot;
  for (const k in w) if ((x -= w[k]) <= 0) return k;
  return Object.keys(w)[0];
}

function updateKitBoss(m, dt, dx, dy, dist, spd) {
  const def = m.def || (m.def = BOSSES[m.kind]);
  if (!m.phase2 && m.hp < m.maxHp / 2) {                            // half health: faster, and more of everything
    m.phase2 = m.summoned = true; m.speed *= 1.25; m.stateT = Math.min(m.stateT, 0.6);
    sfx('roar'); shake(8); burst(m.x, m.y - 40, def.color, 30, 260, 3, 0, true);
    popups.push({ text: `${m.name} is enraged!`, x: VW / 2, y: 150, t: 2, big: true, screen: true, color: '#f66' });
    if (def.summon) ATK.summon.fire(m);
  }
  m.appearT = Math.max(0, (m.appearT || 0) - dt);
  if (m.state === 'walk') {
    if (m.appearT <= 0) {
      if (def.move === 'kite') {                                    // keeps its distance, like an archer should
        const want = 250, dir = dist > want + 40 ? 1 : dist < want - 40 ? -1 : 0;
        m.x += (dx / dist) * spd * dir * dt; m.y += (dy / dist) * spd * dir * dt; m.moving = !!dir; if (dir) m.walkT += dt * 5;
      } else if (dist > 36) { m.x += (dx / dist) * spd * dt; m.y += (dy / dist) * spd * dt; m.walkT += dt * 5; m.moving = true; } else m.moving = false;
    }
    m.facing = Math.sign(dx) || m.facing;
    if (m.stateT <= 0 && !hero.dead && m.appearT <= 0) {
      const id = pickAttack(m, dist);
      m.state = 'atk'; m.atk = id; m.atkT = ATK[id].wind * (m.phase2 ? 0.85 : 1); m.atkWind = m.atkT; m.lastAtk = id;
      m.chargeDx = dx / dist; m.chargeDy = dy / dist; m.atkLog[id] = (m.atkLog[id] || 0) + 1;
    }
  } else if (m.state === 'atk') {
    m.facing = Math.sign(dx) || m.facing;
    if (m.atk === 'charge') { m.chargeDx = dx / dist; m.chargeDy = dy / dist; }
    m.atkT -= dt;
    if (m.atkT <= 0) {
      ATK[m.atk].fire(m);
      if (m.state === 'atk') { m.state = 'walk'; m.stateT = (m.atk === 'blink' ? 0.35 : 1.5 + Math.random() * 0.9) * (m.phase2 ? 0.75 : 1); }
    }
  } else if (m.state === 'charge') {
    m.x += m.chargeDx * 440 * dt; m.y += m.chargeDy * 440 * dt; m.walkT += dt * 18;
    if (gfx.particles && Math.random() < 0.5) burst(m.x, m.y, '#a98', 1, 40, 4, -10);
    if (m.stateT <= 0) {
      if (--m.charges > 0) { m.state = 'atk'; m.atk = 'charge'; m.atkT = 0.35; m.atkWind = 0.35; }
      else { m.state = 'walk'; m.stateT = 1.6 + Math.random(); }
    }
  }
  m.x = Math.max(20, Math.min(WW - 20, m.x)); m.y = Math.max(60, Math.min(WH - 10, m.y));
}

// ---------------------------------------------------------------- hazards on the ground
function updateHazards(dt) {
  if (!hazards.length) return;
  for (const h of hazards) {
    if (h.k === 'bomb') {
      h.fuse -= dt;
      if (h.fuse <= 0) {
        h.done = true; sfx('boom'); shake(7);
        burst(h.x, h.y - 10, h.kind === 'lava' ? '#ff8a30' : '#ffd070', 22, 240, 3, 60, true);
        if (!hero.dead && Math.hypot(hero.x - h.x, (hero.y - h.y) * 1.5) < h.r) damageHero(h.dmg);
      }
    } else if (h.k === 'pool') {
      h.life -= dt; h.born += dt; h.tick -= dt;
      if (h.life <= 0) h.done = true;
      else if (h.tick <= 0 && h.born > 0.5 && !hero.dead && Math.hypot((hero.x - h.x) / 1, (hero.y - h.y) * 1.8) < h.r) {
        h.tick = 0.5;
        const dealt = damageHero(h.dmg, false);
        if (dealt > 0 && h.kind === 'acid') addPoison();
      }
    } else if (h.k === 'strike') {
      if (h.delay > 0) { h.delay -= dt; if (h.delay <= 0) { h.boltT = 0.28; sfx(h.kind === 'icicle' ? 'crackle' : 'thunder'); shake(5); burst(h.x, h.y - 10, h.kind === 'icicle' ? '#cfeaff' : '#fff6a0', 14, 200, 2.4, 80, true); if (!hero.dead && Math.hypot(hero.x - h.x, (hero.y - h.y) * 1.5) < h.r) damageHero(h.dmg); } }
      else { h.boltT -= dt; if (h.boltT <= 0) h.done = true; }
    }
  }
  hazards = hazards.filter(h => !h.done);
}

function drawHazards() {
  for (const h of hazards) {
    if (!inView(h.x, h.y, 120)) continue;
    if (h.k === 'bomb') {
      const p = 1 - Math.max(0, h.fuse) / h.f0, r = h.r;
      ctx.strokeStyle = `rgba(255,${Math.round(160 - 120 * p)},60,${0.35 + 0.5 * p})`; ctx.lineWidth = 2; ctx.fillStyle = `rgba(255,80,40,${0.05 + 0.18 * p})`;
      ctx.beginPath(); ctx.ellipse(h.x, h.y, r, r / 1.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      const drop = Math.max(0, h.fuse) * 60;                                   // the bomb falls in and sits there fizzing
      ctx.fillStyle = h.kind === 'lava' ? '#ff7a28' : '#2a2a2a'; ctx.beginPath(); ctx.arc(h.x, h.y - 8 - drop, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd070'; ctx.lineWidth = 1.5; line(h.x + 3, h.y - 14 - drop, h.x + 7, h.y - 19 - drop - Math.sin(tAnim * 30) * 1.5);
    } else if (h.k === 'pool') {
      const a = Math.min(1, h.born / 0.5) * Math.min(1, h.life / 1), c = h.kind === 'lava' ? [255, 110, 30] : [90, 220, 90];
      ctx.fillStyle = `rgba(${c},${0.38 * a})`; ctx.strokeStyle = `rgba(${c},${0.8 * a})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r / 1.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${0.25 * a})`;
      for (let i = 0; i < 4; i++) { const t = tAnim * 1.4 + i * 1.7 + h.x; ctx.beginPath(); ctx.arc(h.x + Math.cos(t) * h.r * 0.5, h.y + Math.sin(t * 1.3) * h.r * 0.2, 2 + (i % 2), 0, Math.PI * 2); ctx.fill(); }
      if (h.born < 0.5) { ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r / 1.8, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    } else if (h.k === 'strike') {
      const ice = h.kind === 'icicle';
      if (h.delay > 0) {
        const p = 1 - h.delay / h.d0;
        ctx.strokeStyle = ice ? `rgba(160,220,255,${0.4 + 0.5 * p})` : `rgba(255,240,120,${0.4 + 0.5 * p})`; ctx.fillStyle = ice ? `rgba(160,220,255,${0.05 + 0.15 * p})` : `rgba(255,240,120,${0.05 + 0.15 * p})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r / 1.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r * (1 - p), h.r * (1 - p) / 1.5, 0, 0, Math.PI * 2); ctx.stroke();
      } else {
        const a = Math.max(0, h.boltT / 0.28);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        if (ice) { ctx.fillStyle = `rgba(200,235,255,${a})`; ctx.beginPath(); ctx.moveTo(h.x - 12, h.y - 170 * a); ctx.lineTo(h.x + 12, h.y - 170 * a); ctx.lineTo(h.x, h.y + 4); ctx.closePath(); ctx.fill(); }
        else { ctx.strokeStyle = `rgba(255,248,170,${a})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(h.x, h.y - 260); for (let i = 1; i <= 8; i++) ctx.lineTo(h.x + (((i * 37 + h.x) % 28) - 14) * (i < 8 ? 1 : 0), h.y - 260 + i * 32.5); ctx.stroke(); ctx.lineWidth = 12; ctx.strokeStyle = `rgba(255,230,120,${0.25 * a})`; ctx.stroke(); }
        ctx.restore();
      }
    }
  }
}

// ground markers for what the boss is winding up (slam and nova size, a charge's line, a volley's aim)
function drawBossTelegraph(m) {
  if (m.state !== 'atk' || !m.atk || m.dieT !== undefined) return;
  const p = 1 - Math.max(0, m.atkT) / (m.atkWind || 1), c = m.def ? m.def.color : '#f88';
  ctx.save(); ctx.lineWidth = 2;
  if (m.atk === 'slam' || m.atk === 'nova') {
    const R = m.atk === 'slam' ? (m.phase2 ? 320 : 250) : (m.phase2 ? 400 : 340);
    ctx.strokeStyle = withAlpha(c, 0.25 + 0.4 * p); ctx.fillStyle = withAlpha(c, 0.04 + 0.08 * p);
    ctx.beginPath(); ctx.ellipse(m.x, m.y, R, R / 1.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (m.atk === 'charge') {
    ctx.strokeStyle = `rgba(255,90,90,${0.3 + 0.5 * p})`; ctx.setLineDash([8, 6]); line(m.x, m.y, m.x + m.chargeDx * 440 * 0.55, m.y + m.chargeDy * 440 * 0.55); ctx.setLineDash([]);
  } else if (m.atk === 'volley') {
    ctx.strokeStyle = `rgba(160,255,190,${0.2 + 0.5 * p})`; ctx.setLineDash([4, 6]); line(m.x, m.y - 70, hero.x, hero.y - 35); ctx.setLineDash([]);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- how bosses look
function drawScaled(m, s, fn) { ctx.save(); ctx.translate(m.x, m.y); ctx.scale(s, s); ctx.translate(-m.x, -m.y); fn(); ctx.restore(); }
function drawCrown(x, y, w, col = '#fd4') {
  ctx.fillStyle = col; ctx.strokeStyle = '#6a4a10'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x - w, y - w * 0.9); ctx.lineTo(x - w * 0.5, y - w * 0.4); ctx.lineTo(x, y - w * 1.1); ctx.lineTo(x + w * 0.5, y - w * 0.4); ctx.lineTo(x + w, y - w * 0.9); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e22'; ctx.beginPath(); ctx.arc(x, y - w * 0.35, w * 0.16, 0, Math.PI * 2); ctx.fill();
}
function drawGiant(m, S) {
  const { x, y, facing: f } = m, sc = S.scale || 2, wind = m.state === 'atk';
  drawShadow(x, y, 26 * sc);
  ctx.save(); ctx.translate(x, y); ctx.scale(sc * (1 + Math.sin(tAnim * 2.4) * 0.012), sc * (1 + Math.sin(tAnim * 2.4 + 1) * 0.02)); ctx.translate(-x, -y);
  const sw = Math.sin(m.walkT) * 0.5, bx = x + (wind ? Math.sin(performance.now() / 22) * 1.4 : 0), col = statusTint(m, S.body);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = S.dark; ctx.lineWidth = 9; line(bx - 7, y - 26, bx - 8 + Math.sin(sw) * 9, y); line(bx + 7, y - 26, bx + 8 - Math.sin(sw) * 9, y);
  ctx.fillStyle = S.dark; ctx.fillRect(bx - 8 + Math.sin(sw) * 9 - 6, y - 4, 12, 5); ctx.fillRect(bx + 8 - Math.sin(sw) * 9 - 6, y - 4, 12, 5);
  ctx.fillStyle = col; ctx.strokeStyle = S.dark; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(bx, y - 50, 20, 26, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (S.kind === 'pharaoh') { ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.4; for (let i = 0; i < 7; i++) line(bx - 18 + i * 1.2, y - 70 + i * 6, bx + 18 - i * 1.2, y - 66 + i * 6); ctx.fillStyle = '#3a7fd0'; ctx.fillRect(bx - 14, y - 72, 28, 5); ctx.fillStyle = '#ffd24a'; ctx.fillRect(bx - 12, y - 72, 24, 2); }
  if (S.kind === 'magma') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,${120 + Math.sin(tAnim * 3) * 30},30,0.9)`; ctx.lineWidth = 2.2; for (const [a, b, c2, d2] of [[-10, -62, -2, -50], [-2, -50, 6, -56], [6, -56, 12, -42], [-12, -44, -4, -34], [2, -38, 10, -28], [-6, -70, 2, -62]]) line(bx + a, y + b, bx + c2, y + d2); ctx.restore(); }
  if (S.kind === 'frost') { ctx.fillStyle = '#e8f8ff'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(bx + sd * 14, y - 70); ctx.lineTo(bx + sd * 22, y - 96); ctx.lineTo(bx + sd * 25, y - 68); ctx.closePath(); ctx.fill(); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(bx - 4, y - 74); ctx.lineTo(bx, y - 98); ctx.lineTo(bx + 5, y - 74); ctx.closePath(); ctx.fill(); }
  const up = wind ? -28 : 0, ay = y - 62;
  ctx.strokeStyle = col; ctx.lineWidth = 9;
  line(bx - 16, ay, bx - 28 - sw * 5, y - 34 + up); line(bx + 16, ay, bx + 28 + sw * 5, y - 34 + up);
  ctx.fillStyle = S.fist || S.dark; ctx.beginPath(); ctx.arc(bx - 28 - sw * 5, y - 32 + up, 7, 0, Math.PI * 2); ctx.arc(bx + 28 + sw * 5, y - 32 + up, 7, 0, Math.PI * 2); ctx.fill();
  if (S.kind === 'pharaoh') { ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 3; line(bx + 30 + sw * 5, y - 32 + up, bx + 32 + sw * 5, y - 100 + up); ctx.beginPath(); ctx.ellipse(bx + 32 + sw * 5, y - 106 + up, 5, 7, 0, 0, Math.PI * 2); ctx.stroke(); }
  const hx = bx + f * 3, hy = y - 84;
  ctx.fillStyle = col; ctx.strokeStyle = S.dark; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hx, hy, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (S.kind === 'magma') { ctx.fillStyle = '#2a1e1e'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hx + sd * 6, hy - 9); ctx.lineTo(hx + sd * 16, hy - 24); ctx.lineTo(hx + sd * 12, hy - 6); ctx.fill(); } }
  if (S.kind === 'pharaoh') { ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.moveTo(hx - 14, hy - 4); ctx.lineTo(hx - 10, hy - 16); ctx.lineTo(hx + 10, hy - 16); ctx.lineTo(hx + 14, hy - 4); ctx.lineTo(hx + 12, hy + 14); ctx.lineTo(hx - 12, hy + 14); ctx.closePath(); ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1; ctx.fillStyle = '#3a7fd0'; for (let i = -1; i <= 1; i++) ctx.fillRect(hx + i * 6 - 1.5, hy - 15, 3, 9); }
  ctx.fillStyle = S.eye; ctx.shadowColor = S.eye; ctx.shadowBlur = gfx.glow ? 8 : 0; ctx.beginPath(); ctx.arc(hx + f * 5, hy - 1, 2.4, 0, Math.PI * 2); ctx.arc(hx - f * 2, hy - 1, 2.1, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  if (S.kind === 'storm' && wind) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,240,140,0.9)'; ctx.lineWidth = 2; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(bx + sd * 30, y - 60 + up); for (let i = 1; i <= 5; i++) ctx.lineTo(bx + sd * (30 + Math.sin(performance.now() / 40 + i * 3) * 9), y - 60 + up - i * 12); ctx.stroke(); } ctx.restore(); }
  if (S.kind === 'storm') { ctx.strokeStyle = '#e8f0ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(hx - 8, hy + 8); ctx.quadraticCurveTo(hx, hy + 24, hx + 8, hy + 8); ctx.stroke(); }
  ctx.restore();
}
const GIANT_STYLE = {
  frostTitan:  { kind: 'frost',   scale: 2.1, body: '#9fd4f0', dark: '#3f6f98', fist: '#d8f2ff', eye: '#ffffff' },
  magma:       { kind: 'magma',   scale: 2.3, body: '#5a4646', dark: '#2a1e1e', fist: '#ff8a30', eye: '#ffd060' },
  stormWarden: { kind: 'storm',   scale: 2.1, body: '#6a7a96', dark: '#2e384a', fist: '#aebbd6', eye: '#ffe65a' },
  pharaoh:     { kind: 'pharaoh', scale: 2.0, body: '#d2b070', dark: '#6a5226', fist: '#ffd24a', eye: '#5ff0ff' },
};
function drawBossArt(m) {
  const k = m.kind, fade = m.alpha ?? 1;
  ctx.save();
  if (k === 'lich') { const out = m.state === 'atk' && m.atk === 'blink' ? Math.max(0, m.atkT / (m.atkWind || 1)) : 1, inn = m.appearT > 0 ? 1 - m.appearT / 0.35 : 1; ctx.globalAlpha *= Math.max(0.05, Math.min(out, inn)); }
  if (k === 'minotaur' || !k) drawMinotaur(m, 2, m.summoned ? '#8b2a1e' : '#5a2e1a', true);
  else if (GIANT_STYLE[k]) drawGiant(m, GIANT_STYLE[k]);
  else if (k === 'goblinKing') {
    drawScaled(m, 2.5, () => { drawGoblin(m); drawCrown(m.x + m.facing * 3, m.y - 44 - Math.abs(Math.sin(m.walkT)) * 2, 7); });
    ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.arc(m.x - m.facing * 26, m.y - 62, 11, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffd070'; ctx.fillRect(m.x - m.facing * 26 - 3, m.y - 74, 6, 4);   // a sack of bombs on his back
  } else if (k === 'slimeQueen') {
    const big = { ...m, size: 1, hopZ: Math.abs(Math.sin(tAnim * 2)) * 4, state: m.state === 'charge' ? 'hop' : 'walk', stateT: 0.25, land: 0 };
    drawScaled(m, 2.9, () => { drawSlime(big); drawCrown(m.x, m.y - 25, 8); });
    ctx.fillStyle = 'rgba(160,255,160,0.5)'; for (let i = 0; i < 5; i++) { const a = tAnim * 0.9 + i * 1.26; ctx.beginPath(); ctx.arc(m.x + Math.cos(a) * 70, m.y - 40 + Math.sin(a * 1.4) * 22, 5, 0, Math.PI * 2); ctx.fill(); }   // slimelets circling her
  } else if (k === 'lich') {
    const aim = { ...m, state: m.state === 'atk' && m.atk === 'volley' ? 'aim' : 'walk', stateT: m.atkT, moving: m.moving };
    drawScaled(m, 1.75, () => {
      drawArcher(aim);
      ctx.fillStyle = '#241833'; ctx.strokeStyle = '#6a3fa0'; ctx.lineWidth = 1;                               // robe and hood over the bones
      ctx.beginPath(); ctx.moveTo(m.x - 9, m.y - 46); ctx.lineTo(m.x + 9, m.y - 46); ctx.lineTo(m.x + 15, m.y + 1); ctx.lineTo(m.x - 15, m.y + 1); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(m.x, m.y - 53, 10, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(m.x + 9, m.y - 48); ctx.lineTo(m.x - 9, m.y - 48); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#9dffb8'; ctx.shadowColor = '#9dffb8'; ctx.shadowBlur = gfx.glow ? 8 : 0; ctx.beginPath(); ctx.arc(m.x + m.facing * 3, m.y - 53, 1.8, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    });
  }
  ctx.restore();
}
