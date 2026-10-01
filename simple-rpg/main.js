// Stick RPG desktop app (Electron). The game itself is plain HTML/JS and runs unchanged in a browser;
// this file only opens it in a window, remembers the window size, mirrors save files to disk and blocks
// anything that isn't the game itself from loading.
const { app, BrowserWindow, Menu, ipcMain, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SELFTEST = !!process.env.STICKRPG_SELFTEST;

// Everything the game writes lives next to the game, in its own folders:
//   <game folder>\saves   the save files (slot1.json ...)
//   <game folder>\data    settings and the browser profile
// If the game folder isn't writable (for example it sits in Program Files) it falls back to %APPDATA%\Stick RPG.
const LEGACY_DIR = app.getPath('userData');                      // %APPDATA%\Stick RPG: where the first desktop builds kept saves
let SAVES_ROOT;
if (SELFTEST && !process.env.STICKRPG_PORTABLE) {                // tests never touch real saves (STICKRPG_PORTABLE=1 tests the real game-folder logic on a copy)
  const dir = process.env.STICKRPG_TESTDATA || fs.mkdtempSync(path.join(os.tmpdir(), 'stickrpg-test-'));
  app.setPath('userData', dir); SAVES_ROOT = path.join(dir, 'saves');
} else {
  const home = app.isPackaged ? path.dirname(process.execPath) : __dirname;
  let writable = false;
  try { fs.mkdirSync(path.join(home, 'saves'), { recursive: true }); const t = path.join(home, 'saves', '.write-test'); fs.writeFileSync(t, 'x'); fs.rmSync(t); writable = true; } catch {}
  if (writable) { app.setPath('userData', path.join(home, 'data')); SAVES_ROOT = path.join(home, 'saves'); }
  else SAVES_ROOT = path.join(LEGACY_DIR, 'saves');
  // one-time move of saves written by earlier builds into the game's own save folder
  try {
    const old = path.join(LEGACY_DIR, 'saves');
    if (SAVES_ROOT !== old && fs.existsSync(old)) for (const f of fs.readdirSync(old)) {
      if (/^slot[1-3]\.json$/.test(f) && !fs.existsSync(path.join(SAVES_ROOT, f))) fs.copyFileSync(path.join(old, f), path.join(SAVES_ROOT, f));
    }
  } catch (err) { console.error('save migration failed', err.message); }
}

// Audio is allowed from the first frame (the game starts its music from a click anyway); WebGL (Ultra post-FX)
// should work on GPUs that Chromium blocklists by default.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('force_high_performance_gpu');     // on laptops with two GPUs, use the discrete (NVIDIA / AMD) one

const SAVE_DIR = () => SAVES_ROOT;
const STATE_FILE = () => path.join(app.getPath('userData'), 'window-state.json');
const validSlot = i => Number.isInteger(i) && i >= 1 && i <= 3;

// ---- save-file mirror (called from preload.js) ----
ipcMain.on('save:write', (e, slot, json) => {
  if (!validSlot(slot) || typeof json !== 'string' || json.length > 2e6) return;
  try {
    fs.mkdirSync(SAVE_DIR(), { recursive: true });
    const file = path.join(SAVE_DIR(), `slot${slot}.json`), tmp = file + '.tmp';
    fs.writeFileSync(tmp, json, 'utf8');
    fs.renameSync(tmp, file);                                  // write-then-rename: a crash never leaves half a save
  } catch (err) { console.error('save write failed', err.message); }
});
ipcMain.on('save:delete', (e, slot) => {
  if (!validSlot(slot)) return;
  try { fs.rmSync(path.join(SAVE_DIR(), `slot${slot}.json`), { force: true }); } catch {}
});
ipcMain.on('save:read', (e, slot) => {
  let out = null;
  if (validSlot(slot)) { try { out = fs.readFileSync(path.join(SAVE_DIR(), `slot${slot}.json`), 'utf8'); } catch {} }
  e.returnValue = out;
});
ipcMain.on('app:quit', () => app.quit());
ipcMain.on('save:folder', () => { try { fs.mkdirSync(SAVE_DIR(), { recursive: true }); shell.openPath(SAVE_DIR()); } catch {} });

// ---- window ----
function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE(), 'utf8'));
    const ok = Number.isFinite(s.width) && Number.isFinite(s.height) && s.width >= 640 && s.height >= 360;
    if (!ok) return {};
    const onScreen = Number.isFinite(s.x) && Number.isFinite(s.y) &&
      screen.getAllDisplays().some(d => s.x >= d.bounds.x - 50 && s.x < d.bounds.x + d.bounds.width - 100 && s.y >= d.bounds.y - 10 && s.y < d.bounds.y + d.bounds.height - 100);
    return { width: s.width, height: s.height, ...(onScreen ? { x: s.x, y: s.y } : {}), maximized: !!s.maximized };
  } catch { return {}; }
}
function saveState(win) {
  try {
    const maximized = win.isMaximized(), b = maximized ? win.getNormalBounds() : win.getBounds();
    fs.writeFileSync(STATE_FILE(), JSON.stringify({ ...b, maximized }));
  } catch {}
}

let mainWin = null;
function createWindow() {
  const st = loadState();
  const win = new BrowserWindow({
    width: st.width || 1280, height: st.height || 720, x: st.x, y: st.y, minWidth: 800, minHeight: 450,
    backgroundColor: '#000000', title: 'Stick RPG', autoHideMenuBar: true, show: false,
    icon: path.join(__dirname, 'launcher', 'stickrpg.ico'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  });
  mainWin = win;
  if (st.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());
  win.on('close', () => saveState(win));
  win.on('closed', () => { mainWin = null; });
  // the window only ever shows the game: no navigation away, no pop-ups
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.webContents.on('render-process-gone', (e, d) => { console.error('renderer gone', d.reason); if (!SELFTEST && d.reason !== 'clean-exit') win.reload(); });
  win.loadFile(path.join(__dirname, 'index.html'));
  if (process.env.STICKRPG_DEVTOOLS) win.webContents.openDevTools({ mode: 'detach' });
  return win;
}

// ---- self test: `STICKRPG_SELFTEST=1 "Stick RPG.exe"` boots the game, plays a few frames, prints JSON, exits ----
async function selfTest(win) {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const run = code => win.webContents.executeJavaScript(code, true);
  const result = { ok: false };
  try {
    await wait(800);
    if (process.env.STICKRPG_TESTPHASE === 'script') {           // run any test script inside the real app: the script's return value is printed
      result.script = await run(`(async () => {
${fs.readFileSync(process.env.STICKRPG_TESTSCRIPT, 'utf8')}
})()`);
      console.log('SELFTEST ' + JSON.stringify(result)); app.exit(0); return;
    }
    if (process.env.STICKRPG_TESTPHASE === 'shots') {            // screenshots of set-up scenes into STICKRPG_SHOTS_DIR (to look at the game for real)
      const dir = process.env.STICKRPG_SHOTS_DIR || os.tmpdir();
      fs.mkdirSync(dir, { recursive: true });
      await run(`advanceIntro(); advanceIntro(); localStorage.clear(); newRun('Shots', 'normal', 1); settings.quality = 'high'; settings.comfort = false; applySettings(); dev.freezeTime = true; dev.god = true;`);
      const scenes = JSON.parse(process.env.STICKRPG_SCENES || '[]');
      for (const sc of scenes) {
        await run(`(() => { setBiome(${sc.biome}, false); setWeather('${sc.weather}', true); tod = ${sc.tod}; enemies = []; spawnQueue = []; wave = 3; waveTimer = 999;
          hero.x = WW / 2; hero.y = WH / 2; hero.lamp = ${sc.lamp || 0}; applyLamp(); hero.hp = hero.maxHp; popups = []; for (let i = 0; i < 20; i++) update(0.05); cam.x = hero.x - VW / 2; cam.y = hero.y - VH / 2; })()`);
        if (sc.js) await run(sc.js);
        await wait(500);
        if (sc.eyes) await run(`(() => { const c = visibilityClearRadius(); for (const [a, d] of [[2.4, 38], [3.4, 70], [0.4, 55]]) darkEyes.push({ x: hero.x + Math.cos(a) * (c + d), y: hero.y + Math.sin(a) * (c + d) * 0.75, age: 1, life: 99, blink: 99, gap: 6.5, f: 1 }); })()`);
        await wait(350);
        const img = await win.webContents.capturePage();
        fs.writeFileSync(path.join(dir, sc.name + '.png'), img.toPNG());
        result[sc.name] = await run(`({ clear: Math.round(visibilityClearRadius()), sev: +visibilitySeverity().toFixed(2), eyes: darkEyes.length })`);
      }
      console.log('SELFTEST ' + JSON.stringify(result)); app.exit(0); return;
    }
    if (process.env.STICKRPG_TESTPHASE === 'audio') {            // how loud is everything? peak dBFS of each sound, measured on the master bus
      result.audio = await run(`(async () => {
        const a = Sound.ctx(); await new Promise(r => setTimeout(r, 400));
        Sound.music(null); Sound.setVolume(0.8, 0, 0.6); Sound.setScene(null);
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const peakOver = async ms => { let pk = -100; const t0 = performance.now(); while (performance.now() - t0 < ms) { const l = Sound.level(); if (l && l.peak > pk) pk = l.peak; await sleep(10); } return +pk.toFixed(1); };
        const out = { ctx: a && a.state, floor: await peakOver(300), sfx: {}, calls: {}, steps: {}, pos: {}, beds: {} };
        for (const n of ['hit', 'swing', 'pickup', 'levelup', 'hurt', 'kill', 'coin', 'click', 'potion']) { Sound.sfx(n); out.sfx[n] = await peakOver(600); await sleep(150); }
        for (const n of ['birdsong', 'chirp', 'cricket', 'owl', 'frog', 'wolf', 'hawk', 'gust', 'drip', 'toll', 'insects', 'rumble', 'glub', 'icecrack', 'rustle', 'lap', 'wail']) { Sound.call(n); out.calls[n] = await peakOver(1500); await sleep(200); }
        for (const n of ['grass', 'sand', 'snow', 'stone', 'mud', 'water']) { Sound.step(n); out.steps[n] = await peakOver(250); await sleep(80); }
        for (const n of ['chop', 'hammer', 'sweep', 'pour', 'dip', 'kick', 'bark', 'cluck', 'giggle', 'door']) { Sound.sfxAt(n, 1); out.pos[n + ' close'] = await peakOver(600); Sound.sfxAt(n, 0.3); out.pos[n + ' far'] = await peakOver(600); await sleep(100); }
        for (const [n, sc] of [['wind', { biome: null, night: false, wind: 0.05, rain: 0, pitch: 450 }], ['wind strong', { biome: null, night: false, wind: 0.12, rain: 0, pitch: 450 }], ['rain', { biome: null, night: false, wind: 0.03, rain: 0.09, pitch: 450 }]]) { Sound.setScene(sc); await sleep(2500); out.beds[n] = await peakOver(800); }
        Sound.setScene(null); await sleep(800);
        for (const th of ['village', 'forest', 'camp', 'title']) { Sound.setVolume(0.8, 0.5, 0.6); Sound.music(th); await sleep(2500); out.beds['music ' + th] = await peakOver(1500); Sound.music(null); await sleep(600); }
        return out;
      })()`);
      console.log('SELFTEST ' + JSON.stringify(result)); app.exit(0); return;
    }
    if (process.env.STICKRPG_TESTPHASE === 'restore') {          // second launch: browser storage was wiped, the save must come back from the file
      result.restore = await run(`(() => { const has = !!localStorage.getItem('stickrpg_slot1'); advanceIntro(); advanceIntro(); const loaded = loadSlot(1);
        const r = { has, loaded, name: hero && hero.name, wave, gold: hero && hero.gold, potions: hero && hero.potions }; eraseSlot(1); return r; })()`);
      await wait(300);
      result.fileGoneAfterDelete = !fs.existsSync(path.join(SAVE_DIR(), 'slot1.json'));
      result.ok = result.restore.has && result.restore.loaded && result.restore.name === 'Selftest' && result.fileGoneAfterDelete;
      console.log('SELFTEST ' + JSON.stringify(result)); app.exit(result.ok ? 0 : 1); return;
    }
    result.boot = await run(`({ title: document.title, hasSound: typeof Sound, hasGame: typeof newRun, app: !!window.stickApp, state: state })`);
    result.play = await run(`(async () => {
      advanceIntro(); advanceIntro(); localStorage.clear(); newRun('Selftest', 'normal', 1);
      for (let i = 0; i < 120; i++) update(1 / 60);
      render(1);
      enemies = []; spawnQueue = []; wave = 9; waveTimer = 0.05;
      for (let i = 0; i < 20 && state !== 'village'; i++) update(0.05);
      const inVillage = state === 'village';
      for (let i = 0; i < 200; i++) updateVillage(0.05);
      render(1);
      return { inVillage, name: vil && vil.name, wave, saved: !!localStorage.getItem('stickrpg_slot1') };
    })()`);
    await wait(300);
    result.diskSave = fs.existsSync(path.join(SAVE_DIR(), 'slot1.json'));
    result.fps = await run(`new Promise(res => {           // real frames drawn by the real loop in the shown window, Ultra quality
      settings.quality = 'ultra'; applySettings();
      let n = 0; const orig = window.render; window.render = a => { n++; return orig(a); };
      setTimeout(() => { window.render = orig; res({ frames: n, perSecond: Math.round(n / 2.5), state, hz: Math.round(1000 / refreshMs) }); }, 2500);
    })`);
    result.webgl = await run(`(() => { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); })()`);
    result.ok = result.boot.hasGame === 'function' && result.boot.hasSound === 'object' && result.boot.app === true &&
      result.play.inVillage && result.play.saved && result.diskSave;
  } catch (err) { result.error = String(err && err.message || err); }
  console.log('SELFTEST ' + JSON.stringify(result));
  if (!result.ok) return app.exit(1);
  // last check: the "Quit to Desktop" button on the title menu must really close the app (a normal exit is code 0)
  try {
    const shown = await run(`(() => { goTitle(); const b = document.querySelector('#title [data-act=quitApp]'); const vis = !!b && getComputedStyle(b).display !== 'none'; if (vis) b.click(); return vis; })()`);
    console.log('SELFTEST quit button visible: ' + shown);
    if (!shown) return app.exit(3);
  } catch (err) { console.log('SELFTEST quit check failed: ' + err.message); return app.exit(3); }
  setTimeout(() => { console.log('SELFTEST the quit button did not close the app'); app.exit(3); }, 5000);
}

// ---- app lifecycle ----
if (!SELFTEST && !app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (mainWin) { if (mainWin.isMinimized()) mainWin.restore(); mainWin.focus(); } });
  app.whenReady().then(() => {
    if (process.platform === 'darwin') {
      Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'windowMenu' }, { label: 'View', submenu: [{ role: 'togglefullscreen' }] }]));
    } else Menu.setApplicationMenu(null);
    const win = createWindow();
    if (SELFTEST) { win.webContents.setAudioMuted(true); win.webContents.once('did-finish-load', () => selfTest(win)); }   // tests are silent: the level meter reads the audio graph, not the speakers
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
