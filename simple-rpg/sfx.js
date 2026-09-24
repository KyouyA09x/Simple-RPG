// Sound: synthesized sound effects + procedural background music (Web Audio, no audio files).
const Sound = (() => {
  let actx = null, master, sfxBus, musicBus, musicFilter;
  const vol = { sfx: 0.8, music: 0.5 };

  function ctx() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
      const comp = actx.createDynamicsCompressor();
      comp.connect(actx.destination);
      master = actx.createGain(); master.connect(comp);
      sfxBus = actx.createGain(); sfxBus.connect(master);
      musicFilter = actx.createBiquadFilter(); musicFilter.type = 'lowpass'; musicFilter.frequency.value = 20000;
      musicFilter.connect(master);
      musicBus = actx.createGain(); musicBus.connect(musicFilter);
      applyVolume();
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function applyVolume() {
    if (!actx) return;
    sfxBus.gain.value = vol.sfx;
    musicBus.gain.value = vol.music * 0.55;
  }
  function setVolume(sfx, music) { vol.sfx = sfx; vol.music = music; applyVolume(); }

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
    crackle: () => { noise(0.03 + Math.random() * 0.05, 0.05 + Math.random() * 0.08, 2500 + Math.random() * 3000, 0, sfxBus, null, 'bandpass'); },
    save:    () => { tone(660, 0.1, 'sine', 0.1); tone(990, 0.15, 'sine', 0.1, null, 0.08); },
    slash:   () => { noise(0.35, 0.3, 5000); tone(1200, 0.4, 'sawtooth', 0.08, 200); },
    thunder: () => { noise(1.4, 0.22, 420); tone(46, 1.6, 'sine', 0.18, 28); noise(0.25, 0.12, 5000, 0.05); },
    boom:    () => { tone(55, 1.2, 'sine', 0.4, 30); noise(1.0, 0.3, 250); },
  };
  function sfx(name) { if (vol.sfx > 0 && SFX[name]) SFX[name](); }

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

  return { ctx, sfx, music, muffle, setVolume, get current() { return cur; } };
})();
