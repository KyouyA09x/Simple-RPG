// Stick RPG: stickman hero, flip (Shift) with i-frames, monster waves, boss every 5 waves,
// stat/sword level menu (L), item drops, synthesized sound effects.
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = 800, H = 560;   // logical size; backing resolution depends on quality

const FLIP_TIME = 0.4, FLIP_SPEED = 420, FLIP_COOLDOWN = 0.7;
const FLIP_COST = 35, ATTACK_COST = 10;
const POINTS_PER_LEVEL = 3;

// --- Swords (unlocked by hero level) ---
const SWORDS = [
  { id: 'wood',   name: 'Wooden Sword', lvl: 1,  dmg: 20, range: 52, time: 0.30, len: 24, color: '#b8864b' },
  { id: 'iron',   name: 'Iron Sword',   lvl: 3,  dmg: 28, range: 56, time: 0.30, len: 26, color: '#ccc' },
  { id: 'dagger', name: 'Twin Dagger',  lvl: 5,  dmg: 22, range: 46, time: 0.18, len: 18, color: '#9ef' },
  { id: 'great',  name: 'Greatsword',   lvl: 7,  dmg: 50, range: 72, time: 0.48, len: 38, color: '#888' },
  { id: 'flame',  name: 'Flame Blade',  lvl: 10, dmg: 38, range: 60, time: 0.28, len: 28, color: '#f73', burn: true },
  { id: 'frost',  name: 'Frostbrand',   lvl: 13, dmg: 42, range: 62, time: 0.28, len: 30, color: '#6cf', slow: true },
  { id: 'holy',   name: 'Excalibur',    lvl: 17, dmg: 65, range: 70, time: 0.26, len: 34, color: '#fe6', burn: true, slow: true },
];

// --- Stats (spent in the level menu) ---
const STATS = [
  { k: 'hp',  name: 'HP',       desc: '+20 max HP' },
  { k: 'str', name: 'Strength', desc: '+5 sword damage' },
  { k: 'sta', name: 'Stamina',  desc: '+15 max stamina, faster regen' },
  { k: 'cd',  name: 'Cd',       desc: '-6% flip cooldown & swing time', max: 10 },
];

// --- Settings ---
const QUALITY = {
  low:    { scale: 0.5, shadows: false, trail: false, grass: false, glow: false },
  medium: { scale: 1,   shadows: true,  trail: true,  grass: false, glow: false },
  high:   { scale: Math.max(1.5, devicePixelRatio || 1), shadows: true, trail: true, grass: true, glow: true },
};
const settings = { quality: 'medium', fps: 60, showFps: false, sound: true };
try { Object.assign(settings, JSON.parse(localStorage.getItem('rpgSettings')) || {}); } catch {}
let gfx;

function applySettings() {
  gfx = QUALITY[settings.quality];
  canvas.width = Math.round(W * gfx.scale);
  canvas.height = Math.round(H * gfx.scale);
  ctx.imageSmoothingEnabled = settings.quality !== 'low';
  canvas.classList.toggle('pixel', settings.quality === 'low');
  document.querySelectorAll('.opts').forEach(g => g.querySelectorAll('button').forEach(b =>
    b.classList.toggle('on', b.dataset.v === String(settings[g.dataset.set]))));
  try { localStorage.setItem('rpgSettings', JSON.stringify(settings)); } catch {}
}

document.querySelectorAll('.opts').forEach(g => g.addEventListener('click', e => {
  const v = e.target.dataset.v;
  if (v === undefined) return;
  const k = g.dataset.set;
  settings[k] = k === 'fps' ? +v : (k === 'showFps' || k === 'sound') ? v === 'true' : v;
  applySettings();
}));

// --- Sound effects (Web Audio synth, no files needed) ---
let actx = null;
function audio() {
  if (!actx) try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function tone(freq, dur, type = 'square', vol = 0.15, slideTo = null, delay = 0) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur);
}
function noise(dur, vol = 0.2, filter = 1500, delay = 0) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = buf; f.type = 'lowpass'; f.frequency.value = filter;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}
const SFX = {
  swing:   () => noise(0.12, 0.12, 3000),
  hit:     () => { tone(220, 0.1, 'square', 0.12, 90); noise(0.08, 0.15, 900); },
  kill:    () => { tone(400, 0.15, 'triangle', 0.15, 80); },
  hurt:    () => { tone(160, 0.25, 'sawtooth', 0.18, 60); },
  flip:    () => tone(300, 0.2, 'sine', 0.12, 900),
  tired:   () => tone(120, 0.1, 'square', 0.08),
  pickup:  () => { tone(700, 0.08, 'square', 0.1); tone(1050, 0.12, 'square', 0.1, null, 0.07); },
  potion:  () => { tone(500, 0.3, 'sine', 0.15, 1000); },
  levelup: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'square', 0.12, null, i * 0.09)),
  unlock:  () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.15, 'triangle', 0.14, null, i * 0.08)),
  wave:    () => { tone(330, 0.15, 'square', 0.1); tone(440, 0.2, 'square', 0.1, null, 0.15); },
  roar:    () => { tone(90, 1.0, 'sawtooth', 0.25, 40); noise(0.9, 0.2, 400); },
  slam:    () => { tone(70, 0.5, 'sine', 0.35, 30); noise(0.4, 0.3, 300); },
  arrow:   () => tone(900, 0.1, 'triangle', 0.08, 400),
  squish:  () => tone(180, 0.15, 'sine', 0.15, 500),
  charge:  () => tone(140, 0.3, 'sawtooth', 0.1, 260),
  victory: () => [523, 659, 784, 659, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.15, null, i * 0.12)),
  death:   () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'triangle', 0.16, null, i * 0.2)),
  click:   () => tone(600, 0.05, 'square', 0.08),
};
function sfx(name) { if (settings.sound) SFX[name](); }

// --- Menus ---
const menuEl = document.getElementById('menu'), settingsEl = document.getElementById('settings'),
      levelEl = document.getElementById('level');
let paused = false, openMenu = null;
function showMenu(which) {           // null | 'menu' | 'settings' | 'level'
  openMenu = which;
  paused = which !== null;
  menuEl.classList.toggle('show', which === 'menu');
  settingsEl.classList.toggle('show', which === 'settings');
  levelEl.classList.toggle('show', which === 'level');
  for (const k in keys) keys[k] = false;
  if (which === 'level') renderLevelMenu();
  if (which) document.querySelector(`#${which} button`)?.focus();
  else canvas.focus();
}
document.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
  const a = b.dataset.act;
  if (a === 'resume' || a === 'close') showMenu(null);
  if (a === 'settings') showMenu('settings');
  if (a === 'level') showMenu('level');
  if (a === 'back') showMenu('menu');
  if (a === 'restart') { reset(); showMenu(null); }
}));

function renderLevelMenu() {
  document.getElementById('lvNum').textContent = hero.level;
  document.getElementById('lvPts').textContent = hero.points;
  document.getElementById('lvStats').innerHTML = STATS.map(s => `
    <div class="stat"><div><b>${s.name}</b>: ${hero.stats[s.k]}${s.max ? ` / ${s.max}` : ''}<small>${s.desc}</small></div>
    <button data-stat="${s.k}" ${hero.points < 1 || (s.max && hero.stats[s.k] >= s.max) ? 'disabled' : ''}>+</button></div>`).join('') +
    `<div class="hint">Damage ${swordDmg()} · Max stamina ${maxStamina()} · Flip cooldown ${flipCooldown().toFixed(2)}s</div>`;
  document.getElementById('lvSwords').innerHTML = SWORDS.map(s => {
    const locked = hero.level < s.lvl, on = hero.sword === s;
    const fx = [s.burn && 'burn', s.slow && 'slow'].filter(Boolean).join(', ');
    return `<div class="sword ${on ? 'on' : ''}"><div><b style="color:${s.color}">${s.name}</b>
      <small>${locked ? `Unlocks at Lv ${s.lvl}` : `Dmg ${s.dmg} · Rng ${s.range} · Spd ${s.time}s${fx ? ' · ' + fx : ''}`}</small></div>
      <button data-sword="${s.id}" ${locked || on ? 'disabled' : ''}>${on ? '✓' : locked ? '🔒' : 'Equip'}</button></div>`;
  }).join('');
}
levelEl.addEventListener('click', e => {
  const st = e.target.dataset.stat, sw = e.target.dataset.sword;
  if (st && hero.points > 0) {
    hero.points--; hero.stats[st]++;
    if (st === 'hp') { hero.maxHp += 20; hero.hp += 20; }
    sfx('click'); renderLevelMenu();
  }
  if (sw) { hero.sword = SWORDS.find(s => s.id === sw); sfx('pickup'); renderLevelMenu(); }
});

const keys = {};
addEventListener('keydown', e => {
  audio();   // browsers only allow audio after a user gesture
  if (e.code === 'Escape') {
    showMenu(openMenu === 'settings' ? 'menu' : paused ? null : 'menu');
    return;
  }
  if (e.code === 'KeyL' && !e.repeat && hero && !hero.dead && (openMenu === null || openMenu === 'level')) {
    showMenu(openMenu === 'level' ? null : 'level');
    return;
  }
  if (paused) return;
  keys[e.code] = true;
  if (e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Tab') e.preventDefault();
  if (e.repeat) return;
  if (hero.dead) { if (e.code === 'KeyR') reset(); return; }
  if (e.code === 'Space') startAttack();
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') startFlip();
});
addEventListener('keyup', e => { keys[e.code] = false; });

let seed = 7;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const trees = Array.from({ length: 14 }, () => ({ x: rand() * W, y: 60 + rand() * (H - 60), r: 18 + rand() * 14 }));

let hero, enemies, wave, waveTimer, spawnQueue, spawnTimer, popups, drops, projectiles, shockwaves, boss;

function reset() {
  hero = {
    name: 'Hero', level: 1, hp: 100, maxHp: 100, xp: 0, xpNext: 50,
    stamina: 100, points: 0, stats: { hp: 0, str: 0, sta: 0, cd: 0 }, sword: SWORDS[0],
    x: W / 2, y: H / 2, speed: 180, facing: 1, walkT: 0, moving: false,
    attackT: 0, attackDur: 0.3, hitSet: null,
    flipT: 0, flipCd: 0, flipDx: 1, flipDy: 0,
    hurtT: 0, dead: false,
  };
  enemies = []; popups = []; drops = []; projectiles = []; shockwaves = [];
  boss = null;
  wave = 0; waveTimer = 2; spawnQueue = []; spawnTimer = 0;
}

const swordDmg = () => hero.sword.dmg + hero.stats.str * 5;
const maxStamina = () => 100 + hero.stats.sta * 15;
const staminaRegen = () => 28 + hero.stats.sta * 5;
const cdMult = () => 1 - hero.stats.cd * 0.06;
const flipCooldown = () => FLIP_COOLDOWN * cdMult();

function startAttack() {
  if (hero.attackT > 0 || hero.flipT > 0) return;
  if (hero.stamina < ATTACK_COST) { sfx('tired'); return; }
  hero.stamina -= ATTACK_COST;
  hero.attackDur = hero.sword.time * (1 - hero.stats.cd * 0.04);
  hero.attackT = hero.attackDur;
  hero.hitSet = new Set();
  sfx('swing');
}

function startFlip() {
  if (hero.flipT > 0 || hero.flipCd > 0) return;
  if (hero.stamina < FLIP_COST) { sfx('tired'); popups.push({ text: 'No stamina', x: hero.x, y: hero.y - 75, t: 0.6, color: '#7c7' }); return; }
  hero.stamina -= FLIP_COST;
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
  sfx('flip');
}

const invulnerable = () => hero.flipT > 0 || hero.hurtT > 0;

function damageHero(dmg, sound = true) {
  if (hero.dead || invulnerable()) return;
  hero.hp = Math.max(0, hero.hp - dmg);
  hero.hurtT = 0.8;
  popups.push({ text: `-${dmg}`, x: hero.x, y: hero.y - 70, t: 0.8, color: '#f55' });
  if (sound) sfx('hurt');
  if (hero.hp === 0) { hero.dead = true; sfx('death'); }
}

// --- Monsters ---
// r: body radius for collision; xp: reward; each type has its own AI in updateEnemies.
const TYPES = {
  goblin:   { hp: 30, speed: 110, r: 12, dmg: 8,  xp: 12, from: 1 },
  minotaur: { hp: 60, speed: 60,  r: 18, dmg: 10, xp: 22, from: 1 },
  slime:    { hp: 45, speed: 0,   r: 16, dmg: 8,  xp: 15, from: 2 },
  archer:   { hp: 35, speed: 70,  r: 12, dmg: 12, xp: 20, from: 3 },
  ogre:     { hp: 160, speed: 40, r: 24, dmg: 20, xp: 45, from: 6 },
};

function edgePos() {
  const side = Math.floor(Math.random() * 4);
  return {
    x: side === 0 ? -30 : side === 1 ? W + 30 : Math.random() * W,
    y: side === 2 ? 40 : side === 3 ? H + 30 : 60 + Math.random() * (H - 60),
  };
}

function spawnEnemy(type, pos = edgePos(), extra = {}) {
  const T = TYPES[type];
  const hp = Math.round(T.hp * (1 + wave * 0.15));
  enemies.push({
    type, x: pos.x, y: pos.y, hp, maxHp: hp, r: T.r, dmg: T.dmg + Math.floor(wave / 2), xp: T.xp + wave * 3,
    speed: T.speed * (0.85 + Math.random() * 0.3) + wave * 2,
    facing: 1, walkT: Math.random() * 6, state: 'walk', stateT: Math.random(),
    chargeDx: 0, chargeDy: 0, knockX: 0, knockY: 0, flashT: 0, burnT: 0, slowT: 0, hopZ: 0, size: 1,
    ...extra,
  });
}

function spawnBoss() {
  const hp = 700 + wave * 120;
  boss = {
    type: 'boss', name: wave % 10 === 0 ? 'Minotaur Emperor' : 'Minotaur King',
    x: W / 2, y: -40, hp, maxHp: hp, r: 34, dmg: 20 + wave, xp: 150 + wave * 20,
    speed: 70 + wave, facing: 1, walkT: 0, state: 'walk', stateT: 1.5, charges: 0, summoned: false,
    chargeDx: 0, chargeDy: 0, knockX: 0, knockY: 0, flashT: 0, burnT: 0, slowT: 0,
  };
  enemies.push(boss);
  sfx('roar');
  popups.push({ text: `⚠ BOSS: ${boss.name} ⚠`, x: W / 2, y: 140, t: 2.5, big: true, color: '#f66' });
}

function buildWave() {
  const pool = Object.keys(TYPES).filter(t => wave >= TYPES[t].from);
  const n = 2 + Math.floor(Math.random() * (2 + wave));
  return Array.from({ length: n }, () => pool[Math.floor(Math.random() * pool.length)]);
}

function updateWaves(dt) {
  if (spawnQueue.length > 0) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      const t = spawnQueue.shift();
      t === 'boss' ? spawnBoss() : spawnEnemy(t);
      spawnTimer = 0.3 + Math.random() * 1.3;
    }
  } else if (enemies.length === 0) {
    waveTimer -= dt;
    if (waveTimer <= 0) {
      wave++;
      if (wave % 5 === 0) {
        spawnQueue = ['boss', ...Array(Math.floor(wave / 5)).fill('goblin')];
        popups.push({ text: `Wave ${wave}: BOSS WAVE!`, x: W / 2, y: 110, t: 2, big: true, color: '#f66' });
      } else {
        spawnQueue = buildWave();
        popups.push({ text: `Wave ${wave}: ${spawnQueue.length} monsters!`, x: W / 2, y: 110, t: 2, big: true });
        sfx('wave');
      }
      spawnTimer = 0.5;
      waveTimer = 3;
    }
  }
}

function updateBoss(m, dt, dx, dy, dist, spd) {
  if (!m.summoned && m.hp < m.maxHp / 2) {         // phase 2: call minions + enrage
    m.summoned = true; m.speed *= 1.3;
    for (let i = 0; i < 3; i++) spawnEnemy(i ? 'goblin' : 'minotaur');
    sfx('roar');
    popups.push({ text: `${m.name} is enraged!`, x: W / 2, y: 140, t: 2, big: true, color: '#f66' });
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
    if (m.stateT <= 0) {
      if (--m.charges > 0) { m.state = 'windup'; m.stateT = 0.35; }
      else { m.state = 'walk'; m.stateT = 1.5 + Math.random(); }
    }
  } else if (m.state === 'slamWind') {
    if (m.stateT <= 0) {
      shockwaves.push({ x: m.x, y: m.y, r: 10, maxR: m.summoned ? 320 : 240, hit: false, dmg: m.dmg });
      sfx('slam');
      m.state = 'walk'; m.stateT = 1.8 + Math.random();
    }
  }
  m.x = Math.max(-20, Math.min(W + 20, m.x)); m.y = Math.max(60, Math.min(H + 10, m.y));
}

function updateEnemies(dt) {
  for (const m of enemies) {
    const dx = hero.x - m.x, dy = hero.y - m.y, dist = Math.hypot(dx, dy) || 1;
    m.flashT = Math.max(0, m.flashT - dt);
    m.slowT = Math.max(0, m.slowT - dt);
    if (m.burnT > 0) {
      m.burnT -= dt; m.burnTick = (m.burnTick || 0) - dt;
      if (m.burnTick <= 0) { m.burnTick = 0.5; m.hp -= 4; popups.push({ text: '4', x: m.x, y: m.y - 70, t: 0.4, color: '#f84' }); }
    }
    m.stateT -= dt;
    const spd = m.speed * (m.slowT > 0 ? 0.5 : 1);
    const slowMul = m.slowT > 0 ? 0.5 : 1;

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
          sfx('slam'); m.state = 'walk'; m.stateT = 1.5;
        }
      }
    } else if (m.type === 'goblin') {
      // zig-zag rush
      const wob = Math.sin(m.walkT * 0.6) * 0.6;
      m.x += (dx / dist - dy / dist * wob) * spd * dt;
      m.y += (dy / dist + dx / dist * wob) * spd * dt;
      m.facing = Math.sign(dx) || m.facing; m.walkT += dt * 12;
    } else if (m.type === 'slime') {
      // hop toward hero
      if (m.state === 'walk' && m.stateT <= 0) { m.state = 'hop'; m.stateT = 0.5; m.chargeDx = dx / dist; m.chargeDy = dy / dist; }
      if (m.state === 'hop') {
        const p = 1 - m.stateT / 0.5;
        m.hopZ = Math.sin(p * Math.PI) * 22;
        m.x += m.chargeDx * 150 * slowMul * dt; m.y += m.chargeDy * 150 * slowMul * dt;
        if (m.stateT <= 0) { m.state = 'walk'; m.stateT = 0.5 + Math.random() * 0.6; m.hopZ = 0; }
      }
      m.facing = Math.sign(dx) || m.facing;
    } else if (m.type === 'archer') {
      // keep distance, shoot arrows
      const want = 230, dir = dist > want + 30 ? 1 : dist < want - 30 ? -1 : 0;
      m.x += (dx / dist) * spd * dir * dt; m.y += (dy / dist) * spd * dir * dt;
      m.x = Math.max(15, Math.min(W - 15, m.x)); m.y = Math.max(70, Math.min(H - 10, m.y));
      m.facing = Math.sign(dx) || m.facing;
      if (dir) m.walkT += dt * 8;
      if (m.state === 'walk' && m.stateT <= 0 && !hero.dead && m.x > 0 && m.x < W) { m.state = 'aim'; m.stateT = 0.7; }
      if (m.state === 'aim' && m.stateT <= 0) {
        const sp = 300;
        projectiles.push({ x: m.x, y: m.y - 40, vx: dx / dist * sp, vy: dy / dist * sp, t: 3, dmg: m.dmg });
        sfx('arrow');
        m.state = 'walk'; m.stateT = 1.6 + Math.random();
      }
    }

    m.x += m.knockX * dt; m.y += m.knockY * dt;
    m.knockX *= 0.85; m.knockY *= 0.85;

    // contact damage
    if (!hero.dead && dist < m.r + 12 && (m.hopZ || 0) < 10) {
      damageHero(m.state === 'charge' ? m.dmg * 2 + 5 : m.dmg);
    }
  }

  // sword hits (active in the middle of the swing)
  const sw = hero.sword;
  if (hero.attackT > 0 && hero.attackT < hero.attackDur * 0.7) {
    for (const m of enemies) {
      if (hero.hitSet.has(m)) continue;
      const dx = m.x - hero.x, dy = m.y - hero.y;
      if (Math.hypot(dx, dy) < sw.range + m.r * 0.6 && Math.sign(dx) !== -hero.facing) {
        hero.hitSet.add(m);
        const crit = Math.random() < 0.1, dmg = Math.round(swordDmg() * (crit ? 2 : 1));
        m.hp -= dmg;
        m.flashT = 0.15;
        m.knockX = hero.facing * (m.type === 'boss' ? 120 : m.type === 'ogre' ? 200 : 500);
        if (sw.burn) m.burnT = 3;
        if (sw.slow) m.slowT = 2.5;
        if (m.state === 'windup' && m.type !== 'boss') { m.state = 'walk'; m.stateT = 0.8; } // interrupt
        popups.push({ text: crit ? `${dmg}!` : `${dmg}`, x: m.x, y: m.y - 80, t: 0.6, color: crit ? '#f80' : '#ff0' });
        sfx(m.type === 'slime' ? 'squish' : 'hit');
      }
    }
  }

  const dead = enemies.filter(m => m.hp <= 0);
  enemies = enemies.filter(m => m.hp > 0);
  for (const m of dead) onKill(m);
}

function onKill(m) {
  if (m.type === 'slime' && m.size === 1) {        // big slimes split
    for (const s of [-1, 1]) spawnEnemy('slime', { x: m.x + s * 15, y: m.y }, { size: 0.6, r: 10, hp: 18, maxHp: 18, xp: 5 });
  }
  if (m.type === 'boss') {
    boss = null;
    sfx('victory');
    popups.push({ text: 'BOSS DEFEATED!', x: W / 2, y: 140, t: 2.5, big: true, color: '#fd4' });
    for (let i = 0; i < 3; i++) dropItem('star', m.x + (i - 1) * 30, m.y);
    dropItem('potion', m.x, m.y + 25);
    dropItem('big', m.x, m.y - 25);
    shockwaves = [];
  } else {
    sfx('kill');
    const r = Math.random();
    if (r < 0.03) dropItem('star', m.x, m.y);
    else if (r < 0.2) dropItem('potion', m.x, m.y);
    else if (r < 0.35) dropItem('energy', m.x, m.y);
    else if (r < 0.45) dropItem('gem', m.x, m.y);
  }
  gainXp(m.xp, m);
}

// --- Drops ---
const DROPS = {
  potion: { color: '#e33', label: 'Potion' },
  energy: { color: '#5d5', label: 'Energy' },
  gem:    { color: '#8cf', label: 'XP Gem' },
  star:   { color: '#fd4', label: '+1 Stat Point' },
  big:    { color: '#f6c', label: 'Mega Potion' },
};
function dropItem(kind, x, y) {
  drops.push({ kind, x: Math.max(20, Math.min(W - 20, x)), y: Math.max(80, Math.min(H - 15, y)), t: 15, bob: Math.random() * 6 });
}
function updateDrops(dt) {
  for (const d of drops) {
    d.t -= dt; d.bob += dt * 4;
    if (hero.dead || Math.hypot(hero.x - d.x, hero.y - 10 - d.y) > 28) continue;
    d.t = 0;
    const lbl = DROPS[d.kind].label;
    if (d.kind === 'potion') { const h = Math.round(hero.maxHp * 0.3); hero.hp = Math.min(hero.maxHp, hero.hp + h); sfx('potion'); popups.push({ text: `+${h} HP`, x: d.x, y: d.y - 30, t: 1, color: '#f77' }); }
    if (d.kind === 'big') { hero.hp = hero.maxHp; hero.stamina = maxStamina(); sfx('potion'); popups.push({ text: 'Fully healed!', x: d.x, y: d.y - 30, t: 1, color: '#f6c' }); }
    if (d.kind === 'energy') { hero.stamina = maxStamina(); sfx('pickup'); popups.push({ text: 'Stamina!', x: d.x, y: d.y - 30, t: 1, color: '#5d5' }); }
    if (d.kind === 'gem') { sfx('pickup'); gainXp(15 + wave * 4, d); }
    if (d.kind === 'star') { hero.points++; sfx('unlock'); popups.push({ text: lbl, x: d.x, y: d.y - 30, t: 1.2, color: '#fd4' }); }
  }
  drops = drops.filter(d => d.t > 0);
}

function updateProjectiles(dt) {
  for (const p of projectiles) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.t -= dt;
    if (Math.hypot(p.x - hero.x, p.y - (hero.y - 35)) < 18 && !invulnerable() && !hero.dead) { damageHero(p.dmg); p.t = 0; }
    // swing deflects arrows
    if (hero.attackT > 0 && Math.hypot(p.x - hero.x, p.y - hero.y + 35) < hero.sword.range) { p.t = 0; sfx('click'); }
  }
  projectiles = projectiles.filter(p => p.t > 0 && p.x > -50 && p.x < W + 50 && p.y > -50 && p.y < H + 50);

  for (const s of shockwaves) {
    s.r += 260 * dt;
    const d = Math.hypot(hero.x - s.x, (hero.y - s.y) * 1.6);
    if (!s.hit && Math.abs(d - s.r) < 16 && !invulnerable() && !hero.dead) { s.hit = true; damageHero(s.dmg); }
  }
  shockwaves = shockwaves.filter(s => s.r < s.maxR);
}

function gainXp(n, m) {
  hero.xp += n;
  popups.push({ text: `+${n} XP`, x: m.x, y: m.y - 60, t: 1, color: '#8cf' });
  while (hero.xp >= hero.xpNext) {
    hero.xp -= hero.xpNext;
    hero.level++;
    hero.xpNext = Math.round(hero.xpNext * 1.4);
    hero.points += POINTS_PER_LEVEL;
    hero.hp = hero.maxHp;
    hero.stamina = maxStamina();
    popups.push({ text: `LEVEL UP! +${POINTS_PER_LEVEL} points (L)`, x: hero.x, y: hero.y - 90, t: 1.8, color: '#fd4', big: true });
    sfx('levelup');
    const sw = SWORDS.find(s => s.lvl === hero.level);
    if (sw) {
      popups.push({ text: `New sword: ${sw.name}!`, x: W / 2, y: 170, t: 2.5, color: sw.color, big: true });
      setTimeout(() => sfx('unlock'), 450);
    }
  }
}

function updateHero(dt) {
  if (hero.dead) return;
  hero.flipCd = Math.max(0, hero.flipCd - dt);
  hero.hurtT = Math.max(0, hero.hurtT - dt);
  if (hero.attackT > 0) hero.attackT -= dt;
  if (hero.flipT <= 0 && hero.attackT <= 0) hero.stamina = Math.min(maxStamina(), hero.stamina + staminaRegen() * dt);

  if (hero.flipT > 0) {
    hero.flipT -= dt;
    hero.x += hero.flipDx * FLIP_SPEED * dt;
    hero.y += hero.flipDy * FLIP_SPEED * dt;
    if (hero.flipDx) hero.facing = Math.sign(hero.flipDx);
  } else {
    let dx = 0, dy = 0;
    if (keys.KeyA || keys.ArrowLeft) dx--;
    if (keys.KeyD || keys.ArrowRight) dx++;
    if (keys.KeyW || keys.ArrowUp) dy--;
    if (keys.KeyS || keys.ArrowDown) dy++;
    hero.moving = dx || dy;
    if (hero.moving) {
      const len = Math.hypot(dx, dy);
      hero.x += (dx / len) * hero.speed * dt;
      hero.y += (dy / len) * hero.speed * dt;
      if (dx) hero.facing = Math.sign(dx);
      hero.walkT += dt * 10;
    } else hero.walkT = 0;
  }
  hero.x = Math.max(20, Math.min(W - 20, hero.x));
  hero.y = Math.max(70, Math.min(H - 10, hero.y));
}

function update(dt) {
  updateHero(dt);
  updateWaves(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updateDrops(dt);
  for (const p of popups) { p.t -= dt; if (!p.big) p.y -= 30 * dt; }
  popups = popups.filter(p => p.t > 0);
}

// --- Drawing ---
function line(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }

function drawShadow(x, y, rx) {
  if (!gfx.shadows) return;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(x, y, rx, rx * 0.3, 0, 0, Math.PI * 2); ctx.fill();
}

function drawStickman(h) {
  const { x, y, facing: f } = h;
  const sw = h.sword;
  drawShadow(x, y, 14);

  ctx.save();
  if (h.flipT > 0) {
    // somersault: rotate around body center, hop up
    const p = 1 - h.flipT / FLIP_TIME;
    ctx.translate(x, y - 30 - Math.sin(p * Math.PI) * 25);
    ctx.rotate(f * p * Math.PI * 2);
    ctx.translate(-x, -(y - 30));
    ctx.globalAlpha = 0.6;                         // i-frame visual
    if (gfx.glow) { ctx.shadowColor = '#9cf'; ctx.shadowBlur = 16; }
  } else if (h.hurtT > 0 && Math.floor(h.hurtT * 20) % 2) {
    ctx.globalAlpha = 0.3;                         // blink while invulnerable
  }

  const swing = Math.sin(h.walkT) * 0.6;
  const bob = h.moving ? Math.abs(Math.sin(h.walkT)) * 2 : 0;
  const hipY = y - 22 - bob, neckY = y - 48 - bob, headY = y - 58 - bob;

  ctx.strokeStyle = h.dead ? '#555' : '#111'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  line(x, hipY, x + Math.sin(swing) * 14, y);
  line(x, hipY, x - Math.sin(swing) * 14, y);
  line(x, hipY, x, neckY);
  line(x, neckY + 4, x - f * Math.sin(swing) * 12, neckY + 20);

  const atk = h.attackT > 0 ? 1 - h.attackT / h.attackDur : 0;
  const armAng = h.attackT > 0 ? -1.4 + atk * 2.6 : 0.6 + swing * 0.5;
  const hx = x + f * Math.cos(armAng) * 16, hy = neckY + 4 + Math.sin(armAng) * 16;
  line(x, neckY + 4, hx, hy);
  // sword blade
  ctx.save();
  if (gfx.glow && (sw.burn || sw.slow)) { ctx.shadowColor = sw.color; ctx.shadowBlur = 12; }
  ctx.strokeStyle = sw.color; ctx.lineWidth = sw.id === 'great' ? 5 : 3;
  line(hx, hy, hx + f * Math.cos(armAng - 0.9) * sw.len, hy + Math.sin(armAng - 0.9) * sw.len);
  ctx.restore();

  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, headY, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(x + f * 4, headY - 2, 1.8, 0, Math.PI * 2); ctx.fill();

  // sword arc trail
  if (h.attackT > 0 && gfx.trail) {
    ctx.strokeStyle = sw.burn || sw.slow ? sw.color : 'rgba(255,255,255,0.5)';
    ctx.globalAlpha *= 0.6; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, neckY + 4, sw.len + 16, f > 0 ? -1.3 : Math.PI - 1.2, f > 0 ? -1.3 + atk * 2.5 : Math.PI + 1.3 - atk * 2.5, f < 0);
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
  ctx.fillStyle = '#300'; ctx.fillRect(m.x - 20, m.y - yOff, 40, 5);
  ctx.fillStyle = '#e33'; ctx.fillRect(m.x - 20, m.y - yOff, 40 * Math.max(0, m.hp) / m.maxHp, 5);
  if (m.burnT > 0) { ctx.fillStyle = '#f73'; ctx.fillRect(m.x + 22, m.y - yOff, 5, 5); }
}

function drawMinotaur(m, scale = 1, skin = '#6b3e26', crown = false) {
  const { x, y, facing: f } = m;
  drawShadow(x, y, 20 * scale);
  ctx.save();
  ctx.translate(x, y); ctx.scale(scale, scale); ctx.translate(-x, -y);
  const swing = Math.sin(m.walkT) * 0.5;
  let shake = 0;
  if (m.state === 'windup' || m.state === 'slamWind' || m.state === 'smashWind') shake = Math.sin(performance.now() / 20) * 2;
  const bx = x + shake;
  const lean = m.state === 'charge' ? f * 10 : 0;
  const lift = m.state === 'slamWind' || m.state === 'smashWind' ? -14 : 0;

  const body = statusTint(m, skin);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#4a2a18'; ctx.lineWidth = 6;
  line(bx, y - 26, bx + Math.sin(swing) * 12, y);
  line(bx, y - 26, bx - Math.sin(swing) * 12, y);
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(bx + lean * 0.5, y - 44, 16, 22, lean * 0.02, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = body; ctx.lineWidth = 6;
  line(bx + lean * 0.5 - 12, y - 56, bx - 20 - swing * 6, y - 34 + lift * 3);
  line(bx + lean * 0.5 + 12, y - 56, bx + 20 + swing * 6, y - 34 + lift * 3);
  const hx = bx + lean + f * 6, hy = y - 72;
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(hx, hy, 12, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c9a36b';
  ctx.beginPath(); ctx.ellipse(hx + f * 9, hy + 3, 6, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#eee'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(hx - 8, hy - 6); ctx.quadraticCurveTo(hx - 20, hy - 10, hx - 16, hy - 22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hx + 8, hy - 6); ctx.quadraticCurveTo(hx + 20, hy - 10, hx + 16, hy - 22); ctx.stroke();
  if (crown) {
    ctx.fillStyle = '#fd4';
    ctx.beginPath(); ctx.moveTo(hx - 9, hy - 9); ctx.lineTo(hx - 9, hy - 20); ctx.lineTo(hx - 4, hy - 14); ctx.lineTo(hx, hy - 22);
    ctx.lineTo(hx + 4, hy - 14); ctx.lineTo(hx + 9, hy - 20); ctx.lineTo(hx + 9, hy - 9); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = m.state !== 'walk' ? '#f00' : '#000';
  ctx.beginPath(); ctx.arc(hx + f * 3, hy - 3, 2.2, 0, Math.PI * 2); ctx.fill();
  if (m.state === 'windup' || m.state === 'slamWind' || m.state === 'smashWind') {
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
  const swing = Math.sin(m.walkT) * 0.7, c = statusTint(m, '#3d8b3d');
  ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.lineCap = 'round';
  line(x, y - 14, x + Math.sin(swing) * 9, y);
  line(x, y - 14, x - Math.sin(swing) * 9, y);
  line(x, y - 14, x, y - 30);
  line(x, y - 26, x + f * 10, y - 20 + swing * 4);
  ctx.strokeStyle = '#999'; line(x + f * 10, y - 20 + swing * 4, x + f * 18, y - 28 + swing * 4); // dagger
  ctx.fillStyle = c;
  ctx.beginPath(); ctx.arc(x, y - 37, 8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 6, y - 40); ctx.lineTo(x - 16, y - 46); ctx.lineTo(x - 5, y - 35); ctx.fill();   // ears
  ctx.beginPath(); ctx.moveTo(x + 6, y - 40); ctx.lineTo(x + 16, y - 46); ctx.lineTo(x + 5, y - 35); ctx.fill();
  ctx.fillStyle = '#ff0'; ctx.beginPath(); ctx.arc(x + f * 3, y - 38, 1.8, 0, Math.PI * 2); ctx.fill();
  drawHpBar(m, 58);
}

function drawSlime(m) {
  const { x, y } = m, s = m.size, z = m.hopZ || 0;
  drawShadow(x, y, 16 * s * (1 - z / 60));
  const squash = m.state === 'hop' ? 1 : 1 + Math.sin(performance.now() / 150) * 0.08;
  ctx.fillStyle = statusTint(m, '#5b5');
  ctx.globalAlpha = 0.85;
  ctx.beginPath(); ctx.ellipse(x, y - 12 * s - z, 18 * s * squash, 14 * s / squash, 0, Math.PI, 0); ctx.lineTo(x + 18 * s * squash, y - z); ctx.lineTo(x - 18 * s * squash, y - z); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#131';
  ctx.beginPath(); ctx.arc(x - 5 * s + m.facing * 3, y - 14 * s - z, 2.5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 5 * s + m.facing * 3, y - 14 * s - z, 2.5 * s, 0, Math.PI * 2); ctx.fill();
  drawHpBar(m, 36 * s + 10 + z);
}

function drawArcher(m) {
  const { x, y, facing: f } = m;
  drawShadow(x, y, 10);
  const swing = Math.sin(m.walkT) * 0.6, c = statusTint(m, '#ddd');
  ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.lineCap = 'round';
  line(x, y - 20, x + Math.sin(swing) * 10, y);
  line(x, y - 20, x - Math.sin(swing) * 10, y);
  line(x, y - 20, x, y - 44);
  for (let i = 0; i < 3; i++) line(x - 6, y - 40 + i * 6, x + 6, y - 40 + i * 6);   // ribs
  const aim = m.state === 'aim';
  line(x, y - 40, x + f * 16, y - 38);
  ctx.strokeStyle = '#8b5a2b'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x + f * 12, y - 38, 12, f > 0 ? -1.2 : Math.PI - 1.2 + 0, f > 0 ? 1.2 : Math.PI + 1.2); ctx.stroke();
  ctx.strokeStyle = '#eee'; ctx.lineWidth = 1;
  line(x + f * 12 + Math.cos(1.2) * 12 * f, y - 38 - Math.sin(1.2) * 12, x + f * (aim ? 2 : 12 + Math.cos(1.2) * 12), y - 38);
  line(x + f * (aim ? 2 : 12 + Math.cos(1.2) * 12), y - 38, x + f * 12 + Math.cos(1.2) * 12 * f, y - 38 + Math.sin(1.2) * 12);
  ctx.fillStyle = c;
  ctx.beginPath(); ctx.arc(x, y - 52, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = aim ? '#f33' : '#222';
  ctx.beginPath(); ctx.arc(x + f * 3, y - 53, 2, 0, Math.PI * 2); ctx.fill();
  drawHpBar(m, 72);
}

function drawEnemy(m) {
  if (m.type === 'boss') drawMinotaur(m, 2, m.summoned ? '#8b2a1e' : '#5a2e1a', true);
  else if (m.type === 'minotaur') { drawMinotaur(m); drawHpBar(m, 100); }
  else if (m.type === 'ogre') { drawMinotaur(m, 1.4, '#6a7a3a'); drawHpBar(m, 130); }
  else if (m.type === 'goblin') drawGoblin(m);
  else if (m.type === 'slime') drawSlime(m);
  else if (m.type === 'archer') drawArcher(m);
}

function drawDrop(d) {
  const { color } = DROPS[d.kind];
  if (d.t < 3 && Math.floor(d.t * 8) % 2) return;       // blink before despawning
  const y = d.y - 8 + Math.sin(d.bob) * 3;
  drawShadow(d.x, d.y, 7);
  if (gfx.glow) { ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 12; }
  ctx.fillStyle = color; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
  if (d.kind === 'potion' || d.kind === 'energy' || d.kind === 'big') {
    const s = d.kind === 'big' ? 1.4 : 1;
    ctx.beginPath(); ctx.arc(d.x, y, 7 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ccc'; ctx.fillRect(d.x - 2.5 * s, y - 12 * s, 5 * s, 6 * s);
  } else if (d.kind === 'gem') {
    ctx.beginPath(); ctx.moveTo(d.x, y - 9); ctx.lineTo(d.x + 7, y); ctx.lineTo(d.x, y + 9); ctx.lineTo(d.x - 7, y); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 4 : 10;
      ctx.lineTo(d.x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  if (gfx.glow) ctx.restore();
}

function drawTree(t) {
  ctx.fillStyle = '#5c3d1e'; ctx.fillRect(t.x - 4, t.y - 10, 8, 14);
  ctx.fillStyle = '#2d4a2f';
  ctx.beginPath(); ctx.arc(t.x, t.y - 10 - t.r * 0.8, t.r, 0, Math.PI * 2); ctx.fill();
  if (gfx.glow) {   // leaf highlight on high
    ctx.fillStyle = 'rgba(120,180,110,0.35)';
    ctx.beginPath(); ctx.arc(t.x - t.r * 0.35, t.y - 10 - t.r * 1.15, t.r * 0.45, 0, Math.PI * 2); ctx.fill();
  }
}

const grass = Array.from({ length: 220 }, () => ({ x: rand() * W, y: rand() * H, s: 3 + rand() * 4 }));
function drawGrass() {
  ctx.strokeStyle = '#4c7352'; ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (const g of grass) {
    ctx.moveTo(g.x, g.y); ctx.lineTo(g.x - 2, g.y - g.s);
    ctx.moveTo(g.x, g.y); ctx.lineTo(g.x + 2, g.y - g.s);
  }
  ctx.stroke();
}

function drawHUD() {
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(10, 10, 250, 104);
  ctx.fillStyle = '#fff'; ctx.font = '15px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(`${hero.name}  Lv ${hero.level}      Wave ${wave}`, 20, 30);
  ctx.fillStyle = '#400'; ctx.fillRect(20, 40, 230, 12);
  ctx.fillStyle = '#e33'; ctx.fillRect(20, 40, 230 * hero.hp / hero.maxHp, 12);
  ctx.fillStyle = '#031'; ctx.fillRect(20, 56, 230, 7);
  ctx.fillStyle = '#5d5'; ctx.fillRect(20, 56, 230 * hero.stamina / maxStamina(), 7);
  ctx.fillStyle = '#023'; ctx.fillRect(20, 67, 230, 5);
  ctx.fillStyle = '#8cf'; ctx.fillRect(20, 67, 230 * hero.xp / hero.xpNext, 5);
  ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif';
  ctx.fillText(`HP ${Math.ceil(hero.hp)}/${hero.maxHp}   ST ${Math.floor(hero.stamina)}   XP ${hero.xp}/${hero.xpNext}`, 20, 86);
  ctx.fillStyle = hero.sword.color;
  ctx.fillText(hero.sword.name, 20, 104);
  const ready = hero.flipCd <= 0;
  ctx.fillStyle = ready ? '#7f7' : '#777';
  ctx.fillText(ready ? 'FLIP READY' : 'flip...', 185, 104);
  if (hero.points > 0 && Math.floor(performance.now() / 500) % 2) {
    ctx.fillStyle = '#fd4'; ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`${hero.points} stat points — press L`, 20, 130);
  }

  if (boss) {
    const bw = 360, bx = W / 2 - bw / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx - 8, H - 44, bw + 16, 36);
    ctx.fillStyle = '#fdd'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(boss.name, W / 2, H - 28);
    ctx.fillStyle = '#300'; ctx.fillRect(bx, H - 22, bw, 9);
    ctx.fillStyle = boss.summoned ? '#f40' : '#c22'; ctx.fillRect(bx, H - 22, bw * Math.max(0, boss.hp) / boss.maxHp, 9);
  }
}

function draw() {
  ctx.setTransform(gfx.scale, 0, 0, gfx.scale, 0, 0);
  ctx.fillStyle = '#3a5a40'; ctx.fillRect(0, 0, W, H);
  if (gfx.grass) drawGrass();

  for (const s of shockwaves) {
    ctx.strokeStyle = `rgba(255,220,150,${1 - s.r / s.maxR})`; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r / 1.6, 0, 0, Math.PI * 2); ctx.stroke();
  }
  for (const d of drops) drawDrop(d);

  const things = [
    ...trees.map(t => ({ y: t.y, d: () => drawTree(t) })),
    ...enemies.map(m => ({ y: m.y, d: () => drawEnemy(m) })),
    { y: hero.y, d: () => drawStickman(hero) },
  ];
  things.sort((a, b) => a.y - b.y).forEach(o => o.d());

  ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2;
  for (const p of projectiles) {
    const a = Math.atan2(p.vy, p.vx);
    line(p.x, p.y, p.x - Math.cos(a) * 16, p.y - Math.sin(a) * 16);
  }

  for (const p of popups) {
    ctx.globalAlpha = Math.min(1, p.t * 2);
    ctx.fillStyle = p.color || '#fff'; ctx.textAlign = 'center';
    ctx.font = p.big ? 'bold 26px sans-serif' : 'bold 16px sans-serif';
    ctx.fillText(p.text, p.x, p.y);
    ctx.globalAlpha = 1;
  }
  drawHUD();

  if (hero.dead) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = 'bold 40px sans-serif'; ctx.fillText('YOU DIED', W / 2, H / 2);
    ctx.font = '18px sans-serif'; ctx.fillText(`Reached wave ${wave}, level ${hero.level} — press R to restart`, W / 2, H / 2 + 36);
  }
}

// FPS cap: skip rAF ticks until a frame's worth of time has passed.
let last = performance.now(), fpsShown = 0, fpsFrames = 0, fpsTime = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const frameMs = 1000 / settings.fps;
  const elapsed = now - last;
  if (elapsed < frameMs - 1) return;
  last = now - (elapsed % frameMs);
  const dt = Math.min(0.05, elapsed / 1000);

  if (!paused) update(dt);
  draw();

  fpsFrames++; fpsTime += elapsed;
  if (fpsTime >= 500) { fpsShown = Math.round(fpsFrames * 1000 / fpsTime); fpsFrames = 0; fpsTime = 0; }
  if (settings.showFps) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(W - 80, 10, 70, 24);
    ctx.fillStyle = '#7f7'; ctx.font = '14px monospace'; ctx.textAlign = 'right';
    ctx.fillText(`${fpsShown} FPS`, W - 16, 27);
  }
}
canvas.tabIndex = 0;
applySettings();
reset();
requestAnimationFrame(loop);
