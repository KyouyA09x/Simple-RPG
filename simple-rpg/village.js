// Village: a safe, living settlement between wave 9 and the boss of every set.
// It is its own game state ('village'), so none of the wave / enemy / biome code runs inside it. The biome world
// (`world`, `enemies`, `wave`...) is left exactly as it was and play resumes where it stopped.
// villagers.js holds the drawing; this file holds the layout, villager routines, hero control, shops and saving.

const VIL_W = 3000, VIL_H = 1080, VIL_ROAD = 548, VIL_LANE = 905;
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
// Potions come in kinds (only the Healing Potion for now: it heals and also cures every ailment). Q drinks. Add a kind here (and what it does in drinkPotion) to add a potion.
const POTIONS = {
  heal: { name: 'Healing Potion', short: 'Heal', color: '#d9534f', field: 'potions' },
};
const POTION_KEYS = Object.keys(POTIONS);
const potionCount = k => (hero && hero[POTIONS[k].field]) | 0;
const potionCost = () => Math.round(22 + wave * 2.2);
// every harmful effect on the hero that a Healing Potion removes. New ailments go in AILS (variants.js).
const hasAilment = () => !!(hero.poison || hero.chillT > 0 || (hero.ail && Object.keys(hero.ail).length));
function cureAilments() { clearPoison(); hero.chillT = 0; }
function applyLamp() { hero.lightBonus = (LAMPS[hero.lamp | 0] || { bonus: 0 }).bonus; }

function potionSay(text, color) { popups.push({ text, x: VW / 2, y: VH - 112, t: 1.4, screen: true, small: true, color }); }
function useUtility() { if (hero.util === 'scroll') useRecall(); else drinkPotion(); }          // Q: whichever utility is equipped
function equipUtility(id) {
  if (id !== 'potion' && id !== 'scroll') return;
  if (hero.util === id) return;
  hero.util = id; hero.potionAnim = null; sfx('switch');
  potionSay(id === 'scroll' ? 'Return Scroll equipped' : 'Healing Potion equipped', id === 'scroll' ? '#cfc0ff' : '#7fd08a');
}
function drinkPotion() {
  if (!hero || hero.dead || paused || (state !== 'play' && state !== 'village')) return;
  const kind = 'heal', P = POTIONS[kind];
  if (potionCount(kind) <= 0) { potionSay(`No ${P.name}s left`, '#f88'); sfx('denied'); return; }
  if (hero.hp >= hero.maxHp && !hasAilment()) { potionSay('Already at full health', '#ccc'); return; }
  if ((hero.potionCd || 0) > 0) return;
  hero[P.field]--; hero.potionCd = 1; questEvent('potion');
  const cursed = ailT('curse') > 0, heal = Math.round(hero.maxHp * POTION_HEAL * (cursed ? 0.5 : 1)), cured = hasAilment();
  hero.hp = Math.min(hero.maxHp, hero.hp + heal);
  if (cured) cureAilments();
  potionSay(`+${heal} HP${cured ? ' · cured' : ''}`, '#7fd08a');
  sfx('potion'); sfx('gulp');
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
  ctx.textAlign = 'left';
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
  craft:   { w: 180, wh: 72, rh: 48, sign: 'hammer', paint: { wall: '#c9bba4', roof: '#5a4638', trim: '#3a2a20' } },       // the Crafting Hall: shuttered for now
  church:  { w: 270, wh: 96, rh: 64, church: true, paint: { wall: '#e6e1d3', roof: '#58627f', trim: '#7a6a4a', chimney: false } },       // the church of Return: the priestess and the rite of rebirth are inside
  enchant: { w: 170, wh: 70, rh: 50, sign: 'rune', paint: { wall: '#cfc6e4', roof: '#4b3a8c', trim: '#33265c' } },       // Ysolde's house: lavender walls and a deep violet roof, whatever the biome
};
const YARD_W = { garden: 230, lawn: 430, smith: 300, wood: 310 };       // widths of the yards south of the road

function buildVillage() {
  const B = BIOMES[zone % BIOMES.length], st = VIL_STYLE[B.key] || VIL_STYLE.forest;
  const seed = (Math.random() * 1e9) | 0, r = mulberry(seed);
  const E = r() < 0.5 ? 1 : -1;                          // the gate is on the east (1) or west (-1) side; you arrive from the other
  const v = {
    B, st, seed, E, name: st.name, t: 0, fade: 1, leaveT: 0, solids: [], hsolids: [], statics: [], buildings: [], b: {}, npcs: [], animals: [], hens: [],
    fx: [], plants: [], lamps: [], keep: [], patches: [], stock: { potion: 4 + Math.floor(Math.random() * 5) },
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
  for (const id of order) { const s = SHOP_ROW[id]; mkB(id, cursor + s.w / 2, 336 + Math.floor(r() * 24), s.w, s.wh, s.rh, { sign: s.sign, flowers: s.flowers, church: s.church, ...(s.paint || {}) }); cursor += s.w + gapN; }
  v.shopOrder = order;
  const { alch, store, armoury, jewel, enchant } = v.b;
  v.church = v.b.church; v.cSolids = churchSolids(v);

  // ---- shop counters and a bit of clutter at the left corner of every shop ----
  const counter = (b, w, kind, awn) => {
    const p = { x: b.x, y: b.y + 58, w, kind, awn };
    add(p.y, () => VPROP.counter(p)); rect(p.x - w / 2, p.y - 14, p.x + w / 2, p.y + 4);
    v.hsolids.push({ x0: p.x - w / 2 - 20, y0: b.y + 2, x1: p.x - w / 2, y1: p.y + 4 }, { x0: p.x + w / 2, y0: b.y + 2, x1: p.x + w / 2 + 20, y1: p.y + 4 });   // the shopkeeper's side of the counter is closed to you
  };
  counter(alch, 110, 'alch', '#6a4fb0'); counter(store, 124, 'store', '#c0392b'); counter(armoury, 120, 'armour', '#2f6aa8'); counter(jewel, 100, 'jewel', '#2f8a6a'); counter(enchant, 108, 'enchant', '#5b3fa8');
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
  while (v.trees.length < 200 && guard++ < 3000) {
    const edge = r() < 0.7;
    const x = edge ? (r() < 0.5 ? 20 + r() * (VIL_W - 40) : (r() < 0.5 ? 20 + r() * 90 : VIL_W - 110 + r() * 90)) : 30 + r() * (VIL_W - 60);
    const y = edge ? (r() < 0.55 ? 100 + r() * 95 : (r() < 0.5 ? VIL_H - 65 + r() * 55 : 130 + r() * (VIL_H - 160))) : 130 + r() * (VIL_H - 160);
    if (!okSpot(x, y) || v.trees.some(t => Math.hypot(t.x - x, t.y - y) < 46)) continue;
    const p = { k: kinds[Math.floor(r() * kinds.length)], x, y, s: 0.85 + r() * 0.5, v: r(), ph: r() * 6.28 };
    v.trees.push(p); add(y, () => drawProp(p));
    if (x > 56 && x < VIL_W - 56 && y > 135 && y < VIL_H - 56) circle(x, y - 2, 9 * Math.min(1.3, p.s));   // trees on the map edge are scenery only (the edge clamp would wedge the hero into them)
  }
  for (let i = 0; i < 24; i++) {                         // the wider village has flower meadows in the open spaces
    const x = 160 + r() * (VIL_W - 320), y = 150 + r() * (VIL_H - 260);
    if (!okSpot(x, y) || v.trees.some(t => Math.hypot(t.x - x, t.y - y) < 70)) continue;
    patch(x, y, 55 + r() * 60, 26 + r() * 26, B.grass[1], 0.5, { n: 46, rx: 80, ry: 34, cols: ['#f28ab2', '#f4e04d', '#ffffff', '#b99bff'], w: 2.4, h: 2.4 });
  }
  v.ground = bakeVillageGround(v);

  // ---- people ----
  makeNpcs(v);
  makeAnimals(v);
  v.ball = { x: (v.lawn.x0 + v.lawn.x1) / 2, y: 680, vx: 0, vy: 0, z: 0 };
  v.lawnC = { x: (v.lawn.x0 + v.lawn.x1) / 2, y: (v.lawn.y0 + v.lawn.y1) / 2 };
  makeStock(v);
  makeQuestOffers(v);
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
// ---------------------------------------------------------------- more to say, and more to do
// Beyond the first words: extra lines for everyone, rumours, "what do you do", stories, and the NPCs talking to each other. Chatting, tipping and playing raise a friendship (hearts);
// at five hearts a villager gives you something once. Friendship and gifts are saved with the game.
const EXTRA_LINES = {
  mira: ['If a potion fizzes, it is working. If it screams, step back.', 'I tasted every one of these. Twice. For science. Mostly.', 'Poison, chills, a nasty cut... there is a bottle for each. Not all of them taste better than the problem.'],
  tobin: ['A lantern is just a small sun you can carry. Do not tell the sun I said so.', 'Every hero buys the same three things: rope, lantern, regret. I only sell two.', 'Fog, night, deep ruins... light is the cheapest armour there is.'],
  dagna: ['Mail is a promise to your ribs. Keep it.', 'A dent is a story. A hole is a funeral. I fix both. Mostly the first.', 'I do not do pretty. I do alive.'],
  lysa: ['A ring on every finger and still your pockets will be empty. That is how you know it is good jewellery.', 'This stone brings luck. That one brings a lot of questions. I sell both.', 'Look closely at the clasp. That is where the quality hides.'],
  ysolde: ['Faint runes are cheap, and every Eternal one began as a Faint one. Remember that when you lose a few.', 'A rune never forgets the hand that shaped it. That is why they hum when you hold them.', 'Do not hoard. A rune in a pouch is a song nobody hears.', 'If the altar refuses, it is not cruelty. It is a stone that is not ready.'],
  hilda: ['The best soup is the one you eat after a long road. I have never made it better than that.', 'There is always a bed. There is always a bowl. That is the whole business.', 'I hear every rumour. I repeat none of them. Except the good ones.'],
  brann: ['A blade is only as honest as the one who sharpens it.', 'Upgrade a sword too many times and it sulks. Ask me how I know.', 'Spend gold on iron, not regret.'],
  pim: ['Carrots are patient. Cabbages are stubborn. Roses are drama.', 'Every dawn I tell the plants good morning. The beans never answer. The beans are rude.', 'A garden is just a slow conversation with the weather.'],
  rurik: ['Cut it clean, stack it neat, burn it warm. That is all of woodcraft.', 'Trees do not mind being cut if you ask them first. I always ask.', 'The splitting maul has a name. I will not tell you what it is.'],
  orla: ['The village is quiet because the young ones are loud elsewhere.', 'Your boots tell me a long story. Go on, sit and tell me the rest.', 'I have outlived three innkeepers and one very rude goat.'],
  eira: ['A return is not an ending, {name}. It is the part of the song that circles back.', 'Level does not forget. Neither does the church.', 'The Mythical pieces cling to you. You are lucky to be liked by such things.'],
  voss: ['I have counted the gate posts every morning for eleven years. They have not moved.', 'A guard is a patient man with a sharp stick.', 'Nothing is quiet here forever, hero. That is what the stick is for.'],
  pip: ['I am the fastest in the village. Nell says she is. She is not.', 'When I grow up I will have a sword and a dog and a very big ball.'],
  nell: ['Pip says I cannot be a hero because I am small. I say heroes start small. Like acorns.', 'Tam is the strongest kicker. But I am the sneakiest.'],
  tam: ['I can kick it over the roof. Almost. Next time.', 'Mum says I eat too many carrots. Old Pim says that is impossible.'],
};
const RUMORS = [
  'They say the beast on the road changes with every set of waves. Bring something that bites back.',
  'A trader from {biome} swore the stones there hum at night. I did not ask which stones.',
  'The priestess says the church bell rings by itself when a hero is close to the top.',
  'Wave {wave} already? The last hero stopped well before that. Folk still talk about them.',
  'Ysolde has been buying every rune she can find. The rune dealers are nervous.',
  'Brann is working on something big. Or he dropped his hammer. Hard to tell.',
  'The kids found a shiny coin by the well. Pip says it is cursed. It is not. I checked.',
  "Mira's cauldron went green last night. Nobody will admit to anything.",
  'Sergeant Voss swears he heard singing from the gate at midnight. Voss does not drink.',
  'Orla says the Wardens left a message in the old road stones. Nobody can read it.',
  'A merchant says the beasts out there hate fire. Bring a burning blade, they said.',
  'The hens have been laying double. Rurik says it is the weather. Pim says it is the beast.',
  'If you want a good ring, wait for Lysa\'s next shipment. If you want a cheap one, wait longer.',
  'They say a Secret piece once dropped in the Hollow and walked itself home. I doubt it.',
  'The innkeeper has put an extra blanket on every bed. A cold night is coming, or Hilda knows something.',
  'Tier {tier} beasts, they say. Strong enough that even Brann went quiet.',
];
const ASK_WORK = {
  mira: ['I brew Healing Potions from three herbs and one secret. The secret is patience.', 'One bottle mends the body and clears every ailment, from a bleed to a curse. I would not sell you a worse one.'],
  tobin: ['Lanterns, rope, anything that keeps you alive after dark. Light is the best armour.', 'I buy low, sell high, and give every hero the benefit of the doubt.'],
  dagna: ['I test every piece on a straw dummy first. Then on Brann. Then on you.', 'Armour is a conversation between steel and the thing that wants to hurt you. I make sure steel wins.'],
  lysa: ['Rings, necklaces and artifacts. Everything small, everything lucky, everything priced accordingly.', 'I find the stones, the dwarves cut them, and I sell the story along with the ring.'],
  ysolde: ['I coax runes out of the stone and teach them to hold their shape. Then I let you carry them. Responsibly.', 'The shelf is what I have. The altar is what I do. Bring me what you carry and I will see how far it can go.'],
  hilda: ['I keep the beds, the fire and the peace. In that order on a good day.', 'Rest here and the day starts fresh and your journey is safely written down. That is the whole trick.'],
  brann: ['Weapons to buy, gear to temper, spare iron to sell. The anvil does the rest.', 'Every blade I make was a lump of ore with ambitions.'],
  pim: ['Cabbages, carrots and an unreasonable number of flowers. The beast leaves them alone. I do not know why.', 'I water at dawn and gossip with the beans at noon.'],
  rurik: ['I fell the trees, split the logs and stack them neat. The inn burns more than you would think.', 'Cut one, plant ten. That is the deal I made with the forest.'],
  orla: ['I knit, I read the notice board, and I tell the young ones they are wrong. Someone has to.', 'Elders are mostly the ones who sat down first.'],
  eira: ['I am the priestess here. Reach the top and I can send you back down, stronger.', 'I do not make anyone return. I only open the door and hold the light.'],
  voss: ['I guard the gate. I count the posts. The beast on the road keeps me honest.', 'Heroes go out. Most come back. I make sure the ones who do not are remembered.'],
  pip: ['We are playing ball! You can play too! ...Do you know how to kick?', 'I am the goalie! Nell is the other goalie! Tam kicks and nobody is happy.'],
  nell: ['We are playing tag! Everybody is it! Nobody is winning!', 'I am the fastest. Do not tell Pip. He gets sulky.'],
  tam: ['I am the best kicker. Do not ask Pip, he is jealous.', 'The ball keeps going in the hay. Pip says it is a rule.'],
  _: ['Oh, this and that. The village keeps me busy.', 'Mostly I try to stay out of the beast\'s way.'],
};
const STORIES = [
  'Aldermere was eight kingdoms, joined by a single road. The Wardens walked it every day, one from each kingdom, and every evening they lit a fire on the ridge to tell the others all was well.',
  'My grandmother said the Hollow was always there, sleeping under the road like a cat under a porch. Nobody told it to wake up. Nobody told it to go back to sleep either.',
  'There was a Warden once who could not be killed. Eight times the beasts took him and eight times he stood up. The ninth time he did not. We still lay a place for him at the fire.',
  'The old song goes: eight fires, eight roads, eight hearts. When the last fire goes out, someone new lights the first. I always thought it was only a song.',
  'When I was small, a stranger walked out of the dusk with a red scarf and no name. They stayed one night, ate three bowls of soup and left before dawn. I think about them often.',
  'Heroes come back, you know. Not always the way they left. A kind of loop in the road. The church knows. Eira keeps count.',
];
const PAIR_CHAT = {
  'mira|tobin': ["Tobin, you owe me for the lantern oil!", 'Put it on my tab, Mira!'],
  'brann|dagna': ['Dagna, your helm dented my hammer.', 'Then your hammer is too soft!'],
  'orla|pim': ['Pim, your tomatoes were delicious. Take it as a compliment.', 'Bless you, Orla. They only grow for you.'],
  'hilda|rurik': ['Rurik, more firewood for the inn?', 'Two cartloads by noon, Hilda.'],
  'lysa|ysolde': ['Ysolde, that stone is humming again.', 'That is rather the point, Lysa.'],
  'eira|voss': ['Sergeant, any heroes today?', 'One. Looks promising.'],
  'dagna|lysa': ['Lysa, do you have a clasp for this buckle?', 'For you, Dagna? Naturally.'],
  'hilda|mira': ['Mira, the soup is ready!', 'Not now Hilda, the cauldron is at a delicate stage!'],
  'brann|rurik': ['Rurik, I need charcoal. A lot.', 'I need an axe. A good one. Fair trade.'],
  'nell|pip': ['Tag! You are it!', 'No fair, I was not ready!'],
  'pip|tam': ['Pass it here!', 'You kicked it into the hay AGAIN!'],
  'nell|tam': ['Race you to the well!', 'You always cheat!'],
};
const PAIR_GENERIC = [['Morning, {b}!', 'Morning, {a}! Lovely day for it.'], ['Have you seen the hero about?', 'Hard to miss them. Mind the sword!'], ['Busy day?', 'Always. And yours?'], ['Did you hear that noise last night?', 'The wind, I hope.'], ['Mind the road, {b}.', 'And you, {a}.'], ['Any news from the gate?', 'Quiet. Too quiet, Voss says.']];
const BOND_MAX = 8, BOND_GIFT = 5, tipCost = () => 25 + Math.floor(wave / 2);
const bondOf = id => (hero && hero.bond && hero.bond[id]) | 0;
const hearts = id => '♥'.repeat(bondOf(id)) + '♡'.repeat(BOND_MAX - bondOf(id));
function bondAdd(id, k) { hero.bond = hero.bond || {}; hero.bond[id] = Math.min(BOND_MAX, bondOf(id) + k); }
const giveItem = (slot, rar) => { const it = rollItem({ slot, rarity: rar, level: hero.level + 2 }); if (addToBag(it)) return `${it.name}`; hero.gold += 120; return '120 gold (your pack was full)'; };
const giveGold = g => { hero.gold += g; hero.goldPulse = 0.6; return `${g} gold`; };
const givePots = h => { hero.potions = Math.min(POTION_MAX, (hero.potions | 0) + h); return `${h} Healing Potion${h > 1 ? 's' : ''}`; };
const giveRune = () => { const k = rollRuneKey(1.5, 3); addRune(k); return `a ${RUNES[k].title}`; };
const GIFTS = {
  mira: () => givePots(3), tobin: () => giveGold(60 + wave * 6), dagna: () => giveItem('armor', 3), lysa: () => giveItem('ring', 3), ysolde: giveRune, hilda: () => givePots(3),
  brann: () => giveItem('weapon', 3), pim: () => givePots(2), rurik: () => giveGold(50 + wave * 5), orla: () => giveGold(80 + wave * 4), eira: giveRune, voss: () => givePots(2),
  pip: () => giveGold(30 + wave * 2), nell: () => giveGold(30 + wave * 2), tam: () => giveGold(30 + wave * 2), _: () => giveGold(50),
};
function giveGift(n) {
  hero.gifts = hero.gifts || {}; hero.gifts[n.id] = 1;
  const what = (GIFTS[n.id] || GIFTS._)(); sfx('gift'); saveGame(true, true);
  popups.push({ text: `${n.name} gave you ${what}`, x: VW / 2, y: 120, t: 3, screen: true, small: true, color: '#ffd86a' });
  return `\n${n.name} gives you ${what}.`;
}
const chatButtons = n => {
  const b = [['news', 'Ask for news']];
  if (n.kid) b.push(['ball', 'Play ball with them']);
  if (n.id === 'orla') b.push(['story', 'Ask for a story']);
  b.push(['tip', `Give a tip (${tipCost()} gold)`, hero.gold < tipCost()], ['back', 'Never mind']);
  return b;
};
function chatAct(k, n) {
  const v = vil, pick = a => a[Math.floor(Math.random() * a.length)], first = !n['did_' + k];
  const fill = t => t.replace(/\{name\}/g, hero.name).replace(/\{village\}/g, v.name).replace(/\{biome\}/g, v.B.name).replace(/\{wave\}/g, String(wave)).replace(/\{tier\}/g, String(tierOf(wave)));
  let text = '', add = 0;
  if (k === 'news') { text = pick(RUMORS); add = first ? 1 : 0; }
  else if (k === 'work') { text = pick(ASK_WORK[n.id] || ASK_WORK._); add = first ? 1 : 0; }
  else if (k === 'story') { n.storyI = (n.storyI | 0) + 1; text = STORIES[(n.storyI - 1 + (hero.name.length | 0)) % STORIES.length]; add = first ? 1 : 0; }
  else if (k === 'ball') {
    const kids = v.npcs.filter(x => x.kid && !x.inside);
    for (const x of kids) { x.cheerT = 1.8; x.pt = 0; } n.kickT = 0.3; n.pt = 0; sfxNear(n, 'kick', 1); v.ball.vx = (hero.x < n.x ? -1 : 1) * 120; v.ball.vy = 20; v.ball.z = 6;
    text = pick(['"Wheee! Nice one!" The ball sails over the grass and everyone cheers.', '"Again! Again!" The kids crowd round you, laughing.', '"You kick like a hero!" says ' + n.name + ', beaming.']); add = first ? 1 : 0;
  } else if (k === 'tip') {
    const c = tipCost(); if (hero.gold < c) { sfx('denied'); return; }
    hero.gold -= c; hero.goldPulse = 0.6; add = 2; sfx('coin'); text = pick(['"Oh! That is far too kind, {name}. Thank you."', '"I will put that to good use. Bless you, {name}."', '"For me? Well... I will not say no."', '"You are too good to us, {name}."']);
  }
  n['did_' + k] = true; if (add) { bondAdd(n.id, add); if (k !== 'tip') sfx('select'); }
  const gift = bondOf(n.id) >= BOND_GIFT && !(hero.gifts || {})[n.id] ? giveGift(n) : '';
  openTalk(`${fill(text)}${gift}`, chatButtons(n));
}
// villagers who pass each other stop for a word: one speaks, the other answers a moment later
function pairChats(v, dt) {
  const q = v.replies || (v.replies = []);
  for (let i = q.length - 1; i >= 0; i--) { const r = q[i]; if (v.t >= r.t) { q.splice(i, 1); if (!r.n.inside && !r.n.bubble) { r.n.bubble = r.text; r.n.bubbleT = 2.8; r.n.talking = true; sfxNear(r.n, r.n.kid ? 'giggle' : 'murmur', 0.6); } } }
  v.pairT = (v.pairT || 0) - dt; if (v.pairT > 0) return; v.pairT = 1.2;
  if (!hero) return;
  const cd = v.pairCd || (v.pairCd = {}), list = v.npcs.filter(n => !n.inside && n.alpha > 0.8 && !n.goHome && !n.bubble && !n.talking && Math.hypot(n.x - hero.x, n.y - hero.y) < 520);
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    if (Math.hypot(a.x - b.x, a.y - b.y) > 72) continue;
    const key = [a.id, b.id].sort().join('|'); if ((cd[key] || 0) > v.t) continue; cd[key] = v.t + 160 + Math.random() * 120;
    const pair = PAIR_CHAT[key], gen = PAIR_GENERIC[Math.floor(Math.random() * PAIR_GENERIC.length)];
    let [l1, l2] = pair || gen; const first = pair && pair.length && key.split('|')[0] !== a.id ? [b, a] : [a, b];
    const fill = t => t.replace(/\{a\}/g, first[0].name).replace(/\{b\}/g, first[1].name);
    first[0].bubble = fill(l1); first[0].bubbleT = 2.8; first[0].talking = true; sfxNear(first[0], first[0].kid ? 'giggle' : 'murmur', 0.6);
    first[0].f = first[1].x >= first[0].x ? 1 : -1; first[1].f = first[0].x >= first[1].x ? 1 : -1;
    q.push({ t: v.t + 1.9, n: first[1], text: fill(l2) });
    return;
  }
}

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
  const ysStand = [b.enchant.x - 30, b.enchant.y + 27];
  mk('ysolde', 'Ysolde', 'Enchantress', ysStand[0], ysStand[1], {
    shop: 'enchant', look: { dress: '#233a7a', hat: 'cone', hatColor: '#1d2a5e', hair: '#b8f0ff', cheek: true }, f: 1,
    lines: ['Every rune is a promise a stone made to the world. I only teach it to keep it.', 'A Faint rune is a whisper. An Eternal one is a roar. Most never hear it.', 'Runes want a home in good gear. Bring them to Brann and he will set them in.', 'Improving a rune is delicate work. Sometimes the stone refuses, and it settles a step lower.'],
    chat: ['Hush now, little stone...', 'The runes are restless today.', 'Mind the glow!'],
    script: () => [{ t: [4, 8], face: -1 }, { do: 'wipe', t: [2, 3] }, { go: [ysStand[0] + 52, ysStand[1]] }, { t: [3, 6], face: 1 }, { go: ysStand }],
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
  mk('eira', 'Eira', 'Priestess', CHURCH.ox + 320, CHURCH.oy + 152, {
    special: 'shrine', inside: true, look: { dress: '#f1eee6', stole: '#d9b44a', hat: 'veil', hatColor: '#f6f2e8', hair: '#e8e0ff', cheek: true }, f: 1, speed: 36,
    lines: ['The light above the altar remembers everyone who has climbed as far as you. It also remembers the ones who did not come back.', 'Reach the top, and I can send you back down, stronger. Ask me when you are ready.', 'Mythical and secret things are loyal. They will wait for you in the pack. Everything else is only gold.'],
    chat: ['Hm hm...', 'The light is kind today.', 'Begin again, and again.'],
    script: (v, n) => churchRoutine(v, n),
  });
  mk('voss', 'Sgt. Voss', 'Gate Guard', v.gate.x - 98 * v.E, v.gate.y - 28, {
    special: 'guard', look: { body: '#4a5a7a', hat: 'helmet', hatColor: '#c0392b', beard: '#6a5a4a', spear: true }, f: -v.E, speed: 36,
    lines: ['Beyond this gate the road runs to a beast. Are you ready to face it?'],
    chat: ['Move along, citizens.', 'All quiet.', 'Halt. ...Oh, it is you.'],
    script: () => [{ do: 'lean', t: [9, 15], face: -v.E }, { go: [v.gate.x - 98 * v.E, v.gate.y + 26] }, { t: [4, 6], face: -v.E }, { go: [v.gate.x - 98 * v.E, v.gate.y - 28] }],
  });
  for (const n of v.npcs) n.lines = n.lines.concat(MORE_LINES[n.id] || (EXTRA_LINES[n.id] || []).slice(0, 3));
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
  if (Math.abs(dx) > Math.max(1.5, Math.abs(dy) * 0.4)) faceTo(n, dx > 0 ? 1 : -1);        // turn only for a real sideways move
  n.x = c.x; n.y = c.y;
  if (moved > 0.01) { n.mvHold = 0.18; n.walkT += dt * stepRate(spd, 11 * (n.scale || 1)); } else n.mvHold = (n.mvHold || 0) - dt;          // feet only step when the body moves; a one-frame stop is not a stop
  n.moving = n.mvHold > 0;
  n.stuckT = moved < st * 0.3 ? (n.stuckT || 0) + dt : 0;
  if (n.stuckT > 1.6) {                                   // never stay wedged
    v.stats.stuck++; n.stuckT = 0; n.moving = false;
    if (n.kind === 'dog') return true;                    // the dog just gives up on a spot it can't reach
    if ((n.stuckN = (n.stuckN | 0) + 1) <= 2) { n.replan = true; return false; }               // first try another way round
    n.stuckN = 0; v.stats.snaps++; (v.stats.who = v.stats.who || []).push(`${n.id || n.kind}@${Math.round(n.x)},${Math.round(n.y)}->${Math.round(tx)},${Math.round(ty)}`); n.x = tx; n.y = ty; return true;
  }
  return false;
}

// turning round takes a moment: nobody flips more than about three times a second
function faceTo(n, f) { if (n.f === f) return; const t = typeof vil !== 'undefined' && vil ? vil.t : 0; if (n.faceAt !== undefined && t >= n.faceAt && t - n.faceAt < 0.3) return; n.f = f; n.faceAt = t; }

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
  const g = v.inChurch ? (v.cgrid || (v.cgrid = vilGrid(v))) : (v.grid || (v.grid = vilGrid(v))), { C, W, H, bl } = g;           // the church is a room of its own, with its own map
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
    if (!s.path || n.replan) { s.path = planPath(v, n, s.go); n.replan = false; }
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
  if (!n.greeted && hd < 105 && !n.moving && !n.goHome) { n.greeted = true; n.greetT = 1.5; sfxNear(n, n.kid ? 'giggle' : 'hello', 0.8); }
  if (n.greetT > 0) { n.greetT -= dt; if (!n.moving && n.pose !== 'carry') { n.pose = 'wave'; n.pt += dt; n.f = hero.x >= n.x ? 1 : -1; } }
  n.chatT -= dt;
  if (n.bubbleT > 0) { n.bubbleT -= dt; if (n.bubbleT <= 0) { n.bubble = null; n.talking = false; } }
  else if (n.chatT <= 0 && hd < 260 && n.chat.length && !n.goHome) {
    n.chatT = 9 + Math.random() * 12;
    n.bubble = n.kid && v.kidMode === 'tag' && Math.random() < 0.5 ? (v.tag.it === v.npcs.indexOf(n) ? "You can't catch me!" : 'Run!') : n.chat[Math.floor(Math.random() * n.chat.length)];
    n.bubbleT = 3.2; n.talking = true; sfxNear(n, 'murmur', 0.6);
    if (n.kid && Math.random() < 0.6) sfxNear(n, 'giggle', 0.7);
  }
}

// children: ball games, tag, then a rest on the grass
function kidTick(n, dt, v) {
  const kids = v.npcs.filter(k => k.kid && !k.inside && !k.goHome), L = v.lawn;
  const clampLawn = () => { n.x = Math.max(L.x0, Math.min(L.x1, n.x)); n.y = Math.max(L.y0, Math.min(L.y1, n.y)); };
  const run = (tx, ty, spd) => {
    const dx = tx - n.x, dy = ty - n.y, d = Math.hypot(dx, dy);
    if (d < 3) { n.mvHold = (n.mvHold || 0) - dt; n.moving = n.mvHold > 0; return true; }
    const st = Math.min(d, spd * dt); n.x += dx / d * st; n.y += dy / d * st; clampLawn();
    if (Math.abs(dx) > Math.max(1.5, Math.abs(dy) * 0.4)) faceTo(n, dx > 0 ? 1 : -1);
    n.moving = true; n.mvHold = 0.18; n.walkT += dt * stepRate(spd, 11 * n.scale); return false;
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
      n.chaseT = (n.chaseT || 0) - dt;
      if (!n.chaseK || n.chaseT <= 0 || n.chaseK.inside || n.chaseK === n) {                    // keep to one runner for a moment instead of switching every frame
        let b0 = null, d0 = 1e9; for (const k of kids) if (k !== n) { const d = Math.hypot(k.x - n.x, k.y - n.y); if (d < d0) { d0 = d; b0 = k; } }
        n.chaseK = b0; n.chaseT = 0.8;
      }
      const best = n.chaseK, bd = best ? Math.hypot(best.x - n.x, best.y - n.y) : 1e9;
      if (best) {
        run(best.x, best.y, 80);
        if (bd < 15 && v.tag.imm <= 0) { v.tag.it = v.npcs.indexOf(best); v.tag.imm = 1.2; best.bubble = 'Tag! You are it!'; best.bubbleT = 2; best.talking = true; sfxNear(best, 'giggle', 0.8); }
      }
    } else if (it && !it.inside) {
      n.fleeT = (n.fleeT || 0) - dt;
      if (n.fleeT <= 0 || n.fleeTx === undefined) {                                           // pick a spot to run to and keep to it for a little while
        const dx = n.x - it.x, dy = n.y - it.y, d = Math.hypot(dx, dy) || 1;
        let tx = n.x + dx / d * 60 + Math.sin(v.t * 1.3 + idx) * 25, ty = n.y + dy / d * 60 + Math.cos(v.t * 1.1 + idx) * 20;
        const cx = (L.x0 + L.x1) / 2, cy = (L.y0 + L.y1) / 2;                                  // steer away from the lawn edges so nobody gets pinned in a corner
        if (n.x < L.x0 + 25 || n.x > L.x1 - 25) tx = cx + (Math.random() - 0.5) * 60;
        if (n.y < L.y0 + 18 || n.y > L.y1 - 18) ty = cy + (Math.random() - 0.5) * 40;
        n.fleeTx = Math.max(L.x0, Math.min(L.x1, tx)); n.fleeTy = Math.max(L.y0, Math.min(L.y1, ty)); n.fleeT = 0.5 + Math.random() * 0.3;
      }
      run(n.fleeTx, n.fleeTy, 82);
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
    if (held('left')) dx--; if (held('right')) dx++;
    if (held('up')) dy--; if (held('down')) dy++;
  }
  hero.moving = !!(dx || dy);
  if (!v.inChurch) pushOutOfPeople(v);                                  // someone walked into you: step aside rather than overlap
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
      if (sk.rest) { hero.hp = hero.maxHp; hero.stamina = maxStamina(); saveGame(false); sfx('save'); sfx('wake'); popups.push({ text: `Day ${dayCount} · ${campClockLabel(tod)}: rested, healed and saved`, x: VW / 2, y: 150, t: 3, big: true, screen: true, color: '#fff' }); }
      else popups.push({ text: `${sk.label}: ${campClockLabel(tod)} · Day ${dayCount}`, x: VW / 2, y: 150, t: 2.6, big: true, screen: true, color: '#fff' });
      if (night01() < 0.3) Sound.call('birdsong');
    }
    if (sk.t >= SLEEP_LEN) { v.skip = null; Sound.music('village'); }
  }
  if (v.leaveT > 0) { v.leaveT -= dt; if (v.leaveT <= 0 && !v.doneLeave) { v.doneLeave = true; leaveVillage(); return; } }
  updateVillageHero(dt, v);
  if (!v.inChurch) {
    for (const n of v.npcs) if (n.special !== 'shrine') npcTick(n, dt, v);
    pairChats(v, dt);
    for (const a of v.animals) animalTick(a, dt, v);
    for (const h of v.hens) animalTick(h, dt, v);
    for (const p of v.plants) p.wet = Math.max(0, p.wet - dt * 0.4);
  }
  // chimney smoke, lazily
  v.smokeT -= dt;
  if (v.smokeT <= 0) { v.smokeT = 0.35; if (!v.inChurch) for (const b of v.buildings) if (!b.church && inView(b.chim.x, b.chim.y, 160)) vfx(v, { x: b.chim.x, y: b.chim.y, vx: 8 + Math.random() * 6, vy: -16 - Math.random() * 8, life: 3 + Math.random(), size: 3, color: 'rgba(210,210,215,0.45)', smoke: true }); }
  for (const f of v.fx) { f.life -= dt; f.vy += f.grav * dt; f.x += f.vx * dt; f.y += f.vy * dt; if (f.smoke) f.size += dt * 2.2; }
  v.fx = v.fx.filter(f => f.life > 0);
  // what can the hero talk to?
  if (v.inChurch) { churchNear(v, dt); return churchCam(v, dt); }
  let best = null, bd = 1e9;
  const consider = (kind, ref, x, y, r, label, tag) => { const d = Math.hypot(hero.x - x, hero.y - y); if (d < r && d < bd) { bd = d; best = { kind, ref, x, y, label, tag }; } };
  for (const n of v.npcs) if (!n.inside && n.alpha > 0.5 && !n.goHome) consider('npc', n, n.x, n.y, n.shop ? 72 : 64, n.name, n.role);
  if (v.b.craft && !v.talk) consider('craft', null, v.b.craft.door.x, v.b.craft.door.y + 6, 62, 'Crafting Hall', 'Opening soon');
  if (Math.abs(hero.x - v.gate.x) < 110 && Math.abs(hero.y - v.gate.y) < 80) consider('gate', null, v.gate.x - 24 * v.E, v.gate.y - 40, 999, 'The road', 'Leave the village');
  if (!v.talk) consider('church', null, v.church.door.x, v.church.door.y + 4, 66, 'Church of Return', 'Enter');
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

// ---------------------------------------------------------------- the church: a room of its own, entered through the big door (E); the priestess and the rite of rebirth are in here
const CHURCH = { w: 640, h: 300, ox: 400, oy: 250 };
function churchSolids(v) {
  const c = CHURCH, S = [{ x0: c.ox - 90, y0: c.oy - 90, x1: c.ox + 14, y1: c.oy + c.h + 90 }, { x0: c.ox + c.w - 14, y0: c.oy - 90, x1: c.ox + c.w + 90, y1: c.oy + c.h + 90 }, { x0: c.ox - 90, y0: c.oy - 90, x1: c.ox + c.w + 90, y1: c.oy + 102 }, { x0: c.ox - 90, y0: c.oy + c.h - 2, x1: c.ox + c.w + 90, y1: c.oy + c.h + 90 },
    { x0: c.ox + 274, y0: c.oy + 104, x1: c.ox + 366, y1: c.oy + 128 }];
  v.cpots = [[34, 128], [606, 128], [226, 178], [414, 178]].map(([x, y], k) => ({ x: c.ox + x, y: c.oy + y, k, wet: 0 })); for (const p of v.cpots) S.push({ x: p.x, y: p.y - 4, r: 9 });
  c.pews = []; for (const y1 of [176, 222, 268]) for (const [x0, x1] of [[50, 190], [450, 590]]) { const p = { x0: c.ox + x0, y0: c.oy + y1 - 16, x1: c.ox + x1, y1: c.oy + y1 }; c.pews.push(p); S.push({ x0: p.x0, y0: p.y0 - 4, x1: p.x1, y1: p.y1 }); }
  return S;
}
// the priestess keeps herself busy: she waters the flowers, prays on one of the pews (any of them) or at the altar, polishes the altar, and stands by it between times
function churchRoutine(v, n) {
  const c = CHURCH, rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
  const kind = pick(['water', 'water', 'pew', 'pew', 'altar', 'polish'].filter(k => k !== n.lastKind)); n.lastKind = kind;
  const post = [{ go: [c.ox + 320, c.oy + 152], speed: 30 }, { t: [4, 8], face: Math.random() < 0.5 ? 1 : -1 }];
  if (kind === 'water') {
    const pot = pick(v.cpots), sd = pot.x < c.ox + 320 ? 1 : -1;
    return [{ go: [pot.x + sd * 24, pot.y + 8], speed: 34 }, { do: 'water', t: [4, 6], face: -sd, tick: (n2, v2, dt) => {
      if (Math.random() < dt * 22) vfx(v2, { x: n2.x + n2.f * 24, y: n2.y - 34, vx: n2.f * (30 + Math.random() * 20), vy: 10, grav: 340, life: 0.55, size: 1.6, color: '#a6d8ff' }); pot.wet = 1; } }, ...post];
  }
  if (kind === 'pew') {
    const p = pick(c.pews), x = rnd(p.x0 + 24, p.x1 - 24);
    return [{ go: [x, p.y1 + 8], speed: 34 }, { do: 'sitpray', t: [14, 24], face: Math.random() < 0.5 ? 1 : -1 }, ...post];
  }
  if (kind === 'altar') {
    const sd = Math.random() < 0.5 ? 1 : -1;
    return [{ go: [c.ox + 320 + sd * 26, c.oy + 137], speed: 34 }, { do: 'pray', t: [10, 16], face: -sd }, ...post];
  }
  const sd = Math.random() < 0.5 ? 1 : -1;                         // polishing the altar from the side
  return [{ go: [c.ox + 320 + sd * 70, c.oy + 116], speed: 34 }, { do: 'wipe', t: [3, 5], face: -sd }, ...post];
}
function enterChurch() {
  const v = vil, c = CHURCH; if (!v || v.inChurch) return;
  v.inChurch = true; v.cOut = { x: hero.x, y: hero.y }; v.solidsOut = { s: v.solids, h: v.solidsH }; v.solids = v.cSolids; v.solidsH = v.cSolids;
  hero.x = c.ox + 320; hero.y = c.oy + 248; hero.facing = 1; hero.moving = false; hero.walkT = 0; hero.scarf.forEach(p => { p.x = hero.x; p.y = hero.y - 50; });
  for (const k in keys) keys[k] = false;
  v.fade = 1; v.near = null; cam.x = c.ox; cam.y = c.oy - 20;
  sfx('door'); sfx('bell'); popups = popups.filter(p => p.screen); popups.push({ text: 'Church of Return', x: VW / 2, y: 70, t: 2.6, big: true, screen: true, color: '#f4ecd0' });
}
function leaveChurch() {
  const v = vil; if (!v || !v.inChurch) return;
  v.inChurch = false; v.solids = v.solidsOut.s; v.solidsH = v.solidsOut.h; v.talk = null;
  const d = v.church.door, c = vilCollide(v, d.x, d.y + 34, 9, undefined, undefined, true);
  hero.x = c.x; hero.y = c.y; hero.facing = 1; hero.moving = false; hero.walkT = 0; hero.scarf.forEach(p => { p.x = hero.x; p.y = hero.y - 50; });
  for (const k in keys) keys[k] = false;
  v.fade = 1; v.near = null; sfx('door');
  const vw = VW / VIL_ZOOM, vh = VH / VIL_ZOOM; cam.x = clampN(hero.x - vw / 2, 0, VIL_W - vw); cam.y = clampN(hero.y - vh / 2 - 12, 0, VIL_H - vh);
}
function churchNear(v, dt) {
  const c = CHURCH, e = v.npcs.find(n => n.special === 'shrine');
  if (e) {
    e.alpha = 1;
    if (v.talk && v.talk.ref === e) { e.moving = false; e.pose = 'stand'; e.f = hero.x >= e.x ? 1 : -1; }          // she stops what she is doing to talk
    else { runScript(e, dt, v); if (e.pose === 'stand' && !e.moving && Math.hypot(hero.x - e.x, hero.y - e.y) < 70 && !e.cur) e.f = hero.x >= e.x ? 1 : -1; }
    const dx = hero.x - e.x, dy = hero.y - e.y, d = Math.hypot(dx, dy), min = 9 + e.r + 2;                               // nobody walks through her
    if (d < min) { const k = d < 0.01 ? 0 : (min - d) / d; hero.x += d < 0.01 ? min : dx * k; hero.y += dy * k; const cc = vilCollide(v, hero.x, hero.y, 9, undefined, undefined, true); hero.x = cc.x; hero.y = cc.y; }
    for (const p of v.cpots) p.wet = Math.max(0, p.wet - dt * 0.25);
    if (e.bubbleT > 0) { e.bubbleT -= dt; if (e.bubbleT <= 0) { e.bubble = null; e.talking = false; } }
  }
  let best = null, bd = 1e9;
  const consider = (kind, ref, x, y, r, label, tag) => { const d = Math.hypot(hero.x - x, hero.y - y); if (d < r && d < bd) { bd = d; best = { kind, ref, x, y, label, tag }; } };
  if (e) consider('npc', e, e.x, e.y, 78, e.name, e.role + (e.pose === 'sitpray' || e.pose === 'pray' ? ' · praying' : ''));
  consider('exit', null, c.ox + 320, c.oy + c.h - 6, 44, 'the church', 'Leave');
  v.near = best;
}
function churchCam(v, dt) {
  const c = CHURCH; cam.x = c.ox; cam.y = c.oy - 20; cam.shake = 0;
  for (const p of popups) { p.t -= dt; if (p.pop !== undefined) p.pop += dt; if (!p.big && !p.screen) p.y -= 30 * dt; }
  popups = popups.filter(p => p.t > 0);
  v.soundT -= dt; if (v.soundT <= 0) { v.soundT = 0.5; Sound.setScene({ biome: 'village', night: false, wind: 0, rain: 0, pitch: 450 }); }
}
function drawChurchInside(v) {
  const c = CHURCH, Z = VIL_ZOOM, t = v.t;
  ctx.fillStyle = '#08080e'; ctx.fillRect(0, 0, VW, VH);
  ctx.save(); ctx.scale(Z, Z); ctx.translate(-c.ox, -(c.oy - 20));
  drawChurchRoom(v, { x: c.ox, y: c.oy });
  const things = [], e = v.npcs.find(n => n.special === 'shrine');
  for (const p of c.pews) things.push({ y: p.y1, d: () => drawChurchPew(p) });
  for (const p of v.cpots) things.push({ y: p.y, d: () => drawChurchPot(p, t) });
  const altar = { x: c.ox + 320, y: c.oy + 128 }; things.push({ y: altar.y, d: () => drawChurchAltar(altar, t) });
  if (e) things.push({ y: e.y, d: () => drawVillager(e) });
  things.push({ y: hero.y, d: () => drawHero(hero) });
  things.sort((a, b) => a.y - b.y).forEach(o => o.d());
  drawChurchLight(c.ox + 320, c.oy + 38, t);
  for (const f of v.fx) { const a = Math.max(0, Math.min(1, f.life / f.max)); ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  if (e && e.bubble) drawBubble(e.x, e.y - 82, e.bubble, 1);
  if (v.near && !v.talk) {
    const q = v.near, ty = q.kind === 'npc' ? q.ref.y - 100 : q.y - 22, bob = Math.sin(tAnim * 5) * 2;
    ctx.save(); ctx.fillStyle = 'rgba(20,20,28,0.88)'; ctx.strokeStyle = '#f5c451'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(q.x - 11, ty - 11 + bob, 22, 22, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f5c451'; ctx.font = 'bold 14px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(keyLabel('interact'), q.x, ty + 5 + bob); ctx.restore();
  }
  ctx.restore();
  const vg = ctx.createRadialGradient(VW / 2, VH * 0.45, VH * 0.35, VW / 2, VH * 0.45, VW * 0.62); vg.addColorStop(0, 'rgba(10,6,16,0)'); vg.addColorStop(1, 'rgba(10,6,16,0.5)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  if (v.fade > 0) { ctx.fillStyle = `rgba(2,3,10,${v.fade})`; ctx.fillRect(0, 0, VW, VH); }
  drawVillageHUD(v);
  drawPopups(true);
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
  Sound.music('village'); sfx('bell');
  Sound.setScene({ biome: 'village', night: curNight > 0.5, wind: 0.02, rain: 0, pitch: 450 });
  sfx('unlock');
}
function leaveVillage() {
  if (!vil) return;
  saveGame(true, true);                                     // purchases are banked before the boss
  const ret = vil.ret;
  const recalled = vil.recalled; vil = null; villageSkip = wave + 1;
  state = 'play';
  hero.x = ret.x; hero.y = ret.y; hero.moving = false; hero.walkT = 0;
  hero.scarf.forEach(p => { p.x = hero.x; p.y = hero.y - 50; });
  cam.x = clampN(hero.x - VW / 2, 0, WW - VW); cam.y = clampN(hero.y - VH / 2 - 20, 0, WH - VH);
  for (const k in keys) keys[k] = false;
  waveTimer = 1.6; sceneT = 0;
  popups = popups.filter(p => p.screen);
  popups.push({ text: recalled ? 'Back to the road...' : 'The road ahead is guarded...', x: VW / 2, y: 190, t: 2.6, big: true, screen: true, color: '#f88' });
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
  ysolde: ['Ah. A new face, and not a rune on them. Come in, {name}. Ysolde, enchantress.', 'Welcome to my sanctum, {name}. Mind the glow, and do not touch anything that hums.'],
  lysa: ['Oh, hello! Lysa. Small things, big luck. Have a look.', 'Welcome, {name}. Careful, everything here is worth more than it looks.'],
  pim: ['Well met, {name}! Mind the cabbages.', 'A visitor! Come to admire the garden?'],
  rurik: ['Rurik. Woodcutter. Watch your feet.', 'Hello there, {name}. Mind the chips.'],
  orla: ['Hello, dear. Sit a while, you look like you could use it.', 'Ah, the hero. {village} has been talking about you.'],
  voss: ['Sergeant Voss. {village} is under my watch.', 'Halt. State your... oh. The hero. Carry on.'],
  eira: ['Welcome, {name}. I am Eira, the priestess. I have been expecting you.', 'Ah. A traveller with a long road behind them. Light a candle with me.'],
};
function contextLines(n) {
  const h = hero, out = [], night = night01() > 0.5, hpf = h.hp / h.maxHp, morning = tod > 0.28 && tod < 0.45, id = n.id;
  const all = (c, t) => { if (c) out.push(t); };
  all(h.points > 0, 'You have ' + h.points + ' stat point' + (h.points === 1 ? '' : 's') + ' unspent, {name}. Press M and put them to use before you head out.');
  all(hpf < 0.5, 'You look worse for wear, {name}. Mind yourself out there.');
  const wk = typeof weather !== 'undefined' && weather ? weather.kind : 'clear';
  all(wk === 'rain' || wk === 'drizzle', 'Wet one, is it not? Mind the mud, {name}.'); all(wk === 'storm', 'Thunder again. Best keep to the inn tonight, {name}.'); all(wk === 'snowfall' || wk === 'blizzard', 'Snow again. At least it keeps the beasts quiet.');
  all(wk === 'fog', 'Fog like milk. Do not wander off the road, {name}.'); all(wk === 'sandstorm', 'Grit in everything. Even the soup.'); all(wk === 'heat' || wk === 'mirage', 'Hot enough to fry an egg on the well.');
  all(h.gold >= 2000, 'That is a lot of gold to carry down a beast road, {name}. Spend a little here, I say.'); all(h.level >= levelCap(), 'You have reached the top, {name}. Eira at the church can show you what comes next.');
  all(hasAilment(), 'You do not look well, {name}. A healing potion clears every ailment, you know.'); all(rebirths() >= 1, 'Reborn already? I could swear I remember you from before. Or I imagine it.');
  all(bondOf(id) >= 3, 'Always good to see you, {name}. ...Do not tell the others I said so.'); all(bondOf(id) >= 6, 'You are a friend of this village, {name}. We look after our own.'); all(bondOf(id) >= BOND_MAX, 'Eight hearts! There is nobody in {village} who would not stand beside you, {name}.');
  all(wave >= 19, 'Wave {wave} already. Tier {tier} beasts out there. You are braver than most.');
  if (id === 'mira') { all(!h.potions, 'No potions on you? That is how heroes end up in a ditch. Buy a few.'); all(h.potions >= POTION_MAX, 'A full satchel of potions. Good. Now do not waste them.'); all(hasAilment() && !h.cures, 'Poisoned, and not a Cure-All on you? Take one of mine. Please.'); all(!h.cures && h.level >= 8, 'A Cure-All potion clears poison and chills. Press R to switch to it, Q to drink.'); all(night, 'Night brews best. The fumes are... livelier.'); }
  if (id === 'tobin') { all(night, 'A lantern at night is worth ten swords, mark me.'); all((h.lamp | 0) >= 3, 'The Radiant Lantern! My finest. Lights up half the road.'); all((h.lamp | 0) === 0 && h.gold >= 140, 'You can afford a lantern now. The dark hides things that bite.'); all(h.gold < 30, 'Empty pockets? Come back when the beasts have been generous.'); }
  if (id === 'hilda') { all(night, 'The inn is quiet tonight. If you want the hours to pass, I can sort that.'); all(morning, 'Good morning, {name}. Porridge is on, and the day is yours.'); all(hpf < 0.5, 'Sit down before you fall down. A rest is free, dear.'); }
  if (id === 'brann') { all(h.inv.length >= INV_MAX - 2, 'Your pack is nearly bursting. Sell me the junk.'); all(h.gold >= 600, 'Coin to burn? Let me temper that gear for you.'); all(night, 'Fire never sleeps. Neither do I, when there is iron to turn.'); }
  if (id === 'dagna') { all(!h.equip.armor, 'No armour at all? Brave. Foolish, but brave. Have a look.'); all(!h.equip.helmet, 'A hero without a helm. One knock and that is the end of the story.'); }
  if (id === 'lysa') { all(!h.equip.ring1 && !h.equip.ring2, 'Bare fingers! A ring will fix that. Take your pick.'); all(!h.equip.necklace, 'Not a necklace on you. I have just the thing.'); }
  if (id === 'ysolde') { all(!RUNE_KEYS.some(k => runeCount(k)), 'Not one rune in your pouch? The first is the cheapest. Well. Cheap-ish.'); all(RUNE_KEYS.some(k => RUNES[k].tier >= 4 && runeCount(k)), 'A Brilliant rune! You carry real power, {name}.'); all(night, 'Runes glow brightest after dark. Look at them.'); all(h.gold >= 5000, 'That is a heavy purse. Runes are the finest way to lighten it.'); }
  if (id === 'pim') { all(morning, 'Best time to water is the morning. The plants drink it up.'); all(night, 'You should be indoors in this dark. I will see to the beds tomorrow.'); }
  if (id === 'rurik') { all(night, 'Cannot chop in the dark, can I? The axe knows when to rest.'); all(wave >= 10, 'The trees by the road thin out every set. Whatever is out there, it is hungry.'); }
  if (id === 'orla') { all(night, 'The night air is bad for old bones. Come and tell me a story in the morning.'); all(h.level >= 10, 'Level {name}... such a hero. In my day we just had a stout stick.'); }
  if (id === 'eira') { all(h.level >= levelCap(), 'You have climbed as far as you can, {name}. The church is ready for you whenever you are.'); all(h.level < levelCap(), 'Level {name}... not yet at the top. Come back at level ' + levelCap() + '.'); all(rebirths() > 0, 'Reborn ' + rebirths() + ' time' + (rebirths() === 1 ? '' : 's') + ' already. The church knows you.'); }
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
const REST_AT = 7 / 24;                                                  // resting at the inn always ends the next morning at 7:00
function startTimeSkip(at) {
  const v = vil; if (!v || v.skip) return;
  const d = at === null ? timeUntil(REST_AT) + (tod < REST_AT ? 1 : 0) : (timeUntil(at) || 1);       // null = rest: on to 7:00 of the next day, even from the small hours
  v.skip = { from: tod, span: d, to: (tod + d) % 1, days: Math.floor(tod + d + 1e-9), t: 0, done: false, rest: at === null, snoreT: 0, label: at === null ? 'Rested' : (TIME_STOPS.find(x => Math.abs(x[1] - at) < 1e-6) || ['later'])[0] };
  Sound.music('inn');
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
  if (t.kind === 'church') { enterChurch(); return; }
  if (t.kind === 'exit') { leaveChurch(); return; }
  if (t.kind === 'dog') { v.dog.pets = (v.dog.pets | 0) + 1; if (v.dog.pets % 3 === 0 && hero.gold >= 5) { hero.gold -= 5; sfx('treat'); popups.push({ text: 'Biscuit loves the treat (-5 gold)', x: VW / 2, y: 120, t: 2, screen: true, small: true, color: '#ffd86a' }); v.dog.mode = 'follow'; v.dog.fT = 45; v.dog.cool = 0; } v.dog.petT = 3; v.dog.pose = 'sit'; v.dog.f = hero.x >= v.dog.x ? 1 : -1; v.dog.moving = false; sfx('chirp'); sfxNear(v.dog, 'bark', 0.5); for (let i = 0; i < 4; i++) vfx(v, { x: v.dog.x + (Math.random() - 0.5) * 16, y: v.dog.y - 26, vx: (Math.random() - 0.5) * 20, vy: -30, life: 1, size: 3, color: '#ff7a9a' }); return; }
  if (t.kind === 'npc') { const n = t.ref; n.f = hero.x >= n.x ? 1 : -1; hero.facing = n.x >= hero.x ? 1 : -1; n.moving = false; }
  if (t.kind === 'npc') Sound.voice(voicePitch(t.ref)); else if (t.kind === 'board') sfx('paper'); else sfx('menuOpen');
  v.talk = t; openTalk();
}
const voicePitch = n => (n.look && n.look.dress ? 330 : 190) * (n.kid ? 1.6 : 1) * (0.9 + ([...(n.id || 'x')].reduce((a, c) => a + c.charCodeAt(0), 0) % 7) / 35);
function openTalk(text, override) {
  const v = vil, t = v.talk; if (!t) return;
  let name = '', role = '', body = text, btns = [];
  if (t.kind === 'npc') {
    const n = t.ref; name = n.name; role = n.role; body = body || talkText(n);
    if (n.shop === 'alch') btns.push(['shop', 'Browse potions']);
    if (n.shop === 'store') btns.push(['shop', 'Browse wares']);
    if (n.shop === 'armour') btns.push(['shop', 'Browse armour']);
    if (n.shop === 'jewel') btns.push(['shop', 'Browse jewellery']);
    if (n.shop === 'enchant') btns.push(['shop', 'Runes and enchanting']);
    if (n.shop === 'smith') btns.push(['shop:smithBuy', 'Buy weapons'], ['shop:smithUp', 'Upgrade gear'], ['shop:smithSell', 'Sell gear']);
    if (n.special === 'inn') btns.push(['rest', 'Rest and save (free)'], ['wait', 'Wait for a time of day...'], ['respec', `Reset stat points (${respecCost()} gold)`]);
    if (n.special === 'guard') btns.push(['go', 'Head out to face the boss']);
    if (n.special === 'shrine') btns.push(['shop:rebirth', hero.level >= levelCap() ? 'The Rite of Return (rebirth)' : 'The Rite of Return (see what rebirth gives)']);
    btns.push(['chat', `Chat ${hearts(n.id)}`], ['bye', 'Goodbye']);
    n.talking = true;
  } else if (t.kind === 'gate') {
    name = 'The Road'; role = 'Leave the village';
    body = body || `The road beyond the gate leads to the boss (wave ${wave + 1}). Your progress is saved when you leave. Head out?`;
    btns = [['go', 'Head out'], ['bye', 'Stay a while']];
  } else if (t.kind === 'craft') {
    name = 'Crafting Hall'; role = 'Opening soon';
    body = body || 'The shutters are closed and something heavy is being hammered inside. A note on the door reads: "Forging and crafting are coming. Please be patient."';
    btns = [['bye', 'Close']];
  } else if (t.kind === 'board') {
    name = 'Notice board'; role = vil.name;
    body = body || ['NOTICE: The road beyond the gate is dangerous. Heroes are advised to rest, resupply and heal before departing.', 'WANTED: Brave souls to deal with the beast on the road. Reward: our eternal gratitude.', 'LOST: One red ball. If found, return to the children. -- Pip', 'FOR SALE: Lanterns. Inquire with Tobin at the General Store.', 'REMINDER: Biscuit the dog is not a guard dog. Please stop asking him to guard things.'][Math.floor(Math.random() * 5)];
    btns = [['shop:quests', hero.quests.claim.length ? 'Read the quest board (a reward is waiting!)' : 'Read the quest board'], ['bye', 'Close']];
  }
  const col = t.kind === 'npc' ? (t.ref.look.body || t.ref.look.dress || '#8a8aa0') : '#c9a86a';
  const badge = t.kind === 'npc' ? `<span class="avatar" style="background:${col}">${escapeHtml(name.replace(/^(Old|Granny|Sgt\.)\s+/, '').charAt(0))}</span>` : '';
  document.getElementById('talkName').innerHTML = `${badge}${escapeHtml(name)} <small>${escapeHtml(role)}</small>`;
  document.getElementById('talkText').textContent = body;
  document.getElementById('talkBtns').classList.toggle('grid', (override || btns).length > 4);        // many choices sit in two columns, so nothing needs scrolling
  document.getElementById('talkBtns').innerHTML = (override || btns).map(([k, l, off], i) => `<button data-talk="${k}" ${off ? 'disabled' : ''}><kbd>${i + 1}</kbd>${escapeHtml(l)}</button>`).join('');
  showMenu('talk');
}
document.getElementById('talk').addEventListener('click', e => {
  const k = e.target.dataset && e.target.dataset.talk; if (!k || !vil) return;
  sfx('click');
  const v = vil, t = v.talk;
  if (k === 'bye') { if (t && t.kind === 'npc') t.ref.talking = false; v.talk = null; showMenu(null); }
  else if (k === 'go') { v.talk = null; v.leaveT = 0.9; sfx('gate'); showMenu(null); }
  else if (k === 'chat') { const n = t.ref; openTalk(`${hearts(n.id)}`, chatButtons(n)); }
  else if (['news', 'work', 'tip', 'ball', 'story'].includes(k) && t && t.kind === 'npc') chatAct(k, t.ref);
  else if (k === 'back') openTalk();
  else if (k === 'wait') {
    openTalk('Hours go by quickly in a warm room. When shall I wake you?', [...TIME_STOPS.map(([label, at]) => {
      const d = timeUntil(at), now = d < 0.012 || d > 0.988;
      return [`time:${at}`, `${label} (${campClockLabel(at)})${now ? ': it is about that now' : ''}`, now];
    }), ['back', 'Never mind']]);
  }
  else if (k.startsWith('time:')) { v.talk = null; showMenu(null); startTimeSkip(parseFloat(k.slice(5))); }
  else if (k === 'shop') { v.shop = t.ref.shop; sfx('shopBell'); showMenu('shop'); }
  else if (k.startsWith('shop:')) { v.shop = k.slice(5); v.rbArm = false; sfx('shopBell'); showMenu('shop'); }
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
  const big = ['smithUp', 'enchant', 'smithBuy', 'armour', 'jewel', 'smithSell', 'smith', 'quests'].includes(v.shop);
  document.querySelector('.shop-panel').classList.toggle('upgrade', big);                       // the wide windows: boxes on the left, the chosen piece on the right (nothing to scroll down to)
  document.querySelector('.shop-panel').classList.toggle('tiles', v.shop === 'alch' || v.shop === 'store');
  document.querySelector('.shop-panel').classList.toggle('enchant', v.shop === 'enchant');
  if (v.shop === 'rebirth') { renderRebirth(); return; }
  if (v.shop === 'smith' || v.shop === 'smithSell') { renderSellShop(); return; }
  if (v.shop === 'smithBuy' || v.shop === 'armour' || v.shop === 'jewel') { renderGearShop(v.shop); return; }
  if (v.shop === 'smithUp') { renderUpgradeShop(); return; }
  if (v.shop === 'enchant') { renderEnchantShop(); return; }
  if (v.shop === 'quests') { renderQuestBoard(); return; }
  const alch = v.shop === 'alch';
  document.getElementById('shopTitle').textContent = alch ? "MIRA'S POTIONS" : "TOBIN'S GENERAL STORE";
  document.getElementById('shopGold').textContent = hero.gold.toLocaleString();
  const sel = (v.tSel || (v.tSel = {}));
  if (alch) {
    const price = potionCost(), left = v.stock.potion | 0, have = hero.potions | 0, can = hero.gold >= price && left > 0 && have < POTION_MAX, P = POTIONS.heal;
    const tiles = [{ id: 'potion', svg: potionSvg(P.color, 44), name: 'Healing Potion', color: P.color, sub: left > 0 ? `${price} g · ${left} left` : 'Sold out', on: true, dim: left <= 0 }];
    const detail = tHead(potionSvg(P.color, 56), 'Healing Potion', P.color, `You carry ${have} of ${POTION_MAX}`) +
      `<div class="tdesc">Restores ${Math.round(POTION_HEAL * 100)}% of your health <b>and cures every ailment</b>: poison, chill, bleeding, burning, freezing, weakness, blindness and curses. A curse halves the healing. Drink with <kbd>Q</kbd>.</div>
      <div class="srow"><span>Price</span><b>${price.toLocaleString()} g</b></div><div class="srow"><span>In stock</span><b>${left}</b></div>
      <div class="ubuy"><button class="go" data-buy="potion" ${can ? '' : 'disabled'}>${have >= POTION_MAX ? 'Your satchel is full' : left <= 0 ? 'Sold out' : `Buy · ${price.toLocaleString()} g`}</button></div>`;
    document.getElementById('shopBody').innerHTML = tileShop(tiles, detail, 3);
    return;
  }
  const own = hero.lamp | 0, next = own + 1, scroll = sel.store === 'scroll', pick = LAMPS[sel.store] && sel.store >= 1 ? sel.store : Math.min(next, LAMPS.length - 1);
  const tiles = LAMPS.map((L, i) => i < 1 ? null : { id: String(i), svg: lampSvg(i <= own ? '#ffd86a' : i === next ? '#ffe9a8' : '#8a7a58', 44), name: L.name, color: i <= own ? '#ffd86a' : i === next ? '#f4e2a0' : '#9a8a68', sub: i <= own ? 'Owned' : `${L.cost.toLocaleString()} g`, on: !scroll && i === pick, dim: i > next, badge: i === own ? 'In use' : '' }).filter(Boolean);
  tiles.push({ id: 'scroll', svg: scrollSvg(44), name: 'Return Scroll', color: '#cfc0ff', sub: `${recallCost().toLocaleString()} g · you have ${hero.recalls | 0}`, on: scroll });
  if (scroll) {
    const have = hero.recalls | 0, cost = recallCost(), can = hero.gold >= cost && have < RECALL_MAX;
    document.getElementById('shopBody').innerHTML = tileShop(tiles, tHead(scrollSvg(56), 'Return Scroll', '#cfc0ff', `You carry ${have} of ${RECALL_MAX}`) +
      `<div class="tdesc">Read it anywhere on the road (equip it with the hold-<kbd>${escapeHtml(keyLabel('utility'))}</kbd> wheel, then press <kbd>${escapeHtml(keyLabel('potion'))}</kbd>) and after a few seconds you are back in the village, <b>whatever the wave</b>: to heal, shop, bank your gold and turn in quests. Leaving the village puts you back where you stood. It will not work while a boss is on the field, and being hit breaks the spell.</div>
      <div class="srow"><span>Price</span><b>${cost.toLocaleString()} g</b></div>
      <div class="ubuy"><button class="go" data-buy="scroll" ${can ? '' : 'disabled'}>${have >= RECALL_MAX ? 'You carry the most you can' : `Buy · ${cost.toLocaleString()} g`}</button></div>`, 3);
    return;
  }
  const L = LAMPS[pick], cur = LAMPS[own], buyable = pick === next && hero.gold >= L.cost;
  const detail = tHead(lampSvg('#ffe9a8', 56), L.name, '#ffd86a', `Lantern ${pick} of ${LAMPS.length - 1}`) +
    `<div class="tdesc">Widens the circle of light around you at night and in fog.</div>
    <div class="srow"><span>Your light</span><b>${BASE_LIGHT_RADIUS + (cur ? cur.bonus : 0)}${pick > own ? ` <i>→</i> <em>${BASE_LIGHT_RADIUS + L.bonus}</em>` : ''}</b></div>
    <div class="srow"><span>Price</span><b>${pick <= own ? 'Owned' : L.cost.toLocaleString() + ' g'}</b></div>
    <div class="ubuy"><button class="go" data-buy="lamp" ${buyable ? '' : 'disabled'}>${pick <= own ? 'You already have this' : pick > next ? 'Buy the lantern before it first' : `Buy · ${L.cost.toLocaleString()} g`}</button></div>`;
  document.getElementById('shopBody').innerHTML = tileShop(tiles, detail, 3);
}
// boxes on the left, the chosen thing with its details and the Buy button on the right (the same layout as the forge and the enchanting rooms)
const tHead = (svg, name, color, sub) => `<div class="uhead"><div class="uic big" style="border-color:${color}">${svg}</div><div><b style="color:${color}">${escapeHtml(name)}</b><small>${sub}</small></div></div>`;
const tileBtn = t => `<button class="utile${t.on ? ' on' : ''}${t.dim ? ' dim' : ''}" data-tpick="${t.id}" style="--rc:${t.color}" title="${escapeHtml(t.title || t.name)}">${t.badge ? `<i class="worn">${t.badge}</i>` : ''}<div class="uic" style="border-color:${t.color}">${t.svg}</div><span class="una" style="color:${t.color}">${escapeHtml(t.name)}</span><small>${t.sub}</small></button>`;
// empty slots after the real boxes (at least two rows), so a shelf with nothing on it still looks like a shelf
const padTiles = (html, cols = 4) => { const n = typeof html === 'number' ? html : (html.match(/class="utile/g) || []).length, total = Math.max(cols * 2, Math.ceil(n / cols) * cols); return '<div class="utile rtile empty"></div>'.repeat(total - n); };
const tileShop = (tiles, detail, cols = 4) => `<div class="upg tshop"><div class="upg-detail tdetail">${detail}</div><div class="upg-grid" style="grid-template-columns:repeat(${cols}, minmax(0, 1fr))">${tiles.map(tileBtn).join('')}${padTiles(tiles.length, cols)}</div></div>`;
function emptyEnchant(tabs, msg) { document.getElementById('shopBody').innerHTML = `<div class="ench">${tabs}<div class="upg"><div class="upg-detail rdetail"><div class="rnote">${msg}</div></div><div class="upg-grid">${padTiles(0, 4)}</div></div></div>`; }
const scrollSvg = (px = 40) => `<svg viewBox="0 0 28 28" width="${px}" height="${px}"><path d="M7 5 H21 V23 H7 Z" fill="#efe6c8" stroke="#6a5a3a" stroke-width="1.2"/><path d="M5 4 H23 V7 H5 Z M5 21 H23 V24 H5 Z" fill="#b8a070" stroke="#6a5a3a" stroke-width="1"/><path d="M10 12 L14 8 L18 12 M14 8 V18" fill="none" stroke="#8a50d0" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const potionSvg = (c, px = 40) => `<svg viewBox="0 0 28 28" width="${px}" height="${px}"><path d="M11 3h6v5l4 8a5.2 5.2 0 0 1-4.7 8h-4.6A5.2 5.2 0 0 1 7 16l4-8z" fill="${c}" stroke="#17171f" stroke-width="1"/><rect x="10.5" y="2" width="7" height="3" rx="1" fill="#c9a36a" stroke="#17171f" stroke-width=".8"/><path d="M10 17a4.5 4.5 0 0 0 3 4" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.4"/></svg>`;
const lampSvg = (c, px = 40) => `<svg viewBox="0 0 28 28" width="${px}" height="${px}"><path d="M10 6h8l2 4v9a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-9z" fill="#2a2a32" stroke="#17171f" stroke-width="1"/><path d="M11 11h6v8h-6z" fill="${c}"/><path d="M12 4h4v2h-4zM11 21h6v2h-6z" fill="#6a6a78"/><circle cx="14" cy="15" r="9" fill="${c}" fill-opacity=".18"/></svg>`;
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
  v.stock.jewel = ['ring', 'ring', 'necklace', 'artifact'].map(roll);
  v.stock.runes = [];                                                           // the Enchantress's shelf: six different runes, the luck ones rarer, nothing above Brilliant (an Eternal rune has to be made at her altar)
  for (let i = 0; v.stock.runes.length < 6 && i < 80; i++) { const k = rollRuneKey(2.5, 4); if (!v.stock.runes.some(e => e.k === k)) v.stock.runes.push({ k, price: runePrice(k) }); }
}
const gearScore = it => Object.entries(it.stats).reduce((a, [k, x]) => a + x / GEAR_STATS[k].max, 0);
const statLine = it => Object.entries(it.stats).map(([k, x]) => `${GEAR_STATS[k].name} ${GEAR_STATS[k].fmt(x)}`).join(' · ');
const slotOf = it => it.slot === 'ring' ? 'ring1' : it.slot;
function renderGearShop(kind) {
  const v = vil, stockKey = kind === 'smithBuy' ? 'smith' : kind, list = v.stock[stockKey] || [];
  document.getElementById('shopTitle').textContent = { smithBuy: "BRANN'S FORGE: WEAPONS", armour: "DAGNA'S ARMOURY", jewel: "LYSA'S JEWELLERY" }[kind];
  document.getElementById('shopGold').textContent = hero.gold.toLocaleString();
  const have = list.map((e, i) => e && { ...e, i }).filter(Boolean);
  if (!have.length) { document.getElementById('shopBody').innerHTML = tileShop([], '<div class="tdesc">Everything is sold. New stock arrives with the next village.</div>', 4); return; }
  const sel = v.tSel || (v.tSel = {}), cur = have.find(e => e.i === sel[kind]) || have[0]; sel[kind] = cur.i;
  const tiles = have.map(e => { const R = RARITIES[e.item.rarity]; return { id: String(e.i), svg: slotSvg(e.item.slot, R.color, e.item), name: e.item.name, color: R.color, sub: `${e.price.toLocaleString()} g`, on: e === cur, badge: `Lv ${e.item.ilvl || 1}` }; });
  const it = cur.item, R = RARITIES[it.rarity], worn = hero.equip[slotOf(it)], bagFull = hero.inv.length >= INV_MAX, can = hero.gold >= cur.price && !bagFull;
  const better = gearScore(it) > (worn ? gearScore(worn) : 0) + 1e-9, base = it.slot === 'weapon' ? SWORDS.find(x => x.id === it.base) : null;
  const detail = tHead(slotSvg(it.slot, R.color, it), it.name, R.color, `${R.name} ${SLOT_LABEL[it.slot].toLowerCase()} · Item level ${it.ilvl || 1}${better ? ' · <span style="color:#7fd08a">better than yours</span>' : ''}`) +
    `<div class="ustats">${base ? weaponLine(it) : ''}${statRows(it, worn || { stats: {} })}</div>${worn ? `<div class="hint cmpnote">compared with <b style="color:${RARITIES[worn.rarity].color}">${escapeHtml(worn.name)}</b></div>` : ''}
    <div class="ubuy"><button class="go" data-buy="buy:${stockKey}:${cur.i}" ${can ? '' : 'disabled'}>${bagFull ? 'Your bag is full' : `Buy · ${cur.price.toLocaleString()} g`}</button></div>`;
  document.getElementById('shopBody').innerHTML = tileShop(tiles, detail, 4);
}

// Ysolde the Enchantress sells runes (dear, and never above Brilliant) and improves the ones you carry at her altar, one tier at a time.
// A failed improvement costs the gold and the rune falls a tier (a Faint rune just stays Faint), like a failed upgrade at the forge.
function renderEnchantShop() {
  const v = vil, R0 = k => RUNES[k];
  document.getElementById('shopTitle').textContent = "YSOLDE'S ENCHANTING SANCTUM";
  document.getElementById('shopGold').textContent = hero.gold.toLocaleString();
  const tab = ['up', 'fx', 'ess'].includes(v.enchTab) ? v.enchTab : 'buy', owned = RUNE_KEYS.filter(k => runeCount(k) > 0), total = owned.reduce((a, k) => a + runeCount(k), 0);
  const tabs = `<div class="etabs"><button data-etab="buy" class="${tab === 'buy' ? 'on' : ''}"><i>✦</i> Rune shelf</button><button data-etab="up" class="${tab === 'up' ? 'on' : ''}"><i>✧</i> Rune altar</button><button data-etab="fx" class="${tab === 'fx' ? 'on' : ''}"><i>⚔</i> Imbue weapons</button><button data-etab="ess" class="${tab === 'ess' ? 'on' : ''}"><i>❂</i> Essence altar</button><span class="ehave">${total} rune${total === 1 ? '' : 's'} · ${essTotal()} essence${essTotal() === 1 ? '' : 's'}</span></div>`;
  const stat = k => { const S = GEAR_STATS[R0(k).stat]; return `<div class="srow"><span>${S.name}</span><b>${S.fmt(R0(k).val)}</b></div>`; };
  const tile = (k, pick, on, sub) => `<button class="utile rtile${on ? ' on' : ''}" data-epick="${pick}" style="--rc:${R0(k).tier > 1 ? R0(k).tc : R0(k).color};--rk:${R0(k).color}" title="${escapeHtml(runeLine(k))}"><div class="uic">${runeSvg(k, 46)}</div><span class="una" style="color:${R0(k).tier > 1 ? R0(k).tc : R0(k).color}">${escapeHtml(R0(k).title)}</span><small>${sub}</small></button>`;
  let tiles = '', detail = '';
  if (tab === 'buy') {
    const list = (v.stock.runes || []).map((e, i) => e && { ...e, i }).filter(Boolean);
    if (!list.length) { emptyEnchant(tabs, 'The shelf is bare. Ysolde will have new runes when you reach the next village.'); return; }
    const sel = list.find(e => e.i === v.enchBuySel) || list[0]; v.enchBuySel = sel.i;
    tiles = list.map(e => tile(e.k, 'buy:' + e.i, e === sel, `${e.price.toLocaleString()} g`)).join('');
    const k = sel.k, R = R0(k), can = hero.gold >= sel.price && runeCount(k) < RUNE_MAX;
    detail = `<div class="upg-detail rdetail" style="--rc:${R.tier > 1 ? R.tc : R.color}"><div class="uhead"><div class="uic big">${runeSvg(k, 62)}</div><div><b style="color:${R.tier > 1 ? R.tc : R.color}">${escapeHtml(R.title)}</b>
      <small>Tier ${R.tier} of ${RUNE_TIERS.length} · you hold ${runeCount(k)}</small></div></div>
      <div class="ustats">${stat(k)}</div>
      <div class="rnote">Set into any Uncommon or better piece at Brann's forge. ${R.tier < RUNE_TIERS.length ? `It can be improved at the altar to ${escapeHtml(R0(runeNext(k)).title)}.` : 'It is the finest tier a rune can reach.'}</div>
      <div class="ubuy"><button class="go" data-ebuy="${sel.i}" ${can ? '' : 'disabled'}>${runeCount(k) >= RUNE_MAX ? 'You hold the most you can' : `Buy · ${sel.price.toLocaleString()} g`}</button></div></div>`;
  } else if (tab === 'up') {
    if (!owned.length) { emptyEnchant(tabs, 'You carry no runes. Monsters leave them now and then (bosses most often), and Ysolde sells them on her shelf.'); return; }
    if (!owned.includes(v.enchSel)) v.enchSel = owned[0];
    const k = v.enchSel, R = R0(k), nk = runeNext(k);
    tiles = owned.map(c => tile(c, 'up:' + c, c === k, `×${runeCount(c)} · ${R0(c).tname}`)).join('');
    const chance = runeUpChance(k), cost = runeUpCost(k), can = canRuneUp(k) && hero.gold >= cost, msg = v.enchMsg ? `<div class="umsg ${v.enchMsg.kind}">${escapeHtml(v.enchMsg.text)}</div>` : '';
    const lower = R.tier > 1 ? R0(runeKey(R.base, R.tier - 1)).title : null;
    const stats = nk ? `<div class="srow"><span>${GEAR_STATS[R.stat].name}</span><b>${GEAR_STATS[R.stat].fmt(R.val)} <i>→</i> <em>${GEAR_STATS[R.stat].fmt(R0(nk).val)}</em></b></div>` : stat(k);
    detail = `<div class="upg-detail rdetail" style="--rc:${R.tier > 1 ? R.tc : R.color}"><div class="uhead"><div class="uic big">${runeSvg(k, 62)}</div><div><b style="color:${R.tier > 1 ? R.tc : R.color}">${escapeHtml(R.title)}</b>
      <small>Tier ${R.tier} of ${RUNE_TIERS.length} · you hold ${runeCount(k)}</small></div></div>
      ${nk ? `<div class="rup"><div class="uic">${runeSvg(k, 44)}</div><span>✦</span><div class="uic">${runeSvg(nk, 44)}</div></div><div class="ulevel">Improve to <b style="color:${R0(nk).tc}">${escapeHtml(R0(nk).title)}</b></div>` : '<div class="ulevel">This rune has reached its finest tier</div>'}
      <div class="ustats">${stats}</div>
      ${nk ? `<div class="uodds"><div class="obar"><div class="ofill" style="width:${Math.round(chance * 100)}%"></div></div><div class="otxt"><b>${Math.round(chance * 100)}%</b> to succeed
        <small>${lower ? `If it fails, the rune falls to ${escapeHtml(lower)}` : 'If it fails, nothing is lost but the gold'}${gearStat('upLuck') ? ` · includes +${Math.round(gearStat('upLuck') * 50)}% from your upgrade luck` : ''}</small></div></div>` : ''}${msg}
      <div class="ubuy"><button class="go" data-eup="${k}" ${can ? '' : 'disabled'}>${!nk ? 'Fully improved' : runeCount(nk) >= RUNE_MAX ? 'You hold the most of the next tier' : `Improve · ${cost.toLocaleString()} g`}</button></div></div>`;
  } else if (tab === 'fx') {                                                                // imbue: put an essence you found into a weapon
    const weps = []; for (const it of [hero.equip.weapon, hero.equip.weapon2, ...hero.inv]) if (it && it.slot === 'weapon' && !weps.some(w => w.id === it.id)) weps.push(it);
    const sel = weps.find(i => i.id === v.fxSel) || weps[0]; v.fxSel = sel.id;
    const mine = ESS_KEYS.filter(k => essCount(k) > 0), cur = sel.fx ? essKey(sel.fx.k, sel.fx.lv) : null;
    const pick = mine.includes(v.fxEss) ? v.fxEss : mine[0] || null; v.fxEss = pick;
    tiles = weps.map(it => { const R = RARITIES[it.rarity], F = it.fx && WFX[it.fx.k], wield = it === hero.equip.weapon;
      return `<button class="utile rtile${it === sel ? ' on' : ''}" data-epick="fxw:${escapeHtml(it.id)}" style="--rc:${F ? F.color : R.color}" title="${escapeHtml(it.name)}">${wield ? '<i class="worn">Wielded</i>' : ''}<div class="uic" style="border-color:${R.color}">${slotSvg('weapon', R.color, it)}</div><span class="una" style="color:${R.color}">${escapeHtml(it.name.replace(/ \+\d+$/, ''))}</span><small style="${F ? 'color:' + F.color : ''}">${F ? F.name + ' ' + ROMAN[it.fx.lv] : 'No effect'}</small></button>`; }).join('');
    const R = RARITIES[sel.rarity], sw = SWORDS.find(s => s.id === sel.base), dmg = (sw ? sw.dmg : 10) + Math.round(sel.stats.dmg || 0);
    const msg = v.fxMsg ? `<div class="umsg ${v.fxMsg.kind}">${escapeHtml(v.fxMsg.text)}</div>` : '';
    const E = pick && ESS[pick], fee = pick ? imbueFee(sel, pick) : 0, same = pick && cur === pick;
    detail = `<div class="upg-detail rdetail" style="--rc:${E ? E.color : R.color}"><div class="uhead"><div class="uic big" style="border-color:${R.color}">${slotSvg('weapon', R.color, sel)}</div><div><b style="color:${R.color}">${escapeHtml(sel.name.replace(/ \+\d+$/, ''))}</b>
      <small>${sel.fx ? `<span style="color:${WFX[sel.fx.k].color}">${WFX[sel.fx.k].name} ${ROMAN[sel.fx.lv]}</span> imbued` : 'No effect imbued'}</small></div></div>
      ${mine.length ? `<div class="fxrow wrap">${mine.map(k => `<button class="fxb${k === pick ? ' on' : ''}" data-eess="${k}" style="--rc:${ESS[k].color}" title="${escapeHtml(ESS[k].title)}">${essSvg(k, 26)}<small>×${essCount(k)}</small></button>`).join('')}</div>
        <div class="rnote"><b style="color:${E.color}">${escapeHtml(E.title)}</b>: ${escapeHtml(WFX[E.fx].blurb)}. ${escapeHtml(wfxText(E.fx, E.lv, dmg))}.${sel.fx && !same ? ' The essence now in the weapon returns to your pouch.' : ''}</div>`
        : '<div class="rnote">You have no essences. Elites and bosses drop them, and they cannot be bought or sold.</div>'}${msg}
      <div class="ubuy"><button class="go" data-eapply="1" ${pick && hero.gold >= fee && !same ? '' : 'disabled'}>${!pick ? 'No essence to imbue' : same ? 'Already imbued' : `${sel.fx ? 'Replace' : 'Imbue'} · ${fee.toLocaleString()} g`}</button>${sel.fx ? '<button data-eremove="1" title="Take the essence out (free); it returns to your pouch">Remove</button>' : ''}</div></div>`;
  } else {                                                                                // the essence altar: improve an essence one level, with a risk
    const mine = ESS_KEYS.filter(k => essCount(k) > 0);
    if (!mine.length) { emptyEnchant(tabs, 'You carry no essences. Elites and bosses drop them (bosses most often), and nobody sells them.'); return; }
    if (!mine.includes(v.essSel)) v.essSel = mine[0];
    const k = v.essSel, E = ESS[k], nk = essNext(k), chance = essUpChance(k), cost = essUpCost(k), can = canEssUp(k) && hero.gold >= cost, lower = E.lv > 1 ? ESS[essKey(E.fx, E.lv - 1)].title : null;
    tiles = mine.map(c => `<button class="utile rtile${c === k ? ' on' : ''}" data-epick="ess:${c}" style="--rc:${ESS[c].color}" title="${escapeHtml(ESS[c].title)}"><div class="uic">${essSvg(c, 46)}</div><span class="una" style="color:${ESS[c].color}">${escapeHtml(ESS[c].title)}</span><small>×${essCount(c)}</small></button>`).join('');
    const msg = v.essMsg ? `<div class="umsg ${v.essMsg.kind}">${escapeHtml(v.essMsg.text)}</div>` : '';
    detail = `<div class="upg-detail rdetail" style="--rc:${E.color}"><div class="uhead"><div class="uic big" style="border-color:${E.color}">${essSvg(k, 62)}</div><div><b style="color:${E.color}">${escapeHtml(E.title)}</b><small>Level ${E.lv} of ${WFX_LV} · you hold ${essCount(k)}</small></div></div>
      ${nk ? `<div class="rup"><div class="uic">${essSvg(k, 44)}</div><span>✦</span><div class="uic">${essSvg(nk, 44)}</div></div><div class="ulevel">Improve to <b style="color:${E.color}">${escapeHtml(ESS[nk].title)}</b></div>` : '<div class="ulevel">This essence is at its finest level</div>'}
      <div class="rnote">${escapeHtml(WFX[E.fx].blurb)}.</div>
      ${nk ? `<div class="uodds"><div class="obar"><div class="ofill" style="width:${Math.round(chance * 100)}%"></div></div><div class="otxt"><b>${Math.round(chance * 100)}%</b> to succeed
        <small>${lower ? `If it fails, it falls to ${escapeHtml(lower)}` : 'If it fails, nothing is lost but the gold'}${gearStat('upLuck') ? ` · includes +${Math.round(gearStat('upLuck') * 50)}% from your upgrade luck` : ''}</small></div></div>` : ''}${msg}
      <div class="ubuy"><button class="go" data-eessup="${k}" ${can ? '' : 'disabled'}>${!nk ? 'Fully improved' : essCount(nk) >= ESS_MAX ? 'You hold the most of the next level' : `Improve · ${cost.toLocaleString()} g`}</button></div></div>`;
  }
  document.getElementById('shopBody').innerHTML = `<div class="ench">${tabs}<div class="upg">${detail}<div class="upg-grid">${tiles}${padTiles(tiles, 4)}</div></div></div>`;
}
// Brann improves gear. The pieces you own sit in a grid of tiles; click one and its stats appear on the left with the stats it would have after the next level, the odds,
// and the Upgrade button. A failed upgrade costs the gold and drops the piece one level; a success raises it one (see attemptUpgrade in gear.js).
function renderUpgradeShop() {
  document.getElementById('shopTitle').textContent = "BRANN'S FORGE: UPGRADE GEAR";
  document.getElementById('shopGold').textContent = hero.gold.toLocaleString();
  const rows = [...activeSlots().map(k => hero.equip[k]).filter(Boolean).map(it => ({ it, eq: true })), ...hero.inv.map(it => ({ it, eq: false }))].filter(r => Object.keys(r.it.stats).length);
  if (!rows.length) { document.getElementById('shopBody').innerHTML = '<div class="hint" style="text-align:center">You have no gear with stats to improve yet. Gear drops from monsters, and bosses always drop some.</div>'; return; }
  const sel = rows.find(r => r.it.id === vil.upSel) || rows[0]; vil.upSel = sel.it.id;
  const tiles = rows.map(({ it, eq }, i) => {
    const R = RARITIES[it.rarity], up = it.up | 0;
    return `<button class="utile${it === sel.it ? ' on' : ''}" data-pick="${escapeHtml(it.id)}" style="--rc:${R.color}" title="${escapeHtml(it.name)}">${i < 9 ? `<kbd>${i + 1}</kbd>` : ''}${eq ? '<i class="worn">Worn</i>' : ''}<div class="uic">${slotSvg(it.slot, R.color, it)}</div><span class="una" style="color:${R.color}">${escapeHtml(it.name.replace(/ \+\d+$/, ''))}</span><small>${up ? '+' + up : 'Lv ' + (it.ilvl || 1)}</small></button>`;
  }).join('');
  const it = sel.it, R = RARITIES[it.rarity], up = it.up | 0, max = upgradeMax(it), done = up >= max, cost = upgradeCost(it), can = !done && hero.gold >= cost, chance = upgradeChance(it);
  const next = done ? null : statsAtUp(it, up + 1);
  const statRows = Object.keys(it.stats).map(k => { const S = GEAR_STATS[k]; return `<div class="srow"><span>${S.name}</span><b>${S.fmt(it.stats[k])}${next ? ` <i>→</i> <em>${S.fmt(next[k])}</em>` : ''}</b></div>`; }).join('');
  const ns = socketsOf(it), rn = it.rn || [], open = vil.sockOpen;
  let sock = '';
  if (ns) {
    const free = ns - rn.length, owned = RUNE_KEYS.filter(k => runeCount(k) > 0);
    sock = `<div class="usock"><div class="slabel">Sockets <small>${rn.length}/${ns}</small></div><div class="sbox">` +
      Array.from({ length: ns }, (_, i) => rn[i] ? `<button class="sk on" data-sock="off:${escapeHtml(it.id)}:${i}" style="--rc:${RUNES[rn[i]].color}" title="${escapeHtml(runeLine(rn[i]))} (click to take it out)">${runeSvg(rn[i], 28)}</button>`
        : `<button class="sk${open === i ? ' sel' : ''}" data-sock="pick:${i}" title="Choose a rune for this socket">+</button>`).join('') + '</div>' +
      (free > 0 && open !== null && open !== undefined ? `<div class="spick">${owned.length ? owned.map(k => `<button class="rp" data-sock="put:${escapeHtml(it.id)}:${k}" style="--rc:${RUNES[k].color}" title="${escapeHtml(runeLine(k))}">${runeSvg(k, 26)}<b>${runeCount(k)}</b></button>`).join('') : '<small>No runes yet: they drop from monsters, and Ysolde the Enchantress sells them.</small>'}</div>` : '') + '</div>';
  } else sock = '<div class="usock none"><small>No sockets: Uncommon and better pieces have them.</small></div>';
  const msg = vil.upMsg && vil.upMsg.id === it.id ? `<div class="umsg ${vil.upMsg.kind}">${escapeHtml(vil.upMsg.text)}</div>` : '';
  const odds = done ? '<div class="uodds">Fully upgraded</div>'
    : `<div class="uodds"><div class="obar"><div class="ofill" style="width:${Math.round(chance * 100)}%"></div></div><div class="otxt"><b>${Math.round(chance * 100)}%</b> to succeed (+${up + 1}) <small>${up ? `If it fails, it drops to +${up - 1}` : 'If it fails, nothing is lost but the gold'}${gearStat('upLuck') ? ` · includes +${Math.round(gearStat('upLuck') * 100)}% luck` : ''}</small></div></div>`;
  const detail = `<div class="upg-detail" style="--rc:${R.color}"><div class="uhead"><div class="uic big">${slotSvg(it.slot, R.color, it)}</div><div><b style="color:${R.color}">${escapeHtml(it.name.replace(/ \+\d+$/, ''))}</b>
      <small>${R.name} ${SLOT_LABEL[it.slot].toLowerCase()} · Item level ${it.ilvl || 1}${sel.eq ? ' · Worn' : ''}</small></div></div>
    <div class="ulevel">Upgrade <b>+${up}</b> of ${max}${done ? '' : ` <span>next: +${up + 1}</span>`}</div>
    <div class="ustats">${statRows}</div>${sock}${odds}${msg}
    <div class="ubuy"><button class="go" data-buy="up:${escapeHtml(it.id)}" ${can ? '' : 'disabled'}>${done ? 'Fully upgraded' : `Upgrade · ${cost.toLocaleString()} g`}</button><button data-up5="${escapeHtml(it.id)}" ${can ? '' : 'disabled'} title="Try up to five times, stopping when you cannot afford it">×5</button></div></div>`;
  document.getElementById('shopBody').innerHTML = `<div class="upg">${detail}<div class="upg-grid">${tiles}</div></div>`;
}

// the blacksmith buys spare gear (equipped pieces are never offered). Tick several pieces and sell them together, or use a quick button to pick everything up to a grade.
function renderSellShop() {
  document.getElementById('shopTitle').textContent = "BRANN'S FORGE: SELL GEAR";
  document.getElementById('shopGold').textContent = hero.gold.toLocaleString();
  const sel = vil.sellSel || (vil.sellSel = new Set());
  for (const id of [...sel]) if (!hero.inv.some(i => i.id === id)) sel.delete(id);
  if (hero.inv.length === 0) { document.getElementById('shopBody').innerHTML = tileShop([], '<div class="tdesc">Your backpack is empty. Gear drops from monsters, and bosses always drop some.</div>', 5); return; }
  const items = [...hero.inv].sort((a, b) => b.value - a.value), picked = items.filter(i => sel.has(i.id)), sum = picked.reduce((a, i) => a + i.value, 0);
  const foc = items.find(i => i.id === vil.sellFocus) || items[0];
  const tiles = items.map(it => { const R = RARITIES[it.rarity], on = sel.has(it.id); return { id: it.id, svg: slotSvg(it.slot, R.color, it), name: it.name, color: R.color, sub: `${it.value.toLocaleString()} g`, on: it === foc, badge: on ? '✓ sell' : '', title: it.name }; });
  const R = RARITIES[foc.rarity], ticked = sel.has(foc.id);
  const detail = tHead(slotSvg(foc.slot, R.color, foc), foc.name, R.color, `${R.name} ${SLOT_LABEL[foc.slot].toLowerCase()} · Lv ${foc.ilvl || 1} · worth ${foc.value.toLocaleString()} g`) +
    `<div class="ustats">${foc.slot === 'weapon' ? weaponLine(foc) : ''}${statRows(foc)}</div>
    <div class="multirow"><button data-sel="pick:${escapeHtml(foc.id)}" class="${ticked ? 'on' : ''}">${ticked ? '✓ Selling this' : 'Sell this one'}</button><button data-sel="all">All</button><button data-sel="none">None</button>` +
    [1, 2, 3].map(r => `<button data-sel="le${r}" style="border-color:${RARITIES[r].color}">≤ ${RARITIES[r].name}</button>`).join('') + `</div>
    <div class="ubuy"><button class="go sell" data-sel="sell" ${picked.length ? '' : 'disabled'}>Sell ${picked.length} piece${picked.length === 1 ? '' : 's'} · ${sum.toLocaleString()} g</button></div>`;
  document.getElementById('shopBody').innerHTML = tileShop(tiles, detail, 5);
}
// the ticks and quick buttons of the sell shop
function sellSelClick(k) {
  const sel = vil.sellSel || (vil.sellSel = new Set());
  if (k === 'all') hero.inv.forEach(i => sel.add(i.id));
  else if (k === 'none') sel.clear();
  else if (k.startsWith('le')) { sel.clear(); hero.inv.filter(i => i.rarity <= +k.slice(2)).forEach(i => sel.add(i.id)); }
  else if (k.startsWith('pick:')) { const id = k.slice(5); if (sel.has(id)) sel.delete(id); else sel.add(id); vil.sellFocus = id; }
  else if (k === 'sell') {
    const picked = hero.inv.filter(i => sel.has(i.id)), gold = sellPieces(picked);
    if (!gold) { sfx('denied'); return; }
    sel.clear(); sfx('sellAll'); popups.push({ text: `Sold ${picked.length} piece${picked.length === 1 ? '' : 's'} for ${gold.toLocaleString()} gold`, x: VW / 2, y: 120, t: 1.6, screen: true, small: true, color: '#f5c451' });
    saveGame(true, true); renderShop(); return;
  }
  sfx('tick'); renderShop();
}
document.getElementById('shop').addEventListener('click', e => {
  const qa = e.target.closest('[data-qa]');
  if (qa && vil) {                                                      // the quest board: accept, abandon, collect
    const [op, id] = qa.dataset.qa.split(':'), Q = hero.quests;
    if (op === 'accept') { const q = (vil.questOffers || []).find(x => x.id === id); if (!q || Q.active.length >= QUEST_MAX) { sfx('denied'); return; } vil.questOffers = vil.questOffers.filter(x => x !== q); Q.active.push(q); vil.tSel.quests = q.id; sfx('unlock'); saveGame(true, true); }
    else if (op === 'abandon') { const q = Q.active.find(x => x.id === id); if (!q) return; Q.active = Q.active.filter(x => x !== q); sfx('discard'); saveGame(true, true); }
    else if (op === 'claim') { const q = Q.claim.find(x => x.id === id); if (!q || !claimQuest(q)) { sfx('denied'); return; } }
    renderShop(); return;
  }
  const tp = e.target.closest('[data-tpick]');
  if (tp && vil) {                                                      // a box in a tile shop: choose it (in the sell shop, a click also ticks it)
    const sh = vil.shop, id = tp.dataset.tpick;
    if (sh === 'smithSell' || sh === 'smith') { sellSelClick('pick:' + id); return; }
    (vil.tSel || (vil.tSel = {}))[sh] = (sh === 'quests' || id === 'scroll') ? id : +id; sfx('tick'); renderShop(); return;
  }
  const sb = e.target.closest('[data-sel]'); if (sb && vil) { sellSelClick(sb.dataset.sel); return; }
  const et = e.target.closest('[data-etab]'); if (et && vil) { vil.enchTab = et.dataset.etab; vil.enchMsg = null; vil.fxMsg = null; vil.essMsg = null; sfx('tick'); renderShop(); return; }
  const ep = e.target.closest('[data-epick]'); if (ep && vil) { const [w, a] = ep.dataset.epick.split(':'); if (w === 'buy') vil.enchBuySel = +a; else if (w === 'fxw') { vil.fxSel = a; vil.fxMsg = null; } else if (w === 'ess') { vil.essSel = a; vil.essMsg = null; } else vil.enchSel = a; vil.enchMsg = null; sfx('tick'); renderShop(); return; }
  const ee = e.target.closest('[data-eess]'); if (ee && vil) { vil.fxEss = ee.dataset.eess; vil.fxMsg = null; sfx('tick'); renderShop(); return; }
  const efa = e.target.closest('[data-eapply], [data-eremove]');
  if (efa && vil) {                                                     // imbue the chosen weapon with an essence, or take its essence out
    const it = [hero.equip.weapon, hero.equip.weapon2, ...hero.inv].find(i => i && i.id === vil.fxSel);
    if (!it) { sfx('denied'); return; }
    if (efa.dataset.eremove) { if (stripWeapon(it)) { vil.fxMsg = { kind: 'bad', text: 'The essence returns to your pouch.' }; sfx('unequip'); saveGame(true, true); } renderShop(); return; }
    const k = vil.fxEss, fee = ESS[k] ? imbueFee(it, k) : 0;
    if (!ESS[k] || essCount(k) < 1 || hero.gold < fee || (it.fx && essKey(it.fx.k, it.fx.lv) === k)) { sfx('denied'); return; }
    hero.gold -= fee; imbueWeapon(it, k); hero.goldPulse = 0.6;
    vil.fxMsg = { kind: 'good', text: `${ESS[k].title} is woven into the blade!` };
    popups.push({ text: vil.fxMsg.text, x: VW / 2, y: 120, t: 1.8, screen: true, small: true, color: ESS[k].color }); sfx('runeUp'); sfx('coin'); saveGame(true, true); renderShop(); return;
  }
  const eue = e.target.closest('[data-eessup]');
  if (eue && vil) {                                                     // improve an essence one level
    const k = eue.dataset.eessup, cost = essUpCost(k);
    if (!ESS[k] || !canEssUp(k) || hero.gold < cost) { sfx('denied'); return; }
    const from = ESS[k], to = essNext(k); hero.gold -= cost; const res = attemptEssUp(k), lower = from.lv > 1 ? essKey(from.fx, from.lv - 1) : k;
    vil.essMsg = { kind: res === 'up' ? 'good' : 'bad', text: res === 'up' ? `It worked! You now hold ${ESS[to].title}` : res === 'down' ? `It failed, and the essence fell to ${ESS[lower].title}` : 'It failed. Nothing lost but the gold' };
    if (!essCount(k)) vil.essSel = res === 'up' ? to : lower;
    popups.push({ text: vil.essMsg.text, x: VW / 2, y: 120, t: 1.8, screen: true, small: true, color: res === 'up' ? from.color : '#f88' });
    hero.goldPulse = 0.6; sfx(res === 'up' ? 'runeUp' : 'runeFail'); saveGame(true, true); renderShop(); return;
  }
  const eb = e.target.closest('[data-ebuy]');
  if (eb && vil) {                                                      // buying a rune from the shelf
    const list = vil.stock.runes || [], idx = +eb.dataset.ebuy, en = list[idx];
    if (!en || hero.gold < en.price || runeCount(en.k) >= RUNE_MAX) { sfx('denied'); return; }
    hero.gold -= en.price; addRune(en.k); list[idx] = null;
    popups.push({ text: `Bought ${RUNES[en.k].title}`, x: VW / 2, y: 120, t: 1.6, screen: true, small: true, color: RUNES[en.k].tier > 1 ? RUNES[en.k].tc : RUNES[en.k].color });
    hero.goldPulse = 0.6; sfx('coin'); sfx('sparkle'); saveGame(true, true); renderShop(); return;
  }
  const eu = e.target.closest('[data-eup]');
  if (eu && vil) {                                                      // improving a rune at the altar
    const k = eu.dataset.eup, cost = runeUpCost(k);
    if (!RUNES[k] || !canRuneUp(k) || hero.gold < cost) { sfx('denied'); return; }
    const from = RUNES[k], to = runeNext(k); hero.gold -= cost; const res = attemptRuneUp(k);
    const lower = from.tier > 1 ? runeKey(from.base, from.tier - 1) : k;
    vil.enchMsg = { kind: res === 'up' ? 'good' : 'bad', text: res === 'up' ? `It worked! You now hold ${RUNES[to].title}` : res === 'down' ? `It failed, and the rune fell to ${RUNES[lower].title}` : 'It failed. Nothing lost but the gold' };
    if (!runeCount(k)) vil.enchSel = res === 'up' ? to : lower;
    popups.push({ text: vil.enchMsg.text, x: VW / 2, y: 120, t: 1.8, screen: true, small: true, color: res === 'up' ? '#cfa8ff' : '#f88' });
    hero.goldPulse = 0.6; sfx(res === 'up' ? 'runeUp' : 'runeFail'); saveGame(true, true); renderShop(); return;
  }
  const pk = e.target.closest('[data-pick]'); if (pk && vil) { vil.upSel = pk.dataset.pick; vil.sockOpen = null; sfx('tick'); renderShop(); return; }
  const sk = e.target.closest('[data-sock]');
  if (sk && vil) {                                                      // sockets: open the chooser, put a rune in, take it out
    const [op, a, b] = sk.dataset.sock.split(':'), it = activeSlots().map(k => hero.equip[k]).concat(hero.inv).find(i => i && i.id === a);
    if (op === 'pick') vil.sockOpen = vil.sockOpen === +a ? null : +a;
    else if (op === 'put' && it && socketRune(it, b)) { vil.sockOpen = null; sfx('socket'); saveGame(true, true); }
    else if (op === 'off' && it && unsocketRune(it, +b)) { sfx('unsocket'); saveGame(true, true); }
    else sfx('denied');
    renderShop(); return;
  }
  const u5 = e.target.closest('[data-up5]');
  const id = u5 ? 'up5:' + u5.dataset.up5 : e.target.closest('[data-buy]') && e.target.closest('[data-buy]').dataset.buy; if (!id || !vil) return;
  if (id.startsWith('rb:')) { rebirthClick(id); return; }
  const say = (text, color) => popups.push({ text, x: VW / 2, y: 120, t: 1.6, screen: true, small: true, color });
  if (id === 'junk' || id.startsWith('sell:')) {
    const sold = id === 'junk' ? hero.inv.filter(i => i.rarity <= 1) : hero.inv.filter(i => i.id === id.slice(5));
    if (!sold.length) { sfx('denied'); return; }
    const gold = sold.reduce((a, i) => a + i.value, 0);
    hero.inv = hero.inv.filter(i => !sold.includes(i)); hero.gold += gold; hero.goldPulse = 0.6;
    say(`Sold ${sold.length === 1 ? sold[0].name : sold.length + ' pieces'} for ${gold} gold`, '#f5c451'); sfx('coin'); saveGame(true, true); renderShop();
    return;
  }
  if (id.startsWith('buy:')) {
    const [, key, idx] = id.split(':'), list = vil.stock[key], e = list && list[+idx];
    if (!e || hero.gold < e.price || hero.inv.length >= INV_MAX) { sfx('denied'); return; }
    hero.gold -= e.price; hero.inv.push(e.item); list[+idx] = null;
    say(`Bought ${e.item.name}`, RARITIES[e.item.rarity].color); hero.goldPulse = 0.6; sfx('coin'); saveGame(true, true); renderShop();
    return;
  }
  if (id.startsWith('up:') || id.startsWith('up5:')) {
    const five = id.startsWith('up5:'), it = activeSlots().map(k => hero.equip[k]).concat(hero.inv).find(i => i && i.id === id.slice(five ? 4 : 3));
    const tally = { up: 0, down: 0, fail: 0 }; let last = null;
    for (let i = 0; it && i < (five ? 5 : 1) && canUpgrade(it) && hero.gold >= upgradeCost(it); i++) { hero.gold -= upgradeCost(it); last = attemptUpgrade(it); tally[last]++; }
    if (!last) { sfx('denied'); return; }
    if (activeSlots().some(k => hero.equip[k] === it)) recalcGear();
    const tries = tally.up + tally.down + tally.fail, up = it.up | 0;
    const text = tries === 1 ? (last === 'up' ? `It worked! Now +${up}` : last === 'down' ? `It failed, and dropped to +${up}` : 'It failed. Nothing lost but the gold')
      : `${tally.up} of ${tries} worked${tally.down ? `, ${tally.down} dropped a level` : ''}. Now +${up}`;
    vil.upMsg = { id: it.id, text, kind: last === 'up' && tries === 1 || tally.up > tally.down + tally.fail ? 'good' : 'bad' };
    say(`${it.name.replace(/ \+\d+$/, '')}: ${text}`, last === 'up' ? RARITIES[it.rarity].color : '#f88'); hero.goldPulse = 0.6; sfx(tally.up ? 'anvil' : 'forgeFail'); if (tally.up) Sound.sfxAt('hammer', 1); saveGame(true, true); renderShop();
    return;
  }
  if (id === 'potion') {
    const price = potionCost();
    if (hero.gold < price || (vil.stock.potion | 0) <= 0 || (hero.potions | 0) >= POTION_MAX) { sfx('denied'); return; }
    hero.gold -= price; hero.potions = (hero.potions | 0) + 1; vil.stock.potion--; say('Bought a Healing Potion', '#7fd08a');
  } else if (id === 'scroll') {
    if (hero.gold < recallCost() || (hero.recalls | 0) >= RECALL_MAX) { sfx('denied'); return; }
    hero.gold -= recallCost(); hero.recalls = (hero.recalls | 0) + 1; say('Bought a Return Scroll', '#cfc0ff');
  } else if (id === 'lamp') {
    const L = LAMPS[(hero.lamp | 0) + 1];
    if (!L || hero.gold < L.cost) { sfx('denied'); return; }
    hero.gold -= L.cost; hero.lamp = (hero.lamp | 0) + 1; applyLamp(); say(`Bought the ${L.name}`, '#ffd88a');
  }
  hero.goldPulse = 0.6; sfx('coin'); saveGame(true, true); renderShop();
});

// ---------------------------------------------------------------- drawing
function drawVillage() {
  const v = vil; if (!v) return;
  if (v.inChurch) { drawChurchInside(v); return; }
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
    ctx.fillStyle = '#f5c451'; ctx.font = 'bold 14px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(keyLabel('interact'), t.x, ty + 5 + bob);
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
  drawQuestTracker();
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
    const t = v.near, label = t.kind === 'gate' ? 'E  Leave the village' : t.kind === 'dog' ? 'E  Pet Biscuit' : t.kind === 'board' ? 'E  Read the notice board' : t.kind === 'church' ? 'E  Enter the church' : t.kind === 'exit' ? 'E  Leave the church' : `E  Talk to ${t.label}${t.tag ? ' · ' + t.tag : ''}`;
    const lbl = fitText(label, VW - 120, 13, true, 10), w = ctx.measureText(lbl).width + 30;
    hudPanel(VW / 2 - w / 2, VH - 100, w, 30, { r: 10, edge: 'rgba(245,196,81,0.55)' });
    ctx.fillStyle = '#f5c451'; ctx.textAlign = 'center'; ctx.fillText(lbl, VW / 2, VH - 80);
  }
  ctx.textAlign = 'left';
}

// ---------------------------------------------------------------- the quest board (#17) and the Return Scroll
// The notice board in every village offers a handful of quests; up to three can be taken at once and they travel with you across waves and biomes.
// A finished quest waits for you at the next board (its reward is collected there). Rebirth clears the quests you were doing but keeps rewards you had not collected.
const QUEST_MAX = 3, QUEST_KINDS = ['kills', 'type', 'elite', 'mut', 'evo', 'leader', 'boss', 'noPotion', 'noHit', 'gold', 'gear', 'chest', 'dungeon'];
const QUEST_TYPES = ['goblin', 'minotaur', 'archer', 'ogre'], QUEST_PLURAL = { goblin: 'goblins', minotaur: 'minotaurs', archer: 'archers', ogre: 'ogres' };
const questId = () => 'q' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36);
const emptyQuests = () => ({ active: [], claim: [] });
function questDef(kind) {
  const w = Math.max(1, wave), lv = 1 + w * 0.05, R = (g, x, e = {}) => ({ gold: Math.round(g * lv), xp: Math.round(x * lv), ...e }), pick = a => a[Math.floor(Math.random() * a.length)];
  const nR = (a, b, s = 1) => a + Math.floor(Math.random() * ((b - a) / s + 1)) * s;
  switch (kind) {
    case 'kills': { const n = nR(20, 35, 5); return { goal: n, title: `Slay ${n} creatures`, text: `The roads must be quieter. Slay ${n} creatures of any kind.`, reward: R(n * 9, n * 5) }; }
    case 'type': { const t = pick(QUEST_TYPES.filter(x => TYPES[x].from <= w + 3)), n = nR(6, 12, 2); return { type: t, goal: n, title: `Hunt ${n} ${QUEST_PLURAL[t]}`, text: `${QUEST_PLURAL[t][0].toUpperCase() + QUEST_PLURAL[t].slice(1)} have been troubling the travellers. Hunt ${n} of them, wherever you find them.`, reward: R(n * 16, n * 9, n >= 10 ? { rune: 1 } : {}) }; }
    case 'elite': { const n = nR(1, 3); return { goal: n, title: n > 1 ? `Defeat ${n} elites` : 'Defeat an elite', text: `Named brutes lead the beasts. Defeat ${n > 1 ? n + ' of them' : 'one'}.`, reward: R(n * 140, n * 60, n >= 2 ? { ess: 1 } : {}) }; }
    case 'mut': { const n = nR(4, 8); return { goal: n, title: `Slay ${n} mutated creatures`, text: `Some beasts are twisted: armoured, swift, giant, poisonous. Slay ${n} of them.`, reward: R(n * 30, n * 14) }; }
    case 'evo': { const n = nR(2, 4); return { goal: n, title: `Slay ${n} evolved creatures`, text: `Left alone, creatures grow into named forms. Slay ${n} of them.`, reward: R(n * 110, n * 50, { rune: 1 }) }; }
    case 'leader': { const n = nR(1, 2); return { goal: n, title: n > 1 ? `Fell ${n} pack leaders` : 'Fell a pack leader', text: `Packs of wolves and skeletons follow a crowned leader. Fell ${n > 1 ? n + ' of them' : 'one'}.`, reward: R(n * 160, n * 60) }; }
    case 'boss': return { goal: 1, title: 'Fell the guardian of the road', text: 'The beast that waits on the road has terrorised us long enough. Defeat the next boss.', reward: R(900, 400, { gear: 1, potions: 2, ess: 1 }) };
    case 'noPotion': { const n = nR(3, 5); return { goal: n, title: `${n} waves without a potion`, text: `Clear ${n} waves in a row without drinking a potion. Drinking one starts you over.`, reward: R(n * 150, n * 60) }; }
    case 'noHit': { const n = nR(1, 2); return { goal: n, title: n > 1 ? `${n} waves untouched` : 'A wave untouched', text: `Clear ${n > 1 ? n + ' waves in a row' : 'a wave'} without being hurt even once.`, reward: R(n * 320, n * 120, { gear: 1 }) }; }
    case 'gold': { const n = Math.round((250 + w * 30) / 50) * 50; return { goal: n, title: `Collect ${n} gold`, text: `The village treasury is thin. Bring in ${n} gold from the road (what you pick up counts).`, reward: R(Math.round(n * 0.6), Math.round(n * 0.3)) }; }
    case 'chest': { const n = nR(2, 4); return { goal: n, title: `Open ${n} dungeon chests`, text: `Stone doors open in the ground now and then. Bring back what is in ${n} of their chests.`, reward: R(n * 160, n * 60, { gear: 1 }) }; }
    case 'dungeon': return { goal: 1, title: 'Clear a dungeon', text: 'Go down a stone door, defeat the guardian at the bottom and open its treasure.', reward: R(1100, 500, { gear: 1, rune: 1 }) };
    case 'gear': { const n = nR(3, 5); return { goal: n, title: `Pick up ${n} pieces of gear`, text: `Brann wants scrap to melt. Pick up ${n} pieces of gear.`, reward: R(n * 80, n * 30) }; }
  }
}
function makeQuestOffers(v) {                                                    // five different quests for this visit (never one you are already doing)
  const doing = new Set([...hero.quests.active, ...hero.quests.claim].map(q => q.kind)), pool = QUEST_KINDS.filter(k => !doing.has(k));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  v.questOffers = pool.slice(0, 5).map(k => ({ id: questId(), kind: k, n: 0, ...questDef(k) }));
}
function completeQuest(q) {
  const Q = hero.quests; Q.active = Q.active.filter(x => x !== q); q.n = q.goal; Q.claim.push(q);
  popups.push({ text: `Quest complete: ${q.title}`, x: VW / 2, y: 150, t: 3, screen: true, small: true, color: '#ffd86a' }); popups.push({ text: 'Collect the reward at a village quest board', x: VW / 2, y: 176, t: 3, screen: true, small: true, color: '#cdb68c' }); sfx('unlock');
}
function questEvent(ev, a) {
  if (!hero || !hero.quests) return;
  const Q = hero.quests.active; if (!Q.length) return;
  for (const q of Q.slice()) {
    const n0 = q.n;
    if (ev === 'kill') {
      const m = a;
      if (q.kind === 'kills') q.n++; else if (q.kind === 'type' && m.type === q.type) q.n++; else if (q.kind === 'elite' && m.elite) q.n++;
      else if (q.kind === 'mut' && m.mut && m.mut.length && !m.elite) q.n++; else if (q.kind === 'evo' && m.evo) q.n++; else if (q.kind === 'leader' && m.leader) q.n++; else if (q.kind === 'boss' && m.type === 'boss') q.n++;
    } else if (ev === 'gold' && q.kind === 'gold') q.n += a;
    else if (ev === 'gear' && q.kind === 'gear') q.n++;
    else if (ev === 'chest' && q.kind === 'chest') q.n++;
    else if (ev === 'dungeon' && q.kind === 'dungeon') q.n++;
    else if (ev === 'potion' && q.kind === 'noPotion') q.n = 0;
    else if (ev === 'hit' && q.kind === 'noHit') q.n = 0;
    else if (ev === 'waveClear' && (q.kind === 'noPotion' || q.kind === 'noHit')) q.n++;
    if (q.n >= q.goal) completeQuest(q);
    else if (q.n !== n0 && ev !== 'gold') popups.push({ text: `${q.title}: ${q.n} / ${q.goal}`, x: VW / 2, y: VH - 150, t: 1.2, screen: true, small: true, color: '#9fd8a0' });
  }
}
const rewardLines = r => [r.gold && `${r.gold.toLocaleString()} gold`, r.xp && `${r.xp.toLocaleString()} XP`, r.potions && `${r.potions} Healing Potion${r.potions > 1 ? 's' : ''}`, r.gear && 'A piece of gear', r.rune && 'A rune', r.ess && 'An essence'].filter(Boolean);
function claimQuest(q) {                                                         // hand over the reward (the board is in the village, so it can be collected only there)
  const Q = hero.quests, r = q.reward || {}; if (!Q.claim.includes(q)) return null;
  Q.claim = Q.claim.filter(x => x !== q);
  hero.gold += r.gold | 0; hero.goldPulse = 0.6; if (r.xp) gainXp(r.xp, hero);
  if (r.potions) hero.potions = Math.min(POTION_MAX, (hero.potions | 0) + r.potions);
  const got = [];
  if (r.gear) { const it = rollItem({ tier: depthOf() + 0.8, level: hero.level + 1 }); if (addToBag(it)) got.push(it.name); else { hero.gold += 150; got.push('150 gold (your pack was full)'); } }
  if (r.rune) { const k = rollRuneKey(1, 2); addRune(k); got.push(RUNES[k].title); }
  if (r.ess) { const k = rollEssKey(1.5); addEss(k); got.push(ESS[k].title); }
  sfx('gift'); saveGame(true, true);
  popups.push({ text: `Reward: ${[...rewardLines({ gold: r.gold, xp: r.xp, potions: r.potions }), ...got].join(', ')}`, x: VW / 2, y: 120, t: 3.2, screen: true, small: true, color: '#ffd86a' });
  return got;
}
function cleanQuests(q) {                                                         // a hand-edited save cannot break the board
  const out = emptyQuests(), cl = (v, a, b) => Math.max(a, Math.min(b, Math.floor(Number(v)) || 0));
  for (const list of ['active', 'claim']) for (const r of (q && Array.isArray(q[list]) ? q[list] : []).slice(0, 8)) {
    if (!r || !QUEST_KINDS.includes(r.kind)) continue;
    const rw = r.reward || {};
    out[list].push({ id: String(r.id || questId()).slice(0, 20), kind: r.kind, type: QUEST_TYPES.includes(r.type) ? r.type : undefined, goal: cl(r.goal, 1, 99999) || 1, n: cl(r.n, 0, 99999), title: String(r.title || r.kind).slice(0, 60), text: String(r.text || '').slice(0, 200),
      reward: { gold: cl(rw.gold, 0, 1e7), xp: cl(rw.xp, 0, 1e7), potions: cl(rw.potions, 0, 5), gear: rw.gear ? 1 : 0, rune: rw.rune ? 1 : 0, ess: rw.ess ? 1 : 0 } });
  }
  out.active = out.active.slice(0, QUEST_MAX); return out;
}
const QUEST_COLOR = { claim: '#ffd24a', active: '#7fd08a', offer: '#cdb68c' };
const questSvg = (kind, c, px = 40) => {
  const hunt = ['kills', 'type', 'elite', 'mut', 'evo', 'leader'].includes(kind), body = hunt ? `<path d="M7 25 L22 10 M7 10 L22 25 M22 10 l3 -3 M7 25 l-2 2" stroke="${c}" stroke-width="2.6" stroke-linecap="round" fill="none"/>`
    : kind === 'boss' ? `<path d="M6 24 V12 L11 17 L16 7 L21 17 L26 12 V24 Z" fill="${c}" fill-opacity=".3" stroke="${c}" stroke-width="2" stroke-linejoin="round"/><circle cx="12.5" cy="19" r="1.4" fill="${c}"/><circle cx="19.5" cy="19" r="1.4" fill="${c}"/>`
    : kind === 'noPotion' || kind === 'noHit' ? `<path d="M16 5 L26 9 V17 Q26 24 16 28 Q6 24 6 17 V9 Z" fill="${c}" fill-opacity=".25" stroke="${c}" stroke-width="2" stroke-linejoin="round"/><path d="M11 16 L15 20 L22 12" stroke="${c}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
    : kind === 'gold' ? `<circle cx="16" cy="16" r="10" fill="${c}" fill-opacity=".3" stroke="${c}" stroke-width="2"/><path d="M16 9 V23 M12 13 Q16 10 20 13 Q12 17 12 19 Q16 22 20 19" stroke="${c}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`
    : `<path d="M8 11 H24 V25 H8 Z M12 11 V8 H20 V11" fill="${c}" fill-opacity=".25" stroke="${c}" stroke-width="2" stroke-linejoin="round"/><path d="M12 18 H20" stroke="${c}" stroke-width="2"/>`;
  return `<svg viewBox="0 0 32 32" width="${px}" height="${px}">${body}</svg>`;
};
function renderQuestBoard() {
  const v = vil, Q = hero.quests;
  document.getElementById('shopTitle').textContent = 'THE QUEST BOARD'; document.getElementById('shopGold').textContent = hero.gold.toLocaleString();
  const items = [...Q.claim.map(q => ({ q, st: 'claim' })), ...Q.active.map(q => ({ q, st: 'active' })), ...(v.questOffers || []).map(q => ({ q, st: 'offer' }))];
  const sel = (v.tSel || (v.tSel = {}));
  if (!items.length) { document.getElementById('shopBody').innerHTML = tileShop([], '<div class="tdesc">The board is empty. New notices go up when you reach the next village.</div>', 4); return; }
  const cur = items.find(i => i.q.id === sel.quests) || items[0]; sel.quests = cur.q.id;
  const tiles = items.map(({ q, st }) => ({ id: q.id, svg: questSvg(q.kind, QUEST_COLOR[st], 40), name: q.title, color: QUEST_COLOR[st], sub: st === 'claim' ? 'Reward ready' : st === 'active' ? `${q.n.toLocaleString()} / ${q.goal.toLocaleString()}` : `${q.reward.gold.toLocaleString()} g`, on: q.id === cur.q.id, badge: st === 'claim' ? 'Reward!' : st === 'active' ? 'Active' : 'New', title: q.title }));
  const q = cur.q, st = cur.st, c = QUEST_COLOR[st], pct = Math.min(100, Math.round(q.n / q.goal * 100)), slots = Q.active.length;
  const detail = tHead(questSvg(q.kind, c, 54), q.title, c, st === 'claim' ? 'Finished: collect your reward' : st === 'active' ? 'In progress' : 'A new notice') +
    `<div class="tdesc">${escapeHtml(q.text)}</div>` +
    (st !== 'offer' ? `<div class="uodds"><div class="obar"><div class="ofill" style="width:${pct}%"></div></div><div class="otxt"><b>${q.n.toLocaleString()} / ${q.goal.toLocaleString()}</b></div></div>` : '') +
    `<div class="slabel">Reward</div>${rewardLines(q.reward).map(t => `<div class="srow"><span>${escapeHtml(t)}</span></div>`).join('')}` +
    `<div class="ubuy">${st === 'claim' ? `<button class="go sell" data-qa="claim:${q.id}">Collect the reward</button>`
      : st === 'active' ? `<button class="go" disabled>In progress</button><button data-qa="abandon:${q.id}" title="Give this quest up">Abandon</button>`
      : `<button class="go" data-qa="accept:${q.id}" ${slots >= QUEST_MAX ? 'disabled' : ''}>${slots >= QUEST_MAX ? `You are on ${QUEST_MAX} quests already` : 'Accept the quest'}</button>`}</div>` +
    `<div class="hint" style="margin-top:6px">Quests taken: ${slots} of ${QUEST_MAX}. Rebirth ends the ones in progress.</div>`;
  document.getElementById('shopBody').innerHTML = tileShop(tiles, detail, 4);
}
// what you are doing, in the corner of the screen (under your card): a line and a thin bar for each quest
function drawQuestTracker() {
  const Q = hero && hero.quests; if (!Q || (!Q.active.length && !Q.claim.length)) return;
  const lamp = LAMPS[hero.lamp | 0], y0 = 10 + 58 + (lamp ? 18 : 0) + (hero.points > 0 ? 20 : 0) + 8, rows = Q.claim.length + Q.active.length, h = 14 + rows * 24;
  hudPanel(10, y0, 236, h, { r: 11 }); ctx.textAlign = 'left'; ctx.font = `bold 10px ${UI_FONT}`; let y = y0 + 20;
  const line1 = (t, c) => { ctx.fillStyle = c; ctx.fillText(fitText(t, 212, 10, true, 8), 22, y); };
  for (const q of Q.claim) { line1(`✔ ${q.title}`, '#ffd24a'); ctx.fillStyle = '#cdb68c'; ctx.font = `9px ${UI_FONT}`; ctx.fillText('reward waiting at a village board', 22, y + 11); ctx.font = `bold 10px ${UI_FONT}`; y += 24; }
  for (const q of Q.active) { line1(q.title, '#e8f4ea'); const f = Math.min(1, q.n / q.goal); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(22, y + 5, 150, 4); ctx.fillStyle = '#7fd08a'; ctx.fillRect(22, y + 5, 150 * f, 4); ctx.fillStyle = '#cdb68c'; ctx.font = `9px ${UI_FONT}`; ctx.textAlign = 'right'; ctx.fillText(`${Math.min(q.n, q.goal).toLocaleString()} / ${q.goal.toLocaleString()}`, 234, y + 10); ctx.textAlign = 'left'; ctx.font = `bold 10px ${UI_FONT}`; y += 24; }
}

// ---- the Return Scroll: bought from Tobin, dear; read it (B) anywhere on the road and after a few seconds you are in the village, whatever the wave
const RECALL_MAX = 3, RECALL_TIME = 3.2, recallCost = () => Math.round(900 + wave * 45);
function useRecall() {
  if (!hero || hero.dead || paused || state !== 'play' || vil) return;
  if (dun) { popups.push({ text: 'The stone walls blunt the scroll: leave the dungeon first', x: hero.x, y: hero.y - 95, t: 1.6, color: '#f88' }); sfx('denied'); return; }
  if (hero.recallT > 0) { hero.recallT = 0; popups.push({ text: 'You put the scroll away', x: hero.x, y: hero.y - 95, t: 1, color: '#cfc0ff' }); sfx('tick'); return; }
  if ((hero.recalls | 0) <= 0) { popups.push({ text: 'You have no Return Scroll (Tobin sells them)', x: hero.x, y: hero.y - 95, t: 1.4, color: '#f88' }); sfx('denied'); return; }
  if (boss) { popups.push({ text: "The guardian is too near for the scroll to work", x: hero.x, y: hero.y - 95, t: 1.6, color: '#f88' }); sfx('denied'); return; }
  hero.recallT = RECALL_TIME; popups.push({ text: 'The scroll begins to glow... stay unhurt', x: hero.x, y: hero.y - 95, t: 1.6, color: '#cfc0ff' }); sfx('bell');
}
function cancelRecall(why) { if (hero.recallT > 0) { hero.recallT = 0; popups.push({ text: why, x: hero.x, y: hero.y - 95, t: 1.4, color: '#f88' }); sfx('runeFail'); } }
function tickRecall(dt) {
  if (!(hero.recallT > 0)) return;
  if (boss || vil || state !== 'play') { hero.recallT = 0; return; }
  hero.recallT -= dt;
  if (gfx.particles && Math.random() < dt * 40) { const a = Math.random() * Math.PI * 2, r = 30 * (hero.recallT / RECALL_TIME) + 8; particles.push({ x: hero.x + Math.cos(a) * r, y: hero.y - 30 + Math.sin(a) * r * 0.6, vx: 0, vy: -30, life: 0.5, max: 0.5, size: 2.4, color: '#cfc0ff', add: true }); }
  if (hero.recallT <= 0) { hero.recallT = 0; hero.recalls = Math.max(0, (hero.recalls | 0) - 1); enterVillage(); if (vil) { vil.recalled = true; popups.push({ text: 'The scroll carried you home', x: VW / 2, y: 150, t: 2.4, screen: true, small: true, color: '#cfc0ff' }); sfx('rebirth'); } }
}
function drawRecallChip(x, cy) {                                                   // beside the potion: how many scrolls, the key, and a ring while one is being read
  const w = 40, h = 40, y = cy - h / 2, n = hero.recalls | 0, ch = hero.recallT > 0;
  hudPanel(x, y, w, h, { r: 12, edge: ch ? '#cfc0ff' : 'rgba(207,192,255,0.35)' });
  ctx.save(); ctx.translate(x + w / 2, cy - 1); ctx.globalAlpha *= n ? 1 : 0.35;
  ctx.fillStyle = '#efe6c8'; ctx.strokeStyle = '#6a5a3a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.roundRect(-8, -11, 16, 20, 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#b8a070'; ctx.fillRect(-9, -13, 18, 3); ctx.fillRect(-9, 8, 18, 3);
  ctx.strokeStyle = '#8a50d0'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-4, -3); ctx.lineTo(0, -7); ctx.lineTo(4, -3); ctx.moveTo(0, -7); ctx.lineTo(0, 4); ctx.stroke(); ctx.restore();
  if (ch) { ctx.strokeStyle = '#cfc0ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x + w / 2, cy, 19, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - hero.recallT / RECALL_TIME)); ctx.stroke(); }
  ctx.textAlign = 'right'; const t = String(n); ctx.font = `bold 11px ${UI_FONT}`; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(t, x + w - 5, y + h - 5); ctx.fillStyle = n ? '#fff' : '#f88'; ctx.fillText(t, x + w - 5, y + h - 5);
  ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = `bold 8px ${UI_FONT}`; ctx.fillText(keyLabel('potion'), x + 5, y + 10);
}
