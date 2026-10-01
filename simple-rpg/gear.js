// Gear and inventory: six equipment slots, a 24-slot backpack, eight rarity grades with stat
// ranges, drops from monsters, an inventory screen (key I) and selling to the blacksmith.
// Level stats are not touched here: gear adds on top of them, under hard caps.
// Game code reads gear through hero.gear (a plain sum, rebuilt by recalcGear() whenever equipment changes).

const INV_MAX = 24;
const GEAR_SLOTS = ['weapon', 'armor', 'helmet', 'ring1', 'ring2', 'necklace'];     // equipment positions
const ITEM_SLOTS = ['weapon', 'armor', 'helmet', 'ring', 'necklace'];               // what an item can be (a ring fits ring1 or ring2)
const SLOT_LABEL = { weapon: 'Weapon', armor: 'Armor', helmet: 'Helmet', ring1: 'Ring 1', ring2: 'Ring 2', ring: 'Ring', necklace: 'Necklace' };

// grade, colour, how many stat lines it rolls, and where in a stat's range (0..1 of its maximum) the roll lands
const RARITIES = [
  { name: 'Broken',    color: '#8a7f77', lines: 1, band: [0.03, 0.09], price: 4 },
  { name: 'Common',    color: '#d5d5dc', lines: 1, band: [0.09, 0.15], price: 10 },
  { name: 'Uncommon',  color: '#5fd07a', lines: 2, band: [0.15, 0.23], price: 24 },
  { name: 'Rare',      color: '#5b9bff', lines: 2, band: [0.23, 0.34], price: 55 },
  { name: 'Polished',  color: '#c36bff', lines: 3, band: [0.34, 0.46], price: 120 },
  { name: 'Legendary', color: '#ffa73a', lines: 4, band: [0.46, 0.63], price: 280 },
  { name: 'Mythical',  color: '#ff4f7a', lines: 4, band: [0.63, 0.86], price: 650 },
  { name: 'Secret',    color: '#3ff2e0', lines: 5, band: [0.86, 1.0],  price: 1600 },
];
const RARITY_BASE_W = [28, 40, 20, 8, 3, 0.8, 0.2, 0];          // Secret is never rolled normally (boss pieces only, see rollRarity)
const SECRET_BOSS_CHANCE = 0.005;                               // per boss piece; luck-free on purpose (anti-farming)

// every stat a piece can carry: its maximum (what a top-of-the-range Secret roll gives) and how to show it
const pctText = v => `${(v * 100).toFixed(1).replace(/\.0$/, '')}%`;
const GEAR_STATS = {
  dmg:     { name: 'Damage',            max: 90,   int: true, fmt: v => `+${Math.round(v)}` },
  hp:      { name: 'Max HP',            max: 500,  int: true, fmt: v => `+${Math.round(v)}` },
  dr:      { name: 'Damage reduction',  max: 0.35, fmt: v => `+${pctText(v)}` },
  crit:    { name: 'Crit chance',       max: 0.30, fmt: v => `+${pctText(v)}` },
  critDmg: { name: 'Crit damage',       max: 2.5,  fmt: v => `+${v.toFixed(2)}×` },
  speed:   { name: 'Move speed',        max: 0.20, fmt: v => `+${pctText(v)}` },
  cdr:     { name: 'Faster actions',    max: 0.30, fmt: v => `+${pctText(v)}` },      // shorter flip cooldown and swing time
  stamina: { name: 'Max stamina',       max: 120,  int: true, fmt: v => `+${Math.round(v)}` },
  gold:    { name: 'Gold find',         max: 0.50, fmt: v => `+${pctText(v)}` },
};
// absolute ceilings, level stats + gear together. Shown in the UI as "38% (cap 60%)".
const GEAR_CAPS = { dr: 0.60, crit: 0.75, critDmg: 6, speed: 0.35 };

// which stats a slot rolls first, and which it can add after that
const SLOT_ROLLS = {
  weapon:   { pri: ['dmg'],        pool: ['crit', 'critDmg', 'cdr', 'stamina', 'gold'] },
  armor:    { pri: ['dr', 'hp'],   pool: ['stamina', 'speed', 'cdr', 'dmg'] },
  helmet:   { pri: ['hp'],         pool: ['dr', 'crit', 'stamina', 'gold', 'cdr'] },
  ring:     { pri: ['crit'],       pool: ['critDmg', 'dmg', 'cdr', 'speed', 'gold', 'hp'] },
  necklace: { pri: ['critDmg'],    pool: ['hp', 'crit', 'dmg', 'stamina', 'gold', 'speed', 'dr'] },
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
};
const PREFIX = [['Rusty', 'Cracked', 'Worn', 'Frayed'], [''], ['Sturdy', 'Fine'], ['Superior', 'Hardened'], ['Polished', 'Gleaming'], ['Legendary'], ['Mythic'], ['']];
const EPITHET = { 5: ['of the Wolf', 'of the Bear', 'of the Storm', 'of Dawn'], 6: ['of Ruin', 'of Eternity', 'of the Void', 'of the Sun'] };
const SECRET_NAMES = { weapon: 'Whisper of the Dark', armor: 'Shroud of Midnight', helmet: 'Crown of Watching Eyes', ring: 'Band of the Last Light', necklace: 'Heart of the Hollow' };

const gearRand = a => a[Math.floor(Math.random() * a.length)];
const newItemId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function makeName(item, sword) {
  if (item.rarity === 7) return SECRET_NAMES[item.slot];
  const base = item.slot === 'weapon' ? sword.name : BASE_NAMES[item.slot][Math.min(7, Math.floor(item.rarity * 0.8 + Math.random() * 2.2))];
  const pre = gearRand(PREFIX[item.rarity]), post = EPITHET[item.rarity] ? ' ' + gearRand(EPITHET[item.rarity]) : '';
  return `${pre ? pre + ' ' : ''}${base}${post}`;
}

// ---------------------------------------------------------------- rolling
// t is "how deep" you are: bosses defeated plus how far into the current set. Deeper = better grades, not just more drops.
function rollRarity(t = 0, bossPiece = false) {
  if (bossPiece && Math.random() < SECRET_BOSS_CHANCE) return 7;
  const w = RARITY_BASE_W.map((b, i) => b * Math.pow(1.5, t * (i - 2) / 2));
  let x = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) if ((x -= w[i]) <= 0) return i;
  return 1;
}
function rollStat(key, rarity) {
  const S = GEAR_STATS[key], [lo, hi] = RARITIES[rarity].band;
  let v = S.max * (lo + (hi - lo) * Math.random()) * (0.94 + 0.12 * Math.random());
  v = Math.min(S.max, Math.max(S.max * 0.02, v));
  return S.int ? Math.max(1, Math.round(v)) : Math.round(v * 1000) / 1000;
}
function rollItem(o = {}) {
  const slot = o.slot || gearRand(['weapon', 'weapon', 'armor', 'armor', 'helmet', 'ring', 'ring', 'necklace', 'necklace', 'helmet']);
  const rarity = Number.isInteger(o.rarity) ? Math.max(0, Math.min(7, o.rarity)) : rollRarity(o.tier || 0, !!o.boss);
  const item = { id: newItemId(), slot, rarity, name: '', stats: {} };
  let sword = null;
  if (slot === 'weapon') {                                         // a weapon is one of the existing swords, up to the hero's level
    const level = Math.max(1, o.level || (typeof hero !== 'undefined' && hero ? hero.level : 1));
    const eligible = SWORDS.filter(s => s.lvl <= level);
    const pool = eligible.flatMap((s, i) => Array(i + 1).fill(s));  // better swords are likelier
    sword = gearRand(pool); item.base = sword.id; item.req = sword.lvl;
  }
  const R = SLOT_ROLLS[slot], keys = [...R.pri], pool = R.pool.filter(k => !keys.includes(k));
  while (keys.length < RARITIES[rarity].lines && pool.length) keys.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  for (const k of keys.slice(0, Math.max(1, RARITIES[rarity].lines))) item.stats[k] = rollStat(k, rarity);
  if (rarity === 7) item.unique = gearRand(Object.keys(UNIQUES));
  item.name = makeName(item, sword);
  item.value = Math.max(1, Math.round(RARITIES[rarity].price * (0.8 + Math.random() * 0.4) * (1 + (sword ? sword.lvl * 0.06 : 0))));
  return item;
}
function starterWeapon(swordId = 'wood') {
  const sw = SWORDS.find(s => s.id === swordId) || SWORDS[0];
  return { id: newItemId(), slot: 'weapon', rarity: 1, name: sw.name, stats: {}, base: sw.id, req: sw.lvl, value: Math.max(2, Math.round(sw.lvl * 4)) };
}

// ---------------------------------------------------------------- the hero's gear
const zeroGear = () => ({ dmg: 0, hp: 0, dr: 0, crit: 0, critDmg: 0, speed: 0, cdr: 0, stamina: 0, gold: 0, unique: [] });
function initGear() {
  hero.inv = []; hero.equip = { weapon: starterWeapon('wood'), armor: null, helmet: null, ring1: null, ring2: null, necklace: null };
  hero.gearHp = 0; hero.gear = zeroGear();
  recalcGear();
}
// rebuild hero.gear and everything that depends on it (the weapon in hand and max HP)
function recalcGear() {
  const g = zeroGear();
  for (const k of GEAR_SLOTS) {
    const it = hero.equip[k]; if (!it) continue;
    for (const s in it.stats) if (s in g) g[s] += it.stats[s];
    if (it.unique && !g.unique.includes(it.unique)) g.unique.push(it.unique);
  }
  hero.gear = g;
  const w = hero.equip.weapon;
  if (w) hero.sword = SWORDS.find(s => s.id === w.base) || SWORDS[0];
  const delta = Math.round(g.hp) - (hero.gearHp | 0);                  // max HP from gear is tracked separately so equipping never double-counts
  if (delta) { hero.maxHp = Math.max(1, hero.maxHp + delta); hero.gearHp = Math.round(g.hp); if (delta > 0) hero.hp += delta; }
  hero.hp = Math.min(hero.hp, hero.maxHp);
  hero.stamina = Math.min(hero.stamina, maxStamina());
}
const gearHas = name => !!(hero && hero.gear && hero.gear.unique.includes(name));
const gearStat = k => (hero && hero.gear ? hero.gear[k] : 0) || 0;

function canEquipWeapon(item) { return item.slot !== 'weapon' || hero.level >= (item.req || 1) || dev.swords; }
function bagFind(id) { return hero.inv.findIndex(i => i.id === id); }
function addToBag(item) { if (hero.inv.length >= INV_MAX) return false; hero.inv.push(item); return true; }

// slotKey: for rings 'ring1' / 'ring2'; otherwise the item's own slot
function equipFromBag(id, slotKey) {
  const i = bagFind(id); if (i < 0) return 'missing';
  const item = hero.inv[i], key = item.slot === 'ring' ? (slotKey === 'ring2' ? 'ring2' : 'ring1') : item.slot;
  if (!GEAR_SLOTS.includes(key)) return 'bad slot';
  if (!canEquipWeapon(item)) return `Needs level ${item.req}`;
  const old = hero.equip[key];
  hero.inv.splice(i, 1);
  if (old) hero.inv.splice(i, 0, old);                                  // the old piece takes the freed spot
  hero.equip[key] = item;
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
// Every level adds 10% to each stat the piece has (at least +1 on whole-number stats). Better grades can be upgraded further.
const UP_PCT = 0.10;
const upgradeMax = it => 3 + (it.rarity >= 3 ? 1 : 0) + (it.rarity >= 5 ? 1 : 0);
const upgradeCost = it => Math.round((24 + it.value * 0.9) * (1 + 0.6 * (it.up | 0)));
const canUpgrade = it => !!it && (it.up | 0) < upgradeMax(it) && Object.keys(it.stats).length > 0;
function upgradeItem(it) {
  if (!canUpgrade(it)) return false;
  for (const k in it.stats) {
    const S = GEAR_STATS[k], raised = it.stats[k] * (1 + UP_PCT);
    const v = S.int ? Math.max(Math.round(it.stats[k]) + 1, Math.round(raised)) : Math.round(raised * 1000) / 1000;
    it.stats[k] = Math.min(S.max * 1.7, v);
  }
  it.up = (it.up | 0) + 1;
  it.name = it.name.replace(/ \+\d+$/, '') + ` +${it.up}`;
  it.value = Math.round(it.value * 1.25 + 4);
  return true;
}
function discardFromBag(id) { const i = bagFind(id); if (i < 0) return false; hero.inv.splice(i, 1); return true; }

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
    if (slot === 'weapon') { const sw = SWORDS.find(s => s.id === raw.base); if (!sw) return null; item.base = sw.id; item.req = sw.lvl; }
    for (const k in GEAR_STATS) {
      const v = raw.stats && Number(raw.stats[k]);
      if (Number.isFinite(v) && v > 0) item.stats[k] = Math.min(GEAR_STATS[k].max * 1.7, v);
    }
    if (raw.unique && UNIQUES[raw.unique]) item.unique = raw.unique;
    if (Number(raw.up) > 0) item.up = Math.max(0, Math.min(upgradeMax(item), Math.floor(Number(raw.up))));
    item.value = Math.max(1, Math.min(99999, Math.round(Number(raw.value) || RARITIES[rarity].price)));
    return item;
  } catch { return null; }
}
function serializeGear() {
  return { inv: hero.inv, equip: hero.equip, gearHp: hero.gearHp | 0 };
}
// d: a save. Old saves (before gear) get a Common weapon for every sword they had unlocked.
function loadGear(d) {
  hero.inv = []; hero.equip = { weapon: null, armor: null, helmet: null, ring1: null, ring2: null, necklace: null };
  hero.gearHp = Math.max(0, Math.min(5000, d.gearHp | 0)); hero.gear = zeroGear();
  if (d.equip && typeof d.equip === 'object') {
    for (const k of GEAR_SLOTS) {
      const it = sanitizeItem(d.equip[k]);
      if (it && (it.slot === k || (it.slot === 'ring' && (k === 'ring1' || k === 'ring2')))) hero.equip[k] = it;
    }
    if (Array.isArray(d.inv)) for (const raw of d.inv.slice(0, INV_MAX)) { const it = sanitizeItem(raw); if (it) hero.inv.push(it); }
  } else {
    for (const sw of SWORDS) if (sw.lvl <= hero.level && sw.id !== d.sword) hero.inv.push(starterWeapon(sw.id));
    hero.equip.weapon = starterWeapon(d.sword);
    hero.gearHp = 0;
  }
  if (!hero.equip.weapon) hero.equip.weapon = starterWeapon('wood');          // always holding something
  recalcGear();
}

// ---------------------------------------------------------------- drops
// normal 6% per kill (scaled by difficulty), bosses always drop 1-3 pieces and roll one tier deeper
function depthOf() { return tierOf(wave) + (setPos(wave) - 1) / 20; }
function gearDropsFor(m) {
  const out = [];
  if (m.type === 'boss') {
    const n = 1 + (Math.random() < 0.5 ? 1 : 0) + (Math.random() < 0.2 ? 1 : 0);
    for (let i = 0; i < n; i++) out.push(rollItem({ tier: depthOf() + 1, boss: true, level: hero.level }));
  } else if (Math.random() < 0.06 * D().drop * ((m.size ?? 1) < 1 ? 0.5 : 1)) out.push(rollItem({ tier: depthOf(), level: hero.level }));
  return out;
}
function dropGear(item, x, y) {
  dropItem('gear', x, y, { item, t: 60 });
  if (item.rarity >= 5) sfx('unlock');
}
// called when the hero walks over a gear drop; returns true if it was picked up
function pickUpGear(d) {
  if (!addToBag(d.item)) {
    if (!(d.warnT > 0)) { popups.push({ text: 'Backpack full (press M)', x: d.x, y: d.y - 34, t: 1.2, color: '#f88' }); d.warnT = 1.5; sfx('tired'); }
    return false;
  }
  const R = RARITIES[d.item.rarity];
  popups.push({ text: d.item.name, x: d.x, y: d.y - 34, t: 2, color: R.color });
  sfx(d.item.rarity >= 5 ? 'levelup' : 'pickup');
  return true;
}

// ---------------------------------------------------------------- the inventory tab of the character menu (M)
let invSel = null;                                              // { src: 'bag' | 'eq', id }
const slotSvg = (slot, c) => {
  const p = {
    weapon: '<path d="M6 22 L20 8 M17 5 L23 11 M5 19 L9 23 M6 22 L3 25" />',
    armor: '<path d="M8 6 L5 11 L8 14 L8 24 L20 24 L20 14 L23 11 L20 6 L16 8 L12 8 Z" />',
    helmet: '<path d="M5 17 Q5 6 14 6 Q23 6 23 17 L23 21 L18 21 L18 17 L10 17 L10 21 L5 21 Z" />',
    ring: '<circle cx="14" cy="17" r="6" /><path d="M11 9 L14 5 L17 9 Z" />',
    necklace: '<path d="M5 7 Q14 24 23 7" /><circle cx="14" cy="19" r="2.6" />',
  }[slot];
  return `<svg viewBox="0 0 28 28" width="26" height="26" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
};
function itemById(sel) {
  if (!sel) return null;
  if (sel.src === 'bag') return hero.inv.find(i => i.id === sel.id) || null;
  return GEAR_SLOTS.map(k => hero.equip[k]).find(i => i && i.id === sel.id) || null;
}
function statRows(item, versus) {
  const rows = [];
  for (const k in item.stats) {
    const S = GEAR_STATS[k], diff = versus ? item.stats[k] - (versus.stats[k] || 0) : null;
    const dtxt = diff === null || Math.abs(diff) < 1e-9 ? '' : ` <small class="${diff > 0 ? 'up' : 'down'}">(${diff > 0 ? '+' : '−'}${S.fmt(Math.abs(diff)).replace('+', '')})</small>`;
    rows.push(`<div class="srow"><span>${S.name}</span><b>${S.fmt(item.stats[k])}${dtxt}</b></div>`);
  }
  if (versus) for (const k in versus.stats) if (!(k in item.stats)) rows.push(`<div class="srow"><span>${GEAR_STATS[k].name}</span><b class="down">${GEAR_STATS[k].fmt(0)} <small class="down">(−${GEAR_STATS[k].fmt(versus.stats[k]).replace('+', '')})</small></b></div>`);
  return rows.join('');
}
function weaponLine(item) {
  const sw = SWORDS.find(s => s.id === item.base); if (!sw) return '';
  const fx = [sw.burn && 'burn', sw.slow && 'slow'].filter(Boolean).join(', ');
  return `<div class="srow"><span>Weapon damage</span><b>${sw.dmg + Math.round(item.stats.dmg || 0)}</b></div>` +
    `<div class="srow"><span>Reach · swing · cost</span><b>${sw.range} · ${sw.time}s · ${sw.cost}</b></div>` + (fx ? `<div class="srow"><span>Effect</span><b>${fx}</b></div>` : '');
}
function renderInventory() {
  if (!hero) return;
  const el = id => document.getElementById(id);
  const selItem = itemById(invSel); if (!selItem) invSel = null;
  el('invCount').textContent = `${hero.inv.length} / ${INV_MAX} slots`;
  el('invGold').textContent = hero.gold.toLocaleString();
  // equipment slots
  el('invEquip').innerHTML = GEAR_SLOTS.map(k => {
    const it = hero.equip[k], R = it && RARITIES[it.rarity], sel = invSel && invSel.src === 'eq' && it && invSel.id === it.id;
    return `<div class="eqslot ${sel ? 'sel' : ''}" ${it ? `data-eq="${k}"` : ''} style="${it ? `border-color:${R.color}` : ''}">
      <div class="ico">${slotSvg(k.replace(/\d/, ''), it ? R.color : '#4a4a5c')}</div>
      <div class="eqtxt"><small>${SLOT_LABEL[k]}</small>${it ? `<b style="color:${R.color}">${escapeHtml(it.name)}</b>` : '<em>empty</em>'}</div></div>`;
  }).join('');
  // backpack
  let grid = '';
  for (let i = 0; i < INV_MAX; i++) {
    const it = hero.inv[i];
    if (!it) { grid += '<div class="cell empty"></div>'; continue; }
    const R = RARITIES[it.rarity], sel = invSel && invSel.src === 'bag' && invSel.id === it.id;
    grid += `<div class="cell ${sel ? 'sel' : ''}" data-bag="${escapeHtml(it.id)}" style="border-color:${R.color};background:${withAlpha(R.color, 0.12)}" title="${escapeHtml(it.name)}">${slotSvg(it.slot, R.color)}</div>`;
  }
  el('invGrid').innerHTML = grid;
  // totals from gear, with the caps
  const g = hero.gear, tot = [];
  const line = (name, val, extra = '') => tot.push(`<div class="srow"><span>${name}</span><b>${val}${extra}</b></div>`);
  if (g.dmg) line('Damage', GEAR_STATS.dmg.fmt(g.dmg));
  if (g.hp) line('Max HP', GEAR_STATS.hp.fmt(g.hp));
  if (g.stamina) line('Max stamina', GEAR_STATS.stamina.fmt(g.stamina));
  if (g.cdr) line('Faster actions', GEAR_STATS.cdr.fmt(g.cdr));
  if (g.gold) line('Gold find', GEAR_STATS.gold.fmt(g.gold));
  line('Damage reduction', pctText(dmgReduction()), ` <small>(cap ${pctText(GEAR_CAPS.dr)})</small>`);
  line('Crit chance', pctText(critChance()), ` <small>(cap ${pctText(GEAR_CAPS.crit)})</small>`);
  line('Crit damage', `${critMult().toFixed(2)}×`, ` <small>(cap ${GEAR_CAPS.critDmg}×)</small>`);
  line('Move speed', `+${pctText(moveSpeed() / BASE_SPEED - 1)}`, ` <small>(cap +${pctText(GEAR_CAPS.speed)})</small>`);
  for (const u of g.unique) line(UNIQUES[u].name, '✓');
  el('invTotals').innerHTML = tot.join('');
  // detail panel
  const d = el('invDetail');
  if (!selItem) { d.innerHTML = '<div class="hint" style="margin:0">Select a piece to see what it does, compare it with what you wear, and equip it.<br><br>Gear drops from monsters (bosses always drop some). Sell spare pieces to the blacksmith in the village.</div>'; return; }
  const R = RARITIES[selItem.rarity], eq = invSel.src === 'bag';
  const key = selItem.slot === 'ring' ? 'ring1' : selItem.slot, versus = eq ? hero.equip[key] : null;
  const lock = eq && !canEquipWeapon(selItem);
  const btns = [];
  if (eq && selItem.slot === 'ring') btns.push(`<button data-inv-act="equip1" ${lock ? 'disabled' : ''}>Equip as ring 1</button><button data-inv-act="equip2">Equip as ring 2</button>`);
  else if (eq) btns.push(`<button data-inv-act="equip" ${lock ? 'disabled' : ''}>${lock ? `Needs level ${selItem.req}` : 'Equip'}</button>`);
  else if (selItem.slot !== 'weapon') btns.push('<button data-inv-act="unequip">Unequip</button>');
  if (eq) btns.push(`<button data-inv-act="discard" class="danger">Discard (sells for ${selItem.value} g in the village)</button>`);
  d.innerHTML = `<div class="dname" style="color:${R.color}">${escapeHtml(selItem.name)}</div>
    <div class="dsub">${R.name} ${SLOT_LABEL[selItem.slot].toLowerCase()}${selItem.slot === 'weapon' ? ` · level ${selItem.req}` : ''}</div>
    ${selItem.slot === 'weapon' ? weaponLine(selItem) : ''}
    ${statRows(selItem, eq ? (versus || { stats: {} }) : null)}
    ${selItem.unique ? `<div class="uniq"><b>${UNIQUES[selItem.unique].name}</b>: ${UNIQUES[selItem.unique].text}</div>` : ''}
    ${eq && versus ? `<div class="hint" style="margin:6px 0 0">Compared with your ${escapeHtml(versus.name)}</div>` : ''}
    <div class="dbtns">${btns.join('')}</div>`;
}
function invMsg(text) { popups.push({ text, x: VW / 2, y: 120, t: 1.8, screen: true, small: true, color: '#fb8' }); }
document.getElementById('inv').addEventListener('click', e => {
  const bag = e.target.closest('[data-bag]'), eqs = e.target.closest('[data-eq]'), act = e.target.closest('[data-inv-act]');
  if (bag) { invSel = { src: 'bag', id: bag.dataset.bag }; sfx('click'); renderInventory(); return; }
  if (eqs) { const it = hero.equip[eqs.dataset.eq]; if (it) { invSel = { src: 'eq', id: it.id }; sfx('click'); renderInventory(); } return; }
  if (!act || !invSel) return;
  const item = itemById(invSel); if (!item) return;
  const a = act.dataset.invAct;
  if (a === 'equip' || a === 'equip1' || a === 'equip2') {
    const r = equipFromBag(item.id, a === 'equip2' ? 'ring2' : 'ring1');
    if (r === 'ok') { sfx('pickup'); invSel = { src: 'eq', id: item.id }; } else invMsg(r);
  } else if (a === 'unequip') {
    const r = unequipToBag(GEAR_SLOTS.find(k => hero.equip[k] && hero.equip[k].id === item.id));
    if (r === 'ok') { sfx('click'); invSel = { src: 'bag', id: item.id }; } else invMsg(r);
  } else if (a === 'discard') {
    if (item.rarity >= 3 && !confirm(`Discard ${item.name}? You can sell it to the blacksmith instead.`)) return;
    if (discardFromBag(item.id)) { sfx('click'); invSel = null; }
  }
  renderInventory();
});
