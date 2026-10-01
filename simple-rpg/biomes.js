// Biome definitions and world generation.
// A biome is data: palette, which props / decor / critters appear, water, weather pool (sky.js), music and
// footstep surface (sfx.js). World generation turns that data into positions; art lives in props.js,
// creatures and ambient effects in critters.js.

const BIOMES = [
  { key: 'forest', name: 'Whispering Forest',
    ground: '#3a5a40', patch: '#2f4d36', patch2: '#4d7050', grass: ['#4c7352', '#5f8d5c'],
    props: [['oak', 5], ['birch', 2], ['bush', 3], ['stump', 1], ['mossrock', 1]], propCount: 95,
    decor: [['flower', 4], ['mushroom', 1], ['pebble', 1], ['leaf', 2]], decorColors: ['#f4e04d', '#f28ab2', '#ffffff', '#a0c4ff'],
    ambient: 'firefly', music: 'forest', warm: 0, surface: 'grass', ambience: 'forest',
    water: { n: 2, rx: [60, 110], ry: [34, 60], c: '#2f7a8c', deep: '#1d4d63' },
    critters: [['butterfly', 9], ['bird', 6]], clouds: true },
  { key: 'desert', name: 'Scorched Desert',
    ground: '#c9a86a', patch: '#b8955a', patch2: '#dcc088', grass: ['#9c8a4a', '#b09a55'],
    props: [['cactus', 4], ['barrel', 2], ['deadbush', 3], ['sandstone', 2], ['skull', 1]], propCount: 62,
    decor: [['pebble', 3], ['bone', 1], ['dot', 2]], decorColors: ['#8a7454', '#a08a66', '#e8dcc0'],
    ambient: 'sand', music: 'desert', warm: 1, surface: 'sand', ambience: 'desert',
    water: { n: 1, rx: [70, 100], ry: [38, 52], c: '#35a6b8', deep: '#1f7488', palms: true },
    critters: [['lizard', 8]], devils: true },
  { key: 'snow', name: 'Frozen Wastes',
    ground: '#d9e3ec', patch: '#c2d1dd', patch2: '#eef3f8', grass: ['#9fb3c2', '#b6c6d2'],
    props: [['pine', 5], ['smallpine', 3], ['icerock', 2], ['drift', 3], ['deadtree', 1]], propCount: 88,
    decor: [['crystal', 3], ['pebble', 1], ['dot', 2]], decorColors: ['#ffffff', '#cfe8ff'],
    ambient: 'snow', music: 'snow', warm: -1, surface: 'snow', ambience: 'snow',
    water: { n: 2, rx: [60, 100], ry: [34, 52], c: '#a9d4ec', deep: '#6fa8cc', frozen: true },
    critters: [['hare', 6]], glint: true },
  { key: 'volcano', name: 'Molten Caldera',
    ground: '#3a2b28', patch: '#2a1f1d', patch2: '#4a3530', grass: ['#5a4038', '#6a4a3a'],
    props: [['obsidian', 4], ['chartree', 2], ['vent', 2], ['lavarock', 3]], propCount: 62,
    decor: [['crack', 4], ['ember', 2], ['pebble', 1]], decorColors: ['#ff7a30', '#555555'],
    ambient: 'ember', music: 'volcano', warm: 0.8, surface: 'stone', ambience: 'volcano', lava: true,
    critters: [['wisp', 6]], wispColor: [255, 150, 60] },
  { key: 'swamp', name: 'Murky Swamp',
    ground: '#2d3a2b', patch: '#222e21', patch2: '#3b4a34', grass: ['#4a5a30', '#5f7236'], noPath: true,
    props: [['swamptree', 5], ['reeds', 4], ['mushroom', 2], ['log', 2], ['stump', 1]], propCount: 82,
    decor: [['reed', 3], ['mushroom', 1], ['leaf', 2], ['pebble', 1]], decorColors: ['#6a7a3a', '#8a6a3a', '#9ad0a0', '#b49ad8'],
    ambient: 'spore', music: 'swamp', warm: -0.3, surface: 'mud', ambience: 'swamp',
    water: { n: 16, rx: [50, 120], ry: [28, 60], c: '#3b5d3d', deep: '#233a28', murky: true, lilies: true },
    critters: [['frog', 10], ['wisp', 4]], wispColor: [150, 255, 170] },
  { key: 'jungle', name: 'Emerald Jungle',
    ground: '#2c6a3a', patch: '#235a30', patch2: '#3d8648', grass: ['#3f9b4a', '#59b95e'],
    props: [['jungletree', 5], ['bigfern', 4], ['banana', 2], ['flowerbush', 3], ['mossrock', 1]], propCount: 105,
    decor: [['flower', 5], ['fern', 3], ['leaf', 2]], decorColors: ['#ff5a8a', '#ffd23a', '#ff8a2a', '#c07aff', '#ffffff'],
    ambient: 'pollen', music: 'jungle', warm: 0.2, surface: 'grass', ambience: 'jungle',
    water: { n: 3, rx: [60, 110], ry: [34, 58], c: '#2a8a86', deep: '#1b5a5c', lilies: true },
    critters: [['butterfly', 12], ['bird', 7]], clouds: true },
  { key: 'ruins', name: 'Haunted Ruins',
    ground: '#4a4e57', patch: '#3f434b', patch2: '#5a5f69', grass: ['#5d6a5a', '#6f7d68'],
    props: [['pillar', 4], ['arch', 1], ['tomb', 4], ['deadtree', 2], ['statue', 1], ['brazier', 1], ['rubble', 3]], propCount: 72,
    decor: [['bone', 2], ['pebble', 3], ['leaf', 1]], decorColors: ['#cfcab8', '#8a8f99', '#5d6a5a'],
    ambient: 'wispdust', music: 'ruins', warm: -0.4, surface: 'stone', ambience: 'ruins', cobbles: true,
    critters: [['wisp', 8]], wispColor: [170, 220, 255] },
  { key: 'highlands', name: 'Windswept Highlands',
    ground: '#767b83', patch: '#686d75', patch2: '#8c9199', grass: ['#6f8a6a', '#8aa085'],
    props: [['boulder', 4], ['spire', 2], ['alpinepine', 3], ['cairn', 1], ['alpinebush', 3]], propCount: 78,
    decor: [['pebble', 4], ['flower', 2], ['crystal', 1]], decorColors: ['#e8e8f0', '#b0b8d0', '#d0a0e0'],
    ambient: 'dust', music: 'highlands', warm: -0.2, surface: 'stone', ambience: 'highlands',
    water: { n: 1, rx: [90, 130], ry: [48, 66], c: '#3a7aa8', deep: '#244e78' },
    critters: [['bird', 6], ['hare', 3]], clouds: true },
];

const pickW = (list, r) => {
  let tot = 0;
  for (const [, w] of list) tot += w;
  let x = r() * tot;
  for (const [k, w] of list) if ((x -= w) <= 0) return k;
  return list[0][0];
};
const inEllipse = (x, y, e, pad = 0) => ((x - e.x) / (e.rx + pad)) ** 2 + ((y - e.y) / (e.ry + pad)) ** 2 < 1;

// Positions for everything static in a biome: lava, water, props and decor. Deterministic from the seed.
function buildWorldFeatures(B, seed) {
  const r = mulberry(seed);
  const nearCenter = (x, y, d) => Math.hypot(x - WW / 2, y - WH / 2) < d;

  const lava = [];
  if (B.lava) while (lava.length < 12) {
    const x = 150 + r() * (WW - 300), y = 150 + r() * (WH - 300);
    if (!nearCenter(x, y, 260)) lava.push({ x, y, rx: 50 + r() * 70, ry: 25 + r() * 30 });
  }

  const water = [];
  if (B.water) {
    const W = B.water;
    for (let tries = 0; water.length < W.n && tries < 400; tries++) {
      const rx = W.rx[0] + r() * (W.rx[1] - W.rx[0]), ry = W.ry[0] + r() * (W.ry[1] - W.ry[0]);
      const x = 130 + rx + r() * (WW - 260 - rx * 2), y = 130 + ry + r() * (WH - 260 - ry * 2);
      if (nearCenter(x, y, 230 + rx)) continue;
      if (water.some(o => Math.hypot(o.x - x, o.y - y) < (o.rx + rx) * 0.95)) continue;
      if (lava.some(l => Math.hypot(l.x - x, l.y - y) < l.rx + rx)) continue;
      water.push({ x, y, rx, ry, c: W.c, deep: W.deep, frozen: !!W.frozen, murky: !!W.murky, lilies: !!W.lilies, ph: r() * 6.28 });
    }
  }

  const blocked = (x, y) => lava.some(l => inEllipse(x, y, l, 24)) || water.some(w => inEllipse(x, y, w, 16));
  const props = [];
  const mk = (kind, x, y) => props.push({ k: kind, x, y, s: 0.8 + r() * 0.6, v: r(), ph: r() * 6.28 });
  while (props.length < B.propCount) {
    const kind = pickW(B.props, r);
    if (kind === 'reeds' && water.length && r() < 0.8) {                // reeds crowd the water's edge
      const w = water[Math.floor(r() * water.length)], a = r() * Math.PI * 2;
      const x = w.x + Math.cos(a) * (w.rx + 4 + r() * 12), y = w.y + Math.sin(a) * (w.ry + 2 + r() * 8);
      if (y > 50 && y < WH - 10) mk('reeds', x, y);
      continue;
    }
    const x = r() * WW, y = 40 + r() * (WH - 40);
    if (nearCenter(x, y, 120) || blocked(x, y)) continue;
    mk(kind, x, y);
  }
  if (B.water && B.water.palms) for (const w of water) for (let i = 0; i < 6; i++) {   // palms ring an oasis
    const a = (i / 6) * Math.PI * 2 + r() * 0.5;
    mk('palm', w.x + Math.cos(a) * (w.rx + 18), w.y + Math.sin(a) * (w.ry + 10));
  }

  const decor = [];
  while (decor.length < 440) {
    const x = r() * WW, y = r() * WH;
    if (blocked(x, y)) continue;
    decor.push({ k: pickW(B.decor, r), x, y, c: B.decorColors[Math.floor(r() * B.decorColors.length)], s: 1 + r() * 1.2, ph: r() * 6.28 });
  }
  for (const w of water) if (w.lilies) for (let i = 0; i < 7; i++) {      // lily pads float on the water
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.8;
    decor.push({ k: 'lily', x: w.x + Math.cos(a) * w.rx * d, y: w.y + Math.sin(a) * w.ry * d, c: '#3f7a3a', s: 1 + r() * 0.6, ph: r() * 6.28 });
  }
  return { props, decor, lava, water };
}

// water the hero or a monster is standing in (frozen water is solid ice)
function waterAt(x, y) {
  if (!world || !world.water) return null;
  for (const w of world.water) if (!w.frozen && inEllipse(x, y, w, -6)) return w;
  return null;
}
function surfaceAt(x, y) { return waterAt(x, y) ? 'water' : world.B.surface; }
