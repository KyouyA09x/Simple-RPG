// Random village layouts: builds many villages in every biome and checks that each one is playable.
// For every layout: every door, shop keeper, the gate and the notice board are reachable on foot from the arrival point,
// nobody starts inside a wall, the people live through a day and a night without getting stuck, and the shops sell gear.
advanceIntro(); advanceIntro(); localStorage.clear(); newRun('Layouts', 'normal', 1);
const fails = [], info = { layouts: {}, gateSides: { east: 0, west: 0 }, shopOrders: new Set(), yardOrders: new Set() };
const ok = (c, m) => { if (!c) fails.push(m); };
hero.level = 8; dev.god = true;

function reach(v) {                                       // flood fill over 12px cells for a hero-sized body
  const C = 12, W = Math.ceil(VIL_W / C), H = Math.ceil(VIL_H / C), seen = new Uint8Array(W * H), q = [];
  const cell = (x, y) => Math.floor(y / C) * W + Math.floor(x / C);
  const free = (x, y) => x >= 24 && x <= VIL_W - 24 && y >= 112 && y <= VIL_H - 24 && !vilOverlaps(v, x, y, 9);
  q.push([v.arrive.x, v.arrive.y]); seen[cell(v.arrive.x, v.arrive.y)] = 1;
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[C, 0], [-C, 0], [0, C], [0, -C]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= VIL_W || ny >= VIL_H || seen[cell(nx, ny)] || !free(nx, ny)) continue;
      seen[cell(nx, ny)] = 1; q.push([nx, ny]);
    }
  }
  return (x, y) => { for (let dy = -C; dy <= C; dy += C) for (let dx = -C; dx <= C; dx += C) if (seen[cell(x + dx, y + dy)]) return true; return false; };
}

const LAYOUTS = 40;
for (let i = 0; i < LAYOUTS; i++) {
  state = 'play'; vil = null; zone = i % 8; enemies = []; spawnQueue = []; wave = 9; hero.hp = hero.maxHp;
  tod = 0.5; enterVillage();
  const v = vil, tag = `#${i} ${v.B.key}`;
  if (!v) { fails.push(`${tag}: no village`); continue; }
  info.gateSides[v.E > 0 ? 'east' : 'west']++; info.shopOrders.add(v.shopOrder.join()); info.yardOrders.add(v.yardOrder.join());
  const can = reach(v);
  ok(can(v.gate.x - 30 * v.E, v.gate.y), `${tag}: gate not reachable`);
  for (const b of v.buildings) ok(can(b.door.x, b.door.y + 4), `${tag}: ${b.id} door not reachable`);
  for (const n of v.npcs) { ok(!vilOverlaps(v, n.x, n.y, 5, 0.6), `${tag}: ${n.name} starts inside a wall`); if (n.shop || n.special) ok(can(n.x, n.y), `${tag}: ${n.name} not reachable`); }
  ok(can(v.board.x, v.board.y + 14), `${tag}: board not reachable`);
  ok(can(v.sleepAt.x, v.sleepAt.y), `${tag}: dog bed not reachable`);
  ok(v.npcs.some(n => n.id === 'dagna') && v.npcs.some(n => n.id === 'lysa') && v.npcs.some(n => n.id === 'brann'), `${tag}: shopkeepers missing`);
  ok(v.stock.smith.length === 4 && v.stock.armour.length === 4 && v.stock.jewel.length === 4, `${tag}: stock missing`);
  for (const e of [...v.stock.smith, ...v.stock.armour, ...v.stock.jewel]) ok(e.item.rarity >= 1 && e.item.rarity <= 5 && e.price >= 18, `${tag}: bad stock item`);
  // a day, walking the hero about, then a night
  if (i % 4 === 0) {
    v.fade = 0;
    for (let t = 0; t < 1800; t++) { if (t % 120 === 0) { keys.KeyD = Math.random() < 0.5; keys.KeyA = !keys.KeyD; keys.KeyW = Math.random() < 0.5; keys.KeyS = !keys.KeyW; } updateVillage(0.05); }
    for (const k in keys) keys[k] = false;
    for (const n of v.npcs) ok(n.inside || !vilOverlaps(v, n.x, n.y, 5, 3), `${tag}: ${n.name} ended up inside a wall`);
    tod = 0.92;
    for (let t = 0; t < 1400; t++) updateVillage(0.05);
    const out = v.npcs.filter(n => n.nightHome && !n.inside).map(n => n.name);
    ok(out.length === 0, `${tag}: still outside at night: ${out}`);
    tod = 0.52;
    for (let t = 0; t < 1400; t++) updateVillage(0.05);
    ok(v.npcs.every(n => !n.nightHome || !n.inside), `${tag}: nobody came back out in the morning`);
    ok(v.stats.snaps <= 2, `${tag}: ${v.stats.snaps} villagers had to be teleported out of a jam`);
    if (v.stats.snaps) info.layouts[tag] = { snaps: v.stats.snaps, who: v.stats.who, shops: v.shopOrder.join(), yards: v.yardOrder.join(), gate: v.E };
  }
  render(1);                                              // draws without errors
  v.leaveT = 0.5; for (let t = 0; t < 30 && state === 'village'; t++) updateVillage(0.05);
  ok(state === 'play', `${tag}: could not leave`);
}
info.gateSides = info.gateSides; info.shopOrders = info.shopOrders.size; info.yardOrders = info.yardOrders.size;
ok(info.gateSides.east > 5 && info.gateSides.west > 5, 'gate appears on both sides');
ok(info.shopOrders > 20 && info.yardOrders > 8, `layouts vary (shop orders ${info.shopOrders}, yard orders ${info.yardOrders})`);
return { fails, info };
