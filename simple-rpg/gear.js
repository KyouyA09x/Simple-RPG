// Gear and inventory: seven equipment slots (the Artifact is the seventh), a 24-slot backpack, eight rarity grades with stat
// ranges, drops from monsters, an inventory screen (key I) and selling to the blacksmith.
// Level stats are not touched here: gear adds on top of them, under hard caps.
// Game code reads gear through hero.gear (a plain sum, rebuilt by recalcGear() whenever equipment changes).

let INV_MAX = 24;                                                                   // rebirth adds slots (see rebirth.js)
const GEAR_SLOTS = ['weapon', 'armor', 'helmet', 'ring1', 'ring2', 'necklace', 'artifact'];     // equipment positions
const ITEM_SLOTS = ['weapon', 'armor', 'helmet', 'ring', 'necklace', 'artifact'];               // what an item can be (a ring fits ring1 or ring2)
const SLOT_LABEL = { weapon: 'Weapon', armor: 'Armor', helmet: 'Helmet', ring1: 'Ring 1', ring2: 'Ring 2', ring3: 'Ring 3', weapon2: 'Weapon 2', ring: 'Ring', necklace: 'Necklace', artifact: 'Artifact' };
// two slots that only exist after rebirth milestones: a third ring (rebirth 5) and a spare weapon to swap to (rebirth 10)
const EXTRA_SLOTS = ['ring3', 'weapon2'];
const slotOpen = k => k === 'ring3' ? rebirths() >= 5 : k === 'weapon2' ? rebirths() >= 10 : true;
const activeSlots = () => [...GEAR_SLOTS, ...EXTRA_SLOTS].filter(slotOpen);

// grade, colour, how many stat lines it rolls, and where in a stat's range (0..1 of its maximum) the roll lands
const RARITIES = [
  { name: 'Broken',    color: '#8a7f77', lines: 1, band: [0.03, 0.09], price: 4, sockets: 0 },
  { name: 'Common',    color: '#d5d5dc', lines: 1, band: [0.09, 0.15], price: 10, sockets: 0 },
  { name: 'Uncommon',  color: '#5fd07a', lines: 2, band: [0.14, 0.21], price: 24, sockets: 1 },
  { name: 'Rare',      color: '#5b9bff', lines: 2, band: [0.21, 0.30], price: 55, sockets: 1 },
  { name: 'Polished',  color: '#c36bff', lines: 3, band: [0.30, 0.40], price: 120, sockets: 2 },
  { name: 'Legendary', color: '#ffa73a', lines: 4, band: [0.37, 0.48], price: 280, sockets: 2 },
  { name: 'Mythical',  color: '#ff4f7a', lines: 4, band: [0.48, 0.60], price: 650, sockets: 3 },
  { name: 'Secret',    color: '#3ff2e0', lines: 5, band: [0.78, 0.92],  price: 1600, sockets: 3 },
];
const RARITY_BASE_W = [18, 32, 27, 14, 7, 0.44, 0.11, 0];          // Secret is never rolled normally (boss pieces only, see rollRarity)
// how fast better grades pile up with depth: slow, and it stops growing after six bosses, so Legendary and Mythical stay rare (about 2% and 0.7% at wave 50)
const RARITY_DEPTH_GROWTH = 1.12, RARITY_DEPTH_CAP = 6;
const SECRET_BOSS_CHANCE = 0.005;                               // per boss piece; rebirth luck barely touches it on purpose (anti-farming)
const GEAR_DROP_CHANCE = 0.045, BOSS_EXTRA_PIECE = [0.25, 0.05];   // per kill; and the chance of a 2nd and a 3rd piece from a boss (bosses drop extra pieces on top of the normal drop)

// every stat a piece can carry: its maximum (what a top-of-the-range Secret roll gives) and how to show it
const pctText = v => `${(v * 100).toFixed(1).replace(/\.0$/, '')}%`;
const GEAR_STATS = {
  dmg:     { name: 'Damage',            max: 50,   int: true, fmt: v => `+${Math.round(v)}` },
  hp:      { name: 'Max HP',            max: 400,  int: true, fmt: v => `+${Math.round(v)}` },
  dr:      { name: 'Damage reduction',  max: 0.20, fmt: v => `+${pctText(v)}` },
  crit:    { name: 'Crit chance',       max: 0.26, fmt: v => `+${pctText(v)}` },
  critDmg: { name: 'Crit damage',       max: 1.0,  fmt: v => `+${v.toFixed(2)}×` },
  speed:   { name: 'Move speed',        max: 0.20, fmt: v => `+${pctText(v)}` },
  cdr:     { name: 'Faster actions',    max: 0.28, fmt: v => `+${pctText(v)}` },      // shorter flip cooldown and swing time
  stamina: { name: 'Max stamina',       max: 110,  int: true, fmt: v => `+${Math.round(v)}` },
  gold:    { name: 'Gold find',         max: 0.45, fmt: v => `+${pctText(v)}` },
  upLuck:  { name: 'Upgrade luck',      max: 0.30, fmt: v => `+${pctText(v)} to succeed` },                // artifacts and runes: more chance for the forge to work
  dropLuck:{ name: 'Drop luck',         max: 0.60, fmt: v => `+${pctText(v)} gear drops` },
  gradeLuck:{ name: 'Grade luck',       max: 0.20, fmt: v => `+${pctText(v)} better grades` },
};
// ---- weapon effects: applied to a weapon at the Enchantress for gold. Damage over time and crowd control on whatever the weapon hits (level I to III).
const WFX = {
  fire:   { name: 'Flame', color: '#ff7a2a', mul: 1.0, blurb: 'Sets enemies alight' },
  poison: { name: 'Venom', color: '#6fe36f', mul: 1.1, blurb: 'Poison that stacks up to three times' },
  bleed:  { name: 'Rend',  color: '#e0405a', mul: 0.9, blurb: 'Deep cuts that keep bleeding' },
  frost:  { name: 'Frost', color: '#8fdcff', mul: 1.0, blurb: 'Slows enemies, and at level III can freeze them' },
  shock:  { name: 'Storm', color: '#fff06a', mul: 1.3, blurb: 'Stuns now and then and arcs to a nearby enemy' },
};
const WFX_KEYS = Object.keys(WFX), WFX_LV = 3, ROMAN = ['', 'I', 'II', 'III'];
const wfxCost = (it, k, lv) => Math.round((90 + (it.value || 20) * 0.9) * [0, 1, 2.6, 5.2][lv] * WFX[k].mul);
function wfxText(k, lv, dmg) {                                                      // what the effect does, in numbers for a weapon that hits for `dmg`
  const d = p => Math.max(1, Math.round(dmg * p));
  switch (k) {
    case 'fire': return `${d(0.08 * lv)} damage every half second for ${3 + lv} seconds (${d(0.08 * lv) * 2 * (3 + lv)} in all)`;
    case 'poison': return `${d(0.07 * lv)} a second for 5 seconds, per stack (up to 3 stacks)`;
    case 'bleed': return `${d(0.06 * lv)} damage every half second for 4 seconds (${d(0.06 * lv) * 8} in all)`;
    case 'frost': return `Slows by half for ${2 + lv} seconds${lv >= 3 ? ', 12% chance to freeze solid for a second' : ''}`;
    case 'shock': return `${10 + 7 * lv}% chance to stun for ${(0.6 + 0.2 * lv).toFixed(1)} seconds, and lightning arcs to a nearby enemy for ${20 * lv}% of the hit`;
  }
  return '';
}
const WFX_PATH = { fire: 'M16 4 C20 10 24 13 24 19 A8 8 0 0 1 8 19 C8 14 11 12 13 8 C14 11 15 12 16 12 Z', poison: 'M16 4 C20 11 25 15 25 20 A9 9 0 0 1 7 20 C7 15 12 11 16 4 Z', bleed: 'M9 6 L23 26 M15 5 L26 21 M5 12 L17 28',
  frost: 'M16 4 V28 M6 10 L26 22 M26 10 L6 22 M12 6 L16 10 L20 6 M12 26 L16 22 L20 26', shock: 'M18 3 L8 18 H15 L12 29 L24 12 H17 Z' };
const wfxSvg = (k, px = 28) => { const W = WFX[k], filled = k === 'fire' || k === 'poison' || k === 'shock'; return `<svg viewBox="0 0 32 32" width="${px}" height="${px}"><path d="${WFX_PATH[k]}" fill="${filled ? W.color : 'none'}" fill-opacity="${filled ? 0.35 : 0}" stroke="${W.color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`; };
// ---- essences: the weapon effects are found, not chosen. Only elites and bosses drop them, nobody buys or sells them, and like runes they can be improved (at a cost and with a risk).
// Flame, Venom, Rend, Frost and Storm in levels I to III. An essence is imbued into a weapon at the Enchantress; the old one comes back to your pouch.
const ESS_MAX = 30, essKey = (k, lv) => k + lv;
const ESS = {};
for (const k of WFX_KEYS) for (let lv = 1; lv <= WFX_LV; lv++) ESS[essKey(k, lv)] = { fx: k, lv, title: `${WFX[k].name} Essence ${ROMAN[lv]}`, color: WFX[k].color };
const ESS_KEYS = Object.keys(ESS);
const essCount = k => (hero && hero.ess && hero.ess[k]) | 0;
const essTotal = () => ESS_KEYS.reduce((a, k) => a + essCount(k), 0);
function addEss(k, n = 1) { if (!ESS[k]) return 0; if (!hero.ess) hero.ess = {}; const before = essCount(k); hero.ess[k] = Math.min(ESS_MAX, before + n); return hero.ess[k] - before; }
const essNext = k => ESS[k] && ESS[k].lv < WFX_LV ? essKey(ESS[k].fx, ESS[k].lv + 1) : null;
const essUpChance = k => !essNext(k) ? 0 : Math.min(0.9, Math.max(0.05, [0.5, 0.28][ESS[k].lv - 1] + gearStat('upLuck') * 0.5));
const essUpCost = k => essNext(k) ? Math.round([0, 0, 520, 1900][ESS[k].lv + 1] * (1 + (typeof wave === 'number' ? wave : 0) * 0.03)) : 0;
const canEssUp = k => !!essNext(k) && essCount(k) >= 1 && essCount(essNext(k)) < ESS_MAX;
function attemptEssUp(k, roll = Math.random()) {                          // 'up', 'down' (a level II falls to I like a failed forge upgrade), 'fail' (a level I stays) or null
  if (!canEssUp(k)) return null;
  hero.ess[k]--;
  if (roll < essUpChance(k)) { addEss(essNext(k)); return 'up'; }
  if (ESS[k].lv === 1) { addEss(k); return 'fail'; }
  addEss(essKey(ESS[k].fx, ESS[k].lv - 1)); return 'down';
}
const imbueFee = (it, k) => Math.round(wfxCost(it, ESS[k].fx, ESS[k].lv) * 0.35);
function imbueWeapon(it, k) {                                             // put an essence into a weapon; whatever was in it comes back to the pouch
  if (!it || it.slot !== 'weapon' || !ESS[k] || essCount(k) < 1) return false;
  const old = it.fx ? essKey(it.fx.k, it.fx.lv) : null;
  hero.ess[k]--; if (old) addEss(old); it.fx = { k: ESS[k].fx, lv: ESS[k].lv }; return true;
}
function stripWeapon(it) { if (!it || !it.fx) return false; addEss(essKey(it.fx.k, it.fx.lv)); delete it.fx; return true; }
const ESS_BIOME = { forest: 'bleed', desert: 'fire', snow: 'frost', volcano: 'fire', swamp: 'poison', jungle: 'bleed', ruins: 'poison', highlands: 'shock' };       // a biome's own creatures carry its kind of essence
function rollEssKey(boost = 1) {
  const home = typeof currentBiomeKey === 'function' ? ESS_BIOME[currentBiomeKey()] : null, k = home && Math.random() < 0.55 ? home : WFX_KEYS[Math.floor(Math.random() * WFX_KEYS.length)];
  const ws = [100, 16 * boost, 2.5 * boost]; let x = Math.random() * ws.reduce((a, c) => a + c, 0), lv = 1;
  for (let i = 0; i < ws.length; i++) if ((x -= ws[i]) <= 0) { lv = i + 1; break; }
  return essKey(k, lv);
}
function essenceDropsFor(m) {                                             // elites now and then, most bosses one; nothing else ever drops them
  const boss = m.type === 'boss'; if (!boss && !m.elite) return [];
  const n = boss ? (Math.random() < 0.4 ? 1 : 0) + (Math.random() < 0.08 ? 1 : 0) : (Math.random() < 0.12 * (1 + gearStat('dropLuck')) ? 1 : 0);
  return Array.from({ length: n }, () => rollEssKey(boss ? 3 : 1.5));
}
const essSvg = (k, px = 34) => { const E = ESS[k], W = WFX[E.fx], pips = Array.from({ length: E.lv }, (_, n) => `<circle cx="${16 + (n - (E.lv - 1) / 2) * 4.2}" cy="32.4" r="1.25" fill="${W.color}"/>`).join('');
  return `<svg viewBox="-3 -3 38 38" width="${px}" height="${px}"><circle cx="16" cy="16" r="14" fill="#1d1a2c" stroke="${W.color}" stroke-width="${1.3 + E.lv * 0.25}"/><circle cx="16" cy="16" r="${9 + E.lv}" fill="${W.color}" opacity="${0.07 + E.lv * 0.04}"/><g transform="translate(4.8 4.8) scale(0.7)">${wfxSvg(E.fx, 32).replace(/<svg[^>]*>|<\/svg>/g, '')}</g>${pips}</svg>`; };
const LUCK_CAPS = { upLuck: 0.35, dropLuck: 1.0, gradeLuck: 0.35 };       // however many artifacts and runes you carry
// absolute ceilings, level stats + gear together. Shown in the UI as "38% (cap 60%)".
const GEAR_CAPS = { dr: 0.45, crit: 0.55, critDmg: 2.5, speed: 0.40 };
const STAT_CEIL = 2.1;                                           // no single stat on a piece, upgrades included, goes past this many times its listed maximum
const ILVL_MAX = 30;
const ilvlMul = ilvl => 0.86 + 0.012 * Math.min(ILVL_MAX, Math.max(1, ilvl));      // an item's level scales its stats: 0.84x at level 1, 1.13x at level 20, 1.28x at level 30 (a higher level is worth hunting for)

// which stats a slot rolls first, and which it can add after that
const SLOT_ROLLS = {
  weapon:   { pri: ['dmg'],        pool: ['crit', 'critDmg', 'cdr', 'stamina', 'gold'] },
  armor:    { pri: ['dr', 'hp'],   pool: ['stamina', 'speed', 'cdr', 'dmg'] },
  helmet:   { pri: ['hp'],         pool: ['dr', 'crit', 'stamina', 'gold', 'cdr'] },
  ring:     { pri: ['crit'],       pool: ['critDmg', 'dmg', 'cdr', 'speed', 'gold', 'hp'] },
  necklace: { pri: ['critDmg'],    pool: ['hp', 'crit', 'dmg', 'stamina', 'gold', 'speed', 'dr'] },
  artifact: { pri: ['upLuck'],     pool: ['dropLuck', 'gradeLuck', 'gold', 'hp', 'dmg', 'stamina', 'cdr'] },       // artifacts are about luck first
};
const UNIQUES = {
  lifesteal: { name: 'Lifesteal',  text: 'Heals you for 4% of the damage you deal.' },
  vigor:     { name: 'Vigor',      text: 'Health regeneration is 2.5× faster.' },
  magnet:    { name: 'Magnet',     text: 'Drops are pulled in from much further away.' },
};

// ---------------------------------------------------------------- names
const BASE_NAMES = {
  armor:    ['Rags', 'Jerkin', 'Leather Vest', 'Chain Shirt', 'Scale Mail', 'Plate Cuirass', 'Dragonhide', 'Aegis'],
  helmet:   ['Cap', 'Hood', 'Leather Cap', 'Iron Helm', 'Great Helm', 'Crowned Helm', 'Horned Helm', 'Warden Helm'],
  ring:     ['Copper Ring', 'Bronze Band', 'Silver Ring', 'Gold Ring', 'Signet', 'Jewelled Ring', 'Rune Band', 'Star Ring'],
  necklace: ['String Charm', 'Bone Necklace', 'Pendant', 'Amulet', 'Talisman', 'Locket', 'Torque', 'Heartstone'],
  artifact: ['Cracked Charm', 'Tin Compass', 'Bone Idol', 'Lucky Coin', 'Hourglass', 'Prism Shard', 'Star Orb', 'Eye of Fortune'],
};
const PREFIX = [['Rusty', 'Cracked', 'Worn', 'Frayed'], [''], ['Sturdy', 'Fine'], ['Superior', 'Hardened'], ['Polished', 'Gleaming'], ['Legendary'], ['Mythic'], ['']];
const EPITHET = { 5: ['of the Wolf', 'of the Bear', 'of the Storm', 'of Dawn'], 6: ['of Ruin', 'of Eternity', 'of the Void', 'of the Sun'] };
const SECRET_NAMES = { weapon: 'Whisper of the Dark', armor: 'Shroud of Midnight', helmet: 'Crown of Watching Eyes', ring: 'Band of the Last Light', necklace: 'Heart of the Hollow', artifact: "The Gambler's Moon" };

const gearRand = a => a[Math.floor(Math.random() * a.length)];
const newItemId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function makeName(item, sword, baseIdx) {
  if (item.rarity === 7) return SECRET_NAMES[item.slot];
  const base = item.slot === 'weapon' ? sword.name : BASE_NAMES[item.slot][Number.isInteger(baseIdx) ? baseIdx : Math.min(7, Math.floor(item.rarity * 0.8 + Math.random() * 2.2))];
  const pre = gearRand(PREFIX[item.rarity]), post = item.theme ? ' ' + item.theme : EPITHET[item.rarity] ? ' ' + gearRand(EPITHET[item.rarity]) : '';
  return `${pre ? pre + ' ' : ''}${base}${post}`;
}

// ---------------------------------------------------------------- rolling
// t is "how deep" you are: bosses defeated plus how far into the current set. Deeper = better grades, not just more drops.
function rollRarity(t = 0, bossPiece = false) {
  if (bossPiece && Math.random() < SECRET_BOSS_CHANCE * (1 + 0.25 * (dropLuck() - 1))) return 7;      // Secret gets only a quarter of the rebirth luck
  const lk = rarityLuck() + gearStat('gradeLuck');
  const w = RARITY_BASE_W.map((b, i) => b * Math.pow(RARITY_DEPTH_GROWTH, Math.min(t, RARITY_DEPTH_CAP) * (i - 2) / 2) * (i >= 3 && i < 7 ? 1 + lk * (i - 2) : 1));
  let x = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) if ((x -= w[i]) <= 0) return i;
  return 1;
}
function rollStat(key, rarity, mode) {                              // mode: 'max' / 'min' pin the roll to the top / bottom of the grade's band (dev menu)
  const S = GEAR_STATS[key], [lo, hi] = RARITIES[rarity].band;
  let v = mode === 'max' ? S.max * hi * 1.06 : mode === 'min' ? S.max * lo * 0.94 : S.max * (lo + (hi - lo) * Math.random()) * (0.94 + 0.12 * Math.random());
  v = Math.min(S.max, Math.max(S.max * 0.02, v));
  return S.int ? Math.max(1, Math.round(v)) : Math.round(v * 1000) / 1000;
}
function scaleStat(k, v, m) { const S = GEAR_STATS[k]; v = Math.min(S.max * STAT_CEIL, v * m); return S.int ? Math.max(1, Math.round(v)) : Math.round(v * 1000) / 1000; }
function rollItem(o = {}) {
  const slot = o.slot || gearRand(['weapon', 'weapon', 'armor', 'armor', 'helmet', 'ring', 'ring', 'necklace', 'necklace', 'helmet', 'artifact']);
  const rarity = Number.isInteger(o.rarity) ? Math.max(0, Math.min(7, o.rarity)) : Math.max(rollRarity(o.tier || 0, !!o.boss), typeof dun !== 'undefined' && dun ? 4 : 0);        // underground nothing below Polished drops
  // item level: around the hero's level when it dropped, a little lower or higher by chance, now and then well above it (boss pieces are never lower); a chosen level (dev menu, shop stock) is used as it is
  const heroLv = Math.max(1, Math.round(o.level || (typeof hero !== 'undefined' && hero ? hero.level : 1)));
  const ilvl = o.ilvl ? Math.max(1, Math.round(o.ilvl)) : Math.max(1, heroLv + (o.boss ? Math.floor(Math.random() * 5) : Math.floor(Math.random() * 6) - 3) + (Math.random() < (o.boss ? 0.14 : 0.07) ? 3 + Math.floor(Math.random() * 5) : 0)), lm = ilvlMul(ilvl);       // and a few pieces (7%, 14% from a boss) are 3 to 7 levels higher still
  const item = { id: newItemId(), slot, rarity, ilvl, name: '', stats: {} };
  let sword = null;
  if (slot === 'weapon') {                                         // a weapon is one of the existing swords, up to the hero's level
    const level = Math.max(1, o.level || (typeof hero !== 'undefined' && hero ? hero.level : 1));
    const eligible = SWORDS.filter(s => !s.sig && s.lvl <= level);                // a boss's own weapon comes only from that boss
    const pool = eligible.flatMap((s, i) => Array(i + 1).fill(s));  // better swords are likelier
    const higher = SWORDS.filter(s => !s.sig && s.lvl > level && s.lvl <= level + 8);                            // now and then a weapon you are not ready for drops (6%, 12% from a boss; never more than 8 levels ahead, the nearer the likelier)
    const stretch = higher.length && Math.random() < (o.boss ? 0.12 : 0.06);
    sword = (o.base && SWORDS.find(s => s.id === o.base)) || (stretch ? gearRand(higher.flatMap(s => Array(Math.max(1, 4 - Math.floor((s.lvl - level) / 2))).fill(s))) : gearRand(pool)); item.base = sword.id;     // o.base: a chosen weapon (dev menu)
  }
  const R = SLOT_ROLLS[slot], keys = [...R.pri], pool = R.pool.filter(k => !keys.includes(k));
  if (o.theme) {                                                   // pieces dropped by a boss lean toward what that boss is about
    item.theme = o.theme.epithet;
    const pk = o.theme.pref.find(k => pool.includes(k));
    if (pk && keys.length < RARITIES[rarity].lines) { keys.push(pk); pool.splice(pool.indexOf(pk), 1); }
  }
  while (keys.length < RARITIES[rarity].lines && pool.length) keys.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  for (const k of keys.slice(0, Math.max(1, RARITIES[rarity].lines))) item.stats[k] = scaleStat(k, rollStat(k, rarity, o.roll), lm);
  if (rarity === 7) item.unique = UNIQUES[o.unique] ? o.unique : gearRand(Object.keys(UNIQUES));
  if (sword && LOOKS[sword.id]) item.look = LOOKS[sword.id].roll();                   // a katana and a whip each come in their own colours
  item.name = makeName(item, sword, o.baseIdx);
  item.value = Math.max(1, Math.round(RARITIES[rarity].price * (0.8 + Math.random() * 0.4) * (1 + (sword ? sword.lvl * 0.06 : 0))));
  return item;
}
function starterWeapon(swordId = 'wood') {
  const sw = SWORDS.find(s => s.id === swordId) || SWORDS[0];
  return { id: newItemId(), slot: 'weapon', rarity: 1, ilvl: 1, name: sw.name, stats: {}, base: sw.id, value: Math.max(2, Math.round(sw.lvl * 4)) };
}

// ---------------------------------------------------------------- the hero's gear
const zeroGear = () => ({ dmg: 0, hp: 0, dr: 0, crit: 0, critDmg: 0, speed: 0, cdr: 0, stamina: 0, gold: 0, upLuck: 0, dropLuck: 0, gradeLuck: 0, unique: [] });
function initGear() {
  hero.inv = []; hero.equip = { weapon: starterWeapon('wood'), armor: null, helmet: null, ring1: null, ring2: null, necklace: null, artifact: null, ring3: null, weapon2: null };
  hero.runes = {}; hero.ess = {}; hero.gearHp = 0; hero.gear = zeroGear();
  recalcGear();
}
// rebuild hero.gear and everything that depends on it (the weapon in hand and max HP)
function recalcGear() {
  const g = zeroGear();
  for (const k of GEAR_SLOTS.concat(slotOpen('ring3') ? ['ring3'] : [])) {                   // the spare weapon adds nothing until you swap to it
    const it = hero.equip[k]; if (!it) continue;
    for (const s in it.stats) if (s in g) g[s] += it.stats[s];
    for (const rk of it.rn || []) { const R = RUNES[rk]; if (R) g[R.stat] += R.val; }                  // socketed runes add their bonus on top of the piece
    if (it.unique && !g.unique.includes(it.unique)) g.unique.push(it.unique);
  }
  for (const k in LUCK_CAPS) g[k] = Math.min(LUCK_CAPS[k], g[k]);
  hero.gear = g;
  const w = hero.equip.weapon;
  if (w) { const sw = SWORDS.find(s => s.id === w.base) || SWORDS[0]; if (hero.sword !== sw) hero.combo = 0; hero.sword = sw; }
  const delta = Math.round(g.hp) - (hero.gearHp | 0);                  // max HP from gear is tracked separately so equipping never double-counts
  if (delta) { hero.maxHp = Math.max(1, hero.maxHp + delta); hero.gearHp = Math.round(g.hp); if (delta > 0) hero.hp += delta; }
  hero.hp = Math.min(hero.hp, hero.maxHp);
  syncRebirthHp();
  hero.stamina = Math.min(hero.stamina, maxStamina());
}
// ---------------------------------------------------------------- runes: small stones socketed into a piece (Uncommon and better have sockets: 1 on Uncommon and Rare, 2 on Polished and Legendary, 3 on Mythical and Secret)
// They add a flat bonus on top of the piece, and the three luck runes make the forge and the drops kinder. Eight kinds, each in five tiers (Faint, Bright, Radiant, Brilliant, Eternal):
// a higher tier is stronger and far rarer. Runes drop rarely from monsters; the Enchantress sells them (dearly) and improves them one tier at a time, with a chance to fail.
const RUNE_BASE = {
  might:   { name: 'Might',    color: '#ff9a4a', stat: 'dmg',       val: 4,     w: 5, price: 45, glyph: 'M16 6 V26 M10 12 L16 6 L22 12' },
  vigor:   { name: 'Vigor',    color: '#e2565a', stat: 'hp',        val: 35,    w: 5, price: 45, glyph: 'M11 6 V26 M11 6 L20 11 L11 16 L21 21 L11 26' },
  guard:   { name: 'Guard',    color: '#6fb5ff', stat: 'dr',        val: 0.01,  w: 5, price: 50, glyph: 'M8 8 H24 V17 Q24 24 16 27 Q8 24 8 17 Z' },
  haste:   { name: 'Haste',    color: '#5fd07a', stat: 'cdr',       val: 0.015, w: 5, price: 50, glyph: 'M11 6 V26 M11 6 H18 Q23 6 23 11 Q23 16 18 16 H11 M16 16 L23 26' },
  keen:    { name: 'Keen',     color: '#ffd24a', stat: 'crit',      val: 0.01,  w: 5, price: 55, glyph: 'M16 7 L24 16 L16 25 L8 16 Z M16 12 L20 16 L16 20 L12 16 Z' },
  fortune: { name: 'Fortune',  color: '#c36bff', stat: 'upLuck',    val: 0.03,  w: 2, price: 95, glyph: 'M11 26 V6 M11 11 L21 6 M11 17 L21 12' },
  plenty:  { name: 'Plenty',   color: '#f5c451', stat: 'dropLuck',  val: 0.06,  w: 2, price: 95, glyph: 'M11 6 V26 M11 6 L21 11 L11 16 M11 16 L21 21 L11 26' },
  destiny: { name: 'Destiny',  color: '#3ff2e0', stat: 'gradeLuck', val: 0.02,  w: 1, price: 130, glyph: 'M9 8 L23 24 M23 8 L9 24 M16 5 V27' },
};
// mul: how much stronger · w: how common among drops · price: how much dearer · up: the chance to improve it to the next tier (before luck)
const RUNE_TIERS = [
  { name: 'Faint',     mul: 1,   w: 100,  price: 1,   up: 0.55, color: '#9aa3b2' },
  { name: 'Bright',    mul: 1.6, w: 20,   price: 3.4, up: 0.38, color: '#5fd07a' },
  { name: 'Radiant',   mul: 2.4, w: 4,    price: 11,  up: 0.22, color: '#5aa8ff' },
  { name: 'Brilliant', mul: 3.4, w: 0.8,  price: 38,  up: 0.11, color: '#c36bff' },
  { name: 'Eternal',   mul: 5,   w: 0.15, price: 130, up: 0,    color: '#ff9a4a' },
];
const runeKey = (base, tier) => tier <= 1 ? base : base + tier;           // 'might', 'might2' ... 'might5'
const RUNES = {};
for (const b in RUNE_BASE) RUNE_TIERS.forEach((T, i) => {
  const B = RUNE_BASE[b], v = B.val * T.mul;
  RUNES[runeKey(b, i + 1)] = { base: b, tier: i + 1, name: B.name, title: `${T.name} Rune of ${B.name}`, tname: T.name, tc: T.color, color: B.color, stat: B.stat,
    val: B.val >= 1 ? Math.round(v) : Math.round(v * 1000) / 1000, w: B.w * T.w, price: Math.round(B.price * 6 * T.price), glyph: B.glyph };
});
const RUNE_KEYS = Object.keys(RUNES), RUNE_MAX = 30;
const socketsOf = it => (it && RARITIES[it.rarity].sockets) | 0;
const runeCount = k => (hero && hero.runes && hero.runes[k]) | 0;
const runeLine = k => { const R = RUNES[k], S = GEAR_STATS[R.stat]; return `${R.title}: ${S.fmt(R.val)}${S.name === 'Upgrade luck' || S.name === 'Drop luck' || S.name === 'Grade luck' ? '' : ' ' + S.name}`; };
function addRune(k, n = 1) { if (!RUNES[k]) return 0; if (!hero.runes) hero.runes = {}; const before = runeCount(k); hero.runes[k] = Math.min(RUNE_MAX, before + n); return hero.runes[k] - before; }
function socketRune(it, k) {                                                  // put a rune from your stock into a free socket
  if (!it || !RUNES[k] || runeCount(k) < 1 || (it.rn || []).length >= socketsOf(it)) return false;
  hero.runes[k]--; (it.rn || (it.rn = [])).push(k); recalcGear(); return true;
}
function unsocketRune(it, idx) {                                              // take it back out: the rune returns to your stock, nothing is lost
  const k = it && it.rn && it.rn[idx]; if (!k) return false;
  it.rn.splice(idx, 1); addRune(k); recalcGear(); return true;
}
const returnRunes = it => { for (const k of it.rn || []) addRune(k); it.rn = []; };       // a piece that is sold or thrown away gives its runes back
// a random rune: the kind by its weight, then the tier (the better tiers get `boost` times their normal weight, none above maxTier)
function rollRuneKey(boost = 1, maxTier = RUNE_TIERS.length) {
  const bases = Object.keys(RUNE_BASE); let x = Math.random() * bases.reduce((a, b) => a + RUNE_BASE[b].w, 0), base = bases[0];
  for (const b of bases) if ((x -= RUNE_BASE[b].w) <= 0) { base = b; break; }
  const ws = RUNE_TIERS.map((T, i) => i >= maxTier ? 0 : T.w * (i ? boost : 1)); let y = Math.random() * ws.reduce((a, c) => a + c, 0), tier = 1;
  for (let i = 0; i < ws.length; i++) if ((y -= ws[i]) <= 0) { tier = i + 1; break; }
  return runeKey(base, tier);
}
// which runes a monster leaves behind: rarely from anything, a little more often from elites (and a better tier), most bosses leave one and a few leave two
function runeDropsFor(m) {
  const boss = m.type === 'boss', r = Math.random();
  const n = boss ? (r < 0.45 ? 1 : 0) + (Math.random() < 0.1 ? 1 : 0) : m.elite ? (r < 0.03 ? 1 : 0) : (r < 0.002 * dropLuck() * D().drop * (1 + gearStat('dropLuck')) * ((m.size ?? 1) < 1 ? 0.5 : 1) ? 1 : 0);
  return Array.from({ length: n }, () => rollRuneKey(boss ? 4 : m.elite ? 2.2 : 1));
}
// ---- the Enchantress: prices and improving a rune. The price grows with the wave like the rest of the shops; luck from gear helps the odds (half as much as it helps the forge)
const runeNext = k => { const R = RUNES[k]; return R && R.tier < RUNE_TIERS.length ? runeKey(R.base, R.tier + 1) : null; };
const runePrice = k => Math.round(RUNES[k].price * (1 + (typeof wave === 'number' ? wave : 0) * 0.03));
const runeUpChance = k => { const R = RUNES[k]; return !R || !runeNext(k) ? 0 : Math.min(0.9, Math.max(0.05, RUNE_TIERS[R.tier - 1].up + gearStat('upLuck') * 0.5)); };
const runeUpCost = k => { const n = runeNext(k); return n ? Math.round(runePrice(n) * 0.8) : 0; };
const canRuneUp = k => !!runeNext(k) && runeCount(k) >= 1 && runeCount(runeNext(k)) < RUNE_MAX;
function attemptRuneUp(k, roll = Math.random()) {                        // 'up' (one tier better), 'down' (it falls one tier, like a failed forge upgrade), 'fail' (a Faint rune can fall no further) or null
  if (!canRuneUp(k)) return null;
  const R = RUNES[k]; hero.runes[k]--;
  if (roll < runeUpChance(k)) { addRune(runeNext(k)); return 'up'; }
  if (R.tier === 1) { addRune(k); return 'fail'; }
  addRune(runeKey(R.base, R.tier - 1)); return 'down';
}

const gearHas = name => !!(hero && hero.gear && hero.gear.unique.includes(name));
const gearStat = k => (hero && hero.gear ? hero.gear[k] : 0) || 0;

function bagFind(id) { return hero.inv.findIndex(i => i.id === id); }
function addToBag(item) { if (hero.inv.length >= INV_MAX) return false; hero.inv.push(item); return true; }

// slotKey: for rings 'ring1' / 'ring2'; otherwise the item's own slot
function equipFromBag(id, slotKey) {
  const i = bagFind(id); if (i < 0) return 'missing';
  const item = hero.inv[i];
  let key = item.slot === 'ring' ? (slotKey === 'ring2' ? 'ring2' : slotKey === 'ring3' ? 'ring3' : 'ring1') : item.slot;
  if (item.slot === 'weapon' && slotKey === 'weapon2') key = 'weapon2';
  if (!activeSlots().includes(key)) return 'bad slot';
  const old = hero.equip[key];
  hero.inv.splice(i, 1);
  if (old) hero.inv.splice(i, 0, old);                                  // the old piece takes the freed spot
  hero.equip[key] = item;
  recalcGear(); sfx('equip');
  return 'ok';
}
// rebirth 10: swap the weapon in your hand with the spare one
function swapWeapons() {
  if (!slotOpen('weapon2')) return 'locked';
  const b = hero.equip.weapon2; if (!b) return 'empty';
  hero.equip.weapon2 = hero.equip.weapon; hero.equip.weapon = b;
  recalcGear();
  return 'ok';
}
function unequipToBag(key) {
  const it = hero.equip[key]; if (!it) return 'empty';
  if (key === 'weapon') return 'You must hold a weapon: equip another one instead.';
  if (!addToBag(it)) return 'Your backpack is full.';
  hero.equip[key] = null;
  recalcGear();
  return 'ok';
}
// ---------------------------------------------------------------- upgrading (the blacksmith)
// How far a piece can go depends on its grade: 3 levels on Broken, then 2 more for every grade (Secret 17). All the levels together add only a little: 8% of the piece's stats on Broken,
// rising to 30% on Secret, so a fully upgraded Common is still worse than an average Uncommon, and so on up the grades. No stat can pass its grade's cap (rarityCap), however it got there.
// An upgrade can fail: the first level succeeds 95% of the time and each level after that is 6 points harder (never below 30%; artifacts and runes of luck add to the odds). A failure costs the gold
// and drops the piece one level (a piece at +0 just loses the gold); a success raises it one level.
const UP_TOTAL = [0.08, 0.10, 0.12, 0.15, 0.18, 0.20, 0.24, 0.30];
const upgradeMax = it => 3 + 2 * it.rarity;
const upPct = it => UP_TOTAL[it.rarity] / upgradeMax(it);                  // what one level adds, as a share of the stats it was found with
const rarityCap = (k, r) => Math.min(GEAR_STATS[k].max * STAT_CEIL, GEAR_STATS[k].max * RARITIES[r].band[1] * 1.06 * ilvlMul(ILVL_MAX) * (1 + UP_TOTAL[r]));      // the most any piece of this grade can carry of a stat
const upgradeCost = it => Math.round((22 + it.value * 0.55) * (1 + 0.13 * (it.up | 0)));
const upgradeChance = (it, extra = 0) => Math.min(0.98, Math.max(0.3, 0.95 - 0.06 * (it.up | 0)) + gearStat('upLuck') + extra);
const canUpgrade = it => !!it && (it.up | 0) < upgradeMax(it) && Object.keys(it.stats).length > 0;
const statsAtUp = (it, up) => {                                           // the stats this piece has at upgrade level `up`: what it was found with, plus its grade's share per level, never past the grade's cap
  const out = {}, sb = it.sbase || it.stats;
  for (const k in sb) { const S = GEAR_STATS[k], v = sb[k] * (1 + upPct(it) * up), cap = rarityCap(k, it.rarity); out[k] = Math.min(cap, S.int ? Math.max(Math.round(v), Math.round(sb[k]) + Math.floor(up / 4)) : Math.round(v * 1000) / 1000); }
  return out;
};
function applyUpgrades(it) { Object.assign(it.stats, statsAtUp(it, it.up | 0)); it.value = Math.round((it.vbase || it.value) * (1 + 0.04 * (it.up | 0))); }
const setUpName = it => { it.name = it.name.replace(/ \+\d+$/, '') + (it.up | 0 ? ` +${it.up}` : ''); };
function upgradeItem(it) {                                                // one level up, for certain (the shop goes through attemptUpgrade)
  if (!canUpgrade(it)) return false;
  if (!it.sbase) it.sbase = { ...it.stats };                            // sbase: the stats it was found with (base is a weapon's own id)
  if (!it.vbase) it.vbase = it.value;
  it.up = (it.up | 0) + 1;
  applyUpgrades(it); setUpName(it);
  return true;
}
// One try at the next level. Returns 'up' (it worked), 'down' (it failed and the piece lost a level), 'fail' (it failed at +0, nothing lost but the gold) or null (cannot be upgraded).
function attemptUpgrade(it, roll = Math.random()) {
  if (!canUpgrade(it)) return null;
  if (roll < upgradeChance(it)) { upgradeItem(it); return 'up'; }
  if (!(it.up | 0)) return 'fail';
  it.up--; applyUpgrades(it); setUpName(it);
  return 'down';
}
function discardFromBag(id) { const i = bagFind(id); if (i < 0) return false; returnRunes(hero.inv[i]); hero.inv.splice(i, 1); return true; }

// ---------------------------------------------------------------- caps (level stats + gear, never beyond the ceiling)
function capValue(key, levelPart) {
  return Math.min(GEAR_CAPS[key], levelPart + gearStat(key));
}

// ---------------------------------------------------------------- saving and loading (never trust a save file)
function sanitizeItem(raw) {
  try {
    if (!raw || typeof raw !== 'object') return null;
    const slot = ITEM_SLOTS.includes(raw.slot) ? raw.slot : null, rarity = Number.isInteger(raw.rarity) && raw.rarity >= 0 && raw.rarity <= 7 ? raw.rarity : null;
    if (!slot || rarity === null) return null;
    const item = { id: String(raw.id || newItemId()).slice(0, 24), slot, rarity, name: String(raw.name || 'Unknown').slice(0, 48), stats: {} };
    if (slot === 'weapon') {
      let sw = SWORDS.find(s => s.id === raw.base);
      if (!sw) sw = [...SWORDS].sort((a, b) => b.name.length - a.name.length).find(s => String(raw.name).includes(s.name));      // an upgraded weapon saved by an older build lost its id: its name still says which weapon it is
      if (!sw) return null; item.base = sw.id; item.sl = sw.lvl;
    }
    for (const k in GEAR_STATS) {
      const v = raw.stats && Number(raw.stats[k]);
      if (Number.isFinite(v) && v > 0) item.stats[k] = Math.min(rarityCap(k, rarity), v);
    }
    if (raw.unique && UNIQUES[raw.unique]) item.unique = raw.unique;
    if (slot === 'weapon' && raw.fx && typeof raw.fx === 'object' && WFX[raw.fx.k]) item.fx = { k: raw.fx.k, lv: Math.max(1, Math.min(WFX_LV, Math.floor(Number(raw.fx.lv)) || 1)) };
    if (slot === 'weapon' && raw.look && typeof raw.look === 'object' && LOOKS[item.base]) { const tbl = LOOK_SIZES[item.base]; item.look = {}; for (const k in tbl) item.look[k] = Math.max(0, Math.min(tbl[k] - 1, Math.floor(Number(raw.look[k])) || 0)); }      // the colours of a katana or whip
    if (Array.isArray(raw.rn)) { const rn = raw.rn.filter(k => RUNES[k]).slice(0, RARITIES[rarity].sockets); if (rn.length) item.rn = rn; }
    item.ilvl = Math.max(1, Math.min(99, Math.round(Number(raw.ilvl) || (slot === 'weapon' ? item.sl : 0) || 1)));
    delete item.sl;
    if (Number(raw.up) > 0) item.up = Math.max(0, Math.min(upgradeMax(item), Math.floor(Number(raw.up))));
    item.value = Math.max(1, Math.min(99999, Math.round(Number(raw.value) || RARITIES[rarity].price)));
    if (item.up > 0) {                                                  // the stats it was found with, so later upgrades add the right amount (older saves: worked out from what it has now)
      item.sbase = {}; const rb = raw.sbase || (raw.base && typeof raw.base === 'object' ? raw.base : null);        // (older saves kept this under base)
      for (const k in item.stats) { const b = rb && Number(rb[k]); item.sbase[k] = Number.isFinite(b) && b > 0 ? Math.min(rarityCap(k, rarity), b) : item.stats[k] / (1 + upPct(item) * item.up); }
      item.vbase = Math.max(1, Math.round(Number(raw.vbase) || item.value / (1 + 0.04 * item.up)));
    }
    return item;
  } catch { return null; }
}
function serializeGear() {
  return { inv: hero.inv, equip: hero.equip, gearHp: hero.gearHp | 0, runes: hero.runes || {}, ess: hero.ess || {} };
}
// d: a save. Old saves (before gear) get a Common weapon for every sword they had unlocked.
function loadGear(d) {
  hero.inv = []; hero.equip = { weapon: null, armor: null, helmet: null, ring1: null, ring2: null, necklace: null, artifact: null, ring3: null, weapon2: null };
  hero.ess = {}; if (d.ess && typeof d.ess === 'object') for (const k of ESS_KEYS) { const n = Math.floor(Number(d.ess[k])); if (n > 0) hero.ess[k] = Math.min(ESS_MAX, n); }
  hero.runes = {}; if (d.runes && typeof d.runes === 'object') for (const k of RUNE_KEYS) { const n = Math.floor(Number(d.runes[k])); if (n > 0) hero.runes[k] = Math.min(RUNE_MAX, n); }
  hero.gearHp = Math.max(0, Math.min(5000, d.gearHp | 0)); hero.gear = zeroGear();
  if (d.equip && typeof d.equip === 'object') {
    for (const k of activeSlots()) {
      const it = sanitizeItem(d.equip[k]);
      if (it && (it.slot === k || (it.slot === 'ring' && k.startsWith('ring')) || (it.slot === 'weapon' && k === 'weapon2'))) hero.equip[k] = it;
    }
    if (Array.isArray(d.inv)) for (const raw of d.inv.slice(0, INV_MAX)) { const it = sanitizeItem(raw); if (it) hero.inv.push(it); }
  } else {
    // old saves only get the original swords; the newer weapon kinds come from drops
    for (const sw of SWORDS) if (['wood', 'iron', 'dagger', 'great', 'flame', 'frost', 'holy'].includes(sw.id) && sw.lvl <= hero.level && sw.id !== d.sword) hero.inv.push(starterWeapon(sw.id));
    hero.equip.weapon = starterWeapon(d.sword);
    hero.gearHp = 0;
  }
  if (!hero.equip.weapon) hero.equip.weapon = starterWeapon('wood');          // always holding something
  recalcGear();
}

// ---------------------------------------------------------------- drops
// normal 2.5% per kill (scaled by difficulty and rebirth luck), bosses always drop 1-3 pieces and roll one tier deeper
function depthOf() { return tierOf(wave) + (setPos(wave) - 1) / 20; }
const SIG_DROP = 0.2;                                                // the chance a boss drops its own weapon (times luck)
function gearDropsFor(m) {
  const out = [];
  if (m.type === 'boss') {
    const luck = dropLuck() * (1 + gearStat('dropLuck')), n = 1 + (Math.random() < BOSS_EXTRA_PIECE[0] * luck ? 1 : 0) + (Math.random() < BOSS_EXTRA_PIECE[1] * luck ? 1 : 0);
    const theme = (BOSSES[m.kind] || BOSSES.minotaur).theme;
    for (let i = 0; i < n; i++) out.push(rollItem({ tier: depthOf() + 1, boss: true, level: hero.level, theme }));
    const sg = SWORDS.find(s => s.sig === m.kind);                  // and now and then the boss's own weapon
    if (sg && Math.random() < SIG_DROP * luck) out.push(rollItem({ slot: 'weapon', base: sg.id, rarity: Math.max(4, rollRarity(depthOf() + 1, true)), boss: true, level: hero.level, theme }));
  } else if (m.elite) {                                            // elites: one piece in four, from a little deeper than usual
    if (Math.random() < ELITE_GEAR_CHANCE * dropLuck() * (1 + gearStat('dropLuck'))) out.push(rollItem({ tier: depthOf() + 0.5, level: hero.level }));
  } else if (Math.random() < GEAR_DROP_CHANCE * dropLuck() * (1 + gearStat('dropLuck')) * D().drop * ((m.size ?? 1) < 1 ? 0.5 : 1)) out.push(rollItem({ tier: depthOf(), level: hero.level }));
  return out;
}
function dropGear(item, x, y) {
  dropItem('gear', x, y, { item, t: 60 });
  if (item.rarity >= 5) sfx('unlock');
}
// called when the hero walks over a gear drop; returns true if it was picked up
function pickUpGear(d) {
  if (!addToBag(d.item)) {
    if (!(d.warnT > 0)) { popups.push({ text: 'Backpack full (press Tab)', x: d.x, y: d.y - 34, t: 1.2, color: '#f88' }); d.warnT = 1.5; sfx('tired'); }
    return false;
  }
  const R = RARITIES[d.item.rarity];
  popups.push({ text: d.item.name, x: d.x, y: d.y - 34, t: 2, color: R.color });
  sfx(d.item.rarity >= 6 ? 'sparkle' : d.item.rarity >= 5 ? 'levelup' : 'pickup'); if (d.item.rarity >= 6) setTimeout(() => sfx('levelup'), 200);
  return true;
}

// ---------------------------------------------------------------- the inventory window (Tab)
let invCmp = null, invPick = false;                              // the piece you chose to compare with, and whether the next click picks it
let invSel = null;                                              // { src: 'bag' | 'eq', id }
// Item icons. Weapons and armor are drawn as the real piece (picked by weapon id, and by which armor it is) in a 32 x 32 box: filled shapes with a dark outline, light and shadow sides, guards, grips and pommels.
// Everything else (rings, necklaces, helmets, empty slots) keeps a plain outline symbol per slot.
const ICO = {
  steel: '#d3dbe6', steelD: '#8b99ab', gold: '#e0bd55', goldD: '#9c7a22', wood: '#9a6a3a', woodD: '#5e3c1c', leather: '#6a4326', leatherD: '#3d2614', red: '#b3342f',
  p: (d, fill, x = '') => `<path d="${d}" fill="${fill}" ${x}/>`,
  l: (d, col, w = 1, x = '') => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" ${x}/>`,
  r: (x, y, w, h, fill, rx = 0.7) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`,
  c: (x, y, r, fill) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`,
  rot: (deg, inner, k = 1) => `${inner}<!--rot:${deg}:${k}-->`,           // the art is drawn pointing up; the marker says how far to tilt it as an icon
};
// a straight sword drawn pointing up: light left half, dark right half, a ridge down the middle, guard, wrapped grip, pommel
// bk stretches only the blade (from the guard up), so the hero's long swords keep a normal guard, grip and pommel
const bladeG = (yb, bk, inner) => bk === 1 ? inner : `<g transform="translate(0 ${yb}) scale(1 ${bk}) translate(0 ${-yb})">${inner}</g>`;
const SWORD_STYLES = {
  wood:  { bl: '#d2a66a', bd: '#a97b44', guard: '#8a5a2b', guardD: '#5e3c1c', pommel: '#8a5a2b', w: 2, fuller: 'rgba(0,0,0,.12)' },
  iron:  { bl: '#e4eaf2', bd: '#9aa8ba', guard: '#6f7886', guardD: '#454c58', pommel: '#6f7886' },
  flame: { bl: '#ffb24a', bd: '#e2561d', guard: ICO.gold, fuller: '#ffe58a' },
  frost: { bl: '#d6f2ff', bd: '#74c1f0', guard: '#cfd8e6', guardD: '#7f93ab', pommel: '#9fd8ff', fuller: '#ffffff', extra: ICO.p('M21.4 9 L22.7 11 L21.4 13 L20.1 11 Z M10.6 12 L11.6 13.6 L10.6 15.2 L9.6 13.6 Z', '#ffffff', 'stroke="#5aa6d6" stroke-width=".4"') },
  holy:  { bl: '#fff6c4', bd: '#ecca55', guard: ICO.gold, w: 2.4, gw: 15, pommel: '#d33', fuller: '#fffbe8' },
  great: { bl: '#d9e0ea', bd: '#8493a6', guard: '#7a828e', guardD: '#454c58', w: 3.5, tip: 0.8, gw: 17, pommel: '#7a828e', extra: ICO.l('M14.6 6 V17 M17.4 6 V17', 'rgba(0,0,0,.18)', 0.6) },
};
const swordArt = ({ bl, bd, guard, guardD = ICO.goldD, grip = ICO.leather, w = 2.2, tip = 2, gw = 12, pommel = guard, fuller = 'rgba(0,0,0,.22)', extra = '', bk = 1 }) => {
  const x0 = 16 - gw / 2, x1 = 16 + gw / 2;
  const blade = ICO.p(`M16 ${tip} L${16 - w} ${tip + 4.5} V19 H16 Z`, bl) + ICO.p(`M16 ${tip} L${16 + w} ${tip + 4.5} V19 H16 Z`, bd) +
    ICO.l(`M${16 - w + 0.55} ${tip + 5.5} V18.2`, 'rgba(255,255,255,.75)', 0.5, 'stroke-linecap="round"') + ICO.l(`M16 ${tip + 6} V17.6`, fuller, 0.8, 'stroke-linecap="round"') + extra;
  return bladeG(19, bk, blade) +
    ICO.p(`M${x0} 19.2 Q${x0 + 3} 18.5 16 19.3 Q${x1 - 3} 18.5 ${x1} 19.2 L${x1 - 1} 21.5 Q16 20.5 ${x0 + 1} 21.5 Z`, guard) + ICO.c(x0 + 0.4, 20.3, 1.1, guard) + ICO.c(x1 - 0.4, 20.3, 1.1, guard) + ICO.c(16, 20.2, 1.1, guardD) +
    ICO.r(14.7, 21.5, 2.6, 5.9, grip, 0.8) + ICO.l('M14.9 23.2 H17.1 M14.9 24.9 H17.1 M14.9 26.5 H17.1', ICO.leatherD, 0.5) + ICO.c(16, 28.6, 1.9, pommel);
};
function daggerArt(bk = 1) {
  return bladeG(19, bk, ICO.p('M16 6.5 L13.8 9.5 V19 H16 Z', '#e6ecf4') + ICO.p('M16 6.5 L18.2 9.5 V19 H16 Z', '#9aa8ba')) +
    ICO.r(11.4, 19, 9.2, 2, ICO.gold, 0.9) + ICO.r(14.9, 21, 2.2, 4.8, ICO.leather, 0.7) + ICO.c(16, 26.6, 1.5, ICO.gold);
}
function rapierArt(bk = 1) {
  return bladeG(19, bk, ICO.p('M16 1.2 L18.2 6 V19 H16 Z', '#e6ecf4') + ICO.p('M16 1.2 L13.8 6 V19 H16 Z', '#aab7c7')) +
    ICO.p('M8.5 19 Q16 27 23.5 19 Q16 22.2 8.5 19 Z', ICO.gold) + ICO.l('M10 19.6 Q16 24.5 22 19.6', ICO.goldD, 0.6) + ICO.r(15.1, 19, 1.8, 3, ICO.goldD, 0.4) +
    ICO.r(14.9, 22, 2.2, 5.5, ICO.leather, 0.8) + ICO.l('M15 23.5 H17 M15 25 H17 M15 26.5 H17', ICO.leatherD, 0.5) + ICO.c(16, 28.7, 1.9, ICO.gold);
}
// Katana, traced from the reference icon (a long curved lavender blade, a small orange guard band, a pink wrapped handle with a round pommel) with its own thick dark outline.
// Drawn pointing up: tip at y = 1, pommel at y = 37.0; the icon tilts it by 42.95 degrees, exactly as in the reference.
const KATANA = { deg: 42.95, top: 1, bottom: 37.00, gy: 30.45, hx: 16 };
function katanaBase(rim = false) {
  const no = 'stroke="none"';
  return ICO.p('M13.73 1.12 L14.12 1.01 L14.75 1.51 L15.42 2.31 L15.94 3.32 L16.50 6.07 L16.98 10.64 L17.33 19.02 L17.20 27.50 L17.49 27.82 L17.43 28.47 L17.81 28.61 L18.22 29.23 L18.12 29.75 L17.76 30.08 L17.11 30.19 L16.93 36.29 L16.75 36.63 L16.17 37.00 L15.74 36.98 L15.27 36.75 L14.94 36.13 L15.20 30.12 L14.56 29.97 L14.15 29.34 L14.30 28.79 L14.57 28.54 L15.00 28.47 L14.98 27.73 L15.30 27.44 L15.33 18.12 L15.11 12.05 L14.79 7.75 L14.21 3.44 L13.67 1.42 L13.77 1.17 Z', '#222123', rim ? 'stroke="#8d8db3" stroke-width=".7" stroke-linejoin="round"' : no) +
    ICO.p('M14.55 2.36 L15.17 3.12 L15.56 4.26 L16.31 10.01 L16.72 19.25 L16.71 25.54 L16.55 27.52 L15.86 27.41 L15.98 20.61 L15.77 12.94 L15.24 6.16 L14.59 2.41 Z', '#9a9ab4', no) +
    ICO.p('M15.77 30.10 L16.55 30.12 L16.52 30.82 L16.39 30.94 L15.74 30.96 L15.81 30.14 Z M15.67 32.78 L16.41 32.59 L16.43 33.33 L15.79 33.17 L15.71 32.82 Z M15.59 35.03 L16.36 35.32 L16.33 36.10 L16.06 36.35 L15.80 36.34 L15.59 36.11 L15.63 35.07 Z', '#f46487', no) + ICO.p('M15.50 9.76 L15.54 9.90 L15.54 9.81 Z M16.45 13.31 L16.49 13.44 L16.50 13.35 Z M15.78 15.19 L15.82 15.32 L15.82 15.24 Z M15.80 15.84 L15.84 15.97 L15.84 15.89 Z M15.82 16.49 L15.86 16.62 L15.86 16.54 Z M15.84 17.23 L15.88 17.36 L15.88 17.27 Z M16.59 16.78 L16.63 16.91 L16.63 16.82 Z M15.85 17.97 L15.89 18.10 L15.90 18.01 Z M15.87 18.79 L15.91 18.92 L15.91 18.84 Z M16.62 18.25 L16.66 18.39 L16.67 18.30 Z M15.88 19.70 L15.92 19.83 L15.92 19.75 Z M16.64 19.08 L16.68 19.21 L16.68 19.12 Z M15.89 20.61 L15.93 20.74 L15.93 20.66 Z M16.65 19.90 L16.69 20.12 L16.69 19.95 Z M16.66 20.90 L16.70 21.03 L16.70 20.94 Z M15.89 21.69 L15.93 21.91 L15.94 21.74 Z M16.66 22.07 L16.70 22.29 L16.70 22.11 Z M15.90 22.86 L15.93 23.08 L15.94 22.91 Z M16.66 23.33 L16.69 23.63 L16.70 23.37 Z M15.88 24.38 L15.91 24.77 L15.93 24.43 Z M16.64 25.19 L16.67 25.49 L16.68 25.23 Z M15.86 26.24 L15.88 26.81 L15.90 26.29 Z M15.58 28.10 L15.69 28.49 L16.86 28.49 L15.65 28.53 L15.62 28.14 Z M14.76 29.19 L14.80 29.32 L14.80 29.24 Z M14.89 29.07 L17.49 29.16 L14.93 29.11 Z M14.88 29.41 L17.48 29.51 L14.92 29.46 Z M16.79 28.14 L16.82 28.44 L16.83 28.18 Z M17.53 29.29 L17.57 29.42 L17.57 29.34 Z M16.21 30.94 L16.39 30.94 L16.25 30.98 Z M15.71 31.74 L16.41 31.51 L16.49 31.60 L16.44 31.98 L15.78 32.09 L15.75 31.79 Z M16.11 32.62 L16.28 32.63 L16.15 32.67 Z M15.63 33.82 L16.28 33.97 L16.39 34.54 L15.74 34.38 L15.62 34.25 L15.67 33.86 Z M15.59 36.20 L15.76 36.29 L15.63 36.24 Z M16.11 36.30 L16.28 36.22 L16.15 36.35 Z', '#b74b65', no) +
    ICO.p('M14.80 29.24 L14.98 29.07 L17.57 29.25 L17.48 29.51 L14.88 29.41 L14.84 29.28 Z', '#f9c47a', no) + ICO.p('M15.62 28.14 L16.75 28.09 L16.82 28.44 L15.69 28.49 L15.66 28.19 Z M14.80 29.15 L14.93 29.11 L14.85 29.20 Z', '#f7a779', no);
}
// Looks: every katana and whip is made in its own colours. A katana: blade, wrap (handle and pommel), guard shape and metal, and the sheath. A whip: lash, grip and knob.
const KAT_BLADE = [['lavender', '#9a9ab4'], ['steel', '#cfd6df'], ['frost', '#9fd8f2'], ['crimson', '#d9546a'], ['jade', '#7fcf9a'], ['obsidian', '#3b3b4a'], ['gold', '#e8c46c']];
const KAT_WRAP = [['rose', '#f46487', '#b74b65'], ['crimson', '#d93a3a', '#8d2020'], ['indigo', '#5a74d6', '#2d3d8a'], ['forest', '#4fa86a', '#2c6a40'], ['ivory', '#f1ead6', '#b3a98a'], ['violet', '#a56ee0', '#6a3fa0'], ['amber', '#f3a640', '#a96a1c']];
const KAT_GUARD = ['bar', 'disc', 'square', 'bloom'];
const KAT_METAL = [['gold', '#f9c47a', '#f7a779'], ['silver', '#d6dde6', '#9aa6b6'], ['bronze', '#c98a4a', '#8f5a2a'], ['iron', '#59606e', '#343a46'], ['jade', '#7fd7b0', '#4aa77f']];
const KAT_SHEATH = [['black', '#2a2a38'], ['wine', '#5a1f2a'], ['navy', '#1f3a5a'], ['green', '#2d4a30'], ['brown', '#5a3d22']];
const WHIP_LASH = [['tan', '#c99a5b', '#7a5530'], ['black', '#4a4a56', '#22222a'], ['red', '#c4484a', '#7a2426'], ['green', '#6fa35a', '#3d6232'], ['blue', '#5f86c9', '#35508a'], ['violet', '#a070c9', '#64408a']];
const WHIP_GRIP = [['leather', '#6d4a2a', '#3d2814'], ['ebony', '#3a3a44', '#1c1c22'], ['crimson', '#a33a3a', '#5c1c1c'], ['ivory', '#e8dfc4', '#a8a088']];
const WHIP_KNOB = [['gold', '#e6b94a'], ['silver', '#d6dde6'], ['bronze', '#c98a4a']];
const lookAt = (a, i) => a[i] || a[0];
const lookPick = a => Math.floor(Math.random() * a.length);
const katLook = l => ({ b: 0, w: 0, t: 0, m: 0, s: 0, ...(l || {}) });
const whipLook = l => ({ l: 0, g: 0, k: 0, ...(l || {}) });
const LOOKS = {
  katana: { roll: () => ({ b: lookPick(KAT_BLADE), w: lookPick(KAT_WRAP), t: lookPick(KAT_GUARD), m: lookPick(KAT_METAL), s: lookPick(KAT_SHEATH) }),
    text: l => { l = katLook(l); return `${lookAt(KAT_BLADE, l.b)[0]} blade · ${lookAt(KAT_WRAP, l.w)[0]} wrap · ${lookAt(KAT_METAL, l.m)[0]} ${KAT_GUARD[l.t] || 'bar'} guard · ${lookAt(KAT_SHEATH, l.s)[0]} sheath`; } },
  whip: { roll: () => ({ l: lookPick(WHIP_LASH), g: lookPick(WHIP_GRIP), k: lookPick(WHIP_KNOB) }),
    text: l => { l = whipLook(l); return `${lookAt(WHIP_LASH, l.l)[0]} lash · ${lookAt(WHIP_GRIP, l.g)[0]} grip · ${lookAt(WHIP_KNOB, l.k)[0]} knob`; } },
};
const LOOK_SIZES = { katana: { b: KAT_BLADE.length, w: KAT_WRAP.length, t: KAT_GUARD.length, m: KAT_METAL.length, s: KAT_SHEATH.length }, whip: { l: WHIP_LASH.length, g: WHIP_GRIP.length, k: WHIP_KNOB.length } };
const heroLook = sw => { const w = typeof hero !== 'undefined' && hero && hero.equip && hero.equip.weapon; return w && w.base === sw.id ? w.look : null; };   // the look of the weapon in the hero's hand
const whipColors = sw => { if (sw.id !== 'whip') return { lash: sw.color, grip: '#654' }; const l = whipLook(heroLook(sw)); return { lash: lookAt(WHIP_LASH, l.l)[1], grip: lookAt(WHIP_GRIP, l.g)[1] }; };
const katanaSheath = () => lookAt(KAT_SHEATH, katLook(heroLook({ id: 'katana' })).s)[1];
function katanaArt(rim = false, look) {
  const L = katLook(look), bl = lookAt(KAT_BLADE, L.b), wr = lookAt(KAT_WRAP, L.w), mt = lookAt(KAT_METAL, L.m), sh = KAT_GUARD[L.t] || 'bar';
  let s = katanaBase(rim);
  const sub = (a, b) => { s = s.split(a).join(b); };
  sub('#9a9ab4', bl[1]); sub('#f46487', wr[1]); sub('#b74b65', wr[2]); sub('#f9c47a', mt[1]); sub('#f7a779', mt[2]);
  if (sh !== 'bar') {                                                // a different guard replaces the thin bar of the traced picture
    s = s.replace(/<path d="M14\.80 29\.24[^>]*\/>/, '');
    const g = sh === 'disc' ? ICO.p('M14 29.3 Q16.2 28.2 18.4 29.3 Q16.2 30.4 14 29.3 Z', mt[1])
      : sh === 'square' ? ICO.r(14.1, 28.6, 4.2, 1.4, mt[1], 0.4)
      : ICO.p('M13.9 29.3 Q14.3 28.5 15.2 28.7 Q16.2 28.1 17.2 28.7 Q18.1 28.5 18.5 29.3 Q18.1 30.1 17.2 29.9 Q16.2 30.5 15.2 29.9 Q14.3 30.1 13.9 29.3 Z', mt[1]);
    s += g + ICO.l('M15 29.3 H17.4', mt[2], 0.5, 'stroke-linecap="round"');
  }
  return s;
}
const katanaIcon = look => ICO.rot(KATANA.deg, `<g transform="translate(0 ${16 - (KATANA.top + KATANA.bottom) / 2})">${katanaArt(true, look)}</g>`);
// the whip, coiled: a long lash round in a spiral to a frayed cracker, and a grip with a knob
function whipArt(look) {
  const L = whipLook(look), la = lookAt(WHIP_LASH, L.l), gr = lookAt(WHIP_GRIP, L.g), kn = lookAt(WHIP_KNOB, L.k), rd = 'stroke-linecap="round"';
  const path = 'M28.2 16.6 C28.8 8 22 2.6 15 2.8 C7.2 3 2.4 9 2.8 15.8 C3.2 23 9.2 28.4 16.4 27.6 C21.6 27 24.8 23.6 24.2 20.4 C23.6 17.8 19.8 17.8 17.2 19.6 C14.2 21.6 10.6 21 9.4 17.8 C8.4 14.8 10 11.8 13 11.2';
  const strand = d => ICO.l(d, '#17171f', 2.1, rd) + ICO.l(d, la[1], 1, rd);
  return ICO.l(path, '#17171f', 4.2, rd) + ICO.l(path, la[1], 2.8, rd) + ICO.l(path, la[2], 0.8, 'stroke-linecap="butt" stroke-dasharray="1.2 1.6"') + ICO.l('M27.4 16 C27.6 8.6 21.6 3.8 15 3.9', 'rgba(255,255,255,.28)', 0.6, rd) +
    strand('M13 11.2 Q15.4 8 19.2 8.6') + strand('M13.2 11.8 Q16.4 9.8 19 11.4') + strand('M12.6 10.8 Q14.2 7.6 17.4 6.6') +
    ICO.p('M26.6 17.4 L30.6 18.4 L26.8 30 Q25.4 31 23.6 30.2 Z', gr[1]) + ICO.p('M30.6 18.4 L26.8 30 Q25.4 31 23.6 30.2 L24.8 26 L29.6 18.2 Z', gr[2], 'opacity=".55"') +
    ICO.l('M27.6 21 L29.4 21.6 M26.8 23.8 L28.6 24.4 M26 26.6 L27.8 27.2', gr[2], 0.7, rd) + ICO.c(28.6, 17, 2.2, kn[1]) + ICO.l('M23.9 29.9 Q25.3 30.8 26.6 29.8', kn[1], 1.1, rd);
}
const whipIcon = look => whipArt(look);
const ICON_LOOK = { katana: katanaIcon, whip: whipIcon };
// the scabbard: glossy black with silver fittings and a tied cord (drawn beside the sword in its icon, and at the hero's hip in the game)
function scabbardArt() {
  const rim = 'stroke="#8d97ab" stroke-width=".7"';                                         // a light rim so the black lacquer reads on a dark background
  return ICO.p('M6.2 3.2 Q8 2.2 9.8 3.2 L9.5 22 Q8 22.9 6.5 22 Z', '#2a2a38', rim) + ICO.l('M7.1 5 L7.3 20.5', 'rgba(255,255,255,.5)', 0.6, 'stroke-linecap="round"') +
    ICO.p('M6 3.4 Q8 1.8 10 3.4 L9.9 5.6 L6.1 5.6 Z', '#c5ccd8') + ICO.r(6.1, 19.8, 3.8, 2, '#c5ccd8', 0.4) +
    ICO.p('M5.4 11 H10.6 V13.2 H5.4 Z', '#4a4a5e', rim) + ICO.l('M10.2 12.4 Q13.4 13.2 12.2 16.4', '#6b7388', 1.1, 'stroke-linecap="round"');
}
// the hero's swords: the blade is stretched in the art itself (yb = where the blade starts, ty0 = its natural tip, gy = where the hand holds, s = pixels per art unit, lk = length over `len`)
const BLADE_SPEC = {
  wood: { yb: 19, ty0: 2, gy: 24.4, hx: 16, s: 1, lk: 1.4, make: bk => swordArt({ ...SWORD_STYLES.wood, bk }) },
  iron: { yb: 19, ty0: 2, gy: 24.4, hx: 16, s: 1, lk: 1.4, make: bk => swordArt({ ...SWORD_STYLES.iron, bk }) },
  flame: { yb: 19, ty0: 2, gy: 24.4, hx: 16, s: 1, lk: 1.4, make: bk => swordArt({ ...SWORD_STYLES.flame, bk }) },
  frost: { yb: 19, ty0: 2, gy: 24.4, hx: 16, s: 1, lk: 1.4, make: bk => swordArt({ ...SWORD_STYLES.frost, bk }) },
  holy: { yb: 19, ty0: 2, gy: 24.4, hx: 16, s: 1, lk: 1.4, make: bk => swordArt({ ...SWORD_STYLES.holy, bk }) },
  great: { yb: 19, ty0: 0.8, gy: 24.4, hx: 16, s: 1.1, lk: 1.3, make: bk => swordArt({ ...SWORD_STYLES.great, bk }) },
  dagger: { yb: 19, ty0: 6.5, gy: 23.6, hx: 16, s: 1, lk: 1.3, make: bk => daggerArt(bk) },
  rapier: { yb: 19, ty0: 1.2, gy: 24.7, hx: 16, s: 0.95, lk: 1.35, make: bk => rapierArt(bk) },
  katana: { fit: true, ty0: KATANA.top, maxY: KATANA.bottom + 1, gy: KATANA.gy, hx: KATANA.hx, lk: 1.5, wk: 1.55, make: (bk, look) => katanaArt(false, look) },     // the traced picture is not stretched: it is scaled evenly so its tip reaches the sword's length
};
// mix every colour in a piece of art towards one colour: a signature weapon is a known weapon in the colours of its boss
const blendHex = (c, to, k) => { const f = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(x => x + x).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); }, a = f(c), b = f(to); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
const recolor = (art, to, k = 0.45) => art.replace(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g, c => blendHex(c, to, k));
// a bow (drawn pointing right, tilted as an icon) and a staff (pointing up)
const bowArt = (wood, wood2, gem) => ICO.rot(-45,
  ICO.l('M7 3 Q31 16 7 29', '#3a2a18', 3.4, 'stroke-linecap="round"') + ICO.l('M7 3 Q31 16 7 29', wood, 2.2, 'stroke-linecap="round"') + ICO.l('M9.5 6 Q25 16 9.5 26', wood2, 0.8) +
  ICO.l('M7 3 L7 29', '#efe6c8', 0.7) + ICO.l('M7 16 L27 16', '#8a6a3c', 1.2) + ICO.p('M30 16 L26 13.6 L26 18.4 Z', '#dfe6ef') + ICO.p('M7 16 L3.6 13.8 L5.4 16 L3.6 18.2 Z', '#e8e0c8') + (gem ? ICO.c(19, 16, 1.7, gem) : ''), 1.05);
const staffArt = (col, wood = ICO.wood, trim = ICO.goldD) => ICO.rot(40,
  ICO.r(15, 9, 2.2, 22, wood, 0.6) + ICO.l('M17 10 V30', ICO.woodD, 0.5) + ICO.r(14.4, 24, 3.4, 2.2, ICO.leather, 0.6) + ICO.r(14.4, 15, 3.4, 2, ICO.leather, 0.6) +
  ICO.l('M12.4 8 Q11.2 2.6 16 2 Q20.8 2.6 19.6 8', trim, 1.6, 'stroke-linecap="round"') + ICO.c(16, 5.8, 5, 'rgba(255,255,255,.18)') + ICO.c(16, 5.8, 3.4, col) + ICO.c(15, 4.8, 1.2, 'rgba(255,255,255,.85)'), 1.1);
const WEAPON_ART = {
  wood:   ICO.rot(45, swordArt(SWORD_STYLES.wood), 1.34),
  iron:   ICO.rot(45, swordArt(SWORD_STYLES.iron), 1.34),
  flame:  ICO.rot(45, swordArt(SWORD_STYLES.flame), 1.34),
  frost:  ICO.rot(45, swordArt(SWORD_STYLES.frost), 1.34),
  holy:   ICO.rot(45, swordArt(SWORD_STYLES.holy), 1.34),
  great:  ICO.rot(45, swordArt(SWORD_STYLES.great), 1.26),
  dagger: ICO.rot(0, daggerArt()),                                   // as an icon it is shown as a crossed pair (see slotSvg)
  rapier: ICO.rot(40, rapierArt(), 1.28),
  katana: katanaIcon(),
  spear:  ICO.rot(40,
    ICO.r(15.1, 8, 1.8, 22.5, ICO.wood, 0.5) + ICO.l('M16.9 9 V30', ICO.woodD, 0.5) +
    ICO.p('M16 0.8 L19.6 7.8 L16 10.4 L12.4 7.8 Z', '#dfe6ef') + ICO.p('M16 0.8 L19.6 7.8 L16 10.4 Z', '#9aa8ba') + ICO.l('M16 2 V9', 'rgba(0,0,0,.25)', 0.6) +
    ICO.p('M12.8 10.2 H19.2 V12 H12.8 Z', ICO.red) + ICO.p('M17.5 12 Q20 15 18.2 18.5 Q18.8 14.5 16.8 12 Z', ICO.red)),
  axe:    ICO.rot(35,
    ICO.r(15, 6, 2, 25, ICO.wood, 0.5) + ICO.l('M17 7 V30', ICO.woodD, 0.5) + ICO.r(14.6, 27, 2.8, 3.4, ICO.leather, 0.6) +
    ICO.p('M17 4.5 C25.5 2.5 29 10 26 17.5 C23.4 14.4 20.4 13.6 17 13.8 Z', '#d3dbe6') + ICO.p('M26 17.5 C29 10 25.5 2.5 17 4.5 C24 6 26.6 11 24.6 16.2 Z', '#f4f8fc') +
    ICO.p('M15 6.4 L10.5 7.4 L15 9.8 Z', '#8b99ab') + ICO.l('M18 7 C22 6.4 24.2 8.6 24.4 11', ICO.steelD, 0.5)),
  hammer: ICO.rot(40,
    ICO.r(15, 10, 2, 21, ICO.wood, 0.5) + ICO.l('M17 11 V30', ICO.woodD, 0.5) + ICO.r(14.6, 26.5, 2.8, 4, ICO.leather, 0.6) +
    ICO.p('M7.5 3.5 H24.5 V12.5 H7.5 Z', '#aeb9c8') + ICO.p('M7.5 3.5 H24.5 V6.5 H7.5 Z', '#dfe6ef') + ICO.r(7.5, 3.5, 3, 9, '#7d8a9b', 0.8) + ICO.r(21.5, 3.5, 3, 9, '#7d8a9b', 0.8) +
    ICO.c(9, 8, 0.8, '#3c4552') + ICO.c(23, 8, 0.8, '#3c4552') + ICO.r(14.3, 12.5, 3.4, 1.8, ICO.goldD, 0.4)),
  scythe: ICO.rot(28,
    ICO.r(15.2, 6, 1.8, 25, ICO.wood, 0.5) + ICO.l('M17 7 V30', ICO.woodD, 0.5) + ICO.r(14.4, 15.5, 3.4, 2.2, ICO.leather, 0.6) + ICO.r(14.4, 23, 3.4, 2.2, ICO.leather, 0.6) +
    ICO.p('M16.2 4.4 C25.4 2.2 30 8.6 28.4 16.4 C25.8 10.8 21.6 8.2 16.2 8.8 Z', '#d9e1ec') + ICO.p('M28.4 16.4 C30 8.6 25.4 2.2 16.2 4.4 C23.6 5.6 27 10 26.6 14.6 Z', '#f6fafe') +
    ICO.r(13.6, 3.6, 4.4, 2.4, ICO.goldD, 0.6)),
  halberd: ICO.rot(35,
    ICO.r(15.2, 8, 1.7, 23, ICO.wood, 0.5) + ICO.l('M16.9 9 V30', ICO.woodD, 0.5) +
    ICO.p('M16 0.5 L19 7.4 L16 9.6 L13 7.4 Z', '#dfe6ef') + ICO.p('M16 0.5 L19 7.4 L16 9.6 Z', '#9aa8ba') +
    ICO.p('M17 10 C24.5 8.2 28 13.6 25.4 20 C23 17 20.4 16.4 17 16.6 Z', '#d3dbe6') + ICO.p('M25.4 20 C28 13.6 24.5 8.2 17 10 C23 11 25.6 15 24 18.6 Z', '#f4f8fc') +
    ICO.p('M15 11.4 L9.4 14 L15 15.4 Z', '#8b99ab') + ICO.r(13.4, 9.4, 5.2, 1.8, ICO.goldD, 0.4) + ICO.p('M15.4 22 Q12 25 14 29 Q15.6 25.6 16.8 22 Z', ICO.red)),
  bow:     bowArt('#b98a52', '#d8b27a'),
  longbow: bowArt('#7a5a30', '#a8844e', '#7fb0e0'),
  elven:   bowArt('#cfe9d4', '#8fd3a8', '#7fe0a0'),
  staff:   staffArt('#7fd0ff'),
  arcane:  staffArt('#c36bff', '#5a3a80', ICO.gold),
  archmage: staffArt('#ffd24a', '#e8e0c8', ICO.gold),
  whip:   whipIcon(),
  fist:   ICO.p('M8.5 12.5 Q8.5 10.5 10.6 10.5 H21.4 Q23.6 10.5 23.6 12.5 V21 Q23.6 23 21.6 23 H10.6 Q8.5 23 8.5 21 Z', '#a9b5c4') +
    ICO.p('M8.5 12.5 Q8.5 10.5 10.6 10.5 H21.4 Q23.6 10.5 23.6 12.5 V15 H8.5 Z', '#d3dbe6') + ICO.c(11.2, 9.6, 2.3, '#d3dbe6') + ICO.c(14.6, 8.9, 2.4, '#d3dbe6') + ICO.c(18.2, 8.9, 2.4, '#d3dbe6') + ICO.c(21.4, 9.6, 2.2, '#d3dbe6') +
    ICO.l('M13 15 V21 M16.5 15 V21 M20 15 V21', '#5d6a7a', 0.7) + ICO.p('M8.5 15.5 Q4 14.5 3.6 18 Q3.6 21.5 8.5 20.6 Z', '#c3ccd8') + ICO.l('M5.6 17 Q6.6 18.8 8 18.6', '#5d6a7a', 0.6) +
    ICO.p('M9 23 H23 V28.5 H9 Z', '#6f7886') + ICO.r(9, 23, 14, 2.2, ICO.gold, 0.4) + ICO.c(11.6, 26.4, 0.8, ICO.gold) + ICO.c(16, 26.4, 0.8, ICO.gold) + ICO.c(20.4, 26.4, 0.8, ICO.gold),
};
WEAPON_ART.horned = recolor(WEAPON_ART.axe, '#d9a066', 0.5);
WEAPON_ART.pilferer = recolor(WEAPON_ART.dagger, '#9be36f', 0.5);
WEAPON_ART.ooze = recolor(WEAPON_ART.whip, '#7fe07f', 0.5);
WEAPON_ART.glacier = recolor(WEAPON_ART.hammer, '#bfeaff', 0.6);
WEAPON_ART.sandreaper = recolor(WEAPON_ART.scythe, '#ffe08a', 0.5);
WEAPON_ART.magmaG = ICO.rot(45, recolor(swordArt(SWORD_STYLES.great), '#ff7a2a', 0.6), 1.26);
WEAPON_ART.lichbow = recolor(bowArt('#c9d6c9', '#a6f0b0', '#a6f0b0'), '#a6f0b0', 0.35);
WEAPON_ART.tempest = staffArt('#fff3a0', '#5a6a8a', '#fff3a0');
BLADE_SPEC.magmaG = { ...BLADE_SPEC.great, make: bk => recolor(swordArt({ ...SWORD_STYLES.great, bk }), '#ff7a2a', 0.6) };
BLADE_SPEC.pilferer = { ...BLADE_SPEC.dagger, make: bk => recolor(daggerArt(bk), '#9be36f', 0.5) };
// armor, by which armor it is (the order of BASE_NAMES.armor); every body is the same 32 x 32 tunic outline
const TUNIC = 'M11 5 L5 9.5 L7.8 14.5 L10 13 L10 27.5 L22 27.5 L22 13 L24.2 14.5 L27 9.5 L21 5 Q16 8.5 11 5 Z';
const patternDefs = (id, w, h, inner) => `<defs><pattern id="${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse">${inner}</pattern></defs>`;
const ARMOR_ART = [
  // Rags: a patched, torn tunic with a rope belt
  ICO.p('M11 5 L5 9.5 L7.8 14.5 L10 13 L10 27 L12 25.4 L14 28.2 L16 25.6 L18 28.2 L20 25.4 L22 27 L22 13 L24.2 14.5 L27 9.5 L21 5 Q16 8.5 11 5 Z', '#8f7f6c') + ICO.p('M12.4 5.8 Q16 10 19.6 5.8 Q16 12.4 12.4 5.8 Z', '#3d3228') +
    ICO.p('M12.5 15 H18 V19.6 H12.5 Z', '#6f8c5c') + ICO.l('M13.2 17.3 H17.3', '#d8d0bc', 0.6, 'stroke-dasharray="1 .8"') + ICO.l('M10 21.6 Q16 24 22 21.6', '#5a4630', 1.8) + ICO.l('M19 22 L20 26', '#5a4630', 1),
  // Jerkin: tan leather, laced up the front
  ICO.p(TUNIC, '#b99358') + ICO.l('M11.4 5.6 Q16 10.5 20.6 5.6', '#6b4a22', 1.4) + ICO.l('M16 9 V27', '#6b4a22', 0.9) + ICO.l('M13.8 11 L18.2 13 M18.2 11 L13.8 13 M13.8 15 L18.2 17 M18.2 15 L13.8 17 M13.8 19 L18.2 21 M18.2 19 L13.8 21', '#ecdcae', 0.8) + ICO.r(10, 25.2, 12, 2.3, '#6b4a22', 0.6),
  // Leather Vest: a dark open vest over a pale shirt, stitched, with a belt and buckle
  ICO.p('M12.5 6 L16 12 L19.5 6 V27.5 H12.5 Z', '#cdbea0') + ICO.p('M11 5 L5 9.5 L7.8 14.5 L10 13 V27.5 H15 V12 Q13 9.6 11 5 Z', '#7e5230') + ICO.p('M21 5 L27 9.5 L24.2 14.5 L22 13 V27.5 H17 V12 Q19 9.6 21 5 Z', '#7e5230') +
    ICO.l('M11.8 14 V26 M20.2 14 V26', '#dcae70', 0.6, 'stroke-dasharray="1.2 1.1"') + ICO.p('M10 21 H22 V23.6 H10 Z', '#3f2a17') + ICO.r(14.4, 20.6, 3.2, 3.4, ICO.gold, 0.6) + ICO.r(15.3, 21.5, 1.4, 1.6, '#3f2a17', 0.3),
  // Chain Shirt: steel rings, short sleeves
  patternDefs('mailp', 3, 3, '<circle cx="1.5" cy="1.5" r="1" fill="none" stroke="#4d5a6b" stroke-width=".55"/>') + ICO.p(TUNIC, '#a5b1c0') + ICO.p(TUNIC, 'url(#mailp)', 'stroke="none"') + ICO.l('M11.4 5.6 Q16 10 20.6 5.6', '#6f7886', 1.3) + ICO.r(10, 25, 12, 2.5, '#6f7886', 0.6),
  // Scale Mail: overlapping green scales
  patternDefs('scalep', 4, 4, '<g fill="#6fbb9b" stroke="#2f5f4e" stroke-width=".5"><circle cx="0" cy="0" r="2.2"/><circle cx="4" cy="0" r="2.2"/><circle cx="2" cy="2" r="2.2"/><circle cx="0" cy="4" r="2.2"/><circle cx="4" cy="4" r="2.2"/></g>') +
    ICO.p(TUNIC, '#4f8f78') + ICO.p(TUNIC, 'url(#scalep)', 'stroke="none"') + ICO.l('M11.4 5.6 Q16 10 20.6 5.6', '#2f5f4e', 1.4) + ICO.r(10, 25.4, 12, 2.1, '#2f5f4e', 0.6),
  // Plate Cuirass: polished steel with pauldrons, a ridge and gold trim
  ICO.p(TUNIC, '#bcc6d3') + ICO.p('M10.5 8 Q16 11.4 21.5 8 L22 17 Q16 21 10 17 Z', '#e8eef6') + ICO.p('M10 17 Q16 21 22 17 V23 Q16 27 10 23 Z', '#b2bdcb') + ICO.p('M10 23 Q16 27 22 23 V27.5 H10 Z', '#9aa6b6') +
    ICO.l('M16 10.5 V27', '#7a8798', 0.9) + ICO.l('M10.5 8 Q16 11.4 21.5 8', ICO.gold, 1.1) + ICO.p('M5 9.5 L8 6.2 L11.2 7.4 L10 13 L7.8 14.5 Z', '#e8eef6') + ICO.p('M27 9.5 L24 6.2 L20.8 7.4 L22 13 L24.2 14.5 Z', '#e8eef6') + ICO.c(16, 14.6, 1.2, ICO.gold),
  // Dragonhide: dark red scaled hide with bone spikes
  patternDefs('hidep', 3.4, 3.4, '<g fill="#a6403f" stroke="#4a1517" stroke-width=".45"><circle cx="0" cy="0" r="1.9"/><circle cx="3.4" cy="0" r="1.9"/><circle cx="1.7" cy="1.7" r="1.9"/><circle cx="0" cy="3.4" r="1.9"/><circle cx="3.4" cy="3.4" r="1.9"/></g>') +
    ICO.p(TUNIC, '#7a2a2e') + ICO.p(TUNIC, 'url(#hidep)', 'stroke="none"') + ICO.p('M5 9.5 L2.6 3.8 L8.6 7 Z', '#e3d6ae') + ICO.p('M27 9.5 L29.4 3.8 L23.4 7 Z', '#e3d6ae') + ICO.p('M10.2 8 Q16 11.6 21.8 8 L21 14 Q16 17 11 14 Z', '#c24c4a') + ICO.r(10, 25.2, 12, 2.3, '#3a1214', 0.6) + ICO.c(16, 12.6, 1.3, ICO.gold),
  // Aegis: a blue-steel shield-breastplate with a gold rim and a star
  ICO.p('M16 3 L26.4 7 V16 Q26.4 25.4 16 29.4 Q5.6 25.4 5.6 16 V7 Z', '#3b62ad') + ICO.p('M16 3 L26.4 7 V16 Q26.4 25.4 16 29.4 Z', '#2f4f90') + ICO.l('M16 3 L26.4 7 V16 Q26.4 25.4 16 29.4 Q5.6 25.4 5.6 16 V7 Z', ICO.gold, 1.6, 'stroke-linejoin="round"') +
    ICO.p('M16 8 L17.9 13 L23.2 13.3 L19.1 16.6 L20.5 21.8 L16 18.9 L11.5 21.8 L12.9 16.6 L8.8 13.3 L14.1 13 Z', '#f3d56e', 'stroke="#9c7a22" stroke-width=".5"'),
];
// the Secret armor: a hooded cloak with glowing eyes
const CLOAK_ART = ICO.p('M16 2.4 Q8.4 5 8.4 13 L4.4 28.6 L16 25.6 L27.6 28.6 L23.6 13 Q23.6 5 16 2.4 Z', '#2c2252') + ICO.p('M16 6 Q11.4 8.6 12 14.2 Q16 17.4 20 14.2 Q20.6 8.6 16 6 Z', '#0c0a1b') +
  ICO.c(14.2, 12, 1, '#43f2da') + ICO.c(17.8, 12, 1, '#43f2da') + ICO.l('M8.4 13 L4.4 28.6 L16 25.6 L27.6 28.6 L23.6 13', '#6c5aba', 0.8) + ICO.c(16, 19.4, 1.5, '#43f2da') + ICO.l('M16 21 V25', '#6c5aba', 0.8);
const armorIndex = it => {
  for (let i = BASE_NAMES.armor.length - 1; i >= 0; i--) if (String(it.name).includes(BASE_NAMES.armor[i])) return i;
  return Math.min(7, Math.round(it.rarity * 0.8 + 1));
};
const splitArt = art => { const m = /<!--rot:(-?[\d.]+):([\d.]+)-->$/.exec(art); return { body: m ? art.slice(0, m.index) : art, deg: m ? +m[1] : 0, k: m ? +m[2] : 1 }; };
const iconBody = (slot, item) => {
  if (slot === 'weapon') {
    const { body, deg, k } = splitArt((item.look && ICON_LOOK[item.base] ? ICON_LOOK[item.base](item.look) : WEAPON_ART[item.base]) || WEAPON_ART.iron);
    return item.base === 'dagger' || item.base === 'pilferer' ? `<g transform="rotate(-30 16 16)">${body}</g><g transform="rotate(30 16 16)">${body}</g>` : `<g transform="translate(16 16) rotate(${deg}) scale(1 ${k}) translate(-16 -16)">${body}</g>`;
  }
  if (slot !== 'armor') { const A = SLOT_ART[slot]; return item.rarity === 7 ? A.secret : A.list[baseIndex(slot, item)]; }
  return item.rarity === 7 ? CLOAK_ART : ARMOR_ART[armorIndex(item)];
};
const SVG_ATTRS = 'stroke="#17171f" stroke-width=".9" stroke-linejoin="round" stroke-linecap="round"';
// Helmets, rings and necklaces: drawn like the weapons and armor (filled shapes, a light and a dark side, gems and trim). One per base name, plus one for each Secret piece.
const steelHelm = (light = '#c1cad5', dark = '#9faab8') => ICO.p('M6 22 Q6 6.5 16 6.5 Q26 6.5 26 22 V26 H21.5 V21 H10.5 V26 H6 Z', dark) + ICO.p('M16 6.5 Q6 6.5 6 22 V26 H10.5 V21 H16 Z', light);
const HELM_ART = [
  // Cap: a plain cloth cap with a brim and a button
  ICO.p('M5.5 21 Q5.5 8 16 8 Q26.5 8 26.5 21 Z', '#8f6c47') + ICO.p('M16 8 Q5.5 8 5.5 21 H16 Z', '#a98259') + ICO.p('M4.5 20.5 H27.5 V24.5 Q16 27 4.5 24.5 Z', '#5f4128') +
    ICO.l('M16 8 V20.5 M10.5 9.5 Q9 15 9.5 20.5 M21.5 9.5 Q23 15 22.5 20.5', '#5f4128', 0.7) + ICO.c(16, 7.5, 1.9, '#5f4128'),
  // Hood: a green hood with a dark opening
  ICO.p('M16 3.5 Q7.5 7 6.5 23 Q16 27.5 25.5 23 Q24.5 7 16 3.5 Z', '#5d8a55') + ICO.p('M16 3.5 Q7.5 7 6.5 23 Q11 25.5 16 26 Z', '#74a368') + ICO.p('M11 16 Q16 10.5 21 16 Q21.5 23.5 16 24.5 Q10.5 23.5 11 16 Z', '#25180f') +
    ICO.p('M10 24 Q16 28 22 24 L21 26.5 Q16 29.5 11 26.5 Z', '#3d6538') + ICO.l('M16 3.5 V9', '#3d6538', 0.8),
  // Leather Cap: stitched leather with ear flaps
  ICO.p('M5.5 20 Q5.5 7.5 16 7.5 Q26.5 7.5 26.5 20 Z', '#8a5a32') + ICO.p('M16 7.5 Q5.5 7.5 5.5 20 H16 Z', '#a56f3f') + ICO.p('M5 19 H27 V22.5 H5 Z', '#5a3820') +
    ICO.p('M5.5 22 L8 28.5 L12.5 26 L12 22 Z', '#7a4c2a') + ICO.p('M26.5 22 L24 28.5 L19.5 26 L20 22 Z', '#7a4c2a') + ICO.l('M7 20.8 H25', '#e8c98e', 0.6, 'stroke-dasharray="1.4 1"') + ICO.l('M10 9.5 Q9 14 9.5 19 M22 9.5 Q23 14 22.5 19', '#5a3820', 0.7),
  // Iron Helm: a steel dome with a nose guard and a brow band
  steelHelm() + ICO.p('M15 6.5 Q16 3.8 17 6.5 Z', '#7c8896') + ICO.r(14.3, 12, 3.4, 13, '#7c8896', 0.6) + ICO.r(6, 16, 20, 2.4, '#7c8896', 0.8) + ICO.c(9, 17.2, 0.8, '#e6edf5') + ICO.c(23, 17.2, 0.8, '#e6edf5') + ICO.c(16, 17.2, 0.8, '#e6edf5'),
  // Great Helm: a full steel bucket with a visor slit
  ICO.p('M7 9 Q7 5.5 16 5.5 Q25 5.5 25 9 V25.5 H7 Z', '#9ca7b5') + ICO.p('M16 5.5 Q7 5.5 7 9 V25.5 H16 Z', '#c0c9d4') + ICO.r(8.5, 14.5, 15, 2.6, '#2a2f38', 0.8) + ICO.r(14.7, 8, 2.6, 17.5, '#7a8694', 0.6) +
    [10, 13, 19, 22].map(x => ICO.c(x, 20.5, 0.75, '#2a2f38') + ICO.c(x, 23, 0.75, '#2a2f38')).join(''),
  // Crowned Helm: steel with a gold crown and a ruby
  ICO.p('M6.5 24 Q6.5 10 16 10 Q25.5 10 25.5 24 V27 H21 V22.5 H11 V27 H6.5 Z', '#9faab8') + ICO.p('M16 10 Q6.5 10 6.5 24 V27 H11 V22.5 H16 Z', '#c1cad5') + ICO.r(14.4, 14, 3.2, 9, '#7c8896', 0.6) +
    ICO.p('M7 10 L8.8 3.8 L12.5 8.2 L16 2.6 L19.5 8.2 L23.2 3.8 L25 10 Z', '#f0c04c') + ICO.r(6.6, 9, 18.8, 2.2, '#c9962c', 0.6) + ICO.c(16, 6.2, 1.5, '#e0524f') + ICO.c(9, 6.8, 0.9, '#7fd08a') + ICO.c(23, 6.8, 0.9, '#6fb5ff'),
  // Horned Helm: a dark helm with two bone horns
  ICO.p('M8 14 Q1.5 12.5 2.2 3.5 Q6.5 8 11 10 Z', '#efe3c0') + ICO.p('M24 14 Q30.5 12.5 29.8 3.5 Q25.5 8 21 10 Z', '#efe3c0') + steelHelm('#8c97a6', '#6c7684') + ICO.r(6, 16, 20, 2.4, '#4d5560', 0.8) + ICO.r(14.3, 12, 3.4, 13, '#4d5560', 0.6) + ICO.r(8.5, 18.8, 4, 1.4, '#1c2026', 0.4) + ICO.r(19.5, 18.8, 4, 1.4, '#1c2026', 0.4),
  // Warden Helm: blue steel with gold trim and a red crest
  ICO.p('M16 2.5 Q23 4 25 12 Q19.5 9 16 12 Q12.5 9 7 12 Q9 4 16 2.5 Z', '#d9453f') + ICO.p('M16 2.5 Q9 4 7 12 Q12.5 9 16 12 Z', '#ef6a5f') +
    steelHelm('#6d8fd6', '#4a6cb2') + ICO.r(6, 15.5, 20, 2, '#efc86c', 0.6) + ICO.r(14.8, 15.5, 2.4, 10, '#efc86c', 0.6) + ICO.r(9, 19, 4.4, 1.5, '#161e33', 0.4) + ICO.r(18.6, 19, 4.4, 1.5, '#161e33', 0.4) + ICO.c(16, 12.8, 1.1, '#fff3b0'),
];
// the Secret helmet: a dark crown whose three eyes glow
const HELM_SECRET = ICO.p('M5 24 V15 L9 19 L12.5 8 L16 17 L19.5 8 L23 19 L27 15 V24 Z', '#3b2b66') + ICO.p('M16 17 L19.5 8 L23 19 L27 15 V24 H16 Z', '#2c2050') + ICO.r(5, 21.5, 22, 3.6, '#6c5aba', 0.8) +
  [[10.5, 15], [16, 12.5], [21.5, 15]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.5" ry="1.7" fill="#43f2da"/>` + ICO.c(x, y, 0.8, '#0c0a1b')).join('') + ICO.c(16, 23.3, 1.2, '#43f2da');

const ringBand = (m, light = 'rgba(255,255,255,.55)') => ICO.p('M6.5 20 A9.5 8.5 0 1 0 25.5 20 A9.5 8.5 0 1 0 6.5 20 Z', m) + ICO.p('M10.5 20 A5.5 4.5 0 1 0 21.5 20 A5.5 4.5 0 1 0 10.5 20 Z', '#1d1410') + ICO.l('M8.2 18.5 Q10 12.8 16 11.8', light, 0.9, 'stroke-linecap="round"');
const star5 = (cx, cy, R, r) => Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, k = i % 2 ? r : R; return `${(cx + Math.cos(a) * k).toFixed(2)} ${(cy + Math.sin(a) * k).toFixed(2)}`; }).join(' L');
const RING_ART = [
  ringBand('#c9794a') + ICO.p('M13 11.5 Q16 9 19 11.5 L18 14 Q16 12.6 14 14 Z', '#de9262'),                                                    // Copper Ring
  ringBand('#b58a3f') + ICO.l('M8.2 23 Q16 30 23.8 23', 'rgba(60,35,10,.6)', 0.8, 'stroke-dasharray="1.5 1.2"') + ICO.p('M12.5 12 H19.5 V14.5 H12.5 Z', '#d6aa5a'),     // Bronze Band
  ringBand('#cfd6e0') + ICO.p('M16 4.5 L19.6 8.8 L16 13.8 L12.4 8.8 Z', '#eef9ff') + ICO.l('M12.4 8.8 H19.6 M16 4.5 V13.8', 'rgba(120,170,210,.7)', 0.6),   // Silver Ring with a diamond
  ringBand('#f0c14e') + ICO.p('M12 11.5 Q16 5.5 20 11.5 L18.6 14 H13.4 Z', '#d79a2e') + ICO.c(16, 8.8, 3.6, '#e0524f') + ICO.c(14.9, 7.7, 1.1, '#fff'),    // Gold Ring with a ruby
  ringBand('#f0c14e') + `<ellipse cx="16" cy="9.5" rx="6.6" ry="4.4" fill="#f7d97a"/>` + ICO.l('M16 6.8 V12.2 M13.3 9.5 H18.7', '#9a742c', 1.3, 'stroke-linecap="round"'),    // Signet
  ringBand('#f0c14e') + ICO.p('M9 13 Q16 6 23 13 L21 15 H11 Z', '#d79a2e') + ICO.c(16, 8.8, 3.2, '#4f8cff') + ICO.c(10.8, 11.6, 2.2, '#5fd07a') + ICO.c(21.2, 11.6, 2.2, '#e0524f') + ICO.c(15.2, 8, 0.9, '#fff'),   // Jewelled Ring
  ringBand('#4a4f62', 'rgba(255,255,255,.35)') + ICO.l('M8.4 21.5 L9.8 24.5 M12 25.5 V28.2 M16 26.3 V29 M20 25.5 V28.2 M23.6 21.5 L22.2 24.5', '#43f2da', 1.1, 'stroke-linecap="round"') + ICO.p('M13.5 12 Q16 8.5 18.5 12 L17.4 14 H14.6 Z', '#383c4e') + ICO.c(16, 9.8, 2, '#43f2da'),   // Rune Band
  ringBand('#f0c14e') + ICO.p('M10.5 14 Q16 11 21.5 14 L19 15.5 H13 Z', '#d79a2e') + ICO.p('M' + star5(16, 8.6, 5.2, 2.4) + ' Z', '#fff3a0'),     // Star Ring
];
const RING_SECRET = ringBand('#2c2252', 'rgba(160,140,255,.5)') + ICO.l('M16 2 V4.5 M7.5 5.5 L9.4 7.4 M24.5 5.5 L22.6 7.4 M4.5 12 H7 M25 12 H27.5', '#43f2da', 1.2, 'stroke-linecap="round"') + ICO.p('M12.5 12 Q16 6 19.5 12 L18 14.5 H14 Z', '#6c5aba') + ICO.c(16, 9, 3.4, '#43f2da') + ICO.c(15, 8, 1, '#fff');

const chainPath = 'M5 5 Q16 27 27 5';
const chain = (col, w = 1.6, dash = '') => ICO.l(chainPath, '#17171f', w + 1.6) + ICO.l(chainPath, col, w, dash ? `stroke-dasharray="${dash}"` : '');
const onChain = t => { const u = 1 - t; return [u * u * 5 + 2 * u * t * 16 + t * t * 27, u * u * 5 + 2 * u * t * 27 + t * t * 5]; };
const NECK_ART = [
  chain('#7a5230', 1.4) + ICO.p('M13.6 15 Q16 12.4 18.4 15 L17.2 23.5 Q16 25 14.8 23.5 Z', '#efe3c0') + ICO.l('M16 14.6 V22', '#c9b88a', 0.6),                                     // String Charm: a fang on a string
  chain('#7a5230', 1.2) + [0.14, 0.29, 0.5, 0.71, 0.86].map((t, i) => { const [x, y] = onChain(t), s = i === 2 ? 1.4 : 1; return ICO.p(`M${(x - 2 * s).toFixed(1)} ${(y - 0.5).toFixed(1)} Q${x.toFixed(1)} ${(y - 2).toFixed(1)} ${(x + 2 * s).toFixed(1)} ${(y - 0.5).toFixed(1)} L${(x + 0.4).toFixed(1)} ${(y + 5.2 * s).toFixed(1)} Q${x.toFixed(1)} ${(y + 6.2 * s).toFixed(1)} ${(x - 0.4).toFixed(1)} ${(y + 5.2 * s).toFixed(1)} Z`, '#f2ead0'); }).join(''),   // Bone Necklace
  chain('#cfd6e0', 1.4, '2 1.2') + ICO.c(16, 18.2, 5.6, '#cfd6e0') + ICO.c(16, 18.2, 4, '#4f8cff') + ICO.c(14.6, 16.8, 1.2, '#fff') + ICO.p('M14 12.6 Q16 10.5 18 12.6 L17 13.6 H15 Z', '#cfd6e0'),   // Pendant
  chain('#f0c14e', 1.5, '2 1.2') + ICO.c(16, 18.8, 6, '#f0c14e') + ICO.c(16, 18.8, 4.4, '#d79a2e') + ICO.c(16, 18.8, 2.2, '#fff0a8') + ICO.l('M16 12.6 V14 M16 23.6 V25 M10 18.8 H11.4 M20.6 18.8 H22', '#f0c14e', 1.1, 'stroke-linecap="round"'),   // Amulet: a golden sun disc
  chain('#5a3a22', 1.5) + ICO.p('M16 12.5 L21.4 18.6 L16 25.4 L10.6 18.6 Z', '#43c7b5') + ICO.p('M16 12.5 L10.6 18.6 L16 25.4 Z', '#7be0d0') + ICO.l('M16 12.5 L21.4 18.6 L16 25.4 L10.6 18.6 Z', '#f0c14e', 1.4, 'stroke-linejoin="round"') + ICO.l('M13 16 L16 14', 'rgba(255,255,255,.8)', 0.8),   // Talisman
  chain('#f0c14e', 1.5, '2 1.2') + ICO.p('M16 12.4 C22.4 12.4 23 22.4 16 26 C9 22.4 9.6 12.4 16 12.4 Z', '#f0c14e') + ICO.p('M16 15 C20 15 20.4 21.2 16 23.6 C11.6 21.2 12 15 16 15 Z', '#d79a2e') + ICO.l('M12.4 15.4 Q13 13.6 15 13.2', 'rgba(255,255,255,.6)', 0.8),   // Locket
  ICO.l('M9 25 Q3.5 15 11.5 8.2 Q16 5 20.5 8.2 Q28.5 15 23 25', '#17171f', 5.6) + ICO.l('M9 25 Q3.5 15 11.5 8.2 Q16 5 20.5 8.2 Q28.5 15 23 25', '#f0c14e', 3.4) + ICO.l('M7.5 17 Q9 10 14 7.6', 'rgba(255,255,255,.55)', 0.9) + ICO.c(9, 25.2, 2.6, '#f7d97a') + ICO.c(23, 25.2, 2.6, '#f7d97a'),   // Torque: a gold collar with ball ends
  chain('#cfd6e0', 1.3, '2 1.2') + ICO.p('M16 26.5 C5.5 19.5 7.5 11 13 12.2 C14.6 12.5 15.6 13.8 16 14.8 C16.4 13.8 17.4 12.5 19 12.2 C24.5 11 26.5 19.5 16 26.5 Z', '#e0394a') + ICO.p('M16 14.8 C15.6 13.8 14.6 12.5 13 12.2 C7.5 11 5.5 19.5 16 26.5 Z', '#f0626f') + ICO.c(12.6, 15.4, 1.4, 'rgba(255,255,255,.75)'),   // Heartstone
];
const NECK_SECRET = chain('#6c5aba', 1.5, '2 1.2') + ICO.p('M16 26.5 C5.5 19.5 7.5 11 13 12.2 C14.6 12.5 15.6 13.8 16 14.8 C16.4 13.8 17.4 12.5 19 12.2 C24.5 11 26.5 19.5 16 26.5 Z', '#2fd8c4') + `<ellipse cx="16" cy="19" rx="3.6" ry="2.3" fill="#0c0a1b"/>` + ICO.c(16, 19, 1.2, '#43f2da') + ICO.c(12.6, 15.2, 1.2, 'rgba(255,255,255,.7)');
// Artifacts: small lucky things, one design for each of the eight bases, and the Secret one
const ARTIFACT_ART = [
  ICO.l('M16 3.5 V8.5', '#8b99ab', 1.4) + ICO.c(16, 18.6, 9.6, '#8c8f9a') + ICO.c(16, 18.6, 7.2, '#a3a6b2') + ICO.l('M12.6 10.6 L16 17.4 L13.8 21.4 L17.4 27', '#23232c', 1.3, 'stroke-linejoin="round"') + ICO.c(12.6, 14, 1.5, 'rgba(255,255,255,.5)'),          // Cracked Charm: a chipped stone on a loop
  ICO.l('M16 2.5 V6.5', '#cfd6e0', 1.6) + ICO.c(16, 18, 10.4, '#aeb7c4') + ICO.c(16, 18, 8.2, '#eef2f7') + ICO.p('M16 10.6 L18 18 L16 25.4 L14 18 Z', '#d6dbe3') + ICO.p('M16 10.6 L18 18 H14 Z', '#e0394a') + ICO.l('M16 8.6 V10.2 M16 25.8 V27.4 M7.6 18 H9.2 M22.8 18 H24.4', '#6a7380', 0.9) + ICO.c(16, 18, 1.2, '#f0c14e'),   // Tin Compass
  ICO.p('M12 14 H20 L22 27 H10 Z', '#efe3c0') + ICO.c(16, 9.6, 5.2, '#efe3c0') + ICO.c(14, 9, 1.2, '#23232c') + ICO.c(18, 9, 1.2, '#23232c') + ICO.l('M13.6 12.2 H18.4', '#23232c', 0.9) + ICO.l('M10.6 18 L5.8 22 M21.4 18 L26.2 22', '#efe3c0', 2.2, 'stroke-linecap="round"') + ICO.l('M13 20 H19 M12.6 23.4 H19.4', '#b9a276', 0.9),   // Bone Idol
  ICO.c(16, 16, 11.4, '#f0c14e') + ICO.c(16, 16, 9.2, '#d79a2e') + ICO.p('M16 16 C12 8.4 6.6 13 16 16 C25.4 13 20 8.4 16 16 C24 12 23.6 22.4 16 16 C23.6 22 17 26.4 16 16 C10 24 6.6 19 16 16 C8 20.4 8 11.6 16 16 Z', '#6fbf4a') + ICO.c(16, 16, 1.4, '#f0c14e') + ICO.l('M10.4 9.4 Q13 7 16 6.4', 'rgba(255,255,255,.6)', 0.9),   // Lucky Coin: a four-leaf clover on a gold coin
  ICO.r(7, 4.4, 18, 3.2, '#f0c14e', 1) + ICO.r(7, 24.4, 18, 3.2, '#f0c14e', 1) + ICO.p('M9.6 7.6 H22.4 Q22.4 14.6 17.4 16 Q22.4 17.4 22.4 24.4 H9.6 Q9.6 17.4 14.6 16 Q9.6 14.6 9.6 7.6 Z', 'rgba(190,225,245,.55)') + ICO.p('M11.6 8.4 H20.4 Q20.2 12.4 16 14 Q11.8 12.4 11.6 8.4 Z', '#e8c76a') + ICO.p('M13.2 23.6 Q14.6 19 16 18.4 Q17.4 19 18.8 23.6 Z', '#e8c76a'),   // Hourglass
  ICO.p('M16 4.6 L26.4 24.6 H5.6 Z', 'rgba(210,230,255,.7)') + ICO.p('M16 4.6 L5.6 24.6 L16 20 Z', 'rgba(255,255,255,.55)') + ICO.l('M2.6 17.6 L11 17.6', '#fff', 1.2) + ICO.l('M18.6 15.8 L29.6 11.6', '#ff5a7a', 1.3) + ICO.l('M19.2 18.4 L29.8 18', '#ffd24a', 1.3) + ICO.l('M19.4 21 L29.4 24.4', '#4fd0ff', 1.3),   // Prism Shard splitting a beam
  ICO.c(16, 16, 11.6, '#2a2f6a') + ICO.c(16, 16, 11.6, 'rgba(79,140,255,.35)') + ICO.p('M16 7.4 L18 13.4 L24.4 13.8 L19.4 17.8 L21.2 24 L16 20.4 L10.8 24 L12.6 17.8 L7.6 13.8 L14 13.4 Z', '#ffe07a') + ICO.c(11.6, 10.4, 2.6, 'rgba(255,255,255,.45)'),   // Star Orb
  ICO.p('M2.6 16 Q16 2.6 29.4 16 Q16 29.4 2.6 16 Z', '#f4efe2') + ICO.c(16, 16, 6.2, '#f0b429') + ICO.c(16, 16, 3.4, '#23232c') + ICO.c(14.4, 14.4, 1.3, '#fff') + ICO.l('M3.4 16 Q16 4.4 28.6 16', '#6a7380', 0.9) + ICO.p('M16 25.6 L18 29 L16 31 L14 29 Z', '#e0394a'),   // Eye of Fortune: a golden eye with a ruby drop
];
const ARTIFACT_SECRET = ICO.p('M22.6 4.6 A12.4 12.4 0 1 0 22.6 27.4 A9.6 9.6 0 1 1 22.6 4.6 Z', '#2fd8c4') + ICO.p('M22.6 4.6 A12.4 12.4 0 0 0 11 8.4 A10.2 10.2 0 0 1 22.6 6.2 Z', '#8ff7ea') + ICO.p('M25.4 12 L26.4 14.6 L29 14.8 L27 16.6 L27.6 19.2 L25.4 17.8 L23.2 19.2 L23.8 16.6 L21.8 14.8 L24.4 14.6 Z', '#fff0a8') + ICO.c(8.6, 8.4, 1.1, '#43f2da') + ICO.c(6.4, 22.6, 1.1, '#43f2da');
// a rune: a dark cut stone with its glyph glowing in its own colour (used in the forge, the shop, the inventory and as the drop on the ground)
const runeSvg = (k, px = 34) => {
  const R = RUNES[k], t = R.tier, edge = t > 1 ? R.tc : R.color, w = t > 1 ? 1.4 + t * 0.2 : 1.4;
  const halo = t >= 3 ? `<circle cx="16" cy="16" r="${12 + t}" fill="${R.tc}" opacity="${0.05 + t * 0.025}"/>` : '';
  const spark = t >= 5 ? `<path d="M16 -2.5 V0.5 M16 31.5 V34.5 M-2.5 16 H0.5 M31.5 16 H34.5" stroke="${R.tc}" stroke-width="1.4" stroke-linecap="round"/>` : '';
  const pips = Array.from({ length: t }, (_, n) => `<circle cx="${16 + (n - (t - 1) / 2) * 4.2}" cy="32.8" r="1.25" fill="${R.tc}"/>`).join('');
  return `<svg viewBox="-3 -3 38 38" width="${px}" height="${px}">${halo}${spark}<path d="M16 2 L28 9 V23 L16 30 L4 23 V9 Z" fill="#262432" stroke="${edge}" stroke-width="${w}" stroke-linejoin="round"/><path d="M16 5 L25.4 10.4 V21.6 L16 27 L6.6 21.6 V10.4 Z" fill="rgba(255,255,255,.05)"/><path d="${R.glyph}" fill="none" stroke="${R.color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>${pips}</svg>`;
};
const SLOT_ART = { helmet: { list: HELM_ART, secret: HELM_SECRET }, ring: { list: RING_ART, secret: RING_SECRET }, necklace: { list: NECK_ART, secret: NECK_SECRET }, artifact: { list: ARTIFACT_ART, secret: ARTIFACT_SECRET } };
const baseIndex = (slot, it) => {
  const names = BASE_NAMES[slot];
  for (let i = names.length - 1; i >= 0; i--) if (String(it.name).includes(names[i])) return i;
  return Math.min(7, Math.round(it.rarity * 0.8 + 1));
};
const slotSvg = (slot, c, item) => {
  if (item && (slot === 'weapon' || slot === 'armor' || SLOT_ART[slot])) return `<svg viewBox="0 0 32 32" width="44" height="44" ${SVG_ATTRS}>${iconBody(slot, item)}</svg>`;
  const p = {
    weapon: '<path d="M6 22 L20 8 M17 5 L23 11 M5 19 L9 23 M6 22 L3 25" />',
    armor: '<path d="M8 6 L5 11 L8 14 L8 24 L20 24 L20 14 L23 11 L20 6 L16 8 L12 8 Z" />',
    helmet: '<path d="M5 17 Q5 6 14 6 Q23 6 23 17 L23 21 L18 21 L18 17 L10 17 L10 21 L5 21 Z" />',
    ring: '<circle cx="14" cy="17" r="6" /><path d="M11 9 L14 5 L17 9 Z" />',
    necklace: '<path d="M5 7 Q14 24 23 7" /><circle cx="14" cy="19" r="2.6" />',
    artifact: '<circle cx="14" cy="16" r="7" /><path d="M14 9 V4 M10 16 H18 M14 12 V20" />',
  }[slot];
  return `<svg viewBox="0 0 28 28" width="26" height="26" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
};

// --- The same designs on the hero: the equipped weapon is drawn in the hand (an image made once from the art, drawn by game.js). Armor is drawn on the body by game.js (drawArmor), in the colours of its icon. ---
// WEAPON_GEOM: where the hand holds the weapon (gy, in the 32 x 32 art, and hx) and where its point is (ty); the weapon's `len` fixes how big it is on screen.
const WEAPON_GEOM = {                                                // lk: how much longer than `len` it is drawn; sx: width scale (px per art unit), so long weapons stay slim
  def: { hx: 16, gy: 24.4, ty: 2, lk: 1.4, sx: 0.95 }, great: { hx: 16, gy: 24.4, ty: 0.8, lk: 1.4, sx: 1 }, rapier: { hx: 16, gy: 24.7, ty: 1.2, lk: 1.35, sx: 0.95 },
  katana: { hx: 14.5, gy: 25.8, ty: 1.2, lk: 1.35, sx: 0.95 }, dagger: { hx: 16, gy: 23.6, ty: 6.5, lk: 1.3, sx: 0.95 },
  spear: { hx: 16, gy: 19, ty: 0.8, lk: 1, sx: 0.8 }, axe: { hx: 16, gy: 20, ty: 3, lk: 1.1, sx: 0.95 }, hammer: { hx: 16, gy: 22, ty: 3.5, lk: 1.1, sx: 1 },
  scythe: { hx: 16, gy: 20, ty: 3, lk: 1.05, sx: 0.95 }, halberd: { hx: 16, gy: 22, ty: 0.5, lk: 1, sx: 0.85 },
};
WEAPON_GEOM.horned = WEAPON_GEOM.axe; WEAPON_GEOM.glacier = WEAPON_GEOM.hammer; WEAPON_GEOM.sandreaper = WEAPON_GEOM.scythe;
function weaponLength(sw) {                                         // how far the weapon reaches from the hand on screen (the hero's picture is drawn to this length); the hit area follows it
  const bs = BLADE_SPEC[sw.id];
  return bs ? sw.len * bs.lk + 4 : sw.len * (WEAPON_GEOM[sw.id] || WEAPON_GEOM.def).lk;
}
const spriteCache = {};
function artImage(key, body, minY = 0, H = 32) {
  let e = spriteCache[key];
  if (!e) {
    e = spriteCache[key] = { img: new Image(), ok: false };
    e.img.onload = () => { e.ok = true; };
    e.img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${minY} 32 ${H}" width="128" height="${H * 4}" ${SVG_ATTRS}>${body}</svg>`);
  }
  return e.ok ? e.img : null;
}
function weaponSprite(sw) {
  if (sw.kind === 'whip' || sw.kind === 'fist' || sw.kind === 'bow' || sw.kind === 'staff') return null;                // these are drawn by hand (the lash moves, the fists are on both hands)
  const bs = BLADE_SPEC[sw.id];
  if (bs) {                                                          // a sword: the blade is longer in the art, the hilt keeps its proportions
    const D = sw.len * bs.lk + 4;
    let sc, bk, tipY, H, minY;
    if (bs.fit) { sc = D / (bs.gy - bs.ty0); bk = 1; tipY = bs.ty0; minY = Math.floor(tipY) - 1; H = bs.maxY - minY; }
    else { sc = bs.s; const Lb = bs.yb - bs.ty0; bk = Math.max(1, (D / sc - (bs.gy - bs.yb)) / Lb); tipY = bs.yb - Lb * bk; minY = Math.floor(tipY) - 1; H = 31 - minY; }
    const look = sw.id === 'katana' ? heroLook(sw) : null;
    const img = (look && artImage('b:' + sw.id + JSON.stringify(katLook(look)), bs.make(bk, look), minY, H)) || artImage('b:' + sw.id, bs.make(bk), minY, H);      // while a look's picture loads, the plain one stands in
    return img ? { img, g: { hx: bs.hx, gy: bs.gy }, blade: true, s: sc, wk: bs.wk || 1, minY, H, tipY } : null;
  }
  const img = artImage('w:' + sw.id, splitArt(WEAPON_ART[sw.id] || WEAPON_ART.iron).body);
  return img ? { img, g: WEAPON_GEOM[sw.id] || WEAPON_GEOM.def } : null;
}
function itemById(sel) {
  if (!sel) return null;
  if (sel.src === 'bag') return hero.inv.find(i => i.id === sel.id) || null;
  return activeSlots().map(k => hero.equip[k]).find(i => i && i.id === sel.id) || null;
}
function statRows(item, versus) {
  const rows = [];
  for (const k in item.stats) {
    const S = GEAR_STATS[k], diff = versus ? item.stats[k] - (versus.stats[k] || 0) : null;
    const dtxt = diff === null || Math.abs(diff) < 1e-9 ? '' : ` <small class="${diff > 0 ? 'up' : 'down'}">(${diff > 0 ? '+' : '−'}${S.fmt(Math.abs(diff)).replace('+', '')})</small>`;
    rows.push(`<div class="srow"><span>${S.name}</span><b>${S.fmt(item.stats[k])}${dtxt}</b></div>`);
  }
  for (const rk of item.rn || []) { const R = RUNES[rk]; rows.push(`<div class="srow"><span style="color:${R.color}">◆ ${R.title}</span><b>${GEAR_STATS[R.stat].fmt(R.val)}</b></div>`); }
  const free = socketsOf(item) - (item.rn || []).length; if (free > 0) rows.push(`<div class="srow"><span>◇ Free socket${free > 1 ? 's' : ''}</span><b>${free}</b></div>`);
  if (versus) for (const k in versus.stats) if (!(k in item.stats)) rows.push(`<div class="srow"><span>${GEAR_STATS[k].name}</span><b class="down">${GEAR_STATS[k].fmt(0)} <small class="down">(−${GEAR_STATS[k].fmt(versus.stats[k]).replace('+', '')})</small></b></div>`);
  return rows.join('');
}
function weaponLine(item) {
  const sw = SWORDS.find(s => s.id === item.base); if (!sw) return '';
  const fx = [sw.burn && 'burn', sw.slow && 'slow', sw.stun && 'stuns', sw.pull && 'pulls in', sw.back && 'hits behind', sw.critBonus && `+${Math.round(sw.critBonus * 100)}% crit`, sw.lifesteal && 'life steal'].filter(Boolean).join(', ');
  const own = item.fx ? `<div class="srow"><span style="color:${WFX[item.fx.k].color}">${WFX[item.fx.k].name} ${ROMAN[item.fx.lv]}</span><b>${wfxText(item.fx.k, item.fx.lv, sw.dmg + Math.round(item.stats.dmg || 0)).split(' (')[0]}</b></div>` : '';
  return own + (item.look && LOOKS[sw.id] ? `<div class="srow"><span>Look</span><b>${LOOKS[sw.id].text(item.look)}</b></div>` : '') + `<div class="srow"><span>Weapon damage</span><b>${sw.dmg + Math.round(item.stats.dmg || 0)}</b></div>` +
    (sw.note ? `<div class="srow"><span>Signature</span><b>${sw.note}</b></div>` : '') + `<div class="srow"><span>${sw.ranged ? 'Range' : 'Reach'} · swing · cost</span><b>${sw.ranged ? sw.range : Math.round(15 + (sw.kind === 'fist' ? 12 : sw.kind === 'whip' ? sw.len : weaponLength(sw)))} · ${sw.time}s · ${sw.cost}</b></div>` + (fx ? `<div class="srow"><span>Effect</span><b>${fx}</b></div>` : '');
}
// Several pieces at once: "Select several" turns the backpack into a tick-list; quick buttons pick everything up to a grade; then discard them, or sell them when you are in the village.
let invMulti = null, invArm = false;                    // the ids ticked (null = off), and whether Discard has been pressed once already
const inVillage = () => typeof vil !== 'undefined' && vil && state === 'village';
function sellPieces(list) {                              // the blacksmith's price for these backpack pieces; returns the gold
  if (!list.length) return 0;
  const gold = list.reduce((a, i) => a + i.value, 0);
  list.forEach(returnRunes); hero.inv = hero.inv.filter(i => !list.includes(i)); hero.gold += gold; hero.goldPulse = 0.6;
  return gold;
}
const invPicked = () => (invMulti ? hero.inv.filter(i => invMulti.has(i.id)) : []);
function renderInvBar() {
  const bar = document.getElementById('invBar'); if (!bar) return;
  if (!invMulti) { bar.innerHTML = '<div class="multirow"><button data-multi="on">Select several…</button><button data-multi="sort">Sort by grade</button></div>'; return; }
  const picked = invPicked(), gold = picked.reduce((a, i) => a + i.value, 0);
  bar.innerHTML = `<div class="multirow"><b class="cnt">${picked.length} selected</b><button data-multi="all">All</button><button data-multi="none">None</button>` +
    [1, 2, 3].map(r => `<button data-multi="le${r}" style="border-color:${RARITIES[r].color}">≤ ${RARITIES[r].name}</button>`).join('') + '<button data-multi="off">Done</button></div>' +
    `<div class="multirow"><button data-multi="discard" class="danger" ${picked.length ? '' : 'disabled'}>${invArm ? `Really discard ${picked.length}?` : `Discard ${picked.length}`}</button>` +
    (inVillage() ? `<button data-multi="sell" class="sell" ${picked.length ? '' : 'disabled'}>Sell ${picked.length} · ${gold.toLocaleString()} g</button>` : '') + '</div>';
}
// The inventory has three tabs, each with its own slots and its own shelf: Gear (armour, helmet, rings, necklace, artifact), Weapons (the wielded weapon, the spare) and Runes (the pouch, and the sockets of your gear).
let invTab = 'gear', invRune = null;
const EQUIP_SFX = { weapon: 'weaponEquip', armor: 'mail', helmet: 'mail', ring: 'ring', necklace: 'ring', artifact: 'sparkle' };       // what putting a piece on sounds like
const INV_TABS = [['gear', 'Gear'], ['weapons', 'Weapons'], ['runes', 'Runes']];
const itemTab = it => it.slot === 'weapon' ? 'weapons' : 'gear';
const tabItems = () => invTab === 'runes' ? [] : hero.inv.filter(i => itemTab(i) === invTab);
const tabSlots = () => activeSlots().filter(k => (k === 'weapon' || k === 'weapon2') === (invTab === 'weapons'));
const runeTotal = () => RUNE_KEYS.reduce((a, k) => a + runeCount(k), 0);
const invPieces = () => activeSlots().map(k => hero.equip[k]).filter(Boolean).concat(hero.inv);
function renderInvTabs() {
  const n = { gear: hero.inv.filter(i => itemTab(i) === 'gear').length, weapons: hero.inv.filter(i => itemTab(i) === 'weapons').length, runes: runeTotal() };
  document.getElementById('invTabs').innerHTML = INV_TABS.map(([k, label]) => `<button data-invtab="${k}" class="${invTab === k ? 'on' : ''}"><i>${{ gear: '🛡', weapons: '⚔', runes: '◆' }[k]}</i> ${label} <small>${n[k]}</small></button>`).join('');
}
// the Runes tab: sockets of your gear on the left, the rune pouch in the middle, the chosen rune on the right
function renderInvRunes() {
  const el = id => document.getElementById(id);
  el('invH1').textContent = 'Gear sockets'; el('invH2').textContent = 'Rune pouch'; el('invH3').textContent = 'Details'; el('invH4').textContent = 'Rune bonuses';
  const owned = RUNE_KEYS.filter(k => runeCount(k) > 0).sort((a, b) => RUNES[b].tier - RUNES[a].tier || RUNE_KEYS.indexOf(a) - RUNE_KEYS.indexOf(b));
  if (invRune && !owned.includes(invRune)) invRune = null;
  el('invBar').innerHTML = `<div class="hint" style="margin:0 0 .5em">Pick a rune, then press an empty socket (+) to set it. Press a filled socket to take the rune back out. Runes are improved at Ysolde's altar.</div>`;
  const pieces = activeSlots().map(k => hero.equip[k]).filter(i => i && socketsOf(i)).map(it => ({ it, eq: true })).concat(hero.inv.filter(i => socketsOf(i)).map(it => ({ it, eq: false })));
  el('invEquip').innerHTML = pieces.length ? pieces.map(({ it, eq }) => {
    const R = RARITIES[it.rarity], rn = it.rn || [];
    const socks = Array.from({ length: socketsOf(it) }, (_, i) => rn[i]
      ? `<button class="sk on" data-rsock="off:${escapeHtml(it.id)}:${i}" style="--rc:${RUNES[rn[i]].tier > 1 ? RUNES[rn[i]].tc : RUNES[rn[i]].color}" title="${escapeHtml(runeLine(rn[i]))} (press to take it out)">${runeSvg(rn[i], 26)}</button>`
      : `<button class="sk${invRune ? ' ready' : ''}" data-rsock="put:${escapeHtml(it.id)}:${i}" title="${invRune ? 'Set ' + escapeHtml(RUNES[invRune].title) + ' here' : 'Pick a rune first'}">+</button>`).join('');
    return `<div class="rpiece" style="border-color:${R.color}"><div class="ico">${slotSvg(it.slot, R.color, it)}</div><div class="rtxt"><b style="color:${R.color}" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</b><small>${eq ? 'Worn' : 'Backpack'} · ${SLOT_LABEL[it.slot]}</small></div><div class="rsocks">${socks}</div></div>`;
  }).join('') : '<div class="hint" style="margin:0">No gear with sockets yet. Uncommon and better pieces have them: 1 on Uncommon and Rare, 2 on Polished and Legendary, 3 on Mythical and Secret.</div>';
  const cells = owned.map(k => { const R = RUNES[k], tc = R.tier > 1 ? R.tc : R.color;
    return `<div class="cell rune ${invRune === k ? 'sel' : ''}" data-rune="${k}" style="border-color:${tc};background:${withAlpha(R.color, 0.12)}" title="${escapeHtml(runeLine(k))}">${runeSvg(k, 40)}<i class="upn">×${runeCount(k)}</i></div>`; });
  const pad = Math.max(18, Math.ceil(cells.length / 6) * 6) - cells.length;
  el('invGrid').innerHTML = cells.join('') + '<div class="cell empty"></div>'.repeat(pad);
  // what the socketed runes add up to
  const sum = {}; for (const { it } of pieces) for (const k of it.rn || []) { const R = RUNES[k]; sum[R.stat] = (sum[R.stat] || 0) + R.val; }
  const rows = Object.keys(sum).map(s => `<div class="srow"><span>${GEAR_STATS[s].name}</span><b>${GEAR_STATS[s].fmt(sum[s])}</b></div>`);
  el('invTotals').innerHTML = (rows.length ? rows.join('') : '<div class="hint" style="margin:0">Nothing socketed yet.</div>') +
    (essTotal() ? `<div class="runestock"><span>Essences</span>${ESS_KEYS.filter(k => essCount(k)).map(k => `<i title="${escapeHtml(ESS[k].title)}" style="--rc:${ESS[k].color}">${essSvg(k, 20)}<b>${essCount(k)}</b></i>`).join('')}</div>` : '');
  const d = el('invDetail');
  if (!invRune) { d.innerHTML = `<div class="hint" style="margin:0">${owned.length ? 'Select a rune to see what it does and where it can go.' : 'You have no runes. Monsters drop them now and then (bosses most often), and Ysolde the Enchantress sells them in the village.'}<br><br>Runes are lost when you rebirth, except those socketed in the Mythical and Secret pieces you keep.</div>`; return; }
  const R = RUNES[invRune], tc = R.tier > 1 ? R.tc : R.color, nx = runeNext(invRune), S = GEAR_STATS[R.stat];
  d.innerHTML = `<div class="dico" style="border-color:${tc};background:${withAlpha(R.color, 0.12)}">${runeSvg(invRune, 60)}</div><div class="dname" style="color:${tc}">${escapeHtml(R.title)}</div>
    <div class="dsub">Tier ${R.tier} of ${RUNE_TIERS.length} · you hold ${runeCount(invRune)}</div>
    <div class="srow"><span>${S.name}</span><b>${S.fmt(R.val)}</b></div>
    ${nx ? `<div class="srow"><span>Next tier</span><b style="color:${RUNES[nx].tc}">${escapeHtml(RUNES[nx].tname)} · ${S.fmt(RUNES[nx].val)}</b></div>` : '<div class="srow"><span>Tier</span><b>The finest</b></div>'}
    <div class="hint cmpnote">Set it into a socket on the left. A piece takes runes of any tier.</div>`;
}
function renderInventory() {
  if (!hero) return;
  const el = id => document.getElementById(id);
  const selItem = itemById(invSel); if (!selItem) invSel = null;
  const cmpItem = invCmp ? itemById(invCmp) : null; if (!cmpItem) invCmp = null;
  if (!selItem) invPick = false;
  if (invMulti) for (const id of [...invMulti]) if (!hero.inv.some(i => i.id === id)) invMulti.delete(id);
  el('invCount').textContent = `${hero.inv.length} / ${INV_MAX} slots`;
  el('invGold').textContent = hero.gold.toLocaleString();
  renderInvTabs();
  document.getElementById('inv').dataset.tab = invTab;
  if (invTab === 'runes') { renderInvRunes(); return; }
  el('invH1').textContent = invTab === 'weapons' ? 'Wielded' : 'Equipped'; el('invH2').textContent = invTab === 'weapons' ? 'Weapon rack' : 'Gear bag'; el('invH3').textContent = 'Details'; el('invH4').textContent = 'Gear totals';
  renderInvBar();
  // equipment slots
  el('invEquip').innerHTML = tabSlots().map(k => {
    const it = hero.equip[k], R = it && RARITIES[it.rarity], sel = invSel && invSel.src === 'eq' && it && invSel.id === it.id, cm = invCmp && invCmp.src === 'eq' && it && invCmp.id === it.id;
    return `<div class="eqslot ${sel ? 'sel' : ''} ${cm ? 'cmp' : ''}" ${it ? `data-eq="${k}"` : ''} style="${it ? `border-color:${R.color}` : ''}">
      <div class="ico">${slotSvg(k.replace(/\d/, ''), it ? R.color : '#4a4a5c', it)}</div>
      <div class="eqtxt"><small>${SLOT_LABEL[k]}${it ? ` · Lv ${it.ilvl || 1}` : ''}</small>${it ? `<b style="color:${R.color}" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</b>` : '<em>empty</em>'}</div></div>`;
  }).join('');
  // backpack
  let grid = '';
  const shown = tabItems(), cellsN = Math.min(INV_MAX, shown.length + (INV_MAX - hero.inv.length));          // this tab's pieces, then the free slots left in the whole pack
  for (let i = 0; i < cellsN; i++) {
    const it = shown[i];
    if (!it) { grid += '<div class="cell empty"></div>'; continue; }
    const R = RARITIES[it.rarity], sel = invSel && invSel.src === 'bag' && invSel.id === it.id, cm = invCmp && invCmp.src === 'bag' && invCmp.id === it.id, tick = invMulti && invMulti.has(it.id);
    grid += `<div class="cell ${sel ? 'sel' : ''} ${cm ? 'cmp' : ''} ${invPick ? 'pick' : ''} ${tick ? 'tick' : ''}" data-bag="${escapeHtml(it.id)}" style="border-color:${R.color};background:${withAlpha(R.color, 0.12)}" title="${escapeHtml(it.name)}">${slotSvg(it.slot, R.color, it)}<i class="lv">${it.ilvl || 1}</i>${it.up ? `<i class="upn">+${it.up}</i>` : ''}${invMulti ? `<i class="chk">${tick ? '✓' : ''}</i>` : ''}</div>`;
  }
  el('invGrid').innerHTML = grid;
  // totals from gear, with the caps
  const g = hero.gear, tot = [];
  const line = (name, val, extra = '') => tot.push(`<div class="srow"><span>${name}</span><b>${val}${extra}</b></div>`);
  if (g.dmg) line('Damage', GEAR_STATS.dmg.fmt(g.dmg));
  if (g.hp) line('Max HP', GEAR_STATS.hp.fmt(g.hp));
  if (g.stamina) line('Stamina', GEAR_STATS.stamina.fmt(g.stamina));
  if (g.cdr) line('Faster', GEAR_STATS.cdr.fmt(g.cdr));
  if (g.gold) line('Gold find', GEAR_STATS.gold.fmt(g.gold));
  line('Damage taken', '−' + pctText(dmgReduction()), ` <small>/${pctText(GEAR_CAPS.dr)}</small>`);
  line('Crit chance', pctText(critChance()), ` <small>/${pctText(GEAR_CAPS.crit)}</small>`);
  line('Crit damage', `${critMult().toFixed(2)}×`, ` <small>/${GEAR_CAPS.critDmg}×</small>`);
  line('Move speed', `+${pctText(moveSpeed() / BASE_SPEED - 1)}`, ` <small>/${pctText(GEAR_CAPS.speed)}</small>`);
  if (g.upLuck) line('Upgrade luck', GEAR_STATS.upLuck.fmt(g.upLuck), ` <small>/${pctText(LUCK_CAPS.upLuck)}</small>`);
  if (g.dropLuck) line('Drop luck', GEAR_STATS.dropLuck.fmt(g.dropLuck), ` <small>/${pctText(LUCK_CAPS.dropLuck)}</small>`);
  if (g.gradeLuck) line('Grade luck', GEAR_STATS.gradeLuck.fmt(g.gradeLuck), ` <small>/${pctText(LUCK_CAPS.gradeLuck)}</small>`);
  for (const u of g.unique) line(UNIQUES[u].name, '✓');
  const owned = RUNE_KEYS.filter(k => runeCount(k) > 0);
  if (owned.length) tot.push(`<div class="runestock"><span>Runes</span>${owned.map(k => `<i title="${escapeHtml(runeLine(k))}" style="--rc:${RUNES[k].color}">${runeSvg(k, 20)}<b>${runeCount(k)}</b></i>`).join('')}</div>`);
  el('invTotals').innerHTML = tot.join('');
  // detail panel
  const d = el('invDetail');
  if (!selItem) { d.innerHTML = '<div class="hint" style="margin:0">Select a piece to see what it does and compare it with what you wear.<br><br>Gear drops from monsters; bosses always drop some. Spare pieces sell to the blacksmith in the village.</div>'; return; }
  const R = RARITIES[selItem.rarity], eq = invSel.src === 'bag';
  const key = selItem.slot === 'ring' ? 'ring1' : selItem.slot, versus = cmpItem && cmpItem.id !== selItem.id ? cmpItem : (eq ? hero.equip[key] : null);
  const btns = [];
  const eqKey = eq ? null : activeSlots().find(k => hero.equip[k] && hero.equip[k].id === selItem.id);
  if (eq && selItem.slot === 'ring') btns.push(`<button data-inv-act="equip1">Wear as ring 1</button><button data-inv-act="equip2">Wear as ring 2</button>` + (slotOpen('ring3') ? '<button data-inv-act="equip3">Wear as ring 3</button>' : ''));
  else if (eq) btns.push(`<button data-inv-act="equip">Equip</button>` + (selItem.slot === 'weapon' && slotOpen('weapon2') ? '<button data-inv-act="equip4">Keep as spare (X)</button>' : ''));
  else if (eqKey && eqKey !== 'weapon') btns.push('<button data-inv-act="unequip">Unequip</button>');
  const cmpBar = '<div class="cmpbar">' + (invPick ? '<button data-inv-act="cmp" class="on">Pick a piece… (cancel)</button>' : cmpItem ? '<button data-inv-act="cmppick">Compare another</button><button data-inv-act="cmp">Stop</button>' : '<button data-inv-act="cmppick">Compare…</button>') + '</div>';
  if (eq) btns.push(`<button data-inv-act="discard" class="danger">Discard <small>(${selItem.value} g if sold)</small></button>`);
  const up = selItem.up | 0, tags = [R.name, SLOT_LABEL[selItem.slot], `Lv ${selItem.ilvl || 1}`, up ? `+${up}/${upgradeMax(selItem)}` : '', socketsOf(selItem) ? `◆ ${(selItem.rn || []).length}/${socketsOf(selItem)}` : ''].filter(Boolean).join(' · ');
  d.innerHTML = `<div class="dico" style="border-color:${R.color};background:${withAlpha(R.color, 0.12)}">${slotSvg(selItem.slot, R.color, selItem)}</div><div class="dname" style="color:${R.color}" title="${escapeHtml(selItem.name)}">${escapeHtml(selItem.name)}</div>
    <div class="dsub">${tags}</div>
    ${cmpBar}
    ${selItem.slot === 'weapon' ? weaponLine(selItem) : ''}
    ${statRows(selItem, (eq || cmpItem) ? (versus || { stats: {} }) : null)}
    ${selItem.unique ? `<div class="uniq"><b>${UNIQUES[selItem.unique].name}</b>: ${UNIQUES[selItem.unique].text}</div>` : ''}
    ${versus ? `<div class="hint cmpnote">vs <b style="color:${RARITIES[versus.rarity].color}" title="${escapeHtml(versus.name)}">${escapeHtml(versus.name)}</b></div>` : ''}
    <div class="dbtns">${btns.join('')}</div>`;
}
function invMsg(text) { popups.push({ text, x: VW / 2, y: 120, t: 1.8, screen: true, small: true, color: '#fb8' }); }
document.getElementById('inv').addEventListener('click', e => {
  const tb = e.target.closest('[data-invtab]');
  if (tb) {
    const t = tb.dataset.invtab; if (t === invTab) return;
    invTab = t; invPick = false; invCmp = null; invMulti = invMulti && t !== 'runes' ? new Set() : null; invArm = false;
    const cur = itemById(invSel); if (cur && itemTab(cur) !== t) invSel = null;                  // the chosen piece belongs to the other tab
    sfx('tab'); renderInventory(); return;
  }
  const rn = e.target.closest('[data-rune]'); if (rn) { invRune = invRune === rn.dataset.rune ? null : rn.dataset.rune; sfx('select'); renderInventory(); return; }
  const rs = e.target.closest('[data-rsock]');
  if (rs) {                                                                                        // sockets in the Runes tab
    const [op, id, idx] = rs.dataset.rsock.split(':'), it = invPieces().find(i => i.id === id);
    if (op === 'put' && it && invRune && socketRune(it, invRune)) { sfx('socket'); saveGame(true, true); }
    else if (op === 'off' && it && unsocketRune(it, +idx)) { sfx('unsocket'); saveGame(true, true); }
    else { sfx('denied'); if (op === 'put' && !invRune) invMsg('Pick a rune from the pouch first'); }
    renderInventory(); return;
  }
  const multi = e.target.closest('[data-multi]');
  if (multi) {
    const a = multi.dataset.multi; sfx(a === 'sell' ? 'sellAll' : a === 'discard' && invArm ? 'discard' : 'tick');
    if (a === 'on') invMulti = new Set();
    else if (a === 'off') invMulti = null;
    else if (a === 'sort') hero.inv.sort((x, y) => y.rarity - x.rarity || (y.ilvl | 0) - (x.ilvl | 0) || x.slot.localeCompare(y.slot));
    else if (a === 'all') invMulti = new Set(tabItems().map(i => i.id));
    else if (a === 'none') invMulti = new Set();
    else if (a.startsWith('le')) { const r = +a.slice(2); invMulti = new Set(tabItems().filter(i => i.rarity <= r).map(i => i.id)); }
    else if (a === 'discard') {
      const picked = invPicked();
      if (picked.length && !invArm) { invArm = true; renderInventory(); return; }
      if (picked.length) { hero.inv = hero.inv.filter(i => !picked.includes(i)); invMulti = new Set(); invMsg(`Discarded ${picked.length} piece${picked.length === 1 ? '' : 's'}`); }
    } else if (a === 'sell') {
      const picked = invPicked(), gold = sellPieces(picked);
      if (gold) { invMulti = new Set(); invMsg(`Sold ${picked.length} piece${picked.length === 1 ? '' : 's'} for ${gold.toLocaleString()} gold`); saveGame(true, true); }
    }
    if (a !== 'discard') invArm = false; else if (!invPicked().length) invArm = false;
    renderInventory(); return;
  }
  const bag = e.target.closest('[data-bag]'), eqs = e.target.closest('[data-eq]'), act = e.target.closest('[data-inv-act]');
  const choose = (src, id) => { if (invPick && invSel && invSel.id !== id) { invCmp = { src, id }; invPick = false; } else { invSel = { src, id }; invPick = false; } sfx('click'); renderInventory(); };
  if (bag && invMulti && !invPick) { const id = bag.dataset.bag; if (invMulti.has(id)) invMulti.delete(id); else invMulti.add(id); invArm = false; invSel = { src: 'bag', id }; sfx('tick'); renderInventory(); return; }
  if (bag) { choose('bag', bag.dataset.bag); return; }
  if (eqs) { const it = hero.equip[eqs.dataset.eq]; if (it) choose('eq', it.id); return; }
  if (!act || !invSel) return;
  const item = itemById(invSel); if (!item) return;
  const a = act.dataset.invAct;
  if (a === 'cmppick') { invPick = true; sfx('click'); renderInventory(); return; }
  if (a === 'cmp') { invPick = false; invCmp = null; sfx('click'); renderInventory(); return; }
  if (a === 'equip' || a === 'equip1' || a === 'equip2' || a === 'equip3' || a === 'equip4') {
    const r = equipFromBag(item.id, { equip2: 'ring2', equip3: 'ring3', equip4: 'weapon2' }[a] || 'ring1');
    if (r === 'ok') { sfx(EQUIP_SFX[item.slot] || 'equip'); invSel = { src: 'eq', id: item.id }; } else { sfx('denied'); invMsg(r); }
  } else if (a === 'unequip') {
    const r = unequipToBag(activeSlots().find(k => hero.equip[k] && hero.equip[k].id === item.id));
    if (r === 'ok') { sfx('unequip'); invSel = { src: 'bag', id: item.id }; } else { sfx('denied'); invMsg(r); }
  } else if (a === 'discard') {
    const go = () => { if (discardFromBag(item.id)) { sfx('click'); invSel = null; } renderInventory(); };
    if (item.rarity >= 3) { askConfirm('DISCARD ITEM?', `Discard ${item.name}? You can sell it to the blacksmith instead.`, go, { yes: 'Discard', no: 'Keep it' }); return; }
    go(); return;
  }
  renderInventory();
});
