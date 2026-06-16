// ===========================================================================
//  SCENERY  --  The countryside: clouds, rolling hills, a far-away treeline,
//  and trees, bushes, haybales and barns sitting on the ground.
//
//  Things far away move SLOWER than things close up. That trick is called
//  "parallax" and it makes the world feel deep, like you're really flying.
//
//  The scenery goes on forever by "tiling": we figure out which slots are
//  on screen right now and draw an item in each one. Each slot always looks
//  the same because sceneRand() gives the same answer for the same slot.
// ===========================================================================

// Give back a steady "random-looking" number between 0 and 1 for a slot.
// Same input -> same output every time, so scenery doesn't flicker around.
function sceneRand(n) {
  const v = Math.sin(n * 127.1) * 43758.5453;
  return v - Math.floor(v);
}

// --- Clouds drifting in the sky (far away, so they move at half speed) ---
function drawClouds(ctx, camera) {
  const par = 0.5, spacing = 230;
  const camX = camera.x * par;
  const camY = camera.y * par;
  const start = Math.floor((camX - 80) / spacing);
  const end = Math.ceil((camX + CONFIG.GAME_W + 80) / spacing);

  ctx.fillStyle = CONFIG.COLORS.cloud;
  for (let i = start; i <= end; i++) {
    const sx = i * spacing - camX;
    const sy = 25 + sceneRand(i * 1.7) * (CONFIG.GAME_H * 0.45) - camY;
    const size = 12 + sceneRand(i * 2.3) * 16;
    ctx.fillRect(sx, sy, size * 2, size);
    ctx.fillRect(sx + size * 0.5, sy - size * 0.4, size, size);
    ctx.fillRect(sx - size * 0.4, sy + size * 0.1, size, size * 0.8);
  }
}

// --- One layer of rolling hills, drawn as overlapping domes ---
function drawHillLayer(ctx, camera, color, par, bump, spacing) {
  const groundY = CONFIG.GROUND_Y - camera.y;
  const camX = camera.x * par;
  const start = Math.floor((camX - bump) / spacing);
  const end = Math.ceil((camX + CONFIG.GAME_W + bump) / spacing);

  ctx.fillStyle = color;
  for (let i = start; i <= end; i++) {
    const sx = i * spacing - camX;
    const h = bump * (0.55 + sceneRand(i) * 0.9); // each hill a bit different
    ctx.beginPath();
    ctx.arc(sx, groundY, h, Math.PI, Math.PI * 2); // top half = a hill dome
    ctx.fill();
  }
}

// --- A dark band of tiny trees right on the horizon ---
function drawTreeline(ctx, camera) {
  const groundY = CONFIG.GROUND_Y - camera.y;
  const par = 0.82, spacing = 15;
  const camX = camera.x * par;
  const start = Math.floor((camX - 20) / spacing);
  const end = Math.ceil((camX + CONFIG.GAME_W + 20) / spacing);

  ctx.fillStyle = CONFIG.COLORS.treeline;
  for (let i = start; i <= end; i++) {
    const sx = i * spacing - camX;
    const h = 7 + sceneRand(i * 5) * 7;
    ctx.beginPath();
    ctx.arc(sx, groundY - 2, h, Math.PI, Math.PI * 2);
    ctx.fill();
  }
}

// --- The big background: clouds, far hills, treeline, near hills ---
// (Call this BEFORE drawing the ground so the hills rise out of it.)
function drawBackgroundScenery(ctx, camera) {
  const C = CONFIG.COLORS;
  drawClouds(ctx, camera);
  drawHillLayer(ctx, camera, C.hillFar, 0.65, 55, 80);  // far, smaller hills
  drawTreeline(ctx, camera);                            // trees on the horizon
  drawHillLayer(ctx, camera, C.hillNear, 0.85, 80, 120);// nearer, bigger hills
}

// --- The foreground: trees, bushes, haybales, barns ON the ground ---
// (Call this AFTER drawing the ground so they sit on the grass.)
function drawGroundScenery(ctx, camera) {
  const by = CONFIG.GROUND_Y - camera.y; // the grass line on screen
  const spacing = 120;
  const camX = camera.x;                 // parallax 1 = moves with the ground
  const start = Math.floor((camX - 60) / spacing);
  const end = Math.ceil((camX + CONFIG.GAME_W + 60) / spacing);

  for (let i = start; i <= end; i++) {
    const jitter = (sceneRand(i * 3.1) - 0.5) * 60; // nudge so it's not a grid
    const sx = i * spacing + jitter - camX;
    const r = sceneRand(i * 1.7);

    // Pick what grows in this slot.
    if (r < 0.40)      drawTree(ctx, sx, by, 0.8 + sceneRand(i * 9) * 0.7);
    else if (r < 0.62) drawBush(ctx, sx, by);
    else if (r < 0.84) drawHaybales(ctx, sx, by);
    else               drawBarn(ctx, sx, by);
  }
}

// ---- The individual things (all drawn sitting on the grass line "by") ----

function drawTree(ctx, sx, by, s) {
  const C = CONFIG.COLORS;
  const th = 16 * s; // trunk height
  ctx.fillStyle = C.treeTrunk;
  ctx.fillRect(sx - 2 * s, by - th, 4 * s, th);

  const cy = by - th - 6 * s, rad = 11 * s;
  ctx.fillStyle = C.treeLeaf;
  blob(ctx, sx, cy, rad);
  blob(ctx, sx - rad * 0.7, cy + rad * 0.3, rad * 0.7);
  blob(ctx, sx + rad * 0.7, cy + rad * 0.3, rad * 0.7);
  ctx.fillStyle = C.treeLeafDk;
  blob(ctx, sx + rad * 0.3, cy + rad * 0.4, rad * 0.6); // shadow side
}

function drawBush(ctx, sx, by) {
  const C = CONFIG.COLORS;
  ctx.fillStyle = C.treeLeaf;
  blob(ctx, sx, by - 5, 7);
  blob(ctx, sx - 6, by - 3, 5);
  blob(ctx, sx + 6, by - 3, 5);
  ctx.fillStyle = C.treeLeafDk;
  blob(ctx, sx + 2, by - 2, 4);
}

function drawHaybales(ctx, sx, by) {
  const C = CONFIG.COLORS;
  function bale(bx, baseY, bw, bh) {
    ctx.fillStyle = C.hay;
    ctx.fillRect(bx, baseY - bh, bw, bh);
    ctx.fillStyle = C.hayDark;
    ctx.fillRect(bx, baseY - bh * 0.4, bw, bh * 0.4); // shadow band
  }
  bale(sx - 10, by, 12, 9);
  bale(sx + 1, by, 12, 9);
  bale(sx - 4, by - 9, 11, 8); // one stacked on top
}

function drawBarn(ctx, sx, by) {
  const C = CONFIG.COLORS;
  const w = 30, h = 22;
  // Walls
  ctx.fillStyle = C.barnWall;
  ctx.fillRect(sx - w / 2, by - h, w, h);
  // Roof (a triangle)
  ctx.fillStyle = C.barnRoof;
  ctx.beginPath();
  ctx.moveTo(sx - w / 2 - 3, by - h);
  ctx.lineTo(sx, by - h - 12);
  ctx.lineTo(sx + w / 2 + 3, by - h);
  ctx.closePath();
  ctx.fill();
  // Door with a white cross of trim
  ctx.fillStyle = C.barnDoor;
  ctx.fillRect(sx - 5, by - 12, 10, 12);
  ctx.fillStyle = '#e8d8c0';
  ctx.fillRect(sx - 5, by - 7, 10, 1);
  ctx.fillRect(sx - 1, by - 12, 1, 12);
  // Little hay-loft window
  ctx.fillStyle = '#f1c40f';
  ctx.fillRect(sx - 3, by - h + 3, 6, 5);
}

// A small filled circle (used a lot for leaves and bushes).
function blob(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
