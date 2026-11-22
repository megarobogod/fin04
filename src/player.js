// player.js - you: moving, turning, and the revolver.

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

export class Player {
  constructor(x, y, angle) {
    this.x = x; this.y = y; this.angle = angle;
    this.pitch = 0;              // looking up (+) or down (-)
    this.ads = 0;                // 0 = gun at the hip, 1 = looking down the sights
    this.zoom = 1;
    this.hp = PLAYER.maxHp;
    this.loaded = PLAYER.cylinder;
    this.reserve = PLAYER.startReserve;
    this.cool = 0;               // time until you can fire again
    this.reloading = false;
    this.reloadT = 0;
    this.reloadPose = 0;         // 0 = gun up, 1 = gun lowered for reloading
    this.recoil = 0;
    this.flashT = 0;
    this.bobPhase = 0; this.bobAmt = 0; this.bobY = 0;
    this.moving = false; this.running = false;
    this.shots = 0; this.hits = 0; this.kills = 0;
  }

  update(dt, game) {
    const k = game.keys;
    // aiming down the sights: eases up while the right button is held (not while reloading)
    const wantAds = game.adsHeld && !this.reloading ? 1 : 0;
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

    // the revolver
    this.cool -= dt;
    this.flashT -= dt;
    this.recoil = Math.max(0, this.recoil - dt * 5);
    if (this.reloading) this.stepReload(dt);
    const wantPose = this.reloading ? 1 : 0;
    this.reloadPose += (wantPose - this.reloadPose) * Math.min(1, dt * 10);

    if (game.firePressed) { game.firePressed = false; this.fire(game); }
    if (game.reloadPressed) { game.reloadPressed = false; this.startReload(); }
  }

  fire(game) {
    if (this.cool > 0) return;
    if (this.loaded === 0) {
      sfx.click();
      this.cool = 0.25;
      this.startReload();
      return;
    }
    if (this.reloading) this.reloading = false;        // shooting stops a reload
    this.loaded--;
    this.cool = PLAYER.fireDelay;
    this.recoil = 1;
    this.flashT = 0.06;
    this.shots++;
    game.world.flash = 0.45;
    sfx.revolver();
    let spread = PLAYER.spread;
    if (this.moving) spread += this.running ? PLAYER.runSpread : PLAYER.moveSpread;
    spread *= 1 - (1 - PLAYER.adsSpread) * this.ads;
    const a = this.angle + (Math.random() - 0.5) * 2 * spread;
    // slope: how much the bullet rises (or drops) per square it travels
    const slope = Math.tan(this.pitch + (Math.random() - 0.5) * 2 * spread);
    game.playerShot(Math.cos(a), Math.sin(a), slope);
  }

  startReload() {
    if (this.reloading || this.loaded >= PLAYER.cylinder || this.reserve <= 0) return;
    this.reloading = true;
    this.reloadT = PLAYER.openTime;
    sfx.cylinderOpen();
  }

  // One round at a time, like a real revolver. Fire to stop early.
  stepReload(dt) {
    this.reloadT -= dt;
    if (this.reloadT > 0) return;
    if (this.loaded < PLAYER.cylinder && this.reserve > 0) {
      this.loaded++;
      this.reserve--;
      sfx.insert();
      this.reloadT = PLAYER.roundTime;
    }
    if (this.loaded >= PLAYER.cylinder || this.reserve <= 0) {
      this.reloading = false;
      this.cool = 0.2;
      sfx.cylinderClose();
    }
  }
}
