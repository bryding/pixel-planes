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
  if (m === 'dirtbike') startDirtbike();
  // Leaving a "ground" mini-game -> put a flying plane back.
  const ground = x => (x === 'alien' || x === 'dirtbike');
  if (ground(prev) && !ground(m)) spawnPlane(100);
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
  if (playerState === 'flying' && player.y > safeTop) cands.push(player);
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
  if (mode === 'badweather') {
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
  if (mode === 'alien') { alienUpdate(); return; }   // moon musical-chairs game
  if (mode === 'dirtbike') { dirtUpdate(); return; } // motocross ramps game
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
  } else if (playerState === 'flying') {
    player.update();
    // Touching the ground: a gentle, level touchdown is a safe landing (you
    // just roll); coming in too fast or too steep is a fatal crash.
    const hardLanding = player.hitGround && player.invincibleTimer <= 0 &&
      (player.impactVy >= CONFIG.LAND_MAX_VY ||
       Math.abs(angleDiff(player.angle, 0)) >= CONFIG.LAND_MAX_ANGLE);
    if (hardLanding) {
      bigExplosion(player.x, CONFIG.GROUND_Y - 6);
      pushKill('🛩️ YOU crashed 💥', '#ff8a65');
      playerDies(player.x, CONFIG.GROUND_Y - 6, 'CRASHED!');
    } else if (player.frozenTimer <= 0) {
      // Flying (or safely rolling on the ground): normal controls.
      // WW2 mode has NO missiles and NO ejecting.
      if (Input.fire) player.tryShoot(bullets);
      if (missilePressed && mode !== 'ww2') player.fireMissile(missiles, planes);
      if (ejectPressed && mode !== 'ww2') eject();
    }
  } else if (playerState === 'chute') {
    if (ejectPressed) pilot.deploy(); // press C AGAIN to pop the parachute
    pilot.update();
    // Reach the big barn (drifting OR walking) -> rescued, keep your points.
    if (Math.abs(wrapDX(pilot.x - BARN_X)) < CONFIG.BARN_RESCUE_RANGE) {
      rescueAtBarn();
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

  // Cheats from the modifier menu.
  if (infiniteHealth) player.health = CONFIG.PLAYER_HEALTH;
  if (infiniteMissiles) { player.missiles = CONFIG.MISSILE_MAX; player.missileTimer = 0; }

  // --- The bots (each one thinks for itself; they can fire missiles too) ---
  for (const enemy of enemies) {
    enemy.update(planes, bullets, missiles, powerups);
  }

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

  // --- Power-ups: spawn over time, float, and get collected ---
  powerupTimer -= 1;
  if (powerupTimer <= 0) { spawnPowerUp(); powerupTimer = CONFIG.POWERUP_INTERVAL; }
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
  if (mode === 'alien') { drawAlien(); return; }   // moon scene
  if (mode === 'dirtbike') { dirtDraw(); return; } // motocross scene
  const C = CONFIG.COLORS;

  const uni = (mode === 'unicorn');

  // --- Sky (pastel candy in Unicorn Mode, dark & stormy in Bad Weather) ---
  const storm = (mode === 'badweather');
  const sky = ctx.createLinearGradient(0, 0, 0, CONFIG.GAME_H);
  if (uni) { sky.addColorStop(0, '#bfe3ff'); sky.addColorStop(1, '#ffe1f3'); }
  else if (storm) { sky.addColorStop(0, '#262d3a'); sky.addColorStop(1, '#3c4452'); }
  else { sky.addColorStop(0, C.skyTop); sky.addColorStop(1, C.skyBottom); }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CONFIG.GAME_W, CONFIG.GAME_H);

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

  // --- Soft vintage sun with a warm glow (hidden during the storm) ---
  if (!storm) {
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

  // --- Clouds, far hills, and the treeline on the horizon ---
  drawBackgroundScenery(ctx, camera);

  // --- Ground (candy pink / muddy / battlefield-dirt by mode) ---
  const ww2 = (mode === 'ww2');
  const groundScreenY = CONFIG.GROUND_Y - camera.y;
  ctx.fillStyle = uni ? '#f7a8d8' : (storm ? '#5a4632' : (ww2 ? '#6f6a40' : C.ground));
  ctx.fillRect(0, groundScreenY, CONFIG.GAME_W, CONFIG.GAME_H);
  ctx.fillStyle = uni ? '#e87bbf' : (storm ? '#43341f' : (ww2 ? '#55502f' : C.groundDark));
  ctx.fillRect(0, groundScreenY, CONFIG.GAME_W, 4);

  // Some ground stripes that scroll by so you can feel the speed.
  ctx.fillStyle = C.groundDark;
  for (let i = -1; i < CONFIG.GAME_W / 60 + 2; i++) {
    const stripeX = (i * 60 - (camera.x % 60));
    ctx.fillRect(stripeX, groundScreenY + 14, 30, 3);
  }

  // --- Trees, bushes, haybales and barns sitting on the grass ---
  drawGroundScenery(ctx);

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

  // --- Arrows pointing at bots (and the barn while parachuting) ---
  drawOffscreenIndicators();
  if (playerState === 'chute') drawBarnArrow();

  // --- Vintage sepia vignette: warm, darkened corners like an old photo ---
  const vg = ctx.createRadialGradient(
    CONFIG.GAME_W / 2, CONFIG.GAME_H / 2, CONFIG.GAME_H * 0.4,
    CONFIG.GAME_W / 2, CONFIG.GAME_H / 2, CONFIG.GAME_W * 0.72);
  vg.addColorStop(0, 'rgba(60,40,15,0)');
  vg.addColorStop(1, 'rgba(45,28,8,0.34)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, CONFIG.GAME_W, CONFIG.GAME_H);

  // --- Bad Weather: rain, storm darkening, and lightning over the world ---
  if (mode === 'badweather') drawBadWeather();

  // --- HUD (the info text on top) ---
  drawHud();
  if (mode === 'ww2') {
    drawTeamScores();           // green vs black, no names
  } else {
    drawLeaderboard();
    drawKillFeed();
  }
  drawMinimap();
}

// WW2 team scores: GREEN top-left, BLACK top-right (no names anywhere).
function drawTeamScores() {
  ctx.font = '20px monospace';
  ctx.fillStyle = '#7ed957';
  ctx.textAlign = 'left';
  ctx.fillText('GREEN  ' + greenScore, 14, 56);
  ctx.fillStyle = '#cfcfcf';
  ctx.textAlign = 'right';
  ctx.fillText('BLACK  ' + blackScore, CONFIG.GAME_W - 14, 30);
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
  const mw = 240, mh = 24, mx = 12, my = 12;
  const W = CONFIG.WORLD_WIDTH;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx + 0.5, my + 0.5, mw - 1, mh - 1);
  // ground strip along the bottom of the map
  ctx.fillStyle = 'rgba(120,180,90,0.6)';
  ctx.fillRect(mx + 1, my + mh - 5, mw - 2, 4);

  // Green flag = the rescue barn
  const fx = mx + (BARN_X / W) * mw;
  ctx.fillStyle = '#5a3b2e'; ctx.fillRect(fx, my + mh - 16, 1, 12);
  ctx.fillStyle = '#2ecc71'; ctx.fillRect(fx + 1, my + mh - 16, 8, 5);

  // Red box = you
  const who = (playerState === 'chute' && pilot) ? pilot : player;
  const rx = mx + (wrapX(who.x) / W) * mw;
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(rx - 3, my + mh - 11, 6, 6);

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
    ctx.save();
    ctx.translate(ix, iy);
    ctx.rotate(angle);
    ctx.fillStyle = enemy.bodyColor;
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
//  ALIEN INVASION MODE -- musical chairs on the moon. Everyone walks; when
//  the SHED RUSH starts there's one fewer shed than players, and whoever
//  doesn't grab one gets abducted by a UFO. Last one standing wins.
// =========================================================================
let alienParts = [];
let alienSheds = [];
let alienPhase = 'walk';   // 'walk' | 'rush' | 'grab' | 'win'
let alienTimer = 0;
let alienMsg = '';
const alienUfo = { active: false, x: 0, y: -80, victim: null, phase: 'descend' };
const ALIEN_WALK = 3.2;
function alienGroundY() { return CONFIG.GAME_H - 130; }

function startAlien() {
  alienParts = [];
  alienParts.push({ x: CONFIG.GAME_W * 0.5, vx: 0, isPlayer: true, color: '#3d8fd6', alive: true, safe: false, walk: 0 });
  const n = Math.min(8, Math.max(4, enemies.length));
  for (let i = 0; i < n; i++) {
    alienParts.push({ x: 50 + Math.random() * (CONFIG.GAME_W - 100), vx: 0, isPlayer: false,
                      color: BOT_COLORS[i % BOT_COLORS.length], alive: true, safe: false, walk: 0 });
  }
  alienUfo.active = false; alienUfo.victim = null;
  alienPhase = 'walk'; alienTimer = 240;
  alienMsg = 'Walk around... get ready for the SHED RUSH!';
  layoutSheds();
}
function layoutSheds() {
  const alive = alienParts.filter(p => p.alive).length;
  const count = Math.max(0, alive - 1);          // one fewer shed than players
  alienSheds = [];
  for (let i = 0; i < count; i++) alienSheds.push({ x: (CONFIG.GAME_W * (i + 1)) / (count + 1), claimedBy: null });
}
function startGrab(loser) {
  alienPhase = 'grab';
  alienUfo.active = true; alienUfo.victim = loser; alienUfo.x = loser.x; alienUfo.y = -80; alienUfo.phase = 'descend';
  alienMsg = (loser.isPlayer ? 'YOU' : 'That player') + ' missed a shed -- here comes the UFO!';
}
function updateUfo() {
  const v = alienUfo.victim;
  if (alienUfo.phase === 'descend') {
    alienUfo.x = v.x; alienUfo.y += 4;
    if (alienUfo.y >= alienGroundY() - 44) { alienUfo.y = alienGroundY() - 44; alienUfo.phase = 'rise'; }
  } else {
    alienUfo.y -= 3.2; alienUfo.x = v.x;
    if (alienUfo.y < -80) {
      v.alive = false; alienUfo.active = false;
      layoutSheds();
      const alive = alienParts.filter(p => p.alive);
      if (alive.length <= 1) { alienPhase = 'win'; }
      else { alienPhase = 'walk'; alienTimer = 240; alienMsg = 'Walk around... get ready for the SHED RUSH!'; }
    }
  }
}
function alienUpdate() {
  camera.x = 0; camera.y = 0;
  const alive = alienParts.filter(p => p.alive);
  if (alive.length <= 1 && alienPhase !== 'grab') { alienPhase = 'win'; return; }
  const cx = x => Math.max(30, Math.min(CONFIG.GAME_W - 30, x));

  if (alienPhase === 'walk') {
    for (const p of alive) {
      if (p.isPlayer) p.vx = ((Input.right ? 1 : 0) - (Input.left ? 1 : 0)) * ALIEN_WALK;
      else { p.vx += (Math.random() - 0.5) * 0.7; p.vx = Math.max(-ALIEN_WALK * 0.7, Math.min(ALIEN_WALK * 0.7, p.vx)); }
      p.x = cx(p.x + p.vx); p.walk += Math.abs(p.vx) * 0.2;
    }
    alienTimer -= 1;
    if (alienTimer <= 0) { alienPhase = 'rush'; alienTimer = 600; alienSheds.forEach(s => s.claimedBy = null); alive.forEach(p => p.safe = false); alienMsg = 'RUN TO A SHED!! (arrows)'; }
  } else if (alienPhase === 'rush') {
    for (const p of alive) {
      if (p.safe) continue;
      let best = -1, bd = Infinity;
      for (let i = 0; i < alienSheds.length; i++) { if (alienSheds[i].claimedBy) continue; const d = Math.abs(alienSheds[i].x - p.x); if (d < bd) { bd = d; best = i; } }
      if (p.isPlayer) p.vx = ((Input.right ? 1 : 0) - (Input.left ? 1 : 0)) * ALIEN_WALK;
      else if (best >= 0) p.vx = Math.sign(alienSheds[best].x - p.x) * ALIEN_WALK;
      else p.vx = 0;
      p.x = cx(p.x + p.vx); p.walk += Math.abs(p.vx) * 0.2;
      for (let i = 0; i < alienSheds.length; i++) { if (!alienSheds[i].claimedBy && Math.abs(p.x - alienSheds[i].x) < 20) { alienSheds[i].claimedBy = p; p.safe = true; break; } }
    }
    const claimed = alienSheds.filter(s => s.claimedBy).length;
    if (alienSheds.length > 0 && claimed >= alienSheds.length) { const l = alive.find(p => !p.safe); if (l) startGrab(l); }
    alienTimer -= 1;
    if (alienTimer <= 0) { const l = alive.find(p => !p.safe); if (l) startGrab(l); else { alienPhase = 'walk'; alienTimer = 240; } }
  } else if (alienPhase === 'grab') {
    updateUfo();
  }
}

// ---- Alien mode drawing ----
function drawAlien() {
  const W = CONFIG.GAME_W, H = CONFIG.GAME_H, gy = alienGroundY();
  ctx.fillStyle = '#0a0a18'; ctx.fillRect(0, 0, W, H);          // space
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 130; i++) { ctx.fillRect((i * 173) % W, (i * 97) % Math.floor(H * 0.7), 2, 2); } // stars
  ctx.fillStyle = '#3a6ea5'; ctx.beginPath(); ctx.arc(W * 0.85, H * 0.16, 60, 0, Math.PI * 2); ctx.fill(); // Earth
  ctx.fillStyle = '#4a9a5a'; ctx.beginPath(); ctx.arc(W * 0.85 - 22, H * 0.16 - 8, 22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#9a9aa0'; ctx.fillRect(0, gy, W, H - gy);    // moon ground
  ctx.fillStyle = '#7e7e86';
  for (let i = 0; i < 16; i++) { const ccx = (i * 211) % W; ctx.beginPath(); ctx.arc(ccx, gy + 26 + (i * 53) % (H - gy - 36), 10 + (i * 7) % 12, 0, Math.PI * 2); ctx.fill(); }

  for (const s of alienSheds) drawShed(s.x, gy);
  for (const p of alienParts) {
    if (!p.alive) continue;
    let py = gy;
    if (alienUfo.active && alienUfo.victim === p && alienUfo.phase === 'rise') py = alienUfo.y + 40;
    drawWalker(p, py);
  }
  if (alienUfo.active) drawUfo(alienUfo);

  ctx.fillStyle = '#ffffff'; ctx.font = '20px monospace'; ctx.textAlign = 'center';
  if (alienPhase === 'win') {
    const w = alienParts.find(p => p.alive);
    ctx.fillStyle = '#ffe066';
    ctx.fillText((w && w.isPlayer ? '🏆 YOU WIN!' : 'A bot wins!') + ' Last one standing!', W / 2, 112);
  } else {
    ctx.fillText(alienMsg, W / 2, 108);
    ctx.font = '14px monospace';
    ctx.fillText('sheds: ' + alienSheds.length + '   players left: ' + alienParts.filter(p => p.alive).length, W / 2, 130);
  }
  ctx.textAlign = 'left';
}
function drawShed(x, gy) {
  ctx.fillStyle = '#8a5a3a'; ctx.fillRect(x - 16, gy - 22, 32, 22);
  ctx.fillStyle = '#6b4226'; ctx.beginPath(); ctx.moveTo(x - 19, gy - 22); ctx.lineTo(x, gy - 34); ctx.lineTo(x + 19, gy - 22); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - 6, gy - 14, 12, 14);
}
function drawWalker(p, feetY) {
  const x = p.x, bob = Math.sin(p.walk) * 1.5;
  ctx.fillStyle = p.color; ctx.fillRect(x - 4, feetY - 16, 8, 12);     // body
  ctx.fillStyle = '#dfe6ee'; ctx.beginPath(); ctx.arc(x, feetY - 20, 5, 0, Math.PI * 2); ctx.fill(); // helmet
  ctx.fillStyle = '#9fd8ff'; ctx.fillRect(x - 3, feetY - 22, 6, 4);    // visor
  ctx.fillStyle = p.color; ctx.fillRect(x - 3, feetY - 4, 2, 4 + bob); ctx.fillRect(x + 1, feetY - 4, 2, 4 - bob); // legs
  if (p.isPlayer) { ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.moveTo(x, feetY - 30); ctx.lineTo(x - 5, feetY - 38); ctx.lineTo(x + 5, feetY - 38); ctx.closePath(); ctx.fill(); }
}
function drawUfo(u) {
  ctx.fillStyle = 'rgba(120,255,160,0.22)';
  ctx.beginPath(); ctx.moveTo(u.x - 10, u.y); ctx.lineTo(u.x - 42, u.y + 130); ctx.lineTo(u.x + 42, u.y + 130); ctx.lineTo(u.x + 10, u.y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#9aa3a7'; ctx.beginPath(); ctx.ellipse(u.x, u.y, 36, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#cfd8dc'; ctx.beginPath(); ctx.ellipse(u.x, u.y - 7, 17, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7CFC00'; for (let i = -2; i <= 2; i++) ctx.fillRect(u.x + i * 11 - 1, u.y + 5, 3, 3);
}

// =========================================================================
//  DIRTBIKE MODE -- ride a motocross bike, hit 7 kinds of ramps, do flips,
//  and DON'T land upside down (or you crash).
// =========================================================================
// 7 ramp types: different heights/power and 3 visual styles (0 triangle,
// 1 curved kicker, 2 tabletop).
const DIRT_RAMPS = [
  { h: 30, power: 8,  style: 0 }, { h: 45, power: 10, style: 1 },
  { h: 60, power: 12, style: 2 }, { h: 25, power: 7,  style: 0 },
  { h: 78, power: 14, style: 1 }, { h: 52, power: 11, style: 2 },
  { h: 95, power: 16, style: 0 },
];
let dirtBike = null;
let dirtRamps = [];
let dirtMsg = '', dirtMsgTimer = 0;
function dirtGY() { return CONFIG.GROUND_Y - 14; } // where the wheels rest

function startDirtbike() {
  dirtBike = { x: 100, y: dirtGY(), vx: 0, vy: 0, angle: 0, onGround: true };
  dirtRamps = [];
  let x = 500;
  for (let i = 0; x < CONFIG.WORLD_WIDTH - 300; i++) {
    const t = DIRT_RAMPS[i % DIRT_RAMPS.length];
    dirtRamps.push({ x: x, h: t.h, power: t.power, style: t.style, w: 44 + t.h * 0.8 });
    x += 620 + (i % 3) * 180;
  }
  dirtMsg = ''; dirtMsgTimer = 0;
}
function dirtCrash() {
  bigExplosion(dirtBike.x, dirtBike.y);
  dirtMsg = 'CRASHED -- landed upside down!'; dirtMsgTimer = 120;
  // reset the bike where it is, back upright and stopped
  dirtBike.vx = 0; dirtBike.vy = 0; dirtBike.angle = 0; dirtBike.y = dirtGY(); dirtBike.onGround = true;
}
function dirtUpdate() {
  const b = dirtBike, gy = dirtGY();
  if (dirtMsgTimer > 0) dirtMsgTimer -= 1; else dirtMsg = '';

  if (b.onGround) {
    if (Input.up) b.vx += 0.25;       // gas
    if (Input.down) b.vx -= 0.22;     // brake
    b.vx *= 0.992; b.vx = Math.max(0, Math.min(15, b.vx));
    b.angle *= 0.7; if (Math.abs(b.angle) < 0.02) b.angle = 0;  // level out
    b.y = gy; b.vy = 0;
    b.x = wrapX(b.x + b.vx);
    for (const r of dirtRamps) {       // hit a ramp -> launch into the air
      if (Math.abs(wrapDX(r.x - b.x)) < r.w * 0.5 && b.vx > 2.5) {
        b.vy = -r.power * (0.6 + b.vx / 15);
        b.onGround = false;
        b.angle = -0.5;                // pops nose-up off the ramp
        break;
      }
    }
  } else {
    b.vy += 0.45;                      // gravity
    if (Input.left) b.angle -= 0.06;   // backflip
    if (Input.right) b.angle += 0.06;  // frontflip
    if (Input.up) b.vx += 0.05;        // a little air control
    b.x = wrapX(b.x + b.vx);
    b.y += b.vy;
    if (b.y >= gy) {                   // landing!
      b.y = gy;
      const a = Math.atan2(Math.sin(b.angle), Math.cos(b.angle)); // -PI..PI
      if (Math.abs(a) < 1.2) { b.onGround = true; b.angle = 0; b.vy = 0; } // upright = safe
      else dirtCrash();                // upside down = crash
    }
  }

  const targetX = b.x - CONFIG.GAME_W * 0.35;
  camera.x += wrapDX(targetX - camera.x) * 0.1;
  const targetY = Math.min(CONFIG.GROUND_Y - CONFIG.GAME_H + 200, b.y - CONFIG.GAME_H * 0.62);
  camera.y += (targetY - camera.y) * 0.12;
}

function dirtDraw() {
  const W = CONFIG.GAME_W, H = CONFIG.GAME_H;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#6fb7e8'); sky.addColorStop(1, '#cfe9f7');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  const by = CONFIG.GROUND_Y - camera.y;
  ctx.fillStyle = '#8a5a32'; ctx.fillRect(0, by, W, H - by);   // dirt
  ctx.fillStyle = '#6e4524'; ctx.fillRect(0, by, W, 4);
  for (const r of dirtRamps) drawRamp(r);
  drawBike(dirtBike);
  ctx.fillStyle = '#ffffff'; ctx.font = '18px monospace'; ctx.textAlign = 'center';
  ctx.fillText('DIRTBIKE!  Up = gas, Left/Right = flip in the air -- don\'t land upside down!', W / 2, 108);
  ctx.fillText('Speed ' + dirtBike.vx.toFixed(1), W / 2, 130);
  if (dirtMsgTimer > 0) { ctx.fillStyle = '#ff5a4a'; ctx.font = '24px monospace'; ctx.fillText(dirtMsg, W / 2, 168); }
  ctx.textAlign = 'left';
}
function drawRamp(r) {
  const sx = worldToScreenX(r.x), by = CONFIG.GROUND_Y - camera.y;
  if (sx < -120 || sx > CONFIG.GAME_W + 120) return;
  const w = r.w, h = r.h;
  ctx.fillStyle = '#7a5230';
  ctx.beginPath();
  if (r.style === 2) {               // tabletop
    ctx.moveTo(sx - w / 2, by); ctx.lineTo(sx - w / 4, by - h);
    ctx.lineTo(sx + w / 4, by - h); ctx.lineTo(sx + w / 2, by);
  } else if (r.style === 1) {        // curved kicker
    ctx.moveTo(sx - w / 2, by); ctx.quadraticCurveTo(sx + w / 2, by, sx + w / 2, by - h);
    ctx.lineTo(sx + w / 2, by);
  } else {                           // triangle
    ctx.moveTo(sx - w / 2, by); ctx.lineTo(sx + w / 2, by - h); ctx.lineTo(sx + w / 2, by);
  }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5a3b22'; ctx.fillRect(sx - w / 2, by - 2, w, 3);
}
function drawBike(b) {
  const sx = worldToScreenX(b.x), sy = b.y - camera.y;
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(b.angle);
  ctx.fillStyle = '#111111';
  ctx.beginPath(); ctx.arc(-12, 6, 8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(12, 6, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#666666';
  ctx.beginPath(); ctx.arc(-12, 6, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(12, 6, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e0413a'; ctx.fillRect(-12, 0, 24, 5);        // frame
  ctx.fillRect(9, -7, 4, 9);                                     // handlebars
  ctx.fillStyle = '#2c4a7a'; ctx.fillRect(-5, -12, 9, 11);       // rider body
  ctx.fillStyle = '#dfe6ee'; ctx.beginPath(); ctx.arc(2, -15, 4, 0, Math.PI * 2); ctx.fill(); // helmet
  ctx.restore();
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
