// cutscene.js - the opening scene, told as a series of still shots, like
// panels in a graphic novel: your run-down flat, the phone call, the crowbar,
// the hidden stash, and out of the door into the rain.
//
// The whole flat is drawn in code (the middle of this file), with the man
// and everything else posed by a timeline: `stateAt(t)` says where
// everything is at moment t. Each SHOT freezes that timeline at one moment
// and points a camera at part of the room (a wide shot, or a close-up).
//
// The man is drawn as a simple jointed figure. You say where his hips,
// hands and feet are, and `limb()` works out where the elbows and knees go
// ("two-bone IK"), so poses are easy to write and blend.

import * as sfx from './audio.js';

const W = 480, H = 270;
const BAR = 22;               // black letterbox bars, top and bottom
const FLOOR = 228;            // where his feet touch the floor
const CUT = 0.07;             // a blink of black between shots

// body sizes in pixels
const B = { torso: 40, neck: 5, head: 8, upper: 20, fore: 19, thigh: 24, shin: 25 };

// ---- the shots ----
// at:      the moment of the timeline to freeze (seconds)
// x, y:    the point in the room the camera looks at
// zoom:    1 = the whole room, 4 = a tight close-up
// dur:     how long the shot stays on screen (seconds)
// who:     'you', 'voice' (on the phone) or '' (a caption); text: the words
// sfx:     sounds that play when the shot appears
// flash:   lightning;  shake: the camera jolts
const SHOTS = [
  { at: 2.5, x: 240, y: 135, zoom: 1, dur: 3.6, who: '', text: 'The old neighbourhood. 2 a.m.', sfx: [() => sfx.setRain(true, 0.035)] },
  { at: 3.5, x: 216, y: 190, zoom: 4.5, dur: 2.0, sfx: [sfx.phoneRing] },
  { at: 4.6, x: 188, y: 165, zoom: 2.6, dur: 1.8, sfx: [sfx.phoneRing] },
  { at: 7.6, x: 184, y: 150, zoom: 3.4, dur: 1.9, who: 'you', text: 'Yeah.', sfx: [sfx.phoneFlip] },
  { at: 10, x: 139, y: 105, zoom: 5, dur: 3.5, who: 'voice', text: "Been a long time. You remember me? 'Course you do.", sfx: [() => sfx.phoneVoice(3.2)] },
  { at: 13, x: 184, y: 150, zoom: 3.4, dur: 3.2, who: 'voice', text: "I've got your wife. She's right here with me.", sfx: [() => sfx.phoneVoice(2.8)] },
  { at: 17, x: 190, y: 165, zoom: 2, dur: 4.6, who: 'voice', text: "You're doing one last job for the Vipers. Say no, and she pays for it. Slowly.", sfx: [() => sfx.phoneVoice(4.3)] },
  { at: 22.5, x: 190, y: 150, zoom: 4.6, dur: 2.6, who: 'you', text: 'Listen to me very carefully.' },
  { at: 25, x: 196, y: 148, zoom: 3.6, dur: 3.9, who: 'you', text: "I'm going to find you. Then every last one of your Vipers." },
  { at: 27.7, x: 220, y: 150, zoom: 1.4, dur: 4.0, who: 'you', text: "And when I'm done, there won't be enough of you left to bury.", flash: true, sfx: [sfx.thunder] },
  { at: 32.7, x: 128, y: 188, zoom: 4, dur: 1.6, sfx: [sfx.phoneFlip] },
  { at: 36.4, x: 258, y: 170, zoom: 2.4, dur: 1.6, sfx: [sfx.clang] },
  { at: 39.6, x: 292, y: 156, zoom: 2.2, dur: 1.8, sfx: [sfx.creak] },
  { at: 40.35, x: 320, y: 172, zoom: 2, dur: 1.1, shake: true, sfx: [sfx.crack, () => setTimeout(sfx.crash, 350)] },
  { at: 42.2, x: 330, y: 165, zoom: 2.7, dur: 3.0 },
  { at: 44.2, x: 326, y: 156, zoom: 3.4, dur: 1.8, sfx: [sfx.click] },
  { at: 45.0, x: 312, y: 150, zoom: 3.4, dur: 2.0, sfx: [sfx.spin] },
  { at: 50.0, x: 410, y: 165, zoom: 2.2, dur: 2.8, sfx: [sfx.doorCreak, () => sfx.setRain(true, 0.13)] },
];

let lightning = -10;

// ---- small maths helpers ----
const clamp01 = (k) => (k < 0 ? 0 : k > 1 ? 1 : k);
const ease = (k) => { k = clamp01(k); return k * k * (3 - 2 * k); };
const ramp = (t, a, b) => ease((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const lerp2 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
function mix(p, q, k) {
  const o = {};
  for (const key in p) {
    const a = p[key], b = q[key];
    o[key] = Array.isArray(a) ? lerp2(a, b, k) : lerp(a, b, k);
  }
  return o;
}

// ---- poses (x = where his hips are across the room) ----
function sit(x) {
  return { x, y: 199, lean: 0.22, tilt: 0.35, hF: [x + 22, 196], hB: [x + 17, 197], fF: [x + 25, FLOOR], fB: [x + 19, FLOOR], ear: 0 };
}
function stand(x) {
  return { x, y: 179, lean: 0, tilt: 0.05, hF: [x + 5, 178], hB: [x - 2, 177], fF: [x + 4, FLOOR], fB: [x - 4, FLOOR], ear: 0 };
}
function walk(x) {
  const ph = x / 7, s = Math.sin(ph), c = Math.cos(ph);
  return {
    x, y: 179 - Math.abs(c) * 1.5, lean: 0.06, tilt: 0,
    hF: [x + 2 - s * 7, 178], hB: [x + 2 + s * 7, 177],
    fF: [x + s * 11, FLOOR - Math.max(0, c) * 6], fB: [x - s * 11, FLOOR - Math.max(0, -c) * 6], ear: 0,
  };
}

// ---- the timeline: where is everything at time t? ----
function stateAt(t) {
  const s = {
    phone: 'table', phonePos: null, phoneOpen: false, ringing: t > 3 && t < 6.2,
    bar: 'wall', barTip: null, barFall: 0, panelTilt: 0, panelFall: 0,
    gun: 'wall', gunAngle: 0.7, door: 0, alpha: 1,
    fade: 1 - ramp(t, 0, 1.5),
  };
  let p;
  if (t < 5.0) {                                   // sitting on the bed, head down
    p = sit(165);
    p.tilt = lerp(0.35, 0, ramp(t, 3.4, 4.2));     // looks up when the phone rings
  } else if (t < 6.2) {                            // reaches for the phone
    p = sit(165); p.tilt = 0;
    const k = ramp(t, 5, 6.1);
    p.lean = lerp(0.22, 0.34, k);
    p.hF = lerp2(p.hF, [216, 192], k);
  } else if (t < 31.2) {                           // on the phone
    p = sit(165); p.tilt = 0.05;
    p.hF = lerp2([216, 192], p.hF, ramp(t, 6.4, 7.2)); // passes the phone to his far hand
    p.ear = ramp(t, 6.2, 7.2);
    s.phone = 'hand'; s.phoneOpen = t > 6.6;
    const anger = ramp(t, 20.6, 22);               // leans in for his threat
    p.lean = lerp(0.22, 0.4, anger);
    p.tilt = lerp(0.05, -0.12, anger);
    p.hF = lerp2(p.hF, [p.x + 27, 185], anger);    // near fist clenched
  } else if (t < 32.6) {                           // snaps the phone shut and tosses it
    p = sit(165); p.tilt = 0.1;
    const down = ramp(t, 31.2, 31.8);
    p.ear = 1 - down;
    p.hF = lerp2([216, 192], [192, 184], down);
    if (t < 32.0) { s.phone = 'hand'; s.phoneOpen = t < 31.25; }
    else {
      const k = clamp01((t - 32.0) / 0.55);
      p.hF = lerp2([192, 184], [150, 192], ramp(t, 31.9, 32.3));
      s.phone = 'loose';
      s.phonePos = [lerp(160, 112, k), lerp(186, 195, k) - Math.sin(k * Math.PI) * 18];
    }
  } else if (t < 34.0) {                           // stands up
    p = mix(sit(165), stand(172), ramp(t, 32.6, 33.9));
  } else if (t < 35.8) {                           // walks to the crowbar
    p = walk(lerp(172, 250, (t - 34) / 1.8));
  } else if (t < 36.6) {                           // bends down and picks it up
    p = stand(250);
    const k = ramp(t, 35.8, 36.3) * (1 - ramp(t, 36.3, 36.6));
    p.lean = 0.45 * k; p.y = 179 + 9 * k; p.tilt = 0.3 * k;
    p.hF = lerp2(p.hF, [265, 186], ramp(t, 35.8, 36.3));
    if (t > 36.3) s.bar = 'hand';
  } else if (t < 37.4) {                           // steps up to the panel
    p = walk(lerp(250, 278, (t - 36.6) / 0.8));
    s.bar = 'hand';
  } else if (t < 40.0) {                           // jams it in and heaves
    p = stand(278);
    const jam = ramp(t, 37.4, 37.9);
    const heave = Math.max(ramp(t, 38.0, 38.8) * (1 - 0.6 * ramp(t, 38.8, 39.0)), ramp(t, 39.0, 39.9));
    p.hF = lerp2(lerp2(p.hF, [289, 168], jam), [273, 175], heave);
    p.hB = lerp2(lerp2(p.hB, [285, 170], jam), [270, 177], heave);
    p.lean = -0.18 * heave; p.tilt = 0.1;
    s.bar = 'pry'; s.barTip = [303, 165];
    s.panelTilt = 0.05 * ramp(t, 38.2, 38.8) + 0.07 * ramp(t, 39.0, 39.9);
  } else if (t < 42.7) {                           // the panel falls. He looks. Drops the bar.
    p = stand(278);
    p.hF = [279, 180]; p.tilt = lerp(0.1, -0.12, ramp(t, 40.2, 41));
    s.panelFall = ramp(t, 40.0, 40.7) + 0.0001;
    s.bar = t < 41.2 ? 'hand' : 'floor';
    s.barFall = clamp01((t - 41.2) / 0.35);
  } else if (t < 43.5) {                           // steps to the stash
    p = walk(lerp(278, 300, (t - 42.7) / 0.8));
  } else if (t < 44.3) {                           // reaches for the revolver
    p = stand(300);
    p.hF = lerp2(p.hF, [336, 157], ramp(t, 43.5, 44.2));
    p.tilt = -0.1;
  } else if (t < 46.2) {                           // looks at it, spins the cylinder, lowers it
    p = stand(300);
    s.gun = 'hand';
    const look = ramp(t, 44.3, 44.8), lower = ramp(t, 45.6, 46.1);
    p.hF = lerp2(lerp2([336, 157], [318, 163], look), [306, 180], lower);
    p.hB = lerp2(p.hB, [314, 166], look * (1 - lower));
    p.tilt = lerp(-0.1, 0.3, look) * (1 - lower);
    s.gunAngle = lerp(0, 0.9, lower);
  } else if (t < 48.6) {                           // walks to the door
    p = walk(lerp(300, 392, (t - 46.2) / 2.4));
    p.hF = [p.x + 6, 180];
    s.gun = 'hand'; s.gunAngle = 0.9;
  } else if (t < 49.6) {                           // opens it
    p = stand(392);
    p.hF = lerp2([398, 180], [404, 168], ramp(t, 48.6, 48.95));
    p.hB = [389, 178];
    s.gun = 'back';
    s.door = ramp(t, 48.9, 49.8);
  } else {                                         // and walks out into the rain
    p = walk(lerp(392, 480, (t - 49.6) / 2.4));
    s.gun = 'hand'; s.gunAngle = 0.9; p.hF = [p.x + 6, 180];
    s.door = 1;
    s.alpha = 1 - clamp01((p.x - 438) / 34);
  }
  if (t > 40.7) s.panelFall = Math.max(s.panelFall, 1);
  if (t > 41.6) { s.bar = 'floor'; s.barFall = 1; }
  if (t > 44.3 && s.gun === 'wall') s.gun = 'hand';
  if (t > 48.9) s.door = Math.max(s.door, ramp(t, 48.9, 49.8));
  s.fade = Math.max(s.fade, ramp(t, 50.8, 52.3));
  s.man = p;
  return s;
}

// ---- drawing helpers ----
const css = (v, a = 1) => `rgba(${v | 0},${v | 0},${v | 0},${a})`;
function poly(g, pts) {
  g.beginPath(); g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath(); g.fill();
}
function seg(g, x0, y0, x1, y1, w, v) {
  g.strokeStyle = css(v); g.lineWidth = w; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
}
// A two-part limb from (ax, ay) reaching for (tx, ty). bend = +1 or -1 picks
// which way the middle joint (elbow or knee) points.
function limb(g, ax, ay, tx, ty, l1, l2, bend, w1, w2, v1, v2) {
  let dx = tx - ax, dy = ty - ay, d = Math.hypot(dx, dy);
  const max = l1 + l2 - 0.01;
  if (d > max) { tx = ax + (dx / d) * max; ty = ay + (dy / d) * max; d = max; }
  d = Math.max(d, 0.001);
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const ang = Math.atan2(dy, dx) + Math.acos(Math.max(-1, Math.min(1, cosA))) * bend;
  const jx = ax + Math.cos(ang) * l1, jy = ay + Math.sin(ang) * l1;
  seg(g, ax, ay, jx, jy, w1, v1);
  seg(g, jx, jy, tx, ty, w2, v2);
  return [tx, ty];
}

// ---- the man ----
function drawMan(g, p, s) {
  g.save();
  g.globalAlpha = s.alpha;
  const hip = [p.x, p.y];
  const sh = [p.x + Math.sin(p.lean) * B.torso, p.y - Math.cos(p.lean) * B.torso];
  const neck = [sh[0] + Math.sin(p.lean) * B.neck, sh[1] - Math.cos(p.lean) * B.neck];
  const ht = p.lean + p.tilt;
  const head = [neck[0] + Math.sin(ht) * B.head, neck[1] - Math.cos(ht) * B.head];
  const ear = [head[0] - 2, head[1] + 3];          // his far ear: the phone is held in his far hand, so his face stays clear

  // back arm and back leg (further from you, so darker)
  const handB = lerp2(p.hB, ear, p.ear);
  const hb = limb(g, sh[0] - 2, sh[1] + 1, handB[0], handB[1], B.upper, B.fore, p.ear > 0.5 ? -1 : 1, 6, 5, 128, 128); // elbow back when the phone is at his ear
  if (s.phone === 'hand' && p.ear > 0.5) drawPhone(g, hb[0] - 2, hb[1] + 1, s.phoneOpen, -0.5);
  limb(g, hip[0] - 1, hip[1], p.fB[0], p.fB[1], B.thigh, B.shin, -1, 9, 8, 26, 26);
  g.fillStyle = css(10); g.fillRect(p.fB[0] - 3, p.fB[1] - 3, 10, 3.5);
  if (s.gun === 'back') drawGun(g, hb[0], hb[1], 0.9);
  // body: white vest, belt
  seg(g, hip[0], hip[1] - 3, sh[0], sh[1] + 2, 15, 200);
  seg(g, hip[0], hip[1], hip[0] + Math.sin(p.lean) * 5, hip[1] - Math.cos(p.lean) * 5, 15, 30);
  // front leg
  limb(g, hip[0], hip[1], p.fF[0], p.fF[1], B.thigh, B.shin, -1, 10, 9, 40, 40);
  g.fillStyle = css(12); g.fillRect(p.fF[0] - 3, p.fF[1] - 3, 11, 3.5);
  // neck and head
  seg(g, sh[0], sh[1], neck[0], neck[1], 6, 150);
  g.fillStyle = css(176); g.beginPath(); g.arc(head[0], head[1], B.head, 0, Math.PI * 2); g.fill();
  g.save(); g.translate(head[0], head[1]); g.rotate(ht);
  g.fillStyle = css(140); g.beginPath(); g.moveTo(0, 2); g.arc(0, 0, B.head, 0.05, Math.PI * 0.55); g.fill(); // stubbly jaw
  g.fillStyle = css(28); g.beginPath(); g.moveTo(1, -3); g.arc(0, -1, B.head + 0.5, Math.PI * 1.0, Math.PI * 1.72); g.fill(); // hair
  g.fillRect(-B.head - 0.5, -2, 4, 5);
  g.fillStyle = css(176); poly(g, [7, -2, 10, 2, 7, 3]);                     // nose
  g.fillStyle = css(15); g.fillRect(3.5, -2.2, 2, 1.4);                     // eye
  g.fillStyle = css(70); g.fillRect(2, -4, 5, 1);                           // brow
  g.restore();
  // front arm, and whatever he's holding
  const hand = p.hF;
  const hf = limb(g, sh[0] + 1, sh[1] + 1, hand[0], hand[1], B.upper, B.fore, 1, 7, 6, 182, 182);
  g.fillStyle = css(182); g.beginPath(); g.arc(hf[0], hf[1], 3, 0, Math.PI * 2); g.fill();
  if (s.phone === 'hand' && p.ear <= 0.5) drawPhone(g, hf[0], hf[1], s.phoneOpen, 0.4);
  if (s.bar === 'hand') drawBar(g, hf[0], hf[1], hf[0] + 10, hf[1] + 38);
  if (s.bar === 'pry') drawBar(g, hf[0] - 10, hf[1] + 3, s.barTip[0], s.barTip[1]);
  if (s.gun === 'hand') drawGun(g, hf[0], hf[1], s.gunAngle);
  g.restore();
}

function drawPhone(g, x, y, open, rot) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.fillStyle = css(30); g.fillRect(-2, -6, 5, 8);
  if (open) { g.fillRect(-2, -13, 5, 7); g.fillStyle = css(205); g.fillRect(-1, -12, 3, 3); }
  g.restore();
}
function drawBar(g, x0, y0, x1, y1) {
  seg(g, x0, y0, x1, y1, 2.6, 92);
  const a = Math.atan2(y1 - y0, x1 - x0);
  seg(g, x0, y0, x0 + Math.cos(a + 2.4) * 5, y0 + Math.sin(a + 2.4) * 5, 2.6, 92); // the hooked end
}
function drawGun(g, x, y, angle) {
  g.save(); g.translate(x, y); g.rotate(angle);
  g.fillStyle = css(60); g.fillRect(0, -3, 14, 3);          // barrel
  g.fillStyle = css(85); g.fillRect(1, -4, 6, 5);           // cylinder
  g.fillStyle = css(35); poly(g, [-1, -2, 3, -2, 1, 6, -4, 5]); // grip
  g.restore();
}

// ---- the room ----
function drawRoomBack(g) {
  // wall with old striped wallpaper, stains and peeling patches
  g.fillStyle = css(64); g.fillRect(0, BAR, W, FLOOR - BAR);
  g.fillStyle = css(72);
  for (let x = 0; x < W; x += 12) g.fillRect(x, BAR, 5, FLOOR - BAR);
  const blots = [[180, 60, 26], [330, 70, 18], [60, 175, 20], [440, 70, 14]];
  for (const [x, y, r] of blots) {
    const gr = g.createRadialGradient(x, y, 2, x, y, r);
    gr.addColorStop(0, css(35, 0.5)); gr.addColorStop(1, css(35, 0));
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.fillStyle = css(98); poly(g, [262, 40, 284, 44, 280, 70, 270, 62, 258, 66]);   // peeling paper
  g.fillStyle = css(98); poly(g, [338, 82, 356, 78, 352, 98, 340, 94]);
  g.fillStyle = css(40); g.fillRect(0, BAR, W, 4);                                  // ceiling edge
  // window: night outside, other buildings, a few lit windows
  g.fillStyle = css(95); g.fillRect(26, 52, 88, 102);
  g.fillStyle = css(24); g.fillRect(30, 56, 80, 94);
  g.fillStyle = css(12);
  g.fillRect(30, 96, 22, 54); g.fillRect(56, 84, 26, 66); g.fillRect(86, 104, 24, 46);
  g.fillStyle = css(130); g.fillRect(62, 92, 5, 6); g.fillRect(72, 110, 5, 6); g.fillRect(92, 112, 4, 5); g.fillRect(36, 104, 4, 5);
  g.fillStyle = css(95); g.fillRect(68, 56, 4, 94); g.fillRect(30, 101, 80, 4);       // window bars
  g.fillStyle = css(120); g.fillRect(22, 150, 96, 5);                                 // sill
  // wedding photo above the bed
  g.fillStyle = css(30); g.fillRect(124, 92, 30, 26);
  g.fillStyle = css(150); g.fillRect(127, 95, 24, 20);
  g.fillStyle = css(40); g.beginPath(); g.arc(134, 102, 3, 0, 7); g.fill(); g.fillRect(131, 105, 6, 10);
  g.fillStyle = css(225); g.beginPath(); g.arc(144, 102, 3, 0, 7); g.fill(); poly(g, [141, 105, 147, 105, 149, 115, 139, 115]);
  // wooden panels along the lower wall (the stash panel is drawn separately)
  g.fillStyle = css(54); g.fillRect(244, 110, 156, FLOOR - 110);
  g.fillStyle = css(40); g.fillRect(244, 108, 156, 4);
  for (const [x0, x1] of [[248, 294], [374, 396]]) {
    g.fillStyle = css(46); g.fillRect(x0, 116, x1 - x0, 104);
    g.fillStyle = css(60); g.fillRect(x0 + 3, 119, x1 - x0 - 6, 98);
  }
  // door frame
  g.fillStyle = css(32); g.fillRect(396, 96, 60, FLOOR - 96);
  // skirting board and floorboards
  g.fillStyle = css(44); g.fillRect(0, FLOOR - 6, W, 6);
  g.fillStyle = css(48); g.fillRect(0, FLOOR, W, H - BAR - FLOOR);
  g.fillStyle = css(34);
  for (let y = FLOOR + 5; y < H - BAR; y += 6) g.fillRect(0, y, W, 1);
  // the bed: headboard, frame, mattress, pillow, rumpled blanket
  g.fillStyle = css(36); g.fillRect(34, 150, 12, FLOOR - 150);
  g.fillStyle = css(30); g.fillRect(40, 207, 152, 8); g.fillRect(44, 215, 5, 13); g.fillRect(184, 215, 5, 13);
  g.fillStyle = css(150); g.fillRect(44, 196, 148, 12);
  g.fillStyle = css(176); poly(g, [48, 196, 54, 187, 78, 186, 82, 196]);
  g.fillStyle = css(112); poly(g, [92, 196, 104, 190, 130, 193, 150, 189, 178, 194, 190, 205, 90, 206]);
  // side table with a bottle and an ashtray
  g.fillStyle = css(58); g.fillRect(198, 196, 40, 5);
  g.fillStyle = css(40); g.fillRect(201, 201, 4, 27); g.fillRect(231, 201, 4, 27);
  g.fillStyle = css(28); g.fillRect(228, 180, 7, 16); g.fillRect(230, 175, 3, 6);
  g.fillStyle = css(70); g.fillRect(204, 193, 9, 3);
}

// the hidden stash behind the panel
function drawStash(g, s) {
  g.fillStyle = css(16); g.fillRect(298, 114, 72, 108);
  // wanted posters: him, years younger
  for (const [x, y] of [[303, 120], [337, 122]]) {
    g.fillStyle = css(185); g.fillRect(x, y, 27, 30);
    g.fillStyle = css(30); g.font = 'bold 4.5px Georgia'; g.textAlign = 'center'; g.fillText('WANTED', x + 13.5, y + 7); g.textAlign = 'left';
    g.beginPath(); g.arc(x + 13.5, y + 15, 4, 0, 7); g.fill(); g.fillRect(x + 8, y + 19, 11, 5);
    g.fillRect(x + 5, y + 26, 17, 1);
  }
  // pegs and the revolver
  g.fillStyle = css(90); g.fillRect(326, 159, 2, 4); g.fillRect(342, 159, 2, 4);
  if (s.gun === 'wall') drawGun(g, 328, 160, 0);
  // rail of suits
  g.fillStyle = css(70); g.fillRect(300, 170, 68, 2);
  for (const [x, v] of [[304, 34], [336, 52]]) {
    g.fillStyle = css(80); poly(g, [x + 14, 170, x + 10, 175, x + 18, 175]);       // hanger
    g.fillStyle = css(v); poly(g, [x + 2, 176, x + 26, 176, x + 28, 216, x, 216]); // jacket
    g.fillStyle = css(215); poly(g, [x + 10, 176, x + 18, 176, x + 14, 190]);      // shirt
    g.fillStyle = css(v + 25); poly(g, [x + 10, 176, x + 12, 176, x + 14, 196]); poly(g, [x + 18, 176, x + 16, 176, x + 14, 196]);
  }
}

function drawPanel(g, s) {
  const draw = () => {
    g.fillStyle = css(46); g.fillRect(298, 114, 72, 108);
    g.fillStyle = css(60); g.fillRect(302, 118, 64, 100);
    g.fillStyle = css(48); g.fillRect(306, 122, 56, 92);
  };
  if (s.panelFall >= 1) {                              // lying on the floor
    g.fillStyle = css(46); g.fillRect(290, FLOOR - 4, 82, 5);
    g.fillStyle = css(62); g.fillRect(290, FLOOR - 4, 82, 1.5);
    return;
  }
  g.save();
  if (s.panelFall > 0) {                               // tipping towards you
    const k = s.panelFall;
    g.translate(0, 222); g.scale(1, Math.max(0.05, 1 - k)); g.translate(0, -222);
  } else if (s.panelTilt > 0) {                        // prised away at one corner
    g.translate(370, 114); g.rotate(s.panelTilt); g.translate(-370, -114);
  }
  draw();
  if (s.panelTilt > 0.03) { g.strokeStyle = css(25); g.lineWidth = 1; g.beginPath(); g.moveTo(300, 140); g.lineTo(318, 150); g.lineTo(312, 164); g.stroke(); }
  g.restore();
}

function drawDoor(g, s, t) {
  const open = s.door;
  if (open > 0) {
    // the street outside: wet, foggy, a lamp, rain
    const w = 44 * open + 4;
    g.save(); g.beginPath(); g.rect(400, 100, w, FLOOR - 100); g.clip();
    const gr = g.createLinearGradient(0, 100, 0, FLOOR);
    gr.addColorStop(0, css(70)); gr.addColorStop(0.6, css(130)); gr.addColorStop(1, css(95));
    g.fillStyle = gr; g.fillRect(400, 100, 52, FLOOR - 100);
    g.fillStyle = css(40); g.fillRect(430, 110, 3, 118); g.fillRect(424, 108, 15, 4);
    g.fillStyle = css(240); g.fillRect(427, 112, 9, 5);
    g.strokeStyle = css(210, 0.5); g.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const x = 400 + ((i * 37 + t * 40) % 52), y = 100 + ((i * 53 + t * 380) % 128);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1.5, y + 8); g.stroke();
    }
    g.restore();
  }
  // the door itself, swinging open on its right-hand hinges
  const x0 = 400 + 44 * open;
  g.fillStyle = css(open > 0 ? 38 : 52); g.fillRect(x0, 100, 452 - x0, FLOOR - 100);
  if (open < 0.5) {
    g.fillStyle = css(44); g.fillRect(x0 + 6, 108, 40 * (1 - open * 2), 50); g.fillRect(x0 + 6, 166, 40 * (1 - open * 2), 54);
    g.fillStyle = css(150); g.beginPath(); g.arc(x0 + 6, 170, 2, 0, 7); g.fill();   // handle
    g.fillStyle = css(80); g.fillRect(x0 + 20, 120, 12, 2);                          // spyhole plate
  }
}

// rain running down the window
function drawWindowRain(g, t) {
  g.save(); g.beginPath(); g.rect(30, 56, 80, 94); g.clip();
  g.strokeStyle = css(150, 0.35); g.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    const x = 30 + ((i * 29) % 80), y = 56 + ((i * 47 + t * 300) % 110) - 10;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1, y + 7); g.stroke();
  }
  g.restore();
}

// one bare bulb on a cord, swaying a little; everything else falls into shadow
function drawLight(g, t, flash) {
  const sway = Math.sin(t * 0.9) * 0.08;
  const bx = 240 + Math.sin(sway) * 44, by = BAR + Math.cos(sway) * 44;
  seg(g, 240, BAR, bx, by, 1, 20);
  g.fillStyle = css(245); g.beginPath(); g.arc(bx, by + 3, 3.5, 0, 7); g.fill();
  const dark = g.createRadialGradient(bx, by + 40, 30, bx, by + 60, 300);
  dark.addColorStop(0, 'rgba(0,0,0,0)');
  dark.addColorStop(0.55, 'rgba(0,0,0,0.45)');
  dark.addColorStop(1, 'rgba(0,0,0,0.82)');
  g.fillStyle = dark; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(bx, by + 3, 1, bx, by + 3, 22);
  glow.addColorStop(0, 'rgba(255,255,255,0.5)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow; g.fillRect(bx - 22, by - 19, 44, 44);
  if (flash > 0) { g.fillStyle = `rgba(220,220,220,${flash * 0.55})`; g.fillRect(0, 0, W, H); }
}

// ---- the cutscene object the game uses ----
export class Cutscene {
  constructor(canvas, onEnd) {
    this.g = canvas.getContext('2d');
    this.onEnd = onEnd;
    this.shot = 0;            // which shot is showing
    this.shotT = 0;           // how long it has been showing
    this.done = true;
    this.subs = document.getElementById('subs');
    this.skipEl = document.getElementById('skip');
    this.lastLine = null;
  }

  start() {
    this.done = false;
    this.skipEl.hidden = false;
    this.show(0);
  }

  // put shot i on screen (also handy for testing: game.cutscene.show(5))
  show(i) {
    if (i >= SHOTS.length) { this.finish(); return; }
    this.shot = i;
    this.shotT = 0;
    for (const play of SHOTS[i].sfx || []) play();
  }

  update(dt) {
    if (this.done) return;
    this.shotT += dt;
    if (this.shotT >= SHOTS[this.shot].dur) this.show(this.shot + 1);
  }

  next() { if (!this.done) this.show(this.shot + 1); }   // click: next shot
  skip() { if (!this.done) this.finish(); }              // Space / Esc: skip the lot

  finish() {
    this.done = true;
    this.skipEl.hidden = true;
    this.showLine(null);
    sfx.setRain(false);
    this.onEnd();
  }

  showLine(shot) {
    const key = shot && shot.text ? shot : null;
    if (key === this.lastLine) return;
    this.lastLine = key;
    if (!key) { this.subs.hidden = true; return; }
    this.subs.hidden = false;
    this.subs.className = key.who || 'caption';
    const who = key.who === 'you' ? 'YOU' : key.who === 'voice' ? 'VOICE ON THE PHONE' : '';
    this.subs.innerHTML = (who ? `<b>${who}</b>` : '') + `<span>${key.text}</span>`;
  }

  draw() {
    const g = this.g;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    if (this.done) return;
    const shot = SHOTS[this.shot];
    if (this.shotT < CUT) { this.showLine(shot); return; }   // the blink between shots
    const t = shot.at, s = stateAt(t);
    lightning = shot.flash ? t - 0.05 : -10;
    // the camera: zoom in on (x, y), but never look outside the room
    const z = shot.zoom;
    const vw = W / z, vh = (H - BAR * 2) / z;
    const cx = Math.max(vw / 2, Math.min(W - vw / 2, shot.x));
    const cy = Math.max(BAR + vh / 2, Math.min(H - BAR - vh / 2, shot.y));
    g.save();
    g.translate(W / 2, H / 2);
    if (shot.shake && this.shotT < 0.5) g.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 3);
    g.scale(z, z);
    g.translate(-cx, -cy);
    drawRoomBack(g);
    drawWindowRain(g, t);
    drawStash(g, s);
    drawPanel(g, s);
    drawDoor(g, s, t);
    // things lying around: the phone (buzzing when it rings), the crowbar
    if (s.phone === 'table') {
      g.fillStyle = css(30); g.fillRect(214 + (s.ringing ? 1 : 0), 192, 9, 4);
      if (s.ringing) {        // little buzz marks
        g.fillStyle = css(150);
        g.fillRect(212, 190, 1, 2); g.fillRect(225, 190, 1, 2); g.fillRect(211, 193, 1, 2); g.fillRect(226, 193, 1, 2);
      }
    } else if (s.phone === 'loose') {
      g.fillStyle = css(30); g.fillRect(s.phonePos[0], s.phonePos[1], 9, 4);
    }
    if (t >= 32.6) { g.fillStyle = css(30); g.fillRect(112, 194, 9, 3); }
    if (s.bar === 'wall') drawBar(g, 268, 172, 260, FLOOR - 1);
    if (s.bar === 'floor') {
      const k = s.barFall;
      drawBar(g, lerp(279, 268, k), lerp(180, FLOOR - 2, k), lerp(289, 304, k), lerp(218, FLOOR - 1, k));
    }
    drawMan(g, s.man, s);
    if (s.door > 0) {          // light spilling in from the doorway
      g.fillStyle = `rgba(200,200,200,${0.12 * s.door})`;
      poly(g, [400, FLOOR, 400 + 48 * s.door, FLOOR, 400 + 48 * s.door - 70, H - BAR, 340, H - BAR]);
    }
    drawLight(g, t, shot.flash ? 0.55 : 0);
    g.restore();
    // dark edges round every shot, like an old film still
    const vig = g.createRadialGradient(W / 2, H / 2, 70, W / 2, H / 2, 290);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, `rgba(0,0,0,${0.35 + 0.08 * Math.min(4, z)})`);
    g.fillStyle = vig; g.fillRect(0, 0, W, H);
    // letterbox bars, and a fade at the very start and end
    g.fillStyle = '#000'; g.fillRect(0, 0, W, BAR); g.fillRect(0, H - BAR, W, BAR);
    let fade = 0;
    if (this.shot === 0) fade = 1 - Math.min(1, this.shotT / 1.2);
    if (this.shot === SHOTS.length - 1) fade = Math.max(0, (this.shotT - (shot.dur - 1)) / 1);
    if (fade > 0) { g.fillStyle = `rgba(0,0,0,${fade})`; g.fillRect(0, 0, W, H); }
    this.showLine(shot);
  }
}
