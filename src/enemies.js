// enemies.js - the Vipers: how they stand guard, notice you, hunt you down
// and shoot back.
//
// Each gang member is always in one "state":
//   idle  - waiting, looking one way. Wakes up if he sees or hears you.
//   hunt  - moving: closing in, side-stepping, or following the path to you.
//   aim   - standing still, raising the gun (your moment to shoot first!)
//   fire  - shooting (a burst for tommy guns)
//   pain  - flinching after being hit
//   dying / dead
//   downed - the lieutenant, beaten but alive (the interrogation follows)

// ---- tuning numbers ----
export const TYPES = {
  thug: {
    hp: 70, speed: 1.7, radius: 0.28, height: 1.0,
    burst: 1, gap: 0, damage: [9, 15], accuracy: 0.72,
    aimTime: [0.45, 0.75], cooldown: [1.1, 2.0],
    range: 12, keep: 4, painChance: 0.7, drop: 0.55,
    looks: ['thugA', 'thugB'],
  },
  heavy: {
    hp: 160, speed: 1.25, radius: 0.32, height: 1.0,
    burst: 3, gap: 0.12, damage: [6, 10], accuracy: 0.5,
    aimTime: [0.55, 0.8], cooldown: [1.5, 2.3],
    range: 12, keep: 5, painChance: 0.5, drop: 1,
    looks: ['heavy'],
  },
  // The Vipers lieutenant at the top of the Dellwood. A sawn-off shotgun:
  // deadly up close, weak at range. He doesn't die: he goes down, and talks.
  lieutenant: {
    hp: 300, speed: 1.3, radius: 0.3, height: 1.02,
    burst: 1, gap: 0, damage: [18, 30], accuracy: 0.8, shotgun: true,
    aimTime: [0.6, 0.85], cooldown: [1.3, 1.9],
    range: 10, keep: 3, painChance: 0.35, drop: 0, downed: true,
    looks: ['lieutenant'],
  },
  boss: {
    hp: 450, speed: 1.5, radius: 0.32, height: 1.06,
    burst: 5, gap: 0.1, damage: [7, 11], accuracy: 0.6,
    aimTime: [0.4, 0.6], cooldown: [1.0, 1.6],
    range: 14, keep: 5, painChance: 0.25, drop: 0,
    looks: ['boss'],
  },
};
const SIGHT = 16;              // how far they can see you (squares)
const SIGHT_CONE = 1.15;       // half-angle they can see while idle (radians)
const HEAR_CLOSE = 3.5;        // they always notice you this close
const WAKE_FRIENDS = 6;        // an alerted gangster wakes others this close

const between = ([a, b]) => a + Math.random() * (b - a);

export class Enemy {
  constructor(kind, x, y) {
    this.kind = kind;
    this.def = TYPES[kind];
    this.look = this.def.looks[(Math.random() * this.def.looks.length) | 0];
    this.x = x; this.y = y;
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
    this.deathT = 0;
    this.poolStage = 0;
  }

  // Which picture to show this frame.
  frame() {
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
    this.cool = 0.3 + Math.random() * 0.5;   // reaction time before the first shot
    game.wakeNear(this.x, this.y, WAKE_FRIENDS);
  }

  hurt(game, dmg) {
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
    if (Math.random() < this.def.painChance) {
      this.state = 'pain';
      this.timer = 0.22;
    }
  }
}

// Called every frame for every gang member.
export function updateEnemies(game, dt) {
  const p = game.player, world = game.world;
  for (const e of game.enemies) {
    e.moved = false;
    e.flashT -= dt;
    if (e.state === 'dead' || e.state === 'downed') continue;
    if (e.state === 'dying') {
      e.deathT += dt;
      // the pool of blood spreads out under the body
      const stages = [0.5, 1.4, 3.0];
      if (e.poolStage < stages.length && e.deathT > stages[e.poolStage]) {
        world.splatFloor(e.x + 0.15, e.y, 0.16 + e.poolStage * 0.1, e.poolStage * 0.3);
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
      e.lookT = 0.12;
      e.sees = d < SIGHT && world.clear(e.x, e.y, p.x, p.y);
    }
    e.cool -= dt;

    switch (e.state) {
      case 'idle': {
        let diff = Math.abs(((toPlayer - e.facing + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
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
            game.enemyShot(e, d);
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
    // between shots: close in, back off, or side-step
    e.strafeT -= dt;
    if (e.strafeT <= 0) {
      e.strafe = Math.random() < 0.5 ? -1 : 1;
      e.strafeT = 0.6 + Math.random() * 1.2;
      e.sidestep = Math.random() < 0.7;
    }
    const ux = dx / d, uy = dy / d;
    if (d > def.keep + 1.5) { mx += ux; my += uy; }
    else if (d < 2.2) { mx -= ux; my -= uy; }
    if (e.sidestep) { mx += -uy * e.strafe * 0.8; my += ux * e.strafe * 0.8; }
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
