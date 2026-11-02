// Builds the Windows installer: node build/installer.js   (run `npm run pack` first; it packages <project>/launcher)
// Result: build/_out/installer/Stick-RPG-Setup-<version>.exe  (per-user install, no admin rights needed)
// The installed game keeps saves and settings in %APPDATA%\Stick RPG (an "installed.flag" next to the exe tells main.js),
// so uninstalling or updating never deletes a player's progress.
const path = require('path');
const fs = require('fs');
const builder = require('electron-builder');

const root = path.resolve(__dirname, '..');
const out = path.join(__dirname, '_out');
const src = path.join(out, 'installer-src');
const launcher = path.join(root, 'launcher');
if (!fs.existsSync(path.join(launcher, 'Stick RPG.exe'))) { console.error('Run "npm run pack" first.'); process.exit(1); }

// a clean copy of the packaged game: never the saves or settings of whoever built it
fs.rmSync(src, { recursive: true, force: true });
fs.cpSync(launcher, src, { recursive: true, filter: p => !['saves', 'data'].includes(path.basename(p)) || path.dirname(p) !== launcher });
fs.writeFileSync(path.join(src, 'installed.flag'), 'Saves and settings live in %APPDATA%\\Stick RPG, not in this folder.\r\n');

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
builder.build({
  targets: builder.Platform.WINDOWS.createTarget('nsis'),
  prepackaged: src,
  config: {
    appId: 'com.stickrpg.game', productName: 'Stick RPG', copyright: 'Stick RPG',
    directories: { output: path.join(out, 'installer') },
    extraMetadata: { name: pkg.name, version: pkg.version, main: 'main.js' },
    win: { icon: path.join(root, 'icon', 'stickrpg.ico'), target: [{ target: 'nsis', arch: ['x64'] }], signAndEditExecutable: false },
    nsis: {
      oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true,
      createDesktopShortcut: true, createStartMenuShortcut: true, shortcutName: 'Stick RPG',
      deleteAppDataOnUninstall: false, runAfterFinish: true,
      installerIcon: path.join(root, 'icon', 'stickrpg.ico'), uninstallerIcon: path.join(root, 'icon', 'stickrpg.ico'),
      artifactName: 'Stick-RPG-Setup-${version}.exe',
    },
    publish: null,
  },
}).then(files => { console.log('installer ready:', files.join('\n')); fs.rmSync(src, { recursive: true, force: true }); })
  .catch(err => { console.error(err); process.exit(1); });
