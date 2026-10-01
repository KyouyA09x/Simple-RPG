// Long play-through with gear: waves 1-24 through the real loop, drops picked up for real, villages, bosses, camps, saves.
advanceIntro(); advanceIntro(); localStorage.clear(); newRun('Flow', 'normal', 1);
const fails = [], info = {};
const ok = (c, m) => { if (!c) fails.push(m); };
dev.god = true;
const campWaves = new Set(), villageWaves = new Set();
let gearSeen = 0, pickups = 0, rareSeen = 0, maxBag = 0, villages = 0, camps = 0, errors = 0, lastState = '';
const t0 = performance.now();
const origPick = pickUpGear; window.pickUpGear = d => { const r = origPick(d); if (r) pickups++; return r; };
const origDrop = dropGear; window.dropGear = (it, x, y) => { gearSeen++; if (it.rarity >= 3) rareSeen++; return origDrop(it, x, y); };
for (let i = 0; i < 60000 && wave < 24; i++) {
  try {
    if (state === 'play') {
      update(0.05);
      hero.hp = hero.maxHp;
      for (const m of enemies) m.hp = 0; if (enemies.length) updateEnemies(0);
      for (const d of drops) if (d.kind === 'gear' || d.kind === 'gold') { d.x = hero.x; d.y = hero.y - 10; }         // walk over everything
      if (i % 400 === 0) render(1);
      maxBag = Math.max(maxBag, hero.inv.length);
      // gear gets worn when it's better, like a player would
      if (i % 200 === 0) for (const it of [...hero.inv]) { const key = it.slot === 'ring' ? 'ring1' : it.slot; if (!hero.equip[key] && (it.slot !== 'weapon')) equipFromBag(it.id); }
      if (hero.level < 12 && i % 100 === 0) gainXp(hero.xpNext, hero);
    } else if (state === 'camp') { campWaves.add(wave); updateCamp(0.1); }
    else if (state === 'village') {
      const v = vil; v.fade = 0; villageWaves.add(wave);
      if (v.t > 1 && v.t < 1.2) { vil.shop = 'smith'; showMenu('shop'); for (const b of document.querySelectorAll('#shopBody [data-buy]')) { b.click(); break; } showMenu(null); }
      if (v.t > 2.5 && !v.leaveT) v.leaveT = 0.9;
      updateVillage(0.05);
    }
    if (state !== 'play' || lastState !== 'play') lastState = state; else lastState = state;
  } catch (e) { errors++; fails.push('exception: ' + String(e.stack).slice(0, 400)); break; }
  if (i % 5000 === 0 && state === 'play') { saveGame(true, true); const before = hero.maxHp; if (!loadSlot(currentSlot)) fails.push('reload failed'); if (hero.maxHp !== before) fails.push(`maxHp changed on reload ${before}->${hero.maxHp}`); dev.god = true; }
}
info.reachedWave = wave; info.gearDropped = gearSeen; info.pickedUp = pickups; info.rareOrBetter = rareSeen; info.maxBackpack = maxBag; info.villages = [...villageWaves]; info.camps = [...campWaves];
info.equipped = Object.fromEntries(Object.entries(hero.equip).map(([k, v]) => [k, v ? `${RARITIES[v.rarity].name} ${v.name}` : null]));
info.stats = { dr: +dmgReduction().toFixed(3), crit: +critChance().toFixed(3), maxHp: hero.maxHp, gearHp: hero.gearHp, dmg: swordDmg() };
info.seconds = +((performance.now() - t0) / 1000).toFixed(1);
ok(wave >= 24, 'reached wave 24');
ok(gearSeen >= 5 && pickups === gearSeen, 'gear drops happen and every one is picked up');
ok(maxBag <= INV_MAX, 'backpack never exceeds its size');
ok(villageWaves.size === 2 && campWaves.size === 2, `villages at waves ${[...villageWaves]} and camps at ${[...campWaves]}`);
ok(hero.maxHp === 100 + hero.gearHp + 20 * hero.stats.hp, `max HP bookkeeping: ${hero.maxHp} vs ${100 + hero.gearHp + 20 * hero.stats.hp}`);
return { fails, info };
