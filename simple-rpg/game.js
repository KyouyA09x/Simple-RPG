// Stick RPG: stickman hero in a scrolling world of biomes. Monster waves, a boss every 10 waves,
// character and inventory menu (M), drops, save slots, difficulty, quality presets up to Ultra (WebGL post-FX),
// resolution options and an FPS cap.
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const wrap = document.getElementById('wrap');
const VW = 960, VH = 540;        // logical view size (16:9); rendered at any resolution
const WW = 2400, WH = 1600;      // world size

const FLIP_TIME = 0.4, FLIP_SPEED = 420, FLIP_COOLDOWN = 0.7;
const FLIP_COST = 32, REGEN_DELAY = 0.5;
// Natural regeneration: 4 seconds after the last hit you recover 2% of max HP a second (4% while running), but only up to 70% of max HP:
// the rest takes a potion, the inn or a level-up. Standing still is slower than running, which keeps you moving. Running also refills stamina faster.
const HP_REGEN_DELAY = 4, HP_REGEN_RATE = 0.02, HP_REGEN_MOVE = 2, HP_REGEN_CAP = 0.7, STAMINA_REGEN_MOVE = 1.6;
const regenCap = () => Math.min(1, HP_REGEN_CAP + (typeof gearHas === 'function' && gearHas('vigor') ? 0.15 : 0));
const POINTS_PER_LEVEL = 3;
const GOLD_BASE = 3, GOLD_PER_WAVE = 1.5, GOLD_BOSS_BASE = 60, GOLD_BOSS_PER_WAVE = 12;
const SAVE_KEY = i => `stickrpg_slot${i}`, SLOTS = [1, 2, 3];

// --- Weapon types: every weapon item is one of these; `lvl` is the hero level needed to wield it ---
// `kind` picks the animation, the drawing and the sounds (see WEAPON_KINDS); it defaults to 'sword'. Keep the list sorted by lvl: better weapons are likelier drops.
const SWORDS = [
  { id: 'wood', cost: 8,   name: 'Wooden Sword', lvl: 1,  dmg: 20, range: 52, time: 0.30, len: 24, color: '#b8864b' },
  { id: 'iron', cost: 9,   name: 'Iron Sword',   lvl: 3,  dmg: 28, range: 56, time: 0.30, len: 26, color: '#ccc' },
  { id: 'bow', kind: 'bow', ranged: 'arrow', cost: 8, name: 'Hunting Bow', lvl: 4, dmg: 22, range: 430, time: 0.46, len: 26, color: '#b8864b', shot: 560 },
  { id: 'spear', kind: 'spear', cost: 9, name: 'Spear',   lvl: 4,  dmg: 26, range: 70, time: 0.34, len: 46, color: '#cde' },
  { id: 'dagger', kind: 'dagger', cost: 5, name: 'Twin Dagger',  lvl: 5,  dmg: 22, range: 46, time: 0.18, len: 18, color: '#9ef' },
  { id: 'rapier', kind: 'rapier', cost: 7, name: 'Rapier', lvl: 6,  dmg: 24, range: 58, time: 0.20, len: 36, color: '#dde' },
  { id: 'staff', kind: 'staff', ranged: 'bolt', cost: 9, name: 'Apprentice Staff', lvl: 6, dmg: 26, range: 380, time: 0.5, len: 46, color: '#7fd0ff', shot: 430 },
  { id: 'great', kind: 'great', cost: 16,  name: 'Greatsword',   lvl: 7,  dmg: 50, range: 72, time: 0.48, len: 38, color: '#888' },
  { id: 'katana', kind: 'katana', cost: 8, name: 'Katana', lvl: 8, dmg: 34, range: 58, time: 0.24, len: 34, color: '#e8eef5', critBonus: 0.15 },
  { id: 'axe', kind: 'axe', cost: 13, name: 'Battle Axe', lvl: 9,  dmg: 46, range: 60, time: 0.42, len: 28, color: '#9aa', hitAt: 0.6 },
  { id: 'horned', sig: 'minotaur', kind: 'axe', cost: 13, name: 'Horned Cleaver', lvl: 8, dmg: 56, range: 62, time: 0.40, len: 30, color: '#d9a066', hitAt: 0.6, note: 'Every third blow shakes the ground' },
  { id: 'flame', cost: 10,  name: 'Flame Blade',  lvl: 10, dmg: 38, range: 60, time: 0.28, len: 28, color: '#f73', burn: true },
  { id: 'longbow', kind: 'bow', ranged: 'arrow', cost: 9, name: 'Longbow', lvl: 10, dmg: 38, range: 520, time: 0.5, len: 30, color: '#8a6a3c', shot: 660, pierce: 1 },
  { id: 'pilferer', sig: 'goblinKing', kind: 'dagger', cost: 5, name: "Pilferer's Daggers", lvl: 10, dmg: 32, range: 48, time: 0.17, len: 19, color: '#9be36f', critBonus: 0.12, note: 'Blows spill coins' },
  { id: 'whip', kind: 'whip', cost: 7, name: 'Whip',    lvl: 11, dmg: 24, range: 90, time: 0.30, len: 70, color: '#a76', pull: true, hitAt: 0.34 },
  { id: 'ooze', sig: 'slimeQueen', kind: 'whip', cost: 7, name: "Queen's Ooze Whip", lvl: 12, dmg: 34, range: 92, time: 0.30, len: 72, color: '#7fe07f', pull: true, slow: true, hitAt: 0.34, note: 'Sticky: splashes onto its neighbours' },
  { id: 'hammer', kind: 'hammer', cost: 18, name: 'War Hammer', lvl: 12, dmg: 62, range: 58, time: 0.62, len: 30, color: '#889', stun: 0.9, hitAt: 0.76 },
  { id: 'arcane', kind: 'staff', ranged: 'bolt', cost: 10, name: 'Arcane Staff', lvl: 12, dmg: 44, range: 440, time: 0.5, len: 48, color: '#c36bff', shot: 470, critBonus: 0.08 },
  { id: 'frost', cost: 10,  name: 'Frostbrand',   lvl: 13, dmg: 42, range: 62, time: 0.28, len: 30, color: '#6cf', slow: true },
  { id: 'lichbow', sig: 'lich', kind: 'bow', ranged: 'arrow', cost: 9, name: 'Lich Bow', lvl: 14, dmg: 50, range: 600, time: 0.45, len: 30, color: '#a6f0b0', shot: 700, pierce: 3, critBonus: 0.15, note: 'Arrows pass through four creatures and wither them' },
  { id: 'glacier', sig: 'frostTitan', kind: 'hammer', cost: 18, name: 'Glacier Maul', lvl: 15, dmg: 82, range: 60, time: 0.62, len: 32, color: '#bfeaff', slow: true, hitAt: 0.76, note: 'One blow in four freezes the creature' },
  { id: 'scythe', kind: 'scythe', cost: 14, name: 'Scythe', lvl: 14, dmg: 48, range: 68, time: 0.44, len: 40, color: '#bcd', back: true, hitAt: 0.42 },
  { id: 'magmaG', sig: 'magma', kind: 'great', cost: 16, name: 'Magma Greatsword', lvl: 16, dmg: 80, range: 74, time: 0.46, len: 40, color: '#ff7a2a', burn: true, note: 'Sometimes bursts into flame' },
  { id: 'halberd', kind: 'halberd', cost: 16, name: 'Halberd', lvl: 15, dmg: 58, range: 84, time: 0.50, len: 48, color: '#abc', hitAt: 0.4 },
  { id: 'elven', kind: 'bow', ranged: 'arrow', cost: 10, name: 'Elven Bow', lvl: 15, dmg: 52, range: 560, time: 0.44, len: 30, color: '#7fe0a0', shot: 720, pierce: 2, critBonus: 0.1 },
  { id: 'fist', kind: 'fist', cost: 4, name: 'Iron Gauntlets', lvl: 16, dmg: 30, range: 44, time: 0.16, len: 0, color: '#bbc', lifesteal: 0.03, hitAt: 0.2 },
  { id: 'sandreaper', sig: 'pharaoh', kind: 'scythe', cost: 14, name: 'Sandreaper', lvl: 17, dmg: 68, range: 70, time: 0.42, len: 42, color: '#ffe08a', back: true, lifesteal: 0.05, hitAt: 0.42, note: 'Drinks life, leaves a cloud of sand' },
  { id: 'holy', cost: 11,   name: 'Excalibur',    lvl: 17, dmg: 65, range: 70, time: 0.26, len: 34, color: '#fe6', burn: true, slow: true },
  { id: 'archmage', kind: 'staff', ranged: 'bolt', cost: 11, name: 'Archmage Staff', lvl: 18, dmg: 70, range: 480, time: 0.48, len: 52, color: '#ffd24a', shot: 520, burn: true },
  { id: 'tempest', sig: 'stormWarden', kind: 'staff', ranged: 'bolt', cost: 10, name: 'Tempest Staff', lvl: 18, dmg: 74, range: 500, time: 0.46, len: 54, color: '#fff3a0', shot: 560, critBonus: 0.1, note: 'Lightning jumps to two more creatures' },
];

// Level stats are a small personal edge: gear is where the build comes from (see GEAR_CAPS in gear.js). Their caps grow a little with every rebirth.
const STATS = [
  { k: 'hp',      color: '#e2565a', name: 'Vitality',    short: 'VIT', desc: '+10 max HP, +0.15% damage reduction', capNote: 'more points allowed with every rebirth', maxFn: () => vitMax() },
  { k: 'str',     color: '#ff9a4a', name: 'Strength',    short: 'STR', desc: '+2 sword damage', capNote: 'more points allowed with every rebirth', maxFn: () => strMax() },
  { k: 'sta',     color: '#5fd07a', name: 'Stamina',     short: 'STA', desc: '+10 max stamina, +regen, +0.15% move speed', capNote: 'more points allowed with every rebirth (speed caps at +6%)', maxFn: () => staMax() },
  { k: 'cd',      color: '#6fb5ff', name: 'Cooldown',    short: 'CD',  desc: '-6% flip cooldown, -4% swing time', max: 10 },
  { k: 'crit',    color: '#ffd24a', name: 'Critical',    short: 'CRT', desc: '+0.5% crit chance, +0.02× crit damage', capNote: 'at most 15% and 1.7× from levels', max: 10 },
];
const statMax = s => s.maxFn ? s.maxFn() : s.max;
const VIT_HP = 10;
const BASE_SPEED = 180, BASE_CRIT = 0.10, BASE_CRIT_MULT = 1.5;
const newStats = () => ({ hp: 0, str: 0, sta: 0, cd: 0, crit: 0 });

const DIFFS = {
  easy:      { name: 'Easy',      hp: 0.7, dmg: 0.6, spd: 0.9,  xp: 1.25, drop: 1.5, desc: 'Weaker monsters and more drops. A relaxed adventure.' },
  normal:    { name: 'Normal',    hp: 1,   dmg: 1,   spd: 1,    xp: 1,    drop: 1,   desc: 'The intended experience.' },
  hard:      { name: 'Hard',      hp: 1.4, dmg: 1.4, spd: 1.08, xp: 1.1,  drop: 0.8, desc: 'Tougher, hungrier monsters and fewer drops.' },
  nightmare: { name: 'Nightmare', hp: 2,   dmg: 1.8, spd: 1.18, xp: 1.25, drop: 0.6, desc: 'Brutal. Monsters hit almost twice as hard and move faster.' },
};

// --- Biomes: the map changes every 10 waves (after each boss) ---
const WAVES_PER_SET = 10;                                  // one boss and one biome per set of waves
const zoneFor = w => Math.floor(Math.max(0, w - 1) / WAVES_PER_SET);
const tierOf = zoneFor;                                    // bosses defeated so far = how far monsters have grown
const setPos = w => w <= 0 ? 0 : ((w - 1) % WAVES_PER_SET) + 1;   // 1..10 within the current set; 10 is the boss

// --- Enemy scaling: every boss defeated is a tier; monsters also grow a little with the hero's level ---
const ARCHER_MAX_SPEED = 105, ARCHER_BACKOFF = 80;           // archers (skeletons) walk this fast at most, and back away slower still
const TIER_HP = 0.16, TIER_DMG = 0.14, TIER_SPD = 0.02, TIER_SPD_CAP = 0.10;
const LEVEL_HP = 0.025, LEVEL_DMG = 0.02, LEVEL_CAP = 0.6;
function threat() {
  const t = tierOf(wave), lv = Math.max(0, (hero ? hero.level : 1) - 1);
  return {
    hp: (1 + TIER_HP * t) * (1 + Math.min(LEVEL_CAP, LEVEL_HP * lv)),
    dmg: (1 + TIER_DMG * t) * (1 + Math.min(LEVEL_CAP, LEVEL_DMG * lv)),
    spd: 1 + Math.min(TIER_SPD_CAP, TIER_SPD * t),
  };
}
// after a boss the next area is random (never the same one twice in a row)
function randomBiome() {
  let z = Math.floor(Math.random() * BIOMES.length);
  if (z === zone) z = (z + 1 + Math.floor(Math.random() * (BIOMES.length - 1))) % BIOMES.length;
  return z;
}

// --- Settings ---
const QUALITY = {
  low:    { rs: 0.5, shadows: false, trail: false, particles: false, grass: 0,    decor: false, glow: false, anim: false, ambient: false, shake: false, post: false },
  medium: { rs: 1,   shadows: true,  trail: true,  particles: true,  grass: 0,    decor: false, glow: false, anim: false, ambient: false, shake: true,  post: false },
  high:   { rs: 1,   shadows: true,  trail: true,  particles: true,  grass: 1500, decor: true,  glow: true,  anim: false, ambient: false, shake: true,  post: false },
  ultra:  { rs: 1,   shadows: true,  trail: true,  particles: true,  grass: 3200, decor: true,  glow: true,  anim: true,  ambient: true,  shake: true,  post: true },
};
// --- Key and mouse bindings: each action can have as many keys and mouse buttons as you like (Settings > Edit keybinds).
// Inputs are keyboard codes ('KeyW', 'Space', 'ArrowUp'...) or 'Mouse0' left, 'Mouse1' middle, 'Mouse2' right, 'Mouse3' / 'Mouse4' the two side buttons.
// Esc (pause / back), the console key (`) and the number keys in dialogues and shops are fixed.
const BIND_ACTIONS = [
  { id: 'up',           label: 'Move up',            def: ['KeyW', 'ArrowUp'] },
  { id: 'down',         label: 'Move down',          def: ['KeyS', 'ArrowDown'] },
  { id: 'left',         label: 'Move left',          def: ['KeyA', 'ArrowLeft'] },
  { id: 'right',        label: 'Move right',         def: ['KeyD', 'ArrowRight'] },
  { id: 'attack',       label: 'Attack',             def: ['Space', 'Mouse0'] },
  { id: 'flip',         label: 'Flip (dodge)',       def: ['ShiftLeft', 'ShiftRight'] },
  { id: 'potion',       label: 'Use the equipped utility',       def: ['KeyQ'] },
  { id: 'utility',      label: 'Utility wheel (hold, release on an icon)', def: ['KeyR'] },
  { id: 'swapWeapon',   label: 'Swap to spare weapon', def: ['KeyX'] },
  { id: 'interact',     label: 'Talk / interact',    def: ['KeyE'] },
  { id: 'character',    label: 'Character window',   def: ['KeyM'] },
  { id: 'inventory',    label: 'Wheel menu (hold, release on an icon)',   def: ['Tab'] },
  { id: 'pause',        label: 'Pause menu',         def: ['KeyP'], note: '(Esc always works)' },
  { id: 'fullscreen',   label: 'Fullscreen',         def: ['KeyF'] },
  { id: 'respawn',      label: 'Start again after dying', def: ['KeyR'] },
];
const defaultBinds = () => Object.fromEntries(BIND_ACTIONS.map(a => [a.id, a.def.slice()]));
// repair whatever was saved: unknown actions go, missing ones get their defaults, and an input belongs to one action only (apart from respawn, which shares R with switching potions)
function sanitizeBinds(b) {
  const out = defaultBinds(), seen = new Set();
  if (b && typeof b === 'object') for (const a of BIND_ACTIONS) if (Array.isArray(b[a.id])) out[a.id] = b[a.id].filter(c => typeof c === 'string' && /^[A-Za-z0-9]{2,20}$/.test(c) && c !== 'Escape' && c !== 'Backquote');
  for (const a of BIND_ACTIONS) { if (a.id === 'respawn') continue; out[a.id] = out[a.id].filter(c => !seen.has(c) && seen.add(c)); }
  return out;
}
let bindCap = null, bindAssignedAt = 0;        // the action being (re)bound in the controls window, and when the last one was set
const settings = { quality: 'high', res: 'auto', renderScale: '100', sharpness: 60, fps: 0, showFps: false, musicVol: 50, sfxVol: 80, ambVol: 60, comfort: false, consoleEnabled: false, binds: null };
try { Object.assign(settings, JSON.parse(localStorage.getItem('rpgSettings')) || {}); } catch {}
if (!QUALITY[settings.quality]) settings.quality = 'high';
if (!['100', '85', '75', '67', '50'].includes(String(settings.renderScale))) settings.renderScale = '100';
settings.renderScale = String(settings.renderScale);
settings.sharpness = Math.max(0, Math.min(100, Number(settings.sharpness) || 0));
settings.binds = sanitizeBinds(settings.binds); settings.consoleEnabled = settings.consoleEnabled === true;
delete settings.frameGen;                          // frame generation was removed: the simulation costs about 5% of a frame, so it saved nothing
let gfx, postActive = false, fxActive = false;     // postActive: the WebGL pass shows the picture; fxActive: ...and also applies the Ultra effects
let outRes = { w: 1280, h: 720 };                  // size the picture is shown at; the game renders at outRes x render scale
const renderScale = () => (+settings.renderScale || 100) / 100;
const upscaling = () => settings.quality !== 'low' && renderScale() < 1;

function fit() {
  const helpH = document.fullscreenElement ? 0 : 20;
  const aw = innerWidth, ah = innerHeight - helpH;
  let w = aw, h = w * 9 / 16;
  if (h > ah) { h = ah; w = h * 16 / 9; }
  wrap.style.width = w + 'px'; wrap.style.height = h + 'px'; wrap.style.top = ah / 2 + 'px';
  let rw = settings.res === 'auto' ? w * (devicePixelRatio || 1) : +settings.res.split('x')[0];
  rw = Math.round(Math.min(3840, rw));
  outRes = { w: rw, h: Math.round(rw * 9 / 16) };
  rw = Math.max(480, Math.round(rw * gfx.rs * (settings.quality === 'low' ? 1 : renderScale())));
  const rh = Math.round(rw * 9 / 16);
  if (canvas.width !== rw || canvas.height !== rh) { canvas.width = rw; canvas.height = rh; }
}

function applySettings() {
  gfx = QUALITY[settings.quality];
  fit();
  canvas.classList.toggle('pixel', settings.quality === 'low');
  postActive = PostFX.setActive(gfx.post || upscaling(), canvas);
  fxActive = postActive && gfx.post;
  document.querySelectorAll('.opts[data-set]').forEach(g => g.querySelectorAll('button').forEach(b =>
    b.classList.toggle('on', b.dataset.v === String(settings[g.dataset.set]))));
  document.querySelectorAll('select[data-set], input[data-set]').forEach(el => { el.value = String(settings[el.dataset.set]); });
  Sound.setVolume(settings.sfxVol / 100, settings.musicVol / 100, settings.ambVol / 100);
  const gpu = PostFX.info();
  document.getElementById('gpuInfo').innerHTML = `<b>GPU in use:</b> ${escapeHtml(gpu)}` +
    ((gfx.post || upscaling()) && !postActive ? ' — WebGL unavailable: post-FX and sharpening are off' : '') +
    `<br><b>Render resolution:</b> ${canvas.width} × ${canvas.height}` +
    (upscaling() ? ` → shown at ${outRes.w} × ${outRes.h} (${postActive ? 'bicubic upscale + sharpening on the GPU' : 'stretched by the browser'})` : '') +
    `<br><b>Frame cap:</b> ${cappedFpsLabel()}`;
  if (world && world.grassKey !== `${gfx.grass}|${gfx.anim}`) { buildGrass(); buildGround(); }
  renderHelp();
  try { localStorage.setItem('rpgSettings', JSON.stringify(settings)); } catch {}
}

// settings are in four tabs: Graphics, Audio, Keybinds and Other
let settingsTab = 'graphics';
function showSettingsTab(t) {
  settingsTab = ['graphics', 'audio', 'keys', 'other'].includes(t) ? t : 'graphics';
  document.querySelectorAll('#settings [data-stab]').forEach(b => b.classList.toggle('on', b.dataset.stab === settingsTab));
  document.querySelectorAll('#settings .stab').forEach(p => p.classList.toggle('show', p.dataset.tab === settingsTab));
  if (settingsTab === 'keys') renderKeySummary();
}
function renderKeySummary() {                                                          // what each action is bound to, read-only; the editing happens in the Controls window
  const el = document.getElementById('keySummary'); if (!el) return;
  el.innerHTML = BIND_ACTIONS.map(a => `<div class="krow"><span>${escapeHtml(a.label)}</span><b>${(settings.binds[a.id] || []).map(c => `<kbd>${escapeHtml(inputName(c))}</kbd>`).join(' ') || '<em>unbound</em>'}</b></div>`).join('');
}
document.getElementById('setTabs').addEventListener('click', e => { const b = e.target.closest('[data-stab]'); if (b) { sfx('tab'); showSettingsTab(b.dataset.stab); } });
document.querySelectorAll('.opts[data-set]').forEach(g => g.addEventListener('click', e => {
  const v = e.target.dataset.v;
  if (v === undefined) return;
  const k = g.dataset.set;
  settings[k] = k === 'showFps' || k === 'comfort' || k === 'consoleEnabled' ? v === 'true' : v;
  applySettings(); sfx('click');
}));
document.querySelectorAll('select[data-set], input[data-set]').forEach(el => el.addEventListener('input', () => {
  const k = el.dataset.set;
  settings[k] = k === 'res' ? el.value : +el.value;
  applySettings();
  if (k === 'sfxVol') sfx('click');
}));
addEventListener('resize', () => fit());
document.addEventListener('fullscreenchange', () => { fit(); updateFsButton(); });
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  // Keyboard Lock keeps Esc for the game menu; holding Esc still exits fullscreen (browser rule)
  else document.documentElement.requestFullscreen?.().then(() => navigator.keyboard?.lock?.(['Escape'])).catch(() => {});
}
function updateFsButton() { document.getElementById('btnFs').textContent = document.fullscreenElement ? 'Windowed (F)' : 'Fullscreen (F)'; }

const sfx = name => Sound.sfx(name);
// what the chosen cap actually becomes on this monitor (a cap must divide the refresh rate)
function cappedFpsLabel() {
  const hz = Math.round(1000 / refreshMs);
  if (!settings.fps) return `unlimited — ${hz} FPS (every refresh of your ${hz} Hz screen)`;

  return settings.fps >= hz
    ? `${settings.fps} requested — limited to ${hz} FPS by your screen`
    : `${settings.fps} FPS (exact). Your screen runs at ${hz} Hz; when the cap isn't a whole division of it, ` +
      `frames are held for uneven numbers of refreshes, which can look slightly less smooth than ${Math.round(hz / Math.ceil(hz / settings.fps))} FPS.`;
}
// '#e33' / '#ee3333' + alpha -> rgba() (appending hex digits to a 3-digit color is invalid and throws)
function withAlpha(hex, a) {
  let h = hex.slice(1);
  if (h.length === 3) h = h.replace(/./g, c => c + c);
  const n = parseInt(h, 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}
// An in-game question box (never the system's dialog): a themed window over everything, with Yes and No buttons. Enter / Y says yes, Esc / N says no.
// askConfirm(title, text, onYes, { yes: 'Label', no: 'Label' | null (no second button), danger: false })
let confirmOpen = false, confirmYes = null;
let quitToDesktop = () => { if (window.stickApp) window.stickApp.quit(); else window.close(); };
function askConfirm(title, text, onYes, o = {}) {
  const el = document.getElementById('confirmDlg'); if (!el) { if (onYes) onYes(); return; }
  confirmYes = onYes || null; confirmOpen = true;
  el.innerHTML = `<div class="panel confirm-panel"><h2>${escapeHtml(title)}</h2><div class="confirm-text">${escapeHtml(text)}</div>
    <div class="confirm-btns"><button data-confirm="yes" class="${o.danger === false ? '' : 'danger'}">${escapeHtml(o.yes || 'Yes')}</button>${o.no === null ? '' : `<button data-confirm="no">${escapeHtml(o.no || 'Cancel')}</button>`}</div>
    <div class="confirm-hint">${o.no === null ? 'Enter to continue' : 'Enter to confirm · Esc to cancel'}</div></div>`;
  el.classList.add('show'); sfx('ask');
  const first = el.querySelector('[data-confirm="no"]') || el.querySelector('[data-confirm="yes"]'); if (first) first.focus();          // Cancel is the one focused, so a stray key press cannot confirm
}
function closeConfirm(yes) {
  if (!confirmOpen) return;
  const cb = confirmYes; confirmOpen = false; confirmYes = null;
  const el = document.getElementById('confirmDlg'); el.classList.remove('show'); el.innerHTML = '';
  sfx(yes ? 'click' : 'tick'); if (yes && cb) cb();
}
document.getElementById('confirmDlg').addEventListener('click', e => { const b = e.target.closest('[data-confirm]'); if (b) closeConfirm(b.dataset.confirm === 'yes'); else if (e.target.id === 'confirmDlg') closeConfirm(false); });

const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// --- Game state ---
let state = 'splash';            // splash | intro | title | play
let introT = 0, introFlags = {}, tAnim = 0;
let hero, enemies, corpses, wave, waveTimer, spawnQueue, spawnTimer, popups, drops, projectiles, shockwaves, particles, boss;
let cam = { x: 0, y: 0, shake: 0 }, hitStop = 0, flash = 0;
let diffKey = 'normal', currentSlot = 1, lastSavedWave = -1, savedGold = 0, playTime = 0, zone = 0, lastZoneStep = 0;
let world = null;                // current biome data: props, grass, decor, lava, ground cache
const D = () => DIFFS[diffKey];

function reset() {
  hero = {
    name: 'Hero', level: 1, hp: 100, maxHp: 100, xp: 0, xpNext: xpNeed(1), rebirth: 0, rbHp: 0,
    stamina: 100, points: 0, stats: newStats(), sword: SWORDS[0], regenT: 0,
    x: WW / 2, y: WH / 2, speed: 180, facing: 1, walkT: 0, moving: false, stepT: 0,
    attackT: 0, attackDur: 0.3, hitSet: null,
    flipT: 0, flipCd: 0, flipDx: 1, flipDy: 0,
    hurtT: 0, dead: false, deadT: 0, auraT: 0, hpRegenT: 0, gold: 0, lostGold: 0, goldPulse: 0,
    potions: 2, bond: {}, gifts: {}, ail: {}, quests: emptyQuests(), recalls: 0, recallT: 0, util: 'potion', potionSel: 'heal', lamp: 0, lightBonus: 0, potionCd: 0,
    scarf: Array.from({ length: 7 }, () => ({ x: WW / 2, y: WH / 2 - 50 })),
  };
  applyRebirthPerks(); initGear();
  enemies = []; corpses = []; popups = []; drops = []; projectiles = []; heroShots = []; shockwaves = []; particles = [];
  boss = null; vil = null; villageSkip = -1; clearHazards(); dun = null; dunDoor = null; dunRolled = false; dunNear = null;
  wave = 0; waveTimer = 2; spawnQueue = []; spawnTimer = 0; lastZoneStep = 0;
  playTime = 0; lastSavedWave = -1; savedGold = 0; hitStop = 0; flash = 0;
  cam.x = hero.x - VW / 2; cam.y = hero.y - VH / 2; cam.shake = 0;
}

// --- Saves (localStorage slots + .json export/import) ---
function readSlot(i) { try { return JSON.parse(localStorage.getItem(SAVE_KEY(i))); } catch { return null; } }
// In the desktop app (preload.js exposes window.stickApp) every save is also mirrored to a file in the app's data
// folder, so a wiped browser profile can't take the saves with it. In a normal browser these are plain localStorage.
function writeSlot(i, json) { localStorage.setItem(SAVE_KEY(i), json); try { window.stickApp && window.stickApp.writeSave(i, json); } catch {} }
function eraseSlot(i) { localStorage.removeItem(SAVE_KEY(i)); try { window.stickApp && window.stickApp.deleteSave(i); } catch {} }
function restoreSavesFromDisk() {
  if (!window.stickApp) return;
  for (const i of SLOTS) {
    try {
      if (localStorage.getItem(SAVE_KEY(i))) continue;
      const json = window.stickApp.readSave(i);
      if (json && validSave(JSON.parse(json))) localStorage.setItem(SAVE_KEY(i), json);
    } catch {}
  }
}
function wavesCleared() { return spawnQueue.length === 0 && enemies.length === 0 ? wave : wave - 1; }
function saveGame(auto = false, quiet = false) {
  const data = {
    v: 3, rebirth: rebirths(), rbHp: hero.rbHp | 0, name: hero.name, diff: diffKey, level: hero.level, xp: hero.xp, xpNext: hero.xpNext,
    points: hero.points, stats: { ...hero.stats }, maxHp: hero.maxHp, sword: hero.sword.id,
    wave: Math.max(0, wavesCleared()), playTime: Math.round(playTime), savedAt: Date.now(),
    biome: zone, tod, dayCount, weather: weather.kind, gold: hero.gold, potions: hero.potions | 0, lamp: hero.lamp | 0, bond: { ...hero.bond }, gifts: { ...hero.gifts }, quests: hero.quests, recalls: hero.recalls | 0, ...serializeGear(),
  };
  try {
    writeSlot(currentSlot, JSON.stringify(data));
    lastSavedWave = data.wave; savedGold = hero.gold;
    if (!quiet) popups.push({ text: hero.gold > 0 ? `Progress saved · ${hero.gold.toLocaleString()} gold banked` : 'Progress saved', x: VW - 135, y: 78, t: 2.4, color: '#9f9', screen: true, small: true });
    if (!auto) sfx('save');
  } catch { popups.push({ text: 'Save failed (storage full?)', x: VW / 2, y: 60, t: 2, color: '#f66', screen: true }); }
}
function validSave(d) {
  return d && typeof d === 'object' && typeof d.name === 'string' && DIFFS[d.diff] && Number.isFinite(d.level) && d.level >= 1 &&
    Number.isFinite(d.wave) && d.wave >= 0 && d.stats && Number.isFinite(d.stats.str) &&
    SWORDS.some(s => s.id === d.sword) && Number.isFinite(d.maxHp);
}
function loadSlot(i) {
  const d = readSlot(i);
  if (!validSave(d)) return false;
  reset();
  Object.assign(hero, {
    name: d.name.slice(0, 14), level: d.level, xp: d.xp | 0, xpNext: xpNeed(Math.max(1, d.level | 0)), points: d.points | 0,
    stats: (() => { const st = { ...newStats(), ...d.stats }; st.crit = (st.crit | 0) + (st.critDmg | 0); delete st.critDmg; return st; })(), maxHp: d.maxHp, hp: d.maxHp, sword: SWORDS.find(s => s.id === d.sword),
    rebirth: Math.max(0, Math.min(500, d.rebirth | 0)), rbHp: Math.max(0, Math.min(100000, d.rbHp | 0)),
  });
  applyRebirthPerks();
  { const was = d.v >= 3 ? VIT_HP : d.v >= 2 ? 12 : 20; if (was !== VIT_HP) hero.maxHp = Math.max(1, hero.maxHp - (was - VIT_HP) * (hero.stats.hp | 0)); }       // saves from before a rebalance: Vitality gave 20 HP a point, then 12, now 10
  hero.hp = hero.maxHp;
  for (const s of STATS) { const mx = statMax(s); if (mx && hero.stats[s.k] > mx) { hero.points += hero.stats[s.k] - mx; hero.stats[s.k] = mx; } }   // points over a (lowered) cap are given back
  hero.stamina = maxStamina();
  diffKey = d.diff; currentSlot = i; wave = d.wave; lastSavedWave = d.wave; playTime = d.playTime || 0;
  hero.gold = d.gold | 0; savedGold = hero.gold;
  hero.potions = Math.max(0, Math.min(POTION_MAX, d.potions | 0)); hero.potionSel = 'heal'; hero.ail = {};
  { const clean = (o, max) => { const r = {}; if (o && typeof o === 'object') for (const k of Object.keys(o).slice(0, 40)) { const n = Math.floor(Number(o[k])); if (n > 0) r[String(k).slice(0, 12)] = Math.min(max, n); } return r; }; hero.bond = clean(d.bond, 8); hero.gifts = clean(d.gifts, 1); hero.quests = cleanQuests(d.quests); hero.recalls = Math.max(0, Math.min(RECALL_MAX, d.recalls | 0)); hero.recallT = 0; } hero.lamp = Math.max(0, Math.min(LAMPS.length - 1, d.lamp | 0)); applyLamp();
  loadGear(d);
  lastZoneStep = zoneFor(d.wave + 1);
  if (Number.isFinite(d.tod)) tod = d.tod;
  if (Number.isFinite(d.dayCount)) dayCount = d.dayCount;
  loadBiome = Number.isFinite(d.biome) ? d.biome : 0;
  loadWeather = WEATHER[d.weather] ? d.weather : null;
  startPlay();
  return true;
}
function newRun(name, diff, slot) {
  reset();
  tod = 0.36; dayCount = 1; loadBiome = 0;
  hero.name = name.trim().slice(0, 14) || 'Hero';
  diffKey = diff; currentSlot = slot;
  startPlay();
  saveGame(true);
}
let loadBiome = null, loadWeather = null;
function startPlay() {
  state = 'play';
  setBiome(loadBiome ?? 0, false);
  if (loadWeather) setWeather(loadWeather, true);
  loadBiome = null; loadWeather = null;
  showMenu(null);
  Sound.music(BIOMES[zone % BIOMES.length].music);
}
const fmtTime = s => `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, '0')}m`;
function slotHtml(i, d) {
  return d ? `<div><b>Slot ${i}: ${escapeHtml(d.name)}</b> — ${DIFFS[d.diff]?.name ?? '?'}
    <small>${d.rebirth > 0 ? `Rebirth ${d.rebirth | 0} · ` : ''}Lv ${d.level} · ${d.wave} waves cleared · ${(d.gold | 0).toLocaleString()} gold · ${fmtTime(d.playTime || 0)} played · ${new Date(d.savedAt).toLocaleString()}</small></div>`
    : `<div><b>Slot ${i}</b><small>Empty</small></div>`;
}
function renderLoad() {
  document.getElementById('slots').innerHTML = SLOTS.map(i => {
    const d = readSlot(i), v = validSave(d);
    return `<div class="slot">${slotHtml(i, v ? d : null)}<div class="btns">
      <button data-slot="load" data-i="${i}" ${v ? '' : 'disabled'}>Load</button>
      <button data-slot="export" data-i="${i}" ${v ? '' : 'disabled'}>Export</button>
      <button data-slot="import" data-i="${i}">Import</button>
      <button data-slot="delete" data-i="${i}" ${d ? '' : 'disabled'}>Delete</button></div></div>`;
  }).join('');
}
let importTarget = 1;
document.getElementById('slots').addEventListener('click', e => {
  const act = e.target.dataset.slot, i = +e.target.dataset.i;
  if (!act) return;
  sfx('click');
  if (act === 'load') loadSlot(i);
  if (act === 'delete') askConfirm('DELETE SAVE?', `Delete the save in slot ${i}? This can't be undone.`, () => { eraseSlot(i); renderLoad(); }, { yes: 'Delete', no: 'Keep it' });
  if (act === 'export') {
    const d = readSlot(i);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }));
    a.download = `stickrpg-${d.name.replace(/[^\w-]+/g, '_')}-slot${i}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  if (act === 'import') { importTarget = i; document.getElementById('importFile').click(); }
});
document.getElementById('importFile').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  let d = null;
  try { d = JSON.parse(await f.text()); } catch {}
  if (!validSave(d)) { askConfirm('NOT A SAVE', 'That file is not a valid Stick RPG save.', null, { yes: 'OK', no: null, danger: false }); return; }
  const slot = importTarget, doImport = () => { writeSlot(slot, JSON.stringify(d)); sfx('save'); renderLoad(); };
  if (readSlot(slot)) askConfirm('OVERWRITE SAVE?', `Slot ${slot} already has a save. Replace it with the imported one?`, doImport, { yes: 'Overwrite', no: 'Keep it' }); else doImport();
});

// New game panel
let ngDiff = 'normal', ngSlot = 1;
function renderNewGame() {
  document.getElementById('ngDiff').innerHTML = Object.entries(DIFFS).map(([k, d]) =>
    `<button data-diff="${k}" class="${k === ngDiff ? 'on' : ''}">${d.name}</button>`).join('');
  document.getElementById('ngDiffDesc').textContent = DIFFS[ngDiff].desc;
  document.getElementById('ngSlots').innerHTML = SLOTS.map(i => {
    const d = readSlot(i);
    return `<div class="slot ${i === ngSlot ? 'on' : ''}" data-ngslot="${i}" style="cursor:pointer">${slotHtml(i, validSave(d) ? d : null)}
      <small>${d ? 'Will be overwritten' : ''}</small></div>`;
  }).join('');
}
document.getElementById('newgame').addEventListener('click', e => {
  const df = e.target.closest('[data-diff]'), sl = e.target.closest('[data-ngslot]');
  if (df) { ngDiff = df.dataset.diff; sfx('click'); renderNewGame(); }
  if (sl) { ngSlot = +sl.dataset.ngslot; sfx('click'); renderNewGame(); }
});
function latestSlot() {
  let best = null;
  for (const i of SLOTS) { const d = readSlot(i); if (validSave(d) && (!best || d.savedAt > best.d.savedAt)) best = { i, d }; }
  return best;
}

// --- Menus ---
const OVERLAYS = ['title', 'changelog', 'single', 'newgame', 'load', 'menu', 'settings', 'level', 'dev', 'console', 'controls', 'talk', 'shop', 'inv'];
let paused = false, openMenu = null, settingsReturn = 'title';
function showMenu(which) {
  const wasMenu = openMenu;
  openMenu = which;
  paused = (state === 'play' || state === 'village') && which !== null;
  for (const id of OVERLAYS) document.getElementById(id).classList.toggle('show', id === which);
  for (const k in keys) keys[k] = false;
  if (which === 'level') renderLevelMenu();
  if ((state === 'play' || state === 'village') && which !== 'talk' && which !== 'shop' && wasMenu !== 'talk' && wasMenu !== 'shop') { if (which && !wasMenu) sfx('menuOpen'); else if (!which && wasMenu) sfx('menuClose'); }
  if (which === 'shop') renderShop();
  if (state === 'village') { if (which === 'shop') Sound.music('shop'); else if (wasMenu === 'shop') Sound.music('village'); }
  if (which === 'inv') renderInventory();
  if (which === 'dev') renderDev();
  if (which !== 'controls') bindCap = null;
  if (which === 'settings') showSettingsTab(settingsTab);
  if (which === 'controls') { renderControls(); bindMsg('Click a key to change it, × to remove it, or + Add to give an action more keys. Mouse buttons work too, side buttons included.'); }
  if (which === 'console') { renderConsole(); document.getElementById('conIn').value = ''; conHistPos = conHistory.length; }
  if (which === 'menu') renderMenuInfo();
  if (which === 'load') renderLoad();
  if (which === 'changelog') document.getElementById('clBody').innerHTML = CHANGELOG.map(c => `<h3>Version ${c.v}</h3><ul>${c.notes.map(n => `<li>${escapeHtml(n)}</li>`).join('')}</ul>`).join('');
  { const vt = document.getElementById('verTag'); vt.textContent = 'Version ' + GAME_VERSION; vt.classList.toggle('show', state === 'title' && ['title', 'single', 'changelog', 'newgame', 'load'].includes(which)); }
  if (which === 'newgame') { ngSlot = SLOTS.find(i => !readSlot(i)) ?? 1; renderNewGame(); }
  if (which === 'single') document.getElementById('btnContinue').style.display = latestSlot() ? 'block' : 'none';
  Sound.muffle(paused && which !== 'talk' && which !== 'shop');   // talking and shopping keep the music clear
  if (which && !['settings', 'level', 'inv', 'dev'].includes(which)) document.querySelector(`#${which} button:not(:disabled), #${which} input`)?.focus({ preventScroll: true });   // big windows start with nothing highlighted
  else canvas.focus();
}
document.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
  const a = b.dataset.act;
  sfx('click');
  if (a === 'resume' || a === 'close') showMenu(null);
  if (a === 'settings') { settingsReturn = openMenu; showMenu('settings'); }
  if (a === 'changelog') showMenu('changelog');
  if (a === 'controls') showMenu('controls');
  if (a === 'controlsBack') showMenu('settings');
  if (a === 'bindreset') { settings.binds = defaultBinds(); bindCap = null; persistSettings(); renderHelp(); renderControls(); bindMsg('Controls reset to the defaults.'); }
  if (a === 'back') showMenu(settingsReturn);
  if (a === 'newgame') showMenu('newgame');
  if (a === 'load') showMenu('load');
  if (a === 'toTitle') showMenu('title');
  if (a === 'single' || a === 'toSingle') showMenu('single');
  if (a === 'fullscreen') toggleFullscreen();
  if (a === 'continue') { const l = latestSlot(); if (l) loadSlot(l.i); }
  if (a === 'startNew') {
    const d = readSlot(ngSlot);
    const go = () => newRun(document.getElementById('ngName').value, ngDiff, ngSlot);
    if (d) askConfirm('OVERWRITE SAVE?', `Slot ${ngSlot} already has a save (${d.name}). Start a new run over it?`, go, { yes: 'Overwrite', no: 'Keep it' }); else go();
  }
  if (a === 'quitApp') {
    const inRun = hero && (state === 'play' || state === 'village');
    const atRisk = inRun && (wave > Math.max(0, lastSavedWave) || hero.gold > savedGold);
    const go = quitToDesktop;
    if (atRisk) askConfirm('QUIT TO DESKTOP?', `Progress since your last save (wave ${Math.max(0, lastSavedWave)}) will be lost.`, go, { yes: 'Quit to desktop', no: 'Keep playing' }); else go();
  }
  if (a === 'openSaves' && window.stickApp) window.stickApp.openSaveFolder();
  if (a === 'quit') {
    const atRisk = wave > Math.max(0, lastSavedWave) || hero.gold > savedGold;
    if (atRisk) askConfirm('QUIT TO TITLE?', `Progress since your last campfire save (wave ${Math.max(0, lastSavedWave)}) will be lost.`, goTitle, { yes: 'Quit to title', no: 'Keep playing' }); else goTitle();
  }
}));
function renderMenuInfo() {
  const el = document.getElementById('menuInfo');
  if (!el || !hero) return;
  const w = Math.max(0, lastSavedWave), lostW = Math.max(0, wave - w), lostG = Math.max(0, hero.gold - savedGold);
  el.innerHTML = `<em>Last save: wave ${w}</em>` +
    (lostW || lostG ? `<br>At risk if you die: ${lostW} wave${lostW === 1 ? '' : 's'}, ${lostG.toLocaleString()} gold` : '<br>Nothing at risk right now.');
}
function goTitle() {
  state = 'title';
  reset();
  hero = null;
  setBiome(0, false);
  showMenu('title');
  Sound.music('title');
  Sound.setScene(null);
}

function renderLevelMenu() {
  document.getElementById('lvNum').textContent = hero.level >= levelCap() ? `${hero.level} (max)` : hero.level;
  document.getElementById('lvPts').textContent = hero.points;
  const pct = n => Math.round(n * 100) + '%';
  document.getElementById('lvStats').innerHTML = STATS.map(s => {
    const mx = statMax(s), v = hero.stats[s.k], cap = mx || s.softCap, maxed = mx && v >= mx;
    const fill = cap ? Math.min(100, v / cap * 100) : Math.min(100, v * 2);
    return `<div class="stat ${maxed ? 'maxed' : ''}" style="--c:${s.color}">
      <div class="stat-main">
        <div class="stat-top"><span class="tag">${s.short}</span><b>${s.name}</b>
          <span class="stat-val">${v}${mx ? ` / ${mx}` : ''}</span></div>
        <div class="meter"><i style="width:${fill}%"></i></div>
        <small>${s.desc}${s.capNote ? ` · <em>${s.capNote}</em>` : ''}</small>
      </div>
      <button class="plus" data-stat="${s.k}" ${hero.points < 1 || maxed ? 'disabled' : ''} title="Spend 1 point">+</button>
    </div>`;
  }).join('');
  document.getElementById('lvSummary').innerHTML = [
    ['Damage', swordDmg()],
    ['Crit', `${pct(critChance())} (cap ${pct(GEAR_CAPS.crit)}) · ${critMult().toFixed(2)}× (cap ${GEAR_CAPS.critDmg}×)`],
    ['Max HP', hero.maxHp],
    ['Damage taken', `-${pct(dmgReduction())} (cap ${pct(GEAR_CAPS.dr)})`],
    ['Move speed', `+${pct(moveSpeed() / BASE_SPEED - 1)} (cap +${pct(GEAR_CAPS.speed)})`],
    ['Stamina', `${maxStamina()} · +${staminaRegen().toFixed(0)}/s`],
    ['Swing cost', `${hero.sword.cost} · flip ${FLIP_COST}`],
    ['Flip cooldown', `${flipCooldown().toFixed(2)}s`],
    ...(rebirths() ? [['Rebirth', `${rebirths()} · level cap ${levelCap()}`], ['Rebirth bonus', `+${+((rbDmgMul() - 1) * 100).toFixed(1)}% damage · +${+(REBIRTH.hp * rebirths() * 100).toFixed(1)}% health`], ['Dodge', `${+(dodgeChance() * 100).toFixed(2)}%`], ['XP · gold', `×${rbXpMul().toFixed(2)} · ×${rbGoldMul().toFixed(2)}`]] : [['Level cap', `${levelCap()} (then rebirth at the shrine)`]]),
  ].map(([k, v]) => `<div class="sumrow"><span>${k}</span><b>${v}</b></div>`).join('');
}
document.getElementById('level').addEventListener('click', e => {
  const st = e.target.dataset.stat, def = STATS.find(x => x.k === st);
  if (st && hero.points > 0 && !(def && statMax(def) && hero.stats[st] >= statMax(def))) {
    hero.points--; hero.stats[st]++;
    if (st === 'hp') { hero.maxHp += VIT_HP; hero.hp += VIT_HP; syncRebirthHp(); }
    if (st === 'sta') hero.stamina = Math.min(maxStamina(), hero.stamina + 10);
    sfx('point'); renderLevelMenu();
  }
});

// --- Input ---
const keys = {};
function advanceIntro() {
  if (state === 'splash') {
    Sound.ctx(); state = 'intro'; Sound.music('title');
    if (introSeen()) { introT = INTRO_SHORT_FROM; introFlags = { t0: INTRO_SHORT_FROM, toll: true, hollow: true, seen: true }; }   // seen it before: only the last part
    else { introT = 0; introFlags = {}; }
    return true;
  }
  if (state === 'intro') { goTitle(); return true; }
  return false;
}
const held = a => (settings.binds[a] || []).some(c => keys[c]);           // is any input bound to this action held down?

// The wheel menu: hold the inventory key and a ring of segments appears over the game, which slows to a crawl while it is up. Move the mouse towards a segment
// (it lights up) and let go to open it; let go over the middle or over a locked segment and the wheel just closes. (Skills opens the Character window, where the stat points are, until real skills arrive.)
const WHEEL_ITEMS = [
  { id: 'inv', name: 'Inventory', open: 'inv', icon: '<path d="M14 18 Q14 8 24 8 Q34 8 34 18" fill="none" stroke="#e6c887" stroke-width="3" stroke-linecap="round"/><path d="M11 18 H37 L40 40 Q40 43 37 43 H11 Q8 43 8 40 Z" fill="#8a5528" stroke="#f0d9a2" stroke-width="2" stroke-linejoin="round"/><path d="M8 27 H40" stroke="#f0d9a2" stroke-width="2"/><rect x="20" y="25" width="8" height="7" rx="1.5" fill="#e6c887" stroke="#4a2a14" stroke-width="1.2"/>' },
  { id: 'level', name: 'Skills', open: 'level', icon: '<path d="M24 44 V30 M24 30 Q12 28 10 16 M24 30 Q36 28 38 16" fill="none" stroke="#9be07a" stroke-width="3" stroke-linecap="round"/><path d="M24 4 L27 11 L34.5 11.5 L28.8 16.4 L30.6 23.8 L24 19.8 L17.4 23.8 L19.2 16.4 L13.5 11.5 L21 11 Z" fill="#f4c64f" stroke="#7a5a10" stroke-width="1.5" stroke-linejoin="round"/><circle cx="10" cy="14" r="4.5" fill="#9be07a" stroke="#2f5a26" stroke-width="1.5"/><circle cx="38" cy="14" r="4.5" fill="#9be07a" stroke="#2f5a26" stroke-width="1.5"/>' },
];
const UTIL_ITEMS = [
  { id: 'potion', name: 'Healing Potion', open: 'potion', icon: '<path d="M19 6 H29 V9 H27 V19 L37 38 Q39 43 33 43 H15 Q9 43 11 38 L21 19 V9 H19 Z" fill="#e0405a" stroke="#f6c0c8" stroke-width="2" stroke-linejoin="round"/><path d="M14 36 H34" stroke="#ff9aaa" stroke-width="3" stroke-linecap="round"/><rect x="19" y="3" width="10" height="5" rx="1.5" fill="#d8cdb0" stroke="#6a5a3a" stroke-width="1.2"/>' },
  { id: 'scroll', name: 'Return Scroll', open: 'scroll', icon: '<path d="M13 10 H35 V38 H13 Z" fill="#efe6c8" stroke="#6a5a3a" stroke-width="2"/><path d="M9 7 H39 V12 H9 Z M9 36 H39 V41 H9 Z" fill="#b8a070" stroke="#6a5a3a" stroke-width="1.6"/><path d="M19 22 L24 16 L29 22 M24 16 V31" fill="none" stroke="#8a50d0" stroke-width="2.6" stroke-linecap="round"/>' },
];
let wheelItems = WHEEL_ITEMS, wheelKind = 'menu';                       // the ring shows either the menu items (Tab) or the utilities (R)
let wheelOpen = false, wheelCode = null, wheelHover = null, wheelSel = -1, wheelSlow = 1, lastMouse = null;       // wheelHover: what a release opens (or null); wheelSlow: how fast time runs (1 normal)
const wheelEl = document.getElementById('wheel'), WHEEL = { C: 260, R1: 112, R2: 250 };
function buildWheel() {                                                  // the ring: one wooden segment per item, a hub in the middle that names the one you are aiming at
  const n = wheelItems.length, { C, R1, R2 } = WHEEL, pol = (r, a) => `${(C + r * Math.cos(a)).toFixed(1)} ${(C + r * Math.sin(a)).toFixed(1)}`;
  let segs = '', icons = '';
  wheelItems.forEach((it, i) => {
    const mid = -Math.PI / 2 + i * 2 * Math.PI / n, half = Math.PI / n - 0.035, a0 = mid - half, a1 = mid + half, rm = (R1 + R2) / 2 + 6;
    segs += `<path class="wseg${it.soon ? ' soon' : ''}" data-i="${i}" d="M ${pol(R2, a0)} A ${R2} ${R2} 0 0 1 ${pol(R2, a1)} L ${pol(R1 + 10, a1)} A ${R1 + 10} ${R1 + 10} 0 0 0 ${pol(R1 + 10, a0)} Z"/>`;
    const x = C + rm * Math.cos(mid), y = C + rm * Math.sin(mid);
    icons += `<g class="wicon${it.soon ? ' soon' : ''}" data-i="${i}" transform="translate(${(x - 30).toFixed(1)} ${(y - 36).toFixed(1)})"><svg width="60" height="60" viewBox="0 0 48 48">${it.icon}</svg><text x="30" y="76" text-anchor="middle">${it.name}</text></g>`;
  });
  wheelEl.innerHTML = `<div class="wheel-box" id="wheelBox"><svg viewBox="0 0 520 520">${segs}<circle class="whub" cx="${C}" cy="${C}" r="${R1}"/>${icons}</svg>
    <div class="wheel-hub"><div class="wheel-name" id="wheelName"></div><div class="wheel-sub" id="wheelSub"></div></div></div>`;
  wheelAim(null);
}
function wheelAim(i) {                                                   // light up segment i (or none) and say what releasing will do
  const prev = wheelSel; wheelSel = i === null || i === undefined ? -1 : i;
  const it = wheelItems[wheelSel], nm = document.getElementById('wheelName'), sub = document.getElementById('wheelSub');
  wheelHover = it && !it.soon ? it.open : null;
  wheelEl.querySelectorAll('.wseg, .wicon').forEach(el => el.classList.toggle('on', +el.dataset.i === wheelSel));
  if (nm) { nm.textContent = it ? it.name : wheelKind === 'util' ? 'Utility' : 'Menu'; sub.innerHTML = !it ? 'Point at an icon' : it.soon ? 'Coming soon' : wheelKind === 'util' ? `Release <b>${escapeHtml(keyLabel('utility'))}</b> to equip` : `Release <b>${escapeHtml(keyLabel('inventory'))}</b> to open`; }
  if (wheelOpen && wheelSel !== prev && wheelSel >= 0) sfx('tick');
}
function wheelAimAt(x, y) {                                              // the mouse is at (x, y) on the page: which segment is it pointing at? (the middle is nothing)
  const box = document.getElementById('wheelBox'); if (!box) return;
  const r = box.getBoundingClientRect(), k = r.width / 520, dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2);
  if (Math.hypot(dx, dy) < WHEEL.R1 * k * 0.92) { wheelAim(null); return; }
  const n = wheelItems.length; let a = Math.atan2(dy, dx) + Math.PI / 2 + Math.PI / n; a = (a % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  wheelAim(Math.floor(a / (2 * Math.PI / n)) % n);
}
function openWheel(code, kind = 'menu') { if (kind !== wheelKind) { wheelKind = kind; wheelItems = kind === 'util' ? UTIL_ITEMS : WHEEL_ITEMS; buildWheel(); } wheelOpen = true; wheelCode = code; wheelAim(null); wheelEl.classList.add('show'); sfx('switch'); }
function closeWheel() { wheelOpen = false; wheelCode = null; wheelHover = null; wheelSel = -1; wheelEl.classList.remove('show'); }
function wheelRelease() {                                                // the key came up: open what the mouse is pointing at, or nothing
  if (!wheelOpen) return;
  const pick = wheelHover, kind = wheelKind; closeWheel();
  if (kind === 'util') { if (pick && !hero.dead) equipUtility(pick); return; }
  if (pick && !hero.dead && (state === 'play' || state === 'village') && openMenu === null) { sfx('menu'); showMenu(pick); }
}
buildWheel();
addEventListener('mousemove', e => { lastMouse = { x: e.clientX, y: e.clientY }; if (wheelOpen) wheelAimAt(e.clientX, e.clientY); });      // nothing is aimed at until the mouse moves, so a still mouse never opens anything by accident
addEventListener('blur', closeWheel);

function handleInput(code, e) {                                            // one press of a key or mouse button (code: 'KeyW', 'Mouse0'...)
  const is = a => (settings.binds[a] || []).includes(code), rep = !!e.repeat, stop = () => { if (e.cancelable) e.preventDefault(); };
  Sound.ctx();   // browsers only allow audio after a user gesture
  if (confirmOpen) { stop(); if (!rep) { if (code === 'Escape' || code === 'KeyN') closeConfirm(false); else if (code === 'Enter' || code === 'NumpadEnter' || code === 'KeyY') closeConfirm(true); } return; }       // a question is open: only its own keys count
  if (advanceIntro()) return;
  if (rebirthFx) { skipRebirthFx(); return; }                    // the rebirth scene: any key moves it along, nothing else happens meanwhile
  if (state === 'camp') { if (campT > 1.5 && campT < 6.2) campT = 6.2; return; }
  if (is('fullscreen') && !rep) { toggleFullscreen(); return; }
  if (wheelOpen) { stop(); if (code === 'Escape') closeWheel(); return; }              // while the wheel is up, nothing else listens (no stray swings)
  if (state === 'title') {
    if (code === 'Escape' && openMenu !== 'title') showMenu(openMenu === 'settings' ? settingsReturn : openMenu === 'controls' ? 'settings' : openMenu === 'newgame' || openMenu === 'load' ? 'single' : 'title');   // (the update log goes back to the title)
    return;
  }
  if (openMenu === 'controls') { if (code === 'Escape') showMenu('settings'); return; }
  if (code === 'Escape' || is('pause')) {
    showMenu(openMenu === 'settings' ? settingsReturn : paused ? null : 'menu');
    return;
  }
  if (code === 'Backquote' && settings.consoleEnabled && !rep && (openMenu === null || openMenu === 'dev' || openMenu === 'console')) {      // ` opens the console (when it is enabled in Settings); the dev menu is opened from inside it
    stop();
    showMenu(openMenu === null ? 'console' : null);
    return;
  }
  const wantChar = is('character'), wantInv = is('inventory');
  if (is('utility') && openMenu === null && !paused && !hero.dead && (state === 'play' || state === 'village')) { stop(); if (!rep) openWheel(code, 'util'); return; }
  if (wantInv && openMenu === null && !paused && !hero.dead && (state === 'play' || state === 'village')) { stop(); if (!rep) openWheel(code); return; }
  if ((wantChar || wantInv) && (openMenu === null || openMenu === 'level' || openMenu === 'inv')) {      // Character and Inventory are two separate windows
    stop();
    if (!rep && !hero.dead) { const w = wantChar ? 'level' : 'inv'; showMenu(openMenu === w || (wantInv && openMenu === 'level') ? null : w); }
    return;
  }
  if ((openMenu === 'talk' || openMenu === 'shop') && /^(Digit|Numpad)[0-9]$/.test(code)) {   // number keys pick dialogue / shop options
    stop(); if (rep) return;
    const n = +code.slice(-1);
    const tiles = document.querySelectorAll('#shopBody [data-pick], #shopBody [data-tpick], #shopBody [data-epick]');
    const btns = [...(openMenu === 'talk' ? document.querySelectorAll('#talkBtns button') : tiles.length ? tiles : document.querySelectorAll('#shopBody [data-buy]'))];
    if (n === 0 && openMenu === 'shop') showMenu(null);
    else if (btns[n - 1] && !btns[n - 1].disabled) btns[n - 1].click();
    return;
  }
  if (paused) return;
  keys[code] = true;
  if (code.startsWith('Arrow') || code === 'Space' || code.startsWith('Mouse')) stop();
  if (rep) return;
  if (hero.dead) {
    if (is('respawn') && hero.deadT > 1) { if (!loadSlot(currentSlot)) newRun(hero.name, diffKey, currentSlot); }
    return;
  }
  if (is('potion')) useUtility();
  if (is('interact') && state === 'play') dungeonInteract();
  if (is('swapWeapon') && slotOpen('weapon2')) {                                  // rebirth 10: swap to the spare weapon
    const r = swapWeapons();
    popups.push({ text: r === 'ok' ? `Swapped to ${hero.equip.weapon.name}` : r === 'empty' ? 'No spare weapon (set one in the inventory)' : r, x: VW / 2, y: 120, t: 1.4, screen: true, small: true, color: r === 'ok' ? '#fd4' : '#f88' });
    if (r === 'ok') sfx('pickup');
  }
  if (state === 'village') { if (is('interact')) villageInteract(); return; }     // no fighting in the village
  if (is('attack')) startAttack();
  if (is('flip')) startFlip();
}
addEventListener('keydown', e => {
  const tag = e.target.tagName;
  if ((tag === 'INPUT' && e.target.type === 'text') && e.code !== 'Escape') return;
  if (bindCap) return;                                                   // the controls window is waiting for a key (handled below)
  handleInput(e.code, e);
});
addEventListener('keyup', e => { keys[e.code] = false; if (wheelOpen && e.code === wheelCode) wheelRelease(); });
wrap.addEventListener('mousedown', e => { if (!bindCap && (e.target === canvas || e.target.id === 'gl')) handleInput('Mouse' + e.button, e); });      // a click on the game view (menus sit on top of it, so clicking them never attacks)
addEventListener('mouseup', e => { keys['Mouse' + e.button] = false; if (wheelOpen && 'Mouse' + e.button === wheelCode) wheelRelease(); if (e.button > 2 && e.cancelable) e.preventDefault(); });
addEventListener('auxclick', e => { if (e.button > 2 && e.cancelable) e.preventDefault(); });                  // the side buttons must not act as browser back / forward
wrap.addEventListener('contextmenu', e => { if (e.target === canvas || e.target.id === 'gl') e.preventDefault(); });

// --- Controls window (Settings > Edit keybinds) ---
const MOUSE_NAMES = { Mouse0: 'Left mouse button', Mouse1: 'Middle mouse button', Mouse2: 'Right mouse button', Mouse3: 'Mouse side button 1 (back)', Mouse4: 'Mouse side button 2 (forward)' };
const KEY_NAMES = { Space: 'Space', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ShiftLeft: 'Left Shift', ShiftRight: 'Right Shift', ControlLeft: 'Left Ctrl', ControlRight: 'Right Ctrl', AltLeft: 'Left Alt', AltRight: 'Right Alt', Tab: 'Tab', Enter: 'Enter', Backspace: 'Backspace', CapsLock: 'Caps Lock', Backquote: '`' };
function inputName(c) {
  if (MOUSE_NAMES[c]) return MOUSE_NAMES[c];
  if (/^Mouse\d+$/.test(c)) return `Mouse button ${+c.slice(5) + 1}`;
  return KEY_NAMES[c] || c.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ');
}
const shortInput = c => ({ Mouse0: 'LMB', Mouse1: 'MMB', Mouse2: 'RMB', Mouse3: 'M4', Mouse4: 'M5', ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl', AltLeft: 'Alt', AltRight: 'Alt' }[c] || (/^Mouse\d+$/.test(c) ? 'M' + (+c.slice(5) + 1) : inputName(c)));
function persistSettings() { try { localStorage.setItem('rpgSettings', JSON.stringify(settings)); } catch {} }
// the help line under the game shows whatever is bound right now
function renderHelp() {
  const el = document.getElementById('help'); if (!el || !settings.binds) return;
  const names = a => { const out = [...new Set((settings.binds[a] || []).map(shortInput))].slice(0, 2); return out.length ? out.join('/') : '–'; };
  const move = ['up', 'left', 'down', 'right'].map(a => names(a).split('/')[0]);
  const item = (a, text) => `<b>${escapeHtml(names(a))}</b>${text}`;
  el.innerHTML = `<b>${escapeHtml(move.every(m => m.length === 1) ? move.join('') : move.join('/'))}</b>move` + item('attack', 'attack') + item('flip', 'flip') + item('potion', 'use item') + item('utility', 'hold: items') + item('character', 'character') + item('inventory', 'hold: wheel menu') + item('interact', 'talk') +
    '<b>Esc</b>menu' + item('fullscreen', 'fullscreen') + (settings.consoleEnabled ? '<b>`</b>console' : '');
}
const keyLabel = a => { const c = (settings.binds[a] || [])[0]; return c ? shortInput(c) : '?'; };            // what to show for an action's first key
function bindMsg(text) { const m = document.getElementById('bindMsg'); if (m) m.textContent = text; }
function renderControls() {
  document.getElementById('bindList').innerHTML = BIND_ACTIONS.map(a => {
    const cur = settings.binds[a.id] || [];
    const chips = cur.map((c, i) => {
      const cap = bindCap && bindCap.a === a.id && bindCap.i === i;
      return `<span class="chip ${cap ? 'cap' : ''}"><button data-bind="edit" data-a="${a.id}" data-i="${i}">${cap ? 'Press a key or mouse button…' : escapeHtml(inputName(c))}</button><button class="bx" data-bind="del" data-a="${a.id}" data-i="${i}" title="Remove">×</button></span>`;
    }).join('');
    const adding = bindCap && bindCap.a === a.id && bindCap.i === -1;
    return `<div class="bindrow"><span class="bname">${a.label}${a.note ? ` <small>${a.note}</small>` : ''}</span><div class="bchips">${chips}<button class="badd ${adding ? 'cap' : ''}" data-bind="add" data-a="${a.id}">${adding ? 'Press a key or mouse button…' : '+ Add'}</button></div></div>`;
  }).join('');
}
function bindDone(code) {                                              // finish a capture; code is null when it was cancelled
  const { a, i } = bindCap; bindCap = null;
  if (code) {
    let moved = null;
    for (const k in settings.binds) if (k !== a && k !== 'respawn' && a !== 'respawn' && settings.binds[k].includes(code)) { settings.binds[k] = settings.binds[k].filter(c => c !== code); moved = BIND_ACTIONS.find(x => x.id === k).label; }
    const list = settings.binds[a].slice(); if (i >= 0) list[i] = code; else list.push(code);
    settings.binds[a] = list.filter((c, idx) => c !== code || idx === list.indexOf(code));
    persistSettings(); renderHelp();
    bindMsg(`${inputName(code)} is now bound to "${BIND_ACTIONS.find(x => x.id === a).label}"${moved ? ` (it was taken from "${moved}")` : ''}.`);
  } else bindMsg('Cancelled.');
  bindAssignedAt = performance.now(); renderControls();
}
document.getElementById('bindList').addEventListener('click', e => {
  if (performance.now() - bindAssignedAt < 300) return;                  // the click that ended a capture must not start another
  const b = e.target.closest('[data-bind]'); if (!b) return;
  const a = b.dataset.a, i = +b.dataset.i;
  sfx('click');
  if (b.dataset.bind === 'edit') bindCap = { a, i };
  else if (b.dataset.bind === 'add') bindCap = { a, i: -1 };
  else { settings.binds[a].splice(i, 1); bindCap = null; persistSettings(); renderHelp(); bindMsg('Removed.'); }
  renderControls();
});
// while a capture is open, the next key or mouse button (pressed on the list) becomes the binding; Esc cancels
addEventListener('keydown', e => {
  if (!bindCap) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (e.code === 'Escape') bindDone(null);
  else if (e.code === 'Backquote') bindMsg('The console key (`) is fixed. Turn the console on or off in Settings.');
  else bindDone(e.code);
}, true);
addEventListener('mousedown', e => {
  if (!bindCap) return;
  if (!e.target.closest('#bindList')) { bindCap = null; renderControls(); return; }     // pressing anything else cancels, and that click goes through
  e.preventDefault(); e.stopImmediatePropagation();
  bindDone('Mouse' + e.button);
}, true);
document.addEventListener('contextmenu', e => { if (bindCap) e.preventDefault(); });


addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && (state === 'play' || state === 'village') && !paused) showMenu('menu'); });

// --- World generation ---
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function setBiome(z, announce = true) {
  zone = z;
  const B = BIOMES[z % BIOMES.length];
  const seed = (Math.random() * 1e9) | 0;
  particles = [];
  world = { B, seed, ...buildWorldFeatures(B, seed) };
  setWeather(rollWeather(z), true);
  buildGrass();
  buildGround();
  if (typeof spawnCritters === 'function') spawnCritters();
  if (announce) {
    popups.push({ text: `— ${B.name} —`, x: VW / 2, y: 190, t: 3, big: true, screen: true, color: '#fff' });
    Sound.music(B.music);
  }
}

function buildGround() {
  const { B, lava, water } = world, r = mulberry(world.seed ^ 0x5bd1e995);
  const g = document.createElement('canvas');
  g.width = WW; g.height = WH;
  const c = g.getContext('2d');
  c.fillStyle = B.ground; c.fillRect(0, 0, WW, WH);
  for (let i = 0; i < 260; i++) {
    const x = r() * WW, y = r() * WH, rad = 40 + r() * 140;
    const grad = c.createRadialGradient(x, y, 0, x, y, rad);
    const col = r() < 0.5 ? B.patch : B.patch2;
    grad.addColorStop(0, withAlpha(col, 0.67)); grad.addColorStop(1, withAlpha(col, 0));
    c.fillStyle = grad; c.beginPath(); c.ellipse(x, y, rad, rad * 0.6, 0, 0, Math.PI * 2); c.fill();
  }
  bakeGroundDetail(c, r, B);
  if (!B.noPath) {                                      // winding dirt path through the middle
    const ph = world.seed % 7;
    c.strokeStyle = B.patch + '88'; c.lineWidth = 34; c.lineCap = 'round';
    c.beginPath();
    for (let x = -50; x <= WW + 50; x += 40) c.lineTo(x, WH / 2 + Math.sin(x / 260 + ph) * 180 + Math.sin(x / 90) * 20);
    c.stroke();
  }
  for (const l of lava) {
    const grad = c.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.rx * 1.3);
    grad.addColorStop(0, '#ffd070'); grad.addColorStop(0.45, '#ff6a1a'); grad.addColorStop(0.8, '#a21c08'); grad.addColorStop(1, 'rgba(40,10,5,0)');
    c.fillStyle = grad; c.beginPath(); c.ellipse(l.x, l.y, l.rx * 1.3, l.ry * 1.3, 0, 0, Math.PI * 2); c.fill();
  }
  for (const w of water) bakeWater(c, w);
  if (gfx.grass && !gfx.anim && world.grassC) bakeGrass(c);
  // darken the world edges so the boundary reads as the edge of the map
  const edge = (x0, y0, x1, y1) => {
    const grad = c.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = grad; c.fillRect(0, 0, WW, WH);
  };
  edge(0, 0, 90, 0); edge(WW, 0, WW - 90, 0); edge(0, 0, 0, 90); edge(0, WH, 0, WH - 90);
  world.ground = g;
  const mini = document.createElement('canvas');
  mini.width = 150; mini.height = 100;
  mini.getContext('2d').drawImage(g, 0, 0, 150, 100);
  world.mini = mini;
}

function buildGrass() {
  const r = mulberry(world.seed + 99);
  world.grass = Array.from({ length: gfx.grass }, () => ({ x: r() * WW, y: r() * WH, s: 4 + r() * 6, c: r() < 0.5 ? 0 : 1, ph: r() * 6.28 }))
    .filter(g => !world.lava.some(l => ((g.x - l.x) / l.rx) ** 2 + ((g.y - l.y) / l.ry) ** 2 < 1.4) && !world.water.some(w => inEllipse(g.x, g.y, w, 6)));
  world.grassC = [0, 1].map(c => world.grass.filter(g => g.c === c).sort((a, b) => a.x - b.x));
  world.grassKey = `${gfx.grass}|${gfx.anim}`;
}
// High quality has no wind, so its grass never moves: it is painted once into the ground picture instead of being stroked every frame
function bakeGrass(c) {
  c.lineWidth = 1.3; c.lineCap = 'round';
  for (let k = 0; k < 2; k++) {
    c.strokeStyle = world.B.grass[k]; c.beginPath();
    for (const g of world.grassC[k]) {
      c.moveTo(g.x, g.y); c.quadraticCurveTo(g.x - 1, g.y - g.s * 0.6, g.x - 2, g.y - g.s);
      c.moveTo(g.x, g.y); c.quadraticCurveTo(g.x + 1, g.y - g.s * 0.6, g.x + 2, g.y - g.s * 0.9);
    }
    c.stroke();
  }
}

// --- Hero ---
// Gear adds on top of the level stats (gearStat / capValue live in gear.js); the ceilings are in GEAR_CAPS.
const swordDmg = () => Math.round((hero.sword.dmg + Math.min(strMax(), hero.stats.str) * 2 + Math.round(gearStat('dmg'))) * rbDmgMul() * (ailT('weak') > 0 ? 0.7 : 1));
const staPts = () => Math.min(staMax(), hero.stats.sta);
const maxStamina = () => 100 + staPts() * 10 + Math.round(gearStat('stamina'));
const staminaRegen = () => Math.min(44, 22 + staPts() * 1.4);      // hard cap: stamina still matters late
const flipCooldown = () => FLIP_COOLDOWN * (1 - hero.stats.cd * 0.06) * (1 - Math.min(0.5, gearStat('cdr')));
const dmgReduction = () => capValue('dr', Math.min(drCap(), Math.min(vitMax(), hero.stats.hp) * 0.0015));        // Vitality gives at most 10% (and its points are capped well before that); with gear the ceiling is 60%
const moveSpeed = () => BASE_SPEED * (1 + capValue('speed', Math.min(speedCap(), staPts() * 0.0015))) * (hero.chillT > 0 ? 0.65 : 1) * (ailT('freeze') > 0 ? 0 : 1);      // a Frost nova chills you; frozen, you cannot move at all
const critChance = () => capValue('crit', BASE_CRIT + Math.min(CRIT_POINTS_MAX, hero.stats.crit) * 0.005);
const critMult = () => capValue('critDmg', BASE_CRIT_MULT + Math.min(CRIT_POINTS_MAX, hero.stats.crit) * 0.02);

// --- What a blow hits: the weapon itself. weaponShapes(p) is where the weapon is, p of the way through the attack: capsules along the blade (and bigger ones at the head of an axe, hammer, scythe...).
// An enemy is hit when its body (a tall capsule standing on its feet) touches one of them, checked at several points between this frame and the last, so a fast swing cannot skip over anyone.
const HIT_SHAPE = {
  sword: { r: 4 }, great: { r: 5.5 }, dagger: { r: 4 }, rapier: { r: 3 }, katana: { r: 3.5 }, spear: { r: 3.5, head: { from: 0.75, r: 5 } },
  axe: { r: 3.5, head: { from: 0.6, r: 10 } }, hammer: { r: 3.5, head: { from: 0.7, r: 11 } }, scythe: { r: 3.5, head: { from: 0.5, r: 11 } }, halberd: { r: 3.5, head: { from: 0.6, r: 9 } },
  whip: { r: 4 }, fist: { r: 8 },
};
function weaponShapes(p) {
  const sw = hero.sword, f = hero.facing, K = weaponKind(sw), shape = HIT_SHAPE[sw.kind || 'sword'] || HIT_SHAPE.sword, out = [];
  const J = poseStick(hero.x, hero.y, f, { p: 0, run: false, lean: 0.02, breath: 0, atk: p, tuck: false, kind: sw.kind, variant: hero.attackVar | 0 });
  const add = (h, bl, len) => {
    const dx = f * Math.cos(bl), dy = Math.sin(bl), tx = h.x + dx * len, ty = h.y + dy * len;
    out.push({ x1: h.x, y1: h.y, x2: tx, y2: ty, r: shape.r });
    if (shape.head) out.push({ x1: h.x + dx * len * shape.head.from, y1: h.y + dy * len * shape.head.from, x2: tx, y2: ty, r: shape.head.r });
  };
  if (sw.kind === 'fist') for (const hd of [J.front.e, J.back.e]) out.push({ x1: hd.x, y1: hd.y, x2: hd.x, y2: hd.y, r: shape.r });
  else if (sw.kind === 'whip') { const w = whipPose(J, p); add(J.front.e, w.ang, sw.len * w.ext); }
  else { const len = weaponLength(sw); if (K.twin) add(J.back.e, J.bblade, len); add(J.front.e, J.blade, len); }
  return out;
}
function segDist(ax, ay, bx, by, cx, cy, dx, dy) {                    // the shortest distance between two line segments
  const pt = (px, py, x1, y1, x2, y2) => { const vx = x2 - x1, vy = y2 - y1, l = vx * vx + vy * vy, t = l ? Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / l)) : 0; return Math.hypot(px - (x1 + vx * t), py - (y1 + vy * t)); };
  const o = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
  if (o(ax, ay, bx, by, cx, cy) * o(ax, ay, bx, by, dx, dy) < 0 && o(cx, cy, dx, dy, ax, ay) * o(cx, cy, dx, dy, bx, by) < 0) return 0;      // they cross
  return Math.min(pt(ax, ay, cx, cy, dx, dy), pt(bx, by, cx, cy, dx, dy), pt(cx, cy, ax, ay, bx, by), pt(dx, dy, ax, ay, bx, by));
}
const enemyBody = m => ({ h: m.type === 'slime' ? m.r * 2.0 : m.r * 5.5, r: m.r * 0.75 });               // a tall capsule standing on the enemy's feet
const shapesHit = (m, shapes) => { const b = enemyBody(m); return shapes.some(s => segDist(s.x1, s.y1, s.x2, s.y2, m.x, hero.y - 4, m.x, hero.y - b.h) <= s.r + b.r); };      // the body is tested in the hero's lane (the depth gap is limited separately), so an enemy standing a little nearer or further is hit like one beside you

function startAttack() {
  if (hero.attackT > 0 || hero.flipT > 0 || ailT('freeze') > 0) return;
  const K = weaponKind(hero.sword), vi = (hero.combo | 0) % K.variants.length, Vr = K.variants[vi];      // an attack soon after the last one plays the next variant of the weapon's combo
  const cost = Math.max(1, Math.round(hero.sword.cost * Vr.cost));
  if (hero.stamina < cost) { sfx('tired'); return; }
  hero.stamina -= cost;
  hero.regenT = REGEN_DELAY;
  hero.attackDur = hero.sword.time * Vr.t * (1 - hero.stats.cd * 0.04) * (1 - Math.min(0.35, gearStat('cdr') * 0.6));
  hero.attackT = hero.attackDur;
  hero.hitSet = new Set(); hero.lastP = 0;
  hero.attackVar = vi; hero.atkMul = Vr.dmg; hero.attackReach = Vr.reach; hero.attackHitAt = Vr.hitAt ?? hero.sword.hitAt ?? 0.3; hero.rehitLeft = (Vr.rehit || []).slice(); hero.fireLeft = K.ranged ? (Vr.fire || [hero.attackHitAt]).slice() : null;
  hero.combo = (vi + 1) % K.variants.length; hero.comboT = hero.attackDur + 0.9;
  const snd = Vr.sfx || K.sfx, at = Vr.sfxAt ?? K.sfxAt;
  if (at) setTimeout(() => sfx(snd), hero.attackDur * at * 1000); else sfx(snd);
}

function startFlip() {
  if (hero.flipT > 0 || hero.flipCd > 0 || ailT('freeze') > 0) return;
  if (hero.stamina < FLIP_COST) { sfx('tired'); popups.push({ text: 'No stamina', x: hero.x, y: hero.y - 75, t: 0.6, color: '#7c7' }); return; }
  hero.stamina -= FLIP_COST;
  hero.regenT = REGEN_DELAY;
  let dx = 0, dy = 0;
  if (held('left')) dx--;
  if (held('right')) dx++;
  if (held('up')) dy--;
  if (held('down')) dy++;
  if (!dx && !dy) dx = hero.facing;
  const len = Math.hypot(dx, dy);
  hero.flipDx = dx / len; hero.flipDy = dy / len;
  hero.flipT = FLIP_TIME;
  hero.flipCd = FLIP_TIME + flipCooldown();
  hero.attackT = 0;
  burst(hero.x, hero.y, '#d8cfb0', 8, 90, 3, -20);
  sfx('flip');
}

const invulnerable = () => hero.flipT > 0 || hero.hurtT > 0 || hero.dodgeT > 0;

function killHero() {
  hero.dead = true; hero.deadT = 0; clearPoison(); sfx('death'); Sound.music('gameover');
  hero.lostGold = hero.gold; hero.gold = 0;       // carried gold is lost; the last save still has what was banked
}
// src: the monster that dealt it (its poison and life-steal apply when the hit lands). Returns the damage actually dealt.
function damageHero(dmg, sound = true, src = null) {
  if (hero.dead || invulnerable() || dev.god) return 0;
  if (Math.random() < dodgeChance()) {                                   // rebirth's own stat: the hit misses, and you are safe for a moment so it cannot be rolled every frame
    hero.dodgeT = 0.35; popups.push({ text: 'MISS', x: hero.x, y: hero.y - 76, t: 0.8, color: '#9fe3ff', pop: 0 }); sfx('whoosh');
    return 0;
  }
  dmg = Math.max(1, Math.round(dmg * (1 - dmgReduction())));
  hero.hp = Math.max(0, hero.hp - dmg);
  questEvent('hit'); cancelRecall('The scroll fizzles: you were hit');
  if (src) {
    if (src.poisons) addPoison(src);
    rollAilment(src);
    if (src.vamp && src.hp > 0) { const heal = Math.round(dmg * src.vamp); src.hp = Math.min(src.maxHp, src.hp + heal); popups.push({ text: `+${heal}`, x: src.x, y: src.y - 90, t: 0.6, color: '#c77dff', small: true }); }
  }
  hero.hurtT = 0.8;
  hero.hpRegenT = HP_REGEN_DELAY;
  shake(5);
  popups.push({ text: `-${dmg}`, x: hero.x, y: hero.y - 70, t: 0.8, color: '#f55', pop: 0 });
  burst(hero.x, hero.y - 35, '#c22', 10, 160, 2.5, 300);
  if (sound) sfx('hurt');
  if (hero.hp === 0) killHero();
  return dmg;
}

// --- Effects ---
function shake(n) { if (gfx.shake && !settings.comfort) cam.shake = Math.max(cam.shake, n); }
function flashScreen(n) { if (!settings.comfort) flash = Math.max(flash, n); }
function burst(x, y, color, n, speed, size, grav = 200, add = false) {
  if (!gfx.particles) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7 - speed * 0.3, life: 0.4 + Math.random() * 0.4, max: 0.8, size, color, g: grav, add });
  }
  if (particles.length > 900) particles.splice(0, particles.length - 900);
}
function updateParticles(dt) {
  for (const p of particles) {
    p.life -= dt;
    if (p.kind === 'fly') { p.vx += (Math.random() - 0.5) * 60 * dt; p.vy += (Math.random() - 0.5) * 60 * dt; }
    if (p.kind === 'leaf') p.vx = Math.sin(tAnim * 2 + p.ph) * 30;
    p.vy += (p.g || 0) * dt;
    if (p.grow) p.size += p.grow * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
  particles = particles.filter(p => p.life > 0);
  if (!gfx.ambient || !world || dun) return;
  // ambient particles around the camera, different for each biome (see critters.js)
  const amb = world.B.ambient, want = ambientCount(amb);
  let count = 0;
  for (const p of particles) if (p.amb) count++;
  for (let i = count; i < want; i++) {
    const p = makeAmbient(amb, cam.x + Math.random() * VW, cam.y + Math.random() * VH);
    if (p) particles.push(p);
  }
}

// --- Monsters ---
const MOB_SPEED_CAP = { harpy: 118, icesprite: 100, fireimp: 104, wisp: 84, frostwolf: 118 };      // the most any of these walks at, boosts and tiers included
const TYPES = {
  goblin:   { hp: 30, speed: 110, r: 12, dmg: 8,  xp: 12, from: 1, color: '#3d8b3d', gold: 1 },
  minotaur: { hp: 60, speed: 60,  r: 18, dmg: 10, xp: 22, from: 1, color: '#6b3e26', gold: 1.4 },
  slime:    { hp: 45, speed: 0,   r: 16, dmg: 8,  xp: 15, from: 2, color: '#5b5', gold: 1 },
  archer:   { hp: 35, speed: 70,  r: 12, dmg: 10, xp: 20, from: 3, color: '#ddd', gold: 1.2 },
  ogre:     { hp: 140, speed: 40, r: 24, dmg: 18, xp: 45, from: 7, color: '#6a7a3a', gold: 2.2 },
  // the creatures of single biomes (BIOME_MOBS in mobs.js says where each one lives)
  wolf:      { hp: 26, speed: 120, r: 12, dmg: 7,  xp: 14, from: 1, color: '#8a8a94', gold: 1,   pack: 2 },
  scorpion:  { hp: 50, speed: 60,  r: 15, dmg: 10, xp: 20, from: 1, color: '#c9923a', gold: 1.2 },
  icesprite: { hp: 22, speed: 90,  r: 10, dmg: 8,  xp: 16, from: 1, color: '#9fe4ff', gold: 1.1 },
  fireimp:   { hp: 28, speed: 95,  r: 10, dmg: 9,  xp: 18, from: 1, color: '#ff6a2a', gold: 1.1 },
  bogLurker: { hp: 70, speed: 55,  r: 17, dmg: 11, xp: 24, from: 1, color: '#4a6a3a', gold: 1.3, init: { state: 'hidden', untouchable: true, stateT: 1.0, poisons: true } },
  panther:   { hp: 55, speed: 85,  r: 14, dmg: 12, xp: 24, from: 1, color: '#2a2a34', gold: 1.3 },
  skeleton:  { hp: 24, speed: 80,  r: 12, dmg: 8,  xp: 12, from: 1, color: '#e8e4d0', gold: 1,   pack: 3 },
  harpy:     { hp: 32, speed: 100, r: 11, dmg: 10, xp: 20, from: 1, color: '#c9a0e0', gold: 1.2 },
  treant:       { hp: 90,  speed: 38,  r: 20, dmg: 12, xp: 28, from: 3, color: '#5a7a3a', gold: 1.6 },
  mummy:        { hp: 75,  speed: 45,  r: 15, dmg: 11, xp: 24, from: 3, color: '#d8cfa8', gold: 1.4, fireVuln: 2 },
  frostwolf:    { hp: 34,  speed: 98,  r: 12, dmg: 8,  xp: 18, from: 2, color: '#5a6c8e', gold: 1.1, pack: 2 },
  magmaslime:   { hp: 60,  speed: 0,   r: 16, dmg: 10, xp: 22, from: 3, color: '#ff6a2a', gold: 1.3 },
  wisp:         { hp: 20,  speed: 70,  r: 9,  dmg: 7,  xp: 16, from: 2, color: '#9fffd0', gold: 1.1 },
  sporeshroom:  { hp: 55,  speed: 0,   r: 14, dmg: 8,  xp: 20, from: 3, color: '#b05a8a', gold: 1.2 },
  cursedKnight: { hp: 110, speed: 50,  r: 17, dmg: 14, xp: 34, from: 4, color: '#5a5a78', gold: 1.8 },
  golem:        { hp: 160, speed: 30,  r: 24, dmg: 16, xp: 40, from: 5, color: '#8a8a7a', gold: 2 },
};

function edgePos() {
  const m = 50, side = Math.floor(Math.random() * 4);
  let x = side === 0 ? cam.x - m : side === 1 ? cam.x + VW + m : cam.x + Math.random() * VW;
  let y = side === 2 ? cam.y - m : side === 3 ? cam.y + VH + m : cam.y + 40 + Math.random() * (VH - 40);
  return { x: Math.max(15, Math.min(WW - 15, x)), y: Math.max(50, Math.min(WH - 10, y)) };
}

function spawnEnemy(type, pos = edgePos(), extra = {}) {
  const T = TYPES[type], d = D(), th = threat();
  const hp = Math.round(T.hp * (1 + wave * 0.15) * d.hp * th.hp);
  const m = {
    type, x: pos.x, y: pos.y, hp, maxHp: hp, r: T.r, dmg: Math.round((T.dmg + Math.floor(wave / 2)) * d.dmg * th.dmg), xp: Math.round((T.xp + wave * 3) * d.xp),
    speed: (T.speed * (0.85 + Math.random() * 0.3) + wave * 2) * d.spd * th.spd,
    facing: 1, walkT: Math.random() * 6, state: 'walk', stateT: Math.random(), spawnT: 0.5,
    chargeDx: 0, chargeDy: 0, knockX: 0, knockY: 0, flashT: 0, burnT: 0, slowT: 0, hopZ: 0, size: 1,
    ...(T.init || {}),
    ...extra,
  };
  enemies.push(m);
  if (!extra.noVariant) rollVariant(m, extra.variant);
  if (extra.leader) makeLeader(m);
  burst(pos.x, pos.y, m.elite ? '#ffd24a' : '#000', m.elite ? 14 : 6, 60, 3, -30);
  return m;
}
function spawnElite() {
  const pool = wavePool();
  const m = spawnEnemy(pool[Math.floor(Math.random() * pool.length)], edgePos(), { variant: 'elite' });
  popups.push({ text: `Elite: ${m.name}`, x: VW / 2, y: 170, t: 1.8, screen: true, small: true, color: '#ffd24a' });
  sfx('roar');
  return m;
}

function spawnBoss(kindOverride) {
  const d = D(), th = threat(), pos = edgePos();
  const kind = kindOverride || BOSS_BY_BIOME[BIOMES[zone % BIOMES.length].key] || 'minotaur';       // every biome has its own boss
  boss = spawnBossOfKind(kind, pos, d, th);
  enemies.push(boss);
  sfx('roar'); shake(10); flashScreen(0.25);
  Sound.music('boss');
  popups.push({ text: `⚠ ${boss.name} ⚠`, x: VW / 2, y: 150, t: 2.5, big: true, screen: true, color: '#f66' });
  popups.push({ text: boss.def.intro, x: VW / 2, y: 182, t: 2.5, screen: true, small: true, color: '#fcc' });
}

// Waves are counted within their set of ten, so a longer gap between bosses doesn't mean ever-larger crowds:
// the halfway wave (5) is a goblin horde, the last wave before the boss (9) is a heavier push.
function buildWave() {
  const pool = wavePool();                                                       // only this biome's creatures
  const pos = setPos(wave);
  let n = 2 + Math.floor(Math.random() * (2 + pos)) + 2 * tierOf(wave);
  if (pos === 9) n = Math.round(n * 1.3);
  const list = Array.from({ length: n }, () => pool[Math.floor(Math.random() * pool.length)]);
  for (const t of [...list]) if (TYPES[t].pack && Math.random() < 0.5) { for (let k = 1; k < TYPES[t].pack; k++) list.push(t); const i = list.indexOf(t); if (i >= 0) list[i] = t + '!'; }      // the first of a pack is its leader ('!')                      // wolves and skeletons come in packs
  const weakest = pool.reduce((a, t) => TYPES[t].hp < TYPES[a].hp ? t : a, pool[0]);
  if (pos === 5) for (let i = 0; i < 3 + tierOf(wave); i++) list.push(weakest);                                  // the halfway horde is the biome's weakest creature
  const t = tierOf(wave);                                         // elites turn up in ordinary waves once a boss has fallen, more often the further you get
  const elites = t < 1 ? 0 : (Math.random() < Math.min(0.6, 0.2 + 0.1 * t) ? 1 : 0) + (pos === 9 ? 1 : 0) + (t >= 3 && Math.random() < 0.3 ? 1 : 0);
  for (let i = 0; i < elites; i++) list.splice(Math.floor(Math.random() * (list.length + 1)), 0, 'elite');
  return list;
}

function updateWaves(dt) {
  if (dun) return;                                                                 // the waves wait while you are underground
  if (spawnQueue.length > 0) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      const t = spawnQueue.shift();
      t === 'boss' ? spawnBoss() : t === 'elite' ? spawnElite() : t.endsWith('!') ? spawnEnemy(t.slice(0, -1), edgePos(), { leader: true }) : spawnEnemy(t);
      sfx('spawn');
      spawnTimer = 0.3 + Math.random() * 1.3;
    }
  } else if (enemies.length === 0 && !hero.dead) {
    dungeonRoll();                                                                 // sometimes a stone door opens when a wave is cleared
    waveTimer -= dt;
    if (waveTimer <= 0) {
      closeDungeonDoor();
      if (wave > 0 && setPos(wave) === 5 && lastSavedWave < wave) {                                       // a checkpoint after every 5th wave (the village and the campfire cover the rest)
        saveGame(true, true); popups.push({ text: `Checkpoint: wave ${wave} saved`, x: VW / 2, y: 150, t: 2.2, screen: true, small: true, color: '#9f9' });
      }
      if ((wave + 1) % WAVES_PER_SET === 0 && villageSkip !== wave + 1) { enterVillage(); return; }   // a village before every boss
      if (wave > 0) questEvent('waveClear');
      wave++;
      if (zoneFor(wave) !== lastZoneStep) { lastZoneStep = zoneFor(wave); startCamp(randomBiome()); }
      else if (Sound.current === 'boss') Sound.music(BIOMES[zone % BIOMES.length].music);
      if (wave % WAVES_PER_SET === 0) {
        spawnQueue = [...Array(2 + Math.floor(tierOf(wave) / 2)).fill('elite'), 'boss', ...Array(Math.floor(wave / 5)).fill('goblin')];     // elites first, then the boss
        popups.push({ text: `Wave ${wave}: BOSS WAVE!`, x: VW / 2, y: 110, t: 2, big: true, screen: true, color: '#f66' });
      } else {
        spawnQueue = buildWave();
        const pos = setPos(wave), tag = pos === 5 ? ' — horde!' : pos === 9 ? ' — a village, then the boss!' : '';
        popups.push({ text: `Wave ${wave}: ${spawnQueue.length} monsters${tag}`, x: VW / 2, y: 110, t: 2, big: true, screen: true, color: pos === 9 ? '#fb8' : undefined });
        sfx('wave');
      }
      spawnTimer = 0.5;
      waveTimer = 3;
    }
  }
}

function updateBoss(m, dt, dx, dy, dist, spd) {
  updateKitBoss(m, dt, dx, dy, dist, spd);              // every boss, the Minotaur King included, runs on the attack kit in bosses.js
}
// ---- weapon effects (bought at the Enchantress): damage over time and crowd control on an enemy that was hit
function applyWeaponFx(m, item, dx) {
  const f = item && item.fx; if (!f || !WFX[f.k]) return;
  const W = WFX[f.k], lv = f.lv, base = Math.max(1, swordDmg()), boss = m.type === 'boss', fx = m.wfx || (m.wfx = {});
  const d = p => Math.max(1, Math.round(base * p));
  if (f.k === 'fire') fx.fire = { t: 3 + lv, dps: d(0.08 * lv) };
  else if (f.k === 'poison') { const s = Math.min(3, ((fx.poison && fx.poison.n) | 0) + 1); fx.poison = { t: 5, n: s, dps: d(0.07 * lv) }; }
  else if (f.k === 'bleed') fx.bleed = { t: 4, dps: d(0.06 * lv) };
  else if (f.k === 'frost') { m.slowT = Math.max(m.slowT || 0, 2 + lv); if (lv >= 3 && !boss && Math.random() < 0.12) mobStun(m, 1); }
  else if (f.k === 'shock') {
    if (Math.random() < 0.10 + 0.07 * lv) mobStun(m, 0.6 + 0.2 * lv, boss);
    let best = null, bd = 170; for (const o of enemies) if (o !== m && o.hp > 0 && o.dieT === undefined) { const dd = Math.hypot(o.x - m.x, o.y - m.y); if (dd < bd) { bd = dd; best = o; } }
    if (best) {
      const arc = d(0.2 * lv); best.hp -= arc; best.flashT = 0.12; popups.push({ text: `${arc}`, x: best.x, y: best.y - 80, t: 0.5, color: W.color, small: true });
      if (gfx.particles) for (let i = 0; i < 6; i++) { const k = i / 6; particles.push({ x: m.x + (best.x - m.x) * k, y: m.y - 35 + (best.y - m.y) * k + (Math.random() - 0.5) * 8, vx: 0, vy: 0, life: 0.25, max: 0.25, size: 2.2, color: W.color, add: true }); }
    }
  }
  if (gfx.particles && Math.random() < 0.6) burst(m.x, m.y - 35, W.color, 5, 120, 2, 80, true);
}
function mobStun(m, t, bossToo) {
  if (m.type === 'boss' && !bossToo) return;
  if (m.type === 'boss') { m.slowT = Math.max(m.slowT || 0, t * 1.5); return; }          // a boss only staggers
  m.stunT = Math.max(m.stunT || 0, t); m.mel = null; m.melCd = Math.max(m.melCd || 0, t);
  if (['windup', 'smashWind', 'crouch', 'aim', 'charge', 'hop'].includes(m.state)) { m.state = 'walk'; m.stateT = t + 0.3; m.hopZ = 0; }
  popups.push({ text: 'STUNNED', x: m.x, y: m.y - 92, t: 0.6, color: '#fff06a', small: true });
}
function tickMobFx(m, dt) {                                                               // the damage-over-time effects of the hero's weapon
  const fx = m.wfx; if (!fx) return;
  m.fxTick = (m.fxTick || 0) - dt;
  const due = m.fxTick <= 0; if (due) m.fxTick = 0.5;
  for (const k of ['fire', 'poison', 'bleed']) {
    const e = fx[k]; if (!e) continue;
    e.t -= dt; if (e.t <= 0) { delete fx[k]; continue; }
    if (!due) continue;
    const dmg = Math.max(1, Math.round(e.dps * (k === 'poison' ? 0.5 * e.n : 1) * (k === 'fire' ? (TYPES[m.type] && TYPES[m.type].fireVuln) || 1 : 1)));
    m.hp -= dmg; popups.push({ text: `${dmg}`, x: m.x + (Math.random() - 0.5) * 16, y: m.y - 66, t: 0.4, color: WFX[k === 'fire' ? 'fire' : k === 'poison' ? 'poison' : 'bleed'].color, small: true });
  }
  if (gfx.particles && Math.random() < dt * 10) { const c = fx.fire ? WFX.fire.color : fx.poison ? WFX.poison.color : fx.bleed ? WFX.bleed.color : null; if (c) particles.push({ x: m.x + (Math.random() - 0.5) * 20, y: m.y - 30 - Math.random() * 24, vx: 0, vy: fx.bleed && !fx.fire ? 25 : -45, life: 0.5, max: 0.5, size: 2.3, color: c, add: !fx.bleed }); }
  if (!fx.fire && !fx.poison && !fx.bleed) delete m.wfx;
}
function updateEnemies(dt) {
  for (const m of enemies) {
    const dx = hero.x - m.x, dy = hero.y - m.y, dist = Math.hypot(dx, dy) || 1;
    m.flashT = Math.max(0, m.flashT - dt);
    m.slowT = Math.max(0, m.slowT - dt);
    m.spawnT = Math.max(0, (m.spawnT || 0) - dt);
    if (dun && m.sleep && dunSleepTick(m, dt, dist)) { dunPush(m, Math.max(10, m.r * 0.8)); continue; }      // asleep: it does nothing until it sees you
    if (m.burnT > 0) {
      m.burnT -= dt; m.burnTick = (m.burnTick || 0) - dt;
      if (m.burnTick <= 0) { m.burnTick = 0.5; { const bd = 4 * ((TYPES[m.type] && TYPES[m.type].fireVuln) || 1); m.hp -= bd; } popups.push({ text: '4', x: m.x, y: m.y - 70, t: 0.4, color: '#f84' }); }
      if (gfx.particles && Math.random() < 0.3) particles.push({ x: m.x + (Math.random() - 0.5) * 20, y: m.y - 30 - Math.random() * 20, vx: 0, vy: -50, life: 0.5, max: 0.5, size: 2.5, color: '#f73', add: true });
    }
    tickMobFx(m, dt);
    const stunned = m.stunT > 0 && m.type !== 'boss'; if (stunned) { m.stunT -= dt; m.moving = false; m.mel = null; }
    m.stateT -= dt; mobTick(m, dt);
    const wm = (waterAt(m.x, m.y) ? 0.75 : 1) * mobBoost(m, dt);                  // packs rallied by a leader, enraged by its fall, speeded by a wisp
    const fz = m.frenzy && m.hp < m.maxHp * 0.3 ? 1.5 : 1;       // a Frenzied monster goes berserk when hurt
    const cap = MOB_SPEED_CAP[m.type];                           // fliers and the snow wolves get faster with the waves, but never so fast that they cannot be caught
    const spd = Math.min(m.speed * fz * (m.slowT > 0 ? 0.5 : 1) * wm, cap || 1e9);
    const slowMul = Math.min((m.slowT > 0 ? 0.5 : 1) * wm, cap ? 1.12 : 9);
    const ox = m.x, oy = m.y;

    const busy = m.type !== 'boss' && !stunned && melTick(m, dt, dx, dy, dist, fz);          // mid-swing it stands and fights instead of walking
    if (m.type === 'boss') updateBoss(m, dt, dx, dy, dist, spd);
    else if (busy) { /* swinging */ }
    else if (stunned) { /* dazed: it stands still */ }
    else if (isNewMob(m)) newMobAI(m, dt, dx, dy, dist, spd, slowMul);
    else if (m.type === 'minotaur' || m.type === 'ogre') {
      if (m.state === 'walk') {
        m.x += (dx / dist) * spd * dt; m.y += (dy / dist) * spd * dt;
        m.facing = Math.sign(dx) || m.facing;
        m.walkT += dt * 7;
        if (m.type === 'minotaur' && dist < 170 && m.stateT <= 0 && !hero.dead) {
          m.state = 'windup'; m.stateT = 0.5;       // telegraph before charge
          m.chargeDx = dx / dist; m.chargeDy = dy / dist;
        }
        if (m.type === 'ogre' && dist < 60 && m.stateT <= 0 && !hero.dead) { m.state = 'smashWind'; m.stateT = 0.6; }
      } else if (m.state === 'windup') {
        if (m.stateT <= 0) { m.state = 'charge'; m.stateT = 0.45; }
      } else if (m.state === 'charge') {
        m.x += m.chargeDx * 380 * slowMul * dt; m.y += m.chargeDy * 380 * slowMul * dt;
        m.walkT += dt * 18;
        if (m.stateT <= 0) { m.state = 'walk'; m.stateT = 1.2 + Math.random(); }
      } else if (m.state === 'smashWind') {
        if (m.stateT <= 0) {
          shockwaves.push({ x: m.x, y: m.y, r: 10, maxR: 90, hit: false, dmg: m.dmg });
          sfx('slam'); shake(5); burst(m.x, m.y, '#a98', 12, 120, 3, 100);
          m.state = 'walk'; m.stateT = 1.5; m.fireT = FIRE_T;
        }
      }
    } else if (m.type === 'goblin') {
      const wob = Math.sin(m.walkT * 0.6) * 0.6;      // zig-zag rush
      m.x += (dx / dist - dy / dist * wob) * spd * dt;
      m.y += (dy / dist + dx / dist * wob) * spd * dt;
      m.facing = Math.sign(dx) || m.facing; m.walkT += dt * stepRate(spd, 8.5 * 0.9);
    } else if (m.type === 'slime') {
      if (m.state === 'walk' && m.stateT <= 0 && !hero.dead) { m.state = 'crouch'; m.stateT = 0.28; }                              // it squats before it springs
      if (m.state === 'crouch' && m.stateT <= 0) { m.state = 'hop'; m.stateT = 0.5; m.chargeDx = dx / dist; m.chargeDy = dy / dist; }
      if (m.state === 'hop') {
        const p = 1 - m.stateT / 0.5;
        m.hopZ = Math.sin(p * Math.PI) * 22;
        m.x += m.chargeDx * 150 * slowMul * dt; m.y += m.chargeDy * 150 * slowMul * dt;
        if (m.stateT <= 0) { m.state = 'walk'; m.stateT = 0.5 + Math.random() * 0.6; m.hopZ = 0; m.land = 0.2; }
      }
      m.land = Math.max(0, (m.land || 0) - dt);
      m.facing = Math.sign(dx) || m.facing;
    } else if (m.type === 'archer') {
      const want = 230, dir = dist > want + 30 ? 1 : dist < want - 30 ? -1 : 0;   // keep distance, shoot arrows
      const aspd = Math.min(spd, dir < 0 ? ARCHER_BACKOFF : ARCHER_MAX_SPEED);       // however fast tier and Swift make it, it never outruns you for long
      m.x += (dx / dist) * aspd * dir * dt; m.y += (dy / dist) * aspd * dir * dt;
      m.x = Math.max(15, Math.min(WW - 15, m.x)); m.y = Math.max(50, Math.min(WH - 10, m.y));
      m.facing = Math.sign(dx) || m.facing;
      m.moving = !!dir;
      if (dir) m.walkT += dt * stepRate(aspd, 10.5 * 0.9);
      const onScreen = m.x > cam.x && m.x < cam.x + VW && m.y > cam.y && m.y < cam.y + VH + 40;
      if (m.state === 'walk' && m.stateT <= 0 && !hero.dead && onScreen) { m.state = 'aim'; m.stateT = 0.7; }
      if (m.state === 'aim' && m.stateT <= 0) {
        const sp = 300;
        projectiles.push({ x: m.x, y: m.y - 40, vx: dx / dist * sp, vy: dy / dist * sp, t: 3, dmg: m.dmg * fz, src: m });
        sfx('arrow');
        m.state = 'walk'; m.stateT = 1.6 + Math.random();
      }
    }

    const decay = Math.pow(0.85, dt * 60);           // frame-rate independent knockback
    m.x += m.knockX * dt; m.y += m.knockY * dt;
    m.knockX *= decay; m.knockY *= decay;
    if (dun) dunAfterMove(m, ox, oy, dt);                                          // round the walls, never through them

    if (!hero.dead && dist < m.r + 12 && (m.hopZ || 0) < 10 && m.spawnT < 0.2 && touchHurts(m)) {
      damageHero((m.state === 'charge' ? m.dmg * 2 + 5 : m.dmg) * fz, true, m);
    }
  }

  // sword hits (active in the middle of the swing)
  const sw = hero.sword, VAR = weaponVariant(sw, hero.attackVar);
  const KK = weaponKind(sw);
  if (KK.ranged && hero.attackT > 0 && hero.fireLeft) {                            // a bow or a staff: it looses its shots at the moments the variant says
    const pNow = 1 - hero.attackT / hero.attackDur;
    while (hero.fireLeft.length && pNow >= hero.fireLeft[0]) { hero.fireLeft.shift(); fireShots(VAR); }
  }
  if (!KK.ranged && hero.attackT > 0 && hero.rehitLeft && hero.rehitLeft.length && 1 - hero.attackT / hero.attackDur >= hero.rehitLeft[0]) { hero.rehitLeft.shift(); hero.hitSet.clear(); }      // a multi-hit blow lands again
  if (!KK.ranged && hero.attackT > 0 && hero.attackT < hero.attackDur * (1 - (hero.attackHitAt ?? sw.hitAt ?? 0.3))) {
    const pNow = 1 - hero.attackT / hero.attackDur, p0 = Math.max(hero.lastP ?? pNow, (hero.attackHitAt ?? sw.hitAt ?? 0.3) - 0.02), shapes = [];
    for (let k = 1; k <= 6; k++) shapes.push(...weaponShapes(p0 + (pNow - p0) * k / 6));           // the weapon's path since the last frame
    hero.lastP = pNow;
    for (const m of enemies) {
      if (hero.hitSet.has(m) || m.untouchable) continue;                          // underground and under water nothing can be hit
      const dx = m.x - hero.x, dy = m.y - hero.y;
      const dist = Math.hypot(dx, dy);
      // what a swing reaches: the arc in front of you (a little past your shoulder counts as in front), and your whole body.
      // Anything close enough to hurt you (contact is m.r + 12) is always close enough to hit, on whichever side it stands.
      // what the weapon touches is hit (in the same lane, give or take); an enemy right against the hero's body is hit too, so nothing standing on you can be missed
      const hitByWeapon = Math.abs(dy) <= 40 + m.r * 0.5 && shapesHit(m, shapes), touching = dist < m.r + 10;
      if (hitByWeapon || touching) {
        hero.hitSet.add(m);
        const crit = Math.random() < critChance() + (sw.critBonus || 0), dmg = dev.oneHit ? Math.max(1, Math.ceil(m.hp)) : Math.max(1, Math.round(swordDmg() * (hero.atkMul || 1) * (crit ? critMult() : 1) * (1 - (m.armor || 0))));
        const hpBefore = m.hp; m.hp -= dmg; if (m.state === 'bones') m.hp = 0; if (m.type === 'bogLurker') m.hits = (m.hits | 0) + 1;       // a heap of bones that is hit is finished for good
        if (gearHas('lifesteal')) hero.hp = Math.min(hero.maxHp, hero.hp + Math.min(dmg, hpBefore) * 0.04);
        if (sw.lifesteal) hero.hp = Math.min(hero.maxHp, hero.hp + Math.min(dmg, hpBefore) * sw.lifesteal);
        m.flashT = 0.15; mobHurt(m);
        m.knockX = m.noKnock ? 0 : (Math.sign(dx) || hero.facing) * (m.type === 'boss' ? 120 : m.type === 'ogre' ? 200 : 500);          // away from you, never through you
        if ((sw.pull || VAR.pull) && !m.noKnock && m.type !== 'boss' && dist > m.r + 30) m.knockX = -(Math.sign(dx) || hero.facing) * 260;            // the lash drags it in, but never past you
        if (sw.burn) m.burnT = 3;
        applyWeaponFx(m, hero.equip.weapon, dx);
        if (sw.slow) m.slowT = 2.5;
        if (sw.stun) { m.slowT = Math.max(m.slowT || 0, sw.stun); if (m.state === 'windup' && m.type !== 'boss') { m.state = 'walk'; m.stateT = sw.stun; } shake(5); }
        if (m.state === 'windup' && m.type !== 'boss') { m.state = 'walk'; m.stateT = 0.8; } // interrupt
        popups.push({ text: crit ? `${dmg}!` : `${dmg}`, x: m.x, y: m.y - 80, t: 0.7, color: crit ? '#f80' : '#ff0', pop: 0, crit });
        burst(m.x, m.y - 35, crit ? '#fc6' : sw.color, crit ? 16 : 8, 220, 2.2, 250, true);
        if (!settings.comfort) hitStop = crit ? 0.05 : 0.02; shake(crit ? 4 : 2); if (VAR.shake) shake(VAR.shake);
        sfx(crit ? 'crit' : m.type === 'slime' ? 'squish' : VAR.hit || weaponKind(sw).hit);
        sigHit(sw, m, dmg, Math.sign(dx) || hero.facing);
      }
    }
  }
  updateHeroShots(dt);

  rebuildSkeletons();
  const dead = enemies.filter(m => m.hp <= 0);
  enemies = enemies.filter(m => m.hp > 0);
  for (const m of dead) onKill(m);
}

function onKill(m) {
  corpses.push({ ...m, dieT: 0, dieMax: deathTime(m), fid: null });
  burst(m.x, m.y - 30, TYPES[m.type]?.color || '#fff', 14, 180, 3, 250);
  if (m.leader) leaderFell(m);
  if ((m.type === 'slime' || m.type === 'magmaslime') && m.size === 1) {        // big slimes split
    for (const s of [-1, 1]) spawnEnemy(m.type, { x: m.x + s * 15, y: m.y }, { size: 0.6, r: 10, hp: 18, maxHp: 18, xp: 5, spawnT: 0 });
  }
  const dropMul = D().drop;
  if (m.type === 'boss') {
    boss = null;
    sfx('boom'); setTimeout(() => sfx('victory'), 700);
    shake(16); flashScreen(0.4);
    for (let i = 0; i < 5; i++) setTimeout(() => burst(m.x + (Math.random() - 0.5) * 80, m.y - 40 - Math.random() * 60, '#fa4', 20, 260, 3, 100, true), i * 200);
    popups.push({ text: 'BOSS DEFEATED!', x: VW / 2, y: 150, t: 2.5, big: true, screen: true, color: '#fd4' });
    for (let i = 0; i < 3; i++) dropItem('star', m.x + (i - 1) * 30, m.y);
    dropItem('potion', m.x, m.y + 25);
    dropItem('big', m.x, m.y - 25);
    shockwaves = []; clearHazards();
    Sound.music(BIOMES[zone % BIOMES.length].music);
  } else {
    sfx('kill');
    if (m.elite) { popups.push({ text: `${m.name} slain`, x: m.x, y: m.y - 110, t: 1.4, color: '#ffd24a' }); dropItem('potion', m.x - 18, m.y + 12); }
    const r = Math.random() / dropMul;
    if (r < 0.03) dropItem('star', m.x, m.y);
    else if (r < 0.2) dropItem('potion', m.x, m.y);
    else if (r < 0.35) dropItem('energy', m.x, m.y);
    else if (r < 0.45) dropItem('gem', m.x, m.y);
  }
  // gold: every kill drops a coin that's worth more in later waves; a boss showers coins
  if (m.type === 'boss') {
    const total = (GOLD_BOSS_BASE + wave * GOLD_BOSS_PER_WAVE) * (1 + gearStat('gold')) * rbGoldMul();
    for (let i = 0; i < 6; i++) dropItem('gold', m.x + Math.cos(i * 1.05) * 44, m.y + Math.sin(i * 1.05) * 26, { amount: Math.round(total / 6) });
  } else {
    const base = (GOLD_BASE + wave * GOLD_PER_WAVE) * (1 + gearStat('gold')) * rbGoldMul() * (TYPES[m.type]?.gold ?? 1) * (m.elite ? ELITE_GOLD : 1) * ((m.size ?? 1) < 1 ? 0.4 : 1) * (0.7 + Math.random() * 0.6);
    dropItem('gold', m.x + (Math.random() - 0.5) * 22, m.y + (Math.random() - 0.5) * 12, { amount: Math.max(1, Math.round(base)) });
  }
  for (const it of gearDropsFor(m)) dropGear(it, m.x + (Math.random() - 0.5) * 50, m.y + 10 + Math.random() * 22);
  for (const k of essenceDropsFor(m)) dropItem('essence', m.x + (Math.random() - 0.5) * 44, m.y + 12 + Math.random() * 18, { ess: k, t: 40 });
  for (const k of runeDropsFor(m)) dropItem('rune', m.x + (Math.random() - 0.5) * 44, m.y + 12 + Math.random() * 18, { rune: k, t: 40 });
  questEvent('kill', m);
  gainXp(m.xp, m);
}

// --- Drops ---
const DROPS = {
  potion: { color: '#e33', label: 'Potion' },
  energy: { color: '#5d5', label: 'Energy' },
  gem:    { color: '#8cf', label: 'XP Gem' },
  star:   { color: '#fd4', label: '+1 Stat Point' },
  big:    { color: '#f6c', label: 'Mega Potion' },
  gold:   { color: '#f5c451', label: 'Gold' },
  gear:   { color: '#fff', label: 'Gear' },
  rune:   { color: '#c9b0ff', label: 'Rune' },
  essence: { color: '#ffcf8a', label: 'Essence' },
};
function dropItem(kind, x, y, extra = {}) {
  if (kind === 'gear' && !extra.item) extra = { ...extra, item: rollItem({ tier: depthOf(), level: hero.level }) };
  drops.push({ kind, x: Math.max(20, Math.min(WW - 20, x)), y: Math.max(60, Math.min(WH - 15, y)),
    t: kind === 'gold' ? 30 : 15, bob: Math.random() * 6, pop: 0.4, amount: kind === 'gold' ? 10 : 0, ...extra });
}
function updateDrops(dt) {
  for (const d of drops) {
    d.t -= dt; d.bob += dt * 4; d.pop = Math.max(0, d.pop - dt); if (d.warnT > 0) d.warnT -= dt;
    const dist = Math.hypot(hero.x - d.x, hero.y - 10 - d.y);
    if (hero.dead) continue;
    const mm = gearHas('magnet') ? 1.8 : 1, mag = (d.kind === 'gold' ? 120 : 70) * mm, pull = (d.kind === 'gold' ? 240 : 120) * mm;     // coins are pulled in from further away
    if (dist < mag && dist > 28) { d.x += (hero.x - d.x) / dist * pull * dt; d.y += (hero.y - 10 - d.y) / dist * pull * dt; }  // magnet
    if (dist > 28) continue;
    if (d.kind === 'gear' && !pickUpGear(d)) continue;          // full backpack: it stays on the ground
    if (d.kind === 'gear') questEvent('gear');
    d.t = 0;
    burst(d.x, d.y, d.kind === 'gear' ? RARITIES[d.item.rarity].color : DROPS[d.kind].color, 10, 120, 2, -50, true);
    const lbl = DROPS[d.kind].label;
    if (d.kind === 'potion') { const h = Math.round(hero.maxHp * 0.3); hero.hp = Math.min(hero.maxHp, hero.hp + h); sfx('potion'); popups.push({ text: `+${h} HP`, x: d.x, y: d.y - 30, t: 1, color: '#f77' }); }
    if (d.kind === 'big') { hero.hp = hero.maxHp; hero.stamina = maxStamina(); sfx('potion'); popups.push({ text: 'Fully healed!', x: d.x, y: d.y - 30, t: 1, color: '#f6c' }); }
    if (d.kind === 'energy') { hero.stamina = maxStamina(); sfx('pickup'); popups.push({ text: 'Stamina!', x: d.x, y: d.y - 30, t: 1, color: '#5d5' }); }
    if (d.kind === 'gem') { sfx('pickup'); gainXp(Math.round((15 + wave * 4) * D().xp), d); }
    if (d.kind === 'essence') { addEss(d.ess); sfx('sparkle'); popups.push({ text: ESS[d.ess].title, x: d.x, y: d.y - 30, t: 1.6, color: ESS[d.ess].color }); }
    if (d.kind === 'rune') { addRune(d.rune); sfx('sparkle'); popups.push({ text: RUNES[d.rune].title, x: d.x, y: d.y - 30, t: 1.6, color: RUNES[d.rune].tier > 1 ? RUNES[d.rune].tc : RUNES[d.rune].color }); }
    if (d.kind === 'gold') { questEvent('gold', d.amount); hero.gold += d.amount; hero.goldPulse = 0.5; sfx('coin'); popups.push({ text: `+${d.amount}`, x: d.x, y: d.y - 24, t: 0.8, color: '#f5c451' }); }
    if (d.kind === 'star') { hero.points++; sfx('unlock'); popups.push({ text: lbl, x: d.x, y: d.y - 30, t: 1.2, color: '#fd4' }); }
  }
  drops = drops.filter(d => d.t > 0);
}

function updateProjectiles(dt) {
  for (const p of projectiles) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.t -= dt;
    if (Math.hypot(p.x - hero.x, p.y - (hero.y - 35)) < 18 && !invulnerable() && !hero.dead) { damageHero(p.dmg, true, p.src); if (p.ail && !hero.dead) projAil(p.ail); p.t = 0; }
    if (hero.attackT > 0 && Math.hypot(p.x - hero.x, p.y - hero.y + 35) < hero.sword.range) {   // swing deflects arrows
      p.t = 0; sfx('click'); burst(p.x, p.y, '#fff', 6, 150, 1.5, 0, true);
    }
  }
  projectiles = projectiles.filter(p => p.t > 0 && p.x > -50 && p.x < WW + 50 && p.y > -50 && p.y < WH + 50);

  for (const s of shockwaves) {
    s.r += 260 * dt;
    const d = Math.hypot(hero.x - s.x, (hero.y - s.y) * 1.6);
    if (!s.hit && Math.abs(d - s.r) < 16 && !invulnerable() && !hero.dead) { s.hit = true; damageHero(s.dmg); if (s.chill && !hero.dead) { hero.chillT = 2.5; popups.push({ text: 'Chilled', x: hero.x, y: hero.y - 90, t: 0.9, color: '#9fe3ff' }); sfx('chill'); } }
  }
  shockwaves = shockwaves.filter(s => s.r < s.maxR);
  updateHazards(dt);
}

// XP to get from this level to the next: a smooth curve (was x1.4 a level, which raced through the early levels and stalled near the cap)
const xpNeed = lv => Math.round(55 + 16 * lv * lv);
function gainXp(n, m) {
  if (hero.level >= levelCap()) { hero.xp = 0; return; }   // nothing past the cap; the shrine is the way on (the level-up message and the purple ring around the level say so once)
  n = Math.max(1, Math.round(n * rbXpMul()));
  hero.xp += n;
  while (hero.xp >= hero.xpNext && hero.level < levelCap()) {
    hero.xp -= hero.xpNext;
    hero.level++;
    hero.xpNext = xpNeed(hero.level);
    hero.points += pointsPerLevel();
    hero.hp = hero.maxHp;
    hero.stamina = maxStamina();
    hero.auraT = 1.2;
    popups.push({ text: hero.level >= levelCap() ? `MAX LEVEL ${hero.level}! The shrine awaits` : `LEVEL UP! +${pointsPerLevel()} points (${keyLabel('character')})`, x: VW / 2, y: 230, t: 1.8, color: '#fd4', big: true, screen: true });
    burst(hero.x, hero.y - 30, '#fd4', 30, 200, 2.5, -40, true);
    sfx('levelup');
  }
  if (hero.level >= levelCap()) hero.xp = 0;
}

function updateHero(dt) {
  if (hero.dead) { hero.deadT += dt; return; }
  hero.flipCd = Math.max(0, hero.flipCd - dt);
  hero.potionCd = Math.max(0, (hero.potionCd || 0) - dt);
  hero.comboT = Math.max(0, (hero.comboT || 0) - dt); if (hero.comboT <= 0 && hero.attackT <= 0) hero.combo = 0;      // the weapon's combo starts over after a pause
  if (state === 'play' && hero.hp / hero.maxHp < 0.3 && (hero.hbT = (hero.hbT || 0) - dt) <= 0) { hero.hbT = 0.95; sfx('heartbeat'); }   // a heartbeat when close to death
  hero.hurtT = Math.max(0, hero.hurtT - dt);
  hero.dodgeT = Math.max(0, (hero.dodgeT || 0) - dt);
  hero.capT = Math.max(0, (hero.capT || 0) - dt);
  hero.auraT = Math.max(0, hero.auraT - dt);
  hero.chillT = Math.max(0, (hero.chillT || 0) - dt);
  tickRecall(dt);
  if (hero.poison && tickPoison(dt)) { killHero(); return; }
  if (tickAilments(dt)) { killHero(); return; }
  if (hero.attackT > 0) hero.attackT -= dt;
  hero.regenT = Math.max(0, hero.regenT - dt);
  // health slowly returns when you haven't been hit for a while
  hero.hpRegenT = Math.max(0, (hero.hpRegenT ?? 0) - dt);
  hero.goldPulse = Math.max(0, (hero.goldPulse || 0) - dt * 2);
  if (hero.hpRegenT <= 0 && hero.hp < hero.maxHp * regenCap()) {
    hero.hp = Math.min(hero.maxHp * regenCap(), hero.hp + hero.maxHp * HP_REGEN_RATE * (hero.moving ? HP_REGEN_MOVE : 1) * (gearHas('vigor') ? 2.5 : 1) * dt);
    if (gfx.particles && Math.random() < dt * 3) particles.push({ x: hero.x + (Math.random() - 0.5) * 18, y: hero.y - 20 - Math.random() * 30, vx: 0, vy: -26, life: 0.6, max: 0.6, size: 2, color: '#7fd08a', add: true });
  }
  if (hero.flipT <= 0 && hero.attackT <= 0 && hero.regenT <= 0) hero.stamina = Math.min(maxStamina(), hero.stamina + staminaRegen() * (hero.moving ? STAMINA_REGEN_MOVE : 1) * dt);
  if (dev.stamina) hero.stamina = maxStamina();

  if (hero.flipT > 0) {
    hero.flipT -= dt;
    hero.x += hero.flipDx * FLIP_SPEED * dt;
    hero.y += hero.flipDy * FLIP_SPEED * dt;
    if (hero.flipDx) hero.facing = Math.sign(hero.flipDx);
    if (hero.flipT <= 0) burst(hero.x, hero.y, '#d8cfb0', 6, 70, 3, -20);   // landing dust
  } else {
    let dx = 0, dy = 0;
    if (held('left')) dx--;
    if (held('right')) dx++;
    if (held('up')) dy--;
    if (held('down')) dy++;
    hero.moving = !!(dx || dy);
    if (hero.moving) {
      const len = Math.hypot(dx, dy);
      const spd = moveSpeed() * (hero.inWater ? 0.7 : 1);
      hero.x += (dx / len) * spd * dt;
      hero.y += (dy / len) * spd * dt;
      if (dx) hero.facing = Math.sign(dx);
      hero.walkT += dt * stepRate(moveSpeed(), HERO_STRIDE);
      hero.stepT -= dt;
      if (hero.stepT <= 0) {
        hero.stepT = 0.31;
        if (gfx.anim) burst(hero.x - hero.facing * 6, hero.y, world.B.patch2, 3, 30, 2.5, -10);
        Sound.step(surfaceAt(hero.x, hero.y));
      }
    } else hero.walkT = 0;
  }
  hero.x = Math.max(20, Math.min(WW - 20, hero.x));
  hero.y = Math.max(50, Math.min(WH - 10, hero.y));
  if (dun) dunPush(hero, 11);
  const wet = !!waterAt(hero.x, hero.y);                  // wading: slower, with splashes
  if (wet !== !!hero.inWater) { hero.inWater = wet; burst(hero.x, hero.y, '#bfe4f4', 12, 130, 2.2, 260); sfx('splash'); }

  // lava burns (unless mid-flip)
  if (!dun && world.lava.length && hero.flipT <= 0 && world.lava.some(l => ((hero.x - l.x) / l.rx) ** 2 + ((hero.y - l.y) / l.ry) ** 2 < 1)) {
    if (!invulnerable()) { sfx('lava'); damageHero(Math.round(6 * D().dmg), false); }
  }

  // scarf: a simple rope that trails behind the neck
  const neck = { x: hero.x - hero.facing * 2, y: hero.y - 46 };
  const sc = hero.scarf;
  sc[0].x = neck.x; sc[0].y = neck.y;
  for (let i = 1; i < sc.length; i++) {
    const p = sc[i], q = sc[i - 1];
    p.x += (-hero.facing * 40 + Math.sin(tAnim * 6 + i) * 18) * dt;
    p.y += (25 + Math.cos(tAnim * 5 + i) * 10) * dt;
    const ddx = p.x - q.x, ddy = p.y - q.y, dl = Math.hypot(ddx, ddy) || 1;
    p.x = q.x + ddx / dl * 5; p.y = q.y + ddy / dl * 5;
  }
}

function updateCamera(dt) {
  const tx = Math.max(0, Math.min(WW - VW, hero.x - VW / 2));
  const ty = Math.max(0, Math.min(WH - VH, hero.y - VH / 2 - 20));
  const k = 1 - Math.exp(-dt * 7);
  cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
  cam.shake = Math.max(0, cam.shake - dt * 30);
}

// what the world sounds like: biome calls, wind and rain follow the weather system
let sceneT = 0;
function updateSoundScene(dt) {
  sceneT -= dt; if (sceneT > 0 || !world || dun) return; sceneT = 0.25;
  const p = weatherPower(), a = WEATHER[weather.kind], b = WEATHER[weather.next];
  const rainOf = w => w.fx === 'rain' ? 0.09 * (w.dens || 1) : w.fx === 'hail' ? 0.1 : 0;
  const pitchOf = w => w.fx === 'sand' ? 1100 : (w.fx === 'snow' && w.fall) ? 700 : 450;
  Sound.setScene({ biome: world.B.ambience, night: night01() > 0.5, wind: clampN(0.035 + windMul() * 0.05, 0, 0.3),
    rain: rainOf(a) * (1 - p) + rainOf(b) * p, pitch: pitchOf(a) * (1 - p) + pitchOf(b) * p });
}

function update(dt) {
  if (state === 'play' || state === 'village') { const nf = night01(); if (nf > 0.65) Sound.setNight(true); else if (nf < 0.4) Sound.setNight(false); }      // with some slack, so the music cannot flip back and forth at dusk
  dt *= dev.speed;
  tAnim += dt;
  if (!dev.freezeTime) updateSky(dt, zone);
  playTime += dt;
  flash = Math.max(0, flash - dt);
  if (hitStop > 0) { hitStop -= dt; updateParticles(dt); return; }   // freeze-frame on hit
  updateHero(dt);
  updateWaves(dt);
  updateDungeon(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updateDrops(dt);
  updateParticles(dt);
  updateCritters(dt);
  updateDarkEyes(dt);
  updateSoundScene(dt);
  updateCamera(dt);
  for (const c of corpses) deathTick(c, dt);
  corpses = corpses.filter(c => c.dieT < c.dieMax);
  for (const p of popups) { p.t -= dt; if (p.pop !== undefined) p.pop += dt; if (!p.big && !p.screen) p.y -= 30 * dt; }
  popups = popups.filter(p => p.t > 0);
}

// ================== Drawing ==================
function line(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function drawShadow(x, y, rx, a = 0.25) {
  if (!gfx.shadows) return;
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.beginPath(); ctx.ellipse(x, y, rx, rx * 0.3, 0, 0, Math.PI * 2); ctx.fill();
}
const inView = (x, y, m = 80) => x > cam.x - m && x < cam.x + VW + m && y > cam.y - m && y < cam.y + VH + m * 2;

const HERO_STRIDE = 14;
// phase speed that makes a planted foot move exactly with the ground (no foot sliding)
const stepRate = (speed, stride) => speed * Math.PI / (2 * stride);
// --- Stick figure rig: feet/hands are placed, knees/elbows solved with two-bone IK ---
// bend = +1/-1 picks which side the joint bows to (canvas y points down).
function ik(ax, ay, bx, by, l1, l2, bend) {
  let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 0.001;
  const maxD = l1 + l2 - 0.01;
  if (d > maxD) { dx *= maxD / d; dy *= maxD / d; d = maxD; }
  const a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const t = Math.atan2(dy, dx) + bend * a;
  return { j: { x: ax + Math.cos(t) * l1, y: ay + Math.sin(t) * l1 }, e: { x: ax + dx, y: ay + dy } };
}
function poly(...pts) { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke(); }

// Walk/run cycle for one leg. q = phase: 0..PI the foot is planted and slides back under the body,
// PI..2PI it lifts and swings forward. Knees always bow toward the facing direction.
function footAt(x, groundY, f, q, stride, lift) {
  return { x: x + f * stride * Math.cos(q), y: groundY - lift * Math.max(0, -Math.sin(q)) };
}
function drawLegs(x, hipY, groundY, f, p, moving, L, stride = L * 0.9, spread = 0) {
  const feet = moving
    ? [footAt(x, groundY, f, p, stride, L * 0.6), footAt(x, groundY, f, p + Math.PI, stride, L * 0.6)]
    : [{ x: x + f * L * 0.45, y: groundY }, { x: x - f * L * 0.35, y: groundY }];
  feet.forEach((ft, i) => {
    const hx = x + (i ? spread : -spread) / 2;
    const k = ik(hx, hipY, ft.x + (i ? spread : -spread) / 2, ft.y, L, L, -f);
    poly({ x: hx, y: hipY }, k.j, k.e);
  });
}

// --- Weapon kinds: how each weapon is held, swung, drawn and heard ---
// Every kind has 3 to 5 attack variants that play as a combo: an attack made soon after the last one plays the next variant, and the chain starts over after a pause.
// A variant's swing(t) (t = 0..1 through the attack) gives the weapon hand's direction `ang` from the shoulder (0 = straight ahead, negative = up) and its reach `r`
// (the arm is 19 long), `blade` (the weapon's direction), `lunge` (px the whole body steps forward), `lean`, and `back` ({ ang, r, blade }: where the free hand, or the second dagger, goes).
// Variant fields: n name, t time, dmg damage, cost stamina (multipliers), hitAt when the blow can land (0..1), pull drags enemies in, rehit times (0..1) at which
// the blow can land again, trail ('thrust' | { a0, ccw, from, about, spin }), sfx / hit sounds, sfxAt when the swing sound plays, shake extra screen shake.
// What a blow hits is decided by where the weapon really is (see weaponShapes); `reach` and `back` on a variant are only notes about what it does.
// Kind fields: idle / run the carried blade angles, two = both hands on the shaft, twin = a weapon in each hand.
const lerp = (a, b, x) => a + (b - a) * x;      // clamp01 lives further down
const easeOut = x => 1 - Math.pow(1 - x, 3), easeInOut = x => x * x * (3 - 2 * x), pulse = x => Math.sin(clamp01(x) * Math.PI);
const wrapPI = d => d - 2 * Math.PI * Math.round(d / (2 * Math.PI));          // the shortest way round between two angles
const REST = 0.6;                                                              // where the hand starts a swing from
// windup (the hand goes REST -> aw), then the strike (aw -> ae). pw > 0 makes the strike accelerate (heavy), sf is the share of the strike spent moving,
// bo the weapon's angle relative to the arm, lw / ls the lean at the end of the windup / strike, lb a lean that bows with the swing, lg a lunge.
const strike = ({ wf = 0.25, aw, ae, r = 16, bo = -0.3, pw = 0, sf = 1, lb = 0, lg = 0, lw = 0, ls = 0 }) => t => {
  if (t < wf) { const x = easeInOut(t / wf), ang = lerp(REST, aw, x); return { ang, r, blade: ang + bo, lean: lw * x }; }
  const x = (t - wf) / (1 - wf), u = clamp01(x / sf), e = pw ? Math.pow(u, pw) : easeOut(u), ang = lerp(aw, ae, e);
  return { ang, r, blade: ang + bo, lunge: lg * pulse(x), lean: lb * Math.sin(Math.PI * t) + lerp(lw, ls, e) };
};
// pull back, then drive the point forward
const thrust = ({ pull = 0.3, r0 = 7, r1 = 19, ang = 0.05, bl = -0.03, lg = 9, ls = 0.08, hold = 0.4 }) => t => {
  if (t < pull) { const x = easeInOut(t / pull); return { ang, r: lerp(16, r0, x), blade: bl, lunge: -2 * x, lean: -0.04 * x }; }
  const x = (t - pull) / (1 - pull), e = x < hold ? easeOut(x / hold) : 1 - 0.7 * easeInOut((x - hold) / (1 - hold));
  return { ang, r: lerp(r0, r1, e), blade: bl, lunge: lerp(-2, lg, e), lean: ls * e };
};
// several quick jabs in one attack
const jabs = ({ n = 2, pull = 0.22, r0 = 8, r1 = 19, ang = 0.05, bl = 0, lg = 6 }) => t => {
  if (t < pull) { const x = easeInOut(t / pull); return { ang, r: lerp(16, r0, x), blade: bl, lunge: -2 * x }; }
  const p = (t - pull) / (1 - pull) * n, f = p - Math.floor(Math.min(p, n - 1e-6)), e = f < 0.4 ? easeOut(f / 0.4) : 1 - easeInOut((f - 0.4) / 0.6);
  return { ang, r: lerp(r0, r1, e), blade: bl, lunge: lerp(-1, lg, e), lean: 0.06 * e };
};
// a full turn on the spot: the weapon circles the hero
const spin = ({ wf = 0.18, aw = -0.5, turns = 1, r = 16, bo = -0.3, lb = 0.12 }) => t => {
  if (t < wf) { const x = easeInOut(t / wf), ang = lerp(REST, aw, x); return { ang, r, blade: ang + bo, lean: -0.1 * x }; }
  const x = (t - wf) / (1 - wf), ang = aw - 2 * Math.PI * turns * easeInOut(x);
  return { ang, r: r - 3 * pulse(x), blade: ang + bo, lunge: 3 * pulse(x), lean: lb * pulse(x) };
};
// a cut across the body: the hand stays near the chest and the weapon turns from b0 to b1 (seen from the side, a horizontal slash)
const sweepBlade = ({ wf = 0.28, b0 = -2.9, b1 = -0.1, ang = 0.1, r0 = 9, r1 = 15, lg = 4 }) => t => {
  if (t < wf) { const x = easeInOut(t / wf); return { ang: lerp(REST, ang, x), r: lerp(16, r0, x), blade: lerp(REST - 0.3, b0, x), lean: -0.08 * x }; }
  const x = (t - wf) / (1 - wf), e = easeOut(x);
  return { ang, r: lerp(r0, r1, e), blade: lerp(b0, b1, e), lunge: lg * pulse(x), lean: lerp(-0.08, 0.1, e) };
};
const withBack = (fn, back) => t => ({ ...fn(t), back });                                          // a fixed guard hand
const mirrored = (fn, da = 0.25) => t => { const s = fn(t); return { ...s, back: { ang: s.ang + da, r: Math.max(6, s.r - 1), blade: s.blade + da } }; };      // the second weapon follows the first
const opposed = fn => t => { const s = fn(t); return { ...s, back: { ang: s.ang + Math.PI, r: s.r, blade: s.blade + Math.PI } }; };                               // the second weapon on the other side of the circle
const V = (n, swing, o = {}) => ({ n, swing, t: 1, dmg: 1, reach: 1, cost: 1, ...o });
const arc = (a0, ccw, from) => ({ a0, ccw, from });

const WEAPON_KINDS = {
  sword: {
    idle: 0.35, run: 0.15, sfx: 'swing', hit: 'hitMetal',
    variants: [
      V('Slash', strike({ wf: 0.22, aw: -2.4, ae: 1.0, lb: 0.18 }), { hitAt: 0.3, trail: arc(-2.7, false, 0.22) }),
      V('Rising cut', strike({ wf: 0.2, aw: 1.1, ae: -2.0, bo: -0.2, lb: 0.1 }), { t: 0.95, hitAt: 0.3, trail: arc(1.1, true, 0.2), sfx: 'swingKatana' }),
      V('Thrust', thrust({ pull: 0.3, r0: 8, r1: 19, bl: -0.02, lg: 10 }), { t: 0.85, dmg: 0.9, reach: 1.2, hitAt: 0.4, trail: 'thrust', sfx: 'swingRapier', hit: 'hitPierce' }),
      V('Whirlwind', spin({ wf: 0.18, aw: -0.5 }), { t: 1.5, dmg: 1.25, cost: 1.5, back: true, hitAt: 0.3, rehit: [0.62], trail: { a0: -0.5, ccw: true, from: 0.2, spin: true }, sfx: 'swingWhirl', shake: 1 }),
    ],
  },
  great: {
    idle: 0.5, run: 0.35, two: true, sfx: 'swingAxe', hit: 'hitHeavy',
    variants: [
      V('Cleave', strike({ wf: 0.4, aw: -2.5, ae: 1.3, pw: 1.5, bo: -0.25, sf: 0.6, lw: -0.12, ls: 0.2, lg: 5 }), { hitAt: 0.62, trail: arc(-2.6, false, 0.4), sfxAt: 0.4 }),
      V('Wide sweep', strike({ wf: 0.35, aw: 2.8, ae: -0.3, bo: -0.15, r: 17, lb: 0.15 }), { t: 1.05, dmg: 1.05, back: true, hitAt: 0.5, trail: arc(2.8, true, 0.35), sfx: 'swingScythe', sfxAt: 0.35 }),
      V('Rising wave', strike({ wf: 0.3, aw: 1.2, ae: -2.2, pw: 1.3, sf: 0.7, bo: -0.2 }), { t: 0.95, hitAt: 0.45, trail: arc(1.2, true, 0.3), sfxAt: 0.3 }),
      V('Impale', thrust({ pull: 0.4, r0: 6, r1: 19, lg: 12, bl: -0.03 }), { t: 0.9, dmg: 1.15, reach: 1.2, hitAt: 0.55, trail: 'thrust', sfx: 'swingSpear', hit: 'hitPierce' }),
      V('Great whirl', spin({ wf: 0.2, aw: -0.6, turns: 1, lb: 0.15 }), { t: 1.45, dmg: 1.4, cost: 1.5, back: true, hitAt: 0.35, rehit: [0.66], trail: { a0: -0.6, ccw: true, from: 0.22, spin: true }, sfx: 'swingWhirl', shake: 2 }),
    ],
  },
  dagger: {
    idle: 0.5, run: 0.35, twin: true, sfx: 'swingRapier', hit: 'hitSlash',
    variants: [
      V('Flurry', t => { const a = pulse(t / 0.5), b = t < 0.45 ? 0 : pulse((t - 0.45) / 0.55); return { ang: 0.02, r: 8 + 9 * a, blade: 0, lunge: 4 * Math.max(a, b), lean: 0.06 * Math.max(a, b), back: { ang: 0.05, r: t < 0.45 ? 9 : 8 + 9 * b, blade: 0.05 } }; },
        { t: 0.9, dmg: 0.8, hitAt: 0.2, rehit: [0.55], trail: 'thrust', hit: 'hitPierce' }),
      V('Cross slash', t => {
        const wf = 0.25;
        if (t < wf) { const x = easeInOut(t / wf); return { ang: lerp(REST, -1.3, x), r: 14, blade: lerp(REST - 0.3, -1.5, x), lean: -0.06 * x, back: { ang: lerp(0.6, 1.1, x), r: 13, blade: lerp(0.4, 1.0, x) } }; }
        const x = (t - wf) / (1 - wf), e = easeOut(x), a = lerp(-1.3, 0.9, e), b = lerp(1.1, -0.9, e);
        return { ang: a, r: 15, blade: a - 0.2, lunge: 4 * pulse(x), lean: 0.08 * pulse(x), back: { ang: b, r: 15, blade: b - 0.2 } };
      }, { t: 1.1, dmg: 1.1, hitAt: 0.35, trail: arc(-1.4, false, 0.25) }),
      V('Double stab', mirrored(thrust({ pull: 0.28, r0: 8, r1: 18, lg: 10, bl: 0 }), 0.3), { t: 0.95, dmg: 1.0, reach: 1.15, hitAt: 0.4, trail: 'thrust', hit: 'hitPierce' }),
      V('Twirl', opposed(spin({ wf: 0.15, aw: -0.4, r: 15, bo: -0.2 })), { t: 1.35, dmg: 1.1, reach: 1.3, cost: 1.4, back: true, hitAt: 0.3, rehit: [0.62], trail: { a0: -0.4, ccw: true, from: 0.2, spin: true }, sfx: 'swingKatana' }),
    ],
  },
  spear: {
    idle: -0.5, run: -0.4, two: true, sfx: 'swingSpear', hit: 'hitPierce',
    variants: [
      V('Thrust', thrust({ pull: 0.3, r0: 7, r1: 19, bl: -0.03, lg: 9 }), { hitAt: 0.3, trail: 'thrust' }),
      V('Double thrust', jabs({ n: 2, pull: 0.24, r0: 8, r1: 19, bl: -0.02 }), { t: 1.25, dmg: 0.75, hitAt: 0.3, rehit: [0.62], trail: 'thrust' }),
      V('Rising thrust', thrust({ pull: 0.3, r0: 7, r1: 19, ang: -0.5, bl: -0.5, lg: 9, ls: 0.1 }), { t: 1.0, dmg: 1.05, hitAt: 0.32, trail: 'thrust' }),
      V('Low thrust', thrust({ pull: 0.34, r0: 7, r1: 19, ang: 0.45, bl: 0.4, lg: 11, ls: 0.14 }), { t: 1.05, dmg: 1.1, reach: 1.1, hitAt: 0.36, trail: 'thrust' }),
      V('Pole sweep', spin({ wf: 0.2, aw: 0.3, turns: 1, bo: 0, lb: 0.1 }), { t: 1.45, dmg: 1.1, cost: 1.4, back: true, hitAt: 0.3, rehit: [0.64], trail: { a0: 0.3, ccw: true, from: 0.22, spin: true }, sfx: 'swingWhirl' }),
    ],
  },
  rapier: {
    idle: 0.5, run: 0.3, sfx: 'swingRapier', hit: 'hitPierce',
    variants: [
      V('Lunge', thrust({ pull: 0.2, r0: 8, r1: 19, ang: 0, bl: -0.05, lg: 11, hold: 0.35 }), { hitAt: 0.3, trail: 'thrust' }),
      V('Flick', strike({ wf: 0.2, aw: -0.9, ae: 0.5, bo: -0.1, lb: 0.05 }), { t: 0.75, dmg: 0.8, hitAt: 0.3, trail: arc(-1.0, false, 0.2), hit: 'hitSlash', sfx: 'swingKatana' }),
      V('Riposte', t => {
        if (t < 0.3) { const x = easeInOut(t / 0.3); return { ang: lerp(REST, -0.5, x), r: 14, blade: lerp(REST - 0.3, -1.25, x), lunge: -5 * x, lean: -0.1 * x }; }           // a step back with the point raised
        const x = (t - 0.3) / 0.7, e = x < 0.35 ? easeOut(x / 0.35) : 1 - 0.7 * easeInOut((x - 0.35) / 0.65), k = easeOut(clamp01(x / 0.25));
        return { ang: lerp(-0.5, 0.0, k), r: lerp(14, 19, e), blade: lerp(-1.25, -0.05, k), lunge: lerp(-5, 12, e), lean: 0.1 * e };
      }, { t: 1.1, dmg: 1.2, reach: 1.2, hitAt: 0.45, trail: 'thrust' }),
      V('Triple thrust', jabs({ n: 3, pull: 0.2, r0: 9, r1: 19, ang: 0, bl: -0.04, lg: 7 }), { t: 1.5, dmg: 0.6, hitAt: 0.28, rehit: [0.5, 0.75], trail: 'thrust' }),
    ],
  },
  katana: {
    idle: -0.85, run: -0.7, two: true, sfx: 'swingKatana', hit: 'hitSlash',
    variants: [
      V('Draw cut', t => { const ang = t < 0.28 ? lerp(0.6, -2.7, easeInOut(t / 0.28)) : -2.7 + 4.0 * (1 - Math.pow(1 - (t - 0.28) / 0.72, 4)); return { ang, r: 16, blade: ang - 0.12, lunge: 4 * pulse((t - 0.2) / 0.8), lean: 0.05 }; }, { hitAt: 0.3, trail: arc(-2.8, false, 0.28) }),
      V('Rising cut', strike({ wf: 0.22, aw: 1.2, ae: -2.0, bo: -0.12, lb: 0.1 }), { t: 0.95, hitAt: 0.32, trail: arc(1.2, true, 0.22) }),
      V('Horizontal cut', sweepBlade({ wf: 0.28, b0: -2.9, b1: -0.1, ang: 0.1, r0: 9, r1: 15, lg: 5 }), { t: 0.9, dmg: 1.05, hitAt: 0.4, trail: { about: 'hand', a0: -2.9, ccw: false, from: 0.28 } }),
      V('Kesa cut', strike({ wf: 0.25, aw: -1.1, ae: 1.8, bo: -0.12, pw: 0, lb: 0.14, lg: 5 }), { t: 1.0, dmg: 1.1, hitAt: 0.35, trail: arc(-1.2, false, 0.25) }),
      V('Tsuki', thrust({ pull: 0.34, r0: 8, r1: 19, ang: 0.0, bl: -0.04, lg: 12, hold: 0.4 }), { t: 1.0, dmg: 1.15, reach: 1.22, hitAt: 0.45, trail: 'thrust', hit: 'hitPierce', sfx: 'swingRapier' }),
    ],
  },
  axe: {
    idle: 0.9, run: 0.7, two: true, sfx: 'swingAxe', sfxAt: 0.45, hit: 'hitHeavy',
    variants: [
      V('Overhead chop', strike({ wf: 0.4, aw: -2.5, ae: 1.3, pw: 1.5, bo: -0.25, sf: 0.5, lg: 5, lw: -0.12, ls: 0.2 }), { hitAt: 0.6, trail: arc(-2.6, false, 0.4) }),
      V('Side hew', strike({ wf: 0.38, aw: 2.7, ae: -0.1, bo: -0.2, pw: 1.2, sf: 0.7, lb: 0.14 }), { t: 1.0, dmg: 1.05, hitAt: 0.55, trail: arc(2.7, true, 0.38), sfx: 'swingScythe', sfxAt: 0.38 }),
      V('Upward chop', strike({ wf: 0.33, aw: 1.2, ae: -2.3, pw: 1.2, bo: -0.2, sf: 0.65 }), { t: 0.95, dmg: 1.0, hitAt: 0.5, trail: arc(1.2, true, 0.33), sfxAt: 0.33 }),
      V('Cyclone', spin({ wf: 0.2, aw: -0.6, turns: 1, lb: 0.14 }), { t: 1.5, dmg: 1.3, cost: 1.5, back: true, hitAt: 0.32, rehit: [0.66], trail: { a0: -0.6, ccw: true, from: 0.22, spin: true }, sfx: 'swingWhirl', shake: 2 }),
    ],
  },
  hammer: {
    idle: 1.1, run: 0.9, two: true, sfx: 'swingHammer', sfxAt: 0.68, hit: 'hitBlunt',
    variants: [
      V('Slam', strike({ wf: 0.5, aw: -2.6, ae: 1.45, pw: 1.5, bo: -0.1, sf: 0.6, lg: 4, lw: -0.18, ls: 0.26 }), { hitAt: 0.76, trail: arc(-2.7, false, 0.5) }),
      V('Wide swing', strike({ wf: 0.45, aw: 2.7, ae: 0.2, bo: -0.1, pw: 1.4, sf: 0.65, lb: 0.16, lw: -0.1 }), { t: 1.0, dmg: 1.0, reach: 1.05, back: true, hitAt: 0.68, trail: arc(2.7, true, 0.45), sfx: 'swingScythe', sfxAt: 0.55 }),
      V('Uppercut', strike({ wf: 0.4, aw: 1.3, ae: -2.4, pw: 1.3, bo: -0.15, sf: 0.65, lw: -0.08 }), { t: 0.95, dmg: 1.05, hitAt: 0.62, trail: arc(1.3, true, 0.4), sfxAt: 0.5 }),
      V('Quake', strike({ wf: 0.55, aw: -2.8, ae: 1.5, pw: 1.7, bo: -0.1, sf: 0.55, lg: 14, lw: -0.22, ls: 0.3 }), { t: 1.45, dmg: 1.45, reach: 1.3, cost: 1.5, back: true, hitAt: 0.82, shake: 7, hit: 'quake', trail: arc(-2.9, false, 0.55), sfxAt: 0.72 }),
    ],
  },
  scythe: {
    idle: 0.5, run: 0.4, two: true, sfx: 'swingScythe', sfxAt: 0.3, hit: 'hitSlash',
    variants: [
      V('Low sweep', strike({ wf: 0.3, aw: 2.9, ae: 0.1, bo: -0.2, lb: 0.1, lw: -0.1, ls: 0.14 }), { hitAt: 0.42, trail: arc(2.9, true, 0.3) }),
      V('Reap', strike({ wf: 0.3, aw: -2.6, ae: 1.2, bo: -0.25, pw: 1.1, sf: 0.8 }), { t: 1.0, dmg: 1.05, hitAt: 0.45, trail: arc(-2.7, false, 0.3) }),
      V('Hook and drag', t => { const p = clamp01(t), r = p < 0.4 ? lerp(14, 19, easeOut(p / 0.4)) : lerp(19, 7, easeInOut((p - 0.4) / 0.6)); return { ang: 0.35, r, blade: lerp(-0.6, 0.5, easeInOut(p)), lunge: 5 * pulse(p * 1.6), lean: 0.06 }; },
        { t: 1.05, dmg: 0.9, reach: 1.15, pull: true, hitAt: 0.35, trail: { about: 'hand', a0: -0.8, ccw: false, from: 0.3 } }),
      V('Soul whirl', spin({ wf: 0.2, aw: 0.3, turns: 1, lb: 0.1 }), { t: 1.45, dmg: 1.25, cost: 1.5, back: true, hitAt: 0.3, rehit: [0.64], trail: { a0: 0.3, ccw: true, from: 0.22, spin: true }, shake: 1, sfx: 'swingWhirl' }),
    ],
  },
  halberd: {
    idle: -0.6, run: -0.5, two: true, sfx: 'swingAxe', sfxAt: 0.4, hit: 'hitHeavy',
    variants: [
      V('Sweep', strike({ wf: 0.35, aw: -2.5, ae: 1.0, bo: -0.2, lg: 6, lw: -0.08, ls: 0.16 }), { hitAt: 0.4, trail: arc(-2.6, false, 0.35) }),
      V('Thrust', thrust({ pull: 0.34, r0: 7, r1: 19, lg: 8, bl: -0.03 }), { t: 0.95, dmg: 0.95, reach: 1.2, hitAt: 0.42, trail: 'thrust', hit: 'hitPierce', sfx: 'swingSpear', sfxAt: 0.34 }),
      V('Overhead', strike({ wf: 0.4, aw: -2.4, ae: 1.2, pw: 1.4, bo: -0.1, sf: 0.6, lw: -0.1, ls: 0.16 }), { t: 1.1, dmg: 1.2, hitAt: 0.6, trail: arc(-2.5, false, 0.4), shake: 2 }),
      V('Windmill', spin({ wf: 0.2, aw: 0.2, turns: 1, bo: -0.1, lb: 0.1 }), { t: 1.5, dmg: 1.2, cost: 1.5, back: true, hitAt: 0.32, rehit: [0.66], trail: { a0: 0.2, ccw: true, from: 0.22, spin: true }, sfx: 'swingWhirl' }),
    ],
  },
  whip: {
    idle: 1.1, run: 0.9, sfx: 'swingWhip', hit: 'hitWhip',
    variants: [
      V('Overhand crack', strike({ wf: 0.3, aw: -2.2, ae: 0.25, bo: -0.2 }), { hitAt: 0.34, aim: 0.05, cr: [0.45] }),
      V('Sidearm lash', sweepBlade({ wf: 0.28, b0: -2.4, b1: -0.2, ang: 0.0, r0: 9, r1: 14, lg: 3 }), { t: 1.0, dmg: 1.0, hitAt: 0.36, aim: 0.0, cr: [0.5] }),
      V('Downward snap', strike({ wf: 0.3, aw: -2.0, ae: 0.7, bo: -0.2, pw: 1.2 }), { t: 0.95, dmg: 1.1, hitAt: 0.38, aim: 0.9, cr: [0.5] }),
      V('Double crack', t => {
        const a = t < 0.18 ? lerp(REST, -1.5, easeInOut(t / 0.18)) : t < 0.42 ? lerp(-1.5, -0.1, easeOut((t - 0.18) / 0.24)) : t < 0.58 ? lerp(-0.1, -1.4, easeInOut((t - 0.42) / 0.16)) : lerp(-1.4, 0.0, easeOut((t - 0.58) / 0.3));
        return { ang: a, r: 16, blade: a - 0.2, lean: 0.06 * pulse(t) };
      }, { t: 1.45, dmg: 0.7, hitAt: 0.34, rehit: [0.56], aim: 0.0, cr: [0.4, 0.78] }),
    ],
  },
  fist: {
    idle: 0.2, run: 0.1, sfx: 'swingFist', hit: 'hitFist',
    variants: [
      V('Jab-cross', t => { const j = pulse(t / 0.5), b = t < 0.45 ? 0 : pulse((t - 0.45) / 0.55); return { ang: 0.0, r: 8 + 11 * j, blade: 0.0, lunge: 4 * Math.max(j, b), lean: 0.06 * Math.max(j, b), back: { ang: 0.0, r: t < 0.45 ? 9 : 8 + 11 * b, blade: 0 } }; },
        { hitAt: 0.2, rehit: [0.58], trail: 'thrust' }),
      V('Hook', withBack(strike({ wf: 0.3, aw: -1.7, ae: 0.25, r: 18, bo: 0, lb: 0.1 }), { ang: -0.3, r: 10, blade: 0 }), { t: 1.1, dmg: 1.15, hitAt: 0.4, trail: { about: 'sh', a0: -1.7, ccw: false, from: 0.3 } }),
      V('Uppercut', withBack(strike({ wf: 0.3, aw: 1.2, ae: -1.1, r: 17, bo: 0, lb: 0.08, lg: 4 }), { ang: -0.2, r: 10, blade: 0 }), { t: 1.05, dmg: 1.2, hitAt: 0.4, trail: { about: 'sh', a0: 1.2, ccw: true, from: 0.3 }, sfx: 'swingHammer', sfxAt: 0.3, hit: 'hitBlunt' }),
      V('Overhand', withBack(strike({ wf: 0.38, aw: -2.3, ae: 0.7, r: 20, bo: 0, pw: 1.3, lb: 0.14, lg: 5 }), { ang: 0.1, r: 9, blade: 0 }), { t: 1.25, dmg: 1.35, cost: 1.3, hitAt: 0.62, trail: { about: 'sh', a0: -2.3, ccw: false, from: 0.38 }, hit: 'hitBlunt', shake: 2 }),
    ],
  },
};
// the bow: the front hand holds it out, the back hand draws the string (swing's `draw`, 0..1), then the arrow is loosed (`fire`: when, `n` arrows, `spread`, `pierce`)
const bowShot = (rel, aim = -0.04, lead = 0) => t => {
  const up = easeInOut(clamp01(t / 0.2)), ang = lerp(REST, aim, up), d = easeInOut(clamp01((t - 0.12) / (rel - 0.12))), rec = t >= rel ? easeOut(clamp01((t - rel) / 0.2)) : 0, hold = t < rel ? 1 : 1 - rec;      // the string is drawn at d; after the release the pose relaxes (rec)
  return { ang, r: 19, blade: 0, lean: (-0.03 + lead * 0.5) * d * hold, lunge: (-2 + lead * 8) * d * hold + 3 * rec, draw: t < rel ? d : 0, back: { ang: ang - 0.02, r: t < rel ? lerp(18, 4.5, d) : lerp(4.5, 15, rec), blade: 0 } };
};
// the staff is raised and charges (swing's `glow`), then thrust forward to cast
const staffCast = (rel, a1 = -0.7, b1 = -1.7, a2 = 0.0, b2 = -0.25, lead = 0) => t => {
  if (t < rel) { const x = easeInOut(t / rel); return { ang: lerp(REST, a1, x), r: 14, blade: lerp(-1.1, b1, x), lean: -0.05 * x, glow: x }; }
  const x = clamp01((t - rel) / 0.3), e = easeOut(x);
  return { ang: lerp(a1, a2, e), r: lerp(14, 17, e), blade: lerp(b1, b2, e), lunge: (4 + lead * 6) * pulse(x), lean: 0.08 * e + lead * 0.05 * e, glow: 1 - x };
};
Object.assign(WEAPON_KINDS, {
  bow: {
    idle: 1.2, run: 1.0, ranged: 'arrow', sfx: 'tick', hit: 'hitPierce',
    variants: [
      V('Quick shot', bowShot(0.55, -0.04), { hitAt: 0.55, fire: [0.55] }),
      V('Power shot', bowShot(0.78, -0.3, -0.12), { t: 1.45, dmg: 1.9, cost: 1.6, hitAt: 0.78, fire: [0.78], pierce: 1, shake: 1 }),
      V('Twin shot', bowShot(0.6, 0.3, 0.25), { t: 1.15, dmg: 0.7, cost: 1.3, hitAt: 0.6, fire: [0.6], count: 2, spread: 0.05 }),
      V('Volley', bowShot(0.72, -0.62, -0.1), { t: 1.35, dmg: 0.55, cost: 1.9, hitAt: 0.72, fire: [0.72], count: 5, spread: 0.3 }),
    ],
  },
  staff: {
    idle: -1.25, run: -1.1, two: true, ranged: 'bolt', sfx: 'chime', hit: 'crackle',
    variants: [
      V('Bolt', staffCast(0.5, -0.7, -1.7, 0.0, -0.25, 0), { hitAt: 0.5, fire: [0.5] }),
      V('Twin orbs', staffCast(0.4, -0.2, -1.2, 0.25, 0.15, 0.5), { t: 1.2, dmg: 0.7, cost: 1.4, hitAt: 0.4, fire: [0.4, 0.62], spread: 0.06 }),
      V('Nova', staffCast(0.62, -1.3, -2.4, 0.6, 1.0, 0.2), { t: 1.35, dmg: 0.55, cost: 1.8, hitAt: 0.62, fire: [0.62], ring: 8, life: 0.55, speed: 270, shake: 2 }),
      V('Piercing beam', staffCast(0.58, 0.05, -0.4, -0.05, -0.05, 1.0), { t: 1.3, dmg: 1.6, cost: 1.5, hitAt: 0.58, fire: [0.58], pierce: 3, speed: 900, life: 0.6 }),
    ],
  },
});
const weaponKind = sw => WEAPON_KINDS[sw && sw.kind] || WEAPON_KINDS.sword;
const weaponVariant = (sw, i) => { const K = weaponKind(sw); return K.variants[(i | 0) % K.variants.length]; };

// Full hero pose. o: { p: run phase, run, lean, breath, atk (0..1, or -1 when not attacking), tuck, kind: the weapon's kind }
function poseStick(x0, y, f, o) {
  const K = WEAPON_KINDS[o.kind] || WEAPON_KINDS.sword, Vr = o.atk >= 0 ? K.variants[(o.variant | 0) % K.variants.length] : null, sp = Vr ? Vr.swing(o.atk) : null;
  const settle = sp ? easeInOut(clamp01((1 - o.atk) / 0.25)) : 1;        // the step and the lean ease back to the carried pose at the end of the swing
  const x = x0 + (sp && sp.lunge ? sp.lunge * f * settle : 0);
  const p = o.p || 0, br = o.breath || 0, lean = (o.lean || 0) + (sp && sp.lean ? sp.lean * settle : 0);
  // hips rise when a leg passes under the body and dip at each footfall
  const hipY = y - (o.run ? 23 - Math.abs(Math.cos(p)) * 2 : 25) + (o.tuck ? 6 : 0);
  const hip = { x, y: hipY };
  const neck = { x: x + f * Math.sin(lean) * 26, y: hipY - Math.cos(lean) * 26 + br * 0.5 };
  const head = { x: neck.x + f * (Math.sin(lean) * 10 + 1.5), y: neck.y - 11 + br * 0.2 };
  const sh = { x: neck.x, y: neck.y + 4 };

  let feet;
  if (o.tuck) feet = [{ x: x + f * 9, y: hipY + 8 }, { x: x + f * 4, y: hipY + 12 }];
  else if (o.run) feet = [footAt(x, y, f, p, HERO_STRIDE, 8), footAt(x, y, f, p + Math.PI, HERO_STRIDE, 8)];
  else feet = [{ x: x + f * 6, y }, { x: x - f * 5, y }];
  const legs = feet.map(ft => { const k = ik(hip.x, hip.y, ft.x, ft.y, 13.5, 13.5, -f); return [hip, k.j, k.e]; });

  // weapon arm. ang is the hand's direction from the shoulder: 0 = straight ahead, negative = up.
  // The carried pose is worked out first; a swing blends in from it and back out to it, so nothing snaps when an attack starts or ends.
  let hand, blade;
  if (o.tuck) { hand = { x: sh.x + f * 10, y: sh.y + 6 }; blade = -0.2; }
  else {
    const sway = o.run ? Math.cos(p) * 3 : br * 0.3;
    hand = { x: sh.x + f * (8 + sway), y: sh.y + 15 };
    blade = o.run ? K.run : K.idle;                                     // carried low and forward
  }
  const w = sp ? Math.min(easeInOut(clamp01(o.atk / 0.14)), easeInOut(clamp01((1 - o.atk) / 0.2))) : 0;
  if (sp) {
    hand = { x: lerp(hand.x, sh.x + f * Math.cos(sp.ang) * sp.r, w), y: lerp(hand.y, sh.y + Math.sin(sp.ang) * sp.r, w) };
    blade += wrapPI(sp.blade - blade) * w;                              // the short way round, so a spin never unwinds backwards at the end
  }
  const front = ik(sh.x, sh.y, hand.x, hand.y, 9.5, 9.5, f);

  // back (free) arm swings opposite the front leg; elbows bow backwards. Two-handed weapons are gripped further down the shaft.
  let bh;
  if (K.two && !o.tuck) bh = { x: front.e.x - f * Math.cos(blade) * 9, y: front.e.y - Math.sin(blade) * 9 };
  else if (o.tuck) bh = { x: sh.x + f * 9, y: sh.y + 9 };
  else if (o.run) bh = { x: sh.x - f * 9 * Math.cos(p), y: sh.y + 13 - Math.abs(Math.sin(p)) * 2 };
  else bh = { x: sh.x - f * 3, y: sh.y + 17 + br * 0.3 };
  if (sp && sp.back) bh = { x: lerp(bh.x, sh.x + f * Math.cos(sp.back.ang) * sp.back.r, w), y: lerp(bh.y, sh.y + Math.sin(sp.back.ang) * sp.back.r, w) };
  const back = ik(sh.x, sh.y, bh.x, bh.y, 9.5, 9.5, f);
  let bblade = K.twin ? (o.run ? 0.35 : 0.5) : 0;                         // the second dagger
  if (sp && sp.back && sp.back.blade !== undefined) bblade += wrapPI(sp.back.blade - bblade) * w;
  return { hip, neck, head, sh, legs, back, front, blade, bblade, rawBlade: sp ? sp.blade : blade, v: Vr, f, atk: o.atk >= 0 ? o.atk : -1 };
}
function drawStickBody(J) {
  poly(J.sh, J.back.j, J.back.e);
  for (const l of J.legs) poly(...l);
  poly(J.hip, J.neck);
  poly(J.sh, J.front.j, J.front.e);
}
// How far the lash is out (ext 0.35..1), how straight it is (crack 0..1) and which way it points (ang), a of the way through the attack.
function whipPose(J, a) {
  const cr = (J.v && J.v.cr) || [0.45], aim = J.v && J.v.aim !== undefined ? J.v.aim : 0.05, up = cr.length > 1 ? 0.22 : 0.4;      // when the lash cracks, and where it points
  let ext = 0.35, crack = 0;
  if (a >= 0) for (const c of cr) { ext = Math.max(ext, 0.35 + 0.65 * (a < c - up ? 0 : a < c ? (a - (c - up)) / up : Math.max(0, 1 - (a - c) / 0.5))); crack = Math.max(crack, Math.max(0, 1 - Math.abs(a - c) / 0.11)); }
  return { ext, crack, ang: lerp(J.blade, aim, crack) };
}
// Draws the weapon in the hero's hand (and the free hand for two-handed ones); returns where the tip is.
function drawSword(J, sw, glow) {
  const h = J.front.e, f = J.f, k = sw.kind || 'sword', L = sw.len;
  const dx = f * Math.cos(J.blade), dy = Math.sin(J.blade);
  const nx = -dy * f, ny = dx * f;                                   // sideways, the same side whichever way the hero faces
  const P = (s, o = 0) => ({ x: h.x + dx * s + nx * o, y: h.y + dy * s + ny * o });
  const spr = weaponSprite(sw);
  if (spr) {                                                         // the designed weapon (same art as its icon), held at the hand and turned along the swing
    const g = spr.g;
    const put = (hd, bl) => {                                         // draw the weapon at a hand, turned to angle bl; returns how long it is on screen
      const th = Math.atan2(Math.cos(bl), -Math.sin(bl));
      ctx.save();
      if (glow) { ctx.shadowColor = sw.color; ctx.shadowBlur = 12; }
      ctx.translate(hd.x, hd.y); ctx.scale(f, 1); ctx.rotate(th);
      ctx.imageSmoothingQuality = 'high';
      let len;
      if (spr.blade) { ctx.scale(spr.s * spr.wk, spr.s); ctx.drawImage(spr.img, -g.hx, spr.minY - g.gy, 32, spr.H); len = spr.s * (g.gy - spr.tipY); }      // a sword: the stretch is in the picture, scaled evenly
      else { len = L * g.lk; ctx.scale(g.sx, (len + 4) / (g.gy - g.ty)); ctx.drawImage(spr.img, -g.hx, -g.gy, 32, 32); }                       // long and slim: width and length scale separately
      ctx.restore();
      return len;
    };
    if (k === 'dagger') put(J.back.e, J.bblade);                      // twin daggers: one in each hand
    const len = put(h, J.blade);
    return { x: h.x + dx * len, y: h.y + dy * len };
  }
  const WOOD = '#8a6a3c', DARK = '#654';
  const shaft = (a, b, col = WOOD, w = 3) => { ctx.strokeStyle = col; ctx.lineWidth = w; line(P(a).x, P(a).y, P(b).x, P(b).y); };
  const fill = (pts, col = sw.color) => { ctx.fillStyle = col; ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.fill(); ctx.stroke(); };
  ctx.save();
  if (glow) { ctx.shadowColor = sw.color; ctx.shadowBlur = 12; }
  let tip = P(L);
  switch (k) {
    case 'spear':
      shaft(-12, L - 10); fill([P(L - 12, -3.5), P(L + 7), P(L - 12, 3.5)]);
      shaft(L - 12, L - 9, '#a33', 4); tip = P(L + 7); break;
    case 'rapier': {
      shaft(5, L, sw.color, 2);
      ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P(2, -6).x, P(2, -6).y); ctx.quadraticCurveTo(P(8, 0).x, P(8, 0).y, P(2, 6).x, P(2, 6).y); ctx.stroke();
      shaft(-5, 3, DARK); break;
    }
    case 'katana': {
      const c = P(L * 0.55, -1.5), e = P(L, -5);
      ctx.strokeStyle = sw.color; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(P(4).x, P(4).y); ctx.quadraticCurveTo(c.x, c.y, e.x, e.y); ctx.stroke();
      ctx.fillStyle = '#c9a227'; ctx.beginPath(); ctx.arc(P(3).x, P(3).y, 3.2, 0, Math.PI * 2); ctx.fill();
      shaft(-9, 2, '#222'); tip = e; break;
    }
    case 'axe':
      shaft(-8, L); fill([P(L - 8, 0), P(L - 2, -13), P(L + 6, -10), P(L + 3, 0), P(L + 6, 10), P(L - 2, 13)]); break;
    case 'hammer':
      shaft(-8, L); fill([P(L - 7, -9), P(L + 7, -9), P(L + 7, 9), P(L - 7, 9)]); tip = P(L + 7); break;
    case 'scythe': {
      shaft(-10, L);
      const a = P(L), b = P(L + 11, -15), c = P(L - 14, -22);
      ctx.strokeStyle = sw.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(b.x, b.y, c.x, c.y); ctx.stroke();
      ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(P(L - 2, -2).x, P(L - 2, -2).y); ctx.quadraticCurveTo(P(L + 6, -10).x, P(L + 6, -10).y, P(L - 12, -18).x, P(L - 12, -18).y); ctx.stroke();
      tip = c; break;
    }
    case 'halberd':
      shaft(-12, L - 8); fill([P(L - 10, -3), P(L + 8), P(L - 10, 3)]);
      fill([P(L - 14, 1), P(L - 6, 13), P(L - 20, 11)]); fill([P(L - 16, -1), P(L - 11, -9), P(L - 20, -4)], '#778'); tip = P(L + 8); break;
    case 'whip': {
      const a = J.atk, tw = tAnim;
      const { ext, crack, ang } = whipPose(J, a);
      const ddx = f * Math.cos(ang), ddy = Math.sin(ang), amp = (a < 0 ? 2.5 : 7) * (1 - crack * 0.85);
      const wc = whipColors(sw);
      shaft(-5, 6, wc.grip, 4);
      ctx.strokeStyle = wc.lash; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(h.x, h.y);
      let q = h;
      for (let i = 1; i <= 12; i++) {
        const s = i / 12, w = Math.sin(s * 8 - tw * (a < 0 ? 3 : 14)) * amp * s;
        q = { x: h.x + ddx * L * ext * s - ddy * f * w, y: h.y + ddy * L * ext * s + ddx * f * w };
        ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();
      if (crack > 0.6) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(q.x, q.y, 3.5, 0, Math.PI * 2); ctx.fill(); }   // the snap
      tip = q; break;
    }
    case 'bow': {
      const S = J.atk >= 0 && J.v ? J.v.swing(J.atk) : {}, d = S.draw || 0, bl = L * 0.68, top = { x: h.x - f * 4, y: h.y - bl }, bot = { x: h.x - f * 4, y: h.y + bl };
      ctx.lineCap = 'round'; ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 4.4; ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.quadraticCurveTo(h.x + f * 12, h.y, bot.x, bot.y); ctx.stroke();
      ctx.strokeStyle = sw.color; ctx.lineWidth = 2.8; ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.quadraticCurveTo(h.x + f * 12, h.y, bot.x, bot.y); ctx.stroke();
      const nock = d > 0.02 ? { x: J.back.e.x, y: J.back.e.y } : { x: h.x - f * 4, y: h.y };
      ctx.strokeStyle = '#efe6c8'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(nock.x, nock.y); ctx.lineTo(bot.x, bot.y); ctx.stroke();
      if (d > 0.02) { const ax = h.x + f * 15; ctx.strokeStyle = '#8a6a3c'; ctx.lineWidth = 1.8; line(nock.x, nock.y, ax, h.y); ctx.fillStyle = sw.sig ? sw.color : '#dfe6ef'; ctx.beginPath(); ctx.moveTo(ax + f * 5, h.y); ctx.lineTo(ax - f * 1, h.y - 2.6); ctx.lineTo(ax - f * 1, h.y + 2.6); ctx.closePath(); ctx.fill(); }
      tip = { x: h.x + f * 10, y: h.y }; break;
    }
    case 'staff': {
      const S = J.atk >= 0 && J.v ? J.v.swing(J.atk) : {}, gl = S.glow !== undefined ? S.glow : 0.18 + 0.1 * Math.sin(tAnim * 3), t = P(L);
      ctx.lineCap = 'round'; shaft(-14, L - 3, '#3a2a18', 5); shaft(-14, L - 3, '#8a6a3c', 3);
      ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 2.4; line(P(L - 8, -3).x, P(L - 8, -3).y, P(L + 1, -5).x, P(L + 1, -5).y); line(P(L - 8, 3).x, P(L - 8, 3).y, P(L + 1, 5).x, P(L + 1, 5).y);
      if (gfx.glow) { const g2 = ctx.createRadialGradient(t.x, t.y, 1, t.x, t.y, 8 + gl * 16); g2.addColorStop(0, withAlpha(sw.color, 0.35 + gl * 0.5)); g2.addColorStop(1, withAlpha(sw.color, 0)); ctx.fillStyle = g2; ctx.fillRect(t.x - 26, t.y - 26, 52, 52); }
      ctx.fillStyle = sw.color; ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(t.x, t.y, 4.2 + gl * 2.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(t.x - 1, t.y - 1, 1.6 + gl, 0, Math.PI * 2); ctx.fill();
      tip = t; break;
    }
    case 'fist':
      for (const hd of [J.front.e, J.back.e]) { ctx.fillStyle = sw.color; ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(hd.x + f * 1.5, hd.y, 5.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      tip = { x: h.x + f * 5, y: h.y }; break;
    default:                                                          // sword
      ctx.strokeStyle = sw.color; ctx.lineWidth = sw.id === 'great' ? 5 : 3;
      line(h.x, h.y, h.x + dx * L, h.y + dy * L);
      ctx.restore(); ctx.save();
      ctx.strokeStyle = DARK; ctx.lineWidth = 3;                      // crossguard + pommel
      line(h.x - dy * 5, h.y + dx * 5, h.x + dy * 5, h.y - dx * 5);
      line(h.x, h.y, h.x - dx * 4, h.y - dy * 4);
  }
  ctx.restore();
  return tip;
}

// --- Armor on the hero: drawn on the body itself (it follows the spine, the arms bend inside the sleeves), in the colours of its icon ---
const ARMOR_LOOK = [
  { kind: 'rags',   main: '#8f7f6c', dark: '#5a4d3f', trim: '#5a4630' },
  { kind: 'jerkin', main: '#b99358', dark: '#6b4a22', trim: '#ecdcae' },
  { kind: 'vest',   main: '#7e5230', dark: '#3f2a17', trim: '#dcae70', under: '#cdbea0', sleeve: '#cdbea0' },
  { kind: 'chain',  main: '#a5b1c0', dark: '#4d5a6b', trim: '#6f7886' },
  { kind: 'scale',  main: '#4f8f78', dark: '#2f5f4e', trim: '#6fbb9b' },
  { kind: 'plate',  main: '#bcc6d3', dark: '#7a8798', trim: '#e8eef6', gold: '#e0bd55', pauldron: true },
  { kind: 'dragon', main: '#7a2a2e', dark: '#3a1214', trim: '#a6403f', bone: '#e3d6ae' },
  { kind: 'aegis',  main: '#3b62ad', dark: '#2f4f90', trim: '#f3d56e', gold: '#e0bd55', pauldron: true },
];
const SECRET_LOOK = { kind: 'shroud', main: '#2c2252', dark: '#0c0a1b', trim: '#6c5aba', glow: '#43f2da' };
const armorLook = h => { const it = h.equip && h.equip.armor; return it ? (it.rarity === 7 ? SECRET_LOOK : ARMOR_LOOK[armorIndex(it)]) : null; };
const ARMOR_INK = '#17171f';
// the torso's frame: origin at the hip, up along the spine; wt = half width at the shoulders, wh = at the hips
function torsoFrame(J) {
  const dx = J.neck.x - J.hip.x, dy = J.neck.y - J.hip.y;
  return { L: Math.hypot(dx, dy) || 1, ang: Math.atan2(dx, -dy), wt: 8.2, wh: 6.4 };
}
// sleeves cover the upper arm (shoulder to elbow); the forearm and hand stay bare
function armorSleeve(look, a, b) {
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = ARMOR_INK; ctx.lineWidth = 8.6; line(a.x, a.y, b.x, b.y);
  ctx.strokeStyle = look.sleeve || look.main; ctx.lineWidth = 6.4; line(a.x, a.y, b.x, b.y);
  if (look.kind === 'plate' || look.kind === 'aegis') {                  // a gold band on the sleeve
    ctx.strokeStyle = look.gold; ctx.lineWidth = 1.2; ctx.translate(a.x + (b.x - a.x) * 0.62, a.y + (b.y - a.y) * 0.62); ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2); line(-3.2, 0, 3.2, 0);
  }
  ctx.restore();
}
function drawCloak(J, look) {
  const { L, ang } = torsoFrame(J), top = -L + 2, sway = Math.sin(tAnim * 2.1) * 1.5;
  ctx.save(); ctx.translate(J.hip.x, J.hip.y); ctx.rotate(ang); ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-5, top); ctx.quadraticCurveTo(-13 + sway, top + L * 0.55, -14 + sway, 21); ctx.lineTo(-7, 18 + sway * 0.4); ctx.lineTo(0, 22); ctx.lineTo(7, 18 - sway * 0.4); ctx.lineTo(14 + sway, 21); ctx.quadraticCurveTo(13 + sway, top + L * 0.55, 5, top); ctx.closePath();
  ctx.fillStyle = look.dark; ctx.fill(); ctx.strokeStyle = look.trim; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.restore();
}
function drawArmor(J, look) {
  const { L, ang, wt, wh } = torsoFrame(J), top = -L + 1.5, hem = look.kind === 'rags' ? 9 : 7;
  ctx.save(); ctx.translate(J.hip.x, J.hip.y); ctx.rotate(ang); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // the garment: neckline, shoulders, a waist that narrows, a short skirt over the hips
  const body = () => {
    ctx.beginPath(); ctx.moveTo(-wt, top + 1); ctx.lineTo(-3.2, top); ctx.quadraticCurveTo(0, top + 5.5, 3.2, top); ctx.lineTo(wt, top + 1);
    ctx.quadraticCurveTo(wt - 1.6, -L * 0.45, wh, -1.5); ctx.lineTo(wh + 1.6, 2);
    if (look.kind === 'rags') { for (let i = 0; i < 6; i++) ctx.lineTo(wh + 1.6 - (i + 1) * ((wh + 1.6) * 2 / 6), i % 2 ? hem - 3 : hem); }
    else { ctx.lineTo(wh + 1.8, hem); ctx.lineTo(-wh - 1.8, hem); }
    ctx.lineTo(-wh - 1.6, 2); ctx.lineTo(-wh, -1.5); ctx.quadraticCurveTo(-wt + 1.6, -L * 0.45, -wt, top + 1); ctx.closePath();
  };
  body(); ctx.fillStyle = look.main; ctx.fill();
  ctx.save(); body(); ctx.clip();
  const rows = (step, fn) => { for (let y = top + 4, r = 0; y < hem + 1; y += step, r++) for (let x = -wt - 2 + (r % 2) * step / 2; x < wt + 2; x += step) fn(x, y); };
  switch (look.kind) {
    case 'rags': ctx.fillStyle = '#6f8c5c'; ctx.fillRect(-2, -L * 0.55, 5, 4.2); ctx.strokeStyle = '#d8d0bc'; ctx.lineWidth = 0.6; ctx.setLineDash([1, 0.8]); ctx.strokeRect(-2, -L * 0.55, 5, 4.2); ctx.setLineDash([]); break;
    case 'jerkin':
      ctx.strokeStyle = look.dark; ctx.lineWidth = 0.9; line(0, top + 4, 0, hem);
      ctx.strokeStyle = look.trim; ctx.lineWidth = 0.9; for (let y = top + 5; y < -4; y += 4) { line(-2.2, y, 2.2, y + 2.6); line(2.2, y, -2.2, y + 2.6); }
      break;
    case 'vest':
      ctx.fillStyle = look.under; ctx.beginPath(); ctx.moveTo(-3.4, top + 1); ctx.lineTo(0, top + 9); ctx.lineTo(3.4, top + 1); ctx.lineTo(3.4, hem); ctx.lineTo(-3.4, hem); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = look.trim; ctx.lineWidth = 0.7; ctx.setLineDash([1.2, 1.1]); line(-5.4, top + 8, -5.4, -2); line(5.4, top + 8, 5.4, -2); ctx.setLineDash([]);
      break;
    case 'chain': ctx.strokeStyle = look.dark; ctx.lineWidth = 0.55; rows(3, (x, y) => { ctx.beginPath(); ctx.arc(x, y, 1.15, 0, 7); ctx.stroke(); }); break;
    case 'scale': ctx.fillStyle = look.trim; ctx.strokeStyle = look.dark; ctx.lineWidth = 0.5; rows(3.2, (x, y) => { ctx.beginPath(); ctx.arc(x, y, 2.1, 0, Math.PI); ctx.fill(); ctx.stroke(); }); break;
    case 'plate':
      ctx.fillStyle = look.trim; ctx.beginPath(); ctx.moveTo(-wt + 1.4, top + 2.6); ctx.quadraticCurveTo(0, top + 8, wt - 1.4, top + 2.6); ctx.lineTo(wh - 0.6, -L * 0.3); ctx.quadraticCurveTo(0, -L * 0.18, -wh + 0.6, -L * 0.3); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = look.dark; ctx.lineWidth = 0.9; line(0, top + 6, 0, hem); ctx.strokeStyle = look.gold; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-wt + 1, top + 1.4); ctx.quadraticCurveTo(0, top + 7, wt - 1, top + 1.4); ctx.stroke();
      ctx.strokeStyle = look.dark; ctx.lineWidth = 0.7; line(-wh - 2, 3.4, wh + 2, 3.4);
      break;
    case 'dragon':
      ctx.fillStyle = look.trim; ctx.strokeStyle = look.dark; ctx.lineWidth = 0.45; rows(3, (x, y) => { ctx.beginPath(); ctx.arc(x, y, 1.9, 0, Math.PI); ctx.fill(); ctx.stroke(); });
      ctx.fillStyle = '#c24c4a'; ctx.beginPath(); ctx.moveTo(-wt + 1.6, top + 2.6); ctx.quadraticCurveTo(0, top + 8, wt - 1.6, top + 2.6); ctx.lineTo(wh - 1, -L * 0.3); ctx.quadraticCurveTo(0, -L * 0.2, -wh + 1, -L * 0.3); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = look.dark; ctx.lineWidth = 0.8; ctx.stroke();
      break;
    case 'aegis':
      ctx.fillStyle = look.dark; ctx.beginPath(); ctx.moveTo(0, top + 2); ctx.lineTo(7, top + 4.2); ctx.lineTo(7, -L * 0.45); ctx.quadraticCurveTo(7, -L * 0.1, 0, 0); ctx.quadraticCurveTo(-7, -L * 0.1, -7, -L * 0.45); ctx.lineTo(-7, top + 4.2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = look.gold; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.fillStyle = look.trim; ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 1.6 : 3.8, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, -L * 0.5 + Math.sin(a) * r); } ctx.closePath(); ctx.fill();
      break;
    case 'shroud':
      ctx.strokeStyle = look.trim; ctx.lineWidth = 0.8; line(0, top + 5, 0, hem);
      ctx.fillStyle = look.glow; ctx.beginPath(); ctx.ellipse(0, -L * 0.48, 2.4, 1.3, 0, 0, 7); ctx.fill(); ctx.fillStyle = look.dark; ctx.beginPath(); ctx.arc(0, -L * 0.48, 0.7, 0, 7); ctx.fill();
      break;
  }
  ctx.restore();
  // belt, then the outline of the garment, then what sits on the shoulders
  if (look.kind === 'plate' || look.kind === 'aegis') { ctx.strokeStyle = look.gold; ctx.lineWidth = 1.5; line(-wh - 0.4, -2.2, wh + 0.4, -2.2); }
  else if (look.kind !== 'shroud') { ctx.strokeStyle = look.kind === 'rags' ? look.trim : look.dark; ctx.lineWidth = look.kind === 'rags' ? 1.7 : 2.3; line(-wh - 0.4, -2.2, wh + 0.4, -2.2); }
  if (look.kind === 'vest') { ctx.fillStyle = '#e0bd55'; ctx.fillRect(-1.6, -3.7, 3.2, 3); }
  body(); ctx.strokeStyle = ARMOR_INK; ctx.lineWidth = 1.5; ctx.stroke();
  if (look.pauldron) for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * (wt - 0.6), top + 2.2, 4.3, 0, 7); ctx.fillStyle = look.kind === 'aegis' ? look.dark : look.trim; ctx.fill(); ctx.strokeStyle = look.gold; ctx.lineWidth = 1.2; ctx.stroke(); }
  if (look.kind === 'dragon') for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * (wt - 1), top + 1.4); ctx.lineTo(sx * (wt + 3.4), top - 4.6); ctx.lineTo(sx * (wt - 3.2), top + 3.4); ctx.closePath(); ctx.fillStyle = look.bone; ctx.fill(); ctx.strokeStyle = ARMOR_INK; ctx.lineWidth = 1; ctx.stroke(); }
  if (look.kind === 'shroud') { ctx.fillStyle = look.glow; ctx.beginPath(); ctx.arc(0, top + 1.4, 1.4, 0, 7); ctx.fill(); }
  ctx.restore();
}

// the katana's scabbard hangs from the belt on the back hip (the katana itself is in the hand)
function drawScabbard(J, f) {
  const { ang } = torsoFrame(J);
  ctx.save(); ctx.translate(J.hip.x, J.hip.y); ctx.rotate(ang); ctx.lineCap = 'round';
  const ax = f * 2.5, ay = -2.6, bx = -f * 24, by = 9;                                       // the mouth at the belt, the tip behind and below
  ctx.strokeStyle = ARMOR_INK; ctx.lineWidth = 5.6; line(ax, ay, bx, by);
  ctx.strokeStyle = katanaSheath(); ctx.lineWidth = 3.8; line(ax, ay, bx, by);
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 0.8; line(ax - f * 0.5, ay - 1, bx + f * 2, by - 1);
  const t = (u, w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; line(ax + (bx - ax) * u, ay + (by - ay) * u, ax + (bx - ax) * (u + 0.06), ay + (by - ay) * (u + 0.06)); };
  t(0.02, 4.2, '#aab3bf'); t(0.94, 4.2, '#aab3bf'); t(0.38, 4.4, '#0d0d12');             // the silver mouth and tip, the cord's knot
  ctx.strokeStyle = '#0d0d12'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(ax + (bx - ax) * 0.4, ay + (by - ay) * 0.4); ctx.quadraticCurveTo(ax + (bx - ax) * 0.3, ay + 8, ax + (bx - ax) * 0.18, ay + 6); ctx.stroke();
  ctx.restore();
}

function drawHero(h) {
  const { x, y, facing: f } = h;
  const sw = h.sword;
  drawShadow(x, y, 14);
  ctx.save();

  if (h.auraT > 0) {                          // level-up aura
    const p = 1 - h.auraT / 1.2;
    ctx.strokeStyle = `rgba(255,220,80,${1 - p})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x, y, 20 + p * 50, (20 + p * 50) * 0.35, 0, 0, Math.PI * 2); ctx.stroke();
    if (gfx.glow) { ctx.fillStyle = `rgba(255,220,80,${0.25 * (1 - p)})`; ctx.fillRect(x - 12, y - 120 * p - 60, 24, 60); }
  }

  const flipping = h.flipT > 0 && !h.dead;
  if (h.dead) {                               // topple backwards
    const p = Math.min(1, h.deadT / 0.6);
    ctx.translate(x, y); ctx.rotate(-f * p * Math.PI / 2 * 0.95); ctx.translate(-x, -y);
    ctx.globalAlpha = 0.9;
  } else if (flipping) {                      // somersault, tucked, with a hop
    const p = 1 - h.flipT / FLIP_TIME;
    ctx.translate(x, y - 30 - Math.sin(p * Math.PI) * 25);
    ctx.rotate(f * p * Math.PI * 2);
    ctx.translate(-x, -(y - 30));
    ctx.globalAlpha = 0.65;
    if (gfx.glow) { ctx.shadowColor = '#9cf'; ctx.shadowBlur = 16; }
  } else if (h.hurtT > 0) {
    ctx.globalAlpha = settings.comfort ? 0.6 : Math.floor(h.hurtT * 10) % 2 ? 0.4 : 0.85;
  }

  const run = h.moving && !flipping && !h.dead;
  const breath = run ? 0 : Math.sin(tAnim * 2.6) * 1.2;
  const atk = h.attackT > 0 ? 1 - h.attackT / h.attackDur : -1;
  const lean = (run ? 0.16 : 0.02) + 0 - (h.hurtT > 0.6 ? 0.25 : 0);   // the other kinds lean as their own swing says
  const J = poseStick(x, y, f, { p: h.walkT, run, lean, breath, atk, tuck: flipping, kind: sw.kind, variant: h.attackVar | 0 });
  const ink = h.dead ? '#444' : '#111';

  // scarf trails from the neck (rope simulated in updateHero)
  if (!h.dead && !flipping) {
    ctx.strokeStyle = '#c0282d'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(J.neck.x, J.neck.y + 2);
    const ox = J.neck.x - h.scarf[0].x, oy = J.neck.y + 2 - h.scarf[0].y;
    for (let i = 1; i < h.scarf.length; i++) ctx.lineTo(h.scarf[i].x + ox, h.scarf[i].y + oy);
    ctx.stroke();
  }

  ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const look = armorLook(h);
  if (look && look.kind === 'shroud') drawCloak(J, look);                                   // the cloak hangs behind the body
  poly(J.sh, J.back.j, J.back.e);
  if (look) armorSleeve(look, J.sh, J.back.j);
  if (sw.id === 'katana') drawScabbard(J, f);
  for (const l of J.legs) poly(...l);
  poly(J.hip, J.neck);
  if (look) drawArmor(J, look);
  poly(J.sh, J.front.j, J.front.e);
  if (look) armorSleeve(look, J.sh, J.front.j);
  const tip = drawSword(J, sw, gfx.glow && (sw.burn || sw.slow));
  if (gfx.glow && atk < 0 && Math.sin(tAnim * 1.3) > 0.97) {   // occasional glint
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(tip.x, tip.y, 2.5, 0, Math.PI * 2); ctx.fill();
  }

  // head + face
  const { x: hx, y: hy } = J.head;
  ctx.fillStyle = '#fff'; ctx.strokeStyle = ink; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(hx, hy, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = ink;
  if (h.dead) { ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('x', hx + f * 4, hy + 1); }
  else if (h.hurtT > 0.5) ctx.fillRect(hx + f * 2, hy - 3, 5 * f, 1.8);                              // squint
  else if (Math.sin(tAnim * 0.9) > 0.985) ctx.fillRect(hx + f * 2.5, hy - 2, 3.5 * f, 1.2);           // blink
  else { ctx.beginPath(); ctx.arc(hx + f * 4, hy - 2, 1.8, 0, Math.PI * 2); ctx.fill(); }

  // slash trail follows the blade's actual arc
  const TR = J.v && J.v.trail;
  if (TR === 'thrust') {                                    // a streak behind the point of a thrust or punch
    if (atk > 0.28 && atk < 0.85 && gfx.trail) {
      const a = tip, back = sw.kind === 'fist' ? 14 : 26;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.globalAlpha *= 0.55 * (1 - (atk - 0.28) / 0.57); ctx.lineWidth = 3;
      line(a.x, a.y, a.x - f * Math.cos(J.blade) * back, a.y - Math.sin(J.blade) * back);
    }
  } else if (TR && atk > TR.from && gfx.trail) {
    const about = TR.about === 'hand' ? J.front.e : J.sh, r = TR.about === 'hand' ? Math.max(14, sw.len * 0.9) : TR.about === 'sh' ? 17 : 16 + sw.len * 0.85;
    const a0 = TR.a0, a1 = TR.spin ? J.rawBlade : J.blade;            // a spin keeps counting past a full turn
    ctx.strokeStyle = sw.burn || sw.slow ? sw.color : 'rgba(255,255,255,0.8)';
    ctx.globalAlpha *= 0.5 * (1 - (atk - TR.from) / (1 - TR.from) * (TR.spin ? 0.3 : 0.6)); ctx.lineWidth = 4;
    ctx.beginPath();
    if (f > 0) ctx.arc(about.x, about.y, r, a0, a1, TR.ccw);
    else ctx.arc(about.x, about.y, r, Math.PI - a0, Math.PI - a1, !TR.ccw);
    ctx.stroke();
  }
  ctx.restore();
}

function statusTint(m, base) {
  if (m.flashT > 0) return '#fff';
  if (m.slowT > 0) return '#7ab';
  return base;
}
function drawHpBar(m, yOff) {
  if (m.dieT !== undefined || m.type === 'boss') return;
  ctx.fillStyle = '#300'; ctx.fillRect(m.x - 20, m.y - yOff, 40, 5);
  ctx.fillStyle = '#e33'; ctx.fillRect(m.x - 20, m.y - yOff, 40 * Math.max(0, m.hp) / m.maxHp, 5);
  const dots = []; if (m.burnT > 0 || (m.wfx && m.wfx.fire)) dots.push('#f73'); if (m.slowT > 0) dots.push('#6cf'); if (m.wfx && m.wfx.poison) dots.push('#6fe36f'); if (m.wfx && m.wfx.bleed) dots.push('#e0405a'); if (m.stunT > 0) dots.push('#fff06a');
  dots.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(m.x + 22 + (i % 2) * 6, m.y - yOff + Math.floor(i / 2) * 6, 5, 5); });
}

function drawMinotaur(m, scale = 1, skin = '#6b3e26', crown = false) {
  const { x, y, facing: f } = m;
  drawShadow(x, y, 20 * scale);
  ctx.save();
  const breathe = 1 + Math.sin(tAnim * 3 + x) * 0.02;
  ctx.translate(x, y); ctx.scale(scale, scale * breathe); ctx.translate(-x, -y);
  const swing = Math.sin(m.walkT) * 0.5, sp = swingPos(m), club = m.type === 'ogre', an = m.type === 'boss' ? m.lastAtk : null;
  const winding = sp < -0.2 && (m.state !== 'walk' || !!m.mel);
  const shake = winding ? Math.sin(performance.now() / 20) * 2 * -sp : 0;
  const bx = x + shake;
  const lean = m.state === 'charge' ? f * 10 : f * sp * (club ? 6 : an === 'sweep' ? 14 : 10);
  const lift = sp < 0 ? sp * 14 : sp * 6;

  const body = statusTint(m, skin);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#4a2a18'; ctx.lineWidth = 6;
  line(bx, y - 26, bx + Math.sin(swing) * 12, y);
  line(bx, y - 26, bx - Math.sin(swing) * 12, y);
  ctx.fillStyle = '#3a2010';                                  // hooves
  ctx.fillRect(bx + Math.sin(swing) * 12 - 4, y - 3, 8, 4); ctx.fillRect(bx - Math.sin(swing) * 12 - 4, y - 3, 8, 4);
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(bx + lean * 0.5, y - 44, 16, 22, lean * 0.02, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.15)';                         // belly shading
  ctx.beginPath(); ctx.ellipse(bx + lean * 0.5 - f * 5, y - 40, 8, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = body; ctx.lineWidth = 6;
  const sx = bx + lean * 0.5;
  const arm = side => {                                       // side: -1 left, +1 right of the body
    if (club && side === f) return;                           // the club arm is drawn below
    line(sx + side * 12, y - 56, sx + side * (20 + swing * side * 6) + (side === f ? f * Math.max(0, sp) * 12 : 0), y - 34 + lift * 3);
  };
  arm(-1); arm(1);
  const hx = bx + lean + f * 6 + (club ? 0 : f * Math.max(0, sp) * 8), hy = y - 72 + (club ? 0 : Math.max(0, sp) * 8 - Math.max(0, -sp) * 4);
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(hx, hy, 12, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c9a36b';
  ctx.beginPath(); ctx.ellipse(hx + f * 9, hy + 3, 6, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(hx + f * 11, hy + 2, 1.2, 0, Math.PI * 2); ctx.fill();   // nostril
  if (m.state === 'charge' && gfx.particles && Math.random() < 0.3) particles.push({ x: hx + f * 14, y: hy + 3, vx: f * 40, vy: -10, life: 0.3, max: 0.3, size: 2, color: '#eee' });
  ctx.strokeStyle = '#eee'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(hx - 8, hy - 6); ctx.quadraticCurveTo(hx - 20, hy - 10, hx - 16, hy - 22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hx + 8, hy - 6); ctx.quadraticCurveTo(hx + 20, hy - 10, hx + 16, hy - 22); ctx.stroke();
  if (crown) {
    ctx.fillStyle = '#fd4';
    ctx.beginPath(); ctx.moveTo(hx - 9, hy - 9); ctx.lineTo(hx - 9, hy - 20); ctx.lineTo(hx - 4, hy - 14); ctx.lineTo(hx, hy - 22);
    ctx.lineTo(hx + 4, hy - 14); ctx.lineTo(hx + 9, hy - 20); ctx.lineTo(hx + 9, hy - 9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e22'; ctx.beginPath(); ctx.arc(hx, hy - 13, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  if (club) {                                                 // a knotted club: raised behind the head, then brought down
    const rising = !(m.mel && m.mel.ph === 'rec'), th = sp < 0 ? 2.2 + 2.6 * sp : rising ? -0.4 + (sp + 1) / 2 * 2.9 : 2.2 + sp * 0.3;
    const hox = sx + f * 12 + f * (sp < 0 ? 8 + 6 * sp : 8 + 22 * sp), hoy = y - 56 + (sp < 0 ? 22 + sp * 52 : 22 + sp * 6);
    ctx.strokeStyle = body; ctx.lineWidth = 6; line(sx + f * 12, y - 56, hox, hoy);
    const tx = hox + f * Math.sin(th) * 34, ty = hoy - Math.cos(th) * 34;
    ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = 5; line(hox, hoy, tx, ty);
    ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 9; line(hox + (tx - hox) * 0.55, hoy + (ty - hoy) * 0.55, tx, ty);
    ctx.fillStyle = '#c9c0a8'; ctx.beginPath(); ctx.arc(tx - f * 2, ty - 3, 1.6, 0, Math.PI * 2); ctx.arc(tx + f * 3, ty + 2, 1.4, 0, Math.PI * 2); ctx.fill();
    if (sp > 0.2 && m.mel && m.mel.ph === 'strike') { ctx.strokeStyle = `rgba(255,255,255,${0.5 * sp})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx + f * 12, y - 56, 36, f > 0 ? -1.2 : Math.PI - 1.2, f > 0 ? 1.2 : Math.PI + 1.2); ctx.stroke(); }
  } else if (sp > 0.25 && (m.mel && m.mel.ph === 'strike' || an === 'sweep')) {          // the horns cut an arc
    ctx.strokeStyle = `rgba(255,240,220,${0.6 * sp})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(hx, hy + 4, 22, f > 0 ? -0.9 : Math.PI - 0.9, f > 0 ? 0.9 : Math.PI + 0.9); ctx.stroke();
  }
  ctx.fillStyle = winding || (m.state !== 'walk' && m.state !== 'atk') ? '#f00' : '#000';
  ctx.beginPath(); ctx.arc(hx + f * 3, hy - 3, 2.2, 0, Math.PI * 2); ctx.fill();
  if (winding) {
    if (gfx.glow) {
      ctx.fillStyle = 'rgba(255,0,0,0.25)';
      ctx.beginPath(); ctx.arc(hx + f * 3, hy - 3, 8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#f33'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('!', hx, hy - 28);
  }
  ctx.restore();
}

function drawGoblin(m) {
  const { x, y, facing: f } = m;
  drawShadow(x, y, 10);
  const sp = swingPos(m), striking = m.mel && m.mel.ph === 'strike', ph = m.walkT, c = statusTint(m, '#3d8b3d');
  const crouch = sp < 0 ? -sp * 5 : 0, lean = f * (sp < 0 ? sp * 4 : sp * 9), bx = x + lean * 0.4;
  ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.lineCap = 'round';
  drawLegs(x, y - 16 + Math.abs(Math.cos(ph)) * 1.5 + crouch * 0.6, y, f, ph, true, 8.5);
  const bob = Math.abs(Math.sin(ph)) * 2;
  line(x, y - 16 + crouch * 0.6, bx + f * 3, y - 31 - bob + crouch);
  const sx = bx + f * 2, sy = y - 27 - bob + crouch, mix = (a, b, t) => a + (b - a) * t;
  const rest = { x: x + f * 11, y: y - 21 + Math.sin(ph) * 4, tx: f * 8, ty: -8 };       // the dagger hand at rest, cocked overhead, and thrust out
  const back = { x: bx - f * 3, y: y - 46 + crouch, tx: -f * 2, ty: -13 }, out = { x: bx + f * 21, y: y - 28 + crouch, tx: f * 13, ty: -1 };
  const A = striking ? back : rest, B = sp < 0 ? back : out, t = sp < 0 ? -sp : striking ? (sp + 1) / 2 : sp;      // a strike goes from cocked to thrust; everything else leaves from rest
  const hand = { x: mix(A.x, B.x, t), y: mix(A.y, B.y, t), tx: mix(A.tx, B.tx, t), ty: mix(A.ty, B.ty, t) };
  line(sx, sy, hand.x, hand.y);
  ctx.strokeStyle = '#999'; line(hand.x, hand.y, hand.x + hand.tx, hand.y + hand.ty);     // dagger
  if (striking && t > 0.15) { ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - t)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(back.x + back.tx, back.y + back.ty); ctx.quadraticCurveTo(bx + f * 6, y - 52, hand.x + hand.tx, hand.y + hand.ty); ctx.stroke(); }
  ctx.fillStyle = c;
  const hx = bx + f * 3, hy = y - 38 - bob + crouch, ear = Math.sin(tAnim * 8 + x) * 2 + (sp < 0 ? sp * 5 : 0);
  ctx.beginPath(); ctx.arc(hx, hy, 8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(hx - 6, hy - 3); ctx.lineTo(hx - 17, hy - 9 + ear); ctx.lineTo(hx - 5, hy + 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(hx + 6, hy - 3); ctx.lineTo(hx + 17, hy - 9 - ear); ctx.lineTo(hx + 5, hy + 2); ctx.fill();
  ctx.fillStyle = sp < -0.2 ? '#f33' : '#ff0'; ctx.beginPath(); ctx.arc(hx + f * 3, hy - 1, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(hx + f * 2, hy + 3, f * 4, sp < -0.2 ? 3 : 1.5);   // teeth, bared when it winds up
  drawHpBar(m, 58);
}

function drawSlime(m) {
  const { x, y } = m, s = m.size, z = m.hopZ || 0;
  drawShadow(x, y, 16 * s * (1 - z / 60));
  const land = (m.land || 0) / 0.2;
  const sq = m.state === 'crouch' ? 1.3 : m.state === 'hop' ? 0.85 : 1 + Math.sin(tAnim * 6 + x) * 0.07 + land * 0.35;
  ctx.fillStyle = statusTint(m, '#5b5');
  ctx.globalAlpha = 0.88;
  ctx.beginPath();
  ctx.ellipse(x, y - 12 * s / sq - z, 18 * s * sq, 14 * s / sq, 0, Math.PI, 0);
  ctx.lineTo(x + 18 * s * sq, y - z); ctx.lineTo(x - 18 * s * sq, y - z); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';                     // shine
  ctx.beginPath(); ctx.ellipse(x - 7 * s, y - 20 * s / sq - z, 4 * s, 2.5 * s, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#131';
  ctx.beginPath(); ctx.arc(x - 5 * s + m.facing * 3, y - 12 * s / sq - z, 2.5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 5 * s + m.facing * 3, y - 12 * s / sq - z, 2.5 * s, 0, Math.PI * 2); ctx.fill();
  drawHpBar(m, 36 * s + 10 + z);
}

function drawArcher(m) {
  const { x, y, facing: f } = m;
  drawShadow(x, y, 10);
  const ph = m.walkT, c = statusTint(m, world.B.prop === 'pine' ? '#5d5a55' : '#ddd');
  const rattle = Math.sin(tAnim * 20 + x) * 0.6;
  ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.lineCap = 'round';
  drawLegs(x, y - 22, y, f, ph, !!m.moving, 10.5, 9, 4);      // two hips 8px apart, not one point
  ctx.lineWidth = 3;
  line(x - 4, y - 22, x + 4, y - 22);                          // pelvis
  line(x, y - 26, x, y - 44);                                  // spine starts above the pelvis
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) line(x - 6, y - 40 + i * 6 + rattle, x + 6, y - 40 + i * 6 + rattle);   // ribs
  const aim = m.state === 'aim', draw = aim ? Math.min(1, 1 - m.stateT / 0.7) : 0, sp = m.mel ? swingPos(m) : 0;
  const by = y - 38 + (sp < 0 ? sp * 20 : 0), bxo = f * (sp < 0 ? sp * 4 : sp * 12);               // bashing with the bow: raised overhead, then swung down in front
  ctx.lineWidth = 3;
  line(x, y - 40, x + f * 16 + bxo, by);
  ctx.strokeStyle = '#8b5a2b'; ctx.lineWidth = 2;
  const bcx = x + f * 12 + bxo;
  ctx.beginPath();
  if (f > 0) ctx.arc(bcx, by, 12, -1.2, 1.2); else ctx.arc(bcx, by, 12, Math.PI - 1.2, Math.PI + 1.2);
  ctx.stroke();
  const tipX = bcx + f * Math.cos(1.2) * 12, pull = bcx + f * (Math.cos(1.2) * 12 - draw * 12);
  ctx.strokeStyle = '#eee'; ctx.lineWidth = 1;
  line(tipX, by - Math.sin(1.2) * 12, pull, by);
  line(pull, by, tipX, by + Math.sin(1.2) * 12);
  if (aim) { ctx.strokeStyle = '#ccc'; ctx.lineWidth = 2; line(pull, by, pull + f * 20, by); }
  ctx.fillStyle = c;
  ctx.beginPath(); ctx.arc(x, y - 52, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = aim ? '#f33' : '#222';
  ctx.beginPath(); ctx.arc(x + f * 3, y - 53, 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222'; ctx.fillRect(x + f * 1, y - 47, f * 6, 1.5);
  drawHpBar(m, 72);
}

function drawEnemy(m) {
  ctx.save();
  if (m.dieT !== undefined) {                 // death: flash, then a fall of its own (slimes splat, goblins tumble, the rest topple), fade
    const p = m.dieT / m.dieMax;
    ctx.globalAlpha = deathAlpha(m, p);
    drawDeathPuddle(m, p);
    enemyDeathPose(m, p);
    m.flashT = p < 0.15 ? 1 : 0;
  } else {
    if (m.spawnT > 0) {                       // spawn: rise out of the ground
      const p = m.spawnT / 0.5;
      ctx.globalAlpha = 1 - p;
      ctx.translate(0, p * 14);
    } else if (m.alertT > 0) ctx.translate(0, -Math.sin(m.alertT / 0.45 * Math.PI) * 4);          // it notices you: a little start
    if (m.recoilT > 0) { ctx.translate(m.x, m.y); ctx.rotate(-m.facing * m.recoilT * 0.7); ctx.translate(-m.x - m.facing * m.recoilT * 18, -m.y); }   // knocked back by a blow
    drawMobWindup(m);
    applyFidget(m);
    if (m.sleep) { ctx.translate(m.x, m.y); ctx.rotate(m.facing * 0.04); ctx.scale(1.03, 0.93 + Math.sin(tAnim * 1.8 + m.x) * 0.015); ctx.translate(-m.x, -m.y); }          // asleep: slumped, breathing slowly
  }
  const giant = m.scale > 1;
  if (giant) { ctx.save(); ctx.translate(m.x, m.y); ctx.scale(m.scale, m.scale); ctx.translate(-m.x, -m.y); }          // Giants are drawn bigger (their tags are not)
  if (m.type === 'boss') drawBossArt(m);
  else if (m.type === 'minotaur') { drawMinotaur(m); drawHpBar(m, 100); }
  else if (m.type === 'ogre') { drawMinotaur(m, 1.4, '#6a7a3a'); drawHpBar(m, 130); }
  else if (m.type === 'goblin') drawGoblin(m);
  else if (m.type === 'slime') drawSlime(m);
  else if (m.type === 'archer') drawArcher(m);
  else if (m.type === 'wolf') drawQuad(m, { s: 1, c: '#8a8a94', eye: '#ffe060', tail: 4 });
  else if (m.type === 'panther') drawQuad(m, { s: 1.25, c: '#2a2a34', eye: '#ffe060', tail: 12 });
  else if (m.type === 'scorpion') drawScorpion(m);
  else if (m.type === 'icesprite' || m.type === 'fireimp' || m.type === 'harpy') drawFlyer(m, m.type);
  else if (m.type === 'bogLurker') drawLurker(m);
  else if (m.type === 'treant') drawTreant(m);
  else if (m.type === 'mummy') drawMummy(m);
  else if (m.type === 'frostwolf') drawQuad(m, { s: 1.05, c: '#5a6c8e', eye: '#aef0ff', tail: 6 });
  else if (m.type === 'magmaslime') drawMagmaSlime(m);
  else if (m.type === 'wisp') drawWisp(m);
  else if (m.type === 'sporeshroom') drawShroom(m);
  else if (m.type === 'cursedKnight') drawKnight(m);
  else if (m.type === 'golem') drawGolem(m);
  else if (m.type === 'skeleton') drawSkeleton(m);
  if (giant) ctx.restore();
  if (m.leader || m.evoName) drawEvoTag(m);
  drawVariantTells(m);
  ctx.restore();
}

function drawDrop(d) {
  const color = d.kind === 'gear' ? RARITIES[d.item.rarity].color : d.kind === 'rune' ? RUNES[d.rune].color : d.kind === 'essence' ? ESS[d.ess].color : DROPS[d.kind].color;
  const fadeOut = d.t < 3 ? 0.35 + 0.65 * Math.abs(Math.sin(d.t * 3)) : 1;   // gentle pulse before despawning
  const y = d.y - 8 + Math.sin(d.bob) * 3 - d.pop * 40;
  drawShadow(d.x, d.y, 7);
  ctx.save();
  ctx.globalAlpha = fadeOut;
  if (gfx.glow) {
    const g = ctx.createRadialGradient(d.x, y, 0, d.x, y, 18);
    g.addColorStop(0, withAlpha(color, 0.4)); g.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = g; ctx.fillRect(d.x - 18, y - 18, 36, 36);
  }
  ctx.fillStyle = color; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
  if (d.kind === 'potion' || d.kind === 'energy' || d.kind === 'big') {
    const s = d.kind === 'big' ? 1.4 : 1;
    ctx.beginPath(); ctx.arc(d.x, y, 7 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ccc'; ctx.fillRect(d.x - 2.5 * s, y - 12 * s, 5 * s, 6 * s);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(d.x - 2.5 * s, y - 2.5 * s, 2 * s, 0, Math.PI * 2); ctx.fill();
  } else if (d.kind === 'gold') {
    const sz = 4.5 + Math.min(3.5, Math.log10(d.amount + 1) * 2), spin = Math.abs(Math.cos(tAnim * 3.5 + d.bob));
    ctx.strokeStyle = '#8a6a1c';
    ctx.beginPath(); ctx.ellipse(d.x, y, sz * (0.28 + 0.72 * spin), sz, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,243,192,0.8)'; ctx.beginPath(); ctx.ellipse(d.x - sz * 0.25 * spin, y - sz * 0.3, sz * 0.2 * spin + 0.5, sz * 0.35, 0, 0, Math.PI * 2); ctx.fill();
  } else if (d.kind === 'gear') {                              // a little chest in the rarity colour; the good ones send up a beam
    if (d.item.rarity >= 4) { const bg = ctx.createLinearGradient(0, y - 80, 0, y); bg.addColorStop(0, withAlpha(color, 0)); bg.addColorStop(1, withAlpha(color, 0.55)); ctx.fillStyle = bg; ctx.fillRect(d.x - 4, y - 80, 8, 80); }
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(d.x - 9, y - 7, 18, 14, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(d.x - 9, y - 1, 18, 2); ctx.fillStyle = '#fff'; ctx.fillRect(d.x - 1.5, y - 3, 3, 5);
  } else if (d.kind === 'essence') {                           // a drop of liquid magic in a glowing bead
    const pulse = 0.6 + 0.4 * Math.sin(tAnim * 5 + d.bob);
    ctx.fillStyle = '#1d1a2c'; ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(d.x, y, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color; ctx.globalAlpha *= pulse; ctx.beginPath(); ctx.moveTo(d.x, y - 5); ctx.quadraticCurveTo(d.x + 4.5, y + 0.5, d.x, y + 4.5); ctx.quadraticCurveTo(d.x - 4.5, y + 0.5, d.x, y - 5); ctx.fill();
  } else if (d.kind === 'rune') {                              // a small cut stone with its glyph glowing
    ctx.fillStyle = '#262432'; ctx.strokeStyle = color; ctx.lineWidth = 1.6;
    ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3; ctx.lineTo(d.x + Math.cos(a) * 9, y + Math.sin(a) * 9); } ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color; ctx.globalAlpha *= 0.65 + 0.35 * Math.sin(tAnim * 4 + d.bob); ctx.beginPath(); ctx.moveTo(d.x, y - 4.5); ctx.lineTo(d.x + 3.2, y); ctx.lineTo(d.x, y + 4.5); ctx.lineTo(d.x - 3.2, y); ctx.closePath(); ctx.fill();
  } else if (d.kind === 'gem') {
    ctx.beginPath(); ctx.moveTo(d.x, y - 9); ctx.lineTo(d.x + 7, y); ctx.lineTo(d.x, y + 9); ctx.lineTo(d.x - 7, y); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else {
    ctx.translate(d.x, y); ctx.rotate(tAnim * 1.5);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 4 : 10;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function drawGrassAndDecor() {
  const B = world.B;
  if (gfx.decor) {
    for (const d of world.decor) {
      if (!inView(d.x, d.y, 14)) continue;
      (DECOR_ART[d.k] || DECOR_ART.dot)(d);
    }
  }
  if (!gfx.grass || !gfx.anim || !world.grassC) return;                 // still grass is already part of the ground
  const wind = Math.sin(tAnim * 0.7) * 1.5 * windMul() + (windMul() - 1) * 1.6;
  const hx = hero ? hero.x : -999, hy = hero ? hero.y : -999;
  const x0 = cam.x - 10, x1 = cam.x + VW + 10, y0 = cam.y - 10, y1 = cam.y + VH + 10;
  ctx.lineWidth = 1.3; ctx.lineCap = 'butt';                          // butt ends: a 1.3 px blade looks the same and costs about half
  for (let c = 0; c < 2; c++) {
    const arr = world.grassC[c];
    let lo = 0, hi = arr.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].x < x0) lo = m + 1; else hi = m; }       // first blade inside the strip
    ctx.strokeStyle = B.grass[c];
    ctx.beginPath();
    for (let i = lo; i < arr.length; i++) {
      const g = arr[i];
      if (g.x > x1) break;
      if (g.y < y0 || g.y > y1) continue;
      let off = Math.sin(tAnim * 2.2 + g.ph + g.x * 0.01) * 2 + wind;
      const dx = g.x - hx, dy = g.y - hy;
      if (dx * dx < 900 && dy * dy < 144) off += Math.sign(dx) * (30 - Math.abs(dx)) * 0.35;      // pushed aside by the hero
      ctx.moveTo(g.x, g.y); ctx.lineTo(g.x - 1.5 + off, g.y - g.s);
      ctx.moveTo(g.x, g.y); ctx.lineTo(g.x + 1.5 + off, g.y - g.s * 0.9);
    }
    ctx.stroke();
  }
  ctx.lineCap = 'round';
}

function drawLavaGlow() {
  if (!gfx.glow || !world.lava.length) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const l of world.lava) {
    if (!inView(l.x, l.y, l.rx * 2)) continue;
    const a = 0.12 + Math.sin(tAnim * 2 + l.x) * 0.06;
    const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.rx * 1.8);
    g.addColorStop(0, `rgba(255,120,30,${a})`); g.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(l.x, l.y, l.rx * 1.8, l.ry * 1.8, 0, 0, Math.PI * 2); ctx.fill();
    if (gfx.anim && Math.random() < 0.05) particles.push({ x: l.x + (Math.random() - 0.5) * l.rx, y: l.y + (Math.random() - 0.5) * l.ry, vx: 0, vy: -30, life: 0.6, max: 0.6, size: 3, color: '#ffb040', add: true });
  }
  ctx.restore();
}

function drawParticles() {
  ctx.save();
  for (const p of particles) {
    if (!inView(p.x, p.y, 20)) continue;
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / Math.min(p.max, 0.5)));
    ctx.globalCompositeOperation = p.add && gfx.glow ? 'lighter' : 'source-over';
    if (drawSpecialParticle(p)) continue;
    ctx.fillStyle = p.color;
    if (p.streak) ctx.fillRect(p.x, p.y, 8, 1);
    else if (p.kind === 'fly') {
      const tw = 0.5 + Math.sin(tAnim * 5 + p.x) * 0.5;
      ctx.globalAlpha *= tw;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2); ctx.fillStyle = 'rgba(230,255,120,0.25)'; ctx.fill();
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.7, 0, Math.PI * 2); ctx.fill();
    } else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}

function drawWorld() {
  if (dun) ctx.drawImage(dun.f.ground, cam.x, cam.y, VW, VH, cam.x, cam.y, VW, VH);
  else {
    ctx.drawImage(world.ground, cam.x, cam.y, VW, VH, cam.x, cam.y, VW, VH);
    drawWater();
    drawLavaGlow();
    drawGrassAndDecor();
    drawCloudShadows();
  }
  for (const s of shockwaves) {
    ctx.strokeStyle = s.color ? withAlpha(s.color, 1 - s.r / s.maxR) : `rgba(255,220,150,${1 - s.r / s.maxR})`; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r / 1.6, 0, 0, Math.PI * 2); ctx.stroke();
    if (gfx.glow) { ctx.lineWidth = 14; ctx.strokeStyle = s.color ? withAlpha(s.color, 0.25 * (1 - s.r / s.maxR)) : `rgba(255,180,90,${0.25 * (1 - s.r / s.maxR)})`; ctx.stroke(); }
  }
  drawHazards();
  for (const m of enemies) if (m.type === 'boss' && inView(m.x, m.y, 400)) drawBossTelegraph(m);
  if (!hero) { for (const p of world.props) if (inView(p.x, p.y)) drawProp(p); return; }
  for (const d of drops) if (inView(d.x, d.y)) drawDrop(d);

  const things = [];
  if (dun) things.push(...dunThings());
  else {
    for (const p of world.props) if (inView(p.x, p.y)) things.push({ y: p.y, d: () => drawProp(p) });
    for (const c of critters) if (inView(c.x, c.y, c.kind === 'fish' ? 200 : 100)) things.push({ y: c.y, d: () => drawCritter(c) });
    for (const d of devils) if (inView(d.x, d.y, 120)) things.push({ y: d.y, d: () => drawDevil(d) });
    if (dunDoor) things.push({ y: dunDoor.y, d: () => drawDungeonDoor(dunDoor) });
  }
  for (const c of corpses) if (inView(c.x, c.y)) things.push({ y: c.y, d: () => drawEnemy(c) });
  for (const s of heroShots) if (inView(s.x, s.y, 60)) things.push({ y: s.y + 1, d: () => drawHeroShot(s) });
  for (const m of enemies) if (inView(m.x, m.y, 120)) things.push({ y: m.y, d: () => drawEnemy(m) });
  things.push({ y: hero.y, d: () => drawHero(hero) });
  things.sort((a, b) => a.y - b.y).forEach(o => o.d());
  drawDunPrompt();

  ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2;
  for (const p of projectiles) {
    if (p.knife || p.orb) { drawShot(p); continue; }
    const a = Math.atan2(p.vy, p.vx);
    line(p.x, p.y, p.x - Math.cos(a) * 16, p.y - Math.sin(a) * 16);
    ctx.fillStyle = '#999'; ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
  }
}

// World numbers (damage, MISS...) float over the fight and are nudged apart when they would land on each other.
// Messages and banners (popup.screen) are laid out in lanes so they never sit on top of each other or on the HUD: big banners and messages stack down from the top centre
// (between the two top panels), messages that were placed low on the screen stack up from just above the vitals. Long text wraps, repeats collapse into one, and only the newest few show.
const TOAST_MAX_W = 440, TOAST_TOP = 112, TOAST_LOW = VH - 128, toastRects = [];      // toastRects: where the messages were drawn last frame (the tests check they never overlap)
function wrapLines(text, font, maxW) {
  ctx.font = font; const out = []; let line = '';
  for (const w of String(text).split(' ')) { const t = line ? line + ' ' + w : w; if (line && ctx.measureText(t).width > maxW) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line);
  return out.slice(0, 3);
}
function drawToasts() {
  toastRects.length = 0;
  const seen = new Set(), list = [];
  for (let i = popups.length - 1; i >= 0; i--) { const p = popups[i]; if (!p.screen || seen.has(p.text)) continue; seen.add(p.text); list.unshift(p); }       // the newest of any repeated message
  const top = list.filter(p => p.y <= VH * 0.6).slice(-4), low = list.filter(p => p.y > VH * 0.6).slice(-3);
  const place = (arr, y0, dir) => {
    let y = y0;
    for (const p of arr.slice().reverse()) {                                  // the newest sits nearest the start of its lane
      if (p.t0 === undefined) p.t0 = p.t;
      const age = p.t0 - p.t, fin = clamp01(age / 0.18), fout = clamp01(p.t / 0.35), a = Math.min(fin, fout);
      const size = p.big ? 21 : 14.5, font = `${p.big ? 800 : 600} ${size}px ${UI_FONT}`, lines = wrapLines(p.text, font, TOAST_MAX_W - 34), lh = size + 4;
      const w = Math.min(TOAST_MAX_W, Math.max(...lines.map(l => ctx.measureText(l).width)) + 34), h = lines.length * lh + 12;
      const cx = VW / 2, ty = dir > 0 ? y : y - h, slide = (1 - fin) * -10 * dir;
      toastRects.push({ x: cx - w / 2, y: ty, w, h });
      ctx.save(); ctx.globalAlpha = a; ctx.translate(0, slide);
      const col = p.color || '#fff';
      const g = ctx.createLinearGradient(0, ty, 0, ty + h); g.addColorStop(0, 'rgba(58,40,28,.92)'); g.addColorStop(1, 'rgba(28,19,14,.92)');
      ctx.fillStyle = g; ctx.strokeStyle = col; ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
      ctx.beginPath(); ctx.roundRect(cx - w / 2, ty, w, h, 9); ctx.fill(); ctx.shadowColor = 'transparent'; ctx.globalAlpha = a * 0.55; ctx.stroke(); ctx.globalAlpha = a;
      ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = font;
      lines.forEach((l, i) => ctx.fillText(l, cx, ty + 6 + lh * i + lh / 2));
      ctx.restore();
      y += dir * (h + 6);
    }
  };
  place(top, TOAST_TOP, 1); place(low, TOAST_LOW, -1);
}
function drawPopups(screen) {
  if (screen) { drawToasts(); return; }
  const placed = [];
  for (const p of popups) {
    if (p.screen) continue;
    const grow = p.pop !== undefined ? 1 + Math.max(0, 0.6 - p.pop * 4) * (p.crit ? 1.2 : 0.6) : 1;
    const size = Math.round((p.big ? 26 : p.small ? 13 : 16) * grow * (p.crit ? 1.15 : 1));
    ctx.font = `800 ${size}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const w = ctx.measureText(p.text).width + 6;
    let y = p.y;
    for (let k = 0; k < 6 && placed.some(r => Math.abs(r.x - p.x) < (r.w + w) / 2 && Math.abs(r.y - y) < size * 0.9); k++) y -= size * 0.9;       // keep clear of the numbers already drawn
    placed.push({ x: p.x, y, w });
    ctx.globalAlpha = Math.min(1, p.t * 2.2);
    ctx.lineJoin = 'round'; ctx.lineWidth = p.crit ? 5 : 4; ctx.strokeStyle = p.crit ? 'rgba(90,30,0,.85)' : 'rgba(0,0,0,.7)';
    ctx.strokeText(p.text, p.x, y);
    ctx.fillStyle = p.color || '#fff'; ctx.fillText(p.text, p.x, y);
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- the HUD kit: one look for every panel, and text that always fits
const UI_FONT = '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif';
// the largest font (down to min) in which the text fits maxW; if even that is too wide it is cut with an ellipsis. Returns the text to draw; ctx.font is set.
const fitCache = new Map();
function fitText(text, maxW, size, bold = false, min = 8) {
  const ck = text + '|' + maxW + '|' + size + '|' + bold + '|' + min, hit = fitCache.get(ck);
  if (hit) { ctx.font = hit.font; return hit.t; }
  const r = fitTextNow(text, maxW, size, bold, min);
  if (fitCache.size > 400) fitCache.clear();
  fitCache.set(ck, { t: r, font: ctx.font }); return r;
}
function fitTextNow(text, maxW, size, bold, min) {
  const font = s => `${bold ? 'bold ' : ''}${s}px ${UI_FONT}`;
  let s = size; ctx.font = font(s);
  while (s > min && ctx.measureText(text).width > maxW) { s -= 0.5; ctx.font = font(s); }
  let t = String(text);
  if (ctx.measureText(t).width > maxW) { while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1); t += '…'; }
  return t;
}
const panelCache = new Map(), PANEL_PAD = 22;
function hudPanel(x, y, w, h, o = {}) {
  const S = canvas.width / VW, ck = [Math.round(w), Math.round(h), o.r ?? 12, o.edge || '', o.accent || '', gfx.shadows ? 1 : 0, S.toFixed(3)].join('|');
  let pc = panelCache.get(ck);
  if (!pc) {
    if (panelCache.size > 60) panelCache.clear();
    const cw = Math.ceil((Math.round(w) + PANEL_PAD * 2) * S), ch = Math.ceil((Math.round(h) + PANEL_PAD * 2) * S);
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const cx = c.getContext('2d');
    drawPanelTo(cx, PANEL_PAD, PANEL_PAD, Math.round(w), Math.round(h), o, S);
    pc = c; panelCache.set(ck, pc);
  }
  ctx.drawImage(pc, Math.round(x) - PANEL_PAD, Math.round(y) - PANEL_PAD, pc.width / S, pc.height / S);
}
function drawPanelTo(ctx, x, y, w, h, o, S) {
  ctx.setTransform(S, 0, 0, S, 0, 0);
  const r = o.r ?? 12;
  ctx.save();
  if (gfx.shadows) { ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 3; }
  const gr = ctx.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(82,58,41,0.93)'); gr.addColorStop(1, 'rgba(36,25,17,0.93)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip();                            // faint plank seams
  ctx.strokeStyle = 'rgba(0,0,0,0.17)'; ctx.lineWidth = 1;
  for (let px = x + 44; px < x + w - 8; px += 44) { ctx.beginPath(); ctx.moveTo(px + 0.5, y); ctx.lineTo(px + 0.5, y + h); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = o.edge || '#9a6f3c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x + 1, y + 1, w - 2, h - 2, r); ctx.stroke();            // the wooden frame
  ctx.strokeStyle = 'rgba(18,10,6,0.85)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x + 2.5, y + 2.5, w - 5, h - 5, Math.max(2, r - 2)); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,226,170,0.2)'; ctx.beginPath(); ctx.moveTo(x + r, y + 3.5); ctx.lineTo(x + w - r, y + 3.5); ctx.stroke();       // a highlight along the top edge
  if (w > 46 && h > 26) { ctx.fillStyle = '#efc86c'; for (const [nx, ny] of [[x + 6.5, y + 6.5], [x + w - 6.5, y + 6.5], [x + 6.5, y + h - 6.5], [x + w - 6.5, y + h - 6.5]]) { ctx.beginPath(); ctx.arc(nx, ny, 1.5, 0, Math.PI * 2); ctx.fill(); } }   // brass nails
  if (o.accent) { ctx.fillStyle = o.accent; ctx.beginPath(); ctx.roundRect(x + 5, y + 10, 3, h - 20, 2); ctx.fill(); }
  ctx.restore();
}
// a small rounded label; returns its width
function hudChip(text, x, y, color, size = 10.5) {
  ctx.font = `bold ${size}px ${UI_FONT}`;
  const w = Math.ceil(ctx.measureText(text).width) + 12;
  ctx.fillStyle = 'rgba(40,26,17,0.85)'; ctx.beginPath(); ctx.roundRect(x, y - 11, w, 16, 8); ctx.fill();
  ctx.strokeStyle = color; ctx.globalAlpha = 0.7; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x + 0.5, y - 10.5, w - 1, 15, 7.5); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.fillText(text, x + 6, y + 0.5);
  return w;
}
function hudBar(x, y, w, h, frac, bg, fg, label, glow) {
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
  const fw = w * Math.max(0, Math.min(1, frac));
  if (fw > 1) {
    const gr = ctx.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, withAlpha(fg, 1)); gr.addColorStop(1, withAlpha(fg, 0.72));
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(x, y, Math.max(h, fw), h, h / 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.roundRect(x + 1, y + 1, Math.max(h - 2, fw - 2), h / 2.6, h / 4); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, h / 2); ctx.stroke();
  if (glow && gfx.glow) { ctx.strokeStyle = fg; ctx.globalAlpha = 0.35; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.stroke(); ctx.globalAlpha = 1; }
  if (label && h >= 10) {
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.font = `bold 10px ${UI_FONT}`;
    ctx.textAlign = 'right'; ctx.fillText(label, x + w - 7, y + h - 3); ctx.textAlign = 'left';
  }
}

// ---------------------------------------------------------------- the HUD
// bottom centre: health to the left of the level circle, stamina to the right, and the experience as a ring round the circle.
const clamp01 = x => Math.max(0, Math.min(1, x));
function vitalBar(x, w, y, h, frac, c1, c2, side, label, mark) {
  const r = h / 2;
  ctx.fillStyle = 'rgba(6,6,12,0.75)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  const fw = frac > 0.002 ? Math.max(h, w * clamp01(frac)) : 0;
  if (fw) {
    const fx = side < 0 ? x + w - fw : x, gr = ctx.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(fx, y, fw, h, r); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.roundRect(fx + 2, y + 2, fw - 4, h * 0.34, r / 2); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  for (const f of [0.25, 0.5, 0.75]) { const tx = side < 0 ? x + w - w * f : x + w * f; ctx.beginPath(); ctx.moveTo(tx, y + 3); ctx.lineTo(tx, y + h - 3); ctx.stroke(); }
  if (mark) { const mx = side < 0 ? x + w - w * mark : x + w * mark; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(mx, y - 1.5); ctx.lineTo(mx, y + h + 1.5); ctx.stroke(); }
  if (label) {
    const t = fitText(label, w - 16, 10, true, 8); ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.strokeText(t, x + w / 2, y + h - 3.5);
    ctx.fillStyle = '#fff'; ctx.fillText(t, x + w / 2, y + h - 3.5); ctx.textAlign = 'left';
  }
}
// Everything harmful that is on the hero right now. A new ailment is one more entry in AILS (variants.js) and one more icon here; a Healing Potion clears them all.
const AILMENT_ICON = {
  poison(c, r) {                                                    // a skull with a drip
    c.fillStyle = '#e9ffe9'; c.beginPath(); c.arc(0, -1.5, r * 0.5, 0, Math.PI * 2); c.fill(); c.fillRect(-r * 0.27, r * 0.1, r * 0.54, r * 0.38);
    c.fillStyle = '#0d2a12'; c.beginPath(); c.arc(-r * 0.2, -r * 0.1, r * 0.14, 0, Math.PI * 2); c.arc(r * 0.2, -r * 0.1, r * 0.14, 0, Math.PI * 2); c.fill();
    c.fillRect(-1, r * 0.08, 2, r * 0.18); c.fillRect(-r * 0.12, r * 0.3, 1.3, r * 0.18); c.fillRect(r * 0.1, r * 0.3, 1.3, r * 0.18);
  },
  bleed(c, r) {                                                     // a falling drop
    c.fillStyle = '#ffd6dc'; c.beginPath(); c.moveTo(0, -r * 0.62); c.quadraticCurveTo(r * 0.62, r * 0.12, 0, r * 0.62); c.quadraticCurveTo(-r * 0.62, r * 0.12, 0, -r * 0.62); c.fill();
    c.fillStyle = '#8a1a2a'; c.beginPath(); c.arc(-r * 0.16, r * 0.18, r * 0.12, 0, Math.PI * 2); c.fill();
  },
  burn(c, r) {                                                      // a flame
    c.fillStyle = '#fff1c8'; c.beginPath(); c.moveTo(0, -r * 0.66); c.quadraticCurveTo(r * 0.7, -r * 0.05, r * 0.38, r * 0.4); c.quadraticCurveTo(0, r * 0.7, -r * 0.38, r * 0.4); c.quadraticCurveTo(-r * 0.62, 0, -r * 0.14, -r * 0.3); c.quadraticCurveTo(-r * 0.12, -r * 0.5, 0, -r * 0.66); c.fill();
    c.fillStyle = '#ff7a20'; c.beginPath(); c.arc(0, r * 0.25, r * 0.2, 0, Math.PI * 2); c.fill();
  },
  freeze(c, r) {                                                    // an ice crystal
    c.fillStyle = '#e8fbff'; c.strokeStyle = '#2a6a8a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, -r * 0.66); c.lineTo(r * 0.4, 0); c.lineTo(0, r * 0.66); c.lineTo(-r * 0.4, 0); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(0, -r * 0.66); c.lineTo(0, r * 0.66); c.moveTo(-r * 0.4, 0); c.lineTo(r * 0.4, 0); c.stroke();
  },
  weak(c, r) {                                                      // a sword with a down arrow
    c.strokeStyle = '#fff3d6'; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(-r * 0.35, r * 0.35); c.lineTo(r * 0.3, -r * 0.4); c.stroke();
    c.beginPath(); c.moveTo(-r * 0.5, r * 0.15); c.lineTo(-r * 0.15, r * 0.5); c.stroke();
    c.fillStyle = '#ff6a5a'; c.beginPath(); c.moveTo(r * 0.45, r * 0.0); c.lineTo(r * 0.7, r * 0.0); c.lineTo(r * 0.575, r * 0.3); c.closePath(); c.fill();
  },
  blind(c, r) {                                                     // an eye with a bar across it
    c.fillStyle = '#f2f2fa'; c.beginPath(); c.ellipse(0, 0, r * 0.62, r * 0.36, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#242436'; c.beginPath(); c.arc(0, 0, r * 0.2, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#ff6a5a'; c.lineWidth = 2; c.beginPath(); c.moveTo(-r * 0.6, r * 0.5); c.lineTo(r * 0.6, -r * 0.5); c.stroke();
  },
  curse(c, r) {                                                     // a violet rune
    c.strokeStyle = '#e6ccff'; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -r * 0.62); c.lineTo(r * 0.46, -r * 0.2); c.lineTo(r * 0.46, r * 0.25); c.lineTo(0, r * 0.62); c.lineTo(-r * 0.46, r * 0.25); c.lineTo(-r * 0.46, -r * 0.2); c.closePath(); c.stroke();
    c.beginPath(); c.moveTo(-r * 0.2, -r * 0.2); c.lineTo(r * 0.2, r * 0.2); c.moveTo(r * 0.2, -r * 0.2); c.lineTo(-r * 0.2, r * 0.2); c.stroke();
  },
  chill(c, r) {                                                     // a snowflake
    c.strokeStyle = '#eaf9ff'; c.lineWidth = 1.7; c.lineCap = 'round';
    for (let i = 0; i < 3; i++) { c.save(); c.rotate(i * Math.PI / 3); c.beginPath(); c.moveTo(0, -r * 0.62); c.lineTo(0, r * 0.62); c.moveTo(-r * 0.2, -r * 0.42); c.lineTo(0, -r * 0.24); c.lineTo(r * 0.2, -r * 0.42); c.moveTo(-r * 0.2, r * 0.42); c.lineTo(0, r * 0.24); c.lineTo(r * 0.2, r * 0.42); c.stroke(); c.restore(); }
  },
};
function activeAilments() {
  const out = [];
  if (hero.poison) out.push({ id: 'poison', name: 'Poisoned', color: '#5fe05f', stacks: hero.poison.stacks, t: hero.poison.t, max: POISON_TIME });
  if (hero.chillT > 0) out.push({ id: 'chill', name: 'Chilled', color: '#6fd0ff', stacks: 1, t: hero.chillT, max: Math.max(2.5, hero.chillT) });
  for (const k of AIL_KEYS) if (ailT(k) > 0) out.push({ id: k, name: AILS[k].name, color: AILS[k].color, stacks: hero.ail[k].stacks, t: hero.ail[k].t, max: Math.max(hero.ail[k].max || 1, hero.ail[k].t) });
  return out;
}
// big round badges just above the health and stamina bars: a coloured ring that drains with the time left, the icon, the stack count and the seconds
function drawAilments(cx, topY) {
  const list = activeAilments(); if (!list.length) return;
  const R2 = 18, gapX = 48, x0 = cx - (list.length - 1) * gapX / 2, cy = topY - R2 - 4;
  list.forEach((a, i) => {
    const x = x0 + i * gapX, pulse = 0.5 + 0.5 * Math.sin(tAnim * 6 + i), low = a.t < 1.2 && Math.sin(tAnim * 14) > 0;
    ctx.save(); ctx.translate(x, cy);
    if (gfx.glow) { const gr = ctx.createRadialGradient(0, 0, R2 * 0.6, 0, 0, R2 + 9); gr.addColorStop(0, withAlpha(a.color, 0.35 + 0.2 * pulse)); gr.addColorStop(1, withAlpha(a.color, 0)); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, R2 + 9, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = 'rgba(8,10,16,0.92)'; ctx.beginPath(); ctx.arc(0, 0, R2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = withAlpha(a.color, 0.28); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, R2 - 1, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = low ? '#fff' : a.color; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, R2 - 1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp01(a.t / a.max)); ctx.stroke(); ctx.lineCap = 'butt';
    ctx.save(); ctx.translate(0, 0.5); AILMENT_ICON[a.id](ctx, R2 * 0.95); ctx.restore();
    ctx.textAlign = 'center';
    if (a.stacks > 1) { ctx.fillStyle = a.color; ctx.beginPath(); ctx.arc(R2 - 2, R2 - 3, 7, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#04120a'; ctx.font = `bold 10px ${UI_FONT}`; ctx.fillText('x' + a.stacks, R2 - 2, R2 + 0.5); }
    ctx.restore();
    ctx.textAlign = 'center'; ctx.font = `bold 10px ${UI_FONT}`; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; const sec = Math.ceil(a.t) + 's';
    ctx.strokeText(sec, x, cy - R2 - 4); ctx.fillStyle = a.color; ctx.fillText(sec, x, cy - R2 - 4);
  });
  ctx.textAlign = 'left';
}
function drawVitals(inVillage) {
  const cx = VW / 2, cy = VH - 33, Rr = 23, bw = 170, bh = 14, gap = 9, by = cy - bh / 2;
  const hpF = hero.hp / hero.maxHp, lowHp = hpF < 0.3, canAct = inVillage || hero.stamina >= hero.sword.cost;
  const total = (Rr + gap + bw) * 2 + 24;
  hudPanel(cx - total / 2, cy - bh / 2 - 7, total, bh + 14, { r: (bh + 14) / 2 });
  drawAilments(cx, cy - bh / 2 - 7 - 14);
  if (hero.util === 'scroll') drawRecallChip(cx - total / 2 - 50, cy); else drawPotionSlot(cx - total / 2 - 50, cy);                              // the selected potion sits just left of the health bar
  // health (left of the circle) and stamina (right of it); both fill outwards from the circle
  vitalBar(cx - Rr - gap - bw, bw, by, bh, hpF, lowHp && !settings.comfort && Math.sin(tAnim * 5) > 0 ? '#ff8a8a' : '#f06468', '#b8333a', -1, `${Math.ceil(hero.hp)} / ${hero.maxHp}`, regenCap() < 1 ? regenCap() : 0);
  vitalBar(cx + Rr + gap, bw, by, bh, hero.stamina / maxStamina(), canAct ? '#76e08e' : '#9a9aa8', canAct ? '#2f9a52' : '#5e5e6c', 1, null, 0);
  if (!inVillage && hero.flipCd > 0) {                                    // the flip coming back, as a thin line under the stamina bar
    const f = clamp01(1 - hero.flipCd / Math.max(0.05, flipCooldown()));
    ctx.fillStyle = 'rgba(111,181,255,0.25)'; ctx.beginPath(); ctx.roundRect(cx + Rr + gap, by + bh + 3, bw, 3, 1.5); ctx.fill();
    ctx.fillStyle = '#6fb5ff'; ctx.beginPath(); ctx.roundRect(cx + Rr + gap, by + bh + 3, Math.max(3, bw * f), 3, 1.5); ctx.fill();
  }
  // the level circle, with the experience running round its edge
  const cap = hero.level >= levelCap(), xf = cap ? 1 : clamp01(hero.xp / hero.xpNext), pulse = hero.auraT > 0 ? Math.min(1, hero.auraT) : 0;
  ctx.save();
  if (gfx.shadows) { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 3; }
  const disc = ctx.createRadialGradient(cx, cy - 8, 4, cx, cy, Rr + 4); disc.addColorStop(0, '#34344f'); disc.addColorStop(1, '#14141f');
  ctx.fillStyle = disc; ctx.beginPath(); ctx.arc(cx, cy, Rr + 3, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.strokeStyle = 'rgba(190,190,240,0.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, Rr + 3.5, 0, Math.PI * 2); ctx.stroke();
  const xr = Rr - 2.5;
  ctx.lineCap = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.arc(cx, cy, xr, 0, Math.PI * 2); ctx.stroke();
  if (xf > 0.003) {
    const xg = ctx.createLinearGradient(cx - xr, cy - xr, cx + xr, cy + xr); xg.addColorStop(0, cap ? '#e6dcff' : '#9fd4ff'); xg.addColorStop(1, cap ? '#9a7ee8' : '#4a8fe0');
    ctx.strokeStyle = xg; ctx.beginPath(); ctx.arc(cx, cy, xr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * xf); ctx.stroke();
    if (gfx.glow && (cap || pulse)) { ctx.globalAlpha = 0.25 + 0.2 * Math.sin(tAnim * 3) + pulse * 0.4; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(cx, cy, xr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * xf); ctx.stroke(); ctx.globalAlpha = 1; }
  }
  ctx.lineCap = 'butt';
  ctx.fillStyle = 'rgba(8,8,16,0.8)'; ctx.beginPath(); ctx.arc(cx, cy, Rr - 6, 0, Math.PI * 2); ctx.fill();
  ctx.textAlign = 'center'; ctx.fillStyle = cap ? '#c9b8ff' : '#8f8da8'; ctx.font = `bold 6.5px ${UI_FONT}`; ctx.fillText(cap ? 'MAX' : 'LV', cx, cy - 5.5);
  ctx.fillStyle = '#fff'; ctx.fillText(fitText(String(hero.level), 2 * (Rr - 9), 16, true, 10), cx, cy + 8);
  ctx.restore();
  if (rebirths()) { ctx.font = `bold 10px ${UI_FONT}`; const t = 'R' + rebirths(), w = Math.ceil(ctx.measureText(t).width) + 12; hudChip(t, cx - w / 2, cy + Rr + 2, '#c9b8ff'); }
  ctx.textAlign = 'left';
}
// under the clock: the wave, and ten pips counting the waves to the next boss
function drawWaveChip(inVillage) {
  const x = VW - 164, y = 58, w = 150, h = 46;
  hudPanel(x, y, w, h, { r: 11 });
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; const t = fitText(inVillage ? `Wave ${wave} cleared` : `Wave ${wave}`, inVillage ? w - 28 : 66, 13, true, 10); ctx.fillText(t, x + 14, y + 19);
  if (!inVillage) { const used = Math.ceil(ctx.measureText(t).width); ctx.fillStyle = '#a3a1b8'; ctx.textAlign = 'right'; ctx.fillText(fitText(D().name, w - 28 - used - 8, 11), x + w - 14, y + 19); ctx.textAlign = 'left'; }
  const pos = wave === 0 ? 0 : ((wave - 1) % 10) + 1, py = y + 33;
  for (let i = 1; i <= 10; i++) {
    const px = x + 14 + (i - 1) * 12.4;
    if (i === 10) {
      ctx.fillStyle = pos === 10 ? '#ff5a5a' : '#8a2a2e';
      ctx.beginPath(); ctx.moveTo(px + 4.5, py - 1); ctx.lineTo(px + 9.5, py + 4); ctx.lineTo(px + 4.5, py + 9); ctx.lineTo(px - 0.5, py + 4); ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = i < pos ? '#7fd08a' : i === pos ? (!inVillage && (enemies.length || spawnQueue.length) ? '#fff' : '#7fd08a') : '#2c3140';
      ctx.beginPath(); ctx.roundRect(px, py, 9, 8, 2); ctx.fill();
    }
  }
}
// top left: who you are and what you carry. Every text is fitted to the room it has.
function drawHeroCard(inVillage) {
  const X = 10, Y = 10, W = 236, L = X + 14, Rt = X + W - 12, bw = Rt - L;
  const pts = hero.points > 0;
  const lamp = LAMPS[hero.lamp | 0];
  hudPanel(X, Y, W, 58 + (lamp ? 18 : 0) + (pts ? 20 : 0));
  ctx.textAlign = 'left';
  const gold = fitText(hero.gold.toLocaleString(), 96, 13, true, 9), gw = Math.ceil(ctx.measureText(gold).width), gp = Math.max(0, hero.goldPulse || 0);
  ctx.fillStyle = '#f5c451'; ctx.textAlign = 'right'; ctx.fillText(gold, Rt, Y + 24); ctx.textAlign = 'left';
  ctx.save(); ctx.translate(Rt - gw - 11, Y + 20); ctx.scale(1 + gp, 1 + gp);
  ctx.fillStyle = '#f5c451'; ctx.strokeStyle = '#8a6a1c'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff3c0'; ctx.beginPath(); ctx.arc(-1.8, -1.8, 1.8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#fff'; ctx.fillText(fitText(hero.name, bw - gw - 30, 15, true, 11), L, Y + 24);
  const wi = hero.equip.weapon;
  ctx.fillStyle = RARITIES[wi.rarity].color; ctx.fillText(fitText(wi.name, bw, 12, true, 9), L, Y + 44);
  let ey = Y + 44;
  if (lamp) { ctx.fillStyle = '#ffd88a'; ctx.fillText(fitText(lamp.name, bw, 10.5), L, ey + 16); ey += 16; }
  if (pts) {
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(tAnim * 4);
    ctx.fillStyle = '#f5c451'; ctx.fillText(fitText(`${hero.points} stat point${hero.points === 1 ? '' : 's'}: press ${keyLabel('character')}`, bw, 12, true, 9), L, ey + 17);
    ctx.globalAlpha = 1;
  }
}

function drawHUD() {
  drawHeroCard(false);
  drawVitals(false);
  drawClock(VW - 164, 10);
  drawWaveChip(false);
  drawQuestTracker();

  if (dun) { drawDungeonHUD(); drawDunMini(); } else {
  // minimap
  const mw = 150, mh = 100, mx = VW - mw - 14, my = VH - mh - 14, sx = mw / WW, sy = mh / WH;
  hudPanel(mx - 6, my - 6, mw + 12, mh + 12, { r: 11 });
  ctx.save(); ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip();
  ctx.globalAlpha = 0.85; ctx.drawImage(world.mini, mx, my, mw, mh); ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1;
  ctx.strokeRect(mx + cam.x * sx, my + cam.y * sy, VW * sx, VH * sy);
  ctx.fillStyle = '#f5c451';
  for (const d of drops) if (visibilityAt(d.x, d.y) > 0.4) ctx.fillRect(mx + d.x * sx - 1, my + d.y * sy - 1, 2.5, 2.5);
  for (const m of enemies) {
    if (visibilityAt(m.x, m.y) < 0.4) continue;      // hidden in the dark / fog: no safety net on the minimap
    ctx.fillStyle = m.type === 'boss' ? '#ff5ce0' : m.elite ? '#ffd24a' : '#ff5a5a';
    const r = m.type === 'boss' ? 3 : m.elite ? 2.4 : 1.6;
    ctx.beginPath(); ctx.arc(mx + m.x * sx, my + m.y * sy, r, 0, Math.PI * 2); ctx.fill();
  }
  const sev = visibilitySeverity();
  if (sev > 0.05) {                                   // the map goes dark beyond what the hero can see
    const hx = mx + hero.x * sx, hy = my + hero.y * sy, rr = Math.min(visibilityClearRadius(), 900) * sx;
    const gr = ctx.createRadialGradient(hx, hy, rr, hx, hy, rr + 16);
    gr.addColorStop(0, 'rgba(4,8,16,0)'); gr.addColorStop(1, `rgba(4,8,16,${0.8 * sev})`);
    ctx.fillStyle = gr; ctx.fillRect(mx, my, mw, mh);
  }
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mx + hero.x * sx, my + hero.y * sy, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#a3a1b8'; ctx.textAlign = 'center'; ctx.fillText(fitText(world.B.name, mw + 10, 10.5), mx + mw / 2, my - 11);
  }
  drawDunPromptHud();

  if (boss) {
    const bw = 340, bx = VW / 2 - bw / 2;
    hudPanel(bx - 12, 10, bw + 24, 44, { r: 11, edge: 'rgba(200,70,70,0.55)' });
    ctx.fillStyle = '#ffd8d8'; ctx.textAlign = 'center';
    ctx.fillText(fitText(boss.name.toUpperCase(), bw, 13, true, 10), VW / 2, 29);
    hudBar(bx, 35, bw, 12, boss.hp / boss.maxHp, 'rgba(50,8,8,0.9)', boss.summoned ? '#ff6a2a' : '#d02a2a', null, true);
    ctx.textAlign = 'left';
  }
}

// --- Intro / title scenes ---
function drawSplash() {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.font = 'bold 22px sans-serif'; ctx.fillText('STICK RPG', VW / 2, VH / 2 - 10);
  ctx.globalAlpha = 0.5 + Math.sin(performance.now() / 300) * 0.5;
  ctx.font = '15px sans-serif'; ctx.fillText('Click or press any key to begin', VW / 2, VH / 2 + 24);
  ctx.globalAlpha = 1;
}

// The hero as the intro, the title and the rebirth show them: a lit stickman with a face, spiky hair, a red scarf and cloak that move in the wind, boots, a belt and a sword.
// lit (0..1) is how much light falls on them: low in the dark intro, where only the scarf and the eye stand out; raise lifts the sword overhead (rebirth); hover floats them.
function stickHero(x, y, o = {}) {
  const sc = o.sc || 1, tt = o.t ?? tAnim, lit = o.lit ?? 0.5, walking = !!o.walking, lift = o.lift || 0;
  const C = (b, k = 1) => mixHex(b, '#0a0612', Math.max(0, Math.min(1, (1 - lit) * k)));          // a colour in this light (k < 1: it holds its colour better in the dark)
  const ink = C('#1a1a24', 0.5), hov = o.hover ? Math.sin(tt * 2.2) * 4 + o.hover : 0;
  ctx.save(); ctx.translate(x, y - hov); ctx.scale(sc, sc);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (o.glowCol && gfx.glow) { ctx.shadowColor = o.glowCol; ctx.shadowBlur = 16 / Math.max(1, sc * 0.7); }
  const J = poseStick(0, 0, 1, { p: o.ph || 0, run: walking, lean: walking ? 0.14 : 0.02, breath: walking ? 0 : Math.sin(tt * 2.6) * 1.2, atk: -1 });
  const limb = (a, b, c, col, w) => { ctx.strokeStyle = ink; ctx.lineWidth = w + 1.8; poly(a, b, c); ctx.strokeStyle = col; ctx.lineWidth = w - 0.6; poly(a, b, c); };
  // arms: a raised sword (rebirth) or the carried pose
  let fa = J.front, ba = J.back, blade = J.blade, hand = J.front.e;
  if (o.raise) {
    const r = 0.5 + 0.5 * Math.sin(tt * 1.7);
    fa = ik(J.sh.x, J.sh.y, J.sh.x + 13, J.sh.y - 21 - r * 2, 9.5, 9.5, 1); ba = ik(J.sh.x, J.sh.y, J.sh.x - 12, J.sh.y - 19 + r * 2, 9.5, 9.5, 1);
    blade = -Math.PI / 2 + 0.08; hand = fa.e;
  }
  // the cloak trails behind from the shoulders, the wind lifts it
  const w1 = Math.sin(tt * 5.5), w2 = Math.sin(tt * 4.2 + 1.3), spd = walking ? 1 : 0.4;
  ctx.fillStyle = C('#8a2a32', 0.6); ctx.strokeStyle = ink; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(J.sh.x - 2, J.sh.y - 1);
  ctx.quadraticCurveTo(J.sh.x - 14 - 6 * spd, J.sh.y + 12 - lift * 22, J.sh.x - 24 - 8 * spd + w1 * 3, J.sh.y + 30 - lift * 44 + w2 * 3);
  ctx.lineTo(J.sh.x - 8 + w2 * 2, J.sh.y + 33 - lift * 30); ctx.lineTo(J.hip.x - 4, J.hip.y - 2); ctx.closePath(); ctx.fill(); ctx.stroke();
  limb(J.sh, ba.j, ba.e, C('#2b3046', 0.7), 4.2);                                                    // back arm
  ctx.fillStyle = C('#f7f3ee', 0.8); ctx.beginPath(); ctx.arc(ba.e.x, ba.e.y, 2.6, 0, Math.PI * 2); ctx.fill();
  for (const l of J.legs) { limb(l[0], l[1], l[2], C('#2b3550', 0.7), 4.4); ctx.fillStyle = C('#2a2018', 0.7); ctx.beginPath(); ctx.ellipse(l[2].x + 2.5, l[2].y - 1.6, 5.2, 3, 0, 0, Math.PI * 2); ctx.fill(); }
  // tunic and belt
  ctx.strokeStyle = ink; ctx.lineWidth = 10.6; ctx.lineCap = 'butt'; poly(J.hip, J.neck);
  ctx.strokeStyle = C('#2b3046', 0.7); ctx.lineWidth = 8.4; poly(J.hip, J.neck);
  ctx.strokeStyle = C('#c9a050', 0.7); ctx.lineWidth = 2.6; line(J.hip.x - 4.4, J.hip.y - 4, J.hip.x + 4.4, J.hip.y - 4); ctx.lineCap = 'round';
  // the sword, then the front arm over it
  const bx = Math.cos(blade), by = Math.sin(blade), len = o.raise ? 22 : 30, tipX = hand.x + bx * len, tipY = hand.y + by * len;
  ctx.strokeStyle = ink; ctx.lineWidth = 4.6; line(hand.x - bx * 4, hand.y - by * 4, tipX, tipY);
  ctx.strokeStyle = C('#dfe6f0', 0.35); ctx.lineWidth = 2.6; line(hand.x, hand.y, tipX, tipY);
  ctx.strokeStyle = C('#c9a050', 0.6); ctx.lineWidth = 3; line(hand.x - by * 5, hand.y + bx * 5, hand.x + by * 5, hand.y - bx * 5);
  if (lit > 0.4 || o.raise) { const gl = 0.5 + 0.5 * Math.sin(tt * 6); ctx.fillStyle = `rgba(255,255,255,${0.5 + gl * 0.4})`; ctx.beginPath(); ctx.arc(hand.x + bx * (len * 0.7), hand.y + by * (len * 0.7), 1.8 + gl, 0, Math.PI * 2); ctx.fill(); }
  limb(J.sh, fa.j, fa.e, C('#2b3046', 0.7), 4.2);
  ctx.fillStyle = C('#f7f3ee', 0.8); ctx.beginPath(); ctx.arc(fa.e.x, fa.e.y, 2.8, 0, Math.PI * 2); ctx.fill();
  // head: white like the in-game hero, with a face that looks ahead
  const hd = J.head, tilt = o.raise ? -0.12 : 0;
  ctx.save(); ctx.translate(hd.x, hd.y); ctx.rotate(tilt);
  ctx.fillStyle = C('#f7f3ee', 0.8); ctx.strokeStyle = ink; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  const blink = Math.sin(tt * 0.9 + 1) > 0.97;
  if (lit < 0.3) { ctx.fillStyle = '#d6ecff'; if (gfx.glow) { ctx.shadowColor = '#9fd0ff'; ctx.shadowBlur = 8; } }    // in the dark: one pale eye
  else ctx.fillStyle = '#1a1a24';
  if (blink) ctx.fillRect(2, -1.6, 5, 1.5); else { ctx.beginPath(); ctx.ellipse(4.6, -1.6, 1.7, 2.2, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.shadowBlur = 0; ctx.strokeStyle = C('#1a1a24', 0.7); ctx.lineWidth = 1.4; line(1.6, -5.2, 7.4, -4); ctx.lineWidth = 1.2;   // a brow, and a small steady smile
  ctx.beginPath(); ctx.arc(4, 3, 3.3, 0.35, Math.PI - 0.95); ctx.stroke();
  ctx.fillStyle = `rgba(255,120,120,${0.25 * lit})`; ctx.beginPath(); ctx.arc(2, 3.4, 2.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // the red scarf: knotted at the neck, two tails that stream in the wind (it is the one colour that survives the dark)
  const nk = J.neck, sd = (walking ? 1.15 : 0.9) + lift * 0.25;
  ctx.strokeStyle = ink; ctx.lineWidth = 6.2; line(nk.x - 5, nk.y + 1, nk.x + 5, nk.y + 1);
  ctx.strokeStyle = C('#d23a3a', 0.25); ctx.lineWidth = 4.4; line(nk.x - 5, nk.y + 1, nk.x + 5, nk.y + 1);
  for (let k = 0; k < 2; k++) {
    const dy = k ? 7 : 2, wob = Math.sin(tt * (7 + k) + k * 1.7) * 4 * sd, rise = lift * (13 + k * 8);
    ctx.strokeStyle = ink; ctx.lineWidth = 5.6; ctx.beginPath(); ctx.moveTo(nk.x - 4, nk.y + 1 + dy * 0.3); ctx.quadraticCurveTo(nk.x - 17 * sd, nk.y + 3 + dy - rise * 0.4 + wob, nk.x - 32 * sd, nk.y + dy - rise + wob * 1.6 - 2); ctx.stroke();
    ctx.strokeStyle = C(k ? '#b22a2a' : '#e04848', 0.25); ctx.lineWidth = 3.6; ctx.beginPath(); ctx.moveTo(nk.x - 4, nk.y + 1 + dy * 0.3); ctx.quadraticCurveTo(nk.x - 17 * sd, nk.y + 3 + dy - rise * 0.4 + wob, nk.x - 32 * sd, nk.y + dy - rise + wob * 1.6 - 2); ctx.stroke();
  }
  ctx.restore();
  return J;
}
function stickSilhouette(x, y, ph, sc = 1, walking = true, col = '#000') { return stickHero(x, y, { ph, sc, walking, lit: col === '#000' ? 0.1 : 0.9 }); }

// The intro. Time-driven (everything is a function of t), so a replay can simply start part way in.
//   0-10s  dusk over Aldermere: eight beacons on the ridge, a village with lit windows
//   10-17s the Hollow opens: a flash, the beacons go out, the sky turns, beasts crest the hill
//   17-23s someone walks out of the ash
//   23s    the slash and the title
const INTRO_LEN = 28, INTRO_SHORT_FROM = 17;
const introSeen = () => { try { return localStorage.getItem('stickIntroSeen') === '1'; } catch { return false; } };
const markIntroSeen = () => { try { localStorage.setItem('stickIntroSeen', '1'); } catch {} };
const ssm = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const mixRGB = (c1, c2, k) => `rgb(${c1.map((v, i) => Math.round(v + (c2[i] - v) * k)).join(',')})`;

function drawIntro(t) {
  const F = introFlags, t0 = F.t0 || 0, fade = Math.min(1, (t - t0) / 1.2), hollow = ssm(10, 12.5, t);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, VH);
  // ---- sound cues, once each
  if (!F.toll && t > 0.4) { F.toll = true; Sound.call('toll'); }
  if (!F.hollow && t > 10.1) { F.hollow = true; Sound.call('rumble'); sfx('boom'); }
  if (!F.gust && t > 17.2) { F.gust = true; Sound.call('gust'); }
  // ---- sky: dusk, then the Hollow's red night
  const sky = ctx.createLinearGradient(0, 0, 0, VH);
  sky.addColorStop(0, mixRGB([26, 16, 51], [10, 6, 18], hollow));
  sky.addColorStop(0.55, mixRGB([106, 43, 85], [58, 15, 31], hollow));
  sky.addColorStop(0.82, mixRGB([242, 153, 74], [122, 29, 18], hollow));
  ctx.globalAlpha = fade; ctx.fillStyle = sky; ctx.fillRect(0, 0, VW, VH);
  for (let i = 0; i < 70; i++) {
    const sx = (i * 137) % VW, sy = (i * 71) % (VH * 0.45);
    ctx.globalAlpha = fade * (0.15 + 0.5 * hollow + 0.2 * Math.abs(Math.sin(t * 1.6 + i))) * (sy < VH * 0.3 ? 1 : 0.5);
    ctx.fillStyle = '#fff'; ctx.fillRect(sx, sy, 1.5, 1.5);
  }
  ctx.globalAlpha = fade;
  // ---- the sun sets, and turns into a dark ring when the Hollow opens
  const sunX = VW * 0.7, sunY = VH * 0.5 + Math.min(t, 12) * 5;
  const sg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 190);
  sg.addColorStop(0, `rgba(255,220,130,${0.9 * (1 - hollow)})`); sg.addColorStop(0.35, `rgba(255,170,90,${0.5 * (1 - hollow)})`); sg.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = hollow < 0.5 ? '#ffd98a' : '#12060c'; ctx.beginPath(); ctx.arc(sunX, sunY, 54, 0, Math.PI * 2); ctx.fill();
  if (hollow > 0) { ctx.strokeStyle = `rgba(255,70,40,${0.85 * hollow})`; ctx.lineWidth = 3 + 2 * Math.sin(t * 3); ctx.beginPath(); ctx.arc(sunX, sunY, 58, 0, Math.PI * 2); ctx.stroke(); }
  // ---- the Hollow: a crack in the world with a pillar of pale violet light
  const hx = VW * 0.56 - t * 6, crack = ssm(9.8, 10.7, t);
  const ridgeFar = x => VH * 0.62 + Math.sin((x + t * 6) * 0.006) * 30 + Math.sin((x + t * 6) * 0.006 * 2.7) * 9;
  if (crack > 0) {
    const w = 10 + crack * 70 + Math.sin(t * 9) * 3, top = -20;
    const bg = ctx.createLinearGradient(hx - w, 0, hx + w, 0);
    bg.addColorStop(0, 'rgba(190,160,255,0)'); bg.addColorStop(0.5, `rgba(235,225,255,${0.85 * crack * (0.7 + 0.3 * Math.sin(t * 5))})`); bg.addColorStop(1, 'rgba(190,160,255,0)');
    ctx.fillStyle = bg; ctx.fillRect(hx - w, top, w * 2, ridgeFar(hx) - top);
  }
  // ---- far hill: a village whose windows go dark one by one, and the beasts that come over it
  const hill = (base, amp, freq, col, speed) => {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, VH);
    for (let x = 0; x <= VW; x += 10) ctx.lineTo(x, base + Math.sin((x + t * speed) * freq) * amp + Math.sin((x + t * speed) * freq * 2.7) * amp * 0.3);
    ctx.lineTo(VW, VH); ctx.fill();
  };
  hill(VH * 0.62, 30, 0.006, mixRGB([59, 26, 58], [28, 10, 24], hollow), 6);
  for (let i = 0; i < 6; i++) {
    const x = VW * 0.1 + i * 58 - t * 6 + (i > 2 ? 60 : 0), y = ridgeFar(x) + 4, w = 22 + (i % 3) * 5, h = 15 + (i % 2) * 6;
    ctx.fillStyle = '#1a0b19'; ctx.fillRect(x, y - h, w, h);
    ctx.beginPath(); ctx.moveTo(x - 3, y - h); ctx.lineTo(x + w / 2, y - h - 11); ctx.lineTo(x + w + 3, y - h); ctx.fill();
    const lit = t < 12.4 + i * 0.7;                                                        // windows go out in turn
    if (lit) { ctx.fillStyle = `rgba(255,205,110,${0.8 + 0.2 * Math.sin(t * 7 + i * 2)})`; ctx.fillRect(x + w * 0.3, y - h * 0.65, 4, 4); if (w > 26) ctx.fillRect(x + w * 0.62, y - h * 0.65, 4, 4); }
    if (i === 1 && t < 18) { ctx.fillStyle = 'rgba(120,100,120,0.35)'; for (let k = 0; k < 4; k++) ctx.fillRect(x + w * 0.75 + Math.sin(t + k) * 3, y - h - 18 - k * 8 - (t * 6) % 8, 3, 3); }   // chimney smoke
  }
  // ---- eight beacons on the middle ridge, the Wardens' watch fires
  const ridgeMid = x => VH * 0.7 + Math.sin((x + t * 14) * 0.008) * 22 + Math.sin((x + t * 14) * 0.008 * 2.7) * 6;
  hill(VH * 0.7, 22, 0.008, mixRGB([42, 18, 44], [20, 8, 18], hollow), 14);
  for (let i = 0; i < 8; i++) {
    const x = 250 + i * 150 - t * 14, y = ridgeMid(x) + 2, outAt = 10.4 + i * 0.35, on = t < outAt;
    ctx.fillStyle = '#120812'; ctx.fillRect(x - 3, y - 34, 6, 34); ctx.fillRect(x - 8, y - 38, 16, 5);
    if (on) {
      const fl = 0.8 + 0.2 * Math.sin(t * 11 + i * 3) * (t > outAt - 0.5 ? 2 : 1);
      const bgl = ctx.createRadialGradient(x, y - 46, 0, x, y - 46, 46); bgl.addColorStop(0, `rgba(255,190,90,${0.75 * fl})`); bgl.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = bgl; ctx.fillRect(x - 50, y - 96, 100, 100);
      ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.ellipse(x, y - 45, 4.5, 8 * fl, 0, 0, Math.PI * 2); ctx.fill();
    } else if (t < outAt + 2.5) {                                                         // a last wisp of smoke
      ctx.fillStyle = `rgba(160,150,170,${0.4 * (1 - (t - outAt) / 2.5)})`; ctx.fillRect(x - 1, y - 48 - (t - outAt) * 14, 3, 6);
    }
  }
  // beasts crest the far hill in waves, red eyes first
  if (t > 10.6) {
    for (let i = 0; i < 26; i++) {
      const born = 10.6 + i * 0.28; if (t < born) continue;
      const bx = VW * 0.56 + 40 + (i % 5) * 26 - (t - born) * 22 - i * 14, by = ridgeFar(bx) + 3 + (i % 3) * 2, sc = 0.8 + (i % 4) * 0.12;
      const a = ssm(born, born + 0.8, t);
      ctx.globalAlpha = a * fade; ctx.fillStyle = '#12060f';
      ctx.beginPath(); ctx.ellipse(bx, by - 14 * sc, 8 * sc, 12 * sc, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(bx - 4 * sc, by - 30 * sc, 6 * sc, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#12060f'; ctx.lineWidth = 2; line(bx - 8 * sc, by - 34 * sc, bx - 12 * sc, by - 43 * sc); line(bx, by - 34 * sc, bx + 4 * sc, by - 43 * sc);
      ctx.fillStyle = `rgba(255,60,50,${0.6 + 0.4 * Math.sin(t * 6 + i)})`; ctx.fillRect(bx - 7 * sc, by - 31 * sc, 2, 2); ctx.fillRect(bx - 3 * sc, by - 31 * sc, 2, 2);
    }
    ctx.globalAlpha = fade;
  }
  // ---- near ridge and the hero walking out of the ash
  hill(VH * 0.78, 18, 0.01, '#0c050d', 22);
  const hk = ssm(17.4, 22.6, t), hxp = -50 + hk * (VW * 0.37 + 50), walking = t > 17.4 && t < 22.6;
  if (t > 17.2) {
    const hy = VH * 0.78 + Math.sin((hxp + t * 22) * 0.01) * 18 + 3;
    stickHero(hxp, hy, { ph: (hxp + 50) / 1.4 * Math.PI / (2 * HERO_STRIDE), sc: 1.5, walking, lit: 0.08 + 0.5 * ssm(20.4, 22.8, t), t, glowCol: 'rgba(255,170,110,0.55)' });    // dark at first: the red scarf and one pale eye, then the light finds their face
  }
  // ---- embers and ash after the Hollow
  if (hollow > 0) {
    for (let i = 0; i < 80; i++) {
      const sp = 20 + (i % 7) * 9, ex = ((i * 97 + 31) % (VW + 100)) - 50 + Math.sin(t * 0.8 + i) * 22 - t * 8, ey = VH - (((i * 53) % VH) + t * sp) % (VH + 40) + 20;
      ctx.globalAlpha = hollow * fade * (0.25 + 0.5 * ((i * 13) % 10) / 10);
      ctx.fillStyle = i % 3 ? '#ff8a3a' : '#b9a8ff'; ctx.fillRect(((ex % VW) + VW) % VW, ey, 2, 2);
    }
    ctx.globalAlpha = fade;
  }
  // ---- the flash when the Hollow opens
  const flash = Math.max(0, 1 - Math.abs(t - 10.2) / 0.5);
  if (flash > 0) { ctx.fillStyle = `rgba(240,230,255,${0.85 * flash})`; ctx.fillRect(0, 0, VW, VH); }
  // ---- vignette and cinema bars
  const vg = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VH * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${0.45 + 0.2 * hollow})`);
  ctx.globalAlpha = 1; ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  const bar = VH * 0.085 * ssm(0, 1.4, t - t0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, bar); ctx.fillRect(0, VH - bar, VW, bar);
  // ---- the story, typed out line by line
  const say = (txt, a, b, y = VH * 0.2, size = 22, col = '#f4ecd8') => {
    if (t < a || t > b) return;
    const shown = txt.slice(0, Math.ceil(txt.length * Math.min(1, (t - a) / 1.5)));
    ctx.globalAlpha = Math.min(1, (t - a) * 3, (b - t) * 2);
    ctx.font = `italic ${size}px Georgia, serif`; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(shown, VW / 2 + 1.5, y + 1.5);
    ctx.fillStyle = col; ctx.fillText(shown, VW / 2, y); ctx.globalAlpha = 1;
  };
  say('Aldermere was eight kingdoms, joined by a single road.', 0.9, 5.0);
  say('Eight Wardens kept watch over every mile of it.', 5.4, 9.4);
  say('Then the Hollow opened beneath the road.', 10.9, 14.7, VH * 0.2, 24, '#ffd8d0');
  say('The Wardens fell. The villages lit their lanterns, and waited.', 14.9, 17.9);
  say('Now someone walks out of the ash.', 18.3, 22.6);
  say('No one remembers who. Not even them.', 20.4, 22.8, VH * 0.2 + 34, 17, '#cdbfae');
  // ---- slash and title
  if (t > 23) {
    if (!F.slash) { F.slash = true; sfx('slash'); setTimeout(() => sfx('boom'), 120); }
    const p = t - 23;
    drawTitleText(Math.min(1, p * 2), 1 + Math.max(0, 0.5 - p) * 1.5);
    if (p < 0.4) { ctx.fillStyle = `rgba(255,255,255,${1 - p / 0.4})`; ctx.fillRect(0, 0, VW, VH); }
    ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, 1 - p * 1.5)})`; ctx.lineWidth = 4;
    line(VW * 0.1, VH * 0.55, VW * 0.1 + Math.min(1, p * 5) * VW * 0.8, VH * 0.25);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '12px sans-serif'; ctx.textAlign = 'right';
  ctx.fillText('Press any key to skip', VW - 14, VH - bar - 8);
  if (t > 3 && !F.seen) { F.seen = true; markIntroSeen(); }
  if (t > INTRO_LEN) goTitle();
}

function drawTitleText(a = 1, scale = 1) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(VW / 2, 120); ctx.scale(scale, scale);
  ctx.textAlign = 'center';
  ctx.font = 'bold 76px Georgia, serif';
  if (gfx.glow) { ctx.shadowColor = '#f93'; ctx.shadowBlur = 25; }
  ctx.lineWidth = 6; ctx.strokeStyle = '#000'; ctx.strokeText('STICK RPG', 0, 0);
  const g = ctx.createLinearGradient(0, -60, 0, 10);
  g.addColorStop(0, '#fff3c0'); g.addColorStop(1, '#f0a040');
  ctx.fillStyle = g; ctx.fillText('STICK RPG', 0, 0);
  ctx.shadowBlur = 0;
  ctx.font = 'italic 20px Georgia, serif'; ctx.fillStyle = '#eee';
  ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
  ctx.strokeText('Rise of the Stickman', 0, 36); ctx.fillText('Rise of the Stickman', 0, 36);
  ctx.restore();
}

function drawTitle() {
  cam.x = WW / 2 - VW / 2 + Math.sin(tAnim * 0.05) * 700;
  cam.y = WH / 2 - VH / 2 + Math.sin(tAnim * 0.037) * 350;
  ctx.save(); ctx.translate(-cam.x, -cam.y);
  drawWorld();
  drawParticles();
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, VW, VH);
  drawSky();
  drawTitleText();
  stickHero(VW / 2 - 200, VH - 40, { sc: 2, walking: false, lit: 0.85, t: tAnim, glowCol: 'rgba(255,190,120,0.5)' });
}

// --- Console (` key): type a command and press Enter. The dev menu stays locked until `allowdevmenu` has been typed (per session), then `opendevmenu` opens it ---
let devAllowed = false;
const CONSOLE_CMDS = {
  allowdevmenu: () => { devAllowed = true; return ['Dev menu activated. Type opendevmenu to open it.', 'ok']; },
  opendevmenu: () => { if (devAllowed) showMenu('dev'); return null; },            // locked: nothing happens
  clear: () => { conLines.length = 0; return null; },
  save: () => {                                                                       // save the game right now, wherever you are
    if (!hero || (state !== 'play' && state !== 'village') || hero.dead) return ['There is no game to save right now.', 'err'];
    saveGame(false); return [`Game saved to slot ${currentSlot} (${hero.name}, level ${hero.level}, wave ${Math.max(0, wavesCleared())}).`, 'ok'];
  },
  help: () => ['Commands: save, clear, help, allowdevmenu', 'ok'],
};
const conLines = [], conHistory = []; let conHistPos = 0;
function renderConsole() {
  const log = document.getElementById('conLog');
  log.innerHTML = conLines.map(([t, c]) => `<div class="${c}">${t.replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]))}</div>`).join('');
  log.scrollTop = log.scrollHeight;
}
function runConsole(text) {
  const raw = String(text).trim();
  if (!raw) return;
  conLines.push([`Console> ${raw}`, 'echo']);
  const fn = CONSOLE_CMDS[raw.toLowerCase()], out = fn ? fn() : [`Unknown command: ${raw}`, 'err'];
  if (out) conLines.push(out);
  while (conLines.length > 40) conLines.shift();
  if (openMenu === 'console') renderConsole();
}
document.getElementById('conIn').addEventListener('keydown', e => {
  const inp = e.target;
  if (e.code === 'Enter' || e.code === 'NumpadEnter') {
    e.preventDefault();
    const t = inp.value; inp.value = '';
    if (t.trim()) { conHistory.push(t); if (conHistory.length > 30) conHistory.shift(); }
    conHistPos = conHistory.length;
    sfx('click'); runConsole(t);
  } else if (e.code === 'Backquote') { e.preventDefault(); showMenu(null); }
  else if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
    e.preventDefault();
    conHistPos = Math.max(0, Math.min(conHistory.length, conHistPos + (e.code === 'ArrowUp' ? -1 : 1)));
    inp.value = conHistory[conHistPos] || '';
  }
});
document.getElementById('console').addEventListener('pointerdown', e => { if (e.target.id === 'console') showMenu(null); });

// the name of the tune that starts playing, shown for a moment (so the music is noticed): each area, the village, the inn, the camp, a boss fight, a rebirth
const TRACK_NAMES = { forest: 'Whispering Woods', desert: 'Wind Over the Dunes', snow: 'Frostbound Hymn', volcano: 'The Ember March', swamp: 'Murk Lullaby', jungle: 'Canopy Drums', ruins: 'Halls of the Hollow', highlands: 'Windholm Heights',
  village: 'Hearthside', inn: 'A Warm Hearth', camp: 'Campfire Embers', boss: 'Battle Hymn', rebirth: 'The Return' };
let lastTrack = '';
Sound.setOnTheme((name, key, changed) => {
  const label = TRACK_NAMES[name]; if (!label || typeof hero === 'undefined' || !hero || state === 'title' || state === 'intro') return;
  const night = /_night$/.test(key), id = name + (night ? '_n' : '');
  if (id === lastTrack) return; lastTrack = id;
  popups.push({ text: `♪ ${label}${night ? ' (night)' : ''}`, x: VW / 2, y: VH - 92, t: 3.2, screen: true, small: true, color: '#cfe0ff' });
});

// --- Dev / cheat menu (opened from the console) ---
// The dev menu's item spawner: pick a kind, the exact item, its grade and how its stats roll, and how many.
const DEV_CATS = [['weapon', 'Weapon'], ['armor', 'Armor'], ['helmet', 'Helmet'], ['ring', 'Ring'], ['necklace', 'Necklace'], ['artifact', 'Artifact'], ['potion', 'Potion']];
const devPlain = () => devPick.cat === 'potion';      // potions have no grade or level
const devRune = { k: 0, qty: 1, tier: 0 }, devEss = { k: 0, qty: 1 };                      // the rune spawner has its own section
const devPick = { cat: 'weapon', base: 0, rarity: 3, roll: 'random', unique: '', qty: 1, ilvl: 0, up: 0, sock: '' };      // ilvl 0 = the hero's level
const devBases = cat => cat === 'weapon' ? SWORDS.map(s => `${s.name} (level ${s.lvl}${s.ranged ? ', ranged' : ''}${s.sig ? ', boss weapon' : ''})`) : cat === 'potion' ? POTION_KEYS.map(k => POTIONS[k].name) : BASE_NAMES[cat];
const devMake = (rarity = devPick.rarity, base = devPick.base) => {
  const it = rollItem({
    slot: devPick.cat, rarity, level: 99, ilvl: devPick.ilvl || (hero ? hero.level : 1), roll: devPick.roll === 'random' ? undefined : devPick.roll, unique: devPick.unique || undefined,
    ...(devPick.cat === 'weapon' ? { base: SWORDS[base].id } : { baseIdx: base }),
  });
  for (let i = 0; i < (devPick.up | 0) && canUpgrade(it); i++) upgradeItem(it);                          // already upgraded to the chosen level (up to its grade's maximum)
  if (devPick.sock) { const n = socketsOf(it); it.rn = Array.from({ length: n }, () => devPick.sock === 'random' ? RUNE_KEYS[Math.floor(Math.random() * RUNE_KEYS.length)] : devPick.sock); if (!n) delete it.rn; }      // every socket filled with the chosen rune
  return it;
};
const devQty = () => Math.max(1, Math.min(40, devPick.qty | 0 || 1));
const dev = { god: false, oneHit: false, stamina: false, hitboxes: false, speed: 1, freezeTime: false, noFog: false, lit: false, noSpot: false };
function renderDev() {
  const tog = (k, label) => `<button data-dev="tog" data-k="${k}" class="${dev[k] ? 'on' : ''}">${label}</button>`;
  const btn = (act, label, extra = '') => `<button data-dev="${act}" ${extra}>${label}</button>`;
  const inPlay = state === 'play' && hero;
  document.getElementById('devBody').innerHTML = `
    <h3>TOGGLES</h3><div class="dev-grid">
      ${tog('god', 'God mode')}${tog('oneHit', 'One-hit kills')}${tog('stamina', 'Infinite stamina')}
      ${tog('hitboxes', 'Show hitboxes')}${tog('noFog', 'Disable fog-of-war')}${dun ? `${tog('lit', 'Dungeon: no darkness')}${tog('noSpot', 'Dungeon: sleepers never notice')}` : ''}</div>
    <h3>GAME SPEED</h3><div class="dev-grid">
      ${[0.25, 0.5, 1, 2, 4].map(v => `<button data-dev="speed" data-v="${v}" class="${dev.speed === v ? 'on' : ''}">${v}×</button>`).join('')}</div>
    ${inPlay ? `
    <h3>HERO</h3><div class="dev-grid">
      ${btn('gold100', '+100 gold')}${btn('gold1000', '+1000 gold')}${btn('savenow', 'Save now')}
      ${btn('scroll', '+1 return scroll')}${btn('heal', 'Full heal')}${btn('lvl1', '+1 level')}${btn('lvl10', '+10 levels')}${btn('pts', '+10 stat points')}${btn('maxlvl', 'Max level')}${btn('rebirth', '+1 rebirth (keeps all)')}${btn('kill', 'Kill hero')}</div>
    <h3>ITEM SPAWNER</h3><div class="dev-grid dev-pick">
      <select id="devCat">${DEV_CATS.map(([k, n]) => `<option value="${k}" ${devPick.cat === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <select id="devBase">${devBases(devPick.cat).map((n, i) => `<option value="${i}" ${devPick.base === i ? 'selected' : ''}>${n}</option>`).join('')}</select>
      ${devPlain() ? '' : `<select id="devRarity">${RARITIES.map((r, i) => `<option value="${i}" ${devPick.rarity === i ? 'selected' : ''}>${r.name}</option>`).join('')}</select>
      ${devPick.rarity === 7 ? `<select id="devUnique"><option value="">Random special effect</option>${Object.keys(UNIQUES).map(k => `<option value="${k}" ${devPick.unique === k ? 'selected' : ''}>${UNIQUES[k].name}</option>`).join('')}</select>` : ''}
      <select id="devRoll">${[['random', 'Random stat rolls'], ['max', 'Best possible rolls'], ['min', 'Worst possible rolls']].map(([k, n]) => `<option value="${k}" ${devPick.roll === k ? 'selected' : ''}>${n}</option>`).join('')}</select>`}
      <label class="dev-qty">Amount <input type="text" id="devQty" value="${devPick.qty}"></label>
      ${devPlain() ? '' : `<label class="dev-qty">Item level <input type="text" id="devIlvl" value="${devPick.ilvl || ''}" placeholder="${hero ? hero.level : 1}"></label>
      <label class="dev-qty">Upgrade level <input type="text" id="devUp" value="${devPick.up || ''}" placeholder="0 (max ${upgradeMax({ rarity: devPick.rarity })})"></label>
      <select id="devSock"><option value="">Sockets left empty</option><option value="random" ${devPick.sock === 'random' ? 'selected' : ''}>Sockets: random runes</option>${RUNE_KEYS.map(k => `<option value="${k}" ${devPick.sock === k ? 'selected' : ''}>Sockets: ${RUNES[k].title}</option>`).join('')}</select>`}
      <span class="dev-ico" ${devPlain() ? '' : `style="border-color:${RARITIES[devPick.rarity].color}"`}>${devPick.cat === 'potion'
        ? `<svg viewBox="0 0 28 28" width="40" height="40"><path d="M11 3h6v5l4 8a5.2 5.2 0 0 1-4.7 8h-4.6A5.2 5.2 0 0 1 7 16l4-8z" fill="${POTIONS[POTION_KEYS[devPick.base]].color}" stroke="#17171f" stroke-width="1"/><rect x="10.5" y="2" width="7" height="3" rx="1" fill="#c9a36a" stroke="#17171f" stroke-width=".8"/></svg>`
        : slotSvg(devPick.cat, RARITIES[devPick.rarity].color, devMake())}</span></div>
    <div class="dev-grid">
      ${devPick.cat === 'potion' ? `${btn('give', 'Add potions')}${btn('potmax', 'Max out potions')}`
        : `${btn('give', 'Add to inventory')}${btn('equip', 'Equip now')}${btn('fillthis', 'Fill backpack with this')}${btn('allgrades', 'One of every grade')}${btn('allcat', `Every ${DEV_CATS.find(c => c[0] === devPick.cat)[1].toLowerCase()} at this grade`)}`}
      ${btn('clearpack', 'Clear backpack')}</div>
    <h3>RUNE SPAWNER</h3><div class="dev-grid dev-pick">
      <select id="devRuneSel">${RUNE_KEYS.map((k, i) => `<option value="${i}" ${devRune.k === i ? 'selected' : ''}>${RUNES[k].title} (${runeLine(k).split(': ')[1]})</option>`).join('')}</select>
      <select id="devRuneTier"><option value="">All tiers (for the buttons below)</option>${RUNE_TIERS.map((T, i) => `<option value="${i + 1}" ${devRune.tier === i + 1 ? 'selected' : ''}>Only ${T.name} runes</option>`).join('')}</select>
      <label class="dev-qty">Amount <input type="text" id="devRuneQty" value="${devRune.qty}"></label>
      <span class="dev-ico" style="border-color:${RUNES[RUNE_KEYS[devRune.k]].tc}">${runeSvg(RUNE_KEYS[devRune.k], 40)}</span></div>
    <div class="dev-grid">${btn('runeadd', 'Add runes')}${btn('runerand', 'Add a random rune (as a drop rolls)')}${btn('runemax', 'Max out every rune')}${btn('runeone', 'One of every rune')}${btn('runekind', 'One of each tier of this rune')}${btn('runeclear', 'Clear all runes')}</div>
    <div class="hint" style="margin:2px 0 6px">You have: ${RUNE_KEYS.filter(k => runeCount(k)).map(k => `${RUNES[k].title} ${runeCount(k)}`).join(' · ') || 'no runes'}</div>
    <h3>ESSENCE SPAWNER</h3><div class="dev-grid dev-pick">
      <select id="devEssSel">${ESS_KEYS.map((k, i) => `<option value="${i}" ${devEss.k === i ? 'selected' : ''}>${ESS[k].title}</option>`).join('')}</select>
      <label class="dev-qty">Amount <input type="text" id="devEssQty" value="${devEss.qty}"></label>
      <span class="dev-ico" style="border-color:${ESS[ESS_KEYS[devEss.k]].color}">${essSvg(ESS_KEYS[devEss.k], 40)}</span></div>
    <div class="dev-grid">${btn('essadd', 'Add essences')}${btn('essall', 'One of every essence')}${btn('essmax', 'Max out every essence')}${btn('essclear', 'Clear all essences')}</div>
    <div class="hint" style="margin:2px 0 6px">You have: ${ESS_KEYS.filter(k => essCount(k)).map(k => `${ESS[k].title} ${essCount(k)}`).join(' · ') || 'no essences'}</div>
    <h3>QUESTS</h3><div class="dev-grid">${QUEST_KINDS.map(k => btn('quest', k, `data-t="${k}"`)).join('')}${btn('questdone', 'Finish active quests')}${btn('questclear', 'Clear all quests')}</div>
    <h3>BOSS AND RANGED WEAPONS</h3><div class="dev-grid">${SWORDS.filter(s => s.sig).map(s => btn('sigweapon', s.name, `data-t="${s.id}"`)).join('')}${btn('sigall', 'All eight boss weapons')}${btn('rangedall', 'Every bow and staff')}</div>
    <h3>AILMENTS</h3><div class="dev-grid">${AIL_KEYS.map(k => btn('ail', AILS[k].name, `data-t="${k}"`)).join('')}${btn('ailclear', 'Cure all')}</div>
    ${dun ? `<h3>WAVES</h3><div class="dev-grid">${btn('clear', 'Kill all enemies')}</div>` : `    <h3>WAVES</h3><div class="dev-grid">
      ${btn('clear', 'Kill all enemies')}${btn('next', 'Skip wave')}
      <input type="text" id="devWave" value="${wave + 1}"> ${btn('goto', 'Go to wave')}</div>`}
    <h3>SPAWN</h3><div class="dev-grid">
      ${Object.keys(TYPES).map(t => btn('spawn', t, `data-t="${t}"`)).join('')}${btn('spawn', 'ELITE', 'data-t="elite"')}${MUT_KEYS.map(k => btn('spawn', 'mut: ' + k, `data-t="mut:${k}"`)).join('')}${btn('spawn', 'PACK LEADER', 'data-t="leader"')}${btn('spawn', 'EVOLVED', 'data-t="evo"')}${btn('fidget', 'Make all fidget')}${btn('parade', 'Death scene parade')}${dun ? '' : btn('boss', 'BOSS (this biome)')}
      ${dun ? '' : Object.keys(BOSSES).map(k => btn('boss', BOSSES[k].names[0], `data-t="${k}"`)).join('')}
      ${Object.keys(DROPS).map(d => btn('drop', 'drop: ' + d, `data-t="${d}"`)).join('')}</div>
    ${dun ? '' : `    <h3>WORLD</h3><div class="dev-grid">
      ${BIOMES.map((b, i) => btn('biome', b.name, `data-t="${i}"`)).join('')}${btn('biome', 'Random biome', 'data-t="rand"')}${btn('camp', 'Play campfire scene')}${btn('village', 'Visit the village')}${btn('church', 'Visit the church')}</div>`}
    <h3>DUNGEON</h3><div class="dev-grid">
      ${dun ? `${btn('dunleave', 'Leave the dungeon')}${Array.from({ length: dun.floors }, (_, i) => btn('dunfloor', `Floor ${i + 1}`, `data-t="${i}" ${i === dun.idx ? 'class="on"' : ''}`)).join('')}${btn('dungo', 'Go to the way up', 'data-t="up"')}${btn('dungo', 'Go to the stairs down', 'data-t="down"')}${btn('dungo', 'Go to the nearest chest', 'data-t="chest"')}${btn('dungo', 'Go to the boss', 'data-t="boss"')}${btn('dunwake', 'Wake everything')}${btn('dunchests', 'Open every chest')}${btn('dunseal', 'Break the boss\'s seal')}${btn('dunreveal', 'Reveal the floor')}` : `${btn('dungeon', 'Enter a dungeon')}${Object.keys(DUN_DOORS).map(k => btn('dundoor', DUN_DOORS[k].name, `data-t="${k}"`)).join('')}`}</div>
    ${dun ? '' : `<h3>TIME &amp; WEATHER</h3><div class="dev-grid">
      ${[['Dawn', 0.28], ['Noon', 0.5], ['Dusk', 0.75], ['Night', 0.95]].map(([n, v]) => btn('time', n, `data-t="${v}"`)).join('')}
      ${btn('freeze', dev.freezeTime ? 'Time frozen' : 'Freeze time', dev.freezeTime ? 'class="on"' : '')}</div>
    <div class="dev-grid" style="margin-top:6px">
      ${Object.keys(WEATHER).map(k => btn('weather', WEATHER[k].name, `data-t="${k}"`)).join('')}</div>`}
    <div class="hint">Now: wave ${wave} · level ${hero.level} · ${enemies.length} enemies · ${dun ? `${dunPal().name}, floor ${dun.idx + 1} of ${dun.floors}` : world.B.name}</div>`
    : '<div class="hint">Start or load a game to use the hero, wave and spawn cheats.</div>'}`;
}
document.getElementById('devBody').addEventListener('change', e => {      // the item spawner's dropdowns and amount
  const id = e.target.id, v = e.target.value;
  if (id === 'devEssSel') devEss.k = +v;
  else if (id === 'devEssQty') devEss.qty = Math.max(1, Math.min(ESS_MAX, parseInt(v, 10) || 1));
  else if (id === 'devRuneSel') devRune.k = +v;
  else if (id === 'devRuneTier') devRune.tier = +v || 0;
  else if (id === 'devRuneQty') devRune.qty = Math.max(1, Math.min(RUNE_MAX, parseInt(v, 10) || 1));
  else if (id === 'devCat') { devPick.cat = v; devPick.base = 0; }
  else if (id === 'devBase') devPick.base = +v;
  else if (id === 'devRarity') devPick.rarity = +v;
  else if (id === 'devRoll') devPick.roll = v;
  else if (id === 'devUnique') devPick.unique = v;
  else if (id === 'devQty') devPick.qty = Math.max(1, Math.min(40, parseInt(v, 10) || 1));
  else if (id === 'devIlvl') devPick.ilvl = Math.max(0, Math.min(99, parseInt(v, 10) || 0));
  else if (id === 'devUp') devPick.up = Math.max(0, Math.min(40, parseInt(v, 10) || 0));
  else if (id === 'devSock') devPick.sock = RUNES[v] || v === 'random' ? v : '';
  else return;
  sfx('click'); renderDev();
});
document.getElementById('devBody').addEventListener('click', e => {
  const b = e.target.closest('[data-dev]');
  if (!b) return;
  const act = b.dataset.dev, t = b.dataset.t;
  sfx('click');
  const near = () => ({ x: Math.max(20, Math.min(WW - 20, hero.x + (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 80))),
                        y: Math.max(60, Math.min(WH - 10, hero.y + (Math.random() - 0.5) * 120)) });
  if (act === 'tog') dev[b.dataset.k] = !dev[b.dataset.k];
  if (act === 'speed') dev.speed = +b.dataset.v;
  if (act === 'heal') { hero.hp = hero.maxHp; hero.stamina = maxStamina(); }
  if (act === 'lvl1' || act === 'lvl10') {
    const n = act === 'lvl1' ? 1 : 10;
    for (let i = 0; i < n; i++) gainXp(hero.xpNext - hero.xp, hero);
  }
  if (act === 'pts') hero.points += 10;
  if (act === 'maxlvl') { while (hero.level < levelCap()) gainXp(hero.xpNext, hero); hero.xp = 0; }
  if (act === 'rebirth') { hero.rebirth = rebirths() + 1; applyRebirthPerks(); recalcGear(); }
  const giveItem = it => { if (!addToBag(it)) dropGear(it, hero.x + 40 + Math.random() * 60, hero.y + (Math.random() - 0.5) * 40); return it; };      // a full backpack drops it on the floor
  const said = text => popups.push({ text, x: VW / 2, y: 120, t: 1.6, screen: true, small: true, color: '#8f8' });
  if (act === 'give' && devPick.cat === 'potion') { const P = POTIONS[POTION_KEYS[devPick.base]]; hero[P.field] = Math.min(POTION_MAX, (hero[P.field] | 0) + devQty()); said(`${P.name}: ${hero[P.field]}`); }
  else if (act === 'give') { let last; for (let i = 0; i < devQty(); i++) last = giveItem(devMake()); said(`Added ${devQty()} × ${last.name}`); }
  const runeTiered = k => !devRune.tier || RUNES[k].tier === devRune.tier;                  // the tier box narrows the bulk buttons
  if (act === 'runeadd') { const k = RUNE_KEYS[devRune.k]; addRune(k, Math.max(1, Math.min(RUNE_MAX, devRune.qty | 0 || 1))); said(`${RUNES[k].title}: ${runeCount(k)}`); }
  if (act === 'runerand') { const k = rollRuneKey(); addRune(k); said(`Rolled ${RUNES[k].title}`); }
  if (act === 'runemax') { hero.runes = hero.runes || {}; for (const k of RUNE_KEYS) if (runeTiered(k)) hero.runes[k] = RUNE_MAX; said(devRune.tier ? `Every ${RUNE_TIERS[devRune.tier - 1].name} rune at its maximum` : 'Every rune at its maximum'); }
  if (act === 'runeone') { for (const k of RUNE_KEYS) if (runeTiered(k)) addRune(k); said('One of every rune added'); }
  if (act === 'runekind') { const b = RUNES[RUNE_KEYS[devRune.k]].base; RUNE_TIERS.forEach((_, i) => addRune(runeKey(b, i + 1))); said(`One of each tier of ${RUNE_BASE[b].name}`); }
  if (act === 'runeclear') { hero.runes = {}; said('All runes cleared'); }
  if (act === 'scroll') { hero.recalls = Math.min(RECALL_MAX, (hero.recalls | 0) + 1); said(`Return Scrolls: ${hero.recalls}`); }
  if (act === 'quest') { const q = { id: questId(), kind: t, n: 0, ...questDef(t) }; if (hero.quests.active.length < QUEST_MAX) hero.quests.active.push(q); else hero.quests.claim.push({ ...q, n: q.goal }); said(`Quest: ${q.title}`); }
  if (act === 'potmax') for (const k of POTION_KEYS) hero[POTIONS[k].field] = POTION_MAX;
  if (act === 'essadd') { const k = ESS_KEYS[devEss.k]; addEss(k, devEss.qty); said(`${ESS[k].title}: ${essCount(k)}`); }
  if (act === 'essall') { for (const k of ESS_KEYS) addEss(k); said('One of every essence added'); }
  if (act === 'essmax') { hero.ess = hero.ess || {}; for (const k of ESS_KEYS) hero.ess[k] = ESS_MAX; said('Every essence at its maximum'); }
  if (act === 'essclear') { hero.ess = {}; said('All essences cleared'); }
  if (act === 'ail') { addAilment(t); said(`${AILS[t].name}`); }
  if (act === 'ailclear') { cureAilments(); said('Ailments cleared'); }
  if (act === 'equip') { const it = devMake(); if (addToBag(it)) equipFromBag(it.id, it.slot === 'ring' ? 'ring1' : undefined); else dropGear(it, hero.x + 60, hero.y); said(`Equipped ${it.name}`); }
  if (act === 'fillthis') { while (hero.inv.length < INV_MAX) hero.inv.push(devMake()); said('Backpack filled'); }
  if (act === 'allgrades') { for (let r = 0; r < RARITIES.length; r++) giveItem(devMake(r)); said('One of every grade added'); }
  if (act === 'allcat') { devBases(devPick.cat).forEach((_, i) => giveItem(devMake(devPick.rarity, i))); said('Every item added'); }
  if (act === 'clearpack') hero.inv = [];
  if (act === 'gold100') hero.gold += 100;
  if (act === 'gold1000') hero.gold += 1000;
  if (act === 'savenow') saveGame(false);
  if (act === 'kill') { dev.god = false; hero.hurtT = 0; hero.flipT = 0; damageHero(hero.hp); showMenu(null); return; }
  if (act === 'clear') { for (const m of enemies) m.hp = 0; spawnQueue = []; updateEnemies(0); }
  if (act === 'next' || act === 'goto') {
    const target = act === 'goto' ? Math.max(1, parseInt(document.getElementById('devWave').value) || 1) : wave + 1;
    enemies = []; spawnQueue = []; boss = null; projectiles = []; shockwaves = []; clearHazards();
    wave = target - 1; waveTimer = 0.2;
    if (Sound.current === 'boss') Sound.music(BIOMES[zone % BIOMES.length].music);
  }
  if (act === 'spawn') {
    if (t === 'elite') { const m = spawnEnemy(['goblin', 'minotaur', 'archer'][Math.floor(Math.random() * 3)], near(), { variant: 'elite', spawnT: 0.3 }); popups.push({ text: `Elite: ${m.name}`, x: VW / 2, y: 170, t: 1.8, screen: true, small: true, color: '#ffd24a' }); }
    else if (t.startsWith('mut:')) { const m = spawnEnemy('goblin', near(), { variant: 'plain', spawnT: 0.3 }); applyMutation(m, t.slice(4)); }
    else if (t === 'leader') { const pool = wavePool(); spawnEnemy(pool[Math.floor(Math.random() * pool.length)], near(), { leader: true, variant: 'plain', spawnT: 0.3 }); }
    else if (t === 'evo') { const ps = wavePool().filter(k => EVO[k]); const m = spawnEnemy((ps.length ? ps : Object.keys(EVO))[Math.floor(Math.random() * (ps.length || Object.keys(EVO).length))], near(), { variant: 'plain', spawnT: 0.3 }); evolveMob(m); }
    else spawnEnemy(t, near(), { spawnT: 0.3 });
    if (dun) for (const m of enemies) if (!m.sleep) dunPush(m, Math.max(10, m.r * 0.8));
  }
  if (act === 'boss') { const w = wave; wave = Math.max(WAVES_PER_SET, wave); spawnBoss(t); wave = w; }
  if (act === 'drop') dropItem(t, hero.x + hero.facing * 50, hero.y - 20, t === 'rune' ? { rune: RUNE_KEYS[devRune.k], t: 40 } : t === 'essence' ? { ess: ESS_KEYS[devEss.k], t: 40 } : {});      // a rune drops as the one picked in the rune spawner
  if (act === 'biome') { const z = t === 'rand' ? randomBiome() : +t; setBiome(z); Sound.music(BIOMES[z].music); }
  if (act === 'time') tod = +t;
  if (act === 'freeze') dev.freezeTime = !dev.freezeTime;
  if (act === 'weather') setWeather(t, true);
  if (act === 'camp') { showMenu(null); startCamp((zone + 1) % BIOMES.length); return; }
  if (act === 'village') { showMenu(null); enterVillage(); return; }
  if (act === 'dungeon') { showMenu(null); if (state === 'play' && !dun) enterDungeon(); return; }
  if (act === 'church') { showMenu(null); if (state === 'play' && !dun) { enterVillage(); if (vil) { vil.fade = 0; enterChurch(); vil.fade = 0; } } return; }
  if (act === 'dundoor') { const design = DUN_DOORS[t] ? t : DUN_DOOR_PICKS[Math.floor(Math.random() * DUN_DOOR_PICKS.length)]; dunDoor = { x: Math.max(200, Math.min(WW - 200, hero.x + 200)), y: Math.max(300, Math.min(WH - 120, hero.y + 40)), t: 24, max: 24, p: 0, design }; dunRolled = true; waveTimer = Math.max(waveTimer, 26); said(`${DUN_DOORS[design].name} opens beside you`); }
  if (act === 'dunleave') { showMenu(null); exitDungeon(); return; }
  if (dun && act === 'dunfloor') { dun.fade = 0; switchFloor(+t, +t > dun.idx); showMenu(null); return; }
  if (dun && act === 'dunwake') { for (const m of enemies) wakeMob(m, 'chain'); said('Everything is awake'); }
  if (dun && act === 'dunchests') { for (const c of dun.f.chests) if (!c.open) { c.locked = false; openChest(c); } said('Every chest opened'); }
  if (dun && act === 'dunseal') { const f = dun.f; f.bossDead = true; for (const c of f.chests) c.locked = false; said(f.last ? 'The seal is broken' : 'No seal on this floor'); }
  if (dun && act === 'dunreveal') { dun.f.seen.fill(1); said('The floor is mapped'); }
  if (dun && act === 'dungo') {
    const f = dun.f; let p = null;
    if (t === 'up') p = { x: f.up.x + 60, y: f.up.y }; else if (t === 'down') p = f.down && { x: f.down.x - 60, y: f.down.y };
    else if (t === 'chest') { const c = f.chests.filter(c => !c.open).sort((a, b) => Math.hypot(a.x - hero.x, a.y - hero.y) - Math.hypot(b.x - hero.x, b.y - hero.y))[0]; p = c && { x: c.x, y: c.y + 36 }; }
    else if (t === 'boss') p = f.boss && { x: f.boss.x - 220, y: f.boss.y };
    if (p) { hero.x = p.x; hero.y = p.y; dunPush(hero, 11); showMenu(null); return; } else said('Nothing like that on this floor');
  }
  if (act === 'questdone') { for (const q of hero.quests.active.slice()) { q.n = q.goal; completeQuest(q); } said('Active quests finished'); }
  if (act === 'questclear') { hero.quests.active = []; hero.quests.claim = []; said('Quests cleared'); }
  if (act === 'sigweapon' || act === 'sigall' || act === 'rangedall') {
    const ids = act === 'sigweapon' ? [t] : SWORDS.filter(s => act === 'sigall' ? s.sig : s.ranged && !s.sig).map(s => s.id), r = Math.max(4, devPick.rarity);
    for (const id of ids) giveItem(rollItem({ slot: 'weapon', base: id, rarity: r, level: hero.level, boss: true }));
    said(`Added ${ids.length} weapon${ids.length === 1 ? '' : 's'}`);
  }
  if (act === 'fidget') { for (const m of enemies) if (m.type !== 'boss' && !m.sleep && FIDGETS[m.type]) { const pick = FIDGETS[m.type][Math.floor(Math.random() * FIDGETS[m.type].length)]; m.fid = { kinds: pick, t: 0, dur: Math.max(...pick.map(k => FID_TIME[k] || 1.2)) }; m.speed = 0; } said('Everything stands still and fidgets'); }
  if (act === 'parade') { const ts = Object.keys(TYPES).filter(k => k !== 'boss'); enemies = enemies.filter(m => m.type === 'boss'); ts.forEach((k, i) => { const m = spawnEnemy(k, { x: Math.max(40, Math.min(WW - 40, hero.x - 20 + (i % 8) * 110 - 380)), y: Math.max(80, Math.min(WH - 20, hero.y + 120 + Math.floor(i / 8) * 90)) }, { variant: 'plain', spawnT: 0 }); if (dun) dunPush(m, m.r); m.hp = 0; }); updateEnemies(0); said('Every creature dies in its own way'); }
  renderDev();
});
function drawHitboxes() {
  ctx.save(); ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,60,60,0.9)';
  for (const m of enemies) { ctx.beginPath(); ctx.arc(m.x, m.y, m.r + 12, 0, Math.PI * 2); ctx.stroke(); }    // contact damage
  for (const m of enemies) {                                                                               // an enemy's body: what the weapon has to touch (orange), and the contact circle (dashed) that is always hit
    const b = enemyBody(m), my = hero.y; ctx.save(); ctx.strokeStyle = 'rgba(255,160,60,0.9)';
    ctx.beginPath(); ctx.arc(m.x, my - 4 - b.r, b.r, 0, Math.PI * 2); ctx.arc(m.x, my - b.h + b.r - 4, b.r, 0, Math.PI * 2); ctx.moveTo(m.x - b.r, my - 4 - b.r); ctx.lineTo(m.x - b.r, my - b.h + b.r - 4); ctx.moveTo(m.x + b.r, my - 4 - b.r); ctx.lineTo(m.x + b.r, my - b.h + b.r - 4); ctx.stroke();
    ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,160,60,0.5)'; ctx.beginPath(); ctx.arc(m.x, m.y, m.r + 10, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  ctx.strokeStyle = 'rgba(80,200,255,0.95)';                                                                 // the weapon's hit area (the carried weapon when not attacking)
  for (const s of weaponShapes(hero.attackT > 0 ? 1 - hero.attackT / hero.attackDur : -1)) {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2, s.r * 2); ctx.globalAlpha = 0.3; ctx.strokeStyle = '#4cf'; line(s.x1, s.y1, s.x2, s.y2); ctx.restore();
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(s.x2, s.y2, s.r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';                                                                 // arrow hurtbox
  ctx.beginPath(); ctx.arc(hero.x, hero.y - 35, 18, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,220,80,0.8)';                                                                  // pickup radius
  for (const d of drops) { ctx.beginPath(); ctx.arc(d.x, d.y, 28, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}

// --- Campfire time-skip between biomes ---
let campT = 0, camp = null;
const CAMP_LEN = 7;
function startCamp(z) {
  camp = { zone: z, plan: campPlan(tod, dayCount), built: false, sparks: [], crackleT: 0 };      // the rest runs the real clock on to the next morning
  campT = 0;
  state = 'camp';
  for (const k in keys) keys[k] = false;
  hero.hp = hero.maxHp; hero.stamina = maxStamina();      // a night's rest
  clearPoison(); clearHazards(); hero.chillT = 0;
  Sound.music('camp');
  Sound.setScene({ biome: 'camp', night: true, wind: 0.03, rain: 0, pitch: 450 });
}
function updateCamp(dt) {
  campT += dt;
  // build the next biome while the screen is dark (hides the loading hitch)
  if (!camp.built && campT > 0.9) {
    camp.built = true;
    tod = camp.plan.endTod; dayCount = camp.plan.endDay;        // morning has come (before the biome rolls its weather)
    setBiome(camp.zone, false);
    hero.x = WW / 2; hero.y = WH / 2; cam.x = hero.x - VW / 2; cam.y = hero.y - VH / 2;
    drops = []; projectiles = []; heroShots = []; shockwaves = []; particles = []; corpses = []; clearHazards(); clearPoison();
  }
  camp.crackleT -= dt;
  if (camp.crackleT <= 0) { camp.crackleT = 0.08 + Math.random() * 0.35; sfx('crackle'); }
  if (Math.random() < dt * 25) camp.sparks.push({ x: (Math.random() - 0.5) * 10, y: 0, vx: (Math.random() - 0.5) * 30, vy: -60 - Math.random() * 70, life: 1 + Math.random() });
  for (const p of camp.sparks) { p.x += p.vx * dt + Math.sin(campT * 3 + p.life * 9) * 12 * dt; p.y += p.vy * dt; p.life -= dt; }
  camp.sparks = camp.sparks.filter(p => p.life > 0);
  if (campT >= CAMP_LEN) endCamp();
}
function endCamp() {
  if (!camp.built) { tod = camp.plan.endTod; dayCount = camp.plan.endDay; setBiome(camp.zone, false); }
  state = 'play';
  const B = BIOMES[camp.zone % BIOMES.length];
  popups.push({ text: `— ${B.name} —`, x: VW / 2, y: 190, t: 3, big: true, screen: true, color: '#fff' });
  popups.push({ text: `Monsters grow stronger (tier ${tierOf(wave)})`, x: VW / 2, y: 250, t: 3, screen: true, small: true, color: '#fb8' });
  saveGame(true);                       // campfires are save points (gold is banked here)
  Sound.music(B.music);
  camp = null;
}

function drawCamp(t) {
  const fx = VW * 0.5, fy = VH * 0.74;              // fire position
  const flick = Math.sin(t * 17) * 0.5 + Math.sin(t * 23 + 1) * 0.3 + Math.sin(t * 7) * 0.2;
  // sky on the real clock (it runs on to the next morning), landscape of the biome the hero wakes up in
  const B = BIOMES[camp.zone % BIOMES.length], prog = Math.max(0, Math.min(1, (t - 0.6) / 5.2)), ck = campClock(camp.plan, prog * prog * (3 - 2 * prog));
  const { d: night } = campDraw(B, ck, t);
  // firelight on the ground (flickers smoothly, no hard flashing)
  const glowR = 240 + flick * 10;
  const lg = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
  const fl = 0.4 + 0.6 * night;
  lg.addColorStop(0, `rgba(255,150,60,${0.5 * fl})`); lg.addColorStop(0.4, `rgba(255,110,40,${0.16 * fl})`); lg.addColorStop(1, 'rgba(255,90,30,0)');
  ctx.save(); ctx.translate(fx, fy); ctx.scale(1, 0.55);       // squash the gradient itself so it fades out with no edge
  ctx.fillStyle = lg; ctx.fillRect(-glowR, -glowR, glowR * 2, glowR * 2);
  ctx.restore();

  // sword planted in the ground behind the hero
  const hx = fx - 90, hy = fy + 6;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = hero.sword.color; ctx.lineWidth = 3;
  line(hx - 44, hy, hx - 34, hy - 58);
  ctx.strokeStyle = '#654'; line(hx - 43, hy - 44, hx - 31, hy - 42);
  // log seat
  ctx.fillStyle = '#3a2616'; ctx.beginPath(); ctx.roundRect(hx - 22, hy - 9, 44, 12, 5); ctx.fill();
  ctx.fillStyle = '#6a4a2a'; ctx.beginPath(); ctx.ellipse(hx + 22, hy - 3, 3, 6, 0, 0, Math.PI * 2); ctx.fill();

  // the hero sits on the log, warming his hands at the fire
  const br = Math.sin(t * 2.2) * 1.2, nod = Math.max(0, Math.sin(t * 0.7 - 1)) * 2;
  const hipX = hx, hipY = hy - 10, neckX = hx + 7, neckY = hipY - 26 + br, headX = neckX + 5, headY = neckY - 11 + nod;
  ctx.strokeStyle = '#c0282d'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(neckX, neckY + 2);
  for (let i = 1; i < 6; i++) ctx.lineTo(neckX - i * 5, neckY + 4 + i * 2 + Math.sin(t * 2 + i) * 2);
  ctx.stroke();
  ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(hipX + 16, hipY - 1); ctx.lineTo(hipX + 17, hy + 4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(hipX + 14, hipY + 2); ctx.lineTo(hipX + 12, hy + 4); ctx.stroke();
  line(hipX, hipY, neckX, neckY);
  const reach = Math.sin(t * 1.3) * 1.5;
  ctx.beginPath(); ctx.moveTo(neckX, neckY + 4); ctx.lineTo(neckX + 13, neckY + 12); ctx.lineTo(neckX + 27 + reach, neckY + 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(neckX, neckY + 4); ctx.lineTo(neckX + 11, neckY + 15); ctx.lineTo(neckX + 25 + reach, neckY + 12); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(headX, headY, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,140,60,0.35)'; ctx.beginPath(); ctx.arc(headX + 3, headY, 8.5, -1.2, 1.2); ctx.fill();
  ctx.fillStyle = '#111';
  if (Math.sin(t * 0.9) > 0.97) ctx.fillRect(headX + 3, headY - 2, 3.5, 1.2);
  else { ctx.beginPath(); ctx.arc(headX + 4, headY - 2, 1.8, 0, Math.PI * 2); ctx.fill(); }

  // campfire: stone ring, crossed logs, layered flames, sparks
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i / 6) * Math.PI;
    ctx.fillStyle = i % 2 ? '#4a4450' : '#3a3440';
    ctx.beginPath(); ctx.ellipse(fx + Math.cos(a) * 26, fy + 4 - Math.sin(a) * 6, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#4a2c16'; ctx.lineWidth = 6;
  line(fx - 18, fy + 4, fx + 16, fy - 6); line(fx + 18, fy + 4, fx - 16, fy - 6);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const flame = (w, h, col, ph) => {
    const sway = Math.sin(t * 6 + ph) * 3;
    ctx.fillStyle = col; ctx.beginPath();
    ctx.moveTo(fx - w, fy);
    ctx.quadraticCurveTo(fx - w * 0.9, fy - h * 0.5, fx + sway, fy - h * (1 + flick * 0.1));
    ctx.quadraticCurveTo(fx + w * 0.9, fy - h * 0.5, fx + w, fy);
    ctx.closePath(); ctx.fill();
  };
  flame(20, 58, 'rgba(255,80,20,0.75)', 0);
  flame(14, 44, 'rgba(255,160,40,0.8)', 1.5);
  flame(8, 28, 'rgba(255,240,170,0.9)', 3);
  ctx.fillStyle = '#ffb050';
  for (const p of camp.sparks) { ctx.globalAlpha = Math.min(1, p.life); ctx.fillRect(fx + p.x, fy - 20 + p.y, 2, 2); }
  ctx.restore();

  campAmbient(B, t, night);

  // text
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 8;
  const fadeIn = (a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
  const out = 1 - fadeIn(5.6, 6.3);
  ctx.textAlign = 'center';
  ctx.globalAlpha = fadeIn(1.0, 2.0) * out;
  ctx.fillStyle = '#f3e3c0'; ctx.font = 'italic 38px Georgia, serif';
  ctx.fillText(`Day ${ck.day} of the journey`, VW / 2, VH * 0.2);
  ctx.globalAlpha = fadeIn(2.6, 3.4) * out;
  ctx.fillStyle = '#c9c3d8'; ctx.font = '17px Georgia, serif';
  ctx.fillText(`${campClockLabel(ck.tod)} · ${campPhase(ck.tod)}   —   the road leads on to the ${B.name}...`, VW / 2, VH * 0.2 + 36);
  ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
  const black = Math.max(1 - fadeIn(0, 1.0), fadeIn(6.2, CAMP_LEN));
  if (black > 0) { ctx.fillStyle = `rgba(0,0,0,${black})`; ctx.fillRect(0, 0, VW, VH); }
  if (t > 1.5 && t < 6) { ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '12px sans-serif'; ctx.textAlign = 'right'; ctx.fillText('Press any key to continue', VW - 14, VH - 12); }
}

// --- Frame ---
function render() {
  const S = canvas.width / VW;
  ctx.setTransform(S, 0, 0, S, 0, 0);
  ctx.imageSmoothingEnabled = settings.quality !== 'low';
  if (state === 'splash') return drawSplash();
  if (state === 'intro') return drawIntro(introT);
  if (state === 'title') { updateParticles(1 / 60); return drawTitle(); }
  if (state === 'camp') return drawCamp(campT);
  if (state === 'village') return drawVillage();

  const sh = cam.shake;
  ctx.save();
  ctx.translate(-cam.x + Math.sin(tAnim * 47) * sh * 0.5, -cam.y + Math.cos(tAnim * 41) * sh * 0.5);
  drawWorld();
  drawParticles();
  if (dev.hitboxes) drawHitboxes();
  drawPopups(false);
  ctx.restore();

  // low-HP vignette when post-FX is off
  if (!fxActive && gfx.glow && hero.hp / hero.maxHp < 0.3 && !hero.dead) {
    const g = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VH * 0.9);
    g.addColorStop(0, 'rgba(120,0,0,0)'); g.addColorStop(1, `rgba(150,0,0,${0.3 + (settings.comfort ? 0 : Math.sin(tAnim * 3) * 0.08)})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  }
  if (dun) drawDungeonDark(); else drawSky();
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.7, flash)})`; ctx.fillRect(0, 0, VW, VH); }
  drawHUD();
  drawPopups(true);

  if (hero.dead && hero.deadT > 0.8) {
    const a = Math.min(1, (hero.deadT - 0.8) * 1.5);
    ctx.fillStyle = `rgba(0,0,0,${0.6 * a})`; ctx.fillRect(0, 0, VW, VH);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#e33'; ctx.textAlign = 'center';
    ctx.font = 'bold 54px Georgia, serif'; ctx.fillText('YOU DIED', VW / 2, VH / 2);
    ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif';
    ctx.fillText(`Reached wave ${wave}, level ${hero.level}`, VW / 2, VH / 2 + 38);
    const lostW = Math.max(0, wave - Math.max(0, lastSavedWave));
    ctx.fillStyle = '#f5c451'; ctx.font = '15px sans-serif';
    ctx.fillText(`Lost ${hero.lostGold.toLocaleString()} gold  ·  ${lostW} wave${lostW === 1 ? '' : 's'} since your last save`, VW / 2, VH / 2 + 64);
    ctx.fillStyle = '#bbb';
    ctx.fillText('R: reload your last save   ·   Esc: menu', VW / 2, VH / 2 + 92);
    ctx.globalAlpha = 1;
  }
  if (rebirthFx) drawRebirthFx();
}


// Frame pacing: the FPS cap.
// The cap snaps to a whole divisor of the monitor's refresh rate (144 Hz + "60" -> 72 FPS): an uneven
// cap shows some frames for 2 refreshes and others for 3, which is what makes motion stutter.
let last = performance.now(), fpsShown = 0, fpsFrames = 0, fpsTime = 0;
let refreshMs = 1000 / 60, prevRaf = 0, crash = null;
const rafSamples = [];
function frameInterval() {
  return settings.fps ? 1000 / settings.fps : 0;     // exact: 120 means 120, not a refresh-rate divisor
}

// the key bar at the bottom: hidden on the title screens, and the weapon swap only shows once the spare slot is unlocked
const helpEl = document.getElementById('help'), helpBase = helpEl.innerHTML;
let helpKey = '';
function updateHelp() {
  const hide = state === 'splash' || state === 'intro' || state === 'title', swap = !hide && hero && slotOpen('weapon2'), key = hide + ':' + swap;
  if (key === helpKey) return; helpKey = key;
  helpEl.style.visibility = hide ? 'hidden' : 'visible';
  helpEl.innerHTML = swap ? helpBase.replace('<b>M</b>', '<b>X</b>swap weapon<b>M</b>') : helpBase;
}

function loop(now) {
  requestAnimationFrame(loop);
  if (prevRaf) {                                          // measure the real refresh rate
    rafSamples.push(now - prevRaf);
    if (rafSamples.length >= 90) { rafSamples.sort((a, b) => a - b); refreshMs = rafSamples[45]; rafSamples.length = 0; }
  }
  prevRaf = now;
  updateHelp();
  const interval = frameInterval(), elapsed = now - last;
  if (interval && elapsed < interval - 0.6) return;
  // keep the average exact without drifting if a frame runs long
  last = interval ? (elapsed > interval * 2 ? now : last + interval) : now;
  const dt = Math.min(0.1, elapsed / 1000);

  try {
    if (state === 'intro') introT += dt;
    if (state === 'title') tAnim += dt;
    if (state === 'camp') updateCamp(dt);
    wheelSlow += ((wheelOpen ? 0.07 : 1) - wheelSlow) * Math.min(1, dt * 14);        // the wheel slows the world to a near stop (not quite a pause), and it speeds back up when it closes
    const sdt = dt * wheelSlow;
    if (state === 'village' && !paused) updateVillage(Math.min(0.05, sdt));
    if (rebirthFx) updateRebirthFx(dt);
    if (state === 'play' && !paused && !rebirthFx) {
      update(Math.min(0.05, sdt));
    }
    render();
    crash = null;
  } catch (e) {
    // never freeze on a bug: log it once, show it, keep the loop alive
    if (!crash) console.error(e);
    crash = e;
    ctx.setTransform(canvas.width / VW, 0, 0, canvas.width / VW, 0, 0);
    ctx.fillStyle = 'rgba(120,0,0,0.85)'; ctx.fillRect(0, VH - 30, VW, 30);
    ctx.fillStyle = '#fff'; ctx.font = '12px monospace'; ctx.textAlign = 'left';
    ctx.fillText('Game error: ' + String(e.message).slice(0, 120), 10, VH - 11);
  }
  fpsFrames++; fpsTime += elapsed;
  if (fpsTime >= 500) { fpsShown = Math.round(fpsFrames * 1000 / fpsTime); fpsFrames = 0; fpsTime = 0; }
  if (settings.showFps) {
    const S = canvas.width / VW;
    ctx.setTransform(S, 0, 0, S, 0, 0);
    const txt = `${fpsShown} FPS · ${Math.round(1000 / refreshMs)} Hz`;       // bottom right, above the minimap: nothing else lives there
    ctx.font = '12px monospace'; const w = ctx.measureText(txt).width + 16;
    hudPanel(VW - 14 - w, VH - 152, w, 24, { r: 8 });
    ctx.fillStyle = '#7f7'; ctx.textAlign = 'center'; ctx.fillText(txt, VW - 14 - w / 2, VH - 135);
  }
  if (postActive) PostFX.present(canvas, {
    fx: gfx.post, sharp: settings.sharpness / 100, outW: outRes.w, outH: outRes.h,
    hurt: hero && state === 'play'
      ? Math.max(hero.hurtT > 0.5 ? (hero.hurtT - 0.5) * (settings.comfort ? 0.8 : 2) : 0,
                 hero.hp / hero.maxHp < 0.3 && !hero.dead ? 0.3 + (settings.comfort ? 0 : Math.sin(tAnim * 3) * 0.1) : 0)
      : 0,
    warm: world ? world.B.warm + (isNight() ? -0.35 : 0) : 0,
  });
}

canvas.tabIndex = 0;
if (window.stickApp) document.querySelectorAll('.app-only').forEach(el => el.classList.remove('app-only'));   // desktop-only buttons
restoreSavesFromDisk();
gfx = QUALITY[settings.quality];
reset(); hero = null;
setBiome(0, false);
applySettings();
updateFsButton();
// launched from the desktop shortcut (autoplay allowed): skip the click-to-start screen
if (Sound.ctx()?.state === 'running') advanceIntro();
requestAnimationFrame(loop);
