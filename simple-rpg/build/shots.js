// Takes screenshots of a few set-up scenes in the real app window (silent). Usage: node build/shots.js
const { spawnSync } = require('child_process');
const path = require('path');
const dir = path.join(__dirname, '_out', 'shots');
const scenes = [
  { name: '1-night-forest', biome: 0, weather: 'clear', tod: 0.95, eyes: true },
  { name: '2-night-forest-radiant-lantern', biome: 0, weather: 'clear', tod: 0.95, lamp: 3 },
  { name: '3-fog-swamp-day', biome: 4, weather: 'fog', tod: 0.5, eyes: true },
  { name: '4-rain-jungle-night', biome: 5, weather: 'rain', tod: 0.95, eyes: true },
  { name: '5-whiteout-snow', biome: 2, weather: 'whiteout', tod: 0.5 },
  { name: '6-clear-day-forest', biome: 0, weather: 'clear', tod: 0.5 },
];
const r = spawnSync(require('electron'), [path.resolve(__dirname, '..')], {
  env: { ...process.env, STICKRPG_SELFTEST: '1', STICKRPG_TESTPHASE: 'shots', STICKRPG_SHOTS_DIR: dir, STICKRPG_SCENES: JSON.stringify(scenes) }, encoding: 'utf8', timeout: 120000 });
console.log(((r.stdout || '') + (r.stderr || '')).split(/\r?\n/).find(l => l.startsWith('SELFTEST ')) || 'no result', 'exit', r.status);
console.log('screenshots in', dir);
