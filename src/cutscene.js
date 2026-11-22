// cutscene.js - the opening scene, seen from the side like a film:
// your run-down flat, the phone call, the crowbar, the hidden stash, and out
// the door into the rain.
//
// Everything is drawn with the canvas 2D commands onto the same 480 x 270
// screen the game uses. The scene is a timeline: `stateAt(t)` says where
// everything is at time t (in seconds), and EVENTS plays sounds on cue.
//
// The man is drawn as a simple jointed figure. You say where his hips,
// hands and feet are, and `limb()` works out where the elbows and knees go
// ("two-bone IK"), so poses are easy to write and blend.

import * as sfx from './audio.js';

const W = 480, H = 270;
const BAR = 22;               // black letterbox bars, top and bottom
const FLOOR = 228;            // where his feet touch the floor
const END = 52.6;             // the scene lasts this many seconds

// body sizes in pixels
const B = { torso: 40, neck: 5, head: 8, upper: 20, fore: 19, thigh: 24, shin: 25 };

// ---- the words ----
// who: 'you', 'voice' (on the phone) or '' (a caption)
const LINES = [
  { t: 0.6, end: 3.6, who: '', text: 'The old neighbourhood. 2 a.m.' },
  { t: 7.4, end: 8.9, who: 'you', text: 'Yeah.' },
  { t: 9.0, end: 12.5, who: 'voice', text: "Been a long time. You remember me? 'Course you do." },
  { t: 12.6, end: 15.7, who: 'voice', text: "I've got your wife. She's right here with me." },
  { t: 15.8, end: 20.4, who: 'voice', text: "You're doing one last job for the Vipers. Say no, and she pays for it. Slowly." },
  { t: 20.8, end: 23.1, who: 'you', text: 'Listen to me very carefully.' },
  { t: 23.2, end: 27.1, who: 'you', text: "I'm going to find you. Then every last one of your Vipers." },
  { t: 27.2, end: 31.0, who: 'you', text: "And when I'm done, there won't be enough of you left to bury." },
];

// ---- sounds on cue ----
const EVENTS = [
  [0, () => sfx.setRain(true, 0.035)],
  [2.0, () => flashAt(2.0)],
  [3.0, sfx.phoneRing], [4.2, sfx.phoneRing], [5.4, sfx.phoneRing],
  [6.6, sfx.phoneFlip],
  [9.0, () => sfx.phoneVoice(3.3)], [12.6, () => sfx.phoneVoice(2.9)], [15.8, () => sfx.phoneVoice(4.4)],
  [27.6, () => { flashAt(27.6); sfx.thunder(); }],
  [31.2, sfx.phoneFlip], [32.55, sfx.step],
  [34.4, sfx.step], [34.9, sfx.step], [35.4, sfx.step],
  [36.3, sfx.clang], [36.9, sfx.step], [37.3, sfx.step], [37.9, sfx.clang],
  [38.2, sfx.creak], [39.0, sfx.creak], [40.0, sfx.crack], [40.6, sfx.crash], [41.55, sfx.clang],
  [42.9, sfx.step], [43.3, sfx.step], [44.3, sfx.click], [44.9, sfx.spin],
  [46.5, sfx.step], [47.0, sfx.step], [47.5, sfx.step], [48.0, sfx.step], [48.5, sfx.step],
  [48.9, () => { sfx.doorCreak(); sfx.setRain(true, 0.13); }],
  [49.9, sfx.step], [50.4, sfx.step], [50.9, sfx.step],
];
let lightning = -10;
function flashAt(t) { lightning = t; }

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
    p = sit(165); p.tilt = 0.05; p.hF = [216, 192];
    p.ear = ramp(t, 6.2, 7.2);
    s.phone = 'hand'; s.phoneOpen = t > 6.6;
    const anger = ramp(t, 20.6, 22);               // leans in for his threat
    p.lean = lerp(0.22, 0.4, anger);
    p.tilt = lerp(0.05, -0.12, anger);
    p.hB = lerp2(p.hB, [p.x + 26, 186], anger);    // other fist clenched
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
  const ear = [head[0] - 5, head[1] + 4];          // phone goes to the back of his head, so you still see his face

  // back arm and back leg (further from you, so darker)
  const hb = limb(g, sh[0] - 2, sh[1] + 1, p.hB[0], p.hB[1], B.upper, B.fore, 1, 6, 5, 128, 128);
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
  const hand = lerp2(p.hF, ear, p.ear);
  const hf = limb(g, sh[0] + 1, sh[1] + 1, hand[0], hand[1], B.upper, B.fore, 1, 7, 6, 182, 182);
  g.fillStyle = css(182); g.beginPath(); g.arc(hf[0], hf[1], 3, 0, Math.PI * 2); g.fill();
  if (s.phone === 'hand') drawPhone(g, hf[0], hf[1], s.phoneOpen, p.ear > 0.5 ? -0.3 : 0.4);
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
    g.fillStyle = css(30); g.font = 'bold 5px Georgia'; g.fillText('WANTED', x + 4, y + 7);
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
    this.t = 0;
    this.next = 0;            // next event to play
    this.done = false;
    this.subs = document.getElementById('subs');
    this.skipEl = document.getElementById('skip');
    this.lastLine = null;
  }

  start() {
    this.t = 0; this.next = 0; this.done = false; lightning = -10;
    this.skipEl.hidden = false;
    this.showLine(null);
  }

  // jump to a moment (for testing): events before it are not played
  seek(t) {
    this.t = t;
    this.next = EVENTS.findIndex((e) => e[0] >= t);
    if (this.next < 0) this.next = EVENTS.length;
  }

  update(dt) {
    if (this.done) return;
    this.t += dt;
    while (this.next < EVENTS.length && EVENTS[this.next][0] <= this.t) EVENTS[this.next++][1]();
    if (this.t >= END) this.finish();
  }

  skip() { if (!this.done) this.finish(); }

  finish() {
    this.done = true;
    this.skipEl.hidden = true;
    this.showLine(null);
    sfx.setRain(false);
    this.onEnd();
  }

  showLine(line) {
    if (line === this.lastLine) return;
    this.lastLine = line;
    if (!line) { this.subs.hidden = true; return; }
    this.subs.hidden = false;
    this.subs.className = line.who || 'caption';
    const who = line.who === 'you' ? 'YOU' : line.who === 'voice' ? 'VOICE ON THE PHONE' : '';
    this.subs.innerHTML = (who ? `<b>${who}</b>` : '') + `<span>${line.text}</span>`;
  }

  draw() {
    const g = this.g, t = this.t, s = stateAt(t);
    g.save();
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    // a little shake as the panel crashes down
    const shake = t > 40.55 && t < 40.85 ? (Math.random() - 0.5) * 3 : 0;
    g.translate(shake, shake * 0.5);
    drawRoomBack(g);
    drawWindowRain(g, t);
    drawStash(g, s);
    drawPanel(g, s);
    drawDoor(g, s, t);
    // things lying around: phone on the table (buzzing when it rings) or on the bed, crowbar
    if (s.phone === 'table') {
      const buzz = s.ringing && (t * 20) % 2 < 1 ? 1 : 0;
      g.fillStyle = css(30); g.fillRect(214 + buzz, 192, 9, 4);
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
    // light: from the doorway once it's open, and the bulb
    if (s.door > 0) {
      g.fillStyle = `rgba(200,200,200,${0.12 * s.door})`;
      poly(g, [400, FLOOR, 400 + 48 * s.door, FLOOR, 400 + 48 * s.door - 70, H - BAR, 340, H - BAR]);
    }
    const flash = Math.max(0, 1 - (t - lightning) / 0.25) * (t - lightning < 0.12 || t - lightning > 0.18 ? 1 : 0.3);
    drawLight(g, t, flash);
    g.restore();
    // letterbox bars and fades
    g.fillStyle = '#000'; g.fillRect(0, 0, W, BAR); g.fillRect(0, H - BAR, W, BAR);
    if (s.fade > 0) { g.fillStyle = `rgba(0,0,0,${s.fade})`; g.fillRect(0, 0, W, H); }
    this.showLine(LINES.find((l) => t >= l.t && t < l.end) || null);
  }
}
