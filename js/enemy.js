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

// The bot "brain" (target-finding, aiming, when to shoot) now lives in the
// shared, page-free js/bot-ai.js so the online server can run the SAME brain.
// These two helpers just point at it. makeBotStyle(i) builds bot i's flying
// personality; botRand gives each bot its steady random sprinkle.
function botRand(i, salt) { return BotAI.rand(i, salt); }
function makeBotStyle(i) { return BotAI.makeStyle(i, CONFIG); }

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
    // Ask the shared brain who to chase, which way to point, and whether to fire.
    const brain = BotAI.think(this, planes, CONFIG, mode === 'ww2');
    const target = brain.target;
    let wantAngle = target ? brain.wantAngle : this.angle;

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
    // Hitting the ground: a bot CRASHES if it comes in too fast or too steep --
    // the very same rule the player has. A gentle, level touch is a safe roll.
    if (this.y > CONFIG.GROUND_Y - 6) {
      const impactVy = this.vy;
      const crash = this.invincibleTimer <= 0 && mode !== 'alien' && mode !== 'blackhole' &&
        (impactVy >= CONFIG.LAND_MAX_VY ||
         Math.abs(angleDiff(this.angle, 0)) >= CONFIG.LAND_MAX_ANGLE);
      this.y = CONFIG.GROUND_Y - 6;
      if (this.vy > 0) this.vy = 0;
      if (crash) this.crashIntoGround();
    }
    if (this.y < CONFIG.CEILING) { this.y = CONFIG.CEILING; this.vy = 0; }

    // Fire / launch a missile when the brain says we're lined up and ready.
    if (brain.shoot) this.shoot(bullets);
    if (brain.missile && target) {
      missiles.push(new Missile(
        this.x + Math.cos(this.angle) * 17,
        this.y + Math.sin(this.angle) * 17,
        this.angle, this.team, target));
      this.missileCooldown = S.missileCd;
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

  // Find the closest ALIVE plane we're allowed to attack (delegates to the
  // shared brain so the eject check and the server agree on "nearest enemy").
  findTarget(planes) {
    return BotAI.findTarget(this, planes, CONFIG, typeof mode !== 'undefined' && mode === 'ww2');
  }

  shoot(bullets) {
    const nx = this.x + Math.cos(this.angle) * 17;
    const ny = this.y + Math.sin(this.angle) * 17;
    const col = CONFIG.COLORS.bullet; // enemy bullets look EXACTLY like yours
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

  // Slammed into the ground: explode, lose your score, and respawn -- exactly
  // like the player crashing.
  crashIntoGround() {
    bigExplosion(this.x, CONFIG.GROUND_Y - 6);
    pushKill('🛩️ ' + this.name + ' crashed 💥', '#ff8a65');
    this.alive = false;
    this.respawnTimer = CONFIG.ENEMY_RESPAWN;
    this.score = 0;
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
    if (splitScreen) set = SPLIT_BOT_SPRITE;            // duel bots are all green
    else if (mode === 'unicorn') set = this.uniSprite;
    else if (mode === 'ww2') set = WW2_SPRITES[this.faction];
    else if (mode === 'alien') set = ALIEN_PLANE_SPRITE; // untagged runners are blue
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
