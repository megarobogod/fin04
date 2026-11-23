// player.js - you: moving, turning, and your guns (the revolver, and later the shotgun).

import * as sfx from './audio.js';

// ---- tuning numbers ----
export const PLAYER = {
  walk: 2.8,            // squares per second
  run: 4.6,             // holding Shift
  turnKeys: 2.6,        // radians per second with the arrow keys
  mouse: 0.0024,        // radians per pixel of mouse movement
  mouseY: 0.0020,       // same, for looking up and down
  maxPitch: 0.6,        // how far you can look up or down (radians, about 34 degrees)
  radius: 0.24,         // how fat you are (for bumping into walls)
  maxHp: 100,
  cylinder: 6,          // rounds in the revolver
  startReserve: 24,     // spare rounds at the start of a level
  maxReserve: 60,
  fireDelay: 0.42,      // seconds between shots
  openTime: 0.4,        // swing the cylinder out
  roundTime: 0.34,      // push one round in
  damage: [55, 78],     // a thug has 70 health: one or two shots to the body
  headshot: 2.6,        // shots to the head do this many times more
  headLine: 0.72,       // the head starts this far up a gang member (0 = feet, 1 = top of hat)
  spread: 0.012,        // aim wobble standing still (radians)
  moveSpread: 0.025,    // extra wobble while walking
  runSpread: 0.05,      // extra wobble while running
  // aiming down the sights (hold right mouse button)
  adsZoom: 1.6,         // how much it zooms in
  adsSpeed: 0.5,        // you walk at half speed while aiming (and can't run)
  adsSpread: 0.25,      // wobble is cut to a quarter
  adsMouse: 0.6,        // mouse turns slower so you can line up small targets
  adsTime: 0.12,        // seconds to raise the gun (roughly)
};

// ---- the guns ----
// capacity: rounds loaded at once.  pellets: bullets per shot (the shotgun fires a spray).
// damage: per pellet.  cone: how wide the pellets spread.  range: pellets weaken past this.
export const WEAPONS = {
  revolver: {
    name: 'REVOLVER', capacity: 6, maxReserve: 60, fireDelay: 0.42, openTime: 0.4, roundTime: 0.34,
    damage: [55, 78], pellets: 1, cone: 0, headshot: 2.6, range: 9, recoil: 1, flash: 0.45,
  },
  shotgun: {
    name: 'SHOTGUN', capacity: 2, maxReserve: 24, fireDelay: 0.3, openTime: 0.45, roundTime: 0.42,
    damage: [16, 22], pellets: 9, cone: 0.07, headshot: 1.6, range: 4, recoil: 1.7, flash: 0.75,
  },
};

export class Player {
  // `kit` carries your guns and ammo from one floor or level to the next
  constructor(x, y, angle, kit) {
    this.x = x; this.y = y; this.angle = angle;
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
    this.switchPose = 0;         // lowers the gun while you swap weapons
    this.switchT = 0;
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

  give(name, loaded, reserve) {
    if (!this.guns[name]) this.guns[name] = { loaded, reserve };
  }

  switchTo(name) {
    if (!this.guns[name] || name === this.weapon || this.switchT > 0) return;
    this.reloading = false;
    this.weapon = name;
    this.switchT = 0.4;
    this.cool = Math.max(this.cool, 0.35);
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

    // walking
    let f = 0, s = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) f += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
    if (k.has('KeyD')) s += 1;
    if (k.has('KeyA')) s -= 1;
    const len = Math.hypot(f, s);
    this.moving = len > 0;
    this.running = this.moving && this.ads < 0.5 && (k.has('ShiftLeft') || k.has('ShiftRight'));
    if (this.moving) {
      const speed = (this.running ? PLAYER.run : PLAYER.walk) * (1 - (1 - PLAYER.adsSpeed) * this.ads) * dt / len;
      const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
      const dx = (ca * f - sa * s) * speed, dy = (sa * f + ca * s) * speed;
      game.world.move(this, dx, dy, PLAYER.radius);
      game.pushOutOfProps(this, PLAYER.radius);
      this.bobPhase += dt * (this.running ? 13 : 9);
    }
    // head bob eases in and out
    const want = (this.moving ? (this.running ? 1 : 0.6) : 0) * (1 - 0.7 * this.ads);
    this.bobAmt += (want - this.bobAmt) * Math.min(1, dt * 8);
    this.bobY = Math.abs(Math.sin(this.bobPhase)) * 3 * this.bobAmt;

    // the gun
    this.cool -= dt;
    this.flashT -= dt;
    this.switchT -= dt;
    this.recoil = Math.max(0, this.recoil - dt * 5);
    if (this.reloading) this.stepReload(dt);
    const wantPose = this.reloading ? 1 : 0;
    this.reloadPose += (wantPose - this.reloadPose) * Math.min(1, dt * 10);
    // switching: the gun drops out of sight, then the other one comes up
    this.switchPose = this.switchT > 0 ? Math.sin(Math.min(1, (0.4 - this.switchT) / 0.4) * Math.PI) : 0;

    if (game.switchTo) { this.switchTo(game.switchTo); game.switchTo = null; }
    if (game.firePressed) { game.firePressed = false; this.fire(game); }
    if (game.reloadPressed) { game.reloadPressed = false; this.startReload(); }
  }

  fire(game) {
    if (this.cool > 0 || this.switchT > 0) return;
    const gun = this.gun;
    if (this.loaded === 0) {
      sfx.click();
      this.cool = 0.25;
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
    if (this.weapon === 'shotgun') sfx.shotgun(); else sfx.revolver();
    game.shotNoise();
    let spread = PLAYER.spread;
    if (this.moving) spread += this.running ? PLAYER.runSpread : PLAYER.moveSpread;
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

  // One round (or shell) at a time. Fire to stop early.
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
      this.cool = 0.2;
      if (this.weapon === 'shotgun') sfx.snapShut(); else sfx.cylinderClose();
    }
  }
}
