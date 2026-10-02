// Village: a safe, living settlement between wave 9 and the boss of every set.
// It is its own game state ('village'), so none of the wave / enemy / biome code runs inside it. The biome world
// (`world`, `enemies`, `wave`...) is left exactly as it was and play resumes where it stopped.
// villagers.js holds the drawing; this file holds the layout, villager routines, hero control, shops and saving.

const VIL_W = 1800, VIL_H = 1000, VIL_ROAD = 548, VIL_LANE = 905;
const VIL_ZOOM = 1.5;           // the village is drawn this much bigger than the battlefield, so people and buildings read clearly
let vil = null;                 // the village being visited, or null
let villageSkip = -1;           // boss wave whose village was already visited (it only appears once per set)
let curNight = 0;               // 0 day .. 1 night, refreshed every frame so the art closures can read it

const VIL_STYLE = {             // the look of the village follows the biome it sits in
  forest:    { name: 'Hollowbrook Hamlet',   wall: '#d9c7a0', roofs: ['#a4483a', '#7a4a2e', '#5b7a3a'], trim: '#5b3f2a', dirt: '#9a7b52', trees: ['oak', 'oak', 'birch', 'bush'] },
  desert:    { name: 'Sunmark Oasis',        wall: '#ead4a0', roofs: ['#b5532f', '#2f7f86', '#c98d3a'], trim: '#7a5a34', dirt: '#b89868', trees: ['palm', 'palm', 'cactus', 'sandstone'] },
  snow:      { name: 'Frostwatch Outpost',   wall: '#d3dbe2', roofs: ['#4a6a8a', '#7a3b3b', '#3c5a6e'], trim: '#4a4038', dirt: '#8a8478', trees: ['pine', 'pine', 'smallpine', 'icerock'] },
  volcano:   { name: 'Emberforge Camp',      wall: '#7a625a', roofs: ['#2f2a2e', '#7a2f1f', '#4a3a3a'], trim: '#2a1f1d', dirt: '#5a4540', trees: ['chartree', 'chartree', 'obsidian'] },
  swamp:     { name: 'Mirewick Stilts',      wall: '#b0a07a', roofs: ['#4d6a3a', '#6a5a3a', '#3a5a50'], trim: '#3f3422', dirt: '#6a5a40', trees: ['swamptree', 'swamptree', 'mushroom'] },
  jungle:    { name: 'Canopy Rest',          wall: '#cdbd8c', roofs: ['#3f8a4a', '#a0623a', '#2f6a5a'], trim: '#5a3e22', dirt: '#8a6a40', trees: ['jungletree', 'jungletree', 'banana', 'flowerbush'] },
  ruins:     { name: 'Gravemoor Refuge',     wall: '#a09ea8', roofs: ['#4a4660', '#5a3a4a', '#3a4250'], trim: '#38333f', dirt: '#6a6660', trees: ['deadtree', 'rubble', 'statue'] },
  highlands: { name: 'Windholm',             wall: '#c2baa6', roofs: ['#6a5a44', '#7a4a3a', '#4a5a6a'], trim: '#4a3f33', dirt: '#8a8070', trees: ['alpinepine', 'alpinepine', 'alpinebush', 'cairn'] },
};

// ---------------------------------------------------------------- what gold buys
const LAMPS = [null,
  { name: 'Brass Lantern',    bonus: 40,  cost: 140 },
  { name: "Hunter's Lantern", bonus: 80,  cost: 420 },
  { name: 'Radiant Lantern',  bonus: 130, cost: 1000 },
];
const POTION_HEAL = 0.45, POTION_MAX = 15;                  // up to 15 of each kind
// Potions come in kinds. Q drinks the one you have selected, R switches. Add a kind here (and what it does in drinkPotion) to add a potion.
const POTIONS = {
  heal: { name: 'Healing Potion', short: 'Heal', color: '#d9534f', field: 'potions' },
  cure: { name: 'Cure-All Potion', short: 'Cure', color: '#4fd69c', field: 'cures' },
};
const POTION_KEYS = Object.keys(POTIONS);
const potionCount = k => (hero && hero[POTIONS[k].field]) | 0;
const potionCost = () => Math.round(22 + wave * 2.2);
const cureCost = () => Math.round(30 + wave * 2.8);
// every harmful effect on the hero that a Cure-All removes. New ailments (bleed, burn, weakness...) go here.
const hasAilment = () => !!(hero.poison || hero.chillT > 0);
function cureAilments() { clearPoison(); hero.chillT = 0; }
function applyLamp() { hero.lightBonus = (LAMPS[hero.lamp | 0] || { bonus: 0 }).bonus; }

function potionSay(text, color) { popups.push({ text, x: VW / 2, y: VH - 112, t: 1.4, screen: true, small: true, color }); }
function switchPotion() {
  if (!hero || hero.dead || paused || (state !== 'play' && state !== 'village')) return;
  const prev = hero.potionSel;
  hero.potionSel = POTION_KEYS[(POTION_KEYS.indexOf(hero.potionSel) + 1) % POTION_KEYS.length];
  const P = POTIONS[hero.potionSel];
  hero.potionAnim = { from: prev, to: hero.potionSel, t0: tAnim };
  sfx('switch'); potionSay(`${P.name}: ${potionCount(hero.potionSel)}`, P.color);
}
function drinkPotion() {
  if (!hero || hero.dead || paused || (state !== 'play' && state !== 'village')) return;
  const kind = POTIONS[hero.potionSel] ? hero.potionSel : 'heal', P = POTIONS[kind];
  if (potionCount(kind) <= 0) { potionSay(`No ${P.name}s left`, '#f88'); sfx('tired'); return; }
  if (kind === 'heal' && hero.hp >= hero.maxHp) { potionSay('Already at full health', '#ccc'); return; }
  if (kind === 'cure' && !hasAilment()) { potionSay('Nothing to cure', '#ccc'); return; }
  if ((hero.potionCd || 0) > 0) return;
  hero[P.field]--; hero.potionCd = 1;
  if (kind === 'heal') {
    const heal = Math.round(hero.maxHp * POTION_HEAL);
    hero.hp = Math.min(hero.maxHp, hero.hp + heal);
    potionSay(`+${heal} HP`, '#7fd08a');
  } else { cureAilments(); potionSay('Cured!', P.color); }
  sfx('potion');
  if (state === 'play') burst(hero.x, hero.y - 30, P.color, 14, 90, 3, -30, true);
}

// One potion slot beside the health bar. Switching slides the old bottle out and the new one in (and spins them a little), instead of showing both.
function drawFlask(kind, cx, cy, alpha, scale, rot, empty) {
  const P = POTIONS[kind];
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(scale, scale); ctx.globalAlpha *= alpha;
  ctx.fillStyle = empty ? '#3c3a46' : P.color; ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-3, -11); ctx.lineTo(3, -11); ctx.lineTo(3, -5); ctx.lineTo(10, 8); ctx.quadraticCurveTo(10, 11, 7, 11); ctx.lineTo(-7, 11); ctx.quadraticCurveTo(-10, 11, -10, 8); ctx.lineTo(-3, -5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(-5, 6); ctx.lineTo(-2, -1); ctx.lineTo(-1, 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d8cdb0'; ctx.fillRect(-3.5, -14, 7, 4);                                    // the cork
  ctx.restore();
}
function drawPotionSlot(x, cy) {
  const w = 40, h = 40, y = cy - h / 2, sel = POTIONS[hero.potionSel] ? hero.potionSel : 'heal', P = POTIONS[sel], n = potionCount(sel);
  hudPanel(x, y, w, h, { r: 12, edge: withAlpha(P.color, 0.6) });
  const an = hero.potionAnim, k = an ? clamp01((tAnim - an.t0) / 0.32) : 1, mid = x + w / 2, my = cy - 1;
  ctx.save(); ctx.beginPath(); ctx.roundRect(x + 1.5, y + 1.5, w - 3, h - 3, 10.5); ctx.clip();
  if (gfx.glow) { const gr = ctx.createRadialGradient(mid, my, 2, mid, my, 24); gr.addColorStop(0, withAlpha(P.color, n ? 0.28 : 0.08)); gr.addColorStop(1, withAlpha(P.color, 0)); ctx.fillStyle = gr; ctx.fillRect(x, y, w, h); }
  if (an && k < 1) {
    const e = 1 - Math.pow(1 - k, 3);
    drawFlask(an.from, mid, my - e * 26, 1 - e, 1 - e * 0.35, -e * 0.9, potionCount(an.from) <= 0);
    drawFlask(an.to, mid, my + (1 - e) * 26, e, 0.65 + e * 0.35, (1 - e) * 0.9, n <= 0);
  } else drawFlask(sel, mid, my, 1, 1, 0, n <= 0);
  ctx.restore();
  ctx.textAlign = 'right'; const t = fitText(String(n), 26, 11, true, 8);
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(t, x + w - 5, y + h - 5); ctx.fillStyle = n ? '#fff' : '#f88'; ctx.fillText(t, x + w - 5, y + h - 5);
  ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = `bold 8px ${UI_FONT}`; ctx.fillText('Q', x + 5, y + 10);
  ctx.textAlign = 'center'; ctx.fillStyle = '#7d7b92'; ctx.font = `8.5px ${UI_FONT}`; ctx.fillText('R switch', mid, y + h + 10); ctx.textAlign = 'left';
}

// Stat reset (innkeeper): pay gold to take back every spent stat point and spend them again.
const respecCost = () => 40 + hero.level * 20;
const spentPoints = () => Object.values(hero.stats).reduce((a, b) => a + (b | 0), 0);
function respecStats() {
  const n = spentPoints(), cost = respecCost();
  if (n <= 0 || hero.gold < cost) return false;
  hero.gold -= cost; hero.goldPulse = 0.6;
  hero.points += n;
  hero.maxHp = Math.max(1, hero.maxHp - VIT_HP * (hero.stats.hp | 0));        // Vitality is the only thing that raised max HP
  hero.stats = newStats();
  syncRebirthHp();
  hero.hp = Math.min(hero.hp, hero.maxHp); hero.stamina = Math.min(hero.stamina, maxStamina());
  saveGame(true, true);
  return true;
}

// ---------------------------------------------------------------- collision (circle vs rectangles and circles)
function vilOverlaps(v, x, y, r, eps = 0.6, hero = false) {
  for (const s of (hero && v.solidsH) || v.solids) {
    if (s.r !== undefined) { if (Math.hypot(x - s.x, y - s.y) < s.r + r - eps) return true; }
    else { const cx = Math.max(s.x0, Math.min(x, s.x1)), cy = Math.max(s.y0, Math.min(y, s.y1)); if (Math.hypot(x - cx, y - cy) < r - eps) return true; }
  }
  return false;
}
// Moves a circle (radius r) out of every solid. (ox, oy) is where it was before the move: if the push-out can't
// find a free spot (a tight pocket between obstacles) the old, known-good position is kept instead.
function vilCollide(v, x, y, r, ox, oy, hero = false) {
  const solids = (hero && v.solidsH) || v.solids;
  for (let it = 0; it < 6; it++) {
    for (const s of solids) {
      if (s.r !== undefined) {
        const dx = x - s.x, dy = y - s.y, d = Math.hypot(dx, dy), m = s.r + r;
        if (d < m) { if (d < 0.001) x += m; else { x = s.x + dx / d * m; y = s.y + dy / d * m; } }
      } else {
        const cx = Math.max(s.x0, Math.min(x, s.x1)), cy = Math.max(s.y0, Math.min(y, s.y1));
        const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
        if (d2 < r * r) {
          if (d2 > 1e-6) { const d = Math.sqrt(d2); x = cx + dx / d * r; y = cy + dy / d * r; }
          else {                                              // centre is inside the box: leave by the shortest way
            const l = x - s.x0, rr = s.x1 - x, t = y - s.y0, b = s.y1 - y, m = Math.min(l, rr, t, b);
            if (m === l) x = s.x0 - r; else if (m === rr) x = s.x1 + r; else if (m === t) y = s.y0 - r; else y = s.y1 + r;
          }
        }
      }
    }
  }
  x = Math.max(24, Math.min(VIL_W - 24, x)); y = Math.max(112, Math.min(VIL_H - 24, y));
  if (ox !== undefined && vilOverlaps(v, x, y, r, 0.6, hero) && !vilOverlaps(v, ox, oy, r, 0.6, hero)) return { x: ox, y: oy };
  return { x, y };
}

// ---------------------------------------------------------------- building the village
// Every village is laid out fresh: the shop row and the yards below the road are shuffled, the gate can be on either
// side, and the small things (clutter, benches, lamps, trees) are rolled too. People and routines are placed from the
// buildings and props they belong to, so any arrangement works.
const SHOP_ROW = {                                     // the row north of the road: every door faces south
  inn:     { w: 240, wh: 78, rh: 50, sign: 'inn', flowers: true },
  alch:    { w: 170, wh: 68, rh: 44, sign: 'flask' },
  store:   { w: 190, wh: 70, rh: 46, sign: 'sack' },
  armoury: { w: 190, wh: 72, rh: 46, sign: 'shield' },
  jewel:   { w: 160, wh: 64, rh: 42, sign: 'gem', flowers: true },
};
const YARD_W = { garden: 230, lawn: 430, smith: 300, wood: 310 };       // widths of the yards south of the road

function buildVillage() {
  const B = BIOMES[zone % BIOMES.length], st = VIL_STYLE[B.key] || VIL_STYLE.forest;
  const seed = (Math.random() * 1e9) | 0, r = mulberry(seed);
  const E = r() < 0.5 ? 1 : -1;                          // the gate is on the east (1) or west (-1) side; you arrive from the other
  const v = {
    B, st, seed, E, name: st.name, t: 0, fade: 1, leaveT: 0, solids: [], hsolids: [], statics: [], buildings: [], b: {}, npcs: [], animals: [], hens: [],
    fx: [], plants: [], lamps: [], keep: [], patches: [], stock: { potion: 3 + Math.floor(Math.random() * 5), cure: 2 + Math.floor(Math.random() * 3) },
    near: null, talk: null, shop: null, kidMode: 'ball', kidT: 25, tag: { it: 0, imm: 0 }, kickCd: 0, chaseT: 0, chaser: null, lastKicker: null,
    stats: { stuck: 0, snaps: 0 }, smokeT: 0, soundT: 0, doneLeave: false,
  };
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const rect = (x0, y0, x1, y1) => v.solids.push({ x0, y0, x1, y1 });
  const circle = (x, y, rr) => v.solids.push({ x, y, r: rr });
  const add = (y, d) => v.statics.push({ y, d });
  const prop = (kind, x, y, extra = {}) => { const p = { x, y, ...extra }; add(extra.sy ?? y, () => VPROP[kind](p, curNight > 0.45)); return p; };
  const keep = (x0, y0, x1, y1) => v.keep.push([x0, y0, x1, y1]);
  const patch = (x, y, rx, ry, col, a, dots) => v.patches.push({ x, y, rx, ry, col, a, dots });
  const CX = VIL_W / 2;

  // ---- buildings: doors face south ----
  const mkB = (id, x, y, w, wh, rh, extra = {}) => {
    const b = { id, x, y, w, wh, rh, wall: st.wall, trim: st.trim, roof: st.roofs[v.buildings.length % st.roofs.length], ...extra };
    b.door = { x: x + (b.doorX || 0), y: y + 22 };
    b.chim = { x: x + w * 0.26 + 7, y: y - wh - rh - 10 };
    v.buildings.push(b); v.b[id] = b;
    rect(x - w / 2, y - 40, x + w / 2, y);
    add(y, () => drawBuilding(b, curNight > 0.45, curNight > 0.45));
    return b;
  };
  // north row: five shops in a random order
  const order = shuffle(Object.keys(SHOP_ROW));
  const sumW = order.reduce((a, k) => a + SHOP_ROW[k].w, 0), gapN = (VIL_W - 260 - sumW) / (order.length - 1);
  let cursor = 130;
  for (const id of order) { const s = SHOP_ROW[id]; mkB(id, cursor + s.w / 2, 336 + Math.floor(r() * 24), s.w, s.wh, s.rh, { sign: s.sign, flowers: s.flowers }); cursor += s.w + gapN; }
  v.shopOrder = order;
  const { alch, store, armoury, jewel } = v.b;

  // ---- shop counters and a bit of clutter at the left corner of every shop ----
  const counter = (b, w, kind, awn) => {
    const p = { x: b.x, y: b.y + 58, w, kind, awn };
    add(p.y, () => VPROP.counter(p)); rect(p.x - w / 2, p.y - 14, p.x + w / 2, p.y + 4);
    v.hsolids.push({ x0: p.x - w / 2 - 20, y0: b.y + 2, x1: p.x - w / 2, y1: p.y + 4 }, { x0: p.x + w / 2, y0: b.y + 2, x1: p.x + w / 2 + 20, y1: p.y + 4 });   // the shopkeeper's side of the counter is closed to you
  };
  counter(alch, 110, 'alch', '#6a4fb0'); counter(store, 124, 'store', '#c0392b'); counter(armoury, 120, 'armour', '#2f6aa8'); counter(jewel, 100, 'jewel', '#2f8a6a');
  const barrel = (x, y, o = {}) => { prop('barrel', x, y, o); circle(x, y - 4, 11); };
  const crates = (x, y) => { prop('crates', x, y); rect(x - 20, y - 14, x + 19, y + 1); };
  for (const id of order) {
    const b = v.b[id], lx = b.x - b.w / 2 - 22, k = Math.floor(r() * 3);
    if (k === 0) { barrel(lx, b.y + 50); barrel(lx + 18, b.y + 58); }
    else if (k === 1) crates(lx - 2, b.y + 56);
    else { prop('hay', lx, b.y + 66); circle(lx, b.y + 61, 20); }
  }

  // ---- plaza: well, benches, notice board (their sides are rolled) ----
  const plaza = { x: CX, y: 505, rx: 215, ry: 80 };
  v.plaza = plaza;
  prop('well', plaza.x, plaza.y); circle(plaza.x, plaza.y - 4, 27);
  const sA = r() < 0.5 ? 1 : -1;
  const doors = v.buildings.filter(b => b.y < VIL_ROAD).map(b => b.door.x);
  const clearOfDoors = x => { for (let i = 0; i < 8; i++) { const d = doors.find(dx => Math.abs(dx - x) < 56); if (!d) break; x += (x >= d ? 1 : -1) * (58 - Math.abs(x - d)); } return x; };
  const bax = clearOfDoors(plaza.x + sA * 140), bbx = clearOfDoors(plaza.x - sA * 140), brx = clearOfDoors(plaza.x + sA * 250);
  const benchA = prop('bench', bax, 484); rect(bax - 29, 484 - 24, bax + 29, 484 - 4);
  const benchB = prop('bench', bbx, 484); rect(bbx - 29, 484 - 24, bbx + 29, 484 - 4);
  const board = prop('board', brx, 505); rect(brx - 28, 505 - 14, brx + 28, 505);
  v.board = board; v.benchA = benchA; v.benchB = benchB;
  keep(board.x - 50, 440, board.x + 50, 560);

  // ---- the gate on one end of the road, a welcome sign at the other ----
  const gate = { x: E > 0 ? VIL_W - 52 : 52, y: VIL_ROAD + 8 };
  v.gate = gate;
  prop('gate', gate.x, gate.y); rect(gate.x - 52, gate.y - 12, gate.x - 34, gate.y + 2); rect(gate.x + 34, gate.y - 12, gate.x + 52, gate.y + 2);
  const wx = E > 0 ? 150 : VIL_W - 150;
  prop('welcome', wx, 502, { text: st.name }); circle(wx, 500, 5);
  v.arrive = { x: E > 0 ? 112 : VIL_W - 112, y: VIL_ROAD + 4 };

  // ---- the Shrine of Return (rebirth): north of the plaza, clear of the shop doors and the furniture ----
  {
    const avoid = [...doors.map(d => [d, 84]), [benchA.x, 90], [benchB.x, 90], [board.x, 90], [plaza.x, 66], [gate.x, 150]];
    let sx = null;
    for (let dx = 0; dx <= 760 && sx === null; dx += 10) for (const sg of [1, -1]) {
      const x = plaza.x + sg * dx;
      if (x < 190 || x > VIL_W - 190 || avoid.some(([a, m]) => Math.abs(x - a) < m)) continue;
      sx = x; break;
    }
    if (sx === null) sx = plaza.x + (sA > 0 ? -330 : 330);
    v.shrine = prop('shrine', sx, 462, { glow: 0 }); rect(sx - 34, 462 - 18, sx + 34, 462 + 2);
    keep(sx - 80, 380, sx + 80, 500);
  }

  // ---- the yards south of the road, in a random order ----
  const YARDS = {
    garden(ox) {                                         // Old Pim's garden, his house and a clothesline
      mkB('houseA', ox + 115, 835, 150, 62, 40, { flowers: true });
      const G = { x0: ox + 20, y0: 585, x1: ox + 210, y1: 700, gapY0: 621, gapY1: 661, gapAt: ox + 115 < plaza.x ? 'E' : 'W' };
      v.garden = G;
      prop('fence', G.x0, G.y0 + 5, { len: G.x1 - G.x0 }); rect(G.x0, G.y0 - 4, G.x1, G.y0 + 6);
      prop('fence', G.x0, G.y1 + 5, { len: G.x1 - G.x0 }); rect(G.x0, G.y1 - 2, G.x1, G.y1 + 8);
      const wallX = G.gapAt === 'E' ? G.x0 : G.x1, gapX = G.gapAt === 'E' ? G.x1 : G.x0;          // one side is closed, the other has the opening
      prop('fenceV', wallX, G.y0 + 20, { len: G.y1 - G.y0 - 20, sy: (G.y0 + G.y1) / 2 }); rect(wallX - 5, G.y0, wallX + 5, G.y1 + 6);
      prop('fenceV', gapX, G.y0 + 20, { len: G.gapY0 - G.y0 - 20, sy: G.y0 + 30 }); rect(gapX - 5, G.y0, gapX + 5, G.gapY0);
      prop('fenceV', gapX, G.gapY1 + 22, { len: G.y1 - G.gapY1 - 22, sy: G.y1 - 6 }); rect(gapX - 5, G.gapY1, gapX + 5, G.y1 + 6);
      keep(G.x0 - 60, G.y0 - 30, G.x1 + 60, G.y1 + 30);
      for (let row = 0; row < 2; row++) for (let i = 0; i < 6; i++) {
        const p = { x: G.x0 + 30 + i * 26, y: G.y0 + (row ? 87 : 27), kind: (i + row * 2 + (v.seed % 3)) % 4, g: 0.35 + r() * 0.5, wet: 0, ph: r() * 6.28, c: i };
        v.plants.push(p); add(p.y, () => drawPlant(p));
      }
      prop('line', ox + 10, 765, { len: 200 }); circle(ox + 10, 763, 4); circle(ox + 210, 763, 4);
      keep(ox - 15, 700, ox + 230, 790);
    },
    lawn(ox) {                                           // the kids' lawn, a house and the chicken yard
      mkB('houseB', ox + 180, 835, 150, 62, 40);
      v.lawn = { x0: ox + 25, y0: 618, x1: ox + 285, y1: 745 };
      keep(ox, 590, ox + 320, 775);
      prop('coop', ox + 342, 800); rect(ox + 318, 774, ox + 366, 800);
      v.yard = { x0: ox + 275, y0: 836, x1: ox + 405, y1: 892 };
      keep(ox + 250, 770, ox + 430, 900);
      patch(ox + 155, 682, 190, 90, B.grass[1], 0.55);
      patch(ox + 348, 862, 95, 50, '#c8a85a', 0.55, { n: 90, rx: 80, ry: 40, cols: ['#d8bc68', '#b89848'], w: 3, h: 1 });
    },
    smith(ox) {                                          // Brann's forge: smithy, forge, anvil, quench barrel and a weapon rack
      mkB('smith', ox + 110, 835, 210, 70, 44, { sign: 'anvil' });
      v.forge = prop('forge', ox + 252, 836); rect(ox + 224, 802, ox + 280, 838);
      v.anvil = prop('anvil', ox + 178, 892, { hot: 0 }); circle(ox + 178, 888, 12);
      prop('barrel', ox + 82, 888, { water: true }); circle(ox + 82, 884, 11);
      v.rack = prop('rack', ox + 22, 884); rect(ox + 2, 868, ox + 44, 886);
      keep(ox - 10, 800, ox + 300, 925);
      patch(ox + 178, 884, 100, 46, '#1e1a18', 0.6);
    },
    wood(ox) {                                           // Rurik's woodcutter yard and house
      mkB('houseC', ox + 190, 700, 130, 60, 38, { flowers: true });
      v.stump = prop('stump', ox + 100, 792, { split: 0 }); circle(ox + 100, 788, 13);
      v.logs = prop('logs', ox + 38, 852, { n: 6 }); rect(ox + 10, 838, ox + 66, 854);
      v.stack = prop('stack', ox + 258, 850, { n: 4 }); rect(ox + 224, 812, ox + 294, 852);
      keep(ox, 740, ox + 305, 915);
      patch(ox + 135, 820, 165, 90, '#c9a972', 0.5, { n: 120, rx: 140, ry: 76, cols: ['#e6cf9c', '#b99863'], w: 3, h: 1.5 });
    },
  };
  const yorder = shuffle(Object.keys(YARDS));
  const sumY = yorder.reduce((a, k) => a + YARD_W[k], 0), gapS = (VIL_W - 300 - sumY) / (yorder.length - 1);
  cursor = 150; v.yardOrder = yorder;
  for (const k of yorder) { YARDS[k](cursor); cursor += YARD_W[k] + gapS; }
  for (const b of v.buildings) {                         // keep trees off the doors and their paths
    if (b.y < VIL_ROAD) keep(b.x - b.w / 2 - 30, b.y - 140, b.x + b.w / 2 + 30, VIL_ROAD + 50);
    else keep(b.x - b.w / 2 - 30, b.y - 140, b.x + b.w / 2 + 30, VIL_LANE + 40);
  }

  // ---- lamp posts along the road and round the plaza ----
  const lampAt = (x, y) => { prop('lamp', x, y); circle(x, y - 3, 5); v.lamps.push({ x: x + 9, y: y - 46 }); };
  for (let x = 190; x < VIL_W - 150; x += 170) if (Math.abs(x - plaza.x) > plaza.rx + 20 && Math.abs(x - gate.x) > 150) lampAt(x + Math.floor(r() * 30), 520);
  lampAt(plaza.x - 120, 570); lampAt(plaza.x + 120, 570);

  // ---- roads and plazas stay clear of trees ----
  keep(0, VIL_ROAD - 55, VIL_W, VIL_ROAD + 55); keep(95, VIL_ROAD, 145, VIL_LANE + 25); keep(VIL_W - 145, VIL_ROAD, VIL_W - 95, VIL_LANE + 25);
  keep(95, VIL_LANE - 28, VIL_W - 95, VIL_LANE + 28); keep(plaza.x - plaza.rx - 20, plaza.y - plaza.ry - 20, plaza.x + plaza.rx + 20, plaza.y + plaza.ry + 20);
  keep(E > 0 ? VIL_W - 105 : 0, 470, E > 0 ? VIL_W : 105, 640);

  // ---- trees and rocks: a ring around the village and a few inside ----
  const kinds = st.trees.filter(k => PROP_ART[k]);
  const okSpot = (x, y) => {
    for (const [x0, y0, x1, y1] of v.keep) if (x > x0 - 18 && x < x1 + 18 && y > y0 - 18 && y < y1 + 18) return false;
    return true;
  };
  let guard = 0;
  v.trees = [];
  while (v.trees.length < 84 && guard++ < 1100) {
    const edge = r() < 0.7;
    const x = edge ? (r() < 0.5 ? 20 + r() * (VIL_W - 40) : (r() < 0.5 ? 20 + r() * 90 : VIL_W - 110 + r() * 90)) : 30 + r() * (VIL_W - 60);
    const y = edge ? (r() < 0.55 ? 100 + r() * 95 : (r() < 0.5 ? 935 + r() * 55 : 130 + r() * 840)) : 130 + r() * 840;
    if (!okSpot(x, y) || v.trees.some(t => Math.hypot(t.x - x, t.y - y) < 46)) continue;
    const p = { k: kinds[Math.floor(r() * kinds.length)], x, y, s: 0.85 + r() * 0.5, v: r(), ph: r() * 6.28 };
    v.trees.push(p); add(y, () => drawProp(p));
    if (x > 56 && x < VIL_W - 56 && y > 135 && y < VIL_H - 56) circle(x, y - 2, 9 * Math.min(1.3, p.s));   // trees on the map edge are scenery only (the edge clamp would wedge the hero into them)
  }
  v.ground = bakeVillageGround(v);

  // ---- people ----
  makeNpcs(v);
  makeAnimals(v);
  v.ball = { x: (v.lawn.x0 + v.lawn.x1) / 2, y: 680, vx: 0, vy: 0, z: 0 };
  v.lawnC = { x: (v.lawn.x0 + v.lawn.x1) / 2, y: (v.lawn.y0 + v.lawn.y1) / 2 };
  makeStock(v);
  v.solidsH = v.solids.concat(v.hsolids);
  return v;
}

function bakeVillageGround(v) {
  const { B, st } = v, r = mulberry(v.seed ^ 0x9e3779b1), Z = VIL_ZOOM;
  const g = document.createElement('canvas'); g.width = Math.round(VIL_W * Z); g.height = Math.round(VIL_H * Z);       // baked at the zoom it is shown at, so it stays sharp
  const c = g.getContext('2d'); c.scale(Z, Z);
  c.fillStyle = B.ground; c.fillRect(0, 0, VIL_W, VIL_H);
  for (let i = 0; i < 200; i++) {
    const x = r() * VIL_W, y = r() * VIL_H, rad = 40 + r() * 130;
    const grad = c.createRadialGradient(x, y, 0, x, y, rad), col = r() < 0.5 ? B.patch : B.patch2;
    grad.addColorStop(0, withAlpha(col, 0.67)); grad.addColorStop(1, withAlpha(col, 0));
    c.fillStyle = grad; c.beginPath(); c.ellipse(x, y, rad, rad * 0.6, 0, 0, Math.PI * 2); c.fill();
  }
  bakeGroundDetail(c, r, B);
  for (let i = 0; i < 2000; i++) { c.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)'; c.fillRect(r() * VIL_W, r() * VIL_H, 1 + r() * 2, 1 + r() * 1.4); }
  const dirt = mixHex(B.ground, st.dirt, 0.72), edgeCol = shadeHex(dirt, -0.22), cob = mixHex(B.ground, '#b8b2a2', 0.72);
  const stroke = (pts, w) => {
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = withAlpha(edgeCol, 0.5); c.lineWidth = w + 12; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
    c.strokeStyle = dirt; c.lineWidth = w; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
  };
  const wig = x => Math.sin(x / 170) * 8;
  const main = []; for (let x = -20; x <= VIL_W + 20; x += 40) main.push([x, VIL_ROAD + wig(x)]);
  stroke(main, 50);
  stroke([[120, VIL_ROAD], [120, VIL_LANE]], 40); stroke([[VIL_W - 120, VIL_ROAD], [VIL_W - 120, VIL_LANE]], 40); stroke([[120, VIL_LANE], [VIL_W - 120, VIL_LANE]], 40);
  for (const b of v.buildings) stroke(b.y < VIL_ROAD ? [[b.door.x, b.door.y], [b.door.x, VIL_ROAD]] : [[b.door.x, b.door.y], [b.door.x, VIL_LANE]], 34);
  c.save();                                              // speckle the dirt so it reads as packed earth
  for (let i = 0; i < 3000; i++) {
    const x = r() * VIL_W, y = VIL_ROAD - 26 + r() * 52 + wig(x);
    c.fillStyle = r() < 0.5 ? withAlpha(edgeCol, 0.5) : withAlpha(shadeHex(dirt, 0.2), 0.45); c.fillRect(x, y, 1 + r() * 3, 1 + r() * 2);
  }
  c.restore();
  const P = v.plaza;                                     // plaza cobbles
  c.save(); c.beginPath(); c.ellipse(P.x, P.y, P.rx, P.ry, 0, 0, Math.PI * 2); c.clip();
  c.fillStyle = shadeHex(cob, -0.2); c.fillRect(P.x - P.rx, P.y - P.ry, P.rx * 2, P.ry * 2);
  for (let y = P.y - P.ry; y < P.y + P.ry; y += 13) for (let x = P.x - P.rx + ((Math.floor(y / 13) % 2) * 8); x < P.x + P.rx; x += 17) {
    c.fillStyle = shadeHex(cob, (r() - 0.5) * 0.28); c.beginPath(); c.roundRect(x + 1, y + 1, 15, 11, 3); c.fill();
  }
  c.restore();
  c.strokeStyle = shadeHex(cob, -0.45); c.lineWidth = 3; c.beginPath(); c.ellipse(P.x, P.y, P.rx, P.ry, 0, 0, Math.PI * 2); c.stroke();
  const G = v.garden;                                    // garden beds
  c.fillStyle = mixHex(B.ground, '#4a3828', 0.7); c.fillRect(G.x0 + 6, G.y0 + 8, G.x1 - G.x0 - 12, G.y1 - G.y0 - 14);
  for (const by of [G.y0 + 13, G.y0 + 73]) { c.fillStyle = mixHex(B.ground, '#3a2a1c', 0.78); c.beginPath(); c.roundRect(G.x0 + 14, by, G.x1 - G.x0 - 28, 30, 5); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(G.x0 + 18, by + 5 + i * 5); c.lineTo(G.x1 - 18, by + 5 + i * 5); c.stroke(); } }
  const soft = (x, y, rx, ry, col, a) => { const gr = c.createRadialGradient(x, y, 0, x, y, rx); gr.addColorStop(0, withAlpha(col, a)); gr.addColorStop(1, withAlpha(col, 0)); c.save(); c.translate(x, y); c.scale(1, ry / rx); c.translate(-x, -y); c.fillStyle = gr; c.beginPath(); c.arc(x, y, rx, 0, Math.PI * 2); c.fill(); c.restore(); };
  for (const p of v.patches) {                           // lawn, chicken yard, smithy cinders, wood chips
    soft(p.x, p.y, p.rx, p.ry, p.col, p.a);
    if (p.dots) for (let i = 0; i < p.dots.n; i++) { const a = r() * 6.28, d = Math.sqrt(r()); c.fillStyle = p.dots.cols[r() < 0.5 ? 0 : 1]; c.fillRect(p.x + Math.cos(a) * p.dots.rx * d, p.y + Math.sin(a) * p.dots.ry * d, p.dots.w, p.dots.h); }
  }
  const top = c.createLinearGradient(0, 0, 0, 170); top.addColorStop(0, 'rgba(0,0,0,0.5)'); top.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = top; c.fillRect(0, 0, VIL_W, 170);   // soft shade at the edges
  const bot = c.createLinearGradient(0, VIL_H, 0, VIL_H - 120); bot.addColorStop(0, 'rgba(0,0,0,0.5)'); bot.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = bot; c.fillRect(0, VIL_H - 120, VIL_W, 120);
  const lft = c.createLinearGradient(0, 0, 90, 0); lft.addColorStop(0, 'rgba(0,0,0,0.4)'); lft.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = lft; c.fillRect(0, 0, 90, VIL_H);
  const rgt = c.createLinearGradient(VIL_W, 0, VIL_W - 90, 0); rgt.addColorStop(0, 'rgba(0,0,0,0.4)'); rgt.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = rgt; c.fillRect(VIL_W - 90, 0, 90, VIL_H);
  return g;
}


// ---------------------------------------------------------------- the people
// more for everyone to say (the first lines live with each person below); {biome} {village} {name} {wave} {tier} are filled in when they speak
const MORE_LINES = {
  mira: ['Three drops of this and you will feel ten years younger. Four and you will feel nothing at all.', 'Do not shake the bottles. Do not drop the bottles. Do not look at the green bottle.', 'Every set of ten waves, the herbs grow stranger. {biome} herbs are the strangest yet.'],
  tobin: ['Rope, lanterns, rations... and one slightly used boot. Do not ask.', 'Business is good for a village on the edge of a beast road.', 'I would give you a discount, {name}, but I would then be out of business.'],
  hilda: ['The beds are clean, the soup is hot, and there is nothing on my shelf that bites. Mostly.', 'You are welcome to stay as long as you like. The innkeeper in me says so. The one who pays the bills is quieter.', 'Folk come through {village} all the time. Few come back with that look in their eye.'],
  brann: ['Iron remembers every blow. So should you.', 'A hero with bad gear is just a short story.', 'Hm. You swing like someone who has been hit a lot. Good. That is how you learn.', 'Spare gear? Bring it. Honest coin for honest steel.'],
  dagna: ['Plate is heavy. Dead is heavier.', 'I make armour that fits a fighter, not a statue. Move around in it first.', 'Helm, mail, boots... in that order of importance. Do not let anyone tell you different.', 'I once sold a helm to a hero who swore he did not need one. He bought three more.'],
  lysa: ['Gold finds gold, they say. A good ring helps it along.', 'Stones are honest. It is the people who carry them who lie.', 'That one? Cut by a dwarf who talked to it the whole time. I think it listened.', 'Do not lick the gems. Someone always tries.'],
  pim: ['My grandfather planted these beds. His grandfather planted the well, I swear.', 'You can tell a good soil by its smell. This one smells like a promise.', 'Every flower out here has a name. Daisy, Rose, and Gerald. Gerald is a cabbage.', 'Weeds are just plants nobody asked for. I do not hold it against them. Much.'],
  rurik: ['An axe, a stump and a quiet morning. What more could a man ask?', 'Oak splits clean. Elm fights back. Pine just smells nice and complains.', 'I cut one tree for every ten I plant. At least, that was the idea.', 'The wood pile does not stack itself, though the kids keep trying to help.'],
  orla: ['I knit a scarf for the hero every winter. None of them have ever come back to collect it.', 'In my day the road had a toll. Now it has a beast. I preferred the toll.', 'Sit, dear. The best stories take a while, and so does the tea.', 'That dog is smarter than the mayor. Do not tell the mayor.'],
  voss: ['Orders are simple. Nobody comes in with a weapon drawn. Nobody goes out unprepared. That includes you.', 'Quiet night, quiet morning. I like it that way. The beast on the road does not.', 'I have stood this gate for eleven winters. Nothing has got past me. Yet.', 'Rest, buy what you need, and leave on your own terms. The road waits.'],
  pip: ['I can do forty keepy-ups! ...Three. I can do three.', 'Nell cheats at tag. She says she does not. She does.', 'Do you have a sword? A real one? Can I hold it? ...No? Okay.', 'Tam says the dog can talk. Tam is nine and lies a lot.'],
  nell: ['One day I will fight monsters too. I will be much better than Pip.', 'Granny Orla says I may have her old stick. It is very long.', 'If you see my ball, it is red. If you see Pip, it is probably his fault.', 'We play until the lamps come on. Then Mum shouts.'],
  tam: ['The ball went into the hay again. Pip says he did not kick it. He did.', 'Do you think the beast is scared of us? I would be scared of us.', 'My dad says you are very brave. My mum says you are very late for dinner.', 'I am the fastest in the village. ...After Nell.'],
};
function makeNpcs(v) {
  const night = night01() > 0.55;
  const mk = (id, name, role, x, y, o) => {
    const n = {
      id, name, role, x, y, f: 1, scale: 1, speed: 52, r: 7, walkT: Math.random() * 6, pt: 0, pose: 'stand', moving: false, carry: null,
      alpha: 1, ph: Math.random() * 6.28, inside: false, cur: null, queue: null, chatT: 5 + Math.random() * 8, bubble: null, bubbleT: 0,
      look: {}, lines: [], chat: [], shop: null, special: null, home: null, nightHome: false, kid: false, greeted: false, greetT: 0, talking: false,
      ...o,
    };
    if (n.nightHome && night) { n.inside = true; n.alpha = 0; }
    v.npcs.push(n); return n;
  };
  const b = v.b, door = id => ({ x: b[id].door.x, y: b[id].door.y, id });

  // --- shopkeepers ---
  const miraStand = [b.alch.x - 36, b.alch.y + 27], caul = [b.alch.x + 66, b.alch.y + 36];
  const cauldron = prop2(v, 'cauldron', caul[0] + 14, caul[1] + 10, { col: ['#6fd08a', '#b07af0', '#5b8def'][v.seed % 3] });
  v.solids.push({ x: caul[0] + 14, y: caul[1] + 6, r: 14 });
  mk('mira', 'Mira', 'Alchemist', miraStand[0], miraStand[1], {
    shop: 'alch', look: { body: '#6a4fb0', hat: 'cone', hatColor: '#4b3590', hair: '#c9a0e0', cheek: true }, f: 1,
    lines: ['Potions to patch a hero up. Press Q out there to drink one when the beast bites back.', 'Brewed this morning. Mostly.', "Wave after wave and still on your feet? You've got more spirit than my last customer.", "Careful with that bottle. It glows when it's fresh."],
    chat: ['Eye of newt... or was it toe?', 'Bubble, bubble...', 'A fresh batch!'],
    script: () => [{ t: [3, 6], face: 1 }, { go: [caul[0] - 16, caul[1] - 2] }, { do: 'stir', t: [5, 9], face: 1 }, { go: miraStand }, { t: [4, 8], face: -1 }],
  });
  const crateSpot = [b.store.x - 76, b.store.y + 30], toStand = [b.store.x + 28, b.store.y + 27];
  mk('tobin', 'Tobin', 'General Store', toStand[0], toStand[1], {
    shop: 'store', look: { body: '#3f7a8a', apron: '#d8cba8', hat: 'cap', hatColor: '#6a4a2a', hair: '#7a5a3a', cheek: true }, f: -1,
    lines: ['Lanterns, rope, odds and ends. A better lantern lets you see further when the night closes in.', 'You want light out there. The dark hides things that bite.', "Can't sell what I haven't got, friend. But I do have lamps."],
    chat: ['Fine goods, fair prices!', 'Mind the crates!', 'Lanterns! Get your lanterns!'],
    script: () => [{ t: [4, 8], face: -1 }, { go: [crateSpot[0] + 22, crateSpot[1]], carry: null }, { t: 0.3, enter: n => { n.carry = 'crate'; } }, { go: [toStand[0] - 10, toStand[1]] }, { t: 0.4, enter: n => { n.carry = null; } }, { t: [3, 6], face: 1 }],
  });
  const armStand = [b.armoury.x - 34, b.armoury.y + 27], jewStand = [b.jewel.x - 28, b.jewel.y + 27];
  mk('dagna', 'Dagna', 'Armourer', armStand[0], armStand[1], {
    shop: 'armour', look: { body: '#4a6a8a', apron: '#5a4a40', hat: 'smithcap', hatColor: '#6a7a8a', hair: '#7a3a1a', cheek: true }, f: 1,
    lines: ['Mail, plate and helms. Every piece tested on a very patient scarecrow.', 'A good helm has saved more heroes than any sword.', "Armour won't make you brave. It will make you hard to kill."],
    chat: ['Polish, polish...', 'Finest steel on the road!', 'Try it on, try it on!'],
    script: () => [{ t: [4, 8], face: -1 }, { do: 'wipe', t: [2, 3] }, { go: [armStand[0] + 58, armStand[1]] }, { t: [3, 6], face: 1 }, { go: armStand }],
  });
  mk('lysa', 'Lysa', 'Jeweller', jewStand[0], jewStand[1], {
    shop: 'jewel', look: { dress: '#2f8a6a', hat: 'bun', glasses: true, hair: '#2a2a3a', cheek: true }, f: 1,
    lines: ['Rings and charms. Small things, big luck.', 'Every stone has a story. Most of them are about money.', 'A good ring will find your weak spot and cover it.'],
    chat: ['Sparkle, sparkle...', 'Lovely stones today!', 'Mind the glass!'],
    script: () => [{ t: [4, 8], face: -1 }, { do: 'wipe', t: [2, 3] }, { go: [jewStand[0] + 50, jewStand[1]] }, { t: [3, 6], face: 1 }, { go: jewStand }],
  });
  mk('hilda', 'Hilda', 'Innkeeper', b.inn.x - 70, b.inn.y + 30, {
    special: 'inn', look: { dress: '#b04a5a', apron: '#f0ead8', hat: 'kerchief', hatColor: '#e8d8a8', hair: '#7a4a2a', cheek: true },
    lines: ["Rest here and you'll walk out with your strength back, and your journey safely written down.", "No charge for heroes. You'll earn your keep soon enough.", 'The road beyond the gate? A beast waits there. {tier} champions have tried before you.', 'Mind the step. And the cat. I do not own a cat, but it is always there.'],
    chat: ['Fresh bread by noon!', 'Sweep, sweep, sweep...', 'Welcome, traveller!'],
    script: () => night01() > 0.5
      ? [{ go: [b.inn.x + 26, b.inn.y + 34] }, { t: [8, 14], face: 1 }, { do: 'wave', t: 2, face: 1 }, { go: [b.inn.x - 60, b.inn.y + 34] }, { t: [8, 14], face: -1 }]
      : [{ go: [b.inn.x - 100, b.inn.y + 30] }, { go: [b.inn.x + 90, b.inn.y + 30], pose: 'sweep', speed: 20 }, { t: [1, 2.5], face: -1 }, { go: [b.inn.x - 100, b.inn.y + 30], pose: 'sweep', speed: 20 }, { do: 'wipe', t: [2, 3] }, { t: [3, 7], face: 1 }],
  });
  const anvStand = [v.anvil.x - 22, v.anvil.y + 4], quenchStand = [v.anvil.x - 72, v.anvil.y + 4];
  mk('brann', 'Brann', 'Blacksmith', anvStand[0], anvStand[1], {
    shop: 'smith', nightHome: true, home: door('smith'), look: { body: '#7a4a2a', apron: '#4a3a30', hat: 'smithcap', hatColor: '#3a2a22', hair: '#4a2a18', beard: '#5a3a22' }, f: 1, speed: 48,
    lines: ["Blades to buy, iron to temper, spare gear to sell. Bring me what you've got and I'll make it better.", 'A good blade is half the fight. The other half is the arm.', 'Hm. Cannot talk long. Iron waits for no one.'],
    chat: ['Clang!', 'Hot iron waits for no one.', 'Hmph.'],
    script: () => [{ go: anvStand }, { do: 'hammer', t: [9, 15], face: 1, enter: () => { v.anvil.hot = 1; } }, { do: 'wipe', t: [2, 3] }, { go: quenchStand }, { do: 'dip', t: 2.6, face: -1, enter: n => { sfxNear(n, 'dip', 1); } }, { go: anvStand }],
  });
  // --- villagers with routines ---
  const wellSpot = [v.plaza.x - 32, v.plaza.y + 38];
  const G = v.garden, gx = G.gapAt === 'E' ? G.x1 + 26 : G.x0 - 26, lane = G.y0 + 57, roadSpot = [gx, VIL_ROAD + 14];
  mk('pim', 'Old Pim', 'Gardener', gx + (G.gapAt === 'E' ? 16 : -16), lane - 2, {
    nightHome: true, home: door('houseA'), look: { body: '#6a8a3a', hat: 'straw', hatColor: '#c0392b', hair: '#d8d8d8', beard: '#e6e6e6', cheek: true }, speed: 46,
    lines: ['Cabbages for the winter and flowers for the soul!', "Water them every day and they'll reward you. Not unlike a good sword arm.", "{biome} soil is peculiar, but my carrots don't seem to mind."],
    chat: ['Grow, my beauties!', 'Thirsty, are we?', 'Hm hm hm...'],
    script: () => {
      const s = [{ go: roadSpot }, { go: wellSpot }, { do: 'dip', t: 1.8, face: 1, enter: n => { sfxNear(n, 'dip', 1); n.carry = null; } }, { go: roadSpot }, { go: [gx, lane - 1] }];
      const xs = [G.x0 + 160, G.x0 + 108, G.x0 + 56, G.x0 + 30]; if (G.gapAt === 'W') xs.reverse();
      for (const x of xs) s.push({ go: [x, lane] }, { do: 'water', t: 2.2, face: 1, tick: (n, vv, dt) => waterTick(n, vv, dt, 1), enter: n => sfxNear(n, 'pour', 1) },
        { do: 'water', t: 2.0, face: -1, tick: (n, vv, dt) => waterTick(n, vv, dt, -1) });
      s.push({ go: [gx, lane - 1] }, { do: 'wipe', t: [2, 3] });
      return s;
    },
  });
  const stumpStand = [v.stump.x - 28, v.stump.y + 4], logsStand = [v.logs.x + 47, v.logs.y - 2], stackStand = [v.stack.x - 44, v.stack.y + 6];
  mk('rurik', 'Rurik', 'Woodcutter', stumpStand[0], stumpStand[1], {
    nightHome: true, home: door('houseC'), look: { body: '#a83a3a', apron: '#6a4a2a', hat: 'cap', hatColor: '#3a3a44', hair: '#6a3a1a', beard: '#6a3a1a' }, speed: 50,
    lines: ["Winter's coming. A full woodpile is a promise.", 'The beast beyond the gate scatters the trees. I stay on this side.', 'Mind the axe!'],
    chat: ['Timber!', 'Heave... and split.', 'Good oak, this.'],
    script: () => [{ go: logsStand }, { t: 0.5, face: -1, enter: n => { n.carry = 'log'; v.logs.n = Math.max(2, v.logs.n - 1); } }, { go: stumpStand },
      { t: 0.4, face: 1, enter: n => { n.carry = null; v.stump.log = 1; v.stump.hits = 0; sfxNear(n, 'kick', 0.5); } },       // stands the log on end on the stump
      { do: 'chop', t: 9, face: 1, tick: (n, vv, dt) => chopTick(n, vv, dt) }, { t: 0.5, enter: n => { n.carry = 'wood'; v.stump.log = 0; v.stump.split = Math.min(4, v.stump.split + 1); } },
      { go: stackStand }, { t: 0.5, face: 1, enter: n => { n.carry = null; v.stack.n = v.stack.n >= 12 ? 4 : v.stack.n + 1; v.logs.n = Math.min(6, v.logs.n + (Math.random() < 0.4 ? 1 : 0)); v.stump.split = 0; } },
      { do: 'wipe', t: [2, 4] }],
  });
  const lawn = v.lawn;
  for (const [id, name, col, hat, sx, sy] of [['pip', 'Pip', '#e8c850', '#d9534f', lawn.x0 + 65, lawn.y0 + 42], ['nell', 'Nell', '#e07aa0', '#5b8def', lawn.x0 + 155, lawn.y0 + 82], ['tam', 'Tam', '#6aa8d8', '#7fd08a', lawn.x0 + 215, lawn.y0 + 32]]) {
    mk(id, name, 'Child', sx, sy, {
      kid: true, scale: 0.72, speed: 78, nightHome: true, home: door('houseB'), look: { body: col, hat: 'beanie', hatColor: hat, hair: '#5a3a1a', cheek: true }, happy: true,
      lines: id === 'pip' ? ["Wanna play? Tam kicks way too hard!", "I'm going to be a hero when I grow up. Like you!"] : id === 'nell' ? ['Tag! You are it! ...Oh. You look busy.', 'Do you really fight monsters? Are they scary?'] : ['I can kick it over the roof! Almost.', 'Mum says be home by dark.'],
      chat: ['Pass it here!', 'Over here!', 'Haha!', "Can't catch me!", 'Again, again!'],
    });
  }
  mk('orla', 'Granny Orla', 'Elder', v.benchA.x, v.benchA.y + 6, {
    nightHome: true, home: door('houseA'), look: { dress: '#8a6aa8', hat: 'bun', glasses: true, skin: '#fff' }, f: -1, speed: 34,
    lines: ["I've seen heroes come and go, dear. You've kind eyes.", 'The road was safer in my day. Well... safer.', 'Take care out there. And come back for tea.'],
    chat: ['Knit one, purl two...', 'Lovely day for it.', 'Hm, hm.'],
    script: () => [{ go: [v.benchA.x, v.benchA.y + 6] }, { do: 'knit', t: [18, 30], face: -1 }, { go: [v.board.x - 40 * Math.sign(v.board.x - v.benchA.x), v.board.y + 8], speed: 30 }, { do: 'read', t: [4, 6], face: 1 },
      { go: [wellSpot[0] + 10, wellSpot[1] + 6], speed: 30 }, { t: [3, 5], face: 1 }, { go: [v.benchA.x, v.benchA.y + 6], speed: 30 }],
  });
  mk('eira', 'Eira', 'Keeper of the Shrine', v.shrine.x + 50, v.shrine.y + 16, {
    special: 'shrine', look: { dress: '#d9d4f0', hat: 'kerchief', hatColor: '#c9b8ff', hair: '#e8e0ff', cheek: true }, f: -1, speed: 36,
    lines: ['The shrine remembers everyone who has climbed as far as you. It also remembers the ones who did not come back.', 'Reach the top, and I can send you back down, stronger. Ask me when you are ready.', 'Mythical and secret things are loyal. They will wait for you in the pack. Everything else is only gold.'],
    chat: ['Hm hm...', 'The light is kind today.', 'Begin again, and again.'],
    script: () => [{ t: [6, 11], face: -1 }, { do: 'wipe', t: [2, 3] }, { t: [6, 11], face: 1 }],
  });
  mk('voss', 'Sgt. Voss', 'Gate Guard', v.gate.x - 98 * v.E, v.gate.y - 28, {
    special: 'guard', look: { body: '#4a5a7a', hat: 'helmet', hatColor: '#c0392b', beard: '#6a5a4a', spear: true }, f: -v.E, speed: 36,
    lines: ['Beyond this gate the road runs to a beast. Are you ready to face it?'],
    chat: ['Move along, citizens.', 'All quiet.', 'Halt. ...Oh, it is you.'],
    script: () => [{ do: 'lean', t: [9, 15], face: -v.E }, { go: [v.gate.x - 98 * v.E, v.gate.y + 26] }, { t: [4, 6], face: -v.E }, { go: [v.gate.x - 98 * v.E, v.gate.y - 28] }],
  });
  for (const n of v.npcs) if (MORE_LINES[n.id]) n.lines = n.lines.concat(MORE_LINES[n.id]);
  // the notice board is a talk target too
  v.sleepAt = { x: b.inn.x + 118, y: b.inn.y + 40 };
}
// helper for props created after the main pass (cauldron) so they join the sort list
function prop2(v, kind, x, y, extra) { const p = { x, y, ...extra }; v.statics.push({ y, d: () => VPROP[kind](p, curNight > 0.45) }); return p; }

function makeAnimals(v) {
  const dog = { x: v.plaza.x + 60, y: VIL_ROAD + 40, f: 1, walkT: 0, moving: false, pose: 'stand', pt: 0, mode: 'trot', wp: null, t: 2, ph: Math.random() * 6, happy: false, alpha: 1, r: 8, fT: 0, cool: 6, kind: 'dog' };
  v.animals.push(dog); v.dog = dog;
  v.dogRoadWp = [v.sleepAt.x, VIL_ROAD - 8];
  v.dogWps = [];                                           // places for the dog to trot to: anywhere free between the shops and the lane
  const rr = mulberry(v.seed ^ 0x77);
  for (let i = 0; i < 600 && v.dogWps.length < 18; i++) { const x = 120 + rr() * (VIL_W - 240), y = 420 + rr() * (VIL_LANE - 420); if (!vilOverlaps(v, x, y, 16)) v.dogWps.push([x, y]); }
  for (let i = 0; i < 4; i++) {
    const h = { x: v.yard.x0 + 10 + Math.random() * (v.yard.x1 - v.yard.x0 - 20), y: v.yard.y0 + 4 + Math.random() * (v.yard.y1 - v.yard.y0 - 8), f: Math.random() < 0.5 ? 1 : -1, walkT: 0, moving: false, pose: 'peck', pt: Math.random() * 3, t: Math.random() * 2, wp: null, alpha: 1, r: 4, col: i === 3 ? '#c8864a' : '#f2eee4', kind: 'hen', ph: Math.random() * 6 };
    v.hens.push(h);
  }
}

// ---------------------------------------------------------------- audio at a distance
function sfxNear(src, name, base = 1) {
  if (!hero || !vil) return;
  const d = Math.hypot(src.x - hero.x, src.y - hero.y), g = Math.max(0, 1 - d / 520) ** 1.15 * base;
  if (g > 0.05) Sound.sfxAt(name, g);
}

// ---------------------------------------------------------------- effects
function vfx(v, o) { if (v.fx.length < 320) v.fx.push({ vx: 0, vy: 0, grav: 0, size: 2, add: false, ...o, max: o.life }); }
function waterTick(n, v, dt, dir) {
  const sx = n.x + n.f * 24, sy = n.y - 34;
  if (Math.random() < dt * 22) vfx(v, { x: sx, y: sy, vx: n.f * (30 + Math.random() * 20), vy: 10, grav: 340, life: 0.55, size: 1.6, color: '#a6d8ff' });
  for (const p of v.plants) if (Math.abs(p.x - (n.x + n.f * 16)) < 22 && Math.abs(p.y - n.y) < 36) { p.wet = 1; p.g = Math.min(1, p.g + dt * 0.08); }
}
function chopTick(n, v, dt) {
  const ph = (n.pt * 1.7) % 1, prev = n._ph ?? 0; n._ph = ph; const st = v.stump;
  st.kick = Math.max(0, (st.kick || 0) - dt * 5);
  if (prev < 0.66 && ph >= 0.66 && st.log === 1) {
    st.hits = (st.hits | 0) + 1; st.kick = 1;
    sfxNear(n, st.hits >= 5 ? 'hammer' : 'chop', 1);
    if (st.hits >= 5) { st.log = 2; if (n.cur) n.cur.t = Math.min(n.cur.t, 0.12); }      // the log falls apart: two halves on the ground
    for (let i = 0; i < (st.hits >= 5 ? 9 : 5); i++) vfx(v, { x: v.stump.x + (Math.random() - 0.5) * 10, y: v.stump.y - (st.log === 1 ? 30 : 18), vx: (Math.random() - 0.5) * 90, vy: -50 - Math.random() * 60, grav: 300, life: 0.6, size: 2, color: Math.random() < 0.5 ? '#d9b27a' : '#a87a44' });
  }
}
function hammerTick(n, v, dt) {
  const ph = (n.pt * 1.15) % 1, prev = n._ph ?? 0; n._ph = ph;
  v.anvil.hot = Math.max(0, v.anvil.hot - dt * 0.18);
  if (prev < 0.7 && ph >= 0.7) {
    sfxNear(n, 'hammer', 1);
    for (let i = 0; i < 7; i++) vfx(v, { x: v.anvil.x - 2, y: v.anvil.y - 28, vx: (Math.random() - 0.3) * 120, vy: -40 - Math.random() * 90, grav: 380, life: 0.45, size: 1.6, color: Math.random() < 0.5 ? '#ffd070' : '#ff8a2a', add: true });
  }
}

// ---------------------------------------------------------------- villager behaviour
function walkTo(n, tx, ty, dt, v, spd) {
  const dx = tx - n.x, dy = ty - n.y, d = Math.hypot(dx, dy);
  if (d < 4) { n.moving = false; return true; }
  const st = Math.min(d, spd * dt);
  const c = vilCollide(v, n.x + dx / d * st, n.y + dy / d * st, n.r, n.x, n.y);
  const moved = Math.hypot(c.x - n.x, c.y - n.y);
  if (Math.abs(dx) > 1.5) n.f = dx > 0 ? 1 : -1;
  n.x = c.x; n.y = c.y; n.moving = moved > 0.01;
  n.walkT += dt * stepRate(spd, 11 * (n.scale || 1));
  n.stuckT = moved < st * 0.3 ? (n.stuckT || 0) + dt : 0;
  if (n.stuckT > 1.6) {                                   // never stay wedged
    v.stats.stuck++; n.stuckT = 0; n.moving = false;
    if (n.kind === 'dog') return true;                    // the dog just gives up on a spot it can't reach
    v.stats.snaps++; (v.stats.who = v.stats.who || []).push(`${n.id || n.kind}@${Math.round(n.x)},${Math.round(n.y)}->${Math.round(tx)},${Math.round(ty)}`); n.x = tx; n.y = ty; return true;
  }
  return false;
}

// Going home: walk to the door (the path finder takes them round the walls); coming out, the children head for the lawn.
function homeRoute(n, v, dir) {
  if (dir === 'in') return [{ go: [n.home.x, n.home.y], speed: n.speed * 1.15 }];
  return n.kid ? [{ go: [v.lawnC.x, v.lawnC.y] }] : [];
}

// ---------------------------------------------------------------- finding the way round walls
// The village is laid out differently every time, so people can't rely on fixed waypoints. A coarse grid of what a person can
// stand on is built once per village; a step that can't be walked in a straight line gets an A* route, pulled tight.
function vilGrid(v) {
  const C = 8, W = Math.ceil(VIL_W / C), H = Math.ceil(VIL_H / C), bl = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) bl[y * W + x] = vilOverlaps(v, x * C + C / 2, y * C + C / 2, 9) ? 1 : 0;
  return { C, W, H, bl };
}
function findPath(v, sx, sy, tx, ty, r) {
  const g = v.grid || (v.grid = vilGrid(v)), { C, W, H, bl } = g;
  const gx = x => Math.max(0, Math.min(W - 1, Math.floor(x / C))), gy = y => Math.max(0, Math.min(H - 1, Math.floor(y / C)));
  const nearestFree = (x, y) => {
    const X0 = gx(x), Y0 = gy(y); if (!bl[Y0 * W + X0]) return Y0 * W + X0;
    for (let rad = 1; rad < 10; rad++) for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      const X = X0 + dx, Y = Y0 + dy; if (X >= 0 && Y >= 0 && X < W && Y < H && !bl[Y * W + X]) return Y * W + X;
    }
    return -1;
  };
  const s0 = nearestFree(sx, sy), t0 = nearestFree(tx, ty); if (s0 < 0 || t0 < 0) return null;
  const gS = new Float32Array(W * H).fill(Infinity), f = new Float32Array(W * H), from = new Int32Array(W * H).fill(-1), closed = new Uint8Array(W * H);
  const tX = t0 % W, tY = (t0 / W) | 0, hh = c => Math.hypot((c % W) - tX, ((c / W) | 0) - tY);
  const open = [s0]; gS[s0] = 0; f[s0] = hh(s0);
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
    const c = open[bi]; open[bi] = open[open.length - 1]; open.pop();
    if (c === t0) break; if (closed[c]) continue; closed[c] = 1;
    const x = c % W, y = (c / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const nc = Y * W + X; if (bl[nc] || closed[nc]) continue;
      if (dx && dy && (bl[y * W + X] || bl[Y * W + x])) continue;                      // no cutting corners
      const ng = gS[c] + (dx && dy ? 1.414 : 1);
      if (ng < gS[nc]) { gS[nc] = ng; from[nc] = c; f[nc] = ng + hh(nc); open.push(nc); }
    }
  }
  if (t0 !== s0 && from[t0] < 0) return null;
  const cells = []; for (let c = t0; c >= 0; c = from[c]) { cells.push(c); if (c === s0) break; }
  const pts = cells.reverse().map(c => [(c % W) * C + C / 2, ((c / W) | 0) * C + C / 2]);
  const out = []; let ax = sx, ay = sy, i = 0;                                          // pull the string tight: skip points you can see past
  while (i < pts.length) { let j = pts.length - 1; while (j > i && !lineClear(v, ax, ay, pts[j][0], pts[j][1], r)) j--; out.push(pts[j]); ax = pts[j][0]; ay = pts[j][1]; i = j + 1; }
  out.push([tx, ty]);
  return out;
}
function planPath(v, n, go) {
  if (lineClear(v, n.x, n.y, go[0], go[1], n.r)) return [[go[0], go[1]]];
  return findPath(v, n.x, n.y, go[0], go[1], n.r) || [[go[0], go[1]]];
}
function startStep(n, s, v) {
  n.cur = s; n.pt = 0; n._ph = 0;
  if (!s.go) { const T = s.t; s.t = Array.isArray(T) ? T[0] + Math.random() * (T[1] - T[0]) : (T ?? 1); if (s.face) n.f = s.face; }
  if (s.enter) s.enter(n, v);
}
function runScript(n, dt, v) {
  if (!n.cur && n.exiting && !(n.queue && n.queue.length)) { n.exiting = false; return; }   // out of the house: back to the routine
  if (!n.cur && n.goHome && (!n.queue || !n.queue.length)) {      // arrived at the door: step inside
    if (!n.fadeOut) { n.fadeOut = true; sfxNear(n, 'door', 0.6); }
    n.moving = false; n.pose = 'stand'; return;
  }
  if (!n.cur) {
    if (!n.queue || !n.queue.length) n.queue = n.script(v, n).slice();
    startStep(n, n.queue.shift(), v);
  }
  const s = n.cur;
  if (s.go) {
    n.pose = s.pose || (n.carry ? 'carry' : 'stand');
    if (!s.path) s.path = planPath(v, n, s.go);
    const wp = s.path[0];
    if (walkTo(n, wp[0], wp[1], dt, v, s.speed || n.speed)) { s.path.shift(); if (!s.path.length) { n.moving = false; n.cur = null; } }
    else if (n.pose === 'sweep' && n.moving && Math.random() < dt * 4) vfx(v, { x: n.x + n.f * 22, y: n.y - 1, vx: n.f * 12, vy: -12, grav: 0, life: 0.7, size: 2.2, color: 'rgba(200,190,160,0.5)' });
    return;
  }
  n.moving = false; n.pose = s.do || (n.carry ? 'carry' : 'stand'); n.pt += dt; s.t -= dt;
  if (s.do === 'hammer') hammerTick(n, v, dt);
  if (s.tick) s.tick(n, v, dt);
  if (s.t <= 0) { if (s.leave) s.leave(n, v); n.cur = null; }
}

function npcTick(n, dt, v) {
  const nt = night01();
  if (n.nightHome) {
    if (n.inside) {
      if (nt < 0.3) {
        n.inside = false; n.x = n.home.x; n.y = n.home.y; n.alpha = 0; n.cur = null; n.goHome = false; n.carry = null; n.fadeOut = false; sfxNear(n, 'door', 0.6);
        n.queue = homeRoute(n, v, 'out'); n.exiting = n.queue.length > 0;
      }
      return;
    }
    if (nt > 0.55 && !n.goHome) {
      n.goHome = true; n.cur = null; n.carry = null; n.pose = 'stand';
      n.queue = homeRoute(n, v, 'in');
    }
  }
  if (n.fadeOut) { n.alpha = Math.max(0, n.alpha - dt * 3); if (n.alpha <= 0) { n.fadeOut = false; n.inside = true; n.cur = null; n.queue = null; return; } }
  else n.alpha = Math.min(1, n.alpha + dt * 2.5);

  if (n.kid && !n.goHome && !n.exiting) kidTick(n, dt, v); else runScript(n, dt, v);

  // greet the hero when they walk up, and chat every now and then
  const hd = Math.hypot(hero.x - n.x, hero.y - n.y);
  if (hd > 280) n.greeted = false;
  if (!n.greeted && hd < 105 && !n.moving && !n.goHome) { n.greeted = true; n.greetT = 1.5; }
  if (n.greetT > 0) { n.greetT -= dt; if (!n.moving && n.pose !== 'carry') { n.pose = 'wave'; n.pt += dt; n.f = hero.x >= n.x ? 1 : -1; } }
  n.chatT -= dt;
  if (n.bubbleT > 0) { n.bubbleT -= dt; if (n.bubbleT <= 0) { n.bubble = null; n.talking = false; } }
  else if (n.chatT <= 0 && hd < 260 && n.chat.length && !n.goHome) {
    n.chatT = 9 + Math.random() * 12;
    n.bubble = n.kid && v.kidMode === 'tag' && Math.random() < 0.5 ? (v.tag.it === v.npcs.indexOf(n) ? "You can't catch me!" : 'Run!') : n.chat[Math.floor(Math.random() * n.chat.length)];
    n.bubbleT = 3.2; n.talking = true;
    if (n.kid && Math.random() < 0.6) sfxNear(n, 'giggle', 0.7);
  }
}

// children: ball games, tag, then a rest on the grass
function kidTick(n, dt, v) {
  const kids = v.npcs.filter(k => k.kid && !k.inside && !k.goHome), L = v.lawn;
  const clampLawn = () => { n.x = Math.max(L.x0, Math.min(L.x1, n.x)); n.y = Math.max(L.y0, Math.min(L.y1, n.y)); };
  const run = (tx, ty, spd) => {
    const dx = tx - n.x, dy = ty - n.y, d = Math.hypot(dx, dy);
    if (d < 3) { n.moving = false; return true; }
    const st = Math.min(d, spd * dt); n.x += dx / d * st; n.y += dy / d * st; clampLawn();
    if (Math.abs(dx) > 1) n.f = dx > 0 ? 1 : -1;
    n.moving = true; n.walkT += dt * stepRate(spd, 11 * n.scale); return false;
  };
  n.pt += dt;
  if (n === kids[0]) {                                                // one kid runs the group state
    v.kidT -= dt; v.kickCd = Math.max(0, v.kickCd - dt); v.tag.imm = Math.max(0, v.tag.imm - dt);
    if (v.kidT <= 0) {
      const next = ['ball', 'tag', 'rest'].filter(m => m !== v.kidMode)[Math.floor(Math.random() * 2)];
      v.kidMode = next; v.kidT = next === 'rest' ? 12 + Math.random() * 6 : 30 + Math.random() * 15;
      v.tag.it = v.npcs.indexOf(kids[Math.floor(Math.random() * kids.length)]); v.tag.imm = 1.5;
    }
    ballTick(v, dt, kids);
  }
  if (n.kickT > 0) { n.kickT -= dt; n.pose = 'kick'; n.moving = false; return; }
  const idx = v.npcs.indexOf(n);
  if (v.kidMode === 'ball') {
    n.pose = 'stand';
    if (v.chaser === n) {
      const d = Math.hypot(v.ball.x - n.x, v.ball.y - n.y);
      if (d > 13) run(v.ball.x, v.ball.y, 92);
      else if (v.kickCd <= 0) {
        const others = kids.filter(k => k !== n), tgt = others[Math.floor(Math.random() * others.length)] || n;
        const a = Math.atan2(tgt.y - v.ball.y, tgt.x - v.ball.x), sp = 130 + Math.random() * 70;
        v.ball.vx = Math.cos(a) * sp; v.ball.vy = Math.sin(a) * sp; v.ball.z = 6;
        v.kickCd = 0.7; v.lastKicker = n; n.kickT = 0.3; n.pt = 0; n.f = Math.cos(a) >= 0 ? 1 : -1; sfxNear(n, 'kick', 0.9);
        v.chaser = null;
      }
    } else {
      const sp = Math.hypot(v.ball.vx, v.ball.vy);
      if (!n.wp || n.wpT <= 0 || Math.hypot(n.wp.x - n.x, n.wp.y - n.y) < 6) { n.wp = { x: L.x0 + 20 + Math.random() * (L.x1 - L.x0 - 40), y: L.y0 + 15 + Math.random() * (L.y1 - L.y0 - 30) }; n.wpT = 1.5 + Math.random() * 2.5; }
      n.wpT -= dt;
      if (sp > 60 && !(n.cheerT > 0) && Math.random() < dt * 1.2) { n.cheerT = 0.8; n.pt = 0; }
      run(n.wp.x, n.wp.y, 40);
      if (n.cheerT > 0) { n.cheerT -= dt; if (!n.moving) n.pose = 'cheer'; }
    }
  } else if (v.kidMode === 'tag') {
    n.pose = 'stand';
    const it = v.npcs[v.tag.it], isIt = it === n;
    if (isIt) {
      let best = null, bd = 1e9;
      for (const k of kids) if (k !== n) { const d = Math.hypot(k.x - n.x, k.y - n.y); if (d < bd) { bd = d; best = k; } }
      if (best) {
        run(best.x, best.y, 80);
        if (bd < 15 && v.tag.imm <= 0) { v.tag.it = v.npcs.indexOf(best); v.tag.imm = 1.2; best.bubble = 'Tag! You are it!'; best.bubbleT = 2; best.talking = true; sfxNear(best, 'giggle', 0.8); }
      }
    } else if (it && !it.inside) {
      const dx = n.x - it.x, dy = n.y - it.y, d = Math.hypot(dx, dy) || 1;
      let tx = n.x + dx / d * 60 + Math.sin(v.t * 1.3 + idx) * 25, ty = n.y + dy / d * 60 + Math.cos(v.t * 1.1 + idx) * 20;
      // steer away from the lawn edges so nobody gets pinned in a corner
      const cx = (L.x0 + L.x1) / 2, cy = (L.y0 + L.y1) / 2;
      if (n.x < L.x0 + 25 || n.x > L.x1 - 25) tx = cx + (Math.random() - 0.5) * 60;
      if (n.y < L.y0 + 18 || n.y > L.y1 - 18) ty = cy + (Math.random() - 0.5) * 40;
      run(tx, ty, 82);
    }
  } else {                                                           // rest in a ring on the grass
    const k = kids.indexOf(n), a = (k / Math.max(1, kids.length)) * Math.PI * 2 + 0.6, tx = v.lawnC.x + Math.cos(a) * 38, ty = v.lawnC.y + Math.sin(a) * 18;
    if (!run(tx, ty, 60)) n.pose = 'stand';
    else { n.pose = 'sit'; n.moving = false; n.f = Math.cos(a) > 0 ? -1 : 1; }
  }
}
function ballTick(v, dt, kids) {
  const b = v.ball, L = v.lawn;
  b.x += b.vx * dt; b.y += b.vy * dt;
  const f = Math.pow(0.35, dt); b.vx *= f; b.vy *= f;
  if (b.x < L.x0 + 8) { b.x = L.x0 + 8; b.vx = Math.abs(b.vx) * 0.7; } if (b.x > L.x1 - 8) { b.x = L.x1 - 8; b.vx = -Math.abs(b.vx) * 0.7; }
  if (b.y < L.y0 + 6) { b.y = L.y0 + 6; b.vy = Math.abs(b.vy) * 0.7; } if (b.y > L.y1 - 4) { b.y = L.y1 - 4; b.vy = -Math.abs(b.vy) * 0.7; }
  const sp = Math.hypot(b.vx, b.vy);
  b.z = sp > 20 ? Math.abs(Math.sin(v.t * 9)) * Math.min(7, sp / 14) : 0;
  v.chaseT -= dt;
  if (v.kidMode === 'ball' && (v.chaseT <= 0 || !v.chaser) && sp < 70) {       // the kid nearest the ball goes for it
    v.chaseT = 0.35; let best = null, bd = 1e9;
    for (const k of kids) { if (k === v.lastKicker && kids.length > 1 && v.kickCd > 0) continue; const d = Math.hypot(k.x - b.x, k.y - b.y); if (d < bd) { bd = d; best = k; } }
    v.chaser = best;
  }
}

function lineClear(v, x0, y0, x1, y1, r) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8));
  for (let i = 1; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n, c = vilCollide(v, x, y, r);
    if (Math.abs(c.x - x) > 0.5 || Math.abs(c.y - y) > 0.5) return false;
  }
  return true;
}
function animalTick(d, dt, v) {
  const nt = night01();
  d.pt += dt;
  if (d.kind === 'hen') {
    if (nt > 0.55) { d.pose = 'sit'; d.moving = false; return; }
    d.t -= dt;
    if (d.wp) { if (walkTo(d, d.wp.x, d.wp.y, dt, v, 22)) { d.wp = null; d.t = 1 + Math.random() * 3; d.pose = 'peck'; d.pt = 0; } else d.pose = 'stand'; }
    else if (d.t <= 0) { d.wp = { x: v.yard.x0 + Math.random() * (v.yard.x1 - v.yard.x0), y: v.yard.y0 + Math.random() * (v.yard.y1 - v.yard.y0) }; if (Math.random() < 0.15) sfxNear(d, 'cluck', 0.6); }
    return;
  }
  // the dog
  d.cool -= dt; d.happy = d.mode === 'follow' || d.petT > 0; d.petT = Math.max(0, (d.petT || 0) - dt);
  if (nt > 0.55) {
    if (d.pose !== 'sleep') {
      if (!d.nightWp) d.nightWp = lineClear(v, d.x, d.y, v.sleepAt.x, v.sleepAt.y, d.r) ? null : v.dogRoadWp;      // via the road when the way is blocked
      const tgt = d.nightWp && !d.reachedRoad ? d.nightWp : v.sleepAt;
      if (walkTo(d, tgt[0] ?? tgt.x, tgt[1] ?? tgt.y, dt, v, 60)) { if (tgt === v.sleepAt) { d.pose = 'sleep'; d.moving = false; } else d.reachedRoad = true; } else d.pose = 'stand';
    }
    return;
  }
  if (d.pose === 'sleep') { d.pose = 'stand'; d.t = 0.5; }
  d.nightWp = null; d.reachedRoad = false;
  const hd = Math.hypot(hero.x - d.x, hero.y - d.y);
  if (d.mode !== 'follow' && hd < 170 && d.cool <= 0) { d.mode = 'follow'; d.fT = 12 + Math.random() * 10; d.wp = null; if (Math.random() < 0.7) sfxNear(d, 'bark', 0.8); }
  if (d.mode === 'follow') {
    d.fT -= dt;
    if (hd > 78) { d.pose = 'stand'; const t = vilCollide(v, hero.x - hero.facing * 46, hero.y + 8, d.r); walkTo(d, t.x, t.y, dt, v, hd > 160 ? 120 : 88); }
    else { d.moving = false; d.pose = 'sit'; d.f = hero.x >= d.x ? 1 : -1; }
    if (d.fT <= 0 || hd > 420) { d.mode = 'trot'; d.cool = 12 + Math.random() * 10; d.t = 0.5; d.pose = 'stand'; }
    return;
  }
  d.t -= dt;
  if (d.wp) { d.pose = 'stand'; if (walkTo(d, d.wp[0], d.wp[1], dt, v, 62)) { d.wp = null; d.t = 2 + Math.random() * 5; d.pose = Math.random() < 0.5 ? 'sit' : 'sniff'; d.moving = false; } }
  else if (d.t <= 0) {
    d.pose = 'stand'; d.t = 1;
    for (let i = 0; i < 8; i++) {                                   // pick a spot the dog can actually trot to in a straight line
      const w = v.dogWps[Math.floor(Math.random() * v.dogWps.length)];
      if (Math.hypot(w[0] - d.x, w[1] - d.y) > 50 && lineClear(v, d.x, d.y, w[0], w[1], d.r)) { d.wp = w; break; }
    }
  }
}

// ---------------------------------------------------------------- the hero inside the village
function pushOutOfPeople(v) {
  let moved = false;
  for (const n of v.npcs) {
    if (n.inside || n.alpha < 0.5) continue;
    const dx = hero.x - n.x, dy = hero.y - n.y, d = Math.hypot(dx, dy), min = 9 + n.r + 2;
    if (d < min) { const k = d < 0.01 ? 0 : (min - d) / d; hero.x += d < 0.01 ? min : dx * k; hero.y += dy * k; moved = true; }
  }
  if (moved) { const c = vilCollide(v, hero.x, hero.y, 9, undefined, undefined, true); hero.x = c.x; hero.y = c.y; }
}
function updateVillageHero(dt, v) {
  hero.hurtT = 0; hero.flipT = 0; hero.attackT = 0; hero.auraT = Math.max(0, hero.auraT - dt);
  hero.goldPulse = Math.max(0, (hero.goldPulse || 0) - dt * 2);
  hero.potionCd = Math.max(0, (hero.potionCd || 0) - dt);
  hero.stamina = Math.min(maxStamina(), hero.stamina + staminaRegen() * 2 * dt);
  hero.hp = Math.min(hero.maxHp, hero.hp + hero.maxHp * 0.02 * dt);              // safe ground: health returns quickly
  let dx = 0, dy = 0;
  if (v.leaveT <= 0 && !v.skip) {
    if (keys.KeyA || keys.ArrowLeft) dx--; if (keys.KeyD || keys.ArrowRight) dx++;
    if (keys.KeyW || keys.ArrowUp) dy--; if (keys.KeyS || keys.ArrowDown) dy++;
  }
  hero.moving = !!(dx || dy);
  pushOutOfPeople(v);                                                   // someone walked into you: step aside rather than overlap
  if (hero.moving) {
    const len = Math.hypot(dx, dy), spd = moveSpeed() * 0.92;
    const c = vilCollide(v, hero.x + dx / len * spd * dt, hero.y + dy / len * spd * dt, 9, hero.x, hero.y, true);
    hero.x = c.x; hero.y = c.y;
    if (dx) hero.facing = Math.sign(dx);
    hero.walkT += dt * stepRate(moveSpeed(), HERO_STRIDE);
    hero.stepT -= dt;
    if (hero.stepT <= 0) {
      hero.stepT = 0.32;
      const onRoad = Math.abs(hero.y - VIL_ROAD) < 26 || inEllipse(hero.x, hero.y, v.plaza, 0);
      Sound.step(onRoad ? 'stone' : v.B.surface);
    }
  } else hero.walkT = 0;
  const neck = { x: hero.x - hero.facing * 2, y: hero.y - 46 }, sc = hero.scarf;      // scarf: same rope as in play
  sc[0].x = neck.x; sc[0].y = neck.y;
  for (let i = 1; i < sc.length; i++) {
    const p = sc[i], q = sc[i - 1];
    p.x += (-hero.facing * 40 + Math.sin(tAnim * 6 + i) * 18) * dt; p.y += (25 + Math.cos(tAnim * 5 + i) * 10) * dt;
    const ddx = p.x - q.x, ddy = p.y - q.y, dl = Math.hypot(ddx, ddy) || 1;
    p.x = q.x + ddx / dl * 5; p.y = q.y + ddy / dl * 5;
  }
}

function updateVillage(dt) {
  const v = vil; if (!v || !hero) return;
  tAnim += dt; v.t += dt;
  if (!(v.skip && v.skip.t > 0.3 && !v.skip.done)) { const before = tod; tod = (tod + dt / DAY_LEN) % 1; if (tod < before) dayCount++; }
  curNight = night01();
  v.fade = Math.max(0, v.fade - dt * 1.4);
  if (v.skip) {
    v.skip.t += dt;
    const sk = v.skip;
    if (sk.t > 0.9 && sk.t < SLEEP_WAKE - 0.2 && (sk.snoreT -= dt) <= 0) { sk.snoreT = 0.95; sfx('snore'); }
    if (sk.t >= SLEEP_WAKE && !sk.done) {
      sk.done = true; tod = sk.to; dayCount += sk.days; curNight = night01(); settleVillage(v);
      if (sk.rest) { hero.hp = hero.maxHp; hero.stamina = maxStamina(); saveGame(false); sfx('save'); popups.push({ text: 'Rested and fully healed · progress saved', x: VW / 2, y: 150, t: 2.6, big: true, screen: true, color: '#fff' }); }
      else popups.push({ text: `${sk.label}: ${campClockLabel(tod)} · Day ${dayCount}`, x: VW / 2, y: 150, t: 2.6, big: true, screen: true, color: '#fff' });
      if (night01() < 0.3) Sound.call('birdsong');
    }
    if (sk.t >= SLEEP_LEN) v.skip = null;
  }
  if (v.leaveT > 0) { v.leaveT -= dt; if (v.leaveT <= 0 && !v.doneLeave) { v.doneLeave = true; leaveVillage(); return; } }
  updateVillageHero(dt, v);
  for (const n of v.npcs) npcTick(n, dt, v);
  for (const a of v.animals) animalTick(a, dt, v);
  for (const h of v.hens) animalTick(h, dt, v);
  for (const p of v.plants) p.wet = Math.max(0, p.wet - dt * 0.4);
  // chimney smoke, lazily
  v.smokeT -= dt;
  if (v.smokeT <= 0) { v.smokeT = 0.35; for (const b of v.buildings) if (inView(b.chim.x, b.chim.y, 160)) vfx(v, { x: b.chim.x, y: b.chim.y, vx: 8 + Math.random() * 6, vy: -16 - Math.random() * 8, life: 3 + Math.random(), size: 3, color: 'rgba(210,210,215,0.45)', smoke: true }); }
  for (const f of v.fx) { f.life -= dt; f.vy += f.grav * dt; f.x += f.vx * dt; f.y += f.vy * dt; if (f.smoke) f.size += dt * 2.2; }
  v.fx = v.fx.filter(f => f.life > 0);
  // what can the hero talk to?
  let best = null, bd = 1e9;
  const consider = (kind, ref, x, y, r, label, tag) => { const d = Math.hypot(hero.x - x, hero.y - y); if (d < r && d < bd) { bd = d; best = { kind, ref, x, y, label, tag }; } };
  for (const n of v.npcs) if (!n.inside && n.alpha > 0.5 && !n.goHome) consider('npc', n, n.x, n.y, n.shop ? 72 : 64, n.name, n.role);
  if (Math.abs(hero.x - v.gate.x) < 110 && Math.abs(hero.y - v.gate.y) < 80) consider('gate', null, v.gate.x - 24 * v.E, v.gate.y - 40, 999, 'The road', 'Leave the village');
  consider('board', null, v.board.x, v.board.y - 40, 70, 'Notice board', 'Read');
  if (!best) consider('dog', v.dog, v.dog.x, v.dog.y - 14, 46, 'Biscuit', 'Pet');     // the dog never steals the prompt from a person
  v.near = best;
  // camera
  const vw = VW / VIL_ZOOM, vh = VH / VIL_ZOOM;
  const tx = clampN(hero.x - vw / 2, 0, VIL_W - vw), ty = clampN(hero.y - vh / 2 - 12, 0, VIL_H - vh), k = 1 - Math.exp(-dt * 7);
  cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.shake = 0;
  for (const p of popups) { p.t -= dt; if (p.pop !== undefined) p.pop += dt; if (!p.big && !p.screen) p.y -= 30 * dt; }
  popups = popups.filter(p => p.t > 0);
  v.soundT -= dt;
  if (v.soundT <= 0) { v.soundT = 0.5; Sound.setScene({ biome: 'village', night: curNight > 0.5, wind: 0.02, rain: 0, pitch: 450 }); }
}

// ---------------------------------------------------------------- entering and leaving
function enterVillage() {
  if (state !== 'play' || vil) return;
  for (const k in keys) keys[k] = false;
  hero.flipT = 0; hero.attackT = 0; hero.hitSet = null; hero.moving = false; hero.hurtT = 0;
  projectiles = []; shockwaves = []; clearHazards(); clearPoison(); popups = popups.filter(p => p.screen);
  vil = buildVillage();
  vil.ret = { x: hero.x, y: hero.y };
  curNight = night01();
  hero.x = vil.arrive.x; hero.y = vil.arrive.y; hero.facing = vil.E;
  hero.scarf.forEach(p => { p.x = hero.x; p.y = hero.y - 50; });
  const vw = VW / VIL_ZOOM, vh = VH / VIL_ZOOM;
  cam.x = clampN(hero.x - vw / 2, 0, VIL_W - vw); cam.y = clampN(hero.y - vh / 2 - 12, 0, VIL_H - vh);
  state = 'village';
  saveGame(true);                                           // the village is the save point of the set
  popups.push({ text: `— ${vil.name} —`, x: VW / 2, y: 190, t: 3.2, big: true, screen: true, color: '#fff' });
  Sound.music('village');
  Sound.setScene({ biome: 'village', night: curNight > 0.5, wind: 0.02, rain: 0, pitch: 450 });
  sfx('unlock');
}
function leaveVillage() {
  if (!vil) return;
  saveGame(true, true);                                     // purchases are banked before the boss
  const ret = vil.ret;
  vil = null; villageSkip = wave + 1;
  state = 'play';
  hero.x = ret.x; hero.y = ret.y; hero.moving = false; hero.walkT = 0;
  hero.scarf.forEach(p => { p.x = hero.x; p.y = hero.y - 50; });
  cam.x = clampN(hero.x - VW / 2, 0, WW - VW); cam.y = clampN(hero.y - VH / 2 - 20, 0, WH - VH);
  for (const k in keys) keys[k] = false;
  waveTimer = 1.6; acc = 0; sceneT = 0;
  popups = popups.filter(p => p.screen);
  popups.push({ text: 'The road ahead is guarded...', x: VW / 2, y: 190, t: 2.6, big: true, screen: true, color: '#f88' });
  Sound.music(BIOMES[zone % BIOMES.length].music);
}

// ---------------------------------------------------------------- talking and shopping (HTML panels)
// What people say depends on who you are right now: the time of day, your health, gold, pack and how far you have got.
// {name} {village} {biome} {wave} {tier} are filled in. A villager greets you properly the first time you speak this visit.
const HELLO = {
  mira: ['Ah, a customer! Welcome to {village}, {name}.', 'Mind the fumes, {name}. Come in, come in.'],
  tobin: ['Welcome, welcome! Tobin, General Store. You must be {name}.', 'A hero in {village}! Come and see what I have.'],
  hilda: ['Welcome to {village}, dear. Hilda keeps the inn, and the fire, and the peace.', '{name}! The road has been hard on you, I can tell. Sit, sit.'],
  brann: ['Hm. {name}. Brann. Forge is hot, so be quick.', 'A hero. Good. Heroes break a lot of iron.'],
  dagna: ['Dagna, armourer. Let me look at what you are wearing... hm. We can do better.', 'Welcome, {name}. Steel is cheaper than a funeral.'],
  lysa: ['Oh, hello! Lysa. Small things, big luck. Have a look.', 'Welcome, {name}. Careful, everything here is worth more than it looks.'],
  pim: ['Well met, {name}! Mind the cabbages.', 'A visitor! Come to admire the garden?'],
  rurik: ['Rurik. Woodcutter. Watch your feet.', 'Hello there, {name}. Mind the chips.'],
  orla: ['Hello, dear. Sit a while, you look like you could use it.', 'Ah, the hero. {village} has been talking about you.'],
  voss: ['Sergeant Voss. {village} is under my watch.', 'Halt. State your... oh. The hero. Carry on.'],
  eira: ['Welcome, {name}. I am Eira. I keep the Shrine of Return, and I have been expecting you.', 'Ah. A traveller with a long road behind them. Come and see the shrine.'],
};
function contextLines(n) {
  const h = hero, out = [], night = night01() > 0.5, hpf = h.hp / h.maxHp, morning = tod > 0.28 && tod < 0.45, id = n.id;
  const all = (c, t) => { if (c) out.push(t); };
  all(h.points > 0, 'You have ' + h.points + ' stat point' + (h.points === 1 ? '' : 's') + ' unspent, {name}. Press M and put them to use before you head out.');
  all(hpf < 0.5, 'You look worse for wear, {name}. Mind yourself out there.');
  all(wave >= 19, 'Wave {wave} already. Tier {tier} beasts out there. You are braver than most.');
  if (id === 'mira') { all(!h.potions, 'No potions on you? That is how heroes end up in a ditch. Buy a few.'); all(h.potions >= POTION_MAX, 'A full satchel of potions. Good. Now do not waste them.'); all(hasAilment() && !h.cures, 'Poisoned, and not a Cure-All on you? Take one of mine. Please.'); all(!h.cures && h.level >= 8, 'A Cure-All potion clears poison and chills. Press R to switch to it, Q to drink.'); all(night, 'Night brews best. The fumes are... livelier.'); }
  if (id === 'tobin') { all(night, 'A lantern at night is worth ten swords, mark me.'); all((h.lamp | 0) >= 3, 'The Radiant Lantern! My finest. Lights up half the road.'); all((h.lamp | 0) === 0 && h.gold >= 140, 'You can afford a lantern now. The dark hides things that bite.'); all(h.gold < 30, 'Empty pockets? Come back when the beasts have been generous.'); }
  if (id === 'hilda') { all(night, 'The inn is quiet tonight. If you want the hours to pass, I can sort that.'); all(morning, 'Good morning, {name}. Porridge is on, and the day is yours.'); all(hpf < 0.5, 'Sit down before you fall down. A rest is free, dear.'); }
  if (id === 'brann') { all(h.inv.length >= INV_MAX - 2, 'Your pack is nearly bursting. Sell me the junk.'); all(h.gold >= 600, 'Coin to burn? Let me temper that gear for you.'); all(night, 'Fire never sleeps. Neither do I, when there is iron to turn.'); }
  if (id === 'dagna') { all(!h.equip.armor, 'No armour at all? Brave. Foolish, but brave. Have a look.'); all(!h.equip.helmet, 'A hero without a helm. One knock and that is the end of the story.'); }
  if (id === 'lysa') { all(!h.equip.ring1 && !h.equip.ring2, 'Bare fingers! A ring will fix that. Take your pick.'); all(!h.equip.necklace, 'Not a necklace on you. I have just the thing.'); }
  if (id === 'pim') { all(morning, 'Best time to water is the morning. The plants drink it up.'); all(night, 'You should be indoors in this dark. I will see to the beds tomorrow.'); }
  if (id === 'rurik') { all(night, 'Cannot chop in the dark, can I? The axe knows when to rest.'); all(wave >= 10, 'The trees by the road thin out every set. Whatever is out there, it is hungry.'); }
  if (id === 'orla') { all(night, 'The night air is bad for old bones. Come and tell me a story in the morning.'); all(h.level >= 10, 'Level {name}... such a hero. In my day we just had a stout stick.'); }
  if (id === 'eira') { all(h.level >= levelCap(), 'You have climbed as far as you can, {name}. The shrine is ready for you whenever you are.'); all(h.level < levelCap(), 'Level {name}... not yet at the top. Come back at level ' + levelCap() + '.'); all(rebirths() > 0, 'Reborn ' + rebirths() + ' time' + (rebirths() === 1 ? '' : 's') + ' already. The shrine knows you.'); }
  if (id === 'voss') { all(hpf < 0.7, 'You are bleeding, {name}. See the innkeeper before you go out that gate.'); all(h.potions === 0, 'Not a single potion? I would not walk that road without one.'); }
  if (n.kid) { all(h.gold >= 400, 'Whoa, you have so much gold! Are you rich?'); all(night, 'Mum says I should be in bed...'); }
  return out;
}
function talkText(n) {
  const v = vil, fill = t => t.replace(/\{name\}/g, hero.name).replace(/\{village\}/g, v.name).replace(/\{biome\}/g, v.B.name).replace(/\{wave\}/g, String(wave)).replace(/\{tier\}/g, String(tierOf(wave)));
  if (!n.met && HELLO[n.id]) { n.met = true; return fill(HELLO[n.id][Math.floor(Math.random() * HELLO[n.id].length)]); }
  n.met = true;
  const ctxL = contextLines(n), pool = n.lines.length ? n.lines : ['...'];
  const useCtx = ctxL.length && (Math.random() < 0.55 || n.lastCtxMiss > 1);
  n.lastCtxMiss = useCtx ? 0 : (n.lastCtxMiss | 0) + 1;
  const from = useCtx ? ctxL : pool;
  let i = Math.floor(Math.random() * from.length); if (from.length > 1 && from[i] === n.lastLine) i = (i + 1) % from.length;
  n.lastLine = from[i];
  return fill(from[i]);
}
// ---------------------------------------------------------------- waiting at the inn
const TIME_STOPS = [['Dawn', 0.27], ['Sunrise', 0.30], ['Morning', 0.38], ['Midday', 0.50], ['Sunset', 0.76], ['Dusk', 0.82], ['Night', 0.90], ['Midnight', 0.0]];
const timeUntil = at => ((at - tod) % 1 + 1) % 1;                       // how much of a day until the clock reaches `at`, always forwards
const SLEEP_LEN = 4.2, SLEEP_WAKE = 2.3;                                 // seconds in all; the clock jumps at SLEEP_WAKE
function startTimeSkip(at) {
  const v = vil; if (!v || v.skip) return;
  const d = at === null ? 0 : (timeUntil(at) || 1);                       // null = a plain rest: the clock stays where it is
  v.skip = { from: tod, span: d, to: (tod + d) % 1, days: Math.floor(tod + d + 1e-9), t: 0, done: false, rest: at === null, snoreT: 0, label: at === null ? 'Rested' : (TIME_STOPS.find(x => Math.abs(x[1] - at) < 1e-6) || ['later'])[0] };
  sfx('yawn');
}
// the world catches up with the new time: people are home or out, as they would be at that hour
function settleVillage(v) {
  const nt = night01();
  for (const n of v.npcs) {
    if (!n.nightHome) continue;
    if (nt > 0.55) { n.inside = true; n.alpha = 0; n.cur = null; n.queue = null; n.goHome = false; n.fadeOut = false; n.exiting = false; n.carry = null; n.moving = false; }
    else if (nt < 0.3 && (n.inside || n.goHome)) {
      n.inside = false; n.goHome = false; n.fadeOut = false; n.alpha = 1; n.x = n.home.x; n.y = n.home.y; n.cur = null; n.carry = null;
      n.queue = homeRoute(n, v, 'out'); n.exiting = n.queue.length > 0;
    }
  }
  const dog = v.dog;
  if (nt > 0.55) { dog.x = v.sleepAt.x; dog.y = v.sleepAt.y; dog.pose = 'sleep'; dog.moving = false; dog.mode = 'trot'; dog.wp = null; }
  else if (dog.pose === 'sleep') { dog.pose = 'stand'; dog.t = 0.5; }
}

function villageInteract() {
  const v = vil; if (!v || !v.near || v.leaveT > 0 || v.skip || paused) return;
  const t = v.near;
  if (t.kind === 'dog') { v.dog.petT = 3; v.dog.pose = 'sit'; v.dog.f = hero.x >= v.dog.x ? 1 : -1; v.dog.moving = false; sfx('chirp'); sfxNear(v.dog, 'bark', 0.5); for (let i = 0; i < 4; i++) vfx(v, { x: v.dog.x + (Math.random() - 0.5) * 16, y: v.dog.y - 26, vx: (Math.random() - 0.5) * 20, vy: -30, life: 1, size: 3, color: '#ff7a9a' }); return; }
  if (t.kind === 'npc') { const n = t.ref; n.f = hero.x >= n.x ? 1 : -1; hero.facing = n.x >= hero.x ? 1 : -1; n.moving = false; }
  v.talk = t; openTalk();
}
function openTalk(text, override) {
  const v = vil, t = v.talk; if (!t) return;
  let name = '', role = '', body = text, btns = [];
  if (t.kind === 'npc') {
    const n = t.ref; name = n.name; role = n.role; body = body || talkText(n);
    if (n.shop === 'alch') btns.push(['shop', 'Browse potions']);
    if (n.shop === 'store') btns.push(['shop', 'Browse wares']);
    if (n.shop === 'armour') btns.push(['shop', 'Browse armour']);
    if (n.shop === 'jewel') btns.push(['shop', 'Browse jewellery']);
    if (n.shop === 'smith') btns.push(['shop:smithBuy', 'Buy weapons'], ['shop:smithUp', 'Upgrade gear'], ['shop:smithSell', 'Sell gear']);
    if (n.special === 'inn') btns.push(['rest', 'Rest and save (free)'], ['wait', 'Wait for a time of day...'], ['respec', `Reset stat points (${respecCost()} gold)`]);
    if (n.special === 'guard') btns.push(['go', 'Head out to face the boss']);
    if (n.special === 'shrine') btns.push(['shop:rebirth', hero.level >= levelCap() ? 'The Shrine of Return (rebirth)' : `The Shrine of Return (see what rebirth gives)`]);
    btns.push(['bye', 'Goodbye']);
    n.talking = true;
  } else if (t.kind === 'gate') {
    name = 'The Road'; role = 'Leave the village';
    body = body || `The road beyond the gate leads to the boss (wave ${wave + 1}). Your progress is saved when you leave. Head out?`;
    btns = [['go', 'Head out'], ['bye', 'Stay a while']];
  } else if (t.kind === 'board') {
    name = 'Notice board'; role = vil.name;
    body = body || ['NOTICE: The road beyond the gate is dangerous. Heroes are advised to rest, resupply and heal before departing.', 'WANTED: Brave souls to deal with the beast on the road. Reward: our eternal gratitude.', 'LOST: One red ball. If found, return to the children. -- Pip', 'FOR SALE: Lanterns. Inquire with Tobin at the General Store.', 'REMINDER: Biscuit the dog is not a guard dog. Please stop asking him to guard things.'][Math.floor(Math.random() * 5)];
    btns = [['bye', 'Close']];
  }
  const col = t.kind === 'npc' ? (t.ref.look.body || t.ref.look.dress || '#8a8aa0') : '#c9a86a';
  const badge = t.kind === 'npc' ? `<span class="avatar" style="background:${col}">${escapeHtml(name.replace(/^(Old|Granny|Sgt\.)\s+/, '').charAt(0))}</span>` : '';
  document.getElementById('talkName').innerHTML = `${badge}${escapeHtml(name)} <small>${escapeHtml(role)}</small>`;
  document.getElementById('talkText').textContent = body;
  document.getElementById('talkBtns').innerHTML = (override || btns).map(([k, l, off], i) => `<button data-talk="${k}" ${off ? 'disabled' : ''}><kbd>${i + 1}</kbd>${escapeHtml(l)}</button>`).join('');
  showMenu('talk');
}
document.getElementById('talk').addEventListener('click', e => {
  const k = e.target.dataset && e.target.dataset.talk; if (!k || !vil) return;
  sfx('click');
  const v = vil, t = v.talk;
  if (k === 'bye') { if (t && t.kind === 'npc') t.ref.talking = false; v.talk = null; showMenu(null); }
  else if (k === 'go') { v.talk = null; v.leaveT = 0.9; showMenu(null); }
  else if (k === 'back') openTalk();
  else if (k === 'wait') {
    openTalk('Hours go by quickly in a warm room. When shall I wake you?', [...TIME_STOPS.map(([label, at]) => {
      const d = timeUntil(at), now = d < 0.012 || d > 0.988;
      return [`time:${at}`, `${label} (${campClockLabel(at)})${now ? ': it is about that now' : ''}`, now];
    }), ['back', 'Never mind']]);
  }
  else if (k.startsWith('time:')) { v.talk = null; showMenu(null); startTimeSkip(parseFloat(k.slice(5))); }
  else if (k === 'shop') { v.shop = t.ref.shop; showMenu('shop'); }
  else if (k.startsWith('shop:')) { v.shop = k.slice(5); v.rbArm = false; showMenu('shop'); }
  else if (k === 'rest') {
    v.talk = null; showMenu(null); startTimeSkip(null);
  }
  else if (k === 'respec') {
    const n = spentPoints(), cost = respecCost();
    if (n <= 0) openTalk("You haven't spent any stat points yet, dear. Nothing to take back.");
    else if (hero.gold < cost) openTalk(`I can take back your ${n} spent point${n === 1 ? '' : 's'} so you can choose again, but it costs ${cost} gold, and you only have ${hero.gold}.`);
    else openTalk(`I can take back your ${n} spent point${n === 1 ? '' : 's'} so you can choose again. That is ${cost} gold. Your stats go back to zero until you spend the points again (press M). Shall I?`,
      [['respecYes', `Yes, reset (${cost} gold)`], ['bye', 'No, keep my stats']]);
  }
  else if (k === 'respecYes') {
    const n = spentPoints();
    if (respecStats()) { sfx('unlock'); popups.push({ text: `${n} stat point${n === 1 ? '' : 's'} returned: press M to spend them`, x: VW / 2, y: 120, t: 3, screen: true, small: true, color: '#fd4' }); openTalk('Done. Your points are yours to spend again. Press M when you are ready.'); }
    else openTalk('Hm, something is off. Come back when you have the gold.');
  }
});

function renderShop() {
  const v = vil; if (!v || !v.shop) return;
  if (v.shop === 'rebirth') { renderRebirth(); return; }
  if (v.shop === 'smith' || v.shop === 'smithSell') { renderSellShop(); return; }
  if (v.shop === 'smithBuy' || v.shop === 'armour' || v.shop === 'jewel') { renderGearShop(v.shop); return; }
  if (v.shop === 'smithUp') { renderUpgradeShop(); return; }
  const alch = v.shop === 'alch';
  document.getElementById('shopTitle').textContent = alch ? "MIRA'S POTIONS" : "TOBIN'S GENERAL STORE";
  document.getElementById('shopGold').textContent = hero.gold.toLocaleString();
  let rowNo = 0;
  const row = (id, name, desc, price, stockTxt, can, label) => `<div class="item"><div class="ic ${id}"></div><div class="im"><b>${name}</b><small>${desc}</small></div>
    <div class="pr"><span class="price">${price.toLocaleString()} g</span><small>${stockTxt}</small></div>
    <button data-buy="${id}" ${can ? '' : 'disabled'}><kbd>${++rowNo}</kbd>${label}</button></div>`;
  let html = '';
  if (alch) {
    const price = potionCost(), left = v.stock.potion | 0, have = hero.potions | 0;
    const can = hero.gold >= price && left > 0 && have < POTION_MAX;
    html += row('potion', 'Healing Potion', `Restores ${Math.round(POTION_HEAL * 100)}% of your health. You carry ${have} of ${POTION_MAX}.`, price, left > 0 ? `${left} in stock` : 'Sold out', can, have >= POTION_MAX ? 'Full' : left <= 0 ? 'Sold out' : 'Buy');
    const cp = cureCost(), cl = v.stock.cure | 0, ch = hero.cures | 0;
    html += row('cure', 'Cure-All Potion', `Removes poison and chill, and every other ailment. Press R to switch potions, Q to drink. You carry ${ch} of ${POTION_MAX}.`, cp, cl > 0 ? `${cl} in stock` : 'Sold out', hero.gold >= cp && cl > 0 && ch < POTION_MAX, ch >= POTION_MAX ? 'Full' : cl <= 0 ? 'Sold out' : 'Buy');
  } else {
    const tier = (hero.lamp | 0) + 1, L = LAMPS[tier];
    if (L) html += row('lamp', L.name, `Widens the circle of light around you at night and in fog by +${L.bonus}. ${hero.lamp ? 'Replaces your current lantern.' : ''}`, L.cost, `Lantern ${tier} of ${LAMPS.length - 1}`, hero.gold >= L.cost, 'Buy');
    else html += '<div class="hint" style="text-align:center">You already carry the finest lantern Tobin has ever sold.</div>';
    const cur = LAMPS[hero.lamp | 0];
    html += `<div class="hint">Your light: base ${BASE_LIGHT_RADIUS}${cur ? ` + ${cur.bonus} (${cur.name})` : ''}.</div>`;
  }
  document.getElementById('shopBody').innerHTML = html;
}
// ---------------------------------------------------------------- gear for sale: Brann's weapons, Dagna's armour, Lysa's jewellery
// Stock is rolled when you arrive (a little better the deeper you are) and is gone once bought; the next village has new stock.
const gearPrice = it => Math.max(18, Math.round(it.value * 3.4));
function makeStock(v) {
  const depth = depthOf() + 0.4, level = hero.level + 2;
  const roll = slot => {
    let it = rollItem({ slot, tier: depth, level });
    if (it.rarity < 1 || it.rarity > 5) it = rollItem({ slot, rarity: Math.max(1, Math.min(5, it.rarity)), level });     // shops never sell Broken, Mythical or Secret pieces
    return { item: it, price: gearPrice(it) };
  };
  v.stock.smith = ['weapon', 'weapon', 'weapon', 'weapon'].map(roll);
  v.stock.armour = ['armor', 'armor', 'helmet', 'helmet'].map(roll);
  v.stock.jewel = ['ring', 'ring', 'necklace', 'necklace'].map(roll);
}
const gearScore = it => Object.entries(it.stats).reduce((a, [k, x]) => a + x / GEAR_STATS[k].max, 0);
const statLine = it => Object.entries(it.stats).map(([k, x]) => `${GEAR_STATS[k].name} ${GEAR_STATS[k].fmt(x)}`).join(' · ');
const slotOf = it => it.slot === 'ring' ? 'ring1' : it.slot;
function renderGearShop(kind) {
  const v = vil, stockKey = kind === 'smithBuy' ? 'smith' : kind, list = v.stock[stockKey] || [];
  document.getElementById('shopTitle').textContent = { smithBuy: "BRANN'S FORGE: WEAPONS", armour: "DAGNA'S ARMOURY", jewel: "LYSA'S JEWELLERY" }[kind];
  document.getElementById('shopGold').textContent = hero.gold.toLocaleString();
  let html = '', n = 0;
  list.forEach((e, i) => {
    if (!e) return;
    const it = e.item, R = RARITIES[it.rarity], worn = hero.equip[slotOf(it)];
    const lock = it.slot === 'weapon' && it.req > hero.level, bagFull = hero.inv.length >= INV_MAX, can = hero.gold >= e.price && !bagFull;
    const better = gearScore(it) > (worn ? gearScore(worn) : 0) + 1e-9;
    const base = it.slot === 'weapon' ? SWORDS.find(x => x.id === it.base) : null;
    html += `<div class="item"><div class="ic" style="border-color:${R.color}">${slotSvg(it.slot, R.color)}</div><div class="im"><b style="color:${R.color}">${escapeHtml(it.name)}</b>
      <small>${R.name} ${SLOT_LABEL[it.slot].toLowerCase()}${base ? ` · base damage ${base.dmg}${lock ? ` · <span style="color:#f88">needs level ${it.req}</span>` : ''}` : ''}${better ? ' · <span style="color:#7fd08a">better than yours</span>' : ''}<br>${escapeHtml(statLine(it))}${it.unique ? '' : ''}</small></div>
      <div class="pr"><span class="price">${e.price.toLocaleString()} g</span></div><button data-buy="buy:${stockKey}:${i}" ${can ? '' : 'disabled'}><kbd>${++n}</kbd>${bagFull ? 'Bag full' : 'Buy'}</button></div>`;
  });
  if (!n) html = '<div class="hint" style="text-align:center">Everything is sold. New stock arrives with the next village.</div>';
  document.getElementById('shopBody').innerHTML = html;
}
// Brann improves gear: each level adds 10% to every stat on the piece
function renderUpgradeShop() {
  document.getElementById('shopTitle').textContent = "BRANN'S FORGE: UPGRADE GEAR";
  document.getElementById('shopGold').textContent = hero.gold.toLocaleString();
  const rows = [...activeSlots().map(k => hero.equip[k]).filter(Boolean).map(it => ({ it, eq: true })), ...hero.inv.map(it => ({ it, eq: false }))].filter(r => Object.keys(r.it.stats).length);
  let html = '', n = 0;
  for (const { it, eq } of rows) {
    const R = RARITIES[it.rarity], up = it.up | 0, max = upgradeMax(it), done = up >= max, cost = upgradeCost(it), can = !done && hero.gold >= cost;
    html += `<div class="item"><div class="ic" style="border-color:${R.color}">${slotSvg(it.slot, R.color)}</div><div class="im"><b style="color:${R.color}">${escapeHtml(it.name)}</b>
      <small>${eq ? 'Worn · ' : ''}Level ${up} of ${max}${done ? ' · fully upgraded' : ' · every stat +10%'}<br>${escapeHtml(statLine(it))}</small></div>
      <div class="pr"><span class="price">${done ? '—' : cost.toLocaleString() + ' g'}</span></div><button data-buy="up:${escapeHtml(it.id)}" ${can ? '' : 'disabled'}><kbd>${++n}</kbd>${done ? 'Max' : 'Upgrade'}</button></div>`;
  }
  if (!rows.length) html = '<div class="hint" style="text-align:center">You have no gear with stats to improve yet. Gear drops from monsters, and bosses always drop some.</div>';
  document.getElementById('shopBody').innerHTML = html;
}

// the blacksmith buys spare gear (equipped pieces are never offered)
function renderSellShop() {
  document.getElementById('shopTitle').textContent = "BRANN'S FORGE: SELL GEAR";
  document.getElementById('shopGold').textContent = hero.gold.toLocaleString();
  const junk = hero.inv.filter(i => i.rarity <= 1), junkSum = junk.reduce((a, i) => a + i.value, 0);
  let html = '', n = 0;
  const kbd = () => `<kbd>${++n}</kbd>`;
  if (hero.inv.length === 0) html = '<div class="hint" style="text-align:center">Your backpack is empty. Gear drops from monsters, and bosses always drop some.</div>';
  else {
    html += `<div class="item"><div class="im"><b>Sell all Broken and Common</b><small>${junk.length} piece${junk.length === 1 ? '' : 's'} of junk</small></div><div class="pr"><span class="price">${junkSum.toLocaleString()} g</span></div><button data-buy="junk" ${junk.length ? '' : 'disabled'}>${kbd()}Sell</button></div>`;
    for (const it of [...hero.inv].sort((a, b) => b.value - a.value)) {
      const R = RARITIES[it.rarity];
      html += `<div class="item"><div class="ic" style="border-color:${R.color}">${slotSvg(it.slot, R.color)}</div><div class="im"><b style="color:${R.color}">${escapeHtml(it.name)}</b><small>${R.name} ${SLOT_LABEL[it.slot].toLowerCase()}</small></div><div class="pr"><span class="price">${it.value.toLocaleString()} g</span></div><button data-buy="sell:${escapeHtml(it.id)}">${kbd()}Sell</button></div>`;
    }
  }
  document.getElementById('shopBody').innerHTML = html;
}
document.getElementById('shop').addEventListener('click', e => {
  const id = e.target.closest('[data-buy]') && e.target.closest('[data-buy]').dataset.buy; if (!id || !vil) return;
  if (id.startsWith('rb:')) { rebirthClick(id); return; }
  const say = (text, color) => popups.push({ text, x: VW / 2, y: 120, t: 1.6, screen: true, small: true, color });
  if (id === 'junk' || id.startsWith('sell:')) {
    const sold = id === 'junk' ? hero.inv.filter(i => i.rarity <= 1) : hero.inv.filter(i => i.id === id.slice(5));
    if (!sold.length) { sfx('tired'); return; }
    const gold = sold.reduce((a, i) => a + i.value, 0);
    hero.inv = hero.inv.filter(i => !sold.includes(i)); hero.gold += gold; hero.goldPulse = 0.6;
    say(`Sold ${sold.length === 1 ? sold[0].name : sold.length + ' pieces'} for ${gold} gold`, '#f5c451'); sfx('coin'); saveGame(true, true); renderShop();
    return;
  }
  if (id.startsWith('buy:')) {
    const [, key, idx] = id.split(':'), list = vil.stock[key], e = list && list[+idx];
    if (!e || hero.gold < e.price || hero.inv.length >= INV_MAX) { sfx('tired'); return; }
    hero.gold -= e.price; hero.inv.push(e.item); list[+idx] = null;
    say(`Bought ${e.item.name}`, RARITIES[e.item.rarity].color); hero.goldPulse = 0.6; sfx('coin'); saveGame(true, true); renderShop();
    return;
  }
  if (id.startsWith('up:')) {
    const it = activeSlots().map(k => hero.equip[k]).concat(hero.inv).find(i => i && i.id === id.slice(3));
    const cost = it ? upgradeCost(it) : 0;
    if (!it || !canUpgrade(it) || hero.gold < cost) { sfx('tired'); return; }
    hero.gold -= cost; upgradeItem(it);
    if (activeSlots().some(k => hero.equip[k] === it)) recalcGear();
    say(`${it.name}: upgraded`, RARITIES[it.rarity].color); hero.goldPulse = 0.6; sfx('unlock'); Sound.sfxAt('hammer', 1); saveGame(true, true); renderShop();
    return;
  }
  if (id === 'cure') {
    const price = cureCost();
    if (hero.gold < price || (vil.stock.cure | 0) <= 0 || (hero.cures | 0) >= POTION_MAX) { sfx('tired'); return; }
    hero.gold -= price; hero.cures = (hero.cures | 0) + 1; vil.stock.cure--; say('Bought a Cure-All Potion', '#4fd69c');
  } else if (id === 'potion') {
    const price = potionCost();
    if (hero.gold < price || (vil.stock.potion | 0) <= 0 || (hero.potions | 0) >= POTION_MAX) { sfx('tired'); return; }
    hero.gold -= price; hero.potions = (hero.potions | 0) + 1; vil.stock.potion--; say('Bought a Healing Potion', '#7fd08a');
  } else if (id === 'lamp') {
    const L = LAMPS[(hero.lamp | 0) + 1];
    if (!L || hero.gold < L.cost) { sfx('tired'); return; }
    hero.gold -= L.cost; hero.lamp = (hero.lamp | 0) + 1; applyLamp(); say(`Bought the ${L.name}`, '#ffd88a');
  }
  hero.goldPulse = 0.6; sfx('coin'); saveGame(true, true); renderShop();
});

// ---------------------------------------------------------------- drawing
function drawVillage() {
  const v = vil; if (!v) return;
  const night = night01(); curNight = night;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, VH);
  const Z = VIL_ZOOM, vw = VW / Z, vh = VH / Z;
  const cx = Math.round(cam.x * Z) / Z, cy = Math.round(cam.y * Z) / Z;           // whole screen pixels, so the ground never shimmers
  ctx.save(); ctx.scale(Z, Z); ctx.translate(-cx, -cy);
  ctx.drawImage(v.ground, cx * Z, cy * Z, VW, VH, cx, cy, vw, vh);
  const things = [];
  const vis = (x, y, m) => x > cam.x - m && x < cam.x + vw + m && y > cam.y - m && y < cam.y + vh + m * 1.5;
  for (const s of v.statics) if (s.y > cam.y - 40 && s.y < cam.y + vh + 240) things.push(s);
  for (const n of v.npcs) if (!n.inside && n.alpha > 0.02 && vis(n.x, n.y, 100)) things.push({ y: n.y, d: () => drawVillager(n) });
  for (const a of v.animals) if (vis(a.x, a.y, 80)) things.push({ y: a.y, d: () => drawDog(a) });
  for (const h of v.hens) if (vis(h.x, h.y, 80)) things.push({ y: h.y, d: () => drawHen(h) });
  things.push({ y: v.ball.y, d: () => VPROP.ball(v.ball) });
  things.push({ y: hero.y, d: () => drawHero(hero) });
  things.sort((a, b) => a.y - b.y).forEach(o => o.d());
  if (dev.hitboxes) drawVillageHitboxes(v);
  // particles
  for (const f of v.fx) {
    const a = Math.max(0, Math.min(1, f.life / f.max));
    ctx.save(); if (f.add) ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = f.smoke ? a * 0.5 : a; ctx.fillStyle = f.color;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  // speech bubbles and the talk prompt sit on top of everything
  for (const n of v.npcs) if (n.bubble && !n.inside && n.alpha > 0.5) drawBubble(n.x, n.y - 82 * n.scale, n.bubble, Math.min(1, n.bubbleT * 2));
  if (v.near && !v.talk && v.leaveT <= 0) {
    const t = v.near, ty = t.kind === 'npc' ? t.ref.y - 100 * t.ref.scale : t.y - 14;
    const bob = Math.sin(tAnim * 5) * 2;
    ctx.save(); ctx.fillStyle = 'rgba(20,20,28,0.88)'; ctx.strokeStyle = '#f5c451'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(t.x - 11, ty - 11 + bob, 22, 22, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f5c451'; ctx.font = 'bold 14px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('E', t.x, ty + 5 + bob);
    ctx.restore();
  }
  ctx.restore();

  // time of day: tint, then warm light pools from lamps, windows, the forge and the hero's lantern
  const sky = skyNow();
  if (sky.dark > 0.004) {
    ctx.save(); ctx.globalCompositeOperation = 'multiply';
    const [r, g, b] = sky.c; ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(0.95, sky.dark * 1.05)})`; ctx.fillRect(0, 0, VW, VH); ctx.restore();
  }
  if (night > 0.04) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const pool = (x, y, rad, rgb, a) => {
      const sx = (x - cx) * Z, sy = (y - cy) * Z; rad *= Z; if (sx < -rad || sx > VW + rad || sy < -rad || sy > VH + rad) return;
      const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, rad); g.addColorStop(0, `rgba(${rgb},${a * night})`); g.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = g; ctx.fillRect(sx - rad, sy - rad, rad * 2, rad * 2);
    };
    for (const l of v.lamps) pool(l.x, l.y, 115, '255,205,120', 0.30 + Math.sin(tAnim * 3 + l.x) * 0.02);
    for (const b of v.buildings) { for (const dx of winOffsets(b.w)) pool(b.x + dx, b.y - b.wh * 0.62, 52, '255,200,110', 0.26); pool(b.door.x, b.y - 12, 46, '255,190,100', 0.2); }
    pool(v.forge.x, v.forge.y - 18, 105, '255,150,60', 0.42 + Math.sin(tAnim * 9) * 0.04);
    pool(hero.x, hero.y - 30, 70 + (hero.lamp | 0) * 14, '255,225,170', 0.16);
    ctx.restore();
  }
  // fades: in on arrival, out when leaving for the boss
  const out = v.leaveT > 0 ? 1 - Math.max(0, v.leaveT / 0.9) : 0, sk = v.skip ? (v.skip.t < 0.6 ? v.skip.t / 0.6 : v.skip.t < SLEEP_LEN - 0.7 ? 1 : Math.max(0, 1 - (v.skip.t - (SLEEP_LEN - 0.7)) / 0.7)) : 0, black = Math.max(v.fade, out, sk);
  if (black > 0) { ctx.fillStyle = `rgba(2,3,10,${black})`; ctx.fillRect(0, 0, VW, VH); }
  if (v.skip && sk > 0.7) drawSleepScene(v.skip, sk);
  if (!(v.skip && sk > 0.7)) drawVillageHUD(v);                                       // the dream has the whole screen
  drawPopups(true);
}

// the dream: the hero asleep in a bed, the sun and moon sweeping over, the clock running forward, z's rising
function drawSleepScene(sk, a) {
  const T = sk.t, p = clamp01((T - 0.6) / (SLEEP_WAKE - 0.6)), cx = VW / 2, cy = VH * 0.62;
  const clk = (sk.from + sk.span * p) % 1, fade = clamp01((a - 0.7) / 0.3);
  const day = dayCount + (sk.done ? 0 : Math.floor(sk.from + sk.span * p + 1e-9));
  ctx.save(); ctx.globalAlpha = fade;
  // the sun or moon travels along an arc as the hours pass: noon at the top, midnight below the horizon
  const ax = cx, ay = VH * 0.5, rx = 300, ry = 170, ang = Math.PI * 2 * (clk - 0.25);
  const nightNow = Math.sin(ang) < 0, ang2 = nightNow ? ang + Math.PI : ang;                                // by night the moon takes the same arc, rising where the sun set
  const bx = ax + Math.cos(ang2) * rx, by = ay - Math.sin(ang2) * ry;
  for (let i = 0; i < 26; i++) { const sx = (i * 197 + 41) % VW, sy = (i * 83 + 17) % (VH * 0.4), tw = 0.5 + 0.5 * Math.sin(tAnim * 2 + i * 1.7); ctx.fillStyle = `rgba(220,230,255,${(nightNow ? 0.8 : 0.25) * tw})`; ctx.fillRect(sx, sy, 2, 2); }
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(ax, ay, rx, ry, 0, Math.PI, 0); ctx.stroke();
  if (by < ay + 10) {
    if (nightNow) { ctx.fillStyle = '#e8eefc'; ctx.beginPath(); ctx.arc(bx, by, 15, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(2,3,10,0.9)'; ctx.beginPath(); ctx.arc(bx + 7, by - 3, 13, 0, Math.PI * 2); ctx.fill(); }
    else { const g = ctx.createRadialGradient(bx, by, 4, bx, by, 38); g.addColorStop(0, 'rgba(255,230,140,0.9)'); g.addColorStop(1, 'rgba(255,200,80,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, 38, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(bx, by, 14, 0, Math.PI * 2); ctx.fill(); }
  }
  // the bed with the hero under a blanket, breathing slowly
  const br = Math.sin(T * 2.6) * 1.6;
  ctx.fillStyle = '#4a2f1b'; ctx.fillRect(cx - 120, cy + 20, 240, 10); ctx.fillRect(cx - 124, cy - 24, 10, 54); ctx.fillRect(cx + 114, cy - 6, 10, 36);
  ctx.fillStyle = '#d9d2c0'; ctx.beginPath(); ctx.roundRect(cx - 114, cy - 6, 228, 26, 8); ctx.fill();
  ctx.fillStyle = '#f2efe6'; ctx.beginPath(); ctx.roundRect(cx - 108, cy - 16, 52, 18, 8); ctx.fill();
  ctx.fillStyle = '#f4d7b6'; ctx.beginPath(); ctx.arc(cx - 84, cy - 20 + br * 0.2, 12, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cx - 80, cy - 21); ctx.lineTo(cx - 74, cy - 21); ctx.stroke();
  ctx.fillStyle = '#3d4a8a'; ctx.beginPath(); ctx.roundRect(cx - 66, cy - 22 - br, 176, 34 + br, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 2; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(cx - 40 + i * 36, cy - 20 - br); ctx.lineTo(cx - 40 + i * 36, cy + 10); ctx.stroke(); }
  ctx.textAlign = 'center';
  for (let i = 0; i < 4; i++) { const q = (T * 0.55 + i / 4) % 1; ctx.globalAlpha = fade * Math.sin(q * Math.PI); ctx.fillStyle = '#cfe0ff'; ctx.font = `bold ${16 + i * 5}px Georgia, serif`; ctx.fillText('Z', cx - 70 + q * 46 + i * 6, cy - 44 - q * 70); }
  ctx.globalAlpha = fade;
  ctx.fillStyle = '#fff'; ctx.font = `bold 30px ${UI_FONT}`; ctx.fillText(campClockLabel(clk), cx, VH * 0.17);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = `14px ${UI_FONT}`;
  ctx.fillText(sk.rest ? 'Resting...' : `Sleeping until ${sk.label.toLowerCase()}...`, cx, VH * 0.17 + 24);
  ctx.fillText(`Day ${day}`, cx, VH * 0.17 + 44);
  ctx.restore(); ctx.textAlign = 'left';
}

// dev menu > Show hitboxes: what blocks you, how big people are to the collision, and how close you must stand to talk
function drawVillageHitboxes(v) {
  ctx.save(); ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,60,60,0.9)'; ctx.fillStyle = 'rgba(255,60,60,0.12)';
  for (const s of v.solids) {
    if (s.r !== undefined) { ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    else { ctx.fillRect(s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0); ctx.strokeRect(s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0); }
  }
  ctx.strokeStyle = 'rgba(255,150,40,0.95)'; ctx.fillStyle = 'rgba(255,150,40,0.14)';                                  // walls for you only
  for (const s of v.hsolids) { ctx.fillRect(s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0); ctx.strokeRect(s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0); }
  ctx.strokeStyle = 'rgba(80,200,255,0.95)'; ctx.beginPath(); ctx.arc(hero.x, hero.y, 9, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  for (const n of v.npcs) if (!n.inside) { ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.stroke(); }
  for (const a of [...v.animals, ...v.hens]) { ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,220,80,0.5)';
  for (const n of v.npcs) if (!n.inside && (n.shop || n.special)) { ctx.beginPath(); ctx.arc(n.x, n.y, n.shop ? 72 : 64, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}

function drawVillageHUD(v) {
  drawHeroCard(true);
  drawVitals(true);
  drawWaveChip(true);
  // clock chip
  const night = isNight(), x = VW - 164, y = 10;
  hudPanel(x, y, 150, 42, { r: 11 });
  const ccx = x + 22, ccy = y + 20; ctx.fillStyle = night ? '#dfe6f5' : '#ffd36a'; ctx.beginPath(); ctx.arc(ccx, ccy, 8, 0, Math.PI * 2); ctx.fill();
  if (night) { ctx.fillStyle = 'rgba(10,10,16,0.9)'; ctx.beginPath(); ctx.arc(ccx + 3.5, ccy - 2.5, 7, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(fitText(`Day ${dayCount}  ${clockLabel()}`, 98, 13, true, 10), x + 40, y + 18);
  ctx.fillStyle = '#a3a1b8'; ctx.fillText(fitText(`${timePhase()} · Village`, 98, 11), x + 40, y + 32);
  // bottom line: what E does here
  if (v.near && !v.talk) {
    const t = v.near, label = t.kind === 'gate' ? 'E  Leave the village' : t.kind === 'dog' ? 'E  Pet Biscuit' : t.kind === 'board' ? 'E  Read the notice board' : `E  Talk to ${t.label}${t.tag ? ' · ' + t.tag : ''}`;
    const lbl = fitText(label, VW - 120, 13, true, 10), w = ctx.measureText(lbl).width + 30;
    hudPanel(VW / 2 - w / 2, VH - 100, w, 30, { r: 10, edge: 'rgba(245,196,81,0.55)' });
    ctx.fillStyle = '#f5c451'; ctx.textAlign = 'center'; ctx.fillText(lbl, VW / 2, VH - 80);
  }
  ctx.textAlign = 'left';
}
