// world.js - the level grid: which squares are walls, the textures on every
// wall and floor square, the light, line of sight, and blood painted onto
// walls and floors (each square gets its own copy of a texture the first
// time something is painted on it, so the stain stays where it landed).

import { WALLS } from './levels.js';
import { T, splatter, bulletHole, bloodColor, rand } from './textures.js';

const LIGHT_RES = 4;        // light is stored 4 x 4 times per square, for smooth pools
const LIGHT_MAX = 1.6;      // brightest a spot can get

export class World {
  constructor(level, art) {
    const rows = level.map;
    const w = (this.w = Math.max(...rows.map((r) => r.length)));
    const h = (this.h = rows.length);
    const n = w * h;
    this.solid = new Uint8Array(n);
    this.wallTex = new Array(n).fill(null);
    this.floorTex = new Array(n).fill(null);
    this.ceilTex = level.ceiling ? new Array(n).fill(null) : null;
    this.wallName = new Array(n).fill(null);
    this.ownedWall = new Uint8Array(n);
    this.ownedFloor = new Uint8Array(n);
    this.things = [];
    this.flash = 0;            // extra light everywhere (muzzle flash, lightning)

    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? '#' : rows[y][x] ?? '#');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = at(x, y), i = y * w + x;
        const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
        if (WALLS[ch] || edge) {
          const name = WALLS[ch] || 'brick';
          this.solid[i] = 1;
          this.wallName[i] = name;
          this.wallTex[i] = art.walls[name];
          continue;
        }
        // Floor: '.' or ','. A thing's square uses whichever its neighbours use most.
        let kind = ch;
        if (ch !== '.' && ch !== ',') {
          let commas = 0, dots = 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const c = at(x + dx, y + dy);
            if (c === ',') commas++; else if (c === '.') dots++;
          }
          kind = commas > dots ? ',' : '.';
          this.things.push({ ch, x: x + 0.5, y: y + 0.5 });
        }
        this.floorTex[i] = art.floors[level.floors[kind]];
        if (this.ceilTex) this.ceilTex[i] = art.floors[level.ceiling];
      }
    }
    this.lw = w * LIGHT_RES;
    this.lh = h * LIGHT_RES;
    this.light = new Float32Array(this.lw * this.lh);
  }

  // ---- walls and collisions ----
  solidCell(ix, iy) {
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return true;
    return this.solid[iy * this.w + ix] === 1;
  }
  solidAt(x, y) { return this.solidCell(Math.floor(x), Math.floor(y)); }

  // Would a circle of radius r at (x, y) overlap a wall?
  hitsWall(x, y, r) {
    return this.solidAt(x - r, y - r) || this.solidAt(x + r, y - r) ||
           this.solidAt(x - r, y + r) || this.solidAt(x + r, y + r);
  }

  // Move something by (dx, dy), sliding along walls. Returns true if it was blocked.
  move(ent, dx, dy, r) {
    let blocked = false;
    if (!this.hitsWall(ent.x + dx, ent.y, r)) ent.x += dx; else blocked = true;
    if (!this.hitsWall(ent.x, ent.y + dy, r)) ent.y += dy; else blocked = true;
    return blocked;
  }

  // Is there a clear straight line between two points? (walls only)
  clear(ax, ay, bx, by) {
    let mx = Math.floor(ax), my = Math.floor(ay);
    const ex = Math.floor(bx), ey = Math.floor(by);
    const dx = bx - ax, dy = by - ay;
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
    const ddx = dx === 0 ? 1e30 : Math.abs(1 / dx), ddy = dy === 0 ? 1e30 : Math.abs(1 / dy);
    let tx = dx > 0 ? (mx + 1 - ax) * ddx : (ax - mx) * ddx;
    let ty = dy > 0 ? (my + 1 - ay) * ddy : (ay - my) * ddy;
    let steps = Math.abs(ex - mx) + Math.abs(ey - my);
    while (steps-- > 0) {
      if (tx < ty) { tx += ddx; mx += sx; } else { ty += ddy; my += sy; }
      if (this.solidCell(mx, my)) return false;
    }
    return true;
  }

  // Fire a ray from (x, y) along the unit direction (dx, dy) until it hits a wall.
  // Returns the distance, which square was hit and where across its face (u, 0..1).
  // The u flip matches the renderer, so a splat painted at u shows up where the ray hit.
  castRay(x, y, dx, dy, max = 64) {
    let mx = Math.floor(x), my = Math.floor(y);
    const ddx = dx === 0 ? 1e30 : Math.abs(1 / dx), ddy = dy === 0 ? 1e30 : Math.abs(1 / dy);
    const sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1;
    let tx = dx < 0 ? (x - mx) * ddx : (mx + 1 - x) * ddx;
    let ty = dy < 0 ? (y - my) * ddy : (my + 1 - y) * ddy;
    let side = 0;
    for (;;) {
      if (tx < ty) { tx += ddx; mx += sx; side = 0; } else { ty += ddy; my += sy; side = 1; }
      const dist = side === 0 ? tx - ddx : ty - ddy;
      if (dist > max) return { dist: max, cell: -1 };
      if (this.solidCell(mx, my)) {
        let wx = side === 0 ? y + dist * dy : x + dist * dx;
        wx -= Math.floor(wx);
        let u = wx;
        if ((side === 0 && dx < 0) || (side === 1 && dy > 0)) u = 1 - u;
        const inside = mx >= 0 && my >= 0 && mx < this.w && my < this.h;
        return { dist, cell: inside ? my * this.w + mx : -1, side, u };
      }
    }
  }

  // ---- light ----
  // Bake the light: a dim base (ambient) plus pools of light from each lamp,
  // blocked by walls so shadows fall in the right places.
  buildLight(lights, ambient) {
    const { light, lw, lh } = this;
    light.fill(ambient);
    for (const L of lights) {
      const r = L.radius;
      const x0 = Math.max(0, Math.floor((L.x - r) * LIGHT_RES)), x1 = Math.min(lw - 1, Math.ceil((L.x + r) * LIGHT_RES));
      const y0 = Math.max(0, Math.floor((L.y - r) * LIGHT_RES)), y1 = Math.min(lh - 1, Math.ceil((L.y + r) * LIGHT_RES));
      for (let sy = y0; sy <= y1; sy++) {
        for (let sx = x0; sx <= x1; sx++) {
          const px = (sx + 0.5) / LIGHT_RES, py = (sy + 0.5) / LIGHT_RES;
          const d = Math.hypot(px - L.x, py - L.y);
          if (d >= r || this.solidAt(px, py)) continue;
          if (!this.clear(L.x, L.y, px, py)) continue;
          const f = 1 - d / r;
          light[sy * lw + sx] += L.power * f * f;
        }
      }
    }
    for (let i = 0; i < light.length; i++) if (light[i] > LIGHT_MAX) light[i] = LIGHT_MAX;
  }

  lightAt(x, y) {
    let lx = (x * LIGHT_RES) | 0, ly = (y * LIGHT_RES) | 0;
    if (lx < 0) lx = 0; else if (lx >= this.lw) lx = this.lw - 1;
    if (ly < 0) ly = 0; else if (ly >= this.lh) ly = this.lh - 1;
    return this.light[ly * this.lw + lx] + this.flash;
  }

  // ---- painting blood and bullet holes ----
  ownWall(i) {
    if (!this.ownedWall[i]) {
      const t = this.wallTex[i];
      this.wallTex[i] = { w: t.w, h: t.h, data: new Uint32Array(t.data) };
      this.ownedWall[i] = 1;
    }
    return this.wallTex[i];
  }
  ownFloor(i) {
    if (!this.ownedFloor[i]) {
      const t = this.floorTex[i];
      this.floorTex[i] = { w: t.w, h: t.h, data: new Uint32Array(t.data) };
      this.ownedFloor[i] = 1;
    }
    return this.floorTex[i];
  }

  // height: how high up the wall (0 = floor, 1 = top)
  splatWall(hit, height, size) {
    if (hit.cell < 0) return;
    splatter(this.ownWall(hit.cell), hit.u * T, (1 - height) * T, size);
  }
  holeWall(hit, height) {
    if (hit.cell < 0) return;
    bulletHole(this.ownWall(hit.cell), hit.u * T, (1 - height) * T);
  }

  // A blob of blood on the floor around (x, y), radius r squares.
  // `wobble` makes the edge lumpy; set `dark` for old blood.
  splatFloor(x, y, r, dark = 0) {
    const lobes = 3 + ((rand() * 4) | 0), phase = rand() * 6;
    const cx0 = Math.floor(x - r * 1.3), cx1 = Math.floor(x + r * 1.3);
    const cy0 = Math.floor(y - r * 1.3), cy1 = Math.floor(y + r * 1.3);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        if (this.solidCell(cx, cy)) continue;
        const tex = this.ownFloor(cy * this.w + cx);
        // only the texels this blob can touch
        const tx0 = Math.max(0, Math.floor((x - r * 1.3 - cx) * T)), tx1 = Math.min(T - 1, Math.ceil((x + r * 1.3 - cx) * T));
        const ty0 = Math.max(0, Math.floor((y - r * 1.3 - cy) * T)), ty1 = Math.min(T - 1, Math.ceil((y + r * 1.3 - cy) * T));
        for (let ty = ty0; ty <= ty1; ty++) {
          for (let tx = tx0; tx <= tx1; tx++) {
            const dx = cx + (tx + 0.5) / T - x, dy = cy + (ty + 0.5) / T - y;
            const d = Math.sqrt(dx * dx + dy * dy);
            const edge = r * (0.78 + 0.22 * Math.sin(Math.atan2(dy, dx) * lobes + phase));
            if (d < edge || (d < edge * 1.3 && rand() < 0.12)) tex.data[ty * T + tx] = bloodColor(dark);
          }
        }
      }
    }
  }
}
