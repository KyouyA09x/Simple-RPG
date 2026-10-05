// Stick RPG: stickman hero in a scrolling world of biomes. Monster waves, a boss every 10 waves,
// character and inventory menu (M), drops, save slots, difficulty, quality presets up to Ultra (WebGL post-FX),
// resolution options and an FPS cap.
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const wrap = document.getElementById('wrap');
const VW = 960, VH = 540;        // logical view size (16:9); rendered at any resolution
const WW = 2400, WH = 1600;      // world size

const FLIP_TIME = 0.4, FLIP_SPEED = 420, FLIP_COOLDOWN = 0.7;
const FLIP_COST = 40, REGEN_DELAY = 0.7;
// Natural regeneration: 4 seconds after the last hit you recover 2% of max HP a second (4% while running), but only up to 70% of max HP:
// the rest takes a potion, the inn or a level-up. Standing still is slower than running, which keeps you moving. Running also refills stamina faster.
const HP_REGEN_DELAY = 4, HP_REGEN_RATE = 0.02, HP_REGEN_MOVE = 2, HP_REGEN_CAP = 0.7, STAMINA_REGEN_MOVE = 1.6;
const regenCap = () => Math.min(1, HP_REGEN_CAP + (typeof gearHas === 'function' && gearHas('vigor') ? 0.15 : 0));
const POINTS_PER_LEVEL = 3;
const GOLD_BASE = 3, GOLD_PER_WAVE = 1.5, GOLD_BOSS_BASE = 60, GOLD_BOSS_PER_WAVE = 12;
const SAVE_KEY = i => `stickrpg_slot${i}`, SLOTS = [1, 2, 3];

// --- Weapon types: every weapon item is one of these; `lvl` is the hero level needed to wield it ---
const SWORDS = [
  { id: 'wood', cost: 10,   name: 'Wooden Sword', lvl: 1,  dmg: 20, range: 52, time: 0.30, len: 24, color: '#b8864b' },
  { id: 'iron', cost: 11,   name: 'Iron Sword',   lvl: 3,  dmg: 28, range: 56, time: 0.30, len: 26, color: '#ccc' },
  { id: 'dagger', cost: 6, name: 'Twin Dagger',  lvl: 5,  dmg: 22, range: 46, time: 0.18, len: 18, color: '#9ef' },
  { id: 'great', cost: 20,  name: 'Greatsword',   lvl: 7,  dmg: 50, range: 72, time: 0.48, len: 38, color: '#888' },
  { id: 'flame', cost: 12,  name: 'Flame Blade',  lvl: 10, dmg: 38, range: 60, time: 0.28, len: 28, color: '#f73', burn: true },
  { id: 'frost', cost: 12,  name: 'Frostbrand',   lvl: 13, dmg: 42, range: 62, time: 0.28, len: 30, color: '#6cf', slow: true },
  { id: 'holy', cost: 13,   name: 'Excalibur',    lvl: 17, dmg: 65, range: 70, time: 0.26, len: 34, color: '#fe6', burn: true, slow: true },
];

// Level stats are a small personal edge: gear is where the build comes from (see GEAR_CAPS in gear.js). Their caps grow a little with every rebirth.
const STATS = [
  { k: 'hp',      color: '#e2565a', name: 'Vitality',    short: 'VIT', desc: '+10 max HP, +0.15% damage reduction', capNote: 'more points allowed with every rebirth', maxFn: () => vitMax() },
  { k: 'str',     color: '#ff9a4a', name: 'Strength',    short: 'STR', desc: '+2 sword damage', capNote: 'more points allowed with every rebirth', maxFn: () => strMax() },
  { k: 'sta',     color: '#5fd07a', name: 'Stamina',     short: 'STA', desc: '+10 max stamina, +regen, +0.15% move speed', capNote: 'speed caps at +6%', softCap: 50 },
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
const settings = { quality: 'high', res: 'auto', renderScale: '100', sharpness: 60, fps: 0, showFps: false, musicVol: 50, sfxVol: 80, ambVol: 60, comfort: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem('rpgSettings')) || {}); } catch {}
if (!QUALITY[settings.quality]) settings.quality = 'high';
if (!['100', '85', '75', '67', '50'].includes(String(settings.renderScale))) settings.renderScale = '100';
settings.renderScale = String(settings.renderScale);
settings.sharpness = Math.max(0, Math.min(100, Number(settings.sharpness) || 0));
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
  try { localStorage.setItem('rpgSettings', JSON.stringify(settings)); } catch {}
}

document.querySelectorAll('.opts[data-set]').forEach(g => g.addEventListener('click', e => {
  const v = e.target.dataset.v;
  if (v === undefined) return;
  const k = g.dataset.set;
  settings[k] = k === 'showFps' || k === 'comfort' ? v === 'true' : v;
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
    potions: 2, cures: 0, potionSel: 'heal', lamp: 0, lightBonus: 0, potionCd: 0,
    scarf: Array.from({ length: 7 }, () => ({ x: WW / 2, y: WH / 2 - 50 })),
  };
  applyRebirthPerks(); initGear();
  enemies = []; corpses = []; popups = []; drops = []; projectiles = []; shockwaves = []; particles = [];
  boss = null; vil = null; villageSkip = -1; clearHazards();
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
    biome: zone, tod, dayCount, weather: weather.kind, gold: hero.gold, potions: hero.potions | 0, cures: hero.cures | 0, potionSel: hero.potionSel || 'heal', lamp: hero.lamp | 0, ...serializeGear(),
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
  hero.potions = Math.max(0, Math.min(POTION_MAX, d.potions | 0)); hero.cures = Math.max(0, Math.min(POTION_MAX, d.cures | 0)); hero.potionSel = d.potionSel === 'cure' ? 'cure' : 'heal'; hero.lamp = Math.max(0, Math.min(LAMPS.length - 1, d.lamp | 0)); applyLamp();
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
  if (act === 'delete' && confirm(`Delete save in slot ${i}? This can't be undone.`)) { eraseSlot(i); renderLoad(); }
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
  if (!validSave(d)) { alert('That file is not a valid Stick RPG save.'); return; }
  if (readSlot(importTarget) && !confirm(`Overwrite slot ${importTarget}?`)) return;
  writeSlot(importTarget, JSON.stringify(d));
  sfx('save'); renderLoad();
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
const OVERLAYS = ['title', 'single', 'newgame', 'load', 'menu', 'settings', 'level', 'dev', 'talk', 'shop', 'inv'];
let paused = false, openMenu = null, settingsReturn = 'title';
function showMenu(which) {
  const paused0 = paused;
  openMenu = which;
  paused = (state === 'play' || state === 'village') && which !== null;
  for (const id of OVERLAYS) document.getElementById(id).classList.toggle('show', id === which);
  for (const k in keys) keys[k] = false;
  if (which === 'level') renderLevelMenu();
  if ((which === 'level' || which === 'inv') && !paused0) sfx('menu');
  if (which === 'shop') renderShop();
  if (which === 'inv') renderInventory();
  if (which === 'dev') renderDev();
  if (which === 'menu') renderMenuInfo();
  if (which === 'load') renderLoad();
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
  if (a === 'back') showMenu(settingsReturn);
  if (a === 'newgame') showMenu('newgame');
  if (a === 'load') showMenu('load');
  if (a === 'toTitle') showMenu('title');
  if (a === 'single' || a === 'toSingle') showMenu('single');
  if (a === 'fullscreen') toggleFullscreen();
  if (a === 'continue') { const l = latestSlot(); if (l) loadSlot(l.i); }
  if (a === 'startNew') {
    const d = readSlot(ngSlot);
    if (d && !confirm(`Slot ${ngSlot} already has a save (${d.name}). Overwrite it?`)) return;
    newRun(document.getElementById('ngName').value, ngDiff, ngSlot);
  }
  if (a === 'quitApp') {
    const inRun = hero && (state === 'play' || state === 'village');
    const atRisk = inRun && (wave > Math.max(0, lastSavedWave) || hero.gold > savedGold);
    if (atRisk && !confirm(`Quit to desktop? Progress since your last save (wave ${Math.max(0, lastSavedWave)}) will be lost.`)) return;
    if (window.stickApp) window.stickApp.quit(); else window.close();
  }
  if (a === 'openSaves' && window.stickApp) window.stickApp.openSaveFolder();
  if (a === 'quit') {
    const atRisk = wave > Math.max(0, lastSavedWave) || hero.gold > savedGold;
    if (atRisk && !confirm(`Quit to title? Progress since your last campfire save (wave ${Math.max(0, lastSavedWave)}) will be lost.`)) return;
    goTitle();
  }
}));
function renderMenuInfo() {
  const el = document.getElementById('menuInfo');
  if (!el || !hero) return;
  const w = Math.max(0, lastSavedWave), lostW = Math.max(0, wave - w), lostG = Math.max(0, hero.gold - savedGold);
  el.innerHTML = `Saves happen after every 5th wave, at the village (wave 9 of each set) and at campfires (after each boss). <em>Last save: wave ${w}</em>` +
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
    sfx('upgrade'); renderLevelMenu();
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
wrap.addEventListener('pointerdown', e => { if (e.target === canvas || e.target.id === 'gl') { if (!advanceIntro() && rebirthFx) skipRebirthFx(); } });
addEventListener('keydown', e => {
  Sound.ctx();   // browsers only allow audio after a user gesture
  const tag = e.target.tagName;
  if ((tag === 'INPUT' && e.target.type === 'text') && e.code !== 'Escape') return;
  if (advanceIntro()) return;
  if (rebirthFx) { skipRebirthFx(); return; }                    // the rebirth scene: any key moves it along, nothing else happens meanwhile
  if (state === 'camp') { if (campT > 1.5 && campT < 6.2) campT = 6.2; return; }
  if (e.code === 'KeyF' && !e.repeat) { toggleFullscreen(); return; }
  if (state === 'title') {
    if (e.code === 'Escape' && openMenu !== 'title') showMenu(openMenu === 'settings' ? settingsReturn : openMenu === 'newgame' || openMenu === 'load' ? 'single' : 'title');
    return;
  }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    showMenu(openMenu === 'settings' ? settingsReturn : paused ? null : 'menu');
    return;
  }
  if (e.code === 'Backquote' && !e.repeat && (openMenu === null || openMenu === 'dev')) {
    showMenu(openMenu === 'dev' ? null : 'dev');
    return;
  }
  if ((e.code === 'KeyM' || e.code === 'Tab') && (openMenu === null || openMenu === 'level' || openMenu === 'inv')) {      // M: Character, Tab: Inventory (two separate windows)
    e.preventDefault();
    if (!e.repeat && !hero.dead) { const w = e.code === 'KeyM' ? 'level' : 'inv'; showMenu(openMenu === w ? null : w); }
    return;
  }
  if ((openMenu === 'talk' || openMenu === 'shop') && /^(Digit|Numpad)[0-9]$/.test(e.code)) {   // number keys pick dialogue / shop options
    e.preventDefault(); if (e.repeat) return;
    const n = +e.code.slice(-1);
    const btns = [...document.querySelectorAll(openMenu === 'talk' ? '#talkBtns button' : '#shopBody [data-buy]')];
    if (n === 0 && openMenu === 'shop') showMenu(null);
    else if (btns[n - 1] && !btns[n - 1].disabled) btns[n - 1].click();
    return;
  }
  if (paused) return;
  keys[e.code] = true;
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  if (e.repeat) return;
  if (hero.dead) {
    if (e.code === 'KeyR' && hero.deadT > 1) { if (!loadSlot(currentSlot)) newRun(hero.name, diffKey, currentSlot); }
    return;
  }
  if (e.code === 'KeyQ') drinkPotion();
  if (e.code === 'KeyR') switchPotion();
  if (e.code === 'KeyX' && slotOpen('weapon2')) {                                  // rebirth 10: swap to the spare weapon
    const r = swapWeapons();
    popups.push({ text: r === 'ok' ? `Swapped to ${hero.equip.weapon.name}` : r === 'empty' ? 'No spare weapon (set one in the inventory)' : r, x: VW / 2, y: 120, t: 1.4, screen: true, small: true, color: r === 'ok' ? '#fd4' : '#fb8' });
    if (r === 'ok') sfx('pickup');
  }
  if (state === 'village') { if (e.code === 'KeyE') villageInteract(); return; }     // no fighting in the village
  if (e.code === 'Space') startAttack();
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') startFlip();
});
addEventListener('keyup', e => { keys[e.code] = false; });
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
const swordDmg = () => Math.round((hero.sword.dmg + Math.min(strMax(), hero.stats.str) * 2 + Math.round(gearStat('dmg'))) * rbDmgMul());
const maxStamina = () => 100 + hero.stats.sta * 10 + Math.round(gearStat('stamina'));
const staminaRegen = () => Math.min(32, 14 + hero.stats.sta * 1.2);      // hard cap: stamina still matters late
const flipCooldown = () => FLIP_COOLDOWN * (1 - hero.stats.cd * 0.06) * (1 - Math.min(0.5, gearStat('cdr')));
const dmgReduction = () => capValue('dr', Math.min(drCap(), Math.min(vitMax(), hero.stats.hp) * 0.0015));        // Vitality gives at most 10% (and its points are capped well before that); with gear the ceiling is 60%
const moveSpeed = () => BASE_SPEED * (1 + capValue('speed', Math.min(speedCap(), hero.stats.sta * 0.0015))) * (hero.chillT > 0 ? 0.65 : 1);      // a Frost nova chills you
const critChance = () => capValue('crit', BASE_CRIT + Math.min(CRIT_POINTS_MAX, hero.stats.crit) * 0.005);
const critMult = () => capValue('critDmg', BASE_CRIT_MULT + Math.min(CRIT_POINTS_MAX, hero.stats.crit) * 0.02);

function startAttack() {
  if (hero.attackT > 0 || hero.flipT > 0) return;
  if (hero.stamina < hero.sword.cost) { sfx('tired'); return; }
  hero.stamina -= hero.sword.cost;
  hero.regenT = REGEN_DELAY;
  hero.attackDur = hero.sword.time * (1 - hero.stats.cd * 0.04) * (1 - Math.min(0.35, gearStat('cdr') * 0.6));
  hero.attackT = hero.attackDur;
  hero.hitSet = new Set();
  sfx('swing');
}

function startFlip() {
  if (hero.flipT > 0 || hero.flipCd > 0) return;
  if (hero.stamina < FLIP_COST) { sfx('tired'); popups.push({ text: 'No stamina', x: hero.x, y: hero.y - 75, t: 0.6, color: '#7c7' }); return; }
  hero.stamina -= FLIP_COST;
  hero.regenT = REGEN_DELAY;
  let dx = 0, dy = 0;
  if (keys.KeyA || keys.ArrowLeft) dx--;
  if (keys.KeyD || keys.ArrowRight) dx++;
  if (keys.KeyW || keys.ArrowUp) dy--;
  if (keys.KeyS || keys.ArrowDown) dy++;
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
  if (src) {
    if (src.poisons) addPoison(src);
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
  if (!gfx.ambient || !world) return;
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
const TYPES = {
  goblin:   { hp: 30, speed: 110, r: 12, dmg: 8,  xp: 12, from: 1, color: '#3d8b3d', gold: 1 },
  minotaur: { hp: 60, speed: 60,  r: 18, dmg: 10, xp: 22, from: 1, color: '#6b3e26', gold: 1.4 },
  slime:    { hp: 45, speed: 0,   r: 16, dmg: 8,  xp: 15, from: 2, color: '#5b5', gold: 1 },
  archer:   { hp: 35, speed: 70,  r: 12, dmg: 10, xp: 20, from: 3, color: '#ddd', gold: 1.2 },
  ogre:     { hp: 140, speed: 40, r: 24, dmg: 18, xp: 45, from: 7, color: '#6a7a3a', gold: 2.2 },
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
    ...extra,
  };
  enemies.push(m);
  if (!extra.noVariant) rollVariant(m, extra.variant);
  burst(pos.x, pos.y, m.elite ? '#ffd24a' : '#000', m.elite ? 14 : 6, 60, 3, -30);
  return m;
}
function spawnElite() {
  const pool = Object.keys(TYPES).filter(t => wave >= TYPES[t].from);
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
  const pool = Object.keys(TYPES).filter(t => wave >= TYPES[t].from);
  const pos = setPos(wave);
  let n = 2 + Math.floor(Math.random() * (2 + pos)) + 2 * tierOf(wave);
  if (pos === 9) n = Math.round(n * 1.3);
  const list = Array.from({ length: n }, () => pool[Math.floor(Math.random() * pool.length)]);
  if (pos === 5) for (let i = 0; i < 3 + tierOf(wave); i++) list.push('goblin');
  const t = tierOf(wave);                                         // elites turn up in ordinary waves once a boss has fallen, more often the further you get
  const elites = t < 1 ? 0 : (Math.random() < Math.min(0.6, 0.2 + 0.1 * t) ? 1 : 0) + (pos === 9 ? 1 : 0) + (t >= 3 && Math.random() < 0.3 ? 1 : 0);
  for (let i = 0; i < elites; i++) list.splice(Math.floor(Math.random() * (list.length + 1)), 0, 'elite');
  return list;
}

function updateWaves(dt) {
  if (spawnQueue.length > 0) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      const t = spawnQueue.shift();
      t === 'boss' ? spawnBoss() : t === 'elite' ? spawnElite() : spawnEnemy(t);
      sfx('spawn');
      spawnTimer = 0.3 + Math.random() * 1.3;
    }
  } else if (enemies.length === 0 && !hero.dead) {
    waveTimer -= dt;
    if (waveTimer <= 0) {
      if (wave > 0 && setPos(wave) === 5 && lastSavedWave < wave) {                                       // a checkpoint after every 5th wave (the village and the campfire cover the rest)
        saveGame(true, true); popups.push({ text: `Checkpoint: wave ${wave} saved`, x: VW / 2, y: 150, t: 2.2, screen: true, small: true, color: '#9f9' });
      }
      if ((wave + 1) % WAVES_PER_SET === 0 && villageSkip !== wave + 1) { enterVillage(); return; }   // a village before every boss
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
  if (m.kind && m.kind !== 'minotaur') updateKitBoss(m, dt, dx, dy, dist, spd); else updateMinotaurBoss(m, dt, dx, dy, dist, spd);
}
function updateMinotaurBoss(m, dt, dx, dy, dist, spd) {
  if (!m.summoned && m.hp < m.maxHp / 2) {         // phase 2: call minions + enrage
    m.summoned = true; m.speed *= 1.3;
    for (let i = 0; i < 3; i++) spawnEnemy(i ? 'goblin' : 'minotaur');
    sfx('roar'); shake(8);
    popups.push({ text: `${m.name} is enraged!`, x: VW / 2, y: 150, t: 2, big: true, screen: true, color: '#f66' });
  }
  if (m.state === 'walk') {
    m.x += (dx / dist) * spd * dt; m.y += (dy / dist) * spd * dt;
    m.facing = Math.sign(dx) || m.facing;
    m.walkT += dt * 5;
    if (m.stateT <= 0 && !hero.dead) {
      if (dist < 140 || Math.random() < 0.4) { m.state = 'slamWind'; m.stateT = 0.8; }
      else { m.state = 'windup'; m.stateT = 0.6; m.charges = m.summoned ? 3 : 2; }
      m.chargeDx = dx / dist; m.chargeDy = dy / dist;
    }
  } else if (m.state === 'windup') {
    m.chargeDx = dx / dist; m.chargeDy = dy / dist; m.facing = Math.sign(dx) || m.facing;
    if (m.stateT <= 0) { m.state = 'charge'; m.stateT = 0.55; sfx('charge'); }
  } else if (m.state === 'charge') {
    m.x += m.chargeDx * 460 * dt; m.y += m.chargeDy * 460 * dt;
    m.walkT += dt * 18;
    if (gfx.particles && Math.random() < 0.5) burst(m.x, m.y, '#a98', 1, 40, 4, -10);
    if (m.stateT <= 0) {
      if (--m.charges > 0) { m.state = 'windup'; m.stateT = 0.35; }
      else { m.state = 'walk'; m.stateT = 1.5 + Math.random(); }
    }
  } else if (m.state === 'slamWind') {
    if (m.stateT <= 0) {
      shockwaves.push({ x: m.x, y: m.y, r: 10, maxR: m.summoned ? 320 : 240, hit: false, dmg: m.dmg });
      sfx('slam'); shake(12);
      burst(m.x, m.y, '#b9a', 24, 220, 4, 100);
      m.state = 'walk'; m.stateT = 1.8 + Math.random();
    }
  }
  m.x = Math.max(20, Math.min(WW - 20, m.x)); m.y = Math.max(60, Math.min(WH - 10, m.y));
}

function updateEnemies(dt) {
  for (const m of enemies) {
    const dx = hero.x - m.x, dy = hero.y - m.y, dist = Math.hypot(dx, dy) || 1;
    m.flashT = Math.max(0, m.flashT - dt);
    m.slowT = Math.max(0, m.slowT - dt);
    m.spawnT = Math.max(0, (m.spawnT || 0) - dt);
    if (m.burnT > 0) {
      m.burnT -= dt; m.burnTick = (m.burnTick || 0) - dt;
      if (m.burnTick <= 0) { m.burnTick = 0.5; m.hp -= 4; popups.push({ text: '4', x: m.x, y: m.y - 70, t: 0.4, color: '#f84' }); }
      if (gfx.particles && Math.random() < 0.3) particles.push({ x: m.x + (Math.random() - 0.5) * 20, y: m.y - 30 - Math.random() * 20, vx: 0, vy: -50, life: 0.5, max: 0.5, size: 2.5, color: '#f73', add: true });
    }
    m.stateT -= dt;
    const wm = waterAt(m.x, m.y) ? 0.75 : 1;
    const fz = m.frenzy && m.hp < m.maxHp * 0.3 ? 1.5 : 1;       // a Frenzied monster goes berserk when hurt
    const spd = m.speed * fz * (m.slowT > 0 ? 0.5 : 1) * wm;
    const slowMul = (m.slowT > 0 ? 0.5 : 1) * wm;

    if (m.type === 'boss') updateBoss(m, dt, dx, dy, dist, spd);
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
          m.state = 'walk'; m.stateT = 1.5;
        }
      }
    } else if (m.type === 'goblin') {
      const wob = Math.sin(m.walkT * 0.6) * 0.6;      // zig-zag rush
      m.x += (dx / dist - dy / dist * wob) * spd * dt;
      m.y += (dy / dist + dx / dist * wob) * spd * dt;
      m.facing = Math.sign(dx) || m.facing; m.walkT += dt * stepRate(spd, 8.5 * 0.9);
    } else if (m.type === 'slime') {
      if (m.state === 'walk' && m.stateT <= 0) { m.state = 'hop'; m.stateT = 0.5; m.chargeDx = dx / dist; m.chargeDy = dy / dist; }
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

    if (!hero.dead && dist < m.r + 12 && (m.hopZ || 0) < 10 && m.spawnT < 0.2) {
      damageHero((m.state === 'charge' ? m.dmg * 2 + 5 : m.dmg) * fz, true, m);
    }
  }

  // sword hits (active in the middle of the swing)
  const sw = hero.sword;
  if (hero.attackT > 0 && hero.attackT < hero.attackDur * 0.7) {
    for (const m of enemies) {
      if (hero.hitSet.has(m)) continue;
      const dx = m.x - hero.x, dy = m.y - hero.y;
      const dist = Math.hypot(dx, dy);
      // what a swing reaches: the arc in front of you (a little past your shoulder counts as in front), and your whole body.
      // Anything close enough to hurt you (contact is m.r + 12) is always close enough to hit, on whichever side it stands.
      const inFront = dist < sw.range + m.r * 0.6 && dx * hero.facing > -10, onBody = dist < m.r + 20;
      if (inFront || onBody) {
        hero.hitSet.add(m);
        const crit = Math.random() < critChance(), dmg = dev.oneHit ? Math.max(1, Math.ceil(m.hp)) : Math.max(1, Math.round(swordDmg() * (crit ? critMult() : 1) * (1 - (m.armor || 0))));
        const hpBefore = m.hp; m.hp -= dmg;
        if (gearHas('lifesteal')) hero.hp = Math.min(hero.maxHp, hero.hp + Math.min(dmg, hpBefore) * 0.04);
        m.flashT = 0.15;
        m.knockX = m.noKnock ? 0 : (Math.sign(dx) || hero.facing) * (m.type === 'boss' ? 120 : m.type === 'ogre' ? 200 : 500);          // away from you, never through you
        if (sw.burn) m.burnT = 3;
        if (sw.slow) m.slowT = 2.5;
        if (m.state === 'windup' && m.type !== 'boss') { m.state = 'walk'; m.stateT = 0.8; } // interrupt
        popups.push({ text: crit ? `${dmg}!` : `${dmg}`, x: m.x, y: m.y - 80, t: 0.7, color: crit ? '#f80' : '#ff0', pop: 0, crit });
        burst(m.x, m.y - 35, crit ? '#fc6' : sw.color, crit ? 16 : 8, 220, 2.2, 250, true);
        if (!settings.comfort) hitStop = crit ? 0.05 : 0.02; shake(crit ? 4 : 2);
        sfx(crit ? 'crit' : m.type === 'slime' ? 'squish' : 'hit');
      }
    }
  }

  const dead = enemies.filter(m => m.hp <= 0);
  enemies = enemies.filter(m => m.hp > 0);
  for (const m of dead) onKill(m);
}

function onKill(m) {
  corpses.push({ ...m, dieT: 0, dieMax: m.type === 'boss' ? 1.6 : 0.6 });
  burst(m.x, m.y - 30, TYPES[m.type]?.color || '#fff', 14, 180, 3, 250);
  if (m.type === 'slime' && m.size === 1) {        // big slimes split
    for (const s of [-1, 1]) spawnEnemy('slime', { x: m.x + s * 15, y: m.y }, { size: 0.6, r: 10, hp: 18, maxHp: 18, xp: 5, spawnT: 0 });
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
    d.t = 0;
    burst(d.x, d.y, d.kind === 'gear' ? RARITIES[d.item.rarity].color : DROPS[d.kind].color, 10, 120, 2, -50, true);
    const lbl = DROPS[d.kind].label;
    if (d.kind === 'potion') { const h = Math.round(hero.maxHp * 0.3); hero.hp = Math.min(hero.maxHp, hero.hp + h); sfx('potion'); popups.push({ text: `+${h} HP`, x: d.x, y: d.y - 30, t: 1, color: '#f77' }); }
    if (d.kind === 'big') { hero.hp = hero.maxHp; hero.stamina = maxStamina(); sfx('potion'); popups.push({ text: 'Fully healed!', x: d.x, y: d.y - 30, t: 1, color: '#f6c' }); }
    if (d.kind === 'energy') { hero.stamina = maxStamina(); sfx('pickup'); popups.push({ text: 'Stamina!', x: d.x, y: d.y - 30, t: 1, color: '#5d5' }); }
    if (d.kind === 'gem') { sfx('pickup'); gainXp(Math.round((15 + wave * 4) * D().xp), d); }
    if (d.kind === 'gold') { hero.gold += d.amount; hero.goldPulse = 0.5; sfx('coin'); popups.push({ text: `+${d.amount}`, x: d.x, y: d.y - 24, t: 0.8, color: '#f5c451' }); }
    if (d.kind === 'star') { hero.points++; sfx('unlock'); popups.push({ text: lbl, x: d.x, y: d.y - 30, t: 1.2, color: '#fd4' }); }
  }
  drops = drops.filter(d => d.t > 0);
}

function updateProjectiles(dt) {
  for (const p of projectiles) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.t -= dt;
    if (Math.hypot(p.x - hero.x, p.y - (hero.y - 35)) < 18 && !invulnerable() && !hero.dead) { damageHero(p.dmg, true, p.src); p.t = 0; }
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
    popups.push({ text: hero.level >= levelCap() ? `MAX LEVEL ${hero.level}! The shrine awaits` : `LEVEL UP! +${pointsPerLevel()} points (M)`, x: VW / 2, y: 230, t: 1.8, color: '#fd4', big: true, screen: true });
    burst(hero.x, hero.y - 30, '#fd4', 30, 200, 2.5, -40, true);
    sfx('levelup');
  }
  if (hero.level >= levelCap()) hero.xp = 0;
}

function updateHero(dt) {
  if (hero.dead) { hero.deadT += dt; return; }
  hero.flipCd = Math.max(0, hero.flipCd - dt);
  hero.potionCd = Math.max(0, (hero.potionCd || 0) - dt);
  hero.hurtT = Math.max(0, hero.hurtT - dt);
  hero.dodgeT = Math.max(0, (hero.dodgeT || 0) - dt);
  hero.capT = Math.max(0, (hero.capT || 0) - dt);
  hero.auraT = Math.max(0, hero.auraT - dt);
  hero.chillT = Math.max(0, (hero.chillT || 0) - dt);
  if (hero.poison && tickPoison(dt)) { killHero(); return; }
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
    if (keys.KeyA || keys.ArrowLeft) dx--;
    if (keys.KeyD || keys.ArrowRight) dx++;
    if (keys.KeyW || keys.ArrowUp) dy--;
    if (keys.KeyS || keys.ArrowDown) dy++;
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
  const wet = !!waterAt(hero.x, hero.y);                  // wading: slower, with splashes
  if (wet !== !!hero.inWater) { hero.inWater = wet; burst(hero.x, hero.y, '#bfe4f4', 12, 130, 2.2, 260); sfx('splash'); }

  // lava burns (unless mid-flip)
  if (world.lava.length && hero.flipT <= 0 && world.lava.some(l => ((hero.x - l.x) / l.rx) ** 2 + ((hero.y - l.y) / l.ry) ** 2 < 1)) {
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
  sceneT -= dt; if (sceneT > 0 || !world) return; sceneT = 0.25;
  const p = weatherPower(), a = WEATHER[weather.kind], b = WEATHER[weather.next];
  const rainOf = w => w.fx === 'rain' ? 0.09 * (w.dens || 1) : w.fx === 'hail' ? 0.1 : 0;
  const pitchOf = w => w.fx === 'sand' ? 1100 : (w.fx === 'snow' && w.fall) ? 700 : 450;
  Sound.setScene({ biome: world.B.ambience, night: night01() > 0.5, wind: clampN(0.035 + windMul() * 0.05, 0, 0.3),
    rain: rainOf(a) * (1 - p) + rainOf(b) * p, pitch: pitchOf(a) * (1 - p) + pitchOf(b) * p });
}

function update(dt) {
  dt *= dev.speed;
  tAnim += dt;
  if (!dev.freezeTime) updateSky(dt, zone);
  playTime += dt;
  flash = Math.max(0, flash - dt);
  if (hitStop > 0) { hitStop -= dt; updateParticles(dt); return; }   // freeze-frame on hit
  updateHero(dt);
  updateWaves(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updateDrops(dt);
  updateParticles(dt);
  updateCritters(dt);
  updateDarkEyes(dt);
  updateSoundScene(dt);
  updateCamera(dt);
  for (const c of corpses) c.dieT += dt;
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

// Full hero pose. o: { p: run phase, run, lean, breath, atk (0..1, or -1 when not attacking), tuck }
function poseStick(x, y, f, o) {
  const p = o.p || 0, br = o.breath || 0, lean = o.lean || 0;
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

  // back (free) arm swings opposite the front leg; elbows bow backwards
  let bh;
  if (o.tuck) bh = { x: sh.x + f * 9, y: sh.y + 9 };
  else if (o.run) bh = { x: sh.x - f * 9 * Math.cos(p), y: sh.y + 13 - Math.abs(Math.sin(p)) * 2 };
  else bh = { x: sh.x - f * 3, y: sh.y + 17 + br * 0.3 };
  const back = ik(sh.x, sh.y, bh.x, bh.y, 9.5, 9.5, f);

  // sword arm. ang is the hand's direction from the shoulder: 0 = straight ahead, negative = up.
  let hand, blade;
  if (o.atk >= 0) {
    const t = o.atk;
    const ang = t < 0.22 ? 0.6 + (-2.4 - 0.6) * (t / 0.22)              // quick wind-up over the shoulder
                         : -2.4 + 3.4 * (1 - Math.pow(1 - (t - 0.22) / 0.78, 3));  // fast slash, eases out low
    hand = { x: sh.x + f * Math.cos(ang) * 16, y: sh.y + Math.sin(ang) * 16 };
    blade = ang - 0.3;
  } else if (o.tuck) {
    hand = { x: sh.x + f * 10, y: sh.y + 6 }; blade = -0.2;
  } else {
    const sway = o.run ? Math.cos(p) * 3 : br * 0.3;
    hand = { x: sh.x + f * (8 + sway), y: sh.y + 15 };
    blade = o.run ? 0.15 : 0.35;                                        // sword held low and forward
  }
  const front = ik(sh.x, sh.y, hand.x, hand.y, 9.5, 9.5, f);
  return { hip, neck, head, sh, legs, back, front, blade, f };
}
function drawStickBody(J) {
  poly(J.sh, J.back.j, J.back.e);
  for (const l of J.legs) poly(...l);
  poly(J.hip, J.neck);
  poly(J.sh, J.front.j, J.front.e);
}
function drawSword(J, sw, glow) {
  const h = J.front.e, f = J.f;
  const dx = f * Math.cos(J.blade), dy = Math.sin(J.blade);
  ctx.save();
  if (glow) { ctx.shadowColor = sw.color; ctx.shadowBlur = 12; }
  ctx.strokeStyle = sw.color; ctx.lineWidth = sw.id === 'great' ? 5 : 3;
  line(h.x, h.y, h.x + dx * sw.len, h.y + dy * sw.len);
  ctx.restore();
  ctx.strokeStyle = '#654'; ctx.lineWidth = 3;                   // crossguard + pommel
  line(h.x - dy * 5, h.y + dx * 5, h.x + dy * 5, h.y - dx * 5);
  line(h.x, h.y, h.x - dx * 4, h.y - dy * 4);
  return { x: h.x + dx * sw.len, y: h.y + dy * sw.len };
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
  const lean = (run ? 0.16 : 0.02) + (atk >= 0 ? Math.sin(atk * Math.PI) * 0.18 : 0) - (h.hurtT > 0.6 ? 0.25 : 0);
  const J = poseStick(x, y, f, { p: h.walkT, run, lean, breath, atk, tuck: flipping });
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
  drawStickBody(J);
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
  if (atk > 0.22 && gfx.trail) {
    const r = 16 + sw.len * 0.85, a0 = -2.4 - 0.3, a1 = J.blade;
    ctx.strokeStyle = sw.burn || sw.slow ? sw.color : 'rgba(255,255,255,0.8)';
    ctx.globalAlpha *= 0.5 * (1 - (atk - 0.22) / 0.78 * 0.6); ctx.lineWidth = 4;
    ctx.beginPath();
    if (f > 0) ctx.arc(J.sh.x, J.sh.y, r, a0, a1, false);
    else ctx.arc(J.sh.x, J.sh.y, r, Math.PI - a0, Math.PI - a1, true);
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
  if (m.burnT > 0) { ctx.fillStyle = '#f73'; ctx.fillRect(m.x + 22, m.y - yOff, 5, 5); }
  if (m.slowT > 0) { ctx.fillStyle = '#6cf'; ctx.fillRect(m.x + 22, m.y - yOff + (m.burnT > 0 ? 6 : 0), 5, 5); }
}

function drawMinotaur(m, scale = 1, skin = '#6b3e26', crown = false) {
  const { x, y, facing: f } = m;
  drawShadow(x, y, 20 * scale);
  ctx.save();
  const breathe = 1 + Math.sin(tAnim * 3 + x) * 0.02;
  ctx.translate(x, y); ctx.scale(scale, scale * breathe); ctx.translate(-x, -y);
  const swing = Math.sin(m.walkT) * 0.5;
  const winding = m.state === 'windup' || m.state === 'slamWind' || m.state === 'smashWind';
  const shake = winding ? Math.sin(performance.now() / 20) * 2 : 0;
  const bx = x + shake;
  const lean = m.state === 'charge' ? f * 10 : 0;
  const lift = m.state === 'slamWind' || m.state === 'smashWind' ? -14 : 0;

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
  line(bx + lean * 0.5 - 12, y - 56, bx - 20 - swing * 6, y - 34 + lift * 3);
  line(bx + lean * 0.5 + 12, y - 56, bx + 20 + swing * 6, y - 34 + lift * 3);
  const hx = bx + lean + f * 6, hy = y - 72;
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
  ctx.fillStyle = m.state !== 'walk' ? '#f00' : '#000';
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
  const ph = m.walkT, c = statusTint(m, '#3d8b3d');
  ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.lineCap = 'round';
  drawLegs(x, y - 16 + Math.abs(Math.cos(ph)) * 1.5, y, f, ph, true, 8.5);
  const bob = Math.abs(Math.sin(ph)) * 2;
  line(x, y - 16, x + f * 3, y - 31 - bob);
  line(x + f * 2, y - 27 - bob, x + f * 11, y - 21 + Math.sin(ph) * 4);
  ctx.strokeStyle = '#999'; line(x + f * 11, y - 21 + Math.sin(ph) * 4, x + f * 19, y - 29 + Math.sin(ph) * 4); // dagger
  ctx.fillStyle = c;
  const hx = x + f * 3, hy = y - 38 - bob, ear = Math.sin(tAnim * 8 + x) * 2;
  ctx.beginPath(); ctx.arc(hx, hy, 8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(hx - 6, hy - 3); ctx.lineTo(hx - 17, hy - 9 + ear); ctx.lineTo(hx - 5, hy + 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(hx + 6, hy - 3); ctx.lineTo(hx + 17, hy - 9 - ear); ctx.lineTo(hx + 5, hy + 2); ctx.fill();
  ctx.fillStyle = '#ff0'; ctx.beginPath(); ctx.arc(hx + f * 3, hy - 1, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(hx + f * 2, hy + 3, f * 4, 1.5);   // teeth
  drawHpBar(m, 58);
}

function drawSlime(m) {
  const { x, y } = m, s = m.size, z = m.hopZ || 0;
  drawShadow(x, y, 16 * s * (1 - z / 60));
  const land = (m.land || 0) / 0.2;
  const sq = m.state === 'hop' ? 0.85 : 1 + Math.sin(tAnim * 6 + x) * 0.07 + land * 0.35;
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
  const aim = m.state === 'aim', draw = aim ? Math.min(1, 1 - m.stateT / 0.7) : 0;
  ctx.lineWidth = 3;
  line(x, y - 40, x + f * 16, y - 38);
  ctx.strokeStyle = '#8b5a2b'; ctx.lineWidth = 2;
  const bcx = x + f * 12;
  ctx.beginPath();
  if (f > 0) ctx.arc(bcx, y - 38, 12, -1.2, 1.2); else ctx.arc(bcx, y - 38, 12, Math.PI - 1.2, Math.PI + 1.2);
  ctx.stroke();
  const tipX = bcx + f * Math.cos(1.2) * 12, pull = bcx + f * (Math.cos(1.2) * 12 - draw * 12);
  ctx.strokeStyle = '#eee'; ctx.lineWidth = 1;
  line(tipX, y - 38 - Math.sin(1.2) * 12, pull, y - 38);
  line(pull, y - 38, tipX, y - 38 + Math.sin(1.2) * 12);
  if (aim) { ctx.strokeStyle = '#ccc'; ctx.lineWidth = 2; line(pull, y - 38, pull + f * 20, y - 38); }
  ctx.fillStyle = c;
  ctx.beginPath(); ctx.arc(x, y - 52, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = aim ? '#f33' : '#222';
  ctx.beginPath(); ctx.arc(x + f * 3, y - 53, 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222'; ctx.fillRect(x + f * 1, y - 47, f * 6, 1.5);
  drawHpBar(m, 72);
}

function drawEnemy(m) {
  ctx.save();
  if (m.dieT !== undefined) {                 // death: flash, topple, fade
    const p = m.dieT / m.dieMax;
    ctx.globalAlpha = Math.max(0, 1 - p);
    ctx.translate(m.x, m.y); ctx.rotate(-m.facing * Math.min(1, p * 2) * 1.4); ctx.translate(-m.x, -m.y);
    m.flashT = p < 0.15 ? 1 : 0;
  } else if (m.spawnT > 0) {                  // spawn: rise out of the ground
    const p = m.spawnT / 0.5;
    ctx.globalAlpha = 1 - p;
    ctx.translate(0, p * 14);
  }
  const giant = m.scale > 1;
  if (giant) { ctx.save(); ctx.translate(m.x, m.y); ctx.scale(m.scale, m.scale); ctx.translate(-m.x, -m.y); }          // Giants are drawn bigger (their tags are not)
  if (m.type === 'boss') drawBossArt(m);
  else if (m.type === 'minotaur') { drawMinotaur(m); drawHpBar(m, 100); }
  else if (m.type === 'ogre') { drawMinotaur(m, 1.4, '#6a7a3a'); drawHpBar(m, 130); }
  else if (m.type === 'goblin') drawGoblin(m);
  else if (m.type === 'slime') drawSlime(m);
  else if (m.type === 'archer') drawArcher(m);
  if (giant) ctx.restore();
  drawVariantTells(m);
  ctx.restore();
}

function drawDrop(d) {
  const color = d.kind === 'gear' ? RARITIES[d.item.rarity].color : DROPS[d.kind].color;
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
  ctx.drawImage(world.ground, cam.x, cam.y, VW, VH, cam.x, cam.y, VW, VH);
  drawWater();
  drawLavaGlow();
  drawGrassAndDecor();
  drawCloudShadows();
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
  for (const p of world.props) if (inView(p.x, p.y)) things.push({ y: p.y, d: () => drawProp(p) });
  for (const c of critters) if (inView(c.x, c.y, c.kind === 'fish' ? 200 : 100)) things.push({ y: c.y, d: () => drawCritter(c) });
  for (const d of devils) if (inView(d.x, d.y, 120)) things.push({ y: d.y, d: () => drawDevil(d) });
  for (const c of corpses) if (inView(c.x, c.y)) things.push({ y: c.y, d: () => drawEnemy(c) });
  for (const m of enemies) if (inView(m.x, m.y, 120)) things.push({ y: m.y, d: () => drawEnemy(m) });
  things.push({ y: hero.y, d: () => drawHero(hero) });
  things.sort((a, b) => a.y - b.y).forEach(o => o.d());

  ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2;
  for (const p of projectiles) {
    const a = Math.atan2(p.vy, p.vx);
    line(p.x, p.y, p.x - Math.cos(a) * 16, p.y - Math.sin(a) * 16);
    ctx.fillStyle = '#999'; ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
  }
}

function drawPopups(screen) {
  for (const p of popups) {
    if (!!p.screen !== screen) continue;
    ctx.globalAlpha = Math.min(1, p.t * 2);
    const scale = p.pop !== undefined ? 1 + Math.max(0, 0.6 - p.pop * 4) * (p.crit ? 1.2 : 0.6) : 1;
    ctx.fillStyle = p.color || '#fff'; ctx.textAlign = 'center';
    ctx.font = `bold ${Math.round((p.big ? 28 : p.small ? 13 : 16) * scale)}px sans-serif`;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(p.text, p.x, p.y); ctx.fillText(p.text, p.x, p.y);
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
  const gr = ctx.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(34,34,52,0.84)'); gr.addColorStop(1, 'rgba(12,12,20,0.82)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.strokeStyle = o.edge || 'rgba(160,160,215,0.26)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.beginPath(); ctx.moveTo(x + r, y + 1.5); ctx.lineTo(x + w - r, y + 1.5); ctx.stroke();       // a thin highlight along the top edge
  if (o.accent) { ctx.fillStyle = o.accent; ctx.beginPath(); ctx.roundRect(x + 5, y + 10, 3, h - 20, 2); ctx.fill(); }
  ctx.restore();
}
// a small rounded label; returns its width
function hudChip(text, x, y, color, size = 10.5) {
  ctx.font = `bold ${size}px ${UI_FONT}`;
  const w = Math.ceil(ctx.measureText(text).width) + 12;
  ctx.fillStyle = 'rgba(8,8,14,0.7)'; ctx.beginPath(); ctx.roundRect(x, y - 11, w, 16, 8); ctx.fill();
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
// Everything harmful that is on the hero right now. A new ailment is one more entry here and one more icon in AILMENT_ICON; the Cure-All clears them all.
const AILMENT_ICON = {
  poison(c, r) {                                                    // a skull with a drip
    c.fillStyle = '#e9ffe9'; c.beginPath(); c.arc(0, -1.5, r * 0.5, 0, Math.PI * 2); c.fill(); c.fillRect(-r * 0.27, r * 0.1, r * 0.54, r * 0.38);
    c.fillStyle = '#0d2a12'; c.beginPath(); c.arc(-r * 0.2, -r * 0.1, r * 0.14, 0, Math.PI * 2); c.arc(r * 0.2, -r * 0.1, r * 0.14, 0, Math.PI * 2); c.fill();
    c.fillRect(-1, r * 0.08, 2, r * 0.18); c.fillRect(-r * 0.12, r * 0.3, 1.3, r * 0.18); c.fillRect(r * 0.1, r * 0.3, 1.3, r * 0.18);
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
  drawPotionSlot(cx - total / 2 - 50, cy);                              // the selected potion sits just left of the health bar
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
  let ey = Y + 52;
  if (lamp) { ctx.fillStyle = '#ffd88a'; ctx.fillText(fitText(lamp.name, bw, 10.5), L, ey + 11); ey += 18; }
  if (pts) {
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(tAnim * 4);
    ctx.fillStyle = '#f5c451'; ctx.fillText(fitText(`${hero.points} stat point${hero.points === 1 ? '' : 's'}: press M`, bw, 12, true, 9), L, ey + 3);
    ctx.globalAlpha = 1;
  }
}

function drawHUD() {
  drawHeroCard(false);
  drawVitals(false);
  drawClock(VW - 164, 10);
  drawWaveChip(false);

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

function stickSilhouette(x, y, ph, sc = 1, walking = true, col = '#000') {
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  const J = poseStick(0, 0, 1, { p: ph, run: walking, lean: walking ? 0.14 : 0.02, breath: walking ? 0 : Math.sin(tAnim * 2.6) * 1.2, atk: -1 });
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  drawStickBody(J);
  const f = 1, h = J.front.e, dx = Math.cos(J.blade), dy = Math.sin(J.blade);
  line(h.x, h.y, h.x + dx * 26, h.y + dy * 26);
  ctx.beginPath(); ctx.arc(J.head.x, J.head.y, 10, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

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
    stickSilhouette(hxp, hy, (hxp + 50) / 1.4 * Math.PI / (2 * HERO_STRIDE), 1.5, walking);
    ctx.strokeStyle = '#a82a2a'; ctx.lineWidth = 3; ctx.lineCap = 'round';                // the red scarf is the only colour on them
    const sx = hxp - 6, sy = hy - 52 * 1.5 / 1.5 * 1.4;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx - 18, sy + 3 + Math.sin(t * 9) * 3, sx - 34, sy - 2 + Math.sin(t * 8) * 6); ctx.stroke();
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
  stickSilhouette(VW / 2 - 200, VH - 40, 0, 2, false);
}

// --- Dev / cheat menu (` key) ---
const dev = { god: false, oneHit: false, stamina: false, swords: false, hitboxes: false, speed: 1, freezeTime: false, noFog: false };
function renderDev() {
  const tog = (k, label) => `<button data-dev="tog" data-k="${k}" class="${dev[k] ? 'on' : ''}">${label}</button>`;
  const btn = (act, label, extra = '') => `<button data-dev="${act}" ${extra}>${label}</button>`;
  const inPlay = state === 'play' && hero;
  document.getElementById('devBody').innerHTML = `
    <h3>TOGGLES</h3><div class="dev-grid">
      ${tog('god', 'God mode')}${tog('oneHit', 'One-hit kills')}${tog('stamina', 'Infinite stamina')}
      ${tog('swords', 'Ignore weapon level limits')}${tog('hitboxes', 'Show hitboxes')}${tog('noFog', 'Disable fog-of-war')}</div>
    <h3>GAME SPEED</h3><div class="dev-grid">
      ${[0.25, 0.5, 1, 2, 4].map(v => `<button data-dev="speed" data-v="${v}" class="${dev.speed === v ? 'on' : ''}">${v}×</button>`).join('')}</div>
    ${inPlay ? `
    <h3>HERO</h3><div class="dev-grid">
      ${btn('gold100', '+100 gold')}${btn('gold1000', '+1000 gold')}${btn('savenow', 'Save now')}
      ${btn('heal', 'Full heal')}${btn('lvl1', '+1 level')}${btn('lvl10', '+10 levels')}${btn('pts', '+10 stat points')}${btn('maxlvl', 'Max level')}${btn('rebirth', '+1 rebirth (keeps all)')}${btn('kill', 'Kill hero')}</div>
    <h3>GEAR</h3><div class="dev-grid">
      ${RARITIES.map((r, i) => `<button data-dev="gear" data-t="${i}" style="border-color:${r.color}">${r.name}</button>`).join('')}${btn('fillpack', 'Fill backpack')}${btn('clearpack', 'Clear backpack')}</div>
    <h3>WAVES</h3><div class="dev-grid">
      ${btn('clear', 'Kill all enemies')}${btn('next', 'Skip wave')}
      <input type="text" id="devWave" value="${wave + 1}"> ${btn('goto', 'Go to wave')}</div>
    <h3>SPAWN</h3><div class="dev-grid">
      ${Object.keys(TYPES).map(t => btn('spawn', t, `data-t="${t}"`)).join('')}${btn('spawn', 'ELITE', 'data-t="elite"')}${MUT_KEYS.map(k => btn('spawn', 'mut: ' + k, `data-t="mut:${k}"`)).join('')}${btn('boss', 'BOSS (this biome)')}
      ${Object.keys(BOSSES).map(k => btn('boss', BOSSES[k].names[0], `data-t="${k}"`)).join('')}
      ${Object.keys(DROPS).map(d => btn('drop', 'drop: ' + d, `data-t="${d}"`)).join('')}</div>
    <h3>WORLD</h3><div class="dev-grid">
      ${BIOMES.map((b, i) => btn('biome', b.name, `data-t="${i}"`)).join('')}${btn('biome', 'Random biome', 'data-t="rand"')}${btn('camp', 'Play campfire scene')}${btn('village', 'Visit the village')}</div>
    <h3>TIME &amp; WEATHER</h3><div class="dev-grid">
      ${[['Dawn', 0.28], ['Noon', 0.5], ['Dusk', 0.75], ['Night', 0.95]].map(([n, v]) => btn('time', n, `data-t="${v}"`)).join('')}
      ${btn('freeze', dev.freezeTime ? 'Time frozen' : 'Freeze time', dev.freezeTime ? 'class="on"' : '')}</div>
    <div class="dev-grid" style="margin-top:6px">
      ${Object.keys(WEATHER).map(k => btn('weather', WEATHER[k].name, `data-t="${k}"`)).join('')}</div>
    <div class="hint">Now: wave ${wave} · level ${hero.level} · ${enemies.length} enemies · ${world.B.name}</div>`
    : '<div class="hint">Start or load a game to use the hero, wave and spawn cheats.</div>'}`;
}
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
  if (act === 'gear') { const it = rollItem({ rarity: +t, level: hero.level }); if (!addToBag(it)) dropGear(it, hero.x + 60, hero.y); }
  if (act === 'fillpack') while (hero.inv.length < INV_MAX) hero.inv.push(rollItem({ tier: depthOf(), level: hero.level }));
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
    else spawnEnemy(t, near(), { spawnT: 0.3 });
  }
  if (act === 'boss') { const w = wave; wave = Math.max(WAVES_PER_SET, wave); spawnBoss(t); wave = w; }
  if (act === 'drop') dropItem(t, hero.x + hero.facing * 50, hero.y - 20);
  if (act === 'biome') { const z = t === 'rand' ? randomBiome() : +t; setBiome(z); Sound.music(BIOMES[z].music); }
  if (act === 'time') tod = +t;
  if (act === 'freeze') dev.freezeTime = !dev.freezeTime;
  if (act === 'weather') setWeather(t, true);
  if (act === 'camp') { showMenu(null); startCamp((zone + 1) % BIOMES.length); return; }
  if (act === 'village') { showMenu(null); enterVillage(); return; }
  renderDev();
});
function drawHitboxes() {
  ctx.save(); ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,60,60,0.9)';
  for (const m of enemies) { ctx.beginPath(); ctx.arc(m.x, m.y, m.r + 12, 0, Math.PI * 2); ctx.stroke(); }    // contact damage
  for (const m of enemies) { ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,160,60,0.8)'; ctx.beginPath(); ctx.arc(m.x, m.y, m.r + 20, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }   // within this of the hero's feet a swing always lands
  ctx.strokeStyle = 'rgba(80,200,255,0.9)';                                                                  // sword reach: the arc in front, from just behind the shoulder
  { const a0 = hero.facing > 0 ? -Math.PI / 2 : Math.PI / 2, a1 = hero.facing > 0 ? Math.PI / 2 : Math.PI * 1.5, back = Math.asin(10 / hero.sword.range) * hero.facing; ctx.beginPath(); ctx.arc(hero.x, hero.y, hero.sword.range, a0 - back, a1 + back); ctx.stroke(); }
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
    drops = []; projectiles = []; shockwaves = []; particles = []; corpses = []; clearHazards(); clearPoison();
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
  drawSky();
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
    if (state === 'village' && !paused) updateVillage(Math.min(0.05, dt));
    if (rebirthFx) updateRebirthFx(dt);
    if (state === 'play' && !paused && !rebirthFx) {
      update(Math.min(0.05, dt));
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
