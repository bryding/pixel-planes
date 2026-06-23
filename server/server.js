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
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;

// name -> { name, password, hostId, mode, clients: Map(id -> ws) }
const servers = new Map();
let nextId = 1;

// A plain web page so visiting the URL in a browser shows it's alive.
const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Pixel Planes server is running. ' + servers.size + ' server(s) open.');
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

httpServer.listen(PORT, () => console.log('Pixel Planes server listening on port ' + PORT));
