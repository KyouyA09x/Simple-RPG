// The prologue: a new game begins here, in a small village of its own, a scripted opening that is also the tutorial.
// The hero wakes with no memory, is taken in, learns the village's ways (and the controls) from the people there, and then the village burns.
// It runs inside the normal 'play' state (real movement, real sword, real monsters) with the waves switched off: PRO.on is the switch.
// Nothing is saved until it ends, it cannot be skipped, and it plays again on every new save.
const PRO = { on: false, scale: 1 };
const PRO_B = { x0: 150, y0: 230, x1: 2250, y1: 1400 };            // where the hero may walk (the map is drawn over the whole world)
let pro = null;

// ---------------------------------------------------------------- building the map
function proHouse(id, x, y, wall, seed, o = {}) {
  const r = mulberry(seed), pick = a => a[Math.floor(r() * a.length)];
  const kx = 1.15, ky = 1.25, w = 150 * kx, wh = 62 * ky, rh = 40 * ky;
  const PRE = [{ wood: '#a8773f', beam: '#4a2f18', roof: '#6b6a3a' }, { wood: '#e2d6b8', beam: '#5a3a22', roof: '#a8453a', plaster: true }, { wood: '#cfd9c8', beam: '#3f4a3a', roof: '#5a7a4a', plaster: true }, { wood: '#d7c4a0', beam: '#4a3220', roof: '#c9a24a', plaster: true }, { wood: '#6a4a32', beam: '#2a1a10', roof: '#6a3a3a' }, { wood: '#c9a560', beam: '#5a3a18', roof: '#8a4a2a' }];
  const b = { id, x, y, w, wh, rh, kx, ky, wall, trim: '#5b3f2a', roof: '#a4483a', flowers: true, ws: pick(['board', 'plaster', 'stone']), rs: pick(['hip', 'gable', 'thatch']), wst: Math.floor(r() * 2), shut: r() < 0.5, shutC: pick(['#3f6a4a', '#2f5a8a', '#8a3a30']), box: r() < 0.5, vine: r() < 0.3, chL: r() < 0.5, dsq: r() < 0.4, ...o };
  b.cottage = true; b.cv = { ...pick(PRE), rf: pick([0.8, 1, 1.25]), wing: r() < 0.6 ? 1 : 0, porch: pick(['open', 'open', 'closed']), win2: r() < 0.5, shut: r() < 0.5 ? pick(['#3f6a4a', '#2f5a8a', '#8a3a30']) : null, ridge: pick(['cap', 'vane', 'finials']), barrel: r() < 0.6, dx: 0.2, ex: ['pots', 'basket', 'fence', 'bench'].filter(() => r() < 0.45) };
  b.doorX = Math.round((b.chL ? 1 : -1) * w * 0.2);
  b.door = { x: x + b.doorX, y: y + 22 };
  b.chim = { x: x + (b.chL ? -1 : 1) * w * (b.cv.wing !== 0 ? 0.63 : 0.4), y: y - wh - rh * (b.cv.wing !== 0 ? 0.78 : 0.7) - 18 * ky };
  return b;
}

function proBakeGround() {
  const W = WW, H = WH, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), r = mulberry(4242), TAU2 = Math.PI * 2;
  g.fillStyle = '#5f9a4c'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 1800; i++) { const x = r() * W, y = r() * H, rr = 20 + r() * 60; g.fillStyle = r() < 0.5 ? 'rgba(120,180,90,0.10)' : 'rgba(40,90,40,0.10)'; g.beginPath(); g.ellipse(x, y, rr, rr * 0.6, 0, 0, TAU2); g.fill(); }
  const path = (pts, w0, col, a = 1) => { g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = w0; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); g.globalAlpha = 1; };
  for (const pts of PRO_PATHS) { path(pts, 62, '#6f8a45', 0.55); path(pts, 52, '#8a6f45'); path(pts, 44, '#a08358'); path(pts, 30, '#b19564', 0.7); }
  g.fillStyle = '#a08358'; g.beginPath(); g.ellipse(1200, 880, 110, 52, 0, 0, TAU2); g.fill(); g.fillStyle = '#b19564'; g.beginPath(); g.ellipse(1200, 880, 90, 40, 0, 0, TAU2); g.fill();
  for (let i = 0; i < 900; i++) { const p = PRO_PATHS[Math.floor(r() * PRO_PATHS.length)], k = Math.floor(r() * (p.length - 1)), t = r(), x = p[k][0] + (p[k + 1][0] - p[k][0]) * t + (r() - 0.5) * 36, y = p[k][1] + (p[k + 1][1] - p[k][1]) * t + (r() - 0.5) * 36; g.fillStyle = r() < 0.5 ? 'rgba(130,120,100,0.75)' : 'rgba(80,60,40,0.5)'; g.beginPath(); g.ellipse(x, y, 1.5 + r() * 2.5, 1 + r() * 1.5, 0, 0, TAU2); g.fill(); }
  for (let i = 0; i < 2600; i++) { const x = r() * W, y = r() * H; g.strokeStyle = r() < 0.5 ? '#79b45e' : '#3f7a3c'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - 4 - r() * 5); g.stroke(); }
  for (let i = 0; i < 260; i++) { const x = r() * W, y = r() * H; g.fillStyle = ['#f4e04d', '#fff', '#f28ab2', '#b99bff'][Math.floor(r() * 4)]; g.beginPath(); g.arc(x, y, 1.8, 0, TAU2); g.fill(); }
  const vg = g.createRadialGradient(W / 2, H * 0.55, 380, W / 2, H * 0.55, 1250); vg.addColorStop(0, 'rgba(10,40,10,0)'); vg.addColorStop(1, 'rgba(10,40,10,0.45)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  return cv;
}
const PRO_PATHS = [
  [[200, 1000], [520, 960], [820, 900], [1200, 880], [1600, 920], [1900, 1000], [2250, 980]],
  [[1200, 880], [1196, 780], [1000, 740]], [[1200, 880], [1230, 780], [1400, 700]], [[820, 900], [740, 800], [700, 720]],
  [[1600, 920], [1700, 1000], [1790, 1040]], [[820, 900], [830, 1030], [800, 1100]],
];

function proNpc(id, name, role, x, y, look, o = {}) {
  return { id, name, role, x, y, f: 1, scale: 1, speed: 52, r: 7, walkT: Math.random() * 6, pt: 0, pose: 'stand', moving: false, carry: null, alpha: 1, ph: Math.random() * 6.28, inside: false, bubble: null, bubbleT: 0, look, kid: false, talking: false, hx: x, hy: y, ...o };
}

function proInit() {
  const r = mulberry(77);
  const houses = [proHouse('maren', 1000, 700, '#d9c7a0', 11), proHouse('bram', 1400, 690, '#cdbd8c', 23), proHouse('sera', 700, 700, '#d3dbe2', 35), proHouse('barn', 800, 1120, '#c2baa6', 47, { flowers: false }), proHouse('mill', 1560, 1150, '#d9c7a0', 59, { flowers: false })];
  const solids = houses.map(b => ({ x0: b.x - b.w / 2, y0: b.y - 40, x1: b.x + b.w / 2, y1: b.y }));
  solids.push({ x: 1200, y: 855, r: 26 });                                       // the well
  const trees = [];
  const inside = (x, y) => x > 380 && x < 2020 && y > 440 && y < 1260;
  for (let i = 0, guard = 0; i < 190 && guard++ < 4000;) {
    const edge = r() < 0.72, x = 40 + r() * (WW - 80), y = 120 + r() * (WH - 150);
    if (inside(x, y)) continue; if (!edge && (x > 240 && x < 2160 && y > 300 && y < 1330)) continue;
    if (trees.some(t => Math.hypot(t.x - x, t.y - y) < 48)) continue;
    trees.push({ k: ['oak', 'oak', 'birch', 'bush'][Math.floor(r() * 4)], x, y, s: 0.85 + r() * 0.55, v: r(), ph: r() * 6.28 }); i++;
  }
  for (const [x, y] of [[560, 880], [1660, 860], [1960, 760], [300, 760], [2000, 1200], [520, 1230], [1100, 1240], [1500, 1260]]) trees.push({ k: r() < 0.5 ? 'oak' : 'birch', x, y, s: 0.9 + r() * 0.4, v: r(), ph: r() * 6.28 });
  const maren = proNpc('maren', 'Elder Maren', 'Village elder', 1000, 780, { body: '#7a4f8a', hair: '#e8e4ee', hat: 'shawl', cheek: true }, { f: -1 });
  const sera = proNpc('sera', 'Sera', 'Healer', 700, 780, { body: '#3f8a6a', apron: '#e6dcc4', hair: '#7a3a1a', cheek: true });
  const garrick = proNpc('garrick', 'Garrick', 'Village guard', 1810, 985, { body: '#4a6a8a', hat: 'smithcap', hatColor: '#6a7a8a', hair: '#5a3a1a', beard: '#5a3a1a' }, { f: -1 });
  const tomas = proNpc('tomas', 'Tomas', 'Farmer boy', 1300, 940, { body: '#b0803a', hat: 'cap', hatColor: '#6a4a2a', hair: '#c08a40', cheek: true }, { kid: true, scale: 0.78, speed: 40 });
  const orla = proNpc('orla', 'Granny Orla', 'Knitter', 1500, 780, { body: '#8a6a50', hair: '#f0f0f0', hat: 'shawl', cheek: true }, { pose: 'knit', f: -1 });
  const dorn = proNpc('dorn', 'Dorn', 'Baker', 1090, 922, { body: '#d9d2c0', apron: '#f4efe2', hat: 'cap', hatColor: '#f4efe2', hair: '#8a5a30', cheek: true }, { f: 1 });
  const hale = proNpc('hale', 'Hale', 'Carpenter', 980, 1000, { body: '#7a5a3a', apron: '#5a4a38', hat: 'cap', hatColor: '#6a4a2a', hair: '#4a3020', beard: '#4a3020' }, { f: 1 });
  solids.push({ x0: 1042, y0: 928, x1: 1138, y1: 948 }, { x0: 932, y0: 1008, x1: 1028, y1: 1028 });
  pro = {
    t: 0, step: 0, houses, solids, trees, npcs: [maren, sera, garrick, tomas, orla, dorn, hale], N: { maren, sera, garrick, tomas, orla, dorn, hale }, todT: 0.36, wake: null, cine: null, scarf: false, raiders: [], ground: proBakeGround(),
    talk: null, card: null, fade: 0, mark: null, hl: null, obj: '', objN: '', hint: null, moved: 0, lastX: 0, lastY: 0, carry: false, bucket: { x: 1240, y: 862, taken: true }, herbs: [{ x: 1990, y: 880, taken: false }, { x: 2070, y: 830, taken: false }, { x: 2040, y: 940, taken: false }], bear: null,
    dummy: { x: 1900, y: 1040, hits: 0, shake: 0 }, swinging: false, swT: 0, hitDone: false, flips: 0, flipPrev: 0, dodges: 0, fireT: 0, kills: 0, fx: [], dead: new Set(), potions0: 0,
  };
  PRO.scale = 1;
  hero.x = 1040; hero.y = 800; hero.facing = 1; hero.potions = 0; hero.gold = 0; hero.equip.weapon = { ...starterWeapon('wood'), name: 'Bare hands', base: 'fists' }; recalcGear(); hero.hp = hero.maxHp; hero.scarf.forEach(p => { p.x = hero.x; p.y = hero.y - 50; });
  pro.lastX = hero.x; pro.lastY = hero.y;
  cam.x = clampN(hero.x - VW / 2, 0, WW - VW); cam.y = clampN(hero.y - VH / 2, 0, WH - VH);
  tod = 0.36; dev.freezeTime = true; pro.prevFreeze = false; enemies.length = 0; popups.length = 0;
  
  proStep(0);
}

function proStart(name, diff, slot) {
  reset();
  tod = 0.36; dayCount = 1; loadBiome = 0;
  hero.name = (name || '').trim().slice(0, 14) || 'Hero';
  diffKey = diff; currentSlot = slot;
  PRO.on = true;
  startPlay();
  setWeather('clear', true);
  proInit();
}

function proFinish() {
  PRO.on = false; PRO.scale = 1; dev.freezeTime = false;
  const nm = hero.name, df = diffKey, sl = currentSlot; pro = null;
  newRun(nm, df, sl);
  popups.push({ text: 'Until the last shadow falls', x: VW / 2, y: 190, t: 3, big: true, screen: true, color: '#f88' });
}
function proAbort() { PRO.on = false; PRO.scale = 1; dev.freezeTime = false; pro = null; }

// ---------------------------------------------------------------- the story, one step at a time
const PRO_FISTS = { id: 'fists', kind: 'fist', cost: 3, name: 'Bare hands', bare: true, lvl: 1, dmg: 6, range: 40, time: 0.26, len: 0, color: '#e8dcc0', hitAt: 0.2 };      // the hero starts with no weapon at all
const proKeys = a => keyLabel(a);
const PRO_FOOD = [{ n: 'a loaf of bread', p: 4, d: 'Warm and crusty, fresh from the oven.' }, { n: 'a honey cake', p: 8, d: 'Sweet and sticky: a proper treat.' }, { n: 'a bag of apples', p: 2, d: 'Crisp apples from the orchard.' }];
const PRO_MATS = [{ n: 'a coil of rope', p: 6, to: 'garrick', d: 'Strong hemp rope. Good for tying up whatever the hunters bring home.' }, { n: 'a box of nails', p: 3, to: 'maren', d: 'Iron nails, a full box. Every loose shutter in the village could use some.' }, { n: 'an oak plank', p: 5, to: 'dorn', d: 'A sturdy plank of seasoned oak. Good for mending a roof.' }];
const PRO_STEPS = [
  { id: 'past', enter() { pro.todT = 0.36; proCineStart('cell'); } },
  { id: 'wake', enter() { Sound.music('pro_wake'); pro.todT = 0.36; proCard(['Three mornings later, a village downstream found a stranger in the reeds.', '...', 'You open your eyes.', 'You do not know where you are.', 'You do not even know your own name.'], () => proWakeStart()); } },
  { id: 'move', enter() { Sound.music('village'); Sound.setScene({ biome: 'village', night: false, wind: 0.03, rain: 0, pitch: 450 }); pro.obj = `Walk around: ${proKeys('up')} ${proKeys('left')} ${proKeys('down')} ${proKeys('right')}`; pro.hl = 'keys'; pro.moved = 0; pro.lastX = hero.x; pro.lastY = hero.y; },
    tick(dt) { pro.moved += Math.hypot(hero.x - pro.lastX, hero.y - pro.lastY); pro.lastX = hero.x; pro.lastY = hero.y; pro.objN = `${Math.min(100, Math.round(pro.moved / 3))}%`; if (pro.moved > 300) { proBubble(pro.N.maren, 'Over here, dear. Come and sit a moment.'); return true; } } },
  { id: 'maren', enter() { pro.obj = `Speak to Elder Maren (${proKeys('interact')})`; pro.hl = null; pro.mark = pro.N.maren; pro.objN = ''; } },
  { id: 'herbs', enter() { pro.obj = `Gather herbs at the forest edge (${proKeys('interact')})`; pro.objN = '0 / 3'; pro.mark = pro.herbs[0]; } },
  { id: 'bear', enter() { proBearStart(); } },
  { id: 'sera', enter() { pro.obj = `Bring the herbs to Sera, the healer (${proKeys('interact')})`; pro.objN = ''; pro.mark = pro.N.sera; } },
  { id: 'potion', enter() { pro.obj = `Drink the Healing Potion (${proKeys('potion')})`; pro.mark = null; pro.hl = 'vitals'; pro.potions0 = hero.potions | 0; },
    tick() { if ((hero.potions | 0) < pro.potions0) { hero.hp = hero.maxHp; popups.push({ text: 'Better!', x: hero.x, y: hero.y - 80, t: 1.2, color: '#7fd08a' }); return true; } } },
  { id: 'days', enter() { pro.obj = ''; pro.mark = null; pro.hl = null; pro.todT = 0.46; proCard(['More days passed.', "The days settled into a rhythm, and the village stopped feeling like a stranger's home."], () => { pro.bandaged = 1; pro.fade = 1; proNext(); }); } },
  { id: 'food', enter() { pro.todT = 0.46; pro.obj = `Buy something to eat at Dorn's stall (${proKeys('interact')})`; pro.mark = pro.N.dorn; pro.hl = 'gold'; } },
  { id: 'mats', enter() { pro.todT = 0.52; pro.obj = `Buy one thing the village needs at Hale's stall (${proKeys('interact')})`; pro.mark = pro.N.hale; pro.hl = 'gold'; proBubble(pro.N.garrick, 'I caught a boar, and nothing to tie it with!', 6); proBubble(pro.N.dorn, 'Half my stall roof is gone. I need wood!', 6); proBubble(pro.N.maren, 'My shutters keep banging. Nails, anyone?', 6); } },
  { id: 'deliver', enter() { const r = pro.N[pro.recip], what = { garrick: 'the rope to Garrick', maren: 'the nails to Elder Maren', dorn: 'the plank to Dorn' }[pro.recip]; pro.hl = null; pro.todT = 0.56; pro.obj = `Take ${what} (${proKeys('interact')})`; pro.mark = r; } },
  { id: 'garrick', enter() { pro.todT = 0.6; pro.obj = `Go and see Garrick at the training yard (${proKeys('interact')})`; pro.mark = pro.N.garrick; pro.hl = null; } },
  { id: 'sword', enter() { pro.obj = `Strike the dummy with your sword (${proKeys('attack')})`; pro.mark = pro.dummy; pro.hl = 'stamina'; pro.dummy.hits = 0; },
    tick() { pro.objN = `${pro.dummy.hits} / 5`; if (pro.dummy.hits >= 5) { sfx('unlock'); proBubble(pro.N.garrick, 'Good arm! Now, footwork.'); return true; } } },
  { id: 'flip', enter() { pro.obj = `Flip out of the way (${proKeys('flip')}) twice`; pro.mark = null; pro.flips = 0; pro.hl = 'flip'; },
    tick() { pro.objN = `${pro.flips} / 2`; if (pro.flips >= 2) { pro.hl = null; proBubble(pro.N.garrick, 'Remember that. It will keep you alive.'); return true; } } },
  { id: 'spar', enter() { pro.obj = `Spar with Garrick: strike him four times (${proKeys('attack')})`; pro.mark = pro.N.garrick; pro.hl = 'stamina'; const g = pro.N.garrick; pro.spar = { hits: 0, t: 0, ph: 'idle', pt: 0, hx: 1790, struck: false, dur: 1.6 }; g.x = 1790; g.y = 1035; g.hx = 1790; g.hy = 1035; g.pose = 'spar'; proBubble(g, 'No more straw men. Come and try me!', 3.6); },
    tick(dt) { return proSparTick(dt); } },
  { id: 'orla', enter() { pro.todT = 0.66; pro.obj = `Granny Orla has something for you (${proKeys('interact')})`; pro.mark = pro.N.orla; } },
  { id: 'tomas', enter() { pro.todT = 0.68; pro.objN = ''; pro.hl = null; pro.obj = `Help Tomas catch his frog, Sir Hops (${proKeys('interact')})`; pro.frog = { x: 1330, y: 975, hop: 0, vx: 0, vy: 0, rest: 0.5, caught: false }; pro.mark = pro.frog; } },
  { id: 'evening', enter() { pro.obj = ''; pro.mark = null; pro.todT = 0.72; proCard(['The evenings grew longer.', 'On the night of the harvest festival, the whole village gathered around the bonfire.'], () => proNext()); } },
  { id: 'camp', enter() { proCampStart(); },
    tick(dt) {
      const left = ['tomas', 'orla', 'dorn', 'hale', 'sera', 'garrick'].filter(id => !pro.talked.has(id));
      if (left.length) { pro.objN = `${6 - left.length} / 6`; pro.mark = left.map(id => pro.N[id]).sort((p, q) => Math.hypot(p.x - hero.x, p.y - hero.y) - Math.hypot(q.x - hero.x, q.y - hero.y))[0]; }
      else if (pro.sunT < 9) { pro.sunT += dt; const k = Math.min(1, pro.sunT / 9); tod = 0.72 + 0.055 * k * k * (3 - 2 * k); pro.obj = 'Sit by the fire and watch the sun set'; pro.objN = ''; pro.mark = null; }
      else { pro.obj = `Sit by the fire with Elder Maren (${proKeys('interact')})`; pro.objN = ''; pro.mark = pro.N.maren; }
    } },
  { id: 'night', enter() { pro.obj = ''; pro.mark = null; pro.hl = null; pro.todLock = false; pro.todT = 0.9; proCard(['The fire burned low, and the village slept.', 'Then the night turned red.'], () => { tod = 0.9; proNext(); }); } },
  { id: 'fire', enter() { for (const n of pro.npcs) { n.x = n.hx; n.y = n.hy; n.pose = 'stand'; n.moving = false; n.bubble = null; n.f = n.id === 'maren' ? -1 : 1; } pro.obj = 'Protect them!'; pro.objN = ''; pro.fireT = 0; pro.dodges = 0; tod = 0.9; Sound.music('pro_fire'); sfx('bell'); shake(6); proBubble(pro.N.tomas, 'FIRE! Monsters!'); }, tick: dt => proFireTick(dt) },
  { id: 'ash', enter() { Sound.music('pro_river'); pro.obj = ''; pro.mark = null; pro.hl = null; PRO.scale = 1; pro.hint = null; enemies.length = 0; pro.raiders = []; flash = 1; proCard(['It was over before you could understand it.', 'Everyone who had said your name was gone.'], () => proCard(['You remember Orla, stitching you a scarf as red as the sunrise.', 'You remember Dorn, pressing warm bread into your hands and waving away your coins.', 'You remember Tomas, teaching you to whistle, and introducing you to a frog.', 'You remember Sera, cleaning the wound on your head, and never asking what you had done.', 'You remember Garrick, swinging his old wooden sword at you every morning, and laughing every time you hit back.', 'You remember Maren, telling you that you could stay for as long as you liked.', 'It was the first kindness you had ever known.'], () => proCard(['The fire took what the monsters left.', 'You do not remember who you were. But you will remember this.', 'Every monster that walks the road.', 'And whatever sent them.'], () => proStep(PRO_I.road), { scroll: true }), { scenes: ['orla', 'dorn', 'tomas', 'sera', 'garrick', 'maren', 'maren'] }), { scroll: true }); } },
  { id: 'road', enter() { proCard(['You pick up what is left of a wooden sword.', 'Behind you, a village that no map will remember.', 'Ahead, a road with no end, and a vow heavier than any blade.', 'Walk on, until the last shadow falls.'], () => proFinish(), { scroll: true, last: true }); } },
];
const PRO_I = Object.fromEntries(PRO_STEPS.map((s, i) => [s.id, i]));
function proStep(i) { pro.step = i; const s = PRO_STEPS[i]; if (s && s.enter) s.enter(); }
function proNext() { proStep(pro.step + 1); }

function proCard(lines, done, o = {}) {
  if (o.scroll) {                                                                      // the words rise up the black screen together, so a long passage does not take long
    ctx.save(); let H = 0, lastOff = 0; lines.forEach((ln, i) => { const big = o.last && i === lines.length - 1; ctx.font = big ? 'bold 46px Georgia, serif' : 'italic 22px Georgia, serif'; if (i === lines.length - 1) lastOff = H; H += proWrap(ln, 700).length * (big ? 52 : 32) + 30; }); ctx.restore();
    const D = o.last ? 270 + 14 + lastOff : 540 + H + 60, move = D / 80;
    pro.card = { lines: [''], scroll: lines, H, lastOff, D, move, i: 0, t: 0, done, last: !!o.last, durs: [move + (o.last ? 3.4 : 0.6)] }; return;
  }
  pro.card = { lines, scenes: o.scenes || null, i: 0, t: 0, done, last: !!o.last, durs: lines.map(l => Math.min(11, 4.4 + l.length * 0.09)) };
}
function proBubble(n, text, t = 3.2) { n.bubble = text; n.bubbleT = t; n.talking = true; }
function proSay(n, lines, cb, opts) { pro.talk = { who: n.name, lines, i: 0, cb, opts: opts || null, sel: 0 }; for (const k in keys) keys[k] = false; hero.moving = false; n.f = hero.x >= n.x ? 1 : -1; hero.facing = n.x >= hero.x ? 1 : -1; sfx('menu'); }
const proGold = () => popups.push({ text: `${hero.gold} gold`, x: VW / 2, y: 150, t: 2, screen: true, small: true, color: '#ffd86a' });

// who says what
function proTalkTo(n) {
  const id = n.id, name = hero.name, st = PRO_STEPS[pro.step].id;
  if (id === 'maren' && st === 'maren') return proSay(n, [`You are awake. Good. We found you in the reeds by the river three mornings ago, cold as a stone, with a lump on the back of your head the size of an egg.`, `Do you remember anything? ...No? Not a coin, not a letter on you. But you muttered "${name}" in your fever. Is that your name?`, `Then ${name} it is. You are safe here. Nobody in Hollowbrook turns away someone in need.`, `Make yourself useful, and we will all get along. Sera needs herbs for her poultices: thyme, yarrow and a little feverfew. They grow at the forest edge, past the training yard.`, `Be careful, ${name}. The forest has teeth.`], () => { sfx('pickup'); proNext(); });
  if (id === 'sera' && st === 'sera') {
    return proSay(n, [`Oh, you found them all! Thank you, ${name}. ...Wait. You are bleeding!`, `Those are claw marks, and look at these bruises. What happened out there?`, `A bear? Barehanded? ...And you won? You are either very brave or very foolish. Sit down at once.`, `Here, drink this potion first. It will close the worst of it, and it cures what ails you, too. Then I will bandage the rest.`, `And here are twenty coins for the herbs, and for your trouble. Dorn's stall by the well sells good bread. Go and eat something: you will need your strength.`], () => { hero.potions = 1; hero.gold = 20; pro.bandaged = 2; sfx('pickup'); popups.push({ text: 'Got a Healing Potion and 20 gold', x: VW / 2, y: 150, t: 2.6, screen: true, small: true, color: '#ffd86a' }); proNext(); });
  }
  if (id === 'dorn' && st === 'food') return proSay(n, ['Fresh from the oven! What will it be, friend?'], () => proShopOpen(n, PRO_FOOD.map(it => ({ ...it }))));
  if (id === 'hale' && st === 'mats') return proSay(n, [`Garrick's dummy again? Ha! Take your pick: the rope is the strongest.`], () => proShopOpen(n, PRO_MATS.map(it => ({ ...it }))));
  if (st === 'camp') return proCampTalk(n);
  if (id === 'garrick' && st === 'garrick') return proSay(n, [`There you are, ${name}. The whole village says you have been running errands for everyone. That makes you one of us.`, `You will want something to hit things with. Here, take this: my first wooden sword. It has seen better days.`, `Mind how you swing it: a tired arm hits like wet laundry. Now, go and hit that dummy!`], () => { hero.equip.weapon = starterWeapon('wood'); recalcGear(); sfx('unlock'); popups.push({ text: 'Received a Wooden Sword', x: VW / 2, y: 150, t: 2.6, screen: true, small: true, color: '#ffd86a' }); proNext(); });
  if (st === 'deliver' && id === pro.recip) {
    const it = pro.mat;
    if (id === 'garrick') return proSay(n, [`Rope! ${name}, you beautiful stranger. That boar kicks like a mule, and this will hold him.`, `You are a good one. Here, take this: my first wooden sword. It has seen better days, but a traveller should not walk the road empty-handed.`, `Mind how you swing it: a tired arm hits like wet laundry. Now, go and hit that dummy!`], () => { hero.equip.weapon = starterWeapon('wood'); recalcGear(); sfx('unlock'); popups.push({ text: 'Received a Wooden Sword', x: VW / 2, y: 150, t: 2.6, screen: true, small: true, color: '#ffd86a' }); proStep(PRO_I.sword); });
    if (id === 'dorn') return proSay(n, [`Planks! Oh, bless you, ${name}. The wind took half my stall roof last night. A few boards, and I will have bread out in the rain again.`, 'Garrick was asking after you, by the way. He wants you at the training yard.'], () => { sfx('pickup'); proNext(); });
    return proSay(n, [`Nails! The shutters have been banging for a month, and Hale never has the time to fix them.`, `You are good for this village, ${name}. Garrick was asking after you: he wants you at the training yard.`], () => { sfx('pickup'); proNext(); });
  }
  if (id === 'orla' && st === 'orla') return proSay(n, [`Come here, child. You have been shivering at night, and a stranger with no scarf looks half undressed to me.`, `Hold still. A little red wool, a few quick stitches... there. Red, like the sunrise.`], () => { pro.scarf = true; hero.scarf.forEach(p => { p.x = hero.x; p.y = hero.y - 50; }); sfx('unlock'); popups.push({ text: 'Orla sewed you a red scarf', x: VW / 2, y: 150, t: 2.6, screen: true, small: true, color: '#ff8a8a' }); proNext(); });
  const chat = {
    maren: [`The river brought you to us, ${name}. I have never believed in coincidence.`, 'Sit by the fire tonight. Orla will tell her stories.'],
    sera: ['A good healer never runs out of tea.', 'Mind the thorns by the well.'],
    garrick: ['Guard duty is mostly watching sheep. I like it that way.', 'The beasts on the road come close some nights. Not often.'],
    tomas: ['Look! I caught a frog. His name is Sir Hops.', `Are you really a hero, ${name}? You look like one.`],
    orla: ['Knit one, purl one. That is all of life.', `Your scarf suits you, ${name}. Red, like the sunrise.`],
    dorn: ['The secret is patience. And butter. Mostly butter.', 'Come back when you are hungry. You will be.'],
    hale: ['A good plank is worth two good words.', 'Wood remembers. It has opinions, too.'],
  }[id] || ['...'];
  pro.chat = (pro.chat || 0) + 1; proSay(n, [chat[pro.chat % chat.length]]);
}

function proInteract() {
  if (!pro || pro.card || pro.wake || pro.cine) return;
  if (pro.talk) { proTalkNext(); return; }
  if (PRO_STEPS[pro.step].id === 'herbs') {
    const h = pro.herbs.find(q => !q.taken && Math.hypot(hero.x - q.x, hero.y - q.y) < 64);
    if (h) { h.taken = true; sfx('pickup'); const n = pro.herbs.filter(q => q.taken).length; pro.objN = `${n} / 3`; popups.push({ text: ['Thyme', 'Yarrow', 'Feverfew'][n - 1], x: hero.x, y: hero.y - 80, t: 1.2, color: '#9fd8a0' }); pro.mark = pro.herbs.find(q => !q.taken) || null; if (n >= 3) proNext(); return; }
  }
  const fr = pro.frog; if (PRO_STEPS[pro.step].id === 'tomas' && fr && !fr.caught && Math.hypot(hero.x - fr.x, hero.y - fr.y) < 64) {
    fr.caught = true; pro.mark = null; sfx('pickup'); const n = pro.N.tomas, name = hero.name;
    return proSay(n, [`You caught him! Sir Hops, you are a terrible escape artist.`, `Thank you, ${name}! Now watch closely: lips like this, and blow. Fweeet!`], () => { popups.push({ text: '\u266a \u266b \u266a', x: n.x, y: n.y - 110, t: 2.2, color: '#ffe9a0' }); proNext(); });
  }
  let best = null, bd = 78; for (const n of pro.npcs) { if (pro.dead.has(n.id)) continue; const d = Math.hypot(hero.x - n.x, hero.y - n.y); if (d < bd) { bd = d; best = n; } }
  if (best && !pro.fireOn) proTalkTo(best);
}
function proTalkNext() {
  const t = pro.talk; sfx('menu');
  if (t.i + 1 < t.lines.length) { t.i++; return; }
  pro.talk = null; if (t.cb) t.cb();
}
function proBuy(i) {
  const sh = pro && pro.shop, it = sh && sh.items[i]; if (!it) return;
  if (hero.gold < it.p) { sfx('denied'); popups.push({ text: 'Not enough gold', x: VW / 2, y: 150, t: 1.4, screen: true, small: true, color: '#f88' }); return; }
  hero.gold -= it.p; hero.goldPulse = 1; sfx('pickup'); pro.shop = null; showMenu(null);
  popups.push({ text: `Bought ${it.n} (${it.p} gold)`, x: VW / 2, y: 150, t: 2.4, screen: true, small: true, color: '#ffd86a' });
  if (PRO_STEPS[pro.step].id === 'food') pro.food = it.n; else { pro.mat = it.n; pro.recip = it.to; }
  proNext();
}
// the bonfire: everyone has a word for the hero, and Maren has the last one
function proCampStart() {
  pro.camp = true; pro.talked = new Set(); pro.sunT = 0; pro.todLock = true; tod = 0.72; pro.obj = `Join the harvest bonfire: speak to everyone (${proKeys('interact')})`; pro.objN = '0 / 6'; pro.hl = null;
  for (const id in PRO_SEATS) { const n = pro.N[id], [dx, dy, pose] = PRO_SEATS[id]; n.x = PRO_CAMP.x + dx; n.y = PRO_CAMP.y + dy; n.pose = pose; n.moving = false; n.f = Math.sign(-dx) || 1; n.bubble = null; }
  pro.solids.push({ x: PRO_CAMP.x, y: PRO_CAMP.y, r: 26 });
  hero.x = PRO_CAMP.x - 200; hero.y = PRO_CAMP.y + 50; hero.moving = false; hero.scarf.forEach(p => { p.x = hero.x; p.y = hero.y - 50; }); cam.x = clampN(hero.x - VW / 2, 0, WW - VW); cam.y = clampN(hero.y - VH / 2, 0, WH - VH); pro.fade = 1;
}
function proCampTalk(n) {
  const id = n.id, name = hero.name, said = pro.talked.has(id);
  if (id === 'maren') {
    if (pro.talked.size < 6) return proSay(n, [`Go and greet everyone first, ${name}. They have all been asking for you.`]);
    if (pro.sunT < 9) return proSay(n, [`Soon, ${name}. Let the sun go down first: the fire is best at dusk.`]);
    return proSay(n, [`There you are, ${name}. Sit, sit. Dorn sent his best, and you brought ${pro.food || 'something'} yourself: that is how a village is built.`, 'Granny Orla has the kettle on. Tomas has a frog to introduce. Hale is pretending he is not hungry.', `You have been with us only a few weeks, and already the place feels fuller. Whoever you were before, you are welcome here. Stay as long as you like, ${name}.`], () => { hero.hp = hero.maxHp; hero.stamina = maxStamina(); popups.push({ text: 'A warm meal, and a place to belong.', x: VW / 2, y: 150, t: 2.6, screen: true, small: true, color: '#9fd8a0' }); proNext(); });
  }
  if (said) return proSay(n, [['The fire is better when everyone is here.', 'Is that bread I smell? No, that is Dorn.', 'Sit down, sit down. There is room.'][(pro.chat = (pro.chat || 0) + 1) % 3]]);
  const L = {
    tomas: [`Look, ${name}! I can see Sir Hops in the flames. Oh, wait. That is only a log.`, 'I will teach you to whistle properly one day. Then we can whistle together, you and me!'],
    orla: ['Come and warm your hands, child. That scarf suits you better than it ever suited my needles.', 'Sixty winters I have sat by fires like this one. Not one of them was as full as tonight.'],
    dorn: ['Bread, honey cake, and a little of everything I could not sell today!', `Have a slice, ${name}. And no, you cannot pay me.`],
    hale: ['I built these log seats myself. Sturdy, are they not?', 'Wood remembers who has sat on it. Tonight it will remember you.'],
    sera: [`How is your head, ${name}? Let me see. ...Healing nicely.`, 'Whatever happened to you before, it is behind you now. Rest.'],
    garrick: [`Four hits on my old wooden sword, and you are still standing. Not bad, ${name}.`, 'If the beasts ever come to Hollowbrook, I will stand beside you. You can count on that.'],
  }[id];
  proSay(n, L, () => { pro.talked.add(id); sfx('pickup'); popups.push({ text: id === 'dorn' ? 'Dorn shared a slice of honey cake' : id === 'tomas' ? '\u266a \u266b \u266a' : `${n.name} smiles`, x: n.x, y: n.y - 112, t: 1.8, color: '#ffe9a0' }); });
}
function proBearStart() {
  pro.obj = `Fight off the bear! (${proKeys('attack')})`; pro.objN = '100%'; pro.mark = null; hero.moving = false;
  const m = spawnEnemy('wolf', { x: hero.x + 520, y: hero.y }, { noVariant: true, bear: true, hp: 70, maxHp: 70, r: 22, dmg: 9, speed: 135, spawnT: 0 }); m.name = 'Bear'; pro.bearM = m;
  sfx('roar'); shake(4); popups.push({ text: 'A bear is coming!', x: VW / 2, y: 160, t: 2.4, screen: true, small: true, color: '#f88' });
}
function proBearTick(dt) {
  const m = pro.bearM;
  if (m) {
    pro.objN = `${Math.max(0, Math.round(m.hp / m.maxHp * 100))}%`;
    if (m.hp <= m.maxHp * 0.18 || !enemies.includes(m)) {                              // beaten: it breaks off and runs for the trees (it is not killed, so there is nothing to loot)
      const i = enemies.indexOf(m); if (i >= 0) enemies.splice(i, 1); pro.bearM = null;
      pro.bear = { x: m.x, y: m.y, ph: 'won', f: Math.sign(m.x - hero.x) || 1, walkT: m.walkT || 0, t: 0 };
      hero.hp = Math.min(hero.hp, Math.round(hero.maxHp * 0.28)); pro.bandaged = 3; pro.obj = ''; pro.objN = ''; sfx('roar'); shake(6);
      popups.push({ text: 'The bear flees... but not before it marked you', x: VW / 2, y: 160, t: 3.2, screen: true, small: true, color: '#ffd86a' });
    }
  }
  if (!pro.fireOn && (m || PRO.scale < 0.99)) {                                      // just before the lunge lands, time slows and the hint shows how to dodge it (as when the village is attacked)
    const need = !!m && m.state === 'windup' && hero.flipT <= 0 && (pro.dodges | 0) < 4 && Math.hypot(m.x - hero.x, m.y - hero.y) < 300;
    pro.hint = need ? 'flip' : null; PRO.scale += ((need ? 0.16 : 1) - PRO.scale) * Math.min(1, dt * (need ? 14 : 5)); if (!m && PRO.scale > 0.98) PRO.scale = 1;
  }
  const b = pro.bear; if (b && b.ph === 'won') { b.t += dt; b.walkT += dt * 12; b.x += b.f * 300 * dt; if (b.t > 2.4) { pro.bear = null; proNext(); } }
}
function proSparTick(dt) {
  const S = pro.spar, g = pro.N.garrick, k = v => Math.max(0, Math.min(1, v)); S.t += dt; S.pt += dt; g.pose = 'spar'; g.moving = false; g.f = hero.x >= g.x ? 1 : -1;
  if (S.ph === 'idle') { g.swAng = -0.75 + Math.sin(S.t * 3) * 0.07; g.lunge = 0; g.x = S.hx; if (S.pt > S.dur) { S.ph = 'wind'; S.pt = 0; } }
  else if (S.ph === 'wind') { g.swAng = -0.75 - 0.55 * k(S.pt / 0.55); g.lunge = 0; g.x = S.hx; if (S.pt > 0.55) { S.ph = 'strike'; S.pt = 0; S.struck = false; } }
  else if (S.ph === 'strike') {
    const q = k(S.pt / 0.22); g.swAng = -1.3 + 1.85 * q; g.lunge = q; g.x = S.hx + g.f * 22 * q;
    if (!S.struck && q > 0.6) { S.struck = true; const near = Math.hypot(hero.x - g.x, hero.y - g.y) < 84; if (near && hero.flipT <= 0) { sfx('hit'); popups.push({ text: 'Too slow!', x: hero.x, y: hero.y - 90, t: 1, color: '#f9c' }); hero.x += g.f * 24; } else if (near) popups.push({ text: 'Nice dodge!', x: hero.x, y: hero.y - 90, t: 1, color: '#9fd8a0' }); }
    if (S.pt > 0.3) { S.ph = 'recover'; S.pt = 0; }
  } else { const q = k(S.pt / 0.5); g.swAng = 0.55 - 1.3 * q; g.lunge = 1 - q; g.x = S.hx + g.f * 22 * (1 - q); if (S.pt > 0.5) { S.ph = 'idle'; S.pt = 0; S.dur = 1.2 + Math.random() * 1.0; } }
  if (S.hits >= 4) { g.pose = 'stand'; g.swAng = undefined; g.lunge = 0; g.x = S.hx; sfx('unlock'); proBubble(g, 'Ha! You hit like a mule. A stubborn mule. I like it!', 4.4); return true; }
}
function proFrogTick(dt) {
  const f = pro.frog; if (!f || f.caught) return;
  if (f.hop > 0) { f.hop -= dt * 2.2; f.x += f.vx * dt; f.y += f.vy * dt; if (f.hop <= 0) { f.hop = 0; f.rest = 0.3 + Math.random() * 0.5; } }
  else { f.rest -= dt; if (f.rest <= 0) { const flee = Math.hypot(f.x - hero.x, f.y - hero.y) < 160; if (!flee && Math.random() < 0.5) { f.rest = 0.7; } else { const ang = flee ? Math.atan2(f.y - hero.y, f.x - hero.x) + (Math.random() - 0.5) * 1.3 : Math.random() * 6.28; f.vx = Math.cos(ang) * 95; f.vy = Math.sin(ang) * 58; f.hop = 1; sfx('step'); } } }
  f.x = clampN(f.x, 1190, 1480); f.y = clampN(f.y, 900, 1060);
}
function proDrawFrog(f) {
  const z = f.hop > 0 ? Math.sin((1 - f.hop) * Math.PI) * 24 : 0, x = f.x, y = f.y;
  ell(x, y + 2, 11 - z * 0.2, 3.5, 'rgba(0,0,0,0.25)'); ctx.fillStyle = '#3a7a3a'; ctx.beginPath(); ctx.ellipse(x - 9, y - 3 - z * 0.6, 6, 3, -0.4, 0, 6.3); ctx.fill(); ctx.fillStyle = '#4a9a4a'; ctx.beginPath(); ctx.ellipse(x, y - 7 - z, 10, 7.5, 0, 0, 6.3); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + 4, y - 14 - z, 3, 0, 6.3); ctx.arc(x - 1, y - 14 - z, 3, 0, 6.3); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x + 5, y - 14 - z, 1.2, 0, 6.3); ctx.arc(x, y - 14 - z, 1.2, 0, 6.3); ctx.fill();
}
// keys while a card or a conversation is up: the cards run by themselves, a conversation takes one key to move on
function proBlock(code) {
  if (!pro) return false;
  if (pro.talk) { if (isBound('interact', code) || isBound('attack', code) || code === 'Enter') proTalkNext(); return true; }
  return !!(pro.card || pro.wake || pro.cine);
}
const isBound = (a, code) => (settings.binds[a] || []).includes(code);
function proCardNext() { const c = pro.card; c.i++; c.t = 0; if (c.i >= c.lines.length) { pro.card = null; if (c.done) c.done(); } }

// ---------------------------------------------------------------- waking up, in Maren's house
const PRO_REST = 21;
function proWakeStart() { pro.bandaged = 2; pro.wake = { t: 0, out: -1, talked: false, door: 0 }; pro.wakeM = { ...pro.N.maren, x: 0, y: 0, f: -1, scale: 1, bubble: null, bubbleT: 0, moving: false, pose: 'stand', alpha: 1 }; pro.wakeCam = { x: cam.x, y: cam.y }; hero.moving = false; }
function proWakeTick(dt) {
  const w = pro.wake; w.t += dt; cam.x = pro.wakeCam.x; cam.y = pro.wakeCam.y;
  if (w.t > 7.0 && !w.talked) { w.talked = true; proSay(pro.N.maren, ['Easy, easy. You are awake.', `We found you by the river three mornings ago. You are in my house, and you are safe.`, 'That blow to your head was no small thing, and half of you is bruised to the bone. You will not leave this bed for a good while.', 'Sleep, and let Sera and me look after you.'], () => { w.rest = 0; w.upv = 1; }); }
  if (w.rest !== undefined && w.out < 0) {                                        // weeks of rest: the days and nights go by, Sera tends to him, the wounds heal
    w.rest += dt; const ph = (w.rest / PRO_REST) * 3 % 1; w.light = 0.5 + 0.5 * Math.sin(ph * 6.283 + 0.64); w.sleep = w.light < 0.4;
    w.upv += ((w.light > 0.55 ? 1 : 0) - w.upv) * Math.min(1, dt * 3);
    if (w.rest > PRO_REST && !w.allowed) { w.allowed = true; w.rest = undefined; w.light = 1; w.sleep = false; w.upv = 1; pro.bandaged = 2; proSay(pro.N.maren, ['Three weeks of Sera\'s tea and my stubbornness, and look at you, sitting up straight.', 'Sera says the fever is gone, and the bones have knit. You may go outside, but gently.', 'Go on. The air will do you good.'], () => { w.out = 0; w.x = 322; w.y = 332; w.walk = 0; }); }
  }
  if (w.out >= 0) {                                                                // out of bed, then a slow, stumbling walk to the door
    w.out += dt; const ez = k => k * k * (3 - 2 * k), cl = v => Math.max(0, Math.min(1, v)), RISE = 1.4;
    if (w.out < RISE) { const k = ez(cl(w.out / RISE)); w.x = 322 + 92 * k; w.y = 332 + 188 * k; w.sit = w.out < 0.55; w.walk = 0; w.amp = 0; w.stumble = 0; w.lean = 0.28 * (1 - k); w.hand = 0.9; w.bob = 0; }
    else {
      const o = w.out - RISE; let v = 36 * (0.7 + 0.4 * Math.sin(o * 1.9)), st = 0;
      for (const s0 of [2.6, 5.4]) if (o > s0 && o < s0 + 0.8) st = Math.sin((o - s0) / 0.8 * Math.PI);                      // a stumble: he lurches, nearly falls, catches himself
      v *= 1 - 0.92 * st; w.stumble = st; w.sit = false; w.x += v * dt; w.y = 520 + st * 4;
      const ph0 = w.walk; w.walk += dt * (v / 36) * 4.2 + (st > 0.05 ? dt * 5 : 0); w.amp = 0.8; w.lean = 0.09 + st * 0.22; w.hand = 0; w.bob = 1;
      if (Math.floor(w.walk / Math.PI) !== Math.floor(ph0 / Math.PI)) sfx('step');
    }
    w.door = cl((w.x - 740) / 100);
    if (w.x > 872 && w.leave === undefined) w.leave = 0;
    if (w.leave !== undefined) { w.leave += dt; if (w.leave > 1.1) { pro.wake = null; hero.moving = false; hero.x = 1040; hero.y = 800; hero.scarf.forEach(p => { p.x = hero.x; p.y = hero.y - 50; }); cam.x = clampN(hero.x - VW / 2, 0, WW - VW); cam.y = clampN(hero.y - VH / 2, 0, WH - VH); pro.fade = 1; proStep(PRO_I.move); } }
  }
}

// ---------------------------------------------------------------- the fire
function proKill(n, from) {
  if (pro.dead.has(n.id)) return; pro.dead.add(n.id); n.deadAt = pro.t; n.fallDir = from ? (Math.sign(n.x - from.x) || 1) : 1; n.moving = false; n.bubble = null; burst(n.x, n.y - 30, '#a02020', 18, 100, 3, -40); shake(5); sfx('death'); popups.push({ text: n.name, x: n.x, y: n.y - 100, t: 1.6, color: '#f55' });
}
function proFireTick(dt) {
  pro.fireOn = true; pro.fireT += dt; const t = pro.fireT, ds = dt * PRO.scale;
  const spawn = (type, x, y, extra) => { const m = spawnEnemy(type, { x, y }, extra || {}); m.spawnT = 0.5; return m; };
  pro.raiders = pro.raiders || []; pro.waves = pro.waves || 0;
  // monsters for the hero to fight (the real ones)
  if (t > 3 + pro.waves * 8 && pro.waves < 3) { pro.waves++; for (let i = 0; i < 2; i++) spawn('goblin', 2200, 800 + Math.random() * 300); sfx('spawn'); }
  // raiders: each one is sent after a villager, and runs him down
  const order = ['tomas', 'orla', 'dorn', 'hale', 'sera', 'garrick', 'maren'];
  while (pro.raiders.length < order.length && t > 1.2 + pro.raiders.length * 3.4) {
    const v = order[pro.raiders.length], m = spawnEnemy('goblin', { x: 2210, y: 820 + Math.random() * 280 }, { noVariant: true }); enemies.splice(enemies.indexOf(m), 1); m.spawnT = 0; m.victim = v; m.noBar = true; m.state = 'walk'; m.hp = m.maxHp = 9999; pro.raiders.push(m); sfx('spawn');
    if (pro.raiders.length === 1) proBubble(pro.N.tomas, 'Monsters! Run!', 2.4);
  }
  for (const m of pro.raiders) {
    const n = m.victim && pro.N[m.victim], P = MELEE.goblin; m.walkT += ds * 9; m.moving = false;
    if (m.mel) {
      m.mel.t += ds;
      if (m.mel.ph === 'wind' && m.mel.t >= P.wind) { m.mel.ph = 'strike'; m.mel.t = 0; sfx(P.snd); }
      else if (m.mel.ph === 'strike' && !m.mel.hit && m.mel.t >= P.hit * 0.45) { m.mel.hit = true; if (n) proKill(n, m); }
      else if (m.mel.ph === 'strike' && m.mel.t >= P.hit + P.rec) { m.mel = null; m.victim = null; }
    } else if (n && !pro.dead.has(n.id)) {
      const dx = n.x - m.x, dy = n.y - m.y, d = Math.hypot(dx, dy) || 1; m.facing = Math.sign(dx) || m.facing;
      if (d > 30) { m.x += dx / d * 108 * ds; m.y += dy / d * 108 * ds; m.moving = true; } else { m.mel = { ph: 'wind', t: 0, hit: false }; }
    } else {                                                                    // done: the next villager who is still alive, otherwise he leaves
      const left = order.find(id => !pro.dead.has(id) && !pro.raiders.some(r => r !== m && r.victim === id));
      if (left) m.victim = left; else { m.facing = 1; m.x += 70 * ds; m.walkT += ds * 4; }
    }
  }
  pro.raiders = pro.raiders.filter(m => m.x < 2290 || m.victim);
  // the villagers run from the nearest raider
  for (const n of pro.npcs) {
    if (pro.dead.has(n.id)) continue;
    let near = null, nd = 360; for (const m of pro.raiders) { const d = Math.hypot(m.x - n.x, m.y - n.y); if (d < nd) { nd = d; near = m; } }
    n.pose = 'stand'; n.walkT += ds * 8;
    if (near && !(near.mel && near.victim === n.id)) { const dx = n.x - near.x, dy = n.y - near.y, d = Math.hypot(dx, dy) || 1; n.moving = true; n.f = Math.sign(dx) || n.f; n.x = clampN(n.x + dx / d * (n.kid ? 66 : 58) * ds, PRO_B.x0 + 20, PRO_B.x1 - 20); n.y = clampN(n.y + dy / d * 34 * ds, PRO_B.y0 + 40, PRO_B.y1 - 20); if (!n.bubble && Math.random() < ds * 0.6) proBubble(n, ['Run!', 'Help!', 'Get back!', 'The barn is burning!', 'No, no!'][Math.floor(Math.random() * 5)], 1.4); }
    else n.moving = !!near;
  }
  if (t > 36) for (const id of order) proKill(pro.N[id]);                       // whatever happens, it ends
  const m0 = pro.minotaur;
  if (t > 28 && !m0) { pro.minotaur = spawn('minotaur', 2200, hero.y); sfx('roar'); shake(8); }
  if (hero.hp < 1) hero.hp = 1;                                                 // the hero is never killed here: the fall is part of the story
  if (pro.dead.size >= 7 && ((pro.minotaur && Math.hypot(pro.minotaur.x - hero.x, pro.minotaur.y - hero.y) < 70) || t > 48)) return true;
  let need = false;                                                             // slow time just before a hit lands, and show how to dodge it
  if (pro.dodges < 3) for (const m of enemies) if (m.mel && m.mel.ph === 'wind' && Math.hypot(m.x - hero.x, m.y - hero.y) < m.r + 70 && hero.flipT <= 0) need = true;
  pro.hint = need ? 'flip' : null;
  PRO.scale += ((need ? 0.16 : 1) - PRO.scale) * Math.min(1, dt * (need ? 14 : 5));
  if (pro.fx.length < 60) for (const b of pro.houses) for (let k = 0; k < 2; k++) {                                // the roofs burn
    if (Math.random() > 0.5) continue; const w = b.w * 0.8;
    particles.push({ x: b.x + (Math.random() - 0.5) * w, y: b.y - b.wh * (0.1 + Math.random() * 0.9) - Math.random() * b.rh * 0.6, vx: (Math.random() - 0.5) * 14, vy: -40 - Math.random() * 50, life: 0.9, max: 0.9, size: 3 + Math.random() * 4, color: Math.random() < 0.5 ? '#ff7a1a' : '#ffd24a', add: true });
  }
}

// ---------------------------------------------------------------- every frame
function proTick(dt) {
  if (!pro) return;
  pro.t += dt;
  if (pro.fade > 0 && !pro.card) pro.fade = Math.max(0, pro.fade - dt * 0.9);
  if (pro.card) { pro.card.t += dt; if (pro.card.t >= pro.card.durs[pro.card.i]) proCardNext(); }
  if (!PRO.fireOnTod && !pro.todLock) tod += (pro.todT - tod) * Math.min(1, dt * 0.35);
  if (pro.shop && openMenu !== 'shop') pro.shop = null;
  if (pro.cine) { proCineTick(dt); for (const k in keys) keys[k] = false; return; }
  if (pro.wake) { proWakeTick(dt); for (const k in keys) keys[k] = false; if (pro.wake) return; }
  // the hero stays in the village, outside the houses
  const prevX = hero.x, prevY = hero.y;
  hero.x = clampN(hero.x, PRO_B.x0, PRO_B.x1); hero.y = clampN(hero.y, PRO_B.y0, PRO_B.y1);
  for (const s of pro.solids) {
    if (s.r !== undefined) { const d = Math.hypot(hero.x - s.x, hero.y - s.y), m = s.r + 9; if (d < m) { hero.x = s.x + (hero.x - s.x) / (d || 1) * m; hero.y = s.y + (hero.y - s.y) / (d || 1) * m; } }
    else if (hero.x > s.x0 - 9 && hero.x < s.x1 + 9 && hero.y > s.y0 - 6 && hero.y < s.y1 + 4) {
      const l = hero.x - (s.x0 - 9), rr = s.x1 + 9 - hero.x, tp = hero.y - (s.y0 - 6), bt = s.y1 + 4 - hero.y, m = Math.min(l, rr, tp, bt);
      if (m === l) hero.x = s.x0 - 9; else if (m === rr) hero.x = s.x1 + 9; else if (m === tp) hero.y = s.y0 - 6; else hero.y = s.y1 + 4;
    }
  }
  for (const n of pro.npcs) {                                                              // people: a little life
    if (n.bubbleT > 0) { n.bubbleT -= dt; if (n.bubbleT <= 0) { n.bubble = null; n.talking = false; } }
    if (n.id === 'tomas' && !pro.fireOn && !pro.camp && !pro.dead.has('tomas')) { n.moving = true; n.walkT += dt * 5; n.x = n.hx + Math.sin(pro.t * 0.4) * 60; n.f = Math.cos(pro.t * 0.4) >= 0 ? 1 : -1; }
    else if (pro.fireOn && !pro.dead.has(n.id)) n.walkT += dt * 8;
    else if (pro.camp && !pro.fireOn) { n.moving = false; if (!pro.talk) n.f = Math.sign(PRO_CAMP.x - n.x) || 1; }
    else if (!pro.fireOn && n.id !== 'orla') { n.moving = false; if (Math.random() < dt * 0.1) n.f = hero.x >= n.x ? 1 : -1; }
  }
  proFrogTick(dt);
  // the dummy: did the swing land?
  const dm = pro.dummy; dm.shake = Math.max(0, dm.shake - dt * 4);
  if (hero.attackT > 0) {
    if (!pro.swinging) { pro.swinging = true; pro.swT = 0; pro.hitDone = false; }
    pro.swT += dt;
    if (!pro.hitDone && pro.swT >= (hero.attackDur || 0.4) * (hero.attackHitAt ?? 0.3)) {
      pro.hitDone = true;
      const gg = pro.N.garrick;
      if (PRO_STEPS[pro.step].id === 'spar' && pro.spar && Math.hypot(gg.x - hero.x, gg.y - hero.y) < 100 && (gg.x - hero.x) * hero.facing > -12) { pro.spar.hits++; sfx('hit'); burst(gg.x, gg.y - 50, '#d9c27a', 8, 80, 2.5, -30); popups.push({ text: String(Math.round(swordDmg())), x: gg.x, y: gg.y - 100, t: 0.5, color: '#fff' }); if (pro.spar.hits < 4) proBubble(gg, ['Ow! Good one!', 'Ha! Again!', 'Ooh, that stung!'][pro.spar.hits % 3], 1.6); pro.spar.pt = Math.min(pro.spar.pt, 0.0); pro.spar.ph = 'idle'; pro.spar.dur = 1.4; }
      if (Math.hypot(dm.x - hero.x, dm.y - hero.y) < 86 && (dm.x - hero.x) * hero.facing > -12 && PRO_STEPS[pro.step].id === 'sword') { dm.hits++; dm.shake = 1; sfx('hit'); burst(dm.x, dm.y - 50, '#d9c27a', 8, 80, 2.5, -30); popups.push({ text: String(Math.round(swordDmg())), x: dm.x, y: dm.y - 90, t: 0.5, color: '#fff' }); }
    }
  } else pro.swinging = false;
  if (hero.flipT > 0 && !pro.flipPrev) { if (PRO_STEPS[pro.step].id === 'flip') pro.flips++; if (pro.hint) pro.dodges++; }
  pro.flipPrev = hero.flipT > 0 ? 1 : 0;
  if (pro.card || pro.talk || false) { for (const k in keys) keys[k] = false; }
  proBearTick(dt);
  const s = PRO_STEPS[pro.step];
  if (s && s.tick && !pro.card && !pro.talk && s.tick(dt)) proNext();
}

// ---------------------------------------------------------------- drawing
function proDrawDead(n) {                                                           // a blow, a stagger, the fall, and the blood that spreads
  const k = Math.max(0, Math.min(1, (pro.t - (n.deadAt || 0)) / 0.9)), dir = n.fallDir || 1, ez = k * k * (3 - 2 * k), stag = k < 0.22 ? -Math.sin(k / 0.22 * Math.PI) * 0.2 : 0;
  ctx.fillStyle = 'rgba(110,8,8,0.72)'; ctx.beginPath(); ctx.ellipse(n.x + dir * 20 * ez, n.y + 2, 6 + 36 * ez, 2 + 8 * ez, 0, 0, 6.3); ctx.fill();
  ctx.save(); ctx.translate(n.x, n.y); ctx.rotate(dir * (ez * 1.5 + stag)); ctx.translate(-n.x, -n.y); n.moving = false; n.bubble = null; if (n.pose === 'knit') n.pose = 'stand'; drawVillager(n); ctx.restore();
}
function proDrawWorld() {
  if (pro.cine) { proDrawCine(); return; }
  if (pro.wake) { proDrawWake(); return; }
  const night = night01(), burning = pro.fireOn || pro.step >= PRO_I.ash, W = 960, H = 540;
  ctx.drawImage(pro.ground, cam.x, cam.y, VW, VH, cam.x, cam.y, VW, VH);
  const things = [];
  const vis = (x, y, m) => x > cam.x - m && x < cam.x + W + m && y > cam.y - m && y < cam.y + H + m * 1.5;
  for (const b of pro.houses) if (vis(b.x, b.y, 200)) things.push({ y: b.y, d: () => { drawBuilding(b, night > 0.45, night > 0.45); if (burning) { proSoot(b, pro.step >= PRO_I.ash ? 0.62 : 0.34); proFlames(b, pro.step >= PRO_I.ash ? 0.4 : 1); } } });
  for (const t of pro.trees) if (vis(t.x, t.y, 120)) things.push({ y: t.y, d: () => drawProp(t) });
  things.push({ y: 855, d: () => VPROP.well({ x: 1200, y: 855 }) });
  things.push({ y: 948, d: () => proDrawStall(1090, 948, 'food') }); things.push({ y: 1028, d: () => proDrawStall(980, 1028, 'wood') });
  if (PRO_STEPS[pro.step].id === 'herbs') for (const h of pro.herbs) if (!h.taken) things.push({ y: h.y, d: () => proDrawHerb(h) });
  if (pro.bear) things.push({ y: pro.bear.y, d: () => proDrawBear(pro.bear) });
  for (const [x, y] of [[900, 880], [1500, 870]]) things.push({ y, d: () => VPROP.lamp({ x, y }, night > 0.45) });
  things.push({ y: pro.dummy.y, d: () => proDrawDummy(pro.dummy) });
  things.push({ y: 1010, d: () => VPROP.hay({ x: 1980, y: 1010 }) }); things.push({ y: 1150, d: () => VPROP.fence({ x: 1500, y: 1150 }) });
  if (pro.camp) {
    for (const id in PRO_SEATS) { const [dx, dy, pose] = PRO_SEATS[id]; if (pose !== 'stand') things.push({ y: PRO_CAMP.y + dy - 1, d: () => proDrawLog(PRO_CAMP.x + dx, PRO_CAMP.y + dy + 2, 42) }); }
    things.push({ y: PRO_CAMP.y, d: () => { proFireGlow(PRO_CAMP.x, PRO_CAMP.y, 320, 1); proDrawBonfire(PRO_CAMP.x, PRO_CAMP.y, 1, tAnim); } });
  }
  if (pro.frog && !pro.frog.caught) things.push({ y: pro.frog.y, d: () => proDrawFrog(pro.frog) });
  for (const n of pro.npcs) if (vis(n.x, n.y, 100)) things.push({ y: n.y, d: () => pro.dead.has(n.id) ? proDrawDead(n) : drawVillager(n) });
  for (const c of corpses) if (inView(c.x, c.y)) things.push({ y: c.y, d: () => drawEnemy(c) });
  for (const m of enemies) if (inView(m.x, m.y, 120)) things.push({ y: m.y, d: () => drawEnemy(m) });
  for (const m of (pro.raiders || [])) if (inView(m.x, m.y, 120)) things.push({ y: m.y, d: () => drawEnemy(m) });
  things.push({ y: hero.y, d: () => { drawHero(hero); if (pro.carry) proDrawCarried(); } });
  things.sort((a, b) => a.y - b.y).forEach(o => o.d());
  for (const n of pro.npcs) if (n.bubble && !pro.dead.has(n.id)) drawBubble(n.x, n.y - 82 * (n.scale || 1), n.bubble, Math.min(1, n.bubbleT * 2));
  if (burning) {                                                                  // the glow of the fire on everything near it
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const b of pro.houses) { const g = ctx.createRadialGradient(b.x, b.y - b.wh * 0.6, 6, b.x, b.y - b.wh * 0.6, 190); g.addColorStop(0, `rgba(255,150,50,${0.38 + Math.sin(tAnim * 9 + b.x) * 0.06})`); g.addColorStop(1, 'rgba(255,100,20,0)'); ctx.fillStyle = g; ctx.fillRect(b.x - 190, b.y - b.wh * 0.6 - 190, 380, 380); }
    ctx.restore();
  }
  // markers: an arrow over what the step is about, a ring on the ground
  if (pro.mark && !pro.card && !pro.talk) {
    const m = pro.mark, bob = Math.sin(tAnim * 5) * 4, top = m.id ? m.y - 112 * (m.scale || 1) : m.y - (m === pro.frog ? 44 : 60);
    ctx.save(); ctx.strokeStyle = 'rgba(245,196,81,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(m.x, m.y + 2, 26 + Math.sin(tAnim * 4) * 3, 9, 0, 0, 6.3); ctx.stroke();
    ctx.fillStyle = '#f5c451'; ctx.strokeStyle = '#6a4a10'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(m.x, top + bob + 14); ctx.lineTo(m.x - 9, top + bob); ctx.lineTo(m.x + 9, top + bob); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  // the E prompt for whoever the hero stands next to
  if (!pro.card && !pro.talk && !pro.fireOn) {
    let t = null, bd = 78; for (const n of pro.npcs) { const d = Math.hypot(hero.x - n.x, hero.y - n.y); if (d < bd) { bd = d; t = { x: n.x, y: n.y - 112 * (n.scale || 1) }; } }
    if (pro.frog && !pro.frog.caught && PRO_STEPS[pro.step].id === 'tomas' && Math.hypot(hero.x - pro.frog.x, hero.y - pro.frog.y) < 64) t = { x: pro.frog.x, y: pro.frog.y - 40 };
    if (PRO_STEPS[pro.step].id === 'herbs') { const h = pro.herbs.find(q => !q.taken && Math.hypot(hero.x - q.x, hero.y - q.y) < 64); if (h) t = { x: h.x, y: h.y - 50 }; }
    if (t) { const bob = Math.sin(tAnim * 5) * 2; ctx.save(); ctx.fillStyle = 'rgba(20,20,28,0.88)'; ctx.strokeStyle = '#f5c451'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(t.x - 11, t.y - 11 + bob, 22, 22, 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#f5c451'; ctx.font = 'bold 14px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(keyLabel('interact'), t.x, t.y + 5 + bob); ctx.restore(); }
  }
}
function proSoot(b, a) {                                                            // a burnt look without a filter (filters are far too slow)
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; const cx = b.x, cy = b.y - (b.wh + b.rh * 0.4) / 2, g = ctx.createRadialGradient(cx, cy, 10, cx, cy, b.w * 0.75);
  g.addColorStop(0, `rgba(55,30,18,${a})`); g.addColorStop(0.75, `rgba(70,40,25,${a * 0.9})`); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(cx - b.w * 0.75, cy - b.w * 0.75, b.w * 1.5, b.w * 1.5); ctx.restore();
}
function proFlames(b, k) {                                                          // tongues of fire along the roof and walls
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 10; i++) {
    const hsh = ((i * 7919 + b.x) % 97) / 97, x = b.x + (i / 9 - 0.5) * b.w * 0.95, y = b.y - b.wh * (0.25 + hsh * 0.75) - b.rh * hsh * 0.35;
    const h = (24 + hsh * 36) * k * (0.75 + 0.25 * Math.sin(tAnim * 11 + i * 2.3)), w = 9 + hsh * 7;
    for (const [c, m] of [['rgba(255,110,20,0.75)', 1], ['rgba(255,210,80,0.8)', 0.55]]) {
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - w * m, y); ctx.quadraticCurveTo(x - w * 0.6 * m, y - h * 0.5 * m, x + Math.sin(tAnim * 8 + i) * 3, y - h * m); ctx.quadraticCurveTo(x + w * 0.6 * m, y - h * 0.5 * m, x + w * m, y); ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}
function proDrawCarried() {                                                         // held in front, in both hands
  const x = hero.x + hero.facing * 12, y = hero.y - 22 + Math.sin(hero.walkT * 2) * 1.5;
  ctx.save(); ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(hero.x, hero.y - 40); ctx.lineTo(x - 8, y - 6); ctx.moveTo(hero.x, hero.y - 38); ctx.lineTo(x + 8, y - 6); ctx.stroke();
  ctx.restore(); proDrawBucket(x, y + 8, true);
  ctx.save(); ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y - 8, 9, Math.PI, 0); ctx.stroke(); ctx.restore();
}
function proDrawStall(x, y, kind) {
  ell(x, y + 3, 56, 8, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = '#5a4126'; ctx.fillRect(x - 50, y - 84, 5, 84); ctx.fillRect(x + 45, y - 84, 5, 84);
  const cols = kind === 'food' ? ['#c0392b', '#f4efe2'] : ['#2f6aa8', '#f4efe2'];
  for (let i = 0; i < 8; i++) { ctx.fillStyle = cols[i % 2]; ctx.beginPath(); ctx.moveTo(x - 56 + i * 14, y - 70); ctx.lineTo(x - 42 + i * 14, y - 70); ctx.lineTo(x - 44 + i * 14, y - 92); ctx.lineTo(x - 58 + i * 14, y - 92); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = '#8b6a3f'; ctx.fillRect(x - 48, y - 24, 96, 24); ctx.fillStyle = '#6a4a28'; ctx.fillRect(x - 48, y - 28, 96, 5);
  if (kind === 'food') { for (let i = 0; i < 4; i++) ell(x - 34 + i * 14, y - 32, 8, 4.5, '#c98a4a'); for (let i = 0; i < 3; i++) circ(x + 20 + i * 9, y - 33, 4.5, '#c0392b'); ell(x + 2, y - 33, 6, 4, '#e8c078'); }
  else { ctx.fillStyle = '#c9b07a'; ctx.fillRect(x - 40, y - 34, 40, 5); ctx.fillRect(x - 38, y - 39, 36, 5); for (let i = 0; i < 3; i++) { ctx.strokeStyle = '#a08850'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + 20, y - 36, 4 + i * 2.5, 0, 6.3); ctx.stroke(); } ctx.fillStyle = '#5a5a60'; ctx.fillRect(x + 32, y - 36, 10, 7); }
}
function proDrawBucket(x, y, carried) {
  ctx.save(); if (!carried) ell(x, y + 2, 12, 4, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = '#8a5a30'; ctx.beginPath(); ctx.moveTo(x - 9, y - 16); ctx.lineTo(x + 9, y - 16); ctx.lineTo(x + 7, y); ctx.lineTo(x - 7, y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.strokeStyle = '#6a4a28'; ctx.beginPath(); ctx.moveTo(x - 8, y - 8); ctx.lineTo(x + 8, y - 8); ctx.stroke();
  ctx.fillStyle = '#4a7ab0'; ctx.beginPath(); ctx.ellipse(x, y - 16, 9, 3, 0, 0, 6.3); ctx.fill(); ctx.restore();
}
function proDrawDummy(d) {
  const x = d.x, y = d.y, sw = Math.sin(tAnim * 40) * d.shake * 5;
  ctx.save(); ell(x, y + 3, 24, 6, 'rgba(0,0,0,0.25)'); ctx.translate(x + sw, y);
  ctx.fillStyle = '#6a4a28'; ctx.fillRect(-4, -64, 8, 64); ctx.fillRect(-26, -50, 52, 6);
  ctx.fillStyle = '#d8c27a'; ctx.strokeStyle = '#5a4a20'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -72, 13, 0, 6.3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#c9b070'; ctx.fillRect(-14, -48, 28, 26); ctx.strokeRect(-14, -48, 28, 26);
  ctx.fillStyle = '#b02a2a'; ctx.beginPath(); ctx.arc(0, -36, 9, 0, 6.3); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -36, 5, 0, 6.3); ctx.fill(); ctx.fillStyle = '#b02a2a'; ctx.beginPath(); ctx.arc(0, -36, 2, 0, 6.3); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- the screen: objective, highlights, words
function proCap(x, y, label, w = 28, lit = true) {
  const pulse = 0.5 + 0.5 * Math.sin(tAnim * 6);
  ctx.save(); if (lit) { ctx.shadowColor = '#f5c451'; ctx.shadowBlur = 8 + 10 * pulse; }
  ctx.fillStyle = 'rgba(24,24,34,0.95)'; ctx.strokeStyle = lit ? '#f5c451' : '#7a7a8a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, y, w, 28, 6); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0; ctx.fillStyle = '#f5c451'; ctx.font = 'bold 13px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label, x + w / 2, y + 19); ctx.restore();
}
function proRing(x, y, w, h) {
  const pulse = 0.5 + 0.5 * Math.sin(tAnim * 5);
  ctx.save(); ctx.strokeStyle = `rgba(245,196,81,${0.55 + 0.45 * pulse})`; ctx.lineWidth = 2.5; ctx.shadowColor = '#f5c451'; ctx.shadowBlur = 10 + 8 * pulse; ctx.beginPath(); ctx.roundRect(x - 4 - pulse * 2, y - 4 - pulse * 2, w + 8 + pulse * 4, h + 8 + pulse * 4, 10); ctx.stroke(); ctx.restore();
}
function proWrap(text, w) {
  const words = text.split(' '), out = []; let cur = '';
  for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (ctx.measureText(t).width > w && cur) { out.push(cur); cur = wd; } else cur = t; }
  if (cur) out.push(cur); return out;
}
function proHUD() {
  if (!pro.wake && !pro.cine) { drawHeroCard(false); drawVitals(false); }
  if (pro.fireOn || pro.step >= PRO_I.ash) { ctx.fillStyle = `rgba(120,20,0,${pro.step >= PRO_I.ash ? 0.3 : 0.2})`; ctx.fillRect(0, 0, VW, VH); }
  const hl = pro.hl, flipHint = pro.hint === 'flip';
  if (hl === 'vitals') proRing(222, 468, 470, 44);
  if (hl === 'gold') proRing(24, 10, 232, 56);
  if (hl === 'stamina') proRing(222, 490, 470, 22);
  if (hl === 'keys' && !pro.card && !pro.talk) { const k = ['up', 'left', 'down', 'right'].map(a => proKeys(a)), cx = VW / 2 - 70, y = 392; proCap(cx + 30, y - 32, k[0]); proCap(cx, y, k[1]); proCap(cx + 60, y, k[2]); proCap(cx + 120, y, k[3]); }
  if ((hl === 'flip' || flipHint) && !pro.card && !pro.talk) { proCap(VW / 2 - 26, 404, proKeys('flip'), 52); ctx.fillStyle = '#fff'; ctx.font = 'bold 15px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(flipHint ? 'Dodge it!' : 'Flip', VW / 2, 392); proRing(222, 490, 470, 22); }
  if (hl === 'stamina' && !pro.card && !pro.talk) { proCap(VW / 2 - 26, 404, proKeys('attack'), 52); }
  // objective
  if (pro.obj && !pro.card && !pro.talk && !pro.cine) {
    ctx.save(); ctx.font = 'bold 14px "Segoe UI", sans-serif'; const w = Math.max(250, ctx.measureText(pro.obj).width + 54 + (pro.objN ? 56 : 0)), x = VW / 2 - w / 2;
    hudPanel(x, 12, w, 44, { r: 10 }); ctx.fillStyle = '#f5c451'; ctx.font = 'bold 9px "Segoe UI", sans-serif'; ctx.textAlign = 'left'; ctx.fillText('OBJECTIVE', x + 14, 28);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px "Segoe UI", sans-serif'; ctx.fillText(pro.obj, x + 14, 47); if (pro.objN) { ctx.textAlign = 'right'; ctx.fillStyle = '#9fd8a0'; ctx.fillText(pro.objN, x + w - 14, 47); } ctx.restore();
  }
  if (pro.talk) {
    const t = pro.talk, w = 640, h = 112, x = (VW - w) / 2, y = VH - h - 20;
    hudPanel(x, y, w, h, { r: 12 }); ctx.textAlign = 'left'; ctx.fillStyle = '#f5c451'; ctx.font = 'bold 14px "Segoe UI", sans-serif'; ctx.fillText(t.who, x + 22, y + 28);
    ctx.fillStyle = '#f2ecd8'; ctx.font = '15px "Segoe UI", sans-serif'; proWrap(t.lines[t.i], w - 44).slice(0, 3).forEach((ln, i) => ctx.fillText(ln, x + 22, y + 54 + i * 21));
    ctx.fillStyle = '#9a9ab0'; ctx.font = '11px "Segoe UI", sans-serif'; ctx.textAlign = 'right'; ctx.fillText(`${keyLabel('interact')}  ${t.i + 1 < t.lines.length ? 'next' : 'close'}`, x + w - 18, y + 18);
  }
  if (pro.card && pro.card.scroll) {
    const c = pro.card, sp = Math.min(1, c.t / c.move), fin = Math.min(1, c.t / 0.8);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, VH); ctx.textAlign = 'center'; let y = VH + 30 - sp * c.D;
    c.scroll.forEach((ln, i) => { const big = c.last && i === c.scroll.length - 1; ctx.font = big ? 'bold 46px Georgia, serif' : 'italic 22px Georgia, serif'; ctx.fillStyle = big ? '#f5c451' : '#e8e2d0'; const ws = proWrap(ln, 700), lh = big ? 52 : 32; ws.forEach((w2, k) => { const yy = y + k * lh; ctx.globalAlpha = Math.max(0, Math.min(1, (yy - 20) / 110, (VH - yy + 10) / 110, fin)); if (ctx.globalAlpha > 0) ctx.fillText(w2, VW / 2, yy); }); y += ws.length * lh + 30; });
    ctx.globalAlpha = 1;
  } else if (pro.card) {
    const c = pro.card, dur = c.durs[c.i], a = Math.max(0, Math.min(1, c.t / 0.9, (dur - c.t) / 0.7)), sc = c.scenes && c.scenes[c.i];
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, VH);
    if (sc) {
      proMemory(sc, c.t, a); const sg = ctx.createLinearGradient(0, VH - 190, 0, VH); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, `rgba(0,0,0,${0.82 * a})`); ctx.fillStyle = sg; ctx.fillRect(0, VH - 190, VW, 190);
      ctx.textAlign = 'center'; ctx.globalAlpha = a; ctx.fillStyle = '#f2e6c8'; ctx.font = 'italic 21px Georgia, serif'; const ls = proWrap(c.lines[c.i], 760); ls.forEach((ln, i) => ctx.fillText(ln, VW / 2, VH - 38 - (ls.length - 1 - i) * 28)); ctx.globalAlpha = 1;
    } else {
      ctx.textAlign = 'center'; ctx.globalAlpha = a; const last = c.last && c.i === c.lines.length - 1;
      ctx.fillStyle = last ? '#f5c451' : '#e8e2d0'; ctx.font = last ? 'bold 46px Georgia, serif' : 'italic 22px Georgia, serif';
      proWrap(c.lines[c.i], 700).forEach((ln, i, arr) => ctx.fillText(ln, VW / 2, VH / 2 + (i - (arr.length - 1) / 2) * 32));
      ctx.globalAlpha = 1;
    }
  }
  if (pro.fade > 0 && !pro.card) { ctx.fillStyle = `rgba(0,0,0,${pro.fade})`; ctx.fillRect(0, 0, VW, VH); }
}

// ---------------------------------------------------------------- the waking scene: a room in Maren's cottage, morning light, the hero in the bed
function proDrawWake() {
  const w = pro.wake, t = w.t, ink = '#1a1a1a', W = 960, H = 540;
  ctx.save(); ctx.translate(cam.x, cam.y);
  ctx.fillStyle = '#d8c7a0'; ctx.fillRect(0, 0, W, 336);
  ctx.fillStyle = '#c2ad84'; ctx.fillRect(0, 214, W, 122);
  ctx.fillStyle = '#5a3a22'; for (const x of [0, 236, 474, 700, 940]) ctx.fillRect(x, 0, 20, 336); ctx.fillRect(0, 0, W, 26); ctx.fillRect(0, 208, W, 8); ctx.fillRect(0, 330, W, 8);
  ctx.fillStyle = '#a8794a'; ctx.fillRect(0, 338, W, 202); ctx.strokeStyle = 'rgba(60,30,10,0.35)'; ctx.lineWidth = 1.5;
  for (let k = 0; k < 7; k++) { const yy = 338 + k * 30; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); for (let x = (k % 2) * 70; x < W; x += 140) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x, yy + 30); ctx.stroke(); } }
  ctx.fillStyle = '#8a3a30'; ctx.beginPath(); ctx.ellipse(470, 468, 190, 40, 0, 0, 6.3); ctx.fill(); ctx.strokeStyle = '#d9b44a'; ctx.lineWidth = 3; ctx.stroke();
  // a shelf with jars, and a window
  ctx.fillStyle = '#6a4a28'; ctx.fillRect(70, 118, 170, 8); for (let i = 0; i < 5; i++) { ctx.fillStyle = ['#c9a24a', '#7a9a5a', '#a05a4a', '#6a8aa8', '#d8c8a0'][i]; ctx.fillRect(80 + i * 32, 92, 20, 26); ctx.fillStyle = '#4a3220'; ctx.fillRect(82 + i * 32, 88, 16, 5); }
  ctx.fillStyle = '#5a3a22'; ctx.fillRect(502, 60, 128, 150); const lg0 = w.light === undefined ? 1 : w.light, mixc = (a, b) => `rgb(${a.map((v, i) => Math.round(b[i] + (v - b[i]) * lg0)).join(',')})`, sk = ctx.createLinearGradient(0, 70, 0, 200); sk.addColorStop(0, mixc([159, 208, 244], [10, 14, 40])); sk.addColorStop(1, mixc([228, 242, 250], [30, 40, 84])); ctx.fillStyle = sk; ctx.fillRect(512, 70, 108, 130);
  ctx.fillStyle = '#5a3a22'; ctx.fillRect(563, 70, 6, 130); ctx.fillRect(512, 130, 108, 6); ctx.fillRect(494, 206, 144, 10);
  // the hearth and the door
  ctx.fillStyle = '#8a8890'; ctx.fillRect(690, 100, 130, 232); ctx.fillStyle = '#a2a0a8'; ctx.fillRect(680, 92, 150, 14); ctx.fillStyle = '#16100c'; ctx.beginPath(); ctx.moveTo(712, 332); ctx.lineTo(712, 220); ctx.quadraticCurveTo(755, 170, 798, 220); ctx.lineTo(798, 332); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 5; i++) { const fx = 726 + i * 15, fh = 38 + Math.sin(tAnim * 9 + i * 2) * 10 + (i % 2) * 8; ctx.fillStyle = i % 2 ? 'rgba(255,200,80,0.8)' : 'rgba(255,110,20,0.8)'; ctx.beginPath(); ctx.moveTo(fx - 9, 332); ctx.quadraticCurveTo(fx - 5, 332 - fh * 0.6, fx + Math.sin(tAnim * 7 + i) * 3, 332 - fh); ctx.quadraticCurveTo(fx + 5, 332 - fh * 0.6, fx + 9, 332); ctx.fill(); }
  const hg = ctx.createRadialGradient(755, 320, 5, 755, 320, 190); hg.addColorStop(0, 'rgba(255,150,60,0.28)'); hg.addColorStop(1, 'rgba(255,150,60,0)'); ctx.fillStyle = hg; ctx.fillRect(560, 160, 400, 380); ctx.restore();
  ctx.fillStyle = '#4a3a2a'; ctx.beginPath(); ctx.arc(755, 300, 20, 0, Math.PI); ctx.fill(); ctx.fillRect(731, 290, 48, 8);
  const open = w.door; ctx.fillStyle = '#6a4a2a'; ctx.fillRect(848, 70, 90, 266); ctx.fillStyle = '#3a2a18'; for (const yy of [110, 280]) ctx.fillRect(848, yy, 90, 8);
  if (open > 0) { ctx.fillStyle = `rgba(255,248,220,${0.5 + 0.5 * open})`; ctx.fillRect(850 + 90 * (1 - open) * 0.0, 72, 86 * open, 262); }
  // the table and a bowl
  ctx.fillStyle = '#8a5a30'; ctx.fillRect(560, 380, 150, 12); ctx.fillStyle = '#6a4220'; ctx.fillRect(570, 392, 8, 56); ctx.fillRect(692, 392, 8, 56); ell(635, 380, 22, 6, '#e8e0cc'); ell(635, 378, 16, 4, '#8a5a30');
  // the morning light through the window
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,236,170,${0.15 * (w.light === undefined ? 1 : w.light)})`; ctx.beginPath(); ctx.moveTo(512, 200); ctx.lineTo(620, 200); ctx.lineTo(500, 540); ctx.lineTo(280, 540); ctx.closePath(); ctx.fill(); ctx.restore();
  // Maren by the table
  const drawOut = () => proHeroFig(w.x, w.y, 2.05, 1, { walk: w.walk, amp: w.amp, stumble: w.stumble || 0, lean: w.lean || 0, bandage: true, sit: w.sit, hand: w.hand, bob: w.bob });
  const m = pro.wakeM, mk = Math.max(0, Math.min(1, (t - 5.4) / 1.4)), mx = w.out >= 0 ? 510 : 700 - mk * 190; m.moving = w.out < 0 && mk > 0 && mk < 1; m.walkT += 0.12 * (m.moving ? 1 : 0); ctx.save(); ctx.translate(mx, 490); ctx.scale(2.3, 2.3); m.x = 0; m.y = 0; m.f = -1; drawVillager(m); ctx.restore();
  if (w.out >= 1.4) drawOut();                                                       // walking along the front of the room, in front of Maren
  if (w.rest !== undefined && (w.rest / PRO_REST * 3 % 1) > 0.1 && (w.rest / PRO_REST * 3 % 1) < 0.5) {   // Sera comes by to change the dressings
    const S = pro.wakeS || (pro.wakeS = { ...pro.N.sera, x: 0, y: 0, f: -1, scale: 1, bubble: null, bubbleT: 0, moving: false, pose: 'tend', alpha: 1 }); S.pose = 'tend'; ctx.save(); ctx.translate(448, 496); ctx.scale(2.3, 2.3); S.x = 0; S.y = 0; S.f = -1; drawVillager(S); ctx.restore();
  }
  // the bed
  ctx.fillStyle = '#5a3a22'; ctx.fillRect(86, 246, 22, 140); ctx.fillRect(404, 296, 16, 90); ctx.fillStyle = '#e8e0cc'; ctx.fillRect(108, 330, 296, 30); ctx.fillStyle = '#6a4a28'; ctx.fillRect(100, 360, 312, 12); ctx.fillRect(110, 372, 12, 22); ctx.fillRect(390, 372, 12, 22);
  ell(206, 326, 40, 13, '#f4efe2');
  // the hero: lying, eyes opening, a hand to the sore head, sitting up
  const up = w.rest !== undefined ? Math.max(0, Math.min(1, w.upv)) : Math.max(0, Math.min(1, (t - 5.2) / 1.6)), ease = up * up * (3 - 2 * up), th = (86 - 80 * ease) * Math.PI / 180, K = 1.5, R = 14 * K;
  const hx = 306, hy = 322, sx = hx - Math.sin(th) * 26 * K, sy = hy - Math.cos(th) * 26 * K, cx = sx - Math.sin(th) * 14 * K, cy = sy - Math.cos(th) * 14 * K;
  if (w.out < 0) {                                                                   // he is still in the bed (once he is up, the bed is empty)
  ctx.strokeStyle = ink; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(sx, sy); ctx.moveTo(hx, hy); ctx.lineTo(hx + 66, hy + 4); ctx.stroke();
  ctx.fillStyle = '#f3efe4'; ctx.strokeStyle = ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.3); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#cdb98a'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(cx, cy, R - 4, Math.PI * 0.62, Math.PI * 1.55); ctx.stroke(); ctx.fillStyle = 'rgba(190,40,40,0.8)'; ctx.beginPath(); ctx.arc(cx - Math.cos(th) * 12 - 4, cy - 6, 3, 0, 6.3); ctx.fill();
  const eye = Math.max(0, Math.min(1, (t - 3.0) / 0.9)), wince = t > 4.0 && t < 5.2;
  if (eye < 0.15 || w.sleep || (wince && Math.sin(t * 9) > 0.2)) { ctx.strokeStyle = ink; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx + 8, cy - 1, 6, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
  else { ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(cx + 8, cy, 4.2 * eye, 0, 6.3); ctx.fill(); }
  if (t > 4.0 && t < 5.6) { ctx.strokeStyle = ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(sx, sy + 2); ctx.lineTo(sx - 16, sy - 12 - ease * 6); ctx.lineTo(cx - R + 3, cy + 6); ctx.stroke(); }
  else if (ease > 0.3) { ctx.strokeStyle = ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(sx + 1, sy + 4); ctx.lineTo(sx + 20, sy + 32); ctx.stroke(); }
  }
  const br = Math.sin(t * 1.8) * 1.6 * (1 - ease);
  ctx.fillStyle = '#8a3a30'; ctx.beginPath(); ctx.moveTo(268, 326 + br); ctx.quadraticCurveTo(296, 304 + br, 330, 312 + br); ctx.lineTo(408, 322); ctx.lineTo(408, 362); ctx.lineTo(268, 362); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d9b44a'; ctx.fillRect(300, 334, 108, 5); ctx.strokeStyle = '#4a1a14'; ctx.lineWidth = 3; ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 16; i++) { const px = 330 + ((i * 47 + t * (6 + i % 5)) % 150), py = 220 + ((i * 71 - t * (5 + i % 4) * 2 + 1000) % 300); ctx.fillStyle = 'rgba(255,240,190,0.5)'; ctx.fillRect(px, py, 2, 2); } ctx.restore();
  if (w.sleep) { ctx.fillStyle = 'rgba(200,210,255,0.75)'; ctx.font = 'italic 22px Georgia, serif'; ctx.textAlign = 'left'; const zz = (w.rest * 0.8) % 1; ctx.globalAlpha = 1 - zz; ctx.fillText('z', cx + 28, cy - 24 - zz * 30); ctx.fillText('Z', cx + 44, cy - 44 - zz * 30); ctx.globalAlpha = 1; }
  if (t < 3.2) { ctx.fillStyle = `rgba(80,80,100,${0.7 * (1 - t / 3.2)})`; ctx.font = 'italic 20px Georgia, serif'; ctx.textAlign = 'left'; ctx.fillText('z', cx + 30, cy - 30 - t * 5); ctx.fillText('z', cx + 46, cy - 50 - t * 7); }
  ctx.restore();
  if (w.out >= 0 && w.out < 1.4) { ctx.save(); ctx.translate(cam.x, cam.y); drawOut(); ctx.restore(); }                       // getting up out of the bed (in front of it)
  if (w.rest !== undefined) {                                                          // the nights are dark; the fire still glows through
    const dk = (1 - w.light) * 0.58; ctx.fillStyle = `rgba(6,10,40,${dk})`; ctx.fillRect(cam.x, cam.y, 960, 540);
    ctx.save(); ctx.translate(cam.x, cam.y); ctx.globalCompositeOperation = 'lighter'; const hg2 = ctx.createRadialGradient(755, 320, 5, 755, 320, 230); hg2.addColorStop(0, `rgba(255,150,60,${0.4 * dk})`); hg2.addColorStop(1, 'rgba(255,150,60,0)'); ctx.fillStyle = hg2; ctx.fillRect(500, 100, 460, 440); ctx.restore();
    const k3 = w.rest / PRO_REST * 3, wk = Math.min(2, Math.floor(k3)), fr = k3 - wk, al = Math.max(0, Math.min(1, fr / 0.12, (1 - fr) / 0.12));
    ctx.fillStyle = `rgba(250,240,215,${al})`; ctx.font = 'italic 26px Georgia, serif'; ctx.textAlign = 'center'; ctx.shadowColor = '#000'; ctx.shadowBlur = 8; ctx.fillText(['One week passed.', 'Then another.', 'And a third.'][wk], cam.x + 480, cam.y + 500); ctx.shadowBlur = 0;
  }
  const a = t < 1.8 ? 1 - t / 1.8 : (w.leave !== undefined ? Math.min(1, w.leave / 1.1) : 0);
  if (a > 0) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(cam.x, cam.y, 960, 540); }
}

// ---------------------------------------------------------------- the past: a cell, and a river (told before the hero wakes up with no memory of it)
const PRO_CINE = {
  cell: { speed: 0.6, len: 33.6, caps: [[0.8, 4.4, "The kingdom's most wanted assassin."], [6.0, 10.0, 'By order of the Crown, you are named the murderer of Houses Vantrell, Merewyn, Ashgrove, Corvane, Dunmorrow and Halvard.', 'Herald'], [10.2, 13.2, 'Forty-one contracts, and not one witness left alive. For this, you are banished from the kingdom.', 'Herald'], [13.6, 18.4, 'Yes. All of it. Every name on that scroll.', 'The assassin'], [18.8, 23.2, 'I did it all to survive among the corruption of this kingdom. Every noble hand that paid me was as bloody as mine.', 'The assassin'], [23.8, 28.4, 'The guards beat him to the edge of death, and no further. The crown wanted him alive.'], [29.6, 33.0, 'One blow to the back of the head ended it.']], hits: [24.6, 25.9, 27.2], ko: 29.2 },
  river: { speed: 0.8, len: 25, caps: [[1.6, 6.4, 'He has not moved since the blow. He must be dead.', 'Guard'], [6.8, 11.0, 'Then throw him off like a dead corpse. The river will do the rest.', 'Guard'], [13.0, 17.6, 'The guards believed him dead. They could not have been more wrong.'], [18.0, 24.0, 'The river took him away, and the blow took everything with it: his name, his crimes, his past.']], throwAt: 11.4 },
};
function proCineStart(k) { pro.cine = { k, t: 0, shake: 0, flash: 0, hitDone: new Set() }; pro.rag = null; pro.mark = null; pro.obj = ''; pro.hl = null; Sound.music(k === 'cell' ? 'pro_cell' : 'pro_river'); Sound.setScene(null); }
function proCineTick(dt) {
  const c = pro.cine, D = PRO_CINE[c.k]; c.t += dt * (D.speed || 1); c.shake = Math.max(0, c.shake - dt * 3); c.flash = Math.max(0, c.flash - dt * 2.5);
  if (c.k === 'cell') {
    D.hits.forEach((h, i) => { if (c.t >= h && !c.hitDone.has(i)) { c.hitDone.add(i); c.shake = 1; c.flash = 0.5; sfx('hit'); shake(3); } });
    if (c.t >= D.ko && !c.hitDone.has('ko')) { c.hitDone.add('ko'); c.shake = 2; c.flash = 1.4; sfx('death'); shake(8); }
  } else {
    const rig = proRiverRig(c.t); if (!pro.rag) pro.rag = proRagInit(rig); const was = !!pro.rag.splash; proRagStep(pro.rag, rig, c.t, dt * (D.speed || 1));
    if (!was && pro.rag.splash) { sfx('splash'); shake(3); }
    if (rig.walking && Math.floor(c.t * 7.5 / Math.PI) !== Math.floor((c.t - dt) * 7.5 / Math.PI)) sfx('step');
  }
  if (c.t >= D.len) { pro.cine = null; if (c.k === 'cell') proCineStart('river'); else proNext(); }
}
function proLimb(x1, y1, x2, y2, w = 5, col = '#d8d2c4') { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function proCaption(caps, t, top) {
  for (const [a, b, text, who] of caps) {
    if (t < a || t > b) continue; const al = Math.max(0, Math.min(1, (t - a) / 0.7, (b - t) / 0.6));
    ctx.save(); ctx.globalAlpha = al; ctx.textAlign = 'center'; ctx.font = who ? '19px Georgia, serif' : 'italic 20px Georgia, serif'; const lines = proWrap(text, 720), h = lines.length * 28 + 24 + (who ? 20 : 0), y0 = top ? 14 : 540 - 42 - h;
    ctx.fillStyle = 'rgba(0,0,0,0.66)'; ctx.fillRect(110, y0, 740, h); let yy = y0 + 32;
    if (who) { ctx.fillStyle = '#d9b44a'; ctx.font = 'bold 12px "Segoe UI", sans-serif'; ctx.fillText(who.toUpperCase(), 480, yy - 6); yy += 18; ctx.font = '19px Georgia, serif'; }
    ctx.fillStyle = who === 'Herald' ? '#f0dcb0' : '#e8e2d0'; lines.forEach((ln, i) => ctx.fillText(ln, 480, yy + i * 28)); ctx.restore();
  }
}
function proDrawCine() {
  const c = pro.cine, t = c.t, D = PRO_CINE[c.k], W = 960, H = 540;
  ctx.save(); ctx.translate(cam.x, cam.y); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (c.shake > 0) ctx.translate((Math.random() - 0.5) * 10 * c.shake, (Math.random() - 0.5) * 8 * c.shake);
  if (c.k === 'cell') proDrawCell(c, t); else proDrawRiver(c, t);
  proCaption(D.caps, t, c.k === 'cell');
  if (c.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(1, c.flash)})`; ctx.fillRect(-20, -20, W + 40, H + 40); }
  const fin = Math.max(0, 1 - t / 1.2), fout = Math.max(0, Math.min(1, (t - (D.len - 1.2)) / 1.2)), fa = Math.max(fin, fout);
  if (fa > 0) { ctx.fillStyle = `rgba(0,0,0,${fa})`; ctx.fillRect(-20, -20, W + 40, H + 40); }
  ctx.restore();
}
function proChain(x1, y1, x2, y2, sag = 0) {                                       // real links: oval links facing us, and edge-on links between them
  const len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(3, Math.round(len / 11)), ang = Math.atan2(y2 - y1, x2 - x1);
  for (let i = 0; i <= n; i++) {
    const k = i / n, x = x1 + (x2 - x1) * k + Math.sin(k * Math.PI) * sag, y = y1 + (y2 - y1) * k + Math.sin(k * Math.PI) * sag * 0.3;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    if (i % 2) { ctx.fillStyle = '#5c6170'; ctx.fillRect(-5.5, -1.7, 11, 3.4); ctx.fillStyle = '#a9aebb'; ctx.fillRect(-5.5, -1.7, 11, 1.2); }
    else { ctx.lineWidth = 2.8; ctx.strokeStyle = '#464b58'; ctx.beginPath(); ctx.ellipse(0, 0, 6.4, 4, 0, 0, 6.3); ctx.stroke(); ctx.lineWidth = 1.1; ctx.strokeStyle = '#b6bbc8'; ctx.beginPath(); ctx.ellipse(0, -0.3, 5.6, 3.2, 0, 3.5, 5.7); ctx.stroke(); }
    ctx.restore();
  }
}
function proGuard(x, y, s, arm, face, kind, walk) {                                // arm: a swing 0..1, or 'carry', or { hx, hy, lean } = where the hands are (guard-local) and how far he leans                                    // a royal guard: helmet with nose guard and a red plume, steel pauldrons, a blue tabard with a gold crest, a mace. kind 'herald': a crimson tabard and a feathered cap
  const f = face || 1, herald = kind === 'herald', cloth = herald ? '#7a1f2a' : '#2c3a66', trim = '#d9b44a'; ctx.save(); ctx.translate(x, y); ctx.scale(s * f, s);
  ell(0, 2, 24, 6, 'rgba(0,0,0,0.45)');
  const mv = walk === undefined ? 0 : 1, sa = Math.sin(walk || 0) * 12 * mv, la = Math.max(0, Math.cos(walk || 0)) * 5 * mv, lb = Math.max(0, -Math.cos(walk || 0)) * 5 * mv;
  proLimb(-5, -34, -8 + sa, -5 - la, 6, '#3a3a44'); proLimb(6, -34, 9 - sa, -5 - lb, 6, '#3a3a44'); ctx.fillStyle = '#23232a'; ctx.fillRect(-14 + sa, -7 - la, 12, 7); ctx.fillRect(3 - sa, -7 - lb, 13, 7);
  ctx.translate(0, -Math.abs(Math.sin(walk || 0)) * 1.8 * mv); if (arm && typeof arm === 'object' && arm.lean) { ctx.translate(0, -34); ctx.rotate(arm.lean); ctx.translate(0, 34); }
  ctx.fillStyle = cloth; ctx.beginPath(); ctx.moveTo(-12, -72); ctx.lineTo(12, -72); ctx.lineTo(14, -30); ctx.lineTo(-14, -30); ctx.closePath(); ctx.fill(); ctx.fillStyle = trim; ctx.fillRect(-14, -34, 28, 3); ctx.fillRect(-12, -72, 24, 2.5);
  ctx.fillStyle = trim; ctx.beginPath(); ctx.moveTo(0, -62); ctx.lineTo(5, -55); ctx.lineTo(0, -48); ctx.lineTo(-5, -55); ctx.closePath(); ctx.fill(); ctx.fillRect(-4, -66, 2, 4); ctx.fillRect(-1, -67, 2, 5); ctx.fillRect(2, -66, 2, 4);
  ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-14, -42, 28, 4); ctx.fillStyle = trim; ctx.fillRect(-3, -43, 6, 6);
  if (!herald) { ctx.fillStyle = '#8a909e'; for (const sx of [-13, 13]) { ctx.beginPath(); ctx.arc(sx, -69, 7, 0, 6.3); ctx.fill(); ctx.strokeStyle = '#4a4e5a'; ctx.lineWidth = 1.2; ctx.stroke(); } }
  if (arm !== 'carry' && !(arm && typeof arm === 'object')) { proLimb(-12, -68, -15, -48, 5, herald ? '#5a1620' : '#7c8290'); ctx.fillStyle = '#d8c4a0'; ctx.beginPath(); ctx.arc(-15, -46, 3.2, 0, 6.3); ctx.fill(); }
  const carryO = arm && typeof arm === 'object' ? arm : null, carry = arm === 'carry' || !!carryO, a = herald ? -1.15 : carry ? -0.5 : -2.2 + arm * 2.4, ex = Math.cos(a) * 20, ey = -68 + Math.sin(a) * 20, hx2 = herald ? 8 : Math.cos(a) * 36, hy2 = herald ? -50 : -68 + Math.sin(a) * 36;
  if (!carry) { proLimb(12, -68, herald ? 14 : ex, herald ? -58 : ey, 5, herald ? '#5a1620' : '#7c8290'); proLimb(herald ? 14 : ex, herald ? -58 : ey, hx2, hy2, 5, herald ? '#5a1620' : '#7c8290'); }
  if (carry) { const hh = carryO ? carryO.hx : 36, hv = carryO ? carryO.hy : -46; proLimb(-4, -66, (hh - 4) * 0.5, (hv - 66) / 2 + 4, 4.5, '#6a707e'); proLimb((hh - 4) * 0.5, (hv - 66) / 2 + 4, hh - 2, hv, 4.5, '#6a707e'); proLimb(9, -67, (hh + 9) / 2, (hv - 67) / 2 + 4, 5, '#7c8290'); proLimb((hh + 9) / 2, (hv - 67) / 2 + 4, hh + 3, hv - 1, 5, '#7c8290'); ctx.fillStyle = '#d8c4a0'; ctx.beginPath(); ctx.arc(hh - 2, hv, 3, 0, 6.3); ctx.arc(hh + 3, hv - 1, 3.2, 0, 6.3); ctx.fill(); }
  if (!herald && !carry) { const bx = Math.cos(a) * 56, by = -68 + Math.sin(a) * 56, ux = Math.cos(a), uy = Math.sin(a); proLimb(hx2 - ux * 8, hy2 - uy * 8, bx, by, 5.5, '#7a5230'); proLimb(hx2 - ux * 8, hy2 - uy * 8, hx2 + ux * 9, hy2 + uy * 9, 6.2, '#3a2a1a'); proLimb(bx - ux * 2, by - uy * 2, bx, by, 6.4, '#9a6e40'); proLimb(hx2 + ux * 14, hy2 + uy * 14, bx - ux * 6, by - uy * 6, 1.6, 'rgba(255,220,170,0.35)'); }
  ctx.fillStyle = '#e4d2b4'; ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, -85, 10.5, 0, 6.3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(3, -87, 2.4, 2.4); ctx.strokeStyle = '#6a3a2a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(2, -80); ctx.lineTo(7, -80.5); ctx.stroke();
  if (herald) { ctx.fillStyle = '#1a1a22'; ctx.fillRect(-12, -96, 24, 5); ctx.beginPath(); ctx.moveTo(-9, -96); ctx.lineTo(0, -112); ctx.lineTo(9, -96); ctx.fill(); ctx.strokeStyle = '#d9b44a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(4, -104); ctx.quadraticCurveTo(22, -116, 20, -96); ctx.stroke(); }
  else { ctx.fillStyle = '#7c8290'; ctx.beginPath(); ctx.arc(0, -86, 12.2, Math.PI, 0); ctx.fill(); ctx.fillRect(-12.2, -87, 24.4, 3.5); ctx.strokeStyle = '#3a3e4a'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = '#9aa0ae'; ctx.fillRect(-1, -86, 3.4, 11); ctx.fillStyle = '#6a707e'; ctx.fillRect(-12, -86, 4, 10); ctx.fillRect(9, -86, 3.5, 10); ctx.fillStyle = '#b02a2a'; ctx.beginPath(); ctx.moveTo(-2, -98); ctx.quadraticCurveTo(-14, -112 + Math.sin(tAnim * 3) * 1.5, -22, -98); ctx.quadraticCurveTo(-12, -102, -2, -98); ctx.fill(); }
  ctx.restore();
}
function proScroll(x, y, shown, t) {                                               // the decree, unrolled: the houses the assassin ended
  const W = 238, H = 192, LINES = ['DECREE OF BANISHMENT', 'The Crown names the assassin of:', 'House Vantrell: Lord Aldric, slain', 'House Merewyn: the whole line', 'House Ashgrove: poisoned at feast', 'House Corvane: the tower burned', 'House Dunmorrow: the heir drowned', 'House Halvard: a duke and his guard', 'Forty-one contracts. No witnesses.', 'SENTENCE: BANISHED FOR ALL TIME.'];
  ctx.save(); ctx.translate(x - W / 2, y); ctx.fillStyle = '#6a4a28'; ctx.fillRect(-6, -6, W + 12, 9); ctx.fillStyle = '#e8d8ac'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W - 3, H); ctx.quadraticCurveTo(W / 2, H + 8, 3, H); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#a88a52'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = 'rgba(120,80,30,0.12)'; ctx.fillRect(0, 0, 14, H); ctx.fillRect(W - 14, 0, 14, H);
  ctx.textAlign = 'center';
  LINES.forEach((ln, i) => { if (i >= shown) return; const a = Math.min(1, (shown - i) * 1.4); ctx.globalAlpha = a; ctx.fillStyle = i === 0 || i === LINES.length - 1 ? '#7a1f1a' : '#3a2a14'; ctx.font = i === 0 ? 'bold 12px Georgia, serif' : i === LINES.length - 1 ? 'bold 10.5px Georgia, serif' : '10.5px Georgia, serif'; ctx.fillText(ln, W / 2, 20 + i * 17.5); });
  ctx.globalAlpha = 1; if (shown >= LINES.length) { ctx.fillStyle = '#9a1a1a'; ctx.beginPath(); ctx.arc(W - 30, H - 12, 9, 0, 6.3); ctx.fill(); ctx.strokeStyle = '#5a0a0a'; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.restore();
}
function proDrawCell(c, t) {
  const D = PRO_CINE.cell, W = 960, H = 540, ko = t >= D.ko, lift = ko ? 0 : Math.max(0, Math.min(1, (t - 12.4) / 0.8)) * (t < 24 ? 1 : Math.max(0, 1 - (t - 24) / 0.6));
  const hang = ko ? 1 : 0.55 + 0.1 * Math.sin(t * 1.4) - lift * 0.55, nHits = D.hits.filter(h => t >= h).length, blood = 1 + nHits * 0.5 + (ko ? 0.5 : 0);
  ctx.fillStyle = '#25252e'; ctx.fillRect(0, 0, W, 380); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2;
  for (let y = 0; y < 380; y += 44) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); for (let x = (y / 44 % 2) * 60; x < W; x += 120) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 44); ctx.stroke(); } }
  ctx.fillStyle = '#1a1a21'; ctx.fillRect(0, 380, W, 160); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; for (let x = 0; x < W; x += 90) { ctx.beginPath(); ctx.moveTo(x, 380); ctx.lineTo(x - 40, H); ctx.stroke(); }
  ctx.fillStyle = '#16161b'; ctx.fillRect(40, 70, 130, 190); ctx.strokeStyle = '#6a6a78'; ctx.lineWidth = 6; for (let x = 60; x <= 150; x += 30) { ctx.beginPath(); ctx.moveTo(x, 70); ctx.lineTo(x, 260); ctx.stroke(); }
  ctx.fillStyle = '#c9b070'; for (let i = 0; i < 18; i++) ctx.fillRect(250 + ((i * 53) % 280), 462 + ((i * 17) % 50), 22, 3);
  const fl = 1 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.06;
  ctx.fillStyle = '#4a3220'; ctx.fillRect(748, 150, 8, 40); ctx.fillStyle = '#ff9a2a'; ctx.beginPath(); ctx.moveTo(740, 152); ctx.quadraticCurveTo(752, 100 * (2 - fl), 764, 152); ctx.fill(); ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.moveTo(746, 152); ctx.quadraticCurveTo(752, 124, 758, 152); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; const lg = ctx.createRadialGradient(752, 150, 6, 752, 150, 420 * fl); lg.addColorStop(0, 'rgba(255,150,60,0.42)'); lg.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H); ctx.restore();
  // blood on the floor: a pool that grows with every blow, spatters, and drops that fall from him
  const hx = 400, fy = 452, hs = 1.6, sag = hang, sw = Math.sin(t * 1.3) * 1.5;
  ctx.fillStyle = 'rgba(90,6,8,0.85)'; ctx.beginPath(); ctx.ellipse(hx + 6, fy + 2, 34 + blood * 16, 8 + blood * 4, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = 'rgba(140,12,14,0.7)'; ctx.beginPath(); ctx.ellipse(hx + 4, fy + 1, 22 + blood * 11, 5 + blood * 2.6, 0, 0, 6.3); ctx.fill();
  for (let i = 0; i < 9 + nHits * 4; i++) { const px = hx + 6 + (((i * 73) % 150) - 75) * (0.7 + blood * 0.3), py = fy + 2 + (((i * 31) % 22) - 6); ctx.fillStyle = 'rgba(110,8,10,0.8)'; ctx.beginPath(); ctx.ellipse(px, py, 2 + (i % 3) * 1.4, 1.2 + (i % 2), 0, 0, 6.3); ctx.fill(); }
  const S = { x: 3 + 7 * sag, y: -66 + 5 * sag }, Hh = { x: -6, y: -30 }, Kn = { x: 15, y: -3 }, Ft = { x: -26, y: -3 }, hd = { x: S.x + 8 + 5 * sag, y: S.y - 13 + 9 * sag };
  const hl = { x: S.x - 13, y: S.y - 46 + 4 * sag }, hr = { x: S.x + 12, y: S.y - 48 + 4 * sag }, L = (p, q, w, col) => proLimb(p.x, p.y, q.x, q.y, w, col || '#d2cdbd');
  ctx.save(); ctx.translate(hx, fy); ctx.scale(hs, hs); ell(0, 1, 34, 5, 'rgba(0,0,0,0.4)');
  L(Hh, { x: Kn.x + 7, y: Kn.y }, 4, '#9c978a'); L({ x: Kn.x + 7, y: Kn.y }, { x: Ft.x - 4, y: Ft.y + 1 }, 4, '#9c978a');
  L(Hh, Kn, 4.5); L(Kn, Ft, 4.5); L(Hh, S, 5.5); L(S, { x: hl.x + 1, y: hl.y + 22 }, 4); L({ x: hl.x + 1, y: hl.y + 22 }, hl, 4); L(S, { x: hr.x - 1, y: hr.y + 22 }, 4); L({ x: hr.x - 1, y: hr.y + 22 }, hr, 4);
  const R = (p, q, w) => proLimb(p.x, p.y, q.x, q.y, w, 'rgba(150,10,12,0.92)');                                         // the wounds: gashes across the torso and arms, streaks down the legs
  R({ x: Hh.x - 2, y: Hh.y - 8 }, { x: Hh.x + 3, y: Hh.y - 20 }, 2.4); R({ x: S.x - 1, y: S.y + 10 }, { x: S.x + 3, y: S.y + 22 }, 2.4); R({ x: S.x - 2, y: S.y + 3 }, { x: S.x + 1, y: S.y + 12 }, 1.6); R({ x: hl.x, y: hl.y + 6 }, { x: hl.x + 1, y: hl.y + 20 }, 2.6); R({ x: hr.x, y: hr.y + 8 }, { x: hr.x - 1, y: hr.y + 21 }, 2.6); R({ x: Kn.x - 4, y: Kn.y - 9 }, { x: Kn.x, y: Kn.y - 1 }, 2.2);
  if (blood > 1.4) { R({ x: S.x - 3, y: S.y + 16 }, { x: S.x + 4, y: S.y + 28 }, 2); R({ x: Hh.x + 5, y: Hh.y - 3 }, { x: Hh.x, y: Hh.y + 5 }, 2); }
  ctx.fillStyle = '#f3efe4'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.arc(hd.x, hd.y, 13, 0, 6.3); ctx.fill(); ctx.stroke();
  const talk = t > 13 && t < 23.4 && lift > 0.5;
  ctx.lineWidth = 1.8; ctx.strokeStyle = '#111'; if (lift > 0.5) { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(hd.x + 6, hd.y - 1, 2.6, 0, 6.3); ctx.fill(); if (talk) { ctx.beginPath(); ctx.ellipse(hd.x + 6, hd.y + 6, 3.4, 1.6 + Math.abs(Math.sin(t * 9)) * 2.4, 0, 0, 6.3); ctx.stroke(); } else { ctx.beginPath(); ctx.moveTo(hd.x + 3, hd.y + 6); ctx.lineTo(hd.x + 9, hd.y + 6); ctx.stroke(); } }
  else { ctx.beginPath(); ctx.arc(hd.x + 5, hd.y + 3, 4.5, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke(); }
  ctx.fillStyle = 'rgba(110,60,120,0.6)'; ctx.beginPath(); ctx.ellipse(hd.x - 4, hd.y - 4, 5.5, 4.5, 0, 0, 6.3); ctx.fill(); ctx.beginPath(); ctx.ellipse(hd.x + 8, hd.y + 4, 3.4, 2.6, 0, 0, 6.3); ctx.fill();
  ctx.fillStyle = 'rgba(170,16,16,0.92)'; ctx.beginPath(); ctx.arc(hd.x - 7, hd.y - 8, 3, 0, 6.3); ctx.fill(); ctx.fillRect(hd.x - 8.4, hd.y - 8, 2.8, 12 + blood * 3); ctx.fillRect(hd.x + 1, hd.y + 5, 2, 7 + blood * 2); ctx.beginPath(); ctx.arc(hd.x + 2, hd.y + 13 + blood * 2, 1.8, 0, 6.3); ctx.fill();
  ctx.restore();
  for (let i = 0; i < 3; i++) { const k = ((t * 0.9 + i * 0.37) % 1), dx = hx + (hd.x - 4 + i * 5) * hs, y0 = fy + (hd.y + 18) * hs; ctx.fillStyle = 'rgba(160,14,14,0.9)'; ctx.beginPath(); ctx.ellipse(dx, y0 + k * (fy - y0), 1.8, 2.8, 0, 0, 6.3); ctx.fill(); }
  for (const [h0, rx] of [[hl, hx - 70], [hr, hx + 70]]) {
    const wx = hx + h0.x * hs, wy = fy + h0.y * hs;
    ctx.fillStyle = '#3a3e4a'; ctx.fillRect(rx - 12, 138, 24, 18); ctx.fillStyle = '#6b7080'; ctx.fillRect(rx - 12, 138, 24, 5); ctx.fillStyle = '#9aa0ae'; for (const bx of [-8, 8]) { ctx.beginPath(); ctx.arc(rx + bx, 150, 2, 0, 6.3); ctx.fill(); }
    proChain(rx, 158, wx + (rx < hx ? -3 : 3), wy - 9, 8 + sw * 4);
    ctx.fillStyle = '#6b7080'; ctx.fillRect(wx - 7, wy - 7, 14, 8); ctx.fillStyle = '#a9aebb'; ctx.fillRect(wx - 7, wy - 7, 14, 2.4); ctx.strokeStyle = '#2a2d36'; ctx.lineWidth = 1.5; ctx.strokeRect(wx - 7, wy - 7, 14, 8); ctx.strokeStyle = '#4a4f5c'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(wx, wy - 10, 3.6, 0, 6.3); ctx.stroke();
    ctx.fillStyle = 'rgba(150,12,12,0.9)'; ctx.fillRect(wx - 5, wy + 1, 2.4, 8 + blood * 3);
  }
  // the guards: two flank a herald with the decree; for the beating the herald steps back
  const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k)), hitK = h => Math.max(0, 1 - Math.abs(t - h) * 5), beating = t > 23.4;
  const ax = lerp(lerp(1030, 560, (t - 3.2) / 2.2), 505, (t - 23.4) / 0.8), hxh = lerp(lerp(1080, 700, (t - 3.6) / 2.4), 930, (t - 23.4) / 1.2), bx2 = lerp(lerp(1130, 850, (t - 4.0) / 2.4), 575, (t - 23.4) / 0.8);
  const gp = (fn) => { const d = fn(t) - fn(t - 0.12); return Math.abs(d) > 0.4 ? t * 9 : undefined; };
  const axf = tt => lerp(lerp(1030, 560, (tt - 3.2) / 2.2), 505, (tt - 23.4) / 0.8), hxf = tt => lerp(lerp(1080, 700, (tt - 3.6) / 2.4), 930, (tt - 23.4) / 1.2), bxf = tt => lerp(lerp(1130, 850, (tt - 4.0) / 2.4), 575, (tt - 23.4) / 0.8);
  if (t > 3.2) proGuard(ax, 470, 1.6, beating ? Math.max(hitK(D.hits[0]), hitK(D.hits[2]), hitK(D.ko - 0.2)) : 0.15, -1, 'guard', gp(axf));
  if (t > 4.0) proGuard(bx2, 484, 1.6, beating ? hitK(D.hits[1]) : 0.15, -1, 'guard', gp(bxf));
  if (t > 3.6) { proGuard(hxh, 462, 1.6, 0, -1, 'herald', gp(hxf)); if (t > 5.8 && t < 23.6) proScroll(hxh - 10, 352, Math.min(10, (t - 5.8) / 0.75), t); }
  // the hero's health: a sliver
  if (t > 23.4) { ctx.save(); ctx.globalAlpha = Math.min(1, (t - 23.4) * 2); hudPanel(20, 470, 220, 50, { r: 10 }); ctx.fillStyle = '#c9a0a0'; ctx.font = 'bold 12px "Segoe UI", sans-serif'; ctx.textAlign = 'left'; ctx.fillText('HP', 38, 490); ctx.fillStyle = '#2a1010'; ctx.fillRect(38, 498, 184, 12); ctx.fillStyle = (Math.sin(t * 9) > 0 ? '#ff5a5a' : '#c03030'); ctx.fillRect(38, 498, 2.5, 12); ctx.fillStyle = '#fff'; ctx.textAlign = 'right'; ctx.fillText('1 / 100', 222, 490); ctx.restore(); }
  ctx.save(); const vg = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 620); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.65)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H); ctx.restore();
  if (t > 1 && Math.floor(t * 0.7) !== Math.floor((t - 0.016) * 0.7)) sfx('step');
}
const RIVER_WY = 352, RIVER_EDGE = 400;
function proRiverRig(t) {                                                         // where the guards are and where their hands are, at time t (shared by the physics and the drawing)
  const T = PRO_CINE.river, cl = (v) => Math.max(0, Math.min(1, v)), ez = k => k * k * (3 - 2 * k), carryX = -130 + (215 + 130) * cl((t - 1.5) / 6.5);
  let hx = 30, hy = -46, lean = 0; const w0 = T.throwAt - 2.0, w1 = T.throwAt - 0.7, r0 = T.throwAt + 1.3;
  if (t > w0 && t <= w1) { const k = ez(cl((t - w0) / (w1 - w0))); hx = 30 - 12 * k; hy = -46 + 10 * k; lean = -0.26 * k; }
  else if (t > w1 && t <= T.throwAt) { const k = ez(cl((t - w1) / (T.throwAt - w1))); hx = 18 + 28 * k; hy = -36 - 38 * k; lean = -0.26 + 0.6 * k; }
  else if (t > T.throwAt && t <= r0) { const k = ez(cl((t - T.throwAt) / 1.3)); hx = 46 - 16 * k; hy = -74 + 28 * k; lean = 0.34 - 0.34 * k; }
  else if (t > r0) { const k = ez(cl((t - r0) / 0.9)); hx = 30 - 22 * k; hy = -46 + 12 * k; }                 // the arms come down: it is done
  const walkStart = T.throwAt + 4.6, away = Math.max(0, t - walkStart) * 62, after = t > r0;
  const ax = carryX - 80 - away, bx = carryX + 98 - away, hxB = after ? hx : 60 - hx, leaving = t > walkStart;
  return { carryX, ax, bx, hx, hy, lean, hxB, handA: [ax + hx * 1.4 + 6, 300 + hy * 1.4], handB: [bx - hxB * 1.4 - 6, 300 + hy * 1.4], walking: (t > 1.5 && t < 8.0) || leaving, faceA: leaving ? -1 : 1, faceB: leaving ? -1 : (after ? 1 : -1), leaving };
}
const RAG_NAMES = ['H', 'N', 'P', 'K1', 'F1', 'K2', 'F2', 'E1', 'W1', 'E2', 'W2'];
const RAG_LINKS = [['H', 'N', 15], ['N', 'P', 44], ['P', 'K1', 24], ['K1', 'F1', 24], ['P', 'K2', 24], ['K2', 'F2', 24], ['N', 'E1', 16], ['E1', 'W1', 16], ['N', 'E2', 17], ['E2', 'W2', 16], ['H', 'P', 50]];
function proRagInit(rig) {                                                        // a limp body, laid out between the two pairs of hands
  const [ax, ay] = rig.handA, [bx, by] = rig.handB, rag = { p: {}, pinned: true, splash: null, parts: [], ripple: 0, t: 0 };
  const at = (k, dy = 0) => ({ x: ax + (bx - ax) * k, y: ay + (by - ay) * k + dy });
  const lay = { H: at(-0.16, 6), N: at(0), P: at(0.5, 14), K1: at(0.75, 12), F1: at(1, 0), K2: at(0.75, 16), F2: at(1, 2), E1: at(0.1, 18), W1: at(0.12, 34), E2: at(0.05, 16), W2: at(0.06, 32) };
  for (const n of RAG_NAMES) rag.p[n] = { x: lay[n].x, y: lay[n].y, px: lay[n].x, py: lay[n].y };
  return rag;
}
function proRagStep(rag, rig, t, dt) {
  const T = PRO_CINE.river, P = rag.p, g = 1000, subs = Math.max(1, Math.ceil(dt / 0.008)), h = dt / subs;
  for (let s2 = 0; s2 < subs; s2++) {
    if (rag.pinned && t >= T.throwAt) {                                              // the throw: let go, with the swing of the guards behind it
      rag.pinned = false; const vx = 300, vy = -280;
      for (const n of RAG_NAMES) { P[n].px = P[n].x - vx * h; P[n].py = P[n].y - vy * h; }
    }
    for (const n of RAG_NAMES) {
      const q = P[n], wet = q.y > RIVER_WY; let vx = (q.x - q.px) * (wet ? 0.9 : 0.999), vy = (q.y - q.py) * (wet ? 0.9 : 0.999);
      if (wet) vx += (30 * h - vx) * 0.12;                                       // the current carries him, slowly
      q.px = q.x; q.py = q.y; q.x += vx; q.y += vy + (wet ? -1700 * Math.min(1, (q.y - RIVER_WY) / 10) : 0) * h * h + g * h * h;
      if (wet) { if (!rag.splash) { rag.splash = { x: q.x, t: rag.t, v: Math.abs(vy) / h }; for (let i = 0; i < 26; i++) rag.parts.push({ x: q.x + (Math.random() - 0.5) * 30, y: RIVER_WY, vx: (Math.random() - 0.5) * 220, vy: -120 - Math.random() * 260, life: 1 }); rag.hit = true; } }
      if (q.x < RIVER_EDGE + 2 && q.y > 296 && !rag.pinned) { q.y = 296; q.px = q.x - (q.x - q.px) * 0.5; }              // the stone is hard
      if (q.x < RIVER_EDGE + 8 && q.x > RIVER_EDGE - 10 && q.y > 296 && q.py < 296 && !rag.pinned) { q.x = RIVER_EDGE + 8; }
    }
    for (let it = 0; it < 7; it++) {
      for (const [a2, b2, len] of RAG_LINKS) { const A = P[a2], B = P[b2], dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1, k = a2 === 'H' && b2 === 'P' ? (d < len ? (d - len) / d * 0.5 : 0) : (d - len) / d * 0.5; A.x += dx * k; A.y += dy * k; B.x -= dx * k; B.y -= dy * k; }
      if (rag.pinned) { P.N.x = rig.handA[0]; P.N.y = rig.handA[1]; P.F1.x = rig.handB[0]; P.F1.y = rig.handB[1] - 1; P.F2.x = rig.handB[0] + 4; P.F2.y = rig.handB[1] + 3; }
    }
    rag.t += h;
  }
  for (const q of rag.parts) { q.life -= dt * 1.4; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 700 * dt; }
  rag.parts = rag.parts.filter(q => q.life > 0 && q.y < RIVER_WY + 20);
}
function proDrawRag(rag, t) {
  const P = rag.p, L = (a, b, w, col) => proLimb(P[a].x, P[a].y, P[b].x, P[b].y, w, col || '#d2cdbd');
  L('N', 'E2', 4.5, '#b9b3a5'); L('E2', 'W2', 4.5, '#b9b3a5'); L('P', 'K2', 5, '#b9b3a5'); L('K2', 'F2', 5, '#b9b3a5');
  L('N', 'P', 7); L('P', 'K1', 5.5); L('K1', 'F1', 5.5); L('N', 'E1', 4.8); L('E1', 'W1', 4.8);
  ctx.strokeStyle = 'rgba(150,10,12,0.9)'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(P.N.x * 0.7 + P.P.x * 0.3, P.N.y * 0.7 + P.P.y * 0.3); ctx.lineTo(P.N.x * 0.45 + P.P.x * 0.55, P.N.y * 0.45 + P.P.y * 0.55); ctx.stroke();
  const ang = Math.atan2(P.H.y - P.N.y, P.H.x - P.N.x);
  ctx.save(); ctx.translate(P.H.x, P.H.y); ctx.rotate(ang + Math.PI); ctx.fillStyle = '#f3efe4'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.arc(0, 0, 12, 0, 6.3); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 1.7; ctx.beginPath(); ctx.arc(2, 5, 4.5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); ctx.fillStyle = 'rgba(160,12,12,0.92)'; ctx.fillRect(-9, -3, 3, 11); ctx.beginPath(); ctx.arc(-5, -8, 2.6, 0, 6.3); ctx.fill(); ctx.restore();
}
function proDrawRiver(c, t) {
  const W = 960, H = 540, T = PRO_CINE.river, sky = ctx.createLinearGradient(0, 0, 0, 330); sky.addColorStop(0, '#080c1e'); sky.addColorStop(1, '#1c2646'); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, 330);
  for (let i = 0; i < 70; i++) { ctx.fillStyle = `rgba(255,255,255,${0.4 + 0.4 * Math.sin(t * 2 + i)})`; ctx.fillRect((i * 137) % W, (i * 53) % 260, 2, 2); }
  circ(760, 90, 34, '#e8ecf8');
  ctx.fillStyle = '#0c1220'; ctx.beginPath(); ctx.moveTo(0, 330); for (let x = 0; x <= W; x += 40) ctx.lineTo(x, 290 + Math.sin(x * 0.012) * 24); ctx.lineTo(W, 330); ctx.fill();
  const wg = ctx.createLinearGradient(0, 330, 0, H); wg.addColorStop(0, '#1d3a5a'); wg.addColorStop(1, '#0c1c30'); ctx.fillStyle = wg; ctx.fillRect(0, 330, W, 210);
  ctx.strokeStyle = 'rgba(200,220,255,0.18)'; ctx.lineWidth = 2; for (let i = 0; i < 22; i++) { const y = 340 + (i * 29) % 190, x = ((i * 91 + t * (24 + i)) % (W + 120)) - 60; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 24, y - 4, x + 48, y); ctx.stroke(); }
  ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#e8ecf8'; for (let i = 0; i < 6; i++) ctx.fillRect(742 + Math.sin(t * 2 + i) * 8, 340 + i * 18, 36 - i * 4, 3); ctx.restore();
  ctx.fillStyle = '#4a4a56'; ctx.fillRect(0, 300, RIVER_EDGE, 240); ctx.fillStyle = '#5c5c6a'; ctx.fillRect(0, 292, RIVER_EDGE, 14); ctx.fillStyle = '#3a3a46'; ctx.fillRect(RIVER_EDGE - 8, 292, 10, 250); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2; for (let y = 320; y < 540; y += 36) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(RIVER_EDGE - 8, y); ctx.stroke(); }
  ctx.fillStyle = '#3a2a1a'; ctx.fillRect(372, 236, 8, 56); ctx.fillStyle = '#ff9a2a'; ctx.beginPath(); ctx.arc(376, 232, 8 + Math.sin(t * 12) * 1.5, 0, 6.3); ctx.fill();
  const rig = proRiverRig(t), rag = pro.rag;
  proGuard(rig.ax, 300, 1.4, { hx: rig.hx, hy: rig.hy, lean: rig.lean }, rig.faceA, 'guard', rig.walking ? t * 7.5 : undefined);
  if (rag) proDrawRag(rag, t);
  proGuard(rig.bx, 300, 1.4, { hx: rig.hxB, hy: rig.hy, lean: rig.faceB < 0 ? -rig.lean : rig.lean }, rig.faceB, 'guard', rig.walking ? t * 7.5 + 0.5 : undefined);
  if (rag && rag.splash) {                                                         // ripples and spray where he went in, and a trail as he drifts
    const sx = rag.splash.x, age = rag.t - rag.splash.t; for (let r = 0; r < 3; r++) { const rr = (age * 50 + r * 24) % 100; ctx.strokeStyle = `rgba(200,225,255,${0.55 * (1 - rr / 100)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(Math.max(sx, rag.p.P.x), RIVER_WY + 6, rr, rr * 0.28, 0, 0, 6.3); ctx.stroke(); }
    ctx.fillStyle = 'rgba(215,232,255,0.85)'; for (const q of rag.parts) { ctx.beginPath(); ctx.arc(q.x, q.y, 2.6 * q.life + 0.6, 0, 6.3); ctx.fill(); }
  }
  ctx.save(); const vg = ctx.createRadialGradient(W / 2, H / 2, 240, W / 2, H / 2, 640); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H); ctx.restore();
}
