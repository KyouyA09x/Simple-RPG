// Stick RPG: stickman hero, flip (Shift) with i-frames, minotaur waves.
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = 800, H = 560;   // logical size; backing resolution depends on quality

const FLIP_TIME = 0.4, FLIP_SPEED = 420, FLIP_COOLDOWN = 0.7;
const ATTACK_TIME = 0.3, ATTACK_RANGE = 55, ATTACK_DMG = 25;

// --- Settings ---
const QUALITY = {
  low:    { scale: 0.5, shadows: false, trail: false, grass: false, glow: false },
  medium: { scale: 1,   shadows: true,  trail: true,  grass: false, glow: false },
  high:   { scale: Math.max(1.5, devicePixelRatio || 1), shadows: true, trail: true, grass: true, glow: true },
};
const settings = { quality: 'medium', fps: 60, showFps: false };
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
  settings[k] = k === 'fps' ? +v : k === 'showFps' ? v === 'true' : v;
  applySettings();
}));

// --- Menu ---
const menuEl = document.getElementById('menu'), settingsEl = document.getElementById('settings');
let paused = false;
function showMenu(which) {           // null | 'menu' | 'settings'
  paused = which !== null;
  menuEl.classList.toggle('show', which === 'menu');
  settingsEl.classList.toggle('show', which === 'settings');
  for (const k in keys) keys[k] = false;
  if (which) document.querySelector(`#${which} button`).focus();
  else canvas.focus();
}
document.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
  const a = b.dataset.act;
  if (a === 'resume') showMenu(null);
  if (a === 'settings') showMenu('settings');
  if (a === 'back') showMenu('menu');
  if (a === 'restart') { reset(); showMenu(null); }
}));

const keys = {};
addEventListener('keydown', e => {
  if (e.code === 'Escape') {
    showMenu(settingsEl.classList.contains('show') ? 'menu' : paused ? null : 'menu');
    return;
  }
  if (paused) return;
  keys[e.code] = true;
  if (e.repeat) return;
  if (hero.dead) { if (e.code === 'KeyR') reset(); return; }
  if (e.code === 'Space') startAttack();
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') startFlip();
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; });

let seed = 7;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const trees = Array.from({ length: 14 }, () => ({ x: rand() * W, y: 60 + rand() * (H - 60), r: 18 + rand() * 14 }));

let hero, enemies, wave, waveTimer, spawnQueue, spawnTimer, popups;

function reset() {
  hero = {
    name: 'Hero', level: 1, hp: 100, maxHp: 100, xp: 0, xpNext: 50,
    x: W / 2, y: H / 2, speed: 180, facing: 1, walkT: 0, moving: false,
    attackT: 0, hitSet: null,
    flipT: 0, flipCd: 0, flipDx: 1, flipDy: 0,
    hurtT: 0, dead: false,
  };
  enemies = [];
  popups = [];
  wave = 0;
  waveTimer = 2;
  spawnQueue = 0;
  spawnTimer = 0;
}

function startAttack() {
  if (hero.attackT > 0 || hero.flipT > 0) return;
  hero.attackT = ATTACK_TIME;
  hero.hitSet = new Set();
}

function startFlip() {
  if (hero.flipT > 0 || hero.flipCd > 0) return;
  let dx = 0, dy = 0;
  if (keys.KeyA || keys.ArrowLeft) dx--;
  if (keys.KeyD || keys.ArrowRight) dx++;
  if (keys.KeyW || keys.ArrowUp) dy--;
  if (keys.KeyS || keys.ArrowDown) dy++;
  if (!dx && !dy) dx = hero.facing;
  const len = Math.hypot(dx, dy);
  hero.flipDx = dx / len; hero.flipDy = dy / len;
  hero.flipT = FLIP_TIME;
  hero.flipCd = FLIP_TIME + FLIP_COOLDOWN;
  hero.attackT = 0;
}

const invulnerable = () => hero.flipT > 0 || hero.hurtT > 0;

// --- Minotaurs ---
function spawnMinotaur() {
  const side = Math.floor(Math.random() * 4);
  const x = side === 0 ? -30 : side === 1 ? W + 30 : Math.random() * W;
  const y = side === 2 ? 30 : side === 3 ? H + 30 : 60 + Math.random() * (H - 60);
  const hp = 50 + wave * 10;
  enemies.push({
    x, y, hp, maxHp: hp, speed: 55 + Math.random() * 30 + wave * 4,
    facing: 1, walkT: Math.random() * 6, state: 'walk', stateT: 0,
    chargeDx: 0, chargeDy: 0, knockX: 0, knockY: 0, flashT: 0,
  });
}

function updateWaves(dt) {
  if (spawnQueue > 0) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnMinotaur();
      spawnQueue--;
      spawnTimer = 0.3 + Math.random() * 1.5;   // random gap between spawns
    }
  } else if (enemies.length === 0) {
    waveTimer -= dt;
    if (waveTimer <= 0) {
      wave++;
      spawnQueue = 1 + Math.floor(Math.random() * (2 + wave));  // random wave size
      popups.push({ text: `Wave ${wave}: ${spawnQueue} minotaur${spawnQueue > 1 ? 's' : ''}!`, x: W / 2, y: 110, t: 2, big: true });
      waveTimer = 3;
    }
  }
}

function updateEnemies(dt) {
  for (const m of enemies) {
    const dx = hero.x - m.x, dy = hero.y - m.y, dist = Math.hypot(dx, dy) || 1;
    m.flashT = Math.max(0, m.flashT - dt);
    m.stateT -= dt;

    if (m.state === 'walk') {
      m.x += (dx / dist) * m.speed * dt;
      m.y += (dy / dist) * m.speed * dt;
      m.facing = Math.sign(dx) || m.facing;
      m.walkT += dt * 7;
      if (dist < 170 && m.stateT <= 0 && !hero.dead) {
        m.state = 'windup'; m.stateT = 0.5;       // telegraph before charge
        m.chargeDx = dx / dist; m.chargeDy = dy / dist;
      }
    } else if (m.state === 'windup') {
      if (m.stateT <= 0) { m.state = 'charge'; m.stateT = 0.45; }
    } else if (m.state === 'charge') {
      m.x += m.chargeDx * 380 * dt;
      m.y += m.chargeDy * 380 * dt;
      m.walkT += dt * 18;
      if (m.stateT <= 0) { m.state = 'walk'; m.stateT = 1.2 + Math.random(); }
    }

    m.x += m.knockX * dt; m.y += m.knockY * dt;
    m.knockX *= 0.85; m.knockY *= 0.85;

    // contact damage
    if (!hero.dead && dist < 30 && !invulnerable()) {
      const dmg = m.state === 'charge' ? 25 : 10;
      hero.hp = Math.max(0, hero.hp - dmg);
      hero.hurtT = 0.8;
      popups.push({ text: `-${dmg}`, x: hero.x, y: hero.y - 70, t: 0.8, color: '#f55' });
      if (hero.hp === 0) hero.dead = true;
    }
  }

  // sword hits (active in the middle of the swing)
  if (hero.attackT > 0 && hero.attackT < ATTACK_TIME * 0.7) {
    for (const m of enemies) {
      if (hero.hitSet.has(m)) continue;
      const dx = m.x - hero.x, dy = m.y - hero.y;
      if (Math.hypot(dx, dy) < ATTACK_RANGE && Math.sign(dx) !== -hero.facing) {
        hero.hitSet.add(m);
        m.hp -= ATTACK_DMG;
        m.flashT = 0.15;
        m.knockX = hero.facing * 500;
        if (m.state === 'windup') { m.state = 'walk'; m.stateT = 0.8; } // interrupt
        popups.push({ text: `${ATTACK_DMG}`, x: m.x, y: m.y - 80, t: 0.6, color: '#ff0' });
      }
    }
  }

  for (const m of enemies) if (m.hp <= 0) gainXp(20 + wave * 5, m);
  enemies = enemies.filter(m => m.hp > 0);
}

function gainXp(n, m) {
  hero.xp += n;
  popups.push({ text: `+${n} XP`, x: m.x, y: m.y - 60, t: 1, color: '#8cf' });
  while (hero.xp >= hero.xpNext) {
    hero.xp -= hero.xpNext;
    hero.level++;
    hero.xpNext = Math.round(hero.xpNext * 1.5);
    hero.maxHp += 20;
    hero.hp = hero.maxHp;
    popups.push({ text: 'LEVEL UP!', x: hero.x, y: hero.y - 90, t: 1.5, color: '#fd4', big: true });
  }
}

function updateHero(dt) {
  if (hero.dead) return;
  hero.flipCd = Math.max(0, hero.flipCd - dt);
  hero.hurtT = Math.max(0, hero.hurtT - dt);
  if (hero.attackT > 0) hero.attackT -= dt;

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

  const atk = h.attackT > 0 ? 1 - h.attackT / ATTACK_TIME : 0;
  const armAng = h.attackT > 0 ? -1.4 + atk * 2.6 : 0.6 + swing * 0.5;
  const hx = x + f * Math.cos(armAng) * 16, hy = neckY + 4 + Math.sin(armAng) * 16;
  line(x, neckY + 4, hx, hy);
  ctx.strokeStyle = '#ddd';
  line(hx, hy, hx + f * Math.cos(armAng - 0.9) * 26, hy + Math.sin(armAng - 0.9) * 26);

  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111';
  ctx.beginPath(); ctx.arc(x, headY, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(x + f * 4, headY - 2, 1.8, 0, Math.PI * 2); ctx.fill();

  // sword arc trail
  if (h.attackT > 0 && gfx.trail) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, neckY + 4, 42, f > 0 ? -1.3 : Math.PI - 1.2 + (1 - atk) * 0, f > 0 ? -1.3 + atk * 2.5 : Math.PI + 1.3 - atk * 2.5, f < 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMinotaur(m) {
  const { x, y, facing: f } = m;
  drawShadow(x, y, 20);
  const swing = Math.sin(m.walkT) * 0.5;
  let shake = 0;
  if (m.state === 'windup') shake = Math.sin(performance.now() / 20) * 2;
  const bx = x + shake;
  const lean = m.state === 'charge' ? f * 10 : 0;

  const body = m.flashT > 0 ? '#fff' : '#6b3e26';
  ctx.lineCap = 'round';
  // legs
  ctx.strokeStyle = '#4a2a18'; ctx.lineWidth = 6;
  line(bx, y - 26, bx + Math.sin(swing) * 12, y);
  line(bx, y - 26, bx - Math.sin(swing) * 12, y);
  // torso
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(bx + lean * 0.5, y - 44, 16, 22, lean * 0.02, 0, Math.PI * 2); ctx.fill();
  // arms
  ctx.strokeStyle = body; ctx.lineWidth = 6;
  line(bx + lean * 0.5 - 12, y - 56, bx - 20 - swing * 6, y - 34);
  line(bx + lean * 0.5 + 12, y - 56, bx + 20 + swing * 6, y - 34);
  // head
  const hx = bx + lean + f * 6, hy = y - 72;
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(hx, hy, 12, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c9a36b';
  ctx.beginPath(); ctx.ellipse(hx + f * 9, hy + 3, 6, 5, 0, 0, Math.PI * 2); ctx.fill(); // snout
  // horns
  ctx.strokeStyle = '#eee'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(hx - 8, hy - 6); ctx.quadraticCurveTo(hx - 20, hy - 10, hx - 16, hy - 22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hx + 8, hy - 6); ctx.quadraticCurveTo(hx + 20, hy - 10, hx + 16, hy - 22); ctx.stroke();
  // eye (red when about to charge)
  ctx.fillStyle = m.state !== 'walk' ? '#f00' : '#000';
  ctx.beginPath(); ctx.arc(hx + f * 3, hy - 3, 2.2, 0, Math.PI * 2); ctx.fill();
  if (m.state === 'windup') {
    if (gfx.glow) {
      ctx.fillStyle = 'rgba(255,0,0,0.25)';
      ctx.beginPath(); ctx.arc(hx + f * 3, hy - 3, 8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#f33'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('!', hx, hy - 28);
  }
  // hp bar
  ctx.fillStyle = '#300'; ctx.fillRect(x - 20, y - 100, 40, 5);
  ctx.fillStyle = '#e33'; ctx.fillRect(x - 20, y - 100, 40 * m.hp / m.maxHp, 5);
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
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(10, 10, 240, 80);
  ctx.fillStyle = '#fff'; ctx.font = '15px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(`${hero.name}  Lv ${hero.level}      Wave ${wave}`, 20, 30);
  ctx.fillStyle = '#400'; ctx.fillRect(20, 40, 220, 12);
  ctx.fillStyle = '#e33'; ctx.fillRect(20, 40, 220 * hero.hp / hero.maxHp, 12);
  ctx.fillStyle = '#023'; ctx.fillRect(20, 56, 220, 6);
  ctx.fillStyle = '#8cf'; ctx.fillRect(20, 56, 220 * hero.xp / hero.xpNext, 6);
  ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif';
  ctx.fillText(`HP ${hero.hp}/${hero.maxHp}   XP ${hero.xp}/${hero.xpNext}`, 20, 76);
  // flip cooldown
  const ready = hero.flipCd <= 0;
  ctx.fillStyle = ready ? '#7f7' : '#777';
  ctx.fillText(ready ? 'FLIP READY' : 'flip...', 175, 76);
}

function draw() {
  ctx.setTransform(gfx.scale, 0, 0, gfx.scale, 0, 0);
  ctx.fillStyle = '#3a5a40'; ctx.fillRect(0, 0, W, H);
  if (gfx.grass) drawGrass();
  const things = [
    ...trees.map(t => ({ y: t.y, d: () => drawTree(t) })),
    ...enemies.map(m => ({ y: m.y, d: () => drawMinotaur(m) })),
    { y: hero.y, d: () => drawStickman(hero) },
  ];
  things.sort((a, b) => a.y - b.y).forEach(o => o.d());

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
