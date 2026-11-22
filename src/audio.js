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
export function setRain(on) {
  if (!ctx) return;
  if (on && !rain) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.4;
    const g = ctx.createGain(); g.gain.value = 0.09;
    src.connect(f).connect(g).connect(master);
    src.start();
    rain = src;
  } else if (!on && rain) {
    rain.stop(); rain = null;
  }
}
