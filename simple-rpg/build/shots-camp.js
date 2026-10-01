// Screenshots of the campfire scene in every biome at a few points of the night: node build/shots-camp.js
const { spawnSync } = require('child_process');
const path = require('path');
const dir = path.join(__dirname, '_out', 'shots');
const scenes = [];
const BIOME_KEYS = ['forest', 'desert', 'snow', 'volcano', 'swamp', 'jungle', 'ruins', 'highlands'];
const at = (z, name, ct, t0 = 0.62) => ({ name: `camp-${name}`, biome: 0, weather: 'clear', tod: 0.5, js: `(() => { tod = ${t0}; startCamp(${z}); camp.built = true; campT = ${ct}; })()` });
for (let z = 0; z < 8; z++) scenes.push(at(z, `${z}-${BIOME_KEYS[z]}-night`, 3.6));
scenes.push(at(0, '0-forest-dusk', 1.9), at(0, '0-forest-dawn', 5.5), at(2, '2-snow-dawn', 5.6), at(3, '3-volcano-dawn', 5.6));
const r = spawnSync(require('electron'), [path.resolve(__dirname, '..')], {
  env: { ...process.env, STICKRPG_SELFTEST: '1', STICKRPG_TESTPHASE: 'shots', STICKRPG_SHOTS_DIR: dir, STICKRPG_SCENES: JSON.stringify(scenes) }, encoding: 'utf8', timeout: 240000 });
console.log(((r.stdout || '') + (r.stderr || '')).split(/\r?\n/).find(l => l.startsWith('SELFTEST ')) || ('no result ' + (r.stderr || '').slice(-800)), 'exit', r.status);
console.log('screenshots in', dir);
