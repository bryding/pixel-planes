// ===========================================================================
//  WORLD  --  the ONE shared sky that every player flies in.
//
//  This little file owns the "truth" about the world: who is connected, the BOT
//  planes that fill the empty spots, and the bots' bullets. Many times a second
//  it builds a SNAPSHOT — a quick list of where every plane is — and the server
//  sends that to everyone so all screens agree.
//
//  It reads its numbers from the SAME js/config.js the browser game uses, and
//  the bots think with the SAME brain (js/bot-ai.js) the offline enemies use.
// ===========================================================================

const CONFIG = require('../online/js/config.js');
const BotAI = require('../online/js/bot-ai.js');
const { desiredBots } = require('./rules.js');

// The single world. There are no rooms or lobbies any more — connect, pick a
// name, and you're in here with everybody else.
const world = {
  targetPopulation: CONFIG.TARGET_POPULATION, // how many planes we want flying
  hardCap: CONFIG.HARD_CAP,                    // most real people allowed at once
  tickHz: CONFIG.NET_TICK_HZ,                  // snapshots per second
  mode: 'classic',     // the world's look/mode (changed by the @hidden Mode Menu)
  players: new Map(),  // id -> { id, name, ws, lastState, alive, score, lastHitBy }
  bots: new Map(),     // id -> bot plane (we add/remove these to fill the world)
  botBullets: [],      // bullets the bots have fired (server-simulated)
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

// Messages the current tick wants to send out, e.g. "a bot fired" or "someone
// was shot down". The server drains this list each tick (to: 'all' or a player
// id). This keeps world.js free of any socket/network code.
let pending = [];
function emitAll(msg) { pending.push({ to: 'all', msg }); }
function emitTo(id, msg) { pending.push({ to: id, msg }); }

// Wrap an x back into 0..WORLD_WIDTH (the world loops around).
function wrapX(x) { const W = CONFIG.WORLD_WIDTH; return ((x % W) + W) % W; }
// Shortest left/right gap between two x's on the looping world.
function gapX(ax, bx) { const W = CONFIG.WORLD_WIDTH; let d = ((ax - bx) % W + W) % W; if (d > W / 2) d -= W; return d; }

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
    health: CONFIG.ENEMY_HEALTH, alive: true, score: 0, respawnTimer: 0,
    propSpin: 0, fireCooldown: 0, missileCooldown: 0, invincibleTimer: 0,
    style,
  };
}

// Move a downed bot to a fresh spot with full health (its explosion already
// played on the clients), so the sky refills itself.
function respawnBot(b) {
  const dir = Math.random() < 0.5 ? 0 : Math.PI;
  b.x = Math.random() * CONFIG.WORLD_WIDTH;
  b.y = CONFIG.GROUND_Y - 200 - Math.random() * 400;
  b.vx = Math.cos(dir) * 3; b.vy = 0; b.angle = dir;
  b.health = CONFIG.ENEMY_HEALTH; b.alive = true; b.score = 0;
}

// A shot hit a bot: take off some health. Returns true if it died (so the
// caller can announce the kill). The bot flies back in after a short delay.
function damageBot(id, dmg) {
  const b = world.bots.get(id);
  if (!b || !b.alive) return false;
  b.health -= dmg;
  if (b.health <= 0) {
    b.alive = false;
    b.respawnTimer = CONFIG.ENEMY_RESPAWN;
    return true;
  }
  return false;
}

// Keep the bot count at exactly max(0, target − humans): add bots when there's
// room, remove them when people take the slots (FR-004/005/006).
function syncBotCount() {
  const desired = desiredBots(world.targetPopulation, world.players.size);
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

// CHEATS (the "@hidden" menu). Anyone may use them — this is your sandbox world,
// so they change the world for EVERYONE by adjusting the bot target + re-syncing.
function cheat(cmd, n) {
  if (cmd === 'addbots') {
    const add = Math.max(1, Math.min(50, n || 5));
    world.targetPopulation = Math.min(100, world.targetPopulation + add);  // cap so the free server stays happy
    syncBotCount();
  } else if (cmd === 'clearbots') {
    world.targetPopulation = 0;
    syncBotCount();
  } else if (cmd === 'resetbots') {
    world.targetPopulation = CONFIG.TARGET_POPULATION;
    syncBotCount();
  } else if (cmd === 'killbots') {
    for (const id of [...world.bots.keys()]) damageBot(id, 99999);   // blow them all up (they respawn)
  }
}

// A bot pulls the trigger: spawn its bullet and tell everyone to draw the shot.
function botShoot(bot) {
  const nx = bot.x + Math.cos(bot.angle) * 17, ny = bot.y + Math.sin(bot.angle) * 17;
  const spd = CONFIG.BULLET_SPEED;
  world.botBullets.push({
    x: nx, y: ny, team: bot.id, life: CONFIG.BULLET_LIFE,
    vx: Math.cos(bot.angle) * spd + bot.vx * 0.3, vy: Math.sin(bot.angle) * spd + bot.vy * 0.3,
  });
  emitAll({ t: 'fire', id: bot.id, kind: 'gun', x: nx, y: ny, heading: bot.angle });
  bot.fireCooldown = bot.style.fireCd;
}

// Fly every bot one 60fps step using the shared brain, and let it shoot. `planes`
// is everyone (people + bots) so bots chase and fire at the nearest plane.
function stepBots(planes) {
  for (const bot of world.bots.values()) {
    // A shot-down bot waits a moment, then flies back in.
    if (!bot.alive) { bot.respawnTimer -= 1; if (bot.respawnTimer <= 0) respawnBot(bot); continue; }

    bot.propSpin += 1;
    if (bot.fireCooldown > 0) bot.fireCooldown -= 1;

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

    // The brain says we're lined up and the gun is ready — fire!
    if (brain.shoot) botShoot(bot);
  }
}

// Move the bots' bullets and see what they hit. A bullet that strikes a person
// is forwarded as a 'hit' (their own client takes the damage, like FR-015); one
// that strikes another bot is resolved right here on the server.
function stepBotBullets(planes) {
  for (const b of world.botBullets) {
    b.x = wrapX(b.x + b.vx); b.y += b.vy; b.life -= 1;
    if (b.life <= 0 || b.y > CONFIG.GROUND_Y) { b.dead = true; continue; }
    for (const p of planes) {
      if (!p.alive || p.team === b.team) continue;            // not itself / its own bullet
      const dx = gapX(p.x, b.x), dy = p.y - b.y;
      if (dx * dx + dy * dy < 16 * 16) {
        b.dead = true;
        if (world.bots.has(p.id)) {
          if (damageBot(p.id, 1)) {
            const killer = world.bots.get(b.team); if (killer) killer.score += 1; // bots earn scores too (blend in)
            emitAll({ t: 'down', victimId: p.id, byId: b.team });
          }
        } else {
          const victim = world.players.get(p.id);
          if (victim && victim.alive) { victim.lastHitBy = b.team; emitTo(p.id, { t: 'hit', targetId: p.id, byId: b.team, kind: 'gun' }); }
        }
        break;
      }
    }
  }
  world.botBullets = world.botBullets.filter((b) => !b.dead);
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
// return the snapshot plus any events (fires, hits, downs) to send out.
function tick() {
  pending = [];
  syncBotCount();
  for (let k = 0; k < SUBSTEPS; k++) {
    const planes = allPlanes();
    stepBots(planes);
    stepBotBullets(planes);
  }
  return { snapshot: { t: 'snapshot', planes: allPlanes().map(planeState) }, events: pending };
}

// Start the heartbeat of the world: `tickHz` times a second, advance the world,
// broadcast the snapshot, and deliver any events. `api` provides broadcast(msg)
// and toPlayer(id, msg). Returns the timer so the caller can stop it.
function startSnapshotLoop(api) {
  const intervalMs = Math.round(1000 / world.tickHz);
  return setInterval(() => {
    const { snapshot, events } = tick();
    api.broadcast(snapshot);
    for (const e of events) { if (e.to === 'all') api.broadcast(e.msg); else api.toPlayer(e.to, e.msg); }
  }, intervalMs);
}

module.exports = {
  world,
  humanCount,
  addPlayer,
  removePlayer,
  syncBotCount,
  cheat,
  damageBot,
  tick,
  startSnapshotLoop,
};
