// The Church of Return, inside: a nave with the altar and the priestess, a narthex and long halls, a cloister garden to the west, a scriptorium to the east,
// and a second floor (a choir loft over the nave with the bell, guest rooms and a dormitory). Nuns and guests go about their day. It is its own little map inside
// the village state (v.inChurch): the village solids are swapped for the church's while you are in, and the camera follows you along it.
// Every floor is a list of walkable rectangles; the walls are everything else (turned into solid boxes, and baked once into a picture).

const CHURCH = { w: 640, h: 420, ox: 400, oy: 130 };                                       // the nave (the old church was just this)
const CHB = { x0: -20, y0: 20, x1: 1560, y1: 1180, C: 2 };                                    // the whole map; the walls are measured in 2-unit cells
const CH_WALLH = 118;                                                                   // how tall the lit face of an interior wall stands (it was 76: the rooms felt low)
const CH_STAIRS = { x: 1337, y: 640 }, CH_EXIT = { x: 720, y: 1100 }, CH_BELL = { x: 720, y: 378 };
const CH_ARCH = [[200, 556, 270, 604], [320, 556, 390, 604], [1090, 556, 1160, 604], [1210, 556, 1280, 604]];          // doorways through the wall between the halls and the garden / the scriptorium
const CH_WALK = [
  [[414, 234, 1026, 552], [664, 548, 776, 604], [60, 600, 1380, 1120], [10, 250, 400, 560], [1040, 330, 1450, 560], [396, 450, 420, 520], [1020, 450, 1044, 520], ...CH_ARCH],
  [[414, 234, 1026, 520], [690, 516, 750, 604], [60, 600, 1380, 1120], [10, 330, 400, 560], [1040, 330, 1450, 560], [396, 450, 420, 520], [1020, 450, 1044, 520], ...CH_ARCH],
];
const CH_NAME = ['Church of Return', 'Church of Return · upper floor'];
const inWalkRects = (walk, x, y) => walk.some(r => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]);

function chWalls(walk) {                                                                    // everything that is not walkable, as a few big boxes
  const { x0, y0, x1, y1, C } = CHB, W = Math.ceil((x1 - x0) / C), H = Math.ceil((y1 - y0) / C), bl = new Uint8Array(W * H).fill(1);
  for (const [a, b, c, d] of walk) for (let y = Math.floor((b - y0) / C); y < Math.ceil((d - y0) / C); y++) for (let x = Math.floor((a - x0) / C); x < Math.ceil((c - x0) / C); x++) bl[y * W + x] = 0;
  const out = []; let open = new Map();
  for (let y = 0; y <= H; y++) {
    const runs = new Map();
    if (y < H) for (let x = 0; x < W;) { if (!bl[y * W + x]) { x++; continue; } let e = x; while (e < W && bl[y * W + e]) e++; runs.set(x + '|' + e, [x, e]); x = e; }
    const next = new Map();
    for (const [k, r] of runs) { const o = open.get(k); if (o) { o.y1 = y0 + (y + 1) * C; next.set(k, o); } else next.set(k, { x0: x0 + r[0] * C, x1: x0 + r[1] * C, y0: y0 + y * C, y1: y0 + (y + 1) * C }); }
    for (const [k, o] of open) if (!runs.has(k)) out.push(o);
    open = next;
  }
  for (const o of open.values()) out.push(o);
  for (const o of out) if (Math.abs(o.y1 - 234) < 2 && o.x1 - o.x0 > 300) o.face = 108;                       // the nave's back wall is tall
  return out;
}

function churchSolids(v) {                                                                  // build both floors; returns the ground floor's solids
  const c = CHURCH, floors = [0, 1].map(i => { const walls = chWalls(CH_WALK[i]); return { walk: CH_WALK[i], walls, solids: walls.slice(), props: [] }; });
  v.cfl = v.cflC = floors; v.cFloor = 0; v.cgrids = [null, null]; v.cKind = 'church';
  const rect = (f, k, x0, y0, x1, y1, o = {}) => { const p = { k, x0, y0, x1, y1, y: y1, ...o }; f.props.push(p); if (!o.free) f.solids.push({ x0, y0: y0 - 2, x1, y1 }); return p; };
  const circle = (f, k, x, y, r, o = {}) => { const p = { k, x, y, r, ...o }; f.props.push(p); if (!o.free) f.solids.push({ x, y: y - 2, r }); return p; };
  const [g, u] = floors;
  // the nave
  g.solids.push({ x0: c.ox + 274, y0: c.oy + 104, x1: c.ox + 366, y1: c.oy + 128 });
  v.cpots = [[34, 128], [606, 128], [226, 178], [414, 178]].map(([x, y], k) => ({ x: c.ox + x, y: c.oy + y, k, wet: 0 })); for (const p of v.cpots) g.solids.push({ x: p.x, y: p.y - 4, r: 9 });
  c.pews = []; for (const y1 of [176, 222, 268, 314, 360]) for (const [x0, x1] of [[50, 190], [450, 590]]) { const p = { x0: c.ox + x0, y0: c.oy + y1 - 16, x1: c.ox + x1, y1: c.oy + y1 }; c.pews.push(p); g.solids.push({ x0: p.x0, y0: p.y0 - 4, x1: p.x1, y1: p.y1 }); }
  // the narthex and the halls
  circle(g, 'font', 620, 826, 12); circle(g, 'candles', 820, 826, 8); circle(g, 'candles', 1010, 828, 8);
  for (const x of [100, 1340]) { circle(g, 'statue', x, x > 700 ? 716 : 664, 10); circle(g, 'statue', x, 840, 10); circle(g, 'statue', x, 1040, 10); circle(g, 'plant', x + (x < 700 ? 40 : -40), 1090, 8); }
  for (const x of [140, 1300]) { rect(g, 'bench', x, 782, x + 70, 796); rect(g, 'bench', x, 902, x + 70, 916); }
  for (const x of [250, 1190]) { rect(g, 'bench', x, 1000, x + 70, 1014); rect(g, 'bench', x + 100, 1000, x + 170, 1014); }
  for (const x of [560, 880]) { circle(g, 'candles', x, 1030, 8); rect(g, 'bench', x - 130, 1000, x - 60, 1014); rect(g, 'bench', x + 60, 1000, x + 130, 1014); }
  circle(g, 'chandelier', 300, 1700, 0, { free: true, fy: 800 }); circle(g, 'chandelier', 1140, 1700, 0, { free: true, fy: 800 }); circle(g, 'chandelier', 720, 1920, 0, { free: true, fy: 1020 }); circle(g, 'chandelier', 1300, 1850, 0, { free: true, fy: 950 }); circle(g, 'chandelier', 140, 1850, 0, { free: true, fy: 950 });
  circle(g, 'exitsign', CH_EXIT.x, CH_EXIT.y - 34, 0, { free: true }); rect(g, 'stairs', 1310, 606, 1364, 652, { free: true });
  for (const x of [330, 430, 940, 1040]) rect(g, 'bench', x, 902, x + 70, 916);
  for (const [x, y] of [[200, 942], [1240, 942], [420, 950], [1020, 950]]) circle(g, 'plant', x, y, 8);
  circle(g, 'candles', 600, 930, 8); circle(g, 'candles', 840, 930, 8); circle(g, 'lamp', 260, 900, 5); circle(g, 'lamp', 1180, 900, 5);
  for (const [x, fy] of [[400, 700], [1040, 700], [720, 840], [560, 900], [880, 900]]) circle(g, 'chandelier', x, fy + 900, 0, { free: true, fy });
  for (const [x, fy] of [[720, 470], [560, 360], [880, 360], [720, 280]]) circle(g, 'chandelier', x, fy + 900, 0, { free: true, fy });
  circle(g, 'chandelier', 1200, 1340, 0, { free: true, fy: 440 }); circle(g, 'chandelier', 250, 1250, 0, { free: true, fy: 350 }); circle(g, 'candles', 440, 828, 8);
  for (const [x, y] of [[200, 862], [1240, 862], [196, 624], [1244, 624]]) { circle(g, 'plant', x, y, 8); circle(u, 'plant', x, y, 8); }
  circle(u, 'candles', 1010, 828, 8); rect(u, 'stairs', 1310, 606, 1364, 652, { free: true }); for (const x of [330, 430, 940, 1040]) rect(u, 'bench', x, 902, x + 70, 916); for (const [x, fy] of [[400, 700], [1040, 700], [720, 840], [560, 460], [880, 460]]) circle(u, 'chandelier', x, fy + 900, 0, { free: true, fy }); circle(u, 'candles', 440, 828, 8);
  for (const x of [300, 470, 980, 1120]) circle(g, 'statue', x, 664, 10); for (const x of [250, 1190]) circle(g, 'statue', x, 840, 10);
  rect(g, 'bench', 330, 782, 400, 796); rect(g, 'bench', 1040, 782, 1110, 796); rect(g, 'bench', 430, 782, 500, 796); rect(g, 'bench', 940, 782, 1010, 796);
  // the cloister garden
  circle(g, 'fountain', 265, 440, 24);
  circle(g, 'tree', 50, 330, 8); circle(g, 'tree', 50, 470, 8); circle(g, 'tree', 50, 548, 8); rect(g, 'bed', 36, 380, 90, 396); rect(g, 'bed', 36, 500, 90, 516); rect(g, 'bench', 156, 372, 218, 388); rect(g, 'bench', 312, 372, 374, 388); rect(g, 'bed', 150, 486, 230, 506); rect(g, 'bed', 300, 486, 380, 506);
  circle(g, 'tree', 152, 352, 8); circle(g, 'tree', 380, 352, 8); circle(g, 'tree', 152, 276, 8); circle(g, 'tree', 380, 276, 8); rect(g, 'bed', 170, 290, 240, 310); rect(g, 'bed', 290, 290, 360, 310); circle(g, 'tree', 152, 544, 8); circle(g, 'tree', 380, 544, 8);
  // the scriptorium
  rect(g, 'table', 1090, 404, 1180, 432); rect(g, 'table', 1180, 480, 1266, 508); circle(g, 'lectern', 1072, 380, 8); circle(g, 'lectern', 1290, 380, 8);
  circle(g, 'tree', 110, 330, 8); circle(g, 'tree', 110, 470, 8); circle(g, 'tree', 112, 548, 8); rect(g, 'bed', 96, 380, 140, 396); rect(g, 'bed', 96, 500, 140, 516);
  rect(g, 'table', 1318, 430, 1364, 458); circle(g, 'chair', 1330, 428, 6, { free: true, d: 1 }); circle(g, 'chair', 1352, 428, 6, { free: true, d: 1 }); circle(g, 'chair', 1341, 474, 6, { free: true, d: -1 }); circle(g, 'plant', 1352, 360, 8); circle(g, 'plant', 1430, 360, 8); circle(g, 'plant', 1430, 548, 8); rect(g, 'table', 1396, 420, 1440, 448); circle(g, 'chair', 1408, 418, 6, { free: true, d: 1 }); circle(g, 'chair', 1430, 418, 6, { free: true, d: 1 }); circle(g, 'lamp', 1400, 372, 5); circle(g, 'globe', 1416, 500, 9); circle(g, 'plant', 1352, 548, 8); circle(g, 'globe', 1336, 510, 9); circle(g, 'lamp', 1320, 372, 5);
  circle(g, 'candles', 636, 278, 8); circle(g, 'candles', 804, 278, 8); circle(g, 'plant', 432, 538, 8); circle(g, 'plant', 1008, 538, 8); circle(g, 'lamp', 428, 262, 5); circle(g, 'lamp', 1012, 262, 5); circle(g, 'lamp', 428, 540, 5); circle(g, 'lamp', 1012, 540, 5);
  for (const [x, y, d] of [[1112, 402, 1], [1158, 402, 1], [1135, 448, -1], [1202, 478, 1], [1244, 478, 1], [1223, 524, -1]]) circle(g, 'chair', x, y, 6, { free: true, d });
  rect(g, 'mugs', 1100, 414, 1160, 433, { free: true, v: 1 }); rect(g, 'mugs', 1190, 490, 1250, 509, { free: true, v: 0 }); circle(g, 'globe', 1288, 540, 9); circle(g, 'lamp', 1056, 540, 5);
  // upstairs: the loft, the gallery, the guest rooms and the dormitory
  rect(u, 'bench', 440, 330, 560, 346); rect(u, 'bench', 880, 330, 1000, 346);
  rect(u, 'shelf', 580, 238, 640, 254, { v: 'books', h: 86 }); rect(u, 'shelf', 800, 238, 860, 254, { v: 'scrolls', h: 86 }); rect(u, 'shelf', 450, 238, 506, 254, { v: 'books', h: 86 }); rect(u, 'shelf', 934, 238, 990, 254, { v: 'books', h: 86 }); circle(u, 'plant', 430, 506, 8); circle(u, 'plant', 1010, 506, 8); circle(u, 'lamp', 428, 410, 5); circle(u, 'lamp', 1012, 410, 5);
  for (const [x, y] of [[440, 456], [980, 456]]) circle(u, 'chair', x, y, 6, { free: true, d: 1 });
  circle(u, 'plant', 100, 540, 8); circle(u, 'lamp', 100, 360, 5); rect(u, 'chest', 96, 450, 126, 466); circle(u, 'plant', 1352, 548, 8); circle(u, 'lamp', 1350, 360, 5); rect(u, 'chest', 1316, 460, 1360, 476);
  for (const x of [300, 560, 900, 1120]) circle(u, 'statue', x, 664, 10); for (const x of [250, 720, 1190]) circle(u, 'statue', x, 840, 10);
  for (const [bx, by] of [[150, 350], [150, 430], [330, 350], [330, 430]]) rect(u, 'bed', bx, by, bx + 56, by + 40);
  rect(u, 'table', 232, 500, 296, 524);
  for (const [bx, by] of [[1060, 350], [1060, 430], [1250, 350], [1250, 430], [1060, 506], [1250, 506]]) rect(u, 'bed', bx, by, bx + (bx > 1200 ? 50 : 56), by + (by > 500 ? 36 : 40));
  rect(u, 'chest', 1150, 360, 1190, 376);
  circle(u, 'bell', CH_BELL.x, CH_BELL.y, 8, { free: true });
  v.cgrids = [null, null];
  return g.solids;
}

// ---------------------------------------------------------------- the people
const chRnd = (a, b) => a + Math.random() * (b - a), chPick = a => a[Math.floor(Math.random() * a.length)];
const chStay = (x, y, face = 1, t = [6, 12]) => [{ go: [x, y], speed: 30 }, { t, face }];
const chDo = (x, y, what, face, t = [6, 12], o = {}) => [{ go: [x, y], speed: 30 }, { do: what, t, face, ...o }];
const chSplash = (n2, v2, dt) => { if (Math.random() < dt * 20) vfx(v2, { x: n2.x + n2.f * 22, y: n2.y - 32, vx: n2.f * (26 + Math.random() * 20), vy: 8, grav: 340, life: 0.5, size: 1.5, color: '#a6d8ff' }); };
function churchFolk(mk) {                                                                  // the nuns and the guests (all hidden from the village outside: they live in here)
  const NUN = { dress: '#2b2b38', hat: 'veil', hatColor: '#f4f1ea', cheek: true }, base = { inside: true, church: true, special: 'church', speed: 32 };
  const last = n => n.lastKind;
  const alt = (n, kinds) => { const k = chPick(kinds.filter(x => x !== last(n))); n.lastKind = k; return k; };
  mk('maren', 'Sister Linnet', 'Gardener nun', 265, 480, { ...base, floor: 0, look: { ...NUN, hair: '#8a6a4a' }, f: 1,
    lines: ['The cloister garden is the only place the road cannot reach. I like to keep it that way.', 'Flowers do not ask who you were. Only whether you remembered the water.', 'Take a seat by the fountain, {name}. It listens better than most people.'],
    chat: ['Water, water...', 'Hm hm hm...', 'Grow, little ones.'],
    script: (v, n) => { switch (alt(n, ['water', 'water', 'bench', 'fountain', 'weed'])) {
      case 'water': return [...chDo(190, 512, 'water', 1, [4, 6], { tick: chSplash }), ...chDo(340, 512, 'water', -1, [4, 6], { tick: chSplash })];
      case 'bench': return chDo(188, 396, 'sit', 1, [10, 18]);
      case 'fountain': return chDo(265, 480, 'pray', 1, [6, 10]);
      default: return [...chDo(225, 466, 'wipe', 1, [4, 7]), ...chStay(300, 420, -1, [3, 5])]; } } });
  mk('ada', 'Sister Ada', 'Librarian nun', 1130, 450, { ...base, floor: 0, look: { ...NUN, hair: '#3a2a22', glasses: true }, f: -1,
    lines: ['Every book here was copied by hand. The ones with the smudges were copied by me.', 'There is a shelf of travellers\' tales. Half of them are true. I will not say which half.', 'Quiet, please. The words are sleeping.'],
    chat: ['Shh...', 'Where did I put that scroll?', 'Page forty... forty-one...'],
    script: (v, n) => { switch (alt(n, ['read', 'read', 'shelf', 'candles'])) {
      case 'read': return chDo(1135, 446, 'read', -1, [12, 22]);
      case 'shelf': return [...chStay(1200, 372, 1, [4, 8]), ...chStay(1100, 372, 1, [3, 6])];
      default: return [...chDo(770, 640, 'wipe', 1, [3, 5]), ...chStay(700, 640, 1, [2, 4])]; } } });
  mk('bree', 'Sister Bree', 'Dormitory nun', 1150, 470, { ...base, floor: 1, look: { ...NUN, hair: '#c26a3a' }, f: 1,
    lines: ['Up here the bell is so loud you stop hearing it. Then it stops, and you hear everything.', 'Fourteen beds, one broom, and no one who admits to the crumbs.', 'Guests may rest a night. Heroes may rest a little longer. Do not tell the others.'],
    chat: ['Sweep, sweep...', 'Fluff the pillow...', 'Mind the floor.'],
    script: (v, n) => { switch (alt(n, ['sweep', 'pray', 'gallery'])) {
      case 'sweep': return [...chDo(1130, 480, 'wipe', 1, [4, 6]), ...chDo(1240, 400, 'wipe', -1, [4, 6])];
      case 'pray': return chDo(1132, 410, 'pray', 1, [10, 16]);
      default: return [...chStay(900, 640, 1, [3, 6]), ...chStay(500, 640, -1, [3, 6])]; } } });
  mk('saintess', 'The Saintess', 'Saintess', 760, 430, { ...base, floor: 1, scale: 1.04, look: { dress: '#fbf8ee', stole: '#e8c24a', hat: 'veil', hatColor: '#ffffff', hair: '#efe2ff', cheek: true, halo: true }, f: 1, speed: 26,
    lines: ['Eira keeps the light below. I keep what the light is for.', 'You walk as though you were carrying something very old, child. Set it down a while.', 'Not everything here is for you yet. Come back when the road has taught you more.', 'Eira answers to me, and I answer to something older than the church. Do not let it trouble you.', 'There is a kind of silence only a hero learns. I hear it on you.'],
    chat: ['...', 'Mm.', 'The light listens.'],
    script: (v, n) => { switch (alt(n, ['pray', 'pray', 'window'])) {
      case 'pray': return chDo(760, 430, 'pray', 1, [14, 24]);
      default: return [...chStay(640, 420, -1, [5, 9]), ...chStay(860, 430, 1, [4, 8])]; } } });
  mk('tomas', 'Old Bartel', 'Pilgrim', 500, 640, { ...base, floor: 0, look: { body: '#6a5a46', hat: 'straw', hatColor: '#c9a86a', beard: '#cfcfcf' }, f: 1,
    lines: ['Walked here from the coast. Forty days. My knees have opinions about it.', 'My wife said the light above the altar would remember me. I think she meant it kindly.', 'Sit, sit. The pews are hard but the silence is soft.'],
    chat: ['Mm, mm...', 'Long road...', 'Bless this road.'],
    script: (v, n) => { switch (alt(n, ['pew', 'pew', 'bench', 'font'])) {
      case 'pew': { const p = chPick(CHURCH.pews); return chDo(chRnd(p.x0 + 24, p.x1 - 24), p.y1 + 8, 'sitpray', 1, [18, 30]); }
      case 'bench': return chDo(342, 400, 'sit', -1, [10, 18]);
      default: return chStay(640, 622, 1, [6, 10]); } } });
  mk('wren', 'Wren', 'Young traveller', 700, 640, { ...base, floor: 0, look: { body: '#4a7a9a', hat: 'beanie', hatColor: '#c0392b', hair: '#7a4a2a', cheek: true }, f: 1,
    lines: ['I am here to see the coloured windows. Everyone says they are the best between here and the sea.', 'Is it true the priestess can send you back to the start? Why would anyone want that?', 'I once saw a hero here with a sword taller than me. He sneezed. The candles all went out.'],
    chat: ['Ooh, look at that one!', 'Which one is the red one?', 'Shhh, shhh...'],
    script: (v, n) => { switch (alt(n, ['hall', 'hall', 'garden', 'nave'])) {
      case 'hall': return [...chStay(chRnd(260, 560), 636, 1, [4, 8]), ...chStay(chRnd(840, 1140), 636, -1, [4, 8])];
      case 'garden': return [...chStay(chRnd(200, 340), 398, 1, [4, 8]), ...chStay(265, 396, 1, [3, 6])];
      default: return [...chStay(chRnd(620, 820), 520, 1, [3, 6]), ...chStay(chRnd(620, 820), 470, -1, [3, 6])]; } } });
  mk('cass', 'Cass', 'Scholar', 1220, 450, { ...base, floor: 0, look: { body: '#7a4a6a', hat: 'cap', hatColor: '#3a2a4a', hair: '#2a2a3a', glasses: true }, f: -1,
    lines: ['I am cataloguing the sermons. There are three hundred and one. One is just a recipe.', 'The priestess has seen more prestiges than I have read books. I find that unreasonable.', 'If you find a rune with writing on it, bring me a rubbing. Please. I beg.'],
    chat: ['Hm... fascinating.', 'Footnote... footnote...', 'Where is my ink?'],
    script: (v, n) => { switch (alt(n, ['read', 'read', 'shelf'])) {
      case 'read': return chDo(1226, 524, 'read', -1, [14, 24]);
      default: return [...chStay(1240, 372, -1, [3, 6]), ...chStay(1170, 450, 1, [3, 6])]; } } });
  mk('fenn', 'Fenn', 'Travelling merchant', 780, 636, { ...base, floor: 0, look: { body: '#5a7a4a', hat: 'cap', hatColor: '#7a5a3a', hair: '#6a4a2a', beard: '#6a4a2a' }, f: -1,
    lines: ['I sell nothing in a church. Out of respect. Out in the village, however...', 'The bell upstairs is worth more than my whole cart. I have measured it. Twice. With my eyes.', 'Praying is free. Lighting a candle is a coin. That is the best margin I have seen.'],
    chat: ['Hm, nice stonework.', 'Cold in here.', 'A coin for a candle...'],
    script: (v, n) => { switch (alt(n, ['narthex', 'hall', 'pew'])) {
      case 'narthex': return [...chStay(780, 636, -1, [5, 9]), ...chStay(660, 630, 1, [4, 8])];
      case 'hall': return [...chStay(chRnd(250, 560), 640, 1, [3, 6]), ...chStay(chRnd(850, 1150), 640, -1, [3, 6])];
      default: { const p = chPick(CHURCH.pews); return chDo(chRnd(p.x0 + 24, p.x1 - 24), p.y1 + 8, 'sitpray', 1, [8, 14]); } } } });
  mk('marl', 'Marl', 'Guest', 240, 478, { ...base, floor: 1, look: { body: '#8a6a3a', hat: 'beanie', hatColor: '#4a6a8a', hair: '#9a6a3a', cheek: true }, f: 1,
    lines: ['They gave me a bed, a blanket and a bowl of soup. I may never leave.', 'You can see the whole nave from the loft. Tiny priestess, tiny pews. Like a toy.', 'The bell shakes the dust off the rafters. I counted. It is a lot of dust.'],
    chat: ['Comfy...', 'Mm, soup.', 'Just five more minutes.'],
    script: (v, n) => { switch (alt(n, ['bed', 'loft', 'gallery'])) {
      case 'bed': return chDo(192, 412, 'sit', 1, [14, 24]);
      case 'loft': return [...chStay(chRnd(480, 940), 440, 1, [4, 8]), ...chStay(chRnd(480, 940), 400, -1, [3, 6])];
      default: return chStay(chRnd(300, 1100), 640, 1, [5, 10]); } } });
}

// ---------------------------------------------------------------- the priestess: she waters the flowers, prays on a pew or at the altar, polishes the altar, and stands by it between times
function churchRoutine(v, n) {
  const c = CHURCH, rnd = chRnd, pick = chPick;
  const kind = pick(['water', 'water', 'pew', 'pew', 'altar', 'polish'].filter(k => k !== n.lastKind)); n.lastKind = kind;
  const post = [{ go: [c.ox + 320, c.oy + 152], speed: 30 }, { t: [4, 8], face: Math.random() < 0.5 ? 1 : -1 }];
  if (kind === 'water') {
    const pot = pick(v.cpots), sd = pot.x < c.ox + 320 ? 1 : -1;
    return [{ go: [pot.x + sd * 24, pot.y + 8], speed: 34 }, { do: 'water', t: [4, 6], face: -sd, tick: (n2, v2, dt) => { chSplash(n2, v2, dt * 1.1); pot.wet = 1; } }, ...post];
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

// ---------------------------------------------------------------- going in, up and out
const churchFolkOf = (v, fl = v.cFloor) => v.cKind !== 'church' ? v.npcs.filter(n => n.int === v.cKind && n.floor === fl) : v.npcs.filter(n => (n.church || n.special === 'shrine') && (n.special === 'shrine' ? fl === 0 : n.floor === fl));
const chSt = v => v.cKind === 'inn' ? INN_STAIRS : CH_STAIRS, chNm = v => v.cKind === 'church' ? CH_NAME : INT[v.cKind].name;
function churchSetFloor(v, fl) {
  v.cFloor = fl; const f = v.cfl[fl]; v.solids = f.solids; v.solidsH = f.solids;
  v.cgrid = v.cgrids[fl] || (v.cgrids[fl] = vilGrid(v));
}
function enterChurch(kind = 'church') {
  const v = vil; if (!v || v.inChurch) return;
  v.cKind = kind; v.cfl = kind === 'church' ? v.cflC : v[INT[kind].fl]; v.cgrids = [null, null]; v.cgrid = null;
  v.inChurch = true; v.cOut = { x: hero.x, y: hero.y }; v.solidsOut = { s: v.solids, h: v.solidsH };
  churchSetFloor(v, 0);
  const ex = kind === 'church' ? CH_EXIT : INT[kind].exit; hero.x = ex.x; hero.y = ex.y - 30; hero.facing = 1; hero.moving = false; hero.walkT = 0; hero.scarf.forEach(p => { p.x = hero.x; p.y = hero.y - 50; });
  for (const k in keys) keys[k] = false;
  v.fade = 1; v.near = null; churchCam(v, 0, true);
  sfx('door'); if (kind === 'church') sfx('bell'); popups = popups.filter(p => p.screen); popups.push({ text: chNm(v)[0], x: VW / 2, y: 70, t: 2.6, big: true, screen: true, color: '#f4ecd0' });
}
function leaveChurch() {
  const v = vil; if (!v || !v.inChurch) return;
  v.inChurch = false; v.solids = v.solidsOut.s; v.solidsH = v.solidsOut.h; v.talk = null; v.cgrid = null;
  const d = v.cKind === 'church' ? v.church.door : v.b[INT[v.cKind].b].door, c = vilCollide(v, d.x, d.y + 34, 9, undefined, undefined, true);
  hero.x = c.x; hero.y = c.y; hero.facing = 1; hero.moving = false; hero.walkT = 0; hero.scarf.forEach(p => { p.x = hero.x; p.y = hero.y - 50; });
  for (const k in keys) keys[k] = false;
  v.fade = 1; v.near = null; sfx('door');
  const vw = VW / VIL_ZOOM, vh = VH / VIL_ZOOM; cam.x = clampN(hero.x - vw / 2, 0, VIL_W - vw); cam.y = clampN(hero.y - vh / 2 - 12, 0, VIL_H - vh);
}
function churchStairs() {                                                                  // up or down the stair at the east end of the hall
  const v = vil; if (!v || !v.inChurch) return;
  const to = 1 - v.cFloor; v.talk = null; churchSetFloor(v, to);
  hero.x = chSt(v).x + 50; hero.y = chSt(v).y; if (v.cKind !== 'inn') hero.x -= 100; hero.facing = -1; hero.moving = false; hero.walkT = 0; hero.scarf.forEach(p => { p.x = hero.x; p.y = hero.y - 50; });
  for (const k in keys) keys[k] = false;
  v.fade = 0.8; v.near = null; sfx('door'); churchCam(v, 0, true);
  popups = popups.filter(p => p.screen); popups.push({ text: chNm(v)[to], x: VW / 2, y: 70, t: 2, big: true, screen: true, color: '#f4ecd0' });
}
function ringChurchBell() {
  const v = vil; if (!v) return; v.bellT = 1.6; sfx('bell'); sfx('bell');
  popups.push({ text: 'The bell rings out over the village', x: VW / 2, y: 110, t: 2.2, screen: true, small: true, color: '#f4ecd0' });
  for (const n of churchFolkOf(v)) if (!n.bubble && Math.random() < 0.5) { n.bubble = chPick(['Oh! The bell!', 'My ears...', 'Who rang that?']); n.bubbleT = 2; n.talking = true; }
}
function churchNear(v, dt) {
  const fl = v.cFloor, folk = churchFolkOf(v);
  for (const e of folk) {
    e.alpha = 1;
    if (v.talk && v.talk.ref === e) { e.moving = false; e.pose = 'stand'; e.f = hero.x >= e.x ? 1 : -1; }          // they stop what they are doing to talk
    else { runScript(e, dt, v); if (e.pose === 'stand' && !e.moving && Math.hypot(hero.x - e.x, hero.y - e.y) < 70 && !e.cur) e.f = hero.x >= e.x ? 1 : -1; }
    const dx = hero.x - e.x, dy = hero.y - e.y, d = Math.hypot(dx, dy), min = 9 + e.r + 2;                               // nobody walks through anybody
    if (d < min) { const k = d < 0.01 ? 0 : (min - d) / d; hero.x += d < 0.01 ? min : dx * k; hero.y += dy * k; const cc = vilCollide(v, hero.x, hero.y, 9, undefined, undefined, true); hero.x = cc.x; hero.y = cc.y; }
    if (e.bubbleT > 0) { e.bubbleT -= dt; if (e.bubbleT <= 0) { e.bubble = null; e.talking = false; } }
  }
  if (fl === 0) for (const p of v.cpots) p.wet = Math.max(0, p.wet - dt * 0.25);
  if (v.bellT > 0) v.bellT -= dt;
  let best = null, bd = 1e9;
  const prev = v.near, consider = (kind, ref, x, y, r, label, tag) => { const d = Math.hypot(hero.x - x, hero.y - y), same = prev && prev.kind === kind && prev.ref === ref && prev.label === label, de = same ? d * 0.6 : d; if (d < (same ? r * 1.4 : r) && de < bd) { bd = de; best = { kind, ref, x, y, label, tag }; } };
  for (const e of folk) consider('npc', e, e.x, e.y, 78, e.name, e.role + (e.pose === 'sitpray' || e.pose === 'pray' ? ' · praying' : e.pose === 'read' ? ' · reading' : ''));
  if (v.cKind !== 'church') intSpots(fl, consider);
  else {
  if (fl === 0) consider('exit', null, CH_EXIT.x, CH_EXIT.y, 64, 'the church', 'Leave');
  consider('stairs', null, CH_STAIRS.x, CH_STAIRS.y, 54, fl === 0 ? 'Go upstairs' : 'Go downstairs', '');
  if (fl === 1) consider('bell', null, CH_BELL.x, CH_BELL.y + 14, 50, 'Ring the bell', '');
  }
  if (!best && prev && (v.nearGrace = (v.nearGrace || 0) + dt) < 0.25 && prev.kind !== 'npc') best = prev; else if (best) v.nearGrace = 0;     // a prompt never blinks out for a frame or two at the edge
  if (best) v.nearAt = tAnim;
  else if (prev && prev.kind === 'npc' && tAnim - (v.nearAt || 0) < 0.35) best = { ...prev, x: prev.ref.x, y: prev.ref.y };
  v.near = best;
}
function churchCam(v, dt, snap) {
  const vw = VW / VIL_ZOOM, vh = VH / VIL_ZOOM;
  cam.x = clampN(hero.x - vw / 2, CHB.x0 + 40, Math.max(CHB.x0 + 40, CHB.x1 - 40 - vw)); cam.y = clampN(hero.y - vh * 0.5, CHB.y0 + 10, Math.max(CHB.y0 + 10, CHB.y1 - vh)) ; cam.shake = 0;
  if (!dt) return;
  for (const p of popups) { p.t -= dt; if (p.pop !== undefined) p.pop += dt; if (!p.big && !p.screen) p.y -= 30 * dt; }
  popups = popups.filter(p => p.t > 0);
  v.soundT -= dt; if (v.soundT <= 0) { v.soundT = 0.5; Sound.setScene({ biome: 'village', night: false, wind: 0, rain: 0, pitch: 450 }); }
}

// ---------------------------------------------------------------- drawing
function chBake(v, fl) {                                                                   // the walls of one floor, drawn once: dark stone tops, and the lit face of every wall that looks onto a room
  const f = v.cfl[fl]; if (f.bake) return f.bake; const inn = v.cKind === 'inn'; f.ext = [];
  const S = 2, W = CHB.x1 - CHB.x0, H = CHB.y1 - CHB.y0, cv = document.createElement('canvas'); cv.width = W * S; cv.height = H * S;
  const g = cv.getContext('2d'); g.scale(S, S); g.translate(-CHB.x0, -CHB.y0);
  const cv2 = document.createElement('canvas'); cv2.width = W * S; cv2.height = H * S; const g2 = cv2.getContext('2d'); g2.scale(S, S); g2.translate(-CHB.x0, -CHB.y0);
  const cv3 = document.createElement('canvas'); cv3.width = W * S; cv3.height = H * S; const g3 = cv3.getContext('2d'); g3.scale(S, S); g3.translate(-CHB.x0, -CHB.y0);
  g.fillStyle = '#2a231c'; g.fillRect(CHB.x0, CHB.y0, W, H);
  for (const s of f.walls) {
    g.fillStyle = inn ? '#7a5e40' : '#8a7a62'; g.fillRect(s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0);          // the top of a wall: capstones, not a black void
    g.save(); g.beginPath(); g.rect(s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0); g.clip(); g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 1;
    for (let yy = Math.ceil(s.y0 / 14) * 14; yy < s.y1; yy += 14) { g.beginPath(); g.moveTo(s.x0, yy + 0.5); g.lineTo(s.x1, yy + 0.5); g.stroke(); }
    for (let yy = Math.floor(s.y0 / 14) * 14, r = 0; yy < s.y1; yy += 14, r++) for (let xx = Math.floor(s.x0 / 44) * 44 + (r % 2) * 22; xx < s.x1; xx += 44) { g.beginPath(); g.moveTo(xx + 0.5, yy); g.lineTo(xx + 0.5, yy + 14); g.stroke(); }
    g.restore();
    g.fillStyle = inn ? '#7a6044' : '#8a7a62'; g.fillRect(s.x0, s.y0, s.x1 - s.x0, Math.min(3, s.y1 - s.y0));
    for (const [side, ax, ay, dx, dy] of [['E', s.x1 + 5, s.y0, 0, 10], ['W', s.x0 - 5, s.y0, 0, 10], ['N', s.x0, s.y0 - 5, 10, 0]]) {                       // the edges beside a floor: a pale cap and a shadow on the floor
      const len = dx ? s.x1 - s.x0 : s.y1 - s.y0;
      for (let o = 0; o < len; o += 10) {
        const px = ax + dx * (o / 10) + (dx ? 5 : 0), py = ay + dy * (o / 10) + (dy ? 5 : 0); if (!inWalkRects(f.walk, px, py)) continue;
        const l = Math.min(10, len - o);
        if (side === 'E') { g.fillStyle = inn ? '#c4aa80' : '#d4cab0'; g.fillRect(s.x1 - 7, s.y0 + o, 7, l); g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(s.x1 - 7, s.y0 + o, 1.5, l); const sg = g3.createLinearGradient(s.x1, 0, s.x1 + 20, 0); sg.addColorStop(0, 'rgba(0,0,0,0.34)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); g3.fillStyle = sg; g3.fillRect(s.x1, s.y0 + o, 20, l); }
        else if (side === 'W') { g.fillStyle = inn ? '#c4aa80' : '#d4cab0'; g.fillRect(s.x0, s.y0 + o, 7, l); g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(s.x0 + 5.5, s.y0 + o, 1.5, l); const sg = g3.createLinearGradient(s.x0, 0, s.x0 - 20, 0); sg.addColorStop(0, 'rgba(0,0,0,0.34)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); g3.fillStyle = sg; g3.fillRect(s.x0 - 20, s.y0 + o, 20, l); }
        else { g.fillStyle = inn ? '#c4aa80' : '#d4cab0'; g.fillRect(s.x0 + o, s.y0, l, 7); const sg = g3.createLinearGradient(0, s.y0, 0, s.y0 - 20); sg.addColorStop(0, 'rgba(0,0,0,0.34)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); g3.fillStyle = sg; g3.fillRect(s.x0 + o, s.y0 - 20, l, 20); }
      }
    }
    const below = inWalkRects(f.walk, (s.x0 + s.x1) / 2, s.y1 + 4) || inWalkRects(f.walk, s.x0 + 4, s.y1 + 4), fh = s.y1 - s.y0 >= 40 ? CH_WALLH : s.y1 - s.y0;
    if (below && s.x1 - s.x0 > 8) {
      const ext = s.y0 - (s.y1 - fh);
      for (const gg of ext > 0 ? [g, g2] : [g]) {
        if (gg === g2) { f.ext.push({ x0: s.x0, y0: s.y1 - fh, w: s.x1 - s.x0, h: ext, key: s.y1 }); gg.save(); gg.beginPath(); gg.rect(s.x0, s.y1 - fh, s.x1 - s.x0, ext); gg.clip(); }
      const top = s.y1 - fh, w = s.x1 - s.x0, hs = (a, b) => ((a * 73856093) ^ (b * 19349663)) >>> 0;
      gg.fillStyle = inn ? '#dccaa4' : '#b9ae96'; gg.fillRect(s.x0, top, w, fh);
      gg.save(); gg.beginPath(); gg.rect(s.x0, top, w, fh); gg.clip();
      if (inn) {                                                                                 // plaster between oak timbers: braced panels above an oak wainscot
        for (let xx = Math.floor(s.x0 / 7) * 7; xx < s.x1; xx += 7) { const h2 = hs(xx, 3) % 100; if (h2 < 40) { gg.fillStyle = 'rgba(120,90,50,0.07)'; gg.fillRect(xx, top, 5 + h2 % 4, fh); } }
        for (let bx = Math.ceil((s.x0 - 4) / 96) * 96; bx < s.x1 + 4; bx += 96) { gg.fillStyle = '#5a3a22'; gg.fillRect(bx - 4, top, 8, fh); gg.fillStyle = 'rgba(255,220,160,0.18)'; gg.fillRect(bx - 4, top, 2, fh); gg.fillStyle = 'rgba(0,0,0,0.22)'; gg.fillRect(bx + 2, top, 2, fh);
          gg.strokeStyle = '#5a3a22'; gg.lineWidth = 5; gg.beginPath(); gg.moveTo(bx + 4, top + fh - 38); gg.lineTo(bx + 44, top + 22); gg.moveTo(bx + 92, top + fh - 38); gg.lineTo(bx + 52, top + 22); gg.stroke(); }
        gg.fillStyle = '#5a3a22'; gg.fillRect(s.x0, top + 14, w, 7); gg.fillRect(s.x0, s.y1 - 40, w, 7);
        gg.fillStyle = '#7a5230'; gg.fillRect(s.x0, s.y1 - 33, w, 33); gg.strokeStyle = 'rgba(30,14,4,0.55)'; gg.lineWidth = 1.4; for (let xx = Math.floor(s.x0 / 32) * 32; xx < s.x1; xx += 32) { gg.strokeRect(xx + 3.5, s.y1 - 29.5, 25, 22); }
      }
      for (let yy = top; yy < s.y1 && !inn; yy += 10) {                                                  // cut stone: every block a slightly different tone, laid in staggered courses
        const r = Math.round(yy / 10), off = (r % 2) * 18;
        for (let xx = Math.floor(s.x0 / 36) * 36 - off; xx < s.x1; xx += 36) {
          const h = hs(xx, r) % 100; gg.fillStyle = h < 38 ? 'rgba(255,244,214,0.09)' : h < 74 ? 'rgba(70,50,30,0.05)' : 'rgba(70,50,30,0.13)'; gg.fillRect(xx + 1, yy + 1, 34, 8);
          gg.fillStyle = 'rgba(255,248,226,0.16)'; gg.fillRect(xx + 1, yy + 1, 34, 1);
        }
      }
      gg.strokeStyle = 'rgba(70,52,34,0.30)'; gg.lineWidth = 1;
      for (let yy = top + 10; yy < s.y1 && !inn; yy += 10) { gg.beginPath(); gg.moveTo(s.x0, yy + 0.5); gg.lineTo(s.x1, yy + 0.5); gg.stroke(); }
      for (let yy = top; yy < s.y1 && !inn; yy += 10) { const off = (Math.round(yy / 10) % 2) * 18; for (let xx = Math.floor(s.x0 / 36) * 36 - off; xx < s.x1; xx += 36) { gg.beginPath(); gg.moveTo(xx + 0.5, yy); gg.lineTo(xx + 0.5, yy + 10); gg.stroke(); } }
      const sh = gg.createLinearGradient(0, top, 0, s.y1); sh.addColorStop(0, 'rgba(255,244,214,0.20)'); sh.addColorStop(0.5, 'rgba(255,244,214,0)'); sh.addColorStop(1, 'rgba(40,24,10,0.26)'); gg.fillStyle = sh; gg.fillRect(s.x0, top, w, fh);
      gg.restore();
      gg.fillStyle = 'rgba(14,8,2,0.5)'; gg.fillRect(s.x0, s.y1 - 2, w, 2); const cs = gg.createLinearGradient(0, top, 0, top + 34); cs.addColorStop(0, 'rgba(14,8,2,0.5)'); cs.addColorStop(1, 'rgba(14,8,2,0)'); gg.fillStyle = cs; gg.fillRect(s.x0, top, w, 34);
      if (!inn) { gg.fillStyle = '#6b4a2e'; gg.fillRect(s.x0, s.y1 - 12, w, 12); }                               // oak panelling along the foot of the wall
      for (let xx = Math.floor(s.x0 / 24) * 24; xx < s.x1; xx += 24) { const a = Math.max(xx + 2, s.x0), b = Math.min(xx + 22, s.x1); if (b - a > 3) { gg.fillStyle = '#5a3d25'; gg.fillRect(a, s.y1 - 10, b - a, 7); gg.fillStyle = 'rgba(255,220,160,0.18)'; gg.fillRect(a, s.y1 - 10, b - a, 1); } }
      gg.fillStyle = '#9a7448'; gg.fillRect(s.x0, s.y1 - 12, w, 2); gg.fillStyle = '#3e2a18'; gg.fillRect(s.x0, s.y1 - 3, w, 3);
      gg.fillStyle = inn ? '#6b4a2e' : '#e0d6bc'; gg.fillRect(s.x0, top, w, 3); gg.fillStyle = inn ? '#3e2a18' : '#c9a24a'; gg.fillRect(s.x0, top + 3, w, 1.5); gg.fillStyle = 'rgba(0,0,0,0.24)'; gg.fillRect(s.x0, top + 4.5, w, 3);          // the cornice
      if (fh >= 36 && !inn) for (let px = Math.ceil((s.x0 - 25) / 110) * 110 + 55; px < s.x1 - 20; px += 110) {         // pilasters: fluted, with a capital and a foot
        gg.fillStyle = '#d9d0b8'; gg.fillRect(px - 5, top + 8, 10, fh - 21); gg.fillStyle = 'rgba(0,0,0,0.13)'; gg.fillRect(px + 2, top + 8, 3, fh - 21);
        gg.fillStyle = 'rgba(0,0,0,0.12)'; gg.fillRect(px - 2, top + 11, 1, fh - 27); gg.fillRect(px + 0, top + 11, 1, fh - 27);
        gg.fillStyle = '#ece5d0'; gg.fillRect(px - 7, top + 5, 14, 4); gg.fillStyle = '#c9a24a'; gg.fillRect(px - 7, top + 9, 14, 1); gg.fillStyle = '#ece5d0'; gg.fillRect(px - 7, s.y1 - 16, 14, 4);
      }
        if (gg === g2) gg.restore();
      }
    }
  }
  f.bake = cv; f.bake2 = cv2; f.bake3 = cv3; return cv;
}
const chBake2 = (v, fl) => (chBake(v, fl), v.cfl[fl].bake2), chBake3 = (v, fl) => (chBake(v, fl), v.cfl[fl].bake3);
function chExtThings(v, fl, things) {                                                    // the part of a wall that stands over the floor behind it: anything behind the wall is hidden by it, anything in front of it is drawn over it
  chBake(v, fl); const f = v.cfl[fl];
  for (const p of f.ext) things.push({ y: p.key, d: () => ctx.drawImage(f.bake2, (p.x0 - CHB.x0) * 2, (p.y0 - CHB.y0) * 2, p.w * 2, p.h * 2, p.x0, p.y0, p.w, p.h) });
}
function chFloorFill(r, base, alt, step = 20) {                                           // a tiled floor
  ctx.fillStyle = base; ctx.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
  ctx.save(); ctx.beginPath(); ctx.rect(r[0], r[1], r[2] - r[0], r[3] - r[1]); ctx.clip(); ctx.fillStyle = alt;
  for (let y = r[1], j = 0; y < r[3]; y += step, j++) for (let x = r[0] - (j % 2 ? step : 0), i = 0; x < r[2]; x += step * 2, i++) ctx.fillRect(x + step, y, step, step);
  ctx.restore();
}
function chPlanks(r, base, line, w = 14) {
  ctx.fillStyle = base; ctx.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
  ctx.strokeStyle = line; ctx.lineWidth = 1; for (let y = r[1] + w; y < r[3]; y += w) { ctx.beginPath(); ctx.moveTo(r[0], y + 0.5); ctx.lineTo(r[2], y + 0.5); ctx.stroke(); }
  for (let y = r[1], j = 0; y < r[3]; y += w, j++) for (let x = r[0] + (j * 37) % 90; x < r[2]; x += 90) { ctx.beginPath(); ctx.moveTo(x + 0.5, y); ctx.lineTo(x + 0.5, y + w); ctx.stroke(); }
}
function chWindow(x, y, k) {                                                               // y is the top of the window; it sits well up the wall
  CHV.wins.push([x, y + 76, k]);
  const church = vil && vil.cKind === 'church', cx = x, cy = y + 13;
  const sky = ctx.createLinearGradient(0, y, 0, y + 32); sky.addColorStop(0, '#d8ecf8'); sky.addColorStop(1, '#a9c9e0');
  if (church) {
    const arch = r => { ctx.beginPath(); ctx.moveTo(cx - r, y + 30); ctx.lineTo(cx - r, cy); ctx.arc(cx, cy, r, Math.PI, 0); ctx.lineTo(cx + r, y + 30); ctx.closePath(); };
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(cx - 14, y + 3, 28, 29); arch(14); ctx.fillStyle = '#d9d0b8'; ctx.fill(); ctx.strokeStyle = '#8f7e63'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#c9a24a'; ctx.fillRect(cx - 2.5, y - 1, 5, 4); arch(10.5); ctx.save(); ctx.clip(); ctx.fillStyle = sky; ctx.fillRect(cx - 12, y, 24, 32);
    ctx.strokeStyle = '#6a6a72'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = -2; i <= 2; i++) { ctx.moveTo(cx + i * 6, y); ctx.lineTo(cx + i * 6 + 14, y + 32); ctx.moveTo(cx + i * 6, y); ctx.lineTo(cx + i * 6 - 14, y + 32); } ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(cx - 9, y + 4, 2, 9); ctx.restore(); arch(10.5); ctx.strokeStyle = '#3a3a42'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = '#9a8c70'; ctx.fillRect(cx - 16, y + 30, 32, 3); ctx.fillStyle = '#d9d0b8'; ctx.fillRect(cx - 16, y + 30, 32, 1);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(cx - 15, y + 2, 30, 34);
    ctx.fillStyle = '#4a2c18'; ctx.fillRect(cx - 14, y, 28, 33); ctx.fillStyle = sky; ctx.fillRect(cx - 11, y + 3, 22, 27);
    ctx.fillStyle = 'rgba(255,255,255,0.38)'; ctx.fillRect(cx - 9, y + 5, 3, 11); ctx.fillRect(cx + 1, y + 17, 3, 8);
    ctx.fillStyle = '#4a2c18'; ctx.fillRect(cx - 1.2, y + 3, 2.4, 27); ctx.fillRect(cx - 11, y + 15.5, 22, 2.4); ctx.fillStyle = 'rgba(255,220,160,0.3)'; ctx.fillRect(cx - 14, y, 28, 1.5);
    for (const sd of [-1, 1]) { const sx = sd < 0 ? cx - 24 : cx + 15; ctx.fillStyle = '#6a4426'; ctx.fillRect(sx, y + 1, 9, 31); ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let yy = y + 5; yy < y + 31; yy += 5) ctx.fillRect(sx + 1, yy, 7, 1.4); }
    ctx.fillStyle = '#7a5230'; ctx.fillRect(cx - 18, y + 32, 36, 4); ctx.fillStyle = 'rgba(255,230,180,0.3)'; ctx.fillRect(cx - 18, y + 32, 36, 1.4);
  }
}
function chRunner(x0, x1, y) {
  ctx.fillStyle = '#7a1f2a'; ctx.fillRect(x0, y - 14, x1 - x0, 28); ctx.fillStyle = '#d9b44a'; ctx.fillRect(x0, y - 14, x1 - x0, 2); ctx.fillRect(x0, y + 12, x1 - x0, 2);
  ctx.fillStyle = '#5e1420'; ctx.fillRect(x0, y - 11, x1 - x0, 1); ctx.fillRect(x0, y + 10, x1 - x0, 1);
  ctx.fillStyle = 'rgba(217,180,74,0.7)'; for (let x = x0 + 14; x < x1 - 8; x += 28) { ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 6); ctx.lineTo(x - 6, y); ctx.closePath(); ctx.fill(); }
}
function chBorder(r, col = '#9a8c70', w = 5) {
  ctx.fillStyle = col; ctx.fillRect(r[0], r[1], r[2] - r[0], w); ctx.fillRect(r[0], r[3] - w, r[2] - r[0], w); ctx.fillRect(r[0], r[1], w, r[3] - r[1]); ctx.fillRect(r[2] - w, r[1], w, r[3] - r[1]);
  ctx.strokeStyle = 'rgba(201,162,74,0.8)'; ctx.lineWidth = 1; ctx.strokeRect(r[0] + w + 1.5, r[1] + w + 1.5, r[2] - r[0] - 2 * w - 3, r[3] - r[1] - 2 * w - 3);
}
function chMedallion(x, y, r) {
  for (let k = 3; k >= 1; k--) { ctx.strokeStyle = k % 2 ? 'rgba(201,162,74,0.85)' : 'rgba(90,70,50,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r * k / 3, 0, 6.3); ctx.stroke(); }
  ctx.fillStyle = 'rgba(122,31,42,0.65)'; ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283, rr = i % 2 ? r * 0.28 : r * 0.62; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill();
}
function chSconce(x, y, t) {
  CHV.lights.push([x, y + 6, 150, 0.95]);
  const fl = 1 + Math.sin(t * 9 + x) * 0.18 + Math.sin(t * 14 + x * 2) * 0.08;
  ctx.fillStyle = '#4a3a2a'; ctx.fillRect(x - 1.5, y + 2, 3, 9); ctx.fillStyle = '#6a5a3a'; ctx.fillRect(x - 4, y + 1, 8, 3);
  ctx.fillStyle = '#ffb040'; ctx.beginPath(); ctx.ellipse(x, y - 3, 3, 6 * fl, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = '#fff0a0'; ctx.beginPath(); ctx.ellipse(x, y - 1.5, 1.4, 3 * fl, 0, 0, 6.3); ctx.fill();
  if (gfx.glow) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y, 1, x, y, 46); g.addColorStop(0, `rgba(255,170,70,${0.34 * fl})`); g.addColorStop(1, 'rgba(255,140,40,0)'); ctx.fillStyle = g; ctx.fillRect(x - 46, y - 46, 92, 92); ctx.restore(); }
}
function chGarden(r) {
  ctx.fillStyle = '#6fa653'; ctx.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
  const rr = ((s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296))(7);
  for (let i = 0; i < 90; i++) { ctx.fillStyle = rr() < 0.5 ? '#80b862' : '#5f9646'; ctx.fillRect(r[0] + rr() * (r[2] - r[0]), r[1] + rr() * (r[3] - r[1]), 3, 2); }
  ctx.fillStyle = '#cdb88a'; ctx.fillRect(r[0], 430, r[2] - r[0], 22); ctx.fillRect(255, r[1], 22, r[3] - r[1]);                    // the paths
  ctx.beginPath(); ctx.ellipse(265, 440, 60, 44, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.14)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(265, 440, 60, 44, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let x = r[0] + 6; x < r[2]; x += 16) { ctx.fillRect(x, 430, 7, 1); ctx.fillRect(x + 8, 450, 7, 1); }
  ctx.fillStyle = '#b9a574'; for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.ellipse(265 + (i % 2 ? 4 : -4), r[1] + 14 + i * 7, 6, 3, 0, 0, 6.3); ctx.fill(); }
  const hedge = (x, y, w, h) => { ctx.fillStyle = '#2f6a2f'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill(); ctx.fillStyle = '#3f8a3a'; ctx.beginPath(); ctx.roundRect(x + 2, y + 1, w - 4, h * 0.55, 5); ctx.fill(); };
  hedge(r[0] + 2, r[1] + 70, 14, 130); hedge(r[2] - 16, r[1] + 70, 14, 130); hedge(r[0] + 2, 470, 14, 70); hedge(r[2] - 16, 470, 14, 70);
  for (const [fx, fy] of [[170, 470], [360, 470], [160, 405], [372, 405], [200, 540], [330, 540], [215, 355], [305, 355]]) for (let i = 0; i < 5; i++) { ctx.fillStyle = ['#f28ab2', '#f4e04d', '#fff', '#b99bff', '#ff9a6a'][(i + fx) % 5]; ctx.beginPath(); ctx.arc(fx + (i % 3) * 5 - 5, fy + ((i * 3) % 4) * 3, 2.2, 0, 6.3); ctx.fill(); }
}
function chRoom(fl, t) {                                                                   // the floors of the rooms of one storey
  const walk = CH_WALK[fl], hall = walk[2], garden = walk[3], east = walk[4];
  if (fl === 0) {
    chFloorFill(walk[1], '#cfc6b0', '#c4baa2'); chFloorFill(hall, '#cdc3ac', '#c2b8a0'); chRunner(hall[0] + 20, hall[2] - 20, 740);
    chGarden(garden); chPlanks(east, '#a77d52', 'rgba(60,30,10,0.35)');
    ctx.fillStyle = '#6a2a3a'; ctx.fillRect(1080, 380, 190, 160); ctx.strokeStyle = '#d9b44a'; ctx.lineWidth = 2; ctx.strokeRect(1086, 386, 178, 148); ctx.strokeStyle = 'rgba(217,180,74,0.5)'; ctx.strokeRect(1094, 394, 162, 132); chMedallion(1175, 460, 36);
  } else {
    chFloorFill(hall, '#bdb39b', '#b2a88f'); chRunner(hall[0] + 20, hall[2] - 20, 740);
    chFloorFill(walk[1], '#b9ae96', '#aea38b'); chPlanks(walk[0], '#8a6038', 'rgba(40,20,5,0.4)', 16);
    chPlanks(garden, '#a07650', 'rgba(60,30,10,0.35)'); chPlanks(east, '#a07650', 'rgba(60,30,10,0.35)');
    ctx.fillStyle = '#5a3a6a'; ctx.fillRect(190, 372, 190, 150); ctx.strokeStyle = '#d9b44a'; ctx.lineWidth = 2; ctx.strokeRect(196, 378, 178, 138);
  }
  chBorder(hall, '#9a8c70'); if (fl === 0) { chBorder(walk[1], '#9a8c70', 4); chMedallion(720, 740, 30); chBorder(east, '#7a5430', 4); } else { chBorder(east, '#6a4426', 4); chBorder(garden, '#6a4426', 4); chMedallion(720, 740, 30); }
  for (const d of [walk[5], walk[6]]) chFloorFill(d, '#c9bfa8', '#bdb39b', 10);
  for (const a of CH_ARCH) chFloorFill(a, '#cdc3ac', '#c2b8a0', 10);
  // wall faces: windows on the hall wall, shelves in the scriptorium, ivy over the garden
  for (let x = 505; x < 1250; x += 110) if (Math.abs(x - 720) > 60 && Math.abs(x - 1235) > 30) chSconce(x, 580, t);
  chWindow(560, 504, 0); chWindow(890, 504, 2); chTapestry(436, 502, 28, 56, '#7a1f2a', '#d9b44a'); chTapestry(986, 502, 28, 56, '#2f4a7a', '#d9b44a'); chTapestry(1108, 502, 28, 56, '#7a1f2a', '#d9b44a');
  if (fl === 0) {
    for (let x = 1050; x < 1440; x += 62) { ctx.fillStyle = '#5a3a22'; ctx.fillRect(x, 296, 56, 34); for (let i = 0; i < 12; i++) { ctx.fillStyle = ['#c0392b', '#2f6aa8', '#d9b44a', '#3f9a5a', '#7a4a8a'][i % 5]; ctx.fillRect(x + 3 + i * 4.4, 299 + (i % 3), 3.4, 12); ctx.fillRect(x + 3 + i * 4.4, 315 + (i % 2), 3.4, 11); } }
    for (let x = 14; x < 396; x += 14) { ctx.fillStyle = (x / 14) % 2 ? '#4f8a3e' : '#3f7a34'; ctx.fillRect(x, 216, 8, 18 + ((x * 7) % 14)); ctx.fillStyle = '#6aa04a'; ctx.fillRect(x + 1, 216, 2, 10); }
    for (const x of [1075, 1175, 1275, 1340, 1410]) chSconce(x, 300, t);
  } else {
    for (const bx of [200, 330, 1090, 1230]) { ctx.fillStyle = '#7a1f2a'; ctx.fillRect(bx - 9, 296, 18, 32); ctx.fillStyle = '#d9b44a'; ctx.fillRect(bx - 9, 296, 18, 2); ctx.fillRect(bx - 1, 304, 2, 14); }
    for (const x of [140, 390, 1050, 1300]) chSconce(x, 306, t);
    ctx.strokeStyle = 'rgba(40,24,10,0.55)'; ctx.lineWidth = 3; for (const y of [336, 400, 470, 540]) { ctx.beginPath(); ctx.moveTo(130, y); ctx.lineTo(400, y); ctx.moveTo(1040, y); ctx.lineTo(1310, y); ctx.stroke(); }
    for (const wx of [265, 1175]) chWindow(wx, 234, wx);
  }
}
function drawChurchProp(p, t, v) {
  const k = p.k;
  if (CH_DECOR[k]) return CH_DECOR[k](p, t, v);
  if (k === 'bench') { ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(p.x0 + 2, p.y1 - 1, p.x1 - p.x0, 3); ctx.fillStyle = '#5a3a22'; ctx.fillRect(p.x0, p.y0 - 8, p.x1 - p.x0, 6); ctx.fillStyle = '#7a5230'; ctx.fillRect(p.x0, p.y0 - 2, p.x1 - p.x0, p.y1 - p.y0 + 2); ctx.fillStyle = '#4a2c18'; ctx.fillRect(p.x0, p.y0 - 8, 3, p.y1 - p.y0 + 8); ctx.fillRect(p.x1 - 3, p.y0 - 8, 3, p.y1 - p.y0 + 8); }
  else if (k === 'bed') {
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(p.x0 + 2, p.y1 - 1, p.x1 - p.x0, 3);
    const BL = p.look || ['#5a3a22', '#e8e2d2', '#4a6a9a'];
    ctx.fillStyle = BL[0]; ctx.fillRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0); ctx.fillStyle = BL[1]; ctx.fillRect(p.x0 + 3, p.y0 + 3, p.x1 - p.x0 - 6, 11); ctx.fillStyle = BL[2]; ctx.fillRect(p.x0 + 3, p.y0 + 14, p.x1 - p.x0 - 6, p.y1 - p.y0 - 17);
    if (p.y1 - p.y0 < 30) { ctx.fillStyle = '#5f8a3a'; ctx.fillRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0); for (let x = p.x0 + 4; x < p.x1; x += 8) { ctx.fillStyle = ['#f28ab2', '#f4e04d', '#fff', '#b99bff'][((x / 8) | 0) % 4]; ctx.beginPath(); ctx.arc(x, p.y0 + 6 + Math.sin(t * 1.5 + x) * 1.2, 3, 0, 6.3); ctx.fill(); } }
  } else if (k === 'table') { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(p.x0 + 3, p.y1 - 2, p.x1 - p.x0, 4); ctx.fillStyle = '#6a4426'; ctx.fillRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0); ctx.fillStyle = '#8a5c34'; ctx.fillRect(p.x0, p.y0, p.x1 - p.x0, 8); ctx.fillStyle = '#e8e0c8'; ctx.fillRect(p.x0 + 10, p.y0 + 2, 18, 8); ctx.fillRect(p.x0 + 36, p.y0 + 3, 14, 7); ctx.fillStyle = '#c0392b'; ctx.fillRect(p.x1 - 18, p.y0 + 1, 8, 9); ctx.fillStyle = '#efe6c8'; ctx.fillRect(p.x0 + 62, p.y0 - 2, 3, 7); const fl = 1 + Math.sin(t * 9 + p.x0) * 0.2; CHV.lights.push([p.x0 + 63, p.y0 - 4, 95, 0.85]); ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.ellipse(p.x0 + 63.5, p.y0 - 5, 1.8, 3.4 * fl, 0, 0, 6.3); ctx.fill(); if (gfx.glow) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(p.x0 + 63, p.y0 - 4, 1, p.x0 + 63, p.y0 - 4, 30); g.addColorStop(0, 'rgba(255,190,90,0.28)'); g.addColorStop(1, 'rgba(255,160,60,0)'); ctx.fillStyle = g; ctx.fillRect(p.x0 + 33, p.y0 - 34, 60, 60); ctx.restore(); } }
  else if (k === 'chest') { ctx.fillStyle = '#7a5230'; ctx.fillRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0); ctx.fillStyle = '#d9b44a'; ctx.fillRect(p.x0, p.y0 + 5, p.x1 - p.x0, 2); ctx.fillRect(p.x0 + (p.x1 - p.x0) / 2 - 2, p.y0 + 3, 4, 6); }
  else if (k === 'fountain') {
    ell(p.x, p.y + 4, 30, 12, 'rgba(0,0,0,0.22)'); ell(p.x, p.y, 28, 14, '#a9a392'); ell(p.x, p.y - 2, 24, 11, '#6fb6e0'); ell(p.x, p.y - 2, 24, 11, `rgba(255,255,255,${0.12 + 0.08 * Math.sin(t * 3)})`);
    ctx.fillStyle = '#c9c3b2'; ctx.fillRect(p.x - 4, p.y - 26, 8, 24); ell(p.x, p.y - 28, 11, 4, '#c9c3b2');
    ctx.strokeStyle = 'rgba(180,225,255,0.8)'; ctx.lineWidth = 1.4; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(p.x, p.y - 30); ctx.quadraticCurveTo(p.x + i * 10, p.y - 40 + Math.sin(t * 4 + i) * 2, p.x + i * 16, p.y - 6); ctx.stroke(); }
  } else if (k === 'tree') { ell(p.x, p.y + 2, 12, 4, 'rgba(0,0,0,0.22)'); ctx.fillStyle = '#6a4a2a'; ctx.fillRect(p.x - 3, p.y - 22, 6, 24); ctx.fillStyle = '#3f8a3a'; ctx.beginPath(); ctx.arc(p.x, p.y - 34, 16, 0, 6.3); ctx.fill(); ctx.fillStyle = '#4fa048'; ctx.beginPath(); ctx.arc(p.x - 5, p.y - 38, 8, 0, 6.3); ctx.fill(); }
  else if (k === 'statue') { ell(p.x, p.y + 2, 11, 4, 'rgba(0,0,0,0.22)'); ctx.fillStyle = '#b8b2a2'; ctx.fillRect(p.x - 9, p.y - 10, 18, 12); ctx.fillStyle = '#d4cfc0'; ctx.beginPath(); ctx.moveTo(p.x - 6, p.y - 10); ctx.lineTo(p.x - 7, p.y - 34); ctx.arc(p.x, p.y - 38, 7, Math.PI, 0); ctx.lineTo(p.x + 7, p.y - 34); ctx.lineTo(p.x + 6, p.y - 10); ctx.closePath(); ctx.fill(); }
  else if (k === 'font') { ell(p.x, p.y + 2, 14, 5, 'rgba(0,0,0,0.22)'); ctx.fillStyle = '#b8b2a2'; ctx.fillRect(p.x - 5, p.y - 14, 10, 15); ell(p.x, p.y - 15, 13, 5, '#d4cfc0'); ell(p.x, p.y - 15, 10, 3.4, '#7ec4ee'); }
  else if (k === 'candles') { CHV.lights.push([p.x, p.y - 30, 85, 0.85]); ell(p.x, p.y + 2, 10, 4, 'rgba(0,0,0,0.22)'); ctx.fillStyle = '#4a3f33'; ctx.fillRect(p.x - 1.5, p.y - 22, 3, 22); ctx.fillRect(p.x - 10, p.y - 24, 20, 3); for (const dx of [-8, 0, 8]) { ctx.fillStyle = '#efe6c8'; ctx.fillRect(p.x + dx - 1.5, p.y - 32, 3, 8); const fl = 1 + Math.sin(t * 9 + dx + p.x) * 0.2; ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.ellipse(p.x + dx, p.y - 35, 1.8, 3.4 * fl, 0, 0, 6.3); ctx.fill(); } }
  else if (k === 'lectern') { ell(p.x, p.y + 2, 9, 3, 'rgba(0,0,0,0.22)'); ctx.fillStyle = '#6a4426'; ctx.fillRect(p.x - 2, p.y - 18, 4, 18); ctx.fillStyle = '#8a5c34'; ctx.beginPath(); ctx.moveTo(p.x - 10, p.y - 18); ctx.lineTo(p.x + 10, p.y - 18); ctx.lineTo(p.x + 7, p.y - 26); ctx.lineTo(p.x - 7, p.y - 26); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#e8e0c8'; ctx.fillRect(p.x - 6, p.y - 25, 12, 5); }
  else if (k === 'bell') {                                                                // the bell rope, swinging after it has been pulled
    const sw = Math.sin((v.t || 0) * 14) * Math.max(0, v.bellT || 0) * 6;
    ctx.fillStyle = '#d9b44a'; ctx.beginPath(); ctx.moveTo(p.x - 16, p.y - 48); ctx.quadraticCurveTo(p.x - 18 + sw, p.y - 76, p.x + sw, p.y - 78); ctx.quadraticCurveTo(p.x + 18 + sw, p.y - 76, p.x + 16, p.y - 48); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#7a5a10'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = '#a07a4a'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(p.x + sw * 0.5, p.y - 48); ctx.lineTo(p.x + sw * 0.2, p.y - 6); ctx.stroke(); ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(p.x + sw * 0.2, p.y - 4, 4, 0, 6.3); ctx.fill();
  }
}

// ---------------------------------------------------------------- furnishings shared by the church, the inn and the guild: shelves, chairs, plants, rugs and things hung on the walls
const chHash = (a, b = 0) => ((Math.round(a) * 73856093) ^ (Math.round(b) * 19349663)) >>> 0;
const CH_BOOKS = ['#8a2a2a', '#2f5a8a', '#3f7a4a', '#c9a24a', '#6a3a7a', '#7a5a3a', '#d8d0b8', '#2a4a4a', '#a8552a'];
const CH_DECOR = {
  shelf(p) {                                                                                // a tall bookcase against a wall: x0..x1, its foot at y1; v is what stands on it
    const h = p.h || 80, w = p.x1 - p.x0, top = p.y1 - h, rows = 3, rh = (h - 10) / rows;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(p.x0 + 3, p.y1 - 2, w, 5);
    ctx.fillStyle = '#4a2c18'; ctx.fillRect(p.x0, top, w, h); ctx.fillStyle = '#6a4426'; ctx.fillRect(p.x0 - 2, top - 3, w + 4, 6); ctx.fillStyle = 'rgba(255,230,180,0.25)'; ctx.fillRect(p.x0 - 2, top - 3, w + 4, 1.5);
    for (let r = 0; r < rows; r++) {
      const fy = top + 7 + (r + 1) * rh - 3, y0 = fy - rh + 5;
      ctx.fillStyle = '#26170b'; ctx.fillRect(p.x0 + 3, y0, w - 6, rh - 3);
      for (let x = p.x0 + 5, i = 0; x < p.x1 - 7; i++) {
        const hs = chHash(p.x0 + r * 31, i + 7), iw = 3 + hs % 4;
        if (p.v === 'bottles') { const bh = 9 + hs % 6; ctx.fillStyle = ['#3f9a5a', '#c0392b', '#d9b44a', '#3f6fd0', '#8a4fd0'][hs % 5]; ctx.fillRect(x, fy - bh, 6, bh); ctx.fillRect(x + 1.5, fy - bh - 4, 3, 4); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x + 1, fy - bh + 2, 1.3, 5); x += 8; }
        else if (p.v === 'pots') { const pr = 4 + hs % 3; ctx.fillStyle = ['#b8794a', '#d8cfb8', '#6a8aa8'][hs % 3]; ctx.beginPath(); ctx.ellipse(x + pr, fy - pr, pr, pr * 0.9, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x + pr - 2, fy - pr * 2 - 1, 4, 2); x += pr * 2 + 3; }
        else if (p.v === 'scrolls') { ctx.fillStyle = ['#e8dcb8', '#d8c8a0', '#efe6c8'][hs % 3]; ctx.fillRect(x, fy - 5 - hs % 2, 12, 5); ctx.fillStyle = '#c0392b'; ctx.fillRect(x + 5, fy - 5 - hs % 2, 2, 5); if (hs % 3 === 0) { ctx.fillStyle = '#e8dcb8'; ctx.fillRect(x + 2, fy - 10, 9, 5); } x += 14; }
        else { const bh = rh - 7 - hs % 5; ctx.fillStyle = CH_BOOKS[hs % CH_BOOKS.length]; ctx.fillRect(x, fy - bh, iw, bh); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, fy - bh, 1, bh); if (hs % 7 === 0) { ctx.fillStyle = '#d9b44a'; ctx.fillRect(x, fy - bh + 3, iw, 1.5); } x += iw + 0.6; if (hs % 11 === 0) x += 7; }
      }
      ctx.fillStyle = '#6a4426'; ctx.fillRect(p.x0 + 2, fy, w - 4, 3); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(p.x0 + 2, fy + 3, w - 4, 1.5);
    }
    ctx.fillStyle = '#3a220f'; ctx.fillRect(p.x0, top, 3, h); ctx.fillRect(p.x1 - 3, top, 3, h);
  },
  cabinet(p) {                                                                              // a dresser: doors, drawers and something on top
    const h = p.h || 56, w = p.x1 - p.x0, top = p.y1 - h;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(p.x0 + 3, p.y1 - 2, w, 5);
    ctx.fillStyle = '#6a4426'; ctx.fillRect(p.x0, top, w, h); ctx.fillStyle = '#8a5c34'; ctx.fillRect(p.x0 - 2, top - 2, w + 4, 6); ctx.fillStyle = 'rgba(255,230,180,0.25)'; ctx.fillRect(p.x0 - 2, top - 2, w + 4, 1.5);
    ctx.fillStyle = '#5a3a22'; ctx.fillRect(p.x0 + 4, top + 8, w - 8, h - 16); ctx.strokeStyle = '#3a220f'; ctx.lineWidth = 1; ctx.strokeRect(p.x0 + 4.5, top + 8.5, w - 9, h - 17); ctx.beginPath(); ctx.moveTo(p.x0 + w / 2, top + 8); ctx.lineTo(p.x0 + w / 2, top + h - 8); ctx.moveTo(p.x0 + 4, top + h * 0.45); ctx.lineTo(p.x1 - 4, top + h * 0.45); ctx.stroke();
    ctx.fillStyle = '#d9b44a'; for (const f of [0.28, 0.72]) { ctx.fillRect(p.x0 + w * f - 2, top + h * 0.27, 4, 3); ctx.fillRect(p.x0 + w * f - 2, top + h * 0.68, 4, 3); }
    ctx.fillStyle = '#4a2c18'; ctx.fillRect(p.x0 + 2, p.y1 - 6, 5, 6); ctx.fillRect(p.x1 - 7, p.y1 - 6, 5, 6);
    const mx = p.x0 + w / 2; ctx.fillStyle = '#6a8aa8'; ctx.beginPath(); ctx.ellipse(mx - w * 0.22, top - 7, 5, 6, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = '#3f7a4a'; for (const a of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.ellipse(mx - w * 0.22 + a * 6, top - 16, 2.2, 6, a, 0, 6.3); ctx.fill(); } ctx.fillStyle = '#e8dcb8'; ctx.fillRect(mx + w * 0.1, top - 6, 12, 5);
  },
  plant(p, t) {                                                                             // a potted fern
    ell(p.x, p.y + 2, p.r + 5, 4, 'rgba(0,0,0,0.24)');
    ctx.fillStyle = '#9a5a36'; ctx.beginPath(); ctx.moveTo(p.x - 8, p.y - 14); ctx.lineTo(p.x + 8, p.y - 14); ctx.lineTo(p.x + 6, p.y + 1); ctx.lineTo(p.x - 6, p.y + 1); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#b8714a'; ctx.fillRect(p.x - 9, p.y - 16, 18, 4);
    for (let i = 0; i < 7; i++) { const a = -1.3 + i * 0.43, sw = Math.sin(t * 1.3 + i) * 0.06, L = 20 + (i % 3) * 5; ctx.fillStyle = i % 2 ? '#3f8a3a' : '#4fa048'; ctx.beginPath(); ctx.ellipse(p.x + Math.sin(a + sw) * L * 0.55, p.y - 16 - Math.cos(a + sw) * L * 0.6, 3.6, L * 0.5, a + sw, 0, 6.3); ctx.fill(); }
  },
  chair(p) {                                                                                // d > 0: facing south (the back is behind it); d < 0: facing north
    const d = p.d || 1; ell(p.x, p.y + 1, 9, 3.4, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = '#4a2c18'; ctx.fillRect(p.x - 7, p.y - 7, 2.4, 8); ctx.fillRect(p.x + 4.6, p.y - 7, 2.4, 8);
    if (d > 0) { ctx.fillStyle = '#5a3a22'; ctx.fillRect(p.x - 7, p.y - 24, 14, 13); ctx.fillStyle = '#7a5230'; ctx.fillRect(p.x - 5.5, p.y - 22, 11, 3); ctx.fillRect(p.x - 5.5, p.y - 17, 11, 3); ctx.fillStyle = '#8a5c34'; ctx.fillRect(p.x - 8, p.y - 13, 16, 8); ctx.fillStyle = 'rgba(255,230,180,0.2)'; ctx.fillRect(p.x - 8, p.y - 13, 16, 1.5); }
    else { ctx.fillStyle = '#8a5c34'; ctx.fillRect(p.x - 8, p.y - 14, 16, 8); ctx.fillStyle = '#5a3a22'; ctx.fillRect(p.x - 7, p.y - 7, 14, 10); ctx.fillStyle = '#7a5230'; ctx.fillRect(p.x - 5.5, p.y - 5, 11, 2.4); ctx.fillStyle = '#4a2c18'; ctx.fillRect(p.x - 7, p.y - 7, 2.4, 10); ctx.fillRect(p.x + 4.6, p.y - 7, 2.4, 10); }
  },
  lamp(p, t) {                                                                              // a standing lamp with a warm shade
    CHV.lights.push([p.x, p.y - 44, 140, 0.8]); ell(p.x, p.y + 1, 9, 3.4, 'rgba(0,0,0,0.24)');
    ctx.fillStyle = '#3a2a1c'; ctx.fillRect(p.x - 1.5, p.y - 40, 3, 40); ctx.fillRect(p.x - 6, p.y - 3, 12, 3);
    ctx.fillStyle = '#e8c86a'; ctx.beginPath(); ctx.moveTo(p.x - 9, p.y - 38); ctx.lineTo(p.x + 9, p.y - 38); ctx.lineTo(p.x + 6, p.y - 52); ctx.lineTo(p.x - 6, p.y - 52); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(255,255,220,0.6)'; ctx.fillRect(p.x - 5, p.y - 50, 10, 10);
    if (gfx.glow) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(p.x, p.y - 44, 2, p.x, p.y - 44, 50); g.addColorStop(0, `rgba(255,200,110,${0.3 + Math.sin(t * 7 + p.x) * 0.04})`); g.addColorStop(1, 'rgba(255,170,70,0)'); ctx.fillStyle = g; ctx.fillRect(p.x - 50, p.y - 94, 100, 100); ctx.restore(); }
  },
  crate(p) {
    const w = p.x1 - p.x0, h = p.y1 - p.y0; ctx.fillStyle = 'rgba(0,0,0,0.24)'; ctx.fillRect(p.x0 + 2, p.y1 - 1, w, 4);
    ctx.fillStyle = '#8a6238'; ctx.fillRect(p.x0, p.y0 - 12, w, h + 12); ctx.fillStyle = '#a07646'; ctx.fillRect(p.x0, p.y0 - 12, w, 7); ctx.strokeStyle = '#4a2c18'; ctx.lineWidth = 1.2; ctx.strokeRect(p.x0 + 0.5, p.y0 - 11.5, w - 1, h + 11); ctx.beginPath(); ctx.moveTo(p.x0, p.y0 - 1); ctx.lineTo(p.x1, p.y0 - 1); ctx.moveTo(p.x0 + 2, p.y0 - 11); ctx.lineTo(p.x1 - 2, p.y1 - 1); ctx.stroke();
  },
  sacks(p) {
    ell(p.x, p.y + 2, 18, 5, 'rgba(0,0,0,0.24)');
    for (const [dx, dy, s] of [[-9, 0, 1], [8, 1, 0.95], [0, -9, 0.9]]) { ctx.fillStyle = '#c9b48a'; ctx.beginPath(); ctx.ellipse(p.x + dx, p.y + dy - 7 * s, 10 * s, 9 * s, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(p.x + dx + 3, p.y + dy - 6 * s, 6 * s, 8 * s, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = '#7a5a2a'; ctx.fillRect(p.x + dx - 3, p.y + dy - 16 * s, 6, 2.4); }
  },
  globe(p) {
    ell(p.x, p.y + 1, 11, 4, 'rgba(0,0,0,0.24)'); ctx.fillStyle = '#4a2c18'; ctx.fillRect(p.x - 1.5, p.y - 14, 3, 14); ctx.fillRect(p.x - 8, p.y - 3, 16, 3);
    ctx.fillStyle = '#3a6a9a'; ctx.beginPath(); ctx.arc(p.x, p.y - 26, 12, 0, 6.3); ctx.fill(); ctx.fillStyle = '#6a9a4a'; ctx.beginPath(); ctx.ellipse(p.x - 3, p.y - 28, 5, 6, 0.4, 0, 6.3); ctx.ellipse(p.x + 5, p.y - 23, 4, 3, 0, 0, 6.3); ctx.fill();
    ctx.strokeStyle = '#d9b44a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(p.x, p.y - 26, 14, Math.PI * 0.8, Math.PI * 2.2); ctx.stroke();
  },
  mugs(p) {                                                                                 // things on a table top
    const k = p.v || 0; ctx.fillStyle = '#b8b2a2';
    if (k === 0) { for (const dx of [0, 14]) { ctx.fillStyle = '#c9a86a'; ctx.fillRect(p.x0 + dx, p.y0 - 7, 6, 7); ctx.fillStyle = '#f0e6c0'; ctx.fillRect(p.x0 + dx, p.y0 - 7, 6, 2); ctx.strokeStyle = '#c9a86a'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(p.x0 + dx + 7, p.y0 - 4, 2.2, -1.5, 1.5); ctx.stroke(); } ctx.fillStyle = '#d9b36a'; ctx.beginPath(); ctx.ellipse(p.x0 + 32, p.y0 - 2, 8, 3.6, 0, 0, 6.3); ctx.fill(); }
    else if (k === 1) { ctx.fillStyle = '#e8dcb8'; ctx.fillRect(p.x0, p.y0 - 4, 22, 5); ctx.fillStyle = '#c0392b'; ctx.fillRect(p.x0 + 4, p.y0 - 6, 4, 3); ctx.strokeStyle = '#a07a4a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x0 + 3, p.y0 - 2); ctx.quadraticCurveTo(p.x0 + 11, p.y0 - 7, p.x0 + 19, p.y0 - 1); ctx.stroke(); }
    else { ctx.fillStyle = '#d8d0b8'; ctx.beginPath(); ctx.ellipse(p.x0 + 8, p.y0 - 2, 9, 3.6, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = '#b8794a'; ctx.beginPath(); ctx.ellipse(p.x0 + 8, p.y0 - 3.5, 6, 2.6, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = '#7a4a2a'; ctx.fillRect(p.x0 + 20, p.y0 - 8, 5, 8); }
  },
  chandelier(p, t) {                                                                        // hangs from the ceiling: drawn last, high above the floor point p.fy
    const x = p.x, y = p.fy - 96; CHV.lights.push([x, p.fy - 40, 280, 1]);
    ctx.strokeStyle = '#4a3f33'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, y - 40); ctx.lineTo(x, y); ctx.stroke();
    ctx.strokeStyle = '#6a5a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, 30, 9, 0, 0, 6.3); ctx.stroke(); ctx.strokeStyle = '#d9b44a'; ctx.lineWidth = 1; ctx.stroke();
    for (let i = 0; i < 6; i++) { const a = i * 1.047, cx = x + Math.cos(a) * 30, cy = y + Math.sin(a) * 9, fl = 1 + Math.sin(t * 9 + i * 1.7) * 0.2; ctx.fillStyle = '#efe6c8'; ctx.fillRect(cx - 1.6, cy - 8, 3.2, 8); ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.ellipse(cx, cy - 11, 2, 3.8 * fl, 0, 0, 6.3); ctx.fill(); }
    if (gfx.glow) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y, 4, x, y, 90); g.addColorStop(0, 'rgba(255,200,110,0.32)'); g.addColorStop(1, 'rgba(255,170,70,0)'); ctx.fillStyle = g; ctx.fillRect(x - 90, y - 90, 180, 180); ctx.restore(); }
  },
  stairs(p, t, v) {                                                                          // a flight of steps: treads and risers, side boards, a banister, a landing and an arrow
    const w = p.x1 - p.x0, h = p.y1 - p.y0, n = 8, sh = h / n, down = v && v.cFloor === 1 && v.cKind !== 'church' ? true : (v && v.cKind === 'church' && v.cFloor === 1);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(p.x0 - 2, p.y1 - 1, w + 8, 7);
    ctx.fillStyle = '#9a7a52'; ctx.fillRect(p.x0 - 6, p.y1, w + 12, 9); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(p.x0 - 6, p.y1 + 8, w + 12, 1.5);          // the landing mat
    ctx.fillStyle = '#2a1a0e'; ctx.fillRect(p.x0, p.y0 - 4, w, h + 4);                                                                                         // under the stair
    for (let i = 0; i < n; i++) {
      const y = p.y0 + i * sh, dk = down ? (n - 1 - i) / n : i / n;
      const tread = down ? `rgb(${Math.round(150 - dk * 90)},${Math.round(104 - dk * 62)},${Math.round(62 - dk * 36)})` : `rgb(${Math.round(160 - dk * 24)},${Math.round(112 - dk * 16)},${Math.round(68 - dk * 10)})`;
      if (!down) { ctx.fillStyle = tread; ctx.fillRect(p.x0 + 4, y, w - 8, sh - 4); ctx.fillStyle = '#5a3a20'; ctx.fillRect(p.x0 + 4, y + sh - 4, w - 8, 4); ctx.fillStyle = 'rgba(255,230,180,0.35)'; ctx.fillRect(p.x0 + 4, y, w - 8, 1.6); ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(p.x0 + 4, y + sh - 6, w - 8, 2); }
      else { ctx.fillStyle = tread; ctx.fillRect(p.x0 + 4, y + 3, w - 8, sh - 3); ctx.fillStyle = 'rgba(255,230,180,0.25)'; ctx.fillRect(p.x0 + 4, y + 3, w - 8, 1.4); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(p.x0 + 4, y + 2, w - 8, 2); }
    }
    ctx.fillStyle = '#4a2c18'; ctx.fillRect(p.x0, p.y0 - 4, 5, h + 6); ctx.fillRect(p.x1 - 5, p.y0 - 4, 5, h + 6);                                              // the side boards
    ctx.fillStyle = '#6a4426'; ctx.fillRect(p.x0, p.y0 - 4, 2, h + 6); ctx.fillRect(p.x1 - 5, p.y0 - 4, 2, h + 6);
    const rail = x => { ctx.fillStyle = '#5a3a22'; ctx.fillRect(x - 1.6, p.y0 - 28, 3.2, h + 30); ctx.fillStyle = '#7a5230'; ctx.fillRect(x - 3, p.y0 - 30, 6, 4); ctx.fillRect(x - 3, p.y1 - 4, 6, 4); ctx.fillStyle = '#d9b44a'; ctx.beginPath(); ctx.arc(x, p.y0 - 31, 3, 0, 6.3); ctx.fill(); ctx.fillStyle = '#8a6038'; for (let yy = p.y0 + 4; yy < p.y1 - 6; yy += 9) ctx.fillRect(x - 0.8, yy - 12, 1.6, 16); };
    rail(p.x0 + 2); rail(p.x1 - 2);                                                                                                                              // the banister
    const cx = (p.x0 + p.x1) / 2, cy = p.y0 + h * 0.5, a = 7 + Math.sin(t * 4) * 1; ctx.fillStyle = '#f5c451'; ctx.strokeStyle = '#7a5a10'; ctx.lineWidth = 1.2; ctx.beginPath();
    if (down) { ctx.moveTo(cx - a, cy - 3); ctx.lineTo(cx + a, cy - 3); ctx.lineTo(cx, cy + a); } else { ctx.moveTo(cx - a, cy + 4); ctx.lineTo(cx + a, cy + 4); ctx.lineTo(cx, cy - a + 1); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    if (down) { const g = ctx.createLinearGradient(0, p.y0 - 4, 0, p.y0 + h * 0.4); g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(p.x0 + 4, p.y0 - 4, w - 8, h * 0.45); }
  },
  haybale(p) { ell(p.x, p.y + 2, 20, 5, 'rgba(0,0,0,0.24)'); ctx.fillStyle = '#d4b45a'; ctx.fillRect(p.x - 16, p.y - 16, 32, 17); ctx.fillStyle = '#e8cc7a'; ctx.fillRect(p.x - 16, p.y - 16, 32, 5); ctx.strokeStyle = '#8a6a22'; ctx.lineWidth = 1.2; for (const dx of [-8, 8]) { ctx.beginPath(); ctx.moveTo(p.x + dx, p.y - 16); ctx.lineTo(p.x + dx, p.y + 1); ctx.stroke(); } ctx.strokeStyle = 'rgba(138,106,34,0.6)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(p.x - 14 + i * 6, p.y - 14); ctx.lineTo(p.x - 11 + i * 6, p.y - 4); ctx.stroke(); } },
  target(p) {                                                                               // an archery target on a stand
    ell(p.x, p.y + 2, 12, 4, 'rgba(0,0,0,0.24)'); ctx.fillStyle = '#5a3a22'; ctx.fillRect(p.x - 10, p.y - 18, 3, 20); ctx.fillRect(p.x + 7, p.y - 18, 3, 20);
    for (const [r, c] of [[17, '#e8e0c8'], [13, '#c0392b'], [9, '#e8e0c8'], [5, '#c0392b'], [2, '#d9b44a']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(p.x, p.y - 30, r, 0, 6.3); ctx.fill(); }
    ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 1.4; for (const [dx, dy] of [[3, -33], [-4, -28]]) { ctx.beginPath(); ctx.moveTo(p.x + dx, p.y + dy); ctx.lineTo(p.x + dx + 9, p.y + dy - 6); ctx.stroke(); }
  },
};
function chRug(x0, y0, x1, y1, c1, c2, pat = 'diamond') {                                   // a woven rug with a border, fringe and a pattern
  const w = x1 - x0, h = y1 - y0; ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x0 + 3, y0 + 3, w, h);
  ctx.fillStyle = c1; ctx.fillRect(x0, y0, w, h); ctx.strokeStyle = c2; ctx.lineWidth = 3; ctx.strokeRect(x0 + 5, y0 + 5, w - 10, h - 10); ctx.lineWidth = 1; ctx.strokeRect(x0 + 10, y0 + 10, w - 20, h - 20);
  ctx.fillStyle = c2;
  if (pat === 'diamond') for (let x = x0 + 22; x < x1 - 14; x += 22) { ctx.beginPath(); ctx.moveTo(x, y0 + h / 2 - 6); ctx.lineTo(x + 6, y0 + h / 2); ctx.lineTo(x, y0 + h / 2 + 6); ctx.lineTo(x - 6, y0 + h / 2); ctx.closePath(); ctx.fill(); }
  else if (pat === 'round') { ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.ellipse(x0 + w / 2, y0 + h / 2, w * 0.28, h * 0.28, 0, 0, 6.3); ctx.fill(); ctx.globalAlpha = 1; }
  ctx.strokeStyle = c2; ctx.lineWidth = 1; for (let x = x0 + 2; x < x1; x += 4) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 - 4); ctx.moveTo(x, y1); ctx.lineTo(x, y1 + 4); ctx.stroke(); }
}
function chTapestry(x, y, w, h, c1, c2) {                                                    // a hanging cloth on the wall
  ctx.fillStyle = '#4a2c18'; ctx.fillRect(x - 3, y - 4, w + 6, 4); ctx.fillStyle = c1; ctx.fillRect(x, y, w, h); ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + w / 2, y + h - 8); ctx.lineTo(x + w, y + h); ctx.fill();
  ctx.fillStyle = c2; ctx.fillRect(x, y, w, 3); ctx.fillRect(x + 4, y + 7, w - 8, 2); ctx.beginPath(); ctx.moveTo(x + w / 2, y + 14); ctx.lineTo(x + w / 2 + 9, y + 26); ctx.lineTo(x + w / 2, y + 38); ctx.lineTo(x + w / 2 - 9, y + 26); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d9b44a'; for (const dx of [-3, w + 3]) { ctx.beginPath(); ctx.arc(x + dx, y - 2, 2.5, 0, 6.3); ctx.fill(); }
}
function chShield(x, y, c = '#2f4a7a') {                                                     // a shield with two crossed swords behind it
  ctx.strokeStyle = '#c9ced6'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 22, y - 16); ctx.lineTo(x + 22, y + 24); ctx.moveTo(x + 22, y - 16); ctx.lineTo(x - 22, y + 24); ctx.stroke(); ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 16, y - 8); ctx.lineTo(x - 22, y - 2); ctx.moveTo(x + 16, y - 8); ctx.lineTo(x + 22, y - 2); ctx.stroke();
  ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - 13, y - 14); ctx.lineTo(x + 13, y - 14); ctx.lineTo(x + 13, y + 6); ctx.quadraticCurveTo(x + 13, y + 20, x, y + 25); ctx.quadraticCurveTo(x - 13, y + 20, x - 13, y + 6); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#d9b44a'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#d9b44a'; ctx.fillRect(x - 1.5, y - 10, 3, 28); ctx.fillRect(x - 8, y - 2, 16, 3);
}
function chAntlers(x, y) {                                                                   // a trophy: a wooden plaque with antlers
  ctx.fillStyle = '#5a3a22'; ctx.beginPath(); ctx.ellipse(x, y + 8, 12, 14, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = '#7a5230'; ctx.beginPath(); ctx.ellipse(x, y + 7, 9, 11, 0, 0, 6.3); ctx.fill();
  ctx.strokeStyle = '#d8d0b8'; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * 4, y - 2); ctx.quadraticCurveTo(x + s * 18, y - 6, x + s * 24, y - 22); ctx.moveTo(x + s * 14, y - 6); ctx.lineTo(x + s * 18, y - 20); ctx.moveTo(x + s * 19, y - 11); ctx.lineTo(x + s * 29, y - 12); ctx.stroke(); } ctx.lineCap = 'butt';
}
function chPicture(x, y, w, h, k) {                                                          // a framed painting: a landscape, a ship or a portrait
  ctx.fillStyle = '#d9b44a'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6); ctx.fillStyle = '#4a2c18'; ctx.fillRect(x - 1.5, y - 1.5, w + 3, h + 3);
  const sky = ['#8ab8d8', '#a8c8d8', '#d8a878'][k % 3]; ctx.fillStyle = sky; ctx.fillRect(x, y, w, h);
  if (k % 3 === 0) { ctx.fillStyle = '#5a8a4a'; ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + h * 0.6); ctx.quadraticCurveTo(x + w * 0.3, y + h * 0.35, x + w * 0.55, y + h * 0.62); ctx.quadraticCurveTo(x + w * 0.8, y + h * 0.45, x + w, y + h * 0.58); ctx.lineTo(x + w, y + h); ctx.fill(); ctx.fillStyle = '#f6e27a'; ctx.beginPath(); ctx.arc(x + w * 0.78, y + h * 0.25, 4, 0, 6.3); ctx.fill(); }
  else if (k % 3 === 1) { ctx.fillStyle = '#3a6a9a'; ctx.fillRect(x, y + h * 0.62, w, h * 0.38); ctx.fillStyle = '#5a3a22'; ctx.fillRect(x + w * 0.3, y + h * 0.5, w * 0.4, 5); ctx.fillStyle = '#efe6c8'; ctx.beginPath(); ctx.moveTo(x + w * 0.5, y + h * 0.15); ctx.lineTo(x + w * 0.5, y + h * 0.5); ctx.lineTo(x + w * 0.72, y + h * 0.5); ctx.closePath(); ctx.fill(); }
  else { ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#d8b898'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h * 0.4, w * 0.2, h * 0.24, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = '#7a2a3a'; ctx.fillRect(x + w * 0.22, y + h * 0.66, w * 0.56, h * 0.34); }
}
function chClock(x, y, t) {                                                                  // a round wall clock with a swinging pendulum
  ctx.fillStyle = '#5a3a22'; ctx.beginPath(); ctx.arc(x, y, 15, 0, 6.3); ctx.fill(); ctx.fillStyle = '#efe6c8'; ctx.beginPath(); ctx.arc(x, y, 12, 0, 6.3); ctx.fill(); ctx.strokeStyle = '#2a1a0e'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 8); ctx.moveTo(x, y); ctx.lineTo(x + 5, y + 2); ctx.stroke();
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; ctx.fillRect(x + Math.sin(a) * 10 - 0.5, y - Math.cos(a) * 10 - 0.5, 1.2, 1.2); }
  const sw = Math.sin(t * 2.6) * 6; ctx.strokeStyle = '#8a6a2a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x, y + 15); ctx.lineTo(x + sw, y + 34); ctx.stroke(); ctx.fillStyle = '#d9b44a'; ctx.beginPath(); ctx.arc(x + sw, y + 36, 3.6, 0, 6.3); ctx.fill();
}
function chHerbs(x, y) {                                                                     // bundles of herbs and garlic hung up to dry
  ctx.strokeStyle = '#4a2c18'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 22, y); ctx.lineTo(x + 22, y); ctx.stroke();
  for (const [dx, c] of [[-16, '#6a8a3a'], [-5, '#e8e0c8'], [6, '#8a6a3a'], [17, '#6a8a3a']]) { ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + dx, y); ctx.lineTo(x + dx, y + 6); ctx.stroke(); ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x + dx - 5, y + 6); ctx.lineTo(x + dx + 5, y + 6); ctx.lineTo(x + dx + 2, y + 20); ctx.lineTo(x + dx - 2, y + 20); ctx.closePath(); ctx.fill(); }
}
function chChimney(x0, y0, x1, y1) {                                                         // the stone chimney breast above a hearth
  ctx.fillStyle = '#6a625a'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
  for (let y = y0 + 9, r = 0; y < y1; y += 9, r++) { ctx.beginPath(); ctx.moveTo(x0, y + 0.5); ctx.lineTo(x1, y + 0.5); ctx.stroke(); for (let x = x0 + (r % 2) * 12; x < x1; x += 24) { ctx.beginPath(); ctx.moveTo(x + 0.5, y - 9); ctx.lineTo(x + 0.5, y); ctx.stroke(); } }
  ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(x0, y0, 5, y1 - y0); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x1 - 6, y0, 6, y1 - y0);
}


// ---------------------------------------------------------------- doors that swing open as you walk through, and an exit you cannot miss
function chDoorList(v, fl) {
  if (v.cKind === 'church') return [...CH_ARCH.map(a => ({ k: 'ns', x0: a[0], x1: a[2], yb: 600, dbl: true })), { k: 'ew', x: 407, y0: 454, y1: 516, dir: 1 }, { k: 'ew', x: 1033, y0: 454, y1: 516, dir: -1 }];
  if (v.cKind === 'inn') return fl === 0 ? [{ k: 'ew', x: 1130, y0: 474, y1: 528, dir: 1 }] : INN_ROOMS.map(x => ({ k: 'ns', x0: x + 110, x1: x + 150, yb: 470, h: 'L' }));
  return [{ k: 'ew', x: 315, y0: 494, y1: 546, dir: -1 }, { k: 'ew', x: 1130, y0: 494, y1: 546, dir: 1 }];
}
function chDoorThings(v, fl, things) {
  const list = chDoorList(v, fl), st = v.cdoor || (v.cdoor = {}), key = v.cKind + fl, arr = st[key] || (st[key] = list.map(() => ({ o: 0 })));
  const dt = Math.min(0.1, Math.max(0, v.t - (st.t === undefined ? v.t : st.t))); st.t = v.t; const folk = churchFolkOf(v);
  list.forEach((d, i) => {
    const cx = d.k === 'ns' ? (d.x0 + d.x1) / 2 : d.x, cy = d.k === 'ns' ? d.yb - 20 : (d.y0 + d.y1) / 2, S = arr[i];
    const near = Math.hypot(hero.x - cx, hero.y - cy) < (d.dbl ? 78 : 62) || folk.some(n => Math.hypot(n.x - cx, n.y - cy) < 56);
    S.o += ((near ? 1 : 0) - S.o) * Math.min(1, dt * 9);
    things.push({ y: d.k === 'ns' ? d.yb : cy + 14, d: () => chDrawDoor(d, S.o) });
  });
}
function chDrawDoor(d, o) {
  const wood = '#7a5230', dark = '#4a2c18';
  if (d.k === 'ns') {
    const w = d.x1 - d.x0, yb = d.yb, H = d.dbl ? 90 : 80, ph = Math.max(0.12, Math.cos(o * 1.45));
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(d.x0 - 4, yb - 1, w + 8, 6);
    ctx.fillStyle = '#9a8c70'; ctx.fillRect(d.x0 - 6, yb, w + 12, 4);
    ctx.fillStyle = dark; ctx.fillRect(d.x0 - 6, yb - H - 6, 7, H + 8); ctx.fillRect(d.x1 - 1, yb - H - 6, 7, H + 8); ctx.fillRect(d.x0 - 6, yb - H - 8, w + 12, 9);
    ctx.fillStyle = 'rgba(255,220,160,0.25)'; ctx.fillRect(d.x0 - 6, yb - H - 8, w + 12, 2);
    const leaf = (xh, sgn, ww) => {
      const x0 = sgn > 0 ? xh : xh - ww, top = yb - H, skew = (1 - ph) * 5;
      ctx.fillStyle = wood; ctx.beginPath(); ctx.moveTo(sgn > 0 ? x0 : x0 + ww, top); ctx.lineTo(sgn > 0 ? x0 + ww : x0, top + skew); ctx.lineTo(sgn > 0 ? x0 + ww : x0, yb - skew); ctx.lineTo(sgn > 0 ? x0 : x0 + ww, yb); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(30,14,4,0.5)'; ctx.lineWidth = 1; for (let xx = x0 + 6; xx < x0 + ww; xx += 7) { ctx.beginPath(); ctx.moveTo(xx, top); ctx.lineTo(xx, yb); ctx.stroke(); }
      ctx.fillStyle = '#3a3a42'; ctx.fillRect(x0, top + 14, ww, 4); ctx.fillRect(x0, yb - 24, ww, 4); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x0, top, ww, 2); ctx.restore();
      ctx.fillStyle = '#d9b44a'; ctx.beginPath(); ctx.arc(sgn > 0 ? x0 + ww - 4 : x0 + 4, top + H * 0.55, 2.4, 0, 6.3); ctx.fill();
    };
    if (d.dbl) { leaf(d.x0, 1, w / 2 * ph); leaf(d.x1, -1, w / 2 * ph); } else if (d.h === 'R') leaf(d.x1, -1, w * ph); else leaf(d.x0, 1, w * ph);
  } else {
    const y0 = d.y0, y1 = d.y1, x = d.x, L = y1 - y0 - 4, phi = o * 1.45, H = 76, px = x, py = y0 + 2, tx = x + d.dir * L * Math.sin(phi), ty = py + L * Math.cos(phi);
    ctx.fillStyle = dark; ctx.fillRect(x - 4, y0 - H - 4, 8, H + 6); ctx.fillRect(x - 4, y1 - H - 2, 8, H + 6); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - 6, y1 + 1, 12, 4);
    ctx.fillStyle = wood; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty); ctx.lineTo(tx, ty - H); ctx.lineTo(px, py - H); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(30,14,4,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = 'rgba(30,14,4,0.4)'; ctx.lineWidth = 1; for (let i = 1; i < 5; i++) { const t = i / 5; ctx.beginPath(); ctx.moveTo(px + (tx - px) * t, py + (ty - py) * t); ctx.lineTo(px + (tx - px) * t, py + (ty - py) * t - H); ctx.stroke(); }
    ctx.strokeStyle = '#3a3a42'; ctx.lineWidth = 3; for (const hh of [18, H - 16]) { ctx.beginPath(); ctx.moveTo(px, py - hh); ctx.lineTo(tx, ty - hh); ctx.stroke(); }
    ctx.fillStyle = '#d9b44a'; ctx.beginPath(); ctx.arc(px + (tx - px) * 0.86, py + (ty - py) * 0.86 - H * 0.5, 2.4, 0, 6.3); ctx.fill();
  }
}
function chExitSpill(x, y) {                                                                  // daylight from the door on the floor, a mat, and the open leaves of the great door
  const g = ctx.createRadialGradient(x, y + 24, 6, x, y + 24, 190); g.addColorStop(0, 'rgba(255,246,210,0.55)'); g.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = g; ctx.fillRect(x - 190, y - 170, 380, 230);
  ctx.fillStyle = '#6a3a2a'; ctx.fillRect(x - 40, y - 2, 80, 22); ctx.strokeStyle = '#d9b44a'; ctx.lineWidth = 2; ctx.strokeRect(x - 38, y, 76, 18); ctx.fillStyle = 'rgba(255,255,255,0.18)'; for (let i = -3; i <= 3; i++) ctx.fillRect(x + i * 10 - 1, y + 3, 2, 12);
  ctx.fillStyle = '#9a8c70'; ctx.fillRect(x - 56, y + 20, 112, 6); ctx.fillStyle = '#d9d0b8'; ctx.fillRect(x - 56, y + 20, 112, 2);
  for (const sd of [-1, 1]) { ctx.fillStyle = '#7a5230'; ctx.beginPath(); ctx.moveTo(x + sd * 52, y + 22); ctx.lineTo(x + sd * 70, y + 14); ctx.lineTo(x + sd * 70, y - 62); ctx.lineTo(x + sd * 52, y - 52); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#3a220f'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.strokeStyle = 'rgba(30,14,4,0.4)'; for (let i = 1; i < 3; i++) { const t = i / 3; ctx.beginPath(); ctx.moveTo(x + sd * (52 + 18 * t), y + 22 - 8 * t); ctx.lineTo(x + sd * (52 + 18 * t), y - 52 - 10 * t); ctx.stroke(); } }
}
Object.assign(CH_DECOR, {
  exitsign(p, t) {                                                                            // a signboard on two posts with a pulsing arrow towards the door
    CHV.lights.push([p.x, p.y + 30, 170, 0.9]); ell(p.x, p.y + 2, 30, 5, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(p.x - 26, p.y - 40, 4, 42); ctx.fillRect(p.x + 22, p.y - 40, 4, 42);
    ctx.fillStyle = '#4a2c18'; ctx.fillRect(p.x - 34, p.y - 66, 68, 28); ctx.strokeStyle = '#d9b44a'; ctx.lineWidth = 2; ctx.strokeRect(p.x - 32, p.y - 64, 64, 24);
    ctx.fillStyle = '#f5c451'; ctx.font = 'bold 15px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('EXIT', p.x - 6, p.y - 46); ctx.textAlign = 'start';
    const a = 1 + Math.sin(t * 5) * 0.12; ctx.beginPath(); ctx.moveTo(p.x + 14, p.y - 56); ctx.lineTo(p.x + 26, p.y - 56); ctx.lineTo(p.x + 20, p.y - 44 * a + 4); ctx.closePath(); ctx.fill();
    if (gfx.glow) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(p.x, p.y - 52, 4, p.x, p.y - 52, 60); g.addColorStop(0, 'rgba(255,200,90,0.25)'); g.addColorStop(1, 'rgba(255,180,60,0)'); ctx.fillStyle = g; ctx.fillRect(p.x - 60, p.y - 112, 120, 120); ctx.restore(); }
  },
});

// ---------------------------------------------------------------- what you can see: a field of view from where you stand, blocked by the walls; everything else is dark and blurred
function fovPoly(ox, oy, solids, R = 760, face = 40) {                                 // the shape of what is in line of sight from (ox, oy): rays against boxes and round pillars
  const rects = [], rounds = [];
  for (const w of solids) {
    if (w.r !== undefined) { if (Math.hypot(w.x - ox, w.y - oy) < R + w.r) rounds.push(w); }
    else if (!(w.x0 > ox + R || w.x1 < ox - R || w.y0 > oy + R || w.y1 < oy - R)) rects.push(w);
  }
  const ang = [], TAU = 6.2832, norm = a => (a % TAU + TAU) % TAU;
  for (let a = 0; a < TAU; a += 0.025) ang.push(a);
  for (const w of rects) for (const cx of [w.x0, w.x1]) for (const cy of [w.y0, w.y1]) { const dx = cx - ox, dy = cy - oy; if (dx * dx + dy * dy < R * R) { const a = norm(Math.atan2(dy, dx)); ang.push(a - 0.0007, a, a + 0.0007); } }
  for (const c of rounds) { const dx = c.x - ox, dy = c.y - oy, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx), w = Math.asin(Math.min(0.99, c.r / Math.max(d, c.r + 1))); for (const k of [-w, w]) { const q = norm(a + k); ang.push(q - 0.0007, q + 0.0007); } }
  ang.sort((a, b) => a - b);
  const pts = [];
  for (const a of ang) {
    const dx = Math.cos(a), dy = Math.sin(a); let best = R, lift = 0;
    for (const w of rects) {
      let t0 = 0, t1 = best;
      if (Math.abs(dx) < 1e-9) { if (ox < w.x0 || ox > w.x1) continue; } else { let ta = (w.x0 - ox) / dx, tb = (w.x1 - ox) / dx; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); }
      if (Math.abs(dy) < 1e-9) { if (oy < w.y0 || oy > w.y1) continue; } else { let ta = (w.y0 - oy) / dy, tb = (w.y1 - oy) / dy; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); }
      if (t0 <= t1 && t0 < best && t0 > 0.001) { best = t0; lift = dy < 0 && Math.abs(oy + dy * t0 - w.y1) < 0.8 ? (w.y1 - w.y0 >= 40 ? (w.face || face) : w.y1 - w.y0) : 0; }          // hit the south side of a wall: its face stands above the hit
    }
    for (const c of rounds) { const fx = ox - c.x, fy = oy - c.y, b = fx * dx + fy * dy, disc = b * b - (fx * fx + fy * fy - c.r * c.r); if (disc > 0) { const t = -b - Math.sqrt(disc); if (t > 0.001 && t < best) { best = t; lift = dy < 0 ? face * 1.3 : 0; } } }
    const hit = best < R;
    pts.push([ox + dx * (best + (hit ? 3 : 0)), oy + dy * (best + (hit ? 3 : 0)) - (hit ? lift : 0)]);
  }
  return pts;
}
const chFov = (fl, ox, oy, R = 760) => fovPoly(ox, oy, vil.cfl[fl].walls, R, CH_WALLH);
const CHV = { walls: [], A: null, B: null, C: null, lights: [], wins: [] };
const CH_GLASS = ['200,225,255', '200,225,255', '200,225,255', '200,225,255'], CH_NAVE_WINS = [[510, 310, 0], [720, 316, 1], [930, 310, 2]];
const CHV_RECTS = fl => chWalls(CH_WALK[fl]);
function chInPoly(pts, x, y) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
function chLighting(v, fl) {
  const cv = ctx.canvas, W = cv.width, H = cv.height, mk = k => { let c = CHV[k]; if (!c || c.width !== W || c.height !== H) { c = CHV[k] = document.createElement('canvas'); c.width = W; c.height = H; } return c; };
  const A = mk('A'), B = mk('B'), a = A.getContext('2d'), b = B.getContext('2d'), M = ctx.getTransform();
  a.setTransform(1, 0, 0, 1, 0, 0); a.globalCompositeOperation = 'copy'; a.filter = 'none'; a.drawImage(cv, 0, 0); a.globalCompositeOperation = 'source-over';
  const hx = hero.x, hy = hero.y - 6, pts = chFov(fl, hx, hy);
  b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'source-over'; b.clearRect(0, 0, W, H);
  b.setTransform(M); b.filter = 'blur(9px)'; b.fillStyle = '#fff'; b.beginPath(); pts.forEach(([x, y], i) => i ? b.lineTo(x, y) : b.moveTo(x, y)); b.closePath(); b.fill(); b.filter = 'none';
  { const g = b.createRadialGradient(hx, hy, 120, hx, hy, 700); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0.7)'); b.globalCompositeOperation = 'destination-in'; b.fillStyle = g; b.fillRect(hx - 720, hy - 720, 1440, 1440); b.globalCompositeOperation = 'source-over'; }          // far corners of a room you can see are a little dimmer
  b.setTransform(1, 0, 0, 1, 0, 0);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = 'blur(2px) brightness(0.46) saturate(0.7)'; ctx.drawImage(A, 0, 0); ctx.filter = 'none'; ctx.restore();       // what is out of sight: almost black
  a.globalCompositeOperation = 'destination-in'; a.drawImage(B, 0, 0); a.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(A, 0, 0); ctx.restore();
  // night: the rooms are dark except round the flames (the windows give the light by day)
  const dark = Math.min(1, Math.max(0, (night01() - 0.2) / 0.6));
  if (dark > 0.02) {
    const C = mk('C'), c = C.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, W, H);
    c.setTransform(M); c.fillStyle = `rgba(4,5,16,${0.84 * dark})`; c.fillRect(CHB.x0, CHB.y0, CHB.x1 - CHB.x0, CHB.y1 - CHB.y0);
    c.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, k) => { const g = c.createRadialGradient(x, y, r * 0.1, x, y, r); g.addColorStop(0, `rgba(0,0,0,${k})`); g.addColorStop(0.3, `rgba(0,0,0,${k * 0.82})`); g.addColorStop(0.6, `rgba(0,0,0,${k * 0.38})`); g.addColorStop(0.85, `rgba(0,0,0,${k * 0.1})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); };
    hole(hx, hy - 24, 260 + (hero.lightBonus || 0) * 0.6, 0.95);
    for (const [x, y, r, k] of CHV.lights) hole(x, y, r, k);
    if (v.cKind === 'church') { if (fl === 0) for (const w of CH_NAVE_WINS) CHV.wins.push(w);
    if (fl === 1) { CHV.wins.push([265, 360, 2], [1175, 360, 1]); } }
    for (const [x, y] of CHV.wins) hole(x, y, 90, 0.3);                                                  // moonlight (and starlight) through the coloured glass
    if (fl === 0 && v.cKind === 'church') { hole(720, 190, 190, 0.5); hole(686, 206, 90, 0.7); hole(754, 206, 90, 0.7); hole(265, 440, 190, 0.5); }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(C, 0, 0); ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const [x, y, k] of CHV.wins) { const c = CH_GLASS[((k % 4) + 4) % 4], g = ctx.createRadialGradient(x, y, 4, x, y, 95); g.addColorStop(0, `rgba(${c},${0.2 * dark})`); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.fillRect(x - 95, y - 95, 190, 190); } ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const [x, y, r] of CHV.lights) { const g = ctx.createRadialGradient(x, y, 2, x, y, r * 0.8); g.addColorStop(0, `rgba(255,170,80,${0.13 * dark})`); g.addColorStop(1, 'rgba(255,150,60,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); } ctx.restore();
  }
  CHV.lights.length = 0; CHV.wins.length = 0;
}
function drawChurchInside(v) {
  if (v.cKind !== 'church') return drawInnInside(v);
  const Z = VIL_ZOOM, t = v.t, fl = v.cFloor, f = v.cfl[fl], c = CHURCH;
  ctx.fillStyle = '#08080e'; ctx.fillRect(0, 0, VW, VH);
  ctx.save(); ctx.scale(Z, Z); ctx.translate(-cam.x, -cam.y);
  ctx.drawImage(chBake(v, fl), CHB.x0, CHB.y0, CHB.x1 - CHB.x0, CHB.y1 - CHB.y0);
  chRoom(fl, t); if (fl === 0) chExitSpill(CH_EXIT.x, CH_EXIT.y);
  drawChurchRoom(v, { x: c.ox, y: c.oy });
  for (const d of [CH_WALK[0][5], CH_WALK[0][6]]) { chFloorFill(d, '#c9bfa8', '#bdb39b', 10); ctx.fillStyle = '#4a3f33'; ctx.fillRect(d[0], d[1] - 3, d[2] - d[0], 3); }
  ctx.drawImage(chBake3(v, fl), CHB.x0, CHB.y0, CHB.x1 - CHB.x0, CHB.y1 - CHB.y0);                              // the tall wall faces rise over the floor behind them          // the doors in the side walls
  if (fl === 1) {                                                                         // upstairs, the nave lies below the loft: a little darker, and the loft's wooden floor over its near half
    ctx.fillStyle = 'rgba(8,6,16,0.35)'; ctx.fillRect(c.ox, c.oy, c.w, c.h);
    chPlanks(CH_WALK[1][0], '#8a6038', 'rgba(40,20,5,0.4)', 16); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(414, 514, 612, 8);
    ctx.fillStyle = '#5a3a22'; ctx.fillRect(414, 516, 612, 4); for (let x = 420; x < 1030; x += 34) ctx.fillRect(x, 504, 3, 16);                       // the rail
    ctx.fillStyle = '#7a1f2a'; ctx.fillRect(414, 354, 612, 0); ctx.fillStyle = 'rgba(122,31,42,0.9)'; ctx.fillRect(560, 436, 320, 30); ctx.fillStyle = '#d9b44a'; ctx.fillRect(560, 436, 320, 2); ctx.fillRect(560, 464, 320, 2);
  }
  const things = []; chExtThings(v, fl, things); chDoorThings(v, fl, things);
  if (fl === 0) { for (const p of c.pews) things.push({ y: p.y1, d: () => drawChurchPew(p) }); for (const p of v.cpots) things.push({ y: p.y, d: () => drawChurchPot(p, t) }); const altar = { x: c.ox + 320, y: c.oy + 128 }; things.push({ y: altar.y, d: () => drawChurchAltar(altar, t) }); }
  else for (const p of c.pews) things.push({ y: p.y1 + 400, d: () => {} });
  for (const p of f.props) things.push({ y: p.y !== undefined && p.k !== 'bell' ? p.y : p.y, d: () => drawChurchProp(p, t, v) });
  const folk = churchFolkOf(v); for (const n of folk) things.push({ y: n.y, d: () => drawVillager(n) });
  things.push({ y: hero.y, d: () => drawHero(hero) });
  things.sort((a, b) => a.y - b.y).forEach(o => o.d());
  if (fl === 0) drawChurchLight(c.ox + 320, c.oy + 38, t);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 46; i++) { const px = CHB.x0 + 60 + ((i * 197 + t * (4 + i % 5)) % (CHB.x1 - CHB.x0 - 120)), py = 330 + ((i * 89 + Math.sin(t * 0.4 + i) * 20 + t * 3) % 340); ctx.fillStyle = `rgba(255,240,200,${0.1 + 0.1 * Math.sin(t * 1.3 + i)})`; ctx.fillRect(px, py, 1.6, 1.6); }
  ctx.restore();
  if (fl === 0) for (let i = 0; i < 3; i++) { const bx = 265 + Math.sin(t * 0.5 + i * 2.1) * 90, by = 440 + Math.cos(t * 0.7 + i * 1.7) * 70 - 30, fl2 = Math.sin(t * 20 + i) * 3; ctx.fillStyle = ['#ffd24a', '#ff9acb', '#9ad0ff'][i]; ctx.beginPath(); ctx.ellipse(bx - 2, by, 3, 1.5 + Math.abs(fl2) * 0.4, 0.4, 0, 6.3); ctx.ellipse(bx + 2, by, 3, 1.5 + Math.abs(fl2) * 0.4, -0.4, 0, 6.3); ctx.fill(); }
  for (const q of v.fx) { const a = Math.max(0, Math.min(1, q.life / q.max)); ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  for (const n of folk) if (n.bubble) drawBubble(n.x, n.y - 82, n.bubble, Math.min(1, n.bubbleT * 2));
  chLighting(v, fl);
  if (v.near && !v.talk) {
    const q = v.near, ty = q.kind === 'npc' ? q.ref.y - 100 : q.y - 56, bob = Math.sin(tAnim * 5) * 2;
    ctx.save(); ctx.fillStyle = 'rgba(20,20,28,0.88)'; ctx.strokeStyle = '#f5c451'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(q.x - 11, ty - 11 + bob, 22, 22, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f5c451'; ctx.font = 'bold 14px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(keyLabel('interact'), q.x, ty + 5 + bob); ctx.restore();
  }
  ctx.restore();
  const vg = ctx.createRadialGradient(VW / 2, VH * 0.45, VH * 0.35, VW / 2, VH * 0.45, VW * 0.62); vg.addColorStop(0, 'rgba(10,6,16,0)'); vg.addColorStop(1, 'rgba(10,6,16,0.5)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  if (v.fade > 0) { ctx.fillStyle = `rgba(2,3,10,${v.fade})`; ctx.fillRect(0, 0, VW, VH); }
  drawVillageHUD(v);
  drawPopups(true);
}


// ---------------------------------------------------------------- Hilda's Inn, inside (same machinery as the church: walkable rectangles, baked walls, field-of-view lighting)
// Downstairs: the taproom (hearth, bar, tables), the entry and the kitchen. Upstairs: a corridor, four guest rooms with beds you can rest in, and a linen room.
const INN_EXIT = { x: 720, y: 968 }, INN_STAIRS = { x: 290, y: 622 }, INN_NAME = ['Hilda\'s Inn', 'Hilda\'s Inn · upper floor'], INN_ROOMS = [262, 562, 862, 1162];
const INN_WALK = [
  [[250, 380, 1110, 930], [650, 926, 790, 980], [1150, 400, 1370, 830], [1100, 470, 1160, 530]],
  [[250, 470, 1440, 560], [250, 552, 560, 860], ...INN_ROOMS.map(x => [x, 170, x + 260, 430]), ...INN_ROOMS.map(x => [x + 110, 424, x + 150, 476]), [1150, 470, 1370, 640], [1100, 490, 1160, 530]],
];
function innSolids(v) {
  const floors = [0, 1].map(i => { const walls = chWalls(INN_WALK[i]); return { walk: INN_WALK[i], walls, solids: walls.slice(), props: [] }; });
  const rect = (f, k, x0, y0, x1, y1, o = {}) => { const p = { k, x0, y0, x1, y1, y: y1, ...o }; f.props.push(p); if (!o.free) f.solids.push({ x0, y0: y0 - 2, x1, y1 }); return p; };
  const circle = (f, k, x, y, r, o = {}) => { const p = { k, x, y, r, ...o }; f.props.push(p); if (!o.free) f.solids.push({ x, y: y - 2, r }); return p; };
  const [g, u] = floors;
  rect(g, 'bar', 700, 420, 1040, 446); rect(g, 'stairs', 254, 548, 324, 610);
  for (const [x0, y0] of [[380, 500], [540, 530], [800, 520], [960, 500]]) rect(g, 'table', x0, y0, x0 + 90, y0 + 28);
  circle(g, 'barrel', 350, 404, 11); circle(g, 'barrel', 1086, 404, 11); circle(g, 'barrel', 1086, 440, 11); circle(g, 'barrel', 1166, 420, 10);
  circle(g, 'stool', 420, 428, 6, { free: true });
  rect(g, 'cabinet', 494, 382, 556, 398); rect(g, 'shelf', 612, 382, 670, 398, { v: 'bottles' }); rect(g, 'cabinet', 252, 458, 290, 484, { h: 62 });
  for (const [x, y] of [[264, 920], [1098, 920], [684, 438], [662, 906], [778, 906], [264, 400], [264, 790]]) circle(g, 'plant', x, y, 8);
  [[380, 500], [540, 530], [800, 520], [960, 500]].forEach(([x0, y0], i) => {
    circle(g, 'chair', x0 + 22, y0 - 2, 6, { free: true, d: 1 }); circle(g, 'chair', x0 + 68, y0 - 2, 6, { free: true, d: 1 }); circle(g, 'chair', x0 + 45, y0 + 44, 6, { free: true, d: -1 });
    rect(g, 'mugs', x0 + 8, y0 + 10, x0 + 60, y0 + 29, { free: true, v: i % 3 });
  });
  for (let i = 0; i < 5; i++) circle(g, 'stool', 738 + i * 66, 462, 6, { free: true });
  rect(g, 'crate', 1040, 890, 1072, 906); circle(g, 'sacks', 1086, 898, 12); circle(g, 'exitsign', INN_EXIT.x, INN_EXIT.y - 34, 0, { free: true }); circle(g, 'lamp', 1104, 760, 5); circle(g, 'lamp', 260, 520, 5); circle(g, 'lamp', 260, 780, 5);
  [[300, 760], [540, 780], [790, 770], [1000, 752]].forEach(([x0, y0], i) => {
    rect(g, 'table', x0, y0, x0 + 90, y0 + 28); circle(g, 'chair', x0 + 22, y0 - 2, 6, { free: true, d: 1 }); circle(g, 'chair', x0 + 68, y0 - 2, 6, { free: true, d: 1 }); circle(g, 'chair', x0 + 45, y0 + 44, 6, { free: true, d: -1 });
    rect(g, 'mugs', x0 + 8, y0 + 10, x0 + 60, y0 + 29, { free: true, v: (i + 1) % 3 });
  });
  rect(g, 'cabinet', 252, 690, 290, 716, { h: 62 }); circle(g, 'barrel', 268, 440, 11); circle(g, 'barrel', 268, 462, 11); circle(g, 'sacks', 290, 740, 12);
  circle(g, 'chandelier', 540, 1350, 0, { free: true, fy: 450 }); circle(g, 'chandelier', 860, 1550, 0, { free: true, fy: 650 }); circle(g, 'chandelier', 480, 1640, 0, { free: true, fy: 740 }); circle(g, 'chandelier', 900, 1830, 0, { free: true, fy: 930 });
  [[392, 640], [900, 646]].forEach(([x0, y0], i) => {
    rect(g, 'table', x0, y0, x0 + 90, y0 + 28); circle(g, 'chair', x0 + 22, y0 - 2, 6, { free: true, d: 1 }); circle(g, 'chair', x0 + 68, y0 - 2, 6, { free: true, d: 1 }); circle(g, 'chair', x0 + 45, y0 + 44, 6, { free: true, d: -1 });
    rect(g, 'mugs', x0 + 8, y0 + 10, x0 + 60, y0 + 29, { free: true, v: (i + 2) % 3 });
  });
  rect(g, 'cabinet', 1160, 622, 1224, 640, { h: 60 }); circle(g, 'barrel', 1262, 636, 11); circle(g, 'barrel', 1240, 650, 11); circle(g, 'sacks', 1176, 660, 12); circle(g, 'plant', 1274, 592, 7); rect(g, 'crate', 1210, 652, 1236, 664);
  rect(g, 'table', 1296, 560, 1360, 590); circle(g, 'chair', 1318, 558, 6, { free: true, d: 1 }); circle(g, 'chair', 1340, 604, 6, { free: true, d: -1 }); rect(g, 'cabinet', 1300, 420, 1362, 436, { h: 60 }); circle(g, 'barrel', 1344, 470, 11); circle(g, 'barrel', 1344, 494, 11); circle(g, 'sacks', 1330, 700, 12); circle(g, 'plant', 1352, 790, 7);
  rect(g, 'table', 1184, 730, 1274, 758); circle(g, 'chair', 1206, 728, 6, { free: true, d: 1 }); circle(g, 'chair', 1252, 728, 6, { free: true, d: 1 }); circle(g, 'chair', 1229, 774, 6, { free: true, d: -1 }); rect(g, 'mugs', 1192, 740, 1244, 759, { free: true, v: 2 }); circle(g, 'plant', 1274, 800, 7); circle(g, 'barrel', 1170, 802, 11); circle(g, 'barrel', 1192, 812, 11);
  rect(g, 'stove', 1190, 404, 1280, 432); rect(g, 'table', 1180, 500, 1270, 528);
  rect(u, 'stairs', 254, 548, 324, 610); rect(u, 'bench', 440, 590, 520, 604);
  for (const x of INN_ROOMS) {                                                                 // a guest room: a bed, a wardrobe, a bookcase, a chest, a writing desk, chairs, lamps and plants
    rect(u, 'bed', x + 22, 178, x + 66, 236); rect(u, 'cabinet', x + 116, 180, x + 176, 196, { h: 66 }); rect(u, 'shelf', x + 196, 176, x + 250, 192, { v: 'books', h: 80 });
    circle(u, 'lamp', x + 98, 214, 4); rect(u, 'chest', x + 22, 340, x + 58, 356);
    rect(u, 'table', x + 150, 300, x + 244, 324); circle(u, 'chair', x + 172, 298, 6, { free: true, d: 1 }); circle(u, 'chair', x + 222, 298, 6, { free: true, d: 1 }); circle(u, 'chair', x + 197, 344, 6, { free: true, d: -1 }); rect(u, 'mugs', x + 158, 311, x + 222, 325, { free: true, v: 1 });
    circle(u, 'plant', x + 246, 414, 6, { free: true }); circle(u, 'plant', x + 18, 414, 6, { free: true }); circle(u, 'chair', x + 74, 362, 6, { free: true, d: 1 }); circle(u, 'lamp', x + 246, 372, 4);
  }
  circle(u, 'plant', 540, 842, 8); circle(u, 'globe', 520, 576, 9); rect(u, 'table', 430, 640, 520, 668); circle(u, 'chair', 452, 638, 6, { free: true, d: 1 }); circle(u, 'chair', 498, 638, 6, { free: true, d: 1 }); circle(u, 'chair', 475, 684, 6, { free: true, d: -1 }); rect(u, 'mugs', 438, 650, 490, 669, { free: true, v: 0 });
  rect(u, 'cabinet', 254, 700, 292, 726, { h: 62 }); circle(u, 'plant', 266, 840, 7); circle(u, 'lamp', 548, 640, 5);
  rect(u, 'table', 300, 760, 390, 788); circle(u, 'chair', 322, 758, 6, { free: true, d: 1 }); circle(u, 'chair', 368, 758, 6, { free: true, d: 1 }); circle(u, 'chair', 345, 804, 6, { free: true, d: -1 }); rect(u, 'mugs', 308, 770, 360, 789, { free: true, v: 1 });
  rect(u, 'bench', 440, 800, 520, 814); circle(u, 'lamp', 548, 790, 5); circle(u, 'plant', 540, 700, 8);
  circle(u, 'chandelier', 400, 1160, 0, { free: true, fy: 700 }); circle(u, 'chandelier', 800, 960, 0, { free: true, fy: 500 }); circle(u, 'chandelier', 1000, 960, 0, { free: true, fy: 500 });
  for (const x of [660, 900]) { rect(u, 'bench', x, 540, x + 80, 554); circle(u, 'plant', x + 100, 548, 7); } circle(u, 'lamp', 800, 548, 5); circle(u, 'plant', 1094, 548, 7); circle(u, 'globe', 1000, 548, 8); circle(u, 'chair', 456, 574, 6, { free: true, d: -1 }); circle(u, 'chair', 488, 574, 6, { free: true, d: -1 }); circle(u, 'plant', 262, 514, 7); circle(u, 'lamp', 548, 552, 5);
  rect(u, 'chest', 1180, 480, 1220, 496); rect(u, 'cabinet', 1356, 482, 1418, 498, { h: 60 }); circle(u, 'plant', 1360, 620, 7); circle(u, 'lamp', 1330, 560, 5); circle(u, 'barrel', 1180, 548, 10); circle(u, 'barrel', 1262, 548, 10);
  v.ifl = floors;
}
function intSpots(fl, consider) {
  if (vil.cKind === 'guild') { consider('exit', null, GLD_EXIT.x, GLD_EXIT.y, 44, 'the guild', 'Leave'); consider('board', 'guild', GLD_BOARD.x, GLD_BOARD.y, 60, 'Quest board', ''); return; }
  consider('stairs', null, INN_STAIRS.x, INN_STAIRS.y, 54, fl === 0 ? 'Go upstairs' : 'Go downstairs', '');
  if (fl === 0) consider('exit', null, INN_EXIT.x, INN_EXIT.y, 44, 'the inn', 'Leave');
  else INN_ROOMS.forEach((x, i) => { const mine = vil.room && vil.room.idx === i; consider(mine ? 'bed' : 'bedlocked', null, x + 44, 262, 46, mine ? 'your bed' : INN_ROOM_NAMES[i], mine ? 'Rest and save' : 'Not yours'); });
}
function innFolk(mk) {
  const base = { inside: true, inn: true, int: 'inn', speed: 30 }, last = n => n.lastKind;
  const alt = (n, kinds) => { const k = chPick(kinds.filter(x => x !== last(n))); n.lastKind = k; return k; };
  mk('dunn', 'Dunn', 'Barkeep', 840, 404, { ...base, floor: 0, special: 'inn', look: { dress: '#7a4a2a', apron: '#f0ead8', hair: '#3a2a22', beard: '#3a2a22' }, f: 1,
    lines: ['Hilda owns the inn. I own the bar. We agreed never to discuss who owns the soup.', 'A bed, a hot meal and no questions. That is the whole menu, friend.', 'Tell me where you have been and I will tell you who else has been there.', 'The hearth never goes out. It is the one thing in here I would fight for.', 'Rest is free upstairs. Ale is not. I have a family to feed. Mostly myself.'],
    chat: ['Polish, polish...', 'What will it be?', 'Mind the floor.'],
    script: (v, n) => alt(n, ['a', 'b', 'c']) === 'b' ? [...chDo(940, 404, 'wipe', -1, [4, 7]), ...chStay(780, 404, 1, [3, 6])] : chDo(850, 404, 'wipe', 1, [5, 9]) });
  mk('pell', 'Pell', 'Bard', 420, 424, { ...base, floor: 0, look: { body: '#7a3a5a', hat: 'cap', hatColor: '#c0392b', hair: '#6a4a2a', cheek: true }, f: 1,
    lines: ['I know four hundred songs. Three hundred and ninety of them end badly.', 'The hearth has the best acoustics in the village. The bar has the best audience.', 'Ask me for a ballad about you. Then wait a few years for the ending.', 'A lute string costs more than a bowl of stew. I eat less than I tune.', 'They say the beast hates music. I intend to find out.'],
    chat: ['La la laaa...', 'Hm hm hm...', 'Now, where was the chorus?'],
    script: (v, n) => alt(n, ['sit', 'sit', 'stand']) === 'sit' ? chDo(420, 424, 'sit', 1, [20, 40]) : [...chStay(500, 460, 1, [4, 8]), ...chStay(430, 470, -1, [3, 6])] });
  mk('joss', 'Joss', 'Traveller', 425, 540, { ...base, floor: 0, look: { body: '#6a7a4a', hat: 'straw', hatColor: '#c9a86a', hair: '#7a5a3a' }, f: 1,
    lines: ['Three weeks on the road for a hot meal. Worth every blister.', 'I am heading east. Or west. The map is on the table, and so is the soup.', 'The innkeeper says the beast has been quiet lately. I do not like quiet.', 'Someone left a sword under my table. I am not telling anyone.', 'Have you tried the stew? Do not ask what is in it. Just try it.'],
    chat: ['Mm, stew...', 'Pass the bread.', 'Warm at last.'],
    script: (v, n) => alt(n, ['sit', 'sit', 'hearth']) === 'sit' ? chDo(425, 542, 'sit', 1, [18, 30]) : [...chStay(470, 460, -1, [4, 8]), ...chStay(425, 542, 1, [3, 5])] });
  mk('gus', 'Old Gus', 'Regular', 585, 574, { ...base, floor: 0, look: { body: '#5a5a7a', hat: 'beanie', hatColor: '#8a6a3a', beard: '#d0d0d0' }, f: -1,
    lines: ['I have sat at this table since before the beast. I intend to sit here after it.', 'Never trust a man who orders water. Unless he is paying.', 'Back in my day the stairs had fewer steps. Same stairs. Fewer steps.', 'The fire talks, if you listen. Mostly it says "more wood".', 'Take a seat, hero. The ale will wait. I will not.'],
    chat: ['Hrmph.', 'Ah, that is the stuff.', 'Another one, Dunn!'],
    script: (v, n) => chDo(585, 574, 'sit', -1, [20, 40]) });
  mk('brum', 'Brum', 'Cook', 1220, 452, { ...base, floor: 0, look: { body: '#f0ead8', hat: 'cap', hatColor: '#f0ead8', hair: '#5a3a22', cheek: true }, f: 1,
    lines: ['If it is brown, it is stew. If it is green, it is also stew. That is the secret.', 'Hilda wants more pepper. Dunn wants less. I want a quiet life.', 'The kitchen is no place for a sword. Take it off, hero, you are knocking pots.', 'Bread at dawn, stew at noon, soup by night. I have not changed the menu in nine years.', 'Do not touch the big pot. It has been simmering since spring.'],
    chat: ['Stir, stir...', 'Pinch of salt...', 'Needs thyme.'],
    script: (v, n) => alt(n, ['stove', 'table']) === 'stove' ? chDo(1235, 444, 'wipe', 1, [5, 9]) : chDo(1225, 540, 'wipe', 1, [4, 7]) });
  mk('rhea', 'Rhea', 'Merchant', 437, 684, { ...base, floor: 0, look: { dress: '#7a4a8a', hat: 'bun', hair: '#3a2a22', cheek: true }, f: -1,
    lines: ['Salt from the coast, spices from the south. Nobody ever asks who carried them.', 'I counted the soup bowls twice. Hilda says that is not how soup works.', 'The road is quiet but the prices are loud. Mind your gold, hero.', 'If you find a cheap sword on your travels, I will buy it. If it is not cheap, I will still look.', 'Every inn has a regular and a stranger. I am always the stranger, and I prefer it.'],
    chat: ['Hm... five, six...', 'Prices, prices...', 'A fine evening.'],
    script: (v, n) => alt(n, ['sit', 'sit', 'walk']) === 'sit' ? chDo(437, 684, 'sit', -1, [18, 32]) : [...chStay(470, 610, 1, [4, 8]), ...chStay(437, 684, -1, [3, 5])] });
  mk('tolly', 'Tolly', 'Farmhand', 945, 690, { ...base, floor: 0, look: { body: '#7a8a4a', hat: 'straw', hatColor: '#d9b86a', hair: '#8a5a2a', cheek: true }, f: 1,
    lines: ['Three days of harvest and my arms still think they are wheat.', 'The stew here is better than my mother\'s. Do not tell her. Do not tell anyone.', 'I came to town for one drink. That was two seasons ago.', 'Pell plays a song about a farmer. I did not know I was famous.', 'If you see a cow wandering the road, it is probably mine. Be kind to her.'],
    chat: ['Aaah, that is good.', 'My back...', 'One more, and then bed.'],
    script: (v, n) => chDo(945, 690, 'sit', 1, [20, 36]) });
  mk('lio', 'Lio', 'Guest', 610, 412, { ...base, floor: 1, look: { body: '#4a6a8a', hat: 'beanie', hatColor: '#c0392b', hair: '#9a6a3a', cheek: true }, f: 1,
    lines: ['This is my room for three nights. I have been here for six.', 'The bed is so soft I forgot my own name for a moment. It came back.', 'You can hear the whole taproom through the floor. Pell is flat on the high notes.', 'I said I would only stay one night. Then I saw the breakfast menu.', 'If you are tired, there is a bed in every room. Hilda says to use them.'],
    chat: ['Yawn...', 'Just five more minutes.', 'Zzz...'],
    script: (v, n) => alt(n, ['sit', 'sit', 'walk']) === 'sit' ? chDo(610, 412, 'sit', 1, [15, 28]) : [...chStay(chRnd(400, 1000), 500, 1, [4, 8]), ...chStay(chRnd(400, 1000), 500, -1, [3, 6])] });
}

function innRoom(fl, t) {
  const walk = INN_WALK[fl];
  if (fl === 0) {
    chPlanks(walk[0], '#9a7048', 'rgba(50,25,8,0.4)', 16); chFloorFill(walk[1], '#b9ae96', '#aea38b'); chFloorFill(walk[2], '#cfc6b0', '#b9ae96', 20); chPlanks(walk[3], '#9a7048', 'rgba(50,25,8,0.4)', 16);
    chRug(374, 396, 478, 448, '#7a3a2a', '#d9b44a'); chRug(364, 490, 486, 556, '#3a5a7a', '#d9b44a', 'round'); chRug(668, 936, 772, 974, '#7a2a2a', '#d9b44a'); chRug(284, 746, 410, 818, '#3a5a7a', '#d9b44a', 'round'); chRug(524, 766, 654, 834, '#7a3a2a', '#d9b44a'); chRug(774, 756, 904, 826, '#3a5a4a', '#d9b44a', 'round'); chRug(984, 738, 1114, 806, '#6a3a2a', '#d9b44a'); chRug(1170, 716, 1290, 782, '#5a4a2a', '#d9b44a'); chPicture(274, 296, 34, 26, 1); chTapestry(300, 284, 24, 44, '#2f4a7a', '#d9b44a'); chRug(376, 628, 508, 700, '#3a5a4a', '#d9b44a', 'round'); chRug(884, 634, 1014, 702, '#6a3a2a', '#d9b44a'); chRug(1166, 600, 1284, 666, '#5a4a2a', '#d9b44a'); chRug(1160, 538, 1284, 574, '#8a6a3a', '#5a3a22');
    ctx.fillStyle = '#7a2a2a'; ctx.fillRect(500, 486, 500, 124); chBorder([500, 486, 1000, 610], '#d9b44a', 3); chMedallion(750, 548, 34);
    chChimney(384, 262, 468, 334); chPicture(512, 284, 38, 28, 0); chPicture(626, 270, 30, 22, 1); chAntlers(768, 296); chShield(868, 292, '#7a1f2a'); chClock(960, 294, t); chHerbs(1030, 282); chHerbs(1182, 296); chTapestry(1252, 296, 24, 40, '#2f5a4a', '#d9b44a');
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(690, 930, 60, 22); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(690, 930, 60, 2);
    // the hearth on the back wall
    ctx.fillStyle = '#6b4a2e'; ctx.fillRect(372, 332, 108, 7); ctx.fillStyle = '#4a4038'; ctx.fillRect(378, 339, 96, 41); ctx.fillStyle = '#1a1008'; ctx.beginPath(); ctx.moveTo(390, 380); ctx.lineTo(390, 358); ctx.arc(426, 358, 36, Math.PI, 0); ctx.lineTo(462, 380); ctx.closePath(); ctx.fill();
    CHV.lights.push([426, 368, 210, 1]); const fl2 = 1 + Math.sin(t * 9) * 0.15 + Math.sin(t * 15) * 0.08;
    ctx.fillStyle = '#5a3a22'; ctx.fillRect(402, 374, 48, 5); for (const [dx, h, c] of [[-14, 14, '#e8601a'], [0, 20, '#ffa030'], [14, 13, '#e8601a'], [-4, 12, '#ffe070'], [6, 10, '#ffe070']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(426 + dx, 374 - h * fl2 / 2, 6, h * fl2 / 2, 0, 0, 6.3); ctx.fill(); }
    if (gfx.glow) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(426, 380, 4, 426, 380, 120); g.addColorStop(0, `rgba(255,150,60,${0.4 * fl2})`); g.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = g; ctx.fillRect(300, 280, 250, 250); ctx.restore(); }
    // shelves of bottles behind the bar, and the windows
    for (const y of [352, 368]) { ctx.fillStyle = '#5a3a22'; ctx.fillRect(700, y + 8, 340, 4); for (let x = 708; x < 1030; x += 14) { ctx.fillStyle = ['#3f9a5a', '#c0392b', '#d9b44a', '#3f6fd0', '#8a4fd0'][(x / 14 | 0) % 5]; ctx.fillRect(x, y - 2, 6, 10); ctx.fillRect(x + 1.5, y - 6, 3, 5); } }
    chWindow(580, 284, 0); chWindow(1075, 284, 2); chSconce(1040, 358, t); chSconce(700, 358, t);
    for (const [x, y] of [[1190, 388], [1230, 392], [1262, 388]]) { ctx.fillStyle = '#5a5a62'; ctx.beginPath(); ctx.arc(x, y, 7, 0, 6.3); ctx.fill(); ctx.fillStyle = '#3a3a42'; ctx.fillRect(x - 1, y - 14, 2, 8); }
    chWindow(1220, 304, 3); chSconce(1170, 380, t);
  } else {
    chPlanks(walk[0], '#8a6038', 'rgba(40,20,5,0.4)', 16); chRunner(260, 1430, 500); chPlanks(walk[1], '#8a6038', 'rgba(40,20,5,0.4)', 16);
    INN_ROOMS.forEach((x, i) => {
      const col = ['#7a2a2a', '#2f5a8a', '#3f7a4a', '#7a5a2a'][i];
      chPlanks([x, 170, x + 260, 430], '#a07650', 'rgba(60,30,10,0.35)'); chPlanks([x + 110, 424, x + 150, 476], '#8a6038', 'rgba(40,20,5,0.4)', 16);
      chRug(x + 36, 258, x + 224, 340, col, '#d9b44a', 'diamond'); chRug(x + 104, 420, x + 156, 440, col, '#d9b44a', 'round');
      chWindow(x + 146, 72, i); chPicture(x + 24, 84, 46, 32, i); chTapestry(x + 84, 66, 28, 56, ['#7a1f2a', '#2f4a7a', '#2f5a4a', '#6a4a2a'][i], '#d9b44a');
    });
    chPlanks(walk[10], '#8a6038', 'rgba(40,20,5,0.4)', 16); chPlanks(walk[11], '#8a6038', 'rgba(40,20,5,0.4)', 16);
    chRug(418, 556, 552, 600, '#2f5a4a', '#d9b44a', 'round'); chRug(410, 620, 536, 688, '#7a3a2a', '#d9b44a'); chRug(284, 740, 414, 820, '#2f5a4a', '#d9b44a', 'round');
    for (const x of [340, 620, 900, 1180, 1400]) chSconce(x, 452, t);
    chSconce(1220, 450, t);
  }
}
function chDoorSign(cx, y, text, mine, t) {                                              // a small sign hanging on a guest room's door from two chains; the one that is yours glows
  const w = 46, h = 13, sw = Math.sin(t * 1.3 + cx) * 0.6; ctx.save();
  if (mine) { const p = 0.5 + 0.5 * Math.sin(t * 4); ctx.fillStyle = `rgba(255,210,80,${0.18 + 0.22 * p})`; ctx.beginPath(); ctx.roundRect(cx - w / 2 - 8, y - 16, w + 16, h + 22, 8); ctx.fill(); }
  ctx.strokeStyle = '#2a1608'; ctx.lineWidth = 1.4; ctx.fillStyle = '#4a3220'; ctx.fillRect(cx - 7, y - 14, 14, 3);                  // the little bracket
  line(cx - 10, y - 11, cx - 10 + sw * 0.5, y); line(cx + 10, y - 11, cx + 10 + sw * 0.5, y);
  ctx.translate(sw * 0.5, 0); ctx.fillStyle = mine ? '#d9a84a' : '#7a5230'; ctx.beginPath(); ctx.roundRect(cx - w / 2, y, w, h, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = mine ? '#2a1608' : '#f0e2c0'; ctx.font = 'bold 8px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, cx, y + h / 2 + 0.5); ctx.restore();
}
function drawInnProp(p, t, v) {
  const k = p.k;
  if (k === 'bar') {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(p.x0 + 3, p.y1 - 1, p.x1 - p.x0, 4); ctx.fillStyle = '#5a3a22'; ctx.fillRect(p.x0, p.y0 + 8, p.x1 - p.x0, p.y1 - p.y0 - 8); ctx.fillStyle = '#7a5230'; for (let x = p.x0 + 10; x < p.x1; x += 34) ctx.fillRect(x, p.y0 + 12, 24, p.y1 - p.y0 - 14);
    ctx.fillStyle = '#9a6a3a'; ctx.fillRect(p.x0 - 3, p.y0, p.x1 - p.x0 + 6, 9); ctx.fillStyle = 'rgba(255,230,180,0.25)'; ctx.fillRect(p.x0 - 3, p.y0, p.x1 - p.x0 + 6, 2);
    for (const x of [p.x0 + 40, p.x0 + 120, p.x0 + 200, p.x0 + 290]) { ctx.fillStyle = '#e0b84a'; ctx.fillRect(x, p.y0 - 8, 7, 8); ctx.fillStyle = '#fff6d8'; ctx.fillRect(x, p.y0 - 8, 7, 2); }
  } else if (k === 'stove') {
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(p.x0 + 3, p.y1 - 1, p.x1 - p.x0, 4); ctx.fillStyle = '#2a2a30'; ctx.fillRect(p.x0, p.y0 - 6, p.x1 - p.x0, p.y1 - p.y0 + 6); ctx.fillStyle = '#3a3a44'; ctx.fillRect(p.x0, p.y0 - 6, p.x1 - p.x0, 6);
    CHV.lights.push([(p.x0 + p.x1) / 2, p.y1 - 4, 120, 0.85]); const fl = 1 + Math.sin(t * 11 + p.x0) * 0.15; ctx.fillStyle = '#ffa030'; ctx.fillRect(p.x0 + 8, p.y1 - 12, 20, 7 * fl); ctx.fillRect(p.x1 - 28, p.y1 - 12, 20, 7 * fl);
    ctx.fillStyle = '#6a6a74'; ctx.beginPath(); ctx.ellipse(p.x0 + 34, p.y0 - 10, 15, 6, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = '#8a8a94'; ctx.fillRect(p.x0 + 19, p.y0 - 24, 30, 14); ctx.beginPath(); ctx.ellipse(p.x0 + 34, p.y0 - 24, 15, 5, 0, 0, 6.3); ctx.fill();
  } else if (k === 'barrel') {
    ell(p.x, p.y + 2, p.r + 3, 5, 'rgba(0,0,0,0.25)'); ctx.fillStyle = '#7a5230'; ctx.fillRect(p.x - p.r, p.y - 22, p.r * 2, 24); ell(p.x, p.y - 22, p.r, 4, '#9a6a3a'); ell(p.x, p.y + 1, p.r, 4, '#7a5230');
    ctx.fillStyle = '#3a3a42'; ctx.fillRect(p.x - p.r, p.y - 16, p.r * 2, 2); ctx.fillRect(p.x - p.r, p.y - 6, p.r * 2, 2); ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(p.x + p.r * 0.35, p.y - 22, p.r * 0.65, 24);
  } else if (k === 'stool') {
    ctx.fillStyle = '#5a3a22'; ctx.fillRect(p.x - 4, p.y - 8, 2, 10); ctx.fillRect(p.x + 2, p.y - 8, 2, 10); ell(p.x, p.y - 9, 8, 4, '#8a5c34');
  } else if (k === 'stairs_old') {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(p.x0 + 3, p.y1 - 1, p.x1 - p.x0, 4);
    for (let i = 0; i < 7; i++) { const y = p.y0 + i * ((p.y1 - p.y0) / 7); ctx.fillStyle = i % 2 ? '#7a5230' : '#8a6038'; ctx.fillRect(p.x0, y, p.x1 - p.x0, (p.y1 - p.y0) / 7); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(p.x0, y, p.x1 - p.x0, 1.5); }
    ctx.fillStyle = '#4a2c18'; ctx.fillRect(p.x0, p.y0 - 8, 4, p.y1 - p.y0 + 8); ctx.fillRect(p.x1 - 4, p.y0 - 8, 4, p.y1 - p.y0 + 8); ctx.fillStyle = '#f5c451'; ctx.beginPath(); ctx.moveTo((p.x0 + p.x1) / 2, p.y0 + 4); ctx.lineTo((p.x0 + p.x1) / 2 - 6, p.y0 + 14); ctx.lineTo((p.x0 + p.x1) / 2 + 6, p.y0 + 14); ctx.closePath(); ctx.fill();
  } else if (k === 'desk') {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(p.x0 + 3, p.y1 - 1, p.x1 - p.x0, 4); ctx.fillStyle = '#4a2c18'; ctx.fillRect(p.x0, p.y0 + 8, p.x1 - p.x0, p.y1 - p.y0 - 8); ctx.fillStyle = '#2f4a7a'; ctx.fillRect(p.x0 + 6, p.y0 + 13, p.x1 - p.x0 - 12, p.y1 - p.y0 - 18); ctx.fillStyle = '#d9b44a'; ctx.fillRect(p.x0 + 6, p.y0 + 13, p.x1 - p.x0 - 12, 2);
    ctx.fillStyle = '#7a5230'; ctx.fillRect(p.x0 - 3, p.y0, p.x1 - p.x0 + 6, 9); ctx.fillStyle = 'rgba(255,230,180,0.25)'; ctx.fillRect(p.x0 - 3, p.y0, p.x1 - p.x0 + 6, 2); ctx.fillStyle = '#e8e0c8'; ctx.fillRect(p.x0 + 20, p.y0 - 5, 22, 6); ctx.fillStyle = '#c0392b'; ctx.fillRect(p.x0 + 100, p.y0 - 6, 10, 7); ctx.strokeStyle = '#e8e0c8'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(p.x0 + 120, p.y0); ctx.lineTo(p.x0 + 128, p.y0 - 14); ctx.stroke();
  } else if (k === 'dummy') {
    ell(p.x, p.y + 2, 12, 4, 'rgba(0,0,0,0.25)'); ctx.fillStyle = '#6a4a2a'; ctx.fillRect(p.x - 2, p.y - 26, 4, 28); ctx.fillStyle = '#c9a86a'; ctx.beginPath(); ctx.arc(p.x, p.y - 40, 8, 0, 6.3); ctx.fill(); ctx.fillRect(p.x - 11, p.y - 32, 22, 12); ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 1; ctx.strokeRect(p.x - 11, p.y - 32, 22, 12); ctx.fillStyle = '#c0392b'; ctx.fillRect(p.x - 11, p.y - 28, 22, 2);
  } else if (k === 'rack') {
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(p.x0 + 2, p.y1 - 1, p.x1 - p.x0, 3); ctx.fillStyle = '#5a3a22'; ctx.fillRect(p.x0, p.y0 - 18, p.x1 - p.x0, p.y1 - p.y0 + 18); ctx.fillStyle = '#4a2c18'; ctx.fillRect(p.x0, p.y0 - 18, 4, p.y1 - p.y0 + 18); ctx.fillRect(p.x1 - 4, p.y0 - 18, 4, p.y1 - p.y0 + 18);
    for (let i = 0; i < 5; i++) { const x = p.x0 + 10 + i * 14; ctx.fillStyle = '#c9ced6'; ctx.fillRect(x, p.y0 - 16, 3, 24); ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x - 3, p.y0 + 4, 9, 3); }
  } else drawChurchProp(p, t, v);
}
function drawInnInside(v) {
  const Z = VIL_ZOOM, t = v.t, fl = v.cFloor, f = v.cfl[fl];
  ctx.fillStyle = '#08080e'; ctx.fillRect(0, 0, VW, VH);
  ctx.save(); ctx.scale(Z, Z); ctx.translate(-cam.x, -cam.y);
  ctx.drawImage(chBake(v, fl), CHB.x0, CHB.y0, CHB.x1 - CHB.x0, CHB.y1 - CHB.y0);
  (v.cKind === 'guild' ? guildRoom : innRoom)(fl, t); if (fl === 0) chExitSpill(INT[v.cKind].exit.x, INT[v.cKind].exit.y);
  ctx.drawImage(chBake3(v, fl), CHB.x0, CHB.y0, CHB.x1 - CHB.x0, CHB.y1 - CHB.y0);
  const things = []; chExtThings(v, fl, things); chDoorThings(v, fl, things);
  if (v.cKind === 'inn' && fl === 1) INN_ROOMS.forEach((x, i) => things.push({ y: 900, d: () => chDoorSign(x + 130, 420, INN_ROOM_NAMES[i].replace(' Room', ''), !!(v.room && v.room.idx === i), t) }));
  for (const p of f.props) things.push({ y: p.y, d: () => drawInnProp(p, t, v) });
  const folk = churchFolkOf(v); for (const n of folk) things.push({ y: n.y, d: () => drawVillager(n) });
  things.push({ y: hero.y, d: () => drawHero(hero) });
  things.sort((a, b) => a.y - b.y).forEach(o => o.d());
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 30; i++) { const px = 340 + ((i * 197 + t * (4 + i % 5)) % 760), py = 360 + ((i * 89 + Math.sin(t * 0.4 + i) * 20 + t * 3) % 260); ctx.fillStyle = `rgba(255,220,160,${0.08 + 0.08 * Math.sin(t * 1.3 + i)})`; ctx.fillRect(px, py, 1.6, 1.6); }
  ctx.restore();
  for (const n of folk) if (n.bubble) drawBubble(n.x, n.y - 82, n.bubble, Math.min(1, n.bubbleT * 2));
  chLighting(v, fl);
  if (v.near && !v.talk) {
    const q = v.near, ty = q.kind === 'npc' ? q.ref.y - 100 : q.y - 56, bob = Math.sin(tAnim * 5) * 2;
    ctx.save(); ctx.fillStyle = 'rgba(20,20,28,0.88)'; ctx.strokeStyle = '#f5c451'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(q.x - 11, ty - 11 + bob, 22, 22, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f5c451'; ctx.font = 'bold 14px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(keyLabel('interact'), q.x, ty + 5 + bob); ctx.restore();
  }
  ctx.restore();
  const vg = ctx.createRadialGradient(VW / 2, VH * 0.45, VH * 0.35, VW / 2, VH * 0.45, VW * 0.62); vg.addColorStop(0, 'rgba(10,6,16,0)'); vg.addColorStop(1, 'rgba(10,6,16,0.5)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  const sk = v.skip ? (v.skip.t < 0.6 ? v.skip.t / 0.6 : v.skip.t < SLEEP_LEN - 0.7 ? 1 : Math.max(0, 1 - (v.skip.t - (SLEEP_LEN - 0.7)) / 0.7)) : 0, black = Math.max(v.fade, sk);
  if (black > 0) { ctx.fillStyle = `rgba(2,3,10,${black})`; ctx.fillRect(0, 0, VW, VH); }
  if (v.skip && sk > 0.7) drawSleepScene(v.skip, sk); else drawVillageHUD(v);
  drawPopups(true);
}


// ---------------------------------------------------------------- the Adventurers' Guild: a lobby with the guildmaster and the quest board, a training wing and a briefing room.
// The adventurers in here are the first step towards companions: each has a class and a level (n.adv) and will be the ones you can hire and bring along.
const GLD_EXIT = { x: 720, y: 844 }, GLD_NAME = ['Adventurers\' Guild'], GLD_BOARD = { x: 585, y: 398 };
const GLD_WALK = [[[330, 380, 1110, 800], [650, 796, 790, 850], [160, 420, 300, 780], [1150, 420, 1290, 780], [290, 490, 340, 550], [1100, 490, 1160, 550]]];
function guildSolids(v) {
  const walls = chWalls(GLD_WALK[0]), f = { walk: GLD_WALK[0], walls, solids: walls.slice(), props: [] };
  const rect = (k, x0, y0, x1, y1, o = {}) => { const p = { k, x0, y0, x1, y1, y: y1, ...o }; f.props.push(p); if (!o.free) f.solids.push({ x0, y0: y0 - 2, x1, y1 }); };
  const circle = (k, x, y, r, o = {}) => { const p = { k, x, y, r, ...o }; f.props.push(p); if (!o.free) f.solids.push({ x, y: y - 2, r }); };
  rect('desk', 640, 430, 800, 456);
  rect('shelf', 456, 382, 512, 398, { v: 'books', h: 84 }); rect('shelf', 896, 382, 952, 398, { v: 'scrolls', h: 84 });
  for (const [x, y] of [[350, 398], [1094, 398], [662, 816], [778, 816], [1282, 590], [344, 786], [1098, 786]]) circle('plant', x, y, 8);
  [[380, 500], [880, 500], [560, 570], [960, 580]].forEach(([x0, y0], i) => {
    circle('chair', x0 + 22, y0 - 2, 6, { free: true, d: 1 }); circle('chair', x0 + 68, y0 - 2, 6, { free: true, d: 1 }); circle('chair', x0 + 45, y0 + 44, 6, { free: true, d: -1 });
    rect('mugs', x0 + 8, y0 + 10, x0 + 60, y0 + 29, { free: true, v: (i + 1) % 3 });
  });
  circle('haybale', 184, 590, 14); circle('target', 268, 592, 10); circle('barrel', 294, 436, 10); circle('lamp', 1160, 452, 5); rect('crate', 1236, 566, 1268, 582); circle('globe', 1176, 600, 9);
  [[392, 650], [840, 660]].forEach(([x0, y0], i) => { rect('table', x0, y0, x0 + 90, y0 + 28); circle('chair', x0 + 22, y0 - 2, 6, { free: true, d: 1 }); circle('chair', x0 + 68, y0 - 2, 6, { free: true, d: 1 }); circle('chair', x0 + 45, y0 + 44, 6, { free: true, d: -1 }); rect('mugs', x0 + 8, y0 + 10, x0 + 60, y0 + 29, { free: true, v: (i + 2) % 3 }); });
  [[470, 740], [830, 730]].forEach(([x0, y0], i) => { rect('table', x0, y0, x0 + 90, y0 + 28); circle('chair', x0 + 22, y0 - 2, 6, { free: true, d: 1 }); circle('chair', x0 + 68, y0 - 2, 6, { free: true, d: 1 }); circle('chair', x0 + 45, y0 + 44, 6, { free: true, d: -1 }); rect('mugs', x0 + 8, y0 + 10, x0 + 60, y0 + 29, { free: true, v: i }); });
  circle('chandelier', 500, 1250, 0, { free: true, fy: 550 }); circle('chandelier', 940, 1250, 0, { free: true, fy: 550 }); circle('chandelier', 720, 1450, 0, { free: true, fy: 750 }); circle('chandelier', 230, 1300, 0, { free: true, fy: 600 }); circle('chandelier', 1220, 1300, 0, { free: true, fy: 600 });
  circle('barrel', 296, 760, 10); circle('dummy', 232, 730, 10); circle('plant', 1276, 760, 7); rect('cabinet', 1170, 744, 1234, 770, { h: 60 }); circle('globe', 1260, 720, 9);
  circle('exitsign', GLD_EXIT.x, GLD_EXIT.y - 34, 0, { free: true }); circle('dummy', 214, 626, 10); circle('dummy', 262, 650, 10); rect('rack', 170, 676, 250, 690); circle('haybale', 276, 676, 14); circle('target', 200, 600, 10);
  rect('table', 1190, 620, 1270, 648); circle('chair', 1210, 618, 6, { free: true, d: 1 }); circle('chair', 1250, 618, 6, { free: true, d: 1 }); circle('chair', 1230, 664, 6, { free: true, d: -1 }); rect('mugs', 1198, 630, 1250, 649, { free: true, v: 1 }); circle('plant', 1276, 676, 7); circle('lamp', 1166, 660, 5); rect('crate', 1236, 566, 1268, 582, { });
  for (const [x0, y0] of [[380, 500], [880, 500], [560, 570], [960, 580]]) rect('table', x0, y0, x0 + 90, y0 + 28);
  rect('rack', 170, 430, 250, 446); circle('dummy', 210, 480, 10); circle('dummy', 210, 545, 10); circle('dummy', 270, 512, 10);
  rect('table', 1180, 470, 1270, 498); rect('chest', 1170, 430, 1210, 446); rect('chest', 1230, 430, 1270, 446);
  v.gfl = [f];
}
function guildFolk(mk) {
  const base = { inside: true, inn: true, int: 'guild', adv: true, speed: 30, floor: 0 }, last = n => n.lastKind;
  const alt = (n, kinds) => { const k = chPick(kinds.filter(x => x !== last(n))); n.lastKind = k; return k; };
  mk('lyra', 'Lyra', 'Guildmaster', 720, 410, { ...base, adv: false, special: 'guild', look: { dress: '#2f4a7a', apron: '#d9b44a', hair: '#c9c9d0', hat: 'kerchief', hatColor: '#2f4a7a' }, f: 1,
    lines: ['Every hero in this village signed my ledger first. The ones who did not are not in this village any more.', 'The board is updated at every dawn. Take what you can finish, and finish what you take.', 'Contracts, rewards, a hot seat by the fire. That is all a guild is. The rest is paperwork.', 'Soon the guild will send its own people out on the road with you. I am still choosing who is worth the risk.', 'If you want a rank, earn it. If you want a bed, the inn is next door.'],
    chat: ['Sign here...', 'Paperwork, paperwork...', 'Next!'],
    script: (v, n) => alt(n, ['a', 'b']) === 'a' ? chDo(720, 410, 'wipe', 1, [4, 7]) : [...chStay(660, 408, 1, [3, 6]), ...chStay(780, 408, -1, [3, 6])] });
  mk('kade', 'Kade', 'Swordsman', 425, 544, { ...base, look: { body: '#5a6a8a', hat: 'cap', hatColor: '#c0392b', hair: '#3a2a22', cheek: true }, adv: { cls: 'Swordsman', lv: 14 }, f: 1,
    lines: ['Eleven contracts this month. Nine of them ended with me being thanked. The other two, I was chased.', 'Never take a quest with the word "simple" in it. Simple is how they get you.', 'I fight with a sword because it is the one weapon that does not need ammunition or manners.', 'Wolves, bandits, a very angry goat. The goat was the worst.', 'If you want to travel together some day, you will have to beat me to the door.'],
    chat: ['Hm.', 'Pass the bread.', 'Another contract...'],
    script: (v, n) => chDo(425, 544, 'sit', 1, [18, 34]) });
  mk('mirel', 'Mirel', 'Archer', 600, 402, { ...base, look: { body: '#3f7a4a', hat: 'beanie', hatColor: '#3f5a3a', hair: '#b07a3a', cheek: true }, adv: { cls: 'Archer', lv: 12 }, f: -1,
    lines: ['I read the board every morning. Not for the work. For the handwriting. Lyra writes like a general.', 'A good arrow is quiet, straight and not mine, if I miss.', 'The best rewards are for the worst jobs. I am usually the one who volunteers. Do not ask why.', 'Stand behind me when it gets loud. That is my whole advice.', 'Companions? The guild will arrange it. I would want my own bow, and someone who does not talk.'],
    chat: ['Hm... that one pays well.', 'Too far.', 'Too cold.'],
    script: (v, n) => [...chStay(chRnd(540, 640), 402, 1, [4, 8]), ...chStay(chRnd(540, 640), 410, -1, [3, 6])] });
  mk('bram', 'Bram', 'Veteran', 260, 470, { ...base, look: { body: '#7a5a4a', hat: 'cap', hatColor: '#4a4a52', beard: '#cfcfcf' }, adv: { cls: 'Warrior', lv: 31 }, f: -1,
    lines: ['Twenty years of drilling the young ones. Two of them were competent. One is now guildmaster.', 'Strike the dummy, not the people. That is the whole lesson. Most of you forget the second half.', 'My knees are older than this guild. They still outlast your breath.', 'A hero who rests well fights twice as long. Sit, drink, then swing.', 'There will be a day the guild lends you a sword arm. Be kind to it. It remembers.'],
    chat: ['Again!', 'Hup!', 'Feet apart!'],
    script: (v, n) => [...chDo(250, 480, 'wipe', -1, [3, 5]), ...chStay(chRnd(240, 290), 560, 1, [3, 6])] });
  mk('tess', 'Tess', 'Rookie', 560, 620, { ...base, look: { body: '#8a4a6a', hat: 'beanie', hatColor: '#d9b44a', hair: '#6a3a2a', cheek: true }, adv: { cls: 'Apprentice', lv: 3 }, f: 1,
    lines: ['My first day! Lyra said "sit" and I sat. I think I am supposed to do things next.', 'Is it true heroes get a rank? I want a rank. A small one. Any one.', 'Kade let me carry his bag. It weighs more than my whole house.', 'I will be the best adventurer this guild has ever had. Eventually. After lunch.', 'Do you need a companion? I am free. And I can carry things!'],
    chat: ['Ooh, a sword!', 'What does that rank mean?', 'Is it lunch yet?'],
    script: (v, n) => [...chStay(chRnd(420, 700), 620, 1, [3, 6]), ...chStay(chRnd(760, 1000), 620, -1, [3, 6]), ...chStay(chRnd(500, 700), 540, 1, [3, 6])] });
  mk('orrin', 'Orrin', 'Mage', 1225, 514, { ...base, look: { body: '#4a3a7a', hat: 'cap', hatColor: '#4a3a7a', hair: '#2a2a3a', glasses: true }, adv: { cls: 'Mage', lv: 22 }, f: -1,
    lines: ['I study maps. Roads change, monsters migrate. The guild pays me to be right more often than wrong.', 'Magic is only maths that shouts. I prefer to whisper.', 'The beast was seen again north of the village. Do not say I did not warn you.', 'A companion mage is a very expensive idea. I shall charge accordingly.', 'Careful with the lantern. It is the only thing between me and a very awkward fire.'],
    chat: ['Hm... north...', 'Where is my compass?', 'Fascinating.'],
    script: (v, n) => alt(n, ['read', 'read', 'shelf']) === 'read' ? chDo(1225, 514, 'read', -1, [14, 26]) : [...chStay(1220, 454, 1, [3, 6]), ...chStay(1190, 560, -1, [3, 6])] });
}
function guildRoom(fl, t) {
  const walk = GLD_WALK[0];
  chFloorFill(walk[0], '#b9ae96', '#aea38b'); chFloorFill(walk[1], '#b9ae96', '#aea38b'); chPlanks(walk[2], '#a07650', 'rgba(60,30,10,0.35)'); chPlanks(walk[3], '#a07650', 'rgba(60,30,10,0.35)');
  chPlanks(walk[4], '#8a6038', 'rgba(40,20,5,0.4)', 16); chPlanks(walk[5], '#8a6038', 'rgba(40,20,5,0.4)', 16);
  chRug(364, 488, 486, 560, '#7a2a2a', '#d9b44a', 'round'); chRug(376, 636, 508, 704, '#3a5a4a', '#d9b44a', 'round'); chRug(824, 646, 954, 712, '#6a3a2a', '#d9b44a'); chRug(1176, 604, 1286, 676, '#7a2a2a', '#d9b44a', 'round'); chRug(456, 726, 586, 792, '#2f4a7a', '#d9b44a', 'round'); chRug(816, 716, 946, 782, '#6a3a2a', '#d9b44a'); chRug(166, 690, 296, 780, '#6a4a2a', '#2a1a0e', 'round'); chRug(864, 488, 998, 546, '#2f4a7a', '#d9b44a'); chRug(544, 556, 666, 622, '#3a5a4a', '#d9b44a', 'round'); chRug(944, 566, 1074, 628, '#6a3a2a', '#d9b44a');
  ctx.fillStyle = '#2f4a7a'; ctx.fillRect(690, 462, 60, 380); chBorder([690, 462, 750, 842], '#d9b44a', 3); chMedallion(720, 590, 22);
  chShield(484, 286, '#2f4a7a'); chShield(924, 286, '#7a1f2a'); chAntlers(720, 296); chClock(585, 296, t); chPicture(344, 302, 28, 22, 2);                    // the blue rug from the door to the desk
  chBorder(walk[2], '#7a5430', 4); chBorder(walk[3], '#7a5430', 4);
  // the quest board on the back wall, banners, the guild's crest over the desk
  ctx.fillStyle = '#5a3a22'; ctx.fillRect(515, 330, 140, 50); ctx.fillStyle = '#7a5230'; ctx.fillRect(519, 334, 132, 42);
  for (let i = 0; i < 9; i++) { ctx.fillStyle = ['#e8e0c8', '#f0e4b8', '#dcd0b0'][i % 3]; ctx.fillRect(525 + (i % 5) * 25, 338 + Math.floor(i / 5) * 19 + (i % 2) * 2, 18, 15); ctx.fillStyle = '#c0392b'; ctx.fillRect(532 + (i % 5) * 25, 337 + Math.floor(i / 5) * 19, 3, 3); }
  ctx.fillStyle = '#e8d08a'; ctx.font = 'bold 9px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('QUESTS', 585, 327); ctx.textAlign = 'start';
  for (const [bx, c] of [[440, '#2f4a7a'], [820, '#2f4a7a'], [1000, '#7a1f2a'], [1070, '#7a1f2a']]) { ctx.fillStyle = c; ctx.fillRect(bx - 12, 322, 24, 50); ctx.beginPath(); ctx.moveTo(bx - 12, 372); ctx.lineTo(bx, 362); ctx.lineTo(bx + 12, 372); ctx.fill(); ctx.fillStyle = '#d9b44a'; ctx.fillRect(bx - 12, 322, 24, 2); ctx.fillRect(bx - 1, 334, 2, 18); ctx.fillRect(bx - 6, 340, 12, 2); }
  ctx.fillStyle = '#d9b44a'; ctx.beginPath(); ctx.moveTo(700, 332); ctx.lineTo(740, 332); ctx.lineTo(740, 352); ctx.lineTo(720, 366); ctx.lineTo(700, 352); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#2f4a7a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(706, 338); ctx.lineTo(734, 360); ctx.moveTo(734, 338); ctx.lineTo(706, 360); ctx.stroke();
  for (const x of [380, 760, 880, 1070]) chSconce(x, 362, t);
  // the training wing and the briefing room
  ctx.fillStyle = '#6a4a2a'; ctx.fillRect(168, 372, 124, 48); ctx.strokeStyle = '#2a1a0e'; ctx.lineWidth = 1; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(168, 380 + i * 12); ctx.lineTo(292, 380 + i * 12); ctx.stroke(); }
  chSconce(230, 400, t); chSconce(1220, 400, t); chPicture(176, 330, 28, 22, 0); chShield(268, 344, '#7a1f2a'); chRug(1170, 520, 1280, 596, '#2f4a7a', '#d9b44a'); chRug(166, 586, 296, 686, '#6a4a2a', '#2a1a0e', 'round');
  ctx.fillStyle = '#e8dcb8'; ctx.fillRect(1180, 366, 80, 46); ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = 1.5; ctx.strokeRect(1180, 366, 80, 46); ctx.strokeStyle = '#a07a4a'; ctx.beginPath(); ctx.moveTo(1190, 396); ctx.quadraticCurveTo(1210, 372, 1230, 392); ctx.quadraticCurveTo(1245, 402, 1252, 380); ctx.stroke(); ctx.fillStyle = '#c0392b'; ctx.fillRect(1226, 388, 5, 5);
}

const INT = { inn: { exit: INN_EXIT, name: INN_NAME, b: 'inn', fl: 'ifl' }, guild: { exit: GLD_EXIT, name: GLD_NAME, b: 'guild', fl: 'gfl' } };
