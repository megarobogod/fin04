// textures.js - every picture in the game is drawn here, in code.
// Walls, floors, the sky, the gang members, the props and the revolver.
// The whole game is black and white. The only colour is red, and red is blood.
//
// A texture is { w, h, data } where data is a Uint32Array of pixels.
// Each pixel is 0xAABBGGRR (that is how the browser stores them).
// Alpha 255 = normal, 0 = see-through, 254 = "glows" (lit windows, lamps,
// muzzle flashes): glowing pixels ignore lighting and darkness.

export const T = 64;          // wall and floor textures are 64 x 64
export const GLOW = 254;      // the alpha value that marks a glowing pixel

// ---- random numbers -------------------------------------------------------
// A seeded random generator, so the textures come out the same every time.
let seed = 1234567;
export function rand() {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// A random-looking number from 0 to 1 for a grid point (x, y).
function hash(x, y, salt) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(salt + 1, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Smooth noise that tiles: `cells` blobs across `size` pixels.
function noise(x, y, cells, salt, size = T) {
  const fx = (x / size) * cells, fy = (y / size) * cells;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  let tx = fx - x0, ty = fy - y0;
  tx = tx * tx * (3 - 2 * tx);
  ty = ty * ty * (3 - 2 * ty);
  const w = (i) => ((i % cells) + cells) % cells;
  const a = hash(w(x0), w(y0), salt), b = hash(w(x0 + 1), w(y0), salt);
  const c = hash(w(x0), w(y0 + 1), salt), d = hash(w(x0 + 1), w(y0 + 1), salt);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

// ---- colours --------------------------------------------------------------
const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
export function gray(v) {
  v = clamp(v);
  return (0xFF000000 | (v << 16) | (v << 8) | v) >>> 0;
}
export function rgb(r, g, b) {
  return (0xFF000000 | (clamp(b) << 16) | (clamp(g) << 8) | clamp(r)) >>> 0;
}
// A random shade of blood red. `dark` makes it deeper (old pools).
export function bloodColor(dark = 0) {
  const r = 150 - dark * 50 + rand() * 50;
  return rgb(r, rand() * 10, rand() * 8);
}
const css = (v) => `rgb(${v | 0},${v | 0},${v | 0})`;
const RED = 'rgb(150,8,8)';
const DARKRED = 'rgb(105,4,4)';

// ---- building textures ----------------------------------------------------
function newCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Make a texture. `pixel(x, y)` fills it pixel by pixel (optional), then
// `draw(g)` can add shapes with the normal canvas 2D drawing commands.
// `glows` is a list of [x0, y0, x1, y1, minBrightness] boxes: bright pixels
// inside those boxes are marked as glowing.
function makeTex(w, h, pixel, draw, glows) {
  const c = newCanvas(w, h), g = c.getContext('2d');
  if (pixel) {
    const img = g.createImageData(w, h);
    const d = new Uint32Array(img.data.buffer);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d[y * w + x] = pixel(x, y);
    g.putImageData(img, 0, 0);
  }
  if (draw) draw(g);
  const data = new Uint32Array(g.getImageData(0, 0, w, h).data.buffer.slice(0));
  const tex = { w, h, data };
  for (const [x0, y0, x1, y1, min] of glows || []) glow(tex, x0, y0, x1, y1, min);
  return tex;
}

function glow(tex, x0, y0, x1, y1, min) {
  for (let y = Math.max(0, y0); y < Math.min(tex.h, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(tex.w, x1); x++) {
      const i = y * tex.w + x, c = tex.data[i];
      if ((c >>> 24) > 128 && (c & 255) >= min) tex.data[i] = ((c & 0x00FFFFFF) | (GLOW << 24)) >>> 0;
    }
  }
}

// ---- walls ----------------------------------------------------------------
// Bricks are 16 x 8 pixels, every other row shifted by half a brick.
function brick(base, spread, mortar, salt = 5) {
  return (x, y) => {
    const row = y >> 3, off = (row & 1) * 8;
    const bx = ((x + off) & 63) >> 4, ix = (x + off) & 15, iy = y & 7;
    if (iy === 7 || ix === 15) return gray(mortar + rand() * 12);
    const b = hash(bx, row, salt) * spread;
    const n = noise(x, y, 8, salt + 1) * 22 + rand() * 16;
    const chip = rand() < 0.02 ? -25 : 0;
    const top = iy === 0 ? 8 : 0; // a little highlight on the top edge
    return gray(base + b + n + chip + top);
  };
}

function windowTex(lit) {
  return makeTex(T, T, brick(82, 30, 40), (g) => {
    g.fillStyle = css(140); g.fillRect(18, 10, 28, 40);   // window frame
    g.fillStyle = css(170); g.fillRect(16, 49, 32, 3);    // sill
    g.fillStyle = css(30); g.fillRect(16, 52, 32, 1);
    if (lit) {
      g.fillStyle = css(235); g.fillRect(21, 13, 22, 34); // glowing blinds
      g.fillStyle = css(200);
      for (let y = 14; y < 47; y += 3) g.fillRect(21, y, 22, 1);
    } else {
      g.fillStyle = css(22); g.fillRect(21, 13, 22, 34);  // dark glass
      g.strokeStyle = css(62); g.lineWidth = 2;
      g.beginPath(); g.moveTo(24, 40); g.lineTo(36, 16); g.stroke();
      g.beginPath(); g.moveTo(30, 44); g.lineTo(40, 24); g.stroke();
    }
    g.fillStyle = css(120); g.fillRect(31, 13, 2, 34); g.fillRect(21, 29, 22, 2); // window bars
  }, lit ? [[21, 13, 43, 47, 150]] : null);
}

function buildWalls() {
  const W = {};
  W.brick = makeTex(T, T, brick(82, 30, 40));
  W.darkbrick = makeTex(T, T, brick(52, 22, 24, 11));
  W.window = windowTex(true);
  W.darkwindow = windowTex(false);

  W.graffiti = makeTex(T, T, brick(78, 28, 38, 7), (g) => {
    g.save(); g.translate(32, 30); g.rotate(-0.16);
    g.fillStyle = css(225); g.font = 'bold 14px Impact, Arial Black, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('VIPERS', 0, 0);
    g.restore();
    // a snake squiggle underneath
    g.strokeStyle = css(215); g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(8, 48);
    g.bezierCurveTo(18, 38, 24, 58, 34, 48); g.bezierCurveTo(42, 40, 48, 54, 56, 44);
    g.stroke();
    g.fillStyle = css(215); g.beginPath(); g.arc(57, 43, 3, 0, Math.PI * 2); g.fill();
    // paint drips
    g.fillRect(14, 36, 1, 7); g.fillRect(40, 36, 1, 5);
  });

  W.poster = makeTex(T, T, brick(74, 26, 36, 9), (g) => {
    g.fillStyle = css(205); g.fillRect(7, 9, 24, 32);           // WANTED poster
    g.fillStyle = css(25); g.font = 'bold 6px Georgia, serif'; g.textAlign = 'center';
    g.fillText('WANTED', 19, 16);
    g.beginPath(); g.arc(19, 26, 5, 0, Math.PI * 2); g.fill();   // face silhouette
    g.fillRect(12, 31, 14, 5);
    g.fillRect(11, 37, 16, 1);
    g.fillStyle = css(165); g.fillRect(36, 18, 21, 26);         // a torn old poster
    g.fillStyle = css(74);
    g.beginPath(); g.moveTo(36, 36); g.lineTo(44, 44); g.lineTo(36, 44); g.fill();
    g.fillStyle = css(60); for (let y = 23; y < 38; y += 4) g.fillRect(39, y, 15, 1);
  });

  W.door = makeTex(T, T, brick(80, 28, 38, 13), (g) => {
    g.fillStyle = css(25); g.fillRect(16, 8, 32, 56);            // door frame
    g.fillStyle = css(48); g.fillRect(18, 10, 28, 54);           // door
    g.strokeStyle = css(72); g.lineWidth = 1;
    g.strokeRect(21.5, 14.5, 21, 20); g.strokeRect(21.5, 38.5, 21, 22);
    g.fillStyle = css(180); g.beginPath(); g.arc(41, 40, 1.6, 0, Math.PI * 2); g.fill();
    g.fillStyle = css(105); g.fillRect(13, 61, 38, 3);           // step
  });

  W.bar = makeTex(T, T, brick(70, 24, 34, 17), (g) => {
    g.fillStyle = css(16); g.fillRect(6, 8, 52, 46);
    g.strokeStyle = css(115); g.lineWidth = 2; g.strokeRect(6, 8, 52, 46);
    g.fillStyle = css(245); g.font = 'bold 19px Georgia, serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('BAR', 32, 23);
    g.fillStyle = css(215); g.fillRect(14, 35, 36, 2);
    g.font = 'bold 8px Georgia, serif'; g.fillText('OPEN LATE', 32, 45);
  }, [[7, 9, 57, 53, 150]]);

  W.wood = makeTex(T, T, (x, y) => {
    const p = x >> 3, ix = x & 7;
    if (ix === 0) return gray(22);
    const base = 66 + hash(p, 0, 9) * 30;
    const grain = Math.sin((y + hash(p, 1, 9) * 64) * 0.35 + noise(x, y, 4, 9) * 6) * 8;
    return gray(base + grain + rand() * 10 + (ix === 1 ? 12 : 0));
  });

  W.concrete = makeTex(T, T, (x, y) => {
    let v = 112 + noise(x, y, 4, 3) * 30 + noise(x, y, 16, 4) * 14 + rand() * 12;
    if (noise(x, 0, 8, 6) > 0.62) v -= (y / 64) * 30;            // rain streaks
    if (y === 31) v -= 30;                                       // panel seam
    return gray(v);
  }, (g) => {
    g.strokeStyle = css(60); g.lineWidth = 1;                    // a crack
    g.beginPath(); g.moveTo(40, 0); g.lineTo(37, 10); g.lineTo(42, 18); g.lineTo(38, 27); g.stroke();
  });

  W.metal = makeTex(T, T, (x, y) => {
    let v = 82 + Math.sin(x * 0.8) * 22 + rand() * 8 + noise(x, y, 4, 8) * 16;
    if ((y === 3 || y === 60) && x % 8 === 4) v = 175;            // rivets
    if (y === 0 || y === 63) v = 30;
    return gray(v);
  });

  W.fence = makeTex(T, T, (x, y) => {
    const p = Math.floor(x / 10), ix = x % 10;
    if (ix === 0) return gray(12);                               // gaps between boards
    let v = 74 + hash(p, 3, 21) * 26 + Math.sin(y * 0.4 + p * 3) * 6 + rand() * 10;
    if ((y > 14 && y < 19) || (y > 44 && y < 49)) v += 18;       // cross rails
    if (y < 3 + hash(p, 4, 21) * 4) return gray(14);             // uneven tops
    return gray(v);
  });
  return W;
}

// ---- floors and ceilings --------------------------------------------------
function buildFloors() {
  const F = {};
  F.asphalt = makeTex(T, T, (x, y) => {
    let v = 36 + noise(x, y, 8, 11) * 18 + rand() * 14;
    if (noise(x, y, 4, 12) > 0.66) v += 28 + noise(x, y, 16, 13) * 22; // wet puddle shine
    return gray(v);
  });
  F.sidewalk = makeTex(T, T, (x, y) => {
    if (x % 32 === 0 || y % 32 === 0) return gray(32);
    const slab = hash(x >> 5, y >> 5, 14);
    return gray(88 + slab * 16 + noise(x, y, 8, 15) * 14 + rand() * 10);
  });
  F.cobble = makeTex(T, T, (x, y) => {
    const row = y >> 3, off = (row & 1) * 4;
    const cx = ((x + off) & 63) >> 3;
    const dx = ((x + off) & 7) - 3.5, dy = (y & 7) - 3.5;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 3.7) return gray(22);
    return gray(70 + hash(cx, row, 16) * 26 - d * 4 + rand() * 8 + (dy < -1 ? 10 : 0));
  });
  F.woodfloor = makeTex(T, T, (x, y) => {
    const plank = y >> 3;
    if ((y & 7) === 0) return gray(20);
    if (((x + Math.floor(hash(plank, 0, 17) * 64)) & 31) === 0) return gray(24);
    const base = 56 + hash(plank, 1, 17) * 22;
    return gray(base + Math.sin(x * 0.3 + plank * 5 + noise(x, y, 4, 18) * 5) * 6 + rand() * 8);
  });
  F.concretefloor = makeTex(T, T, (x, y) => {
    let v = 82 + noise(x, y, 4, 19) * 26 + rand() * 12;
    if (noise(x, y, 8, 20) > 0.72) v -= 26;                      // oil stains
    return gray(v);
  });
  F.beams = makeTex(T, T, (x, y) => {
    if ((x & 31) < 7) return gray(((x & 31) === 0 ? 50 : 24) + rand() * 6);
    return gray(38 + noise(x, y, 8, 22) * 12 + rand() * 6);
  });
  F.ceilconcrete = makeTex(T, T, (x, y) => {
    if (x === 0 || y === 0) return gray(30);
    return gray(58 + noise(x, y, 4, 23) * 16 + rand() * 8);
  });
  return F;
}

// The night sky: one wide picture that wraps all the way round.
function buildSky(w = 512, h = 160) {
  const data = new Uint32Array(w * h);
  const mx = 360, my = 42;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = y / h;
      let v = 6 + t * t * 38;
      const c = noise(x, y * 3, 12, 31, w) * 0.7 + noise(x, y * 3, 32, 32, w) * 0.3;
      v += Math.max(0, c - 0.45) * 70 * (0.5 + t);
      const d = Math.hypot(x - mx, y - my);
      if (d < 11) v = 225 + noise(x, y, 16, 33, w) * 25 - (d > 9.5 ? 40 : 0);
      else v += 55 / (1 + (d - 11) * 0.12) * (1 - Math.max(0, c - 0.4));
      if (v < 30 && hash(x, y, 34) > 0.9985) v = 150;            // a few stars
      data[y * w + x] = gray(v);
    }
  }
  return { w, h, data };
}

// ---- people ---------------------------------------------------------------
// The gang. `look` says what they wear; `pose` is one animation frame.
export const POSES = ['stand', 'walk1', 'walk2', 'aim', 'shoot', 'hurt', 'die1', 'die2', 'dead'];

export const LOOKS = {
  thugA: { coat: 46, shirt: 220, tie: 14, hat: 'fedora', hatShade: 22, band: 120, skin: 188, weapon: 'pistol' },
  thugB: { coat: 92, shirt: 200, tie: 30, hat: 'fedora', hatShade: 58, band: 25, skin: 176, weapon: 'pistol' },
  heavy: { coat: 66, shirt: 150, tie: 150, hat: 'cap', hatShade: 38, skin: 168, weapon: 'tommy', wide: 3 },
  boss:  { coat: 215, trousers: 198, shirt: 24, tie: 235, hat: 'fedora', hatShade: 230, band: 18, skin: 192, weapon: 'tommy', wide: 2, cigar: true },
};

function poly(g, pts) {
  g.beginPath(); g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath(); g.fill();
}
function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
function ellipse(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); }

function drawBody(g, o, pose) {
  const wide = o.wide || 0, coat = o.coat, dark = Math.max(0, coat - 24);
  const walk = pose === 'walk1' ? 1 : pose === 'walk2' ? -1 : 0;
  const aim = pose === 'aim' || pose === 'shoot';
  const L = 32 - 10 - wide, R = 32 + 10 + wide;               // shoulders

  // legs and shoes
  g.fillStyle = css(o.trousers ?? dark);
  const leg = (hx, fx) => poly(g, [hx - 3, 46, hx + 3, 46, fx + 2.5, 62, fx - 2.5, 62]);
  leg(28, 27 - walk * 3); leg(36, 37 + walk * 3);
  g.fillStyle = css(10);
  ellipse(g, 27 - walk * 3, 62, 3.6, 1.6); ellipse(g, 37 + walk * 3, 62, 3.6, 1.6);

  // long coat
  g.fillStyle = css(coat);
  poly(g, [L, 19, R, 19, R + 2, 50, L - 2, 50]);
  g.fillStyle = css(dark);
  g.fillRect(31.5, 30, 1, 20);                                // coat opening
  g.fillRect(L - 1, 34, R - L + 2, 2);                        // belt
  // shirt, tie and lapels
  g.fillStyle = css(o.shirt); poly(g, [27.5, 19, 36.5, 19, 32, 30]);
  g.fillStyle = css(o.tie); poly(g, [31, 20, 33, 20, 33.5, 28, 32, 30.5, 30.5, 28]);
  g.fillStyle = css(Math.min(255, coat + 25));
  poly(g, [27.5, 19, 29, 19, 31.5, 30, 30.5, 30]); poly(g, [36.5, 19, 35, 19, 32.5, 30, 33.5, 30]);

  // arms and the gun
  if (!aim) {
    const swing = walk * 2;
    g.fillStyle = css(coat);
    poly(g, [L, 19, L + 4, 20, L + 2, 41 + swing, L - 3, 41 + swing]);
    poly(g, [R, 19, R - 4, 20, R - 2, 41 - swing, R + 3, 41 - swing]);
    g.fillStyle = css(o.skin);
    circle(g, L - 0.5, 42.5 + swing, 2.3); circle(g, R + 0.5, 42.5 - swing, 2.3);
    g.fillStyle = css(20);
    if (o.weapon === 'pistol') {
      g.fillRect(L - 2, 42 + swing, 3, 4); g.fillRect(L - 1.5, 45 + swing, 2, 5);
    } else {
      g.strokeStyle = css(24); g.lineWidth = 3.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(L - 1, 44); g.lineTo(R + 3, 30); g.stroke();
      g.fillStyle = css(38); circle(g, 31, 38, 4.2);           // drum magazine
      g.fillStyle = css(70); circle(g, 31, 38, 1.5);
    }
  } else {
    // both arms forward, gun pointing straight at you
    g.fillStyle = css(coat);
    poly(g, [L, 19, L + 5, 20, 31, 27, 30, 31, L - 1, 27]);
    poly(g, [R, 19, R - 5, 20, 33, 27, 34, 31, R + 1, 27]);
    g.fillStyle = css(o.skin); circle(g, 32, 29, 3.4);
    if (o.weapon === 'pistol') {
      g.fillStyle = css(26); g.fillRect(29, 23.5, 6, 5);
      g.fillStyle = css(4); circle(g, 32, 25.5, 1.8);
    } else {
      g.fillStyle = css(30); g.fillRect(25, 22, 14, 7);
      g.fillStyle = css(42); circle(g, 32, 32, 4.4);
      g.fillStyle = css(4); circle(g, 32, 24.5, 2.2);
    }
  }

  // head
  g.fillStyle = css(o.skin - 35); g.fillRect(29.5, 15, 5, 5);  // neck
  g.fillStyle = css(o.skin); ellipse(g, 32, 12, 5, 6);
  g.fillStyle = css(o.skin - 95); g.fillRect(27, 8, 10, 3.5);  // shadow under the hat brim
  g.fillStyle = css(14); g.fillRect(29.5, 11, 1.5, 1); g.fillRect(33, 11, 1.5, 1);
  g.fillStyle = css(o.skin - 80); g.fillRect(30.5, 15.5, 3, 1);
  if (o.cigar) { g.fillStyle = css(210); g.fillRect(34, 15, 4, 1.2); g.fillStyle = css(250); g.fillRect(38, 15, 1, 1.2); }

  // hat
  g.fillStyle = css(o.hatShade);
  if (o.hat === 'fedora') {
    poly(g, [26, 8, 27, 2, 37, 2, 38, 8]);
    ellipse(g, 32, 8.5, 10.5, 2.2);
    g.fillStyle = css(o.band); g.fillRect(26.4, 5.6, 11.2, 2);
    g.fillStyle = css(Math.max(0, o.hatShade - 15)); g.fillRect(31.5, 2, 1, 3); // crown dent
  } else {
    ellipse(g, 32, 6.5, 6.5, 3.8);
    ellipse(g, 32, 8.8, 7.5, 1.7);
  }
}

// Blood on a hurt or dying gangster.
function drawWounds(g, pose) {
  g.fillStyle = RED;
  circle(g, 30.5, 25, 2.4); circle(g, 34.5, 28, 1.7);
  g.fillRect(30, 25, 1.4, 6);
  if (pose !== 'hurt') {
    g.fillStyle = DARKRED;
    circle(g, 32, 31, 3.6); circle(g, 28, 36, 2.2); circle(g, 36, 22, 1.6);
    g.fillRect(31, 31, 2, 9);
  }
}

function person(look, pose) {
  const glows = pose === 'shoot' ? [[14, 8, 50, 42, 200]] : null;
  return makeTex(64, 64, null, (g) => {
    g.save();
    if (pose === 'dead') g.setTransform(0, 0.42, 1, 0, 0, 56 - 32 * 0.42); // lying on the ground
    else if (pose === 'hurt') { g.translate(32, 63); g.rotate(-0.13); g.translate(-32, -63); }
    else if (pose === 'die1') { g.translate(32, 63); g.rotate(0.32); g.translate(-32, -63); }
    else if (pose === 'die2') { g.translate(14, 63); g.rotate(1.1); g.scale(0.85, 0.85); g.translate(-32, -63); }
    drawBody(g, look, pose);
    if (pose === 'hurt' || pose === 'die1' || pose === 'die2' || pose === 'dead') drawWounds(g, pose);
    g.restore();
    if (pose === 'shoot') {
      // muzzle flash: a white star
      const y = look.weapon === 'pistol' ? 25.5 : 24.5;
      g.fillStyle = css(250);
      const pts = [];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2, r = i % 2 ? 4 : 11 + (i % 4) * 2;
        pts.push(32 + Math.cos(a) * r, y + Math.sin(a) * r * 0.8);
      }
      poly(g, pts);
      g.fillStyle = css(255); circle(g, 32, y, 4);
    }
  }, glows);
}

// ---- props ----------------------------------------------------------------
function buildProps() {
  const P = {};
  P.lamp = makeTex(32, 96, null, (g) => {
    g.fillStyle = css(42);
    g.fillRect(15, 18, 3, 76);                                  // pole
    g.fillRect(12, 86, 9, 10);                                  // base
    g.fillRect(10, 14, 13, 4);                                  // cap
    g.fillStyle = css(58); poly(g, [9, 17, 24, 17, 21, 27, 12, 27]);
    g.fillStyle = css(245); poly(g, [12, 19, 21, 19, 19.5, 26, 13.5, 26]); // the glass
    g.fillStyle = css(30); g.fillRect(16, 7, 1, 7);             // finial
  }, [[11, 18, 22, 27, 200]]);
  P.bulb = makeTex(16, 32, null, (g) => {
    g.fillStyle = css(30); g.fillRect(7.5, 0, 1, 21);
    g.fillStyle = css(55); g.fillRect(6, 20, 4, 4);
    g.fillStyle = css(250); circle(g, 8, 27, 4);
  }, [[0, 22, 16, 32, 200]]);
  P.barrel = makeTex(32, 40, null, (g) => {
    g.fillStyle = css(62); g.fillRect(3, 5, 26, 33);
    g.fillStyle = css(92); g.fillRect(8, 5, 5, 33);             // shine
    g.fillStyle = css(38); g.fillRect(3, 14, 26, 2); g.fillRect(3, 28, 26, 2);
    g.fillStyle = css(50); ellipse(g, 16, 5, 13, 3);
    g.fillStyle = css(28); ellipse(g, 16, 5, 10, 2);
    g.fillStyle = css(48); ellipse(g, 16, 38, 13, 2);
  });
  P.crate = makeTex(40, 40, null, (g) => {
    g.fillStyle = css(88); g.fillRect(1, 2, 38, 38);
    g.fillStyle = css(60);
    for (let y = 10; y < 40; y += 9) g.fillRect(1, y, 38, 1);
    g.fillStyle = css(110); g.fillRect(1, 2, 38, 3); g.fillRect(1, 2, 3, 38); g.fillRect(36, 2, 3, 38);
    g.strokeStyle = css(110); g.lineWidth = 3;
    g.beginPath(); g.moveTo(4, 38); g.lineTo(36, 5); g.stroke();
    g.fillStyle = css(40); g.font = 'bold 7px Arial'; g.fillText('DOCKS', 9, 31);
  });
  P.trash = makeTex(32, 40, null, (g) => {
    g.fillStyle = css(96); poly(g, [5, 9, 27, 9, 25, 39, 7, 39]);
    g.fillStyle = css(70); for (let x = 9; x < 25; x += 4) g.fillRect(x, 11, 1.5, 27);
    g.fillStyle = css(120); ellipse(g, 16, 8, 13, 3);
    g.fillStyle = css(60); g.fillRect(14, 2, 4, 4);
    g.fillStyle = css(200); poly(g, [8, 7, 13, 1, 15, 6]);      // old newspaper sticking out
  });
  P.ammo = makeTex(24, 16, null, (g) => {
    g.fillStyle = css(190);
    for (let i = 0; i < 5; i++) { g.fillRect(4 + i * 3.4, 1, 2.2, 6); }
    g.fillStyle = css(58); g.fillRect(2, 6, 20, 10);
    g.fillStyle = css(170); g.fillRect(5, 9, 14, 4);
    g.fillStyle = css(30); g.font = 'bold 4px Arial'; g.fillText('.38', 8, 12.5);
  });
  P.health = makeTex(24, 20, null, (g) => {
    g.fillStyle = css(64); g.fillRect(1, 4, 22, 16);
    g.fillStyle = css(90); g.fillRect(1, 4, 22, 3);
    g.fillStyle = css(235); g.fillRect(10, 8, 4, 10); g.fillRect(7, 11, 10, 4);
    g.fillStyle = css(40); g.fillRect(8, 1, 8, 3);
  });
  P.drop = makeTex(4, 4, null, (g) => { g.fillStyle = RED; circle(g, 2, 2, 2); });
  P.dust = makeTex(4, 4, null, (g) => { g.fillStyle = css(150); circle(g, 2, 2, 2); });
  return P;
}

// ---- the revolver ---------------------------------------------------------
// Drawn once on its own canvas, seen from just behind your right hand.
function buildGun() {
  const c = newCanvas(200, 150), g = c.getContext('2d');
  // coat sleeve and shirt cuff
  g.fillStyle = css(30); poly(g, [168, 108, 200, 96, 200, 150, 150, 150]);
  g.fillStyle = css(225); poly(g, [150, 122, 176, 110, 186, 132, 160, 146]);
  // barrel
  g.fillStyle = css(92); poly(g, [98, 55, 30, 31, 25, 42, 98, 71]);
  g.fillStyle = css(165); poly(g, [98, 55, 30, 31, 30, 34, 98, 59]); // shine on top
  g.fillStyle = css(60); poly(g, [92, 70, 44, 52, 42, 56, 92, 74]);   // ejector rod
  g.fillStyle = css(40); g.fillRect(31, 27, 4, 5);                     // front sight
  g.fillStyle = css(12); ellipse(g, 27, 37, 2.5, 5);                   // muzzle
  // cylinder
  g.save(); g.translate(108, 68); g.rotate(-0.33);
  g.fillStyle = css(118); g.fillRect(-18, -14, 36, 28);
  g.fillStyle = css(78); for (let y = -10; y <= 10; y += 7) g.fillRect(-16, y, 32, 2.5);
  g.fillStyle = css(175); g.fillRect(-18, -14, 36, 3);
  g.restore();
  // frame, hammer and trigger guard
  g.fillStyle = css(84); poly(g, [104, 52, 140, 58, 146, 86, 112, 92, 100, 84]);
  g.fillStyle = css(140); poly(g, [104, 52, 140, 58, 140, 61, 104, 55]);
  g.fillStyle = css(46); poly(g, [137, 50, 151, 42, 155, 50, 143, 59]);
  g.strokeStyle = css(70); g.lineWidth = 3;
  g.beginPath(); g.arc(120, 96, 10, 0.1, Math.PI * 0.95); g.stroke();
  // wooden grip with checkering
  g.fillStyle = css(52); poly(g, [130, 80, 152, 77, 170, 128, 142, 140]);
  g.strokeStyle = css(36); g.lineWidth = 1;
  for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(136 + i * 4, 86); g.lineTo(148 + i * 4, 132); g.stroke(); }
  // the hand wrapped round the grip
  g.fillStyle = css(172); poly(g, [118, 92, 148, 84, 166, 118, 150, 136, 120, 120]);
  g.fillStyle = css(140);
  for (let i = 0; i < 3; i++) g.fillRect(122 + i * 2, 99 + i * 8, 26, 1.5);  // finger lines
  g.fillStyle = css(185); poly(g, [138, 64, 162, 72, 156, 86, 136, 78]);      // thumb
  g.fillStyle = css(155); poly(g, [104, 96, 120, 92, 122, 100, 106, 102]);   // trigger finger

  // muzzle flash, drawn at the barrel tip when you fire
  const f = newCanvas(96, 96), fg = f.getContext('2d');
  const grad = fg.createRadialGradient(48, 48, 2, 48, 48, 46);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(235,235,235,0.85)');
  grad.addColorStop(1, 'rgba(200,200,200,0)');
  fg.fillStyle = grad;
  const pts = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2, r = i % 2 ? 12 : 30 + (i % 3) * 8;
    pts.push(48 + Math.cos(a) * r, 48 + Math.sin(a) * r);
  }
  poly(fg, pts);
  return { img: c, flash: f, sights: buildSights(), w: 200, h: 150, tipX: 26, tipY: 37, pivotX: 150, pivotY: 110 };
}

// The revolver held up in both hands, seen from right behind it: you look
// through the notch in the back and line the front sight up with your target.
// The tip of the front sight is at (100, 6): that point goes in the middle of the screen.
function buildSights() {
  const c = newCanvas(200, 140), g = c.getContext('2d');
  // coat sleeves coming in from the bottom corners
  g.fillStyle = css(28);
  poly(g, [0, 140, 0, 112, 46, 118, 70, 140]);
  poly(g, [200, 140, 200, 112, 154, 118, 130, 140]);
  g.fillStyle = css(220);                                        // shirt cuffs
  poly(g, [40, 140, 50, 116, 66, 120, 62, 140]);
  poly(g, [160, 140, 150, 116, 134, 120, 138, 140]);
  // barrel rib running away from you to the front sight
  // (kept slim so you can still see who you're aiming at)
  g.fillStyle = css(88); poly(g, [94, 72, 106, 72, 101.8, 14, 98.2, 14]);
  g.fillStyle = css(150); poly(g, [99.2, 72, 100.8, 72, 100.3, 14, 99.7, 14]); // shine along the top
  g.fillStyle = css(58); poly(g, [94, 72, 96, 72, 98.6, 14, 98.2, 14]);
  // front sight blade
  g.fillStyle = css(24); g.fillRect(98.8, 6, 2.4, 9);
  g.fillStyle = css(200); g.fillRect(99.4, 6, 1.2, 1.2);        // a tiny bright dot on top
  // cylinder bulging out each side
  g.fillStyle = css(112); ellipse(g, 100, 94, 34, 13);
  g.fillStyle = css(76);
  for (let i = -2; i <= 2; i++) g.fillRect(100 + i * 12 - 1, 84, 2.5, 20);
  g.fillStyle = css(160); ellipse(g, 100, 86, 28, 3);
  // back of the frame with the rear sight notch
  g.fillStyle = css(72); poly(g, [84, 70, 116, 70, 120, 86, 80, 86]);
  g.fillStyle = css(130); g.fillRect(84, 70, 32, 2);
  g.fillStyle = css(10); poly(g, [96, 70, 104, 70, 102.5, 78, 97.5, 78]); // the notch
  // hammer
  g.fillStyle = css(42); poly(g, [92, 84, 108, 84, 106, 96, 94, 96]);
  g.fillStyle = css(80); g.fillRect(94, 86, 12, 1.5); g.fillRect(94, 89, 12, 1.5);
  // grip and two hands wrapped round it
  g.fillStyle = css(50); poly(g, [80, 100, 120, 100, 124, 140, 76, 140]);
  g.fillStyle = css(170);
  poly(g, [52, 104, 84, 98, 92, 112, 86, 140, 56, 140, 46, 120]);   // left hand
  poly(g, [148, 104, 116, 98, 108, 112, 114, 140, 144, 140, 154, 120]); // right hand
  g.fillStyle = css(185);
  poly(g, [70, 98, 98, 102, 96, 110, 68, 108]);                 // thumbs crossed over the back
  poly(g, [130, 98, 102, 104, 104, 111, 132, 107]);
  g.fillStyle = css(140);
  for (let i = 0; i < 3; i++) { g.fillRect(56, 116 + i * 7, 26, 1.5); g.fillRect(118, 116 + i * 7, 26, 1.5); }
  return c;
}

// ---- splats and holes (painted onto wall and floor textures) --------------
function put(tex, x, y, col) {
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= tex.w || y >= tex.h) return;
  tex.data[y * tex.w + x] = col;
}

// A spray of blood on a wall at texture pixel (u, v), with drips running down.
export function splatter(tex, u, v, size) {
  const drops = (size * size * 0.8 + 8) | 0;
  for (let i = 0; i < drops; i++) {
    const a = rand() * Math.PI * 2, r = size * Math.sqrt(rand());
    const x = u + Math.cos(a) * r * 1.3, y = v + Math.sin(a) * r;
    const col = bloodColor(rand() * 0.6);
    put(tex, x, y, col);
    if (r < size * 0.5) { put(tex, x + 1, y, col); put(tex, x, y + 1, col); }
  }
  const drips = 1 + ((rand() * size * 0.4) | 0);
  for (let k = 0; k < drips; k++) {
    const x = u + (rand() - 0.5) * size * 1.2, len = 3 + rand() * size * 1.4;
    for (let y = 0; y < len; y++) put(tex, x, v + y, bloodColor(0.4));
  }
}

// A bullet hole: dark middle, chipped lighter edge.
export function bulletHole(tex, u, v) {
  for (let i = 0; i < 7; i++) {
    const a = rand() * Math.PI * 2;
    const c = tex.data[(v | 0) * tex.w + (u | 0)] || gray(100);
    put(tex, u + Math.cos(a) * 1.6, v + Math.sin(a) * 1.6, gray(Math.min(255, (c & 255) + 40)));
  }
  put(tex, u, v, gray(8)); put(tex, u + 1, v, gray(18)); put(tex, u, v + 1, gray(18));
}

// ---- everything together --------------------------------------------------
export function buildArt() {
  const people = {};
  for (const name in LOOKS) {
    people[name] = {};
    for (const pose of POSES) people[name][pose] = person(LOOKS[name], pose);
  }
  return { walls: buildWalls(), floors: buildFloors(), sky: buildSky(), props: buildProps(), people, gun: buildGun() };
}
