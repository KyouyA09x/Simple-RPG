// Screenshots of the inventory: node build/shots-gear.js
const { spawnSync } = require('child_process');
const path = require('path');
const dir = path.join(__dirname, '_out', 'shots');
const setup = `(() => {
  hero.level = 12; hero.gold = 1840; hero.inv = [];
  const give = (slot, rarity) => { const it = rollItem({ slot, rarity, level: 12 }); hero.inv.push(it); return it; };
  const worn = [['armor', 3], ['helmet', 4], ['ring', 5], ['necklace', 2]].map(([s, r]) => { const it = give(s, r); equipFromBag(it.id, 'ring1'); return it; });
  for (const [s, r] of [['weapon', 2], ['weapon', 5], ['armor', 1], ['armor', 6], ['helmet', 0], ['ring', 4], ['ring', 7], ['necklace', 5], ['weapon', 3], ['helmet', 3], ['ring', 2], ['necklace', 1], ['armor', 4], ['weapon', 7]]) give(s, r);
  showMenu('inv');
  const pick = hero.inv.find(i => i.slot === 'armor' && i.rarity === 6); invSel = { src: 'bag', id: pick.id }; renderInventory(); })();`;
const scenes = [
  { name: 'gear-1-inventory', biome: 0, weather: 'clear', tod: 0.5, js: setup },
  { name: 'gear-2-secret-ring', biome: 0, weather: 'clear', tod: 0.5, js: setup + `(() => { const sr = hero.inv.find(i => i.rarity === 7 && i.slot === 'ring'); invSel = { src: 'bag', id: sr.id }; renderInventory(); })();` },
];
const r = spawnSync(require('electron'), [path.resolve(__dirname, '..')], {
  env: { ...process.env, STICKRPG_SELFTEST: '1', STICKRPG_TESTPHASE: 'shots', STICKRPG_SHOTS_DIR: dir, STICKRPG_SCENES: JSON.stringify(scenes) }, encoding: 'utf8', timeout: 120000 });
console.log(((r.stdout || '') + (r.stderr || '')).split(/\r?\n/).find(l => l.startsWith('SELFTEST ')) || 'no result', 'exit', r.status);
