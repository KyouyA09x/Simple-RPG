// Monster variants: mutations (one affix on an ordinary monster) and elites (a named, tougher monster with two of them).
// A monster that carries a mutation shows it: a coloured ring under its feet and a little tag over its health bar.
// Poison is the hero's side of "Mutated": a damage-over-time that ignores damage reduction and simply wears off.

const MUTATIONS = {
  mutated:  { name: 'Mutated',  color: '#6fe36f', title: 'the Blighted',      info: 'Its attacks poison you' },
  armored:  { name: 'Armored',  color: '#9fb4c8', title: 'Ironhide',          info: 'Takes 40% less damage, 20% slower' },
  swift:    { name: 'Swift',    color: '#5fe0ff', title: 'the Swift',         info: '35% faster, 25% less health' },
  frenzied: { name: 'Frenzied', color: '#ff5a5a', title: 'the Raging',        info: '50% faster and stronger below 30% health' },
  giant:    { name: 'Giant',    color: '#ffb35a', title: 'the Colossal',      info: 'Twice the size, 2.5x the health, cannot be knocked back' },
  vampiric: { name: 'Vampiric', color: '#c77dff', title: 'the Bloodthirsty',  info: 'Heals for 25% of the damage it deals' },
};
const MUT_KEYS = Object.keys(MUTATIONS);
const ELITE_FIRST = ['Grukk', 'Snarl', 'Mog', 'Vex', 'Skrit', 'Brakka', 'Ulf', 'Zarn', 'Dross', 'Keth', 'Morgul', 'Nib'];
const ELITE_HP = 4, ELITE_DMG = 1.6, ELITE_XP = 3, ELITE_GOLD = 3, ELITE_GEAR_CHANCE = 0.12;
const POISON_STACKS = 3, POISON_TIME = 5;
const poisonDps = () => Math.round(3 + wave * 0.35);              // per stack, per second; ignores damage reduction

// chance that an ordinary monster is born mutated: none in the first waves, then it climbs with every boss beaten
const mutChance = () => wave < 3 ? 0 : Math.min(0.5, 0.05 + 0.07 * tierOf(wave) + wave * 0.002);

// which mutations suit which monster
function mutationsFor(type) {
  return MUT_KEYS.filter(k => !(k === 'giant' && type === 'archer') && !(k === 'swift' && type === 'slime'));
}
function pickMutations(type, n) {
  const pool = mutationsFor(type), out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}
function applyMutation(m, key) {
  m.mut = m.mut || [];
  if (m.mut.includes(key)) return;
  m.mut.push(key);
  if (key === 'mutated') m.poisons = true;
  if (key === 'armored') { m.armor = 0.4; m.speed *= 0.8; }
  if (key === 'swift') { m.speed *= 1.35; m.hp = m.maxHp = Math.max(1, Math.round(m.maxHp * 0.75)); }
  if (key === 'frenzied') m.frenzy = true;
  if (key === 'giant') { m.hp = m.maxHp = Math.round(m.maxHp * 2.5); m.r = Math.round(m.r * 1.6); m.scale = 1.7; m.noKnock = true; m.speed *= 0.8; }
  if (key === 'vampiric') m.vamp = 0.25;
}
function makeElite(m) {
  m.elite = true;
  m.hp = m.maxHp = Math.round(m.maxHp * ELITE_HP);
  m.dmg = Math.round(m.dmg * ELITE_DMG);
  m.xp = Math.round(m.xp * ELITE_XP);
  const keys = pickMutations(m.type, 2);
  for (const k of keys) applyMutation(m, k);
  m.name = `${ELITE_FIRST[Math.floor(Math.random() * ELITE_FIRST.length)]} ${MUTATIONS[keys[0]].title}`;
}
// called once for every monster that spawns (after its normal stats are set). Elites only come when asked for (see buildWave).
function rollVariant(m, force) {
  if ((m.size ?? 1) < 1 || m.type === 'boss') return;
  if (force === 'elite') { makeElite(m); return; }
  if (force === 'plain' || Math.random() >= mutChance()) return;
  const n = tierOf(wave) >= 4 && Math.random() < 0.15 ? 2 : 1;
  for (const k of pickMutations(m.type, n)) applyMutation(m, k);
}

// ---------------------------------------------------------------- the hero's poison
function addPoison(src) {
  if (!hero || hero.dead) return;
  const p = hero.poison || (hero.poison = { stacks: 0, t: 0, pop: 0 });
  p.stacks = Math.min(POISON_STACKS, p.stacks + 1); p.t = POISON_TIME;
  sfx('poison'); popups.push({ text: `Poisoned ×${p.stacks}`, x: hero.x, y: hero.y - 90, t: 0.9, color: '#6fe36f' });
}
function clearPoison() { if (hero) { hero.poison = null; hero.ail = {}; } }          // clears every ailment

// ---------------------------------------------------------------- the other ailments (#15): bleed, burn, freeze, weaken, blind, curse. A Healing Potion cures every one of them.
const AILS = {
  bleed:  { name: 'Bleeding', color: '#e0405a', time: 6, stacks: 3, info: 'Loses health for a while' },
  burn:   { name: 'Burning',  color: '#ff8a30', time: 4, info: 'Loses health quickly' },
  freeze: { name: 'Frozen',   color: '#9fe4ff', time: 1.1, info: 'Cannot move or attack for a moment' },
  weak:   { name: 'Weakened', color: '#c9a86a', time: 9, info: 'Deals 30% less damage' },
  blind:  { name: 'Blinded',  color: '#d6d6e6', time: 6, info: 'Can only see what is close' },
  curse:  { name: 'Cursed',   color: '#b06aff', time: 10, info: 'Heals half as much and does not regenerate' },
};
const AIL_KEYS = Object.keys(AILS);
let ailChance = 1;                                                              // 0 to 1: how often hits cause ailments (the tests turn it off)
const ailT = k => (hero && hero.ail && hero.ail[k] && hero.ail[k].t > 0) ? hero.ail[k].t : 0;
function addAilment(kind, t) {
  if (!hero || hero.dead || dev.god || !AILS[kind]) return;
  if (kind === 'freeze' && (hero.freezeImm || 0) > 0) return;                  // just thawed: not frozen again at once
  const A = AILS[kind], ail = hero.ail || (hero.ail = {}), a = ail[kind] || (ail[kind] = { t: 0, stacks: 0, pop: 0, max: 1 });
  a.stacks = A.stacks ? Math.min(A.stacks, a.stacks + 1) : 1; a.t = Math.max(a.t, t || A.time); a.max = a.t;
  popups.push({ text: A.name + (a.stacks > 1 ? ` ×${a.stacks}` : ''), x: hero.x, y: hero.y - 92, t: 0.9, color: A.color });
  sfx(kind === 'burn' ? 'lava' : kind === 'freeze' ? 'chill' : kind === 'curse' ? 'runeFail' : kind === 'blind' ? 'whoosh' : 'poison');
}
const AIL_ON_HIT = { goblin: ['bleed', 0.16], minotaur: ['bleed', 0.14], ogre: ['weak', 0.22], slime: ['weak', 0.08], archer: ['curse', 0.07],
  wolf: ['bleed', 0.2], panther: ['bleed', 0.22], scorpion: ['blind', 0.25], fireimp: ['burn', 0.3], skeleton: ['curse', 0.1], harpy: ['weak', 0.25],
  treant: ['weak', 0.15], mummy: ['blind', 0.2], frostwolf: ['chill', 0.25], magmaslime: ['burn', 0.25], wisp: ['curse', 0.35], cursedKnight: ['curse', 0.2], golem: ['weak', 0.2] };       // what a creature's hit can do to you
const AIL_BIOME = { volcano: ['burn', 0.12], snow: ['freeze', 0.06], desert: ['blind', 0.10], ruins: ['curse', 0.10], jungle: ['bleed', 0.10], highlands: ['weak', 0.10] };
function rollAilment(src) {
  if (!hero || hero.dead || !src) return;
  const ramp = (wave < 10 ? 0.5 : 1) * ailChance * (src.evo ? 2 : 1);                // an evolved creature's ailments are twice as likely                                             // the first set is gentle
  if (src.type === 'boss') { if (src.def && src.def.ail && Math.random() < 0.3 * ailChance) addAilment(src.def.ail); return; }
  const a = AIL_ON_HIT[src.type]; if (a && Math.random() < a[1] * ramp) { if (a[0] === 'chill') { hero.chillT = 2.5; popups.push({ text: 'Chilled', x: hero.x, y: hero.y - 90, t: 0.9, color: '#6fd0ff' }); } else addAilment(a[0]); }
  const b = AIL_BIOME[BIOMES[zone % BIOMES.length].key]; if (b && Math.random() < b[1] * ramp) addAilment(b[0]);
}
// ticks the ailments; true when one of them killed the hero
function tickAilments(dt) {
  hero.freezeImm = Math.max(0, (hero.freezeImm || 0) - dt);
  const A = hero.ail; if (!A) return false;
  for (const k of Object.keys(A)) { A[k].t -= dt; if (A[k].t <= 0) { delete A[k]; if (k === 'freeze') hero.freezeImm = 3; } }
  let dps = 0;
  if (A.bleed) dps += Math.max(1, hero.maxHp * 0.012) * A.bleed.stacks;
  if (A.burn) dps += Math.max(1, hero.maxHp * 0.02);
  if (A.curse || A.bleed) hero.hpRegenT = Math.max(hero.hpRegenT || 0, 0.5);
  if (dps > 0 && !dev.god) {
    hero.hp = Math.max(0, hero.hp - dps * dt);
    const a = A.burn || A.bleed; a.pop = (a.pop || 0) + dt;
    if (a.pop >= 1) { a.pop = 0; popups.push({ text: `-${Math.round(dps)}`, x: hero.x + 14, y: hero.y - 72, t: 0.7, color: A.burn ? '#ff9a50' : '#ff6a7a', small: true }); }
    if (gfx.particles && Math.random() < dt * 9) particles.push({ x: hero.x + (Math.random() - 0.5) * 16, y: hero.y - 20 - Math.random() * 40, vx: 0, vy: A.burn ? -50 : 20, life: 0.6, max: 0.6, size: 2.2, color: A.burn ? '#ff8a30' : '#e0405a', add: !!A.burn });
  }
  return hero.hp <= 0;
}
// returns true if the poison killed the hero
function tickPoison(dt) {
  const p = hero.poison; if (!p) return false;
  p.t -= dt;
  if (p.t <= 0) { hero.poison = null; return false; }
  if (dev.god) return false;
  const dps = poisonDps() * p.stacks;
  hero.hp = Math.max(0, hero.hp - dps * dt);                           // straight to health: no damage reduction, no i-frames
  hero.hpRegenT = Math.max(hero.hpRegenT || 0, 2);                      // and natural regeneration stops while you are poisoned (plus two seconds)
  p.pop += dt;
  if (p.pop >= 1) { p.pop -= 1; popups.push({ text: `-${dps}`, x: hero.x + 14, y: hero.y - 72, t: 0.7, color: '#7fe07f', small: true }); }
  if (gfx.particles && Math.random() < dt * 8) particles.push({ x: hero.x + (Math.random() - 0.5) * 16, y: hero.y - 20 - Math.random() * 40, vx: 0, vy: -30, life: 0.7, max: 0.7, size: 2.2, color: '#6fe36f', add: true });
  return hero.hp <= 0;
}

// ---------------------------------------------------------------- how a variant looks
const TELL_Y = { goblin: 64, minotaur: 108, slime: 52, archer: 80, ogre: 138, wolf: 50, panther: 60, scorpion: 48, icesprite: 74, fireimp: 66, bogLurker: 72, skeleton: 62, harpy: 88,
  treant: 100, mummy: 60, frostwolf: 52, magmaslime: 44, wisp: 50, sporeshroom: 56, cursedKnight: 72, golem: 104 };
function drawVariantTells(m) {
  if (!m.mut || !m.mut.length || m.dieT !== undefined) return;
  const x = m.x, y = m.y, sc = m.scale || 1, rr = (16 + (m.r || 12) * 0.55) / (m.scale ? sc * 0.8 : 1), t = tAnim;
  ctx.save();
  const cols = m.mut.map(k => MUTATIONS[k].color);
  cols.forEach((c, i) => {                                                  // a ring per mutation under the feet (elites: two, spinning)
    ctx.strokeStyle = c; ctx.lineWidth = 2.2; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.ellipse(x, y + 2, rr + i * 5, (rr + i * 5) * 0.32, 0, 0, Math.PI * 2); ctx.stroke();
    if (gfx.glow) { const g = ctx.createRadialGradient(x, y, 2, x, y, rr + 14); g.addColorStop(0, withAlpha(c, 0.28)); g.addColorStop(1, withAlpha(c, 0)); ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rr + 14, (rr + 14) * 0.4, 0, 0, Math.PI * 2); ctx.fill(); }
  });
  ctx.globalAlpha = 1;
  if (m.elite) {                                                           // elites: a golden collar of sparks that circles the feet
    ctx.fillStyle = '#ffd24a';
    for (let i = 0; i < 6; i++) { const a = t * 2 + i * 1.047; ctx.fillRect(x + Math.cos(a) * (rr + 8) - 1.5, y + 2 + Math.sin(a) * (rr + 8) * 0.32 - 1.5, 3, 3); }
  }
  const top = y - (TELL_Y[m.type] || 70) * sc - 10;                              // tags above the health bar
  ctx.font = 'bold 10px "Segoe UI", sans-serif'; ctx.textAlign = 'center';
  if (m.elite) { ctx.fillStyle = '#ffd24a'; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 3; ctx.strokeText(m.name, x, top - 12); ctx.fillText(m.name, x, top - 12); }
  let tx = x - (m.mut.length - 1) * 21;
  for (const k of m.mut) { ctx.fillStyle = 'rgba(10,10,16,0.75)'; ctx.beginPath(); ctx.roundRect(tx - 20, top - 10, 40, 11, 5); ctx.fill(); ctx.strokeStyle = MUTATIONS[k].color; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = MUTATIONS[k].color; ctx.fillText(MUTATIONS[k].name, tx, top - 1.5); tx += 42; }
  ctx.restore();
}
