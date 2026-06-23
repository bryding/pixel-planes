// ===========================================================================
//  PIXEL PLANES — ONLINE SERVER
//  A tiny WebSocket server that powers online play:
//   • keeps the public SERVER LIST (everyone sees it)
//   • lets anyone CREATE a server (name = letters/numbers, optional password)
//   • lets anyone JOIN a server (password-checked if it has one)
//   • marks the CREATOR as the HOST (only the host may change Mode/Modifiers)
//   • relays each player's plane to everyone else in the same server (sync)
//
//  Run it:   cd server  →  npm install  →  npm start
//  It listens on port 8080 (or process.env.PORT when deployed).
// ===========================================================================

const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;

// name -> { name, password, hostId, mode, clients: Map(id -> ws) }
const servers = new Map();
let nextId = 1;

// This server ALSO hands out the game files (index.html, js/, css/) from the
// project folder, so you only need ONE command and ONE web address to play
// locally -- and there's no https/ws mismatch.
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

// Server names: letters and numbers only, 1–16 characters.
const VALID_NAME = (n) => typeof n === 'string' && /^[A-Z0-9]{1,16}$/.test(n);
const cleanName = (n) => ('' + (n || '')).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);

function listPayload() {
  return {
    t: 'list',
    servers: [...servers.values()].map((s) => ({
      name: s.name,
      hasPassword: !!s.password,
      players: s.clients.size,
    })),
  };
}
// Push the fresh server list to EVERY connected client (so lobby lists update live).
function broadcastList() {
  const p = listPayload();
  wss.clients.forEach((c) => { if (c.readyState === 1) send(c, p); });
}
function broadcastToServer(s, obj, exceptId) {
  s.clients.forEach((ws, id) => { if (id !== exceptId && ws.readyState === 1) send(ws, obj); });
}

wss.on('connection', (ws) => {
  ws.id = nextId++;
  ws.username = 'Player';
  ws.serverName = null;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });   // answered our heartbeat ping
  ws.on('error', () => {});                       // ignore socket errors (close follows)
  console.log('player ' + ws.id + ' connected (' + wss.clients.size + ' online)');
  send(ws, { t: 'welcome', id: ws.id });
  send(ws, listPayload());

  ws.on('message', (data) => {
    let m;
    try { m = JSON.parse(data); } catch (e) { return; }

    switch (m.t) {
      case 'setname':
        ws.username = ('' + (m.name || 'Player')).slice(0, 14) || 'Player';
        break;

      case 'list':
        send(ws, listPayload());
        break;

      case 'create': {
        const name = cleanName(m.name);
        if (!VALID_NAME(name)) return send(ws, { t: 'error', msg: 'Server name must be letters and numbers.' });
        if (servers.has(name)) return send(ws, { t: 'denied', reason: 'name', msg: 'That server name is taken.' });
        const s = {
          name,
          password: m.password ? ('' + m.password) : '',
          hostId: ws.id,
          mode: 'classic',
          clients: new Map(),
        };
        s.clients.set(ws.id, ws);
        ws.serverName = name;
        servers.set(name, s);
        send(ws, { t: 'joined', name, isHost: true, mode: s.mode });
        broadcastList();
        break;
      }

      case 'join': {
        const name = cleanName(m.name);
        const s = servers.get(name);
        if (!s) return send(ws, { t: 'denied', reason: 'missing', msg: 'No server with that name.' });
        if (s.password && ('' + (m.password || '')) !== s.password) {
          return send(ws, { t: 'denied', reason: 'password', msg: 'Wrong password.' });
        }
        s.clients.set(ws.id, ws);
        ws.serverName = name;
        send(ws, { t: 'joined', name, isHost: ws.id === s.hostId, mode: s.mode });
        broadcastToServer(s, { t: 'player-joined', id: ws.id, name: ws.username }, ws.id);
        broadcastList();
        break;
      }

      case 'leave':
        leave(ws);
        break;

      case 'setmode': {
        const s = servers.get(ws.serverName);
        if (s && ws.id === s.hostId) {                 // ONLY the host may change mode
          s.mode = m.mode;
          broadcastToServer(s, { t: 'mode', mode: m.mode }, ws.id); // host already applied it
        }
        break;
      }

      case 'state': {                                  // relay a plane's position (sync)
        const s = servers.get(ws.serverName);
        if (s) broadcastToServer(s, { t: 'state', id: ws.id, name: ws.username, s: m.s }, ws.id);
        break;
      }
    }
  });

  ws.on('close', () => leave(ws));
});

function leave(ws) {
  const s = servers.get(ws.serverName);
  ws.serverName = null;
  if (!s) return;
  s.clients.delete(ws.id);
  if (ws.id === s.hostId) {
    // The host left: hand the host role to the next player, or close if empty.
    const next = s.clients.keys().next();
    if (!next.done) {
      s.hostId = next.value;
      send(s.clients.get(s.hostId), { t: 'you-are-host' });
      broadcastToServer(s, { t: 'host', id: s.hostId });
    }
  }
  if (s.clients.size === 0) servers.delete(s.name);
  else broadcastToServer(s, { t: 'player-left', id: ws.id });
  broadcastList();
}

// --- Heartbeat: every 30s, ping everyone; drop anyone who didn't answer last
// time. This clears out "ghost" players/servers from dropped connections. ---
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) { try { ws.terminate(); } catch (_) {} return; } // 'close' -> leave()
    ws.isAlive = false;
    try { ws.ping(); } catch (_) {}
  });
}, 30000);
wss.on('close', () => clearInterval(heartbeat));

httpServer.listen(PORT, () => {
  console.log('================================================================');
  console.log(' Pixel Planes is RUNNING! Open one of these in a browser:');
  console.log('   • on THIS computer:  http://localhost:' + PORT);
  const nets = os.networkInterfaces();
  Object.keys(nets).forEach((name) => {
    (nets[name] || []).forEach((net) => {
      if (net.family === 'IPv4' && !net.internal) {
        console.log('   • others on WiFi:    http://' + net.address + ':' + PORT);
      }
    });
  });
  console.log(' Everyone who opens it can press ESC -> Create / Join a server.');
  console.log(' (Keep this window open while you play. Press Ctrl+C to stop.)');
  console.log('================================================================');
});
