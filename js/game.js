// ===========================================================================
//  GAME  --  The main file. It sets up the screen, runs the game loop
//  (which repeats about 60 times a second), and draws everything.
// ===========================================================================

// Grab the canvas (the drawing box) from the page.
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Make the canvas the small "pixel" size from config.
canvas.width = CONFIG.GAME_W;
canvas.height = CONFIG.GAME_H;

// Keep the pixels crisp (not blurry) when we stretch the picture bigger.
ctx.imageSmoothingEnabled = false;

// Stretch the canvas to fill the window while keeping its shape.
function resize() {
  const scaleX = window.innerWidth / CONFIG.GAME_W;
  const scaleY = window.innerHeight / CONFIG.GAME_H;
  const scale = Math.min(scaleX, scaleY); // pick the smaller so it always fits
  canvas.style.width = CONFIG.GAME_W * scale + 'px';
  canvas.style.height = CONFIG.GAME_H * scale + 'px';
}
window.addEventListener('resize', resize);
resize();

// --- Make the player's plane and the camera ---
const player = new Plane(100, 120);

// The camera's x keeps counting up/down smoothly (it never jumps), even as the
// world loops -- that keeps the background from popping at the seam.
const camera = { x: 0, y: 0 };

// Turn a world x into a screen x, picking the copy of it (the world loops)
// that is closest to the middle of the screen.
function worldToScreenX(wx) {
  const W = CONFIG.WORLD_WIDTH;
  const center = camera.x + CONFIG.GAME_W / 2;
  const copy = wx + Math.round((center - wx) / W) * W;
  return copy - camera.x;
}

// The list of bullets that are flying right now. Starts empty.
const bullets = [];

// The list of homing missiles flying right now.
const missiles = [];

// Remember if X / C were held last frame, so one press = one action.
let missileWasDown = false;
let ejectWasDown = false;

// The list of explosions playing right now (just for looks).
const explosions = [];

// Floating power-up bubbles, and a timer for spawning more.
const powerups = [];
let powerupTimer = 120;

// Cosmetic parachutes from bots that ejected (just for looks).
const botChutes = [];
function spawnBotChute(x, y, color) {
  botChutes.push({ x: x, y: y, vx: (Math.random() - 0.5) * 1.4, vy: 0.5, color: color, life: 320 });
}

// Make the bots. Each one gets its OWN team number (so it fights everyone),
// its OWN color, and its OWN flying style. They're spread around the world.
const enemies = [];
for (let i = 0; i < CONFIG.ENEMY_COUNT; i++) {
  const ex = wrapX(200 + i * (CONFIG.WORLD_WIDTH / CONFIG.ENEMY_COUNT));
  const ey = 60 + (i * 53) % 180;
  enemies.push(new Enemy(ex, ey, i + 1, BOT_COLORS[i % BOT_COLORS.length],
                         makeBotStyle(i), BOT_NAMES[i % BOT_NAMES.length]));
}

// One list with EVERY plane in it (player first, then bots).
const planes = [player, ...enemies];

// Next unique team number for any bots added with the on-screen buttons.
let nextTeam = CONFIG.ENEMY_COUNT + 1;

// Button 1: add another fighting bot near the action.
function addBot() {
  const i = nextTeam;
  const focus = (playerState === 'chute' && pilot) ? pilot : player;
  const ex = wrapX(focus.x + (Math.random() < 0.5 ? -1 : 1) * (450 + Math.random() * 400));
  const ey = 50 + Math.random() * 180;
  const e = new Enemy(ex, ey, nextTeam, BOT_COLORS[i % BOT_COLORS.length],
                      makeBotStyle(i), BOT_NAMES[i % BOT_NAMES.length]);
  nextTeam += 1;
  if (mode === 'ww2') { // keep the black team topped up to its size
    const blacks = enemies.filter(x => x.faction === 'black').length;
    e.faction = (blacks < CONFIG.WW2_BLACK_COUNT) ? 'black' : 'green';
  }
  enemies.push(e);
  planes.push(e);
}

// Button 2: remove one fighting bot.
function removeBot() {
  if (!enemies.length) return;
  const e = enemies.pop();
  const idx = planes.indexOf(e);
  if (idx >= 0) planes.splice(idx, 1);
}

// Add a whole swarm of bots at once.
function addManyBots(n) {
  for (let i = 0; i < n; i++) addBot();
}

// Remove every bot (leaving just the player).
function removeAllBots() {
  enemies.length = 0;
  planes.length = 1; // planes[0] is the player; drop the rest
}

// ---- Game mode (Classic / Unicorn / Bad Weather / WW2 / No-Mod) ----
let mode = 'classic';
let greenScore = 0, blackScore = 0; // WW2 team scores
function setMode(m) {
  const prev = mode;
  mode = m;
  // "No Mod Mode" hides the whole Modifier Menu and turns the cheats off.
  const modGroup = document.getElementById('modGroup');
  if (modGroup) modGroup.style.display = (m === 'nomod') ? 'none' : 'flex';
  if (m === 'nomod') {
    timeScale = 1;
    infiniteHealth = false;
    infiniteMissiles = false;
  }
  if (m === 'ww2') assignWW2Factions();
  if (m === 'alien') startAlien();
  if (m === 'blackhole') startBlackHole();
  // Leaving a space mini-game -> put a normal flying plane back.
  if ((prev === 'alien' || prev === 'blackhole') && m !== 'alien' && m !== 'blackhole') spawnPlane(100);
}

// Put the player on GREEN and split the bots: the first few are BLACK,
// the rest GREEN. Reset the team scores.
function assignWW2Factions() {
  player.faction = 'green';
  greenScore = 0;
  blackScore = 0;
  enemies.forEach((e, i) => { e.faction = (i < CONFIG.WW2_BLACK_COUNT) ? 'black' : 'green'; });
}
function toggleModeMenu() {
  const m = document.getElementById('modeMenu');
  m.style.display = (m.style.display === 'none' || !m.style.display) ? 'flex' : 'none';
}

// ---- Bad Weather lightning ----
const lightnings = [];        // active lightning bolts (just for drawing)
let lightningTimer = CONFIG.BW_LIGHTNING_INTERVAL;
let lightningFlash = 0;

// Strike a random plane with lightning. You're more likely to be hit the
// HIGHER you are -- except at the very top of the sky, where you're safe.
function lightningStrike() {
  const safeTop = CONFIG.CEILING + 160; // above this height = safe from lightning
  const cands = [];
  // A shielded/invincible player is never picked.
  if (playerState === 'flying' && player.y > safeTop && player.invincibleTimer <= 0) cands.push(player);
  for (const e of enemies) if (e.alive && e.y > safeTop) cands.push(e);
  if (!cands.length) return;

  let total = 0;
  const weights = cands.map(p => { const w = Math.max(20, CONFIG.GROUND_Y - p.y); total += w; return w; });
  let r = Math.random() * total, pick = cands[cands.length - 1];
  for (let i = 0; i < cands.length; i++) { r -= weights[i]; if (r <= 0) { pick = cands[i]; break; } }

  lightnings.push({ x: pick.x, y: pick.y, life: 14 });
  lightningFlash = 8;
  bigExplosion(pick.x, pick.y);
  if (pick === player) {
    pushKill('⚡ YOU were struck by lightning', '#ffe066');
    playerDies(player.x, player.y, 'STRUCK BY LIGHTNING!');
  } else {
    pushKill('⚡ ' + pick.name + ' struck by lightning', '#ffe066');
    pick.alive = false;
    pick.respawnTimer = CONFIG.ENEMY_RESPAWN;
  }
}

// ---- Modifier / cheat menu state & actions ----
let timeScale = 1;          // game-speed multiplier (0.5 = slow, 2 = fast)
let infiniteHealth = false;
let infiniteMissiles = false;

function toggleModMenu() {
  const m = document.getElementById('modMenu');
  m.style.display = (m.style.display === 'none' || !m.style.display) ? 'flex' : 'none';
}
function setHalfSpeed(btn) {
  timeScale = Math.max(0.125, timeScale * 0.5);   // stacks: 1 -> .5 -> .25 ...
  btn.textContent = '0.5x Speed (now ' + timeScale + 'x)';
}
function setDoubleSpeed(btn) {
  timeScale = Math.min(16, timeScale * 2);        // stacks: 1 -> 2 -> 4 ...
  btn.textContent = '2x Speed (now ' + timeScale + 'x)';
}
// Spawn a power-up BUBBLE of a chosen kind somewhere on the map.
function spawnPowerUpAt(type) {
  const px = Math.random() * CONFIG.WORLD_WIDTH;
  const py = 70 + Math.random() * (CONFIG.GROUND_Y - 160);
  powerups.push(new PowerUp(px, py, type));
}
function spawnShieldBubble() { spawnPowerUpAt('shield'); }
function spawnBulletBubble() { spawnPowerUpAt('turret'); }
function spawnFreezeBubble() { spawnPowerUpAt('skull'); }

// Give the power straight to the player. Timers STACK (add up) if you press
// the button again while it's still active.
function giveShield()  { player.invincibleTimer += CONFIG.SHIELD_TIME; }
function giveBullet()  { player.wideTimer += CONFIG.WIDE_SHOT_TIME; }
function giveFreeze()  { player.frozenTimer += CONFIG.FREEZE_TIME; }

// Give EVERY bot both good powers (shield + wide shot) at once.
function giveAllBotsPower() {
  for (const e of enemies) {
    e.invincibleTimer += CONFIG.SHIELD_TIME;
    e.wideTimer += CONFIG.WIDE_SHOT_TIME;
  }
}

// Give EVERY bot one chosen power: 'shield', 'turret', or 'freeze'.
function giveAllBots(type) {
  for (const e of enemies) {
    if (type === 'shield') e.invincibleTimer += CONFIG.SHIELD_TIME;
    else if (type === 'turret') e.wideTimer += CONFIG.WIDE_SHOT_TIME;
    else if (type === 'freeze') e.frozenTimer += CONFIG.FREEZE_TIME;
  }
}
function toggleInfHealth()   { infiniteHealth = !infiniteHealth; return infiniteHealth; }
function toggleInfMissiles() { infiniteMissiles = !infiniteMissiles; return infiniteMissiles; }

// Reset every modifier back to its default.
function resetDefaults() {
  timeScale = 1;
  infiniteHealth = false;
  infiniteMissiles = false;
  player.invincibleTimer = 0;
  player.wideTimer = 0;
  player.frozenTimer = 0;
  removeAllBots();
  for (let i = 0; i < CONFIG.ENEMY_COUNT; i++) addBot();
  const set = (id, txt) => { const b = document.getElementById(id); if (b) b.textContent = txt; };
  set('halfBtn', '0.5x Speed');
  set('dblBtn', '2x Speed');
  set('hpBtn', '∞ Health: OFF');
  set('missBtn', '∞ Missiles: OFF');
}

// Your points. They grow when you shoot bots down. They RESET if you die,
// but you keep them if you eject and parachute safely to the barn.
let score = 0;

// The player can be 'flying', 'chute' (parachuting after ejecting), or 'dead'.
let playerState = 'flying';
let pilot = null;        // the parachuting pilot, when ejected
let playerRespawn = 0;   // counts down while dead, then a fresh plane flies in
let frameCount = 0;      // ticks up every frame (used for blinking warnings)
let paused = false;      // ESC pauses/unpauses the game

// ESC toggles pause. (e.repeat guard so holding the key doesn't flicker it.)
window.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && !e.repeat) paused = !paused;
});
let deathMsg = 'SHOT DOWN!'; // what the middle-of-screen death message says

// The "who killed who" kill feed (newest first). Each entry fades out.
const killFeed = [];
function pushKill(text, color) {
  killFeed.unshift({ text: text, color: color, life: 360 });
  if (killFeed.length > 7) killFeed.pop();
}

// Start the game sitting on the ground, ready to take off.
spawnPlane(100);

// A simple "did these two things touch?" check (using the looping distance).
function hits(a, b, radius) {
  const dx = wrapDX(a.x - b.x);
  const dy = a.y - b.y;
  return dx * dx + dy * dy < radius * radius;
}

// Start a fresh plane ON THE GROUND at world x, and roll into a takeoff.
function spawnPlane(x) {
  player.alive = true;
  player.health = CONFIG.PLAYER_HEALTH;
  player.x = wrapX(x);
  player.y = CONFIG.GROUND_Y - 6;   // sitting on the ground
  player.vx = 0.5; player.vy = 0;
  player.angle = -0.12;             // nose tipped up a touch
  player.flash = 0;
  player.throttle = 1;              // full power for the takeoff roll
  player.missiles = CONFIG.MISSILE_MAX;
  player.missileTimer = 0;
  player.hitGround = true;
  playerState = 'takeoff';
  pilot = null;
  explosions.push(new Explosion(player.x - 8, CONFIG.GROUND_Y - 2, '#cbb58a')); // dust
}

// A big fireball boom for crashes and destroyed planes.
function bigExplosion(x, y) {
  explosions.push(new Explosion(x, y, '#ffce54', true)); // fireball ring
  explosions.push(new Explosion(x, y, '#ff7a1a'));
  explosions.push(new Explosion(x - 10, y - 6, '#ff5a4a'));
  explosions.push(new Explosion(x + 10, y - 4, '#ffce54'));
  explosions.push(new Explosion(x, y - 8, '#888888')); // smoke
}

// Press C to bail out: the plane is lost and the pilot floats down.
function eject() {
  // In Bad Weather, bailing out gets you struck by lightning instantly!
  // (unless you have a shield -- then nothing can kill you.)
  if (mode === 'badweather' && player.invincibleTimer <= 0) {
    lightnings.push({ x: player.x, y: player.y, life: 14 });
    lightningFlash = 8;
    bigExplosion(player.x, player.y);
    pushKill('⚡ YOU ejected into the storm', '#ffe066');
    playerDies(player.x, player.y, 'STRUCK BY LIGHTNING!');
    return;
  }
  explosions.push(new Explosion(player.x, player.y, '#bbbbbb'));
  explosions.push(new Explosion(player.x, player.y, '#ff5a4a'));
  pilot = new Pilot(player.x, player.y);
  player.alive = false; // the plane is gone (bots stop chasing it)
  playerState = 'chute';
}

// You died (shot down, crashed, or parachuted into a field): points RESET.
function playerDies(x, y, msg) {
  deathMsg = msg || 'SHOT DOWN!';
  score = 0;
  player.alive = false;
  pilot = null;
  playerState = 'dead';
  playerRespawn = CONFIG.PLAYER_RESPAWN;
}

// You parachuted to the barn: respawn at the barn and KEEP your points.
function rescueAtBarn() {
  explosions.push(new Explosion(pilot.x, pilot.y, '#2ecc71')); // green "safe!" poof
  spawnPlane(BARN_X);
}

// While parachuting/walking, the pilot can be killed by enemy fire or by a
// plane running into them. If so, you die and your points reset.
function checkPilotHit() {
  if (!pilot) return;
  const hitBy = (list, r) => list.some(o => o.team !== 0 && hits(o, pilot, r));
  let dead = hitBy(bullets, 8) || hitBy(missiles, 12);
  if (!dead) dead = enemies.some(e => e.alive && hits(e, pilot, 16)); // ran over
  if (dead) {
    bigExplosion(pilot.x, pilot.y);
    pushKill('🛩️ YOUR PILOT down 💥', '#ff8a65');
    playerDies(pilot.x, pilot.y, 'PILOT DOWN!');
  }
}

// Called when any plane is popped. Adds a boom, scores it if YOU did it, and
// handles your own death (points reset).
function onPlanePopped(target, shooterTeam, shooterFaction) {
  bigExplosion(target.x, target.y);
  if (mode === 'ww2') {
    // Team scoring; no names/kill feed in WW2.
    if (shooterFaction === 'green') greenScore += 1;
    else if (shooterFaction === 'black') blackScore += 1;
  } else {
    const victimName = (target === player) ? '🛩️ YOU' : target.name;
    let killerName = '🛩️ YOU', killerColor = '#7fbdef';
    if (shooterTeam === 0) {
      score += 1;
    } else {
      const shooter = enemies.find(e => e.team === shooterTeam);
      if (shooter) { shooter.score += 1; killerName = shooter.name; killerColor = shooter.bodyColor; }
    }
    pushKill(killerName + '  ›❌  ' + victimName, killerColor);
  }

  if (target === player) {
    playerDies(player.x, player.y, 'SHOT DOWN!'); // your points reset
  }
}

// Draw the leaderboard panel on the right side: who has the most points.
function drawLeaderboard() {
  const rows = [{ name: '🛩️ YOU', score: score, you: true }];
  for (const e of enemies) rows.push({ name: e.name, score: e.score });
  rows.sort((a, b) => b.score - a.score);
  const top = rows.slice(0, 8);

  const w = 220, rh = 17, x = CONFIG.GAME_W - w - 34, y = 28;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(x, y, w, 22 + top.length * rh);
  ctx.fillStyle = '#ffd23f';
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('LEADERBOARD', x + 8, y + 15);
  ctx.font = '11px monospace';
  top.forEach((e, i) => {
    const ty = y + 31 + i * rh;
    ctx.fillStyle = e.you ? '#7fbdef' : '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText((i + 1) + '. ' + e.name, x + 8, ty);
    ctx.textAlign = 'right';
    ctx.fillText('' + e.score, x + w - 8, ty);
  });
  ctx.textAlign = 'left';
}

// =========================================================================
//  UPDATE  --  move everything (runs every frame)
// =========================================================================
function update() {
  // Work out "fresh press" of X (missile) and C (eject).
  const missilePressed = Input.missile && !missileWasDown;
  const ejectPressed = Input.eject && !ejectWasDown;
  missileWasDown = Input.missile;
  ejectWasDown = Input.eject;

  // --- The player, depending on what state they're in ---
  if (playerState === 'takeoff') {
    // Rolling down the "runway": full power, nose held up, until we lift off.
    player.throttle = 1;
    player.angle = -0.3;            // hold ~17 degrees nose-up for the climb-out
    player.update();
    if (frameCount % 5 === 0) {
      const sxw = player.x - Math.cos(player.angle) * 10, syw = CONFIG.GROUND_Y - 2;
      if (mode === 'badweather') {
        explosions.push(new Explosion(sxw, syw, '#6b8fb0')); // water spray
        explosions.push(new Explosion(sxw, syw, '#4a3a22')); // mud spray
      } else {
        explosions.push(new Explosion(sxw, syw, '#cbb58a')); // dust
      }
    }
    if (player.y <= CONFIG.GROUND_Y - 55) playerState = 'flying'; // airborne!
  } else if (playerState === 'flying' && mode === 'alien' && player.isUfo) {
    // --- Alien Invasion: YOU are the UFO. It does NOT fly like a plane --
    // the arrow keys move it straight up/down/left/right. Touching a runner
    // tags them (handled in alienTagStep). No guns, no crashing.
    let dx = 0, dy = 0;
    if (Input.left)  dx -= 1;
    if (Input.right) dx += 1;
    if (Input.up)    dy -= 1;
    if (Input.down)  dy += 1;
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      player.vx = (dx / len) * CONFIG.UFO_SPEED;
      player.vy = (dy / len) * CONFIG.UFO_SPEED;
    } else {
      player.vx *= 0.8; player.vy *= 0.8;   // coast to a stop when no key held
    }
    player.x = wrapX(player.x + player.vx);
    player.y += player.vy;
    if (player.y > CONFIG.GROUND_Y - 6) { player.y = CONFIG.GROUND_Y - 6; player.vy = 0; }
    if (player.y < CONFIG.CEILING) { player.y = CONFIG.CEILING; player.vy = 0; }
    player.propSpin += 1;
  } else if (playerState === 'flying') {
    player.update();
    // Touching the ground: a gentle, level touchdown is a safe landing (you
    // just roll); coming in too fast or too steep is a fatal crash.
    // No ground crashes in the space modes (Alien tag / Black Hole).
    const hardLanding = mode !== 'alien' && mode !== 'blackhole' && player.hitGround && player.invincibleTimer <= 0 &&
      (player.impactVy >= CONFIG.LAND_MAX_VY ||
       Math.abs(angleDiff(player.angle, 0)) >= CONFIG.LAND_MAX_ANGLE);
    if (hardLanding) {
      bigExplosion(player.x, CONFIG.GROUND_Y - 6);
      pushKill('🛩️ YOU crashed 💥', '#ff8a65');
      playerDies(player.x, CONFIG.GROUND_Y - 6, 'CRASHED!');
    } else if (player.frozenTimer <= 0 && mode !== 'alien') {
      // Flying (or safely rolling on the ground): normal controls.
      // WW2 mode has NO missiles and NO ejecting.
      if (Input.fire) player.tryShoot(bullets);
      if (missilePressed && mode !== 'ww2') player.fireMissile(missiles, planes);
      if (ejectPressed && mode !== 'ww2') eject();
    }
  } else if (playerState === 'chute') {
    if (ejectPressed) pilot.toggleChute(); // press C to open/close the parachute
    pilot.update();
    const inv = player.invincibleTimer > 0; // shield = can't die from anything
    // Reach the big barn (drifting OR walking) -> rescued, keep your points.
    if (Math.abs(wrapDX(pilot.x - BARN_X)) < CONFIG.BARN_RESCUE_RANGE) {
      rescueAtBarn();
    } else if (inv) {
      if (pilot.landed) rescueAtBarn(); // shielded pilots always make it
    } else if (pilot.landed && !pilot.chuteOpen) {
      // Splat -- hit the ground before opening the parachute.
      bigExplosion(pilot.x, pilot.y);
      pushKill('🛩️ YOUR PILOT splatted 💥', '#ff8a65');
      playerDies(pilot.x, pilot.y, 'NO CHUTE!');
    } else {
      checkPilotHit(); // a bullet, missile, or plane can kill the pilot
    }
  } else { // 'dead'
    playerRespawn -= 1;
    if (playerRespawn <= 0) spawnPlane(camera.x + CONFIG.GAME_W / 2);
  }

  // Cheats from the modifier menu. Infinite Health = TRULY unkillable: we keep
  // health full AND keep the invincibility flag on, which already blocks bullets,
  // missiles, crashes, lightning, pilot death -- and (in UFO Tag) being tagged.
  if (infiniteHealth) {
    player.health = CONFIG.PLAYER_HEALTH;
    if (player.invincibleTimer < 2) player.invincibleTimer = 2;
  }
  if (infiniteMissiles) { player.missiles = CONFIG.MISSILE_MAX; player.missileTimer = 0; }

  // Alien Invasion: spread the UFO bots across different runners first.
  if (mode === 'alien') assignUfoTargets();

  // --- The bots (each one thinks for itself; they can fire missiles too) ---
  for (const enemy of enemies) {
    enemy.update(planes, bullets, missiles, powerups);
  }

  // Alien Invasion: UFOs tag nearby flyers, then check for a round winner.
  if (mode === 'alien') alienTagStep();

  // Black Hole: pull everything toward the hole and crush whatever falls in.
  if (mode === 'blackhole') blackHoleStep();

  // --- Bullets: move them and check if they hit any plane ---
  for (const bullet of bullets) {
    bullet.update();

    for (const target of planes) {
      if (!target.alive) continue;               // can't hit a downed plane
      // Friendly fire is off for your own team (WW2 = faction; otherwise team).
      const friendly = (mode === 'ww2') ? (target.faction === bullet.faction)
                                        : (target.team === bullet.team);
      if (friendly) continue;
      if (hits(bullet, target, 14)) {
        bullet.dead = true;
        const popped = target.takeHit();
        if (popped) onPlanePopped(target, bullet.team, bullet.faction);
        break;
      }
    }
  }

  // --- Missiles: move them, then check if they hit a plane ---
  for (const missile of missiles) {
    missile.update();

    for (const target of planes) {
      if (!target.alive) continue;
      if (target.team === missile.team) continue;
      if (hits(missile, target, 16)) {
        missile.dead = true;
        explosions.push(new Explosion(missile.x, missile.y, CONFIG.COLORS.explosion));
        const popped = target.takeHit(CONFIG.MISSILE_DAMAGE); // ~2 missiles = dead
        if (popped) onPlanePopped(target, missile.team);
        break;
      }
    }
  }

  // --- Power-ups: spawn over time, float, and get collected (not in tag mode) ---
  powerupTimer -= 1;
  if (powerupTimer <= 0 && mode !== 'alien') { spawnPowerUp(); powerupTimer = CONFIG.POWERUP_INTERVAL; }
  for (const p of powerups) p.update();
  if (playerState === 'flying' || playerState === 'takeoff') {
    for (const p of powerups) {
      if (!p.dead && hits(p, player, CONFIG.POWERUP_RADIUS + 14)) {
        p.dead = true;
        applyPowerUp(p.type);
      }
    }
  }
  // Bots collect bubbles too.
  for (const e of enemies) {
    if (!e.alive) continue;
    for (const p of powerups) {
      if (!p.dead && hits(p, e, CONFIG.POWERUP_RADIUS + 14)) {
        p.dead = true;
        applyPowerUpToBot(e, p.type);
      }
    }
  }

  // --- Bad Weather lightning: strike someone every few seconds ---
  if (mode === 'badweather') {
    lightningTimer -= 1;
    if (lightningTimer <= 0) { lightningStrike(); lightningTimer = CONFIG.BW_LIGHTNING_INTERVAL; }
  }
  for (let i = lightnings.length - 1; i >= 0; i--) {
    lightnings[i].life -= 1;
    if (lightnings[i].life <= 0) lightnings.splice(i, 1);
  }
  if (lightningFlash > 0) lightningFlash -= 1;

  // --- Bot parachutes drifting down (cosmetic) ---
  for (const c of botChutes) {
    c.vy = Math.min(0.9, c.vy + 0.02);
    c.x = wrapX(c.x + c.vx);
    c.y += c.vy;
    if (c.y >= CONFIG.GROUND_Y - 4) { c.y = CONFIG.GROUND_Y - 4; c.life -= 6; }
    c.life -= 1;
  }

  // --- Explosions (just animate the sparks) ---
  for (const boom of explosions) boom.update();

  // --- Clean up: forget dead bullets and finished explosions ---
  for (let i = bullets.length - 1; i >= 0; i--) {
    if (bullets[i].dead) bullets.splice(i, 1);
  }
  for (let i = missiles.length - 1; i >= 0; i--) {
    if (missiles[i].dead) missiles.splice(i, 1);
  }
  for (let i = explosions.length - 1; i >= 0; i--) {
    if (explosions[i].dead) explosions.splice(i, 1);
  }
  for (let i = powerups.length - 1; i >= 0; i--) {
    if (powerups[i].dead) powerups.splice(i, 1);
  }
  for (let i = botChutes.length - 1; i >= 0; i--) {
    if (botChutes[i].life <= 0) botChutes.splice(i, 1);
  }
  for (let i = killFeed.length - 1; i >= 0; i--) {
    killFeed[i].life -= 1;
    if (killFeed[i].life <= 0) killFeed.splice(i, 1);
  }

  // The camera follows the plane normally, or the pilot while parachuting.
  const focus = (playerState === 'chute' && pilot) ? pilot : player;
  const targetX = focus.x - CONFIG.GAME_W / 2 + (focus.vx || 0) * CONFIG.CAM_LOOKAHEAD * 0.1;
  const targetY = focus.y - CONFIG.GAME_H / 2;

  // Smoothly slide the camera toward the target. wrapDX lets it follow the
  // player straight across the loop seam without a jump.
  camera.x += wrapDX(targetX - camera.x) * CONFIG.CAM_SMOOTH;
  camera.y += (targetY - camera.y) * CONFIG.CAM_SMOOTH;

  // Don't let the camera show too far below the ground, but DO leave room
  // to see the countryside (trees, barns, haybales) when flying low.
  const maxCamY = CONFIG.GROUND_Y - CONFIG.GAME_H + 140;
  if (camera.y > maxCamY) camera.y = maxCamY;
}

// =========================================================================
//  DRAW  --  paint everything onto the screen (runs every frame)
// =========================================================================
function draw() {
  const C = CONFIG.COLORS;

  const uni = (mode === 'unicorn');
  const night = (mode === 'night');
  const alien = (mode === 'alien');
  const bh = (mode === 'blackhole');
  const space = alien || bh;            // modes with no ground & a starry void

  // --- Sky (candy / stormy / night / space / day) ---
  const storm = (mode === 'badweather');
  const sky = ctx.createLinearGradient(0, 0, 0, CONFIG.GAME_H);
  if (uni) { sky.addColorStop(0, '#bfe3ff'); sky.addColorStop(1, '#ffe1f3'); }
  else if (storm) { sky.addColorStop(0, '#262d3a'); sky.addColorStop(1, '#3c4452'); }
  else if (night) { sky.addColorStop(0, '#0a1230'); sky.addColorStop(1, '#1b2848'); }
  else if (alien) { sky.addColorStop(0, '#03020a'); sky.addColorStop(1, '#0b0820'); }
  else if (bh) { sky.addColorStop(0, '#060312'); sky.addColorStop(1, '#0e0524'); }
  else { sky.addColorStop(0, C.skyTop); sky.addColorStop(1, C.skyBottom); }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CONFIG.GAME_W, CONFIG.GAME_H);

  // --- Alien Invasion: deep space -- lots of stars, a crescent moon, planets ---
  if (alien) drawSpaceSky();
  // --- Black Hole: stars + the swirling accretion disk (behind the planes) ---
  if (bh) drawBlackHoleGlow();

  // --- Night: stars and a crescent moon ---
  if (night) {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 150; i++) {
      ctx.fillRect((i * 173) % CONFIG.GAME_W, (i * 97) % Math.floor(CONFIG.GAME_H * 0.7), 2, 2);
    }
    const mx = CONFIG.GAME_W * 0.82, my = CONFIG.GAME_H * 0.18;
    ctx.fillStyle = '#eef0d8';
    ctx.beginPath(); ctx.arc(mx, my, 42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0a1230'; // carve the crescent with the sky color
    ctx.beginPath(); ctx.arc(mx + 16, my - 8, 40, 0, Math.PI * 2); ctx.fill();
  }

  // --- Unicorn Mode: a big rainbow planted over the big barn (it stays put
  // in the world; the barn sits at the bottom-middle of it) ---
  if (uni) {
    const rcx = worldToScreenX(BARN_X);            // centered on the big barn
    const rcy = CONFIG.GROUND_Y - camera.y;         // rooted at the ground
    const rain = ['#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6'];
    const baseR = CONFIG.GAME_W * 0.45;
    ctx.lineWidth = 18;
    ctx.globalAlpha = 0.55;
    rain.forEach((col, i) => {
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.arc(rcx, rcy, baseR - i * 18, Math.PI, Math.PI * 2);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  // --- Soft vintage sun with a warm glow (hidden during storm/night/space) ---
  if (!storm && !night && !space) {
    const sunX = CONFIG.GAME_W * 0.80, sunY = CONFIG.GAME_H * 0.20;
    const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 240);
    glow.addColorStop(0, 'rgba(255,246,214,0.95)');
    glow.addColorStop(0.25, 'rgba(255,236,178,0.45)');
    glow.addColorStop(1, 'rgba(255,236,178,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 240, sunY - 240, 480, 480);
    ctx.fillStyle = '#fff4d6';
    ctx.beginPath(); ctx.arc(sunX, sunY, 28, 0, Math.PI * 2); ctx.fill();
  }

  // --- Clouds, far hills, and the treeline on the horizon (not in space) ---
  if (!space) drawBackgroundScenery(ctx, camera);

  // --- Ground. Alien = cratered moon; Black Hole = empty space (no ground);
  // otherwise grass. ---
  const ww2 = (mode === 'ww2');
  const groundScreenY = CONFIG.GROUND_Y - camera.y;
  if (bh) {
    /* Black Hole: pure void -- no ground drawn. */
  } else if (alien) {
    drawMoonGround(groundScreenY);
  } else {
    ctx.fillStyle = uni ? '#f7a8d8' : (storm ? '#5a4632' : (ww2 ? '#6f6a40' : (night ? '#2e3d2a' : C.ground)));
    ctx.fillRect(0, groundScreenY, CONFIG.GAME_W, CONFIG.GAME_H);
    ctx.fillStyle = uni ? '#e87bbf' : (storm ? '#43341f' : (ww2 ? '#55502f' : (night ? '#223020' : C.groundDark)));
    ctx.fillRect(0, groundScreenY, CONFIG.GAME_W, 4);

    // Some ground stripes that scroll by so you can feel the speed.
    ctx.fillStyle = C.groundDark;
    for (let i = -1; i < CONFIG.GAME_W / 60 + 2; i++) {
      const stripeX = (i * 60 - (camera.x % 60));
      ctx.fillRect(stripeX, groundScreenY + 14, 30, 3);
    }

    // --- Trees, bushes, haybales and barns sitting on the grass ---
    drawGroundScenery(ctx);
  }

  // --- The bots ---
  for (const enemy of enemies) {
    enemy.draw(ctx);
  }

  // --- Bullets ---
  for (const bullet of bullets) {
    bullet.draw(ctx);
  }

  // --- Missiles and their smoke trails ---
  for (const missile of missiles) {
    missile.draw(ctx);
  }

  // --- Power-up bubbles ---
  for (const p of powerups) {
    p.draw(ctx);
  }

  // --- Bot parachutes (cosmetic) ---
  for (const c of botChutes) drawBotChute(c);

  // --- Explosions (drawn on top so the sparks pop) ---
  for (const boom of explosions) {
    boom.draw(ctx);
  }

  // --- The player's plane (flying or taking off) or the parachuting pilot ---
  if (playerState === 'flying' || playerState === 'takeoff') player.draw(ctx);
  else if (playerState === 'chute' && pilot) pilot.draw(ctx);

  // --- Black Hole: the event horizon, drawn IN FRONT so planes vanish into it ---
  if (bh) drawBlackHoleCore();

  // --- Arrows pointing at bots (and the barn while parachuting) ---
  drawOffscreenIndicators();
  if (playerState === 'chute') drawBarnArrow();

  // --- Vintage sepia vignette: warm, darkened corners like an old photo
  // (skipped in the cold, starry space modes). ---
  if (!space) {
    const vg = ctx.createRadialGradient(
      CONFIG.GAME_W / 2, CONFIG.GAME_H / 2, CONFIG.GAME_H * 0.4,
      CONFIG.GAME_W / 2, CONFIG.GAME_H / 2, CONFIG.GAME_W * 0.72);
    vg.addColorStop(0, 'rgba(60,40,15,0)');
    vg.addColorStop(1, 'rgba(45,28,8,0.34)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, CONFIG.GAME_W, CONFIG.GAME_H);
  }

  // --- Night: darken the whole scene so the lights stand out ---
  if (night) {
    ctx.fillStyle = 'rgba(10,16,40,0.4)';
    ctx.fillRect(0, 0, CONFIG.GAME_W, CONFIG.GAME_H);
  }

  // --- Bad Weather: rain, storm darkening, and lightning over the world ---
  if (mode === 'badweather') drawBadWeather();

  // --- HUD (the info text on top) ---
  if (alien) {
    drawAlienHud();
  } else {
    drawHud();
    if (mode === 'ww2') {
      drawTeamScores();           // green vs black, no names
    } else {
      drawLeaderboard();
      drawKillFeed();
    }
    if (bh) drawBlackHoleHud();   // flashing "gravity pull" warning
  }
  drawMinimap();
}

// Alien Invasion HUD: tells you if YOU are the UFO, how many runners are left,
// and shows the winner banner between rounds.
function drawAlienHud() {
  const runners = planes.filter(p => p.alive && !p.isUfo).length;
  const ufos = planes.filter(p => p.alive && p.isUfo).length;
  ctx.textAlign = 'center';
  ctx.font = 'bold 30px monospace';
  ctx.fillStyle = '#9be7ff';
  ctx.fillText('👽 ALIEN TAG  —  Runners left: ' + runners, CONFIG.GAME_W / 2, 46);

  ctx.font = '22px monospace';
  if (player.alive && player.isUfo) {
    ctx.fillStyle = '#7CFC00';
    ctx.fillText('YOU are the UFO — go TAG everyone!', CONFIG.GAME_W / 2, 80);
  } else if (player.alive) {
    ctx.fillStyle = '#ffd24a';
    ctx.fillText('RUN! Don\'t let a UFO touch you!', CONFIG.GAME_W / 2, 80);
  }

  // Winner banner during the short pause before the next round.
  if (alienWinTimer > 0) {
    ctx.font = 'bold 64px monospace';
    ctx.fillStyle = '#ffffff';
    const who = alienWinner
      ? (alienWinner.isPlayer ? 'YOU WIN!' : (alienWinner.name || 'A pilot') + ' WINS!')
      : 'Everyone caught!';
    ctx.fillText('🏆 ' + who, CONFIG.GAME_W / 2, CONFIG.GAME_H / 2 - 40);
    ctx.font = '26px monospace';
    ctx.fillStyle = '#9be7ff';
    ctx.fillText('Winner becomes the UFO next round...', CONFIG.GAME_W / 2, CONFIG.GAME_H / 2 + 6);
  }
  ctx.textAlign = 'left';
}

// WW2 team scores: GREEN top-left, BLACK top-right (no names anywhere).
function drawTeamScores() {
  ctx.font = '20px monospace';
  ctx.fillStyle = '#7ed957';
  ctx.textAlign = 'left';
  ctx.fillText('GREEN (YOU)  ' + greenScore, 14, 56);
  ctx.fillStyle = '#cfcfcf';
  ctx.textAlign = 'right';
  ctx.fillText('BLACK (enemy)  ' + blackScore, CONFIG.GAME_W - 14, 30);
  ctx.textAlign = 'left';
}

// Spawn a power-up bubble, keeping 3 of EACH kind spread across the whole map.
function spawnPowerUp() {
  const types = ['shield', 'turret', 'skull'];
  const need = types.filter(t => powerups.filter(p => p.type === t).length < CONFIG.POWERUP_PER_TYPE);
  if (!need.length) return;
  const t = need[Math.floor(Math.random() * need.length)];
  const px = Math.random() * CONFIG.WORLD_WIDTH;        // anywhere across the map
  const py = 70 + Math.random() * (CONFIG.GROUND_Y - 160);
  powerups.push(new PowerUp(px, py, t));
}

// Give a bot the power-up it flew into.
function applyPowerUpToBot(e, type) {
  if (type === 'shield') e.invincibleTimer += CONFIG.SHIELD_TIME;
  else if (type === 'turret') e.wideTimer += CONFIG.WIDE_SHOT_TIME;
  else { e.frozenTimer += CONFIG.FREEZE_TIME; e.health = Math.max(1, Math.ceil(e.health / 2)); e.flash = 6; }
  const col = type === 'shield' ? '#5bc0ff' : type === 'turret' ? '#e0a93a' : '#c0392b';
  explosions.push(new Explosion(e.x, e.y, col));
}

// Apply a power-up's effect to the player when collected.
function applyPowerUp(type) {
  if (type === 'shield') {
    player.invincibleTimer += CONFIG.SHIELD_TIME;
    pushKill('🛡️ YOU grabbed a SHIELD', '#5bc0ff');
    explosions.push(new Explosion(player.x, player.y, '#5bc0ff'));
  } else if (type === 'turret') {
    player.wideTimer += CONFIG.WIDE_SHOT_TIME;
    pushKill('🔫 YOU grabbed WIDE SHOT', '#e0a93a');
    explosions.push(new Explosion(player.x, player.y, '#e0a93a'));
  } else { // skull -- bad!
    player.frozenTimer += CONFIG.FREEZE_TIME;
    player.health = Math.max(1, Math.ceil(player.health / 2)); // lose half health
    player.flash = 8;
    pushKill('☠️ BAD bubble! frozen + half health', '#ff8a65');
    explosions.push(new Explosion(player.x, player.y, '#c0392b'));
  }
}

// Bad Weather overlay: storm darkening, heavy slanted rain, lightning + flash.
function drawBadWeather() {
  ctx.fillStyle = 'rgba(18,22,36,0.42)';     // gloom
  ctx.fillRect(0, 0, CONFIG.GAME_W, CONFIG.GAME_H);

  // Heavy rain: lots of slanted streaks, animated by the frame counter.
  ctx.strokeStyle = 'rgba(190,205,235,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 320; i++) {
    const x = ((i * 137 + frameCount * 16) % (CONFIG.GAME_W + 60)) - 30;
    const y = ((i * 83 + frameCount * 26) % (CONFIG.GAME_H + 60)) - 30;
    ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 16);
  }
  ctx.stroke();

  // Lightning bolts (jagged white line from the sky down to the victim).
  for (const b of lightnings) {
    const sx = worldToScreenX(b.x), sy = b.y - camera.y;
    ctx.strokeStyle = '#fdfdc0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    let x = sx, y = 0;
    ctx.moveTo(x, y);
    while (y < sy) { y += 34; x += (Math.random() - 0.5) * 44; ctx.lineTo(x, y); }
    ctx.lineTo(sx, sy);
    ctx.stroke();
  }

  // Whole-screen flash right after a strike.
  if (lightningFlash > 0) {
    ctx.fillStyle = 'rgba(255,255,255,' + (lightningFlash / 8 * 0.5) + ')';
    ctx.fillRect(0, 0, CONFIG.GAME_W, CONFIG.GAME_H);
  }
}

// Draw one cosmetic bot parachute (canopy + dangling pilot).
function drawBotChute(c) {
  const sx = worldToScreenX(c.x), sy = c.y - camera.y;
  ctx.fillStyle = c.color;
  ctx.beginPath(); ctx.arc(sx, sy - 14, 9, Math.PI, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#dddddd'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx - 8, sy - 14); ctx.lineTo(sx - 2, sy - 3);
  ctx.moveTo(sx + 8, sy - 14); ctx.lineTo(sx + 2, sy - 3);
  ctx.stroke();
  ctx.fillStyle = '#3a2a1a'; ctx.fillRect(sx - 2, sy - 4, 4, 5);
  ctx.fillStyle = CONFIG.COLORS.pilot; ctx.fillRect(sx - 2, sy - 7, 4, 2);
}

// A little map in the corner: the whole looping world as a rectangle, with a
// RED box for where YOU are and a GREEN flag for the respawn barn.
function drawMinimap() {
  // The map is now TALL: side-to-side shows where you are across the world,
  // and up-and-down shows your HEIGHT, from the ground up to the ceiling. So
  // the higher you fly, the higher your marker sits in the box.
  // Sit the map in the gap between the kill feed (far left) and the Modifier
  // Menu (top-center), roughly halfway between them.
  const mw = 240, mh = 120, mx = Math.round(CONFIG.GAME_W * 0.25) - mw / 2, my = 12;
  const W = CONFIG.WORLD_WIDTH;
  const top = CONFIG.CEILING, bot = CONFIG.GROUND_Y, H = bot - top;
  const innerH = mh - 4;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx + 0.5, my + 0.5, mw - 1, mh - 1);

  // Turn a world (x, y) into a spot inside the map box.
  const mapX = x => mx + (wrapX(x) / W) * mw;
  const mapY = y => my + Math.max(0, Math.min(1, (y - top) / H)) * innerH;

  // ground strip along the bottom of the map
  ctx.fillStyle = 'rgba(120,180,90,0.6)';
  ctx.fillRect(mx + 1, my + mh - 4, mw - 2, 3);

  // Every bot as a small dot, so you can see the whole area at a glance.
  for (const e of enemies) {
    if (!e.alive) continue;
    ctx.fillStyle = (mode === 'alien') ? (e.isUfo ? '#2ecc40' : '#3b9bff') : e.bodyColor;
    ctx.fillRect(mapX(e.x) - 3, mapY(e.y) - 3, 6, 6); // same size as your marker
  }

  // Green flag = the rescue barn (sits on the ground)
  const fx = mapX(BARN_X);
  ctx.fillStyle = '#5a3b2e'; ctx.fillRect(fx, my + mh - 12, 1, 9);
  ctx.fillStyle = '#2ecc71'; ctx.fillRect(fx + 1, my + mh - 12, 7, 4);

  // Black Hole: a purple-ringed black dot so you can see where the hole is.
  if (mode === 'blackhole') {
    const hx = mapX(BH_X), hy = mapY(BH_Y);
    ctx.fillStyle = '#b388ff'; ctx.beginPath(); ctx.arc(hx, hy, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fill();
  }

  // Red box = you, now placed by BOTH where you are and how high you are.
  const who = (playerState === 'chute' && pilot) ? pilot : player;
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(mapX(who.x) - 3, mapY(who.y) - 3, 6, 6);

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '9px monospace'; ctx.textAlign = 'left';
  ctx.fillText('MAP', mx + 4, my + 11);
}

// The "who killed who" feed on the left side (newest on top, fades away).
function drawKillFeed() {
  const x = 8, y = 100;
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('KILL FEED', x, y);
  killFeed.forEach((k, i) => {
    ctx.globalAlpha = Math.min(1, k.life / 60); // fade out in the last second
    ctx.fillStyle = k.color;
    ctx.fillText(k.text, x, y + 16 + i * 15);
  });
  ctx.globalAlpha = 1;
}

// Draw a little arrow at the edge of the screen for every alive enemy that
// is currently off-screen, so the player knows which way to fly to find them.
function drawOffscreenIndicators() {
  if (!CONFIG.SHOW_ENEMY_ARROWS) return;

  const cx = CONFIG.GAME_W / 2; // middle of the screen
  const cy = CONFIG.GAME_H / 2;
  const margin = CONFIG.ARROW_MARGIN;
  const size = CONFIG.ARROW_SIZE;

  for (const enemy of enemies) {
    if (!enemy.alive) continue;

    // Where the enemy would be on the screen.
    const sx = worldToScreenX(enemy.x);
    const sy = enemy.y - camera.y;

    // If it's already visible on screen, it doesn't need an arrow.
    const onScreen = sx >= 0 && sx <= CONFIG.GAME_W &&
                     sy >= 0 && sy <= CONFIG.GAME_H;
    if (onScreen) continue;

    // The direction from the middle of the screen toward the enemy.
    const angle = Math.atan2(sy - cy, sx - cx);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    // Slide out from the center along that direction until we reach the
    // edge (kept "margin" pixels inside so the arrow isn't half cut off).
    const halfW = cx - margin;
    const halfH = cy - margin;
    let dist;
    if (Math.abs(dx) * halfH > Math.abs(dy) * halfW) {
      dist = halfW / Math.abs(dx); // hits the left/right edge first
    } else {
      dist = halfH / Math.abs(dy); // hits the top/bottom edge first
    }
    const ix = cx + dx * dist;
    const iy = cy + dy * dist;

    // Draw a small triangle pointing toward the enemy, in its team color.
    // In Alien Invasion the color shows who's "it": green = UFO, blue = runner.
    let arrowColor = enemy.bodyColor;
    if (mode === 'alien') arrowColor = enemy.isUfo ? '#2ecc40' : '#3b9bff';
    ctx.save();
    ctx.translate(ix, iy);
    ctx.rotate(angle);
    ctx.fillStyle = arrowColor;
    ctx.beginPath();
    ctx.moveTo(size, 0);       // the pointy tip (points at the enemy)
    ctx.lineTo(-size, -size);  // back corner
    ctx.lineTo(-size, size);   // other back corner
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// While parachuting, show a green arrow at the screen edge pointing to the barn.
function drawBarnArrow() {
  const cx = CONFIG.GAME_W / 2, cy = CONFIG.GAME_H / 2;
  const sx = worldToScreenX(BARN_X);
  const sy = CONFIG.GROUND_Y - camera.y;
  const onScreen = sx >= 0 && sx <= CONFIG.GAME_W && sy >= 0 && sy <= CONFIG.GAME_H;
  if (onScreen) return;

  const angle = Math.atan2(sy - cy, sx - cx);
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const halfW = cx - 16, halfH = cy - 16;
  const dist = (Math.abs(dx) * halfH > Math.abs(dy) * halfW)
    ? halfW / Math.abs(dx) : halfH / Math.abs(dy);

  ctx.save();
  ctx.translate(cx + dx * dist, cy + dy * dist);
  ctx.rotate(angle);
  ctx.fillStyle = '#2ecc71';
  ctx.beginPath();
  ctx.moveTo(9, 0); ctx.lineTo(-7, -7); ctx.lineTo(-7, 7); ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawHud() {
  // --- YOUR plane stats, in a bigger panel centered along the bottom ---
  const pw = 360, ph = 88;
  const px0 = Math.round(CONFIG.GAME_W / 2 - pw / 2);
  const py0 = CONFIG.GAME_H - ph - 26;
  const barX = px0 + 106, barW = 244;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(px0, py0, pw, ph);
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';

  // Names change in Unicorn Mode.
  const lblThrottle = (mode === 'unicorn') ? 'GALLOP SPEED' : 'THROTTLE';
  const lblHealth = (mode === 'unicorn') ? 'SPARKLE POWER' : 'HEALTH';

  // Throttle / Gallop speed
  ctx.fillStyle = '#ffffff'; ctx.fillText(lblThrottle, px0 + 10, py0 + 16);
  ctx.strokeStyle = '#ffffff'; ctx.strokeRect(barX, py0 + 9, barW, 8);
  ctx.fillStyle = '#f1c40f'; ctx.fillRect(barX + 1, py0 + 10, (barW - 2) * player.throttle, 6);

  // Health / Sparkle power
  ctx.fillStyle = '#ffffff'; ctx.fillText(lblHealth, px0 + 10, py0 + 34);
  ctx.strokeStyle = '#ffffff'; ctx.strokeRect(barX, py0 + 27, barW, 8);
  const healthFrac = Math.max(0, player.health) / CONFIG.PLAYER_HEALTH;
  ctx.fillStyle = healthFrac > 0.5 ? '#2ecc71' : (healthFrac > 0.25 ? '#f39c12' : '#e74c3c');
  ctx.fillRect(barX + 1, py0 + 28, (barW - 2) * healthFrac, 6);

  // Missiles (one box each; the next one fills as it reloads)
  ctx.fillStyle = '#ffffff'; ctx.fillText('MISSILES', px0 + 10, py0 + 54);
  for (let i = 0; i < CONFIG.MISSILE_MAX; i++) {
    const bx = barX + i * 18, by = py0 + 46;
    ctx.strokeStyle = '#ffffff'; ctx.strokeRect(bx, by, 14, 9);
    if (i < player.missiles) {
      ctx.fillStyle = CONFIG.COLORS.missile; ctx.fillRect(bx + 1, by + 1, 12, 7);
    } else if (i === player.missiles) {
      const frac = player.missileTimer / (CONFIG.MISSILE_REFILL_SECONDS * 60);
      ctx.fillStyle = '#7f8c8d'; ctx.fillRect(bx + 1, by + 1, 12 * frac, 7);
    }
  }

  // Speed
  const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
  ctx.fillStyle = '#ffffff'; ctx.fillText('SPEED ' + speed.toFixed(1), px0 + 10, py0 + 76);

  // Active power-up status, stacked just above the panel.
  const statuses = [];
  if (player.invincibleTimer > 0) statuses.push(['🛡️ SHIELD ' + Math.ceil(player.invincibleTimer / 60) + 's', '#5bc0ff']);
  if (player.wideTimer > 0)       statuses.push(['🔫 WIDE ' + Math.ceil(player.wideTimer / 60) + 's', '#e0a93a']);
  if (player.frozenTimer > 0)     statuses.push(['❄️ FROZEN ' + Math.ceil(player.frozenTimer / 60) + 's', '#9ad8ff']);
  ctx.font = '13px monospace'; ctx.textAlign = 'center';
  statuses.forEach((s, i) => {
    ctx.fillStyle = s[1];
    ctx.fillText(s[0], CONFIG.GAME_W / 2, py0 - 8 - i * 16);
  });
  ctx.textAlign = 'left';

  // Big middle-of-screen messages for ejecting / being shot down.
  ctx.textAlign = 'center';
  if (playerState === 'chute') {
    ctx.fillStyle = '#2ecc71';
    ctx.font = '20px monospace';
    ctx.fillText('EJECTED!', CONFIG.GAME_W / 2, 70);
    ctx.font = '11px monospace';
    if (pilot && !pilot.chuteOpen && !pilot.landed) {
      ctx.fillStyle = '#ffd23f';
      ctx.fillText('Press C AGAIN to open your PARACHUTE!', CONFIG.GAME_W / 2, 90);
    } else {
      ctx.fillText('Float/walk (arrows) to the BIG BARN to save your ' + score +
                   ' points -- don\'t get shot or run over!', CONFIG.GAME_W / 2, 90);
    }
  } else if (playerState === 'dead') {
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px monospace';
    ctx.fillText(deathMsg, CONFIG.GAME_W / 2, CONFIG.GAME_H / 2);
    ctx.font = '11px monospace';
    ctx.fillText('points lost -- taking off again...', CONFIG.GAME_W / 2, CONFIG.GAME_H / 2 + 20);
  }
  ctx.textAlign = 'left';

  // Score (how many targets popped) -- hidden in WW2 (team scores shown instead)
  if (mode !== 'ww2') {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(CONFIG.GAME_W - 80, 6, 74, 16);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('SCORE ' + score, CONFIG.GAME_W - 74, 17);
  }

  // Altitude gauge on the right edge. Top = the ceiling, bottom = the ground.
  // The red band at the top is the "thin air" stall zone.
  const gx = CONFIG.GAME_W - 22, gy = 30, gh = 240;
  const top = CONFIG.CEILING, bot = CONFIG.GROUND_Y;
  const altToBar = (y) => gy + gh * (y - top) / (bot - top);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(gx - 2, gy - 2, 14, gh + 4);
  const my = Math.max(gy, Math.min(gy + gh, altToBar(player.y)));
  ctx.fillStyle = '#ffffff'; ctx.fillRect(gx - 3, my - 1, 16, 2); // your marker
  ctx.font = '8px monospace'; ctx.textAlign = 'center';
  ctx.fillText('ALT', gx + 5, gy - 5);
  ctx.textAlign = 'left';

  // Blinking STALL! warning when the wings lose their lift.
  if (playerState === 'flying' && player.stalling && (frameCount % 30 < 20)) {
    ctx.fillStyle = '#ff3b30';
    ctx.font = '18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('STALL!', CONFIG.GAME_W / 2, 44);
    ctx.textAlign = 'left';
    ctx.font = '8px monospace';
  }

  // Friendly controls reminder along the bottom
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.textAlign = 'center';
  ctx.fillText('Arrows: fly    Space: guns    X: missile    C: eject',
               CONFIG.GAME_W / 2, CONFIG.GAME_H - 14);
  ctx.textAlign = 'left';
}

// =========================================================================
//  ALIEN INVASION MODE -- aerial TAG over the moon. Everyone flies normal
//  planes; one is randomly turned into a UFO. The UFO can't shoot, eject, or
//  crash -- it just chases and TAGS others, who turn into UFOs too. The last
//  un-tagged flyer wins the round and becomes the UFO for the next round.
// =========================================================================
let alienWinner = null, alienWinTimer = 0;

function startAlien() {
  spawnPlane(100);
  playerState = 'flying';                 // everyone starts already in the air
  const all = [player, ...enemies];
  // There are NO power-ups in Alien Tag, so clear any bubbles on the map and
  // strip every power-up the player or bots carried in from another mode --
  // otherwise a leftover shield would make someone impossible to tag.
  powerups.length = 0;
  all.forEach(p => {
    p.isUfo = false;
    p.invincibleTimer = 0; p.wideTimer = 0; p.frozenTimer = 0;
  });
  const alive = all.filter(p => p.alive !== false);
  alive[Math.floor(Math.random() * alive.length)].isUfo = true; // random first UFO
  placeAlienRound();
  alienWinner = null; alienWinTimer = 0;
}
function newAlienRound() {
  const all = [player, ...enemies];
  all.forEach(p => { p.isUfo = false; });
  if (alienWinner) alienWinner.isUfo = true;                    // winner is "it"
  else all[Math.floor(Math.random() * all.length)].isUfo = true;
  placeAlienRound();
  alienWinner = null;
}

// Set everyone's starting spot for a round so NOBODY gets tagged instantly:
// the UFO teleports to the MIDDLE of the map, and the runners spread out across
// the far half (around the world's edges), as far from the middle as possible.
function placeAlienRound() {
  const all = [player, ...enemies];
  const ufo = all.find(p => p.isUfo);
  if (ufo) {
    ufo.x = BARN_X;                       // dead center of the world
    ufo.y = CONFIG.GROUND_Y - 700;
    ufo.vx = 0; ufo.vy = 0; ufo.angle = 0;
  }
  // Runners get spread evenly across the half of the world OPPOSITE the middle
  // (centered on the wrap seam), so they all begin well away from the UFO.
  const runners = all.filter(p => !p.isUfo);
  const bandStart = BARN_X + CONFIG.WORLD_WIDTH * 0.25;
  const bandWidth = CONFIG.WORLD_WIDTH * 0.5;
  const n = runners.length;
  runners.forEach((p, i) => {
    const t = (n > 1) ? i / (n - 1) : 0.5;
    p.x = wrapX(bandStart + t * bandWidth);
    p.y = CONFIG.GROUND_Y - (520 + (i % 3) * 160); // a few staggered heights
    p.vx = 2; p.vy = 0; p.angle = 0;
    p.stalling = false; p.hitGround = false;
  });
}
// Spread the UFO bots out so they each chase a DIFFERENT runner instead of all
// piling onto one. Each runner can only be chased by a fair share of UFOs; once
// it's "full", extra UFOs go after the next-nearest free runner. Runs once per
// frame (before the bots move). The player's UFO is steered by hand, so it's
// left out of the assignment.
function assignUfoTargets() {
  const ufos = enemies.filter(e => e.alive && e.isUfo);
  const runners = planes.filter(p => p.alive && !p.isUfo);
  if (!runners.length) { ufos.forEach(u => u.tagTarget = null); return; }
  const cap = Math.ceil(ufos.length / runners.length); // max UFOs per runner
  const count = new Map(runners.map(r => [r, 0]));
  for (const u of ufos) {
    let best = null, bd = Infinity;
    for (const r of runners) {
      if (count.get(r) >= cap) continue;        // this runner already has enough chasers
      const dx = wrapDX(r.x - u.x), dy = r.y - u.y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = r; }
    }
    if (!best) best = runners[0];               // safety net (shouldn't happen)
    u.tagTarget = best;
    count.set(best, count.get(best) + 1);
  }
}

// Bot behaviour in tag mode. A UFO FLOATS freely (no gravity) straight toward
// its assigned runner. A runner flies like a normal plane, steering away from
// the nearest UFO. Nobody shoots.
function alienBotFly(b) {
  // Find the nearest plane of the OTHER type (runner if I'm a UFO, vice versa).
  let best = null, bd = Infinity;
  for (const p of planes) {
    if (p === b || !p.alive) continue;
    if (p.isUfo === b.isUfo) continue;
    const dx = wrapDX(p.x - b.x), dy = p.y - b.y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = p; }
  }

  if (b.isUfo) {
    // --- UFO: glide toward its ASSIGNED runner so the UFOs spread out and
    // don't all pile on one target. Falls back to the nearest runner. ---
    const target = (b.tagTarget && b.tagTarget.alive && !b.tagTarget.isUfo) ? b.tagTarget : best;
    let dx = target ? wrapDX(target.x - b.x) : Math.cos(b.angle);
    let dy = target ? (target.y - b.y) : 0;
    const len = Math.hypot(dx, dy) || 1;
    b.vx = (dx / len) * CONFIG.UFO_SPEED;
    b.vy = (dy / len) * CONFIG.UFO_SPEED;
    b.x = wrapX(b.x + b.vx); b.y += b.vy;
    if (b.y > CONFIG.GROUND_Y - 6) b.y = CONFIG.GROUND_Y - 6;
    if (b.y < CONFIG.CEILING) b.y = CONFIG.CEILING;
    b.angle = Math.atan2(b.vy, b.vx);   // (only used for math; UFO draws flat)
    b.propSpin += 1;
    return;
  }

  // --- Runner: fly like a plane and try its HARDEST to stay away from the
  // UFOs. We add up a "push" away from EVERY UFO (closer ones push harder), so
  // a runner dodges the whole pack instead of just the nearest one -- and won't
  // flee straight into a second UFO. We also push off the ground and ceiling so
  // it can't get cornered against them. The runner flies toward the combined
  // escape direction at full throttle. ---
  let fx = 0, fy = 0;
  for (const p of planes) {
    if (!p.alive || !p.isUfo) continue;
    const dx = wrapDX(b.x - p.x), dy = b.y - p.y; // vector FROM the UFO to me
    const dist = Math.hypot(dx, dy) || 1;
    const w = 1 / (dist * dist);                  // nearer UFO = stronger push
    fx += (dx / dist) * w; fy += (dy / dist) * w;
  }
  // Soft walls: shove away from the ground (push up) and ceiling (push down).
  const gd = Math.max(20, CONFIG.GROUND_Y - b.y); // distance to ground
  const cd = Math.max(20, b.y - CONFIG.CEILING);  // distance to ceiling
  fy -= 1 / (gd * gd);   // near the ground -> push up (negative y)
  fy += 1 / (cd * cd);   // near the ceiling -> push down (positive y)

  let want = (fx === 0 && fy === 0) ? b.angle : Math.atan2(fy, fx);
  const diff = angleDiff(want, b.angle);
  if (diff > 0.02) b.angle += b.style.turn; else if (diff < -0.02) b.angle -= b.style.turn;
  applyFlightPhysics(b, b.style.thrust);
  b.x = wrapX(b.x + b.vx); b.y += b.vy;
  if (b.y > CONFIG.GROUND_Y - 6) { b.y = CONFIG.GROUND_Y - 6; b.vy = 0; }
  if (b.y < CONFIG.CEILING) { b.y = CONFIG.CEILING; b.vy = 0; }
  b.propSpin += 1;
}
// Each frame: UFOs tag nearby runners; check for a winner.
function alienTagStep() {
  if (alienWinTimer > 0) { alienWinTimer -= 1; if (alienWinTimer === 0) newAlienRound(); return; }
  const all = planes.filter(p => p.alive);
  for (const u of all) {
    if (!u.isUfo) continue;
    for (const r of all) {
      if (r.isUfo) continue;
      if (r.invincibleTimer > 0) continue; // invincible (e.g. ∞ Health) = can't be tagged
      if (hits(u, r, CONFIG.UFO_TAG_RANGE)) { r.isUfo = true; explosions.push(new Explosion(r.x, r.y, '#7CFC00')); }
    }
  }
  const runners = all.filter(p => !p.isUfo);
  if (runners.length <= 1) { alienWinner = runners[0] || null; alienWinTimer = 180; }
}

// Deep-space backdrop: hundreds of stars (twinkling), a couple of planets, and
// a big crescent moon. Stars drift slowly with the camera for a parallax feel.
function drawSpaceSky() {
  const shift = camera.x * 0.2;
  for (let i = 0; i < 320; i++) {
    let x = ((i * 137) - shift) % CONFIG.GAME_W;
    if (x < 0) x += CONFIG.GAME_W;
    const y = (i * 89) % Math.floor(CONFIG.GAME_H * 0.85);
    const tw = (Math.sin(frameCount * 0.05 + i) + 1) * 0.5;   // 0..1 twinkle
    const s = (i % 7 === 0) ? 3 : 2;
    ctx.fillStyle = 'rgba(255,255,255,' + (0.35 + tw * 0.6) + ')';
    ctx.fillRect(x, y, s, s);
  }
  // The planets and moon are anchored to real WORLD positions (using
  // worldToScreenX), so they stay put in the sky and scroll past as you fly --
  // they don't follow the camera. Their height tracks the camera so they hang
  // up high in the sky.
  const skyY = CONFIG.GAME_H * 0.18 - (camera.y - (CONFIG.GROUND_Y - 700)) * 0.4;

  // A blue-green planet (like Earth from afar).
  const ex = worldToScreenX(900), ey = skyY + 30;
  ctx.fillStyle = '#3b6fd6';
  ctx.beginPath(); ctx.arc(ex, ey, 46, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#46b06a';                 // continents
  ctx.beginPath(); ctx.arc(ex - 14, ey - 8, 16, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(ex + 18, ey + 12, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; // a soft glow
  ctx.beginPath(); ctx.arc(ex, ey, 54, 0, Math.PI * 2); ctx.fill();

  // A small ringed planet.
  const px = worldToScreenX(5200), py = skyY - 20;
  ctx.fillStyle = '#d9a441';
  ctx.beginPath(); ctx.arc(px, py, 24, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(230,210,150,0.8)';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(px, py, 42, 12, -0.4, 0, Math.PI * 2); ctx.stroke();

  // Big crescent moon up high.
  const mx = worldToScreenX(3000), my = skyY - 10;
  ctx.fillStyle = '#e9ead2';
  ctx.beginPath(); ctx.arc(mx, my, 40, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0b0820';                 // carve crescent with sky color
  ctx.beginPath(); ctx.arc(mx + 16, my - 6, 38, 0, Math.PI * 2); ctx.fill();
}

// The cratered moon surface along the ground. Craters are placed by a fixed
// pattern (tied to world position) so they scroll naturally with the camera.
function drawMoonGround(groundY) {
  ctx.fillStyle = '#9a9aa3';                 // grey moon dust
  ctx.fillRect(0, groundY, CONFIG.GAME_W, CONFIG.GAME_H);
  ctx.fillStyle = '#c7c7d0';                 // lighter rim line on top
  ctx.fillRect(0, groundY, CONFIG.GAME_W, 5);

  // Craters: ovals with a darker inside and a bright top rim.
  for (let i = 0; i < 60; i++) {
    let wx = i * 420 + (i % 3) * 90;          // spread across the world
    let sx = worldToScreenX(wx);
    const r = 26 + (i % 4) * 14;
    const cy = groundY + 30 + (i % 5) * 22;
    ctx.fillStyle = '#76767f';                // crater bowl
    ctx.beginPath(); ctx.ellipse(sx, cy, r, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5e5e66';                // deeper center
    ctx.beginPath(); ctx.ellipse(sx, cy + 2, r * 0.6, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#bcbcc6';              // sunlit rim
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(sx, cy - 2, r, r * 0.5, 0, Math.PI, Math.PI * 2); ctx.stroke();
  }
  // A few scattered small rocks/pebbles.
  ctx.fillStyle = '#83838c';
  for (let i = 0; i < 40; i++) {
    let sx = worldToScreenX(i * 610 + 120);
    ctx.fillRect(sx, groundY + 12 + (i % 6) * 30, 6, 4);
  }
}

// =========================================================================
//  BLACK HOLE MODE  --  a black hole hangs in the middle of space and pulls
//  EVERYTHING toward it (planes, bullets, even your aim). Get pulled past the
//  event horizon and you're crushed. Fight the pull with throttle and angle;
//  it's a normal dogfight, but the hole is always trying to eat you.
// =========================================================================
const BH_X = BARN_X;                                   // centered over the map
const BH_Y = (CONFIG.CEILING + CONFIG.GROUND_Y) / 2;   // halfway up the sky

function startBlackHole() {
  spawnPlane(BARN_X - 1900);
  player.y = BH_Y; player.vx = 4; player.vy = 0; player.angle = 0;
  playerState = 'flying';
  // Scatter the bots in a big ring around the hole so nobody starts inside it.
  enemies.forEach((e, i) => {
    e.alive = true; e.health = CONFIG.ENEMY_HEALTH;
    const ang = (i / Math.max(1, enemies.length)) * Math.PI * 2;
    e.x = wrapX(BH_X + Math.cos(ang) * 1900);
    e.y = BH_Y + Math.sin(ang) * 1300;
    e.vx = 0; e.vy = 0;
  });
}

// Add one frame of gravity toward the hole. Returns the distance to the center
// (so callers can check the event horizon). `scale` lets bullets be pulled a
// different amount than planes.
function applyBlackHolePull(o, scale) {
  const dx = wrapDX(BH_X - o.x), dy = BH_Y - o.y;
  const dist = Math.hypot(dx, dy) || 1;
  if (dist > CONFIG.BH_RANGE) return dist;
  const t = 1 - dist / CONFIG.BH_RANGE;          // 0 at the edge .. 1 at center
  const pull = CONFIG.BH_PULL * t * t * (scale || 1);  // mild far away, fierce near
  const ux = dx / dist, uy = dy / dist;
  o.vx += ux * pull;                             // straight toward the hole...
  o.vy += uy * pull;
  o.vx += -uy * pull * CONFIG.BH_SWIRL;          // ...plus a swirl, so it spirals in
  o.vy += ux * pull * CONFIG.BH_SWIRL;
  return dist;
}

// A purple implosion for anything crushed by the hole.
function implodeAt(x, y) {
  explosions.push(new Explosion(x, y, '#b388ff', true));
  explosions.push(new Explosion(x, y, '#7c4dff'));
  explosions.push(new Explosion(x, y, '#ffffff'));
}

// Run the hole each frame: pull everything, and crush whatever crosses in.
function blackHoleStep() {
  if (playerState === 'flying' || playerState === 'takeoff') {
    const d = applyBlackHolePull(player, 1);
    if (d < CONFIG.BH_HORIZON && player.invincibleTimer <= 0) {
      implodeAt(player.x, player.y);
      pushKill('🕳️ the black hole crushed YOU', '#b388ff');
      playerDies(player.x, player.y, 'SPAGHETTIFIED!');
    }
  }
  for (const e of enemies) {
    if (!e.alive) continue;
    const d = applyBlackHolePull(e, 1);
    if (d < CONFIG.BH_HORIZON && e.invincibleTimer <= 0) {
      implodeAt(e.x, e.y);
      pushKill('🕳️ ' + e.name + ' fell into the black hole', '#b388ff');
      e.alive = false; e.respawnTimer = CONFIG.ENEMY_RESPAWN; e.score = 0;
    }
  }
  for (const b of bullets) applyBlackHolePull(b, 1);  // shots curve toward the hole
}

// The stars + glowing, swirling accretion disk (drawn BEHIND the planes).
function drawBlackHoleGlow() {
  const shift = camera.x * 0.15;                 // slow star parallax
  for (let i = 0; i < 280; i++) {
    let x = ((i * 151) - shift) % CONFIG.GAME_W; if (x < 0) x += CONFIG.GAME_W;
    const y = (i * 83) % CONFIG.GAME_H;
    const tw = (Math.sin(frameCount * 0.05 + i) + 1) * 0.5;
    ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + tw * 0.5) + ')';
    ctx.fillRect(x, y, 2, 2);
  }
  const cx = worldToScreenX(BH_X), cy = BH_Y - camera.y;
  const R = CONFIG.BH_DISK_R;
  // outer gravity glow (gravitational lensing halo)
  const g = ctx.createRadialGradient(cx, cy, R * 0.25, cx, cy, R * 1.9);
  g.addColorStop(0, 'rgba(150,90,255,0.40)');
  g.addColorStop(0.5, 'rgba(90,60,200,0.18)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, R * 1.9, 0, Math.PI * 2); ctx.fill();
  // swirling disk: hot rings as flattened, rotating ellipse arcs
  ctx.save(); ctx.translate(cx, cy);
  const cols = ['#fff3b0', '#ffb347', '#ff6b3d', '#ff3d6e', '#b15bff', '#5b8bff'];
  for (let i = 0; i < cols.length; i++) {
    const rr = R - i * (R * 0.12);
    ctx.strokeStyle = cols[i];
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = R * 0.07;
    const a0 = frameCount * (0.03 + i * 0.006);
    ctx.beginPath();
    ctx.ellipse(0, 0, rr, rr * 0.42, 0, a0, a0 + Math.PI * 1.5);
    ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.restore();
}

// The pure-black event horizon + bright photon ring (drawn IN FRONT of planes,
// so anything spiralling in vanishes behind it).
function drawBlackHoleCore() {
  const cx = worldToScreenX(BH_X), cy = BH_Y - camera.y;
  const h = CONFIG.BH_HORIZON;
  ctx.strokeStyle = 'rgba(255,240,200,0.9)'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(cx, cy, h + 7, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#000000';
  ctx.beginPath(); ctx.arc(cx, cy, h, 0, Math.PI * 2); ctx.fill();
}

// A flashing warning when you're getting dangerously close to the hole.
function drawBlackHoleHud() {
  const dx = wrapDX(BH_X - player.x), dy = BH_Y - player.y;
  const dist = Math.hypot(dx, dy);
  if (playerState !== 'flying' || dist > CONFIG.BH_WARN_DIST) return;
  if ((frameCount >> 3) & 1) {                   // blink
    ctx.textAlign = 'center';
    ctx.font = 'bold 34px monospace';
    ctx.fillStyle = '#ff5b7e';
    ctx.fillText('⚠ GRAVITY PULL — POWER AWAY!', CONFIG.GAME_W / 2, 120);
    ctx.textAlign = 'left';
  }
}

// =========================================================================
//  THE GAME LOOP  --  this calls update() then draw(), over and over.
// =========================================================================
let speedAccum = 0;
function loop() {
  if (!paused) {
    // timeScale lets the modifier menu run the game at 0.5x or 2x speed.
    speedAccum += timeScale;
    while (speedAccum >= 1) {
      frameCount += 1;
      update();
      speedAccum -= 1;
    }
  }
  draw();
  if (paused) drawPauseOverlay();
  requestAnimationFrame(loop); // ask the browser to run loop again next frame
}

// A dark "PAUSED" overlay shown while the game is frozen.
function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, CONFIG.GAME_W, CONFIG.GAME_H);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = '44px monospace';
  ctx.fillText('PAUSED', CONFIG.GAME_W / 2, CONFIG.GAME_H / 2);
  ctx.font = '16px monospace';
  ctx.fillText('press ESC to resume', CONFIG.GAME_W / 2, CONFIG.GAME_H / 2 + 36);
  ctx.textAlign = 'left';
}

loop(); // start the game!
