// Two launches of the packaged app sharing one data folder: save in the first, wipe the browser-side storage,
// then check the second launch restores the save from the file mirror (and that deleting a slot deletes the file).
const { spawnSync } = require('child_process');
const path = require('path'), fs = require('fs'), os = require('os');
const exe = process.argv[2] ? path.resolve(process.argv[2]) : require('electron');
const args = process.argv[2] ? [] : [path.resolve(__dirname, '..')];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stickrpg-savetest-'));
const run = phase => {
  const r = spawnSync(exe, args, { env: { ...process.env, STICKRPG_SELFTEST: '1', STICKRPG_TESTDATA: dir, STICKRPG_TESTPHASE: phase }, encoding: 'utf8', timeout: 90000 });
  const line = ((r.stdout || '') + (r.stderr || '')).split(/\r?\n/).find(l => l.startsWith('SELFTEST '));
  console.log(phase + ':', line || 'no result', 'exit', r.status);
  return r.status === 0;
};
let ok = run('write');
for (const d of ['Local Storage', 'Session Storage', 'IndexedDB']) fs.rmSync(path.join(dir, d), { recursive: true, force: true });
console.log('files kept:', fs.readdirSync(path.join(dir, 'saves')).join(', '));
ok = run('restore') && ok;
fs.rmSync(dir, { recursive: true, force: true });
console.log(ok ? 'SAVE MIRROR OK' : 'SAVE MIRROR FAILED');
process.exit(ok ? 0 : 1);
