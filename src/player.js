// player.js - you: fast movement with momentum, the dash, the kick, and your
// guns (the revolver, and later the shotgun).

import * as sfx from './audio.js';

// ---- tuning numbers ----
export const PLAYER = {
  speed: 6.2,           // top running speed (squares per second)
  accel: 14,            // how quickly you get up to speed
  friction: 11,         // how quickly you stop when you let go
  dashSpeed: 19,        // speed during a dash
  dashTime: 0.16,       // how long a dash lasts (seconds)
  dashCharges: 2,       // dashes you can do back to back
  dashRecharge: 1.1,    // seconds to get one dash charge back
  dashSafe: 0.26,       // bullets can't hurt you for this long after a dash starts
  kickTime: 0.28,       // how long the kick takes
  kickCool: 0.45,       // seconds between kicks
  kickReach: 1.6,       // how far your kick reaches (squares)
  kickDamage: 45,       // and how hard it hits (three times as hard on someone already reeling)
  kickPush: 9,          // how far it sends them flying
  turnKeys: 2.8,        // radians per second with the arrow keys
  mouse: 0.0024,        // radians per pixel of mouse movement
  mouseY: 0.0020,       // same, for looking up and down
  maxPitch: 0.6,        // how far you can look up or down (radians, about 34 degrees)
  radius: 0.24,         // how fat you are (for bumping into walls)
  maxHp: 100,
  cylinder: 6,          // rounds in the revolver
  startReserve: 36,     // spare rounds at the start
  headLine: 0.72,       // the head starts this far up a gang member (0 = feet, 1 = top of hat)
  spread: 0.01,         // aim wobble (radians)
  moveSpread: 0.008,    // a tiny bit more while moving: this game wants you moving
  // aiming down the sights (hold right mouse button)
  adsZoom: 1.5,         // how much it zooms in
  adsSpeed: 0.6,        // you move a bit slower while aiming
  adsSpread: 0.3,       // wobble is cut right down
  adsMouse: 0.6,        // mouse turns slower so you can line up small targets
  adsTime: 0.1,         // seconds to raise the gun (roughly)
};

// ---- the guns ----
// capacity: rounds loaded at once.  pellets: bullets per shot (the shotgun fires a spray).
// damage: per pellet.  cone: how wide the pellets spread.  range: pellets weaken past this.
// shove: how hard firing pushes you back.
export const WEAPONS = {
  revolver: {
    name: 'REVOLVER', capacity: 6, maxReserve: 72, fireDelay: 0.26, openTime: 0.22, roundTime: 0.11,
    damage: [74, 92], pellets: 1, cone: 0, headshot: 2.5, range: 10, recoil: 1, flash: 0.45, shove: 0,
  },
  shotgun: {
    name: 'SHOTGUN', capacity: 2, maxReserve: 30, fireDelay: 0.36, openTime: 0.2, roundTime: 0.28,
    damage: [17, 23], pellets: 10, cone: 0.07, headshot: 1.6, range: 4.5, recoil: 1.8, flash: 0.75, shove: 3.5,
  },
};

export class Player {
  // `kit` carries your guns and ammo from one floor or level to the next
  constructor(x, y, angle, kit) {
    this.x = x; this.y = y; this.angle = angle;
    this.vx = 0; this.vy = 0;    // your momentum
    this.pitch = 0;              // looking up (+) or down (-)
    this.ads = 0;                // 0 = gun at the hip, 1 = looking down the sights
    this.zoom = 1;
    this.hp = PLAYER.maxHp;
    this.guns = kit ? JSON.parse(JSON.stringify(kit.guns)) : { revolver: { loaded: PLAYER.cylinder, reserve: PLAYER.startReserve } };
    this.weapon = kit ? kit.weapon : 'revolver';
    this.cool = 0;               // time until you can fire again
    this.reloading = false;
    this.reloadT = 0;
    this.reloadPose = 0;         // 0 = gun up, 1 = gun lowered for reloading
    this.switchPose = 0;         // lowers the gun while you swap weapons or kick
    this.switchT = 0;
    this.dashT = 0;              // > 0 while dashing
    this.dashDX = 0; this.dashDY = 0;
    this.dashes = PLAYER.dashCharges;
    this.safeT = 0;              // > 0: bullets pass you by
    this.kickT = 0;              // > 0 while kicking
    this.kickCool = 0;
    this.recoil = 0;
    this.flashT = 0;
    this.bobPhase = 0; this.bobAmt = 0; this.bobY = 0;
    this.moving = false; this.running = false;
    this.shots = 0; this.hits = 0; this.kills = 0;
  }

  // the gun in your hand, and its ammo
  get gun() { return WEAPONS[this.weapon]; }
  get loaded() { return this.guns[this.weapon].loaded; }
  set loaded(v) { this.guns[this.weapon].loaded = v; }
  get reserve() { return this.guns[this.weapon].reserve; }
  set reserve(v) { this.guns[this.weapon].reserve = v; }
  has(name) { return !!this.guns[name]; }
  get dashing() { return this.dashT > 0; }

  give(name, loaded, reserve) {
    if (!this.guns[name]) this.guns[name] = { loaded, reserve };
  }

  switchTo(name) {
    if (!this.guns[name] || name === this.weapon || this.switchT > 0) return;
    this.reloading = false;
    this.weapon = name;
    this.switchT = 0.3;
    this.cool = Math.max(this.cool, 0.25);
    sfx.click();
  }

  update(dt, game) {
    const k = game.keys;
    // aiming down the sights: eases up while the right button is held (not while reloading)
    const wantAds = game.adsHeld && !this.reloading && this.switchT <= 0 ? 1 : 0;
    this.ads += (wantAds - this.ads) * Math.min(1, dt / PLAYER.adsTime);
    if (Math.abs(wantAds - this.ads) < 0.01) this.ads = wantAds;
    this.zoom = 1 + (PLAYER.adsZoom - 1) * this.ads;
    const sens = 1 - (1 - PLAYER.adsMouse) * this.ads;
    // turning
    let turn = 0;
    if (k.has('ArrowLeft') || k.has('KeyQ')) turn -= 1;
    if (k.has('ArrowRight') || k.has('KeyE')) turn += 1;
    this.angle += (turn * PLAYER.turnKeys * dt + game.mouseDX * PLAYER.mouse) * sens;
    game.mouseDX = 0;
    this.pitch -= game.mouseDY * PLAYER.mouseY * sens;   // mouse up = look up
    game.mouseDY = 0;
    this.pitch = Math.max(-PLAYER.maxPitch, Math.min(PLAYER.maxPitch, this.pitch));
    this.angle = ((this.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    // which way you want to go
    let f = 0, s = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) f += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
    if (k.has('KeyD')) s += 1;
    if (k.has('KeyA')) s -= 1;
    const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
    let wx = ca * f - sa * s, wy = sa * f + ca * s;
    const wl = Math.hypot(wx, wy);
    if (wl > 0) { wx /= wl; wy /= wl; }

    // the dash: a burst of speed in the way you're moving (or forward)
    this.dashes = Math.min(PLAYER.dashCharges, this.dashes + dt / PLAYER.dashRecharge);
    this.safeT -= dt;
    if (game.dashPressed) {
      game.dashPressed = false;
      if (this.dashes >= 1 && !this.dashing) {
        this.dashes -= 1;
        this.dashT = PLAYER.dashTime;
        this.safeT = PLAYER.dashSafe;
        this.dashDX = wl > 0 ? wx : ca; this.dashDY = wl > 0 ? wy : sa;
        sfx.dash();
      }
    }
    if (this.dashing) {
      this.dashT -= dt;
      this.vx = this.dashDX * PLAYER.dashSpeed; this.vy = this.dashDY * PLAYER.dashSpeed;
      if (this.dashT <= 0) { this.vx *= 0.45; this.vy *= 0.45; }       // come out of it still moving fast
    } else {
      // momentum: speed up towards where you want to go, slow down when you let go
      const top = PLAYER.speed * (1 - (1 - PLAYER.adsSpeed) * this.ads);
      const rate = Math.min(1, dt * (wl > 0 ? PLAYER.accel : PLAYER.friction));
      this.vx += (wx * top - this.vx) * rate;
      this.vy += (wy * top - this.vy) * rate;
    }
    const ox = this.x, oy = this.y;
    game.world.move(this, this.vx * dt, this.vy * dt, PLAYER.radius);
    game.pushOutOfProps(this, PLAYER.radius);
    // bumping into a wall kills your speed in that direction
    if (Math.abs(this.x - ox) < Math.abs(this.vx * dt) * 0.5) this.vx = 0;
    if (Math.abs(this.y - oy) < Math.abs(this.vy * dt) * 0.5) this.vy = 0;
    const speed = Math.hypot(this.vx, this.vy);
    this.moving = speed > 0.6;
    this.running = this.dashing;
    if (this.moving) this.bobPhase += dt * (6 + speed * 1.3);
    // head bob eases in and out with your speed
    const want = Math.min(1, speed / PLAYER.speed) * (1 - 0.7 * this.ads);
    this.bobAmt += (want - this.bobAmt) * Math.min(1, dt * 8);
    this.bobY = Math.abs(Math.sin(this.bobPhase)) * 3 * this.bobAmt;

    // the kick
    this.kickCool -= dt;
    if (this.kickT > 0) this.kickT -= dt;
    if (game.kickPressed) {
      game.kickPressed = false;
      if (this.kickCool <= 0) {
        this.kickT = PLAYER.kickTime;
        this.kickCool = PLAYER.kickCool;
        sfx.swish();
        game.playerKick();
      }
    }

    // the gun
    this.cool -= dt;
    this.flashT -= dt;
    this.switchT -= dt;
    this.recoil = Math.max(0, this.recoil - dt * 6);
    if (this.reloading) this.stepReload(dt);
    const wantPose = this.reloading ? 1 : 0;
    this.reloadPose += (wantPose - this.reloadPose) * Math.min(1, dt * 14);
    // switching or kicking: the gun dips out of the way
    const sw = this.switchT > 0 ? Math.sin(Math.min(1, (0.3 - this.switchT) / 0.3) * Math.PI) : 0;
    const kick = this.kickT > 0 ? Math.sin((1 - this.kickT / PLAYER.kickTime) * Math.PI) * 0.6 : 0;
    this.switchPose = Math.max(sw, kick);

    if (game.switchTo) { this.switchTo(game.switchTo); game.switchTo = null; }
    if (game.firePressed) { game.firePressed = false; this.fire(game); }
    if (game.reloadPressed) { game.reloadPressed = false; this.startReload(); }
  }

  fire(game) {
    if (this.cool > 0 || this.switchT > 0) return;
    const gun = this.gun;
    if (this.loaded === 0) {
      sfx.click();
      this.cool = 0.2;
      this.startReload();
      return;
    }
    if (this.reloading) this.reloading = false;        // shooting stops a reload
    this.loaded--;
    this.cool = gun.fireDelay;
    this.recoil = gun.recoil;
    this.flashT = 0.06;
    this.shots++;
    game.world.flash = gun.flash;
    game.shake = Math.max(game.shake, gun.recoil * 0.25);
    if (this.weapon === 'shotgun') sfx.shotgun(); else sfx.revolver();
    game.shotNoise();
    // the shotgun shoves you backwards
    this.vx -= Math.cos(this.angle) * gun.shove;
    this.vy -= Math.sin(this.angle) * gun.shove;
    let spread = PLAYER.spread + (this.moving ? PLAYER.moveSpread : 0);
    spread *= 1 - (1 - PLAYER.adsSpread) * this.ads;
    // where you're aiming (with a little wobble)...
    const aim = this.angle + (Math.random() - 0.5) * 2 * spread;
    const aimPitch = this.pitch + (Math.random() - 0.5) * 2 * spread;
    // ...and each pellet scatters a bit round that (the revolver has one, dead on)
    const cone = gun.cone * (1 - 0.3 * this.ads);
    let hit = false;
    for (let i = 0; i < gun.pellets; i++) {
      const a = aim + (Math.random() - 0.5) * 2 * cone;
      const slope = Math.tan(aimPitch + (Math.random() - 0.5) * 2 * cone * 0.6);  // slope: how much the bullet rises per square
      if (game.playerShot(Math.cos(a), Math.sin(a), slope, gun, i > 0)) hit = true;
    }
    if (hit) this.hits++;
  }

  startReload() {
    if (this.reloading || this.switchT > 0 || this.loaded >= this.gun.capacity || this.reserve <= 0) return;
    this.reloading = true;
    this.reloadT = this.gun.openTime;
    if (this.weapon === 'shotgun') sfx.breakOpen(); else sfx.cylinderOpen();
  }

  // One round (or shell) at a time, fast. Fire to stop early.
  stepReload(dt) {
    this.reloadT -= dt;
    if (this.reloadT > 0) return;
    if (this.loaded < this.gun.capacity && this.reserve > 0) {
      this.loaded++;
      this.reserve--;
      sfx.insert();
      this.reloadT = this.gun.roundTime;
    }
    if (this.loaded >= this.gun.capacity || this.reserve <= 0) {
      this.reloading = false;
      this.cool = 0.12;
      if (this.weapon === 'shotgun') sfx.snapShut(); else sfx.cylinderClose();
    }
  }
}
