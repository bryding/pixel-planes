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

const camera = { x: 0, y: 0 };

// The list of bullets that are flying right now. Starts empty.
const bullets = [];

// One dummy enemy to shoot at (more enemies come in Stage 3).
const enemy = new Enemy(CONFIG.ENEMY_X, CONFIG.ENEMY_Y);

// How many enemies the player has popped. Shown in the HUD.
let score = 0;

// Some clouds scattered around the world to make flying feel like moving.
const clouds = [];
for (let i = 0; i < 30; i++) {
  clouds.push({
    x: i * 220 + (i * 53) % 140, // spread them out
    y: 20 + (i * 37) % 120,
    size: 8 + (i * 13) % 12,
  });
}

// A simple "did these two things touch?" check.
// We measure the distance between their centers; if it's smaller than
// "radius", they're close enough to count as a hit.
function hits(a, b, radius) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy < radius * radius;
}

// =========================================================================
//  UPDATE  --  move everything (runs every frame)
// =========================================================================
function update() {
  player.update();

  // If SPACE is held, ask the plane to shoot (it checks its own cooldown).
  if (Input.fire) player.tryShoot(bullets);

  // Move the enemy (it just bobs for now).
  enemy.update();

  // Move every bullet, and check if it hit the enemy.
  for (const bullet of bullets) {
    bullet.update();

    // Collision check: is the bullet close to the (alive) enemy?
    if (enemy.alive && hits(bullet, enemy, 9)) {
      bullet.dead = true;        // the bullet is used up
      const popped = enemy.takeHit();
      if (popped) score += 1;    // score a point when the enemy pops
    }
  }

  // Throw away bullets that are dead (off-screen, too old, or hit something).
  // We keep only the bullets that are NOT dead.
  for (let i = bullets.length - 1; i >= 0; i--) {
    if (bullets[i].dead) bullets.splice(i, 1);
  }

  // Make the camera follow the plane, peeking ahead where it's flying.
  const targetX = player.x - CONFIG.GAME_W / 2 + player.vx * CONFIG.CAM_LOOKAHEAD * 0.1;
  const targetY = player.y - CONFIG.GAME_H / 2;

  // Smoothly slide the camera toward the target (instead of snapping).
  camera.x += (targetX - camera.x) * CONFIG.CAM_SMOOTH;
  camera.y += (targetY - camera.y) * CONFIG.CAM_SMOOTH;

  // Don't let the camera show below the ground too much.
  const maxCamY = CONFIG.GROUND_Y - CONFIG.GAME_H + 20;
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

  // --- Clouds (move slower than the plane = "parallax", makes depth) ---
  ctx.fillStyle = C.cloud;
  for (const cloud of clouds) {
    const cx = cloud.x - camera.x * 0.5; // 0.5 = half speed = far away feeling
    const cy = cloud.y - camera.y * 0.5;
    // a fluffy cloud made of a few overlapping blobs
    ctx.fillRect(cx, cy, cloud.size * 2, cloud.size);
    ctx.fillRect(cx + cloud.size * 0.5, cy - cloud.size * 0.4, cloud.size, cloud.size);
  }

  // --- Far hills (move a bit slower than the ground) ---
  ctx.fillStyle = C.hills;
  const hillY = CONFIG.GROUND_Y - camera.y * 0.8;
  ctx.fillRect(0, hillY - 30, CONFIG.GAME_W, 40);

  // --- Ground ---
  const groundScreenY = CONFIG.GROUND_Y - camera.y;
  ctx.fillStyle = C.ground;
  ctx.fillRect(0, groundScreenY, CONFIG.GAME_W, CONFIG.GAME_H);
  ctx.fillStyle = C.groundDark;
  ctx.fillRect(0, groundScreenY, CONFIG.GAME_W, 4);

  // Some ground stripes that scroll by so you can feel the speed.
  ctx.fillStyle = C.groundDark;
  for (let i = -1; i < 20; i++) {
    const stripeX = (i * 60 - (camera.x % 60));
    ctx.fillRect(stripeX, groundScreenY + 14, 30, 3);
  }

  // --- The enemy target ---
  enemy.draw(ctx, camera.x, camera.y);

  // --- Bullets ---
  for (const bullet of bullets) {
    bullet.draw(ctx, camera.x, camera.y);
  }

  // --- The plane ---
  player.draw(ctx, camera.x, camera.y);

  // --- HUD (the info text on top) ---
  drawHud();
}

function drawHud() {
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(6, 6, 110, 34);

  ctx.fillStyle = '#ffffff';
  ctx.font = '8px monospace';

  // Throttle bar
  ctx.fillText('THROTTLE', 10, 16);
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(10, 19, 100, 6);
  ctx.fillStyle = '#f1c40f';
  ctx.fillRect(11, 20, 98 * player.throttle, 4);

  // Speed
  const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('SPEED ' + speed.toFixed(1), 10, 36);

  // Score (how many targets popped)
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(CONFIG.GAME_W - 70, 6, 64, 14);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('SCORE ' + score, CONFIG.GAME_W - 64, 16);

  // Friendly controls reminder in the corner
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('Arrows: fly   Space: shoot', 150, 264);
}

// =========================================================================
//  THE GAME LOOP  --  this calls update() then draw(), over and over.
// =========================================================================
function loop() {
  update();
  draw();
  requestAnimationFrame(loop); // ask the browser to run loop again next frame
}

loop(); // start the game!
