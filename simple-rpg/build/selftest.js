// Boots the app headlessly-ish (a real window opens for a moment), plays a few frames, walks into the village,
// checks the save mirror, and exits 0 on success. Usage: npm run selftest [path-to-packaged-exe]
const { spawn } = require('child_process');
const path = require('path');
const exe = process.argv[2] ? path.resolve(process.argv[2]) : require('electron');
const args = process.argv[2] ? [] : [path.resolve(__dirname, '..')];
const p = spawn(exe, args, { env: { ...process.env, STICKRPG_SELFTEST: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let out = '', timer = setTimeout(() => { console.error('selftest timed out'); p.kill(); process.exit(2); }, 240000);
p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
p.on('exit', code => {
  clearTimeout(timer);
  const line = out.split(/\r?\n/).find(l => l.startsWith('SELFTEST '));
  console.log(line || out.slice(-2000));
  process.exit(code === 0 ? 0 : 1);
});
