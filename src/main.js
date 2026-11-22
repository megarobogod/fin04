// main.js - starts the game and runs it: loads levels, handles the keyboard
// and mouse, shooting, blood, pickups, and the screens between levels.

import { LEVELS, THINGS } from './levels.js';
import { buildArt, rand } from './textures.js';
import { World } from './world.js';
import { Renderer } from './render.js';
import { Player, PLAYER } from './player.js';
import { Enemy, updateEnemies } from './enemies.js';
import * as sfx from './audio.js';

// ---- tuning numbers ----
const PROPS = {
  lamp:   { h: 1.45, solid: 0.12, light: { power: 1.15, radius: 5.5 } },
  bulb:   { h: 0.32, z: 0.66, light: { power: 1.15, radius: 5.8 } },
  barrel: { h: 0.55, solid: 0.3 },
  crate:  { h: 0.6, solid: 0.34 },
  trash:  { h: 0.5, solid: 0.26 },
};
const WINDOW_LIGHT = { power: 0.4, radius: 2.8 };   // lit windows and the bar sign
const AMMO_BOX = 12, AMMO_DROP = [3, 6], HEALTH_TIN = 30;
const WAKE_ON_SHOT = 13, WAKE_ON_SHOT_BLIND = 8;      // gunshots wake gang members this far away
const GRAVITY = 5;

const TEST = location.hash.includes('test');
const canvas = document.getElementById('screen');
const overlay = document.getElementById('overlay');
const hud = document.getElementById('hud');
const $ = (id) => document.getElementById(id);

class Game {
  constructor() {
    this.art = buildArt();
    this.renderer = new Renderer(canvas, this.art);
    this.state = 'title';
    this.levelIndex = 0;
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.firePressed = false;
    this.reloadPressed = false;
    this.freeze = false;
    this.hurtFlash = 0;
    this.sprites = [];
    this.hudCache = {};
    this.last = performance.now();
  }

  // ---- levels ----
  load(i) {
    this.levelIndex = i;
    const level = (this.level = LEVELS[i]);
    const world = (this.world = new World(level, this.art));
    this.enemies = []; this.props = []; this.pickups = []; this.particles = [];
    const lights = [];
    for (const t of world.things) {
      const kind = THINGS[t.ch];
      if (kind === 'player') this.player = new Player(t.x, t.y, level.angle);
      else if (kind === 'thug' || kind === 'heavy' || kind === 'boss') this.enemies.push(new Enemy(kind, t.x, t.y));
      else if (kind === 'ammo' || kind === 'health') this.pickups.push({ kind, x: t.x, y: t.y, amount: kind === 'ammo' ? AMMO_BOX : HEALTH_TIN });
      else if (PROPS[kind]) {
        const def = PROPS[kind];
        this.props.push({ kind, x: t.x, y: t.y, h: def.h, z: def.z || 0, solid: def.solid || 0, tex: this.art.props[kind] });
        if (def.light) lights.push({ x: t.x, y: t.y, ...def.light });
      }
    }
    // lit windows throw a little light onto the street in front of them
    for (let y = 0; y < world.h; y++) {
      for (let x = 0; x < world.w; x++) {
        const name = world.wallName[y * world.w + x];
        if (name !== 'window' && name !== 'bar') continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (!world.solidCell(x + dx, y + dy)) lights.push({ x: x + 0.5 + dx * 0.85, y: y + 0.5 + dy * 0.85, ...WINDOW_LIGHT });
        }
      }
    }
    world.buildLight(lights, level.ambient);
    this.flowCell = -1;
    this.flow = new Int16Array(world.w * world.h);
    this.blocked = new Uint8Array(world.w * world.h);
    for (const p of this.props) if (p.solid) this.blocked[Math.floor(p.y) * world.w + Math.floor(p.x)] = 1;
    this.time = 0;
    this.clearT = -1;
    this.hurtFlash = 0;
    this.lightningT = 6 + Math.random() * 10;
    this.message('');
  }

  // Start a level straight away (used by test mode and "try again").
  start(i) {
    this.load(i);
    this.state = 'play';
    this.showOverlay(null);
  }

  // ---- the main loop ----
  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.state === 'play' && !this.freeze) this.update(dt);
    if (this.world) this.draw(this.state === 'play' && !this.freeze ? dt : 0);
    requestAnimationFrame((t) => this.frame(t));
  }

  // Simulate forward without waiting for the screen (handy for testing).
  run(seconds, dt = 1 / 60) {
    for (let t = 0; t < seconds; t += dt) if (this.state === 'play') this.update(dt);
    this.draw(dt);
    return { hp: this.player.hp, alive: this.enemies.filter((e) => !e.dead).length, state: this.state };
  }

  update(dt) {
    this.time += dt;
    const world = this.world;
    this.player.update(dt, this);
    this.updateFlow();
    updateEnemies(this, dt);
    this.updateParticles(dt);
    this.updatePickups();
    world.flash = Math.max(0, world.flash - dt * 4);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.6);

    if (this.level.lightning) {
      this.lightningT -= dt;
      if (this.lightningT <= 0) {
        this.lightningT = 12 + Math.random() * 18;
        world.flash = 1.3;
        setTimeout(() => { if (this.world === world) world.flash = 1.0; }, 140);
        sfx.thunder();
      }
    }

    // level cleared?
    if (this.clearT < 0 && this.enemies.every((e) => e.dead)) {
      this.clearT = 0;
      const last = this.levelIndex === LEVELS.length - 1;
      this.message(last ? 'THE BOSS IS DEAD' : 'ALL QUIET');
    }
    if (this.clearT >= 0) {
      this.clearT += dt;
      if (this.clearT > 2.8) this.finishLevel();
    }
  }

  // ---- shooting ----
  // (dx, dy) is the direction across the map; `slope` is how much the bullet
  // rises per square (0 = level, from your eye height of 0.5).
  playerShot(dx, dy, slope = 0) {
    const p = this.player, world = this.world;
    const heightAt = (t) => 0.5 + slope * t;
    const wall = world.castRay(p.x, p.y, dx, dy, 40);
    // aiming at the floor (or the ceiling indoors) stops the bullet before the wall
    let end = wall.dist, endsOn = 'wall';
    if (heightAt(end) < 0) { end = -0.5 / slope; endsOn = 'floor'; }
    else if (heightAt(end) > 1) { if (this.level.outdoor) endsOn = 'sky'; else { end = 0.5 / slope; endsOn = 'ceiling'; } }

    let best = null, bestT = end, head = false;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const rx = e.x - p.x, ry = e.y - p.y;
      const t = rx * dx + ry * dy;
      if (t <= 0 || t >= bestT) continue;
      const perp = Math.abs(rx * dy - ry * dx);
      const z = heightAt(t) / e.def.height;   // 0 = his feet, 1 = top of his hat
      if (perp < e.def.radius && z > 0.02 && z < 0.95) {
        best = e; bestT = t;
        head = z > PLAYER.headLine && perp < e.def.radius * 0.5;
      }
    }
    // the bang wakes up the neighbourhood
    for (const e of this.enemies) {
      if (e.dead || e.state !== 'idle') continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < WAKE_ON_SHOT_BLIND || (d < WAKE_ON_SHOT && world.clear(e.x, e.y, p.x, p.y))) e.alert(this);
    }
    if (best) {
      let dmg = PLAYER.damage[0] + Math.random() * (PLAYER.damage[1] - PLAYER.damage[0]);
      if (head) dmg *= PLAYER.headshot;
      if (bestT > 9) dmg *= 0.8;
      p.hits++;
      const killing = best.hp - dmg <= 0;
      const hitZ = heightAt(bestT);
      this.bleed(best, dx, dy, killing ? 26 : 14, hitZ);
      if (head) this.message('HEADSHOT', 0.8);
      // blood sprays onto the wall behind him, at the height the bullet was travelling
      const behind = world.castRay(best.x, best.y, dx, dy, 2.6);
      const splatZ = heightAt(bestT + behind.dist);
      if (behind.cell >= 0 && behind.dist < 2.6 && splatZ > 0 && splatZ < 1) {
        world.splatWall(behind, splatZ, (killing ? 9 : 6) * (1.2 - behind.dist / 2.6));
      }
      sfx.hit();
      if (!killing) sfx.grunt();
      best.hurt(this, dmg);
    } else if (endsOn !== 'sky') {
      const hx = p.x + dx * (end - 0.04), hy = p.y + dy * (end - 0.04);
      if (endsOn === 'wall' && wall.cell >= 0) world.holeWall(wall, heightAt(end));
      if (endsOn === 'floor') world.holeFloor(hx, hy);
      const z = Math.max(0.02, Math.min(0.98, heightAt(end)));
      for (let i = 0; i < 6; i++) this.particles.push({ kind: 'dust', x: hx, y: hy, z, vx: -dx * Math.random() * 1.2 + (Math.random() - 0.5), vy: -dy * Math.random() * 1.2 + (Math.random() - 0.5), vz: Math.random() * 1.2, life: 0.4 + Math.random() * 0.3 });
      if (Math.random() < 0.3) sfx.ricochet();
    }
  }

  bleed(e, dx, dy, n, z = 0.55) {
    for (let i = 0; i < n; i++) {
      const sp = 0.8 + Math.random() * 2.6;
      this.particles.push({
        kind: 'blood', x: e.x, y: e.y, z: z - 0.1 + Math.random() * 0.2,
        vx: dx * sp + (Math.random() - 0.5) * 1.6, vy: dy * sp + (Math.random() - 0.5) * 1.6,
        vz: Math.random() * 1.8, life: 3,
      });
    }
  }

  enemyShot(e, d) {
    const p = this.player;
    sfx.enemyShot(d, e.def.burst > 1);
    let chance = e.def.accuracy * Math.max(0.12, Math.min(1, 1.15 - d / 14));
    if (p.moving) chance *= p.running ? 0.55 : 0.75;
    if (Math.random() < chance) {
      const dmg = e.def.damage[0] + Math.random() * (e.def.damage[1] - e.def.damage[0]);
      p.hp = Math.max(0, p.hp - Math.round(dmg));
      this.hurtFlash = Math.min(1.2, this.hurtFlash + dmg / 22);
      p.angle += (Math.random() - 0.5) * 0.05;     // the hit knocks your aim
      sfx.hurt();
      if (p.hp <= 0) this.die();
    } else if (d < 10 && Math.random() < 0.6) {
      sfx.whiz();
    }
  }

  onEnemyKilled(e) {
    this.player.kills++;
    sfx.fall();
    if (Math.random() < e.def.drop) {
      const a = Math.random() * Math.PI * 2;
      const x = e.x + Math.cos(a) * 0.3, y = e.y + Math.sin(a) * 0.3;
      if (!this.world.solidAt(x, y)) this.pickups.push({ kind: 'ammo', x, y, amount: AMMO_DROP[0] + ((Math.random() * (AMMO_DROP[1] - AMMO_DROP[0] + 1)) | 0) });
    }
  }

  wakeNear(x, y, r) {
    for (const e of this.enemies) {
      if (e.state === 'idle' && Math.hypot(e.x - x, e.y - y) < r) e.alert(this);
    }
  }

  // ---- paths: a map of "steps to the player" from every square ----
  updateFlow() {
    const w = this.world.w, h = this.world.h, p = this.player;
    const pc = Math.floor(p.y) * w + Math.floor(p.x);
    if (pc === this.flowCell) return;
    this.flowCell = pc;
    const flow = this.flow;
    flow.fill(-1);
    const queue = new Int32Array(w * h);
    let head = 0, tail = 0;
    flow[pc] = 0; queue[tail++] = pc;
    while (head < tail) {
      const c = queue[head++], cx = c % w, cy = (c / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (flow[n] >= 0 || this.world.solid[n] || this.blocked[n]) continue;
        flow[n] = flow[c] + 1;
        queue[tail++] = n;
      }
    }
  }

  pathStep(x, y) {
    const w = this.world.w, cx = Math.floor(x), cy = Math.floor(y);
    const here = this.flow[cy * w + cx];
    let best = null, bestV = here < 0 ? 1e9 : here;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const v = this.flow[(cy + dy) * w + cx + dx];
      if (v >= 0 && v < bestV) { bestV = v; best = { x: cx + dx + 0.5, y: cy + dy + 0.5 }; }
    }
    return best;
  }

  pushOutOfProps(ent, r) {
    for (const p of this.props) {
      if (!p.solid) continue;
      const dx = ent.x - p.x, dy = ent.y - p.y, d = Math.hypot(dx, dy), min = r + p.solid;
      if (d < min && d > 0.0001) this.world.move(ent, (dx / d) * (min - d), (dy / d) * (min - d), r);
    }
  }

  // ---- blood drops and dust ----
  updateParticles(dt) {
    const world = this.world;
    const keep = [];
    for (const q of this.particles) {
      q.life -= dt;
      q.vz -= GRAVITY * dt;
      const nx = q.x + q.vx * dt, ny = q.y + q.vy * dt;
      q.z += q.vz * dt;
      if (world.solidAt(nx, ny)) { q.vx *= -0.2; q.vy *= -0.2; } else { q.x = nx; q.y = ny; }
      if (q.z <= 0) {
        if (q.kind === 'blood') world.splatFloor(q.x, q.y, 0.025 + Math.random() * 0.035);
        continue;
      }
      if (q.life > 0) keep.push(q);
    }
    this.particles = keep;
  }

  updatePickups() {
    const p = this.player;
    this.pickups = this.pickups.filter((k) => {
      if (Math.hypot(k.x - p.x, k.y - p.y) > 0.55) return true;
      if (k.kind === 'ammo') {
        if (p.reserve >= PLAYER.maxReserve) return true;
        p.reserve = Math.min(PLAYER.maxReserve, p.reserve + k.amount);
        this.message(`+${k.amount} ROUNDS`, 1.2);
      } else {
        if (p.hp >= PLAYER.maxHp) return true;
        p.hp = Math.min(PLAYER.maxHp, p.hp + k.amount);
        this.message('PATCHED UP', 1.2);
      }
      sfx.pickup();
      return false;
    });
  }

  // ---- win and lose ----
  die() {
    this.state = 'dead';
    this.player.hp = 0;
    sfx.setRain(false);
    if (document.pointerLockElement) document.exitPointerLock();
    setTimeout(() => {
      if (this.state === 'dead') this.showOverlay(`<h2 class="red">YOU'RE DEAD</h2><p>The Vipers got you on ${this.level.name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}.</p><p class="go">Click to try again</p>`);
    }, 1200);
  }

  finishLevel() {
    const p = this.player, last = this.levelIndex === LEVELS.length - 1;
    const acc = p.shots ? Math.round((p.hits / p.shots) * 100) : 0;
    const t = Math.round(this.time);
    const stats = `<p class="stats">Time ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} &nbsp;·&nbsp; Kills ${p.kills} &nbsp;·&nbsp; Accuracy ${acc}%</p>`;
    this.state = last ? 'won' : 'clear';
    sfx.setRain(false);
    if (document.pointerLockElement) document.exitPointerLock();
    if (last) this.showOverlay(`<h2>THE VIPERS ARE FINISHED</h2><p>The rain washes the streets clean. For tonight.</p>${stats}<p class="go">Click to play again</p>`);
    else this.showOverlay(`<h2>${this.level.name} — CLEAR</h2>${stats}<p class="go">Click to go on</p>`);
  }

  // ---- screens ----
  showOverlay(html) {
    if (html) { overlay.innerHTML = html; overlay.hidden = false; }
    else overlay.hidden = true;
    hud.hidden = this.state === 'title' || !this.world;
  }

  showCard() {
    this.state = 'card';
    this.showOverlay(`<p class="small">LEVEL ${this.levelIndex + 1} OF ${LEVELS.length}</p><h2>${this.level.name}</h2><p>${this.level.intro}</p><p class="go">Click to begin</p>`);
  }

  begin() {
    this.state = 'play';
    this.showOverlay(null);
    this.last = performance.now();
    sfx.setRain(this.level.rain);
    if (!TEST) canvas.requestPointerLock?.();
  }

  onClick() {
    sfx.unlock();
    switch (this.state) {
      case 'title': this.load(0); this.showCard(); break;
      case 'card': this.begin(); break;
      case 'paused': this.begin(); break;
      case 'dead': this.load(this.levelIndex); this.begin(); break;
      case 'clear': this.load(this.levelIndex + 1); this.showCard(); break;
      case 'won': this.state = 'title'; this.world = null; showTitle(); break;
      case 'play':
        if (!TEST && document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
        break;
    }
  }

  pause() {
    if (this.state !== 'play') return;
    this.state = 'paused';
    sfx.setRain(false);
    this.showOverlay(`<h2>PAUSED</h2><p class="go">Click to carry on</p>`);
  }

  message(text, time = 2.5) {
    const el = $('msg');
    el.textContent = text;
    clearTimeout(this.msgTimer);
    if (text) this.msgTimer = setTimeout(() => { el.textContent = ''; }, time * 1000);
  }

  // ---- drawing ----
  draw(dt) {
    const art = this.art, s = [];
    for (const p of this.props) s.push({ x: p.x, y: p.y, z: p.z, h: p.h, tex: p.tex });
    for (const k of this.pickups) s.push({ x: k.x, y: k.y, z: 0, h: k.kind === 'ammo' ? 0.16 : 0.2, tex: art.props[k.kind] });
    for (const e of this.enemies) s.push({ x: e.x, y: e.y, z: 0, h: e.def.height, tex: art.people[e.look][e.frame()] });
    for (const q of this.particles) s.push({ x: q.x, y: q.y, z: q.z, h: q.kind === 'blood' ? 0.035 : 0.05, tex: art.props[q.kind === 'blood' ? 'drop' : 'dust'], bright: q.kind === 'blood' ? 1 : undefined });
    this.sprites = s;
    this.renderer.render(this, dt);
    this.updateHud();
  }

  updateHud() {
    const p = this.player, c = this.hudCache;
    const set = (id, v) => { if (c[id] !== v) { c[id] = v; $(id).textContent = v; } };
    set('hp', String(p.hp));
    set('cyl', '●'.repeat(p.loaded) + '○'.repeat(PLAYER.cylinder - p.loaded));
    set('reserve', String(p.reserve));
    set('enemies', String(this.enemies.filter((e) => !e.dead).length));
    const bar = `${p.hp}%`;
    if (c.bar !== bar) { c.bar = bar; $('hpbar').style.width = bar; }
    const low = p.hp <= 30;
    if (c.low !== low) { c.low = low; $('health').classList.toggle('low', low); }
    const rl = p.reloading ? 'RELOADING' : p.loaded === 0 ? (p.reserve ? 'PRESS R' : 'OUT OF AMMO') : '';
    set('reload', rl);
  }
}

// ---- start up ----
const game = new Game();
window.game = game;

function showTitle() {
  game.showOverlay(`<h1>SIX<br>CHAMBERS</h1>
    <p>The Vipers run this town. You've got a revolver, and six rounds at a time.</p>
    <p class="keys">WASD move &nbsp;·&nbsp; Mouse aim (up and down too) &nbsp;·&nbsp; Click shoot<br>R reload &nbsp;·&nbsp; Shift run &nbsp;·&nbsp; Arrow keys turn</p>
    <p class="go">Click to start</p>`);
}

addEventListener('keydown', (e) => {
  game.keys.add(e.code);
  if (e.code === 'Space') game.firePressed = game.state === 'play';
  if (e.code === 'KeyR') game.reloadPressed = game.state === 'play';
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => game.keys.delete(e.code));
addEventListener('blur', () => game.keys.clear());
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas && game.state === 'play') { game.mouseDX += e.movementX; game.mouseDY += e.movementY; }
});
addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  if (game.state === 'play' && (TEST || document.pointerLockElement === canvas)) game.firePressed = true;
});
$('frame').addEventListener('click', () => game.onClick());
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && game.state === 'play' && !TEST) game.pause();
});

if (TEST) game.start(Number(new URLSearchParams(location.search).get('level') || 0));
else showTitle();
requestAnimationFrame((t) => game.frame(t));
