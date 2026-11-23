// cutscene.js - the opening scene, told as inked comic panels.
//
// Each PANEL is a still picture drawn in code in a stark ink style: solid
// black shadows, harsh white light, rough hand-drawn edges, and red used
// for drama. A panel holds on screen for a few seconds with a slow push-in,
// shows its lines of dialogue and plays its sounds, then cuts to the next.
//
// It draws on its own 1280 x 720 canvas (#cine) so the ink lines stay sharp.
// Click / Enter = next panel, Space / Esc = skip the whole scene.

import * as sfx from './audio.js';

const W = 1280, H = 720;
const CUT = 0.08;              // a blink of black between panels
const PUSH = 0.05;             // how much each panel slowly zooms in

// ---- colours: ink, paper, two greys, and red ----
const INK = '#0b0b0b', PAPER = '#e6e3dc', LIGHT = '#a3a19c';
const RED = '#b3120f', DARKRED = '#5e0605';

// ---- the panels ----
// dur:   seconds on screen
// lines: [seconds into the panel, who ('you', 'voice' or '' for a caption), words]
// sfx:   [seconds into the panel, sound]
// draw:  the function below that paints it
const PANELS = [
  { draw: city, dur: 4.2, lines: [[0.4, '', 'The old neighbourhood. 2 a.m.']],
    sfx: [[0, () => sfx.setRain(true, 0.05)]] },
  { draw: phone, dur: 2.8, sfx: [[0, sfx.phoneRing], [1.3, sfx.phoneRing]] },
  { draw: silhouette, dur: 7.4,
    lines: [[0.3, 'you', 'Yeah.'], [1.9, 'voice', "Been a long time. You remember me? 'Course you do."]],
    sfx: [[0, sfx.phoneFlip], [1.9, () => sfx.phoneVoice(3.2)]] },
  { draw: photo, dur: 3.8, lines: [[0.2, 'voice', "I've got your wife. She's right here with me."]],
    sfx: [[0.2, () => sfx.phoneVoice(2.8)]] },
  { draw: eyes, dur: 5.2, lines: [[0.2, 'voice', "You're doing one last job for the Vipers. Say no, and she pays for it. Slowly."]],
    sfx: [[0.2, () => sfx.phoneVoice(4.3)]] },
  { draw: profile, dur: 7.0,
    lines: [[0.2, 'you', 'Listen to me very carefully.'], [2.9, 'you', "I'm going to find you. Then every last one of your Vipers."]] },
  { draw: lightning, dur: 4.4, lines: [[0.2, 'you', "And when I'm done, there won't be enough of you left to bury."]],
    sfx: [[0, sfx.thunder], [3.9, sfx.phoneFlip]] },
  { draw: crowbar, dur: 2.6, shake: 1.15, sfx: [[0.1, sfx.creak], [1.1, sfx.crack], [1.5, sfx.crash]] },
  { draw: stash, dur: 3.6, sfx: [[0.9, sfx.clang]] },
  { draw: revolver, dur: 2.8, sfx: [[0.2, sfx.click], [0.8, sfx.spin]] },
  { draw: doorway, dur: 4.4, fadeOut: 1.4,
    sfx: [[0, sfx.doorCreak], [0.1, () => sfx.setRain(true, 0.14)], [1.2, sfx.step], [1.7, sfx.step], [2.2, sfx.step], [2.7, sfx.step]] },
];

// =========================================================================
// The inking kit
// =========================================================================

// A seeded random number generator, reset for every panel, so the rough
// "hand-drawn" wobble is the same every frame and doesn't jitter.
let seed = 1;
function rnd() {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Take a shape given as [x, y, x, y, ...] and wobble its edges a little,
// like it was inked by hand.
function rough(pts, amp = 3, step = 36) {
  const out = [], n = pts.length / 2;
  for (let i = 0; i < n; i++) {
    const ax = pts[i * 2], ay = pts[i * 2 + 1];
    const bx = pts[((i + 1) % n) * 2], by = pts[((i + 1) % n) * 2 + 1];
    const parts = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / step));
    for (let j = 0; j < parts; j++) {
      const k = j / parts, wob = j === 0 ? 0.3 : 1;
      out.push(ax + (bx - ax) * k + (rnd() - 0.5) * amp * wob, ay + (by - ay) * k + (rnd() - 0.5) * amp * wob);
    }
  }
  return out;
}

function path(g, pts) {
  g.beginPath(); g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
}
// fill a rough shape
function ink(g, pts, color = INK, amp = 3) { path(g, rough(pts, amp)); g.fillStyle = color; g.fill(); }
// fill an exact shape (no wobble)
function flat(g, pts, color) { path(g, pts); g.fillStyle = color; g.fill(); }
// a rough oval
function blob(g, x, y, rx, ry, color = INK, amp = 3, rot = 0) {
  const pts = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const cx = Math.cos(a) * rx, cy = Math.sin(a) * ry;
    pts.push(x + cx * Math.cos(rot) - cy * Math.sin(rot), y + cx * Math.sin(rot) + cy * Math.cos(rot));
  }
  ink(g, pts, color, amp);
}
// a brush stroke along a line of points, thick in the middle and thin at the ends
function brush(g, pts, width, color = INK) {
  g.strokeStyle = color; g.lineCap = 'round'; g.lineJoin = 'round';
  const n = pts.length / 2;
  for (let i = 0; i < n - 1; i++) {
    const k = (i + 0.5) / (n - 1);
    g.lineWidth = Math.max(0.6, width * Math.sin(Math.PI * Math.min(0.98, Math.max(0.02, k))));
    g.beginPath(); g.moveTo(pts[i * 2], pts[i * 2 + 1]); g.lineTo(pts[i * 2 + 2], pts[i * 2 + 3]); g.stroke();
  }
}
function line(g, x0, y0, x1, y1, width, color = INK) {
  brush(g, [x0, y0, (x0 + x1) / 2 + (rnd() - 0.5) * 2, (y0 + y1) / 2 + (rnd() - 0.5) * 2, x1, y1], width, color);
}
// parallel shading lines inside a shape
function hatch(g, clipPts, gap, angle, width = 1.5, color = INK) {
  g.save(); path(g, clipPts); g.clip();
  g.strokeStyle = color; g.lineWidth = width;
  const dx = Math.cos(angle), dy = Math.sin(angle);
  for (let d = -1600; d < 1600; d += gap) {
    const ox = 640 - dy * d, oy = 360 + dx * d;
    g.beginPath(); g.moveTo(ox - dx * 1600, oy - dy * 1600); g.lineTo(ox + dx * 1600, oy + dy * 1600); g.stroke();
  }
  g.restore();
}
// rain: thin slanted slashes
function rain(g, n, color, alpha = 0.55, x0 = 0, y0 = 0, x1 = W, y1 = H) {
  g.save(); g.globalAlpha = alpha; g.strokeStyle = color; g.lineWidth = 1.6;
  for (let i = 0; i < n; i++) {
    const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0), len = 18 + rnd() * 40;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - len * 0.18, y + len); g.stroke();
  }
  g.restore();
}
// rays bursting out from a point (comic "action" background)
function burst(g, x, y, rays, c1, c2) {
  g.fillStyle = c1; g.fillRect(0, 0, W, H);
  for (let i = 0; i < rays; i++) {
    const a0 = (i / rays) * Math.PI * 2, a1 = a0 + (Math.PI / rays) * (0.5 + rnd() * 0.6);
    flat(g, [x, y, x + Math.cos(a0) * 2000, y + Math.sin(a0) * 2000, x + Math.cos(a1) * 2000, y + Math.sin(a1) * 2000], c2);
  }
}
// comic lettering, e.g. a sound effect
function letters(g, text, x, y, size, rot, fill, outline = INK, shadow = null) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.font = `900 ${size}px Impact, 'Arial Black', sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  if (shadow) { g.fillStyle = shadow; g.fillText(text, size * 0.06, size * 0.06); }
  g.lineWidth = size * 0.12; g.strokeStyle = outline; g.strokeText(text, 0, 0);
  g.fillStyle = fill; g.fillText(text, 0, 0);
  g.restore();
}
// stubble or texture dots
function dots(g, x0, y0, x1, y1, n, r, color = INK) {
  g.fillStyle = color;
  for (let i = 0; i < n; i++) { g.beginPath(); g.arc(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), r * (0.5 + rnd()), 0, 7); g.fill(); }
}

// =========================================================================
// The panels
// =========================================================================

// 1. The city at night, rain, one lit window with a man sitting in it.
function city(g) {
  g.fillStyle = '#262626'; g.fillRect(0, 0, W, H);
  blob(g, 1010, 150, 70, 70, PAPER, 2);                                    // moon
  hatch(g, rough([1010, 80, 1075, 120, 1075, 180, 1010, 220]), 9, -0.5, 1.4, LIGHT);
  // far buildings in grey, near ones in black
  for (let i = 0; i < 9; i++) {
    const x = i * 150 - 20, top = 260 + rnd() * 140;
    ink(g, [x, H, x, top, x + 140, top, x + 140, H], '#3e3e3e', 4);
  }
  ink(g, [0, H, 0, 300, 150, 300, 150, 250, 330, 250, 330, H], INK, 5);
  ink(g, [820, H, 820, 340, 900, 340, 900, 290, 1280, 290, 1280, H], INK, 5);
  // the man's building, front and centre
  ink(g, [380, H, 380, 150, 760, 150, 760, H], INK, 4);
  ink(g, [395, 150, 395, 120, 470, 120, 470, 150], INK, 2);                // water tank
  line(g, 432, 120, 432, 70, 4);
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 4; c++) {
      const x = 410 + c * 88, y = 190 + r * 85;
      const lit = r === 2 && c === 2;
      ink(g, [x, y, x + 52, y, x + 52, y + 56, x, y + 56], lit ? PAPER : '#202020', 2);
      if (lit) {                                                            // him, sitting in the window
        blob(g, x + 24, y + 26, 7, 8);
        ink(g, [x + 12, y + 56, x + 14, y + 38, x + 34, y + 36, x + 40, y + 56]);
      }
    }
  }
  // fire escape
  for (let y = 230; y < 700; y += 85) { line(g, 740, y, 820, y, 4, '#4a4a4a'); line(g, 745, y, 815, y + 85, 3, '#4a4a4a'); }
  // red neon sign down the side of the building
  g.save(); g.shadowColor = RED; g.shadowBlur = 30;
  ink(g, [330, 180, 372, 180, 372, 470, 330, 470], DARKRED, 2);
  g.font = "900 42px Impact, 'Arial Black', sans-serif"; g.textAlign = 'center'; g.fillStyle = '#ff2a22';
  'ROOMS'.split('').forEach((ch, i) => g.fillText(ch, 351, 228 + i * 54));
  g.restore();
  rain(g, 260, PAPER, 0.45);
}

// 2. Close-up: the flip phone buzzing on the bedside table.
function phone(g) {
  g.fillStyle = INK; g.fillRect(0, 0, W, H);
  ink(g, [0, 430, W, 380, W, H, 0, H], '#8a8781', 6);                     // table top
  for (let i = 0; i < 9; i++) brush(g, [0, 470 + i * 30, 400, 455 + i * 29 + rnd() * 10, 900, 440 + i * 29, W, 420 + i * 28], 2.5, '#5c5a56');
  // bottle and ashtray, dark against the wall
  ink(g, [150, 420, 150, 230, 175, 190, 175, 120, 205, 120, 205, 190, 230, 230, 230, 420]);
  line(g, 172, 240, 172, 400, 6, '#3a3a3a');
  blob(g, 1080, 440, 120, 30, '#2c2c2c', 4);
  blob(g, 1080, 432, 90, 18, '#55534f', 3);
  ink(g, [1040, 428, 1140, 420, 1142, 430, 1042, 438], PAPER, 1);          // cigarette
  brush(g, [1140, 420, 1160, 360, 1130, 300, 1170, 230, 1140, 160], 5, 'rgba(230,227,220,0.5)');
  // the phone, lying at an angle, with its little screen lit
  g.save(); g.translate(640, 470); g.rotate(-0.18);
  ink(g, [-230, -70, 230, -70, 240, 60, -240, 60], INK, 4);
  ink(g, [-225, -66, 228, -66, 228, -54, -225, -54], '#4a4a4a', 2);        // edge highlight
  line(g, 0, -70, 0, 60, 4, '#3a3a3a');                                    // the hinge
  ink(g, [60, -40, 190, -40, 190, 30, 60, 30], PAPER, 2);                  // outer screen
  g.fillStyle = INK; g.font = "bold 26px 'Courier New', monospace"; g.fillText('UNKNOWN', 66, 0);
  ink(g, [-260, -40, -230, -40, -230, -20, -260, -20], INK, 1);            // antenna stub
  g.restore();
  // buzz marks
  for (const [x, y, s] of [[380, 360, -1], [900, 330, 1], [360, 520, -1], [920, 470, 1]]) {
    for (let k = 0; k < 3; k++) brush(g, [x + s * k * 22, y - 30, x + s * (k * 22 + 10), y, x + s * k * 22, y + 30], 5, PAPER);
  }
  letters(g, 'BRRRING', 640, 170, 150, -0.08, PAPER, INK, RED);
}

// 3. Him on the edge of the bed, black against the rainy window, phone to his ear.
function silhouette(g) {
  g.fillStyle = INK; g.fillRect(0, 0, W, H);
  // the window: white with rain, black bars
  ink(g, [690, 70, 1170, 70, 1170, 520, 690, 520], PAPER, 3);
  rain(g, 140, '#4a4a4a', 0.8, 690, 70, 1170, 520);
  ink(g, [920, 70, 945, 70, 945, 520, 920, 520], INK, 2);
  ink(g, [690, 285, 1170, 285, 1170, 305, 690, 305], INK, 2);
  // light from the window falling across the floor
  ink(g, [700, 560, 1180, 560, 1280, H, 560, H], '#4a4845', 6);
  ink(g, [925, 560, 950, 560, 1010, H, 960, H], INK, 3);
  // the bed (everything from here on is shifted right, in front of the window)
  g.save(); g.translate(200, 0);
  ink(g, [0, 520, 760, 500, 780, 600, 0, 620], '#202020', 5);
  brush(g, [40, 530, 250, 512, 470, 522, 700, 508], 3, '#6a6864');
  // him: sitting, hunched, facing the window, phone at his far ear
  const man = [
    560, 600, 548, 520, 560, 420, 585, 330, 600, 300,              // back, up to the shoulders
    598, 262, 612, 226, 646, 214, 676, 226, 684, 248, 694, 262,    // back of head, crown, brow
    700, 270, 690, 276, 694, 296, 680, 312, 664, 318,              // nose, lips, chin
    660, 340, 690, 400, 700, 470,                                 // chest
    790, 480, 800, 520, 800, 640, 770, 660, 760, 545, 690, 548,   // thigh, knee, shin, foot
    660, 600,
  ];
  // rim light from the window: the same shape in white, nudged towards the window, then black on top
  g.save(); g.translate(6, -3); ink(g, man, PAPER, 2); g.restore();
  ink(g, man, INK, 2);
  // arm bent up to the phone (far side, behind the head)
  ink(g, [600, 330, 640, 300, 640, 250, 655, 236, 668, 250, 660, 300, 630, 350]);
  g.restore();
}

// 4. The wedding photo in a cracked frame, a red rose beside it.
function photo(g) {
  g.fillStyle = INK; g.fillRect(0, 0, W, H);
  ink(g, [0, 560, W, 540, W, H, 0, H], '#2a2a2a', 5);
  g.save(); g.translate(640, 330); g.rotate(-0.06);
  ink(g, [-250, -280, 250, -280, 250, 260, -250, 260], '#1a1a1a', 3);      // frame
  ink(g, [-230, -260, 230, -260, 230, 240, -230, 240], '#8d8a84', 2);      // photo background
  hatch(g, [-230, -260, 230, -260, 230, 240, -230, 240], 14, 0.9, 1.2, '#6f6c67');
  // the groom: dark suit, a younger him
  blob(g, -70, -120, 38, 46, PAPER, 2);
  ink(g, [-110, -150, -40, -175, -30, -140, -100, -120]);                  // hair
  ink(g, [-150, 240, -140, -40, -70, -70, 0, -40, 10, 240]);
  ink(g, [-85, -66, -55, -66, -70, 0], PAPER, 1);
  // the bride: white dress and veil
  blob(g, 80, -110, 34, 42, PAPER, 2);
  ink(g, [40, -140, 130, -150, 190, 60, 160, 240, 20, 240, 50, 0], '#d4d1ca', 4); // veil
  ink(g, [60, -60, 110, -60, 170, 240, 20, 240], PAPER, 4);                 // dress
  ink(g, [50, -130, 80, -158, 115, -130, 110, -105, 60, -105], '#3a3a3a', 2);    // hair
  // cracked glass
  g.strokeStyle = PAPER; g.lineWidth = 2.2;
  const cx = 120, cy = -30;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rnd() * 0.4;
    let x = cx, y = cy;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += Math.cos(a + (rnd() - 0.5) * 0.6) * 70; y += Math.sin(a + (rnd() - 0.5) * 0.6) * 70; g.lineTo(x, y); }
    g.stroke();
  }
  g.restore();
  // a red rose lying on the table
  brush(g, [880, 640, 980, 600, 1080, 580], 7, '#2d2d2d');
  blob(g, 1100, 572, 52, 40, RED, 5, -0.3);
  blob(g, 1094, 566, 28, 20, DARKRED, 3, -0.3);
  brush(g, [1080, 560, 1100, 550, 1115, 566], 4, DARKRED);
  ink(g, [960, 600, 990, 575, 1000, 600], '#2d2d2d', 2);
}

// 5. Extreme close-up on his eyes.
function eyes(g) {
  g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
  hatch(g, [640, 0, W, 0, W, H, 640, H], 10, 1.1, 1.6, '#3a3a3a');        // shadow side of the face
  ink(g, [0, 0, W, 0, W, 210, 900, 250, 640, 228, 380, 252, 0, 200]);       // hair and shadow over the brow
  // brows, low and angry
  brush(g, [200, 300, 330, 268, 460, 268, 560, 300], 34);
  brush(g, [720, 300, 820, 268, 950, 268, 1080, 300], 34);
  // eyes
  for (const cx of [390, 890]) {
    ink(g, [cx - 130, 380, cx - 60, 340, cx + 60, 340, cx + 130, 375, cx + 60, 408, cx - 60, 410], '#f4f2ed', 2);
    blob(g, cx, 375, 36, 34, '#4a4a4a', 2);
    blob(g, cx, 375, 18, 18, INK, 1);
    blob(g, cx + 12, 364, 7, 7, '#ffffff', 1);
    brush(g, [cx - 140, 382, cx - 70, 334, cx + 70, 334, cx + 140, 372], 16);  // heavy upper lid
    brush(g, [cx - 110, 412, cx, 424, cx + 110, 404], 4);
    brush(g, [cx - 90, 450, cx, 462, cx + 90, 446], 3, '#5a5a5a');             // tired bags
  }
  // an old scar through the left eyebrow, and the bridge of the nose
  brush(g, [300, 230, 320, 300, 335, 350], 9, '#f4f2ed');
  brush(g, [302, 232, 322, 302, 336, 348], 3, '#6a2a26');
  ink(g, [600, 330, 680, 330, 720, H, 560, H], '#7a7772', 6);
  hatch(g, [640, 330, 680, 330, 720, H, 640, H], 7, 1.1, 1.8, '#2a2a2a');
  dots(g, 0, 560, W, H, 900, 1.6, '#2a2a2a');                               // stubble starts
}

// 6. Profile, half in shadow, against red: his answer.
function profile(g) {
  burst(g, 820, 360, 36, RED, DARKRED);
  g.save(); g.translate(560, 360); g.scale(2.4, 2.4);
  // neck and shoulders
  ink(g, [-80, 220, -60, 110, -10, 95, 40, 110, 70, 220], INK, 2);
  ink(g, [-30, 125, -10, 220, 15, 220, 0, 125], PAPER, 1);                 // vest strap
  // the face: light side, facing right
  const face = [-88, -40, -60, -110, 0, -128, 52, -100, 66, -52, 62, -44, 88, -4, 64, 8, 70, 22, 60, 32, 66, 42, 62, 70, 40, 88, 0, 96, -40, 92, -80, 40];
  ink(g, face, PAPER, 1.5);
  // the dark side of the face (the light comes from the right)
  ink(g, [-88, -40, -60, -110, -10, -118, 0, -70, 10, -20, -5, 30, 10, 80, -40, 92, -80, 40], INK, 2);
  // hair
  ink(g, [-92, -30, -70, -118, -10, -138, 50, -118, 60, -92, 30, -96, 0, -84, -30, -70], INK, 2);
  // ear, outlined in white on the black side
  g.strokeStyle = PAPER; g.lineWidth = 2; g.beginPath(); g.ellipse(-22, -10, 12, 20, 0.2, 0, Math.PI * 2); g.stroke();
  // brow, eye, nose, mouth: angry, talking through his teeth
  brush(g, [18, -62, 44, -56, 66, -48], 7);
  ink(g, [30, -42, 54, -44, 50, -36, 32, -36], INK, 1);
  brush(g, [58, -30, 74, -8], 2);
  brush(g, [50, 8, 60, 14], 2);
  ink(g, [40, 24, 66, 22, 64, 38, 44, 36], INK, 1);                          // open mouth
  line(g, 44, 28, 64, 27, 2.5, PAPER);                                       // teeth
  brush(g, [20, 0, 40, 18, 36, 48], 2, '#555');                              // cheek
  dots(g, 8, 40, 60, 90, 70, 0.8, '#333');                                   // stubble
  g.restore();
}

// 7. Lightning: the room goes white, he's a black shape.
function lightning(g) {
  g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
  // the bolt, seen through the window behind him
  ink(g, [980, 0, 1010, 0, 960, 180, 1030, 190, 930, 420, 970, 240, 900, 230], INK, 2);
  ink(g, [960, 180, 1050, 260, 1000, 250], INK, 1);
  // him, front on, shoulders filling the frame
  ink(g, [130, H, 190, 520, 340, 450, 520, 430, 560, 380, 540, 330, 520, 200, 560, 110, 640, 80,
          720, 110, 760, 200, 740, 330, 720, 380, 760, 430, 940, 450, 1090, 520, 1150, H], INK, 4);
  // just his eyes, catching the flash
  ink(g, [570, 250, 610, 238, 625, 252, 585, 258], PAPER, 1);
  ink(g, [655, 252, 670, 238, 710, 250, 695, 258], PAPER, 1);
  rain(g, 200, INK, 0.25);
}

// 8. The crowbar jammed into the wall panel: KRAK!
function crowbar(g) {
  burst(g, 760, 330, 28, '#8a8680', '#77736d');
  // wooden panel, splitting
  ink(g, [560, 0, W, 0, W, H, 600, H], '#5b5852', 4);
  for (let i = 0; i < 12; i++) brush(g, [620 + i * 55, 0, 610 + i * 55 + rnd() * 20, 360, 630 + i * 55, H], 2.5, '#3a3835');
  ink(g, [700, 0, 760, 250, 720, 330, 790, 520, 740, H, 680, H, 720, 520, 650, 330, 690, 250, 640, 0], INK, 6); // the split
  // splinters flying
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI / 2 + (rnd() - 0.5) * 2.4, d = 90 + rnd() * 260, x = 730 + Math.cos(a) * d, y = 330 + Math.sin(a) * d;
    ink(g, [x, y, x + Math.cos(a) * 46, y + Math.sin(a) * 46, x + 6, y + 5], rnd() < 0.5 ? PAPER : INK, 2);
  }
  // the crowbar
  brush(g, [60, 760, 420, 500, 730, 300], 64);
  brush(g, [60, 744, 420, 486, 720, 290], 9, '#8d8d8d');
  // big fists wrapped round it, knuckles and all
  for (const [x, y] of [[250, 620], [470, 470]]) {
    blob(g, x, y, 120, 82, PAPER, 6, -0.6);
    g.strokeStyle = INK; g.lineWidth = 6; g.lineCap = 'round';
    for (let k = -1.5; k <= 1.5; k++) { g.beginPath(); g.arc(x + k * 44 + 10, y - k * 28 - 12, 28, 3.6, 5.6); g.stroke(); }
    brush(g, [x - 100, y + 16, x - 40, y + 66, x + 60, y + 50], 8);
    brush(g, [x - 110, y - 30, x - 80, y + 50], 6);
    hatch(g, [x - 30, y + 20, x + 90, y - 30, x + 100, y + 30, x, y + 70], 8, 0.8, 2);
  }
  ink(g, [0, H, 0, 600, 150, 650, 190, H]);                                 // his arm and sleeve, in shadow
  letters(g, 'KRAK!', 960, 200, 210, -0.12, RED, INK, INK);
}

// 9. The stash behind the wall: suits, wanted posters, the revolver.
function stash(g) {
  g.fillStyle = INK; g.fillRect(0, 0, W, H);
  // the broken panel edges, catching the light
  ink(g, [150, 0, 260, 0, 240, H, 150, H], '#3c3a36', 5);
  ink(g, [1020, 0, 1130, 0, 1130, H, 1040, H], '#3c3a36', 5);
  // a shaft of light falling in from the room
  ink(g, [260, 0, 620, 0, 960, H, 420, H], 'rgba(230,227,220,0.12)', 4);
  // wanted posters
  for (const [x, y, r] of [[330, 80, -0.05], [730, 70, 0.04]]) {
    g.save(); g.translate(x, y); g.rotate(r);
    ink(g, [0, 0, 220, 0, 220, 250, 0, 250], '#cfccc4', 3);
    letters(g, 'WANTED', 110, 38, 46, 0, INK, '#cfccc4');
    blob(g, 110, 125, 42, 50, INK, 3);
    ink(g, [70, 165, 150, 165, 165, 215, 55, 215]);
    g.fillStyle = INK; g.font = 'bold 18px Georgia, serif'; g.textAlign = 'center'; g.fillText('$10,000 REWARD', 110, 238);
    g.restore();
  }
  // the revolver on its pegs, with a red glow behind it
  const glow = g.createRadialGradient(640, 390, 10, 640, 390, 260);
  glow.addColorStop(0, 'rgba(179,18,15,0.75)'); glow.addColorStop(1, 'rgba(179,18,15,0)');
  g.fillStyle = glow; g.fillRect(380, 200, 520, 380);
  line(g, 545, 410, 545, 440, 10, '#6a6a6a'); line(g, 735, 410, 735, 440, 10, '#6a6a6a');
  drawGun(g, 640, 395, 1.1, 0);
  // suits hanging on a rail
  line(g, 300, 470, 980, 470, 8, '#6a6a6a');
  for (const x of [380, 800]) {
    ink(g, [x - 10, 470, x, 450, x + 10, 470], '#8a8a8a', 1);
    ink(g, [x - 110, 490, x + 110, 490, x + 130, H, x - 130, H], '#1d1d1d', 4);
    ink(g, [x - 30, 490, x + 30, 490, x, 590], PAPER, 2);
    ink(g, [x - 8, 500, x + 8, 500, x + 10, 600, x, 620, x - 10, 600], INK, 1);
    brush(g, [x - 40, 490, x - 10, 640], 4, '#4a4a4a'); brush(g, [x + 40, 490, x + 10, 640], 4, '#4a4a4a');
  }
  // his shadow falling across it all
  ink(g, [0, H, 0, 300, 60, 260, 120, 180, 210, 150, 260, 190, 270, 270, 330, 330, 420, H], 'rgba(0,0,0,0.75)', 5);
}

// A revolver, side on, pointing left. s = size, a = angle.
function drawGun(g, x, y, s, a) {
  g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s);
  ink(g, [-210, -26, 40, -26, 40, 4, -210, 4], INK, 2);                      // barrel
  ink(g, [-205, -24, 40, -24, 40, -17, -205, -17], '#8e8e8e', 1);            // shine
  ink(g, [-200, -40, -186, -40, -186, -26, -200, -26], INK, 1);             // front sight
  ink(g, [-180, 4, 30, 4, 30, 16, -180, 16], '#2a2a2a', 1);                  // ejector rod
  ink(g, [20, -38, 130, -38, 130, 40, 20, 40], '#2c2c2c', 2);                 // cylinder
  for (let i = 0; i < 3; i++) line(g, 40 + i * 30, -30, 40 + i * 30, 32, 6, '#6a6a6a');
  ink(g, [120, -46, 210, -46, 220, 20, 170, 60, 120, 50], INK, 2);           // frame
  ink(g, [190, -46, 230, -80, 250, -70, 215, -36], INK, 1);                  // hammer
  g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.arc(160, 70, 30, 0.2, Math.PI - 0.2); g.stroke(); // trigger guard
  ink(g, [190, 20, 250, 10, 300, 180, 240, 200], '#3a2a20', 3);              // wooden grip
  hatch(g, [195, 25, 248, 15, 292, 175, 242, 192], 9, 1.2, 1.4, '#1a1a1a');
  g.restore();
}

// 10. Close-up: his hand on the revolver, spinning the cylinder.
function revolver(g) {
  burst(g, 560, 360, 40, RED, DARKRED);
  drawGun(g, 520, 320, 2.0, -0.12);
  // motion arcs round the spinning cylinder
  g.strokeStyle = PAPER; g.lineWidth = 6; g.lineCap = 'round';
  for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(675, 320, 105 + k * 24, -1.2 + k * 0.2, 0.3 + k * 0.2); g.stroke(); }
  // his hand wrapped round the grip: fingers in front, thumb over the top
  blob(g, 1010, 380, 100, 78, PAPER, 6, 1.1);
  g.strokeStyle = INK; g.lineWidth = 6;
  for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(960 + k * 20, 336 + k * 30, 26, 2.6, 4.6); g.stroke(); }
  brush(g, [935, 300, 985, 272, 1040, 290], 8);                             // thumb
  ink(g, [1010, 440, 1100, 420, W, 470, W, H, 1080, H]);                    // wrist and sleeve
  letters(g, 'CLICK', 300, 600, 90, -0.1, PAPER, INK, INK);
}

// 11. He walks out of the door into the rain, revolver in hand.
function doorway(g) {
  g.fillStyle = INK; g.fillRect(0, 0, W, H);
  // the street outside, bright through the door
  ink(g, [420, 60, 860, 60, 860, 640, 420, 640], '#9c9993', 3);
  ink(g, [420, 400, 860, 380, 860, 640, 420, 640], '#bdbab3', 4);           // wet road
  ink(g, [700, 90, 712, 90, 712, 420, 700, 420], '#3a3a3a', 2);            // lamp post
  blob(g, 706, 100, 34, 14, PAPER, 2);
  rain(g, 160, '#3e3e3e', 0.7, 420, 60, 860, 640);
  // the door swung open
  ink(g, [860, 60, 960, 20, 960, H, 860, 640], '#1c1c1c', 3);
  // light spilling in across the floor
  ink(g, [420, 640, 860, 640, 1060, H, 220, H], '#5a5853', 5);
  // him, from behind, walking out, revolver in his right hand
  const man = [560, 640, 585, 520, 598, 420, 584, 330, 590, 272, 615, 258, 632, 250, 650, 250, 668, 258,
               692, 272, 700, 330, 694, 420, 690, 520, 740, 640, 712, 642, 660, 520, 642, 470,
               620, 520, 590, 642];
  ink(g, man, INK, 2);
  blob(g, 641, 222, 26, 31, INK, 2);                                         // head
  ink(g, [628, 245, 654, 245, 656, 262, 626, 262], INK, 1);                  // neck
  ink(g, [690, 272, 725, 370, 728, 412, 710, 408, 696, 340], INK, 2);       // right arm
  drawGun(g, 740, 420, 0.32, 1.35);
  // his long shadow stretching back towards you
  ink(g, [560, 642, 740, 642, 900, H, 380, H], INK, 4);
}

// =========================================================================
// Playing the panels
// =========================================================================
export class Cutscene {
  constructor(_gameCanvas, onEnd) {
    this.canvas = document.getElementById('cine');
    this.g = this.canvas.getContext('2d');
    this.onEnd = onEnd;
    this.panel = 0;           // which panel is showing
    this.t = 0;               // how long it has been showing
    this.played = 0;          // how many of its sounds have played
    this.done = true;
    this.subs = document.getElementById('subs');
    this.skipEl = document.getElementById('skip');
    this.lastKey = null;
    // a sheet of paper grain, laid over every panel
    this.grain = document.createElement('canvas');
    this.grain.width = 320; this.grain.height = 180;
    const gg = this.grain.getContext('2d'), img = gg.createImageData(320, 180);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    gg.putImageData(img, 0, 0);
  }

  start() {
    this.done = false;
    this.canvas.hidden = false;
    this.skipEl.hidden = false;
    this.show(0);
  }

  // put panel i on screen (handy for testing: game.cutscene.show(5))
  show(i) {
    if (i >= PANELS.length) { this.finish(); return; }
    this.panel = i;
    this.t = 0;
    this.played = 0;
  }

  update(dt) {
    if (this.done) return;
    this.t += dt;
    const p = PANELS[this.panel], cues = p.sfx || [];
    while (this.played < cues.length && cues[this.played][0] <= this.t) cues[this.played++][1]();
    if (this.t >= p.dur) this.show(this.panel + 1);
  }

  next() { if (!this.done) this.show(this.panel + 1); }   // click: next panel
  skip() { if (!this.done) this.finish(); }               // Space / Esc: skip the lot

  finish() {
    this.done = true;
    this.canvas.hidden = true;
    this.skipEl.hidden = true;
    this.showLine(null);
    sfx.setRain(false);
    this.onEnd();
  }

  showLine(l) {
    if (l === this.lastKey) return;
    this.lastKey = l;
    if (!l) { this.subs.hidden = true; return; }
    const [, who, text] = l;
    this.subs.hidden = false;
    this.subs.className = who || 'caption';
    const name = who === 'you' ? 'YOU' : who === 'voice' ? 'VOICE ON THE PHONE' : '';
    this.subs.innerHTML = (name ? `<b>${name}</b>` : '') + `<span>${text}</span>`;
  }

  draw() {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    if (this.done) return;
    const p = PANELS[this.panel];
    let current = null;
    for (const l of p.lines || []) if (this.t >= l[0]) current = l;
    this.showLine(current);
    if (this.t < CUT) return;                                   // the blink between panels
    // slow push in, and a jolt on impacts
    const k = Math.min(1, this.t / p.dur), z = 1 + PUSH * k;
    g.save();
    g.translate(W / 2, H / 2); g.scale(z, z); g.translate(-W / 2, -H / 2);
    if (p.shake && this.t > p.shake && this.t < p.shake + 0.35) g.translate((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 12);
    seed = (this.panel + 1) * 7919;
    p.draw(g);
    g.restore();
    // paper grain, dark corners, and a heavy black border like a comic panel
    g.globalAlpha = 0.07; g.globalCompositeOperation = 'overlay';
    g.drawImage(this.grain, 0, 0, W, H);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    const vig = g.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 820);
    vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = vig; g.fillRect(0, 0, W, H);
    g.lineWidth = 18; g.strokeStyle = '#000'; g.strokeRect(9, 9, W - 18, H - 18);
    // fade in at the start, fade out at the end
    let fade = 0;
    if (this.panel === 0) fade = 1 - Math.min(1, this.t / 1.2);
    if (p.fadeOut) fade = Math.max(fade, (this.t - (p.dur - p.fadeOut)) / p.fadeOut);
    if (fade > 0) { g.fillStyle = `rgba(0,0,0,${Math.min(1, fade)})`; g.fillRect(0, 0, W, H); }
  }
}
