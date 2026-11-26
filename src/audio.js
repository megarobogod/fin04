// audio.js - every sound is made in code with the Web Audio API.
// Gunshots are bursts of noise through a filter that closes quickly;
// thumps are low sine waves sliding down in pitch.

let ctx = null, master = null, noiseBuf = null, rain = null;

// Browsers only allow sound after a click, so this is called on the first click.
export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}

// A burst of filtered noise.
function burst({ vol, dur, f0, f1, type = 'lowpass', q = 0.7, delay = 0 }) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 1.5, dur + 0.05);
}

// A tone sliding from f0 to f1.
function tone({ vol, dur, f0, f1, type = 'sine', delay = 0 }) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

export function revolver() {
  burst({ vol: 1.1, dur: 0.3, f0: 6000, f1: 300 });
  burst({ vol: 0.45, dur: 1.1, f0: 1200, f1: 90, q: 0.4, delay: 0.02 });   // echo off the buildings
  tone({ vol: 0.9, dur: 0.2, f0: 150, f1: 38 });
}

export function enemyShot(dist, heavy) {
  const v = 0.85 / (1 + dist * 0.25);
  burst({ vol: v, dur: heavy ? 0.14 : 0.22, f0: (heavy ? 2600 : 3600) / (1 + dist * 0.08), f1: 220 });
  tone({ vol: v * 0.6, dur: 0.1, f0: 170, f1: 55 });
}

export function whiz() { burst({ vol: 0.22, dur: 0.16, f0: 3200, f1: 900, type: 'bandpass', q: 5 }); }
export function click() { burst({ vol: 0.35, dur: 0.03, f0: 7000, f1: 3500, type: 'highpass' }); }
export function cylinderOpen() { click(); burst({ vol: 0.25, dur: 0.06, f0: 3000, f1: 1500, type: 'bandpass', q: 3, delay: 0.05 }); }
export function insert() { burst({ vol: 0.3, dur: 0.04, f0: 4000, f1: 2500, type: 'bandpass', q: 4 }); }
export function cylinderClose() { burst({ vol: 0.45, dur: 0.05, f0: 5000, f1: 2000, type: 'bandpass', q: 3 }); }
export function hit() { burst({ vol: 0.5, dur: 0.12, f0: 900, f1: 200 }); }
export function hurt() { burst({ vol: 0.8, dur: 0.22, f0: 600, f1: 100 }); tone({ vol: 0.35, dur: 0.18, f0: 120, f1: 60, type: 'triangle' }); }
export function grunt() { tone({ vol: 0.18, dur: 0.16, f0: 150, f1: 95, type: 'sawtooth' }); }
export function fall() { tone({ vol: 0.5, dur: 0.3, f0: 90, f1: 40 }); burst({ vol: 0.3, dur: 0.25, f0: 500, f1: 80, delay: 0.05 }); }
export function pickup() { tone({ vol: 0.2, dur: 0.08, f0: 660, f1: 660, type: 'square' }); tone({ vol: 0.2, dur: 0.12, f0: 990, f1: 990, type: 'square', delay: 0.08 }); }
export function thunder() { burst({ vol: 0.9, dur: 3.2, f0: 380, f1: 40, q: 0.3, delay: 0.3 }); burst({ vol: 0.5, dur: 0.6, f0: 2000, f1: 200, delay: 0.25 }); }
export function ricochet() { tone({ vol: 0.08, dur: 0.25, f0: 2400, f1: 1200, type: 'triangle' }); }

// Rain: noise through a soft filter, looping quietly in the background.
// Call again with a different volume to make it louder or quieter.
let rainGain = null;
export function setRain(on, vol = 0.09) {
  if (!ctx) return;
  if (on && !rain) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.4;
    rainGain = ctx.createGain(); rainGain.gain.value = vol;
    src.connect(f).connect(rainGain).connect(master);
    src.start();
    rain = src;
  } else if (on && rain) {
    rainGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.3);
  } else if (!on && rain) {
    rain.stop(); rain = null;
  }
}

// ---- cutscene sounds ----
// An old phone ringing: a fast warble of two tones.
export function phoneRing() {
  for (let i = 0; i < 14; i++) {
    tone({ vol: 0.12, dur: 0.035, f0: i % 2 ? 1400 : 1100, f1: i % 2 ? 1400 : 1100, type: 'square', delay: i * 0.045 });
  }
}
export function phoneFlip() { burst({ vol: 0.4, dur: 0.035, f0: 5000, f1: 2500, type: 'bandpass', q: 3 }); }
// A muffled voice down the phone line: bursts of filtered noise, like words.
export function phoneVoice(seconds) {
  if (!ctx) return;
  let t = 0;
  while (t < seconds) {
    const word = 0.08 + Math.random() * 0.18;
    burst({ vol: 0.12 + Math.random() * 0.08, dur: word, f0: 700 + Math.random() * 500, f1: 400, type: 'bandpass', q: 6, delay: t });
    t += word + (Math.random() < 0.2 ? 0.25 : 0.04);
  }
}
export function step() { burst({ vol: 0.25, dur: 0.07, f0: 300, f1: 80 }); }
export function creak() { tone({ vol: 0.12, dur: 0.5, f0: 180, f1: 120, type: 'sawtooth' }); burst({ vol: 0.15, dur: 0.4, f0: 900, f1: 500, type: 'bandpass', q: 8 }); }
export function crack() { burst({ vol: 0.8, dur: 0.15, f0: 3000, f1: 400 }); tone({ vol: 0.4, dur: 0.12, f0: 220, f1: 80 }); }
export function crash() { burst({ vol: 0.7, dur: 0.5, f0: 1500, f1: 100 }); tone({ vol: 0.5, dur: 0.3, f0: 110, f1: 45 }); }
export function clang() {
  tone({ vol: 0.25, dur: 0.6, f0: 820, f1: 800, type: 'triangle' });
  tone({ vol: 0.18, dur: 0.5, f0: 1290, f1: 1270, type: 'triangle' });
  burst({ vol: 0.3, dur: 0.05, f0: 6000, f1: 3000, type: 'highpass' });
}
export function spin() { for (let i = 0; i < 9; i++) burst({ vol: 0.25, dur: 0.02, f0: 6000, f1: 4000, type: 'highpass', delay: i * 0.05 * (1 + i * 0.12) }); }
export function doorCreak() { tone({ vol: 0.1, dur: 1.0, f0: 260, f1: 150, type: 'sawtooth' }); burst({ vol: 0.12, dur: 0.9, f0: 1200, f1: 700, type: 'bandpass', q: 10 }); }

// ---- the shotgun, doors and stairs ----
export function shotgun() {
  burst({ vol: 1.3, dur: 0.45, f0: 3500, f1: 120, q: 0.5 });
  burst({ vol: 0.6, dur: 1.4, f0: 900, f1: 60, q: 0.4, delay: 0.03 });   // the boom rolling round the walls
  tone({ vol: 1.0, dur: 0.3, f0: 110, f1: 30 });
}
export function enemyShotgun(dist) {
  const v = 1.0 / (1 + dist * 0.25);
  burst({ vol: v, dur: 0.35, f0: 2400 / (1 + dist * 0.08), f1: 120, q: 0.5 });
  tone({ vol: v * 0.8, dur: 0.22, f0: 120, f1: 40 });
}
export function breakOpen() { burst({ vol: 0.5, dur: 0.06, f0: 2500, f1: 1200, type: 'bandpass', q: 3 }); click(); }
export function snapShut() { burst({ vol: 0.6, dur: 0.07, f0: 3000, f1: 900, type: 'bandpass', q: 2 }); tone({ vol: 0.2, dur: 0.08, f0: 300, f1: 150 }); }
export function door() { burst({ vol: 0.18, dur: 0.45, f0: 700, f1: 300, type: 'bandpass', q: 3 }); tone({ vol: 0.05, dur: 0.4, f0: 220, f1: 180, type: 'sawtooth' }); }
export function stairs() { for (let i = 0; i < 5; i++) burst({ vol: 0.28, dur: 0.08, f0: 320, f1: 90, delay: i * 0.22 }); }

// A low, cold hit under a title card.
export function sting() {
  tone({ vol: 0.6, dur: 3.0, f0: 55, f1: 41 });
  burst({ vol: 0.35, dur: 2.5, f0: 300, f1: 40, q: 0.3 });
}

// ---- fast-paced extras ----
export function dash() { burst({ vol: 0.35, dur: 0.22, f0: 1800, f1: 400, type: 'bandpass', q: 1.5 }); }
export function swish() { burst({ vol: 0.25, dur: 0.14, f0: 2500, f1: 700, type: 'bandpass', q: 2 }); }
export function kickHit() { tone({ vol: 0.8, dur: 0.16, f0: 160, f1: 50 }); burst({ vol: 0.6, dur: 0.12, f0: 1200, f1: 200 }); }
export function gib() { burst({ vol: 0.8, dur: 0.35, f0: 900, f1: 120, q: 0.6 }); burst({ vol: 0.4, dur: 0.5, f0: 2200, f1: 300, delay: 0.05 }); }
export function heal() { tone({ vol: 0.06, dur: 0.12, f0: 330, f1: 440, type: 'triangle' }); }

// ---- the soundtrack ----
// A driving loop made of oscillators and noise, scheduled a moment ahead so it
// keeps perfect time. `setIntensity` (0..1) brings in more layers as the fight heats up.
const BPM = 150, STEP = 60 / BPM / 4;        // one step = a 16th note
const ROOT = 41.2;                           // E1, the bottom note
// the bass line, as semitones above E, over 4 bars of 16 steps (null = rest)
const BASS = [
  [0, null, 0, 0, 3, null, 0, null, 6, null, 5, null, 3, null, 2, null],
  [0, null, 0, 0, 3, null, 0, null, 7, null, 6, null, 5, null, 3, null],
  [5, null, 5, 5, 8, null, 5, null, 10, null, 8, null, 7, null, 5, null],
  [0, null, 0, 0, 3, null, 0, 12, 11, null, 10, null, 7, null, 6, 3],
];
const LEAD = [12, 15, 19, 17, 15, 14, 12, 10];   // a cold stab of a melody on top, when it gets intense
let music = null, muted = false;

function oscAt(t, type, f0, f1, dur, vol, dest, cutoff) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  let node = o;
  if (cutoff) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 6; o.connect(f); node = f; }
  node.connect(g).connect(dest);
  o.start(t); o.stop(t + dur + 0.05);
}
function noiseAt(t, dur, type, freq, q, vol, dest) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t, Math.random() * 1.5, dur + 0.05);
}

function playStep(step, t) {
  const m = music, out = m.gain, i = m.intensity;
  const bar = Math.floor(step / 16) % 4, s = step % 16;
  // drums: four on the floor, snare on 2 and 4, hats when it gets going
  if (s % 4 === 0) oscAt(t, 'sine', 150, 42, 0.28, 0.9, out);
  if (i > 0.65 && s === 10) oscAt(t, 'sine', 150, 42, 0.2, 0.6, out);
  if (s === 4 || s === 12) { noiseAt(t, 0.18, 'bandpass', 1900, 0.8, 0.45, out); oscAt(t, 'triangle', 200, 120, 0.1, 0.3, out); }
  if (i > 0.3 && s % 2 === 1) noiseAt(t, 0.035, 'highpass', 7500, 0.7, 0.14, out);
  if (i > 0.5 && s === 14) noiseAt(t, 0.16, 'highpass', 6500, 0.7, 0.12, out);
  // bass
  const n = BASS[bar][s];
  if (n !== null) oscAt(t, 'sawtooth', ROOT * Math.pow(2, n / 12), ROOT * Math.pow(2, n / 12), STEP * 1.8, 0.32, out, 260 + i * 900);
  // lead stabs on top
  if (i > 0.72 && s % 4 === 2) {
    const note = LEAD[(bar * 4 + s / 4 | 0) % LEAD.length];
    oscAt(t, 'square', ROOT * 4 * Math.pow(2, note / 12), ROOT * 4 * Math.pow(2, note / 12), 0.12, 0.07, out, 2200);
  }
}

function schedule() {
  if (!music) return;
  while (music.next < ctx.currentTime + 0.12) {
    playStep(music.step, music.next);
    music.step++;
    music.next += STEP;
  }
}

export function startMusic() {
  if (!ctx || music) return;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.gain.setTargetAtTime(muted ? 0 : 0.3, ctx.currentTime, 0.3);
  gain.connect(master);
  music = { gain, step: 0, next: ctx.currentTime + 0.08, intensity: 0.35, timer: setInterval(schedule, 25) };
}
export function stopMusic() {
  if (!music) return;
  const m = music;
  music = null;
  clearInterval(m.timer);
  m.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
  setTimeout(() => m.gain.disconnect(), 1000);
}
export function setIntensity(v) { if (music) music.intensity = Math.max(0, Math.min(1, v)); }
export function toggleMute() {
  muted = !muted;
  if (music) music.gain.gain.setTargetAtTime(muted ? 0 : 0.3, ctx.currentTime, 0.1);
  return muted;
}
