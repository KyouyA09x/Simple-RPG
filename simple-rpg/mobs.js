// Mob and boss combat motion. Everything that hurts you now does it with an attack you can see coming: a wind-up, a strike, a recovery
// (goblins stab, minotaurs gore, ogres swing a club, archers bash with the bow, slimes crouch before they pounce), and every boss has
// signature attacks of its own on top of the shared ones in bosses.js.
// swingPos(m) is the one number the drawing code needs: -1 fully wound up ... 0 at rest ... +1 at the end of the strike, easing back to 0.

const ease = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const FIRE_T = 0.4, FIRE_RISE = 0.1, OLD_WIND = { windup: 0.6, slamWind: 0.8, smashWind: 0.6 };

// extra: how far past touching it can hit you; wind / hit / rec: seconds of wind-up, strike and recovery; cd: pause before the next one; lunge: px/s while striking; mul: damage
const MELEE = {
  goblin:   { extra: 26, wind: 0.34, hit: 0.14, rec: 0.42, cd: 0.55, lunge: 170, mul: 1,    snd: 'swing' },
  minotaur: { extra: 40, wind: 0.5,  hit: 0.18, rec: 0.6,  cd: 0.9,  lunge: 130, mul: 1.15, snd: 'whoosh' },
  ogre:     { extra: 46, wind: 0.62, hit: 0.2,  rec: 0.75, cd: 1.0,  lunge: 60,  mul: 1.2,  snd: 'slam' },
  archer:   { extra: 14, wind: 0.3,  hit: 0.12, rec: 0.5,  cd: 1.2,  lunge: 80,  mul: 0.8,  snd: 'swing' },
  wolf:     { extra: 18, wind: 0.28, hit: 0.12, rec: 0.4,  cd: 0.8,  lunge: 140, mul: 1,    snd: 'swing' },
  panther:  { extra: 26, wind: 0.35, hit: 0.12, rec: 0.5,  cd: 0.9,  lunge: 150, mul: 1.1,  snd: 'swing' },
  scorpion: { extra: 30, wind: 0.4,  hit: 0.14, rec: 0.6,  cd: 1.0,  lunge: 60,  mul: 1.1,  snd: 'whoosh' },
  icesprite:{ extra: 8,  wind: 0.3,  hit: 0.1,  rec: 0.5,  cd: 1.5,  lunge: 40,  mul: 0.7,  snd: 'whoosh' },
  fireimp:  { extra: 8,  wind: 0.3,  hit: 0.1,  rec: 0.5,  cd: 1.5,  lunge: 40,  mul: 0.7,  snd: 'whoosh' },
  bogLurker:{ extra: 36, wind: 0.55, hit: 0.16, rec: 0.8,  cd: 1.2,  lunge: 90,  mul: 1.2,  snd: 'splash' },
  skeleton: { extra: 24, wind: 0.38, hit: 0.14, rec: 0.5,  cd: 0.8,  lunge: 110, mul: 1,    snd: 'swing' },
  harpy:    { extra: 20, wind: 0.3,  hit: 0.1,  rec: 0.45, cd: 1.0,  lunge: 90,  mul: 0.9,  snd: 'whoosh' },
};

function swingPos(m) {
  const s = m.mel;
  if (s) {
    const P = MELEE[m.type];
    if (s.ph === 'wind') return -ease(s.t / P.wind);
    if (s.ph === 'strike') return -1 + 2 * ease(s.t / P.hit);
    return 1 - ease(s.t / P.rec);
  }
  const held = m.state === 'chan' || m.state === 'leap' || m.state === 'dash' ? 1 : m.state === 'charge' ? 0.4 : null;
  if (m.fireT > 0 && FIRE_T - m.fireT < FIRE_RISE) return -1 + ((held ?? 1) + 1) * ease((FIRE_T - m.fireT) / FIRE_RISE);          // letting go: from wound up to struck in a few frames
  if (held !== null) return held;
  if (m.state === 'atk' && m.atkWind) return -ease(1 - m.atkT / m.atkWind);
  if (OLD_WIND[m.state] && m.stateT > 0) return -ease(1 - m.stateT / OLD_WIND[m.state]);
  if (m.fireT > 0) return Math.min(1, m.fireT / (FIRE_T - FIRE_RISE));
  return 0;
}

// per-creature upkeep, before its brain runs
function mobTick(m, dt) {
  shieldTick(m); fidgetTick(m, dt);
  if (m.fireT > 0) m.fireT = Math.max(0, m.fireT - dt);
  if (m.recoilT > 0) m.recoilT = Math.max(0, m.recoilT - dt);
  if (m.alertT === undefined) m.alertT = 0.45;                          // the moment after it rises from the ground: it looks up and notices you
  else if (m.alertT > 0 && !(m.spawnT > 0)) m.alertT = Math.max(0, m.alertT - dt);
  if ((m.type === 'minotaur' || m.type === 'ogre') && m.state === 'walk' && !m.mel && gfx.particles && Math.random() < dt * 1.4) {      // snorts steam
    particles.push({ x: m.x + m.facing * 12 * (m.scale || 1), y: m.y - 66 * (m.type === 'ogre' ? 1.4 : 1), vx: m.facing * 30, vy: -22, life: 0.5, max: 0.5, size: 2.4, color: 'rgba(235,235,235,0.7)' });
  }
}

// a basic attack. Returns true while the creature is busy with it (it stands and swings instead of walking)
function melTick(m, dt, dx, dy, dist, fz) {
  const P = MELEE[m.type]; if (!P) return false;
  if (isNewMob(m) && m.state !== 'walk') return false;                    // digging, hidden, aiming, leaping or lying in pieces: no swing now
  m.melCd = Math.max(0, (m.melCd || 0) - dt);
  let s = m.mel;
  const sc = m.scale || 1, reach = m.r + 12 + P.extra * sc;
  if (!s) {
    if (hero.dead || m.melCd > 0 || m.spawnT > 0.2 || dist > reach) return false;
    if ((m.type === 'minotaur' || m.type === 'ogre') && m.state !== 'walk') return false;       // it is busy charging or smashing
    if (m.type === 'archer' && m.state === 'aim') return false;
    if (m.type === 'ogre' && m.stateT <= 0 && Math.random() < 0.4) { m.state = 'smashWind'; m.stateT = 0.6; return false; }      // now and then the ground smash instead of the club
    m.mel = { ph: 'wind', t: 0, hit: false };
    m.facing = Math.sign(dx) || m.facing;
    return true;
  }
  s.t += dt;
  if (s.ph === 'wind') {
    m.facing = Math.sign(dx) || m.facing;
    if (s.t >= P.wind) { s.ph = 'strike'; s.t = 0; sfx(P.snd); if (m.type === 'ogre') shake(3); }
  } else if (s.ph === 'strike') {
    if (dist > m.r + 4) { m.x += dx / dist * P.lunge * sc * dt; m.y += dy / dist * P.lunge * sc * dt; }          // it throws itself at you, but never through you
    if (!s.hit && s.t >= P.hit * 0.45) {
      s.hit = true;
      const tx = hero.x - m.x, ty = hero.y - m.y;
      if (!hero.dead && Math.hypot(tx, ty) < reach + 10) {
        damageHero(m.dmg * P.mul * fz, true, m);
        burst(hero.x, hero.y - 35, '#fff', 6, 140, 2, 100, true);
      } else if (m.type === 'ogre') { burst(m.x + m.facing * 30, m.y, '#a98', 10, 120, 3, 100); }
    }
    if (s.t >= P.hit) { s.ph = 'rec'; s.t = 0; }
  } else if (s.t >= P.rec) { m.mel = null; m.melCd = P.cd * (0.8 + Math.random() * 0.4); }
  return true;
}

// it was hit: it recoils, and a blow in the middle of a wind-up knocks the swing out of it (elites and ogres are too stubborn)
function mobHurt(m) {
  m.recoilT = 0.3;
  if (m.mel && m.mel.ph === 'wind' && !m.elite && m.type !== 'ogre' && m.type !== 'boss') { m.mel = null; m.melCd = 0.6; }
}

// does touching it hurt? Only while it is charging or pouncing; everything else has to attack
function touchHurts(m) {
  if (m.type === 'boss') return true;
  if (m.type === 'slime' || m.type === 'magmaslime') return m.state === 'hop' || (m.land || 0) > 0;
  if (MELEE[m.type]) return m.state === 'charge';
  return true;
}

// ground markers and the death of a creature, called from drawEnemy
function drawMobWindup(m) {
  if (LUNGE[m.type] && m.state === 'windup') {                              // the line it is about to spring along
    const L = LUNGE[m.type], p = 1 - m.stateT / L.wind;
    ctx.save(); ctx.strokeStyle = `rgba(255,90,60,${0.2 + 0.5 * p})`; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.setLineDash([10, 9]);
    line(m.x, m.y, m.x + m.chargeDx * L.speed * L.dur, m.y + m.chargeDy * L.speed * L.dur); ctx.restore();
  }
  const s = m.mel; if (!s || s.ph !== 'wind') return;
  const P = MELEE[m.type], p = s.t / P.wind, R = (m.r + 12 + P.extra * (m.scale || 1));
  ctx.save();
  ctx.fillStyle = `rgba(255,70,50,${0.08 + 0.16 * p})`; ctx.strokeStyle = `rgba(255,110,80,${0.25 + 0.4 * p})`; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.ellipse(m.x, m.y, R, R / 1.7, 0, m.facing > 0 ? -1.1 : Math.PI - 1.1, m.facing > 0 ? 1.1 : Math.PI + 1.1); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- boss signature attacks
const heroAng = m => Math.atan2(hero.y - m.y, hero.x - m.x);
const inCone = (m, a, R, half) => {                                     // is the hero inside a cone from the boss (the ground is squashed, so measure it that way)
  const hx = hero.x - m.x, hy = (hero.y - m.y) / 0.62, d = Math.hypot(hx, hy);
  if (d > R || d < 1) return d <= 1;
  let da = Math.atan2(hy, hx) - a; da = Math.atan2(Math.sin(da), Math.cos(da));
  return Math.abs(da) < half;
};
const orb = (m, a, sp, color, mul, y0 = 35) => projectiles.push({ x: m.x, y: m.y - y0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 3.6, dmg: Math.max(1, Math.round(m.dmg * mul)), orb: color });
const strikeAt = (m, x, y, delay, kind, mul = 0.95, r = 40) => { const p = clampWorld(x, y); hazards.push({ k: 'strike', x: p.x, y: p.y, delay, d0: delay, r, dmg: Math.round(m.dmg * mul), kind, boltT: 0 }); };
const STRIKE_FX = { rock: ['slam', '#c9b494'], arrow: ['arrow', '#aef5c0'], lava: ['lava', '#ff9a40'], spike: ['slam', '#ecd28e'], icicle: ['crackle', '#cfeaff'], lightning: ['thunder', '#fff6a0'] };
const strikeSfx = k => (STRIKE_FX[k] || STRIKE_FX.lightning)[0], strikeCol = k => (STRIKE_FX[k] || STRIKE_FX.lightning)[1];
const arcFx = (m, R, col, life = 0.28) => hazards.push({ k: 'arc', x: m.x, y: m.y, dir: m.facing, r: R, life, max: life, col });

// a ring of spikes closing in around the boss, wave after wave: the safe place is between the rings
const ringStrikes = (m, kind, rings, r0, gap, mul) => {
  for (let i = 0; i < rings; i++) {
    const R = r0 + i * gap, n = 8 + 4 * i, a0 = Math.random() * 6.28;
    for (let j = 0; j < n; j++) { const a = a0 + j / n * Math.PI * 2; strikeAt(m, m.x + Math.cos(a) * R, m.y + Math.sin(a) * R * 0.62, 0.8 + i * 0.32, kind, mul, 34); }
  }
  sfx('crackle');
};

// attacks that keep going for a while: tick(m, dt) every frame until chan seconds are up
function chanStart(m, id) { m.state = 'chan'; m.chanAtk = id; m.chanT = ATK[id].chan; m.acc = 0; m.beamA = heroAng(m); m.spiralA = Math.random() * 6.28; m.tickT = 0; }
const spiral = (id, color, speed, rate, step, arms, mul, snd) => ({
  wind: 0.85, chan: 1.6,
  fire(m) { chanStart(m, id); sfx(snd); },
  tick(m, dt) {
    m.acc += dt;
    while (m.acc >= rate) { m.acc -= rate; for (let k = 0; k < arms; k++) orb(m, m.spiralA + k * Math.PI * 2 / arms, speed, color, mul); m.spiralA += step * (m.phase2 ? 1.25 : 1); if (Math.random() < 0.3) sfx('crackle'); }
    if (gfx.particles && Math.random() < 0.5) burst(m.x, m.y - 50, color, 1, 90, 2.5, 0, true);
  },
});

Object.assign(ATK, {
  // --- Minotaur King
  sweep:    { wind: 0.75, fire(m) {                                     // a sweep of the horns in front of him
    const R = m.phase2 ? 230 : 195; arcFx(m, R, '#ffdca0'); sfx('whoosh'); shake(7); m.x += m.facing * 40;
    if (!hero.dead && inCone(m, m.facing > 0 ? 0 : Math.PI, R, 1.15)) damageHero(Math.round(m.dmg * 1.15), true, m);
  } },
  rockfall: { wind: 1.0, fire(m) {                                      // he roars and the roof of the sky comes down
    const n = m.phase2 ? 9 : 6;
    for (let i = 0; i < n; i++) strikeAt(m, i === 0 ? hero.x : hero.x + (Math.random() - 0.5) * 340, i === 0 ? hero.y : hero.y + (Math.random() - 0.5) * 200, 0.9 + i * 0.13, 'rock', 0.9, 42);
    sfx('roar'); shake(8);
  } },
  // --- Goblin King
  knifeFan: { wind: 0.6, fire(m) {                                      // throws a fan of daggers
    const n = m.phase2 ? 11 : 7, a0 = Math.atan2(hero.y - 35 - (m.y - 50), hero.x - m.x);
    for (let i = 0; i < n; i++) { const a = a0 + (i - (n - 1) / 2) * 0.15; projectiles.push({ x: m.x, y: m.y - 50, vx: Math.cos(a) * 340, vy: Math.sin(a) * 340, t: 3, dmg: Math.round(m.dmg * 0.55), knife: true }); }
    sfx('arrow'); sfx('swing');
  } },
  dashStab: { wind: 0.45, fire(m) { m.state = 'dash'; m.dashT = 0.26; m.hitDone = false; sfx('charge'); } },
  // --- Slime Queen
  bounce:   { wind: 0.75, fire(m) {                                     // squats, then drops on the spot where you stood
    m.state = 'leap'; m.leapT = 0; m.leapDur = 0.85; m.fx = m.x; m.fy = m.y; m.tx = hero.x; m.ty = hero.y; sfx('squish'); sfx('whoosh');
  } },
  ooze:     { wind: 0.8, fire(m) {                                       // a ring of acid pools wells up around her, and the pools spit out slimes
    const n = m.phase2 ? 8 : 6;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, p = clampWorld(m.x + Math.cos(a) * 125, m.y + Math.sin(a) * 78); hazards.push({ k: 'pool', x: p.x, y: p.y, r: 50, life: 6, max: 6, tick: 0, dmg: Math.max(2, Math.round(m.dmg * 0.35)), kind: 'acid', born: 0 }); }
    for (let i = 0; i < 2 && enemies.length < 14; i++) spawnEnemy('slime', clampWorld(m.x + (i ? 1 : -1) * 70, m.y + 20), { spawnT: 0.4, noVariant: true });
    sfx('splash'); shake(5);
  } },
  // --- Lich Archer
  arrowRain: { wind: 0.8, fire(m) {                                     // arrows fall out of the dark where you stand and around you
    const n = m.phase2 ? 12 : 8;
    for (let i = 0; i < n; i++) strikeAt(m, i < 2 ? hero.x + (i ? 40 : 0) : hero.x + (Math.random() - 0.5) * 300, i < 2 ? hero.y : hero.y + (Math.random() - 0.5) * 180, 0.8 + i * 0.1, 'arrow', 0.7, 34);
    sfx('arrow');
  } },
  ring:     { wind: 0.65, fire(m) {                                     // a ring of souls with a gap in it
    const n = m.phase2 ? 20 : 15, gap = Math.floor(Math.random() * n), a0 = heroAng(m) - Math.PI;
    for (let i = 0; i < n; i++) { if (i === gap || i === (gap + 1) % n) continue; orb(m, a0 + i / n * Math.PI * 2, 190, '#9dffb8', 0.55); }
    sfx('chill'); burst(m.x, m.y - 40, '#9dffb8', 18, 180, 3, 0, true);
  } },
  // --- Frost Titan
  breath:   { wind: 0.8, chan: 1.4, fire(m) { chanStart(m, 'breath'); sfx('chill'); },
    tick(m, dt) {                                                       // a cone of killing cold that slowly follows you
      let da = heroAng(m) - m.beamA; da = Math.atan2(Math.sin(da), Math.cos(da)); m.beamA += Math.max(-1.1 * dt, Math.min(1.1 * dt, da));
      m.facing = Math.cos(m.beamA) >= 0 ? 1 : -1;
      m.tickT -= dt;
      if (m.tickT <= 0 && !hero.dead && inCone(m, m.beamA, 300, 0.42)) { m.tickT = 0.32; damageHero(Math.max(1, Math.round(m.dmg * 0.32)), false, m); hero.chillT = 2.5; }
      if (gfx.particles) for (let i = 0; i < 3; i++) { const a = m.beamA + (Math.random() - 0.5) * 0.7, s = 220 + Math.random() * 160; particles.push({ x: m.x + Math.cos(a) * 30, y: m.y - 60 + Math.sin(a) * 18, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.62, life: 0.5, max: 0.5, size: 3, color: 'rgba(200,238,255,0.8)', add: true }); }
      if (Math.random() < dt * 6) sfx('crackle');
    } },
  shatter:  { wind: 0.9, fire(m) { ringStrikes(m, 'icicle', 3, 80, 80, 0.8); shake(6); } },
  // --- Magma Colossus
  fissure:  { wind: 0.85, fire(m) {                                     // the ground splits and fire follows the crack to you
    const a = heroAng(m), n = m.phase2 ? 9 : 7;
    for (let i = 1; i <= n; i++) strikeAt(m, m.x + Math.cos(a) * i * 58, m.y + Math.sin(a) * i * 58 * 0.62, 0.45 + i * 0.1, 'lava', 0.9, 38);
    sfx('quake'); shake(8);
  } },
  overheat: spiral('overheat', '#ff8a30', 180, 0.1, 0.62, 2, 0.5, 'lava'),
  // --- Sand Pharaoh
  spikeRing: { wind: 0.9, fire(m) { ringStrikes(m, 'spike', 3, 80, 80, 0.8); shake(6); } },
  sandWall: { wind: 0.85, fire(m) {                                     // a wall of sand with a doorway in it
    const a = heroAng(m), n = 13, gap = 1 + Math.floor(Math.random() * (n - 3)), px = -Math.sin(a), py = Math.cos(a);
    for (let i = 0; i < n; i++) { if (i === gap || i === gap + 1) continue; const o = (i - (n - 1) / 2) * 36; projectiles.push({ x: m.x + px * o, y: m.y - 35 + py * o * 0.62, vx: Math.cos(a) * 165, vy: Math.sin(a) * 165, t: 4.2, dmg: Math.round(m.dmg * 0.55), orb: '#e8cf8a' }); }
    sfx('whoosh'); shake(5);
  } },
  // --- Storm Warden
  chain:    { wind: 0.7, fire(m) {                                      // a bolt that walks across the ground after you
    let x = hero.x, y = hero.y, a = Math.random() * 6.28;
    for (let i = 0; i < (m.phase2 ? 8 : 6); i++) { strikeAt(m, x, y, 0.5 + i * 0.2, 'lightning', 0.9, 40); a += (Math.random() - 0.5) * 1.2; x += Math.cos(a) * 52; y += Math.sin(a) * 34; }
    sfx('crackle');
  } },
  tempest:  spiral('tempest', '#fff3a0', 215, 0.085, 0.7, 3, 0.45, 'thunder'),
});

// how much each boss feels like using an attack, given how far away you are (added to the weights in bosses.js)
function atkWeight(k, dist) {
  switch (k) {
    case 'sweep': return dist < 210 ? 3 : 0.15;
    case 'breath': return dist < 330 ? 1.6 : 0.7;
    case 'dashStab': return dist > 150 ? 2 : 0.4;
    case 'bounce': return dist > 190 ? 2 : 0.8;
    case 'knifeFan': return dist > 110 ? 1 : 0.3;
    case 'ring': return dist < 330 ? 1.3 : 0.7;
    case 'shatter': case 'spikeRing': return dist < 260 ? 1.4 : 0.5;
    default: return 1;
  }
}

// the extra boss states (leap, dash, channel); true if it handled this frame
function kitStates(m, dt, dx, dy, dist) {
  if (m.state === 'chan') {
    m.chanT -= dt; ATK[m.chanAtk].tick(m, dt);
    if (m.chanT <= 0) { m.state = 'walk'; m.stateT = 1.4 + Math.random() * 0.8; m.fireT = FIRE_T - FIRE_RISE; }
    return true;
  }
  if (m.state === 'leap') {
    m.leapT += dt; const p = Math.min(1, m.leapT / m.leapDur);
    m.x = m.fx + (m.tx - m.fx) * p; m.y = m.fy + (m.ty - m.fy) * p; m.hopZ = Math.sin(p * Math.PI) * 34; m.facing = Math.sign(m.tx - m.fx) || m.facing;
    if (p >= 1) {
      m.hopZ = 0; m.state = 'walk'; m.stateT = 1.4 + Math.random(); m.fireT = FIRE_T - FIRE_RISE;
      shockwaves.push({ x: m.x, y: m.y, r: 10, maxR: m.phase2 ? 280 : 220, hit: false, dmg: m.dmg, color: m.def.color });
      hazards.push({ k: 'pool', x: m.x, y: m.y, r: 56, life: 6, max: 6, tick: 0, dmg: Math.max(2, Math.round(m.dmg * 0.35)), kind: 'acid', born: 0 });
      sfx('slam'); shake(13); burst(m.x, m.y, '#8fe08f', 26, 240, 4, 100);
    }
    return true;
  }
  if (m.state === 'dash') {
    m.dashT -= dt; m.x += m.chargeDx * 700 * dt; m.y += m.chargeDy * 700 * dt; m.walkT += dt * 20;
    if (gfx.particles && Math.random() < 0.6) burst(m.x, m.y, '#cfe', 1, 40, 3, -10);
    if (m.dashT <= 0) {
      m.state = 'walk'; m.stateT = 1.0 + Math.random() * 0.6; m.fireT = FIRE_T - FIRE_RISE; arcFx(m, 120, '#9be36f'); sfx('slash');
      if (!hero.dead && Math.hypot(hero.x - m.x, (hero.y - m.y) * 1.5) < 125) damageHero(Math.round(m.dmg * 1.1), true, m);
    }
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- drawing the new things
function drawMoreTelegraph(m, p, c) {
  const atk = m.state === 'atk' ? m.atk : m.state === 'chan' ? m.chanAtk : null;
  if (!atk) return;
  const wedge = (a, R, half, alpha) => {
    ctx.fillStyle = withAlpha(c, 0.05 + 0.1 * alpha); ctx.strokeStyle = withAlpha(c, 0.25 + 0.45 * alpha);
    ctx.beginPath(); ctx.moveTo(m.x, m.y);
    for (let i = 0; i <= 14; i++) { const q = a - half + (half * 2) * i / 14; ctx.lineTo(m.x + Math.cos(q) * R, m.y + Math.sin(q) * R * 0.62); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  };
  if (atk === 'sweep') wedge(m.facing > 0 ? 0 : Math.PI, m.phase2 ? 230 : 195, 1.15, p);
  else if (atk === 'breath') wedge(m.state === 'chan' ? m.beamA : heroAng(m), 300, 0.42, m.state === 'chan' ? 1 : p);
  else if (atk === 'bounce') {
    ctx.strokeStyle = withAlpha(c, 0.3 + 0.5 * p); ctx.fillStyle = withAlpha(c, 0.05 + 0.12 * p);
    ctx.beginPath(); ctx.ellipse(m.state === 'leap' ? m.tx : hero.x, m.state === 'leap' ? m.ty : hero.y, 70, 70 / 1.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (atk === 'dashStab') { ctx.strokeStyle = `rgba(255,90,90,${0.3 + 0.5 * p})`; ctx.setLineDash([8, 6]); line(m.x, m.y, m.x + m.chargeDx * 182, m.y + m.chargeDy * 182); ctx.setLineDash([]); }
  else if (atk === 'knifeFan') { ctx.strokeStyle = `rgba(255,255,255,${0.15 + 0.4 * p})`; const a0 = heroAng(m); for (const o of [-3, 0, 3]) line(m.x, m.y - 50, m.x + Math.cos(a0 + o * 0.15) * 300, m.y - 50 + Math.sin(a0 + o * 0.15) * 300 * 0.62); }
  else if (atk === 'ring' || atk === 'overheat' || atk === 'tempest') { ctx.strokeStyle = withAlpha(c, 0.2 + 0.5 * p); ctx.beginPath(); ctx.ellipse(m.x, m.y, 40 + 70 * p, (40 + 70 * p) / 1.7, 0, 0, Math.PI * 2); ctx.stroke(); }
}

// an aura that gathers around a boss as it winds up, and a flash as it lets go
function drawBossAura(m, sp) {
  if (!gfx.glow || (sp > -0.05 && !(m.fireT > 0))) return;
  const a = sp < 0 ? -sp : (m.fireT || 0) / FIRE_T * 0.6, col = m.def ? m.def.color : '#f88', cy = m.y - 55, R = 36 + 64 * a;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(m.x, cy, 4, m.x, cy, R); g.addColorStop(0, withAlpha(col, 0.35 * a)); g.addColorStop(1, withAlpha(col, 0));
  ctx.fillStyle = g; ctx.fillRect(m.x - R, cy - R, R * 2, R * 2); ctx.restore();
}

function drawArcHazard(h) {
  const a = Math.max(0, h.life / h.max), R = h.r * (1.25 - 0.25 * a), c = h.col || '#fff';
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  const a0 = h.dir > 0 ? -1.15 : Math.PI - 1.15, a1 = h.dir > 0 ? 1.15 : Math.PI + 1.15;
  ctx.strokeStyle = withAlpha(c, 0.7 * a); ctx.lineWidth = 14 * a + 2;
  ctx.beginPath(); ctx.ellipse(h.x, h.y - 28, R, R / 1.6, 0, a0, a1); ctx.stroke();
  ctx.strokeStyle = withAlpha('#ffffff', 0.5 * a); ctx.lineWidth = 4 * a + 1; ctx.stroke();
  ctx.restore();
}

// the four ground strikes that are not lightning or ice: falling rock, rained arrows, rising lava, sand spikes
function drawStrikeX(h) {
  const k = h.kind, col = { rock: [200, 170, 120], arrow: [120, 240, 160], lava: [255, 130, 40], spike: [235, 205, 130] }[k] || [255, 255, 255];
  if (h.delay > 0) {
    const p = 1 - h.delay / h.d0;
    ctx.strokeStyle = `rgba(${col},${0.4 + 0.5 * p})`; ctx.fillStyle = `rgba(${col},${0.05 + 0.15 * p})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r / 1.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r * (1 - p), h.r * (1 - p) / 1.5, 0, 0, Math.PI * 2); ctx.stroke();
    if (k === 'rock') {                                                  // the boulder drops in from above
      const fall = h.delay / h.d0, by = h.y - 8 - 300 * fall * fall;
      ctx.fillStyle = '#7d7468'; ctx.strokeStyle = '#3a342c'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(h.x, by, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(h.x - 4, by - 4, 5, 0, Math.PI * 2); ctx.fill();
    } else if (k === 'arrow' && h.delay < 0.32) {
      const q = h.delay / 0.32, ty = h.y - 4 - 230 * q;
      ctx.strokeStyle = '#e8f6e8'; ctx.lineWidth = 2; line(h.x, ty - 22, h.x, ty); ctx.fillStyle = '#9dffb8'; ctx.beginPath(); ctx.moveTo(h.x - 3, ty); ctx.lineTo(h.x + 3, ty); ctx.lineTo(h.x, ty + 7); ctx.fill();
    }
    return;
  }
  const a = Math.max(0, h.boltT / 0.28), e = 1 - a;
  ctx.save();
  if (k === 'rock') {
    ctx.strokeStyle = `rgba(200,180,150,${0.7 * a})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r * (0.6 + e * 0.8), h.r * (0.6 + e * 0.8) / 1.5, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = `rgba(110,100,88,${a})`; for (let i = 0; i < 5; i++) { const an = i * 1.26 + h.x, d = 8 + e * 26; ctx.beginPath(); ctx.arc(h.x + Math.cos(an) * d, h.y - 4 - Math.sin(e * Math.PI) * 18 + Math.sin(an) * d * 0.4, 3.2, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = `rgba(90,82,72,${a})`; ctx.beginPath(); ctx.ellipse(h.x, h.y - 4, 12, 7, 0, 0, Math.PI * 2); ctx.fill();
  } else if (k === 'arrow') {
    ctx.strokeStyle = `rgba(232,246,232,${a})`; ctx.lineWidth = 2; line(h.x, h.y + 3, h.x + 2, h.y - 24); line(h.x + 2, h.y - 24, h.x - 2, h.y - 29); line(h.x + 2, h.y - 24, h.x + 5, h.y - 29);
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(120,240,160,${0.4 * a})`; ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r * (0.4 + e * 0.6), h.r * (0.4 + e * 0.6) / 1.5, 0, 0, Math.PI * 2); ctx.stroke();
  } else if (k === 'lava') {
    ctx.globalCompositeOperation = 'lighter';
    const hgt = 110 * Math.sin(Math.min(1, e * 2.2) * Math.PI * 0.5) * (a > 0.5 ? 1 : a * 2), g = ctx.createLinearGradient(0, h.y - hgt, 0, h.y);
    g.addColorStop(0, 'rgba(255,230,120,0)'); g.addColorStop(0.5, `rgba(255,140,40,${0.8 * a})`); g.addColorStop(1, `rgba(255,70,20,${0.9 * a})`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(h.x - h.r * 0.7, h.y); ctx.quadraticCurveTo(h.x - 8, h.y - hgt * 0.6, h.x + Math.sin(tAnim * 30 + h.x) * 6, h.y - hgt); ctx.quadraticCurveTo(h.x + 8, h.y - hgt * 0.6, h.x + h.r * 0.7, h.y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = `rgba(255,120,30,${0.35 * a})`; ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r / 1.5, 0, 0, Math.PI * 2); ctx.fill();
  } else if (k === 'spike') {
    const hgt = 54 * Math.min(1, e * 3) * (a > 0.4 ? 1 : a / 0.4);
    ctx.fillStyle = `rgba(226,196,120,${a > 0.4 ? 1 : a / 0.4})`; ctx.strokeStyle = '#7a5a1a'; ctx.lineWidth = 1.2;
    for (const o of [-9, 0, 9]) { const hh = hgt * (o === 0 ? 1 : 0.7); ctx.beginPath(); ctx.moveTo(h.x + o - 6, h.y); ctx.lineTo(h.x + o, h.y - hh); ctx.lineTo(h.x + o + 6, h.y); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  }
  ctx.restore();
}

// projectiles that are not plain arrows: daggers and glowing orbs
function drawShot(p) {
  if (p.knife) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(tAnim * 22 + p.x * 0.05);
    ctx.fillStyle = '#d8dde4'; ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(-9, -2.5); ctx.lineTo(10, 0); ctx.lineTo(-9, 2.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#6b3e26'; ctx.fillRect(-10, -1.5, 5, 3); ctx.restore();
  } else if (p.orb) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 13); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, p.orb); g.addColorStop(1, withAlpha(p.orb, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
}

// ---------------------------------------------------------------- creatures of the biomes
// Every creature belongs to the places it would really live: BIOME_MOBS says which ones turn up in which biome (a slime never wanders into the Molten Caldera),
// and each biome has one creature that is found nowhere else. A wave only draws from its biome's own list.
const BIOME_MOBS = {
  forest:    ['goblin', 'archer', 'wolf'],
  desert:    ['minotaur', 'archer', 'scorpion'],
  snow:      ['ogre', 'goblin', 'icesprite'],
  volcano:   ['minotaur', 'ogre', 'fireimp'],
  swamp:     ['slime', 'goblin', 'bogLurker'],
  jungle:    ['slime', 'archer', 'panther'],
  ruins:     ['goblin', 'ogre', 'skeleton'],
  highlands: ['ogre', 'minotaur', 'harpy'],
};
const currentBiomeKey = () => BIOMES[zone % BIOMES.length].key;
const mobsOfBiome = key => BIOME_MOBS[key] || BIOME_MOBS.forest;
const biomesOfMob = t => Object.keys(BIOME_MOBS).filter(b => BIOME_MOBS[b].includes(t));
function wavePool() {                                                    // what can turn up right now: this biome's creatures that are old enough for this wave
  const pool = mobsOfBiome(currentBiomeKey()).filter(t => TYPES[t] && wave >= TYPES[t].from);
  return pool.length ? pool : [mobsOfBiome(currentBiomeKey())[0]];
}
const NEW_MOBS = ['wolf', 'scorpion', 'icesprite', 'fireimp', 'bogLurker', 'panther', 'skeleton', 'harpy'];
const isNewMob = m => NEW_MOBS.includes(m.type);
// lungers: circle you at `ring`, crouch for `wind`, then spring `speed` px/s for `dur` seconds; pause `cd`
const LUNGE = {
  wolf:    { ring: 150, range: 230, wind: 0.32, speed: 430, dur: 0.38, cd: 1.5, hop: 5 },
  panther: { ring: 250, range: 340, wind: 0.6,  speed: 480, dur: 0.42, cd: 2.4, hop: 7 },
  harpy:   { ring: 190, range: 290, wind: 0.55, speed: 270, dur: 0.5, cd: 3.0, hop: 0 },
};
const FLYERS = { icesprite: { z: 34, want: 215, shot: '#9fe4ff', ail: 'chill', snd: 'chill' }, fireimp: { z: 30, want: 200, shot: '#ff7a2a', ail: 'burn', snd: 'lava' }, harpy: { z: 46 } };

function newMobAI(m, dt, dx, dy, dist, spd, slowMul, own) {
  if (!own && NEW_MOBS2.includes(m.type)) return newMobAI2(m, dt, dx, dy, dist, spd, slowMul);
  const face = Math.sign(dx) || m.facing, ux = dx / dist, uy = dy / dist, t = m.type;
  const step = (vx, vy, s) => { m.x += vx * s * dt; m.y += vy * s * dt; m.x = Math.max(15, Math.min(WW - 15, m.x)); m.y = Math.max(50, Math.min(WH - 10, m.y)); };
  if (LUNGE[t]) {                                                           // wolf, panther, harpy
    const L = LUNGE[t], fly = FLYERS[t];
    if (fly) m.hopZ = (m.state === 'charge' ? 10 + (fly.z - 10) * (m.stateT / L.dur) : fly.z) + Math.sin(tAnim * 5 + m.x) * 3;
    if (m.state === 'walk') {
      m.facing = face; m.moving = true;
      m.circ = m.circ || (Math.random() < 0.5 ? 1 : -1);
      const rad = Math.max(-1, Math.min(1, (dist - L.ring) / 80)), tx = -uy * m.circ, ty = ux * m.circ;
      const vx = ux * rad + tx * 0.9, vy = uy * rad + ty * 0.9, vl = Math.hypot(vx, vy) || 1;
      step(vx / vl, vy / vl, spd);
      m.walkT += dt * stepRate(spd, 9);
      if (m.stateT <= 0 && dist < L.range && !hero.dead) { m.state = 'windup'; m.stateT = L.wind; m.chargeDx = ux; m.chargeDy = uy; sfx(t === 'harpy' ? 'whoosh' : 'charge'); }
    } else if (m.state === 'windup') {
      m.facing = face; m.moving = false; m.chargeDx = ux; m.chargeDy = uy;
      if (m.stateT <= 0) { m.state = 'charge'; m.stateT = L.dur; }
    } else if (m.state === 'charge') {
      step(m.chargeDx, m.chargeDy, L.speed * slowMul); m.walkT += dt * 18; m.moving = true;
      if (!fly) m.hopZ = Math.sin(Math.max(0, m.stateT / L.dur) * Math.PI) * L.hop;
      if (m.stateT <= 0) { m.state = 'walk'; m.stateT = L.cd * (0.8 + Math.random() * 0.5); m.circ = -m.circ; m.hopZ = fly ? fly.z : 0; }
    }
  } else if (t === 'icesprite' || t === 'fireimp') {                       // hovers at a distance and throws what it is made of
    const F = FLYERS[t];
    m.hopZ = F.z + Math.sin(tAnim * 4 + m.x) * 4; m.facing = face;
    const dir = dist > F.want + 30 ? 1 : dist < F.want - 40 ? -1 : 0;
    step(ux, uy, spd * dir * 0.9); m.moving = !!dir; m.walkT += dt * 6;
    m.x += Math.sin(tAnim * 1.7 + m.y) * 12 * dt;
    const onScreen = m.x > cam.x && m.x < cam.x + VW && m.y > cam.y && m.y < cam.y + VH + 40;
    if (m.state === 'walk' && m.stateT <= 0 && !hero.dead && onScreen) { m.state = 'aim'; m.stateT = 0.65; m.aimDx = ux; }
    if (m.state === 'aim') {
      if (m.stateT <= 0) {
        const a = Math.atan2(hero.y - 20 - (m.y - m.hopZ), hero.x - m.x), sp = 250;
        projectiles.push({ x: m.x, y: m.y - m.hopZ - 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 3, dmg: Math.max(1, Math.round(m.dmg * 0.9)), orb: F.shot, src: m, ail: F.ail });
        sfx(F.snd); m.state = 'walk'; m.stateT = 1.7 + Math.random() * 1.2;
      }
    }
  } else if (t === 'scorpion') {
    m.facing = face;
    if (m.state === 'walk') {
      step(ux, uy, spd); m.moving = true; m.walkT += dt * stepRate(spd, 9);
      if (m.stateT <= 0 && dist > 110 && dist < 330 && !hero.dead) { m.state = 'dig'; m.stateT = 0.7; m.digT = 0.7; m.fx0 = m.x; m.fy0 = m.y; m.tx = hero.x; m.ty = hero.y; m.untouchable = true; m.moving = false; sfx('crackle'); burst(m.x, m.y, '#c9a066', 10, 80, 3, 80); }
    } else if (m.state === 'dig') {                                         // underground, racing to where you stood
      const p = 1 - Math.max(0, m.stateT) / m.digT; m.x = m.fx0 + (m.tx - m.fx0) * p; m.y = m.fy0 + (m.ty - m.fy0) * p;
      if (gfx.particles && Math.random() < dt * 30) particles.push({ x: m.x + (Math.random() - 0.5) * 12, y: m.y - 2, vx: (Math.random() - 0.5) * 30, vy: -25, life: 0.4, max: 0.4, size: 2.5, color: '#c9a066' });
      if (m.stateT <= 0) { m.state = 'surface'; m.stateT = 0.5; }
    } else if (m.state === 'surface') {                                     // the ground bulges where it will strike: step out of the ring
      if (m.stateT <= 0) {
        m.untouchable = false; m.state = 'walk'; m.stateT = 2.4 + Math.random() * 1.4; m.fireT = FIRE_T;
        burst(m.x, m.y, '#c9a066', 16, 160, 3, 100, true); shake(4); sfx('slam');
        if (!hero.dead && Math.hypot(hero.x - m.x, (hero.y - m.y) * 1.5) < 62) damageHero(Math.round(m.dmg * 1.3), true, m);
      }
    }
  } else if (t === 'bogLurker') {
    m.facing = face;
    if (m.state === 'hidden') {                                             // under the water, creeping up on you
      m.untouchable = true; m.moving = false; step(ux, uy, spd * 0.75);
      if (gfx.particles && Math.random() < dt * 4) particles.push({ x: m.x, y: m.y - 1, vx: 0, vy: -6, life: 0.7, max: 0.7, size: 2, color: 'rgba(160,200,170,0.5)' });
      if (m.stateT <= 0 && dist < 150 && !hero.dead) { m.state = 'rise'; m.stateT = 0.55; sfx('splash'); }
    } else if (m.state === 'rise') {
      m.untouchable = true;
      if (m.stateT <= 0) { m.untouchable = false; m.state = 'walk'; m.stateT = 0.5; m.hits = 0; burst(m.x, m.y, '#8fbf9a', 12, 120, 3, 100); sfx('splash'); }
    } else if (m.state === 'walk') {
      step(ux, uy, spd); m.moving = true; m.walkT += dt * stepRate(spd, 9);
      if (dist > 340) m.farT = (m.farT || 0) + dt; else m.farT = 0;
      if (m.farT > 2 || (m.hits | 0) >= 3) { m.state = 'hidden'; m.stateT = 2; m.farT = 0; sfx('splash'); }       // it sinks back down when you run, or after a few blows
    }
  } else if (t === 'skeleton') {
    m.facing = face;
    if (m.state === 'bones') { m.moving = false; m.untouchable = false; if (m.stateT <= 0) { m.state = 'walk'; m.stateT = 0.5; m.riseT = 0.4; sfx('crackle'); } }
    else { step(ux, uy, spd); m.moving = true; m.walkT += dt * stepRate(spd, 8.5); if (m.riseT > 0) m.riseT -= dt; }
  }
}
// when a skeleton would die it falls apart instead, and rebuilds itself once unless it is hit while it lies there
function rebuildSkeletons() {
  for (const m of enemies) if (m.type === 'skeleton' && m.hp <= 0 && !m.rebuilt && m.dieT === undefined) {
    m.rebuilt = true; m.hp = Math.max(1, Math.round(m.maxHp * 0.5)); m.state = 'bones'; m.stateT = 1.8; m.mel = null; m.wfx = null; m.slowT = 0; m.burnT = 0;
    popups.push({ text: 'Falls apart...', x: m.x, y: m.y - 70, t: 0.9, color: '#e8e4d0', small: true }); sfx('crackle'); burst(m.x, m.y - 20, '#e8e4d0', 10, 120, 2.5, 200);
  }
}

// ---- drawing
function drawQuad(m, o) {                                                 // wolf and panther
  const { x, y, facing: f } = m, s = o.s, sp = swingPos(m), charge = m.state === 'charge', wind = m.state === 'windup' || sp < -0.3, ph = m.walkT, c = statusTint(m, o.c);
  drawShadow(x, y, 15 * s);
  const crouch = wind ? 5 * s : 0, st = charge ? 9 * s : 0, bob = m.moving && !charge ? Math.abs(Math.sin(ph)) * 1.8 : 0, hop = m.hopZ || 0, by = y - 17 * s + crouch - bob - hop;
  ctx.strokeStyle = c; ctx.lineWidth = 3 * (s > 1 ? 1 : 0.95); ctx.lineCap = 'round';
  const leg = (hx, ph2, front) => {
    if (charge) { const fx = hx + f * (front ? 12 : -12) * s, k = { x: (hx + fx) / 2, y: by + 9 * s - 2 }; poly({ x: hx, y: by + 3 }, k, { x: fx, y: y - 3 - hop * 0.4 }); return; }
    const ft = m.moving ? footAt(hx, y, f, ph2, 8 * s, 4 * s) : { x: hx + f * (front ? 4 : -3) * s, y };
    const k = ik(hx, by + 3, ft.x, ft.y, 9 * s, 9 * s, -f); poly({ x: hx, y: by + 3 }, k.j, k.e);
  };
  leg(x - f * 11 * s, ph + Math.PI, false); leg(x - f * 7 * s, ph, false); leg(x + f * 9 * s + st * 0.5 * f, ph, true); leg(x + f * 12 * s + st * 0.5 * f, ph + Math.PI, true);
  ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x + f * st * 0.3, by, 16 * s + st * 0.5, 7 * s, charge ? -f * 0.12 : 0, 0, Math.PI * 2); ctx.fill();
  if (o.stripes) { ctx.strokeStyle = o.stripes; ctx.lineWidth = 1.5; for (let i = -2; i <= 2; i++) line(x + f * (i * 5 * s + st * 0.3), by - 5 * s, x + f * (i * 5 * s + st * 0.3 - 2), by + 2 * s); ctx.strokeStyle = c; ctx.lineWidth = 3; }
  const tw = Math.sin(tAnim * (wind ? 14 : 5) + x) * 4 * s;                                         // the tail: flicks, and lashes while it crouches
  ctx.beginPath(); ctx.moveTo(x - f * 15 * s, by - 2); ctx.quadraticCurveTo(x - f * (22 + o.tail) * s, by - 7 * s + tw, x - f * (26 + o.tail) * s, by - (charge ? 1 : 10) * s + tw * 1.4); ctx.stroke();
  const hx = x + f * (19 * s + st), hy = by - 6 * s + (wind ? 4 * s : 0);
  ctx.fillStyle = c; ctx.beginPath(); ctx.arc(hx, hy, 6.5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(hx + f * 4 * s, hy - 1); ctx.lineTo(hx + f * 12 * s, hy + 2 * s); ctx.lineTo(hx + f * 4 * s, hy + 4 * s); ctx.fill();            // the snout
  ctx.beginPath(); ctx.moveTo(hx - f * 3 * s, hy - 4 * s); ctx.lineTo(hx - f * 5 * s, hy - 12 * s); ctx.lineTo(hx + f * 1.5 * s, hy - 5 * s); ctx.fill();                   // an ear
  ctx.fillStyle = wind || charge ? '#f33' : o.eye; ctx.beginPath(); ctx.arc(hx + f * 2.5 * s, hy - 2 * s, 1.5 * s, 0, Math.PI * 2); ctx.fill();
  if (wind || charge) { ctx.fillStyle = '#fff'; ctx.fillRect(hx + f * 5 * s, hy + 3 * s, f * 4 * s, 1.8); }                                                           // fangs
  drawHpBar(m, 44 * s + 6);
}
function drawScorpion(m) {
  const { x, y, facing: f } = m, ph = m.walkT, sp = swingPos(m), c = statusTint(m, '#c9923a');
  if (m.state === 'dig') {                                                // only a mound of sand racing across the ground
    const p = 1 - m.stateT / m.digT; ctx.fillStyle = 'rgba(190,150,90,0.8)'; ctx.beginPath(); ctx.ellipse(x, y, 14, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(150,110,60,0.5)'; ctx.lineWidth = 2; line(m.fx0, m.fy0, x, y);
    ctx.strokeStyle = `rgba(255,90,60,${0.3 + 0.5 * p})`; ctx.fillStyle = `rgba(255,70,50,${0.06 + 0.12 * p})`; ctx.beginPath(); ctx.ellipse(m.tx, m.ty, 62, 62 / 1.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    return;
  }
  const rise = m.state === 'surface' ? 1 - m.stateT / 0.5 : 1;
  if (m.state === 'surface') { ctx.strokeStyle = `rgba(255,90,60,0.8)`; ctx.fillStyle = 'rgba(255,70,50,0.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, 62, 62 / 1.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.save(); ctx.beginPath(); ctx.rect(x - 60, y - 70, 120, 72); ctx.clip();
  drawShadow(x, y, 17);
  ctx.translate(0, (1 - rise) * 16);
  ctx.strokeStyle = c; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) for (const side of [-1, 1]) { const lx = x + f * (i * 6 - 4), sw = Math.sin(ph * 2 + i + (side > 0 ? 0 : 1.6)) * (m.moving ? 3 : 0.6); poly({ x: lx, y: y - 7 }, { x: lx + side * 5 + sw, y: y - 10 }, { x: lx + side * 10 + sw, y: y - 1 }); }
  ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y - 9, 14, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8a5a20'; ctx.lineWidth = 1.2; for (let i = -1; i <= 1; i++) line(x + i * 5, y - 15, x + i * 5, y - 3);
  const claw = sp < 0 ? -sp * 7 : sp * -5;                                // the pincers open as it winds up and snap shut on the strike
  ctx.strokeStyle = c; ctx.lineWidth = 3; for (const sd of [-1, 1]) { const px = x + f * 17, py = y - 11 + sd * 4; poly({ x: x + f * 10, y: y - 9 + sd * 3 }, { x: px, y: py }, { x: px + f * 7, y: py + sd * claw * 0.6 - 2 }); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(px + f * 8, py + sd * claw * 0.6 - 2, 3.4, 0, Math.PI * 2); ctx.fill(); }
  const lift = Math.sin(tAnim * 3 + x) * 2 + (sp < 0 ? -sp * 8 : 0), tx = x - f * 14;                                       // the tail arches over the back
  ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(tx + f * 2, y - 11); ctx.quadraticCurveTo(tx - f * 12, y - 22 - lift, tx - f * 3, y - 31 - lift); ctx.quadraticCurveTo(tx + f * 6, y - 35 - lift, tx + f * 11, y - 28 - lift + (sp > 0 ? sp * 14 : 0)); ctx.stroke();
  ctx.fillStyle = '#7a3a1a'; ctx.beginPath(); ctx.moveTo(tx + f * 11, y - 28 - lift + (sp > 0 ? sp * 14 : 0)); ctx.lineTo(tx + f * 16, y - 23 - lift + (sp > 0 ? sp * 14 : 0)); ctx.lineTo(tx + f * 8, y - 24 - lift + (sp > 0 ? sp * 14 : 0)); ctx.fill();
  ctx.fillStyle = '#ff3'; ctx.beginPath(); ctx.arc(x + f * 11, y - 12, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  drawHpBar(m, 46);
}
function drawFlyer(m, kind) {                                              // ice sprite, fire imp, harpy
  const { x, facing: f } = m, z = m.hopZ || 0, y = m.y - z, fl = Math.sin(tAnim * (m.state === 'charge' ? 30 : 16) + x), sp = swingPos(m), aim = m.state === 'aim', wind = m.state === 'windup' || sp < -0.3;
  ctx.save(); ctx.globalAlpha *= 0.28; drawShadow(x, m.y, 9 * (1 - z / 120)); ctx.restore();
  ctx.lineCap = 'round';
  if (kind === 'icesprite') {
    const c = statusTint(m, '#9fe4ff');
    ctx.fillStyle = 'rgba(210,245,255,0.55)'; ctx.strokeStyle = '#cdeeff'; ctx.lineWidth = 1;
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + sd * 3, y - 14); ctx.quadraticCurveTo(x + sd * (16 + fl * 4), y - 26 - fl * 5, x + sd * 20, y - 10 + fl * 3); ctx.quadraticCurveTo(x + sd * 10, y - 12, x + sd * 3, y - 14); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = c; ctx.strokeStyle = '#3a8aaa'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, y - 30); ctx.lineTo(x + 8, y - 16); ctx.lineTo(x, y - 2); ctx.lineTo(x - 8, y - 16); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; line(x - 3, y - 22, x, y - 28); line(x, y - 28, x + 2, y - 20);
    ctx.fillStyle = '#18506a'; ctx.beginPath(); ctx.arc(x + f * 2.5, y - 17, 1.6, 0, Math.PI * 2); ctx.fill();
    if (aim) { const p = 1 - m.stateT / 0.65; ctx.fillStyle = `rgba(190,240,255,${0.4 + 0.5 * p})`; ctx.beginPath(); ctx.arc(x + f * 12, y - 18, 3 + p * 5, 0, Math.PI * 2); ctx.fill(); }
    drawHpBar(m, 54 + z);
  } else if (kind === 'fireimp') {
    const c = statusTint(m, '#ff6a2a');
    ctx.fillStyle = '#7a2a1a'; ctx.strokeStyle = '#3a1008'; ctx.lineWidth = 1.2;
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + sd * 2, y - 16); ctx.lineTo(x + sd * (20 + fl * 3), y - 28 - fl * 6); ctx.lineTo(x + sd * 14, y - 14); ctx.lineTo(x + sd * 8, y - 18 + fl * 2); ctx.lineTo(x + sd * 2, y - 10); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    const flick = 4 + Math.sin(tAnim * 14) * 2; ctx.fillStyle = '#ffb040'; ctx.beginPath(); ctx.moveTo(x - f * 4, y - 6); ctx.quadraticCurveTo(x - f * 10, y + 2, x - f * 8, y + 5 + flick); ctx.quadraticCurveTo(x - f * 3, y + 2, x - f * 4, y - 6); ctx.fill();   // flame tail
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y - 14, 8, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#7a2a10'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = '#4a1608'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + sd * 4, y - 20); ctx.lineTo(x + sd * 7, y - 28); ctx.lineTo(x + sd * 1.5, y - 22); ctx.fill(); }
    ctx.fillStyle = wind || aim ? '#fff' : '#ffe060'; ctx.beginPath(); ctx.arc(x + f * 3, y - 15, 1.8, 0, Math.PI * 2); ctx.fill();
    if (aim) { const p = 1 - m.stateT / 0.65; const g = ctx.createRadialGradient(x + f * 12, y - 16, 1, x + f * 12, y - 16, 4 + p * 7); g.addColorStop(0, '#fff6c0'); g.addColorStop(1, 'rgba(255,100,20,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + f * 12, y - 16, 4 + p * 7, 0, Math.PI * 2); ctx.fill(); }
    drawHpBar(m, 50 + z);
  } else {                                                                  // harpy
    const c = statusTint(m, '#c9a0e0'), dive = m.state === 'charge', tuck = dive ? 0.25 : 1, flap = dive ? 0 : fl;
    ctx.fillStyle = '#7a5a9a'; ctx.strokeStyle = '#3a2a4a'; ctx.lineWidth = 1.2;
    for (const sd of [-1, 1]) { const span = (30 + flap * 6) * tuck, lift = (flap * 12 + (wind ? -10 : 0)) * tuck; ctx.beginPath(); ctx.moveTo(x + sd * 3, y - 24); ctx.quadraticCurveTo(x + sd * span * 0.6, y - 40 - lift, x + sd * span, y - 22 - lift * 0.4); for (let i = 3; i >= 0; i--) ctx.lineTo(x + sd * span * (0.2 + i * 0.22), y - 14 + (i % 2) * 5 + flap * 2); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.strokeStyle = c; ctx.lineWidth = 3; line(x, y - 14, x + f * 2, y - 31);
    for (const sd of [-1, 1]) { poly({ x: x + sd * 2, y: y - 14 }, { x: x + sd * 3 + f * 2 * (dive ? 4 : 0), y: y - 7 }, { x: x + sd * 4 + f * (dive ? 12 : 1), y: y + (dive ? 3 : 0) }); }      // talons, thrust out in a dive
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + f * 3, y - 36, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8d070'; ctx.beginPath(); ctx.moveTo(x + f * 9, y - 36); ctx.lineTo(x + f * 16, y - 34); ctx.lineTo(x + f * 9, y - 32); ctx.fill();
    ctx.fillStyle = '#5a2a6a'; ctx.beginPath(); ctx.moveTo(x - f * 2, y - 41); ctx.quadraticCurveTo(x - f * 8, y - 50, x - f * 12, y - 40 + fl * 2); ctx.lineTo(x - f * 4, y - 38); ctx.fill();
    ctx.fillStyle = wind || dive ? '#f33' : '#fff'; ctx.beginPath(); ctx.arc(x + f * 5, y - 37, 1.6, 0, Math.PI * 2); ctx.fill();
    drawHpBar(m, 66 + z);
  }
}
function drawLurker(m) {
  const { x, y, facing: f } = m, ph = m.walkT, sp = swingPos(m);
  if (m.state === 'hidden') {                                              // only ripples and a pair of eyes show
    drawShadow(x, y, 8);
    for (let i = 0; i < 2; i++) { const r = ((tAnim * 0.8 + i * 0.5) % 1); ctx.strokeStyle = `rgba(190,230,200,${0.5 * (1 - r)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y, 8 + r * 16, (8 + r * 16) / 2, 0, 0, Math.PI * 2); ctx.stroke(); }
    const d = Math.hypot(hero.x - x, hero.y - y); if (d < 260) { ctx.fillStyle = '#ffe860'; ctx.beginPath(); ctx.arc(x - 4, y - 2, 1.6, 0, Math.PI * 2); ctx.arc(x + 4, y - 2, 1.6, 0, Math.PI * 2); ctx.fill(); }
    return;
  }
  const rise = m.state === 'rise' ? 1 - m.stateT / 0.55 : 1, c = statusTint(m, '#4a6a3a');
  if (m.state === 'rise') { ctx.strokeStyle = `rgba(255,90,60,${0.3 + 0.5 * rise})`; ctx.fillStyle = `rgba(255,70,50,${0.05 + 0.12 * rise})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y, 60, 60 / 1.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  drawShadow(x, y, 20);
  ctx.save(); ctx.beginPath(); ctx.rect(x - 70, y - 90, 140, 90 + 4); ctx.clip(); ctx.translate(0, (1 - rise) * 40);
  const lunge = sp > 0 ? sp * 12 : sp < 0 ? sp * 5 : 0, bob = m.moving ? Math.abs(Math.sin(ph)) * 2 : Math.sin(tAnim * 2 + x) * 1;
  ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y - 22 - bob, 19, 21, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6a8a50'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x - 8 + i * 5.5, y - 28 - (i % 2) * 5 - bob, 2.6, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = c; ctx.lineWidth = 5; ctx.lineCap = 'round';
  const armOut = f * (16 + lunge * 2), armUp = sp < 0 ? -sp * 18 : 0;
  poly({ x: x + f * 12, y: y - 26 - bob }, { x: x + armOut * 0.7, y: y - 14 - armUp }, { x: x + armOut + f * 8, y: y - 8 - armUp * 0.6 }); poly({ x: x - f * 12, y: y - 26 - bob }, { x: x - f * 16, y: y - 12 }, { x: x - f * 18, y: y - 2 });
  ctx.fillStyle = '#2a3a22'; ctx.beginPath(); ctx.ellipse(x + f * 8, y - 28 - bob, 10, 7 + (sp < 0 ? -sp * 5 : 0), 0, 0, Math.PI * 2); ctx.fill();                  // the wide mouth
  ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) ctx.fillRect(x + f * (3 + i * 3) - 1, y - 33 - bob, 1.6, 4);
  ctx.fillStyle = sp < -0.3 ? '#f33' : '#ffe860'; ctx.beginPath(); ctx.arc(x + f * 6, y - 38 - bob, 2.3, 0, Math.PI * 2); ctx.arc(x - f * 1, y - 39 - bob, 2.3, 0, Math.PI * 2); ctx.fill();
  if (gfx.particles && Math.random() < 0.12) particles.push({ x: x + (Math.random() - 0.5) * 24, y: y - 20, vx: 0, vy: 30, life: 0.6, max: 0.6, size: 2, color: '#9fd0a8' });
  ctx.restore();
  drawHpBar(m, 66);
}
function drawSkeleton(m) {
  const { x, y, facing: f } = m, ph = m.walkT, sp = swingPos(m), c = statusTint(m, '#e8e4d0'), striking = m.mel && m.mel.ph === 'strike';
  drawShadow(x, y, 11);
  ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineCap = 'round'; ctx.lineWidth = 2.6;
  if (m.state === 'bones') {                                               // a heap of bones that is slowly putting itself together
    const p = 1 - m.stateT / 1.8, tw = Math.sin(tAnim * 22) * (p > 0.5 ? 1.5 : 0);
    for (let i = 0; i < 6; i++) { const bx = x - 12 + i * 4.6, a = i * 1.9 + 0.4; line(bx - Math.cos(a) * 5 + tw, y - 2 - (i % 2), bx + Math.cos(a) * 5 + tw, y - 2 - (i % 2) - Math.sin(a) * 2); }
    ctx.beginPath(); ctx.arc(x + f * 4, y - 6 - p * 5, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#1a1a22'; ctx.fillRect(x + f * 4 - 3, y - 8 - p * 5, 2, 2); ctx.fillRect(x + f * 4 + 1, y - 8 - p * 5, 2, 2);
    drawHpBar(m, 22); return;
  }
  const crouch = sp < 0 ? -sp * 4 : 0, rise = m.riseT > 0 ? m.riseT / 0.4 * 8 : 0, bob = m.moving ? Math.abs(Math.sin(ph)) * 1.6 : 0, lean = f * (sp < 0 ? sp * 3 : sp * 6);
  drawLegs(x, y - 18 + crouch * 0.6 + rise, y, f, ph, !!m.moving, 9, 8);
  const hipY = y - 18 + crouch * 0.6 + rise, nx = x + lean * 0.4 + f * 2, ny = y - 36 - bob + crouch + rise;
  line(x, hipY, nx, ny);
  ctx.lineWidth = 1.6; for (let i = 0; i < 3; i++) line(x - 4 + lean * 0.2, hipY - 7 - i * 4, x + 4 + lean * 0.2, hipY - 7 - i * 4);                         // ribs
  ctx.lineWidth = 2.6;
  const rest = { x: x + f * 10, y: y - 25 + Math.sin(ph) * 3, tx: f * 8, ty: -9 }, back = { x: nx - f * 3, y: y - 49 + crouch + rise, tx: -f * 2, ty: -12 }, out = { x: nx + f * 20, y: y - 33 + crouch + rise, tx: f * 13, ty: 1 };
  const A = striking ? back : rest, B = sp < 0 ? back : out, tt = sp < 0 ? -sp : striking ? (sp + 1) / 2 : sp, mix = (a, b, t) => a + (b - a) * t;
  const hand = { x: mix(A.x, B.x, tt), y: mix(A.y, B.y, tt), tx: mix(A.tx, B.tx, tt), ty: mix(A.ty, B.ty, tt) };
  line(nx, ny + 2, hand.x, hand.y);
  ctx.strokeStyle = '#8a8a96'; ctx.lineWidth = 2.4; line(hand.x, hand.y, hand.x + hand.tx * 1.5, hand.y + hand.ty * 1.5);                                                // a rusty sword
  ctx.strokeStyle = c; ctx.lineWidth = 1.8; line(nx, ny + 2, nx - f * 9, y - 28 + crouch + rise);
  ctx.fillStyle = c; const hx = nx + f * 1, hy = ny - 7; ctx.beginPath(); ctx.arc(hx, hy, 6.5, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(hx - 3, hy + 4, 6, 4);
  ctx.fillStyle = sp < -0.2 ? '#ff4030' : '#1a1a22'; ctx.beginPath(); ctx.arc(hx + f * 3.2, hy - 1, 1.9, 0, Math.PI * 2); ctx.arc(hx - f * 1.5, hy - 1, 1.7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a1a22'; for (let i = 0; i < 3; i++) ctx.fillRect(hx - 2 + i * 2.2, hy + 5, 1, 3);
  drawHpBar(m, 56 + rise);
}

const projAil = a => { if (a === 'chill') { hero.chillT = 2.5; popups.push({ text: 'Chilled', x: hero.x, y: hero.y - 90, t: 0.9, color: '#6fd0ff' }); } else if (Math.random() < 0.45 * ailChance) addAilment(a); };            // what an ice shard or a fireball does when it lands

// ---------------------------------------------------------------- the second creature of every biome, evolutions and pack leaders
const NEW_MOBS2 = ['treant', 'mummy', 'frostwolf', 'magmaslime', 'wisp', 'sporeshroom', 'cursedKnight', 'golem'];
NEW_MOBS.push(...NEW_MOBS2);
BIOME_MOBS.forest.push('treant'); BIOME_MOBS.desert.push('mummy'); BIOME_MOBS.snow.push('frostwolf'); BIOME_MOBS.volcano.push('magmaslime');
BIOME_MOBS.swamp.push('wisp'); BIOME_MOBS.jungle.push('sporeshroom'); BIOME_MOBS.ruins.push('cursedKnight'); BIOME_MOBS.highlands.push('golem');
LUNGE.frostwolf = { ring: 150, range: 220, wind: 0.42, speed: 320, dur: 0.36, cd: 2.2, hop: 5 };
Object.assign(MELEE, {
  treant:       { extra: 34, wind: 0.6,  hit: 0.18, rec: 0.8, cd: 1.4, lunge: 50, mul: 1.2, snd: 'slam' },
  mummy:        { extra: 22, wind: 0.45, hit: 0.14, rec: 0.6, cd: 1.0, lunge: 70, mul: 1,   snd: 'swing' },
  frostwolf:    { extra: 18, wind: 0.28, hit: 0.12, rec: 0.4, cd: 0.8, lunge: 140, mul: 1,  snd: 'swing' },
  cursedKnight: { extra: 28, wind: 0.55, hit: 0.18, rec: 0.7, cd: 1.1, lunge: 80, mul: 1.2, snd: 'swing' },
  golem:        { extra: 40, wind: 0.7,  hit: 0.22, rec: 0.9, cd: 1.3, lunge: 40, mul: 1.3, snd: 'slam' },
});
// what each creature turns into when it has lived long enough (EVO_T seconds on the field): tougher, bigger, hits harder, its ailments twice as likely
const EVO = { goblin: 'Goblin Chief', minotaur: 'Bull Lord', ogre: 'Ogre Warlord', slime: 'Ooze Mass', archer: 'Marksman', wolf: 'Dire Wolf', scorpion: 'Giant Scorpion', icesprite: 'Frost Wraith', fireimp: 'Fire Fiend',
  bogLurker: 'Bog Horror', panther: 'Shadow Panther', skeleton: 'Bone Captain', harpy: 'Storm Harpy', treant: 'Elder Treant', mummy: 'Mummy Lord', frostwolf: 'Winter Alpha', magmaslime: 'Magma Mass',
  wisp: 'Greater Wisp', sporeshroom: 'Doom Cap', cursedKnight: 'Death Knight', golem: 'Mountain Golem' };
const EVO_T = 38;
function evolveMob(m) {
  m.evo = true; m.evoName = EVO[m.type];
  const mx = Math.round(m.maxHp * 1.6); m.hp += mx - m.maxHp; m.maxHp = mx;
  m.dmg = Math.round(m.dmg * 1.25); m.speed *= 1.08; m.xp = Math.round(m.xp * 1.8); m.scale = (m.scale || 1) * 1.15; m.r *= 1.08;
  popups.push({ text: `${m.evoName}!`, x: m.x, y: m.y - 100, t: 1.4, color: '#ffd24a', small: true }); sfx('roar'); burst(m.x, m.y - 35, '#ffd24a', 18, 200, 3, 100, true);
}
// a pack's leader is bigger and tougher, rallies the others near it (faster), and when it falls they are enraged for a few seconds
function makeLeader(m) { m.leader = true; m.hp = m.maxHp = Math.round(m.maxHp * 1.5); m.dmg = Math.round(m.dmg * 1.15); m.xp = Math.round(m.xp * 1.5); m.scale = (m.scale || 1) * 1.12; m.r *= 1.05; }
function mobBoost(m, dt) {
  m.rallyT = Math.max(0, (m.rallyT || 0) - dt); m.rageT = Math.max(0, (m.rageT || 0) - dt); m.wispT = Math.max(0, (m.wispT || 0) - dt);
  m.age = (m.age || 0) + dt;
  if (m.leader) for (const o of enemies) if (o !== m && o.type === m.type && !o.leader && Math.hypot(o.x - m.x, o.y - m.y) < 260) o.rallyT = 0.3;
  if (m.type === 'wisp') for (const o of enemies) if (o !== m && o.type !== 'wisp' && o.type !== 'boss' && Math.hypot(o.x - m.x, o.y - m.y) < 150) o.wispT = 0.4;
  if (!m.evo && EVO[m.type] && !m.elite && m.type !== 'boss' && (m.size ?? 1) >= 1 && !(m.spawnT > 0) && m.age > EVO_T) evolveMob(m);
  return (m.rallyT > 0 ? 1.2 : 1) * (m.rageT > 0 ? 1.35 : 1) * (m.wispT > 0 ? 1.25 : 1);
}
function leaderFell(m) {
  const mates = enemies.filter(o => o !== m && o.type === m.type && Math.hypot(o.x - m.x, o.y - m.y) < 450);
  if (!mates.length) return;
  for (const o of mates) { o.rageT = 5; o.flashT = 0.2; }
  popups.push({ text: 'The pack is enraged!', x: m.x, y: m.y - 90, t: 1.4, color: '#ff6a5a', small: true }); sfx('roar');
}
// shields: a Cursed Knight is only open to a blow while it swings, a Golem only while its core is bared
function shieldTick(m) {
  const armoredMut = m.mut && m.mut.includes('armored') ? 0.4 : 0;
  if (m.type === 'cursedKnight') m.armor = Math.max(armoredMut, m.mel && (m.mel.ph === 'strike' || m.mel.ph === 'rec') ? 0 : 0.7);
  else if (m.type === 'golem') m.armor = Math.max(armoredMut, m.state === 'aim' ? 0 : 0.5);
}

function newMobAI2(m, dt, dx, dy, dist, spd, slowMul) {
  const face = Math.sign(dx) || m.facing, ux = dx / dist, uy = dy / dist, t = m.type;
  const step = (vx, vy, s) => { m.x += vx * s * dt; m.y += vy * s * dt; m.x = Math.max(15, Math.min(WW - 15, m.x)); m.y = Math.max(50, Math.min(WH - 10, m.y)); };
  const aimed = (color, mul, ail, sp, y0 = 40) => { const a = Math.atan2(hero.y - 20 - (m.y - y0), hero.x - m.x); projectiles.push({ x: m.x, y: m.y - y0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 3.4, dmg: Math.max(1, Math.round(m.dmg * mul)), orb: color, src: m, ail }); };
  if (t === 'treant') {
    m.facing = face;
    if (m.state === 'walk') {
      step(ux, uy, spd); m.moving = true; m.walkT += dt * stepRate(spd, 10);
      if (m.stateT <= 0 && dist < 290 && dist > 60 && !hero.dead) { m.state = 'rootwind'; m.stateT = 0.95; m.tx = hero.x; m.ty = hero.y; m.moving = false; sfx('crackle'); }
    } else if (m.state === 'rootwind') {                                      // the roots will burst up where you stood
      if (m.stateT <= 0) {
        m.state = 'walk'; m.stateT = 3 + Math.random() * 1.5; m.fireT = FIRE_T; burst(m.tx, m.ty, '#6a4a2a', 16, 150, 3, 120, true); shake(3); sfx('slam');
        if (!hero.dead && Math.hypot(hero.x - m.tx, (hero.y - m.ty) * 1.6) < 58) { damageHero(Math.round(m.dmg * 1.1), true, m); addAilment('freeze', 0.8); }
      }
    }
  } else if (t === 'mummy') {
    m.facing = face;
    if (m.state === 'walk') {
      step(ux, uy, spd); m.moving = true; m.walkT += dt * stepRate(spd, 8.5);
      if (m.stateT <= 0 && dist > 120 && dist < 320 && !hero.dead) { m.state = 'aim'; m.stateT = 0.7; m.moving = false; }
    } else if (m.state === 'aim') {
      if (m.stateT <= 0) { aimed('#e8d49a', 0.8, 'blind', 230, 38); sfx('whoosh'); m.state = 'walk'; m.stateT = 2.5 + Math.random() * 1.2; }
    }
  } else if (t === 'frostwolf') {
    if (!m.howled && m.leader && m.state === 'walk' && dist < 420 && !hero.dead && enemies.filter(o => o.type === 'frostwolf').length < 5) { m.howled = true; m.state = 'howl'; m.stateT = 0.9; m.moving = false; m.facing = face; sfx('roar'); }
    if (m.state === 'howl') {
      if (m.stateT <= 0) {
        m.state = 'walk'; m.stateT = 0.5;
        if (enemies.length < 20) spawnEnemy('frostwolf', { x: m.x + 50, y: m.y + 20 }, { howled: true, spawnT: 0.4, variant: 'plain' });
        popups.push({ text: 'A howl!', x: m.x, y: m.y - 70, t: 0.9, color: '#cfe8ff', small: true });
      }
    } else newMobAI(m, dt, dx, dy, dist, spd, slowMul, true);
  } else if (t === 'magmaslime') {
    m.facing = face;
    if (m.state === 'walk' && m.stateT <= 0 && !hero.dead) { m.state = 'crouch'; m.stateT = 0.3; }
    if (m.state === 'crouch' && m.stateT <= 0) { m.state = 'hop'; m.stateT = 0.5; m.chargeDx = ux; m.chargeDy = uy; }
    if (m.state === 'hop') {
      const p = 1 - m.stateT / 0.5; m.hopZ = Math.sin(p * Math.PI) * 22; step(m.chargeDx, m.chargeDy, 150 * slowMul);
      if (m.stateT <= 0) {
        m.state = 'walk'; m.stateT = 0.6 + Math.random() * 0.7; m.hopZ = 0; m.land = 0.2;
        hazards.push({ k: 'pool', x: m.x, y: m.y, r: 40 * (m.size || 1), life: 3.5, max: 3.5, tick: 0, dmg: Math.max(2, Math.round(m.dmg * 0.3)), kind: 'lava', born: 0 });          // a puddle of lava where it lands
      }
    }
    m.land = Math.max(0, (m.land || 0) - dt);
  } else if (t === 'wisp') {
    m.facing = face; m.moving = true;
    const w = Math.sin(tAnim * 3 + m.x * 0.01);
    step(ux - uy * w * 0.9, uy + ux * w * 0.9, spd); m.hopZ = 6 + Math.sin(tAnim * 6 + m.y) * 3;
    if (gfx.particles && Math.random() < dt * 14) particles.push({ x: m.x + (Math.random() - 0.5) * 6, y: m.y - 14 - m.hopZ, vx: 0, vy: 10, life: 0.6, max: 0.6, size: 2, color: '#9fffd0', add: true });
  } else if (t === 'sporeshroom') {
    m.moving = false; m.facing = face;
    const near = Math.hypot(m.x - hero.x, m.y - hero.y) < 520;
    if (m.state === 'walk' && m.stateT <= 0 && near && !hero.dead) { m.state = 'puff'; m.stateT = 0.7; }
    if (m.state === 'puff' && m.stateT <= 0) {
      m.state = 'walk'; m.stateT = 3.6 + Math.random() * 1.4; sfx('poison');
      hazards.push({ k: 'pool', x: m.x, y: m.y, r: 74, life: 5, max: 5, tick: 0, dmg: Math.max(2, Math.round(m.dmg * 0.35)), kind: 'acid', born: 0 });
      if (gfx.particles) for (let i = 0; i < 14; i++) particles.push({ x: m.x, y: m.y - 24, vx: (Math.random() - 0.5) * 120, vy: -20 - Math.random() * 40, life: 0.9, max: 0.9, size: 3, color: '#b6e36f' });
    }
  } else if (t === 'cursedKnight') {
    m.facing = face; step(ux, uy, spd); m.moving = true; m.walkT += dt * stepRate(spd, 9);
  } else if (t === 'golem') {
    m.facing = face;
    if (m.state === 'walk') {
      step(ux, uy, spd); m.moving = true; m.walkT += dt * stepRate(spd, 14);
      if (m.stateT <= 0 && dist > 150 && dist < 430 && !hero.dead) { m.state = 'aim'; m.stateT = 1.0; m.moving = false; sfx('charge'); }
    } else if (m.state === 'aim') {                                          // it opens its chest to heave a boulder: that is when it can be hurt
      if (m.stateT <= 0) { aimed('#a89878', 1.15, null, 215, 52); sfx('slam'); shake(2); m.state = 'walk'; m.stateT = 3 + Math.random() * 1.5; }
    }
  }
}

// ---- drawing
function drawTreant(m) {
  const { x, y, facing: f } = m, ph = m.walkT, sp = swingPos(m), wind = m.state === 'rootwind', c = statusTint(m, '#6a4a2a');
  if (wind) { const p = 1 - m.stateT / 0.95; ctx.strokeStyle = `rgba(255,90,60,${0.3 + 0.5 * p})`; ctx.fillStyle = `rgba(255,70,50,${0.06 + 0.14 * p})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(m.tx, m.ty, 58, 58 / 1.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; line(m.tx + Math.cos(a) * 10 * p, m.ty + Math.sin(a) * 6 * p, m.tx + Math.cos(a) * 44 * p, m.ty + Math.sin(a) * 27 * p); } }
  drawShadow(x, y, 20);
  const bob = m.moving ? Math.abs(Math.sin(ph)) * 2 : Math.sin(tAnim * 2 + x) * 1, up = wind ? 1 - m.stateT / 0.95 : sp < 0 ? -sp : 0, slam = sp > 0 ? sp : 0;
  ctx.strokeStyle = c; ctx.lineCap = 'round'; ctx.lineWidth = 6;
  for (const sd of [-1, 1]) poly({ x: x + sd * 5, y: y - 20 }, { x: x + sd * 9 + Math.sin(ph + sd) * (m.moving ? 4 : 0), y: y - 8 }, { x: x + sd * 14, y });                      // root legs
  ctx.lineWidth = 11; line(x, y - 20, x + f * 2, y - 54 - bob);                                                                                                 // the trunk
  ctx.lineWidth = 3; ctx.strokeStyle = '#4a3418'; for (let i = 0; i < 3; i++) line(x - 3, y - 26 - i * 9, x + 4, y - 30 - i * 9);
  ctx.strokeStyle = c; ctx.lineWidth = 5;
  const ax = x + f * (14 + slam * 10), ay = y - 46 - up * 26 + slam * 22; poly({ x: x + f * 4, y: y - 46 - bob }, { x: x + f * 10, y: y - 50 - up * 16 }, { x: ax, y: ay }); ctx.lineWidth = 3; line(ax, ay, ax + f * 8, ay - 5); line(ax, ay, ax + f * 7, ay + 4);
  poly({ x: x - f * 4, y: y - 46 - bob }, { x: x - f * 12, y: y - 38 }, { x: x - f * 14, y: y - 30 });
  const lc = m.evo ? '#9ad84a' : '#3f8a3a';                                                                                                                         // the leafy crown
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + 0.3, r = 10 + (i % 2) * 4; ctx.fillStyle = i % 2 ? lc : '#2f6a2c'; ctx.beginPath(); ctx.arc(x + f * 2 + Math.cos(a) * r, y - 66 - bob + Math.sin(a) * r * 0.75, 8, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#e8a030'; ctx.beginPath(); ctx.arc(x + f * 5, y - 58 - bob, 2.2, 0, Math.PI * 2); ctx.arc(x - f * 1, y - 58 - bob, 2.2, 0, Math.PI * 2); ctx.fill();
  drawHpBar(m, 96);
}
function drawMummy(m) {
  const { x, y, facing: f } = m, ph = m.walkT, sp = swingPos(m), aim = m.state === 'aim', c = statusTint(m, '#d8cfa8');
  drawShadow(x, y, 11);
  const bob = m.moving ? Math.abs(Math.sin(ph)) * 1.6 : 0, lean = f * (sp < 0 ? sp * 3 : sp * 6), crouch = sp < 0 ? -sp * 3 : 0;
  ctx.strokeStyle = c; ctx.lineCap = 'round'; ctx.lineWidth = 3.6;
  drawLegs(x, y - 18 + crouch * 0.6, y, f, ph, !!m.moving, 9, 8);
  const nx = x + lean * 0.4 + f * 2, ny = y - 36 - bob + crouch; line(x, y - 18 + crouch * 0.6, nx, ny);
  ctx.strokeStyle = '#a89868'; ctx.lineWidth = 1.4; for (let i = 0; i < 5; i++) line(x - 4 + lean * 0.2, y - 20 - i * 3.4, x + 4 + lean * 0.2, y - 22 - i * 3.4);          // the wrappings
  ctx.strokeStyle = c; ctx.lineWidth = 3.6;
  const ex = nx + f * (aim ? 16 : sp > 0 ? 6 + sp * 18 : 14), ey = ny + 6 + (sp < 0 ? sp * 6 : 0) - (aim ? 4 : 0); poly({ x: nx, y: ny + 2 }, { x: nx + f * 8, y: ny + 8 }, { x: ex, y: ey }); poly({ x: nx, y: ny + 2 }, { x: nx + f * 4, y: ny + 12 }, { x: nx + f * 11, y: ny + 16 });
  if (aim) { const p = 1 - m.stateT / 0.7; ctx.fillStyle = `rgba(232,212,154,${0.4 + 0.4 * p})`; ctx.beginPath(); ctx.arc(ex + f * 4, ey, 3 + p * 6, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = c; ctx.beginPath(); ctx.arc(nx + f, ny - 7, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#a89868'; ctx.lineWidth = 1.3; line(nx - 5, ny - 8, nx + 7, ny - 5); line(nx - 5, ny - 4, nx + 7, ny - 2);
  ctx.fillStyle = sp < -0.2 || aim ? '#ff4030' : '#5ff0d0'; ctx.beginPath(); ctx.arc(nx + f * 3.4, ny - 8, 1.7, 0, Math.PI * 2); ctx.fill();
  if (m.wfx && m.wfx.fire || m.burnT > 0) { ctx.fillStyle = 'rgba(255,140,40,0.7)'; ctx.beginPath(); ctx.arc(x, y - 30, 12, 0, Math.PI * 2); ctx.fill(); }
  drawHpBar(m, 56);
}
function drawMagmaSlime(m) {
  const { x, y } = m, s = m.size || 1, z = m.hopZ || 0, land = (m.land || 0) / 0.2;
  drawShadow(x, y, 16 * s * (1 - z / 60));
  const sq = m.state === 'crouch' ? 1.3 : m.state === 'hop' ? 0.85 : 1 + Math.sin(tAnim * 6 + x) * 0.07 + land * 0.35, w = 18 * s * sq, h = 15 * s / sq;
  const g = ctx.createRadialGradient(x, y - z - h * 0.6, 2, x, y - z - h * 0.6, w * 1.1); g.addColorStop(0, m.flashT > 0 ? '#fff' : '#ffd060'); g.addColorStop(0.5, statusTint(m, '#ff6a20')); g.addColorStop(1, '#8a2a10');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y - z - h * 0.5, w, h, 0, Math.PI, 0); ctx.lineTo(x + w, y - z); ctx.quadraticCurveTo(x, y - z + 4, x - w, y - z); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#3a1008'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,230,120,0.8)'; ctx.lineWidth = 1.6; line(x - 7 * s, y - z - h * 0.7, x - 2 * s, y - z - h * 0.3); line(x + 6 * s, y - z - h * 0.8, x + 3 * s, y - z - h * 0.4);
  ctx.fillStyle = '#2a0a04'; ctx.beginPath(); ctx.arc(x - 5 * s, y - z - h * 0.55, 2 * s, 0, Math.PI * 2); ctx.arc(x + 5 * s, y - z - h * 0.55, 2 * s, 0, Math.PI * 2); ctx.fill();
  drawHpBar(m, 40 * s + 10);
}
function drawWisp(m) {
  const { x, y } = m, z = m.hopZ || 0, py = y - 20 - z;
  ctx.save(); ctx.globalAlpha *= 0.25; drawShadow(x, y, 7); ctx.restore();
  const pulse = 0.8 + 0.2 * Math.sin(tAnim * 8 + x);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, py, 1, x, py, 22 * pulse); g.addColorStop(0, 'rgba(200,255,230,0.95)'); g.addColorStop(0.35, 'rgba(120,255,200,0.5)'); g.addColorStop(1, 'rgba(60,200,150,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, py, 22 * pulse, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.fillStyle = m.flashT > 0 ? '#fff' : '#d8fff0'; ctx.beginPath(); ctx.arc(x, py, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a5a48'; ctx.beginPath(); ctx.arc(x - 1.8, py - 0.8, 1, 0, Math.PI * 2); ctx.arc(x + 1.8, py - 0.8, 1, 0, Math.PI * 2); ctx.fill();
  drawHpBar(m, 44 + z);
}
function drawShroom(m) {
  const { x, y } = m, puff = m.state === 'puff' ? 1 - m.stateT / 0.7 : 0, sw = 1 + puff * 0.35, c = statusTint(m, '#b05a8a');
  drawShadow(x, y, 15);
  ctx.fillStyle = '#e8dcc0'; ctx.strokeStyle = '#6a5a40'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.quadraticCurveTo(x - 4, y - 14, x - 5, y - 22); ctx.lineTo(x + 5, y - 22); ctx.quadraticCurveTo(x + 4, y - 14, x + 6, y); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y - 25, 19 * sw, (13 + puff * 3) * (1 + Math.sin(tAnim * 3 + x) * 0.03), 0, Math.PI, 0); ctx.quadraticCurveTo(x, y - 20, x - 19 * sw, y - 25); ctx.fill(); ctx.strokeStyle = '#4a1a38'; ctx.stroke();
  ctx.fillStyle = '#f0d8e8'; for (const [dx, dy, r] of [[-9, -29, 2.6], [4, -34, 2.2], [10, -27, 2.8], [-2, -26, 1.8]]) { ctx.beginPath(); ctx.arc(x + dx * sw, y + dy, r, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#2a0a1a'; ctx.beginPath(); ctx.arc(x - 3, y - 14, 1.5, 0, Math.PI * 2); ctx.arc(x + 3, y - 14, 1.5, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x - 2, y - 10, 4, puff * 3 + 1);
  if (puff > 0 && gfx.particles && Math.random() < 0.5) particles.push({ x: x + (Math.random() - 0.5) * 20, y: y - 30, vx: (Math.random() - 0.5) * 40, vy: -20, life: 0.7, max: 0.7, size: 2.5, color: '#b6e36f' });
  drawHpBar(m, 52);
}
function drawKnight(m) {
  const { x, y, facing: f } = m, ph = m.walkT, sp = swingPos(m), striking = m.mel && m.mel.ph === 'strike', c = statusTint(m, '#5a5a78'), open = !!(m.mel && (m.mel.ph === 'strike' || m.mel.ph === 'rec'));
  drawShadow(x, y, 14);
  const bob = m.moving ? Math.abs(Math.sin(ph)) * 1.5 : 0, crouch = sp < 0 ? -sp * 4 : 0, lean = f * (sp < 0 ? sp * 3 : sp * 8);
  ctx.strokeStyle = c; ctx.lineCap = 'round'; ctx.lineWidth = 4.4; drawLegs(x, y - 20 + crouch * 0.6, y, f, ph, !!m.moving, 10.5, 9);
  const nx = x + lean * 0.4, ny = y - 40 - bob + crouch; ctx.lineWidth = 8; line(x, y - 20 + crouch * 0.6, nx, ny);
  ctx.strokeStyle = '#8a8aa8'; ctx.lineWidth = 2; line(nx - 4, ny + 4, nx + 4, ny + 4);                                                             // the breastplate
  const rest = { x: nx + f * 12, y: y - 28, tx: f * 9, ty: -10 }, back = { x: nx - f * 2, y: y - 56 + crouch, tx: -f * 3, ty: -13 }, out = { x: nx + f * 22, y: y - 38 + crouch, tx: f * 15, ty: 1 };
  const A = striking ? back : rest, B = sp < 0 ? back : out, tt = sp < 0 ? -sp : striking ? (sp + 1) / 2 : sp, mix = (a, b, t) => a + (b - a) * t;
  const hand = { x: mix(A.x, B.x, tt), y: mix(A.y, B.y, tt), tx: mix(A.tx, B.tx, tt), ty: mix(A.ty, B.ty, tt) };
  ctx.strokeStyle = c; ctx.lineWidth = 4; line(nx, ny + 3, hand.x, hand.y); ctx.strokeStyle = '#b8b8d0'; ctx.lineWidth = 3; line(hand.x, hand.y, hand.x + hand.tx * 1.7, hand.y + hand.ty * 1.7);
  ctx.save(); ctx.translate(nx - f * 3 + f * (open ? -6 : 8), y - 32 + (open ? 3 : 0)); ctx.fillStyle = open ? '#6a4a6a' : '#7a6aa0'; ctx.strokeStyle = '#2a1a3a'; ctx.lineWidth = 1.6;                    // the shield: held up until it swings
  ctx.beginPath(); ctx.moveTo(-6, -13); ctx.lineTo(6, -13); ctx.lineTo(6, 4); ctx.quadraticCurveTo(0, 14, -6, 4); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#b06aff'; ctx.fillRect(-1, -10, 2, 14); ctx.restore();
  ctx.fillStyle = c; ctx.beginPath(); ctx.arc(nx + f, ny - 8, 7.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#2a2a3a'; ctx.fillRect(nx + f * 1 - 1, ny - 11, f * 8, 3);
  ctx.fillStyle = '#8a2a6a'; ctx.beginPath(); ctx.moveTo(nx - f * 2, ny - 14); ctx.quadraticCurveTo(nx - f * 10, ny - 22 + Math.sin(tAnim * 6) * 2, nx - f * 12, ny - 12); ctx.lineTo(nx - f * 4, ny - 12); ctx.fill();
  ctx.fillStyle = sp < -0.2 ? '#ff4030' : '#c36bff'; ctx.beginPath(); ctx.arc(nx + f * 5, ny - 9, 1.5, 0, Math.PI * 2); ctx.fill();
  if (!open && gfx.glow) { ctx.fillStyle = 'rgba(176,106,255,0.12)'; ctx.beginPath(); ctx.arc(nx, ny + 4, 24, 0, Math.PI * 2); ctx.fill(); }
  drawHpBar(m, 66);
}
function drawGolem(m) {
  const { x, y, facing: f } = m, ph = m.walkT, sp = swingPos(m), aim = m.state === 'aim', c = statusTint(m, '#8a8a7a'), open = aim ? 1 - Math.abs(m.stateT - 0.5) : 0;
  drawShadow(x, y, 26);
  const bob = m.moving ? Math.abs(Math.sin(ph)) * 2 : 0, slam = sp > 0 ? sp * 14 : 0, up = sp < 0 ? -sp * 22 : 0;
  ctx.fillStyle = c; ctx.strokeStyle = '#4a4a40'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
  for (const sd of [-1, 1]) { const lx = x + sd * 10 + Math.sin(ph + sd * 1.6) * (m.moving ? 3 : 0); ctx.beginPath(); ctx.rect(lx - 7, y - 20 + bob, 14, 20); ctx.fill(); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(x - 20, y - 22 - bob); ctx.lineTo(x - 24, y - 52 - bob); ctx.lineTo(x - 8, y - 66 - bob); ctx.lineTo(x + 12, y - 62 - bob); ctx.lineTo(x + 24, y - 46 - bob); ctx.lineTo(x + 20, y - 22 - bob); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#6a6a5a'; ctx.beginPath(); ctx.moveTo(x - 8, y - 40 - bob); ctx.lineTo(x - 4, y - 56 - bob); ctx.lineTo(x + 6, y - 44 - bob); ctx.fill();
  const cg = ctx.createRadialGradient(x + f * 2, y - 38 - bob, 1, x + f * 2, y - 38 - bob, 12); cg.addColorStop(0, aim ? '#fff0a0' : '#7a5a2a'); cg.addColorStop(1, aim ? 'rgba(255,170,40,0.2)' : '#3a2a14');
  ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(x + f * 2, y - 38 - bob, aim ? 7 + open * 3 : 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = c; ctx.beginPath(); ctx.rect(x + f * 4 - 9, y - 80 - bob, 18, 15); ctx.fill(); ctx.stroke();
  ctx.fillStyle = aim || sp < -0.2 ? '#ff6a30' : '#ffd060'; ctx.fillRect(x + f * 5 - 1, y - 75 - bob, 4, 3); ctx.fillRect(x + f * 5 - 8, y - 75 - bob, 4, 3);
  ctx.fillStyle = c; const ax = x + f * (30 + slam * 0.5), ay = y - 40 - up + slam + 12;
  ctx.beginPath(); ctx.rect(ax - 8, ay - 8, 16, 18); ctx.fill(); ctx.stroke(); ctx.strokeStyle = c; ctx.lineWidth = 8; line(x + f * 18, y - 56 - bob - up * 0.5, ax, ay - 6);
  ctx.beginPath(); ctx.rect(x - f * 34 - 7, y - 32 - bob, 14, 16); ctx.fill(); ctx.strokeStyle = '#4a4a40'; ctx.lineWidth = 2; ctx.stroke();
  drawHpBar(m, 100);
}
// evolved creatures carry their new name and a gold mark, a pack leader a crown
function drawEvoTag(m) {
  const t = TELL_Y[m.type] || 70;
  if (m.leader) { const cy = m.y - t - 18; ctx.fillStyle = '#ffd24a'; ctx.strokeStyle = '#7a5a10'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(m.x - 8, cy + 6); ctx.lineTo(m.x - 8, cy - 2); ctx.lineTo(m.x - 4, cy + 2); ctx.lineTo(m.x, cy - 4); ctx.lineTo(m.x + 4, cy + 2); ctx.lineTo(m.x + 8, cy - 2); ctx.lineTo(m.x + 8, cy + 6); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  if (m.evoName) {
    ctx.save(); ctx.textAlign = 'center'; ctx.font = `bold 9px ${UI_FONT}`; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; const ty = m.y - t - 6 - (m.leader ? 8 : 0);
    ctx.strokeText(m.evoName, m.x, ty); ctx.fillStyle = '#ffd24a'; ctx.fillText(m.evoName, m.x, ty); ctx.restore();
    if (gfx.glow) { ctx.strokeStyle = `rgba(255,210,74,${0.35 + 0.2 * Math.sin(tAnim * 4)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(m.x, m.y, (m.r || 12) + 12, ((m.r || 12) + 12) / 1.7, 0, 0, Math.PI * 2); ctx.stroke(); }
  }
}

// ---------------------------------------------------------------- idle fidgets
// A creature that stands about (between hops, waiting for its next attack, a plant that never walks) does something small now and then: scratches its head, sniffs, shakes itself,
// looks around, stretches, preens, blows a bubble. A fidget is a few seconds of a body motion (applied when the creature is drawn) and now and then a puff of something.
const FIDGETS = {
  goblin: [['scratch', '?'], ['look'], ['stretch']], minotaur: [['paw'], ['snort'], ['look']], ogre: [['stretch'], ['paw'], ['snort']],
  slime: [['jiggle'], ['jiggle', 'bubble']], magmaslime: [['jiggle', 'bubble'], ['bubble']], archer: [['look'], ['sway'], ['scratch', '...']], skeleton: [['look'], ['rattle']],
  wolf: [['sniff'], ['shake'], ['look']], frostwolf: [['shake'], ['sniff']], panther: [['stretch'], ['sniff'], ['tail']], scorpion: [['tail'], ['sway']],
  icesprite: [['twinkle']], fireimp: [['spark'], ['preen']], harpy: [['preen'], ['look']], wisp: [['loop'], ['twinkle']], bogLurker: [['bubble'], ['sway']],
  treant: [['sway', 'leaf'], ['stretch']], mummy: [['sway', 'sand'], ['look']], sporeshroom: [['puff'], ['sway']], cursedKnight: [['look', 'chill'], ['sway']], golem: [['dust'], ['stretch']],
};
const FID_TIME = { scratch: 1.2, look: 1.5, paw: 1.3, snort: 1.1, stretch: 1.3, jiggle: 1.0, bubble: 1.4, sway: 1.8, sniff: 1.4, shake: 0.9, tail: 1.2, twinkle: 1.4, spark: 1.2, preen: 1.3, loop: 1.5, puff: 1.3, rattle: 0.9, dust: 1.2, leaf: 1.5, sand: 1.5, chill: 1.4 };
const FID_PUFF = { bubble: m => m.type === 'magmaslime' ? '#ff9a40' : m.type === 'bogLurker' ? '#7aa86a' : '#a8ffb0', twinkle: () => '#cfeaff', spark: () => '#ff9a40', leaf: () => '#6aa84a', sand: () => '#e6cf9c', chill: () => '#cfeaff', puff: () => '#d89acb', dust: () => '#b0a89a', snort: () => '#ebebeb', paw: () => '#b9a98a' };
function fidgetTick(m, dt) {
  if (m.type === 'boss' || m.dieT !== undefined || !FIDGETS[m.type]) return;
  const moved = Math.hypot(m.x - (m._fx ?? m.x), m.y - (m._fy ?? m.y)) / Math.max(dt, 0.001) / 60; m._fx = m.x; m._fy = m.y;                   // how far it moved, as pixels per frame at 60 frames a second
  const idle = moved < 0.25 && !m.mel && m.state === 'walk' && !(m.spawnT > 0) && !(m.stunT > 0) && !(m.alertT > 0);
  m.idleT = idle ? (m.idleT || 0) + dt : 0;
  const F = m.fid;
  if (F) {
    F.t += dt;
    const p = F.t / F.dur;
    if (F.kinds.includes('look') && !F.flipped && p > 0.3) { F.flipped = true; F.was = m.facing; m.facing = -m.facing; }
    if (F.kinds.includes('look') && F.flipped && !F.back && p > 0.7) { F.back = true; m.facing = F.was; }
    if (!idle && p < 0.9 && moved > 1) { if (F.flipped && !F.back) m.facing = F.was; m.fid = null; return; }              // it has something else to do now
    if (gfx.particles) for (const k of F.kinds) if (FID_PUFF[k] && Math.random() < dt * 9) {
      const up = k === 'bubble' || k === 'twinkle' || k === 'spark' || k === 'puff' || k === 'chill' || k === 'leaf' || k === 'sand';
      particles.push({ x: m.x + (Math.random() - 0.5) * 18 * (m.scale || 1), y: m.y - (k === 'paw' || k === 'dust' ? 2 : 24 + Math.random() * 26) * (m.scale || 1), vx: (Math.random() - 0.5) * 20 + (k === 'snort' ? m.facing * 26 : 0), vy: up ? (k === 'leaf' || k === 'sand' ? 24 : -26) : -8, life: 0.6, max: 0.6, size: k === 'bubble' ? 3 : 2.2, color: FID_PUFF[k](m), add: k === 'twinkle' || k === 'spark' });
    }
    if (F.t >= F.dur) m.fid = null;
    return;
  }
  m.fidCd = (m.fidCd === undefined ? 1.5 + Math.random() * 3 : m.fidCd) - dt;
  if (m.idleT > 0.5 && m.fidCd <= 0) {
    const pick = FIDGETS[m.type][Math.floor(Math.random() * FIDGETS[m.type].length)], dur = Math.max(...pick.map(k => FID_TIME[k] || 1.2));
    m.fid = { kinds: pick, t: 0, dur }; m.fidCd = 3.5 + Math.random() * 5;
    if (pick.includes('scratch')) popups.push({ text: pick[1] || '?', x: m.x, y: m.y - 92 * (m.scale || 1), t: 1.1, color: '#ddd', small: true });
  }
}
// the motion of a fidget, applied to the picture of the creature (called from drawEnemy inside its save / restore)
function applyFidget(m) {
  const F = m.fid; if (!F) return;
  const p = Math.min(1, F.t / F.dur), s = Math.sin(p * Math.PI), f = m.facing || 1, t = F.t;
  ctx.translate(m.x, m.y);
  for (const k of F.kinds) switch (k) {
    case 'scratch': ctx.rotate(f * Math.sin(t * 16) * 0.05 * s); ctx.translate(0, -Math.abs(Math.sin(t * 8)) * 1.5 * s); break;
    case 'paw': ctx.translate(0, -Math.abs(Math.sin(p * Math.PI * 3)) * 3.2); break;
    case 'snort': ctx.rotate(-f * 0.07 * Math.sin(Math.min(1, p * 2) * Math.PI)); ctx.translate(f * 2 * (p > 0.5 ? s : 0), 0); break;
    case 'stretch': ctx.scale(1 + 0.07 * s, 1 - 0.09 * s); ctx.translate(f * 2 * s, 0); break;
    case 'jiggle': ctx.scale(1 + 0.1 * Math.sin(t * 22) * (1 - p), 1 - 0.1 * Math.sin(t * 22) * (1 - p)); break;
    case 'bubble': ctx.scale(1 + 0.04 * s, 1 - 0.04 * s); break;
    case 'sway': ctx.rotate(Math.sin(t * 3.4) * 0.05 * s); break;
    case 'sniff': ctx.rotate(f * 0.13 * s + Math.sin(t * 14) * 0.015); ctx.translate(f * 3 * s, 2 * s); break;
    case 'shake': ctx.translate(Math.sin(t * 46) * 2.6 * (1 - p), 0); ctx.rotate(Math.sin(t * 46) * 0.04 * (1 - p)); break;
    case 'tail': ctx.rotate(Math.sin(t * 12) * 0.045 * s); break;
    case 'twinkle': ctx.scale(1 + 0.12 * Math.sin(t * 10) * s, 1 + 0.12 * Math.sin(t * 10) * s); break;
    case 'spark': ctx.scale(1 + 0.1 * Math.abs(Math.sin(t * 12)) * s, 1 + 0.1 * Math.abs(Math.sin(t * 12)) * s); break;
    case 'preen': ctx.translate(0, -Math.abs(Math.sin(t * 13)) * 3 * s); ctx.scale(1 - 0.08 * Math.abs(Math.sin(t * 13)) * s, 1); break;
    case 'loop': ctx.translate(Math.sin(p * Math.PI * 2) * 12, (1 - Math.cos(p * Math.PI * 2)) * -7); break;
    case 'puff': ctx.scale(1 + 0.05 * Math.sin(t * 9) * s, 1 - 0.1 * Math.max(0, Math.sin(t * 9)) * s); break;
    case 'rattle': ctx.translate(Math.sin(t * 40) * 1.8 * (1 - p), 0); break;
    case 'dust': ctx.translate(Math.sin(t * 30) * 1.6 * s, 0); break;
    case 'chill': ctx.translate(0, Math.sin(t * 5) * 1.4 * s); break;
  }
  ctx.translate(-m.x, -m.y);
}

// ---------------------------------------------------------------- death scenes
// Every kind of creature goes its own way: goblins tumble, minotaurs sink to their knees and topple, ogres crash down and shake the ground, slimes splat into a puddle, wolves roll
// over, the flying ones spin out of the air, imps burst into embers, sprites shatter into ice, wisps drift up as sparks, the plant and the stone creatures wilt and crumble.
// t: how long the corpse lasts, hold: how much of that it stays solid before fading, at: when its one-off effect happens (a thud, a cloud of dust), pose(p): how it is turned over.
const rotAbout = (m, a) => { ctx.translate(m.x, m.y); ctx.rotate(a); ctx.translate(-m.x, -m.y); };
const easeOutQ = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const DEATH = {
  goblin:   { t: 0.9, hold: 0.5, pose: (m, p) => { ctx.translate(0, -Math.sin(Math.min(1, p * 2.2) * Math.PI) * 18); rotAbout(m, -m.facing * easeOutQ(p * 2) * 1.75); } },
  minotaur: { t: 1.2, hold: 0.6, at: 0.52, fx: 'thud', pose: (m, p) => { ctx.translate(0, Math.min(1, p * 3) * 10); rotAbout(m, p < 0.4 ? -m.facing * 0.1 * (p / 0.4) : -m.facing * (0.1 + easeOutQ((p - 0.4) / 0.25) * 1.4)); } },
  ogre:     { t: 1.5, hold: 0.65, at: 0.55, fx: 'quake', pose: (m, p) => { ctx.translate(Math.sin(p * 30) * 1.5 * (1 - p), Math.min(1, p * 2.5) * 12); rotAbout(m, p < 0.45 ? -m.facing * 0.14 * (p / 0.45) : -m.facing * (0.14 + easeOutQ((p - 0.45) / 0.2) * 1.35)); } },
  slime:    { t: 1.1, hold: 0.55, puddle: 'rgba(110,200,110,0.55)', pose: (m, p) => { ctx.translate(m.x, m.y); ctx.scale(1 + easeOutQ(p * 2.5) * 0.8, Math.max(0.05, 1 - easeOutQ(p * 2.5) * 0.93)); ctx.translate(-m.x, -m.y); } },
  magmaslime: { t: 1.1, hold: 0.5, puddle: 'rgba(255,110,40,0.6)', fx: 'lava', at: 0.05, pose: (m, p) => { const k = p < 0.15 ? 1 + p * 3 : Math.max(0.05, 1.45 - (p - 0.15) * 1.7); ctx.translate(m.x, m.y); ctx.scale(k, Math.max(0.05, 2 - k)); ctx.translate(-m.x, -m.y); } },
  archer:   { t: 1.0, hold: 0.5, pose: (m, p) => { ctx.translate(0, easeOutQ(p * 2) * 4); rotAbout(m, -m.facing * easeOutQ(p * 1.6) * 1.55); } },
  skeleton: { t: 0.8, hold: 0.3, fx: 'bones', at: 0.02, pose: (m, p) => { ctx.translate(m.x, m.y); ctx.scale(1 + p * 0.1, Math.max(0.1, 1 - easeOutQ(p * 1.5) * 0.85)); ctx.translate(-m.x, -m.y); } },
  wolf:     { t: 1.0, hold: 0.55, pose: (m, p) => { ctx.translate(0, -Math.sin(Math.min(1, p * 2.4) * Math.PI) * 14); rotAbout(m, -m.facing * easeOutQ(p * 2.4) * 3.1); ctx.translate(0, easeOutQ(p * 2.4) * 6); } },
  frostwolf: { t: 1.0, hold: 0.55, fx: 'ice', at: 0.35, pose: (m, p) => { ctx.translate(0, -Math.sin(Math.min(1, p * 2.4) * Math.PI) * 14); rotAbout(m, -m.facing * easeOutQ(p * 2.4) * 3.1); ctx.translate(0, easeOutQ(p * 2.4) * 6); } },
  panther:  { t: 1.1, hold: 0.45, fx: 'shadow', at: 0.3, pose: (m, p) => { rotAbout(m, -m.facing * easeOutQ(p * 2) * 1.5); ctx.translate(0, easeOutQ(p * 2) * 4); } },
  scorpion: { t: 1.0, hold: 0.55, pose: (m, p) => { ctx.translate(m.x, m.y); ctx.scale(1, 1 - easeOutQ(p * 2) * 0.35); ctx.rotate(m.facing * easeOutQ(p * 2) * 0.35); ctx.translate(-m.x, -m.y); } },
  harpy:    { t: 1.0, hold: 0.6, at: 0.62, fx: 'feathers', pose: (m, p) => { const fall = Math.min(1, p / 0.6), z = (m.hopZ || 40) * (1 - fall * fall); ctx.translate(0, (m.hopZ || 40) - z); rotAbout(m, m.facing * fall * 5.2); } },
  icesprite: { t: 0.55, hold: 0.1, at: 0.04, fx: 'shatter', pose: (m, p) => { ctx.translate(m.x, m.y); ctx.scale(1 + p * 0.5, 1 + p * 0.5); ctx.translate(-m.x, -m.y); } },
  fireimp:  { t: 0.7, hold: 0.15, at: 0.04, fx: 'embers', pose: (m, p) => { ctx.translate(m.x, m.y - (m.hopZ || 30)); ctx.scale(1 + p * 0.6, Math.max(0.1, 1 - p * 1.2)); ctx.translate(-m.x, -m.y + (m.hopZ || 30)); } },
  wisp:     { t: 1.2, hold: 0.1, at: 0.04, fx: 'wisp', pose: (m, p) => { ctx.translate(0, -p * 44); ctx.translate(m.x, m.y); ctx.scale(1 - p * 0.5, 1 - p * 0.5); ctx.translate(-m.x, -m.y); } },
  bogLurker: { t: 1.2, hold: 0.35, fx: 'bubbles', at: 0.1, pose: (m, p) => { ctx.translate(0, easeOutQ(p) * 40); ctx.translate(m.x, m.y); ctx.scale(1, 1 - easeOutQ(p) * 0.5); ctx.translate(-m.x, -m.y); } },
  treant:   { t: 1.7, hold: 0.7, at: 0.5, fx: 'leaves', pose: (m, p) => { ctx.translate(Math.sin(p * 22) * 1.2 * (1 - p), 0); rotAbout(m, -m.facing * (p < 0.2 ? 0.04 * Math.sin(p * 40) : easeOutQ((p - 0.2) / 0.45) * 1.5)); } },
  mummy:    { t: 1.3, hold: 0.4, at: 0.05, fx: 'sand', pose: (m, p) => { ctx.translate(m.x, m.y); ctx.scale(1 + p * 0.15, Math.max(0.12, 1 - easeOutQ(p * 1.4) * 0.88)); ctx.translate(-m.x, -m.y); } },
  sporeshroom: { t: 1.2, hold: 0.45, at: 0.05, fx: 'spores', pose: (m, p) => { ctx.translate(m.x, m.y); ctx.scale(1 + easeOutQ(p * 2) * 0.25, Math.max(0.15, 1 - easeOutQ(p * 2) * 0.8)); ctx.translate(-m.x, -m.y); } },
  cursedKnight: { t: 1.5, hold: 0.55, at: 0.4, fx: 'soul', pose: (m, p) => { ctx.translate(0, easeOutQ(p * 2) * 12); rotAbout(m, -m.facing * (p < 0.4 ? 0.06 : 0.06 + easeOutQ((p - 0.4) / 0.25) * 1.4)); } },
  golem:    { t: 1.6, hold: 0.55, at: 0.1, fx: 'rubble', pose: (m, p) => { ctx.translate(Math.sin(p * 40) * 2 * (1 - p), 0); ctx.translate(m.x, m.y); ctx.scale(1 + p * 0.1, Math.max(0.2, 1 - easeOutQ(p * 1.3) * 0.8)); ctx.translate(-m.x, -m.y); } },
};
const deathTime = m => m.type === 'boss' ? 1.6 : ((DEATH[m.type] && DEATH[m.type].t) || 0.6) * ((m.scale || 1) > 1 ? 1.15 : 1);
function enemyDeathPose(m, p) {
  const D = DEATH[m.type];
  if (D) D.pose(m, p);
  else { ctx.translate(m.x, m.y); ctx.rotate(-m.facing * Math.min(1, p * 2) * 1.4); ctx.translate(-m.x, -m.y); }
}
const deathAlpha = (m, p) => { const D = DEATH[m.type], h = D ? D.hold : 0; return Math.max(0, p < h ? 1 : 1 - (p - h) / (1 - h)); };
function drawDeathPuddle(m, p) {                                                // the goo a slime leaves behind
  const D = DEATH[m.type]; if (!D || !D.puddle) return;
  const k = easeOutQ(p * 2.2); ctx.save(); ctx.globalAlpha *= 0.9; ell(m.x, m.y + 1, (14 + 16 * k) * (m.size ?? 1), (5 + 5 * k) * (m.size ?? 1), D.puddle); ctx.restore();
}
// the one-off bits of a death: a thud of dust, embers, shards, sparks (called once, at D.at of the way through)
function deathEffect(m, D) {
  const x = m.x, y = m.y, mk = (n, col, sp, sz, grav, up = 0, add = false) => burst(x, y - up, col, n, sp, sz, grav, add);
  switch (D.fx) {
    case 'thud': mk(12, '#b9a98a', 120, 3, 60); shake(3); sfx('slam'); break;
    case 'quake': mk(22, '#b9a98a', 180, 3.5, 60); shake(8); sfx('quake'); break;
    case 'lava': mk(22, '#ff9a40', 240, 3, 200, 24, true); sfx('lava'); break;
    case 'bones': mk(14, '#e8e0c8', 200, 2.5, 380, 20); sfx('hitBlunt'); break;
    case 'ice': mk(10, '#cfeaff', 140, 2.4, 200, 20, true); break;
    case 'shadow': mk(14, '#3a3a52', 120, 3.5, -60, 30); break;
    case 'feathers': mk(14, '#c9a0e0', 110, 3, 70, 30); break;
    case 'shatter': mk(22, '#cfeaff', 260, 2.6, 240, 24, true); sfx('icecrack'); break;
    case 'embers': mk(22, '#ff7a2a', 200, 2.4, -60, 28, true); sfx('crackle'); break;
    case 'wisp': mk(18, '#9fffd0', 80, 2.2, -90, 26, true); sfx('sparkle'); break;
    case 'bubbles': mk(10, '#7aa86a', 60, 3.2, -80, 14); sfx('glub'); break;
    case 'leaves': mk(24, '#6aa84a', 120, 3, 50, 50); sfx('rustle'); break;
    case 'sand': mk(26, '#e6cf9c', 120, 2.6, 60, 40); break;
    case 'spores': mk(24, '#d89acb', 80, 2.8, -30, 20, true); break;
    case 'soul': mk(10, '#cfd6ff', 50, 3, -140, 36, true); sfx('wail'); break;
    case 'rubble': mk(28, '#8a8a7a', 200, 3.4, 300, 40); shake(7); sfx('quake'); break;
  }
}
function deathTick(c, dt) {                                                      // corpses: advance, and fire the one-off effect at its moment
  c.dieT += dt;
  const D = DEATH[c.type];
  if (D && D.fx && !c._did && c.dieT / c.dieMax >= (D.at ?? 0)) { c._did = true; deathEffect(c, D); }
}
