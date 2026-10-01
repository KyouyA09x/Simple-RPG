// Day/night cycle + per-biome weather. Drawn in screen space over the world, under the HUD.
// Weather particles are computed from a hash of their index + time, so nothing is allocated per frame.

const DAY_LEN = 480;            // seconds of real time per in-game day
let tod = 0.36, dayCount = 1;   // tod = 0..1 (0 = midnight, 0.5 = midday)

// --- sky keyframes: darkness amount + tint colour through the day ---
const SKY_KEYS = [
  { t: 0.00, dark: 0.40, c: [42, 52, 110] },
  { t: 0.22, dark: 0.37, c: [46, 56, 116] },
  { t: 0.30, dark: 0.20, c: [255, 160, 100] },   // sunrise
  { t: 0.38, dark: 0.00, c: [255, 255, 255] },
  { t: 0.68, dark: 0.00, c: [255, 255, 255] },
  { t: 0.76, dark: 0.18, c: [255, 145, 82] },   // sunset
  { t: 0.86, dark: 0.36, c: [46, 56, 116] },
  { t: 1.00, dark: 0.40, c: [42, 52, 110] },
];
function skyNow(t = tod) {
  let a = SKY_KEYS[0], b = SKY_KEYS[SKY_KEYS.length - 1];
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    if (t >= SKY_KEYS[i].t && t <= SKY_KEYS[i + 1].t) { a = SKY_KEYS[i]; b = SKY_KEYS[i + 1]; break; }
  }
  const k = (t - a.t) / (b.t - a.t || 1), e = k * k * (3 - 2 * k);       // smoothstep
  return { dark: a.dark + (b.dark - a.dark) * e, c: a.c.map((v, i) => Math.round(v + (b.c[i] - v) * e)) };
}
const isNight = () => skyNow().dark > 0.25;
function clockLabel() {
  const mins = Math.floor(tod * 1440), h = Math.floor(mins / 60), m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function timePhase() {
  if (tod < 0.26 || tod >= 0.84) return 'Night';
  if (tod < 0.36) return 'Dawn';
  if (tod < 0.70) return 'Day';
  return 'Dusk';
}

// --- weather: each biome has its own pool with weights ---
const WEATHER = {
  clear:      { name: 'Clear',        fx: null,   tint: null,                  vig: 0,    windMul: 1 },
  windy:      { name: 'Windy',        fx: null,   tint: null,                  vig: 0,    windMul: 3.2 },
  drizzle:    { name: 'Drizzle',      fx: 'rain', dens: 0.4, tint: [60, 80, 120, 0.10], vig: 0.05, windMul: 1.2 },
  rain:       { name: 'Rain',         fx: 'rain', dens: 1,   tint: [40, 60, 110, 0.20], vig: 0.12, windMul: 1.8 },
  storm:      { name: 'Thunderstorm', fx: 'rain', dens: 1.7, slant: 420, tint: [26, 34, 70, 0.34], vig: 0.26, windMul: 3.0, thunder: true },
  leafstorm:  { name: 'Leaf Storm',   fx: 'leaf', dens: 1,   tint: [120, 140, 80, 0.10], vig: 0.08, windMul: 3.4 },
  fog:        { name: 'Fog',          fx: 'fog',  dens: 1,   tint: [180, 190, 205, 0.16], vig: 0.20, windMul: 0.7 },
  heat:       { name: 'Heat Haze',    fx: 'haze', dens: 1,   tint: [255, 180, 90, 0.12], vig: 0.06, windMul: 0.6 },
  mirage:     { name: 'Mirage',       fx: 'haze', dens: 2,   tint: [255, 200, 130, 0.18], vig: 0.10, windMul: 0.5 },
  sandstorm:  { name: 'Sandstorm',    fx: 'sand', dens: 1,   tint: [200, 150, 70, 0.34], vig: 0.34, windMul: 4.0 },
  snowfall:   { name: 'Snowfall',     fx: 'snow', dens: 0.5, tint: [190, 210, 235, 0.10], vig: 0.05, windMul: 1.2 },
  blizzard:   { name: 'Blizzard',     fx: 'snow', dens: 1,   fall: 320, drift: 700, tint: [200, 220, 240, 0.30], vig: 0.32, windMul: 3.6 },
  hail:       { name: 'Hail',         fx: 'hail', dens: 0.7, tint: [170, 200, 225, 0.16], vig: 0.14, windMul: 2.0 },
  whiteout:   { name: 'Whiteout',     fx: 'snow', dens: 1.2, fall: 200, drift: 300, fog: true, tint: [230, 240, 250, 0.42], vig: 0.40, windMul: 2.4 },
  aurora:     { name: 'Aurora',       fx: 'aurora', dens: 1, tint: [90, 200, 180, 0.08], vig: 0.05, windMul: 0.8, nightOnly: true },
  ashfall:    { name: 'Ashfall',      fx: 'fall', dens: 1,   tint: [90, 70, 70, 0.22],   vig: 0.16, windMul: 1.0 },
  smog:       { name: 'Smog',         fx: 'fog',  dens: 1.3, dark: true, tint: [70, 60, 55, 0.34], vig: 0.28, windMul: 0.6 },
  emberstorm: { name: 'Ember Storm',  fx: 'ember', dens: 1,  tint: [255, 110, 40, 0.20], vig: 0.20, windMul: 2.6 },
  lavarain:   { name: 'Lava Rain',    fx: 'lava', dens: 1,   tint: [255, 90, 30, 0.26],  vig: 0.24, windMul: 1.6 },
};
const BIOME_WEATHER = {                     // keyed by biome key (see biomes.js)
  forest:    [['clear', 5], ['windy', 3], ['drizzle', 3], ['rain', 3], ['fog', 2], ['leafstorm', 2], ['storm', 1]],
  desert:    [['clear', 5], ['heat', 4], ['windy', 2], ['mirage', 2], ['sandstorm', 2]],
  snow:      [['snowfall', 5], ['clear', 3], ['blizzard', 2], ['fog', 2], ['hail', 2], ['whiteout', 1], ['aurora', 2]],
  volcano:   [['ashfall', 4], ['clear', 3], ['emberstorm', 3], ['heat', 2], ['smog', 2], ['lavarain', 1]],
  swamp:     [['fog', 5], ['drizzle', 4], ['rain', 3], ['clear', 3], ['storm', 2], ['windy', 1]],
  jungle:    [['rain', 4], ['storm', 3], ['drizzle', 3], ['fog', 2], ['clear', 3], ['leafstorm', 2], ['windy', 1]],
  ruins:     [['fog', 5], ['clear', 3], ['windy', 3], ['storm', 2], ['drizzle', 2], ['smog', 1]],
  highlands: [['windy', 5], ['clear', 4], ['fog', 3], ['hail', 2], ['snowfall', 2], ['storm', 1], ['blizzard', 1]],
};

const weather = { kind: 'clear', next: 'clear', t: 1, timer: 45, thunderT: 3, revealAge: 99 };
function rollWeather(zoneIdx) {
  const pool = BIOME_WEATHER[BIOMES[zoneIdx % BIOMES.length].key] || BIOME_WEATHER.forest;
  const usable = pool.filter(([k]) => !WEATHER[k].nightOnly || isNight());
  let tot = 0;
  for (const [, w] of usable) tot += w;
  let r = Math.random() * tot;
  for (const [k, w] of usable) { if ((r -= w) <= 0) return k; }
  return 'clear';
}
function setWeather(kind, instant = false) {
  weather.next = kind;
  if (instant) { weather.kind = kind; weather.t = 1; }
  else weather.t = 0;                      // t ramps 0→1 while the new weather fades in
  weather.timer = 50 + Math.random() * 90;
}
function updateSky(dt, zoneIdx) {
  weather.revealAge += dt;
  const before = tod;
  tod = (tod + dt / DAY_LEN) % 1;
  if (tod < before) dayCount++;
  weather.timer -= dt;
  if (weather.t < 1) {
    weather.t = Math.min(1, weather.t + dt / 4);
    if (weather.t >= 1) weather.kind = weather.next;
  } else if (weather.timer <= 0) {
    let k = rollWeather(zoneIdx);
    if (k === weather.kind) k = rollWeather(zoneIdx);     // one re-roll to reduce repeats
    weather.next = k; weather.t = k === weather.kind ? 1 : 0;
    weather.timer = 50 + Math.random() * 90;
  }
  // thunder
  const w = WEATHER[weather.kind];
  if (w.thunder) {
    weather.thunderT -= dt;
    if (weather.thunderT <= 0) {
      weather.thunderT = 6 + Math.random() * 14;
      weather.revealAge = 0;                      // lightning briefly reveals everything (see vision.js)
      if (!settings.comfort) flash = Math.max(flash, 0.25);
      sfx('thunder');
    }
  }
}
// strength of the current weather (0..1), used to fade effects in and out
const weatherPower = () => (weather.t >= 1 ? 1 : weather.t);
const windMul = () => {
  const a = WEATHER[weather.kind].windMul, b = WEATHER[weather.next].windMul;
  return a + (b - a) * weatherPower();
};

const hash1 = i => { const x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); };

function drawWeatherLayer(kind, power) {
  const w = WEATHER[kind];
  if (power <= 0.01 || !w.fx || w.fx === 'haze') return;
  const t = tAnim, q = gfx.grass ? 1 : 0.45, dens = (w.dens || 1) * power * q;
  ctx.save();
  if (w.fx === 'rain') {
    const n = Math.round(260 * dens), slant = w.slant || 240, speed = w.slant ? 1500 : 1100;
    ctx.strokeStyle = `rgba(190,210,255,${0.35 * power})`; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const y = ((hash1(i) * VH + t * speed) % (VH + 40)) - 20;
      const x = ((hash1(i + 999) * VW + t * slant) % (VW + 60)) - 30;
      ctx.moveTo(x, y); ctx.lineTo(x - slant * 0.018, y + 18);
    }
    ctx.stroke();
    ctx.strokeStyle = `rgba(200,220,255,${0.22 * power})`;
    ctx.beginPath();
    for (let i = 0; i < n / 6; i++) {
      const sx = hash1(i + 555) * VW, sy = hash1(i + 777) * VH, ph = (t * 2.2 + hash1(i + 333)) % 1;
      ctx.moveTo(sx - ph * 6, sy); ctx.lineTo(sx + ph * 6, sy);
    }
    ctx.stroke();
  } else if (w.fx === 'snow' || w.fx === 'hail') {
    const hailY = w.fx === 'hail';
    const n = Math.round((hailY ? 300 : 480) * dens);
    const fall = w.fall || (hailY ? 900 : 120), drift = w.drift || (hailY ? 120 : 90);
    ctx.fillStyle = `rgba(255,255,255,${(hailY ? 0.9 : 0.8) * power})`;
    for (let i = 0; i < n; i++) {
      const y = ((hash1(i) * VH + t * fall * (0.6 + hash1(i + 1) * 0.8)) % (VH + 30)) - 15;
      const x = ((hash1(i + 999) * VW + t * drift + Math.sin(t * 1.5 + i) * 26) % (VW + 40)) - 20;
      const r = hailY ? 2 + hash1(i + 7) * 2 : 1 + hash1(i + 7) * 2;
      if (hailY) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(x, y, r, r);
    }
    if (w.fog) drawFogBanks(power * 1.2, [235, 242, 250]);
  } else if (w.fx === 'sand') {
    const n = Math.round(520 * dens);
    ctx.fillStyle = `rgba(226,198,140,${0.5 * power})`;
    for (let i = 0; i < n; i++) {
      const x = ((hash1(i) * VW + t * 1900) % (VW + 60)) - 30;
      const y = (hash1(i + 9) * VH + Math.sin(t * 2 + i) * 30) % VH;
      ctx.fillRect(x, y, 14 + hash1(i + 3) * 18, 1.2);
    }
  } else if (w.fx === 'fall' || w.fx === 'leaf') {
    const leaf = w.fx === 'leaf';
    const n = Math.round((leaf ? 150 : 260) * dens);
    for (let i = 0; i < n; i++) {
      const sway = Math.sin(t * 1.6 + i) * (leaf ? 60 : 26);
      const x = ((hash1(i) * VW + t * (leaf ? 260 : 40) + sway) % (VW + 60)) - 30;
      const y = ((hash1(i + 9) * VH + t * (leaf ? 90 : 60)) % (VH + 30)) - 15;
      if (leaf) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(t * 3 + i);
        ctx.fillStyle = ['#7a9a4a', '#a8863a', '#c06a2a'][i % 3];
        ctx.globalAlpha = power; ctx.beginPath(); ctx.ellipse(0, 0, 5, 2.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = `rgba(150,140,135,${0.6 * power})`;
        const r = 1.2 + hash1(i + 3) * 2; ctx.fillRect(x, y, r, r);
      }
    }
  } else if (w.fx === 'ember' || w.fx === 'lava') {
    const lava = w.fx === 'lava';
    const n = Math.round((lava ? 120 : 260) * dens);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      if (lava) {
        const x = ((hash1(i) * VW + t * 90) % (VW + 40)) - 20;
        const y = ((hash1(i + 9) * VH + t * 620) % (VH + 40)) - 20;
        const g = ctx.createLinearGradient(x, y - 16, x, y + 6);
        g.addColorStop(0, 'rgba(255,90,20,0)'); g.addColorStop(1, `rgba(255,170,60,${0.9 * power})`);
        ctx.fillStyle = g; ctx.fillRect(x - 1.5, y - 16, 3, 22);
      } else {
        const x = ((hash1(i) * VW + t * 40 + Math.sin(t + i) * 30) % (VW + 40)) - 20;
        const y = (((hash1(i + 9) * VH - t * 260) % (VH + 30)) + VH + 30) % (VH + 30) - 15;
        ctx.fillStyle = `rgba(255,150,60,${0.8 * power})`;
        const r = 1.2 + hash1(i + 3) * 2; ctx.fillRect(x, y, r, r);
      }
    }
  } else if (w.fx === 'fog') {
    drawFogBanks(power * (w.dens || 1), w.dark ? [70, 62, 58] : [225, 232, 242]);
  } else if (w.fx === 'aurora') {
    ctx.globalCompositeOperation = 'lighter';
    for (let b2 = 0; b2 < 3; b2++) {
      const cols = [[90, 230, 170], [80, 160, 240], [180, 110, 230]][b2];
      ctx.beginPath();
      for (let x = 0; x <= VW; x += 20) {
        const y = VH * (0.08 + b2 * 0.07) + Math.sin(x * 0.006 + t * 0.5 + b2) * 26 + Math.sin(x * 0.013 - t * 0.3) * 12;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(VW, 0); ctx.lineTo(0, 0); ctx.closePath();
      const g = ctx.createLinearGradient(0, 0, 0, VH * 0.45);
      g.addColorStop(0, `rgba(${cols[0]},${cols[1]},${cols[2]},0)`);
      g.addColorStop(1, `rgba(${cols[0]},${cols[1]},${cols[2]},${0.14 * power})`);
      ctx.fillStyle = g; ctx.fill();
    }
  }
  ctx.restore();
}

function drawFogBanks(power, rgb) {
  for (let i = 0; i < 9; i++) {
    const x = ((hash1(i) * (VW + 500) + tAnim * (12 + hash1(i + 2) * 22)) % (VW + 500)) - 250;
    const y = hash1(i + 40) * VH, r = 170 + hash1(i + 80) * 220;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.16 * power})`);
    g.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

// heat shimmer: cheap wobbly bands, Ultra only
function drawHeatHaze(power) {
  if (!gfx.anim || power <= 0.01) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) {
    const y = (i / 14) * VH + Math.sin(tAnim * 1.6 + i) * 6;
    ctx.fillStyle = `rgba(255,220,170,${0.02 * power})`;
    ctx.fillRect(0, y, VW, 10 + Math.sin(tAnim * 2 + i * 1.7) * 5);
  }
  ctx.restore();
}

// Called after the world is drawn, before the HUD. Screen space (no camera transform).
function drawSky() {
  const sky = skyNow(), p = weatherPower();
  const cur = WEATHER[weather.kind], nxt = WEATHER[weather.next];

  drawWeatherLayer(weather.kind, 1 - p);
  drawWeatherLayer(weather.next, p);
  if (WEATHER[weather.kind].fx === 'haze') drawHeatHaze((1 - p) * (WEATHER[weather.kind].dens || 1));
  if (WEATHER[weather.next].fx === 'haze') drawHeatHaze(p * (WEATHER[weather.next].dens || 1));

  // weather colour wash
  const tintOf = w => w.tint || [0, 0, 0, 0];
  const a = tintOf(cur), b = tintOf(nxt);
  const mix = a.map((v, i) => v + (b[i] - v) * p);
  if (mix[3] > 0.003) {
    ctx.fillStyle = `rgba(${mix[0] | 0},${mix[1] | 0},${mix[2] | 0},${mix[3]})`;
    ctx.fillRect(0, 0, VW, VH);
  }

  // night / dawn / dusk darkness, lifted around the hero like a lantern
  if (sky.dark > 0.004) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    const [r, g, bl] = sky.c;
    if (state === 'play' && hero && !hero.dead && gfx.glow) {
      const hx = hero.x - cam.x, hy = hero.y - cam.y - 28, rad = lightRadius() + 70;
      const grad = ctx.createRadialGradient(hx, hy, 20, hx, hy, rad);
      const lit = Math.max(0, sky.dark - 0.30);
      grad.addColorStop(0, `rgba(255,236,200,${1 - lit})`);
      grad.addColorStop(0.55, `rgba(${r},${g},${bl},${sky.dark * 0.75})`);
      grad.addColorStop(1, `rgba(${r},${g},${bl},${sky.dark})`);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = `rgba(${r},${g},${bl},${sky.dark})`;
    }
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();
  }

  // fog-of-war: hide whatever is beyond the hero's sight (night, fog, storms...)
  drawVision();

  // storm/blizzard vignette
  const vig = cur.vig + (nxt.vig - cur.vig) * p;
  if (vig > 0.01) {
    const g = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.3, VW / 2, VH / 2, VH * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${vig})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  }
}

// small clock + weather chip for the HUD
function drawClock(x, y) {
  const sky = skyNow(), night = isNight();
  ctx.fillStyle = 'rgba(10,10,16,0.62)'; ctx.strokeStyle = 'rgba(120,120,160,0.28)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x, y, 150, 40, 9); ctx.fill(); ctx.stroke();
  // sun / moon dial
  const cx = x + 22, cy = y + 20;
  ctx.fillStyle = night ? '#dfe6f5' : '#ffd36a';
  ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
  if (night) { ctx.fillStyle = 'rgba(10,10,16,0.9)'; ctx.beginPath(); ctx.arc(cx + 3.5, cy - 2.5, 7, 0, Math.PI * 2); ctx.fill(); }
  else {
    ctx.strokeStyle = 'rgba(255,211,106,0.7)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + tAnim * 0.2; line(cx + Math.cos(a) * 10, cy + Math.sin(a) * 10, cx + Math.cos(a) * 12.5, cy + Math.sin(a) * 12.5); }
  }
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px "Segoe UI", sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(`Day ${dayCount}  ${clockLabel()}`, x + 40, y + 17);
  const w = WEATHER[weather.t >= 0.5 ? weather.next : weather.kind];
  ctx.fillStyle = '#9a98ad'; ctx.font = '11px "Segoe UI", sans-serif';
  ctx.fillText(`${timePhase()} · ${w.name}`, x + 40, y + 31);
}
