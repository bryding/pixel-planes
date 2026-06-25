// ===========================================================================
//  WORLD  --  the ONE shared sky that every player flies in.
//
//  This little file owns the "truth" about the world: who is connected, and
//  (later) the bot planes that fill empty spots. Many times a second it builds
//  a SNAPSHOT — a quick list of where every plane is — and the server sends
//  that to everyone so all screens agree.
//
//  It reads its numbers from the SAME js/config.js the browser game uses, so
//  there's only one place to change things like how many planes we want.
// ===========================================================================

const CONFIG = require('../js/config.js');

// The single world. There are no rooms or lobbies any more — connect, pick a
// name, and you're in here with everybody else.
const world = {
  targetPopulation: CONFIG.TARGET_POPULATION, // how many planes we want flying
  hardCap: CONFIG.HARD_CAP,                    // most real people allowed at once
  tickHz: CONFIG.NET_TICK_HZ,                  // snapshots per second
  players: new Map(),  // id -> { id, name, ws, lastState, alive, score }
  bots: new Map(),     // id -> bot plane (the server fills empty spots — US3)
};

// How many REAL people are in the world right now (bots don't count).
function humanCount() {
  return world.players.size;
}

// Put a freshly-named player into the world.
function addPlayer(player) {
  world.players.set(player.id, player);
}

// Take a player out (they left or disconnected).
function removePlayer(id) {
  world.players.delete(id);
}

// Build the list of EVERY plane to send to everyone. Right now that's just the
// connected people; bots get added here in a later stage. Each plane is a
// little "PlaneState" object the browser knows how to draw.
function buildSnapshot() {
  const planes = [];
  for (const p of world.players.values()) {
    if (p.lastState) planes.push(p.lastState);
  }
  return { t: 'snapshot', planes };
}

// Start the heartbeat of the world: `tickHz` times a second, build a snapshot
// and hand it to `broadcast` (the server tells everyone). Returns the timer so
// the caller can stop it on shutdown.
function startSnapshotLoop(broadcast) {
  const intervalMs = Math.round(1000 / world.tickHz);
  return setInterval(() => {
    broadcast(buildSnapshot());
  }, intervalMs);
}

module.exports = {
  world,
  humanCount,
  addPlayer,
  removePlayer,
  buildSnapshot,
  startSnapshotLoop,
};
