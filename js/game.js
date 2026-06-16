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

// Your points. They grow when you shoot bots down. They RESET if you die,
// but you keep them if you eject and parachute safely to the barn.
let score = 0;

// The player can be 'flying', 'chute' (parachuting after ejecting), or 'dead'.
let playerState = 'flying';
let pilot = null;        // the parachuting pilot, when ejected
let playerRespawn = 0;   // counts down while dead, then a fresh plane flies in
let frameCount = 0;      // ticks up every frame (used for blinking warnings)
let deathMsg = 'SHOT DOWN!'; // what the middle-of-screen death message says

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

// Called when any plane is popped. Adds a boom, scores it if YOU did it, and
// handles your own death (points reset).
function onPlanePopped(target, shooterTeam) {
  bigExplosion(target.x, target.y);
  // Award the kill to whoever fired (you, or one of the bots).
  if (shooterTeam === 0) {
    score += 1;
  } else {
    const shooter = enemies.find(e => e.team === shooterTeam);
    if (shooter) shooter.score += 1;
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
    // Rolling down the "runway" and lifting off. Safe to touch the ground.
    player.update();
    if (frameCount % 6 === 0) {
      explosions.push(new Explosion(player.x - Math.cos(player.angle) * 10,
                                    CONFIG.GROUND_Y - 2, '#cbb58a')); // dust trail
    }
    if (player.y <= CONFIG.GROUND_Y - 55) playerState = 'flying'; // airborne!
  } else if (playerState === 'flying') {
    player.update();
    if (player.hitGround) {
      // Crashed into the ground! Big boom, points reset.
      bigExplosion(player.x, CONFIG.GROUND_Y - 6);
      playerDies(player.x, CONFIG.GROUND_Y - 6, 'CRASHED!');
    } else {
      if (Input.fire) player.tryShoot(bullets);
      if (missilePressed) player.fireMissile(missiles, planes);
      if (ejectPressed) eject();
    }
  } else if (playerState === 'chute') {
    pilot.update();
    if (pilot.landed) {
      // Did we land at the big barn? Then we're rescued (keep points).
      if (Math.abs(wrapDX(pilot.x - BARN_X)) < CONFIG.BARN_RESCUE_RANGE) rescueAtBarn();
      else playerDies(pilot.x, pilot.y, 'CRASHED!'); // landed in a field
    }
  } else { // 'dead'
    playerRespawn -= 1;
    if (playerRespawn <= 0) spawnPlane(camera.x + CONFIG.GAME_W / 2);
  }

  // --- The bots (each one thinks for itself; they can fire missiles too) ---
  for (const enemy of enemies) {
    enemy.update(planes, bullets, missiles);
  }

  // --- Bullets: move them and check if they hit any plane ---
  for (const bullet of bullets) {
    bullet.update();

    for (const target of planes) {
      if (!target.alive) continue;               // can't hit a downed plane
      if (target.team === bullet.team) continue; // bullets don't hit teammates
      if (hits(bullet, target, 14)) {
        bullet.dead = true;
        const popped = target.takeHit();
        if (popped) onPlanePopped(target, bullet.team);
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

  // --- Sky (a gradient from one blue to another) ---
  const sky = ctx.createLinearGradient(0, 0, 0, CONFIG.GAME_H);
  sky.addColorStop(0, C.skyTop);
  sky.addColorStop(1, C.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CONFIG.GAME_W, CONFIG.GAME_H);

  // --- Thin-air darkening: the higher you climb, the darker (and starrier)
  // the sky gets, warning you that you're near the stall zone. ---
  const altY = (playerState === 'chute' && pilot) ? pilot.y : player.y;
  const altFactor = Math.max(0, Math.min(1,
    (CONFIG.STALL_ALT - altY) / (CONFIG.STALL_ALT - CONFIG.CEILING)));
  if (altFactor > 0.01) {
    ctx.fillStyle = 'rgba(8,16,40,' + (altFactor * 0.55) + ')';
    ctx.fillRect(0, 0, CONFIG.GAME_W, CONFIG.GAME_H);
    ctx.fillStyle = 'rgba(255,255,255,' + (altFactor * 0.8) + ')';
    for (let i = 0; i < 40; i++) {
      const sx = (i * 197) % CONFIG.GAME_W;
      const sy = (i * 113) % Math.floor(CONFIG.GAME_H * 0.6);
      ctx.fillRect(sx, sy, 2, 2);
    }
  }

  // --- Clouds, far hills, and the treeline on the horizon ---
  drawBackgroundScenery(ctx, camera);

  // --- Ground ---
  const groundScreenY = CONFIG.GROUND_Y - camera.y;
  ctx.fillStyle = C.ground;
  ctx.fillRect(0, groundScreenY, CONFIG.GAME_W, CONFIG.GAME_H);
  ctx.fillStyle = C.groundDark;
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

  // --- HUD (the info text on top) ---
  drawHud();
  drawLeaderboard();
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
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(6, 6, 128, 74);

  ctx.fillStyle = '#ffffff';
  ctx.font = '8px monospace';

  // Throttle bar
  ctx.fillText('THROTTLE', 10, 16);
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(10, 19, 100, 6);
  ctx.fillStyle = '#f1c40f';
  ctx.fillRect(11, 20, 98 * player.throttle, 4);

  // Health bar (turns from green toward red as it empties)
  ctx.fillStyle = '#ffffff';
  ctx.fillText('HEALTH', 10, 34);
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(10, 37, 100, 6);
  const healthFrac = Math.max(0, player.health) / CONFIG.PLAYER_HEALTH;
  ctx.fillStyle = healthFrac > 0.5 ? '#2ecc71' : (healthFrac > 0.25 ? '#f39c12' : '#e74c3c');
  ctx.fillRect(11, 38, 98 * healthFrac, 4);

  // Missiles: one little box per missile (filled = ready). The next box
  // slowly fills up to show the refill timer.
  ctx.fillStyle = '#ffffff';
  ctx.fillText('MISSILES', 10, 54);
  for (let i = 0; i < CONFIG.MISSILE_MAX; i++) {
    const bx = 62 + i * 12, by = 48;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(bx, by, 10, 6);
    if (i < player.missiles) {
      ctx.fillStyle = CONFIG.COLORS.missile;
      ctx.fillRect(bx + 1, by + 1, 8, 4);
    } else if (i === player.missiles) {
      const frac = player.missileTimer / (CONFIG.MISSILE_REFILL_SECONDS * 60);
      ctx.fillStyle = '#7f8c8d';
      ctx.fillRect(bx + 1, by + 1, 8 * frac, 4);
    }
  }

  // Speed
  const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('SPEED ' + speed.toFixed(1), 10, 70);

  // Big middle-of-screen messages for ejecting / being shot down.
  ctx.textAlign = 'center';
  if (playerState === 'chute') {
    ctx.fillStyle = '#2ecc71';
    ctx.font = '20px monospace';
    ctx.fillText('EJECTED!', CONFIG.GAME_W / 2, 70);
    ctx.font = '11px monospace';
    ctx.fillText('Steer your parachute to the BIG BARN to save your ' + score + ' points!',
                 CONFIG.GAME_W / 2, 90);
  } else if (playerState === 'dead') {
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px monospace';
    ctx.fillText(deathMsg, CONFIG.GAME_W / 2, CONFIG.GAME_H / 2);
    ctx.font = '11px monospace';
    ctx.fillText('points lost -- taking off again...', CONFIG.GAME_W / 2, CONFIG.GAME_H / 2 + 20);
  }
  ctx.textAlign = 'left';

  // Score (how many targets popped)
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(CONFIG.GAME_W - 80, 6, 74, 16);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('SCORE ' + score, CONFIG.GAME_W - 74, 17);

  // Altitude gauge on the right edge. Top = the ceiling, bottom = the ground.
  // The red band at the top is the "thin air" stall zone.
  const gx = CONFIG.GAME_W - 22, gy = 30, gh = 240;
  const top = CONFIG.CEILING, bot = CONFIG.GROUND_Y;
  const altToBar = (y) => gy + gh * (y - top) / (bot - top);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(gx - 2, gy - 2, 14, gh + 4);
  ctx.fillStyle = 'rgba(231,76,60,0.5)';
  ctx.fillRect(gx, gy, 10, altToBar(CONFIG.STALL_ALT) - gy); // stall zone
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
//  THE GAME LOOP  --  this calls update() then draw(), over and over.
// =========================================================================
function loop() {
  frameCount += 1;
  update();
  draw();
  requestAnimationFrame(loop); // ask the browser to run loop again next frame
}

loop(); // start the game!
