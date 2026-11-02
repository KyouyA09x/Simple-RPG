// Dungeons: now and then, after a wave, a stone door opens somewhere near you (it stays open for a short while). Press E at it to go down.
// A dungeon is eight floors or more (the last is the boss room). Every floor is a lit-by-torches hall of stone built from a few layouts (pillars, a dividing wall, chambers), and its creatures are asleep:
// they wake when you come into their sight, or when you hurt them, and the ones beside them wake with them. Chests are hidden in the corners; the last floor has an evolved
// boss and a sealed treasure room behind it. Floors are kept while you stay (you can go back up). Reaching a new floor saves a checkpoint: load that save and you wake at the stairs of that floor.
// A dungeon is a mode of the normal game (state 'play', `dun` set): the creatures, the fighting and the loot are the ordinary ones; what is new is the stone floor you walk on.

let dun = null, dunDoor = null, dunRolled = false, dunNear = null, dunChance = 0.012;                // dunChance: how often a cleared wave opens a door (the tests turn it off)
const DUN = { x0: 160, y0: 260, x1: 2240, y1: 1400, C: 40, gx: 120, gy: 220, cols: 54, rows: 30, wallH: 36 };
const DUN_PAL = {
  forest:    { name: 'Mossy Crypt',      floor: '#3f4a3a', floor2: '#374132', wall: '#4d5944', top: '#6b7a5d', edge: '#1c2319', glow: '#9be07a' },
  desert:    { name: 'Buried Tomb',      floor: '#7d6f4c', floor2: '#716444', wall: '#8f7e56', top: '#b39f6c', edge: '#3a3220', glow: '#ffd98a' },
  snow:      { name: 'Frozen Vault',     floor: '#5d7186', floor2: '#546879', wall: '#6f879e', top: '#9cb8d2', edge: '#223244', glow: '#bfeaff' },
  volcano:   { name: 'Ember Forge',      floor: '#3d2a28', floor2: '#352422', wall: '#503632', top: '#74463e', edge: '#180e0d', glow: '#ff8a40' },
  swamp:     { name: 'Sunken Grotto',    floor: '#38453a', floor2: '#303c32', wall: '#44564a', top: '#5f7a66', edge: '#141d17', glow: '#7be0a0' },
  jungle:    { name: 'Vine Temple',      floor: '#44563c', floor2: '#3b4c34', wall: '#566b4a', top: '#79925f', edge: '#1b2616', glow: '#c6f07a' },
  ruins:     { name: 'Lost Catacombs',   floor: '#4a4a56', floor2: '#42424d', wall: '#5a5a69', top: '#7d7d90', edge: '#1b1b22', glow: '#b9b0ff' },
  highlands: { name: 'Storm Keep',       floor: '#4e5a68', floor2: '#455160', wall: '#5e6c7c', top: '#8398ae', edge: '#1c232c', glow: '#fff3a0' },
};
// the ways in: each is a building or a mouth in the ground that opens for a short while after a wave
const DUN_DOORS = {
  cathedral: { name: 'Ruined Cathedral', say: 'The doors of a ruined cathedral swing open nearby...', shut: 'The cathedral doors close', h: 215 },
  cave: { name: 'Cave Mouth', say: 'A cave mouth yawns open nearby...', shut: 'The cave mouth is blocked by a rockfall', h: 135 },
  mausoleum: { name: 'Mausoleum', say: 'A mausoleum unseals nearby...', shut: 'The mausoleum seals itself', h: 150 },
  tower: { name: 'Broken Tower', say: 'The door of a broken tower opens nearby...', shut: 'The tower door slams shut', h: 195 },
  well: { name: 'Old Well', say: 'A stone well glows nearby...', shut: 'The well goes dark', h: 100 },
  gate: { name: 'Stone Door', say: 'A stone door grinds open nearby...', shut: 'The stone door grinds shut', h: 112 },
};
const DUN_DOOR_PICKS = ['cathedral', 'cathedral', 'cave', 'cave', 'mausoleum', 'mausoleum', 'tower', 'well', 'gate'];
const DUN_LAYOUT_NAME = { hall: 'Pillared hall', cross: 'Crossways', colonnade: 'Colonnade', islands: 'Fallen halls', serpent: 'Winding passage', split: 'Divided hall', chambers: 'Chambers', maze: 'Labyrinth', rooms: 'Warren of rooms', ring: 'Ring hall', crypt: 'Crypt', boss: 'Boss chamber' };
const dunPal = () => DUN_PAL[BIOMES[(dun ? dun.zone : zone) % BIOMES.length].key] || DUN_PAL.ruins;
const dunFloors = () => Math.max(8, Math.min(10, 8 + Math.floor(wave / 40)));

// ---------------------------------------------------------------- geometry
const rectDist = (s, x, y) => Math.hypot(Math.max(s.x0 - x, 0, x - s.x1), Math.max(s.y0 - y, 0, y - s.y1));
function dunSolidAt(x, y, pad = 0, f = dun && dun.f) {                         // is a point inside a wall or a pillar (pad: grown by this much)?
  if (!f) return false;
  for (const s of f.solids) {
    if (s.r !== undefined) { if (Math.hypot(x - s.x, y - s.y) < s.r + pad) return true; }
    else if (x > s.x0 - pad && x < s.x1 + pad && y > s.y0 - pad && y < s.y1 + pad) return true;
  }
  return false;
}
function dunLos(x0, y0, x1, y1, pad = 8) {                                     // can these two points see each other?
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 22);
  for (let i = 1; i < n; i++) if (dunSolidAt(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, pad)) return false;
  return true;
}
function dunPush(e, r, f = dun && dun.f) {                                      // move a creature (or the hero) out of the walls
  if (!f) return;
  for (let it = 0; it < 5; it++) for (const s of f.solids) {
    if (s.r !== undefined) { const dx = e.x - s.x, dy = e.y - s.y, d = Math.hypot(dx, dy), m = s.r + r; if (d < m) { if (d < 0.001) e.x += m; else { e.x = s.x + dx / d * m; e.y = s.y + dy / d * m; } } }
    else {
      const cx = Math.max(s.x0, Math.min(e.x, s.x1)), cy = Math.max(s.y0, Math.min(e.y, s.y1)), dx = e.x - cx, dy = e.y - cy, d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 > 1e-6) { const d = Math.sqrt(d2); e.x = cx + dx / d * r; e.y = cy + dy / d * r; }
        else { const l = e.x - s.x0, rr = s.x1 - e.x, t = e.y - s.y0, b = s.y1 - e.y, m = Math.min(l, rr, t, b); if (m === l) e.x = s.x0 - r; else if (m === rr) e.x = s.x1 + r; else if (m === t) e.y = s.y0 - r; else e.y = s.y1 + r; }
      }
    }
  }
}
const cellOf = (x, y) => ({ cx: Math.max(0, Math.min(DUN.cols - 1, Math.floor((x - DUN.gx) / DUN.C))), cy: Math.max(0, Math.min(DUN.rows - 1, Math.floor((y - DUN.gy) / DUN.C))) });
const cellXY = (cx, cy) => ({ x: DUN.gx + cx * DUN.C + DUN.C / 2, y: DUN.gy + cy * DUN.C + DUN.C / 2 });
function dunFlow(f, x, y) {                                                     // how many steps every cell is from (x, y), walking round the walls (-1: wall)
  const { cols, rows } = DUN, flow = f.flow || (f.flow = new Int16Array(cols * rows)), s = cellOf(x, y);
  flow.fill(-1); const q = [s.cx + s.cy * cols]; flow[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const c = q[h], cx = c % cols, cy = (c / cols) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const X = cx + dx, Y = cy + dy; if (X < 0 || Y < 0 || X >= cols || Y >= rows) continue;
      const n = X + Y * cols; if (flow[n] >= 0 || f.block[n]) continue;
      if (dx && dy && (f.block[cx + dx + cy * cols] || f.block[cx + (cy + dy) * cols])) continue;
      flow[n] = flow[c] + 1; q.push(n);
    }
  }
  f.flowAt = [s.cx, s.cy];
}
function dunWaypoint(f, m) {                                                    // the next cell on the way to the hero
  const { cols, rows } = DUN, c = cellOf(m.x, m.y); let best = null, bv = 1e9;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue; const X = c.cx + dx, Y = c.cy + dy; if (X < 0 || Y < 0 || X >= cols || Y >= rows) continue;
    const v = f.flow[X + Y * cols]; if (v < 0) continue;
    if (dx && dy && (f.block[c.cx + dx + c.cy * cols] || f.block[c.cx + (c.cy + dy) * cols])) continue;
    if (v < bv) { bv = v; best = { X, Y }; }
  }
  return best ? cellXY(best.X, best.Y) : null;
}

// ---------------------------------------------------------------- making a floor
function genFloor(d, idx) {                                                        // a floor whose stairs can be walked between; a chest or creature shut in by the walls is taken out
  let f = null;
  for (let i = 0; i < 6; i++) {
    f = genFloorOnce(d, idx);
    dunFlow(f, f.up.x + 80 * f.up.dir, f.up.y);
    const can = (x, y) => { const c = cellOf(x, y); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = c.cx + dx, Y = c.cy + dy; if (X >= 0 && Y >= 0 && X < DUN.cols && Y < DUN.rows && f.flow[X + Y * DUN.cols] >= 0) return true; } return false; };
    if (!can(f.down ? f.down.x : f.up.x, f.down ? f.down.y : f.up.y)) continue;
    if (f.last && (f.chests.some(c => c.kind === 'gold' && !can(c.x, c.y)) || (f.boss && !can(f.boss.x, f.boss.y)))) continue;
    const inVault = o => f.vault && o.x > f.vault.x0 && o.x < f.vault.x1 && o.y > f.vault.y0 && o.y < f.vault.y1;
    f.chests = f.chests.filter(c => inVault(c) || can(c.x, c.y)); f.enemies = f.enemies.filter(m => inVault(m) || can(m.x, m.y));
    break;
  }
  enemies = f.enemies; return f;
}
function genFloorOnce(d, idx) {
  const last = idx === d.floors - 1, W = DUN, pal = dunPal(), rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
  const f = { idx, last, solids: [], blocks: [], pillars: [], torches: [], chests: [], enemies: [], boss: null, bossDead: false, flow: null, flowAt: [-1, -1], flowT: 0, block: new Uint8Array(W.cols * W.rows), layout: '', seen: new Uint8Array(W.cols * W.rows), mats: [] };
  const wallRect = (x0, y0, x1, y1) => { f.solids.push({ x0, y0, x1, y1 }); for (let y = y0; y < y1; y += 40) f.blocks.push({ x0, y0: y, x1, y1: Math.min(y1, y + 40) }); };
  wallRect(W.x0 - 120, W.y0 - 120, W.x1 + 120, W.y0); wallRect(W.x0 - 120, W.y1, W.x1 + 120, W.y1 + 120); wallRect(W.x0 - 120, W.y0, W.x0, W.y1); wallRect(W.x1, W.y0, W.x1 + 120, W.y1);
  const mid = (W.y0 + W.y1) / 2;
  // the stairs: anywhere along the side walls, on either side, and now and then both on the same side (never the old straight line across)
  const sy = () => rnd(W.y0 + 220, W.y1 - 220), LX = W.x0 + 110, RX = W.x1 - 110, upLeft = last ? true : Math.random() < 0.5, upY = sy();
  f.up = { x: upLeft ? LX : RX, y: upY, dir: upLeft ? 1 : -1 };
  if (last) f.down = null;
  else {
    let same = Math.random() < 0.28, dy = sy(); for (let t = 0; t < 40 && Math.abs(dy - upY) < (same ? 560 : 260); t++) { dy = sy(); if (t === 30) same = false; }
    const dl = same ? upLeft : !upLeft; f.down = { x: dl ? LX : RX, y: dy, dir: dl ? 1 : -1 };
  }
  const leftYs = [f.up, f.down].filter(s => s && s.dir === 1).map(s => s.y), rightYs = [f.up, f.down].filter(s => s && s.dir === -1).map(s => s.y);
  const keep = [{ x: f.up.x, y: f.up.y, r: 190 }]; if (f.down) keep.push({ x: f.down.x, y: f.down.y, r: 190 });
  const clear = (x, y, r) => !keep.some(k => Math.hypot(x - k.x, y - k.y) < k.r + r) && !f.solids.some(s => s.r !== undefined ? Math.hypot(x - s.x, y - s.y) < s.r + r : rectDist(s, x, y) < r)
    && x > W.x0 + 90 && x < W.x1 - 90 && y > W.y0 + 90 && y < W.y1 - 90;
  const spot = (r, extra = () => true, tries = 80) => { for (let i = 0; i < tries; i++) { const x = rnd(W.x0 + 100, W.x1 - 100), y = rnd(W.y0 + 100, W.y1 - 100); if (clear(x, y, r) && extra(x, y)) return { x, y }; } return null; };
  const pillars = n => { for (let i = 0; i < n; i++) { const p = spot(70, (x, y) => !f.pillars.some(q => Math.hypot(q.x - x, q.y - y) < 150)); if (p) { const pl = { x: p.x, y: p.y, r: 26 }; f.pillars.push(pl); f.solids.push(pl); } } };
  const gapWall = (x, gaps, th = 60) => {                                       // a wall from top to bottom with openings (gaps: [centre y, height])
    gaps.sort((a, b) => a[0] - b[0]); let y = W.y0;
    for (const [gy, gh] of gaps) { if (gy - gh / 2 > y) wallRect(x, y, x + th, gy - gh / 2); y = gy + gh / 2; }
    if (y < W.y1) wallRect(x, y, x + th, W.y1);
  };
  const IN0 = W.x0 + 260, IN1 = W.x1 - 260;                                      // the middle of the floor; the strips beside it stay open round the stairs
  const nearMid = (y, list, gap) => list.every(h => Math.abs(h - y) > gap);
  const layout = last ? 'boss' : pick(idx === 0 ? ['hall', 'split', 'rooms', 'crypt', 'maze', 'cross', 'colonnade', 'islands', 'serpent'] : ['hall', 'split', 'chambers', 'maze', 'maze', 'rooms', 'rooms', 'ring', 'crypt', 'cross', 'colonnade', 'islands', 'islands', 'serpent', 'serpent']); f.layout = layout;
  if (layout === 'hall') pillars(Math.round(rnd(9, 15)));
  else if (layout === 'split') { gapWall(rnd(980, 1380), [[rnd(520, 760), 260], [rnd(1000, 1200), 260]]); pillars(Math.round(rnd(5, 9))); }
  else if (layout === 'chambers') { gapWall(rnd(760, 880), [[rnd(520, 800), 280]]); gapWall(rnd(1560, 1680), [[rnd(900, 1200), 280]]); pillars(Math.round(rnd(3, 6))); }
  else if (layout === 'maze') {                                                  // a labyrinth of narrow passages, with a few loops so nothing is a dead end for ever
    const P = 190, T = 50, cols = Math.floor((IN1 - IN0) / P), rows = Math.floor((W.y1 - W.y0) / P), mx = IN0 + ((IN1 - IN0) - cols * P) / 2, my = W.y0 + ((W.y1 - W.y0) - rows * P) / 2;
    const wv = Array.from({ length: cols + 1 }, () => Array(rows).fill(true)), wh = Array.from({ length: rows + 1 }, () => Array(cols).fill(true));
    const seen = Array.from({ length: cols }, () => Array(rows).fill(false)), st = [[0, 0]]; seen[0][0] = true;
    while (st.length) {
      const [c, r] = st[st.length - 1], nb = [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < cols && b < rows && !seen[a][b]);
      if (!nb.length) { st.pop(); continue; }
      const [a, b] = pick(nb); seen[a][b] = true; if (a !== c) wv[Math.max(a, c)][r] = false; else wh[Math.max(b, r)][c] = false; st.push([a, b]);
    }
    for (let i = 0; i < cols * rows * 0.4; i++) { if (Math.random() < 0.5) wv[1 + Math.floor(Math.random() * (cols - 1))][Math.floor(Math.random() * rows)] = false; else wh[1 + Math.floor(Math.random() * (rows - 1))][Math.floor(Math.random() * cols)] = false; }
    for (let c = 1; c < cols; c++) for (let r = 0; r < rows; r++) if (wv[c][r]) wallRect(mx + c * P - T / 2, my + r * P - (r ? T / 2 : 0), mx + c * P + T / 2, my + (r + 1) * P + (r < rows - 1 ? T / 2 : 0));
    for (let r = 1; r < rows; r++) for (let c = 0; c < cols; c++) if (wh[r][c]) wallRect(mx + c * P - (c ? T / 2 : 0), my + r * P - T / 2, mx + (c + 1) * P + (c < cols - 1 ? T / 2 : 0), my + r * P + T / 2);
  }
  else if (layout === 'rooms') {                                                 // three columns of rooms, each split in two, joined by doorways
    const xs = [IN0, Math.round(IN0 + (IN1 - IN0) / 3 + rnd(-40, 40)), Math.round(IN0 + (IN1 - IN0) * 2 / 3 + rnd(-40, 40)), IN1 - 50], hy = [];
    for (let i = 0; i < 3; i++) { let y = rnd(520, 1140); for (let k = 0; k < 40; k++) { y = rnd(520, 1140); if ((i > 0 || leftYs.every(v => Math.abs(y - v) > 240)) && (i < 2 || rightYs.every(v => Math.abs(y - v) > 240))) break; } hy.push(y); }
    xs.forEach((x, k) => {
      const gaps = k === 0 ? (leftYs.length ? leftYs : [rnd(520, 1140)]).map(v => [v, 300]) : k === 3 ? (rightYs.length ? rightYs : [rnd(520, 1140)]).map(v => [v, 300]) : [];
      if (k > 0 && k < 3) for (let n = 0; n < 2; n++) { let y = 600; for (let t = 0; t < 40; t++) { y = rnd(380, 1280); if (nearMid(y, [hy[k - 1], hy[k]], 190) && nearMid(y, gaps.map(g => g[0]), 330)) break; } gaps.push([y, 190]); }
      gapWall(x, gaps, 50);
    });
    for (let i = 0; i < 3; i++) { const x0 = xs[i] + 50, x1 = xs[i + 1], gx = rnd(x0 + 130, x1 - 130); wallRect(x0, hy[i] - 25, gx - 95, hy[i] + 25); wallRect(gx + 95, hy[i] - 25, x1, hy[i] + 25); }
  }
  else if (layout === 'cross') {                                                 // four wings round a cross of walls, each wall pierced twice
    const mx = Math.round((IN0 + IN1) / 2 + rnd(-140, 140)), g1 = IN0 + rnd(160, 420), g2 = IN1 - rnd(160, 420);
    gapWall(mx, [[rnd(500, 610), 260], [rnd(1050, 1160), 260]], 56);
    wallRect(IN0, mid - 25, g1 - 130, mid + 25); wallRect(g1 + 130, mid - 25, g2 - 130, mid + 25); wallRect(g2 + 130, mid - 25, IN1, mid + 25);
    pillars(Math.round(rnd(2, 5)));
  }
  else if (layout === 'colonnade') {                                              // two long rows of pillars with aisles between, and a few strays
    for (const dy of [-250, 250]) for (let x = IN0 + 60; x < IN1 - 40; x += 150) { if (Math.random() < 0.12) continue; const p = { x, y: mid + dy, r: 26 }; f.pillars.push(p); f.solids.push(p); }
    for (const dy of [-460, 460]) for (let x = IN0 + 130; x < IN1 - 100; x += 300) { const p = { x: x + rnd(-30, 30), y: mid + dy, r: 26 }; if (p.y > W.y0 + 100 && p.y < W.y1 - 100) { f.pillars.push(p); f.solids.push(p); } }
    wallRect((IN0 + IN1) / 2 - 110, mid - 38, (IN0 + IN1) / 2 + 110, mid + 38);
  }
  else if (layout === 'islands') {                                                // blocks of fallen masonry scattered over a cave-like floor
    const blocks = [];
    for (let i = 0, n = Math.round(rnd(7, 11)); i < n; i++) {
      const p = spot(150, (x, y) => x > IN0 + 80 && x < IN1 - 80 && !blocks.some(b => Math.hypot(b.x - x, b.y - y) < 330)); if (!p) continue;
      blocks.push(p); const hw = rnd(55, 130), hh = rnd(45, 105); wallRect(p.x - hw, p.y - hh, p.x + hw, p.y + hh);
    }
    pillars(Math.round(rnd(1, 4)));
  }
  else if (layout === 'serpent') {                                                // long walls, each open at one end only: the way winds back and forth
    const n = 4 + Math.floor(Math.random() * 2), step = (IN1 - IN0) / (n + 1); let top = Math.random() < 0.5;
    for (let i = 1; i <= n; i++) { gapWall(Math.round(IN0 + i * step - 25), [[top ? W.y0 + 150 : W.y1 - 150, 300]], 50); top = !top; }
    pillars(Math.round(rnd(1, 3)));
  }
  else if (layout === 'ring') {                                                  // a great block in the middle to walk round, pillars at its corners
    const mx = (IN0 + IN1) / 2; wallRect(mx - 280, mid - 160, mx + 280, mid + 160);
    for (const [px, py] of [[-380, -250], [380, -250], [-380, 250], [380, 250], [0, -300], [0, 300]]) { const p = { x: mx + px, y: mid + py, r: 26 }; f.pillars.push(p); f.solids.push(p); }
    pillars(Math.round(rnd(1, 4)));
  }
  else if (layout === 'crypt') {                                                 // rows of stone coffins
    for (let x = IN0 + 40; x < IN1 - 60; x += 250) for (let y = W.y0 + 150; y < W.y1 - 160; y += 200) {
      if (Math.random() < 0.22) continue;
      const cx = x + rnd(-36, 36), cy = y + rnd(-30, 30); if (Math.hypot(cx - f.up.x, cy - f.up.y) < 260 || (f.down && Math.hypot(cx - f.down.x, cy - f.down.y) < 260)) continue;
      wallRect(cx - 62, cy - 30, cx + 62, cy + 30);
    }
    pillars(Math.round(rnd(2, 5)));
  }
  else {                                                                         // the last floor: an arena, and the treasure room behind the boss
    gapWall(1900, [[mid, 280]]); keep.push({ x: 1450, y: mid, r: 230 });
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.4, p = { x: 1400 + Math.cos(a) * 430, y: mid + Math.sin(a) * 300, r: 26 }; if (p.y > W.y0 + 100 && p.y < W.y1 - 100) { f.pillars.push(p); f.solids.push(p); } }
  }
  f.style = pick(['flags', 'flags', 'cobble', 'diamond', 'mosaic']);
  // the vault: a locked room in a corner of some floors; the Vault Warden carries its key
  if (!last && idx >= 1 && layout !== 'maze' && Math.random() < 0.65) {
    for (let tries = 0; tries < 70 && !f.vault; tries++) {
      const north = Math.random() < 0.5, vx = Math.round(rnd(W.x0 + 460, W.x1 - 880)), oy0 = north ? W.y0 : W.y1 - 310;
      const area = { x0: vx - 150, y0: north ? W.y0 : W.y1 - 470, x1: vx + 530, y1: north ? W.y0 + 470 : W.y1 };          // (and clear in front of its door)
      if (f.solids.some(s => s.r !== undefined ? rectDist(area, s.x, s.y) < s.r : !(s.x1 <= area.x0 || s.x0 >= area.x1 || s.y1 <= area.y0 || s.y0 >= area.y1))) continue;
      const wy = north ? W.y0 + 260 : W.y1 - 310, cx = vx + 190, cy = north ? W.y0 + 130 : W.y1 - 130;
      wallRect(vx, oy0, vx + 50, oy0 + 310); wallRect(vx + 330, oy0, vx + 380, oy0 + 310); wallRect(vx + 50, wy, vx + 128, wy + 50); wallRect(vx + 252, wy, vx + 330, wy + 50);
      const door = { x0: vx + 128, x1: vx + 252, y0: wy, y1: wy + 50, door: true, cx, cy: wy + 25, front: north ? wy + 100 : wy - 50 }; f.solids.push(door);
      f.vault = { x0: vx, y0: oy0, x1: vx + 380, y1: oy0 + 310, cx, cy, north, open: false, door }; keep.push({ x: cx, y: cy, r: 215 });
    }
  }
  // traps: spikes in the floor, vents of fire, and stone statues that spit darts
  f.traps = [];
  if (!last) for (let i = 0, n = Math.round(rnd(2, 3.6) + idx * 0.5); i < n; i++) {
    const kind = pick(layout === 'maze' ? ['spikes', 'spikes', 'vent'] : ['spikes', 'spikes', 'vent', 'darts']), p = spot(kind === 'darts' ? 60 : 50, (x, y) => !f.traps.some(q => Math.hypot(q.x - x, q.y - y) < 260));
    if (!p) continue;
    f.traps.push({ kind, x: p.x, y: p.y, t: rnd(0, 3), cd: rnd(0.5, 2), aim: 0, hit: false }); keep.push({ x: p.x, y: p.y, r: 80 });
    if (kind === 'darts') f.solids.push({ x: p.x, y: p.y, r: 15 });
  }
  dunBakeBlock(f);
  f.cracks = [];                                                                 // where light falls through the ceiling
  for (let i = 0, n = last ? 2 : Math.round(rnd(2, 4)); i < n; i++) { const p = spot(70, (x, y) => !f.cracks.some(q => Math.hypot(q.x - x, q.y - y) < 420) && (!last || x < 1800)); if (p) f.cracks.push({ x: p.x, y: p.y, r: rnd(54, 84), dir: Math.random() < 0.5 ? -1 : 1, ph: rnd(0, 6) }); }
  // torches along the north wall, and by the stairs
  for (let x = W.x0 + 220; x < W.x1 - 120; x += 330) f.torches.push({ x, y: W.y0 - 30, r: 190, wall: true });
  if (f.vault) f.torches.push({ x: f.vault.cx, y: f.vault.cy - 30, r: 170 });
  f.torches.push({ x: f.up.x + 36 * f.up.dir, y: f.up.y - 50, r: 150 }); if (f.down) f.torches.push({ x: f.down.x + 36 * f.down.dir, y: f.down.y - 50, r: 150 });
  // chests: wooden ones in the corners, iron (locked, slower to open, better) from the second floor, the golden one behind the boss
  const nWood = Math.round(rnd(2, 3.4)), nIron = idx >= 1 ? (Math.random() < 0.7 ? 1 : 0) + (idx >= 3 ? 1 : 0) : (Math.random() < 0.25 ? 1 : 0);
  const addChest = (kind, p) => { if (p) f.chests.push({ kind, x: p.x, y: p.y, open: false, p: 0, locked: kind === 'gold' }); };
  for (let i = 0; i < nWood + nIron; i++) addChest(i < nWood ? 'wood' : 'iron', spot(60, (x, y) => !f.chests.some(c => Math.hypot(c.x - x, c.y - y) < 260) && Math.hypot(x - f.up.x, y - f.up.y) > 330));
  if (f.vault) for (const sx of [115, 265]) f.chests.push({ kind: 'iron', x: f.vault.x0 + sx, y: f.vault.cy + 20, open: false, p: 0, locked: false, vault: true });
  if (idx >= 1 && !last && Math.random() < 0.4) { const cand = f.chests.filter(c => !c.vault && c.kind !== 'gold'); if (cand.length) pick(cand).mimic = true; }
  if (last) { addChest('gold', { x: 2090, y: mid }); keep.push({ x: 2090, y: mid, r: 120 }); f.torches.push({ x: 2090, y: mid - 120, r: 220 }); }
  // the creatures: asleep
  enemies = f.enemies = [];
  const pool = wavePool(), nMob = last ? 0 : Math.min(22, 6 + idx * 2 + Math.floor(wave / 25)), eliteP = Math.min(0.85, 0.55 + idx * 0.08);
  const far = (x, y) => Math.hypot(x - f.up.x, y - f.up.y) > 520 && (!f.down || Math.hypot(x - f.down.x, y - f.down.y) > 260) && (!last || x < 1840 && Math.hypot(x - 1450, y - mid) > 260);
  let placed = 0, guard = 0;
  while (placed < nMob && guard++ < 60) {
    const p = spot(40, far); if (!p) continue;
    const type = pick(pool), packN = Math.random() < 0.3 ? 2 + (Math.random() < 0.4 ? 1 : 0) : 1;
    for (let k = 0; k < packN; k++) {
      const q = k ? { x: p.x + rnd(-70, 70), y: p.y + rnd(-50, 50) } : p; if (k && !clear(q.x, q.y, 36)) continue;
      const m = spawnEnemy(type, q, { spawnT: 0, variant: Math.random() < eliteP ? 'elite' : undefined });
      if (!k && packN > 1) makeLeader(m);
      if (idx >= 1 && !m.elite && EVO[m.type] && Math.random() < 0.3) evolveMob(m);
      m.hp = m.maxHp = Math.round(m.maxHp * (1 + 0.1 * idx)); m.dmg = Math.round(m.dmg * (1 + 0.06 * idx));
      dunPush(m, m.r * 0.8, f); asleepMob(m); placed++;
    }
  }
  if (f.vault) {                                                                 // the Vault Warden: a mini-boss that carries the key
    const p = spot(50, far); if (p) {
      const m = spawnEnemy(pick(pool), p, { spawnT: 0, variant: 'elite' }); if (EVO[m.type]) evolveMob(m);
      m.warden = true; m.name = 'Vault Warden'; m.hp = m.maxHp = Math.round(m.maxHp * 2.6 * (1 + 0.1 * idx)); m.dmg = Math.round(m.dmg * 1.2); m.xp = Math.round(m.xp * 3); m.scale = (m.scale || 1) * 1.2; m.r *= 1.12;
      dunPush(m, m.r * 0.8, f); asleepMob(m);
    }
  }
  if (!last && Math.random() < (idx === 0 ? 0.25 : 0.5)) {                       // a roost of bats
    const p = spot(40, far); if (p) for (let k = 0, n = 3 + Math.floor(Math.random() * 3); k < n; k++) {
      const m = spawnEnemy('bat', { x: p.x + rnd(-50, 50), y: p.y + rnd(-40, 40) }, { spawnT: 0 }); m.hp = m.maxHp = Math.round(m.maxHp * (1 + 0.1 * idx)); m.dmg = Math.round(m.dmg * (1 + 0.06 * idx)); dunPush(m, m.r * 0.8, f); asleepMob(m);
    }
  }
  if (last) {                                                                    // the evolved boss, alone in its chamber
    const kind = BOSS_BY_BIOME[BIOMES[d.zone % BIOMES.length].key] || 'minotaur', b = spawnBossOfKind(kind, { x: 1450, y: mid }, D(), threat());
    b.evolved = true; b.name = 'Ancient ' + b.name; b.maxHp = Math.round(b.maxHp * 1.5); b.hp = b.maxHp; b.dmg = Math.round(b.dmg * 1.2); b.speed *= 1.08; b.xp = Math.round(b.xp * 1.7); b.spawnT = 0;
    b.def = { ...b.def, attacks: { slam: 2, nova: 2, ...b.def.attacks } };       // an evolved boss knows a few more tricks
    enemies.push(b); asleepMob(b); f.boss = b;
  }
  f.ground = bakeFloor(f, pal);
  return f;
}
function dunBakeBlock(f) {                                                        // which cells of the floor are walls (again when a door opens)
  const W = DUN; for (let cx = 0; cx < W.cols; cx++) for (let cy = 0; cy < W.rows; cy++) { const c = cellXY(cx, cy); f.block[cx + cy * W.cols] = dunSolidAt(c.x, c.y, 24, f) ? 1 : 0; }
}
function asleepMob(m) { m.sleep = true; m.sleepHp = m.hp; m.alertT = 0; m.spawnT = 0; m.state = 'walk'; m.stateT = 1; m.moving = false; }

function bakeFloor(f, pal) {
  const g = document.createElement('canvas'); g.width = WW; g.height = WH; const c = g.getContext('2d'), W = DUN;
  c.fillStyle = '#04050a'; c.fillRect(0, 0, WW, WH);
  c.fillStyle = pal.floor; c.fillRect(W.x0, W.y0, W.x1 - W.x0, W.y1 - W.y0);
  const r = (() => { let s = (Math.random() * 1e9) | 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  const style = f.style || 'flags';
  if (style === 'cobble') {                                                                      // round cobbles
    for (let i = 0; i < 2600; i++) { const x = W.x0 + r() * (W.x1 - W.x0), y = W.y0 + r() * (W.y1 - W.y0); c.fillStyle = r() < 0.5 ? pal.floor2 : `rgba(0,0,0,${0.05 + r() * 0.08})`; c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1.4; c.beginPath(); c.ellipse(x, y, 13 + r() * 9, 9 + r() * 6, r() * 3, 0, Math.PI * 2); c.fill(); c.stroke(); }
  } else if (style === 'diamond') {                                                              // a lattice of diamonds
    c.save(); c.beginPath(); c.rect(W.x0, W.y0, W.x1 - W.x0, W.y1 - W.y0); c.clip(); c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 2;
    for (let j = -1; j < (W.y1 - W.y0) / 50 + 2; j++) for (let i = -1; i < (W.x1 - W.x0) / 100 + 2; i++) { const x = W.x0 + i * 100 + (j % 2 ? 50 : 0), y = W.y0 + j * 50; c.fillStyle = (i + j) % 2 ? pal.floor2 : `rgba(0,0,0,${0.03 + r() * 0.07})`; c.beginPath(); c.moveTo(x, y - 50); c.lineTo(x + 50, y); c.lineTo(x, y + 50); c.lineTo(x - 50, y); c.closePath(); c.fill(); c.stroke(); }
    c.restore();
  } else {
    for (let y = W.y0; y < W.y1; y += 80) for (let x = W.x0; x < W.x1; x += 80) {                // flagstones
      if (((x - W.x0) / 80 + (y - W.y0) / 80) % 2 === 0) { c.fillStyle = pal.floor2; c.fillRect(x, y, 80, 80); }
      c.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.07})`; c.fillRect(x + 2, y + 2, 76, 76);
    }
    c.strokeStyle = 'rgba(0,0,0,0.28)'; c.lineWidth = 2; for (let y = W.y0; y <= W.y1; y += 80) { c.beginPath(); c.moveTo(W.x0, y); c.lineTo(W.x1, y); c.stroke(); } for (let x = W.x0; x <= W.x1; x += 80) { c.beginPath(); c.moveTo(x, W.y0); c.lineTo(x, W.y1); c.stroke(); }
    if (style === 'mosaic') {                                                                    // round medallions inlaid in the floor
      for (let i = 0; i < 4; i++) { const x = W.x0 + 300 + r() * (W.x1 - W.x0 - 600), y = W.y0 + 200 + r() * (W.y1 - W.y0 - 400); for (let k = 4; k >= 1; k--) { c.strokeStyle = `rgba(${k % 2 ? '255,255,255' : '0,0,0'},0.16)`; c.lineWidth = 6; c.beginPath(); c.arc(x, y, k * 22, 0, Math.PI * 2); c.stroke(); } c.fillStyle = 'rgba(255,255,255,0.1)'; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; c.beginPath(); c.moveTo(x + Math.cos(a) * 16, y + Math.sin(a) * 16); c.lineTo(x + Math.cos(a + 0.2) * 84, y + Math.sin(a + 0.2) * 84); c.lineTo(x + Math.cos(a - 0.2) * 84, y + Math.sin(a - 0.2) * 84); c.closePath(); c.fill(); } }
    }
  }
  for (let i = 0; i < 120; i++) { c.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${0.04 + r() * 0.06})`; c.beginPath(); c.ellipse(W.x0 + r() * (W.x1 - W.x0), W.y0 + r() * (W.y1 - W.y0), 10 + r() * 40, 6 + r() * 20, r() * 3, 0, Math.PI * 2); c.fill(); }      // stains
  c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1.4; for (let i = 0; i < 60; i++) { let x = W.x0 + r() * (W.x1 - W.x0), y = W.y0 + r() * (W.y1 - W.y0); c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 36; y += (r() - 0.5) * 36; c.lineTo(x, y); } c.stroke(); }   // cracks
  for (let i = 0; i < 34; i++) { const x = W.x0 + r() * (W.x1 - W.x0), y = W.y0 + r() * (W.y1 - W.y0); c.fillStyle = 'rgba(232,224,200,0.55)'; c.fillRect(x, y, 7 + r() * 6, 2); c.fillRect(x + 2, y - 3, 2, 8); }       // scattered bones
  if (pal.name === 'Ember Forge') { c.strokeStyle = 'rgba(255,120,40,0.55)'; c.lineWidth = 3; for (let i = 0; i < 26; i++) { let x = W.x0 + r() * (W.x1 - W.x0), y = W.y0 + r() * (W.y1 - W.y0); c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 60; y += (r() - 0.5) * 60; c.lineTo(x, y); } c.stroke(); } }
  for (const k of f.cracks || []) { c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(k.x, k.y, k.r * 1.1, k.r * 0.55, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(210,205,190,0.4)'; for (let i = 0; i < 16; i++) { const a = r() * 6.3, rr = r() * k.r * 0.9; c.fillRect(k.x + Math.cos(a) * rr, k.y + Math.sin(a) * rr * 0.5, 3 + r() * 6, 2 + r() * 4); } }      // rubble where the roof has fallen in
  if (f.vault) { c.fillStyle = 'rgba(70,40,110,0.55)'; c.fillRect(f.vault.cx - 110, f.vault.cy - 80, 220, 160); c.strokeStyle = '#d9b44a'; c.lineWidth = 3; c.strokeRect(f.vault.cx - 104, f.vault.cy - 74, 208, 148); }
  const rug = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); c.strokeStyle = '#d9b44a'; c.lineWidth = 3; c.strokeRect(x + 6, y + 6, w - 12, h - 12); };
  rug(f.up.x - 90, f.up.y - 70, 180, 140, 'rgba(120,30,40,0.55)'); if (f.down) rug(f.down.x - 90, f.down.y - 70, 180, 140, 'rgba(120,30,40,0.55)');
  if (f.last) { const my = (W.y0 + W.y1) / 2; rug(1930, my - 150, 330, 300, 'rgba(100,26,60,0.6)'); c.fillStyle = 'rgba(255,216,106,0.12)'; c.beginPath(); c.arc(2090, my, 130, 0, Math.PI * 2); c.fill(); }
  const sh = c.createLinearGradient(0, W.y0, 0, W.y0 + 90); sh.addColorStop(0, 'rgba(0,0,0,0.5)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sh; c.fillRect(W.x0, W.y0, W.x1 - W.x0, 90);        // shade under the north wall
  return g;
}

// ---------------------------------------------------------------- going in and out
function dungeonRoll() {                                                         // called as a wave is cleared: sometimes a stone door opens
  if (dun || dunDoor || dunRolled || state !== 'play' || boss || wave < 2 || (wave + 1) % WAVES_PER_SET === 0 || hero.dead) return;
  dunRolled = true;
  const boost = dunChance > 0 && (hero.rumorDun | 0) > 0; if (boost) hero.rumorDun--;
  if (Math.random() > (boost ? Math.min(0.6, dunChance * 12 + 0.2) : dunChance)) return;
  const a = Math.random() * Math.PI * 2, d = 260 + Math.random() * 120, design = DUN_DOOR_PICKS[Math.floor(Math.random() * DUN_DOOR_PICKS.length)];
  dunDoor = { x: Math.max(200, Math.min(WW - 200, hero.x + Math.cos(a) * d)), y: Math.max(300, Math.min(WH - 120, hero.y + Math.sin(a) * d * 0.6)), t: 24, max: 24, p: 0, design };
  waveTimer = Math.max(waveTimer, dunDoor.t + 1);
  popups.push({ text: DUN_DOORS[design].say, x: VW / 2, y: 150, t: 3, screen: true, small: true, color: dunPalFor().glow });
  sfx('unlock'); sfx('quake');
}
const dunPalFor = () => DUN_PAL[BIOMES[zone % BIOMES.length].key] || DUN_PAL.ruins;
function closeDungeonDoor() { if (dunDoor && !dun) { const dd = dunDoor; dunDoor = null; popups.push({ text: DUN_DOORS[dd.design || 'gate'].shut, x: VW / 2, y: 150, t: 1.8, screen: true, small: true, color: '#bbb' }); sfx('quake'); } dunRolled = false; }
function enterDungeon(res) {
  if (dun || !hero || hero.dead) return;
  for (const k in keys) keys[k] = false;
  dun = { zone, floors: res ? res.floors : dunFloors(), idx: res ? res.idx : 0, floorsMade: [], opening: null, fade: 1, cleared: false, chests: res ? res.chests : 0, keys: 0, entry: res ? res.entry : dunDoor ? { x: dunDoor.x, y: dunDoor.y } : { x: hero.x, y: hero.y }, t: 0, made: 0 };
  dun.surface = { enemies: enemies.slice(), boss };
  dunDoor = null; boss = null;
  projectiles = []; heroShots = []; shockwaves = []; clearHazards(); corpses = []; drops = []; particles = []; popups = popups.filter(p => p.screen);
  const f = dun.f = dun.floorsMade[dun.idx] = genFloor(dun, dun.idx);
  enemies = f.enemies; hero.x = f.up.x + 80 * f.up.dir; hero.y = f.up.y; hero.facing = f.up.dir; hero.moving = false; hero.attackT = 0; hero.flipT = 0;
  hero.scarf.forEach(p => { p.x = hero.x; p.y = hero.y - 50; });
  cam.x = Math.max(0, Math.min(WW - VW, hero.x - VW / 2)); cam.y = Math.max(0, Math.min(WH - VH, hero.y - VH / 2 - 20));
  Sound.music('ruins'); sfx('door'); sfx('bell');
  popups.push({ text: dunPal().name, x: VW / 2, y: 120, t: 3, big: true, screen: true, color: dunPal().glow });
  popups.push({ text: `Floor ${dun.idx + 1} of ` + dun.floors + ' · ' + (DUN_LAYOUT_NAME[f.layout] || ''), x: VW / 2, y: 154, t: 2.6, screen: true, small: true, color: '#ddd' });
}
function dunSave() { return dun && !dun.cleared ? { floors: dun.floors, idx: dun.idx, chests: dun.chests | 0, entry: { x: Math.round(dun.entry.x), y: Math.round(dun.entry.y) } } : null; }     // (a cleared dungeon is not worth coming back to)
function dunResume(s) {                                                          // check a saved dungeon before trusting it
  if (!s || typeof s !== 'object') return null;
  const floors = Math.max(8, Math.min(12, Math.floor(Number(s.floors)) || 8)), idx = Math.max(0, Math.min(floors - 1, Math.floor(Number(s.idx)) || 0)), e = s.entry || {};
  return { floors, idx, chests: Math.max(0, Math.min(99, Math.floor(Number(s.chests)) || 0)), entry: { x: Math.max(200, Math.min(WW - 200, Number(e.x) || 1000)), y: Math.max(300, Math.min(WH - 120, Number(e.y) || 700)) } };
}
function switchFloor(i, fromAbove) {
  const old = dun.f; old.enemies = enemies;
  dun.idx = i; dun.fade = 1; dun.opening = null;
  const f = dun.f = dun.floorsMade[i] || (dun.floorsMade[i] = genFloor(dun, i));
  enemies = f.enemies; boss = f.boss && f.boss.hp > 0 && !f.boss.sleep && enemies.includes(f.boss) ? f.boss : null;
  projectiles = []; heroShots = []; shockwaves = []; clearHazards(); particles = [];
  const at = fromAbove ? f.up : f.down; hero.x = at.x + 80 * at.dir; hero.y = at.y; hero.facing = at.dir; hero.moving = false; hero.attackT = 0;
  hero.scarf.forEach(p => { p.x = hero.x; p.y = hero.y - 50; });
  cam.x = Math.max(0, Math.min(WW - VW, hero.x - VW / 2)); cam.y = Math.max(0, Math.min(WH - VH, hero.y - VH / 2 - 20));
  sfx('door'); popups.push({ text: `Floor ${i + 1} of ${dun.floors} · ${DUN_LAYOUT_NAME[f.layout] || ''}`, x: VW / 2, y: 130, t: 2.2, screen: true, small: true, color: '#ddd' });
  Sound.music(boss ? 'boss' : 'ruins');
  saveGame(true, true); popups.push({ text: 'Checkpoint saved', x: VW - 135, y: 78, t: 2, color: '#9f9', screen: true, small: true });
}
function exitDungeon() {
  if (!dun) return;
  const e = dun.entry, done = dun.cleared;
  dun = null; enemies = []; boss = null; corpses = []; drops = drops.filter(d => d.kind === 'gold'); projectiles = []; heroShots = []; shockwaves = []; clearHazards(); particles = []; dunNear = null;
  hero.x = e.x; hero.y = e.y + 50; hero.moving = false; hero.attackT = 0; hero.scarf.forEach(p => { p.x = hero.x; p.y = hero.y - 50; });
  cam.x = Math.max(0, Math.min(WW - VW, hero.x - VW / 2)); cam.y = Math.max(0, Math.min(WH - VH, hero.y - VH / 2 - 20));
  waveTimer = 3; dunRolled = true; sfx('door');
  Sound.music(BIOMES[zone % BIOMES.length].music);
  saveGame(true, true);
  popups.push({ text: done ? 'Back in the daylight, a richer hero' : 'Back on the road', x: VW / 2, y: 150, t: 2.4, screen: true, small: true, color: '#fff' });
}

// ---------------------------------------------------------------- waking up
function wakeMob(m, why) {
  if (!m.sleep) return;
  m.sleep = false; m.alertT = 0.45; m.stateT = 0.4;
  popups.push({ text: '!', x: m.x, y: m.y - 90 * (m.scale || 1), t: 0.9, color: '#ff6a5a', pop: 0 });
  if (m.type === 'boss') { boss = m; sfx('roar'); shake(8); Sound.music('boss'); popups.push({ text: `⚠ ${m.name} ⚠`, x: VW / 2, y: 130, t: 2.6, big: true, screen: true, color: '#f66' }); }
  else sfx('warn');
  if (why !== 'chain') for (const o of enemies) if (o.sleep && o !== m && Math.hypot(o.x - m.x, o.y - m.y) < (m.type === 'boss' ? 420 : 260)) o.wakeIn = 0.15 + Math.random() * 0.45;      // the ones beside it wake with it
}
function dunSleepTick(m, dt, dist) {                                            // true while it is still asleep
  if (m.wakeIn !== undefined) { m.wakeIn -= dt; if (m.wakeIn <= 0) { m.wakeIn = undefined; wakeMob(m, 'chain'); return false; } }
  if (m.hp < m.sleepHp - 0.5 || m.burnT > 0 || (m.wfx && Object.keys(m.wfx).length)) { wakeMob(m, 'hurt'); return false; }
  if (dev.noSpot) { m.moving = false; return true; }
  m.losT = (m.losT || 0) - dt; if (m.losT <= 0) { m.losT = 0.2 + Math.random() * 0.1; m.los = dunLos(m.x, m.y - 20, hero.x, hero.y - 20, 6); }
  const R = (m.type === 'boss' ? 360 : m.elite ? 290 : 240) * (hero.moving ? 1 : 0.65) * (hero.attackT > 0 || hero.flipT > 0 ? 1.45 : 1);
  if (dist < 90 || (dist < R && m.los)) { wakeMob(m, 'seen'); return false; }
  m.moving = false; m.knockX = (m.knockX || 0) * 0.8;
  return true;
}
function dunAfterMove(m, ox, oy, dt) {                                          // called after a creature's own movement: walk round walls, and never through them
  const f = dun.f;
  if (!m.sleep && m.type !== 'boss' && !m.mel && !['charge', 'hop', 'leap', 'windup', 'crouch', 'howl', 'dig', 'surface', 'smashWind'].includes(m.state) && !(m.stunT > 0)) {
    m.losT = (m.losT || 0) - dt; if (m.losT <= 0) { m.losT = 0.18; m.los = dunLos(m.x, m.y - 20, hero.x, hero.y - 20, 10); }
    if (!m.los && f.flow) {
      const wp = dunWaypoint(f, m);
      if (wp) { const mv = Math.max(Math.hypot(m.x - ox, m.y - oy), (m.speed || 60) * dt * 0.5), dx = wp.x - ox, dy = wp.y - oy, d = Math.hypot(dx, dy) || 1, st = Math.min(mv, (m.speed || 60) * 1.1 * dt); m.x = ox + dx / d * st; m.y = oy + dy / d * st; m.facing = Math.sign(dx) || m.facing; }
    }
  }
  dunPush(m, Math.max(10, m.r * 0.8));
  m.x = Math.max(DUN.x0, Math.min(DUN.x1, m.x)); m.y = Math.max(DUN.y0 + 6, Math.min(DUN.y1, m.y));
}

// ---------------------------------------------------------------- chests
const CHEST_TIME = { wood: 1.1, iron: 2.4, gold: 3 };
// the grade of a dungeon reward. Only the golden chest (`gold`) can hold a Mythical (5%) or Secret (1%) piece; every other chest tops out at Legendary, with `leg` the chance it is one,
// otherwise Polished or Legendary (never below `min`); the prestige grade luck still leans it towards Legendary.
// A hidden extra: every prestige adds a sliver (+0.01% Secret, +0.04% Mythical, up to +0.25% and +1% at prestige 25). It is not shown anywhere on purpose.
const dunRarity = (min, t, gold = true, leg = 0) => {
  if (!gold) return Math.random() < leg ? 5 : Math.max(min, Math.min(5, rollRarity(t, false)));
  const rb = rebirths(), sec = 0.01 + Math.min(0.0025, 0.0001 * rb), myth = sec + 0.05 + Math.min(0.01, 0.0004 * rb), x = Math.random(); return x < sec ? 7 : x < myth ? 6 : Math.max(min, Math.min(5, rollRarity(t, false)));
};
const CHEST_LEG = { wood: 0.22, iron: 0.4, vault: 0.5 };                        // the chance a wooden, iron or vault piece is Legendary
const STASH_ODDS = [['heal', 40], ['scroll', 24], ['str', 20], ['luck', 16], ['swift', 14], ['ward', 14]];
const rollStash = () => { let x = Math.random() * STASH_ODDS.reduce((a, c) => a + c[1], 0); for (const [k, w] of STASH_ODDS) if ((x -= w) <= 0) return k; return 'heal'; };
function chestLoot(c) {                                                         // dungeons are rare, so what they hold is generous
  const f = dun.f, x = c.x, y = c.y, tier = depthOf() + 0.7 + f.idx * 0.2, R = Math.random, kind = c.kind, lm = dropLuck() * (1 + gearStat('dropLuck')), vault = !!c.vault;           // (the prestige drop luck counts here too)
  const scat = () => ({ x: x + (R() - 0.5) * 90, y: y + 20 + R() * 40 });
  const gold = Math.round((GOLD_BASE + wave * GOLD_PER_WAVE) * (kind === 'gold' ? 45 : kind === 'iron' ? (vault ? 24 : 18) : 8) * (0.85 + R() * 0.3) * (1 + gearStat('gold')) * rbGoldMul());
  for (let i = 0; i < 7; i++) { const p = scat(); dropItem('gold', p.x, p.y, { amount: Math.max(1, Math.round(gold / 7)) }); }
  const nGear = kind === 'gold' ? 5 : vault ? 3 : kind === 'iron' ? 2 + (R() < 0.4 * dropLuck() ? 1 : 0) : 1 + (R() < 0.35 * dropLuck() ? 1 : 0);
  for (let i = 0; i < nGear; i++) {
    const o = { tier: tier + (kind === 'gold' ? 1.3 : kind === 'iron' ? 0.9 : 0.4), level: hero.level, boss: kind === 'gold' };
    o.rarity = dunRarity(kind === 'gold' && i < 2 || vault && i === 0 ? 5 : 4, tier + (kind === 'gold' ? 1.3 : 0.7), kind === 'gold', vault ? CHEST_LEG.vault : CHEST_LEG[kind]);     // the treasure's first two pieces and a vault's first are Legendary at least
    const p = scat(); dropGear(rollItem(o), p.x, p.y);
  }
  if (kind === 'gold' && R() < 0.5 && f.boss) { const sg = SWORDS.find(s => s.sig === f.boss.kind); if (sg) { const p = scat(); dropGear(rollItem({ slot: 'weapon', base: sg.id, rarity: dunRarity(5, tier + 1, true), boss: true, level: hero.level }), p.x, p.y); } }
  const pots = kind === 'gold' ? 3 : R() < (kind === 'iron' ? 0.85 : 0.5) ? 1 + (kind === 'iron' ? 1 : 0) : 0; for (let i = 0; i < pots; i++) { const p = scat(); dropItem('potion', p.x, p.y); }
  for (let i = 0, n = kind === 'gold' ? 2 + (R() < 0.5 ? 1 : 0) : kind === 'iron' ? (R() < 0.6 ? 1 : 0) + (R() < 0.2 ? 1 : 0) : (R() < 0.4 ? 1 : 0); i < n; i++) { const p = scat(); dropItem('stash', p.x, p.y, { pot: rollStash(), t: 60 }); }      // healing potions, return scrolls and the new boosting potions
  const rp = (kind === 'gold' ? 0.75 : kind === 'iron' ? 0.3 : 0.12) * lm, ep = (kind === 'gold' ? 0.65 : kind === 'iron' ? 0.25 : 0.09) * lm;
  if (R() < rp) { const p = scat(); dropItem('rune', p.x, p.y, { rune: rollRuneKey(kind === 'gold' ? 4 : 2.2), t: 60 }); }
  if (R() < ep) { const p = scat(); dropItem('essence', p.x, p.y, { ess: rollEssKey(kind === 'gold' ? 3 : 1.6), t: 60 }); }
  for (let i = 0, n = kind === 'gold' ? 4 : kind === 'iron' ? 2 : 1; i < n; i++) if (R() < 0.6 + (kind === 'gold' ? 0.4 : 0)) { const p = scat(); dropItem('gem', p.x, p.y); }
}
function openChest(c) {
  c.open = true; c.p = 1; dun.chests++; sfx('unlock'); sfx('coin'); chestLoot(c); questEvent('chest');
  burst(c.x, c.y - 20, c.kind === 'gold' ? '#ffd24a' : '#e8c88a', 22, 190, 3, 120, true);
  popups.push({ text: c.kind === 'gold' ? 'The treasure of the deep!' : 'Chest opened', x: c.x, y: c.y - 70, t: 1.4, color: '#ffd24a' });
  if (c.kind === 'gold') {
    dun.cleared = true; questEvent('dungeon');
    for (let i = 0; i < 3; i++) dropItem('star', c.x - 40 + i * 40, c.y + 50); dropItem('big', c.x, c.y + 70);                  // finishing a dungeon is worth a lot: stat points, a full heal, a rune and an essence for certain
    dropItem('rune', c.x - 60, c.y + 60, { rune: rollRuneKey(4), t: 60 }); dropItem('essence', c.x + 60, c.y + 60, { ess: rollEssKey(3), t: 60 });
    for (let i = 0; i < 8; i++) dropItem('gem', c.x + Math.cos(i) * 70, c.y + 40 + Math.sin(i) * 30);
    popups.push({ text: 'A rich haul: stat points, a rune and an essence', x: VW / 2, y: 168, t: 3.4, screen: true, small: true, color: '#ffd24a' }); popups.push({ text: 'Dungeon cleared!', x: VW / 2, y: 130, t: 3, big: true, screen: true, color: '#ffd24a' }); sfx('victory'); }
}

// ---------------------------------------------------------------- traps, the vault, mimics
const trapDmg = () => Math.round((10 + wave * 1.0) * (1 + 0.08 * (dun ? dun.idx : 0)));
function trapTick(tr, dt) {
  const f = dun.f; tr.t += dt;
  if (tr.kind === 'spikes') {                                                   // down, a warning rise, up (hurts), back
    const ph = tr.t % 3.4; tr.lift = ph < 2.2 ? 0 : ph < 2.7 ? 0.18 + (ph - 2.2) * 0.4 : ph < 3.2 ? 1 : 0.45;
    if (ph < 0.2) { tr.hit = false; tr.snd = false; }
    if (ph >= 2.7 && !tr.snd && inView(tr.x, tr.y, 200)) { tr.snd = true; sfx('slam'); }
    if (tr.lift === 1 && !tr.hit && !hero.dead && Math.abs(hero.x - tr.x) < 36 && Math.abs(hero.y - tr.y) < 26) { tr.hit = true; damageHero(trapDmg()); }
  } else if (tr.kind === 'vent') {                                              // smoulders, glows, bursts into flame
    const ph = tr.t % 4.2; tr.glow = ph < 2.8 ? 0 : ph < 3.4 ? (ph - 2.8) / 0.6 : ph < 4.0 ? 1 : 0; tr.burst = ph >= 3.4 && ph < 4.0;
    if (ph < 0.2) { tr.hit = false; tr.snd = false; }
    if (tr.burst && !tr.snd && inView(tr.x, tr.y, 200)) { tr.snd = true; sfx('lava'); }
    if (tr.burst && !tr.hit && !hero.dead && Math.hypot(hero.x - tr.x, (hero.y - tr.y) * 1.5) < 48) { tr.hit = true; if (damageHero(trapDmg()) && !hero.dead) addAilment('burn'); }
  } else {                                                                      // the statue watches, glares, and spits a dart
    tr.cd -= dt;
    if (tr.aim > 0) {
      tr.aim -= dt;
      if (tr.aim <= 0) { const a = Math.atan2(hero.y - 30 - (tr.y - 24), hero.x - tr.x); projectiles.push({ x: tr.x + Math.cos(a) * 26, y: tr.y - 24 + Math.sin(a) * 26, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, t: 2.4, dmg: trapDmg(), orb: '#cbb8ff', src: null }); sfx('arrow'); }
    } else if (tr.cd <= 0 && !hero.dead && Math.hypot(hero.x - tr.x, hero.y - tr.y) < 460 && dunLos(tr.x, tr.y - 20, hero.x, hero.y - 20, 6)) { tr.aim = 0.55; tr.cd = 2.8; sfx('warn'); }
  }
}
function openVault(f) {
  f.vault.open = true; f.solids = f.solids.filter(s => !s.door); dunBakeBlock(f); f.flowT = 0;
  sfx('unlock'); sfx('door'); shake(5); burst(f.vault.door.cx, f.vault.door.cy, '#ffd24a', 16, 160, 3, 100, true);
  popups.push({ text: 'The vault door swings open', x: VW / 2, y: 130, t: 2.4, screen: true, small: true, color: '#ffd24a' });
}
function revealMimic(c) {                                                       // it was never a chest
  const f = dun.f; f.chests = f.chests.filter(x => x !== c); c.open = true;
  const m = spawnEnemy('mimic', { x: c.x, y: c.y + 12 }, { spawnT: 0 }); m.hp = m.maxHp = Math.round(m.maxHp * (1 + 0.1 * f.idx)); m.dmg = Math.round(m.dmg * (1 + 0.06 * f.idx)); m.alertT = 0.45; m.stateT = 0.4;
  popups.push({ text: 'A mimic!', x: c.x, y: c.y - 90, t: 1.4, color: '#ff6a5a' }); sfx('roar'); shake(6); burst(c.x, c.y - 20, '#e8c88a', 18, 200, 3, 100, true);
}

// ---------------------------------------------------------------- every frame
function updateDungeon(dt) {
  if (!hero || state !== 'play') return;
  if (!dun) {                                                                   // the stone door on the surface
    dunNear = null;
    if (dunDoor) {
      dunDoor.t -= dt; dunDoor.p = Math.min(1, dunDoor.p + dt * 1.5);
      if (dunDoor.t <= 0) closeDungeonDoor();
      else if (!hero.dead && Math.hypot(hero.x - dunDoor.x, (hero.y - dunDoor.y) * 1.4) < 100) dunNear = { kind: 'door', x: dunDoor.x, y: dunDoor.y - 60, label: `E  Enter the ${DUN_DOORS[dunDoor.design || 'gate'].name} (${dunPalFor().name})` };
    }
    return;
  }
  const f = dun.f; dun.t += dt; dun.fade = Math.max(0, dun.fade - dt * 1.6);
  if (hero.dead) return;
  const hc = cellOf(hero.x, hero.y); f.flowT -= dt;
  if (f.flowT <= 0 || hc.cx !== f.flowAt[0] || hc.cy !== f.flowAt[1]) { if (f.flowT <= 0 || !f.flow) { dunFlow(f, hero.x, hero.y); f.flowT = 0.25; } }
  for (let dy = -4; dy <= 4; dy++) for (let dx = -5; dx <= 5; dx++) { const X = hc.cx + dx, Y = hc.cy + dy; if (X >= 0 && Y >= 0 && X < DUN.cols && Y < DUN.rows) f.seen[X + Y * DUN.cols] = 1; }
  // sleepers snore
  dun.zT = (dun.zT || 0) - dt;
  if (dun.zT <= 0) { dun.zT = 1.3; for (const m of enemies) if (m.sleep && inView(m.x, m.y, 40)) popups.push({ text: 'z', x: m.x + 10, y: m.y - 74 * (m.scale || 1), t: 1.1, color: '#9fb6e0', small: true }); }
  // the boss's seal
  if (f.last && f.boss && !f.bossDead && !enemies.includes(f.boss) && f.boss.hp <= 0) {
    f.bossDead = true; const g = f.chests.find(c => c.kind === 'gold'); if (g) g.locked = false;
    popups.push({ text: 'The seal on the treasure breaks', x: VW / 2, y: 130, t: 3, screen: true, small: true, color: '#ffd24a' }); sfx('unlock');
  }
  for (const tr of f.traps) trapTick(tr, dt);
  // a chest being opened
  if (dun.opening) {
    const o = dun.opening, c = o.chest, T = CHEST_TIME[c.kind] || 1.2;
    if (Math.hypot(hero.x - c.x, hero.y - c.y) > 80 || hero.hurtT > 0.5 || hero.attackT > 0 || hero.flipT > 0) { dun.opening = null; popups.push({ text: 'Interrupted', x: hero.x, y: hero.y - 90, t: 0.9, color: '#f88', small: true }); sfx('denied'); }
    else { o.t += dt; c.p = Math.min(0.85, o.t / T * 0.85); if (Math.random() < dt * 8) burst(c.x, c.y - 20, '#e8c88a', 1, 40, 1.6, 0, true); if (o.t >= T) { dun.opening = null; openChest(c); } }
  }
  // what E would do
  dunNear = null; let bd = 1e9;
  const cons = (kind, ref, x, y, r, label) => { const d = Math.hypot(hero.x - x, (hero.y - y) * 1.3); if (d < r && d < bd) { bd = d; dunNear = { kind, ref, x, y: y - 56, label }; } };
  cons('up', f, f.up.x, f.up.y, 92, f.idx === 0 ? 'E  Leave the dungeon' : 'E  Go up the stairs');
  if (f.down) cons('down', f, f.down.x, f.down.y, 92, 'E  Go down the stairs');
  if (f.vault && !f.vault.open) cons('vault', f.vault, f.vault.door.cx, f.vault.door.front, 120, dun.keys > 0 ? 'E  Unlock the vault' : 'The vault is locked: the Vault Warden carries the key');
  for (const c of f.chests) if (!c.open) cons('chest', c, c.x, c.y, 62, c.locked ? 'The chest is sealed...' : `E  Open the ${c.kind === 'gold' ? 'golden ' : c.kind === 'iron' ? 'iron ' : ''}chest`);
}
function dungeonInteract() {                                                    // the E key
  if (hero.dead || paused) return;
  if (!dun) { if (dunDoor && dunNear && dunNear.kind === 'door') enterDungeon(); return; }
  const n = dunNear; if (!n || dun.fade > 0.5) return;
  if (n.kind === 'up') { if (dun.f.idx === 0) exitDungeon(); else switchFloor(dun.f.idx - 1, false); }
  else if (n.kind === 'down') switchFloor(dun.f.idx + 1, true);
  else if (n.kind === 'vault') { if (dun.keys > 0) { dun.keys--; openVault(dun.f); } else { sfx('denied'); popups.push({ text: 'Locked. Find the key: a Vault Warden carries it', x: n.x, y: n.y - 20, t: 1.6, color: '#f88', small: true }); } }
  else if (n.kind === 'chest' && n.ref.mimic) revealMimic(n.ref);
  else if (n.kind === 'chest') { const c = n.ref; if (c.locked) { sfx('denied'); popups.push({ text: 'A seal holds it shut: defeat the guardian', x: c.x, y: c.y - 80, t: 1.4, color: '#f88', small: true }); } else if (!dun.opening) { dun.opening = { chest: c, t: 0 }; sfx('click'); } }
}

// ---------------------------------------------------------------- drawing
function drawDunBlock(b, pal) {
  const w = b.x1 - b.x0, h = b.y1 - b.y0, H = DUN.wallH;
  if (b.x1 < cam.x - 20 || b.x0 > cam.x + VW + 20 || b.y1 < cam.y - 20 || b.y0 - H > cam.y + VH + 20) return;
  const x0 = Math.max(b.x0, cam.x - 40), x1 = Math.min(b.x1, cam.x + VW + 40);
  ctx.fillStyle = pal.top; ctx.fillRect(x0, b.y0 - H, x1 - x0, h);
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x0, b.y0 - H, x1 - x0, 3);
  ctx.fillStyle = pal.wall; ctx.fillRect(x0, b.y1 - H, x1 - x0, H);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
  for (let yy = b.y1 - H + 12; yy < b.y1; yy += 12) { ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke(); }
  const off = Math.floor(b.y1 / 12) % 2 ? 20 : 0;
  for (let xx = Math.floor(x0 / 40) * 40 + off; xx < x1; xx += 40) for (let yy = b.y1 - H; yy < b.y1 - 1; yy += 24) { ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy + 12); ctx.stroke(); }
  ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fillRect(x0, b.y1 - 4, x1 - x0, 4); ctx.fillStyle = pal.edge; ctx.fillRect(x0, b.y1, x1 - x0, 2);
}
function drawDunPillar(p, pal) {
  ell(p.x, p.y + 3, p.r * 1.25, p.r * 0.5, 'rgba(0,0,0,0.38)');
  const g = ctx.createLinearGradient(p.x - p.r, 0, p.x + p.r, 0); g.addColorStop(0, pal.wall); g.addColorStop(0.45, pal.top); g.addColorStop(1, pal.edge);
  ctx.fillStyle = g; ctx.fillRect(p.x - p.r, p.y - 78, p.r * 2, 78); ell(p.x, p.y, p.r, p.r * 0.42, pal.edge);
  ctx.fillStyle = pal.top; ell(p.x, p.y - 78, p.r, p.r * 0.42, pal.top); ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; for (let y = p.y - 70; y < p.y; y += 16) { ctx.beginPath(); ctx.moveTo(p.x - p.r, y); ctx.lineTo(p.x + p.r, y); ctx.stroke(); }
}
function drawDunTorch(t) {
  const fl = 1 + Math.sin(tAnim * 11 + t.x) * 0.12 + Math.sin(tAnim * 23 + t.x * 2) * 0.06;
  ctx.fillStyle = '#3a2a1c'; ctx.fillRect(t.x - 3, t.y - 4, 6, 18);
  ctx.fillStyle = '#ff9a2a'; ctx.beginPath(); ctx.ellipse(t.x, t.y - 10, 6 * fl, 11 * fl, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.ellipse(t.x, t.y - 7, 3 * fl, 6 * fl, 0, 0, Math.PI * 2); ctx.fill();
}
function drawDunStairs(f, down) {
  const s = down ? f.down : f.up, pal = dunPal(), exit = !down && f.idx === 0;
  ell(s.x, s.y + 4, 70, 26, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = exit ? pal.glow : '#08090f'; ctx.globalAlpha = exit ? 0.35 : 1; ctx.beginPath(); ctx.ellipse(s.x, s.y - 4, 56, 26, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  for (let i = 0; i < 4; i++) { ctx.fillStyle = mixHex(pal.top, '#000000', 0.15 + i * 0.12 + (down ? 0.1 : 0)); ctx.fillRect(s.x - 54 + i * 4, s.y - 22 + i * 9, 108 - i * 8, 9); }
  ctx.strokeStyle = pal.glow; ctx.lineWidth = 2; ctx.globalAlpha = 0.5 + Math.sin(tAnim * 3) * 0.2; ctx.beginPath(); ctx.ellipse(s.x, s.y - 4, 62, 30, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.globalAlpha = 0.75; ctx.fillText(exit ? 'EXIT' : down ? '▼' : '▲', s.x, s.y - 34); ctx.globalAlpha = 1; ctx.textAlign = 'left';
}
function drawDunChest(c) {
  const x = c.x, y = c.y, col = c.kind === 'gold' ? ['#d9a82a', '#7a5a10', '#fff0a0'] : c.kind === 'iron' ? ['#7d8796', '#3a4150', '#cfd6e0'] : ['#8a5a30', '#4a2e16', '#d9b44a'];
  ell(x, y + 4, 30, 9, 'rgba(0,0,0,0.35)');
  if (c.kind === 'gold' && !c.open) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y - 14, 4, x, y - 14, 70); g.addColorStop(0, `rgba(255,210,90,${c.locked ? 0.15 : 0.4 + Math.sin(tAnim * 4) * 0.1})`); g.addColorStop(1, 'rgba(255,210,90,0)'); ctx.fillStyle = g; ctx.fillRect(x - 70, y - 84, 140, 140); ctx.restore(); }
  ctx.fillStyle = col[0]; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.6; ctx.fillRect(x - 22, y - 20, 44, 22); ctx.strokeRect(x - 22, y - 20, 44, 22);
  ctx.fillStyle = col[1]; ctx.fillRect(x - 22, y - 20, 44, 5);
  const lift = c.open ? 1 : c.p;                                                    // the lid
  ctx.save(); ctx.translate(x, y - 20); ctx.fillStyle = col[0]; ctx.beginPath();
  if (c.open || lift > 0.1) { const a = Math.min(1, lift) * 0.9; ctx.moveTo(-22, 0); ctx.lineTo(-22 - 4 * a, -16 * Math.cos(a)); ctx.lineTo(22 + 4 * a, -16 * Math.cos(a)); ctx.lineTo(22, 0); ctx.closePath(); }
  else { ctx.moveTo(-22, 0); ctx.quadraticCurveTo(0, -17, 22, 0); ctx.closePath(); }
  ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.fillStyle = col[2]; ctx.fillRect(x - 3, y - 14, 6, 8); ctx.fillStyle = col[1]; ctx.fillRect(x - 22, y - 8, 44, 3);
  if (c.open) { ctx.fillStyle = 'rgba(255,230,140,0.55)'; ctx.fillRect(x - 18, y - 22, 36, 4); }
  if (c.locked) { ctx.fillStyle = '#c0392b'; ctx.fillRect(x - 5, y - 17, 10, 8); }
  if (dun && dun.opening && dun.opening.chest === c) { const T = CHEST_TIME[c.kind] || 1.2, k = dun.opening.t / T; ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - 52, 11, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke(); }
}
function drawDunTrap(tr) {
  const x = tr.x, y = tr.y;
  if (tr.kind === 'spikes') {
    ctx.fillStyle = '#15161d'; ctx.fillRect(x - 34, y - 22, 68, 44); ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1.5; ctx.strokeRect(x - 34, y - 22, 68, 44);
    const k = tr.lift || 0, warn = k > 0 && k < 1;
    if (warn) { ctx.fillStyle = 'rgba(255,90,70,0.18)'; ctx.fillRect(x - 34, y - 22, 68, 44); }
    for (let i = 0; i < 6; i++) { const sx = x - 26 + (i % 3) * 26, sy = y - 10 + Math.floor(i / 3) * 20; ctx.fillStyle = '#0a0a10'; ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill();
      if (k > 0) { ctx.fillStyle = '#c9d0da'; ctx.strokeStyle = '#4a5260'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx - 4.5, sy + 2); ctx.lineTo(sx, sy + 2 - 20 * k); ctx.lineTo(sx + 4.5, sy + 2); ctx.closePath(); ctx.fill(); ctx.stroke(); } }
  } else if (tr.kind === 'vent') {
    ell(x, y, 38, 20, '#15161d'); ctx.strokeStyle = '#3a3d4a'; ctx.lineWidth = 2; for (let k = -24; k <= 24; k += 12) { ctx.beginPath(); ctx.moveTo(x + k, y - 14); ctx.lineTo(x + k, y + 14); ctx.stroke(); }
    const g = tr.glow || 0; if (g > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gr = ctx.createRadialGradient(x, y, 2, x, y, 52); gr.addColorStop(0, `rgba(255,150,50,${0.5 * g})`); gr.addColorStop(1, 'rgba(255,90,20,0)'); ctx.fillStyle = gr; ctx.fillRect(x - 54, y - 40, 108, 80); ctx.restore(); }
    if (tr.burst) for (let i = 0; i < 6; i++) { const fx = x - 30 + i * 12, h = 42 + Math.sin(tAnim * 18 + i * 2) * 14; ctx.fillStyle = i % 2 ? '#ff9a2a' : '#ff5a1a'; ctx.beginPath(); ctx.moveTo(fx - 7, y + 4); ctx.quadraticCurveTo(fx - 3, y - h * 0.6, fx, y - h); ctx.quadraticCurveTo(fx + 4, y - h * 0.5, fx + 7, y + 4); ctx.closePath(); ctx.fill(); }
    else if (Math.random() < 0.03) particles.push({ x: x + (Math.random() - 0.5) * 30, y, vx: 0, vy: -20, life: 0.8, max: 0.8, size: 3, color: 'rgba(150,150,160,0.5)' });
  } else {
    const pal = dunPal(), aim = tr.aim > 0;
    ell(x, y + 3, 22, 8, 'rgba(0,0,0,0.4)'); ctx.fillStyle = pal.wall; ctx.fillRect(x - 15, y - 16, 30, 16); ctx.fillStyle = pal.top; ctx.fillRect(x - 15, y - 16, 30, 4);
    ctx.fillStyle = pal.wall; ctx.beginPath(); ctx.moveTo(x - 13, y - 16); ctx.lineTo(x - 15, y - 36); ctx.lineTo(x - 7, y - 42); ctx.lineTo(x + 7, y - 42); ctx.lineTo(x + 15, y - 36); ctx.lineTo(x + 13, y - 16); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = aim ? '#ff5a4a' : '#6a6f80'; for (const sx of [-6, 6]) { ctx.beginPath(); ctx.arc(x + sx, y - 30, 2.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#05060b'; ctx.fillRect(x - 4, y - 25, 8, 4);
    if (aim) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y - 30, 1, x, y - 30, 24); g.addColorStop(0, 'rgba(255,90,70,0.5)'); g.addColorStop(1, 'rgba(255,90,70,0)'); ctx.fillStyle = g; ctx.fillRect(x - 26, y - 56, 52, 52); ctx.restore(); }
  }
}
function drawDunVaultDoor(f) {
  const v = f.vault, D = v.door, pal = dunPal(), w = D.x1 - D.x0, h = D.y1 - D.y0;
  ctx.fillStyle = '#2b2e38'; ctx.fillRect(D.x0, D.y0 - DUN.wallH, w, h + DUN.wallH - 6); ctx.strokeStyle = '#8a92a6'; ctx.lineWidth = 3;
  for (let x = D.x0 + 10; x < D.x1; x += 16) { ctx.beginPath(); ctx.moveTo(x, D.y0 - DUN.wallH + 4); ctx.lineTo(x, D.y1 - 10); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(D.x0, D.y0 - 10); ctx.lineTo(D.x1, D.y0 - 10); ctx.moveTo(D.x0, D.y0 + 14); ctx.lineTo(D.x1, D.y0 + 14); ctx.stroke();
  ctx.fillStyle = '#d9b44a'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(D.cx, D.y0, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#111'; ctx.fillRect(D.cx - 2, D.y0 - 5, 4, 8);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(D.cx, D.y0, 2, D.cx, D.y0, 46); g.addColorStop(0, `rgba(255,210,90,${0.3 + Math.sin(tAnim * 3) * 0.1})`); g.addColorStop(1, 'rgba(255,210,90,0)'); ctx.fillStyle = g; ctx.fillRect(D.cx - 50, D.y0 - 50, 100, 100); ctx.restore();
}
function dunThings() {                                                           // everything the floor puts among the creatures, to be drawn in order from far to near
  const f = dun.f, pal = dunPal(), out = [];
  for (const b of f.blocks) if (b.x1 > cam.x - 60 && b.x0 < cam.x + VW + 60 && b.y1 > cam.y - 40 && b.y0 < cam.y + VH + 160) out.push({ y: b.y1, d: () => drawDunBlock(b, pal) });
  for (const p of f.pillars) if (inView(p.x, p.y, 120)) out.push({ y: p.y, d: () => drawDunPillar(p, pal) });
  for (const t of f.torches) if (t.wall && inView(t.x, t.y + 30, 60)) out.push({ y: t.y + 40, d: () => drawDunTorch(t) });
  for (const t of f.torches) if (!t.wall && inView(t.x, t.y, 60)) out.push({ y: t.y + 24, d: () => drawDunTorch(t) });
  out.push({ y: f.up.y - 30, d: () => drawDunStairs(f, false) }); if (f.down) out.push({ y: f.down.y - 30, d: () => drawDunStairs(f, true) });
  for (const c of f.chests) if (inView(c.x, c.y, 80)) out.push({ y: c.y, d: () => drawDunChest(c) });
  for (const tr of f.traps) if (inView(tr.x, tr.y, 120)) out.push({ y: tr.kind === 'darts' ? tr.y : -9000 + tr.y * 0.01, d: () => drawDunTrap(tr) });
  if (f.vault && !f.vault.open) out.push({ y: f.vault.door.y1, d: () => drawDunVaultDoor(f) });
  return out;
}
function dunSky() {                                                              // the light that falls through the cracks in the ceiling: sunlight by day, moonlight by night
  if (tod > 0.22 && tod < 0.78) return { col: tod < 0.4 ? '255,216,140' : tod > 0.64 ? '255,178,110' : '255,244,200', k: 0.35 + 0.65 * Math.max(0, Math.sin((tod - 0.22) / 0.56 * Math.PI)), day: true };
  return { col: '150,176,255', k: 0.45, day: false };
}
function drawDunLight(f) {
  const L = dunSky(); ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const c of f.cracks || []) {
    const sx = c.x - cam.x, sy = c.y - cam.y; if (sx < -300 || sx > VW + 300 || sy < -120 || sy > VH + 560) continue;
    const topX = sx + c.dir * 150 + Math.sin(tAnim * 0.4 + c.ph) * 6, topY = sy - 440;
    for (const [w, a] of [[1, 0.26], [0.45, 0.2]]) {                                              // the beam, and a brighter core
      const g = ctx.createLinearGradient(topX, topY, sx, sy); g.addColorStop(0, `rgba(${L.col},0)`); g.addColorStop(1, `rgba(${L.col},${a * L.k})`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(topX - 28 * w, topY); ctx.lineTo(topX + 28 * w, topY); ctx.lineTo(sx + c.r * 0.9 * w, sy); ctx.lineTo(sx - c.r * 0.9 * w, sy); ctx.closePath(); ctx.fill();
    }
    ctx.save(); ctx.translate(sx, sy); ctx.scale(1, 0.5); const p = ctx.createRadialGradient(0, 0, 4, 0, 0, c.r * 1.5); p.addColorStop(0, `rgba(${L.col},${0.5 * L.k})`); p.addColorStop(1, `rgba(${L.col},0)`); ctx.fillStyle = p; ctx.fillRect(-c.r * 1.5, -c.r * 1.5, c.r * 3, c.r * 3); ctx.restore();
    for (let i = 0; i < 7; i++) { const u = (tAnim * 0.05 + i / 7 + c.ph) % 1, mx = topX + (sx - topX) * u + Math.sin(tAnim + i * 2) * 10, my = topY + (sy - topY) * u; ctx.fillStyle = `rgba(${L.col},${0.6 * L.k * Math.sin(u * Math.PI)})`; ctx.fillRect(mx, my, 2, 2); }      // dust in the light
  }
  ctx.restore();
}
let dunDark = null;
function drawDungeonDark() {                                                     // the dark: only the hero, the torches and the stairs light the floor
  if (dev.lit) { drawDunLight(dun.f); if (dun.fade > 0) { ctx.fillStyle = `rgba(2,3,10,${dun.fade})`; ctx.fillRect(0, 0, VW, VH); } return; }
  if (!dunDark) { dunDark = document.createElement('canvas'); dunDark.width = VW; dunDark.height = VH; }
  const d = dunDark.getContext('2d'), f = dun.f, pal = dunPal();
  d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, VW, VH); d.fillStyle = 'rgba(2,3,9,0.93)'; d.fillRect(0, 0, VW, VH);
  d.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, a = 1) => { const sx = x - cam.x, sy = y - cam.y; if (sx < -r || sx > VW + r || sy < -r || sy > VH + r) return; const g = d.createRadialGradient(sx, sy, r * 0.12, sx, sy, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.6, `rgba(0,0,0,${a * 0.62})`); g.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = g; d.fillRect(sx - r, sy - r, r * 2, r * 2); };
  hole(hero.x, hero.y - 30, 300 + (hero.lightBonus || 0) * 1.6);
  { const L = dunSky(); for (const k of f.cracks || []) hole(k.x, k.y, k.r * 2.4, 0.8 * L.k); }
  for (const t of f.torches) hole(t.x, t.y, t.r * (1 + Math.sin(tAnim * 9 + t.x) * 0.03), 0.95);
  hole(f.up.x, f.up.y, 130, 0.9); if (f.down) hole(f.down.x, f.down.y, 130, 0.9);
  for (const c of f.chests) if (!c.open) hole(c.x, c.y - 10, c.kind === 'gold' ? 120 : 70, 0.7);
  for (const m of enemies) if (m.type === 'boss' && !m.sleep) hole(m.x, m.y - 30, 200, 0.8);
  const fov = fovPoly(hero.x, hero.y - 8, f.solids, 900, 36), tracePoly = g => { g.beginPath(); fov.forEach(([x, y], i) => i ? g.lineTo(x - cam.x, y - cam.y) : g.moveTo(x - cam.x, y - cam.y)); g.closePath(); };
  d.globalCompositeOperation = 'source-over'; d.filter = 'blur(3px)'; d.fillStyle = 'rgba(1,2,6,0.975)'; tracePoly(d); d.rect(0, 0, VW, VH); d.fill('evenodd'); d.filter = 'none';
  ctx.drawImage(dunDark, 0, 0, VW, VH);
  ctx.save(); tracePoly(ctx); ctx.clip(); ctx.globalCompositeOperation = 'lighter';                          // a warm tint round the flames
  for (const t of f.torches) { const sx = t.x - cam.x, sy = t.y - cam.y; if (sx < -200 || sx > VW + 200 || sy < -200 || sy > VH + 200) continue; const g = ctx.createRadialGradient(sx, sy, 4, sx, sy, t.r * 0.8); g.addColorStop(0, 'rgba(255,160,70,0.16)'); g.addColorStop(1, 'rgba(255,160,70,0)'); ctx.fillStyle = g; ctx.fillRect(sx - t.r, sy - t.r, t.r * 2, t.r * 2); }
  ctx.restore();
  ctx.save(); tracePoly(ctx); ctx.clip(); drawDunLight(f); ctx.restore();
  if (dun.fade > 0) { ctx.fillStyle = `rgba(2,3,10,${dun.fade})`; ctx.fillRect(0, 0, VW, VH); }
}
function drawDungeonHUD() {                                                       // the floor, and what E does here
  const f = dun.f, x = VW - 164, y = 108, pal = dunPal();
  hudPanel(x, y, 150, 46, { r: 11, edge: withAlpha(pal.glow, 0.5) });
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.fillText(fitText(pal.name, 128, 12, true, 9), x + 12, y + 18);
  const asleep = enemies.filter(m => m.sleep).length, opened = f.chests.filter(c => c.open).length;
  ctx.fillStyle = '#a3a1b8'; ctx.fillText(fitText(f.last ? `Floor ${f.idx + 1}/${dun.floors} · the boss chamber` : `Floor ${f.idx + 1}/${dun.floors} · ${enemies.length} here · ${opened}/${f.chests.length} chests${dun.keys ? ' · key' : f.vault && !f.vault.open ? ' · vault' : ''}`, 130, 10), x + 12, y + 34);
}
function drawDunMini() {
  const f = dun.f, mw = 150, mh = 100, mx = VW - mw - 14, my = VH - mh - 14, sx = mw / WW, sy = mh / WH, pal = dunPal();
  hudPanel(mx - 6, my - 6, mw + 12, mh + 12, { r: 11 });
  ctx.save(); ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip(); ctx.fillStyle = '#0a0b12'; ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = pal.floor; for (let cy = 0; cy < DUN.rows; cy++) for (let cx = 0; cx < DUN.cols; cx++) if (f.seen[cx + cy * DUN.cols] && !f.block[cx + cy * DUN.cols]) ctx.fillRect(mx + (DUN.gx + cx * DUN.C) * sx, my + (DUN.gy + cy * DUN.C) * sy, DUN.C * sx + 0.6, DUN.C * sy + 0.6);
  ctx.fillStyle = pal.top; for (let cy = 0; cy < DUN.rows; cy++) for (let cx = 0; cx < DUN.cols; cx++) if (f.seen[cx + cy * DUN.cols] && f.block[cx + cy * DUN.cols]) ctx.fillRect(mx + (DUN.gx + cx * DUN.C) * sx, my + (DUN.gy + cy * DUN.C) * sy, DUN.C * sx + 0.6, DUN.C * sy + 0.6);
  const dot = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(mx + x * sx, my + y * sy, r, 0, Math.PI * 2); ctx.fill(); };
  dot(f.up.x, f.up.y, 2.6, '#7fd0ff'); if (f.down) dot(f.down.x, f.down.y, 2.6, '#7fd0ff');
  for (const c of f.chests) if (!c.open && Math.hypot(c.x - hero.x, c.y - hero.y) < 520) dot(c.x, c.y, 2, c.kind === 'gold' ? '#ffd24a' : '#e8c88a');
  for (const m of enemies) if (!m.sleep || Math.hypot(m.x - hero.x, m.y - hero.y) < 380) dot(m.x, m.y, m.type === 'boss' ? 3 : m.warden ? 3.4 : m.elite ? 2.4 : 1.6, m.sleep ? '#7a7f99' : m.type === 'boss' ? '#ff5ce0' : m.warden ? '#ffe35a' : m.elite ? '#ffd24a' : '#ff5a5a');
  dot(hero.x, hero.y, 2.8, '#fff'); ctx.restore();
  ctx.fillStyle = '#a3a1b8'; ctx.textAlign = 'center'; ctx.fillText(fitText(pal.name, mw + 10, 10.5), mx + mw / 2, my - 11); ctx.textAlign = 'left';
}
function drawDunPrompt() {                                                        // the E bubble over what you can use, and the line at the bottom
  const n = dunNear; if (!n || hero.dead || paused) return;
  const bob = Math.sin(tAnim * 5) * 2;
  ctx.save(); ctx.fillStyle = 'rgba(20,20,28,0.88)'; ctx.strokeStyle = '#f5c451'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(n.x - 11, n.y - 11 + bob, 22, 22, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f5c451'; ctx.font = 'bold 14px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(keyLabel('interact'), n.x, n.y + 5 + bob); ctx.restore();
}
function drawDunPromptHud() {
  const n = dunNear; if (!n || hero.dead || paused) return;
  const lbl = fitText(n.label.replace(/^E /, keyLabel('interact') + ' '), VW - 120, 13, true, 10), w = ctx.measureText(lbl).width + 30;
  hudPanel(VW / 2 - w / 2, VH - 100, w, 30, { r: 10, edge: 'rgba(245,196,81,0.55)' });
  ctx.fillStyle = '#f5c451'; ctx.textAlign = 'center'; ctx.fillText(lbl, VW / 2, VH - 80); ctx.textAlign = 'left';
}
// the way in on the surface: one of several buildings (or a mouth in the ground) in the biome's stone, with a glowing doorway and the time it stays open as a ring
function dunStone(x, y, w, h, pal) {                                              // a block of old stone with its courses
  ctx.fillStyle = pal.wall; ctx.fillRect(x, y, w, h); ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(x, y, w, 3);
  ctx.strokeStyle = 'rgba(0,0,0,0.26)'; ctx.lineWidth = 1;
  for (let yy = y + 12, r = 0; yy < y + h + 0.1; yy += 12, r++) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); for (let xx = x + (r % 2 ? 10 : 22); xx < x + w; xx += 24) { ctx.beginPath(); ctx.moveTo(xx, yy - 12); ctx.lineTo(xx, Math.min(yy, y + h)); ctx.stroke(); } }
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.4; ctx.strokeRect(x, y, w, h);
}
function dunArch(x, y, w, h, pal, fl, a) {                                        // a dark archway whose base is at y, with a glow inside
  ctx.save(); ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w / 2, y - h + w / 2); ctx.arc(x, y - h + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w / 2, y); ctx.closePath();
  ctx.fillStyle = '#05060b'; ctx.fill(); ctx.clip();
  const g = ctx.createRadialGradient(x, y - h * 0.35, 3, x, y - h * 0.35, h * 0.8); g.addColorStop(0, withAlpha(pal.glow, 0.7 * fl * a)); g.addColorStop(1, withAlpha(pal.glow, 0)); ctx.fillStyle = g; ctx.fillRect(x - w, y - h - 4, w * 2, h + 8);
  ctx.restore(); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w / 2, y - h + w / 2); ctx.arc(x, y - h + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w / 2, y); ctx.stroke();
}
const dunMoss = (x, y, w, h) => { ctx.fillStyle = 'rgba(70,120,56,0.7)'; ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2); ctx.fill(); };
const DUN_DRAW = {
  cathedral(x, y, pal, fl, a) {
    dunStone(x - 84, y - 118, 168, 118, pal);
    ctx.fillStyle = pal.top; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x - 92, y - 118); ctx.lineTo(x - 38, y - 160); ctx.lineTo(x - 20, y - 148); ctx.lineTo(x - 8, y - 158); ctx.lineTo(x + 6, y - 138); ctx.lineTo(x + 30, y - 143); ctx.lineTo(x + 46, y - 128); ctx.lineTo(x + 92, y - 118); ctx.closePath(); ctx.fill(); ctx.stroke();   // the broken gable
    dunStone(x - 114, y - 176, 36, 176, pal); ctx.fillStyle = pal.top; ctx.beginPath(); ctx.moveTo(x - 119, y - 176); ctx.lineTo(x - 96, y - 214); ctx.lineTo(x - 73, y - 176); ctx.closePath(); ctx.fill(); ctx.stroke();       // the standing tower
    dunStone(x + 78, y - 138, 36, 138, pal); ctx.fillStyle = pal.top; ctx.beginPath(); ctx.moveTo(x + 78, y - 138); ctx.lineTo(x + 86, y - 152); ctx.lineTo(x + 94, y - 142); ctx.lineTo(x + 102, y - 158); ctx.lineTo(x + 114, y - 138); ctx.closePath(); ctx.fill(); ctx.stroke();   // the fallen one
    ctx.fillStyle = '#05060b'; ctx.beginPath(); ctx.arc(x, y - 100, 17, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = pal.top; ctx.lineWidth = 3; ctx.stroke();                                                                  // the rose window
    ctx.strokeStyle = withAlpha(pal.glow, 0.7 * fl * a); ctx.lineWidth = 1.4; for (let k = 0; k < 8; k++) { const t = k / 8 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(x, y - 100); ctx.lineTo(x + Math.cos(t) * 15, y - 100 + Math.sin(t) * 15); ctx.stroke(); }
    for (const sx of [-58, 58]) { ctx.fillStyle = '#05060b'; ctx.beginPath(); ctx.moveTo(x + sx - 8, y - 40); ctx.lineTo(x + sx - 8, y - 78); ctx.arc(x + sx, y - 78, 8, Math.PI, 0); ctx.lineTo(x + sx + 8, y - 40); ctx.closePath(); ctx.fill(); ctx.fillStyle = withAlpha(pal.glow, 0.3 * fl * a); ctx.fill(); }
    dunArch(x, y, 58, 84, pal, fl, a);
    ctx.fillStyle = pal.top; for (let k = 0; k < 3; k++) ctx.fillRect(x - 46 - k * 6, y - 3 + k * 0, 92 + k * 12, 3); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - 64, y, 128, 4);
    dunMoss(x - 100, y - 4, 22, 7); dunMoss(x + 70, y - 70, 14, 22); dunMoss(x - 94, y - 120, 12, 26);
  },
  cave(x, y, pal, fl, a) {
    const rock = mixHex(pal.wall, '#16161c', 0.4), rock2 = mixHex(pal.top, '#16161c', 0.3);
    ctx.fillStyle = rock; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 126, y); ctx.lineTo(x - 116, y - 40); ctx.lineTo(x - 84, y - 86); ctx.lineTo(x - 42, y - 116); ctx.lineTo(x + 8, y - 130); ctx.lineTo(x + 62, y - 110); ctx.lineTo(x + 102, y - 72); ctx.lineTo(x + 120, y - 30); ctx.lineTo(x + 128, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = rock2; ctx.beginPath(); ctx.moveTo(x - 84, y - 86); ctx.lineTo(x - 42, y - 116); ctx.lineTo(x + 8, y - 130); ctx.lineTo(x - 10, y - 96); ctx.lineTo(x - 56, y - 76); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(x + 62, y - 110); ctx.lineTo(x + 102, y - 72); ctx.lineTo(x + 70, y - 80); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.moveTo(x - 46, y); ctx.quadraticCurveTo(x - 52, y - 74, x, y - 90); ctx.quadraticCurveTo(x + 52, y - 74, x + 46, y); ctx.closePath(); ctx.fillStyle = '#05060b'; ctx.fill(); ctx.clip();
    const g = ctx.createRadialGradient(x, y - 30, 3, x, y - 30, 70); g.addColorStop(0, withAlpha(pal.glow, 0.62 * fl * a)); g.addColorStop(1, withAlpha(pal.glow, 0)); ctx.fillStyle = g; ctx.fillRect(x - 60, y - 96, 120, 100);
    ctx.fillStyle = rock; for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(x + k * 12 - 6, y - 84 + Math.abs(k) * 7); ctx.lineTo(x + k * 12, y - 60 + Math.abs(k) * 4 - (k % 2 ? 0 : 10)); ctx.lineTo(x + k * 12 + 6, y - 84 + Math.abs(k) * 7); ctx.closePath(); ctx.fill(); }      // dripping teeth of rock
    ctx.restore(); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 46, y); ctx.quadraticCurveTo(x - 52, y - 74, x, y - 90); ctx.quadraticCurveTo(x + 52, y - 74, x + 46, y); ctx.stroke();
    ctx.fillStyle = rock2; for (const [bx, by, bw, bh] of [[-84, 2, 26, 14], [78, 0, 30, 16], [-34, 8, 14, 7], [40, 8, 18, 8]]) { ctx.beginPath(); ctx.ellipse(x + bx, y + by - bh * 0.4, bw, bh, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    dunMoss(x - 90, y - 50, 16, 9); dunMoss(x + 84, y - 44, 14, 8);
  },
  mausoleum(x, y, pal, fl, a) {
    ctx.fillStyle = pal.top; ctx.fillRect(x - 106, y - 8, 212, 8); ctx.fillRect(x - 98, y - 16, 196, 8); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.2; ctx.strokeRect(x - 106, y - 8, 212, 8); ctx.strokeRect(x - 98, y - 16, 196, 8);
    dunStone(x - 86, y - 100, 172, 84, pal);
    ctx.fillStyle = pal.top; ctx.beginPath(); ctx.moveTo(x - 100, y - 100); ctx.lineTo(x, y - 148); ctx.lineTo(x + 100, y - 100); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = mixHex(pal.wall, '#000000', 0.25); ctx.beginPath(); ctx.moveTo(x - 76, y - 106); ctx.lineTo(x, y - 140); ctx.lineTo(x + 76, y - 106); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = withAlpha(pal.glow, 0.8 * fl * a); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - 116, 9, 0, Math.PI * 2); ctx.moveTo(x - 14, y - 116); ctx.lineTo(x + 14, y - 116); ctx.stroke();
    dunArch(x, y - 16, 46, 72, pal, fl, a);
    for (const cx of [-70, -38, 38, 70]) { const g = ctx.createLinearGradient(x + cx - 8, 0, x + cx + 8, 0); g.addColorStop(0, pal.top); g.addColorStop(1, pal.edge); ctx.fillStyle = g; ctx.fillRect(x + cx - 8, y - 100, 16, 84); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.strokeRect(x + cx - 8, y - 100, 16, 84); ctx.fillStyle = pal.top; ctx.fillRect(x + cx - 11, y - 104, 22, 6); ctx.fillRect(x + cx - 11, y - 20, 22, 5); }
    for (const ux of [-118, 118]) { ctx.fillStyle = pal.wall; ctx.beginPath(); ctx.ellipse(x + ux, y - 14, 9, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = withAlpha(pal.glow, 0.7 * fl * a); ctx.beginPath(); ctx.ellipse(x + ux, y - 30, 5, 4, 0, 0, Math.PI * 2); ctx.fill(); }
    dunMoss(x - 88, y - 100, 12, 7);
  },
  tower(x, y, pal, fl, a) {
    const g = ctx.createLinearGradient(x - 48, 0, x + 48, 0); g.addColorStop(0, pal.top); g.addColorStop(0.35, pal.wall); g.addColorStop(1, pal.edge);
    ctx.fillStyle = g; ctx.fillRect(x - 46, y - 178, 92, 178); ctx.strokeStyle = 'rgba(0,0,0,0.26)'; ctx.lineWidth = 1;
    for (let yy = y - 166, r = 0; yy < y; yy += 14, r++) { ctx.beginPath(); ctx.moveTo(x - 46, yy); ctx.lineTo(x + 46, yy); ctx.stroke(); for (let xx = x - 46 + (r % 2 ? 12 : 24); xx < x + 46; xx += 24) { ctx.beginPath(); ctx.moveTo(xx, yy - 14); ctx.lineTo(xx, yy); ctx.stroke(); } }
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.6; ctx.strokeRect(x - 46, y - 178, 92, 178);
    ctx.fillStyle = pal.top; for (const [cx, ch] of [[-46, 18], [-24, 6], [0, 14], [22, 0], [36, 16]]) if (ch) { ctx.fillRect(x + cx, y - 178 - ch, 14, ch); ctx.strokeRect(x + cx, y - 178 - ch, 14, ch); }    // the broken crown
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x + 8, y - 178); ctx.lineTo(x + 2, y - 150); ctx.lineTo(x + 14, y - 130); ctx.lineTo(x + 6, y - 104); ctx.stroke();
    for (const wy of [-146, -104]) { ctx.fillStyle = '#05060b'; ctx.beginPath(); ctx.moveTo(x - 20, y + wy + 22); ctx.lineTo(x - 20, y + wy + 6); ctx.arc(x - 14, y + wy + 6, 6, Math.PI, 0); ctx.lineTo(x - 8, y + wy + 22); ctx.fill(); ctx.fillStyle = withAlpha(pal.glow, 0.45 * fl * a); ctx.fill(); }
    dunArch(x, y, 44, 68, pal, fl, a);
    ctx.fillStyle = pal.top; for (const [rx, rw] of [[-70, 22], [52, 28], [-44, 12]]) { ctx.beginPath(); ctx.ellipse(x + rx, y - 2, rw, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    dunMoss(x - 42, y - 60, 8, 26); dunMoss(x + 36, y - 12, 14, 8);
  },
  well(x, y, pal, fl, a) {
    ell(x, y - 8, 52, 20, pal.edge); ctx.fillStyle = pal.wall; ctx.fillRect(x - 50, y - 34, 100, 26); ell(x, y - 34, 50, 19, pal.top);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; for (let k = -40; k <= 40; k += 20) { ctx.beginPath(); ctx.moveTo(x + k, y - 30); ctx.lineTo(x + k, y - 9); ctx.stroke(); }
    ell(x, y - 34, 36, 13, '#05060b'); const g = ctx.createRadialGradient(x, y - 34, 2, x, y - 34, 40); g.addColorStop(0, withAlpha(pal.glow, 0.8 * fl * a)); g.addColorStop(1, withAlpha(pal.glow, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y - 34, 36, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4a3624'; ctx.fillRect(x - 46, y - 92, 7, 62); ctx.fillRect(x + 39, y - 92, 7, 62); ctx.fillRect(x - 50, y - 96, 100, 7);                   // the frame and its roof beam
    ctx.fillStyle = '#6a4c32'; ctx.beginPath(); ctx.moveTo(x - 58, y - 96); ctx.lineTo(x - 20, y - 118); ctx.lineTo(x + 6, y - 100); ctx.lineTo(x - 4, y - 96); ctx.closePath(); ctx.fill();   // half a roof is left
    ctx.strokeStyle = '#cdbb94'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, y - 90); ctx.lineTo(x, y - 40); ctx.stroke();
  },
  gate(x, y, pal, fl, a) {
    ctx.fillStyle = pal.wall; ctx.fillRect(x - 54, y - 92, 108, 92); ctx.fillStyle = pal.top; ctx.fillRect(x - 54, y - 92, 108, 8);
    dunArch(x, y, 68, 86, pal, fl, a);
    ctx.strokeStyle = pal.glow; ctx.lineWidth = 2; ctx.globalAlpha *= 0.6; ctx.beginPath(); ctx.moveTo(x - 46, y - 80); ctx.lineTo(x - 46, y - 8); ctx.moveTo(x + 46, y - 80); ctx.lineTo(x + 46, y - 8); ctx.stroke();
  },
};
function drawDungeonDoor(d) {
  const pal = dunPalFor(), x = d.x, y = d.y, a = d.p, fl = 0.7 + Math.sin(tAnim * 3) * 0.15, K = DUN_DOORS[d.design] || DUN_DOORS.gate;
  ell(x, y + 6, 80, 20, 'rgba(0,0,0,0.35)');
  ctx.save(); ctx.globalAlpha = a; ctx.translate(0, (1 - a) * 24); (DUN_DRAW[d.design] || DUN_DRAW.gate)(x, y, pal, fl, a); ctx.restore();
  const ry = y - K.h - 18;
  ctx.strokeStyle = pal.glow; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, ry, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, d.t / d.max)); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(K.name.toUpperCase(), x, ry - 18); ctx.textAlign = 'left';
}
