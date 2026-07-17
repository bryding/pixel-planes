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
    // In WW2 Mode planes belong to a faction ('green' / 'black') instead.
    this.faction = 'green';
    // In Alien Invasion (tag) mode, true means this plane is a UFO ("it").
    this.isUfo = false;
    this.isPlayer = true;
    // Which control scheme this plane uses: null = arrow keys (player 1),
    // 'p2' = WASD keys (player 2 in split-screen).
    this.keymap = null;
    // Split-screen: counts down while shot down, then this player respawns.
    this.deadTimer = 0;

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
    // How fast we were descending the moment we touched down (for soft-landing).
    this.impactVy = 0;
    // Set by the flight physics when the wings stall.
    this.stalling = false;

    // Power-up timers (count down to 0).
    this.invincibleTimer = 0; // shield: can't be hurt
    this.wideTimer = 0;       // turret: 5-bullet wide shot
    this.frozenTimer = 0;     // skull: no control
  }

  // Called when something hits the player. "damage" is how many hearts it
  // takes away (bullets = 1, a missile = a lot). Returns true if just downed.
  takeHit(damage = 1) {
    if (this.invincibleTimer > 0) return false; // shield: ignore all damage
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
    // --- 1. Read the controls (unless we're FROZEN by a bad power-up) ---
    // Player 2 (split-screen) uses the WASD keys; everyone else uses arrows.
    const kUp    = (this.keymap === 'p2') ? Input.up2    : Input.up;
    const kDown  = (this.keymap === 'p2') ? Input.down2  : Input.down;
    const kLeft  = (this.keymap === 'p2') ? Input.left2  : Input.left;
    const kRight = (this.keymap === 'p2') ? Input.right2 : Input.right;
    if (this.frozenTimer <= 0) {
      if (kUp)   this.throttle += CONFIG.THROTTLE_UP_RATE; // slow to spin up
      if (kDown) this.throttle -= CONFIG.THROTTLE_RATE;
      // Keep the throttle between 0 (off) and 1 (full power).
      this.throttle = Math.max(0, Math.min(1, this.throttle));

      const tm = (mode === 'ww2') ? CONFIG.WW2_TURN_MULT : 1; // WW2 planes turn slowly
      // MOUSE MODE (a Settings option): the nose chases the mouse pointer.
      // Only for player 1's plane in normal flight (not split-screen, not UFO).
      const mouseSteer = (typeof mouseMode !== 'undefined') && mouseMode &&
                         this.isPlayer && this.keymap !== 'p2' &&
                         !splitScreen && !this.isUfo;
      if (mouseSteer) {
        // Where is the plane ON SCREEN? The pointer is in screen pixels too,
        // so we aim in screen space and don't worry about the looping world.
        const sx = worldToScreenX(this.x), sy = this.y - camera.y;
        const want = Math.atan2(Mouse.y - sy, Mouse.x - sx);
        // Find the SMALLEST turn that faces the pointer (wrap into -PI..PI).
        let diff = want - this.angle;
        while (diff >  Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        // Turn at most TURN_SPEED per frame -- the same limit the arrows have,
        // so mouse mode is easier to aim but never unfairly faster.
        const maxTurn = CONFIG.TURN_SPEED * tm;
        this.angle += Math.max(-maxTurn, Math.min(maxTurn, diff));
      }
      // Arrow keys always work (even in mouse mode, as a backup).
      if (kLeft)  this.angle -= CONFIG.TURN_SPEED * tm;
      if (kRight) this.angle += CONFIG.TURN_SPEED * tm;
    }

    // --- 2. Realistic flight. Lift scales with throttle, so cutting the
    // throttle kills your lift and you fall. ---
    applyFlightPhysics(this, this.throttle * CONFIG.THRUST, this.throttle);

    // --- 2b. Throttle = altitude. BELOW half throttle you SINK toward about
    // normal flying speed (so cutting throttle makes you fall). At half throttle
    // or more the sink stops and you slowly climb back to flight -- which takes
    // a few seconds because the engine is slow to spin up. ---
    if (this.throttle < 0.45) {
      const targetSink = (1 - this.throttle) * CONFIG.MAX_SPEED;
      if (this.vy < targetSink) this.vy += (targetSink - this.vy) * CONFIG.IDLE_SINK;
      const spd = Math.hypot(this.vx, this.vy);
      if (spd > CONFIG.MAX_SPEED) {
        this.vx = (this.vx / spd) * CONFIG.MAX_SPEED;
        this.vy = (this.vy / spd) * CONFIG.MAX_SPEED;
      }
    }

    // --- 3. Actually move (and loop around the world sideways) ---
    this.x = wrapX(this.x + this.vx);
    this.y += this.vy;

    // --- 4. Touching the ground. We just note it here (hitGround); the game
    // decides what it means: a safe roll during takeoff, or a fatal crash
    // while flying.
    this.hitGround = false;
    if (this.y > CONFIG.GROUND_Y - 6) {
      this.y = CONFIG.GROUND_Y - 6;
      this.impactVy = this.vy;       // remember how hard we touched down
      if (this.vy > 0) this.vy = 0;  // stop falling through it
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

    // Count power-up timers down toward 0.
    if (this.invincibleTimer > 0) this.invincibleTimer -= 1;
    if (this.wideTimer > 0) this.wideTimer -= 1;
    if (this.frozenTimer > 0) this.frozenTimer -= 1;

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
  // force = true (used by the ∞ Missiles spam) skips the ammo check.
  fireMissile(missiles, planes, force) {
    if (!force) {
      if (this.missiles <= 0) return;
      this.missiles -= 1;
    }

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
    // click + whoosh on a normal launch (skip the 300/sec spam, or it's chaos).
    if (!force && typeof Sound !== 'undefined') Sound.missileLaunch();
  }

  // Try to fire the gun. If the cooldown is ready, make a new bullet at the
  // nose and add it to the bullets list. (game.js calls this when SPACE held.)
  tryShoot(bullets) {
    if (this.fireCooldown > 0) return; // not ready yet

    // Find the tip of the nose (in front, in the facing direction).
    const noseX = this.x + Math.cos(this.angle) * 17;
    const noseY = this.y + Math.sin(this.angle) * 17;

    // With the turret power-up, fire 5 bullets in a wide fan; otherwise 1.
    if (this.wideTimer > 0) {
      for (let i = -2; i <= 2; i++) {
        const a = this.angle + i * CONFIG.WIDE_SHOT_SPREAD;
        bullets.push(new Bullet(noseX, noseY, a, this.vx, this.vy,
                                this.team, CONFIG.COLORS.bullet, this.faction));
      }
    } else {
      bullets.push(new Bullet(noseX, noseY, this.angle, this.vx, this.vy,
                              this.team, CONFIG.COLORS.bullet, this.faction));
    }

    // Start the cooldown so the next shot has to wait a bit.
    this.fireCooldown = CONFIG.FIRE_COOLDOWN;
    if (typeof Sound !== 'undefined') Sound.gun();   // rat-a-tat machine-gun sound
  }

  // Draw the plane on screen (worldToScreenX handles the looping world).
  draw(ctx) {
    const sx = worldToScreenX(this.x), sy = this.y - camera.y;

    // --- Battle damage: smoke when hurt, smoke + fire when badly hurt ---
    const hf = this.health / CONFIG.PLAYER_HEALTH;
    if (hf <= 0.75 && this.alive) {
      for (let i = 1; i <= 4; i++) {            // smoke trailing behind the tail
        const back = 16 + i * 7;
        const px = sx - Math.cos(this.angle) * back;
        const py = sy - Math.sin(this.angle) * back - i;
        const wob = Math.sin(frameCount * 0.3 + i) * 2;
        ctx.fillStyle = 'rgba(70,70,70,' + (0.45 - i * 0.08) + ')';
        ctx.beginPath(); ctx.arc(px + wob, py, 2 + i * 1.3, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (hf <= 0.25 && this.alive) {             // flames near the engine
      const fx = sx - Math.cos(this.angle) * 4;
      const fy = sy - Math.sin(this.angle) * 4;
      ctx.fillStyle = '#ff7a1a';
      ctx.beginPath(); ctx.arc(fx + Math.sin(frameCount * 0.6) * 2, fy, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffce54';
      ctx.beginPath(); ctx.arc(fx, fy - 1, 2.4, 0, Math.PI * 2); ctx.fill();
    }

    // Alien Invasion: the "it" player flies a UFO instead of a plane.
    if (mode === 'alien' && this.isUfo) {
      drawUfoCraft(ctx, sx, sy, this.propSpin, true);
      return;
    }

    // Default: your chosen plane color (from the Color customizer), else blue.
    let set = (typeof playerSpriteSet !== 'undefined' && playerSpriteSet) ? playerSpriteSet : PLANE_SPRITES.player;
    // Split-screen duel: player 1 is BLUE, player 2 is RED (overrides modes).
    if (splitScreen) set = (this.keymap === 'p2') ? PLAYER2_SPRITE : PLANE_SPRITES.player;
    else if (mode === 'unicorn') set = UNICORN_SPRITES.player;
    else if (mode === 'ww2') set = WW2_SPRITES[this.faction];
    else if (mode === 'alien') set = ALIEN_PLANE_SPRITE; // untagged runners are blue
    drawPlaneSprite(ctx, set, sx, sy, this.angle, this.propSpin, this.flash > 0);

    // Shield bubble while invincible.
    if (this.invincibleTimer > 0) {
      ctx.strokeStyle = 'rgba(91,192,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, 26, 0, Math.PI * 2); ctx.stroke();
    }
    // Icy tint while frozen.
    if (this.frozenTimer > 0) {
      ctx.fillStyle = 'rgba(150,220,255,0.35)';
      ctx.beginPath(); ctx.arc(sx, sy, 22, 0, Math.PI * 2); ctx.fill();
    }
  }
}
