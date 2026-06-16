// ===========================================================================
//  SCENERY  --  The cartoon countryside: puffy clouds, rolling hills, a far
//  treeline, and trees / bushes / haybales / barns on the ground -- plus the
//  one BIG rescue barn in the middle of the world.
//
//  Far-away things move slower than near things ("parallax") for a feeling of
//  depth. The ground scenery is a fixed list placed around the looping world,
//  so when you fly all the way around you come back to the same fields.
// ===========================================================================

// Steady "random-looking" number 0..1 for a slot (so scenery never flickers).
function sceneRand(n) {
  const v = Math.sin(n * 127.1) * 43758.5453;
  return v - Math.floor(v);
}

// A small filled circle (used a lot for leaves, bushes and clouds).
function blob(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------
//  BACKGROUND (sky stuff) -- drawn BEFORE the ground. Tiles seamlessly.
// ---------------------------------------------------------------------------

// One puffy cartoon cloud built from several white blobs.
function drawCloud(ctx, x, y, s, seed) {
  ctx.fillStyle = '#ffffff';
  const lobes = 3 + Math.floor(sceneRand(seed * 3.1) * 3); // 3..5 puffs in a row
  for (let k = 0; k < lobes; k++) {
    const lx = x + (k - (lobes - 1) / 2) * (16 * s);
    const r = (10 + sceneRand(seed * 7.0 + k) * 8) * s;
    blob(ctx, lx, y, r);
  }
  blob(ctx, x - 8 * s, y - 10 * s, 11 * s); // a couple of higher puffs
  blob(ctx, x + 9 * s, y - 8 * s, 10 * s);
  ctx.fillStyle = '#e6f0f7';                 // soft flat bottom shadow
  ctx.fillRect(x - 22 * s, y + 7 * s, 44 * s, 4 * s);
}

function drawClouds(ctx, camera) {
  const par = 0.5, spacing = 300;
  const camX = camera.x * par, camY = camera.y * par;
  const start = Math.floor((camX - 160) / spacing);
  const end = Math.ceil((camX + CONFIG.GAME_W + 160) / spacing);
  for (let i = start; i <= end; i++) {
    const sx = i * spacing - camX;
    const sy = 40 + sceneRand(i * 1.7) * (CONFIG.GAME_H * 0.4) - camY;
    const s = 0.7 + sceneRand(i * 2.3) * 0.9;
    drawCloud(ctx, sx, sy, s, i);
  }
}

// One layer of rolling hills, drawn as overlapping domes.
function drawHillLayer(ctx, camera, color, par, bump, spacing) {
  const groundY = CONFIG.GROUND_Y - camera.y;
  const camX = camera.x * par;
  const start = Math.floor((camX - bump) / spacing);
  const end = Math.ceil((camX + CONFIG.GAME_W + bump) / spacing);
  ctx.fillStyle = color;
  for (let i = start; i <= end; i++) {
    const sx = i * spacing - camX;
    const h = bump * (0.55 + sceneRand(i) * 0.9);
    ctx.beginPath();
    ctx.arc(sx, groundY, h, Math.PI, Math.PI * 2);
    ctx.fill();
  }
}

// A dark band of tiny trees right on the horizon.
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

function drawBackgroundScenery(ctx, camera) {
  const C = CONFIG.COLORS;
  drawClouds(ctx, camera);
  drawHillLayer(ctx, camera, C.hillFar, 0.65, 55, 80);
  drawTreeline(ctx, camera);
  drawHillLayer(ctx, camera, C.hillNear, 0.85, 80, 120);
}

// ---------------------------------------------------------------------------
//  FOREGROUND (ground objects) -- a fixed list around the looping world.
// ---------------------------------------------------------------------------

const BARN_X = CONFIG.WORLD_WIDTH / 2; // the big rescue barn sits dead center.

// Build the list of ground objects once, spread around the whole world.
const SCENERY = (function () {
  const list = [];
  const spacing = 120;
  for (let x = 0; x < CONFIG.WORLD_WIDTH; x += spacing) {
    // Leave a clear field around the big barn so it stands alone.
    if (Math.abs(x - BARN_X) < 260) continue;
    const jitter = (sceneRand(x * 3.1) - 0.5) * 60;
    const r = sceneRand(x * 1.7);
    let type;
    if (r < 0.42) type = 'tree';
    else if (r < 0.64) type = 'bush';
    else if (r < 0.85) type = 'hay';
    else type = 'barn';
    list.push({ x: x + jitter, type: type, s: 0.8 + sceneRand(x * 9) * 0.7 });
  }
  return list;
})();

// Draw all the ground scenery for whatever part of the world is on screen.
function drawGroundScenery(ctx) {
  const by = CONFIG.GROUND_Y - camera.y;
  for (const item of SCENERY) {
    const sx = worldToScreenX(item.x);
    if (sx < -80 || sx > CONFIG.GAME_W + 80) continue; // off screen, skip
    if (item.type === 'tree') drawTree(ctx, sx, by, item.s);
    else if (item.type === 'bush') drawBush(ctx, sx, by);
    else if (item.type === 'hay') drawHaybales(ctx, sx, by);
    else drawBarn(ctx, sx, by);
  }
  // The big rescue barn in the middle.
  const bx = worldToScreenX(BARN_X);
  if (bx > -160 && bx < CONFIG.GAME_W + 160) drawBigBarn(ctx, bx, by);
}

function drawTree(ctx, sx, by, s) {
  const C = CONFIG.COLORS;
  const th = 16 * s;
  ctx.fillStyle = C.treeTrunk;
  ctx.fillRect(sx - 2 * s, by - th, 4 * s, th);
  const cy = by - th - 6 * s, rad = 11 * s;
  ctx.fillStyle = C.treeLeaf;
  blob(ctx, sx, cy, rad);
  blob(ctx, sx - rad * 0.7, cy + rad * 0.3, rad * 0.7);
  blob(ctx, sx + rad * 0.7, cy + rad * 0.3, rad * 0.7);
  ctx.fillStyle = C.treeLeafDk;
  blob(ctx, sx + rad * 0.3, cy + rad * 0.4, rad * 0.6);
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
    ctx.fillStyle = C.hay; ctx.fillRect(bx, baseY - bh, bw, bh);
    ctx.fillStyle = C.hayDark; ctx.fillRect(bx, baseY - bh * 0.4, bw, bh * 0.4);
  }
  bale(sx - 10, by, 12, 9);
  bale(sx + 1, by, 12, 9);
  bale(sx - 4, by - 9, 11, 8);
}

function drawBarn(ctx, sx, by) {
  const C = CONFIG.COLORS;
  const w = 30, h = 22;
  ctx.fillStyle = C.barnWall; ctx.fillRect(sx - w / 2, by - h, w, h);
  ctx.fillStyle = C.barnRoof;
  ctx.beginPath();
  ctx.moveTo(sx - w / 2 - 3, by - h); ctx.lineTo(sx, by - h - 12);
  ctx.lineTo(sx + w / 2 + 3, by - h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.barnDoor; ctx.fillRect(sx - 5, by - 12, 10, 12);
  ctx.fillStyle = '#e8d8c0'; ctx.fillRect(sx - 5, by - 7, 10, 1); ctx.fillRect(sx - 1, by - 12, 1, 12);
  ctx.fillStyle = '#f1c40f'; ctx.fillRect(sx - 3, by - h + 3, 6, 5);
}

// The big landmark barn in the middle of the world -- fly your parachute here!
function drawBigBarn(ctx, sx, by) {
  const C = CONFIG.COLORS;
  const w = 96, h = 64;

  // Silo on the left
  ctx.fillStyle = '#cfd8dc'; ctx.fillRect(sx - w / 2 - 22, by - 78, 18, 78);
  ctx.fillStyle = '#aeb6ba'; ctx.fillRect(sx - w / 2 - 22, by - 78, 5, 78);
  ctx.fillStyle = '#9aa3a7'; ctx.beginPath();
  ctx.arc(sx - w / 2 - 13, by - 78, 9, Math.PI, Math.PI * 2); ctx.fill(); // dome

  // Barn body
  ctx.fillStyle = C.barnWall; ctx.fillRect(sx - w / 2, by - h, w, h);
  ctx.fillStyle = '#9c3526'; ctx.fillRect(sx - w / 2, by - h, 6, h);       // shadow side
  // Gambrel (barn-shaped) roof
  ctx.fillStyle = C.barnRoof;
  ctx.beginPath();
  ctx.moveTo(sx - w / 2 - 6, by - h);
  ctx.lineTo(sx - w / 4, by - h - 16);
  ctx.lineTo(sx + w / 4, by - h - 16);
  ctx.lineTo(sx + w / 2 + 6, by - h);
  ctx.closePath(); ctx.fill();

  // Big doors with white trim (X braces)
  ctx.fillStyle = C.barnDoor; ctx.fillRect(sx - 20, by - 34, 40, 34);
  ctx.fillStyle = '#e8d8c0';
  ctx.fillRect(sx - 1, by - 34, 2, 34);          // center post
  ctx.fillRect(sx - 20, by - 18, 40, 2);          // mid rail
  ctx.fillRect(sx - 20, by - 34, 40, 2);          // top rail
  // Hayloft window + trims
  ctx.fillStyle = '#f1c40f'; ctx.fillRect(sx - 7, by - h + 6, 14, 10);
  ctx.fillStyle = '#e8d8c0'; ctx.fillRect(sx - 7, by - h + 10, 14, 1); ctx.fillRect(sx - 1, by - h + 6, 1, 10);
  // Side windows
  ctx.fillStyle = '#f1c40f';
  ctx.fillRect(sx - w / 2 + 10, by - 24, 8, 8);
  ctx.fillRect(sx + w / 2 - 18, by - 24, 8, 8);

  // Flag on the roof peak so it reads as the goal
  ctx.fillStyle = '#5a3b2e'; ctx.fillRect(sx - 1, by - h - 30, 2, 16);
  ctx.fillStyle = '#2ecc71'; ctx.fillRect(sx + 1, by - h - 30, 14, 8);
}
