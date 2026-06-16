// ===========================================================================
//  ENEMY  --  A computer-controlled plane with a simple "brain" (AI).
//  Each frame it: 1) picks the closest plane on a DIFFERENT team,
//  2) turns its nose toward it, 3) flies forward, 4) shoots if it's aimed.
//
//  Because enemies come on two teams (purple vs orange), they don't just
//  attack YOU -- they also dogfight each other!
// ===========================================================================

class Enemy {
  constructor(x, y, team) {
    this.x = x;
    this.y = y;
    this.vx = -2; // start drifting left, toward the player
    this.vy = 0;
    this.angle = Math.PI; // start facing left

    this.team = team; // 1 = purple, 2 = orange

    this.health = CONFIG.ENEMY_HEALTH;
    this.alive = true;
    this.respawnTimer = 0;

    this.fireCooldown = 0;
    this.flash = 0; // white flash when hit
    this.propSpin = 0; // spins the propeller

    // Pick this plane's colors based on its team.
    const C = CONFIG.COLORS;
    if (team === 2) {
      this.bodyColor = C.enemy2;
      this.darkColor = C.enemy2Dark;
    } else {
      this.bodyColor = C.enemy;
      this.darkColor = C.enemyDark;
    }
  }

  // The "brain". We pass in ALL the planes (so it can pick a target) and the
  // bullets list (so it can add a bullet when it shoots).
  update(planes, bullets) {
    // --- If we're shot down, just wait to come back ---
    if (!this.alive) {
      this.respawnTimer -= 1;
      if (this.respawnTimer <= 0) this.respawn(planes);
      return;
    }

    if (this.flash > 0) this.flash -= 1;
    if (this.fireCooldown > 0) this.fireCooldown -= 1;
    this.propSpin += 1; // keep the propeller spinning

    // --- 1. Find the closest target on a different team ---
    const target = this.findTarget(planes);

    // --- 2. Decide which way we WANT to point ---
    let wantAngle = this.angle;
    if (target) {
      wantAngle = Math.atan2(target.y - this.y, target.x - this.x);
    }

    // Safety: if we're getting close to the ground, point upward so we
    // don't nosedive into it.
    if (this.y > CONFIG.GROUND_Y - 35) wantAngle = -Math.PI / 2;
    // ...and don't smack the ceiling either.
    if (this.y < 25) wantAngle = Math.PI / 2;

    // --- 3. Turn the nose smoothly toward wantAngle (the short way) ---
    const diff = angleDiff(wantAngle, this.angle);
    if (diff > 0.02) this.angle += CONFIG.ENEMY_TURN;
    else if (diff < -0.02) this.angle -= CONFIG.ENEMY_TURN;

    // --- 4. Fly forward (same kind of physics as the player) ---
    const push = CONFIG.ENEMY_THRUST;
    this.vx += Math.cos(this.angle) * push;
    this.vy += Math.sin(this.angle) * push;
    this.vy += CONFIG.GRAVITY;       // gravity pulls down
    this.vx *= CONFIG.DRAG;          // air resistance
    this.vy *= CONFIG.DRAG;

    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > CONFIG.MAX_SPEED) {
      this.vx = (this.vx / speed) * CONFIG.MAX_SPEED;
      this.vy = (this.vy / speed) * CONFIG.MAX_SPEED;
    }

    this.x += this.vx;
    this.y += this.vy;

    // Stay inside the world a little.
    if (this.y > CONFIG.GROUND_Y - 6) { this.y = CONFIG.GROUND_Y - 6; this.vy = 0; }
    if (this.y < 10) { this.y = 10; this.vy = 0; }

    // --- 5. Shoot if we have a target, it's close, and we're aimed at it ---
    if (target && this.fireCooldown <= 0) {
      const toTarget = Math.atan2(target.y - this.y, target.x - this.x);
      const aimError = Math.abs(angleDiff(toTarget, this.angle));
      const dist = Math.hypot(target.x - this.x, target.y - this.y);
      if (dist < CONFIG.ENEMY_FIRE_RANGE && aimError < CONFIG.ENEMY_AIM) {
        this.shoot(bullets);
      }
    }
  }

  // Look through all planes and return the closest ALIVE one on another team.
  findTarget(planes) {
    let best = null;
    let bestDist = Infinity;
    for (const p of planes) {
      if (p === this) continue;     // don't target yourself
      if (!p.alive) continue;       // ignore downed planes
      if (p.team === this.team) continue; // same team = friend, skip
      const d = (p.x - this.x) ** 2 + (p.y - this.y) ** 2;
      if (d < bestDist) { bestDist = d; best = p; }
    }
    return best;
  }

  // Fire a bullet out of the nose, tagged with this plane's team.
  shoot(bullets) {
    const noseX = this.x + Math.cos(this.angle) * 15;
    const noseY = this.y + Math.sin(this.angle) * 15;
    bullets.push(new Bullet(
      noseX, noseY, this.angle, this.vx, this.vy,
      this.team, CONFIG.COLORS.enemyBullet
    ));
    this.fireCooldown = CONFIG.ENEMY_FIRE_COOLDOWN;
  }

  // Called when a bullet hits us. Returns true if we just got popped.
  takeHit() {
    this.health -= 1;
    this.flash = 6;
    if (this.health <= 0) {
      this.alive = false;
      this.respawnTimer = CONFIG.ENEMY_RESPAWN;
      return true;
    }
    return false;
  }

  // Come back to life somewhere near the action (around the player).
  respawn(planes) {
    const player = planes[0]; // the player is always first in the list
    const side = Math.random() < 0.5 ? -1 : 1;
    this.x = player.x + side * (250 + Math.random() * 150);
    this.y = 40 + Math.random() * 120;
    this.vx = -side * 2;
    this.vy = 0;
    this.angle = side > 0 ? Math.PI : 0; // face back toward the player
    this.health = CONFIG.ENEMY_HEALTH;
    this.alive = true;
    this.flash = 0;
  }

  draw(ctx, camX, camY) {
    if (!this.alive) return;

    // Stamp the detailed biplane sprite for this enemy's team.
    drawPlaneSprite(ctx, PLANE_SPRITES[this.team], this.x - camX, this.y - camY,
                    this.angle, this.propSpin, this.flash > 0);
  }
}

// Helper: the SHORTEST turn from angle "from" to angle "to".
// Angles wrap around (like a clock), so we squash the answer into
// the range -PI..PI so a plane always turns the quick way.
function angleDiff(to, from) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
