// Rebirth: when you reach the level cap, the shrine keeper in the village can send you back to level 1 for permanent bonuses.
// Every number the rest of the game needs about rebirth lives here, so tuning it is one table.
// hero.rebirth is how many times you have done it. Level cap: 15, then +5 per rebirth (15, 20, 25...).
// Kept: Mythical and Secret gear, lanterns, every bonus below. Lost: level, spent stats, gold, potions, all other gear. Wave goes back to 1.

const REBIRTH = {
  capBase: 15, capStep: 5,
  dmg: 0.025, hp: 0.025,                 // percent of your damage / max health, per rebirth
  dodge: 0.0025, dodgeCap: 0.12,         // a rebirth-only stat: it is not on the Character screen and never comes from levelling
  xp: 0.10,                              // more XP from everything
  goldFirst: 0.20, gold: 0.10,           // more gold: 20% for the first rebirth, 10% for each one after
  startPoints: 2,                        // stat points you begin the next life with
  slots: 2, slotsMax: 60,                // backpack slots
  luck: 0.04, luckMax: 2,                // gear drop chance multiplier (potions are not affected)
  rarity: 0.01, rarityMax: 0.25,         // push towards higher grades (Rare gets 1 x this, Polished 2 x, Legendary 3 x, Mythical 4 x on top of its odds)
  ringAt: 5, swapAt: 10, pointAt: 15,    // milestones: a third ring, a spare weapon slot, +1 stat point on every level
};
const rebirths = () => (typeof hero !== 'undefined' && hero && hero.rebirth) | 0;
const levelCap = (r = rebirths()) => REBIRTH.capBase + REBIRTH.capStep * r;
const rbDmgMul = (r = rebirths()) => 1 + REBIRTH.dmg * r;
const rbXpMul = (r = rebirths()) => 1 + REBIRTH.xp * r;
const rbGoldMul = (r = rebirths()) => r <= 0 ? 1 : 1 + REBIRTH.goldFirst + REBIRTH.gold * (r - 1);
const dodgeChance = (r = rebirths()) => Math.min(REBIRTH.dodgeCap, REBIRTH.dodge * r);
const rbStartPoints = (r = rebirths()) => REBIRTH.startPoints * r;
const pointsPerLevel = (r = rebirths()) => POINTS_PER_LEVEL + (r >= REBIRTH.pointAt ? 1 : 0);
const invSlotsFor = (r = rebirths()) => Math.min(REBIRTH.slotsMax, 24 + REBIRTH.slots * r);
const dropLuck = (r = rebirths()) => Math.min(REBIRTH.luckMax, 1 + REBIRTH.luck * r);
const rarityLuck = (r = rebirths()) => Math.min(REBIRTH.rarityMax, REBIRTH.rarity * r);
// Level stats are a small edge. The single Critical stat (crit rate and crit damage together) is hard-capped at 10 points and never grows with rebirth; what grows is how many
// points Vitality and Strength can take (20 at first, +4 per rebirth, at most 80). Gear is still the build.
const CRIT_POINTS_MAX = 10, drCap = () => 0.10, speedCap = () => 0.06;
const vitMax = (r = rebirths()) => Math.min(80, 20 + 4 * r);
const strMax = (r = rebirths()) => Math.min(80, 20 + 4 * r);

function applyRebirthPerks() { INV_MAX = invSlotsFor(); }
// max HP from rebirth is tracked on its own (hero.rbHp), the way gear HP is, so it follows every change to the base
function syncRebirthHp() {
  if (typeof hero === 'undefined' || !hero) return;
  const have = hero.rbHp | 0, base = hero.maxHp - have, want = Math.round(base * REBIRTH.hp * rebirths()), d = want - have;
  if (!d) return;
  hero.maxHp += d; hero.rbHp = want;
  if (d > 0) hero.hp += d;
  hero.hp = Math.min(hero.hp, hero.maxHp);
}

// ---------------------------------------------------------------- what survives
const rebirthKeeps = it => !!it && it.rarity >= 6;                                                  // Mythical and Secret
function keptGear() {
  const worn = {}, bag = [];
  for (const k of activeSlots()) {
    const it = hero.equip[k]; if (!rebirthKeeps(it)) continue;
    if (k === 'weapon' || k === 'weapon2') bag.push(it);                                           // a weapon needs its level again, so it waits in the bag
    else worn[k] = it;
  }
  for (const it of hero.inv) if (rebirthKeeps(it)) bag.push(it);
  return { worn, bag };
}
const rebirthLost = () => {
  const k = keptGear(), keepIds = new Set([...Object.values(k.worn), ...k.bag].map(i => i.id));
  const all = [...activeSlots().map(s => hero.equip[s]), ...hero.inv].filter(Boolean);
  return all.filter(i => !keepIds.has(i.id) && !(i.slot === 'weapon' && i.base === 'wood' && !i.stats.dmg && i.rarity === 1 && Object.keys(i.stats).length === 0));
};

function doRebirth() {
  if (!hero || state !== 'village' || hero.dead || hero.level < levelCap()) return false;
  const { worn, bag } = keptGear(), next = rebirths() + 1;
  hero.rebirth = next; applyRebirthPerks();
  hero.level = 1; hero.xp = 0; hero.xpNext = xpNeed(1); hero.stats = newStats(); hero.points = rbStartPoints(next);
  hero.gold = 0; hero.potions = 0; hero.cures = 0; hero.potionSel = 'heal'; hero.maxHp = 100; hero.rbHp = 0; hero.gearHp = 0;               // the lantern (hero.lamp) is kept on purpose
  hero.inv = bag.slice(0, INV_MAX);
  hero.equip = { weapon: starterWeapon('wood'), armor: null, helmet: null, ring1: null, ring2: null, necklace: null, ring3: null, weapon2: null, ...worn };
  hero.gear = zeroGear();
  recalcGear();
  hero.hp = hero.maxHp; hero.stamina = maxStamina();
  wave = 0; zone = 0; enemies = []; spawnQueue = [];
  saveGame(true, true);
  loadSlot(currentSlot);                                                                            // start the new life from the save, so what is shown is exactly what was saved
  sfx('rebirth');
  startRebirthFx(next);
  return true;
}

// ---------------------------------------------------------------- the shrine panel (rendered into the shop window)
const pctS = (v, d = 1) => `${+(v * 100).toFixed(d)}%`;
function renderRebirth() {
  const v = vil, R = rebirths(), N = R + 1, cap = levelCap(), ready = hero.level >= cap;
  const row = (k, t) => `<div class="sumrow"><span>${k}</span><b>${t}</b></div>`;
  document.getElementById('shopTitle').textContent = 'THE SHRINE OF RETURN';
  document.getElementById('shopGold').textContent = hero.gold.toLocaleString();
  const { worn, bag } = keptGear(), lost = rebirthLost(), lamp = LAMPS[hero.lamp | 0];
  const keptNames = [...Object.values(worn), ...bag].map(i => `<span style="color:${RARITIES[i.rarity].color}">${escapeHtml(i.name)}</span>`);
  const gains = [
    row('Level cap', `${cap} → ${levelCap(N)}`),
    row('Damage', `+${pctS(REBIRTH.dmg)} (total +${pctS(REBIRTH.dmg * N)})`),
    row('Max health', `+${pctS(REBIRTH.hp)} (total +${pctS(REBIRTH.hp * N)})`),
    row('Dodge', `${pctS(dodgeChance(R), 2)} → ${pctS(dodgeChance(N), 2)} (cap ${pctS(REBIRTH.dodgeCap, 0)})`),
    row('XP gained', `×${rbXpMul(N).toFixed(2)}`),
    row('Gold gained', `×${rbGoldMul(N).toFixed(2)}`),
    row('Starting stat points', `${rbStartPoints(N)}${pointsPerLevel(N) > POINTS_PER_LEVEL ? ` (and ${pointsPerLevel(N)} per level)` : ''}`),
    row('Backpack', `${invSlotsFor(R)} → ${invSlotsFor(N)} slots`),
    row('Gear drop luck', `×${dropLuck(N).toFixed(2)} drop chance · +${pctS(rarityLuck(N))} better grades`),
    row('Vitality and Strength', `each takes up to ${vitMax(N)} points (now ${vitMax(R)})`),
  ];
  if (N === REBIRTH.ringAt) gains.push(row('<span style="color:#fd4">Milestone</span>', 'a third ring slot'));
  if (N === REBIRTH.swapAt) gains.push(row('<span style="color:#fd4">Milestone</span>', 'a spare weapon slot (press X to swap)'));
  if (N === REBIRTH.pointAt) gains.push(row('<span style="color:#fd4">Milestone</span>', '+1 stat point on every level'));
  const armed = !!v.rbArm;
  let html = `<div class="hint" style="margin-top:0">${R ? `You have been reborn ${R} time${R === 1 ? '' : 's'}.` : 'You have never been reborn.'} At level ${cap} the shrine can send you back to level 1 in return for permanent strength. It is the one thing in this game that cannot be undone.</div>`;
  html += `<h3>Requirement</h3><div class="summary">${row('Level', `<span style="color:${ready ? '#7fd08a' : '#f88'}">${hero.level} / ${cap}</span>`)}</div>`;
  let action; if (armed) action = `<div class="item"><div class="im"><b style="color:#f88">Are you sure?</b><small>This cannot be undone. You will be reborn at level 1 with the bonuses above.</small></div><button data-buy="rb:cancel"><kbd>1</kbd>Not yet</button><button data-buy="rb:go" class="danger"><kbd>2</kbd>Yes, be reborn</button></div>`;
  else action = `<div class="item"><div class="im"><b>Begin the rebirth</b><small>${ready ? 'You will be asked once more before anything changes.' : `Reach level ${cap} first. You can still read this at any time.`}</small></div><button data-buy="rb:arm" ${ready ? '' : 'disabled'}><kbd>1</kbd>Begin</button></div>`;
  html += action;
  html += `<h3>You keep</h3><div class="summary">${row('Mythical and Secret gear', keptNames.length ? keptNames.join(', ') : 'none right now')}${row('Lantern', escapeHtml(lamp ? lamp.name : 'none'))}${row('Rebirth bonuses', 'all of them')}${row('Backpack slots', 'all unlocked ones')}</div>`;
  html += `<h3>You lose</h3><div class="summary">${row('Level and stat points', `level ${hero.level} → 1`)}${row('Gold', hero.gold.toLocaleString())}${row('Potions', String((hero.potions | 0) + (hero.cures | 0)))}${row('Other gear', `${lost.length} piece${lost.length === 1 ? '' : 's'}`)}${row('Progress', `wave ${wave} → 1, back to the first land`)}</div>`;
  html += `<div class="hint">Gear and gold are both lost, so spend your gold and sell what you do not need before you begin.</div>`;
  html += `<h3>You gain (rebirth ${N})</h3><div class="summary">${gains.join('')}</div>`;
  document.getElementById('shopBody').innerHTML = html;
}
function rebirthClick(id) {
  const v = vil; if (!v) return;
  if (id === 'rb:arm' && hero.level >= levelCap()) { v.rbArm = true; sfx('click'); }
  else if (id === 'rb:cancel') { v.rbArm = false; sfx('click'); }
  else if (id === 'rb:go') { v.rbArm = false; if (!doRebirth()) { sfx('tired'); renderShop(); } return; }
  renderShop();
}

// ---------------------------------------------------------------- the rebirth transition (plays over the freshly loaded new life; the game stands still until it ends)
//   0-1.6s  the shrine's light floods the screen
//   1-3.6s  motes of light spiral in and the hero is drawn out of them
//   2.2s    REBIRTH n, and a line about the shrine
//   3.8-7s  what the return gave
//   7-9s    the light fades and the world is there
const RB_LEN = 9, RB_FADE_AT = 7;
const RB_LINES = [
  'The Shrine remembers what you cannot.',
  'Each return, the road knows you a little better.',
  'Whatever fell in the Hollow is still listening.',
  'You are not the first to come back. You may be the last.',
  'Some things are only lost so they can be found again.',
];
let rebirthFx = null;
function startRebirthFx(n) {
  const R = n;
  const rows = [
    ['Level cap', `${levelCap(R)}`],
    ['Damage', `+${+(REBIRTH.dmg * R * 100).toFixed(1)}%`],
    ['Max health', `+${+(REBIRTH.hp * R * 100).toFixed(1)}%`],
    ['Dodge', `${+(dodgeChance(R) * 100).toFixed(2)}%`],
    ['Stat points to spend', `${rbStartPoints(R)}`],
  ];
  rebirthFx = { t: 0, n, rows, line: RB_LINES[(n - 1) % RB_LINES.length], cues: {} };
}
function updateRebirthFx(dt) {
  const fx = rebirthFx; if (!fx) return;
  fx.t += dt;
  if (!fx.cues.a && fx.t > 2.2) { fx.cues.a = true; sfx('levelup'); }
  if (!fx.cues.b && fx.t > 3.8) { fx.cues.b = true; sfx('unlock'); }
  if (fx.t >= RB_LEN) {
    rebirthFx = null;
    popups.push({ text: `${hero.points} stat points to spend (M)`, x: VW / 2, y: 190, t: 3, screen: true, small: true, color: '#fd4' });
  }
}
function skipRebirthFx() { if (rebirthFx && rebirthFx.t < RB_FADE_AT && rebirthFx.t > 1.5) { rebirthFx.t = RB_FADE_AT; return true; } return !!rebirthFx; }
function drawRebirthFx() {
  const fx = rebirthFx; if (!fx) return;
  const t = fx.t, cx = VW / 2, cy = VH * 0.5, out = 1 - ssm(RB_FADE_AT, RB_LEN, t), glow = gfx.glow;
  ctx.save();
  // the backdrop: deep violet night with slow beams of light from the middle
  ctx.globalAlpha = out;
  const bg = ctx.createRadialGradient(cx, cy, 20, cx, cy, VH * 0.95);
  bg.addColorStop(0, '#2a1850'); bg.addColorStop(0.6, '#10091f'); bg.addColorStop(1, '#05030a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, VW, VH);
  for (let i = 0; i < 60; i++) { ctx.globalAlpha = out * (0.2 + 0.5 * Math.abs(Math.sin(t * 1.4 + i))); ctx.fillStyle = '#d9ccff'; ctx.fillRect((i * 211) % VW, (i * 97) % VH, 1.5, 1.5); }
  ctx.globalCompositeOperation = glow ? 'lighter' : 'source-over';
  const beams = 12, spin = t * 0.18, strength = ssm(0.6, 2.4, t) * 0.16;
  for (let i = 0; i < beams; i++) {
    const a = spin + i * Math.PI * 2 / beams, w = 0.07;
    ctx.globalAlpha = out * strength * (0.6 + 0.4 * Math.sin(t * 2 + i * 1.7));
    ctx.fillStyle = '#c9b8ff'; ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a - w) * VW, cy + Math.sin(a - w) * VW); ctx.lineTo(cx + Math.cos(a + w) * VW, cy + Math.sin(a + w) * VW); ctx.closePath(); ctx.fill();
  }
  // motes spiral in toward the hero
  const gather = ssm(0.9, 3.4, t);
  for (let i = 0; i < 90; i++) {
    const seed = i * 12.9898, ang0 = (Math.sin(seed) * 43758.5453 % 1) * Math.PI * 2, r0 = 160 + ((Math.sin(seed * 1.7) * 9731.3) % 1 + 1) % 1 * 520;
    const k = Math.min(1, gather * 1.1 + (i % 9) * 0.01), r = r0 * (1 - k) + 6, ang = ang0 + k * 5.5 + t * 0.4;
    const mx = cx + Math.cos(ang) * r, my = cy - 40 + Math.sin(ang) * r * 0.62;
    ctx.globalAlpha = out * Math.min(1, t * 1.5) * (1 - Math.max(0, k - 0.85) * 5) * 0.9;
    ctx.fillStyle = i % 3 ? '#e8dcff' : '#ffe39a'; ctx.fillRect(mx, my, 2.4, 2.4);
  }
  ctx.globalCompositeOperation = 'source-over';
  // the hero, drawn out of the light
  const hp = ssm(2.0, 3.8, t);
  if (hp > 0) {
    ctx.globalAlpha = out * hp;
    if (glow) { const hg = ctx.createRadialGradient(cx, cy - 20, 0, cx, cy - 20, 150); hg.addColorStop(0, 'rgba(235,225,255,0.55)'); hg.addColorStop(1, 'rgba(235,225,255,0)'); ctx.fillStyle = hg; ctx.fillRect(cx - 160, cy - 180, 320, 320); }
    stickSilhouette(cx, cy + 62, 0, 2.3, false, '#f6f0ff');
  }
  // the first flash and the ring that leaves the shrine
  const flash = 1 - ssm(0, 1.6, t);
  if (flash > 0) { ctx.globalAlpha = flash; ctx.fillStyle = '#f2ecff'; ctx.fillRect(0, 0, VW, VH); }
  const ringT = ssm(0.05, 1.7, t);
  if (ringT > 0 && ringT < 1) { ctx.globalAlpha = (1 - ringT) * 0.9; ctx.strokeStyle = '#fff'; ctx.lineWidth = 6 * (1 - ringT) + 1; ctx.beginPath(); ctx.arc(cx, cy, ringT * VW * 0.75, 0, Math.PI * 2); ctx.stroke(); }
  // REBIRTH n
  ctx.textAlign = 'center';
  const ta = ssm(2.2, 3.0, t) * out;
  if (ta > 0) {
    ctx.globalAlpha = ta; ctx.font = 'bold 60px Georgia, serif';
    if (glow) { ctx.shadowColor = '#b8a0ff'; ctx.shadowBlur = 26; }
    ctx.fillStyle = '#f4efff'; ctx.fillText(`REBIRTH ${fx.n}`, cx, VH * 0.2);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = ssm(2.8, 3.6, t) * out; ctx.font = 'italic 19px Georgia, serif'; ctx.fillStyle = '#cfc4ee'; ctx.fillText(fx.line, cx, VH * 0.2 + 36);
  }
  // what the return gave
  fx.rows.forEach(([k, v], i) => {
    const a = ssm(3.9 + i * 0.5, 4.5 + i * 0.5, t) * out; if (a <= 0) return;
    const y = VH * 0.74 + i * 26 - (fx.rows.length - 1) * 13 + 14, slide = (1 - ssm(3.9 + i * 0.5, 4.5 + i * 0.5, t)) * 18;
    ctx.globalAlpha = a; ctx.font = '16px "Segoe UI", sans-serif'; ctx.textAlign = 'right'; ctx.fillStyle = '#b9afd8'; ctx.fillText(k, cx - 14 - slide, y);
    ctx.textAlign = 'left'; ctx.font = 'bold 17px "Segoe UI", sans-serif'; ctx.fillStyle = '#fff3c0'; ctx.fillText(v, cx + 14 + slide, y);
  });
  ctx.textAlign = 'center'; ctx.globalAlpha = out * 0.5 * ssm(2, 3, t); ctx.font = '12px sans-serif'; ctx.fillStyle = '#fff';
  if (t < RB_FADE_AT) ctx.fillText('Press any key to continue', cx, VH - 16);
  ctx.restore(); ctx.textAlign = 'left';
}
