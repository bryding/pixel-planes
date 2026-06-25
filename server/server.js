// ===========================================================================
//  PIXEL PLANES — ONLINE SERVER
//  A tiny WebSocket server that powers the ONE shared world:
//   • hands out the game files (index.html, js/, css/) so one address does it all
//   • lets anyone connect, pick a NAME, and join the single live sky
//   • relays each player's plane to everyone many times a second (snapshots)
//   • (later stages) runs the backfill bots, combat, and respawns
//
//  There are no rooms, hosts, or passwords any more — it's one big world that's
//  always on (like agar.io). See specs/002-multiplayer-world for the design.
//
//  Run it:   cd server  →  npm install  →  npm start
//  It listens on port 8080 (or process.env.PORT when deployed).
// ===========================================================================

const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

// Gameplay numbers come from the SAME file the browser game uses, so the world
// never drifts out of sync with the client. Change a number there, restart.
const CONFIG = require('../js/config.js');
const World = require('./world.js');

const PORT = process.env.PORT || 8080;
let nextId = 1;

// This server ALSO hands out the game files from the project folder, so you
// only need ONE command and ONE web address to play locally -- and there's no
// https/ws mismatch.
const ROOT = path.join(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};
const httpServer = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; } // no peeking outside
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});
const wss = new WebSocketServer({ server: httpServer });

function send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch (e) {} }

// Send a message to EVERYONE connected (used for snapshots and leave notices).
function broadcast(obj) {
  wss.clients.forEach((c) => { if (c.readyState === 1) send(c, obj); });
}

// Player names: trimmed, a safe set of characters, max 14, default "Player".
// We do NOT filter words (kept simple on purpose — FR-011); duplicates are fine.
function cleanPlayerName(n) {
  const s = ('' + (n || '')).trim().replace(/[^A-Za-z0-9 _-]/g, '').slice(0, 14);
  return s || 'Player';
}

wss.on('connection', (ws) => {
  ws.id = nextId++;
  ws.joined = false;          // becomes true once they send a valid "hello"
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });   // answered our heartbeat ping
  ws.on('error', () => {});                       // ignore socket errors (close follows)

  ws.on('message', (data) => {
    let m;
    try { m = JSON.parse(data); } catch (e) { return; }

    switch (m.t) {
      // The player picked a name and wants into the world.
      case 'hello': {
        if (ws.joined) break;                       // already in — ignore repeats
        const name = cleanPlayerName(m.name);
        const player = {
          id: ws.id, name, ws,
          lastState: null, alive: true, score: 0,
        };
        World.addPlayer(player);
        ws.joined = true;
        ws.player = player;
        console.log('player ' + ws.id + ' (' + name + ') joined (' + World.humanCount() + ' online)');
        send(ws, { t: 'welcome', id: ws.id, target: World.world.targetPopulation, tickHz: World.world.tickHz });
        break;
      }

      // The client's own plane this frame — remember it for the next snapshot.
      // We stamp on the real id and name so nobody can spoof another plane.
      case 'state': {
        if (!ws.joined || !m.s) break;
        ws.player.lastState = Object.assign({}, m.s, { id: ws.id, name: ws.player.name });
        break;
      }
    }
  });

  ws.on('close', () => leave(ws));
});

// A player left (closed the tab or dropped). Take them out of the world and
// tell everyone so their plane disappears within a moment (FR-010).
function leave(ws) {
  if (!ws.joined) return;
  World.removePlayer(ws.id);
  ws.joined = false;
  console.log('player ' + ws.id + ' left (' + World.humanCount() + ' online)');
  broadcast({ t: 'player-left', id: ws.id });
}

// The beating heart of the world: send everyone a snapshot ~NET_TICK_HZ/sec.
const snapshotTimer = World.startSnapshotLoop(broadcast);

// --- Heartbeat: every 30s, ping everyone; drop anyone who didn't answer last
// time. This clears out "ghost" players from dropped connections. ---
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) { try { ws.terminate(); } catch (_) {} return; } // 'close' -> leave()
    ws.isAlive = false;
    try { ws.ping(); } catch (_) {}
  });
}, 30000);
wss.on('close', () => { clearInterval(heartbeat); clearInterval(snapshotTimer); });

httpServer.listen(PORT, () => {
  console.log('================================================================');
  console.log(' Pixel Planes WORLD is RUNNING! Open one of these in a browser:');
  console.log('   • on THIS computer:  http://localhost:' + PORT);
  const nets = os.networkInterfaces();
  Object.keys(nets).forEach((name) => {
    (nets[name] || []).forEach((net) => {
      if (net.family === 'IPv4' && !net.internal) {
        console.log('   • others on WiFi:    http://' + net.address + ':' + PORT);
      }
    });
  });
  console.log(' Everyone who opens it types a name and flies in the same sky.');
  console.log(' (Keep this window open while you play. Press Ctrl+C to stop.)');
  console.log('================================================================');
});
