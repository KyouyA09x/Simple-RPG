// Environmental visibility: at night and in bad weather only the area near the hero is
// actually visible. Everything beyond is hidden by an obscuring layer whose colour matches the cause
// (darkness, fog, sand, snow...). This is gameplay, not just a tint: enemies, drops, arrows and the minimap
// dots outside the clear radius genuinely can't be seen.

const BASE_LIGHT_RADIUS = 130;                 // logical px around the hero that stays clear at night
const lightBonus = () => (typeof hero !== 'undefined' && hero && hero.lightBonus) || 0;   // lamps/torches (village) later
// the flame is never steady: a slow waver, and now and then it gutters for a moment (calmer in comfort mode)
function lightFlicker() {
  if (typeof dev !== 'undefined' && dev.noFog) return 1;
  const k = settings.comfort ? 0.3 : 1, t = tAnim;
  let f = 1 + k * (0.025 * Math.sin(t * 6.1) + 0.018 * Math.sin(t * 11.7 + 1.3) + 0.012 * Math.sin(t * 2.3));
  const ph = t % 9.3;
  if (!settings.comfort && ph > 8.9) f *= 1 - 0.14 * Math.sin((ph - 8.9) / 0.4 * Math.PI);
  return f;
}
const lightRadius = () => (BASE_LIGHT_RADIUS + lightBonus()) * lightFlicker();

// r = radius (px) that stays clear, d = how completely the rest is hidden (1 = fully), c = colour of the haze.
// Weather not listed (clear, windy, aurora, heat haze, mirage) doesn't limit sight.
const VISION = {
  fog:        { r: 125, d: 0.96, c: [205, 212, 224] },
  whiteout:   { r: 80, d: 1.00, c: [236, 241, 248] },     // harshest of the fog types
  smog:       { r: 115, d: 0.95, c: [58, 52, 48] },
  sandstorm:  { r: 135, d: 0.92, c: [196, 152, 84] },
  blizzard:   { r: 130, d: 0.92, c: [214, 228, 242] },
  storm:      { r: 150, d: 0.90, c: [16, 22, 38] },
  rain:       { r: 230, d: 0.70, c: [30, 42, 66] },
  drizzle:    { r: 270, d: 0.50, c: [50, 64, 90] },
  snowfall:   { r: 260, d: 0.52, c: [200, 216, 232] },
  hail:       { r: 225, d: 0.70, c: [150, 175, 205] },
  leafstorm:  { r: 235, d: 0.62, c: [60, 76, 44] },
  ashfall:    { r: 225, d: 0.70, c: [48, 44, 44] },
  emberstorm: { r: 215, d: 0.72, c: [60, 26, 12] },
  lavarain:   { r: 210, d: 0.72, c: [70, 24, 10] },
};
const NIGHT_HAZE = { d: 0.985, c: [2, 4, 12] };

const smooth01 = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

// lightning briefly reveals everything: 1 at the strike, fading out. Comfort mode eases in instead of snapping.
function revealAmount() {
  const a = weather.revealAge;
  if (a === undefined || a > 1.4) return 0;
  if (settings.comfort) return a < 0.3 ? 0.6 * smooth01(a / 0.3) : 0.6 * Math.exp(-(a - 0.3) * 2.5);
  return Math.exp(-a * 4.5);
}

let visLayers = [];
function computeVision() {
  visLayers = [];
  if (dev.noFog || state !== 'play' || !hero || hero.dead) return;
  const bonus = lightBonus(), reveal = revealAmount(), p = weatherPower();
  const push = (r, d, c) => {
    d *= 1 - reveal;
    if (d > 0.01) visLayers.push({ r, d, c, fade: Math.max(55, r * 0.45) });          // a short fade: the dark starts close and hard
  };

  // night: closes in gradually through dusk, lifts through dawn. An aurora night is exempt (the sky lights it).
  const f = smooth01((skyNow().dark - 0.06) / 0.28);
  const aurora = (weather.kind === 'aurora' ? 1 - p : 0) + (weather.next === 'aurora' ? p : 0);
  const night = f * (1 - Math.min(1, aurora));
  if (night > 0.01) push(lightRadius() + (1 - night) * 260, NIGHT_HAZE.d * night, NIGHT_HAZE.c);

  // weather, cross-fading with the weather system
  for (const [kind, w] of [[weather.kind, 1 - p], [weather.next, p]]) {
    const v = VISION[kind];
    if (v && w > 0.01) push(v.r + bonus * 0.5 + (1 - w) * 220, v.d * w, v.c);
  }
}

// how visible is a world position right now? 1 = clear, 0 = hidden.
function visibilityAt(x, y) {
  if (!visLayers.length) return 1;
  const dist = Math.hypot(x - hero.x, y - (hero.y - 28));
  let v = 1;
  for (const L of visLayers) {
    const t = (dist - L.r) / L.fade;
    if (t > 0) v *= 1 - L.d * smooth01(t);
  }
  return v;
}
// how restricted is sight overall (0 = unrestricted, 1 = fully blind beyond the radius)? Used by the minimap.
function visibilitySeverity() {
  let s = 0;
  for (const L of visLayers) s = Math.max(s, L.d);
  return s;
}
function visibilityClearRadius() {
  let r = 99999;
  for (const L of visLayers) if (L.d >= 0.3) r = Math.min(r, L.r);
  return r;
}

// Draws the obscuring layers in screen space (called from drawSky, after the world, before the HUD).
function drawVision(c = ctx) {
  if (!visLayers.length) return;
  const cx = hero.x - cam.x, cy = hero.y - cam.y - 28;
  for (const L of visLayers) {
    const [r, g, b] = L.c;
    const grad = c.createRadialGradient(cx, cy, L.r, cx, cy, L.r + L.fade);
    grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
    grad.addColorStop(0.3, `rgba(${r},${g},${b},${L.d * 0.12})`);
    grad.addColorStop(0.6, `rgba(${r},${g},${b},${L.d * 0.55})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},${L.d})`);
    c.fillStyle = grad;
    c.fillRect(0, 0, VW, VH);
  }
  // fear: the whole picture dims and cools even inside the light, and the corners close in and out like slow breathing
  const sev = visibilitySeverity();
  if (sev > 0.3) {
    c.fillStyle = `rgba(4,8,20,${0.11 * sev})`; c.fillRect(0, 0, VW, VH);
    const pulse = settings.comfort ? 0.5 : 0.5 + 0.5 * Math.sin(tAnim * 1.3);
    const g = c.createRadialGradient(VW / 2, VH / 2, VH * 0.32, VW / 2, VH / 2, VH * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${(0.3 + 0.1 * pulse) * sev})`);
    c.fillStyle = g; c.fillRect(0, 0, VW, VH);
  }
}

// Pairs of eyes glint out in the dark beyond the light, watch for a moment and vanish if you step toward them.
// Purely atmosphere: they are not enemies and change nothing in the game.
const darkEyes = [];
function updateDarkEyes(dt) {
  const active = !dev.noFog && state === 'play' && hero && !hero.dead && visLayers.length;
  const sev = active ? visibilitySeverity() : 0, clear = active ? visibilityClearRadius() : 0;
  if (sev > 0.75 && darkEyes.length < 3 && Math.random() < dt * 0.3) {
    const a = Math.random() * Math.PI * 2, d = clear + 30 + Math.random() * 80;
    const x = hero.x + Math.cos(a) * d, y = hero.y + Math.sin(a) * d * 0.75;
    if (x > 40 && x < WW - 40 && y > 80 && y < WH - 30 && !waterAt(x, y) && !world.lava.some(l => inEllipse(x, y, l, 30)) && visibilityAt(x, y) < 0.3)
      darkEyes.push({ x, y, age: 0, life: 2.2 + Math.random() * 3.2, blink: 1 + Math.random() * 2, gap: 5 + Math.random() * 3, f: Math.cos(a) < 0 ? 1 : -1 });
  }
  for (const e of darkEyes) {
    e.age += dt;
    if (Math.hypot(e.x - hero.x, e.y - hero.y) < clear + 12) e.life = Math.min(e.life, e.age + 0.2);     // gone as you approach
  }
  for (let i = darkEyes.length - 1; i >= 0; i--) if (darkEyes[i].age > darkEyes[i].life || !sev) darkEyes.splice(i, 1);
}
function drawDarkEyes() {
  if (!darkEyes.length) return;
  // in pale fog or snow a glowing pair would just wash out, so there they show as dark shapes instead
  const pale = visLayers.some(L => L.d > 0.5 && (L.c[0] + L.c[1] + L.c[2]) / 3 > 140);
  ctx.save();
  if (!pale) ctx.globalCompositeOperation = 'lighter';
  for (const e of darkEyes) {
    const fade = Math.min(1, e.age / 0.7) * Math.min(1, (e.life - e.age) / 0.35);
    const closed = !settings.comfort && ((e.age - e.blink) % 2.6 > 0 && (e.age - e.blink) % 2.6 < 0.12 && e.age > e.blink);
    if (closed || fade <= 0) continue;
    const sx = e.x - cam.x, sy = e.y - cam.y;
    for (const dx of [-e.gap / 2, e.gap / 2]) {
      if (pale) {
        ctx.fillStyle = `rgba(14,8,8,${0.9 * fade})`; ctx.beginPath(); ctx.ellipse(sx + dx, sy, 2.6, 1.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(150,30,20,${0.7 * fade})`; ctx.beginPath(); ctx.arc(sx + dx, sy, 0.8, 0, Math.PI * 2); ctx.fill();
      } else {
        const g = ctx.createRadialGradient(sx + dx, sy, 0, sx + dx, sy, 7);
        g.addColorStop(0, `rgba(255,214,110,${0.55 * fade})`); g.addColorStop(1, 'rgba(255,170,60,0)');
        ctx.fillStyle = g; ctx.fillRect(sx + dx - 7, sy - 7, 14, 14);
        ctx.fillStyle = `rgba(255,236,170,${0.95 * fade})`; ctx.beginPath(); ctx.ellipse(sx + dx, sy, 1.9, 1.15, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  ctx.restore();
}
