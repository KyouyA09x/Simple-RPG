// Runs a test script (JavaScript, may use await and must `return` a value) inside the real game, silently.
// Usage: node build/run-script.js tests/<file>.js [path-to-packaged-exe]
const { spawnSync } = require('child_process');
const path = require('path');
const script = path.resolve(process.argv[2]);
const exe = process.argv[3] ? path.resolve(process.argv[3]) : require('electron');
const args = process.argv[3] ? [] : [path.resolve(__dirname, '..')];
const r = spawnSync(exe, args, { env: { ...process.env, STICKRPG_SELFTEST: '1', STICKRPG_TESTPHASE: 'script', STICKRPG_TESTSCRIPT: script }, encoding: 'utf8', timeout: 240000, maxBuffer: 1e8 });
const line = ((r.stdout || '') + (r.stderr || '')).split(/\r?\n/).find(l => l.startsWith('SELFTEST '));
if (!line) { console.log('no result', (r.stderr || '').slice(-1500)); process.exit(2); }
const res = JSON.parse(line.slice(9));
console.log(JSON.stringify(res.script || res, null, 1));
const fails = res.script && res.script.fails;
process.exit(fails && fails.length ? 1 : 0);
