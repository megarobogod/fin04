// cutscene.js - the opening scene, told as inked comic panels.
//
// Each PANEL is a still picture drawn in code in a stark ink style: solid
// black shadows, cold white light, rough hand-drawn edges, and only a touch
// of red. The mood is quiet and cold, not loud: lots of black and empty
// space, no shouting faces, no sound-effect lettering. The threat is in what
// is said and in how calm he stays. A panel holds for a few seconds with a
// very slow push-in, shows its lines and plays its sounds, then cuts.
//
// It draws on its own 1280 x 720 canvas (#cine) so the ink lines stay sharp.
// Click / Enter = next panel, Space / Esc = skip the whole scene.

import * as sfx from './audio.js';

const W = 1280, H = 720;
const CUT = 0.22;              // a beat of black between panels
const PUSH = 0.03;             // how much each panel slowly zooms in

// ---- colours: ink, paper, two greys, and red ----
const INK = '#0b0b0b', PAPER = '#e6e3dc', LIGHT = '#a3a19c';
const RED = '#b3120f', DARKRED = '#5e0605';

// ---- the panels ----
// dur:   seconds on screen
// lines: [seconds into the panel, who ('you', 'voice' or '' for a caption), words]
// sfx:   [seconds into the panel, sound]
// draw:  the function below that paints it
const PANELS = [
  { draw: city, dur: 4.6, lines: [[0.5, '', 'The old neighbourhood. 2 a.m.']],
    sfx: [[0, () => sfx.setRain(true, 0.05)]] },
  { draw: phone, dur: 3.4, sfx: [[0.2, sfx.phoneRing], [1.7, sfx.phoneRing]] },
  { draw: silhouette, dur: 7.6,
    lines: [[0.4, 'you', 'Yeah.'], [2.1, 'voice', "Been a long time. You remember me? 'Course you do."]],
    sfx: [[0, sfx.phoneFlip], [2.1, () => sfx.phoneVoice(3.2)]] },
  { draw: photo, dur: 4.4, lines: [[0.3, 'voice', "I've got your wife. She's right here with me."]],
    sfx: [[0.3, () => sfx.phoneVoice(2.8)]] },
  { draw: coat, dur: 6.0, lines: [[0.4, 'voice', "You're doing one last job for the Vipers. Say no, and she pays for it. Slowly."]],
    sfx: [[0.4, () => sfx.phoneVoice(4.3)]] },
  { draw: shadowFace, dur: 8.0,
    lines: [[1.0, 'you', 'Listen to me very carefully.'], [3.8, 'you', "I'm going to find you. Then every last one of your Vipers."]] },
  { draw: smallInDark, dur: 5.6, lines: [[0.4, 'you', "And when I'm done, there won't be enough of you left to bury."]],
    sfx: [[4.9, sfx.phoneFlip]] },
  { draw: crowbar, dur: 3.4, sfx: [[0.3, sfx.creak], [1.7, sfx.crack], [2.1, sfx.crash]] },
  { draw: stash, dur: 4.2, sfx: [[1.0, sfx.clang]] },
  { draw: loading, dur: 3.6, sfx: [[1.1, sfx.insert], [2.6, sfx.cylinderClose]] },
  { draw: doorway, dur: 4.8, fadeOut: 1.6,
    sfx: [[0, sfx.doorCreak], [0.1, () => sfx.setRain(true, 0.14)], [1.4, sfx.step], [1.9, sfx.step], [2.4, sfx.step], [2.9, sfx.step]] },
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
  g.save(); g.shadowColor = RED; g.shadowBlur = 12;
  ink(g, [330, 180, 372, 180, 372, 470, 330, 470], DARKRED, 2);
  g.font = "900 42px Impact, 'Arial Black', sans-serif"; g.textAlign = 'center'; g.fillStyle = '#c8211b';
  'ROOMS'.split('').forEach((ch, i) => g.fillText(ch, 351, 228 + i * 54));
  g.restore();
  rain(g, 260, PAPER, 0.45);
}

// 2. Close-up: the flip phone on the bedside table, its little screen lit in the dark.
function phone(g) {
  g.fillStyle = INK; g.fillRect(0, 0, W, H);
  ink(g, [0, 470, W, 430, W, H, 0, H], '#3a3936', 6);                     // table top, barely lit
  for (let i = 0; i < 7; i++) brush(g, [0, 500 + i * 30, 500, 488 + i * 29, W, 462 + i * 28], 2, '#2a2927');
  // the glow of the screen on the wood
  const glow = g.createRadialGradient(700, 470, 10, 700, 470, 360);
  glow.addColorStop(0, 'rgba(230,227,220,0.32)'); glow.addColorStop(1, 'rgba(230,227,220,0)');
  g.fillStyle = glow; g.fillRect(300, 250, 800, 470);
  // ashtray, one cigarette burnt down, a thin thread of smoke
  blob(g, 1060, 500, 110, 26, '#1a1a1a', 4);
  ink(g, [1020, 492, 1100, 486, 1102, 494, 1022, 500], '#8a8781', 1);
  brush(g, [1100, 486, 1112, 420, 1094, 360, 1116, 290, 1098, 220], 3, 'rgba(230,227,220,0.35)');
  // the phone
  g.save(); g.translate(640, 500); g.rotate(-0.1);
  ink(g, [-230, -64, 230, -64, 238, 56, -238, 56], '#121212', 4);
  ink(g, [-225, -60, 228, -60, 228, -52, -225, -52], '#3a3a3a', 2);        // edge catching the light
  line(g, 0, -64, 0, 56, 3, '#262626');                                    // the hinge
  ink(g, [60, -38, 190, -38, 190, 26, 60, 26], PAPER, 2);                  // outer screen
  g.fillStyle = INK; g.font = "bold 26px 'Courier New', monospace"; g.fillText('UNKNOWN', 66, 0);
  g.restore();
  // two small buzz marks, nothing more
  brush(g, [395, 470, 384, 500, 395, 530], 3, '#8a8781');
  brush(g, [890, 446, 901, 476, 890, 506], 3, '#8a8781');
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

// 5. Her coat, still hanging by the door. Light through the blinds.
function coat(g) {
  g.fillStyle = INK; g.fillRect(0, 0, W, H);
  ink(g, [380, 0, 920, 0, 920, H, 380, H], '#1c1c1c', 4);                  // the hallway wall
  ink(g, [920, 0, 980, 0, 980, H, 920, H], '#0f0f0f', 3);                  // door frame
  // the hook
  line(g, 640, 150, 640, 176, 8, '#6a6a6a');
  brush(g, [640, 176, 652, 190, 664, 180], 5, '#6a6a6a');
  // her coat: long, belted, hanging empty
  ink(g, [612, 182, 668, 182, 730, 230, 760, 640, 690, 660, 640, 650, 590, 660, 520, 640, 550, 230], '#2b2b2b', 4);
  ink(g, [612, 182, 640, 200, 668, 182, 650, 300, 640, 320, 630, 300], '#1a1a1a', 2);   // collar
  line(g, 548, 390, 732, 390, 7, '#161616');                               // belt
  for (const y of [300, 360, 450, 520]) blob(g, 650, y, 5, 5, '#5a5a5a', 1);
  // a pale scarf over the hook
  ink(g, [600, 176, 680, 176, 700, 210, 688, 460, 664, 470, 660, 230, 620, 240, 606, 420, 584, 410, 590, 210], '#8a8781', 4);
  // light through the blinds, laid across everything in cold stripes
  g.save(); g.globalAlpha = 0.2;
  for (let i = 0; i < 8; i++) {
    const y = 40 + i * 70;
    ink(g, [0, y, W, y - 260, W, y - 228, 0, y + 32], PAPER, 2);
  }
  g.restore();
  // her shoes, side by side on the floor
  ink(g, [560, 690, 620, 686, 624, 706, 556, 708], '#3a3a3a', 2);
  ink(g, [640, 692, 700, 688, 704, 708, 636, 710], '#3a3a3a', 2);
}

// 6. His face, almost all in shadow. One band of light across his eyes. Calm.
function shadowFace(g) {
  g.fillStyle = INK; g.fillRect(0, 0, W, H);
  // the shape of his head, only just there
  const head = [440, 110, 520, 50, 640, 40, 740, 80, 790, 180, 800, 300, 780, 420, 740, 520, 680, 590, 600, 610, 520, 580, 470, 500, 440, 400, 430, 260];
  ink(g, head, '#131313', 4);
  brush(g, [760, 100, 794, 200, 802, 320, 784, 440, 744, 530, 684, 596], 4, '#4a4a4a');   // faint rim of light down his cheek
  // one band of cold light from the blinds, across his eyes
  g.save(); path(g, head); g.clip();
  ink(g, [380, 268, 860, 252, 860, 340, 380, 356], '#cfccc5', 3);
  // eyes: level, half closed, not angry, not scared. Just looking.
  for (const cx of [545, 700]) {
    ink(g, [cx - 58, 306, cx - 20, 299, cx + 28, 299, cx + 58, 305, cx + 24, 313, cx - 26, 313], '#d8d5ce', 1);
    blob(g, cx + 2, 307, 9, 6, '#2a2a2a', 0.5);
    blob(g, cx + 2, 307, 4, 4, INK, 0.3);
    brush(g, [cx - 66, 306, cx - 30, 297, cx + 30, 297, cx + 66, 304], 10);  // heavy lid, low and flat
  }
  brush(g, [470, 268, 600, 262], 10, '#2a2a2a');                           // brows, straight
  brush(g, [650, 262, 770, 266], 10, '#2a2a2a');
  brush(g, [500, 240, 512, 292, 518, 330], 4, '#8d8a84');                  // the old scar through his brow, pale
  hatch(g, [610, 256, 640, 256, 640, 356, 610, 356], 6, 1.2, 1.4, '#3a3a3a');   // nose bridge in shadow
  // a second, fainter band lower down: a flat, closed mouth and stubble
  g.globalAlpha = 0.35;
  ink(g, [380, 470, 860, 458, 860, 508, 380, 520], '#cfccc5', 3);
  g.globalAlpha = 1;
  brush(g, [570, 492, 630, 489, 690, 492], 5);
  dots(g, 470, 466, 780, 516, 160, 1.2, '#2a2a2a');
  g.restore();
}

// 7. Wide: the dark flat, him small on the edge of the bed, the phone lowered.
function smallInDark(g) {
  g.fillStyle = INK; g.fillRect(0, 0, W, H);
  // the window, far off, with rain on it
  ink(g, [820, 130, 1060, 130, 1060, 380, 820, 380], '#9e9b95', 3);
  rain(g, 70, '#3a3a3a', 0.7, 820, 130, 1060, 380);
  ink(g, [935, 130, 948, 130, 948, 380, 935, 380], INK, 1);
  ink(g, [820, 250, 1060, 250, 1060, 262, 820, 262], INK, 1);
  // its light, a cold pool on the floor
  ink(g, [800, 470, 1080, 470, 1180, 640, 700, 640], '#2a2928', 5);
  // the bed and him, small, sitting very still
  ink(g, [560, 470, 900, 462, 906, 520, 556, 528], '#151515', 3);
  ink(g, [835, 470, 830, 410, 838, 372, 852, 356, 872, 356, 882, 372, 884, 410, 878, 470], INK, 2);
  blob(g, 862, 340, 13, 15, INK, 1);
  ink(g, [876, 470, 912, 470, 914, 530, 902, 532, 900, 486, 880, 486], INK, 1);   // knee and shin
  ink(g, [868, 410, 900, 440, 912, 470, 902, 474, 886, 446, 864, 428], INK, 1);   // arm resting, phone in hand
  blob(g, 908, 470, 3, 2, '#cfccc5', 0.5);                                        // the phone's tiny screen
  // a glass on the floor by the bed
  ink(g, [520, 520, 540, 520, 538, 560, 522, 560], '#2e2e2e', 1);
}

// 8. The crowbar's flat end, pushed into the seam of the wall panel. A steady hand.
function crowbar(g) {
  g.fillStyle = INK; g.fillRect(0, 0, W, H);
  // the panelling, lit from the left
  ink(g, [0, 0, W, 0, W, H, 0, H], '#2f2e2b', 4);
  const side = g.createLinearGradient(0, 0, W, 0);
  side.addColorStop(0, 'rgba(230,227,220,0.18)'); side.addColorStop(1, 'rgba(0,0,0,0.5)');
  g.fillStyle = side; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 14; i++) brush(g, [i * 96 + 20, 0, i * 96 + 14 + rnd() * 10, 360, i * 96 + 22, H], 1.6, '#1c1b19');
  // the seam, and where it's starting to split
  ink(g, [700, 0, 712, 0, 714, H, 702, H], INK, 2);
  ink(g, [712, 250, 760, 300, 746, 330, 712, 380], INK, 2);
  // the crowbar, coming in from the bottom left
  brush(g, [80, 760, 420, 520, 704, 312], 46, '#1a1a1a');
  brush(g, [80, 748, 420, 508, 700, 302], 5, '#6a6a6a');
  // his hand on it: still, knuckles pale
  blob(g, 330, 590, 110, 70, '#b9b6af', 5, -0.6);
  g.strokeStyle = '#3a3a3a'; g.lineWidth = 4; g.lineCap = 'round';
  for (let k = -1.5; k <= 1.5; k++) { g.beginPath(); g.arc(340 + k * 40, 584 - k * 26 - 10, 24, 3.6, 5.6); g.stroke(); }
  ink(g, [0, H, 0, 640, 200, 660, 240, H], INK);                           // sleeve, in shadow
  // a little dust drifting from the split
  g.fillStyle = 'rgba(230,227,220,0.5)';
  for (let i = 0; i < 26; i++) { g.beginPath(); g.arc(700 + rnd() * 120, 260 + rnd() * 280, 1 + rnd() * 1.6, 0, 7); g.fill(); }
}

// 9. The stash behind the wall: suits, wanted posters, the revolver.
function stash(g) {
  g.fillStyle = INK; g.fillRect(0, 0, W, H);
  // the broken panel edges, catching the light
  ink(g, [150, 0, 260, 0, 240, H, 150, H], '#3c3a36', 5);
  ink(g, [1020, 0, 1130, 0, 1130, H, 1040, H], '#3c3a36', 5);
  // a shaft of light falling in from the room
  ink(g, [260, 0, 620, 0, 960, H, 420, H], 'rgba(230,227,220,0.16)', 4);
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
  // the revolver on its pegs
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

// 10. Close-up: the cylinder swung open. He pushes the rounds in, one at a time.
function loading(g) {
  g.fillStyle = INK; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(640, 330, 20, 640, 330, 520);
  glow.addColorStop(0, 'rgba(230,227,220,0.14)'); glow.addColorStop(1, 'rgba(230,227,220,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  // the cylinder, seen end on
  const cx = 600, cy = 360;
  blob(g, cx, cy, 190, 190, '#262626', 4);
  brush(g, [cx - 150, cy - 120, cx - 60, cy - 180, cx + 60, cy - 182], 6, '#6a6a6a');   // a glint on the steel
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2, x = cx + Math.cos(a) * 112, y = cy + Math.sin(a) * 112;
    blob(g, x, y, 44, 44, '#0a0a0a', 1.5);
    if (i >= 1 && i <= 4) {          // four already loaded: brass rims, primers
      blob(g, x, y, 40, 40, '#8f8c85', 1.5);
      blob(g, x, y, 32, 32, '#a8a59e', 1);
      blob(g, x, y, 9, 9, '#5a5a5a', 0.5);
    }
  }
  blob(g, cx, cy, 30, 30, '#3a3a3a', 1);
  // his fingers, holding the fifth round over its chamber
  const tx = cx, ty = cy - 112;      // the empty chamber at the top
  ink(g, [tx - 30, ty - 10, tx + 30, ty - 10, tx + 34, ty - 150, tx - 26, ty - 150], '#9a978f', 2);  // the round
  ink(g, [tx - 34, ty - 150, tx + 38, ty - 150, tx + 40, ty - 162, tx - 36, ty - 162], '#b0ada6', 1);
  ink(g, [tx + 20, ty - 190, tx + 240, ty - 260, W, ty - 220, W, ty - 60, tx + 230, ty - 80, tx + 44, ty - 120], '#b9b6af', 6); // fingers and hand
  brush(g, [tx + 40, ty - 150, tx + 120, ty - 170, tx + 220, ty - 160], 3, '#5a5a5a');
  brush(g, [tx + 40, ty - 126, tx + 140, ty - 120, tx + 240, ty - 100], 3, '#5a5a5a');
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
