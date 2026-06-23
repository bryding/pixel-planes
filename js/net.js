// ===========================================================================
//  NET  --  the client side of online play. Talks to the Pixel Planes server
//  over a WebSocket: fetches the server list, creates/joins servers (with
//  optional passwords), tracks whether YOU are the host, and relays planes.
//
//  Set the server address in js/config.js  ->  CONFIG.SERVER_URL
// ===========================================================================

const Net = {
  ws: null,
  status: 'offline',     // 'offline' | 'connecting' | 'online'
  myId: null,
  username: '',
  inServer: false,
  isHost: false,
  serverName: null,
  servers: [],           // latest public server list: [{name, hasPassword, players}]
  lastError: '',
  onChange: null,        // game.js sets this to refresh the lobby UI

  connect(url) {
    if (this.status !== 'offline') return;
    this.status = 'connecting';
    this.lastError = '';
    this._notify();
    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      this.status = 'offline';
      this.lastError = "Couldn't reach the server.";
      this._notify();
      return;
    }
    this.ws.onopen = () => {
      this.status = 'online';
      if (this.username) this.send({ t: 'setname', name: this.username });
      this.send({ t: 'list' });
      this._notify();
    };
    this.ws.onclose = () => {
      this.status = 'offline';
      this.inServer = false; this.isHost = false; this.serverName = null;
      this._notify();
    };
    this.ws.onerror = () => { this.lastError = 'Connection problem.'; this._notify(); };
    this.ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch (_) { return; }
      this._handle(m);
    };
  },

  send(obj) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj)); },
  _notify() { if (typeof this.onChange === 'function') this.onChange(); },

  setName(n) { this.username = n; this.send({ t: 'setname', name: n }); },
  refreshList() { this.send({ t: 'list' }); },
  createServer(name, password) { this.lastError = ''; this.send({ t: 'create', name: name, password: password }); },
  joinServer(name, password) { this.lastError = ''; this.send({ t: 'join', name: name, password: password }); },
  leaveServer() { this.send({ t: 'leave' }); this.inServer = false; this.isHost = false; this.serverName = null; this._notify(); },
  setMode(mode) { if (this.isHost) this.send({ t: 'setmode', mode: mode }); },
  sendState(state) { this.send({ t: 'state', s: state }); },

  // Handle one message from the server. (Public so it can be unit-tested.)
  _handle(m) {
    switch (m.t) {
      case 'welcome': this.myId = m.id; break;
      case 'list':    this.servers = m.servers || []; break;
      case 'joined':
        this.inServer = true; this.isHost = !!m.isHost; this.serverName = m.name; this.lastError = '';
        if (m.mode && typeof onNetMode === 'function') onNetMode(m.mode); // match the host's mode
        break;
      case 'denied':  this.lastError = m.msg || 'Denied.'; break;
      case 'error':   this.lastError = m.msg || 'Error.'; break;
      case 'mode':    if (typeof onNetMode === 'function') onNetMode(m.mode); break;
      case 'you-are-host': this.isHost = true; break;
      case 'host':    this.isHost = (m.id === this.myId); break;
      case 'state':       if (typeof onNetState === 'function') onNetState(m.id, m.name, m.s); break;
      case 'player-left': if (typeof onNetLeft === 'function')  onNetLeft(m.id); break;
    }
    this._notify();
  },
};
