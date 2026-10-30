// Ranged weapons (bows and staves) and the boss signature weapons.
// A ranged attack is a normal attack animation (see WEAPON_KINDS in game.js); at the moments a variant lists in `fire` the weapon looses arrows or bolts, which fly across the ground
// and hit the first creatures they touch. A signature weapon is dropped only by one boss and has its own effect (SIG below), whether it is swung or shot.

let heroShots = [];                                                     // the arrows and bolts in the air

// where a shot leaves: the bow's hand, or the tip of the staff, taken from the pose the hero is in right now
function shotOrigin(sw, f) {
  const p = hero.attackT > 0 ? clamp01(1 - hero.attackT / hero.attackDur) : 0.5;
  const J = poseStick(hero.x, hero.y, f, { p: 0, run: false, lean: 0.02, breath: 0, atk: p, tuck: false, kind: sw.kind, variant: hero.attackVar | 0 });
  const h = J.front.e;
  if (sw.kind === 'staff') return { x: h.x + f * Math.cos(J.blade) * sw.len, y: h.y + Math.sin(J.blade) * sw.len };
  return { x: h.x + f * 12, y: h.y };
}
// the nearest creature ahead of you decides where a shot is aimed (so it flies into the lane it is in); with nothing ahead it goes straight
function shotAim(f) {
  let best = null, bd = 1e9;
  for (const m of enemies) {
    if (m.untouchable || m.hp <= 0) continue;
    const dx = m.x - hero.x, dy = m.y - hero.y;
    if (dx * f < -12 || Math.abs(dx) > 700 || Math.abs(dy) > 230) continue;
    const d = Math.abs(dx) + Math.abs(dy) * 1.6; if (d < bd) { bd = d; best = { dx, dy }; }
  }
  if (!best) return { x: f, y: 0 };
  const l = Math.hypot(best.dx, best.dy) || 1; let ux = best.dx / l, uy = best.dy / l;
  if (Math.abs(uy) > 0.5) { uy = Math.sign(uy) * 0.5; ux = f * Math.sqrt(0.75); }                 // never straight up or down the screen
  return { x: ux, y: uy };
}
function fireShots(VAR) {
  const sw = hero.sword, K = weaponKind(sw), f = hero.facing, o = shotOrigin(sw, f), aim = shotAim(f), item = hero.equip.weapon;
  const n = VAR.ring || VAR.count || 1, base = Math.atan2(aim.y, aim.x), sp = VAR.speed || sw.shot || 560, life = VAR.life || (sw.range / sp) * (VAR.reach || 1);
  for (let i = 0; i < n; i++) {
    const a = VAR.ring ? (i / n) * Math.PI * 2 + 0.2 : base + (n > 1 ? (i / (n - 1) - 0.5) * 2 * (VAR.spread || 0.1) : 0);
    const vx = Math.cos(a), vy = Math.sin(a) * (VAR.ring ? 0.62 : 1);
    const crit = Math.random() < critChance() + (sw.critBonus || 0);
    const dmg = dev.oneHit ? 99999 : Math.max(1, Math.round(swordDmg() * (VAR.dmg || 1) * (crit ? critMult() : 1)));
    heroShots.push({ x: o.x, y: hero.y, z: Math.max(14, hero.y - o.y), vx: vx * sp, vy: vy * sp, life, dmg, crit, pierce: (VAR.pierce || 0) + (sw.pierce || 0), hit: new Set(), kind: K.ranged, color: sw.color, sw, item, trail: [], ring: !!VAR.ring });
  }
  sfx(K.ranged === 'arrow' ? 'arrow' : VAR.ring ? 'boom' : 'sparkle');
  if (VAR.shake) shake(VAR.shake);
  if (gfx.particles) burst(o.x, o.y, sw.color, 5, 70, 2, 0, true);
}
function updateHeroShots(dt) {
  if (!heroShots.length) return;
  for (const s of heroShots) {
    const steps = Math.max(1, Math.ceil(Math.hypot(s.vx, s.vy) * dt / 10));
    for (let k = 0; k < steps && s.life > 0; k++) {
      s.x += s.vx * dt / steps; s.y += s.vy * dt / steps;
      if (dun && dunSolidAt(s.x, s.y, 0)) { s.life = 0; break; }                          // a wall stops it
      for (const m of enemies) {
        if (s.hit.has(m) || m.untouchable || m.hp <= 0) continue;
        if (Math.abs(m.x - s.x) < m.r + 7 && Math.abs(m.y - s.y) < 14 + m.r * 0.55) {
          s.hit.add(m); shotHit(s, m);
          if (s.pierce-- <= 0) { s.life = 0; break; }
        }
      }
    }
    s.life -= dt; s.trail.push({ x: s.x, y: s.y - s.z }); if (s.trail.length > 7) s.trail.shift();
    if (s.x < 0 || s.x > WW || s.y < 20 || s.y > WH + 40) s.life = 0;
  }
  heroShots = heroShots.filter(s => s.life > 0);
}
function shotHit(s, m) {
  const sw = s.sw, dir = Math.sign(s.vx) || hero.facing, dmg = Math.max(1, Math.round(s.dmg * (1 - (m.armor || 0))));
  const hpBefore = m.hp; m.hp -= dmg; if (m.state === 'bones') m.hp = 0; if (m.type === 'bogLurker') m.hits = (m.hits | 0) + 1;
  if (gearHas('lifesteal')) hero.hp = Math.min(hero.maxHp, hero.hp + Math.min(dmg, hpBefore) * 0.04);
  if (sw.lifesteal) hero.hp = Math.min(hero.maxHp, hero.hp + Math.min(dmg, hpBefore) * sw.lifesteal);
  m.flashT = 0.15; mobHurt(m);
  if (!m.noKnock) m.knockX = dir * (m.type === 'boss' ? 40 : m.type === 'ogre' ? 90 : 240);
  if (sw.burn) m.burnT = 3;
  if (sw.slow) m.slowT = 2.5;
  applyWeaponFx(m, s.item, dir);
  if (m.state === 'windup' && m.type !== 'boss') { m.state = 'walk'; m.stateT = 0.8; }
  popups.push({ text: s.crit ? `${dmg}!` : `${dmg}`, x: m.x, y: m.y - 80, t: 0.7, color: s.crit ? '#f80' : '#ff0', pop: 0, crit: s.crit });
  burst(m.x, m.y - 35, s.crit ? '#fc6' : s.color, s.crit ? 14 : 7, 200, 2.2, 250, true);
  if (!settings.comfort) hitStop = s.crit ? 0.04 : 0.015; shake(s.crit ? 3 : 1);
  sfx(s.crit ? 'crit' : m.type === 'slime' ? 'squish' : s.kind === 'arrow' ? 'hitPierce' : 'crackle');
  sigHit(sw, m, dmg, dir);
}
function drawHeroShot(s) {
  const x = s.x, y = s.y - s.z, a = Math.atan2(s.vy * 0.55, s.vx), fade = Math.min(1, s.life * 6);
  drawShadow(s.x, s.y, 4, 0.18);
  ctx.save(); ctx.globalAlpha *= fade;
  if (s.kind === 'arrow') {
    ctx.translate(x, y); ctx.rotate(a);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; line(-26, 0, -10, 0);
    ctx.strokeStyle = '#8a6a3c'; ctx.lineWidth = 2; line(-12, 0, 8, 0);
    ctx.fillStyle = s.sw.sig ? s.color : '#dfe6ef'; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(6, -3); ctx.lineTo(6, 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = s.sw.sig ? s.color : '#e8e0c8'; ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-17, -3.5); ctx.lineTo(-14, 0); ctx.lineTo(-17, 3.5); ctx.closePath(); ctx.fill();
  } else {
    const r = s.ring ? 4 : 5.5 + (s.pierce > 0 ? 1 : 0);
    for (let i = 0; i < s.trail.length; i++) { const t = s.trail[i], k = (i + 1) / s.trail.length; ctx.globalAlpha = fade * 0.4 * k; ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(t.x, t.y, r * k * 0.9, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = fade;
    if (gfx.glow) { const g = ctx.createRadialGradient(x, y, 1, x, y, r * 3.2); g.addColorStop(0, withAlpha(s.color, 0.55)); g.addColorStop(1, withAlpha(s.color, 0)); ctx.fillStyle = g; ctx.fillRect(x - r * 3.4, y - r * 3.4, r * 6.8, r * 6.8); }
    ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 1, y - 1, r * 0.45, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- signature weapons: what each boss's weapon does on a hit (melee or shot). Passive numbers (burn, slow, life steal, crit) are in the weapon's data in SWORDS.
const nearEnemies = (m, R, not) => enemies.filter(e => e !== m && e !== not && e.hp > 0 && !e.untouchable && Math.hypot(e.x - m.x, (e.y - m.y) / 0.62) < R);
const SIG = {
  minotaur(sw, m, dmg, dir) {                                           // every third hit shakes the ground and throws creatures back
    hero.sigN = (hero.sigN | 0) + 1; if (hero.sigN % 3) return;
    shake(8); sfx('slam'); burst(m.x, m.y, '#b9a', 18, 200, 3, 100);
    for (const e of nearEnemies(m, 120)) { e.hp -= Math.max(1, Math.round(dmg * 0.5)); e.flashT = 0.12; if (!e.noKnock) e.knockX = Math.sign(e.x - m.x || dir) * 380; popups.push({ text: String(Math.max(1, Math.round(dmg * 0.5))), x: e.x, y: e.y - 70, t: 0.6, color: '#d9a066' }); }
    popups.push({ text: 'Quake!', x: m.x, y: m.y - 100, t: 0.7, color: '#d9a066', small: true });
  },
  goblinKing(sw, m, dmg) {                                              // some of the loot spills out of every blow
    if (Math.random() < 0.22) { dropItem('gold', m.x + (Math.random() - 0.5) * 24, m.y + 8, { amount: Math.max(1, Math.round((GOLD_BASE + wave * GOLD_PER_WAVE) * 0.8)) }); sfx('coin'); }
  },
  slimeQueen(sw, m, dmg) {                                              // sticky: the blow splashes onto whoever stands near
    m.slowT = Math.max(m.slowT || 0, 2.5);
    for (const e of nearEnemies(m, 70)) { e.hp -= Math.max(1, Math.round(dmg * 0.3)); e.slowT = Math.max(e.slowT || 0, 1.5); e.flashT = 0.1; }
    if (gfx.particles) burst(m.x, m.y - 30, '#7fe07f', 6, 120, 2.5, 200);
  },
  lich(sw, m, dmg) {                                                    // a withering mark: the creature walks slower and cracks the next arrow
    m.slowT = Math.max(m.slowT || 0, 1.4); if (gfx.particles) burst(m.x, m.y - 35, '#a6f0b0', 5, 80, 2, -40, true);
  },
  frostTitan(sw, m) {                                                   // one blow in four freezes the creature solid
    if (Math.random() < 0.25 && m.type !== 'boss') { m.stunT = 1.3; m.slowT = Math.max(m.slowT || 0, 2.5); popups.push({ text: 'Frozen', x: m.x, y: m.y - 100, t: 0.8, color: '#bfeaff', small: true }); sfx('chill'); burst(m.x, m.y - 35, '#bfeaff', 12, 160, 2.5, 120, true); }
  },
  magma(sw, m, dmg) {                                                   // a blow in five bursts into flame around the creature
    if (Math.random() < 0.2) {
      sfx('lava'); shake(4); burst(m.x, m.y - 20, '#ff7a2a', 18, 220, 3, 60, true);
      for (const e of nearEnemies(m, 90)) { e.hp -= Math.max(1, Math.round(dmg * 0.6)); e.burnT = 3; e.flashT = 0.12; }
      popups.push({ text: 'Burst!', x: m.x, y: m.y - 100, t: 0.7, color: '#ff7a2a', small: true });
    }
  },
  pharaoh(sw, m) {                                                      // a cloud of sand follows every cut
    if (gfx.particles) burst(m.x, m.y - 30, '#e6cf9c', 8, 130, 2.5, 90);
  },
  stormWarden(sw, m, dmg) {                                             // lightning jumps to the two nearest creatures
    const t = nearEnemies(m, 170).sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y)).slice(0, 2);
    if (!t.length) return;
    sfx('thunder'); ctxFlashBolts(m, t);
    for (const e of t) { e.hp -= Math.max(1, Math.round(dmg * 0.5)); e.flashT = 0.12; popups.push({ text: String(Math.max(1, Math.round(dmg * 0.5))), x: e.x, y: e.y - 70, t: 0.6, color: '#fff3a0' }); }
  },
};
function ctxFlashBolts(a, list) {                                       // a few bright sparks along each jump
  if (!gfx.particles) return;
  for (const b of list) for (let i = 0; i < 8; i++) { const k = i / 7; particles.push({ x: a.x + (b.x - a.x) * k, y: a.y - 35 + (b.y - a.y) * k + (Math.random() - 0.5) * 12, vx: 0, vy: -10, life: 0.3, max: 0.3, size: 2.4, color: '#fff3a0', add: true }); }
}
function sigHit(sw, m, dmg, dir) { const f = sw && sw.sig && SIG[sw.sig]; if (f) f(sw, m, dmg, dir); }
