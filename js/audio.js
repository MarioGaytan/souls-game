'use strict';
// =====================================================================
//  AUDIO — todo sintetizado con WebAudio (sin archivos). Efectos y
//  música ambiental por región; música de jefe con percusión.
// =====================================================================

const AUD = { ctx: null, master: null, sfxG: null, musG: null, noiseBuf: null, track: -1, boss: false, nextT: 0, step: 0, last: {} };

function audioInit() {
  if (AUD.ctx) { if (AUD.ctx.state === 'suspended') AUD.ctx.resume(); return; }
  try {
    const C = window.AudioContext || window.webkitAudioContext;
    const ac = new C(); AUD.ctx = ac;
    AUD.master = ac.createGain(); AUD.master.gain.value = 0.7; AUD.master.connect(ac.destination);
    AUD.sfxG = ac.createGain(); AUD.sfxG.gain.value = 0.55; AUD.sfxG.connect(AUD.master);
    AUD.musG = ac.createGain(); AUD.musG.gain.value = 0.0; AUD.musG.connect(AUD.master);
    const len = ac.sampleRate;
    const b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    AUD.noiseBuf = b;
    AUD.nextT = ac.currentTime + 0.1;
  } catch (e) { AUD.ctx = null; }
}

function tone(f, dur, type, vol, slide, when, dest) {
  const ac = AUD.ctx; if (!ac) return;
  const t = when || ac.currentTime;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || AUD.sfxG);
  o.start(t); o.stop(t + dur + 0.05);
}

function noise(dur, vol, freq, ftype, slideTo, when, dest) {
  const ac = AUD.ctx; if (!ac) return;
  const t = when || ac.currentTime;
  const s = ac.createBufferSource(); s.buffer = AUD.noiseBuf;
  const f = ac.createBiquadFilter(); f.type = ftype || 'lowpass'; f.frequency.setValueAtTime(freq || 1200, t);
  if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(vol || 0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest || AUD.sfxG);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

const SFX = {
  swing: () => noise(0.13, 0.22, 2400, 'bandpass', 700),
  heavy: () => { noise(0.25, 0.3, 1400, 'bandpass', 300); tone(120, 0.2, 'sawtooth', 0.08, 60); },
  hit: () => { noise(0.08, 0.35, 3000, 'highpass'); tone(180, 0.09, 'square', 0.12, 90); },
  hitBig: () => { noise(0.18, 0.45, 900, 'lowpass', 200); tone(90, 0.2, 'square', 0.15, 45); },
  hurt: () => { tone(320, 0.18, 'sawtooth', 0.18, 110); noise(0.15, 0.25, 800); },
  roll: () => noise(0.22, 0.18, 600, 'lowpass', 150),
  drink: () => { tone(500, 0.12, 'sine', 0.12, 700); tone(700, 0.18, 'sine', 0.1, 1000, AUD.ctx.currentTime + 0.12); },
  heal: () => { [523, 659, 784].forEach((f, i) => tone(f, 0.3, 'triangle', 0.1, 0, AUD.ctx.currentTime + i * 0.06)); },
  pick: () => { tone(880, 0.08, 'square', 0.08); tone(1320, 0.12, 'square', 0.07, 0, AUD.ctx.currentTime + 0.07); },
  souls: () => { tone(660, 0.25, 'sine', 0.1, 1320); },
  bonfire: () => { noise(1.2, 0.3, 500, 'lowpass', 2500); [220, 330, 440, 660].forEach((f, i) => tone(f, 1.2, 'triangle', 0.07, 0, AUD.ctx.currentTime + i * 0.12)); },
  roar: () => { tone(90, 0.9, 'sawtooth', 0.25, 45); noise(0.9, 0.3, 500, 'lowpass', 100); },
  boom: () => { noise(0.5, 0.5, 700, 'lowpass', 60); tone(70, 0.4, 'sine', 0.3, 30); },
  zap: () => tone(900, 0.15, 'sawtooth', 0.06, 300),
  shoot: () => tone(520, 0.12, 'square', 0.05, 260),
  die: () => { tone(220, 1.6, 'sawtooth', 0.15, 40); noise(1.4, 0.2, 400, 'lowpass', 60); },
  lvl: () => { [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, 'triangle', 0.1, 0, AUD.ctx.currentTime + i * 0.07)); },
  door: () => { noise(0.8, 0.35, 300, 'lowpass', 80); tone(60, 0.6, 'square', 0.1, 40); },
  victory: () => { [262, 330, 392, 523, 659, 784].forEach((f, i) => tone(f, 1.4, 'triangle', 0.09, 0, AUD.ctx.currentTime + i * 0.15)); },
  wall: () => { noise(0.5, 0.35, 900, 'lowpass', 100); tone(140, 0.3, 'square', 0.08, 60); },
  menu: () => tone(660, 0.05, 'square', 0.05),
  deny: () => tone(150, 0.15, 'square', 0.08, 100),
  windup: () => tone(200, 0.25, 'sawtooth', 0.04, 420),
  step: () => noise(0.04, 0.05, 500, 'lowpass'),
};

function sfx(name) {
  if (!AUD.ctx || typeof SAVE === 'undefined' || !SAVE.settings.sfx) return;
  const now = performance.now();
  if (AUD.last[name] && now - AUD.last[name] < 35) return;
  AUD.last[name] = now;
  try { SFX[name] && SFX[name](); } catch (e) { /* nada */ }
}

// ---------------------------------------------------------------- música
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const TRACKS = [
  { root: 45, scale: [0, 3, 5, 7, 10], bpm: 66, bell: 0.5, prog: [0, 5, 3, 7] },     // santuario
  { root: 50, scale: [0, 2, 3, 5, 7, 8, 10], bpm: 74, bell: 0.4, prog: [0, 8, 5, 7] }, // bosque
  { root: 40, scale: [0, 1, 3, 7, 8], bpm: 56, bell: 0.6, prog: [0, 1, 0, 8] },       // grutas
  { root: 48, scale: [0, 3, 5, 6, 7, 10], bpm: 62, bell: 0.3, prog: [0, 3, 6, 5] },    // ciénaga
  { root: 42, scale: [0, 2, 3, 7, 8], bpm: 58, bell: 0.55, prog: [0, 8, 3, 7] },       // catacumbas
  { root: 45, scale: [0, 1, 4, 5, 7, 8], bpm: 70, bell: 0.25, prog: [0, 1, 5, 4] },    // forja
  { root: 50, scale: [0, 2, 3, 5, 7, 8, 11], bpm: 64, bell: 0.45, prog: [0, 8, 7, 11] }, // ciudadela
];
const BOSS_TRACK = { root: 40, scale: [0, 1, 3, 5, 7, 8, 10], bpm: 150, prog: [0, 0, 8, 7] };

function setMusic(track, boss) {
  if (AUD.track === track && AUD.boss === !!boss) return;
  AUD.track = track; AUD.boss = !!boss; AUD.step = 0;
  if (!AUD.ctx) return;
  const g = AUD.musG.gain, t = AUD.ctx.currentTime;
  g.cancelScheduledValues(t); g.setValueAtTime(0.0, t);
  g.linearRampToValueAtTime(SAVE.settings.music && track >= 0 ? (boss ? 0.32 : 0.24) : 0, t + 1.5);
  AUD.nextT = t + 0.05;
}

function pad(freqs, dur, when) {
  const ac = AUD.ctx;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(0.09, when + dur * 0.3); g.gain.linearRampToValueAtTime(0.0001, when + dur);
  f.connect(g); g.connect(AUD.musG);
  for (const fr of freqs) for (const det of [-6, 6]) {
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = det;
    o.connect(f); o.start(when); o.stop(when + dur + 0.1);
  }
}

function musicUpdate() {
  const ac = AUD.ctx;
  if (!ac || AUD.track < 0 || !SAVE.settings.music) return;
  const tr = AUD.boss ? BOSS_TRACK : TRACKS[AUD.track];
  const stepDur = 60 / tr.bpm / 2;
  if (AUD.nextT < ac.currentTime - 1) AUD.nextT = ac.currentTime + 0.05;
  while (AUD.nextT < ac.currentTime + 0.3) {
    const s = AUD.step, t = AUD.nextT;
    const bar = Math.floor(s / 16) % tr.prog.length, chord = tr.root + tr.prog[bar];
    if (AUD.boss) {
      const k = s % 16;
      if (k % 4 === 0) { tone(110, 0.22, 'sine', 0.35, 40, t, AUD.musG); }
      if (k === 4 || k === 12) noise(0.12, 0.25, 2500, 'highpass', 0, t, AUD.musG);
      if (k % 2 === 0) noise(0.03, 0.06, 7000, 'highpass', 0, t, AUD.musG);
      tone(NOTE(chord - 12 + (k % 8 === 6 ? 12 : 0)), stepDur * 0.9, 'sawtooth', 0.07, 0, t, AUD.musG);
      if (k % 2 === 1) {
        const n = tr.scale[(s * 3 + bar) % tr.scale.length];
        tone(NOTE(chord + 12 + n), stepDur * 1.6, 'square', 0.035, 0, t, AUD.musG);
      }
      if (k === 0) pad([NOTE(chord), NOTE(chord + 7)], stepDur * 16, t);
    } else {
      if (s % 16 === 0) pad([NOTE(chord - 12), NOTE(chord - 5), NOTE(chord + 3)], stepDur * 16, t);
      const r = Math.abs(Math.sin(s * 12.9898 + AUD.track * 78.233) * 43758.5453) % 1;
      if (r < tr.bell * 0.45) {
        const n = tr.scale[Math.floor(r * 97) % tr.scale.length];
        tone(NOTE(chord + 12 + n + (r < 0.08 ? 12 : 0)), stepDur * 5, 'triangle', 0.05, 0, t, AUD.musG);
      }
    }
    AUD.nextT += stepDur; AUD.step++;
  }
}
