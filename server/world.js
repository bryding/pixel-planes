// ===========================================================================
//  WORLD  --  the ONE shared sky that every player flies in.
//
//  This little file owns the "truth" about the world: who is connected, and the
//  BOT planes that fill the empty spots so the sky is never lonely. Many times a
//  second it builds a SNAPSHOT — a quick list of where every plane is — and the
//  server sends that to everyone so all screens agree.
//
//  It reads its numbers from the SAME js/config.js the browser game uses, so
//  there's only one place to change things like how many planes we want. The
//  bots think with the SAME brain (js/bot-ai.js) the offline enemies use.
// ===========================================================================

const CONFIG = require('../js/config.js');
const BotAI = require('../js/bot-ai.js');

// The single world. There are no rooms or lobbies any more — connect, pick a
// name, and you're in here with everybody else.
const world = {
  targetPopulation: CONFIG.TARGET_POPULATION, // how many planes we want flying
  hardCap: CONFIG.HARD_CAP,                    // most real people allowed at once
  tickHz: CONFIG.NET_TICK_HZ,                  // snapshots per second
  players: new Map(),  // id -> { id, name, ws, lastState, alive, score }
  bots: new Map(),     // id -> bot plane (we add/remove these to fill the world)
};

// How many 60fps flight steps to run per snapshot (so bots cross the ground at
// the same speed people do, even though we only broadcast ~18 times a second).
const SUBSTEPS = Math.max(1, Math.round(60 / world.tickHz));

// Bots share the same id-space as people, so clients can't tell them apart. We
// start bot ids way up high so they never clash with player ids (which count
// up from 1).
let nextBotId = 1000000;

// Plain, ordinary first names so bots BLEND IN with real players (no emoji or
// goofy tags that would give them away). Duplicates are fine.
const BOT_NAMES = [
  'Alex', 'Sam', 'Jordan', 'Casey', 'Riley', 'Max', 'Charlie', 'Quinn',
  'Jamie', 'Avery', 'Drew', 'Skyler', 'Morgan', 'Reese', 'Parker', 'Hayden',
  'Rowan', 'Emerson', 'Finley', 'Sage', 'Blake', 'Devon', 'Elliot', 'Frankie',
  'Harley', 'Jesse', 'Kai', 'Lane', 'Marley', 'Noel', 'Oakley', 'Phoenix',
];

// Wrap an x back into 0..WORLD_WIDTH (the world loops around).
function wrapX(x) { const W = CONFIG.WORLD_WIDTH; return ((x % W) + W) % W; }

// How many REAL people are in the world right now (bots don't count).
function humanCount() {
  return world.players.size;
}

// Make one fresh bot at a random spot in the sky.
function spawnBot() {
  const id = nextBotId++;
  const style = BotAI.makeStyle(id, CONFIG);
  const dir = Math.random() < 0.5 ? 0 : Math.PI;
  return {
    id, name: BOT_NAMES[id % BOT_NAMES.length],
    team: id, faction: 'green', isUfo: false,
    x: Math.random() * CONFIG.WORLD_WIDTH,
    y: CONFIG.GROUND_Y - 200 - Math.random() * 400,
    vx: Math.cos(dir) * 3, vy: 0, angle: dir,
    health: CONFIG.ENEMY_HEALTH, alive: true, score: 0,
    propSpin: 0, fireCooldown: 0, missileCooldown: 0, invincibleTimer: 0,
    style,
  };
}

// Keep the bot count at exactly max(0, target − humans): add bots when there's
// room, remove them when people take the slots (FR-004/005/006).
function syncBotCount() {
  const desired = Math.max(0, world.targetPopulation - world.players.size);
  while (world.bots.size < desired) { const b = spawnBot(); world.bots.set(b.id, b); }
  while (world.bots.size > desired) { const firstId = world.bots.keys().next().value; world.bots.delete(firstId); }
}

// Put a freshly-named player into the world (and drop a bot to make room).
function addPlayer(player) {
  world.players.set(player.id, player);
  syncBotCount();
}

// Take a player out (they left or disconnected) — a bot fills the empty slot.
function removePlayer(id) {
  world.players.delete(id);
  syncBotCount();
}

// Fly every bot one 60fps step using the shared brain. `planes` is the full
// list of everyone (people + bots) so bots can chase the nearest plane.
function stepBots(planes) {
  for (const bot of world.bots.values()) {
    bot.propSpin += 1;
    if (bot.fireCooldown > 0) bot.fireCooldown -= 1;
    if (bot.missileCooldown > 0) bot.missileCooldown -= 1;

    const brain = BotAI.think(bot, planes, CONFIG, false);
    let wantAngle = brain.target ? brain.wantAngle : bot.angle;
    // Stay off the ground and out of the very top of the sky.
    if (bot.y > CONFIG.GROUND_Y - 60) wantAngle = -Math.PI / 2;
    if (bot.y < CONFIG.CEILING + 120) wantAngle = Math.PI / 2;

    // Turn the nose smoothly toward where we want to go.
    const diff = BotAI._angleDiff(wantAngle, bot.angle);
    if (diff > 0.02) bot.angle += bot.style.turn;
    else if (diff < -0.02) bot.angle -= bot.style.turn;

    // Simple, smooth flight: the engine pushes along the nose, gravity pulls
    // down, and the wings give just enough lift to hold altitude in level flight
    // (less lift when pointing steeply up, so a vertical climb still sinks).
    bot.vx += Math.cos(bot.angle) * bot.style.thrust;
    bot.vy += Math.sin(bot.angle) * bot.style.thrust;
    const sp0 = Math.hypot(bot.vx, bot.vy);
    const lift = CONFIG.GRAVITY * Math.max(0, Math.cos(bot.angle)) * Math.min(1, sp0 / 3);
    bot.vy += CONFIG.GRAVITY - lift;
    bot.vx *= CONFIG.DRAG; bot.vy *= CONFIG.DRAG;
    const sp = Math.hypot(bot.vx, bot.vy);
    if (sp > CONFIG.MAX_SPEED) { bot.vx = bot.vx / sp * CONFIG.MAX_SPEED; bot.vy = bot.vy / sp * CONFIG.MAX_SPEED; }

    bot.x = wrapX(bot.x + bot.vx);
    bot.y += bot.vy;
    if (bot.y > CONFIG.GROUND_Y - 6) { bot.y = CONFIG.GROUND_Y - 6; if (bot.vy > 0) bot.vy = 0; }
    if (bot.y < CONFIG.CEILING) { bot.y = CONFIG.CEILING; bot.vy = 0; }
  }
}

// One PlaneState the client knows how to draw (same shape for people and bots,
// with NO "isBot" flag — bots are meant to blend in).
function planeState(p) {
  return { id: p.id, name: p.name, x: p.x, y: p.y, angle: p.angle,
           vx: p.vx, vy: p.vy, health: p.health, alive: p.alive !== false, score: p.score || 0 };
}

// Build the combined list of everyone for the bots to see and for the snapshot.
// People come from their last reported state; bots from their live simulation.
function allPlanes() {
  const list = [];
  for (const p of world.players.values()) {
    const s = p.lastState;
    if (s) list.push({ id: p.id, name: p.name, x: s.x, y: s.y, angle: s.angle || 0,
                       vx: s.vx || 0, vy: s.vy || 0, health: s.health, score: p.score || 0,
                       alive: s.alive !== false, team: p.id, faction: 'green', isUfo: !!s.isUfo });
  }
  for (const b of world.bots.values()) list.push(b);
  return list;
}

// Advance the world one snapshot's worth of time (several flight steps) and
// return the snapshot to broadcast.
function tick() {
  syncBotCount();
  for (let k = 0; k < SUBSTEPS; k++) stepBots(allPlanes());
  return { t: 'snapshot', planes: allPlanes().map(planeState) };
}

// Start the heartbeat of the world: `tickHz` times a second, advance the world
// and hand the snapshot to `broadcast`. Returns the timer so the caller can
// stop it on shutdown.
function startSnapshotLoop(broadcast) {
  const intervalMs = Math.round(1000 / world.tickHz);
  return setInterval(() => { broadcast(tick()); }, intervalMs);
}

module.exports = {
  world,
  humanCount,
  addPlayer,
  removePlayer,
  syncBotCount,
  tick,
  startSnapshotLoop,
};
