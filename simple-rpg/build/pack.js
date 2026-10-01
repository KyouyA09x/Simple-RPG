// Builds the desktop app for this computer (or `node build/pack.js <platform> <arch>`).
// The finished app is a self-contained folder at the top of the project: <project>/Stick RPG/Stick RPG.exe
// Only the files the game needs are packaged (an allow-list), so backups, history and dev tools never ship.
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { packager } = require('@electron/packager');

const root = path.resolve(__dirname, '..');
const stage = path.join(__dirname, '_out');                  // packager output and the zip; the app itself is moved to <project>/Stick RPG
const GAME_FILES = ['index.html', 'main.js', 'preload.js', 'package.json',
  'sfx.js', 'postfx.js', 'sky.js', 'vision.js', 'biomes.js', 'props.js', 'terrain.js', 'critters.js', 'gear.js', 'villagers.js', 'village.js', 'game.js'];
// allow-list: everything else (including the finished "Stick RPG" folder and the staging folder) is never packaged
const keep = new Set(['', ...GAME_FILES.map(f => '/' + f), '/launcher', '/launcher/stickrpg.ico']);

// Chromium ships ~55 language packs; the game is English only, so keep one (saves ~40 MB unpacked).
async function trimLocales({ buildPath }) {
  const dir = path.join(buildPath, 'locales');
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (f !== 'en-US.pak') fs.rmSync(path.join(dir, f), { force: true });
}

const README = [
  'STICK RPG',
  '',
  'Run "Stick RPG.exe" to play. No installation needed; keep this whole folder together.',
  'Your saves are in the "saves" folder next to the exe, and settings in "data"; both survive updates, and you can back them up by copying the folders.',
  'Settings > Load Game can also export a save to a file.',
  'Controls: WASD/arrows move, Space attack, Shift flip, Q potion, E talk, L level menu, Esc pause, F fullscreen.',
  '',
].join('\r\n');

(async () => {
  const platform = process.argv[2] || process.platform, arch = process.argv[3] || process.arch;
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const icon = platform === 'win32' ? path.join(root, 'launcher', 'stickrpg.ico') : undefined;
  const out = await packager({
    dir: root, out: stage, name: 'Stick RPG', executableName: platform === 'win32' ? 'Stick RPG' : 'stick-rpg',
    platform, arch, overwrite: true, asar: true, prune: true, icon,
    appVersion: pkg.version, appCopyright: 'Stick RPG',
    ignore: p => !keep.has(p) && !p.startsWith('/launcher/'),
    afterExtract: platform === 'darwin' ? [] : [trimLocales],
    win32metadata: { FileDescription: 'Stick RPG', ProductName: 'Stick RPG', CompanyName: 'Stick RPG' },
  });
  for (const built of out) {
    fs.writeFileSync(path.join(built, 'README.txt'), README);
    if (platform !== process.platform) { console.log('built', built); continue; }
    const final = path.join(root, 'Stick RPG');
    // 1) a clean copy named "Stick RPG" in the staging folder (this is what gets zipped: it never contains anyone's saves)
    const clean = path.join(stage, 'Stick RPG');
    fs.rmSync(clean, { recursive: true, force: true });
    fs.renameSync(built, clean);
    if (platform === 'win32') {
      const zip = path.join(stage, 'Stick RPG.zip');
      fs.rmSync(zip, { force: true });
      execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${clean}' -DestinationPath '${zip}' -CompressionLevel Optimal`], { stdio: 'inherit' });
      console.log('zipped', zip, (fs.statSync(zip).size / 1048576).toFixed(1) + ' MB');
    }
    // 2) swap it into the project folder, carrying over the player's saves and settings
    const old = path.join(stage, '_previous');
    fs.rmSync(old, { recursive: true, force: true });
    if (fs.existsSync(final)) fs.renameSync(final, old);        // fails (EBUSY / EPERM) if the game is still running: close it first
    fs.renameSync(clean, final);
    for (const keepDir of ['saves', 'data']) {
      const from = path.join(old, keepDir), to = path.join(final, keepDir);
      if (fs.existsSync(from)) { fs.rmSync(to, { recursive: true, force: true }); fs.renameSync(from, to); console.log('kept', keepDir); }
    }
    fs.rmSync(old, { recursive: true, force: true });
    console.log('app ready:', final);
  }
})().catch(err => { console.error(err); process.exit(1); });
