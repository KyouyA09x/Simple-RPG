// Terrain art: per-biome ground details baked into the ground texture, water bodies
// (baked base + animated ripples/glints), and drifting cloud shadows.

function softBlob(c, x, y, rx, ry, rgb, a) {
  c.save(); c.translate(x, y); c.scale(1, ry / rx);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore();
}
function jagged(c, r, x, y, len, steps, spread) {
  c.beginPath(); c.moveTo(x, y);
  let a = r() * TAU;
  for (let i = 0; i < steps; i++) { a += (r() - 0.5) * spread; x += Math.cos(a) * len; y += Math.sin(a) * len * 0.8; c.lineTo(x, y); }
}

// everything biome-specific that gets painted onto the ground canvas (after the colour patches)
function bakeGroundDetail(c, r, B) {
  for (let i = 0; i < 2600; i++) {                       // fine speckle so the ground isn't flat
    c.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)';
    c.fillRect(r() * WW, r() * WH, 1 + r() * 2, 1 + r() * 1.5);
  }
  const k = B.key;
  if (k === 'forest') {
    for (let i = 0; i < 70; i++) softBlob(c, r() * WW, r() * WH, 50 + r() * 70, 30 + r() * 40, '20,40,24', 0.22);
    for (let i = 0; i < 300; i++) { c.fillStyle = r() < 0.5 ? 'rgba(150,100,50,0.28)' : 'rgba(190,150,60,0.22)'; c.beginPath(); c.ellipse(r() * WW, r() * WH, 2.4, 1.2, r() * 3, 0, TAU); c.fill(); }
  } else if (k === 'desert') {
    for (let row = 0; row < 16; row++) {                  // wind-rippled dunes
      const y0 = (row + 0.5) * (WH / 16), ph = r() * 6, amp = 10 + r() * 14;
      for (const [col, off] of [['rgba(255,240,200,0.16)', 0], ['rgba(120,80,30,0.13)', 5]]) {
        c.strokeStyle = col; c.lineWidth = 2.4; c.beginPath();
        for (let x = 0; x <= WW; x += 30) c.lineTo(x, y0 + off + Math.sin(x / 190 + ph) * amp + Math.sin(x / 60 + ph * 2) * 3);
        c.stroke();
      }
    }
    for (let i = 0; i < 7; i++) {                         // cracked, sun-baked earth
      const cx = r() * WW, cy = r() * WH; c.strokeStyle = 'rgba(90,60,30,0.28)'; c.lineWidth = 1;
      for (let j = 0; j < 12; j++) { jagged(c, r, cx + (r() - 0.5) * 60, cy + (r() - 0.5) * 40, 8, 5, 1.4); c.stroke(); }
    }
  } else if (k === 'snow') {
    for (let i = 0; i < 90; i++) {                        // wind-swept drifts with blue shadows
      const x = r() * WW, y = r() * WH, w = 60 + r() * 120;
      softBlob(c, x + 14, y + 8, w, w * 0.28, '140,170,205', 0.2); softBlob(c, x, y, w, w * 0.28, '255,255,255', 0.5);
    }
  } else if (k === 'volcano') {
    for (let i = 0; i < 50; i++) softBlob(c, r() * WW, r() * WH, 60 + r() * 90, 30 + r() * 40, '90,80,76', 0.2);
    for (let i = 0; i < 46; i++) {                        // cracked rock with a glow underneath
      const x = r() * WW, y = r() * WH;
      jagged(c, r, x, y, 14, 9, 1.5); c.strokeStyle = 'rgba(255,100,20,0.28)'; c.lineWidth = 3.4; c.stroke();
      jagged(c, r, x, y, 14, 9, 1.5); c.strokeStyle = 'rgba(8,4,4,0.6)'; c.lineWidth = 1.2; c.stroke();
    }
  } else if (k === 'swamp') {
    for (let i = 0; i < 130; i++) softBlob(c, r() * WW, r() * WH, 40 + r() * 70, 24 + r() * 34, '40,30,18', 0.3);
    for (let i = 0; i < 70; i++) softBlob(c, r() * WW, r() * WH, 30 + r() * 60, 18 + r() * 28, '70,100,50', 0.2);
    for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(40,60,44,0.5)'; c.beginPath(); c.ellipse(r() * WW, r() * WH, 8 + r() * 10, 3 + r() * 3, 0, 0, TAU); c.fill(); }
  } else if (k === 'jungle') {
    for (let i = 0; i < 140; i++) softBlob(c, r() * WW, r() * WH, 40 + r() * 70, 24 + r() * 36, '14,50,24', 0.3);
    for (let i = 0; i < 200; i++) { c.fillStyle = r() < 0.5 ? 'rgba(120,80,40,0.25)' : 'rgba(70,140,60,0.25)'; c.beginPath(); c.ellipse(r() * WW, r() * WH, 3, 1.3, r() * 3, 0, TAU); c.fill(); }
  } else if (k === 'ruins') {
    for (let z = 0; z < 26; z++) {                        // patches of old paving
      const x0 = r() * (WW - 200), y0 = r() * (WH - 160), cols = 4 + Math.floor(r() * 6), rows = 3 + Math.floor(r() * 4), tw = 26 + r() * 8, th = 18 + r() * 6;
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        if (r() < 0.12) continue;
        const shade = 70 + (r() * 22) | 0;
        c.fillStyle = `rgb(${shade + 8},${shade + 10},${shade + 18})`; c.fillRect(x0 + i * tw + 1, y0 + j * th + 1, tw - 2, th - 2);
        c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(x0 + i * tw + 1, y0 + j * th + 1, tw - 2, 2);
      }
    }
    for (let i = 0; i < 60; i++) softBlob(c, r() * WW, r() * WH, 30 + r() * 50, 18 + r() * 24, '60,100,56', 0.22);
    for (let i = 0; i < 30; i++) { jagged(c, r, r() * WW, r() * WH, 10, 6, 1.2); c.strokeStyle = 'rgba(20,22,28,0.5)'; c.lineWidth = 1; c.stroke(); }
  } else if (k === 'highlands') {
    for (let i = 0; i < 60; i++) {                        // rock strata
      const x = r() * WW, y = r() * WH, w = 120 + r() * 220;
      c.strokeStyle = r() < 0.5 ? 'rgba(50,56,66,0.2)' : 'rgba(210,216,226,0.18)'; c.lineWidth = 2 + r() * 2;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y - w * 0.12); c.stroke();
    }
    for (let i = 0; i < 40; i++) softBlob(c, r() * WW, r() * WH, 40 + r() * 70, 20 + r() * 30, '245,248,252', 0.5);   // snow patches
    for (let i = 0; i < 400; i++) { c.fillStyle = r() < 0.5 ? 'rgba(60,66,76,0.4)' : 'rgba(180,186,196,0.4)'; c.fillRect(r() * WW, r() * WH, 1.5 + r() * 2, 1.2 + r() * 1.5); }   // scree
  }
}

function bakeWater(c, w) {
  const R = Math.max(w.rx, w.ry);
  c.fillStyle = w.frozen ? 'rgba(210,232,245,0.7)' : w.murky ? 'rgba(20,28,16,0.45)' : 'rgba(40,30,20,0.32)';
  c.beginPath(); c.ellipse(w.x, w.y + 2, w.rx + 10, w.ry + 7, 0, 0, TAU); c.fill();                      // wet shore
  c.save(); c.translate(w.x, w.y); c.scale(1, w.ry / w.rx);
  const g = c.createRadialGradient(0, 0, 4, 0, 0, w.rx);
  g.addColorStop(0, w.deep); g.addColorStop(0.65, w.c); g.addColorStop(1, w.frozen ? '#e6f3fb' : w.c);
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, w.rx, 0, TAU); c.fill();
  c.restore();
  if (w.frozen) {                                                                                           // cracks in the ice
    const r = mulberry((w.x * 31 + w.y) | 0); c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1;
    for (let i = 0; i < 9; i++) { jagged(c, r, w.x + (r() - 0.5) * w.rx, w.y + (r() - 0.5) * w.ry, 9, 6, 1.3); c.stroke(); }
  }
  if (w.murky) { const r = mulberry((w.x * 17 + w.y) | 0); for (let i = 0; i < 26; i++) softBlob(c, w.x + (r() - 0.5) * w.rx * 1.6, w.y + (r() - 0.5) * w.ry * 1.6, 14 + r() * 18, 8 + r() * 10, '90,130,60', 0.35); }
  c.strokeStyle = w.frozen ? 'rgba(255,255,255,0.8)' : 'rgba(210,230,235,0.28)'; c.lineWidth = 2;        // bright rim
  c.beginPath(); c.ellipse(w.x, w.y, w.rx - 1, w.ry - 1, 0, 0, TAU); c.stroke();
}

// animated water: reflected sky, ripples, glints, and rings where the hero wades
function drawWater() {
  if (!world.water.length) return;
  const anim = gfx.anim, glow = gfx.glow, t = tAnim;
  for (const w of world.water) {
    if (!inView(w.x, w.y, Math.max(w.rx, w.ry) + 20)) continue;
    if (glow) {
      ctx.save(); ctx.beginPath(); ctx.ellipse(w.x, w.y, w.rx, w.ry, 0, 0, TAU); ctx.clip();
      const g = ctx.createLinearGradient(w.x - w.rx, w.y - w.ry, w.x + w.rx, w.y + w.ry);
      const sky = skyNow(), tint = sky.dark > 0.3 ? '90,120,200' : '210,235,255';
      g.addColorStop(0, `rgba(${tint},${0.2 + Math.sin(t * 0.8 + w.ph) * 0.05})`); g.addColorStop(1, `rgba(${tint},0)`);
      ctx.fillStyle = g; ctx.fillRect(w.x - w.rx, w.y - w.ry, w.rx * 2, w.ry * 2);
      ctx.restore();
    }
    if (w.frozen) {
      if (glow && Math.sin(t * 1.7 + w.ph * 3) > 0.95) { ctx.fillStyle = '#fff'; ctx.fillRect(w.x + Math.sin(w.ph * 9) * w.rx * 0.5, w.y + Math.cos(w.ph * 5) * w.ry * 0.4, 2, 2); }
      continue;
    }
    if (anim) {
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 4; i++) {
        const ph = (t * 0.32 + i * 0.25 + w.ph) % 1, ox = Math.sin(w.ph * 7 + i * 2.1) * w.rx * 0.5, oy = Math.cos(w.ph * 5 + i * 1.7) * w.ry * 0.5;
        ctx.strokeStyle = `rgba(230,245,255,${(1 - ph) * 0.34})`;
        ctx.beginPath(); ctx.ellipse(w.x + ox, w.y + oy, 4 + ph * w.rx * 0.34, (4 + ph * w.rx * 0.34) * 0.5, 0, 0, TAU); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 7; i++) {
        const a = Math.sin(t * 2 + i * 1.9 + w.ph);
        if (a < 0.4) continue;
        const gx = w.x + Math.sin(w.ph * 3 + i * 2.7) * w.rx * 0.7, gy = w.y + Math.cos(w.ph * 4 + i * 1.3) * w.ry * 0.6;
        ctx.globalAlpha = (a - 0.4) * 0.9; line(gx - 3, gy, gx + 3, gy); ctx.globalAlpha = 1;
      }
    }
  }
  if (anim && hero && hero.inWater) {                               // rings around the wading hero
    for (let i = 0; i < 2; i++) {
      const ph = (t * 1.6 + i * 0.5) % 1;
      ctx.strokeStyle = `rgba(235,248,255,${(1 - ph) * 0.55})`; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(hero.x, hero.y, 6 + ph * 18, (6 + ph * 18) * 0.38, 0, 0, TAU); ctx.stroke();
    }
  }
}

// big soft shadows of clouds sliding across the land on bright days
function drawCloudShadows() {
  if (!world.B.clouds || !gfx.glow) return;
  const day = 1 - night01();
  if (day < 0.05) return;
  const wind = 12 + 10 * windMul();
  for (let i = 0; i < 5; i++) {
    const w = 420 + (i * 97 % 160), h = 200 + (i * 53 % 90);
    const x = ((i * 1213 + tAnim * wind) % (WW + 900)) - 450, y = (i * 577 + 200) % (WH - 100) + 50 + Math.sin(tAnim * 0.05 + i) * 30;
    if (!inView(x, y, w)) continue;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, h / w);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w);
    g.addColorStop(0, `rgba(10,24,40,${0.2 * day})`); g.addColorStop(0.6, `rgba(10,24,40,${0.1 * day})`); g.addColorStop(1, 'rgba(10,24,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, w, 0, TAU); ctx.fill(); ctx.restore();
  }
}
