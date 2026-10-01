// Screenshots of random villages in the real app window: node build/shots-village.js
const { spawnSync } = require('child_process');
const path = require('path');
const dir = path.join(__dirname, '_out', 'shots');
const go = (zoneIdx, where, tod = 0.5) => `(() => { tod = ${tod}; state = 'play'; vil = null; zone = ${zoneIdx}; enemies = []; spawnQueue = []; wave = 9; enterVillage(); vil.fade = 0; dev.freezeTime = true;
  const v = vil; const at = ${where}; hero.x = at[0]; hero.y = at[1]; cam.x = 1e9; cam.y = 1e9; for (let i = 0; i < 40; i++) updateVillage(0.05); window.__v = v; })()`;
const scenes = [
  { name: 'village-1-arrival', biome: 0, weather: 'clear', tod: 0.5, js: go(0, 'v.arrive ? [v.arrive.x + 60 * v.E, v.arrive.y] : [200, 548]') },
  { name: 'village-2-shops', biome: 0, weather: 'clear', tod: 0.5, js: go(0, '[v.plaza.x, 440]') },
  { name: 'village-3-smithy', biome: 0, weather: 'clear', tod: 0.5, js: go(1, '[v.anvil.x, v.anvil.y - 50]') },
  { name: 'village-4-snow-night', biome: 2, weather: 'clear', tod: 0.5, js: go(2, '[v.plaza.x, 480]', 0.92) },
  { name: 'village-5-jungle', biome: 5, weather: 'clear', tod: 0.5, js: go(5, '[v.lawnC.x, v.lawnC.y + 30]') },
];
const r = spawnSync(require('electron'), [path.resolve(__dirname, '..')], {
  env: { ...process.env, STICKRPG_SELFTEST: '1', STICKRPG_TESTPHASE: 'shots', STICKRPG_SHOTS_DIR: dir, STICKRPG_SCENES: JSON.stringify(scenes) }, encoding: 'utf8', timeout: 240000 });
console.log(((r.stdout || '') + (r.stderr || '')).split(/\r?\n/).find(l => l.startsWith('SELFTEST ')) || ('no result ' + (r.stderr || '').slice(-800)), 'exit', r.status);
console.log('screenshots in', dir);
