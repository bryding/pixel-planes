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

// Player 2, only used in split-screen mode. Flies with WASD (Q gun / E missile),
// is RED, and is on a different team so the two players can shoot each other.
const player2 = new Plane(100, 120);
player2.keymap = 'p2';
player2.team = 2;
let splitScreen = false;      // is two-player split-screen turned on?
let duelScoreBlue = 0;        // player 1 (blue) kills
let duelScoreRed = 0;         // player 2 (red) kills
let p2MissileWasDown = false; // edge-detect player 2's missile key
let p2EjectWasDown = false;   // edge-detect player 2's eject key

// The camera's x keeps counting up/down smoothly (it never jumps), even as the
// world loops -- that keeps the background from popping at the seam.
const camera = { x: 0, y: 0 };  // the ACTIVE render camera (set per view)
const cam1 = { x: 0, y: 0 };    // split-screen: player 1's camera (right half)
const cam2 = { x: 0, y: 0 };    // split-screen: player 2's camera (left half)

// The current viewport we're drawing into. For a single full-screen view this
// is the whole canvas; in split-screen each half sets these while it draws.
let viewOriginX = 0;
let viewWidth = CONFIG.GAME_W;
let viewFocus = player;         // whose view this is (so arrows skip yourself)

// Turn a world x into a screen x, picking the copy of it (the world loops)
// that is closest to the middle of the CURRENT viewport.
function worldToScreenX(wx) {
  const W = CONFIG.WORLD_WIDTH;
  const center = camera.x + viewWidth / 2;
  const copy = wx + Math.round((center - wx) / W) * W;
  return (copy - camera.x) + viewOriginX;
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
  if (splitScreen) e.team = 1; // duel bots are all one GREEN team (vs both players)
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
  // Online: if I'm the HOST, switch everyone in my server to this mode too.
  if (typeof Net !== 'undefined' && Net.inServer && Net.isHost) Net.setMode(m);
  // "No Mod Mode" hides the whole Modifier Menu and turns the cheats off.
  const modGroup = document.getElementById('modGroup');
  if (modGroup) modGroup.style.display = (m === 'nomod') ? 'none' : 'flex';
  if (m === 'nomod') {
    timeScale = 1;
    infiniteHealth = false;
    infiniteMissiles = false;
  }
  if (m === 'ww2') assignWW2Factions();

  // In split-screen, switching modes keeps BOTH players in the duel: set up the
  // new mode for two players instead of running the single-player spawn logic.
  if (splitScreen) {
    if (m === 'alien') { startAlien(); }      // alien is split-aware (uses alienPlanes)
    else {
      player.isUfo = false; player2.isUfo = false;
      startDuel();                            // fresh duel positions for the new mode
    }
    return;
  }

  if (m === 'alien') startAlien();
  if (m === 'blackhole') startBlackHole();
  // Leaving a space mini-game -> put a normal flying plane back.
  if ((prev === 'alien' || prev === 'blackhole') && m !== 'alien' && m !== 'blackhole') spawnPlane(100);
  // In an online server, a guest must not regain the Mode/Modifier menus.
  if (typeof applyHostPermissions === 'function') applyHostPermissions();
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
  // A shielded/invincible player is never picked. In split-screen BOTH players
  // can be struck.
  const humans = splitScreen ? [player, player2] : [player];
  for (const pl of humans) {
    const airborne = splitScreen ? pl.alive : (playerState === 'flying');
    if (airborne && pl.y > safeTop && pl.invincibleTimer <= 0) cands.push(pl);
  }
  for (const e of enemies) if (e.alive && e.y > safeTop) cands.push(e);
  if (!cands.length) return;

  let total = 0;
  const weights = cands.map(p => { const w = Math.max(20, CONFIG.GROUND_Y - p.y); total += w; return w; });
  let r = Math.random() * total, pick = cands[cands.length - 1];
  for (let i = 0; i < cands.length; i++) { r -= weights[i]; if (r <= 0) { pick = cands[i]; break; } }

  lightnings.push({ x: pick.x, y: pick.y, life: 14 });
  lightningFlash = 8;
  bigExplosion(pick.x, pick.y);
  if (splitScreen && (pick === player || pick === player2)) {
    pushKill('⚡ ' + ((pick === player) ? 'BLUE' : 'RED') + ' struck by lightning', '#ffe066');
    duelDown(pick);
  } else if (pick === player) {
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
let gameStarted = false; // false = on the title/start screen (attract mode)

// --- Title / Start screen ---
// START begins play; SETTINGS opens the look-picker. The canvas behind shows
// live AI dogfights the whole time. Dying never comes back here.
function startGame() {
  if (typeof Sound !== 'undefined') {
    Sound.init();             // a click -> sound is now allowed
    Sound.stopTheme();        // the title theme + plane engine stop once you play
    Sound.stopEngine();
  }
  gameStarted = true;
  const ss = document.getElementById('startScreen'); if (ss) ss.style.display = 'none';
  const se = document.getElementById('settingsScreen'); if (se) se.style.display = 'none';
  const tb = document.getElementById('topBar'); if (tb) tb.style.display = 'flex';
  spawnPlane(camera.x + CONFIG.GAME_W / 2);   // fly the player in where the camera is
}
// Go back to the title screen (from the ESC menu).
function returnToMainMenu() {
  paused = false;
  updatePauseMenu();              // close the pause menu
  splitScreen = false;            // title is single-player attract mode
  gameStarted = false;
  player.alive = false;           // no player on the title (just AI dogfights)
  frameCount = 0;                 // replay the banner fly-in
  const ss = document.getElementById('startScreen'); if (ss) ss.style.display = 'flex';
  const se = document.getElementById('settingsScreen'); if (se) se.style.display = 'none';
  const tb = document.getElementById('topBar'); if (tb) tb.style.display = 'none';
  if (typeof Sound !== 'undefined') { Sound.startTheme(); Sound.startEngine(); }  // title music + engine
}

// The "Click to Play" gate: nothing shows until you click. Clicking hides the
// gate, turns on sound, and starts the title (music, engine, banner fly-in).
function enterTitle() {
  const gate = document.getElementById('clickGate'); if (gate) gate.style.display = 'none';
  if (typeof Sound !== 'undefined') {
    Sound.init();
    if (!gameStarted) { Sound.startTheme(); Sound.startEngine(); }
  }
  frameCount = 0;   // start the banner fly-in now, in sync with the sound
}

// Browsers block sound until you interact. On the FIRST click/key/tap, start the
// title music + plane engine (and replay the fly-in so it's in sync with sound).
function armTitleAudio() {
  if (typeof Sound === 'undefined') return;
  Sound.init();
  if (!gameStarted && !Sound._themeOn) {
    Sound.startTheme();
    Sound.startEngine();
    frameCount = 0;
  }
}
['pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
  window.addEventListener(ev, armTitleAudio, { passive: true }));
function openSettings() {
  const ss = document.getElementById('startScreen'); if (ss) ss.style.display = 'none';
  const se = document.getElementById('settingsScreen'); if (se) se.style.display = 'flex';
  // Show the current volume on the slider.
  const sl = document.getElementById('volSlider'), lb = document.getElementById('volLabel');
  if (sl) sl.value = Math.round(Sound.volume * 100);
  if (lb) lb.textContent = Math.round(Sound.volume * 100) + '%';
}
// Move the Settings volume slider.
function setVolumePct(pct) {
  if (typeof Sound === 'undefined') return;
  Sound.init();                 // a slider drag is a click -> sound allowed
  Sound.setVolume(pct / 100);
  const lb = document.getElementById('volLabel'); if (lb) lb.textContent = Math.round(pct) + '%';
  Sound.gun();                  // quick click so you HEAR the level as you set it
}
function closeSettings() {
  const se = document.getElementById('settingsScreen'); if (se) se.style.display = 'none';
  const ss = document.getElementById('startScreen'); if (ss) ss.style.display = 'flex';
}

// --- Plane color customizer (ESC menu) ---
// Your chosen plane color builds a sprite set used in the normal modes.
let playerSpriteSet = PLANE_SPRITES.player;
function getPlayerColor() {
  try { return localStorage.getItem('pp_playercolor') || ''; } catch (e) { return ''; }
}
function setPlayerColor(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
  playerSpriteSet = makePlaneSetFromColor(hex);
  try { localStorage.setItem('pp_playercolor', hex); } catch (e) {}
  const w = document.getElementById('colorWheel'); if (w) w.value = hex;
}
function showColorPanel() {
  showPausePanel('colorPanel');
  const saved = getPlayerColor();
  const w = document.getElementById('colorWheel'); if (w && saved) w.value = saved;
}

// Pause/unpause and show/hide the pause menu. Used by the ESC key AND by the
// on-screen "ESC" button (so phones, with no keyboard, can open the menu too).
function pauseToggle() { if (!gameStarted) return; paused = !paused; updatePauseMenu(); }
window.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && !e.repeat) pauseToggle();
});
// Show or hide the HTML pause menu to match the paused flag. Always reopen on
// the MAIN screen (not a leftover Create/Join sub-panel).
function updatePauseMenu() {
  const m = document.getElementById('pauseMenu');
  if (m) m.style.display = paused ? 'flex' : 'none';
  if (paused) backToPause();
}
// Pause-menu buttons.
function resumeGame()  { paused = false; updatePauseMenu(); }
function chooseNormal() { setSplitScreen(false); paused = false; updatePauseMenu(); }
function chooseSplit()  { setSplitScreen(true);  paused = false; updatePauseMenu(); }

// Open the ONLINE multiplayer game in a NEW TAB. This is YOUR labeled version
// (bot/human nametags + auto-lock missiles) that connects to the SAME shared
// server — so you're in the same world as your friends, just with the labels.
function goMultiplayer() {
  window.open('online/', '_blank', 'noopener');
}

// ===========================================================================
//  ONLINE SERVER LOBBY (Create Server / Server List / join+password).
//  Talks to the server through Net (js/net.js).
// ===========================================================================

// Your display name (so other players know who you are). Saved between visits.
function getUsername() {
  try { return localStorage.getItem('pp_username') || ''; } catch (e) { return ''; }
}
function saveUsername(name) {
  try { localStorage.setItem('pp_username', name); } catch (e) {}
}

// The server address to use:
//  1. an address you typed in the lobby (saved) always wins, else
//  2. if the game is being served by our own server (i.e. you opened it over
//     http, not the public https link), talk to that SAME computer/port -- so
//     local + same-WiFi play "just works" with nothing to type, else
//  3. the public deployed server in config.js (for the https github.io link).
function serverUrl() {
  // LOCAL play: if the game was opened from our own server (any http address
  // like http://localhost:8080 or http://192.168.x.x:8080), ALWAYS talk to that
  // same computer. This is always correct and ignores any stale typed-in
  // address, so same-WiFi play can't get pointed at the wrong place.
  if (typeof location !== 'undefined' && location.host && location.protocol !== 'https:') {
    return 'ws://' + location.host;
  }
  // PUBLIC https link: a saved address (typed in the lobby) wins, else the
  // configured deployed server.
  try { const saved = localStorage.getItem('pp_serverurl'); if (saved) return saved; } catch (e) {}
  return CONFIG.SERVER_URL;
}
// Type a new address and connect to it (so connection issues can be fixed
// without editing files). Accepts "host:port" and adds ws:// for you.
function applyServerUrl(inputId) {
  const el = document.getElementById(inputId);
  let url = ((el && el.value) || '').trim();
  if (url && !/^wss?:\/\//i.test(url)) url = 'ws://' + url;
  try { if (url) localStorage.setItem('pp_serverurl', url); } catch (e) {}
  Net.disconnect();
  Net.connect(serverUrl());
  refreshLobbyUI();
}

// Make sure we're connected to the online server (lazy: only when you open a
// server panel, so single-player never waits on the network).
function ensureConnected() { Net.connect(serverUrl()); }

// Switch which pause panel is showing.
function showPausePanel(id) {
  ['pauseMain', 'createServer', 'serverList', 'inServer', 'colorPanel'].forEach(p => {
    const el = document.getElementById(p);
    if (el) el.style.display = (p === id) ? 'flex' : 'none';
  });
}
function backToPause() { showPausePanel(Net.inServer ? 'inServer' : 'pauseMain'); }

function showCreateServer() {
  ensureConnected();
  showPausePanel('createServer');
  const n = document.getElementById('csName'); if (n) n.value = getUsername();
  const s = document.getElementById('csServer'); if (s) s.value = '';
  const p = document.getElementById('csPass'); if (p) p.value = '';
  const m = document.getElementById('csMsg'); if (m) m.textContent = '';
  refreshLobbyUI();
  if (n && !n.value) n.focus(); else if (s) s.focus();
}
function showServerList() {
  ensureConnected();
  Net.refreshList();
  showPausePanel('serverList');
  const n = document.getElementById('slName'); if (n) n.value = getUsername();
  const m = document.getElementById('slMsg'); if (m) m.textContent = '';
  refreshLobbyUI();
}

// Create a server: name = letters+numbers only; password optional. The creator
// becomes the HOST (the only one who gets the Mode/Modifier menus).
function doCreateServer() {
  const msg = document.getElementById('csMsg');
  const name = (document.getElementById('csName').value || '').trim();
  const server = (document.getElementById('csServer').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const pass = (document.getElementById('csPass').value || '');
  if (!name) { setMsg(msg, '#ffd24a', 'Please type your name first.'); return; }
  if (!server) { setMsg(msg, '#ffd24a', 'Please type a server name (letters & numbers).'); return; }
  if (Net.status !== 'online') { setMsg(msg, '#ff6b6b', 'Not connected to the server yet…'); return; }
  saveUsername(name);
  Net.setName(name);
  Net.createServer(server, pass);
  setMsg(msg, '#9be7ff', 'Creating "' + server + '"…');
}

// Join a server by name (used by the Join buttons in the list). Asks for a
// password first if the server is locked.
function joinServerByName(name, hasPassword) {
  const who = (document.getElementById('slName').value || '').trim();
  const msg = document.getElementById('slMsg');
  if (!who) { setMsg(msg, '#ffd24a', 'Please type your name first.'); return; }
  if (Net.status !== 'online') { setMsg(msg, '#ff6b6b', 'Not connected to the server yet…'); return; }
  saveUsername(who);
  Net.setName(who);
  let pass = '';
  if (hasPassword) {
    pass = window.prompt('Password for "' + name + '":', '');
    if (pass === null) return;            // cancelled
  }
  Net.joinServer(name, pass);
  setMsg(msg, '#9be7ff', 'Joining "' + name + '"…');
}

function doLeaveServer() {
  Net.leaveServer();
  applyHostPermissions();
  showPausePanel('pauseMain');
}

function setMsg(el, color, text) { if (el) { el.style.color = color; el.textContent = text; } }

// Redraw the live lobby (status text + the server list rows). Called by Net
// whenever anything changes (connection, list update, joined, denied…).
function refreshLobbyUI() {
  const statusTxt = Net.status === 'online' ? '🟢 Connected' :
                    Net.status === 'connecting' ? '🟡 Connecting…' :
                    ('🔴 Offline' + (Net.lastError ? ' — ' + Net.lastError : ''));
  const sc = document.getElementById('netStatusCreate'); if (sc) sc.textContent = statusTxt;
  const sl = document.getElementById('netStatusList');
  if (sl) sl.textContent = (Net.status === 'online') ? ('🟢 Connected — ' + Net.servers.length + ' server(s)') : statusTxt;

  // Pre-fill the server-address boxes with the current address.
  const cu = document.getElementById('csUrl'); if (cu && !cu.value) cu.value = serverUrl();
  const lu = document.getElementById('slUrl'); if (lu && !lu.value) lu.value = serverUrl();

  // The list of joinable servers.
  const box = document.getElementById('serverListItems');
  if (box) {
    box.innerHTML = '';
    if (!Net.servers.length) {
      const e = document.createElement('div');
      e.className = 'serverEmpty';
      e.textContent = (Net.status === 'online') ? 'No servers yet — create one!' : 'Connecting…';
      box.appendChild(e);
    }
    Net.servers.forEach(s => {
      const row = document.createElement('div');
      row.className = 'serverRow';
      const info = document.createElement('div');
      info.innerHTML = '<div class="srvName">' + (s.hasPassword ? '🔒 ' : '') + escapeHtml(s.name) +
                       '</div><div class="srvMeta">' + s.players + ' player' + (s.players === 1 ? '' : 's') + '</div>';
      const btn = document.createElement('button');
      btn.textContent = 'Join';
      btn.onclick = () => { joinServerByName(s.name, s.hasPassword); };
      row.appendChild(info); row.appendChild(btn);
      box.appendChild(row);
    });
  }

  // Error/denied messages (wrong password, taken name, etc.).
  if (Net.lastError) {
    setMsg(document.getElementById('csMsg'), '#ff6b6b', '❌ ' + Net.lastError);
    setMsg(document.getElementById('slMsg'), '#ff6b6b', '❌ ' + Net.lastError);
  }

  // If we just joined a server, jump to the in-server panel.
  if (Net.inServer && paused) {
    const t = document.getElementById('inServerTitle');
    if (t) t.textContent = '🌐 ' + Net.serverName;
    const i = document.getElementById('inServerInfo');
    if (i) i.textContent = (Net.isHost ? 'You are the HOST — you control the Mode & Modifier menus.'
                                       : 'You joined as ' + (Net.username || 'a player') + '. The host controls the menus.');
    updateInvite();
    const showing = document.getElementById('createServer').style.display !== 'none' ||
                    document.getElementById('serverList').style.display !== 'none';
    if (showing) showPausePanel('inServer');
  }
  applyHostPermissions();
}

// Show how friends on the same WiFi can join: the address + a scannable QR.
let _inviteUrl = null;
function updateInvite() {
  const info = document.getElementById('inServerInvite');
  const qr = document.getElementById('inviteQR');
  if (!info) return;
  const show = (url) => {
    info.innerHTML = 'Friends on your WiFi: open <b>' + url + '</b>&nbsp; or scan ⤵';
    if (qr) {
      qr.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(url);
      qr.style.display = 'inline-block';
    }
  };
  if (_inviteUrl) { show(_inviteUrl); return; }
  // Ask our own server for its WiFi address (only works during local play).
  try {
    fetch('/ip').then((r) => r.json()).then((d) => {
      if (d && d.ip) { _inviteUrl = 'http://' + d.ip + ':' + d.port; show(_inviteUrl); }
      else { info.textContent = ''; if (qr) qr.style.display = 'none'; }
    }).catch(() => { info.textContent = ''; if (qr) qr.style.display = 'none'; });
  } catch (e) {}
}
function escapeHtml(s) { return ('' + s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// In an online server, ONLY the host gets the Mode & Modifier menus.
function applyHostPermissions() {
  const lockedAway = Net.inServer && !Net.isHost;   // a guest in someone's server
  const modGroup = document.getElementById('modGroup');
  const modeGroup = document.getElementById('modeGroup');
  if (modGroup && mode !== 'nomod') modGroup.style.display = lockedAway ? 'none' : 'flex';
  if (modeGroup) modeGroup.style.display = lockedAway ? 'none' : 'flex';
}

// The host changed the mode -> everyone in the server follows.
function onNetMode(m) {
  if (typeof m === 'string' && m !== mode) setMode(m);
}

// ---- Quick Play: on local (WiFi) play, auto-join ONE shared room so opening
// the address on any device drops you straight into the game together. ----
let quickJoinSent = false;
function autoQuickPlay() {
  if (typeof location === 'undefined' || !location.host) return; // file:// -> skip
  if (location.protocol === 'https:') return;                    // public link uses the lobby
  let name = getUsername();
  if (!name) { name = 'Pilot' + (1000 + Math.floor(Math.random() * 9000)); saveUsername(name); }
  Net.username = name;
  Net._quickRoom = 'HOME';
  ensureConnected();
}
function maybeQuickJoin() {
  if (!Net._quickRoom || Net.inServer || quickJoinSent) return;
  if (Net.status === 'online') { quickJoinSent = true; Net.quickJoin(Net._quickRoom); }
}

// Hook Net's updates to the UI (+ auto quick-join when connected).
Net.onChange = function () {
  if (Net.status !== 'online') quickJoinSent = false;  // re-join after a reconnect
  refreshLobbyUI();
  maybeQuickJoin();
};
// autoQuickPlay();   // ONLINE PAUSED: not auto-connecting for now (refine later)

// ===========================================================================
//  ONLINE LIVE SYNC — see the other players fly on their own devices.
//  Each client sends its plane a few times a second; everyone draws the others.
// ===========================================================================
const remotePlayers = {};       // id -> {x,y,tx,ty,angle,throttle,health,isUfo,name,last}
let netStateTimer = 0;
const REMOTE_COLORS = ['#e0524a', '#3fae54', '#e0a93a', '#9b59b6', '#e84393', '#1abc9c', '#ff7f50'];
const _remoteSprites = {};
function remoteSprite(id) {
  const c = REMOTE_COLORS[((id % REMOTE_COLORS.length) + REMOTE_COLORS.length) % REMOTE_COLORS.length];
  if (!_remoteSprites[c]) _remoteSprites[c] = makePlaneSetFromColor(c);
  return _remoteSprites[c];
}
// Just joined an online server: drop bots (online = just the humans) and clear
// any leftover remote players.
function onNetJoined() {
  removeAllBots();
  for (const k in remotePlayers) delete remotePlayers[k];
  if (playerState === 'dead' || playerState === 'chute') spawnPlane(camera.x + CONFIG.GAME_W / 2);
}
// Got another player's plane from the server.
function onNetState(id, name, s) {
  if (!s) return;
  let r = remotePlayers[id];
  if (!r) r = remotePlayers[id] = { x: s.x, y: s.y, angle: s.angle || 0 };
  r.name = name; r.tx = s.x; r.ty = s.y; r.angle = s.angle || 0;
  r.throttle = s.throttle; r.health = s.health; r.isUfo = s.isUfo; r.dead = s.dead;
  r.last = frameCount;
}
function onNetLeft(id) { delete remotePlayers[id]; }

// Run online each frame: send my plane, smooth the others, forget silent ones.
function netSyncStep() {
  netStateTimer += 1;
  if (netStateTimer >= 2 && (playerState === 'flying' || playerState === 'takeoff')) {
    netStateTimer = 0;
    Net.sendState({ x: player.x, y: player.y, angle: player.angle, throttle: player.throttle,
                    health: player.health, isUfo: player.isUfo });
  }
  for (const id in remotePlayers) {
    const r = remotePlayers[id];
    if (r.tx !== undefined) { r.x = wrapX(r.x + wrapDX(r.tx - r.x) * 0.35); r.y += (r.ty - r.y) * 0.35; }
    if (frameCount - (r.last || 0) > 300) delete remotePlayers[id]; // stopped sending -> gone
  }
}

// Draw the other online players (with name tags). Called from drawWorldContents.
function drawRemotePlayers() {
  for (const id in remotePlayers) {
    const r = remotePlayers[id];
    if (r.x === undefined) continue;
    const sx = worldToScreenX(r.x), sy = r.y - camera.y;
    if (mode === 'alien' && r.isUfo) drawUfoCraft(ctx, sx, sy, frameCount, false);
    else drawPlaneSprite(ctx, remoteSprite(parseInt(id, 10)), sx, sy, r.angle || 0, frameCount, false);
    ctx.font = '11px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillText(r.name || 'player', sx + 1, sy - 21);
    ctx.fillStyle = '#ffffff'; ctx.fillText(r.name || 'player', sx, sy - 22);
    ctx.textAlign = 'left';
  }
}

// ---- Mobile touch controls ----
// On-screen buttons drive the SAME Input flags the keyboard does, so all the
// flight, guns and missile mechanics work exactly the same -- just by touch.
let mobileMode = false;
function toggleMobile() {
  mobileMode = !mobileMode;
  const mc = document.getElementById('mobileControls');
  if (mc) mc.style.display = mobileMode ? 'block' : 'none';
  const btn = document.getElementById('mobileBtn');
  if (btn) btn.textContent = '📱 Mobile: ' + (mobileMode ? 'ON' : 'OFF');
  _ufoPadShown = null;        // re-evaluate which control layout to show
  updateMobileLayout();
}
function setupMobileControls() {
  // Helper: a button that holds an action while pressed (turn / guns / UFO arrows).
  const hold = (id, on, off) => {
    const el = document.getElementById(id);
    if (!el) return;
    const press = (e) => {
      if (e.preventDefault) e.preventDefault();
      // CAPTURE the finger so sliding it a little doesn't "let go" of the
      // button -- this is what made the up/down arrows feel broken on touch.
      if (e.pointerId !== undefined && el.setPointerCapture) {
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
      }
      on();
    };
    const release = (e) => { if (e && e.preventDefault) e.preventDefault(); off(); };
    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    // NOTE: no 'pointerleave' release -- with capture the finger can drift while held.
    // Touch fallbacks, in case a phone's pointer events misbehave.
    el.addEventListener('touchstart', press, { passive: false });
    el.addEventListener('touchend', release);
    el.addEventListener('touchcancel', release);
  };
  hold('mcLeft',   () => Input.left = true,   () => Input.left = false);   // turn left  (like A / ←)
  hold('mcRight',  () => Input.right = true,  () => Input.right = false);  // turn right (like D / →)
  hold('mcGun',    () => Input.fire = true,   () => Input.fire = false);   // hold to shoot
  hold('mcMissile',() => Input.missile = true,() => Input.missile = false);// tap to launch a missile
  hold('mcEject',  () => Input.eject = true,  () => Input.eject = false);  // eject / toggle parachute

  // UFO 4-way pad (Alien Invasion): straight up/down/left/right movement.
  hold('mcUp',     () => Input.up = true,     () => Input.up = false);
  hold('mcDown',   () => Input.down = true,   () => Input.down = false);
  hold('mcLeftU',  () => Input.left = true,   () => Input.left = false);
  hold('mcRightU', () => Input.right = true,  () => Input.right = false);

  // Throttle slider: drag right for more power, left for less.
  const slider = document.getElementById('mcThrottle');
  if (slider) slider.addEventListener('input', () => { player.throttle = slider.value / 100; });
}
setupMobileControls();

// Swap the mobile control layout: when YOU are the UFO in Alien Invasion, show
// the 4-way pad and hide the turn/throttle/gun controls; otherwise the normal
// flying controls. Runs each frame but only touches the DOM when it changes.
let _ufoPadShown = null;
function updateMobileLayout() {
  if (!mobileMode) return;
  const wantUfoPad = (mode === 'alien' && !splitScreen && player.isUfo);
  if (wantUfoPad === _ufoPadShown) return;     // no change -> nothing to do
  _ufoPadShown = wantUfoPad;
  const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
  show('mcUfoPad', wantUfoPad);
  show('mcTurn', !wantUfoPad);
  show('mcThrottleWrap', !wantUfoPad);
  show('mcActions', !wantUfoPad);
  show('mcEject', !wantUfoPad);   // the eject button (hidden when you're a UFO)
  // Clear any held directions so a key can't get stuck across the swap.
  Input.up = Input.down = Input.left = Input.right = false;
}
// Phones/tablets: turn the touch controls on automatically (still toggleable).
if (typeof navigator !== 'undefined' && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window)) {
  toggleMobile();
}

// Turn split-screen 2-player ON or OFF.
function setSplitScreen(on) {
  if (on === splitScreen) return;
  splitScreen = on;
  if (on) {
    removeAllBots();          // no bots in a duel unless you add them
    duelScoreBlue = 0; duelScoreRed = 0;
    if (!planes.includes(player2)) planes.splice(1, 0, player2); // bots can target P2
    if (mode === 'alien') startAlien(); else startDuel();
    // Make sure both cameras start on their player.
    cam1.x = player.x  - CONFIG.GAME_W / 4; cam1.y = player.y  - CONFIG.GAME_H / 2;
    cam2.x = player2.x - CONFIG.GAME_W / 4; cam2.y = player2.y - CONFIG.GAME_H / 2;
  } else {
    const idx = planes.indexOf(player2);
    if (idx >= 0) planes.splice(idx, 1);
    player.isUfo = false;
    // Restart single-player for whatever mode is active.
    if (mode === 'alien') startAlien();
    else if (mode === 'blackhole') startBlackHole();
    else spawnPlane(100);
  }
}

// Put both players in the air on opposite sides, ready to dogfight.
function startDuel() {
  resetDuelPlane(player,  BARN_X + 900, 1);   // blue, faces right
  resetDuelPlane(player2, BARN_X - 900, -1);  // red, faces left
  cam1.x = player.x  - CONFIG.GAME_W / 4; cam1.y = player.y  - CONFIG.GAME_H / 2;
  cam2.x = player2.x - CONFIG.GAME_W / 4; cam2.y = player2.y - CONFIG.GAME_H / 2;
  playerState = 'flying';
}
function resetDuelPlane(p, x, dir) {
  p.alive = true; p.health = CONFIG.PLAYER_HEALTH;
  p.x = wrapX(x); p.y = CONFIG.GROUND_Y - 700;
  p.vx = 3 * dir; p.vy = 0; p.angle = (dir > 0) ? 0 : Math.PI;
  p.throttle = 0.75; p.flash = 0;
  p.missiles = CONFIG.MISSILE_MAX; p.missileTimer = 0;
  p.invincibleTimer = 0; p.wideTimer = 0; p.frozenTimer = 0;
  p.deadTimer = 0; p.stalling = false; p.hitGround = false;
}

// One split-screen player: fly, shoot, eject, crash, and respawn when downed.
function updateDuelPlayer(p, missileEdge, fireHeld, ejectEdge) {
  if (!p.alive) {
    p.deadTimer -= 1;
    if (p.deadTimer <= 0) resetDuelPlane(p, wrapX(p.x), (p === player) ? 1 : -1);
    return;
  }

  // ALIEN INVASION (tag): no guns/missiles/eject/crashing. The UFO flies with
  // straight arrow/WASD movement; runners fly like planes. Tagging is handled
  // by alienTagStep(); the black-hole pull etc. don't apply here.
  if (mode === 'alien') {
    if (p.isUfo) ufoDirectMove(p);
    else p.update();
    return;
  }

  p.update();

  // Hard ground impact = crash -- EXCEPT in Black Hole (no ground there).
  const canCrash = (mode !== 'blackhole');
  const hard = canCrash && p.invincibleTimer <= 0 && p.hitGround &&
    (p.impactVy >= CONFIG.LAND_MAX_VY || Math.abs(angleDiff(p.angle, 0)) >= CONFIG.LAND_MAX_ANGLE);
  if (hard) {
    bigExplosion(p.x, p.y);
    const who = (p === player) ? 'BLUE' : 'RED';
    pushKill('🛩️ ' + who + ' crashed 💥', (p === player) ? '#7fbdef' : '#e0524a');
    duelDown(p);
    return;
  }

  // Weapons & eject. WW2 has NO missiles and NO ejecting (same as single-player).
  if (p.frozenTimer <= 0) {
    if (ejectEdge && mode !== 'ww2') { duelEject(p); return; }
    if (fireHeld) p.tryShoot(bullets);
    if (missileEdge && mode !== 'ww2') p.fireMissile(missiles, planes);
  }
}
// Eject in a duel: the plane is destroyed, a parachute floats down, you respawn.
function duelEject(p) {
  const who = (p === player) ? 'BLUE' : 'RED';
  const col = (p === player) ? '#7fbdef' : '#e0524a';
  // Bad Weather: bailing out gets you struck by lightning instantly!
  if (mode === 'badweather' && p.invincibleTimer <= 0) {
    lightnings.push({ x: p.x, y: p.y, life: 14 });
    lightningFlash = 8;
    bigExplosion(p.x, p.y);
    pushKill('⚡ ' + who + ' ejected into the storm', '#ffe066');
    duelDown(p);
    return;
  }
  bigExplosion(p.x, p.y);
  spawnBotChute(p.x, p.y, col);              // a little parachute in your color
  pushKill('🪂 ' + who + ' ejected', col);
  duelDown(p);
}
// Mark a split-screen player as shot down and start its respawn countdown.
// (The explosion + kill-feed message are handled by whoever downed it.)
function duelDown(p) {
  p.alive = false;
  p.deadTimer = CONFIG.PLAYER_RESPAWN;
}
// Slide a camera smoothly toward its player (vw = the viewport width it fills).
function followCam(cam, focus, vw) {
  const tx = focus.x - vw / 2 + (focus.vx || 0) * CONFIG.CAM_LOOKAHEAD * 0.1;
  const ty = focus.y - CONFIG.GAME_H / 2;
  cam.x += wrapDX(tx - cam.x) * CONFIG.CAM_SMOOTH;
  cam.y += (ty - cam.y) * CONFIG.CAM_SMOOTH;
  const maxCamY = CONFIG.GROUND_Y - CONFIG.GAME_H + 140;
  if (cam.y > maxCamY) cam.y = maxCamY;
}
let deathMsg = 'SHOT DOWN!'; // what the middle-of-screen death message says

// The "who killed who" kill feed (newest first). Each entry fades out.
const killFeed = [];
function pushKill(text, color) {
  killFeed.unshift({ text: text, color: color, life: 360 });
  if (killFeed.length > 7) killFeed.pop();
}

// Start the game sitting on the ground, ready to take off.
spawnPlane(100);

// On load we're on the TITLE SCREEN: hide the top bar and park the player so
// the background is pure AI dogfights until the user presses START.
(function initTitleScreen() {
  const tb = document.getElementById('topBar'); if (tb) tb.style.display = 'none';
  player.alive = false;   // not playing yet (bots ignore it; it isn't drawn)
  const c = getPlayerColor(); if (c) setPlayerColor(c);   // restore chosen plane color
})();

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

  // --- Split-screen duel scoring (BLUE = P1 team 0, RED = P2 team 2, bots green) ---
  if (splitScreen) {
    const killer = (shooterTeam === 0) ? 'BLUE' : (shooterTeam === 2) ? 'RED' : 'GREEN';
    if (shooterTeam === 0) duelScoreBlue += 1;
    else if (shooterTeam === 2) duelScoreRed += 1;
    const victim = (target === player) ? 'BLUE' : (target === player2) ? 'RED' : (target.name || 'GREEN');
    if (target === player || target === player2) duelDown(target); // shot down -> respawn
    const col = (killer === 'BLUE') ? '#7fbdef' : (killer === 'RED') ? '#e0524a' : '#3fae54';
    pushKill(killer + '  ›❌  ' + victim, col);
    return;
  }

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
  const p2MissilePressed = Input.missile2 && !p2MissileWasDown;
  p2MissileWasDown = Input.missile2;
  const p2EjectPressed = Input.eject2 && !p2EjectWasDown;
  p2EjectWasDown = Input.eject2;

  // Only run the player once the game has STARTED. On the title screen we skip
  // it so the background is pure AI dogfights.
  if (gameStarted) {
  // --- Split-screen: just fly both players (no takeoff lifecycle) ---
  if (splitScreen) {
    updateDuelPlayer(player,  missilePressed,   Input.fire,  ejectPressed);
    updateDuelPlayer(player2, p2MissilePressed, Input.fire2, p2EjectPressed);
  } else {
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
    ufoDirectMove(player);
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
      if (mode !== 'ww2') {
        if (infiniteMissiles && Input.missile) {
          // ∞ Missiles cheat: HOLD X to rapid-fire a swarm (~300/sec)!
          for (let i = 0; i < CONFIG.INF_MISSILE_RATE && missiles.length < CONFIG.INF_MISSILE_CAP; i++)
            player.fireMissile(missiles, planes, true);
        } else if (missilePressed) {
          player.fireMissile(missiles, planes);   // normal: one per press, ammo-limited
        }
      }
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
  } // end single-player player handling
  } // end gameStarted gate

  // Cheats from the modifier menu. Infinite Health = TRULY unkillable: we keep
  // health full AND keep the invincibility flag on, which already blocks bullets,
  // missiles, crashes, lightning, pilot death -- and (in UFO Tag) being tagged.
  if (infiniteHealth) {
    player.health = CONFIG.PLAYER_HEALTH;
    if (player.invincibleTimer < 2) player.invincibleTimer = 2;
  }
  if (infiniteMissiles) { player.missiles = CONFIG.MISSILE_MAX; player.missileTimer = 0; }

  // Online: send my plane to the others and smooth their planes.
  if (Net.inServer) netSyncStep();

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
      // Split-screen always uses teams so the two players can shoot each other.
      const friendly = (mode === 'ww2' && !splitScreen) ? (target.faction === bullet.faction)
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
    missile.update(planes);   // pass planes so it can heat-seek a new target

    for (const target of planes) {
      if (!target.alive) continue;
      if (target.team === missile.team) continue;
      if (hits(missile, target, 16)) {
        missile.dead = true;
        explosions.push(new Explosion(missile.x, missile.y, CONFIG.COLORS.explosion));
        if (typeof Sound !== 'undefined') Sound.boom();   // KABOOM!
        const popped = target.takeHit(CONFIG.MISSILE_DAMAGE); // ~2 missiles = dead
        if (popped) onPlanePopped(target, missile.team);
        break;
      }
    }
  }

  // --- Power-ups: spawn over time, float, and get collected (not in tag mode) ---
  powerupTimer -= 1;
  if (powerupTimer <= 0 && mode !== 'alien' && !splitScreen) { spawnPowerUp(); powerupTimer = CONFIG.POWERUP_INTERVAL; }
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

  // Cameras. In split-screen each half follows its own player; otherwise the
  // single camera follows the plane (or the pilot while parachuting).
  if (splitScreen) {
    followCam(cam1, player,  CONFIG.GAME_W / 2);   // right half
    followCam(cam2, player2, CONFIG.GAME_W / 2);   // left half
  } else {
    // On the title screen, watch a bot so the background shows live dogfights.
    const focus = !gameStarted ? (enemies.find(e => e.alive) || player)
                  : ((playerState === 'chute' && pilot) ? pilot : player);
    const targetX = focus.x - CONFIG.GAME_W / 2 + (focus.vx || 0) * CONFIG.CAM_LOOKAHEAD * 0.1;
    const targetY = focus.y - CONFIG.GAME_H / 2;
    camera.x += wrapDX(targetX - camera.x) * CONFIG.CAM_SMOOTH;
    camera.y += (targetY - camera.y) * CONFIG.CAM_SMOOTH;
    const maxCamY = CONFIG.GROUND_Y - CONFIG.GAME_H + 140;
    if (camera.y > maxCamY) camera.y = maxCamY;
  }
}

// =========================================================================
//  DRAW  --  paint everything onto the screen (runs every frame).
//  draw() sets up the viewport(s); drawWorldContents() paints one view of the
//  world; drawHudLayer() paints the on-top info once.
// =========================================================================
function draw() {
  if (splitScreen) {
    drawWorldView(cam2, player2, 0, CONFIG.GAME_W / 2);                 // LEFT = red
    drawWorldView(cam1, player,  CONFIG.GAME_W / 2, CONFIG.GAME_W / 2); // RIGHT = blue
    ctx.fillStyle = 'rgba(255,255,255,0.85)';                          // split divider
    ctx.fillRect(CONFIG.GAME_W / 2 - 2, 0, 4, CONFIG.GAME_H);
  } else {
    drawWorldView(camera, player, 0, CONFIG.GAME_W);
  }
  if (gameStarted) drawHudLayer();   // no HUD on the title screen
  else drawTitleScreen();            // a plane tows the PIXEL PLANES banner in
}

// ---- Title screen: a game plane flies in towing a pixelated banner, then
// detaches it so the banner settles in the middle as the title. ----
const TITLE_BANNER_W = 860, TITLE_BANNER_H = 156;
function drawTitleScreen() {
  const W = CONFIG.GAME_W, H = CONFIG.GAME_H;
  // Dim the live dogfights behind so the title reads clearly.
  ctx.fillStyle = 'rgba(8,12,26,0.5)';
  ctx.fillRect(0, 0, W, H);

  const bannerY = H * 0.30;
  const centerX = W / 2;
  const towLen = 600;                         // how far behind the plane the banner trails
  const planeX = -780 + frameCount * 13;      // the plane flies in from the left
  const towedX = planeX - towLen;             // where the towed banner would be
  const detached = towedX >= centerX;         // once it reaches the middle, it lets go
  const bannerX = detached ? centerX : towedX;

  drawTowBanner(bannerX, bannerY);

  // The plane + tow rope, while the plane is still on screen.
  if (planeX < W + 500) {
    if (!detached) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(bannerX + TITLE_BANNER_W / 2, bannerY); // banner's front edge
      ctx.lineTo(planeX - 36, bannerY);                  // the plane's tail
      ctx.stroke();
    }
    // Draw the plane bigger so it reads clearly as it tows the banner.
    ctx.save();
    ctx.translate(planeX, bannerY);
    ctx.scale(2.2, 2.2);
    drawPlaneSprite(ctx, playerSpriteSet || PLANE_SPRITES.player, 0, 0, 0, frameCount, false);
    ctx.restore();
  }

  // Engine sound follows the plane: loud/high near the middle, fading as it
  // approaches and as it flies away after dropping the banner.
  if (typeof Sound !== 'undefined') {
    let level = Math.max(0, 1 - Math.abs(planeX - centerX) / (W * 0.6));
    if (planeX > W + 500) level = 0;                      // plane has gone -> silent
    const pitch = (planeX < centerX) ? 100 + level * 55   // higher as it nears
                                     : 95 - level * 30;    // drops after it passes
    Sound.setEngine(level, pitch);
  }
}
// A red, pixelated cloth banner with white "PIXEL PLANES" text (like the real
// banners planes tow behind them).
function drawTowBanner(cx, cy) {
  const w = TITLE_BANNER_W, h = TITLE_BANNER_H;
  const x = cx - w / 2, y = cy - h / 2;
  ctx.save();
  ctx.imageSmoothingEnabled = false;          // keep it crisp/pixel-looking
  ctx.fillStyle = '#d62828'; ctx.fillRect(x, y, w, h);                 // red cloth
  ctx.fillStyle = '#ef4b4b'; ctx.fillRect(x, y, w, 10);               // top highlight
  ctx.fillStyle = '#b51d1d'; ctx.fillRect(x, y + h - 16, w, 16);      // bottom shadow
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6;                     // white border
  ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';                          // grommet dots
  for (let i = 0; i < 8; i++) {
    const gx = x + 26 + i * ((w - 52) / 7);
    ctx.fillRect(gx, y + 13, 7, 7);
    ctx.fillRect(gx, y + h - 20, 7, 7);
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 84px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('PIXEL PLANES', cx, cy + 2);
  ctx.restore();
}

// Draw one view of the world: aim the active camera at camStore, clip to the
// viewport rectangle, paint the world, then restore.
function drawWorldView(camStore, focus, originX, width) {
  camera.x = camStore.x; camera.y = camStore.y;
  viewOriginX = originX; viewWidth = width; viewFocus = focus;
  ctx.save();
  ctx.beginPath(); ctx.rect(originX, 0, width, CONFIG.GAME_H); ctx.clip();
  drawWorldContents();
  ctx.restore();
  viewOriginX = 0; viewWidth = CONFIG.GAME_W; viewFocus = player;
}

function drawWorldContents() {
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

  // --- Other online players ---
  if (Net.inServer) drawRemotePlayers();

  // --- The player plane(s) --- (skipped on the title screen / attract mode)
  if (!gameStarted) {
    /* no player drawn while on the title screen */
  } else if (splitScreen) {
    if (player.alive)  player.draw(ctx);   // blue
    if (player2.alive) player2.draw(ctx);  // red
  } else if (playerState === 'flying' || playerState === 'takeoff') {
    player.draw(ctx);
  } else if (playerState === 'chute' && pilot) {
    pilot.draw(ctx);
  }

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
}

// The on-top info layer, drawn ONCE over the whole screen (not per split half).
function drawHudLayer() {
  if (splitScreen) {
    if (mode === 'alien') drawAlienHud();   // runner count + winner banner
    else drawDuelHud();
    drawKillFeed();
  } else if (mode === 'alien') {
    drawAlienHud();
  } else {
    drawHud();
    if (mode === 'ww2') {
      drawTeamScores();           // green vs black, no names
    } else {
      drawLeaderboard();
      drawKillFeed();
    }
    if (mode === 'blackhole') drawBlackHoleHud();   // flashing "gravity pull" warning
  }
  drawMinimap();
}

// Split-screen scoreboard + control hints + each player's own stats panel.
// RED is the LEFT half, BLUE is the RIGHT half.
function drawDuelHud() {
  ctx.font = 'bold 26px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e0524a';
  ctx.fillText('RED  ' + duelScoreRed, 20, 44);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#7fbdef';
  ctx.fillText('BLUE  ' + duelScoreBlue, CONFIG.GAME_W - 20, 44);

  // Each player's flight stats, in the middle of THEIR half.
  drawDuelStats(player2, CONFIG.GAME_W * 0.25, 'RED',  '#e0524a');
  drawDuelStats(player,  CONFIG.GAME_W * 0.75, 'BLUE', '#7fbdef');

  ctx.font = '15px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.textAlign = 'center';
  ctx.fillText('RED:  WASD   Q gun   E missile   F eject', CONFIG.GAME_W * 0.25, CONFIG.GAME_H - 14);
  ctx.fillText('BLUE:  Arrows   B gun   N missile   M eject', CONFIG.GAME_W * 0.75, CONFIG.GAME_H - 14);
  ctx.textAlign = 'left';
}

// One player's stats panel (throttle / health / missiles / speed), centered at
// cx so it sits in that player's half of the split screen.
function drawDuelStats(p, cx, label, labelColor) {
  const pw = 360, ph = 88;
  const px0 = Math.round(cx - pw / 2);
  const py0 = CONFIG.GAME_H - ph - 44;
  const barX = px0 + 106, barW = 244;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(px0, py0, pw, ph);

  // Who this panel belongs to.
  ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left';
  ctx.fillStyle = labelColor; ctx.fillText(label, px0 + 10, py0 - 6);
  ctx.font = '10px monospace';

  // Throttle
  ctx.fillStyle = '#ffffff'; ctx.fillText('THROTTLE', px0 + 10, py0 + 16);
  ctx.strokeStyle = '#ffffff'; ctx.strokeRect(barX, py0 + 9, barW, 8);
  ctx.fillStyle = '#f1c40f'; ctx.fillRect(barX + 1, py0 + 10, (barW - 2) * p.throttle, 6);

  // Health
  ctx.fillStyle = '#ffffff'; ctx.fillText('HEALTH', px0 + 10, py0 + 34);
  ctx.strokeStyle = '#ffffff'; ctx.strokeRect(barX, py0 + 27, barW, 8);
  const hf = Math.max(0, p.health) / CONFIG.PLAYER_HEALTH;
  ctx.fillStyle = hf > 0.5 ? '#2ecc71' : (hf > 0.25 ? '#f39c12' : '#e74c3c');
  ctx.fillRect(barX + 1, py0 + 28, (barW - 2) * hf, 6);

  // Missiles
  ctx.fillStyle = '#ffffff'; ctx.fillText('MISSILES', px0 + 10, py0 + 54);
  for (let i = 0; i < CONFIG.MISSILE_MAX; i++) {
    const bx = barX + i * 18, by = py0 + 46;
    ctx.strokeStyle = '#ffffff'; ctx.strokeRect(bx, by, 14, 9);
    if (i < p.missiles) { ctx.fillStyle = CONFIG.COLORS.missile; ctx.fillRect(bx + 1, by + 1, 12, 7); }
    else if (i === p.missiles) {
      const fr = p.missileTimer / (CONFIG.MISSILE_REFILL_SECONDS * 60);
      ctx.fillStyle = '#7f8c8d'; ctx.fillRect(bx + 1, by + 1, 12 * fr, 7);
    }
  }

  // Speed
  const sp = Math.hypot(p.vx, p.vy);
  ctx.fillStyle = '#ffffff'; ctx.fillText('SPEED ' + sp.toFixed(1), px0 + 10, py0 + 76);

  // Shot down? Show a respawn note where the plane would be.
  if (!p.alive) {
    ctx.textAlign = 'center'; ctx.font = '18px monospace'; ctx.fillStyle = '#ff8a65';
    ctx.fillText('RESPAWNING...', cx, py0 - 28);
    ctx.textAlign = 'left';
  }
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
    ctx.fillStyle = splitScreen ? '#3fae54'                       // duel bots are green
      : (mode === 'alien') ? (e.isUfo ? '#2ecc40' : '#3b9bff') : e.bodyColor;
    ctx.fillRect(mapX(e.x) - 3, mapY(e.y) - 3, 6, 6); // same size as your marker
  }

  // Split-screen: show player 2 (red) too.
  if (splitScreen && player2.alive) {
    ctx.fillStyle = '#e0524a';
    ctx.fillRect(mapX(player2.x) - 3, mapY(player2.y) - 3, 6, 6);
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

  // Your marker: red box normally; in split-screen player 1 is the BLUE dot.
  const who = (playerState === 'chute' && pilot) ? pilot : player;
  ctx.fillStyle = splitScreen ? '#7fbdef' : '#e74c3c';
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

  // Centered in the CURRENT viewport (so each split half points correctly).
  const cx = viewOriginX + viewWidth / 2;
  const cy = CONFIG.GAME_H / 2;
  const margin = CONFIG.ARROW_MARGIN;
  const size = CONFIG.ARROW_SIZE;

  // Point at every bot, plus the OTHER player in split-screen.
  const targets = [];
  for (const e of enemies) if (e.alive) targets.push(e);
  if (splitScreen) {
    const other = (viewFocus === player) ? player2 : player;
    if (other.alive) targets.push(other);
  }

  for (const t of targets) {
    if (t === viewFocus) continue;

    const sx = worldToScreenX(t.x);
    const sy = t.y - camera.y;

    // Already visible inside this viewport? Then no arrow needed.
    const onScreen = sx >= viewOriginX && sx <= viewOriginX + viewWidth &&
                     sy >= 0 && sy <= CONFIG.GAME_H;
    if (onScreen) continue;

    const angle = Math.atan2(sy - cy, sx - cx);
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const halfW = viewWidth / 2 - margin;
    const halfH = cy - margin;
    let dist;
    if (Math.abs(dx) * halfH > Math.abs(dy) * halfW) dist = halfW / Math.abs(dx);
    else dist = halfH / Math.abs(dy);
    const ix = cx + dx * dist;
    const iy = cy + dy * dist;

    // Arrow color: split = blue/red/green by who it is; Alien = UFO/runner; else its body color.
    let arrowColor = t.bodyColor || '#ffffff';
    if (splitScreen) arrowColor = (t === player) ? '#7fbdef' : (t === player2) ? '#e0524a' : '#3fae54';
    else if (mode === 'alien') arrowColor = t.isUfo ? '#2ecc40' : '#3b9bff';
    ctx.save();
    ctx.translate(ix, iy);
    ctx.rotate(angle);
    ctx.fillStyle = arrowColor;
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size, -size);
    ctx.lineTo(-size, size);
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

// Everyone in the tag round: both human players in split-screen, else you + bots.
function alienPlanes() {
  return splitScreen ? [player, player2, ...enemies] : [player, ...enemies];
}
// UFO free-flight: the arrow/WASD keys move it straight (no plane physics, no
// gravity). Shared by the player UFO in single-player AND in split-screen.
function ufoDirectMove(o) {
  const kUp    = (o.keymap === 'p2') ? Input.up2    : Input.up;
  const kDown  = (o.keymap === 'p2') ? Input.down2  : Input.down;
  const kLeft  = (o.keymap === 'p2') ? Input.left2  : Input.left;
  const kRight = (o.keymap === 'p2') ? Input.right2 : Input.right;
  let dx = 0, dy = 0;
  if (kLeft) dx -= 1; if (kRight) dx += 1; if (kUp) dy -= 1; if (kDown) dy += 1;
  if (dx || dy) { const len = Math.hypot(dx, dy); o.vx = dx / len * CONFIG.UFO_SPEED; o.vy = dy / len * CONFIG.UFO_SPEED; }
  else { o.vx *= 0.8; o.vy *= 0.8; }
  o.x = wrapX(o.x + o.vx); o.y += o.vy;
  if (o.y > CONFIG.GROUND_Y - 6) { o.y = CONFIG.GROUND_Y - 6; o.vy = 0; }
  if (o.y < CONFIG.CEILING) { o.y = CONFIG.CEILING; o.vy = 0; }
  o.propSpin += 1;
}

function startAlien() {
  if (!splitScreen) { spawnPlane(100); playerState = 'flying'; } // single: fly in airborne
  // No power-ups in Alien Tag: clear bubbles + strip everyone's powers so a
  // leftover shield can't make someone impossible to tag.
  powerups.length = 0;
  for (const p of alienPlanes()) {
    p.isUfo = false; p.alive = true; p.deadTimer = 0;
    p.invincibleTimer = 0; p.wideTimer = 0; p.frozenTimer = 0;
  }
  const all = alienPlanes();
  all[Math.floor(Math.random() * all.length)].isUfo = true; // random first UFO
  placeAlienRound();
  alienWinner = null; alienWinTimer = 0;
}
function newAlienRound() {
  const all = alienPlanes();
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
  const all = alienPlanes();
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
  // Pull the human player(s). In split-screen BOTH players feel the gravity.
  const humans = splitScreen ? [player, player2] : [player];
  for (const pl of humans) {
    const airborne = splitScreen ? pl.alive : (playerState === 'flying' || playerState === 'takeoff');
    if (!airborne) continue;
    const d = applyBlackHolePull(pl, 1);
    if (d < CONFIG.BH_HORIZON && pl.invincibleTimer <= 0) {
      implodeAt(pl.x, pl.y);
      if (splitScreen) {
        pushKill('🕳️ ' + ((pl === player) ? 'BLUE' : 'RED') + ' crushed by the black hole', '#b388ff');
        duelDown(pl);
      } else {
        pushKill('🕳️ the black hole crushed YOU', '#b388ff');
        playerDies(pl.x, pl.y, 'SPAGHETTIFIED!');
      }
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
  updateMobileLayout();          // show the UFO pad vs normal controls as needed
  requestAnimationFrame(loop); // ask the browser to run loop again next frame
}

// A dark dim while paused. The PAUSED title + buttons live in the HTML
// #pauseMenu overlay (so they're clickable), drawn on top of the canvas.
function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, CONFIG.GAME_W, CONFIG.GAME_H);
}

loop(); // start the game!
