// Gear and inventory test. Runs inside the real game (node build/run-script.js tests/gear.test.js). Returns { fails, ... }.
advanceIntro(); advanceIntro(); localStorage.clear(); newRun('GearTest', 'normal', 1);
const fails = [], info = {};
const ok = (cond, msg) => { if (!cond) fails.push(msg); };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const canon = x => JSON.stringify(x, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).filter(([, y]) => y !== undefined).sort(([a], [b]) => a < b ? -1 : 1)) : v);
const clk = sel => { const e = document.querySelector(sel); if (!e) { fails.push('missing element: ' + sel); return false; } e.click(); return true; };

// ---- 1. a new hero holds only the Wooden Sword, nothing else changes
ok(hero.sword.id === 'wood' && hero.inv.length === 0 && hero.equip.weapon && hero.equip.weapon.name === 'Wooden Sword', 'starter gear');
ok(swordDmg() === 20 && hero.maxHp === 100 && near(dmgReduction(), 0) && near(critChance(), 0.10) && near(critMult(), 2), 'starter stats unchanged');

// ---- 2. rolls: line counts and value ranges per rarity, 6000 items each
const rarStats = {};
for (let r = 0; r < 8; r++) {
  let n = 0, badLines = 0, outOfRange = 0, minFrac = 9, maxFrac = 0;
  for (let i = 0; i < 6000; i++) {
    const it = rollItem({ rarity: r, level: 20 }); n++;
    const keys = Object.keys(it.stats);
    if (keys.length !== RARITIES[r].lines) badLines++;
    for (const k of keys) {
      const f = it.stats[k] / GEAR_STATS[k].max, slack = GEAR_STATS[k].int ? 0.6 / GEAR_STATS[k].max : 0;     // whole-number stats round to the nearest integer
      minFrac = Math.min(minFrac, f + slack); maxFrac = Math.max(maxFrac, f - slack);
      if (!(it.stats[k] > 0) || it.stats[k] > GEAR_STATS[k].max + 1e-9) outOfRange++;
    }
    if (it.rarity !== r || !ITEM_SLOTS.includes(it.slot) || !it.name || !(it.value >= 1)) outOfRange++;
    if (it.slot === 'weapon' && (!SWORDS.some(s => s.id === it.base) || it.req > 20)) outOfRange++;
    if ((r === 7) !== !!it.unique) outOfRange++;
  }
  rarStats[RARITIES[r].name] = { lines: RARITIES[r].lines, minPct: +(minFrac * 100).toFixed(1), maxPct: +(maxFrac * 100).toFixed(1) };
  ok(badLines === 0, `${RARITIES[r].name}: wrong number of stat lines in ${badLines} items`);
  ok(outOfRange === 0, `${RARITIES[r].name}: ${outOfRange} bad values`);
  ok(minFrac >= RARITIES[r].band[0] * 0.9 && maxFrac <= RARITIES[r].band[1] * 1.07 + 1e-9, `${RARITIES[r].name}: values outside the band`);
}
info.ranges = rarStats;

// ---- 3. deeper = better rarity (weights shift), Secret never from normal rolls
const dist = t => { const c = Array(8).fill(0); for (let i = 0; i < 30000; i++) c[rollRarity(t, false)]++; return c.map(x => +(x / 300).toFixed(2)); };
info.rarityPct = { depth0: dist(0), depth1: dist(1), depth3: dist(3), depth5: dist(5) };
ok(dist(0)[7] === 0 && dist(5)[7] === 0, 'Secret rolled without a boss');
const avgIdx = t => { let s = 0; for (let i = 0; i < 20000; i++) s += rollRarity(t, false); return s / 20000; };
ok(avgIdx(3) > avgIdx(0) + 0.5, 'deeper runs should roll better grades');
let secrets = 0; for (let i = 0; i < 100000; i++) if (rollRarity(2, true) === 7) secrets++;
info.secretPerBossPiece = secrets / 100000;
ok(secrets / 100000 > 0.002 && secrets / 100000 < 0.01, 'boss Secret chance is ~0.5%');

// ---- 4. equipping changes the real stats, and unequipping restores them
const mk = (slot, rarity, stats, extra = {}) => Object.assign({ id: newItemId(), slot, rarity, name: `T ${slot}`, stats, value: 10 }, extra);
hero.hp = hero.maxHp;
const armor = mk('armor', 3, { dr: 0.10, hp: 40 }), helm = mk('helmet', 3, { hp: 60, crit: 0.05 }), ring = mk('ring', 3, { crit: 0.08, dmg: 7 }), ring2 = mk('ring', 3, { critDmg: 0.5, speed: 0.1 }), neck = mk('necklace', 3, { critDmg: 0.4, gold: 0.2, stamina: 30 });
const sw = mk('weapon', 3, { dmg: 12, cdr: 0.2 }, { base: 'iron', req: 3 });
[armor, helm, ring, ring2, neck, sw].forEach(i => addToBag(i));
const base = { dr: dmgReduction(), maxHp: hero.maxHp, crit: critChance(), cm: critMult(), dmg: swordDmg(), spd: moveSpeed(), sta: maxStamina(), fc: flipCooldown() };
ok(equipFromBag(armor.id) === 'ok' && near(dmgReduction(), base.dr + 0.10) && hero.maxHp === base.maxHp + 40, 'armor: dr and hp');
ok(equipFromBag(helm.id) === 'ok' && hero.maxHp === base.maxHp + 100 && near(critChance(), base.crit + 0.05), 'helmet: hp and crit');
ok(equipFromBag(ring.id, 'ring1') === 'ok' && equipFromBag(ring2.id, 'ring2') === 'ok' && near(critChance(), base.crit + 0.13) && near(critMult(), base.cm + 0.5) && near(moveSpeed(), base.spd + BASE_SPEED * 0.1), 'two rings');
ok(equipFromBag(neck.id) === 'ok' && maxStamina() === base.sta + 30 && near(critMult(), base.cm + 0.9), 'necklace');
hero.level = 3;
ok(equipFromBag(sw.id) === 'ok' && hero.sword.id === 'iron' && swordDmg() === base.dmg + (28 - 20) + 12 + 7 && flipCooldown() < base.fc, 'weapon: iron sword + bonus + rings, faster flip');
ok(hero.inv.some(i => i.name === 'Wooden Sword'), 'the old weapon returned to the backpack');
const hpRatio = hero.hp / hero.maxHp;
ok(hero.gearHp === 100 && hero.maxHp === base.maxHp + 100, 'gearHp tracked');
for (const k of ['armor', 'helmet', 'ring1', 'ring2', 'necklace']) ok(unequipToBag(k) === 'ok', `unequip ${k}`);
ok(near(dmgReduction(), base.dr) && hero.maxHp === base.maxHp && near(critChance(), base.crit) && near(critMult(), base.cm) && maxStamina() === base.sta && hero.hp <= hero.maxHp, 'unequip restores the stats');
ok(unequipToBag('weapon') !== 'ok', 'the weapon cannot be unequipped');

// ---- 5. caps: nothing can pass the ceilings, however much gear is stacked
hero.equip = { weapon: hero.equip.weapon, armor: mk('armor', 7, { dr: 0.35 }), helmet: mk('helmet', 7, { dr: 0.35, crit: 0.3 }), ring1: mk('ring', 7, { crit: 0.3, speed: 0.2 }), ring2: mk('ring', 7, { crit: 0.3, speed: 0.2, critDmg: 2.5 }), necklace: mk('necklace', 7, { critDmg: 2.5, dr: 0.35, speed: 0.2 }) };
hero.stats = { hp: 100, str: 0, sta: 100, cd: 10, crit: 40, critDmg: 25 };
recalcGear();
ok(near(dmgReduction(), GEAR_CAPS.dr) && near(critChance(), GEAR_CAPS.crit) && near(critMult(), GEAR_CAPS.critDmg) && near(moveSpeed(), BASE_SPEED * (1 + GEAR_CAPS.speed)), 'absolute caps hold');
ok(flipCooldown() > 0 && hero.attackDur !== 0, 'flip cooldown stays positive');
hero.stats = { hp: 0, str: 0, sta: 0, cd: 0, crit: 0, critDmg: 0 }; hero.equip = { weapon: starterWeapon('wood'), armor: null, helmet: null, ring1: null, ring2: null, necklace: null }; hero.inv = []; hero.maxHp = 100; hero.gearHp = 0; recalcGear();

// ---- 6. save and load: backpack, equipment and max HP come back exactly
const keep = [mk('armor', 5, { dr: 0.2, hp: 80 }, { unique: undefined }), mk('ring', 7, { crit: 0.3 }, { unique: 'lifesteal' }), mk('helmet', 2, { hp: 30 })];
keep.forEach(i => addToBag(i)); equipFromBag(keep[0].id); equipFromBag(keep[1].id, 'ring2');
hero.gold = 123; saveGame(true, true);
const saved = JSON.parse(localStorage.getItem('stickrpg_slot1'));
ok(Array.isArray(saved.inv) && saved.equip && saved.equip.armor && saved.gearHp === 80, 'save contains gear');
const before = canon({ e: hero.equip, i: hero.inv, m: hero.maxHp, g: hero.gearHp });
ok(loadSlot(1) === true && canon({ e: hero.equip, i: hero.inv, m: hero.maxHp, g: hero.gearHp }) === before, 'load restores gear exactly');
ok(gearHas('lifesteal') && hero.gear.dr === 0.2, 'gear sums rebuilt on load');
const savedBytes = localStorage.getItem('stickrpg_slot1').length;
info.saveBytesWithGear = savedBytes;

// ---- 7. hostile / broken saves are cleaned, never crash
const evil = JSON.parse(localStorage.getItem('stickrpg_slot1'));
evil.inv = [null, 5, 'x', { slot: 'weapon', rarity: 3, base: 'nope', stats: {} }, { slot: 'armor', rarity: 99 }, { slot: 'armor', rarity: 2, name: '<img src=x onerror=alert(1)>', stats: { dr: 9999, hp: -5, bogus: 1, crit: 'abc' }, value: 'zzz', unique: 'evil' }];
evil.equip.ring1 = { slot: 'weapon', rarity: 1, base: 'wood', stats: {} };          // wrong slot type
evil.equip.weapon = { slot: 'weapon', rarity: 1, base: 'does-not-exist' };         // unusable weapon
evil.gearHp = 1e9;
localStorage.setItem('stickrpg_slot1', JSON.stringify(evil));
ok(loadSlot(1) === true, 'garbage gear does not stop loading');
ok(hero.equip.weapon && hero.sword && hero.equip.ring1 === null, 'always holds a weapon; wrong-slot item dropped');
ok(hero.inv.length === 1 && hero.inv[0].stats.dr <= GEAR_STATS.dr.max * 1.7 && !hero.inv[0].unique && !('bogus' in hero.inv[0].stats) && !('hp' in hero.inv[0].stats), 'bad items removed, values clamped');
ok(hero.maxHp > 0 && hero.maxHp < 100000, 'max HP sane after hostile gearHp');
renderInventory(); ok(!document.getElementById('invDetail').innerHTML.includes('<img'), 'item names are escaped in the UI');
{ const d = document.createElement('div'); d.innerHTML = ''; }

// ---- 8. an old save (no gear fields) gets a Common weapon for every sword it had unlocked
const old = JSON.parse(localStorage.getItem('stickrpg_slot1')); delete old.inv; delete old.equip; delete old.gearHp; old.sword = 'flame'; old.level = 11; old.maxHp = 100;
localStorage.setItem('stickrpg_slot1', JSON.stringify(old));
ok(loadSlot(1) === true && hero.sword.id === 'flame' && hero.equip.weapon.base === 'flame', 'old save: equipped sword kept');
ok(['wood', 'iron', 'dagger', 'great'].every(id => hero.inv.some(i => i.base === id)) && hero.inv.length === 4, 'old save: unlocked swords become items');

// ---- 9. full backpack
hero.inv = []; for (let i = 0; i < INV_MAX; i++) hero.inv.push(rollItem({ level: 20 }));
ok(!addToBag(rollItem()), 'cannot add to a full backpack');
hero.equip.armor = null;
const armorSlot = mk('armor', 2, { dr: 0.05 }); hero.inv[0] = armorSlot; equipFromBag(armorSlot.id);       // wears it: 23 left in the pack
hero.inv.push(rollItem({ level: 20 }));                                                                     // ...and fill the pack again
ok(hero.inv.length === INV_MAX && unequipToBag('armor') === 'Your backpack is full.' && hero.equip.armor && hero.equip.armor.id === armorSlot.id, 'unequip refused when full, nothing lost');
const other = mk('armor', 2, { dr: 0.06 }); hero.inv[0] = other;
ok(equipFromBag(other.id) === 'ok' && hero.inv.length === INV_MAX && hero.inv.some(i => i.id === armorSlot.id), 'swapping works when the backpack is full');
const lootDrop = { kind: 'gear', item: rollItem(), x: hero.x, y: hero.y, t: 60, bob: 0, pop: 0 };
ok(hero.inv.length === INV_MAX && pickUpGear(lootDrop) === false, 'pickup refused when full');

// ---- 10. weapon level limits (and the dev override)
hero.level = 1; dev.swords = false;
const great = mk('weapon', 4, { dmg: 30 }, { base: 'great', req: 7 }); hero.inv = [great];
ok(equipFromBag(great.id).startsWith('Needs level'), 'level-gated weapon refused');
dev.swords = true; ok(equipFromBag(great.id) === 'ok', 'dev override'); dev.swords = false;

// ---- 11. drops: ~6% from normal monsters, bosses 1-3 pieces
hero.level = 10; wave = 5;
let drops6 = 0; for (let i = 0; i < 40000; i++) drops6 += gearDropsFor({ type: 'goblin' }).length;
info.normalDropRatePct = +(drops6 / 400).toFixed(2);
ok(drops6 / 40000 > 0.05 && drops6 / 40000 < 0.07, 'normal drop rate near 6%');
const bossCounts = [0, 0, 0, 0]; for (let i = 0; i < 5000; i++) bossCounts[gearDropsFor({ type: 'boss' }).length]++;
ok(bossCounts[0] === 0 && bossCounts[1] > 0 && bossCounts[2] > 0 && bossCounts[3] > 0, 'bosses always drop 1 to 3');
info.bossPieces = bossCounts;

// ---- 12. real drop objects: spawn, walk over, picked up
hero.inv = []; drops = []; dropGear(rollItem({ rarity: 6, level: 10 }), hero.x + 5, hero.y - 10);
ok(drops.length === 1 && drops[0].kind === 'gear', 'gear drop created');
for (let i = 0; i < 5; i++) updateDrops(0.05);
ok(hero.inv.length === 1 && drops.length === 0, 'walking over a drop picks it up');
dropItem('gear', hero.x + 400, hero.y); ok(drops[0].item && drops[0].item.name, 'dev "drop: gear" rolls its own item'); drops = [];
render(1);                                                                          // drawDrop for every kind must not throw
drops = [{ kind: 'gear', item: rollItem({ rarity: 7 }), x: hero.x + 40, y: hero.y, t: 60, bob: 0, pop: 0 }, { kind: 'gear', item: rollItem({ rarity: 0 }), x: hero.x - 40, y: hero.y, t: 2, bob: 0, pop: 0 }];
render(1); drops = [];

// ---- 13. effects: lifesteal, vigor, magnet, gold find
hero.equip.ring1 = mk('ring', 7, { crit: 0.1 }, { unique: 'lifesteal' }); hero.equip.ring2 = mk('ring', 7, { crit: 0.1 }, { unique: 'magnet' }); hero.equip.necklace = mk('necklace', 7, { gold: 0.5 }, { unique: 'vigor' });
recalcGear();
ok(gearHas('lifesteal') && gearHas('magnet') && gearHas('vigor') && near(gearStat('gold'), 0.5), 'unique effects and gold find on');
hero.hp = 50; hero.hpRegenT = 99; enemies = []; spawnEnemy('goblin', { x: hero.x + 30, y: hero.y }, { spawnT: 0 }); enemies[0].hp = 400; enemies[0].maxHp = 400;
hero.attackT = 0.1; hero.attackDur = 0.3; hero.hitSet = new Set(); hero.facing = 1; hero.flipT = 0; hero.dead = false;
const hpBefore = hero.hp, mhp = enemies[0].hp; updateEnemies(0.016);
ok(enemies[0].hp < mhp && hero.hp > hpBefore, `lifesteal heals on a hit (enemy ${mhp}->${enemies[0].hp}, hero ${hpBefore}->${hero.hp})`);
enemies = []; drops = [];

// ---- 14. the screens: level menu, inventory (full, selected, equip/unequip/discard by real clicks), pause menu
hero.equip.armor = null; recalcGear(); hero.inv = []; for (let i = 0; i < INV_MAX - 1; i++) hero.inv.push(rollItem({ tier: 3, level: 20 }));
showMenu('level'); ok(!document.getElementById('level').innerHTML.includes('lvSwords'), 'level screen has no sword list'); showMenu(null);
showMenu('inv');
ok(document.querySelectorAll('#invGrid .cell').length === INV_MAX && document.querySelectorAll('#invEquip .eqslot').length === 6, 'inventory grid and slots');
clk('#invGrid [data-bag]');
ok(document.getElementById('invDetail').textContent.length > 20 && document.querySelector('#invDetail [data-inv-act]'), 'detail panel shows for the selected piece');
const target = hero.inv.find(i => i.slot === 'armor') || (hero.inv[0] = mk('armor', 3, { dr: 0.1 }), hero.inv[0]);
clk(`#invGrid [data-bag="${target.id}"]`);
clk('#invDetail [data-inv-act=equip]');
ok(hero.equip.armor && hero.equip.armor.id === target.id, 'equip by clicking');
clk('#invDetail [data-inv-act=unequip]');
ok(!hero.equip.armor && hero.inv.some(i => i.id === target.id), 'unequip by clicking');
window.confirm = () => true;
clk(`#invGrid [data-bag="${target.id}"]`);
clk('#invDetail [data-inv-act=discard]');
ok(!hero.inv.some(i => i.id === target.id), 'discard by clicking');
showMenu(null); showMenu('menu'); ok(!document.querySelector('#menu [data-act=inv]') && !document.querySelector('#menu [data-act=level]'), 'pause menu no longer holds Inventory or Character'); showMenu(null);
// the I key
// the M key: one menu with two tabs (Character and Inventory); L and I no longer open anything
hero.dead = false; const key = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c }));
key('KeyL'); ok(openMenu === null, 'L does nothing now'); key('KeyI'); ok(openMenu === null, 'I does nothing now');
lastCharTab = 'level'; key('KeyM'); ok(openMenu === 'level', 'M opens the menu on the Character tab first'); key('KeyM'); ok(openMenu === null, 'M closes it');
showMenu('inv'); key('KeyM'); ok(openMenu === null, 'M closes from the Inventory tab'); key('KeyM'); ok(openMenu === 'inv', 'M reopens on the tab you used last');
clk('#inv [data-act=level]'); ok(openMenu === 'level', 'Character tab button'); clk('#level [data-act=inv]'); ok(openMenu === 'inv', 'Inventory tab button'); showMenu(null);

// ---- 15. the blacksmith buys gear (equipped pieces are never offered)
enemies = []; spawnQueue = []; wave = 9; hero.gold = 0; state = 'play'; vil = null; enterVillage(); vil.fade = 0;
hero.inv = [mk('ring', 0, { crit: 0.01 }, { value: 4 }), mk('ring', 1, { crit: 0.02 }, { value: 10 }), mk('armor', 5, { dr: 0.2 }, { value: 300 })];
const eqBefore = hero.equip.weapon.id;
vil.shop = 'smith'; showMenu('shop');
ok(document.querySelectorAll('#shopBody [data-buy]').length === 4, 'sell list: junk row + 3 items');
clk('#shopBody [data-buy=junk]');
ok(hero.inv.length === 1 && hero.gold === 14, 'sell all junk');
clk('#shopBody [data-buy^="sell:"]');
ok(hero.inv.length === 0 && hero.gold === 314 && hero.equip.weapon.id === eqBefore, 'sell one piece; the equipped weapon is untouched');
window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1' }));            // number keys on an empty list do nothing
showMenu(null); vil.leaveT = 0; leaveVillage();

// ---- 15a. the full village: gear shops and upgrades
enemies = []; spawnQueue = []; wave = 9; state = 'play'; vil = null; hero.inv = []; hero.gold = 0; enterVillage(); vil.fade = 0;
for (const id of ['brann', 'dagna', 'lysa']) ok(vil.npcs.some(n => n.id === id), id + ' lives in every village');
{ const brann = vil.npcs.find(n => n.id === 'brann'); vil.talk = { kind: 'npc', ref: brann }; openTalk();
  ok([...document.querySelectorAll('#talkBtns button')].map(b => b.dataset.talk).join() === 'shop:smithBuy,shop:smithUp,shop:smithSell,bye', 'Brann: buy weapons, upgrade gear, sell gear');
  clk('#talkBtns [data-talk="shop:smithBuy"]'); ok(openMenu === 'shop' && vil.shop === 'smithBuy', 'Buy weapons opens his weapon stock'); showMenu(null); }
for (const [shop, slots] of [['smithBuy', ['weapon']], ['armour', ['armor', 'helmet']], ['jewel', ['ring', 'necklace']]]) {
  vil.shop = shop; hero.gold = 0; showMenu('shop');
  const rows = document.querySelectorAll('#shopBody [data-buy]');
  ok(rows.length === 4 && [...rows].every(b => b.disabled), shop + ': four pieces for sale, none affordable with 0 gold');
  const key = shop === 'smithBuy' ? 'smith' : shop;
  ok(vil.stock[key].every(e => slots.includes(e.item.slot)), shop + ': sells the right kinds of gear');
  hero.gold = 100000; showMenu('shop'); const before = hero.inv.length, e0 = vil.stock[key][0];
  clk('#shopBody [data-buy]');
  ok(hero.inv.length === before + 1 && hero.inv.includes(e0.item) && hero.gold === 100000 - e0.price && vil.stock[key][0] === null, shop + ': buying moves the piece to the backpack and takes the gold');
  ok(document.querySelectorAll('#shopBody [data-buy]').length === 3, shop + ': a sold piece leaves the shelf');
  hero.inv = []; for (let i = 0; i < INV_MAX; i++) hero.inv.push(rollItem({ slot: 'helmet', rarity: 1 })); showMenu('shop');
  ok([...document.querySelectorAll('#shopBody [data-buy]')].every(b => b.disabled), shop + ': a full backpack cannot buy'); hero.inv = [];
}
// upgrades
{ hero.inv = []; hero.gold = 100000; const armor = rollItem({ slot: 'armor', rarity: 3 }); armor.stats = { dr: 0.08, hp: 40 }; hero.inv.push(armor); equipFromBag(armor.id);
  const worn = hero.equip.armor, dr0 = worn.stats.dr, hp0 = worn.stats.hp, maxHp0 = hero.maxHp, cost = upgradeCost(worn);
  vil.shop = 'smithUp'; showMenu('shop');
  ok(!!document.querySelector('#shopBody [data-buy="up:' + worn.id + '"]'), 'upgrade list shows the worn armour');
  clk('#shopBody [data-buy="up:' + worn.id + '"]');
  ok(worn.up === 1 && worn.stats.dr > dr0 * 1.09 && worn.stats.hp >= hp0 + 1 && / \+1$/.test(worn.name), 'upgrade raises every stat by about 10% and marks the name');
  ok(hero.gold === 100000 - cost && hero.maxHp === maxHp0 + (worn.stats.hp - hp0) && near(hero.gear.dr, worn.stats.dr), 'upgrade costs gold and a worn piece updates max HP and totals at once');
  while (canUpgrade(worn)) upgradeItem(worn);
  ok(worn.up === upgradeMax(worn) && worn.up === 4 && !upgradeItem(worn), 'upgrades stop at the maximum for the grade (Rare: 4)');
  showMenu('shop'); ok(document.querySelector('#shopBody [data-buy="up:' + worn.id + '"]').disabled, 'a maxed piece shows a disabled button');
  const copy = sanitizeItem(JSON.parse(JSON.stringify(worn))); ok(copy.up === 4 && near(copy.stats.dr, worn.stats.dr), 'upgrade level and stats survive a save');
  const hostile = sanitizeItem({ ...JSON.parse(JSON.stringify(worn)), up: 99, stats: { dr: 50 } }); ok(hostile.up === 4 && hostile.stats.dr <= GEAR_STATS.dr.max * 1.7, 'a hostile upgrade level or stat is clamped');
  ok(!canUpgrade(starterWeapon()), 'a starter weapon with no stats has nothing to upgrade'); }
showMenu(null); vil.leaveT = 0; leaveVillage(); hero.gold = 0; hero.inv = [];

// ---- 15b. dev menu gear buttons
hero.inv = []; showMenu('dev');
ok(document.querySelectorAll('#devBody [data-dev=gear]').length === 8, 'dev menu lists the 8 rarities');
clk('#devBody [data-dev=gear][data-t="7"]'); ok(hero.inv.length === 1 && hero.inv[0].rarity === 7, 'dev: give a Secret piece');
clk('#devBody [data-dev=fillpack]'); ok(hero.inv.length === INV_MAX, 'dev: fill backpack');
clk('#devBody [data-dev=gear][data-t="2"]'); ok(drops.some(d => d.kind === 'gear'), 'dev: a full pack drops the piece on the floor instead');
clk('#devBody [data-dev=clearpack]'); ok(hero.inv.length === 0, 'dev: clear backpack'); drops = []; showMenu(null);

// ---- 16. HUD and the world still draw with gear equipped
for (let i = 0; i < 30; i++) { update(0.05); render(1); }
info.hudWeapon = hero.equip.weapon.name;

return { fails, info };
