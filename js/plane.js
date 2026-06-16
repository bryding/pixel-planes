// ===========================================================================
//  PLANE  --  The player's airplane: how it moves and how it's drawn.
// ===========================================================================

class Plane {
  constructor(x, y) {
    // Where the plane is in the world.
    this.x = x;
    this.y = y;

    // How fast it's moving sideways (vx) and up/down (vy).
    // "v" is short for "velocity", which just means speed-with-a-direction.
    this.vx = 2;
    this.vy = 0;

    // Which way the nose is pointing, as an angle.
    // 0 means pointing to the right. We start flying to the right.
    this.angle = 0;

    // The throttle is like a gas pedal: 0 = off, 1 = full power.
    this.throttle = CONFIG.START_THROTTLE;

    // A spinning number used to animate the propeller.
    this.propSpin = 0;

    // The gun "cooldown": counts down after each shot so the gun can't fire
    // every single frame. When it hits 0, the plane is allowed to shoot again.
    this.fireCooldown = 0;

    // The player is on "team 0". Bullets only hurt planes on a DIFFERENT team.
    this.team = 0;

    // Health: how many hits left. alive = false means shot down (respawning).
    this.health = CONFIG.PLAYER_HEALTH;
    this.alive = true;

    // A quick flash when hit, so taking damage feels real.
    this.flash = 0;

    // Missiles you're carrying, and a timer that slowly refills them.
    this.missiles = CONFIG.MISSILE_MAX;
    this.missileTimer = 0;

    // Set true on any frame the plane is touching the ground.
    this.hitGround = false;
    // Set by the flight physics when the wings stall.
    this.stalling = false;
  }

  // Called when something hits the player. "damage" is how many hearts it
  // takes away (bullets = 1, a missile = a lot). Returns true if just downed.
  takeHit(damage = 1) {
    this.health -= damage;
    this.flash = 8;
    if (this.health <= 0) {
      this.alive = false;
      return true; // shot down!
    }
    return false;
  }

  // This runs every frame to move the plane.
  update() {
    // --- 1. Read the controls ---
    if (Input.up)   this.throttle += CONFIG.THROTTLE_RATE;
    if (Input.down) this.throttle -= CONFIG.THROTTLE_RATE;
    // Keep the throttle between 0 (off) and 1 (full power).
    this.throttle = Math.max(0, Math.min(1, this.throttle));

    if (Input.left)  this.angle -= CONFIG.TURN_SPEED;
    if (Input.right) this.angle += CONFIG.TURN_SPEED;

    // --- 2. Realistic flight: thrust, gravity, lift, grip, drag, top speed ---
    applyFlightPhysics(this, this.throttle * CONFIG.THRUST);

    // --- 3. Actually move (and loop around the world sideways) ---
    this.x = wrapX(this.x + this.vx);
    this.y += this.vy;

    // --- 4. Touching the ground. We just note it here (hitGround); the game
    // decides what it means: a safe roll during takeoff, or a fatal crash
    // while flying.
    this.hitGround = false;
    if (this.y > CONFIG.GROUND_Y - 6) {
      this.y = CONFIG.GROUND_Y - 6;
      if (this.vy > 0) this.vy = 0; // stop falling through it
      this.hitGround = true;
    }

    // --- 5. The ceiling is way up high. You'll usually stall out long
    // before you reach it, but this is the hard top of the sky.
    if (this.y < CONFIG.CEILING) {
      this.y = CONFIG.CEILING;
      if (this.vy < 0) this.vy = 0;
    }

    // Spin the propeller a bit (faster when throttle is higher).
    this.propSpin += 0.5 + this.throttle;

    // Count the gun cooldown down toward 0 so we can shoot again soon.
    if (this.fireCooldown > 0) this.fireCooldown -= 1;

    // Count the hit-flash down toward 0.
    if (this.flash > 0) this.flash -= 1;

    // Slowly refill missiles: add one every MISSILE_REFILL_SECONDS seconds
    // (we count frames; about 60 frames make one second).
    if (this.missiles < CONFIG.MISSILE_MAX) {
      this.missileTimer += 1;
      if (this.missileTimer >= CONFIG.MISSILE_REFILL_SECONDS * 60) {
        this.missiles += 1;
        this.missileTimer = 0;
      }
    } else {
      this.missileTimer = 0;
    }
  }

  // Launch one homing missile at the nearest enemy (if we have any left).
  // "planes" is every plane, so we can find the closest enemy to lock onto.
  fireMissile(missiles, planes) {
    if (this.missiles <= 0) return;
    this.missiles -= 1;

    // Find the closest enemy (a plane on another team) to chase.
    let target = null, bestDist = Infinity;
    for (const p of planes) {
      if (p === this || !p.alive || p.team === this.team) continue;
      const dx = wrapDX(p.x - this.x), dy = p.y - this.y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; target = p; }
    }

    const nx = this.x + Math.cos(this.angle) * 17;
    const ny = this.y + Math.sin(this.angle) * 17;
    missiles.push(new Missile(nx, ny, this.angle, this.team, target));
  }

  // Try to fire the gun. If the cooldown is ready, make a new bullet at the
  // nose and add it to the bullets list. (game.js calls this when SPACE held.)
  tryShoot(bullets) {
    if (this.fireCooldown > 0) return; // not ready yet

    // Find the tip of the nose (in front, in the facing direction).
    const noseX = this.x + Math.cos(this.angle) * 17;
    const noseY = this.y + Math.sin(this.angle) * 17;

    bullets.push(new Bullet(
      noseX, noseY, this.angle, this.vx, this.vy,
      this.team, CONFIG.COLORS.bullet
    ));

    // Start the cooldown so the next shot has to wait a bit.
    this.fireCooldown = CONFIG.FIRE_COOLDOWN;
  }

  // Draw the plane on screen (worldToScreenX handles the looping world).
  draw(ctx) {
    drawPlaneSprite(ctx, PLANE_SPRITES.player, worldToScreenX(this.x),
                    this.y - camera.y, this.angle, this.propSpin, this.flash > 0);
  }
}
