// ===========================================================================
//  GAME  --  the main loop for Pixel Planes: ONE always-on shared world.
//
//  You type a name, press JOIN, and fly in the same sky as everyone else (real
//  players + server bots that fill the empty spots). It's a free-for-all: shoot
//  others down, get shot down, and auto-respawn. This file ties the keyboard,
//  the flight, the drawing, and the network together.
//
//  The plane flight, bullets, missiles, explosions, sprites and scenery all
//  live in their own files and are reused here unchanged.
// ===========================================================================

// ---- The drawing surface ----
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = CONFIG.GAME_W;
canvas.height = CONFIG.GAME_H;

// Fit the small game picture to the window, keeping it crisp and chunky.
function resize() {
  const scale = Math.min(window.innerWidth / CONFIG.GAME_W, window.innerHeight / CONFIG.GAME_H);
  canvas.style.width = CONFIG.GAME_W * scale + 'px';
  canvas.style.height = CONFIG.GAME_H * scale + 'px';
}
window.addEventListener('resize', resize);
resize();

// ---- Compatibility constants ----
// The shared flight/drawing files (plane.js, scenery.js …) were written when the
// game also had alternate "modes" and a 2-player split screen. The shared world
// is always one plain free-for-all, so we pin these and those files behave normally.
const mode = 'classic';
const splitScreen = false;

// ---- Your plane and the camera ----
const player = new Plane(100, 120);
const camera = { x: 0, y: 0 };
let viewOriginX = 0, viewWidth = CONFIG.GAME_W;

// Turn a world x into a screen x, picking the copy of it (the world loops) that
// is closest to the middle of the view.
function worldToScreenX(wx) {
  const W = CONFIG.WORLD_WIDTH;
  const center = camera.x + viewWidth / 2;
  const copy = wx + Math.round((center - wx) / W) * W;
  return (copy - camera.x) + viewOriginX;
}

// Things in flight right now.
const bullets = [];
const missiles = [];
const explosions = [];
let missileWasDown = false;          // so one key press = one missile
// fireMissile() wants a list of planes to lock onto; online the only local plane
// is your own, so your missiles fly straight (real aiming is the network's job).
const planes = [player];

// ---- Game state ----
let score = 0;              // your kills THIS life
// Your TOTAL score: dying BANKS this life's points here instead of losing them,
// so it keeps growing over time. Saved between visits, too.
let totalScore = (function () { try { return parseInt(localStorage.getItem('pp_totalscore'), 10) || 0; } catch (e) { return 0; } })();
function saveTotalScore() { try { localStorage.setItem('pp_totalscore', totalScore); } catch (e) {} }
let playerState = 'flying'; // 'takeoff' | 'flying' | 'dead'
let playerRespawn = 0;      // counts down while dead, then you fly back in
let frameCount = 0;
let paused = false;
let gameStarted = false;    // false = still on the name screen
let deathMsg = 'SHOT DOWN!';

// ---- Your plane's color (saved between visits) ----
let playerSpriteSet = PLANE_SPRITES.player;
function getPlayerColor() { try { return localStorage.getItem('pp_playercolor') || ''; } catch (e) { return ''; } }
function setPlayerColor(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
  playerSpriteSet = makePlaneSetFromColor(hex);
  try { localStorage.setItem('pp_playercolor', hex); } catch (e) {}
  const w = document.getElementById('colorWheel'); if (w) w.value = hex;
}
(function () { const c = getPlayerColor(); if (c) setPlayerColor(c); })();

// Browsers block sound until you interact; unlock it on the first tap/key.
['pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
  window.addEventListener(ev, () => { if (typeof Sound !== 'undefined') Sound.init(); }, { passive: true }));

// ===========================================================================
//  NAME + SERVER  (the name screen, settings, pause menu)
// ===========================================================================

function getUsername() { try { return localStorage.getItem('pp_username') || ''; } catch (e) { return ''; } }
function saveUsername(name) { try { localStorage.setItem('pp_username', name); } catch (e) {} }

// Which server to talk to: the same computer that served the page over http (so
// local + same-WiFi play just works), else the deployed server in config.js.
function serverUrl() {
  if (typeof location !== 'undefined' && location.host && location.protocol !== 'https:') {
    return 'ws://' + location.host;
  }
  return CONFIG.SERVER_URL;
}

// ---- Settings screen (volume + mobile controls), reached from the name gate ----
function openSettings() {
  const g = document.getElementById('clickGate'); if (g) g.style.display = 'none';
  const se = document.getElementById('settingsScreen'); if (se) se.style.display = 'flex';
  if (typeof Sound === 'undefined') return;
  const sl = document.getElementById('volSlider'), lb = document.getElementById('volLabel');
  if (sl) sl.value = Math.round(Sound.volume * 100);
  if (lb) lb.textContent = Math.round(Sound.volume * 100) + '%';
}
function setVolumePct(pct) {
  if (typeof Sound === 'undefined') return;
  Sound.init();
  Sound.setVolume(pct / 100);
  const lb = document.getElementById('volLabel'); if (lb) lb.textContent = Math.round(pct) + '%';
  Sound.gun();                  // a quick click so you HEAR the level you set
}
function closeSettings() {
  const se = document.getElementById('settingsScreen'); if (se) se.style.display = 'none';
  const g = document.getElementById('clickGate'); if (g) g.style.display = 'flex';
}

// ---- Pause menu ----
function pauseToggle() { if (!gameStarted) return; paused = !paused; updatePauseMenu(); }
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !e.repeat) pauseToggle(); });
function updatePauseMenu() {
  const m = document.getElementById('pauseMenu'); if (m) m.style.display = paused ? 'flex' : 'none';
  if (paused) backToPause();
}
function showPausePanel(id) {
  ['pauseMain', 'colorPanel'].forEach((p) => { const el = document.getElementById(p); if (el) el.style.display = (p === id) ? 'flex' : 'none'; });
}
function backToPause() { showPausePanel('pauseMain'); }
function resumeGame() { paused = false; updatePauseMenu(); }
function showColorPanel() { showPausePanel('colorPanel'); const w = document.getElementById('colorWheel'); const s = getPlayerColor(); if (w && s) w.value = s; }

// Leave the world and go back to the name screen.
function leaveWorld() {
  Net.disconnect();
  paused = false; updatePauseMenu();
  gameStarted = false; player.alive = false; playerState = 'flying';
  for (const k in remotePlayers) delete remotePlayers[k];
  const gate = document.getElementById('clickGate'); if (gate) gate.style.display = 'flex';
}

// Net tells us when its status changes; keep the name screen's status fresh.
Net.onChange = function () { if (typeof refreshJoinStatus === 'function') refreshJoinStatus(); };

// ===========================================================================
//  ONLINE LIVE SYNC — the ONE shared world.
//  The server sends a SNAPSHOT of every plane ~NET_TICK_HZ times a second. We
//  fly OUR OWN plane locally and draw everyone else from the snapshots, gliding
//  them smoothly between updates so movement still looks nice (interpolation).
// ===========================================================================
const remotePlayers = {};       // id -> {x,y,tx,ty,angle,health,alive,name,score}
let netStateTimer = 0;
const NET_SEND_EVERY = Math.max(1, Math.round(60 / CONFIG.NET_TICK_HZ));  // send our plane ~NET_TICK_HZ/sec
const REMOTE_COLORS = ['#e0524a', '#3fae54', '#e0a93a', '#9b59b6', '#e84393', '#1abc9c', '#ff7f50'];
const _remoteSprites = {};
function remoteSprite(id) {
  const c = REMOTE_COLORS[((id % REMOTE_COLORS.length) + REMOTE_COLORS.length) % REMOTE_COLORS.length];
  if (!_remoteSprites[c]) _remoteSprites[c] = makePlaneSetFromColor(c);
  return _remoteSprites[c];
}

// The server welcomed us into the world: clear any stale planes and fly in.
Net.onWelcome = function () {
  for (const k in remotePlayers) delete remotePlayers[k];
  enterWorld();
};
// Join refused (e.g. the world is full): show why, back on the name screen.
Net.onDenied = function (msg) { Net.disconnect(); setJoinStatus(msg, '#ff6b6b'); };

// A fresh snapshot: update each OTHER plane's target spot (we glide toward it).
Net.onSnapshot = function (planesArr) {
  const seen = {};
  for (const s of planesArr) {
    if (s.id === Net.myId) continue;          // that's us — we draw ourselves
    seen[s.id] = true;
    let r = remotePlayers[s.id];
    if (!r) r = remotePlayers[s.id] = { x: s.x, y: s.y, angle: s.angle || 0 };
    r.tx = s.x; r.ty = s.y; r.angle = s.angle || 0;
    r.health = s.health; r.alive = (s.alive !== false); r.name = s.name; r.score = s.score || 0;
  }
  for (const id in remotePlayers) { if (!seen[id]) delete remotePlayers[id]; } // gone (FR-010)
};
// The server says this plane left — drop it right away (FR-010).
Net.onLeft = function (id) { delete remotePlayers[id]; };

// Run each frame while in the world: send our plane, glide the others.
function netSyncStep() {
  netStateTimer += 1;
  if (netStateTimer >= NET_SEND_EVERY && (playerState === 'flying' || playerState === 'takeoff')) {
    netStateTimer = 0;
    Net.sendState({ x: player.x, y: player.y, angle: player.angle, vx: player.vx, vy: player.vy,
                    throttle: player.throttle, health: player.health, alive: player.alive, score: score });
  }
  for (const id in remotePlayers) {
    const r = remotePlayers[id];
    if (r.tx !== undefined) { r.x = wrapX(r.x + wrapDX(r.tx - r.x) * 0.35); r.y += (r.ty - r.y) * 0.35; }
  }
}

// ===========================================================================
//  JOINING THE SHARED WORLD  (the name screen → fly in)
// ===========================================================================

// Tidy a typed name the same way the server does: trim, safe charset, cap 14.
function capName(n) { return ('' + (n || '')).trim().replace(/[^A-Za-z0-9 _-]/g, '').slice(0, 14); }
function setJoinStatus(text, color) {
  const el = document.getElementById('joinStatus');
  if (el) { el.textContent = text; el.style.color = color || 'rgba(255,255,255,0.85)'; }
}
// Net calls this when its status changes, so we can show "Connecting…"/errors.
function refreshJoinStatus() {
  if (Net.inWorld) return;
  if (Net.status === 'connecting') setJoinStatus('Connecting…', '#9be7ff');
  else if (Net.status === 'offline' && Net.lastError) setJoinStatus(Net.lastError, '#ff6b6b');
}
// JOIN GAME button: take the typed name and dive into the one shared world.
function joinWorld() {
  const el = document.getElementById('nameInput');
  const name = capName((el && el.value) || '');
  if (!name) { setJoinStatus('Please type a name first.', '#ffd24a'); return; }
  saveUsername(name);
  if (typeof Sound !== 'undefined') Sound.init();
  Net.setName(name);
  Net.connect(serverUrl());
  setJoinStatus('Connecting…', '#9be7ff');
}
// We're in! Hide the name screen and fly our plane into the shared sky.
function enterWorld() {
  const gate = document.getElementById('clickGate'); if (gate) gate.style.display = 'none';
  const se = document.getElementById('settingsScreen'); if (se) se.style.display = 'none';
  gameStarted = true;
  spawnPlane(camera.x + CONFIG.GAME_W / 2);
}
// Start the name box with your last-used name filled in.
(function prefillName() { const el = document.getElementById('nameInput'); if (el) el.value = getUsername(); })();

// ===========================================================================
//  ONLINE COMBAT — fire visuals, shooter-detected hits, damage & respawn.
//  The rule (FR-015): the SHOOTER's computer notices when its own bullet hits
//  someone and tells the server; the server then deals the damage. Bullets you
//  see from other players are just for show — they never hurt you by themselves.
// ===========================================================================
const REMOTE_TEAM = -1;   // marks bullets/missiles that came from OTHER players

// Bots (server ids >= 1,000,000) all show as "Bot"; humans keep their chosen name.
function isBotId(id) { return parseInt(id, 10) >= 1000000; }
function remoteName(id) {
  if (isBotId(id)) return 'Bot';
  const r = remotePlayers[id]; return (r && r.name) || 'a plane';
}

// The nearest OTHER plane (real player or bot) to you — used to auto-lock missiles.
function nearestRemotePlane() {
  let best = null, bestDist = Infinity;
  for (const id in remotePlayers) {
    const r = remotePlayers[id];
    if (!r || r.alive === false || r.x === undefined) continue;
    const dx = wrapDX(r.x - player.x), dy = r.y - player.y;
    const d = dx * dx + dy * dy;
    if (d < bestDist) { bestDist = d; best = r; }
  }
  return best;
}

// Did one of MY shots reach a remote plane? If so, tell the server.
function onlineHitCheck(proj, kind) {
  if (proj.dead) return;
  const radius = (kind === 'missile') ? 16 : 14;
  for (const id in remotePlayers) {
    const r = remotePlayers[id];
    if (!r || r.alive === false || r.x === undefined) continue;
    if (hits(proj, r, radius)) {
      proj.dead = true;
      if (kind === 'missile') {
        explosions.push(new Explosion(proj.x, proj.y, CONFIG.COLORS.explosion));
        if (typeof Sound !== 'undefined') Sound.boom();
      }
      Net.sendHit(parseInt(id, 10), kind);
      break;
    }
  }
}

// Someone else fired: draw their shot + play the sound (no damage here).
Net.onFire = function (id, kind, x, y, heading) {
  if (id === Net.myId) return;
  if (kind === 'missile') {
    const mo = new Missile(x, y, heading, REMOTE_TEAM, null);
    mo.visual = true; missiles.push(mo);
    if (typeof Sound !== 'undefined') Sound.missileLaunch();
  } else {
    const b = new Bullet(x, y, heading, 0, 0, REMOTE_TEAM, CONFIG.COLORS.enemyBullet, 'green');
    b.visual = true; bullets.push(b);
    if (typeof Sound !== 'undefined') Sound.gun();
  }
};

// The server says YOU got hit. Take the damage; if it's fatal, explode and
// auto-respawn in place (never back to the name screen), score reset (FR-009).
Net.onHit = function (byId, kind) {
  if (playerState !== 'flying' && playerState !== 'takeoff') return;
  // takeHit() applies the damage + flash, but ignores it while spawn-protected
  // (invincibleTimer). It returns true only when this hit was fatal.
  const dmg = (kind === 'missile') ? CONFIG.MISSILE_DAMAGE : 1;
  if (!player.takeHit(dmg)) return;
  bigExplosion(player.x, player.y);
  if (typeof Sound !== 'undefined') Sound.boom();
  pushKill('🛩️ You were shot down 💥', '#ff8a65');
  playerDies('SHOT DOWN!');
  // Send one last state so the server knows we died and can credit the kill.
  Net.sendState({ x: player.x, y: player.y, angle: player.angle, vx: 0, vy: 0,
                  throttle: 0, health: 0, alive: false, score: 0 });
};

// A plane was destroyed. If WE got the kill, score a point. Show the boom.
Net.onDown = function (victimId, byId) {
  if (byId === Net.myId && victimId !== Net.myId) {
    score += 1;
    pushKill('🎯 You shot down ' + remoteName(victimId) + '!', '#7CFC00');
  }
  const r = remotePlayers[victimId];
  if (r && r.x !== undefined) { bigExplosion(r.x, r.y); r.alive = false; }
};

// ===========================================================================
//  MOBILE TOUCH CONTROLS — on-screen buttons drive the SAME Input flags the
//  keyboard does, so flight + guns + missiles work the same by touch.
// ===========================================================================
let mobileMode = false;
function toggleMobile() {
  mobileMode = !mobileMode;
  const mc = document.getElementById('mobileControls'); if (mc) mc.style.display = mobileMode ? 'block' : 'none';
  const btn = document.getElementById('mobileBtn'); if (btn) btn.textContent = '📱 Mobile: ' + (mobileMode ? 'ON' : 'OFF');
}
function setupMobileControls() {
  const hold = (id, on, off) => {
    const el = document.getElementById(id); if (!el) return;
    const press = (e) => {
      if (e.preventDefault) e.preventDefault();
      if (e.pointerId !== undefined && el.setPointerCapture) { try { el.setPointerCapture(e.pointerId); } catch (_) {} }
      on();
    };
    const release = (e) => { if (e && e.preventDefault) e.preventDefault(); off(); };
    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('touchstart', press, { passive: false });
    el.addEventListener('touchend', release);
    el.addEventListener('touchcancel', release);
  };
  hold('mcLeft',    () => Input.left = true,    () => Input.left = false);
  hold('mcRight',   () => Input.right = true,   () => Input.right = false);
  hold('mcGun',     () => Input.fire = true,    () => Input.fire = false);
  hold('mcMissile', () => Input.missile = true, () => Input.missile = false);
  const slider = document.getElementById('mcThrottle');
  if (slider) slider.addEventListener('input', () => { player.throttle = slider.value / 100; });
}
setupMobileControls();
// Phones/tablets: turn the touch controls on automatically (still toggleable).
if (typeof navigator !== 'undefined' && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window)) toggleMobile();

// ===========================================================================
//  SMALL HELPERS
// ===========================================================================

// Slide the camera smoothly toward the plane.
function followCam(cam, focus) {
  const tx = focus.x - CONFIG.GAME_W / 2 + (focus.vx || 0) * CONFIG.CAM_LOOKAHEAD * 0.1;
  const ty = focus.y - CONFIG.GAME_H / 2;
  cam.x += wrapDX(tx - cam.x) * CONFIG.CAM_SMOOTH;
  cam.y += (ty - cam.y) * CONFIG.CAM_SMOOTH;
  const maxCamY = CONFIG.GROUND_Y - CONFIG.GAME_H + 140;
  if (cam.y > maxCamY) cam.y = maxCamY;
}

// "Did these two things touch?" (using the looping distance).
function hits(a, b, radius) {
  const dx = wrapDX(a.x - b.x), dy = a.y - b.y;
  return dx * dx + dy * dy < radius * radius;
}

// Start a fresh plane ON THE GROUND at world x, and roll into a takeoff.
function spawnPlane(x) {
  player.alive = true;
  player.health = CONFIG.PLAYER_HEALTH;
  player.x = wrapX(x);
  player.y = CONFIG.GROUND_Y - 6;
  player.vx = 0.5; player.vy = 0;
  player.angle = -0.12;
  player.flash = 0;
  player.throttle = 1;
  player.missiles = CONFIG.MISSILE_MAX;
  player.missileTimer = 0;
  player.hitGround = true;
  player.invincibleTimer = CONFIG.SPAWN_PROTECT;   // brief shield so you're not shot the instant you fly in
  playerState = 'takeoff';
  explosions.push(new Explosion(player.x - 8, CONFIG.GROUND_Y - 2, '#cbb58a')); // dust
}

// A big fireball boom for crashes and destroyed planes.
function bigExplosion(x, y) {
  explosions.push(new Explosion(x, y, '#ffce54', true));
  explosions.push(new Explosion(x, y, '#ff7a1a'));
  explosions.push(new Explosion(x - 10, y - 6, '#ff5a4a'));
  explosions.push(new Explosion(x + 10, y - 4, '#ffce54'));
  explosions.push(new Explosion(x, y - 8, '#888888'));
}

// You died: BANK this life's points into your total (never lost), then respawn.
function playerDies(msg) {
  deathMsg = msg || 'SHOT DOWN!';
  totalScore += score; saveTotalScore();
  score = 0;
  player.alive = false;
  playerState = 'dead';
  playerRespawn = CONFIG.RESPAWN_DELAY;
}

// The "who shot down who" feed on the left side (newest first, fades out).
const killFeed = [];
function pushKill(text, color) { killFeed.unshift({ text: text, color: color, life: 360 }); if (killFeed.length > 7) killFeed.pop(); }

// ===========================================================================
//  UPDATE  --  move everything (runs every frame)
// ===========================================================================
function update() {
  const missilePressed = Input.missile && !missileWasDown;
  missileWasDown = Input.missile;

  if (gameStarted) {
    if (playerState === 'takeoff') {
      // Rolling down the "runway": full power, nose up, until we lift off.
      player.throttle = 1; player.angle = -0.3; player.update();
      if (frameCount % 5 === 0) explosions.push(new Explosion(player.x - Math.cos(player.angle) * 10, CONFIG.GROUND_Y - 2, '#cbb58a'));
      if (player.y <= CONFIG.GROUND_Y - 55) playerState = 'flying';
    } else if (playerState === 'flying') {
      player.update();
      // Coming in too fast or too steep is a fatal crash; a gentle touch rolls.
      const hardLanding = player.hitGround &&
        (player.impactVy >= CONFIG.LAND_MAX_VY || Math.abs(angleDiff(player.angle, 0)) >= CONFIG.LAND_MAX_ANGLE);
      if (hardLanding) {
        bigExplosion(player.x, CONFIG.GROUND_Y - 6);
        pushKill('🛩️ You crashed 💥', '#ff8a65');
        playerDies('CRASHED!');
        if (Net.inWorld) Net.sendState({ x: player.x, y: CONFIG.GROUND_Y - 6, angle: player.angle, vx: 0, vy: 0, throttle: 0, health: 0, alive: false, score: 0 });
      } else {
        // Guns: shoot, and tell everyone so they see the shot.
        if (Input.fire) {
          const wasReady = player.fireCooldown <= 0;
          player.tryShoot(bullets);
          if (Net.inWorld && wasReady && player.fireCooldown > 0)
            Net.sendFire('gun', player.x + Math.cos(player.angle) * 17, player.y + Math.sin(player.angle) * 17, player.angle);
        }
        // Missiles: one per press, ammo-limited.
        const mBefore = missiles.length;
        if (missilePressed) player.fireMissile(missiles, planes);
        if (missiles.length > mBefore) {
          // AUTO-LOCK: aim the new missile at the nearest plane (player or bot).
          const m = missiles[missiles.length - 1];
          if (m && !m.visual) m.target = nearestRemotePlane();
          if (Net.inWorld)
            Net.sendFire('missile', player.x + Math.cos(player.angle) * 17, player.y + Math.sin(player.angle) * 17, player.angle);
        }
      }
    } else { // 'dead' -> auto-respawn after the delay
      playerRespawn -= 1;
      if (playerRespawn <= 0) spawnPlane(camera.x + CONFIG.GAME_W / 2);
    }
  }

  // Online: send my plane to the others and glide their planes.
  if (Net.inWorld) netSyncStep();

  // Bullets: move them; my own ones report hits on remote planes (FR-015).
  for (const bullet of bullets) {
    bullet.update();
    if (Net.inWorld && !bullet.visual) onlineHitCheck(bullet, 'gun');
  }
  // Missiles: same idea, but keep them auto-locked onto the nearest plane.
  for (const missile of missiles) {
    if (!missile.visual && (!missile.target || missile.target.alive === false))
      missile.target = nearestRemotePlane();
    missile.update();
    if (Net.inWorld && !missile.visual) onlineHitCheck(missile, 'missile');
  }
  // Explosions: just animate the sparks.
  for (const boom of explosions) boom.update();

  // Clean up finished things.
  for (let i = bullets.length - 1; i >= 0; i--) if (bullets[i].dead) bullets.splice(i, 1);
  for (let i = missiles.length - 1; i >= 0; i--) if (missiles[i].dead) missiles.splice(i, 1);
  for (let i = explosions.length - 1; i >= 0; i--) if (explosions[i].dead) explosions.splice(i, 1);
  for (let i = killFeed.length - 1; i >= 0; i--) { killFeed[i].life -= 1; if (killFeed[i].life <= 0) killFeed.splice(i, 1); }

  // The camera follows the plane once you're flying.
  if (gameStarted) followCam(camera, player);
}

// ===========================================================================
//  DRAW  --  paint everything onto the screen (runs every frame)
// ===========================================================================
function draw() {
  viewOriginX = 0; viewWidth = CONFIG.GAME_W;
  drawWorldContents();
  if (gameStarted) drawHudLayer();
}

function drawWorldContents() {
  const C = CONFIG.COLORS;

  // --- Sky ---
  const sky = ctx.createLinearGradient(0, 0, 0, CONFIG.GAME_H);
  sky.addColorStop(0, C.skyTop); sky.addColorStop(1, C.skyBottom);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, CONFIG.GAME_W, CONFIG.GAME_H);

  // --- Soft vintage sun with a warm glow ---
  const sunX = CONFIG.GAME_W * 0.80, sunY = CONFIG.GAME_H * 0.20;
  const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 240);
  glow.addColorStop(0, 'rgba(255,246,214,0.95)');
  glow.addColorStop(0.25, 'rgba(255,236,178,0.45)');
  glow.addColorStop(1, 'rgba(255,236,178,0)');
  ctx.fillStyle = glow; ctx.fillRect(sunX - 240, sunY - 240, 480, 480);
  ctx.fillStyle = '#fff4d6'; ctx.beginPath(); ctx.arc(sunX, sunY, 28, 0, Math.PI * 2); ctx.fill();

  // --- Clouds, far hills, and the treeline on the horizon ---
  drawBackgroundScenery(ctx, camera);

  // --- Ground ---
  const groundScreenY = CONFIG.GROUND_Y - camera.y;
  ctx.fillStyle = C.ground; ctx.fillRect(0, groundScreenY, CONFIG.GAME_W, CONFIG.GAME_H);
  ctx.fillStyle = C.groundDark; ctx.fillRect(0, groundScreenY, CONFIG.GAME_W, 4);
  ctx.fillStyle = C.groundDark;
  for (let i = -1; i < CONFIG.GAME_W / 60 + 2; i++) {
    const stripeX = (i * 60 - (camera.x % 60));
    ctx.fillRect(stripeX, groundScreenY + 14, 30, 3);
  }
  drawGroundScenery(ctx);

  // --- Bullets, missiles, explosions ---
  for (const bullet of bullets) bullet.draw(ctx);
  for (const missile of missiles) missile.draw(ctx);
  for (const boom of explosions) boom.draw(ctx);

  // --- Other online players (with name tags) ---
  if (Net.inWorld) drawRemotePlayers();

  // --- Your plane (only once you're flying) ---
  if (gameStarted && (playerState === 'flying' || playerState === 'takeoff')) {
    player.draw(ctx);
    // mark yourself as a real human player 🧑
    const psx = worldToScreenX(player.x), psy = player.y - camera.y;
    ctx.textAlign = 'center'; ctx.font = '20px sans-serif';
    ctx.fillText('🧑', psx, psy - 34);
    ctx.textAlign = 'left';
  }

  // --- Arrows at the screen edge pointing at planes you can't see ---
  if (gameStarted) drawOffscreenIndicators();

  // --- Vintage sepia vignette: warm, darkened corners like an old photo ---
  const vg = ctx.createRadialGradient(
    CONFIG.GAME_W / 2, CONFIG.GAME_H / 2, CONFIG.GAME_H * 0.4,
    CONFIG.GAME_W / 2, CONFIG.GAME_H / 2, CONFIG.GAME_W * 0.72);
  vg.addColorStop(0, 'rgba(60,40,15,0)');
  vg.addColorStop(1, 'rgba(45,28,8,0.34)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, CONFIG.GAME_W, CONFIG.GAME_H);
}

// Draw the other online players from the interpolated snapshots, name-labeled.
function drawRemotePlayers() {
  for (const id in remotePlayers) {
    const r = remotePlayers[id];
    if (r.x === undefined || r.alive === false) continue;
    const sx = worldToScreenX(r.x), sy = r.y - camera.y;
    drawPlaneSprite(ctx, remoteSprite(parseInt(id, 10)), sx, sy, r.angle || 0, frameCount, false);
    ctx.textAlign = 'center';
    // name tag: bots all say "Bot", humans show their chosen name
    const label = remoteName(id);
    ctx.font = '11px monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillText(label, sx + 1, sy - 21);
    ctx.fillStyle = '#ffffff'; ctx.fillText(label, sx, sy - 22);
    // who is it? Server bots get ids >= 1,000,000; real players are small ids.
    ctx.font = '20px sans-serif';
    ctx.fillText(isBotId(id) ? '🤖' : '🧑', sx, sy - 34);
    ctx.textAlign = 'left';
  }
}

// The on-top info layer. We blow the WHOLE thing up by CONFIG.HUD_SCALE so the
// writing is easy to read. Each panel inside uses W/H (the screen size AFTER
// the zoom) to stay tucked into its corner instead of sliding off the edge.
function drawHudLayer() {
  const S = CONFIG.HUD_SCALE;
  ctx.save();
  ctx.scale(S, S);
  drawHud(); drawLeaderboard(); drawKillFeed(); drawMinimap();
  ctx.restore();
}

// The screen size as the HUD "sees" it once it's been zoomed by HUD_SCALE.
// (Drawing at x = HUD_W - 80 still lands 80 units in from the right edge.)
function hudW() { return CONFIG.GAME_W / CONFIG.HUD_SCALE; }
function hudH() { return CONFIG.GAME_H / CONFIG.HUD_SCALE; }

function drawHud() {
  const W = hudW(), H = hudH();
  // --- Your plane stats, tucked into the BOTTOM-LEFT corner. The camera keeps
  // your plane in the MIDDLE of the screen, so the corner is the one spot the
  // panel never covers your plane or the ground right under you. ---
  const pw = 196, ph = 64;
  const px0 = 12, py0 = H - ph - 12;
  const barX = px0 + 70, barW = pw - 70 - 10, barH = 9;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(px0, py0, pw, ph);
  ctx.font = '11px monospace'; ctx.textAlign = 'left';

  // THROTTLE bar (how much gas you're giving it).
  ctx.fillStyle = '#ffffff'; ctx.fillText('THROTTLE', px0 + 8, py0 + 18);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.strokeRect(barX, py0 + 10, barW, barH);
  ctx.fillStyle = '#f1c40f'; ctx.fillRect(barX + 1, py0 + 11, (barW - 2) * player.throttle, barH - 2);

  // HEALTH bar (turns yellow then red as you get hurt).
  ctx.fillStyle = '#ffffff'; ctx.fillText('HEALTH', px0 + 8, py0 + 36);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.strokeRect(barX, py0 + 28, barW, barH);
  const healthFrac = Math.max(0, player.health) / CONFIG.PLAYER_HEALTH;
  ctx.fillStyle = healthFrac > 0.5 ? '#2ecc71' : (healthFrac > 0.25 ? '#f39c12' : '#e74c3c');
  ctx.fillRect(barX + 1, py0 + 29, (barW - 2) * healthFrac, barH - 2);

  // MISSILES (one filled box per missile you're carrying; the next one fills
  // up slowly as it reloads).
  ctx.fillStyle = '#ffffff'; ctx.fillText('MISSILES', px0 + 8, py0 + 56);
  const pipPitch = barW / CONFIG.MISSILE_MAX, pipW = pipPitch - 4;
  for (let i = 0; i < CONFIG.MISSILE_MAX; i++) {
    const bx = barX + i * pipPitch, by = py0 + 47;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.strokeRect(bx, by, pipW, 10);
    if (i < player.missiles) { ctx.fillStyle = CONFIG.COLORS.missile; ctx.fillRect(bx + 1, by + 1, pipW - 2, 8); }
    else if (i === player.missiles) {
      const frac = player.missileTimer / (CONFIG.MISSILE_REFILL_SECONDS * 60);
      ctx.fillStyle = '#7f8c8d'; ctx.fillRect(bx + 1, by + 1, (pipW - 2) * frac, 8);
    }
  }

  // --- Your score, top-right under the leaderboard area ---
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(W - 80, 6, 74, 16);
  ctx.fillStyle = '#ffffff'; ctx.fillText('SCORE ' + (totalScore + score), W - 74, 17);

  // --- Altitude gauge on the right edge (top = ceiling, bottom = ground) ---
  const gx = W - 22, gy = 30, gh = 240;
  const top = CONFIG.CEILING, bot = CONFIG.GROUND_Y;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(gx - 2, gy - 2, 14, gh + 4);
  const aym = Math.max(gy, Math.min(gy + gh, gy + gh * (player.y - top) / (bot - top)));
  ctx.fillStyle = '#ffffff'; ctx.fillRect(gx - 3, aym - 1, 16, 2);
  ctx.font = '8px monospace'; ctx.textAlign = 'center'; ctx.fillText('ALT', gx + 5, gy - 5); ctx.textAlign = 'left';

  // --- Blinking STALL! warning when the wings lose lift ---
  if (playerState === 'flying' && player.stalling && (frameCount % 30 < 20)) {
    ctx.fillStyle = '#ff3b30'; ctx.font = '18px monospace'; ctx.textAlign = 'center';
    ctx.fillText('STALL!', W / 2, 44); ctx.textAlign = 'left'; ctx.font = '8px monospace';
  }

  // --- Big middle-of-screen message when you're shot down ---
  if (playerState === 'dead') {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff'; ctx.font = '22px monospace';
    ctx.fillText(deathMsg, W / 2, H / 2);
    ctx.font = '11px monospace';
    ctx.fillText('flying back in…', W / 2, H / 2 + 20);
    ctx.textAlign = 'left';
  }

  // --- Friendly controls reminder along the bottom ---
  // Set our OWN font here so the hint is always the same size. (Without this it
  // borrowed whatever font was used last -- tiny 8px normally, but 11px after
  // the death message ran, which is why it kept changing size.)
  ctx.font = '12px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.textAlign = 'center';
  ctx.fillText('Arrows / WASD: fly    Space: guns    X: missile', W / 2, H - 14);
  ctx.textAlign = 'left';
}

// The scoreboard on the right: who has the most kills (you + everyone online).
function drawLeaderboard() {
  const rows = [{ icon: '🧑', name: 'YOU', score: totalScore + score, you: true }];
  for (const id in remotePlayers) {
    rows.push({ icon: isBotId(id) ? '🤖' : '🧑', name: remoteName(id), score: remotePlayers[id].score || 0 });
  }
  rows.sort((a, b) => b.score - a.score);
  const top = rows.slice(0, 8);

  const w = 220, rh = 17, x = hudW() - w - 34, y = 28;
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x, y, w, 22 + top.length * rh);
  ctx.fillStyle = '#ffd23f'; ctx.font = '11px monospace'; ctx.textAlign = 'left';
  ctx.fillText('LEADERBOARD', x + 8, y + 15);
  top.forEach((e, i) => {
    const ty = y + 31 + i * rh;
    ctx.fillStyle = e.you ? '#7fbdef' : '#ffffff';
    ctx.textAlign = 'left'; ctx.fillText((i + 1) + '. ' + e.icon + ' ' + e.name, x + 8, ty);
    ctx.textAlign = 'right'; ctx.fillText('' + e.score, x + w - 8, ty);
  });
  ctx.textAlign = 'left';
}

// The "who shot down who" feed on the left (newest on top, fades away).
function drawKillFeed() {
  const x = 8, y = 100;
  ctx.font = '11px monospace'; ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillText('KILL FEED', x, y);
  killFeed.forEach((k, i) => {
    ctx.globalAlpha = Math.min(1, k.life / 60);
    ctx.fillStyle = k.color; ctx.fillText(k.text, x, y + 16 + i * 15);
  });
  ctx.globalAlpha = 1;
}

// A little map up top: side-to-side is where you are across the world, up-down
// is your height. Other planes are gold dots; you're the blue one.
function drawMinimap() {
  const mw = 240, mh = 120, mx = Math.round(hudW() * 0.5) - mw / 2, my = 12;
  const W = CONFIG.WORLD_WIDTH, top = CONFIG.CEILING, bot = CONFIG.GROUND_Y, H = bot - top, innerH = mh - 4;
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.strokeRect(mx + 0.5, my + 0.5, mw - 1, mh - 1);
  const mapX = (x) => mx + (wrapX(x) / W) * mw;
  const mapY = (y) => my + Math.max(0, Math.min(1, (y - top) / H)) * innerH;
  ctx.fillStyle = 'rgba(120,180,90,0.6)'; ctx.fillRect(mx + 1, my + mh - 4, mw - 2, 3); // ground strip
  for (const id in remotePlayers) {
    const r = remotePlayers[id];
    if (!r || r.alive === false || r.x === undefined) continue;
    ctx.fillStyle = '#e0a93a'; ctx.fillRect(mapX(r.x) - 3, mapY(r.y) - 3, 6, 6);
  }
  if (gameStarted && player.alive) { ctx.fillStyle = '#7fbdef'; ctx.fillRect(mapX(player.x) - 3, mapY(player.y) - 3, 6, 6); }
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '9px monospace'; ctx.textAlign = 'left'; ctx.fillText('MAP', mx + 4, my + 11);
}

// Little arrows at the screen edge pointing toward off-screen planes.
function drawOffscreenIndicators() {
  if (!CONFIG.SHOW_ENEMY_ARROWS) return;
  const cx = viewOriginX + viewWidth / 2, cy = CONFIG.GAME_H / 2;
  const margin = CONFIG.ARROW_MARGIN, size = CONFIG.ARROW_SIZE;
  for (const id in remotePlayers) {
    const t = remotePlayers[id];
    if (!t || t.alive === false || t.x === undefined) continue;
    const sx = worldToScreenX(t.x), sy = t.y - camera.y;
    if (sx >= 0 && sx <= CONFIG.GAME_W && sy >= 0 && sy <= CONFIG.GAME_H) continue; // visible
    const angle = Math.atan2(sy - cy, sx - cx);
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const halfW = viewWidth / 2 - margin, halfH = cy - margin;
    const dist = (Math.abs(dx) * halfH > Math.abs(dy) * halfW) ? halfW / Math.abs(dx) : halfH / Math.abs(dy);
    ctx.save(); ctx.translate(cx + dx * dist, cy + dy * dist); ctx.rotate(angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(size, 0); ctx.lineTo(-size, -size); ctx.lineTo(-size, size); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

// A dark dim while paused. The PAUSED title + buttons live in the #pauseMenu
// HTML overlay (so they're clickable), drawn on top of the canvas.
function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, CONFIG.GAME_W, CONFIG.GAME_H);
}

// ===========================================================================
//  THE MAIN LOOP
// ===========================================================================
function loop() {
  if (!paused) { frameCount += 1; update(); }
  draw();
  if (paused) drawPauseOverlay();
  requestAnimationFrame(loop);
}
loop(); // start!
