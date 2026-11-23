// render.js - the raycaster. This is how the 3D view is drawn from a flat map.
//
// For every column of pixels on the screen we fire one ray across the map.
// Where it hits a wall, the wall is drawn: tall if the wall is close, short if
// it is far away. Floors and ceilings are drawn row by row, and people and
// props are flat pictures ("sprites") that always face you.
//
// The picture is only 480 x 270 pixels and the browser stretches it up,
// which gives the chunky, old-school look.

import { T, GLOW } from './textures.js';

const RAIN_DROPS = 160;
const GRAIN = 9;               // film grain strength

// Darken or brighten a pixel. s is the brightness, 256 = normal.
// Glowing pixels (alpha 254) are left alone.
function shade(c, s) {
  if ((c >>> 24) === GLOW) return c | 0xFF000000;
  let r = ((c & 255) * s) >> 8, g = (((c >>> 8) & 255) * s) >> 8, b = (((c >>> 16) & 255) * s) >> 8;
  if (r > 255) r = 255;
  if (g > 255) g = 255;
  if (b > 255) b = 255;
  return 0xFF000000 | (b << 16) | (g << 8) | r;
}

// How much light survives the dark at distance d (1 = all of it, 0 = none).
function fogAt(d, fog) {
  const f = 1 - d / fog;
  return f <= 0 ? 0 : f * f * (3 - 2 * f);
}

export class Renderer {
  constructor(canvas, art) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    const W = (this.W = canvas.width), H = (this.H = canvas.height);
    this.art = art;
    this.img = this.ctx.createImageData(W, H);
    this.buf = new Uint32Array(this.img.data.buffer);
    this.zbuf = new Float32Array(W);       // how far away the wall is in each column
    this.plane = W / (2 * H);              // field of view: about 83 degrees
    this.fov = 2 * Math.atan(this.plane);

    // vignette (dark corners) and the red edge used when you get hurt
    this.vig = new Uint16Array(W * H);
    this.edge = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = (x / W - 0.5) * 2, dy = (y / H - 0.5) * 2;
        const d = Math.sqrt(dx * dx * 0.75 + dy * dy);
        this.vig[y * W + x] = Math.max(60, Math.min(256, 256 * (1.18 - 0.42 * d * d))) | 0;
        this.edge[y * W + x] = Math.max(0, Math.min(255, (d - 0.55) * 300)) | 0;
      }
    }
    this.noise = new Int8Array(W * H + 8192);
    for (let i = 0; i < this.noise.length; i++) this.noise[i] = ((Math.random() * 2 - 1) * GRAIN) | 0;

    this.drops = [];
    for (let i = 0; i < RAIN_DROPS; i++) {
      this.drops.push({ x: Math.random() * W, y: Math.random() * H, len: 4 + Math.random() * 8, sp: 280 + Math.random() * 180, a: 0.15 + Math.random() * 0.25 });
    }
    this.lastAngle = 0;
  }

  render(game, dt) {
    const { world, player: cam, level } = game;
    const { W, H, buf, zbuf } = this;
    const fog = level.fog;
    // Looking up and down slides the whole picture up or down ("y-shearing"):
    // the horizon moves, everything else follows it.
    // Aiming down the sights zooms in: everything is drawn `zoom` times bigger
    // (F, the "focal length") and the view gets narrower to match.
    const zoom = cam.zoom || 1;
    const F = H * zoom;
    const horizon = Math.round(H / 2 + F * Math.tan(cam.pitch) + cam.bobY);
    const dirX = Math.cos(cam.angle), dirY = Math.sin(cam.angle);
    const P = this.plane / zoom, plX = -dirY * P, plY = dirX * P;
    const wmap = world.w, hmap = world.h;

    // ---- sky (outdoors) ----
    if (level.outdoor) {
      const sky = this.art.sky;
      for (let x = 0; x < W; x++) {
        const camX = (2 * x) / W - 1;
        let a = cam.angle + Math.atan(camX * P);
        let u = Math.floor((a / (Math.PI * 2)) * sky.w * 2) % sky.w;   // sky repeats twice round
        if (u < 0) u += sky.w;
        for (let y = 0; y <= horizon && y < H; y++) {
          let v = sky.h - 1 - (horizon - y);
          if (v < 0) v = 0;
          buf[y * W + x] = sky.data[v * sky.w + u] | 0xFF000000;
        }
      }
    }

    // ---- floor and ceiling, one row at a time ----
    const rx0 = dirX - plX, ry0 = dirY - plY, rx1 = dirX + plX, ry1 = dirY + plY;
    const posZ = 0.5 * F;
    const floorTex = world.floorTex, ceilTex = world.ceilTex;
    // Rows below the horizon are floor. Rows above it are ceiling where there is
    // a roof; where there is no roof (outdoors) the sky drawn above shows through.
    const sky = level.outdoor;
    const firstRow = ceilTex ? 0 : Math.max(0, horizon + 1);
    for (let y = firstRow; y < H; y++) {
      const row = y * W;
      if (y === horizon) { buf.fill(0xFF000000, row, row + W); continue; }
      const isFloor = y > horizon;
      const tex = isFloor ? floorTex : ceilTex;
      const rowDist = posZ / Math.abs(y - horizon);
      const fogv = fogAt(rowDist, fog) * (isFloor ? 256 : 205);
      if (fogv <= 0) { if (isFloor || !sky) buf.fill(0xFF000000, row, row + W); continue; }
      const stepX = (rowDist * (rx1 - rx0)) / W, stepY = (rowDist * (ry1 - ry0)) / W;
      let fx = cam.x + rowDist * rx0, fy = cam.y + rowDist * ry0;
      for (let x = 0; x < W; x++, fx += stepX, fy += stepY) {
        const cx = Math.floor(fx), cy = Math.floor(fy);
        const t = cx < 0 || cy < 0 || cx >= wmap || cy >= hmap ? null : tex[cy * wmap + cx];
        if (!t) { if (isFloor || !sky) buf[row + x] = 0xFF000000; continue; }
        const ti = (((fy - cy) * T) | 0) * T + (((fx - cx) * T) | 0);
        buf[row + x] = shade(t.data[ti], (world.lightAt(fx, fy) * fogv) | 0);
      }
    }

    // ---- walls, one column at a time ----
    for (let x = 0; x < W; x++) {
      const camX = (2 * x) / W - 1;
      const rdx = dirX + plX * camX, rdy = dirY + plY * camX;
      let mx = Math.floor(cam.x), my = Math.floor(cam.y);
      const ddx = rdx === 0 ? 1e30 : Math.abs(1 / rdx), ddy = rdy === 0 ? 1e30 : Math.abs(1 / rdy);
      const sx = rdx < 0 ? -1 : 1, sy = rdy < 0 ? -1 : 1;
      let tx = rdx < 0 ? (cam.x - mx) * ddx : (mx + 1 - cam.x) * ddx;
      let ty = rdy < 0 ? (cam.y - my) * ddy : (my + 1 - cam.y) * ddy;
      let side = 0, hit = false, steps = 0, door = null;
      while (steps++ < 96) {
        if (tx < ty) { tx += ddx; mx += sx; side = 0; } else { ty += ddy; my += sy; side = 1; }
        if (mx < 0 || my < 0 || mx >= wmap || my >= hmap) break;
        const ci = my * wmap + mx;
        if (world.solid[ci]) { hit = true; break; }
        // a sliding door sits across the middle of its square
        if (world.doorIdx[ci] >= 0 && (door = world.doorHit(ci, cam.x, cam.y, rdx, rdy))) { hit = true; side = door.side; break; }
      }
      const dist = Math.max(0.0001, door ? door.dist : side === 0 ? tx - ddx : ty - ddy);
      zbuf[x] = hit ? dist : 1e9;
      if (!hit) continue;
      const tex = world.wallTex[my * wmap + mx];
      let texX;
      if (door) texX = Math.min(T - 1, (door.u * T) | 0);
      else {
        let wx = side === 0 ? cam.y + dist * rdy : cam.x + dist * rdx;
        wx -= Math.floor(wx);
        texX = (wx * T) | 0;
        if ((side === 0 && rdx < 0) || (side === 1 && rdy > 0)) texX = T - 1 - texX;
      }
      // light just in front of the wall face
      const hx = cam.x + rdx * (dist - 0.03), hy = cam.y + rdy * (dist - 0.03);
      const s = (world.lightAt(hx, hy) * fogAt(dist, fog) * (side ? 200 : 256)) | 0;
      const lineH = F / dist;
      const top = horizon - lineH / 2;
      const y0 = Math.max(0, Math.ceil(top)), y1 = Math.min(H, Math.ceil(horizon + lineH / 2));
      const step = T / lineH;
      let tp = (y0 - top) * step;
      const data = tex.data;
      for (let y = y0; y < y1; y++, tp += step) {
        buf[y * W + x] = shade(data[((tp | 0) & 63) * T + texX], s);
      }
    }

    // ---- sprites, far ones first ----
    const sprites = game.sprites;
    for (const s of sprites) s.d = (s.x - cam.x) * (s.x - cam.x) + (s.y - cam.y) * (s.y - cam.y);
    sprites.sort((a, b) => b.d - a.d);
    const invDet = 1 / (plX * dirY - dirX * plY);
    for (const s of sprites) {
      const rx = s.x - cam.x, ry = s.y - cam.y;
      const tX = invDet * (dirY * rx - dirX * ry);
      const depth = invDet * (-plY * rx + plX * ry);
      if (depth < 0.12) continue;
      const fogv = fogAt(depth, fog);
      if (fogv <= 0) continue;
      const tex = s.tex;
      const screenX = (W / 2) * (1 + tX / depth);
      const scale = F / depth;
      const sh = s.h * scale, sw = (sh * tex.w) / tex.h;
      const bottom = horizon + scale * (0.5 - (s.z || 0));
      const top = bottom - sh, left = screenX - sw / 2;
      const x0 = Math.max(0, Math.floor(left)), x1 = Math.min(W, Math.ceil(left + sw));
      const y0 = Math.max(0, Math.floor(top)), y1 = Math.min(H, Math.ceil(bottom));
      if (x0 >= x1 || y0 >= y1) continue;
      const lv = ((s.bright ?? world.lightAt(s.x, s.y)) * fogv * 256) | 0;
      const data = tex.data, tw = tex.w, th = tex.h;
      for (let x = x0; x < x1; x++) {
        if (depth >= zbuf[x]) continue;
        const u = Math.min(tw - 1, (((x - left) / sw) * tw) | 0);
        for (let y = y0; y < y1; y++) {
          const v = Math.min(th - 1, (((y - top) / sh) * th) | 0);
          const c = data[v * tw + u];
          if ((c >>> 24) < 128) continue;
          buf[y * W + x] = shade(c, lv);
        }
      }
    }

    // ---- rain ----
    if (level.rain && !world.indoors(cam.x, cam.y)) this.drawRain(dt, cam.angle);
    this.lastAngle = cam.angle;

    // ---- film grain, dark corners and red when hurt ----
    const vig = this.vig, edge = this.edge, nz = this.noise;
    const off = (Math.random() * 8192) | 0;
    const hurt = Math.min(1, game.hurtFlash) * 1.2;
    const dead = game.state === 'dead' ? 1 : 0;
    for (let i = 0, n = W * H; i < n; i++) {
      const c = buf[i], v = vig[i], gr = nz[i + off];
      let r = (((c & 255) * v) >> 8) + gr;
      let g = ((((c >>> 8) & 255) * v) >> 8) + gr;
      let b = ((((c >>> 16) & 255) * v) >> 8) + gr;
      if (hurt > 0 || dead) {
        const e = edge[i] * (hurt + dead * 0.8);
        r += (e * 0.55) | 0;
        g -= (e * 0.4) | 0;
        b -= (e * 0.4) | 0;
      }
      if (r < 0) r = 0; else if (r > 255) r = 255;
      if (g < 0) g = 0; else if (g > 255) g = 255;
      if (b < 0) b = 0; else if (b > 255) b = 255;
      buf[i] = 0xFF000000 | (b << 16) | (g << 8) | r;
    }
    this.ctx.putImageData(this.img, 0, 0);

    if (game.state !== 'dead') {
      // Raising the gun: first the hip gun drops away, then the sights come up.
      const p0 = game.player, ads = p0.ads || 0;
      if (ads < 0.5) this.drawGun(game, Math.min(1, ads * 2 + p0.switchPose));
      else this.drawSights(game, ads * 2 - 1);
      if (ads < 0.3) this.drawCrosshair();
    }
  }

  drawRain(dt, angle) {
    const { W, H, buf } = this;
    let turn = angle - this.lastAngle;
    if (turn > Math.PI) turn -= Math.PI * 2;
    if (turn < -Math.PI) turn += Math.PI * 2;
    const shift = (turn * W) / this.fov;
    for (const d of this.drops) {
      d.y += d.sp * dt;
      d.x += d.sp * dt * 0.14 - shift;
      if (d.y > H) { d.y -= H + d.len; d.x = Math.random() * W; }
      if (d.x < 0) d.x += W; else if (d.x >= W) d.x -= W;
      const a = (d.a * 256) | 0;
      for (let k = 0; k < d.len; k++) {
        const px = (d.x + k * 0.14) | 0, py = (d.y + k) | 0;
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        const i = py * W + px, c = buf[i];
        const r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
        buf[i] = 0xFF000000 | ((b + (((185 - b) * a) >> 8)) << 16) | ((g + (((185 - g) * a) >> 8)) << 8) | (r + (((185 - r) * a) >> 8));
      }
    }
  }

  // The revolver held at the hip. `lower` (0..1) drops it out of view.
  drawGun(game, lower = 0) {
    const p = game.player, gun = this.art.guns[p.weapon], ctx = this.ctx;
    const { W, H } = this;
    const bx = Math.sin(p.bobPhase) * 5 * p.bobAmt;
    const by = Math.abs(Math.cos(p.bobPhase)) * 5 * p.bobAmt;
    const x = W / 2 - 28 + bx + p.recoil * 6 + p.reloadPose * 30;
    const y = H - gun.h + 26 + by + p.recoil * 8 + p.reloadPose * 75 + lower * 130;
    ctx.save();
    ctx.translate(x + gun.pivotX, y + gun.pivotY);
    ctx.rotate(p.recoil * 0.32 - p.reloadPose * 0.5);
    ctx.drawImage(gun.img, -gun.pivotX, -gun.pivotY);
    if (p.flashT > 0) {
      ctx.globalCompositeOperation = 'lighter';
      const f = gun.flash, k = 0.8 + Math.random() * 0.5;
      ctx.drawImage(f, gun.tipX - gun.pivotX - (f.width * k) / 2 - 4, gun.tipY - gun.pivotY - (f.height * k) / 2 - 2, f.width * k, f.height * k);
    }
    ctx.restore();
  }

  // Looking down the sights. `raise` (0..1) brings the gun up from below.
  // When fully up, the tip of the front sight sits exactly on the middle of
  // the screen, which is where the bullet goes.
  drawSights(game, raise) {
    const p = game.player, gun = this.art.guns[p.weapon], ctx = this.ctx;
    const s = gun.sights;
    const sway = Math.sin(p.bobPhase) * 2 * p.bobAmt;
    const x = this.W / 2 - 100 + sway;
    const y = this.H / 2 - 6 + (1 - raise) * 140 + p.recoil * 16 + Math.abs(Math.cos(p.bobPhase)) * 2 * p.bobAmt;
    if (p.flashT > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const f = gun.flash, k = 0.9 + Math.random() * 0.5;
      ctx.drawImage(f, x + 100 - (f.width * k) / 2, y + 2 - (f.height * k) / 2, f.width * k, f.height * k);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(x + 100, y + 120);
    ctx.rotate(p.recoil * -0.06);
    ctx.drawImage(s, -100, -120);
    ctx.restore();
  }

  drawCrosshair() {
    const ctx = this.ctx, cx = this.W / 2, cy = this.H / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(cx - 2, cy - 2, 4, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(cx - 1, cy - 1, 2, 2);
  }
}
