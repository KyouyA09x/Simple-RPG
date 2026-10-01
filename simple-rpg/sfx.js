// Sound: synthesized sound effects + procedural background music (Web Audio, no audio files).
const Sound = (() => {
  let actx = null, master, sfxBus, musicBus, musicFilter, ambBus, callBus, meter = null;
  const vol = { sfx: 0.8, music: 0.5, amb: 0.6 };

  function ctx() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
      const comp = actx.createDynamicsCompressor();
      comp.connect(actx.destination);
      master = actx.createGain(); master.connect(comp);
      meter = actx.createAnalyser(); meter.fftSize = 2048; master.connect(meter);       // read-only tap, used by level() to check how loud things are
      sfxBus = actx.createGain(); sfxBus.connect(master);
      musicFilter = actx.createBiquadFilter(); musicFilter.type = 'lowpass'; musicFilter.frequency.value = 20000;
      musicFilter.connect(master);
      musicBus = actx.createGain(); musicBus.connect(musicFilter);
      ambBus = actx.createGain(); ambBus.connect(musicFilter);
      callBus = actx.createGain(); callBus.gain.value = 2.8; callBus.connect(ambBus);        // creature calls were ~10 dB too quiet to hear       // ambience is muffled with the music when paused
      applyVolume();
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function applyVolume() {
    if (!actx) return;
    sfxBus.gain.value = vol.sfx;
    musicBus.gain.value = vol.music * 0.55;
    ambBus.gain.value = vol.amb;
  }
  function setVolume(sfx, music, amb = vol.amb) { vol.sfx = sfx; vol.music = music; vol.amb = amb; applyVolume(); }

  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function tone(freq, dur, type = 'square', v = 0.15, slideTo = null, delay = 0, bus = sfxBus, t0 = null, attack = 0.005) {
    const a = ctx(); if (!a) return;
    const t = (t0 ?? a.currentTime) + delay;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  let noiseBuf = null;
  function noise(dur, v = 0.2, filter = 1500, delay = 0, bus = sfxBus, t0 = null, type = 'lowpass') {
    const a = ctx(); if (!a) return;
    const t = (t0 ?? a.currentTime) + delay;
    if (!noiseBuf) {
      noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = noiseBuf; f.type = type; f.frequency.value = filter;
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }

  const SFX = {
    swing:   () => noise(0.12, 0.12, 3000),
    hit:     () => { tone(220, 0.1, 'square', 0.12, 90); noise(0.08, 0.15, 900); },
    crit:    () => { tone(880, 0.12, 'square', 0.1, 220); noise(0.12, 0.2, 2500); },
    kill:    () => tone(400, 0.15, 'triangle', 0.15, 80),
    hurt:    () => tone(160, 0.25, 'sawtooth', 0.18, 60),
    flip:    () => tone(300, 0.2, 'sine', 0.12, 900),
    tired:   () => tone(120, 0.1, 'square', 0.08),
    step:    () => noise(0.04, 0.03, 600),
    pickup:  () => { tone(700, 0.08, 'square', 0.1); tone(1050, 0.12, 'square', 0.1, null, 0.07); },
    potion:  () => tone(500, 0.3, 'sine', 0.15, 1000),
    levelup: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'square', 0.12, null, i * 0.09)),
    unlock:  () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.15, 'triangle', 0.14, null, i * 0.08)),
    wave:    () => { tone(330, 0.15, 'square', 0.1); tone(440, 0.2, 'square', 0.1, null, 0.15); },
    roar:    () => { tone(90, 1.0, 'sawtooth', 0.25, 40); noise(0.9, 0.2, 400); },
    slam:    () => { tone(70, 0.5, 'sine', 0.35, 30); noise(0.4, 0.3, 300); },
    arrow:   () => tone(900, 0.1, 'triangle', 0.08, 400),
    squish:  () => tone(180, 0.15, 'sine', 0.15, 500),
    charge:  () => tone(140, 0.3, 'sawtooth', 0.1, 260),
    spawn:   () => noise(0.25, 0.05, 500),
    lava:    () => noise(0.2, 0.12, 700),
    victory: () => [523, 659, 784, 659, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.15, null, i * 0.12)),
    death:   () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'triangle', 0.16, null, i * 0.2)),
    click:   () => tone(600, 0.05, 'square', 0.08),
    chirp:   () => { tone(2800, 0.06, 'sine', 0.05, 3400); tone(3000, 0.07, 'sine', 0.04, 2500, 0.09); },
    frog:    () => { tone(160, 0.09, 'sawtooth', 0.04, 110); tone(160, 0.09, 'sawtooth', 0.04, 110, 0.13); },
    splash:  () => { noise(0.2, 0.1, 1900); tone(520, 0.14, 'sine', 0.05, 230); },
    coin:    () => { tone(1318, 0.07, 'triangle', 0.1); tone(1760, 0.16, 'triangle', 0.1, null, 0.06); },
    crackle: () => { noise(0.03 + Math.random() * 0.05, 0.05 + Math.random() * 0.08, 2500 + Math.random() * 3000, 0, sfxBus, null, 'bandpass'); },
    save:    () => { tone(660, 0.1, 'sine', 0.1); tone(990, 0.15, 'sine', 0.1, null, 0.08); },
    slash:   () => { noise(0.35, 0.3, 5000); tone(1200, 0.4, 'sawtooth', 0.08, 200); },
    thunder: () => { noise(1.4, 0.22, 420); tone(46, 1.6, 'sine', 0.18, 28); noise(0.25, 0.12, 5000, 0.05); },
    boom:    () => { tone(55, 1.2, 'sine', 0.4, 30); noise(1.0, 0.3, 250); },
  };
  function sfx(name) { if (vol.sfx > 0 && SFX[name]) SFX[name](); }

  // Sounds that come from somewhere in the world (village work, kids, animals): g = 0..1 loudness by distance
  const POS = {
    chop:   g => { noise(0.07, 0.16 * g, 900); tone(190, 0.08, 'triangle', 0.14 * g, 90); },
    hammer: g => { tone(1250, 0.07, 'square', 0.08 * g, 900); tone(2400, 0.05, 'triangle', 0.045 * g); noise(0.04, 0.09 * g, 6000, 0, sfxBus, null, 'highpass'); },
    sweep:  g => noise(0.22, 0.13 * g, 2200, 0, sfxBus, null, 'bandpass'),
    pour:   g => noise(0.5, 0.09 * g, 3000, 0, sfxBus, null, 'highpass'),
    dip:    g => { noise(0.25, 0.09 * g, 1800); tone(480, 0.12, 'sine', 0.06 * g, 220); },
    kick:   g => { tone(170, 0.08, 'sine', 0.12 * g, 90); noise(0.04, 0.06 * g, 800); },
    bark:   g => { tone(320, 0.09, 'sawtooth', 0.11 * g, 180); tone(300, 0.1, 'sawtooth', 0.1 * g, 160, 0.14); },
    cluck:  g => { tone(900, 0.05, 'square', 0.07 * g, 600); tone(760, 0.05, 'square', 0.06 * g, 500, 0.07); },
    giggle: g => { for (let i = 0; i < 4; i++) tone(900 + Math.random() * 300, 0.06, 'sine', 0.075 * g, null, i * 0.08); },
    door:   g => tone(140, 0.15, 'square', 0.1 * g, 90),
  };
  function sfxAt(name, g = 1) { if (vol.sfx > 0 && g > 0.05 && POS[name]) POS[name](Math.min(1, g)); }

  // --- Music: 16-step bars, 4-bar loops, one theme per area ---
  // chords are semitone offsets from the theme root (MIDI note number)
  const THEMES = {
    title:   { bpm: 72,  root: 57, chords: [[0,3,7],[-4,0,3],[3,7,10],[-2,2,5]], arp: 'x.x.x.x.x.x.x.x.', bass: 'x.......x.......', drums: null, pad: 0.05, lead: 0.05, leadType: 'triangle', seed: 3 },
    forest:  { bpm: 112, root: 60, chords: [[0,4,7],[-5,-1,2],[-3,0,4],[-7,-3,0]], arp: 'x.xxx.xxx.xxx.xx', bass: 'x..x..x.x..x..x.', drums: 'k...s..kk...s...', hat: true, pad: 0.035, lead: 0.05, leadType: 'square', seed: 11 },
    desert:  { bpm: 100, root: 62, chords: [[0,3,7],[1,5,8],[0,3,7],[-2,2,5]], arp: 'x..x..x.x..x..x.', bass: 'x..x....x..x....', drums: 'k..k..s.k.k...s.', hat: false, pad: 0.04, lead: 0.05, leadType: 'sawtooth', seed: 7 },
    snow:    { bpm: 84,  root: 64, chords: [[0,3,7],[-4,0,3],[3,7,10],[-2,2,5]], arp: 'x...x...x...x...', bass: 'x.......x.......', drums: 'k.......s.......', hat: false, pad: 0.06, lead: 0.05, leadType: 'sine', bell: true, seed: 5 },
    volcano: { bpm: 132, root: 52, chords: [[0,3,7],[0,3,7],[-4,0,3],[-2,2,5]], arp: 'xxxxxxxxxxxxxxxx', bass: 'x.xx.xx.x.xx.xx.', drums: 'k.k.s.k.k.k.s.kk', hat: true, pad: 0.03, lead: 0.045, leadType: 'sawtooth', seed: 19 },
    boss:    { bpm: 150, root: 50, chords: [[0,3,7],[-4,0,3],[-2,2,5],[-5,-1,2]], arp: 'xxxxxxxxxxxxxxxx', bass: 'xxx.xxx.xxx.xx.x', drums: 'k.s.kks.k.s.kkss', hat: true, pad: 0.035, lead: 0.05, leadType: 'square', seed: 23 },
    camp:    { bpm: 66,  root: 55, chords: [[0,4,7],[-3,0,4],[-7,-3,0],[-5,-1,2]], arp: 'x..x..x...x..x..', bass: 'x.......x.......', drums: null, pad: 0.035, lead: 0.035, leadType: 'triangle', bell: true, seed: 31 },
    swamp:   { bpm: 70,  root: 48, chords: [[0,3,7],[-2,2,5],[-4,0,3],[-5,-1,2]], arp: 'x..x....x..x....', bass: 'x.......x.....x.', drums: 'k.......k...k...', hat: false, pad: 0.055, lead: 0.04, leadType: 'sine', seed: 41 },
    jungle:  { bpm: 128, root: 57, chords: [[0,4,7],[5,9,12],[7,11,14],[0,4,7]], arp: 'x.xx.xx.x.xx.xx.', bass: 'x..x..x.x..x..x.', drums: 'k..k.s.kk..ks.s.', hat: true, pad: 0.025, lead: 0.05, leadType: 'triangle', seed: 47 },
    ruins:   { bpm: 58,  root: 52, chords: [[0,3,6],[-3,0,3],[-5,-1,2],[-7,-3,0]], arp: 'x.......x.......', bass: 'x.......x.......', drums: null, pad: 0.06, lead: 0.03, leadType: 'sine', bell: true, seed: 53 },
    highlands:{ bpm: 92, root: 62, chords: [[0,4,7],[-3,0,4],[-5,-1,2],[-7,-3,0]], arp: 'x.x...x.x.x...x.', bass: 'x.......x.......', drums: 'k.......s.......', hat: false, pad: 0.05, lead: 0.05, leadType: 'triangle', seed: 59 },
    village: { bpm: 96, root: 60, chords: [[0,4,7],[-3,0,4],[-5,-1,2],[-7,-3,0]], arp: 'x.x.x.x.x.x.x.x.', bass: 'x...x...x...x...', drums: null, pad: 0.045, lead: 0.07, leadType: 'triangle', seed: 67 },
    gameover:{ bpm: 60,  root: 57, chords: [[0,3,7],[-4,0,3],[-7,-3,0],[-5,-1,2]], arp: 'x...............', bass: 'x...............', drums: null, pad: 0.06, lead: 0, seed: 2 },
  };
  // precompute a repeating lead motif per theme (seeded, stays on chord tones)
  for (const th of Object.values(THEMES)) {
    let s = th.seed;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    th.motif = Array.from({ length: 32 }, (_, i) => (i % 2 === 0 && r() < 0.7) ? Math.floor(r() * 4) : (r() < 0.2 ? Math.floor(r() * 4) : -1));
  }

  let cur = null, step = 0, nextT = 0, timer = null;
  function playStep(th, i, t, sp) {
    const bar = Math.floor(i / 16) % th.chords.length, s = i % 16;
    const ch = th.chords[bar].map(n => n + th.root);
    // pad at the start of each bar
    if (s === 0 && th.pad) for (const n of ch) {
      tone(mtof(n), sp * 16, 'sawtooth', th.pad, null, 0, musicBus, t, 0.3);
      tone(mtof(n) * 1.004, sp * 16, 'sawtooth', th.pad * 0.7, null, 0, musicBus, t, 0.3);
    }
    if (th.bass[s] === 'x') tone(mtof(ch[0] - 24), sp * 1.8, 'triangle', 0.22, null, 0, musicBus, t);
    if (th.arp[s] === 'x') {
      const n = ch[(i >> (th.arp === 'xxxxxxxxxxxxxxxx' ? 0 : 1)) % 3] + 12;
      tone(mtof(n), sp * (th.bell ? 3 : 0.9), th.bell ? 'sine' : 'square', th.bell ? 0.07 : 0.035, null, 0, musicBus, t);
    }
    if (th.lead && bar % 2 === 1) {
      const m = th.motif[(i % 32)];
      if (m >= 0) tone(mtof(ch[m % 3] + 24 + (m === 3 ? 12 : 0)), sp * 1.8, th.leadType, th.lead, null, 0, musicBus, t, 0.01);
    }
    if (th.drums) {
      const d = th.drums[s];
      if (d === 'k') tone(150, 0.18, 'sine', 0.5, 40, 0, musicBus, t);
      if (d === 's') noise(0.14, 0.22, 1800, 0, musicBus, t, 'highpass');
      if (th.hat && s % 2 === 0) noise(0.03, 0.06, 8000, 0, musicBus, t, 'highpass');
    }
  }
  function schedule() {
    if (!cur || !actx || vol.music <= 0) return;
    const th = THEMES[cur], sp = 60 / th.bpm / 4;
    if (nextT < actx.currentTime - 0.2) nextT = actx.currentTime + 0.05;   // tab was throttled
    while (nextT < actx.currentTime + 0.15) { playStep(th, step, nextT, sp); nextT += sp; step++; }
  }
  function music(name) {
    if (cur === name) return;
    cur = name;
    const a = ctx(); if (!a) return;
    musicBus.gain.cancelScheduledValues(a.currentTime);
    musicBus.gain.setValueAtTime(0.0001, a.currentTime);
    musicBus.gain.linearRampToValueAtTime(vol.music * 0.55, a.currentTime + 1.2);  // fade in the new theme
    step = 0; nextT = a.currentTime + 0.1;
    if (!timer) timer = setInterval(schedule, 25);
  }
  function muffle(on) {                // paused = music heard "through a wall"
    if (!actx) return;
    musicFilter.frequency.setTargetAtTime(on ? 700 : 20000, actx.currentTime, 0.1);
  }

  // --- Footsteps: the sound depends on what the hero is walking on ---
  function footstep(surface) {
    if (vol.sfx <= 0) return;
    switch (surface) {
      case 'sand':  noise(0.07, 0.085, 2600, 0, sfxBus, null, 'bandpass'); break;
      case 'snow':  noise(0.05, 0.09, 1700, 0, sfxBus, null, 'bandpass'); noise(0.04, 0.06, 2200, 0.045, sfxBus, null, 'bandpass'); break;
      case 'stone': tone(210, 0.04, 'triangle', 0.045, 130); noise(0.03, 0.03, 4000, 0, sfxBus, null, 'highpass'); break;
      case 'mud':   noise(0.1, 0.05, 320); tone(140, 0.09, 'sine', 0.035, 70); break;
      case 'water': noise(0.14, 0.07, 1500, 0, sfxBus, null, 'bandpass'); tone(520, 0.1, 'sine', 0.03, 260); break;
      default:      noise(0.05, 0.17, 700);                      // grass
    }
  }

  // --- Ambience: wind and rain beds plus random creature calls, different for each biome ---
  let windLevel, rainLevel, windFilter, bedsStarted = false, scene = null, nextCall = 0, ambTimer = null;
  function getNoise() {
    if (!noiseBuf) {
      noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }
  function startBeds() {
    if (bedsStarted || !actx) return;
    bedsStarted = true;
    const loop = () => { const s = actx.createBufferSource(); s.buffer = getNoise(); s.loop = true; s.start(0, Math.random()); return s; };
    windFilter = actx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 450; windFilter.Q.value = 0.7;
    const breathe = actx.createGain(); breathe.gain.value = 0.65;
    const lfo = actx.createOscillator(), depth = actx.createGain(); lfo.frequency.value = 0.11; depth.gain.value = 0.35;
    lfo.connect(depth); depth.connect(breathe.gain); lfo.start();
    windLevel = actx.createGain(); windLevel.gain.value = 0;
    loop().connect(windFilter); windFilter.connect(breathe); breathe.connect(windLevel); windLevel.connect(ambBus);
    const hp = actx.createBiquadFilter(), lp = actx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 1400; lp.type = 'lowpass'; lp.frequency.value = 8000;
    rainLevel = actx.createGain(); rainLevel.gain.value = 0;
    loop().connect(hp); hp.connect(lp); lp.connect(rainLevel); rainLevel.connect(ambBus);
  }
  const R = (a, b) => a + Math.random() * (b - a);
  const CALLS = {
    birdsong: () => { const base = R(2200, 3200), n = 4 + Math.floor(Math.random() * 4); for (let i = 0; i < n; i++) { const f = base * R(0.8, 1.3); tone(f, 0.07, 'sine', 0.045, f * R(0.8, 1.35), i * 0.11, callBus); } },
    chirp:    () => { const f = R(2400, 3400); tone(f, 0.06, 'sine', 0.045, f * 1.25, 0, callBus); tone(f * 1.1, 0.07, 'sine', 0.04, f * 0.9, 0.09, callBus); },
    cricket:  () => { const f = R(4000, 4500); for (let k = 0; k < 3; k++) for (let i = 0; i < 4; i++) tone(f, 0.02, 'sine', 0.04, null, k * 0.34 + i * 0.045, callBus); },
    owl:      () => { tone(430, 0.32, 'sine', 0.06, 390, 0, callBus, null, 0.05); tone(390, 0.5, 'sine', 0.06, 330, 0.5, callBus, null, 0.05); },
    frog:     () => { const f = R(130, 190), n = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) tone(f, 0.09, 'sawtooth', 0.05, f * 0.7, i * 0.13, callBus); },
    wolf:     () => { tone(300, 2.4, 'sine', 0.05, 520, 0, callBus, null, 0.6); tone(520, 1.2, 'sine', 0.04, 280, 1.4, callBus); },
    hawk:     () => tone(2300, 0.55, 'sine', 0.035, 1500, 0, callBus, null, 0.04),
    gust:     () => noise(R(1.2, 2.2), 0.07, 700, 0, callBus),
    drip:     () => { tone(1500, 0.1, 'sine', 0.05, 900, 0, callBus); tone(1500, 0.1, 'sine', 0.02, 900, 0.18, callBus); },
    toll:     () => { tone(196, 3.2, 'sine', 0.05, null, 0, callBus, null, 0.01); tone(392, 2.4, 'sine', 0.025, null, 0, callBus, null, 0.01); },
    insects:  () => { tone(3700, 1.5, 'sine', 0.03, null, 0, callBus, null, 0.3); tone(3740, 1.5, 'sine', 0.03, null, 0, callBus, null, 0.3); },
    rumble:   () => { noise(R(1.5, 2.6), 0.06, 140, 0, callBus); tone(48, 1.8, 'sine', 0.05, 40, 0, callBus, null, 0.2); },
    glub:     () => { tone(110, 0.25, 'sine', 0.07, 55, 0, callBus); noise(0.15, 0.04, 400, 0.05, callBus); },
    icecrack: () => { noise(0.1, 0.045, 3500, 0, callBus, null, 'highpass'); tone(1800, 0.14, 'sine', 0.02, 400, 0, callBus); },
    rustle:   () => noise(R(0.5, 1), 0.03, 2800, 0, callBus, null, 'highpass'),
    lap:      () => noise(0.5, 0.1, 900, 0, callBus, null, 'bandpass'),
    wail:     () => { tone(560, 2.2, 'sine', 0.03, 480, 0, callBus, null, 0.8); tone(566, 2.2, 'sine', 0.03, 486, 0, callBus, null, 0.8); },
  };
  const BIRDY = ['birdsong', 'chirp', 'cricket', 'owl', 'insects', 'hawk'];
  const AMBIENCE = {
    forest:    { gap: [2, 6],     day: [['birdsong', 4], ['chirp', 4], ['rustle', 2], ['lap', 1]], night: [['cricket', 5], ['owl', 2], ['rustle', 1]] },
    desert:    { gap: [4, 10],    day: [['gust', 4], ['hawk', 1], ['rustle', 1]], night: [['gust', 3], ['wolf', 1], ['cricket', 2]] },
    snow:      { gap: [4, 10],    day: [['gust', 4], ['icecrack', 2]], night: [['gust', 4], ['wolf', 2], ['icecrack', 1]] },
    volcano:   { gap: [3, 8],     day: [['rumble', 3], ['glub', 4]], night: [['rumble', 3], ['glub', 4]] },
    swamp:     { gap: [1.5, 4],   day: [['frog', 6], ['insects', 3], ['drip', 2], ['lap', 2]], night: [['frog', 6], ['cricket', 3], ['owl', 2], ['drip', 1]] },
    jungle:    { gap: [1.5, 4],   day: [['birdsong', 5], ['insects', 4], ['chirp', 3], ['lap', 1]], night: [['insects', 5], ['frog', 3], ['cricket', 3], ['owl', 1]] },
    ruins:     { gap: [3, 8],     day: [['gust', 3], ['drip', 2], ['rustle', 1]], night: [['wail', 2], ['toll', 1], ['gust', 3], ['drip', 2]] },
    highlands: { gap: [3, 8],     day: [['gust', 5], ['hawk', 2], ['birdsong', 1]], night: [['gust', 5], ['wolf', 2], ['owl', 1]] },
    camp:      { gap: [2, 5],     day: [['cricket', 1]], night: [['cricket', 5], ['owl', 2]] },
    village:   { gap: [2, 5],     day: [['birdsong', 4], ['chirp', 3], ['rustle', 1]], night: [['cricket', 5], ['owl', 2], ['rustle', 1]] },
  };
  function tickAmbience() {
    if (!actx || !scene || !scene.biome || vol.amb <= 0 || actx.state !== 'running') return;
    if (actx.currentTime < nextCall) return;
    const A = AMBIENCE[scene.biome]; if (!A) return;
    const list = scene.night ? A.night : A.day;
    let tot = 0; for (const [, w] of list) tot += w;
    let x = Math.random() * tot, name = list[0][0];
    for (const [k, w] of list) if ((x -= w) <= 0) { name = k; break; }
    nextCall = actx.currentTime + R(A.gap[0], A.gap[1]);
    if (scene.rain > 0.08 && BIRDY.includes(name) && Math.random() < 0.85) return;     // animals go quiet in the rain
    CALLS[name]?.();
  }
  // scene: { biome, night, wind (0..~0.3), rain (0..~0.2), pitch (Hz of the wind) } or null for silence
  function setScene(s) {
    scene = s;
    const a = ctx(); if (!a) return;
    startBeds();
    if (!ambTimer) ambTimer = setInterval(tickAmbience, 600);
    const t = a.currentTime;
    windLevel.gain.setTargetAtTime(s ? Math.min(0.4, s.wind * 2.4) : 0, t, 0.8);        // wind was inaudible at its old level
    rainLevel.gain.setTargetAtTime(s ? s.rain : 0, t, 0.8);
    windFilter.frequency.setTargetAtTime(s && s.pitch ? s.pitch : 450, t, 1.0);
  }

  // peak / rms level (dBFS) of everything heard right now, before the final limiter; null until audio has started
  function level() {
    if (!meter) return null;
    const b = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(b);
    let pk = 0, sum = 0; for (const v of b) { const a = Math.abs(v); if (a > pk) pk = a; sum += v * v; }
    const db = x => x > 1e-5 ? 20 * Math.log10(x) : -100;
    return { peak: db(pk), rms: db(Math.sqrt(sum / b.length)) };
  }
  return { ctx, level, call: n => { if (CALLS[n]) CALLS[n](); }, sfx, sfxAt, music, muffle, setVolume, step: footstep, setScene, get current() { return cur; } };
})();
