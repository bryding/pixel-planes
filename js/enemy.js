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

// Goofy names (with emoji) shown on the leaderboard.
const BOT_NAMES = [
  '🐵 Monkey Bananas', '💀 Spooky Steve', '🦖 Dino Dan', '🐸 Sir Hops',
  '🤖 Robo Randy', '🐙 Inky Pete', '👽 Zorp', '🐔 Capt. Cluck',
  '🌮 Taco Tank', '🦄 Sparkle Sam', '🐢 Turbo Tortoise', '🍌 Banana Joe',
  '👻 Boo Crew', '🐝 Buzzy', '🦅 Eagle Eye',
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
    { name: 'ace',     turn: 1.05, thrust: 1.1,  aim: 0.7, fireCd: 1.0, missile: 1.1, evade: 0.5, lead: 1.0,  wobble: 0.0 },
    { name: 'rookie',  turn: 0.8,  thrust: 0.9,  aim: 1.6, fireCd: 1.6, missile: 1.8, evade: 0.3, lead: 0.4,  wobble: 0.03 },
    { name: 'acrobat', turn: 1.2,  thrust: 1.0,  aim: 1.1, fireCd: 1.2, missile: 1.4, evade: 0.6, lead: 0.7,  wobble: 0.12 },
    { name: 'bomber',  turn: 0.75, thrust: 0.95, aim: 1.2, fireCd: 1.4, missile: 0.7, evade: 0.2, lead: 0.8,  wobble: 0.0 },
    { name: 'sniper',  turn: 0.85, thrust: 1.0,  aim: 0.5, fireCd: 1.2, missile: 1.2, evade: 0.4, lead: 1.1,  wobble: 0.0 },
    { name: 'kamikaze',turn: 1.15, thrust: 1.15, aim: 1.3, fireCd: 1.1, missile: 1.4, evade: 0.0, lead: 0.6,  wobble: 0.05 },
    { name: 'coward',  turn: 1.0,  thrust: 1.0,  aim: 1.1, fireCd: 1.3, missile: 1.2, evade: 0.9, lead: 0.7,  wobble: 0.05 },
  ];
  const a = archetypes[i % archetypes.length];
  const j = (salt) => 0.92 + botRand(i, salt) * 0.16; // a gentle 0.92..1.08 nudge

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
  constructor(x, y, team, color, style, name) {
    this.x = x;
    this.y = y;
    this.vx = -2;
    this.vy = 0;
    this.angle = Math.PI;

    this.team = team;          // every bot has a unique team number
    this.faction = 'green';    // WW2 Mode team ('green' / 'black'); set on entry
    this.isUfo = false;        // Alien Invasion (tag) mode: is this a UFO?
    this.tagTarget = null;     // which runner this UFO is assigned to chase
    this.isPlayer = false;
    this.bodyColor = color;    // its color (used for bullets, arrows, sprite)
    this.style = style;        // its flying personality
    this.name = name;          // its goofy leaderboard name
    this.score = 0;            // how many planes it has shot down
    this.sprite = makePlaneSetFromColor(color);
    this.uniSprite = makeUnicornSetFromColor(color); // used in Unicorn Mode

    this.health = CONFIG.ENEMY_HEALTH;
    this.alive = true;
    this.respawnTimer = 0;

    this.fireCooldown = Math.floor(botRand(team, 9) * style.fireCd);
    this.missileCooldown = Math.floor(style.missileCd * (0.5 + botRand(team, 8)));
    this.flash = 0;
    this.propSpin = 0;

    // Power-up timers (bots use power-ups too).
    this.invincibleTimer = 0;
    this.wideTimer = 0;
    this.frozenTimer = 0;
  }

  update(planes, bullets, missiles, powerups) {
    if (!this.alive) {
      this.respawnTimer -= 1;
      if (this.respawnTimer <= 0) this.respawn(planes);
      return;
    }

    if (this.flash > 0) this.flash -= 1;
    if (mode === 'alien') { alienBotFly(this); return; }  // tag mode: chase/flee, no shooting
    if (this.fireCooldown > 0) this.fireCooldown -= 1;
    if (this.missileCooldown > 0) this.missileCooldown -= 1;
    if (this.invincibleTimer > 0) this.invincibleTimer -= 1;
    if (this.wideTimer > 0) this.wideTimer -= 1;
    this.propSpin += 1;

    // Frozen by a bad bubble: no thinking, just drift for a moment.
    if (this.frozenTimer > 0) {
      this.frozenTimer -= 1;
      applyFlightPhysics(this, 0);
      this.x = wrapX(this.x + this.vx);
      this.y += this.vy;
      if (this.y > CONFIG.GROUND_Y - 6) { this.y = CONFIG.GROUND_Y - 6; this.vy = 0; }
      if (this.y < CONFIG.CEILING) { this.y = CONFIG.CEILING; this.vy = 0; }
      return;
    }

    // Bots know when to bail: if they're about to die with an enemy on their
    // tail, they EJECT (a parachute floats down) and respawn instead of dying.
    if (this.health <= 1 && this.invincibleTimer <= 0) {
      const t = this.findTarget(planes);
      if (t) {
        const d = Math.hypot(wrapDX(t.x - this.x), t.y - this.y);
        if (d < 240 && Math.random() < 0.02) {
          spawnBotChute(this.x, this.y, this.bodyColor);
          this.alive = false;
          this.respawnTimer = CONFIG.ENEMY_RESPAWN;
          return;
        }
      }
    }

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

    // Go grab a good power-up bubble if one is close (and skip the bad ones).
    const bub = this.findBubble(powerups);
    if (bub) wantAngle = Math.atan2(bub.y - this.y, wrapDX(bub.x - this.x));

    // Stay off the ground and out of the very top of the sky (the ceiling),
    // but otherwise the bots use the whole height of the map.
    if (this.y > CONFIG.GROUND_Y - 40) wantAngle = -Math.PI / 2;
    if (this.y < CONFIG.CEILING + 80) wantAngle = Math.PI / 2;

    // Turn the nose smoothly toward where we want to go (slower in WW2).
    const tm = (mode === 'ww2') ? CONFIG.WW2_TURN_MULT : 1;
    const diff = angleDiff(wantAngle, this.angle);
    if (diff > 0.02) this.angle += S.turn * tm;
    else if (diff < -0.02) this.angle -= S.turn * tm;

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
      // Launch a homing missile now and then (no missiles in WW2 mode).
      if (mode !== 'ww2' && this.missileCooldown <= 0 && dist < S.fireRange * 2.2 && aimErr < S.aim * 1.5) {
        missiles.push(new Missile(
          this.x + Math.cos(this.angle) * 17,
          this.y + Math.sin(this.angle) * 17,
          this.angle, this.team, target));
        this.missileCooldown = S.missileCd;
      }
    }
  }

  // Find the closest GOOD bubble worth grabbing (skip skulls and buffs we
  // already have). Returns null if none are close enough.
  findBubble(powerups) {
    if (!powerups) return null;
    let best = null, bd = CONFIG.ENEMY_BUBBLE_SEEK_RANGE * CONFIG.ENEMY_BUBBLE_SEEK_RANGE;
    for (const p of powerups) {
      if (p.dead || p.type === 'skull') continue;
      if (p.type === 'shield' && this.invincibleTimer > 0) continue;
      if (p.type === 'turret' && this.wideTimer > 0) continue;
      const dx = wrapDX(p.x - this.x), dy = p.y - this.y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  // Find the closest ALIVE plane we're allowed to attack. In WW2 mode that's
  // anyone on the OTHER faction; otherwise it's anyone not on our team.
  findTarget(planes) {
    const ww2 = (typeof mode !== 'undefined' && mode === 'ww2');
    let best = null, bestDist = Infinity;
    for (const p of planes) {
      if (p === this || !p.alive) continue;
      if (ww2 ? (p.faction === this.faction) : (p.team === this.team)) continue;
      const dx = wrapDX(p.x - this.x), dy = p.y - this.y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; best = p; }
    }
    return best;
  }

  shoot(bullets) {
    const nx = this.x + Math.cos(this.angle) * 17;
    const ny = this.y + Math.sin(this.angle) * 17;
    const col = CONFIG.COLORS.enemyBullet; // all bot bullets look the same
    if (this.wideTimer > 0) { // turret power-up: 5-bullet wide shot
      for (let i = -2; i <= 2; i++) {
        bullets.push(new Bullet(nx, ny, this.angle + i * CONFIG.WIDE_SHOT_SPREAD,
                                this.vx, this.vy, this.team, col, this.faction));
      }
    } else {
      bullets.push(new Bullet(nx, ny, this.angle, this.vx, this.vy, this.team, col, this.faction));
    }
    this.fireCooldown = this.style.fireCd;
  }

  takeHit(damage = 1) {
    if (this.invincibleTimer > 0) return false; // shield
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
    const sx = worldToScreenX(this.x), sy = this.y - camera.y;

    // Alien Invasion: UFOs (the "it" bots) fly saucers instead of planes.
    if (mode === 'alien' && this.isUfo) {
      drawUfoCraft(ctx, sx, sy, this.propSpin, false);
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#7CFC00';
      ctx.fillText(this.name + ' 👽', sx, sy - 22);
      ctx.textAlign = 'left';
      return;
    }

    let set = this.sprite;
    if (mode === 'unicorn') set = this.uniSprite;
    else if (mode === 'ww2') set = WW2_SPRITES[this.faction];
    drawPlaneSprite(ctx, set, sx, sy, this.angle, this.propSpin, this.flash > 0);

    // Nametag floating above the plane (WW2 mode has NO names).
    if (mode !== 'ww2') {
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';        // dark outline for readability
      ctx.fillText(this.name, sx + 1, sy - 21);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(this.name, sx, sy - 22);
      ctx.textAlign = 'left';
    }

    // Shield bubble while this bot is invincible.
    if (this.invincibleTimer > 0) {
      ctx.strokeStyle = 'rgba(91,192,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, 26, 0, Math.PI * 2); ctx.stroke();
    }
  }
}
