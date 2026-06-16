// ===========================================================================
//  ENEMY  --  A computer-controlled plane (a "bot") with its own brain.
//
//  Every bot is its OWN team, so it fights EVERYONE -- the other bots AND you.
//  Each bot also gets its own COLOR and its own flying STYLE (some are aces,
//  some are reckless, some love missiles, some run away when hurt). The smart
//  ones lead their shots, dodge when low on health, and launch homing missiles.
// ===========================================================================

// A palette of distinct bot colors (no blue -- blue is the player).
const BOT_COLORS = [
  '#e74c3c', '#27ae60', '#9b59b6', '#e67e22', '#16a085',
  '#d35400', '#c0392b', '#8e44ad', '#2ecc71', '#f39c12',
  '#e84393', '#00b894', '#fdcb6e', '#a0522d', '#7f8c8d',
];

// Steady "random-looking" number 0..1 from a bot's index (so a bot's style is
// always the same, not jittering every time).
function botRand(i, salt) {
  const v = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

// Build a unique flying style for bot number i, by starting from an archetype
// and nudging the numbers a bit so no two bots fly exactly alike.
function makeBotStyle(i) {
  const archetypes = [
    { name: 'ace',     turn: 1.25, thrust: 1.15, aim: 0.7, fireCd: 0.8, missile: 0.9, evade: 0.5, lead: 1.0,  wobble: 0.0 },
    { name: 'rookie',  turn: 0.85, thrust: 0.9,  aim: 1.6, fireCd: 1.4, missile: 1.6, evade: 0.3, lead: 0.4,  wobble: 0.05 },
    { name: 'acrobat', turn: 1.5,  thrust: 1.05, aim: 1.1, fireCd: 1.0, missile: 1.2, evade: 0.6, lead: 0.7,  wobble: 0.35 },
    { name: 'bomber',  turn: 0.8,  thrust: 0.95, aim: 1.2, fireCd: 1.3, missile: 0.5, evade: 0.2, lead: 0.8,  wobble: 0.0 },
    { name: 'sniper',  turn: 0.95, thrust: 1.0,  aim: 0.5, fireCd: 1.1, missile: 1.0, evade: 0.4, lead: 1.1,  wobble: 0.0 },
    { name: 'kamikaze',turn: 1.3,  thrust: 1.25, aim: 1.3, fireCd: 1.0, missile: 1.3, evade: 0.0, lead: 0.6,  wobble: 0.1 },
    { name: 'coward',  turn: 1.1,  thrust: 1.0,  aim: 1.1, fireCd: 1.2, missile: 1.1, evade: 0.9, lead: 0.7,  wobble: 0.1 },
  ];
  const a = archetypes[i % archetypes.length];
  const j = (salt) => 0.85 + botRand(i, salt) * 0.3; // a small 0.85..1.15 nudge

  return {
    name: a.name,
    turn:    CONFIG.ENEMY_TURN * a.turn * j(1),
    thrust:  CONFIG.ENEMY_THRUST * a.thrust * j(2),
    fireRange: CONFIG.ENEMY_FIRE_RANGE * j(3),
    aim:     CONFIG.ENEMY_AIM * a.aim * j(4),
    fireCd:  Math.round(CONFIG.ENEMY_FIRE_COOLDOWN * a.fireCd * j(5)),
    missileCd: Math.round(CONFIG.ENEMY_MISSILE_COOLDOWN * a.missile * j(6)),
    evade:   a.evade,
    lead:    a.lead,
    wobble:  a.wobble,
    preferredAlt: 120 + botRand(i, 7) * 180, // each likes a different height
  };
}

class Enemy {
  constructor(x, y, team, color, style) {
    this.x = x;
    this.y = y;
    this.vx = -2;
    this.vy = 0;
    this.angle = Math.PI;

    this.team = team;          // every bot has a unique team number
    this.bodyColor = color;    // its color (used for bullets, arrows, sprite)
    this.style = style;        // its flying personality
    this.sprite = makePlaneSetFromColor(color);

    this.health = CONFIG.ENEMY_HEALTH;
    this.alive = true;
    this.respawnTimer = 0;

    this.fireCooldown = Math.floor(botRand(team, 9) * style.fireCd);
    this.missileCooldown = Math.floor(style.missileCd * (0.5 + botRand(team, 8)));
    this.flash = 0;
    this.propSpin = 0;
  }

  update(planes, bullets, missiles) {
    if (!this.alive) {
      this.respawnTimer -= 1;
      if (this.respawnTimer <= 0) this.respawn(planes);
      return;
    }

    if (this.flash > 0) this.flash -= 1;
    if (this.fireCooldown > 0) this.fireCooldown -= 1;
    if (this.missileCooldown > 0) this.missileCooldown -= 1;
    this.propSpin += 1;

    const S = this.style;
    const target = this.findTarget(planes);

    let wantAngle = this.angle;
    if (target) {
      // Smart aim: shoot where the target WILL be, not where it is now.
      const dx = wrapDX(target.x - this.x), dy = target.y - this.y;
      const dist = Math.hypot(dx, dy);
      const lead = (dist / CONFIG.BULLET_SPEED) * S.lead;
      const aimX = target.x + target.vx * lead;
      const aimY = target.y + target.vy * lead;
      wantAngle = Math.atan2(aimY - this.y, wrapDX(aimX - this.x));

      // Hurt + cautious bots run away instead of charging in.
      const flee = this.health <= 1 && dist < 280 && S.evade > 0.45;
      if (flee) wantAngle = Math.atan2(-dy, -dx);

      // Acrobats wiggle as they fly.
      wantAngle += Math.sin(this.propSpin * 0.1) * S.wobble;
    }

    // Stay out of the ground, and dive down before the air gets too thin
    // (so the bots don't stall out up high).
    if (this.y > CONFIG.GROUND_Y - 40) wantAngle = -Math.PI / 2;
    if (this.y < CONFIG.STALL_ALT + 150) wantAngle = Math.PI / 2;

    // Turn the nose smoothly toward where we want to go.
    const diff = angleDiff(wantAngle, this.angle);
    if (diff > 0.02) this.angle += S.turn;
    else if (diff < -0.02) this.angle -= S.turn;

    // Fly (same realistic physics as the player) and loop around the world.
    applyFlightPhysics(this, S.thrust);
    this.x = wrapX(this.x + this.vx);
    this.y += this.vy;
    if (this.y > CONFIG.GROUND_Y - 6) { this.y = CONFIG.GROUND_Y - 6; this.vy = 0; }
    if (this.y < CONFIG.CEILING) { this.y = CONFIG.CEILING; this.vy = 0; }

    // Shoot if we have a target, it's close, and we're aimed at it.
    if (target) {
      const aimErr = Math.abs(angleDiff(
        Math.atan2(target.y - this.y, wrapDX(target.x - this.x)), this.angle));
      const dist = Math.hypot(wrapDX(target.x - this.x), target.y - this.y);

      if (this.fireCooldown <= 0 && dist < S.fireRange && aimErr < S.aim) {
        this.shoot(bullets);
      }
      // Launch a homing missile now and then when lined up at longer range.
      if (this.missileCooldown <= 0 && dist < S.fireRange * 2.2 && aimErr < S.aim * 1.5) {
        missiles.push(new Missile(
          this.x + Math.cos(this.angle) * 17,
          this.y + Math.sin(this.angle) * 17,
          this.angle, this.team, target));
        this.missileCooldown = S.missileCd;
      }
    }
  }

  // Find the closest ALIVE plane that isn't on our team (everyone else!).
  findTarget(planes) {
    let best = null, bestDist = Infinity;
    for (const p of planes) {
      if (p === this || !p.alive || p.team === this.team) continue;
      const dx = wrapDX(p.x - this.x), dy = p.y - this.y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; best = p; }
    }
    return best;
  }

  shoot(bullets) {
    bullets.push(new Bullet(
      this.x + Math.cos(this.angle) * 17,
      this.y + Math.sin(this.angle) * 17,
      this.angle, this.vx, this.vy, this.team, this.bodyColor));
    this.fireCooldown = this.style.fireCd;
  }

  takeHit(damage = 1) {
    this.health -= damage;
    this.flash = 6;
    if (this.health <= 0) {
      this.alive = false;
      this.respawnTimer = CONFIG.ENEMY_RESPAWN;
      return true;
    }
    return false;
  }

  respawn(planes) {
    const player = planes[0];
    const side = botRand(this.team + this.respawnTimer, 1) < 0.5 ? -1 : 1;
    this.x = wrapX(player.x + side * (300 + botRand(this.team, 2) * 400));
    this.y = 40 + botRand(this.team, 3) * 140;
    this.vx = -side * 2;
    this.vy = 0;
    this.angle = side > 0 ? Math.PI : 0;
    this.health = CONFIG.ENEMY_HEALTH;
    this.alive = true;
    this.flash = 0;
  }

  draw(ctx) {
    if (!this.alive) return;
    drawPlaneSprite(ctx, this.sprite, worldToScreenX(this.x),
                    this.y - camera.y, this.angle, this.propSpin, this.flash > 0);
  }
}
