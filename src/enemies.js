// enemies.js - the Vipers: how they stand guard, notice you, rush you and
// shoot back. They're fast and aggressive. Their bullets are real, visible
// tracers that fly across the room, so you can see them coming and dash
// out of the way.
//
// Each gang member is always in one "state":
//   idle  - waiting, looking one way. Wakes up if he sees or hears you.
//   hunt  - moving: rushing you, side-stepping, or following the path to you.
//   aim   - a short pause raising the gun (your warning: shoot first or dash!)
//   fire  - shooting (a burst for tommy guns, a spray for the shotgun)
//   pain  - flinching after being hit or kicked
//   dying / dead
//   downed - the lieutenant, beaten but alive (the interrogation follows)

// ---- tuning numbers ----
// shot: speed of the bullets (squares/second), damage per bullet, how many
// bullets per shot (pellets) and how wide they spread, and how far off they aim.
export const TYPES = {
  thug: {
    hp: 85, speed: 3.0, radius: 0.28, height: 1.0,
    burst: 1, gap: 0, shot: { speed: 14, damage: [9, 13], pellets: 1, spread: 0, aimError: 0.05 },
    aimTime: [0.3, 0.45], cooldown: [0.8, 1.4],
    range: 15, keep: 3, painChance: 0.6, drop: 0.8,
    looks: ['thugA', 'thugB'],
  },
  heavy: {
    hp: 170, speed: 2.1, radius: 0.32, height: 1.0,
    burst: 5, gap: 0.09, shot: { speed: 16, damage: [6, 8], pellets: 1, spread: 0, aimError: 0.09 },
    aimTime: [0.45, 0.6], cooldown: [1.2, 1.8],
    range: 15, keep: 5, painChance: 0.4, drop: 1,
    looks: ['heavy'],
  },
  // The Vipers lieutenant at the top of the Dellwood. A sawn-off shotgun:
  // a spray of pellets, deadly up close. He doesn't die: he goes down, and talks.
  lieutenant: {
    hp: 320, speed: 2.6, radius: 0.3, height: 1.02,
    burst: 1, gap: 0, shotgun: true, shot: { speed: 12, damage: [6, 9], pellets: 6, spread: 0.22, aimError: 0.03 },
    aimTime: [0.45, 0.6], cooldown: [0.9, 1.4],
    range: 12, keep: 2, painChance: 0.3, drop: 0, downed: true,
    looks: ['lieutenant'],
  },
  boss: {
    hp: 700, speed: 2.6, radius: 0.32, height: 1.06,
    burst: 7, gap: 0.08, shot: { speed: 17, damage: [7, 10], pellets: 1, spread: 0, aimError: 0.08 },
    aimTime: [0.35, 0.5], cooldown: [0.8, 1.3],
    range: 16, keep: 4, painChance: 0.2, drop: 0,
    looks: ['boss'],
  },
};
const SIGHT = 18;              // how far they can see you (squares)
const SIGHT_CONE = 1.6;        // half-angle they can see while idle (radians)
const HEAR_CLOSE = 5;          // they always notice you this close
const WAKE_FRIENDS = 10;       // an alerted gangster wakes others this close
const KNOCK_FRICTION = 7;      // how quickly a kicked gangster stops sliding

const between = ([a, b]) => a + Math.random() * (b - a);

export class Enemy {
  constructor(kind, x, y) {
    this.kind = kind;
    this.def = TYPES[kind];
    this.look = this.def.looks[(Math.random() * this.def.looks.length) | 0];
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;    // knockback, from kicks and shotgun blasts
    this.hp = this.def.hp;
    this.state = 'idle';
    this.timer = 0;
    this.facing = Math.random() * Math.PI * 2;
    this.cool = 0;
    this.shotsLeft = 0;
    this.flashT = 0;
    this.walk = 0;
    this.moved = false;
    this.strafe = 1; this.strafeT = 0; this.sidestep = false;
    this.lookT = Math.random() * 0.3;
    this.dead = false;
    this.gibbed = false;         // blown apart: no body left, just the mess
    this.deathT = 0;
    this.poolStage = 0;
  }

  // Which picture to show this frame (null = nothing to draw).
  frame() {
    if (this.gibbed) return null;
    if (this.state === 'dead') return 'dead';
    if (this.state === 'downed') return 'die1';
    if (this.state === 'dying') return this.deathT < 0.18 ? 'die1' : this.deathT < 0.4 ? 'die2' : 'dead';
    if (this.state === 'pain') return 'hurt';
    if (this.state === 'fire') return this.flashT > 0 ? 'shoot' : 'aim';
    if (this.state === 'aim') return 'aim';
    if (this.moved) return ((this.walk * 2.2) | 0) % 2 ? 'walk1' : 'walk2';
    return 'stand';
  }

  alert(game) {
    if (this.state !== 'idle') return;
    this.state = 'hunt';
    this.cool = 0.2 + Math.random() * 0.4;   // reaction time before the first shot
    game.wakeNear(this.x, this.y, WAKE_FRIENDS);
  }

  // stun: how long he flinches (kicks stun for longer)
  hurt(game, dmg, stun = 0.2) {
    if (this.dead) return;
    this.hp -= dmg;
    if (this.hp <= 0 && this.def.downed) {
      this.hp = 0;
      this.dead = true;          // out of the fight, but not dead
      this.state = 'downed';
      game.onLieutenantDown(this);
      return;
    }
    if (this.hp <= 0) {
      this.dead = true;
      this.state = 'dying';
      this.deathT = 0;
      game.onEnemyKilled(this);
      return;
    }
    if (this.state === 'idle') this.alert(game);
    if (stun > 0.3 || Math.random() < this.def.painChance) {
      this.state = 'pain';
      this.timer = stun;
    }
  }
}

// Called every frame for every gang member.
export function updateEnemies(game, dt) {
  const p = game.player, world = game.world;
  for (const e of game.enemies) {
    e.moved = false;
    e.flashT -= dt;
    // sliding from a kick or a blast (bodies slide too)
    if (e.vx || e.vy) {
      if (world.move(e, e.vx * dt, e.vy * dt, e.def.radius)) { e.vx *= -0.3; e.vy *= -0.3; }
      const f = Math.max(0, 1 - KNOCK_FRICTION * dt);
      e.vx *= f; e.vy *= f;
      if (Math.abs(e.vx) + Math.abs(e.vy) < 0.05) e.vx = e.vy = 0;
    }
    if (e.state === 'dead' || e.state === 'downed') continue;
    if (e.state === 'dying') {
      e.deathT += dt;
      // the pool of blood spreads out under the body
      const stages = [0.5, 1.4, 3.0];
      if (e.poolStage < stages.length && e.deathT > stages[e.poolStage]) {
        world.splatFloor(e.x + 0.15, e.y, (0.16 + e.poolStage * 0.1) * (e.gibbed ? 1.6 : 1), e.poolStage * 0.3);
        e.poolStage++;
      }
      if (e.deathT > 3.2) e.state = 'dead';
      continue;
    }

    const dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.hypot(dx, dy);
    const toPlayer = Math.atan2(dy, dx);
    // line of sight is checked a few times a second, not every frame
    e.lookT -= dt;
    if (e.lookT <= 0) {
      e.lookT = 0.1;
      e.sees = d < SIGHT && world.clear(e.x, e.y, p.x, p.y);
    }
    e.cool -= dt;

    switch (e.state) {
      case 'idle': {
        const diff = Math.abs(((toPlayer - e.facing + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (e.sees && (diff < SIGHT_CONE || d < HEAR_CLOSE)) e.alert(game);
        break;
      }
      case 'pain':
        e.timer -= dt;
        if (e.timer <= 0) e.state = 'hunt';
        break;
      case 'aim':
        e.facing = toPlayer;
        e.timer -= dt;
        if (e.timer <= 0) {
          if (e.sees) { e.state = 'fire'; e.shotsLeft = e.def.burst; e.timer = 0; }
          else e.state = 'hunt';
        }
        break;
      case 'fire':
        e.facing = toPlayer;
        e.timer -= dt;
        if (e.timer <= 0) {
          if (e.shotsLeft > 0) {
            e.shotsLeft--;
            e.flashT = 0.08;
            e.timer = e.def.gap || 0.15;
            game.enemyFire(e);
          } else {
            e.state = 'hunt';
            e.cool = between(e.def.cooldown);
          }
        }
        break;
      case 'hunt':
        hunt(game, e, dt, dx, dy, d, toPlayer);
        break;
    }
  }
  // gang members don't stand inside each other
  const list = game.enemies;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.dead) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.def.radius + b.def.radius;
      if (d < min && d > 0.001) {
        const push = (min - d) / 2;
        world.move(a, (-dx / d) * push, (-dy / d) * push, a.def.radius);
        world.move(b, (dx / d) * push, (dy / d) * push, b.def.radius);
      }
    }
  }
}

function hunt(game, e, dt, dx, dy, d, toPlayer) {
  const world = game.world, def = e.def;
  let mx = 0, my = 0;
  if (e.sees && d < def.range) {
    e.facing = toPlayer;
    if (e.cool <= 0) {
      e.state = 'aim';
      e.timer = between(def.aimTime);
      return;
    }
    // between shots: rush in, back off if right on top of you, and weave side to side
    e.strafeT -= dt;
    if (e.strafeT <= 0) {
      e.strafe = Math.random() < 0.5 ? -1 : 1;
      e.strafeT = 0.4 + Math.random() * 0.8;
      e.sidestep = Math.random() < 0.8;
    }
    const ux = dx / d, uy = dy / d;
    if (d > def.keep + 1) { mx += ux; my += uy; }
    else if (d < 1.6) { mx -= ux; my -= uy; }
    if (e.sidestep) { mx += -uy * e.strafe; my += ux * e.strafe; }
  } else {
    // can't see you: follow the path along the map towards you
    const step = game.pathStep(e.x, e.y);
    if (step) { mx = step.x - e.x; my = step.y - e.y; }
    else { mx = dx; my = dy; }
    if (mx || my) e.facing = Math.atan2(my, mx);
  }
  const len = Math.hypot(mx, my);
  if (len < 0.001) return;
  const sp = (def.speed * dt) / len;
  const ox = e.x, oy = e.y;
  const blocked = world.move(e, mx * sp, my * sp, def.radius);
  game.pushOutOfProps(e, def.radius);
  if (blocked) e.strafe = -e.strafe;
  const moved = Math.hypot(e.x - ox, e.y - oy);
  if (moved > 0.001) { e.moved = true; e.walk += moved; }
}
